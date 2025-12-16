-- Create increment function for distributed items
CREATE OR REPLACE FUNCTION public.increment_item_distributed(item_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.item_types
  SET distributed = distributed + 1
  WHERE id = item_id;
END;
$$;