CREATE TABLE IF NOT EXISTS playback_state (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  paused INTEGER NOT NULL DEFAULT 0 CHECK(paused IN (0,1)),
  latest_id INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO playback_state(id,paused,latest_id,updated_at) VALUES(1,0,0,0);
CREATE TABLE IF NOT EXISTS playback_commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL CHECK(action IN ('pause','resume','next','prev','replay')),
  request_key TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS playback_command_state
AFTER INSERT ON playback_commands
BEGIN
  UPDATE playback_state SET
    paused = CASE WHEN NEW.action='pause' THEN 1 WHEN NEW.action='resume' THEN 0 ELSE paused END,
    latest_id = NEW.id,
    updated_at = NEW.created_at
  WHERE id=1;
END;
