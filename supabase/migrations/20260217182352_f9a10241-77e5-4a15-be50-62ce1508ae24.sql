
-- Atomic distribute: find card, validate, update balance, insert transaction, increment allocation
CREATE OR REPLACE FUNCTION public.distribute_marketplace_item(p_unique_id text, p_marketplace_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_card record;
  v_alloc record;
  v_new_balance integer;
  v_limit integer;
BEGIN
  -- Auth check
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Find card (case-insensitive)
  SELECT * INTO v_card
  FROM public.qr_cards
  WHERE lower(unique_id) = lower(p_unique_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card not found';
  END IF;

  IF v_card.status != 'active' THEN
    RAISE EXCEPTION 'Card is not active. Please check in first.';
  END IF;

  -- Get credit limit from marketplace
  SELECT beneficiary_credit_limit INTO v_limit
  FROM public.marketplace_events
  WHERE id = p_marketplace_id;

  IF NOT FOUND THEN
    v_limit := 15;
  END IF;

  IF v_card.credit_balance >= v_limit THEN
    RAISE EXCEPTION 'LIMIT REACHED (%/%). Maximum items already collected.', v_card.credit_balance, v_limit;
  END IF;

  v_new_balance := v_card.credit_balance + 1;

  -- Update card balance
  UPDATE public.qr_cards
  SET credit_balance = v_new_balance,
      total_items_collected = total_items_collected + 1,
      marketplace_id = p_marketplace_id,
      updated_at = now()
  WHERE id = v_card.id;

  -- Insert transaction
  INSERT INTO public.transactions (card_id, type, item_type, credit_change)
  VALUES (v_card.id, 'Distribution', 'Item', 1);

  -- Find allocation with remaining stock and increment
  SELECT * INTO v_alloc
  FROM public.marketplace_item_allocations
  WHERE marketplace_id = p_marketplace_id
    AND allocated_quantity > distributed_quantity
  ORDER BY created_at ASC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.marketplace_item_allocations
    SET distributed_quantity = distributed_quantity + 1,
        updated_at = now()
    WHERE id = v_alloc.id;
  END IF;

  RETURN json_build_object('creditBalance', v_new_balance, 'cardId', v_card.id);
END;
$$;

-- Atomic return: find card, validate, decrement balance, insert transaction, decrement allocation
CREATE OR REPLACE FUNCTION public.return_marketplace_item(p_unique_id text, p_marketplace_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_card record;
  v_alloc record;
  v_new_balance integer;
BEGIN
  -- Auth check
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Find card (case-insensitive)
  SELECT * INTO v_card
  FROM public.qr_cards
  WHERE lower(unique_id) = lower(p_unique_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card not found';
  END IF;

  IF v_card.status != 'active' THEN
    RAISE EXCEPTION 'Card is not active';
  END IF;

  IF v_card.credit_balance <= 0 THEN
    RAISE EXCEPTION 'No items to return';
  END IF;

  v_new_balance := v_card.credit_balance - 1;

  -- Update card balance
  UPDATE public.qr_cards
  SET credit_balance = v_new_balance,
      total_items_collected = GREATEST(total_items_collected - 1, 0),
      updated_at = now()
  WHERE id = v_card.id;

  -- Insert transaction
  INSERT INTO public.transactions (card_id, type, item_type, credit_change)
  VALUES (v_card.id, 'Return', 'Item', -1);

  -- Find allocation with distributed items and decrement
  SELECT * INTO v_alloc
  FROM public.marketplace_item_allocations
  WHERE marketplace_id = p_marketplace_id
    AND distributed_quantity > 0
  ORDER BY created_at ASC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.marketplace_item_allocations
    SET distributed_quantity = distributed_quantity - 1,
        updated_at = now()
    WHERE id = v_alloc.id;
  END IF;

  RETURN json_build_object('creditBalance', v_new_balance, 'cardId', v_card.id);
END;
$$;
