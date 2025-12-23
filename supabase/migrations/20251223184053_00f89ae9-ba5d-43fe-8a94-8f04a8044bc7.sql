-- Create table for storing webhook field mapping templates
CREATE TABLE public.webhook_mapping_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  source_identifier TEXT, -- Optional: to auto-apply to specific partners
  field_mappings JSONB NOT NULL DEFAULT '{}', -- Maps source fields to volunteer fields
  array_path TEXT, -- Path to the array in the payload (e.g., "volunteers_list" or "data.users")
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_mapping_templates ENABLE ROW LEVEL SECURITY;

-- Only admins can manage templates
CREATE POLICY "Admins can manage mapping templates"
ON public.webhook_mapping_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to update updated_at
CREATE TRIGGER update_webhook_mapping_templates_updated_at
BEFORE UPDATE ON public.webhook_mapping_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();