
-- Add answers JSONB column to volunteer_surveys
ALTER TABLE public.volunteer_surveys
  ADD COLUMN IF NOT EXISTS answers jsonb DEFAULT '{}'::jsonb;
