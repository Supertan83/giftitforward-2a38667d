import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ENDPOINTS = {
  staging: 'https://surpluss-server.herokuapp.com/api/common/donations',
  production: 'https://api.thesurpluss.com/api/common/donations',
};

interface FetchParams {
  environment: 'staging' | 'production';
  event_id?: number;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
  // Optional API key (prefer SURPLUSS_API_KEY secret instead of passing this from the client)
  api_key?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const params: FetchParams = await req.json();

    const {
      environment = 'staging',
      event_id,
      from_date,
      to_date,
      page = 1,
      limit = 50,
      api_key,
    } = params;

    console.log('Fetching Surpluss allocations:', { environment, event_id, from_date, to_date, page, limit });

    const baseUrl = ENDPOINTS[environment];
    if (!baseUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid environment' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.set('page', (page - 1).toString());
    queryParams.set('size', limit.toString());

    if (event_id) queryParams.set('event_id', event_id.toString());
    if (from_date) queryParams.set('from_date', from_date);
    if (to_date) queryParams.set('to_date', to_date);

    const url = `${baseUrl}?${queryParams.toString()}`;
    console.log('Requesting:', url);

    // Build headers - include API key if configured
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    const surplussApiKey = Deno.env.get('SURPLUSS_API_KEY') || api_key;
    if (surplussApiKey) {
      // Try the two most common schemes (safe even if one is ignored by upstream)
      headers['Authorization'] = `Bearer ${surplussApiKey}`;
      headers['x-api-key'] = surplussApiKey;
      console.log('Using API key for upstream authentication');
    }

    const response = await fetch(url, { method: 'GET', headers });
    const responseText = await response.text();

    console.log('Response status:', response.status);
    console.log('Response body preview:', responseText.substring(0, 500));

    if (!response.ok) {
      console.error('Surpluss API error:', response.status, responseText);

      const hint =
        response.status === 401
          ? (environment === 'production'
              ? 'Production is currently returning 401. Use Staging, or configure SURPLUSS_API_KEY for Production.'
              : 'Staging is returning 401. Configure SURPLUSS_API_KEY.')
          : undefined;

      // IMPORTANT: always return 200 so the frontend can read the error body without throwing FunctionsHttpError
      return new Response(
        JSON.stringify({
          success: false,
          upstream_status: response.status,
          error: `Surpluss API returned ${response.status}: ${responseText}`,
          hint,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let data: unknown;
    try {
      data = JSON.parse(responseText);
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to parse API response as JSON',
          upstream_status: 200,
          raw: responseText.substring(0, 200),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // deno-lint-ignore no-explicit-any
    const typed = data as any;
    // The Surpluss API returns { total, items } not { data, meta }
    const items = typed?.items || typed?.data || [];
    const total = typed?.total ?? typed?.meta?.total ?? items.length;
    console.log('Received donations:', items.length, 'of', total, 'total records');

    return new Response(
      JSON.stringify({
        success: true,
        environment,
        data: items,
        meta: {
          page,
          limit,
          total,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error fetching Surpluss allocations:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

