'use strict';

const api = window.onePieceDesktop;

const GAMES = [
  {
    id: 'card',
    title: '偉大航道爭霸戰',
    english: 'GRAND LINE RIVALRY',
    tagline: '構築牌組，向偉大航道發起挑戰',
    description: '以角色卡、事件卡與戰術連鎖組成自己的海賊團，和其他航海者展開即時對決。',
    tags: ['卡牌對戰', '線上多人', '牌組構築'],
    features: ['收集並組建專屬牌組', '即時玩家對戰與好友邀請', '同一帳號保留雲端進度'],
    cover: 'opui://launcher/images/game_launcher/launcher_card_cover_perspective_v2.png',
    preview: 'opui://launcher/videos/game_launcher/card_sanji_duel_preview_v2.mp4',
    accent: '255, 180, 64'
  },
  {
    id: 'board',
    title: '新世界航海錄',
    english: 'NEW WORLD VOYAGE',
    tagline: '擲骰啟航，寫下自己的新世界航海史',
    description: '沿地圖探索島嶼、招募夥伴與挑戰強敵，從推進城一路航向四皇據點與最終之島。',
    tags: ['航海桌遊', '1–4 人', '共鬥與培養'],
    features: ['分支航線、事件與角色捕捉', '單人 CPU 與多人完整同步', '二周目培養、切磋與十三 Boss'],
    cover: 'opui://launcher/images/game_launcher/launcher_board_cover_logo_perspective_v5.png',
    preview: 'opui://launcher/videos/game_launcher/board_battle_preview_v2.mp4',
    accent: '72, 223, 205'
  },
  {
    id: 'chess',
    title: '霸海戰棋',
    english: 'PIRATE WAR CHESS',
    tagline: '讓角色招式改寫每一步棋',
    description: '以海賊角色、陣營與專屬攻擊動畫打造的戰棋對決，目前仍在製作與校準中。',
    tags: ['戰術棋盤', '角色招式', '製作中'],
    features: ['海賊角色化棋子', '專屬移動與攻擊演出', '正式版本完成後由啟動器提供下載'],
    cover: 'opui://launcher/images/game_launcher/launcher_chess_cover_logo_perspective_v5.png',
    preview: '',
    accent: '173, 132, 255'
  }
];

const byId = Object.fromEntries(GAMES.map((game) => [game.id, game]));
let selectedGameId = 'board';
let snapshot = {
  authenticated: false,
  profile: null,
  cacheRoot: '',
  freeBytes: null,
  games: Object.fromEntries(GAMES.map((game) => [game.id, { status: game.id === 'chess' ? 'unavailable' : 'checking' }]))
};
let authMode = 'login';
let toastTimer = 0;
let activePreviewUrl = '';

const $ = (selector) => document.querySelector(selector);
const bootScreen = $('#bootScreen');
const authScreen = $('#authScreen');
const launcherApp = $('#launcherApp');
const authForm = $('#authForm');
const loginTab = $('#loginTab');
const registerTab = $('#registerTab');
const authTitle = $('#authTitle');
const authSubmit = $('#authSubmit');
const authMessage = $('#authMessage');
const usernameInput = $('#usernameInput');
const passwordInput = $('#passwordInput');
const previewSkip = $('#previewSkip');
const gameRail = $('#gameRail');
const featureVideo = $('#featureVideo');
const featureArt = $('#featureArt');
const featureCover = $('#featureCover');
const featureStatus = $('#featureStatus');
const featureVersion = $('#featureVersion');
const featureTitle = $('#featureTitle');
const featureTagline = $('#featureTagline');
const featureTags = $('#featureTags');
const featureDescription = $('#featureDescription');
const primaryAction = $('#primaryAction');
const existingLaunchAction = $('#existingLaunchAction');
const cancelAction = $('#cancelAction');
const detailsButton = $('#detailsButton');
const installProgress = $('#installProgress');
const progressLabel = $('#progressLabel');
const progressPercent = $('#progressPercent');
const progressBar = $('#progressBar');
const progressDetail = $('#progressDetail');
const libraryPanel = $('#libraryPanel');
const downloadsPanel = $('#downloadsPanel');
const downloadList = $('#downloadList');
const downloadDot = $('#downloadDot');
const storageSummary = $('#storageSummary');
const cachePath = $('#cachePath');
const accountMenu = $('#accountMenu');
const detailDialog = $('#detailDialog');
const locationDialog = $('#locationDialog');
const toast = $('#toast');

