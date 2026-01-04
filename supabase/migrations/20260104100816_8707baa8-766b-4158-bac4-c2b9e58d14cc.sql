-- Secure RPCs for volunteers/staff to update distribution counters without granting broad UPDATE rights

CREATE OR REPLACE FUNCTION public.increment_marketplace_allocation_distributed(_allocation_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF a.distributed_quantity >= a.allocated_quantity THEN
    RAISE EXCEPTION 'Item allocation exhausted for this marketplace';
  END IF;

  UPDATE public.marketplace_item_allocations
  SET distributed_quantity = a.distributed_quantity + 1,
      updated_at = now()
  WHERE id = _allocation_id;

  RETURN a.distributed_quantity + 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_marketplace_allocation_distributed(_allocation_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF a.distributed_quantity <= 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.marketplace_item_allocations
  SET distributed_quantity = a.distributed_quantity - 1,
      updated_at = now()
  WHERE id = _allocation_id;

  RETURN a.distributed_quantity - 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_marketplace_allocation_distributed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_marketplace_allocation_distributed(uuid) TO authenticated;
