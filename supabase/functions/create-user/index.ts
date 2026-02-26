import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation helpers
const KIOSK_EMAIL_PATTERN = /^acc\d{2}@gif\.com$/;

const isValidEmail = (email: string): boolean => {
  // Allow kiosk account emails (acc01@gif through acc25@gif)
  if (KIOSK_EMAIL_PATTERN.test(email)) return true;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
};

const isValidPassword = (password: string): boolean => {
  return typeof password === 'string' && password.length >= 8 && password.length <= 128;
};

const isValidRole = (role: string): role is 'admin' | 'volunteer' | 'employee' => {
  return role === 'admin' || role === 'volunteer' || role === 'employee';
};

// Generate a unique volunteer QR code ID
const generateVolunteerQRCode = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `VOL-${timestamp}-${random}`;
};

Deno.serve(async (req) => {

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !requestingUser) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if requesting user is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email, password, role, firstName, lastName, gender, companyName, isDhEmployee, eventName, marketplaceId } = body;

    // Comprehensive input validation
    if (!email || typeof email !== 'string') {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ error: 'Please provide a valid email address' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!password || typeof password !== 'string') {
      return new Response(JSON.stringify({ error: 'Password is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!isValidPassword(password)) {
      return new Response(JSON.stringify({ error: 'Password must be between 8 and 128 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!role || typeof role !== 'string') {
      return new Response(JSON.stringify({ error: 'Role is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!isValidRole(role)) {
      return new Response(JSON.stringify({ error: 'Please select a valid role' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create user with metadata
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName?.trim() || null,
        last_name: lastName?.trim() || null,
      }
    })

    if (createError) {
      console.error('User creation error:', createError);
      // Map known errors to user-friendly messages
      if (createError.message?.includes('already registered')) {
        return new Response(JSON.stringify({ error: 'This email is already registered' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ error: 'Unable to create user. Please try again.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Assign role - delete any existing roles first (trigger may have assigned 'volunteer')
    // then insert the desired role
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', newUser.user.id)
    
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: newUser.user.id, role })

    if (roleError) {
      console.error('Role assignment error:', roleError);
      // Cleanup: delete user if role assignment fails
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      return new Response(JSON.stringify({ error: 'Unable to complete user setup. Please try again.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // If volunteer role, create pending_volunteers record first (needed for QR card FK)
    let volunteerQRCode: string | null = null;
    if (role === 'volunteer') {
      // Build events_json from marketplace selection if provided
      let eventsJson = null;
      if (marketplaceId) {
        // Look up marketplace details
        const { data: mpData } = await supabaseAdmin
          .from('marketplace_events')
          .select('name, event_date, start_time, end_time, location')
          .eq('id', marketplaceId)
          .maybeSingle();
        
        if (mpData) {
          eventsJson = [{
            event: mpData.name.toLowerCase().replace(/\s+/g, '-'),
            name: mpData.name,
            eventDate: mpData.event_date || undefined,
            eventLocation: mpData.location || undefined,
          }];
        }
      }

      // Create pending_volunteers record first (volunteer_qr_cards has FK to this table)
      const { data: pvData, error: pvError } = await supabaseAdmin
        .from('pending_volunteers')
        .insert({
          email: email.trim().toLowerCase(),
          first_name: firstName?.trim() || '',
          last_name: lastName?.trim() || '',
          status: 'approved',
          source: 'manual',
          created_user_id: newUser.user.id,
          gender: gender?.trim() || null,
          external_company: companyName?.trim() || null,
          is_employee: isDhEmployee === true || String(isDhEmployee ?? '').toLowerCase() === 'yes',
          events_list: eventName?.trim() || null,
          events_json: eventsJson,
          temp_password: password,
        })
        .select('id')
        .single();

      if (pvError) {
        console.error('Pending volunteer creation error:', pvError);
      }

      // Now create volunteer QR card linked to the pending_volunteers record
      if (pvData) {
        volunteerQRCode = generateVolunteerQRCode();
        
        const { error: qrError } = await supabaseAdmin
          .from('volunteer_qr_cards')
          .insert({
            unique_id: volunteerQRCode,
            volunteer_id: pvData.id,
            status: 'inactive',
            marketplace_id: marketplaceId || null
          });

        if (qrError) {
          console.error('QR card creation error:', qrError);
          volunteerQRCode = null;
        }
      }
    }

    return new Response(JSON.stringify({ 
      user: { 
        id: newUser.user.id, 
        email: newUser.user.email, 
        role,
        qr_code: volunteerQRCode
      } 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Unexpected error in create-user:', error);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})