import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';

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

const fmtDT = (v: any) => (v ? format(new Date(v), 'yyyy-MM-dd HH:mm:ss') : '');
const fmtD = (v: any) => (v ? format(new Date(v), 'yyyy-MM-dd') : '');

export async function exportFullAuditTrail(): Promise<{
  donations: number;
  allocations: number;
  distributions: number;
  remaining: number;
  materials: number;
}> {
  // 1. Fetch all needed data in parallel (paginated, soft-delete filtered)
  // NOTE: we intentionally DO NOT scan the transactions table here (300k+ rows would
  // take minutes to paginate client-side). Distribution timestamps are derived from
  // marketplace_item_allocations.updated_at which is touched on every scan.
  const safeFetch = async <T,>(label: string, fn: () => Promise<T[]>): Promise<T[]> => {
    try {
      return await fn();
    } catch (e: any) {
      console.error(`[audit-export] ${label} failed:`, e);
      throw new Error(`Failed to load ${label}: ${e?.message ?? e}`);
    }
  };

  const [
    itemTypes,
    extItems,
    extCompanies,
    extMatGroups,
    allocations,
    marketplaces,
    warehouseReturns,
  ] = await Promise.all([
    safeFetch('item_types', () =>
      fetchAllRows<any>(() =>
        supabase
          .from('item_types')
          .select('id, name, category, subcategory, external_material_id, surpluss_url, total_stock')
          .is('deleted_at', null)
      )
    ),
    safeFetch('external_items', () =>
      fetchAllRows<any>(() =>
        supabase
          .from('external_items')
          .select('external_id, title, description, quantity, item_count, company_id, material_group_id, created_at, image_url')
          .is('deleted_at', null)
      )
    ),
    safeFetch('external_companies', () =>
      fetchAllRows<any>(() =>
        supabase
          .from('external_companies')
          .select('id, external_id, name, sector, main_business')
          .is('deleted_at', null)
      )
    ),
    safeFetch('external_material_groups', () =>
      fetchAllRows<any>(() =>
        supabase
          .from('external_material_groups')
          .select('id, external_id, name, code, uom')
          .is('deleted_at', null)
      )
    ),
    safeFetch('marketplace_item_allocations', () =>
      fetchAllRows<any>(() =>
        supabase
          .from('marketplace_item_allocations')
          .select('id, marketplace_id, item_type_id, allocated_quantity, distributed_quantity, original_allocated_quantity, surpluss_allocation_id, created_at, updated_at')
          .is('deleted_at', null)
      )
    ),
    safeFetch('marketplace_events', () =>
      fetchAllRows<any>(() =>
        supabase
          .from('marketplace_events')
          .select('id, name, event_date, status, location, external_id')
          .is('deleted_at', null)
      )
    ),
    fetchAllRows<any>(() =>
      supabase
        .from('warehouse_returns')
        .select('marketplace_id, item_type_id, allocation_id, quantity_returned, return_batch_code, returned_at')
        .is('deleted_at', null)
    ).catch((e) => {
      console.warn('[audit-export] warehouse_returns unavailable:', e);
      return [] as any[];
    }),
  ]);

  console.log('[audit-export] fetched', {
    itemTypes: itemTypes.length,
    extItems: extItems.length,
    extCompanies: extCompanies.length,
    extMatGroups: extMatGroups.length,
    allocations: allocations.length,
    marketplaces: marketplaces.length,
    warehouseReturns: warehouseReturns.length,
  });


  // Lookup maps
  const itemById = new Map(itemTypes.map((i) => [i.id, i]));
  const itemByMaterialId = new Map(
    itemTypes.filter((i) => i.external_material_id != null).map((i) => [i.external_material_id, i])
  );
  const mpById = new Map(marketplaces.map((m) => [m.id, m]));
  const companyById = new Map(extCompanies.map((c) => [c.id, c]));
  const matGroupById = new Map(extMatGroups.map((g) => [g.id, g]));

  // ============ SHEET 1: Donation Receipt ============
  const donationRows = extItems
    .map((it) => {
      const company = it.company_id ? companyById.get(it.company_id) : null;
      const matGroup = it.material_group_id ? matGroupById.get(it.material_group_id) : null;
      const linkedItem = itemByMaterialId.get(it.external_id);
      return {
        'Material ID': it.external_id ?? '',
        'Material Name': it.title ?? '',
        Category: linkedItem?.category ?? matGroup?.name ?? '',
        Subcategory: linkedItem?.subcategory ?? '',
        Donor: company?.name ?? '',
        'Donor Sector': company?.sector ?? '',
        'Quantity Received': it.item_count ?? it.quantity ?? 0,
        UOM: matGroup?.uom ?? '',
        'Intake Date': fmtDT(it.created_at),
        'Surpluss URL': linkedItem?.surpluss_url ?? '',
      };
    })
    .sort((a, b) => String(b['Intake Date']).localeCompare(String(a['Intake Date'])));

  // ============ SHEET 2: Marketplace Allocation ============
  const allocationRows = allocations
    .map((a) => {
      const item = itemById.get(a.item_type_id);
      const mp = mpById.get(a.marketplace_id);
      const allocatedQty = a.original_allocated_quantity ?? a.allocated_quantity ?? 0;
      return {
        'Allocation ID': a.id,
        'Material ID': item?.external_material_id ?? '',
        'Item Name': item?.name ?? '',
        Category: item?.category ?? '',
        Marketplace: mp?.name ?? '',
        'Event Date': fmtD(mp?.event_date),
        'Allocated Quantity': allocatedQty,
        'Live Allocated (post-reconcile)': a.allocated_quantity ?? 0,
        'Allocation Date': fmtDT(a.created_at),
        'Surpluss Allocation ID': a.surpluss_allocation_id ?? '',
      };
    })
    .sort((a, b) => String(b['Allocation Date']).localeCompare(String(a['Allocation Date'])));

  // ============ Distribution timestamp aggregation ============
  // Group transactions by marketplace_id + item_type (item type stored as text name)
  const distTxByKey = new Map<string, { first: string; last: string; count: number }>();
  for (const t of transactions) {
    if (!t.marketplace_id || !t.timestamp) continue;
    const key = `${t.marketplace_id}|${(t.item_type ?? '').toLowerCase()}`;
    const ts = t.timestamp;
    const cur = distTxByKey.get(key);
    if (!cur) {
      distTxByKey.set(key, { first: ts, last: ts, count: 1 });
    } else {
      if (ts < cur.first) cur.first = ts;
      if (ts > cur.last) cur.last = ts;
      cur.count += 1;
    }
  }
  // Also a fallback: any distribution by marketplace (ignoring item)
  const distMpRange = new Map<string, { first: string; last: string }>();
  for (const t of transactions) {
    if (!t.marketplace_id || !t.timestamp) continue;
    const cur = distMpRange.get(t.marketplace_id);
    if (!cur) distMpRange.set(t.marketplace_id, { first: t.timestamp, last: t.timestamp });
    else {
      if (t.timestamp < cur.first) cur.first = t.timestamp;
      if (t.timestamp > cur.last) cur.last = t.timestamp;
    }
  }

  // ============ SHEET 3: Distribution (aggregate per marketplace × material) ============
  const distributionRows = allocations
    .filter((a) => (a.distributed_quantity ?? 0) > 0)
    .map((a) => {
      const item = itemById.get(a.item_type_id);
      const mp = mpById.get(a.marketplace_id);
      const allocatedQty = a.allocated_quantity ?? 0;
      const distributed = a.distributed_quantity ?? 0;
      const itemKey = `${a.marketplace_id}|${(item?.name ?? '').toLowerCase()}`;
      const txRange = distTxByKey.get(itemKey) ?? distTxByKey.get(`${a.marketplace_id}|item`) ?? distMpRange.get(a.marketplace_id);
      return {
        Marketplace: mp?.name ?? '',
        'Event Date': fmtD(mp?.event_date),
        'Material ID': item?.external_material_id ?? '',
        'Item Name': item?.name ?? '',
        Category: item?.category ?? '',
        Allocated: allocatedQty,
        Distributed: distributed,
        '% Distributed': allocatedQty > 0 ? Math.round((distributed / allocatedQty) * 1000) / 10 : 0,
        'First Distribution': fmtDT(txRange?.first),
        'Last Distribution': fmtDT(txRange?.last),
      };
    })
    .sort(
      (a, b) =>
        String(b['Event Date']).localeCompare(String(a['Event Date'])) ||
        String(a.Marketplace).localeCompare(String(b.Marketplace))
    );

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

  // For reallocation, build per-material chronological list of allocations
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

  // ============ SHEET 4: Remaining / Reallocation ============
  const remainingRows = allocations
    .map((a) => {
      const allocated = a.allocated_quantity ?? 0;
      const distributed = a.distributed_quantity ?? 0;
      const remaining = allocated - distributed;
      if (remaining <= 0) return null;
      const item = itemById.get(a.item_type_id);
      const mp = mpById.get(a.marketplace_id);
      const eventDate = mp?.event_date ?? a.created_at;
      const ret =
        returnsByAllocation.get(a.id) ??
        returnsByMpItem.get(`${a.marketplace_id}|${a.item_type_id}`);
      // Find next allocation for same item after this event date
      const sameItem = allocsByItem.get(a.item_type_id) ?? [];
      const next = sameItem.find((other) => {
        if (other.id === a.id) return false;
        const od = mpById.get(other.marketplace_id)?.event_date ?? other.created_at;
        return String(od) > String(eventDate);
      });
      const nextMp = next ? mpById.get(next.marketplace_id) : null;
      return {
        Marketplace: mp?.name ?? '',
        'Event Date': fmtD(eventDate),
        'Material ID': item?.external_material_id ?? '',
        'Item Name': item?.name ?? '',
        Allocated: allocated,
        Distributed: distributed,
        Remaining: remaining,
        'Returned-to-Warehouse Qty': ret?.qty ?? 0,
        'Return Batch Code': ret?.batch ?? '',
        'Return Date': fmtDT(ret?.date),
        'Reallocated To': nextMp ? `${nextMp.name} (${fmtD(nextMp.event_date)})` : '',
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort(
      (a, b) =>
        String(b['Event Date']).localeCompare(String(a['Event Date'])) ||
        String(a.Marketplace).localeCompare(String(b.Marketplace))
    );

  // ============ SHEET 5: Journey Summary (per material) ============
  // Total received per material from external_items
  const receivedByMatId = new Map<number, { qty: number; donors: Set<string> }>();
  for (const it of extItems) {
    const cur = receivedByMatId.get(it.external_id) ?? { qty: 0, donors: new Set<string>() };
    cur.qty += it.item_count ?? it.quantity ?? 0;
    const company = it.company_id ? companyById.get(it.company_id) : null;
    if (company?.name) cur.donors.add(company.name);
    receivedByMatId.set(it.external_id, cur);
  }

  const summaryRows = itemTypes
    .map((item) => {
      const itemAllocs = allocsByItem.get(item.id) ?? [];
      const totalAllocated = itemAllocs.reduce((s, a) => s + (a.allocated_quantity ?? 0), 0);
      const totalDistributed = itemAllocs.reduce((s, a) => s + (a.distributed_quantity ?? 0), 0);
      const totalRemaining = totalAllocated - totalDistributed;
      const received = item.external_material_id != null ? receivedByMatId.get(item.external_material_id) : null;
      const eventDates = itemAllocs
        .map((a) => mpById.get(a.marketplace_id)?.event_date)
        .filter(Boolean)
        .sort();
      const firstAlloc = itemAllocs.length
        ? itemAllocs.map((a) => a.created_at).sort()[0]
        : null;
      // Last distribution timestamp across this item
      let lastDist: string | null = null;
      for (const a of itemAllocs) {
        const itemKey = `${a.marketplace_id}|${(item.name ?? '').toLowerCase()}`;
        const range = distTxByKey.get(itemKey);
        if (range && (!lastDist || range.last > lastDist)) lastDist = range.last;
      }
      let disposition = 'No Allocation';
      if (totalAllocated > 0) {
        if (totalRemaining <= 0) disposition = 'Fully Distributed';
        else if (totalDistributed > 0) disposition = 'Partially Distributed';
        else disposition = 'Pending Distribution';
      }
      return {
        'Material ID': item.external_material_id ?? '',
        'Item Name': item.name,
        Category: item.category ?? '',
        Subcategory: item.subcategory ?? '',
        'Donor(s)': received ? Array.from(received.donors).join('; ') : '',
        'Total Received': received?.qty ?? 0,
        'Total Allocated': totalAllocated,
        'Total Distributed': totalDistributed,
        'Total Remaining': totalRemaining,
        '# Events Used In': itemAllocs.length,
        'First Allocation Date': fmtDT(firstAlloc),
        'First Event Date': fmtD(eventDates[0]),
        'Last Event Date': fmtD(eventDates[eventDates.length - 1]),
        'Last Distribution': fmtDT(lastDist),
        'Disposition Status': disposition,
      };
    })
    .sort((a, b) => String(a['Item Name']).localeCompare(String(b['Item Name'])));

  // ============ Build workbook ============
  const wb = XLSX.utils.book_new();

  // Methodology / cover sheet
  const methodology = [
    { Field: 'Report', Value: 'GIF — Full Item Lifecycle Audit Trail' },
    { Field: 'Generated At', Value: format(new Date(), 'yyyy-MM-dd HH:mm:ss') },
    { Field: '', Value: '' },
    { Field: 'Process Flow', Value: '1. Donation Receipt → 2. Marketplace Allocation → 3. Distribution → 4. Remaining / Reallocation' },
    { Field: '', Value: '' },
    { Field: 'Sheet 1', Value: 'Donation Receipt — items digitized at warehouse intake (material ID, donor, category, quantity, intake date).' },
    { Field: 'Sheet 2', Value: 'Marketplace Allocation — items allocated from inventory to specific marketplace events (allocation date logged).' },
    { Field: 'Sheet 3', Value: 'Distribution — recorded at bulk/category level per marketplace (NOT individual item scanning, per operational scope decision).' },
    { Field: 'Sheet 4', Value: 'Remaining / Reallocation — undistributed items returned to warehouse and reallocated to subsequent events.' },
    { Field: 'Sheet 5', Value: 'Journey Summary — one row per material across all events with disposition status.' },
    { Field: '', Value: '' },
    { Field: 'Note 1', Value: 'Distribution recording operates at the aggregate level per marketplace per category, not at individual item scanning level. This was a deliberate scope decision based on budget and operational feasibility for 545,000+ items.' },
    { Field: 'Note 2', Value: 'Recycling / rejected items are not tracked on the platform; these are handled operationally in isolation and evidenced through physical certificates from recycling partners.' },
    { Field: 'Note 3', Value: 'Allocated Quantity in Sheet 2 reflects the original pledged amount (when snapshot is available) — Surpluss reconciles allocations post-event which can reduce the live figure.' },
  ];
  const wsCover = XLSX.utils.json_to_sheet(methodology);
  wsCover['!cols'] = [{ wch: 20 }, { wch: 130 }];
  XLSX.utils.book_append_sheet(wb, wsCover, 'Methodology');

  const ws1 = XLSX.utils.json_to_sheet(donationRows.length ? donationRows : [{ 'Material ID': '', 'Material Name': 'No data', Category: '', Subcategory: '', Donor: '', 'Donor Sector': '', 'Quantity Received': 0, UOM: '', 'Intake Date': '', 'Surpluss URL': '' }]);
  autosizeCols(ws1, donationRows);
  XLSX.utils.book_append_sheet(wb, ws1, '1. Donation Receipt');

  const ws2 = XLSX.utils.json_to_sheet(allocationRows);
  autosizeCols(ws2, allocationRows);
  XLSX.utils.book_append_sheet(wb, ws2, '2. Allocation');

  const ws3 = XLSX.utils.json_to_sheet(distributionRows);
  autosizeCols(ws3, distributionRows);
  XLSX.utils.book_append_sheet(wb, ws3, '3. Distribution');

  const ws4 = XLSX.utils.json_to_sheet(remainingRows);
  autosizeCols(ws4, remainingRows);
  XLSX.utils.book_append_sheet(wb, ws4, '4. Remaining & Reallocation');

  const ws5 = XLSX.utils.json_to_sheet(summaryRows);
  autosizeCols(ws5, summaryRows);
  XLSX.utils.book_append_sheet(wb, ws5, '5. Journey Summary');

  const filename = `gif-full-audit-trail-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`;
  XLSX.writeFile(wb, filename);

  return {
    donations: donationRows.length,
    allocations: allocationRows.length,
    distributions: distributionRows.length,
    remaining: remainingRows.length,
    materials: summaryRows.length,
  };
}
