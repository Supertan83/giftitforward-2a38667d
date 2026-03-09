import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/** Normalize a slug like "event-7---cda" to fuzzy-matchable form */
const normalizeSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Build a map of normalized slug fragments -> marketplace name */
function buildEventSlugMap(marketplaces: { name: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const mp of marketplaces) {
    const norm = normalizeSlug(mp.name);
    map.set(norm, mp.name);
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
      // Check if either contains the other (fuzzy match)
      if (normName.includes(normSlug) || normSlug.includes(normName)) {
        resolvedNames.push(displayName);
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Fallback: use the slug itself, cleaned up
      const fallback = slug.replace(/---/g, ' - ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
      resolvedNames.push(fallback);
    }
  }

  return resolvedNames.length > 0 ? resolvedNames.join(';') : undefined;
}

/** Build the enriched volunteer payload for the Surpluss API */
function buildVolunteerPayload(
  vol: any,
  slugMap: Map<string, string>
): Record<string, any> {
  const name = `${vol.first_name || ''} ${vol.last_name || ''}`.trim();
  const payload: Record<string, any> = { name };

  if (vol.email) payload.email = vol.email;
  if (vol.phone_number) payload.phone = vol.phone_number;

  // Gender mapping
  if (vol.gender) {
    const g = vol.gender.toLowerCase();
    if (g === 'male' || g === 'female') {
      payload.gender = g.toUpperCase();
    }
  }

  // Employment mapping
  if (vol.is_employee != null) {
    payload.employed = vol.is_employee ? 'YES' : 'NO';
  }

  // Company name
  const company = vol.external_company || vol.employee_vertical;
  if (company) payload.company_name = company;

  // Events registered
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
    
    // Beneficiary tracking (demographics)
    let demographicsSent = 0;
    let demographicsFailed = 0;
    const demographicsDetails: { marketplace_id: string; marketplace_name: string; status: 'sent' | 'failed' | 'skipped'; reason?: string; surpluss_event_id?: number }[] = [];

    // 1. Fetch marketplace events for slug resolution
    const { data: marketplaceEvents } = await supabase
      .from('marketplace_events')
      .select('name');
    const slugMap = buildEventSlugMap(marketplaceEvents || []);
    console.log(`Built slug map with ${slugMap.size} marketplace events`);

    // 2. Fetch all previously synced emails for deduplication
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

    // 3. Fetch ALL volunteers (now including events_list and employee_vertical)
    const { data: allVolunteers, error: volError } = await supabase
      .from('pending_volunteers')
      .select('id, first_name, last_name, email, phone_number, is_employee, external_company, gender, events_list, employee_vertical');

    if (volError) {
      throw new Error(`Failed to fetch volunteers: ${volError.message}`);
    }

    const volunteers = allVolunteers || [];
    console.log(`Fetched ${volunteers.length} volunteers from pending_volunteers`);

    // 4. Separate new vs already-synced volunteers
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

    // 5. Create new volunteers with enriched payload
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
          // Find and update the most recent failed log entry for this volunteer
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

    // 6. Bulk-update previously synced volunteers with enriched data
    if (previouslySyncedVolunteers.length > 0) {
      const bulkPayload = previouslySyncedVolunteers
        .filter(vol => vol.email)
        .map(vol => {
          const enriched = buildVolunteerPayload(vol, slugMap);
          // bulk-update uses email as identifier, keep only updatable fields
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

    // 7. Demographics update (optional, only if marketplace IDs provided)
    let marketplaceIdsToProcess: string[] = [];
    if (marketplace_ids && Array.isArray(marketplace_ids) && marketplace_ids.length > 0) {
      marketplaceIdsToProcess = marketplace_ids;
    } else if (marketplace_id) {
      marketplaceIdsToProcess = [marketplace_id];
    }

    if (marketplaceIdsToProcess.length > 0) {
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const surplussEventsMap = new Map<string, number>();

      try {
        const lookupUrl = `${baseUrl}/api/common/marketplace-events`;
        console.log(`\n🔍 Looking up Surpluss events from: ${lookupUrl}`);
        const lookupResp = await fetch(lookupUrl, { headers: apiHeaders });
        const lookupBody = await lookupResp.text();

        if (lookupResp.ok) {
          let parsed: any;
          try { parsed = JSON.parse(lookupBody); } catch { parsed = null; }
          
          console.log(`📦 Raw response structure:`, {
            isArray: Array.isArray(parsed),
            keys: parsed && typeof parsed === 'object' ? Object.keys(parsed) : 'N/A',
            sample: parsed && typeof parsed === 'object' ? JSON.stringify(parsed).substring(0, 200) : parsed
          });
          
          const items = Array.isArray(parsed) ? parsed : (parsed?.items || parsed?.data || parsed?.results || parsed?.events || []);
          if (Array.isArray(items)) {
            console.log(`✅ Found ${items.length} Surpluss events`);
            for (const item of items) {
              const name = normalize(item.title || item.name || '');
              const eventId = item.id;
              if (name && eventId) {
                surplussEventsMap.set(name, eventId);
                console.log(`   Mapped: "${item.title || item.name}" (normalized: "${name}") -> ID: ${eventId}`);
              } else {
                console.log(`   ⚠️  Skipped item (missing name or id):`, { name: item.title || item.name, id: item.id });
              }
            }
            console.log(`📋 Surpluss Events Map size: ${surplussEventsMap.size}`);
            console.log(`📋 First 5 entries:`, Array.from(surplussEventsMap.entries()).slice(0, 5));
          } else {
            console.log(`⚠️  No events array found in response`);
            console.log(`   Response type:`, typeof parsed);
            console.log(`   Response keys:`, parsed && typeof parsed === 'object' ? Object.keys(parsed) : 'N/A');
          }
        } else {
          console.log(`❌ Failed to fetch Surpluss events: ${lookupResp.status}`);
          console.log(`   Response body:`, lookupBody.substring(0, 500));
        }
      } catch (err) {
        console.log(`❌ Surpluss events lookup error:`, err);
        allErrors.push(`Surpluss events lookup error: ${err instanceof Error ? err.message : 'Unknown'}`);
      }


      for (const mpId of marketplaceIdsToProcess) {
        console.log(`\n=== Processing Marketplace ID: ${mpId} ===`);
        const { data: marketplace } = await supabase
          .from('marketplace_events')
          .select('*')
          .eq('id', mpId)
          .single();

        if (!marketplace) {
          console.log(`❌ Marketplace not found for ID: ${mpId}`);
          demographicsFailed++;
          demographicsDetails.push({ marketplace_id: mpId, marketplace_name: 'Unknown', status: 'failed', reason: 'Marketplace not found' });
          continue;
        }

        console.log(`✅ Marketplace found: ${marketplace.name}`);

        // --- Demographics Update ---
        let surplussEventId: number | null = null;
        const targetName = normalize(marketplace.name);

        if (surplussEventsMap.has(targetName)) {
          surplussEventId = surplussEventsMap.get(targetName)!;
        } else {
          for (const [eventName, eventId] of surplussEventsMap) {
            if (eventName.includes(targetName) || targetName.includes(eventName)) {
              surplussEventId = eventId;
              break;
            }
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

          if (Object.keys(demographicsPayload).length === 0) {
            demographicsDetails.push({ marketplace_id: mpId, marketplace_name: marketplace.name, status: 'skipped', reason: 'No demographics data', surpluss_event_id: surplussEventId });
          } else {
            try {
              const updateUrl = `${baseUrl}/api/common/marketplace-events/${surplussEventId}`;
              const response = await fetch(updateUrl, { method: 'PUT', headers: apiHeaders, body: JSON.stringify(demographicsPayload) });
              const responseBody = await response.text();
              let responseJson: any;
              try { responseJson = JSON.parse(responseBody); } catch { responseJson = { raw: responseBody.substring(0, 500) }; }

              await supabase.from('surpluss_api_audit_log').insert({
                action: 'sync_beneficiary_demographics', environment,
                request_payload: demographicsPayload, response_status: response.status,
                response_body: responseJson, success: response.ok,
              });
              if (response.ok) {
                demographicsSent++;
                demographicsDetails.push({ marketplace_id: mpId, marketplace_name: marketplace.name, status: 'sent', surpluss_event_id: surplussEventId });
              } else {
                demographicsFailed++;
                demographicsDetails.push({ marketplace_id: mpId, marketplace_name: marketplace.name, status: 'failed', reason: `${response.status}`, surpluss_event_id: surplussEventId });
              }
            } catch (err) {
              demographicsFailed++;
              demographicsDetails.push({ marketplace_id: mpId, marketplace_name: marketplace.name, status: 'failed', reason: err instanceof Error ? err.message : 'Unknown' });
            }
          }
        } else {
          allErrors.push(`No matching Surpluss Event ID for "${marketplace.name}"`);
          demographicsFailed++;
          demographicsDetails.push({ marketplace_id: mpId, marketplace_name: marketplace.name, status: 'failed', reason: 'No matching Surpluss event' });
        }

        // --- Individual Beneficiary Cards Sync ---
        console.log(`\n👥 Fetching beneficiary cards for marketplace: ${marketplace.name}`);
        const { data: cards, error: cardsError } = await supabase
          .from('qr_cards')
          .select('unique_id, gender, nationality, marital_status, children_count, total_items_collected, credit_balance')
          .eq('marketplace_id', mpId);

        if (cardsError) {
          console.log(`❌ Failed to fetch cards: ${cardsError.message}`);
          allErrors.push(`Failed to fetch beneficiary cards for "${marketplace.name}": ${cardsError.message}`);
        } else if (cards && cards.length > 0) {
          console.log(`Found ${cards.length} beneficiary cards for ${marketplace.name}`);
          beneficiariesTotal += cards.length;

          const newCards: any[] = [];
          const previousCards: any[] = [];
          for (const card of cards) {
            if (alreadySyncedCardIds.has(card.unique_id.toLowerCase())) {
              previousCards.push(card);
            } else {
              newCards.push(card);
            }
          }

          console.log(`  New: ${newCards.length}, Previously synced: ${previousCards.length}`);

          // POST new beneficiary cards
          for (const card of newCards) {
            const cardPayload: Record<string, any> = {
              name: `Beneficiary-${card.unique_id}`,
              unique_id: card.unique_id,
              type: 'beneficiary',
            };
            if (card.gender) {
              const g = card.gender.toLowerCase();
              if (g === 'male' || g === 'female') cardPayload.gender = g.toUpperCase();
            }
            if (card.nationality) cardPayload.nationality = card.nationality;
            if (card.children_count != null) cardPayload.children_count = card.children_count;
            if (card.total_items_collected != null) cardPayload.items_collected = card.total_items_collected;
            if (card.marital_status) cardPayload.marital_status = card.marital_status;

            try {
              const response = await fetch(`${baseUrl}/api/common/volunteers`, {
                method: 'POST', headers: apiHeaders, body: JSON.stringify(cardPayload),
              });
              const responseBody = await response.text();
              let responseJson: any;
              try { responseJson = JSON.parse(responseBody); } catch { responseJson = { raw: responseBody.substring(0, 500) }; }

              await supabase.from('surpluss_api_audit_log').insert({
                action: 'sync_beneficiary', environment,
                request_payload: cardPayload, response_status: response.status,
                response_body: responseJson, success: response.ok,
              });

              if (response.ok) {
                beneficiariesSent++;
                beneficiaryCardDetails.push({ unique_id: card.unique_id, status: 'sent' });
              } else if (responseBody.includes('already exists')) {
                beneficiariesSkipped++;
                beneficiaryCardDetails.push({ unique_id: card.unique_id, status: 'skipped', reason: 'Already exists' });
                const { data: recentLogs } = await supabase
                  .from('surpluss_api_audit_log')
                  .select('id').eq('action', 'sync_beneficiary').eq('success', false)
                  .order('created_at', { ascending: false }).limit(1);
                if (recentLogs && recentLogs.length > 0) {
                  await supabase.from('surpluss_api_audit_log').update({ success: true }).eq('id', recentLogs[0].id);
                }
              } else {
                beneficiariesFailed++;
                beneficiaryCardDetails.push({ unique_id: card.unique_id, status: 'failed', reason: `${response.status}` });
              }
            } catch (err) {
              beneficiariesFailed++;
              beneficiaryCardDetails.push({ unique_id: card.unique_id, status: 'failed', reason: err instanceof Error ? err.message : 'Unknown' });
            }
          }

          // Bulk-update previously synced beneficiary cards
          if (previousCards.length > 0) {
            const bulkPayload = previousCards.map(card => {
              const p: Record<string, any> = {
                name: `Beneficiary-${card.unique_id}`,
                unique_id: card.unique_id,
                type: 'beneficiary',
              };
              if (card.gender) {
                const g = card.gender.toLowerCase();
                if (g === 'male' || g === 'female') p.gender = g.toUpperCase();
              }
              if (card.nationality) p.nationality = card.nationality;
              if (card.children_count != null) p.children_count = card.children_count;
              if (card.total_items_collected != null) p.items_collected = card.total_items_collected;
              return p;
            });

            try {
              const response = await fetch(`${baseUrl}/api/common/volunteers/bulk-update`, {
                method: 'POST', headers: apiHeaders, body: JSON.stringify({ volunteers: bulkPayload }),
              });
              const responseBody = await response.text();
              let responseJson: any;
              try { responseJson = JSON.parse(responseBody); } catch { responseJson = { raw: responseBody.substring(0, 500) }; }

              await supabase.from('surpluss_api_audit_log').insert({
                action: 'bulk_update_beneficiaries', environment,
                request_payload: { count: bulkPayload.length, sample: bulkPayload.slice(0, 3) },
                response_status: response.status, response_body: responseJson, success: response.ok,
              });

              if (response.ok) {
                for (const card of previousCards) {
                  beneficiaryCardDetails.push({ unique_id: card.unique_id, status: 'sent' });
                }
                beneficiariesSent += previousCards.length;
              } else {
                for (const card of previousCards) {
                  beneficiaryCardDetails.push({ unique_id: card.unique_id, status: 'skipped', reason: 'Bulk-update failed' });
                }
                beneficiariesSkipped += previousCards.length;
              }
            } catch (err) {
              beneficiariesSkipped += previousCards.length;
              allErrors.push(`Beneficiary bulk-update error: ${err instanceof Error ? err.message : 'Unknown'}`);
            }
          }
        } else {
          console.log(`No beneficiary cards found for marketplace: ${marketplace.name}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: totalFailed === 0 && demographicsFailed === 0 && beneficiariesFailed === 0,
        volunteers_sent: totalSent,
        volunteers_failed: totalFailed,
        volunteers_skipped: totalSkipped,
        volunteers_bulk_updated: totalBulkUpdated,
        volunteers_total: volunteers.length,
        volunteer_details: allVolunteerDetails,
        beneficiaries_sent: beneficiariesSent,
        beneficiaries_failed: beneficiariesFailed,
        beneficiaries_skipped: beneficiariesSkipped,
        beneficiaries_total: beneficiariesTotal,
        beneficiary_card_details: beneficiaryCardDetails,
        demographics_sent: demographicsSent,
        demographics_failed: demographicsFailed,
        demographics_details: demographicsDetails,
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