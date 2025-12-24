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

interface CheckVolunteerPayload {
  action: 'check_volunteer_status';
  emails: string[];
}

interface UpdateVolunteerPayload {
  action: 'update_volunteer';
  email: string;
  updates: {
    name?: string;
    phone?: string;
    active?: boolean;
  };
}

interface ProcessMappedDataPayload {
  action: 'process_mapped_data';
  event_id: string;
  array_path: string;
  field_mappings: {
    email: string;
    name?: string;
    phone?: string;
  };
}

// Partner registration interfaces
interface PartnerDependent {
  type: string;
  index: string;
  name: string;
  gender: string;
}

interface PartnerEventRegistration {
  event: string;
  eventDate: string;
  'family-members-joining': string;
  'number-of-children': string;
  'number-of-adults': string;
  'fnb-required'?: string;
  dependents?: PartnerDependent[];
}

interface PartnerRegistration {
  Date: string;
  'IP Address': string;
  'First Name': string;
  'Last Name': string;
  'Phone Number': string;
  'Work Email': string;
  Gender: string;
  'Dubai Holding Employee': string;
  'Dubai Holding Employee - Vertical': string | null;
  'Dubai Holding Employee - Date of Joining': string | null;
  'Dubai Holding Employee - Number': number | null;
  'Not Employee - Company': string | null;
  'Medical Condition': string;
  'Medical Condition Details': string | null;
  'Emergency Contact Name': string;
  'Emergency Contact Relationship': string;
  'Emergency Contact Number': number | string;
  'Fasting during event': string;
  eventslist: string;
  eventsjson: PartnerEventRegistration[];
  'ga-source': string | null;
  'ga-campaign': string | null;
  'ga-medium': string | null;
  'Checkbox - Terms': boolean;
}

interface VolunteerResult {
  email: string;
  status: 'created' | 'failed';
  temp_password?: string;
  error?: string;
}

interface VolunteerStatusResult {
  email: string;
  exists: boolean;
  user_id?: string;
  has_role: boolean;
  metadata?: {
    name?: string;
    phone?: string;
    onboarded_via?: string;
  };
  created_at?: string;
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

