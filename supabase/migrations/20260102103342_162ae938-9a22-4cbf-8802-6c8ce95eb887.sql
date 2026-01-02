-- Add marketplace_id and activated_at to qr_cards to track which marketplace the card was used in
ALTER TABLE public.qr_cards
ADD COLUMN IF NOT EXISTS marketplace_id uuid REFERENCES public.marketplace_events(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS activated_at timestamp with time zone;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_qr_cards_marketplace_id ON public.qr_cards(marketplace_id);
CREATE INDEX IF NOT EXISTS idx_qr_cards_status ON public.qr_cards(status);

-- Create volunteer_qr_cards table for tracking volunteer attendance
CREATE TABLE public.volunteer_qr_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unique_id text NOT NULL UNIQUE,
  volunteer_id uuid REFERENCES public.pending_volunteers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'checked_in', 'checked_out')),
  marketplace_id uuid REFERENCES public.marketplace_events(id) ON DELETE SET NULL,
  checked_in_at timestamp with time zone,
  checked_out_at timestamp with time zone,
  total_hours_worked numeric(5,2) DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on volunteer_qr_cards
ALTER TABLE public.volunteer_qr_cards ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for volunteer_qr_cards
CREATE POLICY "Staff can manage volunteer cards"
ON public.volunteer_qr_cards
FOR ALL
USING (is_staff(auth.uid()));

CREATE POLICY "Staff can view volunteer cards"
ON public.volunteer_qr_cards
FOR SELECT
USING (is_staff(auth.uid()));

-- Create updated_at trigger for volunteer_qr_cards
CREATE TRIGGER update_volunteer_qr_cards_updated_at
BEFORE UPDATE ON public.volunteer_qr_cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create volunteer_attendance table to log check-ins/check-outs
CREATE TABLE public.volunteer_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  volunteer_card_id uuid NOT NULL REFERENCES public.volunteer_qr_cards(id) ON DELETE CASCADE,
  marketplace_id uuid REFERENCES public.marketplace_events(id) ON DELETE SET NULL,
  check_in_time timestamp with time zone NOT NULL DEFAULT now(),
  check_out_time timestamp with time zone,
  hours_worked numeric(5,2),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on volunteer_attendance
ALTER TABLE public.volunteer_attendance ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for volunteer_attendance
CREATE POLICY "Staff can manage volunteer attendance"
ON public.volunteer_attendance
FOR ALL
USING (is_staff(auth.uid()));

CREATE POLICY "Staff can view volunteer attendance"
ON public.volunteer_attendance
FOR SELECT
USING (is_staff(auth.uid()));

-- Create archived_card_data table to store synced data before reset
CREATE TABLE public.archived_card_data (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_card_id uuid,
  unique_id text NOT NULL,
  marketplace_id uuid REFERENCES public.marketplace_events(id) ON DELETE SET NULL,
  gender text,
  marital_status text,
  nationality text,
  children_count integer,
  credit_balance integer,
  total_items_collected integer,
  collected_items jsonb,
  activated_at timestamp with time zone,
  checked_out_at timestamp with time zone,
  archived_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on archived_card_data
ALTER TABLE public.archived_card_data ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for archived_card_data
CREATE POLICY "Admins can manage archived data"
ON public.archived_card_data
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view archived data"
ON public.archived_card_data
FOR SELECT
USING (is_staff(auth.uid()));

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.volunteer_qr_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.volunteer_attendance;