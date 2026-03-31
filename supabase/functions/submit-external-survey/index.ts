import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a random password for auto-created accounts
const generateRandomPassword = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
  let password = "";
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Generate a unique volunteer QR code ID
const generateVolunteerQRCode = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `VOL-${timestamp}-${random}`;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    if (req.method === "POST") {
      const body = await req.json();
      const { volunteer_name, volunteer_email, answers } = body;

      if (!volunteer_name?.trim() || !volunteer_email?.trim()) {
        return new Response(JSON.stringify({ success: false, error: "Name and email are required" }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(volunteer_email.trim())) {
        return new Response(JSON.stringify({ success: false, error: "Invalid email format" }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const trimmedEmail = volunteer_email.trim().toLowerCase();
      const trimmedName = volunteer_name.trim();

      // Build insert payload
      const insertData: Record<string, unknown> = {
        volunteer_name: trimmedName,
        volunteer_email: trimmedEmail,
        completed_at: new Date().toISOString(),
      };

      if (answers && typeof answers === "object") {
        insertData.answers = answers;
      }

      // Company name
      if (body.company_name) {
        insertData.company_name = body.company_name.trim();
      }

      // Legacy columns backward compat
      if (body.experience_word) {
        insertData.experience_word = body.experience_word.trim();
      }
      if (body.would_volunteer_again !== undefined) {
        insertData.would_volunteer_again = body.would_volunteer_again;
      }
      if (body.improvement_suggestions) {
        insertData.improvement_suggestions = body.improvement_suggestions.trim();
      }

      // Save survey response
      const { data: response, error: insertError } = await supabase
        .from("external_survey_responses")
        .insert(insertData)
        .select()
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(JSON.stringify({ success: false, error: "Failed to save survey" }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // --- Auto-create volunteer profile ---
      try {
        const nameParts = trimmedName.split(" ");
        const firstName = nameParts[0] || trimmedName;
        const lastName = nameParts.slice(1).join(" ") || "";

        // Check if user already exists
        const { data: existingUserData } = await supabase.auth.admin.listUsers({
          page: 1,
          perPage: 1,
        });

        // listUsers doesn't filter by email, so we need to check directly
        let existingUserId: string | null = null;

        // Try to create the user - if they already exist, createUser will fail
        const tempPassword = generateRandomPassword();
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: trimmedEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { first_name: firstName, last_name: lastName },
        });

        if (createError) {
          if (createError.message?.includes("already registered") || createError.message?.includes("already been registered")) {
            // User exists — find their ID
            console.log("User already exists, looking up ID for:", trimmedEmail);
            const { data: usersData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
            const existing = usersData?.users?.find(
              (u) => u.email?.toLowerCase() === trimmedEmail
            );
            if (existing) {
              existingUserId = existing.id;
            }
          } else {
            console.error("Error creating user:", createError);
          }
        } else if (newUser?.user) {
          // New user created successfully
          const userId = newUser.user.id;
          existingUserId = userId;
          console.log("Created new volunteer user:", userId);

          // The DB trigger auto-assigns 'volunteer' role, but let's ensure pending_volunteers record exists
          const { error: pvError } = await supabase
            .from("pending_volunteers")
            .insert({
              email: trimmedEmail,
              first_name: firstName,
              last_name: lastName,
              status: "approved",
              source: "cda_survey",
              created_user_id: userId,
            });

          if (pvError) {
            console.error("Error creating pending_volunteers record:", pvError);
          }

          // Create volunteer QR card
          const qrCode = generateVolunteerQRCode();
          const { error: qrError } = await supabase
            .from("volunteer_qr_cards")
            .insert({
              unique_id: qrCode,
              volunteer_id: userId,
              status: "inactive",
            });

          if (qrError) {
            console.error("Error creating volunteer QR card:", qrError);
          }
        }

        // Link survey response to volunteer user
        if (existingUserId) {
          const { error: linkError } = await supabase
            .from("external_survey_responses")
            .update({ volunteer_user_id: existingUserId })
            .eq("id", response.id);

          if (linkError) {
            console.error("Error linking survey to user:", linkError);
          }
        }
      } catch (autoRegError) {
        // Don't fail the survey submission if auto-registration fails
        console.error("Auto-registration error (non-fatal):", autoRegError);
      }

      return new Response(JSON.stringify({ success: true, id: response.id }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ success: false, error: "Internal server error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
