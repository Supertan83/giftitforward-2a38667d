
ALTER TABLE public.survey_questions ADD COLUMN question_text_ar text;
ALTER TABLE public.survey_questions ADD COLUMN options_ar jsonb DEFAULT '[]'::jsonb;
