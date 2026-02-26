import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateFamilyQRId(volunteerQRId: string, index: number): string {
  const random = Math.random().toString(36).substring(2, 4).toUpperCase();
  return `${volunteerQRId}-F${index}${random}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', authUser.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = await req.json();
    const { volunteer_id, family_member } = payload;

    if (!volunteer_id || !family_member?.name) {
      return new Response(
        JSON.stringify({ success: false, error: 'volunteer_id and family_member.name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get volunteer's existing QR cards
    const { data: existingCards, error: cardsError } = await supabase
      .from('volunteer_qr_cards')
      .select('unique_id')
      .eq('volunteer_id', volunteer_id)
      .order('created_at', { ascending: true });

    if (cardsError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch volunteer cards' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the parent QR card
    const parentCard = existingCards?.find(c => !/-F\d+/.test(c.unique_id));
    if (!parentCard) {
      return new Response(
        JSON.stringify({ success: false, error: 'No parent volunteer QR card found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Count existing family cards
    const familyCardCount = existingCards?.filter(c => /-F\d+/.test(c.unique_id)).length || 0;

    // Generate new family QR ID
    const familyQrCardId = generateFamilyQRId(parentCard.unique_id, familyCardCount + 1);

    // Create the family member QR card
    const { error: createError } = await supabase
      .from('volunteer_qr_cards')
      .insert({
        unique_id: familyQrCardId,
        volunteer_id: volunteer_id,
        status: 'inactive'
      });

    if (createError) {
      console.error('Failed to create family QR card:', createError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create QR card: ' + createError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Created family QR card ${familyQrCardId} for ${family_member.name} (volunteer ${volunteer_id})`);

    // Persist the new dependent into events_json
    try {
      const { data: volData } = await supabase
        .from('pending_volunteers')
        .select('events_json')
        .eq('id', volunteer_id)
        .maybeSingle();

      const familyIndex = familyCardCount + 1;
      const newDep = {
        name: family_member.name.trim(),
        type: family_member.type || 'adult',
        gender: family_member.gender || null,
        index: familyIndex,
      };
      const newDepNameLower = newDep.name.toLowerCase();

      let eventsJson: any[] = (volData?.events_json && Array.isArray(volData.events_json))
        ? volData.events_json as any[]
        : [];

      if (eventsJson.length === 0) {
        eventsJson = [{
          'family-members-joining': 'Yes',
          'number-of-adults': newDep.type === 'adult' ? 1 : 0,
          'number-of-children': newDep.type === 'children' ? 1 : 0,
          'total-attendees': 2,
          dependents: [newDep],
        }];
      } else {
        const deps: any[] = eventsJson[0].dependents || [];
        const isDuplicate = deps.some((d: any) => {
          const existing = (d.name || '').toLowerCase();
          return existing === newDepNameLower || existing.includes(newDepNameLower) || newDepNameLower.includes(existing);
        });
        if (!isDuplicate) {
          deps.push(newDep);
          const adultCount = deps.filter((d: any) => d.type === 'adult').length;
          const childCount = deps.filter((d: any) => d.type === 'children' || d.type === 'child').length;
          eventsJson[0] = {
            ...eventsJson[0],
            'family-members-joining': 'Yes',
            'number-of-adults': adultCount,
            'number-of-children': childCount,
            'total-attendees': 1 + adultCount + childCount,
            dependents: deps,
          };
        }
      }

      await supabase
        .from('pending_volunteers')
        .update({ events_json: eventsJson })
        .eq('id', volunteer_id);

      console.log(`Updated events_json for volunteer ${volunteer_id} with dependent ${newDep.name}`);

      // Sync to event_dependents table
      try {
        const { data: regEvents } = await supabase
          .from('registration_events')
          .select('id')
          .eq('registration_id', volunteer_id)
          .limit(1);

        if (regEvents && regEvents.length > 0) {
          await supabase
            .from('event_dependents')
            .insert({
              registration_event_id: regEvents[0].id,
              name: newDep.name,
              dependent_type: newDep.type,
              gender: newDep.gender,
              dependent_index: familyIndex,
            });
        }
      } catch (depSyncError) {
        console.error('Non-fatal: failed to sync to event_dependents:', depSyncError);
      }
    } catch (ejError) {
      console.error('Non-fatal: failed to update events_json:', ejError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Family member QR card created',
        qr_card_id: familyQrCardId,
        family_member_name: family_member.name,
        family_member_type: family_member.type || 'adult'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in add-family-member:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
