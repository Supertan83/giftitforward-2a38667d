import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { mapDatabaseError, SafeError } from '@/lib/errorUtils';

export interface MarketplaceAllocation {
  id: string;
  marketplaceId: string;
  itemTypeId: string;
  itemName?: string;
  itemIcon?: string;
  externalMaterialId?: number | null;
  allocatedQuantity: number;
  distributedQuantity: number;
}

export interface MarketplaceReport {
  marketplace: {
    id: string;
    name: string;
    location: string | null;
    eventDate: string | null;
    status: string;
    outreachPartner: string | null;
  };
  beneficiaries: {
    total: number;
    byGender: Record<string, number>;
    byMaritalStatus: Record<string, number>;
    byNationality: Record<string, number>;
    avgChildrenCount: number;
  };
  items: {
    totalAllocated: number;
    totalDistributed: number;
    totalRemaining: number;
    byItemType: Array<{
      itemId: string;
      itemName: string;
      itemIcon: string;
      category: string | null;
      subcategory: string | null;
      externalMaterialId: number | null;
      allocated: number;
      distributed: number;
      remaining: number;
    }>;
    byCategory: Record<string, { allocated: number; distributed: number; remaining: number }>;
  };
  volunteers?: {
    total: number;
    totalHours: number;
  };
}

