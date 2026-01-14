-- Add time fields to marketplace_events table
ALTER TABLE public.marketplace_events
ADD COLUMN start_time TIME,
ADD COLUMN end_time TIME;