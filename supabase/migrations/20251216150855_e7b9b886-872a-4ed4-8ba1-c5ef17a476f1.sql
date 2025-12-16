-- Create marketplace_events table
CREATE TABLE public.marketplace_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  event_date DATE,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketplace_events ENABLE ROW LEVEL SECURITY;

-- Admins can manage marketplace events
CREATE POLICY "Admins can manage marketplace events"
ON public.marketplace_events
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Staff can view marketplace events
CREATE POLICY "Staff can view marketplace events"
ON public.marketplace_events
FOR SELECT
USING (is_staff(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_marketplace_events_updated_at
BEFORE UPDATE ON public.marketplace_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();