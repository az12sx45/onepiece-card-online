// public/i18n/ko.js
window.__I18N_DICTS = window.__I18N_DICTS || {};
window.__I18N_DICTS["ko"] = {
  meta: { label: "한국어" },

  ui: {
    lang: "언어",
    pressAnyKey: "아무 키나 눌러 시작",
    startGame: "게임 시작",
    rules: "게임 규칙",
    close: "닫기",

    rotateTitle: "최적의 경험을 위해 화면을 가로로 돌려주세요",
    rotateHint: "회전이 안 되면 화면 회전 잠금을 해제하거나 브라우저 메뉴에서 회전을 허용해주세요.",

    connectingLobby: "대기실 연결 중...",
    back: "뒤로",

    createCharacter: "캐릭터 생성",
    localSaved: "데이터는 기기에 저장됩니다 (localStorage)",
    playerName: "플레이어 이름",
    namePlaceholder: "이름을 입력하세요",
    nameHint: "* 최대 16자. 나중에 변경할 수 있습니다.",
    chooseAvatar: "아바타 선택 (30)",
    avatarPath: "경로: images/avatars/1.webp ~ 30.webp",
    createRoom: "방 만들기",
    joinRoom: "방 참가",

    roomMode: "방 모드",
    createOrJoin: "방 만들기 / 참가",
    playerId: "플레이어 ID: {id}",

    createRoomTitle: "방 만들기",
    host: "방장",
    cpuCountLabel: "CPU 인원",
    cpuCountHint: "시작 시 자동으로 추가 (0–3)",
    cpuCountFootnote: "* 현재는 선택/저장만 제공. AI 행동 로직은 이후 연결됩니다.",
    createNewRoom: "🏴‍☠️ 새 방 만들기",

    joinFriendRoom: "친구 방 참가",
    enterRoomCode: "방 코드",
    roomCodePlaceholder: "예: AB2D9F",
    roomCodeHint: "* 대소문자 구분 없음.",
    joinRoomBtn: "🔑 참가",

    suggestion: "추천: 사람 2–4명. CPU 인원은 이후 조정 가능합니다.",

    roomId: "방 코드",
    copyRoomId: "복사",
    leaveRoom: "나가기",
    startGameBtn: "시작",
    startGameNeed: "최소 2명 + 모두 준비 완료 필요",

    cpuPlayers: "CPU 플레이어: {n}명",
    cpuWillJoin: "게임 시작 후 자동으로 참가합니다.",

    humanPlayers: "플레이어 ({n})",
    cpuPlayersList: "CPU ({n})",
    player: "플레이어",
    ready: "준비 완료",
    notReady: "미준비",
    meReady: "준비",
    meUnready: "준비 취소",
    cpuTag: "CPU",

    lobbyFootnote: "대기실은 서버 스냅샷과 Socket.IO로 동기화됩니다. CPU는 시작 후 자동 참가합니다.",

    preloadAll: "📦 전체 리소스 한 번에 다운로드 (Wi-Fi 권장)",
    preloadStart: "시작 (0 / {total})...",
    preloading: "다운로드 중... {done} / {total} ({pct}%)",
    preloadDone: "완료! 성공 {ok}, 실패 {fail}.",

    alertNeedRoomId: "방 코드를 입력하세요",
    alertCopiedRoomId: "복사됨: {roomId}"
  },

  brand: {
    titleEn: "ONE PIECE",
    titleSub: "위대한 항로 쟁패전",
    tagline: "ONE PIECE ｜ 카드 배틀 ｜ PVP 멀티플레이"
  },

  cpu: {
    name1: "크로커다일",
    name2: "미호크",
    name3: "버기"
  }
};
