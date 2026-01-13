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

      // Build family QR sections
      const familyQRSections = familyQRs.map((fam, index) => {
        const famQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(fam.unique_id)}`;
        return `
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; text-align: center; flex: 1; min-width: 140px;">
            <p style="font-weight: 600; margin: 0 0 5px 0; color: #374151;">Family Member ${index + 1}</p>
            <img src="${famQrUrl}" alt="QR Code" style="width: 120px; height: 120px; margin: 0 auto; display: block;" />
            <p style="font-family: monospace; font-size: 11px; margin-top: 8px; color: #6b7280; word-break: break-all;">${fam.unique_id}</p>
          </div>
        `;
      }).join('');

      const familySection = familyQRs.length > 0 ? `
        <div style="background: #f0fdf4; border: 2px solid #86efac; border-radius: 12px; padding: 20px; margin: 25px 0;">
          <h3 style="margin-top: 0; color: #166534;">👨‍👩‍👧‍👦 Family Member QR Cards (${familyQRs.length})</h3>
          <div style="display: flex; flex-wrap: wrap; gap: 15px; justify-content: center;">
            ${familyQRSections}
          </div>
        </div>
      ` : '';

      const emailSubject = familyQRs.length > 0 
        ? `Welcome to GIF - Your Volunteer QR Cards (${1 + familyQRs.length} total)`
        : "Welcome to GIF - Your Volunteer Account & QR Card";

      // Use stored temp password or indicate it needs reset
      const passwordSection = volunteer.temp_password 
        ? `<p style="margin: 8px 0;"><strong>Temporary Password:</strong> <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${volunteer.temp_password}</code></p>`
        : `<p style="margin: 8px 0; color: #b45309;"><strong>Password:</strong> Please use the "Forgot Password" link to reset your password.</p>`;

      const { error: emailError } = await resend.emails.send({
        from: "Surpluss Volunteers <noreply@mgif.thesurpluss.com>",
        to: [volunteer.email],
        subject: `[Resent] ${emailSubject}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Gift It Forward!</h1>
            </div>
            
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
              <p style="font-size: 18px; margin-top: 0;">Hi ${volunteer.first_name},</p>
              
              <p>Great news! Your volunteer registration has been confirmed. Here's everything you need to get started:</p>
              
              <div style="background: white; border: 2px solid #10b981; border-radius: 12px; padding: 20px; margin: 25px 0; text-align: center;">
                <h3 style="margin-top: 0; color: #059669;">🎫 Your Volunteer QR Card</h3>
                <p style="color: #6b7280; font-size: 14px; margin-bottom: 15px;">Present this QR code when checking in at marketplace events</p>
                <img src="${qrCodeUrl}" alt="Your Volunteer QR Code" style="width: 180px; height: 180px; margin: 0 auto; display: block;" />
                <p style="font-family: monospace; font-size: 14px; margin-top: 10px; color: #374151; background: #f3f4f6; padding: 8px; border-radius: 6px;">${primaryQR}</p>
              </div>
              
              ${familySection}
              
              <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h3 style="margin-top: 0; color: #b45309;">📚 Required: Complete Training Module</h3>
                <p style="margin-bottom: 15px; color: #92400e;">Before your first volunteer session, please complete our training module.</p>
                <div style="text-align: center;">
                  <a href="${trainingUrl}" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">Start Training</a>
                </div>
              </div>
              
              <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h3 style="margin-top: 0; color: #059669;">🔐 Your Login Credentials</h3>
                <p style="margin: 8px 0;"><strong>Email:</strong> ${volunteer.email}</p>
                ${passwordSection}
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${loginUrl}" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Log In Now</a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px;">For security, please change your password after your first login.</p>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
              
              <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">
                Thank you for joining our volunteer community!<br>
                <strong>The GIF (Gift It Forward) Team</strong>
              </p>
            </div>
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
