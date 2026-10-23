'use strict';
// Generated original Android account controller; platform I/O is supplied explicitly.
exports.create=function(platform){
if(!platform||typeof platform.nativeCall!=='function'||typeof platform.io!=='function')throw Error('Native account platform is incomplete');
const ORIGIN='https://onepiece-card-online.onrender.com';
const DEFAULT_PREFERENCES=Object.freeze({minimizeToTrayOnGameLaunch:false,gameDisplayMode:'fullscreen'});
const window={io:platform.io},nativeCall=platform.nativeCall;
const publish=(name,value)=>platform.publish?.(name,value);
let authenticated=false,restorePending=false,restorePromise=null,restoreTimer=null,nativeState={},sessionEpoch=0,loading,disposed=false;
function settleRestore(promise){return new Promise((resolve,reject)=>{promise.then(value=>{restorePromise=null;resolve(value);},error=>{restorePromise=null;reject(error);});});}
function safeInteger(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
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
class EventEmitter {
    constructor() { this.listeners = new Map(); }
    on(name, fn) { const list = this.listeners.get(name) || []; list.push(fn); this.listeners.set(name, list); return this; }
    emit(name, ...args) { for (const fn of this.listeners.get(name) || []) fn(...args); }
  }
function mobileAssets(value, key = '') {
    if (typeof value === 'string' && /^(?:asset|src|url|.*Asset)$/i.test(key) && /^opui:\/\/launcher\/(?:images|audio|videos)\//.test(value)) {
      const relative = value.slice('opui://launcher/'.length);
      return !relative.includes('..') && !relative.includes('\\') ? 'https://appassets.androidplatform.net/launcher-assets/' + relative : '';
    }
    if (Array.isArray(value)) return value.map(item => mobileAssets(item, key));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mobileAssets(v, k)]));
    return value;
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
    /* AUTHORITATIVE_REQUEST_VALIDATION */
  }
async function verifyRestoredSession() {
    if (restorePromise) return restorePromise;
    if (!restorePending || !auth.secretMemory || !auth.state.account) return;
    restorePromise = settleRestore((async () => {
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
    })());
    return restorePromise;
  }
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


const auth=new MobileAuth(),social=platform.socialFactory?platform.socialFactory(auth):new SocialService(auth);
if(typeof social?.start!=='function')throw Error('Native account social service missing');
social.on?.('state',state=>{if(!disposed)publish('social-state',state);});
function snapshot(){return {authenticated,restorePending,account:authenticated?auth.accountSummary():null,deviceId:auth.state.deviceId,preferences:{...auth.state.preferences}};}
async function broadcast(){const state=snapshot();publish('state',state);return state;}
function active(){if(disposed)throw Error('Native account service disposed');}
return {
 async load(){active();await ensureLoaded();active();return broadcast();},
 async retry(){active();await verifyRestoredSession();active();return broadcast();},
 async authenticate(credentials){active();await ensureLoaded();active();return auth.authenticate('login',credentials);},
 async clear(){active();await auth.clearAccount();return broadcast();},
 snapshot,
 getSecret(){return !disposed&&authenticated?auth.getSecretForGame():'';},
 getSocket(){active();if(!authenticated)throw Error('Verified account required');return auth.socket;},
 socialState(){return !disposed&&authenticated?social.snapshot?.()??null:null;},
 socialRequest(action,payload){active();if(!authenticated)return Promise.resolve({ok:false,error:'not authenticated'});return social.request(action,payload);},
 dispose(){if(disposed)return;disposed=true;++sessionEpoch;clearTimeout(restoreTimer);restoreTimer=null;auth.socket?.disconnect();auth.socket=null;authenticated=false;auth.secretMemory='';auth.state.account=null;clearInterval(social.poll);social.reset?.();social.stop?.();}
};
};
