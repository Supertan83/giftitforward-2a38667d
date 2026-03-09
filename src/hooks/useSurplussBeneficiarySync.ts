import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BeneficiarySyncResult {
  success: boolean;
  beneficiaries_sent: number;
  beneficiaries_failed: number;
  beneficiaries_skipped: number;
  beneficiaries_bulk_updated: number;
  beneficiaries_total: number;
  beneficiary_details: { unique_id: string; name: string; status: string; reason?: string }[];
  errors: string[];
}

export const useSurplussBeneficiarySync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const syncBeneficiaries = async (
    marketplaceId: string,
    environment: 'staging' | 'production'
  ): Promise<BeneficiarySyncResult | null> => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-surpluss-beneficiaries', {
        body: { marketplace_id: marketplaceId, environment },
      });

      if (error) throw error;

      const result = data as BeneficiarySyncResult;

      if (result.success) {
        toast({
          title: 'Beneficiary Sync Complete',
          description: `Sent: ${result.beneficiaries_sent}, Updated: ${result.beneficiaries_bulk_updated}, Skipped: ${result.beneficiaries_skipped}`,
        });
      } else {
        toast({
          title: 'Beneficiary Sync Completed with Issues',
          description: `Sent: ${result.beneficiaries_sent}, Failed: ${result.beneficiaries_failed}`,
          variant: 'destructive',
        });
      }

      return result;
    } catch (error) {
      toast({
        title: 'Beneficiary Sync Failed',
        description: error instanceof Error ? error.message : 'Failed to sync beneficiaries',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsSyncing(false);
    }
  };

  return { isSyncing, syncBeneficiaries };
};
