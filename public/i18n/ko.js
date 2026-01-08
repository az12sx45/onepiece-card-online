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

prev: "이전 페이지",
next: "다음 페이지",
tipPrefix: "팁:",
rulesHotkeys: "단축키: ← / → 페이지 이동, Esc 닫기",


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
  },

rules: {
  overview: {
    title: "전투 화면 개요",
    bullets: [
      "이 화면은 전체 게임의 메인 전투 화면입니다.",
      "당신의 턴이 되면 조작 가능한 영역이 강조 표시됩니다.",
      "처음에는 규칙을 외울 필요 없이 화면 안내만 따라 하면 됩니다."
    ],
    tip: "한 번 전체를 훑어보며 각 영역 위치를 익히세요."
  },

  header: {
    title: "상단 바: 보물 코인 & 카드 도감",
    bullets: [
      "‘보물 코인 잔여’는 이번 게임에서 아직 획득 가능한 보상입니다.",
      "목표는 다른 플레이어보다 더 많은 코인을 획득하는 것입니다.",
      "보물 코인이 모두 소진되면 가장 많이 가진 플레이어가 승리합니다.",
      "‘카드 도감’에서 모든 캐릭터와 스킬을 언제든 확인할 수 있습니다."
    ],
    tip: "스킬이 헷갈릴 때는 도감을 확인하세요."
  },

  gallery: {
    title: "카드 도감: 전체 캐릭터 목록",
    bullets: [
      "캐릭터(0~19)와 각 카드 수량이 표시됩니다.",
      "빨간 테두리는 이번 게임에서 장소 효과로 강화된 캐릭터입니다."
    ],
    tip: "스킬을 외울 필요는 없습니다."
  },

  cardDetail: {
    title: "카드 상세: 일반 / 강화",
    bullets: [
      "도감에서 캐릭터를 선택하면 일반과 강화 효과가 함께 표시됩니다.",
      "현재 장소에서 강화된 경우 강화 효과가 적용됩니다."
    ],
    tip: "차이는 화면에서 바로 확인할 수 있습니다."
  },

  venuePanel: {
    title: "장소 카드와 덱",
    bullets: [
      "각 게임마다 다른 장소 카드가 등장하여 특정 캐릭터를 강화합니다.",
      "장소 카드 수 = 플레이어 수 ÷ 2 입니다.",
      "장소 카드를 클릭하면 배경만 변경됩니다(연출용).",
      "덱: 자신의 턴에 클릭하여 카드 1장을 뽑습니다.",
      "덱이 0이 된 후 마지막으로 뽑은 플레이어의 턴 종료 시 승패가 결정됩니다."
    ],
    tip: "강화 표시가 보이면 장소 효과입니다."
  },

  venueBg: {
    title: "배경 연출",
    bullets: [
      "배경 전환은 분위기 연출용입니다.",
      "규칙이나 승패에는 영향을 주지 않습니다."
    ],
    tip: "자유롭게 사용하세요."
  },

  players: {
    title: "플레이어 정보 패널",
    bullets: [
      "오른쪽에 모든 플레이어의 정보가 표시됩니다.",
      "빛나는 테두리가 현재 턴 플레이어입니다.",
      "손패와 탈락, 특수 상태도 함께 표시됩니다."
    ],
    tip: "오른쪽 패널로 현재 상황을 확인하세요."
  },

  discard: {
    title: "버린 카드",
    bullets: [
      "사용된 카드와 탈락한 플레이어의 손패가 모입니다.",
      "숙련자는 이 정보를 활용해 추리를 합니다."
    ],
    tip: "초보자는 위치만 알면 충분합니다."
  },

  log: {
    title: "게임 로그",
    bullets: [
      "뽑기, 사용, 스킬, 탈락 기록이 남습니다.",
      "무슨 일이 있었는지 모를 때 확인하세요."
    ],
    tip: "가장 정확한 기록입니다."
  },

  drawOnly: {
    title: "카드 뽑기",
    bullets: [
      "자신의 턴이 되면 카드를 뽑으라는 안내가 표시됩니다.",
      "덱을 클릭해 1장을 뽑습니다."
    ],
    tip: "먼저 뽑는 것이 우선입니다."
  },

  afterDrawView: {
    title: "뽑은 후: 카드 선택",
    bullets: [
      "카드를 뽑으면 손패 2장이 표시됩니다.",
      "그중 1장을 선택해 사용합니다.",
      "클릭하면 효과가 해결됩니다."
    ],
    tip: "이제 판단할 차례입니다."
  },

  playCardCoreRule: {
    title: "카드 효과 처리 규칙",
    bullets: [
      "각 턴에는 카드 1장만 낼 수 있습니다.",
      "낸 카드는 효과를 선택하는 용도입니다.",
      "실제 비교·교환은 남은 카드로 처리됩니다.",
      "낸 카드는 비교나 교환에 사용되지 않습니다."
    ],
    tip: "낸 카드=효과 선택, 남은 카드=실행."
  },

  examplePlay6: {
    title: "예시: 카드 6 사용",
    bullets: [
      "손패가 6과 13입니다.",
      "6을 내면 로우의 ROOM 효과를 선택합니다.",
      "실제로 사용되는 카드는 13입니다.",
      "13으로 상대와 손패를 교환합니다."
    ],
    tip: "6은 선택, 13이 실행 카드입니다."
  },

  examplePlay13: {
    title: "예시: 카드 13 사용",
    bullets: [
      "손패가 6과 13입니다.",
      "13을 내면 결투(숫자 비교)를 진행합니다.",
      "남은 6으로 비교합니다."
    ],
    tip: "남은 카드가 결과를 결정합니다."
  },

  extraRules: {
    title: "추가 규칙 및 주의사항",
    bullets: [
      "1. 비교/추측 효과는 마지막 남은 카드를 기준으로 합니다.",
      "2. 일반 비교에서는 10 이상 카드의 끝자리만 사용합니다.",
      "3. 동점이면 탈락자는 없습니다.",
      "4. 비교 시 스킬과 장소 효과는 발동하지 않습니다.",
      "5. 대상이 없으면 효과는 무효지만 출카는 유효입니다.",
      "6. 보호 상태 플레이어는 선택 가능하지만 영향은 없습니다.",
      "7. 탈락 시 손패는 공개되어 버린 카드로 이동합니다.",
      "8. 화면 표시 결과가 최종 판정입니다."
    ],
    tip: "일반 비교는 끝자리, 최종 비교는 합계입니다."
  }
}

};
