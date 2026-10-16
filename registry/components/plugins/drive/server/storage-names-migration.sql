-- Existing hosts: apply before deploying all storage writers and maintenance workers.
-- NULL preserves legacy object keys, including pending uploads. No objects move.
ALTER TABLE drive_entry ADD COLUMN IF NOT EXISTS storage_name text;
ALTER TABLE drive_upload ADD COLUMN IF NOT EXISTS storage_name text;
