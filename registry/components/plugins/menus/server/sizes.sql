ALTER TABLE menu_item
  ADD COLUMN IF NOT EXISTS sizes jsonb NOT NULL DEFAULT '[]'::jsonb
  CONSTRAINT menu_item_sizes_check CHECK (jsonb_typeof(sizes) = 'array');
