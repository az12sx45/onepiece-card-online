(() => {
  'use strict';
  const ORIGIN = 'https://onepiece-card-online.onrender.com';
  const GAME_DISPLAY_MODES = new Set(['borderless', 'fullscreen']);
  const DEFAULT_PREFERENCES = Object.freeze({ minimizeToTrayOnGameLaunch: false, gameDisplayMode: 'fullscreen' });
  const callbacks = new Map(), subscriptions = new Map();
  let requestSequence = 0, stateRevision = 0, nativeState = {}, authenticated = false;
  let restorePending = false, restorePromise = null, restoreTimer = null;
  class EventEmitter {
    constructor() { this.listeners = new Map(); }
    on(name, fn) { const list = this.listeners.get(name) || []; list.push(fn); this.listeners.set(name, list); return this; }
    emit(name, ...args) { for (const fn of this.listeners.get(name) || []) fn(...args); }
  }
  function subscribe(name, fn) {
    if (typeof fn !== 'function') return () => {};
    const list = subscriptions.get(name) || new Set(); list.add(fn); subscriptions.set(name, list);
    return () => list.delete(fn);
  }
  function publish(name, value) { for (const fn of subscriptions.get(name) || []) fn(value); }
  function mobileAssets(value, key = '') {
    if (typeof value === 'string' && /^(?:asset|src|url|.*Asset)$/i.test(key) && /^opui:\/\/launcher\/(?:images|audio|videos)\//.test(value)) {
      const relative = value.slice('opui://launcher/'.length);
      return !relative.includes('..') && !relative.includes('\\') ? 'poapp://app/launcher-assets/' + relative : '';
    }
    if (Array.isArray(value)) return value.map(item => mobileAssets(item, key));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mobileAssets(v, k)]));
    return value;
  }
  function nativeCall(method, args = {}) {
    return new Promise(resolve => {
      if (!window.TabletopAndroid?.postMessage) return resolve({ ok: false, error: 'Android bridge unavailable' });
      const id = String(++requestSequence);
      const timer = setTimeout(() => { callbacks.delete(id); resolve({ ok: false, error: 'native timeout' }); }, method === 'installGame' ? 1800000 : 30000);
      callbacks.set(id, result => { clearTimeout(timer); resolve(result); });
      try { window.TabletopAndroid.postMessage(JSON.stringify({ id, method, args })); }
      catch { clearTimeout(timer); callbacks.delete(id); resolve({ ok: false, error: 'native request failed' }); }
    });
  }
  window.__tabletopNativeResolve = (id, result) => { const cb = callbacks.get(String(id)); callbacks.delete(String(id)); cb?.(result); };
  function safeInteger(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
}


function sanitizePreferences(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    minimizeToTrayOnGameLaunch: source.minimizeToTrayOnGameLaunch === true,
    gameDisplayMode: GAME_DISPLAY_MODES.has(source.gameDisplayMode) ? source.gameDisplayMode : DEFAULT_PREFERENCES.gameDisplayMode
  };
}

