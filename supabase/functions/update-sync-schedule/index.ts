import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const dbUrl = Deno.env.get('SUPABASE_DB_URL');

    if (!dbUrl) {
      return new Response(
        JSON.stringify({ error: 'Database URL not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { interval_minutes } = await req.json();

    const validIntervals = [0, 1, 3, 5, 15, 30];
    if (!validIntervals.includes(interval_minutes)) {
      return new Response(
        JSON.stringify({ error: `Invalid interval. Must be one of: ${validIntervals.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { Client } = await import('https://deno.land/x/postgres@v0.19.3/mod.ts');
    const client = new Client(dbUrl);
    await client.connect();
    
    // Find and kill ALL sync-related cron jobs by name OR by command content
    try {
      const existingJobs = await client.queryObject<{ jobid: number; jobname: string }>(
        `SELECT jobid, jobname FROM cron.job 
         WHERE jobname = 'sync-surpluss-allocations' 
         OR command LIKE '%sync-surpluss-event-allocations%'`
      );
      
      for (const job of existingJobs.rows) {
        try {
          await client.queryObject(`SELECT cron.unschedule(${job.jobid})`);
          console.log(`Unscheduled job ${job.jobid} (${job.jobname})`);
        } catch (e) {
          console.log(`Failed to unschedule job ${job.jobid}: ${e.message}`);
        }
      }
      
      if (existingJobs.rows.length === 0) {
        console.log('No existing sync cron jobs found');
      }
    } catch (e) {
      console.log('Error querying cron.job:', e.message);
    }

    // If interval is 0 (off), just unschedule and don't create a new job
    if (interval_minutes === 0) {
      await client.end();

      await supabase.from('surpluss_api_audit_log').insert({
        action: 'sync_schedule_updated',
        environment: 'production',
        request_payload: { interval_minutes: 0, schedule: 'disabled' },
        response_status: 200,
        response_body: { message: 'Auto-sync has been disabled' },
        success: true,
      });

      return new Response(
        JSON.stringify({ success: true, interval_minutes: 0, schedule: 'disabled', message: 'Auto-sync has been disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const schedule = `*/${interval_minutes} * * * *`;
    const functionUrl = `${supabaseUrl}/functions/v1/sync-surpluss-event-allocations`;

    // Schedule new job
    await client.queryObject(`
      SELECT cron.schedule(
        'sync-surpluss-allocations',
        '${schedule}',
        $CMD$
        SELECT net.http_post(
          url := '${functionUrl}',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${anonKey}"}'::jsonb,
          body := '{"marketplace_id": "ALL", "environment": "production"}'::jsonb
        ) AS request_id;
        $CMD$
      )
    `);

    await client.end();

    await supabase.from('surpluss_api_audit_log').insert({
      action: 'sync_schedule_updated',
      environment: 'production',
      request_payload: { interval_minutes, schedule },
      response_status: 200,
      response_body: { message: `Schedule updated to every ${interval_minutes} minute(s)` },
      success: true,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        interval_minutes,
        schedule,
        message: `Auto-sync schedule updated to every ${interval_minutes} minute(s)` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating sync schedule:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
