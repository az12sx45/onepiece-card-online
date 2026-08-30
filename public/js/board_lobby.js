(function () {
  const params = new URLSearchParams(location.search);
  const roomId = String(params.get("room") || "B7412").trim().toUpperCase();
  const { profile } = window.BoardShared.init({ page: "board_lobby", roomId, inviteMode: "board" });
  window.BoardShared.setRoomContext(roomId, "board");

  const els = {
    roomName: document.getElementById("boardLobbyRoomName"),
    roomCode: document.getElementById("boardLobbyRoomCode"),
    roomOwner: document.getElementById("boardLobbyRoomOwner"),
    playerCount: document.getElementById("boardLobbyPlayerCount"),
    playerGrid: document.getElementById("boardLobbyPlayerGrid"),
    tips: document.getElementById("boardLobbyTips"),
    chatBox: document.getElementById("boardLobbyChatBox"),
    chatInput: document.getElementById("boardLobbyChatInput"),
    sendChatBtn: document.getElementById("boardLobbySendChatBtn"),
    readyBtn: document.getElementById("boardReadyBtn"),
    inviteBtn: document.getElementById("boardInviteBtn"),
    copyBtn: document.getElementById("boardCopyCodeBtn"),
    startBtn: document.getElementById("boardStartBtn"),
    leaveBtn: document.getElementById("boardLeaveBtn"),
    backBtn: document.getElementById("boardBackBtn"),
  };

  let lobby = window.BoardShared.getLobby(roomId);

  function ensureCurrentPlayer() {
    const exists = lobby.players.some((player) => Number(player.userId) === Number(profile.userId));
    if (!exists) {
      lobby.players.unshift({
        userId: profile.userId,
        clientId: profile.clientId,
        name: profile.name,
        avatar: profile.avatar,
        title: profile.title,
        isHost: lobby.players.length === 0,
        ready: false,
        online: true,
      });
      if (lobby.players.length > lobby.maxPlayers) lobby.players = lobby.players.slice(0, lobby.maxPlayers);
    }
    const me = lobby.players.find((player) => Number(player.userId) === Number(profile.userId));
    if (me) {
      me.name = profile.name;
      me.clientId = profile.clientId;
      me.avatar = profile.avatar;
      me.title = profile.title || me.title;
      me.online = true;
    }
  }

  function saveLobby() {
    window.BoardShared.saveLobby(lobby);
  }

  function renderHeader() {
    els.roomName.textContent = lobby.roomName;
    els.roomCode.textContent = lobby.roomCode;
    els.roomOwner.textContent = `${lobby.hostName} ・ ${lobby.status === "waiting" ? "等待中" : "準備出航"}`;
    els.playerCount.textContent = `${lobby.players.length}/${lobby.maxPlayers}`;
  }

  function renderPlayers() {
    els.playerGrid.innerHTML = "";
    for (let i = 0; i < lobby.maxPlayers; i += 1) {
      const player = lobby.players[i];
      const seat = document.createElement("article");
      seat.className = "board-seat-card" + (player ? "" : " empty");
      if (!player) {
        seat.innerHTML = `
          <div class="board-seat-empty">等待玩家加入</div>
          <div class="board-seat-slot">空位 ${i + 1}</div>
        `;
        els.playerGrid.appendChild(seat);
        continue;
      }
      const isMe = Number(player.userId) === Number(profile.userId);
      seat.innerHTML = `
        <div class="board-seat-top">
          <img class="board-seat-avatar" src="${window.BoardShared.avatarUrlById(player.avatar)}" alt="">
          <div class="board-seat-main">
            <div class="board-seat-name-row">
              <div class="board-seat-name">${player.name}</div>
              ${player.isHost ? '<span class="board-chip host">房主</span>' : '<span class="board-chip">船員</span>'}
              ${isMe ? '<span class="board-chip me">你</span>' : ""}
            </div>
            <div class="board-seat-title">${player.title || "未裝備稱號"}</div>
          </div>
        </div>
        <div class="board-seat-footer">
          <span class="board-state-pill ${player.ready ? "ready" : "wait"}">${player.ready ? "已準備" : "未準備"}</span>
          <span class="board-state-pill ${player.online ? "online" : "offline"}">${player.online ? "在線" : "離線"}</span>
        </div>
      `;
      els.playerGrid.appendChild(seat);
    }
  }

  function renderChat() {
    els.chatBox.innerHTML = "";
    (lobby.chat || []).forEach((message) => {
      const row = document.createElement("div");
      if (message.system) {
        row.className = "board-lobby-chat-system";
        row.textContent = message.text;
        els.chatBox.appendChild(row);
        return;
      }
      const isMe = message.name === profile.name;
      row.className = "board-lobby-chat-row" + (isMe ? " me" : "");
      row.innerHTML = `
        <div class="board-lobby-chat-avatar"><img src="${window.BoardShared.avatarUrlById(message.avatar)}" alt=""></div>
        <div class="board-lobby-chat-bubble">
          <div class="board-lobby-chat-meta">${message.name} ・ ${new Date(message.ts).toLocaleTimeString("zh-Hant", { hour: "2-digit", minute: "2-digit" })}</div>
          <div class="board-lobby-chat-text">${message.text}</div>
        </div>
      `;
      els.chatBox.appendChild(row);
    });
    els.chatBox.scrollTop = els.chatBox.scrollHeight + 999;
  }

  function renderTips() {
    const me = lobby.players.find((player) => Number(player.userId) === Number(profile.userId));
    const allReady = lobby.players.filter((player) => !player.isHost).every((player) => player.ready);
    els.readyBtn.textContent = me?.ready ? "取消準備" : "準備";
    els.startBtn.disabled = !(me?.isHost && lobby.players.length >= 2 && allReady);
    els.tips.textContent = me?.isHost
      ? "房主可在所有其他玩家準備後按下「開始遊戲」。"
      : "先讓等待室配置、好友邀請與聊天室風格定型，第二階段再接真流程。";
  }

  function renderAll() {
    renderHeader();
    renderPlayers();
    renderChat();
    renderTips();
    saveLobby();
  }

  function toggleReady() {
    const me = lobby.players.find((player) => Number(player.userId) === Number(profile.userId));
    if (!me) return;
    me.ready = !me.ready;
    lobby.chat.push({
      system: true,
      text: `${profile.name}${me.ready ? " 已準備完成" : " 取消了準備"}`,
      ts: Date.now(),
    });
    renderAll();
  }

  function sendChat() {
    const text = String(els.chatInput.value || "").trim();
    if (!text) return;
    els.chatInput.value = "";
    lobby.chat.push({
      name: profile.name,
      avatar: profile.avatar,
      text,
      ts: Date.now(),
    });
    renderChat();
    saveLobby();
  }

  function copyCode() {
    navigator.clipboard?.writeText(roomId);
    window.BoardShared.showToast(`已複製房號 ${roomId}`);
  }

  function startGame() {
    lobby.status = "starting";
    lobby.chat.push({
      system: true,
      text: "這裡先保留成等待室骨架提示；正式大富翁地圖與回合玩法將在第二階段接入。",
      ts: Date.now(),
    });
    renderAll();
    window.BoardShared.showToast("大富翁玩法尚未實作，這一版先看等待室配置。");
  }

  function leaveRoom() {
    location.href = "board_start.html";
  }

  ensureCurrentPlayer();
  renderAll();

  els.readyBtn.addEventListener("click", toggleReady);
  els.inviteBtn.addEventListener("click", () => window.BoardShared.openFriends());
  els.copyBtn.addEventListener("click", copyCode);
  els.startBtn.addEventListener("click", startGame);
  els.leaveBtn.addEventListener("click", leaveRoom);
  els.backBtn.addEventListener("click", leaveRoom);
  els.sendChatBtn.addEventListener("click", sendChat);
  els.chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChat();
  });
})();