function sanitizeAccount(profile, username = '') {
  const source = profile && typeof profile === 'object' ? profile : {};
  const client = source.stats?.client && typeof source.stats.client === 'object' ? source.stats.client : {};
  const userId = safeInteger(source.user_id ?? source.userId);
  const needsDisplayName = !String(source.name || '').trim();
  const name = String(source.name || (userId ? `玩家 ${userId}（尚未取名）` : '航海者')).trim().slice(0, 40) || '航海者';
  const avatar = Math.max(1, Math.min(50, safeInteger(source.avatar, 8)));
  const equippedAvatar = safeInteger(source.stats?.launcherAppearanceV1?.avatarId);
  const ownedAvatars = Array.isArray(source.stats?.launcherOwnedV1?.items) ? source.stats.launcherOwnedV1.items : [];
  const launcherAvatar = equippedAvatar >= 51 && equippedAvatar <= 62 && ownedAvatars.includes(`ava-${equippedAvatar}`)
    ? equippedAvatar : avatar;
  const title = String(client.titles?.equipped || '偉大航道航海者').trim().slice(0, 60) || '偉大航道航海者';
  const coins = safeInteger(client.totals?.coins);
  return { username: String(username || '').trim().toLowerCase().slice(0, 24), userId, name, avatar, launcherAvatar, title, coins, needsDisplayName };
}


  class MobileAuth extends EventEmitter {
    constructor() {
      super(); this.state = { account: null, deviceId: '', preferences: { ...DEFAULT_PREFERENCES } };
      this.secretMemory = ''; this.previewMode = false; this.socket = null; this.activePage = 'android-launcher';
    }
    async connect() {
      if (this.socket?.connected) return this.socket;
      if (!this.socket) {
        this.socket = window.io(ORIGIN, { transports: ['websocket', 'polling'], reconnection: true, timeout: 15000 });
        this.socket.on('connect', () => { this.setPresence(this.activePage).catch(() => {}); this.emit('social-event', 'connect'); });
        for (const event of ['disconnect', 'FRIENDS_DIRTY', 'DM_NEW']) this.socket.on(event, payload => this.emit('social-event', event, payload));
        this.socket.on('SESSION_KICK', async payload => {
          await this.clearAccount(); publish('session-kicked', { reason: String(payload?.reason || 'takeover') }); await broadcast();
        });
      }
      if (this.socket.connected) return this.socket;
      await new Promise((resolve, reject) => {
        const cleanup = () => { clearTimeout(timer); this.socket.off('connect', connected); this.socket.off('connect_error', failed); };
        const connected = () => { cleanup(); resolve(); }, failed = () => { cleanup(); reject(new Error('offline')); };
        const timer = setTimeout(() => { cleanup(); reject(new Error('timeout')); }, 18000);
        this.socket.once('connect', connected); this.socket.once('connect_error', failed); this.socket.connect();
      });
      return this.socket;
    }
    async emitAck(event, payload, timeout = 15000) {
      try {
        const socket = await this.connect();
        return await new Promise(resolve => socket.timeout(timeout).emit(event, payload, (error, result) => resolve(error ? { ok: false, error: 'timeout' } : mobileAssets(result) || { ok: false, error: 'unknown' })));
      } catch (error) { return { ok: false, error: error.message || 'offline' }; }
    }
    async setPresence(page) {
      this.activePage = String(page || 'android-launcher').slice(0, 80);
      if (!this.secretMemory) return { ok: false, error: 'not authenticated' };
      return this.emitAck('PRESENCE_SET', { secret: this.secretMemory, page: this.activePage, deviceId: this.state.deviceId });
    }
    accountSummary() { return this.state.account ? { ...this.state.account } : null; }
    getSecretForGame() { return this.secretMemory; }
    async save() {
      const result = await nativeCall('saveSession', { account: this.accountSummary(), secret: this.secretMemory });
      if (result?.ok === false) throw new Error(result.error || 'secure storage failed');
    }
    async clearAccount() {
      ++sessionEpoch; authenticated = false; this.secretMemory = ''; this.state.account = null;
      restorePending = false; clearTimeout(restoreTimer); restoreTimer = null;
      this.emit('social-event', 'reset'); this.socket?.disconnect(); this.socket = null;
      return nativeCall('clearSession');
    }
    async authenticate(mode, credentials) {
      const epoch = ++sessionEpoch;
      const username = String(credentials?.username || '').trim().toLowerCase();
      const result = await this.emitAck(mode === 'register' ? 'AUTH_REGISTER' : 'AUTH_LOGIN', { username, password: String(credentials?.password || ''), deviceId: this.state.deviceId });
      if (epoch !== sessionEpoch) return { ok: false, error: 'session changed' };
      if (!result?.ok || !result.secret) return result;
      this.secretMemory = String(result.secret);
      const profile = await this.emitAck('PROFILE_GET', { secret: this.secretMemory });
      if (epoch !== sessionEpoch) return { ok: false, error: 'session changed' };
      if (!profile?.ok || !profile.profile) { this.secretMemory = ''; return { ok: false, error: profile?.error || 'profile unavailable' }; }
      this.state.account = sanitizeAccount(profile.profile, result.username || username);
      try { await this.save(); } catch { await this.clearAccount(); return { ok: false, error: 'secure storage failed' }; }
      if (epoch !== sessionEpoch) return { ok: false, error: 'session changed' };
      restorePending = false; clearTimeout(restoreTimer); restoreTimer = null;
      authenticated = true; this.setPresence('android-launcher').catch(() => {}); social.start().catch(() => {});
      return { ok: true, account: this.accountSummary(), state: await broadcast() };
    }
      async setDisplayName(value) {
    if (!this.secretMemory || !this.state.account) return { ok: false, error: 'not authenticated' };
    const name = String(value || '').replace(/\s+/g, ' ').trim();
    if (!name || name.length > 16) return { ok: false, error: 'bad_name' };
    const secret = this.secretMemory;
    const result = await this.emitAck('PROFILE_UPDATE', { secret, patch: { name } });
    if (secret !== this.secretMemory) return { ok: false, error: 'session changed' };
    if (!result?.ok || !result.profile) return { ok: false, error: result?.error || 'profile unavailable' };
    this.state.account = { ...sanitizeAccount(result.profile, this.state.account.username), secretCipher: this.state.account.secretCipher };
    await this.save();
    await this.setPresence(this.activePage);
    return { ok: true, account: this.accountSummary() };
  }

  async launcherRequest(eventName, payload = {}) {
    if (!this.secretMemory || !this.state.account || this.previewMode) return { ok: false, error: 'not authenticated' };
    const secret = this.secretMemory;
    const result = await this.emitAck(eventName, { secret, ...payload, crewContentRevision: 1 });
    return secret === this.secretMemory ? result : { ok: false, error: 'session changed' };
  }

  async getLauncherProfile(userId = 0) {
    const id = Number(userId);
    if (!Number.isSafeInteger(id) || id < 0) return { ok: false, error: 'bad userId' };
    return this.launcherRequest('LAUNCHER_PROFILE_GET', { userId: id });
  }

  async saveLauncherCard(card) {
    if (!card || typeof card !== 'object') return { ok: false, error: 'invalid card' };
    const displayName = typeof card.displayName === 'string' ? card.displayName.replace(/\s+/g, ' ').trim() : '';
    const tagline = typeof card.tagline === 'string' ? card.tagline.trim() : '';
    const avatarId = Number(card.avatarId);
    if (!displayName || displayName.length > 32 || tagline.length > 120 || !Number.isInteger(avatarId) || avatarId < 0 || avatarId > 62) {
      return { ok: false, error: 'invalid card' };
    }
    return this.launcherRequest('LAUNCHER_CARD_SET', { displayName, tagline, avatarId });
  }

  async getLauncherShop(options = {}) {
    if (options?.preview === true && this.previewMode) {
      return this.emitAck('LAUNCHER_SHOP_GET', { preview: true, crewContentRevision: 1 });
    }
    return this.launcherRequest('LAUNCHER_SHOP_GET');
  }

  async getLauncherAnnouncements() {
    return this.launcherRequest('LAUNCHER_ANNOUNCEMENTS_GET');
  }

  async markLauncherAnnouncementsRead(announcementIds) {
    if (!Array.isArray(announcementIds) || !announcementIds.length || announcementIds.length > 100 || announcementIds.some(id => typeof id !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,95}$/.test(id))) return { ok: false, error: 'invalid announcements' };
    return this.launcherRequest('LAUNCHER_ANNOUNCEMENT_READ', { announcementIds: [...new Set(announcementIds)] });
  }

  async changeLauncherShopItem(action, itemId) {
    const customItems = new Set([
      'layout-default', 'layout-grand-line', 'layout-bounty-board', 'layout-captain-quarters',
      'background-default', 'background-luffy', 'background-zoro', 'background-nami',
      'frame-none', 'frame-luffy', 'frame-zoro',
      'decor-header-luffy', 'decor-header-chopper', 'decor-side-zoro', 'decor-side-nami',
      'decor-footer-ace', 'decor-footer-robin',
      'decor-none-header', 'decor-none-side', 'decor-none-footer',
      'bgm-none', 'bgm-harbor', 'bgm-night-watch', 'bgm-voyage', 'guestbook-1'
    ]);
    for (const id of [
      'background-sunny-deck', 'background-sunny-kitchen', 'background-sunny-library',
      'frame-sunny', 'frame-straw-hat',
      'layout-sunny-deck', 'layout-sunny-kitchen', 'layout-sunny-library',
      'decor-header-luffy-chibi', 'decor-header-chopper-chibi',
      'decor-side-zoro-chibi', 'decor-side-nami-chibi',
      'decor-footer-sanji-chibi', 'decor-footer-robin-chibi'
    ]) customItems.add(id);
    const roomProduct = /^room-(?:scene-(?:sunny-deck|sunny-kitchen|sunny-library|sunny-workshop|sunny-aquarium)|furniture-(?:helm|map-table|treasure-chest|tangerine-tree|swords-rack|kitchen-table|galley-stove|bookshelf|medicine-cabinet|piano|tool-bench|supply-rack|log-pose-desk|repair-cart|library-cart|medical-cart|den-den-desk)|character-(?:luffy|zoro|nami|chopper|sanji|robin|usopp|franky|brook|jinbe|ace|sabo|law|hancock))$/.test(itemId);
    if (typeof itemId !== 'string' || !(/^(?:ava-(?:[1-9]|[1-5][0-9]|6[0-2])|(?:wall|flag)-(?:[1-9]|[1-4][0-9]|50)|bgm-op-(?:0[1-9]|1[0-9]|20))$/.test(itemId) || roomProduct || customItems.has(itemId))) {
      return { ok: false, error: 'invalid item' };
    }
    const eventName = action === 'buy' ? 'LAUNCHER_SHOP_BUY' : action === 'equip' ? 'LAUNCHER_SHOP_EQUIP' : '';
    if (!eventName) return { ok: false, error: 'invalid action' };
    const result = await this.launcherRequest(eventName, { itemId });
    if (result?.ok && result.profile && result.shop && this.state.account) {
      this.state.account = {
        ...this.state.account,
        name: String(result.profile.name || this.state.account.name),
        avatar: (() => {
          const id = safeInteger(result.profile.avatar);
          return id >= 1 && id <= 50 ? id : this.state.account.avatar;
        })(),
        launcherAvatar: (() => {
          const id = safeInteger(result.profile.avatar);
          return id >= 1 && id <= 62 ? id : this.state.account.launcherAvatar || this.state.account.avatar;
        })(),
        title: String(result.profile.title || this.state.account.title)
      };
      await this.save();
    }
    return result;
  }

  async buyLauncherItem(itemId) { return this.changeLauncherShopItem('buy', itemId); }
  async equipLauncherItem(itemId) { return this.changeLauncherShopItem('equip', itemId); }

  async saveLauncherBgmPlaylist(bgmIds) {
    if (!Array.isArray(bgmIds) || bgmIds.length > 23 || new Set(bgmIds).size !== bgmIds.length ||
        bgmIds.some(id => typeof id !== 'string' || !/^(?:bgm-(?:harbor|night-watch|voyage)|bgm-op-(?:0[1-9]|1[0-9]|20))$/.test(id))) {
      return { ok: false, error: 'invalid_bgm_playlist' };
    }
    return this.launcherRequest('LAUNCHER_BGM_PLAYLIST_SET', { bgmIds });
  }

  async getLauncherComments(userId = 0, beforeId = 0) {
    const id = Number(userId);
    const before = Number(beforeId);
    if (!Number.isSafeInteger(id) || id < 0 || !Number.isSafeInteger(before) || before < 0) {
      return { ok: false, error: 'invalid comment page' };
    }
    return this.launcherRequest('LAUNCHER_COMMENTS_GET', { userId: id, beforeId: before });
  }

  async postLauncherComment(userId = 0, body = '') {
    const id = Number(userId);
    if (!Number.isSafeInteger(id) || id < 0 || typeof body !== 'string' || !body.trim() || body.length > 280) {
      return { ok: false, error: 'invalid comment' };
    }
    return this.launcherRequest('LAUNCHER_COMMENT_POST', { userId: id, body });
  }

  async deleteLauncherComment(messageId) {
    const id = Number(messageId);
    if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, error: 'invalid comment' };
    return this.launcherRequest('LAUNCHER_COMMENT_DELETE', { messageId: id });
  }

  async saveLauncherDecorationPlacement(slot, placement) {
    if (!['header', 'side', 'footer'].includes(slot) || !placement || typeof placement !== 'object') {
      return { ok: false, error: 'invalid placement' };
    }
    const { x, y, scale } = placement;
    if (![x, y, scale].every(Number.isFinite) || x < 5 || x > 95 || y < 5 || y > 95 || scale < 0.5 || scale > 1.5) {
      return { ok: false, error: 'invalid placement' };
    }
    return this.launcherRequest('LAUNCHER_DECORATION_PLACEMENT_SET', { slot, placement: { x, y, scale } });
  }

  async saveLauncherRoom(room) {
    if (!room || typeof room !== 'object' || Array.isArray(room)) return { ok: false, error: 'invalid_room' };
    const { revision, sceneId, placements, characters, capacityVersion, scenes } = room;
    if (!Number.isSafeInteger(revision) || revision < 0 || typeof sceneId !== 'string' ||
        !Array.isArray(placements) || placements.length > 24 || !Array.isArray(characters) || characters.length > 10 ||
        characters.length > 8 && capacityVersion !== 2) {
      return { ok: false, error: 'invalid_room' };
    }
    const sceneValid = sceneId === 'room-scene-default' ||
      /^room-scene-(?:sunny-deck|sunny-kitchen|sunny-library|sunny-workshop|sunny-aquarium)$/.test(sceneId);
    const unique = values => new Set(values.map(value => value.itemId)).size === values.length;
    const coordinates = entry => entry && Number.isFinite(entry.x) && Number.isFinite(entry.y) &&
      entry.x >= 0 && entry.x <= 960 && entry.y >= 0 && entry.y <= 540;
    const validScene = id => id === 'room-scene-default' ||
      /^room-scene-(?:sunny-deck|sunny-kitchen|sunny-library|sunny-workshop|sunny-aquarium)$/.test(id);
    const validFurniture = entry => coordinates(entry) && /^room-furniture-(?:helm|map-table|treasure-chest|tangerine-tree|swords-rack|kitchen-table|galley-stove|bookshelf|medicine-cabinet|piano|tool-bench|supply-rack|log-pose-desk|repair-cart|library-cart|medical-cart|den-den-desk|aquarium-tank|fishing-gear-rack|galley-icebox|crew-tea-table)$/.test(entry.itemId) &&
          Number.isFinite(entry.scale) && entry.scale >= .5 && entry.scale <= 1.5 &&
          (entry.rotation === undefined || Number.isInteger(entry.rotation) && entry.rotation >= 0 && entry.rotation <= 3) &&
          (entry.flip === undefined || typeof entry.flip === 'boolean') &&
          (entry.rotation !== undefined || typeof entry.flip === 'boolean') &&
          (entry.rotation === undefined || entry.flip === undefined || entry.flip === (entry.rotation === 2));
    const validCharacter = entry => coordinates(entry) && /^room-character-(?:luffy|zoro|nami|chopper|sanji|robin|usopp|franky|brook|jinbe|ace|sabo|law|hancock)$/.test(entry.itemId);
    const layouts = scenes === undefined ? { [sceneId]: { placements, characters } } : scenes;
    if (!sceneValid || !unique(placements) || !unique(characters) ||
        !layouts || typeof layouts !== 'object' || Array.isArray(layouts) ||
        Object.keys(layouts).length > 6 || !Object.prototype.hasOwnProperty.call(layouts, sceneId)) {
      return { ok: false, error: 'invalid_room' };
    }
    const allFurniture = [], allCharacters = [];
    for (const [id, layout] of Object.entries(layouts)) {
      if (!validScene(id) || !layout || !Array.isArray(layout.placements) || !Array.isArray(layout.characters) ||
          layout.placements.length > 24 || layout.characters.length > 10 ||
          layout.characters.length > 8 && capacityVersion !== 2 ||
          !layout.placements.every(validFurniture) || !layout.characters.every(validCharacter)) return { ok: false, error: 'invalid_room' };
      allFurniture.push(...layout.placements); allCharacters.push(...layout.characters);
    }
    if (!unique(allFurniture) || !unique(allCharacters) || scenes !== undefined && capacityVersion !== 2)
      return { ok: false, error: 'invalid_room' };
    if (scenes !== undefined) {
      const active = layouts[sceneId];
      const sameEntries = (flat, nested, furniture) => flat.length === nested.length && flat.every((entry, index) => {
        const saved = nested[index];
        return entry.itemId === saved.itemId && entry.x === saved.x && entry.y === saved.y &&
          (!furniture || entry.scale === saved.scale && (entry.rotation ?? (entry.flip ? 2 : 0)) ===
            (saved.rotation ?? (saved.flip ? 2 : 0)));
      });
      if (!sameEntries(placements, active.placements, true) || !sameEntries(characters, active.characters, false))
        return { ok: false, error: 'invalid_room' };
    }
    return this.launcherRequest('LAUNCHER_ROOM_SET', { revision, sceneId, placements, characters, capacityVersion,
      ...(scenes === undefined ? {} : { scenes }) });
  }

  async getLauncherLife() {
    return this.launcherRequest('LAUNCHER_LIFE_GET');
  }

  async commandLauncherLife(command) {
    if (!command || typeof command !== 'object' || Array.isArray(command) ||
        typeof command.requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(command.requestId) ||
        !Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 0 ||
        !['work.reserve','work.activate','work.complete','work.cancel','directive.set','character.interact','event.record','activity.record','arrival.ack','checkpoint','minigame.start','minigame.answer','minigame.finish','minigame.cancel','minigame.retry','fish.place','fish.release'].includes(command.type) ||
        !command.payload || typeof command.payload !== 'object' || Array.isArray(command.payload) ||
        JSON.stringify(command.payload).length > 2048) return { ok: false, error: 'invalid_command' };
    const { requestId, expectedRevision, type, payload } = command;
    return this.launcherRequest('LAUNCHER_LIFE_COMMAND', { requestId, expectedRevision, type, payload });
  }

  async launcherCharacterRequest(eventName, itemId, action) {
    if (typeof itemId !== 'string' ||
        !/^room-character-(?:luffy|zoro|nami|chopper|sanji|robin|usopp|franky|brook|jinbe|ace|sabo|law|hancock)$/.test(itemId)) {
      return { ok: false, error: 'invalid_character' };
    }
    return this.launcherRequest(eventName, action ? { itemId, action } : { itemId });
  }

  async getLauncherCharacter(itemId) {
    return this.launcherCharacterRequest('LAUNCHER_CHARACTER_GET', itemId);
  }

  async interactLauncherCharacter(itemId, action) {
    if (action !== 'talk') return { ok: false, error: 'invalid_action' };
    return this.launcherCharacterRequest('LAUNCHER_CHARACTER_INTERACT', itemId, action);
  }

  async startLauncherCharacterWork(itemId) {
    return this.launcherCharacterRequest('LAUNCHER_CHARACTER_WORK_START', itemId);
  }

  async claimLauncherCharacterWork(itemId) {
    return this.launcherCharacterRequest('LAUNCHER_CHARACTER_WORK_CLAIM', itemId);
  }


  }
  const ACTIONS = Object.freeze({ add: 'FRIEND_ADD_BY_NAME', accept: 'FRIEND_REQUEST_ACCEPT', decline: 'FRIEND_REQUEST_DECLINE', remove: 'FRIEND_REMOVE' });
