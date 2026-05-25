-- Require explicit marketplace_id on QR scans to prevent silent NULL writes.
CREATE OR REPLACE FUNCTION public.activate_beneficiary_card(
  p_unique_id text,
  p_marketplace_id uuid DEFAULT NULL::uuid,
  p_gender text DEFAULT NULL::text,
  p_marital_status text DEFAULT NULL::text,
  p_nationality text DEFAULT NULL::text,
  p_children_count integer DEFAULT NULL::integer
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_card record;
  v_clean_id text;
  v_updated record;
  v_resolved_mp uuid;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_clean_id := TRIM(p_unique_id);
  v_resolved_mp := p_marketplace_id;

  -- Safety net: if no marketplace was supplied, fall back to the single
  -- marketplace scheduled today (Asia/Dubai). If 0 or >1 match, refuse.
  IF v_resolved_mp IS NULL THEN
    SELECT id INTO v_resolved_mp
    FROM public.marketplace_events
    WHERE deleted_at IS NULL
      AND event_date = (now() AT TIME ZONE 'Asia/Dubai')::date
    LIMIT 2;
    IF v_resolved_mp IS NULL THEN
      RAISE EXCEPTION 'Select a marketplace before scanning (no event scheduled today).';
    END IF;
    -- ensure exactly one
    IF (SELECT COUNT(*) FROM public.marketplace_events
        WHERE deleted_at IS NULL
          AND event_date = (now() AT TIME ZONE 'Asia/Dubai')::date) > 1 THEN
      RAISE EXCEPTION 'Multiple marketplaces scheduled today — please select one before scanning.';
    END IF;
  END IF;

  SELECT * INTO v_card FROM public.qr_cards WHERE lower(unique_id) = lower(v_clean_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Card not found'; END IF;

  IF v_card.status = 'active' THEN
    RAISE EXCEPTION 'Card already activated. This beneficiary has already entered the marketplace.';
  END IF;
  IF v_card.status = 'checked_out' THEN
    RAISE EXCEPTION 'This card has already been used today. It will be available again tomorrow.';
  END IF;

  UPDATE public.qr_cards
  SET status = 'active',
      credit_balance = 0,
      total_items_collected = 0,
      collected_items = '[]'::jsonb,
      activated_at = now(),
      marketplace_id = v_resolved_mp,
      gender = COALESCE(p_gender, gender),
      marital_status = COALESCE(p_marital_status, marital_status),
      nationality = COALESCE(p_nationality, nationality),
      children_count = COALESCE(p_children_count, children_count),
      updated_at = now()
  WHERE id = v_card.id
  RETURNING * INTO v_updated;

  INSERT INTO public.transactions (card_id, type, credit_change, scanned_by, marketplace_id)
  VALUES (v_card.id, 'CheckIn', 0, auth.uid(), v_updated.marketplace_id);

  RETURN json_build_object(
    'id', v_updated.id,
    'unique_id', v_updated.unique_id,
    'credit_balance', v_updated.credit_balance,
    'total_items_collected', v_updated.total_items_collected,
    'marketplace_id', v_updated.marketplace_id
  );
END;
$function$;

-- Checkout: remember the card's marketplace so the CheckOut transaction is tagged.
CREATE OR REPLACE FUNCTION public.checkout_beneficiary_card(p_unique_id text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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

  SELECT * INTO v_card FROM public.qr_cards WHERE lower(unique_id) = lower(v_clean_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Card not found'; END IF;

  IF v_card.status != 'active' THEN
    RAISE EXCEPTION 'Card is not active (status: %). Cannot check out.', v_card.status;
  END IF;

  v_collected := v_card.total_items_collected;
  v_prev_marketplace_id := v_card.marketplace_id;

  -- If somehow NULL, fall back to today's single event so CheckOut isn't orphaned.
  IF v_prev_marketplace_id IS NULL THEN
    SELECT id INTO v_prev_marketplace_id
    FROM public.marketplace_events
    WHERE deleted_at IS NULL
      AND event_date = (now() AT TIME ZONE 'Asia/Dubai')::date
    LIMIT 1;
  END IF;

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