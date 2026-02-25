
-- Add TRIM() to distribute_marketplace_item
CREATE OR REPLACE FUNCTION public.distribute_marketplace_item(p_unique_id text, p_marketplace_id uuid)
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
  v_clean_id text;
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
    RAISE EXCEPTION 'Card is not active. Please check in first.';
  END IF;

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

  UPDATE public.qr_cards
  SET credit_balance = v_new_balance,
      total_items_collected = total_items_collected + 1,
      marketplace_id = p_marketplace_id,
      updated_at = now()
  WHERE id = v_card.id;

  INSERT INTO public.transactions (card_id, type, item_type, credit_change)
  VALUES (v_card.id, 'Distribution', 'Item', 1);

  SELECT * INTO v_alloc
  FROM public.marketplace_item_allocations
  WHERE marketplace_id = p_marketplace_id
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
$function$;

-- Add TRIM() to distribute_marketplace_items_batch
CREATE OR REPLACE FUNCTION public.distribute_marketplace_items_batch(p_unique_id text, p_marketplace_id uuid, p_quantity integer)
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
  v_clean_id text;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_quantity < 1 OR p_quantity > 50 THEN
    RAISE EXCEPTION 'Invalid quantity: must be between 1 and 50';
  END IF;

  v_clean_id := TRIM(p_unique_id);

  SELECT * INTO v_card
  FROM public.qr_cards
  WHERE lower(unique_id) = lower(v_clean_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card not found';
  END IF;

  IF v_card.status != 'active' THEN
    RAISE EXCEPTION 'Card is not active. Please check in first.';
  END IF;

  SELECT beneficiary_credit_limit INTO v_limit
  FROM public.marketplace_events
  WHERE id = p_marketplace_id;

  IF NOT FOUND THEN
    v_limit := 15;
  END IF;

  IF v_card.credit_balance + p_quantity > v_limit THEN
    RAISE EXCEPTION 'LIMIT REACHED. Would exceed maximum (% + % > %).', v_card.credit_balance, p_quantity, v_limit;
  END IF;

  v_new_balance := v_card.credit_balance + p_quantity;

  UPDATE public.qr_cards
  SET credit_balance = v_new_balance,
      total_items_collected = total_items_collected + p_quantity,
      marketplace_id = p_marketplace_id,
      updated_at = now()
  WHERE id = v_card.id;

  INSERT INTO public.transactions (card_id, type, item_type, credit_change)
  SELECT v_card.id, 'Distribution', 'Item', 1
  FROM generate_series(1, p_quantity);

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

-- Add TRIM() to return_marketplace_item
CREATE OR REPLACE FUNCTION public.return_marketplace_item(p_unique_id text, p_marketplace_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_card record;
  v_alloc record;
  v_new_balance integer;
  v_clean_id text;
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
    RAISE EXCEPTION 'Card is not active';
  END IF;

  IF v_card.credit_balance <= 0 THEN
    RAISE EXCEPTION 'No items to return';
  END IF;

  v_new_balance := v_card.credit_balance - 1;

  UPDATE public.qr_cards
  SET credit_balance = v_new_balance,
      total_items_collected = GREATEST(total_items_collected - 1, 0),
      updated_at = now()
  WHERE id = v_card.id;

  INSERT INTO public.transactions (card_id, type, item_type, credit_change)
  VALUES (v_card.id, 'Return', 'Item', -1);

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
$function$;

-- Add TRIM() to return_marketplace_items_batch
CREATE OR REPLACE FUNCTION public.return_marketplace_items_batch(p_unique_id text, p_marketplace_id uuid, p_quantity integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_card record;
  v_alloc record;
  v_new_balance integer;
  v_clean_id text;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_quantity < 1 OR p_quantity > 50 THEN
    RAISE EXCEPTION 'Invalid quantity: must be between 1 and 50';
  END IF;

  v_clean_id := TRIM(p_unique_id);

  SELECT * INTO v_card
  FROM public.qr_cards
  WHERE lower(unique_id) = lower(v_clean_id);

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

  UPDATE public.qr_cards
  SET credit_balance = v_new_balance,
      total_items_collected = GREATEST(total_items_collected - p_quantity, 0),
      updated_at = now()
  WHERE id = v_card.id;

  INSERT INTO public.transactions (card_id, type, item_type, credit_change)
  SELECT v_card.id, 'Return', 'Item', -1
  FROM generate_series(1, p_quantity);

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
