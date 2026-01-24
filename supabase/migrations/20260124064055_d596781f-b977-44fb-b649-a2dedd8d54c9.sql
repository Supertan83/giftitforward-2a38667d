-- Add source column to identify how volunteers were added
ALTER TABLE public.pending_volunteers 
ADD COLUMN IF NOT EXISTS source text DEFAULT 'webhook';

-- Add comment for clarity
COMMENT ON COLUMN public.pending_volunteers.source IS 'Source of volunteer record: webhook, bulk_upload, or manual';