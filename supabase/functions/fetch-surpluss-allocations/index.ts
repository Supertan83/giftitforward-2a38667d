import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ENDPOINTS = {
  staging: 'https://surpluss-server.herokuapp.com/api/common/donation-allocations',
  production: 'https://api.thesurpluss.com/api/common/donation-allocations'
};

interface FetchParams {
  environment: 'staging' | 'production';
  event_id?: number;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
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
      limit = 50 
    } = params;

    console.log('Fetching Surpluss allocations:', { environment, event_id, from_date, to_date, page, limit });

    const baseUrl = ENDPOINTS[environment];
    if (!baseUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid environment' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.set('page', page.toString());
    queryParams.set('limit', limit.toString());
    
    if (event_id) {
      queryParams.set('marketplace_event_id', event_id.toString());
    }
    if (from_date) {
      queryParams.set('from_date', from_date);
    }
    if (to_date) {
      queryParams.set('to_date', to_date);
    }

    const url = `${baseUrl}?${queryParams.toString()}`;
    console.log('Requesting:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Surpluss API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Surpluss API returned ${response.status}: ${errorText}` 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Received allocations:', data.data?.length || 0, 'records');

    return new Response(
      JSON.stringify({
        success: true,
        environment,
        data: data.data || [],
        meta: data.meta || {
          current_page: page,
          per_page: limit,
          total: data.data?.length || 0
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching Surpluss allocations:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
