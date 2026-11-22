-- Additive only. Existing wishes, avatars and soft-deleted records are unchanged.
-- Keep only the nonce and event watermark needed to prevent replay/resurrection.
CREATE TABLE IF NOT EXISTS deleted_receipts (
  wish_id INTEGER PRIMARY KEY CHECK(wish_id > 0),
  submission_key TEXT NOT NULL UNIQUE CHECK(length(submission_key) BETWEEN 12 AND 100),
  deleted_at INTEGER NOT NULL CHECK(deleted_at > 0),
  event_seq INTEGER NOT NULL UNIQUE CHECK(event_seq > 0)
);
CREATE TRIGGER IF NOT EXISTS wishes_reject_deleted_submission
BEFORE INSERT ON wishes
WHEN EXISTS (SELECT 1 FROM deleted_receipts WHERE submission_key = NEW.submission_key)
BEGIN
  SELECT RAISE(ABORT, 'WISH_DELETED');
END;
