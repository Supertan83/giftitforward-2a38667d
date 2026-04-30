import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SyncedAllocation {
  id: string;
  allocation_id: number;
  environment: string;
  marketplace_external_id: number | null;
  synced_at: string;
}

interface MarketplaceWithDistribution {
  id: string;
  name: string;
  external_id: number | null;
  event_date: string | null;
  allocations: Array<{
    id: string;
    item_type_id: string;
    item_name: string;
    external_material_id: number | null;
    allocated_quantity: number;
    distributed_quantity: number;
  }>;
}

interface AllocationForReport {
  allocation_id: number;
  marketplace_external_id: number;
  marketplace_name: string;
  materials: Array<{
    material_id: number;
    distributed: number;
    allocated: number;
  }>;
  total_distributed: number;
  total_allocated: number;
}

interface AllocationMaterialForReport {
  material_id: number;
  distributed: number;
  allocated: number;
}

export const useSyncedAllocationsWithDistribution = (environment: "staging" | "production") => {
  const { toast } = useToast();

  return useQuery({
    queryKey: ["synced_allocations_with_distribution", environment],
    queryFn: async (): Promise<AllocationForReport[]> => {
      // Get synced allocations for the environment
      const { data: syncedAllocations, error: syncError } = await supabase
        .from("surpluss_allocation_sync")
        .select("allocation_id, marketplace_external_id, environment")
        .eq("environment", environment);

      if (syncError) throw syncError;
      if (!syncedAllocations || syncedAllocations.length === 0) return [];

      // Get unique marketplace external IDs
      const marketplaceExternalIds = [
        ...new Set(syncedAllocations.map((a) => a.marketplace_external_id).filter((id): id is number => id !== null)),
      ];

      if (marketplaceExternalIds.length === 0) return [];

      // Get marketplaces with their allocations
      const { data: marketplaces, error: mpError } = await supabase
        .from("marketplace_events")
        .select(
          `
          id,
          name,
          external_id,
          event_date,
          marketplace_item_allocations (
            id,
            item_type_id,
            allocated_quantity,
            distributed_quantity,
            item_types (
              name,
              external_material_id
            )
          )
        `,
        )
        .in("external_id", marketplaceExternalIds);

      if (mpError) throw mpError;

      // Build allocation reports
      const reportsMap = new Map<number, AllocationForReport>();

      syncedAllocations.forEach((sync) => {
        if (!sync.marketplace_external_id) return;

        const marketplace = marketplaces?.find((m) => m.external_id === sync.marketplace_external_id);
        if (!marketplace) return;

        const allocations = marketplace.marketplace_item_allocations || [];

        const materials = allocations
          .filter((a: any) => a.item_types?.external_material_id)
          .map((a: any) => ({
            material_id: a.item_types.external_material_id,
            distributed: a.distributed_quantity,
            allocated: a.allocated_quantity,
          }));

        const totalDistributed = allocations.reduce((sum: number, a: any) => sum + a.distributed_quantity, 0);
        const totalAllocated = allocations.reduce((sum: number, a: any) => sum + a.allocated_quantity, 0);

        reportsMap.set(sync.allocation_id, {
          allocation_id: sync.allocation_id,
          marketplace_external_id: sync.marketplace_external_id,
          marketplace_name: marketplace.name,
          materials,
          total_distributed: totalDistributed,
          total_allocated: totalAllocated,
        });
      });

      return Array.from(reportsMap.values());
    },
  });
};

