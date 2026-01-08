// public/i18n/en.js
window.__I18N_DICTS = window.__I18N_DICTS || {};
window.__I18N_DICTS["en"] = {
  meta: { label: "English" },

  ui: {
    lang: "Language",
    pressAnyKey: "Press any key",
    startGame: "Start Game",
    rules: "Rules",
    close: "Close",

    rotateTitle: "Rotate your phone to landscape for the best experience",
    rotateHint: "If rotation doesn't work, unlock screen rotation or enable “Allow rotation” in your browser menu.",

    connectingLobby: "Connecting to lobby...",
    back: "Back",

    createCharacter: "Create Character",
    localSaved: "Saved locally (localStorage)",
    playerName: "Player Name",
    namePlaceholder: "Enter your name",
    nameHint: "* Up to 16 characters. You can change it later.",
    chooseAvatar: "Choose Avatar (30)",
    avatarPath: "Path: images/avatars/1.webp ~ 30.webp",
    createRoom: "Create Room",
    joinRoom: "Join Room",

    roomMode: "Room Mode",
    createOrJoin: "Create / Join Room",
    playerId: "Player ID: {id}",

    createRoomTitle: "Create Room",
    host: "Host",
    cpuCountLabel: "CPU players",
    cpuCountHint: "Will be added to the room automatically (0–3)",
    cpuCountFootnote: "* This is the selection + persistence step. AI actions will be connected later.",
    createNewRoom: "🏴‍☠️ Create New Room",

    joinFriendRoom: "Join a friend's room",
    enterRoomCode: "Room code",
    roomCodePlaceholder: "e.g. AB2D9F",
    roomCodeHint: "* Case-insensitive.",
    joinRoomBtn: "🔑 Join Room",

    suggestion: "Recommended: 2–4 human players. CPU count can be adjusted later.",

    roomId: "Room",
    copyRoomId: "Copy",
    leaveRoom: "Leave",
    startGameBtn: "Start",
    startGameNeed: "Need at least 2 players and everyone ready",

    cpuPlayers: "CPU Players: {n}",
    cpuWillJoin: "CPU will join automatically after the game starts.",

    humanPlayers: "Human Players ({n})",
    cpuPlayersList: "CPU Players ({n})",
    player: "Player",
    ready: "Ready",
    notReady: "Not ready",
    meReady: "Ready",
    meUnready: "Unready",
    cpuTag: "CPU",

    lobbyFootnote: "This lobby is synced with the server snapshot via Socket.IO. CPU will join after the game starts.",

    prev: "Previous",
    next: "Next",
    tipPrefix: "Tip:",
    rulesHotkeys: "Hotkeys: ← / → to flip pages, Esc to close",


    preloadAll: "📦 Download all assets (Wi-Fi recommended)",
    preloadStart: "Starting (0 / {total})...",
    preloading: "Downloading... {done} / {total} ({pct}%)",
    preloadDone: "Done! Success {ok}, Failed {fail}.",

    alertNeedRoomId: "Please enter a room code",
    alertCopiedRoomId: "Copied room code: {roomId}"
  },

  brand: {
    titleEn: "ONE PIECE",
    titleSub: "Grand Line Battle",
    tagline: "ONE PIECE ｜ Card Battle ｜ PVP Multiplayer"
  },

  cpu: {
    name1: "Crocodile",
    name2: "Mihawk",
    name3: "Buggy"
  }
};