// Fetch allocations for a specific marketplace
export const useMarketplaceAllocations = (marketplaceId?: string) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['marketplace_allocations', marketplaceId],
    queryFn: async (): Promise<MarketplaceAllocation[]> => {
      let queryBuilder = supabase
        .from('marketplace_item_allocations')
        .select(`
          *,
          item_types (name, icon, external_material_id)
        `)
        .order('created_at', { ascending: false });

      if (marketplaceId) {
        queryBuilder = queryBuilder.eq('marketplace_id', marketplaceId);
      }

      const { data, error } = await queryBuilder;

      if (error) throw new SafeError(mapDatabaseError(error), error);

      return (data || []).map((allocation: any) => ({
        id: allocation.id,
        marketplaceId: allocation.marketplace_id,
        itemTypeId: allocation.item_type_id,
        itemName: allocation.item_types?.name,
        itemIcon: allocation.item_types?.icon,
        externalMaterialId: allocation.item_types?.external_material_id,
        allocatedQuantity: allocation.allocated_quantity,
        distributedQuantity: allocation.distributed_quantity,
      }));
    },
    enabled: true,
  });

  useEffect(() => {
    const channel = supabase
      .channel('marketplace_allocations_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_item_allocations' }, () => {
        queryClient.invalidateQueries({ queryKey: ['marketplace_allocations'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
};

// Allocation operations
export const useAllocationOperations = () => {
  const queryClient = useQueryClient();

  const allocateToMarketplace = useMutation({
    mutationFn: async ({ 
      marketplaceId, 
      itemTypeId, 
      quantity 
    }: { 
      marketplaceId: string; 
      itemTypeId: string; 
      quantity: number 
    }) => {
      // Check if allocation already exists
      const { data: existing } = await supabase
        .from('marketplace_item_allocations')
        .select('*')
        .eq('marketplace_id', marketplaceId)
        .eq('item_type_id', itemTypeId)
        .maybeSingle();

      if (existing) {
        // Update existing allocation
        const { error } = await supabase
          .from('marketplace_item_allocations')
          .update({ 
            allocated_quantity: existing.allocated_quantity + quantity 
          })
          .eq('id', existing.id);

        if (error) throw new SafeError(mapDatabaseError(error), error);
      } else {
        // Create new allocation
        const { error } = await supabase
          .from('marketplace_item_allocations')
          .insert({
            marketplace_id: marketplaceId,
            item_type_id: itemTypeId,
            allocated_quantity: quantity,
            distributed_quantity: 0,
          });

        if (error) throw new SafeError(mapDatabaseError(error), error);
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace_allocations'] });
      queryClient.invalidateQueries({ queryKey: ['item_types'] });
    }
  });

  const updateAllocation = useMutation({
    mutationFn: async ({ 
      allocationId, 
      allocatedQuantity 
    }: { 
      allocationId: string; 
      allocatedQuantity: number 
    }) => {
      const { error } = await supabase
        .from('marketplace_item_allocations')
        .update({ allocated_quantity: allocatedQuantity })
        .eq('id', allocationId);

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace_allocations'] });
    }
  });

  const deleteAllocation = useMutation({
    mutationFn: async (allocationId: string) => {
      const { error } = await supabase
        .from('marketplace_item_allocations')
        .delete()
        .eq('id', allocationId);

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace_allocations'] });
    }
  });

  // Increment distributed count when item is given out (by allocation ID) using RPC
  const incrementDistributed = useMutation({
    mutationFn: async (allocationId: string) => {
      const { data, error } = await supabase
        .rpc('increment_marketplace_allocation_distributed', {
          _allocation_id: allocationId
        });

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace_allocations'] });
    }
  });

  // Decrement distributed count when item is returned (by allocation ID) using RPC
  const decrementDistributed = useMutation({
    mutationFn: async (allocationId: string) => {
      const { data, error } = await supabase
        .rpc('decrement_marketplace_allocation_distributed', {
          _allocation_id: allocationId
        });

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace_allocations'] });
    }
  });

  // Direct update of allocated and distributed quantities
  const updateAllocationQuantities = useMutation({
    mutationFn: async ({ 
      allocationId, 
      allocatedQuantity,
      distributedQuantity
    }: { 
      allocationId: string; 
      allocatedQuantity?: number;
      distributedQuantity?: number;
    }) => {
      const updateData: Record<string, number> = {};
      if (allocatedQuantity !== undefined) updateData.allocated_quantity = allocatedQuantity;
      if (distributedQuantity !== undefined) updateData.distributed_quantity = distributedQuantity;
      
      const { error } = await supabase
        .from('marketplace_item_allocations')
        .update(updateData)
        .eq('id', allocationId);

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace_allocations'] });
    }
  });

  return {
    allocateToMarketplace,
    updateAllocation,
    deleteAllocation,
    incrementDistributed,
    decrementDistributed,
    updateAllocationQuantities,
  };
};

// Generate comprehensive report for a marketplace
export const useMarketplaceReport = (marketplaceId?: string) => {
  return useQuery({
    queryKey: ['marketplace_report', marketplaceId],
    queryFn: async (): Promise<MarketplaceReport | null> => {
      if (!marketplaceId) return null;

      // Fetch marketplace info
      const { data: marketplace, error: mpError } = await supabase
        .from('marketplace_events')
        .select('*')
        .eq('id', marketplaceId)
        .single();

      if (mpError) throw new SafeError(mapDatabaseError(mpError), mpError);

      // Fetch beneficiaries (archived + active) for this marketplace
      const { data: archivedCards } = await supabase
        .from('archived_card_data')
        .select('*')
        .eq('marketplace_id', marketplaceId);

      const { data: activeCards } = await supabase
        .from('qr_cards')
        .select('*')
        .eq('marketplace_id', marketplaceId);

      const allBeneficiaries = [
        ...(archivedCards || []),
        ...(activeCards || []),
      ];

      // Calculate demographics
      const genderCounts: Record<string, number> = {};
      const maritalCounts: Record<string, number> = {};
      const nationalityCounts: Record<string, number> = {};
      let totalChildren = 0;
      let childrenCardCount = 0;

      allBeneficiaries.forEach(card => {
        if (card.gender) {
          genderCounts[card.gender] = (genderCounts[card.gender] || 0) + 1;
        }
        if (card.marital_status) {
          maritalCounts[card.marital_status] = (maritalCounts[card.marital_status] || 0) + 1;
        }
        if (card.nationality) {
          nationalityCounts[card.nationality] = (nationalityCounts[card.nationality] || 0) + 1;
        }
        if (card.children_count !== null && card.children_count !== undefined) {
          totalChildren += card.children_count;
          childrenCardCount++;
        }
      });

      // Fetch allocations for this marketplace
      const { data: allocations } = await supabase
        .from('marketplace_item_allocations')
        .select(`
          *,
          item_types (id, name, icon, category, subcategory, external_material_id)
        `)
        .eq('marketplace_id', marketplaceId);

      const itemsByType = (allocations || []).map((alloc: any) => ({
        itemId: alloc.item_type_id,
        itemName: alloc.item_types?.name || 'Unknown',
        itemIcon: alloc.item_types?.icon || '📦',
        category: alloc.item_types?.category || null,
        subcategory: alloc.item_types?.subcategory || null,
        externalMaterialId: alloc.item_types?.external_material_id || null,
        allocated: alloc.allocated_quantity,
        distributed: alloc.distributed_quantity,
        remaining: alloc.allocated_quantity - alloc.distributed_quantity,
      }));

      // Calculate by category
      const byCategory: Record<string, { allocated: number; distributed: number; remaining: number }> = {};
      itemsByType.forEach(item => {
        const cat = item.category || 'Uncategorized';
        if (!byCategory[cat]) {
          byCategory[cat] = { allocated: 0, distributed: 0, remaining: 0 };
        }
        byCategory[cat].allocated += item.allocated;
        byCategory[cat].distributed += item.distributed;
        byCategory[cat].remaining += item.remaining;
      });

      const totalAllocated = itemsByType.reduce((sum, item) => sum + item.allocated, 0);
      const totalDistributed = itemsByType.reduce((sum, item) => sum + item.distributed, 0);

      // Fetch volunteer data
      const { data: volunteerCards } = await supabase
        .from('volunteer_qr_cards')
        .select('*')
        .eq('marketplace_id', marketplaceId);

      const totalVolunteers = volunteerCards?.length || 0;
      const totalHours = volunteerCards?.reduce((sum, v) => sum + (Number(v.total_hours_worked) || 0), 0) || 0;

      return {
        marketplace: {
          id: marketplace.id,
          name: marketplace.name,
          location: marketplace.location,
          eventDate: marketplace.event_date,
          status: marketplace.status,
          outreachPartner: marketplace.outreach_partner,
        },
        beneficiaries: {
          total: allBeneficiaries.length,
          byGender: genderCounts,
          byMaritalStatus: maritalCounts,
          byNationality: nationalityCounts,
          avgChildrenCount: childrenCardCount > 0 ? totalChildren / childrenCardCount : 0,
        },
        items: {
          totalAllocated,
          totalDistributed,
          totalRemaining: totalAllocated - totalDistributed,
          byItemType: itemsByType,
          byCategory,
        },
        volunteers: {
          total: totalVolunteers,
          totalHours,
        },
      };
    },
    enabled: !!marketplaceId,
  });
};

// Fetch summary reports for all marketplaces
export const useAllMarketplaceReports = () => {
  return useQuery({
    queryKey: ['all_marketplace_reports'],
    queryFn: async () => {
      // Fetch all marketplaces
      const { data: marketplaces, error } = await supabase
        .from('marketplace_events')
        .select('*')
        .order('event_date', { ascending: false });

      if (error) throw new SafeError(mapDatabaseError(error), error);

      // For each marketplace, get summary counts
      const reports = await Promise.all(
        (marketplaces || []).map(async (mp) => {
          // Get beneficiary count
          const { count: archivedCount } = await supabase
            .from('archived_card_data')
            .select('*', { count: 'exact', head: true })
            .eq('marketplace_id', mp.id);

          const { count: activeCount } = await supabase
            .from('qr_cards')
            .select('*', { count: 'exact', head: true })
            .eq('marketplace_id', mp.id);

          // Get allocation totals
          const { data: allocations } = await supabase
            .from('marketplace_item_allocations')
            .select('allocated_quantity, distributed_quantity')
            .eq('marketplace_id', mp.id);

          const totalAllocated = allocations?.reduce((sum, a) => sum + a.allocated_quantity, 0) || 0;
          const totalDistributed = allocations?.reduce((sum, a) => sum + a.distributed_quantity, 0) || 0;

          return {
            id: mp.id,
            name: mp.name,
            location: mp.location,
            eventDate: mp.event_date,
            status: mp.status,
            beneficiaryCount: (archivedCount || 0) + (activeCount || 0),
            totalAllocated,
            totalDistributed,
            totalRemaining: totalAllocated - totalDistributed,
          };
        })
      );

      return reports;
    },
  });
};
