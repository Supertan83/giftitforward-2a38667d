import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VolunteerInput {
  email: string
  firstName: string
  lastName: string
  eventName?: string
  eventDate?: string
  eventTime?: string
  eventLocation?: string
  gender?: string
  companyName?: string
  isDhEmployee?: boolean
}

interface VolunteerResult {
  email: string
  status: 'created' | 'exists' | 'error'
  error?: string
  userId?: string
}

interface MarketplaceEvent {
  name: string
  event_date: string | null
  start_time: string | null
  end_time: string | null
  location: string | null
}

// Generate a secure random password
const generatePassword = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

// Generate a unique volunteer QR code ID
const generateVolunteerQRCode = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `VOL-${timestamp}-${random}`
}

// Validate email format
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 255
}

// Format time from HH:MM:SS to readable format (07.00 am style)
function formatTime(time: string | null | undefined): string {
  if (!time) return ''
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'pm' : 'am'
  const hour12 = hour % 12 || 12
  return `${String(hour12).padStart(2, '0')}.${minutes} ${ampm}`
}

// Format date to readable format (February 19, 2026)
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric',
    year: 'numeric' 
  })
}

// Generate QR code URL
function generateQRCodeUrl(qrCodeId: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeId)}`
}

// Build email HTML content - Marketing Approved Design (same as send-welcome-email)
function buildEmailHtml(
  firstName: string,
  lastName: string,
  email: string,
  tempPassword: string,
  qrCodeId: string,
  marketplace?: MarketplaceEvent | null
): string {
  const qrCodeUrl = generateQRCodeUrl(qrCodeId)
  const loginUrl = 'https://gif.thesurpluss.com/auth'
  const trainingUrl = 'https://gif.thesurpluss.com/training'
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  
  // Email assets URLs
  const heroImageUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/gif-hero-banner.jpg`
  const trainingImageUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/training-module-banner.jpg`
  const dubaiHoldingLogoUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/dubai-holding-logo.png`

  // Format marketplace details
  const eventDate = formatDate(marketplace?.event_date)
  const startTime = formatTime(marketplace?.start_time)
  const endTime = formatTime(marketplace?.end_time)
  const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : (startTime || endTime || '')
  const marketplaceName = marketplace?.name || 'Gift It Forward marketplace'
  const marketplaceLocation = marketplace?.location || ''

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; max-width: 600px;">
              
              <!-- Hero Image -->
              <tr>
                <td>
                  <img src="${heroImageUrl}" alt="Gift It Forward" width="600" style="display: block; width: 100%; height: auto;" />
                </td>
              </tr>
              
              <!-- Main Title -->
              <tr>
                <td style="padding: 30px 30px 20px 30px; text-align: center;">
                  <h1 style="margin: 0; font-size: 28px; color: #1a1a1a; font-weight: normal; line-height: 1.3;">
                    Thank you for registering<br>as a Gift It Forward volunteer
                  </h1>
                </td>
              </tr>
              
              <!-- Greeting -->
              <tr>
                <td style="padding: 0 30px 15px 30px;">
                  <p style="margin: 0; font-size: 15px; color: #333333;"><strong>Dear ${firstName} ${lastName},</strong></p>
                </td>
              </tr>
              
              <!-- Intro Text -->
              <tr>
                <td style="padding: 0 30px 15px 30px;">
                  <p style="margin: 0; font-size: 14px; color: #333333; line-height: 1.6;">
                    Your volunteer registration has been <strong>successfully confirmed</strong> for the <strong>${marketplaceName}</strong>${eventDate ? ' taking place on:' : '.'}
                  </p>
                </td>
              </tr>
              
              <!-- Event Details -->
              ${eventDate || marketplaceLocation || timeRange ? `
              <tr>
                <td style="padding: 0 30px 20px 30px;">
                  <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #333333; line-height: 1.8;">
                    ${eventDate ? `<li><strong>Date:</strong> ${eventDate}</li>` : ''}
                    ${marketplaceLocation ? `<li><strong>Location:</strong> ${marketplaceLocation}</li>` : ''}
                    ${timeRange ? `<li><strong>Timings:</strong> ${timeRange}</li>` : ''}
                  </ul>
                </td>
              </tr>
              ` : ''}
              
              <!-- Helpful Reminders -->
              <tr>
                <td style="padding: 0 30px 20px 30px;">
                  <p style="margin: 0 0 10px 0; font-size: 14px; color: #333333;">Here are a few helpful reminders before the event:</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding: 5px 0; font-size: 14px; color: #333333; line-height: 1.6;">
                        <strong>a. Arrival:</strong> Gates open 15 minutes before the marketplace begins. We recommend arriving a bit early to allow time for a smooth check-in.
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 5px 0; font-size: 14px; color: #333333; line-height: 1.6;">
                        <strong>b. Your QR code:</strong> Please have your QR code ready on your phone – it helps us clock you in and out quickly.
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 5px 0; font-size: 14px; color: #333333; line-height: 1.6;">
                        <strong>c. Bring this email:</strong> Having this confirmation handy will help us welcome you at the venue without any delays.
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 5px 0; font-size: 14px; color: #333333; line-height: 1.6;">
                        <strong>d. Your registration:</strong> This registration is linked to your name, so please make sure you're the one attending.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- QR Code Section Header -->
              <tr>
                <td style="padding: 0 30px 10px 30px; background-color: #f8f8f8;">
                  <h3 style="margin: 20px 0 10px 0; font-size: 16px; color: #1a1a1a; font-weight: bold;">Your volunteer QR code</h3>
                  <p style="margin: 0 0 15px 0; font-size: 13px; color: #333333; line-height: 1.5;">
                    We recommend saving it on your phone and keeping a screenshot available offline.
                  </p>
                </td>
              </tr>
              
              <!-- QR Code -->
              <tr>
                <td style="padding: 0 30px 10px 30px; background-color: #f8f8f8;">
                  <img src="${qrCodeUrl}" alt="Volunteer QR Code" width="150" height="150" style="display: block;" />
                </td>
              </tr>
              
              <tr>
                <td style="padding: 0 30px 15px 30px; background-color: #f8f8f8;">
                  <p style="margin: 0; font-size: 12px; color: #666666;">QR Card ID: ${qrCodeId}</p>
                </td>
              </tr>
              
              <!-- QR Code Benefits -->
              <tr>
                <td style="padding: 0 30px 20px 30px; background-color: #f8f8f8;">
                  <p style="margin: 0 0 8px 0; font-size: 14px; color: #333333; font-weight: bold;">Your QR code allows you to:</p>
                  <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #333333; line-height: 1.8;">
                    <li>Record your attendance.</li>
                    <li>Track volunteer hours.</li>
                    <li>Receive your official <strong>Gift It Forward 2026 volunteer certificate</strong>.</li>
                  </ul>
                </td>
              </tr>
              
              <!-- Login Credentials Section -->
              <tr>
                <td style="padding: 20px 30px 10px 30px; border-top: 2px solid #e5e7eb;">
                  <p style="margin: 0 0 15px 0; font-size: 14px; color: #333333; text-decoration: underline; font-weight: bold;">Your login credentials for the training & marketplace platform</p>
                  <p style="margin: 0 0 10px 0; font-size: 13px; color: #333333; line-height: 1.6;">
                    You'll need these details to complete the <strong>Circular Economy Training Module</strong> and access the <strong>marketplace platform</strong> on event day:
                  </p>
                </td>
              </tr>
              
              <tr>
                <td style="padding: 0 30px 5px 30px;">
                  <p style="margin: 0; font-size: 13px; color: #333333;"><strong>Email:</strong> ${email}</p>
                </td>
              </tr>
              
              <tr>
                <td style="padding: 0 30px 15px 30px;">
                  <p style="margin: 0; font-size: 13px; color: #333333;"><strong>Temporary Password:</strong> ${tempPassword}</p>
                </td>
              </tr>
              
              <tr>
                <td style="padding: 0 30px 25px 30px;">
                  <p style="margin: 0; font-size: 13px; color: #DA291C; font-weight: bold;">Please save these credentials – you'll need them to start the training below.</p>
                </td>
              </tr>
              
              <!-- Training Section -->
              <tr>
                <td style="padding: 0 30px 25px 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb;">
                    <tr>
                      <td width="50%" valign="top">
                        <img src="${trainingImageUrl}" alt="Your Role in the Circular Economy" width="270" style="display: block; width: 100%; height: auto;" />
                      </td>
                      <td width="50%" valign="top" style="padding: 20px;">
                        <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #1a1a1a; font-weight: bold;">Circular Economy Training Module</h3>
                        <p style="margin: 0 0 15px 0; font-size: 13px; color: #333333; line-height: 1.5;">
                          Before attending your first marketplace, we encourage volunteers to complete this short module. It introduces the campaign's sustainability goals and highlights how actions contribute to reducing waste. Volunteers who complete the training receive a certificate of completion.
                        </p>
                        <a href="${trainingUrl}" style="display: inline-block; background-color: #DA291C; color: #ffffff; padding: 10px 20px; text-decoration: none; font-size: 13px; font-weight: 600; border-radius: 4px;">Start Training</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- On-site Marketplace Access -->
              <tr>
                <td style="padding: 0 30px 10px 30px;">
                  <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #1a1a1a; font-weight: bold;">On-site marketplace access</h3>
                  <p style="margin: 0 0 15px 0; font-size: 13px; color: #333333; line-height: 1.5;">
                    During the marketplace, you may be asked to use the Gift It Forward marketplace management platform via your web browser, which supports on-site activities such as inventory tracking and beneficiary flow, depending on your assigned role.
                  </p>
                </td>
              </tr>
              
              <tr>
                <td style="padding: 0 30px 25px 30px;">
                  <a href="${loginUrl}" style="display: inline-block; background-color: #DA291C; color: #ffffff; padding: 10px 20px; text-decoration: none; font-size: 13px; font-weight: 600; border-radius: 4px;">Login to the platform</a>
                </td>
              </tr>
              
              <!-- What's Next Section -->
              <tr>
                <td style="padding: 0 30px 20px 30px;">
                  <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #1a1a1a; font-weight: bold;">What's next?</h3>
                  <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #333333; line-height: 1.8;">
                    <li>Save this event to your calendar.</li>
                    <li>Look out for reminder emails and WhatsApp notifications closer to each event.</li>
                    <li>If you have any questions, please contact <a href="mailto:giftitforward@dubaiholding.com" style="color: #0D4A6F;">giftitforward@dubaiholding.com</a>.</li>
                    <li>If you or a family member have any specific medical conditions, please contact The Surpluss team ahead of the event so we can ensure a safe and supportive volunteering experience. You can reach the team at <a href="mailto:giftitforward@dubaiholding.com" style="color: #0D4A6F;">giftitforward@dubaiholding.com</a>.</li>
                  </ul>
                </td>
              </tr>
              
              <!-- Closing -->
              <tr>
                <td style="padding: 0 30px 20px 30px;">
                  <p style="margin: 0 0 15px 0; font-size: 13px; color: #333333; line-height: 1.5;">
                    Thank you for being part of this meaningful initiative. We look forward to welcoming you on-site.
                  </p>
                  <p style="margin: 0 0 3px 0; font-size: 13px; color: #333333;">Best regards,</p>
                  <p style="margin: 0; font-size: 13px; color: #1a1a1a; font-weight: 600;">Gift It Forward team</p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 20px 30px; border-top: 1px solid #e5e7eb;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="50%" valign="middle">
                        <img src="${dubaiHoldingLogoUrl}" alt="Dubai Holding" height="40" style="display: block;" />
                      </td>
                      <td width="50%" valign="middle" style="text-align: right;">
                        <p style="margin: 0; font-size: 12px; color: #666666; font-style: italic;">For the Good of Tomorrow</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

