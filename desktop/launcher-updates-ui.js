(() => {
  'use strict';
  const api = window.onePieceDesktop;
  const $ = id => document.getElementById(id);
  const seen = new Set();
  let account = null, launcher = null, current = null, timer;
  const titles = { card: '偉大航道爭霸戰', board: '新世界航海錄', chess: '霸海戰棋' };
  function consider() {
    clearTimeout(timer);
    if (!account?.authenticated || account.profile?.needsDisplayName || document.body.dataset.stage !== 'app' || document.hidden || !document.hasFocus() || document.querySelector('dialog[open]')) return;
    const candidates = [];
    if (launcher?.availableVersion && ['available', 'ready'].includes(launcher.status)) candidates.push({ key: `launcher:${launcher.availableVersion}:${launcher.status}`, kind: 'launcher', title: '啟動器有新版本', copy: launcher.status === 'ready' ? `版本 ${launcher.availableVersion} 已下載完成，可以前往設定安裝更新。` : `版本 ${launcher.availableVersion} 已推出。前往設定下載更新，取得最新功能與修正。` });
    for (const [id, game] of Object.entries(account.games || {})) {
      if (game.hasInstalled && game.status === 'update' && game.remoteVersion) candidates.push({ key: `${id}:${game.remoteVersion}`, kind: 'game', title: `${titles[id] || '遊戲'}有更新`, copy: '新的遊戲版本已可下載。前往下載管理完成更新後，重新開啟遊戲即可使用。' });
    }
    current = candidates.find(c => !seen.has(c.key));
    if (!current) return;
    seen.add(current.key);
    $('updatePromptTitle').textContent = current.title; $('updatePromptCopy').textContent = current.copy;
    $('updatePrompt').showModal();
  }
  $('updatePromptLater').onclick = () => $('updatePrompt').close();
  $('updatePromptGo').onclick = () => { const kind = current?.kind; $('updatePrompt').close(); if (kind === 'launcher') $('settingsButton').click(); else $('downloadsButton').click(); };
  api?.onLauncherUpdate?.(state => { launcher = state; consider(); });
  window.addEventListener('focus', () => { timer = setTimeout(consider, 200); });
  document.addEventListener('close', () => { timer = setTimeout(consider, 500); }, true);
  window.LauncherUpdates = {
    setAccount(value) { account = value; if (!value?.authenticated) { if ($('updatePrompt').open) $('updatePrompt').close(); return; } timer = setTimeout(consider, 300); }
  };
})();
