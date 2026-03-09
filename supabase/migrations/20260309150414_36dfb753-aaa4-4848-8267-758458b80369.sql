
CREATE TABLE public.pending_beneficiaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unique_id text,
  qr_id text,
  gender text,
  nationality text,
  marital_status text,
  children_count integer DEFAULT 0,
  items_collected integer DEFAULT 0,
  marketplace_event_id uuid REFERENCES public.marketplace_events(id),
  marketplace_id uuid,
  beneficiary_type_id integer,
  age_0_17_count integer DEFAULT 0,
  age_18_30_count integer DEFAULT 0,
  age_31_40_count integer DEFAULT 0,
  age_41_50_count integer DEFAULT 0,
  age_51_60_count integer DEFAULT 0,
  age_61_plus_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_beneficiaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage pending beneficiaries"
  ON public.pending_beneficiaries FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view pending beneficiaries"
  ON public.pending_beneficiaries FOR SELECT
  USING (public.is_staff(auth.uid()));

CREATE TRIGGER update_pending_beneficiaries_updated_at
  BEFORE UPDATE ON public.pending_beneficiaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
