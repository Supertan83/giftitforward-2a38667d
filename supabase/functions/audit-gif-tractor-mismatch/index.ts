// Diagnostic: compare GIF allocations totals vs Tractor donation_metadata for every material.
// Read-only — no writes. Returns a JSON report listing materials where:
//   - GIF total allocated > Tractor item_count (over-allocation), OR
//   - Tractor allocations_by_marketplace ≠ GIF allocations (sync drift / missing pushes)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SURPLUSS_ENDPOINTS = {
  staging: "https://surpluss-server.herokuapp.com/api",
  production: "https://api.thesurpluss.com/api",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const environment = (body.environment ?? "production") as "production" | "staging";
    const apiBase = SURPLUSS_ENDPOINTS[environment];
    const apiKey = Deno.env.get("SURPLUSS_API_KEY")!;

    // 1. All GIF item_types with external_material_id + their allocations (with marketplace external_id)
    const { data: items, error: itemsErr } = await supabase
      .from("item_types")
      .select("id, name, external_material_id, total_stock")
      .not("external_material_id", "is", null)
      .order("external_material_id");
    if (itemsErr) throw itemsErr;

    const { data: allocs, error: allocErr } = await supabase
      .from("marketplace_item_allocations")
      .select("item_type_id, allocated_quantity, distributed_quantity, marketplace_id, deleted_at, marketplace_events!inner(name, external_id, event_date, deleted_at)")
      .is("deleted_at", null)
      .is("marketplace_events.deleted_at", null);
    if (allocErr) throw allocErr;

    // Group GIF allocations by item_type_id
    const gifByItem: Record<string, Array<{ ext_event_id: number | null; mp_name: string; allocated: number; distributed: number; event_date: string | null }>> = {};
    for (const a of allocs ?? []) {
      const me: any = (a as any).marketplace_events;
      if (!gifByItem[a.item_type_id]) gifByItem[a.item_type_id] = [];
      gifByItem[a.item_type_id].push({
        ext_event_id: me?.external_id != null ? Number(me.external_id) : null,
        mp_name: me?.name ?? "?",
        allocated: a.allocated_quantity,
        distributed: a.distributed_quantity,
        event_date: me?.event_date ?? null,
      });
    }

    // 2. Fetch Tractor donation-metadata for each material in parallel batches of 10
    const matIds = items!.map((i) => i.external_material_id as number).filter(Boolean);
    const tractorByMat: Record<number, { item_count: number; remaining: number; allocations_by_marketplace: Record<string, number>; error?: string }> = {};

    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "x-api-key": apiKey,
    };

    const BATCH = 10;
    for (let i = 0; i < matIds.length; i += BATCH) {
      const slice = matIds.slice(i, i + BATCH);
      await Promise.all(slice.map(async (mid) => {
        try {
          const r = await fetch(`${apiBase}/common/donation-metadata/${mid}`, { headers });
          const text = await r.text();
          let j: any; try { j = JSON.parse(text); } catch { j = null; }
          if (r.ok && j?.success && j?.data) {
            const d = j.data;
            tractorByMat[mid] = {
              item_count: Number(d.material?.item_count ?? 0),
              remaining: Number(d.total_remaining_item_count ?? 0),
              allocations_by_marketplace: d.allocations_by_marketplace ?? {},
            };
          } else {
            tractorByMat[mid] = { item_count: 0, remaining: 0, allocations_by_marketplace: {}, error: j?.error || j?.message || `HTTP ${r.status}` };
          }
        } catch (e: any) {
          tractorByMat[mid] = { item_count: 0, remaining: 0, allocations_by_marketplace: {}, error: e.message };
        }
      }));
    }

    // 3. Build report
    type Issue = {
      material_id: number;
      name: string;
      tractor_item_count: number;
      tractor_remaining: number;
      tractor_allocated_total: number;
      gif_allocated_total: number;
      gif_distributed_total: number;
      over_allocated: boolean; // gif_allocated_total > tractor_item_count
      drift: number; // gif_allocated_total - tractor_allocated_total
      missing_in_tractor: Array<{ ext_event_id: number | null; mp_name: string; gif_allocated: number; tractor_allocated: number; event_date: string | null }>;
      tractor_only: Array<{ ext_event_id: string; tractor_allocated: number }>;
      tractor_error?: string;
    };

    const issues: Issue[] = [];
    let perfect = 0;
    for (const item of items!) {
      const mid = item.external_material_id as number;
      const t = tractorByMat[mid];
      const gifAllocs = gifByItem[item.id] ?? [];
      const gifAllocTotal = gifAllocs.reduce((s, a) => s + a.allocated, 0);
      const gifDistTotal = gifAllocs.reduce((s, a) => s + a.distributed, 0);

      const tractorAllocs = t?.allocations_by_marketplace ?? {};
      const tractorAllocTotal = Object.values(tractorAllocs).reduce((s, v) => s + Number(v), 0);

      const missing: Issue["missing_in_tractor"] = [];
      for (const g of gifAllocs) {
        if (g.ext_event_id == null) continue;
        const tVal = Number(tractorAllocs[String(g.ext_event_id)] ?? 0);
        if (tVal !== g.allocated) {
          missing.push({
            ext_event_id: g.ext_event_id,
            mp_name: g.mp_name,
            gif_allocated: g.allocated,
            tractor_allocated: tVal,
            event_date: g.event_date,
          });
        }
      }
      const gifEventIds = new Set(gifAllocs.map((g) => g.ext_event_id != null ? String(g.ext_event_id) : null).filter(Boolean));
      const tractorOnly: Issue["tractor_only"] = [];
      for (const [evId, qty] of Object.entries(tractorAllocs)) {
        if (!gifEventIds.has(evId)) tractorOnly.push({ ext_event_id: evId, tractor_allocated: Number(qty) });
      }

      const overAllocated = t ? gifAllocTotal > t.item_count : false;
      const hasIssue = !!t?.error || missing.length > 0 || tractorOnly.length > 0 || overAllocated;
      if (!hasIssue) {
        perfect++;
        continue;
      }

      issues.push({
        material_id: mid,
        name: item.name,
        tractor_item_count: t?.item_count ?? 0,
        tractor_remaining: t?.remaining ?? 0,
        tractor_allocated_total: tractorAllocTotal,
        gif_allocated_total: gifAllocTotal,
        gif_distributed_total: gifDistTotal,
        over_allocated: overAllocated,
        drift: gifAllocTotal - tractorAllocTotal,
        missing_in_tractor: missing,
        tractor_only: tractorOnly,
        tractor_error: t?.error,
      });
    }

    issues.sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));

    return new Response(
      JSON.stringify({
        environment,
        summary: {
          total_materials: items!.length,
          perfectly_synced: perfect,
          materials_with_issues: issues.length,
          over_allocated_count: issues.filter((i) => i.over_allocated).length,
          drift_total_units: issues.reduce((s, i) => s + Math.abs(i.drift), 0),
        },
        issues,
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
