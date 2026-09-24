(() => {
  'use strict';
  const api = window.onePieceDesktop;
  const $ = id => document.getElementById(id);
  const GAME_META = [
    { id: 'card', title: '偉大航道爭霸戰', english: 'GRAND LINE RIVALRY', cover: 'launcher_card_cover_perspective_v2.png' },
    { id: 'board', title: '新世界航海錄', english: 'NEW WORLD VOYAGE', cover: 'launcher_board_cover_logo_perspective_v5.png' },
    { id: 'chess', title: '霸海戰棋', english: 'PIRATE WAR CHESS', cover: 'launcher_chess_cover_logo_perspective_v5.png' }
  ];
  const COLLECTION_TABS = [
    ['avatars', '頭像'], ['walls', '牆面'], ['flags', '旗幟'], ['launcher', '展示室'], ['titles', '榮譽'], ['board', '航海圖鑑'], ['chess', '戰棋']
  ];
  const SHOP_TABS = [['avatar', '頭像'], ['room_scene', '房間場景'], ['room_furniture', '房間家具'], ['room_character', 'Q版夥伴'], ['background', '背景'], ['frame', '相框'], ['wall', '牆面'], ['flag', '旗幟'], ['layout', '排版'], ['decoration', '貼紙'], ['bgm', '音樂'], ['guestbook', '留言板']];
  const TYPE_LABEL = { avatar: '頭像', room_scene: '房間場景', room_furniture: '房間家具', room_character: 'Q版夥伴', background: '背景', frame: '相框', wall: '牆面', flag: '旗幟', layout: '排版', decoration: '貼紙', bgm: '音樂', guestbook: '留言板' };
  const ROOM_TYPES = ['room_scene', 'room_furniture', 'room_character'];
  const SLOTS = [['header', '上方'], ['side', '側邊'], ['footer', '下方']];
  const RARITY = { common: '普通', rare: '稀有', epic: '史詩', legend: '傳說' };
  const MAX_AVATAR_ID = 62;
  const number = value => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
  const fmt = value => number(value).toLocaleString('zh-TW');
  const el = (tag, className, content) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = String(content);
    return node;
  };
  const validIds = (source, max) => [...new Set((Array.isArray(source) ? source : []).map(Number).filter(id => Number.isInteger(id) && id >= 1 && id <= max))].sort((a, b) => a - b);
  const imageFor = (type, key) => {
    const id = Number(key);
    if (type === 'avatar' && Number.isInteger(id) && id >= 1 && id <= MAX_AVATAR_ID) return `opui://launcher/images/board/avatars/${id}.webp`;
    if (type === 'wall' && Number.isInteger(id) && id >= 1 && id <= 8) return `opui://launcher/images/walls/${id}.webp`;
    if (type === 'flag' && Number.isInteger(id) && id >= 1 && id <= 15) return `opui://launcher/images/flags/${id}.webp`;
    return '';
  };
  const safeImageAsset = asset => typeof asset === 'string' && /^opui:\/\/launcher\/images\/[a-z0-9_/-]+\.(?:png|webp)$/i.test(asset) ? asset : '';
  const safeAudioAsset = asset => typeof asset === 'string' &&
    /^opui:\/\/launcher\/audio\/(?:profile_bgm\/[a-z0-9-]+\.ogg|bgm\/track(?:0[1-9]|1[0-9]|20)\.mp3)$/i.test(asset) ? asset : '';
  const itemImage = item => imageFor(item?.type, item?.key) || safeImageAsset(item?.asset);
  const clamp = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
  const errorText = code => ({
    'not authenticated': '請先登入帳號。', 'bad secret': '登入已失效，請重新登入。',
    'not friends': '目前無法參觀這位玩家的個人頁。', 'not found': '找不到這位玩家。',
    'insufficient_coins': '金幣不足。', 'insufficient coins': '金幣不足。',
    'already_owned': '已經收藏這件商品。', 'not_owned': '尚未收藏這件商品。',
    'guestbook_locked': '留言板尚未解鎖。', 'not_friends': '目前只有好友可以留言。',
    'invalid placement': '佈置位置不正確，請重新調整。', 'rate_limited': '留言太頻繁，請稍後再試。',
    timeout: '伺服器回應逾時，請重新整理確認結果。', offline: '目前無法連線，請稍後再試。'
  })[String(code || '')] || '操作未完成，請稍後再試。';

  let accountId = 0;
  let preview = false;
  let viewUserId = 0;
  let profile = null;
  let shop = null;
  let profileRequest = 0;
  let shopRequest = 0;
  let collectionTab = 'avatars';
  let shopTab = 'avatar';
  let pendingPurchase = null;
  let shopBusy = false;
  let comments = null;
  let commentRequest = 0;
  let commentNextBeforeId = 0;
  let commentHasMore = false;
  let commentBusy = false;
  let pendingCommentDelete = null;
  let decorBusy = false;
  let bgmSource = '';
  let bgmPlayRequest = 0;
  let roomEditorRequested = false;

  function status(target, message, error = false) {
    const node = $(target);
    node.textContent = message;
    node.classList.toggle('is-error', error);
  }
  function emptyCollection(message) { $('profileCollectionGrid').replaceChildren(el('p', 'voyage-collection-empty', message)); }
  function avatarFallback(img) { img.onerror = () => { img.onerror = null; img.src = imageFor('avatar', 8); }; }
  function renderHero() {
    const own = profile ? profile.isSelf !== false : !viewUserId;
    const p = profile || {};
    $('profilePageTitle').textContent = own ? '個人頁' : '好友個人頁';
    $('profilePageHint').textContent = own ? '三款遊戲的航行紀錄與珍藏。' : '參觀好友的遊戲紀錄與公開蒐藏。';
    $('profileBackToFriends').hidden = own;
    $('profileHeroKind').textContent = own ? 'MY VOYAGE' : 'FRIEND VOYAGE';
    $('profileHeroName').textContent = p.name || '航海者';
    $('profileHeroTitle').textContent = p.title || '偉大航道航海者';
    $('profileHeroId').textContent = p.userId ? `航海者 #${number(p.userId)}` : '';
    $('profileHeroAvatar').src = imageFor('avatar', p.avatar) || imageFor('avatar', 8);
    avatarFallback($('profileHeroAvatar'));
    document.querySelector('.captain-hero').classList.toggle('is-friend', !own);
  }
  function metric(label, value) { const wrap = el('div'); wrap.append(el('dt', '', label), el('dd', '', value)); return wrap; }
  function gameMetrics(id, data) {
    if (id === 'card') return [metric('對局', fmt(data.games)), metric('勝場', fmt(data.wins)), metric('勝率', number(data.games) ? `${Math.round(number(data.wins) / number(data.games) * 100)}%` : '—')];
    if (id === 'board') {
      const values = [];
      if (Number.isFinite(Number(data.campaigns))) values.push(metric('航海存檔', fmt(data.campaigns)));
      if (Number.isFinite(Number(data.crewCount))) values.push(metric('最近船員', fmt(data.crewCount)));
      if (Number.isFinite(Number(data.bounty))) values.push(metric('最近懸賞', fmt(data.bounty)));
      if (Number.isFinite(Number(data.latestCoins))) values.push(metric('最近貝里', fmt(data.latestCoins)));
      if (Number.isFinite(Number(data.completed))) values.push(metric('完成航程', fmt(data.completed)));
      return values;
    }
    return [metric('對局', fmt(data.games)), metric('勝場', fmt(data.wins)), metric('和棋', fmt(data.draws)), metric('敗場', fmt(data.losses))];
  }
  function renderGames() {
    const grid = $('profileGameStats'); grid.replaceChildren();
    for (const game of GAME_META) {
      const data = profile?.games?.[game.id] || {};
      const card = el('article', 'voyage-game-card'); card.dataset.game = game.id;
      const image = el('img'); image.src = `opui://launcher/images/game_launcher/${game.cover}`; image.alt = '';
      const heading = el('div', 'voyage-game-card-header'); heading.append(el('h4', '', game.title), el('p', '', game.english));
      card.append(image, heading);
      if (!profile || data.available !== true) {
        const copy = game.id === 'card' ? '尚無雲端對局紀錄。' : game.id === 'board' ? '尚無可讀取的雲端航海存檔。' : '尚無已驗證的戰棋對局紀錄。';
        card.append(el('p', 'voyage-no-data', copy));
      } else {
        const dl = el('dl'); for (const item of gameMetrics(game.id, data)) dl.append(item);
        if (dl.childElementCount) card.append(dl);
        else card.append(el('p', 'voyage-no-data', '目前沒有可顯示的統計。'));
      }
      const source = game.id === 'card' ? '雲端卡牌戰績' : game.id === 'board' ? '雲端航海存檔' : '伺服器驗證的完成對局';
      card.append(el('p', 'voyage-card-source', source)); grid.append(card);
    }
  }
  function renderCollectionTabs() {
    const tabs = $('profileCollectionTabs'); tabs.replaceChildren();
    for (const [id, title] of COLLECTION_TABS) {
      const button = el('button', '', title); button.type = 'button'; button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(id === collectionTab));
      button.onclick = () => { collectionTab = id; renderCollectionTabs(); renderCollection(); };
      tabs.append(button);
    }
  }
  function collectionItem(grid, type, id, label) {
    const card = el('article', 'voyage-collectible');
    const img = el('img'); img.alt = ''; img.src = imageFor(type, id); if (type === 'avatar') avatarFallback(img);
    card.append(img, el('strong', '', `${label} #${id}`), el('small', '', type === 'avatar' && number(profile?.avatar) === id ? '目前使用' : '已收藏'));
    grid.append(card);
  }
  function textCollection(grid, title, subtitle) {
    const card = el('article', 'voyage-collectible is-text'); card.append(el('strong', '', title), el('small', '', subtitle)); grid.append(card);
  }
  function renderCollection() {
    const grid = $('profileCollectionGrid'); grid.replaceChildren();
    const card = profile?.collection?.card || {};
    const board = profile?.collection?.board || {};
    const category = collectionTab;
    if (['avatars', 'walls', 'flags'].includes(category)) {
      const type = category === 'avatars' ? 'avatar' : category === 'walls' ? 'wall' : 'flag';
      const max = type === 'avatar' ? MAX_AVATAR_ID : type === 'wall' ? 8 : 15;
      const label = type === 'avatar' ? '頭像' : type === 'wall' ? '牆面' : '旗幟';
      const ids = validIds(card[category], max);
      $('profileCollectionCount').textContent = `${ids.length} 件${label}`;
      for (const id of ids) collectionItem(grid, type, id, label);
      if (!ids.length) emptyCollection(`尚未收藏${label}。`);
      return;
    }
    if (category === 'titles') {
      $('profileCollectionCount').textContent = '榮譽與懸賞';
      textCollection(grid, `${fmt(card.titles)} 個稱號`, '偉大航道爭霸戰');
      textCollection(grid, `${fmt(card.bountyPosters)} 張懸賞令`, '偉大航道爭霸戰');
      if (card.deluxeUnlocked) textCollection(grid, '豪華版已解鎖', '偉大航道爭霸戰');
      for (const name of Array.isArray(card.titleNames) ? card.titleNames.slice(0, 30) : []) textCollection(grid, String(name).slice(0, 60), '已獲得稱號');
      return;
    }
    if (category === 'launcher') {
      const ids = Array.isArray(profile?.collection?.launcher?.itemIds) ? profile.collection.launcher.itemIds.filter(id => typeof id === 'string' && /^[a-z0-9-]{3,64}$/.test(id)).slice(0, 150) : [];
      const summaries = Array.isArray(profile?.collection?.launcher?.items) ? profile.collection.launcher.items : [];
      $('profileCollectionCount').textContent = `${ids.length} 件展示室收藏`;
      for (const id of ids) {
        const item = summaries.find(entry => entry?.id === id) || safeCatalog().find(entry => entry.id === id);
        textCollection(grid, item?.name || id, TYPE_LABEL[item?.type] || '展示室收藏');
      }
      if (!ids.length) emptyCollection('尚未收藏展示室佈置或音樂。');
      return;
    }
    if (category === 'board') {
      const ids = Array.isArray(board.artworkIds) ? board.artworkIds : [];
      const entries = Array.isArray(board.artworkEntries) ? board.artworkEntries : [];
      $('profileCollectionCount').textContent = `${fmt(board.artworks)} / ${fmt(board.artworkTotal)} 件航海圖鑑`;
      if (entries.length) for (const item of entries.slice(0, 60)) {
        textCollection(grid, String(item.title || item.id || '航海插畫').slice(0, 65),
          `${String(item.group || '新世界航海錄').slice(0, 30)} · ${String(item.variantLabel || '').slice(0, 20)}`);
      }
      else if (ids.length) for (const id of ids.slice(0, 60)) textCollection(grid, String(id).slice(0, 65), '新世界航海錄圖鑑');
      else emptyCollection('尚無雲端航海圖鑑紀錄。完成圖鑑收集後會顯示在這裡。');
      return;
    }
    $('profileCollectionCount').textContent = '戰棋收藏';
    emptyCollection('霸海戰棋目前尚無獨立收藏系統；你在商店取得的頭像仍可用於共用帳號。');
  }
  function stopBgm() {
    bgmPlayRequest++;
    const audio = $('profileBgmAudio');
    audio.pause(); audio.currentTime = 0;
    $('profileBgmToggle').textContent = '播放音樂';
  }
  function slotPlacement(placement, slot) {
    const defaults = { header: { x: 50, y: 12 }, side: { x: 12, y: 54 }, footer: { x: 50, y: 86 } }[slot];
    const value = placement?.[slot] || {};
    return { x: clamp(value.x, 5, 95, defaults.x), y: clamp(value.y, 5, 95, defaults.y), scale: clamp(value.scale, .5, 1.5, 1) };
  }
  function renderDecorControls() {
    const controls = $('profileDecorControls'); controls.replaceChildren();
    const items = profile?.appearanceItems?.decorations || {};
    const placement = profile?.appearance?.decorationPlacement;
    const group = el('div', 'captain-decor-controls');
    for (const [slot, label] of SLOTS) {
      const item = items[slot];
      const current = slotPlacement(placement, slot);
      const card = el('div', 'captain-decor-slot'); card.dataset.slot = slot;
      card.append(el('strong', '', `${label}槽位`), el('small', '', item?.name || '尚未套用貼紙'));
      for (const [field, text, min, max, step] of [['x', '左右', 5, 95, 1], ['y', '上下', 5, 95, 1], ['scale', '大小', .5, 1.5, .05]]) {
        const row = el('label');
        const input = el('input'); input.type = 'range'; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(current[field]); input.dataset.field = field; input.disabled = !item || decorBusy;
        const value = el('output', '', field === 'scale' ? `${Math.round(current[field] * 100)}%` : `${Math.round(current[field])}%`);
        input.oninput = () => {
          value.textContent = field === 'scale' ? `${Math.round(Number(input.value) * 100)}%` : `${Math.round(Number(input.value))}%`;
          const sticker = $('profileCabinStickers').querySelector(`[data-slot="${slot}"]`);
          if (sticker) {
            if (field === 'x') sticker.style.left = `${input.value}%`;
            if (field === 'y') sticker.style.top = `${input.value}%`;
            if (field === 'scale') sticker.style.setProperty('--scale', input.value);
          }
        };
        row.append(el('span', '', text), input, value); card.append(row);
      }
      const save = el('button', '', '儲存位置'); save.type = 'button'; save.disabled = !item || decorBusy;
      save.onclick = () => savePlacement(slot, card);
      card.append(save); group.append(card);
    }
    controls.append(group);
  }
  function renderCabin() {
    const appearance = profile?.appearance || {};
    const items = profile?.appearanceItems || {};
    const stage = $('profileCabinStage');
    const layoutId = String(appearance.layoutId || 'layout-default');
    stage.dataset.layout = ['layout-grand-line', 'layout-bounty-board', 'layout-captain-quarters', 'layout-sunny-deck', 'layout-sunny-kitchen', 'layout-sunny-library'].includes(layoutId) ? layoutId : 'layout-default';
    const wall = imageFor('wall', appearance.wallId);
    $('profileCabinWall').style.backgroundImage = wall ? `url("${wall}")` : '';
    const background = $('profileCabinBackground');
    const backgroundSource = items.background?.id === appearance.backgroundId ? safeImageAsset(items.background?.asset) : '';
    background.hidden = !backgroundSource;
    if (backgroundSource) background.src = backgroundSource;
    else background.removeAttribute('src');
    const frame = $('profileCabinFrame');
    const frameSource = items.frame?.id === appearance.frameId ? safeImageAsset(items.frame?.asset) : '';
    frame.hidden = !frameSource;
    frame.style.borderImageSource = frameSource ? `url("${frameSource}")` : '';
    const flag = $('profileCabinFlag');
    const flagSource = imageFor('flag', appearance.flagId);
    flag.hidden = !flagSource;
    if (flagSource) flag.src = flagSource;
    else flag.removeAttribute('src');
    $('profileCabinLayout').textContent = items.layout?.name || '原始展示室';
    $('profileCabinName').textContent = profile?.name || '航海者';
    $('profileCabinCaption').textContent = profile ? '三款遊戲，共用一段航程' : '登入後展示你的收藏';
    const stickers = $('profileCabinStickers'); stickers.replaceChildren();
    for (const [slot] of SLOTS) {
      const item = items.decorations?.[slot];
      const source = safeImageAsset(item?.asset);
      if (!source || item?.id !== appearance.decorations?.[slot]) continue;
      const position = slotPlacement(appearance.decorationPlacement, slot);
      const img = el('img', 'captain-cabin-sticker'); img.alt = ''; img.src = source; img.dataset.slot = slot;
      img.style.left = `${position.x}%`; img.style.top = `${position.y}%`; img.style.setProperty('--scale', String(position.scale));
      stickers.append(img);
    }
    const nextBgm = items.bgm?.id === appearance.bgmId ? safeAudioAsset(items.bgm?.asset) : '';
    if (nextBgm !== bgmSource) {
      stopBgm(); bgmSource = nextBgm;
      if (nextBgm) $('profileBgmAudio').src = nextBgm;
      else $('profileBgmAudio').removeAttribute('src');
    }
    $('profileBgmName').textContent = nextBgm ? String(items.bgm?.name || '個人頁音樂').slice(0, 60) : '尚未設定個人頁音樂';
    $('profileBgmToggle').disabled = !nextBgm;
    $('profileDecorEdit').hidden = !profile?.isSelf || !accountId || preview;
    if (!profile?.isSelf) $('profileDecorEditor').hidden = true;
    if (!$('profileDecorEditor').hidden) renderDecorControls();
  }
  function renderGuestbook() {
    const enabled = profile?.guestbookUnlocked === true || profile?.guestbook?.enabled === true;
    $('profileGuestbookCount').textContent = enabled ? `${fmt(profile?.guestbook?.commentCount ?? comments?.length ?? 0)} 則留言` : '';
    $('profileGuestbookLocked').hidden = !profile || enabled;
    $('profileGuestbookShop').hidden = !profile?.isSelf || enabled;
    $('profileGuestbookForm').hidden = !profile || !enabled || !accountId || preview;
    $('profileGuestbookMore').hidden = !enabled || !commentHasMore;
    const list = $('profileGuestbookList'); list.replaceChildren();
    if (!profile || !enabled) return;
    if (!Array.isArray(comments)) { list.append(el('p', 'voyage-collection-empty', '正在讀取好友留言…')); return; }
    if (!comments.length) { list.append(el('p', 'voyage-collection-empty', '還沒有留言。歡迎留下第一句問候。')); return; }
    for (const entry of comments) {
      const card = el('article', 'captain-guestbook-entry');
      const header = el('header'); const avatar = el('img'); avatar.alt = ''; avatar.src = imageFor('avatar', entry.authorAvatar) || imageFor('avatar', 8); avatarFallback(avatar);
      header.append(avatar, el('strong', '', String(entry.authorName || '航海者').slice(0, 40)));
      const when = new Date(entry.createdAt || entry.created_at || 0);
      if (Number.isFinite(when.getTime())) { const time = el('time', '', when.toLocaleString('zh-TW')); time.dateTime = when.toISOString(); header.append(time); }
      card.append(header, el('p', '', String(entry.body || '').slice(0, 240)));
      const authorId = number(entry.authorUserId ?? entry.authorId ?? entry.userId);
      if (profile.isSelf || authorId === accountId) {
        const remove = el('button', '', '刪除留言'); remove.type = 'button';
        remove.onclick = () => { pendingCommentDelete = entry.id; $('profileCommentDeleteHint').textContent = ''; $('profileCommentDeleteDialog').showModal(); };
        card.append(remove);
      }
      list.append(card);
    }
  }
  function renderProfile() { renderHero(); renderCabin(); window.LauncherRoom?.setProfile(profile, { accountId, preview }); renderGames(); renderCollectionTabs(); renderCollection(); renderGuestbook(); }
  async function loadProfile() {
    const requestId = ++profileRequest;
    commentRequest++; comments = null; commentNextBeforeId = 0; commentHasMore = false;
    if (!accountId || preview) {
      profile = null; renderProfile();
      status('profileStatus', preview ? '設計預覽不連線；登入後會讀取真實雲端紀錄。' : '請先登入帳號。');
      return;
    }
    status('profileStatus', '正在讀取雲端個人頁…');
    try {
      const result = await api.getLauncherProfile(viewUserId);
      if (requestId !== profileRequest) return;
      if (!result?.ok || !result.profile) { profile = null; renderProfile(); status('profileStatus', errorText(result?.error), true); return; }
      profile = result.profile; renderProfile(); status('profileStatus', '');
      if (roomEditorRequested && profile.isSelf) { roomEditorRequested = false; window.LauncherRoom?.openEditor(); }
      loadComments();
    } catch {
      if (requestId === profileRequest) { profile = null; renderProfile(); status('profileStatus', errorText('offline'), true); }
    }
  }
  async function loadComments(more = false) {
    if (more && !commentHasMore) return;
    const requestId = ++commentRequest;
    if (!profile || !(profile.guestbookUnlocked === true || profile.guestbook?.enabled === true) || !accountId || preview) {
      comments = null; renderGuestbook(); status('profileGuestbookStatus', ''); return;
    }
    status('profileGuestbookStatus', '正在讀取留言…');
    try {
      const result = await api.getLauncherComments(viewUserId, more ? commentNextBeforeId : 0);
      if (requestId !== commentRequest) return;
      if (!result?.ok) { if (!more) comments = []; renderGuestbook(); status('profileGuestbookStatus', errorText(result?.error), true); return; }
      const page = Array.isArray(result.comments) ? result.comments : [];
      comments = more ? [...(comments || []), ...page.filter(item => !(comments || []).some(existing => existing.id === item.id))] : page;
      commentHasMore = result.hasMore === true;
      commentNextBeforeId = Number.isSafeInteger(Number(result.nextBeforeId)) ? Number(result.nextBeforeId) : 0;
      if (result.enabled === false) profile.guestbookUnlocked = false;
      renderGuestbook(); status('profileGuestbookStatus', '');
    } catch {
      if (requestId === commentRequest) { comments = []; renderGuestbook(); status('profileGuestbookStatus', errorText('offline'), true); }
    }
  }
  async function savePlacement(slot, card) {
    if (decorBusy || !profile?.isSelf || !SLOTS.some(([name]) => name === slot)) return;
    const fields = Object.fromEntries([...card.querySelectorAll('input[data-field]')].map(input => [input.dataset.field, Number(input.value)]));
    const placement = { x: clamp(fields.x, 5, 95, 50), y: clamp(fields.y, 5, 95, 50), scale: clamp(fields.scale, .5, 1.5, 1) };
    decorBusy = true; renderDecorControls(); status('profileDecorStatus', '正在儲存佈置…');
    try {
      const result = await api.saveLauncherDecorationPlacement(slot, placement);
      if (!result?.ok) { status('profileDecorStatus', errorText(result?.error), true); return; }
      status('profileDecorStatus', '佈置位置已儲存。');
      await loadProfile();
    } catch { status('profileDecorStatus', errorText('offline'), true); }
    finally { decorBusy = false; if (!$('profileDecorEditor').hidden) renderDecorControls(); }
  }
  async function postComment(event) {
    event.preventDefault();
    const body = $('profileGuestbookInput').value.trim();
    if (commentBusy || !profile || !body || body.length > 240) return;
    commentBusy = true; $('profileGuestbookPost').disabled = true; status('profileGuestbookStatus', '正在發表留言…');
    try {
      const result = await api.postLauncherComment(viewUserId, body);
      if (!result?.ok) { status('profileGuestbookStatus', errorText(result?.error), true); return; }
      $('profileGuestbookInput').value = ''; $('profileGuestbookLength').textContent = '0 / 240';
      await loadProfile();
      status('profileGuestbookStatus', '留言已發表。');
    } catch { status('profileGuestbookStatus', errorText('offline'), true); }
    finally { commentBusy = false; $('profileGuestbookPost').disabled = false; }
  }
  async function deleteComment() {
    if (!pendingCommentDelete || commentBusy) return;
    commentBusy = true; $('profileCommentDeleteConfirm').disabled = true; $('profileCommentDeleteHint').textContent = '正在刪除留言…';
    try {
      const result = await api.deleteLauncherComment(pendingCommentDelete);
      if (!result?.ok) { $('profileCommentDeleteHint').textContent = errorText(result?.error); return; }
      $('profileCommentDeleteDialog').close(); pendingCommentDelete = null;
      await loadProfile(); status('profileGuestbookStatus', '留言已刪除。');
    } catch { $('profileCommentDeleteHint').textContent = errorText('offline'); }
    finally { commentBusy = false; $('profileCommentDeleteConfirm').disabled = false; }
  }
  async function toggleBgm() {
    const audio = $('profileBgmAudio');
    if (!bgmSource) return;
    if (!audio.paused) { stopBgm(); return; }
    const requestId = ++bgmPlayRequest;
    const source = bgmSource;
    try {
      audio.currentTime = 0;
      await audio.play();
      if (requestId !== bgmPlayRequest || source !== bgmSource || $('profilePanel').hidden || document.hidden) { stopBgm(); return; }
      $('profileBgmToggle').textContent = '停止音樂';
    } catch {
      if (requestId === bgmPlayRequest && !$('profilePanel').hidden) status('profileStatus', '音樂無法播放，請確認音效裝置或稍後再試。', true);
    }
  }
  function safeCatalog() {
    return (Array.isArray(shop?.catalog) ? shop.catalog : []).filter(item =>
      item && TYPE_LABEL[item.type] && typeof item.id === 'string' && /^[a-z0-9-]{3,64}$/.test(item.id) &&
      Number.isSafeInteger(Number(item.price)) && Number(item.price) >= 0 &&
      (['avatar', 'wall', 'flag'].includes(item.type) ? !!imageFor(item.type, item.key) :
        ['background', 'frame'].includes(item.type) ? !!safeImageAsset(item.asset) :
        item.type === 'decoration' ? !!safeImageAsset(item.asset) && SLOTS.some(([slot]) => slot === item.slot) :
        item.type === 'bgm' ? !!safeAudioAsset(item.asset) :
        item.type === 'layout' ? ['layout-grand-line', 'layout-bounty-board', 'layout-captain-quarters', 'layout-sunny-deck', 'layout-sunny-kitchen', 'layout-sunny-library'].includes(item.id) :
        ROOM_TYPES.includes(item.type) ? !!safeImageAsset(item.asset) :
        item.id === 'guestbook-1'));
  }
  function owned(item) {
    if (item.type === 'guestbook') return shop?.owned?.guestbook === true;
    if (ROOM_TYPES.includes(item.type)) {
      const field = { room_scene: 'roomScenes', room_furniture: 'roomFurniture', room_character: 'roomCharacters' }[item.type];
      return Array.isArray(shop?.owned?.[field]) && shop.owned[field].includes(item.id);
    }
    if (['background', 'frame', 'layout', 'decoration', 'bgm'].includes(item.type)) {
      const field = { background: 'backgrounds', frame: 'frames', layout: 'layouts', decoration: 'decorations', bgm: 'bgms' }[item.type];
      return Array.isArray(shop?.owned?.[field]) && shop.owned[field].includes(item.id);
    }
    const field = item.type === 'avatar' ? 'avatars' : item.type === 'wall' ? 'walls' : 'flags';
    return validIds(shop?.owned?.[field], item.type === 'avatar' ? MAX_AVATAR_ID : item.type === 'wall' ? 8 : 15).includes(Number(item.key));
  }
  function equipped(item) {
    if (item.type === 'guestbook') return owned(item);
    if (ROOM_TYPES.includes(item.type)) return false;
    if (item.type === 'background') return shop?.equipped?.backgroundId === item.id;
    if (item.type === 'frame') return shop?.equipped?.frameId === item.id;
    if (item.type === 'layout') return shop?.equipped?.layoutId === item.id;
    if (item.type === 'bgm') return shop?.equipped?.bgmId === item.id;
    if (item.type === 'decoration') return shop?.equipped?.decorations?.[item.slot] === item.id;
    const field = item.type === 'avatar' ? 'avatar' : item.type === 'wall' ? 'wall' : 'flag';
    return Number(shop?.equipped?.[field]) === Number(item.key);
  }
  function renderShopReset() {
    const actions = $('shopResetActions'); actions.replaceChildren();
    if (!shop || shop.preview) return;
    const choices = shopTab === 'background' ? [['background-default', '恢復原始背景']] :
      shopTab === 'frame' ? [['frame-none', '移除相框']] :
      shopTab === 'layout' ? [['layout-default', '恢復原始排版']] :
      shopTab === 'bgm' ? [['bgm-none', '停用個人頁音樂']] :
      shopTab === 'decoration' ? SLOTS.map(([slot, label]) => [`decor-none-${slot}`, `移除${label}貼紙`]) : [];
    for (const [id, label] of choices) {
      const button = el('button', '', label); button.type = 'button'; button.disabled = shopBusy;
      button.onclick = () => equipById(id, label); actions.append(button);
    }
  }
  function renderShopTabs() {
    const tabs = $('shopCategoryTabs'); tabs.replaceChildren();
    for (const [id, label] of SHOP_TABS) {
      const button = el('button', '', label); button.type = 'button'; button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(id === shopTab));
      button.onclick = () => { shopTab = id; renderShopTabs(); renderShop(); };
      tabs.append(button);
    }
  }
  function renderShop() {
    const wallet = number(shop?.wallet?.coins);
    $('shopWallet').textContent = shop && !shop.preview ? fmt(wallet) : '—';
    $('shopWalletMeta').textContent = shop && !shop.preview
      ? `每日補給 +${fmt(shop.wallet?.dailyGrant)}，上限 ${fmt(shop.wallet?.cap)}`
      : '登入後查看每日補給';
    const list = safeCatalog().filter(item => item.type === shopTab);
    $('shopItemCount').textContent = shop ? `${list.length} 件商品` : '';
    renderShopReset();
    const grid = $('shopGrid'); grid.replaceChildren();
    if (!list.length) { grid.append(el('p', 'voyage-collection-empty', shop ? '此分類目前沒有商品。' : '正在等待商店資料。')); return; }
    for (const item of list) {
      const article = el('article', 'shop-item'); article.dataset.rarity = item.rarity || 'common'; article.dataset.type = item.type; article.dataset.itemId = item.id;
      const visual = el('div', 'shop-item-image');
      const source = itemImage(item);
      if (source) { const image = el('img'); image.src = source; image.alt = ''; if (item.type === 'avatar') avatarFallback(image); visual.append(image); }
      else if (item.type === 'layout') { const miniature = el('div', 'shop-layout-preview'); miniature.dataset.layout = item.id; miniature.append(el('i'), el('span', '', 'CAPTAIN')); visual.append(miniature); }
      else visual.append(el('span', 'shop-symbol', item.type === 'bgm' ? '♫' : '✒'));
      const body = el('div', 'shop-item-body');
      body.append(el('small', '', `${RARITY[item.rarity] || '普通'} · ${TYPE_LABEL[item.type]}${item.slot ? ` · ${SLOTS.find(([slot]) => slot === item.slot)?.[1] || ''}` : ''}`), el('strong', '', String(item.name || item.id).slice(0, 80)));
      const bottom = el('div', 'shop-item-bottom');
      const isOwned = owned(item), isEquipped = equipped(item);
      bottom.append(el('span', '', isOwned ? item.type === 'guestbook' ? '已解鎖' : '已收藏' : `${fmt(item.price)} 金幣`));
      const button = el('button', '', shop?.preview ? '登入後購買' : isEquipped ? item.type === 'guestbook' ? '已開放' : '使用中' : isOwned ? ROOM_TYPES.includes(item.type) ? '佈置' : '套用' : wallet < number(item.price) ? '金幣不足' : '購買');
      button.type = 'button'; button.disabled = shopBusy || shop?.preview || isEquipped || (!isOwned && wallet < number(item.price));
      button.onclick = () => {
        if (isOwned && ROOM_TYPES.includes(item.type)) { roomEditorRequested = true; window.LauncherProfileShop?.openProfile(0); }
        else if (isOwned) equip(item);
        else confirmPurchase(item);
      };
      bottom.append(button); body.append(bottom); article.append(visual, body); grid.append(article);
    }
  }
  async function loadShop() {
    const requestId = ++shopRequest;
    if (!accountId && !preview) {
      shop = null; renderShopTabs(); renderShop();
      status('shopStatus', '請先登入帳號。'); return;
    }
    status('shopStatus', preview ? '正在讀取商品目錄…' : '正在核對雲端商品與餘額…');
    try {
      const result = await api.getLauncherShop(preview ? { preview: true } : undefined);
      if (requestId !== shopRequest) return;
      if (!result?.ok || !result.shop) { shop = null; renderShop(); status('shopStatus', errorText(result?.error), true); return; }
      shop = result.shop; renderShopTabs(); renderShop(); status('shopStatus', preview ? '設計預覽可查看商品；登入後才能使用金幣購買。' : '');
    } catch { if (requestId === shopRequest) { shop = null; renderShop(); status('shopStatus', errorText('offline'), true); } }
  }
  function confirmPurchase(item) {
    if (!shop || shop.preview || shopBusy || owned(item)) return;
    pendingPurchase = item;
    $('shopConfirmName').textContent = String(item.name || item.id).slice(0, 80);
    $('shopConfirmCopy').textContent = `確定花費 ${fmt(item.price)} 金幣收藏這件商品？`;
    const source = itemImage(item);
    $('shopConfirmImage').hidden = !source;
    if (source) $('shopConfirmImage').src = source;
    else $('shopConfirmImage').removeAttribute('src');
    $('shopConfirmPrice').textContent = `${fmt(item.price)} 金幣`;
    $('shopConfirmHint').textContent = '購買後會儲存在雲端帳號。';
    $('shopConfirmBuy').disabled = false;
    $('shopConfirmDialog').showModal();
  }
  async function buy() {
    const item = pendingPurchase;
    if (!item || shopBusy) return;
    shopBusy = true; $('shopConfirmBuy').disabled = true; $('shopConfirmHint').textContent = '正在確認購買…';
    try {
      const result = await api.buyLauncherItem(item.id);
      if (!result?.ok || !result.shop) { $('shopConfirmHint').textContent = result?.error === 'timeout' ? '結果尚未確認。請關閉後重新整理商店，避免重複購買。' : errorText(result?.error); return; }
      shop = result.shop; $('shopConfirmDialog').close(); renderShop();
      status('shopStatus', `已收藏「${String(item.name || item.id).slice(0, 80)}」。`);
      if (profile?.isSelf) loadProfile();
    } catch { $('shopConfirmHint').textContent = errorText('offline'); }
    finally { shopBusy = false; $('shopConfirmBuy').disabled = false; renderShop(); }
  }
  async function equip(item) {
    if (shopBusy || !owned(item) || item.type === 'guestbook' || ROOM_TYPES.includes(item.type)) return;
    return equipById(item.id, String(item.name || item.id).slice(0, 80));
  }
  async function equipById(itemId, label) {
    if (shopBusy || !shop || shop.preview) return;
    shopBusy = true; renderShop(); status('shopStatus', '正在套用裝扮…');
    try {
      const result = await api.equipLauncherItem(itemId);
      if (!result?.ok || !result.shop) { status('shopStatus', errorText(result?.error), true); return; }
      shop = result.shop; status('shopStatus', `已套用「${label}」。`);
      if (profile?.isSelf) loadProfile();
    } catch { status('shopStatus', errorText('offline'), true); }
    finally { shopBusy = false; renderShop(); }
  }

  $('profileRefresh').onclick = loadProfile;
  $('profileBackToFriends').onclick = () => window.launcherSwitchPanel?.('social');
  $('profileShopShortcut').onclick = () => window.launcherSwitchPanel?.('shop');
  $('profileDecorEdit').onclick = () => { $('profileDecorEditor').hidden = !$('profileDecorEditor').hidden; if (!$('profileDecorEditor').hidden) renderDecorControls(); };
  $('profileDecorShop').onclick = () => { shopTab = 'decoration'; window.launcherSwitchPanel?.('shop'); };
  $('profileBgmToggle').onclick = toggleBgm;
  $('profileBgmAudio').onended = stopBgm;
  $('profileGuestbookShop').onclick = () => { shopTab = 'guestbook'; window.launcherSwitchPanel?.('shop'); };
  $('profileGuestbookForm').onsubmit = postComment;
  $('profileGuestbookInput').oninput = () => { $('profileGuestbookLength').textContent = `${$('profileGuestbookInput').value.length} / 240`; };
  $('profileGuestbookMore').onclick = () => loadComments(true);
  $('profileCommentDeleteCancel').onclick = () => $('profileCommentDeleteDialog').close();
  $('profileCommentDeleteConfirm').onclick = deleteComment;
  $('profileCommentDeleteDialog').addEventListener('close', () => { pendingCommentDelete = null; });
  $('shopConfirmClose').onclick = () => $('shopConfirmDialog').close();
  $('shopConfirmCancel').onclick = () => $('shopConfirmDialog').close();
  $('shopConfirmBuy').onclick = buy;
  $('shopConfirmDialog').addEventListener('close', () => { pendingPurchase = null; });
  $('shopConfirmDialog').addEventListener('click', event => { if (event.target === $('shopConfirmDialog')) $('shopConfirmDialog').close(); });
  window.LauncherProfileShop = {
    setAccount(snapshot) {
      const id = snapshot?.authenticated && !snapshot.profile?.needsDisplayName ? number(snapshot.profile?.userId) : 0;
      const isPreview = snapshot?.previewMode === true;
      if (id === accountId && isPreview === preview) return;
      stopBgm(); bgmSource = '';
      accountId = id; preview = isPreview; viewUserId = 0; profile = null; shop = null; roomEditorRequested = false;
      profileRequest++; shopRequest++; commentRequest++; comments = null; commentHasMore = false; commentNextBeforeId = 0; pendingPurchase = null; pendingCommentDelete = null;
      if ($('shopConfirmDialog').open) $('shopConfirmDialog').close();
      if ($('profileCommentDeleteDialog').open) $('profileCommentDeleteDialog').close();
      $('profileDecorEditor').hidden = true;
      renderProfile(); renderShopTabs(); renderShop();
    },
    openProfile(userId = 0) {
      const id = number(userId);
      stopBgm(); bgmSource = '';
      viewUserId = id && id !== accountId ? id : 0;
      profile = null; comments = null; profileRequest++; commentRequest++; commentHasMore = false; commentNextBeforeId = 0;
      $('profileDecorEditor').hidden = true;
      if (window.launcherSwitchPanel) window.launcherSwitchPanel('profile');
      else loadProfile();
    },
    onVisible(panel) {
      if (panel !== 'profile') stopBgm();
      window.LauncherRoom?.onVisible(panel);
      if (panel === 'profile' && !profile) loadProfile();
      if (panel === 'shop') loadShop();
    },
    openShopCategory(category) {
      if (!SHOP_TABS.some(([id]) => id === category)) return;
      shopTab = category;
      window.launcherSwitchPanel?.('shop');
      renderShopTabs(); renderShop();
    },
    onRoomSaved(nextProfile, nextShop) {
      if (!nextProfile?.isSelf || !profile?.isSelf || nextProfile.userId !== profile.userId) return;
      profile = nextProfile;
      if (nextShop) shop = nextShop;
      renderProfile();
    }
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopBgm(); });
  renderProfile(); renderShopTabs(); renderShop();
})();
