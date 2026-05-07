CREATE INDEX IF NOT EXISTS idx_transactions_marketplace_type_timestamp
  ON public.transactions (marketplace_id, type, "timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_card_id
  ON public.transactions (card_id);

CREATE INDEX IF NOT EXISTS idx_transactions_timestamp
  ON public.transactions ("timestamp" DESC);