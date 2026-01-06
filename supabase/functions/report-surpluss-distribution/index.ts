import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DistributedMaterial {
  material_id: number;
  distributed_amount: number;
  remaining_amount: number;
}

interface AllocationReport {
  id: number;
  distributed_materials: DistributedMaterial[];
  total_distributed: number;
  total_remaining: number;
  status: string;
  reported_at: string;
}

interface ReportRequestPayload {
  environment: 'staging' | 'production';
  allocations: Array<{
    allocation_id: number;
    marketplace_external_id: number;
    materials: Array<{
      material_id: number;
      distributed: number;
      allocated: number;
    }>;
  }>;
}

interface ReportResult {
  allocation_id: number;
  success: boolean;
  error?: string;
  api_response?: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: ReportRequestPayload = await req.json();
    const { environment, allocations } = payload;

    if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No allocations provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine base URL based on environment
    const baseUrl = environment === 'production'
      ? 'https://api.thesurpluss.com'
      : 'https://surpluss-server.herokuapp.com';

    const apiUrl = `${baseUrl}/api/common/donation-allocations/distribution`;

    console.log(`Reporting distribution to ${environment} environment: ${apiUrl}`);
    console.log(`Processing ${allocations.length} allocations`);

    const results: ReportResult[] = [];
    const reportedAt = new Date().toISOString();

    // Transform allocations to API format
    const apiAllocations: AllocationReport[] = allocations.map(alloc => ({
      id: alloc.allocation_id,
      distributed_materials: alloc.materials.map(m => ({
        material_id: m.material_id,
        distributed_amount: m.distributed,
        remaining_amount: m.allocated - m.distributed,
      })),
      total_distributed: alloc.materials.reduce((sum, m) => sum + m.distributed, 0),
      total_remaining: alloc.materials.reduce((sum, m) => sum + (m.allocated - m.distributed), 0),
      status: alloc.materials.every(m => m.distributed >= m.allocated) ? 'completed' : 'in_progress',
      reported_at: reportedAt,
    }));

    console.log('API Payload:', JSON.stringify({ allocations: apiAllocations }, null, 2));

    // Make the API call
    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ allocations: apiAllocations }),
    });

    const responseBody = await response.text();
    let responseJson: any;
    try {
      responseJson = JSON.parse(responseBody);
    } catch {
      responseJson = { raw: responseBody };
    }

    console.log(`API Response Status: ${response.status}`);
    console.log(`API Response Body:`, responseJson);

    // Record each allocation report in the database
    for (const alloc of allocations) {
      const totalDistributed = alloc.materials.reduce((sum, m) => sum + m.distributed, 0);
      const totalAllocated = alloc.materials.reduce((sum, m) => sum + m.allocated, 0);

      const { error: insertError } = await supabase
        .from('surpluss_distribution_reports')
        .insert({
          allocation_id: alloc.allocation_id,
          environment,
          marketplace_external_id: alloc.marketplace_external_id,
          distributed_total: totalDistributed,
          allocated_total: totalAllocated,
          api_response_status: response.status,
          api_response_body: responseJson,
          reported_at: reportedAt,
        });

      if (insertError) {
        console.error(`Error recording report for allocation ${alloc.allocation_id}:`, insertError);
        results.push({
          allocation_id: alloc.allocation_id,
          success: false,
          error: `Failed to record: ${insertError.message}`,
        });
      } else {
        results.push({
          allocation_id: alloc.allocation_id,
          success: response.ok,
          api_response: responseJson,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: response.ok,
        api_status: response.status,
        api_response: responseJson,
        results,
        reported_count: results.filter(r => r.success).length,
        failed_count: results.filter(r => !r.success).length,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in report-surpluss-distribution:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false,
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
