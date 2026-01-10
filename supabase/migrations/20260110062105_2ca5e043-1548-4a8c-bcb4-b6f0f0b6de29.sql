-- Create table to store HubSpot email configuration
CREATE TABLE public.hubspot_email_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_type TEXT NOT NULL UNIQUE,
  template_id TEXT,
  enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hubspot_email_config ENABLE ROW LEVEL SECURITY;

-- Only admins can view/edit
CREATE POLICY "Admins can view hubspot config" 
ON public.hubspot_email_config 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update hubspot config" 
ON public.hubspot_email_config 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert hubspot config" 
ON public.hubspot_email_config 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default email types
INSERT INTO public.hubspot_email_config (email_type, template_id, enabled) VALUES
  ('welcome', NULL, false),
  ('survey', NULL, false),
  ('training', NULL, false),
  ('certificate', NULL, false);

-- Add trigger for updated_at
CREATE TRIGGER update_hubspot_email_config_updated_at
BEFORE UPDATE ON public.hubspot_email_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();