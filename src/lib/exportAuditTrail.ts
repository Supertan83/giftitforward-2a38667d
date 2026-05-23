import XLSX from 'xlsx-js-style';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { AUDIT_REFERENCE_LEDGER, AUDIT_REFERENCE_TOTALS } from '@/lib/auditReferenceLedger';
import {
  resolveDiscrepancy,
  statusRank,
  RESOLVER_RULES,
  type ResolverStatus,
  type ResolverResult,
} from '@/lib/discrepancyResolver';

// ---------------------------------------------------------------------------
// Brand palette (Dubai Holding) + status palette
// xlsx-js-style colors are ARGB hex strings (no leading #).
// ---------------------------------------------------------------------------
const C = {
  DH_RED:        'E41E26',
  DH_RED_TINT:   'FCE7E9',
  DH_GREY:       '4A4A4A',
  DH_GREY_TINT:  'EAEAEA',
  WHITE:         'FFFFFF',
  BLACK:         '111111',
  STATUS_GREEN:  'D1FAE5',
  STATUS_AMBER:  'FEF3C7',
  STATUS_RED:    'FEE2E2',
  STATUS_BLUE:   'DBEAFE',
  BORDER:        'D4D4D4',
};

const FONT_BODY = 'Rubik';
const FONT_HEAD = 'Merriweather';

// ---------- styling helpers ----------
const border = {
  top:    { style: 'thin', color: { rgb: C.BORDER } },
  bottom: { style: 'thin', color: { rgb: C.BORDER } },
  left:   { style: 'thin', color: { rgb: C.BORDER } },
  right:  { style: 'thin', color: { rgb: C.BORDER } },
} as const;

const styleHeader = {
  fill: { patternType: 'solid', fgColor: { rgb: C.DH_RED } },
  font: { name: FONT_BODY, bold: true, color: { rgb: C.WHITE }, sz: 11 },
  alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
  border,
};
const styleCell = {
  font: { name: FONT_BODY, color: { rgb: C.BLACK }, sz: 10 },
  alignment: { vertical: 'center', wrapText: true },
  border,
};
const styleCellNumber = {
  ...styleCell,
  alignment: { horizontal: 'right', vertical: 'center' },
  numFmt: '#,##0',
};
const styleCellDelta = (delta: number, ref: number) => {
  const abs = Math.abs(delta);
  let fill = C.STATUS_GREEN;
  if (abs > 0) fill = ref > 0 && abs / ref <= 0.01 ? C.STATUS_AMBER : C.STATUS_RED;
  return {
    ...styleCellNumber,
    fill: { patternType: 'solid', fgColor: { rgb: fill } },
    font: { ...styleCellNumber.font, bold: true },
  };
};
const styleStatusCell = (status: ResolverStatus) => {
  const fill =
    status === 'resolved' ? C.STATUS_GREEN
    : status === 'documented' ? C.STATUS_AMBER
    : C.STATUS_RED;
  return {
    ...styleCell,
    fill: { patternType: 'solid', fgColor: { rgb: fill } },
    font: { ...styleCell.font, bold: true },
    alignment: { horizontal: 'center', vertical: 'center' },
  };
};
const styleSectionHeading = {
  fill: { patternType: 'solid', fgColor: { rgb: C.DH_GREY } },
  font: { name: FONT_HEAD, bold: true, color: { rgb: C.WHITE }, sz: 12 },
  alignment: { horizontal: 'left', vertical: 'center' },
  border,
};
const styleCoverTitle = {
  fill: { patternType: 'solid', fgColor: { rgb: C.DH_RED } },
  font: { name: FONT_HEAD, bold: true, color: { rgb: C.WHITE }, sz: 22 },
  alignment: { horizontal: 'left', vertical: 'center' },
};
const styleCoverSubtitle = {
  fill: { patternType: 'solid', fgColor: { rgb: C.DH_RED } },
  font: { name: FONT_BODY, color: { rgb: C.WHITE }, sz: 11 },
  alignment: { horizontal: 'left', vertical: 'center' },
};
const styleTotalsRow = {
  ...styleCellNumber,
  fill: { patternType: 'solid', fgColor: { rgb: C.DH_GREY_TINT } },
  font: { ...styleCellNumber.font, bold: true },
  border: {
    ...border,
    top: { style: 'medium', color: { rgb: C.DH_GREY } },
  },
};
const styleTotalsLabel = {
  ...styleCell,
  fill: { patternType: 'solid', fgColor: { rgb: C.DH_GREY_TINT } },
  font: { ...styleCell.font, bold: true },
  border: {
    ...border,
    top: { style: 'medium', color: { rgb: C.DH_GREY } },
  },
};

const addr = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });

/** Apply styles row-by-row over an already-built sheet. */
function applyTable(
  ws: XLSX.WorkSheet,
  startRow: number,
  rows: Record<string, any>[],
  cellStylers: Record<string, (val: any, row: any) => any> = {}
) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  // header
  headers.forEach((h, c) => {
    const cell = ws[addr(startRow, c)];
    if (cell) cell.s = styleHeader;
  });
  // body
  rows.forEach((row, ri) => {
    headers.forEach((h, c) => {
      const a = addr(startRow + 1 + ri, c);
      const cell = ws[a];
      if (!cell) return;
      const styler = cellStylers[h];
      const v = row[h];
      let s: any = typeof v === 'number' ? styleCellNumber : styleCell;
      if (styler) {
        const override = styler(v, row);
        if (override) s = { ...s, ...override };
      }
      cell.s = s;
    });
  });
}

