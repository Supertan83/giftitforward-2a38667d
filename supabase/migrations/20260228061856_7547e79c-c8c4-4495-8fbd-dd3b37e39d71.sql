
-- Add 'Adjustment' to the transaction_type enum
ALTER TYPE transaction_type ADD VALUE 'Adjustment';

-- Create admin_adjust_card_balance RPC
CREATE OR REPLACE FUNCTION public.admin_adjust_card_balance(
  p_card_id uuid,
  p_new_items_collected integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_card record;
  v_marketplace record;
  v_prev_items integer;
  v_prev_balance integer;
  v_credit_limit integer;
  v_delta integer;
BEGIN
  -- Validate admin role
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized: admin role required';
  END IF;

  -- Look up the card
  SELECT * INTO v_card FROM public.qr_cards WHERE id = p_card_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card not found';
  END IF;

  -- Get credit limit from marketplace
  SELECT beneficiary_credit_limit INTO v_credit_limit
  FROM public.marketplace_events
  WHERE id = v_card.marketplace_id;

  IF NOT FOUND THEN
    v_credit_limit := 15;
  END IF;

  -- Validate new value
  IF p_new_items_collected < 0 OR p_new_items_collected > v_credit_limit THEN
    RAISE EXCEPTION 'Invalid value: must be between 0 and %', v_credit_limit;
  END IF;

  v_prev_items := v_card.total_items_collected;
  v_prev_balance := v_card.credit_balance;
  v_delta := p_new_items_collected - v_prev_items;

  -- Update card
  UPDATE public.qr_cards
  SET credit_balance = p_new_items_collected,
      total_items_collected = p_new_items_collected,
      updated_at = now()
  WHERE id = p_card_id;

  -- Insert audit transaction
  INSERT INTO public.transactions (card_id, type, item_type, credit_change)
  VALUES (p_card_id, 'Adjustment', 'Admin Adjustment', v_delta);

  RETURN json_build_object(
    'previous_items', v_prev_items,
    'new_items', p_new_items_collected,
    'previous_balance', v_prev_balance,
    'new_balance', p_new_items_collected,
    'credit_limit', v_credit_limit,
    'delta', v_delta
  );
END;
$$;
