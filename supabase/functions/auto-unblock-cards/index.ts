import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting auto-unblock cards job...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- Step 1: Auto-complete active marketplaces whose event has ended ---
    const { data: activeMarketplaces, error: mpFetchError } = await supabase
      .from("marketplace_events")
      .select("id, name, event_date, end_time, status_locked_by_admin")
      .in("status", ["active", "upcoming"]);

    if (mpFetchError) {
      console.error("Error fetching active marketplaces:", mpFetchError);
    } else if (activeMarketplaces && activeMarketplaces.length > 0) {
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
        // Respect admin lock only on the event day itself
        if (mp.status_locked_by_admin && eventDate.toDateString() === now.toDateString()) {
          console.log(`Marketplace "${mp.name}" is admin-locked today, skipping`);
          continue;
        }
        if (now > eventEnd) {
          idsToComplete.push(mp.id);
          console.log(`Marketplace "${mp.name}" has ended, marking completed`);
        }
      }

      if (idsToComplete.length > 0) {
        const { error: mpUpdateError } = await supabase
          .from("marketplace_events")
          .update({ status: "completed", updated_at: new Date().toISOString() })
          .in("id", idsToComplete);

        if (mpUpdateError) {
          console.error("Error completing marketplaces:", mpUpdateError);
        } else {
          console.log(`Auto-completed ${idsToComplete.length} marketplace(s)`);
        }
      } else {
        console.log("No active marketplaces need completing");
      }
    }

    // --- Step 2: Unblock cards from previous days ---
    // Get the start of today (midnight)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISOString = today.toISOString();

    console.log(`Finding cards activated before: ${todayISOString}`);

    // Find all cards that:
    // 1. Have a marketplace_id (were used at an event)
    // 2. Were activated before today
    // 3. Are not already inactive without marketplace
    const { data: blockedCards, error: fetchError } = await supabase
      .from("qr_cards")
      .select("id, unique_id, activated_at, status, marketplace_id")
      .not("marketplace_id", "is", null)
      .lt("activated_at", todayISOString);

    if (fetchError) {
      console.error("Error fetching blocked cards:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${blockedCards?.length || 0} cards to unblock`);

    if (!blockedCards || blockedCards.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No cards to unblock",
          unblocked: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Unblock all found cards
    const cardIds = blockedCards.map(card => card.id);
    
    const { error: updateError } = await supabase
      .from("qr_cards")
      .update({
        status: "inactive",
        credit_balance: 0,
        total_items_collected: 0,
        collected_items: [],
        marketplace_id: null,
        activated_at: null,
      })
      .in("id", cardIds);

    if (updateError) {
      console.error("Error unblocking cards:", updateError);
      throw updateError;
    }

    console.log(`Successfully unblocked ${blockedCards.length} cards`);

    // Log unblocked card IDs for audit
    blockedCards.forEach(card => {
      console.log(`Unblocked card: ${card.unique_id}`);
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Unblocked ${blockedCards.length} cards from previous days`,
        unblocked: blockedCards.length,
        cardIds: blockedCards.map(c => c.unique_id)
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Auto-unblock cards error:", errorMessage);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
