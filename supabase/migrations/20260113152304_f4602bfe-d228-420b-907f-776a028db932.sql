-- Create storage bucket for email assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'email-assets', 
  'email-assets', 
  true, 
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow public read access
CREATE POLICY "Public read access for email assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-assets');

-- Create policy to allow authenticated admin upload
CREATE POLICY "Admin upload access for email assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'email-assets' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);