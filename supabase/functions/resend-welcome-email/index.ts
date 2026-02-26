import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface ResendEmailRequest {
  pending_volunteer_id: string;
  email_type: string;
  force_resend?: boolean;
}

interface EventInfo {
  name: string;
  date: string;
  time: string;
  location: string;
}

// Format time from HH:MM:SS to readable format (07.00 am style)
function formatTime(time: string | null | undefined): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'pm' : 'am';
  const hour12 = hour % 12 || 12;
  return `${String(hour12).padStart(2, '0')}.${minutes} ${ampm}`;
}

// Format date to readable format (February 19, 2026)
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// Build HTML for a single event block with red left border
function buildEventBlock(event: EventInfo): string {
  return `
    <tr>
      <td style="padding: 0 30px 15px 30px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-left: 3px solid #DA291C; padding-left: 15px;">
          <tr>
            <td>
              <p style="margin: 0 0 8px 0; font-size: 15px; color: #1a1a1a; font-weight: bold;">${event.name}</p>
              <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #333333; line-height: 1.8;">
                ${event.date ? `<li><strong>Date:</strong> ${event.date}</li>` : ''}
                ${event.location ? `<li><strong>Location:</strong> ${event.location}</li>` : ''}
                ${event.time ? `<li><strong>Timings:</strong> ${event.time}</li>` : ''}
              </ul>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

// Build dynamic event blocks from volunteer's events_json
async function buildEventsHtml(
  supabase: ReturnType<typeof createClient>,
  eventsJson: unknown
): Promise<string> {
  if (!eventsJson || !Array.isArray(eventsJson) || eventsJson.length === 0) {
    return '';
  }

  const eventBlocks: string[] = [];

  for (const evt of eventsJson) {
    try {
      const slug = evt.event || evt.slug || evt.event_slug;
      // Clean triple dashes from slug for readable fallback name
      const cleanSlug = slug ? slug.replace(/---/g, '-') : '';
      const eventName = evt.name || evt.event_name || (cleanSlug
        ? cleanSlug.split('-').filter(Boolean).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        : 'Gift It Forward marketplace');

      // Try to look up marketplace details by matching the slug to marketplace name
      let eventDate = '';
      let timeRange = '';
      let location = '';

      if (slug) {
        try {
          // Sanitize slug for PostgREST query (escape special chars)
          const sanitizedSlug = slug.replace(/-/g, '%').replace(/[().,]/g, '');
          const { data: marketplace } = await supabase
            .from('marketplace_events')
            .select('name, event_date, start_time, end_time, location')
            .or(`name.ilike.%${sanitizedSlug}%`)
            .limit(1)
            .maybeSingle();

          if (marketplace) {
            eventDate = formatDate(marketplace.event_date);
            const startTime = formatTime(marketplace.start_time);
            const endTime = formatTime(marketplace.end_time);
            timeRange = startTime && endTime ? `${startTime} - ${endTime}` : (startTime || endTime || '');
            location = marketplace.location || '';
          }
        } catch (dbError) {
          console.error(`DB lookup failed for slug "${slug}":`, dbError);
        }
      }

      // Fall back to data from events_json itself
      if (!eventDate && evt.eventDate) eventDate = evt.eventDate;
      if (!eventDate && evt.date) eventDate = formatDate(evt.date);
      if (!eventDate && evt.event_date) eventDate = formatDate(evt.event_date);
      if (!location && evt.eventLocation) location = evt.eventLocation;
      if (!location && evt.location) location = evt.location;
      if (!timeRange && evt.eventTime) timeRange = evt.eventTime;
      if (!timeRange && evt.time) timeRange = evt.time;

      eventBlocks.push(buildEventBlock({
        name: eventName,
        date: eventDate,
        time: timeRange,
        location: location,
      }));
    } catch (blockError) {
      console.error(`Error building event block for "${evt?.event}":`, blockError);
      // Fall back to raw form data
      eventBlocks.push(buildEventBlock({
        name: evt?.event ? evt.event.replace(/---/g, '-').split('-').filter(Boolean).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Gift It Forward Marketplace',
        date: evt?.eventDate || '',
        time: evt?.eventTime || '',
        location: evt?.eventLocation || '',
      }));
    }
  }

  return eventBlocks.join('');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { pending_volunteer_id, email_type }: ResendEmailRequest = await req.json();

    if (!pending_volunteer_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'pending_volunteer_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch volunteer data
    const { data: volunteer, error: volunteerError } = await supabase
      .from('pending_volunteers')
      .select('*')
      .eq('id', pending_volunteer_id)
      .maybeSingle();

    if (volunteerError || !volunteer) {
      return new Response(
        JSON.stringify({ success: false, error: 'Volunteer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch volunteer's QR cards
    const { data: qrCards } = await supabase
      .from('volunteer_qr_cards')
      .select('unique_id, status')
      .eq('volunteer_id', pending_volunteer_id)
      .order('created_at', { ascending: true });

    const primaryQR = qrCards?.[0]?.unique_id || 'N/A';
    // Include ALL family QR cards (not dependent on events_json dependent count)
    const familyQRs = qrCards?.slice(1) || [];
    
    // Try to get dependent names for labeling
    const dependentNames: Array<{name: string; type: string}> = [];
    if (volunteer.events_json && Array.isArray(volunteer.events_json)) {
      for (const evt of volunteer.events_json) {
        if (evt.dependents && Array.isArray(evt.dependents)) {
          for (const dep of evt.dependents) {
            const name = dep.name?.trim();
            if (name && !dependentNames.find(d => d.name.toLowerCase() === name.toLowerCase())) {
              dependentNames.push({ name: dep.name, type: dep.type || 'adult' });
            }
          }
        }
      }
    }

    if (email_type === 'welcome') {
      const appUrl = 'https://gif.thesurpluss.com';
      const loginUrl = `${appUrl}/auth`;
      const trainingUrl = `${appUrl}/training`;
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(primaryQR)}`;
      const trackingPixelUrl = `${supabaseUrl}/functions/v1/email-tracker?id=${pending_volunteer_id}`;

      const heroImageUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/gif-hero-banner.jpg?v=2`;
      const trainingImageUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/training-module-banner.jpg?v=2`;
      const dubaiHoldingLogoUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/dubai-holding-logo.png?v=2`;

      // Build dynamic event blocks - with fallback resolution
      let eventsSource = volunteer.events_json;
      
      // Fallback 1: If events_json is empty, try to resolve from events_list
      if (!eventsSource || !Array.isArray(eventsSource) || eventsSource.length === 0) {
        if (volunteer.events_list) {
          const slugs = volunteer.events_list.split(',').map((s: string) => s.trim()).filter(Boolean);
          if (slugs.length > 0) {
            const syntheticEvents: Array<{event: string; eventDate?: string; eventTime?: string; eventLocation?: string}> = [];
            for (const slug of slugs) {
              // Try to find marketplace by matching slug to name
              const { data: mp } = await supabase
                .from('marketplace_events')
                .select('name, event_date, start_time, end_time, location')
                .or(`name.ilike.%${slug.replace(/-/g, '%')}%`)
                .limit(1)
                .maybeSingle();
              
              if (mp) {
                const startTime = formatTime(mp.start_time);
                const endTime = formatTime(mp.end_time);
                syntheticEvents.push({
                  event: slug,
                  eventDate: mp.event_date ? formatDate(mp.event_date) : undefined,
                  eventTime: startTime && endTime ? `${startTime} - ${endTime}` : undefined,
                  eventLocation: mp.location || undefined,
                });
              }
            }
            if (syntheticEvents.length > 0) {
              eventsSource = syntheticEvents;
              console.log(`Resolved ${syntheticEvents.length} events from events_list for resend`);
            }
          }
        }
      }
      
      // Fallback 2: If still empty, resolve from QR card marketplace assignments
      if (!eventsSource || !Array.isArray(eventsSource) || eventsSource.length === 0) {
        const { data: qrCardsWithMp } = await supabase
          .from('volunteer_qr_cards')
          .select('marketplace_id')
          .eq('volunteer_id', pending_volunteer_id)
          .not('marketplace_id', 'is', null);
        
        const uniqueMpIds = [...new Set((qrCardsWithMp || []).map(c => c.marketplace_id).filter(Boolean))];
        
        if (uniqueMpIds.length > 0) {
          const syntheticEvents: Array<{event: string; name?: string; eventDate?: string; eventTime?: string; eventLocation?: string}> = [];
          for (const mpId of uniqueMpIds) {
            const { data: mp } = await supabase
              .from('marketplace_events')
              .select('name, event_date, start_time, end_time, location')
              .eq('id', mpId)
              .maybeSingle();
            
            if (mp) {
              const startTime = formatTime(mp.start_time);
              const endTime = formatTime(mp.end_time);
              syntheticEvents.push({
                event: mp.name.toLowerCase().replace(/\s+/g, '-'),
                name: mp.name,
                eventDate: mp.event_date ? formatDate(mp.event_date) : undefined,
                eventTime: startTime && endTime ? `${startTime} - ${endTime}` : undefined,
                eventLocation: mp.location || undefined,
              });
            }
          }
          if (syntheticEvents.length > 0) {
            eventsSource = syntheticEvents;
            console.log(`Resolved ${syntheticEvents.length} events from QR card assignments for resend`);
          }
        }
      }
      
      const eventsHtml = await buildEventsHtml(supabase, eventsSource);

      // Build family QR sections - use dependent names when available
      const familyQRSections = familyQRs.map((fam, index) => {
        const famQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(fam.unique_id)}`;
        const depName = dependentNames[index]?.name || `Family Member ${index + 1}`;
        return `
          <tr>
            <td style="padding: 10px; text-align: center;">
              <p style="font-weight: 600; margin: 0 0 5px 0; color: #374151; font-family: Arial, sans-serif;">${depName}</p>
              <img src="${famQrUrl}" alt="QR Code" width="120" height="120" style="display: block; margin: 0 auto;" />
              <p style="font-family: monospace; font-size: 11px; margin-top: 8px; color: #6b7280;">${fam.unique_id}</p>
            </td>
          </tr>
        `;
      }).join('');

      const familySection = familyQRs.length > 0 ? `
        <tr>
          <td style="padding: 20px 30px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background: #f0fdf4; border: 2px solid #86efac; border-radius: 8px;">
              <tr>
                <td style="padding: 20px;">
                  <h3 style="margin: 0 0 15px 0; color: #166534; font-family: Arial, sans-serif;">Family Member QR Cards (${familyQRs.length})</h3>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    ${familyQRSections}
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      ` : '';

      const emailSubject = "[Resent] Thank you for registering as a Gift It Forward volunteer";
      const tempPasswordDisplay = volunteer.temp_password || 'Please use "Forgot Password" to reset';
      const sender = "Gift It Forward <giftitforward@dubaiholding.com>";
      
      const emailResult = await resend.emails.send({
        from: sender,
        to: [volunteer.email],
        bcc: ['giftitforward@dubaiholding.com'],
        subject: emailSubject,
        html: `
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
                        <p style="margin: 0; font-size: 15px; color: #333333;"><strong>Dear ${volunteer.first_name},</strong></p>
                      </td>
                    </tr>
                    
                    <!-- Intro Text -->
                    <tr>
                      <td style="padding: 0 30px 15px 30px;">
                        <p style="margin: 0; font-size: 14px; color: #333333; line-height: 1.6;">
                          Your volunteer registration has been <strong>successfully confirmed</strong> for the <strong>Gift It Forward marketplace</strong> taking place on:
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Dynamic Event Details -->
                    ${eventsHtml}
                    
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
                    
                    <!-- QR Code Section -->
                    <tr>
                      <td style="padding: 0 30px 10px 30px; background-color: #f8f8f8;">
                        <h3 style="margin: 20px 0 10px 0; font-size: 16px; color: #1a1a1a; font-weight: bold;">Your volunteer QR code</h3>
                        <p style="margin: 0 0 15px 0; font-size: 13px; color: #333333; line-height: 1.5;">
                          We recommend saving it on your phone and keeping a screenshot available offline.
                        </p>
                      </td>
                    </tr>
                    
                    <tr>
                      <td style="padding: 0 30px 10px 30px; background-color: #f8f8f8;">
                        <img src="${qrCodeUrl}" alt="Volunteer QR Code" width="150" height="150" style="display: block;" />
                      </td>
                    </tr>
                    
                    <tr>
                      <td style="padding: 0 30px 15px 30px; background-color: #f8f8f8;">
                        <p style="margin: 0; font-size: 12px; color: #666666;">QR Card ID: ${primaryQR}</p>
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
                    
                    ${familySection}
                    
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
                        <p style="margin: 0; font-size: 13px; color: #333333;"><strong>Email:</strong> ${volunteer.email}</p>
                      </td>
                    </tr>
                    
                    <tr>
                      <td style="padding: 0 30px 15px 30px;">
                        <p style="margin: 0; font-size: 13px; color: #333333;"><strong>Temporary Password:</strong> ${tempPasswordDisplay}</p>
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
            <img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />
          </body>
          </html>
        `,
      });

      if (emailResult.error) {
        await supabase.from('email_send_logs').insert({
          pending_volunteer_id,
          email_type: 'welcome',
          provider: 'resend_retry',
          recipient_email: volunteer.email,
          success: false,
          error_message: emailResult.error.message,
          request_payload: { to: volunteer.email, subject: emailSubject },
          response_data: { error: emailResult.error.message }
        });

        return new Response(
          JSON.stringify({ success: false, error: emailResult.error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase.from('email_send_logs').insert({
        pending_volunteer_id,
        email_type: 'welcome',
        provider: 'resend_retry',
        recipient_email: volunteer.email,
        success: true,
        error_message: null,
        request_payload: { to: volunteer.email, subject: emailSubject },
        response_data: { status: 'sent' }
      });

      await supabase
        .from('pending_volunteers')
        .update({
          email_sent: true,
          email_sent_at: new Date().toISOString(),
          email_send_count: (volunteer.email_send_count || 0) + 1
        })
        .eq('id', pending_volunteer_id);

      console.log(`Successfully resent welcome email to ${volunteer.email}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email resent successfully',
          provider: 'resend_retry',
          recipient: volunteer.email
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Unsupported email type: ${email_type}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in resend-welcome-email:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
