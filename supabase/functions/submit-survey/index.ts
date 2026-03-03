import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface UpdateCertificateSentRequest {
  surveyToken: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || (req.method === "GET" ? "get" : "submit");

    if (action === "get") {
      const surveyToken = url.searchParams.get("token");
      if (!surveyToken || typeof surveyToken !== "string" || surveyToken.length < 10) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid survey token" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const { data, error } = await supabase
        .from("volunteer_surveys")
        .select("id, volunteer_name, volunteer_email, volunteer_card_id, marketplace_id, completed_at, certificate_sent_at")
        .eq("survey_token", surveyToken)
        .maybeSingle();

      if (error) {
        console.error("Error fetching survey:", error);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to fetch survey" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (!data) {
        return new Response(
          JSON.stringify({ success: false, error: "Survey not found" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Look up hours worked from volunteer_qr_cards if volunteer_card_id exists
      let hoursWorked: number | null = null;
      if (data.volunteer_card_id) {
        const { data: cardData } = await supabase
          .from("volunteer_qr_cards")
          .select("total_hours_worked")
          .eq("id", data.volunteer_card_id)
          .maybeSingle();
        if (cardData) {
          hoursWorked = cardData.total_hours_worked;
        }
      }

      return new Response(
        JSON.stringify({ success: true, survey: { ...data, hours_worked: hoursWorked } }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (action === "update-certificate-sent") {
      const body: UpdateCertificateSentRequest = await req.json();
      const { surveyToken } = body;

      if (!surveyToken || typeof surveyToken !== "string" || surveyToken.length < 10) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid survey token" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const { data: existingSurvey, error: fetchError } = await supabase
        .from("volunteer_surveys")
        .select("id, completed_at")
        .eq("survey_token", surveyToken)
        .maybeSingle();

      if (fetchError || !existingSurvey) {
        return new Response(
          JSON.stringify({ success: false, error: "Survey not found" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (!existingSurvey.completed_at) {
        return new Response(
          JSON.stringify({ success: false, error: "Survey must be completed first" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const { error: updateError } = await supabase
        .from("volunteer_surveys")
        .update({ certificate_sent_at: new Date().toISOString() })
        .eq("survey_token", surveyToken);

      if (updateError) {
        return new Response(
          JSON.stringify({ success: false, error: "Failed to update certificate status" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Default action: submit survey
    const body = await req.json();
    const { surveyToken, answers } = body;

    // Validate survey token
    if (!surveyToken || typeof surveyToken !== "string" || surveyToken.length < 10) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid survey token" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate answers object
    if (!answers || typeof answers !== "object") {
      return new Response(
        JSON.stringify({ success: false, error: "Answers are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify survey exists and is not already completed
    const { data: existingSurvey, error: fetchError } = await supabase
      .from("volunteer_surveys")
      .select("id, volunteer_card_id, completed_at")
      .eq("survey_token", surveyToken)
      .maybeSingle();

    if (fetchError) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch survey" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!existingSurvey) {
      return new Response(
        JSON.stringify({ success: false, error: "Survey not found. The link may be invalid or expired." }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (existingSurvey.completed_at) {
      return new Response(
        JSON.stringify({ success: false, error: "Survey has already been completed" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Update survey with answers JSONB
    const updateData: Record<string, unknown> = {
      answers,
      completed_at: new Date().toISOString(),
    };

    // Also populate legacy columns for backward compat if legacy fields are in the body
    if (body.experienceWord) {
      updateData.experience_word = body.experienceWord.trim().substring(0, 500);
    }
    if (body.wouldVolunteerAgain !== undefined) {
      updateData.would_volunteer_again = body.wouldVolunteerAgain;
    }
    if (body.improvementSuggestions) {
      updateData.improvement_suggestions = body.improvementSuggestions.trim().substring(0, 2000);
    }

    const { error: updateError } = await supabase
      .from("volunteer_surveys")
      .update(updateData)
      .eq("survey_token", surveyToken);

    if (updateError) {
      console.error("Error updating survey:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to submit survey" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Update volunteer card survey completion status
    if (existingSurvey.volunteer_card_id) {
      const { error: cardUpdateError } = await supabase
        .from("volunteer_qr_cards")
        .update({ survey_completed_at: new Date().toISOString() })
        .eq("id", existingSurvey.volunteer_card_id);

      if (cardUpdateError) {
        console.error("Error updating volunteer card:", cardUpdateError);
      }
    }

    console.log(`Survey submitted successfully for token: ${surveyToken.substring(0, 8)}...`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error in submit-survey function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
