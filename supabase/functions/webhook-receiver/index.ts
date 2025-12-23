import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the request body
    const payload = await req.json();
    
    console.log('Webhook received:', JSON.stringify(payload, null, 2));
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    console.log('Timestamp:', new Date().toISOString());

    // You can process the webhook payload here
    // For example, store it in a database table, trigger actions, etc.
    
    // Example: If you want to store webhook events, you could create a table and insert:
    // const { data, error } = await supabase
    //   .from('webhook_events')
    //   .insert({ payload, received_at: new Date().toISOString() });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook received successfully',
        received_at: new Date().toISOString()
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error: unknown) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
