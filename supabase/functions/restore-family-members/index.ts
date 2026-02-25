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

    const results: string[] = [];

    // ── 1. AHLAM: Update events_json to add 3 dependents ──
    const ahlamId = '71579f66-931f-4dc3-8f90-47a1b4a30ed6';
    const { data: ahlam } = await supabase
      .from('pending_volunteers')
      .select('events_json')
      .eq('id', ahlamId)
      .single();

    if (!ahlam) throw new Error('Ahlam not found');

    const ahlamEvents = ahlam.events_json as any[];
    // Update last event to include family members
    const lastIdx = ahlamEvents.length - 1;
    ahlamEvents[lastIdx] = {
      ...ahlamEvents[lastIdx],
      'family-members-joining': 'Yes',
      'number-of-adults': 3,
      'total-attendees': 4,
      dependents: [
        { name: 'Muna Yousuf Al Hashemi', type: 'adult', gender: 'Female', index: 1 },
        { name: 'Ghazlan Mohammad Al Suwaidi', type: 'adult', gender: 'Female', index: 2 },
        { name: 'Al Hanoof Mohammad Al Suwaidi', type: 'adult', gender: 'Female', index: 3 },
      ],
    };

    const { error: ahlamUpdateErr } = await supabase
      .from('pending_volunteers')
      .update({ events_json: ahlamEvents })
      .eq('id', ahlamId);

    if (ahlamUpdateErr) throw ahlamUpdateErr;
    results.push('✅ Ahlam events_json updated with 3 dependents');

    // ── 2. AHLAM: Create 3 family QR cards ──
    const primaryCardId = 'VOL-MKYLFGFF-AW95';
    const familyCards = [
      { unique_id: `${primaryCardId}-F1`, volunteer_id: ahlamId, status: 'inactive' },
      { unique_id: `${primaryCardId}-F2`, volunteer_id: ahlamId, status: 'inactive' },
      { unique_id: `${primaryCardId}-F3`, volunteer_id: ahlamId, status: 'inactive' },
    ];

    const { error: cardsErr } = await supabase
      .from('volunteer_qr_cards')
      .insert(familyCards);

    if (cardsErr) throw cardsErr;
    results.push(`✅ Created 3 family cards for Ahlam: ${familyCards.map(c => c.unique_id).join(', ')}`);

    // ── 3. YOGESH: Add Muskan Arora to events_json ──
    const yogeshId = '0e442ce8-2e89-45d7-883e-869e6d410b55';
    const { data: yogesh } = await supabase
      .from('pending_volunteers')
      .select('events_json')
      .eq('id', yogeshId)
      .single();

    if (!yogesh) throw new Error('Yogesh not found');

    const yogeshEvents = yogesh.events_json as any[];
    // Find the event that has family-members-joining = Yes (March 14)
    const famEventIdx = yogeshEvents.findIndex((e: any) => e['family-members-joining'] === 'Yes');
    if (famEventIdx === -1) throw new Error('No family event found for Yogesh');

    const existingDeps = yogeshEvents[famEventIdx].dependents || [];
    existingDeps.push({ name: 'Muskan Arora', type: 'adult', gender: 'Female', index: 2 });

    yogeshEvents[famEventIdx] = {
      ...yogeshEvents[famEventIdx],
      'number-of-adults': 2,
      'total-attendees': 3,
      dependents: existingDeps,
    };

    const { error: yogeshUpdateErr } = await supabase
      .from('pending_volunteers')
      .update({ events_json: yogeshEvents })
      .eq('id', yogeshId);

    if (yogeshUpdateErr) throw yogeshUpdateErr;
    results.push('✅ Yogesh events_json updated – Muskan Arora added as 2nd dependent');

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
