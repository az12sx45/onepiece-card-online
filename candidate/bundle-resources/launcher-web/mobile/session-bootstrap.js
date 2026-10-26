/* Keep the two established authentication keys in this document's memory.
 * Native Keystore restores them for each official-origin document/frame.
 * Every other Storage key keeps the original game's persistence contract. */
(() => {
  'use strict';
  if (location.origin !== 'https://onepiece-card-online.onrender.com') return;
  if (typeof window.__tabletopSeedPrivateSession === 'function') return;
  const storage = window.localStorage;
  const prototype = Object.getPrototypeOf(storage);
  const get = prototype.getItem, set = prototype.setItem;
  const remove = prototype.removeItem, clear = prototype.clear;
  const privateKeys = new Set(['opSecret', 'op_secret']);
  const memory = Object.create(null);
  for (const key of privateKeys) remove.call(storage, key);
  function isPrivate(target, key) { return target === storage && privateKeys.has(String(key)); }
  prototype.getItem = function (key) {
    if (isPrivate(this, key)) return Object.prototype.hasOwnProperty.call(memory, String(key)) ? memory[String(key)] : null;
    return get.call(this, key);
  };
  prototype.setItem = function (key, value) {
    if (arguments.length < 2) return set.apply(this, arguments);
    if (isPrivate(this, key)) { memory[String(key)] = String(value); remove.call(storage, String(key)); return; }
    return set.call(this, key, value);
  };
  prototype.removeItem = function (key) {
    if (isPrivate(this, key)) { delete memory[String(key)]; remove.call(storage, String(key)); return; }
    return remove.call(this, key);
  };
  prototype.clear = function () {
    if (this === storage) for (const key of privateKeys) delete memory[key];
    return clear.call(this);
  };
  Object.defineProperty(window, '__tabletopSeedPrivateSession', {
    value(values) {
      for (const key of privateKeys) { delete memory[key]; remove.call(storage, key); }
      for (const [key, value] of Object.entries(values || {})) storage.setItem(key, String(value));
      window.__TABLETOP_ANDROID__ = true;
    }, configurable: false, writable: false
  });
})();
