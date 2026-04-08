import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// Initialize Resend for sending welcome emails
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_API_KEY");

interface EmailConfig {
  email_type: string;
  template_id: string | null;
  enabled: boolean;
}

// Helper to get email config from database
// deno-lint-ignore no-explicit-any
async function getEmailConfig(supabase: any, emailType: string): Promise<EmailConfig | null> {
  try {
    const { data, error } = await supabase
      .from('hubspot_email_config')
      .select('email_type, template_id, enabled')
      .eq('email_type', emailType)
      .single();
    
    if (error || !data) return null;
    return data as EmailConfig;
  } catch {
    return null;
  }
}

// Send email via HubSpot transactional API
async function sendViaHubSpot(
  templateId: string,
  recipientEmail: string,
  customProperties: Record<string, string>
): Promise<{ success: boolean; error?: string; requestPayload?: Record<string, unknown>; responseData?: Record<string, unknown> }> {
  // Check if API key exists
  if (!HUBSPOT_API_KEY) {
    console.error('HUBSPOT_API_KEY is not configured');
    return { 
      success: false, 
      error: 'HUBSPOT_API_KEY is not configured in environment',
      requestPayload: { templateId, recipientEmail },
      responseData: { error: 'missing_api_key' }
    };
  }

  console.log(`Attempting HubSpot email send - Template: ${templateId}, To: ${recipientEmail}`);
  console.log('HubSpot API key exists:', !!HUBSPOT_API_KEY, 'Key length:', HUBSPOT_API_KEY?.length || 0);

  try {
    // First, ensure contact exists in HubSpot
    const searchResponse = await fetch(
      'https://api.hubapi.com/crm/v3/objects/contacts/search',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filterGroups: [{
            filters: [{
              propertyName: 'email',
              operator: 'EQ',
              value: recipientEmail,
            }]
          }]
        })
      }
    );

    const searchData = await searchResponse.json();
    console.log('HubSpot contact search response:', JSON.stringify(searchData));
    
    // Create contact if doesn't exist
    if (!searchData.results || searchData.results.length === 0) {
      console.log('Contact not found, creating new contact');
      const createResponse = await fetch(
        'https://api.hubapi.com/crm/v3/objects/contacts',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            properties: {
              email: recipientEmail,
              firstname: customProperties.first_name || '',
            }
          })
        }
      );
      
      const createData = await createResponse.json();
      console.log('HubSpot contact creation response:', JSON.stringify(createData));
      
      if (!createResponse.ok) {
        console.error('Failed to create HubSpot contact:', createData);
        // Continue anyway - contact might already exist with different email format
      }
    } else {
      console.log('Contact already exists in HubSpot');
    }

    // Build email request payload
    const emailPayload = {
      emailId: parseInt(templateId),
      message: {
        to: recipientEmail,
      },
      customProperties: customProperties,
      contactProperties: customProperties
    };

    console.log('HubSpot transactional email request payload:', JSON.stringify(emailPayload, null, 2));

    // Send transactional email
    const emailResponse = await fetch(
      'https://api.hubapi.com/marketing/v3/transactional/single-email/send',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload)
      }
    );

    const responseText = await emailResponse.text();
    let responseJson: Record<string, unknown> = {};
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = { rawText: responseText };
    }

    console.log('HubSpot email response status:', emailResponse.status);
    console.log('HubSpot email response body:', responseText);

    if (!emailResponse.ok) {
      const errorMessage = (responseJson as { message?: string }).message || 
                          (responseJson as { errors?: Array<{ message?: string }> }).errors?.[0]?.message ||
                          `HTTP ${emailResponse.status}: ${responseText}`;
      console.error('HubSpot email send failed:', errorMessage);
      return { 
        success: false, 
        error: errorMessage,
        requestPayload: emailPayload,
        responseData: responseJson
      };
    }

    console.log('HubSpot email sent successfully:', responseJson);
    return { 
      success: true,
      requestPayload: emailPayload,
      responseData: responseJson
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown HubSpot error';
    console.error('HubSpot email error:', error);
    return { 
      success: false, 
      error: errorMessage,
      requestPayload: { templateId, recipientEmail, customProperties },
      responseData: { exception: String(error) }
    };
  }
}

// Helper to format time for display (HH:MM:SS -> H:MM AM/PM)
function formatTime(time: string | null | undefined): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

// Helper to format date for display
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  return date.toLocaleDateString('en-GB', options);
}

// Interface for marketplace info
interface MarketplaceInfo {
  name: string;
  location: string | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
}

// Helper to fetch marketplace info
// deno-lint-ignore no-explicit-any
async function getMarketplaceInfo(supabase: any, marketplaceId: string | null | undefined): Promise<MarketplaceInfo | null> {
  if (!marketplaceId) return null;
  
  try {
    const { data, error } = await supabase
      .from('marketplace_events')
      .select('name, location, event_date, start_time, end_time')
      .eq('id', marketplaceId)
      .maybeSingle();
    
    if (error || !data) return null;
    return data as MarketplaceInfo;
  } catch {
    return null;
  }
}

// Helper to fetch first upcoming marketplace
// deno-lint-ignore no-explicit-any
async function getFirstUpcomingMarketplace(supabase: any): Promise<MarketplaceInfo | null> {
  try {
    const { data, error } = await supabase
      .from('marketplace_events')
      .select('name, location, event_date, start_time, end_time')
      .in('status', ['upcoming', 'active'])
      .order('event_date', { ascending: true })
      .limit(1)
      .maybeSingle();
    
    if (error || !data) return null;
    return data as MarketplaceInfo;
  } catch {
    return null;
  }
}

// Interface for event registration data from form
interface RegisteredEvent {
  event: string; // slug like "emirati-family-support-marketplace-february-22"
  eventDate?: string; // "February 22, 2026"
  eventTime?: string; // "7:30PM – 11:30PM"
  eventLocation?: string; // "Dubai, Al Twar"
  'family-members-joining'?: string;
  'number-of-children'?: string;
  'number-of-adults'?: string;
  'fnb-required'?: string;
  dependents?: Array<{ name: string; type: string; gender?: string }>;
  'total-attendees'?: number;
}

// Interface for marketplace with times from database
interface MarketplaceEventDetails {
  name: string;
  location: string | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  slug?: string; // For matching
}

// Interface for calendar links
interface CalendarLinks {
  google: string;
  outlook: string;
  icsDataUrl: string;
}

