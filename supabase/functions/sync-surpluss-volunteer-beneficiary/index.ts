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

    // Determine which marketplaces to process
    let marketplaceIdsToProcess: string[] = [];
    if (marketplace_ids && Array.isArray(marketplace_ids) && marketplace_ids.length > 0) {
      marketplaceIdsToProcess = marketplace_ids;
    } else if (marketplace_id) {
      marketplaceIdsToProcess = [marketplace_id];
    } else {
      // Fetch ALL marketplaces
      const { data: allMarketplaces } = await supabase
        .from('marketplace_events')
        .select('id');
      marketplaceIdsToProcess = (allMarketplaces || []).map((m: any) => m.id);
    }

    if (marketplaceIdsToProcess.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No marketplaces found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allErrors: string[] = [];
    let totalSent = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let totalVolunteers = 0;
    const allVolunteerDetails: { name: string; status: 'sent' | 'skipped' | 'failed'; reason?: string; marketplace?: string }[] = [];

    // 0. Fetch all previously synced emails once
    const { data: previousSyncs } = await supabase
      .from('surpluss_api_audit_log')
      .select('request_payload')
      .eq('action', 'sync_volunteer')
      .eq('success', true);

    const alreadySyncedMap = new Map<string, Set<string>>();
    if (previousSyncs) {
      for (const log of previousSyncs) {
        const payload = log.request_payload as any;
        if (payload?.email && payload?.marketplace_event_name) {
          const mpName = payload.marketplace_event_name;
          if (!alreadySyncedMap.has(mpName)) alreadySyncedMap.set(mpName, new Set());
          alreadySyncedMap.get(mpName)!.add(payload.email.toLowerCase());
        }
      }
    }

    // Process each marketplace
    for (const mpId of marketplaceIdsToProcess) {
      const { data: marketplace, error: mpError } = await supabase
        .from('marketplace_events')
        .select('*')
        .eq('id', mpId)
        .single();

      if (mpError || !marketplace) {
        allErrors.push(`Marketplace ${mpId} not found`);
        continue;
      }

      console.log(`\n--- Processing marketplace: "${marketplace.name}" ---`);

      const alreadySyncedEmails = alreadySyncedMap.get(marketplace.name) || new Set<string>();

      // Look up the Surpluss event by marketplace name (skip for test marketplaces)
      let surplussEventId: number | null = null;
      const isTestMarketplace = /^(lea|tala)'?s?\s+marketplace$/i.test(marketplace.name.trim());

      if (isTestMarketplace) {
        console.log(`"${marketplace.name}" is a test marketplace — skipping Surpluss event lookup`);
      } else {
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
                console.log(`Found Surpluss event: "${match.title || match.name}" (ID: ${match.id})`);
              } else {
                allErrors.push(`No matching Surpluss event for "${marketplace.name}"`);
              }
            }
          } else {
            allErrors.push(`Surpluss lookup failed for "${marketplace.name}": ${lookupResp.status}`);
          }
        } catch (err) {
          allErrors.push(`Surpluss lookup error for "${marketplace.name}": ${err instanceof Error ? err.message : 'Unknown'}`);
        }
      }

      // Fetch volunteer QR cards for this marketplace
      const { data: volunteerCards } = await supabase
        .from('volunteer_qr_cards')
        .select('*, volunteer:pending_volunteers(id, first_name, last_name, email, phone_number, is_employee, external_company, gender)')
        .eq('marketplace_id', mpId);

      totalVolunteers += volunteerCards?.length || 0;
      console.log(`Processing ${volunteerCards?.length || 0} volunteers for "${marketplace.name}"...`);

      for (const card of volunteerCards || []) {
        const vol = card.volunteer as any;
        if (!vol) {
          totalFailed++;
          allVolunteerDetails.push({ name: card.unique_id, status: 'failed', reason: 'No linked volunteer record', marketplace: marketplace.name });
          continue;
        }

        const volunteerName = `${vol.first_name || ''} ${vol.last_name || ''}`.trim();
        if (!volunteerName) {
          totalFailed++;
          allVolunteerDetails.push({ name: card.unique_id, status: 'failed', reason: 'No name', marketplace: marketplace.name });
          continue;
        }

        if (vol.email && alreadySyncedEmails.has(vol.email.toLowerCase())) {
          totalSkipped++;
          allVolunteerDetails.push({ name: volunteerName, status: 'skipped', reason: 'Already synced previously', marketplace: marketplace.name });
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
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
            allVolunteerDetails.push({ name: volunteerName, status: 'sent', marketplace: marketplace.name });
          } else if (responseBody.includes('already exists')) {
            totalSkipped++;
            allVolunteerDetails.push({ name: volunteerName, status: 'skipped', reason: 'Already exists in Surpluss', marketplace: marketplace.name });
            await supabase.from('surpluss_api_audit_log').update({ success: true }).eq('id', (await supabase.from('surpluss_api_audit_log').select('id').order('created_at', { ascending: false }).limit(1).single()).data?.id || '');
          } else {
            totalFailed++;
            const reason = `${response.status} - ${responseBody.substring(0, 200)}`;
            allVolunteerDetails.push({ name: volunteerName, status: 'failed', reason, marketplace: marketplace.name });
          }
        } catch (err) {
          totalFailed++;
          allVolunteerDetails.push({ name: volunteerName, status: 'failed', reason: err instanceof Error ? err.message : 'Unknown', marketplace: marketplace.name });
        }
      }

      // Update demographics if we have a Surpluss event ID
      if (surplussEventId) {
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

        try {
          const apiUrl = `${baseUrl}/api/common/marketplace-events/${surplussEventId}`;
          const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
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

    const success = totalFailed === 0;

    return new Response(
      JSON.stringify({
        success,
        volunteers_sent: totalSent,
        volunteers_failed: totalFailed,
        volunteers_skipped: totalSkipped,
        volunteers_total: totalVolunteers,
        volunteer_details: allVolunteerDetails,
        marketplaces_processed: marketplaceIdsToProcess.length,
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
