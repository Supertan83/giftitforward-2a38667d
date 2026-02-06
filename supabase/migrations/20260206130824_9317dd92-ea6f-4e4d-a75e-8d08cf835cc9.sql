
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  greeting TEXT NOT NULL DEFAULT '',
  body_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  cta_text TEXT,
  cta_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email templates"
ON public.email_templates FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view email templates"
ON public.email_templates FOR SELECT
USING (is_staff(auth.uid()));

CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
