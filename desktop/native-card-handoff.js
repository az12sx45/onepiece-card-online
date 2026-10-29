'use strict';

function matchRoom(url, origin) {
  try {
    const target = new URL(url);
    const room = target.searchParams.get('room');
    const server = target.searchParams.get('server');
    if (target.origin !== origin || target.pathname !== '/game.html' || target.username || target.password ||
        !room || room !== room.trim() || room.length > 80 || /[\u0000-\u001f\u007f]/.test(room) ||
        (server && new URL(server).origin !== origin)) return null;
    return room;
  } catch { return null; }
}

// Keep the original browser lobby connected until the native client has received
// its playing snapshot. Disconnecting first can delete a one-human/CPU room.
function createNativeCardHandoff({ window, origin, createRunner, isCurrent, prepareReturn, onError }) {
  let phase = 'lobby', room = '', runner = null, pending = null, unloading = null;
  const alive = () => phase !== 'closed' && !window.isDestroyed() && isCurrent();
  async function returnToLobby() {
    if (!alive() || phase !== 'playing') return;
    phase = 'returning';
    try {
      await unloading?.catch(() => {});
      if (!alive()) return;
      prepareReturn(room);
      await window.loadURL(`${origin}/start.html?desktop=1`);
      if (!alive()) return;
      phase = 'lobby'; window.webContents.setAudioMuted(false); window.setEnabled(true); window.show(); window.focus();
    } catch (error) {
      if (alive()) {
        window.webContents.setAudioMuted(false); window.setEnabled(true); window.show();
        onError(error, () => { if (alive() && phase === 'returning') { phase = 'playing'; returnToLobby(); } });
      }
    }
  }
  async function start(code) {
    if (!alive() || phase !== 'lobby') return;
    phase = 'starting'; room = code;
    window.setEnabled(false); window.webContents.setAudioMuted(true);
    try {
      if (!runner) runner = createRunner({ onExit: returnToLobby });
      const result = await runner.launch({ room });
      if (!alive()) { runner.close(); return; }
      if (!result?.ok || !result.matchReady) throw Error(result?.error || '原生對局尚未連線完成。');
      // launch resolves only after native JOINED + STATE + nav_game, not spawn.
      phase = 'playing'; window.hide(); window.setEnabled(true);
      try { unloading = window.loadURL('about:blank'); await unloading; }
      catch (error) { if (phase === 'playing') throw error; }
    } catch (error) {
      runner?.close();
      if (!alive()) return;
      phase = 'lobby'; window.setEnabled(true); window.webContents.setAudioMuted(false); window.show(); window.focus();
      onError(error, () => start(code));
    }
  }
  function navigate(event, legacyUrl) {
    if (event.isMainFrame === false) return;
    const code = matchRoom(event.url ?? legacyUrl, origin);
    if (code === null) return;
    event.preventDefault();
    if (phase !== 'lobby' || pending) return;
    pending = start(code).finally(() => { pending = null; });
  }
  window.webContents.on('will-navigate', navigate);
  window.webContents.on('will-redirect', navigate);
  return {
    state: () => phase,
    dispose() { phase = 'closed'; runner?.close(); window.webContents.removeListener('will-navigate', navigate); window.webContents.removeListener('will-redirect', navigate); }
  };
}

module.exports = { matchRoom, createNativeCardHandoff };
