import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const HUBSPOT_API_BASE = 'https://api.hubapi.com'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const hubspotApiKey = Deno.env.get('HUBSPOT_API_KEY')
    if (!hubspotApiKey) {
      console.error('HUBSPOT_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'HubSpot API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if requesting user is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { action, data } = body

    console.log(`HubSpot sync action: ${action}`)

    switch (action) {
      case 'create_contact': {
        const { email, firstName, lastName, phone } = data
        
        const response = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hubspotApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            properties: {
              email,
              firstname: firstName,
              lastname: lastName,
              phone: phone || '',
            },
          }),
        })

        const result = await response.json()
        
        if (!response.ok) {
          console.error('HubSpot create contact error:', result)
          return new Response(
            JSON.stringify({ error: result.message || 'Failed to create contact', details: result }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log('HubSpot contact created:', result.id)
        return new Response(
          JSON.stringify({ success: true, contact: result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'update_contact': {
        const { contactId, properties } = data
        
        const response = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${hubspotApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ properties }),
        })

        const result = await response.json()
        
        if (!response.ok) {
          console.error('HubSpot update contact error:', result)
          return new Response(
            JSON.stringify({ error: result.message || 'Failed to update contact', details: result }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log('HubSpot contact updated:', contactId)
        return new Response(
          JSON.stringify({ success: true, contact: result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'search_contact': {
        const { email } = data
        
        const response = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hubspotApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filterGroups: [{
              filters: [{
                propertyName: 'email',
                operator: 'EQ',
                value: email,
              }],
            }],
          }),
        })

        const result = await response.json()
        
        if (!response.ok) {
          console.error('HubSpot search error:', result)
          return new Response(
            JSON.stringify({ error: result.message || 'Failed to search contacts', details: result }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ success: true, results: result.results }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'sync_volunteers': {
        // Fetch all approved volunteers
        const { data: volunteers, error: fetchError } = await supabaseAdmin
          .from('pending_volunteers')
          .select('*')
          .eq('status', 'approved')

        if (fetchError) {
          console.error('Error fetching volunteers:', fetchError)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch volunteers' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const results = { created: 0, updated: 0, failed: 0, errors: [] as string[] }

        for (const volunteer of volunteers || []) {
          try {
            // Check if contact exists
            const searchResponse = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${hubspotApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                filterGroups: [{
                  filters: [{
                    propertyName: 'email',
                    operator: 'EQ',
                    value: volunteer.email,
                  }],
                }],
              }),
            })

            const searchResult = await searchResponse.json()

            const properties = {
              email: volunteer.email,
              firstname: volunteer.first_name,
              lastname: volunteer.last_name,
              phone: volunteer.phone_number || '',
              company: volunteer.external_company || '',
            }

            if (searchResult.results && searchResult.results.length > 0) {
              // Update existing contact
              const contactId = searchResult.results[0].id
              await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactId}`, {
                method: 'PATCH',
                headers: {
                  'Authorization': `Bearer ${hubspotApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ properties }),
              })
              results.updated++
            } else {
              // Create new contact
              await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${hubspotApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ properties }),
              })
              results.created++
            }
          } catch (err: unknown) {
            results.failed++
            const errorMessage = err instanceof Error ? err.message : 'Unknown error'
            results.errors.push(`${volunteer.email}: ${errorMessage}`)
          }
        }

        console.log('HubSpot sync completed:', results)
        return new Response(
          JSON.stringify({ success: true, ...results }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error: unknown) {
    console.error('HubSpot sync error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
