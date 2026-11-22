-- Apply through store.migrate() / npm run migrate:d1: it checks the schema
-- before this ALTER so repeated migrations preserve all existing records.
ALTER TABLE wishes ADD COLUMN avatar_gender TEXT NOT NULL DEFAULT 'unspecified'
  CHECK(avatar_gender IN ('male','female','unspecified'));
