import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { mapDatabaseError, SafeError } from '@/lib/errorUtils';

// Paginated fetch helper to overcome the 1000-row default limit
async function fetchAllPaginatedRows(table: string, filterCol: string, filterVal: string) {
  const PAGE_SIZE = 1000;
  let allRows: any[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from(table as any)
      .select('*')
      .eq(filterCol, filterVal)
      .range(from, from + PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allRows;
}

// Extract unique dependents from events_json (same logic as FamilyMembersTab)
const extractUniqueDependents = (eventsJson: unknown): Array<{ name: string; type: string }> => {
  if (!eventsJson || !Array.isArray(eventsJson)) return [];
  const dependents: Array<{ name: string; type: string }> = [];
  for (const event of eventsJson) {
    if (event.dependents && Array.isArray(event.dependents)) {
      for (const dep of event.dependents) {
        const name = dep.name?.trim();
        if (!name) continue;
        const nameLower = name.toLowerCase();
        
        const existingIdx = dependents.findIndex(d => {
          const existing = d.name.toLowerCase();
          return existing === nameLower || existing.includes(nameLower) || nameLower.includes(existing);
        });
        
        if (existingIdx === -1) {
          dependents.push({ name: dep.name, type: dep.type || 'adult' });
        } else if (nameLower.length > dependents[existingIdx].name.length) {
          dependents[existingIdx] = { name: dep.name, type: dep.type || dependents[existingIdx].type };
        }
      }
    }
  }
  return dependents;
};

// Resolve family member name from card unique_id using positional matching
const resolveFamilyName = (
  uniqueId: string,
  vol: any,
  allCardsForVolunteer: Array<{ uniqueId: string; cardId: string }>
): { name: string; isFamily: boolean } => {
  const isFamilyCard = /-F\d+/.test(uniqueId);
  if (!isFamilyCard) return { name: `${vol.first_name || ''} ${vol.last_name || ''}`.trim() || 'Unknown', isFamily: false };

  const dependents = extractUniqueDependents(vol.events_json);
  if (dependents.length === 0) {
    return { name: `Family of ${vol.first_name} ${vol.last_name}`, isFamily: true };
  }

  // Sort all family cards for this volunteer by their -F suffix to get stable positional index
  const familyCards = allCardsForVolunteer
    .filter(c => /-F\d+/.test(c.uniqueId))
    .sort((a, b) => {
      const aIdx = parseInt(a.uniqueId.match(/-F(\d+)/)?.[1] || '0', 10);
      const bIdx = parseInt(b.uniqueId.match(/-F(\d+)/)?.[1] || '0', 10);
      return aIdx - bIdx;
    });

  const posIdx = familyCards.findIndex(c => c.uniqueId === uniqueId);
  if (posIdx >= 0 && posIdx < dependents.length) {
    return { name: `${dependents[posIdx].name} (Family)`, isFamily: true };
  }

  return { name: `Family of ${vol.first_name} ${vol.last_name}`, isFamily: true };
};

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
    familyMembers: number;
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

      // Fetch beneficiaries (archived + active) for this marketplace using paginated fetch
      const archivedCards = await fetchAllPaginatedRows('archived_card_data', 'marketplace_id', marketplaceId);
      const activeCards = await fetchAllPaginatedRows('qr_cards', 'marketplace_id', marketplaceId);

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

      // Fetch manual counts for this marketplace
      const { data: manualCounts } = await supabase
        .from('marketplace_manual_counts')
        .select('*')
        .eq('marketplace_id', marketplaceId);

      const manualCountMap = new Map(
        (manualCounts || []).map((mc: any) => [mc.item_type_id, mc])
      );

      const hasManualCounts = (manualCounts || []).length > 0;

      const itemsByType = (allocations || []).map((alloc: any) => {
        const manual = manualCountMap.get(alloc.item_type_id);
        return {
          itemId: alloc.item_type_id,
          itemName: alloc.item_types?.name || 'Unknown',
          itemIcon: alloc.item_types?.icon || '📦',
          category: alloc.item_types?.category || null,
          subcategory: alloc.item_types?.subcategory || null,
          externalMaterialId: alloc.item_types?.external_material_id || null,
          allocated: alloc.allocated_quantity,
          distributed: manual ? manual.actual_distributed : alloc.distributed_quantity,
          remaining: manual ? manual.actual_remaining : (alloc.allocated_quantity - alloc.distributed_quantity),
        };
      });

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
      const totalRemaining = itemsByType.reduce((sum, item) => sum + item.remaining, 0);

// Fetch registered volunteers from pending_volunteers using events_list matching
      const { data: pendingVolunteers } = await supabase
        .from('pending_volunteers')
        .select('id, first_name, last_name, is_employee, external_company, gender, events_list, events_json')
        .eq('status', 'approved')
        .not('events_list', 'is', null);

      // Match volunteers to this marketplace using exact slug matching per event
      const marketplaceNameSlug = marketplace.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const formRegisteredVolunteers = (pendingVolunteers || []).filter(pv => {
        if (!pv.events_list) return false;
        return pv.events_list.split(',').some(
          slug => slug.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === marketplaceNameSlug
        );
      });
      const totalRegisteredFromForm = formRegisteredVolunteers.length;

      // Count family members registered for this specific marketplace
      let totalFamilyMembers = 0;
      for (const fv of formRegisteredVolunteers) {
        if (fv.events_json && Array.isArray(fv.events_json)) {
          for (const evt of fv.events_json as any[]) {
            const eventSlug = (evt['event-slug'] || evt.event_slug || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (eventSlug === marketplaceNameSlug) {
              totalFamilyMembers += (evt['number-of-adults'] || evt.number_of_adults || 0);
              totalFamilyMembers += (evt['number-of-children'] || evt.number_of_children || 0);
            }
          }
        }
      }

// Fetch volunteer data via attendance records (per-marketplace source of truth)
      const { data: attendanceRecords } = await supabase
        .from('volunteer_attendance')
        .select('*, volunteer_qr_cards(id, unique_id, status, volunteer_id, volunteer:pending_volunteers(id, first_name, last_name, is_employee, external_company, gender, events_json))')
        .eq('marketplace_id', marketplaceId);

      // Group attendance by volunteer_card_id and sum hours per volunteer for THIS marketplace
      const volCardMap = new Map<string, {
        cardId: string;
        vol: any;
        status: string;
        totalHours: number;
        checkedInAt: string | null;
        checkedOutAt: string | null;
        attended: boolean;
      }>();

      for (const att of attendanceRecords || []) {
        const card = att.volunteer_qr_cards as any;
        if (!card) continue;
        const vol = card.volunteer as any;
        if (!vol) continue;
        const cardId = att.volunteer_card_id;

        if (!volCardMap.has(cardId)) {
          volCardMap.set(cardId, {
            cardId: card.id,
            vol,
            status: card.status,
            totalHours: 0,
            checkedInAt: att.check_in_time,
            checkedOutAt: att.check_out_time,
            attended: false,
          });
        }

        const entry = volCardMap.get(cardId)!;
        entry.totalHours += Number(att.hours_worked) || 0;
        // Use the earliest check-in and latest check-out for display
        if (att.check_in_time && (!entry.checkedInAt || att.check_in_time < entry.checkedInAt)) {
          entry.checkedInAt = att.check_in_time;
        }
        if (att.check_out_time && (!entry.checkedOutAt || att.check_out_time > entry.checkedOutAt)) {
          entry.checkedOutAt = att.check_out_time;
        }
        // If any attendance record exists with check_out_time, they attended
        if (att.check_out_time || att.check_in_time) {
          entry.attended = true;
        }
      }

      // Also fetch volunteer QR cards assigned to this marketplace (for registered but not-yet-checked-in volunteers)
      const { data: assignedCards } = await supabase
        .from('volunteer_qr_cards')
        .select('id, unique_id, status, volunteer_id, volunteer:pending_volunteers(id, first_name, last_name, is_employee, external_company, gender, events_json)')
        .eq('marketplace_id', marketplaceId);

      // Add any assigned volunteers who don't have attendance records yet
      for (const card of assignedCards || []) {
        const vol = card.volunteer as any;
        if (!vol) continue;
        if (!volCardMap.has(card.id)) {
          volCardMap.set(card.id, {
            cardId: card.id,
            vol,
            status: card.status,
            totalHours: 0,
            checkedInAt: null,
            checkedOutAt: null,
            attended: card.status === 'checked_in' || card.status === 'checked_out',
          });
        }
      }

      const totalVolunteers = volCardMap.size;
      const totalHours = Array.from(volCardMap.values()).reduce((sum, v) => sum + v.totalHours, 0);
      const totalAttended = Array.from(volCardMap.values()).filter(v => v.attended).length;
      // Use form registration count as the true "registered" number (fallback to card count if higher)
      const effectiveRegistered = Math.max(totalRegisteredFromForm + totalFamilyMembers, totalVolunteers);

      // Build category breakdown from per-marketplace volunteer data
      const volCategoryMap = new Map<string, {
        registered: number; attended: number; male: number; female: number; companies: Map<string, number>;
      }>();

      const volunteerList: Array<{
        name: string; status: string; hoursWorked: number; category: string; company: string; gender: string | null;
        cardId: string; checkedInAt: string | null; checkedOutAt: string | null;
      }> = [];

      // Build a map of all cards per volunteer_id for positional family name resolution
      const cardsByVolunteerId = new Map<string, Array<{ uniqueId: string; cardId: string }>>();
      for (const [cId, entry] of volCardMap) {
        const volId = entry.vol?.id;
        if (!volId) continue;
        const card = (attendanceRecords || []).find(a => a.volunteer_card_id === cId)?.volunteer_qr_cards as any
          || (assignedCards || []).find(c => c.id === cId);
        if (!cardsByVolunteerId.has(volId)) cardsByVolunteerId.set(volId, []);
        cardsByVolunteerId.get(volId)!.push({ uniqueId: card?.unique_id || '', cardId: cId });
      }

      for (const [cardId, entry] of volCardMap) {
        const vol = entry.vol;
        const card = (attendanceRecords || []).find(a => a.volunteer_card_id === cardId)?.volunteer_qr_cards as any
          || (assignedCards || []).find(c => c.id === cardId);
        const cardUniqueId = card?.unique_id || '';

        let categoryKey: string;
        if (vol.is_employee) {
          categoryKey = 'Corporate Internal';
        } else if (vol.external_company) {
          categoryKey = 'Corporate External';
        } else {
          categoryKey = 'Outreach Partners';
        }

        const company = vol.external_company || (vol.is_employee ? 'Dubai Holding' : 'Other');
        const siblingCards = cardsByVolunteerId.get(vol.id) || [];
        const { name: resolvedName } = resolveFamilyName(cardUniqueId, vol, siblingCards);

        volunteerList.push({
          name: resolvedName,
          status: entry.status,
          hoursWorked: entry.totalHours,
          category: categoryKey,
          company,
          gender: vol.gender || null,
          cardId: entry.cardId,
          checkedInAt: entry.checkedInAt,
          checkedOutAt: entry.checkedOutAt,
        });

        if (!volCategoryMap.has(categoryKey)) {
          volCategoryMap.set(categoryKey, { registered: 0, attended: 0, male: 0, female: 0, companies: new Map() });
        }
        const cat = volCategoryMap.get(categoryKey)!;
        cat.registered++;
        if (entry.attended) cat.attended++;
        if (vol.gender?.toLowerCase() === 'male') cat.male++;
        if (vol.gender?.toLowerCase() === 'female') cat.female++;
        cat.companies.set(company, (cat.companies.get(company) || 0) + 1);
      }

      // Merge form-registered volunteers not already in volCardMap
      const volIdsInCardMap = new Set<string>();
      for (const [, entry] of volCardMap) {
        if (entry.vol?.id) volIdsInCardMap.add(entry.vol.id);
      }

      for (const fv of formRegisteredVolunteers) {
        if (volIdsInCardMap.has(fv.id)) continue;

        let categoryKey: string;
        if (fv.is_employee) {
          categoryKey = 'Corporate Internal';
        } else if (fv.external_company) {
          categoryKey = 'Corporate External';
        } else {
          categoryKey = 'Outreach Partners';
        }
        const company = fv.external_company || (fv.is_employee ? 'Dubai Holding' : 'Other');

        volunteerList.push({
          name: `${fv.first_name} ${fv.last_name}`,
          status: 'registered',
          hoursWorked: 0,
          category: categoryKey,
          company,
          gender: fv.gender || null,
          cardId: '',
          checkedInAt: null,
          checkedOutAt: null,
        });

        if (!volCategoryMap.has(categoryKey)) {
          volCategoryMap.set(categoryKey, { registered: 0, attended: 0, male: 0, female: 0, companies: new Map() });
        }
        const cat = volCategoryMap.get(categoryKey)!;
        cat.registered++;
        if (fv.gender?.toLowerCase() === 'male') cat.male++;
        if (fv.gender?.toLowerCase() === 'female') cat.female++;
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

      const volDropoutRate = effectiveRegistered > 0 ? Math.round(((effectiveRegistered - totalAttended) / effectiveRegistered) * 100) : 0;

      return {
        marketplace: {
          id: marketplace.id,
          name: marketplace.name,
          location: marketplace.location,
          eventDate: marketplace.event_date,
          status: computeDisplayStatus(marketplace as any),
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
          totalRegistered: effectiveRegistered,
          totalAttended,
          familyMembers: totalFamilyMembers,
          dropoutRate: volDropoutRate,
          volunteerList,
          categoryBreakdown: volunteerCategoryBreakdown,
        },
      };
    },
    enabled: !!marketplaceId,
  });
};

