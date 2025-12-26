-- Add email tracking columns to pending_volunteers
ALTER TABLE public.pending_volunteers
ADD COLUMN IF NOT EXISTS email_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS email_sent_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS email_send_count integer DEFAULT 0;