function setStage(stage) {
  document.body.dataset.stage = stage;
  for (const [name, element] of [['boot', bootScreen], ['auth', authScreen], ['app', launcherApp]]) {
    const active = name === stage;
    element.hidden = !active;
    requestAnimationFrame(() => element.classList.toggle('is-active', active));
  }
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3400);
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let amount = bytes;
  let unit = -1;
  do { amount /= 1024; unit += 1; } while (amount >= 1024 && unit < units.length - 1);
  return `${amount >= 10 || unit === 0 ? amount.toFixed(1) : amount.toFixed(2)} ${units[unit]}`;
}

function statusCopy(gameState = {}) {
  switch (gameState.status) {
    case 'installed': return { label: '可遊玩', tone: 'ready', action: '啟動遊戲' };
    case 'update': return { label: '有新版本', tone: 'update', action: '下載更新' };
    case 'preparing': return { label: '準備中', tone: 'update', action: '正在準備…' };
    case 'downloading': return { label: '下載中', tone: 'ready', action: '正在下載…' };
    case 'verifying': return { label: '驗證檔案', tone: 'update', action: '正在驗證…' };
    case 'paused': return { label: '已暫停', tone: 'update', action: '繼續下載' };
    case 'repair': return { label: '需要修復', tone: 'error', action: '修復遊戲' };
    case 'error': return { label: '下載失敗', tone: 'error', action: '重試下載' };
    case 'unavailable': return { label: '製作中', tone: 'locked', action: '尚未開放' };
    case 'desktop-required': return { label: '桌面版限定', tone: 'locked', action: '需安裝啟動器' };
    case 'checking': return { label: '檢查版本', tone: 'locked', action: '檢查中…' };
    default: return { label: '尚未安裝', tone: 'update', action: '下載安裝' };
  }
}

function renderRail() {
  gameRail.replaceChildren();
  for (const game of GAMES) {
    const state = snapshot.games?.[game.id] || {};
    const copy = statusCopy(state);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `game-rail-item${selectedGameId === game.id ? ' is-selected' : ''}${state.status === 'unavailable' ? ' is-locked' : ''}`;
    button.style.setProperty('--game-accent-rgb', game.accent);
    button.dataset.gameId = game.id;
    button.innerHTML = `<img class="rail-cover" src="${game.cover}" alt=""><span class="rail-copy"><strong>${game.title}</strong><small>${copy.label}</small></span>`;
    button.addEventListener('click', () => selectGame(game.id));
    gameRail.appendChild(button);
  }
}

function selectGame(gameId) {
  if (!byId[gameId]) return;
  selectedGameId = gameId;
  renderRail();
  renderFeature();
}

function setFeatureVideo(game) {
  featureArt.style.backgroundImage = `url("${game.cover}")`;
  if (activePreviewUrl === game.preview) return;
  activePreviewUrl = game.preview;
  featureVideo.pause();
  featureVideo.removeAttribute('src');
  featureVideo.load();
  if (!game.preview) return;
  featureVideo.src = game.preview;
  featureVideo.load();
  featureVideo.play().catch(() => {});
}

