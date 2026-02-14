import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BodySection {
  type: string;
  content: string;
  url?: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  greeting: string;
  body_sections: BodySection[];
  cta_text: string | null;
  cta_url: string | null;
}

interface Campaign {
  id: string;
  template_id: string;
  name: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
}

interface Recipient {
  id: string;
  campaign_id: string;
  volunteer_id: string | null;
  recipient_email: string;
  recipient_name: string;
  status: string;
}

interface Volunteer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  events_list: string | null;
  events_json: any;
}

function replaceTokens(text: string, volunteer: Volunteer | null, marketplaceData?: any): string {
  const tokens: Record<string, string> = {
    '{{first_name}}': volunteer?.first_name || 'Volunteer',
    '{{last_name}}': volunteer?.last_name || '',
    '{{full_name}}': volunteer ? `${volunteer.first_name} ${volunteer.last_name}` : 'Volunteer',
    '{{email}}': volunteer?.email || '',
    '{{phone}}': volunteer?.phone_number || '',
    '{{marketplace_name}}': marketplaceData?.name || '',
    '{{marketplace_date}}': marketplaceData?.event_date || '',
    '{{marketplace_time}}': marketplaceData?.start_time ? `${marketplaceData.start_time} - ${marketplaceData.end_time || ''}` : '',
    '{{marketplace_location}}': marketplaceData?.location || '',
    '{{qr_card_id}}': '',
    '{{login_url}}': 'https://giftitforward.lovable.app/auth',
    '{{training_url}}': 'https://giftitforward.lovable.app/training',
    '{{current_date}}': new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  };

  let result = text;
  for (const [token, value] of Object.entries(tokens)) {
    result = result.replaceAll(token, value);
  }
  return result;
}

