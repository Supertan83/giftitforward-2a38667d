import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PASSWORD = '12345678'

const ACCOUNTS = [
  { email: 'admin.test@gif.com', role: 'admin', first: 'Test', last: 'Admin' },
  { email: 'employee.test@gif.com', role: 'employee', first: 'Test', last: 'Employee' },
  { email: 'volunteer.test@gif.com', role: 'volunteer', first: 'Test', last: 'Volunteer' },
  { email: 'kiosk.test@gif.com', role: 'volunteer', first: 'Test', last: 'Kiosk' },
] as const

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

    const results: Record<string, unknown>[] = []

    for (const acc of ACCOUNTS) {
      let userId: string | null = null
      let state = 'created'

      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: acc.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { first_name: acc.first, last_name: acc.last },
      })

      if (createErr) {
        // Already exists -> find and reset password
        const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const existing = list?.users.find((u) => u.email?.toLowerCase() === acc.email)
        if (!existing) {
          results.push({ email: acc.email, status: `error: ${createErr.message}` })
          continue
        }
        userId = existing.id
        state = 'reset'
        await supabase.auth.admin.updateUserById(userId, {
          password: PASSWORD,
          email_confirm: true,
          user_metadata: { first_name: acc.first, last_name: acc.last },
        })
      } else {
        userId = created.user.id
      }

      // Enforce exact role
      await supabase.from('user_roles').delete().eq('user_id', userId)
      await supabase.from('user_roles').insert({ user_id: userId, role: acc.role })

      // Volunteer-facing accounts need a pending_volunteers record + QR card
      if (acc.role === 'volunteer') {
        const { data: existingPv } = await supabase
          .from('pending_volunteers')
          .select('id')
          .eq('email', acc.email)
          .is('deleted_at', null)
          .maybeSingle()

        let pvId = existingPv?.id ?? null
        if (!pvId) {
          const { data: pv } = await supabase
            .from('pending_volunteers')
            .insert({
              email: acc.email,
              first_name: acc.first,
              last_name: acc.last,
              status: 'approved',
              source: 'manual',
              created_user_id: userId,
              temp_password: PASSWORD,
            })
            .select('id')
            .single()
          pvId = pv?.id ?? null
        }

        if (pvId) {
          const { data: card } = await supabase
            .from('volunteer_qr_cards')
            .select('id')
            .eq('volunteer_id', pvId)
            .is('deleted_at', null)
            .maybeSingle()
          if (!card) {
            await supabase.from('volunteer_qr_cards').insert({
              unique_id: generateQRCode(),
              volunteer_id: pvId,
              status: 'inactive',
            })
          }
        }
      }

      results.push({ email: acc.email, password: PASSWORD, role: acc.role, status: state })
    }

    return new Response(JSON.stringify({ password: PASSWORD, accounts: results }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
