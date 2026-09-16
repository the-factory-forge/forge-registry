-- Apply once through the host's migration workflow. PostgreSQL 15+.
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
  state text NOT NULL CHECK (state IN ('uploading', 'ready', 'deleting')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT drive_entry_space_id UNIQUE (space_id, id),
  CONSTRAINT drive_entry_name UNIQUE NULLS NOT DISTINCT (space_id, parent_id, name),
  CONSTRAINT drive_entry_parent FOREIGN KEY (space_id, parent_id) REFERENCES drive_entry(space_id, id)
);
CREATE INDEX drive_entry_cleanup ON drive_entry(state);

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
