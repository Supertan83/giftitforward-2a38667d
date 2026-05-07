
CREATE INDEX IF NOT EXISTS idx_qr_cards_lower_unique_id ON public.qr_cards (lower(unique_id));

CREATE OR REPLACE FUNCTION public.activate_beneficiary_card(
  p_unique_id text,
  p_marketplace_id uuid DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_marital_status text DEFAULT NULL,
  p_nationality text DEFAULT NULL,
  p_children_count integer DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card record;
  v_clean_id text;
  v_updated record;
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
      marketplace_id = COALESCE(p_marketplace_id, marketplace_id),
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
$$;
