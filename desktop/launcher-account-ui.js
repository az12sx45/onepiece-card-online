(() => {
  'use strict';
  const api = window.onePieceDesktop;
  const dialog = document.getElementById('playerNameDialog');
  const input = document.getElementById('playerNameInput');
  const hint = document.getElementById('playerNameHint');
  const save = document.getElementById('playerNameSave');
  let required = false, accountId = 0;
  dialog.addEventListener('cancel', event => { if (required) event.preventDefault(); });
  document.getElementById('playerNameForm').onsubmit = async event => {
    event.preventDefault(); if (save.disabled) return;
    save.disabled = true; hint.textContent = '正在儲存玩家名稱…';
    try {
      const result = await api.setDisplayName(input.value);
      if (result.ok) { required = false; dialog.close(); window.showApp(result.state); }
      else hint.textContent = result.error === 'name_taken' ? '這個名稱已有人使用，請換一個。' : result.error === 'bad_name' ? '請輸入 1～16 字的玩家名稱。' : '名稱尚未儲存，請檢查連線後再試。';
    } catch { hint.textContent = '名稱尚未儲存，請檢查連線後再試。'; }
    finally { save.disabled = false; }
  };
  document.getElementById('playerNameLogout').onclick = async () => { await api.logout(); };
  window.LauncherAccount = {
    setAccount(snapshot) {
      const id = Number(snapshot?.profile?.userId) || 0;
      if (id !== accountId) { input.value = ''; hint.textContent = '最多 16 字，不能與其他玩家重複。'; accountId = id; }
      required = snapshot?.authenticated === true && snapshot.profile?.needsDisplayName === true;
      if (!required) { if (dialog.open) dialog.close(); return; }
      setTimeout(() => { if (required && !dialog.open && document.body.dataset.stage === 'app') { dialog.showModal(); input.focus(); } }, 0);
    }
  };
})();
