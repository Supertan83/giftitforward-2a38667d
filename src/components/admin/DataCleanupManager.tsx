import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Trash2, RefreshCw, Loader2, AlertTriangle, CheckCircle2, Eye, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DataCleanupManagerProps {
  onBack: () => void;
}

interface TableColumnConfig {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
}

const TABLE_COLUMNS: Record<string, TableColumnConfig[]> = {
  qr_cards: [
    { key: 'unique_id', label: 'Card ID' },
    { key: 'status', label: 'Status' },
    { key: 'credit_balance', label: 'Balance' },
    { key: 'total_items_collected', label: 'Items' },
    { key: 'nationality', label: 'Nationality' },
    { key: 'gender', label: 'Gender' },
    { key: 'created_at', label: 'Created', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
  ],
  transactions: [
    { key: 'type', label: 'Type' },
    { key: 'item_type', label: 'Item' },
    { key: 'credit_change', label: 'Change' },
    { key: 'card_id', label: 'Card', render: (v: string) => v?.slice(0, 8) + '...' },
    { key: 'timestamp', label: 'Time', render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
  ],
  archived_card_data: [
    { key: 'unique_id', label: 'Card ID' },
    { key: 'credit_balance', label: 'Balance' },
    { key: 'nationality', label: 'Nationality' },
    { key: 'gender', label: 'Gender' },
    { key: 'archived_at', label: 'Archived', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
  ],
  volunteer_qr_cards: [
    { key: 'unique_id', label: 'Card ID' },
    { key: 'status', label: 'Status' },
    { key: 'assigned_zone', label: 'Zone' },
    { key: 'checked_in_at', label: 'Check In', render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    { key: 'total_hours_worked', label: 'Hours' },
    { key: 'created_at', label: 'Created', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
  ],
  volunteer_attendance: [
    { key: 'volunteer_card_id', label: 'Card', render: (v: string) => v?.slice(0, 8) + '...' },
    { key: 'check_in_time', label: 'Check In', render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    { key: 'check_out_time', label: 'Check Out', render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    { key: 'hours_worked', label: 'Hours' },
  ],
  pending_volunteers: [
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'email', label: 'Email' },
    { key: 'status', label: 'Status' },
    { key: 'source', label: 'Source' },
    { key: 'events_list', label: 'Events' },
    { key: 'training_completed', label: 'Trained', render: (v: boolean) => v ? '✅' : '❌' },
    { key: 'created_at', label: 'Created', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
  ],
  marketplace_item_allocations: [
    { key: 'marketplace_id', label: 'Marketplace', render: (v: string) => v?.slice(0, 8) + '...' },
    { key: 'item_type_id', label: 'Item', render: (v: string) => v?.slice(0, 8) + '...' },
    { key: 'allocated_quantity', label: 'Allocated' },
    { key: 'distributed_quantity', label: 'Distributed' },
    { key: 'created_at', label: 'Created', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
  ],
  item_types: [
    { key: 'name', label: 'Name' },
    { key: 'icon', label: 'Icon' },
    { key: 'category', label: 'Category' },
    { key: 'total_stock', label: 'Stock' },
    { key: 'distributed', label: 'Distributed' },
    { key: 'allocated_to_marketplace', label: 'Allocated' },
  ],
  marketplace_manual_counts: [
    { key: 'marketplace_id', label: 'Marketplace', render: (v: string) => v?.slice(0, 8) + '...' },
    { key: 'actual_distributed', label: 'Distributed' },
    { key: 'actual_remaining', label: 'Remaining' },
    { key: 'notes', label: 'Notes' },
    { key: 'counted_at', label: 'Counted', render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
  ],
  warehouse_returns: [
    { key: 'quantity_returned', label: 'Qty' },
    { key: 'return_batch_code', label: 'Batch' },
    { key: 'notes', label: 'Notes' },
    { key: 'returned_at', label: 'Returned', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
  ],
  allocation_traceability_logs: [
    { key: 'action_type', label: 'Action' },
    { key: 'marketplace_name', label: 'Marketplace' },
    { key: 'description', label: 'Description' },
    { key: 'quantity_before', label: 'Before' },
    { key: 'quantity_after', label: 'After' },
    { key: 'performed_by_email', label: 'By' },
    { key: 'created_at', label: 'Date', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
  ],
  volunteer_surveys: [
    { key: 'volunteer_name', label: 'Name' },
    { key: 'volunteer_email', label: 'Email' },
    { key: 'experience_word', label: 'Experience' },
    { key: 'would_volunteer_again', label: 'Again?', render: (v: boolean) => v ? '✅' : '❌' },
    { key: 'completed_at', label: 'Completed', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
  ],
  external_survey_responses: [
    { key: 'volunteer_name', label: 'Name' },
    { key: 'volunteer_email', label: 'Email' },
    { key: 'company_name', label: 'Company' },
    { key: 'experience_word', label: 'Experience' },
    { key: 'would_volunteer_again', label: 'Again?', render: (v: boolean) => v ? '✅' : '❌' },
    { key: 'completed_at', label: 'Completed', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
  ],
  email_send_logs: [
    { key: 'recipient_email', label: 'Recipient' },
    { key: 'email_type', label: 'Type' },
    { key: 'provider', label: 'Provider' },
    { key: 'success', label: 'Success', render: (v: boolean) => v ? '✅' : '❌' },
    { key: 'error_message', label: 'Error' },
    { key: 'created_at', label: 'Sent', render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
  ],
};

const TABLE_CONFIG = [
  {
    id: 'beneficiary', title: 'Beneficiary Data', icon: '👥',
    tables: [
      { key: 'qr_cards', label: 'QR Cards', description: 'Reset cards to inactive (cards preserved)' },
      { key: 'transactions', label: 'Transactions', description: 'Clear transaction history' },
      { key: 'archived_card_data', label: 'Archived Card Data', description: 'Clear archived records' },
    ],
  },
  {
    id: 'volunteer', title: 'Volunteer Data', icon: '🙋',
    tables: [
      { key: 'volunteer_qr_cards', label: 'Volunteer QR Cards', description: 'Clear volunteer cards' },
      { key: 'volunteer_attendance', label: 'Volunteer Attendance', description: 'Clear attendance logs' },
      { key: 'pending_volunteers', label: 'Pending Volunteers', description: 'Clear registration queue' },
    ],
  },
  {
    id: 'marketplace', title: 'Marketplace & Inventory', icon: '🏪',
    tables: [
      { key: 'marketplace_item_allocations', label: 'Marketplace Allocations', description: 'Clear item allocations' },
      { key: 'item_types', label: 'Item Type Counters', description: 'Reset counters to 0 (keeps definitions)' },
      { key: 'marketplace_manual_counts', label: 'Manual Counts', description: 'Clear count entries' },
      { key: 'warehouse_returns', label: 'Warehouse Returns', description: 'Clear return records' },
      { key: 'allocation_traceability_logs', label: 'Traceability Logs', description: 'Clear audit trail' },
    ],
  },
  {
    id: 'survey', title: 'Survey Data', icon: '📋',
    tables: [
      { key: 'volunteer_surveys', label: 'Volunteer Surveys', description: 'Clear survey responses' },
      { key: 'external_survey_responses', label: 'External Surveys', description: 'Clear external responses' },
    ],
  },
  {
    id: 'comms', title: 'Communication Logs', icon: '📧',
    tables: [
      { key: 'email_send_logs', label: 'Email Send Logs', description: 'Clear delivery logs' },
    ],
  },
];

export const DataCleanupManager: React.FC<DataCleanupManagerProps> = ({ onBack }) => {
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [countsLoading, setCountsLoading] = useState(true);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkConfirmInput, setBulkConfirmInput] = useState('');
  const [cleaning, setCleaning] = useState(false);
  const [lastResults, setLastResults] = useState<Record<string, { action: string; count: number }> | null>(null);

  // Browser dialog state
  const [browseTable, setBrowseTable] = useState<string | null>(null);
  const [browseLabel, setBrowseLabel] = useState('');
  const [browseRecords, setBrowseRecords] = useState<any[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseSearch, setBrowseSearch] = useState('');
  const [browseSelected, setBrowseSelected] = useState<Set<string>>(new Set());
  const [browseDeleting, setBrowseDeleting] = useState(false);
  const [browseDeleteConfirm, setBrowseDeleteConfirm] = useState(false);
  const [browseDeleteInput, setBrowseDeleteInput] = useState('');

  const { toast } = useToast();

  const fetchCounts = useCallback(async () => {
    setCountsLoading(true);
    const allTables = TABLE_CONFIG.flatMap(c => c.tables);
    const results = await Promise.all(
      allTables.map(async (t) => {
        try {
          const { count, error } = await supabase
            .from(t.key as any)
            .select('*', { count: 'exact', head: true });
          return { key: t.key, count: error ? null : (count ?? 0) };
        } catch {
          return { key: t.key, count: null };
        }
      })
    );
    setCounts(Object.fromEntries(results.map(r => [r.key, r.count])));
    setCountsLoading(false);
  }, []);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  // Browse records
  const openBrowser = async (tableKey: string, label: string) => {
    setBrowseTable(tableKey);
    setBrowseLabel(label);
    setBrowseSearch('');
    setBrowseSelected(new Set());
    setBrowseLoading(true);
    setBrowseRecords([]);

    try {
      const { data, error } = await supabase
        .from(tableKey as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      setBrowseRecords(data || []);
    } catch (err) {
      toast({ title: 'Failed to load records', description: String(err), variant: 'destructive' });
    } finally {
      setBrowseLoading(false);
    }
  };

  const closeBrowser = () => {
    setBrowseTable(null);
    setBrowseRecords([]);
    setBrowseSelected(new Set());
    setBrowseDeleteConfirm(false);
    setBrowseDeleteInput('');
  };

  const filteredRecords = browseRecords.filter(row => {
    if (!browseSearch) return true;
    const q = browseSearch.toLowerCase();
    return Object.values(row).some(v =>
      v !== null && v !== undefined && String(v).toLowerCase().includes(q)
    );
  });

  const toggleBrowseRow = (id: string) => {
    setBrowseSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllBrowse = () => {
    if (browseSelected.size === filteredRecords.length) {
      setBrowseSelected(new Set());
    } else {
      setBrowseSelected(new Set(filteredRecords.map(r => r.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (!browseTable || browseDeleteInput !== 'DELETE') return;
    setBrowseDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-data', {
        body: { mode: 'delete_selected', table: browseTable, ids: Array.from(browseSelected) },
      });
      if (error) throw error;
      const count = data?.results?.[browseTable]?.count || 0;
      toast({ title: 'Records Removed', description: `${count} records processed from ${browseLabel}` });
      setBrowseRecords(prev => prev.filter(r => !browseSelected.has(r.id)));
      setBrowseSelected(new Set());
      setBrowseDeleteConfirm(false);
      setBrowseDeleteInput('');
      fetchCounts();
    } catch (err) {
      toast({ title: 'Delete Failed', description: String(err), variant: 'destructive' });
    } finally {
      setBrowseDeleting(false);
    }
  };

  // Bulk cleanup
  const toggleBulk = (key: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleBulkCategory = (catId: string) => {
    const cat = TABLE_CONFIG.find(c => c.id === catId);
    if (!cat) return;
    const keys = cat.tables.map(t => t.key);
    const allIn = keys.every(k => bulkSelected.has(k));
    setBulkSelected(prev => {
      const next = new Set(prev);
      keys.forEach(k => allIn ? next.delete(k) : next.add(k));
      return next;
    });
  };

  const handleBulkCleanup = async () => {
    if (bulkConfirmInput !== 'CLEAN') return;
    setCleaning(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-data', {
        body: { tables: Array.from(bulkSelected) },
      });
      if (error) throw error;
      setLastResults(data.results);
      const total = Object.values(data.results as Record<string, { count: number }>).reduce((s, r) => s + r.count, 0);
      toast({ title: 'Cleanup Complete', description: `${total.toLocaleString()} records processed` });
      setBulkSelected(new Set());
      setShowBulkConfirm(false);
      setBulkConfirmInput('');
      fetchCounts();
    } catch (err) {
      toast({ title: 'Cleanup Failed', description: String(err), variant: 'destructive' });
    } finally {
      setCleaning(false);
    }
  };

  const columns = browseTable ? (TABLE_COLUMNS[browseTable] || []) : [];
  const isResetTable = browseTable === 'qr_cards' || browseTable === 'item_types';
  const actionWord = isResetTable ? 'reset' : 'delete';

  return (
    <div className="py-4 md:py-6 px-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-display font-bold flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Data Cleanup Manager
          </h1>
          <p className="text-sm text-muted-foreground">Browse records and selectively clear data before live events</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCounts} disabled={countsLoading}>
          {countsLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Refresh
        </Button>
      </div>

      {/* Last results */}
      {lastResults && (
        <Card className="mb-4 border-border bg-muted/30">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="font-medium">Last cleanup:</span>
              {Object.entries(lastResults).map(([t, r]) => (
                <Badge key={t} variant="secondary" className="text-xs">{t}: {r.count} {r.action}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Categories */}
      <div className="space-y-4">
        {TABLE_CONFIG.map(cat => {
          const catKeys = cat.tables.map(t => t.key);
          const allSelected = catKeys.every(k => bulkSelected.has(k));
          const someSelected = catKeys.some(k => bulkSelected.has(k)) && !allSelected;
          const catTotal = cat.tables.reduce((s, t) => s + (counts[t.key] || 0), 0);

          return (
            <Card key={cat.id}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={allSelected}
                    ref={(el) => { if (el) (el as any).indeterminate = someSelected; }}
                    onCheckedChange={() => toggleBulkCategory(cat.id)}
                  />
                  <span className="text-lg">{cat.icon}</span>
                  <CardTitle className="text-sm font-semibold">{cat.title}</CardTitle>
                  <Badge variant="outline" className="ml-auto text-xs">
                    {catTotal.toLocaleString()} records
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-3">
                <div className="space-y-1">
                  {cat.tables.map(t => {
                    const c = counts[t.key];
                    return (
                      <div key={t.key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <Checkbox
                          checked={bulkSelected.has(t.key)}
                          onCheckedChange={() => toggleBulk(t.key)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{t.label}</span>
                            {countsLoading ? (
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                            ) : (
                              <Badge variant={c && c > 0 ? 'default' : 'secondary'} className="text-xs">
                                {c?.toLocaleString() ?? '?'}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{t.description}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => openBrowser(t.key, t.label)}
                          disabled={c === 0}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Browse
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bulk action bar */}
      {bulkSelected.size > 0 && (
        <div className="sticky bottom-4 mt-6">
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <div className="text-sm">
                <span className="font-semibold">{bulkSelected.size}</span> tables ·{' '}
                <span className="font-semibold text-destructive">
                  {Array.from(bulkSelected).reduce((s, k) => s + (counts[k] || 0), 0).toLocaleString()}
                </span> records
              </div>
              <Button variant="destructive" size="sm" onClick={() => setShowBulkConfirm(true)}>
                <Trash2 className="h-4 w-4 mr-1" /> Clean All Selected
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bulk confirm dialog */}
      <Dialog open={showBulkConfirm} onOpenChange={setShowBulkConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Confirm Bulk Cleanup
            </DialogTitle>
            <DialogDescription>This will permanently remove or reset ALL data from selected tables.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 max-h-48 overflow-y-auto text-sm">
            {Array.from(bulkSelected).map(k => {
              const t = TABLE_CONFIG.flatMap(c => c.tables).find(t => t.key === k);
              return (
                <div key={k} className="flex justify-between py-1 px-2 rounded bg-muted/50">
                  <span>{t?.label || k}</span>
                  <span className="text-muted-foreground">{(counts[k] || 0).toLocaleString()}</span>
                </div>
              );
            })}
          </div>
          <div className="space-y-2">
            <p className="text-sm">Type <span className="font-bold text-destructive">CLEAN</span> to confirm:</p>
            <Input value={bulkConfirmInput} onChange={e => setBulkConfirmInput(e.target.value)} placeholder="CLEAN" className="font-mono" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowBulkConfirm(false); setBulkConfirmInput(''); }}>Cancel</Button>
            <Button variant="destructive" disabled={bulkConfirmInput !== 'CLEAN' || cleaning} onClick={handleBulkCleanup}>
              {cleaning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              {cleaning ? 'Cleaning...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record browser dialog */}
      <Dialog open={!!browseTable} onOpenChange={(open) => { if (!open) closeBrowser(); }}>
        <DialogContent className="max-w-[95vw] w-[900px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {browseLabel}
              <Badge variant="outline" className="ml-2">{filteredRecords.length} records</Badge>
              {browseSelected.size > 0 && (
                <Badge variant="destructive" className="ml-1">{browseSelected.size} selected</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {isResetTable
                ? 'Select records to reset (data is cleared but records are preserved)'
                : 'Select records to permanently delete'}
            </DialogDescription>
          </DialogHeader>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={browseSearch}
              onChange={e => setBrowseSearch(e.target.value)}
              placeholder="Search across all fields..."
              className="pl-9 pr-8"
            />
            {browseSearch && (
              <button onClick={() => setBrowseSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          {/* Table */}
          <ScrollArea className="border rounded-md" style={{ height: 'min(50vh, 400px)' }}>
            {browseLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No records found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filteredRecords.length > 0 && browseSelected.size === filteredRecords.length}
                        onCheckedChange={toggleAllBrowse}
                      />
                    </TableHead>
                    {columns.map(col => (
                      <TableHead key={col.key} className="text-xs whitespace-nowrap">{col.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map(row => (
                    <TableRow
                      key={row.id}
                      className={browseSelected.has(row.id) ? 'bg-destructive/5' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={browseSelected.has(row.id)}
                          onCheckedChange={() => toggleBrowseRow(row.id)}
                        />
                      </TableCell>
                      {columns.map(col => (
                        <TableCell key={col.key} className="text-xs max-w-[200px] truncate">
                          {col.render
                            ? col.render(row[col.key], row)
                            : (row[col.key] != null ? String(row[col.key]) : '-')}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Showing up to 500 records · {isResetTable ? 'Reset clears data but keeps records' : 'Delete permanently removes records'}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={closeBrowser}>Close</Button>
              {browseSelected.size > 0 && (
                <Button variant="destructive" onClick={() => setBrowseDeleteConfirm(true)}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  {isResetTable ? 'Reset' : 'Delete'} {browseSelected.size} Selected
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete selected confirm dialog */}
      <Dialog open={browseDeleteConfirm} onOpenChange={setBrowseDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm {isResetTable ? 'Reset' : 'Deletion'}
            </DialogTitle>
            <DialogDescription>
              You are about to {actionWord} <strong>{browseSelected.size}</strong> records from <strong>{browseLabel}</strong>.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm">Type <span className="font-bold text-destructive">DELETE</span> to confirm:</p>
            <Input
              value={browseDeleteInput}
              onChange={e => setBrowseDeleteInput(e.target.value)}
              placeholder="DELETE"
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBrowseDeleteConfirm(false); setBrowseDeleteInput(''); }}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={browseDeleteInput !== 'DELETE' || browseDeleting}
              onClick={handleDeleteSelected}
            >
              {browseDeleting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              {browseDeleting ? 'Processing...' : `Confirm ${isResetTable ? 'Reset' : 'Delete'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info footer */}
      <div className="mt-6 p-3 rounded-lg bg-muted/50 border border-border">
        <p className="text-xs text-muted-foreground">
          <strong>Protected:</strong> Marketplace events, item type definitions, and user accounts are never deleted.
          QR cards are reset (not deleted). Item type counters are reset to 0 (definitions preserved).
        </p>
      </div>
    </div>
  );
};
