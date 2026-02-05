import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { mapDatabaseError, SafeError } from '@/lib/errorUtils';

export interface OutreachPartner {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export const useOutreachPartners = (activeOnly: boolean = false) => {
  return useQuery({
    queryKey: ['outreach_partners', activeOnly],
    queryFn: async (): Promise<OutreachPartner[]> => {
      let query = supabase
        .from('outreach_partners')
        .select('*')
        .order('name', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) throw new SafeError(mapDatabaseError(error), error);

      return (data || []).map(partner => ({
        id: partner.id,
        name: partner.name,
        isActive: partner.is_active ?? true,
        createdAt: partner.created_at || '',
      }));
    },
  });
};

export const useOutreachPartnerOperations = () => {
  const queryClient = useQueryClient();

  const createPartner = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('outreach_partners')
        .insert({ name })
        .select()
        .single();

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach_partners'] });
    },
  });

  const updatePartner = useMutation({
    mutationFn: async ({ id, name, isActive }: { id: string; name?: string; isActive?: boolean }) => {
      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (isActive !== undefined) updateData.is_active = isActive;

      const { error } = await supabase
        .from('outreach_partners')
        .update(updateData)
        .eq('id', id);

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach_partners'] });
    },
  });

  const deletePartner = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('outreach_partners')
        .delete()
        .eq('id', id);

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach_partners'] });
    },
  });

  return {
    createPartner,
    updatePartner,
    deletePartner,
  };
};
