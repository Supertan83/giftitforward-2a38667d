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

// Format time from HH:MM:SS to readable format
function formatTime(time: string | null): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

// Format date to readable format
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

// Generate QR code URL
function generateQRCodeUrl(qrCodeId: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeId)}`;
}

// Build email HTML content
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

  let marketplaceSection = '';
  if (marketplace) {
    const eventDate = formatDate(marketplace.event_date);
    const startTime = formatTime(marketplace.start_time);
    const endTime = formatTime(marketplace.end_time);
    const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : (startTime || endTime || 'TBD');

    marketplaceSection = `
      <div style="background-color: #f0f9f4; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #166534; margin: 0 0 10px 0;">📍 Event Details</h3>
        <p style="margin: 5px 0;"><strong>Event:</strong> ${marketplace.name}</p>
        <p style="margin: 5px 0;"><strong>Date:</strong> ${eventDate || 'TBD'}</p>
        <p style="margin: 5px 0;"><strong>Time:</strong> ${timeRange}</p>
        ${marketplace.location ? `<p style="margin: 5px 0;"><strong>Location:</strong> ${marketplace.location}</p>` : ''}
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="https://zrzlzggixuogpxberdxt.supabase.co/storage/v1/object/public/email-assets/dubai-holding-logo.png" alt="Dubai Holding" style="max-width: 200px; height: auto;">
      </div>
      
      <h1 style="color: #166534; text-align: center;">Welcome to Gift It Forward! 🎁</h1>
      
      <p>Dear ${firstName} ${lastName},</p>
      
      <p>Thank you for registering as a volunteer with <strong>Gift It Forward</strong>! We're excited to have you join our community of dedicated volunteers making a difference.</p>
      
      ${marketplaceSection}
      
      <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #92400e; margin: 0 0 10px 0;">🔐 Your Login Credentials</h3>
        <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
        <p style="margin: 5px 0;"><strong>Temporary Password:</strong> ${tempPassword}</p>
        <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Please change your password after your first login.</p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <h3 style="color: #166534;">Your Volunteer QR Code</h3>
        <p>Present this QR code when checking in at the event:</p>
        <img src="${qrCodeUrl}" alt="Volunteer QR Code" style="width: 200px; height: 200px; border: 2px solid #166534; border-radius: 8px;">
        <p style="font-size: 12px; color: #666; margin-top: 10px;">QR Code ID: ${qrCodeId}</p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <h3 style="color: #166534;">📚 Complete Your Training</h3>
        <p>Before participating, please complete the volunteer training module:</p>
        <a href="${trainingUrl}" style="display: inline-block; background-color: #166534; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Start Training</a>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${loginUrl}" style="display: inline-block; background-color: #0284c7; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Login to Your Account</a>
      </div>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      
      <p style="text-align: center; color: #666; font-size: 14px;">
        If you have any questions, please don't hesitate to reach out.<br>
        Thank you for volunteering with Gift It Forward!
      </p>
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
      'Welcome to Gift It Forward - Your Volunteer Account',
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
