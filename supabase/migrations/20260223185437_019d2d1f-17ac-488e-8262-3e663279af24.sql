
-- Batch distribute: distributes N items to a beneficiary in one atomic operation
CREATE OR REPLACE FUNCTION public.distribute_marketplace_items_batch(
  p_unique_id text,
  p_marketplace_id uuid,
  p_quantity integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Validate quantity
  IF p_quantity < 1 OR p_quantity > 50 THEN
    RAISE EXCEPTION 'Invalid quantity: must be between 1 and 50';
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

  -- Check if quantity would exceed limit
  IF v_card.credit_balance + p_quantity > v_limit THEN
    RAISE EXCEPTION 'LIMIT REACHED. Would exceed maximum (% + % > %).', v_card.credit_balance, p_quantity, v_limit;
  END IF;

  v_new_balance := v_card.credit_balance + p_quantity;

  -- Update card balance
  UPDATE public.qr_cards
  SET credit_balance = v_new_balance,
      total_items_collected = total_items_collected + p_quantity,
      marketplace_id = p_marketplace_id,
      updated_at = now()
  WHERE id = v_card.id;

  -- Insert individual transaction records for reporting accuracy
  INSERT INTO public.transactions (card_id, type, item_type, credit_change)
  SELECT v_card.id, 'Distribution', 'Item', 1
  FROM generate_series(1, p_quantity);

  -- Update allocation distributed count
  SELECT * INTO v_alloc
  FROM public.marketplace_item_allocations
  WHERE marketplace_id = p_marketplace_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.marketplace_item_allocations
    SET distributed_quantity = distributed_quantity + p_quantity,
        updated_at = now()
    WHERE id = v_alloc.id;
  END IF;

  RETURN json_build_object('creditBalance', v_new_balance, 'cardId', v_card.id, 'quantity', p_quantity);
END;
$function$;

-- Batch return: returns N items from a beneficiary in one atomic operation
CREATE OR REPLACE FUNCTION public.return_marketplace_items_batch(
  p_unique_id text,
  p_marketplace_id uuid,
  p_quantity integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_card record;
  v_alloc record;
  v_new_balance integer;
BEGIN
  -- Auth check
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Validate quantity
  IF p_quantity < 1 OR p_quantity > 50 THEN
    RAISE EXCEPTION 'Invalid quantity: must be between 1 and 50';
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

  IF v_card.credit_balance < p_quantity THEN
    RAISE EXCEPTION 'Not enough items to return (has %, trying to return %).', v_card.credit_balance, p_quantity;
  END IF;

  v_new_balance := v_card.credit_balance - p_quantity;

  -- Update card balance
  UPDATE public.qr_cards
  SET credit_balance = v_new_balance,
      total_items_collected = GREATEST(total_items_collected - p_quantity, 0),
      updated_at = now()
  WHERE id = v_card.id;

  -- Insert individual transaction records
  INSERT INTO public.transactions (card_id, type, item_type, credit_change)
  SELECT v_card.id, 'Return', 'Item', -1
  FROM generate_series(1, p_quantity);

  -- Decrement allocation distributed count
  SELECT * INTO v_alloc
  FROM public.marketplace_item_allocations
  WHERE marketplace_id = p_marketplace_id
    AND distributed_quantity > 0
  ORDER BY created_at ASC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.marketplace_item_allocations
    SET distributed_quantity = GREATEST(distributed_quantity - p_quantity, 0),
        updated_at = now()
    WHERE id = v_alloc.id;
  END IF;

  RETURN json_build_object('creditBalance', v_new_balance, 'cardId', v_card.id, 'quantity', p_quantity);
END;
$function$;
