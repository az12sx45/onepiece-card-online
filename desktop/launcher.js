'use strict';

const api = window.onePieceDesktop;

const GAMES = [
  {
    id: 'card',
    title: '偉大航道爭霸戰',
    english: 'GRAND LINE RIVALRY',
    tagline: '留哪張、打哪張，一手牌就能翻轉戰局。',
    description: '每回合抽一張，再從兩張手牌中打出一張：打出的角色發動技能，留下的牌則用來交換、猜牌與決鬥。善用場地強化、棄牌情報與角色效果，淘汰對手並爭奪寶箱金幣。',
    detailDescription: '這不是傳統牌組構築遊戲。每回合先抽一張，再從手中的兩張牌決定要打出誰、留下誰：打出的角色立刻改變牌局，保留的牌則成為交換、猜牌與決鬥時的底牌。觀察棄牌情報與本局場地，抓準時機淘汰對手，才能把寶箱金幣帶回船上。',
    tags: ['雙牌抉擇', '線上房間', '玩家與 CPU'],
    features: ['抽一張、打一張的雙牌抉擇', '場地強化、猜牌與尾數決鬥', '線上房間、CPU 與好友對戰'],
    cover: 'opui://launcher/images/game_launcher/launcher_card_cover_perspective_v2.png',
    frame: 'opui://launcher/images/game_launcher/launcher_card_box_frame_cutout_v1.png',
    lidFront: 'opui://launcher/images/game_launcher/launcher_card_lid_front_panel_v1.png',
    fixedShell: 'opui://launcher/images/game_launcher/launcher_card_box_shell_fixed_v1.png',
    lidClip: 'polygon(4.604% 9.185%, 86.096% 11.188%, 85.635% 93.923%, 4.604% 89.434%)',
    trayClip: 'polygon(6.814% 10.704%, 81.676% 11.878%, 81.676% 91.298%, 6.814% 87.362%)',
    lidOrigin: '4.604% 49.309%',
    lightSourceX: '43.5824%',
    lightSourceY: '50.2882%',
    vfxShiftX: '-1.45%',
    vfxShiftY: '-0.72%',
    lightCx: 473.305,
    lightCy: 728.173,
    freeEdgePath: 'M 103 135 L 935 162 L 930 1360 L 103 1299',
    preview: 'opui://launcher/videos/game_launcher/card_sanji_duel_preview_v2.mp4',
    accent: '255, 180, 64'
  },
  {
    id: 'board',
    title: '新世界航海錄',
    english: 'NEW WORLD VOYAGE',
    tagline: '骰下航路，讓你的海賊團航向最終之島。',
    description: '擲骰沿分支航線前進，遭遇島嶼與海上事件，招募並培養自己的夥伴；突破四皇據點後航向最終之島。可單人與 CPU 航海，也能和其他玩家共鬥。',
    detailDescription: '每次擲骰都不只是前進：你要選擇航路、處理島嶼與海上事件、招募夥伴、配置裝備，再決定如何面對戰鬥與任務。可以獨自帶著 CPU 航海，也能與其他玩家同步共鬥；完成一周目後，二周目會開啟角色捕捉、培育、切磋，以及十三座 Boss 島的長期挑戰。',
    tags: ['分支航線', '1–4 人', '共鬥與培養'],
    features: ['分支航線、島嶼與海上事件', '招募、裝備、任務與多人共鬥', '二周目捕捉、培育、切磋與十三 Boss'],
    cover: 'opui://launcher/images/game_launcher/launcher_board_cover_logo_perspective_v5.png',
    frame: 'opui://launcher/images/game_launcher/launcher_board_box_frame_cutout_v1.png',
    lidFront: 'opui://launcher/images/game_launcher/launcher_board_lid_front_panel_v1.png',
    fixedShell: 'opui://launcher/images/game_launcher/launcher_board_box_shell_fixed_v1.png',
    lidClip: 'polygon(3.959% 7.528%, 86.464% 9.807%, 85.820% 93.232%, 3.959% 89.019%)',
    trayClip: 'polygon(6.446% 9.185%, 81.215% 10.635%, 81.215% 90.677%, 6.446% 86.671%)',
    lidOrigin: '3.959% 48.273%',
    lightSourceX: '43.2241%',
    lightSourceY: '49.2700%',
    vfxShiftX: '-1.78%',
    vfxShiftY: '-1.70%',
    lightCx: 469.414,
    lightCy: 713.430,
    freeEdgePath: 'M 97 111 L 939 142 L 932 1350 L 96 1293',
    preview: 'opui://launcher/videos/game_launcher/board_battle_preview_v2.mp4',
    accent: '72, 223, 205'
  },
  {
    id: 'chess',
    title: '霸海戰棋',
    english: 'PIRATE WAR CHESS',
    tagline: '棋局不只分勝負，每一次吃子都是角色交鋒。',
    description: '以西洋棋對局為骨架，將海賊角色化為不同棋子，並在移動與吃子時呈現專屬演出。目前仍在逐角製作與棋盤校準，尚未開放下載。',
    detailDescription: '以西洋棋規則作為戰術骨架，再把角色個性帶進每一次移動與吃子。不同陣營與角色將擁有專屬棋子造型、移動表現和攻擊演出；目前仍在逐一製作角色並校準棋盤，完成正式版本前不會開放下載。',
    tags: ['角色棋子', '專屬演出', '製作中'],
    features: ['角色化棋子與陣營配置', '移動、吃子的專屬演出', '製作中，完成後才開放下載'],
    cover: 'opui://launcher/images/game_launcher/launcher_chess_cover_logo_perspective_v5.png',
    frame: 'opui://launcher/images/game_launcher/launcher_chess_box_frame_cutout_v1.png',
    lidFront: 'opui://launcher/images/game_launcher/launcher_chess_lid_front_panel_v1.png',
    fixedShell: 'opui://launcher/images/game_launcher/launcher_chess_box_shell_fixed_v1.png',
    lidClip: 'polygon(4.328% 7.597%, 86.372% 9.807%, 85.820% 96.685%, 4.328% 92.334%)',
    trayClip: 'polygon(6.998% 9.254%, 81.952% 10.566%, 81.952% 93.715%, 6.906% 89.641%)',
    lidOrigin: '4.328% 49.965%',
    lightSourceX: '43.8194%',
    lightSourceY: '50.7459%',
    vfxShiftX: '-1.22%',
    vfxShiftY: '-0.25%',
    lightCx: 475.879,
    lightCy: 734.801,
    freeEdgePath: 'M 100 112 L 938 142 L 932 1400 L 100 1341',
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
  preferences: { minimizeToTrayOnGameLaunch: false, gameDisplayMode: 'borderless' },
  games: Object.fromEntries(GAMES.map((game) => [game.id, { status: game.id === 'chess' ? 'unavailable' : 'checking' }]))
};
let authMode = 'login';
let toastTimer = 0;
let activePreviewUrl = '';
let uninstallGameId = '';
const launchingGameIds = new Set();
let previewRevision = 0;
let cursorClickPulse = null;
let cursorClickTimer = 0;
const LAUNCHER_UPDATE_STATUSES = new Set(['idle', 'checking', 'current', 'available', 'downloading', 'ready', 'applying', 'error']);
let launcherUpdateState = {
  status: 'idle',
  currentVersion: '',
  availableVersion: '',
  progress: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  error: ''
};

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
const gameFeature = $('#gameFeature');
const featureVideo = $('#featureVideo');
const featureArt = $('#featureArt');
const featureBoxArt = $('.feature-box-art');
const featureCover = $('#featureCover');
const featureFrame = $('#featureFrame');
const featureInnerCore = $('#featureInnerCore');
const featureEdgeSpill = $('#featureEdgeSpill');
const featureEdgeGlow = $('#featureEdgeGlow');
const featureEdgeCore = $('#featureEdgeCore');
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
const downloadsCachePath = $('#downloadsCachePath');
const accountMenu = $('#accountMenu');
const detailDialog = $('#detailDialog');
const locationDialog = $('#locationDialog');
const settingsDialog = $('#settingsDialog');
const minimizeToTrayToggle = $('#minimizeToTrayToggle');
const gameDisplayBorderless = $('#gameDisplayBorderless');
const gameDisplayFullscreen = $('#gameDisplayFullscreen');
const launcherUpdateCard = $('#launcherUpdateCard');
const launcherCurrentVersion = $('#launcherCurrentVersion');
const launcherUpdateStatus = $('#launcherUpdateStatus');
const launcherUpdateProgress = $('#launcherUpdateProgress');
const launcherUpdateProgressBar = $('#launcherUpdateProgressBar');
const launcherUpdateProgressDetail = $('#launcherUpdateProgressDetail');
const launcherUpdateAction = $('#launcherUpdateAction');
const uninstallDialog = $('#uninstallDialog');
const toast = $('#toast');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function setStage(stage) {
  if (stage === 'auth') closeLauncherOverlays();
  document.body.dataset.stage = stage;
  for (const [name, element] of [['boot', bootScreen], ['auth', authScreen], ['app', launcherApp]]) {
    const active = name === stage;
    element.hidden = !active;
    requestAnimationFrame(() => element.classList.toggle('is-active', active));
  }
  requestAnimationFrame(syncFeatureMedia);
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3400);
}

