import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_TABLES = [
  "allocation_traceability_logs", "archived_card_data", "cleanup_archive",
  "email_automation_logs", "email_automations", "email_campaign_recipients",
  "email_campaigns", "email_provider_config", "email_send_logs", "email_templates",
  "event_dependents", "external_addresses", "external_companies",
  "external_item_sdg_goals", "external_items", "external_material_groups",
  "external_sdg_goals", "external_survey_responses", "hubspot_email_config",
  "item_types", "marketplace_events", "marketplace_item_allocations",
  "marketplace_manual_counts", "outreach_partners", "partner_registrations",
  "pending_volunteers", "qr_cards", "registration_events",
  "surpluss_allocation_sync", "surpluss_api_audit_log",
  "surpluss_distribution_reports", "survey_questions",
  "transactions", "user_roles", "volunteer_attendance",
  "volunteer_qr_cards", "volunteer_surveys", "warehouse_returns",
  "webhook_events", "webhook_mapping_templates",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user is admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;

    // Check admin role using service role client
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "fetch";

    if (action === "list") {
      // Return table names and row counts
      const tableCounts: Record<string, number> = {};
      for (const table of ALLOWED_TABLES) {
        const { count } = await adminClient
          .from(table)
          .select("*", { count: "exact", head: true });
        tableCounts[table] = count || 0;
      }
      return new Response(JSON.stringify({ tables: tableCounts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "fetch") {
      const table = url.searchParams.get("table");
      const offset = parseInt(url.searchParams.get("offset") || "0");
      const limit = parseInt(url.searchParams.get("limit") || "5000");

      if (!table || !ALLOWED_TABLES.includes(table)) {
        return new Response(JSON.stringify({ error: "Invalid table name" }), { status: 400, headers: corsHeaders });
      }

      const clampedLimit = Math.min(limit, 5000);

      const { data, error, count } = await adminClient
        .from(table)
        .select("*", { count: "exact" })
        .range(offset, offset + clampedLimit - 1)
        .order("created_at", { ascending: true });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ data, total: count, offset, limit: clampedLimit }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
