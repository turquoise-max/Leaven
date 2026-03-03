-- Add new columns to stores table
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS owner_name text,
ADD COLUMN IF NOT EXISTS store_phone text,
ADD COLUMN IF NOT EXISTS zip_code text,
ADD COLUMN IF NOT EXISTS address_detail text,
ADD COLUMN IF NOT EXISTS opening_hours jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS break_time text,
ADD COLUMN IF NOT EXISTS image_url text;

-- Create storage bucket for store images
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-images', 'store-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
CREATE POLICY "Store images are publicly accessible"
ON storage.objects FOR SELECT
USING ( bucket_id = 'store-images' );

CREATE POLICY "Authenticated users can upload store images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'store-images' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own store images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'store-images' AND
  auth.uid() = owner
);

CREATE POLICY "Users can delete their own store images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'store-images' AND
  auth.uid() = owner
);