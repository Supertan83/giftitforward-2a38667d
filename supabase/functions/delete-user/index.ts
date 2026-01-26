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

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { userId } = body;

    if (!userId || typeof userId !== 'string') {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Prevent self-deletion
    if (userId === requestingUser.id) {
      return new Response(JSON.stringify({ error: 'You cannot delete your own account' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Delete ALL user roles first (user may have multiple roles)
    const { error: roleDeleteError, count: deletedRolesCount } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)

    if (roleDeleteError) {
      console.error('Role deletion error:', roleDeleteError);
      return new Response(JSON.stringify({ error: 'Unable to delete user role' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    console.log(`Deleted ${deletedRolesCount ?? 'unknown'} role(s) for user ${userId}`);

    // Delete volunteer_qr_cards associated with this user via pending_volunteers
    // First, get the pending_volunteer record for this user
    const { data: pendingVolunteer } = await supabaseAdmin
      .from('pending_volunteers')
      .select('id')
      .eq('created_user_id', userId)
      .maybeSingle()

    if (pendingVolunteer) {
      // Delete volunteer_qr_cards linked to this pending_volunteer
      const { error: qrDeleteError, count: deletedQrCount } = await supabaseAdmin
        .from('volunteer_qr_cards')
        .delete()
        .eq('volunteer_id', pendingVolunteer.id)

      if (qrDeleteError) {
        console.error('QR card deletion error:', qrDeleteError);
      } else {
        console.log(`Deleted ${deletedQrCount ?? 0} QR card(s) for pending volunteer ${pendingVolunteer.id}`);
      }

      // Delete the pending_volunteers record
      const { error: pvDeleteError } = await supabaseAdmin
        .from('pending_volunteers')
        .delete()
        .eq('id', pendingVolunteer.id)

      if (pvDeleteError) {
        console.error('Pending volunteer deletion error:', pvDeleteError);
      } else {
        console.log(`Deleted pending volunteer record ${pendingVolunteer.id}`);
      }
    }

    // Delete user from auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('User deletion error:', deleteError);
      // Handle "user not found" gracefully - user may have been already deleted
      if (deleteError.message?.includes('not found') || (deleteError as any).code === 'user_not_found') {
        console.log(`User ${userId} not found in auth, may have been already deleted`);
        // Still return success since the goal (user removed) is achieved
      } else {
        return new Response(JSON.stringify({ error: 'Unable to delete user' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    console.log(`User ${userId} deleted successfully by admin ${requestingUser.id}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Unexpected error in delete-user:', error);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})