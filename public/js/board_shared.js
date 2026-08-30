(function () {
  const STORAGE_KEYS = {
    boardRoom: "op_board_preview_room",
    boardLobby: "op_board_preview_lobby",
    boardClientId: "op_board_client_id",
    boardUserId: "op_board_user_id",
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

  const MOCK_FRIENDS = [
    { userId: 10002, name: "索隆", avatar: 5, online: true, activity: "在羅格鎮閒晃" },
    { userId: 10003, name: "娜美", avatar: 7, online: true, activity: "查看航海圖" },
    { userId: 10004, name: "香吉士", avatar: 3, online: false, activity: "離線中" },
    { userId: 10005, name: "羅", avatar: 6, online: true, activity: "等待你的邀請" },
  ];

  const MOCK_ROOMS = [
    { roomId: "B7412", hostName: "索隆", total: 2, maxPlayers: 4, status: "waiting", title: "鬼斬試玩房" },
    { roomId: "B8201", hostName: "娜美", total: 3, maxPlayers: 4, status: "waiting", title: "航海士策略局" },
    { roomId: "B6008", hostName: "羅", total: 4, maxPlayers: 4, status: "full", title: "ROOM・Board" },
  ];

  const MOCK_INVITES = [
    { inviteId: "mock-invite-1", fromName: "娜美", fromAvatar: 7, roomId: "B8201", mode: "board" },
  ];

  const MOCK_CHAT_MAP = {
    10002: [
      { from: 10002, body: "要不要來試一下大富翁模式？", ts: Date.now() - 1000 * 60 * 10 },
      { from: MOCK_PROFILE.userId, body: "我等等就進房。", ts: Date.now() - 1000 * 60 * 7 },
    ],
    10003: [
      { from: 10003, body: "房間我先開好了，等你。", ts: Date.now() - 1000 * 60 * 4 },
    ],
  };

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
    rooms: [],
    invites: [],
    chats: {},
    currentInviteMode: "board",
    unread: new Map(),
    openChats: new Map(),
    chatOrder: [],
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
              <div class="fd-me-sub">我的好友</div>
            </div>
            <div class="fd-morewrap" style="margin-left:auto;">
              <button type="button" class="fd-btn" id="boardDockToggle" title="縮小/展開">+</button>
            </div>
          </div>
        </div>

        <div class="fd-collapsed" aria-label="friends-collapsed">
          <button id="boardDockOpen" class="fd-open" type="button">點開好友清單</button>
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
    win.input.value = "";
    const msg = { from: state.profile.userId, body, ts: Date.now() };
    state.chats[peerId] = state.chats[peerId] || [];
    state.chats[peerId].push(msg);
    appendChat(peerId, msg);
    setHint("聊天室目前是 mock 預覽資料，第二階段再接真實訊息。");
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
            <div class="n">${friend.name}</div>
            <div class="s">${friend.online ? friend.activity : "離線中"}</div>
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
    state.openChats.set(peerId, { el, log, input, badge, min: false });
    const history = state.chats[peerId] || [];
    history.forEach((msg) => appendChat(peerId, msg));
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
    menu.appendChild(mk("邀請加入房間", () => {
      showToast(`已對 ${friend.name} 顯示 mock 邀請效果`);
      setHint("好友邀請目前是 UI mock，第二階段再接真實房間邀請。");
    }));
    menu.appendChild(mk("刪除好友", () => {
      state.friends = state.friends.filter((item) => Number(item.userId) !== Number(friend.userId));
      renderFriends();
      showToast(`已從預覽清單移除 ${friend.name}`);
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
          <div class="fd-name">${invite.fromName} 的房間邀請</div>
          <div class="fd-sub">房號 ${invite.roomId} ・ 大富翁模式</div>
        </div>
        <div class="fd-reqwrap">
          <button type="button" class="fd-reqbtn ok" data-action="open">查看</button>
        </div>
      `;
      row.querySelector("[data-action='open']").addEventListener("click", () => showInvite(invite));
      list.appendChild(row);
    });

    if (state.invites.length) {
      const sep = document.createElement("div");
      sep.className = "fd-sep";
      sep.textContent = "好友名單";
      list.appendChild(sep);
    }

    state.friends.forEach((friend) => {
      const item = document.createElement("div");
      item.className = "fd-item";
      item.innerHTML = `
        <div class="fd-ava"><img src="${avatarUrlById(friend.avatar)}" alt=""></div>
        <div class="fd-meta">
          <div class="fd-name">${friend.name}</div>
          <div class="fd-sub"><span class="fd-dot${friend.online ? " on" : ""}"></span><span>${friend.online ? friend.activity : "離線中"}</span></div>
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
  }

  function showInvite(invite) {
    const back = document.getElementById("boardInviteBack");
    const ava = document.getElementById("boardInviteAva");
    const sub = document.getElementById("boardInviteSub");
    const meta = document.getElementById("boardInviteMeta");
    state.currentInvite = invite;
    ava.src = avatarUrlById(invite.fromAvatar);
    sub.textContent = `${invite.fromName} 邀請你加入航海王大富翁`;
    meta.textContent = `房號：${invite.roomId} ・ 這一階段先做獨立等待室原型`;
    back.style.display = "flex";
  }

  function hideInvite() {
    state.currentInvite = null;
    const back = document.getElementById("boardInviteBack");
    if (back) back.style.display = "none";
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
      document.getElementById("boardFriendDock")?.classList.toggle("collapsed");
      updateDockMinIcon();
    });
    document.getElementById("boardDockOpen")?.addEventListener("click", (e) => {
      e.stopPropagation();
      document.getElementById("boardFriendDock")?.classList.remove("collapsed");
      updateDockMinIcon();
    });
    document.getElementById("boardFriendDock")?.addEventListener("click", (e) => {
      const dock = document.getElementById("boardFriendDock");
      if (!dock?.classList.contains("collapsed")) return;
      if (e.target?.id === "boardDockToggle") return;
      dock.classList.remove("collapsed");
      updateDockMinIcon();
    });
    document.getElementById("boardFriendAddBtn")?.addEventListener("click", () => {
      const input = document.getElementById("boardFriendAddInput");
      const name = String(input.value || "").trim();
      if (!name) return;
      input.value = "";
      state.friends.unshift({
        userId: Date.now(),
        name,
        avatar: 1 + (state.friends.length % 9),
        online: false,
        activity: "剛加入預覽列表",
      });
      renderFriends();
      showToast(`已把 ${name} 加到預覽好友列`);
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
      const roomId = String(state.currentInvite?.roomId || "").trim();
      hideInvite();
      if (roomId) {
        location.href = `board_start.html?view=lobby&room=${encodeURIComponent(roomId)}`;
      }
    });
    document.getElementById("boardInviteReject")?.addEventListener("click", () => {
      hideInvite();
      showToast("已在預覽中拒絕邀請");
    });
    document.getElementById("boardInviteMute")?.addEventListener("click", () => {
      hideInvite();
      showToast("已標記為稍後再看");
    });
    updateDockMinIcon();
  }

  function init(options = {}) {
    state.page = String(options.page || "board").trim() || "board";
    state.roomId = String(options.roomId || "").trim();
    state.currentInviteMode = String(options.inviteMode || "board").trim();
    state.profile = createProfile();
    state.friends = MOCK_FRIENDS.map((item) => ({ ...item }));
    state.rooms = readJson(STORAGE_KEYS.boardRoom, MOCK_ROOMS.map((item) => ({ ...item })));
    state.invites = MOCK_INVITES.map((item) => ({ ...item }));
    state.chats = JSON.parse(JSON.stringify(MOCK_CHAT_MAP));

    installSharedStyle();
    ensureUiShell();
    document.body.classList.add("board-theme");
    bindUiEvents();
    renderMe();
    renderFriends();

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
      updateDockMinIcon();
    },
    closeFriends() {
      document.getElementById("boardFriendDock")?.classList.add("collapsed");
      updateDockMinIcon();
    },
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
