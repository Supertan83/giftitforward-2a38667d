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

interface MarketplaceInfo {
  name: string;
  location: string | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
}

// Helper to format time for display (HH:MM:SS -> H:MM AM/PM)
function formatTime(time: string | null | undefined): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

// Helper to format date for display
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  return date.toLocaleDateString('en-GB', options);
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

// Helper to fetch marketplace info
// deno-lint-ignore no-explicit-any
async function getMarketplaceInfo(supabase: any, marketplaceId: string | null | undefined): Promise<MarketplaceInfo | null> {
  if (!marketplaceId) return null;
  
  try {
    const { data, error } = await supabase
      .from('marketplace_events')
      .select('name, location, event_date, start_time, end_time')
      .eq('id', marketplaceId)
      .maybeSingle();
    
    if (error || !data) return null;
    return data as MarketplaceInfo;
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

// Send email via Resend with Dubai Holding branded template
async function sendViaResend(
  cleanEmail: string,
  cleanName: string,
  surveyUrl: string,
  supabaseUrl: string,
  marketplace: MarketplaceInfo | null
): Promise<{ success: boolean; error?: string }> {
  const firstName = cleanName.split(" ")[0];
  const heroImageUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/gif-hero-banner.jpg?v=2`;
  const dubaiHoldingLogoUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/dubai-holding-logo.png`;
  const surplussLogoUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/surpluss-logo.png`;

  // Format marketplace details
  const marketplaceName = marketplace?.name || 'Gift It Forward Marketplace';
  const eventDate = formatDate(marketplace?.event_date);
  const startTime = formatTime(marketplace?.start_time);
  const endTime = formatTime(marketplace?.end_time);
  const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : (startTime || endTime || '');
  const location = marketplace?.location || '';

  // Build event details text
  let eventDetails = '';
  if (marketplaceName) {
    eventDetails = `at <strong>${marketplaceName}</strong>`;
    if (eventDate) eventDetails += ` on <strong>${eventDate}</strong>`;
    if (timeRange) eventDetails += ` (${timeRange})`;
    if (location) eventDetails += ` in ${location}`;
  }

  const sender = "Gift It Forward <giftitforward@dubaiholding.com>";
  
  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: sender,
      to: [cleanEmail],
      bcc: ['giftitforward@dubaiholding.com'],
      subject: "Thank You for Volunteering! Share Your Feedback",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
            <tr>
              <td align="center" style="padding: 20px 0;">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; max-width: 600px;">
                  
                    <!-- Hero Image -->
                    <tr>
                      <td>
                        <img src="${heroImageUrl}" alt="Gift It Forward" width="600" style="display: block; width: 100%; height: auto;" />
                      </td>
                    </tr>
                    
                    <!-- The Surpluss Logo -->
                    <tr>
                      <td style="padding: 20px 0 0 0; text-align: center;">
                        <img src="${surplussLogoUrl}" alt="The Surpluss" height="45" style="display: block; margin: 0 auto;" />
                      </td>
                    </tr>
                    
                    <!-- Red Vertical Line -->
                    <tr>
                      <td style="padding: 15px 0 10px 0; text-align: center;">
                        <div style="width: 2px; height: 50px; background-color: #DA291C; margin: 0 auto;"></div>
                      </td>
                    </tr>
                  
                  <!-- Main Title -->
                  <tr>
                    <td style="padding: 0 30px 20px 30px; text-align: center;">
                      <h1 style="margin: 0; font-size: 24px; color: #1a1a1a; font-weight: bold; line-height: 1.3;">
                        Thank You for Volunteering!
                      </h1>
                    </td>
                  </tr>
                  
                  <!-- Greeting -->
                  <tr>
                    <td style="padding: 0 30px 15px 30px;">
                      <p style="margin: 0; font-size: 15px; color: #333333;"><strong>Dear ${firstName},</strong></p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 0 30px 15px 30px;">
                      <p style="margin: 0; font-size: 14px; color: #333333; line-height: 1.6;">
                        Thank you for volunteering with <strong>Gift It Forward</strong>${eventDetails ? ' ' + eventDetails : ''}! Your time and effort made a real difference in supporting our circular economy mission and helping those in need.
                      </p>
                    </td>
                  </tr>
                  
                  <tr>
                    <td style="padding: 0 30px 20px 30px;">
                      <p style="margin: 0; font-size: 14px; color: #333333; line-height: 1.6;">
                        We'd love to hear about your experience. Please take a moment to complete this short survey:
                      </p>
                    </td>
                  </tr>
                  
                  <!-- CTA Button -->
                  <tr>
                    <td style="padding: 0 30px 20px 30px; text-align: center;">
                      <a href="${surveyUrl}" style="display: inline-block; background-color: #DA291C; color: #ffffff; padding: 14px 28px; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 4px;">Complete Survey & Get Certificate</a>
                    </td>
                  </tr>
                  
                  <tr>
                    <td style="padding: 0 30px 25px 30px;">
                      <p style="margin: 0; font-size: 12px; color: #666666; text-align: center;">
                        After completing the survey, you'll receive your <strong>Certificate of Participation</strong>.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Closing -->
                  <tr>
                    <td style="padding: 0 30px 20px 30px;">
                      <p style="margin: 0 0 15px 0; font-size: 13px; color: #333333; line-height: 1.5;">
                        Thank you for being part of the change!
                      </p>
                      <p style="margin: 0 0 3px 0; font-size: 13px; color: #333333;">Warm regards,</p>
                      <p style="margin: 0; font-size: 13px; color: #1a1a1a; font-weight: 600;">The GIF Team</p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 20px 30px; border-top: 1px solid #e5e7eb;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td width="50%" valign="middle">
                            <img src="${dubaiHoldingLogoUrl}" alt="Dubai Holding" height="30" style="display: block;" />
                          </td>
                          <td width="50%" valign="middle" style="text-align: right;">
                            <p style="margin: 0; font-size: 12px; color: #666666; font-style: italic;">For the Good of Tomorrow</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                </table>
              </td>
            </tr>
          </table>
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

    console.log(`Creating survey for ${cleanName} (${cleanEmail}), marketplace: ${marketplaceId}`);

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

    // Fetch marketplace info for email content
    const marketplace = await getMarketplaceInfo(supabase, marketplaceId);
    console.log('Marketplace info:', marketplace);

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
      
      // Include marketplace info in HubSpot properties
      const eventDate = formatDate(marketplace?.event_date);
      const startTime = formatTime(marketplace?.start_time);
      const endTime = formatTime(marketplace?.end_time);
      
      emailResult = await sendViaHubSpot(
        emailConfig.template_id!,
        cleanEmail,
        {
          first_name: cleanName.split(" ")[0],
          full_name: cleanName,
          survey_url: surveyUrl,
          marketplace_name: marketplace?.name || '',
          marketplace_location: marketplace?.location || '',
          marketplace_date: eventDate,
          marketplace_start_time: startTime,
          marketplace_end_time: endTime,
          marketplace_time_range: startTime && endTime ? `${startTime} - ${endTime}` : '',
        }
      );
    } else {
      console.log('Using Resend for survey email');
      emailResult = await sendViaResend(cleanEmail, cleanName, surveyUrl, supabaseUrl, marketplace);
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
