CREATE OR REPLACE FUNCTION public.checkout_volunteer_card(p_unique_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_card record;
  v_volunteer record;
  v_clean_id text;
  v_now timestamptz;
  v_hours numeric;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_clean_id := TRIM(p_unique_id);
  v_now := now();

  SELECT * INTO v_card
  FROM public.volunteer_qr_cards
  WHERE lower(unique_id) = lower(v_clean_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Volunteer card not found';
  END IF;

  IF v_card.status != 'checked_in' THEN
    RAISE EXCEPTION 'Volunteer not checked in';
  END IF;

  v_hours := EXTRACT(EPOCH FROM (v_now - v_card.checked_in_at)) / 3600.0;

  IF v_hours < (1.0 / 60.0) THEN
    RAISE EXCEPTION 'Cannot check out within 1 minute of check-in. Please wait.';
  END IF;

  UPDATE public.volunteer_qr_cards
  SET status = 'checked_out',
      checked_out_at = v_now,
      total_hours_worked = COALESCE(total_hours_worked, 0) + v_hours,
      updated_at = v_now
  WHERE id = v_card.id;

  UPDATE public.volunteer_attendance
  SET check_out_time = v_now,
      hours_worked = v_hours
  WHERE id = (
    SELECT id FROM public.volunteer_attendance
    WHERE volunteer_card_id = v_card.id
      AND check_out_time IS NULL
    ORDER BY check_in_time DESC
    LIMIT 1
  );

  SELECT id, first_name, last_name, email
  INTO v_volunteer
  FROM public.pending_volunteers
  WHERE id = v_card.volunteer_id;

  RETURN json_build_object(
    'cardId', v_card.id,
    'hoursWorked', round(v_hours::numeric, 2),
    'marketplaceId', v_card.marketplace_id,
    'volunteerId', v_volunteer.id,
    'volunteerName', COALESCE(TRIM(COALESCE(v_volunteer.first_name, '') || ' ' || COALESCE(v_volunteer.last_name, '')), ''),
    'volunteerEmail', v_volunteer.email
  );
END;
$function$;