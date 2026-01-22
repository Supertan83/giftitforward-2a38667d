-- Create table to store manual item counts after marketplace events
CREATE TABLE public.marketplace_manual_counts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  marketplace_id UUID NOT NULL REFERENCES public.marketplace_events(id) ON DELETE CASCADE,
  item_type_id UUID NOT NULL REFERENCES public.item_types(id) ON DELETE CASCADE,
  allocation_id UUID REFERENCES public.marketplace_item_allocations(id) ON DELETE SET NULL,
  actual_distributed INTEGER NOT NULL DEFAULT 0,
  actual_remaining INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  counted_by UUID REFERENCES auth.users(id),
  counted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(marketplace_id, item_type_id)
);

-- Enable RLS
ALTER TABLE public.marketplace_manual_counts ENABLE ROW LEVEL SECURITY;

-- Staff can view all counts
CREATE POLICY "Staff can view manual counts"
ON public.marketplace_manual_counts
FOR SELECT
USING (public.is_staff(auth.uid()));

-- Staff can insert counts
CREATE POLICY "Staff can insert manual counts"
ON public.marketplace_manual_counts
FOR INSERT
WITH CHECK (public.is_staff(auth.uid()));

-- Staff can update counts
CREATE POLICY "Staff can update manual counts"
ON public.marketplace_manual_counts
FOR UPDATE
USING (public.is_staff(auth.uid()));

-- Staff can delete counts
CREATE POLICY "Staff can delete manual counts"
ON public.marketplace_manual_counts
FOR DELETE
USING (public.is_staff(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_marketplace_manual_counts_updated_at
BEFORE UPDATE ON public.marketplace_manual_counts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_manual_counts;