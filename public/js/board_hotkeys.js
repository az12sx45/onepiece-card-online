(function (root) {
  'use strict';
  const KEY_NAMES = { ' ': 'Space', Spacebar: 'Space', Up: 'ArrowUp', Down: 'ArrowDown', Left: 'ArrowLeft', Right: 'ArrowRight' };
  const DISPLAY = { Space: '空白鍵', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
  const SPECIAL = new Set(['Space', 'Home', 'End', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function normalizeBinding(value) {
    if (value === '') return '';
    if (typeof value !== 'string' || value.length > 40) return null;
    const parts = value.split('+');
    const raw = parts.pop(), key = KEY_NAMES[raw] || (/^[a-z0-9]$/i.test(raw) ? raw.toUpperCase() : raw);
    if (!SPECIAL.has(key) && !/^[A-Z0-9]$/.test(key)) return null;
    if (parts.some(part => !['Shift', 'Alt'].includes(part)) || new Set(parts).size !== parts.length) return null;
    // Keep browser navigation, browser menus, and the Windows window menu available.
    if (parts.includes('Alt') && (SPECIAL.has(key) || ['D', 'E', 'F'].includes(key))) return null;
    return [...['Shift', 'Alt'].filter(part => parts.includes(part)), key].join('+');
  }
  function bindingForEvent(event) {
    if (event.ctrlKey || event.metaKey || event.isComposing || event.keyCode === 229) return null;
    return normalizeBinding([...(event.shiftKey ? ['Shift'] : []), ...(event.altKey ? ['Alt'] : []), KEY_NAMES[event.key] || event.key].join('+'));
  }
  function displayBinding(binding) { return binding ? binding.split('+').map(key => DISPLAY[key] || key).join(' + ') : '未設定'; }
  function isEditable(target) {
    return !!target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"]');
  }
  function create(options = {}) {
    const actions = (options.actions || []).filter(action => action && typeof action.id === 'string' && typeof action.run === 'function');
    const byId = new Map(actions.map(action => [action.id, action]));
    if (byId.size !== actions.length) throw Error('Duplicate Board hotkey action ID');
    const defaults = Object.fromEntries(actions.map(action => [action.id, normalizeBinding(action.defaultKey || '') || '']));
    let owner = null, bindings = { ...defaults }, dialog = null, recording = '', conflict = null, status = '', destroyed = false;
    const seen = new WeakSet();
    const currentOwner = () => String(options.owner?.() || '');
    const storageKey = () => `op_board_hotkeys_v1:${owner}`;
    function sanitize(value) {
      const saved = value?.schema === 1 && value.bindings && typeof value.bindings === 'object' ? value.bindings : {};
      const used = new Set(), result = {};
      for (const action of actions) {
        const parsed = Object.prototype.hasOwnProperty.call(saved, action.id) ? normalizeBinding(saved[action.id]) : defaults[action.id];
        const key = parsed === null ? defaults[action.id] : parsed;
        result[action.id] = key && used.has(key) ? '' : key;
        if (result[action.id]) used.add(result[action.id]);
      }
      return result;
    }
    function load() {
      bindings = { ...defaults };
      if (owner) try { bindings = sanitize(JSON.parse(root.localStorage.getItem(storageKey()) || 'null')); } catch (_) {}
    }
    function selectOwner() {
      const next = currentOwner();
      if (owner === next) return false;
      owner = next; recording = ''; conflict = null; status = ''; load();
      if (dialog?.open) render();
      return true;
    }
    function save() {
      if (!owner) { status = '目前尚未登入；設定只保留到關閉本頁。'; return; }
      try { root.localStorage.setItem(storageKey(), JSON.stringify({ schema: 1, bindings })); }
      catch (_) { status = '目前無法儲存至本機，設定仍可在本頁使用。'; }
    }
    function setBinding(id, key) {
      bindings[id] = key; recording = ''; conflict = null;
      status = `${byId.get(id).label}：${displayBinding(key)}`; save(); render(id);
    }
    function render(focusId = '') {
      if (!dialog) return;
      dialog.innerHTML = `<header class="board-hotkeys-header"><div><small>航海操作 · 個人設定</small><h2>快捷鍵設定</h2><p>按自己習慣的方式航行。</p></div><button type="button" data-hotkey-close aria-label="關閉快捷鍵設定">關閉 ×</button></header>
        <div class="board-hotkeys-body"><p class="board-hotkeys-note">設定儲存在目前電腦，依帳號分開保留。打字、中文輸入、戰鬥或必選事件中不會誤觸遊戲操作。</p>
        <p class="board-hotkeys-help">按「更改」後輸入英文字母、數字、方向鍵、Home／End 或空白鍵，可搭配 Shift 或 Alt。Ctrl、Windows／Command、Enter、Esc、Tab 與瀏覽器保留鍵不開放改綁。</p>
        <p class="board-hotkeys-status" role="status" aria-live="polite">${escape(recording ? `請按下「${byId.get(recording).label}」的新按鍵，Esc 取消。` : status || '可直接切換背包、任務與船員等清單；再次按相同鍵會收起。')}</p>
        ${conflict ? `<section class="board-hotkeys-conflict" role="alert"><strong>${escape(displayBinding(conflict.binding))} 已設定給「${escape(byId.get(conflict.otherId).label)}」。</strong><p>改綁至「${escape(byId.get(conflict.id).label)}」後，原功能將不再有快捷鍵。</p><div><button type="button" data-hotkey-confirm>改綁並清除原功能</button><button type="button" data-hotkey-cancel>取消</button></div></section>` : ''}
        <div class="board-hotkeys-list">${actions.map(action => `<section class="board-hotkeys-row${recording === action.id ? ' is-recording' : ''}" data-hotkey-row="${escape(action.id)}"><div><h3>${escape(action.label)}</h3>${action.description ? `<p>${escape(action.description)}</p>` : ''}</div><kbd>${escape(displayBinding(bindings[action.id]))}</kbd><div class="board-hotkeys-row-actions"><button type="button" data-hotkey-edit="${escape(action.id)}" aria-label="更改${escape(action.label)}快捷鍵">${recording === action.id ? '等待按鍵…' : '更改'}</button><button type="button" data-hotkey-clear="${escape(action.id)}" aria-label="清除${escape(action.label)}快捷鍵">清除</button></div></section>`).join('')}</div></div>
        <footer class="board-hotkeys-footer"><button type="button" data-hotkey-reset>還原預設</button><span>每次變更會自動保存</span><button type="button" data-hotkey-close>完成</button></footer>`;
      const button = conflict ? dialog.querySelector('[data-hotkey-confirm]') : focusId ? [...dialog.querySelectorAll('[data-hotkey-edit]')].find(node => node.dataset.hotkeyEdit === focusId) : null;
      button?.focus({ preventScroll: true });
    }
    function openSettings() {
      if (destroyed) return;
      selectOwner(); recording = ''; conflict = null;
      if (!dialog) {
        dialog = document.createElement('dialog'); dialog.className = 'board-hotkeys-dialog'; dialog.setAttribute('aria-label', '快捷鍵設定');
        document.body.appendChild(dialog);
        dialog.addEventListener('close', () => { recording = ''; conflict = null; });
        dialog.addEventListener('click', event => {
          if (selectOwner()) return;
          const button = event.target.closest('button'); if (!button) return;
          if (button.hasAttribute('data-hotkey-close')) dialog.close();
          else if (button.dataset.hotkeyEdit && byId.has(button.dataset.hotkeyEdit)) { recording = button.dataset.hotkeyEdit; conflict = null; render(recording); }
          else if (button.dataset.hotkeyClear && byId.has(button.dataset.hotkeyClear)) setBinding(button.dataset.hotkeyClear, '');
          else if (button.hasAttribute('data-hotkey-reset')) { bindings = { ...defaults }; recording = ''; conflict = null; status = '已還原預設快捷鍵。'; save(); render(); }
          else if (button.hasAttribute('data-hotkey-cancel')) { conflict = null; status = '已取消改綁。'; render(); }
          else if (button.hasAttribute('data-hotkey-confirm') && conflict) { const pending = conflict; bindings[pending.otherId] = ''; setBinding(pending.id, pending.binding); }
        });
      }
      render(); if (!dialog.open) dialog.showModal();
      dialog.querySelector('[data-hotkey-close]')?.focus({ preventScroll: true });
    }
    function handleKeydown(event) {
      if (destroyed || seen.has(event)) return false;
      seen.add(event); const changedOwner = selectOwner();
      if (dialog?.open) {
        event.stopImmediatePropagation();
        if ((recording || conflict) && event.key === 'Escape') { event.preventDefault(); recording = ''; conflict = null; status = '已取消改綁。'; render(); return true; }
        if (!recording) return false; // Preserve native Tab/Enter/Escape behavior inside the settings dialog.
        event.preventDefault();
        if (event.repeat || event.isComposing || event.keyCode === 229 || changedOwner) return false;
        const key = bindingForEvent(event);
        if (!key) { status = '此按鍵保留給輸入或瀏覽器，請選擇其他按鍵。'; dialog.querySelector('.board-hotkeys-status').textContent = status; return true; }
        const other = actions.find(action => action.id !== recording && bindings[action.id] === key);
        if (other) { conflict = { id: recording, binding: key, otherId: other.id }; recording = ''; render(); }
        else setBinding(recording, key);
        return true;
      }
      if (changedOwner || event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229 || isEditable(event.target)) return false;
      const key = bindingForEvent(event); if (!key) return false;
      const action = actions.find(entry => bindings[entry.id] === key);
      if (!action || (options.canRun && !options.canRun(action.id, event))) return false;
      if (action.run(event) !== true) return false;
      event.preventDefault(); event.stopImmediatePropagation(); return true;
    }
    function onStorage(event) {
      selectOwner(); if (!owner || event.key !== storageKey()) return;
      load(); recording = ''; conflict = null; status = '已載入另一個視窗的快捷鍵設定。'; if (dialog?.open) render();
    }
    selectOwner(); root.addEventListener('keydown', handleKeydown, true); root.addEventListener('storage', onStorage);
    return Object.freeze({ openSettings, handleKeydown,
      get bindings() { selectOwner(); return { ...bindings }; },
      labelForAction(id) { selectOwner(); return displayBinding(bindings[id]); },
      destroy() { if (destroyed) return; destroyed = true; root.removeEventListener('keydown', handleKeydown, true); root.removeEventListener('storage', onStorage); dialog?.close(); dialog?.remove(); dialog = null; },
    });
  }
  root.BoardHotkeys = Object.freeze({ create, normalizeBinding });
})(window);
