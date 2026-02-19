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
  manualCountsUsed?: boolean;
  marketplace: {
    id: string;
    name: string;
    location: string | null;
    eventDate: string | null;
    status: string;
    outreachPartner: string | null;
    manualBeneficiaryCount: number | null;
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
    totalRegistered: number;
    totalAttended: number;
    dropoutRate: number;
    volunteerList: Array<{
      name: string;
      status: string;
      hoursWorked: number;
      category: string;
      company: string;
      gender: string | null;
    }>;
    categoryBreakdown: Array<{
      category: string;
      registered: number;
      attended: number;
      dropoutRate: number;
      maleCount: number;
      femaleCount: number;
      topCompanies: string[];
    }>;
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

// Fetch the true distribution count from transactions table (source of truth)
export const useMarketplaceDistributionCount = (marketplaceId?: string) => {
  return useQuery({
    queryKey: ['marketplace_distribution_count', marketplaceId],
    queryFn: async (): Promise<number> => {
      if (!marketplaceId) return 0;
      const { data, error } = await supabase.rpc('get_marketplace_distribution_count', {
        p_marketplace_id: marketplaceId,
      });
      if (error) throw new SafeError(mapDatabaseError(error), error);
      return Number(data) || 0;
    },
    enabled: !!marketplaceId,
  });
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

      // Get true distribution count from transactions (source of truth)
      const { data: trueCount } = await supabase.rpc('get_marketplace_distribution_count', {
        p_marketplace_id: marketplaceId,
      });

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
      const totalDistributed = Number(trueCount) || 0;

      // Fetch manual counts to determine if physical remaining data exists
      const { data: manualCounts } = await supabase
        .from('marketplace_manual_counts')
        .select('actual_remaining')
        .eq('marketplace_id', marketplaceId);

      let totalRemaining: number;
      let manualCountsUsed = false;

      if (manualCounts && manualCounts.length > 0) {
        totalRemaining = manualCounts.reduce((sum, mc) => sum + (mc.actual_remaining || 0), 0);
        manualCountsUsed = true;
      } else {
        totalRemaining = totalAllocated - totalDistributed;
      }

      // Fetch volunteer data - QR cards for this marketplace
      const { data: volunteerCards } = await supabase
        .from('volunteer_qr_cards')
        .select('*, volunteer:pending_volunteers(id, first_name, last_name, is_employee, external_company, gender)')
        .eq('marketplace_id', marketplaceId);

      const totalVolunteers = volunteerCards?.length || 0;
      const totalHours = volunteerCards?.reduce((sum, v) => sum + (Number(v.total_hours_worked) || 0), 0) || 0;
      const totalAttended = volunteerCards?.filter(v => v.status === 'checked_in' || v.status === 'checked_out').length || 0;

      // Build category breakdown from volunteer cards
      const volCategoryMap = new Map<string, {
        registered: number; attended: number; male: number; female: number; companies: Map<string, number>;
      }>();

      const volunteerList: Array<{
        name: string; status: string; hoursWorked: number; category: string; company: string; gender: string | null;
      }> = [];

      for (const card of volunteerCards || []) {
        const vol = card.volunteer as any;
        if (!vol) continue;

        let categoryKey: string;
        if (vol.is_employee) {
          categoryKey = 'Corporate Internal';
        } else if (vol.external_company) {
          categoryKey = 'Corporate External';
        } else {
          categoryKey = 'Outreach Partners';
        }

        const company = vol.external_company || (vol.is_employee ? 'Dubai Holding' : 'Other');

        volunteerList.push({
          name: `${vol.first_name || ''} ${vol.last_name || ''}`.trim() || 'Unknown',
          status: card.status,
          hoursWorked: Number(card.total_hours_worked) || 0,
          category: categoryKey,
          company,
          gender: vol.gender || null,
        });

        if (!volCategoryMap.has(categoryKey)) {
          volCategoryMap.set(categoryKey, { registered: 0, attended: 0, male: 0, female: 0, companies: new Map() });
        }
        const cat = volCategoryMap.get(categoryKey)!;
        cat.registered++;
        if (card.status === 'checked_in' || card.status === 'checked_out') cat.attended++;
        if (vol.gender?.toLowerCase() === 'male') cat.male++;
        if (vol.gender?.toLowerCase() === 'female') cat.female++;
        cat.companies.set(company, (cat.companies.get(company) || 0) + 1);
      }

      const volunteerCategoryBreakdown = Array.from(volCategoryMap.entries())
        .map(([category, d]) => ({
          category,
          registered: d.registered,
          attended: d.attended,
          dropoutRate: d.registered > 0 ? Math.round(((d.registered - d.attended) / d.registered) * 100) : 0,
          maleCount: d.male,
          femaleCount: d.female,
          topCompanies: Array.from(d.companies.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name),
        }))
        .sort((a, b) => b.registered - a.registered);

      const volDropoutRate = totalVolunteers > 0 ? Math.round(((totalVolunteers - totalAttended) / totalVolunteers) * 100) : 0;

      return {
        manualCountsUsed,
        marketplace: {
          id: marketplace.id,
          name: marketplace.name,
          location: marketplace.location,
          eventDate: marketplace.event_date,
          status: marketplace.status,
          outreachPartner: marketplace.outreach_partner,
          manualBeneficiaryCount: (marketplace as any).manual_beneficiary_count ?? null,
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
          totalRemaining,
          byItemType: itemsByType,
          byCategory,
        },
        volunteers: {
          total: totalVolunteers,
          totalHours,
          totalRegistered: totalVolunteers,
          totalAttended,
          dropoutRate: volDropoutRate,
          volunteerList,
          categoryBreakdown: volunteerCategoryBreakdown,
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

          // Get true distribution count from transactions
          const { data: trueCount } = await supabase.rpc('get_marketplace_distribution_count', {
            p_marketplace_id: mp.id,
          });

          const totalAllocated = allocations?.reduce((sum, a) => sum + a.allocated_quantity, 0) || 0;
          const totalDistributed = Number(trueCount) || 0;

          // Check for manual counts
          const { data: manualCounts } = await supabase
            .from('marketplace_manual_counts')
            .select('actual_remaining')
            .eq('marketplace_id', mp.id);

          let totalRemaining: number;
          let manualCountsUsed = false;
          if (manualCounts && manualCounts.length > 0) {
            totalRemaining = manualCounts.reduce((sum, mc) => sum + (mc.actual_remaining || 0), 0);
            manualCountsUsed = true;
          } else {
            totalRemaining = totalAllocated - totalDistributed;
          }

          return {
            id: mp.id,
            name: mp.name,
            location: mp.location,
            eventDate: mp.event_date,
            status: mp.status,
            beneficiaryCount: (archivedCount || 0) + (activeCount || 0),
            totalAllocated,
            totalDistributed,
            totalRemaining,
            manualCountsUsed,
          };
        })
      );

      return reports;
    },
  });
};
