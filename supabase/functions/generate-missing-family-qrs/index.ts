import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate unique family member QR card ID (same logic as webhook-receiver)
function generateFamilyQRId(volunteerQRId: string, index: number): string {
  const random = Math.random().toString(36).substring(2, 4).toUpperCase();
  return `${volunteerQRId}-F${index}${random}`;
}

// Extract unique dependents from events_json (same logic as webhook-receiver)
function extractUniqueDependents(eventsJson: unknown): Array<{ name: string; type: string; gender: string | null }> {
  if (!eventsJson || !Array.isArray(eventsJson)) return [];
  
  const dependents: Array<{ name: string; type: string; gender: string | null }> = [];
  
  for (const event of eventsJson) {
    if (event.dependents && Array.isArray(event.dependents)) {
      for (const dep of event.dependents) {
        const name = dep.name?.trim();
        if (!name) continue;
        const nameLower = name.toLowerCase();
        
        // Check if this name is a duplicate or substring of an existing entry (or vice versa)
        const existingIdx = dependents.findIndex(d => {
          const existing = d.name.toLowerCase();
          return existing === nameLower || existing.includes(nameLower) || nameLower.includes(existing);
        });
        
        if (existingIdx === -1) {
          // New unique dependent
          dependents.push({
            name: dep.name,
            type: dep.type || 'adult',
            gender: dep.gender || null
          });
        } else if (nameLower.length > dependents[existingIdx].name.length) {
          // Keep the longer (more complete) name
          dependents[existingIdx] = {
            name: dep.name,
            type: dep.type || dependents[existingIdx].type,
            gender: dep.gender || dependents[existingIdx].gender
          };
        }
      }
    }
  }
  
  return dependents;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all approved volunteers with events_json
    const { data: volunteers, error: volError } = await supabase
      .from('pending_volunteers')
      .select('id, first_name, last_name, email, events_json')
      .eq('status', 'approved')
      .not('events_json', 'is', null);

    if (volError) throw volError;

    let totalCardsCreated = 0;
    let volunteersFixed = 0;
    const details: Array<{ email: string; name: string; cardsCreated: number; dependents: string[] }> = [];

    for (const vol of volunteers || []) {
      const dependents = extractUniqueDependents(vol.events_json);
      if (dependents.length === 0) continue;

      // Get existing QR cards for this volunteer
      const { data: existingCards, error: cardsError } = await supabase
        .from('volunteer_qr_cards')
        .select('unique_id')
        .eq('volunteer_id', vol.id);

      if (cardsError) {
        console.error(`Error fetching cards for ${vol.email}:`, cardsError);
        continue;
      }

      // Find the primary volunteer QR card (the one without -F suffix)
      const primaryCard = (existingCards || []).find(c => !/-F\d+/.test(c.unique_id));
      if (!primaryCard) {
        console.log(`No primary QR card found for ${vol.email}, skipping`);
        continue;
      }

      // Count existing family cards
      const existingFamilyCards = (existingCards || []).filter(c => /-F\d+/.test(c.unique_id));
      
      if (existingFamilyCards.length >= dependents.length) {
        // Already has enough family cards
        continue;
      }

      // Generate missing family cards
      const missingCount = dependents.length - existingFamilyCards.length;
      const startIndex = existingFamilyCards.length + 1;
      let createdForVol = 0;
      const depNames: string[] = [];

      for (let i = 0; i < missingCount; i++) {
        const dep = dependents[existingFamilyCards.length + i];
        if (!dep) continue;

        const familyQrCardId = generateFamilyQRId(primaryCard.unique_id, startIndex + i);

        const { error: insertError } = await supabase
          .from('volunteer_qr_cards')
          .insert({
            unique_id: familyQrCardId,
            volunteer_id: vol.id,
            status: 'inactive'
          });

        if (insertError) {
          console.error(`Failed to create family QR for ${dep.name}:`, insertError);
        } else {
          createdForVol++;
          depNames.push(dep.name);
          console.log(`Created family QR ${familyQrCardId} for ${dep.name} (volunteer: ${vol.email})`);
        }
      }

      if (createdForVol > 0) {
        totalCardsCreated += createdForVol;
        volunteersFixed++;
        details.push({
          email: vol.email,
          name: `${vol.first_name} ${vol.last_name}`,
          cardsCreated: createdForVol,
          dependents: depNames
        });
      }
    }

    const result = {
      success: true,
      volunteersFixed,
      totalCardsCreated,
      details
    };

    console.log('Generate missing family QRs result:', JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-missing-family-qrs:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
