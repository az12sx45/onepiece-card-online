'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const launcherProfileShop = require('../server/launcher-profile-shop');
const { withDisplayNames } = require('../server/player-display');
const { SocialService } = require('../desktop/social-service');

const equippedRow = {
  user_id: 2, name: '好友', avatar: 31,
  stats: { launcherOwnedV1: { items: ['ava-51'] }, launcherAppearanceV1: { avatarId: 51 } }
};
assert.equal(launcherProfileShop.launcherAvatarForRow(equippedRow), 51);
assert.equal(launcherProfileShop.toPublicProfile(equippedRow).avatar, 51);
assert.equal(launcherProfileShop.toCardPublicProfile(equippedRow).avatar, 31);
assert.equal(launcherProfileShop.launcherAvatarForRow({ ...equippedRow, stats: { launcherAppearanceV1: { avatarId: 51 } } }), 31);
assert.equal(launcherProfileShop.launcherAvatarForRow({ ...equippedRow, stats: { launcherOwnedV1: { items: ['ava-51'] }, launcherAppearanceV1: { avatarId: 99 } } }), 31);

async function socketProjection() {
  const source = fs.readFileSync(path.join(__dirname, '../server/index.js'), 'utf8');
  const start = source.indexOf('socket.on("FRIENDS_GET"');
  const end = source.indexOf('\n});', start);
  assert.ok(start >= 0 && end > start, 'FRIENDS_GET handler missing');
  const rows = [equippedRow, { user_id: 3, name: '請求者', avatar: 4, stats: {} }];
  const queries = [];
  let handler;
  const socket = { on(name, fn) { assert.equal(name, 'FRIENDS_GET'); handler = fn; } };
  const pool = { async query(sql, args) {
    queries.push(sql);
    assert.deepEqual(Array.from(args[0]), [2, 3]);
    return { rows: rows.map(row => sql.includes('AS stats') ? { ...row } : { user_id: row.user_id, name: row.name, avatar: row.avatar }) };
  } };
  const owner = { user_id: 1, stats: { client: { social: { friends: [2], friend_in: [3], friend_out: [] } } } };
  vm.runInNewContext(source.slice(start, end + '\n});'.length), {
    socket, pool, withDisplayNames, launcherProfileShop,
    getProfileBySecret: async secret => secret === 'mine' ? owner : null,
    ensureSocial: () => {}, isOnline: () => false, userPage: new Map(), console
  });
  const request = payload => new Promise(resolve => handler(payload, resolve));
  const legacy = await request({ secret: 'mine' });
  assert.equal(legacy.ok, true);
  assert.equal(legacy.friends[0].avatar, 31);
  assert.equal(legacy.requestsIn[0].avatar, 4);
  assert.ok(!queries[0].includes('AS stats'));
  const launcher = await request({ secret: 'mine', launcher: true });
  assert.equal(launcher.ok, true);
  assert.equal(launcher.friends[0].avatar, 51);
  assert.equal(launcher.requestsIn[0].avatar, 4);
  assert.ok(queries[1].includes('AS stats'));
  assert.equal((await request({ secret: 'invalid', launcher: true })).error, 'bad secret');
}

async function desktopProjection() {
  const calls = [];
  class MockAuth extends EventEmitter {
    constructor() { super(); this.state = { deviceId: 'qa' }; this.socket = { connected: false }; }
    accountSummary() { return { userId: 1 }; }
    getSecretForGame() { return 'mine'; }
    async emitAck(name, payload) {
      calls.push({ name, payload });
      if (name === 'SOCIAL_AUTH') return { ok: true };
      if (name === 'FRIENDS_GET') return { ok: true,
        friends: [{ userId: 2, name: '好友', avatar: 51 }],
        requestsIn: [{ userId: 3, name: '請求者', avatar: 62 }],
        requestsOut: [{ userId: 4, name: '異常值', avatar: 999 }] };
      throw new Error(`Unexpected event ${name}`);
    }
  }
  const service = new SocialService(new MockAuth());
  try {
    await service.start();
    assert.equal(calls.find(call => call.name === 'FRIENDS_GET').payload.launcher, true);
    assert.equal(service.friends[0].avatar, 51);
    assert.equal(service.requestsIn[0].avatar, 62);
    assert.equal(service.requestsOut[0].avatar, 8);
  } finally { clearInterval(service.poll); service.reset(); }
}

Promise.all([socketProjection(), desktopProjection()]).then(() => {
  console.log(JSON.stringify({ ok: true, scope: 'launcher social avatar projection, legacy Card response, desktop friend state' }));
}).catch(error => { console.error(error); process.exitCode = 1; });
