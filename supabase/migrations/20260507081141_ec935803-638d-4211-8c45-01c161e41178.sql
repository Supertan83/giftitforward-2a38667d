CREATE OR REPLACE FUNCTION public.get_marketplace_distribution_count(p_marketplace_id uuid)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)
  FROM transactions t
  WHERE t.marketplace_id = p_marketplace_id
    AND t.type = 'Distribution'
    AND t.timestamp >= (
      SELECT COALESCE(me.event_date, me.created_at::date)::timestamp with time zone
      FROM marketplace_events me
      WHERE me.id = p_marketplace_id
    );
$function$;