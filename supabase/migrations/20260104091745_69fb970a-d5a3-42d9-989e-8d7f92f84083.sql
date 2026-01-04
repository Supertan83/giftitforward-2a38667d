-- Create table to track item allocations per marketplace event
CREATE TABLE public.marketplace_item_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  marketplace_id UUID NOT NULL REFERENCES public.marketplace_events(id) ON DELETE CASCADE,
  item_type_id UUID NOT NULL REFERENCES public.item_types(id) ON DELETE CASCADE,
  allocated_quantity INTEGER NOT NULL DEFAULT 0,
  distributed_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(marketplace_id, item_type_id)
);

-- Enable RLS
ALTER TABLE public.marketplace_item_allocations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage marketplace allocations"
  ON public.marketplace_item_allocations
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view marketplace allocations"
  ON public.marketplace_item_allocations
  FOR SELECT
  USING (is_staff(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_marketplace_item_allocations_updated_at
  BEFORE UPDATE ON public.marketplace_item_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_item_allocations;