'use strict';

const crypto = require('node:crypto');
const crewRelease = require('./launcher-crew-release');
const { compareSemver } = require('../desktop/launcher-update-service');
const SCOPES = Object.freeze(['launcher', 'shop', 'card', 'board', 'chess']);
const CATEGORIES = Object.freeze(['update', 'character', 'item', 'event', 'maintenance']);
const GAMES = new Set(['card', 'board', 'chess']);
const ID = /^[a-z0-9][a-z0-9._-]{0,95}$/;
const VERSION = /^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/;
const RELEASE = /^package-[a-f0-9]{16}$/;
const readyByPool = new WeakMap();
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const keys = (value, allowed) => object(value) && Object.keys(value).every(key => allowed.includes(key));
const text = (value, max) => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max && !/[<>\u0000-\u0008\u000b-\u001f\u007f]/.test(value);
const invalid = () => { throw new Error('Invalid launcher announcement configuration'); };

function validateConfig(raw) {
  if (!keys(raw, ['schemaVersion', 'revision', 'announcements']) || raw.schemaVersion !== 1 ||
      !Number.isSafeInteger(raw.revision) || raw.revision < 1 || !Array.isArray(raw.announcements) || raw.announcements.length > 100) invalid();
  const seen = new Set();
  for (const item of raw.announcements) {
    if (!keys(item, ['id', 'status', 'publishedAt', 'title', 'summary', 'scope', 'category', 'version', 'body', 'requiredRelease', 'requiresCharacterId', 'cta']) ||
        typeof item.id !== 'string' || !ID.test(item.id) || seen.has(item.id) || !['draft', 'published'].includes(item.status) ||
        typeof item.publishedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(item.publishedAt) ||
        !Number.isFinite(Date.parse(item.publishedAt)) || new Date(item.publishedAt).toISOString() !== item.publishedAt ||
        !SCOPES.includes(item.scope) || !CATEGORIES.includes(item.category) || !text(item.title, 100) ||
        !text(item.summary, 240) || !text(item.version, 80) || !Array.isArray(item.body) || item.body.length < 1 ||
        item.body.length > 12 || item.body.some(line => !text(line, 1000))) invalid();
    seen.add(item.id);
    const release = item.requiredRelease;
    if (GAMES.has(item.scope)) {
      if (!keys(release, ['kind', 'releaseId']) || release.kind !== item.scope || !RELEASE.test(release.releaseId)) invalid();
    } else if (!keys(release, ['kind', 'version']) || release.kind !== 'launcher' || !VERSION.test(release.version)) invalid();
    if (item.requiresCharacterId !== undefined && !/^room-character-[a-z]+$/.test(item.requiresCharacterId)) invalid();
    if (item.category === 'character' && !item.requiresCharacterId) invalid();
    if (item.cta !== undefined) {
      if (item.cta?.kind === 'shop') {
        if (!keys(item.cta, ['kind', 'itemId']) || typeof item.cta.itemId !== 'string' || !ID.test(item.cta.itemId) ||
            (item.cta.itemId.startsWith('room-character-') && item.requiresCharacterId !== item.cta.itemId) ||
            (item.requiresCharacterId && item.cta.itemId !== item.requiresCharacterId)) invalid();
      } else if (!keys(item.cta, ['kind', 'gameId']) || item.cta.kind !== 'game' ||
          !GAMES.has(item.cta.gameId) || item.cta.gameId !== item.scope) invalid();
    }
  }
  // Configuration is private; responses are explicitly projected below.
  return JSON.parse(JSON.stringify(raw));
}

