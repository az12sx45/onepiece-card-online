/* UI adaptation only: use the original renderer's buttons and business handlers. */
(() => {
  'use strict';
  if (document.documentElement.dataset.platform !== 'android') return;
  const nav = document.querySelector('.topnav');
  const topbar = document.querySelector('.topbar');
  const app = document.getElementById('launcherApp');
  if (!nav || !topbar || !app || document.getElementById('mobileMenuToggle')) return;

  const makeButton = (id, label, className) => {
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    return button;
  };
  const toggle = makeButton('mobileMenuToggle', '☰', 'mobile-menu-toggle');
  toggle.setAttribute('aria-label', '開啟功能選單');
  toggle.setAttribute('aria-expanded', 'false');
  nav.id ||= 'mobileLauncherNavigation';
  toggle.setAttribute('aria-controls', nav.id);
  const title = document.createElement('p');
  title.id = 'mobilePanelTitle';
  title.className = 'mobile-panel-title';
  title.textContent = '遊戲庫';
  const scrim = makeButton('mobileNavScrim', '', 'mobile-nav-scrim');
  scrim.setAttribute('aria-label', '關閉功能選單');
  scrim.tabIndex = -1;
  scrim.hidden = true;
  const heading = document.createElement('p');
  heading.className = 'mobile-nav-heading';
  heading.textContent = 'ONE PIECE · 航海選單';
  const roomShortcut = makeButton('mobileRoomShortcut', '生活基地', 'mobile-nav-shortcut');
  const settingsShortcut = makeButton('mobileSettingsShortcut', '啟動器設定', 'mobile-nav-shortcut');
  nav.prepend(heading);
  nav.append(roomShortcut, settingsShortcut);
  topbar.prepend(toggle, title);
  app.append(scrim);
  nav.inert = true;
  let previousFocus = null;
  let frame = 0;
  let pendingRoomScroll = false;
  let roomFocus = false;
  const roomBack = makeButton('mobileRoomBack', '‹ 返回個人頁', 'ghost-button mobile-room-back');
  roomBack.hidden = true;
  document.getElementById('profileRoom')?.prepend(roomBack);
  function exitRoomFocus() {
    roomFocus = false;
    const profilePanel = document.getElementById('profilePanel');
    profilePanel?.classList.remove('mobile-room-focus');
    profilePanel?.querySelectorAll('.voyage-scroll > :not(#profileRoom)').forEach(node => { node.inert = false; });
    roomBack.hidden = true;
    queueSync();
  }
  function enterRoomFocus() {
    roomFocus = true;
    const profilePanel = document.getElementById('profilePanel');
    profilePanel?.classList.add('mobile-room-focus');
    profilePanel?.querySelectorAll('.voyage-scroll > :not(#profileRoom)').forEach(node => { node.inert = true; });
    roomBack.hidden = false;
  }
  roomBack.addEventListener('click', exitRoomFocus);

  // These are Android equivalents of existing preferences; retain their values.
  const text = (selector, value) => { const node = document.querySelector(selector); if (node) node.textContent = value; };
  text('.settings-display-group legend', '螢幕顯示');
  text('.settings-display-group .settings-group-note', '手機保持橫向；設定會套用在下一次開啟遊戲時。');
  text('label[for="gameDisplayBorderless"] .display-mode-copy strong', '顯示系統列');
  text('label[for="gameDisplayBorderless"] .display-mode-copy small', '保留 Android 狀態列與系統導覽。');
  text('label[for="gameDisplayFullscreen"] .display-mode-copy small', '隱藏系統列，讓遊戲使用完整橫向畫面。');
  text('label[for="minimizeToTrayToggle"] .settings-option-copy strong', '手機會保留啟動器');
  text('label[for="minimizeToTrayToggle"] .settings-option-copy small', '返回即可繼續使用啟動器；手機自動保留此功能。');
  const retainedLauncher = document.getElementById('minimizeToTrayToggle');
  if (retainedLauncher) retainedLauncher.disabled = true;
  if (document.documentElement.dataset.host === 'ios') {
    text('.settings-display-group .settings-group-note', 'iPhone 使用系統管理的橫向全螢幕。');
    const systemBars = document.getElementById('gameDisplayBorderless');
    if (systemBars) systemBars.disabled = true;
    text('label[for="gameDisplayBorderless"] .display-mode-copy small', '此選項僅適用於 Android。');
    text('label[for="gameDisplayFullscreen"] .display-mode-copy small', '保留瀏海與底部手勢安全區。');
    const notice = document.createElement('p');
    notice.className = 'mobile-ios-games-note';
    notice.textContent = '航海錄使用原生引擎；爭霸戰與霸海戰棋使用原版線上遊戲，需要網路連線。';
    document.querySelector('.settings-display-group')?.append(notice);
  }
  text('#locationDialog h2', '手機儲存管理');
  text('#locationDialog > p:not(.eyebrow)', '遊戲素材保存在應用程式專用空間；帳號與雲端存檔仍由伺服器保存。');
  text('#pickLocationButton', '開啟儲存管理');
  text('#changeLocationButton', '儲存管理');
  document.getElementById('storageButton')?.setAttribute('title', '手機儲存管理');

  function closeMenu(restoreFocus = false) {
    document.body.classList.remove('mobile-nav-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', '開啟功能選單');
    scrim.hidden = true;
    nav.inert = true;
    if (restoreFocus) (previousFocus || toggle).focus({ preventScroll: true });
  }
  function openMenu() {
    if (app.hidden) return;
    previousFocus = document.activeElement;
    document.body.classList.add('mobile-nav-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', '關閉功能選單');
    scrim.hidden = false;
    nav.inert = false;
    nav.querySelector('.nav-button.is-active')?.focus({ preventScroll: true });
  }
  toggle.addEventListener('click', () => document.body.classList.contains('mobile-nav-open') ? closeMenu(true) : openMenu());
  scrim.addEventListener('click', () => closeMenu(true));
  nav.addEventListener('click', event => {
    if (event.target.closest('.nav-button[data-panel]')) { exitRoomFocus(); closeMenu(); }
  });
  nav.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeMenu(true); }
    if (event.key !== 'Tab') return;
    const buttons = [...nav.querySelectorAll('button:not([disabled])')].filter(button => !button.hidden);
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  roomShortcut.addEventListener('click', () => {
    pendingRoomScroll = true;
    document.querySelector('.nav-button[data-panel="profile"]')?.click();
    enterRoomFocus();
    closeMenu();
    queueSync();
  });
  settingsShortcut.addEventListener('click', () => {
    closeMenu();
    document.getElementById('settingsButton')?.click();
  });

  function sync() {
    frame = 0;
    if (app.hidden) closeMenu();
    const selected = nav.querySelector('.nav-button[data-panel].is-active');
    const name = roomFocus ? '生活基地' : selected?.textContent.trim().replace(/\s*\d+$/, '') || '遊戲庫';
    if (title.textContent !== name) title.textContent = name;
    // The desktop wheel marks back-of-wheel buttons inaccessible. The Android
    // sheet displays those same controls together, so restore their UI semantics.
    const companion = document.getElementById('roomCompanionPanel');
    if (visible(companion)) {
      companion.querySelectorAll('.room-companion-actions button, .room-life-actions button').forEach(button => {
        if (!button.hidden && !button.closest('[hidden]')) {
          if (button.tabIndex !== 0) button.tabIndex = 0;
          if (button.getAttribute('aria-hidden') !== 'false') button.setAttribute('aria-hidden', 'false');
        }
      });
    }
    if (pendingRoomScroll && !document.getElementById('profilePanel')?.hidden) {
      const room = document.getElementById('profileRoom');
      const scroller = room?.closest('.voyage-scroll');
      if (room && scroller) {
        scroller.scrollTop += room.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 10;
        pendingRoomScroll = false;
        title.textContent = '生活基地';
      }
    }
  }
  function queueSync() { if (!frame) frame = requestAnimationFrame(sync); }
  const observer = new MutationObserver(queueSync);
  observer.observe(app, { attributes: true, subtree: true, attributeFilter: ['hidden', 'class', 'aria-hidden', 'tabindex'] });
  const companionPanel = document.getElementById('roomCompanionPanel');
  if (companionPanel) observer.observe(companionPanel, { attributes: true, subtree: true, attributeFilter: ['hidden', 'class', 'aria-hidden', 'tabindex'] });
  // This is a scrollable sheet on Android; let its content scroll instead of
  // forwarding a vertical touch gesture into the desktop wheel's drag handler.
  document.getElementById('roomCompanionWheel')?.addEventListener('pointermove', event => event.stopPropagation(), { capture: true, passive: true });
  queueSync();

  function visible(node) { return !!node && !node.hidden && node.getClientRects().length > 0; }
  function clickIfVisible(id) {
    const button = document.getElementById(id);
    if (!visible(button) || button.disabled) return false;
    button.click();
    return true;
  }
  function handleBack() {
    // Use the feature's close control so busy actions and confirmation remain intact.
    const layers = [
      ['.fishing-rod-preview', '.fishing-rod-preview-header button'],
      ['.fishing-journal-overlay', '.fishing-journal-header button'],
      ['.room-aquarium-manager-overlay', '.room-aquarium-manager-close'],
      ['#roomMinigameOverlay', '.room-minigame-close']
    ];
    const dialogs = [...document.querySelectorAll('dialog[open]')];
    if (dialogs.length) {
      const dialog = dialogs.at(-1);
      if (typeof dialog.requestClose === 'function') dialog.requestClose();
      else if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
      return true;
    }
    for (const [selector, closeSelector] of layers) {
      const layer = document.querySelector(selector);
      if (visible(layer)) {
        const close = layer.querySelector(closeSelector);
        if (close && !close.disabled) close.click();
        return true;
      }
    }
    if (document.body.classList.contains('mobile-nav-open')) { closeMenu(true); return true; }
    if (visible(document.getElementById('roomCompanionPanel'))) return clickIfVisible('roomCompanionClose');
    if (visible(document.getElementById('accountMenu'))) return clickIfVisible('accountButton');
    if (visible(document.getElementById('roomEditor'))) return clickIfVisible('roomCancel');
    if (roomFocus) { exitRoomFocus(); return true; }
    if (visible(document.getElementById('profileBackToFriends'))) return clickIfVisible('profileBackToFriends');
    const social = document.getElementById('socialPanel');
    if (visible(social) && social.classList.contains('has-peer')) return clickIfVisible('socialBack');
    const announcements = document.getElementById('announcementsPanel');
    if (visible(announcements) && announcements.classList.contains('has-detail')) return clickIfVisible('announcementBack');
    const library = document.getElementById('libraryPanel');
    if (!app.hidden && library?.hidden) {
      document.querySelector('.nav-button[data-panel="library"]')?.click();
      return true;
    }
    return false;
  }
  window.LauncherMobileUI = Object.freeze({ handleBack, openMenu, closeMenu });
})();