function clearCursorClickPulse() {
  clearTimeout(cursorClickTimer);
  cursorClickTimer = 0;
  cursorClickPulse?.remove();
  cursorClickPulse = null;
}

function releaseCursorPress() {
  document.body.classList.remove('is-cursor-pressed');
}

function clearCursorFeedback() {
  releaseCursorPress();
  clearCursorClickPulse();
}

function showCursorClickFeedback(event) {
  if (!event.isPrimary || event.button !== 0 || !['mouse', 'pen'].includes(event.pointerType)) return;
  const target = event.target instanceof Element ? event.target : null;
  if (!target || !target.closest('.screen.is-active, dialog[open]')) return;
  if (target.closest('button:disabled, [aria-disabled="true"], input:not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable="true"]')) return;

  releaseCursorPress();
  clearCursorClickPulse();
  document.body.classList.add('is-cursor-pressed');

  const pulse = document.createElement('span');
  pulse.className = 'launcher-cursor-click-pulse';
  pulse.setAttribute('aria-hidden', 'true');
  pulse.style.left = `${event.clientX}px`;
  pulse.style.top = `${event.clientY}px`;
  (target.closest('dialog[open]') || document.body).appendChild(pulse);
  cursorClickPulse = pulse;

  const removePulse = () => {
    if (cursorClickPulse !== pulse) return;
    clearCursorClickPulse();
  };
  pulse.addEventListener('animationend', removePulse, { once: true });
  cursorClickTimer = window.setTimeout(removePulse, 420);
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

function mergeLauncherUpdateState(nextState = {}) {
  const source = nextState && typeof nextState === 'object' ? nextState : {};
  const status = LAUNCHER_UPDATE_STATUSES.has(source.status) ? source.status : launcherUpdateState.status;
  const downloadedBytes = Math.max(0, Number(source.downloadedBytes ?? launcherUpdateState.downloadedBytes) || 0);
  const totalBytes = Math.max(0, Number(source.totalBytes ?? launcherUpdateState.totalBytes) || 0);
  let progress = Number(source.progress ?? source.percent);
  if (!Number.isFinite(progress) && totalBytes > 0) progress = (downloadedBytes / totalBytes) * 100;
  if (!Number.isFinite(progress)) progress = Number(launcherUpdateState.progress) || 0;

  launcherUpdateState = {
    ...launcherUpdateState,
    ...source,
    status,
    currentVersion: String(source.currentVersion ?? launcherUpdateState.currentVersion ?? ''),
    availableVersion: String(source.availableVersion ?? launcherUpdateState.availableVersion ?? ''),
    progress: Math.min(100, Math.max(0, progress)),
    downloadedBytes,
    totalBytes,
    error: status === 'error' ? String(source.error || source.errorMessage || launcherUpdateState.error || '檢查更新時發生問題。') : ''
  };
  renderLauncherUpdate();
}

function renderLauncherUpdate() {
  if (!launcherUpdateCard) return;
  const state = launcherUpdateState;
  const version = state.currentVersion || '—';
  const availableVersion = state.availableVersion || '新版本';
  const progress = Math.round(state.progress || 0);
  let message = '尚未檢查更新。';
  let action = '檢查更新';
  let disabled = false;

  switch (state.status) {
    case 'checking':
      message = '正在向更新伺服器確認最新版本…';
      action = '檢查中…';
      disabled = true;
      break;
    case 'current':
      message = '目前已是最新版本。';
      action = '再次檢查';
      break;
    case 'available':
      message = `發現版本 ${availableVersion}，下載後即可安裝。`;
      action = '下載更新';
      break;
    case 'downloading':
      message = `正在下載版本 ${availableVersion}…`;
      action = `下載中 ${progress}%`;
      disabled = true;
      break;
    case 'ready':
      message = `版本 ${availableVersion} 已下載並完成驗證。`;
      action = '安裝並重新啟動';
      break;
    case 'applying':
      message = '正在安裝更新，啟動器即將重新開啟…';
      action = '正在重新啟動…';
      disabled = true;
      break;
    case 'error':
      message = state.error || '檢查更新時發生問題。';
      action = '重新檢查';
      break;
    default:
      break;
  }

  launcherUpdateCard.dataset.status = state.status;
  launcherUpdateCard.setAttribute('aria-busy', String(['checking', 'downloading', 'applying'].includes(state.status)));
  launcherCurrentVersion.textContent = `目前版本 ${version}`;
  launcherUpdateStatus.textContent = message;
  launcherUpdateAction.textContent = action;
  launcherUpdateAction.disabled = disabled;
  launcherUpdateAction.setAttribute('aria-label', action);

  const showProgress = state.status === 'downloading';
  launcherUpdateProgress.hidden = !showProgress;
  launcherUpdateProgress.setAttribute('aria-valuenow', String(progress));
  launcherUpdateProgressBar.style.width = `${progress}%`;
  launcherUpdateProgressDetail.textContent = state.totalBytes > 0
    ? `${progress}% · ${formatBytes(state.downloadedBytes)} / ${formatBytes(state.totalBytes)}`
    : `${progress}%`;
}

function readLauncherUpdateResult(result, fallbackError) {
  if (result?.ok === false) {
    mergeLauncherUpdateState({ status: 'error', error: result.error || fallbackError });
    return false;
  }
  mergeLauncherUpdateState(result?.state || result || {});
  return true;
}

async function refreshLauncherUpdateState() {
  if (typeof api?.getLauncherUpdateState !== 'function') {
    mergeLauncherUpdateState({ status: 'error', error: '此版本尚未提供啟動器更新功能。' });
    return;
  }
  try {
    const result = await api.getLauncherUpdateState();
    readLauncherUpdateResult(result, '無法讀取啟動器更新狀態。');
  } catch (_) {
    mergeLauncherUpdateState({ status: 'error', error: '啟動器暫時無法讀取更新狀態。' });
  }
}

async function runLauncherUpdateAction() {
  const status = launcherUpdateState.status;
  let method = '';
  let pendingStatus = '';
  let fallbackError = '';

  if (status === 'idle' || status === 'current' || status === 'error') {
    method = 'checkLauncherUpdate';
    pendingStatus = 'checking';
    fallbackError = '無法檢查啟動器更新。';
  } else if (status === 'available') {
    method = 'downloadLauncherUpdate';
    pendingStatus = 'downloading';
    fallbackError = '無法下載啟動器更新。';
  } else if (status === 'ready') {
    method = 'applyLauncherUpdate';
    pendingStatus = 'applying';
    fallbackError = '無法安裝啟動器更新。';
  } else {
    return;
  }

  if (typeof api?.[method] !== 'function') {
    mergeLauncherUpdateState({ status: 'error', error: '此版本尚未提供啟動器更新功能。' });
    return;
  }

  mergeLauncherUpdateState({ status: pendingStatus, progress: pendingStatus === 'downloading' ? 0 : launcherUpdateState.progress });
  try {
    const result = await api[method]();
    readLauncherUpdateResult(result, fallbackError);
  } catch (_) {
    mergeLauncherUpdateState({ status: 'error', error: fallbackError });
  }
}

function statusCopy(gameState = {}) {
  switch (gameState.status) {
    case 'installed': return { label: '可遊玩', tone: 'ready', action: '啟動遊戲' };
    case 'update': return { label: '有新版本', tone: 'update', action: '下載更新' };
    case 'preparing': return { label: '準備中', tone: 'update', action: '正在準備…' };
    case 'downloading': return { label: '下載中', tone: 'ready', action: '正在下載…' };
    case 'verifying': return { label: '驗證檔案', tone: 'update', action: '正在驗證…' };
    case 'removing': return { label: '移除中', tone: 'error', action: '正在移除…' };
    case 'paused': return { label: '已暫停', tone: 'update', action: '繼續下載' };
    case 'repair': return { label: '需要修復', tone: 'error', action: '修復遊戲' };
    case 'error': return { label: '下載失敗', tone: 'error', action: '重試下載' };
    case 'unavailable': return { label: '製作中', tone: 'locked', action: '尚未開放' };
    case 'desktop-required': return { label: '桌面版限定', tone: 'locked', action: '需安裝啟動器' };
    case 'checking': return { label: '檢查版本', tone: 'locked', action: '檢查中…' };
    default: return { label: '尚未安裝', tone: 'update', action: '下載安裝' };
  }
}

function gameBoxMarkup(game, className = '') {
  return `<span class="game-box-art ${className}"><img class="game-box-cover" src="${game.cover}" alt=""><img class="game-box-frame" src="${game.frame}" alt="" aria-hidden="true"></span>`;
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
    button.innerHTML = `${gameBoxMarkup(game, 'rail-box-art')}<span class="rail-copy"><strong>${game.title}</strong><small>${copy.label}</small></span>`;
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

function featureMediaCanPlay(game) {
  return Boolean(
    game?.preview &&
    document.visibilityState === 'visible' &&
    document.body.dataset.stage === 'app' &&
    !libraryPanel.hidden &&
    !reducedMotion.matches
  );
}

function currentVideoMatches(game) {
  return Boolean(game?.preview && featureVideo.getAttribute('src') === game.preview);
}

function setFeatureMediaState(state) {
  gameFeature.dataset.mediaState = state;
}

function syncFeatureMedia() {
  const game = byId[selectedGameId];
  if (!game) return;
  featureArt.style.backgroundImage = `url("${game.cover}")`;
  if (!featureMediaCanPlay(game)) {
    previewRevision += 1;
    featureVideo.pause();
    setFeatureMediaState(document.body.dataset.stage === 'app' && !libraryPanel.hidden
      ? (game.preview ? 'fallback' : 'ambient')
      : 'paused');
    if (!game.preview || reducedMotion.matches) {
      activePreviewUrl = '';
      featureVideo.removeAttribute('src');
      featureVideo.load();
    }
    return;
  }
  if (activePreviewUrl === game.preview && currentVideoMatches(game)) {
    if (!featureVideo.paused && featureVideo.readyState >= 2) {
      setFeatureMediaState('video');
      return;
    }
    setFeatureMediaState('loading');
    const revision = previewRevision;
    featureVideo.play().catch(() => {
      if (revision === previewRevision && byId[selectedGameId] === game) setFeatureMediaState('fallback');
    });
    return;
  }
  const revision = ++previewRevision;
  activePreviewUrl = game.preview;
  setFeatureMediaState('loading');
  featureVideo.pause();
  featureVideo.removeAttribute('src');
  featureVideo.load();
  featureVideo.src = game.preview;
  featureVideo.load();
  featureVideo.play().catch(() => {
    if (revision === previewRevision && byId[selectedGameId] === game) setFeatureMediaState('fallback');
  });
}

function setFeatureVideo(game) {
  featureArt.style.backgroundImage = `url("${game.cover}")`;
  syncFeatureMedia();
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
  const launching = launchingGameIds.has(game.id);
  const launchBlocked = launchingGameIds.size > 0;
  document.documentElement.style.setProperty('--active-accent-rgb', game.accent);
  featureBoxArt.style.setProperty('--lid-clip', game.lidClip);
  featureBoxArt.style.setProperty('--tray-clip', game.trayClip);
  featureBoxArt.style.setProperty('--lid-origin', game.lidOrigin);
  featureBoxArt.style.setProperty('--light-source-x', game.lightSourceX);
  featureBoxArt.style.setProperty('--light-source-y', game.lightSourceY);
  featureBoxArt.style.setProperty('--vfx-shift-x', game.vfxShiftX);
  featureBoxArt.style.setProperty('--vfx-shift-y', game.vfxShiftY);
  featureInnerCore.setAttribute('cx', String(game.lightCx));
  featureInnerCore.setAttribute('cy', String(game.lightCy));
  featureEdgeSpill.setAttribute('d', game.freeEdgePath);
  featureEdgeGlow.setAttribute('d', game.freeEdgePath);
  featureEdgeCore.setAttribute('d', game.freeEdgePath);
  featureCover.src = game.lidFront;
  featureCover.alt = `${game.title}桌遊盒`;
  featureFrame.src = game.fixedShell;
  featureTitle.textContent = game.title;
  featureTagline.textContent = game.tagline;
  featureDescription.textContent = game.description;
  featureTags.innerHTML = game.tags.map((tag) => `<span>${tag}</span>`).join('');
  featureStatus.textContent = copy.label;
  featureStatus.dataset.tone = copy.tone;
  featureVersion.textContent = game.english;
  primaryAction.textContent = launching && state.status === 'installed' ? '正在啟動…' : copy.action;
  primaryAction.disabled = launchBlocked || ['unavailable', 'desktop-required', 'checking', 'preparing', 'downloading', 'verifying', 'removing'].includes(state.status);
  existingLaunchAction.hidden = !state.hasInstalled || ['installed', 'preparing', 'downloading', 'verifying', 'removing'].includes(state.status);
  existingLaunchAction.disabled = launchBlocked;
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
  downloadsCachePath.textContent = snapshot.cacheRoot || '尚未選擇下載位置';
  const launchInProgress = launchingGameIds.size > 0;
  $('#storageButton').disabled = launchInProgress;
  $('#changeLocationButton').disabled = launchInProgress;
}

function renderDownloads() {
  downloadList.replaceChildren();
  for (const game of GAMES) {
    const state = snapshot.games?.[game.id] || {};
    const copy = statusCopy(state);
    const row = document.createElement('article');
    row.className = 'download-row';
    row.style.setProperty('--game-accent-rgb', game.accent);
    const visual = document.createElement('div');
    visual.className = 'download-visual';
    visual.innerHTML = gameBoxMarkup(game, 'download-box-art');
    const content = document.createElement('div');
    content.className = 'download-copy';
    const title = document.createElement('h3');
    title.textContent = game.title;
    const detail = document.createElement('p');
    detail.textContent = `${state.message || copy.label}${state.totalBytes ? ` · ${formatBytes(state.totalBytes)}` : ''}`;
    const versions = document.createElement('div');
    versions.className = 'download-versions';
    const installedVersion = state.installedVersion ? `已安裝 ${state.installedVersion}` : '尚未安裝';
    const remoteVersion = state.remoteVersion ? `最新 ${state.remoteVersion}` : '版本尚未公布';
    versions.innerHTML = `<span>${installedVersion}</span><span>${remoteVersion}</span>`;
    content.append(title, detail, versions);

    const status = document.createElement('span');
    status.className = 'download-status';
    status.dataset.tone = copy.tone;
    status.textContent = copy.label;

    const actions = document.createElement('div');
    actions.className = 'download-actions';
    const downloadActive = ['preparing', 'downloading', 'verifying'].includes(state.status);
    const launching = launchingGameIds.has(game.id);
    const busy = downloadActive || state.status === 'removing' || launchingGameIds.size > 0;
    if (state.status !== 'unavailable' && state.status !== 'checking') {
      const primary = document.createElement('button');
      primary.type = 'button';
      primary.className = 'gold-button download-primary';
      primary.textContent = launching && state.status === 'installed' ? '正在啟動…' : copy.action;
      primary.disabled = busy;
      primary.addEventListener('click', () => runGameAction(game.id));
      actions.appendChild(primary);
    }
    if (state.hasInstalled && state.status !== 'installed') {
      const launchExisting = document.createElement('button');
      launchExisting.type = 'button';
      launchExisting.className = 'ghost-button';
      launchExisting.textContent = launching ? '正在啟動…' : '啟動現有版本';
      launchExisting.disabled = busy;
      launchExisting.addEventListener('click', () => launchInstalledGame(game.id));
      actions.appendChild(launchExisting);
    }
    if (downloadActive) {
      const pause = document.createElement('button');
      pause.type = 'button';
      pause.className = 'cancel-button';
      pause.textContent = '暫停下載';
      pause.addEventListener('click', () => pauseGameDownload(game.id));
      actions.appendChild(pause);
    }
    if (state.removable) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove-game-button';
      remove.textContent = '解除安裝';
      remove.disabled = busy;
      remove.addEventListener('click', () => openUninstallDialog(game.id));
      actions.appendChild(remove);
    }
    const right = document.createElement('div');
    right.className = 'download-row-controls';
    right.append(status, actions);
    row.append(visual, content, right);
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

async function runGameAction(gameId) {
  const state = snapshot.games?.[gameId] || {};
  if (state.status === 'installed') return launchInstalledGame(gameId);
  try {
    const result = await api.installGame(gameId);
    if (!result?.ok) showToast(result?.error || '無法開始下載。');
  } catch (_) {
    showToast('啟動器暫時沒有回應。');
  }
}

async function runPrimaryAction() {
  return runGameAction(selectedGameId);
}

async function launchInstalledGame(gameId) {
  if (launchingGameIds.size > 0) return;
  launchingGameIds.add(gameId);
  if (selectedGameId !== gameId) {
    selectedGameId = gameId;
    renderRail();
    renderFeature();
  }
  switchPanel('library');
  gameFeature.classList.remove('is-launch-opening');
  void gameFeature.offsetWidth;
  if (!reducedMotion.matches) gameFeature.classList.add('is-launch-opening');
  if (selectedGameId === gameId) renderFeature();
  renderAccount();
  renderDownloads();
  try {
    const result = await api.launchGame(gameId);
    if (!result?.ok) showToast(result?.error || '無法啟動現有版本。');
  } catch (_) {
    showToast('啟動器暫時沒有回應。');
  } finally {
    launchingGameIds.delete(gameId);
    gameFeature.classList.remove('is-launch-opening');
    if (selectedGameId === gameId) renderFeature();
    renderAccount();
    renderDownloads();
  }
}

async function pauseGameDownload(gameId) {
  try {
    const result = await api.cancelInstall(gameId);
    if (!result?.ok) showToast(result?.error || '無法暫停下載。');
  } catch (_) {
    showToast('啟動器暫時沒有回應。');
  }
}

function openUninstallDialog(gameId) {
  const game = byId[gameId];
  const state = snapshot.games?.[gameId] || {};
  if (!game || !state.removable) return;
  uninstallGameId = gameId;
  $('#uninstallTitle').textContent = `解除安裝「${game.title}」？`;
  $('#uninstallDescription').textContent = `將移除這款遊戲下載到電腦的圖片、音樂與影片。之後仍可隨時重新下載。`;
  $('#uninstallConfirm').disabled = false;
  $('#uninstallConfirm').textContent = '解除安裝';
  uninstallDialog.showModal();
}

async function confirmUninstall() {
  const gameId = uninstallGameId;
  const game = byId[gameId];
  if (!game) return;
  const confirmButton = $('#uninstallConfirm');
  confirmButton.disabled = true;
  confirmButton.textContent = '正在移除…';
  try {
    const result = await api.uninstallGame(gameId);
    if (!result?.ok) {
      showToast(result?.error || '無法解除安裝遊戲。');
      confirmButton.disabled = false;
      confirmButton.textContent = '解除安裝';
      return;
    }
    if (result.state) {
      snapshot = { ...snapshot, ...result.state, games: { ...snapshot.games, ...(result.state.games || {}) } };
      renderAll();
    }
    uninstallDialog.close();
    uninstallGameId = '';
    showToast(`已解除安裝「${game.title}」${result.removedBytes ? `，釋放 ${formatBytes(result.removedBytes)}` : ''}。`);
  } catch (_) {
    showToast('啟動器暫時沒有回應。');
    confirmButton.disabled = false;
    confirmButton.textContent = '解除安裝';
  }
}

function openDetails() {
  const game = byId[selectedGameId];
  const state = snapshot.games?.[game.id] || {};
  $('#detailCover').src = game.cover;
  $('#detailCover').alt = `${game.title}桌遊盒`;
  $('#detailFrame').src = game.frame;
  $('#detailEyebrow').textContent = game.english;
  $('#detailTitle').textContent = game.title;
  $('#detailDescription').textContent = game.detailDescription || game.description;
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
  syncFeatureMedia();
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

function closeAccountMenu() {
  accountMenu.hidden = true;
  $('#accountButton').setAttribute('aria-expanded', 'false');
}

function closeLauncherOverlays() {
  for (const dialog of [detailDialog, locationDialog, settingsDialog, uninstallDialog]) {
    if (dialog.open) dialog.close();
  }
  uninstallGameId = '';
  closeAccountMenu();
}

function openSettingsDialog() {
  closeAccountMenu();
  minimizeToTrayToggle.checked = snapshot.preferences?.minimizeToTrayOnGameLaunch === true;
  const displayMode = snapshot.preferences?.gameDisplayMode === 'fullscreen' ? 'fullscreen' : 'borderless';
  gameDisplayBorderless.checked = displayMode === 'borderless';
  gameDisplayFullscreen.checked = displayMode === 'fullscreen';
  $('#settingsSave').disabled = false;
  $('#settingsSave').textContent = '儲存設定';
  renderLauncherUpdate();
  settingsDialog.showModal();
  refreshLauncherUpdateState();
}

async function saveSettings() {
  const saveButton = $('#settingsSave');
  saveButton.disabled = true;
  saveButton.textContent = '正在儲存…';
  try {
    const gameDisplayMode = gameDisplayFullscreen.checked ? 'fullscreen' : 'borderless';
    const result = await api.setPreferences({
      minimizeToTrayOnGameLaunch: minimizeToTrayToggle.checked,
      gameDisplayMode
    });
    if (!result?.ok) {
      showToast(result?.error || '無法儲存啟動器設定。');
      return;
    }
    if (result.state) {
      snapshot = { ...snapshot, ...result.state, games: { ...snapshot.games, ...(result.state.games || {}) } };
      renderAll();
    }
    settingsDialog.close();
    showToast(`設定已儲存；遊戲將以${gameDisplayMode === 'fullscreen' ? '全螢幕' : '無邊框視窗'}開啟。`);
  } catch (_) {
    showToast('啟動器暫時沒有回應。');
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = '儲存設定';
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
  await launchInstalledGame(selectedGameId);
});
cancelAction.addEventListener('click', async () => {
  await pauseGameDownload(selectedGameId);
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
$('#uninstallClose').addEventListener('click', () => uninstallDialog.close());
$('#uninstallCancel').addEventListener('click', () => uninstallDialog.close());
$('#uninstallConfirm').addEventListener('click', confirmUninstall);
uninstallDialog.addEventListener('close', () => { uninstallGameId = ''; });
uninstallDialog.addEventListener('click', (event) => { if (event.target === uninstallDialog) uninstallDialog.close(); });
$('#accountButton').addEventListener('click', () => {
  accountMenu.hidden = !accountMenu.hidden;
  $('#accountButton').setAttribute('aria-expanded', String(!accountMenu.hidden));
});
$('#settingsButton').addEventListener('click', openSettingsDialog);
$('#settingsClose').addEventListener('click', () => settingsDialog.close());
$('#settingsCancel').addEventListener('click', () => settingsDialog.close());
$('#settingsSave').addEventListener('click', saveSettings);
launcherUpdateAction.addEventListener('click', runLauncherUpdateAction);
settingsDialog.addEventListener('click', (event) => { if (event.target === settingsDialog) settingsDialog.close(); });
$('#logoutButton').addEventListener('click', async () => {
  await api.logout();
  closeAccountMenu();
  setStage('auth');
});
document.addEventListener('pointerdown', showCursorClickFeedback, true);
document.addEventListener('pointerup', releaseCursorPress, true);
document.addEventListener('pointercancel', clearCursorFeedback, true);
window.addEventListener('blur', clearCursorFeedback);
document.addEventListener('click', (event) => {
  if (!event.target.closest('.account-area')) closeAccountMenu();
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

api?.onLauncherUpdate?.((nextState) => {
  mergeLauncherUpdateState(nextState);
});

api?.onSessionKicked(() => {
  showToast('帳號已在其他裝置登入，本機已登出。');
  setStage('auth');
});

featureVideo.addEventListener('playing', () => {
  const game = byId[selectedGameId];
  if (featureMediaCanPlay(game) && currentVideoMatches(game)) setFeatureMediaState('video');
  else featureVideo.pause();
});
featureVideo.addEventListener('error', () => {
  const game = byId[selectedGameId];
  if (currentVideoMatches(game)) setFeatureMediaState('fallback');
});
document.addEventListener('visibilitychange', () => {
  syncFeatureMedia();
  if (document.hidden) clearCursorFeedback();
});
reducedMotion.addEventListener('change', syncFeatureMedia);

window.addEventListener('DOMContentLoaded', initialize, { once: true });

$('#accountAvatar').addEventListener('error', () => {
  $('#accountAvatar').src = 'opui://launcher/images/board/avatars/8.webp';
}, { once: true });
