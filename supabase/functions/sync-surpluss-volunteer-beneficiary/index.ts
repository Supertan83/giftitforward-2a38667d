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

    const { marketplace_id, marketplace_ids, environment } = await req.json();

    if (!environment) {
      return new Response(
        JSON.stringify({ error: 'environment is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = environment === 'production'
      ? 'https://api.thesurpluss.com'
      : 'https://surpluss-server.herokuapp.com';

    const apiHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    const apiKey = Deno.env.get('SURPLUSS_API_KEY');
    if (apiKey) {
      apiHeaders['Authorization'] = `Bearer ${apiKey}`;
      apiHeaders['x-api-key'] = apiKey;
    }

    const allErrors: string[] = [];
    let totalSent = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    const allVolunteerDetails: { name: string; status: 'sent' | 'skipped' | 'failed'; reason?: string }[] = [];

    // 1. Fetch all previously synced emails for deduplication
    const { data: previousSyncs } = await supabase
      .from('surpluss_api_audit_log')
      .select('request_payload')
      .eq('action', 'sync_volunteer')
      .eq('success', true);

    const alreadySyncedEmails = new Set<string>();
    if (previousSyncs) {
      for (const log of previousSyncs) {
        const payload = log.request_payload as any;
        if (payload?.email) {
          alreadySyncedEmails.add(payload.email.toLowerCase());
        }
      }
    }
    console.log(`Found ${alreadySyncedEmails.size} previously synced emails`);

    // 2. Fetch ALL volunteers from pending_volunteers directly
    const { data: allVolunteers, error: volError } = await supabase
      .from('pending_volunteers')
      .select('id, first_name, last_name, email, phone_number, is_employee, external_company, gender');

    if (volError) {
      throw new Error(`Failed to fetch volunteers: ${volError.message}`);
    }

    const volunteers = allVolunteers || [];
    console.log(`Fetched ${volunteers.length} volunteers from pending_volunteers`);

    // 3. Send each volunteer to Surpluss
    for (const vol of volunteers) {
      const volunteerName = `${vol.first_name || ''} ${vol.last_name || ''}`.trim();
      if (!volunteerName) {
        totalFailed++;
        allVolunteerDetails.push({ name: vol.email || 'Unknown', status: 'failed', reason: 'No name' });
        continue;
      }

      if (vol.email && alreadySyncedEmails.has(vol.email.toLowerCase())) {
        totalSkipped++;
        allVolunteerDetails.push({ name: volunteerName, status: 'skipped', reason: 'Already synced previously' });
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
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify(volunteerPayload),
        });

        const responseBody = await response.text();
        let responseJson: any;
        try { responseJson = JSON.parse(responseBody); } catch {
          responseJson = responseBody.includes('<!DOCTYPE') ? { raw: 'HTML response' } : { raw: responseBody.substring(0, 500) };
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
          totalSent++;
          allVolunteerDetails.push({ name: volunteerName, status: 'sent' });
        } else if (responseBody.includes('already exists')) {
          totalSkipped++;
          allVolunteerDetails.push({ name: volunteerName, status: 'skipped', reason: 'Already exists in Surpluss' });
          // Mark as success in audit log
          await supabase.from('surpluss_api_audit_log')
            .update({ success: true })
            .eq('action', 'sync_volunteer')
            .eq('success', false)
            .order('created_at', { ascending: false })
            .limit(1);
        } else {
          totalFailed++;
          const reason = `${response.status} - ${responseBody.substring(0, 200)}`;
          allVolunteerDetails.push({ name: volunteerName, status: 'failed', reason });
        }
      } catch (err) {
        totalFailed++;
        allVolunteerDetails.push({ name: volunteerName, status: 'failed', reason: err instanceof Error ? err.message : 'Unknown' });
      }
    }

    // 4. Demographics update (optional, only if marketplace IDs provided)
    let marketplaceIdsToProcess: string[] = [];
    if (marketplace_ids && Array.isArray(marketplace_ids) && marketplace_ids.length > 0) {
      marketplaceIdsToProcess = marketplace_ids;
    } else if (marketplace_id) {
      marketplaceIdsToProcess = [marketplace_id];
    }

    if (marketplaceIdsToProcess.length > 0) {
      // Fetch Surpluss events for demographics matching
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const surplussEventsMap = new Map<string, number>();

      try {
        const lookupUrl = `${baseUrl}/api/common/marketplace-events`;
        const lookupResp = await fetch(lookupUrl, { headers: apiHeaders });
        const lookupBody = await lookupResp.text();

        if (lookupResp.ok) {
          let parsed: any;
          try { parsed = JSON.parse(lookupBody); } catch { parsed = null; }
          const items = Array.isArray(parsed) ? parsed : (parsed?.items || parsed?.data || parsed?.results || parsed?.events || []);
          if (Array.isArray(items)) {
            for (const item of items) {
              const name = normalize(item.title || item.name || '');
              if (name) surplussEventsMap.set(name, item.id);
            }
          }
        }
      } catch (err) {
        allErrors.push(`Surpluss events lookup error: ${err instanceof Error ? err.message : 'Unknown'}`);
      }

      for (const mpId of marketplaceIdsToProcess) {
        const { data: marketplace } = await supabase
          .from('marketplace_events')
          .select('*')
          .eq('id', mpId)
          .single();

        if (!marketplace) continue;

        let surplussEventId: number | null = null;
        const targetName = normalize(marketplace.name);
        for (const [eventName, eventId] of surplussEventsMap) {
          if (eventName === targetName || eventName.includes(targetName) || targetName.includes(eventName)) {
            surplussEventId = eventId;
            break;
          }
        }

        if (surplussEventId) {
          const demographicsPayload: Record<string, any> = {};
          if (marketplace.demographics_total_families != null) demographicsPayload.total_families = marketplace.demographics_total_families;
          if (marketplace.demographics_total_adults != null) demographicsPayload.total_adults = marketplace.demographics_total_adults;
          if (marketplace.demographics_total_children != null) demographicsPayload.total_children = marketplace.demographics_total_children;
          if (marketplace.demographics_male_adults != null) demographicsPayload.male_adults = marketplace.demographics_male_adults;
          if (marketplace.demographics_female_adults != null) demographicsPayload.female_adults = marketplace.demographics_female_adults;
          if (marketplace.demographics_male_children != null) demographicsPayload.male_children = marketplace.demographics_male_children;
          if (marketplace.demographics_female_children != null) demographicsPayload.female_children = marketplace.demographics_female_children;

          try {
            const response = await fetch(`${baseUrl}/api/common/marketplace-events/${surplussEventId}`, {
              method: 'PUT',
              headers: apiHeaders,
              body: JSON.stringify(demographicsPayload),
            });
            const responseBody = await response.text();
            let responseJson: any;
            try { responseJson = JSON.parse(responseBody); } catch { responseJson = { raw: responseBody.substring(0, 500) }; }

            await supabase.from('surpluss_api_audit_log').insert({
              action: 'sync_beneficiary_demographics',
              environment,
              request_payload: demographicsPayload,
              response_status: response.status,
              response_body: responseJson,
              success: response.ok,
            });
            if (!response.ok) {
              allErrors.push(`Demographics update failed for "${marketplace.name}": ${response.status}`);
            }
          } catch (err) {
            allErrors.push(`Demographics error for "${marketplace.name}": ${err instanceof Error ? err.message : 'Unknown'}`);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: totalFailed === 0,
        volunteers_sent: totalSent,
        volunteers_failed: totalFailed,
        volunteers_skipped: totalSkipped,
        volunteers_total: volunteers.length,
        volunteer_details: allVolunteerDetails,
        errors: allErrors,
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
