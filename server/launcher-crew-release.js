'use strict';

// Read once at process startup. These are first-release flags, not delisting
// switches: reverting a released flag blocks writes rather than deleting rights.
const config = require('../config/launcher-crew-release-v1.json');
const LEGACY_KEYS = Object.freeze(['luffy','zoro','nami','usopp','sanji','chopper','robin','franky','brook','jinbe']);
const RESERVED_KEYS = Object.freeze(['ace','sabo','law','hancock']);
if (config.schemaVersion !== 1 || !Number.isSafeInteger(config.rosterRevision) || config.rosterRevision < 1 ||
    !config.characters || Object.keys(config.characters).length !== 4 ||
    RESERVED_KEYS.some(key => typeof config.characters[key] !== 'boolean')) {
  throw new Error('Invalid launcher crew release configuration');
}
const releasedKeys = Object.freeze([...LEGACY_KEYS, ...RESERVED_KEYS.filter(key => config.characters[key] === true)]);
const releasedCharacterIds = Object.freeze(releasedKeys.map(key => 'room-character-' + key));
const supportsReserved = capability => Number.isSafeInteger(capability?.crewContentRevision) && capability.crewContentRevision >= 1;
const keyOf = value => typeof value === 'string' && value.startsWith('room-character-') ? value.slice(15) : null;
function metadata(capability) {
  return { releasedCharacterIds: releasedCharacterIds.filter(id => supportsReserved(capability) || LEGACY_KEYS.includes(keyOf(id))), rosterRevision: config.rosterRevision };
}
function reservedReferences(value, found = new Set()) {
  if (typeof value === 'string') {
    const key = keyOf(value) || value;
    if (RESERVED_KEYS.includes(key)) found.add(key);
    // Relationship dictionaries use sorted character-key pairs.
    if (value.includes(':')) for (const part of value.split(':')) if (RESERVED_KEYS.includes(part)) found.add(part);
  } else if (Array.isArray(value)) for (const item of value) reservedReferences(item, found);
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
    reservedReferences(key, found); reservedReferences(item, found);
  }
  return found;
}
function accessError(capability, ...values) {
  const referenced = new Set();
  for (const value of values) reservedReferences(value, referenced);
  if (referenced.size && !supportsReserved(capability)) return 'client_update_required';
  if ([...referenced].some(key => !releasedKeys.includes(key))) return 'character_not_released';
  return null;
}
function statsContent(stats) {
  return [stats?.launcherOwnedV1, stats?.launcherRoomV1, stats?.launcherCompanionsV1];
}
async function canonicalError(db, row, capability, request) {
  // Call with the profile row locked, before ANY normalization, grants or saves.
  // The life table may not exist on an account/server that has never used rooms.
  const exists = await db.query("SELECT to_regclass('launcher_life_state') AS relation");
  const result = exists.rows[0]?.relation
    ? await db.query('SELECT state FROM launcher_life_state WHERE user_id=$1 FOR UPDATE', [row.user_id]) : { rows: [] };
  return accessError(capability, statsContent(row.stats), result.rows[0]?.state, request);
}
function failure(error, capability) { return { ok: false, error, ...metadata(capability) }; }
function projectResponse(result, capability) {
  const allowed = new Set(metadata(capability).releasedCharacterIds);
  const allowedId = id => !keyOf(id) || allowed.has(id);
  const visible = value => [...reservedReferences(value)].every(key => allowed.has('room-character-' + key));
  // Only the response is projected; canonical JSON is never passed back to a save.
  const projected = JSON.parse(JSON.stringify(result));
  function visit(value) {
    if (Array.isArray(value)) return value.filter(item => visible(item) && (typeof item === 'string' ? allowedId(item) : allowedId(item?.itemId || item?.id))).map(visit);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => allowedId(key) && visible(key)).map(([key, item]) => [key, visit(item)]));
  }
  const response = projected;
  const roomView = room => { if (room?.characters) room.characters = room.characters.filter(entry => allowedId(entry.itemId)); };
  roomView(response.room);
  if (response.life) response.life = visit(response.life);
  if (response.shop) {
    response.shop.catalog = response.shop.catalog.filter(item => allowedId(item.id));
    response.shop.owned.roomCharacters = response.shop.owned.roomCharacters.filter(allowedId);
  }
  if (response.profile) {
    roomView(response.profile.room); roomView(response.profile.roomItems);
    response.profile.companions = response.profile.companions.filter(item => allowedId(item.itemId));
    if (response.profile.life) response.profile.life = visit(response.profile.life);
    response.profile.collection.launcher = visit(response.profile.collection.launcher);
  }
  const collection = response.profile?.collection?.launcher;
  if (collection) collection.ownedItems = collection.itemIds.length;
  if (response.shop) Object.assign(response.shop, metadata(capability));
  if (response.profile) Object.assign(response.profile, metadata(capability));
  return { ...response, ...metadata(capability) };
}
module.exports = { LEGACY_KEYS, RESERVED_KEYS, releasedKeys, releasedCharacterIds, supportsReserved,
  metadata, accessError, statsContent, canonicalError, failure, projectResponse };
