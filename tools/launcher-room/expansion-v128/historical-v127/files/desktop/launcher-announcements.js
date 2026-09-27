(() => {
  'use strict';
  const api = window.onePieceDesktop;
  const $ = id => document.getElementById(id);
  const SCOPES = { all: '全部', launcher: '啟動器', shop: '商城', card: '偉大航道爭霸戰', board: '新世界航海錄', chess: '霸海戰棋' };
  const CATEGORIES = { all: '所有類型', update: '版本更新', character: '夥伴登場', item: '商品上架', event: '活動', maintenance: '維護通知' };
  const ID = /^[a-z0-9][a-z0-9._-]{0,95}$/;
  const CACHE_PREFIX = 'onepiece.launcher.announcements.v1.';
  const date = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' });
  const time = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false });
  let accountId = 0, epoch = 0, entries = [], revision = 0, selectedId = '', scope = 'all';
  let fetching = false, sending = false, offline = false, lastSync = 0, lastAttempt = 0, socialReady = false;
  let pending = new Set(), confirmed = new Set();
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const validIds = value => Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string' && ID.test(id)))].slice(0, 100) : [];
  function sanitize(value) {
    if (!value || typeof value.id !== 'string' || !ID.test(value.id) || !Object.prototype.hasOwnProperty.call(SCOPES, value.scope) || value.scope === 'all' || !Object.prototype.hasOwnProperty.call(CATEGORIES, value.category) || value.category === 'all') return null;
    const stamp = Date.parse(value.publishedAt);
    if (!Number.isFinite(stamp) || stamp > Date.now() || typeof value.title !== 'string' || !value.title.trim() || !Array.isArray(value.body)) return null;
    const item = { id: value.id, publishedAt: new Date(stamp).toISOString(), title: value.title.slice(0, 160), summary: String(value.summary || '').slice(0, 400), scope: value.scope, category: value.category, version: String(value.version || '').slice(0, 80), body: value.body.filter(p => typeof p === 'string').slice(0, 40).map(p => p.slice(0, 4000)), read: value.read === true };
    if (!item.body.length) return null;
    if (value.cta?.kind === 'shop' && typeof value.cta.itemId === 'string' && /^[a-z0-9-]{1,100}$/.test(value.cta.itemId)) item.cta = { kind: 'shop', itemId: value.cta.itemId };
    if (value.cta?.kind === 'game' && ['card', 'board', 'chess'].includes(value.cta.gameId)) item.cta = { kind: 'game', gameId: value.cta.gameId };
    return item;
  }
  function normalize(source) {
    const ids = new Set();
    return (Array.isArray(source) ? source : []).slice(0, 100).map(sanitize).filter(item => item && !ids.has(item.id) && ids.add(item.id)).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.id.localeCompare(b.id));
  }
  function saveCache() {
    if (!accountId) return;
    try { localStorage.setItem(CACHE_PREFIX + accountId, JSON.stringify({ schemaVersion: 1, ownerId: accountId, storedAt: lastSync, revision, entries, pending: [...pending] })); } catch { /* Public notices remain usable when storage is unavailable. */ }
  }
  function loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + accountId);
      if (!raw || raw.length > 600000) return;
      const cached = JSON.parse(raw);
      if (cached.schemaVersion !== 1 || cached.ownerId !== accountId) return;
      entries = normalize(cached.entries); revision = Number(cached.revision) || 0;
      lastSync = Number(cached.storedAt) || 0;
      confirmed = new Set(entries.filter(item => item.read).map(item => item.id));
      pending = new Set(validIds(cached.pending).filter(id => entries.some(item => item.id === id && !item.read)));
      offline = true;
    } catch { /* An invalid cache cannot affect the authenticated account. */ }
  }
  const unread = () => entries.filter(item => !item.read).length;
  function filtered() {
    const category = $('announcementCategory').value, days = Number($('announcementPeriod').value);
    return entries.filter(item => (scope === 'all' || item.scope === scope) && (category === 'all' || item.category === category) && (!days || Date.parse(item.publishedAt) >= Date.now() - days * 86400000));
  }
  function renderStatus() {
    const count = unread();
    $('announcementBadge').textContent = count > 99 ? '99+' : String(count);
    $('announcementBadge').hidden = !accountId || count === 0;
    $('announcementsButton').setAttribute('aria-label', count ? `公告中心，${count} 則未讀` : '公告中心');
    $('announcementUnread').textContent = accountId ? `${count} 則未讀` : '登入後同步';
    $('announcementMarkAll').disabled = !accountId || !count || sending || fetching;
    $('announcementRefresh').disabled = !accountId || fetching;
    let message = !accountId ? '登入後可查看公告，並同步你的已讀紀錄。' : fetching ? '正在取得最新公告…' : offline ? (entries.length ? '目前離線，顯示上次儲存的公告。已讀紀錄會在連線恢復後同步。' : '目前無法取得公告，請確認連線後重新整理。') : `共 ${entries.length} 則公告${lastSync ? ` · 更新於 ${time.format(lastSync)}` : ''}`;
    $('announcementStatus').textContent = message;
    $('announcementStatus').dataset.offline = String(offline);
  }
  function renderList() {
    const list = $('announcementList'), scroll = list.scrollTop, visible = filtered();
    list.replaceChildren();
    $('announcementResultCount').textContent = `${visible.length} 則`;
    if (!visible.length) {
      const blank = el('div', 'announcement-list-empty');
      blank.append(el('strong', '', fetching ? '正在讀取航海速報' : entries.length ? '沒有符合條件的公告' : '目前沒有公告'), el('p', '', entries.length ? '試試其他遊戲、類型或日期範圍。' : '新的版本、夥伴與商品消息會出現在這裡。'));
      list.append(blank);
    }
    for (const item of visible) {
      const button = el('button', `announcement-row${item.read ? '' : ' is-unread'}${item.id === selectedId ? ' is-selected' : ''}`);
      button.type = 'button'; button.dataset.announcementId = item.id; button.setAttribute('aria-current', String(item.id === selectedId));
      const meta = el('span', 'announcement-row-meta');
      meta.append(el('span', 'announcement-scope', SCOPES[item.scope]), el('time', '', date.format(Date.parse(item.publishedAt))));
      const title = el('strong', 'announcement-row-title', item.title);
      button.append(meta, title, el('span', 'announcement-row-summary', item.summary), el('span', 'announcement-row-footer', `${CATEGORIES[item.category]}${item.version ? ` · ${item.version}` : ''}${item.read ? '' : ' · 未讀'}`));
      button.onclick = () => openDetail(item.id);
      list.append(button);
    }
    list.scrollTop = scroll;
  }
  function renderDetail() {
    const item = entries.find(entry => entry.id === selectedId), article = $('announcementArticle'), scroll = $('announcementDetail').scrollTop;
    $('announcementsPanel').classList.toggle('has-detail', Boolean(item));
    $('announcementDetailEmpty').hidden = Boolean(item); article.hidden = !item;
    if (!item) return;
    $('announcementDetailScope').textContent = SCOPES[item.scope];
    $('announcementDetailCategory').textContent = CATEGORIES[item.category];
    $('announcementDetailTitle').textContent = item.title;
    $('announcementDetailDate').textContent = `${date.format(Date.parse(item.publishedAt))} ${time.format(Date.parse(item.publishedAt))}（台灣時間）${item.version ? ` · ${item.version}` : ''}`;
    $('announcementDetailSummary').textContent = item.summary;
    $('announcementReadState').textContent = item.read ? '已讀' : pending.has(item.id) ? '已開啟 · 等待同步已讀' : '未讀';
    $('announcementBody').replaceChildren(...item.body.map(text => el('p', '', text)));
    const action = $('announcementAction'); action.hidden = !item.cta;
    if (item.cta) {
      action.textContent = item.cta.kind === 'shop' ? '查看商城商品' : `前往${SCOPES[item.cta.gameId]}`;
      action.onclick = () => {
        if (item.cta.kind === 'shop') window.LauncherProfileShop?.openShop?.(item.cta.itemId);
        else window.launcherOpenGame?.(item.cta.gameId);
      };
    } else action.onclick = null;
    $('announcementDetail').scrollTop = scroll;
  }
  function render() { renderStatus(); renderList(); renderDetail(); }
  function openDetail(id) {
    const item = entries.find(entry => entry.id === id);
    if (!item || !accountId) return;
    selectedId = id; render(); $('announcementDetail').scrollTop = 0;
    $('announcementDetailTitle').focus({ preventScroll: true });
    if (!item.read) { pending.add(id); saveCache(); renderDetail(); flushReads(); }
  }
  async function flushReads() {
    if (!accountId || sending || !api?.markLauncherAnnouncementsRead) return;
    const ids = [...pending].filter(id => entries.some(item => item.id === id && !item.read));
    if (!ids.length) return;
    const owner = accountId, token = epoch; sending = true; renderStatus();
    let success = false;
    try {
      const result = await api.markLauncherAnnouncementsRead(ids);
      if (owner !== accountId || token !== epoch) return;
      if (!result?.ok) { offline = true; return; }
      for (const id of validIds(result.readIds)) confirmed.add(id);
      // Only acknowledged IDs may reduce the unread count.
      for (const item of entries) item.read = confirmed.has(item.id);
      for (const id of ids) pending.delete(id);
      success = true; saveCache();
    } catch { if (owner === accountId && token === epoch) offline = true; }
    finally {
      if (owner === accountId && token === epoch) {
        sending = false; render();
        if (success && [...pending].some(id => !ids.includes(id))) flushReads();
      }
    }
  }
  async function refresh(force = false) {
    if (!accountId || fetching || !api?.getLauncherAnnouncements || (!force && Date.now() - lastAttempt < 10000)) return;
    const owner = accountId, token = epoch; fetching = true; lastAttempt = Date.now(); renderStatus();
    try {
      const result = await api.getLauncherAnnouncements();
      if (owner !== accountId || token !== epoch) return;
      if (!result?.ok || !Array.isArray(result.announcements)) { offline = true; return; }
      entries = normalize(result.announcements);
      for (const id of validIds(result.readIds)) confirmed.add(id);
      for (const item of entries) { if (item.read) confirmed.add(item.id); item.read = confirmed.has(item.id); }
      pending = new Set([...pending].filter(id => entries.some(item => item.id === id && !item.read)));
      if (!entries.some(item => item.id === selectedId)) selectedId = '';
      revision = Number(result.revision) || 0; lastSync = Date.now(); offline = false; saveCache();
    } catch { if (owner === accountId && token === epoch) offline = true; }
    finally { if (owner === accountId && token === epoch) { fetching = false; render(); if (!offline) flushReads(); } }
  }
  function filtersChanged() {
    if (!filtered().some(item => item.id === selectedId)) selectedId = '';
    renderList(); renderDetail();
  }
  for (const [key, label] of Object.entries(SCOPES)) {
    const button = el('button', '', label); button.type = 'button'; button.dataset.scope = key; button.setAttribute('aria-pressed', String(key === scope));
    button.onclick = () => { scope = key; for (const node of $('announcementScopes').children) node.setAttribute('aria-pressed', String(node.dataset.scope === scope)); filtersChanged(); };
    $('announcementScopes').append(button);
  }
  for (const [key, label] of Object.entries(CATEGORIES)) { const option = el('option', '', label); option.value = key; $('announcementCategory').append(option); }
  $('announcementCategory').onchange = filtersChanged;
  $('announcementPeriod').onchange = filtersChanged;
  $('announcementRefresh').onclick = () => refresh(true);
  $('announcementMarkAll').onclick = () => { for (const item of entries) if (!item.read) pending.add(item.id); saveCache(); renderDetail(); flushReads(); };
  $('announcementBack').onclick = () => { selectedId = ''; render(); $('announcementList').focus(); };
  api?.onSocialState?.(state => {
    if (!accountId || state?.userId !== accountId) return;
    const ready = state.ready === true;
    if (ready && !socialReady) refresh(true);
    if (!ready) { offline = true; renderStatus(); }
    socialReady = ready;
  });
  window.addEventListener('focus', () => refresh());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  window.LauncherAnnouncements = Object.freeze({
    setAccount(snapshot) {
      const id = snapshot?.authenticated === true && !snapshot.profile?.needsDisplayName && Number.isSafeInteger(Number(snapshot.profile?.userId)) ? Number(snapshot.profile.userId) : 0;
      const next = id > 0 ? id : 0;
      if (next === accountId) return;
      saveCache(); epoch++; accountId = next; entries = []; revision = 0; selectedId = ''; pending = new Set(); confirmed = new Set();
      fetching = false; sending = false; offline = false; lastSync = 0; lastAttempt = 0; socialReady = false;
      scope = 'all'; $('announcementCategory').value = 'all'; $('announcementPeriod').value = '0';
      for (const node of $('announcementScopes').children) node.setAttribute('aria-pressed', String(node.dataset.scope === scope));
      if (accountId) loadCache(); render(); if (accountId) refresh(true);
    },
    onVisible(panel) { if (panel === 'announcements' && Date.now() - lastSync > 30000) refresh(); },
    open(scopeName = 'all') {
      scope = Object.prototype.hasOwnProperty.call(SCOPES, scopeName) ? scopeName : 'all';
      $('announcementCategory').value = 'all'; $('announcementPeriod').value = '0';
      for (const node of $('announcementScopes').children) node.setAttribute('aria-pressed', String(node.dataset.scope === scope));
      filtersChanged(); window.launcherSwitchPanel?.('announcements');
    }
  });
  render();
})();
