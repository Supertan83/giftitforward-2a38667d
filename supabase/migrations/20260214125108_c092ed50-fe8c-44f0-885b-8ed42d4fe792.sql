
-- Create survey_questions table
CREATE TABLE public.survey_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_text text NOT NULL,
  question_type text NOT NULL DEFAULT 'short_text',
  options jsonb DEFAULT '[]'::jsonb,
  is_required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;

-- Admins can manage
CREATE POLICY "Admins can manage survey questions"
  ON public.survey_questions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can read active questions (public survey page)
CREATE POLICY "Anyone can read active survey questions"
  ON public.survey_questions FOR SELECT
  USING (is_active = true);

-- Updated_at trigger
CREATE TRIGGER update_survey_questions_updated_at
  BEFORE UPDATE ON public.survey_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add answers JSONB column to external_survey_responses
ALTER TABLE public.external_survey_responses
  ADD COLUMN answers jsonb DEFAULT '{}'::jsonb;

-- Seed the three existing hardcoded questions
INSERT INTO public.survey_questions (question_text, question_type, options, is_required, sort_order) VALUES
  ('How would you describe your GIF experience in one word?', 'short_text', '[]', true, 1),
  ('Would you volunteer for Gift It Forward again in the future?', 'yes_no', '[]', true, 2),
  ('What could be improved for future volunteer experiences?', 'long_text', '[]', true, 3);
