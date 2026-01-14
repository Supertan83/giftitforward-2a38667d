-- Create email provider configuration table
CREATE TABLE public.email_provider_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_type TEXT NOT NULL UNIQUE,
  primary_provider TEXT NOT NULL DEFAULT 'microsoft_graph',
  fallback_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_provider CHECK (primary_provider IN ('microsoft_graph', 'hubspot', 'resend'))
);

-- Enable RLS
ALTER TABLE public.email_provider_config ENABLE ROW LEVEL SECURITY;

-- Allow admins to read config
CREATE POLICY "Admins can view email provider config"
ON public.email_provider_config
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update config
CREATE POLICY "Admins can update email provider config"
ON public.email_provider_config
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to insert config
CREATE POLICY "Admins can insert email provider config"
ON public.email_provider_config
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_email_provider_config_updated_at
BEFORE UPDATE ON public.email_provider_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default configuration for welcome emails
INSERT INTO public.email_provider_config (email_type, primary_provider, fallback_enabled)
VALUES 
  ('welcome', 'microsoft_graph', true),
  ('survey', 'resend', true),
  ('certificate', 'resend', true),
  ('training', 'resend', true);