function person(value) {
  const userId = Number(value?.userId);
  if (!Number.isSafeInteger(userId) || userId <= 0) return null;
  const avatarId = Number(value.avatar);
  return { userId, name: String(value.name || `玩家${userId}`).slice(0, 80), avatar: Number.isSafeInteger(avatarId) && avatarId >= 1 && avatarId <= 62 ? avatarId : 8, online: value.online === true, page: String(value.page || '').slice(0, 80) };
}
function message(value) {
  if (!value?.id || !(Number(value.from) > 0)) return null;
  return { id: String(value.id).slice(0, 80), from: Number(value.from), to: Number(value.to) || 0, body: String(value.body || '').slice(0, 400), ts: Number(value.ts) || 0 };
}

class SocialService extends EventEmitter {
  constructor(auth) {
    super();
    this.auth = auth;
    this.epoch = 0;
    this.reset();
    this.poll = setInterval(() => {
      if (this.userId && this.auth.socket?.connected) this.refresh().catch(() => {});
    }, 60000);
    this.poll.unref?.();
    auth.on('social-event', (event, payload) => {
      if (event === 'reset') return this.reset();
      if (event === 'connect') { this.start().catch(() => {}); return; }
      if (event === 'disconnect') { this.ready = false; this.publish(); return; }
      if (!this.userId || !auth.getSecretForGame()) return;
      if (event === 'FRIENDS_DIRTY') {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = setTimeout(() => this.refresh().catch(() => {}), 250);
      }
      if (event === 'DM_NEW') {
        const item = message(payload);
        if (!item || item.from === this.userId || item.to !== this.userId) return;
        if (this.append(item.from, item)) this.unread[item.from] = (this.unread[item.from] || 0) + 1;
        this.publish();
        if (!this.friends.some(p => p.userId === item.from)) this.refresh().catch(() => {});
      }
    });
  }
  reset() {
    this.epoch++;
    clearTimeout(this.refreshTimer);
    this.userId = 0;
    this.ready = false;
    this.starting = null;
    this.refreshing = null;
    this.friends = []; this.requestsIn = []; this.requestsOut = [];
    this.conversations = {}; this.unread = {};
    this.publish();
  }
  snapshot() {
    return { userId: this.userId, ready: this.ready, friends: this.friends, requestsIn: this.requestsIn, requestsOut: this.requestsOut, conversations: this.conversations, unread: this.unread };
  }
  publish() { this.emit('state', this.snapshot()); }
  async start() {
    const userId = Number(this.auth.accountSummary()?.userId);
    if (!userId || !this.auth.getSecretForGame() || this.auth.previewMode) return;
    if (this.userId !== userId) { this.reset(); this.userId = userId; }
    if (this.starting) return this.starting;
    const epoch = this.epoch;
    const pending = (async () => {
      const result = await this.auth.emitAck('SOCIAL_AUTH', { secret: this.auth.getSecretForGame(), deviceId: this.auth.state.deviceId });
      if (epoch !== this.epoch) return;
      this.ready = result?.ok === true;
      this.publish();
      if (this.ready) await this.refresh();
    })();
    this.starting = pending;
    try { await pending; } finally { if (this.starting === pending) this.starting = null; }
  }
  async refresh() {
    if (!this.auth.getSecretForGame() || !this.userId) return;
    if (this.refreshing) return this.refreshing;
    const epoch = this.epoch;
    const pending = (async () => {
      const result = await this.auth.emitAck('FRIENDS_GET', { secret: this.auth.getSecretForGame(), launcher: true });
      if (epoch !== this.epoch) return;
      if (result?.ok) {
        for (const key of ['friends', 'requestsIn', 'requestsOut']) this[key] = (Array.isArray(result[key]) ? result[key] : []).slice(0, 200).map(person).filter(Boolean);
        this.ready = true;
      } else this.ready = false;
      this.publish();
    })();
    this.refreshing = pending;
    try { await pending; } finally { if (this.refreshing === pending) this.refreshing = null; }
  }
  append(peerId, item) {
    const list = this.conversations[peerId] || [];
    if (list.some(m => m.id === item.id)) return false;
    this.conversations[peerId] = [...list, item].sort((a, b) => a.ts - b.ts).slice(-80);
    return true;
  }
  async request(action, payload = {}) {
    if (!this.auth.getSecretForGame() || this.auth.previewMode) return { ok: false, error: 'not authenticated' };
    await this.startIfNeeded();
    const epoch = this.epoch;
    const secret = this.auth.getSecretForGame();
    if (action === 'refresh') { await this.refresh(); return { ok: true, state: this.snapshot() }; }
    const userId = Number(payload?.userId);
    if (action !== 'add' && (!Number.isSafeInteger(userId) || userId <= 0 || userId === this.userId)) return { ok: false, error: 'invalid player' };
    if (action === 'read') { this.unread[userId] = 0; this.publish(); return { ok: true }; }
    if (action === 'history' || action === 'send') {
      if (!this.friends.some(p => p.userId === userId)) return { ok: false, error: 'not friends' };
      const body = String(payload.body || '').trim();
      if (action === 'send' && (!body || body.length > 400)) return { ok: false, error: 'invalid message' };
      const result = await this.auth.emitAck(action === 'history' ? 'DM_HISTORY' : 'DM_SEND', action === 'history' ? { secret, withUserId: userId, limit: 80 } : { secret, toUserId: userId, body });
      if (epoch !== this.epoch) return { ok: false, error: 'session changed' };
      if (result?.ok) {
        const items = action === 'history' ? result.messages || [] : [result.message];
        for (const value of items) { const item = message(value); if (item) this.append(userId, item); }
        this.publish();
      }
      return { ok: result?.ok === true, error: String(result?.error || '').slice(0, 100) };
    }
    if (!ACTIONS[action]) return { ok: false, error: 'invalid action' };
    const name = String(payload.name || '').trim();
    if (action === 'add' && (!name || name.length > 80)) return { ok: false, error: 'no name' };
    const result = await this.auth.emitAck(ACTIONS[action], action === 'add' ? { secret, name } : { secret, userId });
    if (epoch !== this.epoch) return { ok: false, error: 'session changed' };
    if (result?.ok) await this.refresh();
    return { ok: result?.ok === true, error: String(result?.error || '').slice(0, 100) };
  }
  async startIfNeeded() { if (!this.ready) await this.start(); }
}


  let sessionEpoch = 0;
  const auth = new MobileAuth(), social = new SocialService(auth);
  social.on('state', state => publish('social-state', state));
  async function verifyRestoredSession() {
    if (restorePromise) return restorePromise;
    if (!restorePending || !auth.secretMemory || !auth.state.account) return;
    restorePromise = (async () => {
      const epoch = sessionEpoch, secret = auth.secretMemory;
      const result = await auth.emitAck('PROFILE_GET', { secret });
      if (epoch !== sessionEpoch || secret !== auth.secretMemory) return;
      if (result?.ok && result.profile) {
        auth.state.account = sanitizeAccount(result.profile, auth.state.account.username);
        await auth.save();
        if (epoch !== sessionEpoch || secret !== auth.secretMemory) return;
        authenticated = true; restorePending = false;
        clearTimeout(restoreTimer); restoreTimer = null; social.start().catch(() => {});
      } else if ((result?.ok && !result.profile) || ['bad secret', 'invalid secret', 'unauthorized secret', 'unauthorized', 'invalid session', 'session expired', 'not authenticated', 'no secret'].includes(String(result?.error || '').toLowerCase())) {
        await auth.clearAccount();
      } else {
        // Temporary network failures retain the encrypted session and retry.
        clearTimeout(restoreTimer);
        restoreTimer = setTimeout(() => { restoreTimer = null; verifyRestoredSession().then(broadcast).catch(() => {}); }, 8000);
        restoreTimer?.unref?.();
      }
    })().finally(() => { restorePromise = null; });
    return restorePromise;
  }
  let loading;
  async function ensureLoaded() {
    if (loading) { await loading; if (restorePending) await verifyRestoredSession(); return; }
    loading = (async () => {
      nativeState = await nativeCall('getNativeState');
      if (nativeState?.ok === false) throw new Error(nativeState.error);
      auth.state.deviceId = nativeState.deviceId;
      auth.state.preferences = { ...DEFAULT_PREFERENCES, ...nativeState.preferences };
      auth.state.account = nativeState.account || null; auth.secretMemory = nativeState.secret || '';
      if (!auth.secretMemory || !auth.state.account) return;
      restorePending = true; await verifyRestoredSession();
    })().catch(error => { loading = null; throw error; });
    return loading;
  }
  function compose() {
    const games = Object.fromEntries(['card', 'board', 'chess'].map(id => [id, { status: 'missing', hasInstalled: false, removable: false, ...(nativeState.games?.[id] || {}) }]));
    return { stateRevision: ++stateRevision, authenticated, restoringSession: false, previewMode: false,
      profile: authenticated ? auth.accountSummary() : null, preferences: auth.state.preferences,
      cacheRoot: nativeState.cacheRoot || 'iPhone App 儲存空間', freeBytes: nativeState.freeBytes ?? null, catalogSource: 'remote', games };
  }
  async function broadcast() { const state = compose(); publish('state', state); return state; }
  async function nativeStateRefresh() {
    const next = await nativeCall('getNativeState');
    if (next?.ok !== false) nativeState = next;
    return broadcast();
  }
  window.__tabletopNativeEvent = (name, value) => {
    if (name === 'gameStateChanged' || name === 'gamesState' || name === 'state') nativeStateRefresh().catch(() => {});
    else publish(name, (name === 'update-state' || name === 'content-update-state') ? normalizeUpdate(value, name === 'content-update-state') : value);
  };
  function normalizeUpdate(value, content) {
    const state = { ...(value || {}) };
    if (state.status === 'not-published') state.status = content ? 'unavailable' : 'error';
    state.cancelled = state.status === 'paused';
    if (state.cancelled) { state.status = 'available'; state.message = state.error || '更新已取消。'; }
    return state;
  }
  async function accountMethod(method, ...args) {
    await ensureLoaded();
    if (!authenticated) return { ok: false, error: 'not authenticated' };
    const result = await auth[method](...args);
    if (result?.ok && ['setDisplayName', 'buyLauncherItem', 'equipLauncherItem'].includes(method)) {
      return { ...result, state: await broadcast() };
    }
    return result;
  }
  async function gameAction(method, gameId) {
    if (!['card', 'board', 'chess'].includes(gameId)) return { ok: false, error: 'invalid game' };
    await ensureLoaded();
    if (!authenticated) return { ok: false, error: 'not authenticated' };
    const result = await nativeCall(method, { gameId });
    return { ...result, state: await nativeStateRefresh() };
  }
  const api = {
    getState: async () => { try { await ensureLoaded(); return compose(); } catch (error) { return { ok: false, error: error.message }; } },
    enterPreview: async () => ({ ok: false, error: '正式版不提供設計預覽。' }),
    login: async credentials => { await ensureLoaded(); return auth.authenticate('login', credentials); },
    register: async credentials => { await ensureLoaded(); return auth.authenticate('register', credentials); },
    logout: async () => { ++sessionEpoch; await auth.clearAccount(); return { ok: true, state: await broadcast() }; },
    getSocialState: async () => ({ ok: true, state: social.snapshot() }),
    socialRequest: async (action, payload) => { await ensureLoaded(); return authenticated ? social.request(action, payload) : { ok: false, error: 'not authenticated' }; },
    setPreferences: async preferences => {
      const result = await nativeCall('savePreferences', preferences);
      if (result?.ok === false) return result;
      auth.state.preferences = { ...auth.state.preferences, ...preferences }; return { ok: true, state: await broadcast() };
    },
    chooseCacheLocation: async () => { const result = await nativeCall('chooseCacheLocation'); return { ...result, state: await nativeStateRefresh() }; },
    onState: fn => subscribe('state', fn), onProgress: fn => subscribe('progress', fn),
    onSocialState: fn => subscribe('social-state', fn), onSessionKicked: fn => subscribe('session-kicked', fn),
    onLauncherUpdate: fn => subscribe('update-state', fn), onLauncherContentUpdate: fn => subscribe('content-update-state', fn)
  };
  for (const method of ['setDisplayName', 'getLauncherProfile', 'saveLauncherCard', 'getLauncherShop', 'getLauncherAnnouncements',
    'markLauncherAnnouncementsRead', 'buyLauncherItem', 'equipLauncherItem', 'saveLauncherBgmPlaylist', 'getLauncherComments',
    'postLauncherComment', 'deleteLauncherComment', 'saveLauncherDecorationPlacement', 'saveLauncherRoom', 'getLauncherLife',
    'commandLauncherLife', 'getLauncherCharacter', 'interactLauncherCharacter', 'startLauncherCharacterWork', 'claimLauncherCharacterWork']) {
    api[method] = (...args) => accountMethod(method, ...args);
  }
  for (const method of ['installGame', 'cancelInstall', 'uninstallGame', 'launchGame']) api[method] = gameId => gameAction(method, gameId);
  for (const method of ['getLauncherUpdateState', 'checkLauncherUpdate', 'downloadLauncherUpdate', 'cancelLauncherUpdate', 'applyLauncherUpdate',
    'getLauncherContentUpdateState', 'checkLauncherContentUpdate', 'applyLauncherContentUpdate']) api[method] = async () => {
      const result = await nativeCall(method);
      const state = normalizeUpdate(result?.state || result, method.includes('Content'));
      return { ...result, ok: result?.ok !== false, state };
    };
  window.onePieceDesktop = Object.freeze(api);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && authenticated) { auth.setPresence('android-launcher').catch(() => {}); social.refresh().catch(() => {}); nativeStateRefresh().catch(() => {}); }
    else if (!document.hidden && restorePending) verifyRestoredSession().then(broadcast).catch(() => {});
  });
  window.addEventListener?.('online', () => { if (restorePending) verifyRestoredSession().then(broadcast).catch(() => {}); });
})();
