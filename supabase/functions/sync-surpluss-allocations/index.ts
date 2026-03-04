import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SurplussDonation {
  id: number;
  uuid?: string;
  title: string;
  description?: string;
  active?: boolean;
  quantity?: number;
  item_count?: number;
  box_count?: number;
  condition_id?: number;
  image_url?: string;
  price?: number;
  per?: string;
  frequency?: unknown;
  created_at?: string;
  updated_at?: string;
  donation_tag?: string | { id: number; name: string; [key: string]: unknown };
  donation_tag_subcategory?: string | { id: number; name: string; [key: string]: unknown };
  company?: {
    id: number;
    uuid?: string;
    name: string;
    main_business?: string;
    sector?: string;
    company_size?: string;
    designation?: string;
    image_url?: string;
    about_info?: string;
    currency?: string;
    company_license_number?: string;
    website_url?: string;
    is_parent_company?: boolean;
  };
  address?: {
    id: number;
    address?: string;
    city?: string;
    country?: string;
    state?: string;
    zip_code?: string;
    location_latitude?: number;
    location_longitude?: number;
    is_primary?: boolean;
  };
  material_group?: {
    id: number;
    name: string;
    code?: string;
    uom?: string;
  };
  material_group_id?: number;
  third_level_subcategory_id?: number;
  type?: {
    offering_type?: string;
    status?: string;
    approve_date?: string;
    count_of_boxes?: number;
  };
  sdg_goals?: Array<{
    id: number;
    name: string;
    code?: string;
    description?: string;
    image_url?: string;
  }>;
}

interface SyncResult {
  allocation_id: number;
  title: string;
  status: 'success' | 'failed';
  external_item_id?: string;
  company_synced?: boolean;
  material_group_synced?: boolean;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    const { allocations, environment = 'unknown' } = payload;

