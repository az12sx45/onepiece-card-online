'use strict';

const { entries: adventureArt, groups: adventureArtGroups, normalizeCollection } = require('../public/js/board_adventure_art');
const ADVENTURE_ART_BY_ID = new Map(adventureArt.map(entry => [entry.id, entry]));

const PRICES = Object.freeze({ common: 5, rare: 10, epic: 18, legend: 25 });
const LAUNCHER_WALLET_STARTER_COINS = 100;
const LAUNCHER_WALLET_DAILY_COINS = 20;
const LAUNCHER_WALLET_CAP_COINS = 500;
const avatarNames = [
  '路奇', '大和', '弗朗基', '艾斯', '巴索羅-大熊', '鑽石裘斯', '暴走喬巴',
  '草帽的傳承', '魯夫紅藍光影', '海軍的未來 克比', '多拉格', '火拳艾斯',
  'ACE', '不死鳥馬可', '未來海賊王的左右手', '艾斯剪影', '魯夫Q版',
  '海軍元帥 赤犬', '尼卡大笑', '尼卡防風鏡',
  '香吉士', '騙人布', '甚平', '布魯克', '妮可·羅賓', '托拉法爾加·羅',
  '波雅·漢考克', '薩波', '紅髮傑克', '喬拉可爾·密佛格', '白鬍子', '巴其'
];
const avatarRarity = [
  'common', 'common', 'common', 'common', 'common', 'common', 'common',
  'rare', 'epic', 'epic', 'common', 'common',
  'rare', 'rare', 'rare', 'rare', 'rare', 'epic', 'legend', 'legend',
  'rare', 'common', 'rare', 'rare', 'rare', 'epic',
  'epic', 'epic', 'legend', 'legend', 'legend', 'rare'
];
const LAUNCHER_AVATAR_MIN = 51;
const LAUNCHER_AVATAR_MAX = 30 + avatarNames.length;
// Reuse the Card game's existing OP 01–20 files and song order. Keep these IDs
// stable so an already purchased/equipped song survives later catalog changes.
const opTrackNames = Object.freeze([
  'ウィーアー!(We Are)', 'Believe', 'ヒカリへ', 'BON VOYAGE!', 'ココロのちず',
  'BRAND NEW WORLD', 'ウィーアー!～7人の麥わら海賊団篇～', 'Crazy Rainbow',
  'Jungle P', 'ウィーアー!～アニメーションワンピース10週年', 'Share The World',
  '風をさがして', 'One day', 'Fight Together', 'We Go!', 'Hands Up!',
  'Wake up!', 'Hard Knock Days', 'We Can!', 'Hope'
]);
const CATALOG = Object.freeze([
  ...avatarNames.map((name, index) => ({
    id: `ava-${index + 31}`, type: 'avatar', key: index + 31, name,
    rarity: avatarRarity[index], price: PRICES[avatarRarity[index]],
    asset: `opui://launcher/images/board/avatars/${index + 31}.webp`
  })),
  ...Array.from({ length: 5 }, (_, index) => ({
    id: `wall-${index + 4}`, type: 'wall', key: index + 4,
    name: `牆面 #${index + 4}`, rarity: ['common', 'rare', 'rare', 'epic', 'legend'][index],
    asset: `opui://launcher/images/walls/${index + 4}.webp`
  })),
  ...Array.from({ length: 12 }, (_, index) => ({
    id: `flag-${index + 4}`, type: 'flag', key: index + 4,
    name: `海賊旗 #${index + 4}`, rarity: index >= 7 ? 'legend' : index >= 4 ? 'epic' : index >= 2 ? 'rare' : 'common',
    asset: `opui://launcher/images/flags/${index + 4}.webp`
  })),
  { id: 'layout-grand-line', type: 'layout', key: 'grand-line', name: '偉大航路日誌', rarity: 'common' },
  { id: 'layout-bounty-board', type: 'layout', key: 'bounty-board', name: '懸賞牆', rarity: 'rare' },
  { id: 'layout-captain-quarters', type: 'layout', key: 'captain-quarters', name: '船長艙', rarity: 'epic' },
  { id: 'background-luffy', type: 'background', key: 'luffy', name: '魯夫啟航', rarity: 'rare', asset: 'opui://launcher/images/profile_decor/bg-luffy.webp' },
  { id: 'background-zoro', type: 'background', key: 'zoro', name: '索隆劍影', rarity: 'rare', asset: 'opui://launcher/images/profile_decor/bg-zoro.webp' },
  { id: 'background-nami', type: 'background', key: 'nami', name: '娜美航海圖', rarity: 'rare', asset: 'opui://launcher/images/profile_decor/bg-nami.webp' },
  { id: 'frame-luffy', type: 'frame', key: 'luffy', name: '魯夫相框', rarity: 'epic', asset: 'opui://launcher/images/profile_decor/frame-luffy.webp' },
  { id: 'frame-zoro', type: 'frame', key: 'zoro', name: '索隆相框', rarity: 'epic', asset: 'opui://launcher/images/profile_decor/frame-zoro.webp' },
  { id: 'decor-header-luffy', type: 'decoration', key: 'header-luffy', slot: 'header', name: '魯夫貼紙', rarity: 'rare', asset: 'opui://launcher/images/profile_decor/sticker-luffy.webp' },
  { id: 'decor-header-chopper', type: 'decoration', key: 'header-chopper', slot: 'header', name: '喬巴貼紙', rarity: 'common', asset: 'opui://launcher/images/profile_decor/sticker-chopper.webp' },
  { id: 'decor-side-zoro', type: 'decoration', key: 'side-zoro', slot: 'side', name: '索隆貼紙', rarity: 'rare', asset: 'opui://launcher/images/profile_decor/sticker-zoro.webp' },
  { id: 'decor-side-nami', type: 'decoration', key: 'side-nami', slot: 'side', name: '娜美貼紙', rarity: 'common', asset: 'opui://launcher/images/profile_decor/sticker-nami.webp' },
  { id: 'decor-footer-ace', type: 'decoration', key: 'footer-ace', slot: 'footer', name: '艾斯貼紙', rarity: 'epic', asset: 'opui://launcher/images/profile_decor/sticker-ace.webp' },
  { id: 'decor-footer-robin', type: 'decoration', key: 'footer-robin', slot: 'footer', name: '羅賓貼紙', rarity: 'rare', asset: 'opui://launcher/images/profile_decor/sticker-robin.webp' },
  { id: 'bgm-harbor', type: 'bgm', key: 'harbor', name: '暮港歸航', rarity: 'rare', asset: 'opui://launcher/audio/profile_bgm/harbor.ogg' },
  { id: 'bgm-night-watch', type: 'bgm', key: 'night-watch', name: '星夜航線', rarity: 'epic', asset: 'opui://launcher/audio/profile_bgm/night-watch.ogg' },
  { id: 'bgm-voyage', type: 'bgm', key: 'voyage', name: '破曉揚帆', rarity: 'legend', asset: 'opui://launcher/audio/profile_bgm/voyage.ogg' },
  ...opTrackNames.map((title, index) => {
    const number = String(index + 1).padStart(2, '0');
    return {
      id: `bgm-op-${number}`, type: 'bgm', key: `op-${number}`,
      name: `OP ${number} · ${title}`, rarity: 'rare',
      asset: `opui://launcher/audio/bgm/track${number}.mp3`
    };
  }),
  { id: 'guestbook-1', type: 'guestbook', key: 'guestbook', name: '好友留言板', rarity: 'rare' }
].map(item => Object.freeze({ ...item, price: item.price ?? PRICES[item.rarity] })));
const BY_ID = new Map(CATALOG.map(item => [item.id, item]));
const LAUNCHER_ITEM_TYPES = Object.freeze(['layout', 'background', 'frame', 'decoration', 'bgm', 'guestbook']);
const DECORATION_SLOTS = Object.freeze(['header', 'side', 'footer']);
const DEFAULT_DECORATION_PLACEMENT = Object.freeze({
  header: Object.freeze({ x: 50, y: 12, scale: 1 }),
  side: Object.freeze({ x: 12, y: 54, scale: 1 }),
  footer: Object.freeze({ x: 50, y: 86, scale: 1 })
});

