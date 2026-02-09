import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, Activity, Clock, CheckCircle, XCircle, AlertTriangle, Loader2, Database, Zap, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';

interface SurplussSyncMonitorProps {
  onBack: () => void;
}

interface AuditLogEntry {
  id: string;
  action: string;
  environment: string;
  success: boolean | null;
  response_status: number | null;
  request_payload: any;
  response_body: any;
  created_at: string;
}

interface MarketplaceSyncStatus {
  id: string;
  name: string;
  external_id: number | null;
  last_sync: AuditLogEntry | null;
  allocation_count: number;
  total_allocated: number;
  total_distributed: number;
}

export const SurplussSyncMonitor = ({ onBack }: SurplussSyncMonitorProps) => {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [marketplaceStatuses, setMarketplaceStatuses] = useState<MarketplaceSyncStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncingSingle, setSyncingSingle] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<'production' | 'staging'>('production');
  const { toast } = useToast();

  const loadData = async () => {
    try {
      // Fetch audit logs
      const { data: logs } = await supabase
        .from('surpluss_api_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      setAuditLogs((logs as AuditLogEntry[]) || []);

      // Fetch marketplaces with external_id
      const { data: marketplaces } = await supabase
        .from('marketplace_events')
        .select('id, name, external_id')
        .not('external_id', 'is', null);

      // Fetch allocation stats per marketplace
      const { data: allocations } = await supabase
        .from('marketplace_item_allocations')
        .select('marketplace_id, allocated_quantity, distributed_quantity');

      const statuses: MarketplaceSyncStatus[] = (marketplaces || []).map((mp: any) => {
        const mpAllocs = (allocations || []).filter((a: any) => a.marketplace_id === mp.id);
        const lastSync = (logs || []).find((l: any) => {
          const payload = l.request_payload as any;
          return (
            l.action === 'sync_event_allocations' &&
            (payload?.marketplace_id === mp.id || payload?.external_id === mp.external_id)
          );
        });

        return {
          id: mp.id,
          name: mp.name,
          external_id: mp.external_id,
          last_sync: lastSync as AuditLogEntry | null || null,
          allocation_count: mpAllocs.length,
          total_allocated: mpAllocs.reduce((s: number, a: any) => s + (a.allocated_quantity || 0), 0),
          total_distributed: mpAllocs.reduce((s: number, a: any) => s + (a.distributed_quantity || 0), 0),
        };
      });

      setMarketplaceStatuses(statuses);
    } catch (error) {
      console.error('Error loading sync monitor data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-surpluss-event-allocations', {
        body: { marketplace_id: 'ALL', environment }
      });
      if (error) throw error;
      toast({
        title: 'Sync Complete',
        description: `Synced ${data?.synced_events || 0} events, ${data?.total_synced || 0} total allocations`
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Sync Failed',
        description: error instanceof Error ? error.message : 'Failed to sync',
        variant: 'destructive'
      });
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleSyncSingle = async (marketplaceId: string) => {
    setSyncingSingle(marketplaceId);
    try {
      const { data, error } = await supabase.functions.invoke('sync-surpluss-event-allocations', {
        body: { marketplace_id: marketplaceId, environment }
      });
      if (error) throw error;
      toast({
        title: 'Sync Complete',
        description: `${data?.marketplace_name}: ${data?.synced || 0} allocations synced`
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Sync Failed',
        description: error instanceof Error ? error.message : 'Failed to sync',
        variant: 'destructive'
      });
    } finally {
      setSyncingSingle(null);
    }
  };

  const syncEventLogs = auditLogs.filter(l => l.action === 'sync_event_allocations');
  const lastAutoSync = syncEventLogs.find(l => {
    const payload = l.request_payload as any;
    return payload?.marketplace_id === 'ALL' || payload?.mode === 'ALL';
  });
  const recentSuccessCount = syncEventLogs.filter(l => l.success).length;
  const recentFailCount = syncEventLogs.filter(l => !l.success).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">Surpluss Sync Monitor</h1>
          <p className="text-sm text-muted-foreground">Monitor auto-sync and manual sync status with Surpluss</p>
        </div>
        <Select value={environment} onValueChange={(v: any) => setEnvironment(v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="production">Production</SelectItem>
            <SelectItem value="staging">Staging</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Auto-Sync Status Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl p-4 md:p-6 mb-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Timer className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Scheduled Auto-Sync</h2>
            <p className="text-sm text-muted-foreground">Cron job runs every 15 minutes via pg_cron</p>
          </div>
          <Badge variant="outline" className="ml-auto bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
            <Activity className="w-3 h-3 mr-1" /> Active
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{marketplaceStatuses.length}</p>
            <p className="text-xs text-muted-foreground">Linked Events</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold text-emerald-600">{recentSuccessCount}</p>
            <p className="text-xs text-muted-foreground">Successful Syncs</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold text-red-500">{recentFailCount}</p>
            <p className="text-xs text-muted-foreground">Failed Syncs</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium">
              {lastAutoSync
                ? formatDistanceToNow(new Date(lastAutoSync.created_at), { addSuffix: true })
                : 'No auto-sync yet'}
            </p>
            <p className="text-xs text-muted-foreground">Last Auto-Sync</p>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <Button onClick={handleSyncAll} disabled={isSyncingAll || marketplaceStatuses.length === 0}>
            {isSyncingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
            Sync All Now
          </Button>
        </div>
      </motion.div>

      {/* Marketplace Sync Status */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card border border-border rounded-xl overflow-hidden mb-6"
      >
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Marketplace Sync Status</h2>
          <p className="text-sm text-muted-foreground">Per-event allocation sync overview</p>
        </div>
        {marketplaceStatuses.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No marketplaces linked to Surpluss yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marketplace</TableHead>
                <TableHead className="text-center">External ID</TableHead>
                <TableHead className="text-center">Items</TableHead>
                <TableHead className="text-center">Allocated</TableHead>
                <TableHead className="text-center">Distributed</TableHead>
                <TableHead className="text-center">Last Sync</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {marketplaceStatuses.map(mp => (
                <TableRow key={mp.id}>
                  <TableCell className="font-medium">{mp.name}</TableCell>
                  <TableCell className="text-center font-mono text-sm">{mp.external_id}</TableCell>
                  <TableCell className="text-center">{mp.allocation_count}</TableCell>
                  <TableCell className="text-center">{mp.total_allocated.toLocaleString()}</TableCell>
                  <TableCell className="text-center text-emerald-600">{mp.total_distributed.toLocaleString()}</TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {mp.last_sync
                      ? formatDistanceToNow(new Date(mp.last_sync.created_at), { addSuffix: true })
                      : 'Never'}
                  </TableCell>
                  <TableCell className="text-center">
                    {mp.last_sync ? (
                      mp.last_sync.success ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                          <CheckCircle className="w-3 h-3 mr-1" /> OK
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">
                          <XCircle className="w-3 h-3 mr-1" /> Error
                        </Badge>
                      )
                    ) : (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                        <AlertTriangle className="w-3 h-3 mr-1" /> Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSyncSingle(mp.id)}
                      disabled={syncingSingle === mp.id}
                    >
                      {syncingSingle === mp.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </motion.div>

      {/* Audit Log */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-xl overflow-hidden"
      >
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Sync Audit Log</h2>
          <p className="text-sm text-muted-foreground">Recent sync operations and API calls</p>
        </div>
        {auditLogs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No sync activity recorded yet</p>
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map(log => {
                  const resp = log.response_body as any;
                  const detail = resp?.synced != null
                    ? `${resp.synced} synced, ${resp.created || 0} created, ${resp.updated || 0} updated`
                    : resp?.total_synced != null
                    ? `${resp.synced_events || 0} events, ${resp.total_synced} items`
                    : resp?.error || (log.response_status ? `HTTP ${log.response_status}` : '—');

                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.action}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {log.environment}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {log.success ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                        {detail}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </motion.div>
    </div>
  );
};
