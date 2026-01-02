-- Add training completion tracking columns to pending_volunteers
ALTER TABLE public.pending_volunteers 
ADD COLUMN IF NOT EXISTS training_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS training_completed_at timestamp with time zone;