const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const count = value => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
};
const finiteNumber = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const boundedId = (value, max, fallback = 1) => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 1 && n <= max ? n : fallback;
};
const numberIds = (value, min, max) => [...new Set((Array.isArray(value) ? value : [])
  .map(Number).filter(n => Number.isSafeInteger(n) && n >= min && n <= max))].sort((a, b) => a - b);
const cardCoins = stats => {
  const totals = object(object(object(stats).client).totals);
  return Object.prototype.hasOwnProperty.call(totals, 'coins') ? count(totals.coins) : count(object(stats).coins);
};
const utcDay = (now = new Date()) => now.toISOString().slice(0, 10);
const validUtcDay = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const stamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value;
};
const validLauncherWallet = wallet => Number.isSafeInteger(wallet.coins) && wallet.coins >= 0 &&
  wallet.coins <= LAUNCHER_WALLET_CAP_COINS && validUtcDay(wallet.lastGrantDay);
function prepareLauncherWallet(stats, now = new Date()) {
  const today = utcDay(now);
  const saved = object(object(stats).launcherWalletV1);
  if (!validLauncherWallet(saved)) {
    return { wallet: { coins: LAUNCHER_WALLET_STARTER_COINS, lastGrantDay: today }, changed: true };
  }
  if (saved.lastGrantDay < today) {
    return { wallet: { coins: Math.min(LAUNCHER_WALLET_CAP_COINS, saved.coins + LAUNCHER_WALLET_DAILY_COINS), lastGrantDay: today }, changed: true };
  }
  if (saved.lastGrantDay > today) return { wallet: { coins: saved.coins, lastGrantDay: today }, changed: true };
  return { wallet: { coins: saved.coins, lastGrantDay: saved.lastGrantDay }, changed: false };
}
function launcherWalletPublic(stats) {
  const saved = object(object(stats).launcherWalletV1);
  const wallet = validLauncherWallet(saved) ? saved : prepareLauncherWallet(stats).wallet;
  const nextGrantAt = new Date(Date.parse(`${wallet.lastGrantDay}T00:00:00.000Z`) + 86400000).toISOString();
  return { coins: wallet.coins, dailyGrant: LAUNCHER_WALLET_DAILY_COINS, cap: LAUNCHER_WALLET_CAP_COINS, nextGrantAt };
}
const purchasedCollection = client => ({
  avatars: numberIds(object(client.shop).ownedAvatars, 31, 50),
  walls: numberIds(object(client.shop).ownedWalls, 4, 8),
  flags: numberIds(object(client.shop).ownedFlags, 4, 15),
});
const launcherOwnedItemIds = stats => [...new Set((Array.isArray(object(stats.launcherOwnedV1).items) ? stats.launcherOwnedV1.items : [])
  .filter(id => typeof id === 'string' && (LAUNCHER_ITEM_TYPES.includes(BY_ID.get(id)?.type) ||
    (BY_ID.get(id)?.type === 'avatar' && BY_ID.get(id)?.key >= LAUNCHER_AVATAR_MIN && BY_ID.get(id)?.key <= LAUNCHER_AVATAR_MAX))))];
