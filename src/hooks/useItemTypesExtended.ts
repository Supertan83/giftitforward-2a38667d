import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';

export interface ExtendedItemType {
  id: string;
  name: string;
  icon: string;
  totalStock: number;
  distributed: number;
  allocatedToMarketplace: number;
  category: string | null;
  subcategory: string | null;
  externalMaterialId: number | null;
  surplussUrl: string | null;
  donorCompany: string | null;
  marketplaceNames: string | null;
}

export const useItemTypesExtended = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['item_types_extended'],
    queryFn: async (): Promise<ExtendedItemType[]> => {
      // Fetch items
      const { data: items, error } = await supabase
        .from('item_types')
        .select('*')
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;

      // Fetch donor companies and received counts via external_items (Surpluss/GIF source of truth)
      const materialIds = (items || [])
        .map(i => i.external_material_id)
        .filter((id): id is number => id !== null);

      let companyMap: Record<number, string> = {};
      let receivedByMaterial: Record<number, number> = {};
      if (materialIds.length > 0) {
        const { data: extItems } = await supabase
          .from('external_items')
          .select('external_id, company_id, item_count')
          .in('external_id', materialIds)
          .is('deleted_at', null);

        if (extItems && extItems.length > 0) {
          extItems.forEach(ei => {
            receivedByMaterial[ei.external_id] = (receivedByMaterial[ei.external_id] || 0) + Number(ei.item_count || 0);
          });

          const companyIds = [...new Set(extItems.map(e => e.company_id).filter(Boolean))] as string[];
          if (companyIds.length > 0) {
            const { data: companies } = await supabase
              .from('external_companies')
              .select('id, name')
              .in('id', companyIds);

            const companyLookup: Record<string, string> = {};
            (companies || []).forEach(c => { companyLookup[c.id] = c.name; });

            extItems.forEach(ei => {
              if (ei.company_id && companyLookup[ei.company_id]) {
                companyMap[ei.external_id] = companyLookup[ei.company_id];
              }
            });
          }
        }
      }

      // Fetch marketplace allocations (with distributed_quantity for live counts)
      const itemIds = (items || []).map(i => i.id);
      let marketplaceMap: Record<string, string> = {};
      let allocatedByItem: Record<string, number> = {};
      let distributedByItem: Record<string, number> = {};
      if (itemIds.length > 0) {
        const allocations = await fetchAllRows<any>(() =>
          supabase
            .from('marketplace_item_allocations')
            .select('item_type_id, marketplace_id, allocated_quantity, distributed_quantity')
            .in('item_type_id', itemIds)
            .is('deleted_at', null)
        );

        // Manual counts override allocation distributed_quantity when present
        const { data: manualCounts } = await supabase
          .from('marketplace_manual_counts')
          .select('item_type_id, marketplace_id, actual_distributed')
          .in('item_type_id', itemIds)
          .is('deleted_at', null);

        const manualMap = new Map<string, number>();
        (manualCounts || []).forEach(m => {
          manualMap.set(`${m.item_type_id}|${m.marketplace_id}`, Number(m.actual_distributed || 0));
        });

        (allocations || []).forEach(a => {
          const key = `${a.item_type_id}|${a.marketplace_id}`;
          allocatedByItem[a.item_type_id] = (allocatedByItem[a.item_type_id] || 0) + Number(a.allocated_quantity || 0);
          const dist = manualMap.has(key)
            ? (manualMap.get(key) || 0)
            : Number(a.distributed_quantity || 0);
          distributedByItem[a.item_type_id] = (distributedByItem[a.item_type_id] || 0) + dist;
        });

        if (allocations && allocations.length > 0) {
          const mpIds = [...new Set(allocations.map(a => a.marketplace_id))];
          const { data: marketplaces } = await supabase
            .from('marketplace_events')
            .select('id, name')
            .in('id', mpIds);

          const mpLookup: Record<string, string> = {};
          (marketplaces || []).forEach(m => { mpLookup[m.id] = m.name; });

          const itemMpNames: Record<string, Set<string>> = {};
          allocations.forEach(a => {
            if (!itemMpNames[a.item_type_id]) itemMpNames[a.item_type_id] = new Set();
            if (mpLookup[a.marketplace_id]) itemMpNames[a.item_type_id].add(mpLookup[a.marketplace_id]);
          });

          Object.entries(itemMpNames).forEach(([itemId, names]) => {
            marketplaceMap[itemId] = [...names].join(', ');
          });
        }
      }

      return (items || []).map(item => {
        const materialId = item.external_material_id ?? null;
        return {
          id: item.id,
          name: item.name,
          icon: item.icon,
          totalStock: materialId != null && receivedByMaterial[materialId] != null
            ? receivedByMaterial[materialId]
            : item.total_stock,
          distributed: distributedByItem[item.id] ?? (item.distributed || 0),
          allocatedToMarketplace: allocatedByItem[item.id] ?? (item.allocated_to_marketplace || 0),
          category: item.category || null,
          subcategory: item.subcategory || null,
          externalMaterialId: materialId,
          surplussUrl: item.surpluss_url ?? null,
          donorCompany: materialId ? (companyMap[materialId] || null) : null,
          marketplaceNames: marketplaceMap[item.id] || null,
        };
      });
    }
  });

  useEffect(() => {
    const channel = supabase
      .channel('item_types_extended_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'item_types' }, () => {
        queryClient.invalidateQueries({ queryKey: ['item_types_extended'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'external_items' }, () => {
        queryClient.invalidateQueries({ queryKey: ['item_types_extended'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_item_allocations' }, () => {
        queryClient.invalidateQueries({ queryKey: ['item_types_extended'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_manual_counts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['item_types_extended'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
};