// Shared helper to compute real-time marketplace status
function computeDisplayStatus(mp: { status: string; event_date?: string | null; start_time?: string | null; end_time?: string | null; status_locked_by_admin?: boolean }): string {
  let s = mp.status;
  if (!mp.status_locked_by_admin && (s === 'active' || s === 'upcoming') && mp.event_date) {
    const [y, m, d] = mp.event_date.split('-').map(Number);
    const now = new Date();
    const endDt = new Date(y, m - 1, d);
    if (mp.end_time) { const [eh, em] = mp.end_time.split(':').map(Number); endDt.setHours(eh, em, 0, 0); }
    else { endDt.setHours(23, 59, 59, 999); }
    const startDt = new Date(y, m - 1, d);
    if (mp.start_time) { const [sh, sm] = mp.start_time.split(':').map(Number); startDt.setHours(sh, sm, 0, 0); }
    else { startDt.setHours(0, 0, 0, 0); }
    if (now > endDt) s = 'completed';
    else if (s === 'upcoming' && now >= startDt) s = 'active';
  }
  return s;
}

// Fetch summary reports for all marketplaces
export const useAllMarketplaceReports = () => {
  return useQuery({
    queryKey: ['all_marketplace_reports'],
    queryFn: async () => {
      // Fetch all marketplaces
      const { data: marketplaces, error } = await supabase
        .from('marketplace_events')
        .select('*')
        .order('event_date', { ascending: true });

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
            .select('allocated_quantity, distributed_quantity, item_type_id')
            .eq('marketplace_id', mp.id);

          // Fetch manual counts for this marketplace
          const { data: manualCounts } = await supabase
            .from('marketplace_manual_counts')
            .select('item_type_id, actual_distributed, actual_remaining')
            .eq('marketplace_id', mp.id);

          const manualMap = new Map(
            (manualCounts || []).map((mc: any) => [mc.item_type_id, mc])
          );

          let totalAllocated = 0;
          let totalDistributed = 0;
          let totalRemaining = 0;

          (allocations || []).forEach((a: any) => {
            const manual = manualMap.get(a.item_type_id);
            totalAllocated += a.allocated_quantity;
            totalDistributed += manual ? manual.actual_distributed : a.distributed_quantity;
            totalRemaining += manual ? manual.actual_remaining : (a.allocated_quantity - a.distributed_quantity);
          });

          return {
            id: mp.id,
            name: mp.name,
            location: mp.location,
            eventDate: mp.event_date,
            status: computeDisplayStatus(mp),
            beneficiaryCount: (archivedCount || 0) + (activeCount || 0),
            totalAllocated,
            totalDistributed,
            totalRemaining,
          };
        })
      );

      return reports;
    },
  });
};
