-- Change author_id foreign key from auth.users to public.profiles

ALTER TABLE store_announcements
  DROP CONSTRAINT IF EXISTS store_announcements_author_id_fkey;

ALTER TABLE store_announcements
  ADD CONSTRAINT store_announcements_author_id_fkey 
  FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL;