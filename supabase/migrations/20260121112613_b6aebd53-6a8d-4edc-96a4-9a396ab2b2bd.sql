-- Drop the detailed target/reach columns
ALTER TABLE public.marketplace_events 
DROP COLUMN IF EXISTS demographics_target_families,
DROP COLUMN IF EXISTS demographics_target_adults,
DROP COLUMN IF EXISTS demographics_target_children,
DROP COLUMN IF EXISTS demographics_reach_families,
DROP COLUMN IF EXISTS demographics_reach_adults,
DROP COLUMN IF EXISTS demographics_reach_children;

-- Add simple target and reach columns
ALTER TABLE public.marketplace_events 
ADD COLUMN demographics_target integer DEFAULT 0,
ADD COLUMN demographics_reach integer DEFAULT 0;