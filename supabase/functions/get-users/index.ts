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

    // Get all volunteer QR cards to map to users (including assignment info)
    const { data: volunteerCards, error: cardsError } = await supabaseAdmin
      .from('volunteer_qr_cards')
      .select('unique_id, volunteer_id, assigned_zone, marketplace_id, status')
      .not('volunteer_id', 'is', null)

    if (cardsError) {
      console.error('Error fetching volunteer cards:', cardsError);
    }

    // Get pending_volunteers to map to auth users
    const { data: pendingVolunteers, error: pvError } = await supabaseAdmin
      .from('pending_volunteers')
      .select('id, created_user_id')
      .not('created_user_id', 'is', null)

    if (pvError) {
      console.error('Error fetching pending volunteers:', pvError);
    }

    // Create a map of pending_volunteer_id to auth_user_id
    const pvToAuthUser = new Map<string, string>();
    pendingVolunteers?.forEach(pv => {
      if (pv.created_user_id) {
        pvToAuthUser.set(pv.id, pv.created_user_id);
      }
    });

    // Create a map of auth_user_id to QR card info
    interface QRCardInfo {
      unique_id: string;
      assigned_zone: string | null;
      marketplace_id: string | null;
      status: string;
    }
    const userQRCards = new Map<string, QRCardInfo[]>();
    volunteerCards?.forEach(card => {
      if (card.volunteer_id) {
        // Get the auth user id from pending_volunteers
        const authUserId = pvToAuthUser.get(card.volunteer_id);
        if (authUserId) {
          const existing = userQRCards.get(authUserId) || [];
          existing.push({
            unique_id: card.unique_id,
            assigned_zone: card.assigned_zone,
            marketplace_id: card.marketplace_id,
            status: card.status,
          });
          userQRCards.set(authUserId, existing);
        }
      }
    });

    // Create a set of valid auth user IDs for quick lookup
    const validAuthUserIds = new Set(authUsers.map(u => u.id));

    // Map roles to users with emails - deduplicate by user_id, prioritize admin role
    // IMPORTANT: Skip entries where the auth user no longer exists (orphaned records)
    const userMap = new Map<string, { 
      id: string; 
      email: string; 
      role: string; 
      created_at: string; 
      first_name: string | null; 
      last_name: string | null;
      qr_codes: string[];
      pending_volunteer_id: string | null;
      assigned_zone: string | null;
      marketplace_id: string | null;
      volunteer_status: string | null;
    }>();

    // Create reverse map: auth_user_id to pending_volunteer_id
    const authUserToPV = new Map<string, string>();
    pendingVolunteers?.forEach(pv => {
      if (pv.created_user_id) {
        authUserToPV.set(pv.created_user_id, pv.id);
      }
    });

    // Track orphaned user_roles entries for reporting
    const orphanedRoleIds: string[] = [];
    
    roles?.forEach(role => {
      // Skip orphaned records where auth user no longer exists
      if (!validAuthUserIds.has(role.user_id)) {
        orphanedRoleIds.push(role.id);
        console.log(`Skipping orphaned user_role: ${role.id} for user_id: ${role.user_id}`);
        return;
      }

      const authUser = authUsers.find(u => u.id === role.user_id);
      const existing = userMap.get(role.user_id);
      const qrCardInfos = userQRCards.get(role.user_id) || [];
      const qrCodes = qrCardInfos.map(c => c.unique_id);
      const primaryCard = qrCardInfos[0] || null;
      const pendingVolunteerId = authUserToPV.get(role.user_id) || null;
      
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
          pending_volunteer_id: pendingVolunteerId,
          assigned_zone: primaryCard?.assigned_zone || null,
          marketplace_id: primaryCard?.marketplace_id || null,
          volunteer_status: primaryCard?.status || null,
        });
      }
    });

    if (orphanedRoleIds.length > 0) {
      console.log(`Found ${orphanedRoleIds.length} orphaned user_roles entries`);
    }
    
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