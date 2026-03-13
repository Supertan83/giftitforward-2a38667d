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

interface RequestPayload {
  action: 'allocate' | 'batch_allocate' | 'update_allocation' | 'batch_update' | 'return_remaining' | 'delete_allocation' | 'get_event_allocations' | 'list_marketplace_events' | 'get_donation_metadata' | 'get_donation_allocations' | 'update_distribution';
  environment: 'staging' | 'production';
  material_id?: number;
  marketplace_event_id?: number;
  amount?: number;
  materials?: Array<{ material_id: number; amount: number }>;
  allocation_id?: number;
  event_id?: number;
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  from_date?: string;
  to_date?: string;
  distribution_data?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: RequestPayload = await req.json();
    const { action, environment = 'production' } = payload;

    const baseUrl = BASE_URLS[environment];
    if (!baseUrl) {
      return errorResponse('Invalid environment');
    }

    const apiBase = `${baseUrl}/api/common`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    const apiKey = Deno.env.get('SURPLUSS_API_KEY');
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['x-api-key'] = apiKey;
    }

    let url: string;
    let method: string;
    let body: string | undefined;

    switch (action) {
      case 'list_marketplace_events': {
        const params = new URLSearchParams();
        if (payload.page) params.set('page', payload.page.toString());
        if (payload.limit) params.set('limit', payload.limit.toString());
        if (payload.status) params.set('status', payload.status);
        url = `${apiBase}/marketplace-events?${params.toString()}`;
        method = 'GET';
        break;
      }

      case 'get_event_allocations': {
        if (!payload.event_id) return errorResponse('event_id is required');
        url = `${apiBase}/marketplace-events/${payload.event_id}/allocations`;
        method = 'GET';
        break;
      }

      case 'get_donation_metadata': {
        const params = new URLSearchParams();
        if (payload.page) params.set('page', payload.page.toString());
        if (payload.limit) params.set('limit', payload.limit.toString());
        if (payload.search) params.set('search', payload.search);
        url = `${apiBase}/donation-metadata?${params.toString()}`;
        method = 'GET';
        break;
      }

      case 'get_donation_allocations': {
        const params = new URLSearchParams();
        if (payload.event_id) params.set('event_id', payload.event_id.toString());
        if (payload.page) params.set('page', payload.page.toString());
        if (payload.limit) params.set('limit', payload.limit.toString());
        if (payload.from_date) params.set('from_date', payload.from_date);
        if (payload.to_date) params.set('to_date', payload.to_date);
        url = `${apiBase}/donation-allocations?${params.toString()}`;
        method = 'GET';
        break;
      }

      case 'update_distribution': {
        if (!payload.distribution_data) return errorResponse('distribution_data is required');
        url = `${apiBase}/donation-allocations/distribution`;
        method = 'PUT';
        body = JSON.stringify(payload.distribution_data);
        break;
      }

      case 'allocate': {
        if (!payload.material_id || !payload.marketplace_event_id || !payload.amount) {
          return errorResponse('material_id, marketplace_event_id, and amount are required');
        }
        url = `${apiBase}/donation-metadata/${payload.material_id}/allocate`;
        method = 'POST';
        body = JSON.stringify({
          marketplace_event_id: payload.marketplace_event_id,
          amount: payload.amount,
        });
        break;
      }

      case 'batch_allocate': {
        if (!payload.marketplace_event_id || !payload.materials?.length) {
          return errorResponse('marketplace_event_id and materials array are required');
        }
        url = `${apiBase}/donation-allocations/batch`;
        method = 'POST';
        body = JSON.stringify({
          marketplace_event_id: payload.marketplace_event_id,
          materials: payload.materials,
        });
        break;
      }

      case 'update_allocation': {
        if (!payload.allocation_id || payload.amount === undefined) {
          return errorResponse('allocation_id and amount are required');
        }
        url = `${apiBase}/donation-allocations/${payload.allocation_id}`;
        method = 'PUT';
        body = JSON.stringify({ amount: payload.amount });
        break;
      }

      case 'batch_update': {
        if (!payload.marketplace_event_id || !payload.materials?.length) {
          return errorResponse('marketplace_event_id and materials array are required');
        }
        url = `${apiBase}/donation-allocations/batch-allocation`;
        method = 'PUT';
        body = JSON.stringify({
          marketplace_event_id: payload.marketplace_event_id,
          materials: payload.materials,
        });
        break;
      }

      case 'return_remaining': {
        if (!payload.allocation_id) return errorResponse('allocation_id is required');
        url = `${apiBase}/donation-allocations/${payload.allocation_id}/return-remaining`;
        method = 'POST';
        break;
      }

      case 'delete_allocation': {
        if (!payload.allocation_id) return errorResponse('allocation_id is required');
        url = `${apiBase}/donation-allocations/${payload.allocation_id}`;
        method = 'DELETE';
        break;
      }

      default:
        return errorResponse(`Unknown action: ${action}`);
    }

    console.log(`[surpluss-allocations-api] ${method} ${url}`);
    if (body) console.log(`[surpluss-allocations-api] Body: ${body.substring(0, 500)}`);

    const fetchOptions: RequestInit = { method, headers };
    if (body && method !== 'GET') fetchOptions.body = body;

    const response = await fetch(url, fetchOptions);
    const responseText = await response.text();

    console.log(`[surpluss-allocations-api] Response: ${response.status} ${responseText.substring(0, 500)}`);

    let responseJson: unknown;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = { raw: responseText };
    }

    // Log write operations + sync to GIF for audit trail
    const writeActions = ['allocate', 'batch_allocate', 'update_allocation', 'batch_update', 'return_remaining', 'delete_allocation', 'update_distribution'];
    if (writeActions.includes(action)) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        await supabase.from('surpluss_api_audit_log').insert({
          action,
          environment,
          request_payload: payload,
          response_status: response.status,
          response_body: responseJson,
          success: response.ok,
        });

        // Auto-sync to GIF tables after successful write operations
        if (response.ok) {
          try {
            await autoSyncToGif(supabase, payload, action, responseJson);
          } catch (syncErr) {
            console.error('[surpluss-allocations-api] Auto-sync to GIF failed:', syncErr);
          }
        }
      } catch (logErr) {
        console.error('[surpluss-allocations-api] Failed to log audit:', logErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: response.ok,
        status: response.status,
        data: responseJson,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[surpluss-allocations-api] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function errorResponse(message: string) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function autoSyncToGif(supabase: any, payload: RequestPayload, action: string, apiResponse: any) {
  const surplussEventId = payload.marketplace_event_id;

  // === ALLOCATE / BATCH_ALLOCATE: Create/update GIF allocations ===
  if ((action === 'allocate' || action === 'batch_allocate') && surplussEventId) {
    const marketplace = await findGifMarketplace(supabase, surplussEventId);
    if (!marketplace) return;

    const materials: Array<{ material_id: number; amount: number }> = [];
    if (action === 'allocate' && payload.material_id && payload.amount) {
      materials.push({ material_id: payload.material_id, amount: payload.amount });
    } else if (action === 'batch_allocate' && payload.materials) {
      materials.push(...payload.materials);
    }

    for (const mat of materials) {
      const itemType = await findOrCreateItemType(supabase, mat.material_id);
      if (!itemType) continue;

      await upsertGifAllocation(supabase, marketplace.id, itemType.id, mat.amount, 'add');
    }

    console.log(`[auto-sync] Synced ${materials.length} materials to GIF marketplace ${marketplace.id}`);
  }

  // === DELETE_ALLOCATION: Remove from GIF ===
  if (action === 'delete_allocation' && payload.allocation_id) {
    // Try to find GIF allocation by surpluss_allocation_id
    const { data: gifAlloc } = await supabase
      .from('marketplace_item_allocations')
      .select('id')
      .eq('surpluss_allocation_id', payload.allocation_id)
      .maybeSingle();

    if (gifAlloc) {
      await supabase.from('marketplace_item_allocations').delete().eq('id', gifAlloc.id);
      console.log(`[auto-sync] Deleted GIF allocation ${gifAlloc.id} (surpluss_allocation_id: ${payload.allocation_id})`);
    } else {
      console.log(`[auto-sync] No GIF allocation found for surpluss_allocation_id: ${payload.allocation_id}`);
    }

    // Also clean up sync tracking
    await supabase.from('surpluss_allocation_sync').delete().eq('allocation_id', payload.allocation_id);
  }

  // === UPDATE_ALLOCATION: Update amount in GIF ===
  if (action === 'update_allocation' && payload.allocation_id && payload.amount !== undefined) {
    const { data: gifAlloc } = await supabase
      .from('marketplace_item_allocations')
      .select('id')
      .eq('surpluss_allocation_id', payload.allocation_id)
      .maybeSingle();

    if (gifAlloc) {
      await supabase.from('marketplace_item_allocations')
        .update({ allocated_quantity: payload.amount, updated_at: new Date().toISOString() })
        .eq('id', gifAlloc.id);
      console.log(`[auto-sync] Updated GIF allocation ${gifAlloc.id} to amount ${payload.amount}`);
    } else {
      console.log(`[auto-sync] No GIF allocation found for surpluss_allocation_id: ${payload.allocation_id}`);
    }
  }

  // === BATCH_UPDATE: Update multiple allocations in GIF ===
  if (action === 'batch_update' && surplussEventId && payload.materials?.length) {
    const marketplace = await findGifMarketplace(supabase, surplussEventId);
    if (!marketplace) return;

    for (const mat of payload.materials) {
      const itemType = await findOrCreateItemType(supabase, mat.material_id);
      if (!itemType) continue;

      await upsertGifAllocation(supabase, marketplace.id, itemType.id, mat.amount, 'set');
    }
    console.log(`[auto-sync] Batch-updated ${payload.materials.length} materials in GIF marketplace ${marketplace.id}`);
  }

  // === RETURN_REMAINING: Zero out or delete GIF allocation ===
  if (action === 'return_remaining' && payload.allocation_id) {
    const { data: gifAlloc } = await supabase
      .from('marketplace_item_allocations')
      .select('id, distributed_quantity')
      .eq('surpluss_allocation_id', payload.allocation_id)
      .maybeSingle();

    if (gifAlloc) {
      if (gifAlloc.distributed_quantity > 0) {
        // Keep allocation but set allocated = distributed (nothing remaining)
        await supabase.from('marketplace_item_allocations')
          .update({ allocated_quantity: gifAlloc.distributed_quantity, updated_at: new Date().toISOString() })
          .eq('id', gifAlloc.id);
        console.log(`[auto-sync] Return-remaining: set allocated = ${gifAlloc.distributed_quantity} for GIF allocation ${gifAlloc.id}`);
      } else {
        // No distribution happened, just delete
        await supabase.from('marketplace_item_allocations').delete().eq('id', gifAlloc.id);
        console.log(`[auto-sync] Return-remaining: deleted GIF allocation ${gifAlloc.id}`);
      }
    }
  }
}

// Helper: find GIF marketplace by Surpluss external_id
async function findGifMarketplace(supabase: any, surplussEventId: number) {
  const { data: marketplace } = await supabase
    .from('marketplace_events')
    .select('id')
    .eq('external_id', surplussEventId)
    .maybeSingle();

  if (!marketplace) {
    console.log(`[auto-sync] No GIF marketplace found for Surpluss event ${surplussEventId}`);
  }
  return marketplace;
}

// Helper: find or create item_type by external_material_id
async function findOrCreateItemType(supabase: any, materialId: number) {
  let { data: itemType } = await supabase
    .from('item_types')
    .select('id')
    .eq('external_material_id', materialId)
    .maybeSingle();

  if (!itemType) {
    const { data: newItem } = await supabase
      .from('item_types')
      .insert({
        name: `Material ${materialId}`,
        external_material_id: materialId,
        icon: 'Package',
        total_stock: 0,
        surpluss_url: `https://platform.thesurpluss.com/material/${materialId}`,
      })
      .select('id')
      .single();
    itemType = newItem;
  }
  return itemType;
}

// Helper: upsert GIF allocation (add to existing or set directly)
async function upsertGifAllocation(supabase: any, marketplaceId: string, itemTypeId: string, amount: number, mode: 'add' | 'set') {
  const { data: existing } = await supabase
    .from('marketplace_item_allocations')
    .select('id, allocated_quantity')
    .eq('marketplace_id', marketplaceId)
    .eq('item_type_id', itemTypeId)
    .maybeSingle();

  if (existing) {
    const newQty = mode === 'add' ? existing.allocated_quantity + amount : amount;
    await supabase.from('marketplace_item_allocations')
      .update({ allocated_quantity: newQty, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase.from('marketplace_item_allocations')
      .insert({
        marketplace_id: marketplaceId,
        item_type_id: itemTypeId,
        allocated_quantity: amount,
        distributed_quantity: 0,
      });
  }
}
