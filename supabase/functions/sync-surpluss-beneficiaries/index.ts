import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/** Build beneficiary payload for Surpluss API */
function buildBeneficiaryPayload(beneficiary: any): Record<string, any> {
  // Required fields
  const uniqueId = beneficiary.unique_id || beneficiary.qr_id || beneficiary.id;
  if (!uniqueId) {
    throw new Error('unique_id is required for beneficiary');
  }

  const payload: Record<string, any> = {
    name: `Beneficiary-${uniqueId}`,
    unique_id: uniqueId,
    type: 'beneficiary', // Always "beneficiary" to distinguish from volunteers
  };

  // Gender mapping (MALE or FEMALE)
  if (beneficiary.gender) {
    const g = beneficiary.gender.toUpperCase();
    if (g === 'MALE' || g === 'FEMALE') {
      payload.gender = g;
    } else if (g === 'M' || g === 'F') {
      payload.gender = g === 'M' ? 'MALE' : 'FEMALE';
    }
  }

  // Nationality
  if (beneficiary.nationality) {
    payload.nationality = beneficiary.nationality.toLowerCase();
  }

  // Marital status
  if (beneficiary.marital_status) {
    payload.marital_status = beneficiary.marital_status.toLowerCase();
  }

  // Children count
  if (beneficiary.children_count != null) {
    payload.children_count = parseInt(beneficiary.children_count) || 0;
  }

  // Items collected
  if (beneficiary.items_collected != null) {
    payload.items_collected = parseInt(beneficiary.items_collected) || 0;
  }

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
    let beneficiariesSent = 0;
    let beneficiariesFailed = 0;
    let beneficiariesSkipped = 0;
    const beneficiaryDetails: { 
      unique_id: string; 
      name: string; 
      status: 'sent' | 'failed' | 'skipped'; 
      reason?: string; 
    }[] = [];

    // 1. Fetch all previously synced unique_ids for deduplication
    const { data: previousSyncs } = await supabase
      .from('surpluss_api_audit_log')
      .select('request_payload')
      .eq('action', 'sync_beneficiary')
      .eq('success', true);

    const alreadySyncedUniqueIds = new Set<string>();
    if (previousSyncs) {
      for (const log of previousSyncs) {
        const payload = log.request_payload as any;
        if (payload?.unique_id) {
          alreadySyncedUniqueIds.add(payload.unique_id);
        }
      }
    }
    console.log(`Found ${alreadySyncedUniqueIds.size} previously synced beneficiaries`);

    // 2. Determine which beneficiaries to fetch
    let beneficiariesQuery = supabase
      .from('pending_beneficiaries')
      .select('*');

    // Filter by marketplace if provided
    if (marketplace_ids && Array.isArray(marketplace_ids) && marketplace_ids.length > 0) {
      const orConditions = marketplace_ids.map(id => `marketplace_event_id.eq.${id},marketplace_id.eq.${id}`).join(',');
      beneficiariesQuery = beneficiariesQuery.or(orConditions);
    } else if (marketplace_id) {
      beneficiariesQuery = beneficiariesQuery.or(`marketplace_event_id.eq.${marketplace_id},marketplace_id.eq.${marketplace_id}`);
    }

    const { data: allBeneficiaries, error: benError } = await beneficiariesQuery;

    if (benError) {
      throw new Error(`Failed to fetch beneficiaries: ${benError.message}`);
    }

    const beneficiaries = allBeneficiaries || [];
    console.log(`Fetched ${beneficiaries.length} beneficiaries from pending_beneficiaries`);

    // 3. Separate new vs already-synced beneficiaries
    const newBeneficiaries: any[] = [];
    const previouslySyncedBeneficiaries: any[] = [];

    for (const ben of beneficiaries) {
      const uniqueId = ben.unique_id || ben.qr_id || ben.id;
      if (!uniqueId) {
        beneficiariesFailed++;
        beneficiaryDetails.push({ 
          unique_id: ben.id || 'Unknown', 
          name: 'Unknown', 
          status: 'failed', 
          reason: 'No unique_id found' 
        });
        continue;
      }

      if (alreadySyncedUniqueIds.has(uniqueId)) {
        previouslySyncedBeneficiaries.push(ben);
      } else {
        newBeneficiaries.push(ben);
      }
    }

    console.log(`New beneficiaries: ${newBeneficiaries.length}, Previously synced: ${previouslySyncedBeneficiaries.length}`);

    // 4. Create new beneficiaries
    for (const ben of newBeneficiaries) {
      const uniqueId = ben.unique_id || ben.qr_id || ben.id;
      const beneficiaryName = `Beneficiary-${uniqueId}`;

      try {
        const beneficiaryPayload = buildBeneficiaryPayload(ben);

        const apiUrl = `${baseUrl}/api/common/volunteers`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify(beneficiaryPayload),
        });

        const responseBody = await response.text();
        let responseJson: any;
        try { 
          responseJson = JSON.parse(responseBody); 
        } catch { 
          responseJson = responseBody.includes('<!DOCTYPE') ? { raw: 'HTML response' } : { raw: responseBody.substring(0, 500) };
        }

        await supabase.from('surpluss_api_audit_log').insert({
          action: 'sync_beneficiary',
          environment,
          request_payload: beneficiaryPayload,
          response_status: response.status,
          response_body: responseJson,
          success: response.ok,
        });

        if (response.ok) {
          beneficiariesSent++;
          beneficiaryDetails.push({ 
            unique_id: uniqueId, 
            name: beneficiaryName, 
            status: 'sent' 
          });
        } else if (responseBody.includes('already exists')) {
          beneficiariesSkipped++;
          beneficiaryDetails.push({ 
            unique_id: uniqueId, 
            name: beneficiaryName, 
            status: 'skipped', 
            reason: 'Already exists in Surpluss' 
          });
        } else {
          beneficiariesFailed++;
          const reason = `${response.status} - ${responseBody.substring(0, 200)}`;
          beneficiaryDetails.push({ 
            unique_id: uniqueId, 
            name: beneficiaryName, 
            status: 'failed', 
            reason 
          });
        }
      } catch (err) {
        beneficiariesFailed++;
        beneficiaryDetails.push({ 
          unique_id: uniqueId, 
          name: beneficiaryName, 
          status: 'failed', 
          reason: err instanceof Error ? err.message : 'Unknown' 
        });
      }
    }

    // 5. Handle previously synced beneficiaries (optional: could update them if needed)
    if (previouslySyncedBeneficiaries.length > 0) {
      console.log(`Skipping ${previouslySyncedBeneficiaries.length} previously synced beneficiaries`);
      for (const ben of previouslySyncedBeneficiaries) {
        const uniqueId = ben.unique_id || ben.qr_id || ben.id;
        beneficiariesSkipped++;
        beneficiaryDetails.push({ 
          unique_id: uniqueId, 
          name: `Beneficiary-${uniqueId}`, 
          status: 'skipped', 
          reason: 'Already synced' 
        });
      }
    }

    // 6. Aggregate beneficiaries by marketplace event and update marketplace events
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Get all marketplace events from Supabase
    const { data: supabaseMarketplaces } = await supabase
      .from('marketplace_events')
      .select('id, name');
    
    // Fetch Surpluss marketplace events for ID mapping
    const surplussEventsMap = new Map<string, number>();
    try {
      const lookupUrl = `${baseUrl}/api/common/marketplace-events`;
      console.log(`🔍 Looking up Surpluss events for marketplace linking...`);
      const lookupResp = await fetch(lookupUrl, { headers: apiHeaders });
      const lookupBody = await lookupResp.text();

      if (lookupResp.ok) {
        let parsed: any;
        try { parsed = JSON.parse(lookupBody); } catch { parsed = null; }
        
        const items = Array.isArray(parsed) ? parsed : (parsed?.items || parsed?.data || parsed?.results || parsed?.events || []);
        if (Array.isArray(items)) {
          for (const item of items) {
            const name = normalize(item.title || item.name || '');
            const eventId = item.id;
            if (name && eventId) {
              surplussEventsMap.set(name, eventId);
            }
          }
          console.log(`📋 Mapped ${surplussEventsMap.size} Surpluss events`);
        }
      }
    } catch (err) {
      console.log(`⚠️  Failed to fetch Surpluss events for mapping:`, err);
    }

    // Group beneficiaries by marketplace event
    const beneficiariesByEvent = new Map<string, any[]>();
    for (const ben of beneficiaries) {
      const eventId = ben.marketplace_event_id || ben.marketplace_id;
      if (eventId) {
        if (!beneficiariesByEvent.has(eventId)) {
          beneficiariesByEvent.set(eventId, []);
        }
        beneficiariesByEvent.get(eventId)!.push(ben);
      }
    }

    // Aggregate and update each marketplace event
    let eventsUpdated = 0;
    let eventsFailed = 0;
    
    for (const [supabaseEventId, eventBeneficiaries] of beneficiariesByEvent) {
      // Find Supabase marketplace event
      const supabaseMarketplace = supabaseMarketplaces?.find(mp => mp.id === supabaseEventId);
      if (!supabaseMarketplace) {
        console.log(`⚠️  Marketplace event not found in Supabase: ${supabaseEventId}`);
        continue;
      }

      // Find matching Surpluss event
      const targetName = normalize(supabaseMarketplace.name);
      let surplussEventId: number | null = null;
      
      if (surplussEventsMap.has(targetName)) {
        surplussEventId = surplussEventsMap.get(targetName)!;
      } else {
        // Try partial match
        for (const [eventName, eventId] of surplussEventsMap) {
          if (eventName.includes(targetName) || targetName.includes(eventName)) {
            surplussEventId = eventId;
            break;
          }
        }
      }

      if (!surplussEventId) {
        console.log(`⚠️  No matching Surpluss event found for "${supabaseMarketplace.name}"`);
        eventsFailed++;
        continue;
      }

      // Aggregate beneficiaries by beneficiary_type_id
      const aggregatedByType = new Map<number, any>();
      
      for (const ben of eventBeneficiaries) {
        const beneficiaryTypeId = ben.beneficiary_type_id;
        if (!beneficiaryTypeId) {
          console.log(`⚠️  Beneficiary missing beneficiary_type_id: ${ben.unique_id || ben.id}`);
          continue;
        }

        if (!aggregatedByType.has(beneficiaryTypeId)) {
          aggregatedByType.set(beneficiaryTypeId, {
            beneficiary_type_id: beneficiaryTypeId,
            target_value: 0,
            reach_value: 0,
            male_count: 0,
            female_count: 0,
            age_0_17_count: 0,
            age_18_30_count: 0,
            age_31_40_count: 0,
            age_41_50_count: 0,
            age_51_60_count: 0,
            age_61_plus_count: 0,
            widowed_count: 0,
            divorced_count: 0,
            married_count: 0,
          });
        }

        const agg = aggregatedByType.get(beneficiaryTypeId)!;
        agg.reach_value += 1; // Each beneficiary counts as 1 reach
        
        // Aggregate demographics
        if (ben.gender) {
          const g = ben.gender.toUpperCase();
          if (g === 'MALE' || g === 'M') agg.male_count += 1;
          else if (g === 'FEMALE' || g === 'F') agg.female_count += 1;
        }
        
        // Age groups (if available in Supabase)
        if (ben.age_0_17_count) agg.age_0_17_count += ben.age_0_17_count;
        if (ben.age_18_30_count) agg.age_18_30_count += ben.age_18_30_count;
        if (ben.age_31_40_count) agg.age_31_40_count += ben.age_31_40_count;
        if (ben.age_41_50_count) agg.age_41_50_count += ben.age_41_50_count;
        if (ben.age_51_60_count) agg.age_51_60_count += ben.age_51_60_count;
        if (ben.age_61_plus_count) agg.age_61_plus_count += ben.age_61_plus_count;
        
        // Marital status
        if (ben.marital_status) {
          const ms = ben.marital_status.toLowerCase();
          if (ms === 'married') agg.married_count += 1;
          else if (ms === 'divorced') agg.divorced_count += 1;
          else if (ms === 'widowed') agg.widowed_count += 1;
        }
      }

      if (aggregatedByType.size === 0) {
        console.log(`⚠️  No valid beneficiary types to aggregate for event ${supabaseEventId}`);
        continue;
      }

      // Build beneficiary_types array
      const beneficiaryTypesArray = Array.from(aggregatedByType.values());

      // Update marketplace event with aggregated beneficiary types
      try {
        const updateUrl = `${baseUrl}/api/common/marketplace-events/${surplussEventId}`;
        console.log(`📤 Updating marketplace event ${surplussEventId} with ${beneficiaryTypesArray.length} beneficiary types`);
        
        const updatePayload = {
          beneficiary_types: beneficiaryTypesArray
        };

        const response = await fetch(updateUrl, {
          method: 'PUT',
          headers: apiHeaders,
          body: JSON.stringify(updatePayload),
        });

        const responseBody = await response.text();
        let responseJson: any;
        try { 
          responseJson = JSON.parse(responseBody); 
        } catch { 
          responseJson = { raw: responseBody.substring(0, 500) }; 
        }

        await supabase.from('surpluss_api_audit_log').insert({
          action: 'sync_beneficiary_types_to_event',
          environment,
          request_payload: { 
            marketplace_event_id: surplussEventId,
            beneficiary_types: beneficiaryTypesArray 
          },
          response_status: response.status,
          response_body: responseJson,
          success: response.ok,
        });

        if (response.ok) {
          eventsUpdated++;
          console.log(`✅ Updated marketplace event ${surplussEventId} successfully`);
        } else {
          eventsFailed++;
          console.log(`❌ Failed to update marketplace event ${surplussEventId}: ${response.status}`);
          allErrors.push(`Failed to update marketplace event ${surplussEventId}: ${response.status} - ${responseBody.substring(0, 200)}`);
        }
      } catch (err) {
        eventsFailed++;
        console.log(`❌ Error updating marketplace event ${surplussEventId}:`, err);
        allErrors.push(`Error updating marketplace event ${surplussEventId}: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: beneficiariesFailed === 0 && eventsFailed === 0,
        beneficiaries_sent: beneficiariesSent,
        beneficiaries_failed: beneficiariesFailed,
        beneficiaries_skipped: beneficiariesSkipped,
        beneficiaries_total: beneficiaries.length,
        marketplace_events_updated: eventsUpdated,
        marketplace_events_failed: eventsFailed,
        beneficiary_details: beneficiaryDetails,
        errors: allErrors,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in beneficary sync:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