const guestbookUnlocked = stats => launcherOwnedItemIds(stats).includes('guestbook-1');
const validPlacement = value => {
  const x = Number(value?.x);
  const y = Number(value?.y);
  const scale = Number(value?.scale);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(scale) &&
    x >= 5 && x <= 95 && y >= 5 && y <= 95 && scale >= 0.5 && scale <= 1.5;
};
const normalizedPlacement = value => ({ x: Math.round(Number(value.x) * 100) / 100, y: Math.round(Number(value.y) * 100) / 100, scale: Math.round(Number(value.scale) * 100) / 100 });
function launcherAppearance(stats) {
  const owned = new Set(launcherOwnedItemIds(stats));
  const saved = object(stats.launcherAppearanceV1);
  const avatarId = Number(saved.avatarId);
  const launcherAvatarId = Number.isSafeInteger(avatarId) && avatarId >= LAUNCHER_AVATAR_MIN && avatarId <= LAUNCHER_AVATAR_MAX && owned.has(`ava-${avatarId}`) ? avatarId : null;
  const layoutId = saved.layoutId !== 'layout-default' && owned.has(saved.layoutId) && BY_ID.get(saved.layoutId)?.type === 'layout' ? saved.layoutId : 'layout-default';
  const backgroundId = saved.backgroundId !== 'background-default' && owned.has(saved.backgroundId) && BY_ID.get(saved.backgroundId)?.type === 'background' ? saved.backgroundId : 'background-default';
  const frameId = saved.frameId !== 'frame-none' && owned.has(saved.frameId) && BY_ID.get(saved.frameId)?.type === 'frame' ? saved.frameId : 'frame-none';
  const bgmId = saved.bgmId !== 'bgm-none' && owned.has(saved.bgmId) && BY_ID.get(saved.bgmId)?.type === 'bgm' ? saved.bgmId : 'bgm-none';
  const savedDecorations = object(saved.decorations);
  const savedPlacement = object(saved.decorationPlacement);
  const decorations = {};
  const decorationPlacement = {};
  for (const slot of DECORATION_SLOTS) {
    const id = savedDecorations[slot];
    decorations[slot] = owned.has(id) && BY_ID.get(id)?.type === 'decoration' && BY_ID.get(id)?.slot === slot ? id : null;
    decorationPlacement[slot] = validPlacement(savedPlacement[slot]) ? normalizedPlacement(savedPlacement[slot]) : { ...DEFAULT_DECORATION_PLACEMENT[slot] };
  }
  return { avatarId: launcherAvatarId, layoutId, backgroundId, frameId, bgmId, decorations, decorationPlacement };
}
const launcherAvatarForRow = (row, appearance = launcherAppearance(object(row?.stats))) =>
  appearance.avatarId || boundedId(row?.avatar, 50, 8);
