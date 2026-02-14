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
      const { volunteer_name, volunteer_email, answers } = body;

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

      // Build insert payload - support both legacy fields and new answers JSONB
      const insertData: Record<string, unknown> = {
        volunteer_name: volunteer_name.trim(),
        volunteer_email: volunteer_email.trim(),
        completed_at: new Date().toISOString(),
      };

      if (answers && typeof answers === "object") {
        insertData.answers = answers;
      }

      // Also populate legacy columns if present in answers or directly in body for backward compat
      if (body.experience_word) {
        insertData.experience_word = body.experience_word.trim();
      }
      if (body.would_volunteer_again !== undefined) {
        insertData.would_volunteer_again = body.would_volunteer_again;
      }
      if (body.improvement_suggestions) {
        insertData.improvement_suggestions = body.improvement_suggestions.trim();
      }

      const { data: response, error: insertError } = await supabase
        .from("external_survey_responses")
        .insert(insertData)
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
