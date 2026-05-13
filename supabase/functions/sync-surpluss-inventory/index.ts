// Sync Surpluss Mini Inventory
// Pushes complete GIF inventory snapshot to Surpluss in two phases:
//   1) For every marketplace with an external_id: report current distributed/remaining
//      to /donation-allocations/distribution (per allocation, per material).
//   2) For every material with an external_material_id: trigger
//      /donation-metadata/{id}/reconcile-remaining so Surpluss recomputes donor
//      "remaining" = received - SUM(allocated across all marketplaces).
//
// Result: Surpluss "Total Items Donated" widget reflects GIF reality:
//   - distributed = SUM of GIF distributions (manual override aware)
//   - remaining   = received - SUM(allocated)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  environment?: "staging" | "production";
  dry_run?: boolean;
  skip_distribution?: boolean;
  skip_reconcile?: boolean;
}

interface MaterialReport {
  material_id: number;
  distributed: number;
  allocated: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: Body = await req.json().catch(() => ({}));
    const environment: "staging" | "production" = body.environment ?? "production";
    const dryRun = body.dry_run === true;

    const baseUrl =
      environment === "production"
        ? "https://api.thesurpluss.com"
        : "https://surpluss-server.herokuapp.com";
    const apiBase = `${baseUrl}/api/common`;

    const apiKey = Deno.env.get("SURPLUSS_API_KEY") ?? "";
    const apiHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (apiKey) apiHeaders["Authorization"] = `Bearer ${apiKey}`;

    const summary = {
      environment,
      dry_run: dryRun,
      marketplaces_total: 0,
      marketplaces_reported: 0,
      marketplaces_failed: 0,
      allocations_reported: 0,
      materials_total: 0,
      materials_reconciled: 0,
      materials_drifted: 0,
      materials_failed: 0,
      errors: [] as Array<{ scope: string; id: string | number; error: string }>,
    };

