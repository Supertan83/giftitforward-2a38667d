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

interface CustomTemplateData {
  subject: string;
  greeting: string;
  body_sections: Array<{ type: string; content: string }>;
  cta_text?: string | null;
  cta_url?: string | null;
}

interface SendTestEmailRequest {
  email_type: 'welcome' | 'survey' | 'certificate' | 'custom_template';
  recipient_email: string;
  test_mode: boolean;
  provider?: 'resend' | 'microsoft_graph';
  volunteer_data?: VolunteerData;
  custom_template?: CustomTemplateData;
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
  const loginUrl = "https://giftitforward.lovable.app/auth";
  const trainingUrl = "https://giftitforward.lovable.app/training";

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
      <td style="padding: 20px 40px; border-top: 1px solid #e5e7eb;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="50%" valign="middle">
              <img src="${dubaiHoldingLogoUrl}" alt="Dubai Holding" height="40" style="display: block;" />
            </td>
            <td width="50%" valign="middle" style="text-align: right;">
              <p style="margin: 0; font-size: 13px; color: #54585A; font-style: italic;">For the Good of Tomorrow</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  if (emailType === 'welcome') {
    // Get marketplace details from volunteer data or use defaults
    const marketplaceDate = volunteerData?.marketplace_date 
      ? new Date(volunteerData.marketplace_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'February 19, 2026';
    const marketplaceLocation = volunteerData?.marketplace_location || 'Ajman, Al Hamidya and Boys\' Community School Marketplace.';
    const marketplaceTime = volunteerData?.marketplace_time || '07.00 am - 01.30 pm';
    const testEmail = volunteerData?.first_name ? `${volunteerData.first_name.toLowerCase()}@thesurpluss.com` : 'test@thesurpluss.com';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${baseStyles}
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
                
                <!-- Red Vertical Line -->
                <tr>
                  <td style="padding: 25px 0 0 0; text-align: center;">
                    <div style="width: 2px; height: 30px; background-color: #DA291C; margin: 0 auto;"></div>
                  </td>
                </tr>
                
                <!-- Main Title -->
                <tr>
                  <td style="padding: 20px 40px 25px 40px; text-align: center;">
                    <h1 style="margin: 0; font-size: 26px; color: #5D5348; font-weight: normal; line-height: 1.4; font-family: Georgia, 'Times New Roman', serif;">
                      Thank you for registering<br>as a Gift It Forward volunteer
                    </h1>
                  </td>
                </tr>
                
                <!-- Greeting -->
                <tr>
                  <td style="padding: 0 40px 12px 40px;">
                    <p style="margin: 0; font-size: 14px; color: #1a1a1a;"><strong>Dear [Volunteer Name],</strong></p>
                  </td>
                </tr>
                
                <!-- Intro Text -->
                <tr>
                  <td style="padding: 0 40px 15px 40px;">
                    <p style="margin: 0; font-size: 13px; color: #333333; line-height: 1.6;">
                      Your volunteer registration has been <strong>successfully confirmed</strong> for the <strong>Gift It Forward marketplace</strong> taking place on:
                    </p>
                  </td>
                </tr>
                
                <!-- Event Details -->
                <tr>
                  <td style="padding: 0 40px 18px 40px;">
                    <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #333333; line-height: 1.9;">
                      <li><strong>Date:</strong> ${marketplaceDate}</li>
                      <li><strong>Location:</strong> ${marketplaceLocation}</li>
                      <li><strong>Timings:</strong> ${marketplaceTime}</li>
                    </ul>
                  </td>
                </tr>
                
                <!-- Helpful Reminders Intro -->
                <tr>
                  <td style="padding: 0 40px 8px 40px;">
                    <p style="margin: 0; font-size: 13px; color: #333333;">Here are a few helpful reminders before the event:</p>
                  </td>
                </tr>
                
                <!-- Helpful Reminders List -->
                <tr>
                  <td style="padding: 0 40px 20px 55px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px; color: #333333;">
                      <tr>
                        <td style="padding: 3px 0; line-height: 1.5;">
                          <strong>a. Arrival:</strong> Gates open 15 minutes before the marketplace begins. We recommend arriving a bit early to allow time for a smooth check-in.
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 3px 0; line-height: 1.5;">
                          <strong>b. Your QR code:</strong> Please have your QR code ready on your phone - it helps us clock you in and out quickly.
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 3px 0; line-height: 1.5;">
                          <strong>c. Bring this email:</strong> Having this confirmation handy will help us welcome you at the venue without any delays.
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 3px 0; line-height: 1.5;">
                          <strong>d. Your registration:</strong> This registration is linked to your name, so please make sure you're the one attending.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- QR Code Section Header -->
                <tr>
                  <td style="padding: 0 40px 5px 40px;">
                    <p style="margin: 0; font-size: 14px; color: #1a1a1a; font-weight: bold;">Your volunteer QR code</p>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 0 40px 15px 40px;">
                    <p style="margin: 0; font-size: 13px; color: #333333; line-height: 1.5;">
                      We recommend saving it on your phone and keeping a screenshot available offline.
                    </p>
                  </td>
                </tr>
                
                <!-- QR Code -->
                <tr>
                  <td style="padding: 0 40px 8px 40px;">
                    <img src="${qrCodeUrl}" alt="Volunteer QR Code" width="130" height="130" style="display: block;" />
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 0 40px 12px 40px;">
                    <p style="margin: 0; font-size: 12px; color: #666666;">QR Card ID: {{ custom.qr_card_id }}</p>
                  </td>
                </tr>
                
                <!-- QR Code Benefits -->
                <tr>
                  <td style="padding: 0 40px 25px 40px;">
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #1a1a1a; font-weight: bold;">Your QR code allows you to:</p>
                    <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #333333; line-height: 1.8;">
                      <li>Record your attendance.</li>
                      <li>Track volunteer hours.</li>
                      <li>Receive your official <strong>Gift It Forward 2026 volunteer certificate</strong>.</li>
                    </ul>
                  </td>
                </tr>
                
                <!-- Login Credentials Section - Gray Background -->
                <tr>
                  <td style="padding: 0 40px 0 40px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
                      <tr>
                        <td style="padding: 20px 25px 15px 25px; text-align: center;">
                          <p style="margin: 0; font-size: 14px; color: #1a1a1a; text-decoration: underline; font-weight: bold;">Your login credentials for the training & marketplace platform</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 25px 12px 25px;">
                          <p style="margin: 0; font-size: 13px; color: #333333; line-height: 1.6;">
                            You'll need these details to complete the <strong>Circular Economy Training Module</strong> and <strong>access the marketplace platform</strong> on event day:
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 25px 5px 25px;">
                          <p style="margin: 0; font-size: 13px; color: #333333;"><strong>Email:</strong> ${testEmail}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 25px 12px 25px;">
                          <p style="margin: 0; font-size: 13px; color: #333333;"><strong>Temporary Password:</strong> Abc123!@#xyz</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 25px 20px 25px;">
                          <p style="margin: 0; font-size: 13px; color: #DA291C; font-weight: bold;">Please save these credentials - you'll need them to start the training below.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Divider Line -->
                <tr>
                  <td style="padding: 25px 40px;">
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 0;" />
                  </td>
                </tr>
                
                <!-- Training Section -->
                <tr>
                  <td style="padding: 0 40px 25px 40px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="45%" valign="top" style="padding-right: 20px;">
                          <img src="${trainingImageUrl}" alt="Your Role in the Circular Economy" width="230" style="display: block; width: 100%; height: auto; border: 1px solid #e5e7eb;" />
                        </td>
                        <td width="55%" valign="top">
                          <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #1a1a1a; font-weight: bold;">Circular Economy Training Module</h3>
                          <p style="margin: 0 0 18px 0; font-size: 13px; color: #333333; line-height: 1.55;">
                            Before attending your first marketplace, we encourage volunteers to complete this short module. It introduces the campaign's sustainability goals and highlights how actions contribute to reducing waste. Volunteers who complete the training receive a certificate of completion.
                          </p>
                          <a href="${trainingUrl}" style="display: inline-block; background-color: #C5B9AC; color: #ffffff; padding: 12px 24px; text-decoration: none; font-size: 13px; font-weight: 600; border-radius: 0;">Start Training</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Divider Line -->
                <tr>
                  <td style="padding: 0 40px 20px 40px;">
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 0;" />
                  </td>
                </tr>
                
                <!-- On-site Marketplace Access -->
                <tr>
                  <td style="padding: 0 40px 8px 40px;">
                    <p style="margin: 0; font-size: 14px; color: #1a1a1a; font-weight: bold;">On-site marketplace access</p>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 0 40px 15px 40px;">
                    <p style="margin: 0; font-size: 13px; color: #333333; line-height: 1.55;">
                      During the marketplace, you may be asked to use the Gift It Forward marketplace management platform via your web browser, which supports on-site activities such as inventory tracking and beneficiary flow, depending on your assigned role.
                    </p>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 0 40px 25px 40px;">
                    <a href="${loginUrl}" style="display: inline-block; background-color: #DA291C; color: #ffffff; padding: 12px 24px; text-decoration: none; font-size: 13px; font-weight: 600; border-radius: 0;">Login to the platform</a>
                  </td>
                </tr>
                
                <!-- What's Next Section -->
                <tr>
                  <td style="padding: 0 40px 8px 40px;">
                    <p style="margin: 0; font-size: 14px; color: #1a1a1a; font-weight: bold;">What's next?</p>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 0 40px 20px 40px;">
                    <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #333333; line-height: 1.8;">
                      <li>Save this event to your calendar.</li>
                      <li>Look out for reminder emails and WhatsApp notifications closer to each event.</li>
                      <li>If you have any questions, please contact <a href="mailto:giftitforward@dubaiholding.com" style="color: #333333;">giftitforward@dubaiholding.com</a>.</li>
                      <li>If you or a family member have any specific medical conditions, please contact The Surpluss team ahead of the event so we can ensure a safe and supportive volunteering experience. You can reach the team at <strong><a href="mailto:giftitforward@dubaiholding.com" style="color: #333333;">giftitforward@dubaiholding.com</a></strong>.</li>
                    </ul>
                  </td>
                </tr>
                
                <!-- Closing -->
                <tr>
                  <td style="padding: 0 40px 25px 40px;">
                    <p style="margin: 0 0 15px 0; font-size: 13px; color: #333333; line-height: 1.55;">
                      Thank you for being part of this meaningful initiative. We look forward to welcoming you on-site.
                    </p>
                    <p style="margin: 0 0 3px 0; font-size: 13px; color: #333333;">Best regards,</p>
                    <p style="margin: 0; font-size: 13px; color: #1a1a1a; font-weight: bold;">Gift It Forward team</p>
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

// Generate branded HTML from a custom template with token replacement
function generateCustomTemplateHTML(template: CustomTemplateData, supabaseUrl: string, volunteerData?: VolunteerData): string {
  const heroImageUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/gif-hero-banner.jpg`;
  const dubaiHoldingLogoUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/dubai-holding-logo.png`;

  // Token replacement map
  const tokens: Record<string, string> = {
    '{{first_name}}': volunteerData?.first_name || 'Test',
    '{{last_name}}': volunteerData?.last_name || 'Volunteer',
    '{{full_name}}': volunteerData?.name || `${volunteerData?.first_name || 'Test'} ${volunteerData?.last_name || 'Volunteer'}`,
    '{{email}}': volunteerData?.first_name ? `${volunteerData.first_name.toLowerCase()}@example.com` : 'test@example.com',
    '{{phone}}': volunteerData?.phone || '+971 50 123 4567',
    '{{marketplace_name}}': volunteerData?.marketplace_name || 'GIF Marketplace',
    '{{marketplace_date}}': volunteerData?.marketplace_date || 'TBD',
    '{{marketplace_time}}': volunteerData?.marketplace_time || 'TBD',
    '{{marketplace_location}}': volunteerData?.marketplace_location || 'TBD',
    '{{qr_card_id}}': 'VOL-TEST-1234',
    '{{login_url}}': 'https://giftitforward.lovable.app/auth',
    '{{training_url}}': 'https://giftitforward.lovable.app/training',
    '{{current_date}}': new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  };

  const replaceTokens = (text: string): string => {
    let result = text;
    for (const [token, value] of Object.entries(tokens)) {
      result = result.replaceAll(token, value);
    }
    return result;
  };

  // Build body sections HTML
  let bodySectionsHtml = '';
  for (const section of template.body_sections) {
    const content = replaceTokens(section.content || '');
    if (section.type === 'paragraph') {
      bodySectionsHtml += `<tr><td style="padding: 0 40px 15px 40px;"><p style="margin: 0; font-size: 14px; color: #333333; line-height: 1.6;">${content}</p></td></tr>`;
    } else if (section.type === 'list') {
      const items = content.split('\n').filter(Boolean).map(li => `<li>${li}</li>`).join('');
      bodySectionsHtml += `<tr><td style="padding: 0 40px 15px 40px;"><ul style="margin: 0; padding-left: 18px; font-size: 14px; color: #333333; line-height: 1.8;">${items}</ul></td></tr>`;
    } else if (section.type === 'cta') {
      bodySectionsHtml += `<tr><td style="padding: 10px 40px 15px 40px; text-align: center;"><a href="#" style="display: inline-block; background-color: #DA291C; color: #ffffff; padding: 12px 28px; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 0;">${content}</a></td></tr>`;
    } else if (section.type === 'image' && content) {
      bodySectionsHtml += `<tr><td style="padding: 0 40px 15px 40px;"><img src="${content}" alt="" style="display: block; width: 100%; height: auto;" /></td></tr>`;
    }
  }

  // Optional CTA button
  let ctaHtml = '';
  if (template.cta_text) {
    const ctaUrl = template.cta_url ? replaceTokens(template.cta_url) : '#';
    ctaHtml = `<tr><td style="padding: 10px 40px 20px 40px; text-align: center;"><a href="${ctaUrl}" style="display: inline-block; background-color: #DA291C; color: #ffffff; padding: 12px 28px; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 0;">${replaceTokens(template.cta_text)}</a></td></tr>`;
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
<tr><td style="padding: 10px 40px 20px 40px; text-align: center;"><h1 style="margin: 0; font-size: 24px; color: #5D5348; font-weight: normal; line-height: 1.4; font-family: Georgia, 'Times New Roman', serif;">${replaceTokens(template.subject)}</h1></td></tr>
<tr><td style="padding: 0 40px 15px 40px;"><p style="margin: 0; font-size: 14px; color: #1a1a1a; font-weight: bold;">${replaceTokens(template.greeting)}</p></td></tr>
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

// Helper function to send email via Resend
async function sendEmailWithResend(
  emailOptions: {
    to: string[];
    subject: string;
    html: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const sender = "Gift It Forward <giftitforward@dubaiholding.com>";
  
  console.log(`Sending email from: ${sender}`);
  const result = await resend.emails.send({
    from: sender,
    bcc: ['giftitforward@dubaiholding.com'],
    ...emailOptions,
  });
  
  if (result.error) {
    console.error("Email send failed:", result.error.message);
    return { success: false, error: result.error.message };
  }
  
  console.log("Email sent successfully");
  return { success: true };
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

    const { email_type, recipient_email, test_mode, provider = 'resend', volunteer_data, custom_template }: SendTestEmailRequest = body;

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

    let html: string;
    let subject: string;

    if (email_type === 'custom_template' && custom_template) {
      // Render from custom template
      html = generateCustomTemplateHTML(custom_template, supabaseUrl, volunteer_data);
      subject = `[TEST] ${custom_template.subject.replace(/\{\{[^}]+\}\}/g, 'Test')}`;
      console.log("Using custom template for email");
    } else {
      const emailSubjects: Record<string, string> = {
        welcome: "[TEST] Thank you for registering as a Gift It Forward volunteer",
        survey: "[TEST] Thank You for Volunteering! Share Your Feedback",
        certificate: "[TEST] Your Circular Economy Training Certificate",
      };
      html = generateEmailHTML(email_type, firstName, supabaseUrl, volunteer_data);
      subject = emailSubjects[email_type] || `[TEST] ${email_type} Email`;
    }

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

    // For certificate test with Resend
    if (email_type === 'certificate') {
      const sender = "Gift It Forward <giftitforward@dubaiholding.com>";
      const samplePdf = "JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovQ29udGVudHMgNCAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA0NAo+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjEwMCA3MDAgVGQKKFRlc3QgQ2VydGlmaWNhdGUpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDUKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDE0NyAwMDAwMCBuIAowMDAwMDAwMjI2IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNQovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKMzE5CiUlRU9G";
      
      const emailResponse = await resend.emails.send({
        from: sender,
        to: [recipient_email],
        bcc: ['giftitforward@dubaiholding.com'],
        subject,
        html,
        attachments: [{ filename: "test-certificate.pdf", content: samplePdf }],
      });
      
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

    // For welcome and survey emails
    const emailResult = await sendEmailWithResend({
      to: [recipient_email],
      subject,
      html,
    });

    if (!emailResult.success) {
      console.error("Email send error:", emailResult.error);
      return new Response(
        JSON.stringify({ success: false, error: emailResult.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Test email sent successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Test ${email_type} email sent to ${recipient_email}`,
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
