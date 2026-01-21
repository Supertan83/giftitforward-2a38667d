-- Add target values (pre-event planning)
ALTER TABLE public.marketplace_events 
ADD COLUMN demographics_target_families integer DEFAULT 0,
ADD COLUMN demographics_target_adults integer DEFAULT 0,
ADD COLUMN demographics_target_children integer DEFAULT 0;

-- Add reach values (post-event actual)
ALTER TABLE public.marketplace_events 
ADD COLUMN demographics_reach_families integer DEFAULT 0,
ADD COLUMN demographics_reach_adults integer DEFAULT 0,
ADD COLUMN demographics_reach_children integer DEFAULT 0;