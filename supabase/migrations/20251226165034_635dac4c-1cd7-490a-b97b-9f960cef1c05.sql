-- Add email open tracking columns to pending_volunteers
ALTER TABLE public.pending_volunteers
ADD COLUMN IF NOT EXISTS email_opened boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS email_opened_at timestamp with time zone;