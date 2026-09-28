'use strict';

// Isolated release gating for the current notice; never touches live accounts.
const assert = require('node:assert/strict');
const { PGlite } = require(process.env.BOARD_QA_PGLITE || 'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const { createLauncherAnnouncements, validateConfig } = require('../server/launcher-announcements');
const config = require('../config/launcher-announcements-v1.json');

async function main() {
  validateConfig(config);
  assert.ok(config.revision >= 6);
  const notice = config.announcements.find(item => item.id === 'launcher-1.2.9-loading-optimization');
  assert.equal(notice?.version, '1.2.9');
  assert.deepEqual(notice.requiredRelease, { kind: 'launcher', version: '1.2.9' });
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE player_profiles (user_id BIGSERIAL PRIMARY KEY, secret TEXT UNIQUE NOT NULL)');
    await db.query('INSERT INTO player_profiles(secret) VALUES($1)', ['loading-review']);
    const pool = { query: (...args) => db.query(...args) };
    let version = '1.2.8';
    const service = createLauncherAnnouncements({ config,
      verifyRelease: async kind => kind === 'launcher'
        ? { ok: true, kind, version }
        : { ok: false, kind },
      now: () => new Date('2026-09-28T04:00:00.000Z') });
    const fetch = () => service.get(pool, 'loading-review', { scope: 'launcher' }, { crewContentRevision: 1 });
    const before = await fetch();
    assert.equal(before.ok, true);
    assert.equal(before.announcements.some(item => item.id === notice.id), false);
    version = '1.2.9';
    const after = await fetch();
    assert.equal(after.ok, true);
    assert.equal(after.announcements.some(item => item.id === notice.id && item.version === '1.2.9'), true);
    const publication = (await db.query('SELECT release_kind, release_id FROM launcher_announcement_publications WHERE announcement_id=$1', [notice.id])).rows;
    assert.deepEqual(publication, [{ release_kind: 'launcher', release_id: '1.2.9' }]);
    const read = await service.read(pool, 'loading-review', { announcementId: notice.id }, { crewContentRevision: 1 });
    assert.equal(read.ok, true);
    const reread = await fetch();
    assert.equal(reread.announcements.find(item => item.id === notice.id).read, true);
    console.log(JSON.stringify({ ok: true, notice: notice.id, hiddenOn128: true,
      visibleOn129: true, publicationVerified: true, readPersisted: true }));
  } finally { await db.close(); }
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
