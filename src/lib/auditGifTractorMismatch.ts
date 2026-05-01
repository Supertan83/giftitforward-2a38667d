import { supabase } from "@/integrations/supabase/client";

export interface MismatchIssue {
  material_id: number;
  name: string;
  tractor_item_count: number;
  tractor_remaining: number;
  tractor_allocated_total: number;
  gif_allocated_total: number;
  gif_distributed_total: number;
  over_allocated: boolean;
  drift: number;
  missing_in_tractor: Array<{
    ext_event_id: number | null;
    mp_name: string;
    gif_allocated: number;
    tractor_allocated: number;
    event_date: string | null;
  }>;
  tractor_only: Array<{ ext_event_id: string; tractor_allocated: number }>;
  tractor_error?: string;
}

export interface MismatchReport {
  environment: string;
  summary: {
    total_materials: number;
    perfectly_synced: number;
    materials_with_issues: number;
    over_allocated_count: number;
    drift_total_units: number;
  };
  issues: MismatchIssue[];
}

/** Compares GIF allocation totals vs Tractor donation_metadata for every material. Read-only. */
export async function auditGifTractorMismatch(
  environment: "production" | "staging" = "production",
): Promise<{ ok: true; report: MismatchReport } | { ok: false; error: string }> {
  const { data, error } = await supabase.functions.invoke("audit-gif-tractor-mismatch", {
    body: { environment },
  });
  if (error) return { ok: false, error: error.message };
  if (!data || (data as any).error) return { ok: false, error: (data as any)?.error ?? "Unknown error" };
  return { ok: true, report: data as MismatchReport };
}
