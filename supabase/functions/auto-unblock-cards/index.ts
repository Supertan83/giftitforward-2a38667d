import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Returns the start of "today" in Asia/Dubai (UTC+4) as an ISO timestamp.
// Cards with activated_at < this value are eligible for reset.
function dubaiTodayStartISO(): string {
  const now = new Date();
  // Shift to Dubai wall-clock, zero out the time, shift back to UTC.
  const dubaiNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  dubaiNow.setUTCHours(0, 0, 0, 0);
  const utcMidnight = new Date(dubaiNow.getTime() - 4 * 60 * 60 * 1000);
  return utcMidnight.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = new Date().toISOString();
  console.log(`[auto-unblock-cards] Starting at ${startedAt}`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const todayStart = dubaiTodayStartISO();
    console.log(`[auto-unblock-cards] Dubai "today" cutoff = ${todayStart}`);

    // ---------------------------------------------------------------
    // Step 1: Auto-complete marketplaces whose event has ended
    // ---------------------------------------------------------------
    const { data: activeMarketplaces, error: mpFetchError } = await supabase
      .from("marketplace_events")
      .select("id, name, event_date, end_time, status_locked_by_admin")
      .in("status", ["active", "upcoming"])
      .is("deleted_at", null);

    let mpCompleted = 0;
    if (mpFetchError) {
      console.error("[auto-unblock-cards] Error fetching marketplaces:", mpFetchError);
    } else if (activeMarketplaces?.length) {
      const now = new Date();
      const idsToComplete: string[] = [];
      for (const mp of activeMarketplaces) {
        if (!mp.event_date) continue;
        const eventDate = new Date(mp.event_date);
        const eventEnd = new Date(mp.event_date);
        if (mp.end_time) {
          const [h, m] = mp.end_time.split(":").map(Number);
          eventEnd.setHours(h, m, 0, 0);
        } else {
          eventEnd.setHours(23, 59, 59, 999);
        }
        if (mp.status_locked_by_admin && eventDate.toDateString() === now.toDateString()) continue;
        if (now > eventEnd) idsToComplete.push(mp.id);
      }
      if (idsToComplete.length) {
        const { error: mpUpdateError } = await supabase
          .from("marketplace_events")
          .update({ status: "completed", updated_at: new Date().toISOString() })
          .in("id", idsToComplete);
        if (mpUpdateError) console.error("[auto-unblock-cards] Error completing marketplaces:", mpUpdateError);
        else mpCompleted = idsToComplete.length;
      }
    }
    console.log(`[auto-unblock-cards] Marketplaces auto-completed: ${mpCompleted}`);

    // ---------------------------------------------------------------
    // Step 2: Find ALL stuck cards from previous Dubai days
    // A card is "stuck" if any of these is true AND it wasn't activated today:
    //   - status = 'active'
    //   - status = 'checked_out'
    //   - marketplace_id IS NOT NULL
    // ---------------------------------------------------------------
    const { data: stuckCards, error: fetchError } = await supabase
      .from("qr_cards")
      .select("id, unique_id, status, marketplace_id, activated_at")
      .or(`status.eq.active,status.eq.checked_out,marketplace_id.not.is.null`)
      .or(`activated_at.is.null,activated_at.lt.${todayStart}`)
      .is("deleted_at", null);

    if (fetchError) {
      console.error("[auto-unblock-cards] Error fetching stuck cards:", fetchError);
      throw fetchError;
    }

    const candidates = (stuckCards ?? []).filter(
      (c) => !c.activated_at || new Date(c.activated_at) < new Date(todayStart),
    );

    console.log(
      `[auto-unblock-cards] Fetched ${stuckCards?.length ?? 0} candidate rows; ${candidates.length} qualify for reset`,
    );

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No cards needed reset",
          unblocked: 0,
          marketplaces_completed: mpCompleted,
          dubai_today_start: todayStart,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Breakdown for diagnostics
    const breakdown = { active: 0, checked_out: 0, inactive_with_mp: 0 };
    for (const c of candidates) {
      if (c.status === "active") breakdown.active++;
      else if (c.status === "checked_out") breakdown.checked_out++;
      else if (c.marketplace_id) breakdown.inactive_with_mp++;
    }
    console.log("[auto-unblock-cards] Breakdown:", JSON.stringify(breakdown));

    // ---------------------------------------------------------------
    // Step 3: Reset in chunks of 500 to stay under PostgREST limits
    // ---------------------------------------------------------------
    const cardIds = candidates.map((c) => c.id);
    const chunkSize = 500;
    let resetCount = 0;

    for (let i = 0; i < cardIds.length; i += chunkSize) {
      const chunk = cardIds.slice(i, i + chunkSize);
      const { data: updated, error: updateError } = await supabase
        .from("qr_cards")
        .update({
          status: "inactive",
          credit_balance: 0,
          total_items_collected: 0,
          collected_items: [],
          marketplace_id: null,
          activated_at: null,
        })
        .in("id", chunk)
        .select("id");

      if (updateError) {
        console.error(`[auto-unblock-cards] Update error on chunk ${i / chunkSize}:`, updateError);
        throw updateError;
      }
      resetCount += updated?.length ?? 0;
      console.log(`[auto-unblock-cards] Chunk ${i / chunkSize + 1}: reset ${updated?.length ?? 0} cards`);
    }

    console.log(`[auto-unblock-cards] DONE — total cards reset: ${resetCount} (expected ${candidates.length})`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Reset ${resetCount} stuck cards`,
        unblocked: resetCount,
        candidates: candidates.length,
        breakdown,
        marketplaces_completed: mpCompleted,
        dubai_today_start: todayStart,
        sample_ids: candidates.slice(0, 10).map((c) => c.unique_id),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[auto-unblock-cards] FATAL:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
