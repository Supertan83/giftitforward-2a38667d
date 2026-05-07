CREATE OR REPLACE FUNCTION public.admin_reset_qr_card(p_unique_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_card record;
  v_clean_id text;
  v_prev_status text;
  v_prev_marketplace_id uuid;
  v_collected integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized: admin role required';
  END IF;

  v_clean_id := TRIM(p_unique_id);

  SELECT * INTO v_card
  FROM public.qr_cards
  WHERE lower(unique_id) = lower(v_clean_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card not found';
  END IF;

  v_prev_status := v_card.status::text;
  v_prev_marketplace_id := v_card.marketplace_id;
  v_collected := v_card.total_items_collected;

  UPDATE public.qr_cards
  SET status = 'inactive',
      credit_balance = 0,
      total_items_collected = 0,
      collected_items = '[]'::jsonb,
      marketplace_id = NULL,
      activated_at = NULL,
      updated_at = now()
  WHERE id = v_card.id;

  INSERT INTO public.transactions (card_id, type, credit_change, scanned_by, marketplace_id)
  VALUES (v_card.id, 'CheckOut', 0, auth.uid(), v_prev_marketplace_id);

  RETURN json_build_object(
    'cardId', v_card.id,
    'uniqueId', v_card.unique_id,
    'previousStatus', v_prev_status,
    'totalCollected', v_collected
  );
END;
$function$;