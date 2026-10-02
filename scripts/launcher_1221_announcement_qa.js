'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.BOARD_QA_PGLITE ||
  'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const { createLauncherAnnouncements, validateConfig } = require('../server/launcher-announcements');
const config = require('../config/launcher-announcements-v1.json');

async function main() {
  validateConfig(config);
  const notice = config.announcements.find(item => item.id === 'launcher-1.2.21-fishing-visual-catch-and-updates');
  assert.ok(config.revision >= 19);
  assert.equal(notice?.version, '1.2.21');
  assert.deepEqual(notice.requiredRelease, { kind: 'launcher', version: '1.2.21' });
  assert.match(notice.body.join('\n'), /釣竿尖端與浮標/);
  assert.match(notice.body.join('\n'), /直到玩家選擇/);
  assert.match(notice.body.join('\n'), /固定 256 MiB/);
  assert.equal(notice.image?.asset, 'images/launcher_announcements/launcher-fishing-rebuild-1.2.18.webp');
  const image = fs.readFileSync(path.join(__dirname, '..', 'public', notice.image.asset));
  assert.equal(image.length, 84372);
  assert.equal(crypto.createHash('sha256').update(image).digest('hex'),
    'e2a93c8314ed07ad9c44e54ecb09ed6179d2cbfcb94f268c1e8db2d9164e7ebc');

  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE player_profiles (user_id BIGSERIAL PRIMARY KEY, secret TEXT UNIQUE NOT NULL)');
    await db.query('INSERT INTO player_profiles(secret) VALUES($1)', ['fishing-visual-review']);
    const pool = { query: (...args) => db.query(...args) };
    let version = '1.2.20';
    const service = createLauncherAnnouncements({
      config,
      verifyRelease: async kind => kind === 'launcher' ? { ok: true, kind, version } : { ok: false, kind },
      now: () => new Date('2026-10-02T07:00:00.000Z')
    });
    const fetch = () => service.get(pool, 'fishing-visual-review', { scope: 'launcher' }, { crewContentRevision: 1 });
    assert.equal((await fetch()).announcements.some(item => item.id === notice.id), false);
    version = '1.2.21';
    const after = await fetch();
    assert.deepEqual(after.announcements.find(item => item.id === notice.id)?.image, notice.image);
    assert.deepEqual((await db.query(
      'SELECT release_kind, release_id FROM launcher_announcement_publications WHERE announcement_id=$1', [notice.id]
    )).rows, [{ release_kind: 'launcher', release_id: '1.2.21' }]);
    assert.equal((await service.read(pool, 'fishing-visual-review',
      { announcementId: notice.id }, { crewContentRevision: 1 })).ok, true);
    assert.equal((await fetch()).announcements.find(item => item.id === notice.id)?.read, true);
    console.log(JSON.stringify({ status: 'PASS', notice: notice.id, hiddenOn1220: true,
      visibleOn1221: true, imageVerified: true, publicationVerified: true, readPersisted: true }));
  } finally { await db.close(); }
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
