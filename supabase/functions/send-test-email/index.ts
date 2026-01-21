import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VolunteerData {
  first_name?: string;
  last_name?: string;
  name?: string;
  phone?: string;
  is_employee?: boolean;
  employee_vertical?: string | null;
  external_company?: string | null;
  employee_number?: string | null;
  events_list?: string;
  marketplace_name?: string;
  marketplace_date?: string;
  marketplace_location?: string;
  marketplace_time?: string;
}

interface SendTestEmailRequest {
  email_type: 'welcome' | 'survey' | 'certificate';
  recipient_email: string;
  test_mode: boolean;
  provider?: 'resend' | 'microsoft_graph';
  volunteer_data?: VolunteerData;
}

// Microsoft Graph helper functions
async function getMicrosoftAccessToken(): Promise<string> {
  const tenantId = Deno.env.get("AZURE_TENANT_ID");
  const clientId = Deno.env.get("AZURE_CLIENT_ID");
  const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET");

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Microsoft Graph credentials not configured (AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET)");
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Token request failed:", errorText);
    throw new Error(`Failed to obtain Microsoft Graph token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function sendEmailViaMicrosoftGraph(
  accessToken: string,
  senderEmail: string,
  recipientEmail: string,
  subject: string,
  htmlContent: string,
  bccEmail?: string
): Promise<{ success: boolean; error?: string }> {
  const sendMailUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;
  
  const emailPayload: any = {
    message: {
      subject,
      body: { contentType: "HTML", content: htmlContent },
      toRecipients: [{ emailAddress: { address: recipientEmail } }],
    },
    saveToSentItems: true,
  };

  if (bccEmail) {
    emailPayload.message.bccRecipients = [{ emailAddress: { address: bccEmail } }];
  }

  const response = await fetch(sendMailUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emailPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Microsoft Graph send failed:", errorText);
    return { success: false, error: `Microsoft Graph API error: ${response.status} - ${errorText}` };
  }

  return { success: true };
}

async function checkMicrosoftGraphStatus(): Promise<{ configured: boolean; canAuthenticate: boolean; error?: string }> {
  const tenantId = Deno.env.get("AZURE_TENANT_ID");
  const clientId = Deno.env.get("AZURE_CLIENT_ID");
  const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET");
  const senderEmail = Deno.env.get("SENDER_EMAIL");

  if (!tenantId || !clientId || !clientSecret) {
    return { configured: false, canAuthenticate: false, error: "Azure credentials not configured" };
  }

  if (!senderEmail) {
    return { configured: true, canAuthenticate: false, error: "SENDER_EMAIL not configured" };
  }

  try {
    await getMicrosoftAccessToken();
    return { configured: true, canAuthenticate: true };
  } catch (error) {
    return { configured: true, canAuthenticate: false, error: error instanceof Error ? error.message : "Token error" };
  }
}

// Generate branded email HTML template with optional volunteer data
function generateEmailHTML(emailType: string, firstName: string, supabaseUrl: string, volunteerData?: VolunteerData): string {
  const heroImageUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/gif-hero-banner.jpg`;
  const trainingImageUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/training-module-banner.jpg`;
  const dubaiHoldingLogoUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/dubai-holding-logo.png`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=VOL-TEST-1234`;

  const baseStyles = `
    <style>
      body { margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, sans-serif; }
    </style>
  `;

  const header = `
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
  `;

  const footer = `
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
  `;

  if (emailType === 'welcome') {
    // Get marketplace details from volunteer data or use defaults
    const marketplaceName = volunteerData?.marketplace_name || 'GIF Marketplace - Test Event';
    const marketplaceDate = volunteerData?.marketplace_date 
      ? new Date(volunteerData.marketplace_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'TBD';
    const marketplaceLocation = volunteerData?.marketplace_location || 'Jumeirah Golf Estates Clubhouse';
    const marketplaceTime = volunteerData?.marketplace_time || '09:00 - 14:00';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${baseStyles}
      </head>
      <body>
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
                
                <!-- Main Title -->
                <tr>
                  <td style="padding: 25px 30px 20px 30px; text-align: center;">
                    <h1 style="margin: 0; font-size: 22px; color: #1a1a1a; font-weight: bold; line-height: 1.3;">
                      Thank you for registering as a<br>Gift It Forward volunteer
                    </h1>
                  </td>
                </tr>
                
                <!-- Greeting -->
                <tr>
                  <td style="padding: 0 30px 15px 30px;">
                    <p style="margin: 0; font-size: 15px; color: #333333;">Dear ${firstName},</p>
                  </td>
                </tr>
                
                <!-- Intro Text -->
                <tr>
                  <td style="padding: 0 30px 15px 30px;">
                    <p style="margin: 0; font-size: 14px; color: #333333; line-height: 1.6;">
                      We're delighted to have you join us. Your volunteer registration has been successfully confirmed for the following event:
                    </p>
                  </td>
                </tr>
                
                <!-- Event Details -->
                <tr>
                  <td style="padding: 0 30px 20px 30px;">
                    <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #333333; line-height: 2;">
                      <li><strong>Event:</strong> ${marketplaceName}</li>
                      <li><strong>Date:</strong> ${marketplaceDate}</li>
                      <li><strong>Location:</strong> ${marketplaceLocation}</li>
                      <li><strong>Timings:</strong> ${marketplaceTime}</li>
                    </ul>
                  </td>
                </tr>
                
                <!-- Helpful Reminders -->
                <tr>
                  <td style="padding: 0 30px 20px 30px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #1a1a1a; font-weight: bold;">Helpful reminders:</h3>
                    <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #333333; line-height: 2;" type="a">
                      <li>Arrive at least 15 minutes before your shift starts</li>
                      <li>Wear comfortable clothing and closed-toe shoes</li>
                      <li>Bring your QR code (shown below) for check-in</li>
                      <li>Stay hydrated and take breaks when needed</li>
                    </ol>
                  </td>
                </tr>
                
                <!-- QR Code Section -->
                <tr>
                  <td style="padding: 0 30px 10px 30px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #1a1a1a; font-weight: bold;">Your QR code allows you to:</h3>
                    <ul style="margin: 0 0 15px 0; padding-left: 20px; font-size: 14px; color: #333333; line-height: 1.8;">
                      <li>Check in and out of events</li>
                      <li>Track your volunteer hours</li>
                      <li>Access marketplace zones</li>
                    </ul>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 0 30px 10px 30px; text-align: center;">
                    <img src="${qrCodeUrl}" alt="Volunteer QR Code" width="150" height="150" style="display: block; margin: 0 auto;" />
                    <p style="margin: 10px 0 0 0; font-size: 12px; color: #666666;">QR Card ID: VOL-TEST-1234</p>
                  </td>
                </tr>
                
                <!-- Login Credentials -->
                <tr>
                  <td style="padding: 20px 30px 10px 30px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #1a1a1a; font-weight: bold; border-bottom: 2px solid #0D4A6F; padding-bottom: 5px; display: inline-block;">Platform login credentials</h3>
                    <p style="margin: 10px 0; font-size: 14px; color: #333333;">
                      <strong>Email:</strong> test@example.com<br>
                      <strong>Password:</strong> TestPass123!
                    </p>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 15px 30px 25px 30px;">
                    <a href="https://gif.thesurpluss.com/auth" style="display: inline-block; background-color: #0D4A6F; color: #ffffff; padding: 12px 24px; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 4px;">Login to the platform</a>
                  </td>
                </tr>
                
                <!-- Training Section -->
                <tr>
                  <td style="padding: 0 30px 25px 30px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                      <tr>
                        <td width="45%" valign="top">
                          <img src="${trainingImageUrl}" alt="Circular Economy Training" width="250" style="display: block; width: 100%; height: auto;" />
                        </td>
                        <td width="55%" valign="middle" style="padding: 20px;">
                          <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #1a1a1a; font-weight: bold;">Circular Economy Training Module</h3>
                          <p style="margin: 0 0 15px 0; font-size: 13px; color: #333333; line-height: 1.5;">
                            Please complete this short training before your first volunteer shift.
                          </p>
                          <a href="https://gif.thesurpluss.com/training" style="display: inline-block; background-color: #B8860B; color: #ffffff; padding: 10px 20px; text-decoration: none; font-size: 13px; font-weight: 600; border-radius: 4px;">Start Training</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- What's Next -->
                <tr>
                  <td style="padding: 0 30px 20px 30px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #1a1a1a; font-weight: bold;">What's next?</h3>
                    <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #333333; line-height: 1.8;">
                      <li>Complete the training module above</li>
                      <li>Save this email with your QR code</li>
                      <li>Mark your calendar for ${marketplaceDate}</li>
                      <li>Look out for reminder notifications</li>
                    </ul>
                  </td>
                </tr>
                
                <!-- Closing -->
                <tr>
                  <td style="padding: 0 30px 25px 30px;">
                    <p style="margin: 0 0 15px 0; font-size: 14px; color: #333333; line-height: 1.5;">
                      If you have any questions, please contact us at <a href="mailto:giftitforward@dubaiholding.com" style="color: #0D4A6F;">giftitforward@dubaiholding.com</a>
                    </p>
                    <p style="margin: 0 0 3px 0; font-size: 14px; color: #333333;">Best regards,</p>
                    <p style="margin: 0; font-size: 14px; color: #1a1a1a; font-weight: 600;">Gift It Forward team</p>
                  </td>
                </tr>
                
                ${footer}
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  if (emailType === 'survey') {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${baseStyles}
      </head>
      <body>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
          <tr>
            <td align="center" style="padding: 20px 0;">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; max-width: 600px;">
                ${header}
                
                <!-- Main Title -->
                <tr>
                  <td style="padding: 0 30px 20px 30px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; color: #1a1a1a; font-weight: bold; line-height: 1.3;">
                      Thank You for Volunteering!
                    </h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 0 30px 15px 30px;">
                    <p style="margin: 0; font-size: 15px; color: #333333;">Dear ${firstName},</p>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 0 30px 15px 30px;">
                    <p style="margin: 0; font-size: 14px; color: #333333; line-height: 1.6;">
                      Thank you for volunteering with Gift It Forward! Your time and effort made a real difference in supporting our circular economy mission and helping those in need.
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
                    <a href="#" style="display: inline-block; background-color: #B8860B; color: #ffffff; padding: 14px 28px; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 4px;">Complete Survey & Get Certificate</a>
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
                
                ${footer}
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  if (emailType === 'certificate') {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${baseStyles}
      </head>
      <body>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
          <tr>
            <td align="center" style="padding: 20px 0;">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; max-width: 600px;">
                ${header}
                
                <!-- Main Title -->
                <tr>
                  <td style="padding: 0 30px 20px 30px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; color: #1a1a1a; font-weight: bold; line-height: 1.3;">
                      Congratulations, ${firstName}!
                    </h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 0 30px 15px 30px;">
                    <p style="margin: 0; font-size: 14px; color: #333333; line-height: 1.6;">
                      You've successfully completed the <strong>Circular Economy Training Module</strong>.
                    </p>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 0 30px 20px 30px;">
                    <p style="margin: 0; font-size: 14px; color: #333333; line-height: 1.6;">
                      Your certificate of completion is attached to this email. This certificate recognizes your commitment to understanding circular economy principles and your role as a Gift It Forward volunteer.
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
                
                ${footer}
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  return '';
}

// Helper function to send email via Resend with fallback sender
async function sendEmailWithFallback(
  emailOptions: {
    to: string[];
    subject: string;
    html: string;
  }
): Promise<{ success: boolean; error?: string; usedFallback?: boolean }> {
  const primarySender = "Gift It Forward <giftitforward@dubaiholding.com>";
  const fallbackSender = "Gift It Forward <noreply@mgif.thesurpluss.com>";
  
  // Try primary sender first
  console.log(`Attempting email with primary sender: ${primarySender}`);
  const primaryResult = await resend.emails.send({
    from: primarySender,
    ...emailOptions,
  });
  
  if (!primaryResult.error) {
    console.log("Email sent successfully with primary sender");
    return { success: true, usedFallback: false };
  }
  
  // Check if error is domain-related
  const errorMessage = primaryResult.error?.message || "";
  console.log(`Primary sender failed: ${errorMessage}`);
  
  if (errorMessage.includes("domain") || errorMessage.includes("not verified") || errorMessage.includes("not found")) {
    console.log(`Retrying with fallback sender: ${fallbackSender}`);
    const fallbackResult = await resend.emails.send({
      from: fallbackSender,
      ...emailOptions,
    });
    
    if (!fallbackResult.error) {
      console.log("Email sent successfully with fallback sender");
      return { success: true, usedFallback: true };
    }
    
    console.error("Fallback sender also failed:", fallbackResult.error);
    return { success: false, error: fallbackResult.error?.message || "Fallback email failed" };
  }
  
  return { success: false, error: errorMessage };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ success: false, error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    
    // Handle status check request
    if (body.action === 'check_status') {
      const status = await checkMicrosoftGraphStatus();
      return new Response(
        JSON.stringify(status),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email_type, recipient_email, test_mode, provider = 'resend', volunteer_data }: SendTestEmailRequest = body;

    if (!email_type || !recipient_email) {
      return new Response(
        JSON.stringify({ success: false, error: "email_type and recipient_email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending test ${email_type} email to ${recipient_email} via ${provider}`);
    if (volunteer_data) {
      console.log("Using custom volunteer data:", JSON.stringify(volunteer_data));
    }

    // Use volunteer data if provided, otherwise default
    const firstName = volunteer_data?.first_name || "Test Volunteer";
    const emailSubjects: Record<string, string> = {
      welcome: "[TEST] Thank you for registering as a Gift It Forward volunteer",
      survey: "[TEST] Thank You for Volunteering! Share Your Feedback",
      certificate: "[TEST] Your Circular Economy Training Certificate",
    };

    const html = generateEmailHTML(email_type, firstName, supabaseUrl, volunteer_data);
    const subject = emailSubjects[email_type] || `[TEST] ${email_type} Email`;

    // Handle Microsoft Graph provider
    if (provider === 'microsoft_graph') {
      console.log("Using Microsoft Graph to send test email...");
      
      try {
        const accessToken = await getMicrosoftAccessToken();
        const senderEmail = Deno.env.get("SENDER_EMAIL");
        const bccEmail = Deno.env.get("HUBSPOT_BCC_ADDRESS");
        
        if (!senderEmail) {
          return new Response(
            JSON.stringify({ success: false, error: "SENDER_EMAIL not configured for Microsoft Graph" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const result = await sendEmailViaMicrosoftGraph(
          accessToken,
          senderEmail,
          recipient_email,
          subject,
          html,
          bccEmail
        );
        
        if (!result.success) {
          console.error("Microsoft Graph send failed:", result.error);
          return new Response(
            JSON.stringify({ success: false, error: result.error, provider: 'microsoft_graph' }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        console.log(`Test email sent successfully via Microsoft Graph from ${senderEmail}`);
        return new Response(
          JSON.stringify({
            success: true,
            message: `Test ${email_type} email sent to ${recipient_email} via Microsoft Graph`,
            provider: 'microsoft_graph',
            sender: senderEmail,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error("Microsoft Graph error:", error);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: error instanceof Error ? error.message : "Microsoft Graph error",
            provider: 'microsoft_graph'
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // For certificate test with Resend, we need attachments so handle differently
    if (email_type === 'certificate') {
      // Try primary sender first
      const primarySender = "Gift It Forward <giftitforward@dubaiholding.com>";
      const fallbackSender = "Gift It Forward <noreply@mgif.thesurpluss.com>";
      const samplePdf = "JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovQ29udGVudHMgNCAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA0NAo+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjEwMCA3MDAgVGQKKFRlc3QgQ2VydGlmaWNhdGUpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDUKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDE0NyAwMDAwMCBuIAowMDAwMDAwMjI2IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNQovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKMzE5CiUlRU9G";
      
      let emailResponse = await resend.emails.send({
        from: primarySender,
        to: [recipient_email],
        subject: emailSubjects[email_type] || `[TEST] ${email_type} Email`,
        html,
        attachments: [{ filename: "test-certificate.pdf", content: samplePdf }],
      });
      
      if (emailResponse.error) {
        const errorMessage = emailResponse.error?.message || "";
        console.log(`Primary sender failed for certificate: ${errorMessage}`);
        
        if (errorMessage.includes("domain") || errorMessage.includes("not verified") || errorMessage.includes("not found")) {
          console.log(`Retrying certificate email with fallback sender: ${fallbackSender}`);
          emailResponse = await resend.emails.send({
            from: fallbackSender,
            to: [recipient_email],
            subject: emailSubjects[email_type] || `[TEST] ${email_type} Email`,
            html,
            attachments: [{ filename: "test-certificate.pdf", content: samplePdf }],
          });
        }
      }
      
      if (emailResponse.error) {
        console.error("Resend error:", emailResponse.error);
        return new Response(
          JSON.stringify({ success: false, error: emailResponse.error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log(`Test certificate email sent successfully: ${emailResponse.data?.id}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: `Test ${email_type} email sent to ${recipient_email}`,
          id: emailResponse.data?.id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For welcome and survey emails, use the helper with fallback
    const emailResult = await sendEmailWithFallback({
      to: [recipient_email],
      subject: emailSubjects[email_type] || `[TEST] ${email_type} Email`,
      html,
    });

    if (!emailResult.success) {
      console.error("Email send error:", emailResult.error);
      return new Response(
        JSON.stringify({ success: false, error: emailResult.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Test email sent successfully${emailResult.usedFallback ? ' (using fallback sender)' : ''}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Test ${email_type} email sent to ${recipient_email}${emailResult.usedFallback ? ' (using fallback sender)' : ''}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-test-email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
