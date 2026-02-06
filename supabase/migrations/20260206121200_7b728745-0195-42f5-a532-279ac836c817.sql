
CREATE TABLE public.allocation_traceability_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_unique_id text,
  allocation_id uuid,
  item_type_id uuid,
  marketplace_id uuid,
  marketplace_name text NOT NULL,
  action_type text NOT NULL,
  quantity_before integer NOT NULL DEFAULT 0,
  quantity_after integer NOT NULL DEFAULT 0,
  description text NOT NULL,
  performed_by uuid,
  performed_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.allocation_traceability_logs ENABLE ROW LEVEL SECURITY;

-- Admins can manage
CREATE POLICY "Admins can manage traceability logs"
ON public.allocation_traceability_logs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Staff can view
CREATE POLICY "Staff can view traceability logs"
ON public.allocation_traceability_logs
FOR SELECT
USING (is_staff(auth.uid()));

-- Staff can insert (volunteers/staff performing actions need to write logs)
CREATE POLICY "Staff can insert traceability logs"
ON public.allocation_traceability_logs
FOR INSERT
WITH CHECK (is_staff(auth.uid()));

-- Index for common queries
CREATE INDEX idx_traceability_card ON public.allocation_traceability_logs(card_unique_id);
CREATE INDEX idx_traceability_allocation ON public.allocation_traceability_logs(allocation_id);
CREATE INDEX idx_traceability_marketplace ON public.allocation_traceability_logs(marketplace_id);
CREATE INDEX idx_traceability_created ON public.allocation_traceability_logs(created_at DESC);
