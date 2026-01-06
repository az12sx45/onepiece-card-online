// public/i18n/ja.js
window.__I18N_DICTS = window.__I18N_DICTS || {};
window.__I18N_DICTS["ja"] = {
  meta: { label: "日本語" },

  ui: {
    lang: "言語",
    pressAnyKey: "任意のキーで開始",
    startGame: "ゲーム開始",
    rules: "ルール",
    close: "閉じる",

    rotateTitle: "最高の体験のため、端末を横向きにしてください",
    rotateHint: "回転できない場合は、画面回転ロックを解除するか、ブラウザの設定で回転を許可してください。",

    connectingLobby: "ロビーに接続中…",
    back: "戻る",

    createCharacter: "キャラクター作成",
    localSaved: "データは端末に保存されます（localStorage）",
    playerName: "プレイヤー名",
    namePlaceholder: "名前を入力",
    nameHint: "※ 最大16文字。後で変更できます。",
    chooseAvatar: "アバター選択（30）",
    avatarPath: "パス：images/avatars/1.webp ~ 30.webp",
    createRoom: "部屋を作成",
    joinRoom: "部屋に参加",

    roomMode: "ルームモード",
    createOrJoin: "作成 / 参加",
    playerId: "プレイヤーID：{id}",

    createRoomTitle: "部屋を作成",
    host: "ホスト",
    cpuCountLabel: "CPU人数",
    cpuCountHint: "開始時に自動で追加（0～3）",
    cpuCountFootnote: "※ ここでは選択と保存のみ。AI行動は後で接続します。",
        people: "{n}人",
createNewRoom: "🏴‍☠️ 新しい部屋を作成",

    joinFriendRoom: "友達の部屋に参加",
    enterRoomCode: "ルームID",
    roomCodePlaceholder: "例：AB2D9F",
    roomCodeHint: "※ 大文字/小文字は区別しません。",
    joinRoomBtn: "🔑 参加",

    suggestion: "推奨：人間2～4人。CPU人数は後で調整可能。",

    roomId: "ルームID",
    copyRoomId: "コピー",
    leaveRoom: "退出",
    startGameBtn: "開始",
    startGameNeed: "最低2人、全員準備完了が必要です",

    cpuPlayers: "CPU：{n}人",
    cpuWillJoin: "開始後、自動で対局に参加します。",

    humanPlayers: "プレイヤー（{n}）",
    cpuPlayersList: "CPU（{n}）",
    player: "プレイヤー",
    ready: "準備OK",
    notReady: "未準備",
    meReady: "準備",
    meUnready: "解除",
    cpuTag: "CPU",

    lobbyFootnote: "ロビーはサーバースナップショットと同期（Socket.IO）。CPUは開始後に自動参加します。",

    preloadAll: "📦 すべての素材を一括ダウンロード（Wi-Fi推奨）",
    preloadStart: "開始（0 / {total}）…",
    preloading: "ダウンロード中… {done} / {total}（{pct}%）",
    preloadDone: "完了！成功 {ok}、失敗 {fail}。",

    alertNeedRoomId: "ルームIDを入力してください",
    alertCopiedRoomId: "コピーしました：{roomId}"
  },

  brand: {
    titleEn: "ONE PIECE",
    titleSub: "偉大航道 争覇戦",
    tagline: "ONE PIECE ｜ カード対戦 ｜ PVP マルチプレイ"
  },

  cpu: {
    name1: "クロコダイル",
    name2: "ミホーク",
    name3: "バギー"
  }
};
