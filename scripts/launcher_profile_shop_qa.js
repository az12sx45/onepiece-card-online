'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  CATALOG, toPublicProfile, toCardPublicProfile, getLauncherProfile, getLauncherShop, changeLauncherItem,
  setLauncherDecorationPlacement, sanitizeLauncherStatsPatch
} = require('../server/launcher-profile-shop');

const clone = value => JSON.parse(JSON.stringify(value));
const today = new Date().toISOString().slice(0, 10);
const rows = new Map([
  [1, { user_id: 1, secret: 'mine', name: '航海士', avatar: '8', stats: {
    client: { totals: { games: 7, wins: 3, coins: 12 }, social: { friends: [2], privateMarker: 'never-expose' },
      shop: { ownedAvatars: [99], ownedWalls: [], ownedFlags: [] }, titles: { equipped: '船長', owned: ['船長'] } },
    launcherChessV1: { games: 2, wins: 1, draws: 1, losses: 0 },
    boardArtCollectionV1: { 'chest:wood:1': 123 }, launcherWalletV1: { coins: 12, lastGrantDay: today }
  } }],
  [2, { user_id: 2, secret: 'friend', name: '夥伴', avatar: '4', stats: {
    client: { totals: { games: 2, wins: 1, coins: 100 }, social: { friends: [1], privateMarker: 'friend-private' } },
    boardArtCollectionV1: {}, launcherOwnedV1: { items: ['guestbook-1', 'background-luffy'] },
    launcherAppearanceV1: { backgroundId: 'background-luffy' }
  } }],
  [3, { user_id: 3, secret: 'stranger', name: '陌生人', avatar: '5', stats: {} }],
  [4, { user_id: 4, secret: 'zero', name: '零錢', avatar: '5', stats: { coins: 100, client: { totals: { coins: 0 } } } }],
  [5, { user_id: 5, secret: 'legacy', name: '舊帳號', avatar: '5', stats: { coins: 9, client: { totals: {} }, launcherWalletV1: { coins: 9, lastGrantDay: today } } }],
  [6, { user_id: 6, secret: 'decorator', name: '佈置者', avatar: '8', stats: { client: { totals: { coins: 100 } }, launcherWalletV1: { coins: 100, lastGrantDay: today } } }]
]);

const pool = {
  async query(sql, args) {
    if (sql.includes('WHERE secret=$1')) {
      return { rows: [...rows.values()].filter(row => row.secret === args[0]).map(clone) };
    }
    if (sql.includes('WHERE user_id=$1')) return { rows: [rows.get(args[0])].filter(Boolean).map(clone) };
    throw new Error(`Unexpected query: ${sql}`);
  },
  async connect() {
    let working = null;
    return {
      async query(sql, args) {
        if (sql === 'BEGIN') return { rows: [] };
        if (sql.includes('FOR UPDATE')) {
          assert.match(sql, /WHERE secret=\$1 FOR UPDATE/);
          working = [...rows.values()].find(row => row.secret === args[0]);
          return { rows: working ? [clone(working)] : [] };
        }
        if (sql.startsWith('UPDATE player_profiles')) {
          assert.ok(working && working.user_id === args[args.length - 1]);
          working = args.length === 3 ? { ...working, avatar: args[0], stats: JSON.parse(args[1]), updated_at: 'now' } :
            { ...working, stats: JSON.parse(args[0]), updated_at: 'now' };
          return { rows: [clone(working)] };
        }
        if (sql === 'COMMIT') { if (working) rows.set(working.user_id, working); return { rows: [] }; }
        if (sql === 'ROLLBACK') { working = null; return { rows: [] }; }
        throw new Error(`Unexpected transaction query: ${sql}`);
      },
      release() {}
    };
  }
};