const appearanceItems = appearance => ({
  layout: BY_ID.get(appearance.layoutId) || null,
  background: BY_ID.get(appearance.backgroundId) || null,
  frame: BY_ID.get(appearance.frameId) || null,
  bgm: BY_ID.get(appearance.bgmId) || null,
  decorations: Object.fromEntries(DECORATION_SLOTS.map(slot => [slot, BY_ID.get(appearance.decorations[slot]) || null]))
});
function sanitizeLauncherStatsPatch(stats) {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return {};
  const { launcherOwnedV1: _owned, launcherAppearanceV1: _appearance, launcherWalletV1: _wallet, ...safe } = stats;
  return safe;
}
const cardCollection = client => ({
  avatars: [...Array.from({ length: 30 }, (_, i) => i + 1), ...purchasedCollection(client).avatars],
  walls: [1, 2, 3, ...purchasedCollection(client).walls],
  flags: [1, 2, 3, ...purchasedCollection(client).flags],
  titles: Array.isArray(object(client.titles).owned) ? object(client.titles).owned.length : 0,
  titleNames: (Array.isArray(object(client.titles).owned) ? object(client.titles).owned : [])
    .slice(0, 100).map(value => String(typeof value === 'string' ? value : object(value).label || object(value).text || '').trim().slice(0, 60)).filter(Boolean),
  bountyPosters: Array.isArray(client.bountyPosters) ? client.bountyPosters.length : 0,
  deluxeUnlocked: Array.isArray(client.deluxeUnlocked) ? client.deluxeUnlocked.length : 0
});

