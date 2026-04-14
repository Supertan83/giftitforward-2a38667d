import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { marketplace_id, mode } = await req.json();

    if (!marketplace_id) {
      return new Response(JSON.stringify({ error: "marketplace_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tables that have marketplace_id column
    const tables = [
      { name: "qr_cards", column: "marketplace_id" },
      { name: "transactions", column: "marketplace_id" },
      { name: "marketplace_item_allocations", column: "marketplace_id" },
      { name: "marketplace_manual_counts", column: "marketplace_id" },
      { name: "archived_card_data", column: "marketplace_id" },
      { name: "allocation_traceability_logs", column: "marketplace_id" },
      { name: "volunteer_qr_cards", column: "marketplace_id" },
      { name: "volunteer_attendance", column: "marketplace_id" },
      { name: "external_survey_responses", column: "marketplace_id" },
      { name: "pending_beneficiaries", column: "marketplace_event_id" },
    ];

    if (mode === "preview") {
      // Count rows per table
      const stats: Record<string, number> = {};

      // Marketplace itself
      const { count: mCount } = await supabase
        .from("marketplace_events")
        .select("*", { count: "exact", head: true })
        .eq("id", marketplace_id)
        .is("deleted_at", null);
      stats["marketplace_events"] = mCount ?? 0;

      for (const t of tables) {
        const { count } = await supabase
          .from(t.name)
          .select("*", { count: "exact", head: true })
          .eq(t.column, marketplace_id)
          .is("deleted_at", null);
        stats[t.name] = count ?? 0;
      }

      return new Response(JSON.stringify({ stats }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // mode === 'delete' (soft delete)
    const now = new Date().toISOString();
    const results: Record<string, number> = {};

    // Soft delete marketplace_events
    const { data: mData } = await supabase
      .from("marketplace_events")
      .update({ deleted_at: now })
      .eq("id", marketplace_id)
      .is("deleted_at", null)
      .select("id");
    results["marketplace_events"] = mData?.length ?? 0;

    // Soft delete related tables
    for (const t of tables) {
      const { data } = await supabase
        .from(t.name)
        .update({ deleted_at: now } as any)
        .eq(t.column, marketplace_id)
        .is("deleted_at", null)
        .select("id");
      results[t.name] = data?.length ?? 0;
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