// Get Microsoft Graph access token
async function getMicrosoftAccessToken(): Promise<string | null> {
  const tenantId = Deno.env.get('AZURE_TENANT_ID')
  const clientId = Deno.env.get('AZURE_CLIENT_ID')
  const clientSecret = Deno.env.get('AZURE_CLIENT_SECRET')

  if (!tenantId || !clientId || !clientSecret) {
    console.log('Microsoft Graph credentials not configured')
    return null
  }

  try {
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }),
      }
    )

    if (!tokenResponse.ok) {
      console.error('Failed to get Microsoft token')
      return null
    }

    const tokenData = await tokenResponse.json()
    return tokenData.access_token
  } catch (error) {
    console.error('Error getting Microsoft token:', error)
    return null
  }
}

// Send welcome email via Microsoft Graph
async function sendWelcomeEmailViaMicrosoft(
  accessToken: string,
  senderEmail: string,
  recipientEmail: string,
  htmlContent: string,
  bccAddress?: string
): Promise<boolean> {
  const subject = 'Welcome to GIF (Gift it Forward) - Your Volunteer Account'

  try {
    const emailMessage: any = {
      message: {
        subject,
        body: { contentType: 'HTML', content: htmlContent },
        toRecipients: [{ emailAddress: { address: recipientEmail } }],
      },
      saveToSentItems: true,
    }

    if (bccAddress) {
      emailMessage.message.bccRecipients = [{ emailAddress: { address: bccAddress } }]
    }

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailMessage),
      }
    )

    return response.ok
  } catch (error) {
    console.error('Error sending via Microsoft:', error)
    return false
  }
}

