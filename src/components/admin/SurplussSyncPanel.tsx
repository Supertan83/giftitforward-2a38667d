import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, Download, Check, AlertCircle, Loader2, Calendar, Filter, Server, Cloud, Trash2, Eye, EyeOff, Send, FileText, Tags } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSyncedAllocationsWithDistribution, useReportDistribution } from '@/hooks/useSurplussDistributionReporting';
import { DistributionReportsViewer } from './DistributionReportsViewer';

interface SurplussSyncPanelProps {
  onBack: () => void;
}

interface AllocatedMaterial {
  material_id: number;
  material_title: string;
  amount: number;
}

interface SurplussDonation {
  id: number;
  uuid?: string;
  title: string;
  description?: string;
  active?: boolean;
  quantity?: number;
  item_count?: number;
  box_count?: number;
  condition_id?: number;
  image_url?: string;
  created_at?: string;
  updated_at?: string;
  donation_tag?: string | { id: number; name: string; [key: string]: unknown };
  donation_tag_subcategory?: string | { id: number; name: string; [key: string]: unknown };
  company?: {
    id: number;
    name: string;
    main_business?: string;
    sector?: string;
    company_size?: string;
  };
  material_group?: {
    id: number;
    name: string;
    code?: string;
    uom?: string;
  };
  material_group_id?: number;
  type?: {
    offering_type?: string;
    status?: string;
    approve_date?: string;
    count_of_boxes?: number;
  };
  images?: Array<{ url: string; name: string }>;
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
  const [activeTab, setActiveTab] = useState<'sync' | 'report' | 'history'>('sync');
  const [environment, setEnvironment] = useState<'staging' | 'production'>('staging');
  const [eventId, setEventId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [allocations, setAllocations] = useState<SurplussDonation[]>([]);
  const [allFetchedAllocations, setAllFetchedAllocations] = useState<SurplussDonation[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isSyncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);
  const [syncedAllocationIds, setSyncedAllocationIds] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [isLoadingSynced, setIsLoadingSynced] = useState(true);
  const [showClearHistoryDialog, setShowClearHistoryDialog] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [showAlreadySynced, setShowAlreadySynced] = useState(false);
  const [selectedForReport, setSelectedForReport] = useState<Set<number>>(new Set());
  const [isSyncingCategories, setIsSyncingCategories] = useState(false);
  const { toast } = useToast();

  // Hooks for reporting
  const { data: allocationsWithDistribution, isLoading: isLoadingDistribution, refetch: refetchDistribution } = 
    useSyncedAllocationsWithDistribution(environment);
  const { isReporting, reportSingleAllocation, reportMultipleAllocations } = useReportDistribution();

  // Compute displayed allocations based on toggle
  const displayedAllocations = showAlreadySynced ? allFetchedAllocations : allocations;

  // Load already-synced allocation IDs from database on mount and when environment changes
  useEffect(() => {
    const loadSyncedAllocations = async () => {
      setIsLoadingSynced(true);
      try {
        const { data, error } = await supabase
          .from('surpluss_allocation_sync')
          .select('allocation_id')
          .eq('environment', environment);

        if (error) {
          console.error('Error loading synced allocations:', error);
        } else {
          const ids = new Set((data || []).map(r => r.allocation_id));
          setSyncedAllocationIds(ids);
        }
      } catch (err) {
        console.error('Error loading synced allocations:', err);
      } finally {
        setIsLoadingSynced(false);
      }
    };

    loadSyncedAllocations();
  }, [environment]);

  const clearSyncedTracking = () => {
    setSyncedAllocationIds(new Set());
    setSyncResults([]);
    setSkippedCount(0);
    toast({
      title: 'Tracking Cleared',
      description: 'You can now re-sync all allocations'
    });
  };

  const clearSyncHistory = async () => {
    setIsClearingHistory(true);
    try {
      const { error } = await supabase
        .from('surpluss_allocation_sync')
        .delete()
        .eq('environment', environment);

      if (error) throw error;

      // Reset local state
      setSyncedAllocationIds(new Set());
      setSyncResults([]);
      setSkippedCount(0);
      setAllocations([]);
      setAllFetchedAllocations([]);

      toast({
        title: 'Sync History Cleared',
        description: `All sync records for ${environment} environment have been deleted. You can now re-sync allocations.`
      });
    } catch (error) {
      console.error('Error clearing sync history:', error);
      toast({
        title: 'Clear Failed',
        description: error instanceof Error ? error.message : 'Failed to clear sync history',
        variant: 'destructive'
      });
    } finally {
      setIsClearingHistory(false);
      setShowClearHistoryDialog(false);
    }
  };

  const fetchAllocations = async () => {
    setIsFetching(true);
    setSkippedCount(0);
    
    try {
      const pageSize = 100;
      let page = 1;
      let allItems: SurplussDonation[] = [];
      let total = 0;

      // Auto-paginate to fetch ALL items
      while (true) {
        const { data, error } = await supabase.functions.invoke('fetch-surpluss-allocations', {
          body: {
            environment,
            event_id: eventId ? parseInt(eventId) : undefined,
            from_date: fromDate || undefined,
            to_date: toDate || undefined,
            page,
            limit: pageSize
          }
        });

        if (error) throw error;
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch allocations');
        }

        const pageItems: SurplussDonation[] = data.data || [];
        total = data.meta?.total || 0;
        allItems = [...allItems, ...pageItems];

        // Stop if we've fetched all items or got an empty page
        if (pageItems.length < pageSize || allItems.length >= total) {
          break;
        }
        page++;
      }

      // Store all fetched allocations for "show already synced" toggle
      setAllFetchedAllocations(allItems);
      
      // Filter out already synced allocations
      const newAllocations = allItems.filter(
        allocation => !syncedAllocationIds.has(allocation.id)
      );
      const skipped = allItems.length - newAllocations.length;
      setSkippedCount(skipped);

      setAllocations(newAllocations);
      setTotalRecords(total || allItems.length);
      
      toast({
        title: 'Allocations Fetched',
        description: skipped > 0 
          ? `Found ${newAllocations.length} new of ${allItems.length} total (${skipped} already synced)`
          : `Found ${allItems.length} allocations from ${environment}`
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
        body: { allocations, environment }
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

  const syncSingleAllocation = async (allocation: SurplussDonation) => {
    setSyncing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-surpluss-allocations', {
        body: { allocations: [allocation], environment }
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
        description: `Synced ${allocation.title}`
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

  const deleteSyncedItem = async (donation: SurplussDonation) => {
    try {
      // Delete external_item by external_id
      const { data: item } = await supabase
        .from('external_items')
        .select('id')
        .eq('external_id', donation.id)
        .maybeSingle();

      if (item) {
        // Delete SDG goal links first
        await supabase.from('external_item_sdg_goals').delete().eq('item_id', item.id);
        // Delete the item
        await supabase.from('external_items').delete().eq('id', item.id);
      }

      // Delete sync tracking record
      await supabase
        .from('surpluss_allocation_sync')
        .delete()
        .eq('allocation_id', donation.id)
        .eq('environment', environment);

      // Update local state
      setSyncedAllocationIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(donation.id);
        return newSet;
      });
      setSyncResults(prev => prev.filter(r => r.allocation_id !== donation.id));

      toast({
        title: 'Item Deleted',
        description: `Removed synced item "${donation.title}" and its tracking record`
      });
    } catch (error) {
      console.error('Error deleting synced item:', error);
      toast({
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Failed to delete item',
        variant: 'destructive'
      });
    }
  };

  const clearFilters = () => {
    setEventId('');
    setFromDate('');
    setToDate('');
    setCurrentPage(1);
  };

  const syncCategoriesOnly = async () => {
    setIsSyncingCategories(true);
    try {
      // Fetch all items from Surpluss API with auto-pagination
      const pageSize = 100;
      let page = 1;
      let allItems: SurplussDonation[] = [];

      while (true) {
        const { data, error } = await supabase.functions.invoke('fetch-surpluss-allocations', {
          body: { environment, page, limit: pageSize }
        });
        if (error) throw error;
        if (!data.success) throw new Error(data.error || 'Failed to fetch');

        const pageItems: SurplussDonation[] = data.data || [];
        const total = data.meta?.total || 0;
        allItems = [...allItems, ...pageItems];
        if (pageItems.length < pageSize || allItems.length >= total) break;
        page++;
      }

      // For each fetched item, update name/category/subcategory on matching item_types
      let updated = 0;
      for (const donation of allItems) {
        const itemName = donation.title || null;
        
        // donation_tag can be null at top level, but category is inside donation_tag_subcategory.donation_tag
        const rawSubTag = donation.donation_tag_subcategory;
        let categoryName: string | null = null;
        let subcategoryName: string | null = null;
        
        if (typeof rawSubTag === 'object' && rawSubTag !== null) {
          subcategoryName = (rawSubTag as any).name || null;
          // Category comes from the nested donation_tag inside donation_tag_subcategory
          const nestedTag = (rawSubTag as any).donation_tag;
          if (typeof nestedTag === 'object' && nestedTag !== null) {
            categoryName = nestedTag.name || null;
          } else if (typeof nestedTag === 'string') {
            categoryName = nestedTag;
          }
        } else if (typeof rawSubTag === 'string') {
          subcategoryName = rawSubTag;
        }
        
        // Fallback: check top-level donation_tag
        if (!categoryName) {
          const rawTag = donation.donation_tag;
          if (typeof rawTag === 'object' && rawTag !== null) {
            categoryName = (rawTag as any).name || null;
          } else if (typeof rawTag === 'string') {
            categoryName = rawTag;
          }
        }

        const { data: matched } = await supabase
          .from('item_types')
          .select('id')
          .eq('external_material_id', donation.id)
          .maybeSingle();

        if (matched) {
          const updateData: Record<string, unknown> = {
            category: categoryName,
            subcategory: subcategoryName,
            updated_at: new Date().toISOString(),
          };
          if (itemName) updateData.name = itemName;
          
          await supabase.from('item_types').update(updateData).eq('id', matched.id);
          updated++;
        }
      }

      toast({
        title: 'Categories Synced',
        description: `Updated name, category & subcategory for ${updated} of ${allItems.length} items`
      });
    } catch (error) {
      console.error('Error syncing categories:', error);
      toast({
        title: 'Category Sync Failed',
        description: error instanceof Error ? error.message : 'Failed to sync categories',
        variant: 'destructive'
      });
    } finally {
      setIsSyncingCategories(false);
    }
  };

  const handleReportSelected = async () => {
    if (selectedForReport.size === 0 || !allocationsWithDistribution) return;
    
    const toReport = allocationsWithDistribution.filter(a => selectedForReport.has(a.allocation_id));
    try {
      await reportMultipleAllocations(environment, toReport);
      setSelectedForReport(new Set());
    } catch (error) {
      // Error already handled in hook
    }
  };

  const toggleReportSelection = (allocationId: number) => {
    setSelectedForReport(prev => {
      const newSet = new Set(prev);
      if (newSet.has(allocationId)) {
        newSet.delete(allocationId);
      } else {
        newSet.add(allocationId);
      }
      return newSet;
    });
  };

  const selectAllForReport = () => {
    if (!allocationsWithDistribution) return;
    setSelectedForReport(new Set(allocationsWithDistribution.map(a => a.allocation_id)));
  };

  const clearReportSelection = () => {
    setSelectedForReport(new Set());
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container max-w-6xl py-4 px-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display font-bold text-base md:text-lg">Surpluss Sync</h1>
                {syncedAllocationIds.size > 0 && (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs">
                    {syncedAllocationIds.size} synced
                  </Badge>
                )}
              </div>
              <p className="text-xs md:text-sm text-muted-foreground">Sync allocations and report distribution to Surpluss</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Select value={environment} onValueChange={(v) => setEnvironment(v as 'staging' | 'production')}>
                <SelectTrigger className="w-28 sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staging">
                    <span className="flex items-center gap-2">
                      <Server className="w-3 h-3" />
                      Staging
                    </span>
                  </SelectItem>
                  <SelectItem value="production">
                    <span className="flex items-center gap-2">
                      <Cloud className="w-3 h-3" />
                      Production
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'sync' | 'report' | 'history')} className="mt-4">
            <TabsList className="grid w-full max-w-md grid-cols-3 h-auto gap-1">
              <TabsTrigger value="sync" className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Sync
              </TabsTrigger>
              <TabsTrigger value="report" className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                Report
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                History
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      <main className="container max-w-6xl py-6 px-4 space-y-6">
        {/* Sync Tab Content */}
        {activeTab === 'sync' && (
          <>
            {/* Sync Header Actions */}
            <div className="flex flex-wrap justify-end gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={syncCategoriesOnly}
                disabled={isSyncingCategories}
              >
                {isSyncingCategories ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Tags className="w-4 h-4 mr-2" />
                )}
                {isSyncingCategories ? 'Syncing Categories...' : 'Sync Categories Only'}
              </Button>
              {syncedAllocationIds.size > 0 && (
                <Button variant="outline" size="sm" onClick={clearSyncedTracking}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Clear Session
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowClearHistoryDialog(true)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear History
              </Button>
            </div>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        {(allocations.length > 0 || (showAlreadySynced && allFetchedAllocations.length > 0)) && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Fetched Allocations ({displayedAllocations.length})
                    {skippedCount > 0 && !showAlreadySynced && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 dark:border-amber-700">
                        {skippedCount} already synced
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Preview from {environment} environment. Click sync to import into database.
                  </CardDescription>
                </div>
                {allFetchedAllocations.length > allocations.length && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="show-synced" className="text-sm text-muted-foreground flex items-center gap-1.5 cursor-pointer">
                      {showAlreadySynced ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      Show Synced
                    </Label>
                    <Switch
                      id="show-synced"
                      checked={showAlreadySynced}
                      onCheckedChange={setShowAlreadySynced}
                    />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                {/* Total quantity summary */}
                {displayedAllocations.length > 0 && (
                  <div className="flex items-center gap-4 px-4 py-3 bg-muted/30 border-b text-sm font-medium">
                    <span>Total Listings: {displayedAllocations.length}</span>
                    <span className="text-muted-foreground">|</span>
                    <span>Total Quantity: {displayedAllocations.reduce((sum, d) => sum + (d.quantity || d.item_count || 0), 0).toLocaleString()}</span>
                  </div>
                )}
                <Table>
                  <TableHeader>
                     <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Main Category</TableHead>
                        <TableHead>Subcategory</TableHead>
                        <TableHead>Total Items</TableHead>
                        <TableHead>Remaining</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sync</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedAllocations.map((donation) => {
                      const syncStatus = getSyncStatus(donation.id);
                      const isAlreadySynced = syncedAllocationIds.has(donation.id);
                      const totalItems = donation.quantity || donation.item_count || 0;
                      const distributed = donation.type?.count_of_boxes || 0;
                      const remaining = totalItems - distributed;
                      
                      return (
                        <TableRow 
                          key={donation.id}
                          className={isAlreadySynced && showAlreadySynced ? 'bg-muted/50 opacity-75' : ''}
                        >
                          <TableCell className="font-medium">
                            <div>{donation.title}</div>
                            <div className="text-xs text-muted-foreground">ID: {donation.id} · {donation.company?.name || 'No company'}</div>
                          </TableCell>
                          <TableCell>
                            {donation.donation_tag ? (
                              <Badge variant="secondary" className="text-xs">
                                {typeof donation.donation_tag === 'object' ? donation.donation_tag.name : donation.donation_tag}
                              </Badge>
                            ) : donation.material_group ? (
                              <Badge variant="outline" className="text-xs">
                                {donation.material_group.name}
                              </Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {donation.donation_tag_subcategory ? (
                              <Badge variant="outline" className="text-xs">
                                {typeof donation.donation_tag_subcategory === 'object' ? donation.donation_tag_subcategory.name : donation.donation_tag_subcategory}
                              </Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="font-medium">{totalItems.toLocaleString()}</TableCell>
                          <TableCell>
                            <span className={remaining <= 0 ? 'text-destructive font-medium' : 'text-emerald-600 dark:text-emerald-400 font-medium'}>
                              {remaining.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={donation.type?.status === 'APPROVED' ? 'default' : 'secondary'} className={donation.type?.status === 'APPROVED' ? 'bg-emerald-500' : ''}>
                              {donation.type?.status || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {isAlreadySynced && showAlreadySynced ? (
                              <Badge variant="secondary" className="bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                                <Check className="w-3 h-3 mr-1" />
                                Already Synced
                              </Badge>
                            ) : syncStatus ? (
                              syncStatus.status === 'success' ? (
                                <Badge variant="default" className="bg-emerald-500">
                                  <Check className="w-3 h-3 mr-1" />
                                  Synced
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
                            <div className="flex items-center justify-end gap-1">
                              {isAlreadySynced && showAlreadySynced ? (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => deleteSyncedItem(donation)}
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Delete
                                </Button>
                              ) : syncStatus?.status === 'success' ? (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => deleteSyncedItem(donation)}
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Delete
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => syncSingleAllocation(donation)}
                                  disabled={isSyncing}
                                >
                                  {isSyncing ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    'Sync'
                                  )}
                                </Button>
                              )}
                            </div>
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
                    Showing {displayedAllocations.length} of {totalRecords} records
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
            {!isFetching && allocations.length === 0 && allFetchedAllocations.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-12 bg-card rounded-xl border border-border"
              >
                <Download className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Donations Fetched</h3>
                <p className="text-muted-foreground mb-4">
                  Use the filters above to fetch donation data from Surpluss API
                </p>
                <Button onClick={fetchAllocations} disabled={isFetching}>
                  <Download className="w-4 h-4 mr-2" />
                  Fetch Donations
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
          </>
        )}

        {/* Report Tab Content */}
        {activeTab === 'report' && (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Send className="w-5 h-5" />
                      Report Distribution to Surpluss
                    </CardTitle>
                    <CardDescription>
                      Send distribution data for synced allocations back to the {environment} environment
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetchDistribution()}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                    {selectedForReport.size > 0 && (
                      <Button
                        onClick={handleReportSelected}
                        disabled={isReporting}
                      >
                        {isReporting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Reporting...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Report Selected ({selectedForReport.size})
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingDistribution ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : allocationsWithDistribution && allocationsWithDistribution.length > 0 ? (
                  <>
                    {/* Selection Controls */}
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-muted-foreground">
                        {allocationsWithDistribution.length} synced allocations available for reporting
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={selectAllForReport}>
                          Select All
                        </Button>
                        {selectedForReport.size > 0 && (
                          <Button variant="outline" size="sm" onClick={clearReportSelection}>
                            Clear Selection
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">
                              <input
                                type="checkbox"
                                checked={selectedForReport.size === allocationsWithDistribution.length}
                                onChange={(e) => e.target.checked ? selectAllForReport() : clearReportSelection()}
                                className="rounded border-input"
                              />
                            </TableHead>
                            <TableHead>Allocation ID</TableHead>
                            <TableHead>Marketplace</TableHead>
                            <TableHead>Materials</TableHead>
                            <TableHead>Distributed</TableHead>
                            <TableHead>Allocated</TableHead>
                            <TableHead>Progress</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allocationsWithDistribution.map((alloc) => {
                            const progress = alloc.total_allocated > 0 
                              ? Math.round((alloc.total_distributed / alloc.total_allocated) * 100) 
                              : 0;
                            
                            return (
                              <TableRow key={alloc.allocation_id}>
                                <TableCell>
                                  <input
                                    type="checkbox"
                                    checked={selectedForReport.has(alloc.allocation_id)}
                                    onChange={() => toggleReportSelection(alloc.allocation_id)}
                                    className="rounded border-input"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{alloc.allocation_id}</Badge>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {alloc.marketplace_name}
                                  <div className="text-xs text-muted-foreground">
                                    ID: {alloc.marketplace_external_id}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{alloc.materials.length} items</Badge>
                                </TableCell>
                                <TableCell className="font-mono">
                                  {alloc.total_distributed.toLocaleString()}
                                </TableCell>
                                <TableCell className="font-mono">
                                  {alloc.total_allocated.toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                                        style={{ width: `${Math.min(progress, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-muted-foreground">{progress}%</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => reportSingleAllocation(environment, alloc)}
                                    disabled={isReporting}
                                  >
                                    {isReporting ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <>
                                        <Send className="w-4 h-4 mr-1" />
                                        Report
                                      </>
                                    )}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <Send className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No Synced Allocations</h3>
                    <p className="text-muted-foreground mb-4">
                      Sync allocations from the Surpluss API first before reporting distribution data
                    </p>
                    <Button variant="outline" onClick={() => setActiveTab('sync')}>
                      <Download className="w-4 h-4 mr-2" />
                      Go to Sync Tab
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* History Tab Content */}
        {activeTab === 'history' && (
          <DistributionReportsViewer />
        )}
      </main>

      {/* Clear Sync History Confirmation Dialog */}
      <AlertDialog open={showClearHistoryDialog} onOpenChange={setShowClearHistoryDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Sync History</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all sync tracking records for the <strong>{environment}</strong> environment. 
              This means all allocations from this environment can be re-synced, which may create duplicate data if not managed carefully.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearingHistory}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={clearSyncHistory}
              disabled={isClearingHistory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearingHistory ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear History
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
