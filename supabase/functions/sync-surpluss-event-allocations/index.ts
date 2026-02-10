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

// Normalize a marketplace name for fuzzy matching
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if two normalized names match (substring or high overlap)
function namesMatch(localNorm: string, surplussNorm: string): boolean {
  if (localNorm === surplussNorm) return true;
  if (localNorm.includes(surplussNorm) || surplussNorm.includes(localNorm)) return true;
  
  // Check word overlap: if 80%+ of significant words match
  const localWords = localNorm.split(' ').filter(w => w.length > 2);
  const surplussWords = surplussNorm.split(' ').filter(w => w.length > 2);
  if (localWords.length === 0 || surplussWords.length === 0) return false;
  
  const matchCount = localWords.filter(w => surplussWords.includes(w)).length;
  const matchRatio = matchCount / Math.max(localWords.length, surplussWords.length);
  return matchRatio >= 0.7;
}

// Auto-link local marketplaces to Surpluss events by name
async function autoLinkMarketplaces(
  supabase: any,
  apiHeaders: Record<string, string>,
  baseUrl: string,
  environment: string
) {
  const linked: Array<{ local_name: string; external_id: number }> = [];
  const errors: string[] = [];

  try {
    // Fetch all marketplace events from Surpluss (paginate up to 200)
    let allSurplussEvents: any[] = [];
    let page = 1;
    const limit = 100;
    let hasMore = true;

    while (hasMore && page <= 5) {
      const url = `${baseUrl}/api/common/marketplace-events?page=${page}&limit=${limit}`;
      console.log(`[auto-link] Fetching Surpluss events page ${page}: ${url}`);
      
      const resp = await fetch(url, { headers: apiHeaders });
      if (!resp.ok) {
        const text = await resp.text();
        errors.push(`Failed to fetch Surpluss events page ${page}: ${resp.status} ${text.substring(0, 200)}`);
        break;
      }

      const body = await resp.json();
      const items = Array.isArray(body) ? body : (body.items || body.data || []);
      
      if (!Array.isArray(items) || items.length === 0) {
        hasMore = false;
      } else {
        allSurplussEvents.push(...items);
        hasMore = items.length === limit;
        page++;
      }
    }

    if (allSurplussEvents.length === 0) {
      console.log('[auto-link] No Surpluss events found');
      return { linked, errors };
    }

    console.log(`[auto-link] Found ${allSurplussEvents.length} Surpluss events`);

    // Get local marketplaces without external_id
    const { data: unlinked, error: ulErr } = await supabase
      .from('marketplace_events')
      .select('id, name, external_id')
      .is('external_id', null);

    if (ulErr || !unlinked || unlinked.length === 0) {
      console.log('[auto-link] No unlinked local marketplaces');
      return { linked, errors };
    }

    console.log(`[auto-link] ${unlinked.length} unlinked local marketplaces to match`);

    // Also get already-linked external_ids to avoid duplicates
    const { data: alreadyLinked } = await supabase
      .from('marketplace_events')
      .select('external_id')
      .not('external_id', 'is', null);
    
    const usedExternalIds = new Set((alreadyLinked || []).map((m: any) => m.external_id));

    // Match by name
    for (const local of unlinked) {
      const localNorm = normalizeName(local.name);

      for (const surp of allSurplussEvents) {
        const surpId = surp.id;
        const surpTitle = surp.title || surp.name || '';
        
        if (usedExternalIds.has(surpId)) continue;

        const surpNorm = normalizeName(surpTitle);

        if (namesMatch(localNorm, surpNorm)) {
          console.log(`[auto-link] Matched: "${local.name}" <-> "${surpTitle}" (ext_id: ${surpId})`);
          
          const { error: updateErr } = await supabase
            .from('marketplace_events')
            .update({ external_id: surpId })
            .eq('id', local.id);

          if (updateErr) {
            errors.push(`Failed to link ${local.name}: ${updateErr.message}`);
          } else {
            linked.push({ local_name: local.name, external_id: surpId });
            usedExternalIds.add(surpId);
          }
          break; // Only match once per local marketplace
        }
      }
    }

    console.log(`[auto-link] Linked ${linked.length} marketplaces`);
  } catch (e) {
    errors.push(`Auto-link error: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { linked, errors };
}

// Sync a single material: upsert item_type + marketplace_item_allocation
async function syncMaterial(
  supabase: any,
  marketplace: { id: string; name: string; external_id: number },
  materialId: number,
  materialTitle: string,
  allocatedAmount: number,
  distributedAmount: number,
  category: string | null,
  subcategory: string | null,
  errors: string[]
) {
  let { data: itemType } = await supabase
    .from('item_types').select('id').eq('external_material_id', materialId).maybeSingle();

  if (!itemType) {
    const insertData: any = { 
      name: materialTitle, 
      external_material_id: materialId, 
      icon: 'Package', 
      total_stock: allocatedAmount, 
      surpluss_url: `https://platform.thesurpluss.com/material/${materialId}` 
    };
    if (category) insertData.category = category;
    if (subcategory) insertData.subcategory = subcategory;
    
    const { data: newItem, error: insertError } = await supabase
      .from('item_types')
      .insert(insertData)
      .select('id').single();
    if (insertError) { errors.push(insertError.message); return; }
    itemType = newItem;
  } else {
    // Update category/subcategory if we have new data
    if (category || subcategory) {
      const updateData: any = {};
      if (category) updateData.category = category;
      if (subcategory) updateData.subcategory = subcategory;
      await supabase.from('item_types').update(updateData).eq('id', itemType.id);
    }
  }

  const { data: existingAlloc } = await supabase
    .from('marketplace_item_allocations')
    .select('id, allocated_quantity, distributed_quantity')
    .eq('marketplace_id', marketplace.id).eq('item_type_id', itemType.id).maybeSingle();

  if (existingAlloc) {
    await supabase.from('marketplace_item_allocations')
      .update({ allocated_quantity: allocatedAmount, distributed_quantity: distributedAmount, updated_at: new Date().toISOString() })
      .eq('id', existingAlloc.id);
  } else {
    await supabase.from('marketplace_item_allocations')
      .insert({ marketplace_id: marketplace.id, item_type_id: itemType.id, allocated_quantity: allocatedAmount, distributed_quantity: distributedAmount });
  }
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
      // The Surpluss API returns allocations with an `allocated_materials` array
      // Each material in the array has: material_id, material_title, amount, donation_tag_name, etc.
      const allocatedMaterials = alloc.allocated_materials || [];
      
      // If allocated_materials exists, iterate through each material
      if (allocatedMaterials.length > 0) {
        for (const mat of allocatedMaterials) {
          const materialId = mat.material_id || mat.donation_metadata_id;
          const materialTitle = mat.material_title || mat.title || `Material ${materialId}`;
          const allocatedAmount = mat.amount || 0;
          const distributedAmount = mat.distributed_amount || 0;
          const category = mat.donation_tag_name || null;
          const subcategory = mat.donation_tag_subcategory_name || null;
          
          if (!materialId) { errors.push('No material ID in allocated_materials entry'); continue; }
          
          await syncMaterial(supabase, marketplace, materialId, materialTitle, allocatedAmount, distributedAmount, category, subcategory, errors);
          synced++;
          // Track created/updated via closure
        }
      } else {
        // Fallback: legacy format where allocation itself is a material
        const materialId = alloc.donation_metadata?.id || alloc.material_id || alloc.donation_metadata_id;
        const materialTitle = alloc.donation_metadata?.title || alloc.title || `Material ${materialId}`;
        const allocatedAmount = alloc.amount || alloc.total_amount || 0;
        const distributedAmount = alloc.distributed_amount || alloc.total_distributed || 0;
        
        if (!materialId) { 
          // Skip allocations without material IDs (they use allocated_materials which was empty)
          console.log(`[sync] Skipping allocation ${alloc.id}: no materials`);
          continue; 
        }
        
        await syncMaterial(supabase, marketplace, materialId, materialTitle, allocatedAmount, distributedAmount, null, null, errors);
        synced++;
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  // Audit log
  try {
    await supabase.from('surpluss_api_audit_log').insert({
      action: 'sync_event_allocations', environment,
      request_payload: { marketplace_id: marketplace.id, external_id: marketplace.external_id },
      response_status: apiResponse.status,
      response_body: { total_fetched: surplussAllocations.length, synced, created, updated, errors: errors.length },
      success: errors.length === 0,
    });
  } catch (_) { /* ignore audit errors */ }

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

    // Handle "ALL" mode (cron job) — first auto-link, then sync every marketplace with an external_id
    if (marketplace_id === 'ALL') {
      // Step 1: Auto-link unlinked marketplaces by name
      const autoLinkResult = await autoLinkMarketplaces(supabase, apiHeaders, baseUrl, environment);
      console.log(`[sync-all] Auto-linked ${autoLinkResult.linked.length} marketplaces`);

      // Step 2: Sync all linked marketplaces
      const { data: marketplaces, error: mpErr } = await supabase
        .from('marketplace_events')
        .select('id, name, external_id')
        .not('external_id', 'is', null);

      if (mpErr || !marketplaces?.length) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'No linked marketplaces found', 
            synced_events: 0,
            auto_linked: autoLinkResult.linked,
            auto_link_errors: autoLinkResult.errors,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[sync-all] Syncing ${marketplaces.length} marketplace events (concurrent batches of 5)`);
      const results: any[] = [];
      // Process in batches of 5 to avoid timeout
      const batchSize = 5;
      for (let i = 0; i < marketplaces.length; i += batchSize) {
        const batch = marketplaces.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map((mp: any) => syncSingleMarketplace(supabase, mp, environment, apiHeaders, baseUrl)
            .catch(e => ({ marketplace_name: mp.name, success: false, error: e?.message || String(e), synced: 0 }))
          )
        );
        results.push(...batchResults);
      }

      const totalSynced = results.reduce((s, r) => s + (r.synced || 0), 0);
      return new Response(
        JSON.stringify({ 
          success: true, 
          mode: 'ALL', 
          synced_events: marketplaces.length, 
          total_synced: totalSynced, 
          results,
          auto_linked: autoLinkResult.linked,
          auto_link_errors: autoLinkResult.errors,
        }),
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

    // If single marketplace has no external_id, try to auto-link it first
    if (!marketplace.external_id) {
      const autoLinkResult = await autoLinkMarketplaces(supabase, apiHeaders, baseUrl, environment);
      
      // Re-fetch to check if it got linked
      const { data: refreshed } = await supabase
        .from('marketplace_events')
        .select('id, name, external_id')
        .eq('id', marketplace_id)
        .single();

      if (!refreshed?.external_id) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Marketplace "${marketplace.name}" could not be auto-linked to any Surpluss event. Please set the external_id manually.`,
            auto_link_attempted: true,
            auto_linked: autoLinkResult.linked,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Use the refreshed marketplace with the new external_id
      const result = await syncSingleMarketplace(supabase, refreshed, environment, apiHeaders, baseUrl);
      return new Response(
        JSON.stringify({
          success: result.success,
          marketplace_name: refreshed.name,
          external_id: refreshed.external_id,
          auto_linked: true,
          ...result,
        }),
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