function toPublicProfile(row, isSelf = false, boardSummary = null) {
  const stats = object(row.stats);
  const client = object(stats.client);
  const totals = object(client.totals);
  const chess = object(stats.launcherChessV1);
  const artIds = Object.keys(normalizeCollection(stats.boardArtCollectionV1));
  const artworkEntries = artIds.map(id => {
    const entry = ADVENTURE_ART_BY_ID.get(id);
    return { id, title: entry.title, group: adventureArtGroups[entry.group], variant: entry.variant + 1, variantLabel: `插畫 ${entry.variant + 1}/3` };
  });
  const customAppearance = launcherAppearance(stats);
  const avatar = launcherAvatarForRow(row, customAppearance);
  const launcherAvatarIds = launcherOwnedItemIds(stats)
    .map(id => BY_ID.get(id)).filter(item => item?.type === 'avatar').map(item => item.key);
  const cardItems = cardCollection(client);
  cardItems.avatars = [...new Set([...cardItems.avatars, ...launcherAvatarIds])].sort((a, b) => a - b);
  return {
    userId: count(row.user_id), name: String(row.name || '').slice(0, 40) || '未命名玩家',
    avatar, title: String(object(client.titles).equipped || '').slice(0, 60), isSelf,
    games: {
      card: { available: Object.keys(totals).length > 0, games: count(totals.games), wins: count(totals.wins), source: 'card-profile' },
      board: boardSummary || { available: false, source: 'unavailable' },
      chess: { available: Object.keys(chess).length > 0, games: count(chess.games), wins: count(chess.wins), draws: count(chess.draws), losses: count(chess.losses), source: 'server-match-results' }
    },
    collection: {
      card: cardItems,
      board: { artworks: artIds.length, artworkTotal: adventureArt.length, artworkIds: artIds, artworkEntries },
      chess: { items: 0 },
      launcher: { ownedItems: launcherOwnedItemIds(stats).length, itemIds: launcherOwnedItemIds(stats), avatarIds: launcherAvatarIds }
    },
    appearance: { wallId: boundedId(object(stats.wall).id, 8), flagId: boundedId(object(stats.wall).flagId, 15), ...customAppearance },
    appearanceItems: appearanceItems(customAppearance),
    guestbookUnlocked: guestbookUnlocked(stats),
    updatedAt: row.updated_at || null
  };
}

function toShop(row) {
  const stats = object(row.stats);
  const client = object(stats.client);
  const owned = purchasedCollection(client);
  const newOwned = launcherOwnedItemIds(stats);
  const customAppearance = launcherAppearance(stats);
  const launcherAvatarIds = newOwned.map(id => BY_ID.get(id)).filter(item => item?.type === 'avatar').map(item => item.key);
  return {
    catalog: CATALOG,
    wallet: launcherWalletPublic(stats),
    owned: {
      avatars: [...owned.avatars, ...launcherAvatarIds].sort((a, b) => a - b), walls: owned.walls, flags: owned.flags,
      layouts: newOwned.filter(id => BY_ID.get(id)?.type === 'layout'),
      backgrounds: newOwned.filter(id => BY_ID.get(id)?.type === 'background'),
      frames: newOwned.filter(id => BY_ID.get(id)?.type === 'frame'),
      decorations: newOwned.filter(id => BY_ID.get(id)?.type === 'decoration'),
      bgms: newOwned.filter(id => BY_ID.get(id)?.type === 'bgm'),
      guestbook: guestbookUnlocked(stats)
    },
    equipped: {
      avatar: launcherAvatarForRow(row, customAppearance),
      wall: boundedId(object(stats.wall).id, 8),
      flag: boundedId(object(stats.wall).flagId, 15),
      ...customAppearance
    }
  };
}

