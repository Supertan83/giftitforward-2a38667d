import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ManualCount {
  id: string;
  marketplace_id: string;
  item_type_id: string;
  allocation_id: string | null;
  actual_distributed: number;
  actual_remaining: number;
  notes: string | null;
  counted_by: string | null;
  counted_at: string;
}

interface SaveCountPayload {
  marketplace_id: string;
  item_type_id: string;
  allocation_id: string | null;
  actual_distributed: number;
  actual_remaining: number;
  notes: string | null;
}

export const useManualCounts = (marketplaceId: string) => {
  return useQuery({
    queryKey: ['manual_counts', marketplaceId],
    queryFn: async () => {
      if (!marketplaceId) return [];

      const { data, error } = await supabase
        .from('marketplace_manual_counts')
        .select('*')
        .eq('marketplace_id', marketplaceId);

      if (error) throw error;
      return data as ManualCount[];
    },
    enabled: !!marketplaceId,
  });
};

export const useManualCountOperations = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const saveCount = useMutation({
    mutationFn: async (payload: SaveCountPayload) => {
      // Upsert based on marketplace_id + item_type_id unique constraint
      const { data, error } = await supabase
        .from('marketplace_manual_counts')
        .upsert(
          {
            marketplace_id: payload.marketplace_id,
            item_type_id: payload.item_type_id,
            allocation_id: payload.allocation_id,
            actual_distributed: payload.actual_distributed,
            actual_remaining: payload.actual_remaining,
            notes: payload.notes,
            counted_at: new Date().toISOString(),
          },
          {
            onConflict: 'marketplace_id,item_type_id',
          }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['manual_counts', variables.marketplace_id] 
      });
    },
    onError: (error) => {
      toast({
        title: 'Error saving count',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteCount = useMutation({
    mutationFn: async ({ id, marketplaceId }: { id: string; marketplaceId: string }) => {
      const { error } = await supabase
        .from('marketplace_manual_counts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, marketplaceId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ 
        queryKey: ['manual_counts', result.marketplaceId] 
      });
      toast({
        title: 'Count deleted',
        description: 'Manual count has been removed.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error deleting count',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    saveCount,
    deleteCount,
  };
};
