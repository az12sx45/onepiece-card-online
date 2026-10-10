(() => {
  'use strict';
  const api = window.onePieceDesktop;
  const $ = id => document.getElementById(id);
  const GAME_META = [
    { id: 'card', title: '偉大航道爭霸戰', english: 'GRAND LINE RIVALRY', cover: 'launcher_card_cover_perspective_v2.webp' },
    { id: 'board', title: '新世界航海錄', english: 'NEW WORLD VOYAGE', cover: 'launcher_board_cover_logo_perspective_v5.webp' },
    { id: 'chess', title: '霸海戰棋', english: 'PIRATE WAR CHESS', cover: 'launcher_chess_cover_logo_perspective_v5.webp' }
  ];
  const COLLECTION_TABS = [
    ['avatars', '頭像'], ['walls', '牆面'], ['flags', '旗幟'], ['launcher', '展示室'], ['titles', '榮譽'], ['board', '航海圖鑑'], ['chess', '戰棋']
  ];
  const SHOP_TABS = [['avatar', '頭像'], ['room_scene', '房間場景'], ['room_furniture', '房間家具'], ['room_character', 'Q版夥伴'], ['background', '背景'], ['frame', '相框'], ['wall', '牆面'], ['flag', '旗幟'], ['layout', '排版'], ['decoration', '貼紙'], ['bgm', '音樂'], ['guestbook_style', '留言板'], ['comment_style', '留言紙'], ['guestbook', '留言板解鎖']];
  const TYPE_LABEL = { avatar: '頭像', room_scene: '房間場景', room_furniture: '房間家具', room_character: 'Q版夥伴', background: '背景', frame: '相框', wall: '牆面', flag: '旗幟', layout: '排版', decoration: '貼紙', bgm: '音樂', guestbook: '留言板解鎖', guestbook_style: '留言板', comment_style: '留言紙' };
  const ROOM_TYPES = ['room_scene', 'room_furniture', 'room_character'];
  const SLOTS = [['header', '上方'], ['side', '側邊'], ['footer', '下方']];
  const RARITY = { common: '普通', rare: '稀有', epic: '史詩', legend: '傳說' };
  const MAX_AVATAR_ID = 122;
  // Versioned profile operations ride the existing authenticated desktop bridge.
  // The server validates catalog IDs, ownership and permissions for each action.
  const profileCommand = (operation, payload = {}, requestId = crypto.randomUUID()) => api.commandLauncherLife({
    requestId, expectedRevision: 0, type: 'event.record', payload: { scope: 'launcher-profile-v1', operation, ...payload }
  });
  const extendedItem = id => /^(?:guestbook-style-|comment-style-)/.test(id) || /^ava-[1-9][0-9]*$/.test(id) && Number(id.slice(4)) >= 63 && Number(id.slice(4)) <= MAX_AVATAR_ID;
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
    if (type === 'room_scene' && ['sunny-deck', 'sunny-kitchen', 'sunny-library'].includes(key)) return `opui://launcher/images/launcher_room/scenes/${key}-v2.webp`;
    if (type === 'room_character' && ['luffy', 'zoro', 'nami', 'usopp', 'sanji', 'chopper', 'robin', 'franky', 'brook', 'jinbe'].includes(key)) return `opui://launcher/images/launcher_room/${window.OnePieceRoomMotion?.LUFFY_ART_ENABLED === true && key === 'luffy' ? 'portrait_v4' : 'portrait_v3'}/${key}.webp`;
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
  function portraitFallback(image, item) {
    image.onerror = null;
    if (window.OnePieceRoomMotion?.LUFFY_ART_ENABLED !== true || item?.type !== 'room_character' || item?.key !== 'luffy') return;
    image.onerror = () => {
      image.onerror = null;
      image.src = 'opui://launcher/images/launcher_room/portrait_v3/luffy.webp';
    };
  }
  const clamp = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
  const errorText = code => ({
    'client_update_required': '請先更新啟動器，再操作含新夥伴的個人頁。',
    'character_not_released': '這位夥伴尚未開放，請留意後續公告。',
    'not authenticated': '請先登入帳號。', 'bad secret': '登入已失效，請重新登入。',
    'not friends': '目前無法參觀這位玩家的個人頁。', 'not found': '找不到這位玩家。',
    'insufficient_coins': '金幣不足。', 'insufficient coins': '金幣不足。',
    'already_owned': '已經收藏這件商品。', 'not_owned': '尚未收藏這件商品。',
    'room_full': '房間最多同時放 10 位夥伴。請先在佈置模式收回一位，再放入新夥伴。',
    'invalid item': '這件商品目前無法購買，請更新啟動器後再試。',
    'invalid_comment_style': '請重新選擇留言紙。', 'comment_style_not_owned': '尚未收藏這款留言紙。', 'comment_deleted': '這則留言已刪除。', 'request_id_conflict': '內容已變更，請修改文字後重新送出。',
    'guestbook_locked': '留言板尚未解鎖。', 'not_friends': '目前只有好友可以留言。',
    'invalid placement': '佈置位置不正確，請重新調整。', 'rate_limited': '留言太頻繁，請稍後再試。',
    'invalid card': '名片內容不正確，請檢查名稱、簡介與頭像。', 'invalid_card': '名片內容不正確，請檢查名稱、簡介與頭像。',
    timeout: '伺服器回應逾時，請重新整理確認結果。', offline: '目前無法連線，請稍後再試。'
  })[String(code || '')] || '操作未完成，請稍後再試。';

  let accountId = 0, accountAvatarVersion = 0;
  let preview = false;
  let viewUserId = 0;
  let profile = null;
  let shop = null;
  let profileRequest = 0;
  let shopRequest = 0;
  let collectionTab = 'avatars';
  let shopTab = 'avatar';
  let announcementShopItem = '';
  let pendingPurchase = null;
  let shopBusy = false;
  let shopMutation = 0;
  const shopPreviewAudio = el('audio');
  shopPreviewAudio.dataset.role = 'shop-preview';
  shopPreviewAudio.preload = 'none';
  shopPreviewAudio.volume = .4;
  $('shopPanel').append(shopPreviewAudio);
  let shopPreviewId = '';
  let shopPreviewRequest = 0;
  let shopPreviewPending = false;
  let comments = null;
  let commentRequest = 0;
  let commentNextBeforeId = 0;
  let commentHasMore = false;
  let commentBusy = false;
  let pendingCommentDelete = null;
  let cardBusy = false;
  let decorBusy = false;
  let cardMutation = 0;
  let bgmSource = '';
  let bgmPlaylist = [];
  let bgmIndex = 0;
  let bgmPlayRequest = 0;
  let bgmPlayPending = false;
  let bgmPausedByUser = false;
  let bgmAutoplayBlocked = false;
  let bgmState = 'idle';
  let bgmSaveRequest = 0;
  let bgmPickerBusy = false;
  let profileVisible = false;
  const BGM_LISTENER_KEY = 'onepiece.launcher.profileMusic.v1';
  let bgmListener = { volume: .35, muted: false };
  try {
    const saved = JSON.parse(localStorage.getItem(BGM_LISTENER_KEY) || 'null');
    if (saved && Number.isFinite(saved.volume) && typeof saved.muted === 'boolean') bgmListener = { volume: clamp(saved.volume, 0, 1, .35), muted: saved.muted };
  } catch { /* Listener preferences never change the page owner's saved song. */ }
  let roomEditorRequested = false;

  function status(target, message, error = false) {
    const node = $(target);
    node.textContent = message;
    node.classList.toggle('is-error', error);
  }
  function emptyCollection(message) { $('profileCollectionGrid').replaceChildren(el('p', 'voyage-collection-empty', message)); }
  function avatarFallback(img) { img.onerror = () => { img.onerror = null; img.src = imageFor('avatar', 8); }; }
  function cardDisplayName(p) { return String(p?.card?.displayName || p?.name || '航海者'); }
  function cardTagline(p) { return typeof p?.card?.tagline === 'string' ? p.card.tagline : String(p?.title || '偉大航道航海者'); }
  function cardAvatarId(p) {
    const chosen = Number(p?.card?.avatarId);
    return Number.isInteger(chosen) && chosen >= 1 && chosen <= MAX_AVATAR_ID ? chosen : number(p?.avatar) || 8;
  }
  function renderHero() {
    const own = profile ? profile.isSelf !== false : !viewUserId;
    const p = profile || {};
    if(p.isSelf&&number(p.userId)===accountId)publishAccountAvatar(p);
    $('profilePageTitle').textContent = own ? '個人頁' : '好友個人頁';
    $('profilePageHint').textContent = own ? '三款遊戲的航行紀錄與珍藏。' : '參觀好友的遊戲紀錄與公開蒐藏。';
    $('profileBackToFriends').hidden = own;
    $('profileHeroKind').textContent = own ? 'MY VOYAGE' : 'FRIEND VOYAGE';
    $('profileHeroName').textContent = cardDisplayName(p);
    $('profileHeroTitle').textContent = cardTagline(p);
    $('profileHeroId').textContent = p.userId ? `航海者 #${number(p.userId)}` : '';
    $('profileHeroAvatar').src = imageFor('avatar', cardAvatarId(p)) || imageFor('avatar', 8);
    avatarFallback($('profileHeroAvatar'));
    const appearance = p.appearance || {};
    const items = p.appearanceItems || {};
    const hero = $('profileHero');
    hero.classList.toggle('is-friend', !own);
    const layoutId = String(appearance.layoutId || 'layout-default');
    hero.dataset.layout = ['layout-grand-line', 'layout-bounty-board', 'layout-captain-quarters', 'layout-sunny-deck', 'layout-sunny-kitchen', 'layout-sunny-library'].includes(layoutId) ? layoutId : 'layout-default';
    const background = items.background?.id === appearance.backgroundId ? safeImageAsset(items.background?.asset) : '';
    const wall = imageFor('wall', appearance.wallId);
    const cardArt = background || wall;
    $('profileHeroArt').style.backgroundImage = cardArt ? `linear-gradient(90deg, #04141eee, #04141e99 68%, #04141e55), url("${cardArt}")` : '';
    const frame = items.frame?.id === appearance.frameId ? safeImageAsset(items.frame?.asset) : '';
    $('profileHeroFrame').hidden = !frame;
    $('profileHeroFrame').style.backgroundImage = frame ? `url("${frame}")` : '';
    const flag = imageFor('flag', appearance.flagId);
    $('profileHeroFlag').hidden = !flag;
    if (flag) $('profileHeroFlag').src = flag;
    else $('profileHeroFlag').removeAttribute('src');
    const stickers = $('profileHeroStickers'); stickers.replaceChildren();
    for (const [slot] of SLOTS) {
      const item = items.decorations?.[slot];
      const source = safeImageAsset(item?.asset);
      if (!source || item?.id !== appearance.decorations?.[slot]) continue;
      const position = slotPlacement(appearance.decorationPlacement, slot);
      const img = el('img', 'captain-hero-sticker'); img.alt = ''; img.src = source; img.dataset.slot = slot;
      img.style.left = `${position.x}%`; img.style.top = `${position.y}%`; img.style.setProperty('--scale', String(position.scale));
      stickers.append(img);
    }
    $('profileCardEdit').hidden = !own || !p.isSelf || !accountId || preview;
    if (!own || !p.isSelf || !accountId || preview) $('profileCardEditor').hidden = true;
  }
  function publishAccountAvatar(p){
    if(!p?.isSelf||number(p.userId)!==accountId)return;
    accountAvatarVersion++;
    window.LauncherProfileAvatar={userId:accountId,avatar:number(p.avatar)};
    window.dispatchEvent(new Event('launcher-profile-avatar'));
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
      const ids = Array.isArray(profile?.collection?.launcher?.itemIds) ? profile.collection.launcher.itemIds.filter(id => typeof id === 'string' && /^[a-z0-9-]{3,64}$/.test(id)) : [];
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
  function stopBgm(resetTime = true) {
    bgmPlayRequest++;
    bgmPlayPending = false; bgmState = 'idle';
    const audio = $('profileBgmAudio');
    audio.pause();
    try { if (resetTime) audio.currentTime = 0; } catch { /* The source may still be loading. */ }
    renderMusicControls();
  }
  function clearBgm() {
    stopBgm(); bgmSource = ''; bgmPlaylist = []; bgmIndex = 0; bgmAutoplayBlocked = false; bgmPausedByUser = false;
    bgmSaveRequest++; bgmPickerBusy = false; $('profileBgmPicker').hidden = true;
    $('profileBgmSave').disabled = false; $('profileBgmCancel').disabled = false;
    const audio = $('profileBgmAudio'); audio.removeAttribute('src'); audio.load();
    $('profileBgmName').textContent = '尚未設定個人頁音樂';
    renderMusicControls();
  }
  function musicVisible() {
    return accountId > 0 && !preview && profile && document.body.dataset.stage === 'app' && !$('profilePanel').hidden && !document.hidden;
  }
  function renderMusicControls() {
    const audio = $('profileBgmAudio'), quiet = bgmListener.muted || bgmListener.volume === 0;
    audio.volume = bgmListener.volume; audio.muted = bgmListener.muted;
    $('profileBgmToggle').disabled = !bgmSource;
    $('profileBgmNext').disabled = bgmPlaylist.length < 2;
    $('profileBgmToggle').textContent = bgmPlayPending ? '取消播放' : !audio.paused ? '暫停音樂' : '播放音樂';
    $('profileBgmMute').textContent = quiet ? '取消靜音' : '靜音';
    $('profileBgmMute').setAttribute('aria-pressed', String(quiet));
    $('profileBgmVolume').value = String(Math.round(bgmListener.volume * 100));
    $('profileBgmVolumeValue').textContent = `${Math.round(bgmListener.volume * 100)}%`;
    $('profileBgmHint').textContent = !bgmSource ? '選擇已購歌曲後，進入時會自動播放。' : bgmAutoplayBlocked ? '系統限制了自動播放，按「播放音樂」即可開始。' : bgmState === 'error' ? '音樂暫時無法播放，可按播放重試或下一首。' : bgmPausedByUser ? '音樂已暫停；下次進入個人頁時會自動播放。' : quiet ? '目前已靜音；音量設定只影響你聽到的聲音。' : bgmPlayPending ? '正在載入個人頁音樂…' : bgmPlaylist.length > 1 ? `依序輪播 ${bgmPlaylist.length} 首；離開個人頁時停止。` : '進入時自動播放；離開個人頁時停止。';
  }
  function saveMusicListener() {
    try { localStorage.setItem(BGM_LISTENER_KEY, JSON.stringify(bgmListener)); } catch { /* Playback also works without persistent browser storage. */ }
    renderMusicControls();
  }
  async function playBgm(automatic = false) {
    const audio = $('profileBgmAudio');
    if (!bgmSource || !musicVisible() || bgmPlayPending || (automatic && (bgmPausedByUser || bgmAutoplayBlocked)) || !audio.paused) return;
    const requestId = ++bgmPlayRequest, source = bgmSource;
    bgmPlayPending = true; bgmState = 'loading'; renderMusicControls();
    try {
      await audio.play();
      // A superseded play promise must never pause a newer owner's song.
      if (requestId !== bgmPlayRequest || source !== bgmSource) return;
      if (!musicVisible()) { stopBgm(); return; }
      bgmPlayPending = false; bgmAutoplayBlocked = false; bgmState = 'playing'; renderMusicControls();
    } catch (error) {
      if (requestId !== bgmPlayRequest || source !== bgmSource) return;
      bgmPlayPending = false;
      bgmAutoplayBlocked = error?.name === 'NotAllowedError';
      bgmState = bgmAutoplayBlocked ? 'blocked' : 'error'; renderMusicControls();
    }
  }
  function slotPlacement(placement, slot) {
    const defaults = { header: { x: 50, y: 12 }, side: { x: 12, y: 54 }, footer: { x: 50, y: 86 } }[slot];
    const value = placement?.[slot] || {};
    return { x: clamp(value.x, 5, 95, defaults.x), y: clamp(value.y, 5, 95, defaults.y), scale: clamp(value.scale, .5, 1.5, 1) };
  }
  function setBgmTrack(index) {
    const audio = $('profileBgmAudio');
    bgmIndex = index;
    bgmSource = bgmPlaylist[index]?.src || '';
    audio.loop = bgmPlaylist.length === 1;
    if (bgmSource) audio.src = bgmSource;
    else audio.removeAttribute('src');
    audio.load();
    const track = bgmPlaylist[index];
    $('profileBgmName').textContent = track
      ? `${track.name}${bgmPlaylist.length > 1 ? `（${index + 1} / ${bgmPlaylist.length}）` : ''}`
      : '尚未設定個人頁音樂';
    renderMusicControls();
  }
  function nextBgm(automatic = false) {
    if (bgmPlaylist.length < 2 || !musicVisible()) return;
    stopBgm();
    setBgmTrack((bgmIndex + 1) % bgmPlaylist.length);
    if (!automatic) { bgmPausedByUser = false; bgmAutoplayBlocked = false; }
    playBgm(automatic);
  }
  function renderMusic() {
    const appearance = profile?.appearance || {};
    const items = profile?.appearanceItems || {};
    const ids = Array.isArray(appearance.bgmIds) ? appearance.bgmIds : [appearance.bgmId];
    const available = Array.isArray(items.bgms) ? items.bgms : [items.bgm];
    const nextPlaylist = [...new Set(ids)].map(id => available.find(item => item?.id === id))
      .filter(item => item && safeAudioAsset(item.asset))
      .map(item => ({ id: item.id, name: String(item.name || '個人頁音樂').slice(0, 60), src: safeAudioAsset(item.asset) }));
    if (nextPlaylist.length !== bgmPlaylist.length || nextPlaylist.some((item, index) => item.id !== bgmPlaylist[index].id || item.src !== bgmPlaylist[index].src)) {
      stopBgm(); bgmPlaylist = nextPlaylist; bgmAutoplayBlocked = false;
      setBgmTrack(0);
    }
    $('profileBgmChoose').hidden = !profile?.isSelf || !accountId || preview;
    $('profileBgmChoose').disabled = !Array.isArray(profile?.collection?.launcher?.bgms) || !profile.collection.launcher.bgms.length;
    if ($('profileBgmChoose').hidden) $('profileBgmPicker').hidden = true;
    renderMusicControls();
    if (bgmSource && bgmState !== 'error') playBgm(true);
  }
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let guestbookPaused = false, guestbookReading = motionPreference.matches, guestbookObserver;
  let stationery = [], stationeryRequest = 0, selectedStationery = 'comment-style-default', postRequestId = '', commentMutation = 0;
  function noteAsset(entry) { return safeImageAsset(entry?.style?.asset); }
  function paintNote(node, asset) {
    node.classList.toggle('has-note-art', Boolean(asset));
    node.dataset.noteStyle = asset ? asset.split('/').pop().replace(/\.webp$/, '') : 'default';
    node.style.setProperty('--note-art', asset ? `url("${asset}")` : 'none');
  }
  function syncGuestbookMotion() {
    const stage = $('profileGuestbookStage');
    stage.dataset.paused = String(guestbookPaused || document.hidden || !profileVisible || $('profileCommentReadDialog').open || $('shopItemPreviewDialog')?.open);
    stage.dataset.reading = String(guestbookReading);
    $('profileGuestbookMotion').textContent = guestbookPaused ? '繼續彈幕' : '暫停彈幕';
    $('profileGuestbookMotion').setAttribute('aria-pressed', String(guestbookPaused));
    $('profileGuestbookMotion').disabled = guestbookReading;
    $('profileGuestbookRead').textContent = guestbookReading ? '返回彈幕' : '閱讀模式';
    $('profileGuestbookRead').setAttribute('aria-pressed', String(guestbookReading));
  }
  function showComment(entry) {
    const holder=$('profileCommentReadBody'); holder.replaceChildren(makeComment(entry,true));
    $('profileCommentReadDialog').showModal(); syncGuestbookMotion();
  }
  function makeComment(entry, full=false) {
    const card=el('article','captain-guestbook-entry'); card.dataset.commentId=String(entry.id);
    paintNote(card,noteAsset(entry));
    const header=el('header'), avatar=el('img'); avatar.alt=''; avatar.src=imageFor('avatar',entry.authorAvatar)||imageFor('avatar',8); avatarFallback(avatar);
    header.append(avatar,el('strong','',String(entry.authorName||'航海者').slice(0,40)));
    const when=new Date(entry.createdAt||entry.created_at||0);
    if(full&&Number.isFinite(when.getTime())){const time=el('time','',when.toLocaleString('zh-TW'));time.dateTime=when.toISOString();header.append(time);}
    card.append(header,el('p','',String(entry.body||'').slice(0,280)));
    if(full){
      const authorId=number(entry.authorUserId??entry.authorId??entry.userId);
      if(profile?.isSelf||authorId===accountId){const remove=el('button','','刪除留言');remove.type='button';remove.onclick=()=>{pendingCommentDelete=entry.id;$('profileCommentDeleteHint').textContent='';$('profileCommentDeleteDialog').showModal();};card.append(remove);}
    }else{
      card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label',`${String(entry.authorName||'航海者').slice(0,40)}：${String(entry.body||'').slice(0,80)}，點開閱讀`);
      card.onclick=()=>showComment(entry);card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showComment(entry);}};
    }
    return card;
  }
  function renderStationery() {
    const select=$('profileCommentStyle');select.replaceChildren();
    const base=el('option','','航海素紙');base.value='comment-style-default';select.append(base);
    for(const item of stationery){const option=el('option','',item.name);option.value=item.id;select.append(option);}
    if(![...select.options].some(o=>o.value===selectedStationery))selectedStationery='comment-style-default';
    select.value=selectedStationery;paintNote($('profileCommentPreview'),safeImageAsset(stationery.find(s=>s.id===selectedStationery)?.asset));
  }
  async function loadStationery() {
    const request=++stationeryRequest,owner=accountId;if(!owner||preview)return;
    try{const result=await api.getLauncherShop();if(request!==stationeryRequest||owner!==accountId||!result?.ok)return;
      const owned=new Set(result.shop?.owned?.commentStyles||[]);stationery=(result.shop?.catalog||[]).filter(i=>i.type==='comment_style'&&owned.has(i.id)&&safeImageAsset(i.asset));
      selectedStationery=result.shop?.equipped?.commentStyleId||'comment-style-default';renderStationery();
    }catch{if(request===stationeryRequest)renderStationery();}
  }
  function renderGuestbook() {
    const enabled = profile?.guestbookUnlocked === true || profile?.guestbook?.enabled === true;
    $('profileGuestbookCount').textContent = enabled ? `${fmt(profile?.guestbook?.commentCount ?? comments?.length ?? 0)} 則留言` : '';
    $('profileGuestbookLocked').hidden = !profile || enabled;
    $('profileGuestbookForm').hidden = !profile || !enabled || !accountId || preview;
    $('profileGuestbookMore').hidden = !enabled || !commentHasMore;
    const list=$('profileGuestbookList');list.replaceChildren();guestbookObserver?.disconnect();
    const stage=$('profileGuestbookStage');stage.hidden=!profile||!enabled;
    stage.previousElementSibling.hidden=!profile||!enabled;
    const theme=profile?.appearanceItems?.guestbookStyle,background=safeImageAsset(theme?.asset);
    stage.style.setProperty('--board-art',background?`url("${background}")`:'none');
    $('profileGuestbookPreview').hidden=!background;
    $('profileGuestbookPreview').onclick=()=>{if(background)showItemPreview({...theme,type:'guestbook_style'});};
    $('profileGuestbookTheme').textContent=theme?.name||'航海留言';
    syncGuestbookMotion();renderStationery();
    if(!profile||!enabled)return;
    if(!Array.isArray(comments)||!comments.length){list.append(el('p','captain-guestbook-empty',Array.isArray(comments)?'下一段航程，從一句問候開始。':'正在讀取好友留言…'));return;}
    const laneCount=()=>Math.min(3,comments.length,Math.max(1,Math.floor(((stage.clientWidth||1200)*9/16-32)/178)));
    const rows=guestbookReading?1:laneCount();const lanes=[];
    for(let i=0;i<rows;i++){
      const lane=el('div','captain-danmaku-lane'),track=el('div','captain-danmaku-track'),sequence=el('div','captain-danmaku-sequence');
      for(let n=i;n<comments.length;n+=rows)sequence.append(makeComment(comments[n]));
      const duplicate=sequence.cloneNode(true);duplicate.classList.add('is-duplicate');duplicate.setAttribute('aria-hidden','true');
      // Visual copies open the same persisted comment, but have no extra tab stops.
      for(const card of duplicate.children){card.tabIndex=-1;card.removeAttribute('role');card.removeAttribute('aria-label');const entry=comments.find(c=>String(c.id)===card.dataset.commentId);card.onclick=()=>showComment(entry);}
      track.append(sequence,duplicate);lane.append(track);list.append(lane);lanes.push({track,sequence});
    }
    const measure=()=>{if(!guestbookReading&&stage.clientWidth&&laneCount()!==rows){renderGuestbook();return;}for(let i=0;i<lanes.length;i++){const {track,sequence}=lanes[i];const width=Math.max(stage.clientWidth,sequence.scrollWidth);track.style.setProperty('--lap',width+'px');track.style.setProperty('--duration',(width/(i===1?31:37))+'s');track.style.setProperty('--offset',(-i*2)+'s');}};
    guestbookObserver=new ResizeObserver(measure);guestbookObserver.observe(stage);measure();
  }

  function renderProfile() { renderHero(); renderMusic(); window.LauncherRoom?.setProfile(profile, { accountId, preview }); renderGames(); renderCollectionTabs(); renderCollection(); renderGuestbook(); }
  function renderCardAvatarOptions() {
    const select = $('profileCardAvatar'); select.replaceChildren();
    const following = el('option', '', `沿用目前頭像 #${number(profile?.avatar) || 8}`); following.value = '0'; select.append(following);
    const ownedAvatars = new Set([
      ...validIds(profile?.collection?.card?.avatars, MAX_AVATAR_ID),
      ...validIds(shop?.owned?.avatars, MAX_AVATAR_ID)
    ]);
    for (let id = 1; id <= MAX_AVATAR_ID; id++) {
      if (id > 30 && !ownedAvatars.has(id)) continue;
      const item = shop?.catalog?.find(entry => entry?.type === 'avatar' && Number(entry.key) === id);
      const option = el('option', '', `${item?.name || `頭像 #${id}`}${id <= 30 ? ' · 免費' : ''}`);
      option.value = String(id); select.append(option);
    }
    const selected = Number(profile?.card?.avatarId);
    select.value = Number.isInteger(selected) && selected >= 1 && selected <= MAX_AVATAR_ID && (selected <= 30 || ownedAvatars.has(selected)) ? String(selected) : '0';
  }
  function renderCardDecorControls() {
    const root = $('profileCardDecorControls'); root.replaceChildren();
    const items = profile?.appearanceItems?.decorations || {};
    const equipped = SLOTS.filter(([slot]) => items[slot]?.id && items[slot].id === profile?.appearance?.decorations?.[slot]);
    root.hidden = !equipped.length;
    if (!equipped.length) return;
    root.append(el('strong', '', '名片貼紙位置'));
    const group = el('div', 'captain-decor-controls');
    for (const [slot, label] of equipped) {
      const current = slotPlacement(profile?.appearance?.decorationPlacement, slot);
      const card = el('div', 'captain-decor-slot'); card.dataset.slot = slot;
      card.append(el('strong', '', `${label} · ${items[slot].name || '貼紙'}`));
      for (const [field, title, min, max, step] of [['x', '左右', 5, 95, 1], ['y', '上下', 5, 95, 1], ['scale', '大小', .5, 1.5, .05]]) {
        const row = el('label');
        const input = el('input'); input.type = 'range'; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(current[field]); input.dataset.field = field; input.disabled = cardBusy || decorBusy;
        const value = el('output', '', field === 'scale' ? `${Math.round(current[field] * 100)}%` : `${Math.round(current[field])}%`);
        input.oninput = () => {
          value.textContent = field === 'scale' ? `${Math.round(Number(input.value) * 100)}%` : `${Math.round(Number(input.value))}%`;
          const sticker = $('profileHeroStickers').querySelector(`[data-slot="${slot}"]`);
          if (sticker) {
            if (field === 'x') sticker.style.left = `${input.value}%`;
            if (field === 'y') sticker.style.top = `${input.value}%`;
            if (field === 'scale') sticker.style.setProperty('--scale', input.value);
          }
        };
        row.append(el('span', '', title), input, value); card.append(row);
      }
      const save = el('button', '', '儲存貼紙位置'); save.type = 'button'; save.disabled = cardBusy || decorBusy;
      save.onclick = () => saveCardDecorPlacement(slot, card);
      card.append(save); group.append(card);
    }
    root.append(group);
  }
  async function saveCardDecorPlacement(slot, card) {
    if (cardBusy || decorBusy || !profile?.isSelf || !accountId || preview || viewUserId || $('profileCardEditor').hidden) return;
    const fields = Object.fromEntries([...card.querySelectorAll('input[data-field]')].map(input => [input.dataset.field, Number(input.value)]));
    const placement = { x: clamp(fields.x, 5, 95, 50), y: clamp(fields.y, 5, 95, 50), scale: clamp(fields.scale, .5, 1.5, 1) };
    const ownerId = accountId, userId = number(profile.userId), mutation = cardMutation;
    const current = () => mutation === cardMutation && accountId === ownerId && number(profile?.userId) === userId && profile?.isSelf === true && !viewUserId;
    profileRequest++;
    decorBusy = true; $('profileCardSave').disabled = true; $('profileCardCancel').disabled = true; renderCardDecorControls(); status('profileCardStatus', '正在儲存貼紙位置…');
    try {
      const result = await api.saveLauncherDecorationPlacement(slot, placement);
      if (!current()) return;
      if (!result?.ok || !result.profile) { renderHero(); status('profileCardStatus', errorText(result?.error), true); return; }
      profile = result.profile; if (result.shop) shop = result.shop;
      renderProfile(); status('profileCardStatus', '貼紙位置已儲存。');
    } catch { if (current()) { renderHero(); status('profileCardStatus', errorText('offline'), true); } }
    finally { if (current()) { decorBusy = false; $('profileCardSave').disabled = false; $('profileCardCancel').disabled = false; renderCardDecorControls(); } }
  }
  function closeCardEditor() {
    cardMutation++;
    cardBusy = false;
    decorBusy = false;
    $('profileCardEditor').hidden = true;
    $('profileCardSave').disabled = false;
    $('profileCardCancel').disabled = false;
    status('profileCardStatus', '');
    renderHero();
  }
  function openCardEditor() {
    if (!profile?.isSelf || !accountId || preview) return;
    renderCardAvatarOptions();
    $('profileCardName').value = cardDisplayName(profile);
    $('profileCardTagline').value = cardTagline(profile);
    renderCardDecorControls();
    status('profileCardStatus', '');
    $('profileCardEditor').hidden = false;
    $('profileCardName').focus();
  }
  async function saveCard(event) {
    event.preventDefault();
    if (cardBusy || decorBusy || !profile?.isSelf || !accountId || preview || viewUserId) return;
    const displayName = $('profileCardName').value.trim();
    const tagline = $('profileCardTagline').value.trim();
    const avatarId = Number($('profileCardAvatar').value);
    if (!displayName || displayName.length > 32 || tagline.length > 120 || !Number.isInteger(avatarId) || avatarId < 0 || avatarId > MAX_AVATAR_ID) {
      status('profileCardStatus', '請填入 1–32 字名稱、最多 120 字簡介，並選擇頭像。', true); return;
    }
    const ownerId = accountId;
    const userId = number(profile.userId);
    const viewId = viewUserId;
    const mutation = ++cardMutation;
    profileRequest++;
    cardBusy = true;
    $('profileCardSave').disabled = true;
    $('profileCardCancel').disabled = true;
    renderCardDecorControls();
    status('profileCardStatus', '正在儲存名片…');
    const current = () => mutation === cardMutation && accountId === ownerId && viewUserId === viewId && number(profile?.userId) === userId && profile?.isSelf === true;
    try {
      const result = await (avatarId > 62 ? profileCommand('card.set', {card:{displayName,tagline,avatarId}}) : api.saveLauncherCard({ displayName, tagline, avatarId }));
      if (!current()) return;
      if (!result?.ok || !result.profile) { status('profileCardStatus', errorText(result?.error), true); return; }
      profile = result.profile;
      if (result.shop) shop = result.shop;
      $('profileCardEditor').hidden = true;
      renderProfile();
      status('profileStatus', '名片已儲存。');
    } catch { if (current()) status('profileCardStatus', errorText('offline'), true); }
    finally {
      if (mutation === cardMutation) { cardBusy = false; $('profileCardSave').disabled = false; $('profileCardCancel').disabled = false; if (!$('profileCardEditor').hidden) renderCardDecorControls(); }
    }
  }
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
      loadComments(); loadStationery();
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
  async function postComment(event) {
    event.preventDefault();
    const body = $('profileGuestbookInput').value.trim();
    if (commentBusy || !profile || !body || body.length > 240) return;
    const owner=accountId,target=viewUserId,mutation=++commentMutation;
    commentBusy = true; $('profileGuestbookPost').disabled = true; $('profileGuestbookInput').disabled=true; $('profileCommentStyle').disabled=true; status('profileGuestbookStatus', '正在發表留言…');
    try {
      if(!postRequestId)postRequestId=crypto.randomUUID();
      const result = await profileCommand('comment.post', {userId:viewUserId,body,styleId:selectedStationery},postRequestId);
      if(owner!==accountId||target!==viewUserId||mutation!==commentMutation)return;
      if (!result?.ok) { status('profileGuestbookStatus', errorText(result?.error), true); return; }
      postRequestId='';
      $('profileGuestbookInput').value = ''; $('profileGuestbookLength').textContent = '0 / 240';
      await loadProfile();
      if(owner===accountId&&target===viewUserId&&mutation===commentMutation)status('profileGuestbookStatus', '留言已發表。');
    } catch { if(owner===accountId&&target===viewUserId&&mutation===commentMutation)status('profileGuestbookStatus', errorText('offline'), true); }
    finally { if(mutation===commentMutation){commentBusy = false; $('profileGuestbookPost').disabled = false; $('profileGuestbookInput').disabled=false; $('profileCommentStyle').disabled=false;} }
  }
  async function deleteComment() {
    if (!pendingCommentDelete || commentBusy) return;
    const owner=accountId,target=viewUserId,mutation=++commentMutation,messageId=pendingCommentDelete;
    commentBusy = true; $('profileCommentDeleteConfirm').disabled = true; $('profileCommentDeleteHint').textContent = '正在刪除留言…';
    try {
      const result = await api.deleteLauncherComment(messageId);
      if(owner!==accountId||target!==viewUserId||mutation!==commentMutation)return;
      if (!result?.ok) { $('profileCommentDeleteHint').textContent = errorText(result?.error); return; }
      $('profileCommentDeleteDialog').close(); $('profileCommentReadDialog').close(); pendingCommentDelete = null;
      await loadProfile(); if(owner===accountId&&target===viewUserId&&mutation===commentMutation)status('profileGuestbookStatus', '留言已刪除。');
    } catch { if(owner===accountId&&target===viewUserId&&mutation===commentMutation)$('profileCommentDeleteHint').textContent = errorText('offline'); }
    finally { if(mutation===commentMutation){commentBusy = false; $('profileCommentDeleteConfirm').disabled = false;} }
  }
  async function toggleBgm() {
    const audio = $('profileBgmAudio');
    if (!bgmSource) return;
    if (bgmPlayPending || !audio.paused) { bgmPausedByUser = true; stopBgm(false); return; }
    bgmPausedByUser = false; bgmAutoplayBlocked = false; await playBgm();
  }
  function openBgmPicker() {
    if (!profile?.isSelf || !accountId || preview || bgmPickerBusy) return;
    const picker = $('profileBgmPicker');
    if (!picker.hidden) { picker.hidden = true; return; }
    const list = $('profileBgmPickerList'); list.replaceChildren();
    const selected = new Set(Array.isArray(profile.appearance?.bgmIds) ? profile.appearance.bgmIds : [profile.appearance?.bgmId]);
    const ownedSongs = Array.isArray(profile.collection?.launcher?.bgms) ? profile.collection.launcher.bgms : [];
    for (const song of ownedSongs) {
      if (!song || !safeAudioAsset(song.asset)) continue;
      const label = el('label'); const check = el('input');
      check.type = 'checkbox'; check.value = song.id; check.checked = selected.has(song.id);
      label.append(check, el('span', '', String(song.name || song.id).slice(0, 60)));
      list.append(label);
    }
    status('profileBgmPickerStatus', list.childElementCount ? '未勾選任何歌曲會關閉個人頁音樂。' : '尚未購買可播放的音樂。');
    picker.hidden = false;
  }
  async function saveBgmPicker() {
    if (bgmPickerBusy || !profile?.isSelf || !accountId || preview || $('profileBgmPicker').hidden) return;
    const checked = [...$('profileBgmPickerList').querySelectorAll('input:checked')].map(input => input.value);
    const prior = Array.isArray(profile.appearance?.bgmIds) ? profile.appearance.bgmIds : [profile.appearance?.bgmId];
    const bgmIds = [...new Set([...prior.filter(id => checked.includes(id)), ...checked])];
    const owner = accountId, request = ++bgmSaveRequest;
    profileRequest++;
    bgmPickerBusy = true; $('profileBgmSave').disabled = true; $('profileBgmCancel').disabled = true;
    status('profileBgmPickerStatus', '正在儲存播放清單…');
    try {
      const result = await api.saveLauncherBgmPlaylist(bgmIds);
      if (request !== bgmSaveRequest || owner !== accountId || !profile?.isSelf || viewUserId) return;
      if (!result?.ok || !result.profile) { status('profileBgmPickerStatus', errorText(result?.error), true); return; }
      profile = result.profile;
      if (result.shop) shop = result.shop;
      $('profileBgmPicker').hidden = true;
      renderProfile();
      status('profileStatus', bgmIds.length ? `已儲存 ${bgmIds.length} 首個人頁音樂。` : '已停用個人頁音樂。');
    } catch { if (request === bgmSaveRequest && owner === accountId) status('profileBgmPickerStatus', errorText('offline'), true); }
    finally {
      if (request === bgmSaveRequest) { bgmPickerBusy = false; $('profileBgmSave').disabled = false; $('profileBgmCancel').disabled = false; }
    }
  }
  function safeCatalog() {
    return (Array.isArray(shop?.catalog) ? shop.catalog : []).filter(item =>
      item && TYPE_LABEL[item.type] && typeof item.id === 'string' && /^[a-z0-9-]{3,64}$/.test(item.id) &&
      Number.isSafeInteger(Number(item.price)) && Number(item.price) >= 0 &&
      (['avatar', 'wall', 'flag'].includes(item.type) ? !!imageFor(item.type, item.key) :
        ['background', 'frame', 'guestbook_style', 'comment_style'].includes(item.type) ? !!safeImageAsset(item.asset) :
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
    if (['background', 'frame', 'layout', 'decoration', 'bgm', 'guestbook_style', 'comment_style'].includes(item.type)) {
      const field = { background: 'backgrounds', frame: 'frames', layout: 'layouts', decoration: 'decorations', bgm: 'bgms', guestbook_style: 'guestbookStyles', comment_style: 'commentStyles' }[item.type];
      return Array.isArray(shop?.owned?.[field]) && shop.owned[field].includes(item.id);
    }
    const field = item.type === 'avatar' ? 'avatars' : item.type === 'wall' ? 'walls' : 'flags';
    return validIds(shop?.owned?.[field], item.type === 'avatar' ? MAX_AVATAR_ID : item.type === 'wall' ? 8 : 15).includes(Number(item.key));
  }
  function equipped(item) {
    if (item.type === 'guestbook') return owned(item);
    if (ROOM_TYPES.includes(item.type)) return false;
    if (item.type === 'guestbook_style') return shop?.equipped?.guestbookStyleId === item.id;
    if (item.type === 'comment_style') return shop?.equipped?.commentStyleId === item.id;
    if (item.type === 'background') return shop?.equipped?.backgroundId === item.id;
    if (item.type === 'frame') return shop?.equipped?.frameId === item.id;
    if (item.type === 'layout') return shop?.equipped?.layoutId === item.id;
    if (item.type === 'bgm') {
      const selected = shop?.equipped?.bgmIds;
      return Array.isArray(selected) ? selected.includes(item.id) : shop?.equipped?.bgmId === item.id;
    }
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
      shopTab === 'guestbook_style' ? [['guestbook-style-default', '使用原始留言板']] :
      shopTab === 'comment_style' ? [['comment-style-default', '使用素紙留言']] :
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
      button.onclick = () => { if (id !== shopTab) stopShopPreview(); shopTab = id; renderShopTabs(); renderShop(); };
      tabs.append(button);
    }
  }
  function updateShopPreviewButtons() {
    for (const button of document.querySelectorAll('#shopGrid .shop-preview-button, #shopItemPreviewActions .shop-preview-button')) {
      const active = button.dataset.previewId === shopPreviewId;
      button.textContent = active ? shopPreviewPending ? '載入中…按此取消' : '停止試聽' : '♫ 試聽 30 秒';
      button.setAttribute('aria-pressed', String(active));
    }
  }
  function stopShopPreview() {
    shopPreviewRequest++;
    shopPreviewId = '';
    shopPreviewPending = false;
    shopPreviewAudio.pause();
    shopPreviewAudio.removeAttribute('src');
    shopPreviewAudio.load();
    updateShopPreviewButtons();
  }
  async function toggleShopPreview(item) {
    const source = safeAudioAsset(item?.asset);
    if (!source || $('shopPanel').hidden || document.hidden) return;
    if (shopPreviewId === item.id) { stopShopPreview(); return; }
    stopShopPreview();
    const request = ++shopPreviewRequest;
    shopPreviewId = item.id;
    shopPreviewPending = true;
    shopPreviewAudio.src = source;
    updateShopPreviewButtons();
    try {
      await shopPreviewAudio.play();
      if (request !== shopPreviewRequest) return;
      shopPreviewPending = false;
      updateShopPreviewButtons();
    } catch {
      if (request !== shopPreviewRequest) return;
      stopShopPreview();
      status('shopStatus', '這首音樂目前無法試聽，請稍後再試。', true);
    }
  }
  shopPreviewAudio.ontimeupdate = () => { if (shopPreviewId && shopPreviewAudio.currentTime >= 30) stopShopPreview(); };
  shopPreviewAudio.onended = stopShopPreview;
  shopPreviewAudio.onerror = () => {
    if (!shopPreviewId) return;
    stopShopPreview();
    status('shopStatus', '這首音樂目前無法試聽，請稍後再試。', true);
  };
  let previewedItem = null, previewPanel = '';
  function closeItemPreview() {
    if (previewedItem?.type === 'bgm') stopShopPreview();
    $('shopItemPreviewDialog').close();
  }
  function showItemPreview(item) {
    if (!item) return;
    stopShopPreview();
    previewedItem = item;
    previewPanel = profileVisible ? 'profile' : 'shop';
    const dialog=$('shopItemPreviewDialog'), stage=$('shopItemPreviewStage'), actions=$('shopItemPreviewActions');
    dialog.dataset.type=item.type; dialog.dataset.itemId=item.id||'';
    $('shopItemPreviewName').textContent=String(item.name||'商品預覽').slice(0,80);
    $('shopItemPreviewMeta').textContent=TYPE_LABEL[item.type]||'商品預覽';
    stage.replaceChildren(); actions.replaceChildren();
    const source=itemImage(item);
    if(source){
      const image=el('img','shop-large-preview-image'); image.alt=String(item.name||'商品圖片').slice(0,80);
      image.onload=()=>{image.style.maxWidth=image.naturalWidth+'px';image.style.maxHeight=image.naturalHeight+'px';};
      image.onerror=()=>{image.hidden=true;stage.append(el('p','shop-preview-message','圖片暫時無法載入，請關閉後重試。'));};
      if(item.type==='room_character'&&item.key==='luffy'&&window.OnePieceRoomMotion?.LUFFY_ART_ENABLED===true){
        const failure=image.onerror;image.onerror=()=>{image.onerror=failure;image.src='opui://launcher/images/launcher_room/portrait_v3/luffy.webp';};
      }
      image.src=source;stage.append(image);
    }else if(item.type==='layout'){
      const sample=el('div','captain-hero shop-layout-sample'); sample.dataset.layout=item.id;
      const body=el('div','captain-hero-body'),avatar=el('span','captain-hero-avatar'),image=el('img');image.src=imageFor('avatar',8);image.alt='排版示意頭像';avatar.append(image);
      const copy=el('div','captain-hero-copy');copy.append(el('p','eyebrow','CAPTAIN'),el('h3','','你的航海名片'),el('p','','下一段冒險，從這裡開始。'),el('small','','排版示意'));
      body.append(avatar,copy);sample.append(el('div','captain-hero-art'),body);stage.append(sample);
    }else if(item.type==='bgm'){
      const music=el('div','shop-preview-feature');music.append(el('span','shop-symbol','♫'),el('strong','',String(item.name||'個人頁音樂').slice(0,80)));stage.append(music);
      const play=el('button','shop-preview-button','♫ 試聽 30 秒');play.type='button';play.dataset.previewId=item.id;play.onclick=()=>toggleShopPreview(item);actions.append(play);
    }else{
      const sample=el('div','shop-preview-feature shop-unlock-sample'),paper=el('div','captain-guestbook-entry');
      paper.append(el('header','','好友航海者'),el('p','','來坐一下，留下今天的航海回憶！'));
      sample.append(paper,el('strong','','開放好友留言'),el('p','','解鎖留言功能；主題板面與留言紙可另外選購。'));stage.append(sample);
    }
    updateShopPreviewButtons();
    if(!dialog.open)dialog.showModal();
    syncGuestbookMotion();
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
      const visual = el('button', 'shop-item-image');visual.type='button';visual.setAttribute('aria-label',`預覽「${String(item.name||item.id).slice(0,80)}」`);visual.title='點開大圖預覽';visual.onclick=()=>showItemPreview(item);
      const source = itemImage(item);
      if (source) { const image = el('img'); portraitFallback(image, item); image.src = source; image.alt = ''; image.loading='lazy'; image.decoding='async'; if (item.type === 'avatar') avatarFallback(image); visual.append(image); }
      else if (item.type === 'layout') { const miniature = el('div', 'shop-layout-preview'); miniature.dataset.layout = item.id; miniature.append(el('i'), el('span', '', 'CAPTAIN')); visual.append(miniature); }
      else visual.append(el('span', 'shop-symbol', item.type === 'bgm' ? '♫' : '✒'));
      visual.append(el('span','shop-image-preview-label','放大預覽'));
      article.onclick=event=>{if(!event.target.closest('button'))showItemPreview(item);};
      const body = el('div', 'shop-item-body');
      body.append(el('small', '', `${RARITY[item.rarity] || '普通'} · ${TYPE_LABEL[item.type]}${item.slot ? ` · ${SLOTS.find(([slot]) => slot === item.slot)?.[1] || ''}` : ''}`), el('strong', '', String(item.name || item.id).slice(0, 80)));
      if (item.type === 'bgm') {
        const previewButton = el('button', 'shop-preview-button', '♫ 試聽 30 秒');
        previewButton.type = 'button';
        previewButton.dataset.previewId = item.id;
        previewButton.setAttribute('aria-label', `試聽「${String(item.name || item.id).slice(0, 80)}」30 秒`);
        previewButton.onclick = () => toggleShopPreview(item);
        body.append(previewButton);
      }
      const bottom = el('div', 'shop-item-bottom');
      const isOwned = owned(item), isEquipped = equipped(item);
      bottom.append(el('span', '', isOwned ? item.type === 'guestbook' ? '已解鎖' : '已收藏' : `${fmt(item.price)} 金幣`));
      const button = el('button', '', shop?.preview ? '登入後購買' : isEquipped ? item.type === 'guestbook' ? '已開放' : item.type === 'bgm' ? '清單中' : '使用中' : isOwned ? ROOM_TYPES.includes(item.type) ? '佈置' : item.type === 'bgm' ? '單曲套用' : '套用' : wallet < number(item.price) ? '金幣不足' : '購買');
      button.type = 'button'; button.disabled = shopBusy || shop?.preview || isEquipped || (!isOwned && wallet < number(item.price));
      button.onclick = () => {
        if (isOwned && ROOM_TYPES.includes(item.type)) { roomEditorRequested = true; window.LauncherProfileShop?.openProfile(0); }
        else if (isOwned) equip(item);
        else confirmPurchase(item);
      };
      bottom.append(button); body.append(bottom); article.append(visual, body); grid.append(article);
    }
    updateShopPreviewButtons();
  }
  async function loadShop() {
    const requestId = ++shopRequest;
    stopShopPreview();
    if (!accountId && !preview) {
      shop = null; renderShopTabs(); renderShop();
      status('shopStatus', '請先登入帳號。'); return;
    }
    status('shopStatus', preview ? '正在讀取商品目錄…' : '正在核對雲端商品與餘額…');
    try {
      const result = await api.getLauncherShop(preview ? { preview: true } : undefined);
      if (requestId !== shopRequest) return;
      if (!result?.ok || !result.shop) { shop = null; renderShop(); status('shopStatus', errorText(result?.error), true); return; }
      shop = result.shop;
      const announcedItem = announcementShopItem ? safeCatalog().find(item => item.id === announcementShopItem) : null;
      if (announcedItem && SHOP_TABS.some(([id]) => id === announcedItem.type)) shopTab = announcedItem.type;
      renderShopTabs(); renderShop(); status('shopStatus', preview ? '設計預覽可查看商品；登入後才能使用金幣購買。' : '');
      if (announcementShopItem) {
        const article = [...$('shopGrid').querySelectorAll('[data-item-id]')].find(node => node.dataset.itemId === announcementShopItem);
        if (article) { article.tabIndex = -1; article.classList.add('is-announcement-target'); article.scrollIntoView({ block: 'center' }); article.focus({ preventScroll: true }); status('shopStatus', `公告商品：${String(announcedItem.name || announcedItem.id).slice(0, 80)}`); }
        else status('shopStatus', '這件公告商品目前尚未開放，或需要更新啟動器後查看。');
        announcementShopItem = '';
      }
    } catch { if (requestId === shopRequest) { shop = null; renderShop(); status('shopStatus', errorText('offline'), true); } }
  }
  function confirmPurchase(item) {
    if (!shop || shop.preview || shopBusy || owned(item)) return;
    pendingPurchase = item;
    $('shopConfirmName').textContent = String(item.name || item.id).slice(0, 80);
    $('shopConfirmCopy').textContent = `確定花費 ${fmt(item.price)} 金幣收藏這件商品？`;
    const source = itemImage(item);
    $('shopConfirmDialog').dataset.type = item.type;
    $('shopConfirmImage').hidden = !source;
    if (source) { portraitFallback($('shopConfirmImage'), item); $('shopConfirmImage').src = source; }
    else $('shopConfirmImage').removeAttribute('src');
    $('shopConfirmPrice').textContent = `${fmt(item.price)} 金幣`;
    $('shopConfirmHint').textContent = '購買後會儲存在雲端帳號。';
    $('shopConfirmBuy').disabled = false;
    $('shopConfirmDialog').showModal();
  }
  async function buy() {
    const item = pendingPurchase;
    if (!item || shopBusy) return;
    const owner = accountId;
    const mutation = ++shopMutation;
    shopBusy = true; $('shopConfirmBuy').disabled = true; $('shopConfirmHint').textContent = '正在確認購買…';
    try {
      const result = await (extendedItem(item.id) ? profileCommand('shop.buy', {itemId:item.id}) : api.buyLauncherItem(item.id));
      if (owner !== accountId || mutation !== shopMutation || !accountId || preview) return;
      if (!result?.ok || !result.shop) { $('shopConfirmHint').textContent = result?.error === 'timeout' ? '結果尚未確認。請關閉後重新整理商店，避免重複購買。' : errorText(result?.error); return; }
      shopRequest++;
      shop = result.shop; void loadStationery(); publishAccountAvatar(result.profile); $('shopConfirmDialog').close(); renderShop();
      const purchasedName = String(item.name || item.id).slice(0, 80);
      status('shopStatus', result.roomPlacementDeferred
        ? `已收藏「${purchasedName}」。房間最多同時放 10 位夥伴；請到佈置模式替換角色。`
        : `已收藏「${purchasedName}」。`);
      if (profile?.isSelf && result.profile?.userId === owner) {
        profileRequest++; profile = result.profile; renderProfile();
      }
      window.LauncherRoom?.onPurchase?.(result, item.id);
    } catch { if (owner === accountId && mutation === shopMutation) $('shopConfirmHint').textContent = errorText('offline'); }
    finally {
      if (owner === accountId && mutation === shopMutation) {
        shopBusy = false; $('shopConfirmBuy').disabled = false; renderShop();
      }
    }
  }
  async function equip(item) {
    if (shopBusy || !owned(item) || item.type === 'guestbook' || ROOM_TYPES.includes(item.type)) return;
    return equipById(item.id, String(item.name || item.id).slice(0, 80));
  }
  async function equipById(itemId, label) {
    if (shopBusy || !shop || shop.preview) return;
    const owner=accountId,mutation=++shopMutation;
    shopBusy = true; renderShop(); status('shopStatus', '正在套用裝扮…');
    try {
      const result = await (extendedItem(itemId) ? profileCommand('shop.equip', {itemId}) : api.equipLauncherItem(itemId));
      if(owner!==accountId||mutation!==shopMutation||!accountId||preview)return;
      if (!result?.ok || !result.shop) { status('shopStatus', errorText(result?.error), true); return; }
      shop = result.shop; void loadStationery(); publishAccountAvatar(result.profile); status('shopStatus', `已套用「${label}」。`);
      if (profile?.isSelf) loadProfile();
    } catch { if(owner===accountId&&mutation===shopMutation)status('shopStatus', errorText('offline'), true); }
    finally { if(owner===accountId&&mutation===shopMutation){shopBusy = false; renderShop();} }
  }

  $('profileRefresh').onclick = loadProfile;
  $('profileBackToFriends').onclick = () => window.launcherSwitchPanel?.('social');
  $('profileCardEdit').onclick = openCardEditor;
  $('profileCardCancel').onclick = closeCardEditor;
  $('profileCardEditor').onsubmit = saveCard;
  $('profileCardAvatar').onchange = () => {
    const id = number($('profileCardAvatar').value) || number(profile?.avatar) || 8;
    $('profileHeroAvatar').src = imageFor('avatar', id) || imageFor('avatar', 8);
  };
  $('profileBgmToggle').onclick = toggleBgm;
  $('profileBgmNext').onclick = () => nextBgm(false);
  $('profileBgmChoose').onclick = openBgmPicker;
  $('profileBgmCancel').onclick = () => { if (!bgmPickerBusy) $('profileBgmPicker').hidden = true; };
  $('profileBgmSave').onclick = saveBgmPicker;
  $('profileBgmMute').onclick = () => {
    if (bgmListener.muted || bgmListener.volume === 0) { bgmListener.muted = false; if (bgmListener.volume === 0) bgmListener.volume = .35; }
    else bgmListener.muted = true;
    saveMusicListener();
    if (!bgmPausedByUser && bgmAutoplayBlocked) { bgmAutoplayBlocked = false; playBgm(); }
  };
  $('profileBgmVolume').oninput = () => { bgmListener.volume = clamp(Number($('profileBgmVolume').value) / 100, 0, 1, .35); saveMusicListener(); };
  $('profileBgmAudio').onended = () => { if (bgmPlaylist.length > 1) nextBgm(true); else stopBgm(); };
  $('profileGuestbookForm').onsubmit = postComment;
  $('profileGuestbookInput').oninput = () => { postRequestId=''; $('profileGuestbookLength').textContent = `${$('profileGuestbookInput').value.length} / 240`; };
  $('profileCommentStyle').onchange=()=>{selectedStationery=$('profileCommentStyle').value;postRequestId='';renderStationery();};
  $('profileGuestbookMotion').onclick=()=>{guestbookPaused=!guestbookPaused;syncGuestbookMotion();};
  $('profileGuestbookRead').onclick=()=>{guestbookReading=!guestbookReading;renderGuestbook();};
  $('profileCommentReadClose').onclick=()=>$('profileCommentReadDialog').close();
  $('profileCommentReadDialog').addEventListener('close',syncGuestbookMotion);
  motionPreference.addEventListener('change',e=>{guestbookReading=e.matches;renderGuestbook();});
  $('profileGuestbookMore').onclick = () => loadComments(true);
  $('profileCommentDeleteCancel').onclick = () => $('profileCommentDeleteDialog').close();
  $('profileCommentDeleteConfirm').onclick = deleteComment;
  $('profileCommentDeleteDialog').addEventListener('close', () => { pendingCommentDelete = null; });
  $('shopConfirmClose').onclick = () => $('shopConfirmDialog').close();
  $('shopConfirmCancel').onclick = () => $('shopConfirmDialog').close();
  $('shopConfirmBuy').onclick = buy;
  $('shopConfirmDialog').addEventListener('close', () => { pendingPurchase = null; });
  $('shopConfirmDialog').addEventListener('click', event => { if (event.target === $('shopConfirmDialog')) $('shopConfirmDialog').close(); });
  $('shopItemPreviewClose').onclick=closeItemPreview;
  $('shopItemPreviewDialog').addEventListener('cancel',()=>{if(previewedItem?.type==='bgm')stopShopPreview();});
  $('shopItemPreviewDialog').addEventListener('close',()=>{if($('shopItemPreviewDialog').open)return;if(previewedItem?.type==='bgm')stopShopPreview();previewedItem=null;syncGuestbookMotion();});
  $('shopItemPreviewDialog').addEventListener('click',event=>{const box=$('shopItemPreviewDialog').getBoundingClientRect();if(event.target===$('shopItemPreviewDialog')&&(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom))closeItemPreview();});
  window.LauncherProfileShop = {
    setAccount(snapshot) {
      const id = snapshot?.authenticated && !snapshot.profile?.needsDisplayName ? number(snapshot.profile?.userId) : 0;
      const isPreview = snapshot?.previewMode === true;
      if (id === accountId && isPreview === preview) return;
      closeItemPreview();
      stopShopPreview();
      clearBgm(); profileVisible = false;
      shopMutation++; shopBusy = false;
      cardMutation++; cardBusy = false; decorBusy = false; $('profileCardEditor').hidden = true; $('profileCardSave').disabled = false; $('profileCardCancel').disabled = false;
      accountId = id; preview = isPreview; window.LauncherProfileAvatar=null;
      const avatarVersion=++accountAvatarVersion;
      if(id&&!isPreview)void api.getLauncherProfile(0).then(r=>{if(accountId===id&&accountAvatarVersion===avatarVersion&&r?.ok)publishAccountAvatar(r.profile);}).catch(()=>{}); viewUserId = 0; profile = null; shop = null; roomEditorRequested = false;
      announcementShopItem = '';
      commentMutation++;commentBusy=false;$('profileGuestbookPost').disabled=false;$('profileGuestbookInput').disabled=false;$('profileCommentStyle').disabled=false;
      stationeryRequest++;stationery=[];selectedStationery='comment-style-default';postRequestId='';guestbookObserver?.disconnect();$('profileCommentReadDialog').close();
      profileRequest++; shopRequest++; commentRequest++; comments = null; commentHasMore = false; commentNextBeforeId = 0; pendingPurchase = null; pendingCommentDelete = null;
      if ($('shopConfirmDialog').open) $('shopConfirmDialog').close();
      if ($('profileCommentDeleteDialog').open) $('profileCommentDeleteDialog').close();
      $('profileCommentDeleteConfirm').disabled=false;
      renderProfile(); renderShopTabs(); renderShop();
    },
    openProfile(userId = 0) {
      closeItemPreview();
      const id = number(userId);
      clearBgm();
      cardMutation++; cardBusy = false; decorBusy = false; $('profileCardEditor').hidden = true; $('profileCardSave').disabled = false; $('profileCardCancel').disabled = false;
      commentMutation++;commentBusy=false;$('profileGuestbookPost').disabled=false;$('profileGuestbookInput').disabled=false;$('profileCommentStyle').disabled=false;
      $('profileCommentDeleteDialog').close();pendingCommentDelete=null;$('profileCommentDeleteConfirm').disabled=false;
      $('profileCommentReadDialog').close();postRequestId='';guestbookObserver?.disconnect();
      viewUserId = id && id !== accountId ? id : 0;
      profile = null; comments = null; profileRequest++; commentRequest++; commentHasMore = false; commentNextBeforeId = 0;
      if (window.launcherSwitchPanel) window.launcherSwitchPanel('profile');
      else loadProfile();
    },
    onVisible(panel) {
      if (previewedItem && panel !== previewPanel) closeItemPreview();
      if (panel !== 'shop') stopShopPreview();
      if (panel !== 'profile') { profileVisible = false; stopBgm(); }
      else if (!profileVisible) { profileVisible = true; bgmPausedByUser = false; bgmAutoplayBlocked = false; }
      syncGuestbookMotion();
      window.LauncherRoom?.onVisible(panel);
      if (panel === 'profile' && !profile) loadProfile();
      else if (panel === 'profile') playBgm(true);
      if (panel === 'shop') loadShop();
    },
    openShopCategory(category) {
      if (!SHOP_TABS.some(([id]) => id === category)) return;
      closeItemPreview();
      if (category !== shopTab) stopShopPreview();
      shopTab = category;
      window.launcherSwitchPanel?.('shop');
      renderShopTabs(); renderShop();
    },
    openShop(itemId) {
      if (typeof itemId !== 'string' || !/^[a-z0-9-]{1,100}$/.test(itemId)) return;
      stopShopPreview();
      announcementShopItem = itemId;
      if (itemId.startsWith('room-character-')) shopTab = 'room_character';
      window.launcherSwitchPanel?.('shop');
    },
    onRoomSaved(nextProfile, nextShop) {
      if (!nextProfile?.isSelf || !profile?.isSelf || nextProfile.userId !== profile.userId) return;
      profile = nextProfile;
      if (nextShop) shop = nextShop;
      renderProfile();
    },
    onCompanionWalletChanged(wallet) {
      if (!accountId || !wallet || !Number.isFinite(Number(wallet.coins))) return;
      shopRequest++;
      if (shop && !shop.preview) {
        shop = { ...shop, wallet: { ...shop.wallet, ...wallet } };
        renderShop();
      }
    }
  };
  document.addEventListener('visibilitychange', () => { syncGuestbookMotion(); if (document.hidden) { stopBgm(); stopShopPreview(); } else playBgm(true); });
  renderProfile(); renderShopTabs(); renderShop();
})();