    // ===== PHASE 1: Per-marketplace distribution reporting =====
    if (!body.skip_distribution) {
      const { data: marketplaces, error: mpErr } = await supabase
        .from("marketplace_events")
        .select("id, name, external_id")
        .not("external_id", "is", null)
        .is("deleted_at", null);

      if (mpErr) throw new Error(`Failed to load marketplaces: ${mpErr.message}`);

      summary.marketplaces_total = marketplaces?.length ?? 0;

      for (const mp of marketplaces ?? []) {
        try {
          const { data: allocations, error: aErr } = await supabase
            .from("marketplace_item_allocations")
            .select(
              "id, item_type_id, allocated_quantity, distributed_quantity, surpluss_allocation_id, item_types ( name, external_material_id )",
            )
            .eq("marketplace_id", mp.id)
            .is("deleted_at", null);

          if (aErr) throw aErr;

          const { data: manuals } = await supabase
            .from("marketplace_manual_counts")
            .select("item_type_id, actual_distributed, actual_remaining")
            .eq("marketplace_id", mp.id)
            .is("deleted_at", null);

          const manualMap = new Map<string, { d: number; r: number }>();
          (manuals ?? []).forEach((m: any) => {
            manualMap.set(m.item_type_id, {
              d: Number(m.actual_distributed || 0),
              r: Number(m.actual_remaining || 0),
            });
          });

          // Group materials by surpluss_allocation_id
          const grouped = new Map<number, MaterialReport[]>();
          for (const a of allocations ?? []) {
            const allocId = (a as any).surpluss_allocation_id as number | null;
            const matId = (a as any).item_types?.external_material_id as number | null;
            if (!allocId || !matId) continue;

            const m = manualMap.get(a.item_type_id);
            const distributed = m ? m.d : Number(a.distributed_quantity || 0);
            const remaining = m
              ? m.r
              : Math.max(Number(a.allocated_quantity || 0) - Number(a.distributed_quantity || 0), 0);
            const allocated = Math.max(distributed + remaining, 0);

            if (!grouped.has(allocId)) grouped.set(allocId, []);
            grouped.get(allocId)!.push({ material_id: Number(matId), distributed, allocated });
          }

          if (grouped.size === 0) continue;

          const reportedAt = new Date().toISOString();
          const apiAllocations = Array.from(grouped.entries()).map(([allocationId, materials]) => ({
            id: allocationId,
            distributed_materials: materials.map((m) => ({
              material_id: m.material_id,
              distributed_amount: m.distributed,
              remaining_amount: m.allocated - m.distributed,
            })),
            total_distributed: materials.reduce((s, m) => s + m.distributed, 0),
            total_remaining: materials.reduce((s, m) => s + (m.allocated - m.distributed), 0),
            status: materials.every((m) => m.distributed >= m.allocated) ? "completed" : "in_progress",
            reported_at: reportedAt,
          }));

          if (!dryRun) {
            const url = `${apiBase}/donation-allocations/distribution`;
            const res = await fetch(url, {
              method: "PUT",
              headers: apiHeaders,
              body: JSON.stringify({ allocations: apiAllocations }),
            });
            const txt = await res.text();
            let json: any;
            try {
              json = JSON.parse(txt);
            } catch {
              json = { raw: txt };
            }

            // Persist one report row per allocation
            for (const [allocationId, materials] of grouped.entries()) {
              const dist = materials.reduce((s, m) => s + m.distributed, 0);
              const alloc = materials.reduce((s, m) => s + m.allocated, 0);
              await supabase.from("surpluss_distribution_reports").insert({
                allocation_id: allocationId,
                environment,
                marketplace_external_id: mp.external_id,
                distributed_total: dist,
                allocated_total: alloc,
                api_response_status: res.status,
                api_response_body: json,
                reported_at: reportedAt,
              });
            }

            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
            }
          }

          summary.marketplaces_reported++;
          summary.allocations_reported += grouped.size;
        } catch (e: any) {
          summary.marketplaces_failed++;
          summary.errors.push({
            scope: "marketplace",
            id: mp.id,
            error: `${mp.name}: ${e.message ?? e}`,
          });
        }
      }
    }

    // ===== PHASE 2: Per-material reconcile remaining =====
    if (!body.skip_reconcile) {
      const { data: materials, error: matErr } = await supabase
        .from("item_types")
        .select("id, name, external_material_id")
        .not("external_material_id", "is", null)
        .is("deleted_at", null);

      if (matErr) throw new Error(`Failed to load materials: ${matErr.message}`);

      summary.materials_total = materials?.length ?? 0;

      const BATCH = 10;
      for (let i = 0; i < (materials?.length ?? 0); i += BATCH) {
        const batch = (materials ?? []).slice(i, i + BATCH);
        const results = await Promise.all(
          batch.map(async (mat: any) => {
            try {
              if (dryRun) return { ok: true, drifted: false };
              const url = `${apiBase}/donation-metadata/${mat.external_material_id}/reconcile-remaining`;
              const res = await fetch(url, {
                method: "POST",
                headers: apiHeaders,
                body: JSON.stringify({ dry_run: false }),
              });
              const txt = await res.text();
              let json: any;
              try {
                json = JSON.parse(txt);
              } catch {
                json = { raw: txt };
              }
              if (!res.ok || !json?.success) {
                return {
                  ok: false,
                  drifted: false,
                  err: `${mat.external_material_id} (${mat.name}): HTTP ${res.status} ${json?.error ?? ""}`,
                };
              }
              const d = json.data ?? {};
              const drifted =
                d.total_remaining_item_count_before !== d.total_remaining_item_count_after;
              return { ok: true, drifted };
            } catch (e: any) {
              return {
                ok: false,
                drifted: false,
                err: `${mat.external_material_id} (${mat.name}): ${e.message ?? e}`,
              };
            }
          }),
        );
        for (const r of results) {
          if (r.ok) {
            summary.materials_reconciled++;
            if (r.drifted) summary.materials_drifted++;
          } else {
            summary.materials_failed++;
            if (r.err) summary.errors.push({ scope: "material", id: 0, error: r.err });
          }
        }
      }
    }

    // Audit
    try {
      await supabase.from("surpluss_api_audit_log").insert({
        action: "sync_inventory_snapshot",
        environment,
        request_payload: { dry_run: dryRun },
        response_status: 200,
        response_body: summary,
        success: summary.marketplaces_failed === 0 && summary.materials_failed === 0,
      });
    } catch (_) { /* ignore audit errors */ }

    return new Response(JSON.stringify({ success: true, summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ success: false, error: e?.message ?? String(e) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
