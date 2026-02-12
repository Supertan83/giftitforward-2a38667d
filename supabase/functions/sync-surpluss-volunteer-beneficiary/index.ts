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

    const errors: string[] = [];
    let volunteers_sent = 0;
    let volunteers_failed = 0;
    let volunteers_skipped = 0;
    const volunteer_details: { name: string; status: 'sent' | 'skipped' | 'failed'; reason?: string }[] = [];
    let beneficiary_update_success = false;

    // 2. Look up the Surpluss event by marketplace name (skip for test marketplaces)
    let surplussEventId: number | null = null;
    const isTestMarketplace = /^(lea|tala)'?s?\s+marketplace$/i.test(marketplace.name.trim());

    if (isTestMarketplace) {
      console.log(`"${marketplace.name}" is a test marketplace — skipping Surpluss event lookup, volunteers will be sent without marketplace association`);
    } else {
      console.log(`Looking up Surpluss event by name: "${marketplace.name}"`);

      const apiHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      const apiKey = Deno.env.get('SURPLUSS_API_KEY');
      if (apiKey) {
        apiHeaders['Authorization'] = `Bearer ${apiKey}`;
        apiHeaders['x-api-key'] = apiKey;
      }

      try {
        const lookupUrl = `${baseUrl}/api/common/marketplace-events`;
        console.log(`GET ${lookupUrl}`);
        const lookupResp = await fetch(lookupUrl, { headers: apiHeaders });
        const lookupBody = await lookupResp.text();

        if (lookupResp.ok) {
          let parsed: any;
          try { parsed = JSON.parse(lookupBody); } catch { parsed = null; }

          const items = Array.isArray(parsed) ? parsed : (parsed?.items || parsed?.data || parsed?.results || parsed?.events || []);

          if (Array.isArray(items)) {
            const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
            const targetName = normalize(marketplace.name);

            const match = items.find((e: any) => {
              const eventName = normalize(e.title || e.name || '');
              return eventName === targetName || eventName.includes(targetName) || targetName.includes(eventName);
            });

            if (match) {
              surplussEventId = match.id;
              console.log(`Found matching Surpluss event: "${match.title || match.name}" (ID: ${match.id})`);
            } else {
              console.log(`No matching Surpluss event found for: "${marketplace.name}". Available: ${items.map((e: any) => e.title || e.name).join(', ')}`);
              errors.push(`No matching Surpluss event found for marketplace: "${marketplace.name}"`);
            }
          }
        } else {
          errors.push(`Surpluss marketplace lookup failed: ${lookupResp.status}`);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Surpluss marketplace lookup error: ${errMsg}`);
      }
    }

    // 3. Fetch volunteer QR cards with their pending_volunteers data
    const { data: volunteerCards } = await supabase
      .from('volunteer_qr_cards')
      .select('*, volunteer:pending_volunteers(id, first_name, last_name, email, phone_number, is_employee, external_company, gender)')
      .eq('marketplace_id', marketplace_id);

    // 3b. Fetch already-synced volunteer emails from audit log for this marketplace
    const { data: previousSyncs } = await supabase
      .from('surpluss_api_audit_log')
      .select('request_payload')
      .eq('action', 'sync_volunteer')
      .eq('success', true);

    const alreadySyncedEmails = new Set<string>();
    if (previousSyncs) {
      for (const log of previousSyncs) {
        const payload = log.request_payload as any;
        if (payload?.email && payload?.marketplace_event_name === marketplace.name) {
          alreadySyncedEmails.add(payload.email.toLowerCase());
        }
      }
    }
    console.log(`Found ${alreadySyncedEmails.size} already-synced volunteers for "${marketplace.name}"`);

    // 4. Send each volunteer to Surpluss
    console.log(`Processing ${volunteerCards?.length || 0} volunteers...`);

    for (const card of volunteerCards || []) {
      const vol = card.volunteer as any;
      if (!vol) {
        volunteers_failed++;
        const reason = `Card ${card.unique_id} has no linked volunteer record`;
        errors.push(reason);
        volunteer_details.push({ name: card.unique_id, status: 'failed', reason });
        continue;
      }

      const volunteerName = `${vol.first_name || ''} ${vol.last_name || ''}`.trim();
      if (!volunteerName) {
        volunteers_failed++;
        const reason = `Card ${card.unique_id} has no name`;
        errors.push(reason);
        volunteer_details.push({ name: card.unique_id, status: 'failed', reason });
        continue;
      }

      // Skip if already synced
      if (vol.email && alreadySyncedEmails.has(vol.email.toLowerCase())) {
        volunteers_skipped++;
        volunteer_details.push({ name: volunteerName, status: 'skipped', reason: 'Already synced previously' });
        console.log(`Skipping "${volunteerName}" — already synced`);
        continue;
      }

      const volunteerPayload: Record<string, any> = {
        name: volunteerName,
        source: 'API',
        marketplace_event_name: marketplace.name,
      };
      if (vol.email) volunteerPayload.email = vol.email;
      if (vol.phone_number) volunteerPayload.phone = vol.phone_number;
      if (surplussEventId) volunteerPayload.marketplace_event_id = surplussEventId;

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
        try { responseJson = JSON.parse(responseBody); } catch {
          if (responseBody.includes('<!DOCTYPE') || responseBody.includes('<html')) {
            responseJson = { raw: 'API endpoint unavailable (received HTML instead of JSON)' };
          } else {
            responseJson = { raw: responseBody.substring(0, 500) };
          }
        }

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
          volunteer_details.push({ name: volunteerName, status: 'sent' });
        } else if (responseBody.includes('already exists')) {
          // Treat "already exists" as a skip, not a failure
          volunteers_skipped++;
          volunteer_details.push({ name: volunteerName, status: 'skipped', reason: 'Already exists in Surpluss' });
          console.log(`Skipping "${volunteerName}" — already exists in Surpluss`);
          // Log as success in audit since it's not an error
          await supabase.from('surpluss_api_audit_log').update({ success: true }).eq('id', (await supabase.from('surpluss_api_audit_log').select('id').order('created_at', { ascending: false }).limit(1).single()).data?.id || '');
        } else {
          volunteers_failed++;
          const reason = `${response.status} - ${responseBody.substring(0, 200)}`;
          errors.push(`Volunteer "${volunteerName}" failed: ${reason}`);
          volunteer_details.push({ name: volunteerName, status: 'failed', reason });
        }
      } catch (err) {
        volunteers_failed++;
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Volunteer "${volunteerName}" error: ${errMsg}`);
        volunteer_details.push({ name: volunteerName, status: 'failed', reason: errMsg });
      }
    }

    // 5. Update marketplace event with beneficiary demographics (only if we have a Surpluss event ID)
    if (surplussEventId) {
      console.log(`Updating Surpluss event ${surplussEventId} with demographics...`);

      const demographicsPayload: Record<string, any> = {
        total_volunteers: volunteerCards?.length || 0,
        volunteers_checked_in: volunteerCards?.filter((c: any) => c.status === 'checked_in' || c.status === 'checked_out').length || 0,
      };
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
        const apiUrl = `${baseUrl}/api/common/marketplace-events/${surplussEventId}`;
        console.log(`PUT ${apiUrl}`);

        const response = await fetch(apiUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(demographicsPayload),
        });

        const responseBody = await response.text();
        let responseJson: any;
        try { responseJson = JSON.parse(responseBody); } catch {
          if (responseBody.includes('<!DOCTYPE') || responseBody.includes('<html')) {
            responseJson = { raw: 'API endpoint unavailable (received HTML instead of JSON)' };
          } else {
            responseJson = { raw: responseBody.substring(0, 500) };
          }
        }

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
    } else if (isTestMarketplace) {
      console.log(`Skipping demographics update — "${marketplace.name}" is a test marketplace`);
      beneficiary_update_success = true; // Not a failure for test marketplaces
    } else {
      console.log(`Skipping demographics update - no matching Surpluss event found for "${marketplace.name}"`);
      errors.push(`Demographics not sent: no matching Surpluss event found for "${marketplace.name}"`);
    }

    const success = volunteers_failed === 0 && (surplussEventId ? beneficiary_update_success : true);

    return new Response(
      JSON.stringify({
        success,
        volunteers_sent,
        volunteers_failed,
        volunteers_skipped,
        volunteers_total: volunteerCards?.length || 0,
        volunteer_details,
        beneficiary_update_success,
        surpluss_event_id: surplussEventId,
        marketplace_name: marketplace.name,
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
