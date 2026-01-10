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
}

interface EmailConfig {
  email_type: string;
  template_id: string | null;
  enabled: boolean;
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
    const { firstName, lastName, email, certificateBase64 }: SendCertificateRequest = await req.json();

    // Trim whitespace from names
    const cleanFirstName = (firstName || '').trim();
    const cleanLastName = (lastName || '').trim();
    const cleanEmail = (email || '').trim();

    console.log(`Sending certificate to ${cleanEmail} for ${cleanFirstName} ${cleanLastName}`);

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

    const fullName = cleanLastName ? `${cleanFirstName} ${cleanLastName}` : cleanFirstName;
    const filename = `certificate-${fullName.replace(/\s+/g, '-').toLowerCase()}.pdf`;

    // Check email configuration
    const emailConfig = await getEmailConfig('certificate');
    const useHubSpot = emailConfig?.enabled && emailConfig?.template_id && HUBSPOT_API_KEY;

    // Note: HubSpot doesn't support attachments, so we always use Resend for certificate emails
    // But if HubSpot is configured, we can still send a notification via HubSpot
    // For now, we'll use Resend when there's an attachment, regardless of config
    
    if (useHubSpot) {
      console.log('Note: HubSpot is configured for certificate emails, but attachments require Resend');
      console.log('Falling back to Resend for certificate email with PDF attachment');
    }

    console.log(`Attempting to send email to ${cleanEmail} with filename ${filename}`);

    const emailResponse = await resend.emails.send({
      from: "GIF Volunteer Training <noreply@mgif.thesurpluss.com>",
      to: [cleanEmail],
      subject: "Your Circular Economy Training Certificate",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 10px; }
            .highlight { color: #DA291C; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: #DA291C;">Congratulations, ${cleanFirstName}!</h1>
            </div>
            <div class="content">
              <p>You've successfully completed the <span class="highlight">Circular Economy Training Module</span>.</p>
              <p>Your certificate of completion is attached to this email. This certificate recognizes your commitment to understanding circular economy principles and your role as a Gift It Forward volunteer.</p>
              <h3>What You've Learned:</h3>
              <ul>
                <li>The fundamentals of the Circular Economy</li>
                <li>How Gift It Forward redistributes surplus items</li>
                <li>The impact of avoided emissions</li>
                <li>Your role as a Circular Economy advocate</li>
              </ul>
              <p>Thank you for being part of this important initiative. Together, we're making a positive impact on communities and the environment.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Surpluss. All rights reserved.</p>
              <p>Gift It Forward 2026</p>
            </div>
          </div>
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
