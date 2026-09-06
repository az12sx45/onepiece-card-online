(() => {
  "use strict";

  const query = new URLSearchParams(location.search);
  const storedRoomCode = sanitizeRoomCode(sessionStorage.getItem("op_battle_chess_room_code") || "");
  const queryAction = String(query.get("room_action") || sessionStorage.getItem("op_battle_chess_room_action") || "create");
  const action = queryAction === "create" && /^C[A-Z0-9]+$/.test(storedRoomCode) && !query.get("room") ? "join" : queryAction;
  const requestedCode = sanitizeRoomCode(query.get("room") || storedRoomCode);
  const requestedRole = query.get("spectate") === "1" || action === "spectate" ? "spectator" : "player";
  const lobby = document.querySelector("#pre-match-lobby");
  const setupView = document.querySelector("#room-setup-view");
  const waitingView = document.querySelector("#room-waiting-view");
  const factionSelect = document.querySelector("#bottom-faction");
  const battlefieldSelect = document.querySelector("#battlefield-theme");
  const setupBack = document.querySelector("#leave-room-setup");
  const summary = document.querySelector("#lobby-selection-summary");
  const factionButtons = [...setupView.querySelectorAll("button[data-faction]")];
  const factionShowcases = [...setupView.querySelectorAll("[data-faction-showcase]")];
  const battlefieldButtons = [...setupView.querySelectorAll("button[data-battlefield]")];
  const refs = {
    roomName: document.querySelector("#chess-lobby-name"),
    roomCode: document.querySelector("#chess-lobby-code"),
    roomStatus: document.querySelector("#chess-lobby-status"),
    copyCode: document.querySelector("#copy-chess-room-code"),
    playerCount: document.querySelector("#chess-player-count"),
    seats: document.querySelector("#chess-player-seats"),
    visibility: document.querySelector("#chess-room-visibility"),
    spectators: document.querySelector("#chess-room-spectators"),
    difficulty: document.querySelector("#chess-cpu-difficulty"),
    addCpu: document.querySelector("#chess-add-cpu"),
    factionLabel: document.querySelector("#chess-room-faction-label"),
    battlefieldLabel: document.querySelector("#chess-room-battlefield-label"),
    spectatorCount: document.querySelector("#chess-spectator-count"),
    settingsLock: document.querySelector("#chess-settings-lock"),
    chat: document.querySelector("#chess-lobby-chat"),
    chatInput: document.querySelector("#chess-lobby-chat-input"),
    chatSend: document.querySelector("#chess-lobby-chat-send"),
    inviteFriend: document.querySelector("#invite-chess-friend"),
    leave: document.querySelector("#leave-chess-room"),
    waitingReady: document.querySelector("#toggle-waiting-ready"),
    waitingNext: document.querySelector("#advance-room-setup"),
    ready: document.querySelector("#toggle-chess-ready"),
    start: document.querySelector("#start-chess-match"),
    message: document.querySelector("#chess-lobby-message"),
    prepMessage: document.querySelector("#prep-lobby-message"),
    prepChoices: document.querySelector("#prep-player-choices"),
    factionPrev: document.querySelector("#faction-prev"),
    factionNext: document.querySelector("#faction-next"),
    playerFactionName: document.querySelector("#player-faction-name"),
    opponentFactionName: document.querySelector("#opponent-faction-name"),
    battlefieldPrev: document.querySelector("#battlefield-prev"),
    battlefieldNext: document.querySelector("#battlefield-next"),
    battlefieldCarouselName: document.querySelector("#battlefield-carousel-name"),
    battlefieldCarouselDetail: document.querySelector("#battlefield-carousel-detail"),
    battlefieldCarouselIndex: document.querySelector("#battlefield-carousel-index"),
    battlefieldReveal: document.querySelector("#battlefield-reveal"),
    battlefieldRevealArt: document.querySelector("#battlefield-reveal-art"),
    battlefieldRevealBoard: document.querySelector("#battlefield-reveal-board"),
    battlefieldRevealName: document.querySelector("#battlefield-reveal-name"),
    battlefieldRevealChoiceA: document.querySelector("#battlefield-reveal-choice-a"),
    battlefieldRevealChoiceB: document.querySelector("#battlefield-reveal-choice-b"),
    battlefieldRevealStatus: document.querySelector("#battlefield-reveal-status"),
  };

  if (!lobby || !setupView || !waitingView || !factionSelect || !battlefieldSelect || !summary) return;
  document.body.classList.add("is-pre-match-lobby");

  const validFactions = new Set([...factionSelect.options].map((option) => option.value));
  const validBattlefields = new Set([...battlefieldSelect.options].map((option) => option.value));
  const state = {
    faction: validFactions.has(factionSelect.value) ? factionSelect.value : "straw-hat-pirates",
    battlefield: validBattlefields.has(battlefieldSelect.value) ? battlefieldSelect.value : "onigashima",
    socket: null,
    profile: null,
    localPreview: false,
    lobby: null,
    role: requestedRole,
    applyingSettings: false,
    applyingLoadout: false,
    preparationResetting: false,
    started: false,
  };

  function sanitizeRoomCode(value) {
    return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  }

  function readStorage(key, fallback = "") {
    try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; }
  }

  function profileFallback() {
    return {
      userId: Number(readStorage("op_user_id", "0")) || 700001,
      name: readStorage("op_name", "") || readStorage("op_player_name", "") || "本機測試玩家",
      avatar: Number(readStorage("op_avatar", "8")) || 8,
      title: readStorage("op_board_title", "") || "新世界棋士",
    };
  }

  function deviceId() {
    return readStorage("op_device_id", "") || `chess-${state.profile?.userId || 0}`;
  }

  function sharedSecret() {
    return String(readStorage("opSecret", "") || readStorage("op_secret", "")).trim();
  }

  function profilePayload() {
    return { ...state.profile, clientId: deviceId(), deviceId: deviceId() };
  }

  function emitAck(eventName, payload, timeoutMs = 12000) {
    return new Promise((resolve) => {
      if (!state.socket) return resolve({ ok:false, error:"socket_unavailable" });
      try {
        state.socket.timeout(timeoutMs).emit(eventName, payload, (error, result = {}) => {
          resolve(error ? { ok:false, error:"timeout" } : (result || { ok:false, error:"unknown" }));
        });
      } catch (error) {
        resolve({ ok:false, error:String(error?.message || error || "socket_error") });
      }
    });
  }

  function optionLabel(select, value) {
    return [...select.options].find((option) => option.value === value)?.textContent?.trim() || value;
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function setMessage(message = "") {
    if (refs.message) refs.message.textContent = message;
    if (refs.prepMessage) refs.prepMessage.textContent = message;
  }

  function errorText(code) {
    const map = {
      not_found:"找不到這個房間，請確認房號。",
      full:"房間已滿。",
      playing:"棋局已經開始，請改用觀戰。",
      host_only:"只有房主可以執行這個操作。",
      not_waiting:"棋局已開始，不能再更改等待室。",
      not_all_ready:"兩位真人玩家都要先按準備。",
      need_opponent:"需要另一位玩家或 CPU 才能開始。",
      loadout_required:"請先完成陣營與場地選擇。",
      faction_conflict:"雙方陣營不能相同，請重新選擇。",
      spectators_disabled:"這個房間沒有開放觀戰。",
      socket_unavailable:"無法連上霸海戰棋房間服務。",
      auth_required:"共用帳號驗證尚未完成，請重新登入。",
      "bad secret":"登入已失效，請重新登入。",
      timeout:"房間服務沒有回應，請稍後重試。",
    };
    return map[String(code || "")] || `房間操作失敗：${String(code || "未知錯誤")}`;
  }

  function selectButton(buttons, dataKey, value) {
    buttons.forEach((button) => {
      const selected = button.dataset[dataKey] === value;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function oppositeFaction(factionId) {
    return factionId === "onigashima-alliance" ? "straw-hat-pirates" : "onigashima-alliance";
  }

  function randomChessColor() {
    try {
      const value = new Uint8Array(1);
      crypto.getRandomValues(value);
      return value[0] % 2 === 0 ? "w" : "b";
    } catch (_) {
      return Math.random() < 0.5 ? "w" : "b";
    }
  }

  function hasValidLoadouts(players = state.lobby?.players || []) {
    return players.length === 2
      && players.every((player) => validFactions.has(player.factionId) && validBattlefields.has(player.battlefieldId));
  }

  function allWaitingReady(room = state.lobby) {
    const players = Array.isArray(room?.players) ? room.players : [];
    return players.length === 2 && players.every((player) => player.isCPU || player.ready);
  }

  function roomPhase(room = state.lobby) {
    return room?.settings?.phase === "preparation" ? "preparation" : "waiting";
  }

  function preparationRank(player) {
    if (!player) return "等待對手";
    if (player.isCPU) return `${difficultyLabel(player.cpuDifficulty)} 分`;
    return player.title || "新世界棋士";
  }

  function renderPreparationSeat(player) {
    const seat = document.createElement("article");
    seat.className = `prep-choice-seat${player ? "" : " is-empty"}`;
    if (player && Number(player.userId) === Number(state.profile?.userId)) seat.classList.add("is-me");
    if (player?.factionId) seat.dataset.faction = player.factionId;
    const avatar = document.createElement("span");
    avatar.className = "prep-choice-seat__avatar";
    const imageUrl = avatarUrl(player);
    if (player && !player.isCPU && imageUrl) {
      const image = document.createElement("img");
      image.alt = "";
      image.src = imageUrl;
      image.onerror = () => {
        image.onerror = null;
        image.src = window.BattleSocial?.fallbackAvatar?.(player.name) || "";
      };
      avatar.appendChild(image);
    } else {
      const fallback = document.createElement("span");
      fallback.textContent = player?.isCPU ? "♟" : (player?.name?.trim()?.[0] || "+");
      avatar.appendChild(fallback);
    }
    const identity = document.createElement("span");
    identity.className = "prep-choice-seat__identity";
    const name = document.createElement("strong");
    name.textContent = player?.isCPU ? "CPU 棋士" : (player?.name || "等待棋士加入");
    const rank = document.createElement("span");
    rank.className = "prep-choice-seat__rank";
    rank.textContent = preparationRank(player);
    identity.append(name, rank);
    seat.append(avatar, identity);
    return seat;
  }

  function renderSetup() {
    const room = state.lobby;
    const me = currentPlayer();
    const opponent = room?.players?.find((player) => Number(player.userId) !== Number(state.profile?.userId));
    if (me && validFactions.has(me.factionId)) state.faction = me.factionId;
    if (me && validBattlefields.has(me.battlefieldId)) state.battlefield = me.battlefieldId;
    const opponentFaction = validFactions.has(opponent?.factionId)
      ? opponent.factionId
      : oppositeFaction(state.faction);
    selectButton(factionButtons, "faction", state.faction);
    selectButton(battlefieldButtons, "battlefield", state.battlefield);
    const battlefieldIds = [...validBattlefields];
    const battlefieldIndex = Math.max(0, battlefieldIds.indexOf(state.battlefield));
    const battlefieldButton = battlefieldButtons.find((button) => button.dataset.battlefield === state.battlefield);
    const battlefieldLabel = battlefieldButton?.querySelector(":scope > span");
    const battlefieldName = [...(battlefieldLabel?.childNodes || [])]
      .find((node) => node.nodeType === Node.TEXT_NODE)?.textContent?.trim();
    if (refs.battlefieldCarouselName) refs.battlefieldCarouselName.textContent = battlefieldName || optionLabel(battlefieldSelect, state.battlefield);
    if (refs.battlefieldCarouselDetail) refs.battlefieldCarouselDetail.textContent = battlefieldLabel?.querySelector("small")?.textContent || "決戰場地";
    if (refs.battlefieldCarouselIndex) refs.battlefieldCarouselIndex.textContent = String(battlefieldIndex + 1).padStart(2, "0");
    factionShowcases.forEach((showcase) => {
      const factionId = showcase.dataset.factionShowcase;
      const showcaseSide = showcase.dataset.factionSide;
      const isPlayerSide = showcaseSide === "player" && factionId === state.faction;
      const isOpponentSide = showcaseSide === "opponent" && factionId === opponentFaction;
      showcase.classList.toggle("is-active", isPlayerSide);
      showcase.classList.toggle("is-player-side", isPlayerSide);
      showcase.classList.toggle("is-opponent-side", isOpponentSide);
      showcase.setAttribute("aria-hidden", String(!isPlayerSide && !isOpponentSide));
    });
    lobby.dataset.faction = state.faction;
    lobby.dataset.opponentFaction = opponentFaction;
    lobby.dataset.battlefield = state.battlefield;
    if (refs.playerFactionName) refs.playerFactionName.textContent = optionLabel(factionSelect, state.faction);
    if (refs.opponentFactionName) refs.opponentFactionName.textContent = optionLabel(factionSelect, opponentFaction);
    summary.textContent = `${optionLabel(factionSelect, state.faction)} × ${optionLabel(battlefieldSelect, state.battlefield)}`;
    if (refs.prepChoices) {
      refs.prepChoices.replaceChildren(renderPreparationSeat(me), (() => {
        const versus = document.createElement("div");
        versus.className = "prep-versus";
        versus.setAttribute("aria-hidden", "true");
        const label = document.createElement("b");
        label.textContent = "VS";
        versus.append(label, document.createElement("i"));
        return versus;
      })(), renderPreparationSeat(opponent));
    }
    const clearingWaitingReady = state.preparationResetting;
    const locked = !me || state.role === "spectator" || room?.status !== "waiting" || !!me.ready || state.applyingLoadout || clearingWaitingReady;
    [...factionButtons, ...battlefieldButtons].forEach((button) => { button.disabled = locked; });
    [refs.factionPrev, refs.factionNext, refs.battlefieldPrev, refs.battlefieldNext].forEach((button) => { if (button) button.disabled = locked; });
    refs.ready.hidden = state.role === "spectator" || !me || !!me?.isCPU;
    refs.ready.disabled = !me || !hasValidLoadouts() || clearingWaitingReady || state.preparationResetting;
    refs.ready.textContent = clearingWaitingReady ? "正在進入備戰…" : (me?.ready ? "解除鎖定" : "鎖定選擇");
    refs.ready.classList.toggle("is-ready", !!me?.ready);
    refs.start.hidden = !isHost() || state.role === "spectator";
    refs.start.disabled = !canStart() || room?.status !== "waiting" || clearingWaitingReady || state.preparationResetting;
    refs.start.textContent = canStart() && !clearingWaitingReady ? "開始遊戲" : "等待雙方鎖定";
  }

  function avatarUrl(player) {
    const seatAvatarUrl = String(player?.seatAvatarUrl || "").trim();
    if (seatAvatarUrl) return seatAvatarUrl;
    if (player?.isCPU) return "";
    if (state.localPreview) return window.BattleSocial?.fallbackAvatar?.(player?.name) || "";
    return window.BattleSocial?.avatarUrl?.(player?.avatar || 1, player?.name) || "";
  }

  function difficultyLabel(value) {
    return ({ easy:"簡單・約 1320", normal:"普通・約 1600", hard:"困難・約 2000", despair:"絕望・約 2400" })[value] || "普通・約 1600";
  }

  function difficultyShortLabel(value) {
    return ({ easy:"簡單", normal:"普通", hard:"困難", despair:"絕望" })[value] || "普通";
  }

  function renderSeat(player, index) {
    const seat = document.createElement("article");
    seat.className = `chess-player-seat${player ? "" : " is-empty"}`;
    if (player && Number(player.userId) === Number(state.profile?.userId)) seat.classList.add("is-me");
    if (player?.isHost) seat.classList.add("is-host");
    if (player && (player.ready || player.isCPU)) seat.classList.add("is-ready");
    const avatar = document.createElement("span");
    avatar.className = "chess-player-seat__avatar";
    const imageUrl = avatarUrl(player);
    if (player && imageUrl) {
      const image = document.createElement("img");
      image.alt = "";
      image.src = imageUrl;
      image.onerror = () => {
        image.onerror = null;
        if (!player.isCPU) {
          image.src = window.BattleSocial?.fallbackAvatar?.(player.name) || "";
          return;
        }
        image.remove();
        const fallback = document.createElement("span");
        fallback.textContent = "♟";
        avatar.appendChild(fallback);
      };
      avatar.appendChild(image);
    } else {
      const fallback = document.createElement("span");
      fallback.textContent = player?.isCPU ? "♟" : "+";
      avatar.appendChild(fallback);
    }
    const meta = document.createElement("span");
    meta.className = "chess-player-seat__meta";
    const name = document.createElement("strong");
    const subtitle = document.createElement("small");
    name.textContent = player?.isCPU
      ? `CPU・${difficultyShortLabel(player.cpuDifficulty)}`
      : (player?.name || "等待棋士加入");
    subtitle.textContent = player ? (player.color === "w" ? "白方" : "黑方") : `席位 ${index + 1}`;
    meta.append(name, subtitle);
    const badge = document.createElement("span");
    badge.className = "chess-player-seat__state";
    let badgeLabel = "未準備";
    if (!player) {
      badgeLabel = "空席位";
      badge.classList.add("is-empty");
    } else if (player.ready || player.isCPU) {
      badgeLabel = "已準備";
      badge.classList.add("is-ready");
    } else if (player.online === false) {
      badgeLabel = "離線";
      badge.classList.add("is-offline");
    }
    badge.setAttribute("role", "img");
    badge.setAttribute("aria-label", badgeLabel);
    badge.title = badgeLabel;
    seat.append(avatar, meta, badge);
    return seat;
  }

  function currentPlayer() {
    return state.lobby?.players?.find((player) => Number(player.userId) === Number(state.profile?.userId)) || null;
  }

  function isHost() {
    return Number(state.lobby?.hostUserId) === Number(state.profile?.userId);
  }

  function canStart() {
    const players = state.lobby?.players || [];
    return hasValidLoadouts(players) && players.every((player) => player.isCPU || player.ready);
  }

  function renderChat() {
    refs.chat.replaceChildren();
    (state.lobby?.chat || []).forEach((message) => {
      if (message.system) {
        const system = document.createElement("div");
        system.className = "chess-lobby-chat-system";
        system.textContent = message.text;
        refs.chat.appendChild(system);
        return;
      }
      const row = document.createElement("div");
      row.className = "chess-lobby-chat-row";
      const image = document.createElement("img");
      image.alt = "";
      image.src = window.BattleSocial?.avatarUrl?.(message.avatar || 1, message.name) || "";
      image.onerror = () => {
        image.onerror = null;
        image.src = window.BattleSocial?.fallbackAvatar?.(message.name) || "";
      };
      const body = document.createElement("div");
      const name = document.createElement("strong");
      const text = document.createElement("p");
      name.textContent = message.name || "棋士";
      text.textContent = message.text || "";
      body.append(name, text);
      row.append(image, body);
      refs.chat.appendChild(row);
    });
    refs.chat.scrollTop = refs.chat.scrollHeight + 200;
  }

  function renderWaiting() {
    if (!state.lobby) return;
    const room = state.lobby;
    const players = Array.isArray(room.players) ? room.players : [];
    const settings = room.settings || {};
    const me = currentPlayer();
    const host = isHost();
    const cpu = players.find((player) => player.isCPU);
    refs.roomName.textContent = room.roomName || "霸海戰棋等待室";
    refs.roomCode.textContent = room.roomCode || "—";
    refs.roomStatus.textContent = room.status === "playing" ? "棋局已開始" : "";
    refs.roomStatus.hidden = room.status !== "playing";
    refs.playerCount.textContent = `${players.length}/${room.maxPlayers || 2}`;
    refs.seats.replaceChildren(renderSeat(players[0], 0), renderSeat(players[1], 1));
    state.applyingSettings = true;
    refs.visibility.value = settings.visibility === "private" ? "private" : "public";
    refs.spectators.checked = settings.allowSpectators !== false;
    refs.difficulty.value = settings.cpuDifficulty || "normal";
    state.applyingSettings = false;
    [refs.visibility, refs.spectators, refs.difficulty].forEach((control) => { control.disabled = !host || room.status !== "waiting" || state.role === "spectator"; });
    refs.addCpu.disabled = !host || room.status !== "waiting" || (!cpu && players.length >= 2);
    refs.addCpu.textContent = cpu ? "移除 CPU" : "加入 CPU";
    refs.settingsLock.textContent = host ? "房主可調整" : "由房主設定";
    refs.factionLabel.textContent = "";
    refs.factionLabel.hidden = true;
    refs.battlefieldLabel.textContent = "";
    refs.battlefieldLabel.hidden = true;
    refs.spectatorCount.textContent = `${Number(room.spectatorCount) || 0} 人觀戰`;
    refs.chatInput.disabled = !state.localPreview && !state.socket;
    refs.chatSend.disabled = refs.chatInput.disabled;
    refs.inviteFriend.disabled = state.localPreview || !state.socket || room.status !== "waiting";
    const rosterReady = players.length === 2;
    const everyoneReady = allWaitingReady(room);
    if (refs.waitingReady) {
      refs.waitingReady.hidden = state.role === "spectator" || !me || !!me?.isCPU;
      refs.waitingReady.disabled = !rosterReady || room.status !== "waiting" || roomPhase(room) !== "waiting";
      refs.waitingReady.textContent = me?.ready ? "取消準備" : "準備";
      refs.waitingReady.classList.toggle("is-ready", !!me?.ready);
    }
    if (refs.waitingNext) {
      refs.waitingNext.hidden = !host || state.role === "spectator";
      refs.waitingNext.disabled = !everyoneReady || room.status !== "waiting" || roomPhase(room) !== "waiting";
      refs.waitingNext.textContent = everyoneReady ? "進入備戰" : "等待全員準備";
    }
    lobby.dataset.waitingReady = everyoneReady ? "all" : (rosterReady ? "pending" : "roster");
    if (refs.message && room.status === "waiting") {
      refs.message.textContent = !rosterReady
        ? "等待第二位棋士加入房間"
        : (everyoneReady ? "雙方已準備，請由房主進入下一步" : "玩家已到齊，請雙方按下準備");
    }
    renderChat();
    lobby.dataset.faction = state.faction;
    window.BattleSocial?.setRoomContext?.({ roomCode:room.roomCode, mode:"chess", status:room.status });
    lobby.scrollTop = 0;
    lobby.scrollLeft = 0;
    const panel = lobby.querySelector(".pre-match-lobby__panel");
    if (panel) panel.scrollTop = 0;
  }

  function showWaiting(room, role = state.role) {
    state.lobby = room;
    state.role = role;
    const preparationReady = role !== "spectator"
      && room?.status === "waiting"
      && (room?.players?.length || 0) >= 2
      && roomPhase(room) === "preparation";
    setupView.hidden = !preparationReady;
    waitingView.hidden = preparationReady;
    lobby.dataset.stage = preparationReady ? "preparation" : "matchmaking";
    if (preparationReady) {
      setMessage("");
      renderSetup();
      // The server resets waiting readiness once when entering preparation.
      // Later snapshots include deliberate loadout locks; do not undo them.
    } else {
      waitingView.classList.toggle("is-local", state.localPreview);
      renderWaiting();
    }
    const panel = lobby.querySelector(".pre-match-lobby__panel");
    if (panel) panel.scrollTop = 0;
    lobby.scrollTop = 0;
    lobby.scrollLeft = 0;
  }

  function createLocalLobby() {
    const profile = profilePayload();
    const hostColor = randomChessColor();
    return {
      roomId:"LOCAL",
      roomCode:"LOCAL",
      roomName:`${profile.name} 的 CPU 棋局`,
      hostUserId:profile.userId,
      status:"waiting",
      maxPlayers:2,
      settings:{ mode:"cpu", phase:"waiting", visibility:"private", allowSpectators:false, cpuDifficulty:"normal", hostFaction:state.faction, battlefieldId:state.battlefield },
      players:[{ ...profile, seatAvatarUrl:"./images/board/avatars/50.webp", color:hostColor, isHost:true, ready:false, online:true, isCPU:false, factionId:state.faction, battlefieldId:state.battlefield }],
      spectatorCount:0,
      chat:[],
      game:{ fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", moveSequence:0, lastMove:null },
    };
  }

  function persistRoom(roomCode, role) {
    try {
      sessionStorage.setItem("op_battle_chess_room_code", roomCode || "");
      sessionStorage.setItem("op_battle_chess_room_role", role || "player");
    } catch (_) {}
  }

  async function ensureRoomAuth() {
    if (state.localPreview) return true;
    if (!state.socket || !sharedSecret()) {
      setMessage(errorText("auth_required"));
      return false;
    }
    const result = await emitAck("SOCIAL_AUTH", { secret:sharedSecret(), deviceId:deviceId() });
    if (!result.ok) {
      setMessage(errorText(result.error || "auth_required"));
      return false;
    }
    if (result.me) state.profile = { ...state.profile, ...result.me };
    return true;
  }

  async function createRoom() {
    refs.roomStatus.textContent = "正在建立房間…";
    if (state.localPreview) {
      showWaiting(createLocalLobby(), "player");
      return;
    }
    if (!state.socket) {
      setMessage("共用房間伺服器尚未連線，請返回後重新登入。", true);
      return;
    }
    if (!(await ensureRoomAuth())) {
      return;
    }
    const result = await emitAck("CHESS_JOIN_ROOM", {
      create:true,
      profile:profilePayload(),
      settings:{ mode:"online", phase:"waiting", visibility:"public", allowSpectators:true, cpuDifficulty:"normal" },
    });
    if (!result.ok || !result.lobby) {
      window.alert(errorText(result.error));
      return;
    }
    persistRoom(result.lobby.roomCode, "player");
    showWaiting(result.lobby, "player");
  }

  async function joinRequestedRoom() {
    setupView.hidden = true;
    waitingView.hidden = false;
    refs.roomCode.textContent = requestedCode || "—";
    refs.roomStatus.textContent = "正在加入房間…";
    if (!requestedCode) {
      setMessage("缺少房間代碼，請返回房間選擇。");
      return;
    }
    if (state.localPreview || !state.socket) {
      setMessage("本機測試模式不能加入線上房間，請返回後使用共用帳號登入。");
      return;
    }
    if (!(await ensureRoomAuth())) return;
    const result = await emitAck("CHESS_JOIN_ROOM", {
      roomCode:requestedCode,
      profile:profilePayload(),
      role:requestedRole,
      spectate:requestedRole === "spectator",
      allowPlayingJoin:requestedRole === "spectator",
    });
    if (!result.ok || !result.lobby) {
      setMessage(errorText(result.error));
      return;
    }
    persistRoom(result.lobby.roomCode, result.role || requestedRole);
    showWaiting(result.lobby, result.role || requestedRole);
    if (result.lobby.status === "playing") startGame(result.lobby);
  }

  async function updateSettings() {
    if (state.applyingSettings || !state.lobby || !isHost()) return;
    const settings = {
      phase:roomPhase(state.lobby),
      visibility:refs.visibility.value,
      allowSpectators:refs.spectators.checked,
      cpuDifficulty:refs.difficulty.value,
    };
    if (state.localPreview) {
      Object.assign(state.lobby.settings, settings);
      const cpu = state.lobby.players.find((player) => player.isCPU);
      if (cpu) {
        cpu.cpuDifficulty = settings.cpuDifficulty;
        cpu.name = `CPU・${difficultyLabel(settings.cpuDifficulty)}`;
      }
      renderWaiting();
      return;
    }
    const result = await emitAck("CHESS_UPDATE_SETTINGS", { roomCode:state.lobby.roomCode, settings });
    if (!result.ok) setMessage(errorText(result.error));
  }

  async function updateLoadout(next = {}) {
    const me = currentPlayer();
    if (!me || state.role === "spectator" || me.ready || state.applyingLoadout) return;
    const factionId = validFactions.has(next.factionId) ? next.factionId : state.faction;
    const battlefieldId = validBattlefields.has(next.battlefieldId) ? next.battlefieldId : state.battlefield;
    state.faction = factionId;
    state.battlefield = battlefieldId;
    state.applyingLoadout = true;
    if (state.localPreview) {
      Object.assign(me, { factionId, battlefieldId, ready:false });
      state.applyingLoadout = false;
      renderSetup();
      return;
    }
    const result = await emitAck("CHESS_UPDATE_LOADOUT", { roomCode:state.lobby.roomCode, factionId, battlefieldId });
    state.applyingLoadout = false;
    if (!result.ok || !result.lobby) {
      setMessage(errorText(result.error));
      renderSetup();
      return;
    }
    state.lobby = result.lobby;
    renderSetup();
  }

  async function cycleFaction(step) {
    if (!Number.isFinite(step) || state.applyingLoadout) return;
    const factions = [...validFactions];
    const currentIndex = Math.max(0, factions.indexOf(state.faction));
    const nextIndex = (currentIndex + (step < 0 ? -1 : 1) + factions.length) % factions.length;
    lobby.dataset.factionMotion = step < 0 ? "previous" : "next";
    await updateLoadout({ factionId:factions[nextIndex] });
  }

  async function cycleBattlefield(step) {
    if (!Number.isFinite(step) || state.applyingLoadout) return;
    const battlefields = [...validBattlefields];
    const currentIndex = Math.max(0, battlefields.indexOf(state.battlefield));
    const nextIndex = (currentIndex + (step < 0 ? -1 : 1) + battlefields.length) % battlefields.length;
    lobby.dataset.battlefieldMotion = step < 0 ? "previous" : "next";
    await updateLoadout({ battlefieldId:battlefields[nextIndex] });
  }

  async function toggleCpu() {
    if (!state.lobby || !isHost()) return;
    const cpu = state.lobby.players.find((player) => player.isCPU);
    if (state.localPreview) {
      if (cpu) {
        state.lobby.players = state.lobby.players.filter((player) => !player.isCPU);
        state.lobby.chat.push({ system:true, text:`${cpu.name} 已離開房間。`, ts:Date.now() });
      } else if (state.lobby.players.length < 2) {
        const difficulty = refs.difficulty.value;
        state.lobby.settings.cpuDifficulty = difficulty;
        const host = state.lobby.players[0];
        const battlefieldIds = [...validBattlefields];
        const hostBattlefieldIndex = Math.max(0, battlefieldIds.indexOf(host.battlefieldId));
        state.lobby.players.push({ userId:-9001, clientId:"chess-cpu-1", name:`CPU・${difficultyLabel(difficulty)}`, avatar:1, seatAvatarUrl:"./images/board/avatars/cpu2.webp", title:"電腦棋士", color:host.color === "w" ? "b" : "w", isHost:false, ready:true, online:true, isCPU:true, cpuDifficulty:difficulty, factionId:oppositeFaction(host.factionId), battlefieldId:battlefieldIds[(hostBattlefieldIndex + 1) % battlefieldIds.length] });
        state.lobby.chat.push({ system:true, text:`CPU・${difficultyLabel(difficulty)} 已加入房間。`, ts:Date.now() });
      }
      showWaiting(state.lobby, state.role);
      return;
    }
    const eventName = cpu ? "CHESS_REMOVE_CPU" : "CHESS_ADD_CPU";
    const result = await emitAck(eventName, { roomCode:state.lobby.roomCode, difficulty:refs.difficulty.value });
    if (!result.ok) setMessage(errorText(result.error));
  }

  async function toggleWaitingReady() {
    const me = currentPlayer();
    const players = state.lobby?.players || [];
    if (!me || state.role === "spectator" || players.length !== 2 || roomPhase() !== "waiting") return;
    if (state.localPreview) {
      me.ready = !me.ready;
      state.lobby.chat.push({ system:true, text:`${me.name}${me.ready ? "已在等待室準備完成" : "取消了等待室準備"}。`, ts:Date.now() });
      renderWaiting();
      return;
    }
    refs.waitingReady.disabled = true;
    const result = await emitAck("CHESS_LOBBY_READY", { roomCode:state.lobby.roomCode, ready:!me.ready });
    if (!result.ok) {
      setMessage(errorText(result.error));
      renderWaiting();
      return;
    }
    if (result.lobby) {
      state.lobby = result.lobby;
      renderWaiting();
    }
  }

  async function resetOwnReadyForPreparation() {
    const me = currentPlayer();
    if (!me || me.isCPU || !me.ready || state.preparationResetting || roomPhase() !== "preparation") return;
    state.preparationResetting = true;
    renderSetup();
    if (state.localPreview) {
      me.ready = false;
      state.preparationResetting = false;
      renderSetup();
      return;
    }
    const result = await emitAck("CHESS_LOBBY_READY", { roomCode:state.lobby.roomCode, ready:false });
    state.preparationResetting = false;
    if (!result.ok) {
      setMessage(errorText(result.error));
      renderSetup();
      return;
    }
    if (result.lobby) state.lobby = result.lobby;
    else me.ready = false;
    renderSetup();
  }

  async function advanceRoomSetup() {
    if (!state.lobby || !isHost() || !allWaitingReady() || roomPhase() !== "waiting") return;
    refs.waitingNext.disabled = true;
    if (state.localPreview) {
      state.lobby.settings.phase = "preparation";
      state.lobby.players.forEach((player) => { if (!player.isCPU) player.ready = false; });
      state.lobby.chat.push({ system:true, text:"全員已準備，由房主帶領進入備戰。", ts:Date.now() });
      showWaiting(state.lobby, state.role);
      return;
    }
    const settings = { ...(state.lobby.settings || {}), phase:"preparation" };
    const result = await emitAck("CHESS_UPDATE_SETTINGS", { roomCode:state.lobby.roomCode, settings });
    if (!result.ok) {
      setMessage(errorText(result.error));
      renderWaiting();
      return;
    }
    state.lobby = result.lobby || { ...state.lobby, settings };
    showWaiting(state.lobby, state.role);
  }

  async function toggleReady() {
    const me = currentPlayer();
    if (!me) return;
    if (!hasValidLoadouts()) {
      setMessage(errorText("loadout_required"));
      return;
    }
    if (state.localPreview) {
      me.ready = !me.ready;
      state.lobby.chat.push({ system:true, text:`${me.name}${me.ready ? "已準備完成" : "取消了準備"}。`, ts:Date.now() });
      renderSetup();
      return;
    }
    const result = await emitAck("CHESS_LOBBY_READY", { roomCode:state.lobby.roomCode, ready:!me.ready });
    if (!result.ok) setMessage(errorText(result.error));
  }

  async function startMatch() {
    if (!state.lobby || !isHost() || !canStart()) return;
    refs.start.disabled = true;
    if (state.localPreview) {
      const players = state.lobby.players;
      const choices = players.map((player) => player.battlefieldId);
      const uniqueChoices = [...new Set(choices)];
      const selectedBattlefield = uniqueChoices.length === 1
        ? uniqueChoices[0]
        : uniqueChoices[Math.floor(Math.random() * uniqueChoices.length)];
      const whitePlayer = players.find((player) => player.color === "w") || players[0];
      Object.assign(state.lobby.settings, {
        hostFaction:whitePlayer.factionId,
        battlefieldId:selectedBattlefield,
        battlefieldChoices:choices,
        battlefieldResolution:uniqueChoices.length === 1 ? "unanimous" : "random-two",
      });
      state.lobby.status = "playing";
      await startGame(state.lobby);
      return;
    }
    const result = await emitAck("CHESS_START_GAME", { roomCode:state.lobby.roomCode, profile:profilePayload() });
    if (!result.ok) {
      refs.start.disabled = false;
      setMessage(errorText(result.error));
    }
  }

  function configureBoard(room) {
    const api = window.__BATTLE_CHESS__;
    if (!api?.getState?.()?.ready) {
      window.setTimeout(() => configureBoard(room), 80);
      return;
    }
    const me = room.players?.find((player) => Number(player.userId) === Number(state.profile?.userId));
    const viewColor = state.role === "spectator" ? "w" : (me?.color || "w");
    const settings = room.settings || {};
    const whitePlayer = room.players?.find((player) => player.color === "w") || room.players?.[0];
    const blackPlayer = room.players?.find((player) => player.color === "b") || room.players?.[1];
    const whiteFaction = validFactions.has(whitePlayer?.factionId) ? whitePlayer.factionId : (settings.hostFaction || "straw-hat-pirates");
    const blackFaction = validFactions.has(blackPlayer?.factionId) ? blackPlayer.factionId : oppositeFaction(whiteFaction);
    window.__BATTLE_CHESS_FACTIONS_BY_COLOR__ = { w:whiteFaction, b:blackFaction };
    api.reset(whiteFaction, "w", viewColor);
    api.setBattlefield(settings.battlefieldId || "onigashima");
    const fen = room.game?.fen;
    if (fen && fen !== "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1") api.loadFen(fen);
  }

  function battlefieldVisual(battlefieldId) {
    const button = battlefieldButtons.find((item) => item.dataset.battlefield === battlefieldId);
    const board = button?.querySelector(".lobby-battlefield-card__board");
    return {
      id:battlefieldId,
      label:optionLabel(battlefieldSelect, battlefieldId),
      background:button?.style.getPropertyValue("--lobby-thumb") || "none",
      boardUrl:board?.getAttribute("src") || "",
    };
  }

  function paintBattlefieldReveal(battlefieldId, settled = false) {
    const visual = battlefieldVisual(battlefieldId);
    if (!refs.battlefieldRevealArt) return;
    refs.battlefieldRevealArt.style.setProperty("--battlefield-reveal-background", visual.background);
    refs.battlefieldRevealArt.dataset.battlefield = battlefieldId;
    refs.battlefieldRevealArt.classList.toggle("is-settled", settled);
    refs.battlefieldRevealArt.classList.remove("is-switching");
    void refs.battlefieldRevealArt.offsetWidth;
    refs.battlefieldRevealArt.classList.add("is-switching");
    if (refs.battlefieldRevealBoard) {
      refs.battlefieldRevealBoard.hidden = !visual.boardUrl;
      if (visual.boardUrl) refs.battlefieldRevealBoard.src = visual.boardUrl;
    }
    if (refs.battlefieldRevealName) refs.battlefieldRevealName.textContent = visual.label;
  }

  async function revealBattlefieldChoice(room) {
    if (!refs.battlefieldReveal) return;
    const playerChoices = (room?.settings?.battlefieldChoices || room?.players?.map((player) => player.battlefieldId) || [])
      .filter((battlefieldId) => validBattlefields.has(battlefieldId));
    const choices = [...new Set(playerChoices)];
    const resolved = validBattlefields.has(room?.settings?.battlefieldId)
      ? room.settings.battlefieldId
      : (choices[0] || state.battlefield);
    const first = choices[0] || resolved;
    const second = choices[1] || first;
    refs.battlefieldRevealChoiceA.textContent = optionLabel(battlefieldSelect, first);
    refs.battlefieldRevealChoiceB.textContent = optionLabel(battlefieldSelect, second);
    refs.battlefieldRevealChoiceB.hidden = choices.length < 2;
    if (refs.battlefieldRevealChoiceB.previousElementSibling) refs.battlefieldRevealChoiceB.previousElementSibling.hidden = choices.length < 2;
    refs.battlefieldRevealStatus.textContent = choices.length < 2 ? "雙方選擇一致" : "正在決定本局戰場";
    refs.battlefieldReveal.hidden = false;
    refs.battlefieldReveal.classList.add("is-active");
    const delays = choices.length < 2
      ? [360, 520]
      : [60, 60, 70, 70, 85, 100, 120, 150, 190, 240, 310, 420];
    for (let index = 0; index < delays.length; index += 1) {
      paintBattlefieldReveal(choices.length < 2 ? resolved : choices[index % choices.length]);
      await delay(delays[index]);
    }
    paintBattlefieldReveal(resolved, true);
    refs.battlefieldRevealStatus.textContent = "決戰場地確定";
    await delay(900);
    refs.battlefieldReveal.classList.remove("is-active");
    refs.battlefieldReveal.hidden = true;
  }

  async function startGame(room) {
    if (state.started) return;
    state.started = true;
    state.lobby = room;
    await revealBattlefieldChoice(room);
    document.body.classList.add("is-room-entered");
    document.body.classList.remove("is-pre-match-lobby");
    lobby.classList.add("is-closing");
    lobby.setAttribute("aria-hidden", "true");
    lobby.inert = true;
    const roomSession = { lobby:room, role:state.role, socket:state.socket, profile:state.profile, localPreview:state.localPreview };
    window.__BATTLE_ROOM_SESSION__ = roomSession;
    configureBoard(room);
    window.dispatchEvent(new CustomEvent("battle:chess-room-started", { detail:roomSession }));
    window.setTimeout(() => { lobby.hidden = true; }, 360);
  }

  async function sendChat() {
    const text = String(refs.chatInput.value || "").trim();
    if (!text || !state.lobby) return;
    refs.chatInput.value = "";
    if (state.localPreview) {
      state.lobby.chat.push({ name:state.profile.name, avatar:state.profile.avatar, userId:state.profile.userId, text, ts:Date.now() });
      renderChat();
      return;
    }
    const result = await emitAck("CHESS_LOBBY_CHAT", { roomCode:state.lobby.roomCode, text });
    if (!result.ok) {
      refs.chatInput.value = text;
      setMessage(errorText(result.error));
    }
  }

  async function leaveRoom() {
    if (state.socket && state.lobby?.roomCode) await emitAck("CHESS_LEAVE_ROOM", { roomCode:state.lobby.roomCode }, 5000);
    window.BattleSocial?.setRoomContext?.(null);
    try {
      sessionStorage.removeItem("op_battle_chess_room_code");
      sessionStorage.removeItem("op_battle_chess_room_role");
    } catch (_) {}
    location.href = "./index.html?view=game";
  }

  function wireSocket() {
    if (!state.socket || state.socket.__battleChessRoomWired) return;
    state.socket.__battleChessRoomWired = true;
    state.socket.on("CHESS_LOBBY", (message = {}) => {
      if (!message.lobby || (state.lobby?.roomCode && message.lobby.roomCode !== state.lobby.roomCode)) return;
      showWaiting(message.lobby, state.role);
    });
    state.socket.on("CHESS_NAV_GAME", (message = {}) => {
      if (!message.lobby || message.lobby.roomCode !== state.lobby?.roomCode) return;
      startGame(message.lobby);
    });
    state.socket.on("connect", async () => {
      if (!state.lobby?.roomCode || state.localPreview) return;
      if (!(await ensureRoomAuth())) return;
      const result = await emitAck("CHESS_JOIN_ROOM", {
        roomCode:state.lobby.roomCode,
        profile:profilePayload(),
        role:state.role,
        spectate:state.role === "spectator",
        allowPlayingJoin:state.role === "spectator",
      });
      if (!result.ok || !result.lobby) {
        setMessage(errorText(result.error));
        return;
      }
      state.lobby = result.lobby;
      if (!state.started) showWaiting(result.lobby, result.role || state.role);
    });
    state.socket.on("disconnect", () => {
      if (!state.started) setMessage("房間服務連線中斷，正在等待重新連線。");
    });
  }

  async function obtainSession() {
    if (window.__BATTLE_GAME_SESSION__) return window.__BATTLE_GAME_SESSION__;
    return await new Promise((resolve) => {
      const timer = window.setTimeout(() => resolve(null), 5000);
      window.addEventListener("battle:game-session-ready", (event) => {
        clearTimeout(timer);
        resolve(event.detail || null);
      }, { once:true });
    });
  }

  setupView.addEventListener("click", async (event) => {
    const factionButton = event.target.closest("button[data-faction]");
    if (factionButton && validFactions.has(factionButton.dataset.faction)) {
      await updateLoadout({ factionId:factionButton.dataset.faction });
      return;
    }
    const battlefieldButton = event.target.closest("button[data-battlefield]");
    if (battlefieldButton && validBattlefields.has(battlefieldButton.dataset.battlefield)) {
      await updateLoadout({ battlefieldId:battlefieldButton.dataset.battlefield });
    }
  });
  refs.factionPrev?.addEventListener("click", () => cycleFaction(-1));
  refs.factionNext?.addEventListener("click", () => cycleFaction(1));
  refs.battlefieldPrev?.addEventListener("click", () => cycleBattlefield(-1));
  refs.battlefieldNext?.addEventListener("click", () => cycleBattlefield(1));
  setupBack.addEventListener("click", leaveRoom);
  refs.copyCode.addEventListener("click", async () => {
    const code = state.lobby?.roomCode || "";
    if (!code) return;
    try { await navigator.clipboard.writeText(code); setMessage("房號已複製。"); }
    catch (_) { setMessage(`房號：${code}`); }
  });
  refs.visibility.addEventListener("change", updateSettings);
  refs.spectators.addEventListener("change", updateSettings);
  refs.difficulty.addEventListener("change", updateSettings);
  refs.addCpu.addEventListener("click", toggleCpu);
  refs.waitingReady?.addEventListener("click", toggleWaitingReady);
  refs.waitingNext?.addEventListener("click", advanceRoomSetup);
  refs.ready.addEventListener("click", toggleReady);
  refs.start.addEventListener("click", startMatch);
  refs.chatSend.addEventListener("click", sendChat);
  refs.chatInput.addEventListener("keydown", (event) => { if (event.key === "Enter") sendChat(); });
  refs.inviteFriend.addEventListener("click", () => {
    window.BattleSocial?.setRoomContext?.({ roomCode:state.lobby?.roomCode || "", mode:"chess", status:state.lobby?.status || "waiting" });
    window.BattleSocial?.openDock?.();
    setMessage("請在好友右側按「邀」送出房間邀請。");
  });
  refs.leave.addEventListener("click", leaveRoom);

  window.__BATTLE_ROOM_LOBBY__ = {
    getSelection:() => ({ faction:state.faction, battlefield:state.battlefield }),
    getRoom:() => state.lobby,
    open() {
      lobby.hidden = false;
      lobby.inert = false;
      lobby.removeAttribute("aria-hidden");
      lobby.classList.remove("is-closing");
      document.body.classList.remove("is-room-entered");
      document.body.classList.add("is-pre-match-lobby");
      state.started = false;
      if (state.lobby) showWaiting(state.lobby, state.role);
      else { setupView.hidden = true; waitingView.hidden = false; lobby.dataset.stage = "matchmaking"; }
    },
  };

  renderSetup();
  obtainSession().then((session) => {
    state.profile = session?.profile || profileFallback();
    state.socket = session?.socket || null;
    state.localPreview = Boolean(session?.localPreview || query.get("local_preview") === "1");
    wireSocket();
    if (action === "join" || action === "spectate") joinRequestedRoom();
    else createRoom();
  });
})();