/* Android transfer details use the same original update card and actions. */
(() => {
  'use strict';
  if (document.documentElement.dataset.platform !== 'android') return;
  const api = window.onePieceDesktop, card = document.getElementById('launcherUpdateCard');
  if (!api || !card || window.LauncherMobileUpdate) return;
  const label = document.getElementById('launcherUpdateStatus');
  const action = document.getElementById('launcherUpdateAction');
  const detail = document.createElement('p');
  detail.id = 'mobileUpdateDownloadDetail'; detail.className = 'launcher-update-status'; detail.hidden = true;
  const cancel = document.createElement('button');
  cancel.id = 'mobileUpdateCancel'; cancel.type = 'button'; cancel.className = 'ghost-button';
  cancel.textContent = '取消下載'; cancel.hidden = true;
  const actions = document.createElement('div');
  actions.id = 'mobileUpdateActions';
  Object.assign(actions.style, { gridColumn: '2', gridRow: '1 / 4', display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'center' });
  if (action) actions.append(action);
  actions.append(cancel);
  card.append(detail, actions);
  let state = {}, queued = false, checking = false;
  const bytes = number => {
    const value = Number(number);
    if (!Number.isFinite(value) || value < 0) return '—';
    return value >= 1048576 ? `${(value / 1048576).toFixed(1)} MB` : `${Math.ceil(value / 1024)} KB`;
  };
  function render() {
    queued = false;
    const active = state.status === 'downloading', delta = state.downloadMethod === 'delta' || state.downloadMode === 'delta';
    const offered = ['available', 'downloading', 'ready'].includes(state.status);
    detail.hidden = !offered;
    detail.style.display = offered ? '' : 'none';
    detail.textContent = offered ? delta
      ? `差量下載 ${bytes(state.transferBytes ?? state.totalBytes)}；在手機內重建 ${bytes(state.targetBytes)} 的安裝檔。`
      : `此版本需下載完整安裝檔 ${bytes(state.transferBytes ?? state.totalBytes)}。${state.deltaUnavailableReason || ''}` : '';
    cancel.hidden = !active; cancel.disabled = !active;
    cancel.style.display = active ? '' : 'none'; cancel.style.minHeight = '44px';
    cancel.textContent = state.phase === 'rebuilding' || state.phase === 'verifying' ? '取消更新' : '取消下載';
    if (!label || !action) return;
    if (active && state.phase === 'rebuilding') label.textContent = '變更區塊已下載，正在手機內組合安裝檔…';
    else if (active && state.phase === 'verifying') label.textContent = '正在驗證完整安裝檔與簽章…';
    else if (state.status === 'available') {
      label.textContent = state.cancelled ? state.message || '更新已取消。' : `發現新版 ${state.availableVersion || state.latestVersion || ''}，${delta ? '可下載變更區塊後安裝。' : '需下載完整安裝檔後安裝。'}`;
      action.textContent = delta ? state.cancelled ? '重新下載差量更新' : '下載差量更新' : '下載完整更新';
      action.disabled = state.busy === true;
    } else if (state.status === 'ready') {
      label.textContent = state.installPermissionMessage || '新版已完成驗證，按安裝後由 Android 顯示確認畫面。';
      action.textContent = '安裝更新';
      action.disabled = state.busy === true;
    } else if (state.status === 'error') {
      label.textContent = state.error || '更新暫時無法完成，請重新檢查。';
    }
  }
  function receive(value) {
    state = { ...state, ...(value || {}) };
    if (!queued) { queued = true; Promise.resolve().then(render); }
  }
  // The original renderer interprets every ok:false as a lost download. A
  // denied installer permission leaves the verified APK ready, so retain that
  // real state and return false while showing the native permission message.
  const readOriginal = window.readLauncherUpdateResult;
  if (typeof readOriginal === 'function') window.readLauncherUpdateResult = function (result, fallbackError) {
    if (result?.ok === false && result.requiresInstallPermission === true && result.state?.status === 'ready') {
      window.mergeLauncherUpdateState?.(result.state);
      receive({ ...result.state, installPermissionMessage: result.error || '請允許 PO 安裝應用程式，再按安裝更新。' });
      return false;
    }
    const accepted = readOriginal.call(this, result, fallbackError);
    if (result?.ok === false) receive({ ...(result.state || {}), status: 'error', error: result.error || fallbackError, installPermissionMessage: '' });
    else if (result?.state) receive({ ...result.state, installPermissionMessage: '' });
    return accepted;
  };
  cancel.addEventListener('click', async () => {
    cancel.disabled = true;
    try { const result = await api.cancelLauncherUpdate(); receive(result?.state || result); }
    catch { receive({ status: 'error', error: '暫時無法取消更新，請再試一次。' }); }
  });
  api.onLauncherUpdate?.(receive);
  async function check() {
    if (checking || typeof api.checkLauncherUpdate !== 'function') return;
    checking = true;
    try { const result = await api.checkLauncherUpdate(); receive(result?.state || result); }
    catch { /* The original card retains the bridge's real failure message. */ }
    finally { checking = false; }
  }
  window.LauncherMobileUpdate = Object.freeze({ check, snapshot: () => ({ ...state }) });
  // Only a small release manifest is fetched. APK/patch downloads require the
  // original update button; opening the app never starts a large transfer.
  Promise.resolve().then(check);
})();
