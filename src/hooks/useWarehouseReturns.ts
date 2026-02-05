import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { mapDatabaseError, SafeError } from '@/lib/errorUtils';

export interface WarehouseReturn {
  id: string;
  marketplaceId: string;
  marketplaceName?: string;
  allocationId: string | null;
  itemTypeId: string;
  itemTypeName?: string;
  quantityReturned: number;
  returnBatchCode: string | null;
  notes: string | null;
  returnedBy: string | null;
  returnedAt: string;
  createdAt: string;
}

export const useWarehouseReturns = (marketplaceId?: string) => {
  return useQuery({
    queryKey: ['warehouse_returns', marketplaceId],
    queryFn: async (): Promise<WarehouseReturn[]> => {
      let query = supabase
        .from('warehouse_returns')
        .select(`
          *,
          marketplace_events (name),
          item_types (name)
        `)
        .order('returned_at', { ascending: false });

      if (marketplaceId) {
        query = query.eq('marketplace_id', marketplaceId);
      }

      const { data, error } = await query;

      if (error) throw new SafeError(mapDatabaseError(error), error);

      return (data || []).map((r: any) => ({
        id: r.id,
        marketplaceId: r.marketplace_id,
        marketplaceName: r.marketplace_events?.name,
        allocationId: r.allocation_id,
        itemTypeId: r.item_type_id,
        itemTypeName: r.item_types?.name,
        quantityReturned: r.quantity_returned,
        returnBatchCode: r.return_batch_code,
        notes: r.notes,
        returnedBy: r.returned_by,
        returnedAt: r.returned_at,
        createdAt: r.created_at,
      }));
    },
  });
};

export const useWarehouseReturnOperations = () => {
  const queryClient = useQueryClient();

  const createReturn = useMutation({
    mutationFn: async ({
      marketplaceId,
      allocationId,
      itemTypeId,
      quantityReturned,
      returnBatchCode,
      notes,
    }: {
      marketplaceId: string;
      allocationId?: string;
      itemTypeId: string;
      quantityReturned: number;
      returnBatchCode?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('warehouse_returns')
        .insert({
          marketplace_id: marketplaceId,
          allocation_id: allocationId || null,
          item_type_id: itemTypeId,
          quantity_returned: quantityReturned,
          return_batch_code: returnBatchCode || null,
          notes: notes || null,
        })
        .select()
        .single();

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse_returns'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace_allocations'] });
    },
  });

  const deleteReturn = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('warehouse_returns')
        .delete()
        .eq('id', id);

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse_returns'] });
    },
  });

  return {
    createReturn,
    deleteReturn,
  };
};
