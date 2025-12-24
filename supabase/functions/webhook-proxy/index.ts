import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-source-identifier',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get the request body
    const body = await req.json();
    
    // Extract source identifier from query params or headers
    const url = new URL(req.url);
    const sourceFromQuery = url.searchParams.get('source');
    const sourceFromHeader = req.headers.get('x-source-identifier');
    const sourceIdentifier = sourceFromQuery || sourceFromHeader;

    // Build the internal webhook-receiver URL
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    let webhookReceiverUrl = `${supabaseUrl}/functions/v1/webhook-receiver`;
    if (sourceIdentifier) {
      webhookReceiverUrl += `?source=${encodeURIComponent(sourceIdentifier)}`;
    }

    console.log(`Proxying webhook request to internal receiver, source: ${sourceIdentifier || 'none'}`);

    // Forward the request to webhook-receiver
    const response = await fetch(webhookReceiverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(body),
    });

    // Get the response from webhook-receiver
    const data = await response.json();

    console.log(`Webhook receiver responded with status: ${response.status}`);

    // Return the response without exposing internal URLs
    return new Response(
      JSON.stringify(data),
      { 
        status: response.status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Webhook proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Something went wrong' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
