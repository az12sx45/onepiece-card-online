'use strict';

// Check the new notice against a real isolated SQL publication/read store.
const assert = require('node:assert/strict');
const { PGlite } = require(process.env.BOARD_QA_PGLITE ||
  'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const { createLauncherAnnouncements, validateConfig } = require('../server/launcher-announcements');
const config = require('../config/launcher-announcements-v1.json');

async function main() {
  validateConfig(config);
  const notice = config.announcements.find(item => item.id === 'launcher-1.2.12-room-weather-and-arrangement');
  assert.equal(notice?.version, '1.2.12');
  assert.deepEqual(notice.requiredRelease, { kind: 'launcher', version: '1.2.12' });
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE player_profiles (user_id BIGSERIAL PRIMARY KEY, secret TEXT UNIQUE NOT NULL)');
    await db.query('INSERT INTO player_profiles(secret) VALUES($1)', ['room-weather-review']);
    const pool = { query: (...args) => db.query(...args) };
    let version = '1.2.11';
    const service = createLauncherAnnouncements({
      config,
      verifyRelease: async kind => kind === 'launcher' ? { ok: true, kind, version } : { ok: false, kind },
      now: () => new Date('2026-09-28T15:30:00.000Z')
    });
    const fetch = () => service.get(pool, 'room-weather-review', { scope: 'launcher' }, { crewContentRevision: 1 });
    const before = await fetch();
    assert.equal(before.ok, true);
    assert.equal(before.announcements.some(item => item.id === notice.id), false);
    version = '1.2.12';
    const after = await fetch();
    assert.equal(after.ok, true);
    assert.equal(after.announcements.some(item => item.id === notice.id), true);
    const publication = (await db.query('SELECT release_kind, release_id FROM launcher_announcement_publications WHERE announcement_id=$1', [notice.id])).rows;
    assert.deepEqual(publication, [{ release_kind: 'launcher', release_id: '1.2.12' }]);
    assert.equal((await service.read(pool, 'room-weather-review', { announcementId: notice.id }, { crewContentRevision: 1 })).ok, true);
    assert.equal((await fetch()).announcements.find(item => item.id === notice.id).read, true);
    console.log(JSON.stringify({ ok: true, notice: notice.id, hiddenOn1211: true,
      visibleOn1212: true, publicationVerified: true, readPersisted: true }));
  } finally { await db.close(); }
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
