import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, Activity, Clock, CheckCircle, XCircle, AlertTriangle, Loader2, Database, Zap, Timer, ChevronDown, ChevronUp, Package, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
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
interface AllocationDetail {
  id: string;
  marketplace_id: string;
  marketplace_name: string;
  item_type_id: string;
  item_name: string;
  item_category: string | null;
  external_material_id: number | null;
  allocated_quantity: number;
  distributed_quantity: number;
  updated_at: string;
}
const SYNC_INTERVAL_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 1, label: '1 min' },
  { value: 3, label: '3 min' },
  { value: 5, label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
];

export const SurplussSyncMonitor = ({
  onBack
}: SurplussSyncMonitorProps) => {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [marketplaceStatuses, setMarketplaceStatuses] = useState<MarketplaceSyncStatus[]>([]);
  const [allocationDetails, setAllocationDetails] = useState<AllocationDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [isFetchingMarketplaces, setIsFetchingMarketplaces] = useState(false);
  const [isSyncingDonations, setIsSyncingDonations] = useState(false);
  const [syncingSingle, setSyncingSingle] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<'production' | 'staging'>('production');
  const [showAllocations, setShowAllocations] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [lastAutoSyncTime, setLastAutoSyncTime] = useState<Date | null>(null);
  const [syncInterval, setSyncInterval] = useState(5);
  const [isUpdatingInterval, setIsUpdatingInterval] = useState(false);
  const {
    toast
  } = useToast();
  const loadData = async () => {
    try {
      // Fetch audit logs
      const {
        data: logs
      } = await supabase.from('surpluss_api_audit_log').select('*').order('created_at', {
        ascending: false
      }).limit(50);
      setAuditLogs(logs as AuditLogEntry[] || []);

      // Try to detect current sync interval from the most recent schedule update audit
      const scheduleLog = (logs || []).find((l: any) => l.action === 'sync_schedule_updated');
      if (scheduleLog) {
        const payload = (scheduleLog as any).request_payload;
        if (payload?.interval_minutes !== undefined && payload?.interval_minutes !== null) {
          setSyncInterval(payload.interval_minutes);
        }
      }

      // Fetch marketplaces with external_id
      const {
        data: marketplaces
      } = await supabase.from('marketplace_events').select('id, name, external_id').not('external_id', 'is', null);

      // Fetch allocation stats per marketplace
      const {
        data: allocations
      } = await supabase.from('marketplace_item_allocations').select('id, marketplace_id, item_type_id, allocated_quantity, distributed_quantity, updated_at');

      // Fetch item types for allocation details
      const {
        data: itemTypes
      } = await supabase.from('item_types').select('id, name, category, external_material_id');
      const itemTypeMap = new Map((itemTypes || []).map((it: any) => [it.id, it]));
      const marketplaceMap = new Map((marketplaces || []).map((mp: any) => [mp.id, mp]));

      // Build full allocation details
      const details: AllocationDetail[] = (allocations || []).map((a: any) => {
        const item = itemTypeMap.get(a.item_type_id);
        const mp = marketplaceMap.get(a.marketplace_id);
        return {
          id: a.id,
          marketplace_id: a.marketplace_id,
          marketplace_name: mp?.name || 'Unknown',
          item_type_id: a.item_type_id,
          item_name: item?.name || 'Unknown',
          item_category: item?.category || null,
          external_material_id: item?.external_material_id || null,
          allocated_quantity: a.allocated_quantity,
          distributed_quantity: a.distributed_quantity,
          updated_at: a.updated_at
        };
      });
      setAllocationDetails(details);
      const statuses: MarketplaceSyncStatus[] = (marketplaces || []).map((mp: any) => {
        const mpAllocs = (allocations || []).filter((a: any) => a.marketplace_id === mp.id);
        const lastSync = (logs || []).find((l: any) => {
          const payload = l.request_payload as any;
          return l.action === 'sync_event_allocations' && (payload?.marketplace_id === mp.id || payload?.external_id === mp.external_id);
        });
        return {
          id: mp.id,
          name: mp.name,
          external_id: mp.external_id,
          last_sync: lastSync as AuditLogEntry | null || null,
          allocation_count: mpAllocs.length,
          total_allocated: mpAllocs.reduce((s: number, a: any) => s + (a.allocated_quantity || 0), 0),
          total_distributed: mpAllocs.reduce((s: number, a: any) => s + (a.distributed_quantity || 0), 0)
        };
      });
      setMarketplaceStatuses(statuses);

      // Determine last auto-sync time
      const lastAuto = (logs || []).find((l: any) => {
        const payload = l.request_payload as any;
        return l.action === 'sync_event_allocations' && (payload?.marketplace_id === 'ALL' || payload?.mode === 'ALL');
      });
      if (lastAuto) {
        setLastAutoSyncTime(new Date((lastAuto as AuditLogEntry).created_at));
      }
    } catch (error) {
      console.error('Error loading sync monitor data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Countdown timer based on clock schedule
  useEffect(() => {
    if (syncInterval === 0) {
      setCountdown('Disabled');
      return;
    }
    const updateCountdown = () => {
      const now = new Date();
      const mins = now.getMinutes();
      const secs = now.getSeconds();
      const currentSlotMins = mins % syncInterval;
      const remainingMins = syncInterval - 1 - currentSlotMins;
      const remainingSecs = 60 - secs;
      const adjustedMins = remainingSecs === 60 ? remainingMins + 1 : remainingMins;
      const adjustedSecs = remainingSecs === 60 ? 0 : remainingSecs;
      setCountdown(`${adjustedMins}m ${adjustedSecs.toString().padStart(2, '0')}s`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [syncInterval]);
  useEffect(() => {
    loadData();
  }, []);
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };
  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('sync-surpluss-event-allocations', {
        body: {
          marketplace_id: 'ALL',
          environment
        }
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
      const {
        data,
        error
      } = await supabase.functions.invoke('sync-surpluss-event-allocations', {
        body: {
          marketplace_id: marketplaceId,
          environment
        }
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
  const handleFetchAllMarketplaces = async () => {
    setIsFetchingMarketplaces(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-surpluss-marketplaces', {
        body: { environment }
      });
      if (error) throw error;
      toast({
        title: 'Marketplace Fetch Complete',
        description: `Found ${data?.total_surpluss_events || 0} events on Surpluss. ${data?.newly_created || 0} new marketplace(s) created, ${data?.already_existing || 0} already existed.`
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Fetch Failed',
        description: error instanceof Error ? error.message : 'Failed to fetch marketplaces',
        variant: 'destructive'
      });
    } finally {
      setIsFetchingMarketplaces(false);
    }
  };
  // Sanitize donation to only fields needed by sync-surpluss-allocations
  const sanitizeDonation = (d: any) => ({
    id: d.id,
    uuid: d.uuid || null,
    title: d.title || '',
    description: d.description || null,
    active: d.active ?? true,
    quantity: d.quantity ?? 0,
    item_count: d.item_count ?? 0,
    box_count: d.box_count ?? null,
    condition_id: d.condition_id ?? null,
    image_url: d.image_url || null,
    price: d.price ?? null,
    per: d.per || null,
    frequency: d.frequency || null,
    created_at: d.created_at || null,
    updated_at: d.updated_at || null,
    donation_tag: d.donation_tag || null,
    donation_tag_subcategory: d.donation_tag_subcategory || null,
    material_group_id: d.material_group_id ?? null,
    third_level_subcategory_id: d.third_level_subcategory_id ?? null,
    type: d.type || null,
    sdg_goals: Array.isArray(d.sdg_goals) ? d.sdg_goals.map((s: any) => ({
      id: s.id, name: s.name, code: s.code || null, description: s.description || null, image_url: s.image_url || null
    })) : null,
    company: d.company ? {
      id: d.company.id, uuid: d.company.uuid || null, name: d.company.name || '',
      main_business: d.company.main_business || null, sector: d.company.sector || null,
      company_size: d.company.company_size || null, designation: d.company.designation || null,
      image_url: d.company.image_url || null, about_info: d.company.about_info || null,
      currency: d.company.currency || 'AED', company_license_number: d.company.company_license_number || null,
      website_url: d.company.website_url || null, is_parent_company: d.company.is_parent_company || false,
    } : null,
    address: d.address ? {
      id: d.address.id, address: d.address.address || null, city: d.address.city || null,
      country: d.address.country || null, state: d.address.state || null, zip_code: d.address.zip_code || null,
      location_latitude: d.address.location_latitude || null, location_longitude: d.address.location_longitude || null,
      is_primary: d.address.is_primary || false,
    } : null,
    material_group: d.material_group ? {
      id: d.material_group.id, name: d.material_group.name || '', code: d.material_group.code || null, uom: d.material_group.uom || null,
    } : null,
  });

  const syncBatch = async (chunk: any[], environment: string): Promise<{ created: number; updated: number; failed: number; ok: boolean }> => {
    try {
      const { data: syncResult, error: syncError } = await supabase.functions.invoke('sync-surpluss-allocations', {
        body: { allocations: chunk, environment }
      });
      if (syncError) return { created: 0, updated: 0, failed: chunk.length, ok: false };
      if (!syncResult?.success) return { created: 0, updated: 0, failed: chunk.length, ok: false };
      const s = syncResult.summary;
      return { created: s?.allocations_created || 0, updated: s?.allocations_updated || 0, failed: s?.failed || 0, ok: true };
    } catch {
      return { created: 0, updated: 0, failed: chunk.length, ok: false };
    }
  };

  const handleSyncDonations = async () => {
    setIsSyncingDonations(true);
    try {
      // Step 1: Fetch all donations from Surpluss API (paginate)
      let allDonations: any[] = [];
      let page = 1;
      const limit = 50;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase.functions.invoke('fetch-surpluss-allocations', {
          body: { environment, page, limit }
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Failed to fetch donations');

        const items = data.data || [];
        allDonations = [...allDonations, ...items];
        hasMore = items.length === limit && allDonations.length < (data.meta?.total || 0);
        page++;
      }

      if (allDonations.length === 0) {
        toast({ title: 'No Donations Found', description: 'The Surpluss API returned no donations to sync.' });
        return;
      }

      // Sanitize payloads to reduce size
      const sanitized = allDonations.map(sanitizeDonation);

      // Step 2: Sync to local DB in batches of 10 with retry + single-item fallback
      const CHUNK_SIZE = 10;
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalFailed = 0;
      let failedBatches = 0;
      let usedFallback = false;
      const totalBatches = Math.ceil(sanitized.length / CHUNK_SIZE);

      for (let i = 0; i < sanitized.length; i += CHUNK_SIZE) {
        const batchIndex = Math.floor(i / CHUNK_SIZE) + 1;
        const chunk = sanitized.slice(i, i + CHUNK_SIZE);

        let result = await syncBatch(chunk, environment);

        // Retry once if failed
        if (!result.ok) {
          console.warn(`Batch ${batchIndex}/${totalBatches} failed (${chunk.length} items, first ID: ${chunk[0]?.id}). Retrying...`);
          result = await syncBatch(chunk, environment);
        }

        // If still failing, fall back to single-item processing
        if (!result.ok) {
          console.warn(`Batch ${batchIndex} retry failed. Falling back to single-item sync.`);
          usedFallback = true;
          failedBatches++;
          let batchCreated = 0, batchUpdated = 0, batchFailed = 0;
          for (const item of chunk) {
            const single = await syncBatch([item], environment);
            batchCreated += single.created;
            batchUpdated += single.updated;
            batchFailed += single.failed;
          }
          totalCreated += batchCreated;
          totalUpdated += batchUpdated;
          totalFailed += batchFailed;
        } else {
          totalCreated += result.created;
          totalUpdated += result.updated;
          totalFailed += result.failed;
        }

        // Progress toast every 5 batches
        if (batchIndex % 5 === 0 && batchIndex < totalBatches) {
          toast({ title: 'Sync in progress...', description: `Batch ${batchIndex}/${totalBatches} complete` });
        }
      }

      const hasFailures = totalFailed > 0 || failedBatches > 0;
      toast({
        title: hasFailures ? 'Donations Sync Partial' : 'Donations Sync Complete',
        description: `${totalCreated} created, ${totalUpdated} updated, ${totalFailed} failed (${sanitized.length} total, ${totalBatches} batches${usedFallback ? ', used single-item fallback' : ''})`,
        variant: hasFailures ? 'destructive' : 'default',
      });
      loadData();
    } catch (error) {
      console.error('Donations sync error:', error);
      toast({
        title: 'Donations Sync Failed',
        description: error instanceof Error ? error.message : 'Failed to sync donations',
        variant: 'destructive'
      });
    } finally {
      setIsSyncingDonations(false);
    }
  };

  const syncEventLogs = auditLogs.filter(l => l.action === 'sync_event_allocations');
  const recentSuccessCount = syncEventLogs.filter(l => l.success).length;
  const recentFailCount = syncEventLogs.filter(l => !l.success).length;

  // Compute countdown progress based on clock (0-100)
  const countdownProgress = (() => {
    const now = new Date();
    const mins = now.getMinutes();
    const secs = now.getSeconds();
    if (syncInterval === 0) return 0;
    const elapsed = mins % syncInterval * 60 + secs;
    const total = syncInterval * 60;
    return elapsed / total * 100;
  })();

  const handleChangeInterval = async (newInterval: number) => {
    setIsUpdatingInterval(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-sync-schedule', {
        body: { interval_minutes: newInterval }
      });
      if (error) throw error;
      setSyncInterval(newInterval);
      toast({
        title: newInterval === 0 ? 'Auto-Sync Disabled' : 'Schedule Updated',
        description: newInterval === 0 
          ? 'Auto-sync has been turned off' 
          : `Auto-sync now runs every ${newInterval} minute(s)`
      });
    } catch (error) {
      toast({
        title: 'Failed to Update Schedule',
        description: error instanceof Error ? error.message : 'Failed to update',
        variant: 'destructive'
      });
    } finally {
      setIsUpdatingInterval(false);
    }
  };
  if (isLoading) {
    return <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>;
  }
  return <div className="min-h-screen bg-background p-4 md:p-6 max-w-6xl mx-auto">
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
      <motion.div initial={{
      opacity: 0,
      y: 10
    }} animate={{
      opacity: 1,
      y: 0
    }} className="bg-card border border-border rounded-xl p-4 md:p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Timer className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Scheduled Auto-Sync</h2>
            <p className="text-sm text-muted-foreground">
              {syncInterval === 0 ? 'Auto-sync is currently disabled' : `Allocations, Volunteers & Beneficiaries — every ${syncInterval} min`}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Interval:</span>
            <Select 
              value={String(syncInterval)} 
              onValueChange={(v) => handleChangeInterval(Number(v))}
              disabled={isUpdatingInterval}
            >
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYNC_INTERVAL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isUpdatingInterval && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            <Badge variant="outline" className={syncInterval === 0 ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"}>
              <Activity className="w-3 h-3 mr-1" /> {syncInterval === 0 ? 'Disabled' : 'Active'}
            </Badge>
          </div>
        </div>

        {/* Countdown Timer */}
        <div className="bg-muted/50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Next Auto-Sync</span>
            </div>
            <span className="text-2xl font-mono font-bold text-primary">{countdown}</span>
          </div>
          <Progress value={countdownProgress} className="h-2" />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-muted-foreground">
              Last recorded sync: {lastAutoSyncTime ? formatDistanceToNow(lastAutoSyncTime, {
              addSuffix: true
            }) : 'No syncs recorded yet'}
            </span>
            <span className="text-xs text-muted-foreground">{syncInterval === 0 ? 'Schedule: disabled' : `Schedule: every ${syncInterval} min`}</span>
          </div>
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
              {lastAutoSyncTime ? formatDistanceToNow(lastAutoSyncTime, {
              addSuffix: true
            }) : 'No auto-sync yet'}
            </p>
            <p className="text-xs text-muted-foreground">Last Auto-Sync</p>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <Button onClick={handleSyncAll} disabled={isSyncingAll || marketplaceStatuses.length === 0}>
            {isSyncingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
            Sync All Now
          </Button>
          <Button variant="outline" onClick={handleFetchAllMarketplaces} disabled={isFetchingMarketplaces}>
            {isFetchingMarketplaces ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
           Fetch All Marketplaces from Surpluss
          </Button>
          <Button variant="outline" onClick={handleSyncDonations} disabled={isSyncingDonations}>
            {isSyncingDonations ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Package className="w-4 h-4 mr-2" />}
            Sync Donations (Fix Stock Totals)
          </Button>
        </div>
      </motion.div>

      {/* Marketplace Sync Status */}
      <motion.div initial={{
      opacity: 0,
      y: 10
    }} animate={{
      opacity: 1,
      y: 0
    }} transition={{
      delay: 0.1
    }} className="bg-card border border-border rounded-xl overflow-hidden mb-6">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Marketplace Sync Status</h2>
          <p className="text-sm text-muted-foreground">Per-event allocation sync overview</p>
        </div>
        {marketplaceStatuses.length === 0 ? <div className="p-8 text-center text-muted-foreground">
            <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No marketplaces linked to Surpluss yet</p>
          </div> : <Table>
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
              {marketplaceStatuses.map(mp => <TableRow key={mp.id}>
                  <TableCell className="font-medium">{mp.name}</TableCell>
                  <TableCell className="text-center font-mono text-sm">{mp.external_id}</TableCell>
                  <TableCell className="text-center">{mp.allocation_count}</TableCell>
                  <TableCell className="text-center">{mp.total_allocated.toLocaleString()}</TableCell>
                  <TableCell className="text-center text-emerald-600">{mp.total_distributed.toLocaleString()}</TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {mp.last_sync ? formatDistanceToNow(new Date(mp.last_sync.created_at), {
                addSuffix: true
              }) : 'Never'}
                  </TableCell>
                  <TableCell className="text-center">
                    {mp.last_sync ? mp.last_sync.success ? <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                          <CheckCircle className="w-3 h-3 mr-1" /> OK
                        </Badge> : <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">
                          <XCircle className="w-3 h-3 mr-1" /> Error
                        </Badge> : <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                        <AlertTriangle className="w-3 h-3 mr-1" /> Pending
                      </Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => handleSyncSingle(mp.id)} disabled={syncingSingle === mp.id}>
                      {syncingSingle === mp.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    </Button>
                  </TableCell>
                </TableRow>)}
            </TableBody>
          </Table>}
      </motion.div>

      {/* Full Allocation Details */}
      <motion.div initial={{
      opacity: 0,
      y: 10
    }} animate={{
      opacity: 1,
      y: 0
    }} transition={{
      delay: 0.15
    }} className="bg-card border border-border rounded-xl overflow-hidden mb-6">
        <Collapsible open={showAllocations} onOpenChange={setShowAllocations}>
          <CollapsibleTrigger className="w-full p-4 border-b border-border flex items-center justify-between hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <div className="text-left">
                <h2 className="font-semibold">All Allocation Details</h2>
                <p className="text-sm text-muted-foreground">{allocationDetails.length} total allocations across all marketplaces</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{allocationDetails.length}</Badge>
              {showAllocations ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {allocationDetails.length === 0 ? <div className="p-8 text-center text-muted-foreground">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No allocations found</p>
              </div> : <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marketplace</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-center">Material ID</TableHead>
                      <TableHead className="text-center">Allocated</TableHead>
                      <TableHead className="text-center">Distributed</TableHead>
                      <TableHead className="text-center">Remaining</TableHead>
                      <TableHead className="text-center">% Used</TableHead>
                      <TableHead>Last Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allocationDetails.sort((a, b) => a.marketplace_name.localeCompare(b.marketplace_name) || a.item_name.localeCompare(b.item_name)).map(alloc => {
                  const remaining = alloc.allocated_quantity - alloc.distributed_quantity;
                  const pct = alloc.allocated_quantity > 0 ? Math.round(alloc.distributed_quantity / alloc.allocated_quantity * 100) : 0;
                  return <TableRow key={alloc.id}>
                            <TableCell className="font-medium text-sm">{alloc.marketplace_name}</TableCell>
                            <TableCell className="text-sm">{alloc.item_name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{alloc.item_category || '—'}</TableCell>
                            <TableCell className="text-center font-mono text-xs">{alloc.external_material_id || '—'}</TableCell>
                            <TableCell className="text-center font-medium">{alloc.allocated_quantity.toLocaleString()}</TableCell>
                            <TableCell className="text-center text-emerald-600 font-medium">{alloc.distributed_quantity.toLocaleString()}</TableCell>
                            <TableCell className="text-center">
                              <span className={remaining <= 0 ? 'text-red-500 font-bold' : remaining < 10 ? 'text-amber-500 font-medium' : 'text-foreground'}>
                                {remaining.toLocaleString()}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center gap-2">
                                <Progress value={pct} className="h-1.5 flex-1" />
                                <span className="text-xs text-muted-foreground w-8">{pct}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(alloc.updated_at), 'MMM d, HH:mm')}
                            </TableCell>
                          </TableRow>;
                })}
                  </TableBody>
                </Table>
              </div>}
          </CollapsibleContent>
        </Collapsible>
      </motion.div>

      {/* Audit Log */}
      <motion.div initial={{
      opacity: 0,
      y: 10
    }} animate={{
      opacity: 1,
      y: 0
    }} transition={{
      delay: 0.2
    }} className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Sync Audit Log</h2>
          <p className="text-sm text-muted-foreground">Recent sync operations and API calls</p>
        </div>
        {auditLogs.length === 0 ? <div className="p-8 text-center text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No sync activity recorded yet</p>
          </div> : <div className="max-h-[400px] overflow-y-auto">
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
              const detail = resp?.synced != null ? `${resp.synced} synced, ${resp.created || 0} created, ${resp.updated || 0} updated` : resp?.total_synced != null ? `${resp.synced_events || 0} events, ${resp.total_synced} items` : resp?.error || (log.response_status ? `HTTP ${log.response_status}` : '—');
              return <TableRow key={log.id}>
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
                        {log.success ? <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" /> : <XCircle className="w-4 h-4 text-red-500 mx-auto" />}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                        {detail}
                      </TableCell>
                    </TableRow>;
            })}
              </TableBody>
            </Table>
          </div>}
      </motion.div>
    </div>;
};