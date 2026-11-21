CREATE TABLE IF NOT EXISTS avatars (
  id TEXT PRIMARY KEY,
  image_base64 TEXT NOT NULL CHECK(length(image_base64) <= 204800),
  mime_type TEXT NOT NULL CHECK(mime_type = 'image/jpeg'),
  byte_size INTEGER NOT NULL CHECK(byte_size BETWEEN 1 AND 153600),
  width INTEGER NOT NULL CHECK(width = 480),
  height INTEGER NOT NULL CHECK(height = 480),
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS wishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_name TEXT NOT NULL CHECK(length(guest_name) BETWEEN 1 AND 100),
  group_number INTEGER NOT NULL CHECK(group_number BETWEEN 1 AND 15),
  blessing_text TEXT NOT NULL CHECK(length(blessing_text) BETWEEN 1 AND 300),
  blessing_grapheme_count INTEGER NOT NULL CHECK(blessing_grapheme_count BETWEEN 1 AND 30),
  avatar_id TEXT REFERENCES avatars(id),
  style_id INTEGER NOT NULL CHECK(style_id BETWEEN 1 AND 10),
  moderation_status TEXT NOT NULL DEFAULT 'approved' CHECK(moderation_status IN ('approved','pending','hidden','deleted')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  submission_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  client_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS wishes_public_order ON wishes(moderation_status,id);
CREATE INDEX IF NOT EXISTS wishes_guest_rate ON wishes(client_hash,created_at);
CREATE INDEX IF NOT EXISTS wishes_created ON wishes(created_at,id);
CREATE TABLE IF NOT EXISTS wish_events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  wish_id INTEGER NOT NULL REFERENCES wishes(id),
  event_type TEXT NOT NULL CHECK(event_type IN ('wish','reset')),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS events_wish ON wish_events(wish_id,seq);
CREATE TRIGGER IF NOT EXISTS wishes_insert_event
AFTER INSERT ON wishes
BEGIN
  INSERT INTO wish_events(wish_id,event_type,created_at)
  VALUES(NEW.id,'wish',NEW.created_at);
END;
CREATE TRIGGER IF NOT EXISTS wishes_moderation_event
AFTER UPDATE OF moderation_status ON wishes
WHEN OLD.moderation_status <> NEW.moderation_status
BEGIN
  INSERT INTO wish_events(wish_id,event_type,created_at)
  VALUES(NEW.id,'reset',NEW.updated_at);
END;
