import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendTestEmailRequest {
  email_type: 'welcome' | 'survey' | 'certificate';
  recipient_email: string;
  test_mode: boolean;
}

// Generate branded email HTML template
function generateEmailHTML(emailType: string, firstName: string, supabaseUrl: string): string {
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
                      Thank you for Registering as a<br>Gift It Forward Volunteer!
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
                      Thank you for registering as a Gift It Forward Volunteer. We're delighted to have you join us. Your volunteer registration has been successfully confirmed.
                    </p>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 0 30px 20px 30px;">
                    <p style="margin: 0; font-size: 14px; color: #333333; line-height: 1.6;">
                      Below are the key details you'll need to prepare for your volunteering experience:
                    </p>
                  </td>
                </tr>
                
                <!-- QR Code Section -->
                <tr>
                  <td style="padding: 0 30px 10px 30px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #1a1a1a; font-weight: bold;">Your Volunteer QR Code</h3>
                    <p style="margin: 0 0 15px 0; font-size: 13px; color: #333333; line-height: 1.5;">
                      Please keep this QR code handy. It will be scanned at both check-in and check-out at each marketplace you attend.
                    </p>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 0 30px 10px 30px;">
                    <img src="${qrCodeUrl}" alt="Volunteer QR Code" width="150" height="150" style="display: block;" />
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 0 30px 25px 30px;">
                    <p style="margin: 0; font-size: 12px; color: #666666;">QR Card ID: VOL-TEST-1234</p>
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
                          <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #1a1a1a; font-weight: bold;">Mandatory Sustainability Training</h3>
                          <p style="margin: 0 0 15px 0; font-size: 13px; color: #333333; line-height: 1.5;">
                            Before attending your first marketplace, all volunteers are required to complete a short sustainability training.
                          </p>
                          <a href="https://gif.thesurpluss.com/training" style="display: inline-block; background-color: #0D4A6F; color: #ffffff; padding: 10px 20px; text-decoration: none; font-size: 13px; font-weight: 600; border-radius: 4px;">Start Training</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Login Credentials -->
                <tr>
                  <td style="padding: 0 30px 10px 30px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #1a1a1a; font-weight: bold;">On-site Marketplace App Access</h3>
                    <p style="margin: 0 0 10px 0; font-size: 13px; color: #333333;">Your login credentials are as follows:</p>
                    <p style="margin: 0; font-size: 13px; color: #333333;">Email: test@example.com</p>
                    <p style="margin: 0; font-size: 13px; color: #333333;">Temporary Password: TestPass123!</p>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 15px 30px 25px 30px;">
                    <a href="https://gif.thesurpluss.com/auth" style="display: inline-block; background-color: #B8860B; color: #ffffff; padding: 10px 20px; text-decoration: none; font-size: 13px; font-weight: 600; border-radius: 4px;">Login to the App</a>
                  </td>
                </tr>
                
                <!-- What's Next -->
                <tr>
                  <td style="padding: 0 30px 20px 30px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #1a1a1a; font-weight: bold;">What's Next?</h3>
                    <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #333333; line-height: 1.8;">
                      <li>Mark your calendar</li>
                      <li>Look out for reminder emails and WhatsApp notifications closer to each event</li>
                      <li>If you have any questions, please contact <a href="mailto:giftitforward@dubaiholding.com" style="color: #0D4A6F;">giftitforward@dubaiholding.com</a></li>
                    </ul>
                  </td>
                </tr>
                
                <!-- Closing -->
                <tr>
                  <td style="padding: 0 30px 20px 30px;">
                    <p style="margin: 0 0 15px 0; font-size: 13px; color: #333333; line-height: 1.5;">
                      Thank you for being part of this meaningful initiative. We look forward to welcoming you on-site.
                    </p>
                    <p style="margin: 0 0 3px 0; font-size: 13px; color: #333333;">Best Regards,</p>
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

    const { email_type, recipient_email, test_mode }: SendTestEmailRequest = await req.json();

    if (!email_type || !recipient_email) {
      return new Response(
        JSON.stringify({ success: false, error: "email_type and recipient_email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending test ${email_type} email to ${recipient_email}`);

    const firstName = "Test Volunteer";
    const emailSubjects: Record<string, string> = {
      welcome: "[TEST] Thank you for Registering as a Gift It Forward Volunteer!",
      survey: "[TEST] Thank You for Volunteering! Share Your Feedback",
      certificate: "[TEST] Your Circular Economy Training Certificate",
    };

    const html = generateEmailHTML(email_type, firstName, supabaseUrl);

    // For certificate test, we need attachments so handle differently
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
