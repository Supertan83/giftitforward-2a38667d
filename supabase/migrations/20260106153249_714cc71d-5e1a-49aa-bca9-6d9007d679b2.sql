-- Create table for tracking distribution reports sent to Surpluss API
CREATE TABLE IF NOT EXISTS public.surpluss_distribution_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  allocation_id BIGINT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'staging',
  marketplace_external_id BIGINT,
  distributed_total INTEGER NOT NULL DEFAULT 0,
  allocated_total INTEGER NOT NULL DEFAULT 0,
  api_response_status INTEGER,
  api_response_body JSONB,
  reported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.surpluss_distribution_reports ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can view distribution reports"
ON public.surpluss_distribution_reports
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert distribution reports"
ON public.surpluss_distribution_reports
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update distribution reports"
ON public.surpluss_distribution_reports
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete distribution reports"
ON public.surpluss_distribution_reports
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_surpluss_distribution_reports_allocation_env 
ON public.surpluss_distribution_reports(allocation_id, environment);

-- Create trigger for updated_at
CREATE TRIGGER update_surpluss_distribution_reports_updated_at
BEFORE UPDATE ON public.surpluss_distribution_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();