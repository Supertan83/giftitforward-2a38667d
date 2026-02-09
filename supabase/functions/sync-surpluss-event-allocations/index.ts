import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BASE_URLS: Record<string, string> = {
  staging: 'https://surpluss-server.herokuapp.com',
  production: 'https://api.thesurpluss.com',
};

interface SyncRequest {
  marketplace_id: string; // GIF UUID or "ALL" for cron
  environment?: 'staging' | 'production';
}

// Sync a single marketplace, returns summary
async function syncSingleMarketplace(
  supabase: any,
  marketplace: { id: string; name: string; external_id: number },
  environment: string,
  apiHeaders: Record<string, string>,
  baseUrl: string
) {
  const apiUrl = `${baseUrl}/api/common/marketplace-events/${marketplace.external_id}/allocations`;
  console.log(`[sync] Fetching: ${apiUrl}`);
  
  const apiResponse = await fetch(apiUrl, { headers: apiHeaders });
  const apiText = await apiResponse.text();

  if (!apiResponse.ok) {
    return { marketplace_name: marketplace.name, success: false, error: `API ${apiResponse.status}`, synced: 0, created: 0, updated: 0 };
  }

  let surplussAllocations: any[];
  try {
    const parsed = JSON.parse(apiText);
    surplussAllocations = Array.isArray(parsed) ? parsed : (parsed.data || parsed.allocations || []);
  } catch {
    return { marketplace_name: marketplace.name, success: false, error: 'Parse error', synced: 0, created: 0, updated: 0 };
  }
  if (!Array.isArray(surplussAllocations)) surplussAllocations = [];

  let synced = 0, created = 0, updated = 0;
  const errors: string[] = [];

  for (const alloc of surplussAllocations) {
    try {
      const materialId = alloc.donation_metadata?.id || alloc.material_id || alloc.donation_metadata_id;
      const materialTitle = alloc.donation_metadata?.title || alloc.title || `Material ${materialId}`;
      const allocatedAmount = alloc.amount || 0;
      const distributedAmount = alloc.distributed_amount || 0;
      if (!materialId) { errors.push('No material ID'); continue; }

      let { data: itemType } = await supabase
        .from('item_types').select('id').eq('external_material_id', materialId).maybeSingle();

      if (!itemType) {
        const { data: newItem, error: insertError } = await supabase
          .from('item_types')
          .insert({ name: materialTitle, external_material_id: materialId, icon: 'Package', total_stock: allocatedAmount, surpluss_url: `https://platform.thesurpluss.com/material/${materialId}` })
          .select('id').single();
        if (insertError) { errors.push(insertError.message); continue; }
        itemType = newItem;
        created++;
      }

      const { data: existingAlloc } = await supabase
        .from('marketplace_item_allocations')
        .select('id, allocated_quantity, distributed_quantity')
        .eq('marketplace_id', marketplace.id).eq('item_type_id', itemType.id).maybeSingle();

      if (existingAlloc) {
        await supabase.from('marketplace_item_allocations')
          .update({ allocated_quantity: allocatedAmount, distributed_quantity: distributedAmount, updated_at: new Date().toISOString() })
          .eq('id', existingAlloc.id);
        updated++;
      } else {
        await supabase.from('marketplace_item_allocations')
          .insert({ marketplace_id: marketplace.id, item_type_id: itemType.id, allocated_quantity: allocatedAmount, distributed_quantity: distributedAmount });
        created++;
      }
      synced++;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  // Audit log
  await supabase.from('surpluss_api_audit_log').insert({
    action: 'sync_event_allocations', environment,
    request_payload: { marketplace_id: marketplace.id, external_id: marketplace.external_id },
    response_status: apiResponse.status,
    response_body: { total_fetched: surplussAllocations.length, synced, created, updated, errors: errors.length },
    success: errors.length === 0,
  }).catch(() => {});

  return { marketplace_name: marketplace.name, success: true, synced, created, updated, errors, total_fetched: surplussAllocations.length };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { marketplace_id, environment = 'production' }: SyncRequest = await req.json();

    if (!marketplace_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'marketplace_id is required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Build API headers
    const apiHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    const apiKey = Deno.env.get('SURPLUSS_API_KEY');
    if (apiKey) {
      apiHeaders['Authorization'] = `Bearer ${apiKey}`;
      apiHeaders['x-api-key'] = apiKey;
    }

    const baseUrl = BASE_URLS[environment];

    // Handle "ALL" mode (cron job) — sync every marketplace with an external_id
    if (marketplace_id === 'ALL') {
      const { data: marketplaces, error: mpErr } = await supabase
        .from('marketplace_events')
        .select('id, name, external_id')
        .not('external_id', 'is', null);

      if (mpErr || !marketplaces?.length) {
        return new Response(
          JSON.stringify({ success: true, message: 'No linked marketplaces found', synced_events: 0 }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[sync-all] Syncing ${marketplaces.length} marketplace events`);
      const results = [];
      for (const mp of marketplaces) {
        const result = await syncSingleMarketplace(supabase, mp, environment, apiHeaders, baseUrl);
        results.push(result);
      }

      const totalSynced = results.reduce((s, r) => s + (r.synced || 0), 0);
      return new Response(
        JSON.stringify({ success: true, mode: 'ALL', synced_events: marketplaces.length, total_synced: totalSynced, results }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Single marketplace mode
    const { data: marketplace, error: mpError } = await supabase
      .from('marketplace_events')
      .select('id, name, external_id')
      .eq('id', marketplace_id)
      .single();

    if (mpError || !marketplace) {
      return new Response(
        JSON.stringify({ success: false, error: `Marketplace not found: ${mpError?.message}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!marketplace.external_id) {
      return new Response(
        JSON.stringify({ success: false, error: `Marketplace "${marketplace.name}" has no external_id linked to Surpluss` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await syncSingleMarketplace(supabase, marketplace, environment, apiHeaders, baseUrl);

    return new Response(
      JSON.stringify({
        success: result.success,
        marketplace_name: marketplace.name,
        external_id: marketplace.external_id,
        ...result,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[sync-surpluss-event-allocations] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
