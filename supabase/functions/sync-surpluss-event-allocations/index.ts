import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_URLS: Record<string, string> = {
  staging: "https://surpluss-server.herokuapp.com",
  production: "https://api.thesurpluss.com",
};

interface SyncRequest {
  marketplace_id: string;
  environment?: "staging" | "production";
}

interface AllocationStats {
  created: number;
  updated: number;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[-–—]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function namesMatch(localNorm: string, surplussNorm: string): boolean {
  if (localNorm === surplussNorm) return true;
  if (localNorm.includes(surplussNorm) || surplussNorm.includes(localNorm)) return true;

  const localWords = localNorm.split(" ").filter((w) => w.length > 2);
  const surplussWords = surplussNorm.split(" ").filter((w) => w.length > 2);
  if (localWords.length === 0 || surplussWords.length === 0) return false;

  const matchCount = localWords.filter((w) => surplussWords.includes(w)).length;
  const matchRatio = matchCount / Math.max(localWords.length, surplussWords.length);
  return matchRatio >= 0.7;
}

async function autoLinkMarketplaces(
  supabase: any,
  apiHeaders: Record<string, string>,
  baseUrl: string,
  _environment: string,
) {
  const linked: Array<{ local_name: string; external_id: number }> = [];
  const errors: string[] = [];

  try {
    let allSurplussEvents: unknown[] = [];
    let page = 1;
    const limit = 100;
    let hasMore = true;

    while (hasMore && page <= 5) {
      // status parametresi YOK: Surpluss validator "all" kabul etmiyor; verilmezse tüm durumlar gelir
      const url = `${baseUrl}/api/common/marketplace-events?page=${page}&limit=${limit}`;
      console.log(`[auto-link] Fetching Surpluss events page ${page}: ${url}`);

      const resp = await fetch(url, { headers: apiHeaders });
      if (!resp.ok) {
        const text = await resp.text();
        errors.push(`Failed to fetch Surpluss events page ${page}: ${resp.status} ${text.substring(0, 200)}`);
        break;
      }

      const body = (await resp.json()) as { data?: unknown[]; items?: unknown[] };
      const items = Array.isArray(body) ? body : (body.items ?? body.data ?? []);

      if (!Array.isArray(items) || items.length === 0) {
        hasMore = false;
      } else {
        allSurplussEvents.push(...items);
        hasMore = items.length === limit;
        page++;
      }
    }

    if (allSurplussEvents.length === 0) {
      console.log("[auto-link] No Surpluss events found");
      return { linked, errors };
    }

    console.log(`[auto-link] Found ${allSurplussEvents.length} Surpluss events`);

    const { data: unlinked, error: ulErr } = await supabase
      .from("marketplace_events")
      .select("id, name, external_id")
      .is("external_id", null);

    if (ulErr || !unlinked || unlinked.length === 0) {
      console.log("[auto-link] No unlinked local marketplaces");
      return { linked, errors: ulErr ? [...errors, ulErr.message] : errors };
    }

    console.log(`[auto-link] ${unlinked.length} unlinked local marketplaces to match`);

    const { data: alreadyLinked } = await supabase
      .from("marketplace_events")
      .select("external_id")
      .not("external_id", "is", null);

    const usedExternalIds = new Set((alreadyLinked ?? []).map((m: { external_id: number }) => m.external_id));

    for (const local of unlinked as Array<{ id: string; name: string; external_id: number | null }>) {
      const localNorm = normalizeName(local.name as string);

      for (const surp of allSurplussEvents as Array<Record<string, unknown>>) {
        const surpId = surp.id as number;
        const surpTitle = (surp.title ?? surp.name ?? "") as string;

        if (usedExternalIds.has(surpId)) continue;

        const surpNorm = normalizeName(surpTitle);

        if (namesMatch(localNorm, surpNorm)) {
          console.log(`[auto-link] Matched: "${local.name}" <-> "${surpTitle}" (ext_id: ${surpId})`);

          const { error: updateErr } = await supabase
            .from("marketplace_events")
            .update({ external_id: surpId })
            .eq("id", local.id);

          if (updateErr) {
            errors.push(`Failed to link ${local.name}: ${updateErr.message}`);
          } else {
            linked.push({ local_name: local.name as string, external_id: surpId });
            usedExternalIds.add(surpId);
          }
          break;
        }
      }
    }

    console.log(
      `[auto-link] Linked ${linked.length} marketplaces (auto-create disabled, use fetch-surpluss-marketplaces for discovery)`,
    );
  } catch (e) {
    errors.push(`Auto-link error: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { linked, errors };
}

async function syncMaterial(
  supabase: any,
  marketplace: { id: string; name: string; external_id: number },
  materialId: number,
  materialTitle: string,
  allocatedAmount: number,
  distributedAmount: number,
  category: string | null,
  subcategory: string | null,
  errors: string[],
  stats: AllocationStats,
  surplussAllocationId?: number,
) {
  const { data: itemType, error: itSelectErr } = await supabase
    .from("item_types")
    .select("id")
    .eq("external_material_id", materialId)
    .limit(1)
    .maybeSingle();

  if (itSelectErr) {
    errors.push(`item_types select: ${itSelectErr.message}`);
    return;
  }

  let resolvedItemType = itemType as { id: string } | null;

  if (!resolvedItemType) {
    const insertData: Record<string, unknown> = {
      name: materialTitle,
      external_material_id: materialId,
      icon: "Package",
      total_stock: 0,
      surpluss_url: `https://platform.thesurpluss.com/material/${materialId}`,
    };
    if (category) insertData.category = category;
    if (subcategory) insertData.subcategory = subcategory;

    const { data: newItem, error: insertError } = await supabase
      .from("item_types")
      .insert(insertData)
      .select("id")
      .single();

    if (insertError) {
      errors.push(insertError.message);
      return;
    }
    resolvedItemType = newItem as { id: string };
  } else {
    if (category || subcategory) {
      const updateData: Record<string, unknown> = {};
      if (category) updateData.category = category;
      if (subcategory) updateData.subcategory = subcategory;
      const { error: uErr } = await supabase.from("item_types").update(updateData).eq("id", resolvedItemType.id);
      if (uErr) errors.push(`item_types update: ${uErr.message}`);
    }
  }

  // IMPORTANT: include soft-deleted rows so we can resurrect them instead of
  // updating a tombstone (which leaves the UI showing nothing). Prefer the
  // most-recently-touched row if duplicates exist.
  const { data: existingAllocs, error: eaErr } = await supabase
    .from("marketplace_item_allocations")
    .select("id, allocated_quantity, distributed_quantity, deleted_at")
    .eq("marketplace_id", marketplace.id)
    .eq("item_type_id", resolvedItemType.id)
    .order("deleted_at", { ascending: true, nullsFirst: true })
    .order("updated_at", { ascending: false })
    .limit(1);

  if (eaErr) {
    errors.push(`marketplace_item_allocations select: ${eaErr.message}`);
    return;
  }

  const existingAlloc = (existingAllocs && existingAllocs[0]) || null;

  if (existingAlloc) {
    const finalDistributed = Math.max((existingAlloc.distributed_quantity as number) || 0, distributedAmount);
    const updateData: Record<string, unknown> = {
      allocated_quantity: allocatedAmount,
      distributed_quantity: finalDistributed,
      updated_at: new Date().toISOString(),
    };
    // Resurrect if the row was previously soft-deleted
    if (existingAlloc.deleted_at) updateData.deleted_at = null;
    if (surplussAllocationId) updateData.surpluss_allocation_id = surplussAllocationId;

    const { error: upErr } = await supabase
      .from("marketplace_item_allocations")
      .update(updateData)
      .eq("id", existingAlloc.id);

    if (upErr) errors.push(upErr.message);
    else stats.updated++;
  } else {
    const insertData: Record<string, unknown> = {
      marketplace_id: marketplace.id,
      item_type_id: resolvedItemType.id,
      allocated_quantity: allocatedAmount,
      distributed_quantity: distributedAmount,
      // AUDIT: snapshot of original Surpluss pledge — set on first insert and never updated.
      // Surpluss reconciles `amount` to `distributed_amount` after the event, so this is the only
      // place we preserve the pre-reconciliation allocation for auditors.
      original_allocated_quantity: allocatedAmount,
      original_allocated_synced_at: new Date().toISOString(),
    };
    if (surplussAllocationId) insertData.surpluss_allocation_id = surplussAllocationId;

    const { error: insErr } = await supabase.from("marketplace_item_allocations").insert(insertData);

    if (insErr) errors.push(insErr.message);
    else stats.created++;
  }
}

async function syncSingleMarketplace(
  supabase: any,
  marketplace: { id: string; name: string; external_id: number },
  environment: string,
  apiHeaders: Record<string, string>,
  baseUrl: string,
) {
  let surplussAllocations: unknown[] = [];
  let page = 1;
  const limit = 100;
  let hasMore = true;
  let lastHttpStatus = 200;

  console.log(`[sync] Fetching donation-allocations for event_id=${marketplace.external_id}`);

  while (hasMore && page <= 20) {
    const apiUrl = `${baseUrl}/api/common/donation-allocations?event_id=${marketplace.external_id}&limit=${limit}&page=${page}`;
    console.log(`[sync] Page ${page}: ${apiUrl}`);

    const apiResponse = await fetch(apiUrl, { headers: apiHeaders });
    lastHttpStatus = apiResponse.status;

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error(`[sync] API error: ${apiResponse.status} ${errText.substring(0, 300)}`);
      if (surplussAllocations.length === 0) {
        return {
          marketplace_name: marketplace.name,
          success: false,
          error: `API ${apiResponse.status}`,
          synced: 0,
          created: 0,
          updated: 0,
          total_fetched: 0,
          errors: [errText.substring(0, 500)],
        };
      }
      break;
    }

    let parsed: {
      data?: unknown[];
      allocations?: unknown[];
      meta?: { total?: number };
    };

    try {
      parsed = await apiResponse.json();
    } catch {
      if (surplussAllocations.length === 0) {
        return {
          marketplace_name: marketplace.name,
          success: false,
          error: "Parse error",
          synced: 0,
          created: 0,
          updated: 0,
          total_fetched: 0,
          errors: ["Invalid JSON from donation-allocations"],
        };
      }
      break;
    }

    const items = Array.isArray(parsed) ? parsed : (parsed.data ?? parsed.allocations ?? []);

    if (!Array.isArray(items) || items.length === 0) {
      hasMore = false;
    } else {
      surplussAllocations.push(...items);
      const meta = parsed.meta ?? {};
      const total = meta.total ?? 0;
      hasMore = total > 0 ? surplussAllocations.length < total : items.length === limit;
      page++;
    }
  }

