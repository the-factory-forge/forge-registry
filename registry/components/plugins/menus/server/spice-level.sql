ALTER TABLE menu_item
  ADD COLUMN IF NOT EXISTS spice_level integer NOT NULL DEFAULT 0
  CONSTRAINT menu_item_spice_level_check CHECK (spice_level BETWEEN 0 AND 3);
