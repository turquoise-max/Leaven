-- add stamp_image_url column to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS stamp_image_url TEXT;

-- Comment for the column
COMMENT ON COLUMN stores.stamp_image_url IS 'Store owner stamp/signature image URL for digital contracts';