import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const BASE_URL = 'https://api.thesurpluss.com'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const apiKey = Deno.env.get('SURPLUSS_API_KEY')
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
      headers['x-api-key'] = apiKey
    }

    // Get all marketplaces that have an external_id (linked to Surpluss)
    const { data: marketplaces, error: mpErr } = await supabase
      .from('marketplace_events')
      .select('id, name, external_id')
      .not('external_id', 'is', null)

    if (mpErr || !marketplaces?.length) {
      return new Response(JSON.stringify({
        success: false,
        error: mpErr?.message || 'No linked marketplaces found',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const allResults: any[] = []

    for (const marketplace of marketplaces) {
      console.log(`Processing marketplace: ${marketplace.name} (ext_id: ${marketplace.external_id})`)

      // Fetch donation-allocations for this specific event with pagination
      const allocations: any[] = []
      let page = 1
      let hasMore = true

      while (hasMore && page <= 20) {
        const url = `${BASE_URL}/api/common/donation-allocations?event_id=${marketplace.external_id}&limit=100&page=${page}`
        console.log(`Fetching page ${page}: ${url}`)
        const res = await fetch(url, { headers })
        if (!res.ok) {
          const text = await res.text()
          console.error(`API error: ${res.status} ${text.substring(0, 200)}`)
          break
        }
        const data = await res.json()
        const items = Array.isArray(data) ? data : (data.data || [])
        if (!Array.isArray(items) || items.length === 0) {
          hasMore = false
        } else {
          allocations.push(...items)
          const meta = data.meta || {}
          const total = meta.total ?? 0
          hasMore = total > 0 ? allocations.length < total : items.length === 100
          page++
        }
      }

      console.log(`Event ${marketplace.external_id}: ${allocations.length} allocation records`)

      // Aggregate materials by materialId to handle duplicates
      const materialMap = new Map<number, { title: string; totalAmount: number; category: string | null; subcategory: string | null }>()

      for (const alloc of allocations) {
        const materials = alloc.allocated_materials || []

        if (materials.length > 0) {
          for (const mat of materials) {
            const materialId = mat.material_id || mat.donation_metadata_id
            const title = mat.material_title || mat.title || `Material ${materialId}`
            const amount = mat.amount || 0
            const category = mat.donation_tag_name || null
            const subcategory = mat.donation_tag_subcategory_name || null

            if (!materialId || amount <= 0) continue

            const existing = materialMap.get(materialId)
            if (existing) {
              existing.totalAmount += amount
            } else {
              materialMap.set(materialId, { title, totalAmount: amount, category, subcategory })
            }
          }
        } else {
          // Fallback: legacy format
          const materialId = alloc.donation_metadata?.id || alloc.material_id || alloc.donation_metadata_id
          const title = alloc.donation_metadata?.title || alloc.title || `Material ${materialId}`
          const amount = alloc.amount || alloc.total_amount || 0

          if (!materialId || amount <= 0) continue

          const existing = materialMap.get(materialId)
          if (existing) {
            existing.totalAmount += amount
          } else {
            materialMap.set(materialId, { title, totalAmount: amount, category: null, subcategory: null })
          }
        }
      }

      console.log(`Event ${marketplace.external_id}: ${materialMap.size} unique materials after aggregation`)

      // Now upsert once per material with the correct total
      for (const [materialId, { title, totalAmount, category, subcategory }] of materialMap) {
        const result = await upsertAllocation(supabase, marketplace, materialId, title, totalAmount, category, subcategory)
        allResults.push(result)
      }
    }

    const allocated = allResults.filter(r => r.status === 'allocated' || r.status === 'updated').length
    const skipped = allResults.filter(r => r.status?.startsWith('skipped')).length
    const errors = allResults.filter(r => r.status?.startsWith('error')).length

    return new Response(JSON.stringify({
      summary: { marketplaces_processed: marketplaces.length, allocations_synced: allocated, skipped, errors },
      results: allResults,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function upsertAllocation(
  supabase: any,
  marketplace: { id: string; name: string; external_id: number },
  materialId: number,
  title: string,
  amount: number,
  category: string | null,
  subcategory: string | null,
) {
  // Find or create item_type
  let { data: itemType } = await supabase
    .from('item_types')
    .select('id')
    .eq('external_material_id', materialId)
    .maybeSingle()

  if (!itemType) {
    const insertData: any = {
      name: title,
      external_material_id: materialId,
      icon: 'Package',
      total_stock: 0,
      surpluss_url: `https://platform.thesurpluss.com/material/${materialId}`,
    }
    if (category) insertData.category = category
    if (subcategory) insertData.subcategory = subcategory

    const { data: newItem, error } = await supabase
      .from('item_types')
      .insert(insertData)
      .select('id')
      .single()

    if (error) {
      return { title, materialId, marketplace: marketplace.name, status: `error: ${error.message}` }
    }
    itemType = newItem
  }

  // Upsert marketplace_item_allocations
  const { data: existing } = await supabase
    .from('marketplace_item_allocations')
    .select('id, allocated_quantity')
    .eq('marketplace_id', marketplace.id)
    .eq('item_type_id', itemType!.id)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('marketplace_item_allocations')
      .update({ allocated_quantity: amount, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    return { title, materialId, marketplace: marketplace.name, qty: amount, status: 'updated' }
  }

  const { error: allocErr } = await supabase
    .from('marketplace_item_allocations')
    .insert({
      marketplace_id: marketplace.id,
      item_type_id: itemType!.id,
      allocated_quantity: amount,
      distributed_quantity: 0,
    })

  return {
    title,
    materialId,
    marketplace: marketplace.name,
    qty: amount,
    status: allocErr ? `error: ${allocErr.message}` : 'allocated',
  }
}