async function ensureTables(pool) {
  if (!readyByPool.has(pool)) readyByPool.set(pool, (async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS launcher_announcement_reads (
      user_id BIGINT NOT NULL, announcement_id TEXT NOT NULL,
      read_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(user_id, announcement_id))`);
    await pool.query(`CREATE TABLE IF NOT EXISTS launcher_announcement_publications (
      announcement_id TEXT NOT NULL, content_sha256 TEXT NOT NULL,
      release_kind TEXT NOT NULL, release_id TEXT NOT NULL,
      verified_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(announcement_id, content_sha256))`);
  })().catch(error => { readyByPool.delete(pool); throw error; }));
  await readyByPool.get(pool);
}

function createLauncherAnnouncements({ config = require('../config/launcher-announcements-v1.json'), verifyRelease, now = () => new Date() } = {}) {
  if (typeof verifyRelease !== 'function') throw new Error('Announcement release verifier required');
  const catalog = validateConfig(config);
  const entries = catalog.announcements.map(item => ({ ...item,
    contentSha256: crypto.createHash('sha256').update(JSON.stringify(item)).digest('hex') }));
  async function actor(pool, secret) {
    if (typeof secret !== 'string' || !secret || secret.length > 256) return null;
    return (await pool.query('SELECT user_id FROM player_profiles WHERE secret=$1 LIMIT 1', [secret])).rows[0] || null;
  }
  async function visible(pool, capability) {
    const nowMs = now().getTime();
    const released = new Set(crewRelease.metadata(capability).releasedCharacterIds);
    const shopIds = new Set(require('./launcher-profile-shop').CATALOG.map(item => item.id));
    // Hidden titles/IDs never enter a response, unread count or read write.
    const candidates = entries.filter(item => item.status === 'published' && Date.parse(item.publishedAt) <= nowMs &&
      (!item.requiresCharacterId || released.has(item.requiresCharacterId)) &&
      (item.cta?.kind !== 'shop' || shopIds.has(item.cta.itemId)));
    if (!candidates.length) return [];
    const published = (await pool.query(`SELECT announcement_id, content_sha256 FROM launcher_announcement_publications
      WHERE announcement_id = ANY($1::text[])`, [candidates.map(item => item.id)])).rows;
    const witnessed = new Set(published.map(row => row.announcement_id + ':' + row.content_sha256));
    const verifications = new Map();
    const result = [];
    for (const item of candidates) {
      if (!witnessed.has(item.id + ':' + item.contentSha256)) {
        const required = item.requiredRelease;
        if (!verifications.has(required.kind)) verifications.set(required.kind,
          Promise.resolve().then(() => verifyRelease(required.kind)).catch(() => null));
        const current = await verifications.get(required.kind);
        if (!current?.ok || current.kind !== required.kind) continue;
        const matches = required.kind === 'launcher'
          ? VERSION.test(current.version) && compareSemver(current.version, required.version) >= 0
          : current.releaseId === required.releaseId && /^[a-f0-9]{64}$/.test(current.manifestSha256);
        if (!matches) continue;
        // Written only while handling an authenticated request in the serving
        // process after its real runtime verifier succeeds. A manifest merely
        // present on disk, a draft or a future entry cannot seed this ledger.
        await pool.query(`INSERT INTO launcher_announcement_publications(announcement_id,content_sha256,release_kind,release_id)
          VALUES($1,$2,$3,$4) ON CONFLICT(announcement_id,content_sha256) DO NOTHING`,
        [item.id, item.contentSha256, required.kind, required.kind === 'launcher' ? current.version : current.releaseId]);
      }
      result.push(item);
    }
    return result.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id));
  }
  async function reads(pool, userId, items) {
    if (!items.length) return [];
    const rows = (await pool.query(`SELECT announcement_id FROM launcher_announcement_reads
      WHERE user_id=$1 AND announcement_id = ANY($2::text[])`, [userId, items.map(item => item.id)])).rows;
    const ids = new Set(rows.map(row => row.announcement_id));
    return items.filter(item => ids.has(item.id)).map(item => item.id);
  }
  const project = (item, readIds) => ({ id: item.id, publishedAt: item.publishedAt, title: item.title,
    summary: item.summary, scope: item.scope, category: item.category, version: item.version,
    body: item.body.slice(), ...(item.requiredRelease.releaseId ? { releaseId: item.requiredRelease.releaseId } : {}),
    ...(item.cta ? { cta: { ...item.cta } } : {}), read: readIds.includes(item.id) });
  async function get(pool, secret, query = {}, capability) {
    if (!keys(query, ['scope', 'category']) || (query.scope !== undefined && query.scope !== 'all' && !SCOPES.includes(query.scope)) ||
        (query.category !== undefined && query.category !== 'all' && !CATEGORIES.includes(query.category))) return { ok: false, error: 'invalid_announcement_filter' };
    const user = await actor(pool, secret);
    if (!user) return { ok: false, error: 'bad secret' };
    await ensureTables(pool);
    const items = await visible(pool, capability), readIds = await reads(pool, user.user_id, items);
    return { ok: true, revision: catalog.revision, total: items.length, unreadCount: items.length - readIds.length, readIds,
      announcements: items.filter(item => (!query.scope || query.scope === 'all' || item.scope === query.scope) &&
        (!query.category || query.category === 'all' || item.category === query.category)).map(item => project(item, readIds)) };
  }
  async function read(pool, secret, request = {}, capability) {
    if (!keys(request, ['announcementId', 'announcementIds']) || (request.announcementId !== undefined && request.announcementIds !== undefined)) return { ok: false, error: 'invalid_announcement_id' };
    const ids = request.announcementId !== undefined ? [request.announcementId] : request.announcementIds;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 || ids.some(id => typeof id !== 'string' || !ID.test(id)) || new Set(ids).size !== ids.length) return { ok: false, error: 'invalid_announcement_id' };
    const user = await actor(pool, secret);
    if (!user) return { ok: false, error: 'bad secret' };
    await ensureTables(pool);
    const items = await visible(pool, capability), available = new Set(items.map(item => item.id));
    if (ids.some(id => !available.has(id))) return { ok: false, error: 'announcement_unavailable' };
    await pool.query(`INSERT INTO launcher_announcement_reads(user_id,announcement_id)
      SELECT $1, unnest($2::text[]) ON CONFLICT(user_id,announcement_id) DO NOTHING`, [user.user_id, ids]);
    const readIds = await reads(pool, user.user_id, items);
    return { ok: true, ...(request.announcementId !== undefined ? { announcementId: request.announcementId, read: true } : {}),
      announcementIds: ids.slice(), readIds, unreadCount: items.length - readIds.length };
  }
  return Object.freeze({ get, read });
}

module.exports = { SCOPES, CATEGORIES, validateConfig, createLauncherAnnouncements };
