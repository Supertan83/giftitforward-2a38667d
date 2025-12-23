-- Create table for storing webhook events
CREATE TABLE public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL,
  headers jsonb,
  source_ip text,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  processed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Allow admins to view webhook events
CREATE POLICY "Admins can view webhook events"
ON public.webhook_events
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to manage webhook events
CREATE POLICY "Admins can manage webhook events"
ON public.webhook_events
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_webhook_events_received_at ON public.webhook_events(received_at DESC);