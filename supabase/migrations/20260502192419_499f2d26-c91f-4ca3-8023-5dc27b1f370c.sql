UPDATE public.qr_cards
SET status = 'inactive',
    credit_balance = 0,
    total_items_collected = 0,
    collected_items = '[]'::jsonb,
    marketplace_id = NULL,
    activated_at = NULL,
    updated_at = now()
WHERE deleted_at IS NULL
  AND status = 'active'
  AND marketplace_id = '27cad0fe-2274-484e-ab36-92261a62287b';