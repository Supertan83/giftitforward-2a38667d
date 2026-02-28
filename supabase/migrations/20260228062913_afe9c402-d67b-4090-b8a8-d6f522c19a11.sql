
-- Add scanned_by and marketplace_id to transactions
ALTER TABLE public.transactions ADD COLUMN scanned_by uuid;
ALTER TABLE public.transactions ADD COLUMN marketplace_id uuid;

-- Update distribute_marketplace_item
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

  INSERT INTO public.transactions (card_id, type, item_type, credit_change, scanned_by, marketplace_id)
  VALUES (v_card.id, 'Distribution', 'Item', 1, auth.uid(), p_marketplace_id);

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

-- Update distribute_marketplace_items_batch
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
    RAISE EXCEPTION 'LIMIT: Selected quantity (%) exceeds remaining credits (%). Maximum: %.', 
      p_quantity, v_limit - v_card.credit_balance, v_limit;
  END IF;

  v_new_balance := v_card.credit_balance + p_quantity;

  UPDATE public.qr_cards
  SET credit_balance = v_new_balance,
      total_items_collected = total_items_collected + p_quantity,
      marketplace_id = p_marketplace_id,
      updated_at = now()
  WHERE id = v_card.id;

  INSERT INTO public.transactions (card_id, type, item_type, credit_change, scanned_by, marketplace_id)
  SELECT v_card.id, 'Distribution', 'Item', 1, auth.uid(), p_marketplace_id
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

-- Update return_marketplace_item
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

  INSERT INTO public.transactions (card_id, type, item_type, credit_change, scanned_by, marketplace_id)
  VALUES (v_card.id, 'Return', 'Item', -1, auth.uid(), p_marketplace_id);

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

-- Update return_marketplace_items_batch
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

  INSERT INTO public.transactions (card_id, type, item_type, credit_change, scanned_by, marketplace_id)
  SELECT v_card.id, 'Return', 'Item', -1, auth.uid(), p_marketplace_id
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

-- Update admin_adjust_card_balance
CREATE OR REPLACE FUNCTION public.admin_adjust_card_balance(p_card_id uuid, p_new_items_collected integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_card record;
  v_marketplace record;
  v_prev_items integer;
  v_prev_balance integer;
  v_credit_limit integer;
  v_delta integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized: admin role required';
  END IF;

  SELECT * INTO v_card FROM public.qr_cards WHERE id = p_card_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card not found';
  END IF;

  SELECT beneficiary_credit_limit INTO v_credit_limit
  FROM public.marketplace_events
  WHERE id = v_card.marketplace_id;

  IF NOT FOUND THEN
    v_credit_limit := 15;
  END IF;

  IF p_new_items_collected < 0 OR p_new_items_collected > v_credit_limit THEN
    RAISE EXCEPTION 'Invalid value: must be between 0 and %', v_credit_limit;
  END IF;

  v_prev_items := v_card.total_items_collected;
  v_prev_balance := v_card.credit_balance;
  v_delta := p_new_items_collected - v_prev_items;

  UPDATE public.qr_cards
  SET credit_balance = p_new_items_collected,
      total_items_collected = p_new_items_collected,
      updated_at = now()
  WHERE id = p_card_id;

  INSERT INTO public.transactions (card_id, type, item_type, credit_change, scanned_by, marketplace_id)
  VALUES (p_card_id, 'Adjustment', 'Admin Adjustment', v_delta, auth.uid(), v_card.marketplace_id);

  RETURN json_build_object(
    'previous_items', v_prev_items,
    'new_items', p_new_items_collected,
    'previous_balance', v_prev_balance,
    'new_balance', p_new_items_collected,
    'credit_limit', v_credit_limit,
    'delta', v_delta
  );
END;
$function$;