function renderProgress(gameState) {
  const active = ['preparing', 'downloading', 'verifying'].includes(gameState.status);
  installProgress.hidden = !active;
  cancelAction.hidden = !active;
  if (!active) return;
  const downloaded = Math.max(0, Number(gameState.downloadedBytes) || 0);
  const total = Math.max(0, Number(gameState.totalBytes) || 0);
  const percent = total > 0 ? Math.min(100, downloaded / total * 100) : 0;
  progressLabel.textContent = gameState.status === 'preparing'
    ? (gameState.currentFile || '正在檢查版本與已安裝檔案…')
    : gameState.status === 'verifying'
      ? '正在驗證遊戲檔案…'
      : (gameState.currentFile || '正在下載遊戲素材…');
  progressPercent.textContent = `${percent.toFixed(percent >= 10 ? 0 : 1)}%`;
  progressBar.style.width = `${percent}%`;
  progressDetail.textContent = total > 0 ? `${formatBytes(downloaded)} / ${formatBytes(total)} · 已完成 ${gameState.completedFiles || 0} / ${gameState.totalFiles || 0} 個檔案` : '正在取得版本資料…';
}

function renderFeature() {
  const game = byId[selectedGameId];
  const state = snapshot.games?.[game.id] || {};
  const copy = statusCopy(state);
  document.documentElement.style.setProperty('--active-accent-rgb', game.accent);
  featureCover.src = game.cover;
  featureCover.alt = `${game.title}封面`;
  featureTitle.textContent = game.title;
  featureTagline.textContent = game.tagline;
  featureDescription.textContent = game.description;
  featureTags.innerHTML = game.tags.map((tag) => `<span>${tag}</span>`).join('');
  featureStatus.textContent = copy.label;
  featureStatus.dataset.tone = copy.tone;
  featureVersion.textContent = game.english;
  primaryAction.textContent = copy.action;
  primaryAction.disabled = ['unavailable', 'desktop-required', 'checking', 'preparing', 'downloading', 'verifying'].includes(state.status);
  existingLaunchAction.hidden = !state.hasInstalled || ['installed', 'preparing', 'downloading', 'verifying'].includes(state.status);
  renderProgress(state);
  setFeatureVideo(game);
}

function renderAccount() {
  const profile = snapshot.profile || {};
  $('#accountName').textContent = profile.name || profile.username || '航海者';
  $('#accountTitle').textContent = profile.title || 'TABLETOP MEMBER';
  const avatar = Math.max(1, Math.min(50, Number(profile.avatar) || 8));
  $('#accountAvatar').src = `opui://launcher/images/board/avatars/${avatar}.webp`;
  storageSummary.textContent = Number.isFinite(snapshot.freeBytes) ? `可用 ${formatBytes(snapshot.freeBytes)}` : '下載位置';
  cachePath.textContent = snapshot.cacheRoot || '尚未選擇下載位置';
}

function renderDownloads() {
  downloadList.replaceChildren();
  for (const game of GAMES) {
    const state = snapshot.games?.[game.id] || {};
    const copy = statusCopy(state);
    const row = document.createElement('article');
    row.className = 'download-row';
    const cover = document.createElement('img');
    cover.src = game.cover;
    cover.alt = '';
    const content = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = game.title;
    const detail = document.createElement('p');
    detail.textContent = `${state.message || copy.label}${state.totalBytes ? ` · ${formatBytes(state.totalBytes)}` : ''}`;
    content.append(title, detail);
    const version = document.createElement('strong');
    version.textContent = copy.label;
    row.append(cover, content, version);
    downloadList.appendChild(row);
  }
  downloadDot.hidden = !GAMES.some((game) => ['preparing', 'downloading', 'verifying', 'update', 'error', 'repair'].includes(snapshot.games?.[game.id]?.status));
}

function renderAll() {
  renderRail();
  renderFeature();
  renderAccount();
  renderDownloads();
}

function showApp(nextSnapshot) {
  snapshot = { ...snapshot, ...nextSnapshot, games: { ...snapshot.games, ...(nextSnapshot?.games || {}) } };
  renderAll();
  setStage('app');
}

