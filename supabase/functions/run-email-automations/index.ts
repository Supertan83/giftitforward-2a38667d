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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();

    console.log(`[run-email-automations] Running at ${now.toISOString()}, today=${todayStr}`);

    // Fetch all active automations
    const { data: automations, error: autoErr } = await supabase
      .from("email_automations")
      .select("*")
      .eq("is_active", true);

    if (autoErr) {
      console.error("Error fetching automations:", autoErr);
      return new Response(JSON.stringify({ error: autoErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!automations || automations.length === 0) {
      console.log("No active automations found");
      return new Response(JSON.stringify({ message: "No active automations", processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let fired = 0;

    for (const automation of automations) {
      processed++;
      try {
        // Parse trigger_time (HH:MM:SS or HH:MM)
        const timeParts = (automation.trigger_time || "09:00").split(":");
        const triggerHour = parseInt(timeParts[0], 10);
        const triggerMinute = parseInt(timeParts[1] || "0", 10);

        // Only fire if current hour matches (within the hour window)
        if (currentHour !== triggerHour) {
          continue;
        }
        // Only fire in the first 30 minutes of the hour to avoid double-firing
        if (currentMinute > 30) {
          continue;
        }

        const triggerType = automation.trigger_type;
        const triggerDays = automation.trigger_days || 0;

        let recipients: { email: string; name: string; volunteer_id: string | null }[] = [];
        let contextLabel = "";

        if (triggerType === "before_marketplace" || triggerType === "after_marketplace") {
          // Calculate target date
          const targetDate = new Date(now);
          if (triggerType === "before_marketplace") {
            targetDate.setDate(targetDate.getDate() + triggerDays);
          } else {
            targetDate.setDate(targetDate.getDate() - triggerDays);
          }
          const targetDateStr = targetDate.toISOString().split("T")[0];

          // Find marketplaces on target date
          const { data: marketplaces } = await supabase
            .from("marketplace_events")
            .select("id, name, event_date")
            .eq("event_date", targetDateStr);

          if (!marketplaces || marketplaces.length === 0) continue;

          // Check recipient filter
          const filter = automation.recipient_filter || { type: "all_upcoming" };
          let targetMarketplaces = marketplaces;

          if (filter.type === "marketplace" && filter.marketplace_id) {
            targetMarketplaces = marketplaces.filter((m: any) => m.id === filter.marketplace_id);
          }

          if (targetMarketplaces.length === 0) continue;

          // Check if already fired for these marketplaces today
          const mpIds = targetMarketplaces.map((m: any) => m.id);
          const { data: existingLogs } = await supabase
            .from("email_automation_logs")
            .select("id, notes")
            .eq("automation_id", automation.id)
            .gte("triggered_at", todayStr + "T00:00:00Z")
            .lte("triggered_at", todayStr + "T23:59:59Z");

          if (existingLogs && existingLogs.length > 0) {
            // Already fired today for this automation
            continue;
          }

          contextLabel = targetMarketplaces.map((m: any) => m.name).join(", ");

          // Get volunteers for these marketplaces
          const { data: volunteers } = await supabase
            .from("pending_volunteers")
            .select("id, first_name, last_name, email, events_list")
            .eq("status", "approved");

          if (volunteers) {
            for (const v of volunteers) {
              const eventsList = (v.events_list || "").toLowerCase();
              const matches = targetMarketplaces.some((m: any) =>
                eventsList.includes((m.name || "").toLowerCase())
              );
              if (matches || filter.type === "all_upcoming") {
                recipients.push({
                  email: v.email,
                  name: `${v.first_name} ${v.last_name}`,
                  volunteer_id: v.id,
                });
              }
            }
          }
        } else if (triggerType === "after_approval") {
          // Find volunteers approved X days ago
          const targetDate = new Date(now);
          targetDate.setDate(targetDate.getDate() - triggerDays);
          const targetDateStr = targetDate.toISOString().split("T")[0];

          // Check if already fired today
          const { data: existingLogs } = await supabase
            .from("email_automation_logs")
            .select("id")
            .eq("automation_id", automation.id)
            .gte("triggered_at", todayStr + "T00:00:00Z");

          if (existingLogs && existingLogs.length > 0) continue;

          const { data: volunteers } = await supabase
            .from("pending_volunteers")
            .select("id, first_name, last_name, email, approved_at")
            .eq("status", "approved")
            .gte("approved_at", targetDateStr + "T00:00:00Z")
            .lte("approved_at", targetDateStr + "T23:59:59Z");

          if (volunteers) {
            recipients = volunteers.map((v: any) => ({
              email: v.email,
              name: `${v.first_name} ${v.last_name}`,
              volunteer_id: v.id,
            }));
          }
          contextLabel = `Approved on ${targetDateStr}`;
        } else if (triggerType === "after_training") {
          const targetDate = new Date(now);
          targetDate.setDate(targetDate.getDate() - triggerDays);
          const targetDateStr = targetDate.toISOString().split("T")[0];

          const { data: existingLogs } = await supabase
            .from("email_automation_logs")
            .select("id")
            .eq("automation_id", automation.id)
            .gte("triggered_at", todayStr + "T00:00:00Z");

          if (existingLogs && existingLogs.length > 0) continue;

          const { data: volunteers } = await supabase
            .from("pending_volunteers")
            .select("id, first_name, last_name, email, training_completed_at")
            .eq("status", "approved")
            .eq("training_completed", true)
            .gte("training_completed_at", targetDateStr + "T00:00:00Z")
            .lte("training_completed_at", targetDateStr + "T23:59:59Z");

          if (volunteers) {
            recipients = volunteers.map((v: any) => ({
              email: v.email,
              name: `${v.first_name} ${v.last_name}`,
              volunteer_id: v.id,
            }));
          }
          contextLabel = `Training completed on ${targetDateStr}`;
        }

        if (recipients.length === 0) {
          console.log(`Automation "${automation.name}": no recipients, skipping`);
          continue;
        }

        // De-duplicate by email
        const seen = new Set<string>();
        recipients = recipients.filter((r) => {
          if (seen.has(r.email)) return false;
          seen.add(r.email);
          return true;
        });

        console.log(`Automation "${automation.name}": firing for ${recipients.length} recipients (${contextLabel})`);

        // Create auto-campaign
        const { data: campaign, error: campErr } = await supabase
          .from("email_campaigns")
          .insert({
            name: `Auto: ${automation.name}`,
            template_id: automation.template_id,
            recipient_filter: automation.recipient_filter,
            status: "draft",
            total_recipients: recipients.length,
            created_by: automation.created_by,
          })
          .select()
          .single();

        if (campErr || !campaign) {
          console.error(`Failed to create campaign for automation "${automation.name}":`, campErr);
          await supabase.from("email_automation_logs").insert({
            automation_id: automation.id,
            recipients_count: 0,
            status: "failed",
            notes: `Failed to create campaign: ${campErr?.message || "unknown"}`,
          });
          continue;
        }

        // Insert recipients
        const recipientRows = recipients.map((r) => ({
          campaign_id: campaign.id,
          volunteer_id: r.volunteer_id,
          recipient_email: r.email,
          recipient_name: r.name,
          status: "pending",
        }));

        await supabase.from("email_campaign_recipients").insert(recipientRows);

        // Invoke send-campaign-email
        try {
          const sendResponse = await fetch(
            `${supabaseUrl}/functions/v1/send-campaign-email`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({ campaign_id: campaign.id }),
            }
          );
          const sendResult = await sendResponse.json();
          console.log(`Automation "${automation.name}" send result:`, sendResult);

          // Log success
          await supabase.from("email_automation_logs").insert({
            automation_id: automation.id,
            campaign_id: campaign.id,
            recipients_count: recipients.length,
            status: "success",
            notes: `${contextLabel} | Sent: ${sendResult.sent || 0}, Failed: ${sendResult.failed || 0}`,
          });

          fired++;
        } catch (sendErr) {
          console.error(`Failed to send campaign for automation "${automation.name}":`, sendErr);
          await supabase.from("email_automation_logs").insert({
            automation_id: automation.id,
            campaign_id: campaign.id,
            recipients_count: recipients.length,
            status: "failed",
            notes: `Send error: ${sendErr instanceof Error ? sendErr.message : "unknown"}`,
          });
        }

        // Update last_run_at
        await supabase
          .from("email_automations")
          .update({ last_run_at: now.toISOString() })
          .eq("id", automation.id);
      } catch (err) {
        console.error(`Error processing automation "${automation.name}":`, err);
        await supabase.from("email_automation_logs").insert({
          automation_id: automation.id,
          recipients_count: 0,
          status: "failed",
          notes: `Processing error: ${err instanceof Error ? err.message : "unknown"}`,
        });
      }
    }

    console.log(`[run-email-automations] Done. Processed: ${processed}, Fired: ${fired}`);

    return new Response(
      JSON.stringify({ success: true, processed, fired }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in run-email-automations:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
