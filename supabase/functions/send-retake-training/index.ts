import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendRetakeTrainingRequest {
  volunteerId: string;
  firstName: string;
  lastName: string;
  email: string;
  isReminder?: boolean; // If true, only send email without resetting training status
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized", success: false }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized", success: false }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      console.error("Role check failed:", roleError);
      return new Response(
        JSON.stringify({ error: "Admin access required", success: false }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { volunteerId, firstName, lastName, email, isReminder }: SendRetakeTrainingRequest = await req.json();

    const cleanFirstName = (firstName || '').trim();
    const cleanLastName = (lastName || '').trim();
    const cleanEmail = (email || '').trim();

    console.log(`${isReminder ? 'Sending training reminder' : 'Sending retake training'} email to ${cleanEmail} for ${cleanFirstName} ${cleanLastName}`);

    if (!cleanFirstName || !cleanEmail || !volunteerId) {
      console.error("Missing required fields:", { firstName: cleanFirstName, email: cleanEmail, volunteerId });
      return new Response(
        JSON.stringify({ error: "Missing required fields", success: false }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Only reset training status if this is NOT a reminder
    if (!isReminder) {
      const { error: updateError } = await supabase
        .from("pending_volunteers")
        .update({
          training_completed: false,
          training_completed_at: null,
          certificate_sent_at: null,
        })
        .eq("id", volunteerId);

      if (updateError) {
        console.error("Error resetting training status:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to reset training status", success: false }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Production URL for the training page
    const appUrl = "https://gif.thesurpluss.com/training";

    console.log(`Training URL: ${appUrl}`);

    const emailSubject = isReminder 
      ? "Reminder: Complete Your Circular Economy Training" 
      : "Retake Your Circular Economy Training";

    const emailHeading = isReminder 
      ? "Training Reminder" 
      : "Training Refresh Required";

    const emailMessage = isReminder
      ? `This is a friendly reminder to complete your <span class="highlight">Circular Economy Training Module</span>.`
      : `Your training status has been reset and you're invited to <span class="highlight">retake the Circular Economy Training Module</span>.`;

    const emailResponse = await resend.emails.send({
      from: "GIF Volunteer Training <noreply@mgif.thesurpluss.com>",
      to: [cleanEmail],
      subject: emailSubject,
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
            .button { display: inline-block; background: #DA291C; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: #DA291C;">${emailHeading}</h1>
            </div>
            <div class="content">
              <p>Hello ${cleanFirstName},</p>
              <p>${emailMessage}</p>
              <p>This is a great opportunity to ${isReminder ? 'learn about' : 'refresh your knowledge of'} circular economy principles and your role as a Gift It Forward volunteer.</p>
              <p style="text-align: center;">
                <a href="${appUrl}" class="button" style="color: white;">Start Training</a>
              </p>
              <p>Once you complete the training and quiz, you'll receive a certificate.</p>
              <p>If you have any questions, please contact the volunteer coordination team.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Surpluss. All rights reserved.</p>
              <p>Gift It Forward 2026</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Retake training email sent:", emailResponse);

    if (emailResponse.error) {
      console.error("Resend error:", emailResponse.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: emailResponse.error.message || "Email sending failed",
          trainingReset: true,
          details: "Training status was reset but email failed to send"
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: emailResponse.data?.id, trainingReset: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-retake-training function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Unknown error occurred" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
