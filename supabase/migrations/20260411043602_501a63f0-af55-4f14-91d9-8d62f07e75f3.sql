CREATE POLICY "Public can view active marketplace events"
  ON public.marketplace_events
  FOR SELECT
  TO anon
  USING (status = 'active');