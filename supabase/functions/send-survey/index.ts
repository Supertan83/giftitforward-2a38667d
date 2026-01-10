import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendSurveyRequest {
  volunteerCardId: string;
  volunteerId?: string;
  volunteerName: string;
  volunteerEmail: string;
  marketplaceId?: string;
}

interface EmailConfig {
  email_type: string;
  template_id: string | null;
  enabled: boolean;
}

// Helper to get email config from database
// deno-lint-ignore no-explicit-any
async function getEmailConfig(supabase: any, emailType: string): Promise<EmailConfig | null> {
  try {
    const { data, error } = await supabase
      .from('hubspot_email_config')
      .select('email_type, template_id, enabled')
      .eq('email_type', emailType)
      .single();
    
    if (error || !data) return null;
    return data as EmailConfig;
  } catch {
    return null;
  }
}

// Send email via HubSpot transactional API
async function sendViaHubSpot(
  templateId: string,
  recipientEmail: string,
  customProperties: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  try {
    // First, ensure contact exists in HubSpot
    const searchResponse = await fetch(
      'https://api.hubapi.com/crm/v3/objects/contacts/search',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filterGroups: [{
            filters: [{
              propertyName: 'email',
              operator: 'EQ',
              value: recipientEmail,
            }]
          }]
        })
      }
    );

    const searchData = await searchResponse.json();
    
    // Create contact if doesn't exist
    if (!searchData.results || searchData.results.length === 0) {
      const createResponse = await fetch(
        'https://api.hubapi.com/crm/v3/objects/contacts',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            properties: {
              email: recipientEmail,
              firstname: customProperties.first_name || '',
              ...customProperties
            }
          })
        }
      );
      
      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        console.error('Failed to create HubSpot contact:', errorData);
      }
    }

    // Send transactional email
    const emailResponse = await fetch(
      'https://api.hubapi.com/marketing/v3/transactional/single-email/send',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailId: parseInt(templateId),
          message: {
            to: recipientEmail,
          },
          customProperties: customProperties,
          contactProperties: customProperties
        })
      }
    );

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error('HubSpot email send failed:', errorData);
      return { success: false, error: errorData.message || 'HubSpot email failed' };
    }

    const result = await emailResponse.json();
    console.log('HubSpot email sent successfully:', result);
    return { success: true };
  } catch (error) {
    console.error('HubSpot email error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown HubSpot error' };
  }
}

// Send email via Resend
async function sendViaResend(
  cleanEmail: string,
  cleanName: string,
  surveyUrl: string
): Promise<{ success: boolean; error?: string }> {
  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "GIF Volunteer <noreply@mgif.thesurpluss.com>",
      to: [cleanEmail],
      subject: "Thank You for Volunteering! Share Your Feedback",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff; }
            .header { background: #DA291C; padding: 30px 20px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
            .content { padding: 30px 20px; }
            .highlight { color: #DA291C; font-weight: bold; }
            .button { display: inline-block; padding: 14px 28px; background-color: #DA291C; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
            .footer { padding: 20px; text-align: center; color: #888; font-size: 12px; border-top: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Thank You, ${cleanName.split(" ")[0]}!</h1>
            </div>
            <div class="content">
              <p>Thank you for volunteering with <span class="highlight">Gift It Forward</span>!</p>
              <p>Your time and effort made a real difference in supporting our circular economy mission and helping those in need.</p>
              <p>We'd love to hear about your experience. Please take a moment to complete this short survey:</p>
              
              <div style="text-align: center;">
                <a href="${surveyUrl}" class="button">Complete Survey & Get Certificate</a>
              </div>
              
              <p style="color: #666; font-size: 14px;">After completing the survey, you'll receive your <strong>Certificate of Participation</strong>.</p>
              
              <p>Thank you for being part of the change!</p>
              <p>Warm regards,<br><strong>The GIF Team</strong></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Gift It Forward. All rights reserved.</p>
              <p>If you have any questions, please contact us.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    }),
  });

  const emailResult = await emailResponse.json();

  if (!emailResponse.ok) {
    console.error("Resend email send failed:", emailResult);
    return { success: false, error: emailResult.message || "Failed to send email" };
  }

  console.log("Resend email sent successfully:", emailResult);
  return { success: true };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      volunteerCardId,
      volunteerId,
      volunteerName,
      volunteerEmail,
      marketplaceId,
    }: SendSurveyRequest = await req.json();

    const cleanEmail = (volunteerEmail || "").trim();
    const cleanName = (volunteerName || "").trim();

    console.log(`Creating survey for ${cleanName} (${cleanEmail})`);

    // Validate inputs
    if (!cleanEmail || !cleanName) {
      console.error("Missing required fields:", {
        hasEmail: !!cleanEmail,
        hasName: !!cleanName,
      });
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate unique survey token
    const surveyToken = crypto.randomUUID();

    // Create survey record
    const { data: surveyData, error: surveyError } = await supabase
      .from("volunteer_surveys")
      .insert({
        volunteer_card_id: volunteerCardId,
        volunteer_id: volunteerId || null,
        marketplace_id: marketplaceId || null,
        volunteer_name: cleanName,
        volunteer_email: cleanEmail,
        survey_token: surveyToken,
      })
      .select()
      .single();

    if (surveyError) {
      console.error("Error creating survey record:", surveyError);
      return new Response(
        JSON.stringify({ success: false, error: surveyError.message }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Update volunteer card with survey sent timestamp
    await supabase
      .from("volunteer_qr_cards")
      .update({ survey_sent_at: new Date().toISOString() })
      .eq("id", volunteerCardId);

    // Build survey URL
    const appUrl = Deno.env.get("APP_URL") || "https://gif.thesurpluss.com";
    const surveyUrl = `${appUrl}/volunteer-survey?token=${surveyToken}`;

    console.log(`Sending survey email to ${cleanEmail}`);

    // Check email configuration
    const emailConfig = await getEmailConfig(supabase, 'survey');
    const useHubSpot = emailConfig?.enabled && emailConfig?.template_id && HUBSPOT_API_KEY;

    let emailResult: { success: boolean; error?: string };

    if (useHubSpot) {
      console.log('Using HubSpot for survey email');
      emailResult = await sendViaHubSpot(
        emailConfig.template_id!,
        cleanEmail,
        {
          first_name: cleanName.split(" ")[0],
          full_name: cleanName,
          survey_url: surveyUrl,
        }
      );
    } else {
      console.log('Using Resend for survey email');
      emailResult = await sendViaResend(cleanEmail, cleanName, surveyUrl);
    }

    if (!emailResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: emailResult.error }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        surveyId: surveyData.id,
        surveyToken,
        provider: useHubSpot ? 'hubspot' : 'resend',
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error in send-survey function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error occurred" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
