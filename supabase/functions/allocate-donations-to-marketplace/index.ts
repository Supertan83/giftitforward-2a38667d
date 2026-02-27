import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FIRST_HALF_ID = 'ff0d8005-7c85-4a8d-9e0c-147475e7b0eb'
const SECOND_HALF_ID = '1e38fa11-da12-42d0-8e74-3ce9dd41f964'
const DONATIONS_URL = 'https://api.thesurpluss.com/api/common/donations'

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

    // Fetch all pages of donations
    const allDonations: any[] = []
    let page = 0
    let hasMore = true
    while (hasMore) {
      const url = `${DONATIONS_URL}?page=${page}&size=50`
      console.log(`Fetching page ${page}: ${url}`)
      const res = await fetch(url, { headers })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`API ${res.status}: ${text.substring(0, 200)}`)
      }
      const data = await res.json()
      const items = data.items || data.data || []
      allDonations.push(...items)
      const total = data.total ?? items.length
      hasMore = allDonations.length < total && items.length > 0
      page++
    }

    console.log(`Total donations fetched: ${allDonations.length}`)

    const results: any[] = []

    for (const donation of allDonations) {
      const materialId = donation.id
      const title = donation.title || `Material ${materialId}`
      const itemCount = donation.item_count || 0

      if (itemCount <= 0) {
        results.push({ title, materialId, status: 'skipped (0 items)' })
        continue
      }

      // Extract category from tags if available
      const tags = donation.tags || donation.material_group || {}
      const category = tags.name || tags.category || null
      const subcategory = tags.subcategory || null

      // Find or create item_type
      let { data: itemType } = await supabase
        .from('item_types')
        .select('id')
        .eq('external_material_id', materialId)
        .maybeSingle()

      if (itemType) {
        // Update total_stock
        await supabase
          .from('item_types')
          .update({ total_stock: itemCount, updated_at: new Date().toISOString() })
          .eq('id', itemType.id)
      } else {
        const { data: newItem, error } = await supabase
          .from('item_types')
          .insert({
            name: title,
            external_material_id: materialId,
            icon: 'Package',
            total_stock: itemCount,
            category,
            subcategory,
            surpluss_url: `https://platform.thesurpluss.com/material/${materialId}`,
          })
          .select('id')
          .single()

        if (error) {
          results.push({ title, materialId, status: `error creating item: ${error.message}` })
          continue
        }
        itemType = newItem
      }

      // Split evenly
      const firstHalfQty = Math.ceil(itemCount / 2)
      const secondHalfQty = Math.floor(itemCount / 2)

      // Allocate to both marketplaces
      for (const [mktId, qty] of [[FIRST_HALF_ID, firstHalfQty], [SECOND_HALF_ID, secondHalfQty]] as [string, number][]) {
        const { data: existing } = await supabase
          .from('marketplace_item_allocations')
          .select('id')
          .eq('marketplace_id', mktId)
          .eq('item_type_id', itemType!.id)
          .maybeSingle()

        if (existing) {
          results.push({ title, materialId, marketplace: mktId === FIRST_HALF_ID ? 'first_half' : 'second_half', qty, status: 'skipped (exists)' })
          continue
        }

        const { error: allocErr } = await supabase
          .from('marketplace_item_allocations')
          .insert({
            marketplace_id: mktId,
            item_type_id: itemType!.id,
            allocated_quantity: qty,
            distributed_quantity: 0,
          })

        results.push({
          title,
          materialId,
          marketplace: mktId === FIRST_HALF_ID ? 'first_half' : 'second_half',
          qty,
          status: allocErr ? `error: ${allocErr.message}` : 'allocated',
        })
      }
    }

    const allocated = results.filter(r => r.status === 'allocated').length
    const skipped = results.filter(r => r.status?.startsWith('skipped')).length
    const errors = results.filter(r => r.status?.startsWith('error')).length

    return new Response(JSON.stringify({
      summary: { total_donations: allDonations.length, allocations_created: allocated, skipped, errors },
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