    // Check volunteer status
    if (payload.action === 'check_volunteer_status') {
      // Validate API key
      if (!webhookApiKey || providedApiKey !== webhookApiKey) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized: Invalid or missing API key' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const statusPayload = payload as CheckVolunteerPayload;
      
      if (!Array.isArray(statusPayload.emails) || statusPayload.emails.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid payload: emails array is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const results: VolunteerStatusResult[] = [];

      for (const email of statusPayload.emails) {
        if (!isValidEmail(email)) {
          results.push({ email, exists: false, has_role: false });
          continue;
        }

        // Get user by email
        const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
        
        if (userError) {
          console.error('Error listing users:', userError);
          results.push({ email, exists: false, has_role: false });
          continue;
        }

        const user = userData.users.find(u => u.email === email);
        
        if (!user) {
          results.push({ email, exists: false, has_role: false });
          continue;
        }

        // Check if user has volunteer role
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'volunteer')
          .maybeSingle();

        results.push({
          email,
          exists: true,
          user_id: user.id,
          has_role: !!roleData,
          metadata: {
            name: user.user_metadata?.name,
            phone: user.user_metadata?.phone,
            onboarded_via: user.user_metadata?.onboarded_via
          },
          created_at: user.created_at
        });
      }

      console.log(`Checked status for ${results.length} volunteers`);

      return new Response(
        JSON.stringify({ success: true, results }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update volunteer information
    if (payload.action === 'update_volunteer') {
      // Validate API key
      if (!webhookApiKey || providedApiKey !== webhookApiKey) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized: Invalid or missing API key' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const updatePayload = payload as UpdateVolunteerPayload;
      
      if (!updatePayload.email || !isValidEmail(updatePayload.email)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid payload: valid email is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!updatePayload.updates || Object.keys(updatePayload.updates).length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid payload: updates object is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find user by email
      const { data: userData, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        console.error('Error listing users:', listError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to find user' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const user = userData.users.find(u => u.email === updatePayload.email);
      
      if (!user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Volunteer not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update user metadata
      const newMetadata = { ...user.user_metadata };
      if (updatePayload.updates.name !== undefined) {
        newMetadata.name = updatePayload.updates.name;
      }
      if (updatePayload.updates.phone !== undefined) {
        newMetadata.phone = updatePayload.updates.phone;
      }

      const updateData: { user_metadata?: object; ban_duration?: string } = {
        user_metadata: newMetadata
      };

      // Handle active status (ban/unban)
      if (updatePayload.updates.active === false) {
        updateData.ban_duration = '87600h'; // ~10 years
      }

      const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        updateData
      );

      // If reactivating, we need to unban
      if (updatePayload.updates.active === true) {
        await supabase.auth.admin.updateUserById(user.id, { ban_duration: 'none' });
      }

      if (updateError) {
        console.error('Error updating user:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Updated volunteer: ${updatePayload.email}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Volunteer updated successfully',
          user: {
            email: updatedUser.user?.email,
            metadata: updatedUser.user?.user_metadata
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process mapped data from webhook event (internal admin action)
    if (payload.action === 'process_mapped_data') {
      // This action is called from the admin UI, not external webhooks
      // Verify the request has a valid authorization header (authenticated user)
      const authHeader = req.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Authentication required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify the user is an admin
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

      const mappedPayload = payload as ProcessMappedDataPayload;
      
      if (!mappedPayload.event_id || !mappedPayload.array_path || !mappedPayload.field_mappings?.email) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required fields: event_id, array_path, field_mappings.email' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch the original webhook event
      const { data: eventData, error: eventError } = await supabase
        .from('webhook_events')
        .select('payload')
        .eq('id', mappedPayload.event_id)
        .single();

      if (eventError || !eventData) {
        return new Response(
          JSON.stringify({ success: false, error: 'Webhook event not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get the array from the payload using the array path
      const getArrayByPath = (obj: unknown, path: string): unknown[] => {
        const parts = path.split('.');
        let current: unknown = obj;
        for (const part of parts) {
          if (current === null || current === undefined) return [];
          current = (current as Record<string, unknown>)[part];
        }
        return Array.isArray(current) ? current : [];
      };

      const dataArray = getArrayByPath(eventData.payload, mappedPayload.array_path);
      
      if (dataArray.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: `No data found at path: ${mappedPayload.array_path}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract volunteers from the mapped data
      const volunteers: VolunteerData[] = dataArray.map(item => {
        const record = item as Record<string, unknown>;
        return {
          email: String(record[mappedPayload.field_mappings.email] || ''),
          name: mappedPayload.field_mappings.name ? String(record[mappedPayload.field_mappings.name] || '') : undefined,
          phone: mappedPayload.field_mappings.phone ? String(record[mappedPayload.field_mappings.phone] || '') : undefined,
        };
      }).filter(v => v.email && isValidEmail(v.email));

      console.log(`Processing ${volunteers.length} volunteers from mapped data`);

      const results: VolunteerResult[] = [];
      let createdCount = 0;
      let failedCount = 0;

      for (const volunteer of volunteers) {
        const tempPassword = generateTempPassword();

        try {
          const { data: userData, error: createError } = await supabase.auth.admin.createUser({
            email: volunteer.email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              name: volunteer.name || '',
              phone: volunteer.phone || '',
              onboarded_via: 'partner_webhook_mapped'
            }
          });

          if (createError) {
            console.error(`Failed to create user ${volunteer.email}:`, createError);
            results.push({ email: volunteer.email, status: 'failed', error: createError.message });
            failedCount++;
            continue;
          }

          if (!userData.user) {
            results.push({ email: volunteer.email, status: 'failed', error: 'User creation returned no user data' });
            failedCount++;
            continue;
          }

          // Assign volunteer role
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({ user_id: userData.user.id, role: 'volunteer' });

          if (roleError) {
            console.error(`Failed to assign role to ${volunteer.email}:`, roleError);
            results.push({ email: volunteer.email, status: 'created', temp_password: tempPassword, error: 'Role assignment failed' });
          } else {
            results.push({ email: volunteer.email, status: 'created', temp_password: tempPassword });
          }

          createdCount++;
          console.log(`Successfully created volunteer: ${volunteer.email}`);

        } catch (err) {
          console.error(`Unexpected error creating ${volunteer.email}:`, err);
          results.push({ email: volunteer.email, status: 'failed', error: err instanceof Error ? err.message : 'Unknown error' });
          failedCount++;
        }
      }

      // Mark the webhook event as processed
      await supabase
        .from('webhook_events')
        .update({ processed: true })
        .eq('id', mappedPayload.event_id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Mapped data processed successfully',
          results: {
            total: volunteers.length,
            created: createdCount,
            failed: failedCount,
            details: results
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is a partner registration payload (array with specific structure)
    // Partner sends array of registrations without an "action" field
    if (Array.isArray(payload) && payload.length > 0 && payload[0]['Work Email']) {
      console.log('Detected partner registration payload');
      const registrations = payload as PartnerRegistration[];
      
      const results = {
        total: registrations.length,
        processed: 0,
        failed: 0,
        details: [] as Array<{ email: string; status: string; error?: string; registration_id?: string }>
      };

      for (const reg of registrations) {
        try {
          // Clean phone number (remove quotes)
          const cleanPhone = reg['Phone Number']?.replace(/'/g, '').trim() || null;
          
          // Parse submission date
          let submissionDate: string | null = null;
          if (reg.Date) {
            try {
              // Parse "12/24/2025 6:35:13 am" format
              const parts = reg.Date.match(/(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+):(\d+)\s*(am|pm)?/i);
              if (parts) {
                let hour = parseInt(parts[4]);
                if (parts[7]?.toLowerCase() === 'pm' && hour !== 12) hour += 12;
                if (parts[7]?.toLowerCase() === 'am' && hour === 12) hour = 0;
                submissionDate = new Date(
                  parseInt(parts[3]), parseInt(parts[1]) - 1, parseInt(parts[2]),
                  hour, parseInt(parts[5]), parseInt(parts[6])
                ).toISOString();
              }
            } catch (e) {
              console.warn('Failed to parse date:', reg.Date);
            }
          }

          // Insert partner registration
          const { data: regData, error: regError } = await supabase
            .from('partner_registrations')
            .insert({
              submission_date: submissionDate,
              ip_address: reg['IP Address'] || null,
              first_name: reg['First Name'],
              last_name: reg['Last Name'],
              phone_number: cleanPhone,
              work_email: reg['Work Email'],
              gender: reg.Gender || null,
              is_employee: reg['Dubai Holding Employee'] === 'Yes',
              employee_vertical: reg['Dubai Holding Employee - Vertical'] || null,
              employee_join_date: reg['Dubai Holding Employee - Date of Joining'] || null,
              employee_number: reg['Dubai Holding Employee - Number']?.toString() || null,
              external_company: reg['Not Employee - Company'] || null,
              has_medical_condition: reg['Medical Condition'] === 'Yes',
              medical_condition_details: reg['Medical Condition Details'] || null,
              emergency_contact_name: reg['Emergency Contact Name'] || null,
              emergency_contact_relationship: reg['Emergency Contact Relationship'] || null,
              emergency_contact_number: reg['Emergency Contact Number']?.toString() || null,
              is_fasting: reg['Fasting during event'] === 'Yes',
              events_list: reg.eventslist || null,
              ga_source: reg['ga-source'] || null,
              ga_campaign: reg['ga-campaign'] || null,
              ga_medium: reg['ga-medium'] || null,
              terms_accepted: reg['Checkbox - Terms'] === true,
              webhook_event_id: eventData?.id || null
            })
            .select()
            .single();

          if (regError) {
            console.error('Failed to insert registration:', regError);
            results.failed++;
            results.details.push({
              email: reg['Work Email'],
              status: 'failed',
              error: regError.message
            });
            continue;
          }

          // Insert event registrations
          if (reg.eventsjson && Array.isArray(reg.eventsjson)) {
            for (const eventReg of reg.eventsjson) {
              const { data: eventRegData, error: eventError } = await supabase
                .from('registration_events')
                .insert({
                  registration_id: regData.id,
                  event_slug: eventReg.event,
                  event_date: eventReg.eventDate || null,
                  family_members_joining: eventReg['family-members-joining'] === 'Yes',
                  number_of_children: parseInt(eventReg['number-of-children']) || 0,
                  number_of_adults: parseInt(eventReg['number-of-adults']) || 0,
                  fnb_required: eventReg['fnb-required'] === 'Yes'
                })
                .select()
                .single();

              if (eventError) {
                console.warn('Failed to insert event registration:', eventError);
                continue;
              }

              // Insert dependents
              if (eventReg.dependents && Array.isArray(eventReg.dependents)) {
                for (const dep of eventReg.dependents) {
                  const { error: depError } = await supabase
                    .from('event_dependents')
                    .insert({
                      registration_event_id: eventRegData.id,
                      dependent_type: dep.type,
                      dependent_index: parseInt(dep.index) || null,
                      name: dep.name,
                      gender: dep.gender || null
                    });

                  if (depError) {
                    console.warn('Failed to insert dependent:', depError);
                  }
                }
              }
            }
          }

          results.processed++;
          results.details.push({
            email: reg['Work Email'],
            status: 'processed',
            registration_id: regData.id
          });

          console.log(`Successfully processed registration for: ${reg['Work Email']}`);

        } catch (err) {
          console.error(`Error processing registration for ${reg['Work Email']}:`, err);
          results.failed++;
          results.details.push({
            email: reg['Work Email'],
            status: 'failed',
            error: err instanceof Error ? err.message : 'Unknown error'
          });
        }
      }

      // Mark webhook event as processed
      if (eventData?.id) {
        await supabase
          .from('webhook_events')
          .update({ processed: true })
          .eq('id', eventData.id);
      }

      console.log(`Partner registration processed: ${results.processed}/${results.total} successful`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Partner registrations processed',
          results
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