// Helper to generate calendar links for an event
function generateCalendarLinks(event: { 
  name: string; 
  date: string; // formatted date like "January 22, 2026"
  startTime: string | null; // raw time like "09:00:00"
  endTime: string | null; // raw time like "14:00:00"
  location: string;
}): CalendarLinks {
  // Parse the date string to get a Date object
  let eventDateObj: Date;
  try {
    // Try parsing the formatted date
    eventDateObj = new Date(event.date);
    if (isNaN(eventDateObj.getTime())) {
      // Fallback: try current year
      eventDateObj = new Date();
    }
  } catch {
    eventDateObj = new Date();
  }
  
  // Extract date components
  const year = eventDateObj.getFullYear();
  const month = String(eventDateObj.getMonth() + 1).padStart(2, '0');
  const day = String(eventDateObj.getDate()).padStart(2, '0');
  
  // Parse times or use defaults (9 AM - 2 PM)
  let startHour = 9, startMinute = 0;
  let endHour = 14, endMinute = 0;
  
  if (event.startTime) {
    const [h, m] = event.startTime.split(':');
    startHour = parseInt(h) || 9;
    startMinute = parseInt(m) || 0;
  }
  
  if (event.endTime) {
    const [h, m] = event.endTime.split(':');
    endHour = parseInt(h) || 14;
    endMinute = parseInt(m) || 0;
  }
  
  // Format for Google Calendar (YYYYMMDDTHHmmss - local time, no Z suffix)
  const googleStart = `${year}${month}${day}T${String(startHour).padStart(2, '0')}${String(startMinute).padStart(2, '0')}00`;
  const googleEnd = `${year}${month}${day}T${String(endHour).padStart(2, '0')}${String(endMinute).padStart(2, '0')}00`;
  
  // Format for Outlook (ISO 8601 without timezone for local time)
  const outlookStart = `${year}-${month}-${day}T${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00`;
  const outlookEnd = `${year}-${month}-${day}T${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}:00`;
  
  const title = `GIF Volunteer: ${event.name}`;
  const description = `Gift It Forward volunteer marketplace event${event.location ? ` at ${event.location}` : ''}. Please bring your QR code for check-in.`;
  
  // Google Calendar URL
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${googleStart}/${googleEnd}&location=${encodeURIComponent(event.location || '')}&details=${encodeURIComponent(description)}`;
  
  // Outlook Web URL
  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(title)}&startdt=${outlookStart}&enddt=${outlookEnd}&location=${encodeURIComponent(event.location || '')}&body=${encodeURIComponent(description)}`;
  
  // ICS file content for Apple Calendar / download
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gift It Forward//Volunteer Event//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${googleStart}`,
    `DTEND:${googleEnd}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
    `LOCATION:${event.location || ''}`,
    `UID:gif-event-${year}${month}${day}@thesurpluss.com`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  
  // Create data URL for ICS download
  const icsDataUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;
  
  return {
    google: googleUrl,
    outlook: outlookUrl,
    icsDataUrl
  };
}

// Helper to extract date from slug (e.g., "february-23" -> { month: 2, day: 23 })
function extractDateFromSlug(slug: string): { month: number; day: number } | null {
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 
                  'july', 'august', 'september', 'october', 'november', 'december'];
  const slugLower = slug.toLowerCase();
  
  for (let i = 0; i < months.length; i++) {
    // Match patterns like "february-23", "february23", "february--23"
    const monthMatch = slugLower.match(new RegExp(`${months[i]}[-]*?(\\d{1,2})`));
    if (monthMatch) {
      return { month: i + 1, day: parseInt(monthMatch[1]) };
    }
  }
  return null;
}

// Helper to parse month/day from a form eventDate string like "April 11, 2026"
function parseDateComponents(dateStr: string | null | undefined): { month: number; day: number } | null {
  if (!dateStr) return null;
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 
                  'july', 'august', 'september', 'october', 'november', 'december'];
  const match = dateStr.toLowerCase().match(/(\w+)\s+(\d{1,2})/);
  if (match) {
    const monthIndex = months.indexOf(match[1]);
    if (monthIndex !== -1) {
      return { month: monthIndex + 1, day: parseInt(match[2]) };
    }
  }
  // Try ISO format "2026-04-11"
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return { month: parseInt(isoMatch[2]), day: parseInt(isoMatch[3]) };
  }
  return null;
}

// Helper to look up marketplace events by slug/name pattern WITH date matching
// deno-lint-ignore no-explicit-any
async function getMarketplacesBySlug(supabase: any, eventSlugs: string[], slugDateMap?: Map<string, string>): Promise<Map<string, MarketplaceEventDetails>> {
  const result = new Map<string, MarketplaceEventDetails>();
  if (!eventSlugs.length) return result;
  
  try {
    // Fetch all marketplace events, newest first so recent events are preferred
    const { data: marketplaces, error } = await supabase
      .from('marketplace_events')
      .select('name, location, event_date, start_time, end_time')
      .order('event_date', { ascending: false });
    
    if (error || !marketplaces) return result;
    
    for (const slug of eventSlugs) {
      // Extract date from slug for precise matching
      let targetDate = extractDateFromSlug(slug);
      console.log(`Slug "${slug}" extracted date from slug:`, targetDate);
      
      // If no date in slug, try the form's eventDate
      if (!targetDate && slugDateMap?.has(slug)) {
        targetDate = parseDateComponents(slugDateMap.get(slug));
        console.log(`Slug "${slug}" using form eventDate "${slugDateMap.get(slug)}" -> parsed:`, targetDate);
      }
      
      // Convert slug to searchable pattern
      const slugParts = slug.toLowerCase().split('-').filter(p => 
        p.length > 2 && !['the', 'and', 'for', 'marketplace'].includes(p)
      );
      
      let bestMatch: typeof marketplaces[0] | null = null;
      let bestMatchCount = 0;
      
      for (const mp of marketplaces) {
        const mpNameLower = mp.name.toLowerCase();
        // Check if marketplace name contains key parts of the slug
        const matchCount = slugParts.filter(part => mpNameLower.includes(part)).length;
        const nameMatches = matchCount >= 2 || (slugParts.length === 1 && mpNameLower.includes(slugParts[0]));
        
        if (!nameMatches) continue;
        
        // If we have a target date (from slug OR form), require it to match the DB date
        if (targetDate && mp.event_date) {
          const dbDate = new Date(mp.event_date);
          const dateMatches = (dbDate.getMonth() + 1) === targetDate.month && 
                              dbDate.getDate() === targetDate.day;
          
          if (dateMatches && matchCount > bestMatchCount) {
            console.log(`✓ Matched slug "${slug}" to "${mp.name}" (date ${mp.event_date}, score ${matchCount})`);
            bestMatch = mp;
            bestMatchCount = matchCount;
            // Continue iterating to find the most specific match (e.g. morning vs afternoon)
          } else if (!dateMatches) {
            // Name matches but date doesn't - keep looking
            console.log(`✗ Name match but date mismatch for slug "${slug}": DB has ${mp.event_date}, target month=${targetDate.month} day=${targetDate.day}`);
          }
        } else if (!targetDate) {
          // No date available at all, use best name match
          if (matchCount > bestMatchCount) {
            bestMatch = mp;
            bestMatchCount = matchCount;
          }
        }
      }
      
      if (bestMatch) {
        // Final cross-validation: if form provided a date, verify the match
        if (slugDateMap?.has(slug) && bestMatch.event_date) {
          const formDate = parseDateComponents(slugDateMap.get(slug));
          if (formDate) {
            const dbDate = new Date(bestMatch.event_date);
            const dbMonth = dbDate.getMonth() + 1;
            const dbDay = dbDate.getDate();
            if (dbMonth !== formDate.month || Math.abs(dbDay - formDate.day) > 1) {
              console.log(`⚠ Cross-validation failed for slug "${slug}": DB date ${bestMatch.event_date} != form date "${slugDateMap.get(slug)}". Discarding DB match.`);
              bestMatch = null;
            }
          }
        }
      }
      
      if (bestMatch) {
        result.set(slug, { ...bestMatch, slug });
      } else {
        console.log(`⚠ No match found for slug "${slug}"`);
      }
    }
    
    return result;
  } catch (err) {
    console.error('Error in getMarketplacesBySlug:', err);
    return result;
  }
}

// Helper to parse date from various formats (e.g., "February 22, 2026" or "2026-02-22")
function parseDateToISO(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  
  try {
    // Try parsing directly
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0]; // Return YYYY-MM-DD
    }
  } catch {
    // Continue to manual parsing
  }
  
  // Try parsing "Month Day, Year" format
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                      'july', 'august', 'september', 'october', 'november', 'december'];
  const match = dateStr.toLowerCase().match(/(\w+)\s+(\d+),?\s*(\d{4})/);
  if (match) {
    const monthIndex = monthNames.indexOf(match[1]);
    if (monthIndex !== -1) {
      const year = parseInt(match[3]);
      const day = parseInt(match[2]);
      return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  
  return null;
}

// Helper to parse time from various formats (e.g., "7:30PM" or "7:30PM – 11:30PM")
function parseTimeRange(timeStr: string | null | undefined): { start: string | null; end: string | null } {
  if (!timeStr) return { start: null, end: null };
  
  const parseTime = (t: string): string | null => {
    const match = t.trim().match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
    if (!match) return null;
    
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2] || '0');
    const period = (match[3] || '').toLowerCase();
    
    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  };
  
  // Split by various separators (–, -, to)
  const parts = timeStr.split(/\s*[–\-]\s*|\s+to\s+/i);
  
  if (parts.length >= 2) {
    return {
      start: parseTime(parts[0]),
      end: parseTime(parts[1])
    };
  }
  
  return {
    start: parseTime(timeStr),
    end: null
  };
}

// Helper to convert slug to human-readable name
function slugToName(slug: string): string {
  return slug
    .split('-')
    .filter(word => word.length > 0) // Skip empty segments from consecutive hyphens
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/\s{2,}/g, ' ') // Collapse multiple spaces into single space
    .trim();
}

// Helper to normalize a name for fuzzy comparison
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

// Helper to create marketplace events from form data if they don't exist
// deno-lint-ignore no-explicit-any
async function createMarketplacesFromEvents(supabase: any, eventsJson: unknown): Promise<void> {
  if (!eventsJson || !Array.isArray(eventsJson)) return;
  
  console.log(`Processing ${eventsJson.length} events to check/create marketplaces`);
  
  // Fetch all existing marketplaces once for efficient matching
  const { data: allMarketplaces } = await supabase
    .from('marketplace_events')
    .select('id, name, event_date');
  
  const existingMarketplaces = (allMarketplaces || []) as Array<{ id: string; name: string; event_date: string | null }>;
  
  for (const evt of eventsJson as RegisteredEvent[]) {
    if (!evt.event) continue;
    
    try {
      // Generate a human-readable name from the event slug
      const eventName = slugToName(evt.event);
      const normalizedEventName = normalizeName(eventName);
      
      // Extract date from slug for precise matching
      const slugDate = extractDateFromSlug(evt.event);
      
      // Try to find a matching marketplace using normalized fuzzy matching
      let matchFound = false;
      
      for (const mp of existingMarketplaces) {
        const normalizedMpName = normalizeName(mp.name);
        
        // Check exact normalized match first
        if (normalizedMpName === normalizedEventName) {
          console.log(`Marketplace exact match: "${eventName}" -> "${mp.name}" (ID: ${mp.id})`);
          matchFound = true;
          break;
        }
        
        // Check if one name contains the other (handles missing/extra date numbers)
        const shorter = normalizedEventName.length <= normalizedMpName.length ? normalizedEventName : normalizedMpName;
        const longer = normalizedEventName.length > normalizedMpName.length ? normalizedEventName : normalizedMpName;
        
        if (longer.includes(shorter) || shorter.includes(longer.replace(/\s+\d+\s*$/, '').trim())) {
          // Names are similar - now check date compatibility
          if (slugDate && mp.event_date) {
            const dbDate = new Date(mp.event_date);
            const dateMatches = (dbDate.getMonth() + 1) === slugDate.month && dbDate.getDate() === slugDate.day;
            if (dateMatches) {
              console.log(`Marketplace fuzzy+date match: "${eventName}" -> "${mp.name}" (ID: ${mp.id})`);
              matchFound = true;
              break;
            }
          } else {
            // No date to compare - name similarity is enough
            console.log(`Marketplace fuzzy match: "${eventName}" -> "${mp.name}" (ID: ${mp.id})`);
            matchFound = true;
            break;
          }
        }
        
        // Word overlap check (similar to getMarketplacesBySlug logic)
        const eventWords = normalizedEventName.split(' ').filter(w => w.length > 2 && !['the', 'and', 'for'].includes(w));
        const mpWords = normalizedMpName.split(' ').filter(w => w.length > 2 && !['the', 'and', 'for'].includes(w));
        const overlapCount = eventWords.filter(w => mpWords.includes(w)).length;
        const overlapRatio = overlapCount / Math.max(eventWords.length, mpWords.length);
        
        if (overlapRatio >= 0.7) {
          // High word overlap - check date if available
          if (slugDate && mp.event_date) {
            const dbDate = new Date(mp.event_date);
            const dateMatches = (dbDate.getMonth() + 1) === slugDate.month && dbDate.getDate() === slugDate.day;
            if (dateMatches) {
              console.log(`Marketplace word-overlap+date match (${(overlapRatio * 100).toFixed(0)}%): "${eventName}" -> "${mp.name}" (ID: ${mp.id})`);
              matchFound = true;
              break;
            }
          } else {
            console.log(`Marketplace word-overlap match (${(overlapRatio * 100).toFixed(0)}%): "${eventName}" -> "${mp.name}" (ID: ${mp.id})`);
            matchFound = true;
            break;
          }
        }
      }
      
      if (matchFound) continue;
      
      // No match found - create new marketplace event
      const eventDate = parseDateToISO(evt.eventDate);
      const { start: startTime, end: endTime } = parseTimeRange(evt.eventTime);
      const location = evt.eventLocation || null;
      
      const { data: newMarketplace, error: createError } = await supabase
        .from('marketplace_events')
        .insert({
          name: eventName,
          event_date: eventDate,
          start_time: startTime,
          end_time: endTime,
          location: location,
          status: 'upcoming'
        })
        .select('id, name')
        .single();
      
      if (createError) {
        console.error(`Failed to create marketplace "${eventName}":`, createError);
      } else {
        console.log(`Created new marketplace: "${eventName}" (ID: ${newMarketplace.id})`);
        // Add to existing list so subsequent events in the same batch can match
        existingMarketplaces.push({ id: newMarketplace.id, name: eventName, event_date: eventDate });
      }
    } catch (err) {
      console.error(`Error processing event "${evt.event}":`, err);
    }
  }
}

// Generate unique volunteer QR card ID
function generateVolunteerQRId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `VOL-${timestamp}-${random}`;
}

// Generate unique family member QR card ID
function generateFamilyQRId(volunteerQRId: string, index: number): string {
  const random = Math.random().toString(36).substring(2, 4).toUpperCase();
  return `${volunteerQRId}-F${index}${random}`;
}

// Interface for family member QR data
interface FamilyMemberQR {
  name: string;
  type: string; // 'adult' or 'children'
  gender: string | null;
  qrCardId: string;
}

// Extract unique dependents from events_json
function extractUniqueDependents(eventsJson: unknown): Array<{ name: string; type: string; gender: string | null }> {
  if (!eventsJson || !Array.isArray(eventsJson)) return [];
  
  const dependents: Array<{ name: string; type: string; gender: string | null }> = [];
  
  for (const event of eventsJson) {
    if (event.dependents && Array.isArray(event.dependents)) {
      for (const dep of event.dependents) {
        const name = dep.name?.trim();
        if (!name) continue;
        const nameLower = name.toLowerCase();
        
        // Check if this name is a duplicate or substring of an existing entry (or vice versa)
        const existingIdx = dependents.findIndex(d => {
          const existing = d.name.toLowerCase();
          return existing === nameLower || existing.includes(nameLower) || nameLower.includes(existing);
        });
        
        if (existingIdx === -1) {
          dependents.push({
            name: dep.name,
            type: dep.type || 'adult',
            gender: dep.gender || null
          });
        } else if (nameLower.length > dependents[existingIdx].name.length) {
          // Keep the longer (more complete) name
          dependents[existingIdx] = {
            name: dep.name,
            type: dep.type || dependents[existingIdx].type,
            gender: dep.gender || dependents[existingIdx].gender
          };
        }
      }
    }
  }
  
  return dependents;
}

// Email customization options
interface EmailCustomization {
  subject?: string;
  greeting?: string;
  message?: string;
}

// Interface for event info passed to email
interface EmailEventInfo {
  name: string;
  date: string;
  time: string;
  location: string;
  rawStartTime?: string | null;
  rawEndTime?: string | null;
  rawDate?: string | null;
}

// Helper function to send welcome email via Microsoft Graph edge function
async function sendWelcomeEmailViaMicrosoftGraph(
  supabaseUrl: string,
  serviceRoleKey: string,
  volunteerId: string,
  email: string,
  firstName: string,
  lastName: string,
  tempPassword: string,
  qrCardId: string,
  marketplaceId?: string | null,
  events?: EmailEventInfo[],
  familyQRs?: Array<{ name: string; qrCardId: string; type?: string }>
): Promise<{ success: boolean; error?: string; provider: string }> {
  try {
    console.log(`Calling send-welcome-email edge function for ${email}`);
    console.log(`Passing ${events?.length || 0} events and ${familyQRs?.length || 0} family QRs to email function`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/send-welcome-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        volunteerId,
        email,
        firstName,
        lastName,
        tempPassword,
        qrCodeId: qrCardId,
        marketplaceId: marketplaceId || undefined,
        events: events || undefined,
        familyQRs: familyQRs && familyQRs.length > 0 ? familyQRs : undefined,
      }),
    });

    const responseData = await response.json();

    if (!response.ok || !responseData.success) {
      console.error('Microsoft Graph email failed:', responseData.error || response.status);
      return { 
        success: false, 
        error: responseData.error || `HTTP ${response.status}`,
        provider: 'microsoft_graph'
      };
    }

    console.log(`Welcome email sent successfully via Microsoft Graph to ${email}`);
    return { success: true, provider: 'microsoft_graph' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error calling send-welcome-email:', error);
    return { success: false, error: errorMessage, provider: 'microsoft_graph' };
  }
}

// Helper function to send welcome email to approved volunteer with QR codes (including family members)
// deno-lint-ignore no-explicit-any
async function sendWelcomeEmailWithQR(
  supabaseClient: any,
  email: string,
  firstName: string,
  lastName: string,
  tempPassword: string,
  loginUrl: string,
  trainingUrl: string,
  qrCardId: string,
  pendingId: string,
  familyQRs: FamilyMemberQR[] = [],
  customization?: EmailCustomization,
  marketplace?: MarketplaceInfo | null,
  marketplaceId?: string | null,
  eventsJson?: unknown // Array of registered events from form
): Promise<{ success: boolean; error?: string; provider?: string }> {
  // Helper to log email send attempt
  const logEmailAttempt = async (
    provider: string,
    success: boolean,
    errorMessage: string | null,
    requestPayload: Record<string, unknown> | null,
    responseData: Record<string, unknown> | null
  ) => {
    try {
      await supabaseClient
        .from('email_send_logs')
        .insert({
          pending_volunteer_id: pendingId,
          email_type: 'welcome',
          provider: provider,
          recipient_email: email,
          success: success,
          error_message: errorMessage,
          request_payload: requestPayload,
          response_data: responseData
        });
      console.log(`Email log created: provider=${provider}, success=${success}`);
    } catch (logError) {
      console.error('Failed to log email attempt:', logError);
    }
  };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const trackingPixelUrl = `${supabaseUrl}/functions/v1/email-tracker?id=${pendingId}`;
    
    // Generate QR code URL using a public QR code API
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCardId)}`;
    
    // Fetch email provider configuration from database
    let primaryProvider = 'microsoft_graph';
    let fallbackEnabled = true;
    let resendSender = 'mgif'; // Default to verified domain
    
    try {
      const { data: providerConfig } = await supabaseClient
        .from('email_provider_config')
        .select('primary_provider, fallback_enabled, resend_sender')
        .eq('email_type', 'welcome')
        .single();
      
      if (providerConfig) {
        primaryProvider = providerConfig.primary_provider;
        fallbackEnabled = providerConfig.fallback_enabled;
        resendSender = providerConfig.resend_sender || 'mgif';
        console.log(`Email provider config from DB: primary=${primaryProvider}, fallback=${fallbackEnabled}, resend_sender=${resendSender}`);
      }
    } catch (configError) {
      console.warn('Could not fetch email provider config, using defaults:', configError);
    }
    
    // Determine Resend sender based on config
    const resendPrimarySender = resendSender === 'dubaiholding' 
      ? "Gift It Forward <giftitforward@dubaiholding.com>"
      : "Gift It Forward <noreply@mgif.thesurpluss.com>";
    const resendFallbackSender = "Gift It Forward <noreply@mgif.thesurpluss.com>";
    
    // Check if Microsoft Graph is configured
    const azureTenantId = Deno.env.get('AZURE_TENANT_ID');
    const azureClientId = Deno.env.get('AZURE_CLIENT_ID');
    const azureClientSecret = Deno.env.get('AZURE_CLIENT_SECRET');
    const senderEmail = Deno.env.get('SENDER_EMAIL');
    const microsoftGraphConfigured = !!(azureTenantId && azureClientId && azureClientSecret && senderEmail);
    
    console.log(`Welcome email config: primary=${primaryProvider}, MS Graph configured=${microsoftGraphConfigured}`);
    
    // Parse eventsJson and look up marketplace times BEFORE sending any email
    // This is used by both Microsoft Graph and Resend providers
    let registeredEvents: EmailEventInfo[] = [];
    
    if (eventsJson && Array.isArray(eventsJson)) {
      // Extract event slugs from eventsJson
      const eventSlugs = eventsJson
        .map((e: RegisteredEvent) => e.event)
        .filter((slug): slug is string => !!slug);
      
      // Build slug → eventDate map for cross-validation
      const slugDateMap = new Map<string, string>();
      for (const evt of eventsJson as RegisteredEvent[]) {
        if (evt.event && evt.eventDate) {
          slugDateMap.set(evt.event, evt.eventDate);
        }
      }
      
      console.log(`Looking up marketplace times for ${eventSlugs.length} events:`, eventSlugs);
      
      // Look up marketplace details from database, passing form dates for cross-validation
      const marketplaceDetails = await getMarketplacesBySlug(supabaseClient, eventSlugs, slugDateMap);
      
      // Build registered events list with times from DB or form data
      // IMPORTANT: Prioritize form data for date/time/location as it's the source of truth
      for (const evt of eventsJson as RegisteredEvent[]) {
        try {
          const dbMarketplace = marketplaceDetails.get(evt.event);
          
          // PRIORITIZE FORM DATA for date - it's submitted by the user and always correct
          // Only use DB date if form data is missing
          const eventDateFormatted = evt.eventDate || 
            (dbMarketplace?.event_date ? formatDate(dbMarketplace.event_date) : '');
          
          // For time: prefer form eventTime, fall back to DB times
          const startTimeFormatted = formatTime(dbMarketplace?.start_time);
          const endTimeFormatted = formatTime(dbMarketplace?.end_time);
          const dbTimeRange = startTimeFormatted && endTimeFormatted 
            ? `${startTimeFormatted} - ${endTimeFormatted}` 
            : (startTimeFormatted || endTimeFormatted || '');
          const timeRange = evt.eventTime || dbTimeRange;
          
          // For location: prefer form eventLocation, fall back to DB location
          const eventLocation = evt.eventLocation || dbMarketplace?.location || '';
          
          // Get name from DB or generate from slug (clean triple dashes)
          const eventName = dbMarketplace?.name || (evt.event || 'Gift It Forward Marketplace')
            .replace(/---/g, '-')
            .split('-')
            .filter(Boolean)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          
          console.log(`Event "${evt.event}": Using date="${eventDateFormatted}" (form: ${evt.eventDate}, db: ${dbMarketplace?.event_date})`);
          
          registeredEvents.push({
            name: eventName,
            date: eventDateFormatted,
            time: timeRange,
            location: eventLocation,
            rawStartTime: dbMarketplace?.start_time || null,
            rawEndTime: dbMarketplace?.end_time || null,
            rawDate: dbMarketplace?.event_date || null
          });
        } catch (evtError) {
          console.error(`Error resolving event "${evt.event}":`, evtError);
          // Fall back to raw form data so this event still appears in the email
          registeredEvents.push({
            name: (evt.event || 'Gift It Forward Marketplace').replace(/---/g, '-').split('-').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            date: evt.eventDate || '',
            time: evt.eventTime || '',
            location: evt.eventLocation || '',
            rawStartTime: null,
            rawEndTime: null,
            rawDate: null
          });
        }
      }
      
      console.log(`Built ${registeredEvents.length} events with times:`, registeredEvents);
    }
    
    // Try Microsoft Graph if it's the primary provider and configured
    if (primaryProvider === 'microsoft_graph' && microsoftGraphConfigured) {
      console.log('Sending welcome email via Microsoft Graph (primary)');
      
      const msGraphResult = await sendWelcomeEmailViaMicrosoftGraph(
        supabaseUrl,
        serviceRoleKey,
        pendingId,
        email,
        firstName,
        lastName,
        tempPassword,
        qrCardId,
        marketplaceId,
        registeredEvents.length > 0 ? registeredEvents : undefined,
        familyQRs.length > 0 ? familyQRs.map(f => ({ name: f.name, qrCardId: f.qrCardId, type: f.type })) : undefined
      );
      
      // Log the Microsoft Graph email attempt
      await logEmailAttempt(
        'microsoft_graph',
        msGraphResult.success,
        msGraphResult.error || null,
        { to: email, qrCardId, marketplaceId, eventsCount: registeredEvents.length },
        { provider: 'microsoft_graph', success: msGraphResult.success }
      );
      
      if (msGraphResult.success) {
        return { success: true, provider: 'microsoft_graph' };
      }
      
      // Microsoft Graph failed - fallback to HubSpot/Resend
      console.log(`Microsoft Graph failed: ${msGraphResult.error}. Falling back to HubSpot/Resend...`);
    }
    
    // Check email configuration for HubSpot fallback (only if fallback is enabled or HubSpot is primary)
    const emailConfig = await getEmailConfig(supabaseClient, 'welcome');
    const useHubSpot = (primaryProvider === 'hubspot' || (fallbackEnabled && primaryProvider === 'microsoft_graph')) && 
                       emailConfig?.enabled && emailConfig?.template_id && HUBSPOT_API_KEY;
    const triedMicrosoftGraph = primaryProvider === 'microsoft_graph' && microsoftGraphConfigured;
    
    console.log(`HubSpot config: enabled=${emailConfig?.enabled}, template_id=${emailConfig?.template_id}, API key exists=${!!HUBSPOT_API_KEY}, using HubSpot=${useHubSpot}`);
    
    // If HubSpot is enabled, send via HubSpot with custom properties
    if (useHubSpot && (primaryProvider === 'hubspot' || triedMicrosoftGraph)) {
      console.log(`Sending welcome email via HubSpot${triedMicrosoftGraph ? ' (Microsoft Graph fallback)' : primaryProvider === 'hubspot' ? ' (primary)' : ''}`);
      
      // Format marketplace details
      const eventDate = formatDate(marketplace?.event_date);
      const startTime = formatTime(marketplace?.start_time);
      const endTime = formatTime(marketplace?.end_time);
      const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : (startTime || endTime || '');
      
      // Build custom properties for HubSpot template
      const customProperties: Record<string, string> = {
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
        email: email,
        temp_password: tempPassword,
        qr_card_id: qrCardId,
        qr_code_url: qrCodeUrl,
        login_url: loginUrl,
        training_url: trainingUrl,
        family_count: String(familyQRs.length),
        total_qr_count: String(1 + familyQRs.length),
        // Marketplace info
        marketplace_name: marketplace?.name || '',
        marketplace_location: marketplace?.location || '',
        marketplace_date: eventDate,
        marketplace_start_time: startTime,
        marketplace_end_time: endTime,
        marketplace_time_range: timeRange,
      };
      
      // Add custom greeting/message if provided
      if (customization?.greeting) {
        customProperties.custom_greeting = customization.greeting;
      }
      if (customization?.message) {
        customProperties.custom_message = customization.message;
      }
      if (customization?.subject) {
        customProperties.custom_subject = customization.subject;
      }
      
      // Add family member properties (up to 10)
      familyQRs.slice(0, 10).forEach((fam, index) => {
        const i = index + 1;
        customProperties[`family_member_${i}_name`] = fam.name;
        customProperties[`family_member_${i}_type`] = fam.type === 'children' ? 'Child' : 'Adult';
        customProperties[`family_member_${i}_qr_id`] = fam.qrCardId;
        customProperties[`family_member_${i}_qr_url`] = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(fam.qrCardId)}`;
        if (fam.gender) {
          customProperties[`family_member_${i}_gender`] = fam.gender;
        }
      });
      
      // Set empty strings for unused family member slots (so template conditionals work)
      for (let i = familyQRs.length + 1; i <= 10; i++) {
        customProperties[`family_member_${i}_name`] = '';
        customProperties[`family_member_${i}_type`] = '';
        customProperties[`family_member_${i}_qr_id`] = '';
        customProperties[`family_member_${i}_qr_url`] = '';
      }
      
      console.log('HubSpot custom properties:', JSON.stringify(customProperties, null, 2));
      
      const hubspotResult = await sendViaHubSpot(emailConfig.template_id!, email, customProperties);
      
      // Log the HubSpot email attempt
      const hubspotProvider = triedMicrosoftGraph ? 'hubspot_fallback' : 'hubspot';
      await logEmailAttempt(
        hubspotProvider,
        hubspotResult.success,
        hubspotResult.error || null,
        hubspotResult.requestPayload || null,
        hubspotResult.responseData || null
      );
      
      // If HubSpot succeeded, return success
      if (hubspotResult.success) {
        return { success: true, provider: hubspotProvider };
      }
      
      // HubSpot failed - fallback to Resend
      console.log(`HubSpot failed: ${hubspotResult.error}. Falling back to Resend...`);
      // Continue to Resend fallback below (don't return here)
    }
    
    // Send via Resend (either as primary or as fallback from HubSpot/Microsoft Graph)
    const triedHubSpot = useHubSpot && (primaryProvider === 'hubspot' || triedMicrosoftGraph);
    const isFallback = triedMicrosoftGraph || triedHubSpot;
    
    // Skip Resend if fallback is disabled and we've already tried primary
    if (!fallbackEnabled && (triedMicrosoftGraph || triedHubSpot)) {
      console.log('Fallback disabled, not trying Resend');
      return { success: false, error: 'Primary email provider failed and fallback is disabled', provider: primaryProvider };
    }
    
    console.log(`Sending welcome email via Resend${isFallback ? ' (fallback)' : primaryProvider === 'resend' ? ' (primary)' : ''}`);
    
    // registeredEvents was already parsed earlier before Microsoft Graph call
    
    // Format single marketplace details for Resend email (fallback if no eventsJson)
    const eventDate = formatDate(marketplace?.event_date);
    const startTime = formatTime(marketplace?.start_time);
    const endTime = formatTime(marketplace?.end_time);
    const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : (startTime || endTime || '');
    const marketplaceName = marketplace?.name || '';
    const marketplaceLocation = marketplace?.location || '';
    
    // Build dynamic intro text based on registered events
    let introText = "Thank you for registering as a Gift It Forward Volunteer.";
    if (registeredEvents.length > 0) {
      introText = "Thank you for registering as a Gift It Forward Volunteer. We're delighted to have you join us at the following marketplace event(s):";
    } else if (marketplaceName || eventDate) {
      introText += " We're delighted to have you join us";
      if (eventDate) introText += ` on <strong>${eventDate}</strong>`;
      if (timeRange) introText += ` from <strong>${timeRange}</strong>`;
      if (marketplaceName) introText += ` at the <strong>${marketplaceName}</strong>`;
      if (marketplaceLocation) introText += ` in <strong>${marketplaceLocation}</strong>`;
      introText += ".";
    }
    
    // Build events section HTML for multiple registered events with calendar buttons
    const eventsSection = registeredEvents.length > 0 ? `
      <tr>
        <td style="padding: 0 30px 20px 30px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background: #f0f4f8; border-radius: 8px; border: 1px solid #d1d5db;">
            <tr>
              <td style="padding: 15px 20px;">
                <h3 style="margin: 0 0 15px 0; font-size: 14px; color: #1a1a1a; font-weight: bold;">📅 Your Registered Events</h3>
                ${registeredEvents.map(evt => {
                  // Generate calendar links for this event
                  const calLinks = generateCalendarLinks({
                    name: evt.name,
                    date: evt.rawDate || evt.date,
                    startTime: evt.rawStartTime ?? null,
                    endTime: evt.rawEndTime ?? null,
                    location: evt.location
                  });
                  
                  return `
                  <div style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 5px 0; font-size: 14px; color: #1a1a1a; font-weight: 600;">${evt.name}</p>
                    <p style="margin: 0 0 10px 0; font-size: 13px; color: #4b5563;">
                      <strong>Date:</strong> ${evt.date || 'TBD'} &nbsp;|&nbsp; 
                      <strong>Time:</strong> ${evt.time}
                      ${evt.location ? ` &nbsp;|&nbsp; <strong>Location:</strong> ${evt.location}` : ''}
                    </p>
                    <!-- Add to Calendar Buttons -->
                    <table cellpadding="0" cellspacing="0" style="margin-top: 5px;">
                      <tr>
                        <td style="padding-right: 8px;">
                          <a href="${calLinks.google}" target="_blank" style="display: inline-block; padding: 6px 12px; background: #4285f4; color: white; text-decoration: none; border-radius: 4px; font-size: 11px; font-weight: 500;">
                            📅 Google
                          </a>
                        </td>
                        <td style="padding-right: 8px;">
                          <a href="${calLinks.outlook}" target="_blank" style="display: inline-block; padding: 6px 12px; background: #0078d4; color: white; text-decoration: none; border-radius: 4px; font-size: 11px; font-weight: 500;">
                            📅 Outlook
                          </a>
                        </td>
                        <td>
                          <a href="${calLinks.icsDataUrl}" download="gif-volunteer-event.ics" style="display: inline-block; padding: 6px 12px; background: #374151; color: white; text-decoration: none; border-radius: 4px; font-size: 11px; font-weight: 500;">
                            📅 Download .ics
                          </a>
                        </td>
                      </tr>
                    </table>
                  </div>
                `}).join('')}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    ` : '';
    
    // Email assets URLs
    const supabaseProjectUrl = Deno.env.get('SUPABASE_URL') || '';
    const heroImageUrl = `${supabaseProjectUrl}/storage/v1/object/public/email-assets/gif-hero-banner.jpg`;
    const trainingImageUrl = `${supabaseProjectUrl}/storage/v1/object/public/email-assets/training-module-banner.jpg`;
    const dubaiHoldingLogoUrl = `${supabaseProjectUrl}/storage/v1/object/public/email-assets/dubai-holding-logo.png`;
    const surplussLogoUrl = `${supabaseProjectUrl}/storage/v1/object/public/email-assets/surpluss-logo.png`;

    // Generate family member QR sections for Resend HTML (table-based)
    const familyQRSections = familyQRs.map((fam, index) => {
      const famQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(fam.qrCardId)}`;
      const typeLabel = fam.type === 'children' ? 'Child' : 'Adult';
      return `
        <tr>
          <td style="padding: 10px; text-align: center;">
            <p style="font-weight: 600; margin: 0 0 5px 0; color: #374151; font-family: Arial, sans-serif;">${fam.name}</p>
            <p style="font-size: 12px; color: #6b7280; margin: 0 0 10px 0;">${typeLabel}${fam.gender ? ` • ${fam.gender}` : ''}</p>
            <img src="${famQrUrl}" alt="QR Code for ${fam.name}" width="120" height="120" style="display: block; margin: 0 auto;" />
            <p style="font-family: monospace; font-size: 11px; margin-top: 8px; color: #6b7280;">${fam.qrCardId}</p>
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
                <h3 style="margin: 0 0 10px 0; color: #166534; font-family: Arial, sans-serif;">Family Member QR Cards (${familyQRs.length})</h3>
                <p style="color: #15803d; font-size: 13px; margin: 0 0 15px 0;">These QR codes are for your registered family members. Each person should present their own QR code at the marketplace.</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  ${familyQRSections}
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    ` : '';
    
    // Build email subject
    const emailSubject = customization?.subject || "Thank you for registering as a Gift It Forward volunteer";
    
    // Use configured Resend sender (from DB config above)
    console.log(`Using Resend sender: ${resendPrimarySender}, fallback: ${resendFallbackSender}`);
    
    // Build event details section - handle multiple events with better UI
    let eventDetailsHtml = '';
    
    if (registeredEvents.length > 1) {
      // Multiple events - show each separately with visual separation
      eventDetailsHtml = registeredEvents.map((evt, index) => `
        <div style="margin-bottom: 15px; padding: 12px 15px; background-color: #f9fafb; border-left: 3px solid #DA291C; border-radius: 0 4px 4px 0;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #1a1a1a; font-weight: bold;">${evt.name}</p>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #333333; line-height: 1.6;">
            ${evt.date ? `<li><strong>Date:</strong> ${evt.date}</li>` : ''}
            ${evt.location ? `<li><strong>Location:</strong> ${evt.location}</li>` : ''}
            ${evt.time ? `<li><strong>Timings:</strong> ${evt.time}</li>` : ''}
          </ul>
        </div>
      `).join('');
    } else if (registeredEvents.length === 1) {
      // Single event - use same red-bordered design as multiple events for consistency
      const evt = registeredEvents[0];
      eventDetailsHtml = `
        <div style="margin-bottom: 15px; padding: 12px 15px; background-color: #f9fafb; border-left: 3px solid #DA291C; border-radius: 0 4px 4px 0;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #1a1a1a; font-weight: bold;">${evt.name}</p>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #333333; line-height: 1.6;">
            ${evt.date ? `<li><strong>Date:</strong> ${evt.date}</li>` : ''}
            ${evt.location ? `<li><strong>Location:</strong> ${evt.location}</li>` : ''}
            ${evt.time ? `<li><strong>Timings:</strong> ${evt.time}</li>` : ''}
          </ul>
        </div>
      `;
    } else {
      // Fallback to marketplace info
      eventDetailsHtml = `
        <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #333333; line-height: 1.8;">
          ${eventDate ? `<li><strong>Date:</strong> ${eventDate}</li>` : ''}
          ${marketplaceLocation ? `<li><strong>Location:</strong> ${marketplaceLocation}</li>` : ''}
          ${timeRange ? `<li><strong>Timings:</strong> ${timeRange}</li>` : ''}
        </ul>
      `;
    }
    
    let resendResult = await resend.emails.send({
      from: resendPrimarySender,
      to: [email],
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
                  
                  <!-- The Surpluss Logo -->
                  <tr>
                    <td style="padding: 20px 0 0 0; text-align: center;">
                      <img src="${surplussLogoUrl}" alt="The Surpluss" height="45" style="display: block; margin: 0 auto;" />
                    </td>
                  </tr>
                  
                  <!-- Red Vertical Line -->
                  <tr>
                    <td style="padding: 15px 0 10px 0; text-align: center;">
                      <div style="width: 2px; height: 50px; background-color: #DA291C; margin: 0 auto;"></div>
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
                      <p style="margin: 0; font-size: 15px; color: #333333;"><strong>Dear ${firstName},</strong></p>
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
                  
                  <!-- Event Details -->
                  <tr>
                    <td style="padding: 0 30px 20px 30px;">
                      ${eventDetailsHtml}
                    </td>
                  </tr>
                  
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
                      <p style="margin: 0; font-size: 12px; color: #666666;">QR Card ID: ${qrCardId}</p>
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
          <!-- Email open tracking pixel -->
          <img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />
        </body>
        </html>
      `,
    });

    // Check if primary sender failed with domain error, try fallback
    if (resendResult.error) {
      const errorMessage = resendResult.error.message || "";
      console.log(`Primary Resend sender failed: ${errorMessage}`);
      
      if (errorMessage.includes("domain") || errorMessage.includes("not verified") || errorMessage.includes("not found")) {
        console.log(`Retrying with fallback sender: ${resendFallbackSender}`);
        resendResult = await resend.emails.send({
          from: resendFallbackSender,
          to: [email],
          bcc: ['giftitforward@dubaiholding.com'],
          subject: emailSubject,
          html: `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; max-width: 600px;">
                      <tr><td><img src="${heroImageUrl}" alt="Gift It Forward" width="600" style="display: block; width: 100%; height: auto;" /></td></tr>
                      <tr><td style="padding: 20px 0 0 0; text-align: center;"><img src="${surplussLogoUrl}" alt="The Surpluss" height="45" style="display: block; margin: 0 auto;" /></td></tr>
                      <tr><td style="padding: 15px 0 10px 0; text-align: center;"><div style="width: 2px; height: 50px; background-color: #DA291C; margin: 0 auto;"></div></td></tr>
                      <tr><td style="padding: 30px 30px 20px 30px; text-align: center;"><h1 style="margin: 0; font-size: 28px; color: #1a1a1a; font-weight: normal;">Thank you for registering<br>as a Gift It Forward volunteer</h1></td></tr>
                      <tr><td style="padding: 0 30px 15px 30px;"><p style="margin: 0; font-size: 15px; color: #333333;"><strong>Dear ${firstName},</strong></p></td></tr>
                      <tr><td style="padding: 0 30px 15px 30px;"><p style="margin: 0; font-size: 14px; color: #333333; line-height: 1.6;">Your volunteer registration has been <strong>successfully confirmed</strong> for the <strong>Gift It Forward marketplace</strong>.</p></td></tr>
                      <tr><td style="padding: 0 30px 10px 30px; background-color: #f8f8f8;"><h3 style="margin: 20px 0 10px 0; font-size: 16px; color: #1a1a1a; font-weight: bold;">Your volunteer QR code</h3></td></tr>
                      <tr><td style="padding: 0 30px 10px 30px; background-color: #f8f8f8;"><img src="${qrCodeUrl}" alt="Volunteer QR Code" width="150" height="150" style="display: block;" /></td></tr>
                      <tr><td style="padding: 0 30px 15px 30px; background-color: #f8f8f8;"><p style="margin: 0; font-size: 12px; color: #666666;">QR Card ID: ${qrCardId}</p></td></tr>
                      ${familySection}
                      <tr><td style="padding: 20px 30px 10px 30px; border-top: 2px solid #e5e7eb;"><p style="margin: 0 0 10px 0; font-size: 14px; color: #333333; text-decoration: underline; font-weight: bold;">Your login credentials</p></td></tr>
                      <tr><td style="padding: 0 30px 5px 30px;"><p style="margin: 0; font-size: 13px; color: #333333;"><strong>Email:</strong> ${email}</p></td></tr>
                      <tr><td style="padding: 0 30px 15px 30px;"><p style="margin: 0; font-size: 13px; color: #333333;"><strong>Temporary Password:</strong> ${tempPassword}</p></td></tr>
                      <tr><td style="padding: 0 30px 25px 30px;"><a href="${loginUrl}" style="display: inline-block; background-color: #DA291C; color: #ffffff; padding: 10px 20px; text-decoration: none; font-size: 13px; font-weight: 600; border-radius: 4px;">Login to the platform</a></td></tr>
                      <tr><td style="padding: 0 30px 25px 30px;"><a href="${trainingUrl}" style="display: inline-block; background-color: #DA291C; color: #ffffff; padding: 10px 20px; text-decoration: none; font-size: 13px; font-weight: 600; border-radius: 4px;">Start Training</a></td></tr>
                      <tr><td style="padding: 0 30px 20px 30px;"><p style="margin: 0 0 3px 0; font-size: 13px; color: #333333;">Best regards,</p><p style="margin: 0; font-size: 13px; color: #1a1a1a; font-weight: 600;">Gift It Forward team</p></td></tr>
                      <tr><td style="padding: 20px 30px; border-top: 1px solid #e5e7eb;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td width="50%" valign="middle"><img src="${dubaiHoldingLogoUrl}" alt="Dubai Holding" height="40" style="display: block;" /></td><td width="50%" valign="middle" style="text-align: right;"><p style="margin: 0; font-size: 12px; color: #666666; font-style: italic;">For the Good of Tomorrow</p></td></tr></table></td></tr>
                    </table>
                  </td>
                </tr>
              </table>
              <img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />
            </body>
            </html>
          `,
        });
      }
    }

    if (resendResult.error) {
      console.error("Failed to send welcome email with QR via Resend (after fallback):", resendResult.error);
      
      // Log failed Resend attempt
      await logEmailAttempt(
        isFallback ? 'resend_fallback' : 'resend',
        false,
        resendResult.error.message,
        { to: email, subject: emailSubject, isFallback },
        { error: resendResult.error.message, name: resendResult.error.name }
      );
      
      return { success: false, error: resendResult.error.message, provider: isFallback ? 'resend_fallback' : 'resend' };
    }

    console.log(`Welcome email with QR sent successfully to ${email} via Resend${isFallback ? ' (fallback)' : ''} (${1 + familyQRs.length} QR codes)`);
    
    // Log successful Resend attempt
    await logEmailAttempt(
      isFallback ? 'resend_fallback' : 'resend',
      true,
      null,
      { to: email, subject: emailSubject, isFallback, eventCount: registeredEvents.length },
        { status: 'sent' }
    );
    
    return { success: true, provider: isFallback ? 'resend_fallback' : 'resend' };
  } catch (err) {
    console.error("Error sending welcome email with QR:", err);
    
    // Log exception - define logEmailAttempt inline for catch block
    try {
      await supabaseClient
        .from('email_send_logs')
        .insert({
          pending_volunteer_id: pendingId,
          email_type: 'welcome',
          provider: 'unknown',
          recipient_email: email,
          success: false,
          error_message: err instanceof Error ? err.message : "Unknown error",
          request_payload: { to: email },
          response_data: { exception: String(err) }
        });
    } catch (logError) {
      console.error('Failed to log email exception:', logError);
    }
    
    return { success: false, error: err instanceof Error ? err.message : "Unknown error", provider: 'unknown' };
  }
}

// Helper function to send duplicate registration notification email
// deno-lint-ignore no-explicit-any
async function sendDuplicateNotificationEmail(
  supabaseClient: any,
  email: string,
  firstName: string,
  duplicatePendingId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseProjectUrl = Deno.env.get('SUPABASE_URL') || '';
    const heroImageUrl = `${supabaseProjectUrl}/storage/v1/object/public/email-assets/gif-hero-banner.jpg`;
    const dubaiHoldingLogoUrl = `${supabaseProjectUrl}/storage/v1/object/public/email-assets/dubai-holding-logo.png`;
    const surplussLogoUrl = `${supabaseProjectUrl}/storage/v1/object/public/email-assets/surpluss-logo.png`;
    
    const emailSubject = "Gift It Forward - Registration Update";
    
    console.log(`Sending duplicate notification email to ${email}`);
    
    const resendResult = await resend.emails.send({
      from: "Gift It Forward <giftitforward@dubaiholding.com>",
      to: [email],
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
                  
                  <!-- The Surpluss Logo -->
                  <tr>
                    <td style="padding: 20px 0 0 0; text-align: center;">
                      <img src="${surplussLogoUrl}" alt="The Surpluss" height="45" style="display: block; margin: 0 auto;" />
                    </td>
                  </tr>
                  
                  <!-- Red Vertical Line -->
                  <tr>
                    <td style="padding: 15px 0 10px 0; text-align: center;">
                      <div style="width: 2px; height: 50px; background-color: #DA291C; margin: 0 auto;"></div>
                    </td>
                  </tr>
                  
                  <!-- Main Title -->
                  <tr>
                    <td style="padding: 30px 30px 20px 30px; text-align: center;">
                      <h1 style="margin: 0; font-size: 28px; color: #1a1a1a; font-weight: normal; line-height: 1.3;">
                        Registration Update
                      </h1>
                    </td>
                  </tr>
                  
                  <!-- Greeting -->
                  <tr>
                    <td style="padding: 0 30px 15px 30px;">
                      <p style="margin: 0; font-size: 15px; color: #333333;"><strong>Dear ${firstName},</strong></p>
                    </td>
                  </tr>
                  
                  <!-- Message -->
                  <tr>
                    <td style="padding: 0 30px 20px 30px;">
                      <p style="margin: 0 0 15px 0; font-size: 14px; color: #333333; line-height: 1.6;">
                        Thank you for your interest in volunteering with Gift It Forward.
                      </p>
                      <p style="margin: 0 0 15px 0; font-size: 14px; color: #333333; line-height: 1.6;">
                        Our records show that you already have a volunteer profile registered with this email address.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Info Box -->
                  <tr>
                    <td style="padding: 0 30px 20px 30px;">
                      <table width="100%" cellpadding="0" cellspacing="0" style="background: #f0f4f8; border-radius: 8px; border-left: 4px solid #DA291C;">
                        <tr>
                          <td style="padding: 15px 20px;">
                            <p style="margin: 0; font-size: 14px; color: #333333; line-height: 1.6;">
                              If you need to update your registration details or have any questions, please contact us at:
                            </p>
                            <p style="margin: 10px 0 0 0;">
                              <a href="mailto:giftitforward@dubaiholding.com" style="color: #DA291C; text-decoration: none; font-weight: bold; font-size: 14px;">giftitforward@dubaiholding.com</a>
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Closing -->
                  <tr>
                    <td style="padding: 0 30px 30px 30px;">
                      <p style="margin: 0 0 15px 0; font-size: 14px; color: #333333; line-height: 1.6;">
                        We look forward to seeing you at the marketplace!
                      </p>
                      <p style="margin: 0 0 3px 0; font-size: 13px; color: #333333;">Warm regards,</p>
                      <p style="margin: 0; font-size: 13px; color: #1a1a1a; font-weight: 600;">Gift It Forward Team</p>
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
      `,
    });

    if (resendResult.error) {
      console.error("Failed to send duplicate notification email:", resendResult.error);
      
      // Log the failed attempt
      try {
        await supabaseClient
          .from('email_send_logs')
          .insert({
            pending_volunteer_id: duplicatePendingId,
            email_type: 'duplicate_notification',
            provider: 'resend',
            recipient_email: email,
            success: false,
            error_message: resendResult.error.message,
            request_payload: { to: email, subject: emailSubject },
            response_data: { error: resendResult.error.message }
          });
      } catch (logError) {
        console.error('Failed to log email attempt:', logError);
      }
      
      return { success: false, error: resendResult.error.message };
    }

    console.log(`Duplicate notification email sent successfully to ${email}`);
    
    // Log successful attempt
    try {
      await supabaseClient
        .from('email_send_logs')
        .insert({
          pending_volunteer_id: duplicatePendingId,
          email_type: 'duplicate_notification',
          provider: 'resend',
          recipient_email: email,
          success: true,
          error_message: null,
          request_payload: { to: email, subject: emailSubject },
          response_data: { status: 'sent' }
        });
    } catch (logError) {
      console.error('Failed to log email attempt:', logError);
    }
    
    return { success: true };
  } catch (err) {
    console.error("Error sending duplicate notification email:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// Helper function to send confirmation email when new events are added to existing volunteer
// deno-lint-ignore no-explicit-any
async function sendEventAddedConfirmationEmail(
  supabaseClient: any,
  email: string,
  firstName: string,
  newEvents: RegisteredEvent[],
  volunteerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseProjectUrl = Deno.env.get('SUPABASE_URL') || '';
    const heroImageUrl = `${supabaseProjectUrl}/storage/v1/object/public/email-assets/gif-hero-banner.jpg`;
    const dubaiHoldingLogoUrl = `${supabaseProjectUrl}/storage/v1/object/public/email-assets/dubai-holding-logo.png`;
    const surplussLogoUrl = `${supabaseProjectUrl}/storage/v1/object/public/email-assets/surpluss-logo.png`;
    
    const emailSubject = "Gift It Forward - New Event Registration Confirmed";
    
    // Build event list HTML
    const eventListHtml = newEvents.map(evt => {
      const eventName = slugToName(evt.event);
      const eventDate = evt.eventDate || '';
      const eventTime = evt.eventTime || '';
      const eventLocation = evt.eventLocation || '';
      
      return `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
            <p style="margin: 0 0 5px 0; font-size: 15px; color: #1a1a1a; font-weight: bold;">${eventName}</p>
            ${eventDate ? `<p style="margin: 0 0 3px 0; font-size: 13px; color: #666666;">📅 ${eventDate}</p>` : ''}
            ${eventTime ? `<p style="margin: 0 0 3px 0; font-size: 13px; color: #666666;">🕐 ${eventTime}</p>` : ''}
            ${eventLocation ? `<p style="margin: 0; font-size: 13px; color: #666666;">📍 ${eventLocation}</p>` : ''}
          </td>
        </tr>
      `;
    }).join('');
    
    console.log(`Sending event added confirmation email to ${email} for ${newEvents.length} new event(s)`);
    
    const resendResult = await resend.emails.send({
      from: "Gift It Forward <giftitforward@dubaiholding.com>",
      to: [email],
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
                        New Event Registration Confirmed!
                      </h1>
                    </td>
                  </tr>
                  
                  <!-- Greeting -->
                  <tr>
                    <td style="padding: 0 30px 15px 30px;">
                      <p style="margin: 0; font-size: 15px; color: #333333;"><strong>Dear ${firstName},</strong></p>
                    </td>
                  </tr>
                  
                  <!-- Message -->
                  <tr>
                    <td style="padding: 0 30px 20px 30px;">
                      <p style="margin: 0 0 15px 0; font-size: 14px; color: #333333; line-height: 1.6;">
                        Great news! You've been registered for ${newEvents.length > 1 ? 'additional events' : 'an additional event'} as a Gift It Forward volunteer.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- New Events List -->
                  <tr>
                    <td style="padding: 0 30px 20px 30px;">
                      <table width="100%" cellpadding="0" cellspacing="0" style="background: #f0f4f8; border-radius: 8px; border-left: 4px solid #28a745;">
                        <tr>
                          <td style="padding: 15px 20px;">
                            <p style="margin: 0 0 10px 0; font-size: 14px; color: #1a1a1a; font-weight: bold;">
                              New Event${newEvents.length > 1 ? 's' : ''} Added:
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0">
                              ${eventListHtml}
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Info Box -->
                  <tr>
                    <td style="padding: 0 30px 20px 30px;">
                      <table width="100%" cellpadding="0" cellspacing="0" style="background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                        <tr>
                          <td style="padding: 15px 20px;">
                            <p style="margin: 0; font-size: 14px; color: #856404; line-height: 1.6;">
                              <strong>Note:</strong> Your existing volunteer QR code and login credentials remain the same. No new account has been created.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Closing -->
                  <tr>
                    <td style="padding: 0 30px 30px 30px;">
                      <p style="margin: 0 0 15px 0; font-size: 14px; color: #333333; line-height: 1.6;">
                        We look forward to seeing you at ${newEvents.length > 1 ? 'the marketplaces' : 'the marketplace'}!
                      </p>
                      <p style="margin: 0 0 3px 0; font-size: 13px; color: #333333;">Warm regards,</p>
                      <p style="margin: 0; font-size: 13px; color: #1a1a1a; font-weight: 600;">Gift It Forward Team</p>
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
      `,
    });

    if (resendResult.error) {
      console.error("Failed to send event added confirmation email:", resendResult.error);
      
      // Log the failed attempt
      try {
        await supabaseClient
          .from('email_send_logs')
          .insert({
            pending_volunteer_id: volunteerId,
            email_type: 'event_added_confirmation',
            provider: 'resend',
            recipient_email: email,
            success: false,
            error_message: resendResult.error.message,
            request_payload: { to: email, subject: emailSubject, events: newEvents.map(e => e.event) },
            response_data: { error: resendResult.error.message }
          });
      } catch (logError) {
        console.error('Failed to log email attempt:', logError);
      }
      
      return { success: false, error: resendResult.error.message };
    }

    console.log(`Event added confirmation email sent successfully to ${email}`);
    
    // Log successful attempt
    try {
      await supabaseClient
        .from('email_send_logs')
        .insert({
          pending_volunteer_id: volunteerId,
          email_type: 'event_added_confirmation',
          provider: 'resend',
          recipient_email: email,
          success: true,
          error_message: null,
          request_payload: { to: email, subject: emailSubject, events: newEvents.map(e => e.event) },
          response_data: { status: 'sent' }
        });
    } catch (logError) {
      console.error('Failed to log email attempt:', logError);
    }
    
    return { success: true };
  } catch (err) {
    console.error("Error sending event added confirmation email:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// Legacy helper function for backwards compatibility
// deno-lint-ignore no-explicit-any
async function sendWelcomeEmail(
  supabaseClient: any,
  email: string,
  firstName: string,
  lastName: string,
  tempPassword: string,
  loginUrl: string,
  pendingId: string
): Promise<{ success: boolean; error?: string; provider?: string }> {
  // Call new function without QR
  return sendWelcomeEmailWithQR(supabaseClient, email, firstName, lastName, tempPassword, loginUrl, loginUrl + '/training', 'N/A', pendingId, [], undefined, undefined, undefined);
}

interface VolunteerData {
  email: string;
  name?: string;
  phone?: string;
}

interface CreateVolunteerPayload {
  action: 'create_volunteer';
  volunteers: VolunteerData[];
  email_customization?: EmailCustomization;
}

interface CheckVolunteerPayload {
  action: 'check_volunteer_status';
  emails: string[];
}

interface UpdateVolunteerPayload {
  action: 'update_volunteer';
  email: string;
  updates: {
    name?: string;
    phone?: string;
    active?: boolean;
  };
}

interface ProcessMappedDataPayload {
  action: 'process_mapped_data';
  event_id: string;
  array_path: string;
  field_mappings: {
    email: string;
    name?: string;
    phone?: string;
  };
}

// Partner registration interfaces
interface PartnerDependent {
  type: string;
  index: string;
  name: string;
  gender: string;
}

interface PartnerEventRegistration {
  event: string;
  eventDate: string;
  'family-members-joining': string;
  'number-of-children': string;
  'number-of-adults': string;
  'fnb-required'?: string;
  dependents?: PartnerDependent[];
}

interface PartnerRegistration {
  Date: string;
  'IP Address': string;
  'First Name': string;
  'Last Name': string;
  'Phone Number': string;
  'Work Email': string;
  Gender: string;
  'Dubai Holding Employee': string;
  'Dubai Holding Employee - Vertical': string | null;
  'Dubai Holding Employee - Date of Joining': string | null;
  'Dubai Holding Employee - Number': number | null;
  'Not Employee - Company': string | null;
  'Medical Condition': string;
  'Medical Condition Details': string | null;
  'Emergency Contact Name': string;
  'Emergency Contact Relationship': string;
  'Emergency Contact Number': number | string;
  'Fasting during event': string;
  eventslist: string;
  eventsjson: PartnerEventRegistration[];
  'ga-source': string | null;
  'ga-campaign': string | null;
  'ga-medium': string | null;
  'Checkbox - Terms': boolean;
}

// External item interfaces
interface ExternalAddress {
  id: number;
  address: string;
  country: string;
  state: string | null;
  city: string | null;
  zip_code: string | null;
  location_longitude: number;
  location_latitude: number;
  primary: boolean;
  company_id: number;
}

interface ExternalMaterialGroup {
  id: number;
  name: string;
  code: string;
  uom: string;
}

interface ExternalSdgGoal {
  id: number;
  name: string;
  code: string;
  description: string;
  image_url: string | null;
}

interface ExternalCompany {
  id: number;
  uuid: string;
  name: string;
  main_business: string | null;
  sector: string | null;
  company_size: string | null;
  designation: string | null;
  image_url: string | null;
  about_info: string | null;
  website_url: string | null;
  currency: string;
  company_license_number: string | null;
  is_parent_company: boolean;
  addresses?: ExternalAddress[];
}

interface ExternalItem {
  id: number;
  uuid: string;
  title: string;
  description: string | null;
  active: boolean;
  price: number | null;
  per: string | null;
  frequency: Record<string, boolean> | null;
  image_url: string | null;
  quantity: number;
  item_count: number;
  box_count: number | null;
  type: Record<string, unknown> | null;
  material_group_id: number;
  address_id: number;
  third_level_subcategory_id: number | null;
  condition_id: number | null;
  address?: ExternalAddress;
  material_group?: ExternalMaterialGroup;
  sdg_goals?: ExternalSdgGoal[];
  company?: ExternalCompany;
}

interface VolunteerResult {
  email: string;
  status: 'created' | 'failed';
  temp_password?: string;
  qr_card_id?: string;
  error?: string;
}

interface VolunteerStatusResult {
  email: string;
  exists: boolean;
  user_id?: string;
  has_role: boolean;
  metadata?: {
    name?: string;
    phone?: string;
    onboarded_via?: string;
  };
  created_at?: string;
}

function generateTempPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Helper to process external items
// deno-lint-ignore no-explicit-any
async function processExternalItems(supabase: any, items: ExternalItem[], webhookEventId: string | null) {
  const results = {
    total: items.length,
    processed: 0,
    failed: 0,
    details: [] as Array<{ id: number; status: string; error?: string }>
  };

  for (const item of items) {
    try {
      // Upsert company if present
      let companyDbId: string | null = null;
      if (item.company) {
        const company = item.company;
        const { data: companyData, error: companyError } = await supabase
          .from('external_companies')
          .upsert({
            external_id: company.id,
            uuid: company.uuid,
            name: company.name,
            main_business: company.main_business,
            sector: company.sector,
            company_size: company.company_size,
            designation: company.designation,
            image_url: company.image_url,
            about_info: company.about_info,
            website_url: company.website_url,
            currency: company.currency || 'AED',
            company_license_number: company.company_license_number,
            is_parent_company: company.is_parent_company || false,
            updated_at: new Date().toISOString()
          }, { onConflict: 'external_id' })
          .select('id')
          .single();

        if (companyError) {
          console.warn('Failed to upsert company:', companyError);
        } else {
          companyDbId = companyData?.id || null;
        }

        // Upsert company addresses
        if (company.addresses && companyDbId) {
          for (const addr of company.addresses) {
            await supabase
              .from('external_addresses')
              .upsert({
                external_id: addr.id,
                company_id: companyDbId,
                address: addr.address,
                country: addr.country,
                state: addr.state,
                city: addr.city,
                zip_code: addr.zip_code,
                location_longitude: addr.location_longitude,
                location_latitude: addr.location_latitude,
                is_primary: addr.primary || false,
                updated_at: new Date().toISOString()
              }, { onConflict: 'external_id' });
          }
        }
      }

      // Upsert address if present
      let addressDbId: string | null = null;
      if (item.address) {
        const addr = item.address;
        const { data: addrData, error: addrError } = await supabase
          .from('external_addresses')
          .upsert({
            external_id: addr.id,
            company_id: companyDbId,
            address: addr.address,
            country: addr.country,
            state: addr.state,
            city: addr.city,
            zip_code: addr.zip_code,
            location_longitude: addr.location_longitude,
            location_latitude: addr.location_latitude,
            is_primary: addr.primary || false,
            updated_at: new Date().toISOString()
          }, { onConflict: 'external_id' })
          .select('id')
          .single();

        if (addrError) {
          console.warn('Failed to upsert address:', addrError);
        } else {
          addressDbId = addrData?.id || null;
        }
      }

      // Upsert material group if present
      let materialGroupDbId: string | null = null;
      if (item.material_group) {
        const mg = item.material_group;
        const { data: mgData, error: mgError } = await supabase
          .from('external_material_groups')
          .upsert({
            external_id: mg.id,
            name: mg.name,
            code: mg.code,
            uom: mg.uom,
            updated_at: new Date().toISOString()
          }, { onConflict: 'external_id' })
          .select('id')
          .single();

        if (mgError) {
          console.warn('Failed to upsert material group:', mgError);
        } else {
          materialGroupDbId = mgData?.id || null;
        }
      }

      // Upsert SDG goals
      const sdgGoalDbIds: string[] = [];
      if (item.sdg_goals && item.sdg_goals.length > 0) {
        for (const goal of item.sdg_goals) {
          const { data: goalData, error: goalError } = await supabase
            .from('external_sdg_goals')
            .upsert({
              external_id: goal.id,
              name: goal.name,
              code: goal.code,
              description: goal.description,
              image_url: goal.image_url,
              updated_at: new Date().toISOString()
            }, { onConflict: 'external_id' })
            .select('id')
            .single();

          if (!goalError && goalData) {
            sdgGoalDbIds.push(goalData.id);
          }
        }
      }

      // Upsert the item itself
      const { data: itemData, error: itemError } = await supabase
        .from('external_items')
        .upsert({
          external_id: item.id,
          uuid: item.uuid,
          title: item.title,
          description: item.description,
          active: item.active,
          price: item.price,
          per: item.per,
          frequency: item.frequency,
          image_url: item.image_url,
          quantity: item.quantity || 0,
          item_count: item.item_count || 0,
          box_count: item.box_count,
          type_data: item.type,
          condition_id: item.condition_id,
          company_id: companyDbId,
          address_id: addressDbId,
          material_group_id: materialGroupDbId,
          third_level_subcategory_id: item.third_level_subcategory_id,
          webhook_event_id: webhookEventId,
          updated_at: new Date().toISOString()
        }, { onConflict: 'external_id' })
        .select('id')
        .single();

      if (itemError) {
        console.error('Failed to upsert item:', itemError);
        results.failed++;
        results.details.push({ id: item.id, status: 'failed', error: itemError.message });
        continue;
      }

      // Link SDG goals to item
      if (itemData && sdgGoalDbIds.length > 0) {
        // Remove existing links
        await supabase
          .from('external_item_sdg_goals')
          .delete()
          .eq('item_id', itemData.id);

        // Insert new links
        for (const goalId of sdgGoalDbIds) {
          await supabase
            .from('external_item_sdg_goals')
            .insert({
              item_id: itemData.id,
              sdg_goal_id: goalId
            });
        }
      }

      results.processed++;
      results.details.push({ id: item.id, status: 'processed' });
      console.log(`Successfully processed item: ${item.title} (ID: ${item.id})`);

    } catch (err) {
      console.error(`Error processing item ${item.id}:`, err);
      results.failed++;
      results.details.push({ 
        id: item.id, 
        status: 'failed', 
        error: err instanceof Error ? err.message : 'Unknown error' 
      });
    }
  }

  return results;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookApiKey = Deno.env.get('WEBHOOK_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the request body
    const payload = await req.json();
    
    // Parse URL for query parameters
    const url = new URL(req.url);
    const sourceIdentifier = url.searchParams.get('source') || 
                             req.headers.get('x-source-identifier') || 
                             null;
    
    const headersObj = Object.fromEntries(req.headers.entries());
    const sourceIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const providedApiKey = req.headers.get('x-api-key');
    
    console.log('Webhook received:', JSON.stringify(payload, null, 2));
    console.log('Source IP:', sourceIp);
    console.log('Source Identifier:', sourceIdentifier);
    console.log('Timestamp:', new Date().toISOString());

    // Store the webhook event in the database
    const { data: eventData, error: insertError } = await supabase
      .from('webhook_events')
      .insert({
        payload,
        headers: headersObj,
        source_ip: sourceIp,
        source_identifier: sourceIdentifier,
        received_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to store webhook event:', insertError);
    } else {
      console.log('Webhook event stored with ID:', eventData.id);
    }

    // Check if this is an external items payload
    // Detect by checking for array with 'title' and 'material_group' fields
    if (Array.isArray(payload) && payload.length > 0 && payload[0].title && payload[0].material_group_id !== undefined) {
      console.log('Detected external items payload');
      const items = payload as ExternalItem[];
      
      const results = await processExternalItems(supabase, items, eventData?.id || null);

      // Mark webhook event as processed
      if (eventData?.id) {
        await supabase
          .from('webhook_events')
          .update({ processed: true })
          .eq('id', eventData.id);
      }

      console.log(`External items processed: ${results.processed}/${results.total} successful`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'External items processed',
          results
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is a single external item (not in array)
    if (payload.title && payload.material_group_id !== undefined && !Array.isArray(payload)) {
      console.log('Detected single external item payload');
      const items = [payload] as ExternalItem[];
      
      const results = await processExternalItems(supabase, items, eventData?.id || null);

      // Mark webhook event as processed
      if (eventData?.id) {
        await supabase
          .from('webhook_events')
          .update({ processed: true })
          .eq('id', eventData.id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'External item processed',
          results
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle allocation_created event from external companies
    if (payload.event === 'allocation_created' && payload.data?.allocated_materials) {
      console.log('Detected allocation_created event');
      
      const allocationData = payload.data;
      const externalMarketplaceId = allocationData.marketplace_event_id;
      const marketplaceTitle = allocationData.marketplace_event_title;
      const allocatedMaterials = allocationData.allocated_materials || [];
      
      const results = {
        marketplace_matched: false,
        marketplace_id: null as string | null,
        marketplace_created: false,
        materials_processed: 0,
        materials_failed: 0,
        allocations_created: 0,
        allocations_updated: 0,
        details: [] as Array<{ material_id: number; material_title: string; status: string; allocation_id?: string; error?: string }>
      };

      // Try to find existing marketplace by external_id first, then by title
      let marketplace = null;
      
      // First try by external_id
      const { data: marketplaceByExtId } = await supabase
        .from('marketplace_events')
        .select('id, name, external_id')
        .eq('external_id', externalMarketplaceId)
        .single();
      
      if (marketplaceByExtId) {
        marketplace = marketplaceByExtId;
        results.marketplace_matched = true;
        results.marketplace_id = marketplace.id;
        console.log(`Found marketplace by external_id: ${marketplace.name} (${marketplace.id})`);
      } else {
        // Try to find by title (fuzzy match)
        const { data: marketplaceByTitle } = await supabase
          .from('marketplace_events')
          .select('id, name, external_id')
          .ilike('name', `%${marketplaceTitle}%`)
          .limit(1)
          .single();
        
        if (marketplaceByTitle) {
          marketplace = marketplaceByTitle;
          results.marketplace_matched = true;
          results.marketplace_id = marketplace.id;
          
          // Update the external_id for future matching
          await supabase
            .from('marketplace_events')
            .update({ external_id: externalMarketplaceId })
            .eq('id', marketplace.id);
          
          console.log(`Found marketplace by title: ${marketplace.name} (${marketplace.id}), linked external_id: ${externalMarketplaceId}`);
        } else {
          // Create new marketplace event
          const { data: newMarketplace, error: createError } = await supabase
            .from('marketplace_events')
            .insert({
              name: marketplaceTitle,
              external_id: externalMarketplaceId,
              status: 'upcoming',
              event_date: allocationData.allocated_at ? new Date(allocationData.allocated_at).toISOString().split('T')[0] : null
            })
            .select('id, name')
            .single();
          
          if (createError) {
            console.error('Failed to create marketplace:', createError);
            return new Response(
              JSON.stringify({
                success: false,
                error: `Failed to create marketplace: ${createError.message}`,
                results
              }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          marketplace = newMarketplace;
          results.marketplace_matched = true;
          results.marketplace_id = marketplace.id;
          results.marketplace_created = true;
          console.log(`Created new marketplace: ${marketplace.name} (${marketplace.id})`);
        }
      }

      // Process each allocated material
      for (const material of allocatedMaterials) {
        try {
          const materialId = material.material_id;
          const materialTitle = material.material_title;
          const amount = material.amount || 0;
          
          // Try to find existing item_type by external_material_id first, then by name
          let itemType = null;
          
          const { data: itemByExtId } = await supabase
            .from('item_types')
            .select('id, name, external_material_id')
            .eq('external_material_id', materialId)
            .single();
          
          if (itemByExtId) {
            itemType = itemByExtId;
            console.log(`Found item by external_material_id: ${itemType.name} (${itemType.id})`);
          } else {
            // Try to find by name
            const { data: itemByName } = await supabase
              .from('item_types')
              .select('id, name, external_material_id')
              .ilike('name', materialTitle)
              .limit(1)
              .single();
            
            if (itemByName) {
              itemType = itemByName;
              
              // Update the external_material_id for future matching
              await supabase
                .from('item_types')
                .update({ external_material_id: materialId })
                .eq('id', itemType.id);
              
              console.log(`Found item by name: ${itemType.name} (${itemType.id}), linked external_material_id: ${materialId}`);
            } else {
              // Create new item type
              const { data: newItem, error: createItemError } = await supabase
                .from('item_types')
                .insert({
                  name: materialTitle,
                  external_material_id: materialId,
                  icon: 'Package',
                  total_stock: 0 // Safe default — real total will be set by donations sync
                })
                .select('id, name')
                .single();
              
              if (createItemError) {
                console.error(`Failed to create item type ${materialTitle}:`, createItemError);
                results.materials_failed++;
                results.details.push({
                  material_id: materialId,
                  material_title: materialTitle,
                  status: 'failed',
                  error: `Failed to create item type: ${createItemError.message}`
                });
                continue;
              }
              
              itemType = newItem;
              console.log(`Created new item type: ${itemType.name} (${itemType.id})`);
            }
          }

          // Check for existing allocation
          const { data: existingAllocation } = await supabase
            .from('marketplace_item_allocations')
            .select('id, allocated_quantity')
            .eq('marketplace_id', marketplace.id)
            .eq('item_type_id', itemType.id)
            .single();
          
          if (existingAllocation) {
            // Update existing allocation - add to the allocated quantity
            const newQuantity = existingAllocation.allocated_quantity + amount;
            const { error: updateError } = await supabase
              .from('marketplace_item_allocations')
              .update({ 
                allocated_quantity: newQuantity,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingAllocation.id);
            
            if (updateError) {
              console.error(`Failed to update allocation:`, updateError);
              results.materials_failed++;
              results.details.push({
                material_id: materialId,
                material_title: materialTitle,
                status: 'failed',
                error: `Failed to update allocation: ${updateError.message}`
              });
              continue;
            }
            
            results.allocations_updated++;
            results.materials_processed++;
            results.details.push({
              material_id: materialId,
              material_title: materialTitle,
              status: 'updated',
              allocation_id: existingAllocation.id
            });
            console.log(`Updated allocation for ${materialTitle}: +${amount} (total: ${newQuantity})`);
          } else {
            // Create new allocation
            const { data: newAllocation, error: createAllocError } = await supabase
              .from('marketplace_item_allocations')
              .insert({
                marketplace_id: marketplace.id,
                item_type_id: itemType.id,
                allocated_quantity: amount,
                distributed_quantity: 0
              })
              .select('id')
              .single();
            
            if (createAllocError) {
              console.error(`Failed to create allocation:`, createAllocError);
              results.materials_failed++;
              results.details.push({
                material_id: materialId,
                material_title: materialTitle,
                status: 'failed',
                error: `Failed to create allocation: ${createAllocError.message}`
              });
              continue;
            }
            
            results.allocations_created++;
            results.materials_processed++;
            results.details.push({
              material_id: materialId,
              material_title: materialTitle,
              status: 'created',
              allocation_id: newAllocation.id
            });
            console.log(`Created allocation for ${materialTitle}: ${amount} units`);
          }
        } catch (err) {
          console.error(`Error processing material ${material.material_id}:`, err);
          results.materials_failed++;
          results.details.push({
            material_id: material.material_id,
            material_title: material.material_title,
            status: 'failed',
            error: err instanceof Error ? err.message : 'Unknown error'
          });
        }
      }

      // Mark webhook event as processed
      if (eventData?.id) {
        await supabase
          .from('webhook_events')
          .update({ processed: true })
          .eq('id', eventData.id);
      }

      console.log(`Allocation processing complete: ${results.materials_processed} materials, ${results.allocations_created} created, ${results.allocations_updated} updated`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Allocation processed',
          results
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is a volunteer creation request
    if (payload.action === 'create_volunteer') {
      // Check if user is authenticated as admin (for internal calls from admin panel)
      const authHeader = req.headers.get('authorization');
      let isAuthenticatedAdmin = false;
      
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const supabaseAnonUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const anonClient = createClient(supabaseAnonUrl, supabaseAnonKey);
        
        const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
        
        if (!authError && user) {
          // Check if user has admin role
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single();
          
          if (roleData?.role === 'admin') {
            isAuthenticatedAdmin = true;
            console.log('Authenticated admin user:', user.email);
          }
        }
      }
      
      // Validate API key for protected actions (skip if authenticated admin)
      if (!isAuthenticatedAdmin && (!webhookApiKey || providedApiKey !== webhookApiKey)) {
        console.error('Invalid or missing API key for create_volunteer action');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Unauthorized: Invalid or missing API key' 
          }),
          { 
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const volunteerPayload = payload as CreateVolunteerPayload;
      
      if (!Array.isArray(volunteerPayload.volunteers) || volunteerPayload.volunteers.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Invalid payload: volunteers array is required and must not be empty' 
          }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const results: VolunteerResult[] = [];
      let createdCount = 0;
      let failedCount = 0;

      for (const volunteer of volunteerPayload.volunteers) {
        // Validate email
        if (!volunteer.email || !isValidEmail(volunteer.email)) {
          results.push({
            email: volunteer.email || 'missing',
            status: 'failed',
            error: 'Invalid or missing email address'
          });
          failedCount++;
          continue;
        }

        const tempPassword = generateTempPassword();

        try {
          // Create user account
          const { data: userData, error: createError } = await supabase.auth.admin.createUser({
            email: volunteer.email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              name: volunteer.name || '',
              phone: volunteer.phone || '',
              onboarded_via: 'partner_webhook'
            }
          });

          if (createError) {
            console.error(`Failed to create user ${volunteer.email}:`, createError);
            results.push({
              email: volunteer.email,
              status: 'failed',
              error: createError.message
            });
            failedCount++;
            continue;
          }

          if (!userData.user) {
            results.push({
              email: volunteer.email,
              status: 'failed',
              error: 'User creation returned no user data'
            });
            failedCount++;
            continue;
          }

          // Assign volunteer role (use delete-then-insert to handle trigger conflicts)
          await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', userData.user.id);
            
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: userData.user.id,
              role: 'volunteer'
            });

          if (roleError) {
            console.error(`Failed to assign role to ${volunteer.email}:`, roleError);
          }

          // Generate volunteer QR card
          const volunteerQRId = generateVolunteerQRId();
          
          // Create entry in pending_volunteers to track
          const firstName = volunteer.name?.split(' ')[0] || 'Volunteer';
          const lastName = volunteer.name?.split(' ').slice(1).join(' ') || '';
          
          // Look up marketplace info if marketplace_id is provided
          let volunteerMarketplaceId: string | null = null;
          let volunteerEventsList: string | null = null;
          let volunteerEventsJson: Array<Record<string, unknown>> | null = null;
          let volunteerMarketplaceInfo: MarketplaceInfo | null = null;

          if ((volunteer as Record<string, unknown>).marketplace_id) {
            volunteerMarketplaceId = (volunteer as Record<string, unknown>).marketplace_id as string;
            volunteerMarketplaceInfo = await getMarketplaceInfo(supabase, volunteerMarketplaceId);
            if (volunteerMarketplaceInfo) {
              volunteerEventsList = volunteerMarketplaceInfo.name.toLowerCase().replace(/\s+/g, '-');
              volunteerEventsJson = [{
                event: volunteerEventsList,
                name: volunteerMarketplaceInfo.name,
                eventDate: volunteerMarketplaceInfo.event_date || undefined,
                eventLocation: volunteerMarketplaceInfo.location || undefined,
              }];
            }
          }

          const { data: pendingData, error: pendingError } = await supabase
            .from('pending_volunteers')
            .insert({
              email: volunteer.email,
              first_name: firstName,
              last_name: lastName,
              phone_number: volunteer.phone || null,
              status: 'approved',
              approved_at: new Date().toISOString(),
              created_user_id: userData.user.id,
              temp_password: tempPassword,
              source_data: { created_via: 'admin_webhook_action' },
              events_list: volunteerEventsList,
              events_json: volunteerEventsJson,
            })
            .select('id')
            .single();

          if (pendingError) {
            console.error(`Failed to create pending_volunteers record:`, pendingError);
          }

          const pendingId = pendingData?.id || userData.user.id;

          // Create volunteer QR card
          const { error: qrError } = await supabase
            .from('volunteer_qr_cards')
            .insert({
              unique_id: volunteerQRId,
              volunteer_id: pendingId,
              status: 'inactive',
              marketplace_id: volunteerMarketplaceId || null
            });

          if (qrError) {
            console.error(`Failed to create volunteer QR card:`, qrError);
          }

          // Send welcome email with QR code
          const appUrl = 'https://gif.thesurpluss.com';
          const loginUrl = `${appUrl}/auth`;
          const trainingUrl = `${appUrl}/training`;

          const emailResult = await sendWelcomeEmailWithQR(
            supabase,
            volunteer.email,
            firstName,
            '', // No last name for manual creation
            tempPassword,
            loginUrl,
            trainingUrl,
            volunteerQRId,
            pendingId,
            [], // No family members for manual creation
            volunteerPayload.email_customization, // Pass custom email content
            volunteerMarketplaceInfo, // marketplace info
            volunteerMarketplaceId // marketplaceId
          );

          if (emailResult.success) {
            // Update email sent status
            if (pendingData?.id) {
              await supabase
                .from('pending_volunteers')
                .update({
                  email_sent: true,
                  email_sent_at: new Date().toISOString(),
                  email_send_count: 1
                })
                .eq('id', pendingData.id);
            }
            
            results.push({
              email: volunteer.email,
              status: 'created',
              temp_password: tempPassword,
              qr_card_id: volunteerQRId
            });
            console.log(`Successfully created volunteer and sent email: ${volunteer.email}`);
          } else {
            results.push({
              email: volunteer.email,
              status: 'created',
              temp_password: tempPassword,
              qr_card_id: volunteerQRId,
              error: 'User created but email failed: ' + emailResult.error
            });
            console.log(`Created volunteer but email failed: ${volunteer.email} - ${emailResult.error}`);
          }

          createdCount++;

        } catch (err) {
          console.error(`Unexpected error creating ${volunteer.email}:`, err);
          results.push({
            email: volunteer.email,
            status: 'failed',
            error: err instanceof Error ? err.message : 'Unknown error'
          });
          failedCount++;
        }
      }

      // Update the webhook event with processing results
      if (eventData?.id) {
        await supabase
          .from('webhook_events')
          .update({ 
            processed: true,
            payload: {
              ...payload,
              processing_results: {
                total: volunteerPayload.volunteers.length,
                created: createdCount,
                failed: failedCount
              }
            }
          })
          .eq('id', eventData.id);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Volunteer onboarding processed',
          results: {
            total: volunteerPayload.volunteers.length,
            created: createdCount,
            failed: failedCount,
            details: results
          }
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check volunteer status
    if (payload.action === 'check_volunteer_status') {
      // Validate API key
      if (!webhookApiKey || providedApiKey !== webhookApiKey) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized: Invalid or missing API key' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const statusPayload = payload as CheckVolunteerPayload;
      
      if (!Array.isArray(statusPayload.emails) || statusPayload.emails.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid payload: emails array is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const results: VolunteerStatusResult[] = [];

      for (const email of statusPayload.emails) {
        if (!isValidEmail(email)) {
          results.push({ email, exists: false, has_role: false });
          continue;
        }

        // Get user by email
        const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
        
        if (userError) {
          console.error('Error listing users:', userError);
          results.push({ email, exists: false, has_role: false });
          continue;
        }

        const user = userData.users.find(u => u.email === email);
        
        if (!user) {
          results.push({ email, exists: false, has_role: false });
          continue;
        }

        // Check if user has volunteer role
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'volunteer')
          .maybeSingle();

        results.push({
          email,
          exists: true,
          user_id: user.id,
          has_role: !!roleData,
          metadata: {
            name: user.user_metadata?.name,
            phone: user.user_metadata?.phone,
            onboarded_via: user.user_metadata?.onboarded_via
          },
          created_at: user.created_at
        });
      }

      console.log(`Checked status for ${results.length} volunteers`);

      return new Response(
        JSON.stringify({ success: true, results }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update volunteer information
    if (payload.action === 'update_volunteer') {
      // Validate API key
      if (!webhookApiKey || providedApiKey !== webhookApiKey) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized: Invalid or missing API key' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const updatePayload = payload as UpdateVolunteerPayload;
      
      if (!updatePayload.email || !isValidEmail(updatePayload.email)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid payload: valid email is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!updatePayload.updates || Object.keys(updatePayload.updates).length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid payload: updates object is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find user by email
      const { data: userData, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        console.error('Error listing users:', listError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to find user' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const user = userData.users.find(u => u.email === updatePayload.email);
      
      if (!user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Volunteer not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update user metadata
      const newMetadata = { ...user.user_metadata };
      if (updatePayload.updates.name !== undefined) {
        newMetadata.name = updatePayload.updates.name;
      }
      if (updatePayload.updates.phone !== undefined) {
        newMetadata.phone = updatePayload.updates.phone;
      }

      const updateData: { user_metadata?: object; ban_duration?: string } = {
        user_metadata: newMetadata
      };

      // Handle active status (ban/unban)
      if (updatePayload.updates.active === false) {
        updateData.ban_duration = '87600h'; // ~10 years
      }

      const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        updateData
      );

      // If reactivating, we need to unban
      if (updatePayload.updates.active === true) {
        await supabase.auth.admin.updateUserById(user.id, { ban_duration: 'none' });
      }

      if (updateError) {
        console.error('Error updating user:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Updated volunteer: ${updatePayload.email}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Volunteer updated successfully',
          user: {
            email: updatedUser.user?.email,
            metadata: updatedUser.user?.user_metadata
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process mapped data from webhook event (internal admin action)
    if (payload.action === 'process_mapped_data') {
      // This action is called from the admin UI, not external webhooks
      // Verify the request has a valid authorization header (authenticated user)
      const authHeader = req.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Authentication required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify the user is an admin
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

      const mappedPayload = payload as ProcessMappedDataPayload;
      
      if (!mappedPayload.event_id || !mappedPayload.array_path || !mappedPayload.field_mappings?.email) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required fields: event_id, array_path, field_mappings.email' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch the original webhook event
      const { data: origEventData, error: eventError } = await supabase
        .from('webhook_events')
        .select('payload')
        .eq('id', mappedPayload.event_id)
        .single();

      if (eventError || !origEventData) {
        return new Response(
          JSON.stringify({ success: false, error: 'Webhook event not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get the array from the payload using the array path
      const getArrayByPath = (obj: unknown, path: string): unknown[] => {
        const parts = path.split('.');
        let current: unknown = obj;
        for (const part of parts) {
          if (current === null || current === undefined) return [];
          current = (current as Record<string, unknown>)[part];
        }
        return Array.isArray(current) ? current : [];
      };

      const dataArray = getArrayByPath(origEventData.payload, mappedPayload.array_path);
      
      if (dataArray.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: `No data found at path: ${mappedPayload.array_path}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract volunteers from the mapped data
      const volunteers: VolunteerData[] = dataArray.map(item => {
        const record = item as Record<string, unknown>;
        return {
          email: String(record[mappedPayload.field_mappings.email] || ''),
          name: mappedPayload.field_mappings.name ? String(record[mappedPayload.field_mappings.name] || '') : undefined,
          phone: mappedPayload.field_mappings.phone ? String(record[mappedPayload.field_mappings.phone] || '') : undefined,
        };
      }).filter(v => v.email && isValidEmail(v.email));

      console.log(`Processing ${volunteers.length} volunteers from mapped data`);

      const results: VolunteerResult[] = [];
      let createdCount = 0;
      let failedCount = 0;

      for (const volunteer of volunteers) {
        const tempPassword = generateTempPassword();

        try {
          const { data: userData, error: createError } = await supabase.auth.admin.createUser({
            email: volunteer.email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              name: volunteer.name || '',
              phone: volunteer.phone || '',
              onboarded_via: 'partner_webhook_mapped'
            }
          });

          if (createError) {
            console.error(`Failed to create user ${volunteer.email}:`, createError);
            results.push({ email: volunteer.email, status: 'failed', error: createError.message });
            failedCount++;
            continue;
          }

          if (!userData.user) {
            results.push({ email: volunteer.email, status: 'failed', error: 'User creation returned no user data' });
            failedCount++;
            continue;
          }

          // Assign volunteer role
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({ user_id: userData.user.id, role: 'volunteer' });

          if (roleError) {
            console.error(`Failed to assign role to ${volunteer.email}:`, roleError);
            results.push({ email: volunteer.email, status: 'created', temp_password: tempPassword, error: 'Role assignment failed' });
          } else {
            results.push({ email: volunteer.email, status: 'created', temp_password: tempPassword });
          }

          createdCount++;
          console.log(`Successfully created volunteer: ${volunteer.email}`);

        } catch (err) {
          console.error(`Unexpected error creating ${volunteer.email}:`, err);
          results.push({ email: volunteer.email, status: 'failed', error: err instanceof Error ? err.message : 'Unknown error' });
          failedCount++;
        }
      }

      // Mark the webhook event as processed
      await supabase
        .from('webhook_events')
        .update({ processed: true })
        .eq('id', mappedPayload.event_id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Mapped data processed successfully',
          results: {
            total: volunteers.length,
            created: createdCount,
            failed: failedCount,
            details: results
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is a partner registration payload (array with specific structure)
    // Partner sends array of registrations without an "action" field
    if (Array.isArray(payload) && payload.length > 0 && payload[0]['Work Email']) {
      console.log('Detected partner registration payload');
      const registrations = payload as PartnerRegistration[];
      
      const results = {
        total: registrations.length,
        processed: 0,
        failed: 0,
        details: [] as Array<{ email: string; status: string; error?: string; registration_id?: string }>
      };

      for (const reg of registrations) {
        try {
          // Clean phone number (remove quotes)
          const cleanPhone = reg['Phone Number']?.replace(/'/g, '').trim() || null;
          
          // Parse submission date
          let submissionDate: string | null = null;
          if (reg.Date) {
            try {
              // Parse "12/24/2025 6:35:13 am" format
              const parts = reg.Date.match(/(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+):(\d+)\s*(am|pm)?/i);
              if (parts) {
                let hour = parseInt(parts[4]);
                if (parts[7]?.toLowerCase() === 'pm' && hour !== 12) hour += 12;
                if (parts[7]?.toLowerCase() === 'am' && hour === 12) hour = 0;
                submissionDate = new Date(
                  parseInt(parts[3]), parseInt(parts[1]) - 1, parseInt(parts[2]),
                  hour, parseInt(parts[5]), parseInt(parts[6])
                ).toISOString();
              }
            } catch (e) {
              console.warn('Failed to parse date:', reg.Date);
            }
          }

          // Insert partner registration
          const { data: regData, error: regError } = await supabase
            .from('partner_registrations')
            .insert({
              submission_date: submissionDate,
              ip_address: reg['IP Address'] || null,
              first_name: reg['First Name'],
              last_name: reg['Last Name'],
              phone_number: cleanPhone,
              work_email: reg['Work Email'],
              gender: reg.Gender || null,
              is_employee: reg['Dubai Holding Employee'] === 'Yes',
              employee_vertical: reg['Dubai Holding Employee - Vertical'] || null,
              employee_join_date: reg['Dubai Holding Employee - Date of Joining'] || null,
              employee_number: reg['Dubai Holding Employee - Number']?.toString() || null,
              external_company: reg['Not Employee - Company'] || null,
              has_medical_condition: reg['Medical Condition'] === 'Yes',
              medical_condition_details: reg['Medical Condition Details'] || null,
              emergency_contact_name: reg['Emergency Contact Name'] || null,
              emergency_contact_relationship: reg['Emergency Contact Relationship'] || null,
              emergency_contact_number: reg['Emergency Contact Number']?.toString() || null,
              is_fasting: reg['Fasting during event'] === 'Yes',
              events_list: reg.eventslist || null,
              ga_source: reg['ga-source'] || null,
              ga_campaign: reg['ga-campaign'] || null,
              ga_medium: reg['ga-medium'] || null,
              terms_accepted: reg['Checkbox - Terms'] === true,
              webhook_event_id: eventData?.id || null
            })
            .select()
            .single();

          if (regError) {
            console.error('Failed to insert registration:', regError);
            results.failed++;
            results.details.push({
              email: reg['Work Email'],
              status: 'failed',
              error: regError.message
            });
            continue;
          }

          // Insert event registrations
          if (reg.eventsjson && Array.isArray(reg.eventsjson)) {
            for (const eventReg of reg.eventsjson) {
              const { data: eventRegData, error: eventError } = await supabase
                .from('registration_events')
                .insert({
                  registration_id: regData.id,
                  event_slug: eventReg.event,
                  event_date: eventReg.eventDate || null,
                  family_members_joining: eventReg['family-members-joining'] === 'Yes',
                  number_of_children: parseInt(eventReg['number-of-children']) || 0,
                  number_of_adults: parseInt(eventReg['number-of-adults']) || 0,
                  fnb_required: eventReg['fnb-required'] === 'Yes'
                })
                .select()
                .single();

              if (eventError) {
                console.warn('Failed to insert event registration:', eventError);
                continue;
              }

              // Insert dependents
              if (eventReg.dependents && Array.isArray(eventReg.dependents)) {
                for (const dep of eventReg.dependents) {
                  const { error: depError } = await supabase
                    .from('event_dependents')
                    .insert({
                      registration_event_id: eventRegData.id,
                      dependent_type: dep.type,
                      dependent_index: parseInt(dep.index) || null,
                      name: dep.name,
                      gender: dep.gender || null
                    });

                  if (depError) {
                    console.warn('Failed to insert dependent:', depError);
                  }
                }
              }
            }
          }

          results.processed++;
          results.details.push({
            email: reg['Work Email'],
            status: 'processed',
            registration_id: regData.id
          });

          console.log(`Successfully processed registration for: ${reg['Work Email']}`);

        } catch (err) {
          console.error(`Error processing registration for ${reg['Work Email']}:`, err);
          results.failed++;
          results.details.push({
            email: reg['Work Email'],
            status: 'failed',
            error: err instanceof Error ? err.message : 'Unknown error'
          });
        }
      }

      // Mark webhook event as processed
      if (eventData?.id) {
        await supabase
          .from('webhook_events')
          .update({ processed: true })
          .eq('id', eventData.id);
      }

      console.log(`Partner registration processed: ${results.processed}/${results.total} successful`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Partner registrations processed',
          results
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is a DH Webflow volunteer form submission
    // Format: { triggerType: 'form_submission', payload: { data: { ... } } }
    // AUTO-APPROVE: Dubai Holding volunteers are automatically approved and accounts created
    if (payload.triggerType === 'form_submission' && payload.payload?.data) {
      const formData = payload.payload.data;

      const extractEmailFromDhFormData = (data: Record<string, unknown>): string | null => {
        const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

        const normalized = new Map<string, unknown>();
        for (const [key, value] of Object.entries(data)) {
          normalized.set(key.trim().toLowerCase(), value);
        }

        const preferredKeys = [
          'work email',
          'work email address',
          'email',
          'email address',
          'e-mail',
          'work_email',
          'workemail',
        ];

        for (const key of preferredKeys) {
          const value = normalized.get(key);
          if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed && emailRegex.test(trimmed)) return trimmed;
          }
        }

        // Last resort: scan all string fields for something that looks like an email.
        for (const value of normalized.values()) {
          if (typeof value !== 'string') continue;
          const match = value.match(emailRegex);
          if (match?.[0]) return match[0].trim();
        }

        return null;
      };
      
      // Check if it has volunteer form fields (at minimum First Name is required)
      if (formData['First Name']) {
        // Check if email is missing - create pending record for admin visibility
        const volunteerEmail = extractEmailFromDhFormData(formData);
        
        if (!volunteerEmail) {
          console.log('DH Webflow form submission missing email - creating pending record for admin review');
          
          // Parse eventsjson if it's a string
          let eventsJson = null;
          if (formData.eventsjson) {
            try {
              eventsJson = typeof formData.eventsjson === 'string' 
                ? JSON.parse(formData.eventsjson) 
                : formData.eventsjson;
            } catch (e) {
              console.warn('Failed to parse eventsjson:', e);
              eventsJson = formData.eventsjson;
            }
          }
          
          // Create marketplace events from form data if they don't exist
          await createMarketplacesFromEvents(supabase, eventsJson);
          
          // Create a pending record so admin can see it and contact the volunteer
          const { data: pendingData, error: pendingError } = await supabase
            .from('pending_volunteers')
            .insert({
              webhook_event_id: eventData?.id || null,
              email: `missing_email_${Date.now()}@placeholder.invalid`, // Placeholder for required field
              first_name: formData['First Name'],
              last_name: formData['Last Name'] || '',
              phone_number: formData['Phone Number']?.replace(/'/g, '').trim() || null,
              gender: formData.Gender || null,
              is_employee: formData['Dubai Holding Employee'] === 'Yes',
              employee_vertical: formData['Dubai Holding Employee - Vertical'] || null,
              employee_join_date: formData['Dubai Holding Employee - Date of Joining'] || null,
              employee_number: formData['Dubai Holding Employee - Number']?.toString() || null,
              external_company: formData['Not Employee - Company'] || null,
              has_medical_condition: formData['Medical Condition'] === 'Yes',
              medical_condition_details: formData['Medical Condition Details'] || null,
              emergency_contact_name: formData['Emergency Contact Name'] || null,
              emergency_contact_relationship: formData['Emergency Contact Relationship'] || null,
              emergency_contact_number: formData['Emergency Contact Number']?.toString() || null,
              is_fasting: formData['Fasting during event'] === 'Yes',
              events_list: formData.eventslist || null,
              events_json: eventsJson,
              source_data: formData,
              status: 'pending' // Needs admin attention - missing email
            })
            .select()
            .single();

          if (pendingError) {
            console.error('Failed to create pending volunteer record:', pendingError);
          } else {
            console.log(`Created pending record for volunteer with missing email: ${formData['First Name']} ${formData['Last Name'] || ''}, ID: ${pendingData?.id}`);
          }

          // Mark webhook as processed (we handled it, just couldn't fully process)
          if (eventData?.id) {
            await supabase
              .from('webhook_events')
              .update({ processed: true })
              .eq('id', eventData.id);
          }

          return new Response(
            JSON.stringify({
              success: false,
              error: 'Email is missing from the form submission. Volunteer record created for admin review.',
              pending_id: pendingData?.id,
              name: `${formData['First Name']} ${formData['Last Name'] || ''}`.trim(),
              phone: formData['Phone Number'] || null
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.log('Detected DH Webflow volunteer form submission - AUTO APPROVING');
        
        try {
          // Parse eventsjson if it's a string
          let eventsJson = null;
          if (formData.eventsjson) {
            try {
              eventsJson = typeof formData.eventsjson === 'string' 
                ? JSON.parse(formData.eventsjson) 
                : formData.eventsjson;
            } catch (e) {
              console.warn('Failed to parse eventsjson:', e);
              eventsJson = formData.eventsjson;
            }
          }

          // Create marketplace events from form data if they don't exist
          await createMarketplacesFromEvents(supabase, eventsJson);

          const volunteerEmail = extractEmailFromDhFormData(formData);
          const firstName = formData['First Name'];
          const lastName = formData['Last Name'] || '';

          if (!volunteerEmail) {
            console.log('DH Webflow volunteer form submission missing email (post-parse) - creating pending record for admin review');
            throw new Error('Email is missing from the form submission');
          }

          // Check if this email already has an approved volunteer record (duplicate detection)
          const { data: existingApproved } = await supabase
            .from('pending_volunteers')
            .select('id, first_name, last_name, email, created_user_id, events_json, events_list')
            .eq('email', volunteerEmail.toLowerCase())
            .eq('status', 'approved')
            .maybeSingle();

          if (existingApproved) {
            console.log(`Existing volunteer found for ${volunteerEmail} - merging events into original record ID: ${existingApproved.id}`);
            
            // Merge new events into existing volunteer's events
            const existingEventsJson = existingApproved.events_json as RegisteredEvent[] || [];
            const existingEventsList = existingApproved.events_list || '';
            
            // Add new events that aren't already in the existing list
            let mergedEventsJson = [...existingEventsJson];
            let mergedEventsList = existingEventsList;
            let newEventsAdded: RegisteredEvent[] = [];
            
            if (eventsJson && Array.isArray(eventsJson)) {
              for (const newEvent of eventsJson as RegisteredEvent[]) {
                // Check if this event slug already exists
                const eventExists = existingEventsJson.some(
                  (existing) => existing.event === newEvent.event
                );
                
                if (!eventExists) {
                  mergedEventsJson.push(newEvent);
                  newEventsAdded.push(newEvent);
                  
                  // Add to events_list if not already there
                  if (!mergedEventsList.includes(newEvent.event)) {
                    mergedEventsList = mergedEventsList 
                      ? `${mergedEventsList}, ${newEvent.event}` 
                      : newEvent.event;
                  }
                }
              }
            }
            
            if (newEventsAdded.length > 0) {
              // Update the existing volunteer record with merged events
              const { error: updateError } = await supabase
                .from('pending_volunteers')
                .update({
                  events_json: mergedEventsJson,
                  events_list: mergedEventsList,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingApproved.id);
              
              if (updateError) {
                console.error('Failed to merge events into existing record:', updateError);
              } else {
                console.log(`Merged ${newEventsAdded.length} new event(s) into volunteer ${existingApproved.id}`);
                
                // Send confirmation email about new events added
                await sendEventAddedConfirmationEmail(
                  supabase, 
                  volunteerEmail, 
                  existingApproved.first_name,
                  newEventsAdded,
                  existingApproved.id
                );
              }
            } else {
              console.log(`No new events to add for ${volunteerEmail} - already registered for same events`);
              
              // Send duplicate notification for exact same events
              await sendDuplicateNotificationEmail(supabase, volunteerEmail, firstName, existingApproved.id);
            }

            // Mark webhook as processed
            if (eventData?.id) {
              await supabase.from('webhook_events').update({ processed: true }).eq('id', eventData.id);
            }

            return new Response(
              JSON.stringify({
                success: true,
                message: newEventsAdded.length > 0 
                  ? `Added ${newEventsAdded.length} new event(s) to existing volunteer`
                  : 'Volunteer already registered for these events',
                volunteer_id: existingApproved.id,
                events_added: newEventsAdded.length,
                email: volunteerEmail
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Generate temp password and create user account immediately
          const tempPassword = generateTempPassword();
          
          const { data: userData, error: createError } = await supabase.auth.admin.createUser({
            email: volunteerEmail,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              name: `${firstName} ${lastName}`.trim(),
              phone: formData['Phone Number']?.replace(/'/g, '').trim() || '',
              onboarded_via: 'dh_webhook_auto'
            }
          });

          if (createError) {
            // Check if this is a duplicate email error
            const isDuplicateError = createError.message?.includes('already been registered') || 
                                     createError.message?.includes('already exists') ||
                                     (createError as { code?: string }).code === 'email_exists';
            
            if (isDuplicateError) {
              console.log(`User creation failed due to existing account for ${volunteerEmail} - merging events`);
              
              // Find the existing approved record with events data
              const { data: existingRecord } = await supabase
                .from('pending_volunteers')
                .select('id, first_name, last_name, events_json, events_list')
                .eq('email', volunteerEmail.toLowerCase())
                .eq('status', 'approved')
                .maybeSingle();

              if (existingRecord) {
                // Merge new events into existing volunteer's events
                const existingEventsJson = existingRecord.events_json as RegisteredEvent[] || [];
                const existingEventsList = existingRecord.events_list || '';
                
                let mergedEventsJson = [...existingEventsJson];
                let mergedEventsList = existingEventsList;
                let newEventsAdded: RegisteredEvent[] = [];
                
                if (eventsJson && Array.isArray(eventsJson)) {
                  for (const newEvent of eventsJson as RegisteredEvent[]) {
                    const eventExists = existingEventsJson.some(
                      (existing) => existing.event === newEvent.event
                    );
                    
                    if (!eventExists) {
                      mergedEventsJson.push(newEvent);
                      newEventsAdded.push(newEvent);
                      
                      if (!mergedEventsList.includes(newEvent.event)) {
                        mergedEventsList = mergedEventsList 
                          ? `${mergedEventsList}, ${newEvent.event}` 
                          : newEvent.event;
                      }
                    }
                  }
                }
                
                if (newEventsAdded.length > 0) {
                  const { error: updateError } = await supabase
                    .from('pending_volunteers')
                    .update({
                      events_json: mergedEventsJson,
                      events_list: mergedEventsList,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', existingRecord.id);
                  
                  if (updateError) {
                    console.error('Failed to merge events into existing record:', updateError);
                  } else {
                    console.log(`Merged ${newEventsAdded.length} new event(s) into volunteer ${existingRecord.id}`);
                    await sendEventAddedConfirmationEmail(supabase, volunteerEmail, existingRecord.first_name, newEventsAdded, existingRecord.id);
                  }
                } else {
                  console.log(`No new events to add for ${volunteerEmail} - already registered for same events`);
                  await sendDuplicateNotificationEmail(supabase, volunteerEmail, firstName, existingRecord.id);
                }

                // Mark webhook as processed
                if (eventData?.id) {
                  await supabase.from('webhook_events').update({ processed: true }).eq('id', eventData.id);
                }

                return new Response(
                  JSON.stringify({
                    success: true,
                    message: newEventsAdded.length > 0 
                      ? `Added ${newEventsAdded.length} new event(s) to existing volunteer`
                      : 'Volunteer already registered for these events',
                    volunteer_id: existingRecord.id,
                    events_added: newEventsAdded.length,
                    email: volunteerEmail
                  }),
                  { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            }
            
            console.error(`Failed to create user ${volunteerEmail}:`, createError);
            // Still create the pending record so admin can see it, but mark as failed
            const { data: pendingData } = await supabase
              .from('pending_volunteers')
              .insert({
                webhook_event_id: eventData?.id || null,
                email: volunteerEmail,
                first_name: firstName,
                last_name: lastName,
                phone_number: formData['Phone Number']?.replace(/'/g, '').trim() || null,
                gender: formData.Gender || null,
                is_employee: formData['Dubai Holding Employee'] === 'Yes',
                employee_vertical: formData['Dubai Holding Employee - Vertical'] || null,
                employee_join_date: formData['Dubai Holding Employee - Date of Joining'] || null,
                employee_number: formData['Dubai Holding Employee - Number']?.toString() || null,
                external_company: formData['Not Employee - Company'] || null,
                has_medical_condition: formData['Medical Condition'] === 'Yes',
                medical_condition_details: formData['Medical Condition Details'] || null,
                emergency_contact_name: formData['Emergency Contact Name'] || null,
                emergency_contact_relationship: formData['Emergency Contact Relationship'] || null,
                emergency_contact_number: formData['Emergency Contact Number']?.toString() || null,
                is_fasting: formData['Fasting during event'] === 'Yes',
                events_list: formData.eventslist || null,
                events_json: eventsJson,
                source_data: formData,
                status: 'pending' // Keep as pending since auto-creation failed
              })
              .select()
              .single();

            return new Response(
              JSON.stringify({
                success: false,
                error: `Auto-approval failed: ${createError.message}. Volunteer saved for manual approval.`,
                pending_id: pendingData?.id,
                email: volunteerEmail
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (!userData.user) {
            return new Response(
              JSON.stringify({ success: false, error: 'User creation returned no user data' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Delete any existing roles first (trigger may have added one)
          await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', userData.user.id);

          // Assign volunteer role
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({ user_id: userData.user.id, role: 'volunteer' });

          if (roleError) {
            console.error(`Failed to assign role to ${volunteerEmail}:`, roleError);
          }

          // Create approved volunteer record with credentials
          const { data: pendingData, error: pendingError } = await supabase
            .from('pending_volunteers')
            .insert({
              webhook_event_id: eventData?.id || null,
              email: volunteerEmail,
              first_name: firstName,
              last_name: lastName,
              phone_number: formData['Phone Number']?.replace(/'/g, '').trim() || null,
              gender: formData.Gender || null,
              is_employee: formData['Dubai Holding Employee'] === 'Yes',
              employee_vertical: formData['Dubai Holding Employee - Vertical'] || null,
              employee_join_date: formData['Dubai Holding Employee - Date of Joining'] || null,
              employee_number: formData['Dubai Holding Employee - Number']?.toString() || null,
              external_company: formData['Not Employee - Company'] || null,
              has_medical_condition: formData['Medical Condition'] === 'Yes',
              medical_condition_details: formData['Medical Condition Details'] || null,
              emergency_contact_name: formData['Emergency Contact Name'] || null,
              emergency_contact_relationship: formData['Emergency Contact Relationship'] || null,
              emergency_contact_number: formData['Emergency Contact Number']?.toString() || null,
              is_fasting: formData['Fasting during event'] === 'Yes',
              events_list: formData.eventslist || null,
              events_json: eventsJson,
              source_data: formData,
              status: 'approved', // Auto-approved
              approved_at: new Date().toISOString(),
              created_user_id: userData.user.id,
              temp_password: tempPassword // Store for admin visibility
            })
            .select()
            .single();

          if (pendingError) {
            console.error('Failed to create volunteer record:', pendingError);
            // User was created but record wasn't - still a success from webhook perspective
            return new Response(
              JSON.stringify({
                success: true,
                message: 'Volunteer account created but record storage failed',
                email: volunteerEmail,
                user_id: userData.user.id,
                temp_password: tempPassword
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          console.log(`Auto-approved volunteer: ${volunteerEmail}, User ID: ${userData.user.id}`);

          // Generate QR card for the volunteer
          const qrCardId = generateVolunteerQRId();
          console.log(`Creating volunteer QR card: ${qrCardId}`);
          
          const { data: qrCardData, error: qrCardError } = await supabase
            .from('volunteer_qr_cards')
            .insert({
              unique_id: qrCardId,
              volunteer_id: pendingData.id,
              status: 'inactive'
            })
            .select()
            .single();

          if (qrCardError) {
            console.error('Failed to create volunteer QR card:', qrCardError);
          } else {
            console.log(`Volunteer QR card created: ${qrCardId}, Card DB ID: ${qrCardData.id}`);
          }

          // Extract unique dependents and create family member QR cards
          const dependents = extractUniqueDependents(eventsJson);
          const familyQRs: FamilyMemberQR[] = [];
          
          for (let i = 0; i < dependents.length; i++) {
            const dep = dependents[i];
            const familyQrCardId = generateFamilyQRId(qrCardId, i + 1);
            
            // Create QR card for family member (linked to same volunteer)
            const { error: famQrError } = await supabase
              .from('volunteer_qr_cards')
              .insert({
                unique_id: familyQrCardId,
                volunteer_id: pendingData.id,
                status: 'inactive'
              });
            
            if (famQrError) {
              console.error(`Failed to create family QR card for ${dep.name}:`, famQrError);
            } else {
              console.log(`Family QR card created: ${familyQrCardId} for ${dep.name}`);
              familyQRs.push({
                name: dep.name,
                type: dep.type,
                gender: dep.gender,
                qrCardId: familyQrCardId
              });
            }
          }

          console.log(`Created ${familyQRs.length} family member QR cards`);

          // Determine app URL for email links
          const appUrl = 'https://gif.thesurpluss.com';
          const loginUrl = `${appUrl}/auth`;
          const trainingUrl = `${appUrl}/training`;

          // Look up first event's marketplace info from database (if eventsJson provided)
          let firstEventMarketplace: MarketplaceInfo | null = null;
          let firstEventMarketplaceId: string | null = null;
          
          if (eventsJson && Array.isArray(eventsJson) && eventsJson.length > 0) {
            const firstEvent = eventsJson[0] as RegisteredEvent;
            if (firstEvent.event) {
              // Try to find matching marketplace in database
              const eventSlugs = [firstEvent.event];
              const marketplaceDetails = await getMarketplacesBySlug(supabase, eventSlugs);
              const matchedMarketplace = marketplaceDetails.get(firstEvent.event);
              
              if (matchedMarketplace) {
                console.log(`Found matching marketplace for first event: ${matchedMarketplace.name}`);
                firstEventMarketplace = {
                  name: matchedMarketplace.name,
                  location: matchedMarketplace.location,
                  event_date: matchedMarketplace.event_date,
                  start_time: matchedMarketplace.start_time,
                  end_time: matchedMarketplace.end_time
                };
                
                // Also try to get the marketplace ID for MS Graph email
                const { data: mpWithId } = await supabase
                  .from('marketplace_events')
                  .select('id')
                  .eq('name', matchedMarketplace.name)
                  .maybeSingle();
                if (mpWithId) {
                  firstEventMarketplaceId = mpWithId.id;
                }
              } else {
                // Use form data directly if no database match
                console.log(`No database match for event slug: ${firstEvent.event}, using form data`);
                const { start: startTime, end: endTime } = parseTimeRange(firstEvent.eventTime);
                firstEventMarketplace = {
                  name: slugToName(firstEvent.event),
                  location: firstEvent.eventLocation || null,
                  event_date: parseDateToISO(firstEvent.eventDate),
                  start_time: startTime,
                  end_time: endTime
                };
              }
            }
          }

          // Send welcome email with all QR codes (volunteer + family members)
          const emailResult = await sendWelcomeEmailWithQR(
            supabase,
            volunteerEmail,
            firstName,
            lastName,
            tempPassword,
            loginUrl,
            trainingUrl,
            qrCardId,
            pendingData.id,
            familyQRs,
            undefined, // customization
            firstEventMarketplace, // marketplace info from first registered event
            firstEventMarketplaceId, // marketplaceId for MS Graph
            eventsJson // Pass all events data for multi-event emails
          );

          // Update pending volunteer with email status
          if (emailResult.success) {
            await supabase
              .from('pending_volunteers')
              .update({
                email_sent: true,
                email_sent_at: new Date().toISOString(),
                email_send_count: 1
              })
              .eq('id', pendingData.id);
          }

          console.log(`Email sent: ${emailResult.success}, Error: ${emailResult.error || 'none'}`);

          return new Response(
            JSON.stringify({
              success: true,
              message: `Volunteer auto-approved, QR cards created (${1 + familyQRs.length} total), and email sent`,
              pending_id: pendingData.id,
              email: volunteerEmail,
              user_id: userData.user.id,
              qr_card_id: qrCardId,
              family_qr_count: familyQRs.length,
              temp_password: tempPassword,
              email_sent: emailResult.success,
              email_error: emailResult.error || null
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );

        } catch (err) {
          console.error('Error processing volunteer form:', err);
          return new Response(
            JSON.stringify({
              success: false,
              error: err instanceof Error ? err.message : 'Unknown error'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Add email to pending volunteer and trigger approval (admin action)
    // This is for volunteers who submitted forms without email addresses
    if (payload.action === 'add_volunteer_email') {
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
      
      const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();
      if (authError || !authUser) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid authentication' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check admin role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authUser.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!roleData) {
        return new Response(
          JSON.stringify({ success: false, error: 'Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { pending_id, email } = payload;
      if (!pending_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'pending_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!email || !isValidEmail(email)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Valid email address is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if email already exists in pending_volunteers (except placeholder emails)
      const { data: existingPending } = await supabase
        .from('pending_volunteers')
        .select('id, email')
        .eq('email', email)
        .neq('id', pending_id)
        .maybeSingle();

      if (existingPending) {
        return new Response(
          JSON.stringify({ success: false, error: 'This email is already registered to another volunteer' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if email already exists in auth.users
      const { data: usersData } = await supabase.auth.admin.listUsers();
      const existingAuthUser = usersData?.users.find(u => u.email === email);
      if (existingAuthUser) {
        return new Response(
          JSON.stringify({ success: false, error: 'An account with this email already exists' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch pending volunteer
      const { data: pendingVolunteer, error: fetchError } = await supabase
        .from('pending_volunteers')
        .select('*')
        .eq('id', pending_id)
        .eq('status', 'pending')
        .single();

      if (fetchError || !pendingVolunteer) {
        return new Response(
          JSON.stringify({ success: false, error: 'Pending volunteer not found or already processed' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update the pending volunteer with the real email
      const { error: updateEmailError } = await supabase
        .from('pending_volunteers')
        .update({ email: email })
        .eq('id', pending_id);

      if (updateEmailError) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to update email: ' + updateEmailError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Now proceed with the approval flow (same as approve_volunteer)
      const tempPassword = generateTempPassword();
      
      const { data: userData, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          name: `${pendingVolunteer.first_name} ${pendingVolunteer.last_name}`.trim(),
          phone: pendingVolunteer.phone_number || '',
          onboarded_via: 'dh_webhook_email_added'
        }
      });

      if (createError) {
        console.error(`Failed to create user ${email}:`, createError);
        return new Response(
          JSON.stringify({ success: false, error: createError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!userData.user) {
        return new Response(
          JSON.stringify({ success: false, error: 'User creation returned no user data' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const userId = userData.user.id;

      // Assign volunteer role
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
        
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: 'volunteer' });

      if (roleError) {
        console.error(`Failed to assign volunteer role:`, roleError);
      }

      // Update pending_volunteers record
      const { error: updateError } = await supabase
        .from('pending_volunteers')
        .update({
          status: 'approved',
          approved_by: authUser.id,
          approved_at: new Date().toISOString(),
          created_user_id: userId,
          temp_password: tempPassword
        })
        .eq('id', pending_id);

      if (updateError) {
        console.error('Failed to update pending_volunteers:', updateError);
      }

      // Generate volunteer QR card
      const qrCardId = generateVolunteerQRId();
      const { error: qrCardError } = await supabase
        .from('volunteer_qr_cards')
        .insert({
          unique_id: qrCardId,
          volunteer_id: pending_id,
          status: 'inactive'
        });

      if (qrCardError) {
        console.error('Failed to create volunteer QR card:', qrCardError);
      }

      // Extract unique dependents and create family member QR cards
      const dependents = extractUniqueDependents(pendingVolunteer.events_json);
      const familyQRs: FamilyMemberQR[] = [];
      
      for (let i = 0; i < dependents.length; i++) {
        const dep = dependents[i];
        const familyQrCardId = generateFamilyQRId(qrCardId, i + 1);
        
        const { error: famQrError } = await supabase
          .from('volunteer_qr_cards')
          .insert({
            unique_id: familyQrCardId,
            volunteer_id: pending_id,
            status: 'inactive'
          });
        
        if (!famQrError) {
          familyQRs.push({
            name: dep.name,
            type: dep.type,
            gender: dep.gender,
            qrCardId: familyQrCardId
          });
        }
      }

      // Send welcome email
      const appUrl = 'https://gif.thesurpluss.com';
      const loginUrl = `${appUrl}/auth`;
      const trainingUrl = `${appUrl}/training`;
      
      const emailResult = await sendWelcomeEmailWithQR(
        supabase,
        email,
        pendingVolunteer.first_name,
        pendingVolunteer.last_name || '',
        tempPassword,
        loginUrl,
        trainingUrl,
        qrCardId,
        pending_id,
        familyQRs,
        undefined,
        undefined,
        undefined,
        pendingVolunteer.events_json
      );

      // Update email tracking fields
      await supabase
        .from('pending_volunteers')
        .update({
          email_sent: emailResult.success,
          email_sent_at: emailResult.success ? new Date().toISOString() : null,
          email_send_count: 1
        })
        .eq('id', pending_id);

      console.log(`Added email and approved volunteer: ${email}, QR: ${qrCardId}, Family: ${familyQRs.length}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email added, account created, and welcome email sent',
          email: email,
          temp_password: tempPassword,
          user_id: userId,
          qr_card_id: qrCardId,
          family_qr_count: familyQRs.length,
          email_sent: emailResult.success,
          email_error: emailResult.error || null
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for approve_volunteer action (admin action)
    if (payload.action === 'approve_volunteer') {
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
      
      const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();
      if (authError || !authUser) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid authentication' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check admin role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authUser.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!roleData) {
        return new Response(
          JSON.stringify({ success: false, error: 'Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { pending_id } = payload;
      if (!pending_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'pending_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch pending volunteer
      const { data: pendingVolunteer, error: fetchError } = await supabase
        .from('pending_volunteers')
        .select('*')
        .eq('id', pending_id)
        .eq('status', 'pending')
        .single();

      if (fetchError || !pendingVolunteer) {
        return new Response(
          JSON.stringify({ success: false, error: 'Pending volunteer not found or already processed' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate temp password and try to create user
      const tempPassword = generateTempPassword();
      
      let userId: string;
      let userAlreadyExists = false;
      
      const { data: userData, error: createError } = await supabase.auth.admin.createUser({
        email: pendingVolunteer.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          name: `${pendingVolunteer.first_name} ${pendingVolunteer.last_name}`.trim(),
          phone: pendingVolunteer.phone_number || '',
          onboarded_via: 'dh_webhook_approved'
        }
      });

      if (createError) {
        // Check if user already exists
        if (createError.message.includes('already been registered') || createError.code === 'email_exists') {
          console.log(`User ${pendingVolunteer.email} already exists, linking to existing account`);
          
          // Find existing user
          const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
          if (listError) {
            console.error('Failed to list users:', listError);
            return new Response(
              JSON.stringify({ success: false, error: 'Failed to find existing user' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          const existingUser = usersData.users.find(u => u.email === pendingVolunteer.email);
          if (!existingUser) {
            return new Response(
              JSON.stringify({ success: false, error: 'User exists but could not be found' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          userId = existingUser.id;
          userAlreadyExists = true;
        } else {
          console.error(`Failed to create user ${pendingVolunteer.email}:`, createError);
          return new Response(
            JSON.stringify({ success: false, error: createError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else if (!userData.user) {
        return new Response(
          JSON.stringify({ success: false, error: 'User creation returned no user data' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        userId = userData.user.id;
      }

      // Delete any existing roles first (trigger may have added one)
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Assign volunteer role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: 'volunteer' });

      if (roleError) {
        console.error(`Failed to assign role to ${pendingVolunteer.email}:`, roleError);
      }

      // Update pending volunteer record
      // If user already exists, we don't have the password, so leave temp_password as null
      await supabase
        .from('pending_volunteers')
        .update({
          status: 'approved',
          approved_by: authUser.id,
          approved_at: new Date().toISOString(),
          created_user_id: userId,
          temp_password: userAlreadyExists ? null : tempPassword
        })
        .eq('id', pending_id);

      console.log(`Approved volunteer: ${pendingVolunteer.email}${userAlreadyExists ? ' (linked to existing account)' : ''}`);

      // Generate QR card for the volunteer
      const qrCardId = generateVolunteerQRId();
      console.log(`Creating volunteer QR card for manual approval: ${qrCardId}`);
      
      const { error: qrCardError } = await supabase
        .from('volunteer_qr_cards')
        .insert({
          unique_id: qrCardId,
          volunteer_id: pending_id,
          status: 'inactive'
        });

      if (qrCardError) {
        console.error('Failed to create volunteer QR card:', qrCardError);
      }

      // Extract unique dependents and create family member QR cards
      const dependents = extractUniqueDependents(pendingVolunteer.events_json);
      const familyQRs: FamilyMemberQR[] = [];
      
      for (let i = 0; i < dependents.length; i++) {
        const dep = dependents[i];
        const familyQrCardId = generateFamilyQRId(qrCardId, i + 1);
        
        // Create QR card for family member (linked to same volunteer)
        const { error: famQrError } = await supabase
          .from('volunteer_qr_cards')
          .insert({
            unique_id: familyQrCardId,
            volunteer_id: pending_id,
            status: 'inactive'
          });
        
        if (famQrError) {
          console.error(`Failed to create family QR card for ${dep.name}:`, famQrError);
        } else {
          console.log(`Family QR card created: ${familyQrCardId} for ${dep.name}`);
          familyQRs.push({
            name: dep.name,
            type: dep.type,
            gender: dep.gender,
            qrCardId: familyQrCardId
          });
        }
      }

      console.log(`Created ${familyQRs.length} family member QR cards for manual approval`);

      // Send welcome email with login credentials and QR codes (only if new user)
      let emailResult: { success: boolean; error?: string; provider?: string } = { success: false };
      if (!userAlreadyExists) {
        const appUrl = 'https://gif.thesurpluss.com';
        const loginUrl = `${appUrl}/auth`;
        const trainingUrl = `${appUrl}/training`;
        
        emailResult = await sendWelcomeEmailWithQR(
          supabase,
          pendingVolunteer.email,
          pendingVolunteer.first_name,
          pendingVolunteer.last_name || '',
          tempPassword,
          loginUrl,
          trainingUrl,
          qrCardId,
          pending_id,
          familyQRs,
          undefined, // customization
          undefined, // marketplace info
          undefined, // marketplaceId
          pendingVolunteer.events_json // Pass events data for times in email
        );

        // Update email tracking fields
        await supabase
          .from('pending_volunteers')
          .update({
            email_sent: emailResult.success,
            email_sent_at: emailResult.success ? new Date().toISOString() : null,
            email_send_count: 1
          })
          .eq('id', pending_id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: userAlreadyExists 
            ? 'Volunteer approved and linked to existing account (user already had an account)' 
            : 'Volunteer approved, QR cards created, and account created',
          email: pendingVolunteer.email,
          temp_password: userAlreadyExists ? null : tempPassword,
          user_id: userId,
          qr_card_id: qrCardId,
          family_qr_count: familyQRs.length,
          user_already_existed: userAlreadyExists,
          email_sent: userAlreadyExists ? false : emailResult.success,
          email_send_count: userAlreadyExists ? 0 : 1,
          email_error: emailResult.error || null
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for reject_volunteer action
    if (payload.action === 'reject_volunteer') {
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
      
      const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();
      if (authError || !authUser) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid authentication' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check admin role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authUser.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!roleData) {
        return new Response(
          JSON.stringify({ success: false, error: 'Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { pending_id, reason } = payload;
      if (!pending_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'pending_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update pending volunteer record
      const { data: updatedData, error: updateError } = await supabase
        .from('pending_volunteers')
        .update({
          status: 'rejected',
          approved_by: authUser.id,
          approved_at: new Date().toISOString(),
          rejection_reason: reason || null
        })
        .eq('id', pending_id)
        .eq('status', 'pending')
        .select()
        .single();

      if (updateError || !updatedData) {
        return new Response(
          JSON.stringify({ success: false, error: 'Pending volunteer not found or already processed' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Rejected volunteer: ${updatedData.email}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Volunteer application rejected',
          email: updatedData.email
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add family member to an existing volunteer (admin action)
    if (payload.action === 'add_family_member') {
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
      
      const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();
      if (authError || !authUser) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid authentication' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check admin role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authUser.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!roleData) {
        return new Response(
          JSON.stringify({ success: false, error: 'Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { volunteer_id, family_member } = payload;
      if (!volunteer_id || !family_member?.name) {
        return new Response(
          JSON.stringify({ success: false, error: 'volunteer_id and family_member.name are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get volunteer's existing QR cards to find the parent QR ID
      const { data: existingCards, error: cardsError } = await supabase
        .from('volunteer_qr_cards')
        .select('unique_id')
        .eq('volunteer_id', volunteer_id)
        .order('created_at', { ascending: true });

      if (cardsError) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to fetch volunteer cards' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find the parent QR (first one without -F pattern)
      const parentCard = existingCards?.find(c => !/-F\d+/.test(c.unique_id));
      if (!parentCard) {
        return new Response(
          JSON.stringify({ success: false, error: 'No parent volunteer QR card found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Count existing family cards to get next index
      const familyCardCount = existingCards?.filter(c => /-F\d+/.test(c.unique_id)).length || 0;
      
      // Generate new family QR ID
      const familyQrCardId = generateFamilyQRId(parentCard.unique_id, familyCardCount + 1);

      // Create the family member QR card
      const { error: createError } = await supabase
        .from('volunteer_qr_cards')
        .insert({
          unique_id: familyQrCardId,
          volunteer_id: volunteer_id,
          status: 'inactive'
        });

      if (createError) {
        console.error('Failed to create family QR card:', createError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create QR card: ' + createError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Created family QR card ${familyQrCardId} for ${family_member.name} (volunteer ${volunteer_id})`);

      // Persist the new dependent into events_json so all UI surfaces show the name
      // This mirrors the webhook flow exactly: sets family-members-joining, counts, and index
      try {
        const { data: volData } = await supabase
          .from('pending_volunteers')
          .select('events_json')
          .eq('id', volunteer_id)
          .maybeSingle();

        const familyIndex = familyCardCount + 1;
        const newDep = {
          name: family_member.name.trim(),
          type: family_member.type || 'adult',
          gender: family_member.gender || null,
          index: familyIndex,
        };
        const newDepNameLower = newDep.name.toLowerCase();

        let eventsJson: any[] = (volData?.events_json && Array.isArray(volData.events_json))
          ? volData.events_json as any[]
          : [];

        if (eventsJson.length === 0) {
          // Create a minimal event entry with the dependent (mirrors webhook structure)
          eventsJson = [{
            'family-members-joining': 'Yes',
            'number-of-adults': newDep.type === 'adult' ? 1 : 0,
            'number-of-children': newDep.type === 'children' ? 1 : 0,
            'total-attendees': 2,
            dependents: [newDep],
          }];
        } else {
          // Append to the first event's dependents (deduplicate by name)
          const deps: any[] = eventsJson[0].dependents || [];
          const isDuplicate = deps.some((d: any) => {
            const existing = (d.name || '').toLowerCase();
            return existing === newDepNameLower || existing.includes(newDepNameLower) || newDepNameLower.includes(existing);
          });
          if (!isDuplicate) {
            deps.push(newDep);
            // Update metadata to match webhook structure
            const adultCount = deps.filter((d: any) => d.type === 'adult').length;
            const childCount = deps.filter((d: any) => d.type === 'children' || d.type === 'child').length;
            eventsJson[0] = {
              ...eventsJson[0],
              'family-members-joining': 'Yes',
              'number-of-adults': adultCount,
              'number-of-children': childCount,
              'total-attendees': 1 + adultCount + childCount,
              dependents: deps,
            };
          }
        }

        await supabase
          .from('pending_volunteers')
          .update({ events_json: eventsJson })
          .eq('id', volunteer_id);

        console.log(`Updated events_json for volunteer ${volunteer_id} with dependent ${newDep.name} (index ${familyIndex})`);

        // Also sync to event_dependents table if registration_events exist
        try {
          const { data: regEvents } = await supabase
            .from('registration_events')
            .select('id')
            .eq('registration_id', volunteer_id)
            .limit(1);

          if (regEvents && regEvents.length > 0) {
            await supabase
              .from('event_dependents')
              .insert({
                registration_event_id: regEvents[0].id,
                name: newDep.name,
                dependent_type: newDep.type,
                gender: newDep.gender,
                dependent_index: familyIndex,
              });
            console.log(`Synced dependent ${newDep.name} to event_dependents table`);
          }
        } catch (depSyncError) {
          console.error('Non-fatal: failed to sync to event_dependents:', depSyncError);
        }
      } catch (ejError) {
        console.error('Non-fatal: failed to update events_json:', ejError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Family member QR card created',
          qr_card_id: familyQrCardId,
          family_member_name: family_member.name,
          family_member_type: family_member.type || 'adult'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for resend_email action
    if (payload.action === 'resend_email') {
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
      
      const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();
      if (authError || !authUser) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid authentication' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check admin role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authUser.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!roleData) {
        return new Response(
          JSON.stringify({ success: false, error: 'Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { pending_id } = payload;
      if (!pending_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'pending_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch approved volunteer with temp password
      const { data: volunteer, error: fetchError } = await supabase
        .from('pending_volunteers')
        .select('*')
        .eq('id', pending_id)
        .eq('status', 'approved')
        .single();

      if (fetchError || !volunteer) {
        return new Response(
          JSON.stringify({ success: false, error: 'Approved volunteer not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tempPasswordDisplay = volunteer.temp_password || 'Please use "Forgot Password" to reset';

      // Fetch volunteer's QR cards
      const { data: qrCards } = await supabase
        .from('volunteer_qr_cards')
        .select('unique_id')
        .eq('volunteer_id', pending_id)
        .order('created_at', { ascending: true });

      const allQrIds = qrCards?.map(c => c.unique_id) || [];
      const volunteerQrId = allQrIds[0] || 'N/A';
      
      // Build family QR list - include ALL family QR cards regardless of dependents count
      const familyQRs: FamilyMemberQR[] = [];
      const dependents = extractUniqueDependents(volunteer.events_json);
      
      // Family cards are all QR cards after the first (primary) one
      for (let i = 1; i < allQrIds.length; i++) {
        const dep = dependents[i - 1]; // may be undefined if more cards than dependents
        familyQRs.push({
          name: dep?.name || `Family Member ${i}`,
          type: dep?.type || 'adult',
          gender: dep?.gender || null,
          qrCardId: allQrIds[i]
        });
      }

      // Resolve event context: events_json -> events_list -> marketplace assignments
      let resolvedEventsJson = volunteer.events_json;
      let resolvedMarketplaceId: string | null = null;
      let resolvedMarketplace: MarketplaceInfo | null = null;

      if (!resolvedEventsJson || !Array.isArray(resolvedEventsJson) || resolvedEventsJson.length === 0) {
        console.log('events_json missing for resend, trying fallback resolution...');
        
        // Fallback 1: Try events_list to find marketplace details
        if (volunteer.events_list) {
          const slugs = volunteer.events_list.split(',').map((s: string) => s.trim()).filter(Boolean);
          if (slugs.length > 0) {
            const marketplaceMap = await getMarketplacesBySlug(supabase, slugs);
            if (marketplaceMap.size > 0) {
              // Build synthetic events_json from resolved marketplaces
              const syntheticEvents: RegisteredEvent[] = [];
              for (const [slug, mp] of marketplaceMap.entries()) {
                syntheticEvents.push({
                  event: slug,
                  eventDate: mp.event_date ? formatDate(mp.event_date) : undefined,
                  eventTime: mp.start_time && mp.end_time 
                    ? `${formatTime(mp.start_time)} - ${formatTime(mp.end_time)}` : undefined,
                  eventLocation: mp.location || undefined,
                });
              }
              resolvedEventsJson = syntheticEvents;
              console.log(`Resolved ${syntheticEvents.length} events from events_list`);
            }
          }
        }
        
        // Fallback 2: Use marketplace IDs from volunteer QR card assignments
        if (!resolvedEventsJson || !Array.isArray(resolvedEventsJson) || resolvedEventsJson.length === 0) {
          const { data: qrCardsWithMp } = await supabase
            .from('volunteer_qr_cards')
            .select('marketplace_id')
            .eq('volunteer_id', pending_id)
            .not('marketplace_id', 'is', null);
          
          const uniqueMpIds = [...new Set((qrCardsWithMp || []).map(c => c.marketplace_id).filter(Boolean))];
          
          if (uniqueMpIds.length > 0) {
            resolvedMarketplaceId = uniqueMpIds[0];
            const syntheticEvents: RegisteredEvent[] = [];
            
            for (const mpId of uniqueMpIds) {
              const mpInfo = await getMarketplaceInfo(supabase, mpId);
              if (mpInfo) {
                if (!resolvedMarketplace) resolvedMarketplace = mpInfo;
                syntheticEvents.push({
                  event: mpInfo.name.toLowerCase().replace(/\s+/g, '-'),
                  eventDate: mpInfo.event_date ? formatDate(mpInfo.event_date) : undefined,
                  eventTime: mpInfo.start_time && mpInfo.end_time 
                    ? `${formatTime(mpInfo.start_time)} - ${formatTime(mpInfo.end_time)}` : undefined,
                  eventLocation: mpInfo.location || undefined,
                });
              }
            }
            
            if (syntheticEvents.length > 0) {
              resolvedEventsJson = syntheticEvents;
              console.log(`Resolved ${syntheticEvents.length} events from QR card marketplace assignments`);
            }
          }
        }
      }

      // Log resend event context for debugging
      console.log(`Resend: volunteer ${pending_id} has ${resolvedEventsJson && Array.isArray(resolvedEventsJson) ? resolvedEventsJson.length : 0} events in resolved events_json`);

      // Send welcome email with QR codes
      const appUrl = 'https://gif.thesurpluss.com';
      const loginUrl = `${appUrl}/auth`;
      const trainingUrl = `${appUrl}/training`;
      
      const emailResult = await sendWelcomeEmailWithQR(
        supabase,
        volunteer.email,
        volunteer.first_name,
        volunteer.last_name || '',
        tempPasswordDisplay,
        loginUrl,
        trainingUrl,
        volunteerQrId,
        pending_id,
        familyQRs,
        undefined, // customization
        resolvedMarketplace, // marketplace info (from fallback)
        resolvedMarketplaceId, // marketplaceId (from fallback)
        resolvedEventsJson // Pass resolved events data
      );

      // Update email tracking fields
      const newSendCount = (volunteer.email_send_count || 0) + 1;
      await supabase
        .from('pending_volunteers')
        .update({
          email_sent: emailResult.success,
          email_sent_at: emailResult.success ? new Date().toISOString() : volunteer.email_sent_at,
          email_send_count: newSendCount
        })
        .eq('id', pending_id);

      console.log(`Resent welcome email to ${volunteer.email} (attempt ${newSendCount})`);

      return new Response(
        JSON.stringify({
          success: emailResult.success,
          message: emailResult.success ? 'Welcome email resent successfully' : 'Failed to resend email',
          email: volunteer.email,
          email_send_count: newSendCount,
          error: emailResult.error || null
        }),
        // Always return 200 so the frontend can show the provider error message instead of treating it as a transport failure.
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for bulk_resend_emails action
    if (payload.action === 'bulk_resend_emails') {
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
      
      const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();
      if (authError || !authUser) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid authentication' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check admin role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authUser.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!roleData) {
        return new Response(
          JSON.stringify({ success: false, error: 'Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { pending_ids } = payload;
      if (!pending_ids || !Array.isArray(pending_ids) || pending_ids.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'pending_ids array is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch approved volunteers with temp passwords
      const { data: volunteers, error: fetchError } = await supabase
        .from('pending_volunteers')
        .select('*')
        .in('id', pending_ids)
        .eq('status', 'approved')
        .not('temp_password', 'is', null);

      if (fetchError) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to fetch volunteers' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!volunteers || volunteers.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'No valid approved volunteers found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const loginUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app') || 'https://surpluss.lovable.app';
      
      const results: { email: string; success: boolean; error?: string }[] = [];

      // Send emails to all selected volunteers
      for (const volunteer of volunteers) {
        const emailResult = await sendWelcomeEmail(
          supabase,
          volunteer.email,
          volunteer.first_name,
          volunteer.last_name || '',
          volunteer.temp_password!,
          loginUrl,
          volunteer.id
        );

        // Update email tracking fields
        const newSendCount = (volunteer.email_send_count || 0) + 1;
        await supabase
          .from('pending_volunteers')
          .update({
            email_sent: emailResult.success,
            email_sent_at: emailResult.success ? new Date().toISOString() : volunteer.email_sent_at,
            email_send_count: newSendCount,
            email_opened: false, // Reset opened status for new email
            email_opened_at: null
          })
          .eq('id', volunteer.id);

        results.push({
          email: volunteer.email,
          success: emailResult.success,
          error: emailResult.error
        });
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      console.log(`Bulk email sent: ${successCount} success, ${failCount} failed`);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Sent ${successCount} emails, ${failCount} failed`,
          total: results.length,
          success_count: successCount,
          fail_count: failCount,
          results
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default response for other webhook types
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook received successfully',
        received_at: new Date().toISOString()
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error: unknown) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
