-- Create volunteer surveys table to store survey responses
CREATE TABLE public.volunteer_surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  volunteer_id UUID REFERENCES public.pending_volunteers(id) ON DELETE SET NULL,
  volunteer_card_id UUID REFERENCES public.volunteer_qr_cards(id) ON DELETE SET NULL,
  marketplace_id UUID REFERENCES public.marketplace_events(id) ON DELETE SET NULL,
  volunteer_email TEXT NOT NULL,
  volunteer_name TEXT NOT NULL,
  experience_word TEXT,
  would_volunteer_again BOOLEAN,
  improvement_suggestions TEXT,
  certificate_sent_at TIMESTAMP WITH TIME ZONE,
  survey_token TEXT UNIQUE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add survey tracking to volunteer_qr_cards
ALTER TABLE public.volunteer_qr_cards
ADD COLUMN IF NOT EXISTS survey_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS survey_completed_at TIMESTAMP WITH TIME ZONE;

-- Enable Row Level Security
ALTER TABLE public.volunteer_surveys ENABLE ROW LEVEL SECURITY;

-- RLS policies for volunteer_surveys
CREATE POLICY "Staff can manage volunteer surveys"
ON public.volunteer_surveys
FOR ALL
USING (is_staff(auth.uid()));

CREATE POLICY "Anyone can view survey by token"
ON public.volunteer_surveys
FOR SELECT
USING (true);

CREATE POLICY "Anyone can update survey by token"
ON public.volunteer_surveys
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_volunteer_surveys_updated_at
BEFORE UPDATE ON public.volunteer_surveys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();