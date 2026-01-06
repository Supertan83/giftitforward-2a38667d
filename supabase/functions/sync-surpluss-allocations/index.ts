import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AllocatedMaterial {
  material_id: number;
  material_title: string;
  amount: number;
}

interface SurplussAllocation {
  id: number;
  marketplace_event_id: number;
  marketplace_event_title: string;
  allocated_at: string;
  allocated_materials: AllocatedMaterial[];
}

interface SyncResult {
  allocation_id: number;
  marketplace_title: string;
  status: 'success' | 'failed';
  marketplace_id?: string;
  marketplace_created?: boolean;
  materials_processed?: number;
  allocations_created?: number;
  allocations_updated?: number;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { allocations }: { allocations: SurplussAllocation[] } = await req.json();

    if (!allocations || !Array.isArray(allocations)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid allocations array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${allocations.length} allocations from Surpluss`);

    const results: SyncResult[] = [];
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalFailed = 0;

    for (const allocation of allocations) {
      const result: SyncResult = {
        allocation_id: allocation.id,
        marketplace_title: allocation.marketplace_event_title,
        status: 'success',
        materials_processed: 0,
        allocations_created: 0,
        allocations_updated: 0
      };

      try {
        const externalMarketplaceId = allocation.marketplace_event_id;
        const marketplaceTitle = allocation.marketplace_event_title;
        const allocatedMaterials = allocation.allocated_materials || [];

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
          result.marketplace_id = marketplace.id;
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
            result.marketplace_id = marketplace.id;

            // Update the external_id for future matching
            await supabase
              .from('marketplace_events')
              .update({ external_id: externalMarketplaceId })
              .eq('id', marketplace.id);

            console.log(`Found marketplace by title: ${marketplace.name}, linked external_id`);
          } else {
            // Create new marketplace event
            const { data: newMarketplace, error: createError } = await supabase
              .from('marketplace_events')
              .insert({
                name: marketplaceTitle,
                external_id: externalMarketplaceId,
                status: 'upcoming',
                event_date: allocation.allocated_at ? new Date(allocation.allocated_at).toISOString().split('T')[0] : null
              })
              .select('id, name')
              .single();

            if (createError) {
              throw new Error(`Failed to create marketplace: ${createError.message}`);
            }

            marketplace = newMarketplace;
            result.marketplace_id = marketplace.id;
            result.marketplace_created = true;
            console.log(`Created new marketplace: ${marketplace.name}`);
          }
        }

        // Process each allocated material
        for (const material of allocatedMaterials) {
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
            } else {
              // Create new item type
              const { data: newItem, error: createItemError } = await supabase
                .from('item_types')
                .insert({
                  name: materialTitle,
                  external_material_id: materialId,
                  icon: 'Package',
                  total_stock: amount
                })
                .select('id, name')
                .single();

              if (createItemError) {
                console.error(`Failed to create item type ${materialTitle}:`, createItemError);
                continue;
              }

              itemType = newItem;
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
            } else {
              result.allocations_updated = (result.allocations_updated || 0) + 1;
              totalUpdated++;
            }
          } else {
            // Create new allocation
            const { error: insertError } = await supabase
              .from('marketplace_item_allocations')
              .insert({
                marketplace_id: marketplace.id,
                item_type_id: itemType.id,
                allocated_quantity: amount,
                distributed_quantity: 0
              });

            if (insertError) {
              console.error(`Failed to create allocation:`, insertError);
            } else {
              result.allocations_created = (result.allocations_created || 0) + 1;
              totalCreated++;
            }
          }

          result.materials_processed = (result.materials_processed || 0) + 1;
        }

        results.push(result);

      } catch (error) {
        result.status = 'failed';
        result.error = error instanceof Error ? error.message : 'Unknown error';
        results.push(result);
        totalFailed++;
        console.error(`Error processing allocation ${allocation.id}:`, error);
      }
    }

    console.log(`Sync complete: ${totalCreated} created, ${totalUpdated} updated, ${totalFailed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total_processed: allocations.length,
          allocations_created: totalCreated,
          allocations_updated: totalUpdated,
          failed: totalFailed
        },
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing allocations:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
