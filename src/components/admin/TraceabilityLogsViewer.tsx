import { useState } from 'react';
import { ArrowLeft, Search, Filter, Clock, X, Download } from 'lucide-react';
import { exportTraceabilityLogsToExcel } from '@/lib/exportTraceabilityLogs';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAllTraceabilityLogs, useTraceabilityLogsByCard, type TraceabilityLog } from '@/hooks/useTraceabilityLogs';
import { useMarketplaces } from '@/hooks/useSupabaseData';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

interface TraceabilityLogsViewerProps {
  onBack: () => void;
}

const ACTION_TYPES = [
  'allocated',
  'distributed',
  'returned_to_warehouse',
  're-allocated',
  'archived',
  'reset',
  'synced_to_inventory',
  'consumed',
  'edited',
  'removed',
];

const actionBadgeClass = (action: string): string => {
  switch (action) {
    case 'allocated':
    case 're-allocated':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'distributed':
    case 'consumed':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'returned_to_warehouse':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'archived':
    case 'reset':
    case 'removed':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'edited':
      return 'bg-violet-100 text-violet-800 border-violet-200';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

export const TraceabilityLogsViewer = ({ onBack }: TraceabilityLogsViewerProps) => {
  const [marketplaceFilter, setMarketplaceFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [cardSearch, setCardSearch] = useState('');
  const [appliedCardSearch, setAppliedCardSearch] = useState('');
  const [timelineCardId, setTimelineCardId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const { data: marketplaces = [] } = useMarketplaces();

  const handleExport = async () => {
    setExporting(true);
    try {
      const count = await exportTraceabilityLogsToExcel({
        marketplaceId: marketplaceFilter || undefined,
        actionType: actionFilter || undefined,
        cardUniqueId: appliedCardSearch || undefined,
      });
      toast({ title: 'Export complete', description: `${count} log entries exported.` });
    } catch (e: any) {
      toast({ title: 'Export failed', description: e?.message ?? 'Unknown error', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const { data: logs = [], isLoading } = useAllTraceabilityLogs({
    marketplaceId: marketplaceFilter || undefined,
    actionType: actionFilter || undefined,
    cardUniqueId: appliedCardSearch || undefined,
  });

  const { data: timelineLogs = [], isLoading: timelineLoading } = useTraceabilityLogsByCard(
    timelineCardId || undefined
  );

  const handleCardSearch = () => {
    setAppliedCardSearch(cardSearch.trim());
  };

  const clearFilters = () => {
    setMarketplaceFilter('');
    setActionFilter('');
    setCardSearch('');
    setAppliedCardSearch('');
    setTimelineCardId(null);
  };

  const hasFilters = marketplaceFilter || actionFilter || appliedCardSearch;

  if (timelineCardId) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setTimelineCardId(null)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Card Timeline</h1>
            <p className="text-sm text-muted-foreground font-mono">{timelineCardId}</p>
          </div>
        </div>

        {timelineLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : timelineLogs.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No logs found for this card</p>
        ) : (
          <div className="relative pl-8 space-y-0">
            {timelineLogs.map((log, i) => (
              <div key={log.id} className="relative pb-8">
                {i < timelineLogs.length - 1 && (
                  <div className="absolute left-[-20px] top-6 bottom-0 w-px bg-border" />
                )}
                <div className="absolute left-[-24px] top-1.5 w-2 h-2 rounded-full bg-primary ring-4 ring-background" />
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={actionBadgeClass(log.action_type)}>{log.action_type}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
                    </span>
                  </div>
                  <p className="text-sm mb-2">{log.description}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>Marketplace: <strong>{log.marketplace_name}</strong></span>
                    <span>Qty: {log.quantity_before} → {log.quantity_after}</span>
                    {log.performed_by_email && <span>By: {log.performed_by_email}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Traceability Logs</h1>
          <p className="text-sm text-muted-foreground">Full audit trail of allocation lifecycle events</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters</span>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto h-7 text-xs">
              <X className="w-3 h-3 mr-1" /> Clear
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Select value={marketplaceFilter} onValueChange={setMarketplaceFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Marketplaces" />
            </SelectTrigger>
            <SelectContent>
              {marketplaces.map(mp => (
                <SelectItem key={mp.id} value={mp.id}>{mp.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map(a => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Input
              placeholder="Search QR Card ID..."
              value={cardSearch}
              onChange={(e) => setCardSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCardSearch()}
            />
            <Button size="icon" variant="outline" onClick={handleCardSearch}>
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No traceability logs found</p>
            <p className="text-sm">Logs will appear as allocation actions are performed</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Marketplace</TableHead>
                  <TableHead>QR Card</TableHead>
                  <TableHead className="text-right">Qty Change</TableHead>
                  <TableHead>Performed By</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), 'MMM d, HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Badge className={actionBadgeClass(log.action_type)}>{log.action_type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{log.marketplace_name}</TableCell>
                    <TableCell>
                      {log.card_unique_id ? (
                        <button
                          className="font-mono text-xs text-primary hover:underline"
                          onClick={() => setTimelineCardId(log.card_unique_id!)}
                        >
                          {log.card_unique_id}
                        </button>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {log.quantity_before} → {log.quantity_after}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.performed_by_email || '—'}
                    </TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{log.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {logs.length > 0 && (
          <div className="p-3 border-t border-border text-center text-xs text-muted-foreground">
            Showing {logs.length} log entries (most recent 500)
          </div>
        )}
      </div>
    </div>
  );
};