// The older Card profile's read-only visitor screen needs these fields. Keep
// its visible wall, collection, rank, and record data without exposing the
// private social graph, pending requests, match-dedupe keys, or other stats.
function toCardPublicProfile(row) {
  const stats = object(row.stats);
  const client = object(stats.client);
  const titles = object(client.titles);
  const rank = object(client.rank);
  const placement = object(rank.placement);
  const shop = purchasedCollection(client);
  return {
    user_id: count(row.user_id),
    name: String(row.name || '').slice(0, 40),
    avatar: boundedId(row.avatar, 50, 1),
    stats: {
      wall: { id: boundedId(object(stats.wall).id, 8), flagId: boundedId(object(stats.wall).flagId, 15) },
      client: {
        totals: { games: count(object(client.totals).games), wins: count(object(client.totals).wins), coins: cardCoins(stats) },
        titles: {
          owned: (Array.isArray(titles.owned) ? titles.owned : []).slice(0, 100).map(value =>
            typeof value === 'string' ? value.slice(0, 60) : {
              label: String(object(value).label || object(value).text || '').slice(0, 60),
              tier: boundedId(object(value).tier || object(value).level, 6)
            }),
          equipped: String(titles.equipped || '').slice(0, 60),
          equippedTier: boundedId(titles.equippedTier, 6)
        },
        rank: { tier: count(rank.tier), rp: count(rank.rp), placement: { games: count(placement.games), score: finiteNumber(placement.score) } },
        bountyPosters: (Array.isArray(client.bountyPosters) ? client.bountyPosters : []).map(value => ({
          key: String(object(value).key || '').slice(0, 120),
          ts: count(object(value).ts),
          title: String(object(value).title || '').slice(0, 120),
          name: String(object(value).name || '').slice(0, 60),
          bounty: String(object(value).bounty || '').slice(0, 60),
          avatarId: boundedId(object(value).avatarId, 50)
        })).filter(value => value.key).sort((a, b) => b.ts - a.ts).slice(0, 1),
        deluxeUnlocked: numberIds(client.deluxeUnlocked, 0, 19),
        shop: { ownedAvatars: shop.avatars, ownedWalls: shop.walls, ownedFlags: shop.flags, ownedItems: [] }
      }
    },
    updated_at: row.updated_at || null
  };
}

async function getLauncherProfile(pool, secret, userId = 0, boardSummaryForUser = null) {
  if (!secret) return { ok: false, error: 'bad secret' };
  const mine = await pool.query('SELECT user_id, name, avatar, stats, updated_at FROM player_profiles WHERE secret=$1 LIMIT 1', [secret]);
  const me = mine.rows[0];
  if (!me) return { ok: false, error: 'bad secret' };
  const targetId = Number(userId);
  if (!Number.isSafeInteger(targetId) || targetId < 0) return { ok: false, error: 'bad userId' };
  if (!targetId || targetId === Number(me.user_id)) {
    const board = boardSummaryForUser ? await boardSummaryForUser(Number(me.user_id)).catch(() => null) : null;
    return { ok: true, profile: toPublicProfile(me, true, board) };
  }
  const friends = numberIds(object(object(object(me.stats).client).social).friends, 1, Number.MAX_SAFE_INTEGER);
  if (!friends.includes(targetId)) return { ok: false, error: 'not friends' };
  const other = await pool.query('SELECT user_id, name, avatar, stats, updated_at FROM player_profiles WHERE user_id=$1 LIMIT 1', [targetId]);
  if (!other.rows[0]) return { ok: false, error: 'not found' };
  const reciprocal = numberIds(object(object(object(other.rows[0].stats).client).social).friends, 1, Number.MAX_SAFE_INTEGER);
  if (!reciprocal.includes(Number(me.user_id))) return { ok: false, error: 'not friends' };
  const board = boardSummaryForUser ? await boardSummaryForUser(targetId).catch(() => null) : null;
  return { ok: true, profile: toPublicProfile(other.rows[0], false, board) };
}

