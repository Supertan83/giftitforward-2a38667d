import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SURPLUSS_ENDPOINTS = {
  staging: 'https://surpluss-server.herokuapp.com/api/common/donations',
  production: 'https://api.thesurpluss.com/api/common/donations',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { material_ids, environment = 'production' } = await req.json();

    // 1. Get all item_types (or filtered by material_ids)
    let itemTypesQuery = supabase
      .from('item_types')
      .select('id, name, external_material_id, total_stock, allocated_to_marketplace, distributed');

    if (material_ids && Array.isArray(material_ids) && material_ids.length > 0) {
      itemTypesQuery = itemTypesQuery.in('external_material_id', material_ids);
    } else {
      itemTypesQuery = itemTypesQuery.not('external_material_id', 'is', null);
    }

    const { data: itemTypes, error: itemTypesError } = await itemTypesQuery;
    if (itemTypesError) throw itemTypesError;

    if (!itemTypes || itemTypes.length === 0) {
      return new Response(
        JSON.stringify({ success: true, report: [], message: 'No matching items found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Get all marketplace_item_allocations for these items
    const itemTypeIds = itemTypes.map(it => it.id);
    const { data: allocations, error: allocError } = await supabase
      .from('marketplace_item_allocations')
      .select('id, item_type_id, marketplace_id, allocated_quantity, distributed_quantity')
      .in('item_type_id', itemTypeIds);
    if (allocError) throw allocError;

    // 3. Get marketplace names
    const marketplaceIds = [...new Set((allocations || []).map(a => a.marketplace_id))];
    let marketplaceMap: Record<string, string> = {};
    if (marketplaceIds.length > 0) {
      const { data: mps } = await supabase
        .from('marketplace_events')
        .select('id, name, event_date')
        .in('id', marketplaceIds);
      if (mps) {
        for (const mp of mps) {
          marketplaceMap[mp.id] = `${mp.name}${mp.event_date ? ` (${mp.event_date})` : ''}`;
        }
      }
    }

    // 4. Optionally fetch from Surpluss API for live comparison
    let surplussData: Record<number, { total: number; remaining: number }> = {};
    const surplussApiKey = Deno.env.get('SURPLUSS_API_KEY');
    const baseUrl = SURPLUSS_ENDPOINTS[environment as keyof typeof SURPLUSS_ENDPOINTS];

    if (baseUrl) {
      // Fetch in batches - Surpluss API is paginated
      const targetIds = material_ids && Array.isArray(material_ids) && material_ids.length > 0
        ? material_ids
        : itemTypes.map(it => it.external_material_id).filter(Boolean);

      for (const matId of targetIds) {
        try {
          const headers: Record<string, string> = { 'Accept': 'application/json' };
          if (surplussApiKey) {
            headers['Authorization'] = `Bearer ${surplussApiKey}`;
            headers['x-api-key'] = surplussApiKey;
          }
          // Try fetching individual donation by ID
          const resp = await fetch(`${baseUrl}/${matId}`, { method: 'GET', headers });
          if (resp.ok) {
            const d = await resp.json();
            // The API may return the donation directly or wrapped
            const donation = d?.data || d;
            if (donation) {
              surplussData[matId] = {
                total: donation.item_count ?? donation.quantity ?? 0,
                remaining: donation.quantity ?? 0,
              };
            }
          } else {
            await resp.text(); // consume body
          }
        } catch (e) {
          console.error(`Failed to fetch Surpluss data for material ${matId}:`, e);
        }
      }
    }

    // 5. Build report
    const report = itemTypes.map(item => {
      const itemAllocations = (allocations || []).filter(a => a.item_type_id === item.id);
      const totalAllocated = itemAllocations.reduce((s, a) => s + a.allocated_quantity, 0);
      const totalDistributed = itemAllocations.reduce((s, a) => s + a.distributed_quantity, 0);

      const surpluss = item.external_material_id ? surplussData[item.external_material_id] : null;

      const marketplaceBreakdown = itemAllocations.map(a => ({
        marketplace_id: a.marketplace_id,
        marketplace_name: marketplaceMap[a.marketplace_id] || 'Unknown',
        allocated: a.allocated_quantity,
        distributed: a.distributed_quantity,
        remaining: a.allocated_quantity - a.distributed_quantity,
      }));

      const flags: string[] = [];
      if (totalAllocated > item.total_stock && item.total_stock > 0) {
        flags.push(`OVER-ALLOCATED: ${totalAllocated} allocated vs ${item.total_stock} total_stock`);
      }
      if (surpluss && item.total_stock !== surpluss.remaining) {
        flags.push(`STOCK MISMATCH: GIF total_stock=${item.total_stock}, Surpluss remaining=${surpluss.remaining}`);
      }

      return {
        material_id: item.external_material_id,
        name: item.name,
        gif_total_stock: item.total_stock,
        gif_total_allocated: totalAllocated,
        gif_total_distributed: totalDistributed,
        gif_unallocated: item.total_stock - totalAllocated,
        surpluss_total: surpluss?.total ?? null,
        surpluss_remaining: surpluss?.remaining ?? null,
        marketplace_breakdown: marketplaceBreakdown,
        flags,
      };
    });

    const flaggedCount = report.filter(r => r.flags.length > 0).length;

    return new Response(
      JSON.stringify({
        success: true,
        environment,
        summary: {
          total_items: report.length,
          flagged: flaggedCount,
          surpluss_data_available: Object.keys(surplussData).length > 0,
        },
        report,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Reconciliation audit error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
