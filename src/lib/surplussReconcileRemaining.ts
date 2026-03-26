import { supabase } from "@/integrations/supabase/client";
import type { SurplussEnv } from "@/lib/surplussDonationMetadata";

export interface ReconcileRemainingPayload {
  material_id: number;
  donation_metadata_id: number;
  item_count: number;
  total_allocated_derived: number;
  total_remaining_item_count_before: number;
  total_remaining_item_count_after: number;
  allocations_by_marketplace_after: Record<string, number>;
  allocation_rows_scanned: number;
  dry_run: boolean;
  metadata_after?: unknown;
}

type EdgeEnvelope = {
  success?: boolean;
  status?: number;
  data?: { success?: boolean; data?: ReconcileRemainingPayload; error?: string };
};

/**
 * Recompute Tractor donation_metadata.remaining from active allocation rows (fixes QR vs GIF drift).
 */
export async function surplussReconcileDonationRemaining(
  materialId: number,
  options?: { dry_run?: boolean; environment?: SurplussEnv },
): Promise<{ ok: true; payload: ReconcileRemainingPayload } | { ok: false; error: string; httpStatus?: number }> {
  const { data, error } = await supabase.functions.invoke("surpluss-allocations-api", {
    body: {
      action: "reconcile_donation_remaining",
      material_id: materialId,
      dry_run: options?.dry_run === true,
      environment: options?.environment ?? "production",
    },
  });

  if (error) return { ok: false, error: error.message };
  if (data == null) return { ok: false, error: "No response from surpluss-allocations-api" };

  const envelope = data as EdgeEnvelope;
  if (!envelope.success) {
    const inner = envelope.data;
    const msg =
      inner && typeof inner === "object" && "error" in inner && inner.error != null
        ? String(inner.error)
        : `Tractor request failed (HTTP ${envelope.status ?? "?"})`;
    return { ok: false, error: msg, httpStatus: envelope.status };
  }

  const inner = envelope.data;
  if (!inner?.success || inner.data == null) {
    const msg = inner && typeof inner.error === "string" ? inner.error : "Invalid Tractor response";
    return { ok: false, error: msg, httpStatus: envelope.status };
  }

  return { ok: true, payload: inner.data };
}
