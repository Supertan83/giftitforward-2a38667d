-- Add demographics fields to marketplace_events table
-- These are manually entered pre/post event data

ALTER TABLE public.marketplace_events
ADD COLUMN IF NOT EXISTS demographics_total_families integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS demographics_total_adults integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS demographics_total_children integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS demographics_male_adults integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS demographics_female_adults integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS demographics_male_children integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS demographics_female_children integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS demographics_nationalities jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS demographics_notes text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS demographics_updated_at timestamp with time zone DEFAULT NULL;