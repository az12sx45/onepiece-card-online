(function () {
  "use strict";

  const state = {
    socket: null,
    profile: null,
    serverOrigin: "",
    localPreview: false,
    ready: false,
    loading: false,
    error: "",
    friends: [],
    requestsIn: [],
    requestsOut: [],
    unread: new Map(),
    chats: new Map(),
    refreshTimer: 0,
    initialized: false,
    roomContext: null,
  };

  const refs = {};

  function byId(id) { return document.getElementById(id); }
  function readStorage(key, fallback = "") {
    try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; }
  }

  function fallbackAvatar(name = "P") {
    const letter = String(name || "P").trim().slice(0, 1).toUpperCase() || "P";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><defs><radialGradient id="g" cx="38%" cy="30%" r="78%"><stop stop-color="#21475b"/><stop offset=".58" stop-color="#0c2433"/><stop offset="1" stop-color="#050e17"/></radialGradient><radialGradient id="v"><stop offset=".58" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></radialGradient></defs><circle cx="48" cy="48" r="48" fill="url(#g)"/><circle cx="48" cy="48" r="48" fill="url(#v)"/><text x="48" y="62" text-anchor="middle" font-family="Arial,sans-serif" font-size="40" font-weight="800" fill="#f5dea0">${letter.replace(/[<>&"']/g, "")}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function avatarUrl(id, name = "P") {
    if (state.localPreview) return fallbackAvatar(name);
    const avatarId = Math.max(1, Math.min(2000, Number(id) || 8));
    const origin = state.serverOrigin || (location.protocol.startsWith("http") ? location.origin : "");
    return origin ? `${origin}/images/board/avatars/${avatarId}.webp` : fallbackAvatar();
  }

  function setImage(img, id, name) {
    if (!img) return;
    img.onerror = () => {
      img.onerror = null;
      img.src = fallbackAvatar(name);
    };
    img.src = avatarUrl(id, name);
  }

  function secret() {
    return String(readStorage("opSecret", "") || readStorage("op_secret", "")).trim();
  }

  function deviceId() {
    return String(readStorage("op_device_id", "")).trim();
  }

  function emitAck(eventName, payload, timeoutMs = 12000) {
    return new Promise((resolve) => {
      if (!state.socket) {
        resolve({ ok: false, error: "socket unavailable" });
        return;
      }
      try {
        state.socket.timeout(timeoutMs).emit(eventName, payload, (error, result = {}) => {
          resolve(error ? { ok: false, error: "timeout" } : (result || { ok: false, error: "unknown" }));
        });
      } catch (error) {
        resolve({ ok: false, error: String(error?.message || error || "socket error") });
      }
    });
  }

  function translateError(error, fallback = "好友服務暫時無法使用。") {
    const code = String(error || "").trim();
    const map = {
      "bad secret": "登入已失效，請重新登入。",
      "not found": "找不到這個玩家名稱。",
      "cannot add self": "不能加入自己為好友。",
      "already friends": "你們已經是好友。",
      "request already sent": "好友邀請已送出，等待對方確認。",
      "no incoming request": "這筆好友邀請已失效。",
      "not friends": "你們還不是好友。",
      "too long": "訊息最多 400 個字。",
      "empty": "請先輸入訊息。",
      "timeout": "伺服器沒有回應，請稍後重試。",
      "socket unavailable": "好友服務尚未連線。",
      "no room": "目前沒有可邀請加入的房間。",
      "room not found": "這個房間已經關閉。",
      "room already started": "這個房間已經開始對局。",
      "not room member": "只有房間內的玩家可以邀請好友。",
      "offline": "好友目前不在線上。",
      "muted": "好友目前暫停接收遊戲邀請。",
      "invite not found": "邀請已失效，請請好友重新邀請。",
    };
    return map[code] || code || fallback;
  }

  function toast(text) {
    if (!refs.toastRegion) return;
    const item = document.createElement("div");
    item.className = "toast";
    item.textContent = String(text || "");
    refs.toastRegion.appendChild(item);
    setTimeout(() => item.remove(), 3000);
  }

  function showChessInvite(invite = {}) {
    if (!refs.toastRegion || !invite.inviteId || !invite.roomId) return;
    const item = document.createElement("section");
    item.className = "toast toast--invite";
    const title = document.createElement("strong");
    title.textContent = `${invite.fromName || "好友"} 邀請你加入霸海戰棋`;
    const detail = document.createElement("span");
    detail.textContent = `房間 ${String(invite.roomId).toUpperCase()} · 邀請將在 2 分鐘後失效`;
    const actions = document.createElement("span");
    actions.className = "toast__actions";
    const accept = document.createElement("button");
    accept.type = "button";
    accept.textContent = "加入房間";
    const reject = document.createElement("button");
    reject.type = "button";
    reject.textContent = "拒絕";
    actions.append(accept, reject);
    item.append(title, detail, actions);
    refs.toastRegion.appendChild(item);

    let handling = false;
    async function respond(action) {
      if (handling) return;
      handling = true;
      accept.disabled = true;
      reject.disabled = true;
      const result = await emitAck("LOBBY_INVITE_RESPOND", {
        secret: secret(),
        inviteId: String(invite.inviteId),
        action,
      });
      if (!result.ok) {
        handling = false;
        accept.disabled = false;
        reject.disabled = false;
        detail.textContent = translateError(result.error, "邀請處理失敗。");
        return;
      }
      item.remove();
      if (action !== "accept") return;
      const roomCode = String(result.roomId || invite.roomId || "").trim().toUpperCase();
      try {
        sessionStorage.setItem("op_battle_chess_entry_ready", "1");
        sessionStorage.setItem("op_battle_chess_local_preview", "0");
        sessionStorage.setItem("op_battle_chess_room_action", "join");
        sessionStorage.setItem("op_battle_chess_room_role", "player");
        sessionStorage.setItem("op_battle_chess_room_code", roomCode);
        if (state.serverOrigin) localStorage.setItem("op_shared_server_origin", state.serverOrigin);
      } catch (_) {}
      const next = new URL("./battle-game.html", location.href);
      next.searchParams.set("room_action", "join");
      next.searchParams.set("ui", "preparation-frame-front-v2-20260904");
      next.searchParams.set("room", roomCode);
      if (state.serverOrigin) next.searchParams.set("server", state.serverOrigin);
      location.href = next.href;
    }

    accept.addEventListener("click", () => respond("accept"));
    reject.addEventListener("click", () => respond("reject"));
    const remaining = Math.max(1000, Number(invite.expiresAt || 0) - Date.now());
    setTimeout(() => item.remove(), Math.min(remaining, 120000));
  }

  function setHint(text) {
    if (!refs.friendHint) return;
    const value = String(text || "");
    refs.friendHint.textContent = value;
    refs.friendHint.hidden = !value;
  }

  function summary() {
    return {
      ready: state.ready,
      loading: state.loading,
      error: state.error,
      friendCount: state.friends.length,
      onlineCount: state.friends.filter((friend) => friend.online).length,
      requestCount: state.requestsIn.length,
      unreadCount: Array.from(state.unread.values()).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0),
    };
  }

  function publish() {
    window.dispatchEvent(new CustomEvent("battle:social-updated", { detail: summary() }));
  }

  function setDockExpanded(expanded) {
    if (!refs.friendDock) return;
    refs.friendDock.classList.toggle("is-collapsed", !expanded);
    refs.friendDockToggle.textContent = expanded ? "−" : "+";
    refs.friendDockToggle.setAttribute("aria-expanded", String(expanded));
    try { localStorage.setItem("op_battle_friend_dock_collapsed", expanded ? "0" : "1"); } catch (_) {}
  }

  function section(title) {
    const el = document.createElement("div");
    el.className = "friend-section";
    el.textContent = title;
    return el;
  }

  function actionButton(label, className, handler, title = label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `friend-action ${className || ""}`.trim();
    button.textContent = label;
    button.title = title;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      handler();
    });
    return button;
  }

  function friendRow(person, subtitle) {
    const row = document.createElement("div");
    row.className = "friend-row";
    const avatar = document.createElement("span");
    avatar.className = "friend-avatar";
    const img = document.createElement("img");
    img.alt = "";
    setImage(img, person.avatar, person.name);
    avatar.appendChild(img);
    const meta = document.createElement("span");
    meta.className = "friend-row__meta";
    const name = document.createElement("strong");
    name.textContent = person.name || `#${person.userId}`;
    const sub = document.createElement("small");
    sub.textContent = subtitle;
    meta.append(name, sub);
    const actions = document.createElement("span");
    actions.className = "friend-row__actions";
    row.append(avatar, meta, actions);
    row._actions = actions;
    return row;
  }

  async function respondFriendRequest(request, action) {
    const eventName = action === "accept" ? "FRIEND_REQUEST_ACCEPT" : "FRIEND_REQUEST_DECLINE";
    const result = await emitAck(eventName, { secret: secret(), userId: Number(request.userId) });
    if (!result.ok) {
      setHint(translateError(result.error, "好友邀請處理失敗。"));
      return;
    }
    toast(action === "accept" ? `已和 ${request.name} 成為好友` : `已拒絕 ${request.name} 的好友邀請`);
    await fetchFriends();
  }

  async function removeFriend(friend) {
    if (!window.confirm(`確定要刪除好友「${friend.name}」嗎？`)) return;
    const result = await emitAck("FRIEND_REMOVE", { secret: secret(), userId: Number(friend.userId) });
    if (!result.ok) {
      setHint(translateError(result.error, "刪除好友失敗。"));
      return;
    }
    closeChat(Number(friend.userId));
    toast(`已刪除好友 ${friend.name}`);
    await fetchFriends();
  }

  async function sendChessInvite(friend) {
    const roomCode = String(state.roomContext?.roomCode || "").trim().toUpperCase();
    if (!roomCode || state.roomContext?.status !== "waiting") {
      toast("請先建立並進入等待中的西洋棋房間。");
      return;
    }
    const result = await emitAck("LOBBY_INVITE_SEND", {
      secret: secret(),
      toUserId: Number(friend.userId),
      roomId: roomCode,
      mode: "chess",
    });
    if (!result.ok) {
      toast(translateError(result.error, "房間邀請送出失敗。"));
      return;
    }
    toast(`已邀請 ${friend.name || "好友"} 加入房間 ${roomCode}`);
  }

  function renderFriends() {
    if (!refs.friendList) return;
    refs.friendList.replaceChildren();

    if (state.localPreview) {
      const empty = document.createElement("div");
      empty.className = "friend-empty";
      empty.textContent = "本機測試模式不會製造假好友或假訊息。好友與聊天室正在等待正式帳號資料庫接入。";
      refs.friendList.appendChild(empty);
      return;
    }

    if (state.requestsIn.length) {
      refs.friendList.appendChild(section(`好友邀請（${state.requestsIn.length}）`));
      state.requestsIn.forEach((request) => {
        const row = friendRow(request, "想加你為好友");
        row._actions.append(
          actionButton("確認", "friend-action--gold", () => respondFriendRequest(request, "accept")),
          actionButton("拒絕", "friend-action--danger", () => respondFriendRequest(request, "decline")),
        );
        refs.friendList.appendChild(row);
      });
    }

    if (state.requestsOut.length) {
      refs.friendList.appendChild(section("等待對方確認"));
      state.requestsOut.forEach((request) => refs.friendList.appendChild(friendRow(request, "邀請已送出")));
    }

    if (state.friends.length) refs.friendList.appendChild(section("好友名單"));
    [...state.friends]
      .sort((a, b) => Number(Boolean(b.online)) - Number(Boolean(a.online)) || String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant"))
      .forEach((friend) => {
        const row = friendRow(friend, `${friend.online ? "● " + (friend.activity || "線上") : "○ 離線"}`);
        row.addEventListener("click", () => openChat(friend));
        row._actions.append(
          actionButton("聊", "", () => openChat(friend), "私人訊息"),
          actionButton("邀", "friend-action--gold", () => sendChessInvite(friend), "邀請加入霸海戰棋房間"),
          actionButton("×", "friend-action--danger", () => removeFriend(friend), "刪除好友"),
        );
        const unread = Math.max(0, Number(state.unread.get(Number(friend.userId))) || 0);
        if (unread) row._actions.prepend(actionButton(String(Math.min(99, unread)), "friend-action--gold", () => openChat(friend), "未讀訊息"));
        refs.friendList.appendChild(row);
      });

    if (!state.loading && !state.friends.length && !state.requestsIn.length && !state.requestsOut.length) {
      const empty = document.createElement("div");
      empty.className = "friend-empty";
      empty.textContent = state.ready ? "目前沒有好友。可在上方輸入玩家名稱送出邀請。" : (state.error || "正在讀取好友清單…");
      refs.friendList.appendChild(empty);
    }
  }

  function appendMessage(peerId, message) {
    const chat = state.chats.get(Number(peerId));
    if (!chat) return;
    const item = document.createElement("div");
    item.className = `chat-message${Number(message.from) === Number(state.profile?.userId) ? " is-me" : ""}`;
    item.appendChild(document.createTextNode(String(message.body || "")));
    const time = document.createElement("time");
    const date = new Date(Number(message.ts) || Date.now());
    time.textContent = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    item.appendChild(time);
    chat.log.appendChild(item);
    chat.log.scrollTop = chat.log.scrollHeight + 999;
  }

  async function loadHistory(peerId) {
    const chat = state.chats.get(Number(peerId));
    if (!chat) return;
    chat.log.replaceChildren();
    const result = await emitAck("DM_HISTORY", { secret: secret(), withUserId: Number(peerId), limit: 60 });
    if (!result.ok) {
      const note = document.createElement("div");
      note.className = "friend-empty";
      note.textContent = translateError(result.error, "聊天記錄讀取失敗。");
      chat.log.appendChild(note);
      return;
    }
    (Array.isArray(result.messages) ? result.messages : []).forEach((message) => appendMessage(peerId, message));
  }

  async function sendMessage(peerId) {
    const chat = state.chats.get(Number(peerId));
    if (!chat) return;
    const body = String(chat.input.value || "").trim();
    if (!body) return;
    chat.input.value = "";
    const result = await emitAck("DM_SEND", { secret: secret(), toUserId: Number(peerId), body });
    if (!result.ok) {
      chat.input.value = body;
      setHint(translateError(result.error, "訊息送出失敗。"));
      return;
    }
    if (result.message) appendMessage(peerId, result.message);
  }

  function closeChat(peerId) {
    const chat = state.chats.get(Number(peerId));
    if (!chat) return;
    chat.element.remove();
    state.chats.delete(Number(peerId));
  }

  function openChat(friend) {
    if (!state.ready || state.localPreview) {
      toast("聊天服務需要正式共用帳號連線。");
      return;
    }
    const peerId = Number(friend.userId);
    state.unread.set(peerId, 0);
    publish();
    renderFriends();
    const existing = state.chats.get(peerId);
    if (existing) {
      existing.element.classList.remove("is-minimized");
      existing.input.focus();
      return;
    }

    const win = document.createElement("section");
    win.className = "chat-window";
    win.setAttribute("aria-label", `與 ${friend.name} 的私人訊息`);
    const header = document.createElement("div");
    header.className = "chat-header";
    const avatar = document.createElement("span");
    avatar.className = "friend-avatar";
    const img = document.createElement("img");
    img.alt = "";
    setImage(img, friend.avatar, friend.name);
    avatar.appendChild(img);
    const meta = document.createElement("span");
    meta.className = "chat-header__meta";
    const name = document.createElement("strong");
    name.textContent = friend.name || `#${peerId}`;
    const status = document.createElement("small");
    status.textContent = friend.online ? (friend.activity || "線上") : "離線";
    meta.append(name, status);
    const min = document.createElement("button");
    min.type = "button";
    min.textContent = "−";
    min.title = "縮小";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.title = "關閉";
    header.append(avatar, meta, min, close);
    const log = document.createElement("div");
    log.className = "chat-log";
    const inputWrap = document.createElement("div");
    inputWrap.className = "chat-input";
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 400;
    input.placeholder = "輸入訊息…";
    const send = document.createElement("button");
    send.type = "button";
    send.textContent = "送出";
    inputWrap.append(input, send);
    win.append(header, log, inputWrap);
    refs.chatTray.appendChild(win);
    state.chats.set(peerId, { element: win, log, input, friend });
    min.addEventListener("click", () => win.classList.toggle("is-minimized"));
    meta.addEventListener("click", () => win.classList.remove("is-minimized"));
    close.addEventListener("click", () => closeChat(peerId));
    send.addEventListener("click", () => sendMessage(peerId));
    input.addEventListener("keydown", (event) => { if (event.key === "Enter") sendMessage(peerId); });
    loadHistory(peerId);
    input.focus();
  }

  function handleDirectMessage(message = {}) {
    if (!state.ready) return;
    const myId = Number(state.profile?.userId) || 0;
    const fromId = Number(message.from) || 0;
    const peerId = fromId === myId ? Number(message.to) || 0 : fromId;
    if (!peerId) return;
    if (state.chats.has(peerId)) {
      appendMessage(peerId, message);
      const chat = state.chats.get(peerId);
      if (chat.element.classList.contains("is-minimized") && fromId !== myId) state.unread.set(peerId, Math.max(1, Number(state.unread.get(peerId) || 0) + 1));
    } else if (fromId !== myId) {
      state.unread.set(peerId, Math.max(1, Number(state.unread.get(peerId) || 0) + 1));
    }
    renderFriends();
    publish();
  }

  async function fetchFriends() {
    if (state.localPreview) {
      state.loading = false;
      state.ready = false;
      state.error = "等待正式帳號接入";
      renderFriends();
      publish();
      return;
    }
    state.loading = true;
    publish();
    const result = await emitAck("FRIENDS_GET", { secret: secret() });
    state.loading = false;
    if (!result.ok) {
      state.ready = false;
      state.error = translateError(result.error, "好友清單讀取失敗。");
      setHint(state.error);
      renderFriends();
      publish();
      return;
    }
    state.friends = Array.isArray(result.friends) ? result.friends.slice(0, 200) : [];
    state.requestsIn = Array.isArray(result.requestsIn) ? result.requestsIn.slice(0, 200) : [];
    state.requestsOut = Array.isArray(result.requestsOut) ? result.requestsOut.slice(0, 200) : [];
    state.ready = true;
    state.error = "";
    setHint("");
    renderFriends();
    publish();
  }

  async function socialAuth() {
    if (state.localPreview) {
      state.ready = false;
      state.error = "本機測試模式：等待正式帳號接入";
      renderFriends();
      publish();
      return;
    }
    if (!state.socket || !secret()) {
      state.ready = false;
      state.error = "請先登入玩家帳號。";
      renderFriends();
      publish();
      return;
    }
    state.loading = true;
    state.error = "";
    setHint("正在連接好友服務…");
    publish();
    const result = await emitAck("SOCIAL_AUTH", { secret: secret(), deviceId: deviceId() });
    if (!result.ok) {
      state.loading = false;
      state.ready = false;
      state.error = translateError(result.error, "好友服務登入失敗。");
      setHint(state.error);
      renderFriends();
      publish();
      return;
    }
    state.loading = false;
    state.ready = true;
    try { state.socket.emit("PRESENCE_SET", { secret: secret(), page: "chess", deviceId: deviceId() }); } catch (_) {}
    await fetchFriends();
  }

  async function addFriend() {
    const name = String(refs.friendAddInput?.value || "").trim();
    if (!name) return;
    const result = await emitAck("FRIEND_ADD_BY_NAME", { secret: secret(), name });
    if (!result.ok) {
      setHint(translateError(result.error, "好友邀請送出失敗。"));
      return;
    }
    refs.friendAddInput.value = "";
    toast(`已向 ${result.to?.name || name} 送出好友邀請`);
    await fetchFriends();
  }

  function wireSocket() {
    if (!state.socket || state.socket.__battleSocialWired) return;
    state.socket.__battleSocialWired = true;
    state.socket.on("connect", socialAuth);
    state.socket.on("disconnect", () => {
      state.ready = false;
      state.loading = false;
      state.error = "好友服務已斷線，正在等待重新連線。";
      setHint(state.error);
      publish();
    });
    state.socket.on("FRIENDS_DIRTY", fetchFriends);
    state.socket.on("DM_NEW", handleDirectMessage);
    state.socket.on("EMIT", (message = {}) => {
      if (message.type === "chess_lobby_invite") showChessInvite(message.invite || {});
      else if (message.type === "toast" && message.text) toast(message.text);
    });
    state.socket.on("SESSION_KICK", (info = {}) => {
      try {
        localStorage.setItem("op_kicked_reason", info.reason || "takeover");
        localStorage.removeItem("opSecret");
        localStorage.removeItem("op_secret");
      } catch (_) {}
      location.href = "./index.html?kicked=1";
    });
  }

  function bindUi() {
    refs.friendDockToggle.addEventListener("click", () => setDockExpanded(refs.friendDock.classList.contains("is-collapsed")));
    refs.friendDockOpen.addEventListener("click", () => setDockExpanded(true));
    refs.friendAddBtn.addEventListener("click", addFriend);
    refs.friendAddInput.addEventListener("keydown", (event) => { if (event.key === "Enter") addFriend(); });
  }

  function init(options = {}) {
    if (state.initialized) return;
    state.initialized = true;
    state.socket = options.socket || null;
    state.profile = options.profile || null;
    state.serverOrigin = String(options.serverOrigin || "").replace(/\/$/, "");
    state.localPreview = Boolean(options.localPreview);
    Object.assign(refs, {
      friendDock: byId("friendDock"), friendDockToggle: byId("friendDockToggle"), friendDockOpen: byId("friendDockOpen"),
      friendAddInput: byId("friendAddInput"), friendAddBtn: byId("friendAddBtn"), friendList: byId("friendList"),
      friendHint: byId("friendHint"), chatTray: byId("chatTray"), toastRegion: byId("toastRegion"),
      dockAvatar: byId("dockAvatar"), dockName: byId("dockName"),
    });
    refs.friendDock.hidden = false;
    refs.dockName.textContent = state.profile?.name || "玩家";
    setImage(refs.dockAvatar, state.profile?.avatar, state.profile?.name);
    const collapsed = readStorage("op_battle_friend_dock_collapsed", "1") !== "0";
    setDockExpanded(!collapsed);
    bindUi();
    if (state.localPreview) {
      refs.friendAddInput.disabled = true;
      refs.friendAddBtn.disabled = true;
      state.error = "本機測試模式：等待正式帳號接入";
      setHint(state.error);
      renderFriends();
      publish();
      return;
    }
    wireSocket();
    if (state.socket?.connected) socialAuth();
    state.refreshTimer = window.setInterval(() => {
      if (state.socket?.connected && secret()) fetchFriends();
    }, 12000);
  }

  window.BattleSocial = {
    init,
    openDock() { setDockExpanded(true); if (!state.localPreview && state.socket?.connected) fetchFriends(); },
    refresh: fetchFriends,
    setRoomContext(context) {
      state.roomContext = context && typeof context === "object" ? { ...context } : null;
      renderFriends();
    },
    getSummary: summary,
    avatarUrl,
    fallbackAvatar,
  };
})();
