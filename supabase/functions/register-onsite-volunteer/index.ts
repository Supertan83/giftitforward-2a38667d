import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const generatePassword = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

const generateVolunteerQRCode = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `VOL-${timestamp}-${random}`
}

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 255
}

function formatTime(time: string | null | undefined): string {
  if (!time) return ''
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'pm' : 'am'
  const hour12 = hour % 12 || 12
  return `${String(hour12).padStart(2, '0')}.${minutes} ${ampm}`
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function generateQRCodeUrl(qrCodeId: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeId)}`
}

function buildEmailHtml(
  firstName: string, lastName: string, email: string,
  tempPassword: string, qrCodeId: string,
  marketplace?: { name: string; event_date: string | null; start_time: string | null; end_time: string | null; location: string | null } | null
): string {
  const qrCodeUrl = generateQRCodeUrl(qrCodeId)
  const loginUrl = 'https://gif.thesurpluss.com/auth'
  const trainingUrl = 'https://gif.thesurpluss.com/training'
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const heroImageUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/gif-hero-banner.jpg?v=2`
  const trainingImageUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/training-module-banner.jpg?v=2`
  const dubaiHoldingLogoUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/dubai-holding-logo.png?v=2`
  const eventDate = formatDate(marketplace?.event_date)
  const startTime = formatTime(marketplace?.start_time)
  const endTime = formatTime(marketplace?.end_time)
  const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : (startTime || endTime || '')
  const marketplaceName = marketplace?.name || 'Gift It Forward marketplace'
  const marketplaceLocation = marketplace?.location || ''

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;"><tr><td align="center" style="padding:20px 0;">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;max-width:600px;">
<tr><td><img src="${heroImageUrl}" alt="Gift It Forward" width="600" style="display:block;width:100%;height:auto;"/></td></tr>
<tr><td style="padding:30px 30px 20px 30px;text-align:center;"><h1 style="margin:0;font-size:28px;color:#1a1a1a;font-weight:normal;line-height:1.3;">Thank you for registering<br>as a Gift It Forward volunteer</h1></td></tr>
<tr><td style="padding:0 30px 15px 30px;"><p style="margin:0;font-size:15px;color:#333333;"><strong>Dear ${firstName} ${lastName},</strong></p></td></tr>
<tr><td style="padding:0 30px 15px 30px;"><p style="margin:0;font-size:14px;color:#333333;line-height:1.6;">Your volunteer registration has been <strong>successfully confirmed</strong> for the <strong>${marketplaceName}</strong>${eventDate ? ' taking place on:' : '.'}</p></td></tr>
${eventDate || marketplaceLocation || timeRange ? `<tr><td style="padding:0 30px 20px 30px;"><ul style="margin:0;padding-left:20px;font-size:14px;color:#333333;line-height:1.8;">${eventDate ? `<li><strong>Date:</strong> ${eventDate}</li>` : ''}${marketplaceLocation ? `<li><strong>Location:</strong> ${marketplaceLocation}</li>` : ''}${timeRange ? `<li><strong>Timings:</strong> ${timeRange}</li>` : ''}</ul></td></tr>` : ''}
<tr><td style="padding:0 30px 20px 30px;"><p style="margin:0 0 10px 0;font-size:14px;color:#333333;">Here are a few helpful reminders before the event:</p>
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:5px 0;font-size:14px;color:#333333;line-height:1.6;"><strong>a. Arrival:</strong> Gates open 15 minutes before the marketplace begins. We recommend arriving a bit early to allow time for a smooth check-in.</td></tr>
<tr><td style="padding:5px 0;font-size:14px;color:#333333;line-height:1.6;"><strong>b. Your QR code:</strong> Please have your QR code ready on your phone – it helps us clock you in and out quickly.</td></tr>
<tr><td style="padding:5px 0;font-size:14px;color:#333333;line-height:1.6;"><strong>c. Bring this email:</strong> Having this confirmation handy will help us welcome you at the venue without any delays.</td></tr>
<tr><td style="padding:5px 0;font-size:14px;color:#333333;line-height:1.6;"><strong>d. Your registration:</strong> This registration is linked to your name, so please make sure you're the one attending.</td></tr>
</table></td></tr>
<tr><td style="padding:0 30px 10px 30px;background-color:#f8f8f8;"><h3 style="margin:20px 0 10px 0;font-size:16px;color:#1a1a1a;font-weight:bold;">Your volunteer QR code</h3><p style="margin:0 0 15px 0;font-size:13px;color:#333333;line-height:1.5;">We recommend saving it on your phone and keeping a screenshot available offline.</p></td></tr>
<tr><td style="padding:0 30px 10px 30px;background-color:#f8f8f8;"><img src="${qrCodeUrl}" alt="Volunteer QR Code" width="150" height="150" style="display:block;"/></td></tr>
<tr><td style="padding:0 30px 15px 30px;background-color:#f8f8f8;"><p style="margin:0;font-size:12px;color:#666666;">QR Card ID: ${qrCodeId}</p></td></tr>
<tr><td style="padding:0 30px 20px 30px;background-color:#f8f8f8;"><p style="margin:0 0 8px 0;font-size:14px;color:#333333;font-weight:bold;">Your QR code allows you to:</p><ul style="margin:0;padding-left:20px;font-size:14px;color:#333333;line-height:1.8;"><li>Record your attendance.</li><li>Track volunteer hours.</li><li>Receive your official <strong>Gift It Forward 2026 volunteer certificate</strong>.</li></ul></td></tr>
<tr><td style="padding:20px 30px 10px 30px;border-top:2px solid #e5e7eb;"><p style="margin:0 0 15px 0;font-size:14px;color:#333333;text-decoration:underline;font-weight:bold;">Your login credentials for the training & marketplace platform</p><p style="margin:0 0 10px 0;font-size:13px;color:#333333;line-height:1.6;">You'll need these details to complete the <strong>Circular Economy Training Module</strong> and access the <strong>marketplace platform</strong> on event day:</p></td></tr>
<tr><td style="padding:0 30px 5px 30px;"><p style="margin:0;font-size:13px;color:#333333;"><strong>Email:</strong> ${email}</p></td></tr>
<tr><td style="padding:0 30px 15px 30px;"><p style="margin:0;font-size:13px;color:#333333;"><strong>Temporary Password:</strong> ${tempPassword}</p></td></tr>
<tr><td style="padding:0 30px 25px 30px;"><p style="margin:0;font-size:13px;color:#DA291C;font-weight:bold;">Please save these credentials – you'll need them to start the training below.</p></td></tr>
<tr><td style="padding:0 30px 25px 30px;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;"><tr><td width="50%" valign="top"><img src="${trainingImageUrl}" alt="Your Role in the Circular Economy" width="270" style="display:block;width:100%;height:auto;"/></td><td width="50%" valign="top" style="padding:20px;"><h3 style="margin:0 0 10px 0;font-size:14px;color:#1a1a1a;font-weight:bold;">Circular Economy Training Module</h3><p style="margin:0 0 15px 0;font-size:13px;color:#333333;line-height:1.5;">Before attending your first marketplace, we encourage volunteers to complete this short module. It introduces the campaign's sustainability goals and highlights how actions contribute to reducing waste. Volunteers who complete the training receive a certificate of completion.</p><a href="${trainingUrl}" style="display:inline-block;background-color:#DA291C;color:#ffffff;padding:10px 20px;text-decoration:none;font-size:13px;font-weight:600;border-radius:4px;">Start Training</a></td></tr></table></td></tr>
<tr><td style="padding:0 30px 10px 30px;"><h3 style="margin:0 0 10px 0;font-size:15px;color:#1a1a1a;font-weight:bold;">On-site marketplace access</h3><p style="margin:0 0 15px 0;font-size:13px;color:#333333;line-height:1.5;">During the marketplace, you may be asked to use the Gift It Forward marketplace management platform via your web browser, which supports on-site activities such as inventory tracking and beneficiary flow, depending on your assigned role.</p></td></tr>
<tr><td style="padding:0 30px 25px 30px;"><a href="${loginUrl}" style="display:inline-block;background-color:#DA291C;color:#ffffff;padding:10px 20px;text-decoration:none;font-size:13px;font-weight:600;border-radius:4px;">Login to the platform</a></td></tr>
<tr><td style="padding:0 30px 20px 30px;"><h3 style="margin:0 0 10px 0;font-size:15px;color:#1a1a1a;font-weight:bold;">What's next?</h3><ul style="margin:0;padding-left:20px;font-size:13px;color:#333333;line-height:1.8;"><li>Save this event to your calendar.</li><li>Look out for reminder emails and WhatsApp notifications closer to each event.</li><li>If you have any questions, please contact <a href="mailto:giftitforward@dubaiholding.com" style="color:#0D4A6F;">giftitforward@dubaiholding.com</a>.</li><li>If you or a family member have any specific medical conditions, please contact The Surpluss team ahead of the event so we can ensure a safe and supportive volunteering experience.</li></ul></td></tr>
<tr><td style="padding:0 30px 20px 30px;"><p style="margin:0 0 15px 0;font-size:13px;color:#333333;line-height:1.5;">Thank you for being part of this meaningful initiative. We look forward to welcoming you on-site.</p><p style="margin:0 0 3px 0;font-size:13px;color:#333333;">Best regards,</p><p style="margin:0;font-size:13px;color:#1a1a1a;font-weight:600;">Gift It Forward team</p></td></tr>
<tr><td style="padding:20px 30px;border-top:1px solid #e5e7eb;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td width="50%" valign="middle"><img src="${dubaiHoldingLogoUrl}" alt="Dubai Holding" height="40" style="display:block;"/></td><td width="50%" valign="middle" style="text-align:right;"><p style="margin:0;font-size:12px;color:#666666;font-style:italic;">For the Good of Tomorrow</p></td></tr></table></td></tr>
</table></td></tr></table></body></html>`
}

async function getMicrosoftAccessToken(): Promise<string | null> {
  const tenantId = Deno.env.get('AZURE_TENANT_ID')
  const clientId = Deno.env.get('AZURE_CLIENT_ID')
  const clientSecret = Deno.env.get('AZURE_CLIENT_SECRET')
  if (!tenantId || !clientId || !clientSecret) return null
  try {
    const resp = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }),
    })
    if (!resp.ok) return null
    const data = await resp.json()
    return data.access_token
  } catch { return null }
}

async function sendEmailViaMicrosoft(accessToken: string, senderEmail: string, recipientEmail: string, htmlContent: string, bccAddress?: string): Promise<boolean> {
  try {
    const msg: any = { message: { subject: 'Welcome to GIF (Gift it Forward) - Your Volunteer Account', body: { contentType: 'HTML', content: htmlContent }, toRecipients: [{ emailAddress: { address: recipientEmail } }] }, saveToSentItems: true }
    if (bccAddress) msg.message.bccRecipients = [{ emailAddress: { address: bccAddress } }]
    const resp = await fetch(`https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`, { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(msg) })
    return resp.ok
  } catch { return false }
}

async function sendEmailViaResend(resend: InstanceType<typeof Resend>, recipientEmail: string, htmlContent: string): Promise<boolean> {
  try {
    const result = await resend.emails.send({ from: 'Gift It Forward <giftitforward@dubaiholding.com>', to: [recipientEmail], bcc: ['giftitforward@dubaiholding.com'], subject: 'Welcome to GIF (Gift it Forward) - Your Volunteer Account', html: htmlContent })
    return !result.error
  } catch { return false }
}

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

    const body = await req.json()
    const { first_name, last_name, email, marketplace_id, gender, company_name } = body

    // Validate inputs
    if (!first_name?.trim() || !last_name?.trim()) {
      return new Response(JSON.stringify({ success: false, error: 'First name and last name are required.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!email?.trim() || !isValidEmail(email.trim())) {
      return new Response(JSON.stringify({ success: false, error: 'A valid email address is required.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!marketplace_id?.trim()) {
      return new Response(JSON.stringify({ success: false, error: 'Please select a marketplace event.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const cleanEmail = email.trim().toLowerCase()
    const cleanFirstName = first_name.trim()
    const cleanLastName = last_name.trim()

    // Duplicate check
    const { data: existing } = await supabaseAdmin
      .from('pending_volunteers')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle()

    if (existing) {
      return new Response(JSON.stringify({ success: false, error: 'Email already registered. Please check your QR code or reach out to a Team Lead onsite for assistance.' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get marketplace details
    const { data: marketplace } = await supabaseAdmin
      .from('marketplace_events')
      .select('name, event_date, start_time, end_time, location')
      .eq('id', marketplace_id)
      .maybeSingle()

    // Create auth user
    const tempPassword = generatePassword()
    const qrCodeId = generateVolunteerQRCode()

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { first_name: cleanFirstName, last_name: cleanLastName },
    })

    if (createError) {
      if (createError.message?.includes('already registered')) {
        return new Response(JSON.stringify({ success: false, error: 'Email already registered. Please check your QR code or reach out to a Team Lead onsite for assistance.' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      throw createError
    }

    // Assign volunteer role
    await supabaseAdmin.from('user_roles').delete().eq('user_id', newUser.user.id)
    await supabaseAdmin.from('user_roles').insert({ user_id: newUser.user.id, role: 'volunteer' })

    // Create QR card
    await supabaseAdmin.from('volunteer_qr_cards').insert({
      unique_id: qrCodeId,
      volunteer_id: null,
      status: 'inactive',
    })

    // Create pending volunteer record
    await supabaseAdmin.from('pending_volunteers').insert({
      email: cleanEmail,
      first_name: cleanFirstName,
      last_name: cleanLastName,
      temp_password: tempPassword,
      status: 'approved',
      email_sent: false,
      source: 'onsite_registration',
      created_user_id: newUser.user.id,
      gender: gender?.trim() || null,
      external_company: company_name?.trim() || null,
      is_employee: false,
      events_list: marketplace?.name || null,
    })

    // Build and send email
    const htmlContent = buildEmailHtml(cleanFirstName, cleanLastName, cleanEmail, tempPassword, qrCodeId, marketplace)

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const resend = resendApiKey ? new Resend(resendApiKey) : null
    const microsoftToken = await getMicrosoftAccessToken()
    const senderEmail = Deno.env.get('SENDER_EMAIL') || 'noreply@thesurpluss.com'
    const bccAddress = Deno.env.get('HUBSPOT_BCC_ADDRESS') || 'giftitforward@dubaiholding.com'

    let emailSent = false
    if (microsoftToken) {
      emailSent = await sendEmailViaMicrosoft(microsoftToken, senderEmail, cleanEmail, htmlContent, bccAddress)
    }
    if (!emailSent && resend) {
      emailSent = await sendEmailViaResend(resend, cleanEmail, htmlContent)
    }

    if (emailSent) {
      await supabaseAdmin.from('pending_volunteers').update({ email_sent: true, email_sent_at: new Date().toISOString() }).eq('email', cleanEmail)
    }

    await supabaseAdmin.from('email_send_logs').insert({
      recipient_email: cleanEmail,
      email_type: 'onsite_welcome',
      provider: microsoftToken ? 'microsoft_graph' : 'resend',
      success: emailSent,
      error_message: emailSent ? null : 'Failed to send welcome email',
    })

    return new Response(JSON.stringify({
      success: true,
      qr_code_id: qrCodeId,
      volunteer_name: `${cleanFirstName} ${cleanLastName}`,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Error in register-onsite-volunteer:', error)
    return new Response(JSON.stringify({ success: false, error: 'An unexpected error occurred. Please try again.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
