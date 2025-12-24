-- Create table for partner company registrations
CREATE TABLE public.partner_registrations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    -- Submission metadata
    submission_date TIMESTAMP WITH TIME ZONE,
    ip_address TEXT,
    
    -- Personal info
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone_number TEXT,
    work_email TEXT NOT NULL,
    gender TEXT,
    
    -- Employment info
    is_employee BOOLEAN DEFAULT false,
    employee_vertical TEXT,
    employee_join_date TEXT,
    employee_number TEXT,
    external_company TEXT,
    
    -- Medical & Emergency
    has_medical_condition BOOLEAN DEFAULT false,
    medical_condition_details TEXT,
    emergency_contact_name TEXT,
    emergency_contact_relationship TEXT,
    emergency_contact_number TEXT,
    
    -- Preferences
    is_fasting BOOLEAN DEFAULT false,
    
    -- Source tracking
    events_list TEXT,
    ga_source TEXT,
    ga_campaign TEXT,
    ga_medium TEXT,
    terms_accepted BOOLEAN DEFAULT false,
    
    -- Webhook tracking
    webhook_event_id UUID REFERENCES public.webhook_events(id),
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for event registrations (each event a participant registers for)
CREATE TABLE public.registration_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    registration_id UUID NOT NULL REFERENCES public.partner_registrations(id) ON DELETE CASCADE,
    
    event_slug TEXT NOT NULL,
    event_date TEXT,
    family_members_joining BOOLEAN DEFAULT false,
    number_of_children INTEGER DEFAULT 0,
    number_of_adults INTEGER DEFAULT 0,
    fnb_required BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for dependents (family members for each event)
CREATE TABLE public.event_dependents (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    registration_event_id UUID NOT NULL REFERENCES public.registration_events(id) ON DELETE CASCADE,
    
    dependent_type TEXT NOT NULL, -- 'children' or 'adult'
    dependent_index INTEGER,
    name TEXT NOT NULL,
    gender TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partner_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_dependents ENABLE ROW LEVEL SECURITY;

-- RLS policies for partner_registrations
CREATE POLICY "Admins can manage partner registrations"
ON public.partner_registrations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view partner registrations"
ON public.partner_registrations
FOR SELECT
USING (is_staff(auth.uid()));

-- RLS policies for registration_events
CREATE POLICY "Admins can manage registration events"
ON public.registration_events
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view registration events"
ON public.registration_events
FOR SELECT
USING (is_staff(auth.uid()));

-- RLS policies for event_dependents
CREATE POLICY "Admins can manage event dependents"
ON public.event_dependents
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view event dependents"
ON public.event_dependents
FOR SELECT
USING (is_staff(auth.uid()));

-- Add indexes for common queries
CREATE INDEX idx_partner_registrations_email ON public.partner_registrations(work_email);
CREATE INDEX idx_partner_registrations_webhook ON public.partner_registrations(webhook_event_id);
CREATE INDEX idx_registration_events_registration ON public.registration_events(registration_id);
CREATE INDEX idx_event_dependents_event ON public.event_dependents(registration_event_id);

-- Trigger for updated_at
CREATE TRIGGER update_partner_registrations_updated_at
BEFORE UPDATE ON public.partner_registrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();