async function getLauncherShop(pool, secret, preview = false) {
  if (preview) return {
    ok: true,
    shop: {
      catalog: CATALOG, wallet: null, preview: true,
      owned: { avatars: [], walls: [], flags: [], layouts: [], backgrounds: [], frames: [], decorations: [], bgms: [], guestbook: false },
      equipped: { avatar: 8, wall: 1, flag: 1, ...launcherAppearance({}) }
    }
  };
  if (!secret) return { ok: false, error: 'bad secret' };
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const result = await db.query('SELECT user_id, name, avatar, stats, updated_at FROM player_profiles WHERE secret=$1 FOR UPDATE', [secret]);
    const row = result.rows[0];
    if (!row) { await db.query('ROLLBACK'); return { ok: false, error: 'bad secret' }; }
    const { wallet, changed } = prepareLauncherWallet(row.stats);
    let current = row;
    if (changed) {
      const stats = { ...object(row.stats), launcherWalletV1: wallet };
      const updated = await db.query(
        'UPDATE player_profiles SET stats=$1::jsonb, updated_at=now() WHERE user_id=$2 RETURNING user_id, name, avatar, stats, updated_at',
        [JSON.stringify(stats), row.user_id]
      );
      current = updated.rows[0];
    }
    await db.query('COMMIT');
    return { ok: true, shop: toShop(current) };
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    db.release();
  }
}

async function changeLauncherItem(pool, secret, itemId, action) {
  if (!secret) return { ok: false, error: 'bad secret' };
  const id = String(itemId || '');
  const catalogItem = BY_ID.get(id);
  const baseMatch = action === 'equip' ? /^(ava|wall|flag)-([1-9]|[12][0-9]|30)$/.exec(id) : null;
  const baseKey = baseMatch ? Number(baseMatch[2]) : 0;
  const baseType = baseMatch?.[1] === 'ava' ? 'avatar' : baseMatch?.[1];
  const baseAllowed = baseType === 'avatar' ? baseKey <= 30 : baseType === 'wall' || baseType === 'flag' ? baseKey <= 3 : false;
  const freeDecor = /^decor-none-(header|side|footer)$/.exec(id);
  const freeItem = action === 'equip' ?
    id === 'layout-default' ? { id, type: 'layout' } :
    id === 'background-default' ? { id, type: 'background' } :
    id === 'frame-none' ? { id, type: 'frame' } :
    id === 'bgm-none' ? { id, type: 'bgm' } :
    freeDecor ? { id, type: 'decoration', slot: freeDecor[1] } : null : null;
  const item = catalogItem || freeItem || (baseAllowed ? { type: baseType, key: baseKey } : null);
  if (!item) return { ok: false, error: 'invalid item' };
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const found = await db.query('SELECT user_id, name, avatar, stats, updated_at FROM player_profiles WHERE secret=$1 FOR UPDATE', [secret]);
    const row = found.rows[0];
    if (!row) { await db.query('ROLLBACK'); return { ok: false, error: 'bad secret' }; }
    const stats = { ...object(row.stats) };
    const { wallet } = prepareLauncherWallet(stats);
    stats.launcherWalletV1 = wallet;
    const client = { ...object(stats.client) };
    const shop = { ...object(client.shop) };
    const owned = purchasedCollection(client);
    const launcherOwned = launcherOwnedItemIds(stats);
    const launcherAvatar = item.type === 'avatar' && item.key >= LAUNCHER_AVATAR_MIN;
    const legacyType = ['avatar', 'wall', 'flag'].includes(item.type) && !launcherAvatar;
    const ownershipKey = item.type === 'avatar' ? 'avatars' : item.type === 'wall' ? 'walls' : 'flags';
    const storeKey = item.type === 'avatar' ? 'ownedAvatars' : item.type === 'wall' ? 'ownedWalls' : 'ownedFlags';
    const alreadyOwned = !catalogItem || (legacyType ? owned[ownershipKey].includes(item.key) :
      ((item.type === 'guestbook' && guestbookUnlocked(stats)) || launcherOwned.includes(item.id)));
    let nextAvatar = row.avatar;
    if (action === 'buy') {
      if (alreadyOwned) { await db.query('ROLLBACK'); return { ok: false, error: 'already_owned' }; }
      if (wallet.coins < item.price) { await db.query('ROLLBACK'); return { ok: false, error: 'insufficient_coins' }; }
      stats.launcherWalletV1 = { ...wallet, coins: wallet.coins - item.price };
      if (legacyType) {
        shop[storeKey] = [...(Array.isArray(shop[storeKey]) ? shop[storeKey] : []), item.key];
        client.shop = shop;
        stats.client = client;
      } else {
        stats.launcherOwnedV1 = { ...object(stats.launcherOwnedV1), items: [...launcherOwned, item.id] };
      }
    } else if (action === 'equip') {
      if (item.type === 'guestbook') { await db.query('ROLLBACK'); return { ok: false, error: 'invalid_action' }; }
      if (!alreadyOwned) { await db.query('ROLLBACK'); return { ok: false, error: 'not_owned' }; }
      if (item.type === 'avatar' && launcherAvatar) {
        stats.launcherAppearanceV1 = { ...launcherAppearance(stats), avatarId: item.key };
      } else if (item.type === 'avatar') {
        nextAvatar = String(item.key);
        stats.launcherAppearanceV1 = { ...launcherAppearance(stats), avatarId: null };
      }
      else if (item.type === 'wall' || item.type === 'flag') stats.wall = { ...object(stats.wall), [item.type === 'wall' ? 'id' : 'flagId']: item.key };
      else {
        const appearance = launcherAppearance(stats);
        if (item.type === 'layout') appearance.layoutId = item.id;
        else if (item.type === 'background') appearance.backgroundId = item.id;
        else if (item.type === 'frame') appearance.frameId = item.id;
        else if (item.type === 'bgm') appearance.bgmId = item.id;
        else if (item.type === 'decoration') appearance.decorations[item.slot] = freeItem ? null : item.id;
        stats.launcherAppearanceV1 = appearance;
      }
    } else {
      await db.query('ROLLBACK');
      return { ok: false, error: 'invalid action' };
    }
    const updated = await db.query(
      'UPDATE player_profiles SET avatar=$1, stats=$2::jsonb, updated_at=now() WHERE user_id=$3 RETURNING user_id, name, avatar, stats, updated_at',
      [nextAvatar, JSON.stringify(stats), row.user_id]
    );
    await db.query('COMMIT');
    return { ok: true, shop: toShop(updated.rows[0]), profile: toPublicProfile(updated.rows[0], true) };
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    db.release();
  }
}

