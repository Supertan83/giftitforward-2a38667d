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

    const body = await req.json()
    const { tables, mode, table: singleTable, ids } = body

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Mode: delete_selected — delete specific IDs from a single table
    if (mode === 'delete_selected' && singleTable && Array.isArray(ids) && ids.length > 0) {
      const result = await deleteSpecificRecords(serviceClient, singleTable, ids)
      return new Response(JSON.stringify({ success: true, results: { [singleTable]: result } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Mode: bulk — clear entire tables (original behavior)
    if (!Array.isArray(tables) || tables.length === 0) {
      return new Response(JSON.stringify({ error: 'No tables specified' }), { status: 400, headers: corsHeaders })
    }

    const results: Record<string, { action: string; count: number }> = {}

    for (const table of tables) {
      results[table] = await cleanTable(serviceClient, table)
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

async function deleteSpecificRecords(
  client: any,
  table: string,
  ids: string[]
): Promise<{ action: string; count: number }> {
  const allowedTables = [
    'qr_cards', 'transactions', 'archived_card_data',
    'volunteer_qr_cards', 'volunteer_attendance', 'pending_volunteers',
    'marketplace_item_allocations', 'item_types',
    'marketplace_manual_counts', 'warehouse_returns', 'allocation_traceability_logs',
    'volunteer_surveys', 'external_survey_responses', 'email_send_logs',
  ]
  if (!allowedTables.includes(table)) {
    return { action: 'skipped', count: 0 }
  }

  // Special handling: qr_cards reset instead of delete
  if (table === 'qr_cards') {
    const { data } = await client
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
      .in('id', ids)
      .select('id')
    return { action: 'reset', count: data?.length || 0 }
  }

  // Special handling: item_types reset counters instead of delete
  if (table === 'item_types') {
    const { data } = await client
      .from('item_types')
      .update({ distributed: 0, allocated_to_marketplace: 0 })
      .in('id', ids)
      .select('id')
    return { action: 'reset_counters', count: data?.length || 0 }
  }

  const { data } = await client.from(table).delete().in('id', ids).select('id')
  return { action: 'deleted', count: data?.length || 0 }
}

async function cleanTable(
  client: any,
  table: string
): Promise<{ action: string; count: number }> {
  switch (table) {
    case 'qr_cards': {
      const { data } = await client
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
      return { action: 'reset', count: data?.length || 0 }
    }
    case 'item_types': {
      const { data } = await client
        .from('item_types')
        .update({ distributed: 0, allocated_to_marketplace: 0 })
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .select('id')
      return { action: 'reset_counters', count: data?.length || 0 }
    }
    default: {
      const allowedTables = [
        'transactions', 'archived_card_data',
        'volunteer_qr_cards', 'volunteer_attendance', 'pending_volunteers',
        'marketplace_item_allocations', 'marketplace_manual_counts',
        'warehouse_returns', 'allocation_traceability_logs',
        'volunteer_surveys', 'external_survey_responses', 'email_send_logs',
      ]
      if (!allowedTables.includes(table)) {
        return { action: 'skipped', count: 0 }
      }
      const { data } = await client.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id')
      return { action: 'deleted', count: data?.length || 0 }
    }
  }
}
