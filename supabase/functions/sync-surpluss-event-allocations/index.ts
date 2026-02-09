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
  marketplace_id: string; // GIF UUID
  environment?: 'staging' | 'production';
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

    // 1. Look up the marketplace's external_id
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

    // 2. Fetch allocations from Surpluss API
    const baseUrl = BASE_URLS[environment];
    const apiUrl = `${baseUrl}/api/common/marketplace-events/${marketplace.external_id}/allocations`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    const apiKey = Deno.env.get('SURPLUSS_API_KEY');
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['x-api-key'] = apiKey;
    }

    console.log(`[sync-surpluss-event-allocations] Fetching: ${apiUrl}`);
    const apiResponse = await fetch(apiUrl, { headers });
    const apiText = await apiResponse.text();
    console.log(`[sync-surpluss-event-allocations] Response: ${apiResponse.status} ${apiText.substring(0, 500)}`);

    if (!apiResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `Surpluss API error: ${apiResponse.status}`, raw: apiText }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let surplussAllocations: any[];
    try {
      const parsed = JSON.parse(apiText);
      // API may return { data: [...] } or just [...]
      surplussAllocations = Array.isArray(parsed) ? parsed : (parsed.data || parsed.allocations || []);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to parse Surpluss API response' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!Array.isArray(surplussAllocations)) {
      surplussAllocations = [];
    }

    console.log(`[sync-surpluss-event-allocations] Found ${surplussAllocations.length} allocations for event ${marketplace.external_id}`);

    // 3. For each allocation, upsert item_types and marketplace_item_allocations
    let synced = 0;
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const alloc of surplussAllocations) {
      try {
        const materialId = alloc.donation_metadata?.id || alloc.material_id || alloc.donation_metadata_id;
        const materialTitle = alloc.donation_metadata?.title || alloc.title || `Material ${materialId}`;
        const allocatedAmount = alloc.amount || 0;
        const distributedAmount = alloc.distributed_amount || 0;

        if (!materialId) {
          errors.push(`Skipped allocation with no material ID`);
          continue;
        }

        // a. Find or create item_types row by external_material_id
        let { data: itemType } = await supabase
          .from('item_types')
          .select('id')
          .eq('external_material_id', materialId)
          .maybeSingle();

        if (!itemType) {
          // Create new item_type
          const { data: newItem, error: insertError } = await supabase
            .from('item_types')
            .insert({
              name: materialTitle,
              external_material_id: materialId,
              icon: 'Package',
              total_stock: allocatedAmount,
              surpluss_url: `https://platform.thesurpluss.com/material/${materialId}`,
            })
            .select('id')
            .single();

          if (insertError) {
            errors.push(`Failed to create item_type for material ${materialId}: ${insertError.message}`);
            continue;
          }
          itemType = newItem;
          created++;
        }

        // b. Upsert marketplace_item_allocations
        const { data: existingAlloc } = await supabase
          .from('marketplace_item_allocations')
          .select('id, allocated_quantity, distributed_quantity')
          .eq('marketplace_id', marketplace_id)
          .eq('item_type_id', itemType.id)
          .maybeSingle();

        if (existingAlloc) {
          // Update existing
          await supabase
            .from('marketplace_item_allocations')
            .update({
              allocated_quantity: allocatedAmount,
              distributed_quantity: distributedAmount,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingAlloc.id);
          updated++;
        } else {
          // Create new
          await supabase
            .from('marketplace_item_allocations')
            .insert({
              marketplace_id: marketplace_id,
              item_type_id: itemType.id,
              allocated_quantity: allocatedAmount,
              distributed_quantity: distributedAmount,
            });
          created++;
        }

        synced++;
      } catch (allocError) {
        const msg = allocError instanceof Error ? allocError.message : String(allocError);
        errors.push(msg);
      }
    }

    // 4. Log audit
    try {
      await supabase.from('surpluss_api_audit_log').insert({
        action: 'sync_event_allocations',
        environment,
        request_payload: { marketplace_id, external_id: marketplace.external_id },
        response_status: apiResponse.status,
        response_body: { total_fetched: surplussAllocations.length, synced, created, updated, errors: errors.length },
        success: errors.length === 0,
      });
    } catch (logErr) {
      console.error('[sync-surpluss-event-allocations] Audit log failed:', logErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        marketplace_name: marketplace.name,
        external_id: marketplace.external_id,
        total_fetched: surplussAllocations.length,
        synced,
        created,
        updated,
        errors,
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
