-- Add beneficiary information fields to qr_cards table
ALTER TABLE public.qr_cards
ADD COLUMN gender text,
ADD COLUMN marital_status text,
ADD COLUMN children_count integer DEFAULT 0,
ADD COLUMN nationality text;

-- Add comments for documentation
COMMENT ON COLUMN public.qr_cards.gender IS 'Beneficiary gender: male, female, other';
COMMENT ON COLUMN public.qr_cards.marital_status IS 'Beneficiary marital status: single, married, divorced, widowed';
COMMENT ON COLUMN public.qr_cards.children_count IS 'Number of children';
COMMENT ON COLUMN public.qr_cards.nationality IS 'Beneficiary nationality';