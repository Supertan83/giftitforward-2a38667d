CREATE OR REPLACE FUNCTION public.checkout_beneficiary_card(p_unique_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_card record;
  v_clean_id text;
  v_collected integer;
  v_prev_marketplace_id uuid;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_clean_id := TRIM(p_unique_id);

  SELECT * INTO v_card
  FROM public.qr_cards
  WHERE lower(unique_id) = lower(v_clean_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card not found';
  END IF;

  IF v_card.status != 'active' THEN
    RAISE EXCEPTION 'Card is not active (status: %). Cannot check out.', v_card.status;
  END IF;

  v_collected := v_card.total_items_collected;
  v_prev_marketplace_id := v_card.marketplace_id;

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
    'totalCollected', v_collected,
    'cardId', v_card.id,
    'uniqueId', v_card.unique_id
  );
END;
$function$;

-- One-time backfill: reset stranded checked_out cards to inactive
UPDATE public.qr_cards
SET status = 'inactive',
    credit_balance = 0,
    total_items_collected = 0,
    collected_items = '[]'::jsonb,
    updated_at = now()
WHERE status = 'checked_out'
  AND marketplace_id IS NULL
  AND activated_at IS NULL
  AND deleted_at IS NULL;