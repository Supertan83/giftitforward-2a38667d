import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

interface VolunteerData {
  email: string;
  name?: string;
  phone?: string;
}

interface CreateVolunteerPayload {
  action: 'create_volunteer';
  volunteers: VolunteerData[];
}

interface VolunteerResult {
  email: string;
  status: 'created' | 'failed';
  temp_password?: string;
  error?: string;
}

function generateTempPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookApiKey = Deno.env.get('WEBHOOK_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the request body
    const payload = await req.json();
    
    const headersObj = Object.fromEntries(req.headers.entries());
    const sourceIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const providedApiKey = req.headers.get('x-api-key');
    
    console.log('Webhook received:', JSON.stringify(payload, null, 2));
    console.log('Source IP:', sourceIp);
    console.log('Timestamp:', new Date().toISOString());

    // Store the webhook event in the database
    const { data: eventData, error: insertError } = await supabase
      .from('webhook_events')
      .insert({
        payload,
        headers: headersObj,
        source_ip: sourceIp,
        received_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to store webhook event:', insertError);
    } else {
      console.log('Webhook event stored with ID:', eventData.id);
    }

    // Check if this is a volunteer creation request
    if (payload.action === 'create_volunteer') {
      // Validate API key for protected actions
      if (!webhookApiKey || providedApiKey !== webhookApiKey) {
        console.error('Invalid or missing API key for create_volunteer action');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Unauthorized: Invalid or missing API key' 
          }),
          { 
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const volunteerPayload = payload as CreateVolunteerPayload;
      
      if (!Array.isArray(volunteerPayload.volunteers) || volunteerPayload.volunteers.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Invalid payload: volunteers array is required and must not be empty' 
          }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const results: VolunteerResult[] = [];
      let createdCount = 0;
      let failedCount = 0;

      for (const volunteer of volunteerPayload.volunteers) {
        // Validate email
        if (!volunteer.email || !isValidEmail(volunteer.email)) {
          results.push({
            email: volunteer.email || 'missing',
            status: 'failed',
            error: 'Invalid or missing email address'
          });
          failedCount++;
          continue;
        }

        const tempPassword = generateTempPassword();

        try {
          // Create user account
          const { data: userData, error: createError } = await supabase.auth.admin.createUser({
            email: volunteer.email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              name: volunteer.name || '',
              phone: volunteer.phone || '',
              onboarded_via: 'partner_webhook'
            }
          });

          if (createError) {
            console.error(`Failed to create user ${volunteer.email}:`, createError);
            results.push({
              email: volunteer.email,
              status: 'failed',
              error: createError.message
            });
            failedCount++;
            continue;
          }

          if (!userData.user) {
            results.push({
              email: volunteer.email,
              status: 'failed',
              error: 'User creation returned no user data'
            });
            failedCount++;
            continue;
          }

          // Assign volunteer role
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: userData.user.id,
              role: 'volunteer'
            });

          if (roleError) {
            console.error(`Failed to assign role to ${volunteer.email}:`, roleError);
            // User was created but role assignment failed - still report as created with warning
            results.push({
              email: volunteer.email,
              status: 'created',
              temp_password: tempPassword,
              error: 'User created but role assignment failed: ' + roleError.message
            });
          } else {
            results.push({
              email: volunteer.email,
              status: 'created',
              temp_password: tempPassword
            });
          }

          createdCount++;
          console.log(`Successfully created volunteer: ${volunteer.email}`);

        } catch (err) {
          console.error(`Unexpected error creating ${volunteer.email}:`, err);
          results.push({
            email: volunteer.email,
            status: 'failed',
            error: err instanceof Error ? err.message : 'Unknown error'
          });
          failedCount++;
        }
      }

      // Update the webhook event with processing results
      if (eventData?.id) {
        await supabase
          .from('webhook_events')
          .update({ 
            processed: true,
            payload: {
              ...payload,
              processing_results: {
                total: volunteerPayload.volunteers.length,
                created: createdCount,
                failed: failedCount
              }
            }
          })
          .eq('id', eventData.id);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Volunteer onboarding processed',
          results: {
            total: volunteerPayload.volunteers.length,
            created: createdCount,
            failed: failedCount,
            details: results
          }
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Default response for other webhook types
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook received successfully',
        received_at: new Date().toISOString()
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error: unknown) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
