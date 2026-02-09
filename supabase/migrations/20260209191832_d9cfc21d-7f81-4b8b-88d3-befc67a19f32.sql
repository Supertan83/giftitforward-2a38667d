
-- Audit log for Surpluss API write operations
CREATE TABLE public.surpluss_api_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production',
  request_payload JSONB,
  response_status INTEGER,
  response_body JSONB,
  success BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.surpluss_api_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage audit log"
  ON public.surpluss_api_audit_log
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view audit log"
  ON public.surpluss_api_audit_log
  FOR SELECT
  USING (is_staff(auth.uid()));
