import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/** Build beneficiary payload for Surpluss API */
function buildBeneficiaryPayload(card: any, eventId?: number): Record<string, any> {
  const uniqueId = card.unique_id;
  if (!uniqueId) {
    throw new Error('unique_id is required for beneficiary');
  }

  const payload: Record<string, any> = {
    name: `Beneficiary-${uniqueId}`,
    unique_id: uniqueId,
    type: 'beneficiary',
  };

  // Link to Surpluss marketplace event
  if (eventId) {
    payload.event_id = eventId;
  }

  // Gender mapping (MALE or FEMALE)
  if (card.gender) {
    const g = card.gender.toUpperCase();
    if (g === 'MALE' || g === 'FEMALE') {
      payload.gender = g;
    } else if (g === 'M' || g === 'F') {
      payload.gender = g === 'M' ? 'MALE' : 'FEMALE';
    }
  }

  // Nationality
  if (card.nationality) {
    payload.nationality = card.nationality.toLowerCase();
  }

  // Marital status
  if (card.marital_status) {
    payload.marital_status = card.marital_status.toLowerCase();
  }

  // Children count
  if (card.children_count != null) {
    payload.children_count = parseInt(card.children_count) || 0;
  }

  // Items collected
  if (card.total_items_collected != null) {
    payload.items_collected = parseInt(card.total_items_collected) || 0;
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
    let beneficiariesBulkUpdated = 0;
    const beneficiaryDetails: {
      unique_id: string;
      name: string;
      status: 'sent' | 'failed' | 'skipped' | 'bulk_updated';
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
          alreadySyncedUniqueIds.add(payload.unique_id.toLowerCase());
        }
      }
    }
    console.log(`Found ${alreadySyncedUniqueIds.size} previously synced beneficiaries`);

    // 2. Determine marketplace IDs to process
    let marketplaceIdsToProcess: string[] = [];
    if (marketplace_ids && Array.isArray(marketplace_ids) && marketplace_ids.length > 0) {
      marketplaceIdsToProcess = marketplace_ids;
    } else if (marketplace_id) {
      marketplaceIdsToProcess = [marketplace_id];
    }

    if (marketplaceIdsToProcess.length === 0) {
      return new Response(
        JSON.stringify({ error: 'marketplace_id or marketplace_ids is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Process each marketplace
    for (const mpId of marketplaceIdsToProcess) {
      console.log(`\n=== Processing Marketplace ID: ${mpId} ===`);

      const { data: marketplace } = await supabase
        .from('marketplace_events')
        .select('name')
        .eq('id', mpId)
        .single();

      const mpName = marketplace?.name || mpId;

      // Fetch beneficiary cards for this marketplace
      const { data: cards, error: cardsError } = await supabase
        .from('qr_cards')
        .select('unique_id, gender, nationality, marital_status, children_count, total_items_collected, credit_balance')
        .eq('marketplace_id', mpId);

      if (cardsError) {
        console.log(`❌ Failed to fetch cards for ${mpName}: ${cardsError.message}`);
        allErrors.push(`Failed to fetch beneficiary cards for "${mpName}": ${cardsError.message}`);
        continue;
      }

      if (!cards || cards.length === 0) {
        console.log(`No beneficiary cards found for marketplace: ${mpName}`);
        continue;
      }

      console.log(`Found ${cards.length} beneficiary cards for ${mpName}`);

      // Separate new vs already-synced
      const newCards: any[] = [];
      const previousCards: any[] = [];

      for (const card of cards) {
        if (!card.unique_id) {
          beneficiariesFailed++;
          beneficiaryDetails.push({
            unique_id: 'Unknown',
            name: 'Unknown',
            status: 'failed',
            reason: 'No unique_id found',
          });
          continue;
        }

        if (alreadySyncedUniqueIds.has(card.unique_id.toLowerCase())) {
          previousCards.push(card);
        } else {
          newCards.push(card);
        }
      }

      console.log(`  New: ${newCards.length}, Previously synced: ${previousCards.length}`);

      // 4. POST new beneficiary cards
      for (const card of newCards) {
        const beneficiaryName = `Beneficiary-${card.unique_id}`;
        try {
          const beneficiaryPayload = buildBeneficiaryPayload(card);

          const response = await fetch(`${baseUrl}/api/common/volunteers`, {
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
            beneficiaryDetails.push({ unique_id: card.unique_id, name: beneficiaryName, status: 'sent' });
          } else if (responseBody.includes('already exists')) {
            beneficiariesSkipped++;
            beneficiaryDetails.push({ unique_id: card.unique_id, name: beneficiaryName, status: 'skipped', reason: 'Already exists in Surpluss' });
            // Mark the failed audit log as success
            const { data: recentLogs } = await supabase
              .from('surpluss_api_audit_log')
              .select('id')
              .eq('action', 'sync_beneficiary')
              .eq('success', false)
              .order('created_at', { ascending: false })
              .limit(1);
            if (recentLogs && recentLogs.length > 0) {
              await supabase.from('surpluss_api_audit_log').update({ success: true }).eq('id', recentLogs[0].id);
            }
          } else {
            beneficiariesFailed++;
            const reason = `${response.status} - ${responseBody.substring(0, 200)}`;
            beneficiaryDetails.push({ unique_id: card.unique_id, name: beneficiaryName, status: 'failed', reason });
          }
        } catch (err) {
          beneficiariesFailed++;
          beneficiaryDetails.push({
            unique_id: card.unique_id,
            name: beneficiaryName,
            status: 'failed',
            reason: err instanceof Error ? err.message : 'Unknown',
          });
        }
      }

      // 5. Bulk-update previously synced beneficiary cards
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
            method: 'POST',
            headers: apiHeaders,
            body: JSON.stringify({ volunteers: bulkPayload }),
          });

          const responseBody = await response.text();
          let responseJson: any;
          try { responseJson = JSON.parse(responseBody); } catch { responseJson = { raw: responseBody.substring(0, 500) }; }

          await supabase.from('surpluss_api_audit_log').insert({
            action: 'bulk_update_beneficiaries',
            environment,
            request_payload: { count: bulkPayload.length, sample: bulkPayload.slice(0, 3) },
            response_status: response.status,
            response_body: responseJson,
            success: response.ok,
          });

          if (response.ok) {
            beneficiariesBulkUpdated += previousCards.length;
            for (const card of previousCards) {
              beneficiaryDetails.push({ unique_id: card.unique_id, name: `Beneficiary-${card.unique_id}`, status: 'bulk_updated' });
            }
          } else {
            beneficiariesSkipped += previousCards.length;
            for (const card of previousCards) {
              beneficiaryDetails.push({ unique_id: card.unique_id, name: `Beneficiary-${card.unique_id}`, status: 'skipped', reason: 'Bulk-update failed' });
            }
          }
        } catch (err) {
          beneficiariesSkipped += previousCards.length;
          allErrors.push(`Beneficiary bulk-update error: ${err instanceof Error ? err.message : 'Unknown'}`);
        }
      }
    }

    const totalProcessed = beneficiariesSent + beneficiariesFailed + beneficiariesSkipped + beneficiariesBulkUpdated;

    return new Response(
      JSON.stringify({
        success: beneficiariesFailed === 0,
        beneficiaries_sent: beneficiariesSent,
        beneficiaries_failed: beneficiariesFailed,
        beneficiaries_skipped: beneficiariesSkipped,
        beneficiaries_bulk_updated: beneficiariesBulkUpdated,
        beneficiaries_total: totalProcessed,
        beneficiary_details: beneficiaryDetails,
        errors: allErrors,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in sync-surpluss-beneficiaries:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
