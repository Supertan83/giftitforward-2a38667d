import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendCertificateRequest {
  firstName: string;
  lastName: string;
  email: string;
  certificateBase64: string;
  marketplaceId?: string;
  hoursWorked?: number;
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
async function getEmailConfig(emailType: string): Promise<EmailConfig | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('hubspot_email_config')
      .select('email_type, template_id, enabled')
      .eq('email_type', emailType)
      .single();
    
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

// Helper to fetch marketplace info
async function getMarketplaceInfo(marketplaceId: string | null | undefined): Promise<MarketplaceInfo | null> {
  if (!marketplaceId) return null;
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

// Send email via HubSpot transactional API (no attachment support)
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
              lastname: customProperties.last_name || '',
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

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { firstName, lastName, email, certificateBase64, marketplaceId, hoursWorked }: SendCertificateRequest = await req.json();

    // Trim whitespace from names
    const cleanFirstName = (firstName || '').trim();
    const cleanLastName = (lastName || '').trim();
    const cleanEmail = (email || '').trim();

    console.log(`Sending certificate to ${cleanEmail} for ${cleanFirstName} ${cleanLastName}, marketplace: ${marketplaceId}`);

    // Validate inputs
    if (!cleanFirstName || !cleanEmail || !certificateBase64) {
      console.error("Missing required fields:", { firstName: cleanFirstName, email: cleanEmail, hasCertificate: !!certificateBase64 });
      return new Response(
        JSON.stringify({ error: "Missing required fields", success: false }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Fetch marketplace info
    const marketplace = await getMarketplaceInfo(marketplaceId);
    console.log('Marketplace info for certificate:', marketplace);

    const fullName = cleanLastName ? `${cleanFirstName} ${cleanLastName}` : cleanFirstName;
    const filename = `certificate-${fullName.replace(/\s+/g, '-').toLowerCase()}.pdf`;

    // Get Supabase URL for email assets
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const heroImageUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/gif-hero-banner.jpg`;
    const dubaiHoldingLogoUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/dubai-holding-logo.png`;

    // Format marketplace details
    const marketplaceName = marketplace?.name || 'Gift It Forward Marketplace';
    const eventDate = formatDate(marketplace?.event_date);
    const startTime = formatTime(marketplace?.start_time);
    const endTime = formatTime(marketplace?.end_time);
    const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : (startTime || endTime || '');
    const location = marketplace?.location || '';

    // Build event participation text
    let participationDetails = '';
    if (marketplace) {
      participationDetails = `<p style="margin: 0 0 15px 0; font-size: 14px; color: #333333; line-height: 1.6;">
        You participated at <strong>${marketplaceName}</strong>`;
      if (eventDate) participationDetails += ` on <strong>${eventDate}</strong>`;
      if (timeRange) participationDetails += ` (${timeRange})`;
      if (location) participationDetails += ` in ${location}`;
      if (hoursWorked && hoursWorked > 0) participationDetails += `, contributing <strong>${hoursWorked.toFixed(1)} hours</strong> of your time`;
      participationDetails += `.</p>`;
    }

    // Check email configuration
    const emailConfig = await getEmailConfig('certificate');
    const useHubSpot = emailConfig?.enabled && emailConfig?.template_id && HUBSPOT_API_KEY;

    // Note: HubSpot doesn't support attachments, so we always use Resend for certificate emails
    if (useHubSpot) {
      console.log('Note: HubSpot is configured for certificate emails, but attachments require Resend');
      console.log('Falling back to Resend for certificate email with PDF attachment');
    }

    console.log(`Attempting to send email to ${cleanEmail} with filename ${filename}`);

    const emailResponse = await resend.emails.send({
      from: "Gift It Forward <noreply@mgif.thesurpluss.com>",
      to: [cleanEmail],
      subject: "Your Circular Economy Training Certificate",
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
                  
                  <!-- Execution Partner Label -->
                  <tr>
                    <td style="padding: 20px 30px 10px 30px; text-align: center;">
                      <p style="margin: 0; font-size: 11px; letter-spacing: 2px; color: #B8860B; font-weight: 600;">EXECUTION PARTNER</p>
                    </td>
                  </tr>
                  
                  <!-- Main Title -->
                  <tr>
                    <td style="padding: 0 30px 20px 30px; text-align: center;">
                      <h1 style="margin: 0; font-size: 24px; color: #1a1a1a; font-weight: bold; line-height: 1.3;">
                        Congratulations, ${cleanFirstName}!
                      </h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 0 30px 15px 30px;">
                      <p style="margin: 0; font-size: 14px; color: #333333; line-height: 1.6;">
                        You've successfully completed the <strong>Circular Economy Training Module</strong> and served as a valued Gift It Forward volunteer.
                      </p>
                    </td>
                  </tr>
                  
                  ${participationDetails ? `
                  <tr>
                    <td style="padding: 0 30px 15px 30px;">
                      ${participationDetails}
                    </td>
                  </tr>
                  ` : ''}
                  
                  <tr>
                    <td style="padding: 0 30px 20px 30px;">
                      <p style="margin: 0; font-size: 14px; color: #333333; line-height: 1.6;">
                        Your certificate of completion is attached to this email. This certificate recognizes your commitment to understanding circular economy principles and your contribution as a Gift It Forward volunteer.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- What You've Learned -->
                  <tr>
                    <td style="padding: 0 30px 20px 30px;">
                      <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px;">
                        <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #1a1a1a; font-weight: bold;">What You've Learned:</h3>
                        <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #333333; line-height: 1.8;">
                          <li>The fundamentals of the Circular Economy</li>
                          <li>How Gift It Forward redistributes surplus items</li>
                          <li>The impact of avoided emissions</li>
                          <li>Your role as a Circular Economy advocate</li>
                        </ul>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Closing -->
                  <tr>
                    <td style="padding: 0 30px 20px 30px;">
                      <p style="margin: 0 0 15px 0; font-size: 13px; color: #333333; line-height: 1.5;">
                        Thank you for being part of this important initiative. Together, we're making a positive impact on communities and the environment.
                      </p>
                      <p style="margin: 0 0 3px 0; font-size: 13px; color: #333333;">Best regards,</p>
                      <p style="margin: 0; font-size: 13px; color: #1a1a1a; font-weight: 600;">Gift It Forward Team</p>
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
      attachments: [
        {
          filename: filename,
          content: certificateBase64,
        },
      ],
    });

    console.log("Email sent successfully:", emailResponse);

    // Check for Resend errors
    if (emailResponse.error) {
      console.error("Resend error:", emailResponse.error);
      
      // Return 200 with error details so frontend can show appropriate message
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: emailResponse.error.message || "Email sending failed",
          details: "Please ensure the domain is verified in Resend"
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: emailResponse.data?.id, provider: 'resend' }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error in send-certificate function:", error);
    // Return 200 with error details to prevent edge function error on frontend
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
