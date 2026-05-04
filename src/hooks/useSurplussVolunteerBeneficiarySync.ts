import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SyncResult {
  success: boolean;
  volunteers_sent: number;
  volunteers_failed: number;
  volunteers_skipped: number;
  volunteers_bulk_updated: number;
  volunteers_attached_to_event: number;
  volunteers_total: number;
  volunteer_details: { name: string; status: string; reason?: string }[];
  family_total: number;
  family_sent: number;
  family_skipped: number;
  family_failed: number;
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
  distribution_items_reported: number;
  distribution_items_total: number;
  distribution_skipped_items: string[];
  allocations_resynced: number;
  errors: string[];
}

export type SurplussSyncStep = 'idle' | 'volunteers' | 'beneficiaries' | 'distribution';

const STEP_LABELS: Record<SurplussSyncStep, string> = {
  idle: '',
  volunteers: 'Syncing volunteers… (1/3)',
  beneficiaries: 'Syncing beneficiaries… (2/3)',
  distribution: 'Reporting distribution… (3/3)',
};

async function extractFunctionError(err: unknown, fallback: string): Promise<string> {
  try {
    const anyErr = err as any;
    // supabase-js FunctionsHttpError exposes .context (Response) when available
    if (anyErr?.context && typeof anyErr.context.json === 'function') {
      const body = await anyErr.context.json().catch(() => null);
      if (body?.error) return typeof body.error === 'string' ? body.error : JSON.stringify(body.error);
      if (body?.message) return body.message;
    }
    if (anyErr?.message) return anyErr.message;
  } catch {
    /* swallow */
  }
  return fallback;
}

