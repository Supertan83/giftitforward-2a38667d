import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extractUniqueDependents(eventsJson: unknown): Array<{ name: string }> {
  if (!eventsJson || !Array.isArray(eventsJson)) return [];
  const dependents: Array<{ name: string }> = [];
  for (const event of eventsJson) {
    if (event.dependents && Array.isArray(event.dependents)) {
      for (const dep of event.dependents) {
        const name = dep.name?.trim();
        if (!name) continue;
        const nameLower = name.toLowerCase();
        const existingIdx = dependents.findIndex(d => {
          const existing = d.name.toLowerCase();
          return existing === nameLower || existing.includes(nameLower) || nameLower.includes(existing);
        });
        if (existingIdx === -1) {
          dependents.push({ name });
        } else if (nameLower.length > dependents[existingIdx].name.length) {
          dependents[existingIdx] = { name };
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

    const { dryRun = true } = await req.json().catch(() => ({ dryRun: true }));

    // Get all approved volunteers with events_json
    const { data: volunteers, error: volError } = await supabase
      .from('pending_volunteers')
      .select('id, first_name, last_name, email, events_json')
      .eq('status', 'approved')
      .not('events_json', 'is', null);

    if (volError) throw volError;

    // Get all family QR cards
    const { data: allCards, error: cardsError } = await supabase
      .from('volunteer_qr_cards')
      .select('id, unique_id, volunteer_id, status, created_at')
      .like('unique_id', '%-F%');

    if (cardsError) throw cardsError;

    const cardsByVolunteer = new Map<string, typeof allCards>();
    for (const card of allCards || []) {
      if (!card.volunteer_id) continue;
      const list = cardsByVolunteer.get(card.volunteer_id) || [];
      list.push(card);
      cardsByVolunteer.set(card.volunteer_id, list);
    }

    let totalDeleted = 0;
    const details: Array<{ email: string; name: string; expectedCount: number; actualCount: number; deletedCount: number; deletedIds: string[] }> = [];

    for (const vol of volunteers || []) {
      const dependents = extractUniqueDependents(vol.events_json);
      const familyCards = (cardsByVolunteer.get(vol.id) || [])
        .filter(c => /-F\d+/.test(c.unique_id))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      if (familyCards.length === 0) continue;

      // Only flag as excess if card count exceeds dependent count
      // Never delete a card whose name is found in events_json
      if (familyCards.length <= dependents.length) continue;

      const excess = familyCards.slice(dependents.length);
      
      // Only delete truly orphaned inactive cards (not checked_in or checked_out)
      const toDelete = excess.filter(c => c.status === 'inactive');

      if (toDelete.length === 0) continue;

      if (!dryRun) {
        const { error: delError } = await supabase
          .from('volunteer_qr_cards')
          .delete()
          .in('id', toDelete.map(c => c.id));

        if (delError) {
          console.error(`Failed to delete cards for ${vol.email}:`, delError);
          continue;
        }
      }

      totalDeleted += toDelete.length;
      details.push({
        email: vol.email,
        name: `${vol.first_name} ${vol.last_name}`,
        expectedCount: dependents.length,
        actualCount: familyCards.length,
        deletedCount: toDelete.length,
        deletedIds: toDelete.map(c => c.unique_id),
      });
    }

    return new Response(JSON.stringify({
      success: true,
      dryRun,
      totalDeleted,
      volunteersAffected: details.length,
      details,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

