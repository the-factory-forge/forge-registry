-- NULL keeps the preset or generic icon. Existing overrides survive reapplication.
ALTER TABLE menu_label ADD COLUMN IF NOT EXISTS icon text
  CONSTRAINT menu_label_icon_check CHECK (icon IS NULL OR icon IN (
    'leaf', 'vegan', 'fish', 'wheat', 'milk', 'egg', 'nut', 'bean',
    'sprout', 'shrimp', 'shell', 'carrot', 'flower', 'seeds', 'wine', 'check'
  ));
