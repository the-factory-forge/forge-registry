CREATE TABLE IF NOT EXISTS menu_category (
  id text PRIMARY KEY,
  position integer NOT NULL CHECK (position >= 0),
  translations jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_label (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('allergen', 'dietary')),
  position integer NOT NULL CHECK (position >= 0),
  translations jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_item (
  id text PRIMARY KEY,
  version integer NOT NULL CHECK (version >= 1),
  category_id text NOT NULL REFERENCES menu_category(id) ON DELETE RESTRICT,
  price_minor integer NOT NULL CHECK (price_minor >= 0),
  position integer NOT NULL CHECK (position >= 0),
  visible boolean NOT NULL DEFAULT false,
  sold_out boolean NOT NULL DEFAULT false,
  image_entry_id text,
  label_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  translations jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS menu_item_category_position ON menu_item(category_id, position);
