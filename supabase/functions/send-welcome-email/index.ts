import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WelcomeEmailRequest {
  volunteerId: string;
  email: string;
  firstName: string;
  lastName: string;
  tempPassword: string;
  qrCodeId: string;
  marketplaceId?: string;
}

interface MarketplaceEvent {
  name: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
}

// Get Microsoft Graph API access token using Client Credentials flow
async function getMicrosoftAccessToken(): Promise<string> {
  const tenantId = Deno.env.get('AZURE_TENANT_ID');
  const clientId = Deno.env.get('AZURE_CLIENT_ID');
  const clientSecret = Deno.env.get('AZURE_CLIENT_SECRET');

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Missing Azure AD credentials');
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to get Microsoft access token:', errorText);
    throw new Error(`Failed to get Microsoft access token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Format time from HH:MM:SS to readable format (07.00 am style)
function formatTime(time: string | null | undefined): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'pm' : 'am';
  const hour12 = hour % 12 || 12;
  return `${String(hour12).padStart(2, '0')}.${minutes} ${ampm}`;
}

// Format date to readable format (February 19, 2026)
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric',
    year: 'numeric' 
  });
}

// Generate QR code URL
function generateQRCodeUrl(qrCodeId: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeId)}`;
}

// Build email HTML content - Marketing Approved Design
function buildEmailHtml(
  firstName: string,
  lastName: string,
  email: string,
  tempPassword: string,
  qrCodeId: string,
  marketplace?: MarketplaceEvent | null
): string {
  const qrCodeUrl = generateQRCodeUrl(qrCodeId);
  const loginUrl = 'https://gif.thesurpluss.com/auth';
  const trainingUrl = 'https://gif.thesurpluss.com/training';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  
  // Email assets URLs
  const heroImageUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/gif-hero-banner.jpg`;
  const trainingImageUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/training-module-banner.jpg`;
  const dubaiHoldingLogoUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/dubai-holding-logo.png`;

  // Format marketplace details
  const eventDate = formatDate(marketplace?.event_date);
  const startTime = formatTime(marketplace?.start_time);
  const endTime = formatTime(marketplace?.end_time);
  const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : (startTime || endTime || '');
  const marketplaceName = marketplace?.name || 'Gift It Forward marketplace';
  const marketplaceLocation = marketplace?.location || '';

  return `
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
              
              <!-- Main Title -->
              <tr>
                <td style="padding: 30px 30px 20px 30px; text-align: center;">
                  <h1 style="margin: 0; font-size: 28px; color: #1a1a1a; font-weight: normal; line-height: 1.3;">
                    Thank you for registering<br>as a Gift It Forward volunteer
                  </h1>
                </td>
              </tr>
              
              <!-- Greeting -->
              <tr>
                <td style="padding: 0 30px 15px 30px;">
                  <p style="margin: 0; font-size: 15px; color: #333333;"><strong>Dear [Volunteer Name],</strong></p>
                </td>
              </tr>
              
              <!-- Intro Text -->
              <tr>
                <td style="padding: 0 30px 15px 30px;">
                  <p style="margin: 0; font-size: 14px; color: #333333; line-height: 1.6;">
                    Your volunteer registration has been <strong>successfully confirmed</strong> for the <strong>Gift It Forward marketplace</strong> taking place on:
                  </p>
                </td>
              </tr>
              
              <!-- Event Details -->
              <tr>
                <td style="padding: 0 30px 20px 30px;">
                  <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #333333; line-height: 1.8;">
                    ${eventDate ? `<li><strong>Date:</strong> ${eventDate}</li>` : ''}
                    ${marketplaceLocation ? `<li><strong>Location:</strong> ${marketplaceLocation}</li>` : ''}
                    ${timeRange ? `<li><strong>Timings:</strong> ${timeRange}</li>` : ''}
                  </ul>
                </td>
              </tr>
              
              <!-- Helpful Reminders -->
              <tr>
                <td style="padding: 0 30px 20px 30px;">
                  <p style="margin: 0 0 10px 0; font-size: 14px; color: #333333;">Here are a few helpful reminders before the event:</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding: 5px 0; font-size: 14px; color: #333333; line-height: 1.6;">
                        <strong>a. Arrival:</strong> Gates open 15 minutes before the marketplace begins. We recommend arriving a bit early to allow time for a smooth check-in.
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 5px 0; font-size: 14px; color: #333333; line-height: 1.6;">
                        <strong>b. Your QR code:</strong> Please have your QR code ready on your phone – it helps us clock you in and out quickly.
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 5px 0; font-size: 14px; color: #333333; line-height: 1.6;">
                        <strong>c. Bring this email:</strong> Having this confirmation handy will help us welcome you at the venue without any delays.
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 5px 0; font-size: 14px; color: #333333; line-height: 1.6;">
                        <strong>d. Your registration:</strong> This registration is linked to your name, so please make sure you're the one attending.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- QR Code Section Header -->
              <tr>
                <td style="padding: 0 30px 10px 30px; background-color: #f8f8f8;">
                  <h3 style="margin: 20px 0 10px 0; font-size: 16px; color: #1a1a1a; font-weight: bold;">Your volunteer QR code</h3>
                  <p style="margin: 0 0 15px 0; font-size: 13px; color: #333333; line-height: 1.5;">
                    We recommend saving it on your phone and keeping a screenshot available offline.
                  </p>
                </td>
              </tr>
              
              <!-- QR Code -->
              <tr>
                <td style="padding: 0 30px 10px 30px; background-color: #f8f8f8;">
                  <img src="${qrCodeUrl}" alt="Volunteer QR Code" width="150" height="150" style="display: block;" />
                </td>
              </tr>
              
              <tr>
                <td style="padding: 0 30px 15px 30px; background-color: #f8f8f8;">
                  <p style="margin: 0; font-size: 12px; color: #666666;">QR Card ID: {{ custom.qr_card_id }}</p>
                </td>
              </tr>
              
              <!-- QR Code Benefits -->
              <tr>
                <td style="padding: 0 30px 20px 30px; background-color: #f8f8f8;">
                  <p style="margin: 0 0 8px 0; font-size: 14px; color: #333333; font-weight: bold;">Your QR code allows you to:</p>
                  <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #333333; line-height: 1.8;">
                    <li>Record your attendance.</li>
                    <li>Track volunteer hours.</li>
                    <li>Receive your official <strong>Gift It Forward 2026 volunteer certificate</strong>.</li>
                  </ul>
                </td>
              </tr>
              
              <!-- Login Credentials Section -->
              <tr>
                <td style="padding: 20px 30px 10px 30px; border-top: 2px solid #e5e7eb;">
                  <p style="margin: 0 0 15px 0; font-size: 14px; color: #333333; text-decoration: underline; font-weight: bold;">Your login credentials for the training & marketplace platform</p>
                  <p style="margin: 0 0 10px 0; font-size: 13px; color: #333333; line-height: 1.6;">
                    You'll need these details to complete the <strong>Circular Economy Training Module</strong> and access the <strong>marketplace platform</strong> on event day:
                  </p>
                </td>
              </tr>
              
              <tr>
                <td style="padding: 0 30px 5px 30px;">
                  <p style="margin: 0; font-size: 13px; color: #333333;"><strong>Email:</strong> ${email}</p>
                </td>
              </tr>
              
              <tr>
                <td style="padding: 0 30px 15px 30px;">
                  <p style="margin: 0; font-size: 13px; color: #333333;"><strong>Temporary Password:</strong> ${tempPassword}</p>
                </td>
              </tr>
              
              <tr>
                <td style="padding: 0 30px 25px 30px;">
                  <p style="margin: 0; font-size: 13px; color: #DA291C; font-weight: bold;">Please save these credentials – you'll need them to start the training below.</p>
                </td>
              </tr>
              
              <!-- Training Section -->
              <tr>
                <td style="padding: 0 30px 25px 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb;">
                    <tr>
                      <td width="50%" valign="top">
                        <img src="${trainingImageUrl}" alt="Your Role in the Circular Economy" width="270" style="display: block; width: 100%; height: auto;" />
                      </td>
                      <td width="50%" valign="top" style="padding: 20px;">
                        <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #1a1a1a; font-weight: bold;">Circular Economy Training Module</h3>
                        <p style="margin: 0 0 15px 0; font-size: 13px; color: #333333; line-height: 1.5;">
                          Before attending your first marketplace, we encourage volunteers to complete this short module. It introduces the campaign's sustainability goals and highlights how actions contribute to reducing waste. Volunteers who complete the training receive a certificate of completion.
                        </p>
                        <a href="${trainingUrl}" style="display: inline-block; background-color: #DA291C; color: #ffffff; padding: 10px 20px; text-decoration: none; font-size: 13px; font-weight: 600; border-radius: 4px;">Start Training</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- On-site Marketplace Access -->
              <tr>
                <td style="padding: 0 30px 10px 30px;">
                  <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #1a1a1a; font-weight: bold;">On-site marketplace access</h3>
                  <p style="margin: 0 0 15px 0; font-size: 13px; color: #333333; line-height: 1.5;">
                    During the marketplace, you may be asked to use the Gift It Forward marketplace management platform via your web browser, which supports on-site activities such as inventory tracking and beneficiary flow, depending on your assigned role.
                  </p>
                </td>
              </tr>
              
              <tr>
                <td style="padding: 0 30px 25px 30px;">
                  <a href="${loginUrl}" style="display: inline-block; background-color: #DA291C; color: #ffffff; padding: 10px 20px; text-decoration: none; font-size: 13px; font-weight: 600; border-radius: 4px;">Login to the platform</a>
                </td>
              </tr>
              
              <!-- What's Next Section -->
              <tr>
                <td style="padding: 0 30px 20px 30px;">
                  <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #1a1a1a; font-weight: bold;">What's next?</h3>
                  <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #333333; line-height: 1.8;">
                    <li>Save this event to your calendar.</li>
                    <li>Look out for reminder emails and WhatsApp notifications closer to each event.</li>
                    <li>If you have any questions, please contact <a href="mailto:giftitforward@dubaiholding.com" style="color: #0D4A6F;">giftitforward@dubaiholding.com</a>.</li>
                    <li>If you or a family member have any specific medical conditions, please contact The Surpluss team ahead of the event so we can ensure a safe and supportive volunteering experience. You can reach the team at <a href="mailto:giftitforward@dubaiholding.com" style="color: #0D4A6F;">giftitforward@dubaiholding.com</a>.</li>
                  </ul>
                </td>
              </tr>
              
              <!-- Closing -->
              <tr>
                <td style="padding: 0 30px 20px 30px;">
                  <p style="margin: 0 0 15px 0; font-size: 13px; color: #333333; line-height: 1.5;">
                    Thank you for being part of this meaningful initiative. We look forward to welcoming you on-site.
                  </p>
                  <p style="margin: 0 0 3px 0; font-size: 13px; color: #333333;">Best regards,</p>
                  <p style="margin: 0; font-size: 13px; color: #1a1a1a; font-weight: 600;">Gift It Forward team</p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 20px 30px; border-top: 1px solid #e5e7eb;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="50%" valign="middle">
                        <img src="${dubaiHoldingLogoUrl}" alt="Dubai Holding" height="40" style="display: block;" />
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
  `;
}

// Send email using Microsoft Graph API
async function sendEmailViaMicrosoftGraph(
  accessToken: string,
  senderEmail: string,
  recipientEmail: string,
  subject: string,
  htmlContent: string,
  bccAddress?: string
): Promise<void> {
  const graphUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;

  const emailMessage: any = {
    message: {
      subject: subject,
      body: {
        contentType: 'HTML',
        content: htmlContent,
      },
      toRecipients: [
        {
          emailAddress: {
            address: recipientEmail,
          },
        },
      ],
    },
    saveToSentItems: true,
  };

  // Add BCC recipient if provided
  if (bccAddress) {
    emailMessage.message.bccRecipients = [
      {
        emailAddress: {
          address: bccAddress,
        },
      },
    ];
  }

  const response = await fetch(graphUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailMessage),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to send email via Microsoft Graph:', errorText);
    throw new Error(`Failed to send email: ${response.status} - ${errorText}`);
  }

  console.log('Email sent successfully via Microsoft Graph');
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Parse request body
    let body: WelcomeEmailRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { volunteerId, email, firstName, lastName, tempPassword, qrCodeId, marketplaceId } = body;

    // Validate required fields
    if (!email || !firstName || !lastName || !tempPassword || !qrCodeId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Sending welcome email to ${email} (Volunteer: ${firstName} ${lastName})`);

    // Fetch marketplace details if marketplaceId is provided
    let marketplace: MarketplaceEvent | null = null;
    if (marketplaceId) {
      const { data: marketplaceData, error: marketplaceError } = await supabaseAdmin
        .from('marketplace_events')
        .select('name, event_date, start_time, end_time, location')
        .eq('id', marketplaceId)
        .single();

      if (marketplaceError) {
        console.warn('Failed to fetch marketplace:', marketplaceError.message);
      } else {
        marketplace = marketplaceData;
      }
    }

    // Get Microsoft Graph access token
    const accessToken = await getMicrosoftAccessToken();

    // Get sender email from environment
    const senderEmail = Deno.env.get('SENDER_EMAIL');
    if (!senderEmail) {
      throw new Error('SENDER_EMAIL not configured');
    }

    // Build email content
    const htmlContent = buildEmailHtml(
      firstName,
      lastName,
      email,
      tempPassword,
      qrCodeId,
      marketplace
    );

    // HubSpot BCC address for tracking
    const hubspotBcc = Deno.env.get('HUBSPOT_BCC_ADDRESS') || undefined;

    // Send email via Microsoft Graph
    await sendEmailViaMicrosoftGraph(
      accessToken,
      senderEmail,
      email,
      'Thank you for registering as a Gift It Forward volunteer',
      htmlContent,
      hubspotBcc
    );

    // Log email send
    await supabaseAdmin.from('email_send_logs').insert({
      recipient_email: email,
      email_type: 'welcome_microsoft',
      provider: 'microsoft_graph',
      success: true,
      pending_volunteer_id: volunteerId || null,
      request_payload: { firstName, lastName, qrCodeId, marketplaceId },
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Welcome email sent successfully via Microsoft Graph' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in send-welcome-email:', error);

    // Try to log the error
    try {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      await supabaseAdmin.from('email_send_logs').insert({
        recipient_email: 'unknown',
        email_type: 'welcome_microsoft',
        provider: 'microsoft_graph',
        success: false,
        error_message: error.message,
      });
    } catch (logError) {
      console.error('Failed to log email error:', logError);
    }

    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to send welcome email' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});