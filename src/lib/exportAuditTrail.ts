import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { AUDIT_REFERENCE_LEDGER, AUDIT_REFERENCE_TOTALS } from '@/lib/auditReferenceLedger';

const autosizeCols = (ws: XLSX.WorkSheet, rows: any[]) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  ws['!cols'] = headers.map((h) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map((r) => String((r as any)[h] ?? '').length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 60) };
  });
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
};

const fmtD = (v: any) => (v ? format(new Date(v), 'yyyy-MM-dd') : '');

export async function exportFullAuditTrail(): Promise<{
  donations: number;
  allocations: number;
  distributions: number;
  remaining: number;
  materials: number;
  mismatches: number;
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

  console.log('[audit-export] fetched', {
    itemTypes: itemTypes.length,
    extItems: extItems.length,
    allocations: allocations.length,
    marketplaces: marketplaces.length,
    warehouseReturns: warehouseReturns.length,
  });

  // ----- Lookup maps -----
  const itemById = new Map<string, any>(itemTypes.map((i) => [i.id, i]));
  const itemByMaterialId = new Map<number, any>(
    itemTypes.filter((i) => i.external_material_id != null).map((i) => [i.external_material_id, i])
  );
  const mpById = new Map<string, any>(marketplaces.map((m) => [m.id, m]));
  const companyById = new Map<string, any>(extCompanies.map((c) => [c.id, c]));
  const matGroupById = new Map<string, any>(extMatGroups.map((g) => [g.id, g]));

  // Determine audit scope: any MP whose name appears (loose match) in the reference allocations
  // For now, we surface ALL MPs and tag scope based on whether the platform event has any
  // allocation tied to a Material ID that's in the auditor's reference set.
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

  // Chronological allocations grouped by item_type_id (for "Reallocated To" linkage)
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

  // Group received-items by material id (sum quantities across intake batches; earliest date wins)
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

  // =========================================================================
  // SHEET 2: Material Movement Ledger  (one block per material, blank-row sep)
  // =========================================================================
  type LedgerRow = {
    'Material ID': number | string;
    Donor: string;
    Category: string;
    'Item Description': string;
    'Qty Received': number | string;
    'Warehouse Intake Date (system)': string;
    'Warehouse Intake Date (manual)': string;
    'Movement Type': string;
    Marketplace: string;
    'Event Date': string;
    'Qty Allocated': number | string;
    'Qty Distributed': number | string;
    'Qty Returned': number | string;
    'Return Count Date': string;
    'Reallocated To': string;
    'Final Disposition': string;
    'GIF 2027 Qty': number | string;
    'Audit Scope': string;
  };
  const emptyLedgerRow = (): LedgerRow => ({
    'Material ID': '',
    Donor: '',
    Category: '',
    'Item Description': '',
    'Qty Received': '',
    'Warehouse Intake Date (system)': '',
    'Warehouse Intake Date (manual)': '',
    'Movement Type': '',
    Marketplace: '',
    'Event Date': '',
    'Qty Allocated': '',
    'Qty Distributed': '',
    'Qty Returned': '',
    'Return Count Date': '',
    'Reallocated To': '',
    'Final Disposition': '',
    'GIF 2027 Qty': '',
    'Audit Scope': '',
  });

  const ledgerRows: LedgerRow[] = [];

  // Iterate by Material ID = external_material_id present on item_types
  const materialIdsAll = new Set<number>();
  for (const it of itemTypes) if (it.external_material_id != null) materialIdsAll.add(it.external_material_id);
  for (const id of receivedByMatId.keys()) materialIdsAll.add(id);
  const sortedMatIds = Array.from(materialIdsAll).sort((a, b) => a - b);

  let mismatchCount = 0;

  for (const matId of sortedMatIds) {
    const item = itemByMaterialId.get(matId);
    const rec = receivedByMatId.get(matId);
    const donor = rec ? Array.from(rec.donors).join('; ') : '';
    const category = item?.category ?? rec?.matGroup ?? '';
    const itemDesc = item?.name ?? (rec ? Array.from(rec.titles).join(' / ') : '');
    const qtyReceived = rec?.qty ?? 0;
    const intakeSystem = rec?.firstDate ? fmtD(rec.firstDate) : '';

    // RECEIVED row
    const headRow = emptyLedgerRow();
    headRow['Material ID'] = matId;
    headRow.Donor = donor;
    headRow.Category = category;
    headRow['Item Description'] = itemDesc;
    headRow['Qty Received'] = qtyReceived;
    headRow['Warehouse Intake Date (system)'] = intakeSystem;
    headRow['Movement Type'] = 'RECEIVED';
    headRow.Marketplace = 'Warehouse Intake';
    headRow['Event Date'] = intakeSystem;
    ledgerRows.push(headRow);

    // ALLOCATED → DISTRIBUTED rows
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
      const row = emptyLedgerRow();
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
      totalDistributed += distributed;
      totalRemaining += Math.max(allocated - distributed, 0);
    }

    // Final disposition row appended to the LAST allocation row (or RECEIVED if no allocations)
    let disposition = 'No Allocation';
    if (itemAllocs.length > 0) {
      if (totalRemaining <= 0) disposition = 'Fully Distributed';
      else if (totalDistributed > 0) disposition = 'Partially Distributed';
      else disposition = 'Pending Distribution';
    }
    const lastRow = ledgerRows[ledgerRows.length - 1];
    lastRow['Final Disposition'] = disposition;
    if (totalRemaining > 0) lastRow['GIF 2027 Qty'] = totalRemaining;

    // Reference cross-check inline (Status surfaced in Discrepancy sheet too)
    const ref = AUDIT_REFERENCE_LEDGER.find((r) => r.materialId === matId);
    if (ref) {
      const dist = totalDistributed;
      const rem = totalRemaining;
      if (qtyReceived !== ref.received || dist !== ref.distributed || rem !== ref.remaining) {
        mismatchCount++;
      }
    }

    // blank separator row
    ledgerRows.push(emptyLedgerRow());
  }

  // =========================================================================
  // SHEET 3: Summary by Marketplace
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
      return {
        Marketplace: mp.name,
        Sheet: `MP${idx + 1}`,
        'Event Date': fmtD(mp.event_date),
        'Outreach Partner': mp.outreach_partner ?? '',
        Beneficiaries: mp.manual_beneficiary_count ?? mp.demographics_reach ?? 0,
        'Items Allocated': allocated,
        'Items Distributed': distributed,
        'Items Returned': returned,
        'Return Count Date': lastReturn ? fmtD(lastReturn) : '',
        'Audit Scope': mpInScope.has(mp.id) ? 'In scope' : 'Out of audit scope',
      };
    })
    .sort((a, b) => String(a['Event Date']).localeCompare(String(b['Event Date'])));

  // =========================================================================
  // SHEET 4: GIF 2027 Closing Stock
  // =========================================================================
  const closingStock: any[] = [];
  for (const matId of sortedMatIds) {
    const item = itemByMaterialId.get(matId);
    if (!item) continue;
    const itemAllocs = allocsByItem.get(item.id) ?? [];
    const totalAllocated = itemAllocs.reduce(
      (s, a) => s + (a.original_allocated_quantity ?? a.allocated_quantity ?? 0),
      0
    );
    const totalDistributed = itemAllocs.reduce((s, a) => s + (a.distributed_quantity ?? 0), 0);
    const remaining = Math.max(totalAllocated - totalDistributed, 0);
    if (remaining <= 0) continue;
    const rec = receivedByMatId.get(matId);
    const lastMp = itemAllocs.length ? mpById.get(itemAllocs[itemAllocs.length - 1].marketplace_id) : null;
    closingStock.push({
      'Material ID': matId,
      Donor: rec ? Array.from(rec.donors).join('; ') : '',
      Category: item.category ?? '',
      'Item Description': item.name,
      'Remaining Qty': remaining,
      'Source Marketplace (last event)': lastMp ? `${lastMp.name} (${fmtD(lastMp.event_date)})` : '',
    });
  }
  closingStock.sort((a, b) => Number(a['Material ID']) - Number(b['Material ID']));

  // =========================================================================
  // SHEET 5: Reconciliation Check
  // =========================================================================
  const platformReceived = Array.from(receivedByMatId.values()).reduce((s, v) => s + v.qty, 0);
  const platformAllocated = allocations.reduce(
    (s, a) => s + (a.original_allocated_quantity ?? a.allocated_quantity ?? 0),
    0
  );
  const platformDistributed = allocations.reduce((s, a) => s + (a.distributed_quantity ?? 0), 0);
  const platformRemaining = allocations.reduce(
    (s, a) =>
      s +
      Math.max((a.original_allocated_quantity ?? a.allocated_quantity ?? 0) - (a.distributed_quantity ?? 0), 0),
    0
  );
  const platformMaterialsWithRemaining = closingStock.length;

  const recon = [
    { Metric: 'Total Items Received into Programme', 'Auditor Reference': AUDIT_REFERENCE_TOTALS.programmeReceived, 'Platform Live': platformReceived, 'Δ': platformReceived - AUDIT_REFERENCE_TOTALS.programmeReceived },
    { Metric: 'Platform Total (incl. Al Jaber in-kind)', 'Auditor Reference': AUDIT_REFERENCE_TOTALS.platformIncludingInKind, 'Platform Live': platformReceived, 'Δ': platformReceived - AUDIT_REFERENCE_TOTALS.platformIncludingInKind },
    { Metric: 'Total Items Distributed', 'Auditor Reference': AUDIT_REFERENCE_TOTALS.totalDistributed, 'Platform Live': platformDistributed, 'Δ': platformDistributed - AUDIT_REFERENCE_TOTALS.totalDistributed },
    { Metric: 'Total Items Remaining (GIF 2027)', 'Auditor Reference': AUDIT_REFERENCE_TOTALS.totalRemaining, 'Platform Live': platformRemaining, 'Δ': platformRemaining - AUDIT_REFERENCE_TOTALS.totalRemaining },
    { Metric: 'Total Allocated across all MPs (incl. reallocations)', 'Auditor Reference': AUDIT_REFERENCE_TOTALS.totalAllocatedAcrossMPs, 'Platform Live': platformAllocated, 'Δ': platformAllocated - AUDIT_REFERENCE_TOTALS.totalAllocatedAcrossMPs },
    { Metric: 'Total Returned across all MPs', 'Auditor Reference': AUDIT_REFERENCE_TOTALS.totalReturned, 'Platform Live': Math.max(platformAllocated - platformDistributed, 0), 'Δ': Math.max(platformAllocated - platformDistributed, 0) - AUDIT_REFERENCE_TOTALS.totalReturned },
    { Metric: 'Marketplace Rejections', 'Auditor Reference': AUDIT_REFERENCE_TOTALS.marketplaceRejections, 'Platform Live': 'Not tracked', 'Δ': '—' },
    { Metric: 'Marketplace Count', 'Auditor Reference': AUDIT_REFERENCE_TOTALS.marketplaceCount, 'Platform Live': marketplaces.length, 'Δ': marketplaces.length - AUDIT_REFERENCE_TOTALS.marketplaceCount },
    { Metric: '# Materials with Remaining Stock', 'Auditor Reference': AUDIT_REFERENCE_TOTALS.materialIdsRemaining, 'Platform Live': platformMaterialsWithRemaining, 'Δ': platformMaterialsWithRemaining - AUDIT_REFERENCE_TOTALS.materialIdsRemaining },
  ];

  // =========================================================================
  // SHEET 6: Discrepancy Report (per Material ID)
  // =========================================================================
  const refByMatId = new Map(AUDIT_REFERENCE_LEDGER.map((r) => [r.materialId, r]));
  const allMatIds = new Set<number>([...refByMatId.keys(), ...sortedMatIds]);

  const discRows = Array.from(allMatIds).map((matId) => {
    const ref = refByMatId.get(matId);
    const item = itemByMaterialId.get(matId);
    const rec = receivedByMatId.get(matId);
    const itemAllocs = item ? allocsByItem.get(item.id) ?? [] : [];
    const platRx = rec?.qty ?? 0;
    const platD = itemAllocs.reduce((s, a) => s + (a.distributed_quantity ?? 0), 0);
    const platRem = itemAllocs.reduce(
      (s, a) => s + Math.max((a.original_allocated_quantity ?? a.allocated_quantity ?? 0) - (a.distributed_quantity ?? 0), 0),
      0
    );
    let status = 'MATCH';
    if (!ref && (rec || itemAllocs.length)) status = 'EXTRA ON PLATFORM';
    else if (ref && !rec && !itemAllocs.length) status = 'MISSING ON PLATFORM';
    else if (ref && (ref.received !== platRx || ref.distributed !== platD || ref.remaining !== platRem)) status = 'MISMATCH';
    return {
      'Material ID': matId,
      Item: ref?.item ?? item?.name ?? '',
      Donor: ref?.donor ?? (rec ? Array.from(rec.donors).join('; ') : ''),
      'Auditor Received': ref?.received ?? '',
      'Platform Received': platRx,
      'Δ Received': ref ? platRx - ref.received : '',
      'Auditor Distributed': ref?.distributed ?? '',
      'Platform Distributed': platD,
      'Δ Distributed': ref ? platD - ref.distributed : '',
      'Auditor Remaining': ref?.remaining ?? '',
      'Platform Remaining': platRem,
      'Δ Remaining': ref ? platRem - ref.remaining : '',
      Status: status,
    };
  });
  // mismatches first
  const statusRank = (s: string) =>
    s === 'MISMATCH' ? 0 : s === 'MISSING ON PLATFORM' ? 1 : s === 'EXTRA ON PLATFORM' ? 2 : 3;
  discRows.sort(
    (a, b) => statusRank(a.Status) - statusRank(b.Status) || Number(a['Material ID']) - Number(b['Material ID'])
  );

  // =========================================================================
  // SHEET 1: Methodology
  // =========================================================================
  const methodology = [
    { Field: 'Report', Value: 'GIF 2026 — Item-Level Stock Movement Tracking (Platform Export)' },
    { Field: 'Generated At', Value: format(new Date(), 'yyyy-MM-dd HH:mm:ss') },
    { Field: '', Value: '' },
    { Field: 'PURPOSE', Value: 'Item-level audit trail of donation receipt → marketplace allocation → distribution → returned / reallocated → final disposition, generated live from platform data and cross-checked against the auditor reference workbook.' },
    { Field: '', Value: '' },
    { Field: 'DATA SOURCES (platform tables)', Value: 'external_items, external_companies, external_material_groups, item_types, marketplace_item_allocations, marketplace_events, warehouse_returns' },
    { Field: '', Value: '' },
    { Field: 'RECONCILIATION SUMMARY (auditor reference)', Value: '' },
    { Field: 'Items Received into Programme', Value: AUDIT_REFERENCE_TOTALS.programmeReceived },
    { Field: 'Items Distributed', Value: `${AUDIT_REFERENCE_TOTALS.totalDistributed} across ${AUDIT_REFERENCE_TOTALS.marketplaceCount} marketplace events` },
    { Field: 'Items Remaining (GIF 2027)', Value: `${AUDIT_REFERENCE_TOTALS.totalRemaining} (${AUDIT_REFERENCE_TOTALS.materialIdsRemaining} Material IDs)` },
    { Field: 'Marketplace Rejections', Value: `${AUDIT_REFERENCE_TOTALS.marketplaceRejections} (not tracked on platform — physical certificates only)` },
    { Field: '', Value: '' },
    { Field: 'PLATFORM LIVE TOTALS', Value: '' },
    { Field: 'Items Received (platform)', Value: platformReceived },
    { Field: 'Items Allocated (sum of live allocations)', Value: platformAllocated },
    { Field: 'Items Distributed', Value: platformDistributed },
    { Field: 'Items Remaining', Value: platformRemaining },
    { Field: 'Marketplace events on platform', Value: marketplaces.length },
    { Field: '', Value: '' },
    { Field: 'STOCK MOVEMENT LOGIC', Value: 'RECEIVED → ALLOCATED (MP) → DISTRIBUTED / RETURNED → REALLOCATED (next MP) → … → FINAL DISPOSITION (Fully Distributed | GIF 2027 Stock | Partially Distributed)' },
    { Field: '', Value: '' },
    { Field: 'KNOWN GAPS', Value: '' },
    { Field: 'Intake date', Value: 'Platform stores upload date (created_at) only. Column "Warehouse Intake Date (manual)" is left blank for paste-in from the Warehouse Intake Log before submission.' },
    { Field: 'Marketplace scope', Value: `${marketplaces.length} MPs on platform vs ${AUDIT_REFERENCE_TOTALS.marketplaceCount} in audit scope. Out-of-scope events are tagged "Out of audit scope" in the ledger and summary sheets.` },
    { Field: 'Recycling / Rejected', Value: 'Not tracked on platform; handled via physical partner certificates.' },
    { Field: '', Value: '' },
    { Field: 'SHEETS', Value: '' },
    { Field: '2. Material Movement Ledger', Value: 'One block per Material ID — RECEIVED row + one row per marketplace appearance, blank-row separator.' },
    { Field: '3. Summary by Marketplace', Value: 'Per-marketplace totals with audit scope flag.' },
    { Field: '4. GIF 2027 Closing Stock', Value: 'Per-material remaining stock.' },
    { Field: '5. Reconciliation Check', Value: 'Headline totals: Auditor Reference vs Platform Live, with Δ.' },
    { Field: '6. Discrepancy Report', Value: 'Per-Material-ID diff against the auditor reference file; mismatches sorted to the top.' },
  ];

  // =========================================================================
  // Build workbook
  // =========================================================================
  const wb = XLSX.utils.book_new();

  const wsCover = XLSX.utils.json_to_sheet(methodology);
  wsCover['!cols'] = [{ wch: 42 }, { wch: 120 }];
  XLSX.utils.book_append_sheet(wb, wsCover, 'Methodology');

  const ws2 = XLSX.utils.json_to_sheet(ledgerRows);
  autosizeCols(ws2, ledgerRows);
  XLSX.utils.book_append_sheet(wb, ws2, 'Material Movement Ledger');

  const ws3 = XLSX.utils.json_to_sheet(summaryByMp);
  autosizeCols(ws3, summaryByMp);
  XLSX.utils.book_append_sheet(wb, ws3, 'Summary by Marketplace');

  const ws4 = XLSX.utils.json_to_sheet(
    closingStock.length
      ? closingStock
      : [{ 'Material ID': '', Donor: '', Category: '', 'Item Description': 'No remaining stock', 'Remaining Qty': 0, 'Source Marketplace (last event)': '' }]
  );
  autosizeCols(ws4, closingStock);
  XLSX.utils.book_append_sheet(wb, ws4, 'GIF 2027 Closing Stock');

  const ws5 = XLSX.utils.json_to_sheet(recon);
  autosizeCols(ws5, recon);
  XLSX.utils.book_append_sheet(wb, ws5, 'Reconciliation Check');

  const ws6 = XLSX.utils.json_to_sheet(discRows);
  autosizeCols(ws6, discRows);
  XLSX.utils.book_append_sheet(wb, ws6, 'Discrepancy Report');

  const filename = `gif-item-level-stock-movement-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`;
  XLSX.writeFile(wb, filename);

  return {
    donations: receivedByMatId.size,
    allocations: allocations.length,
    distributions: allocations.filter((a) => (a.distributed_quantity ?? 0) > 0).length,
    remaining: closingStock.length,
    materials: sortedMatIds.length,
    mismatches: mismatchCount,
  };
}
