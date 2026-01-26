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
}

interface VolunteerResult {
  email: string
  status: 'created' | 'exists' | 'error'
  error?: string
  userId?: string
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
  firstName: string,
  lastName: string,
  tempPassword: string,
  qrCodeId: string
): Promise<boolean> {
  const subject = 'Welcome to GIF (Gift it Forward) - Your Volunteer Account'
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeId)}`
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #2563eb;">Welcome to GIF (Gift it Forward)!</h1>
      <p>Dear ${firstName} ${lastName},</p>
      <p>Your volunteer account has been created. Here are your login credentials:</p>
      <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Email:</strong> ${recipientEmail}</p>
        <p><strong>Temporary Password:</strong> ${tempPassword}</p>
      </div>
      <p>Your Volunteer QR Code:</p>
      <div style="text-align: center; margin: 20px 0;">
        <img src="${qrCodeUrl}" alt="Your Volunteer QR Code" style="width: 200px; height: 200px;" />
        <p style="font-size: 12px; color: #6b7280;">QR ID: ${qrCodeId}</p>
      </div>
      <p>Please complete your training at: <a href="https://gif.thesurpluss.com/training">https://gif.thesurpluss.com/training</a></p>
      <p>Login at: <a href="https://gif.thesurpluss.com/auth">https://gif.thesurpluss.com/auth</a></p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
        This is an automated message from GIF (Gift it Forward).
      </p>
    </div>
  `

  try {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: 'HTML', content: htmlContent },
            toRecipients: [{ emailAddress: { address: recipientEmail } }],
          },
        }),
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
  firstName: string,
  lastName: string,
  tempPassword: string,
  qrCodeId: string
): Promise<boolean> {
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeId)}`
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #2563eb;">Welcome to GIF (Gift it Forward)!</h1>
      <p>Dear ${firstName} ${lastName},</p>
      <p>Your volunteer account has been created. Here are your login credentials:</p>
      <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Email:</strong> ${recipientEmail}</p>
        <p><strong>Temporary Password:</strong> ${tempPassword}</p>
      </div>
      <p>Your Volunteer QR Code:</p>
      <div style="text-align: center; margin: 20px 0;">
        <img src="${qrCodeUrl}" alt="Your Volunteer QR Code" style="width: 200px; height: 200px;" />
        <p style="font-size: 12px; color: #6b7280;">QR ID: ${qrCodeId}</p>
      </div>
      <p>Please complete your training at: <a href="https://gif.thesurpluss.com/training">https://gif.thesurpluss.com/training</a></p>
      <p>Login at: <a href="https://gif.thesurpluss.com/auth">https://gif.thesurpluss.com/auth</a></p>
    </div>
  `

  try {
    // Try primary sender first
    let result = await resend.emails.send({
      from: 'Gift It Forward <giftitforward@dubaiholding.com>',
      to: [recipientEmail],
      bcc: ['giftitforward@dubaiholding.com'],
      subject: 'Welcome to GIF (Gift it Forward) - Your Volunteer Account',
      html: htmlContent,
    })
    
    // If primary fails due to domain issues, try fallback
    if (result.error) {
      const errorMsg = result.error.message || ''
      if (errorMsg.includes('domain') || errorMsg.includes('not verified')) {
        console.log('Primary sender failed, trying fallback...')
        result = await resend.emails.send({
          from: 'Gift It Forward <noreply@mgif.thesurpluss.com>',
          to: [recipientEmail],
          bcc: ['giftitforward@dubaiholding.com'],
          subject: 'Welcome to GIF (Gift it Forward) - Your Volunteer Account',
          html: htmlContent,
        })
      }
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

    const results: VolunteerResult[] = []

    // Get all existing users to check for duplicates
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingEmails = new Set(existingUsers?.users?.map(u => u.email?.toLowerCase()) || [])

    for (const volunteer of volunteers) {
      const email = volunteer.email?.trim().toLowerCase()
      const firstName = volunteer.firstName?.trim() || ''
      const lastName = volunteer.lastName?.trim() || ''

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

        // Create pending volunteer record for tracking
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
          })

        // Send welcome email
        let emailSent = false
        if (microsoftToken) {
          emailSent = await sendWelcomeEmailViaMicrosoft(
            microsoftToken,
            senderEmail,
            email,
            firstName,
            lastName,
            tempPassword,
            qrCodeId
          )
        }
        
        if (!emailSent && resend) {
          emailSent = await sendWelcomeEmailViaResend(
            resend,
            email,
            firstName,
            lastName,
            tempPassword,
            qrCodeId
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
