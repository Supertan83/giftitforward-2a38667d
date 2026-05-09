CREATE OR REPLACE FUNCTION public.get_marketplace_kiosk_stats(p_marketplace_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dubai_start timestamptz;
  v_active int;
  v_ready int;
  v_today_checkins int;
  v_checked_out int;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_dubai_start := (date_trunc('day', (now() AT TIME ZONE 'Asia/Dubai')) AT TIME ZONE 'Asia/Dubai');

  SELECT COUNT(*) INTO v_active
  FROM public.qr_cards
  WHERE marketplace_id = p_marketplace_id AND status = 'active';

  SELECT COUNT(*) INTO v_ready
  FROM public.qr_cards
  WHERE status = 'inactive';

  SELECT COUNT(*) INTO v_today_checkins
  FROM public.transactions
  WHERE type = 'CheckIn'
    AND marketplace_id = p_marketplace_id
    AND timestamp >= v_dubai_start;

  SELECT COUNT(*) INTO v_checked_out
  FROM public.transactions
  WHERE type = 'CheckOut'
    AND marketplace_id = p_marketplace_id
    AND timestamp >= v_dubai_start;

  RETURN json_build_object(
    'active', v_active,
    'ready', v_ready,
    'today_check_ins', v_today_checkins,
    'checked_out', v_checked_out
  );
END;
$$;