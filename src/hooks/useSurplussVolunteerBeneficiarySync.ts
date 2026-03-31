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
  beneficiaries_sent: number;
  beneficiaries_failed: number;
  beneficiaries_skipped: number;
  beneficiaries_total: number;
  marketplace_events_updated: number;
  marketplace_events_failed: number;
  beneficiary_details: { unique_id: string; name: string; status: string; reason?: string }[];
  distribution_reported: boolean;
  distribution_error: string | null;
  distribution_allocations_sent: number;
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
      // 1. Sync volunteers & demographics
      const { data: volData, error: volError } = await supabase.functions.invoke('sync-surpluss-volunteer-beneficiary', {
        body: { marketplace_id: marketplaceId, environment },
      });
      if (volError) throw volError;

      // 2. Sync beneficiaries
      const { data: benData, error: benError } = await supabase.functions.invoke('sync-surpluss-beneficiaries', {
        body: { marketplace_id: marketplaceId, environment },
      });
      if (benError) throw benError;

      const result: SyncResult = {
        success: (volData?.success !== false) && (benData?.success !== false),
        volunteers_sent: volData?.volunteers_sent ?? 0,
        volunteers_failed: volData?.volunteers_failed ?? 0,
        volunteers_skipped: volData?.volunteers_skipped ?? 0,
        volunteers_bulk_updated: volData?.volunteers_bulk_updated ?? 0,
        volunteers_total: volData?.volunteers_total ?? 0,
        volunteer_details: volData?.volunteer_details ?? [],
        demographics_sent: volData?.demographics_sent ?? 0,
        demographics_failed: volData?.demographics_failed ?? 0,
        demographics_details: volData?.demographics_details ?? [],
        beneficiaries_sent: benData?.beneficiaries_sent ?? 0,
        beneficiaries_failed: benData?.beneficiaries_failed ?? 0,
        beneficiaries_skipped: benData?.beneficiaries_skipped ?? 0,
        beneficiaries_total: benData?.beneficiaries_total ?? 0,
        marketplace_events_updated: benData?.marketplace_events_updated ?? 0,
        marketplace_events_failed: benData?.marketplace_events_failed ?? 0,
        beneficiary_details: benData?.beneficiary_details ?? [],
        errors: [...(volData?.errors ?? []), ...(benData?.errors ?? [])],
      };

      if (result.success) {
        toast({
          title: 'Sync Complete',
          description: `Volunteers: ${result.volunteers_sent} sent. Beneficiaries: ${result.beneficiaries_sent} sent, ${result.beneficiaries_skipped} skipped.`,
        });
      } else {
        toast({
          title: 'Sync Completed with Issues',
          description: `Vol: ${result.volunteers_sent} sent, ${result.volunteers_failed} failed. Ben: ${result.beneficiaries_sent} sent, ${result.beneficiaries_failed} failed.`,
          variant: 'destructive',
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
