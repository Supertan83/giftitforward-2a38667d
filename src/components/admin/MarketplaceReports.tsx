import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { VolunteerBulkHoursEditDialog, type BulkVolunteerEditTarget } from './VolunteerBulkHoursEditDialog';
import { motion } from 'framer-motion';
import { ArrowLeft, BarChart3, Users, Package, MapPin, Calendar, Clock, TrendingUp, ChevronDown, ChevronUp, Loader2, PieChart as PieChartIcon, Building2, Tags, Send, Pencil, Trash2, GraduationCap, QrCode, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { exportFullAuditTrail } from '@/lib/exportAuditTrail';
import { format as formatDate } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMarketplaces } from '@/hooks/useSupabaseData';
import { useMarketplaceReport, useAllMarketplaceReports, eventSlugMatchesMarketplace } from '@/hooks/useMarketplaceAllocations';
import { MarketplaceDemographicsEditor } from './MarketplaceDemographicsEditor';
import { MarketplaceManualDataEditor } from './MarketplaceManualDataEditor';
import { OriginalAllocationAuditPanel } from './OriginalAllocationAuditPanel';
import { useSurplussVolunteerBeneficiarySync } from '@/hooks/useSurplussVolunteerBeneficiarySync';
import { VolunteerHoursEditDialog } from './VolunteerHoursEditDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
interface MarketplaceReportsProps {
  onBack: () => void;
}
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
export const MarketplaceReports = ({
  onBack
}: MarketplaceReportsProps) => {
  const [selectedMarketplaceId, setSelectedMarketplaceId] = useState<string>('');
  const [surplussEnv, setSurplussEnv] = useState<'staging' | 'production'>('production');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    beneficiaries: true,
    items: true,
    volunteers: true
  });
  const { isSyncing, currentStepLabel, syncToSurpluss } = useSurplussVolunteerBeneficiarySync();
  const [confirmSyncOpen, setConfirmSyncOpen] = useState(false);
  const [editingVolunteer, setEditingVolunteer] = useState<{
    cardId: string; name: string; checkedInAt: string | null; checkedOutAt: string | null; hoursWorked: number; marketplaceId?: string;
  } | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [qrVolunteer, setQrVolunteer] = useState<any | null>(null);
  const [deletingVolunteer, setDeletingVolunteer] = useState<{
    cardId?: string;
    volunteerId?: string;
    dependentName?: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const getRowKey = (vol: any) =>
    vol?.cardId ? `card-${vol.cardId}` : `vol-${vol?.volunteerId || ''}-${(vol?.dependentName || '').toLowerCase()}`;

  // Perform a single delete operation for one row.
  // Always records a marketplace exclusion using the underlying volunteer_id so
  // the row cannot reappear after refresh via any sync path. Soft-deletes the
  // card + attendance only when the card actually belongs to the currently
  // selected marketplace (avoids wiping a card from another event).
  const performDelete = async (
    target: { cardId?: string; volunteerId?: string; dependentName?: string }
  ) => {
    const now = new Date().toISOString();
    const mpId = selectedMarketplaceId;
    if (!mpId) throw new Error('No marketplace selected');

    let resolvedVolunteerId = target.volunteerId;

    if (target.cardId) {
      const { data: cardRow, error: cardFetchErr } = await supabase
        .from('volunteer_qr_cards')
        .select('id, volunteer_id, marketplace_id')
        .eq('id', target.cardId)
        .maybeSingle();
      if (cardFetchErr) throw cardFetchErr;

      resolvedVolunteerId = (cardRow as any)?.volunteer_id || resolvedVolunteerId;

      // Only soft-delete the card if it belongs to THIS marketplace.
      if ((cardRow as any)?.marketplace_id === mpId) {
        const { error: cardErr } = await supabase
          .from('volunteer_qr_cards')
          .update({ deleted_at: now })
          .eq('id', target.cardId);
        if (cardErr) throw cardErr;

        const { error: attErr } = await supabase
          .from('volunteer_attendance')
          .update({ deleted_at: now })
          .eq('volunteer_card_id', target.cardId)
          .is('deleted_at', null);
        if (attErr) throw attErr;
      }
    }

    if (resolvedVolunteerId) {
      const { error } = await supabase
        .from('marketplace_volunteer_exclusions')
        .insert({
          marketplace_id: mpId,
          volunteer_id: resolvedVolunteerId,
          dependent_name: target.dependentName || null,
        });
      if (error && !/duplicate key|unique/i.test(error.message)) throw error;
    }
  };


  const handleConfirmDelete = async () => {
    if (!deletingVolunteer) return;
    setIsDeleting(true);
    try {
      await performDelete({
        cardId: deletingVolunteer.cardId,
        volunteerId: deletingVolunteer.volunteerId,
        dependentName: deletingVolunteer.dependentName,
      });

      if (deletingVolunteer.cardId) {
        const cid = deletingVolunteer.cardId;
        setSelectedRowKeys(prev => {
          const next = new Set(prev);
          next.delete(`card-${cid}`);
          return next;
        });
      }

      toast({ title: 'Removed from marketplace', description: `${deletingVolunteer.name} was removed from this marketplace. Their profile is preserved.` });
      setDeletingVolunteer(null);
      queryClient.invalidateQueries({ queryKey: ['marketplace_report'] });
      queryClient.invalidateQueries({ queryKey: ['all_marketplace_reports'] });
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message ?? 'Unknown error', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmBulkDelete = async () => {
    const list: any[] = (report as any)?.volunteers?.volunteerList || [];
    const targets = list.filter(v => selectedRowKeys.has(getRowKey(v)));
    if (targets.length === 0) {
      setBulkDeleteOpen(false);
      return;
    }
    setIsBulkDeleting(true);
    let success = 0, failed = 0;
    const results = await Promise.allSettled(
      targets.map(v => performDelete({
        cardId: v.cardId || undefined,
        volunteerId: v.volunteerId,
        dependentName: v.dependentName,
      }))
    );
    for (const r of results) r.status === 'fulfilled' ? success++ : failed++;
    setIsBulkDeleting(false);
    setBulkDeleteOpen(false);
    setSelectedRowKeys(new Set());
    queryClient.invalidateQueries({ queryKey: ['marketplace_report'] });
    queryClient.invalidateQueries({ queryKey: ['all_marketplace_reports'] });
    toast({
      title: failed === 0 ? `Removed ${success} volunteers` : `Removed ${success}, ${failed} failed`,
      description: 'They are excluded from this marketplace report only.',
      variant: failed > 0 ? 'destructive' : undefined,
    });
  };

  // Clear selection when marketplace changes
  useEffect(() => {
    setSelectedRowKeys(new Set());
  }, [selectedMarketplaceId]);

  const toggleRow = (key: string) => {
    setSelectedRowKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const {
    data: marketplaces = [],
    isLoading: loadingMarketplaces
  } = useMarketplaces();
  const {
    data: report,
    isLoading: loadingReport
  } = useMarketplaceReport(selectedMarketplaceId || undefined);
  const {
    data: allReports = [],
    isLoading: loadingAllReports
  } = useAllMarketplaceReports();
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  const formatGenderData = (data: Record<string, number>) => {
    return Object.entries(data).map(([name, value]) => ({
      name,
      value
    }));
  };

  const fmtTs = (iso: string | null | undefined) => iso ? formatDate(new Date(iso), 'yyyy-MM-dd HH:mm:ss') : '';

  const autosizeCols = (ws: XLSX.WorkSheet, rows: any[]) => {
    const headers = Object.keys(rows[0] || {});
    ws['!cols'] = headers.map(h => {
      const maxLen = Math.max(h.length, ...rows.map(r => String((r as any)[h] ?? '').length));
      return { wch: Math.min(Math.max(maxLen + 2, 12), 60) };
    });
  };

  const fetchQrEvidence = async (marketplaceId: string) => {
    // 0) Resolve the event date so we can also recover scans whose
    //    marketplace_id was never tagged (CheckIn / CheckOut scans are
    //    typically saved with marketplace_id = NULL by the QR scanner).
    const { data: mpRow } = await supabase
      .from('marketplace_events')
      .select('event_date')
      .eq('id', marketplaceId)
      .maybeSingle();
    const eventDate: string | null = (mpRow as any)?.event_date || null;

    // 1) Scan events for this marketplace come from `transactions`
    //    (each row = a beneficiary scan: check_in / distribution / return / check_out)
    const txnPageSize = 1000;
    const txns: any[] = [];
    for (let page = 0; page < 200; page++) {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, card_id, type, item_type, credit_change, timestamp, scanned_by, marketplace_id')
        .eq('marketplace_id', marketplaceId)
        .is('deleted_at', null)
        .order('timestamp', { ascending: true })
        .range(page * txnPageSize, page * txnPageSize + txnPageSize - 1);
      if (error) throw error;
      const rows = data || [];
      txns.push(...rows);
      if (rows.length < txnPageSize) break;
    }

    // 1b) Untagged scans (marketplace_id IS NULL) that happened on the
    //     event day. These are usually CheckIn/CheckOut scans from the QR
    //     scanner, which the scanner doesn't tag with a marketplace.
    //     Without this, "QR Cards Activated" undercounts (only cards that
    //     also had a Distribution scan show up).
    if (eventDate) {
      const dayStart = `${eventDate}T00:00:00.000Z`;
      const dayEnd = `${eventDate}T23:59:59.999Z`;
      const seen = new Set(txns.map((t: any) => t.id));
      for (let page = 0; page < 200; page++) {
        const { data, error } = await supabase
          .from('transactions')
          .select('id, card_id, type, item_type, credit_change, timestamp, scanned_by, marketplace_id')
          .is('marketplace_id', null)
          .is('deleted_at', null)
          .gte('timestamp', dayStart)
          .lte('timestamp', dayEnd)
          .order('timestamp', { ascending: true })
          .range(page * txnPageSize, page * txnPageSize + txnPageSize - 1);
        if (error) throw error;
        const rows = data || [];
        for (const r of rows) if (!seen.has(r.id)) { txns.push(r); seen.add(r.id); }
        if (rows.length < txnPageSize) break;
      }
    }

    // 2) Cards directly linked to this marketplace (legacy / pre-scan activations)
    const [activeRes, archivedRes, logsRes] = await Promise.all([
      supabase
        .from('qr_cards')
        .select('id, unique_id, status, activated_at, gender, marital_status, nationality, children_count, total_items_collected, credit_balance')
        .eq('marketplace_id', marketplaceId)
        .is('deleted_at', null),
      supabase
        .from('archived_card_data')
        .select('original_card_id, unique_id, activated_at, checked_out_at, gender, marital_status, nationality, children_count, total_items_collected, credit_balance')
        .eq('marketplace_id', marketplaceId)
        .is('deleted_at', null),
      supabase
        .from('allocation_traceability_logs' as any)
        .select('created_at, action_type, card_unique_id, quantity_before, quantity_after, performed_by_email, description')
        .eq('marketplace_id', marketplaceId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),
    ]);

    // 3) Resolve cards referenced by transactions but missing from the linked sets
    const knownIds = new Set<string>([
      ...((activeRes.data || []) as any[]).map((c: any) => c.id),
      ...((archivedRes.data || []) as any[]).map((c: any) => c.original_card_id).filter(Boolean),
    ]);
    const missingCardIds = Array.from(
      new Set(txns.map((t: any) => t.card_id).filter((id: string) => id && !knownIds.has(id)))
    );

    const extraActive: any[] = [];
    const extraArchived: any[] = [];
    const chunk = 300;
    for (let i = 0; i < missingCardIds.length; i += chunk) {
      const ids = missingCardIds.slice(i, i + chunk);
      const [a, b] = await Promise.all([
        supabase
          .from('qr_cards')
          .select('id, unique_id, status, activated_at, gender, marital_status, nationality, children_count, total_items_collected, credit_balance')
          .in('id', ids),
        supabase
          .from('archived_card_data')
          .select('original_card_id, unique_id, activated_at, checked_out_at, gender, marital_status, nationality, children_count, total_items_collected, credit_balance')
          .in('original_card_id', ids),
      ]);
      extraActive.push(...((a.data || []) as any[]));
      extraArchived.push(...((b.data || []) as any[]));
    }

    return {
      active: [...((activeRes.data || []) as any[]), ...extraActive],
      archived: [...((archivedRes.data || []) as any[]), ...extraArchived],
      logs: (logsRes.data || []) as any[],
      transactions: txns,
    };
  };

  const buildQrSheets = (qr: { active: any[]; archived: any[]; logs: any[]; transactions: any[] }) => {
    // Index cards by their internal id so transactions can be attributed
    const cardById = new Map<string, any>();
    for (const c of qr.active) cardById.set(c.id, { ...c, _source: 'Active' });
    for (const c of qr.archived) {
      const id = c.original_card_id;
      if (id && !cardById.has(id)) {
        cardById.set(id, { ...c, status: 'archived', _source: 'Archived' });
      }
    }

    // Per-card scan aggregates
    type Agg = { firstScan?: string; lastScan?: string; scans: number; items: number; checkIn?: string; checkOut?: string };
    const aggByCardId = new Map<string, Agg>();
    for (const t of qr.transactions) {
      const a = aggByCardId.get(t.card_id) || { scans: 0, items: 0 };
      a.scans += 1;
      const tt = String(t.type || '').toLowerCase().replace(/[_\s-]/g, '');
      if (tt === 'distribution') a.items += 1;
      if (tt === 'checkin') {
        if (!a.checkIn || t.timestamp < a.checkIn) a.checkIn = t.timestamp;
      }
      if (tt === 'checkout') a.checkOut = t.timestamp;
      if (!a.firstScan || t.timestamp < a.firstScan) a.firstScan = t.timestamp;
      if (!a.lastScan || t.timestamp > a.lastScan) a.lastScan = t.timestamp;
      aggByCardId.set(t.card_id, a);
    }

    const allCardIds = new Set<string>([...cardById.keys(), ...aggByCardId.keys()]);

    const evidenceRows: any[] = [];
    for (const id of allCardIds) {
      const c = cardById.get(id) || {};
      const a = aggByCardId.get(id);
      evidenceRows.push({
        'QR Unique ID': c.unique_id || id,
        'Status': c.status || (a ? 'scanned' : ''),
        'Checked In At': fmtTs(a?.checkIn || c.activated_at || a?.firstScan),
        'First Scan At': fmtTs(a?.firstScan || c.activated_at),
        'Last Scan At': fmtTs(a?.lastScan),
        'Checked Out At': fmtTs(a?.checkOut || c.checked_out_at),
        'Scan Count': a?.scans ?? 0,
        'Items Distributed': a?.items ?? (c.total_items_collected ?? 0),
        'Gender': c.gender || '',
        'Marital Status': c.marital_status || '',
        'Nationality': c.nationality || '',
        'Children Count': c.children_count ?? 0,
        'Credit Balance': c.credit_balance ?? 0,
        'Source': c._source || 'Scan only',
      });
    }
    evidenceRows.sort((x, y) => String(x['Checked In At']).localeCompare(String(y['Checked In At'])));

    const totalCards = evidenceRows.length;
    const totalActivated = evidenceRows.filter(r => r['Checked In At']).length;
    const totalCheckedOut = evidenceRows.filter(r => r['Checked Out At']).length;
    const totalItems = evidenceRows.reduce((s, r) => s + (Number(r['Items Distributed']) || 0), 0);
    const totalScans = qr.transactions.length;

    evidenceRows.push({
      'QR Unique ID': `TOTAL: ${totalCards} cards`,
      'Status': '', 'Checked In At': '', 'First Scan At': '', 'Last Scan At': '', 'Checked Out At': '',
      'Scan Count': totalScans,
      'Items Distributed': totalItems,
      'Gender': '', 'Marital Status': '', 'Nationality': '',
      'Children Count': 0,
      'Credit Balance': 0,
      'Source': '',
    });

    // Per-scan log: one row per transaction = real audit trail of QR scans
    const scanLogRows = qr.transactions.map((t: any) => {
      const c = cardById.get(t.card_id) || {};
      return {
        'Timestamp': fmtTs(t.timestamp),
        'Action': t.type || '',
        'QR Card': c.unique_id || t.card_id,
        'Item': t.item_type || '',
        'Credit Change': t.credit_change ?? 0,
      };
    });

    // Allocation-level audit (kept as supplementary evidence)
    const allocLogRows = qr.logs.map(l => ({
      'Timestamp': fmtTs(l.created_at),
      'Action': l.action_type || '',
      'QR Card': l.card_unique_id || '',
      'Qty Before': l.quantity_before ?? 0,
      'Qty After': l.quantity_after ?? 0,
      'Change': (l.quantity_after ?? 0) - (l.quantity_before ?? 0),
      'Performed By': l.performed_by_email || '',
      'Description': l.description || '',
    }));

    return {
      evidenceRows,
      scanLogRows,
      allocLogRows,
      totalCards,
      totalActivated,
      totalCheckedOut,
      totalItems,
      totalScans,
    };
  };

  const safeName = () =>
    ((report?.marketplace.name) || 'marketplace').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const dateStr = () =>
    report?.marketplace.eventDate
      ? formatDate(new Date(report.marketplace.eventDate), 'yyyy-MM-dd')
      : formatDate(new Date(), 'yyyy-MM-dd');

  const exportAttendanceLog = async () => {
    if (!report || !selectedMarketplaceId) return;
    const list: any[] = (report as any)?.volunteers?.volunteerList || [];
    const attended = list.filter(v => v.checkedInAt || v.status === 'checked_in' || v.status === 'checked_out');
    const rows = attended.map(v => ({
      'Volunteer Name': v.name || '',
      'Organization': v.company || '',
      'Category': v.category || '',
      'Gender': v.gender || '',
      'QR Card': v.uniqueId || '',
      'Status': v.status || '',
      'Checked In At': fmtTs(v.checkedInAt),
      'Checked Out At': fmtTs(v.checkedOutAt),
      'Hours Worked': Number(v.hoursWorked || 0).toFixed(2),
    }));
    const totalHours = attended.reduce((s, v) => s + (Number(v.hoursWorked) || 0), 0);
    rows.push({
      'Volunteer Name': `TOTAL: ${attended.length} volunteers`,
      'Organization': '', 'Category': '', 'Gender': '', 'QR Card': '', 'Status': '',
      'Checked In At': '', 'Checked Out At': '',
      'Hours Worked': totalHours.toFixed(2),
    });

    const qr = await fetchQrEvidence(selectedMarketplaceId);
    const { evidenceRows, scanLogRows, allocLogRows, totalCards, totalActivated, totalCheckedOut, totalScans } = buildQrSheets(qr);

    const beneficiariesCount =
      (report.marketplace as any).manualBeneficiaryCount ?? report.beneficiaries?.total ?? 0;
    const itemsDistributed = report.items?.totalDistributed ?? 0;
    const itemsAllocated = report.items?.totalAllocated ?? 0;
    const itemsRemaining = report.items?.totalRemaining ?? 0;
    const summaryRows = [
      { Metric: 'Marketplace', Quantity: report.marketplace.name },
      { Metric: 'Event Date', Quantity: report.marketplace.eventDate || '' },
      { Metric: 'Beneficiaries', Quantity: beneficiariesCount },
      { Metric: 'Beneficiary QR Cards Scanned', Quantity: totalCards },
      { Metric: 'QR Cards Activated', Quantity: totalActivated },
      { Metric: 'QR Cards Checked Out', Quantity: totalCheckedOut },
      { Metric: 'Total QR Scan Events', Quantity: totalScans },
      { Metric: 'Volunteers Attended', Quantity: attended.length },
      { Metric: 'Total Hours Worked', Quantity: Number(totalHours.toFixed(2)) },
      { Metric: 'Items Allocated', Quantity: itemsAllocated },
      { Metric: 'Items Distributed', Quantity: itemsDistributed },
      { Metric: 'Items Remaining', Quantity: itemsRemaining },
    ];

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 32 }, { wch: 32 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    const wsAtt = XLSX.utils.json_to_sheet(rows);
    autosizeCols(wsAtt, rows);
    XLSX.utils.book_append_sheet(wb, wsAtt, 'Volunteer Attendance');

    const wsEv = XLSX.utils.json_to_sheet(evidenceRows);
    autosizeCols(wsEv, evidenceRows);
    XLSX.utils.book_append_sheet(wb, wsEv, 'Beneficiary QR Evidence');

    if (scanLogRows.length) {
      const wsLog = XLSX.utils.json_to_sheet(scanLogRows);
      autosizeCols(wsLog, scanLogRows);
      XLSX.utils.book_append_sheet(wb, wsLog, 'QR Scan Log');
    }
    if (allocLogRows.length) {
      const wsAlloc = XLSX.utils.json_to_sheet(allocLogRows);
      autosizeCols(wsAlloc, allocLogRows);
      XLSX.utils.book_append_sheet(wb, wsAlloc, 'Allocation Audit');
    }

    XLSX.writeFile(wb, `attendance-${safeName()}-${dateStr()}.xlsx`);
    toast({ title: 'Attendance log exported', description: `${attended.length} volunteers · ${totalCards} QR cards · ${totalScans} scans` });
  };

  const exportQrEvidence = async () => {
    if (!report || !selectedMarketplaceId) return;
    const qr = await fetchQrEvidence(selectedMarketplaceId);
    const { evidenceRows, scanLogRows, allocLogRows, totalCards, totalActivated, totalCheckedOut, totalItems, totalScans } = buildQrSheets(qr);
    const beneficiariesCount =
      (report.marketplace as any).manualBeneficiaryCount ?? report.beneficiaries?.total ?? 0;

    const summaryRows = [
      { Metric: 'Marketplace', Quantity: report.marketplace.name },
      { Metric: 'Event Date', Quantity: report.marketplace.eventDate || '' },
      { Metric: 'Reported Beneficiaries', Quantity: beneficiariesCount },
      { Metric: 'Beneficiary QR Cards Scanned', Quantity: totalCards },
      { Metric: 'QR Cards Activated', Quantity: totalActivated },
      { Metric: 'QR Cards Checked Out', Quantity: totalCheckedOut },
      { Metric: 'Total QR Scan Events', Quantity: totalScans },
      { Metric: 'Total Items Distributed via QR', Quantity: totalItems },
    ];

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 32 }, { wch: 32 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    const wsEv = XLSX.utils.json_to_sheet(evidenceRows);
    autosizeCols(wsEv, evidenceRows);
    XLSX.utils.book_append_sheet(wb, wsEv, 'Beneficiary QR Evidence');

    if (scanLogRows.length) {
      const wsLog = XLSX.utils.json_to_sheet(scanLogRows);
      autosizeCols(wsLog, scanLogRows);
      XLSX.utils.book_append_sheet(wb, wsLog, 'QR Scan Log');
    }
    if (allocLogRows.length) {
      const wsAlloc = XLSX.utils.json_to_sheet(allocLogRows);
      autosizeCols(wsAlloc, allocLogRows);
      XLSX.utils.book_append_sheet(wb, wsAlloc, 'Allocation Audit');
    }

    XLSX.writeFile(wb, `qr-evidence-${safeName()}-${dateStr()}.xlsx`);
    toast({ title: 'QR evidence exported', description: `${totalCards} cards · ${totalScans} scans` });
  };
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container max-w-6xl py-3 md:py-4 px-4">
          <div className="flex items-center gap-3 md:gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="font-display font-bold text-base md:text-lg truncate">Marketplace Reports</h1>
              <p className="text-xs md:text-sm text-muted-foreground">Detailed insights for each marketplace</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-4 md:py-6 px-4">
        {/* Marketplace Selector */}
        <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div className="flex-1">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Select Marketplace</label>
            <Select value={selectedMarketplaceId} onValueChange={setSelectedMarketplaceId}>
              <SelectTrigger className="w-full md:w-[32rem]">
                <SelectValue placeholder="Choose a marketplace to view report..." />
              </SelectTrigger>
              <SelectContent className="min-w-[var(--radix-select-trigger-width)] max-w-[90vw]">
                {marketplaces.map(mp => <SelectItem key={mp.id} value={mp.id} className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span>{mp.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${mp.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' : mp.status === 'active' ? 'bg-blue-500/10 text-blue-600' : 'bg-amber-500/10 text-amber-600'}`}>
                        {mp.status}
                      </span>
                    </div>
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <Button
              variant="default"
              onClick={async () => {
                toast({ title: 'Building full audit trail…', description: 'Fetching donations, allocations, distributions. This may take 10–30 seconds.' });
                try {
                  const r = await exportFullAuditTrail();
                  toast({ title: 'Audit trail exported', description: `${r.materials} materials · ${r.allocations} allocations · ${r.remaining} with remaining stock · ${r.mismatches} mismatches vs auditor reference.` });
                } catch (e: any) {
                  toast({ title: 'Export failed', description: e?.message ?? 'Unknown error', variant: 'destructive' });
                }
              }}
              className="gap-2 w-full md:w-auto"
            >
              <Download className="w-4 h-4" />
              Export Full Audit Trail
            </Button>
            {selectedMarketplaceId && report && (
              <>
                <Button
                  variant="outline"
                  onClick={() => exportAttendanceLog()}
                  className="gap-2 w-full md:w-auto"
                >
                  <Download className="w-4 h-4" />
                  Export Attendance Log
                </Button>
                <Button
                  variant="outline"
                  onClick={() => exportQrEvidence()}
                  className="gap-2 w-full md:w-auto"
                >
                  <QrCode className="w-4 h-4" />
                  Export QR Evidence
                </Button>
              </>
            )}
          </div>

        </div>

        {/* All Marketplaces Overview */}
        {!selectedMarketplaceId && <div className="space-y-6">
            <h2 className="font-display font-bold text-lg">All Marketplaces Overview</h2>
            
            {loadingAllReports ? <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div> : allReports.length === 0 ? <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No marketplace data available</p>
              </div> : <div className="grid gap-4">
                {allReports.map((mp, index) => <motion.div key={mp.id} initial={{
            opacity: 0,
            y: 10
          }} animate={{
            opacity: 1,
            y: 0
          }} transition={{
            delay: index * 0.05
          }} className="bg-card rounded-xl border border-border p-4 md:p-6 shadow-card cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedMarketplaceId(mp.id)}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-display font-semibold text-lg">{mp.name}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${mp.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' : mp.status === 'active' ? 'bg-blue-500/10 text-blue-600' : 'bg-amber-500/10 text-amber-600'}`}>
                            {mp.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {mp.location && <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {mp.location}
                            </span>}
                          {mp.eventDate && <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(mp.eventDate).toLocaleDateString()}
                            </span>}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 md:gap-6">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-primary">{mp.beneficiaryCount}</p>
                          <p className="text-xs text-muted-foreground">Beneficiaries</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-emerald-500">{mp.totalDistributed}</p>
                          <p className="text-xs text-muted-foreground">Distributed</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-amber-500">{mp.totalRemaining}</p>
                          <p className="text-xs text-muted-foreground">Remaining</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>)}
              </div>}
          </div>}

        {/* Selected Marketplace Report */}
        {selectedMarketplaceId && <div className="space-y-6">
            {loadingReport ? <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div> : report ? <>
                {/* Marketplace Info Header */}
                <div className="bg-card rounded-xl border border-border p-4 md:p-6 shadow-card mb-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="font-display font-bold text-xl">{report.marketplace.name}</h2>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                        {report.marketplace.location && <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {report.marketplace.location}
                          </span>}
                        {report.marketplace.eventDate && <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(report.marketplace.eventDate).toLocaleDateString()}
                          </span>}
                        {report.marketplace.outreachPartner && <span className="flex items-center gap-1 text-primary font-medium">
                            <Building2 className="w-4 h-4" />
                            {report.marketplace.outreachPartner}
                          </span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-start">
                      <span className={`text-sm px-3 py-1 rounded-full ${report.marketplace.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' : report.marketplace.status === 'active' ? 'bg-blue-500/10 text-blue-600' : 'bg-amber-500/10 text-amber-600'}`}>
                        {report.marketplace.status}
                      </span>
                      <div className="flex items-center gap-2">
                        {isSyncing && currentStepLabel && (
                          <span className="text-xs text-muted-foreground hidden md:inline">
                            {currentStepLabel}
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSyncing}
                          onClick={() => setConfirmSyncOpen(true)}
                          className="gap-1.5"
                        >
                          {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          {isSyncing ? (currentStepLabel || 'Syncing…') : 'Send to Surpluss'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  <div className="bg-card rounded-xl border border-border p-4 shadow-card">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary-soft flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{(report.marketplace as any).manualBeneficiaryCount ?? report.beneficiaries.total}</p>
                        <p className="text-xs text-muted-foreground">
                        <p className="text-xs text-muted-foreground">Beneficiaries</p>
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-card rounded-xl border border-border p-4 shadow-card">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <Package className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{report.items.totalDistributed}</p>
                        <p className="text-xs text-muted-foreground">Items Given</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-card rounded-xl border border-border p-4 shadow-card">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{report.items.totalRemaining}</p>
                        <p className="text-xs text-muted-foreground">Items Left</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-card rounded-xl border border-border p-4 shadow-card">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{report.volunteers?.totalHours.toFixed(1) || 0}</p>
                        <p className="text-xs text-muted-foreground">Volunteer Hours</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Beneficiary Demographics Editor */}
                <MarketplaceDemographicsEditor marketplaceId={selectedMarketplaceId} marketplaceName={report.marketplace.name} />

                {/* Marketplace Manual Data Editor */}
                <MarketplaceManualDataEditor marketplaceId={selectedMarketplaceId} marketplaceName={report.marketplace.name} />

                {/* Audit Reconciliation Panel — Originally Pledged vs Distributed */}
                <OriginalAllocationAuditPanel marketplaceId={selectedMarketplaceId} marketplaceName={report.marketplace.name} />

                {/* Items Section */}
                <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
                  <button onClick={() => toggleSection('items')} className="w-full p-4 md:p-6 flex items-center justify-between text-left hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Package className="w-5 h-5 text-emerald-500" />
                      <h3 className="font-display font-semibold text-lg">Item Distribution</h3>
                      <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                        {report.items.byItemType.length} Items
                      </span>
                    </div>
                    {expandedSections.items ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  
                  {expandedSections.items && <div className="px-4 md:px-6 pb-6">
                      {/* Summary Stats */}
                      <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-muted/50 rounded-lg p-4 text-center">
                          <p className="text-2xl font-bold">{report.items.totalAllocated}</p>
                          <p className="text-xs text-muted-foreground">Total Allocated</p>
                        </div>
                        <div className="bg-emerald-500/10 rounded-lg p-4 text-center">
                          <p className="text-2xl font-bold text-emerald-600">{report.items.totalDistributed}</p>
                          <p className="text-xs text-muted-foreground">Distributed</p>
                        </div>
                        <div className="bg-amber-500/10 rounded-lg p-4 text-center">
                          <p className="text-2xl font-bold text-amber-600">{report.items.totalRemaining}</p>
                          <p className="text-xs text-muted-foreground">Remaining</p>
                        </div>
                      </div>

                      {/* Grouped by Category - Table Layout */}
                      {report.items.byItemType.length > 0 ? (() => {
                        const grouped = report.items.byItemType.reduce((acc, item) => {
                          const cat = item.category || 'Uncategorized';
                          if (!acc[cat]) acc[cat] = [];
                          acc[cat].push(item);
                          return acc;
                        }, {} as Record<string, typeof report.items.byItemType>);

                        return <div className="space-y-6">
                          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => {
                            const catAllocated = items.reduce((s, i) => s + i.allocated, 0);
                            const catDistributed = items.reduce((s, i) => s + i.distributed, 0);
                            const catRemaining = items.reduce((s, i) => s + i.remaining, 0);
                            return <div key={category} className="bg-muted/20 rounded-xl border border-border overflow-hidden">
                              <div className="flex items-center justify-between p-4 bg-muted/40">
                                <div className="flex items-center gap-3">
                                  <h4 className="font-display font-semibold">{category}</h4>
                                  <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                                    {items.length} Items
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                  <span className="text-muted-foreground">Allocated: <span className="font-semibold text-foreground">{catAllocated.toLocaleString()}</span></span>
                                  <span className="text-muted-foreground">Distributed: <span className="font-semibold text-emerald-600">{catDistributed.toLocaleString()}</span></span>
                                  <span className="text-muted-foreground">Remaining: <span className="font-semibold text-primary">{catRemaining.toLocaleString()}</span></span>
                                </div>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm table-fixed">
                                  <colgroup>
                                    <col className="w-[40%]" />
                                    <col className="w-[20%]" />
                                    <col className="w-[20%]" />
                                    <col className="w-[20%]" />
                                  </colgroup>
                                  <thead>
                                    <tr className="border-b border-border">
                                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item Name</th>
                                      <th className="text-center py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Allocated</th>
                                      <th className="text-center py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Distributed</th>
                                      <th className="text-right py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Remaining</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {items.map(item => <tr key={item.itemId} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                                      <td className="py-3 px-4">
                                        <p className="font-medium">{item.itemName}</p>
                                        {item.subcategory && <p className="text-xs text-muted-foreground">{item.subcategory}</p>}
                                      </td>
                                      <td className="py-3 px-4 text-center text-muted-foreground">{item.allocated > 0 ? item.allocated.toLocaleString() : '—'}</td>
                                      <td className="py-3 px-4 text-center text-muted-foreground">{item.distributed > 0 ? item.distributed.toLocaleString() : '—'}</td>
                                      <td className="py-3 px-4 text-right font-semibold text-primary">{item.remaining.toLocaleString()}</td>
                                    </tr>)}
                                  </tbody>
                                </table>
                              </div>
                            </div>;
                          })}
                        </div>;
                      })() : <div className="text-center py-8 text-muted-foreground">
                          <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                          <p>No items allocated to this marketplace</p>
                        </div>}
                    </div>}
                </div>

                {/* Volunteers Section */}
                <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
                  <button onClick={() => toggleSection('volunteers')} className="w-full p-4 md:p-6 flex items-center justify-between text-left hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-primary" />
                      <h3 className="font-display font-semibold text-lg">Volunteer Details</h3>
                    </div>
                    {expandedSections.volunteers ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  
                  {expandedSections.volunteers && <div className="px-4 md:px-6 pb-6 space-y-6">
                      <p className="text-sm text-muted-foreground">Comprehensive volunteer tracking and attendance data</p>
                      
                      {/* Summary Cards */}
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        <div className="rounded-lg border p-3 md:p-4 bg-primary/5 border-primary/20">
                          <p className="text-xs text-muted-foreground mb-1">Total Registered</p>
                          <p className="text-xl md:text-2xl font-bold text-primary">{report.volunteers?.totalRegistered || 0}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Volunteers + Family</p>
                        </div>
                        <div className="rounded-lg border p-3 md:p-4 bg-success/5 border-success/20">
                          <p className="text-xs text-muted-foreground mb-1">Total Attended</p>
                          <p className="text-xl md:text-2xl font-bold text-success">{report.volunteers?.totalAttended || 0}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Volunteers</p>
                        </div>
                        <div className="rounded-lg border p-3 md:p-4 bg-violet-500/5 border-violet-500/20">
                          <p className="text-xs text-muted-foreground mb-1">Family Members</p>
                          <p className="text-xl md:text-2xl font-bold text-violet-600">{report.volunteers?.familyMembers || 0}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Registered: {(report.volunteers?.totalRegistered || 0) - (report.volunteers?.familyMembers || 0)}</p>
                        </div>
                        <div className="rounded-lg border p-3 md:p-4 bg-blue-500/5 border-blue-500/20">
                          <p className="text-xs text-muted-foreground mb-1">Total Hours</p>
                          <p className="text-xl md:text-2xl font-bold text-blue-600">{report.volunteers?.totalHours.toFixed(1) || 0}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Hours Worked</p>
                        </div>
                        <div className="rounded-lg border p-3 md:p-4 bg-destructive/5 border-destructive/20">
                          <p className="text-xs text-muted-foreground mb-1">Drop-out Rate</p>
                          <p className="text-xl md:text-2xl font-bold text-destructive">{report.volunteers?.dropoutRate || 0}%</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{(report.volunteers?.totalRegistered || 0) - (report.volunteers?.familyMembers || 0) - (report.volunteers?.totalAttended || 0)} volunteers</p>
                        </div>
                        <div className="rounded-lg border p-3 md:p-4 bg-amber-500/5 border-amber-500/20">
                          <div className="flex items-center gap-1.5 mb-1">
                            <GraduationCap className="w-3.5 h-3.5 text-amber-600" />
                            <p className="text-xs text-muted-foreground">Training After Event</p>
                          </div>
                          <p className="text-xl md:text-2xl font-bold text-amber-600">{report.volunteers?.trainingCompletedAfterEvent || 0}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Completed post-event</p>
                        </div>
                      </div>

                      {/* Category Breakdown Table - Desktop */}
                      {report.volunteers?.categoryBreakdown && report.volunteers.categoryBreakdown.length > 0 && <>
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border text-muted-foreground">
                                <th className="text-left py-3 px-2 font-medium">Category</th>
                                <th className="text-left py-3 px-2 font-medium">Registered</th>
                                <th className="text-left py-3 px-2 font-medium">Attended</th>
                                <th className="text-left py-3 px-2 font-medium">Drop-out Rate</th>
                                <th className="text-left py-3 px-2 font-medium">Gender (M/F)</th>
                                <th className="text-left py-3 px-2 font-medium">Top Companies</th>
                              </tr>
                            </thead>
                            <tbody>
                              {report.volunteers.categoryBreakdown.map(row => (
                                <tr key={row.category} className="border-b border-border/50 last:border-0">
                                  <td className="py-3 px-2 font-medium text-foreground">{row.category}</td>
                                  <td className="py-3 px-2 text-foreground">{row.registered}</td>
                                  <td className="py-3 px-2 text-success font-medium">{row.attended}</td>
                                  <td className="py-3 px-2 text-warning font-medium">{row.dropoutRate}%</td>
                                  <td className="py-3 px-2 text-foreground">{row.maleCount} / {row.femaleCount}</td>
                                  <td className="py-3 px-2 text-muted-foreground text-xs">{row.topCompanies.join(', ')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Category Breakdown Cards - Mobile */}
                        <div className="space-y-3 md:hidden">
                          {report.volunteers.categoryBreakdown.map(row => (
                            <div key={row.category} className="border border-border rounded-lg p-3 space-y-2">
                              <p className="font-medium text-foreground text-sm">{row.category}</p>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-muted-foreground">Registered: </span>
                                  <span className="font-medium text-foreground">{row.registered}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Attended: </span>
                                  <span className="font-medium text-success">{row.attended}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Drop-out: </span>
                                  <span className="font-medium text-warning">{row.dropoutRate}%</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">M/F: </span>
                                  <span className="font-medium text-foreground">{row.maleCount} / {row.femaleCount}</span>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">{row.topCompanies.join(', ')}</p>
                            </div>
                          ))}
                        </div>
                      </>}

                      {/* Individual Volunteer List */}
                      {report.volunteers?.volunteerList && report.volunteers.volunteerList.length > 0 && (() => {
                        const list = report.volunteers.volunteerList;
                        const selectableKeys: string[] = list
                          .filter((v: any) => v.cardId || v.volunteerId)
                          .map((v: any) => getRowKey(v));
                        const allSelected = selectableKeys.length > 0 && selectableKeys.every(k => selectedRowKeys.has(k));
                        const someSelected = selectableKeys.some(k => selectedRowKeys.has(k));
                        const toggleAll = () => {
                          setSelectedRowKeys(prev => {
                            const next = new Set(prev);
                            if (allSelected) selectableKeys.forEach(k => next.delete(k));
                            else selectableKeys.forEach(k => next.add(k));
                            return next;
                          });
                        };
                        const selectedTargets: BulkVolunteerEditTarget[] = list
                          .filter((v: any) => v.cardId && selectedRowKeys.has(getRowKey(v)))
                          .map((v: any) => ({ cardId: v.cardId, name: v.name }));
                        const editableSelectedCount = selectedTargets.length;

                        return (
                        <div>
                          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                            <h4 className="font-display font-semibold text-sm">Volunteer List</h4>
                            {selectedRowKeys.size > 0 && (
                              <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-md px-3 py-1.5 flex-wrap">
                                <span className="text-xs font-medium">{selectedRowKeys.size} selected</span>
                                <Button size="sm" variant="default" className="h-7" disabled={editableSelectedCount === 0} onClick={() => setBulkEditOpen(true)}>
                                  <Pencil className="w-3.5 h-3.5 mr-1" /> Edit Hours
                                </Button>
                                <Button size="sm" variant="destructive" className="h-7" onClick={() => setBulkDeleteOpen(true)}>
                                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7" onClick={() => setSelectedRowKeys(new Set())}>
                                  Clear
                                </Button>
                              </div>
                            )}
                          </div>
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full text-sm table-fixed">
                            <colgroup>
                              <col className="w-[5%]" />
                              <col className="w-[20%]" />
                              <col className="w-[8%]" />
                              <col className="w-[13%]" />
                              <col className="w-[14%]" />
                              <col className="w-[13%]" />
                              <col className="w-[13%]" />
                              <col className="w-[14%]" />
                            </colgroup>
                            <thead>
                              <tr className="border-b border-border text-muted-foreground">
                                <th className="py-3 px-2">
                                  <Checkbox checked={allSelected ? true : (someSelected ? 'indeterminate' : false)} onCheckedChange={toggleAll} aria-label="Select all" />
                                </th>
                                <th className="text-left py-3 px-2 font-medium">Name</th>
                                <th className="text-center py-3 px-2 font-medium">QR Code</th>
                                <th className="text-left py-3 px-2 font-medium">Category</th>
                                <th className="text-left py-3 px-2 font-medium">Company</th>
                                <th className="text-left py-3 px-2 font-medium">Status</th>
                                <th className="text-right py-3 px-2 font-medium">Hours</th>
                                <th className="text-center py-3 px-2 font-medium">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {list.map((vol: any, idx: number) => {
                                const cid = vol.cardId as string | undefined;
                                const rowKey = getRowKey(vol);
                                const selectable = !!(cid || vol.volunteerId);
                                const checked = selectable ? selectedRowKeys.has(rowKey) : false;
                                return (
                                <tr key={idx} className="border-b border-border/50 last:border-0">
                                  <td className="py-2.5 px-2">
                                    {selectable && (
                                      <Checkbox checked={checked} onCheckedChange={() => toggleRow(rowKey)} aria-label={`Select ${vol.name}`} />
                                    )}
                                  </td>
                                  <td className="py-2.5 px-2 font-medium text-foreground truncate">{vol.name}</td>
                                  <td className="py-2.5 px-2 text-center">
                                    {vol.uniqueId ? (
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setQrVolunteer(vol)} aria-label={`Show QR for ${vol.name}`}>
                                        <QrCode className="w-4 h-4 text-primary" />
                                      </Button>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-2 text-muted-foreground text-xs">{vol.category}</td>
                                  <td className="py-2.5 px-2 text-muted-foreground text-xs truncate">{vol.company}</td>
                                  <td className="py-2.5 px-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      vol.status === 'checked_in' ? 'bg-emerald-500/10 text-emerald-600' :
                                      vol.status === 'checked_out' ? 'bg-blue-500/10 text-blue-600' :
                                      'bg-muted text-muted-foreground'
                                    }`}>
                                      {vol.status === 'checked_in' ? 'Checked In' : vol.status === 'checked_out' ? 'Checked Out' : 'Inactive'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-2 text-right font-medium">{vol.hoursWorked > 0 ? `${vol.hoursWorked.toFixed(1)}h` : '—'}</td>
                                  <td className="py-2.5 px-2 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingVolunteer({
                                        cardId: vol.cardId,
                                        name: vol.name,
                                        checkedInAt: vol.checkedInAt,
                                        checkedOutAt: vol.checkedOutAt,
                                        hoursWorked: vol.hoursWorked,
                                        marketplaceId: selectedMarketplaceId || undefined,
                                      })}>
                                        <Pencil className="w-3.5 h-3.5" />
                                      </Button>
                                      {(cid || vol.volunteerId) && (
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeletingVolunteer({ cardId: cid, volunteerId: vol.volunteerId, dependentName: vol.dependentName, name: vol.name })} aria-label={`Remove ${vol.name} from this marketplace`}>
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {/* Mobile */}
                        <div className="space-y-2 md:hidden">
                          {list.map((vol: any, idx: number) => {
                            const cid = vol.cardId as string | undefined;
                            const rowKey = getRowKey(vol);
                            const selectable = !!(cid || vol.volunteerId);
                            const checked = selectable ? selectedRowKeys.has(rowKey) : false;
                            return (
                            <div key={idx} className="border border-border rounded-lg p-3">
                              <div className="flex justify-between items-start mb-1 gap-2">
                                <div className="flex items-start gap-2 min-w-0">
                                  {selectable && (
                                    <Checkbox checked={checked} onCheckedChange={() => toggleRow(rowKey)} className="mt-0.5" aria-label={`Select ${vol.name}`} />
                                  )}
                                  <p className="font-medium text-sm text-foreground truncate">{vol.name}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    vol.status === 'checked_in' ? 'bg-emerald-500/10 text-emerald-600' :
                                    vol.status === 'checked_out' ? 'bg-blue-500/10 text-blue-600' :
                                    'bg-muted text-muted-foreground'
                                  }`}>
                                    {vol.status === 'checked_in' ? 'Checked In' : vol.status === 'checked_out' ? 'Checked Out' : 'Inactive'}
                                  </span>
                                  {vol.uniqueId && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setQrVolunteer(vol)} aria-label={`Show QR for ${vol.name}`}>
                                      <QrCode className="w-3 h-3 text-primary" />
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingVolunteer({
                                    cardId: vol.cardId,
                                    name: vol.name,
                                    checkedInAt: vol.checkedInAt,
                                    checkedOutAt: vol.checkedOutAt,
                                    hoursWorked: vol.hoursWorked,
                                    marketplaceId: selectedMarketplaceId || undefined,
                                  })}>
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                  {(cid || vol.volunteerId) && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeletingVolunteer({ cardId: cid, volunteerId: vol.volunteerId, dependentName: vol.dependentName, name: vol.name })} aria-label={`Remove ${vol.name} from this marketplace`}>
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground pl-6">{vol.category} · {vol.company}</p>
                              {vol.hoursWorked > 0 && <p className="text-xs text-muted-foreground mt-1 pl-6">{vol.hoursWorked.toFixed(1)} hours</p>}
                            </div>
                            );
                          })}
                        </div>
                        <VolunteerBulkHoursEditDialog
                          volunteers={selectedTargets}
                          marketplaceId={selectedMarketplaceId || undefined}
                          open={bulkEditOpen}
                          onOpenChange={setBulkEditOpen}
                          onCompleted={() => setSelectedRowKeys(new Set())}
                        />
                      </div>
                        );
                      })()}
                    </div>}
                </div>
              </> : <div className="text-center py-12 text-muted-foreground">
                <PieChartIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a marketplace to view its report</p>
              </div>}
          </div>}
      </main>
      <VolunteerHoursEditDialog
        volunteer={editingVolunteer}
        open={!!editingVolunteer}
        onOpenChange={(open) => { if (!open) setEditingVolunteer(null); }}
      />
      <AlertDialog open={!!deletingVolunteer} onOpenChange={(open) => { if (!open && !isDeleting) setDeletingVolunteer(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from this marketplace?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  <span className="font-medium text-foreground">{deletingVolunteer?.name}</span> will be removed from this marketplace report only.
                  Their volunteer profile and any data on other marketplaces stay intact.
                </p>
                <p className="text-destructive font-medium">
                  ⚠️ This also soft-deletes their attendance record (check-in/out + hours) for this marketplace. The numbers in the report will drop accordingly.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => { e.preventDefault(); handleConfirmDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Removing…' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => { if (!open && !isBulkDeleting) { setBulkDeleteOpen(false); setBulkDeleteConfirmText(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {selectedRowKeys.size} volunteer{selectedRowKeys.size === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  The selected volunteers will be removed from this marketplace report only.
                  Their volunteer profiles and any data on other marketplaces stay intact.
                </p>
                <p className="text-destructive font-medium">
                  ⚠️ This also soft-deletes their attendance records (check-in/out + hours) for this marketplace. The "Total Attended" figure will drop by up to {selectedRowKeys.size}.
                </p>
                <div className="space-y-1">
                  <p className="text-sm text-foreground">Type <span className="font-mono font-bold">REMOVE</span> to confirm:</p>
                  <input
                    type="text"
                    value={bulkDeleteConfirmText}
                    onChange={(e) => setBulkDeleteConfirmText(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    placeholder="REMOVE"
                    autoFocus
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting} onClick={() => setBulkDeleteConfirmText('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isBulkDeleting || bulkDeleteConfirmText.trim() !== 'REMOVE'}
              onClick={(e) => { e.preventDefault(); handleConfirmBulkDelete(); setBulkDeleteConfirmText(''); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting ? 'Removing…' : 'Remove all'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmSyncOpen} onOpenChange={setConfirmSyncOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send to Surpluss?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send only the <strong>item distribution figures</strong> to Surpluss
              (production). Volunteer and beneficiary data on Surpluss will <strong>not</strong> be
              modified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmSyncOpen(false);
                if (selectedMarketplaceId) syncToSurpluss(selectedMarketplaceId, surplussEnv);
              }}
            >
              Start sync
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={!!qrVolunteer} onOpenChange={(open) => { if (!open) setQrVolunteer(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Volunteer QR Code</DialogTitle>
          </DialogHeader>
          {qrVolunteer && (
            <div className="space-y-4">
              <div className="flex justify-center bg-white p-4 rounded-lg border border-border">
                {qrVolunteer.uniqueId ? (
                  <QRCodeSVG value={qrVolunteer.uniqueId} size={220} level="H" includeMargin />
                ) : (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    No QR card assigned
                  </div>
                )}
              </div>
              <div className="space-y-1.5 text-sm">
                <p className="font-display font-semibold text-base text-foreground">{qrVolunteer.name}</p>
                {qrVolunteer.uniqueId && (
                  <p className="font-mono text-xs text-muted-foreground break-all">{qrVolunteer.uniqueId}</p>
                )}
                <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                  {qrVolunteer.category && (
                    <div><span className="text-muted-foreground">Category:</span> <span className="text-foreground">{qrVolunteer.category}</span></div>
                  )}
                  {qrVolunteer.company && (
                    <div><span className="text-muted-foreground">Company:</span> <span className="text-foreground">{qrVolunteer.company}</span></div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Status:</span>{' '}
                    <span className={`px-2 py-0.5 rounded-full ${
                      qrVolunteer.status === 'checked_in' ? 'bg-emerald-500/10 text-emerald-600' :
                      qrVolunteer.status === 'checked_out' ? 'bg-blue-500/10 text-blue-600' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {qrVolunteer.status === 'checked_in' ? 'Checked In' : qrVolunteer.status === 'checked_out' ? 'Checked Out' : 'Inactive'}
                    </span>
                  </div>
                  {qrVolunteer.hoursWorked > 0 && (
                    <div><span className="text-muted-foreground">Hours:</span> <span className="text-foreground">{qrVolunteer.hoursWorked.toFixed(1)}h</span></div>
                  )}
                  {qrVolunteer.checkedInAt && (
                    <div className="col-span-2"><span className="text-muted-foreground">Checked in:</span> <span className="text-foreground">{new Date(qrVolunteer.checkedInAt).toLocaleString()}</span></div>
                  )}
                  {qrVolunteer.checkedOutAt && (
                    <div className="col-span-2"><span className="text-muted-foreground">Checked out:</span> <span className="text-foreground">{new Date(qrVolunteer.checkedOutAt).toLocaleString()}</span></div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>;
};