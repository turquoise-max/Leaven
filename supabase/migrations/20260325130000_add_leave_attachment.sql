-- Add attachment_url to leave_requests
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- Storage Bucket for Leave Attachments (if not exists)
-- Note: Supabase Storage configuration is usually done via UI or specialized API, 
-- but we can ensure policies are set if the bucket exists.

-- Add policy for storage if needed (assuming 'leave-attachments' bucket)
-- INSERT, SELECT policies for members