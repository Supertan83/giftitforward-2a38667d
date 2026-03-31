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

    // Fetch marketplace names for resolution
    const { data: marketplaces } = await adminClient
      .from("marketplace_events")
      .select("id, name");

    const marketplaceMap: Record<string, string> = {};
    (marketplaces || []).forEach((m: any) => {
      marketplaceMap[m.id] = m.name;
    });

    // Fetch internal volunteer surveys with expanded fields
    const { data: internalSurveys } = await adminClient
      .from("volunteer_surveys")
      .select("volunteer_name, volunteer_email, completed_at, answers, marketplace_id, experience_word, would_volunteer_again, improvement_suggestions, volunteer_card_id")
      .not("completed_at", "is", null);

    // Batch lookup hours, marketplace fallback, and volunteer_id for internal surveys
    const cardIds = (internalSurveys || [])
      .map((s: any) => s.volunteer_card_id)
      .filter(Boolean);

    const hoursMap: Record<string, number> = {};
    const cardMarketplaceMap: Record<string, string | null> = {};
    const cardVolunteerIdMap: Record<string, string | null> = {};
    if (cardIds.length > 0) {
      const { data: cards } = await adminClient
        .from("volunteer_qr_cards")
        .select("id, total_hours_worked, marketplace_id, volunteer_id")
        .in("id", cardIds);
      (cards || []).forEach((c: any) => {
        if (c.total_hours_worked != null) {
          hoursMap[c.id] = c.total_hours_worked;
        }
        if (c.marketplace_id) {
          cardMarketplaceMap[c.id] = c.marketplace_id;
        }
        if (c.volunteer_id) {
          cardVolunteerIdMap[c.id] = c.volunteer_id;
        }
      });
    }

    // Batch lookup company info from pending_volunteers
    const volunteerIds = [...new Set(Object.values(cardVolunteerIdMap).filter(Boolean))] as string[];
    const volunteerCompanyMap: Record<string, string> = {};
    if (volunteerIds.length > 0) {
      const { data: volunteers } = await adminClient
        .from("pending_volunteers")
        .select("id, is_employee, external_company")
        .in("id", volunteerIds);
      (volunteers || []).forEach((v: any) => {
        if (v.external_company) {
          volunteerCompanyMap[v.id] = v.external_company;
        } else if (v.is_employee) {
          volunteerCompanyMap[v.id] = "Dubai Holding";
        } else {
          volunteerCompanyMap[v.id] = "";
        }
      });
    }

    // Fetch external survey responses with expanded fields
    const { data: externalSurveys } = await adminClient
      .from("external_survey_responses")
      .select("volunteer_name, volunteer_email, completed_at, answers, marketplace_id, experience_word, would_volunteer_again, improvement_suggestions, company_name")
      .not("completed_at", "is", null);

    // Unify results
    const results: any[] = [];

    (internalSurveys || []).forEach((s: any) => {
      if (search && !s.volunteer_name?.toLowerCase().includes(search)) return;
      const resolvedMarketplaceId = s.marketplace_id || (s.volunteer_card_id ? cardMarketplaceMap[s.volunteer_card_id] : null);
      // Resolve company from pending_volunteers via card -> volunteer_id
      const volId = s.volunteer_card_id ? cardVolunteerIdMap[s.volunteer_card_id] : null;
      const resolvedCompany = volId ? (volunteerCompanyMap[volId] || "") : "";
      results.push({
        name: s.volunteer_name,
        email: s.volunteer_email || "",
        completedAt: s.completed_at,
        source: "internal",
        answers: s.answers || {},
        marketplaceName: resolvedMarketplaceId ? (marketplaceMap[resolvedMarketplaceId] || "") : "",
        experienceWord: s.experience_word || "",
        wouldVolunteerAgain: s.would_volunteer_again,
        improvementSuggestions: s.improvement_suggestions || "",
        company: resolvedCompany,
        totalHours: s.volunteer_card_id ? (hoursMap[s.volunteer_card_id] ?? null) : null,
      });
    });
    (externalSurveys || []).forEach((s: any) => {
      if (search && !s.volunteer_name?.toLowerCase().includes(search)) return;
      results.push({
        name: s.volunteer_name,
        email: s.volunteer_email || "",
        completedAt: s.completed_at,
        source: "external",
        answers: s.answers || {},
        marketplaceName: s.marketplace_id ? (marketplaceMap[s.marketplace_id] || "") : "",
        experienceWord: s.experience_word || "",
        wouldVolunteerAgain: s.would_volunteer_again,
        improvementSuggestions: s.improvement_suggestions || "",
        company: s.company_name || "",
        totalHours: null,
      });
    });

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
