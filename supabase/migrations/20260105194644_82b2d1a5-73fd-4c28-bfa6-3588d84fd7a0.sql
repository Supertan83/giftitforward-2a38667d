-- Add external_id column to marketplace_events for mapping external company IDs
ALTER TABLE public.marketplace_events 
ADD COLUMN IF NOT EXISTS external_id INTEGER;

-- Add external_material_id column to item_types for mapping external material IDs
ALTER TABLE public.item_types 
ADD COLUMN IF NOT EXISTS external_material_id INTEGER;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_marketplace_events_external_id ON public.marketplace_events(external_id);
CREATE INDEX IF NOT EXISTS idx_item_types_external_material_id ON public.item_types(external_material_id);