
-- Create email_automations table
CREATE TABLE public.email_automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  template_id UUID NOT NULL REFERENCES public.email_templates(id),
  trigger_type TEXT NOT NULL,
  trigger_days INTEGER NOT NULL DEFAULT 0,
  trigger_time TIME NOT NULL DEFAULT '09:00',
  recipient_filter JSONB NOT NULL DEFAULT '{"type": "all_upcoming"}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create email_automation_logs table
CREATE TABLE public.email_automation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id UUID NOT NULL REFERENCES public.email_automations(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.email_campaigns(id),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipients_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success',
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.email_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_automation_logs ENABLE ROW LEVEL SECURITY;

-- RLS for email_automations
CREATE POLICY "Admins can manage email automations"
ON public.email_automations FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view email automations"
ON public.email_automations FOR SELECT
USING (is_staff(auth.uid()));

-- RLS for email_automation_logs
CREATE POLICY "Admins can manage email automation logs"
ON public.email_automation_logs FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view email automation logs"
ON public.email_automation_logs FOR SELECT
USING (is_staff(auth.uid()));

-- Trigger for updated_at on email_automations
CREATE TRIGGER update_email_automations_updated_at
BEFORE UPDATE ON public.email_automations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
