ALTER TABLE public.marketplace_item_allocations
  ADD COLUMN IF NOT EXISTS original_allocated_quantity integer,
  ADD COLUMN IF NOT EXISTS original_allocated_synced_at timestamptz;

COMMENT ON COLUMN public.marketplace_item_allocations.original_allocated_quantity IS 'Snapshot of the originally pledged quantity from Surpluss at first sync. Never updated after insert. Preserves audit trail before Surpluss reconciles allocation = distributed at end of event.';
COMMENT ON COLUMN public.marketplace_item_allocations.original_allocated_synced_at IS 'Timestamp when original_allocated_quantity was first captured.';