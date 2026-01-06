// public/i18n/zh-Hant.js
window.__I18N_DICTS = window.__I18N_DICTS || {};
window.__I18N_DICTS["zh-Hant"] = {
  meta: { label: "繁體中文" },

  ui: {
    lang: "語言",
    pressAnyKey: "按任意鍵開始",
    startGame: "開始遊戲",
    rules: "遊戲規則",
    close: "關閉",

    rotateTitle: "請將手機旋轉至橫向以獲得最佳體驗",
    rotateHint: "若仍無法旋轉，請解鎖畫面旋轉或從瀏覽器選單開啟「允許旋轉」。",

    connectingLobby: "正在連線等待室...",
    back: "返回",

    createCharacter: "創建角色",
    localSaved: "資料會暫存於本機（localStorage）",
    playerName: "玩家名稱",
    namePlaceholder: "輸入你的名字",
    nameHint: "* 名稱最多 16 字；可稍後在設定中修改。",
    chooseAvatar: "選擇頭像（30）",
    avatarPath: "路徑：images/avatars/1.webp ~ 30.webp",
    createRoom: "創建房間",
    joinRoom: "加入房間",

    roomMode: "房間模式",
    createOrJoin: "建立房間 / 加入房間",
    playerId: "玩家 ID：{id}",

    createRoomTitle: "建立房間",
    host: "房主",
    cpuCountLabel: "加入 CPU 人數",
    cpuCountHint: "之後會自動填進房間（暫定 0–3 人）",
    cpuCountFootnote: "* 目前先提供選項與記錄，之後會接上電腦玩家自動行動邏輯。",
        people: "{n} 人",
createNewRoom: "🏴‍☠️ 建立新房間",

    joinFriendRoom: "加入朋友的房間",
    enterRoomCode: "輸入房號",
    roomCodePlaceholder: "例如：AB2D9F",
    roomCodeHint: "* 房號由房主提供，大寫 / 小寫不影響。",
    joinRoomBtn: "🔑 加入房間",

    suggestion: "建議 2–4 名真人玩家一同遊玩，CPU 數量之後可搭配調整。",

    roomId: "房號",
    copyRoomId: "複製房號",
    leaveRoom: "離開房間",
    startGameBtn: "開始遊戲",
    startGameNeed: "至少 2 名真人且全部準備才可開始",

    cpuPlayers: "CPU 玩家：{n} 人",
    cpuWillJoin: "開始遊戲後會自動加入對局（在下方列表中會顯示）",

    humanPlayers: "真人玩家（{n}）",
    cpuPlayersList: "CPU 玩家（{n}）",
    player: "玩家",
    ready: "已準備",
    notReady: "未準備",
    meReady: "準備",
    meUnready: "取消準備",
    cpuTag: "電腦玩家",

    lobbyFootnote: "此等待室已綁定後端快照；準備/開局皆透過 Socket.IO。CPU 將在遊戲開始後自動加入。",

    preloadAll: "📦 一次下載全部資源（建議 Wi-Fi）",
    preloadStart: "開始下載（0 / {total}）...",
    preloading: "下載中... {done} / {total}（{pct}%）",
    preloadDone: "完成！成功 {ok} 項，失敗 {fail} 項。",

    alertNeedRoomId: "請輸入房號",
    alertCopiedRoomId: "已複製房號：{roomId}"
  },

  brand: {
    titleEn: "ONE PIECE",
    titleSub: "偉大航道爭霸戰",
    tagline: "ONE PIECE ｜ 卡牌對戰 ｜ PVP 多人遊戲"
  },

  cpu: {
    name1: "克洛克達爾",
    name2: "鷹眼密佛格",
    name3: "小丑巴其"
  },

  rules: {
    // 規則內容非常長：此版本先保留繁中，其他語言會 fallback 到這份
  }
};
