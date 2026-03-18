-- Create store_documents bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('store_documents', 'store_documents', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS for store_documents bucket
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'store_documents');

CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'store_documents');

CREATE POLICY "Authenticated users can update documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'store_documents');