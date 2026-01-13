-- Create email_send_logs table to track all email send attempts
CREATE TABLE public.email_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_volunteer_id UUID REFERENCES pending_volunteers(id) ON DELETE SET NULL,
  email_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  request_payload JSONB,
  response_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_send_logs ENABLE ROW LEVEL SECURITY;

-- Admin can manage email logs
CREATE POLICY "Admins can manage email logs"
ON public.email_send_logs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Staff can view email logs
CREATE POLICY "Staff can view email logs"
ON public.email_send_logs
FOR SELECT
USING (is_staff(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_email_send_logs_pending_volunteer ON public.email_send_logs(pending_volunteer_id);
CREATE INDEX idx_email_send_logs_created_at ON public.email_send_logs(created_at DESC);