export const useSurplussVolunteerBeneficiarySync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentStep, setCurrentStep] = useState<SurplussSyncStep>('idle');
  const { toast } = useToast();

  const syncToSurpluss = async (
    marketplaceId: string,
    environment: 'staging' | 'production'
  ): Promise<SyncResult | null> => {
    setIsSyncing(true);
    setCurrentStep('volunteers');

    let failedStep: SurplussSyncStep | null = null;

    try {
      // 1. Sync volunteers & demographics
      let volData: any = null;
      try {
        const { data, error } = await supabase.functions.invoke('sync-surpluss-volunteer-beneficiary', {
          body: { marketplace_id: marketplaceId, environment },
        });
        if (error) {
          failedStep = 'volunteers';
          const msg = await extractFunctionError(error, 'Volunteer sync failed');
          throw new Error(msg);
        }
        volData = data;
      } catch (err) {
        if (!failedStep) failedStep = 'volunteers';
        throw err;
      }

      // 2. Sync beneficiaries (paginated — loop until done to avoid edge timeout)
      setCurrentStep('beneficiaries');
      let benData: any = {
        success: true,
        beneficiaries_sent: 0,
        beneficiaries_failed: 0,
        beneficiaries_skipped: 0,
        beneficiaries_total: 0,
        marketplace_events_updated: 0,
        marketplace_events_failed: 0,
        beneficiary_details: [] as any[],
        errors: [] as string[],
      };
      try {
        let offset = 0;
        const BATCH = 80;
        for (let i = 0; i < 30; i++) {
          const { data, error } = await supabase.functions.invoke('sync-surpluss-beneficiaries', {
            body: { marketplace_id: marketplaceId, environment, batch_size: BATCH, offset },
          });
          if (error) {
            failedStep = 'beneficiaries';
            const msg = await extractFunctionError(error, 'Beneficiary sync failed');
            throw new Error(msg);
          }
          benData.beneficiaries_sent += data?.beneficiaries_sent ?? 0;
          benData.beneficiaries_failed += data?.beneficiaries_failed ?? 0;
          benData.beneficiaries_skipped += data?.beneficiaries_skipped ?? 0;
          benData.beneficiaries_total = data?.beneficiaries_total ?? benData.beneficiaries_total;
          benData.marketplace_events_updated += data?.marketplace_events_updated ?? 0;
          benData.marketplace_events_failed += data?.marketplace_events_failed ?? 0;
          benData.beneficiary_details.push(...(data?.beneficiary_details ?? []));
          benData.errors.push(...(data?.errors ?? []));
          if (data?.success === false) benData.success = false;
          if (data?.done) break;
          offset = data?.next_offset ?? (offset + BATCH);
        }
      } catch (err) {
        if (!failedStep) failedStep = 'beneficiaries';
        throw err;
      }

      // 3. Report distribution figures (non-fatal — capture in result)
      setCurrentStep('distribution');
      let distributionReported = false;
      let distributionError: string | null = null;
      let distributionAllocationsSent = 0;
      let distributionItemsReported = 0;
      let distributionItemsTotal = 0;
      let distributionSkippedItems: string[] = [];
      let allocationsResynced = 0;

      try {
        const { data: marketplace, error: mpError } = await supabase
          .from('marketplace_events')
          .select('id, name, external_id')
          .eq('id', marketplaceId)
          .single();

        if (mpError) throw mpError;
        if (!marketplace?.external_id) {
          throw new Error('Marketplace has no Surpluss external_id');
        }

        // PRE-FLIGHT: detect missing surpluss_allocation_id mappings, auto re-sync
        const { data: preAllocations } = await supabase
          .from('marketplace_item_allocations')
          .select('id, surpluss_allocation_id')
          .eq('marketplace_id', marketplaceId)
          .is('deleted_at', null);

        const missing = (preAllocations || []).filter((a: any) => !a.surpluss_allocation_id);
        if (missing.length > 0) {
          console.log(`[sync] ${missing.length} allocation(s) missing mapping — auto re-syncing`);
          const { error: resyncErr } = await supabase.functions.invoke('sync-surpluss-event-allocations', {
            body: { marketplace_id: marketplaceId, environment },
          });
          if (!resyncErr) {
            allocationsResynced = missing.length;
          } else {
            console.warn('[sync] auto allocation re-sync failed:', resyncErr);
          }
        }

        const { data: allocations, error: allocError } = await supabase
          .from('marketplace_item_allocations')
          .select(`
            id, item_type_id, allocated_quantity, distributed_quantity, surpluss_allocation_id,
            item_types ( name, external_material_id )
          `)
          .eq('marketplace_id', marketplaceId)
          .is('deleted_at', null);

        if (allocError) throw allocError;

        distributionItemsTotal = (allocations || []).length;

        const { data: manualCounts } = await supabase
          .from('marketplace_manual_counts')
          .select('item_type_id, actual_distributed, actual_remaining')
          .eq('marketplace_id', marketplaceId);

        const manualMap = new Map((manualCounts || []).map((m: any) => [m.item_type_id, m]));

        const grouped = new Map<number, { material_id: number; distributed: number; allocated: number }[]>();

        for (const alloc of allocations || []) {
          const materialId = (alloc as any).item_types?.external_material_id;
          const itemName = (alloc as any).item_types?.name || 'Unknown item';
          const surplussAllocationId = alloc.surpluss_allocation_id;
          if (!materialId || !surplussAllocationId) {
            const reason = !surplussAllocationId ? 'no Surpluss allocation mapping' : 'no material mapping';
            distributionSkippedItems.push(`'${itemName}' (${reason})`);
            continue;
          }

          const manual = manualMap.get(alloc.item_type_id);
          const distributed = manual ? Number(manual.actual_distributed || 0) : Number(alloc.distributed_quantity || 0);
          const remaining = manual
            ? Number(manual.actual_remaining || 0)
            : Number((alloc.allocated_quantity || 0) - (alloc.distributed_quantity || 0));
          const allocated = Math.max(distributed + remaining, 0);

          if (!grouped.has(surplussAllocationId)) grouped.set(surplussAllocationId, []);
          grouped.get(surplussAllocationId)!.push({
            material_id: Number(materialId),
            distributed,
            allocated,
          });
        }

        const payloadAllocations = Array.from(grouped.entries()).map(([allocationId, materials]) => ({
          allocation_id: allocationId,
          marketplace_external_id: Number(marketplace.external_id),
          materials,
        }));

        distributionItemsReported = Array.from(grouped.values()).reduce((s, m) => s + m.length, 0);

        if (payloadAllocations.length > 0) {
          const { data: distData, error: distError } = await supabase.functions.invoke('report-surpluss-distribution', {
            body: { environment, allocations: payloadAllocations },
          });

          if (distError) {
            const msg = await extractFunctionError(distError, 'Distribution report failed');
            throw new Error(msg);
          }
          if (!distData?.success) throw new Error(distData?.error || 'Distribution report failed');

          distributionReported = true;
          distributionAllocationsSent = distData.reported_count || payloadAllocations.length;
        } else {
          distributionError = distributionSkippedItems.length > 0
            ? `No mapped items to report. Skipped ${distributionSkippedItems.length}: ${distributionSkippedItems.slice(0, 2).join(', ')}`
            : 'No synced allocation/material mapping found';
        }
      } catch (err) {
        distributionError = err instanceof Error ? err.message : 'Distribution reporting failed';
      }

      const result: SyncResult = {
        success: (volData?.success !== false) && (benData?.success !== false),
        volunteers_sent: volData?.volunteers_sent ?? 0,
        volunteers_failed: volData?.volunteers_failed ?? 0,
        volunteers_skipped: volData?.volunteers_skipped ?? 0,
        volunteers_bulk_updated: volData?.volunteers_bulk_updated ?? 0,
        volunteers_total: volData?.volunteers_total ?? 0,
        volunteer_details: volData?.volunteer_details ?? [],
        family_total: volData?.family_total ?? 0,
        family_sent: volData?.family_sent ?? 0,
        family_skipped: volData?.family_skipped ?? 0,
        family_failed: volData?.family_failed ?? 0,
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
        distribution_reported: distributionReported,
        distribution_error: distributionError,
        distribution_allocations_sent: distributionAllocationsSent,
        distribution_items_reported: distributionItemsReported,
        distribution_items_total: distributionItemsTotal,
        distribution_skipped_items: distributionSkippedItems,
        allocations_resynced: allocationsResynced,
        errors: [...(volData?.errors ?? []), ...(benData?.errors ?? []), ...(distributionError ? [distributionError] : [])],
      };

      const resyncNote = allocationsResynced > 0 ? ` Re-synced ${allocationsResynced} mapping(s).` : '';
      const skipNote = distributionSkippedItems.length > 0
        ? ` Skipped ${distributionSkippedItems.length} item(s).`
        : '';
      const distStatus = distributionReported
        ? `Distribution: ${distributionItemsReported}/${distributionItemsTotal} item(s) reported.${resyncNote}${skipNote}`
        : distributionError
        ? `Distribution: failed (${distributionError}).${resyncNote}`
        : '';

      const hasIssues = !result.success || !!distributionError || distributionSkippedItems.length > 0;

      // Volunteers summary: combine new (sent) + bulk-updated so users see real impact
      const volTouched = result.volunteers_sent + result.volunteers_bulk_updated;
      const volSummary = result.volunteers_bulk_updated > 0
        ? `Volunteers: ${volTouched} updated (${result.volunteers_sent} new, ${result.volunteers_bulk_updated} updated)`
        : `Volunteers: ${result.volunteers_sent} sent`;

      if (!hasIssues) {
        toast({
          title: 'Sync Complete',
          description: `${volSummary}. Beneficiaries: ${result.beneficiaries_sent} sent, ${result.beneficiaries_skipped} skipped. ${distStatus}`,
        });
      } else {
        toast({
          title: result.success ? 'Sync Complete with Warnings' : 'Sync Completed with Issues',
          description: `${volSummary}, ${result.volunteers_failed} failed. Ben: ${result.beneficiaries_sent} sent, ${result.beneficiaries_failed} failed. ${distStatus}`,
          variant: 'destructive',
        });
      }

      return result;
    } catch (error) {
      const stepLabel = failedStep ? ` (step: ${failedStep})` : '';
      toast({
        title: `Sync Failed${stepLabel}`,
        description: error instanceof Error ? error.message : 'Failed to sync to Surpluss',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsSyncing(false);
      setCurrentStep('idle');
    }
  };

  return { isSyncing, currentStep, currentStepLabel: STEP_LABELS[currentStep], syncToSurpluss };
};
