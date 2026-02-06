import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Validate API key
    const apiKey = req.headers.get('x-api-key');
    const expectedKey = Deno.env.get('WEBHOOK_API_KEY');
    if (!expectedKey || apiKey !== expectedKey) {
      console.error('Invalid or missing API key');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const items = Array.isArray(body) ? body : [body];

    console.log(`Received ${items.length} item(s) from Surpluss`);

    // Log webhook event
    const { data: webhookEvent } = await supabase.from('webhook_events').insert({
      payload: body,
      source_identifier: 'surpluss_items',
      processed: false,
    }).select('id').single();

    const webhookEventId = webhookEvent?.id;
    const results: { external_id: number; title: string; status: string; error?: string }[] = [];

    for (const item of items) {
      try {
        let companyId: string | null = null;
        let addressId: string | null = null;
        let materialGroupId: string | null = null;

        // Upsert company
        if (item.company && item.company.id) {
          const companyData = {
            external_id: item.company.id,
            uuid: item.company.uuid || null,
            name: item.company.name || 'Unknown Company',
            main_business: item.company.main_business || null,
            sector: item.company.sector || null,
            company_size: item.company.company_size || null,
            designation: item.company.designation || null,
            image_url: item.company.image_url || null,
            about_info: item.company.about_info || null,
            currency: item.company.currency || 'AED',
            company_license_number: item.company.company_license_number || null,
            website_url: item.company.website_url || null,
            is_parent_company: item.company.is_parent_company || false,
            updated_at: new Date().toISOString(),
          };

          const { data: existingCompany } = await supabase
            .from('external_companies')
            .select('id')
            .eq('external_id', item.company.id)
            .maybeSingle();

          if (existingCompany) {
            await supabase.from('external_companies').update(companyData).eq('id', existingCompany.id);
            companyId = existingCompany.id;
          } else {
            const { data: newCompany } = await supabase.from('external_companies').insert(companyData).select('id').single();
            companyId = newCompany?.id || null;
          }
        }

        // Upsert address
        if (item.address && item.address.id) {
          const addressData = {
            external_id: item.address.id,
            address: item.address.address || 'Unknown',
            city: item.address.city || null,
            country: item.address.country || null,
            state: item.address.state || null,
            zip_code: item.address.zip_code || null,
            location_latitude: item.address.location_latitude || null,
            location_longitude: item.address.location_longitude || null,
            is_primary: item.address.is_primary || false,
            company_id: companyId,
            updated_at: new Date().toISOString(),
          };

          const { data: existingAddr } = await supabase
            .from('external_addresses')
            .select('id')
            .eq('external_id', item.address.id)
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
        if (item.material_group && item.material_group.id) {
          const mgData = {
            external_id: item.material_group.id,
            name: item.material_group.name || 'Unknown',
            code: item.material_group.code || null,
            uom: item.material_group.uom || null,
            updated_at: new Date().toISOString(),
          };

          const { data: existingMg } = await supabase
            .from('external_material_groups')
            .select('id')
            .eq('external_id', item.material_group.id)
            .maybeSingle();

          if (existingMg) {
            await supabase.from('external_material_groups').update(mgData).eq('id', existingMg.id);
            materialGroupId = existingMg.id;
          } else {
            const { data: newMg } = await supabase.from('external_material_groups').insert(mgData).select('id').single();
            materialGroupId = newMg?.id || null;
          }
        }

        // Upsert item
        const itemData = {
          external_id: item.id,
          uuid: item.uuid || null,
          title: item.title || 'Untitled',
          description: item.description || null,
          active: item.active ?? true,
          price: item.price ?? null,
          per: item.per ? String(item.per) : null,
          frequency: item.frequency || null,
          image_url: item.image_url || null,
          quantity: item.quantity ?? 0,
          item_count: item.item_count ?? 0,
          box_count: item.box_count ?? null,
          type_data: item.type || null,
          condition_id: item.condition_id ?? null,
          third_level_subcategory_id: item.third_level_subcategory_id ?? null,
          company_id: companyId,
          address_id: addressId,
          material_group_id: materialGroupId,
          webhook_event_id: webhookEventId,
          updated_at: new Date().toISOString(),
        };

        const { data: existingItem } = await supabase
          .from('external_items')
          .select('id')
          .eq('external_id', item.id)
          .maybeSingle();

        let itemId: string;
        if (existingItem) {
          await supabase.from('external_items').update(itemData).eq('id', existingItem.id);
          itemId = existingItem.id;
        } else {
          const { data: newItem } = await supabase.from('external_items').insert(itemData).select('id').single();
          itemId = newItem?.id || '';
        }

        // Handle SDG goals
        if (item.sdg_goals && Array.isArray(item.sdg_goals) && itemId) {
          // Remove old links
          await supabase.from('external_item_sdg_goals').delete().eq('item_id', itemId);

          for (const sdg of item.sdg_goals) {
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
              await supabase.from('external_item_sdg_goals').insert({
                item_id: itemId,
                sdg_goal_id: sdgGoalId,
              });
            }
          }
        }

        results.push({ external_id: item.id, title: item.title, status: 'success' });
        console.log(`Processed item ${item.id}: ${item.title}`);
      } catch (itemError) {
        const msg = itemError instanceof Error ? itemError.message : 'Unknown error';
        console.error(`Failed to process item ${item.id}:`, msg);
        results.push({ external_id: item.id, title: item.title || 'unknown', status: 'failed', error: msg });
      }
    }

    // Mark webhook event as processed
    if (webhookEventId) {
      await supabase.from('webhook_events').update({ processed: true }).eq('id', webhookEventId);
    }

    const summary = {
      total: items.length,
      processed: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length,
      results,
    };

    console.log(`Summary: ${summary.processed}/${summary.total} processed, ${summary.failed} failed`);

    return new Response(JSON.stringify(summary), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('receive-surpluss-items error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
