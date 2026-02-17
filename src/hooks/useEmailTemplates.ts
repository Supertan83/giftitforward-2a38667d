import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface BodySection {
  type: 'paragraph' | 'list' | 'cta' | 'image';
  content: string;
  url?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject: string;
  greeting: string;
  body_sections: BodySection[];
  cta_text: string | null;
  cta_url: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplateInput {
  name: string;
  category: string;
  subject: string;
  greeting: string;
  body_sections: BodySection[];
  cta_text?: string | null;
  cta_url?: string | null;
  is_active?: boolean;
}

const QUERY_KEY = 'email-templates';

export const useEmailTemplates = (category?: string) => {
  return useQuery({
    queryKey: [QUERY_KEY, category],
    queryFn: async () => {
      let query = supabase
        .from('email_templates' as any)
        .select('*')
        .order('updated_at', { ascending: false });

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as EmailTemplate[];
    },
  });
};

export const useEmailTemplate = (id: string | null) => {
  return useQuery({
    queryKey: [QUERY_KEY, 'single', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('email_templates' as any)
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as unknown as EmailTemplate;
    },
    enabled: !!id,
  });
};

export const useEmailTemplateMutations = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createTemplate = useMutation({
    mutationFn: async (input: EmailTemplateInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('email_templates' as any)
        .insert({ ...input, created_by: userData.user?.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as EmailTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: 'Template Created', description: 'Email template saved successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...input }: EmailTemplateInput & { id: string }) => {
      const { data, error } = await supabase
        .from('email_templates' as any)
        .update(input as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as EmailTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: 'Template Updated', description: 'Email template updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      // First delete campaign recipients for campaigns using this template
      const { data: campaigns } = await supabase
        .from('email_campaigns' as any)
        .select('id')
        .eq('template_id', id);
      
      if (campaigns && campaigns.length > 0) {
        const campaignIds = (campaigns as any[]).map((c: any) => c.id);
        await supabase
          .from('email_campaign_recipients' as any)
          .delete()
          .in('campaign_id', campaignIds);
        await supabase
          .from('email_campaigns' as any)
          .delete()
          .eq('template_id', id);
      }

      const { error } = await supabase
        .from('email_templates' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: 'Template Deleted', description: 'Email template removed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const duplicateTemplate = useMutation({
    mutationFn: async (template: EmailTemplate) => {
      const { data: userData } = await supabase.auth.getUser();
      const { id, created_at, updated_at, ...rest } = template;
      const { data, error } = await supabase
        .from('email_templates' as any)
        .insert({ ...rest, name: `${rest.name} (Copy)`, created_by: userData.user?.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as EmailTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: 'Template Duplicated', description: 'A copy has been created' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return { createTemplate, updateTemplate, deleteTemplate, duplicateTemplate };
};
