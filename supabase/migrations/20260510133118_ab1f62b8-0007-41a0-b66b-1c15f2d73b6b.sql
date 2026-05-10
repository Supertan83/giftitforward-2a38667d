CREATE TABLE public.marketplace_volunteer_exclusions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  marketplace_id uuid NOT NULL,
  volunteer_id uuid NOT NULL,
  dependent_name text NULL,
  excluded_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE INDEX idx_mve_marketplace ON public.marketplace_volunteer_exclusions(marketplace_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uniq_mve_active ON public.marketplace_volunteer_exclusions(marketplace_id, volunteer_id, COALESCE(dependent_name, '')) WHERE deleted_at IS NULL;

ALTER TABLE public.marketplace_volunteer_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage marketplace volunteer exclusions"
  ON public.marketplace_volunteer_exclusions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff view marketplace volunteer exclusions"
  ON public.marketplace_volunteer_exclusions
  FOR SELECT
  USING (is_staff(auth.uid()));

CREATE POLICY "Staff insert marketplace volunteer exclusions"
  ON public.marketplace_volunteer_exclusions
  FOR INSERT
  WITH CHECK (is_staff(auth.uid()));