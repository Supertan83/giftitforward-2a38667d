-- Add source_identifier column to webhook_events table
ALTER TABLE public.webhook_events 
ADD COLUMN source_identifier text;

-- Add index for faster filtering by source
CREATE INDEX idx_webhook_events_source_identifier ON public.webhook_events(source_identifier);

-- Add comment for documentation
COMMENT ON COLUMN public.webhook_events.source_identifier IS 'Identifier for the company/source that sent the webhook (e.g., dubai_holdings, supplier_company)';