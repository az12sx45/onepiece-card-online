'use strict';

const fs = require('node:fs');
const path = require('node:path');

const THEMES = Object.freeze({
  card: 'card-cursor-buggy-v3.css',
  board: 'board-cursor-nami-v3.css'
});
const sourceCache = new Map();
const installedContents = new WeakSet();

function frameBelongsToOrigin(frame, origin) {
  try {
    if (!frame || frame.isDestroyed() || frame.detached) return false;
    if (new URL(frame.url).origin === origin) return true;
    return ['about:blank', 'about:srcdoc'].includes(frame.url) &&
      !!frame.parent && frameBelongsToOrigin(frame.parent, origin);
  } catch {
    return false;
  }
}

function cursorPayload(gameId, origin, resourceRoot) {
  if (!Object.hasOwn(THEMES, gameId)) throw new Error('Unsupported cursor theme.');
  const root = path.resolve(resourceRoot);
  const key = JSON.stringify([gameId, origin, root]);
  if (sourceCache.has(key)) return sourceCache.get(key);
  const css = fs.readFileSync(path.join(root, 'css', THEMES[gameId]), 'utf8')
    .replaceAll('../images/', `${origin}/images/`);
  const feedback = fs.readFileSync(path.join(root, 'js', 'game_cursor_feedback_v1.js'), 'utf8');
  const payload = `(() => {
    const expectedOrigin = ${JSON.stringify(origin)};
    try {
      let current = window;
      while (current.location.origin !== expectedOrigin) {
        if (!['about:blank', 'about:srcdoc'].includes(current.location.href) || current.parent === current) return false;
        current = current.parent;
      }
    } catch (_) { return false; }
    const css = ${JSON.stringify(css)};
    let style = document.getElementById('desktop-game-cursor-policy-v4');
    if (!style) {
      style = document.createElement('style');
      style.id = 'desktop-game-cursor-policy-v4';
      (document.head || document.documentElement).appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
    ${feedback}
    return true;
  })()`;
  sourceCache.set(key, payload);
  return payload;
}

function installGameCursorPolicy(webContents, gameId, { origin, resourceRoot }) {
  if (installedContents.has(webContents)) return;
  const canonicalOrigin = new URL(origin).origin;
  const payload = cursorPayload(gameId, canonicalOrigin, resourceRoot);
  const attachedFrames = new WeakSet();
  const apply = (frame) => {
    try {
      if (!frameBelongsToOrigin(frame, canonicalOrigin)) return;
      // Navigation/detachment can race this UI-only update; never interrupt a game.
      frame.executeJavaScript(payload).catch(() => {});
    } catch { /* Frame was removed during navigation. */ }
  };
  const attach = (frame) => {
    if (!frame || attachedFrames.has(frame) || frame.isDestroyed()) return;
    attachedFrames.add(frame);
    frame.on('dom-ready', () => apply(frame));
  };
  installedContents.add(webContents);
  webContents.on('frame-created', (_event, { frame }) => attach(frame));
  webContents.on('dom-ready', () => {
    attach(webContents.mainFrame);
    apply(webContents.mainFrame);
  });
  attach(webContents.mainFrame);
}

module.exports = { installGameCursorPolicy, frameBelongsToOrigin };
