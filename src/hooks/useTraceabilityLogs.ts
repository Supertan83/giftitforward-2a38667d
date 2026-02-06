import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TraceabilityLog {
  id: string;
  card_unique_id: string | null;
  allocation_id: string | null;
  item_type_id: string | null;
  marketplace_id: string | null;
  marketplace_name: string;
  action_type: string;
  quantity_before: number;
  quantity_after: number;
  description: string;
  performed_by: string | null;
  performed_by_email: string | null;
  created_at: string;
}

export interface LogTraceabilityEventParams {
  cardUniqueId?: string | null;
  allocationId?: string | null;
  itemTypeId?: string | null;
  marketplaceId?: string | null;
  marketplaceName: string;
  actionType: string;
  quantityBefore: number;
  quantityAfter: number;
  description: string;
}

export const useLogTraceabilityEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: LogTraceabilityEventParams) => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      const { error } = await supabase
        .from('allocation_traceability_logs' as any)
        .insert({
          card_unique_id: params.cardUniqueId || null,
          allocation_id: params.allocationId || null,
          item_type_id: params.itemTypeId || null,
          marketplace_id: params.marketplaceId || null,
          marketplace_name: params.marketplaceName,
          action_type: params.actionType,
          quantity_before: params.quantityBefore,
          quantity_after: params.quantityAfter,
          description: params.description,
          performed_by: user?.id || null,
          performed_by_email: user?.email || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['traceability-logs'] });
    },
  });
};

export interface TraceabilityFilters {
  marketplaceId?: string;
  actionType?: string;
  cardUniqueId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const useAllTraceabilityLogs = (filters?: TraceabilityFilters) => {
  return useQuery({
    queryKey: ['traceability-logs', filters],
    queryFn: async () => {
      let query = (supabase.from('allocation_traceability_logs' as any).select('*') as any);

      if (filters?.marketplaceId) {
        query = query.eq('marketplace_id', filters.marketplaceId);
      }
      if (filters?.actionType) {
        query = query.eq('action_type', filters.actionType);
      }
      if (filters?.cardUniqueId) {
        query = query.ilike('card_unique_id', `%${filters.cardUniqueId}%`);
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      return (data || []) as TraceabilityLog[];
    },
  });
};

export const useTraceabilityLogsByCard = (cardUniqueId?: string) => {
  return useQuery({
    queryKey: ['traceability-logs', 'card', cardUniqueId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('allocation_traceability_logs' as any)
        .select('*') as any)
        .eq('card_unique_id', cardUniqueId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as TraceabilityLog[];
    },
    enabled: !!cardUniqueId,
  });
};
