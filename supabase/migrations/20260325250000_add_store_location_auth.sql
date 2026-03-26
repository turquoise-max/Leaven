-- Add location verification columns to stores table
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS latitude double precision,
ADD COLUMN IF NOT EXISTS longitude double precision,
ADD COLUMN IF NOT EXISTS auth_radius integer DEFAULT 200; -- Default radius in meters

COMMENT ON COLUMN public.stores.latitude IS 'Store latitude for attendance verification';
COMMENT ON COLUMN public.stores.longitude IS 'Store longitude for attendance verification';
COMMENT ON COLUMN public.stores.auth_radius IS 'Radius in meters within which attendance is allowed';