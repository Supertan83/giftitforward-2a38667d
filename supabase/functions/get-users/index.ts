import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Get all user roles with pagination limit
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500) // Prevent unlimited data retrieval

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
      return new Response(JSON.stringify({ error: 'Unable to fetch users' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get user emails from auth
    const { data: { users: authUsers }, error: usersError } = await supabaseAdmin.auth.admin.listUsers()

    if (usersError) {
      console.error('Error fetching auth users:', usersError);
      return new Response(JSON.stringify({ error: 'Unable to fetch user details' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get all volunteer QR cards to map to users
    const { data: volunteerCards, error: cardsError } = await supabaseAdmin
      .from('volunteer_qr_cards')
      .select('unique_id, volunteer_id')
      .not('volunteer_id', 'is', null)

    if (cardsError) {
      console.error('Error fetching volunteer cards:', cardsError);
    }

    // Create a map of user_id to QR codes (a user can have multiple family member cards)
    const userQRCards = new Map<string, string[]>();
    volunteerCards?.forEach(card => {
      if (card.volunteer_id) {
        const existing = userQRCards.get(card.volunteer_id) || [];
        existing.push(card.unique_id);
        userQRCards.set(card.volunteer_id, existing);
      }
    });

    // Map roles to users with emails - deduplicate by user_id, prioritize admin role
    const userMap = new Map<string, { 
      id: string; 
      email: string; 
      role: string; 
      created_at: string; 
      first_name: string | null; 
      last_name: string | null;
      qr_codes: string[];
    }>();
    
    roles?.forEach(role => {
      const authUser = authUsers.find(u => u.id === role.user_id);
      const existing = userMap.get(role.user_id);
      const qrCodes = userQRCards.get(role.user_id) || [];
      
      // If user not in map, or if this role is 'admin' (higher priority), add/update
      if (!existing || role.role === 'admin') {
        userMap.set(role.user_id, {
          id: role.user_id, // Use user_id as the id, not role.id
          email: authUser?.email || 'Unknown',
          role: role.role,
          created_at: role.created_at,
          first_name: authUser?.user_metadata?.first_name || null,
          last_name: authUser?.user_metadata?.last_name || null,
          qr_codes: qrCodes,
        });
      }
    });
    
    const usersWithRoles = Array.from(userMap.values());

    return new Response(JSON.stringify({ users: usersWithRoles }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Unexpected error in get-users:', error);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})