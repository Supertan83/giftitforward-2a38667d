import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendSurveyRequest {
  volunteerCardId: string;
  volunteerId?: string;
  volunteerName: string;
  volunteerEmail: string;
  marketplaceId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      volunteerCardId,
      volunteerId,
      volunteerName,
      volunteerEmail,
      marketplaceId,
    }: SendSurveyRequest = await req.json();

    const cleanEmail = (volunteerEmail || "").trim();
    const cleanName = (volunteerName || "").trim();

    console.log(`Creating survey for ${cleanName} (${cleanEmail})`);

    // Validate inputs
    if (!cleanEmail || !cleanName) {
      console.error("Missing required fields:", {
        hasEmail: !!cleanEmail,
        hasName: !!cleanName,
      });
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate unique survey token
    const surveyToken = crypto.randomUUID();

    // Create survey record
    const { data: surveyData, error: surveyError } = await supabase
      .from("volunteer_surveys")
      .insert({
        volunteer_card_id: volunteerCardId,
        volunteer_id: volunteerId || null,
        marketplace_id: marketplaceId || null,
        volunteer_name: cleanName,
        volunteer_email: cleanEmail,
        survey_token: surveyToken,
      })
      .select()
      .single();

    if (surveyError) {
      console.error("Error creating survey record:", surveyError);
      return new Response(
        JSON.stringify({ success: false, error: surveyError.message }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Update volunteer card with survey sent timestamp
    await supabase
      .from("volunteer_qr_cards")
      .update({ survey_sent_at: new Date().toISOString() })
      .eq("id", volunteerCardId);

    // Build survey URL
    const appUrl = Deno.env.get("APP_URL") || "https://gif.thesurpluss.com";
    const surveyUrl = `${appUrl}/volunteer-survey?token=${surveyToken}`;

    console.log(`Sending survey email to ${cleanEmail}`);

    // Send survey email using Resend REST API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "GIF Volunteer <noreply@mgif.thesurpluss.com>",
        to: [cleanEmail],
        subject: "Thank You for Volunteering! Share Your Feedback",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff; }
              .header { background: #DA291C; padding: 30px 20px; text-align: center; }
              .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
              .content { padding: 30px 20px; }
              .highlight { color: #DA291C; font-weight: bold; }
              .button { display: inline-block; padding: 14px 28px; background-color: #DA291C; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
              .footer { padding: 20px; text-align: center; color: #888; font-size: 12px; border-top: 1px solid #eee; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Thank You, ${cleanName.split(" ")[0]}!</h1>
              </div>
              <div class="content">
                <p>Thank you for volunteering with <span class="highlight">Gift It Forward</span>!</p>
                <p>Your time and effort made a real difference in supporting our circular economy mission and helping those in need.</p>
                <p>We'd love to hear about your experience. Please take a moment to complete this short survey:</p>
                
                <div style="text-align: center;">
                  <a href="${surveyUrl}" class="button">Complete Survey & Get Certificate</a>
                </div>
                
                <p style="color: #666; font-size: 14px;">After completing the survey, you'll receive your <strong>Certificate of Participation</strong>.</p>
                
                <p>Thank you for being part of the change!</p>
                <p>Warm regards,<br><strong>The GIF Team</strong></p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Gift It Forward. All rights reserved.</p>
                <p>If you have any questions, please contact us.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Email send failed:", emailResult);
      return new Response(
        JSON.stringify({ success: false, error: emailResult.message || "Failed to send email" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Survey email sent successfully:", emailResult);

    return new Response(
      JSON.stringify({
        success: true,
        surveyId: surveyData.id,
        surveyToken,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-survey function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Unknown error occurred" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
