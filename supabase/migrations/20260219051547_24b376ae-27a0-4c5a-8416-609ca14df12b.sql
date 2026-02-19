
CREATE OR REPLACE FUNCTION public.get_marketplace_distribution_count(p_marketplace_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)
  FROM transactions t
  JOIN qr_cards q ON t.card_id = q.id
  WHERE q.marketplace_id = p_marketplace_id
    AND t.type = 'Distribution';
$$;
