-- Create pending_volunteers table for webhook-received volunteer applications
CREATE TABLE public.pending_volunteers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_event_id UUID REFERENCES public.webhook_events(id),
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone_number TEXT,
  gender TEXT,
  is_employee BOOLEAN DEFAULT false,
  employee_vertical TEXT,
  employee_join_date TEXT,
  employee_number TEXT,
  external_company TEXT,
  has_medical_condition BOOLEAN DEFAULT false,
  medical_condition_details TEXT,
  emergency_contact_name TEXT,
  emergency_contact_relationship TEXT,
  emergency_contact_number TEXT,
  is_fasting BOOLEAN DEFAULT false,
  events_list TEXT,
  events_json JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_user_id UUID,
  temp_password TEXT,
  source_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pending_volunteers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage pending volunteers"
ON public.pending_volunteers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view pending volunteers"
ON public.pending_volunteers
FOR SELECT
USING (is_staff(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_pending_volunteers_updated_at
BEFORE UPDATE ON public.pending_volunteers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_pending_volunteers_status ON public.pending_volunteers(status);
CREATE INDEX idx_pending_volunteers_email ON public.pending_volunteers(email);