import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const ahlamId = '71579f66-931f-4dc3-8f90-47a1b4a30ed6';
    const feb22MarketplaceId = '261089f4-3f30-46c4-a5d5-d666a4618df0';
    const results: string[] = [];

    // 1. Get current events_json
    const { data: ahlam, error: fetchErr } = await supabase
      .from('pending_volunteers')
      .select('events_json')
      .eq('id', ahlamId)
      .single();

    if (fetchErr || !ahlam) throw new Error('Ahlam not found: ' + fetchErr?.message);

    const eventsJson = ahlam.events_json as any[];

    // Verify index 2 exists
    if (!eventsJson[2]) throw new Error('Event index 2 not found');

    // Get dependents from index 8 (March 5)
    const march5Deps = eventsJson[8]?.dependents;
    if (!march5Deps || march5Deps.length === 0) throw new Error('No dependents found at index 8');

    results.push(`Found ${march5Deps.length} dependents at index 8: ${march5Deps.map((d: any) => d.name).join(', ')}`);

    // 2. Copy dependents to Feb 22 event (index 2), leave March 5 untouched
    eventsJson[2] = {
      ...eventsJson[2],
      'family-members-joining': 'Yes',
      'number-of-adults': 3,
      'total-attendees': 4,
      dependents: march5Deps,
    };

    const { error: updateErr } = await supabase
      .from('pending_volunteers')
      .update({ events_json: eventsJson })
      .eq('id', ahlamId);

    if (updateErr) throw updateErr;
    results.push('✅ Feb 22 event (index 2) updated with 3 dependents');

    // 3. Set marketplace_id on family cards
    const { data: updatedCards, error: cardsErr } = await supabase
      .from('volunteer_qr_cards')
      .update({ marketplace_id: feb22MarketplaceId })
      .eq('volunteer_id', ahlamId)
      .like('unique_id', '%-F%')
      .select('unique_id');

    if (cardsErr) throw cardsErr;
    results.push(`✅ Updated ${updatedCards?.length || 0} family cards with Feb 22 marketplace_id`);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
