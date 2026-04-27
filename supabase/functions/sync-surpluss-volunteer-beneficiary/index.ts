import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Normalize a slug like "event-7---cda" to fuzzy-matchable form */
const normalizeSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Paginated range fetcher to bypass PostgREST's default 1000-row cap.
 * Pass a thunk that returns a fresh query builder so .range() can be applied per page.
 */
async function fetchAllRows<T = any>(
  buildQuery: () => any,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (let i = 0; i < 1000; i++) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    if (rows.length === 0) break;
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

/** Build a map of normalized slug fragments -> marketplace name */
function buildEventSlugMap(marketplaces: { name: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const mp of marketplaces) {
    const norm = normalizeSlug(mp.name);
    map.set(norm, mp.name);
  }
  return map;
}

/** Resolve comma-separated event slugs to semicolon-separated human-readable names */
function resolveEventSlugs(eventsList: string | null, slugMap: Map<string, string>): string | undefined {
  if (!eventsList) return undefined;
  const slugs = eventsList
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const resolvedNames: string[] = [];

  for (const slug of slugs) {
    const normSlug = normalizeSlug(slug);
    let matched = false;
    for (const [normName, displayName] of slugMap) {
      // Check if either contains the other (fuzzy match)
      if (normName.includes(normSlug) || normSlug.includes(normName)) {
        resolvedNames.push(displayName);
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Fallback: use the slug itself, cleaned up
      const fallback = slug.replace(/---/g, " - ").replace(/-/g, " ").replace(/\s+/g, " ").trim();
      resolvedNames.push(fallback);
    }
  }

  return resolvedNames.length > 0 ? resolvedNames.join(";") : undefined;
}

/** Extract dependents from events_json for a given marketplace (by normalized name) */
function extractDependentsForMarketplace(
  eventsJson: any[] | null,
  marketplaceName: string,
): Array<{ name: string; type: string; gender?: string; index?: string | number }> {
  if (!eventsJson || !Array.isArray(eventsJson)) return [];
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const targetNorm = norm(marketplaceName);
  const deps: Array<{ name: string; type: string; gender?: string; index?: string | number }> = [];
  // Dedup by name+type+index+gender so siblings with the same first name aren't dropped,
  // but the same dependent listed twice in the same event isn't duplicated.
  const seenKeys = new Set<string>();

  for (const evt of eventsJson) {
    const eventSlug = evt["event-slug"] || evt.event_slug || evt["event"] || evt.event || "";
    const eventNorm = norm(eventSlug);
    if (!eventNorm) continue;

    // Stricter match: require a meaningful overlap. A short event slug must not
    // match a long marketplace name just because of a 3-char shared prefix.
    // We require either:
    //  - exact equality, or
    //  - one fully contains the other AND the shorter is at least 12 chars.
    const a = eventNorm;
    const b = targetNorm;
    const shorter = a.length <= b.length ? a : b;
    const longer = a.length > b.length ? a : b;
    const matches = a === b || (longer.includes(shorter) && shorter.length >= 12);
    if (!matches) continue;

    const dependents = evt.dependents || [];
    if (!Array.isArray(dependents)) continue;
    for (const d of dependents) {
      const dName = (d.name || "").trim();
      if (!dName) continue;
      const key = [
        dName.toLowerCase(),
        (d.type || "adult").toLowerCase(),
        String(d.index ?? ""),
        (d.gender || "").toLowerCase(),
      ].join("|");
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      deps.push({
        name: dName,
        type: d.type || "adult",
        gender: d.gender || undefined,
        index: d.index,
      });
    }
  }
  return deps;
}

/** Count total dependents across all events for a volunteer */
function countAllDependents(eventsJson: any[] | null): number {
  if (!eventsJson || !Array.isArray(eventsJson)) return 0;
  let total = 0;
  for (const evt of eventsJson) {
    total += Number(evt["number-of-adults"] || evt.number_of_adults || 0);
    total += Number(evt["number-of-children"] || evt.number_of_children || 0);
  }
  return total;
}

/** Build the enriched volunteer payload for the Surpluss API */
function buildVolunteerPayload(
  vol: any,
  slugMap: Map<string, string>,
  linkedMarketplaceEventId?: number | null,
): Record<string, any> {
  const name = `${vol.first_name || ""} ${vol.last_name || ""}`.trim();
  const payload: Record<string, any> = { name };

  if (vol.email) payload.email = vol.email;
  if (vol.phone_number) payload.phone = vol.phone_number;

  // Gender mapping
  if (vol.gender) {
    const g = vol.gender.toLowerCase();
    if (g === "male" || g === "female") {
      payload.gender = g.toUpperCase();
    }
  }

  // Employment mapping
  if (vol.is_employee != null) {
    payload.employed = vol.is_employee ? "YES" : "NO";
  }

  // Company name
  const company = vol.external_company || vol.employee_vertical;
  if (company) payload.company_name = company;

  // Events registered
  const events = resolveEventSlugs(vol.events_list, slugMap);
  if (events) payload.events_registered = events;

  // Volunteer QR card status (checked_in, checked_out, inactive)
  if (vol._card_status) {
    const statusMap: Record<string, string> = {
      checked_in: "CHECKED_IN",
      checked_out: "CHECKED_OUT",
      inactive: "INACTIVE",
    };
    payload.status = statusMap[vol._card_status] || vol._card_status.toUpperCase();
  }

  // Number of dependents (family members)
  const depCount = countAllDependents(vol.events_json);
  if (depCount > 0) {
    payload.number_of_dependents = depCount;
  }

  if (linkedMarketplaceEventId != null) {
    payload.marketplace_event_id = linkedMarketplaceEventId;
    payload.event_id = linkedMarketplaceEventId;
  }

  // Sustainability training completion
  if (vol.training_completed === true) {
    payload.training_completed = true;
    payload.sustainability_module_completed = true;
    if (vol.training_completed_at) {
      payload.training_completed_at = vol.training_completed_at;
      payload.sustainability_module_completed_at = vol.training_completed_at;
    }
  }

  return payload;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { marketplace_id, marketplace_ids, environment } = await req.json();

    if (!environment) {
      return new Response(JSON.stringify({ error: "environment is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl =
      environment === "production" ? "https://api.thesurpluss.com" : "https://surpluss-server.herokuapp.com";

    const apiHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const apiKey = Deno.env.get("SURPLUSS_API_KEY");
    if (apiKey) {
      apiHeaders["Authorization"] = `Bearer ${apiKey}`;
      apiHeaders["x-api-key"] = apiKey;
    }

    const allErrors: string[] = [];
    let totalSent = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let totalBulkUpdated = 0;
    // Aggregate family-member counters across all marketplaces processed in this call
    let totalFamilyFound = 0;
    let totalFamilySent = 0;
    let totalFamilySkipped = 0;
    let totalFamilyFailed = 0;
    const allVolunteerDetails: {
      name: string;
      status: "sent" | "skipped" | "failed" | "bulk_updated";
      reason?: string;
    }[] = [];

    // Beneficiary tracking (demographics)
    let demographicsSent = 0;
    let demographicsFailed = 0;
    const demographicsDetails: {
      marketplace_id: string;
      marketplace_name: string;
      status: "sent" | "failed" | "skipped";
      reason?: string;
      surpluss_event_id?: number;
    }[] = [];

    /** GIF volunteer QR → Surpluss marketplace_event_volunteers.hours_contributed */
    let volunteerHoursRowCount = 0;
    let volunteerHoursSync: Record<string, unknown> | null = null;

    // 1. Fetch marketplace events for slug resolution
    const { data: marketplaceEvents } = await supabase.from("marketplace_events").select("id, name, external_id");
    const slugMap = buildEventSlugMap(marketplaceEvents || []);
    console.log(`Built slug map with ${slugMap.size} marketplace events`);

    // 1b. Determine marketplace IDs early so we can filter volunteers
    let marketplaceIdsToProcess: string[] = [];
    if (marketplace_ids && Array.isArray(marketplace_ids) && marketplace_ids.length > 0) {
      marketplaceIdsToProcess = marketplace_ids;
    } else if (marketplace_id) {
      marketplaceIdsToProcess = [marketplace_id];
    }

    // 1c. Resolve marketplace names for filtering volunteers by events_list
    const marketplaceNamesForFilter: string[] = [];
    if (marketplaceIdsToProcess.length > 0) {
      for (const mpId of marketplaceIdsToProcess) {
        const mp = (marketplaceEvents || []).find((m: any) => m.id === mpId);
        if (mp) marketplaceNamesForFilter.push(mp.name);
      }
      console.log(`Will filter volunteers for marketplaces: ${marketplaceNamesForFilter.join(", ")}`);
    }

    const singleMarketplaceForSync =
      marketplaceIdsToProcess.length === 1
        ? (marketplaceEvents || []).find((m: any) => m.id === marketplaceIdsToProcess[0])
        : null;
    const linkedMarketplaceEventId = singleMarketplaceForSync?.external_id != null
      ? Number(singleMarketplaceForSync.external_id)
      : null;

    // 2. Fetch all previously synced emails for deduplication
    const { data: previousSyncs } = await supabase
      .from("surpluss_api_audit_log")
      .select("request_payload")
      .eq("action", "sync_volunteer")
      .eq("success", true);

    const alreadySyncedEmails = new Set<string>();
    if (previousSyncs) {
      for (const log of previousSyncs) {
        const payload = log.request_payload as any;
        if (payload?.email) {
          alreadySyncedEmails.add(payload.email.toLowerCase());
        }
      }
    }
    console.log(`Found ${alreadySyncedEmails.size} previously synced emails`);

    // 3. Fetch ALL volunteers (paginated to bypass PostgREST 1000-row default cap)
    let allVolunteers: any[] = [];
    try {
      allVolunteers = await fetchAllRows(() =>
        supabase
          .from("pending_volunteers")
          .select(
            "id, first_name, last_name, email, phone_number, is_employee, external_company, gender, events_list, employee_vertical, events_json, training_completed, training_completed_at",
          ),
      );
    } catch (volError: any) {
      throw new Error(`Failed to fetch volunteers: ${volError?.message ?? volError}`);
    }
    console.log(`Fetched ${allVolunteers.length} total volunteers (paginated)`);

    // Fetch volunteer QR card statuses to enrich volunteer data (paginated)
    const allVolCards = await fetchAllRows(() =>
      supabase
        .from("volunteer_qr_cards")
        .select("volunteer_id, status, marketplace_id")
        .not("volunteer_id", "is", null),
    );
    console.log(`Fetched ${allVolCards.length} total volunteer QR cards (paginated)`);

    const cardStatusByVolunteerId = new Map<string, string>();
    // When marketplace filtering, use marketplace-specific card status
    const cardStatusByVolunteerForMarketplace = new Map<string, string>();
    if (allVolCards) {
      for (const vc of allVolCards) {
        const vid = vc.volunteer_id as string;
        const st = vc.status as string;
        // Global: Prioritize checked_out > checked_in > inactive
        const existing = cardStatusByVolunteerId.get(vid);
        if (!existing || st === "checked_out" || (st === "checked_in" && existing === "inactive")) {
          cardStatusByVolunteerId.set(vid, st);
        }
        // Marketplace-specific status
        if (marketplaceIdsToProcess.length > 0 && marketplaceIdsToProcess.includes(vc.marketplace_id as string)) {
          const existingMp = cardStatusByVolunteerForMarketplace.get(vid);
          if (!existingMp || st === "checked_out" || (st === "checked_in" && existingMp === "inactive")) {
            cardStatusByVolunteerForMarketplace.set(vid, st);
          }
        }
      }
    }
    console.log(`Mapped ${cardStatusByVolunteerId.size} volunteer card statuses`);

    // Use marketplace-specific card status when filtering by marketplace
    const statusMap = marketplaceIdsToProcess.length > 0 ? cardStatusByVolunteerForMarketplace : cardStatusByVolunteerId;

    let allEnrichedVolunteers = (allVolunteers || []).map((v: any) => ({
      ...v,
      _card_status: statusMap.get(v.id) || cardStatusByVolunteerId.get(v.id) || "inactive",
    }));

    // 3b. Filter volunteers by marketplace events_list when marketplace IDs are provided
    if (marketplaceNamesForFilter.length > 0) {
      const normalizedMarketplaceNames = marketplaceNamesForFilter.map((n) => normalizeSlug(n));
      const beforeCount = allEnrichedVolunteers.length;

      allEnrichedVolunteers = allEnrichedVolunteers.filter((v: any) => {
        if (!v.events_list) return false;
        const slugs = v.events_list.split(",").map((s: string) => normalizeSlug(s.trim()));
        return slugs.some((slug: string) =>
          normalizedMarketplaceNames.some(
            (mpName) => mpName.includes(slug) || slug.includes(mpName),
          ),
        );
      });
      console.log(`Filtered volunteers: ${beforeCount} → ${allEnrichedVolunteers.length} (for ${marketplaceNamesForFilter.join(", ")})`);
    }

    const volunteers = allEnrichedVolunteers;
    console.log(`Processing ${volunteers.length} volunteers`);

    // 4. Separate new vs already-synced volunteers
    const newVolunteers: any[] = [];
    const previouslySyncedVolunteers: any[] = [];

    for (const vol of volunteers) {
      const volunteerName = `${vol.first_name || ""} ${vol.last_name || ""}`.trim();
      if (!volunteerName) {
        totalFailed++;
        allVolunteerDetails.push({ name: vol.email || "Unknown", status: "failed", reason: "No name" });
        continue;
      }
      if (vol.email && alreadySyncedEmails.has(vol.email.toLowerCase())) {
        previouslySyncedVolunteers.push(vol);
      } else {
        newVolunteers.push(vol);
      }
    }

    // 5. Create new volunteers with enriched payload
    for (const vol of newVolunteers) {
      const volunteerName = `${vol.first_name || ""} ${vol.last_name || ""}`.trim();
      const volunteerPayload = buildVolunteerPayload(vol, slugMap, linkedMarketplaceEventId);

      try {
        const apiUrl = `${baseUrl}/api/common/volunteers`;
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: apiHeaders,
          body: JSON.stringify(volunteerPayload),
        });

        const responseBody = await response.text();
        let responseJson: any;
        try {
          responseJson = JSON.parse(responseBody);
        } catch {
          responseJson = responseBody.includes("<!DOCTYPE")
            ? { raw: "HTML response" }
            : { raw: responseBody.substring(0, 500) };
        }

        await supabase.from("surpluss_api_audit_log").insert({
          action: "sync_volunteer",
          environment,
          request_payload: volunteerPayload,
          response_status: response.status,
          response_body: responseJson,
          success: response.ok,
        });

        if (response.ok) {
          totalSent++;
          allVolunteerDetails.push({ name: volunteerName, status: "sent" });
        } else if (responseBody.includes("already exists") || responseBody.includes("already assigned")) {
          totalSkipped++;
          allVolunteerDetails.push({ name: volunteerName, status: "skipped", reason: "Already exists in Surpluss" });
          // Find and update the most recent failed log entry for this volunteer
          const { data: recentLogs } = await supabase
            .from("surpluss_api_audit_log")
            .select("id")
            .eq("action", "sync_volunteer")
            .eq("success", false)
            .order("created_at", { ascending: false })
            .limit(1);
          if (recentLogs && recentLogs.length > 0) {
            await supabase.from("surpluss_api_audit_log").update({ success: true }).eq("id", recentLogs[0].id);
          }
        } else {
          totalFailed++;
          const reason = `${response.status} - ${responseBody.substring(0, 200)}`;
          allVolunteerDetails.push({ name: volunteerName, status: "failed", reason });
        }
      } catch (err) {
        totalFailed++;
        allVolunteerDetails.push({
          name: volunteerName,
          status: "failed",
          reason: err instanceof Error ? err.message : "Unknown",
        });
      }
    }

    // 6. Bulk-update previously synced volunteers with enriched data
    if (previouslySyncedVolunteers.length > 0) {
      const bulkPayload = previouslySyncedVolunteers
        .filter((vol) => vol.email)
        .map((vol) => {
          const enriched = buildVolunteerPayload(vol, slugMap, linkedMarketplaceEventId);
          // bulk-update uses email as identifier, keep only updatable fields
          return {
            email: vol.email,
            ...(linkedMarketplaceEventId != null && {
              marketplace_event_id: linkedMarketplaceEventId,
              event_id: linkedMarketplaceEventId,
            }),
            ...(enriched.gender && { gender: enriched.gender }),
            ...(enriched.employed && { employed: enriched.employed }),
            ...(enriched.company_name && { company_name: enriched.company_name }),
            ...(enriched.events_registered && { events_registered: enriched.events_registered }),
            ...(enriched.status && { status: enriched.status }),
            ...(enriched.training_completed && {
              training_completed: enriched.training_completed,
              sustainability_module_completed: enriched.sustainability_module_completed,
            }),
            ...(enriched.training_completed_at && {
              training_completed_at: enriched.training_completed_at,
              sustainability_module_completed_at: enriched.sustainability_module_completed_at,
            }),
          };
        });

      if (bulkPayload.length > 0) {
        try {
          const bulkUrl = `${baseUrl}/api/common/volunteers/bulk-update`;
          console.log(`Sending bulk-update for ${bulkPayload.length} previously synced volunteers`);

          const response = await fetch(bulkUrl, {
            method: "POST",
            headers: apiHeaders,
            body: JSON.stringify({ volunteers: bulkPayload }),
          });

          const responseBody = await response.text();
          let responseJson: any;
          try {
            responseJson = JSON.parse(responseBody);
          } catch {
            responseJson = { raw: responseBody.substring(0, 500) };
          }

          await supabase.from("surpluss_api_audit_log").insert({
            action: "bulk_update_volunteers",
            environment,
            request_payload: { count: bulkPayload.length, sample: bulkPayload.slice(0, 3) },
            response_status: response.status,
            response_body: responseJson,
            success: response.ok,
          });

          if (response.ok) {
            totalBulkUpdated = bulkPayload.length;
            for (const vol of previouslySyncedVolunteers) {
              const name = `${vol.first_name || ""} ${vol.last_name || ""}`.trim();
              allVolunteerDetails.push({ name, status: "bulk_updated" });
            }
          } else {
            allErrors.push(`Bulk-update failed: ${response.status} - ${responseBody.substring(0, 200)}`);
            for (const vol of previouslySyncedVolunteers) {
              const name = `${vol.first_name || ""} ${vol.last_name || ""}`.trim();
              allVolunteerDetails.push({ name, status: "skipped", reason: "Bulk-update failed" });
            }
            totalSkipped += previouslySyncedVolunteers.length;
          }
        } catch (err) {
          allErrors.push(`Bulk-update error: ${err instanceof Error ? err.message : "Unknown"}`);
          totalSkipped += previouslySyncedVolunteers.length;
        }
      }
    }

    // 7. Demographics update (optional, only if marketplace IDs provided)
    // marketplaceIdsToProcess was already determined in step 1b

    if (marketplaceIdsToProcess.length > 0) {
      const volunteerHourRows: {
        volunteer_email: string;
        marketplace_event_title: string;
        hours_contributed: number;
      }[] = [];
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const surplussEventsMap = new Map<string, number>();

      try {
        const lookupUrl = `${baseUrl}/api/common/marketplace-events`;
        console.log(`\n🔍 Looking up Surpluss events from: ${lookupUrl}`);
        const lookupResp = await fetch(lookupUrl, { headers: apiHeaders });
        const lookupBody = await lookupResp.text();

        if (lookupResp.ok) {
          let parsed: any;
          try {
            parsed = JSON.parse(lookupBody);
          } catch {
            parsed = null;
          }

          console.log(`📦 Raw response structure:`, {
            isArray: Array.isArray(parsed),
            keys: parsed && typeof parsed === "object" ? Object.keys(parsed) : "N/A",
            sample: parsed && typeof parsed === "object" ? JSON.stringify(parsed).substring(0, 200) : parsed,
          });

          const items = Array.isArray(parsed)
            ? parsed
            : parsed?.items || parsed?.data || parsed?.results || parsed?.events || [];
          if (Array.isArray(items)) {
            console.log(`✅ Found ${items.length} Surpluss events`);
            for (const item of items) {
              const name = normalize(item.title || item.name || "");
              const eventId = item.id;
              if (name && eventId) {
                surplussEventsMap.set(name, eventId);
                console.log(`   Mapped: "${item.title || item.name}" (normalized: "${name}") -> ID: ${eventId}`);
              } else {
                console.log(`   ⚠️  Skipped item (missing name or id):`, {
                  name: item.title || item.name,
                  id: item.id,
                });
              }
            }
            console.log(`📋 Surpluss Events Map size: ${surplussEventsMap.size}`);
            console.log(`📋 First 5 entries:`, Array.from(surplussEventsMap.entries()).slice(0, 5));
          } else {
            console.log(`⚠️  No events array found in response`);
            console.log(`   Response type:`, typeof parsed);
            console.log(`   Response keys:`, parsed && typeof parsed === "object" ? Object.keys(parsed) : "N/A");
          }
        } else {
          console.log(`❌ Failed to fetch Surpluss events: ${lookupResp.status}`);
          console.log(`   Response body:`, lookupBody.substring(0, 500));
        }
      } catch (err) {
        console.log(`❌ Surpluss events lookup error:`, err);
        allErrors.push(`Surpluss events lookup error: ${err instanceof Error ? err.message : "Unknown"}`);
      }

      for (const mpId of marketplaceIdsToProcess) {
        console.log(`\n=== Processing Marketplace ID: ${mpId} ===`);
        const { data: marketplace } = await supabase.from("marketplace_events").select("*").eq("id", mpId).single();

        if (!marketplace) {
          console.log(`❌ Marketplace not found for ID: ${mpId}`);
          demographicsFailed++;
          demographicsDetails.push({
            marketplace_id: mpId,
            marketplace_name: "Unknown",
            status: "failed",
            reason: "Marketplace not found",
          });
          continue;
        }

        console.log(`✅ Marketplace found: ${marketplace.name}`);

        // Resolve Surpluss marketplace event ID first (same logic as demographics) — hours sync uses this id so titles need not match exactly.
        let surplussEventId: number | null = marketplace.external_id != null
          ? Number(marketplace.external_id)
          : null;
        if (surplussEventId == null) {
          const targetName = normalize(marketplace.name);
          if (surplussEventsMap.has(targetName)) {
            surplussEventId = surplussEventsMap.get(targetName)!;
          } else {
            for (const [eventName, eventId] of surplussEventsMap) {
              if (eventName.includes(targetName) || targetName.includes(eventName)) {
                surplussEventId = eventId;
                break;
              }
            }
          }
        }

        // --- Volunteer hours from QR cards (+ attendance fallback if total_hours_worked is still 0) ---
        try {
          const { data: vCards } = await supabase
            .from("volunteer_qr_cards")
            .select("id, volunteer_id, total_hours_worked")
            .eq("marketplace_id", mpId)
            .not("volunteer_id", "is", null);

          if (vCards && vCards.length > 0) {
            const cardIds = vCards.map((c) => c.id as string).filter(Boolean);
            const { data: attRows } = await supabase
              .from("volunteer_attendance")
              .select("volunteer_card_id, hours_worked")
              .in("volunteer_card_id", cardIds)
              .eq("marketplace_id", mpId);

            const sumHoursByCard = new Map<string, number>();
            for (const a of attRows || []) {
              const cid = a.volunteer_card_id as string;
              const hw = Number(a.hours_worked) || 0;
              sumHoursByCard.set(cid, (sumHoursByCard.get(cid) || 0) + hw);
            }

            const volIds = [...new Set(vCards.map((c) => c.volunteer_id).filter(Boolean))] as string[];
            const { data: pvs } = await supabase.from("pending_volunteers").select("id, email").in("id", volIds);
            const emailById = new Map((pvs || []).map((p) => [p.id as string, String(p.email || "").trim()]));
            const hoursByEmail = new Map<string, { email: string; hours: number }>();
            for (const c of vCards) {
              const vid = c.volunteer_id as string;
              const em = emailById.get(vid);
              if (!em) continue;
              const fromAtt = sumHoursByCard.get(c.id as string) || 0;
              const fromCard = Number(c.total_hours_worked) || 0;
              const h = fromAtt > 0 ? fromAtt : fromCard;
              const key = em.toLowerCase();
              const prev = hoursByEmail.get(key);
              if (prev) prev.hours += h;
              else hoursByEmail.set(key, { email: em, hours: h });
            }
            const eventTitle = marketplace.name as string;
            for (const { email, hours } of hoursByEmail.values()) {
              if (hours <= 0) continue;
              const row: {
                volunteer_email: string;
                marketplace_event_title: string;
                hours_contributed: number;
                marketplace_event_id?: number;
              } = {
                volunteer_email: email,
                marketplace_event_title: eventTitle,
                hours_contributed: Math.round(hours * 100) / 100,
              };
              if (surplussEventId != null) {
                row.marketplace_event_id = surplussEventId;
              }
              volunteerHourRows.push(row);
            }
          }
        } catch (hoursCollectErr) {
          console.error("Volunteer hours collection error:", hoursCollectErr);
          allErrors.push(
            `Volunteer hours collection: ${hoursCollectErr instanceof Error ? hoursCollectErr.message : "Unknown"}`,
          );
        }

        // --- Demographics Update ---

        if (surplussEventId) {
          const demographicsPayload: Record<string, any> = {};
          if (marketplace.demographics_total_families != null)
            demographicsPayload.total_families = marketplace.demographics_total_families;
          if (marketplace.demographics_total_adults != null)
            demographicsPayload.total_adults = marketplace.demographics_total_adults;
          if (marketplace.demographics_total_children != null)
            demographicsPayload.total_children = marketplace.demographics_total_children;
          if (marketplace.demographics_male_adults != null)
            demographicsPayload.male_adults = marketplace.demographics_male_adults;
          if (marketplace.demographics_female_adults != null)
            demographicsPayload.female_adults = marketplace.demographics_female_adults;
          if (marketplace.demographics_male_children != null)
            demographicsPayload.male_children = marketplace.demographics_male_children;
          if (marketplace.demographics_female_children != null)
            demographicsPayload.female_children = marketplace.demographics_female_children;

          if (Object.keys(demographicsPayload).length === 0) {
            demographicsDetails.push({
              marketplace_id: mpId,
              marketplace_name: marketplace.name,
              status: "skipped",
              reason: "No demographics data",
              surpluss_event_id: surplussEventId,
            });
          } else {
            try {
              const updateUrl = `${baseUrl}/api/common/marketplace-events/${surplussEventId}`;
              const response = await fetch(updateUrl, {
                method: "PUT",
                headers: apiHeaders,
                body: JSON.stringify(demographicsPayload),
              });
              const responseBody = await response.text();
              let responseJson: any;
              try {
                responseJson = JSON.parse(responseBody);
              } catch {
                responseJson = { raw: responseBody.substring(0, 500) };
              }

              await supabase.from("surpluss_api_audit_log").insert({
                action: "sync_beneficiary_demographics",
                environment,
                request_payload: demographicsPayload,
                response_status: response.status,
                response_body: responseJson,
                success: response.ok,
              });
              if (response.ok) {
                demographicsSent++;
                demographicsDetails.push({
                  marketplace_id: mpId,
                  marketplace_name: marketplace.name,
                  status: "sent",
                  surpluss_event_id: surplussEventId,
                });
              } else {
                demographicsFailed++;
                demographicsDetails.push({
                  marketplace_id: mpId,
                  marketplace_name: marketplace.name,
                  status: "failed",
                  reason: `${response.status}`,
                  surpluss_event_id: surplussEventId,
                });
              }
            } catch (err) {
              demographicsFailed++;
              demographicsDetails.push({
                marketplace_id: mpId,
                marketplace_name: marketplace.name,
                status: "failed",
                reason: err instanceof Error ? err.message : "Unknown",
              });
            }
          }
        } else {
          allErrors.push(`No matching Surpluss Event ID for "${marketplace.name}"`);
          demographicsFailed++;
          demographicsDetails.push({
            marketplace_id: mpId,
            marketplace_name: marketplace.name,
            status: "failed",
            reason: "No matching Surpluss event",
          });
        }

        // Note: Individual beneficiary card sync is now handled by the dedicated sync-surpluss-beneficiaries function

        // --- Family Members (Dependents) Sync ---
        // Extract dependents from events_json for this marketplace and send as separate volunteer entries
        try {
          const marketplaceNameForDeps = marketplace.name as string;
          let familySent = 0;
          let familySkipped = 0;
          let familyFailed = 0;
          let familyTotalFound = 0;

          for (const vol of volunteers) {
            const deps = extractDependentsForMarketplace(vol.events_json, marketplaceNameForDeps);
            if (deps.length === 0) continue;
            familyTotalFound += deps.length;

            const volunteerName = `${vol.first_name || ""} ${vol.last_name || ""}`.trim();

            for (const dep of deps) {
              const depPayload: Record<string, any> = {
                name: `${dep.name} (Family)`,
                type: "family_member",
                parent_volunteer_email: vol.email,
                parent_volunteer_name: volunteerName,
              };

              if (dep.gender) {
                const g = dep.gender.toLowerCase();
                if (g === "male" || g === "female") {
                  depPayload.gender = g.toUpperCase();
                }
              }

              if (dep.type === "children" || dep.type === "child") {
                depPayload.age_group = "CHILD";
              } else {
                depPayload.age_group = "ADULT";
              }

              // Company from parent
              const company = vol.external_company || vol.employee_vertical;
              if (company) depPayload.company_name = company;

              if (surplussEventId != null) {
                depPayload.marketplace_event_id = surplussEventId;
                depPayload.event_id = surplussEventId;
              }

              try {
                const apiUrl = `${baseUrl}/api/common/volunteers`;
                const response = await fetch(apiUrl, {
                  method: "POST",
                  headers: apiHeaders,
                  body: JSON.stringify(depPayload),
                });

                const responseBody = await response.text();
                let responseJson: any;
                try {
                  responseJson = JSON.parse(responseBody);
                } catch {
                  responseJson = { raw: responseBody.substring(0, 500) };
                }

                await supabase.from("surpluss_api_audit_log").insert({
                  action: "sync_family_member",
                  environment,
                  request_payload: depPayload,
                  response_status: response.status,
                  response_body: responseJson,
                  success: response.ok,
                });

                if (response.ok) {
                  familySent++;
                  allVolunteerDetails.push({ name: `${dep.name} (family of ${volunteerName})`, status: "sent" });
                } else if (responseBody.includes("already exists") || responseBody.includes("already assigned")) {
                  familySkipped++;
                  allVolunteerDetails.push({ name: `${dep.name} (family of ${volunteerName})`, status: "skipped", reason: "Already exists" });
                } else {
                  familyFailed++;
                  allVolunteerDetails.push({ name: `${dep.name} (family of ${volunteerName})`, status: "failed", reason: `${response.status}` });
                }
              } catch (depErr) {
                familyFailed++;
                allVolunteerDetails.push({
                  name: `${dep.name} (family of ${volunteerName})`,
                  status: "failed",
                  reason: depErr instanceof Error ? depErr.message : "Unknown",
                });
              }
            }
          }

          totalSent += familySent;
          totalSkipped += familySkipped;
          totalFailed += familyFailed;
          console.log(`Family members for "${marketplaceNameForDeps}": found=${familyTotalFound}, sent=${familySent}, skipped=${familySkipped}, failed=${familyFailed}`);
        } catch (familyErr) {
          console.error("Family member sync error:", familyErr);
          allErrors.push(`Family member sync: ${familyErr instanceof Error ? familyErr.message : "Unknown"}`);
        }
      }

      volunteerHoursRowCount = volunteerHourRows.length;
      if (volunteerHourRows.length > 0) {
        try {
          const hoursUrl = `${baseUrl}/api/common/volunteers/sync-event-hours`;
          console.log(`Sending ${volunteerHourRows.length} volunteer hour row(s) to Surpluss`);
          const hoursResp = await fetch(hoursUrl, {
            method: "POST",
            headers: apiHeaders,
            body: JSON.stringify({ rows: volunteerHourRows }),
          });
          const hoursBody = await hoursResp.text();
          let hoursJson: any;
          try {
            hoursJson = JSON.parse(hoursBody);
          } catch {
            hoursJson = { raw: hoursBody.substring(0, 500) };
          }
          await supabase.from("surpluss_api_audit_log").insert({
            action: "sync_volunteer_event_hours",
            environment,
            request_payload: { row_count: volunteerHourRows.length, sample: volunteerHourRows.slice(0, 5) },
            response_status: hoursResp.status,
            response_body: hoursJson,
            success: hoursResp.ok,
          });
          if (hoursResp.ok) {
            volunteerHoursSync = (hoursJson?.data ?? hoursJson) as Record<string, unknown>;
          } else {
            allErrors.push(`Volunteer hours sync failed: ${hoursResp.status} - ${hoursBody.substring(0, 200)}`);
          }
        } catch (e) {
          allErrors.push(`Volunteer hours sync error: ${e instanceof Error ? e.message : "Unknown"}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: totalFailed === 0 && demographicsFailed === 0,
        volunteers_sent: totalSent,
        volunteers_failed: totalFailed,
        volunteers_skipped: totalSkipped,
        volunteers_bulk_updated: totalBulkUpdated,
        volunteers_total: volunteers.length,
        volunteer_details: allVolunteerDetails,
        demographics_sent: demographicsSent,
        demographics_failed: demographicsFailed,
        demographics_details: demographicsDetails,
        volunteer_hours_rows: volunteerHoursRowCount,
        volunteer_hours_sync: volunteerHoursSync,
        errors: allErrors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in sync-surpluss-volunteer-beneficiary:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