  console.log(`[sync] Total allocations fetched for event ${marketplace.external_id}: ${surplussAllocations.length}`);

  let synced = 0;
  const stats: AllocationStats = { created: 0, updated: 0 };
  const errors: string[] = [];

  // Aggregate materials by materialId to handle duplicates across allocation containers
  const materialMap = new Map<number, {
    title: string;
    totalAllocated: number;
    totalDistributed: number;
    totalRemaining: number;
    category: string | null;
    subcategory: string | null;
    surplussAllocId: number | undefined;
  }>();

  for (const alloc of surplussAllocations as Array<Record<string, unknown>>) {
    try {
      const allocatedMaterials = (alloc.allocated_materials as Array<Record<string, unknown>>) ?? [];
      const surplussAllocId = alloc.id != null ? Number(alloc.id) : undefined;

      if (allocatedMaterials.length > 0) {
        for (const mat of allocatedMaterials) {
          const materialId = (mat.material_id ?? mat.donation_metadata_id) as number | undefined;
          const materialTitle = (mat.material_title ?? mat.title ?? `Material ${materialId}`) as string;
          const apiAmount = Number((mat.amount as number | undefined) ?? 0);
          const distributedAmount = Number((mat.distributed_amount as number | undefined) ?? 0);
          const remainingAmount = Number((mat.remaining_amount as number | undefined) ?? 0);
          const allocatedAmount = remainingAmount > 0
            ? distributedAmount + remainingAmount
            : apiAmount;
          const category = (mat.donation_tag_name as string | null) ?? null;
          const subcategory = (mat.donation_tag_subcategory_name as string | null) ?? null;

          if (!materialId) {
            errors.push("No material ID in allocated_materials entry");
            continue;
          }

          const existing = materialMap.get(materialId);
          if (existing) {
            existing.totalAllocated += allocatedAmount;
            existing.totalDistributed += distributedAmount;
            existing.totalRemaining += remainingAmount;
            if (!existing.surplussAllocId && surplussAllocId) existing.surplussAllocId = surplussAllocId;
          } else {
            materialMap.set(materialId, {
              title: materialTitle,
              totalAllocated: allocatedAmount,
              totalDistributed: distributedAmount,
              totalRemaining: remainingAmount,
              category,
              subcategory,
              surplussAllocId,
            });
          }
        }
      } else {
        const donationMeta = alloc.donation_metadata as Record<string, unknown> | undefined;
        const materialId = (donationMeta?.id ?? alloc.material_id ?? alloc.donation_metadata_id) as number | undefined;
        const materialTitle = (donationMeta?.title ?? alloc.title ?? `Material ${materialId}`) as string;
        const apiAmount = Number((alloc.amount as number | undefined) ?? (alloc.total_amount as number | undefined) ?? 0);
        const distributedAmount = Number((alloc.distributed_amount as number | undefined) ?? (alloc.total_distributed as number | undefined) ?? 0);
        const remainingAmount = Number((alloc.remaining_amount as number | undefined) ?? (alloc.total_remaining as number | undefined) ?? 0);
        const allocatedAmount = remainingAmount > 0
          ? distributedAmount + remainingAmount
          : apiAmount;

        if (!materialId) {
          console.log(`[sync] Skipping allocation ${alloc.id}: no materials`);
          continue;
        }

        const existing = materialMap.get(materialId);
        if (existing) {
          existing.totalAllocated += allocatedAmount;
          existing.totalDistributed += distributedAmount;
          existing.totalRemaining += remainingAmount;
          if (!existing.surplussAllocId && surplussAllocId) existing.surplussAllocId = surplussAllocId;
        } else {
          materialMap.set(materialId, {
            title: materialTitle,
            totalAllocated: allocatedAmount,
            totalDistributed: distributedAmount,
            totalRemaining: remainingAmount,
            category: null,
            subcategory: null,
            surplussAllocId,
          });
        }
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  const aggregateAllocated = Array.from(materialMap.values()).reduce((sum, m) => sum + m.totalAllocated, 0);
  const aggregateDistributed = Array.from(materialMap.values()).reduce((sum, m) => sum + m.totalDistributed, 0);
  const aggregateRemaining = Array.from(materialMap.values()).reduce((sum, m) => sum + m.totalRemaining, 0);

  console.log(
    `[sync] Event ${marketplace.external_id}: ${materialMap.size} unique materials after aggregation; allocated=${aggregateAllocated}, distributed=${aggregateDistributed}, remaining=${aggregateRemaining}`,
  );

  // Now sync once per unique material with the correct totals
  for (const [materialId, { title, totalAllocated, totalDistributed, category, subcategory, surplussAllocId }] of materialMap) {
    try {
      await syncMaterial(
        supabase,
        marketplace,
        materialId,
        title,
        totalAllocated,
        totalDistributed,
        category,
        subcategory,
        errors,
        stats,
        surplussAllocId,
      );
      synced++;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  try {
    await supabase.from("surpluss_api_audit_log").insert({
      action: "sync_event_allocations",
      environment,
      request_payload: { marketplace_id: marketplace.id, external_id: marketplace.external_id },
      response_status: lastHttpStatus,
      response_body: {
        total_fetched: surplussAllocations.length,
        synced,
        created: stats.created,
        updated: stats.updated,
        error_count: errors.length,
      },
      success: errors.length === 0,
    });
  } catch {
    /* ignore audit errors */
  }

  return {
    marketplace_name: marketplace.name,
    success: errors.length === 0,
    synced,
    created: stats.created,
    updated: stats.updated,
    errors,
    total_fetched: surplussAllocations.length,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { marketplace_id, environment = "production" }: SyncRequest = await req.json();

    if (!marketplace_id) {
      return new Response(JSON.stringify({ success: false, error: "marketplace_id is required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase: any = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const apiHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const apiKey = Deno.env.get("SURPLUSS_API_KEY");
    if (apiKey) {
      apiHeaders.Authorization = `Bearer ${apiKey}`;
      apiHeaders["x-api-key"] = apiKey;
    }

    const baseUrl = BASE_URLS[environment];

    if (marketplace_id === "ALL") {
      const autoLinkResult = await autoLinkMarketplaces(supabase, apiHeaders, baseUrl, environment);
      console.log(`[sync-all] Auto-linked ${autoLinkResult.linked.length} marketplaces`);

      const { data: marketplaces, error: mpErr } = await supabase
        .from("marketplace_events")
        .select("id, name, external_id")
        .not("external_id", "is", null);

      if (mpErr || !marketplaces?.length) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "No linked marketplaces found",
            synced_events: 0,
            auto_linked: autoLinkResult.linked,
            auto_link_errors: autoLinkResult.errors,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      console.log(`[sync-all] Syncing ${marketplaces.length} marketplace events (concurrent batches of 5)`);
      const results: Array<{ success?: boolean; synced?: number; marketplace_name?: string; error?: string; created?: number; updated?: number }> = [];
      const batchSize = 5;

      for (let i = 0; i < marketplaces.length; i += batchSize) {
        const batch = marketplaces.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map((mp: { id: string; name: string; external_id: number }) =>
            syncSingleMarketplace(supabase, mp, environment, apiHeaders, baseUrl).catch((e) => ({
              marketplace_name: mp.name,
              success: false,
              error: e?.message ?? String(e),
              synced: 0,
              created: 0,
              updated: 0,
            })),
          ),
        );
        results.push(...batchResults);
      }

      const totalSynced = results.reduce((s, r: { synced?: number }) => s + (r.synced ?? 0), 0);

      try {
        await supabase.from("surpluss_api_audit_log").insert({
          action: "sync_event_allocations",
          environment,
          request_payload: { marketplace_id: "ALL", mode: "ALL", triggered_by: "cron" },
          response_status: 200,
          response_body: {
            synced_events: marketplaces.length,
            total_synced: totalSynced,
            auto_linked: autoLinkResult.linked.length,
            successful: results.filter((r: { success?: boolean }) => r.success).length,
            failed: results.filter((r: { success?: boolean }) => !r.success).length,
          },
          success: true,
        });
      } catch {
        /* ignore */
      }

      return new Response(
        JSON.stringify({
          success: true,
          mode: "ALL",
          synced_events: marketplaces.length,
          total_synced: totalSynced,
          results,
          auto_linked: autoLinkResult.linked,
          auto_link_errors: autoLinkResult.errors,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: marketplace, error: mpError } = await supabase
      .from("marketplace_events")
      .select("id, name, external_id")
      .eq("id", marketplace_id)
      .single();

    if (mpError || !marketplace) {
      return new Response(JSON.stringify({ success: false, error: `Marketplace not found: ${mpError?.message}` }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!marketplace.external_id) {
      const autoLinkResult = await autoLinkMarketplaces(supabase, apiHeaders, baseUrl, environment);

      const { data: refreshed } = await supabase
        .from("marketplace_events")
        .select("id, name, external_id")
        .eq("id", marketplace_id)
        .single();

      if (!refreshed?.external_id) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Marketplace "${marketplace.name}" could not be auto-linked to any Surpluss event. Please set the external_id manually.`,
            auto_link_attempted: true,
            auto_linked: autoLinkResult.linked,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const result = await syncSingleMarketplace(supabase, refreshed, environment, apiHeaders, baseUrl);
      return new Response(
        JSON.stringify({
          ...result,
          success: result.success,
          marketplace_name: refreshed.name,
          external_id: refreshed.external_id,
          auto_linked: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await syncSingleMarketplace(supabase, marketplace, environment, apiHeaders, baseUrl);

    return new Response(
      JSON.stringify({
        ...result,
        success: result.success,
        marketplace_name: marketplace.name,
        external_id: marketplace.external_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[sync-surpluss-event-allocations] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
