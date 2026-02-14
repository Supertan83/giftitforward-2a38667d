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
    if (req.method === "POST") {
      const body = await req.json();
      const { volunteer_name, volunteer_email, experience_word, would_volunteer_again, improvement_suggestions } = body;

      if (!volunteer_name?.trim() || !volunteer_email?.trim()) {
        return new Response(JSON.stringify({ success: false, error: "Name and email are required" }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(volunteer_email.trim())) {
        return new Response(JSON.stringify({ success: false, error: "Invalid email format" }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const { data: response, error: insertError } = await supabase
        .from("external_survey_responses")
        .insert({
          volunteer_name: volunteer_name.trim(),
          volunteer_email: volunteer_email.trim(),
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
