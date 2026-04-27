import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const body = await req.json().catch(() => ({}))
    const dryRun = body.dry_run !== false // default to dry_run=true for safety

    // Step 1: Get all item_types with external_material_id
    const { data: items, error: itemsErr } = await supabase
      .from('item_types')
      .select('id, name, external_material_id, total_stock, stock_locked')
      .not('external_material_id', 'is', null)
      .order('external_material_id', { ascending: true })

    if (itemsErr) throw new Error(`Failed to fetch items: ${itemsErr.message}`)

    // Step 2: Get ALL marketplace_item_allocations in batches
    const allAllocations: any[] = []
    const batchSize = 500
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const { data: batch, error: batchErr } = await supabase
        .from('marketplace_item_allocations')
        .select('item_type_id, allocated_quantity, distributed_quantity, id')
        .range(offset, offset + batchSize - 1)

      if (batchErr) throw new Error(`Failed to fetch allocations: ${batchErr.message}`)
      if (!batch || batch.length === 0) {
        hasMore = false
      } else {
        allAllocations.push(...batch)
        offset += batchSize
        if (batch.length < batchSize) hasMore = false
      }
    }

    console.log(`Fetched ${items?.length || 0} items and ${allAllocations.length} allocations`)

    // Step 3: Build per-item allocation summaries
    const allocByItem: Record<string, { totalAllocated: number; totalDistributed: number; rows: any[] }> = {}
    for (const alloc of allAllocations) {
      if (!allocByItem[alloc.item_type_id]) {
        allocByItem[alloc.item_type_id] = { totalAllocated: 0, totalDistributed: 0, rows: [] }
      }
      allocByItem[alloc.item_type_id].totalAllocated += alloc.allocated_quantity
      allocByItem[alloc.item_type_id].totalDistributed += alloc.distributed_quantity
      allocByItem[alloc.item_type_id].rows.push(alloc)
    }

    // Step 4: Process each item
    const changes: any[] = []
    const corruptionFixes: any[] = []
    let stockUpdates = 0
    let distributionFixes = 0

    for (const item of (items || [])) {
      const summary = allocByItem[item.id]
      if (!summary) continue // No allocations — skip

      const newTotalStock = summary.totalAllocated
      const oldTotalStock = item.total_stock

      // Fix 1: Update total_stock to sum of allocations (if different)
      if (newTotalStock !== oldTotalStock) {
        changes.push({
          item_id: item.id,
          material_id: item.external_material_id,
          name: item.name,
          old_total_stock: oldTotalStock,
          new_total_stock: newTotalStock,
          delta: newTotalStock - oldTotalStock,
          total_allocated: summary.totalAllocated,
          total_distributed: summary.totalDistributed,
        })

        if (!dryRun) {
          await supabase.from('item_types').update({
            total_stock: newTotalStock,
            stock_locked: true,
            updated_at: new Date().toISOString(),
          }).eq('id', item.id)

          // Log the change
          await supabase.from('allocation_traceability_logs').insert({
            item_type_id: item.id,
            marketplace_name: 'SYSTEM',
            action_type: 'stock_correction',
            quantity_before: oldTotalStock,
            quantity_after: newTotalStock,
            description: `Auto-fix: total_stock corrected from ${oldTotalStock} to ${newTotalStock} (sum of all marketplace allocations). Material #${item.external_material_id}.`,
            performed_by_email: 'system@fix-allocation-data',
          })

          stockUpdates++
        }
      }

      // Fix 2: Cap distributed_quantity to allocated_quantity where corrupted
      for (const row of summary.rows) {
        if (row.distributed_quantity > row.allocated_quantity) {
          corruptionFixes.push({
            allocation_id: row.id,
            item_id: item.id,
            material_id: item.external_material_id,
            name: item.name,
            old_distributed: row.distributed_quantity,
            allocated: row.allocated_quantity,
            capped_to: row.allocated_quantity,
          })

          if (!dryRun) {
            await supabase.from('marketplace_item_allocations').update({
              distributed_quantity: row.allocated_quantity,
              updated_at: new Date().toISOString(),
            }).eq('id', row.id)

            await supabase.from('allocation_traceability_logs').insert({
              allocation_id: row.id,
              item_type_id: item.id,
              marketplace_name: 'SYSTEM',
              action_type: 'distribution_correction',
              quantity_before: row.distributed_quantity,
              quantity_after: row.allocated_quantity,
              description: `Auto-fix: distributed_quantity capped from ${row.distributed_quantity} to ${row.allocated_quantity} (was exceeding allocation). Material #${item.external_material_id}.`,
              performed_by_email: 'system@fix-allocation-data',
            })

            distributionFixes++
          }
        }
      }
    }

    const response = {
      dry_run: dryRun,
      summary: {
        total_items_scanned: items?.length || 0,
        total_allocations_scanned: allAllocations.length,
        stock_changes_needed: changes.length,
        distribution_corruptions_found: corruptionFixes.length,
        ...(dryRun ? {} : { stock_updates_applied: stockUpdates, distribution_fixes_applied: distributionFixes }),
      },
      stock_changes: changes.slice(0, 50), // Limit response size
      stock_changes_total: changes.length,
      corruption_fixes: corruptionFixes,
      message: dryRun
        ? `DRY RUN: Found ${changes.length} stock corrections and ${corruptionFixes.length} distribution corruptions. Re-run with dry_run=false to apply.`
        : `APPLIED: ${stockUpdates} stock corrections, ${distributionFixes} distribution fixes. All items locked from future sync overwrites.`,
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