    if (!allocations || !Array.isArray(allocations)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid allocations array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const donationsToProcess: SurplussDonation[] = allocations;
    console.log(`Processing ${donationsToProcess.length} donations (will upsert - update existing, insert new)`);

    const results: SyncResult[] = [];
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalFailed = 0;

    for (const donation of donationsToProcess) {
      const result: SyncResult = {
        allocation_id: donation.id,
        title: donation.title,
        status: 'success',
      };

      try {
        let companyId: string | null = null;
        let addressId: string | null = null;
        let materialGroupId: string | null = null;

        // Upsert company
        if (donation.company && donation.company.id) {
          const companyData = {
            external_id: donation.company.id,
            uuid: donation.company.uuid || null,
            name: donation.company.name || 'Unknown Company',
            main_business: donation.company.main_business || null,
            sector: donation.company.sector || null,
            company_size: donation.company.company_size || null,
            designation: donation.company.designation || null,
            image_url: donation.company.image_url || null,
            about_info: donation.company.about_info || null,
            currency: donation.company.currency || 'AED',
            company_license_number: donation.company.company_license_number || null,
            website_url: donation.company.website_url || null,
            is_parent_company: donation.company.is_parent_company || false,
            updated_at: new Date().toISOString(),
          };

          const { data: existingCompany } = await supabase
            .from('external_companies')
            .select('id')
            .eq('external_id', donation.company.id)
            .maybeSingle();

          if (existingCompany) {
            await supabase.from('external_companies').update(companyData).eq('id', existingCompany.id);
            companyId = existingCompany.id;
          } else {
            const { data: newCompany } = await supabase.from('external_companies').insert(companyData).select('id').single();
            companyId = newCompany?.id || null;
          }
          result.company_synced = true;
        }

        // Upsert address
        if (donation.address && donation.address.id) {
          const addressData = {
            external_id: donation.address.id,
            address: donation.address.address || 'Unknown',
            city: donation.address.city || null,
            country: donation.address.country || null,
            state: donation.address.state || null,
            zip_code: donation.address.zip_code || null,
            location_latitude: donation.address.location_latitude || null,
            location_longitude: donation.address.location_longitude || null,
            is_primary: donation.address.is_primary || false,
            company_id: companyId,
            updated_at: new Date().toISOString(),
          };

          const { data: existingAddr } = await supabase
            .from('external_addresses')
            .select('id')
            .eq('external_id', donation.address.id)
            .maybeSingle();

          if (existingAddr) {
            await supabase.from('external_addresses').update(addressData).eq('id', existingAddr.id);
            addressId = existingAddr.id;
          } else {
            const { data: newAddr } = await supabase.from('external_addresses').insert(addressData).select('id').single();
            addressId = newAddr?.id || null;
          }
        }

        // Upsert material group
        if (donation.material_group && donation.material_group.id) {
          const mgData = {
            external_id: donation.material_group.id,
            name: donation.material_group.name || 'Unknown',
            code: donation.material_group.code || null,
            uom: donation.material_group.uom || null,
            updated_at: new Date().toISOString(),
          };

          const { data: existingMg } = await supabase
            .from('external_material_groups')
            .select('id')
            .eq('external_id', donation.material_group.id)
            .maybeSingle();

          if (existingMg) {
            await supabase.from('external_material_groups').update(mgData).eq('id', existingMg.id);
            materialGroupId = existingMg.id;
          } else {
            const { data: newMg } = await supabase.from('external_material_groups').insert(mgData).select('id').single();
            materialGroupId = newMg?.id || null;
          }
          result.material_group_synced = true;
        }

        // Upsert external item
        const itemData = {
          external_id: donation.id,
          uuid: donation.uuid || null,
          title: donation.title || 'Untitled',
          description: donation.description || null,
          active: donation.active ?? true,
          price: donation.price ?? null,
          per: donation.per ? String(donation.per) : null,
          frequency: donation.frequency || null,
          image_url: donation.image_url || null,
          quantity: donation.quantity ?? 0,
          item_count: donation.item_count ?? 0,
          box_count: donation.box_count ?? null,
          type_data: donation.type || null,
          condition_id: donation.condition_id ?? null,
          third_level_subcategory_id: donation.third_level_subcategory_id ?? null,
          company_id: companyId,
          address_id: addressId,
          material_group_id: materialGroupId,
          updated_at: new Date().toISOString(),
        };

        const { data: existingItem } = await supabase
          .from('external_items')
          .select('id')
          .eq('external_id', donation.id)
          .maybeSingle();

        let itemId: string;
        if (existingItem) {
          await supabase.from('external_items').update(itemData).eq('id', existingItem.id);
          itemId = existingItem.id;
          totalUpdated++;
        } else {
          const { data: newItem } = await supabase.from('external_items').insert(itemData).select('id').single();
          itemId = newItem?.id || '';
          totalCreated++;
        }
        result.external_item_id = itemId;

        // Upsert into item_types so the item appears in allocation dropdowns
        // Use donation.id as unique key (not material_group.id which is shared across many donations)
        const materialId = donation.id;
        const rawTag = donation.donation_tag;
        const categoryName = (typeof rawTag === 'object' && rawTag !== null ? rawTag.name : rawTag) || donation.material_group?.name || 'Uncategorized';
        const rawSubTag = donation.donation_tag_subcategory;
        const subcategoryName = (typeof rawSubTag === 'object' && rawSubTag !== null ? rawSubTag.name : rawSubTag) || null;
        // NOTE: donation.quantity from the Surpluss donations API represents the
        // "remaining unallocated quantity" on the Surpluss platform — NOT the total
        // donated or the amount allocated to GIF. We still store it here because
        // there is no better field available from this endpoint. The actual GIF
        // allocation quantities come from the donation-allocations endpoint and are
        // synced via sync-surpluss-event-allocations. The total_stock value should
        // be treated as an approximate upper-bound reference, not an exact figure.
        // See: .lovable/plan.md — Inventory Reconciliation notes.
        const totalQty = donation.quantity ?? donation.item_count ?? 0;

        const { data: existingItemType } = await supabase
          .from('item_types')
          .select('id, total_stock')
          .eq('external_material_id', materialId)
          .maybeSingle();

        if (existingItemType) {
          await supabase.from('item_types').update({
            name: donation.title || 'Untitled',
            category: categoryName,
            subcategory: subcategoryName,
            total_stock: totalQty,
            surpluss_url: `https://platform.thesurpluss.com/material/${materialId}`,
            updated_at: new Date().toISOString(),
          }).eq('id', existingItemType.id);
          console.log(`Updated item_type for donation ${materialId}: ${donation.title}`);
        } else {
          await supabase.from('item_types').insert({
            name: donation.title || 'Untitled',
            icon: 'Package',
            category: categoryName,
            subcategory: subcategoryName,
            total_stock: totalQty,
            external_material_id: materialId,
            surpluss_url: `https://platform.thesurpluss.com/material/${materialId}`,
          });
          console.log(`Created item_type for donation ${materialId}: ${donation.title}`);
        }

        // Handle SDG goals
        if (donation.sdg_goals && Array.isArray(donation.sdg_goals) && itemId) {
          await supabase.from('external_item_sdg_goals').delete().eq('item_id', itemId);

          for (const sdg of donation.sdg_goals) {
            if (!sdg.id) continue;
            const sdgData = {
              external_id: sdg.id,
              name: sdg.name || 'Unknown',
              code: sdg.code || null,
              description: sdg.description || null,
              image_url: sdg.image_url || null,
              updated_at: new Date().toISOString(),
            };

            const { data: existingSdg } = await supabase
              .from('external_sdg_goals')
              .select('id')
              .eq('external_id', sdg.id)
              .maybeSingle();

            let sdgGoalId: string;
            if (existingSdg) {
              await supabase.from('external_sdg_goals').update(sdgData).eq('id', existingSdg.id);
              sdgGoalId = existingSdg.id;
            } else {
              const { data: newSdg } = await supabase.from('external_sdg_goals').insert(sdgData).select('id').single();
              sdgGoalId = newSdg?.id || '';
            }

            if (sdgGoalId) {
              await supabase.from('external_item_sdg_goals').insert({ item_id: itemId, sdg_goal_id: sdgGoalId });
            }
          }
        }

        // Upsert sync tracking
        const { data: existingSync } = await supabase
          .from('surpluss_allocation_sync')
          .select('id')
          .eq('allocation_id', donation.id)
          .eq('environment', environment)
          .maybeSingle();

        if (existingSync) {
          await supabase.from('surpluss_allocation_sync').update({
            marketplace_external_id: donation.company?.id || null,
            updated_at: new Date().toISOString(),
          }).eq('id', existingSync.id);
        } else {
          await supabase.from('surpluss_allocation_sync').insert({
            allocation_id: donation.id,
            environment,
            marketplace_external_id: donation.company?.id || null,
          });
        }

        results.push(result);
        console.log(`Synced donation ${donation.id}: ${donation.title}`);
      } catch (error) {
        result.status = 'failed';
        result.error = error instanceof Error ? error.message : 'Unknown error';
        results.push(result);
        totalFailed++;
        console.error(`Error processing donation ${donation.id}:`, error);
      }
    }

    console.log(`Sync complete: ${totalCreated} created, ${totalUpdated} updated, ${totalFailed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total_processed: donationsToProcess.length,
          allocations_created: totalCreated,
          allocations_updated: totalUpdated,
          failed: totalFailed,
        },
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing donations:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
