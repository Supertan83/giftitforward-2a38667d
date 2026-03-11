import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Subcategory → correct category mapping from Excel
    const fixes: Array<{ subcategoryPattern: string; correctCategory: string }> = [
      // Baby & Kids → Clothing, Apparel & Accessories
      { subcategoryPattern: "Children's Apparel", correctCategory: 'Clothing, Apparel & Accessories' },
      { subcategoryPattern: "Children's Shoes", correctCategory: 'Clothing, Apparel & Accessories' },
      { subcategoryPattern: "Children's Slippers", correctCategory: 'Clothing, Apparel & Accessories' },
      { subcategoryPattern: "Toddlers Apparel", correctCategory: 'Clothing, Apparel & Accessories' },
      { subcategoryPattern: "Toddlers Shoes", correctCategory: 'Clothing, Apparel & Accessories' },
      { subcategoryPattern: "Kids Girl's Accessories", correctCategory: 'Clothing, Apparel & Accessories' },
      // Clothing → Home Goods
      { subcategoryPattern: "Bathroom Accessories", correctCategory: 'Home Goods' },
      { subcategoryPattern: "Household Accessories", correctCategory: 'Home Goods' },
      // Clothing → Miscellaneous
      { subcategoryPattern: "Gift Bags", correctCategory: 'Miscellaneous' },
      // Clothing → Beauty, Hygiene & Personal Care
      { subcategoryPattern: "Shoe Products", correctCategory: 'Beauty, Hygiene & Personal Care' },
      // Clothing → Toys, Sports & Stationery
      { subcategoryPattern: "Swimming Accessories", correctCategory: 'Toys, Sports & Stationery' },
      // Clothing → Electronics & Appliances (chargers, cables)
      // Clothing → Miscellaneous (car care, sunshades)
    ];

    const results: Array<{ subcategory: string; category: string; count: number }> = [];

    for (const fix of fixes) {
      const { data, error } = await supabase
        .from('item_types')
        .update({ category: fix.correctCategory, updated_at: new Date().toISOString() })
        .ilike('subcategory', `%${fix.subcategoryPattern}%`)
        .neq('category', fix.correctCategory)
        .select('id');

      results.push({
        subcategory: fix.subcategoryPattern,
        category: fix.correctCategory,
        count: data?.length || 0,
      });
      if (error) console.error(`Error updating ${fix.subcategoryPattern}:`, error);
    }

    // Handle "Accessories" subcategory items that need special routing based on content
    // Car care / sunshades → Miscellaneous
    const { data: carCare } = await supabase
      .from('item_types')
      .update({ category: 'Miscellaneous', updated_at: new Date().toISOString() })
      .or('name.ilike.%car care%,name.ilike.%sunshade%,name.ilike.%car seat%')
      .eq('category', 'Clothing, Apparel & Accessories')
      .select('id');
    results.push({ subcategory: 'Accessories (car care)', category: 'Miscellaneous', count: carCare?.length || 0 });

    // Chargers/cables → Electronics & Appliances
    const { data: electronics } = await supabase
      .from('item_types')
      .update({ category: 'Electronics & Appliances', updated_at: new Date().toISOString() })
      .or('name.ilike.%charger%,name.ilike.%cable%,name.ilike.%adapter%')
      .eq('category', 'Clothing, Apparel & Accessories')
      .select('id');
    results.push({ subcategory: 'Accessories (electronics)', category: 'Electronics & Appliances', count: electronics?.length || 0 });

    const totalFixed = results.reduce((sum, r) => sum + r.count, 0);
    console.log(`Category fix complete: ${totalFixed} items corrected`, results);

    return new Response(
      JSON.stringify({ success: true, total_fixed: totalFixed, details: results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fixing categories:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
