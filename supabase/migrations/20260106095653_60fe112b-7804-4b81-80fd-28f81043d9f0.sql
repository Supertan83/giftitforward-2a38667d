-- Track which Surpluss allocation IDs have already been applied so sync is idempotent
CREATE TABLE IF NOT EXISTS public.surpluss_allocation_sync (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  allocation_id BIGINT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'unknown',
  marketplace_external_id BIGINT NULL,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  synced_by UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Prevent duplicates per environment
CREATE UNIQUE INDEX IF NOT EXISTS surpluss_allocation_sync_allocation_env_uidx
  ON public.surpluss_allocation_sync (allocation_id, environment);

CREATE INDEX IF NOT EXISTS surpluss_allocation_sync_env_idx
  ON public.surpluss_allocation_sync (environment);

-- Enable Row Level Security
ALTER TABLE public.surpluss_allocation_sync ENABLE ROW LEVEL SECURITY;

-- Admin-only access (staff with admin role)
CREATE POLICY "Admins can view Surpluss sync tracking"
  ON public.surpluss_allocation_sync
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert Surpluss sync tracking"
  ON public.surpluss_allocation_sync
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update Surpluss sync tracking"
  ON public.surpluss_allocation_sync
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete Surpluss sync tracking"
  ON public.surpluss_allocation_sync
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Keep updated_at current
DROP TRIGGER IF EXISTS update_surpluss_allocation_sync_updated_at ON public.surpluss_allocation_sync;
CREATE TRIGGER update_surpluss_allocation_sync_updated_at
  BEFORE UPDATE ON public.surpluss_allocation_sync
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
