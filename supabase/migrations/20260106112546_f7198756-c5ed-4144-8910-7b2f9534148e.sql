-- Create enum for volunteer zone assignments
CREATE TYPE public.volunteer_zone AS ENUM ('entrance', 'marketplace', 'exit');

-- Add assigned_zone column to volunteer_qr_cards
ALTER TABLE public.volunteer_qr_cards 
ADD COLUMN assigned_zone volunteer_zone NULL;

-- Add a comment for documentation
COMMENT ON COLUMN public.volunteer_qr_cards.assigned_zone IS 'Zone assigned to volunteer by employee during check-in';