import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const marketplaceId = url.searchParams.get("marketplace_id");

      if (!marketplaceId) {
        return new Response(JSON.stringify({ success: false, error: "Missing marketplace_id" }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const { data: marketplace, error } = await supabase
        .from("marketplace_events")
        .select("id, name, event_date, location, outreach_partner")
        .eq("id", marketplaceId)
        .maybeSingle();

      if (error || !marketplace) {
        return new Response(JSON.stringify({ success: false, error: "Marketplace not found" }), {
          status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      return new Response(JSON.stringify({ success: true, marketplace }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { marketplace_id, volunteer_name, volunteer_email, experience_word, would_volunteer_again, improvement_suggestions } = body;

      if (!marketplace_id || !volunteer_name?.trim() || !volunteer_email?.trim()) {
        return new Response(JSON.stringify({ success: false, error: "Name, email, and marketplace are required" }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(volunteer_email.trim())) {
        return new Response(JSON.stringify({ success: false, error: "Invalid email format" }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Get marketplace info for company_name
      const { data: marketplace } = await supabase
        .from("marketplace_events")
        .select("outreach_partner")
        .eq("id", marketplace_id)
        .maybeSingle();

      const { data: response, error: insertError } = await supabase
        .from("external_survey_responses")
        .insert({
          marketplace_id,
          volunteer_name: volunteer_name.trim(),
          volunteer_email: volunteer_email.trim(),
          company_name: marketplace?.outreach_partner || null,
          experience_word: experience_word?.trim() || null,
          would_volunteer_again: would_volunteer_again ?? null,
          improvement_suggestions: improvement_suggestions?.trim() || null,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(JSON.stringify({ success: false, error: "Failed to save survey" }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      return new Response(JSON.stringify({ success: true, id: response.id }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ success: false, error: "Internal server error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
