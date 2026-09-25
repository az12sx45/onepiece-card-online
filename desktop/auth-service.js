'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { io } = require('socket.io-client');
const { safeStorage } = require('electron');

const STATE_SCHEMA = 1;
const STATE_FILES = ['launcher-state-a.json', 'launcher-state-b.json'];
const GAME_DISPLAY_MODES = new Set(['borderless', 'fullscreen']);
const DEFAULT_PREFERENCES = Object.freeze({
  minimizeToTrayOnGameLaunch: false,
  gameDisplayMode: 'borderless'
});

function safeInteger(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
}

function createDeviceId() {
  return `desktop-${crypto.randomBytes(16).toString('hex')}`;
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

function validCipher(value) {
  return value && typeof value === 'object' && value.provider === 'electron-safeStorage' &&
    typeof value.dataBase64 === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(value.dataBase64);
}

function isExplicitSecretRejection(result) {
  const error = String(result?.error || '').trim().toLowerCase();
  return new Set([
    'bad secret',
    'invalid secret',
    'unauthorized secret',
    'unauthorized',
    'invalid session',
    'session expired',
    'not authenticated',
    'no secret'
  ]).has(error);
}

class AuthService extends EventEmitter {
  constructor({ origin, userDataPath }) {
    super();
    this.origin = origin;
    this.stateDir = path.join(userDataPath, 'state');
    this.state = {
      schemaVersion: STATE_SCHEMA,
      generation: 0,
      deviceId: createDeviceId(),
      account: null,
      cacheRoot: '',
      preferences: { ...DEFAULT_PREFERENCES }
    };
    this.secretMemory = '';
    this.socket = null;
    this.activePage = 'desktop-launcher';
    this.previewMode = !require('electron').app.isPackaged && process.env.OP_DESKTOP_PREVIEW === '1';
    this.saveChain = Promise.resolve();
  }

  async load() {
    await fsp.mkdir(this.stateDir, { recursive: true });
    const candidates = [];
    for (const fileName of STATE_FILES) {
      try {
        const parsed = JSON.parse(await fsp.readFile(path.join(this.stateDir, fileName), 'utf8'));
        if (parsed?.schemaVersion === STATE_SCHEMA && Number.isSafeInteger(parsed.generation) && typeof parsed.deviceId === 'string') {
          candidates.push(parsed);
        }
      } catch {
        // A missing or interrupted slot is ignored; the other generation remains usable.
      }
    }
    candidates.sort((left, right) => right.generation - left.generation);
    if (candidates[0]) this.state = candidates[0];
    if (!this.state.deviceId) this.state.deviceId = createDeviceId();
    this.state.cacheRoot = typeof this.state.cacheRoot === 'string' ? this.state.cacheRoot : '';
    this.state.preferences = sanitizePreferences(this.state.preferences);
    await this.decryptStoredSecret();
    return this.state;
  }

  async save() {
    const write = async () => {
      const next = { ...this.state, schemaVersion: STATE_SCHEMA, generation: safeInteger(this.state.generation) + 1 };
      const slotIndex = next.generation % STATE_FILES.length;
      await this.writeStateSlot(STATE_FILES[slotIndex], next);
      this.state = next;
    };
    const pending = this.saveChain.then(write, write);
    this.saveChain = pending.catch(() => {});
    await pending;
  }

  async writeStateSlot(fileName, state) {
    const target = path.join(this.stateDir, fileName);
    const temporary = `${target}.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    const handle = await fsp.open(temporary, 'wx');
    try {
      await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fsp.rm(target, { force: true });
    await fsp.rename(temporary, target);
  }

  async decryptStoredSecret() {
    this.secretMemory = '';
    const cipher = this.state.account?.secretCipher;
    if (!validCipher(cipher) || !safeStorage.isEncryptionAvailable()) return;
    try {
      this.secretMemory = safeStorage.decryptString(Buffer.from(cipher.dataBase64, 'base64')).trim();
    } catch {
      this.state.account = null;
    }
  }

  encryptSecret(secret) {
    if (!safeStorage.isEncryptionAvailable()) return null;
    return {
      provider: 'electron-safeStorage',
      dataBase64: safeStorage.encryptString(secret).toString('base64')
    };
  }

  async connect() {
    if (this.socket?.connected) return this.socket;
    if (!this.socket) {
      this.socket = io(this.origin, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        timeout: 15_000
      });
      this.socket.on('connect', () => {
        if (this.secretMemory) this.setPresence(this.activePage).catch(() => {});
        this.emit('social-event', 'connect');
      });
      for (const event of ['disconnect', 'FRIENDS_DIRTY', 'DM_NEW']) {
        this.socket.on(event, (payload) => this.emit('social-event', event, payload));
      }
      this.socket.on('SESSION_KICK', (payload) => {
        this.clearAccount().finally(() => this.emit('kicked', { reason: String(payload?.reason || 'takeover') }));
      });
    }
    if (this.socket.connected) return this.socket;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('timeout'));
      }, 18_000);
      const cleanup = () => {
        clearTimeout(timer);
        this.socket.off('connect', onConnect);
        this.socket.off('connect_error', onError);
      };
      const onConnect = () => { cleanup(); resolve(); };
      const onError = () => { cleanup(); reject(new Error('offline')); };
      this.socket.once('connect', onConnect);
      this.socket.once('connect_error', onError);
      this.socket.connect();
    });
    return this.socket;
  }

  async emitAck(eventName, payload, timeoutMs = 15_000) {
    const socket = await this.connect();
    return new Promise((resolve) => {
      socket.timeout(timeoutMs).emit(eventName, payload, (error, result = {}) => {
        resolve(error ? { ok: false, error: 'timeout' } : (result || { ok: false, error: 'unknown' }));
      });
    });
  }

  async setPresence(page) {
    this.activePage = String(page || 'desktop-launcher').slice(0, 80);
    if (!this.secretMemory) return { ok: false, error: 'not authenticated' };
    return this.emitAck('PRESENCE_SET', {
      secret: this.secretMemory,
      page: this.activePage,
      deviceId: this.state.deviceId
    });
  }

  async authenticate(mode, credentials) {
    const username = String(credentials?.username || '').trim().toLowerCase();
    const password = String(credentials?.password || '');
    const eventName = mode === 'register' ? 'AUTH_REGISTER' : 'AUTH_LOGIN';
    let result;
    try {
      result = await this.emitAck(eventName, { username, password, deviceId: this.state.deviceId });
    } finally {
      // The password is only referenced by the current call and is never copied into persistent state or logs.
    }
    if (!result?.ok || !result.secret) return result || { ok: false, error: 'unknown' };
    this.secretMemory = String(result.secret).trim();
    await this.setPresence('desktop-launcher');
    const profileResult = await this.emitAck('PROFILE_GET', { secret: this.secretMemory });
    if (!profileResult?.ok || !profileResult.profile) {
      this.secretMemory = '';
      return { ok: false, error: profileResult?.error || 'profile unavailable' };
    }
    const account = sanitizeAccount(profileResult.profile, result.username || username);
    const secretCipher = this.encryptSecret(this.secretMemory);
    this.state.account = { ...account, secretCipher };
    await this.save();
    return { ok: true, account };
  }

  async restore() {
    if (this.previewMode) return { ok: true, previewMode: true, account: sanitizeAccount({}, 'preview') };
    if (!this.secretMemory || !this.state.account) return { ok: false, error: 'not authenticated' };
    try {
      const profileResult = await this.emitAck('PROFILE_GET', { secret: this.secretMemory });
      if (!profileResult?.ok || !profileResult.profile) {
        const missingProfile = profileResult?.ok === true && !profileResult.profile;
        if (missingProfile || isExplicitSecretRejection(profileResult)) {
          await this.clearAccount();
          return { ok: false, error: profileResult?.error || 'bad secret' };
        }
        return { ok: false, error: profileResult?.error || 'profile unavailable', recoverable: true };
      }
      const account = sanitizeAccount(profileResult.profile, this.state.account.username);
      this.state.account = { ...account, secretCipher: this.state.account.secretCipher };
      await this.setPresence('desktop-launcher');
      await this.save();
      return { ok: true, account };
    } catch (error) {
      return { ok: false, error: error.message || 'offline', recoverable: true };
    }
  }

  accountSummary() {
    if (this.previewMode) return sanitizeAccount({ name: '羅盤測試員', avatar: 8 }, 'preview');
    if (!this.state.account) return null;
    const { secretCipher: _secretCipher, ...account } = this.state.account;
    return account;
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
    const result = await this.emitAck(eventName, { secret, ...payload });
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
      return this.emitAck('LAUNCHER_SHOP_GET', { preview: true });
    }
    return this.launcherRequest('LAUNCHER_SHOP_GET');
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
    const roomProduct = /^room-(?:scene-(?:sunny-deck|sunny-kitchen|sunny-library)|furniture-(?:helm|map-table|treasure-chest|tangerine-tree|swords-rack|kitchen-table|bookshelf|medicine-cabinet|piano|tool-bench)|character-(?:luffy|zoro|nami|chopper|sanji|robin))$/.test(itemId);
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
        title: String(result.profile.title || this.state.account.title),
        coins: safeInteger(result.shop.wallet?.coins, this.state.account.coins)
      };
      await this.save();
    }
    return result;
  }

  async buyLauncherItem(itemId) { return this.changeLauncherShopItem('buy', itemId); }
  async equipLauncherItem(itemId) { return this.changeLauncherShopItem('equip', itemId); }

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
    const { revision, sceneId, placements, characters } = room;
    if (!Number.isSafeInteger(revision) || revision < 0 || typeof sceneId !== 'string' ||
        !Array.isArray(placements) || placements.length > 24 || !Array.isArray(characters) || characters.length > 3) {
      return { ok: false, error: 'invalid_room' };
    }
    const sceneValid = sceneId === 'room-scene-default' || /^room-scene-(?:sunny-deck|sunny-kitchen|sunny-library)$/.test(sceneId);
    const unique = values => new Set(values.map(value => value.itemId)).size === values.length;
    const coordinates = entry => entry && Number.isFinite(entry.x) && Number.isFinite(entry.y) &&
      entry.x >= 0 && entry.x <= 960 && entry.y >= 0 && entry.y <= 540;
    if (!sceneValid || !unique(placements) || !unique(characters) ||
        !placements.every(entry => coordinates(entry) && /^room-furniture-(?:helm|map-table|treasure-chest|tangerine-tree|swords-rack|kitchen-table|bookshelf|medicine-cabinet|piano|tool-bench)$/.test(entry.itemId) &&
          Number.isFinite(entry.scale) && entry.scale >= .5 && entry.scale <= 1.5 && typeof entry.flip === 'boolean') ||
        !characters.every(entry => coordinates(entry) && /^room-character-(?:luffy|zoro|nami|chopper|sanji|robin)$/.test(entry.itemId))) {
      return { ok: false, error: 'invalid_room' };
    }
    return this.launcherRequest('LAUNCHER_ROOM_SET', { revision, sceneId, placements, characters });
  }

  getSecretForGame() {
    return this.secretMemory;
  }

  getGameBootstrap() {
    const account = this.accountSummary();
    if (!account || !this.secretMemory) return null;
    return {
      opSecret: this.secretMemory,
      op_secret: this.secretMemory,
      op_user_id: String(account.userId || ''),
      op_board_user_id: String(account.userId || ''),
      op_name: account.name,
      op_player_name: account.name,
      op_avatar: String(account.avatar),
      op_player_avatar: String(account.avatar),
      op_board_title: account.title,
      op_board_coins: String(account.coins),
      op_device_id: this.state.deviceId
    };
  }

  async clearAccount() {
    this.secretMemory = '';
    this.emit('social-event', 'reset');
    this.state.account = null;
    await this.save();
    const tombstone = {
      ...this.state,
      account: null,
      generation: safeInteger(this.state.generation) + 1
    };
    const purge = async () => {
      for (const fileName of STATE_FILES) await this.writeStateSlot(fileName, tombstone);
      this.state = tombstone;
    };
    const pending = this.saveChain.then(purge, purge);
    this.saveChain = pending.catch(() => {});
    await pending;
    this.socket?.disconnect();
    this.socket = null;
  }

  async setCacheRoot(cacheRoot) {
    this.state.cacheRoot = String(cacheRoot || '');
    await this.save();
  }

  getPreferences() {
    return sanitizePreferences(this.state.preferences);
  }

  async setPreferences(preferences) {
    const keys = preferences && typeof preferences === 'object' && !Array.isArray(preferences)
      ? Object.keys(preferences)
      : [];
    const allowedKeys = new Set(['minimizeToTrayOnGameLaunch', 'gameDisplayMode']);
    const hasMinimizePreference = Object.prototype.hasOwnProperty.call(preferences || {}, 'minimizeToTrayOnGameLaunch');
    const hasDisplayModePreference = Object.prototype.hasOwnProperty.call(preferences || {}, 'gameDisplayMode');
    if (
      keys.length < 1 ||
      keys.length > allowedKeys.size ||
      keys.some((key) => !allowedKeys.has(key)) ||
      (hasMinimizePreference && typeof preferences.minimizeToTrayOnGameLaunch !== 'boolean') ||
      (hasDisplayModePreference && !GAME_DISPLAY_MODES.has(preferences.gameDisplayMode))
    ) {
      throw new Error('啟動器設定格式不正確。');
    }
    this.state.preferences = sanitizePreferences({
      ...this.getPreferences(),
      ...preferences
    });
    await this.save();
    return this.getPreferences();
  }

  close() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

module.exports = { AuthService, isExplicitSecretRejection, sanitizeAccount, sanitizePreferences };
