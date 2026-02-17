import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const userId = claimsData.claims.sub
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle()

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: corsHeaders })
    }

    const { tables } = await req.json()
    if (!Array.isArray(tables) || tables.length === 0) {
      return new Response(JSON.stringify({ error: 'No tables specified' }), { status: 400, headers: corsHeaders })
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const results: Record<string, { action: string; count: number }> = {}

    for (const table of tables) {
      switch (table) {
        case 'qr_cards': {
          const { data } = await serviceClient
            .from('qr_cards')
            .update({
              status: 'inactive',
              credit_balance: 0,
              total_items_collected: 0,
              collected_items: [],
              marketplace_id: null,
              activated_at: null,
              gender: null,
              marital_status: null,
              nationality: null,
              children_count: 0,
            })
            .neq('id', '00000000-0000-0000-0000-000000000000')
            .select('id')
          results[table] = { action: 'reset', count: data?.length || 0 }
          break
        }
        case 'item_types': {
          const { data } = await serviceClient
            .from('item_types')
            .update({ distributed: 0, allocated_to_marketplace: 0 })
            .neq('id', '00000000-0000-0000-0000-000000000000')
            .select('id')
          results[table] = { action: 'reset_counters', count: data?.length || 0 }
          break
        }
        case 'transactions': {
          const { data } = await serviceClient.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id')
          results[table] = { action: 'deleted', count: data?.length || 0 }
          break
        }
        case 'archived_card_data': {
          const { data } = await serviceClient.from('archived_card_data').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id')
          results[table] = { action: 'deleted', count: data?.length || 0 }
          break
        }
        case 'volunteer_qr_cards': {
          const { data } = await serviceClient.from('volunteer_qr_cards').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id')
          results[table] = { action: 'deleted', count: data?.length || 0 }
          break
        }
        case 'volunteer_attendance': {
          const { data } = await serviceClient.from('volunteer_attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id')
          results[table] = { action: 'deleted', count: data?.length || 0 }
          break
        }
        case 'pending_volunteers': {
          const { data } = await serviceClient.from('pending_volunteers').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id')
          results[table] = { action: 'deleted', count: data?.length || 0 }
          break
        }
        case 'marketplace_item_allocations': {
          const { data } = await serviceClient.from('marketplace_item_allocations').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id')
          results[table] = { action: 'deleted', count: data?.length || 0 }
          break
        }
        case 'marketplace_manual_counts': {
          const { data } = await serviceClient.from('marketplace_manual_counts').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id')
          results[table] = { action: 'deleted', count: data?.length || 0 }
          break
        }
        case 'warehouse_returns': {
          const { data } = await serviceClient.from('warehouse_returns').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id')
          results[table] = { action: 'deleted', count: data?.length || 0 }
          break
        }
        case 'allocation_traceability_logs': {
          const { data } = await serviceClient.from('allocation_traceability_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id')
          results[table] = { action: 'deleted', count: data?.length || 0 }
          break
        }
        case 'volunteer_surveys': {
          const { data } = await serviceClient.from('volunteer_surveys').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id')
          results[table] = { action: 'deleted', count: data?.length || 0 }
          break
        }
        case 'external_survey_responses': {
          const { data } = await serviceClient.from('external_survey_responses').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id')
          results[table] = { action: 'deleted', count: data?.length || 0 }
          break
        }
        case 'email_send_logs': {
          const { data } = await serviceClient.from('email_send_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id')
          results[table] = { action: 'deleted', count: data?.length || 0 }
          break
        }
        default:
          results[table] = { action: 'skipped', count: 0 }
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
