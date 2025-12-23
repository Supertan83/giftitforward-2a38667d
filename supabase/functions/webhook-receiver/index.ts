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
    
    const headersObj = Object.fromEntries(req.headers.entries());
    const sourceIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    
    console.log('Webhook received:', JSON.stringify(payload, null, 2));
    console.log('Request headers:', headersObj);
    console.log('Source IP:', sourceIp);
    console.log('Timestamp:', new Date().toISOString());

    // Store the webhook event in the database
    const { data, error: insertError } = await supabase
      .from('webhook_events')
      .insert({
        payload,
        headers: headersObj,
        source_ip: sourceIp,
        received_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to store webhook event:', insertError);
    } else {
      console.log('Webhook event stored with ID:', data.id);
    }

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
