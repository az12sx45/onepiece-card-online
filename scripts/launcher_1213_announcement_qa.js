'use strict';

// Verify the new notice stays hidden until the authenticated release gate succeeds.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { PGlite } = require(process.env.BOARD_QA_PGLITE ||
  'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const { createLauncherAnnouncements, validateConfig } = require('../server/launcher-announcements');
const config = require('../config/launcher-announcements-v1.json');

async function main() {
  validateConfig(config);
  const notice = config.announcements.find(item => item.id === 'launcher-1.2.13-character-life-and-dialogue');
  assert.equal(notice?.version, '1.2.13');
  assert.deepEqual(notice.requiredRelease, { kind: 'launcher', version: '1.2.13' });
  assert.deepEqual(notice.image, { asset: 'images/launcher_announcements/launcher-life-1.2.13.webp',
    alt: '千陽號生活基地裡，魯夫、娜美、香吉士與喬巴一起活動的更新主圖' });
  const artwork = require('../tools/launcher-room/announcement-v1213/manifest.json');
  const imageBytes = fs.readFileSync(path.join(__dirname, '..', notice.image.asset.replace(/^images\//, 'public/images/')));
  assert.equal(imageBytes.length, artwork.delivery.bytes);
  assert.equal(crypto.createHash('sha256').update(imageBytes).digest('hex'), artwork.delivery.sha256);
  const bad = JSON.parse(JSON.stringify(config));
  bad.announcements.find(item => item.id === notice.id).image.asset = 'https://untrusted.invalid/image.webp';
  assert.throws(() => validateConfig(bad), /Invalid launcher announcement configuration/);
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE player_profiles (user_id BIGSERIAL PRIMARY KEY, secret TEXT UNIQUE NOT NULL)');
    await db.query('INSERT INTO player_profiles(secret) VALUES($1)', ['crew-life-review']);
    const pool = { query: (...args) => db.query(...args) };
    let version = '1.2.12';
    const service = createLauncherAnnouncements({
      config,
      verifyRelease: async kind => kind === 'launcher' ? { ok: true, kind, version } : { ok: false, kind },
      now: () => new Date('2026-09-29T06:00:00.000Z')
    });
    const fetch = () => service.get(pool, 'crew-life-review', { scope: 'launcher' }, { crewContentRevision: 1 });
    const before = await fetch();
    assert.equal(before.ok, true);
    assert.equal(before.announcements.some(item => item.id === notice.id), false);
    version = '1.2.13';
    const after = await fetch();
    assert.equal(after.ok, true);
    assert.equal(after.announcements.some(item => item.id === notice.id), true);
    assert.deepEqual(after.announcements.find(item => item.id === notice.id).image, notice.image);
    const publication = (await db.query('SELECT release_kind, release_id FROM launcher_announcement_publications WHERE announcement_id=$1', [notice.id])).rows;
    assert.deepEqual(publication, [{ release_kind: 'launcher', release_id: '1.2.13' }]);
    assert.equal((await service.read(pool, 'crew-life-review', { announcementId: notice.id }, { crewContentRevision: 1 })).ok, true);
    assert.equal((await fetch()).announcements.find(item => item.id === notice.id).read, true);
    console.log(JSON.stringify({ ok: true, notice: notice.id, hiddenOn1212: true,
      visibleOn1213: true, imageVerified: true, publicationVerified: true, readPersisted: true }));
  } finally { await db.close(); }
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
