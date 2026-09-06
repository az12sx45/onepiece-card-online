(async function () {
  "use strict";

  const ENTRY_KEY = "op_battle_chess_entry_ready";
  const query = new URLSearchParams(location.search);
  const temporaryDirectLogin = query.get("local_preview") === "1"
    && ["127.0.0.1", "localhost", "::1"].includes(location.hostname);
  const refs = {
    entry: document.getElementById("battleEntry"),
    entryPanels: Array.from(document.querySelectorAll("[data-entry-panel]")),
    startButton: document.getElementById("battleEntryStartBtn"),
    authForm: document.getElementById("battleAuthForm"),
    username: document.getElementById("battleAuthUsername"),
    password: document.getElementById("battleAuthPassword"),
    authTitle: document.getElementById("battleAuthTitle"),
    authMessage: document.getElementById("battleAuthMessage"),
    authRuntimeNote: document.getElementById("battleAuthRuntimeNote"),
    authSubmit: document.getElementById("battleAuthSubmitBtn"),
    loginTab: document.getElementById("battleAuthLoginTab"),
    registerTab: document.getElementById("battleAuthRegisterTab"),
    authBack: document.getElementById("battleAuthBackBtn"),
    bootMessage: document.getElementById("battleBootMessage"),
    bootActions: document.getElementById("battleBootActions"),
    bootRetry: document.getElementById("battleBootRetryBtn"),
    bootLogin: document.getElementById("battleBootLoginBtn"),
    app: document.getElementById("battleApp"),
    appPanels: Array.from(document.querySelectorAll("[data-app-panel]")),
    playerSummary: document.getElementById("playerSummary"),
    playerAvatar: document.getElementById("playerAvatar"),
    playerName: document.getElementById("playerName"),
    playerTitle: document.getElementById("playerTitle"),
    logout: document.getElementById("logoutBtn"),
    startMatch: document.getElementById("startMatchBtn"),
    createRoom: document.getElementById("createRoomBtn"),
    joinRoom: document.getElementById("joinRoomBtn"),
    spectateRoom: document.getElementById("spectateRoomBtn"),
    roomCode: document.getElementById("chessRoomCodeInput"),
    roomList: document.getElementById("chessRoomList"),
    roomEmpty: document.getElementById("chessRoomEmpty"),
    roomMessage: document.getElementById("chessRoomMessage"),
    roomConnection: document.getElementById("chessRoomConnectionText"),
    refreshRooms: document.getElementById("refreshChessRoomsBtn"),
    continueMatch: document.getElementById("continueMatchBtn"),
    openSocial: document.getElementById("openSocialBtn"),
    openProfile: document.getElementById("openProfileBtn"),
    openShop: document.getElementById("openShopBtn"),
    openFriendDock: document.getElementById("openFriendDockBtn"),
    socialMenuHint: document.getElementById("socialMenuHint"),
    socialMenuBadge: document.getElementById("socialMenuBadge"),
    socialConnection: document.getElementById("socialConnectionText"),
    socialFriendCount: document.getElementById("socialFriendCount"),
    socialOnlineCount: document.getElementById("socialOnlineCount"),
    socialRequestCount: document.getElementById("socialRequestCount"),
    socialUnreadCount: document.getElementById("socialUnreadCount"),
    profileAvatar: document.getElementById("profileAvatar"),
    profileName: document.getElementById("profileName"),
    profileTitle: document.getElementById("profileTitle"),
    profileUserId: document.getElementById("profileUserId"),
  };

  let stage = "press";
  let authMode = "login";
  let entrySocket = null;
  let currentProfile = null;
  let localPreview = false;
  let retryAction = null;
  let chessRoomList = [];
  let chessRoomFilter = "all";
  let chessRoomSocketWired = false;

  try { sessionStorage.removeItem(ENTRY_KEY); } catch (_) {}

  function readStorage(key, fallback = "") {
    try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; }
  }

  function writeStorage(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (_) {}
  }

  function clearSecret() {
    try {
      ["opSecret", "op_secret", "op_user_id"].forEach((key) => localStorage.removeItem(key));
    } catch (_) {}
  }

  function clearSharedProfile() {
    try {
      ["opSecret", "op_secret", "op_user_id", "op_name", "op_player_name", "op_avatar", "op_player_avatar", "op_board_title", "op_board_coins"].forEach((key) => localStorage.removeItem(key));
    } catch (_) {}
  }

  function getDeviceId() {
    let value = String(readStorage("op_device_id", "")).trim();
    if (value) return value;
    try {
      const bytes = new Uint8Array(12);
      window.crypto?.getRandomValues?.(bytes);
      value = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    } catch (_) {}
    if (!value) value = `chess-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e8).toString(36)}`;
    writeStorage("op_device_id", value);
    return value;
  }

  function validHttpOrigin(value) {
    try {
      const parsed = new URL(String(value || ""));
      return /^https?:$/.test(parsed.protocol) ? parsed.origin : "";
    } catch (_) { return ""; }
  }

  function resolveServerOrigin() {
    const fromQuery = validHttpOrigin(query.get("server"));
    if (fromQuery) writeStorage("op_shared_server_origin", fromQuery);
    if (fromQuery) return fromQuery;
    const fromReleaseConfig = validHttpOrigin(window.GRAND_LINE_BATTLE_CONFIG?.serverOrigin);
    if (fromReleaseConfig) writeStorage("op_shared_server_origin", fromReleaseConfig);
    if (fromReleaseConfig) return fromReleaseConfig;
    if (/^https?:$/.test(location.protocol)) return location.origin;
    return validHttpOrigin(readStorage("op_shared_server_origin", "")) || "http://127.0.0.1:8787";
  }

  const serverOrigin = resolveServerOrigin();

  async function resolveRuntime() {
    const sameOrigin = /^https?:$/.test(location.protocol) && location.origin === serverOrigin;
    if (!sameOrigin) return null;
    try {
      const response = await fetch(`${serverOrigin}/api/board-runtime`, {
        cache: "no-store",
        credentials: sameOrigin ? "same-origin" : "omit",
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (_) { return null; }
  }

  function loadSocketClient() {
    if (typeof window.io === "function") return Promise.resolve(true);
    return new Promise((resolve) => {
      const existing = document.querySelector("script[data-battle-socket-client]");
      if (existing) {
        existing.addEventListener("load", () => resolve(typeof window.io === "function"), { once: true });
        existing.addEventListener("error", () => resolve(false), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.dataset.battleSocketClient = "1";
      script.src = `${serverOrigin}/socket.io/socket.io.js`;
      script.onload = () => resolve(typeof window.io === "function");
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  async function ensureSocket() {
    if (entrySocket) return entrySocket;
    if (!(await loadSocketClient())) return null;
    try {
      const sameOrigin = /^https?:$/.test(location.protocol) && location.origin === serverOrigin;
      const options = { transports: ["websocket", "polling"] };
      entrySocket = sameOrigin ? window.io(options) : window.io(serverOrigin, options);
      return entrySocket;
    } catch (_) { return null; }
  }

  function emitAck(socket, eventName, payload, timeoutMs = 12000) {
    return new Promise((resolve) => {
      if (!socket) {
        resolve({ ok: false, error: "socket unavailable" });
        return;
      }
      try {
        socket.timeout(timeoutMs).emit(eventName, payload, (error, result = {}) => {
          resolve(error ? { ok: false, error: "timeout" } : (result || { ok: false, error: "unknown" }));
        });
      } catch (error) {
        resolve({ ok: false, error: String(error?.message || error || "socket error") });
      }
    });
  }

  function normalizeProfile(cloudProfile, usernameHint = "") {
    const profile = cloudProfile && typeof cloudProfile === "object" ? cloudProfile : {};
    const client = profile.stats?.client && typeof profile.stats.client === "object" ? profile.stats.client : {};
    const userId = Math.max(0, Number(profile.user_id ?? profile.userId ?? 0) || 0);
    const name = String(profile.name || usernameHint || readStorage("op_name", "") || (userId ? `玩家${String(userId).slice(-4)}` : "")).trim();
    const avatar = Math.max(1, Math.min(2000, Number(profile.avatar || readStorage("op_avatar", "") || 8) || 8));
    const title = String(client.titles?.equipped || readStorage("op_board_title", "") || "新世界啟航者").trim() || "新世界啟航者";
    const coins = Math.max(0, Number(client.totals?.coins ?? readStorage("op_board_coins", "") ?? 0) || 0);
    return { userId, name, avatar, title, coins };
  }

  function persistProfile(secret, cloudProfile, usernameHint = "") {
    const profile = normalizeProfile(cloudProfile, usernameHint);
    if (!profile.userId || !String(secret || "").trim()) return null;
    writeStorage("opSecret", String(secret).trim());
    writeStorage("op_secret", String(secret).trim());
    writeStorage("op_user_id", profile.userId);
    writeStorage("op_name", profile.name);
    writeStorage("op_player_name", profile.name);
    writeStorage("op_avatar", profile.avatar);
    writeStorage("op_player_avatar", profile.avatar);
    writeStorage("op_board_title", profile.title);
    writeStorage("op_board_coins", profile.coins);
    if (usernameHint) writeStorage("op_last_username", usernameHint);
    return profile;
  }

  function translateAuthError(error) {
    const code = String(error || "").trim();
    const map = {
      "missing credentials": "請輸入帳號與密碼。",
      "invalid username/password": "帳號或密碼不正確。",
      "username length 3~24": "帳號長度必須是 3～24 字。",
      "username only a-z 0-9 _": "帳號只能使用英文字母、數字與底線。",
      "password length 6~72": "密碼長度必須是 6～72 字。",
      "username taken": "這個帳號已經有人使用。",
      "already_logged_in": "此帳號目前正在其他裝置使用。",
      timeout: "伺服器沒有回應，請確認網路後重試。",
      "socket unavailable": "無法連上共用帳號伺服器。",
    };
    return map[code] || (code ? `登入失敗：${code}` : "登入失敗，請稍後再試。");
  }

  function setStage(nextStage) {
    stage = nextStage;
    document.body.dataset.entryStage = nextStage;
    refs.entryPanels.forEach((panel) => {
      const active = panel.dataset.entryPanel === nextStage;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
    if (nextStage === "auth") setTimeout(() => refs.username.focus(), 40);
  }

  function setAuthMode(nextMode) {
    authMode = nextMode === "register" ? "register" : "login";
    const registering = authMode === "register";
    refs.loginTab.classList.toggle("is-active", !registering);
    refs.registerTab.classList.toggle("is-active", registering);
    refs.loginTab.setAttribute("aria-selected", String(!registering));
    refs.registerTab.setAttribute("aria-selected", String(registering));
    refs.authTitle.textContent = registering ? "建立帳號" : "帳號登入";
    refs.authSubmit.textContent = registering ? "建立帳號" : ((temporaryDirectLogin || localPreview) ? "直接進入" : "登入");
    refs.password.autocomplete = registering ? "new-password" : "current-password";
    refs.authMessage.textContent = "";
  }

  function showBootFailure(message, retry) {
    retryAction = retry;
    setStage("boot");
    refs.bootMessage.textContent = message;
    refs.bootActions.hidden = false;
  }

  function setAppView(view) {
    document.body.dataset.appView = view;
    refs.appPanels.forEach((panel) => {
      const active = panel.dataset.appPanel === view;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
  }

  function fillProfile(profile) {
    refs.playerName.textContent = profile.name;
    refs.playerTitle.textContent = profile.title;
    refs.profileName.textContent = profile.name;
    refs.profileTitle.textContent = profile.title;
    refs.profileUserId.textContent = String(profile.userId);
    [refs.playerAvatar, refs.profileAvatar].forEach((img) => {
      img.onerror = () => {
        img.onerror = null;
        img.src = window.BattleSocial?.fallbackAvatar(profile.name) || "";
      };
      img.src = window.BattleSocial?.avatarUrl(profile.avatar, profile.name) || "";
    });
    refs.playerSummary.hidden = false;
    refs.openProfile.hidden = false;
  }

  function showComingSoon(label) {
    const region = document.getElementById("toastRegion");
    if (!region) return;
    const item = document.createElement("div");
    item.className = "toast";
    item.textContent = `${label}尚未開放。`;
    region.appendChild(item);
    window.setTimeout(() => item.remove(), 2600);
  }

  function sanitizeChessRoomCode(value) {
    return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  }

  function enterChessRoomPage(action, roomCode = "", role = "player") {
    try {
      sessionStorage.setItem(ENTRY_KEY, "1");
      sessionStorage.setItem("op_battle_chess_room_action", action);
      sessionStorage.setItem("op_battle_chess_room_role", role);
      if (roomCode) sessionStorage.setItem("op_battle_chess_room_code", roomCode);
      else if (action === "create") sessionStorage.removeItem("op_battle_chess_room_code");
    } catch (_) {}
    const next = new URL("./battle-game.html", location.href);
    next.searchParams.set("room_action", action);
    next.searchParams.set("ui", "waiting-room-gate-v1-20260905");
    if (roomCode) next.searchParams.set("room", roomCode);
    if (role === "spectator") next.searchParams.set("spectate", "1");
    if (localPreview) next.searchParams.set("local_preview", "1");
    next.searchParams.set("server", serverOrigin);
    location.href = next.href;
  }

  function setRoomMessage(message = "") {
    if (refs.roomMessage) refs.roomMessage.textContent = message;
  }

  function roomStatusLabel(room) {
    if (room.status === "playing") return `交戰中・${Number(room.spectatorCount) || 0} 人觀戰`;
    if (Number(room.total) >= Number(room.maxPlayers || 2)) return "等待室已滿";
    return `${Number(room.total) || 0}/${Number(room.maxPlayers) || 2} 人・等待加入`;
  }

  function renderChessRoomList() {
    if (!refs.roomList || !refs.roomEmpty) return;
    refs.roomList.replaceChildren();
    const visible = chessRoomList.filter((room) => (
      chessRoomFilter === "playing"
        ? room.status === "playing" && room.allowSpectators !== false
        : room.status !== "closed"
    ));
    refs.roomEmpty.hidden = visible.length > 0;
    refs.roomEmpty.textContent = chessRoomFilter === "playing"
      ? "目前沒有可觀戰的公開棋局"
      : "目前沒有公開的霸海棋局";
    visible.forEach((room) => {
      const row = document.createElement("article");
      row.className = "public-room-row";
      const info = document.createElement("div");
      const title = document.createElement("strong");
      const meta = document.createElement("span");
      title.textContent = String(room.title || `${room.hostName || "房主"} 的霸海棋局`);
      meta.textContent = `${sanitizeChessRoomCode(room.roomCode || room.roomId)}・${roomStatusLabel(room)}`;
      info.append(title, meta);
      const action = document.createElement("button");
      const spectating = room.status === "playing";
      action.type = "button";
      action.textContent = spectating ? "觀戰" : "加入";
      action.disabled = spectating && room.allowSpectators === false;
      action.addEventListener("click", () => enterChessRoomPage(
        spectating ? "spectate" : "join",
        sanitizeChessRoomCode(room.roomCode || room.roomId),
        spectating ? "spectator" : "player"
      ));
      row.append(info, action);
      refs.roomList.appendChild(row);
    });
  }

  function wireChessRoomSocket(socket) {
    if (!socket || chessRoomSocketWired) return;
    chessRoomSocketWired = true;
    socket.on("CHESS_ROOM_LIST", (message = {}) => {
      if (!Array.isArray(message.rooms)) return;
      chessRoomList = message.rooms;
      renderChessRoomList();
    });
    socket.on("connect", () => {
      if (refs.roomConnection) refs.roomConnection.textContent = "已連上霸海戰棋房間服務，可建立、加入或觀戰。";
      if (document.body.dataset.appView === "play") refreshChessRooms();
    });
    socket.on("disconnect", () => {
      if (refs.roomConnection) refs.roomConnection.textContent = "房間服務已斷線，正在等待重新連線。";
    });
  }

  async function refreshChessRooms() {
    if (localPreview) {
      chessRoomList = [];
      renderChessRoomList();
      if (refs.roomConnection) refs.roomConnection.textContent = "本機測試模式可建立 CPU 棋局；線上房間需連上共用伺服器。";
      setRoomMessage("");
      return;
    }
    if (refs.roomConnection) refs.roomConnection.textContent = "正在讀取公開房間…";
    const socket = await ensureSocket();
    if (!socket) {
      if (refs.roomConnection) refs.roomConnection.textContent = "無法連上霸海戰棋房間服務。";
      setRoomMessage("請確認共用伺服器已啟動。");
      return;
    }
    wireChessRoomSocket(socket);
    const result = await emitAck(socket, "CHESS_ROOM_LIST", { includePlaying: true });
    if (!result.ok) {
      if (refs.roomConnection) refs.roomConnection.textContent = "目前的伺服器尚未支援霸海戰棋房間。";
      setRoomMessage("請重新啟動已更新的共用伺服器後再試。");
      return;
    }
    chessRoomList = Array.isArray(result.rooms) ? result.rooms : [];
    if (refs.roomConnection) refs.roomConnection.textContent = "已連上霸海戰棋房間服務，可建立、加入或觀戰。";
    setRoomMessage("");
    renderChessRoomList();
  }

  function initializeApp(profile) {
    currentProfile = profile;
    try {
      sessionStorage.setItem(ENTRY_KEY, "1");
      sessionStorage.setItem("op_battle_chess_local_preview", localPreview ? "1" : "0");
    } catch (_) {}
    refs.entry.setAttribute("aria-hidden", "true");
    refs.entry.hidden = true;
    refs.app.setAttribute("aria-hidden", "false");
    refs.app.hidden = false;
    window.BattleSocial?.init({ socket: entrySocket, profile, serverOrigin, localPreview });
    fillProfile(profile);
    setAppView("home");
    const initialSummary = window.BattleSocial?.getSummary?.();
    if (initialSummary) updateSocialSummary(initialSummary);
  }

  async function validateSecret(secret, usernameHint = "") {
    const normalizedSecret = String(secret || "").trim();
    if (!normalizedSecret) {
      setStage("auth");
      return;
    }
    setStage("boot");
    refs.bootMessage.textContent = "正在驗證共用玩家帳號…";
    refs.bootActions.hidden = true;
    const socket = await ensureSocket();
    if (!socket) {
      showBootFailure("無法載入共用登入服務。請先啟動《偉大航道爭霸戰》正式伺服器，或檢查目前網址。", () => validateSecret(normalizedSecret, usernameHint));
      return;
    }
    const result = await emitAck(socket, "PROFILE_GET", { secret: normalizedSecret });
    if (!result.ok) {
      showBootFailure(translateAuthError(result.error), () => validateSecret(normalizedSecret, usernameHint));
      return;
    }
    if (!result.profile) {
      clearSecret();
      setStage("auth");
      refs.authMessage.textContent = "登入已失效，請重新輸入帳號與密碼。";
      return;
    }
    const profile = persistProfile(normalizedSecret, result.profile, usernameHint);
    if (!profile) {
      showBootFailure("帳號資料不完整，請重新登入後再試。", () => validateSecret(normalizedSecret, usernameHint));
      return;
    }
    initializeApp(profile);
  }

  async function begin() {
    if (stage !== "press") return;
    stage = "logo-exit";
    document.body.dataset.entryStage = "logo-exit";
    refs.startButton.disabled = true;
    await new Promise((resolve) => setTimeout(resolve, 420));
    refs.startButton.disabled = false;
    const savedSecret = String(readStorage("opSecret", "") || readStorage("op_secret", "")).trim();
    if (savedSecret && !localPreview && !temporaryDirectLogin) {
      await validateSecret(savedSecret, readStorage("op_last_username", ""));
      return;
    }
    setStage("auth");
  }

  function updateSocialSummary(detail = {}) {
    const friendCount = Math.max(0, Number(detail.friendCount) || 0);
    const onlineCount = Math.max(0, Number(detail.onlineCount) || 0);
    const requestCount = Math.max(0, Number(detail.requestCount) || 0);
    const unreadCount = Math.max(0, Number(detail.unreadCount) || 0);
    refs.socialFriendCount.textContent = String(friendCount);
    refs.socialOnlineCount.textContent = String(onlineCount);
    refs.socialRequestCount.textContent = String(requestCount);
    refs.socialUnreadCount.textContent = String(unreadCount);
    const totalAttention = requestCount + unreadCount;
    refs.socialMenuBadge.hidden = totalAttention === 0;
    refs.socialMenuBadge.textContent = String(Math.min(99, totalAttention));
    if (localPreview) {
      refs.socialConnection.textContent = "本機快速測試中；好友與聊天室等待正式帳號接入，不會產生假好友或假訊息。";
      refs.socialMenuHint.textContent = "本機測試・等待正式帳號接入";
    } else if (detail.ready) {
      refs.socialConnection.textContent = `已連上共用好友服務，${onlineCount} 位好友上線。`;
      refs.socialMenuHint.textContent = `${friendCount} 位好友・${onlineCount} 位上線`;
    } else {
      refs.socialConnection.textContent = detail.error || "正在連接共用好友服務…";
      refs.socialMenuHint.textContent = detail.loading ? "正在同步共用好友資料…" : (detail.error || "好友服務尚未連線");
    }
  }

  refs.loginTab.addEventListener("click", () => setAuthMode("login"));
  refs.registerTab.addEventListener("click", () => setAuthMode("register"));
  refs.authBack.addEventListener("click", () => {
    refs.password.value = "";
    refs.authMessage.textContent = "";
    setStage("press");
  });
  refs.bootRetry.addEventListener("click", () => { refs.bootActions.hidden = true; retryAction?.(); });
  refs.bootLogin.addEventListener("click", () => {
    clearSecret();
    refs.password.value = "";
    setStage("auth");
  });
  refs.startButton.addEventListener("click", begin);
  document.addEventListener("keydown", (event) => {
    if (stage !== "press" || ["Tab", "Shift", "Control", "Alt", "Meta"].includes(event.key)) return;
    event.preventDefault();
    begin();
  });

  refs.authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = String(refs.username.value || "").trim().toLowerCase();
    const password = String(refs.password.value || "");
    if ((temporaryDirectLogin || localPreview) && authMode === "login") {
      const previewName = username || readStorage("op_last_username", "") || readStorage("op_name", "") || "本機測試玩家";
      let userId = 700000;
      for (const char of previewName) userId = ((userId * 31) + char.codePointAt(0)) % 900000000;
      userId = Math.max(700000, userId);
      clearSecret();
      writeStorage("op_last_username", previewName);
      writeStorage("op_user_id", userId);
      writeStorage("op_name", previewName);
      writeStorage("op_player_name", previewName);
      const profile = { userId, name: previewName, avatar: Number(readStorage("op_avatar", "8")) || 8, title: "本機航海測試", coins: 0 };
      refs.password.value = "";
      localPreview = true;
      document.body.dataset.entryAuthSource = temporaryDirectLogin ? "temporary-direct" : "local-preview";
      initializeApp(profile);
      return;
    }
    if (!username || !password) {
      refs.authMessage.textContent = "請輸入帳號與密碼。";
      return;
    }
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      refs.authMessage.textContent = "帳號需為 3～24 字，只能使用英文、數字與底線。";
      return;
    }
    if (password.length < 6 || password.length > 72) {
      refs.authMessage.textContent = "密碼長度必須是 6～72 字。";
      return;
    }
    const socket = await ensureSocket();
    if (!socket) {
      refs.authMessage.textContent = "無法連上共用帳號伺服器。";
      return;
    }
    refs.authSubmit.disabled = true;
    refs.authSubmit.textContent = authMode === "register" ? "建立中…" : "登入中…";
    refs.authMessage.textContent = "";
    const eventName = authMode === "register" ? "AUTH_REGISTER" : "AUTH_LOGIN";
    const result = await emitAck(socket, eventName, { username, password, deviceId: getDeviceId() });
    refs.password.value = "";
    refs.authSubmit.disabled = false;
    refs.authSubmit.textContent = authMode === "register" ? "建立帳號" : "登入";
    if (!result.ok || !result.secret) {
      refs.authMessage.textContent = translateAuthError(result.error);
      return;
    }
    writeStorage("op_last_username", username);
    writeStorage("opSecret", result.secret);
    writeStorage("op_secret", result.secret);
    await validateSecret(result.secret, username);
  });

  refs.startMatch.addEventListener("click", () => {
    setAppView("play");
    chessRoomFilter = "all";
    renderChessRoomList();
    refreshChessRooms();
  });
  refs.createRoom.addEventListener("click", () => {
    enterChessRoomPage("create");
  });
  refs.joinRoom.addEventListener("click", () => {
    const code = sanitizeChessRoomCode(refs.roomCode?.value);
    if (!code) {
      setRoomMessage("請先輸入房間代碼。");
      refs.roomCode?.focus();
      return;
    }
    if (localPreview) {
      setRoomMessage("本機測試登入不能加入線上房間；請使用共用帳號登入。");
      return;
    }
    enterChessRoomPage("join", code, "player");
  });
  refs.roomCode?.addEventListener("input", () => {
    const value = sanitizeChessRoomCode(refs.roomCode.value);
    if (refs.roomCode.value !== value) refs.roomCode.value = value;
    setRoomMessage("");
  });
  refs.roomCode?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") refs.joinRoom.click();
  });
  refs.spectateRoom.addEventListener("click", () => {
    chessRoomFilter = chessRoomFilter === "playing" ? "all" : "playing";
    renderChessRoomList();
    setRoomMessage(chessRoomFilter === "playing" ? "已只顯示可觀戰的進行中棋局。" : "已顯示全部公開房間。");
    refreshChessRooms();
  });
  refs.refreshRooms?.addEventListener("click", refreshChessRooms);
  refs.continueMatch.addEventListener("click", () => {
    try { sessionStorage.setItem(ENTRY_KEY, "1"); } catch (_) {}
    location.href = "./battle-game.html?resume=1&ui=waiting-room-gate-v1-20260905";
  });
  refs.openSocial.addEventListener("click", () => setAppView("social"));
  refs.openProfile.addEventListener("click", () => showComingSoon("個人頁面"));
  refs.openShop.addEventListener("click", () => showComingSoon("商店"));
  refs.playerSummary.addEventListener("click", () => showComingSoon("個人頁面"));
  refs.openFriendDock.addEventListener("click", () => window.BattleSocial?.openDock());
  document.querySelectorAll("[data-back-home]").forEach((button) => button.addEventListener("click", () => setAppView("home")));
  refs.logout.addEventListener("click", () => {
    try { entrySocket?.disconnect(); } catch (_) {}
    clearSharedProfile();
    try { sessionStorage.removeItem(ENTRY_KEY); } catch (_) {}
    location.href = "./index.html";
  });
  window.addEventListener("battle:social-updated", (event) => updateSocialSummary(event.detail || {}));

  const savedUsername = readStorage("op_last_username", "");
  if (savedUsername) refs.username.value = savedUsername;
  setAuthMode("login");
  setStage("press");

  const runtime = await resolveRuntime();
  localPreview = runtime?.accountDatabaseEnabled === false && ["127.0.0.1", "localhost", "::1"].includes(location.hostname);
  document.body.dataset.entryAuthSource = localPreview ? "local-preview" : "shared-account";
  if (temporaryDirectLogin) {
    refs.authForm.noValidate = true;
    refs.username.required = false;
    refs.password.required = false;
    refs.authRuntimeNote.textContent = "暫時測試模式：不需帳密，按「直接進入」即可進入主選單。";
    setAuthMode("login");
  } else if (localPreview) {
    refs.registerTab.hidden = true;
    refs.authForm.noValidate = true;
    refs.username.required = false;
    refs.password.required = false;
    refs.authRuntimeNote.textContent = "伺服器明確回報帳號資料庫未啟用：本機可快速測試。";
    setAuthMode("login");
  } else if (location.protocol === "file:") {
    refs.authRuntimeNote.textContent = `直接開啟模式會連線共用伺服器 ${serverOrigin}；不會跳過帳密。`;
  } else {
    refs.authRuntimeNote.textContent = "使用《偉大航道爭霸戰》與《新世界航海錄》的共用帳號。";
  }

  if (query.get("kicked") === "1") {
    clearSecret();
    setStage("auth");
    refs.authMessage.textContent = "此帳號已在其他裝置登入，請重新登入後繼續。";
  } else if (["game", "social", "profile"].includes(String(query.get("view") || ""))) {
    begin();
  }
})();
