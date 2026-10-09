-- Initial database setup. Apply once through the host's schema workflow. PostgreSQL 15+.
CREATE TABLE drive_space (
  id uuid PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  CONSTRAINT drive_space_entity UNIQUE (entity_type, entity_id)
);
CREATE TABLE drive_entry (
  id uuid PRIMARY KEY,
  space_id uuid NOT NULL REFERENCES drive_space(id),
  parent_id uuid,
  kind text NOT NULL CHECK (kind IN ('file', 'folder')),
  name text NOT NULL,
  size bigint NOT NULL DEFAULT 0 CHECK (size >= 0),
  content_type text NOT NULL DEFAULT 'application/octet-stream',
  storage_id uuid,
  state text NOT NULL CONSTRAINT drive_entry_state CHECK (state IN ('uploading', 'ready', 'deleting', 'trashed', 'purging')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  trash_root_id uuid,
  original_parent_id uuid,
  original_path text,
  deleted_at timestamptz,
  expires_at timestamptz,
  CONSTRAINT drive_entry_space_id UNIQUE (space_id, id),
  CONSTRAINT drive_entry_parent FOREIGN KEY (space_id, parent_id) REFERENCES drive_entry(space_id, id)
);
CREATE UNIQUE INDEX drive_entry_name ON drive_entry(space_id, parent_id, name)
  WHERE trash_root_id IS NULL AND parent_id IS NOT NULL;
CREATE UNIQUE INDEX drive_entry_root_name ON drive_entry(space_id, name)
  WHERE trash_root_id IS NULL AND parent_id IS NULL;
CREATE INDEX drive_entry_cleanup ON drive_entry(state);
CREATE INDEX drive_entry_trash_expiry ON drive_entry(expires_at)
  WHERE state = 'trashed';

CREATE TABLE drive_upload (
  id uuid PRIMARY KEY,
  space_id uuid NOT NULL REFERENCES drive_space(id),
  entry_id uuid NOT NULL,
  storage_id uuid NOT NULL,
  input jsonb NOT NULL,
  state text NOT NULL CHECK (state IN ('active', 'completed', 'cancelled')),
  expires_at timestamptz NOT NULL
);
CREATE INDEX drive_upload_cleanup ON drive_upload(state, expires_at);
