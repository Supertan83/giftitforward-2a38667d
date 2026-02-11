import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { marketplace_id, environment } = await req.json();

    if (!marketplace_id || !environment) {
      return new Response(
        JSON.stringify({ error: 'marketplace_id and environment are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = environment === 'production'
      ? 'https://api.thesurpluss.com'
      : 'https://surpluss-server.herokuapp.com';

    // 1. Fetch marketplace event
    const { data: marketplace, error: mpError } = await supabase
      .from('marketplace_events')
      .select('*')
      .eq('id', marketplace_id)
      .single();

    if (mpError || !marketplace) {
      return new Response(
        JSON.stringify({ error: 'Marketplace not found', details: mpError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!marketplace.external_id) {
      return new Response(
        JSON.stringify({ error: 'Marketplace has no external_id - cannot sync to Surpluss' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const errors: string[] = [];
    let volunteers_sent = 0;
    let volunteers_failed = 0;
    let beneficiary_update_success = false;

    // 2. Fetch volunteer QR cards with their pending_volunteers data
    const { data: volunteerCards } = await supabase
      .from('volunteer_qr_cards')
      .select('*, volunteer:pending_volunteers(id, first_name, last_name, email, phone_number, is_employee, external_company, gender)')
      .eq('marketplace_id', marketplace_id);

    // 3. Send each volunteer to Surpluss
    console.log(`Sending ${volunteerCards?.length || 0} volunteers to Surpluss...`);

    for (const card of volunteerCards || []) {
      const vol = card.volunteer as any;
      if (!vol) {
        volunteers_failed++;
        errors.push(`Volunteer card ${card.unique_id} has no linked volunteer record`);
        continue;
      }

      const volunteerName = `${vol.first_name || ''} ${vol.last_name || ''}`.trim();
      if (!volunteerName) {
        volunteers_failed++;
        errors.push(`Volunteer card ${card.unique_id} has no name`);
        continue;
      }

      const volunteerPayload: Record<string, any> = {
        name: volunteerName,
        source: 'API',
      };
      if (vol.email) volunteerPayload.email = vol.email;
      if (vol.phone_number) volunteerPayload.phone = vol.phone_number;

      try {
        const apiUrl = `${baseUrl}/api/common/volunteers`;
        console.log(`POST ${apiUrl} - ${volunteerName}`);

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(volunteerPayload),
        });

        const responseBody = await response.text();
        let responseJson: any;
        try { responseJson = JSON.parse(responseBody); } catch { responseJson = { raw: responseBody }; }

        // Log to audit
        await supabase.from('surpluss_api_audit_log').insert({
          action: 'sync_volunteer',
          environment,
          request_payload: volunteerPayload,
          response_status: response.status,
          response_body: responseJson,
          success: response.ok,
        });

        if (response.ok) {
          volunteers_sent++;
        } else {
          volunteers_failed++;
          errors.push(`Volunteer "${volunteerName}" failed: ${response.status} - ${responseBody.substring(0, 200)}`);
        }
      } catch (err) {
        volunteers_failed++;
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Volunteer "${volunteerName}" error: ${errMsg}`);
      }
    }

    // 4. Update marketplace event with beneficiary demographics
    console.log(`Updating marketplace event ${marketplace.external_id} with demographics...`);

    const demographicsPayload: Record<string, any> = {};

    // Use the marketplace demographics fields
    if (marketplace.demographics_total_families != null) demographicsPayload.total_families = marketplace.demographics_total_families;
    if (marketplace.demographics_total_adults != null) demographicsPayload.total_adults = marketplace.demographics_total_adults;
    if (marketplace.demographics_total_children != null) demographicsPayload.total_children = marketplace.demographics_total_children;
    if (marketplace.demographics_male_adults != null) demographicsPayload.male_adults = marketplace.demographics_male_adults;
    if (marketplace.demographics_female_adults != null) demographicsPayload.female_adults = marketplace.demographics_female_adults;
    if (marketplace.demographics_male_children != null) demographicsPayload.male_children = marketplace.demographics_male_children;
    if (marketplace.demographics_female_children != null) demographicsPayload.female_children = marketplace.demographics_female_children;
    if (marketplace.demographics_nationalities) demographicsPayload.nationalities = marketplace.demographics_nationalities;
    if (marketplace.demographics_target != null) demographicsPayload.target = marketplace.demographics_target;
    if (marketplace.demographics_reach != null) demographicsPayload.reach = marketplace.demographics_reach;
    if (marketplace.demographics_notes) demographicsPayload.notes = marketplace.demographics_notes;

    try {
      const apiUrl = `${baseUrl}/api/common/marketplace-events/${marketplace.external_id}`;
      console.log(`PUT ${apiUrl}`);

      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(demographicsPayload),
      });

      const responseBody = await response.text();
      let responseJson: any;
      try { responseJson = JSON.parse(responseBody); } catch { responseJson = { raw: responseBody }; }

      // Log to audit
      await supabase.from('surpluss_api_audit_log').insert({
        action: 'sync_beneficiary_demographics',
        environment,
        request_payload: demographicsPayload,
        response_status: response.status,
        response_body: responseJson,
        success: response.ok,
      });

      beneficiary_update_success = response.ok;
      if (!response.ok) {
        errors.push(`Demographics update failed: ${response.status} - ${responseBody.substring(0, 200)}`);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`Demographics update error: ${errMsg}`);
    }

    const success = volunteers_failed === 0 && beneficiary_update_success;

    return new Response(
      JSON.stringify({
        success,
        volunteers_sent,
        volunteers_failed,
        beneficiary_update_success,
        errors,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in sync-surpluss-volunteer-beneficiary:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
