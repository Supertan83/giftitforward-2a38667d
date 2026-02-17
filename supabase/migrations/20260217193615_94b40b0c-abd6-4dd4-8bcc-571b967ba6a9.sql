
-- Create a generic cleanup archive table to store soft-deleted records from any table
CREATE TABLE public.cleanup_archive (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_table TEXT NOT NULL,
  original_id UUID NOT NULL,
  record_data JSONB NOT NULL,
  archived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  archived_by UUID,
  archive_batch_id UUID DEFAULT gen_random_uuid()
);

-- Index for browsing by source table
CREATE INDEX idx_cleanup_archive_source ON public.cleanup_archive (source_table, archived_at DESC);
CREATE INDEX idx_cleanup_archive_batch ON public.cleanup_archive (archive_batch_id);

-- Enable RLS
ALTER TABLE public.cleanup_archive ENABLE ROW LEVEL SECURITY;

-- Only admins can manage archive
CREATE POLICY "Admins can manage cleanup archive"
ON public.cleanup_archive
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));