function setAuthMode(mode) {
  authMode = mode === 'register' ? 'register' : 'login';
  const registering = authMode === 'register';
  loginTab.classList.toggle('is-active', !registering);
  loginTab.setAttribute('aria-selected', String(!registering));
  registerTab.classList.toggle('is-active', registering);
  registerTab.setAttribute('aria-selected', String(registering));
  authTitle.textContent = registering ? '建立航海者帳號' : '航海者登入';
  authSubmit.textContent = registering ? '建立帳號' : '登入';
  passwordInput.autocomplete = registering ? 'new-password' : 'current-password';
  authMessage.textContent = '';
}

function translateAuthError(code) {
  const messages = {
    'missing credentials': '請輸入帳號與密碼。',
    'invalid username/password': '帳號或密碼不正確。',
    'username length 3~24': '帳號長度必須是 3～24 字。',
    'username only a-z 0-9 _': '帳號只能使用英文字母、數字與底線。',
    'password length 6~72': '密碼長度必須是 6～72 字。',
    'username taken': '這個帳號已經有人使用。',
    already_logged_in: '帳號目前正在其他裝置使用。',
    timeout: '伺服器沒有回應，請稍後重試。',
    offline: '目前無法連線到帳號伺服器。'
  };
  return messages[String(code || '')] || '登入失敗，請稍後再試。';
}

async function submitAuth(event) {
  event.preventDefault();
  if (!api) return;
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  authSubmit.disabled = true;
  authMessage.textContent = authMode === 'register' ? '正在建立帳號…' : '正在登入…';
  try {
    const result = authMode === 'register'
      ? await api.register({ username, password })
      : await api.login({ username, password });
    passwordInput.value = '';
    if (!result?.ok) {
      authMessage.textContent = translateAuthError(result?.error);
      return;
    }
    showApp(result.state);
  } catch (_) {
    passwordInput.value = '';
    authMessage.textContent = '登入元件暫時沒有回應。';
  } finally {
    authSubmit.disabled = false;
  }
}

async function runPrimaryAction() {
  const state = snapshot.games?.[selectedGameId] || {};
  try {
    if (state.status === 'installed') {
      const result = await api.launchGame(selectedGameId);
      if (!result?.ok) showToast(result?.error || '無法啟動遊戲。');
      return;
    }
    const result = await api.installGame(selectedGameId);
    if (!result?.ok) showToast(result?.error || '無法開始下載。');
  } catch (_) {
    showToast('啟動器暫時沒有回應。');
  }
}

function openDetails() {
  const game = byId[selectedGameId];
  const state = snapshot.games?.[game.id] || {};
  $('#detailCover').src = game.cover;
  $('#detailCover').alt = `${game.title}封面`;
  $('#detailEyebrow').textContent = game.english;
  $('#detailTitle').textContent = game.title;
  $('#detailDescription').textContent = game.description;
  $('#detailFeatures').innerHTML = game.features.map((feature) => `<li>${feature}</li>`).join('');
  const detailMeta = $('#detailMeta');
  detailMeta.replaceChildren();
  for (const item of [...game.tags, state.totalBytes ? `下載 ${formatBytes(state.totalBytes)}` : ''].filter(Boolean)) {
    const tag = document.createElement('span');
    tag.textContent = item;
    detailMeta.appendChild(tag);
  }
  detailDialog.showModal();
}

function switchPanel(panelName) {
  const downloads = panelName === 'downloads';
  libraryPanel.hidden = downloads;
  downloadsPanel.hidden = !downloads;
  libraryPanel.classList.toggle('is-active', !downloads);
  downloadsPanel.classList.toggle('is-active', downloads);
  document.querySelectorAll('.nav-button[data-panel]').forEach((button) => button.classList.toggle('is-active', button.dataset.panel === panelName));
}

