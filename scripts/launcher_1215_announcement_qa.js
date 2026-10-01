'use strict';

// Verify the illustrated fishing notice is bound to the actual signed launcher version.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.BOARD_QA_PGLITE ||
  'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const { createLauncherAnnouncements, validateConfig } = require('../server/launcher-announcements');
const config = require('../config/launcher-announcements-v1.json');
const art = require('../tools/launcher-room/release-v1215/manifest.json');

async function main() {
  validateConfig(config);
  assert.equal(config.revision, 14);
  const notice = config.announcements.find(item => item.id === 'launcher-1.2.15-fishing-and-living-seas');
  assert.equal(notice?.version, '1.2.15');
  assert.deepEqual(notice.requiredRelease, { kind: 'launcher', version: '1.2.15' });
  assert.equal(notice.image?.asset, 'images/launcher_announcements/launcher-life-fishing-1.2.15.webp');
  const imagePath = path.join(__dirname, '..', 'public', notice.image.asset);
  const image = fs.readFileSync(imagePath);
  assert.equal(image.length, art.announcement.bytes);
  assert.equal(crypto.createHash('sha256').update(image).digest('hex'), art.announcement.sha256);
  const rejected = JSON.parse(JSON.stringify(config));
  rejected.announcements.find(item => item.id === notice.id).image.asset = 'https://untrusted.invalid/image.webp';
  assert.throws(() => validateConfig(rejected), /Invalid launcher announcement configuration/);

  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE player_profiles (user_id BIGSERIAL PRIMARY KEY, secret TEXT UNIQUE NOT NULL)');
    await db.query('INSERT INTO player_profiles(secret) VALUES($1)', ['fishing-release-review']);
    const pool = { query: (...args) => db.query(...args) };
    let version = '1.2.14';
    const service = createLauncherAnnouncements({
      config,
      verifyRelease: async kind => kind === 'launcher' ? { ok: true, kind, version } : { ok: false, kind },
      now: () => new Date('2026-10-01T02:00:00.000Z')
    });
    const fetch = () => service.get(pool, 'fishing-release-review', { scope: 'launcher' }, { crewContentRevision: 1 });
    const before = await fetch();
    assert.equal(before.ok, true);
    assert.equal(before.announcements.some(item => item.id === notice.id), false);
    version = '1.2.15';
    const after = await fetch();
    assert.equal(after.ok, true);
    assert.deepEqual(after.announcements.find(item => item.id === notice.id)?.image, notice.image);
    const publication = (await db.query('SELECT release_kind, release_id FROM launcher_announcement_publications WHERE announcement_id=$1', [notice.id])).rows;
    assert.deepEqual(publication, [{ release_kind: 'launcher', release_id: '1.2.15' }]);
    assert.equal((await service.read(pool, 'fishing-release-review', { announcementId: notice.id }, { crewContentRevision: 1 })).ok, true);
    assert.equal((await fetch()).announcements.find(item => item.id === notice.id)?.read, true);
    console.log(JSON.stringify({ status: 'PASS', notice: notice.id, hiddenOn1214: true,
      visibleOn1215: true, imageVerified: true, publicationVerified: true, readPersisted: true }));
  } finally { await db.close(); }
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