// Send welcome email via Resend
async function sendWelcomeEmailViaResend(
  resend: InstanceType<typeof Resend>,
  recipientEmail: string,
  htmlContent: string
): Promise<boolean> {
  try {
    const result = await resend.emails.send({
      from: 'Gift It Forward <giftitforward@dubaiholding.com>',
      to: [recipientEmail],
      bcc: ['giftitforward@dubaiholding.com'],
      subject: 'Welcome to GIF (Gift it Forward) - Your Volunteer Account',
      html: htmlContent,
    })
    
    if (result.error) {
      console.error('Resend email error:', result.error.message)
    }
    
    return !result.error
  } catch (error) {
    console.error('Error sending via Resend:', error)
    return false
  }
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

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !requestingUser) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if requesting user is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse request body
    let body
    try {
      body = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { volunteers } = body as { volunteers: VolunteerInput[] }

    if (!volunteers || !Array.isArray(volunteers) || volunteers.length === 0) {
      return new Response(JSON.stringify({ error: 'No volunteers provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (volunteers.length > 100) {
      return new Response(JSON.stringify({ error: 'Maximum 100 volunteers per batch' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Initialize email services
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const resend = resendApiKey ? new Resend(resendApiKey) : null
    const microsoftToken = await getMicrosoftAccessToken()
    const senderEmail = Deno.env.get('SENDER_EMAIL') || 'noreply@thesurpluss.com'
    const bccAddress = Deno.env.get('HUBSPOT_BCC_ADDRESS') || 'giftitforward@dubaiholding.com'

    const results: VolunteerResult[] = []

    // Get all existing users to check for duplicates
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingEmails = new Set(existingUsers?.users?.map(u => u.email?.toLowerCase()) || [])

    for (const volunteer of volunteers) {
      const email = volunteer.email?.trim().toLowerCase()
      const firstName = volunteer.firstName?.trim() || ''
      const lastName = volunteer.lastName?.trim() || ''
      const eventName = volunteer.eventName?.trim() || null
      const eventDate = volunteer.eventDate?.trim() || null
      const eventTime = volunteer.eventTime?.trim() || null
      const eventLocation = volunteer.eventLocation?.trim() || null
      const gender = volunteer.gender?.trim() || null
      const companyName = volunteer.companyName?.trim() || null
      const isDhEmployeeStr = String(volunteer.isDhEmployee ?? '').toLowerCase()
      const isDhEmployee = volunteer.isDhEmployee === true || isDhEmployeeStr === 'yes' || isDhEmployeeStr === 'true'

      // Validate email
      if (!email || !isValidEmail(email)) {
        results.push({ email: volunteer.email || '', status: 'error', error: 'Invalid email' })
        continue
      }

      // Check if user already exists
      if (existingEmails.has(email)) {
        results.push({ email, status: 'exists' })
        continue
      }

      try {
        const tempPassword = generatePassword()
        const qrCodeId = generateVolunteerQRCode()

        // Create user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
          },
        })

        if (createError) {
          if (createError.message?.includes('already registered')) {
            results.push({ email, status: 'exists' })
            existingEmails.add(email)
          } else {
            results.push({ email, status: 'error', error: createError.message })
          }
          continue
        }

        // Delete any existing roles and assign volunteer role
        await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', newUser.user.id)

        await supabaseAdmin
          .from('user_roles')
          .insert({ user_id: newUser.user.id, role: 'volunteer' })

        // Create volunteer QR card
        const { error: qrError } = await supabaseAdmin
          .from('volunteer_qr_cards')
          .insert({
            unique_id: qrCodeId,
            status: 'inactive',
          })

        if (qrError) {
          console.error('Error creating QR card:', qrError)
        }

        // Create pending volunteer record for tracking with all available fields
        const { error: pvError } = await supabaseAdmin
          .from('pending_volunteers')
          .insert({
            email,
            first_name: firstName,
            last_name: lastName,
            temp_password: tempPassword,
            status: 'approved',
            email_sent: false,
            source: 'bulk_upload',
            created_user_id: newUser.user.id,
            gender: gender,
            external_company: companyName,
            is_employee: isDhEmployee,
            events_list: eventName ? `${eventName}${eventDate ? ` - ${eventDate}` : ''}${eventTime ? ` (${eventTime})` : ''}` : null,
            events_json: eventName ? [{ 
              name: eventName, 
              date: eventDate, 
              time: eventTime, 
              location: eventLocation 
            }] : null,
          })

        // Build marketplace event object from CSV data
        const marketplaceEvent: MarketplaceEvent | null = eventName ? {
          name: eventName,
          event_date: eventDate,
          start_time: eventTime,
          end_time: null,
          location: eventLocation,
        } : null

        // Build the branded email HTML
        const htmlContent = buildEmailHtml(
          firstName,
          lastName,
          email,
          tempPassword,
          qrCodeId,
          marketplaceEvent
        )

        // Send welcome email
        let emailSent = false
        if (microsoftToken) {
          emailSent = await sendWelcomeEmailViaMicrosoft(
            microsoftToken,
            senderEmail,
            email,
            htmlContent,
            bccAddress
          )
        }
        
        if (!emailSent && resend) {
          emailSent = await sendWelcomeEmailViaResend(
            resend,
            email,
            htmlContent
          )
        }

        // Update email sent status
        if (emailSent) {
          await supabaseAdmin
            .from('pending_volunteers')
            .update({ email_sent: true, email_sent_at: new Date().toISOString() })
            .eq('email', email)
        }

        // Log email send with correct column names
        await supabaseAdmin
          .from('email_send_logs')
          .insert({
            recipient_email: email,
            email_type: 'bulk_welcome',
            provider: microsoftToken ? 'microsoft_graph' : 'resend',
            success: emailSent,
            error_message: emailSent ? null : 'Failed to send welcome email',
          })

        results.push({ email, status: 'created', userId: newUser.user.id })
        existingEmails.add(email)

      } catch (error) {
        console.error(`Error creating volunteer ${email}:`, error)
        results.push({ email, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      results,
      summary: {
        total: results.length,
        created: results.filter(r => r.status === 'created').length,
        exists: results.filter(r => r.status === 'exists').length,
        errors: results.filter(r => r.status === 'error').length,
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Unexpected error in bulk-create-volunteers:', error)
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})