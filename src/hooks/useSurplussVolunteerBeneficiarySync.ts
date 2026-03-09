import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SyncResult {
  success: boolean;
  volunteers_sent: number;
  volunteers_failed: number;
  volunteers_skipped: number;
  volunteers_bulk_updated: number;
  volunteers_total: number;
  volunteer_details: { name: string; status: string; reason?: string }[];
  demographics_sent: number;
  demographics_failed: number;
  demographics_details: { marketplace_id: string; marketplace_name: string; status: string; reason?: string }[];
  errors: string[];
}

export const useSurplussVolunteerBeneficiarySync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const syncToSurpluss = async (
    marketplaceId: string,
    environment: 'staging' | 'production'
  ): Promise<SyncResult | null> => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-surpluss-volunteer-beneficiary', {
        body: { marketplace_id: marketplaceId, environment },
      });

      if (error) throw error;

      const result = data as SyncResult;

      if (result.success) {
        toast({
          title: 'Sync Complete',
          description: `Volunteers: ${result.volunteers_sent} sent. `,
        });
      } else {
        toast({
          title: 'Sync Completed with Issues',
          description: `Vol: ${result.volunteers_sent} sent, ${result.volunteers_failed} failed. Ben: ${result.beneficiaries_sent} sent, ${result.bDemographics: ${result.demographice',
        });
      }

      return result;
    } catch (error) {
      toast({
        title: 'Sync Failed',
        description: error instanceof Error ? error.message : 'Failed to sync to Surpluss',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsSyncing(false);
    }
  };

  return { isSyncing, syncToSurpluss };
};
