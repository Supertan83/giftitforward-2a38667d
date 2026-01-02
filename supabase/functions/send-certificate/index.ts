import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
      JSON.stringify({ success: true, id: emailResponse.data?.id }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-certificate function:", error);
    // Return 200 with error details to prevent edge function error on frontend
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
