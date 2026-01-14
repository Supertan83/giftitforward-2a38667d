-- Add resend_sender column to email_provider_config table
ALTER TABLE public.email_provider_config 
ADD COLUMN resend_sender TEXT DEFAULT 'mgif' CHECK (resend_sender IN ('mgif', 'dubaiholding'));