function setCols(ws: XLSX.WorkSheet, widths: number[]) {
  ws['!cols'] = widths.map((w) => ({ wch: w }));
}

function setFreeze(ws: XLSX.WorkSheet, row: number, col = 0) {
  // @ts-ignore xlsx-js-style supports !freeze
  ws['!freeze'] = { xSplit: col, ySplit: row };
  ws['!views'] = [{ state: 'frozen', xSplit: col, ySplit: row }];
}

const fmtD = (v: any) => (v ? format(new Date(v), 'yyyy-MM-dd') : '');

// ===========================================================================
// MAIN EXPORT
// ===========================================================================
export async function exportFullAuditTrail(): Promise<{
  donations: number;
  allocations: number;
  distributions: number;
  remaining: number;
  materials: number;
  mismatches: number;
  resolved: number;
  documented: number;
  unexplained: number;
}> {
  const safeFetch = async <T,>(label: string, fn: () => Promise<T[]>): Promise<T[]> => {
    try {
      return await fn();
    } catch (e: any) {
      console.error(`[audit-export] ${label} failed:`, e);
      throw new Error(`Failed to load ${label}: ${e?.message ?? e}`);
    }
  };

  const [itemTypes, extItems, extCompanies, extMatGroups, allocations, marketplaces, warehouseReturns] =
    await Promise.all([
      safeFetch('item_types', () =>
        fetchAllRows<any>(() =>
          supabase
            .from('item_types')
            .select('id, name, category, subcategory, external_material_id, surpluss_url')
            .is('deleted_at', null)
        )
      ),
      safeFetch('external_items', () =>
        fetchAllRows<any>(() =>
          supabase
            .from('external_items')
            .select('external_id, title, description, quantity, item_count, company_id, material_group_id, created_at')
            .is('deleted_at', null)
        )
      ),
      safeFetch('external_companies', () =>
        fetchAllRows<any>(() =>
          supabase.from('external_companies').select('id, name, sector').is('deleted_at', null)
        )
      ),
      safeFetch('external_material_groups', () =>
        fetchAllRows<any>(() =>
          supabase.from('external_material_groups').select('id, name, code, uom').is('deleted_at', null)
        )
      ),
      safeFetch('marketplace_item_allocations', () =>
        fetchAllRows<any>(() =>
          supabase
            .from('marketplace_item_allocations')
            .select(
              'id, marketplace_id, item_type_id, allocated_quantity, distributed_quantity, original_allocated_quantity, surpluss_allocation_id, created_at, updated_at'
            )
            .is('deleted_at', null)
        )
      ),
      safeFetch('marketplace_events', () =>
        fetchAllRows<any>(() =>
          supabase
            .from('marketplace_events')
            .select('id, name, event_date, status, location, outreach_partner, manual_beneficiary_count, demographics_reach, external_id')
            .is('deleted_at', null)
        )
      ),
      fetchAllRows<any>(() =>
        supabase
          .from('warehouse_returns' as any)
          .select('marketplace_id, item_type_id, allocation_id, quantity_returned, return_batch_code, returned_at')
          .is('deleted_at', null)
      ).catch(() => [] as any[]),
    ]);

  // ----- Lookup maps -----
  const itemById = new Map<string, any>(itemTypes.map((i) => [i.id, i]));
  const itemByMaterialId = new Map<number, any>(
    itemTypes.filter((i) => i.external_material_id != null).map((i) => [i.external_material_id, i])
  );
  const mpById = new Map<string, any>(marketplaces.map((m) => [m.id, m]));
  const companyById = new Map<string, any>(extCompanies.map((c) => [c.id, c]));
  const matGroupById = new Map<string, any>(extMatGroups.map((g) => [g.id, g]));

  // marketplaces tied to the auditor scope
  const refMaterialIds = new Set<number>(AUDIT_REFERENCE_LEDGER.map((r) => r.materialId));
  const mpInScope = new Set<string>();
  for (const a of allocations) {
    const it = itemById.get(a.item_type_id);
    if (it?.external_material_id && refMaterialIds.has(it.external_material_id)) {
      mpInScope.add(a.marketplace_id);
    }
  }

  // Aggregate warehouse returns
  const returnsByAllocation = new Map<string, { qty: number; batch: string; date: string }>();
  const returnsByMpItem = new Map<string, { qty: number; batch: string; date: string }>();
  for (const r of warehouseReturns ?? []) {
    const qty = r.quantity_returned ?? 0;
    if (r.allocation_id) {
      const cur = returnsByAllocation.get(r.allocation_id);
      if (!cur) returnsByAllocation.set(r.allocation_id, { qty, batch: r.return_batch_code ?? '', date: r.returned_at });
      else {
        cur.qty += qty;
        if (r.returned_at > cur.date) cur.date = r.returned_at;
      }
    }
    const k = `${r.marketplace_id}|${r.item_type_id}`;
    const cur2 = returnsByMpItem.get(k);
    if (!cur2) returnsByMpItem.set(k, { qty, batch: r.return_batch_code ?? '', date: r.returned_at });
    else {
      cur2.qty += qty;
      if (r.returned_at > cur2.date) cur2.date = r.returned_at;
    }
  }

  // chronological allocations per material
  const allocsByItem = new Map<string, any[]>();
  for (const a of allocations) {
    const arr = allocsByItem.get(a.item_type_id) ?? [];
    arr.push(a);
    allocsByItem.set(a.item_type_id, arr);
  }
  for (const arr of allocsByItem.values()) {
    arr.sort((x, y) => {
      const dx = mpById.get(x.marketplace_id)?.event_date ?? x.created_at;
      const dy = mpById.get(y.marketplace_id)?.event_date ?? y.created_at;
      return String(dx).localeCompare(String(dy));
    });
  }

  // received aggregates
  const receivedByMatId = new Map<
    number,
    { qty: number; firstDate: string; donors: Set<string>; titles: Set<string>; matGroup: string }
  >();
  for (const it of extItems) {
    const cur = receivedByMatId.get(it.external_id) ?? {
      qty: 0,
      firstDate: it.created_at,
      donors: new Set<string>(),
      titles: new Set<string>(),
      matGroup: '',
    };
    cur.qty += it.item_count ?? it.quantity ?? 0;
    if (it.created_at < cur.firstDate) cur.firstDate = it.created_at;
    const company = it.company_id ? companyById.get(it.company_id) : null;
    if (company?.name) cur.donors.add(company.name);
    if (it.title) cur.titles.add(it.title);
    if (!cur.matGroup && it.material_group_id) {
      const g = matGroupById.get(it.material_group_id);
      if (g?.name) cur.matGroup = g.name;
    }
    receivedByMatId.set(it.external_id, cur);
  }

  // marketplace IDs that rely entirely on manual_beneficiary_count
  const manualOnlyMpIds = new Set<string>(
    marketplaces.filter((m) => (m.manual_beneficiary_count ?? 0) > 0).map((m) => m.id)
  );

  // =========================================================================
  // Material-level platform totals (used by ledger, closing stock, resolver)
  // =========================================================================
  type MatTotals = {
    received: number;
    distributed: number;
    remaining: number;
    hasSurplussReconciliation: boolean;
    reliesOnManualCount: boolean;
    donor: string;
  };
  const totalsByMatId = new Map<number, MatTotals>();
  for (const matId of new Set<number>([
    ...Array.from(itemTypes).filter((i) => i.external_material_id != null).map((i: any) => i.external_material_id),
    ...receivedByMatId.keys(),
  ])) {
    const item = itemByMaterialId.get(matId);
    const rec = receivedByMatId.get(matId);
    const allocs = item ? allocsByItem.get(item.id) ?? [] : [];
    const distributed = allocs.reduce((s, a) => s + (a.distributed_quantity ?? 0), 0);
    const remaining = allocs.reduce(
      (s, a) =>
        s +
        Math.max((a.original_allocated_quantity ?? a.allocated_quantity ?? 0) - (a.distributed_quantity ?? 0), 0),
      0
    );
    const hasSurplussReconciliation = allocs.some(
      (a) => (a.original_allocated_quantity ?? 0) > (a.allocated_quantity ?? 0)
    );
    const reliesOnManualCount = allocs.some((a) => manualOnlyMpIds.has(a.marketplace_id));
    totalsByMatId.set(matId, {
      received: rec?.qty ?? 0,
      distributed,
      remaining,
      hasSurplussReconciliation,
      reliesOnManualCount,
      donor: rec ? Array.from(rec.donors).join('; ') : '',
    });
  }

  // =========================================================================
  // Run resolver per Material ID (used by reconciliation + discrepancy + log)
  // =========================================================================
  const refByMatId = new Map(AUDIT_REFERENCE_LEDGER.map((r) => [r.materialId, r]));
  const allMatIds = new Set<number>([...refByMatId.keys(), ...totalsByMatId.keys()]);

  const resolverResults = new Map<number, ResolverResult>();
  const ruleHits = new Map<string, { materials: number; deltaResolved: number }>();
  for (const matId of allMatIds) {
    const ref = refByMatId.get(matId) ?? null;
    const tot = totalsByMatId.get(matId) ?? { received: 0, distributed: 0, remaining: 0, hasSurplussReconciliation: false, reliesOnManualCount: false, donor: ref?.donor ?? '' };
    const result = resolveDiscrepancy({
      materialId: matId,
      donor: tot.donor || ref?.donor || '',
      platformReceived: tot.received,
      platformDistributed: tot.distributed,
      platformRemaining: tot.remaining,
      refReceived: ref?.received ?? null,
      refDistributed: ref?.distributed ?? null,
      refRemaining: ref?.remaining ?? null,
      hasSurplussReconciliation: tot.hasSurplussReconciliation,
      reliesOnManualCount: tot.reliesOnManualCount,
    });
    resolverResults.set(matId, result);
    const totalDelta =
      Math.abs((ref?.received ?? 0) - tot.received) +
      Math.abs((ref?.distributed ?? 0) - tot.distributed) +
      Math.abs((ref?.remaining ?? 0) - tot.remaining);
    const cur = ruleHits.get(result.reasonCode) ?? { materials: 0, deltaResolved: 0 };
    cur.materials += 1;
    cur.deltaResolved += totalDelta;
    ruleHits.set(result.reasonCode, cur);
  }

  let countResolved = 0, countDocumented = 0, countUnexplained = 0;
  for (const r of resolverResults.values()) {
    if (r.status === 'resolved') countResolved++;
    else if (r.status === 'documented') countDocumented++;
    else countUnexplained++;
  }
  // "mismatch" for legacy toast counts non-MATCH where reference exists
  const mismatchCount = Array.from(resolverResults.entries()).filter(
    ([id, r]) => refByMatId.has(id) && r.reasonCode !== 'MATCH'
  ).length;

  // =========================================================================
  // SHEET: Material Movement Ledger
  // =========================================================================
  type LedgerRow = Record<string, any>;
  const ledgerHeaders = [
    'Material ID', 'Donor', 'Category', 'Item Description', 'Qty Received',
    'Warehouse Intake Date (system)', 'Warehouse Intake Date (manual)',
    'Movement Type', 'Marketplace', 'Event Date', 'Qty Allocated',
    'Qty Distributed', 'Qty Returned', 'Return Count Date', 'Reallocated To',
    'Final Disposition', 'GIF 2027 Qty', 'Audit Scope',
  ];
  const emptyLedger = (): LedgerRow => Object.fromEntries(ledgerHeaders.map((h) => [h, '']));

  const ledgerRows: LedgerRow[] = [];
  const ledgerRowFlags: ('received' | 'alloc' | 'blank')[] = [];

  const sortedMatIds = Array.from(allMatIds).filter((id) => totalsByMatId.has(id)).sort((a, b) => a - b);

  for (const matId of sortedMatIds) {
    const item = itemByMaterialId.get(matId);
    const rec = receivedByMatId.get(matId);
    const tot = totalsByMatId.get(matId)!;
    const donor = tot.donor;
    const category = item?.category ?? rec?.matGroup ?? '';
    const itemDesc = item?.name ?? (rec ? Array.from(rec.titles).join(' / ') : '');
    const intakeSystem = rec?.firstDate ? fmtD(rec.firstDate) : '';

    const headRow = emptyLedger();
    headRow['Material ID'] = matId;
    headRow.Donor = donor;
    headRow.Category = category;
    headRow['Item Description'] = itemDesc;
    headRow['Qty Received'] = tot.received;
    headRow['Warehouse Intake Date (system)'] = intakeSystem;
    headRow['Movement Type'] = 'RECEIVED';
    headRow.Marketplace = 'Warehouse Intake';
    headRow['Event Date'] = intakeSystem;
    ledgerRows.push(headRow);
    ledgerRowFlags.push('received');

    const itemAllocs = item ? allocsByItem.get(item.id) ?? [] : [];
    let totalDistributed = 0;
    let totalRemaining = 0;
    for (let i = 0; i < itemAllocs.length; i++) {
      const a = itemAllocs[i];
      const mp = mpById.get(a.marketplace_id);
      const allocated = a.original_allocated_quantity ?? a.allocated_quantity ?? 0;
      const distributed = a.distributed_quantity ?? 0;
      const live = a.allocated_quantity ?? 0;
      const returned = Math.max(allocated - distributed, live - distributed);
      const ret =
        returnsByAllocation.get(a.id) ?? returnsByMpItem.get(`${a.marketplace_id}|${a.item_type_id}`);
      const next = itemAllocs.slice(i + 1)[0];
      const nextMp = next ? mpById.get(next.marketplace_id) : null;
      const row = emptyLedger();
      row['Material ID'] = matId;
      row['Movement Type'] = 'ALLOCATED → DISTRIBUTED';
      row.Marketplace = mp?.name ?? '(unknown marketplace)';
      row['Event Date'] = fmtD(mp?.event_date);
      row['Qty Allocated'] = allocated;
      row['Qty Distributed'] = distributed;
      row['Qty Returned'] = returned > 0 ? returned : '';
      row['Return Count Date'] = ret?.date ? fmtD(ret.date) : '';
      row['Reallocated To'] = nextMp ? nextMp.name : '';
      row['Audit Scope'] = mpInScope.has(a.marketplace_id) ? 'In scope' : 'Out of audit scope';
      ledgerRows.push(row);
      ledgerRowFlags.push('alloc');
      totalDistributed += distributed;
      totalRemaining += Math.max(allocated - distributed, 0);
    }

    let disposition = 'No Allocation';
    if (itemAllocs.length > 0) {
      if (totalRemaining <= 0) disposition = 'Fully Distributed';
      else if (totalDistributed > 0) disposition = 'Partially Distributed';
      else disposition = 'Pending Distribution';
    }
    const lastRow = ledgerRows[ledgerRows.length - 1];
    lastRow['Final Disposition'] = disposition;
    if (totalRemaining > 0) lastRow['GIF 2027 Qty'] = totalRemaining;

    ledgerRows.push(emptyLedger());
    ledgerRowFlags.push('blank');
  }

  // =========================================================================
  // SHEET: Summary by Marketplace
  // =========================================================================
  const summaryByMp = marketplaces
    .map((mp, idx) => {
      const mpAllocs = allocations.filter((a) => a.marketplace_id === mp.id);
      const allocated = mpAllocs.reduce(
        (s, a) => s + (a.original_allocated_quantity ?? a.allocated_quantity ?? 0),
        0
      );
      const distributed = mpAllocs.reduce((s, a) => s + (a.distributed_quantity ?? 0), 0);
      const returned = Math.max(allocated - distributed, 0);
      const lastReturn = (warehouseReturns ?? [])
        .filter((r) => r.marketplace_id === mp.id)
        .map((r) => r.returned_at)
        .sort()
        .slice(-1)[0];
      const isManual = (mp.manual_beneficiary_count ?? 0) > 0;
      const beneficiaries = mp.manual_beneficiary_count ?? mp.demographics_reach ?? 0;
      return {
        Marketplace: mp.name,
        Sheet: `MP${idx + 1}`,
        'Event Date': fmtD(mp.event_date),
        'Outreach Partner': mp.outreach_partner ?? '',
        Beneficiaries: isManual ? `${beneficiaries} †` : beneficiaries,
        'Items Allocated': allocated,
        'Items Distributed': distributed,
        'Items Returned': returned,
        'Return Count Date': lastReturn ? fmtD(lastReturn) : '',
        'Audit Scope': mpInScope.has(mp.id) ? 'In scope' : 'Out of audit scope',
      };
    })
    .sort((a, b) => String(a['Event Date']).localeCompare(String(b['Event Date'])));

  const sumAllocated   = summaryByMp.reduce((s, r) => s + Number(r['Items Allocated'] || 0), 0);
  const sumDistributed = summaryByMp.reduce((s, r) => s + Number(r['Items Distributed'] || 0), 0);
  const sumReturned    = summaryByMp.reduce((s, r) => s + Number(r['Items Returned'] || 0), 0);

  // =========================================================================
  // SHEET: GIF 2027 Closing Stock
  // =========================================================================
  const closingStock: any[] = [];
  for (const matId of sortedMatIds) {
    const item = itemByMaterialId.get(matId);
    if (!item) continue;
    const tot = totalsByMatId.get(matId)!;
    if (tot.remaining <= 0) continue;
    const itemAllocs = allocsByItem.get(item.id) ?? [];
    const rec = receivedByMatId.get(matId);
    const lastMp = itemAllocs.length ? mpById.get(itemAllocs[itemAllocs.length - 1].marketplace_id) : null;
    closingStock.push({
      'Material ID': matId,
      Donor: rec ? Array.from(rec.donors).join('; ') : '',
      Category: item.category ?? '',
      'Item Description': item.name,
      'Remaining Qty': tot.remaining,
      'Source Marketplace (last event)': lastMp ? `${lastMp.name} (${fmtD(lastMp.event_date)})` : '',
    });
  }
  closingStock.sort((a, b) => Number(b['Remaining Qty']) - Number(a['Remaining Qty']));
  const closingTotal = closingStock.reduce((s, r) => s + Number(r['Remaining Qty'] || 0), 0);

  // =========================================================================
  // SHEET: Reconciliation Check
  // =========================================================================
  const platformReceived = Array.from(receivedByMatId.values()).reduce((s, v) => s + v.qty, 0);
  const platformAllocated = allocations.reduce(
    (s, a) => s + (a.original_allocated_quantity ?? a.allocated_quantity ?? 0), 0
  );
  const platformDistributed = allocations.reduce((s, a) => s + (a.distributed_quantity ?? 0), 0);
  const platformRemaining = allocations.reduce(
    (s, a) =>
      s + Math.max((a.original_allocated_quantity ?? a.allocated_quantity ?? 0) - (a.distributed_quantity ?? 0), 0),
    0
  );

  const reconRow = (metric: string, ref: number | string, live: number | string, explain: string) => {
    const d = typeof ref === 'number' && typeof live === 'number' ? live - ref : '';
    let status = 'Match';
    if (typeof d === 'number') {
      const refN = typeof ref === 'number' ? ref : 0;
      if (d === 0) status = 'Match';
      else if (refN > 0 && Math.abs(d) / refN <= 0.01) status = 'Within tolerance';
      else status = explain ? 'Documented variance' : 'Unexplained';
    } else {
      status = explain ? 'Documented' : '—';
    }
    return { Metric: metric, 'Auditor Reference': ref, 'Platform Live': live, 'Δ': d, Status: status, Explanation: explain };
  };

  const recon = [
    reconRow('Total Items Received into Programme',     AUDIT_REFERENCE_TOTALS.programmeReceived,      platformReceived,    ''),
    reconRow('Platform Total (incl. Al Jaber in-kind)', AUDIT_REFERENCE_TOTALS.platformIncludingInKind, platformReceived,    'In-kind line excluded from auditor reference; platform total includes it.'),
    reconRow('Total Items Distributed',                 AUDIT_REFERENCE_TOTALS.totalDistributed,        platformDistributed, ''),
    reconRow('Total Items Remaining (GIF 2027)',        AUDIT_REFERENCE_TOTALS.totalRemaining,          platformRemaining,   ''),
    reconRow('Total Allocated across all MPs',          AUDIT_REFERENCE_TOTALS.totalAllocatedAcrossMPs, platformAllocated,   'Includes reallocations across multiple events.'),
    reconRow('Total Returned across all MPs',           AUDIT_REFERENCE_TOTALS.totalReturned,           Math.max(platformAllocated - platformDistributed, 0), ''),
    { Metric: 'Marketplace Rejections', 'Auditor Reference': AUDIT_REFERENCE_TOTALS.marketplaceRejections, 'Platform Live': 'Not tracked', 'Δ': '—', Status: 'Documented', Explanation: 'Handled via physical partner certificates, not on platform.' },
    reconRow('Marketplace Count',                       AUDIT_REFERENCE_TOTALS.marketplaceCount,        marketplaces.length, 'Platform tracks all programme events; auditor scope is narrower.'),
    reconRow('# Materials with Remaining Stock',        AUDIT_REFERENCE_TOTALS.materialIdsRemaining,    closingStock.length, ''),
  ];

  // =========================================================================
  // SHEET: Discrepancy Report
  // =========================================================================
  const discRows = Array.from(allMatIds).map((matId) => {
    const ref = refByMatId.get(matId);
    const item = itemByMaterialId.get(matId);
    const rec = receivedByMatId.get(matId);
    const tot = totalsByMatId.get(matId) ?? { received: 0, distributed: 0, remaining: 0 } as any;
    const r = resolverResults.get(matId)!;
    return {
      'Material ID': matId,
      Item: ref?.item ?? item?.name ?? '',
      Donor: ref?.donor ?? (rec ? Array.from(rec.donors).join('; ') : ''),
      'Auditor Received': ref?.received ?? '',
      'Platform Received': tot.received,
      'Δ Received': ref ? tot.received - ref.received : '',
      'Auditor Distributed': ref?.distributed ?? '',
      'Platform Distributed': tot.distributed,
      'Δ Distributed': ref ? tot.distributed - ref.distributed : '',
      'Auditor Remaining': ref?.remaining ?? '',
      'Platform Remaining': tot.remaining,
      'Δ Remaining': ref ? tot.remaining - ref.remaining : '',
      'Reason Code': r.reasonCode,
      'Auto-Resolution': r.explanation,
      Status:
        r.status === 'resolved' ? 'Resolved' :
        r.status === 'documented' ? 'Documented' : 'Unexplained',
      _status: r.status as ResolverStatus,
    };
  });
  discRows.sort(
    (a, b) => statusRank(a._status) - statusRank(b._status) || Number(a['Material ID']) - Number(b['Material ID'])
  );
  // strip the helper field before writing
  const discRowsOut = discRows.map(({ _status, ...rest }) => rest);

  // =========================================================================
  // SHEET: Auto-Resolution Log
  // =========================================================================
  const autoLog = RESOLVER_RULES.map((rule) => {
    const hit = ruleHits.get(rule.code) ?? { materials: 0, deltaResolved: 0 };
    return {
      'Rule Code': rule.code,
      Status: rule.status === 'resolved' ? 'Resolved' : rule.status === 'documented' ? 'Documented' : 'Unexplained',
      'Trigger Condition': rule.trigger,
      'Explanation Used': rule.explanation,
      'Materials Affected': hit.materials,
      'Total |Δ| Auto-Resolved': hit.deltaResolved,
    };
  });

  // =========================================================================
  // BUILD WORKBOOK
  // =========================================================================
  const wb = XLSX.utils.book_new();

  // ----- 1. Methodology (cover) -----
  const cover: any[][] = [];
  cover.push(['GIF 2026 — Audit Trail Report', '']);
  cover.push([`Generated ${format(new Date(), 'EEEE, d MMMM yyyy · HH:mm')} · Greatest Items Forward Programme`, '']);
  cover.push(['', '']);
  cover.push(['PURPOSE', '']);
  cover.push(['', 'Item-level audit trail of donation receipt → marketplace allocation → distribution → returned / reallocated → final disposition. Numbers are generated live from the GIF platform and cross-checked against the auditor reference workbook.']);
  cover.push(['', '']);
  cover.push(['RECONCILIATION HEADLINE', '']);
  cover.push(['Programme items received',         `${AUDIT_REFERENCE_TOTALS.programmeReceived.toLocaleString()} (auditor) · ${platformReceived.toLocaleString()} (platform live)`]);
  cover.push(['Items distributed',                `${AUDIT_REFERENCE_TOTALS.totalDistributed.toLocaleString()} (auditor) · ${platformDistributed.toLocaleString()} (platform live)`]);
  cover.push(['Items remaining (GIF 2027)',       `${AUDIT_REFERENCE_TOTALS.totalRemaining.toLocaleString()} (auditor) · ${platformRemaining.toLocaleString()} (platform live)`]);
  cover.push(['Marketplace events',               `${AUDIT_REFERENCE_TOTALS.marketplaceCount} in audit scope · ${marketplaces.length} on platform`]);
  cover.push(['Materials with remaining stock',   `${AUDIT_REFERENCE_TOTALS.materialIdsRemaining} (auditor) · ${closingStock.length} (platform)`]);
  cover.push(['', '']);
  cover.push(['DISCREPANCY OUTCOME', '']);
  cover.push(['Materials reconciled (Match / Within tolerance)', countResolved]);
  cover.push(['Materials with documented variance',              countDocumented]);
  cover.push(['Materials flagged as Unexplained',                countUnexplained]);
  cover.push(['', '']);
  cover.push(['METHODOLOGY & DATA SOURCES', '']);
  cover.push(['Platform tables', 'external_items · external_companies · external_material_groups · item_types · marketplace_item_allocations · marketplace_events · warehouse_returns']);
  cover.push(['Stock movement logic', 'RECEIVED → ALLOCATED (MP) → DISTRIBUTED / RETURNED → REALLOCATED (next MP) → … → FINAL DISPOSITION (Fully Distributed | GIF 2027 Stock | Partially Distributed)']);
  cover.push(['Resolver', `${RESOLVER_RULES.length} priority-ordered rules — see "Auto-Resolution Log" sheet for definitions and rule-hit counts.`]);
  cover.push(['', '']);
  cover.push(['KNOWN GAPS', '']);
  cover.push(['Intake date', 'Platform stores upload date (created_at). Column "Warehouse Intake Date (manual)" is provided for paste-in from the Warehouse Intake Log before submission.']);
  cover.push(['Marketplace scope', `${marketplaces.length} MPs on platform vs ${AUDIT_REFERENCE_TOTALS.marketplaceCount} in audit scope. Out-of-scope rows are tagged in the ledger and summary sheets.`]);
  cover.push(['Recycling / Rejected', 'Not tracked on platform; handled via physical partner certificates.']);
  cover.push(['Manual beneficiary count', 'Marketplaces marked with † in the Summary sheet used a partner sign-off form rather than per-card QR scans.']);
  cover.push(['', '']);
  cover.push(['SHEETS', '']);
  cover.push(['2. Material Movement Ledger', 'One block per Material ID — RECEIVED row + one row per marketplace appearance, blank-row separator.']);
  cover.push(['3. Summary by Marketplace',   'Per-marketplace totals with audit scope flag and totals row.']);
  cover.push(['4. GIF 2027 Closing Stock',   'Per-material remaining stock, largest first.']);
  cover.push(['5. Reconciliation Check',     'Headline totals: Auditor Reference vs Platform Live with Δ, Status and Explanation.']);
  cover.push(['6. Discrepancy Report',       'Per-Material-ID diff classified by the resolver. Unexplained rows surface at the top.']);
  cover.push(['7. Auto-Resolution Log',      'Resolver rule definitions and the count of Material IDs each rule affected — full transparency.']);
  cover.push(['', '']);
  cover.push(['SIGN-OFF', '']);
  cover.push(['Prepared by', 'GIF Platform (automated export)']);
  cover.push(['Reviewed by', '']);
  cover.push(['Date',         '']);

  const wsCover = XLSX.utils.aoa_to_sheet(cover);
  wsCover['!cols'] = [{ wch: 44 }, { wch: 110 }];
  wsCover['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
  ];
  wsCover['!rows'] = cover.map((_, i) => ({ hpt: i === 0 ? 38 : i === 1 ? 22 : 18 }));
  // style cover cells
  for (let r = 0; r < cover.length; r++) {
    const a = cover[r][0];
    const b = cover[r][1];
    const ca = wsCover[addr(r, 0)];
    const cb = wsCover[addr(r, 1)];
    if (r === 0) {
      if (ca) ca.s = styleCoverTitle;
      if (cb) cb.s = styleCoverTitle;
    } else if (r === 1) {
      if (ca) ca.s = styleCoverSubtitle;
      if (cb) cb.s = styleCoverSubtitle;
    } else if (a && !b && typeof a === 'string' && a === a.toUpperCase() && a.length > 2) {
      // SECTION header (uppercase label in col A, empty col B)
      if (ca) ca.s = styleSectionHeading;
      if (cb) cb.s = styleSectionHeading;
    } else {
      if (ca) ca.s = { ...styleCell, font: { ...styleCell.font, bold: !!a } };
      if (cb) cb.s = typeof b === 'number' ? styleCellNumber : styleCell;
    }
  }
  // page setup for print
  // @ts-ignore
  wsCover['!pageSetup'] = { orientation: 'landscape', paperSize: 9, fitToWidth: 1, fitToHeight: 0 };
  XLSX.utils.book_append_sheet(wb, wsCover, 'Methodology');

  // ----- 2. Material Movement Ledger -----
  const ws2 = XLSX.utils.json_to_sheet(ledgerRows, { header: ledgerHeaders });
  setCols(ws2, [12, 28, 22, 32, 14, 18, 22, 22, 28, 14, 14, 14, 14, 18, 28, 22, 14, 16]);
  setFreeze(ws2, 1);
  // header
  ledgerHeaders.forEach((_, c) => {
    const cell = ws2[addr(0, c)];
    if (cell) cell.s = styleHeader;
  });
  // body
  ledgerRows.forEach((row, ri) => {
    const flag = ledgerRowFlags[ri];
    ledgerHeaders.forEach((h, c) => {
      const a = addr(ri + 1, c);
      const cell = ws2[a];
      if (!cell) return;
      let s: any = typeof row[h] === 'number' ? styleCellNumber : styleCell;
      if (flag === 'received') {
        s = { ...s, fill: { patternType: 'solid', fgColor: { rgb: C.DH_RED_TINT } }, font: { ...s.font, bold: true } };
      } else if (flag === 'blank') {
        s = { ...s, fill: { patternType: 'solid', fgColor: { rgb: 'F8F8F8' } } };
      }
      if (h === 'Final Disposition' && row[h]) {
        const fill =
          row[h] === 'Fully Distributed' ? C.STATUS_GREEN :
          row[h] === 'Partially Distributed' ? C.STATUS_AMBER :
          row[h] === 'Pending Distribution' ? C.STATUS_BLUE :
          C.DH_GREY_TINT;
        s = { ...s, fill: { patternType: 'solid', fgColor: { rgb: fill } }, font: { ...s.font, bold: true } };
      }
      if (h === 'Audit Scope' && row[h] === 'Out of audit scope') {
        s = { ...s, fill: { patternType: 'solid', fgColor: { rgb: C.DH_GREY_TINT } } };
      }
      cell.s = s;
    });
  });
  XLSX.utils.book_append_sheet(wb, ws2, 'Material Movement Ledger');

  // ----- 3. Summary by Marketplace (with totals row) -----
  const summaryWithTotals = [...summaryByMp, {
    Marketplace: 'TOTAL',
    Sheet: '',
    'Event Date': '',
    'Outreach Partner': '',
    Beneficiaries: '',
    'Items Allocated': sumAllocated,
    'Items Distributed': sumDistributed,
    'Items Returned': sumReturned,
    'Return Count Date': '',
    'Audit Scope': '',
  }];
  const ws3 = XLSX.utils.json_to_sheet(summaryWithTotals);
  setCols(ws3, [50, 8, 14, 26, 16, 16, 18, 16, 18, 18]);
  setFreeze(ws3, 1);
  applyTable(ws3, 0, summaryWithTotals, {
    'Audit Scope': (v) => (v === 'Out of audit scope' ? { fill: { patternType: 'solid', fgColor: { rgb: C.DH_GREY_TINT } } } : null),
  });
  // restyle last (totals) row
  const totalsRowIdx = summaryWithTotals.length; // header at 0, last row index = length
  Object.keys(summaryWithTotals[0]).forEach((h, c) => {
    const cell = ws3[addr(totalsRowIdx, c)];
    if (!cell) return;
    cell.s = typeof summaryWithTotals[totalsRowIdx - 1][h as keyof typeof summaryByMp[0]] === 'number' || c >= 5 && c <= 7
      ? styleTotalsRow
      : styleTotalsLabel;
  });
  XLSX.utils.book_append_sheet(wb, ws3, 'Summary by Marketplace');

  // ----- 4. GIF 2027 Closing Stock -----
  const closingWithTotals = closingStock.length
    ? [...closingStock, { 'Material ID': 'TOTAL', Donor: '', Category: '', 'Item Description': '', 'Remaining Qty': closingTotal, 'Source Marketplace (last event)': '' }]
    : [{ 'Material ID': '', Donor: '', Category: '', 'Item Description': 'No remaining stock', 'Remaining Qty': 0, 'Source Marketplace (last event)': '' }];
  const ws4 = XLSX.utils.json_to_sheet(closingWithTotals);
  setCols(ws4, [12, 28, 22, 40, 14, 50]);
  setFreeze(ws4, 1);
  applyTable(ws4, 0, closingWithTotals);
  if (closingStock.length) {
    const tIdx = closingWithTotals.length;
    Object.keys(closingWithTotals[0]).forEach((h, c) => {
      const cell = ws4[addr(tIdx, c)];
      if (cell) cell.s = h === 'Remaining Qty' ? styleTotalsRow : styleTotalsLabel;
    });
  }
  XLSX.utils.book_append_sheet(wb, ws4, 'GIF 2027 Closing Stock');

  // ----- 5. Reconciliation Check -----
  const ws5 = XLSX.utils.json_to_sheet(recon);
  setCols(ws5, [44, 20, 20, 14, 22, 80]);
  setFreeze(ws5, 1);
  applyTable(ws5, 0, recon, {
    'Δ': (v, row) => {
      if (typeof v !== 'number') return null;
      const ref = Number(row['Auditor Reference']) || 0;
      return styleCellDelta(v, ref);
    },
    Status: (v) => {
      const status: ResolverStatus = v === 'Match' || v === 'Within tolerance' ? 'resolved' :
        v === 'Unexplained' ? 'unexplained' : 'documented';
      return styleStatusCell(status);
    },
  });
  XLSX.utils.book_append_sheet(wb, ws5, 'Reconciliation Check');

  // ----- 6. Discrepancy Report -----
  const ws6 = XLSX.utils.json_to_sheet(discRowsOut);
  setCols(ws6, [12, 32, 26, 14, 14, 12, 14, 14, 12, 14, 14, 12, 22, 60, 14]);
  setFreeze(ws6, 1);
  applyTable(ws6, 0, discRowsOut, {
    'Δ Received':    (v, row) => typeof v === 'number' ? styleCellDelta(v, Number(row['Auditor Received']) || 0) : null,
    'Δ Distributed': (v, row) => typeof v === 'number' ? styleCellDelta(v, Number(row['Auditor Distributed']) || 0) : null,
    'Δ Remaining':   (v, row) => typeof v === 'number' ? styleCellDelta(v, Number(row['Auditor Remaining']) || 0) : null,
    Status: (v) => styleStatusCell(v === 'Resolved' ? 'resolved' : v === 'Documented' ? 'documented' : 'unexplained'),
  });
  XLSX.utils.book_append_sheet(wb, ws6, 'Discrepancy Report');

  // ----- 7. Auto-Resolution Log -----
  const ws7 = XLSX.utils.json_to_sheet(autoLog);
  setCols(ws7, [22, 14, 60, 80, 18, 22]);
  setFreeze(ws7, 1);
  applyTable(ws7, 0, autoLog, {
    Status: (v) => styleStatusCell(v === 'Resolved' ? 'resolved' : v === 'Documented' ? 'documented' : 'unexplained'),
  });
  XLSX.utils.book_append_sheet(wb, ws7, 'Auto-Resolution Log');

  const filename = `gif-item-level-stock-movement-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`;
  XLSX.writeFile(wb, filename);

  return {
    donations: receivedByMatId.size,
    allocations: allocations.length,
    distributions: allocations.filter((a) => (a.distributed_quantity ?? 0) > 0).length,
    remaining: closingStock.length,
    materials: sortedMatIds.length,
    mismatches: mismatchCount,
    resolved: countResolved,
    documented: countDocumented,
    unexplained: countUnexplained,
  };
}