function generateCampaignEmailHTML(
  template: EmailTemplate,
  supabaseUrl: string,
  volunteer: Volunteer | null,
  marketplaceData?: any
): string {
  const heroImageUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/gif-hero-banner.jpg`;
  const dubaiHoldingLogoUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/dubai-holding-logo.png`;

  const rt = (text: string) => replaceTokens(text, volunteer, marketplaceData);

  let bodySectionsHtml = '';
  for (const section of template.body_sections) {
    const content = rt(section.content || '');
    if (section.type === 'paragraph') {
      bodySectionsHtml += `<tr><td style="padding: 0 40px 15px 40px;"><p style="margin: 0; font-size: 14px; color: #333333; line-height: 1.6;">${content}</p></td></tr>`;
    } else if (section.type === 'list') {
      const items = content.split('\n').filter(Boolean).map(li => `<li>${li}</li>`).join('');
      bodySectionsHtml += `<tr><td style="padding: 0 40px 15px 40px;"><ul style="margin: 0; padding-left: 18px; font-size: 14px; color: #333333; line-height: 1.8;">${items}</ul></td></tr>`;
    } else if (section.type === 'cta') {
      const ctaUrl = section.url ? rt(section.url) : '#';
      bodySectionsHtml += `<tr><td style="padding: 10px 40px 15px 40px; text-align: center;"><a href="${ctaUrl}" style="display: inline-block; background-color: #DA291C; color: #ffffff; padding: 12px 28px; text-decoration: none; font-size: 14px; font-weight: 600;">${content}</a></td></tr>`;
    } else if (section.type === 'image' && content) {
      bodySectionsHtml += `<tr><td style="padding: 0 40px 15px 40px;"><img src="${content}" alt="" style="display: block; width: 100%; height: auto;" /></td></tr>`;
    }
  }

  let ctaHtml = '';
  if (template.cta_text) {
    const ctaUrl = template.cta_url ? rt(template.cta_url) : '#';
    ctaHtml = `<tr><td style="padding: 10px 40px 20px 40px; text-align: center;"><a href="${ctaUrl}" style="display: inline-block; background-color: #DA291C; color: #ffffff; padding: 12px 28px; text-decoration: none; font-size: 14px; font-weight: 600;">${rt(template.cta_text)}</a></td></tr>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>body { margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, sans-serif; }</style>
</head><body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
<tr><td align="center" style="padding: 20px 0;">
<table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; max-width: 600px;">
<tr><td><img src="${heroImageUrl}" alt="Gift It Forward" width="600" style="display: block; width: 100%; height: auto;" /></td></tr>
<tr><td style="padding: 20px 30px 10px 30px; text-align: center;"><p style="margin: 0; font-size: 11px; letter-spacing: 2px; color: #B8860B; font-weight: 600;">EXECUTION PARTNER</p></td></tr>
<tr><td style="padding: 10px 40px 20px 40px; text-align: center;"><h1 style="margin: 0; font-size: 24px; color: #5D5348; font-weight: normal; line-height: 1.4; font-family: Georgia, 'Times New Roman', serif;">${rt(template.subject)}</h1></td></tr>
<tr><td style="padding: 0 40px 15px 40px;"><p style="margin: 0; font-size: 14px; color: #1a1a1a; font-weight: bold;">${rt(template.greeting)}</p></td></tr>
${bodySectionsHtml}
${ctaHtml}
<tr><td style="padding: 15px 40px 20px 40px;"><p style="margin: 0 0 3px 0; font-size: 13px; color: #333333;">Best regards,</p><p style="margin: 0; font-size: 13px; color: #1a1a1a; font-weight: bold;">Gift It Forward team</p></td></tr>
<tr><td style="padding: 20px 40px; border-top: 1px solid #e5e7eb;">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="50%" valign="middle"><img src="${dubaiHoldingLogoUrl}" alt="Dubai Holding" height="40" style="display: block;" /></td>
<td width="50%" valign="middle" style="text-align: right;"><p style="margin: 0; font-size: 13px; color: #54585A; font-style: italic;">For the Good of Tomorrow</p></td>
</tr></table></td></tr>
</table></td></tr></table></body></html>`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { campaign_id } = await req.json();

    if (!campaign_id) {
      return new Response(
        JSON.stringify({ success: false, error: "campaign_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing campaign: ${campaign_id}`);

    // Load campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ success: false, error: "Campaign not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (campaign.status === 'sent' || campaign.status === 'sending') {
      return new Response(
        JSON.stringify({ success: false, error: `Campaign is already ${campaign.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load template
    const { data: template, error: templateError } = await supabase
      .from("email_templates")
      .select("*")
      .eq("id", campaign.template_id)
      .single();

    if (templateError || !template) {
      return new Response(
        JSON.stringify({ success: false, error: "Template not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update campaign status to sending
    await supabase
      .from("email_campaigns")
      .update({ status: 'sending' })
      .eq("id", campaign_id);

    // Load pending recipients
    const { data: recipients, error: recipientsError } = await supabase
      .from("email_campaign_recipients")
      .select("*")
      .eq("campaign_id", campaign_id)
      .eq("status", "pending");

    if (recipientsError) {
      console.error("Error loading recipients:", recipientsError);
      await supabase.from("email_campaigns").update({ status: 'failed' }).eq("id", campaign_id);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to load recipients" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!recipients || recipients.length === 0) {
      await supabase.from("email_campaigns").update({ status: 'sent', sent_at: new Date().toISOString() }).eq("id", campaign_id);
      return new Response(
        JSON.stringify({ success: true, message: "No pending recipients", sent: 0, failed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Batch load volunteer data for all recipients that have volunteer_id
    const volunteerIds = recipients.filter(r => r.volunteer_id).map(r => r.volunteer_id);
    let volunteersMap: Record<string, Volunteer> = {};

    if (volunteerIds.length > 0) {
      const { data: volunteers } = await supabase
        .from("pending_volunteers")
        .select("id, first_name, last_name, email, phone_number, events_list, events_json")
        .in("id", volunteerIds);

      if (volunteers) {
        for (const v of volunteers) {
          volunteersMap[v.id] = v as Volunteer;
        }
      }
    }

    const sender = "Gift It Forward <giftitforward@dubaiholding.com>";
    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      try {
        const volunteer = recipient.volunteer_id ? volunteersMap[recipient.volunteer_id] || null : null;

        const html = generateCampaignEmailHTML(template as unknown as EmailTemplate, supabaseUrl, volunteer);
        const subject = replaceTokens(template.subject, volunteer);

        const result = await resend.emails.send({
          from: sender,
          to: [recipient.recipient_email],
          bcc: ['giftitforward@dubaiholding.com'],
          subject,
          html,
        });

        if (result.error) {
          console.error(`Failed to send to ${recipient.recipient_email}:`, result.error.message);
          await supabase
            .from("email_campaign_recipients")
            .update({ status: 'failed', error_message: result.error.message })
            .eq("id", recipient.id);
          failedCount++;
        } else {
          await supabase
            .from("email_campaign_recipients")
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq("id", recipient.id);
          sentCount++;
        }

        // Log to email_send_logs
        await supabase.from("email_send_logs").insert({
          email_type: `campaign:${campaign.name}`,
          recipient_email: recipient.recipient_email,
          provider: 'resend',
          success: !result.error,
          error_message: result.error?.message || null,
          pending_volunteer_id: recipient.volunteer_id || null,
          response_data: result.data ? result.data : null,
        });

      } catch (err) {
        console.error(`Error sending to ${recipient.recipient_email}:`, err);
        await supabase
          .from("email_campaign_recipients")
          .update({ status: 'failed', error_message: err instanceof Error ? err.message : 'Unknown error' })
          .eq("id", recipient.id);
        failedCount++;
      }
    }

    // Update campaign totals
    await supabase
      .from("email_campaigns")
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_count: (campaign.sent_count || 0) + sentCount,
        failed_count: (campaign.failed_count || 0) + failedCount,
      })
      .eq("id", campaign_id);

    console.log(`Campaign ${campaign_id} completed: ${sentCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, failed: failedCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-campaign-email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
