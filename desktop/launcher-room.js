(() => {
  'use strict';
  const api = window.onePieceDesktop;
  const $ = id => document.getElementById(id);
  const WIDTH = 960;
  const HEIGHT = 540;
  const ROOM_MAX_CHARACTERS = 8;
  const DEFAULT_SCENE = 'room-scene-default';
  const SCENE_FALLBACK = 'opui://launcher/images/desktop_launcher/desktop_launcher_cabin_bg_v1.png';
  const TYPES = {
    scene: { type: 'room_scene', owned: 'roomScenes', label: '場景' },
    furniture: { type: 'room_furniture', owned: 'roomFurniture', label: '家具' },
    character: { type: 'room_character', owned: 'roomCharacters', label: '夥伴' }
  };
  const ASSET = /^opui:\/\/launcher\/images\/launcher_room\/(scenes|furniture|chibi)\/[a-z0-9-]+\.webp$/i;
  const CHARACTER_KEYS = new Set(['luffy', 'zoro', 'nami', 'chopper', 'sanji', 'robin', 'usopp', 'franky', 'brook', 'jinbe']);
  const MOODS = new Set(['happy', 'surprised', 'focused', 'annoyed']);
  const POSES = new Set(['idle', 'walk1', 'walk2', 'talk_happy', 'talk_annoyed', 'surprised', 'focused_use', 'sit', 'wave']);
  const CARDINAL = ['正向', '右轉', '背向', '左轉'];
  const FLOOR = Object.freeze({ columns: 16, rows: 8, top: 267, bottom: 515, backLeft: 164, backRight: 796, frontLeft: 28, frontRight: 932 });
  const FURNITURE_FOOTPRINTS = {
    helm: [2, 2], 'map-table': [3, 2], 'treasure-chest': [2, 1], 'tangerine-tree': [2, 2],
    'swords-rack': [2, 1], 'kitchen-table': [3, 2], bookshelf: [2, 1],
    'medicine-cabinet': [2, 1], piano: [3, 2], 'tool-bench': [2, 2]
  };
  // Stage pixels at the front row. Perspective changes all furniture and characters together;
  // older saved scale values remain readable but cannot stretch one prop out of proportion.
  const FURNITURE_VISUALS = Object.freeze({
    helm: [140, 148], 'map-table': [188, 116], 'treasure-chest': [126, 100],
    'tangerine-tree': [143, 161], 'swords-rack': [119, 126],
    'kitchen-table': [188, 113], bookshelf: [115, 151],
    'medicine-cabinet': [111, 139], piano: [184, 131], 'tool-bench': [155, 116]
  });
  const FURNITURE_ACTIONS = {
    'helm': { verb: '掌舵', mood: 'focused', line: '這個方向的風正好，航線交給我吧。' },
    'map-table': { verb: '看海圖', mood: 'focused', line: '把航線標清楚，下一站就不會走錯。' },
    'treasure-chest': { verb: '查看寶箱', mood: 'surprised', line: '裡頭究竟放了什麼？得仔細看看。' },
    'tangerine-tree': { verb: '照顧橘子樹', mood: 'happy', line: '葉子長得真好，今天也要好好照顧。' },
    'swords-rack': { verb: '整理刀具', mood: 'focused', line: '先把刀收好，出發時才不會慌。' },
    'kitchen-table': { verb: '準備餐點', mood: 'happy', line: '餐桌準備好了，大家都來吃吧！' },
    'bookshelf': { verb: '閱讀', mood: 'focused', line: '這一頁似乎藏著有趣的線索。' },
    'medicine-cabinet': { verb: '整理藥箱', mood: 'focused', line: '藥品分類完成，受傷時就能馬上找到。' },
    'piano': { verb: '彈琴', mood: 'happy', line: '這首曲子，讓旅程輕快一些吧。' },
    'tool-bench': { verb: '修理裝備', mood: 'focused', line: '螺絲鎖緊了，航行時就更安心。' }
  };
  const dialogue = window.OnePieceRoomDialogue || null;
  // Original, short dialogue in each character's established manner; no source dialogue is reproduced.
  const CHARACTER_LINES = dialogue?.CHARACTER_LINES || {
    luffy: { chat: ['先去看看那邊吧！說不定有好玩的事！', '大家都在就好，接下來去哪裡？'], reply: ['好啊！出發之前先吃點東西！', '聽起來很有趣，我也要去！'], furniture: { 'kitchen-table': ['好香！我可以先開動了嗎？', 'happy'], helm: ['前面有什麼？我想快點看看！', 'surprised'] } },
    zoro: { chat: ['訓練不能停。你有看到我的刀嗎？', '我記得路……應該是往那邊。'], reply: ['嗯，等我練完這一輪。', '別擔心，遇到麻煩我會處理。'], furniture: { 'swords-rack': ['刀都在這裡。再練一輪吧。', 'focused'], 'map-table': ['這條線怎麼又繞回來了？', 'annoyed'] } },
    nami: { chat: ['風向變了，先看看海圖。', '這趟航程的補給可不能亂花。'], reply: ['可以，但先照我畫的航線走。', '把帳記清楚，才不會吃虧。'], furniture: { 'map-table': ['這段海流不對，得把航線改一下。', 'focused'], 'tangerine-tree': ['橘子長得真好，別隨便碰喔。', 'happy'] } },
    usopp: { chat: ['我有個超厲害的點子！先聽我說完！', '這件事交給勇敢的海上戰士吧！'], reply: ['當、當然沒問題！我早有準備。', '嘿嘿，這次一定能派上用場！'], furniture: { 'tool-bench': ['加上這個機關，肯定會嚇大家一跳！', 'happy'], 'treasure-chest': ['這箱子不會突然彈開吧？', 'surprised'] } },
    sanji: { chat: ['大家想吃什麼？我去準備。', '美味的晚餐值得等一會兒。'], reply: ['交給我，馬上就做好。', '好，先讓大家吃飽再說。'], furniture: { 'kitchen-table': ['火候剛剛好。各位，開飯了！', 'happy'], 'tangerine-tree': ['橘子的香氣很適合今天的甜點。', 'focused'] } },
    chopper: { chat: ['今天有哪裡不舒服嗎？我來看看！', '我找到一本很有用的醫書！'], reply: ['真的嗎？我、我才沒有高興呢！', '放心，我會好好照顧大家。'], furniture: { 'medicine-cabinet': ['繃帶和藥水都補齊了！', 'happy'], bookshelf: ['這個配方……我要記下來！', 'focused'] } },
    robin: { chat: ['這艘船每天都有新故事。', '這本書的線索很有意思。'], reply: ['呵呵，我也正想知道後續。', '一起看看，也許能找到答案。'], furniture: { bookshelf: ['這段記載，和我們見過的遺跡很像。', 'focused'], 'map-table': ['這座島的形狀，值得再查一查。', 'focused'] } },
    franky: { chat: ['這個設計真是太棒了！', '船上哪裡需要加強？讓我看看！'], reply: ['包在我身上，馬上搞定！', '這主意夠酷，我喜歡！'], furniture: { 'tool-bench': ['加固完成！這下肯定穩得很！', 'happy'], helm: ['掌舵台狀態很好，放心開吧！', 'focused'] } },
    brook: { chat: ['今天要來一段輕快的曲子嗎？', '旅途有音樂相伴，真是愉快。'], reply: ['當然，請聽我彈一段。', '哎呀，這個節奏真讓人開心。'], furniture: { piano: ['下一首送給大家，請聽！', 'happy'], bookshelf: ['這本譜子讓我想起一段旋律。', 'focused'] } },
    jinbe: { chat: ['海流正在改變，行船要穩。', '大家齊心，這段航路就能走得踏實。'], reply: ['嗯，先觀察風浪再行動。', '很好，按這個步調繼續。'], furniture: { helm: ['舵感很穩，現在可以順流而行。', 'focused'], 'map-table': ['這條航道平穩，可以從這裡走。', 'focused'] } }
  };
  const CHAT_MOODS = dialogue?.CHAT_MOODS || {
    luffy: ['happy', 'surprised'], zoro: ['focused', 'annoyed'], nami: ['focused', 'annoyed'],
    usopp: ['surprised', 'happy'], sanji: ['happy', 'focused'], chopper: ['surprised', 'happy'],
    robin: ['focused', 'happy'], franky: ['happy', 'focused'], brook: ['happy', 'happy'], jinbe: ['focused', 'happy']
  };
  const PAIR_LINES = dialogue?.PAIR_LINES || {
    'luffy:sanji': [
      [['香吉士，晚餐好了嗎？', 'happy'], ['再等一下，熱騰騰的馬上來。', 'happy']],
      [['有肉的味道！還要等多久？', 'surprised'], ['先洗手，這道菜馬上完成。', 'focused']]
    ],
    'nami:zoro': [
      [['你又走反方向了，這邊！', 'annoyed'], ['我只是繞一下路。', 'annoyed']],
      [['船頭在那邊，你到底去哪裡？', 'annoyed'], ['找個安靜地方練刀而已。', 'focused']]
    ],
    'chopper:robin': [
      [['羅賓，這本醫書可以借我嗎？', 'focused'], ['當然，裡面還有很多有趣的筆記。', 'happy']],
      [['這段藥草資料好難懂……', 'surprised'], ['我來陪你慢慢讀。', 'happy']]
    ],
    'franky:usopp': [
      [['這個裝置再加個零件如何？', 'happy'], ['太好了！我們一起試試！', 'happy']],
      [['新零件裝好了，要不要試？', 'happy'], ['嘿嘿，我來按開關！', 'surprised']]
    ],
    'brook:jinbe': [
      [['甚平，來聽我新練的曲子吧。', 'happy'], ['好啊，讓我也跟著打拍子。', 'happy']],
      [['這段旋律和海浪很合拍。', 'focused'], ['節奏像潮汐一樣平穩。', 'focused']]
    ]
  };
  const el = (tag, className = '', content) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = String(content);
    return node;
  };
  const clamp = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
  const assetFor = item => typeof item?.asset === 'string' && ASSET.test(item.asset) ? item.asset : '';
  const isValidProduct = (item, type) => item?.type === type && typeof item.id === 'string' && /^[a-z0-9-]{3,64}$/.test(item.id) && !!assetFor(item);
  const round = value => Math.round(value * 100) / 100;
  const rotationFor = item => Number.isInteger(item?.rotation) && item.rotation >= 0 && item.rotation <= 3
    ? item.rotation : item?.flip === true ? 2 : 0;
  const keyForCharacter = item => CHARACTER_KEYS.has(item?.key) ? item.key : CHARACTER_KEYS.has(String(item?.id || '').replace(/^room-character-/, '')) ? String(item.id).replace(/^room-character-/, '') : '';
  const keyForFurniture = item => String(item?.key || item?.id || '').replace(/^room-furniture-/, '');
  const cellId = (col, row) => `${col}:${row}`;
  function gridPoint(col, row) {
    const depth = row / FLOOR.rows;
    const left = FLOOR.backLeft + (FLOOR.frontLeft - FLOOR.backLeft) * depth;
    const right = FLOOR.backRight + (FLOOR.frontRight - FLOOR.backRight) * depth;
    return { x: left + (right - left) * col / FLOOR.columns, y: FLOOR.top + (FLOOR.bottom - FLOOR.top) * depth };
  }
  function footprint(entry, item, kind) {
    if (kind === 'character') return { width: 1, height: 1 };
    const base = FURNITURE_FOOTPRINTS[keyForFurniture(item)] || [2, 2];
    const rotated = rotationFor(entry) % 2 === 1;
    return { width: rotated ? base[1] : base[0], height: rotated ? base[0] : base[1] };
  }
  function cellForPosition(entry, span) {
    const depth = clamp((entry.y - FLOOR.top) / (FLOOR.bottom - FLOOR.top), 0, 1, .5);
    const left = FLOOR.backLeft + (FLOOR.frontLeft - FLOOR.backLeft) * depth;
    const right = FLOOR.backRight + (FLOOR.frontRight - FLOOR.backRight) * depth;
    return { col: Math.round(clamp((entry.x - left) / (right - left) * FLOOR.columns - span.width / 2, 0, FLOOR.columns - span.width, 0)),
      row: Math.round(clamp(depth * FLOOR.rows - span.height, 0, FLOOR.rows - span.height, 0)) };
  }
  function anchorForCell(cell, span) { return gridPoint(cell.col + span.width / 2, cell.row + span.height); }
  function cellsInFootprint(cell, span) {
    const result = [];
    for (let row = cell.row; row < cell.row + span.height; row++)
      for (let col = cell.col; col < cell.col + span.width; col++) result.push(cellId(col, row));
    return result;
  }
  function nearestVacant(requested, span, occupied) {
    let best = null; let score = Infinity;
    for (let row = 0; row <= FLOOR.rows - span.height; row++) for (let col = 0; col <= FLOOR.columns - span.width; col++) {
      const cell = { col, row };
      if (cellsInFootprint(cell, span).some(key => occupied.has(key))) continue;
      const distance = Math.abs(col - requested.col) + Math.abs(row - requested.row) * 1.25;
      if (distance < score) { best = cell; score = distance; }
    }
    return best;
  }
  function layoutRoom(room, omitKey = '') {
    const occupied = new Set(); const placements = new Map();
    for (const [kind, list] of [['furniture', room.placements], ['character', room.characters]]) for (const entry of list) {
      const key = `${kind === 'furniture' ? 'f' : 'c'}:${entry.itemId}`;
      if (key === omitKey) continue;
      const item = resolvedItem(entry.itemId, kind);
      if (!item) continue;
      const span = footprint(entry, item, kind);
      const requested = cellForPosition(entry, span);
      const cell = nearestVacant(requested, span, occupied);
      if (!cell) continue;
      const layout = { key, entry, item, kind, cell, span, anchor: anchorForCell(cell, span) };
      placements.set(key, layout);
      for (const id of cellsInFootprint(cell, span)) occupied.add(id);
    }
    return { occupied, placements };
  }
  function positionInCell(entry, cell, span) {
    const anchor = anchorForCell(cell, span);
    entry.x = round(anchor.x); entry.y = round(anchor.y);
  }
  const blankRoom = () => ({ revision: 0, sceneId: DEFAULT_SCENE, placements: [], characters: [] });
  function copyRoom(source) {
    const room = source && typeof source === 'object' ? source : {};
    return {
      revision: Math.max(0, Math.trunc(clamp(room.revision, 0, Number.MAX_SAFE_INTEGER, 0))),
      sceneId: typeof room.sceneId === 'string' ? room.sceneId : DEFAULT_SCENE,
      placements: (Array.isArray(room.placements) ? room.placements : []).slice(0, 24).map(item => ({
        itemId: String(item?.itemId || ''), x: clamp(item?.x, 0, WIDTH, 480), y: clamp(item?.y, 0, HEIGHT, 410),
        scale: 1, rotation: rotationFor(item), flip: rotationFor(item) === 2
      })),
      characters: (Array.isArray(room.characters) ? room.characters : []).slice(0, ROOM_MAX_CHARACTERS).map(item => ({
        itemId: String(item?.itemId || ''), x: clamp(item?.x, 0, WIDTH, 480), y: clamp(item?.y, 0, HEIGHT, 430)
      }))
    };
  }

  let profile = null;
  let shop = null;
  let accountId = 0;
  let preview = false;
  let visible = false;
  let editing = false;
  let loading = false;
  let saving = false;
  let dirty = false;
  let draft = blankRoom();
  let tab = 'scene';
  let selected = null;
  let drag = null;
  let walkers = [];
  let animationId = 0;
  let lastFrame = 0;
  let interaction = null;
  let nextInteractionAt = 0;
  let nextJobBadgeAt = 0;
  let interactionIndex = 0;
  let dialogueIndex = 0;
  let viewEpoch = 0;
  let walkBlocked = new Set();
  let companionId = '';
  let companionBusy = false;
  let companionTick = 0;
  let companionLineIndex = 0;
  let companionRequest = 0;
  const companionStats = new Map();
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function status(message = '', error = false) {
    const target = $('roomStatus');
    target.textContent = message;
    target.classList.toggle('is-error', error);
  }
  function isOwner() { return !!profile?.isSelf && accountId > 0 && !preview; }
  function activeRoom() { return editing ? draft : copyRoom(profile?.room); }
  function catalog() { return Array.isArray(shop?.catalog) ? shop.catalog : []; }
  function fromShop(itemId) { return catalog().find(item => item.id === itemId) || null; }
  function resolvedItem(itemId, kind) {
    const type = TYPES[kind].type;
    const bought = fromShop(itemId);
    if (isValidProduct(bought, type)) return bought;
    const resolved = profile?.roomItems || {};
    const list = kind === 'scene' ? [resolved.scene] : kind === 'furniture' ? resolved.placements : resolved.characters;
    const entry = (Array.isArray(list) ? list : []).find(value => (value?.itemId || value?.id) === itemId);
    const item = kind === 'scene' ? entry : entry?.item;
    return isValidProduct(item, type) && item.id === itemId ? item : null;
  }
  function ownedIds(kind) {
    const values = shop?.owned?.[TYPES[kind].owned];
    return new Set(Array.isArray(values) ? values.filter(value => typeof value === 'string') : []);
  }
  function roomItems(kind) {
    const owned = ownedIds(kind);
    return catalog().filter(item => isValidProduct(item, TYPES[kind].type) && owned.has(item.id));
  }
  function companionRecord(itemId) {
    return companionStats.get(itemId) || (Array.isArray(profile?.companions)
      ? profile.companions.find(entry => entry?.itemId === itemId) : null) || null;
  }
  function companionStatus(message = '', error = false) {
    const node = $('roomCompanionStatus');
    node.textContent = message; node.classList.toggle('is-error', error);
  }
  function remainingTime(iso) {
    const millis = Math.max(0, Date.parse(iso || '') - Date.now());
    if (!Number.isFinite(millis) || millis <= 0) return '00:00';
    const seconds = Math.ceil(millis / 1000);
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  function renderCompanionPanel() {
    const panel = $('roomCompanionPanel');
    const item = companionId && !editing && activeRoom().characters.some(entry => entry.itemId === companionId)
      ? resolvedItem(companionId, 'character') : null;
    panel.hidden = !item;
    if (!item) return;
    const key = keyForCharacter(item);
    const details = dialogue?.profile?.(key) || {};
    const record = companionRecord(companionId);
    const work = record?.work || {};
    const affinity = Math.max(0, Math.min(100, Number(record?.affinity) || 0));
    const canAct = isOwner() && !!record && !companionBusy;
    const ready = work.state === 'ready' || (work.state === 'working' && Number.isFinite(Date.parse(work.readyAt)) && Date.parse(work.readyAt) <= Date.now());
    $('roomCompanionPortrait').src = key ? `opui://launcher/images/launcher_room/action_frames/${key}/idle.webp` : assetFor(item);
    $('roomCompanionPortrait').alt = item.name || details.name || '航海夥伴';
    $('roomCompanionName').textContent = item.name || details.name || '航海夥伴';
    $('roomCompanionRole').textContent = record?.role || details.role || '草帽一行人';
    $('roomCompanionDetail').textContent = record?.description || details.detail || '點擊夥伴可以查看相處進度。';
    $('roomCompanionAffinity').textContent = `${affinity} / 100`;
    $('roomCompanionProgress').value = affinity;
    if (ready) $('roomCompanionWork').textContent = `工作完成，可領取 ${Number(work.reward) || 10} 展示室金幣。`;
    else if (work.state === 'working') $('roomCompanionWork').textContent = `正在工作 · 剩餘 ${remainingTime(work.readyAt)}；完成後可領取 ${Number(work.reward) || 10} 展示室金幣。`;
    else $('roomCompanionWork').textContent = record
      ? `安排約五分鐘的工作，完成後可領取 10 展示室金幣。今日尚可安排 ${Number(work.remainingStartsToday) || 0} 次。`
      : '正在讀取夥伴的工作與親密度…';
    $('roomCompanionActions').hidden = !isOwner();
    $('roomCompanionTalk').disabled = !canAct || (record && (Number(record.talksRemainingToday) <= 0 || Date.parse(record.nextTalkAt) > Date.now()));
    $('roomCompanionTalk').title = record && Date.parse(record.nextTalkAt) > Date.now() ? `下次可聊天：${remainingTime(record.nextTalkAt)}` : '';
    $('roomCompanionWorkStart').hidden = !!work.state && work.state !== 'idle';
    $('roomCompanionWorkStart').disabled = !canAct || Number(work.remainingStartsToday) <= 0 || Number(work.characterStartsRemainingToday) <= 0;
    $('roomCompanionWorkClaim').hidden = !ready;
    $('roomCompanionWorkClaim').disabled = !canAct;
  }
  function closeCompanion() {
    if (companionTick) clearInterval(companionTick);
    companionTick = 0;
    const previous = companionId;
    companionId = '';
    companionRequest++;
    companionBusy = false;
    companionStatus('');
    $('roomCompanionPanel').hidden = true;
    for (const walker of walkers) {
      walker.node.classList.remove('is-companion-selected');
      if (walker.item?.id === previous && walker.mode === 'focused') {
        hideSpeech(walker); walker.manualUntil = 0; setPose(walker, 'idle'); chooseDestination(walker);
      }
    }
  }
  async function openCompanion(itemId) {
    if (editing || !activeRoom().characters.some(entry => entry.itemId === itemId)) return;
    if (companionId === itemId && companionBusy) { renderCompanionPanel(); return; }
    if (companionId !== itemId) closeCompanion();
    else if (companionTick) clearInterval(companionTick);
    companionId = itemId;
    const walker = walkers.find(entry => entry.item?.id === itemId);
    if (walker) walker.node.classList.add('is-companion-selected');
    if (walker && !['job', 'job-approach'].includes(walker.mode)) {
      if (interaction?.actors.includes(walker)) finishInteraction(performance.now());
      walker.route = []; walker.mode = 'focused'; walker.pause = 0;
      walker.node.classList.remove('is-walking'); walker.node.classList.add('is-companion-selected');
      setPose(walker, 'wave'); walker.manualUntil = performance.now() + 1250;
    }
    renderCompanionPanel();
    $('roomCompanionPanel').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    companionTick = setInterval(() => { renderCompanionPanel(); refreshJobBadges(); }, 1000);
    if (!isOwner() || typeof api.getLauncherCharacter !== 'function') return;
    const epoch = viewEpoch; const ownerId = accountId; const request = ++companionRequest;
    try {
      const result = await api.getLauncherCharacter(itemId);
      if (epoch !== viewEpoch || ownerId !== accountId || companionId !== itemId || request !== companionRequest || !isOwner()) return;
      if (result?.ok && result.character) { companionStats.set(itemId, result.character); syncCompanionWalker(itemId); renderCompanionPanel(); }
      else companionStatus('目前無法更新夥伴資料，請稍後再試。', true);
    } catch { if (epoch === viewEpoch && companionId === itemId) companionStatus('目前無法連線，請稍後再試。', true); }
  }
  const COMPANION_ERRORS = {
    talk_cooldown: '這位夥伴剛聊過天，稍後再來。', talk_daily_limit: '今天的聊天次數已用完。',
    work_active: '這位夥伴還有尚未領取的工作。', work_daily_limit: '今天的工作次數已用完。',
    work_not_ready: '工作還在進行，完成後再領取。', wallet_full: '展示室金幣已達上限，先到商店選購商品。',
    not_placed: '這位夥伴已離開房間，請重新整理。', not_owned: '這位夥伴尚未收藏。'
  };
  async function performCompanionAction(action) {
    if (!isOwner() || !companionId || companionBusy || !companionRecord(companionId)) return;
    const itemId = companionId;
    const epoch = viewEpoch;
    const request = companionRequest;
    const method = action === 'talk' ? () => api.interactLauncherCharacter(itemId, 'talk')
      : action === 'start' ? () => api.startLauncherCharacterWork(itemId)
        : () => api.claimLauncherCharacterWork(itemId);
    companionBusy = true;
    companionStatus(action === 'claim' ? '正在領取展示室金幣…' : '正在與夥伴互動…');
    renderCompanionPanel();
    try {
      const result = await method();
      if (epoch !== viewEpoch || request !== companionRequest || itemId !== companionId) return;
      if (result?.character) companionStats.set(itemId, result.character);
      if (!result?.ok) {
        companionStatus(COMPANION_ERRORS[result?.error] || '互動未完成，請稍後再試。', true);
        renderCompanionPanel(); return;
      }
      if (result.wallet) window.LauncherProfileShop?.onCompanionWalletChanged?.(result.wallet);
      syncCompanionWalker(itemId);
      const walker = walkers.find(entry => entry.item?.id === itemId);
      const key = walker?.key || keyForCharacter(resolvedItem(itemId, 'character'));
      const lines = dialogue?.interaction?.(key, action === 'talk' ? 'bond' : 'work', companionLineIndex++) ||
        [action === 'talk' ? '下次再來聊天吧！' : '我去把這件事做好。', 'happy'];
      if (action === 'talk') {
        if (walker && walker.mode === 'focused') {
          showSpeech(walker, lines[0], lines[1], '親密度 +2');
          walker.manualUntil = performance.now() + 3500;
        }
        companionStatus('聊天完成，親密度增加 2。');
      } else if (action === 'start') {
        if (walker) {
          walker.jobIntro = lines;
          if (walker.mode === 'job') {
            showSpeech(walker, lines[0], lines[1], '開始工作', true, walker.jobFurnitureKey);
            walker.jobSpeechUntil = performance.now() + 3000;
            walker.jobIntro = null;
          }
        }
        companionStatus('已安排工作；完成後回來領取展示室金幣。');
      } else {
        if (walker) showSpeech(walker, lines[0], lines[1], '工作完成');
        companionStatus(result.claimed ? '已領取 10 展示室金幣，親密度增加 1。' : '這份工作已領取。');
        if (walker) walker.manualUntil = performance.now() + 3500;
      }
      refreshJobBadges();
      renderCompanionPanel();
    } catch {
      if (epoch === viewEpoch && request === companionRequest && itemId === companionId)
        companionStatus('目前無法連線，互動未完成。', true);
    } finally {
      if (epoch === viewEpoch && request === companionRequest && itemId === companionId) {
        companionBusy = false; renderCompanionPanel();
      }
    }
  }
  function point(event) {
    const rect = $('roomStage').getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * WIDTH, y: (event.clientY - rect.top) / rect.height * HEIGHT };
  }
  function itemBySelection() {
    if (!selected) return null;
    const list = selected.kind === 'furniture' ? draft.placements : draft.characters;
    return list.find(item => item.itemId === selected.itemId) || null;
  }
  function stopAnimation() {
    if (animationId) cancelAnimationFrame(animationId);
    animationId = 0;
    lastFrame = 0;
    for (const walker of walkers) {
      walker.node.classList.remove('is-walking', 'is-interacting', 'is-conversing', 'is-using-furniture');
      const speech = walker.node.querySelector('.room-speech');
      if (speech) speech.hidden = true;
      setPose(walker, 'idle');
    }
    walkers = [];
    interaction = null;
    nextInteractionAt = 0;
  }
  function canAnimate() { return visible && !editing && !!profile && !document.hidden && !motion.matches; }
  function setPose(walker, pose) {
    const next = POSES.has(pose) ? pose : 'idle';
    if (walker.pose === next) return;
    walker.pose = next; walker.node.dataset.pose = next;
    const sprite = walker.node.querySelector('.room-chibi');
    if (!sprite) return;
    const fallback = assetFor(walker.item);
    sprite.onerror = () => { sprite.onerror = null; sprite.src = fallback; sprite.dataset.artFallback = 'true'; };
    sprite.dataset.artFallback = 'false';
    sprite.src = walker.key ? `opui://launcher/images/launcher_room/action_frames/${walker.key}/${next}.webp` : fallback;
  }
  function cellBlocked(cell, blocked) {
    return cell.col < 0 || cell.row < 0 || cell.col >= FLOOR.columns || cell.row >= FLOOR.rows || blocked.has(cellId(cell.col, cell.row));
  }
  function blockedFor(walker, exempt = []) {
    const blocked = new Set(walkBlocked);
    for (const other of walkers) {
      if (other === walker || exempt.includes(other)) continue;
      blocked.add(cellId(other.cell.col, other.cell.row));
      if (other.route?.length) {
        const reserved = other.route[other.route.length - 1];
        blocked.add(cellId(reserved.col, reserved.row));
      }
    }
    return blocked;
  }
  function routeBetween(start, goal, blocked) {
    if (cellBlocked(goal, blocked)) return null;
    const startKey = cellId(start.col, start.row); const goalKey = cellId(goal.col, goal.row);
    if (startKey === goalKey) return [];
    const pending = [start]; const seen = new Set([startKey]); const previous = new Map();
    for (let head = 0; head < pending.length; head++) {
      const cell = pending[head];
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = { col: cell.col + dc, row: cell.row + dr };
        const key = cellId(next.col, next.row);
        if (seen.has(key) || cellBlocked(next, blocked)) continue;
        seen.add(key); previous.set(key, cell); pending.push(next);
        if (key === goalKey) {
          const route = [next]; let current = cell;
          while (cellId(current.col, current.row) !== startKey) {
            route.unshift(current); current = previous.get(cellId(current.col, current.row));
          }
          return route;
        }
      }
    }
    return null;
  }
  function routeTo(walker, goal, exempt = []) {
    const route = routeBetween(walker.cell, goal, blockedFor(walker, exempt));
    if (!route) return false;
    walker.route = route; walker.targetCell = goal;
    walker.stepDistance = 0;
    return true;
  }
  function chooseDestination(walker) {
    walker.mode = 'wander'; walker.route = []; walker.targetCell = null;
    walker.stepDistance = 0;
    const options = [];
    for (let row = Math.max(0, walker.cell.row - 2); row <= Math.min(FLOOR.rows - 1, walker.cell.row + 2); row++)
      for (let col = Math.max(0, walker.cell.col - 3); col <= Math.min(FLOOR.columns - 1, walker.cell.col + 3); col++) {
        const distance = Math.abs(col - walker.cell.col) + Math.abs(row - walker.cell.row);
        if (distance >= 1 && distance <= 4) options.push({ col, row });
      }
    options.sort(() => Math.random() - .5);
    for (const candidate of options) if (routeTo(walker, candidate)) break;
    walker.pause = 350 + Math.random() * 650;
    if (!walker.route.length) setPose(walker, 'idle');
  }
  function keepSpeechInsideStage(walker) {
    walker.node.classList.toggle('is-near-left', walker.x < 165);
    walker.node.classList.toggle('is-near-right', walker.x > 795);
  }
  function hideSpeech(walker) {
    const speech = walker.node.querySelector('.room-speech');
    if (speech) speech.hidden = true;
    walker.node.classList.remove('is-interacting', 'is-conversing', 'is-using-furniture');
  }
  function showSpeech(walker, message, mood, action = '', usingFurniture = false, furnitureKey = '') {
    for (const other of walkers) hideSpeech(other);
    const speech = walker.node.querySelector('.room-speech');
    if (!speech) return;
    speech.querySelector('.room-speech-text').textContent = message;
    const actionNode = speech.querySelector('.room-speech-action');
    actionNode.textContent = action;
    actionNode.hidden = !action;
    speech.dataset.mood = MOODS.has(mood) ? mood : 'happy';
    speech.hidden = false;
    walker.node.classList.add('is-interacting', usingFurniture ? 'is-using-furniture' : 'is-conversing');
    const pose = usingFurniture ? (['kitchen-table', 'piano'].includes(furnitureKey) ? 'sit' : 'focused_use')
      : mood === 'annoyed' ? 'talk_annoyed' : mood === 'surprised' ? 'surprised' : mood === 'focused' ? 'focused_use' : 'talk_happy';
    setPose(walker, pose);
  }
  function pairDialogue(first, second) {
    const originalPair = dialogue?.pair?.(first.key, second.key, dialogueIndex);
    if (originalPair) return originalPair;
    const direct = PAIR_LINES[`${first.key}:${second.key}`];
    if (direct) return direct[dialogueIndex % direct.length];
    const reverse = PAIR_LINES[`${second.key}:${first.key}`];
    if (reverse) {
      const lines = reverse[dialogueIndex % reverse.length];
      return [lines[1], lines[0]];
    }
    const firstLines = CHARACTER_LINES[first.key] || CHARACTER_LINES.luffy;
    const secondLines = CHARACTER_LINES[second.key] || CHARACTER_LINES.jinbe;
    return [
      [firstLines.chat[dialogueIndex % firstLines.chat.length], CHAT_MOODS[first.key]?.[dialogueIndex % 2] || 'happy'],
      [secondLines.reply[dialogueIndex % secondLines.reply.length], CHAT_MOODS[second.key]?.[(dialogueIndex + 1) % 2] || 'focused']
    ];
  }
  function spotsAround(target) {
    const spots = [];
    for (let col = target.cell.col; col < target.cell.col + target.span.width; col++) {
      spots.push({ col, row: target.cell.row - 1 }, { col, row: target.cell.row + target.span.height });
    }
    for (let row = target.cell.row; row < target.cell.row + target.span.height; row++) {
      spots.push({ col: target.cell.col - 1, row }, { col: target.cell.col + target.span.width, row });
    }
    return spots;
  }
  function companionWorkReady(record) {
    const work = record?.work;
    return work?.state === 'ready' || (work?.state === 'working' && Date.parse(work.readyAt) <= Date.now());
  }
  function refreshJobBadges() {
    for (const walker of walkers) {
      const record = companionRecord(walker.item?.id);
      const active = record?.work?.state === 'working' || record?.work?.state === 'ready';
      const badge = walker.node.querySelector('.room-work-badge');
      if (badge) { badge.hidden = !active; badge.textContent = companionWorkReady(record) ? '可領取' : '工作中'; }
      walker.node.classList.toggle('has-job', !!active);
      walker.node.classList.toggle('is-job-ready', !!active && companionWorkReady(record));
    }
  }
  function syncCompanionWalker(itemId) {
    const walker = walkers.find(entry => entry.item?.id === itemId);
    if (!walker) return;
    const record = companionRecord(itemId);
    const active = record?.work?.state === 'working' || record?.work?.state === 'ready';
    if (!active) {
      if (walker.mode === 'job' || walker.mode === 'job-approach') {
        walker.route = []; walker.jobFurnitureKey = '';
        walker.node.classList.remove('is-using-furniture');
        if (companionId === itemId) { walker.mode = 'focused'; setPose(walker, 'idle'); }
        else chooseDestination(walker);
      }
      refreshJobBadges(); return;
    }
    if (walker.mode === 'job' || walker.mode === 'job-approach') { refreshJobBadges(); return; }
    if (interaction?.actors.includes(walker)) finishInteraction(performance.now());
    const favorites = dialogue?.profile?.(walker.key)?.favorite || [];
    const room = activeRoom();
    const layout = layoutRoom(room);
    const targets = room.placements.map(entry => {
      const item = resolvedItem(entry.itemId, 'furniture');
      return { item, placed: layout.placements.get(`f:${entry.itemId}`) };
    }).filter(entry => entry.item && entry.placed);
    targets.sort((a, b) => Number(favorites.includes(keyForFurniture(b.item))) - Number(favorites.includes(keyForFurniture(a.item))));
    walker.jobFurnitureKey = '';
    walker.route = []; walker.pause = 0;
    for (const target of targets) {
      const spots = spotsAround(target.placed)
        .filter(cell => !cellBlocked(cell, blockedFor(walker)))
        .sort((a, b) => Math.abs(a.col - walker.cell.col) + Math.abs(a.row - walker.cell.row) - Math.abs(b.col - walker.cell.col) - Math.abs(b.row - walker.cell.row));
      if (spots.some(cell => routeTo(walker, cell))) {
        walker.jobFurnitureKey = keyForFurniture(target.item);
        walker.mode = walker.route.length ? 'job-approach' : 'job';
        break;
      }
    }
    if (!walker.jobFurnitureKey) walker.mode = 'job';
    if (walker.mode === 'job') {
      walker.node.classList.add('is-using-furniture');
      setPose(walker, 'focused_use');
    }
    refreshJobBadges();
  }
  function startInteraction(now) {
    if (interaction || !walkers.length || now < nextInteractionAt) return;
    const available = walkers.filter(walker => walker.mode === 'wander' && walker.item?.id !== companionId);
    if (!available.length) { nextInteractionAt = now + 2500; return; }
    const furnishings = activeRoom().placements
      .map(entry => ({ entry, item: resolvedItem(entry.itemId, 'furniture') }))
      .filter(value => value.item && FURNITURE_ACTIONS[keyForFurniture(value.item)]);
    const chat = available.length > 1 && (!furnishings.length || interactionIndex % 2 === 0);
    const first = available[interactionIndex % available.length];
    if (chat) {
      const second = available[(interactionIndex + 1) % available.length];
      const adjacent = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .map(([dc, dr]) => ({ col: first.cell.col + dc, row: first.cell.row + dr }))
        .filter(cell => !cellBlocked(cell, blockedFor(second)))
        .sort((a, b) => Math.abs(a.col - second.cell.col) + Math.abs(a.row - second.cell.row) - Math.abs(b.col - second.cell.col) - Math.abs(b.row - second.cell.row));
      const meeting = adjacent.find(cell => routeTo(second, cell));
      if (!meeting) { nextInteractionAt = now + 1600; interactionIndex++; return; }
      first.route = []; first.targetCell = first.cell; first.pause = 0;
      second.pause = 0; first.mode = 'approach'; second.mode = 'approach';
      setPose(first, 'wave');
      interaction = { type: 'chat', actors: [first, second], lines: pairDialogue(first, second), phase: 'approach', expires: now + 8500, holdUntil: 0 };
    } else if (furnishings.length) {
      const preferredTargets = furnishings.filter(value => CHARACTER_LINES[first.key]?.furniture?.[keyForFurniture(value.item)]);
      const choices = preferredTargets.length ? preferredTargets : furnishings;
      const target = choices[interactionIndex % choices.length];
      const action = FURNITURE_ACTIONS[keyForFurniture(target.item)];
      const preferred = CHARACTER_LINES[first.key]?.furniture?.[keyForFurniture(target.item)];
      const variation = dialogue?.activity?.(first.key, keyForFurniture(target.item), dialogueIndex);
      const targetLayout = layoutRoom(activeRoom()).placements.get(`f:${target.entry.itemId}`);
      if (!targetLayout) { nextInteractionAt = now + 1600; interactionIndex++; return; }
      const spots = spotsAround(targetLayout);
      spots.sort((a, b) => Math.abs(a.col - first.cell.col) + Math.abs(a.row - first.cell.row) - Math.abs(b.col - first.cell.col) - Math.abs(b.row - first.cell.row));
      const adjacent = spots.find(cell => routeTo(first, cell));
      if (!adjacent) { nextInteractionAt = now + 1600; interactionIndex++; return; }
      first.pause = 0; first.mode = 'approach';
      interaction = { type: 'furniture', actors: [first], furnitureKey: keyForFurniture(target.item),
        target: targetLayout, line: variation?.line || preferred?.[0] || action.line,
        mood: variation?.mood || preferred?.[1] || action.mood,
        action: variation?.verb || action.verb, phase: 'approach', expires: now + 8500, holdUntil: 0 };
    }
    interactionIndex++;
  }
  function finishInteraction(now) {
    if (!interaction) return;
    for (const walker of interaction.actors) { hideSpeech(walker); setPose(walker, 'idle'); chooseDestination(walker); }
    interaction = null;
    dialogueIndex++;
    nextInteractionAt = now + 4200 + Math.random() * 2100;
  }
  function updateInteraction(now) {
    const event = interaction;
    if (!event) return;
    if (event.phase === 'approach') {
      const arrived = event.actors.every(walker => !walker.route.length);
      if (!arrived && now < event.expires) return;
      if (!arrived) { finishInteraction(now); return; }
      event.phase = 'speaking-first'; event.holdUntil = now + 2600;
      for (const walker of event.actors) { walker.mode = 'interact'; walker.node.classList.remove('is-walking'); }
      if (event.type === 'chat') {
        event.actors[0].node.style.setProperty('--facing', event.actors[1].x < event.actors[0].x ? '-1' : '1');
        event.actors[1].node.style.setProperty('--facing', event.actors[0].x < event.actors[1].x ? '-1' : '1');
        setPose(event.actors[1], 'wave');
        showSpeech(event.actors[0], event.lines[0][0], event.lines[0][1], '和夥伴交談');
      } else {
        event.actors[0].node.style.setProperty('--facing', event.target.anchor.x < event.actors[0].x ? '-1' : '1');
        showSpeech(event.actors[0], event.line, event.mood, event.action, true, event.furnitureKey);
      }
      return;
    }
    if (now < event.holdUntil) return;
    if (event.type === 'chat' && event.phase === 'speaking-first') {
      event.phase = 'speaking-second'; event.holdUntil = now + 2600;
      setPose(event.actors[0], 'wave');
      showSpeech(event.actors[1], event.lines[1][0], event.lines[1][1], '回應夥伴');
    } else finishInteraction(now);
  }
  function frame(now) {
    animationId = 0;
    if (!canAnimate()) return;
    const delta = Math.min(50, lastFrame ? now - lastFrame : 16);
    lastFrame = now;
    startInteraction(now);
    if (now >= nextJobBadgeAt) { refreshJobBadges(); nextJobBadgeAt = now + 1000; }
    for (const walker of walkers) {
      if (walker.mode === 'interact') continue;
      if (walker.mode === 'focused') {
        if (walker.manualUntil && now >= walker.manualUntil) {
          hideSpeech(walker); setPose(walker, 'idle'); walker.manualUntil = 0;
        }
        continue;
      }
      if (walker.mode === 'job') {
        if (walker.jobSpeechUntil && now >= walker.jobSpeechUntil) { hideSpeech(walker); walker.jobSpeechUntil = 0; }
        if (!companionWorkReady(companionRecord(walker.item?.id))) {
          walker.node.classList.add('is-using-furniture');
          setPose(walker, ['kitchen-table', 'piano'].includes(walker.jobFurnitureKey) ? 'sit' : 'focused_use');
        } else {
          walker.node.classList.remove('is-using-furniture'); setPose(walker, 'wave');
        }
        continue;
      }
      if (walker.pause > 0 && walker.mode === 'wander') {
        walker.pause -= delta; walker.stepDistance = 0;
        walker.node.classList.remove('is-walking'); setPose(walker, 'idle'); continue;
      }
      if (!walker.route.length) {
        walker.node.classList.remove('is-walking');
        walker.stepDistance = 0;
        if (walker.mode === 'job-approach') {
          walker.mode = 'job';
          const task = walker.jobIntro
            ? { line: walker.jobIntro[0], mood: walker.jobIntro[1], verb: '開始工作' }
            : dialogue?.activity?.(walker.key, walker.jobFurnitureKey, companionLineIndex++);
          walker.jobIntro = null;
          if (task) { showSpeech(walker, task.line, task.mood, task.verb, true, walker.jobFurnitureKey); walker.jobSpeechUntil = now + 3000; }
          else { walker.node.classList.add('is-using-furniture'); setPose(walker, 'focused_use'); }
        }
        if (walker.mode === 'wander') chooseDestination(walker);
        continue;
      }
      const nextCell = walker.route[0];
      if (walkers.some(other => other !== walker && other.cell.col === nextCell.col && other.cell.row === nextCell.row)) {
        walker.blockedFor = (walker.blockedFor || 0) + delta;
        if (walker.blockedFor > 900 && walker.mode === 'wander') chooseDestination(walker);
        else if (walker.blockedFor > 1500 && walker.mode === 'job-approach') {
          walker.route = []; walker.mode = 'job'; walker.node.classList.add('is-using-furniture'); setPose(walker, 'focused_use');
        }
        walker.node.classList.remove('is-walking'); setPose(walker, 'idle'); continue;
      }
      walker.blockedFor = 0;
      const target = anchorForCell(nextCell, { width: 1, height: 1 });
      const dx = target.x - walker.x;
      const dy = target.y - walker.y;
      const distance = Math.hypot(dx, dy);
      const step = Math.min(distance, delta * .083);
      if (distance <= step || distance < 1) {
        walker.x = target.x; walker.y = target.y; walker.cell = nextCell; walker.route.shift();
        walker.node.dataset.gridCol = String(nextCell.col); walker.node.dataset.gridRow = String(nextCell.row);
      } else { walker.x += dx / distance * step; walker.y += dy / distance * step; }
      walker.node.style.left = `${walker.x / WIDTH * 100}%`;
      walker.node.style.top = `${walker.y / HEIGHT * 100}%`;
      walker.node.style.zIndex = String(10 + Math.round(walker.y));
      walker.node.style.setProperty('--room-depth', String(.72 + .35 * (walker.y - FLOOR.top) / (FLOOR.bottom - FLOOR.top)));
      if (Math.abs(dx) > 1) walker.node.style.setProperty('--facing', dx < 0 ? '-1' : '1');
      keepSpeechInsideStage(walker);
      walker.node.classList.add('is-walking');
      walker.stepDistance += step;
      setPose(walker, Math.floor(walker.stepDistance / 18) % 2 ? 'walk2' : 'walk1');
      if (!walker.route.length) {
        walker.node.classList.remove('is-walking'); walker.stepDistance = 0;
        setPose(walker, 'idle');
      }
    }
    updateInteraction(now);
    animationId = requestAnimationFrame(frame);
  }
  function refreshAnimation() {
    stopAnimation();
    if (!canAnimate()) return;
    const room = activeRoom();
    const layout = layoutRoom(room);
    walkBlocked = layoutRoom({ placements: room.placements, characters: [] }).occupied;
    for (const placement of activeRoom().characters) {
      const node = [...$('roomCharacters').children].find(child => child.dataset.roomKey === `c:${placement.itemId}`);
      if (!node) continue;
      const item = resolvedItem(placement.itemId, 'character');
      const placed = layout.placements.get(`c:${placement.itemId}`);
      if (!placed) continue;
      const startX = placed.anchor.x;
      const startY = placed.anchor.y;
      node.style.left = `${startX / WIDTH * 100}%`;
      node.style.top = `${startY / HEIGHT * 100}%`;
      const walker = { node, item, key: keyForCharacter(item), cell: placed.cell, x: startX, y: startY,
        pause: Math.random() * 350, route: [], targetCell: null, mode: 'wander', stepDistance: 0, pose: '' };
      keepSpeechInsideStage(walker);
      walkers.push(walker);
      setPose(walker, 'idle');
    }
    for (const walker of walkers) {
      if (companionRecord(walker.item?.id)?.work?.state !== 'idle' && companionRecord(walker.item?.id)?.work?.state) syncCompanionWalker(walker.item.id);
      else if (walker.item?.id === companionId) { walker.mode = 'focused'; walker.node.classList.add('is-companion-selected'); setPose(walker, 'idle'); }
      else chooseDestination(walker);
    }
    refreshJobBadges();
    if (walkers.length) { nextInteractionAt = performance.now() + 1800; animationId = requestAnimationFrame(frame); }
  }
  function positionNode(node, placed) {
    const { entry, kind, span, anchor, cell } = placed;
    node.style.left = `${anchor.x / WIDTH * 100}%`;
    node.style.top = `${anchor.y / HEIGHT * 100}%`;
    node.style.zIndex = String(10 + Math.round(anchor.y));
    node.style.setProperty('--room-depth', String(round(.72 + .35 * (anchor.y - FLOOR.top) / (FLOOR.bottom - FLOOR.top))));
    node.dataset.gridCol = String(cell.col); node.dataset.gridRow = String(cell.row);
    node.dataset.footprint = `${span.width}x${span.height}`;
    if (kind === 'furniture') {
      const [width, height] = FURNITURE_VISUALS[keyForFurniture(placed.item)] || [150, 128];
      node.style.setProperty('--room-size', String(round(.72 + .35 * (anchor.y - FLOOR.top) / (FLOOR.bottom - FLOOR.top))));
      node.style.setProperty('--room-width', `${round(width / WIDTH * 100)}%`);
      node.style.setProperty('--room-height', `${round(height / HEIGHT * 100)}%`);
      node.dataset.rotation = String(rotationFor(entry));
    }
  }
  function drawFloorGrid(layout) {
    const floor = $('roomStage').querySelector('.room-floor-grid');
    floor.replaceChildren();
    const ns = 'http://www.w3.org/2000/svg';
    const path = document.createElementNS(ns, 'path');
    const lines = [];
    for (let row = 0; row <= FLOOR.rows; row++) {
      const left = gridPoint(0, row); const right = gridPoint(FLOOR.columns, row);
      lines.push(`M ${left.x} ${left.y} L ${right.x} ${right.y}`);
    }
    for (let col = 0; col <= FLOOR.columns; col++) {
      const back = gridPoint(col, 0); const front = gridPoint(col, FLOOR.rows);
      lines.push(`M ${back.x} ${back.y} L ${front.x} ${front.y}`);
    }
    path.setAttribute('d', lines.join(' ')); path.setAttribute('class', 'room-grid-lines'); floor.append(path);
    for (const placed of layout.placements.values()) {
      const { cell, span, key, kind } = placed;
      const corners = [gridPoint(cell.col, cell.row), gridPoint(cell.col + span.width, cell.row),
        gridPoint(cell.col + span.width, cell.row + span.height), gridPoint(cell.col, cell.row + span.height)];
      const tile = document.createElementNS(ns, 'polygon');
      tile.setAttribute('points', corners.map(point => `${point.x},${point.y}`).join(' '));
      tile.setAttribute('class', `room-grid-footprint ${kind === 'furniture' ? 'is-furniture' : 'is-character'}${selected && key === `${selected.kind === 'furniture' ? 'f' : 'c'}:${selected.itemId}` ? ' is-selected' : ''}`);
      floor.append(tile);
    }
  }
  function furnitureView(item, rotation) {
    const key = keyForFurniture(item);
    return /^[a-z0-9-]+$/.test(key) ? `opui://launcher/images/launcher_room/furniture_views/${key}/${rotation}.webp` : assetFor(item);
  }
  function showFurnitureView(sprite, item, rotation) {
    const fallback = assetFor(item);
    sprite.onerror = () => { sprite.onerror = null; sprite.src = fallback; sprite.dataset.artFallback = 'true'; };
    sprite.dataset.artFallback = 'false';
    sprite.src = furnitureView(item, rotation);
  }
  function renderStage() {
    stopAnimation();
    const room = activeRoom();
    const layout = layoutRoom(room);
    const scene = resolvedItem(room.sceneId, 'scene');
    const image = $('roomScene');
    image.src = assetFor(scene) || SCENE_FALLBACK;
    image.alt = scene?.name || '航海夥伴房間';
    image.onerror = () => { image.onerror = null; image.src = SCENE_FALLBACK; };
    const stage = $('roomStage');
    stage.classList.toggle('is-editing', editing);
    stage.setAttribute('aria-label', `${profile?.name || '航海者'}的航海夥伴房間${editing ? '，可拖曳，用方向鍵微調，按 R 旋轉家具' : ''}`);
    if (!stage.querySelector('.room-floor-grid')) {
      const plane = el('div', 'room-floor-plane'); plane.setAttribute('aria-hidden', 'true');
      const floor = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      floor.setAttribute('class', 'room-floor-grid'); floor.setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);
      floor.setAttribute('preserveAspectRatio', 'none'); floor.setAttribute('aria-hidden', 'true');
      image.after(plane, floor);
    }
    drawFloorGrid(layout);
    $('roomCaption').textContent = profile ? `${profile.name || '航海者'}的航海夥伴房間` : '登入後展示你的航海房間';
    const furniture = $('roomObjects'); furniture.replaceChildren();
    const characters = $('roomCharacters'); characters.replaceChildren();
    for (const entry of room.placements) {
      const item = resolvedItem(entry.itemId, 'furniture');
      const source = assetFor(item);
      if (!source) continue;
      const placed = layout.placements.get(`f:${entry.itemId}`);
      if (!placed) continue;
      const node = el('div', 'room-object-shell');
      const sprite = el('img', 'room-object');
      showFurnitureView(sprite, item, rotationFor(entry)); sprite.alt = item.name || '家具'; sprite.draggable = false;
      const direction = el('span', 'room-direction', CARDINAL[rotationFor(entry)]);
      direction.setAttribute('aria-hidden', 'true');
      const controls = el('div', 'room-canvas-controls');
      for (const [delta, symbol, label] of [[-1, '↶', '向左旋轉家具'], [1, '↷', '向右旋轉家具']]) {
        const button = el('button', 'room-canvas-rotate', symbol); button.type = 'button';
        button.setAttribute('aria-label', label);
        button.onclick = event => { event.stopPropagation(); setSelected('furniture', entry.itemId); rotateSelection(delta); };
        controls.append(button);
      }
      const remove = el('button', 'room-canvas-remove', '×'); remove.type = 'button';
      remove.setAttribute('aria-label', '收起這件家具');
      remove.onclick = event => { event.stopPropagation(); setSelected('furniture', entry.itemId); removeSelection(); };
      controls.append(remove);
      node.append(sprite, direction, controls);
      node.dataset.roomKey = `f:${entry.itemId}`;
      node.classList.toggle('is-selected', !!selected && selected.kind === 'furniture' && selected.itemId === entry.itemId);
      positionNode(node, placed); furniture.append(node);
    }
    for (const entry of room.characters) {
      const item = resolvedItem(entry.itemId, 'character');
      const source = assetFor(item);
      if (!source) continue;
      const placed = layout.placements.get(`c:${entry.itemId}`);
      if (!placed) continue;
      const node = el('div', 'room-character-shell');
      const sprite = el('img', 'room-chibi');
      sprite.src = source; sprite.alt = item.name || '航海夥伴'; sprite.draggable = false;
      const speech = el('div', 'room-speech'); speech.hidden = true;
      speech.setAttribute('role', 'status'); speech.setAttribute('aria-live', 'polite');
      speech.append(el('span', 'room-speech-text'), el('small', 'room-speech-action'));
      const badge = el('span', 'room-work-badge'); badge.hidden = true; badge.setAttribute('aria-hidden', 'true');
      const work = companionRecord(entry.itemId);
      const working = work?.work?.state === 'working' || work?.work?.state === 'ready';
      badge.hidden = !working;
      badge.textContent = companionWorkReady(work) ? '可領取' : '工作中';
      node.append(sprite, speech, badge);
      node.dataset.roomKey = `c:${entry.itemId}`;
      node.tabIndex = 0;
      node.setAttribute('role', 'button');
      node.setAttribute('aria-label', `查看${item.name || '夥伴'}的詳情與互動`);
      node.onclick = () => { if (!editing) openCompanion(entry.itemId); };
      node.onkeydown = event => {
        if (editing || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault(); openCompanion(entry.itemId);
      };
      node.classList.toggle('is-selected', !!selected && selected.kind === 'character' && selected.itemId === entry.itemId);
      node.classList.toggle('is-companion-selected', !editing && companionId === entry.itemId);
      node.classList.toggle('has-job', !!working);
      node.classList.toggle('is-job-ready', !!working && companionWorkReady(work));
      positionNode(node, placed); characters.append(node);
    }
    refreshAnimation();
  }
  function setSelected(kind, itemId) {
    selected = kind && itemId ? { kind, itemId } : null;
    for (const node of $('roomStage').querySelectorAll('[data-room-key]')) {
      node.classList.toggle('is-selected', node.dataset.roomKey === `${kind === 'furniture' ? 'f' : 'c'}:${itemId}`);
    }
    if (editing) drawFloorGrid(layoutRoom(draft));
    renderSelection();
  }
  function markChanged() {
    dirty = true;
    $('roomSave').disabled = saving;
    status('房間尚未儲存。');
  }
  function moveSelection(x, y) {
    const entry = itemBySelection();
    if (!entry) return;
    const key = `${selected.kind === 'furniture' ? 'f' : 'c'}:${entry.itemId}`;
    const item = resolvedItem(entry.itemId, selected.kind);
    const span = footprint(entry, item, selected.kind);
    const other = layoutRoom(draft, key);
    const desired = cellForPosition({ x, y }, span);
    if (cellsInFootprint(desired, span).some(id => other.occupied.has(id))) {
      status('這些地板格已被其他擺設佔用，請選空位。', true); return false;
    }
    const before = `${entry.x}:${entry.y}`;
    positionInCell(entry, desired, span);
    if (`${entry.x}:${entry.y}` === before) return true;
    const node = [...$('roomStage').querySelectorAll('[data-room-key]')].find(element => element.dataset.roomKey === key);
    const layout = layoutRoom(draft);
    if (node) positionNode(node, layout.placements.get(key));
    drawFloorGrid(layout);
    markChanged();
    renderSelection();
    return true;
  }
  function renderSelection() {
    const panel = $('roomSelection'); panel.replaceChildren();
    const entry = itemBySelection();
    panel.hidden = !entry || !editing;
    if (!entry || !editing) return;
    const item = resolvedItem(entry.itemId, selected.kind);
    const placed = layoutRoom(draft).placements.get(`${selected.kind === 'furniture' ? 'f' : 'c'}:${entry.itemId}`);
    panel.append(el('strong', '', item?.name || '已選物件'), el('small', '', `地板 ${placed ? `${placed.cell.col + 1} 欄、${placed.cell.row + 1} 排` : '待擺放'} · 在房間圖面拖曳移動${selected.kind === 'furniture' ? '、點家具旁箭頭轉向' : ''}`));
    const remove = el('button', 'room-remove', '移除擺設'); remove.type = 'button';
    remove.onclick = removeSelection;
    panel.append(remove);
  }
  function removeSelection() {
    if (!editing || !selected) return;
    const list = selected.kind === 'furniture' ? draft.placements : draft.characters;
    const index = list.findIndex(value => value.itemId === selected.itemId);
    if (index >= 0) list.splice(index, 1);
    selected = null; markChanged(); renderStage(); renderEditorItems(); renderSelection();
  }
  function rotateSelection(delta = 1) {
    if (!editing || selected?.kind !== 'furniture') return;
    const entry = itemBySelection(); if (!entry) return;
    const prior = rotationFor(entry);
    entry.rotation = (prior + delta + 4) % 4;
    entry.flip = entry.rotation === 2;
    const key = `f:${entry.itemId}`;
    const span = footprint(entry, resolvedItem(entry.itemId, 'furniture'), 'furniture');
    const other = layoutRoom(draft, key);
    const cell = nearestVacant(cellForPosition(entry, span), span, other.occupied);
    if (!cell) { entry.rotation = prior; entry.flip = prior === 2; status('地板空間不足，這裡無法旋轉家具。', true); return; }
    positionInCell(entry, cell, span);
    const layout = layoutRoom(draft);
    const node = [...$('roomObjects').children].find(child => child.dataset.roomKey === `f:${entry.itemId}`);
    if (node) {
      positionNode(node, layout.placements.get(key));
      showFurnitureView(node.querySelector('.room-object'), resolvedItem(entry.itemId, 'furniture'), entry.rotation);
      const direction = node.querySelector('.room-direction');
      if (direction) direction.textContent = CARDINAL[entry.rotation];
    }
    drawFloorGrid(layout);
    markChanged(); renderSelection();
  }
  function renderEditorTabs() {
    const tabs = $('roomEditorTabs'); tabs.replaceChildren();
    for (const [id, meta] of Object.entries(TYPES)) {
      const button = el('button', '', meta.label); button.type = 'button';
      button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', String(id === tab));
      button.onclick = () => { tab = id; renderEditorTabs(); renderEditorItems(); };
      tabs.append(button);
    }
  }
  function addItem(kind, item) {
    if (kind === 'scene') {
      draft.sceneId = item?.id || DEFAULT_SCENE; markChanged(); renderStage(); renderEditorItems(); return;
    }
    const list = kind === 'furniture' ? draft.placements : draft.characters;
    const existing = list.find(value => value.itemId === item.id);
    if (existing) { setSelected(kind, item.id); $('roomStage').focus(); return; }
    if (list.length >= (kind === 'furniture' ? 24 : ROOM_MAX_CHARACTERS)) { status(kind === 'furniture' ? '房間最多擺 24 件家具。' : `房間最多邀請 ${ROOM_MAX_CHARACTERS} 位夥伴。`, true); return; }
    const index = list.length;
    const entry = kind === 'furniture'
      ? { itemId: item.id, x: [300, 705, 480, 610][index % 4], y: 385 + Math.floor(index / 4) * 28, scale: 1, rotation: 0, flip: false }
      : { itemId: item.id, x: 190 + index % 5 * 145, y: 400 + Math.floor(index / 5) * 60 };
    const span = footprint(entry, item, kind);
    const cell = nearestVacant(cellForPosition(entry, span), span, layoutRoom(draft).occupied);
    if (!cell) { status('房間地板沒有足夠空位，請先移動或收起其他擺設。', true); return; }
    positionInCell(entry, cell, span);
    list.push(entry);
    markChanged(); renderStage(); renderEditorItems(); setSelected(kind, item.id); $('roomStage').focus();
  }
  function renderEditorItems() {
    const grid = $('roomEditorItems'); grid.replaceChildren();
    if (!editing) return;
    const products = roomItems(tab);
    if (tab === 'scene') {
      const defaultButton = el('button', 'room-palette-item'); defaultButton.type = 'button';
      defaultButton.classList.toggle('is-active', draft.sceneId === DEFAULT_SCENE);
      defaultButton.append(el('span', 'room-palette-default', '⚓'), el('strong', '', '原始船艙'), el('small', '', '免費'));
      defaultButton.onclick = () => addItem('scene', null); grid.append(defaultButton);
    }
    for (const item of products) {
      const button = el('button', 'room-palette-item'); button.type = 'button';
      const inRoom = tab === 'scene' ? draft.sceneId === item.id :
        (tab === 'furniture' ? draft.placements : draft.characters).some(value => value.itemId === item.id);
      button.classList.toggle('is-active', inRoom);
      const image = el('img'); image.src = assetFor(item); image.alt = ''; image.loading = 'lazy';
      button.append(image, el('strong', '', item.name || item.id), el('small', '', inRoom ? tab === 'scene' ? '目前場景' : '房間內' : '點擊使用'));
      button.onclick = () => addItem(tab, item);
      grid.append(button);
    }
    if (!products.length && tab !== 'scene') grid.append(el('p', 'room-empty', '尚未收藏這類商品。到商店挑選喜歡的航海王主題商品。'));
  }
  function renderEditor() {
    $('roomEditor').hidden = !editing;
    $('roomEditToggle').hidden = !isOwner();
    $('roomEditToggle').textContent = editing ? '取消佈置' : loading ? '讀取商品…' : '佈置房間';
    $('roomEditToggle').disabled = loading || saving;
    $('roomSave').disabled = saving || !dirty;
    $('roomCancel').disabled = saving;
    if (editing) { renderEditorTabs(); renderEditorItems(); renderSelection(); }
  }
  function render() { renderStage(); renderEditor(); renderCompanionPanel(); }
  async function openEditor() {
    if (!isOwner() || editing || loading) return;
    const openEpoch = viewEpoch;
    const openAccountId = accountId;
    const openUserId = profile.userId;
    loading = true; renderEditor(); status('正在讀取你已購買的房間商品…');
    try {
      const result = await api.getLauncherShop();
      if (openEpoch !== viewEpoch || openAccountId !== accountId || openUserId !== profile?.userId || !isOwner()) return;
      if (!result?.ok || !result.shop) { status('商品無法讀取，請稍後再試。', true); return; }
      closeCompanion();
      shop = result.shop; draft = copyRoom(profile?.room); editing = true; dirty = false; selected = null;
      status('選擇場景、家具或夥伴；在圖面拖曳與轉向，最後儲存。'); render();
    } catch { if (openEpoch === viewEpoch) status('目前無法連線，請稍後再試。', true); }
    finally { loading = false; renderEditor(); }
  }
  function closeEditor() {
    if (saving) return;
    editing = false; dirty = false; selected = null; drag = null;
    draft = copyRoom(profile?.room); status(''); render();
  }
  async function save() {
    if (!isOwner() || !editing || !dirty || saving) return;
    const saveEpoch = viewEpoch;
    const saveAccountId = accountId;
    const saveUserId = profile.userId;
    saving = true; renderEditor(); status('正在儲存房間…');
    try {
      const payload = copyRoom(draft);
      const result = await api.saveLauncherRoom(payload);
      if (saveEpoch !== viewEpoch || saveAccountId !== accountId || saveUserId !== profile?.userId || !isOwner()) return;
      if (!result?.ok || !result.profile) {
        if (result?.error === 'revision_conflict' && result.profile) {
          profile = result.profile;
          shop = result.shop || shop;
          window.LauncherProfileShop?.onRoomSaved?.(result.profile, result.shop);
        }
        status(result?.error === 'revision_conflict' ? '房間已在其他裝置變更。請取消這次編輯，再重新佈置。' : '房間未儲存，請稍後再試。', true);
        return;
      }
      profile = result.profile; shop = result.shop || shop;
      draft = copyRoom(profile.room); dirty = false; selected = null;
      window.LauncherProfileShop?.onRoomSaved?.(result.profile, result.shop);
      render(); status('房間已儲存，好友現在可以參觀。');
    } catch { if (saveEpoch === viewEpoch) status('房間未儲存，請檢查連線後再試。', true); }
    finally { saving = false; renderEditor(); }
  }
  function setProfile(nextProfile, context = {}) {
    const nextAccount = Number(context.accountId) || 0;
    const nextPreview = context.preview === true;
    const changedOwner = nextAccount !== accountId || nextPreview !== preview || (profile?.userId || 0) !== (nextProfile?.userId || 0);
    if (changedOwner) viewEpoch++;
    if (changedOwner) { closeCompanion(); companionStats.clear(); }
    profile = nextProfile || null; accountId = nextAccount; preview = nextPreview;
    if (changedOwner || !isOwner()) {
      editing = false; dirty = false; selected = null; shop = null; drag = null;
      draft = copyRoom(profile?.room); status('');
    } else if (!editing) draft = copyRoom(profile?.room);
    render();
  }
  function onVisible(panel) { visible = panel === 'profile'; if (!visible) closeCompanion(); refreshAnimation(); }

  $('roomEditToggle').onclick = () => editing ? closeEditor() : openEditor();
  $('roomCancel').onclick = closeEditor;
  $('roomSave').onclick = save;
  $('roomCompanionClose').onclick = closeCompanion;
  $('roomCompanionTalk').onclick = () => performCompanionAction('talk');
  $('roomCompanionWorkStart').onclick = () => performCompanionAction('start');
  $('roomCompanionWorkClaim').onclick = () => performCompanionAction('claim');
  $('roomStage').addEventListener('pointerdown', event => {
    if (!editing || saving || event.button > 0) return;
    if (event.target.closest('.room-canvas-controls')) return;
    const node = event.target.closest('[data-room-key]');
    if (!node || !$('roomStage').contains(node)) return;
    const key = node.dataset.roomKey;
    const kind = key.startsWith('f:') ? 'furniture' : 'character';
    const itemId = key.slice(2);
    setSelected(kind, itemId);
    const entry = itemBySelection(); if (!entry) return;
    const position = point(event);
    drag = { pointerId: event.pointerId, dx: position.x - entry.x, dy: position.y - entry.y };
    $('roomStage').setPointerCapture(event.pointerId);
    $('roomStage').focus(); event.preventDefault();
  });
  $('roomStage').addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId || !editing) return;
    const position = point(event);
    moveSelection(position.x - drag.dx, position.y - drag.dy);
    event.preventDefault();
  });
  const endDrag = event => { if (drag?.pointerId === event.pointerId) drag = null; };
  $('roomStage').addEventListener('pointerup', endDrag);
  $('roomStage').addEventListener('pointercancel', endDrag);
  $('roomStage').addEventListener('keydown', event => {
    if (!editing || !selected) return;
    const entry = itemBySelection(); if (!entry) return;
    const key = `${selected.kind === 'furniture' ? 'f' : 'c'}:${entry.itemId}`;
    const placed = layoutRoom(draft).placements.get(key);
    const step = event.shiftKey ? 2 : 1;
    const moveCell = (dc, dr) => {
      if (!placed) return;
      const point = anchorForCell({ col: placed.cell.col + dc, row: placed.cell.row + dr }, placed.span);
      moveSelection(point.x, point.y);
    };
    if (event.key === 'ArrowLeft') moveCell(-step, 0);
    else if (event.key === 'ArrowRight') moveCell(step, 0);
    else if (event.key === 'ArrowUp') moveCell(0, -step);
    else if (event.key === 'ArrowDown') moveCell(0, step);
    else if ((event.key === 'r' || event.key === 'R') && selected.kind === 'furniture') rotateSelection();
    else if (event.key === 'Delete' || event.key === 'Backspace') removeSelection();
    else return;
    event.preventDefault();
  });
  document.addEventListener('visibilitychange', refreshAnimation);
  motion.addEventListener?.('change', refreshAnimation);
  window.LauncherRoom = { setProfile, onVisible, openEditor };
  render();
})();
