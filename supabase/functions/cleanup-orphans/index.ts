import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CleanupResult {
  orphanedUserRoles: number;
  orphanedVolunteerQRCards: number;
  totalCleaned: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if requesting user is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions - admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { dryRun = true } = await req.json().catch(() => ({ dryRun: true }));

    console.log(`Starting orphan cleanup (dryRun: ${dryRun})`);

    // Get all auth users
    const { data: { users: authUsers }, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (usersError) {
      console.error('Error fetching auth users:', usersError);
      return new Response(JSON.stringify({ error: 'Failed to fetch auth users' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validAuthUserIds = new Set(authUsers.map(u => u.id));
    console.log(`Found ${validAuthUserIds.size} valid auth users`);

    // Find orphaned user_roles entries
    const { data: allUserRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('id, user_id');

    if (rolesError) {
      console.error('Error fetching user_roles:', rolesError);
      return new Response(JSON.stringify({ error: 'Failed to fetch user_roles' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orphanedUserRoleIds = allUserRoles
      ?.filter(role => !validAuthUserIds.has(role.user_id))
      .map(role => role.id) || [];

    console.log(`Found ${orphanedUserRoleIds.length} orphaned user_roles entries`);

    // Find orphaned volunteer_qr_cards (null volunteer_id)
    const { data: orphanedQRCards, error: qrError } = await supabaseAdmin
      .from('volunteer_qr_cards')
      .select('id, unique_id')
      .is('volunteer_id', null);

    if (qrError) {
      console.error('Error fetching orphaned QR cards:', qrError);
      return new Response(JSON.stringify({ error: 'Failed to fetch orphaned QR cards' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orphanedQRCardIds = orphanedQRCards?.map(card => card.id) || [];
    console.log(`Found ${orphanedQRCardIds.length} orphaned volunteer_qr_cards entries`);

    const result: CleanupResult = {
      orphanedUserRoles: orphanedUserRoleIds.length,
      orphanedVolunteerQRCards: orphanedQRCardIds.length,
      totalCleaned: 0,
    };

    if (!dryRun) {
      // Delete orphaned user_roles
      if (orphanedUserRoleIds.length > 0) {
        const { error: deleteRolesError } = await supabaseAdmin
          .from('user_roles')
          .delete()
          .in('id', orphanedUserRoleIds);

        if (deleteRolesError) {
          console.error('Error deleting orphaned user_roles:', deleteRolesError);
        } else {
          console.log(`Deleted ${orphanedUserRoleIds.length} orphaned user_roles entries`);
          result.totalCleaned += orphanedUserRoleIds.length;
        }
      }

      // Delete orphaned volunteer_qr_cards
      if (orphanedQRCardIds.length > 0) {
        const { error: deleteCardsError } = await supabaseAdmin
          .from('volunteer_qr_cards')
          .delete()
          .in('id', orphanedQRCardIds);

        if (deleteCardsError) {
          console.error('Error deleting orphaned volunteer_qr_cards:', deleteCardsError);
        } else {
          console.log(`Deleted ${orphanedQRCardIds.length} orphaned volunteer_qr_cards entries`);
          result.totalCleaned += orphanedQRCardIds.length;
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      dryRun,
      ...result,
      message: dryRun 
        ? `Found ${result.orphanedUserRoles + result.orphanedVolunteerQRCards} orphaned records. Run with dryRun=false to delete.`
        : `Cleaned up ${result.totalCleaned} orphaned records.`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unexpected error in cleanup-orphans:', error);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
