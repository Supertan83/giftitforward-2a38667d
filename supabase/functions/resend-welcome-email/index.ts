import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface ResendEmailRequest {
  pending_volunteer_id: string;
  email_type: string;
  force_resend?: boolean;
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { pending_volunteer_id, email_type }: ResendEmailRequest = await req.json();

    if (!pending_volunteer_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'pending_volunteer_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch volunteer data
    const { data: volunteer, error: volunteerError } = await supabase
      .from('pending_volunteers')
      .select('*')
      .eq('id', pending_volunteer_id)
      .maybeSingle();

    if (volunteerError || !volunteer) {
      return new Response(
        JSON.stringify({ success: false, error: 'Volunteer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch volunteer's QR cards
    const { data: qrCards } = await supabase
      .from('volunteer_qr_cards')
      .select('unique_id, status')
      .eq('volunteer_id', pending_volunteer_id)
      .order('created_at', { ascending: true });

    const primaryQR = qrCards?.[0]?.unique_id || 'N/A';
    const familyQRs = qrCards?.slice(1) || [];

    // Handle different email types
    if (email_type === 'welcome') {
      const appUrl = 'https://gif.thesurpluss.com';
      const loginUrl = `${appUrl}/auth`;
      const trainingUrl = `${appUrl}/training`;
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(primaryQR)}`;
      const trackingPixelUrl = `${supabaseUrl}/functions/v1/email-tracker?id=${pending_volunteer_id}`;

      // Email assets URLs
      const heroImageUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/gif-hero-banner.jpg`;
      const trainingImageUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/training-module-banner.jpg`;
      const dubaiHoldingLogoUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/dubai-holding-logo.png`;

      // Build family QR sections
      const familyQRSections = familyQRs.map((fam, index) => {
        const famQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(fam.unique_id)}`;
        return `
          <tr>
            <td style="padding: 10px; text-align: center;">
              <p style="font-weight: 600; margin: 0 0 5px 0; color: #374151; font-family: Arial, sans-serif;">Family Member ${index + 1}</p>
              <img src="${famQrUrl}" alt="QR Code" width="120" height="120" style="display: block; margin: 0 auto;" />
              <p style="font-family: monospace; font-size: 11px; margin-top: 8px; color: #6b7280;">${fam.unique_id}</p>
            </td>
          </tr>
        `;
      }).join('');

      const familySection = familyQRs.length > 0 ? `
        <tr>
          <td style="padding: 20px 30px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background: #f0fdf4; border: 2px solid #86efac; border-radius: 8px;">
              <tr>
                <td style="padding: 20px;">
                  <h3 style="margin: 0 0 15px 0; color: #166534; font-family: Arial, sans-serif;">Family Member QR Cards (${familyQRs.length})</h3>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    ${familyQRSections}
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      ` : '';

      const emailSubject = "[Resent] Thank you for Registering as a Gift It Forward Volunteer!";

      // Use stored temp password or indicate it needs reset
      const tempPasswordDisplay = volunteer.temp_password || 'Please use "Forgot Password" to reset';

      const { error: emailError } = await resend.emails.send({
        from: "Gift It Forward <giftitforward@dubaiholding.com>",
        to: [volunteer.email],
        subject: emailSubject,
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
                          Thank you for Registering as a<br>Gift It Forward Volunteer!
                        </h1>
                      </td>
                    </tr>
                    
                    <!-- Greeting -->
                    <tr>
                      <td style="padding: 0 30px 15px 30px;">
                        <p style="margin: 0; font-size: 15px; color: #333333;"><strong>Dear ${volunteer.first_name},</strong></p>
                      </td>
                    </tr>
                    
                    <!-- Intro Text -->
                    <tr>
                      <td style="padding: 0 30px 15px 30px;">
                        <p style="margin: 0; font-size: 14px; color: #333333; line-height: 1.6;">
                          Thank you for registering as a Gift It Forward Volunteer. We're delighted to have you join us on the <strong>19th of February</strong> at the <strong>Ajman, Al Hamidya</strong> and <strong>Boys' Community School Marketplace</strong>.
                        </p>
                      </td>
                    </tr>
                    
                    <tr>
                      <td style="padding: 0 30px 20px 30px;">
                        <p style="margin: 0; font-size: 14px; color: #333333; line-height: 1.6;">
                          Your volunteer registration has been successfully confirmed.<br>Below are the key details you'll need to prepare for your volunteering experience:
                        </p>
                      </td>
                    </tr>
                    
                    <!-- QR Code Section -->
                    <tr>
                      <td style="padding: 0 30px 10px 30px;">
                        <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #1a1a1a; font-weight: bold;">Your Volunteer QR Code - <span style="color: #DA291C;">Don't forget to bring this with you.</span></h3>
                        <p style="margin: 0 0 15px 0; font-size: 13px; color: #333333; line-height: 1.5;">
                          Please keep this QR code handy. It will be scanned at both check-in and check-out at each marketplace you attend. This allows us to record your attendance and issue your volunteer certificate.
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
                        <p style="margin: 0; font-size: 12px; color: #666666;">QR Card ID: ${primaryQR}</p>
                      </td>
                    </tr>
                    
                    ${familySection}
                    
                    <!-- Training Section -->
                    <tr>
                      <td style="padding: 0 30px 25px 30px;">
                        <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb;">
                          <tr>
                            <td width="50%" valign="top">
                              <img src="${trainingImageUrl}" alt="Your Role in the Circular Economy" width="270" style="display: block; width: 100%; height: auto;" />
                            </td>
                            <td width="50%" valign="top" style="padding: 20px;">
                              <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #1a1a1a; font-weight: bold;">Complimentary Circular Economy Training</h3>
                              <p style="margin: 0 0 15px 0; font-size: 13px; color: #333333; line-height: 1.5;">
                                Before attending your first marketplace, we encourage all volunteers to complete a short circular economy training. It introduces the campaign's sustainability goals and highlights how your actions contribute to reducing waste and creating impact.
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
                        <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #1a1a1a; font-weight: bold;">On-site Marketplace Access</h3>
                        <p style="margin: 0 0 15px 0; font-size: 13px; color: #333333; line-height: 1.5;">
                          During the marketplace, you may be asked to use the Gift It Forward marketplace management platform via your web browser, which supports on-site activities such as inventory tracking and beneficiary flow, depending on your assigned role.
                        </p>
                        <p style="margin: 0 0 5px 0; font-size: 13px; color: #333333;">Your login credentials are as follows:</p>
                      </td>
                    </tr>
                    
                    <tr>
                      <td style="padding: 0 30px 5px 30px;">
                        <p style="margin: 0; font-size: 13px; color: #333333;">Email: [${volunteer.email}]</p>
                      </td>
                    </tr>
                    
                    <tr>
                      <td style="padding: 0 30px 15px 30px;">
                        <p style="margin: 0; font-size: 13px; color: #333333;">Temporary Password: [${tempPasswordDisplay}]</p>
                      </td>
                    </tr>
                    
                    <tr>
                      <td style="padding: 0 30px 25px 30px;">
                        <a href="${loginUrl}" style="display: inline-block; background-color: #DA291C; color: #ffffff; padding: 10px 20px; text-decoration: none; font-size: 13px; font-weight: 600; border-radius: 4px;">Login to the Marketplace</a>
                      </td>
                    </tr>
                    
                    <!-- What's Next Section -->
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
            <img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />
          </body>
          </html>
        `,
      });

      if (emailError) {
        // Log failed attempt
        await supabase.from('email_send_logs').insert({
          pending_volunteer_id,
          email_type: 'welcome',
          provider: 'resend_retry',
          recipient_email: volunteer.email,
          success: false,
          error_message: emailError.message,
          request_payload: { to: volunteer.email, subject: emailSubject },
          response_data: { error: emailError.message }
        });

        return new Response(
          JSON.stringify({ success: false, error: emailError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log successful attempt
      await supabase.from('email_send_logs').insert({
        pending_volunteer_id,
        email_type: 'welcome',
        provider: 'resend_retry',
        recipient_email: volunteer.email,
        success: true,
        error_message: null,
        request_payload: { to: volunteer.email, subject: emailSubject },
        response_data: { status: 'sent' }
      });

      // Update volunteer email status
      await supabase
        .from('pending_volunteers')
        .update({
          email_sent: true,
          email_sent_at: new Date().toISOString(),
          email_send_count: (volunteer.email_send_count || 0) + 1
        })
        .eq('id', pending_volunteer_id);

      console.log(`Successfully resent welcome email to ${volunteer.email}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email resent successfully',
          provider: 'resend_retry',
          recipient: volunteer.email
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Unsupported email type: ${email_type}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in resend-welcome-email:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
