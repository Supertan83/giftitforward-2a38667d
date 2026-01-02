-- Track certificate email delivery time
ALTER TABLE public.pending_volunteers
ADD COLUMN IF NOT EXISTS certificate_sent_at timestamp with time zone;