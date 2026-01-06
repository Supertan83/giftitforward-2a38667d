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
  api_key?: string; // Optional API key if needed
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const params: FetchParams = await req.json();
    
    const { 
      environment = 'production', // Default to production as per docs
      event_id, 
      from_date, 
      to_date, 
      page = 1, 
      limit = 50,
      api_key
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
      queryParams.set('event_id', event_id.toString());
    }
    if (from_date) {
      queryParams.set('from_date', from_date);
    }
    if (to_date) {
      queryParams.set('to_date', to_date);
    }

    const url = `${baseUrl}?${queryParams.toString()}`;
    console.log('Requesting:', url);

    // Build headers - include API key if provided
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    // Check for API key from secret or parameter
    const surplussApiKey = Deno.env.get('SURPLUSS_API_KEY') || api_key;
    if (surplussApiKey) {
      headers['Authorization'] = `Bearer ${surplussApiKey}`;
      console.log('Using API key for authentication');
    }

    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    const responseText = await response.text();
    console.log('Response status:', response.status);
    console.log('Response body preview:', responseText.substring(0, 500));

    if (!response.ok) {
      console.error('Surpluss API error:', response.status, responseText);
      
      // If 401 on staging, suggest trying production
      if (response.status === 401 && environment === 'staging') {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Staging API returned 401 unauthorized. The staging environment may require authentication. Try switching to Production environment which is documented as a public endpoint.`,
            hint: 'Switch to Production environment in the dropdown'
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Surpluss API returned ${response.status}: ${responseText}` 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to parse API response as JSON',
          raw: responseText.substring(0, 200)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
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
