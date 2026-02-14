
CREATE TABLE public.external_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace_id uuid NOT NULL,
  volunteer_name text NOT NULL,
  volunteer_email text NOT NULL,
  company_name text,
  experience_word text,
  would_volunteer_again boolean,
  improvement_suggestions text,
  certificate_sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.external_survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit external survey"
  ON public.external_survey_responses FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Staff can view external survey responses"
  ON public.external_survey_responses FOR SELECT
  USING (is_staff(auth.uid()));

CREATE POLICY "Admins can manage external survey responses"
  ON public.external_survey_responses FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
