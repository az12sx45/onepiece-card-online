(function () {
  const STORAGE_KEYS = {
    boardRoom: "op_board_preview_room",
    boardLobby: "op_board_preview_lobby",
    boardClientId: "op_board_client_id",
    boardUserId: "op_board_user_id",
    deviceId: "op_device_id",
    friendDockCollapsed: "op_fdock_collapsed",
  };

  const MOCK_PROFILE = {
    userId: 10001,
    name: "草帽路飛",
    avatar: 8,
    coins: 12880,
    title: "新世界啟航者",
    titleTier: 5,
    wins: 24,
    rank: "Grand Line S",
  };

  const MOCK_ROOMS = [
    { roomId: "B7412", hostName: "索隆", total: 2, maxPlayers: 4, status: "waiting", title: "鬼斬試玩房" },
    { roomId: "B8201", hostName: "娜美", total: 3, maxPlayers: 4, status: "waiting", title: "航海士策略局" },
    { roomId: "B6008", hostName: "羅", total: 4, maxPlayers: 4, status: "full", title: "ROOM・Board" },
  ];

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, Number(n) || 0));
  }

  function avatarUrlById(id) {
    return `images/board/avatars/${clamp(id, 1, 2000)}.webp`;
  }

  function readJson(key, fallback) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function readLocalValue(key, fallback = "") {
    try {
      return localStorage.getItem(key) || fallback;
    } catch {
      return fallback;
    }
  }

  function writeLocalValue(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch {}
  }

  function getDeviceId() {
    let deviceId = String(readLocalValue(STORAGE_KEYS.deviceId, "") || "").trim();
    if (!deviceId) {
      deviceId = `dev_${randomIdFragment()}`;
      writeLocalValue(STORAGE_KEYS.deviceId, deviceId);
    }
    return deviceId;
  }

  function randomIdFragment() {
    if (window.crypto?.getRandomValues) {
      const buffer = new Uint32Array(2);
      window.crypto.getRandomValues(buffer);
      return `${buffer[0].toString(36)}${buffer[1].toString(36)}`;
    }
    return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
  }

  function storedLobbyProfile() {
    const lobby = readJson(STORAGE_KEYS.boardLobby, null);
    const queryRoom = new URLSearchParams(location.search).get("room") || "";
    const lobbyRoom = lobby?.roomCode || lobby?.roomId || "";
    if (queryRoom && String(lobbyRoom).toUpperCase() !== String(queryRoom).trim().toUpperCase()) return null;
    const players = Array.isArray(lobby?.players) ? lobby.players : [];
    const storedUserId = Number(readLocalValue(STORAGE_KEYS.boardUserId, ""));
    const storedClientId = String(readLocalValue(STORAGE_KEYS.boardClientId, "") || "").trim();
    return players.find((player) => player && player.isMe && Number(player.userId) > 0)
      || players.find((player) => player && Number.isFinite(storedUserId) && storedUserId > 0 && Number(player.userId) === storedUserId)
      || players.find((player) => player && storedClientId && String(player.clientId || "") === storedClientId)
      || players.find((player) => player && Number(player.userId) === Number(lobby?.hostUserId) && Number(player.userId) > 0)
      || null;
  }

  function stableBoardClientId(fallback = "") {
    let clientId = String(readLocalValue(STORAGE_KEYS.boardClientId, "") || "").trim();
    const fallbackClientId = String(fallback || "").trim();
    if (fallbackClientId && !fallbackClientId.startsWith("board-cpu-") && clientId !== fallbackClientId) {
      clientId = fallbackClientId;
      writeLocalValue(STORAGE_KEYS.boardClientId, clientId);
    }
    if (!clientId) {
      clientId = `board-${randomIdFragment()}`;
      writeLocalValue(STORAGE_KEYS.boardClientId, clientId);
    }
    return clientId;
  }

  function stableBoardUserId(fallback = 0) {
    const existing = Number(readLocalValue(STORAGE_KEYS.boardUserId, ""));
    const fallbackUserId = Number(fallback);
    if (Number.isFinite(fallbackUserId) && fallbackUserId > 0 && fallbackUserId !== MOCK_PROFILE.userId) {
      if (existing !== fallbackUserId) writeLocalValue(STORAGE_KEYS.boardUserId, fallbackUserId);
      return fallbackUserId;
    }
    if (Number.isFinite(existing) && existing > 0 && existing !== MOCK_PROFILE.userId) return existing;
    const generated = 700000 + Math.floor(Math.random() * 800000);
    writeLocalValue(STORAGE_KEYS.boardUserId, generated);
    return generated;
  }

  const state = {
    page: "board",
    roomId: "",
    profile: null,
    friends: [],
    requestsIn: [],
    requestsOut: [],
    rooms: [],
    invites: [],
    currentInvite: null,
    currentInviteMode: "board",
    unread: new Map(),
    openChats: new Map(),
    chatOrder: [],
    socket: null,
    socialMe: null,
    socialReady: false,
    socialLoading: false,
    socialError: "",
    socialRefreshTimer: 0,
  };

  function createProfile() {
    const storedPlayer = storedLobbyProfile();
    const clientId = stableBoardClientId(storedPlayer?.clientId);
    const cloudUserId = Number(readLocalValue("op_user_id", ""));
    const userId = stableBoardUserId(Number.isFinite(cloudUserId) && cloudUserId > 0 ? cloudUserId : storedPlayer?.userId);
    const secret = String(readLocalValue("op_secret", "") || readLocalValue("opSecret", "") || "").trim();
    const name = String(
      readLocalValue("op_name", "") ||
      readLocalValue("op_player_name", "") ||
      storedPlayer?.name ||
      `玩家${String(userId).slice(-4)}`
    ).trim() || `玩家${String(userId).slice(-4)}`;
    const avatar = clamp(
      readLocalValue("op_avatar", "") || readLocalValue("op_player_avatar", "") || storedPlayer?.avatar || MOCK_PROFILE.avatar,
      1,
      2000
    );
    const title = String(readLocalValue("op_board_title", "") || storedPlayer?.title || MOCK_PROFILE.title).trim() || MOCK_PROFILE.title;
    const coins = Math.max(0, Number(readLocalValue("op_board_coins", "") || storedPlayer?.coins || MOCK_PROFILE.coins) || 0);
    return {
      ...MOCK_PROFILE,
      userId,
      clientId,
      name,
      avatar,
      avatarUrl: avatarUrlById(avatar),
      title,
      coins,
      secret,
    };
  }

  function createLobbyState(roomId) {
    const profile = createProfile();
    return {
      roomId,
      roomName: "千陽號大富翁試航局",
      hostName: profile.name,
      roomCode: roomId,
      hostUserId: profile.userId,
      status: "waiting",
      maxPlayers: 4,
      players: [
        { userId: profile.userId, clientId: profile.clientId, name: profile.name, avatar: profile.avatar, title: profile.title, isHost: true, ready: false, online: true },
      ],
      chat: [
        { system: true, text: "目前測試模式支援單人直接進房與開局；正式規格預留 1～4 人。", ts: Date.now() - 1000 * 60 * 2 },
      ],
    };
  }

  function ensurePreviewState(roomId) {
    const rid = String(roomId || "B7412").trim().toUpperCase();
    let lobby = readJson(STORAGE_KEYS.boardLobby, null);
    if (!lobby || String(lobby.roomId || "").toUpperCase() !== rid) {
      lobby = createLobbyState(rid);
      writeJson(STORAGE_KEYS.boardLobby, lobby);
    }
    return lobby;
  }

  function installSharedStyle() {
    if (document.getElementById("boardSharedStyle")) return;
    const style = document.createElement("style");
    style.id = "boardSharedStyle";
    style.textContent = `
      #boardToastWrap{
        position:fixed; left:50%; bottom:18px; transform:translateX(-50%);
        z-index:340; display:flex; flex-direction:column; gap:10px; width:min(92vw,420px);
      }
      .board-toast{
        background:rgba(244,252,255,.84); color:#27546b; border:1px solid rgba(255,255,255,.78);
        border-radius:16px; padding:12px 14px; box-shadow:0 18px 32px rgba(33,102,132,.18); backdrop-filter:blur(14px);
      }
      #boardFriendDock{
        position:fixed; right:12px; bottom:12px; z-index:250; width:min(90vw,330px);
        background:linear-gradient(180deg, rgba(246,252,255,.88), rgba(232,246,252,.82));
        border:1px solid rgba(255,255,255,.82); border-radius:16px;
        box-shadow:0 18px 44px rgba(33,102,132,.18); backdrop-filter:blur(18px); overflow:hidden;
      }
      #boardFriendDock{
        top:72px; right:12px; bottom:auto;
        width:300px;
        height:min(640px, calc(100vh - 92px));
        display:flex; flex-direction:column;
      }
      #boardFriendDock.collapsed{
        width:190px;
        height:128px;
      }
      #boardFriendDock.collapsed .fd-tools,
      #boardFriendDock.collapsed .fd-body{
        display:none;
      }
      #boardFriendDock.collapsed .fd-collapsed{ display:flex; }
      #boardFriendDock:not(.collapsed) .fd-collapsed{ display:none; }
      .fd-me-top{
        padding:10px 10px 8px;
        border-bottom:1px solid rgba(103,166,198,.14);
      }
      #boardFriendDock.collapsed .fd-me-top{ border-bottom:none; padding-bottom:6px; }
      .fd-me{
        display:flex; align-items:center; gap:10px; padding:10px; border-radius:14px;
        border:1px solid rgba(255,255,255,.62); background:rgba(255,255,255,.28);
      }
      .fd-ava, .fd-ava img{ width:34px; height:34px; border-radius:14px; object-fit:cover; display:block; }
      .fd-me .fd-ava{ width:42px; height:42px; border-radius:16px; }
      .fd-ava{
        overflow:hidden; border:none; background:transparent; flex:0 0 auto;
        box-shadow:none;
      }
      .fd-me-meta,.fd-meta{ min-width:0; flex:1; }
      .fd-me-name,.fd-name{
        font-weight:900; font-size:13px; color:#23526b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      .fd-me-sub,.fd-sub{
        font-size:11px; color:#628398; margin-top:2px;
      }
      .fd-sub{ display:flex; align-items:center; gap:6px; }
      .fd-open{
        height:38px; width:100%; border-radius:14px; border:1px solid rgba(239,187,86,.42);
        background:rgba(239,187,86,.16); color:#2c5e77; font-weight:900; cursor:pointer;
        display:flex; align-items:center; justify-content:center; white-space:nowrap; line-height:1; font-size:13px;
      }
      .fd-open:hover{ background:rgba(239,187,86,.22); }
      .fd-collapsed{
        display:none; flex:1; padding:10px 10px 12px; gap:10px; flex-direction:column;
      }
      .fd-tools{
        padding:10px 12px; border-bottom:1px solid rgba(103,166,198,.14);
        display:flex; align-items:center; gap:8px;
      }
      .fd-inp{
        flex:1; height:38px; border-radius:12px; border:1px solid rgba(255,255,255,.72);
        background:rgba(255,255,255,.5); color:#224f66; padding:0 10px; outline:none;
      }
      .fd-inp::placeholder{ color:rgba(69,107,127,.48); }
      .fd-add,.fd-send,.fd-reqbtn,.fd-menu button{
        height:38px; padding:0 12px; border-radius:12px; border:1px solid rgba(239,187,86,.42);
        background:rgba(239,187,86,.15); color:#2c5e77; font-weight:900; cursor:pointer;
        display:flex; align-items:center; justify-content:center; white-space:nowrap; line-height:1; font-size:13px;
      }
      .fd-add:hover,.fd-send:hover,.fd-reqbtn:hover,.fd-menu button:hover{ background:rgba(239,187,86,.22); }
      .fd-body{ flex:1; overflow:hidden; display:flex; }
      .fd-col{ flex:1; display:flex; flex-direction:column; min-width:0; }
      .fd-list{ flex:1; overflow:auto; padding:8px; }
      .fd-item{
        display:flex; align-items:center; gap:10px; padding:10px; border-radius:14px; cursor:pointer;
        border:1px solid transparent; user-select:none; position:relative;
      }
      .fd-item:hover{ background:rgba(255,255,255,.18); border-color:rgba(255,255,255,.52); }
      .fd-dot{ width:8px; height:8px; border-radius:99px; background:rgba(128,162,180,.45); }
      .fd-dot.on{ background:#56c68b; box-shadow:0 0 0 3px rgba(86,198,139,.16); }
      .fd-badge,.fd-chat-badge{
        display:none; min-width:18px; height:18px; border-radius:999px; padding:0 6px;
        align-items:center; justify-content:center; background:#4da9ff; color:white; font-size:11px; font-weight:900;
      }
      .fd-warn{ padding:10px; font-size:11px; color:#55798d; border-top:1px dashed rgba(103,166,198,.18); }
      .fd-empty,.fd-chat-note{
        margin:8px; padding:12px; border-radius:12px; color:#55798d; font-size:12px; line-height:1.55;
        border:1px dashed rgba(103,166,198,.24); background:rgba(255,255,255,.26);
      }
      .fd-item.pending{ cursor:default; opacity:.76; }
      .fd-btn,.fd-morebtn,.fd-chat-btn{
        height:32px; min-width:32px; border-radius:12px; border:1px solid rgba(255,255,255,.72);
        background:rgba(255,255,255,.34); color:#2c5e77; cursor:pointer; padding:0;
        display:flex; align-items:center; justify-content:center; line-height:1;
      }
      .fd-btn:hover,.fd-morebtn:hover,.fd-chat-btn:hover{ background:rgba(255,255,255,.48); }
      .fd-morewrap{ margin-left:auto; display:flex; align-items:center; gap:8px; }
      .fd-morebtn{
        width:28px; height:28px; border-radius:10px; font-size:18px;
      }
      .fd-morebtn.on{ border-color:rgba(239,187,86,.45); background:rgba(239,187,86,.14); }
      .fd-menu{
        position:absolute; top:44px; right:10px; min-width:148px; z-index:10;
        border:1px solid rgba(255,255,255,.76); background:rgba(244,251,255,.96);
        border-radius:12px; box-shadow:0 18px 40px rgba(33,102,132,.16); overflow:hidden;
      }
      .fd-menu button{
        width:100%; justify-content:flex-start; background:transparent; border:none; color:#2c5e77;
        padding:10px 12px; text-align:left; font-size:13px; height:auto;
      }
      .fd-menu .danger{ color:#d15b5b; }
      .fd-sep{
        padding:8px 10px; font-size:11px; color:#628398; border-top:1px solid rgba(103,166,198,.14);
      }
      .fd-reqwrap{ display:flex; gap:6px; align-items:center; margin-left:auto; }
      .fd-reqbtn.ok{ border-color:rgba(239,187,86,.45); }
      .fd-reqbtn.no{ border-color:rgba(255,120,120,.35); background:rgba(255,120,120,.12); color:#bd5e5e; }
      #boardChatTray{
        position:fixed; left:12px; bottom:12px; z-index:255; display:flex; justify-content:flex-start;
        flex-direction:row-reverse; align-items:flex-end; gap:10px; pointer-events:none;
      }
      .fd-chatwin{
        pointer-events:auto; width:280px; height:min(420px, calc(100vh - 40px)); border-radius:16px 16px 12px 12px;
        border:1px solid rgba(255,255,255,.76);
        background:linear-gradient(180deg, rgba(246,252,255,.94), rgba(231,245,252,.92));
        box-shadow:0 18px 60px rgba(33,102,132,.18);
        overflow:hidden; display:flex; flex-direction:column; backdrop-filter:blur(10px);
      }
      .fd-chatwin.minimized{ height:48px; }
      @keyframes fdUnreadPulse{
        0%,100%{ filter:brightness(1); box-shadow:0 10px 26px rgba(33,102,132,.18); }
        50%{ filter:brightness(1.12); box-shadow:0 12px 32px rgba(239,187,86,.24), 0 10px 26px rgba(33,102,132,.18); }
      }
      .fd-chatwin.minimized.unreadPulse{ animation:fdUnreadPulse 1.8s ease-in-out infinite; }
      .fd-chat-hd{
        height:48px; display:flex; align-items:center; justify-content:space-between; padding:10px 12px;
        border-bottom:1px solid rgba(103,166,198,.14);
        background:linear-gradient(180deg, rgba(120,204,245,.24), rgba(255,255,255,.16));
      }
      .fd-chat-peer{ display:flex; align-items:center; gap:10px; min-width:0; cursor:pointer; }
      .fd-chat-peer .n{ font-weight:900; font-size:13px; color:#23526b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.1; }
      .fd-chat-peer .s{ font-size:11px; color:#628398; margin-top:2px; }
      .fd-chat-peer .meta{ min-width:0; }
      .fd-chat-actions{ display:flex; align-items:center; gap:8px; flex:0 0 auto; }
      .fd-chat-log{
        flex:1; overflow:auto; padding:10px; display:flex; flex-direction:column; gap:8px;
      }
      .fd-msg{
        max-width:88%; border-radius:14px; padding:8px 10px; border:1px solid rgba(255,255,255,.74);
        background:rgba(255,255,255,.48); color:#234d63; font-size:12px; line-height:1.3;
        white-space:pre-wrap; word-break:break-word; align-self:flex-start;
      }
      .fd-msg.me{
        align-self:flex-end; border-color:rgba(239,187,86,.4); background:rgba(239,187,86,.18); color:#5a461e;
      }
      .fd-msg .t{
        display:block; margin-top:4px; font-size:10px; color:rgba(86,121,141,.76);
      }
      .fd-chat-in{
        padding:10px; border-top:1px solid rgba(103,166,198,.14); display:flex; align-items:center; gap:8px;
      }
      .fd-chatwin.minimized .fd-chat-log,
      .fd-chatwin.minimized .fd-chat-in,
      .fd-chatwin.minimized .s,
      .fd-chatwin.minimized .fd-ava{ display:none; }
      .fd-chatwin.minimized .fd-chat-hd{ border-bottom:none; }
      .fd-chatwin.minimized .fd-chat-peer{ width:100%; justify-content:center; }
      #boardInviteBack{
        display:none; position:fixed; inset:0; z-index:270; background:rgba(0,0,0,.74); align-items:center; justify-content:center; padding:16px;
      }
      #boardInviteSheet{
        width:min(560px,94vw); background:rgba(245,252,255,.96); border:1px solid rgba(255,255,255,.8);
        border-radius:20px; box-shadow:0 22px 48px rgba(33,102,132,.18); padding:18px; color:#25526a;
      }
      #boardInviteSheet .hd{ display:flex; gap:12px; align-items:center; }
      #boardInviteSheet .ttl{ font-size:18px; font-weight:800; color:#255f7d; }
      #boardInviteSheet .sub{ margin-top:4px; font-size:13px; color:#628398; }
      #boardInviteSheet .meta{
        margin-top:14px; border-radius:16px; padding:12px; background:rgba(255,255,255,.52); border:1px solid rgba(255,255,255,.82);
      }
      #boardInviteSheet .row{ display:flex; gap:10px; flex-wrap:wrap; margin-top:14px; }
      #boardInviteSheet .btnx{
        flex:1 1 140px; border:none; cursor:pointer; border-radius:14px; padding:11px 12px; color:#2c5e77;
        background:rgba(255,255,255,.56); border:1px solid rgba(255,255,255,.82);
      }
      #boardInviteSheet .btnx.ok{ background:rgba(239,187,86,.18); border-color:rgba(239,187,86,.36); }
      #boardInviteSheet .btnx.no{ background:rgba(255,120,120,.12); border-color:rgba(255,120,120,.3); color:#bd5e5e; }
      #boardInviteSheet .btnx.mute{ background:rgba(120,204,245,.18); border-color:rgba(120,204,245,.34); }
      @media (max-width:720px){
        #boardFriendDock{ width:300px; max-width:calc(100vw - 20px); right:10px; top:72px; }
        #boardFriendDock.collapsed{ width:190px; }
        #boardChatTray{ left:10px; bottom:10px; right:auto; overflow-x:auto; max-width:calc(100vw - 20px); }
        .fd-chatwin{ width:280px; flex:0 0 auto; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureUiShell() {
    if (!document.getElementById("boardToastWrap")) {
      const toast = document.createElement("div");
      toast.id = "boardToastWrap";
      document.body.appendChild(toast);
    }
    if (!document.getElementById("boardChatTray")) {
      const tray = document.createElement("div");
      tray.id = "boardChatTray";
      document.body.appendChild(tray);
    }
    if (!document.getElementById("boardFriendDock")) {
      const dock = document.createElement("aside");
      dock.id = "boardFriendDock";
      dock.className = "collapsed";
      dock.innerHTML = `
        <div class="fd-me-top" aria-label="me-top">
          <div class="fd-me">
            <div class="fd-ava"><img id="boardDockMeAva" alt=""></div>
            <div class="fd-me-meta">
              <div class="fd-me-name" id="boardDockMeName">—</div>
              <div class="fd-me-sub">好友與聊天室</div>
            </div>
            <div class="fd-morewrap" style="margin-left:auto;">
              <button type="button" class="fd-btn" id="boardDockToggle" title="縮小/展開">+</button>
            </div>
          </div>
        </div>

        <div class="fd-collapsed" aria-label="friends-collapsed">
          <button id="boardDockOpen" class="fd-open" type="button">好友與聊天室</button>
        </div>

        <div class="fd-tools">
          <input id="boardFriendAddInput" class="fd-inp" type="text" placeholder="輸入好友名稱加入…">
          <button type="button" id="boardFriendAddBtn" class="fd-add">加入</button>
        </div>

        <div class="fd-body">
          <div class="fd-col">
            <div id="boardFriendList" class="fd-list"></div>
            <div class="fd-warn" id="boardDockHint" style="display:none;"></div>
          </div>
        </div>
      `;
      document.body.appendChild(dock);
    }
    if (!document.getElementById("boardInviteBack")) {
      const back = document.createElement("div");
      back.id = "boardInviteBack";
      back.innerHTML = `
        <div id="boardInviteSheet" role="dialog" aria-label="board-invite">
          <div class="hd">
            <div class="fd-ava"><img id="boardInviteAva" alt=""></div>
            <div>
              <div class="ttl">遊戲邀請</div>
              <div class="sub" id="boardInviteSub">—</div>
            </div>
          </div>
          <div class="meta" id="boardInviteMeta">—</div>
          <div class="row">
            <button type="button" class="btnx ok" id="boardInviteAccept">確認加入</button>
            <button type="button" class="btnx no" id="boardInviteReject">暫不加入</button>
            <button type="button" class="btnx mute" id="boardInviteMute">稍後再看</button>
          </div>
        </div>
      `;
      document.body.appendChild(back);
    }
  }

  function showToast(text) {
    const wrap = document.getElementById("boardToastWrap");
    if (!wrap) return;
    const el = document.createElement("div");
    el.className = "board-toast";
    el.textContent = String(text || "");
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 2800);
  }

  function setHint(text) {
    const el = document.getElementById("boardDockHint");
    if (!el) return;
    const next = String(text || "");
    el.textContent = next;
    el.style.display = next ? "block" : "none";
  }

  function socialSecret() {
    const secret = String(
      state.profile?.secret ||
      readLocalValue("op_secret", "") ||
      readLocalValue("opSecret", "") ||
      ""
    ).trim();
    if (state.profile) state.profile.secret = secret;
    return secret;
  }

  function emitSocialUpdate() {
    window.dispatchEvent(new CustomEvent("board:social-updated", {
      detail: {
        ready: state.socialReady,
        loading: state.socialLoading,
        error: state.socialError,
        friendCount: state.friends.length,
        onlineCount: state.friends.filter((friend) => friend.online).length,
        requestCount: state.requestsIn.length,
        inviteCount: state.invites.length,
        unreadCount: Array.from(state.unread.values()).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0),
      },
    }));
  }

  function translateSocialError(error, fallback = "好友服務暫時無法使用") {
    const code = String(error || "").trim();
    const map = {
      "bad secret": "登入已失效，請回卡牌首頁重新登入。",
      "not found": "找不到這個玩家名稱。",
      "cannot add self": "不能加入自己為好友。",
      "already friends": "你們已經是好友。",
      "request already sent": "好友邀請已送出，等待對方確認。",
      "no incoming request": "這筆好友邀請已失效。",
      "not friends": "你們還不是好友。",
      "offline": "對方目前離線。",
      "muted": "對方暫停接收房間邀請。",
      "room not found": "房間已不存在。",
      "room already started": "房間已經開始，不能再加入。",
      "invite not found": "這筆房間邀請已失效。",
      "too long": "訊息最多 400 個字。",
      "empty": "請先輸入訊息。",
    };
    return map[code] || code || fallback;
  }

  function emitWithAck(eventName, payload, callback) {
    const socket = state.socket;
    if (!socket) {
      callback?.(new Error("socket unavailable"), null);
      return;
    }
    try {
      if (typeof socket.timeout === "function") {
        socket.timeout(12000).emit(eventName, payload, (error, result) => callback?.(error, result));
      } else {
        socket.emit(eventName, payload, (result) => callback?.(null, result));
      }
    } catch (error) {
      callback?.(error, null);
    }
  }

  function fetchFriends() {
    const secret = socialSecret();
    if (!state.socket) {
      state.socialError = "好友服務尚未連線。";
      setHint(state.socialError);
      emitSocialUpdate();
      return;
    }
    if (!secret) {
      state.socialReady = false;
      state.socialLoading = false;
      state.socialError = "請先從卡牌遊戲登入帳號，好友與聊天才會啟用。";
      setHint(state.socialError);
      renderFriends();
      emitSocialUpdate();
      return;
    }
    state.socialLoading = true;
    emitSocialUpdate();
    emitWithAck("FRIENDS_GET", { secret }, (error, result = {}) => {
      state.socialLoading = false;
      if (error || !result?.ok) {
        state.socialError = translateSocialError(result?.error, "好友清單讀取失敗，請稍後再試。");
        setHint(state.socialError);
        renderFriends();
        emitSocialUpdate();
        return;
      }
      state.friends = Array.isArray(result.friends) ? result.friends.slice(0, 200) : [];
      state.requestsIn = Array.isArray(result.requestsIn) ? result.requestsIn.slice(0, 200) : [];
      state.requestsOut = Array.isArray(result.requestsOut) ? result.requestsOut.slice(0, 200) : [];
      state.socialReady = true;
      state.socialError = "";
      setHint("");
      renderFriends();
      state.openChats.forEach((chat, peerId) => {
        const friend = state.friends.find((entry) => Number(entry.userId) === Number(peerId));
        if (!friend || !chat?.el) return;
        chat.friend = friend;
        const status = chat.el.querySelector(".fd-chat-peer .s");
        if (status) status.textContent = friend.online ? (friend.activity || "線上") : "離線中";
      });
      emitSocialUpdate();
    });
  }

  function socialAuth() {
    const secret = socialSecret();
    if (!state.socket) return;
    if (!secret) {
      state.socialReady = false;
      state.socialLoading = false;
      state.socialError = "請先從卡牌遊戲登入帳號，好友與聊天才會啟用。";
      setHint(state.socialError);
      renderFriends();
      emitSocialUpdate();
      return;
    }
    state.socialLoading = true;
    state.socialError = "";
    setHint("正在連接好友服務…");
    emitSocialUpdate();
    emitWithAck("SOCIAL_AUTH", { secret, deviceId: getDeviceId() }, (error, result = {}) => {
      if (error || !result?.ok) {
        state.socialLoading = false;
        state.socialReady = false;
        state.socialError = translateSocialError(result?.error, "好友服務登入失敗。");
        setHint(state.socialError);
        renderFriends();
        emitSocialUpdate();
        return;
      }
      state.socialMe = result.me || null;
      state.socialReady = true;
      state.socialLoading = false;
      state.socialError = "";
      renderMe();
      try {
        state.socket.emit("PRESENCE_SET", { secret, page: state.page || "board", deviceId: getDeviceId() });
      } catch (_) {}
      setHint("");
      fetchFriends();
    });
  }

  function handleDirectMessage(message = {}) {
    if (!state.socialReady) return;
    const fromId = Number(message.from) || 0;
    const myId = Number(state.socialMe?.userId || state.profile?.userId) || 0;
    const peerId = fromId === myId ? Number(message.to) || 0 : fromId;
    if (!peerId) return;
    if (state.openChats.has(peerId)) {
      appendChat(peerId, message);
      const win = state.openChats.get(peerId);
      if (win?.min && fromId !== myId) {
        const next = Math.max(1, Number(state.unread.get(peerId) || 0) + 1);
        state.unread.set(peerId, next);
        setChatBadge(peerId, next);
        win.el.classList.add("unreadPulse");
      }
    } else if (fromId !== myId) {
      state.unread.set(peerId, Math.max(1, Number(state.unread.get(peerId) || 0) + 1));
      renderFriends();
      openChatAuto(peerId);
    }
    emitSocialUpdate();
  }

  function handleSocialEmit(message = {}) {
    if ((message.type === "board_lobby_invite" || message.type === "lobby_invite")
      && String(message.invite?.mode || "") === "board") {
      const invite = { ...message.invite, mode: "board" };
      state.invites = [invite, ...state.invites.filter((entry) => String(entry.inviteId) !== String(invite.inviteId))];
      renderFriends();
      showInvite(invite);
      emitSocialUpdate();
      return;
    }
    if (message.type === "toast" && message.text) showToast(message.text);
  }

  function wireSocialSocket(socket) {
    if (!socket || socket.__boardSocialWired) return;
    socket.__boardSocialWired = true;
    socket.on("connect", socialAuth);
    socket.on("disconnect", () => {
      state.socialReady = false;
      state.socialLoading = false;
      state.socialError = "好友服務已斷線，正在等待重新連線。";
      setHint(state.socialError);
      emitSocialUpdate();
    });
    socket.on("FRIENDS_DIRTY", fetchFriends);
    socket.on("DM_NEW", handleDirectMessage);
    socket.on("EMIT", handleSocialEmit);
    socket.on("SESSION_KICK", (info = {}) => {
      try {
        writeLocalValue("op_kicked_reason", info.reason || "takeover");
        ["op_secret", "opSecret"].forEach((key) => localStorage.removeItem(key));
      } catch (_) {}
      location.href = "start.html?kicked=1";
    });
  }

  function attachSocket(socket) {
    if (!socket) return;
    state.socket = socket;
    wireSocialSocket(socket);
    if (socket.connected) socialAuth();
    if (!state.socialRefreshTimer) {
      state.socialRefreshTimer = window.setInterval(() => {
        if (state.socket?.connected && socialSecret()) fetchFriends();
      }, 12000);
    }
  }

  function renderMe() {
    const profile = state.profile;
    const name = document.getElementById("boardDockMeName");
    const ava = document.getElementById("boardDockMeAva");
    if (!profile || !name || !ava) return;
    name.textContent = profile.name;
    ava.src = profile.avatarUrl;
  }

  function closeMenus() {
    document.querySelectorAll(".fd-menu").forEach((el) => el.remove());
    document.querySelectorAll("#boardFriendDock .fd-morebtn").forEach((btn) => btn.classList.remove("on"));
  }

  function fmtTime(ts) {
    try {
      const d = new Date(Number(ts) || Date.now());
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch {
      return "";
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function scrollChat(peerId) {
    const win = state.openChats.get(peerId);
    if (!win) return;
    setTimeout(() => {
      try { win.log.scrollTop = win.log.scrollHeight + 999; } catch {}
    }, 0);
  }

  function appendChat(peerId, message) {
    const win = state.openChats.get(peerId);
    if (!win) return;
    const div = document.createElement("div");
    div.className = "fd-msg" + (Number(message.from) === Number(state.profile.userId) ? " me" : "");
    div.textContent = String(message.body || "");
    const t = document.createElement("span");
    t.className = "t";
    t.textContent = fmtTime(message.ts);
    div.appendChild(t);
    win.log.appendChild(div);
    scrollChat(peerId);
  }

  function setChatBadge(peerId, count) {
    const win = state.openChats.get(peerId);
    if (!win) return;
    const n = Math.max(0, Number(count) || 0);
    if (!n) {
      win.badge.style.display = "none";
      win.badge.textContent = "";
      return;
    }
    win.badge.style.display = "inline-flex";
    win.badge.textContent = String(Math.min(99, n));
  }

  function bringChatToFront(peerId) {
    state.chatOrder = state.chatOrder.filter((id) => id !== peerId);
    state.chatOrder.push(peerId);
    const tray = document.getElementById("boardChatTray");
    state.chatOrder.forEach((id) => {
      const win = state.openChats.get(id);
      if (win?.el) tray.appendChild(win.el);
    });
  }

  function toggleChat(peerId) {
    const win = state.openChats.get(peerId);
    if (!win) return;
    win.min = !win.min;
    win.el.classList.toggle("minimized", win.min);
    if (!win.min) {
      state.unread.set(peerId, 0);
      setChatBadge(peerId, 0);
      win.el.classList.remove("unreadPulse");
      renderFriends();
      setTimeout(() => win.input.focus(), 0);
    }
  }

  function closeChat(peerId) {
    const win = state.openChats.get(peerId);
    if (!win) return;
    win.el.remove();
    state.openChats.delete(peerId);
    state.chatOrder = state.chatOrder.filter((id) => id !== peerId);
  }

  function sendChat(peerId) {
    const win = state.openChats.get(peerId);
    if (!win) return;
    const body = String(win.input.value || "").trim();
    if (!body) return;
    const secret = socialSecret();
    if (!state.socket || !secret) {
      setHint("請先登入並連上好友服務，才能傳送訊息。");
      return;
    }
    win.input.value = "";
    emitWithAck("DM_SEND", { secret, toUserId: peerId, body }, (error, result = {}) => {
      if (error || !result?.ok) {
        win.input.value = body;
        setHint(translateSocialError(result?.error, "訊息送出失敗，請稍後再試。"));
        return;
      }
      setHint("");
      if (result.message) appendChat(peerId, result.message);
    });
  }

  function loadChatHistory(peerId) {
    const win = state.openChats.get(peerId);
    if (!win) return;
    const secret = socialSecret();
    if (!state.socket || !secret) {
      win.log.textContent = "請先登入並連上好友服務。";
      return;
    }
    win.log.innerHTML = "";
    emitWithAck("DM_HISTORY", { secret, withUserId: peerId, limit: 60 }, (error, result = {}) => {
      if (error || !result?.ok) {
        const note = document.createElement("div");
        note.className = "fd-chat-note";
        note.textContent = translateSocialError(result?.error, "聊天記錄讀取失敗。");
        win.log.appendChild(note);
        return;
      }
      (result.messages || []).forEach((message) => appendChat(peerId, message));
      scrollChat(peerId);
    });
  }

  function createChatWindow(friend) {
    const peerId = Number(friend.userId);
    const el = document.createElement("div");
    el.className = "fd-chatwin";
    el.innerHTML = `
      <div class="fd-chat-hd">
        <div class="fd-chat-peer" title="點一下可置頂">
          <div class="fd-ava" style="width:28px;height:28px;"><img src="${avatarUrlById(friend.avatar)}" alt=""></div>
          <div class="meta" style="min-width:0;">
            <div class="n">${escapeHtml(friend.name || `#${friend.userId}`)}</div>
            <div class="s">${escapeHtml(friend.online ? (friend.activity || "線上") : "離線中")}</div>
          </div>
        </div>
        <div class="fd-chat-actions">
          <span class="fd-chat-badge"></span>
          <button type="button" class="fd-chat-btn chatMin">—</button>
          <button type="button" class="fd-chat-btn chatClose">✕</button>
        </div>
      </div>
      <div class="fd-chat-log"></div>
      <div class="fd-chat-in">
        <input class="fd-inp" type="text" placeholder="輸入訊息…（Enter 送出）">
        <button type="button" class="fd-send">送出</button>
      </div>
    `;
    const log = el.querySelector(".fd-chat-log");
    const input = el.querySelector(".fd-chat-in input");
    const badge = el.querySelector(".fd-chat-badge");
    el.querySelector(".chatMin").addEventListener("click", () => toggleChat(peerId));
    el.querySelector(".chatClose").addEventListener("click", () => closeChat(peerId));
    el.querySelector(".fd-send").addEventListener("click", () => sendChat(peerId));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendChat(peerId);
    });
    el.querySelector(".fd-chat-peer").addEventListener("click", () => {
      bringChatToFront(peerId);
      if (state.openChats.get(peerId)?.min) toggleChat(peerId);
    });
    state.openChats.set(peerId, { el, log, input, badge, min: false, friend });
    return el;
  }

  function openChat(friend) {
    const peerId = Number(friend.userId);
    state.unread.set(peerId, 0);
    renderFriends();
    if (state.openChats.has(peerId)) {
      bringChatToFront(peerId);
      const win = state.openChats.get(peerId);
      if (win.min) toggleChat(peerId);
      setTimeout(() => win.input.focus(), 0);
      return;
    }
    if (state.chatOrder.length >= 4) closeChat(state.chatOrder[0]);
    const tray = document.getElementById("boardChatTray");
    const el = createChatWindow(friend);
    tray.appendChild(el);
    state.chatOrder.push(peerId);
    bringChatToFront(peerId);
    loadChatHistory(peerId);
    setTimeout(() => state.openChats.get(peerId)?.input.focus(), 0);
  }

  function openChatAuto(peerId) {
    const friend = state.friends.find((item) => Number(item.userId) === Number(peerId));
    if (!friend) return;
    if (state.openChats.has(peerId)) {
      const win = state.openChats.get(peerId);
      if (!win.min) toggleChat(peerId);
      setChatBadge(peerId, state.unread.get(peerId) || 1);
      win.el.classList.add("unreadPulse");
      return;
    }
    if (state.chatOrder.length >= 4) closeChat(state.chatOrder[0]);
    const tray = document.getElementById("boardChatTray");
    const el = createChatWindow(friend);
    tray.appendChild(el);
    state.chatOrder.push(peerId);
    bringChatToFront(peerId);
    loadChatHistory(peerId);
    toggleChat(peerId);
    setChatBadge(peerId, state.unread.get(peerId) || 1);
    state.openChats.get(peerId)?.el.classList.add("unreadPulse");
  }

  function openFriendMenu(item, friend) {
    closeMenus();
    const menu = document.createElement("div");
    menu.className = "fd-menu";
    const mk = (label, handler, cls = "") => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeMenus();
        handler();
      });
      return btn;
    };
    menu.appendChild(mk("查看個人頁", () => {
      location.href = `profile.html?view=${encodeURIComponent(friend.userId)}`;
    }));
    if (state.roomId) {
      menu.appendChild(mk("邀請加入房間", () => {
        const secret = socialSecret();
        if (!state.socket || !secret) {
          setHint("請先登入並連上好友服務。");
          return;
        }
        emitWithAck("LOBBY_INVITE_SEND", {
          secret,
          toUserId: Number(friend.userId),
          roomId: state.roomId,
          mode: "board",
        }, (error, result = {}) => {
          if (error || !result?.ok) {
            setHint(translateSocialError(result?.error, "房間邀請送出失敗。"));
            return;
          }
          setHint("");
          showToast(`已邀請 ${friend.name} 加入大富翁房間`);
        });
      }));
    }
    menu.appendChild(mk("刪除好友", () => {
      if (!window.confirm(`確定要刪除好友「${friend.name}」嗎？\n雙方好友關係都會解除。`)) return;
      const secret = socialSecret();
      if (!state.socket || !secret) {
        setHint("請先登入並連上好友服務。");
        return;
      }
      emitWithAck("FRIEND_REMOVE", { secret, userId: Number(friend.userId) }, (error, result = {}) => {
        if (error || !result?.ok) {
          setHint(translateSocialError(result?.error, "刪除好友失敗。"));
          return;
        }
        closeChat(Number(friend.userId));
        setHint("");
        fetchFriends();
        showToast(`已刪除好友 ${friend.name}`);
      });
    }, "danger"));
    item.appendChild(menu);
  }

  function renderFriends() {
    const list = document.getElementById("boardFriendList");
    if (!list) return;
    list.innerHTML = "";

    state.invites.forEach((invite) => {
      const row = document.createElement("div");
      row.className = "fd-item req";
      row.innerHTML = `
        <div class="fd-ava"><img src="${avatarUrlById(invite.fromAvatar)}" alt=""></div>
        <div class="fd-meta">
          <div class="fd-name">${escapeHtml(invite.fromName)} 的房間邀請</div>
          <div class="fd-sub">房號 ${escapeHtml(invite.roomId)} ・ 大富翁模式</div>
        </div>
        <div class="fd-reqwrap">
          <button type="button" class="fd-reqbtn ok" data-action="open">查看</button>
        </div>
      `;
      row.querySelector("[data-action='open']").addEventListener("click", () => showInvite(invite));
      list.appendChild(row);
    });

    if (state.requestsIn.length) {
      const heading = document.createElement("div");
      heading.className = "fd-sep";
      heading.textContent = `好友邀請（${state.requestsIn.length}）`;
      list.appendChild(heading);
      state.requestsIn.forEach((request) => {
        const item = document.createElement("div");
        item.className = "fd-item req";
        item.innerHTML = `
          <div class="fd-ava"><img src="${avatarUrlById(request.avatar)}" alt=""></div>
          <div class="fd-meta">
            <div class="fd-name">${escapeHtml(request.name || `#${request.userId}`)}</div>
            <div class="fd-sub">想加你為好友</div>
          </div>
          <div class="fd-reqwrap">
            <button type="button" class="fd-reqbtn ok" data-action="accept">確認</button>
            <button type="button" class="fd-reqbtn no" data-action="decline">拒絕</button>
          </div>
        `;
        item.querySelector("[data-action='accept']")?.addEventListener("click", () => respondFriendRequest(request, "accept"));
        item.querySelector("[data-action='decline']")?.addEventListener("click", () => respondFriendRequest(request, "decline"));
        list.appendChild(item);
      });
    }

    if (state.requestsOut.length) {
      const heading = document.createElement("div");
      heading.className = "fd-sep";
      heading.textContent = "等待對方確認";
      list.appendChild(heading);
      state.requestsOut.forEach((request) => {
        const item = document.createElement("div");
        item.className = "fd-item req pending";
        item.innerHTML = `
          <div class="fd-ava"><img src="${avatarUrlById(request.avatar)}" alt=""></div>
          <div class="fd-meta">
            <div class="fd-name">${escapeHtml(request.name || `#${request.userId}`)}</div>
            <div class="fd-sub">好友邀請已送出</div>
          </div>
        `;
        list.appendChild(item);
      });
    }

    if (state.requestsIn.length || state.requestsOut.length || state.invites.length) {
      const heading = document.createElement("div");
      heading.className = "fd-sep";
      heading.textContent = "好友名單";
      list.appendChild(heading);
    }

    const sortedFriends = [...state.friends].sort((a, b) => Number(!!b.online) - Number(!!a.online)
      || String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant"));
    sortedFriends.forEach((friend) => {
      const item = document.createElement("div");
      item.className = "fd-item";
      item.innerHTML = `
        <div class="fd-ava"><img src="${avatarUrlById(friend.avatar)}" alt=""></div>
        <div class="fd-meta">
          <div class="fd-name">${escapeHtml(friend.name || `#${friend.userId}`)}</div>
          <div class="fd-sub"><span class="fd-dot${friend.online ? " on" : ""}"></span><span>${escapeHtml(friend.online ? (friend.activity || "線上") : "離線中")}</span></div>
        </div>
        <div class="fd-morewrap">
          <div class="fd-badge"></div>
          <button type="button" class="fd-morebtn">⋯</button>
        </div>
      `;
      const badge = item.querySelector(".fd-badge");
      const unread = state.unread.get(friend.userId) || 0;
      if (unread > 0) {
        badge.style.display = "inline-flex";
        badge.textContent = String(Math.min(99, unread));
      }
      item.querySelector(".fd-morebtn").addEventListener("click", (e) => {
        e.stopPropagation();
        e.currentTarget.classList.add("on");
        openFriendMenu(item, friend);
      });
      item.addEventListener("click", () => openChat(friend));
      list.appendChild(item);
    });

    if (!state.socialLoading && !state.friends.length && !state.requestsIn.length && !state.requestsOut.length && !state.invites.length) {
      const empty = document.createElement("div");
      empty.className = "fd-empty";
      empty.textContent = state.socialReady
        ? "目前沒有好友。可在上方輸入對方的玩家名稱送出邀請。"
        : (state.socialError || "正在讀取好友清單…");
      list.appendChild(empty);
    }
  }

  function respondFriendRequest(request, action) {
    const secret = socialSecret();
    if (!state.socket || !secret) {
      setHint("請先登入並連上好友服務。");
      return;
    }
    const eventName = action === "accept" ? "FRIEND_REQUEST_ACCEPT" : "FRIEND_REQUEST_DECLINE";
    emitWithAck(eventName, { secret, userId: Number(request.userId) }, (error, result = {}) => {
      if (error || !result?.ok) {
        setHint(translateSocialError(result?.error, action === "accept" ? "確認好友失敗。" : "拒絕好友失敗。"));
        return;
      }
      setHint("");
      showToast(action === "accept" ? `已和 ${request.name} 成為好友` : `已拒絕 ${request.name} 的好友邀請`);
      fetchFriends();
    });
  }

  function showInvite(invite) {
    const back = document.getElementById("boardInviteBack");
    const ava = document.getElementById("boardInviteAva");
    const sub = document.getElementById("boardInviteSub");
    const meta = document.getElementById("boardInviteMeta");
    state.currentInvite = invite;
    ava.src = avatarUrlById(invite.fromAvatar);
    sub.textContent = `${invite.fromName} 邀請你加入航海王大富翁`;
    meta.textContent = `房號：${invite.roomId} ・ 接受後會進入大富翁等待室`;
    back.style.display = "flex";
  }

  function hideInvite() {
    state.currentInvite = null;
    const back = document.getElementById("boardInviteBack");
    if (back) back.style.display = "none";
  }

  function respondLobbyInvite(action) {
    const invite = state.currentInvite;
    const secret = socialSecret();
    if (!invite?.inviteId || !state.socket || !secret) {
      hideInvite();
      setHint("房間邀請已失效，或好友服務尚未連線。");
      return;
    }
    emitWithAck("LOBBY_INVITE_RESPOND", { secret, inviteId: invite.inviteId, action }, (error, result = {}) => {
      if (error || !result?.ok) {
        setHint(translateSocialError(result?.error, "房間邀請處理失敗。"));
        return;
      }
      state.invites = state.invites.filter((entry) => String(entry.inviteId) !== String(invite.inviteId));
      renderFriends();
      hideInvite();
      emitSocialUpdate();
      if (action === "accept" && result.roomId) {
        location.href = `board_start.html?view=lobby&room=${encodeURIComponent(result.roomId)}`;
      } else if (action === "mute5") {
        showToast("已暫停接收房間邀請 5 分鐘");
      } else {
        showToast("已拒絕房間邀請");
      }
    });
  }

  function updateDockMinIcon() {
    const dock = document.getElementById("boardFriendDock");
    const btn = document.getElementById("boardDockToggle");
    if (!dock || !btn) return;
    btn.textContent = dock.classList.contains("collapsed") ? "+" : "—";
  }

  function bindUiEvents() {
    document.getElementById("boardDockToggle")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const dock = document.getElementById("boardFriendDock");
      dock?.classList.toggle("collapsed");
      writeLocalValue(STORAGE_KEYS.friendDockCollapsed, dock?.classList.contains("collapsed") ? "1" : "0");
      updateDockMinIcon();
    });
    document.getElementById("boardDockOpen")?.addEventListener("click", (e) => {
      e.stopPropagation();
      document.getElementById("boardFriendDock")?.classList.remove("collapsed");
      writeLocalValue(STORAGE_KEYS.friendDockCollapsed, "0");
      updateDockMinIcon();
    });
    document.getElementById("boardFriendDock")?.addEventListener("click", (e) => {
      const dock = document.getElementById("boardFriendDock");
      if (!dock?.classList.contains("collapsed")) return;
      if (e.target?.id === "boardDockToggle") return;
      dock.classList.remove("collapsed");
      writeLocalValue(STORAGE_KEYS.friendDockCollapsed, "0");
      updateDockMinIcon();
    });
    document.getElementById("boardFriendAddBtn")?.addEventListener("click", () => {
      const input = document.getElementById("boardFriendAddInput");
      const name = String(input.value || "").trim();
      if (!name) return;
      const secret = socialSecret();
      if (!state.socket || !secret) {
        setHint("請先登入並連上好友服務。");
        return;
      }
      emitWithAck("FRIEND_ADD_BY_NAME", { secret, name }, (error, result = {}) => {
        if (error || !result?.ok) {
          setHint(translateSocialError(result?.error, "好友邀請送出失敗。"));
          return;
        }
        input.value = "";
        setHint("");
        showToast(`已向 ${result.to?.name || name} 送出好友邀請`);
        fetchFriends();
      });
    });
    document.getElementById("boardFriendAddInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("boardFriendAddBtn")?.click();
    });
    document.addEventListener("click", (e) => {
      const inside = e.target?.closest?.("#boardFriendDock");
      if (!inside) closeMenus();
    });
    document.getElementById("boardInviteBack")?.addEventListener("click", (e) => {
      if (e.target?.id === "boardInviteBack") hideInvite();
    });
    document.getElementById("boardInviteAccept")?.addEventListener("click", () => {
      respondLobbyInvite("accept");
    });
    document.getElementById("boardInviteReject")?.addEventListener("click", () => {
      respondLobbyInvite("reject");
    });
    document.getElementById("boardInviteMute")?.addEventListener("click", () => {
      respondLobbyInvite("mute5");
    });
    updateDockMinIcon();
  }

  function init(options = {}) {
    state.page = String(options.page || "board").trim() || "board";
    state.roomId = String(options.roomId || "").trim();
    state.currentInviteMode = String(options.inviteMode || "board").trim();
    state.profile = createProfile();
    state.friends = [];
    state.requestsIn = [];
    state.requestsOut = [];
    state.rooms = readJson(STORAGE_KEYS.boardRoom, MOCK_ROOMS.map((item) => ({ ...item })));
    state.invites = [];
    state.socialReady = false;
    state.socialLoading = false;
    state.socialError = socialSecret() ? "正在連接好友服務…" : "請先從卡牌遊戲登入帳號，好友與聊天才會啟用。";

    installSharedStyle();
    ensureUiShell();
    document.body.classList.add("board-theme");
    const dock = document.getElementById("boardFriendDock");
    dock?.classList.toggle("collapsed", readLocalValue(STORAGE_KEYS.friendDockCollapsed, "1") !== "0");
    bindUiEvents();
    renderMe();
    renderFriends();
    setHint(state.socialError);

    return {
      profile: state.profile,
      rooms: state.rooms,
      lobby: state.roomId ? ensurePreviewState(state.roomId) : null,
    };
  }

  function setRoomContext(roomId, mode = "board") {
    state.roomId = String(roomId || "").trim();
    state.currentInviteMode = String(mode || "board").trim();
  }

  function getRooms() {
    return state.rooms.map((item) => ({ ...item }));
  }

  function saveRooms(rooms) {
    state.rooms = rooms.map((item) => ({ ...item }));
    writeJson(STORAGE_KEYS.boardRoom, state.rooms);
  }

  function getLobby(roomId) {
    return ensurePreviewState(roomId);
  }

  function saveLobby(lobby) {
    writeJson(STORAGE_KEYS.boardLobby, lobby);
  }

  window.BoardShared = {
    init,
    showToast,
    openFriends() {
      document.getElementById("boardFriendDock")?.classList.remove("collapsed");
      writeLocalValue(STORAGE_KEYS.friendDockCollapsed, "0");
      updateDockMinIcon();
      if (state.socket?.connected) {
        if (state.socialReady) fetchFriends();
        else socialAuth();
      }
    },
    closeFriends() {
      document.getElementById("boardFriendDock")?.classList.add("collapsed");
      writeLocalValue(STORAGE_KEYS.friendDockCollapsed, "1");
      updateDockMinIcon();
    },
    attachSocket,
    refreshFriends: fetchFriends,
    setRoomContext,
    getRooms,
    saveRooms,
    getLobby,
    saveLobby,
    avatarUrlById,
    getState() {
      return state;
    },
  };
})();
