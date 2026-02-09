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
  action: 'allocate' | 'batch_allocate' | 'update_allocation' | 'batch_update' | 'return_remaining' | 'delete_allocation' | 'get_event_allocations' | 'list_marketplace_events' | 'get_donation_metadata';
  environment: 'staging' | 'production';
  // For allocate
  material_id?: number;
  marketplace_event_id?: number;
  amount?: number;
  // For batch_allocate / batch_update
  materials?: Array<{ material_id: number; amount: number }>;
  // For update_allocation / return_remaining / delete_allocation
  allocation_id?: number;
  // For get_event_allocations
  event_id?: number;
  // For list_marketplace_events
  page?: number;
  limit?: number;
  status?: string;
  // For get_donation_metadata
  search?: string;
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
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid environment' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiBase = `${baseUrl}/api/common`;

    // Build headers
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
        if (!payload.event_id) {
          return errorResponse('event_id is required');
        }
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
        if (!payload.allocation_id) {
          return errorResponse('allocation_id is required');
        }
        url = `${apiBase}/donation-allocations/${payload.allocation_id}/return-remaining`;
        method = 'POST';
        break;
      }

      case 'delete_allocation': {
        if (!payload.allocation_id) {
          return errorResponse('allocation_id is required');
        }
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

    // Log write operations to DB for audit trail
    if (['allocate', 'batch_allocate', 'update_allocation', 'batch_update', 'return_remaining', 'delete_allocation'].includes(action)) {
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

        // Auto-sync to GIF tables after successful allocate/batch_allocate
        if (response.ok && (action === 'allocate' || action === 'batch_allocate') && payload.marketplace_event_id) {
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
  if (!surplussEventId) return;

  // Find the GIF marketplace by external_id
  const { data: marketplace } = await supabase
    .from('marketplace_events')
    .select('id')
    .eq('external_id', surplussEventId)
    .maybeSingle();

  if (!marketplace) {
    console.log(`[auto-sync] No GIF marketplace found for Surpluss event ${surplussEventId}`);
    return;
  }

  // Build list of materials to sync
  const materials: Array<{ material_id: number; amount: number }> = [];
  
  if (action === 'allocate' && payload.material_id && payload.amount) {
    materials.push({ material_id: payload.material_id, amount: payload.amount });
  } else if (action === 'batch_allocate' && payload.materials) {
    materials.push(...payload.materials);
  }

  for (const mat of materials) {
    // Find or create item_type
    let { data: itemType } = await supabase
      .from('item_types')
      .select('id')
      .eq('external_material_id', mat.material_id)
      .maybeSingle();

    if (!itemType) {
      const { data: newItem } = await supabase
        .from('item_types')
        .insert({
          name: `Material ${mat.material_id}`,
          external_material_id: mat.material_id,
          icon: 'Package',
          total_stock: mat.amount,
          surpluss_url: `https://platform.thesurpluss.com/material/${mat.material_id}`,
        })
        .select('id')
        .single();
      itemType = newItem;
    }

    if (!itemType) continue;

    // Upsert marketplace_item_allocations
    const { data: existing } = await supabase
      .from('marketplace_item_allocations')
      .select('id, allocated_quantity')
      .eq('marketplace_id', marketplace.id)
      .eq('item_type_id', itemType.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('marketplace_item_allocations')
        .update({
          allocated_quantity: existing.allocated_quantity + mat.amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('marketplace_item_allocations')
        .insert({
          marketplace_id: marketplace.id,
          item_type_id: itemType.id,
          allocated_quantity: mat.amount,
          distributed_quantity: 0,
        });
    }
  }

  console.log(`[auto-sync] Synced ${materials.length} materials to GIF marketplace ${marketplace.id}`);
}
