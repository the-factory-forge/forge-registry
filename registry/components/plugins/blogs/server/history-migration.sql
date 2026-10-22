-- Existing installations only. Apply through the host's reviewed migration flow.
-- Then call storage.backfillHistory(tx) inside the host migration transaction.
CREATE TABLE IF NOT EXISTS blogs_history (
  id uuid PRIMARY KEY,
  article_id uuid NOT NULL REFERENCES blogs_article(id) ON DELETE CASCADE,
  locale text NOT NULL, number integer NOT NULL CHECK (number > 0),
  header jsonb NOT NULL, payload jsonb NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS blogs_history_article_locale_number
  ON blogs_history(article_id, locale, number);
