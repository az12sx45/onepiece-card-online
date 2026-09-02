(async () => {
  const entrySession = await runLauncherEntryGate();
  if (!entrySession?.ready) return;

  const DESIGN_WIDTH = 1540;
  const DESIGN_HEIGHT = 660;
  const root = document.documentElement;
  const slots = [...document.querySelectorAll('.game-slot')];
  const hoverCapable = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const timers = new WeakMap();
  const tickets = new WeakMap();

  const canPreview = (slot = null) => document.body.dataset.launcherEntryStage === 'gallery'
    && hoverCapable.matches
    && !reduceMotion.matches
    && !slot?.classList.contains('is-unavailable');

  function updateLauncherScale() {
    const width = root.clientWidth || window.innerWidth;
    const height = root.clientHeight || window.innerHeight;
    const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
    const safeScale = Math.max(scale, 0.01);
    const x = (width - DESIGN_WIDTH * safeScale) / 2;
    const y = (height - DESIGN_HEIGHT * safeScale) / 2;

    root.style.setProperty('--launcher-scale', String(safeScale));
    root.style.setProperty('--launcher-x', `${x}px`);
    root.style.setProperty('--launcher-y', `${y}px`);
  }

  updateLauncherScale();
  window.addEventListener('resize', updateLauncherScale, { passive: true });
  window.addEventListener('orientationchange', updateLauncherScale, { passive: true });
  window.visualViewport?.addEventListener('resize', updateLauncherScale, { passive: true });
  window.visualViewport?.addEventListener('scroll', updateLauncherScale, { passive: true });
  if ('ResizeObserver' in window) {
    new ResizeObserver(updateLauncherScale).observe(root);
  }

  function parsePreviewQuad(slot) {
    const points = String(slot.dataset.previewQuad || '')
      .trim()
      .split(/\s+/)
      .map((point) => point.split(',').map(Number));
    return points.length === 4 && points.every((point) => point.length === 2 && point.every(Number.isFinite))
      ? points
      : null;
  }

  function buildPerspectiveMatrix(width, height, percentQuad) {
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = percentQuad.map(([x, y]) => [
      x * width / 100,
      y * height / 100
    ]);
    const dx1 = x1 - x2;
    const dx2 = x3 - x2;
    const sx = x0 - x1 + x2 - x3;
    const dy1 = y1 - y2;
    const dy2 = y3 - y2;
    const sy = y0 - y1 + y2 - y3;
    const denominator = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(denominator) < 0.000001) return null;

    const projectX = (sx * dy2 - dx2 * sy) / denominator;
    const projectY = (dx1 * sy - sx * dy1) / denominator;
    const a = (x1 - x0 + projectX * x1) / width;
    const b = (x3 - x0 + projectY * x3) / height;
    const d = (y1 - y0 + projectX * y1) / width;
    const e = (y3 - y0 + projectY * y3) / height;
    const g = projectX / width;
    const h = projectY / height;
    const clean = (value) => Number(value.toFixed(12));

    return `matrix3d(${[
      a, d, 0, g,
      b, e, 0, h,
      0, 0, 1, 0,
      x0, y0, 0, 1
    ].map(clean).join(',')})`;
  }

  function updatePreviewWarp(slot) {
    const front = slot.querySelector('.box-front');
    const quad = parsePreviewQuad(slot);
    const width = front?.clientWidth || 0;
    const height = front?.clientHeight || 0;
    if (!quad || !width || !height) return;
    const matrix = buildPerspectiveMatrix(width, height, quad);
    if (matrix) slot.style.setProperty('--preview-warp', matrix);
  }

  function bindVideoFallback(slot, video) {
    video.addEventListener('error', () => {
      video.dataset.failed = '1';
      stopPreview(slot);
    });
  }

  function clearTimer(slot) {
    const timer = timers.get(slot);
    if (timer) window.clearTimeout(timer);
    timers.delete(slot);
  }

  function stopPreview(slot) {
    clearTimer(slot);
    tickets.set(slot, (tickets.get(slot) || 0) + 1);
    slot.classList.remove('is-preview-playing');

    const video = slot.querySelector('.box-preview');
    if (!video) return;
    video.pause();
    try {
      video.currentTime = 0;
    } catch (_) {
      // 尚未載入 metadata 時 currentTime 可能不可寫；封面仍會正常顯示。
    }
    if (video.hasAttribute('src')) {
      const cleanVideo = video.cloneNode(false);
      cleanVideo.removeAttribute('src');
      video.replaceWith(cleanVideo);
      bindVideoFallback(slot, cleanVideo);
    }
  }

  async function startPreview(slot) {
    if (!canPreview(slot)) return;

    slots.forEach((other) => {
      if (other !== slot) stopPreview(other);
    });

    const video = slot.querySelector('.box-preview');
    if (!video || video.dataset.failed === '1') return;

    const ticket = (tickets.get(slot) || 0) + 1;
    tickets.set(slot, ticket);

    if (!video.hasAttribute('src')) {
      video.src = video.dataset.src;
      video.load();
    }

    try {
      video.currentTime = 0;
      await video.play();
      if (tickets.get(slot) !== ticket || !canPreview(slot)) {
        video.pause();
        return;
      }
      slot.classList.add('is-preview-playing');
    } catch (_) {
      slot.classList.remove('is-preview-playing');
    }
  }

  function schedulePreview(slot) {
    if (!canPreview(slot)) return;
    clearTimer(slot);
    timers.set(slot, window.setTimeout(() => startPreview(slot), 160));
  }

  slots.forEach((slot) => {
    const pick = slot.querySelector('.game-pick');
    const video = slot.querySelector('.box-preview');
    if (!pick) return;

    pick.addEventListener('click', (event) => {
      if (slot.classList.contains('is-unavailable')) event.preventDefault();
    });
    if (!video) return;

    pick.addEventListener('pointerenter', () => schedulePreview(slot));
    pick.addEventListener('pointerleave', () => stopPreview(slot));
    pick.addEventListener('focusin', () => schedulePreview(slot));
    pick.addEventListener('focusout', () => {
      window.setTimeout(() => {
        if (!pick.matches(':focus-within')) stopPreview(slot);
      }, 0);
    });

    bindVideoFallback(slot, video);
    updatePreviewWarp(slot);
  });

  if ('ResizeObserver' in window) {
    const warpObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const slot = entry.target.closest('.game-slot');
        if (slot) updatePreviewWarp(slot);
      });
    });
    slots.forEach((slot) => {
      const front = slot.querySelector('.box-front');
      if (front) warpObserver.observe(front);
    });
  } else {
    window.addEventListener('resize', () => slots.forEach(updatePreviewWarp));
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) slots.forEach(stopPreview);
  });

  const stopAll = () => slots.forEach(stopPreview);
  hoverCapable.addEventListener?.('change', stopAll);
  reduceMotion.addEventListener?.('change', stopAll);
  window.addEventListener('pagehide', stopAll);

  document.addEventListener('launcher-entry-locked', stopAll);

  function readEntryStorage(key, fallback = '') {
    try {
      return localStorage.getItem(key) || fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeEntryStorage(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch (_) {
      // 無痕模式或停用儲存時仍可完成單次登入。
    }
  }

  function removeEntryStorage(key) {
    try {
      localStorage.removeItem(key);
    } catch (_) {
      // 儲存空間不可用時無需阻斷啟動流程。
    }
  }

  function getEntryDeviceId() {
    let value = String(readEntryStorage('op_device_id', '') || '').trim();
    if (value) return value;
    try {
      const bytes = new Uint8Array(12);
      if (!window.crypto || typeof window.crypto.getRandomValues !== 'function') throw new Error('secure random unavailable');
      window.crypto.getRandomValues(bytes);
      value = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    } catch (_) {
      // 下方會建立不含帳密的舊瀏覽器備援識別碼。
    }
    if (!value) value = `launcher-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e8).toString(36)}`;
    writeEntryStorage('op_device_id', value);
    return value;
  }

  function clearEntrySecret() {
    removeEntryStorage('opSecret');
    removeEntryStorage('op_secret');
    removeEntryStorage('op_user_id');
    removeEntryStorage('op_board_user_id');
  }

  function entryEmit(socket, eventName, payload, timeoutMs = 12000) {
    return new Promise((resolve) => {
      if (!socket) {
        resolve({ ok: false, error: 'socket unavailable' });
        return;
      }
      try {
        socket.timeout(timeoutMs).emit(eventName, payload, (error, result = {}) => {
          if (error) {
            resolve({ ok: false, error: 'timeout' });
            return;
          }
          resolve(result || { ok: false, error: 'unknown' });
        });
      } catch (error) {
        resolve({ ok: false, error: String(error?.message || error || 'socket error') });
      }
    });
  }

  function normalizeEntryProfile(cloudProfile, usernameHint = '') {
    const profile = cloudProfile && typeof cloudProfile === 'object' ? cloudProfile : {};
    const client = profile.stats?.client && typeof profile.stats.client === 'object' ? profile.stats.client : {};
    const userId = Math.max(0, Number(profile.user_id ?? profile.userId ?? 0) || 0);
    const fallbackName = String(
      usernameHint
      || readEntryStorage('op_name', '')
      || readEntryStorage('op_player_name', '')
      || (userId ? `玩家${String(userId).slice(-4)}` : '')
    ).trim();
    const name = String(profile.name || '').trim() || fallbackName;
    const avatar = Math.max(1, Math.min(2000, Number(profile.avatar || readEntryStorage('op_avatar', '') || 8) || 8));
    const title = String(client.titles?.equipped || readEntryStorage('op_board_title', '') || '偉大航道航海者').trim() || '偉大航道航海者';
    const coins = Math.max(0, Number(client.totals?.coins ?? readEntryStorage('op_board_coins', '') ?? 0) || 0);
    return { userId, name, avatar, title, coins };
  }

  function persistEntryProfile(secret, cloudProfile, usernameHint = '') {
    const normalizedSecret = String(secret || '').trim();
    const normalized = normalizeEntryProfile(cloudProfile, usernameHint);
    if (!normalizedSecret || !normalized.userId) return null;
    writeEntryStorage('opSecret', normalizedSecret);
    writeEntryStorage('op_secret', normalizedSecret);
    writeEntryStorage('op_user_id', normalized.userId);
    writeEntryStorage('op_board_user_id', normalized.userId);
    writeEntryStorage('op_name', normalized.name);
    writeEntryStorage('op_player_name', normalized.name);
    writeEntryStorage('op_avatar', normalized.avatar);
    writeEntryStorage('op_player_avatar', normalized.avatar);
    writeEntryStorage('op_board_title', normalized.title);
    writeEntryStorage('op_board_coins', normalized.coins);
    if (usernameHint) writeEntryStorage('op_last_username', usernameHint);
    return normalized;
  }

  function translateEntryAuthError(error) {
    const code = String(error || '').trim();
    const messages = {
      'missing credentials': '請輸入帳號與密碼。',
      'invalid username/password': '帳號或密碼不正確。',
      'username length 3~24': '帳號長度必須是 3～24 字。',
      'username only a-z 0-9 _': '帳號只能使用英文字母、數字與底線。',
      'password length 6~72': '密碼長度必須是 6～72 字。',
      'username taken': '這個帳號已經有人使用。',
      'already_logged_in': '此帳號目前正在其他裝置使用。',
      timeout: '伺服器沒有回應，請確認網路後重試。',
      'socket unavailable': '登入元件尚未連線，請重新整理後再試。',
      'bad secret': '登入已失效，請重新輸入帳號與密碼。',
    };
    return messages[code] || '登入失敗，請稍後再試。';
  }

  async function resolveEntryRuntime(timeoutMs = 8000) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId = window.setTimeout(() => controller?.abort(), timeoutMs);
    try {
      const response = await fetch('/api/board-runtime', {
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller?.signal,
      });
      if (!response.ok) return null;
      const runtime = await response.json();
      return runtime?.ok === true && typeof runtime.accountDatabaseEnabled === 'boolean' ? runtime : null;
    } catch (_) {
      return null;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function runLauncherEntryGate() {
    const layer = document.getElementById('launcherEntry');
    const gallery = document.querySelector('.launcher-stage');
    const panels = [...document.querySelectorAll('[data-launcher-entry-panel]')];
    const startButton = document.getElementById('launcherEntryStartBtn');
    const authForm = document.getElementById('launcherAuthForm');
    const usernameInput = document.getElementById('launcherAuthUsername');
    const passwordInput = document.getElementById('launcherAuthPassword');
    const authTitle = document.getElementById('launcherAuthTitle');
    const authMessage = document.getElementById('launcherAuthMessage');
    const authSubmit = document.getElementById('launcherAuthSubmitBtn');
    const loginTab = document.getElementById('launcherAuthLoginTab');
    const registerTab = document.getElementById('launcherAuthRegisterTab');
    const authBack = document.getElementById('launcherAuthBackBtn');
    const bootMessage = document.getElementById('launcherBootMessage');
    const bootActions = document.getElementById('launcherBootActions');
    const bootRetry = document.getElementById('launcherBootRetryBtn');
    const bootLogin = document.getElementById('launcherBootLoginBtn');

    if (!layer || !gallery || !startButton || !authForm) {
      document.body.dataset.launcherEntryStage = 'gallery';
      gallery?.removeAttribute('inert');
      gallery?.setAttribute('aria-hidden', 'false');
      return Promise.resolve({ ready: true, socket: null, profile: null });
    }

    // 舊卡牌入口曾把明文密碼留在瀏覽器；三合一入口只保留帳號名稱與 secret。
    removeEntryStorage('op_last_password');

    let runtimePromise = resolveEntryRuntime();
    const query = new URLSearchParams(location.search);
    let runtimeResolved = false;
    let localPreviewAuth = false;
    let accountDatabaseEnabled = null;
    let stage = 'press';
    let mode = 'login';
    let entrySocket = null;
    let promiseResolved = false;
    let retryAction = null;
    let resolveGate = null;
    let operationEpoch = 0;
    let authPending = false;

    const debugState = {
      stage,
      authSource: 'pending',
      accountDatabaseEnabled,
      userId: 0,
      localPreview: false,
    };
    window.__GAME_LAUNCHER_ENTRY_DEBUG__ = debugState;

    const setGalleryLocked = (locked) => {
      gallery.setAttribute('aria-hidden', String(locked));
      if (locked) {
        gallery.setAttribute('inert', '');
        document.dispatchEvent(new Event('launcher-entry-locked'));
      } else {
        gallery.removeAttribute('inert');
      }
    };

    const setStage = (nextStage) => {
      stage = nextStage;
      debugState.stage = nextStage;
      document.body.dataset.launcherEntryStage = nextStage;
      panels.forEach((panel) => {
        const active = panel.dataset.launcherEntryPanel === nextStage;
        panel.hidden = !active;
        panel.classList.toggle('is-active', active);
      });
      const galleryVisible = nextStage === 'gallery';
      layer.setAttribute('aria-hidden', String(galleryVisible));
      setGalleryLocked(!galleryVisible);
      if (nextStage === 'auth') window.setTimeout(() => usernameInput?.focus(), 45);
    };

    const configureRuntime = (runtime) => {
      if (runtimeResolved) return;
      runtimeResolved = true;
      accountDatabaseEnabled = runtime?.accountDatabaseEnabled ?? null;
      const host = String(location.hostname || '').toLowerCase();
      const loopback = ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host);
      localPreviewAuth = runtime?.ok === true && runtime.accountDatabaseEnabled === false && loopback;
      document.querySelectorAll('[data-local-only-game]').forEach((slot) => {
        const pick = slot.querySelector('.game-pick');
        if (!pick) return;
        const localHref = String(pick.dataset.localHref || '').trim();
        const localGameAvailable = localPreviewAuth && Boolean(localHref);
        slot.classList.toggle('is-unavailable', !localGameAvailable);
        if (localGameAvailable) {
          pick.setAttribute('href', localHref);
          pick.setAttribute('aria-disabled', 'false');
          pick.setAttribute('aria-label', '開啟 ONE PIECE 霸海戰棋');
          pick.setAttribute('tabindex', '0');
          pick.setAttribute('title', '開啟霸海戰棋');
        } else {
          pick.removeAttribute('href');
          pick.setAttribute('aria-disabled', 'true');
          pick.setAttribute('aria-label', 'ONE PIECE 霸海戰棋尚未開放');
          pick.setAttribute('tabindex', '-1');
          pick.setAttribute('title', '霸海戰棋製作中');
        }
      });
      debugState.accountDatabaseEnabled = accountDatabaseEnabled;
      debugState.localPreview = localPreviewAuth;
      debugState.authSource = localPreviewAuth ? 'local-preview' : 'same-origin';
      document.body.dataset.launcherAuthSource = debugState.authSource;
      if (registerTab) registerTab.hidden = localPreviewAuth;
      authForm.noValidate = localPreviewAuth;
      if (usernameInput) usernameInput.required = !localPreviewAuth;
      if (passwordInput) passwordInput.required = !localPreviewAuth;
    };

    const getRuntime = async () => {
      const runtime = await runtimePromise;
      configureRuntime(runtime);
      return runtime;
    };

    const setMode = (nextMode) => {
      mode = nextMode === 'register' && !localPreviewAuth ? 'register' : 'login';
      const registering = mode === 'register';
      loginTab?.classList.toggle('is-active', !registering);
      registerTab?.classList.toggle('is-active', registering);
      loginTab?.setAttribute('aria-selected', String(!registering));
      registerTab?.setAttribute('aria-selected', String(registering));
      if (authTitle) authTitle.textContent = registering ? '建立航海者帳號' : '航海者登入';
      if (authSubmit) authSubmit.textContent = registering ? '建立帳號' : '登入';
      if (passwordInput) passwordInput.autocomplete = registering ? 'new-password' : 'current-password';
      if (authMessage) {
        authMessage.textContent = localPreviewAuth
          ? '本機預覽模式：帳號與密碼可留白，直接按登入。'
          : '';
      }
    };

    const setAuthBusy = (busy) => {
      authPending = Boolean(busy);
      const registering = mode === 'register';
      if (authSubmit) {
        authSubmit.disabled = authPending;
        authSubmit.textContent = authPending
          ? (registering ? '建立中…' : '登入中…')
          : (registering ? '建立帳號' : '登入');
      }
      [loginTab, registerTab, authBack, usernameInput, passwordInput].forEach((element) => {
        if (element) element.disabled = authPending;
      });
    };

    const disposeSocket = () => {
      if (!entrySocket) return;
      try { entrySocket.disconnect(); } catch (_) {}
      entrySocket = null;
    };

    const ensureSocket = () => {
      if (entrySocket?.connected || entrySocket?.active) return entrySocket;
      disposeSocket();
      if (typeof window.io !== 'function') return null;
      entrySocket = window.io({ transports: ['websocket', 'polling'] });
      entrySocket.on('SESSION_KICK', (info = {}) => {
        operationEpoch += 1;
        clearEntrySecret();
        disposeSocket();
        if (passwordInput) passwordInput.value = '';
        setMode('login');
        setAuthBusy(false);
        setStage('auth');
        if (authMessage) {
          authMessage.textContent = info?.reason === 'takeover'
            ? '此帳號已在另一台裝置登入，請重新登入。'
            : '登入已中止，請重新登入。';
        }
      });
      return entrySocket;
    };

    const showBootFailure = (message, retry) => {
      retryAction = retry;
      setStage('boot');
      if (bootMessage) bootMessage.textContent = message;
      if (bootActions) bootActions.hidden = false;
    };

    const showAuth = (message = '') => {
      setMode('login');
      setAuthBusy(false);
      setStage('auth');
      if (authMessage && message) authMessage.textContent = message;
    };

    const finish = (profile = null) => {
      setAuthBusy(false);
      debugState.userId = Number(profile?.userId || 0) || 0;
      setStage('gallery');
      if (!promiseResolved) {
        promiseResolved = true;
        resolveGate?.({ ready: true, socket: entrySocket, profile });
      }
    };

    const validateSecret = async (secret, usernameHint = '', token = ++operationEpoch) => {
      if (token !== operationEpoch) return;
      const normalizedSecret = String(secret || '').trim();
      if (!normalizedSecret) {
        showAuth();
        return;
      }
      setStage('boot');
      if (bootMessage) bootMessage.textContent = '正在驗證雲端玩家帳號…';
      if (bootActions) bootActions.hidden = true;
      const socket = ensureSocket();
      if (!socket) {
        showBootFailure('登入元件載入失敗，請重新整理頁面。', () => location.reload());
        return;
      }
      const result = await entryEmit(socket, 'PROFILE_GET', { secret: normalizedSecret });
      if (token !== operationEpoch) return;
      if (!result?.ok) {
        showBootFailure(translateEntryAuthError(result?.error), () => validateSecret(normalizedSecret, usernameHint));
        return;
      }
      if (!result.profile) {
        clearEntrySecret();
        showAuth('登入已失效，請重新輸入帳號與密碼。');
        return;
      }
      const normalized = persistEntryProfile(normalizedSecret, result.profile, usernameHint);
      if (!normalized) {
        showBootFailure('帳號資料不完整，請改用其他帳號。', () => validateSecret(normalizedSecret, usernameHint));
        return;
      }
      const presence = await entryEmit(socket, 'PRESENCE_SET', {
        secret: normalizedSecret,
        page: 'launcher',
        deviceId: getEntryDeviceId(),
      }, 10000);
      if (token !== operationEpoch) return;
      if (!presence?.ok) {
        showBootFailure(translateEntryAuthError(presence?.error), () => validateSecret(normalizedSecret, usernameHint));
        return;
      }
      finish(normalized);
    };

    const begin = async () => {
      if (stage !== 'press') return;
      const token = ++operationEpoch;
      setStage('boot');
      if (bootMessage) bootMessage.textContent = '正在準備桌遊收藏室…';
      if (bootActions) bootActions.hidden = true;
      const runtime = await getRuntime();
      if (token !== operationEpoch) return;
      if (!runtime) {
        showBootFailure('無法確認帳號伺服器狀態，請檢查連線後重試。', beginFromBoot);
        return;
      }
      if (localPreviewAuth) {
        showAuth('本機預覽模式：帳號與密碼可留白，直接按登入。');
        return;
      }
      if (runtime.accountDatabaseEnabled !== true) {
        showBootFailure('目前來源沒有連接帳號資料庫，無法安全登入。', beginFromBoot);
        return;
      }
      const storedSecret = String(readEntryStorage('opSecret', '') || readEntryStorage('op_secret', '') || '').trim();
      if (storedSecret) {
        await validateSecret(storedSecret, readEntryStorage('op_last_username', ''), token);
        return;
      }
      showAuth();
    };

    const beginFromBoot = () => {
      runtimeResolved = false;
      runtimePromise = resolveEntryRuntime();
      setStage('press');
      void begin();
    };

    function handlePressKey(event) {
      const browserShortcut = event.ctrlKey || event.metaKey || event.altKey || /^F\d{1,2}$/i.test(event.key);
      if (stage !== 'press' || event.repeat || browserShortcut || ['Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
      event.preventDefault();
      void begin();
    }

    startButton.addEventListener('click', () => void begin());
    document.addEventListener('keydown', handlePressKey);
    loginTab?.addEventListener('click', () => setMode('login'));
    registerTab?.addEventListener('click', () => setMode('register'));
    authBack?.addEventListener('click', () => {
      operationEpoch += 1;
      setAuthBusy(false);
      if (passwordInput) passwordInput.value = '';
      if (authMessage) authMessage.textContent = '';
      setStage('press');
    });
    bootRetry?.addEventListener('click', () => {
      if (bootActions) bootActions.hidden = true;
      retryAction?.();
    });
    bootLogin?.addEventListener('click', () => {
      operationEpoch += 1;
      clearEntrySecret();
      if (passwordInput) passwordInput.value = '';
      showAuth();
    });
    authForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (authPending) return;
      const token = ++operationEpoch;
      const submitMode = mode;
      const username = String(usernameInput?.value || '').trim().toLowerCase();
      const password = String(passwordInput?.value || '');
      if (passwordInput) passwordInput.value = '';
      setAuthBusy(true);
      const runtime = await getRuntime();
      if (token !== operationEpoch) return;

      if (localPreviewAuth && submitMode === 'login') {
        const previewName = username
          || String(readEntryStorage('op_last_username', '')).trim()
          || String(readEntryStorage('op_name', '')).trim()
          || '本機測試玩家';
        let previewUserId = 700000;
        for (const character of previewName) {
          previewUserId = ((previewUserId * 31) + character.codePointAt(0)) % 900000000;
        }
        previewUserId = Math.max(700000, previewUserId);
        clearEntrySecret();
        writeEntryStorage('op_last_username', previewName);
        writeEntryStorage('op_user_id', previewUserId);
        writeEntryStorage('op_board_user_id', previewUserId);
        writeEntryStorage('op_name', previewName);
        writeEntryStorage('op_player_name', previewName);
        if (!readEntryStorage('op_avatar', '')) writeEntryStorage('op_avatar', 8);
        if (!readEntryStorage('op_player_avatar', '')) writeEntryStorage('op_player_avatar', readEntryStorage('op_avatar', '8'));
        if (!readEntryStorage('op_board_title', '')) writeEntryStorage('op_board_title', '本機桌遊測試');
        finish({
          userId: previewUserId,
          name: previewName,
          avatar: Number(readEntryStorage('op_avatar', '8')) || 8,
          localPreview: true,
        });
        return;
      }

      if (!runtime || runtime.accountDatabaseEnabled !== true) {
        setAuthBusy(false);
        if (authMessage) authMessage.textContent = '帳號伺服器目前無法使用，請稍後重試。';
        return;
      }
      if (!username || !password) {
        setAuthBusy(false);
        if (authMessage) authMessage.textContent = '請輸入帳號與密碼。';
        return;
      }
      if (!/^[a-z0-9_]{3,24}$/.test(username)) {
        setAuthBusy(false);
        if (authMessage) authMessage.textContent = '帳號需為 3～24 字，只能使用英文、數字與底線。';
        return;
      }
      if (password.length < 6 || password.length > 72) {
        setAuthBusy(false);
        if (authMessage) authMessage.textContent = '密碼長度必須是 6～72 字。';
        return;
      }

      const socket = ensureSocket();
      if (!socket) {
        setAuthBusy(false);
        if (authMessage) authMessage.textContent = '登入元件載入失敗，請重新整理後再試。';
        return;
      }
      if (authMessage) authMessage.textContent = '';
      const eventName = submitMode === 'register' ? 'AUTH_REGISTER' : 'AUTH_LOGIN';
      const result = await entryEmit(socket, eventName, { username, password, deviceId: getEntryDeviceId() });
      if (token !== operationEpoch) return;
      if (!result?.ok || !result.secret) {
        setAuthBusy(false);
        if (authMessage) authMessage.textContent = translateEntryAuthError(result?.error);
        return;
      }
      writeEntryStorage('op_last_username', username);
      await validateSecret(result.secret, username, token);
    });

    const savedUsername = readEntryStorage('op_last_username', '');
    if (usernameInput && savedUsername) usernameInput.value = savedUsername;
    setMode('login');
    setStage('press');

    if (query.get('kicked') === '1') {
      clearEntrySecret();
      window.setTimeout(async () => {
        await getRuntime();
        showAuth(localPreviewAuth
          ? '本機預覽模式：帳號與密碼可留白，直接按登入。'
          : '此帳號已在其他裝置登入，請重新登入後繼續。');
      }, 0);
    }

    return new Promise((resolve) => {
      resolveGate = resolve;
    });
  }
})();
