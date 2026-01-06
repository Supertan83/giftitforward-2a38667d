-- Add outreach partner field to marketplace_events
ALTER TABLE public.marketplace_events
ADD COLUMN outreach_partner text;

-- Add category field to item_types for item categorization
ALTER TABLE public.item_types
ADD COLUMN category text;

-- Add comment for documentation
COMMENT ON COLUMN public.marketplace_events.outreach_partner IS 'Name of the outreach partner organization for this marketplace event';
COMMENT ON COLUMN public.item_types.category IS 'Category classification for the item type';