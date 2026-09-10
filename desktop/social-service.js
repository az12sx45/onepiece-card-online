'use strict';

const { EventEmitter } = require('node:events');
const ACTIONS = Object.freeze({ add: 'FRIEND_ADD_BY_NAME', accept: 'FRIEND_REQUEST_ACCEPT', decline: 'FRIEND_REQUEST_DECLINE', remove: 'FRIEND_REMOVE' });
function person(value) {
  const userId = Number(value?.userId);
  if (!Number.isSafeInteger(userId) || userId <= 0) return null;
  return { userId, name: String(value.name || `玩家${userId}`).slice(0, 80), avatar: Math.max(1, Math.min(50, Number(value.avatar) || 1)), online: value.online === true, page: String(value.page || '').slice(0, 80) };
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
      const result = await this.auth.emitAck('FRIENDS_GET', { secret: this.auth.getSecretForGame() });
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

module.exports = { SocialService };
