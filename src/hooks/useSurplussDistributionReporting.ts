import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SyncedAllocation {
  id: string;
  allocation_id: number;
  environment: string;
  marketplace_external_id: number | null;
  synced_at: string;
}

interface MarketplaceWithDistribution {
  id: string;
  name: string;
  external_id: number | null;
  event_date: string | null;
  allocations: Array<{
    id: string;
    item_type_id: string;
    item_name: string;
    external_material_id: number | null;
    allocated_quantity: number;
    distributed_quantity: number;
  }>;
}

interface AllocationForReport {
  allocation_id: number;
  marketplace_external_id: number;
  marketplace_name: string;
  materials: Array<{
    material_id: number;
    distributed: number;
    allocated: number;
  }>;
  total_distributed: number;
  total_allocated: number;
}

export const useSyncedAllocationsWithDistribution = (environment: 'staging' | 'production') => {
  const { toast } = useToast();

  return useQuery({
    queryKey: ['synced_allocations_with_distribution', environment],
    queryFn: async (): Promise<AllocationForReport[]> => {
      // Get synced allocations for the environment
      const { data: syncedAllocations, error: syncError } = await supabase
        .from('surpluss_allocation_sync')
        .select('allocation_id, marketplace_external_id, environment')
        .eq('environment', environment);

      if (syncError) throw syncError;
      if (!syncedAllocations || syncedAllocations.length === 0) return [];

      // Get unique marketplace external IDs
      const marketplaceExternalIds = [...new Set(
        syncedAllocations
          .map(a => a.marketplace_external_id)
          .filter((id): id is number => id !== null)
      )];

      if (marketplaceExternalIds.length === 0) return [];

      // Get marketplaces with their allocations
      const { data: marketplaces, error: mpError } = await supabase
        .from('marketplace_events')
        .select(`
          id,
          name,
          external_id,
          event_date,
          marketplace_item_allocations (
            id,
            item_type_id,
            allocated_quantity,
            distributed_quantity,
            item_types (
              name,
              external_material_id
            )
          )
        `)
        .in('external_id', marketplaceExternalIds);

      if (mpError) throw mpError;

      // Build allocation reports
      const reportsMap = new Map<number, AllocationForReport>();

      syncedAllocations.forEach(sync => {
        if (!sync.marketplace_external_id) return;

        const marketplace = marketplaces?.find(m => m.external_id === sync.marketplace_external_id);
        if (!marketplace) return;

        const allocations = marketplace.marketplace_item_allocations || [];
        
        const materials = allocations
          .filter((a: any) => a.item_types?.external_material_id)
          .map((a: any) => ({
            material_id: a.item_types.external_material_id,
            distributed: a.distributed_quantity,
            allocated: a.allocated_quantity,
          }));

        const totalDistributed = allocations.reduce((sum: number, a: any) => sum + a.distributed_quantity, 0);
        const totalAllocated = allocations.reduce((sum: number, a: any) => sum + a.allocated_quantity, 0);

        reportsMap.set(sync.allocation_id, {
          allocation_id: sync.allocation_id,
          marketplace_external_id: sync.marketplace_external_id,
          marketplace_name: marketplace.name,
          materials,
          total_distributed: totalDistributed,
          total_allocated: totalAllocated,
        });
      });

      return Array.from(reportsMap.values());
    },
  });
};

export const useReportDistribution = () => {
  const [isReporting, setIsReporting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const reportSingleAllocation = async (
    environment: 'staging' | 'production',
    allocation: AllocationForReport
  ) => {
    setIsReporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('report-surpluss-distribution', {
        body: {
          environment,
          allocations: [{
            allocation_id: allocation.allocation_id,
            marketplace_external_id: allocation.marketplace_external_id,
            materials: allocation.materials,
          }],
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Report Sent',
          description: `Successfully reported allocation ${allocation.allocation_id}`,
        });
        queryClient.invalidateQueries({ queryKey: ['distribution_reports'] });
      } else {
        throw new Error(data.error || 'Failed to report distribution');
      }

      return data;
    } catch (error) {
      toast({
        title: 'Report Failed',
        description: error instanceof Error ? error.message : 'Failed to send report',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsReporting(false);
    }
  };

  const reportMultipleAllocations = async (
    environment: 'staging' | 'production',
    allocations: AllocationForReport[]
  ) => {
    setIsReporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('report-surpluss-distribution', {
        body: {
          environment,
          allocations: allocations.map(a => ({
            allocation_id: a.allocation_id,
            marketplace_external_id: a.marketplace_external_id,
            materials: a.materials,
          })),
        },
      });

      if (error) throw error;

      toast({
        title: 'Reports Sent',
        description: `Reported ${data.reported_count || allocations.length} allocations. ${data.failed_count || 0} failed.`,
      });

      queryClient.invalidateQueries({ queryKey: ['distribution_reports'] });
      return data;
    } catch (error) {
      toast({
        title: 'Reporting Failed',
        description: error instanceof Error ? error.message : 'Failed to send reports',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsReporting(false);
    }
  };

  return {
    isReporting,
    reportSingleAllocation,
    reportMultipleAllocations,
  };
};
