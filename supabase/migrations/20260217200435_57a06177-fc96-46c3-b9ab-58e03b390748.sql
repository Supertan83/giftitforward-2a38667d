
-- 1. Update distribute_marketplace_item: remove allocation ceiling check, find ANY allocation for marketplace
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

  -- Get credit limit from marketplace (per-beneficiary limit still enforced)
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

  -- Find ANY allocation for this marketplace and increment (no ceiling check)
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

-- 2. Update increment_marketplace_allocation_distributed: remove ceiling check
CREATE OR REPLACE FUNCTION public.increment_marketplace_allocation_distributed(_allocation_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  a record;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT allocated_quantity, distributed_quantity
    INTO a
  FROM public.marketplace_item_allocations
  WHERE id = _allocation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Allocation not found';
  END IF;

  -- No ceiling check — just increment for tracking
  UPDATE public.marketplace_item_allocations
  SET distributed_quantity = a.distributed_quantity + 1,
      updated_at = now()
  WHERE id = _allocation_id;

  RETURN a.distributed_quantity + 1;
END;
$function$;
