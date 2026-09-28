'use strict';

// Verify that the repair notice appears only after the actual launcher release.
const assert = require('node:assert/strict');
const { PGlite } = require(process.env.BOARD_QA_PGLITE || 'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const { createLauncherAnnouncements, validateConfig } = require('../server/launcher-announcements');
const config = require('../config/launcher-announcements-v1.json');

async function main() {
  validateConfig(config);
  const notice = config.announcements.find(item => item.id === 'launcher-1.2.10-shop-and-room-visuals');
  assert.equal(notice?.version, '1.2.10');
  assert.deepEqual(notice.requiredRelease, { kind: 'launcher', version: '1.2.10' });
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE player_profiles (user_id BIGSERIAL PRIMARY KEY, secret TEXT UNIQUE NOT NULL)');
    await db.query('INSERT INTO player_profiles(secret) VALUES($1)', ['room-repair-review']);
    const pool = { query: (...args) => db.query(...args) };
    let version = '1.2.9';
    const service = createLauncherAnnouncements({
      config,
      verifyRelease: async kind => kind === 'launcher' ? { ok: true, kind, version } : { ok: false, kind },
      now: () => new Date('2026-09-28T07:00:00.000Z')
    });
    const fetch = () => service.get(pool, 'room-repair-review', { scope: 'launcher' }, { crewContentRevision: 1 });
    const before = await fetch();
    assert.equal(before.ok, true);
    assert.equal(before.announcements.some(item => item.id === notice.id), false);
    version = '1.2.10';
    const after = await fetch();
    assert.equal(after.ok, true);
    assert.equal(after.announcements.some(item => item.id === notice.id), true);
    const publication = (await db.query('SELECT release_kind, release_id FROM launcher_announcement_publications WHERE announcement_id=$1', [notice.id])).rows;
    assert.deepEqual(publication, [{ release_kind: 'launcher', release_id: '1.2.10' }]);
    assert.equal((await service.read(pool, 'room-repair-review', { announcementId: notice.id }, { crewContentRevision: 1 })).ok, true);
    assert.equal((await fetch()).announcements.find(item => item.id === notice.id).read, true);
    console.log(JSON.stringify({ ok: true, notice: notice.id, hiddenOn129: true, visibleOn1210: true,
      publicationVerified: true, readPersisted: true }));
  } finally { await db.close(); }
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
