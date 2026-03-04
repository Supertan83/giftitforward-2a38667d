import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/** Normalize a string to lowercase alphanumeric for matching */
const normalizeSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Build a map of normalized marketplace name -> display name for event slug resolution */
function buildEventSlugMap(marketplaces: { name: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const mp of marketplaces) {
    map.set(normalizeSlug(mp.name), mp.name);
  }
  return map;
}

/** Resolve comma-separated event slugs to semicolon-separated human-readable names */
function resolveEventSlugs(eventsList: string | null, slugMap: Map<string, string>): string | undefined {
  if (!eventsList) return undefined;
  const slugs = eventsList.split(',').map(s => s.trim()).filter(Boolean);
  const resolvedNames: string[] = [];

  for (const slug of slugs) {
    const normSlug = normalizeSlug(slug);
    let matched = false;
    for (const [normName, displayName] of slugMap) {
      if (normName.includes(normSlug) || normSlug.includes(normName)) {
        resolvedNames.push(displayName);
        matched = true;
        break;
      }
    }
    if (!matched) {
      const fallback = slug.replace(/---/g, ' - ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
      resolvedNames.push(fallback);
    }
  }

  return resolvedNames.length > 0 ? resolvedNames.join(';') : undefined;
}

/** Check if a volunteer is registered for a specific marketplace */
function isVolunteerRegisteredForMarketplace(
  vol: any,
  marketplaceName: string
): boolean {
  const normTarget = normalizeSlug(marketplaceName);

  // Check events_list (comma-separated slugs)
  if (vol.events_list) {
    const slugs = vol.events_list.split(',').map((s: string) => s.trim()).filter(Boolean);
    for (const slug of slugs) {
      const normSlug = normalizeSlug(slug);
      if (normSlug.includes(normTarget) || normTarget.includes(normSlug)) {
        return true;
      }
    }
  }

  // Check events_json (array of objects with event_slug or event-slug)
  if (vol.events_json && Array.isArray(vol.events_json)) {
    for (const evt of vol.events_json) {
      const eventSlug = evt.event_slug || evt['event-slug'] || evt.slug || '';
      const normSlug = normalizeSlug(eventSlug);
      if (normSlug && (normSlug.includes(normTarget) || normTarget.includes(normSlug))) {
        return true;
      }
    }
  }

  return false;
}

/** Build the enriched volunteer payload for the Surpluss API */
function buildVolunteerPayload(vol: any, slugMap: Map<string, string>): Record<string, any> {
  const name = `${vol.first_name || ''} ${vol.last_name || ''}`.trim();
  const payload: Record<string, any> = { name };

  if (vol.email) payload.email = vol.email;
  if (vol.phone_number) payload.phone = vol.phone_number;

  if (vol.gender) {
    const g = vol.gender.toLowerCase();
    if (g === 'male' || g === 'female') {
      payload.gender = g.toUpperCase();
    }
  }

  if (vol.is_employee != null) {
    payload.employed = vol.is_employee ? 'YES' : 'NO';
  }

  const company = vol.external_company || vol.employee_vertical;
  if (company) payload.company_name = company;

  const events = resolveEventSlugs(vol.events_list, slugMap);
  if (events) payload.events_registered = events;

  return payload;
}

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
    let totalBulkUpdated = 0;
    const allVolunteerDetails: { name: string; status: 'sent' | 'skipped' | 'failed' | 'bulk_updated'; reason?: string }[] = [];

    // 1. Determine which marketplace IDs to process
    let marketplaceIdsToProcess: string[] = [];
    if (marketplace_ids && Array.isArray(marketplace_ids) && marketplace_ids.length > 0) {
      marketplaceIdsToProcess = marketplace_ids;
    } else if (marketplace_id) {
      marketplaceIdsToProcess = [marketplace_id];
    }

    // 2. Fetch marketplace details for filtering and demographics
    const marketplacesToSync: any[] = [];
    for (const mpId of marketplaceIdsToProcess) {
      const { data: mp } = await supabase
        .from('marketplace_events')
        .select('*')
        .eq('id', mpId)
        .single();
      if (mp) {
        marketplacesToSync.push(mp);
      } else {
        console.log(`❌ Marketplace not found for ID: ${mpId}`);
        allErrors.push(`Marketplace not found: ${mpId}`);
      }
    }

    // 3. Build slug map for event name resolution
    const { data: allMarketplaces } = await supabase
      .from('marketplace_events')
      .select('name');
    const slugMap = buildEventSlugMap(allMarketplaces || []);

    // 4. Fetch all previously synced emails for deduplication
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

    // 5. Fetch ALL volunteers with events data
    const { data: allVolunteers, error: volError } = await supabase
      .from('pending_volunteers')
      .select('id, first_name, last_name, email, phone_number, is_employee, external_company, gender, events_list, events_json, employee_vertical');

    if (volError) {
      throw new Error(`Failed to fetch volunteers: ${volError.message}`);
    }

    // 6. Filter volunteers to only those registered for the selected marketplace(s)
    const marketplaceNames = marketplacesToSync.map(mp => mp.name);
    let volunteers = allVolunteers || [];

    if (marketplaceNames.length > 0) {
      const filteredVolunteers = volunteers.filter(vol => {
        return marketplaceNames.some(mpName => isVolunteerRegisteredForMarketplace(vol, mpName));
      });
      console.log(`📋 Filtered ${volunteers.length} total volunteers → ${filteredVolunteers.length} registered for selected marketplace(s): ${marketplaceNames.join(', ')}`);
      volunteers = filteredVolunteers;
    } else {
      console.log(`⚠️ No marketplace filter applied — syncing all ${volunteers.length} volunteers`);
    }

    // 7. Separate new vs already-synced volunteers
    const newVolunteers: any[] = [];
    const previouslySyncedVolunteers: any[] = [];

    for (const vol of volunteers) {
      const volunteerName = `${vol.first_name || ''} ${vol.last_name || ''}`.trim();
      if (!volunteerName) {
        totalFailed++;
        allVolunteerDetails.push({ name: vol.email || 'Unknown', status: 'failed', reason: 'No name' });
        continue;
      }
      if (vol.email && alreadySyncedEmails.has(vol.email.toLowerCase())) {
        previouslySyncedVolunteers.push(vol);
      } else {
        newVolunteers.push(vol);
      }
    }

    console.log(`📊 New volunteers to create: ${newVolunteers.length}, Previously synced to update: ${previouslySyncedVolunteers.length}`);

    // 8. Create new volunteers
    for (const vol of newVolunteers) {
      const volunteerName = `${vol.first_name || ''} ${vol.last_name || ''}`.trim();
      const volunteerPayload = buildVolunteerPayload(vol, slugMap);

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
          // Mark the audit log as success since the volunteer exists
          const { data: recentLogs } = await supabase
            .from('surpluss_api_audit_log')
            .select('id')
            .eq('action', 'sync_volunteer')
            .eq('success', false)
            .order('created_at', { ascending: false })
            .limit(1);
          if (recentLogs && recentLogs.length > 0) {
            await supabase
              .from('surpluss_api_audit_log')
              .update({ success: true })
              .eq('id', recentLogs[0].id);
          }
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

    // 9. Bulk-update previously synced volunteers
    if (previouslySyncedVolunteers.length > 0) {
      const bulkPayload = previouslySyncedVolunteers
        .filter(vol => vol.email)
        .map(vol => {
          const enriched = buildVolunteerPayload(vol, slugMap);
          return {
            email: vol.email,
            ...(enriched.gender && { gender: enriched.gender }),
            ...(enriched.employed && { employed: enriched.employed }),
            ...(enriched.company_name && { company_name: enriched.company_name }),
            ...(enriched.events_registered && { events_registered: enriched.events_registered }),
          };
        });

      if (bulkPayload.length > 0) {
        try {
          const bulkUrl = `${baseUrl}/api/common/volunteers/bulk-update`;
          console.log(`Sending bulk-update for ${bulkPayload.length} previously synced volunteers`);

          const response = await fetch(bulkUrl, {
            method: 'POST',
            headers: apiHeaders,
            body: JSON.stringify({ volunteers: bulkPayload }),
          });

          const responseBody = await response.text();
          let responseJson: any;
          try { responseJson = JSON.parse(responseBody); } catch {
            responseJson = { raw: responseBody.substring(0, 500) };
          }

          await supabase.from('surpluss_api_audit_log').insert({
            action: 'bulk_update_volunteers',
            environment,
            request_payload: { count: bulkPayload.length, sample: bulkPayload.slice(0, 3) },
            response_status: response.status,
            response_body: responseJson,
            success: response.ok,
          });

          if (response.ok) {
            totalBulkUpdated = bulkPayload.length;
            for (const vol of previouslySyncedVolunteers) {
              const name = `${vol.first_name || ''} ${vol.last_name || ''}`.trim();
              allVolunteerDetails.push({ name, status: 'bulk_updated' });
            }
          } else {
            allErrors.push(`Bulk-update failed: ${response.status} - ${responseBody.substring(0, 200)}`);
            for (const vol of previouslySyncedVolunteers) {
              const name = `${vol.first_name || ''} ${vol.last_name || ''}`.trim();
              allVolunteerDetails.push({ name, status: 'skipped', reason: 'Bulk-update failed' });
            }
            totalSkipped += previouslySyncedVolunteers.length;
          }
        } catch (err) {
          allErrors.push(`Bulk-update error: ${err instanceof Error ? err.message : 'Unknown'}`);
          totalSkipped += previouslySyncedVolunteers.length;
        }
      }
    }

    // 10. Demographics update — use external_id directly instead of fuzzy name matching
    for (const marketplace of marketplacesToSync) {
      console.log(`\n=== Demographics for "${marketplace.name}" (external_id: ${marketplace.external_id}) ===`);

      if (!marketplace.external_id) {
        console.log(`⚠️ No external_id set for "${marketplace.name}" — skipping demographics`);
        allErrors.push(`No external_id for "${marketplace.name}" — cannot sync demographics`);
        continue;
      }

      const demographicsPayload: Record<string, any> = {};
      if (marketplace.demographics_total_families != null) demographicsPayload.total_families = marketplace.demographics_total_families;
      if (marketplace.demographics_total_adults != null) demographicsPayload.total_adults = marketplace.demographics_total_adults;
      if (marketplace.demographics_total_children != null) demographicsPayload.total_children = marketplace.demographics_total_children;
      if (marketplace.demographics_male_adults != null) demographicsPayload.male_adults = marketplace.demographics_male_adults;
      if (marketplace.demographics_female_adults != null) demographicsPayload.female_adults = marketplace.demographics_female_adults;
      if (marketplace.demographics_male_children != null) demographicsPayload.male_children = marketplace.demographics_male_children;
      if (marketplace.demographics_female_children != null) demographicsPayload.female_children = marketplace.demographics_female_children;

      console.log(`📊 Demographics payload:`, demographicsPayload);

      if (Object.keys(demographicsPayload).length === 0) {
        console.log(`⚠️ Empty demographics payload — skipping`);
        allErrors.push(`No demographics data for "${marketplace.name}"`);
        continue;
      }

      try {
        const updateUrl = `${baseUrl}/api/common/marketplace-events/${marketplace.external_id}`;
        console.log(`🚀 PUT ${updateUrl}`);

        const response = await fetch(updateUrl, {
          method: 'PUT',
          headers: apiHeaders,
          body: JSON.stringify(demographicsPayload),
        });

        const responseBody = await response.text();
        let responseJson: any;
        try { responseJson = JSON.parse(responseBody); } catch {
          responseJson = { raw: responseBody.substring(0, 500) };
        }

        console.log(`📥 Response: ${response.status} ${response.ok ? '✅' : '❌'}`, responseJson);

        await supabase.from('surpluss_api_audit_log').insert({
          action: 'sync_beneficiary_demographics',
          environment,
          request_payload: { marketplace_name: marketplace.name, external_id: marketplace.external_id, ...demographicsPayload },
          response_status: response.status,
          response_body: responseJson,
          success: response.ok,
        });

        if (!response.ok) {
          const errorMsg = typeof responseJson === 'object' && responseJson?.message
            ? responseJson.message
            : `Status ${response.status}`;
          allErrors.push(`Demographics failed for "${marketplace.name}": ${errorMsg}`);
        } else {
          console.log(`✅ Demographics updated for "${marketplace.name}" (external_id: ${marketplace.external_id})`);
        }
      } catch (err) {
        console.log(`❌ Demographics error for "${marketplace.name}":`, err);
        allErrors.push(`Demographics error for "${marketplace.name}": ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: totalFailed === 0,
        volunteers_sent: totalSent,
        volunteers_failed: totalFailed,
        volunteers_skipped: totalSkipped,
        volunteers_bulk_updated: totalBulkUpdated,
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