async function setLauncherDecorationPlacement(pool, secret, slot, placement) {
  if (!secret) return { ok: false, error: 'bad secret' };
  if (!DECORATION_SLOTS.includes(slot) || !validPlacement(placement)) return { ok: false, error: 'invalid_placement' };
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const found = await db.query('SELECT user_id, name, avatar, stats, updated_at FROM player_profiles WHERE secret=$1 FOR UPDATE', [secret]);
    const row = found.rows[0];
    if (!row) { await db.query('ROLLBACK'); return { ok: false, error: 'bad secret' }; }
    const stats = { ...object(row.stats) };
    const appearance = launcherAppearance(stats);
    if (!appearance.decorations[slot]) { await db.query('ROLLBACK'); return { ok: false, error: 'empty_slot' }; }
    appearance.decorationPlacement[slot] = normalizedPlacement(placement);
    stats.launcherAppearanceV1 = appearance;
    const updated = await db.query(
      'UPDATE player_profiles SET stats=$1::jsonb, updated_at=now() WHERE user_id=$2 RETURNING user_id, name, avatar, stats, updated_at',
      [JSON.stringify(stats), row.user_id]
    );
    await db.query('COMMIT');
    return { ok: true, profile: toPublicProfile(updated.rows[0], true), shop: toShop(updated.rows[0]) };
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    db.release();
  }
}

module.exports = { CATALOG, toPublicProfile, toCardPublicProfile, toShop, getLauncherProfile, getLauncherShop, changeLauncherItem, setLauncherDecorationPlacement, sanitizeLauncherStatsPatch, guestbookUnlocked, launcherAvatarForRow };
