import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, Download, Check, AlertCircle, Loader2, Calendar, Filter, Server, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SurplussSyncPanelProps {
  onBack: () => void;
}

interface AllocatedMaterial {
  material_id: number;
  material_title: string;
  amount: number;
}

interface SurplussAllocation {
  id: number;
  marketplace_event_id: number;
  marketplace_event_title: string;
  allocated_at: string;
  allocated_materials: AllocatedMaterial[];
}

interface SyncResult {
  allocation_id: number;
  marketplace_title: string;
  status: 'success' | 'failed';
  marketplace_created?: boolean;
  allocations_created?: number;
  allocations_updated?: number;
  error?: string;
}

export const SurplussSyncPanel = ({ onBack }: SurplussSyncPanelProps) => {
  const [environment, setEnvironment] = useState<'staging' | 'production'>('staging');
  const [eventId, setEventId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [allocations, setAllocations] = useState<SurplussAllocation[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isSyncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);
  const [syncedAllocationIds, setSyncedAllocationIds] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const { toast } = useToast();

  const fetchAllocations = async () => {
    setIsFetching(true);
    setSkippedCount(0);
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-surpluss-allocations', {
        body: {
          environment,
          event_id: eventId ? parseInt(eventId) : undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
          page: currentPage,
          limit: 50
        }
      });

      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch allocations');
      }

      const fetchedAllocations: SurplussAllocation[] = data.data || [];
      
      // Filter out already synced allocations
      const newAllocations = fetchedAllocations.filter(
        allocation => !syncedAllocationIds.has(allocation.id)
      );
      const skipped = fetchedAllocations.length - newAllocations.length;
      setSkippedCount(skipped);

      setAllocations(newAllocations);
      setTotalRecords(data.meta?.total || fetchedAllocations.length || 0);
      
      toast({
        title: 'Allocations Fetched',
        description: skipped > 0 
          ? `Found ${newAllocations.length} new allocations (${skipped} already synced)`
          : `Found ${newAllocations.length} allocations from ${environment}`
      });
    } catch (error) {
      console.error('Error fetching allocations:', error);
      toast({
        title: 'Fetch Failed',
        description: error instanceof Error ? error.message : 'Failed to fetch allocations',
        variant: 'destructive'
      });
    } finally {
      setIsFetching(false);
    }
  };

  const syncAllAllocations = async () => {
    if (allocations.length === 0) {
      toast({
        title: 'No Allocations',
        description: 'Fetch allocations first before syncing',
        variant: 'destructive'
      });
      return;
    }

    setSyncing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-surpluss-allocations', {
        body: { allocations }
      });

      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to sync allocations');
      }

      setSyncResults(data.results || []);
      
      // Track successfully synced allocation IDs
      const successfulIds = (data.results || [])
        .filter((r: SyncResult) => r.status === 'success')
        .map((r: SyncResult) => r.allocation_id);
      
      setSyncedAllocationIds(prev => {
        const newSet = new Set(prev);
        successfulIds.forEach((id: number) => newSet.add(id));
        return newSet;
      });

      // Remove successfully synced allocations from the list
      setAllocations(prev => prev.filter(a => !successfulIds.includes(a.id)));
      
      toast({
        title: 'Sync Complete',
        description: `Created: ${data.summary?.allocations_created || 0}, Updated: ${data.summary?.allocations_updated || 0}, Failed: ${data.summary?.failed || 0}`
      });
    } catch (error) {
      console.error('Error syncing allocations:', error);
      toast({
        title: 'Sync Failed',
        description: error instanceof Error ? error.message : 'Failed to sync allocations',
        variant: 'destructive'
      });
    } finally {
      setSyncing(false);
    }
  };

  const syncSingleAllocation = async (allocation: SurplussAllocation) => {
    setSyncing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-surpluss-allocations', {
        body: { allocations: [allocation] }
      });

      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to sync allocation');
      }

      // Update sync results
      const newResult = data.results?.[0];
      if (newResult) {
        setSyncResults(prev => {
          const existing = prev.findIndex(r => r.allocation_id === newResult.allocation_id);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = newResult;
            return updated;
          }
          return [...prev, newResult];
        });

        // Track synced allocation and remove from list if successful
        if (newResult.status === 'success') {
          setSyncedAllocationIds(prev => {
            const newSet = new Set(prev);
            newSet.add(allocation.id);
            return newSet;
          });
          setAllocations(prev => prev.filter(a => a.id !== allocation.id));
        }
      }
      
      toast({
        title: 'Sync Complete',
        description: `Synced ${allocation.marketplace_event_title}`
      });
    } catch (error) {
      console.error('Error syncing allocation:', error);
      toast({
        title: 'Sync Failed',
        description: error instanceof Error ? error.message : 'Failed to sync allocation',
        variant: 'destructive'
      });
    } finally {
      setSyncing(false);
    }
  };

  const getSyncStatus = (allocationId: number): SyncResult | undefined => {
    return syncResults.find(r => r.allocation_id === allocationId);
  };

  const clearFilters = () => {
    setEventId('');
    setFromDate('');
    setToDate('');
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container max-w-6xl py-4 px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display font-bold text-lg">Surpluss Sync</h1>
              <p className="text-sm text-muted-foreground">Fetch and sync allocations from Surpluss API</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-6 px-4 space-y-6">
        {/* Filters Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Fetch Filters
            </CardTitle>
            <CardDescription>Configure filters to fetch allocation data from Surpluss API</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Environment Selector */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  {environment === 'staging' ? <Server className="w-4 h-4" /> : <Cloud className="w-4 h-4" />}
                  Environment
                </Label>
                <Select value={environment} onValueChange={(v) => setEnvironment(v as 'staging' | 'production')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Event ID */}
              <div className="space-y-2">
                <Label>Event ID (Optional)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 123"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                />
              </div>

              {/* From Date */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  From Date
                </Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>

              {/* To Date */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  To Date
                </Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={fetchAllocations} disabled={isFetching}>
                {isFetching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Fetch Preview
                  </>
                )}
              </Button>
              
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>

              {allocations.length > 0 && (
                <Button 
                  variant="default" 
                  onClick={syncAllAllocations}
                  disabled={isSyncing}
                  className="ml-auto"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Sync All ({allocations.length})
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results Table */}
        {allocations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Fetched Allocations ({allocations.length})</CardTitle>
              <CardDescription>
                Preview from {environment} environment. Click sync to import into database.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marketplace</TableHead>
                      <TableHead>External ID</TableHead>
                      <TableHead>Materials</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Allocated At</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allocations.map((allocation) => {
                      const syncStatus = getSyncStatus(allocation.id);
                      const totalAmount = allocation.allocated_materials?.reduce((sum, m) => sum + m.amount, 0) || 0;
                      
                      return (
                        <TableRow key={allocation.id}>
                          <TableCell className="font-medium">
                            {allocation.marketplace_event_title}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{allocation.marketplace_event_id}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {allocation.allocated_materials?.slice(0, 3).map((m, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {m.material_title}: {m.amount}
                                </Badge>
                              ))}
                              {(allocation.allocated_materials?.length || 0) > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{(allocation.allocated_materials?.length || 0) - 3} more
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{totalAmount.toLocaleString()}</TableCell>
                          <TableCell>
                            {allocation.allocated_at ? new Date(allocation.allocated_at).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell>
                            {syncStatus ? (
                              syncStatus.status === 'success' ? (
                                <Badge variant="default" className="bg-emerald-500">
                                  <Check className="w-3 h-3 mr-1" />
                                  Synced
                                  {syncStatus.marketplace_created && ' (New)'}
                                </Badge>
                              ) : (
                                <Badge variant="destructive">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Failed
                                </Badge>
                              )
                            ) : (
                              <Badge variant="outline">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => syncSingleAllocation(allocation)}
                              disabled={isSyncing}
                            >
                              {isSyncing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                'Sync'
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalRecords > 50 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {allocations.length} of {totalRecords} records
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={allocations.length < 50}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!isFetching && allocations.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12 bg-card rounded-xl border border-border"
          >
            <Download className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Allocations Fetched</h3>
            <p className="text-muted-foreground mb-4">
              Use the filters above to fetch allocation data from Surpluss API
            </p>
            <Button onClick={fetchAllocations} disabled={isFetching}>
              <Download className="w-4 h-4 mr-2" />
              Fetch Allocations
            </Button>
          </motion.div>
        )}

        {/* Sync Summary */}
        {syncResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Sync Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                  <div className="text-2xl font-bold text-emerald-600">
                    {syncResults.filter(r => r.status === 'success').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Successful</div>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {syncResults.filter(r => r.marketplace_created).length}
                  </div>
                  <div className="text-sm text-muted-foreground">New Marketplaces</div>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {syncResults.filter(r => r.status === 'failed').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};
