import { supabase } from "@/integrations/supabase/client";

export type SurplussEnv = "production" | "staging";

export interface SurplussBatchUpdateResult {
  ok: boolean;
  error?: string;
  httpStatus?: number;
}

/**
 * batch_update via surpluss-allocations-api edge function.
 * Edge always returns HTTP 200; check `success` for upstream Surpluss API result.
 */
export async function surplussBatchUpdateMaterials(
  marketplaceEventId: number,
  materials: Array<{ material_id: number; amount: number }>,
  environment: SurplussEnv = "production",
): Promise<SurplussBatchUpdateResult> {
  if (materials.length === 0) return { ok: true };

  const { data, error } = await supabase.functions.invoke("surpluss-allocations-api", {
    body: {
      action: "batch_update",
      marketplace_event_id: marketplaceEventId,
      materials,
      environment,
    },
  });

  if (error) return { ok: false, error: error.message };
  if (data == null) return { ok: false, error: "No response from surpluss-allocations-api" };

  const success = data.success === true;
  if (!success) {
    const payload = data.data;
    let msg = `Tractor/Surpluss API failed (HTTP ${data.status ?? "?"})`;
    if (payload != null && typeof payload === "object" && "error" in payload) {
      const e = (payload as { error?: unknown }).error;
      if (e != null) msg = typeof e === "string" ? e : String(e);
    }
    return { ok: false, error: msg, httpStatus: data.status };
  }

  return { ok: true, httpStatus: data.status };
}
