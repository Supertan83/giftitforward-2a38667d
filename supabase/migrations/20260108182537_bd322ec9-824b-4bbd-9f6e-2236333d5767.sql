-- Allow authenticated users to update their own training status in pending_volunteers
CREATE POLICY "Users can update own training status"
ON public.pending_volunteers
FOR UPDATE
USING (auth.jwt() ->> 'email' = email)
WITH CHECK (auth.jwt() ->> 'email' = email);