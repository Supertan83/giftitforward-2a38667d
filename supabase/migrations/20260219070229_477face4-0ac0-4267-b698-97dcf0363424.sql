
-- Update get_marketplace_distribution_count to filter stale transactions
-- Only count transactions that occurred after the marketplace's event_date (or card activation)
CREATE OR REPLACE FUNCTION public.get_marketplace_distribution_count(p_marketplace_id uuid)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)
  FROM transactions t
  JOIN qr_cards q ON t.card_id = q.id
  WHERE q.marketplace_id = p_marketplace_id
    AND t.type = 'Distribution'
    AND t.timestamp >= (
      SELECT COALESCE(me.event_date, me.created_at::date)::timestamp with time zone
      FROM marketplace_events me
      WHERE me.id = p_marketplace_id
    );
$function$;
