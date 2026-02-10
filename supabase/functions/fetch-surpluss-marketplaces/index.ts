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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { environment = 'production' } = await req.json().catch(() => ({}));
    const baseUrl = BASE_URLS[environment] || BASE_URLS.production;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const apiHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    const apiKey = Deno.env.get('SURPLUSS_API_KEY');
    if (apiKey) {
      apiHeaders['Authorization'] = `Bearer ${apiKey}`;
      apiHeaders['x-api-key'] = apiKey;
    }

    // Try multiple API variations to get ALL marketplace events
    const allEvents: Map<number, any> = new Map();
    const urlVariations = [
      `${baseUrl}/api/common/marketplace-events?page=1&limit=100`,
      `${baseUrl}/api/common/marketplace-events?page=1&limit=50`,
      `${baseUrl}/api/common/marketplace-events?page=2&limit=50`,
      `${baseUrl}/api/common/marketplace-events?page=1&limit=100&status=all`,
      `${baseUrl}/api/common/marketplace-events`,
    ];

    const apiResults: Array<{ url: string; count: number; status: number; raw_sample?: any }> = [];

    for (const url of urlVariations) {
      try {
        console.log(`[fetch-marketplaces] Trying: ${url}`);
        const resp = await fetch(url, { headers: apiHeaders });
        const bodyText = await resp.text();
        
        if (!resp.ok) {
          console.log(`[fetch-marketplaces] ${resp.status} response: ${bodyText.substring(0, 500)}`);
          apiResults.push({ url, count: 0, status: resp.status, raw_sample: bodyText.substring(0, 300) });
          continue;
        }

        let body: any;
        try { body = JSON.parse(bodyText); } catch { continue; }
        
        // Handle various response shapes
        const items = Array.isArray(body) ? body : (body.items || body.data || body.results || body.events || []);
        
        if (Array.isArray(items)) {
          for (const item of items) {
            const id = item.id;
            if (id && !allEvents.has(id)) {
              allEvents.set(id, item);
            }
          }
          // Log first item shape for debugging
          const sample = items.length > 0 ? Object.keys(items[0]) : [];
          apiResults.push({ url, count: items.length, status: resp.status, raw_sample: { keys: sample, total_in_body: body.total || body.count || body.totalCount || 'N/A' } });
        } else {
          // Maybe the body itself has a different structure - log it
          apiResults.push({ url, count: 0, status: resp.status, raw_sample: { type: typeof body, keys: Object.keys(body).slice(0, 10) } });
        }
      } catch (e) {
        console.error(`[fetch-marketplaces] Error fetching ${url}:`, e);
        apiResults.push({ url, count: 0, status: 0 });
      }
    }

    console.log(`[fetch-marketplaces] Total unique Surpluss events found: ${allEvents.size}`);

    // Get existing local marketplaces
    const { data: existingMarketplaces } = await supabase
      .from('marketplace_events')
      .select('id, name, external_id');

    const existingExternalIds = new Set(
      (existingMarketplaces || [])
        .filter((m: any) => m.external_id != null)
        .map((m: any) => m.external_id)
    );

    // Find events not in local DB and create them
    const created: Array<{ name: string; external_id: number }> = [];
    const existing: Array<{ name: string; external_id: number }> = [];
    const errors: string[] = [];

    for (const [eventId, event] of allEvents) {
      const title = event.title || event.name || `Event ${eventId}`;
      
      if (existingExternalIds.has(eventId)) {
        existing.push({ name: title, external_id: eventId });
        continue;
      }

      // Auto-create missing marketplace
      const { error: insertError } = await supabase
        .from('marketplace_events')
        .insert({
          name: title,
          external_id: eventId,
          status: 'upcoming',
        });

      if (insertError) {
        errors.push(`Failed to create "${title}" (ext_id: ${eventId}): ${insertError.message}`);
      } else {
        created.push({ name: title, external_id: eventId });
        console.log(`[fetch-marketplaces] Created: "${title}" (ext_id: ${eventId})`);
      }
    }

    // Build raw events list for transparency
    const rawEvents = Array.from(allEvents.entries()).map(([id, e]) => ({
      id,
      title: e.title || e.name || `Event ${id}`,
      status: e.status || null,
      start_date: e.start_date || e.startDate || null,
    }));

    // Audit log
    try {
      await supabase.from('surpluss_api_audit_log').insert({
        action: 'fetch_all_marketplaces',
        environment,
        request_payload: { api_variations_tried: apiResults.length },
        response_status: 200,
        response_body: {
          total_found: allEvents.size,
          already_existing: existing.length,
          newly_created: created.length,
          errors: errors.length,
        },
        success: true,
      });
    } catch (_) { /* ignore */ }

    return new Response(
      JSON.stringify({
        success: true,
        total_surpluss_events: allEvents.size,
        already_existing: existing.length,
        newly_created: created.length,
        created,
        existing,
        errors,
        raw_events: rawEvents,
        api_results: apiResults,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[fetch-surpluss-marketplaces] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
