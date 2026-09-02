(async function () {
  const shared = window.BoardShared;
  if (!shared) return;

  const query = new URLSearchParams(location.search);
  const entrySession = await runBoardEntryGate(query);
  if (!entrySession?.ready) return;

  function readEntryStorage(key, fallback = "") {
    try {
      return localStorage.getItem(key) || fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeEntryStorage(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch (_) {}
  }

  function getEntryDeviceId() {
    let value = String(readEntryStorage("op_device_id", "") || "").trim();
    if (value) return value;
    try {
      const buffer = new Uint8Array(12);
      window.crypto?.getRandomValues?.(buffer);
      value = Array.from(buffer).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    } catch (_) {}
    if (!value) value = `board-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e8).toString(36)}`;
    writeEntryStorage("op_device_id", value);
    return value;
  }

  function clearEntrySecret() {
    try {
      localStorage.removeItem("opSecret");
      localStorage.removeItem("op_secret");
      localStorage.removeItem("op_user_id");
    } catch (_) {}
  }

  function entryEmit(socket, eventName, payload, timeoutMs = 12000) {
    return new Promise((resolve) => {
      if (!socket) {
        resolve({ ok: false, error: "socket unavailable" });
        return;
      }
      try {
        socket.timeout(timeoutMs).emit(eventName, payload, (error, result = {}) => {
          if (error) {
            resolve({ ok: false, error: "timeout" });
            return;
          }
          resolve(result || { ok: false, error: "unknown" });
        });
      } catch (error) {
        resolve({ ok: false, error: String(error?.message || error || "socket error") });
      }
    });
  }

  function normalizeEntryProfile(cloudProfile, usernameHint = "") {
    const profile = cloudProfile && typeof cloudProfile === "object" ? cloudProfile : {};
    const client = profile.stats?.client && typeof profile.stats.client === "object" ? profile.stats.client : {};
    const userId = Math.max(0, Number(profile.user_id ?? profile.userId ?? 0) || 0);
    const fallbackName = String(
      usernameHint
      || readEntryStorage("op_name", "")
      || readEntryStorage("op_player_name", "")
      || (userId ? `玩家${String(userId).slice(-4)}` : "")
    ).trim();
    const name = String(profile.name || "").trim() || fallbackName;
    const avatar = Math.max(1, Math.min(2000, Number(profile.avatar || readEntryStorage("op_avatar", "") || 8) || 8));
    const title = String(client.titles?.equipped || readEntryStorage("op_board_title", "") || "新世界啟航者").trim() || "新世界啟航者";
    const coins = Math.max(0, Number(client.totals?.coins ?? readEntryStorage("op_board_coins", "") ?? 0) || 0);
    return { userId, name, avatar, title, coins };
  }

  function persistEntryProfile(secret, cloudProfile, usernameHint = "") {
    const normalized = normalizeEntryProfile(cloudProfile, usernameHint);
    if (!normalized.userId || !String(secret || "").trim()) return null;
    writeEntryStorage("opSecret", String(secret).trim());
    writeEntryStorage("op_secret", String(secret).trim());
    writeEntryStorage("op_user_id", normalized.userId);
    writeEntryStorage("op_board_user_id", normalized.userId);
    writeEntryStorage("op_name", normalized.name);
    writeEntryStorage("op_player_name", normalized.name);
    writeEntryStorage("op_avatar", normalized.avatar);
    writeEntryStorage("op_player_avatar", normalized.avatar);
    writeEntryStorage("op_board_title", normalized.title);
    writeEntryStorage("op_board_coins", normalized.coins);
    if (usernameHint) writeEntryStorage("op_last_username", usernameHint);
    return normalized;
  }

  function translateEntryAuthError(error) {
    const code = String(error || "").trim();
    const messages = {
      "missing credentials": "請輸入帳號與密碼。",
      "invalid username/password": "帳號或密碼不正確。",
      "username length 3~24": "帳號長度必須是 3～24 字。",
      "username only a-z 0-9 _": "帳號只能使用英文字母、數字與底線。",
      "password length 6~72": "密碼長度必須是 6～72 字。",
      "username taken": "這個帳號已經有人使用。",
      "already_logged_in": "此帳號目前正在其他裝置使用。",
      "timeout": "伺服器沒有回應，請確認網路後重試。",
      "socket unavailable": "登入元件尚未連線，請重新整理後再試。",
    };
    return messages[code] || (code ? `登入失敗：${code}` : "登入失敗，請稍後再試。");
  }

  async function resolveEntryRuntime() {
    try {
      const response = await fetch("/api/board-runtime", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (_) {
      return null;
    }
  }

  async function runBoardEntryGate(searchParams) {
    const layer = document.getElementById("boardEntry");
    const panels = Array.from(document.querySelectorAll("[data-entry-panel]"));
    const startButton = document.getElementById("boardEntryStartBtn");
    const authForm = document.getElementById("boardAuthForm");
    const usernameInput = document.getElementById("boardAuthUsername");
    const passwordInput = document.getElementById("boardAuthPassword");
    const authTitle = document.getElementById("boardAuthTitle");
    const authMessage = document.getElementById("boardAuthMessage");
    const authSubmit = document.getElementById("boardAuthSubmitBtn");
    const loginTab = document.getElementById("boardAuthLoginTab");
    const registerTab = document.getElementById("boardAuthRegisterTab");
    const authBack = document.getElementById("boardAuthBackBtn");
    const bootMessage = document.getElementById("boardBootMessage");
    const bootActions = document.getElementById("boardBootActions");
    const bootRetry = document.getElementById("boardBootRetryBtn");
    const bootLogin = document.getElementById("boardBootLoginBtn");

    if (!layer || !startButton || !authForm) {
      document.body.dataset.entryStage = "app";
      return Promise.resolve({ ready: true, socket: null });
    }

    const entryRuntime = await resolveEntryRuntime();
    const localPreviewAuth = entryRuntime?.accountDatabaseEnabled === false
      && ["127.0.0.1", "localhost", "::1"].includes(location.hostname);
    const entryAuthOrigin = "";
    document.body.dataset.entryAuthSource = localPreviewAuth ? "local-preview" : "same-origin";
    if (localPreviewAuth) {
      if (registerTab) registerTab.hidden = true;
      authForm.noValidate = true;
      if (usernameInput) usernameInput.required = false;
      if (passwordInput) passwordInput.required = false;
    }

    let stage = "press";
    let mode = "login";
    let entrySocket = null;
    let resolved = false;
    let retryAction = null;

    const setStage = (nextStage) => {
      stage = nextStage;
      document.body.dataset.entryStage = nextStage;
      panels.forEach((panel) => {
        const active = panel.dataset.entryPanel === nextStage;
        panel.hidden = !active;
        panel.classList.toggle("is-active", active);
      });
      if (nextStage === "auth") window.setTimeout(() => usernameInput?.focus(), 40);
    };

    const setMode = (nextMode) => {
      mode = nextMode === "register" ? "register" : "login";
      const registering = mode === "register";
      loginTab?.classList.toggle("is-active", !registering);
      registerTab?.classList.toggle("is-active", registering);
      loginTab?.setAttribute("aria-selected", String(!registering));
      registerTab?.setAttribute("aria-selected", String(registering));
      if (authTitle) authTitle.textContent = registering ? "建立帳號" : "帳號登入";
      if (authSubmit) authSubmit.textContent = registering ? "建立帳號" : "登入";
      if (passwordInput) passwordInput.autocomplete = registering ? "new-password" : "current-password";
      if (authMessage) authMessage.textContent = "";
    };

    const ensureSocket = () => {
      if (entrySocket) return entrySocket;
      if (typeof window.io !== "function") return null;
      const options = { transports: ["websocket", "polling"] };
      entrySocket = entryAuthOrigin ? window.io(entryAuthOrigin, options) : window.io(options);
      return entrySocket;
    };

    const showBootFailure = (message, retry) => {
      retryAction = retry;
      setStage("boot");
      if (bootMessage) bootMessage.textContent = message;
      if (bootActions) bootActions.hidden = false;
    };

    return new Promise((resolve) => {
      const finish = (profile) => {
        if (resolved) return;
        resolved = true;
        document.removeEventListener("keydown", handlePressKey);
        document.body.dataset.entryStage = "app";
        layer.setAttribute("aria-hidden", "true");
        const appSocket = entryAuthOrigin ? null : entrySocket;
        if (entryAuthOrigin && entrySocket) {
          try { entrySocket.disconnect(); } catch (_) {}
          entrySocket = null;
        }
        resolve({ ready: true, socket: appSocket, profile });
      };

      const validateSecret = async (secret, usernameHint = "") => {
        const normalizedSecret = String(secret || "").trim();
        if (!normalizedSecret) {
          setStage("auth");
          return;
        }
        setStage("boot");
        if (bootMessage) bootMessage.textContent = "正在驗證雲端玩家帳號…";
        if (bootActions) bootActions.hidden = true;
        const socket = ensureSocket();
        if (!socket) {
          showBootFailure("登入元件載入失敗，請重新整理頁面。", () => location.reload());
          return;
        }
        const result = await entryEmit(socket, "PROFILE_GET", { secret: normalizedSecret }, 12000);
        if (!result?.ok) {
          showBootFailure(translateEntryAuthError(result?.error), () => validateSecret(normalizedSecret, usernameHint));
          return;
        }
        if (!result.profile) {
          clearEntrySecret();
          setStage("auth");
          if (authMessage) authMessage.textContent = "登入已失效，請重新輸入帳號與密碼。";
          return;
        }
        const normalized = persistEntryProfile(normalizedSecret, result.profile, usernameHint);
        if (!normalized) {
          showBootFailure("帳號資料不完整，請重新登入後再試。", () => validateSecret(normalizedSecret, usernameHint));
          return;
        }
        finish(normalized);
      };

      const begin = () => {
        if (stage !== "press") return;
        const storedSecret = String(readEntryStorage("opSecret", "") || readEntryStorage("op_secret", "") || "").trim();
        if (storedSecret) {
          void validateSecret(storedSecret, readEntryStorage("op_last_username", ""));
          return;
        }
        setStage("auth");
      };

      function handlePressKey(event) {
        if (stage !== "press" || ["Tab", "Shift", "Control", "Alt", "Meta"].includes(event.key)) return;
        event.preventDefault();
        begin();
      }

      startButton.addEventListener("click", begin);
      document.addEventListener("keydown", handlePressKey);
      loginTab?.addEventListener("click", () => setMode("login"));
      registerTab?.addEventListener("click", () => setMode("register"));
      authBack?.addEventListener("click", () => {
        if (authMessage) authMessage.textContent = "";
        if (passwordInput) passwordInput.value = "";
        setStage("press");
      });
      bootRetry?.addEventListener("click", () => {
        if (bootActions) bootActions.hidden = true;
        retryAction?.();
      });
      bootLogin?.addEventListener("click", () => {
        clearEntrySecret();
        if (passwordInput) passwordInput.value = "";
        setStage("auth");
      });
      authForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const username = String(usernameInput?.value || "").trim().toLowerCase();
        const password = String(passwordInput?.value || "");
        if (localPreviewAuth && mode === "login") {
          const previewName = username
            || String(readEntryStorage("op_last_username", "")).trim()
            || String(readEntryStorage("op_name", "")).trim()
            || "本機測試玩家";
          let previewUserId = 700000;
          for (const char of previewName) previewUserId = ((previewUserId * 31) + char.codePointAt(0)) % 900000000;
          previewUserId = Math.max(700000, previewUserId);
          clearEntrySecret();
          writeEntryStorage("op_last_username", previewName);
          writeEntryStorage("op_user_id", previewUserId);
          writeEntryStorage("op_board_user_id", previewUserId);
          writeEntryStorage("op_name", previewName);
          writeEntryStorage("op_player_name", previewName);
          if (!readEntryStorage("op_avatar", "")) writeEntryStorage("op_avatar", 8);
          if (!readEntryStorage("op_player_avatar", "")) writeEntryStorage("op_player_avatar", readEntryStorage("op_avatar", "8"));
          if (!readEntryStorage("op_board_title", "")) writeEntryStorage("op_board_title", "本機航海測試");
          if (passwordInput) passwordInput.value = "";
          finish({
            userId: previewUserId,
            name: previewName,
            avatar: Number(readEntryStorage("op_avatar", "8")) || 8,
            title: readEntryStorage("op_board_title", "本機航海測試"),
            coins: Number(readEntryStorage("op_board_coins", "0")) || 0,
          });
          return;
        }
        if (!username || !password) {
          if (authMessage) authMessage.textContent = "請輸入帳號與密碼。";
          return;
        }
        if (!/^[a-z0-9_]{3,24}$/.test(username)) {
          if (authMessage) authMessage.textContent = "帳號需為 3～24 字，只能使用英文、數字與底線。";
          return;
        }
        if (password.length < 6 || password.length > 72) {
          if (authMessage) authMessage.textContent = "密碼長度必須是 6～72 字。";
          return;
        }
        const socket = ensureSocket();
        if (!socket) {
          if (authMessage) authMessage.textContent = "登入元件載入失敗，請重新整理後再試。";
          return;
        }
        if (authSubmit) {
          authSubmit.disabled = true;
          authSubmit.textContent = mode === "register" ? "建立中…" : "登入中…";
        }
        if (authMessage) authMessage.textContent = "";
        const eventName = mode === "register" ? "AUTH_REGISTER" : "AUTH_LOGIN";
        const result = await entryEmit(socket, eventName, { username, password, deviceId: getEntryDeviceId() }, 12000);
        if (authSubmit) {
          authSubmit.disabled = false;
          authSubmit.textContent = mode === "register" ? "建立帳號" : "登入";
        }
        if (!result?.ok || !result.secret) {
          if (authMessage) authMessage.textContent = translateEntryAuthError(result?.error);
          return;
        }
        writeEntryStorage("op_last_username", username);
        writeEntryStorage("opSecret", result.secret);
        writeEntryStorage("op_secret", result.secret);
        if (passwordInput) passwordInput.value = "";
        await validateSecret(result.secret, username);
      });

      const savedUsername = readEntryStorage("op_last_username", "");
      if (usernameInput && savedUsername) usernameInput.value = savedUsername;
      setMode("login");
      setStage("press");

      const directView = String(searchParams.get("view") || "");
      const shouldResumeDirectly = ["game", "lobby", "modeSelect", "campaigns", "social"].includes(directView)
        || searchParams.has("room")
        || searchParams.has("campaign");
      if (searchParams.get("kicked") === "1") {
        clearEntrySecret();
        window.setTimeout(() => {
          setStage("auth");
          if (authMessage) {
            authMessage.textContent = localPreviewAuth
              ? "本機預覽模式：直接按登入即可進入。"
              : "此帳號已在其他裝置登入，請重新登入後繼續。";
          }
        }, 0);
      } else if (shouldResumeDirectly) {
        window.setTimeout(begin, 0);
      }
    });
  }

  const refs = {
    views: Array.from(document.querySelectorAll(".view")),
    playerAvatar: document.getElementById("playerAvatar"),
    playerName: document.getElementById("playerName"),
    playerNameDisplay: document.getElementById("playerNameDisplay"),
    playerTitle: document.getElementById("playerTitle"),
    playerCoin: document.getElementById("playerCoin"),
    accountSourceText: document.getElementById("accountSourceText"),
    openPlayerProfileBtn: document.getElementById("openPlayerProfileBtn"),
    closePlayerProfileBtn: document.getElementById("closePlayerProfileBtn"),
    accountProfileMenu: document.getElementById("accountProfileMenu"),
    accountProfileDescription: document.getElementById("accountProfileDescription"),
    playerProfileMenuHint: document.getElementById("playerProfileMenuHint"),
    linkedAccountNote: document.getElementById("linkedAccountNote"),
    localProfileControls: document.getElementById("localProfileControls"),
    avatarPickerGrid: document.getElementById("avatarPickerGrid"),
    openBoardFlowBtn: document.getElementById("openBoardFlowBtn"),
    openCampaignsBtn: document.getElementById("openCampaignsBtn"),
    campaignMenuHint: document.getElementById("campaignMenuHint"),
    openSocialBtn: document.getElementById("openSocialBtn"),
    socialMenuHint: document.getElementById("socialMenuHint"),
    backToHomeBtn: document.getElementById("backToHomeBtn"),
    backToMainBtn: document.getElementById("backToMainBtn"),
    backFromCampaignsBtn: document.getElementById("backFromCampaignsBtn"),
    backFromSocialBtn: document.getElementById("backFromSocialBtn"),
    openFriendDockBtn: document.getElementById("openFriendDockBtn"),
    refreshSocialBtn: document.getElementById("refreshSocialBtn"),
    socialConnectionText: document.getElementById("socialConnectionText"),
    socialFriendCount: document.getElementById("socialFriendCount"),
    socialOnlineCount: document.getElementById("socialOnlineCount"),
    socialRequestCount: document.getElementById("socialRequestCount"),
    socialUnreadCount: document.getElementById("socialUnreadCount"),
    createBoardRoomBtn: document.getElementById("createBoardRoomBtn"),
    joinBoardRoomBtn: document.getElementById("joinBoardRoomBtn"),
    refreshBoardRoomsBtn: document.getElementById("refreshBoardRoomsBtn"),
    roomCodeInput: document.getElementById("roomCodeInput"),
    toggleBoardRoomsBtn: document.getElementById("toggleBoardRoomsBtn"),
    boardRoomListWrap: document.getElementById("boardRoomListWrap"),
    boardRoomList: document.getElementById("boardRoomList"),
    boardRoomEmpty: document.getElementById("boardRoomEmpty"),
    boardCampaignPanel: document.getElementById("boardCampaignPanel"),
    boardCampaignList: document.getElementById("boardCampaignList"),
    boardCampaignEmpty: document.getElementById("boardCampaignEmpty"),
    campaignAccountHint: document.getElementById("campaignAccountHint"),
    leaveLobbyBtn: document.getElementById("leaveLobbyBtn"),
    boardLobbyRoomName: document.getElementById("boardLobbyRoomName"),
    boardLobbyRoomCode: document.getElementById("boardLobbyRoomCode"),
    boardLobbyPlayerCount: document.getElementById("boardLobbyPlayerCount"),
    boardLobbyPlayerGrid: document.getElementById("boardLobbyPlayerGrid"),
    boardReadyBtn: document.getElementById("boardReadyBtn"),
    boardStartBtn: document.getElementById("boardStartBtn"),
    boardAddCpuBtn: document.getElementById("boardAddCpuBtn"),
    boardLobbyChatBox: document.getElementById("boardLobbyChatBox"),
    boardLobbyChatInput: document.getElementById("boardLobbyChatInput"),
    boardLobbySendChatBtn: document.getElementById("boardLobbySendChatBtn"),
    portableAssetGate: document.getElementById("portableAssetGate"),
    portableAssetGateText: document.getElementById("portableAssetGateText"),
    portableAssetGateBar: document.getElementById("portableAssetGateBar"),
  };

  const localPreviewMode = document.body.dataset.entryAuthSource === "local-preview";

  const initData = shared.init({
    page: "board",
    roomId: "",
    inviteMode: "board",
  });

  let profile = { ...initData.profile };
  const linkedAccountUserId = (() => {
    try {
      const value = Number(localStorage.getItem("op_user_id"));
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (_) {
      return 0;
    }
  })();
  const accountProfileLocked = linkedAccountUserId > 0
    && Boolean(String(readEntryStorage("opSecret", "") || readEntryStorage("op_secret", "")).trim());
  const BOARD_AVATAR_CHOICES = Array.from({ length: 50 }, (_, index) => index + 1);

  const AVATAR_HINTS = {
    "草帽路飛": 8,
    "索隆": 5,
    "娜美": 7,
    "香吉士": 3,
    "羅": 6,
  };
  const CPU_LOBBY_NAMES = ["CPU1", "CPU2", "CPU3"];
  const CPU_LOBBY_AVATARS = [12, 18, 24];
  const PORTABLE_ASSET_MANIFEST_URL = "images/board/mobile/manifest-v397.json";
  const PORTABLE_ASSET_WARMUP_TIMEOUT_MS = 30000;
  const PORTABLE_ASSET_RETRY_TIMEOUT_MS = 15000;
  const PORTABLE_ASSET_WARMUP_CONCURRENCY = 6;

  const state = {
    currentView: "home",
    rooms: shared.getRooms(),
    campaigns: [],
    roomListOpen: false,
    lobby: null,
    online: false,
  };

  const boardSocket = {
    socket: null,
    connected: false,
    retryTimer: 0,
  };
  const portableAssetWarmup = {
    status: "idle",
    version: "",
    total: 0,
    completed: 0,
    failed: 0,
    startedAt: 0,
    finishedAt: 0,
    promise: null,
    retryPromise: null,
    failedUrls: [],
    attempts: 0,
    navigationPending: false,
  };

  function isPortableTouchDevice() {
    return window.matchMedia?.("(pointer: coarse)")?.matches
      || Number(navigator.maxTouchPoints || 0) > 1
      || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || "");
  }

  function portableAssetWarmupSnapshot() {
    return {
      status: portableAssetWarmup.status,
      version: portableAssetWarmup.version,
      total: portableAssetWarmup.total,
      completed: portableAssetWarmup.completed,
      failed: portableAssetWarmup.failed,
      attempts: portableAssetWarmup.attempts,
      startedAt: portableAssetWarmup.startedAt,
      finishedAt: portableAssetWarmup.finishedAt,
    };
  }

  function notifyPortableAssetWarmup() {
    if (portableAssetWarmup.navigationPending && refs.portableAssetGate) {
      const successful = Math.max(0, portableAssetWarmup.completed - portableAssetWarmup.failed);
      const percent = portableAssetWarmup.total
        ? Math.min(100, Math.round((successful / portableAssetWarmup.total) * 100))
        : 0;
      refs.portableAssetGate.hidden = false;
      if (refs.portableAssetGateText) {
        refs.portableAssetGateText.textContent = portableAssetWarmup.total
          ? `${successful} / ${portableAssetWarmup.total}（${percent}%）`
          : "正在讀取素材清單…";
      }
      refs.portableAssetGateBar?.style.setProperty("--portable-progress", `${percent}%`);
    }
    window.dispatchEvent(new CustomEvent("board:portable-assets-progress", {
      detail: portableAssetWarmupSnapshot(),
    }));
  }

  function versionedPortableAssetUrl(source, version) {
    const url = String(source || "").trim();
    if (!url) return "";
    return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}`;
  }

  async function fetchPortableAsset(url, signal) {
    const response = await fetch(url, {
      cache: "force-cache",
      credentials: "same-origin",
      signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    await response.arrayBuffer();
  }

  async function fetchPortableAssetBatch(urls, signal, completedBefore = 0) {
    const failedUrls = [];
    let cursor = 0;
    portableAssetWarmup.completed = Math.max(0, completedBefore);
    portableAssetWarmup.failed = 0;
    const worker = async () => {
      while (cursor < urls.length) {
        const index = cursor;
        cursor += 1;
        try {
          await fetchPortableAsset(urls[index], signal);
        } catch (_) {
          failedUrls.push(urls[index]);
          portableAssetWarmup.failed += 1;
        } finally {
          portableAssetWarmup.completed += 1;
          notifyPortableAssetWarmup();
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(PORTABLE_ASSET_WARMUP_CONCURRENCY, urls.length) }, worker));
    return failedUrls;
  }

  function startPortableAssetWarmup() {
    if (portableAssetWarmup.promise) return portableAssetWarmup.promise;
    if (!isPortableTouchDevice()) {
      portableAssetWarmup.status = "skipped";
      portableAssetWarmup.promise = Promise.resolve(portableAssetWarmupSnapshot());
      notifyPortableAssetWarmup();
      return portableAssetWarmup.promise;
    }
    portableAssetWarmup.status = "loading";
    portableAssetWarmup.startedAt = Date.now();
    portableAssetWarmup.attempts = 1;
    notifyPortableAssetWarmup();
    portableAssetWarmup.promise = (async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), PORTABLE_ASSET_WARMUP_TIMEOUT_MS);
      try {
        const manifestResponse = await fetch(PORTABLE_ASSET_MANIFEST_URL, {
          cache: "force-cache",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!manifestResponse.ok) throw new Error(`HTTP ${manifestResponse.status}: ${PORTABLE_ASSET_MANIFEST_URL}`);
        const manifest = await manifestResponse.json();
        const version = String(manifest?.version || "").trim();
        const sources = [
          ...(Array.isArray(manifest?.assets) ? manifest.assets : []),
          ...(Array.isArray(manifest?.deferredAssets) ? manifest.deferredAssets : []),
        ];
        const urls = Array.from(new Set(sources.map((source) => versionedPortableAssetUrl(source, version)).filter(Boolean)));
        if (!version || !urls.length) throw new Error("portable asset manifest is empty");
        portableAssetWarmup.version = version;
        portableAssetWarmup.total = urls.length;
        notifyPortableAssetWarmup();
        portableAssetWarmup.failedUrls = await fetchPortableAssetBatch(urls, controller.signal);
        portableAssetWarmup.status = portableAssetWarmup.failed ? "partial" : "complete";
      } catch (_) {
        portableAssetWarmup.failedUrls = [];
        portableAssetWarmup.status = "failed";
      } finally {
        window.clearTimeout(timeout);
        portableAssetWarmup.finishedAt = Date.now();
        notifyPortableAssetWarmup();
      }
      return portableAssetWarmupSnapshot();
    })();
    return portableAssetWarmup.promise;
  }

  function retryPortableAssetWarmup() {
    if (portableAssetWarmup.retryPromise) return portableAssetWarmup.retryPromise;
    if (["complete", "skipped"].includes(portableAssetWarmup.status)) {
      return Promise.resolve(portableAssetWarmupSnapshot());
    }
    portableAssetWarmup.retryPromise = (async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), PORTABLE_ASSET_RETRY_TIMEOUT_MS);
      portableAssetWarmup.status = "retrying";
      portableAssetWarmup.attempts += 1;
      notifyPortableAssetWarmup();
      try {
        let urls = portableAssetWarmup.failedUrls.slice();
        if (!urls.length) {
          const manifestResponse = await fetch(PORTABLE_ASSET_MANIFEST_URL, {
            cache: "no-cache",
            credentials: "same-origin",
            signal: controller.signal,
          });
          if (!manifestResponse.ok) throw new Error(`HTTP ${manifestResponse.status}: ${PORTABLE_ASSET_MANIFEST_URL}`);
          const manifest = await manifestResponse.json();
          const version = String(manifest?.version || "").trim();
          const sources = [
            ...(Array.isArray(manifest?.assets) ? manifest.assets : []),
            ...(Array.isArray(manifest?.deferredAssets) ? manifest.deferredAssets : []),
          ];
          urls = Array.from(new Set(sources.map((source) => versionedPortableAssetUrl(source, version)).filter(Boolean)));
          if (!version || !urls.length) throw new Error("portable asset manifest is empty");
          portableAssetWarmup.version = version;
          portableAssetWarmup.total = urls.length;
        }
        const completedBefore = Math.max(0, portableAssetWarmup.total - urls.length);
        portableAssetWarmup.failedUrls = await fetchPortableAssetBatch(urls, controller.signal, completedBefore);
        portableAssetWarmup.status = portableAssetWarmup.failed ? "partial" : "complete";
      } catch (_) {
        portableAssetWarmup.status = "failed";
      } finally {
        window.clearTimeout(timeout);
        portableAssetWarmup.finishedAt = Date.now();
        notifyPortableAssetWarmup();
      }
      return portableAssetWarmupSnapshot();
    })();
    return portableAssetWarmup.retryPromise;
  }

  async function ensurePortableAssetsReadyForNavigation() {
    const firstAttempt = await startPortableAssetWarmup();
    if (!isPortableTouchDevice() || ["complete", "skipped"].includes(firstAttempt.status)) return firstAttempt;
    return retryPortableAssetWarmup();
  }

  async function navigateToBoardGameWhenReady(url) {
    if (portableAssetWarmup.navigationPending) return;
    portableAssetWarmup.navigationPending = true;
    const warmup = ensurePortableAssetsReadyForNavigation();
    if (isPortableTouchDevice() && !["complete", "skipped"].includes(portableAssetWarmup.status)) {
      document.documentElement.dataset.portableAssetGate = "waiting";
      if (refs.portableAssetGate) refs.portableAssetGate.hidden = false;
      notifyPortableAssetWarmup();
      shared.showToast("正在完成平板航海素材下載，準備好後立即進場…");
    }
    let readyState = null;
    try {
      readyState = await warmup;
    } finally {
      delete document.documentElement.dataset.portableAssetGate;
      if (refs.portableAssetGate) refs.portableAssetGate.hidden = true;
    }
    if (isPortableTouchDevice() && readyState?.status !== "complete") {
      shared.showToast("網路未能完成少數素材下載；已重試並保留快取，遊戲仍會正常進場。");
    }
    location.href = url;
  }

  function buildLobbyFromQuery(roomId) {
    const rid = sanitizeRoomCode(roomId || "B7412");
    const existingLobby = shared.getLobby ? shared.getLobby(rid) : null;
    if (existingLobby?.roomCode) {
      shared.setRoomContext(rid, "board");
      return existingLobby;
    }
    const room = shared.getRooms().find((item) => sanitizeRoomCode(item.roomId) === rid);
    const hostName = room?.hostName || profile.name;
    const hostUserId = room?.hostName && room.hostName !== profile.name ? 20001 : profile.userId;
    const lobby = {
      roomId: rid,
      roomCode: rid,
      roomName: room?.title || "千陽號大富翁試航局",
      hostName,
      hostUserId,
      maxPlayers: 4,
      players: [
        {
          userId: profile.userId,
          clientId: profile.clientId,
          name: profile.name,
          avatar: profile.avatar,
          title: profile.title,
          isHost: true,
          ready: false,
          isMe: true,
        },
      ],
      chat: [
        { system: true, text: "等待室已就緒。測試模式下 1 人也可以直接開始正式遊戲。", ts: Date.now() - 1000 * 60 * 2 },
      ],
    };
    shared.saveLobby(lobby);
    shared.setRoomContext(rid, "board");
    return lobby;
  }

  function sanitizeRoomCode(value) {
    const cleaned = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    return cleaned || `B${String(Math.floor(1000 + Math.random() * 9000))}`;
  }

  function boardProfilePayload() {
    commitPlayerName({ render: false });
    return {
      userId: profile.userId,
      clientId: profile.clientId,
      name: profile.name,
      avatar: profile.avatar,
      title: profile.title,
      secret: profile.secret || "",
    };
  }

  function onlineReady() {
    return !!(boardSocket.socket && boardSocket.connected);
  }

  function hasOnlineRoomClient() {
    return !!window.io || !!boardSocket.socket || !!boardSocket.retryTimer;
  }

  function waitForOnlineRoomClient(actionLabel = "連線房間") {
    if (onlineReady()) return true;
    if (hasOnlineRoomClient()) {
      shared.showToast(`${actionLabel}需要先連上本地房間伺服器，請稍等一下再試。`);
      connectBoardSocket();
      return false;
    }
    return true;
  }

  function saveAndRenderLobby(lobby) {
    if (!lobby?.roomCode) return;
    lobby.players = (lobby.players || []).map((player) => ({
      ...player,
      clientId: Number(player.userId) === Number(profile.userId) ? profile.clientId : player.clientId,
      isMe: Number(player.userId) === Number(profile.userId),
    }));
    normalizeCpuLobbyNames(lobby);
    state.lobby = lobby;
    shared.saveLobby(state.lobby);
    shared.setRoomContext(state.lobby.roomCode, "board");
    renderLobby();
  }

  function handleSocketError(result, fallbackText = "連線房間操作失敗") {
    if (result?.ok) return false;
    const error = String(result?.error || "");
    const map = {
      not_found: "找不到這個房間，請確認房號。",
      full: "房間已滿。",
      playing: "這個房間已經開局。",
      host_only: "只有房主可以開始遊戲。",
      not_waiting: "遊戲已經開始，不能再調整 CPU 玩家。",
      cpu_only: "只能移除 CPU 玩家。",
      campaign_not_found: "找不到這份共有航海紀錄。",
      not_campaign_member: "你不是這份共有航海紀錄的成員。",
      campaign_missing_save: "這份共有航海紀錄沒有可載入的進度。",
      campaign_locked: "這場遊戲已經開始，不能中途加入。請等大家存檔後重新集合。",
      campaign_already_connected: "這名玩家已經在目前的集合局中，不能重複連入。",
      campaign_fixed_roster: "共有航海紀錄的成員與 CPU 席位不能在等待室更動。",
      not_all_ready: "所有已進入等待室的真人玩家都要先按準備。",
      campaign_branch_busy: "建立者的紀錄仍在戰鬥、移動或事件中，請回遊戲完成結算後重新存檔。",
      campaign_assemble_failed: "無法組合大家的最新紀錄，請重新整理後再試。",
    };
    shared.showToast(map[error] || fallbackText);
    return true;
  }

  function joinOnlineRoom(roomIdInput, { create = false } = {}) {
    if (!onlineReady()) return false;
    const roomId = sanitizeRoomCode(roomIdInput || refs.roomCodeInput.value);
    boardSocket.socket.emit("BOARD_JOIN_ROOM", {
      roomCode: roomId,
      create,
      profile: boardProfilePayload(),
    }, (result = {}) => {
      if (handleSocketError(result, create ? "建立連線房間失敗" : "加入連線房間失敗")) return;
      state.rooms = result.rooms || state.rooms;
      if (result.lobby) saveAndRenderLobby(result.lobby);
      renderRoomList();
      setView("lobby");
    });
    return true;
  }

  function requestOnlineRoomList() {
    if (!onlineReady()) return false;
    boardSocket.socket.emit("BOARD_ROOM_LIST", {}, (result = {}) => {
      if (Array.isArray(result.rooms)) {
        state.rooms = result.rooms;
        renderRoomList();
      }
    });
    return true;
  }

  function avatarByName(name) {
    return AVATAR_HINTS[name] || 1;
  }

  function formatCoin(value) {
    return new Intl.NumberFormat("zh-TW").format(Number(value) || 0);
  }

  function fallbackPlayerName() {
    return `玩家${String(profile.userId || 0).slice(-4)}`;
  }

  function normalizePlayerName(value) {
    const cleaned = String(value || "").trim().replace(/\s+/g, " ").slice(0, 16);
    return cleaned || fallbackPlayerName();
  }

  function setView(viewName) {
    state.currentView = viewName;
    refs.views.forEach((node) => {
      node.classList.toggle("active", node.dataset.view === viewName);
    });
    window.scrollTo({ top:0, left:0, behavior:"auto" });
  }

  function renderHome() {
    refs.playerAvatar.src = shared.avatarUrlById(profile.avatar);
    if (refs.playerNameDisplay) refs.playerNameDisplay.textContent = profile.name;
    if (refs.playerName && document.activeElement !== refs.playerName) {
      refs.playerName.value = profile.name;
    }
    refs.playerTitle.textContent = profile.title;
    refs.playerCoin.textContent = formatCoin(profile.coins);
    if (refs.accountSourceText) refs.accountSourceText.textContent = accountProfileLocked ? "已連結登入帳號" : "本機測試玩家";
    if (refs.playerProfileMenuHint) {
      refs.playerProfileMenuHint.textContent = accountProfileLocked
        ? "查看已同步的登入帳號資料"
        : "本機測試時修改名稱與頭像";
    }
    if (refs.accountProfileDescription) {
      refs.accountProfileDescription.textContent = accountProfileLocked
        ? "此處只顯示登入帳號資料，不需要重新選擇。"
        : "尚未登入正式帳號，可在本機暫時設定測試資料。";
    }
    if (refs.linkedAccountNote) refs.linkedAccountNote.hidden = !accountProfileLocked;
    if (refs.localProfileControls) refs.localProfileControls.hidden = accountProfileLocked;
    if (refs.campaignAccountHint) {
      refs.campaignAccountHint.textContent = accountProfileLocked
        ? `只顯示 ${profile.name} 帳號可使用的紀錄`
        : "登入正式帳號後，會自動顯示該帳號的紀錄";
    }
  }

  function socialSummaryFromState() {
    const social = shared.getState?.() || {};
    return {
      ready: !!social.socialReady,
      loading: !!social.socialLoading,
      error: String(social.socialError || ""),
      friendCount: Array.isArray(social.friends) ? social.friends.length : 0,
      onlineCount: Array.isArray(social.friends) ? social.friends.filter((friend) => friend.online).length : 0,
      requestCount: Array.isArray(social.requestsIn) ? social.requestsIn.length : 0,
      unreadCount: social.unread instanceof Map
        ? Array.from(social.unread.values()).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0)
        : 0,
    };
  }

  function renderSocialSummary(summary = socialSummaryFromState()) {
    const waitingForSharedAccount = localPreviewMode && !summary.ready;
    if (refs.socialFriendCount) refs.socialFriendCount.textContent = summary.ready ? String(summary.friendCount || 0) : "—";
    if (refs.socialOnlineCount) refs.socialOnlineCount.textContent = summary.ready ? String(summary.onlineCount || 0) : "—";
    if (refs.socialRequestCount) refs.socialRequestCount.textContent = summary.ready ? String(summary.requestCount || 0) : "—";
    if (refs.socialUnreadCount) refs.socialUnreadCount.textContent = summary.ready ? String(summary.unreadCount || 0) : "—";
    if (refs.socialConnectionText) {
      refs.socialConnectionText.classList.toggle("is-ready", !!summary.ready);
      refs.socialConnectionText.textContent = summary.ready
        ? `已連接正式帳號：${summary.friendCount || 0} 位好友，${summary.onlineCount || 0} 位目前在線。`
        : (waitingForSharedAccount
          ? "共用好友與聊天室會在接回《偉大航道爭霸戰》帳號後啟用。"
          : (summary.loading ? "正在連接好友服務…" : (summary.error || "好友服務尚未連線。")));
    }
    if (refs.socialMenuHint) {
      refs.socialMenuHint.textContent = summary.ready
        ? `${summary.onlineCount || 0} 位好友在線${summary.requestCount ? `・${summary.requestCount} 筆邀請待確認` : ""}`
        : (waitingForSharedAccount
          ? "保留共用好友、邀請與私人訊息入口"
          : (accountProfileLocked ? "正在連接好友名單與私人訊息" : "登入正式帳號後啟用好友與私人訊息"));
    }
  }

  function togglePlayerProfileMenu(forceOpen) {
    if (!refs.accountProfileMenu) return;
    const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : refs.accountProfileMenu.hidden;
    refs.accountProfileMenu.hidden = !shouldOpen;
    if (shouldOpen && !accountProfileLocked) renderAvatarPicker();
  }

  function syncDockProfile() {
    document.getElementById("boardDockMeAva")?.setAttribute("src", shared.avatarUrlById(profile.avatar));
    const dockName = document.getElementById("boardDockMeName");
    if (dockName) dockName.textContent = profile.name;
  }

  function syncLobbyProfile() {
    const me = currentLobbyPlayer();
    if (!me) return;
    me.avatar = profile.avatar;
    me.name = profile.name;
    me.title = profile.title;
    if (isLobbyHost()) {
      state.lobby.hostName = profile.name;
      if (!state.lobby.roomName || / 的航海房$/.test(state.lobby.roomName)) {
        state.lobby.roomName = `${profile.name} 的航海房`;
      }
    }
    shared.saveLobby(state.lobby);
  }

  function syncOnlineLobbyProfile() {
    if (!onlineReady() || !state.lobby?.roomCode) return;
    boardSocket.socket.emit("BOARD_JOIN_ROOM", {
      roomCode: state.lobby.roomCode,
      create: false,
      profile: boardProfilePayload(),
    }, (result = {}) => {
      if (result.ok && result.lobby) saveAndRenderLobby(result.lobby);
    });
  }

  function commitPlayerName(options = {}) {
    if (accountProfileLocked) {
      if (options.render !== false) renderHome();
      return profile.name;
    }
    const nextName = normalizePlayerName(refs.playerName?.value || profile.name);
    profile = {
      ...profile,
      name: nextName,
    };
    try {
      localStorage.setItem("op_name", nextName);
      localStorage.setItem("op_player_name", nextName);
    } catch (_) {}
    syncLobbyProfile();
    syncDockProfile();
    if (options.render !== false) {
      renderHome();
      if (state.lobby) renderLobby();
    }
    return nextName;
  }

  function updatePlayerNameDraft(value) {
    if (accountProfileLocked) return;
    const cleaned = String(value || "").trim().replace(/\s+/g, " ").slice(0, 16);
    if (!cleaned) return;
    profile = {
      ...profile,
      name: cleaned,
    };
    try {
      localStorage.setItem("op_name", cleaned);
      localStorage.setItem("op_player_name", cleaned);
    } catch (_) {}
    syncLobbyProfile();
    syncDockProfile();
    if (state.lobby) renderLobby();
  }

  function selectAvatar(avatarId) {
    if (accountProfileLocked) return;
    commitPlayerName({ render: false });
    const nextAvatar = Math.max(1, Math.min(50, Math.round(Number(avatarId) || 1)));
    profile = {
      ...profile,
      avatar: nextAvatar,
      avatarUrl: shared.avatarUrlById(nextAvatar),
    };
    try {
      localStorage.setItem("op_avatar", String(nextAvatar));
      localStorage.setItem("op_player_avatar", String(nextAvatar));
    } catch (_) {}
    syncLobbyProfile();
    syncOnlineLobbyProfile();
    renderHome();
    renderAvatarPicker();
    syncDockProfile();
    if (state.lobby) renderLobby();
  }

  function renderAvatarPicker() {
    if (!refs.avatarPickerGrid) return;
    refs.avatarPickerGrid.innerHTML = "";
    if (accountProfileLocked) return;
    BOARD_AVATAR_CHOICES.forEach((avatarId) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `avatar-choice${Number(profile.avatar) === avatarId ? " is-selected" : ""}`;
      button.title = `頭像 ${avatarId}`;
      button.dataset.avatarId = String(avatarId);
      button.innerHTML = `<img src="${shared.avatarUrlById(avatarId)}" alt="頭像 ${avatarId}" loading="lazy">`;
      button.addEventListener("click", () => selectAvatar(avatarId));
      refs.avatarPickerGrid.appendChild(button);
    });
  }

  function renderRoomList() {
    refs.boardRoomList.innerHTML = "";
    const rooms = state.rooms || [];
    refs.boardRoomEmpty.style.display = rooms.length ? "none" : "block";
    rooms.forEach((room) => {
      const isFull = Number(room.total) >= Number(room.maxPlayers);
      const card = document.createElement("article");
      card.className = `board-room-card${isFull ? " full" : ""}`;
      card.innerHTML = `
        <div class="board-room-top">
          <div>
            <div class="board-room-name">${room.title}</div>
            <div class="board-room-host">房主 ${room.hostName}</div>
          </div>
          <div class="board-room-status ${isFull ? "busy" : "waiting"}">${isFull ? "已滿" : "可加入"}</div>
        </div>
        <div class="board-room-meta">
          <span>房號 ${room.roomId}</span>
          <span>${room.total}/${room.maxPlayers} 人</span>
        </div>
        <button type="button" class="board-room-join" ${isFull ? "disabled" : ""}>加入房間</button>
      `;
      card.querySelector(".board-room-join").addEventListener("click", () => joinRoom(room.roomId));
      refs.boardRoomList.appendChild(card);
    });
  }

  function escapeCampaignText(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatCampaignTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "尚未保存";
    return date.toLocaleString("zh-TW", { hour12: false });
  }

  function renderCampaignList() {
    if (!refs.boardCampaignList || !refs.boardCampaignEmpty) return;
    refs.boardCampaignList.innerHTML = "";
    const campaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
    if (localPreviewMode && refs.openCampaignsBtn) {
      refs.openCampaignsBtn.hidden = campaigns.length === 0;
    }
    if (refs.campaignMenuHint) {
      refs.campaignMenuHint.textContent = campaigns.length
        ? `${campaigns.length} 份可使用的航海紀錄`
        : (onlineReady() ? "目前沒有可繼續的共有紀錄" : "讀取這個帳號的個人與集合紀錄");
    }
    refs.boardCampaignEmpty.style.display = campaigns.length ? "none" : "block";
    refs.boardCampaignEmpty.textContent = onlineReady()
      ? (accountProfileLocked
        ? "這個登入帳號目前沒有共有航海紀錄。完成一周目並存檔後會顯示在這裡。"
        : "目前是本機測試玩家；登入正式帳號後會載入該帳號的航海紀錄。")
      : "正在連接伺服器並讀取這個帳號的航海紀錄…";
    campaigns.forEach((campaign) => {
      const card = document.createElement("article");
      card.className = "campaign-save-card";
      const currentMember = (campaign.members || []).find((member) => member.key === campaign.memberKey)
        || (campaign.members || []).find((member) => Number(member.userId) === Number(profile.userId));
      const personalLocation = currentMember?.latest?.location?.label || "位置已保存";
      const personalCrew = Array.isArray(currentMember?.latest?.crew) ? currentMember.latest.crew : [];
      const crewNames = personalCrew.slice(0, 3).map((entry) => entry.name).filter(Boolean).join("、");
      const turnStep = String(campaign.branch?.turnStep || "等待行動");
      const members = (campaign.members || []).map((member) => `
        <span class="campaign-member-chip" title="${escapeCampaignText(member.latest?.location?.label || "位置已保存")}">
          <img src="${shared.avatarUrlById(member.avatar || 1)}" alt="${escapeCampaignText(member.name)}">
          <span>${escapeCampaignText(member.name)}</span>
        </span>
      `).join("");
      const gatherLabel = campaign.activeGatherRoom ? "加入集合等待室" : "開啟集合等待室";
      card.innerHTML = `
        <div>
          <div class="campaign-save-title">
            <span>${escapeCampaignText(campaign.roomName || "共有航海紀錄")}</span>
            <span class="campaign-save-badge">${campaign.shared?.postgameUnlocked ? "二周目" : "共有"}</span>
            ${campaign.activeGatherRoom ? '<span class="campaign-save-badge">集合中</span>' : ""}
          </div>
          <div class="campaign-save-meta">
            <span>紀錄 ${escapeCampaignText(campaign.campaignId)}</span>
            <span>${campaign.members?.length || 0} 名成員</span>
            <span>你的進度：${escapeCampaignText(formatCampaignTime(campaign.branch?.savedAt))}</span>
            <span>第 ${Math.max(1, Number(campaign.branch?.round || 1))} 輪</span>
          </div>
          <div class="campaign-personal-summary">
            <span>此帳號：${escapeCampaignText(currentMember?.name || profile.name)}</span>
            <span>位置：${escapeCampaignText(personalLocation)}</span>
            <span>船員：${personalCrew.length}${crewNames ? `（${escapeCampaignText(crewNames)}${personalCrew.length > 3 ? "…" : ""}）` : ""}</span>
            <span>狀態：${escapeCampaignText(turnStep)}</span>
          </div>
          <div class="campaign-save-members">${members}</div>
        </div>
        <div class="campaign-save-actions">
          <button type="button" class="campaign-action" data-campaign-solo="${escapeCampaignText(campaign.campaignId)}">繼續個人航海</button>
          <button type="button" class="campaign-action secondary" data-campaign-gather="${escapeCampaignText(campaign.campaignId)}">${gatherLabel}</button>
        </div>
      `;
      card.querySelector("[data-campaign-solo]")?.addEventListener("click", () => openBoardCampaign(campaign.campaignId, "solo"));
      card.querySelector("[data-campaign-gather]")?.addEventListener("click", () => openBoardCampaign(campaign.campaignId, "gather"));
      refs.boardCampaignList.appendChild(card);
    });
  }

  function requestCampaignList() {
    if (!onlineReady()) return false;
    boardSocket.socket.emit("BOARD_CAMPAIGN_LIST", { profile: boardProfilePayload() }, (result = {}) => {
      if (!result.ok) return;
      state.campaigns = Array.isArray(result.campaigns) ? result.campaigns : [];
      renderCampaignList();
    });
    return true;
  }

  function openBoardCampaign(campaignId, mode) {
    commitPlayerName({ render: false });
    if (!onlineReady()) {
      shared.showToast("共有航海紀錄需要先連上遊戲伺服器。");
      connectBoardSocket();
      return;
    }
    boardSocket.socket.emit("BOARD_CAMPAIGN_OPEN", {
      campaignId,
      mode,
      profile: boardProfilePayload(),
    }, (result = {}) => {
      if (handleSocketError(result, "開啟共有航海紀錄失敗")) return;
      if (result.lobby) saveAndRenderLobby(result.lobby);
      if (result.navigate && result.roomCode) {
        void navigateToBoardGameWhenReady(`board_game.html?room=${encodeURIComponent(result.roomCode)}&online=1&campaign=${encodeURIComponent(campaignId)}&campaignMode=solo`);
        return;
      }
      setView("lobby");
      requestCampaignList();
    });
  }

  function toggleRoomList(forceOpen) {
    state.roomListOpen = typeof forceOpen === "boolean" ? forceOpen : !state.roomListOpen;
    refs.boardRoomListWrap.classList.toggle("open", state.roomListOpen);
    refs.toggleBoardRoomsBtn.textContent = state.roomListOpen ? "收起房間" : "查看更多房間";
  }

  function createRoom() {
    commitPlayerName({ render: false });
    if (joinOnlineRoom(`B${Math.floor(1000 + Math.random() * 9000)}`, { create: true })) return;
    if (!waitForOnlineRoomClient("建立房間")) return;
    const roomId = sanitizeRoomCode(`B${Math.floor(1000 + Math.random() * 9000)}`);
    const room = {
      roomId,
      hostName: profile.name,
      total: 1,
      maxPlayers: 4,
      status: "waiting",
      title: `${profile.name} 的航海房`,
    };
    state.rooms = [room, ...state.rooms.filter((item) => sanitizeRoomCode(item.roomId) !== roomId)];
    shared.saveRooms(state.rooms);
    state.lobby = {
      roomId,
      roomCode: roomId,
      roomName: room.title,
      hostName: profile.name,
      hostUserId: profile.userId,
      maxPlayers: 4,
      players: [
        { userId: profile.userId, clientId: profile.clientId, name: profile.name, avatar: profile.avatar, title: profile.title, isHost: true, ready: false, isMe: true },
      ],
      chat: [
        { system: true, text: "房間已建立。你可以單人直接開始，也可之後再擴充成 2～4 人。", ts: Date.now() - 1000 * 20 },
      ],
    };
    shared.saveLobby(state.lobby);
    shared.setRoomContext(roomId, "board");
    renderRoomList();
    renderLobby();
    setView("lobby");
  }

  function joinRoom(roomIdInput) {
    commitPlayerName({ render: false });
    const roomId = sanitizeRoomCode(roomIdInput || refs.roomCodeInput.value);
    if (joinOnlineRoom(roomId, { create: false })) return;
    if (!waitForOnlineRoomClient("加入房間")) return;
    const room = state.rooms.find((item) => sanitizeRoomCode(item.roomId) === roomId) || {
      roomId,
      hostName: profile.name,
      total: 1,
      maxPlayers: 4,
      status: "waiting",
      title: `${profile.name} 的航海房`,
    };
    const existingLobby = shared.getLobby ? shared.getLobby(roomId) : null;
    if (existingLobby?.roomCode) {
      state.lobby = existingLobby;
      renderLobby();
      setView("lobby");
      return;
    }
    state.lobby = {
      roomId,
      roomCode: roomId,
      roomName: room.title,
      hostName: profile.name,
      hostUserId: profile.userId,
      maxPlayers: 4,
      players: [
        { userId: profile.userId, clientId: profile.clientId, name: profile.name, avatar: profile.avatar, title: profile.title, isHost: true, ready: false, isMe: true },
      ],
      chat: [
        { system: true, text: `你已進入房間 ${roomId}。單人測試模式可直接開始正式遊戲。`, ts: Date.now() - 1000 * 15 },
      ],
    };
    shared.saveLobby(state.lobby);
    shared.setRoomContext(roomId, "board");
    renderLobby();
    setView("lobby");
  }

  function isCpuLobbyPlayer(player) {
    return !!player && (
      player.isCPU === true
      || player.isCpu === true
      || player.cpu === true
      || String(player.clientId || "").startsWith("board-cpu-")
    );
  }

  function cpuLobbySlotNumber(player, fallbackOrdinal = 1) {
    const userId = Number(player?.userId);
    if (Number.isInteger(userId) && userId <= -1001) return Math.max(1, Math.abs(userId + 1000));
    const clientMatch = String(player?.clientId || "").match(/-(\d+)$/);
    if (clientMatch) return Math.max(1, Number(clientMatch[1]) || 1);
    return Math.max(1, Number(fallbackOrdinal) || 1);
  }

  function normalizeCpuLobbyNames(lobby = state.lobby) {
    if (!lobby || !Array.isArray(lobby.players)) return false;
    let changed = false;
    let cpuOrdinal = 0;
    lobby.players.forEach((player) => {
      if (!isCpuLobbyPlayer(player)) return;
      if (player.isProxyCPU) return;
      cpuOrdinal += 1;
      const nextName = `CPU${cpuLobbySlotNumber(player, cpuOrdinal)}`;
      if (player.name === nextName) return;
      player.name = nextName;
      changed = true;
    });
    return changed;
  }

  function nextCpuLobbySlot(lobby = state.lobby) {
    const usedIds = new Set((lobby?.players || []).map((player) => Number(player.userId)));
    for (let slot = 1; slot <= Math.max(1, Number(lobby?.maxPlayers || 4)); slot += 1) {
      const userId = -1000 - slot;
      if (!usedIds.has(userId)) return slot;
    }
    return Math.max(1, (lobby?.players || []).length + 1);
  }

  function createCpuLobbyPlayer(lobby = state.lobby) {
    const slot = nextCpuLobbySlot(lobby);
    const roomCode = sanitizeRoomCode(lobby?.roomCode || "LOCAL");
    return {
      userId: -1000 - slot,
      clientId: `board-cpu-${roomCode}-${slot}`,
      name: CPU_LOBBY_NAMES[(slot - 1) % CPU_LOBBY_NAMES.length] || `CPU${slot}`,
      avatar: CPU_LOBBY_AVATARS[(slot - 1) % CPU_LOBBY_AVATARS.length],
      title: "CPU 航海士",
      isHost: false,
      ready: true,
      online: true,
      isMe: false,
      isCPU: true,
    };
  }

  function pushLobbySystemMessage(text) {
    if (!state.lobby) return;
    state.lobby.chat = Array.isArray(state.lobby.chat) ? state.lobby.chat : [];
    state.lobby.chat.push({ system: true, text, ts: Date.now() });
  }

  function addCpuPlayer() {
    if (!state.lobby) return;
    if (!isLobbyHost()) {
      shared.showToast("只有房主可以加入 CPU 玩家。");
      return;
    }
    if (state.lobby.players.length >= Number(state.lobby.maxPlayers || 4)) {
      shared.showToast("房間已滿，最多 4 人。");
      return;
    }
    if (onlineReady()) {
      boardSocket.socket.emit("BOARD_ADD_CPU", {
        roomCode: state.lobby.roomCode,
        profile: boardProfilePayload(),
      }, (result = {}) => {
        if (handleSocketError(result, "加入 CPU 玩家失敗")) return;
        if (result.lobby) saveAndRenderLobby(result.lobby);
      });
      return;
    }
    if (!waitForOnlineRoomClient("加入 CPU 玩家")) return;
    const cpu = createCpuLobbyPlayer(state.lobby);
    state.lobby.players.push(cpu);
    pushLobbySystemMessage(`${cpu.name} 已加入等待室。`);
    shared.saveLobby(state.lobby);
    renderLobby();
  }

  function removeCpuPlayer(userId) {
    if (!state.lobby) return;
    if (!isLobbyHost()) {
      shared.showToast("只有房主可以移除 CPU 玩家。");
      return;
    }
    const target = state.lobby.players.find((player) => Number(player.userId) === Number(userId));
    if (!isCpuLobbyPlayer(target)) {
      shared.showToast("只能移除 CPU 玩家。");
      return;
    }
    if (onlineReady()) {
      boardSocket.socket.emit("BOARD_REMOVE_CPU", {
        roomCode: state.lobby.roomCode,
        profile: boardProfilePayload(),
        userId: target.userId,
      }, (result = {}) => {
        if (handleSocketError(result, "移除 CPU 玩家失敗")) return;
        if (result.lobby) saveAndRenderLobby(result.lobby);
      });
      return;
    }
    if (!waitForOnlineRoomClient("移除 CPU 玩家")) return;
    state.lobby.players = state.lobby.players.filter((player) => Number(player.userId) !== Number(target.userId));
    pushLobbySystemMessage(`${target.name} 已離開等待室。`);
    shared.saveLobby(state.lobby);
    renderLobby();
  }

  function renderLobby() {
    if (!state.lobby) return;
    if (normalizeCpuLobbyNames(state.lobby)) shared.saveLobby(state.lobby);
    refs.boardLobbyRoomName.textContent = state.lobby.roomName;
    refs.boardLobbyRoomCode.textContent = state.lobby.roomCode;
    refs.boardLobbyPlayerCount.textContent = `${state.lobby.players.length}/${state.lobby.maxPlayers} 人`;
    refs.boardLobbyPlayerGrid.innerHTML = "";

    const slots = [];
    for (let index = 0; index < state.lobby.maxPlayers; index += 1) {
      slots.push(state.lobby.players[index] || null);
    }

    slots.forEach((player) => {
      const card = document.createElement("article");
      if (!player) {
        card.className = "seat-card empty";
        card.textContent = "等待玩家加入";
        refs.boardLobbyPlayerGrid.appendChild(card);
        return;
      }
      const isCpu = isCpuLobbyPlayer(player);
      const isProxyCpu = player.isProxyCPU === true;
      const isMe = !isCpu && Number(player.userId) === Number(profile.userId);
      const canRemoveCpu = isLobbyHost() && isCpu && !isProxyCpu && !state.lobby.campaignId;
      card.className = `seat-card${isCpu ? " cpu" : ""}`;
      card.innerHTML = `
        <div class="seat-top">
          <img class="seat-avatar" src="${shared.avatarUrlById(player.avatar)}" alt="${player.name}">
          <div>
            <div class="seat-name">${player.name}</div>
            <div class="seat-title">${player.title || "航海士"}</div>
          </div>
        </div>
        <div class="seat-tags">
          ${player.isHost ? '<span class="seat-tag host">房主</span>' : ""}
          ${isProxyCpu ? '<span class="seat-tag cpu">CPU 代管</span>' : (isCpu ? '<span class="seat-tag cpu">CPU</span>' : "")}
          ${isMe ? '<span class="seat-tag me">你</span>' : ""}
          <span class="seat-tag ${player.ready ? "ready" : "wait"}">${player.ready ? "已準備" : "待命"}</span>
          ${canRemoveCpu ? `<button type="button" class="seat-remove-cpu" data-remove-cpu="${player.userId}">移除</button>` : ""}
        </div>
      `;
      card.querySelector("[data-remove-cpu]")?.addEventListener("click", () => removeCpuPlayer(player.userId));
      refs.boardLobbyPlayerGrid.appendChild(card);
    });

    refs.boardReadyBtn.textContent = currentLobbyPlayer()?.ready ? "取消準備" : "準備";
    const joinedHumans = state.lobby.players.filter((player) => !isCpuLobbyPlayer(player));
    const allJoinedHumansReady = joinedHumans.length > 0 && joinedHumans.every((player) => player.ready);
    refs.boardStartBtn.disabled = !isLobbyHost() || (state.lobby.campaignId && !allJoinedHumansReady);
    refs.boardStartBtn.style.display = isLobbyHost() ? "" : "none";
    refs.boardAddCpuBtn.disabled = !isLobbyHost() || state.lobby.players.length >= Number(state.lobby.maxPlayers || 4) || Boolean(state.lobby.campaignId);
    refs.boardAddCpuBtn.style.display = isLobbyHost() && !state.lobby.campaignId ? "" : "none";
    renderLobbyChat();
  }

  function renderLobbyChat() {
    refs.boardLobbyChatBox.innerHTML = "";
    (state.lobby?.chat || []).forEach((item) => {
      if (item.system) {
        const sys = document.createElement("div");
        sys.className = "lobby-chat-system";
        sys.textContent = item.text;
        refs.boardLobbyChatBox.appendChild(sys);
        return;
      }
      const row = document.createElement("div");
      const isMe = item.name === profile.name;
      row.className = `lobby-chat-row${isMe ? " me" : ""}`;
      row.innerHTML = `
        <div class="lobby-chat-avatar">
          <img src="${shared.avatarUrlById(item.avatar || profile.avatar)}" alt="${item.name}">
        </div>
        <div>
          <div class="lobby-chat-meta">${item.name}</div>
          <div class="lobby-chat-bubble">
            <div class="lobby-chat-text">${item.text}</div>
          </div>
        </div>
      `;
      refs.boardLobbyChatBox.appendChild(row);
    });
    refs.boardLobbyChatBox.scrollTop = refs.boardLobbyChatBox.scrollHeight + 200;
  }

  function sendLobbyChat() {
    commitPlayerName({ render: false });
    const text = String(refs.boardLobbyChatInput.value || "").trim();
    if (!text || !state.lobby) return;
    if (!onlineReady() && !waitForOnlineRoomClient("送出聊天")) return;
    refs.boardLobbyChatInput.value = "";
    if (onlineReady()) {
      boardSocket.socket.emit("BOARD_LOBBY_CHAT", {
        roomCode: state.lobby.roomCode,
        profile: boardProfilePayload(),
        text,
      }, (result = {}) => {
        handleSocketError(result, "送出聊天失敗");
      });
      return;
    }
    state.lobby.chat.push({
      name: profile.name,
      avatar: profile.avatar,
      text,
      ts: Date.now(),
    });
    shared.saveLobby(state.lobby);
    renderLobbyChat();
  }

  function currentLobbyPlayer() {
    return state.lobby?.players.find((item) => Number(item.userId) === Number(profile.userId)) || null;
  }

  function isLobbyHost() {
    return Number(state.lobby?.hostUserId) === Number(profile.userId);
  }

  function toggleLobbyReady() {
    commitPlayerName({ render: false });
    const me = currentLobbyPlayer();
    if (!me) return;
    if (!onlineReady() && !waitForOnlineRoomClient("切換準備")) return;
    if (onlineReady()) {
      boardSocket.socket.emit("BOARD_LOBBY_READY", {
        roomCode: state.lobby.roomCode,
        profile: boardProfilePayload(),
        ready: !me.ready,
      }, (result = {}) => {
        handleSocketError(result, "切換準備失敗");
      });
      return;
    }
    me.ready = !me.ready;
    state.lobby.chat.push({
      system: true,
      text: `${me.name}${me.ready ? "已準備完成" : "取消了準備"}`,
      ts: Date.now(),
    });
    shared.saveLobby(state.lobby);
    renderLobby();
  }

  function goToBoardGame() {
    commitPlayerName({ render: false });
    if (!state.lobby) return;
    if (!isLobbyHost()) {
      shared.showToast("只有房主可以開始遊戲。");
      return;
    }
    shared.saveLobby(state.lobby);
    if (onlineReady()) {
      boardSocket.socket.emit("BOARD_START_GAME", {
        roomCode: state.lobby.roomCode,
        profile: boardProfilePayload(),
      }, (result = {}) => {
        if (handleSocketError(result, "開始連線遊戲失敗")) return;
      });
      return;
    }
    if (!waitForOnlineRoomClient("開始遊戲")) return;
    void navigateToBoardGameWhenReady(`board_game.html?room=${encodeURIComponent(state.lobby.roomCode)}`);
  }

  function connectBoardSocket(existingSocket = null) {
    if (boardSocket.socket) return;
    if (!window.io && !existingSocket) {
      if (!boardSocket.retryTimer) {
        boardSocket.retryTimer = setTimeout(() => {
          boardSocket.retryTimer = 0;
          connectBoardSocket();
        }, 160);
      }
      return;
    }
    boardSocket.socket = existingSocket || window.io({ transports: ["websocket", "polling"] });
    shared.attachSocket?.(boardSocket.socket);
    const handleConnect = () => {
      boardSocket.connected = true;
      state.online = true;
      requestOnlineRoomList();
      requestCampaignList();
      const targetRoomCode = state.lobby?.roomCode || (query.get("room") ? sanitizeRoomCode(query.get("room")) : "");
      if (targetRoomCode) {
        boardSocket.socket.emit("BOARD_JOIN_ROOM", {
          roomCode: targetRoomCode,
          create: false,
          profile: boardProfilePayload(),
        }, (result = {}) => {
          if (result.ok && result.lobby) {
            saveAndRenderLobby(result.lobby);
            if (query.get("view") === "lobby") setView("lobby");
          }
        });
      }
      shared.showToast("已連上本地大富翁房間伺服器");
    };
    boardSocket.socket.on("connect", handleConnect);
    boardSocket.socket.on("disconnect", () => {
      boardSocket.connected = false;
      state.online = false;
      shared.showToast("大富翁房間伺服器已斷線，暫時回到單機等待室。");
    });
    boardSocket.socket.on("BOARD_ROOM_LIST", (message = {}) => {
      if (!Array.isArray(message.rooms)) return;
      state.rooms = message.rooms;
      renderRoomList();
    });
    boardSocket.socket.on("BOARD_CAMPAIGN_LIST", (message = {}) => {
      if (!Array.isArray(message.campaigns)) return;
      state.campaigns = message.campaigns;
      renderCampaignList();
    });
    boardSocket.socket.on("BOARD_LOBBY", (message = {}) => {
      if (!message.lobby?.roomCode) return;
      saveAndRenderLobby(message.lobby);
      if (state.currentView !== "lobby") setView("lobby");
    });
    boardSocket.socket.on("BOARD_NAV_GAME", (message = {}) => {
      const lobby = message.lobby || state.lobby;
      if (lobby?.roomCode) {
        saveAndRenderLobby(lobby);
        shared.setRoomContext(lobby.roomCode, "board");
        const campaignQuery = lobby.campaignId
          ? `&campaign=${encodeURIComponent(lobby.campaignId)}&campaignMode=${encodeURIComponent(lobby.campaignMode || "gather")}`
          : "";
        void navigateToBoardGameWhenReady(`board_game.html?room=${encodeURIComponent(lobby.roomCode)}&online=1${campaignQuery}`);
      }
    });
    if (boardSocket.socket.connected) handleConnect();
  }

  function wireEvents() {
    refs.openBoardFlowBtn.addEventListener("click", () => {
      commitPlayerName();
      setView("modeSelect");
      requestCampaignList();
    });
    refs.openCampaignsBtn?.addEventListener("click", () => {
      setView("campaigns");
      requestCampaignList();
    });
    refs.openSocialBtn?.addEventListener("click", () => {
      setView("social");
      renderSocialSummary();
      shared.openFriends?.();
    });
    refs.openPlayerProfileBtn?.addEventListener("click", () => togglePlayerProfileMenu());
    refs.closePlayerProfileBtn?.addEventListener("click", () => togglePlayerProfileMenu(false));
    refs.playerName?.addEventListener("input", (event) => updatePlayerNameDraft(event.target.value));
    refs.playerName?.addEventListener("blur", () => {
      commitPlayerName();
      syncOnlineLobbyProfile();
    });
    refs.playerName?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        refs.playerName.blur();
      }
    });
    refs.backToHomeBtn.addEventListener("click", () => setView("home"));
    refs.backToMainBtn.addEventListener("click", () => setView("home"));
    refs.backFromCampaignsBtn?.addEventListener("click", () => setView("home"));
    refs.backFromSocialBtn?.addEventListener("click", () => setView("home"));
    refs.openFriendDockBtn?.addEventListener("click", () => shared.openFriends?.());
    refs.refreshSocialBtn?.addEventListener("click", () => {
      shared.refreshFriends?.();
      renderSocialSummary();
    });
    window.addEventListener("board:social-updated", (event) => renderSocialSummary(event.detail || {}));
    refs.createBoardRoomBtn.addEventListener("click", createRoom);
    refs.joinBoardRoomBtn.addEventListener("click", () => joinRoom(refs.roomCodeInput.value));
    refs.refreshBoardRoomsBtn.addEventListener("click", () => {
      if (requestOnlineRoomList()) {
        requestCampaignList();
        shared.showToast("已刷新連線房間列表");
        return;
      }
      state.rooms = shared.getRooms();
      renderRoomList();
      shared.showToast("已刷新公開房間列表");
    });
    refs.toggleBoardRoomsBtn.addEventListener("click", () => toggleRoomList());
    refs.roomCodeInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") joinRoom(refs.roomCodeInput.value);
    });
    refs.leaveLobbyBtn.addEventListener("click", () => {
      if (onlineReady() && state.lobby?.roomCode) {
        boardSocket.socket.emit("BOARD_LEAVE_ROOM", {
          roomCode: state.lobby.roomCode,
          profile: boardProfilePayload(),
        });
      }
      shared.setRoomContext("", "board");
      setView("modeSelect");
      requestCampaignList();
    });
    refs.boardReadyBtn.addEventListener("click", toggleLobbyReady);
    refs.boardAddCpuBtn.addEventListener("click", addCpuPlayer);
    refs.boardStartBtn.addEventListener("click", goToBoardGame);
    refs.boardLobbySendChatBtn.addEventListener("click", sendLobbyChat);
    refs.boardLobbyChatInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") sendLobbyChat();
    });
  }

  function bootInitialView() {
    if (localPreviewMode) {
      if (refs.openPlayerProfileBtn) refs.openPlayerProfileBtn.hidden = true;
    }
    renderHome();
    renderRoomList();
    renderCampaignList();
    renderSocialSummary();
    toggleRoomList(false);
    if (state.lobby) renderLobby();

    const view = query.get("view");
    if (view === "game" && state.lobby) {
      goToBoardGame();
      return;
    }
    if (view === "lobby" && state.lobby) {
      setView("lobby");
      return;
    }
    if (view === "modeSelect") {
      setView("modeSelect");
      return;
    }
    if (view === "campaigns" && (!localPreviewMode || state.campaigns.length)) {
      setView("campaigns");
      return;
    }
    if (view === "social") {
      setView("social");
      shared.openFriends?.();
      return;
    }
    setView("home");
  }

  window.__BOARD_START_DEBUG__ = {
    getState: () => ({
      profile: { ...profile },
      online: state.online,
      socketConnected: boardSocket.connected,
      socketReady: onlineReady(),
      hasSocket: !!boardSocket.socket,
      retryingSocket: !!boardSocket.retryTimer,
      currentView: state.currentView,
      lobby: state.lobby ? JSON.parse(JSON.stringify(state.lobby)) : null,
      campaigns: JSON.parse(JSON.stringify(state.campaigns || [])),
      accountProfileLocked,
      linkedAccountUserId,
      portableAssetWarmup: portableAssetWarmupSnapshot(),
    }),
    selectAvatar,
    addCpuPlayer,
    removeCpuPlayer,
    ensurePortableAssetsReadyForNavigation,
    navigateToBoardGameWhenReady,
    setPlayerName: (name) => {
      if (refs.playerName) refs.playerName.value = name;
      commitPlayerName();
    },
  };

  window.setTimeout(startPortableAssetWarmup, 250);
  connectBoardSocket(entrySession.socket);
  wireEvents();
  bootInitialView();
})();