export const useReportDistribution = () => {
  const [isReporting, setIsReporting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const reportSingleAllocation = async (environment: "staging" | "production", allocation: AllocationForReport) => {
    setIsReporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("report-surpluss-distribution", {
        body: {
          environment,
          allocations: [
            {
              allocation_id: allocation.allocation_id,
              marketplace_external_id: allocation.marketplace_external_id,
              materials: allocation.materials,
            },
          ],
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Report Sent",
          description: `Successfully reported allocation ${allocation.allocation_id}`,
        });
        queryClient.invalidateQueries({ queryKey: ["distribution_reports"] });
      } else {
        throw new Error(data.error || "Failed to report distribution");
      }

      return data;
    } catch (error) {
      toast({
        title: "Report Failed",
        description: error instanceof Error ? error.message : "Failed to send report",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsReporting(false);
    }
  };

  const reportMultipleAllocations = async (
    environment: "staging" | "production",
    allocations: AllocationForReport[],
  ) => {
    setIsReporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("report-surpluss-distribution", {
        body: {
          environment,
          allocations: allocations.map((a) => ({
            allocation_id: a.allocation_id,
            marketplace_external_id: a.marketplace_external_id,
            materials: a.materials,
          })),
        },
      });

      if (error) throw error;

      toast({
        title: "Reports Sent",
        description: `Reported ${data.reported_count || allocations.length} allocations. ${data.failed_count || 0} failed.`,
      });

      queryClient.invalidateQueries({ queryKey: ["distribution_reports"] });
      return data;
    } catch (error) {
      toast({
        title: "Reporting Failed",
        description: error instanceof Error ? error.message : "Failed to send reports",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsReporting(false);
    }
  };

  const reportMarketplaceDistribution = async (environment: "staging" | "production", marketplaceId: string) => {
    setIsReporting(true);
    try {
      const { data: marketplace, error: mpError } = await supabase
        .from("marketplace_events")
        .select("id, name, external_id")
        .eq("id", marketplaceId)
        .single();

      if (mpError) throw mpError;
      if (!marketplace?.external_id) {
        throw new Error("Selected marketplace has no Surpluss external_id");
      }

      // PRE-FLIGHT: Detect missing surpluss_allocation_id mappings and auto re-sync
      const { data: allAllocations, error: preflightError } = await supabase
        .from("marketplace_item_allocations")
        .select("id, surpluss_allocation_id, item_types ( name, external_material_id )")
        .eq("marketplace_id", marketplaceId)
        .is("deleted_at", null);

      if (preflightError) throw preflightError;

      let allocationsResynced = 0;
      const missingMapping = (allAllocations || []).filter((a: any) => !a.surpluss_allocation_id);
      if (missingMapping.length > 0) {
        console.log(`[distribution] ${missingMapping.length} allocation(s) missing surpluss_allocation_id — running auto re-sync`);
        const { error: syncErr } = await supabase.functions.invoke("sync-surpluss-event-allocations", {
          body: { marketplace_id: marketplaceId, environment },
        });
        if (syncErr) {
          console.warn("[distribution] auto re-sync failed:", syncErr);
        } else {
          allocationsResynced = missingMapping.length;
        }
      }

      // Re-read allocations after potential re-sync
      const { data: allocations, error: allocError } = await supabase
        .from("marketplace_item_allocations")
        .select(
          `
          id,
          item_type_id,
          allocated_quantity,
          distributed_quantity,
          surpluss_allocation_id,
          item_types (
            name,
            external_material_id
          )
        `,
        )
        .eq("marketplace_id", marketplaceId)
        .is("deleted_at", null);

      if (allocError) throw allocError;

      const { data: manualCounts, error: manualError } = await supabase
        .from("marketplace_manual_counts")
        .select("item_type_id, actual_distributed, actual_remaining")
        .eq("marketplace_id", marketplaceId);

      if (manualError) throw manualError;

      const manualMap = new Map((manualCounts || []).map((m: any) => [m.item_type_id, m]));

      const grouped = new Map<number, AllocationMaterialForReport[]>();

      for (const alloc of allocations || []) {
        const materialId = (alloc as any).item_types?.external_material_id;
        const surplussAllocationId = alloc.surpluss_allocation_id;
        if (!materialId || !surplussAllocationId) continue;

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

      if (!payloadAllocations.length) {
        throw new Error("No synced allocation/material mapping found for this marketplace");
      }

      const { data, error } = await supabase.functions.invoke("report-surpluss-distribution", {
        body: {
          environment,
          allocations: payloadAllocations,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to report marketplace distribution");

      toast({
        title: "Distribution Sent",
        description: `${marketplace.name}: ${data.reported_count || payloadAllocations.length} allocation report(s) sent.`,
      });

      queryClient.invalidateQueries({ queryKey: ["distribution_reports"] });
      return data;
    } catch (error) {
      toast({
        title: "Distribution Reporting Failed",
        description: error instanceof Error ? error.message : "Failed to send distribution report",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsReporting(false);
    }
  };

  return {
    isReporting,
    reportSingleAllocation,
    reportMultipleAllocations,
    reportMarketplaceDistribution,
  };
};
