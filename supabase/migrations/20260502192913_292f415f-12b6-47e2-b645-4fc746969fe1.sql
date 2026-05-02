UPDATE public.qr_cards
SET status = 'inactive',
    credit_balance = 0,
    total_items_collected = 0,
    collected_items = '[]'::jsonb,
    marketplace_id = NULL,
    activated_at = NULL,
    updated_at = now()
WHERE deleted_at IS NULL
  AND (status IN ('active','checked_out') OR marketplace_id IS NOT NULL);

UPDATE public.marketplace_events
SET status = 'completed', updated_at = now()
WHERE id IN ('27cad0fe-2274-484e-ab36-92261a62287b','48b99c84-d110-499b-9cb9-abbea0f19e99');