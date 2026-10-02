'use strict';

const ANNOUNCEMENT_PREFIX = 'onepiece.launcher.announcements.v1.';
const BGM_KEY = 'onepiece.launcher.profileMusic.v1';
const MAX_KEYS = 100;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;

function sanitizeSnapshot(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  const result = {};
  let total = 0;
  for (const [key, value] of Object.entries(source).slice(0, MAX_KEYS)) {
    if (typeof value !== 'string') continue;
    if (key === BGM_KEY) {
      if (value.length > 1024) continue;
      try {
        const data = JSON.parse(value);
        if (!data || !Number.isFinite(data.volume) || data.volume < 0 || data.volume > 1 || typeof data.muted !== 'boolean') continue;
      } catch { continue; }
    } else if (key.startsWith(ANNOUNCEMENT_PREFIX)) {
      const ownerId = Number(key.slice(ANNOUNCEMENT_PREFIX.length));
      if (!Number.isSafeInteger(ownerId) || ownerId < 1 || value.length > 600000) continue;
      try {
        const data = JSON.parse(value);
        if (data?.schemaVersion !== 1 || data.ownerId !== ownerId) continue;
      } catch { continue; }
    } else continue;
    total += Buffer.byteLength(key) + Buffer.byteLength(value);
    if (total > MAX_TOTAL_BYTES) break;
    result[key] = value;
  }
  return result;
}

const legacySnapshotScript = `(() => {
  const result = {};
  try {
    for (let i = 0; i < localStorage.length && i < ${MAX_KEYS}; i++) {
      const key = localStorage.key(i);
      if (key === '${BGM_KEY}' || /^onepiece\\.launcher\\.announcements\\.v1\\.[1-9]\\d*$/.test(key)) {
        result[key] = localStorage.getItem(key);
      }
    }
  } catch {}
  return result;
})()`;

function applySnapshotScript(snapshot) {
  const approved = sanitizeSnapshot(snapshot);
  return `(() => {
    const incoming = ${JSON.stringify(approved)};
    const actual = {};
    try {
      for (const [key, value] of Object.entries(incoming)) {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
        actual[key] = localStorage.getItem(key);
      }
    } catch { return { ok: false, actual }; }
    return { ok: Object.keys(actual).length === Object.keys(incoming).length, actual };
  })()`;
}

module.exports = { ANNOUNCEMENT_PREFIX, BGM_KEY, applySnapshotScript, legacySnapshotScript, sanitizeSnapshot };
