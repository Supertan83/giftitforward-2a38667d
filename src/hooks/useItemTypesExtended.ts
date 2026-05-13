import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
        .order('name');
      if (error) throw error;

      // Fetch donor companies via external_items
      const materialIds = (items || [])
        .map(i => i.external_material_id)
        .filter((id): id is number => id !== null);

      let companyMap: Record<number, string> = {};
      if (materialIds.length > 0) {
        const { data: extItems } = await supabase
          .from('external_items')
          .select('external_id, company_id')
          .in('external_id', materialIds);

        if (extItems && extItems.length > 0) {
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
      let distributedByItem: Record<string, number> = {};
      if (itemIds.length > 0) {
        const { data: allocations } = await supabase
          .from('marketplace_item_allocations')
          .select('item_type_id, marketplace_id, distributed_quantity')
          .in('item_type_id', itemIds)
          .is('deleted_at', null);

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

      return (items || []).map(item => ({
        id: item.id,
        name: item.name,
        icon: item.icon,
        totalStock: item.total_stock,
        distributed: distributedByItem[item.id] ?? (item.distributed || 0),
        allocatedToMarketplace: item.allocated_to_marketplace,
        category: item.category || null,
        subcategory: item.subcategory || null,
        externalMaterialId: item.external_material_id ?? null,
        surplussUrl: item.surpluss_url ?? null,
        donorCompany: item.external_material_id ? (companyMap[item.external_material_id] || null) : null,
        marketplaceNames: marketplaceMap[item.id] || null,
      }));
    }
  });

  useEffect(() => {
    const channel = supabase
      .channel('item_types_extended_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'item_types' }, () => {
        queryClient.invalidateQueries({ queryKey: ['item_types_extended'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
};
