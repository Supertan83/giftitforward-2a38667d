
-- Create email_campaigns table
CREATE TABLE public.email_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.email_templates(id) ON DELETE RESTRICT,
  name text NOT NULL,
  recipient_filter jsonb NOT NULL DEFAULT '{"type": "all"}'::jsonb,
  scheduled_at timestamptz,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  total_recipients integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create email_campaign_recipients table
CREATE TABLE public.email_campaign_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  volunteer_id uuid REFERENCES public.pending_volunteers(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  recipient_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaign_recipients ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_campaigns
CREATE POLICY "Admins can manage email campaigns"
ON public.email_campaigns FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view email campaigns"
ON public.email_campaigns FOR SELECT
USING (is_staff(auth.uid()));

-- RLS policies for email_campaign_recipients
CREATE POLICY "Admins can manage campaign recipients"
ON public.email_campaign_recipients FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view campaign recipients"
ON public.email_campaign_recipients FOR SELECT
USING (is_staff(auth.uid()));

-- Indexes
CREATE INDEX idx_email_campaigns_status ON public.email_campaigns(status);
CREATE INDEX idx_email_campaigns_scheduled_at ON public.email_campaigns(scheduled_at);
CREATE INDEX idx_email_campaign_recipients_campaign_id ON public.email_campaign_recipients(campaign_id);
CREATE INDEX idx_email_campaign_recipients_status ON public.email_campaign_recipients(status);

-- Updated_at trigger for email_campaigns
CREATE TRIGGER update_email_campaigns_updated_at
BEFORE UPDATE ON public.email_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