(async () => {
  assert.equal(CATALOG.length, 87);
  assert.deepEqual(CATALOG.filter(item => item.type === 'avatar').map(item => item.key),
    Array.from({ length: 32 }, (_, index) => index + 31));
  const opTracks = CATALOG.filter(item => item.id.startsWith('bgm-op-'));
  assert.equal(opTracks.length, 20);
  assert.equal(new Set(opTracks.map(item => item.id)).size, 20);
  for (let index = 1; index <= 20; index++) {
    const number = String(index).padStart(2, '0');
    const item = opTracks[index - 1];
    assert.equal(item.id, `bgm-op-${number}`);
    assert.equal(item.asset, `opui://launcher/audio/bgm/track${number}.mp3`);
    assert.equal(item.price, 10);
    assert.ok(fs.existsSync(path.join(__dirname, `../public/audio/bgm/track${number}.mp3`)));
  }
  assert.equal(CATALOG.find(item => item.id === 'wall-6').price, 10);
  assert.equal(CATALOG.find(item => item.id === 'flag-15').price, 25);
  assert.equal(CATALOG.find(item => item.id === 'decor-header-luffy').slot, 'header');
  assert.equal(CATALOG.find(item => item.id === 'background-luffy').asset, 'opui://launcher/images/profile_decor/bg-luffy.webp');
  assert.equal(CATALOG.find(item => item.id === 'frame-zoro').asset, 'opui://launcher/images/profile_decor/frame-zoro.webp');
  assert.equal(CATALOG.find(item => item.id === 'guestbook-1').price, 10);
  assert.equal(CATALOG.find(item => item.id === 'bgm-harbor').asset, 'opui://launcher/audio/profile_bgm/harbor.ogg');
  assert.match(fs.readFileSync(path.join(__dirname, '../server/index.js'), 'utf8'), /sanitizeLauncherStatsPatch\(sanitizeChessStatsPatch\(patch\.stats\)\)/);
  assert.equal((await getLauncherShop(pool, '', true)).shop.preview, true);
  assert.equal((await getLauncherShop(pool, '', true)).shop.wallet, null);
  assert.deepEqual(sanitizeLauncherStatsPatch({ launcherOwnedV1: { items: ['guestbook-1'] }, launcherAppearanceV1: { bgmId: 'bgm-harbor' }, launcherWalletV1: { coins: 999999 }, client: { totals: { coins: 2 } } }), { client: { totals: { coins: 2 } } });
  assert.equal(toPublicProfile({ user_id: 99, name: '未購買', avatar: 1,
    stats: { launcherAppearanceV1: { backgroundId: 'background-zoro', frameId: 'frame-luffy', bgmId: 'bgm-voyage' } } }).appearance.backgroundId, 'background-default');

  // The legacy Card visitor page reads these exact public fields. It may
  // visit leaderboard players without a friendship, so this DTO remains public.
  const cardVisitor = toCardPublicProfile({
    user_id: 6, name: '懸賞犯', avatar: '31', secret: 'must-not-leak',
    recent_matches: [{ secret: 'private-match' }],
    stats: {
      wall: { id: 4, flagId: 15, privateMarker: 'wall-private' },
      launcherChessV1: { games: 3 },
      boardArtCollectionV1: { secret: 1 },
      client: {
        totals: { games: 9, wins: 4, coins: 6, privateMarker: 'totals-private' },
        titles: { owned: [{ label: '大海賊', tier: 6 }], equipped: '大海賊', equippedTier: 6, privateMarker: 'title-private' },
        rank: { tier: 2, rp: 15, placement: { games: 2, score: -12 }, privateMarker: 'rank-private' },
        bountyPosters: [
          { key: 'wanted-old', ts: 50, title: '舊懸賞令', name: '懸賞犯', bounty: '1 千萬', avatarId: 8 },
          { key: 'wanted-1', ts: 100, title: '懸賞令', name: '懸賞犯', bounty: '1 億', avatarId: 31, privateMarker: 'poster-private' }
        ],
        deluxeUnlocked: [0, 19],
        shop: { ownedAvatars: [31], ownedWalls: [4], ownedFlags: [15], ownedItems: ['private-item'] },
        social: { friends: [1], friend_in: [2], privateMarker: 'social-private' },
        _appliedMatchKeys: ['private-key'],
        recent: [{ secret: 'private-recent' }]
      }
    }
  });
  assert.deepEqual([cardVisitor.user_id, cardVisitor.name, cardVisitor.avatar], [6, '懸賞犯', 31]);
  assert.deepEqual(cardVisitor.stats.wall, { id: 4, flagId: 15 });
  assert.deepEqual(cardVisitor.stats.client.totals, { games: 9, wins: 4, coins: 6 });
  assert.deepEqual(cardVisitor.stats.client.titles, { owned: [{ label: '大海賊', tier: 6 }], equipped: '大海賊', equippedTier: 6 });
  assert.deepEqual(cardVisitor.stats.client.rank, { tier: 2, rp: 15, placement: { games: 2, score: -12 } });
  assert.deepEqual(cardVisitor.stats.client.bountyPosters, [{ key: 'wanted-1', ts: 100, title: '懸賞令', name: '懸賞犯', bounty: '1 億', avatarId: 31 }]);
  assert.deepEqual(cardVisitor.stats.client.deluxeUnlocked, [0, 19]);
  assert.deepEqual(cardVisitor.stats.client.shop, { ownedAvatars: [31], ownedWalls: [4], ownedFlags: [15], ownedItems: [] });
  assert.deepEqual(Object.keys(cardVisitor.stats).sort(), ['client', 'wall']);
  for (const marker of ['must-not-leak', 'private-match', 'wall-private', 'totals-private', 'title-private', 'rank-private', 'poster-private', 'private-item', 'social-private', 'private-key', 'private-recent']) {
    assert.ok(!JSON.stringify(cardVisitor).includes(marker), `leaked ${marker}`);
  }

  const own = await getLauncherProfile(pool, 'mine');
  assert.equal(own.profile.isSelf, true);
  assert.equal(own.profile.games.card.games, 7);
  assert.equal(own.profile.games.chess.draws, 1);
  assert.ok(own.profile.collection.card.avatars.includes(1));
  assert.deepEqual(own.profile.collection.board.artworkEntries, [
    { id: 'chest:wood:1', title: '木寶箱', group: '寶箱揭曉', variant: 1, variantLabel: '插畫 1/3' }
  ]);
  assert.ok(!JSON.stringify(own).includes('never-expose'));
  assert.ok(!JSON.stringify(own).includes('mine'));

  const friend = await getLauncherProfile(pool, 'mine', 2);
  assert.equal(friend.profile.isSelf, false);
  assert.equal(friend.profile.name, '夥伴');
  assert.equal(friend.profile.guestbookUnlocked, true);
  assert.deepEqual(friend.profile.collection.launcher.itemIds, ['guestbook-1', 'background-luffy']);
  assert.equal(friend.profile.appearanceItems.background.asset, 'opui://launcher/images/profile_decor/bg-luffy.webp');
  assert.ok(!JSON.stringify(friend).includes('friend-private'));
  assert.equal((await getLauncherProfile(pool, 'mine', 3)).error, 'not friends');
  rows.get(1).stats.client.social.friends.push(3);
  assert.equal((await getLauncherProfile(pool, 'mine', 3)).error, 'not friends'); // Caller cannot forge reciprocal friendship.
  rows.get(1).stats.client.social.friends.pop();
  assert.equal((await getLauncherProfile(pool, 'wrong', 2)).error, 'bad secret');

  assert.equal((await getLauncherShop(pool, 'mine')).shop.wallet.coins, 12);
  assert.equal((await getLauncherShop(pool, 'zero')).shop.wallet.coins, 100);
  assert.equal((await getLauncherShop(pool, 'zero')).shop.wallet.dailyGrant, 20);
  assert.equal((await changeLauncherItem(pool, 'zero', 'ava-31', 'buy')).shop.wallet.coins, 95);
  assert.equal(rows.get(4).stats.client.totals.coins, 0);
  assert.equal((await getLauncherShop(pool, 'legacy')).shop.wallet.coins, 9);
  assert.equal((await changeLauncherItem(pool, 'mine', 'ava-31', 'buy')).shop.wallet.coins, 7);
  assert.equal(rows.get(1).stats.client.totals.coins, 12);
  assert.equal((await changeLauncherItem(pool, 'mine', 'ava-31', 'buy')).error, 'already_owned');
  assert.equal((await changeLauncherItem(pool, 'mine', 'ava-49', 'buy')).error, 'insufficient_coins');
  assert.equal((await changeLauncherItem(pool, 'mine', 'ava-49', 'equip')).error, 'not_owned');
  assert.equal((await changeLauncherItem(pool, 'mine', 'ava-31', 'equip')).shop.equipped.avatar, 31);
  assert.equal((await changeLauncherItem(pool, 'mine', 'wall-1', 'equip')).shop.equipped.wall, 1);
  assert.equal((await changeLauncherItem(pool, 'mine', 'ava-999', 'buy')).error, 'invalid item');
  assert.equal(rows.get(1).stats.client.social.privateMarker, 'never-expose');
  assert.deepEqual(rows.get(1).stats.client.shop.ownedAvatars, [99, 31]);
  assert.equal((await changeLauncherItem(pool, 'decorator', 'layout-grand-line', 'buy')).ok, true);
  assert.equal((await changeLauncherItem(pool, 'decorator', 'background-luffy', 'buy')).ok, true);
  assert.equal((await changeLauncherItem(pool, 'decorator', 'frame-zoro', 'buy')).ok, true);
  assert.equal((await changeLauncherItem(pool, 'decorator', 'decor-header-luffy', 'buy')).ok, true);
  assert.equal((await changeLauncherItem(pool, 'decorator', 'bgm-harbor', 'buy')).ok, true);
  assert.equal((await changeLauncherItem(pool, 'decorator', 'guestbook-1', 'buy')).ok, true);
  assert.equal((await changeLauncherItem(pool, 'decorator', 'guestbook-1', 'equip')).error, 'invalid_action');
  assert.equal((await changeLauncherItem(pool, 'decorator', 'decor-header-chopper', 'equip')).error, 'not_owned');
  assert.equal((await changeLauncherItem(pool, 'decorator', 'layout-grand-line', 'equip')).shop.equipped.layoutId, 'layout-grand-line');
  assert.equal((await changeLauncherItem(pool, 'decorator', 'background-luffy', 'equip')).shop.equipped.backgroundId, 'background-luffy');
  assert.equal((await changeLauncherItem(pool, 'decorator', 'frame-zoro', 'equip')).shop.equipped.frameId, 'frame-zoro');
  assert.equal((await changeLauncherItem(pool, 'decorator', 'decor-header-luffy', 'equip')).shop.equipped.decorations.header, 'decor-header-luffy');
  assert.equal((await changeLauncherItem(pool, 'decorator', 'bgm-harbor', 'equip')).shop.equipped.bgmId, 'bgm-harbor');
  assert.equal((await setLauncherDecorationPlacement(pool, 'decorator', 'header', { x: 46, y: 20, scale: 1.25 })).profile.appearance.decorationPlacement.header.x, 46);
  assert.equal((await setLauncherDecorationPlacement(pool, 'decorator', 'header', { x: 100, y: 20, scale: 1 })).error, 'invalid_placement');
  const decorator = (await getLauncherProfile(pool, 'decorator')).profile;
  assert.equal(decorator.guestbookUnlocked, true);
  assert.equal(decorator.appearanceItems.bgm.asset, 'opui://launcher/audio/profile_bgm/harbor.ogg');
  assert.equal(decorator.appearanceItems.background.asset, 'opui://launcher/images/profile_decor/bg-luffy.webp');
  assert.equal(decorator.appearanceItems.frame.asset, 'opui://launcher/images/profile_decor/frame-zoro.webp');
  assert.deepEqual(decorator.collection.launcher.itemIds, ['layout-grand-line', 'background-luffy', 'frame-zoro', 'decor-header-luffy', 'bgm-harbor', 'guestbook-1']);
  assert.equal((await changeLauncherItem(pool, 'decorator', 'decor-none-header', 'equip')).profile.appearance.decorations.header, null);
  assert.equal((await setLauncherDecorationPlacement(pool, 'decorator', 'header', { x: 46, y: 20, scale: 1.25 })).error, 'empty_slot');
  assert.equal((await changeLauncherItem(pool, 'decorator', 'background-default', 'equip')).profile.appearance.backgroundId, 'background-default');
  assert.equal((await changeLauncherItem(pool, 'decorator', 'frame-none', 'equip')).profile.appearance.frameId, 'frame-none');
  assert.equal((await changeLauncherItem(pool, 'decorator', 'bgm-none', 'equip')).profile.appearance.bgmId, 'bgm-none');
  assert.equal((await changeLauncherItem(pool, 'decorator', 'ava-52', 'equip')).error, 'not_owned');
  assert.equal((await changeLauncherItem(pool, 'decorator', 'ava-52', 'buy')).ok, true);
  assert.equal(rows.get(6).avatar, '8'); // Launcher-only avatar never changes Card/Board's shared avatar.
  assert.equal((await changeLauncherItem(pool, 'decorator', 'ava-52', 'buy')).error, 'already_owned');
  assert.equal((await changeLauncherItem(pool, 'decorator', 'ava-52', 'equip')).profile.avatar, 52);
  assert.equal(rows.get(6).avatar, '8');
  assert.equal((await getLauncherProfile(pool, 'decorator')).profile.appearance.avatarId, 52);
  assert.ok((await getLauncherProfile(pool, 'decorator')).profile.collection.card.avatars.includes(52));
  assert.deepEqual((await getLauncherProfile(pool, 'decorator')).profile.collection.launcher.avatarIds, [52]);
  assert.ok((await getLauncherShop(pool, 'decorator')).shop.owned.avatars.includes(52));
  assert.equal(toCardPublicProfile(rows.get(6)).avatar, 8);
  assert.equal((await changeLauncherItem(pool, 'decorator', 'ava-8', 'equip')).profile.avatar, 8);
  assert.equal((await getLauncherShop(pool, 'decorator')).shop.equipped.avatar, 8);
  assert.equal((await changeLauncherItem(pool, 'decorator', 'bgm-op-01', 'equip')).error, 'not_owned');
  assert.equal((await changeLauncherItem(pool, 'decorator', 'bgm-op-01', 'buy')).ok, true);
  assert.equal((await changeLauncherItem(pool, 'decorator', 'bgm-op-01', 'buy')).error, 'already_owned');
  assert.equal((await changeLauncherItem(pool, 'decorator', 'bgm-op-01', 'equip')).profile.appearanceItems.bgm.asset, 'opui://launcher/audio/bgm/track01.mp3');
  assert.ok((await getLauncherShop(pool, 'decorator')).shop.owned.bgms.includes('bgm-op-01'));
  assert.equal((await changeLauncherItem(pool, 'decorator', 'bgm-none', 'equip')).profile.appearance.bgmId, 'bgm-none');
  assert.equal((await getLauncherProfile(pool, 'legacy')).profile.guestbookUnlocked, false);
  assert.equal((await changeLauncherItem(pool, 'legacy', 'guestbook-1', 'buy')).error, 'insufficient_coins');
  console.log('launcher profile/shop: legacy visitor DTO, authorized friend DTO, ownership, balance, equip checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
