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

    // Mode: restore — restore archived records back to their source tables
    if (mode === 'restore' && Array.isArray(ids) && ids.length > 0) {
      const result = await restoreArchivedRecords(serviceClient, ids, userId)
      return new Response(JSON.stringify({ success: true, results: { restored: result } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Mode: permanent_delete — permanently remove from archive
    if (mode === 'permanent_delete' && Array.isArray(ids) && ids.length > 0) {
      const { data } = await serviceClient.from('cleanup_archive').delete().in('id', ids).select('id')
      return new Response(JSON.stringify({ success: true, results: { permanently_deleted: { action: 'permanently_deleted', count: data?.length || 0 } } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Mode: delete_selected — archive then delete specific IDs from a single table
    if (mode === 'delete_selected' && singleTable && Array.isArray(ids) && ids.length > 0) {
      const result = await archiveAndDeleteRecords(serviceClient, singleTable, ids, userId)
      return new Response(JSON.stringify({ success: true, results: { [singleTable]: result } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Mode: bulk — archive then clear entire tables
    if (!Array.isArray(tables) || tables.length === 0) {
      return new Response(JSON.stringify({ error: 'No tables specified' }), { status: 400, headers: corsHeaders })
    }

    const results: Record<string, { action: string; count: number }> = {}
    for (const table of tables) {
      results[table] = await archiveAndCleanTable(serviceClient, table, userId)
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

const ALLOWED_TABLES = [
  'qr_cards', 'transactions', 'archived_card_data',
  'volunteer_qr_cards', 'volunteer_attendance', 'pending_volunteers',
  'marketplace_item_allocations', 'item_types',
  'marketplace_manual_counts', 'warehouse_returns', 'allocation_traceability_logs',
  'volunteer_surveys', 'external_survey_responses', 'email_send_logs',
]

async function archiveRecords(client: any, table: string, records: any[], userId: string) {
  if (!records || records.length === 0) return
  const batchId = crypto.randomUUID()
  const archiveRows = records.map(r => ({
    source_table: table,
    original_id: r.id,
    record_data: r,
    archived_by: userId,
    archive_batch_id: batchId,
  }))
  // Insert in chunks of 100
  for (let i = 0; i < archiveRows.length; i += 100) {
    await client.from('cleanup_archive').insert(archiveRows.slice(i, i + 100))
  }
}

async function archiveAndDeleteRecords(
  client: any, table: string, ids: string[], userId: string
): Promise<{ action: string; count: number }> {
  if (!ALLOWED_TABLES.includes(table)) return { action: 'skipped', count: 0 }

  // Fetch full records before modifying
  const { data: fullRecords } = await client.from(table).select('*').in('id', ids)
  if (fullRecords && fullRecords.length > 0) {
    await archiveRecords(client, table, fullRecords, userId)
  }

  // qr_cards: reset instead of delete
  if (table === 'qr_cards') {
    const { data } = await client.from('qr_cards').update({
      status: 'inactive', credit_balance: 0, total_items_collected: 0,
      collected_items: [], marketplace_id: null, activated_at: null,
      gender: null, marital_status: null, nationality: null, children_count: 0,
    }).in('id', ids).select('id')
    return { action: 'archived_and_reset', count: data?.length || 0 }
  }

  const { data } = await client.from(table).delete().in('id', ids).select('id')
  return { action: 'archived_and_deleted', count: data?.length || 0 }
}

async function archiveAndCleanTable(
  client: any, table: string, userId: string
): Promise<{ action: string; count: number }> {
  // Fetch all records first for archiving
  const { data: allRecords } = await client.from(table).select('*')
    .neq('id', '00000000-0000-0000-0000-000000000000').limit(2000)
  
  if (allRecords && allRecords.length > 0) {
    await archiveRecords(client, table, allRecords, userId)
  }

  switch (table) {
    case 'qr_cards': {
      const { data } = await client.from('qr_cards').update({
        status: 'inactive', credit_balance: 0, total_items_collected: 0,
        collected_items: [], marketplace_id: null, activated_at: null,
        gender: null, marital_status: null, nationality: null, children_count: 0,
      }).neq('id', '00000000-0000-0000-0000-000000000000').select('id')
      return { action: 'archived_and_reset', count: data?.length || 0 }
    }
    case 'item_types': {
      const { data } = await client.from('item_types').update({
        distributed: 0, allocated_to_marketplace: 0,
      }).neq('id', '00000000-0000-0000-0000-000000000000').select('id')
      return { action: 'archived_and_reset_counters', count: data?.length || 0 }
    }
    default: {
      if (!ALLOWED_TABLES.includes(table)) return { action: 'skipped', count: 0 }
      const { data } = await client.from(table).delete()
        .neq('id', '00000000-0000-0000-0000-000000000000').select('id')
      return { action: 'archived_and_deleted', count: data?.length || 0 }
    }
  }
}

async function restoreArchivedRecords(
  client: any, archiveIds: string[], userId: string
): Promise<{ action: string; count: number }> {
  // Fetch archived records
  const { data: archives, error } = await client.from('cleanup_archive')
    .select('*').in('id', archiveIds)
  
  if (error || !archives || archives.length === 0) {
    return { action: 'restored', count: 0 }
  }

  let restoredCount = 0

  // Group by source_table
  const grouped: Record<string, any[]> = {}
  for (const a of archives) {
    if (!grouped[a.source_table]) grouped[a.source_table] = []
    grouped[a.source_table].push(a)
  }

  for (const [table, items] of Object.entries(grouped)) {
    if (!ALLOWED_TABLES.includes(table)) continue

    if (table === 'qr_cards' || table === 'item_types') {
      // For reset tables, restore means updating the existing record with archived data
      for (const item of items) {
        const record = item.record_data
        const { id, created_at, ...updateData } = record
        const { error: updateErr } = await client.from(table).update(updateData).eq('id', id)
        if (!updateErr) restoredCount++
      }
    } else {
      // For deleted tables, re-insert the records
      const records = items.map(i => i.record_data)
      for (let i = 0; i < records.length; i += 50) {
        const batch = records.slice(i, i + 50)
        const { data: inserted, error: insertErr } = await client.from(table).upsert(batch).select('id')
        if (!insertErr && inserted) restoredCount += inserted.length
      }
    }
  }

  // Remove restored records from archive
  await client.from('cleanup_archive').delete().in('id', archiveIds)

  return { action: 'restored', count: restoredCount }
}
