-- Add request_payload column to store what was sent to Surpluss API
ALTER TABLE public.surpluss_distribution_reports 
ADD COLUMN request_payload jsonb;