import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import type { TraceabilityLog, TraceabilityFilters } from '@/hooks/useTraceabilityLogs';

export async function exportTraceabilityLogsToExcel(filters?: TraceabilityFilters) {
  const rows = await fetchAllRows<TraceabilityLog>(() => {
    let q = (supabase.from('allocation_traceability_logs' as any).select('*') as any);
    if (filters?.marketplaceId) q = q.eq('marketplace_id', filters.marketplaceId);
    if (filters?.actionType) q = q.eq('action_type', filters.actionType);
    if (filters?.cardUniqueId) q = q.ilike('card_unique_id', `%${filters.cardUniqueId}%`);
    if (filters?.dateFrom) q = q.gte('created_at', filters.dateFrom);
    if (filters?.dateTo) q = q.lte('created_at', filters.dateTo);
    return q.order('created_at', { ascending: false });
  });

  const data = rows.map((log) => ({
    Timestamp: log.created_at ? format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
    Action: log.action_type ?? '',
    Marketplace: log.marketplace_name ?? '',
    'QR Card': log.card_unique_id ?? '',
    'Quantity Before': log.quantity_before ?? 0,
    'Quantity After': log.quantity_after ?? 0,
    'Quantity Change': (log.quantity_after ?? 0) - (log.quantity_before ?? 0),
    'Performed By': log.performed_by_email ?? '',
    Description: log.description ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);

  const headers = Object.keys(data[0] ?? {
    Timestamp: '', Action: '', Marketplace: '', 'QR Card': '',
    'Quantity Before': '', 'Quantity After': '', 'Quantity Change': '',
    'Performed By': '', Description: '',
  });
  ws['!cols'] = headers.map((h) => {
    const maxLen = Math.max(
      h.length,
      ...data.map((r) => String((r as any)[h] ?? '').length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 60) };
  });
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Traceability Logs');

  const filename = `traceability-logs-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`;
  XLSX.writeFile(wb, filename);

  return rows.length;
}
