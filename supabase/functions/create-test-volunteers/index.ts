import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MARKETPLACE_ID = 'd21fba59-2bf2-4a47-bd10-f88278d4c95e'
const PASSWORD = '12345678'
const COUNT = 20

const generateQRCode = (): string => {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `VOL-${ts}-${rand}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const results: { email: string; status: string }[] = []

    for (let i = 1; i <= COUNT; i++) {
      const num = String(i).padStart(2, '0')
      const email = `test${num}@gif.com`

      // Try create user
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { first_name: `Test`, last_name: `Vol${num}` },
      })

      if (createErr) {
        if (createErr.message?.includes('already registered')) {
          results.push({ email, status: 'skipped (exists)' })
        } else {
          results.push({ email, status: `error: ${createErr.message}` })
        }
        continue
      }

      const userId = newUser.user.id

      // Role is auto-assigned by trigger, but ensure it's volunteer
      await supabase.from('user_roles').delete().eq('user_id', userId)
      await supabase.from('user_roles').insert({ user_id: userId, role: 'volunteer' })

      // Create pending_volunteers record
      const { data: pvData } = await supabase.from('pending_volunteers').insert({
        email,
        first_name: 'Test',
        last_name: `Vol${num}`,
        status: 'approved',
        source: 'manual',
        created_user_id: userId,
        temp_password: PASSWORD,
      }).select('id').single()

      // Create volunteer QR card
      if (pvData) {
        await supabase.from('volunteer_qr_cards').insert({
          unique_id: generateQRCode(),
          volunteer_id: pvData.id,
          status: 'inactive',
          marketplace_id: MARKETPLACE_ID,
        })
      }

      results.push({ email, status: 'created' })
    }

    const created = results.filter(r => r.status === 'created').length
    const skipped = results.filter(r => r.status.startsWith('skipped')).length

    return new Response(JSON.stringify({ summary: { created, skipped, total: COUNT }, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
