-- Review and apply explicitly. Keep these tables in the same host database/schema.
CREATE TABLE blogs_article (
  id uuid PRIMARY KEY, version integer NOT NULL CHECK (version > 0),
  document jsonb NOT NULL, updated_at timestamptz NOT NULL
);
CREATE TABLE blogs_category (id uuid PRIMARY KEY, document jsonb NOT NULL);
-- Objects intentionally outlive deleted articles until maintenance confirms S3 removal.
CREATE TABLE blogs_object (
  id uuid PRIMARY KEY, article_id uuid NOT NULL, key text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('markdown', 'image')),
  name text NOT NULL, content_type text NOT NULL,
  size integer NOT NULL CHECK (size >= 0), state text NOT NULL CHECK (state IN ('pending', 'ready')),
  created_at timestamptz NOT NULL DEFAULT now(), checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX blogs_object_article ON blogs_object(article_id);
CREATE INDEX blogs_object_cleanup ON blogs_object(created_at);
CREATE TABLE blogs_mutation (
  id uuid PRIMARY KEY, actor_id text NOT NULL, fingerprint text NOT NULL, result jsonb NOT NULL
);