async function chooseCacheLocation() {
  if (!api) return;
  const result = await api.chooseCacheLocation();
  if (result?.ok && result.state) {
    snapshot = { ...snapshot, ...result.state };
    renderAll();
  } else if (result?.error) {
    showToast(result.error);
  }
}

async function initialize() {
  if (!api) {
    $('#bootMessage').textContent = '請使用 Windows 桌面啟動器開啟。';
    return;
  }
  try {
    const state = await api.getState();
    if (state?.ok === false) {
      $('#bootMessage').textContent = state.error || '啟動器初始化失敗，請重新開啟。';
      return;
    }
    if (state?.previewMode) previewSkip.hidden = false;
    if (state?.authenticated || state?.previewMode) showApp(state);
    else setStage('auth');
  } catch (_) {
    $('#bootMessage').textContent = '啟動器初始化失敗，請重新開啟。';
  }
}

loginTab.addEventListener('click', () => setAuthMode('login'));
registerTab.addEventListener('click', () => setAuthMode('register'));
authForm.addEventListener('submit', submitAuth);
previewSkip.addEventListener('click', async () => {
  const state = await api.enterPreview();
  if (state?.ok === false) {
    showToast(state.error || '正式版不提供設計預覽。');
    return;
  }
  showApp(state);
});
primaryAction.addEventListener('click', runPrimaryAction);
existingLaunchAction.addEventListener('click', async () => {
  const result = await api.launchGame(selectedGameId);
  if (!result?.ok) showToast(result?.error || '無法啟動現有版本。');
});
cancelAction.addEventListener('click', async () => {
  const result = await api.cancelInstall(selectedGameId);
  if (!result?.ok) showToast(result?.error || '無法暫停下載。');
});
detailsButton.addEventListener('click', openDetails);
$('#detailClose').addEventListener('click', () => detailDialog.close());
detailDialog.addEventListener('click', (event) => { if (event.target === detailDialog) detailDialog.close(); });
document.querySelectorAll('.nav-button[data-panel]').forEach((button) => button.addEventListener('click', () => switchPanel(button.dataset.panel)));
$('#storageButton').addEventListener('click', () => locationDialog.showModal());
$('#changeLocationButton').addEventListener('click', () => locationDialog.showModal());
$('#locationClose').addEventListener('click', () => locationDialog.close());
$('#locationDone').addEventListener('click', () => locationDialog.close());
$('#pickLocationButton').addEventListener('click', chooseCacheLocation);
$('#accountButton').addEventListener('click', () => {
  accountMenu.hidden = !accountMenu.hidden;
  $('#accountButton').setAttribute('aria-expanded', String(!accountMenu.hidden));
});
$('#logoutButton').addEventListener('click', async () => {
  await api.logout();
  accountMenu.hidden = true;
  setStage('auth');
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.account-area')) accountMenu.hidden = true;
});

api?.onState((nextState) => {
  if (nextState?.authenticated === false && !nextState?.previewMode) {
    snapshot = { ...snapshot, ...nextState };
    setStage('auth');
    return;
  }
  snapshot = { ...snapshot, ...nextState, games: { ...snapshot.games, ...(nextState?.games || {}) } };
  renderAll();
});

api?.onProgress((progress) => {
  if (!progress?.gameId || !byId[progress.gameId]) return;
  snapshot.games = { ...snapshot.games, [progress.gameId]: { ...(snapshot.games[progress.gameId] || {}), ...progress } };
  renderRail();
  if (selectedGameId === progress.gameId) renderFeature();
  renderDownloads();
});

api?.onSessionKicked(() => {
  showToast('帳號已在其他裝置登入，本機已登出。');
  setStage('auth');
});

window.addEventListener('DOMContentLoaded', initialize, { once: true });

$('#accountAvatar').addEventListener('error', () => {
  $('#accountAvatar').src = 'opui://launcher/images/board/avatars/8.webp';
}, { once: true });
