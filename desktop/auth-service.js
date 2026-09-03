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

function safeInteger(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
}

function createDeviceId() {
  return `desktop-${crypto.randomBytes(16).toString('hex')}`;
}

function sanitizeAccount(profile, username = '') {
  const source = profile && typeof profile === 'object' ? profile : {};
  const client = source.stats?.client && typeof source.stats.client === 'object' ? source.stats.client : {};
  const userId = safeInteger(source.user_id ?? source.userId);
  const name = String(source.name || username || (userId ? `玩家${String(userId).slice(-4)}` : '航海者')).trim().slice(0, 40) || '航海者';
  const avatar = Math.max(1, Math.min(50, safeInteger(source.avatar, 8)));
  const title = String(client.titles?.equipped || '偉大航道航海者').trim().slice(0, 60) || '偉大航道航海者';
  const coins = safeInteger(client.totals?.coins);
  return { username: String(username || '').trim().toLowerCase().slice(0, 24), userId, name, avatar, title, coins };
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
    this.state = { schemaVersion: STATE_SCHEMA, generation: 0, deviceId: createDeviceId(), account: null, cacheRoot: '' };
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
      });
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

  close() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

module.exports = { AuthService, isExplicitSecretRejection, sanitizeAccount };
