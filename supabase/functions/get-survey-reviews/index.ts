import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is authenticated staff
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check staff role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.toLowerCase() || "";

    // Fetch survey questions for mapping
    const { data: questions } = await adminClient
      .from("survey_questions")
      .select("id, question_text, sort_order")
      .eq("is_active", true)
      .order("sort_order");

    const questionMap: Record<string, string> = {};
    (questions || []).forEach((q: any) => {
      questionMap[q.id] = q.question_text;
    });

    // Fetch internal volunteer surveys
    const { data: internalSurveys } = await adminClient
      .from("volunteer_surveys")
      .select("volunteer_name, completed_at, answers")
      .not("completed_at", "is", null);

    // Fetch external survey responses
    const { data: externalSurveys } = await adminClient
      .from("external_survey_responses")
      .select("volunteer_name, completed_at, answers")
      .not("completed_at", "is", null);

    // Unify results
    const results: any[] = [];

    (internalSurveys || []).forEach((s: any) => {
      if (search && !s.volunteer_name?.toLowerCase().includes(search)) return;
      results.push({
        name: s.volunteer_name,
        completedAt: s.completed_at,
        source: "internal",
        answers: s.answers || {},
      });
    });

    (externalSurveys || []).forEach((s: any) => {
      if (search && !s.volunteer_name?.toLowerCase().includes(search)) return;
      results.push({
        name: s.volunteer_name,
        completedAt: s.completed_at,
        source: "external",
        answers: s.answers || {},
      });
    });

    // Sort by most recent first
    results.sort(
      (a, b) =>
        new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );

    return new Response(
      JSON.stringify({ surveys: results, questionMap }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
