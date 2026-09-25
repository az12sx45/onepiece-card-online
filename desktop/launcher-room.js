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
  const CARDINAL = ['正向', '右轉', '背向', '左轉'];
  const CHARACTER_STARTS = [
    [125, 395], [300, 405], [480, 395], [660, 405], [835, 395],
    [210, 495], [480, 495], [750, 495]
  ];
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
  // Original, short dialogue in each character's established manner; no source dialogue is reproduced.
  const CHARACTER_LINES = {
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
  const CHAT_MOODS = {
    luffy: ['happy', 'surprised'], zoro: ['focused', 'annoyed'], nami: ['focused', 'annoyed'],
    usopp: ['surprised', 'happy'], sanji: ['happy', 'focused'], chopper: ['surprised', 'happy'],
    robin: ['focused', 'happy'], franky: ['happy', 'focused'], brook: ['happy', 'happy'], jinbe: ['focused', 'happy']
  };
  const PAIR_LINES = {
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
  const portraitFor = (item, mood) => {
    const key = keyForCharacter(item);
    return key && MOODS.has(mood) ? `opui://launcher/images/launcher_room/emotions/${key}-${mood}.webp` : assetFor(item);
  };
  const blankRoom = () => ({ revision: 0, sceneId: DEFAULT_SCENE, placements: [], characters: [] });
  function copyRoom(source) {
    const room = source && typeof source === 'object' ? source : {};
    return {
      revision: Math.max(0, Math.trunc(clamp(room.revision, 0, Number.MAX_SAFE_INTEGER, 0))),
      sceneId: typeof room.sceneId === 'string' ? room.sceneId : DEFAULT_SCENE,
      placements: (Array.isArray(room.placements) ? room.placements : []).slice(0, 24).map(item => ({
        itemId: String(item?.itemId || ''), x: clamp(item?.x, 0, WIDTH, 480), y: clamp(item?.y, 0, HEIGHT, 410),
        scale: clamp(item?.scale, .5, 1.5, 1), rotation: rotationFor(item), flip: rotationFor(item) === 2
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
  let interactionIndex = 0;
  let dialogueIndex = 0;
  let viewEpoch = 0;
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
    }
    walkers = [];
    interaction = null;
    nextInteractionAt = 0;
  }
  function canAnimate() { return visible && !editing && !!profile && !document.hidden && !motion.matches; }
  function chooseDestination(walker) {
    const anchor = { x: clamp(walker.anchor.x, 65, 895, 480), y: clamp(walker.anchor.y, 345, 485, 430) };
    const bounds = { xMin: Math.max(65, anchor.x - 115), xMax: Math.min(895, anchor.x + 115), yMin: Math.max(345, anchor.y - 35), yMax: Math.min(485, anchor.y + 35) };
    walker.targetX = bounds.xMin + Math.random() * (bounds.xMax - bounds.xMin);
    walker.targetY = bounds.yMin + Math.random() * (bounds.yMax - bounds.yMin);
    walker.pause = 500 + Math.random() * 1500;
    walker.mode = 'wander';
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
  function showSpeech(walker, message, mood, action = '', usingFurniture = false) {
    for (const other of walkers) hideSpeech(other);
    const speech = walker.node.querySelector('.room-speech');
    if (!speech) return;
    speech.querySelector('.room-speech-text').textContent = message;
    const actionNode = speech.querySelector('.room-speech-action');
    actionNode.textContent = action;
    actionNode.hidden = !action;
    const face = speech.querySelector('.room-speech-face');
    const fallback = assetFor(walker.item);
    face.onerror = () => { face.onerror = null; face.src = fallback; };
    face.src = portraitFor(walker.item, mood);
    speech.dataset.mood = mood;
    speech.hidden = false;
    walker.node.classList.add('is-interacting', usingFurniture ? 'is-using-furniture' : 'is-conversing');
  }
  function pairDialogue(first, second) {
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
  function startInteraction(now) {
    if (interaction || !walkers.length || now < nextInteractionAt) return;
    const furnishings = activeRoom().placements
      .map(entry => ({ entry, item: resolvedItem(entry.itemId, 'furniture') }))
      .filter(value => value.item && FURNITURE_ACTIONS[keyForFurniture(value.item)]);
    const chat = walkers.length > 1 && (!furnishings.length || interactionIndex % 2 === 0);
    const first = walkers[interactionIndex % walkers.length];
    if (chat) {
      const second = walkers[(interactionIndex + 1) % walkers.length];
      const centerX = clamp((first.x + second.x) / 2, 125, 835, 480);
      const centerY = clamp((first.y + second.y) / 2, 355, 475, 425);
      first.targetX = centerX - 36; first.targetY = centerY;
      second.targetX = centerX + 36; second.targetY = centerY;
      first.pause = 0; second.pause = 0;
      first.mode = 'approach'; second.mode = 'approach';
      interaction = { type: 'chat', actors: [first, second], lines: pairDialogue(first, second), phase: 'approach', expires: now + 8500, holdUntil: 0 };
    } else if (furnishings.length) {
      const preferredTargets = furnishings.filter(value => CHARACTER_LINES[first.key]?.furniture?.[keyForFurniture(value.item)]);
      const choices = preferredTargets.length ? preferredTargets : furnishings;
      const target = choices[interactionIndex % choices.length];
      const action = FURNITURE_ACTIONS[keyForFurniture(target.item)];
      const preferred = CHARACTER_LINES[first.key]?.furniture?.[keyForFurniture(target.item)];
      first.targetX = clamp(target.entry.x + 28, 65, 895, 480);
      first.targetY = clamp(target.entry.y + 18, 345, 485, 430);
      first.pause = 0; first.mode = 'approach';
      interaction = { type: 'furniture', actors: [first], line: preferred?.[0] || action.line, mood: preferred?.[1] || action.mood, action: action.verb, phase: 'approach', expires: now + 8500, holdUntil: 0 };
    }
    interactionIndex++;
  }
  function finishInteraction(now) {
    if (!interaction) return;
    for (const walker of interaction.actors) { hideSpeech(walker); chooseDestination(walker); }
    interaction = null;
    dialogueIndex++;
    nextInteractionAt = now + 4200 + Math.random() * 2100;
  }
  function updateInteraction(now) {
    const event = interaction;
    if (!event) return;
    if (event.phase === 'approach') {
      const arrived = event.actors.every(walker => Math.hypot(walker.targetX - walker.x, walker.targetY - walker.y) < 8);
      if (!arrived && now < event.expires) return;
      event.phase = 'speaking-first'; event.holdUntil = now + 2600;
      for (const walker of event.actors) { walker.mode = 'interact'; walker.node.classList.remove('is-walking'); }
      if (event.type === 'chat') {
        event.actors[0].node.style.setProperty('--facing', '1');
        event.actors[1].node.style.setProperty('--facing', '-1');
        showSpeech(event.actors[0], event.lines[0][0], event.lines[0][1], '和夥伴交談');
      } else {
        event.actors[0].node.style.setProperty('--facing', '-1');
        showSpeech(event.actors[0], event.line, event.mood, event.action, true);
      }
      return;
    }
    if (now < event.holdUntil) return;
    if (event.type === 'chat' && event.phase === 'speaking-first') {
      event.phase = 'speaking-second'; event.holdUntil = now + 2600;
      showSpeech(event.actors[1], event.lines[1][0], event.lines[1][1], '回應夥伴');
    } else finishInteraction(now);
  }
  function frame(now) {
    animationId = 0;
    if (!canAnimate()) return;
    const delta = Math.min(50, lastFrame ? now - lastFrame : 16);
    lastFrame = now;
    startInteraction(now);
    for (const walker of walkers) {
      if (walker.mode === 'interact') continue;
      if (walker.pause > 0 && walker.mode === 'wander') { walker.pause -= delta; walker.node.classList.remove('is-walking'); continue; }
      const dx = walker.targetX - walker.x;
      const dy = walker.targetY - walker.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 2) { walker.node.classList.remove('is-walking'); if (walker.mode === 'wander') chooseDestination(walker); continue; }
      const step = Math.min(distance, delta * .05);
      walker.x += dx / distance * step;
      walker.y += dy / distance * step;
      walker.node.style.left = `${walker.x / WIDTH * 100}%`;
      walker.node.style.top = `${walker.y / HEIGHT * 100}%`;
      walker.node.style.zIndex = String(100 + Math.round(walker.y));
      walker.node.style.setProperty('--facing', dx < 0 ? '-1' : '1');
      keepSpeechInsideStage(walker);
      walker.node.classList.add('is-walking');
    }
    updateInteraction(now);
    animationId = requestAnimationFrame(frame);
  }
  function refreshAnimation() {
    stopAnimation();
    if (!canAnimate()) return;
    for (const placement of activeRoom().characters) {
      const node = [...$('roomCharacters').children].find(child => child.dataset.roomKey === `c:${placement.itemId}`);
      if (!node) continue;
      const item = resolvedItem(placement.itemId, 'character');
      const startX = clamp(placement.x, 65, 895, 480);
      const startY = clamp(placement.y, 345, 485, 430);
      node.style.left = `${startX / WIDTH * 100}%`;
      node.style.top = `${startY / HEIGHT * 100}%`;
      const walker = { node, item, key: keyForCharacter(item), anchor: placement, x: startX, y: startY, pause: Math.random() * 900, targetX: startX, targetY: startY, mode: 'wander' };
      keepSpeechInsideStage(walker);
      chooseDestination(walker);
      walkers.push(walker);
    }
    if (walkers.length) { nextInteractionAt = performance.now() + 1800; animationId = requestAnimationFrame(frame); }
  }
  function positionNode(node, entry, kind) {
    node.style.left = `${entry.x / WIDTH * 100}%`;
    node.style.top = `${entry.y / HEIGHT * 100}%`;
    node.style.zIndex = String((kind === 'character' ? 100 : 20) + Math.round(entry.y));
    if (kind === 'furniture') {
      node.style.setProperty('--room-scale', String(entry.scale));
      node.dataset.rotation = String(rotationFor(entry));
      node.style.setProperty('--room-bearing', `${rotationFor(entry) * 90}deg`);
    }
  }
  function renderStage() {
    stopAnimation();
    const room = activeRoom();
    const scene = resolvedItem(room.sceneId, 'scene');
    const image = $('roomScene');
    image.src = assetFor(scene) || SCENE_FALLBACK;
    image.alt = scene?.name || '航海夥伴房間';
    image.onerror = () => { image.onerror = null; image.src = SCENE_FALLBACK; };
    const stage = $('roomStage');
    stage.classList.toggle('is-editing', editing);
    stage.setAttribute('aria-label', `${profile?.name || '航海者'}的航海夥伴房間${editing ? '，可拖曳，用方向鍵微調，按 R 旋轉家具' : ''}`);
    if (!stage.querySelector('.room-floor-grid')) {
      const floor = el('div', 'room-floor-grid');
      floor.setAttribute('aria-hidden', 'true');
      image.after(floor);
    }
    $('roomCaption').textContent = profile ? `${profile.name || '航海者'}的航海夥伴房間` : '登入後展示你的航海房間';
    const furniture = $('roomObjects'); furniture.replaceChildren();
    const characters = $('roomCharacters'); characters.replaceChildren();
    for (const entry of room.placements) {
      const item = resolvedItem(entry.itemId, 'furniture');
      const source = assetFor(item);
      if (!source) continue;
      const node = el('div', 'room-object-shell');
      const sprite = el('img', 'room-object');
      sprite.src = source; sprite.alt = item.name || '家具'; sprite.draggable = false;
      const direction = el('span', 'room-direction', CARDINAL[rotationFor(entry)]);
      direction.setAttribute('aria-hidden', 'true');
      node.append(sprite, direction);
      node.dataset.roomKey = `f:${entry.itemId}`;
      node.classList.toggle('is-selected', !!selected && selected.kind === 'furniture' && selected.itemId === entry.itemId);
      positionNode(node, entry, 'furniture'); furniture.append(node);
    }
    for (const entry of room.characters) {
      const item = resolvedItem(entry.itemId, 'character');
      const source = assetFor(item);
      if (!source) continue;
      const node = el('div', 'room-character-shell');
      const sprite = el('img', 'room-chibi');
      sprite.src = source; sprite.alt = item.name || '航海夥伴'; sprite.draggable = false;
      const speech = el('div', 'room-speech'); speech.hidden = true;
      speech.setAttribute('role', 'status'); speech.setAttribute('aria-live', 'polite');
      const portrait = el('img', 'room-speech-face'); portrait.alt = ''; portrait.draggable = false;
      speech.append(portrait, el('span', 'room-speech-text'), el('small', 'room-speech-action'));
      node.append(sprite, speech);
      node.dataset.roomKey = `c:${entry.itemId}`;
      node.classList.toggle('is-selected', !!selected && selected.kind === 'character' && selected.itemId === entry.itemId);
      positionNode(node, entry, 'character'); characters.append(node);
    }
    refreshAnimation();
  }
  function setSelected(kind, itemId) {
    selected = kind && itemId ? { kind, itemId } : null;
    for (const node of $('roomStage').querySelectorAll('[data-room-key]')) {
      node.classList.toggle('is-selected', node.dataset.roomKey === `${kind === 'furniture' ? 'f' : 'c'}:${itemId}`);
    }
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
    entry.x = round(clamp(x, 20, 940, entry.x));
    entry.y = round(clamp(y, selected.kind === 'character' ? 290 : 60, 520, entry.y));
    const key = `${selected.kind === 'furniture' ? 'f' : 'c'}:${entry.itemId}`;
    const node = [...$('roomStage').querySelectorAll('[data-room-key]')].find(element => element.dataset.roomKey === key);
    if (node) positionNode(node, entry, selected.kind);
    markChanged();
    renderSelection();
  }
  function renderSelection() {
    const panel = $('roomSelection'); panel.replaceChildren();
    const entry = itemBySelection();
    panel.hidden = !entry || !editing;
    if (!entry || !editing) return;
    const item = resolvedItem(entry.itemId, selected.kind);
    panel.append(el('strong', '', item?.name || '已選物件'), el('small', '', `座標 ${Math.round(entry.x)}, ${Math.round(entry.y)} · 拖曳或方向鍵微調${selected.kind === 'furniture' ? ' · R 旋轉' : ''}`));
    if (selected.kind === 'furniture') {
      const size = el('label', 'room-size-label'); size.append(el('span', '', '大小'));
      const slider = el('input'); slider.type = 'range'; slider.min = '.5'; slider.max = '1.5'; slider.step = '.05'; slider.value = String(entry.scale);
      const output = el('output', '', `${Math.round(entry.scale * 100)}%`);
      slider.oninput = () => {
        entry.scale = Number(slider.value); output.textContent = `${Math.round(entry.scale * 100)}%`;
        const node = [...$('roomObjects').children].find(child => child.dataset.roomKey === `f:${entry.itemId}`);
        if (node) positionNode(node, entry, 'furniture');
        markChanged();
      };
      size.append(slider, output); panel.append(size);
      const rotate = el('button', 'ghost-button room-rotate', `旋轉家具：${CARDINAL[rotationFor(entry)]}`); rotate.type = 'button';
      rotate.onclick = () => rotateSelection();
      panel.append(rotate);
    }
    const remove = el('button', 'room-remove', '移除擺設'); remove.type = 'button';
    remove.onclick = () => {
      const list = selected.kind === 'furniture' ? draft.placements : draft.characters;
      const index = list.findIndex(value => value.itemId === selected.itemId);
      if (index >= 0) list.splice(index, 1);
      selected = null; markChanged(); renderStage(); renderEditorItems(); renderSelection();
    };
    panel.append(remove);
  }
  function rotateSelection() {
    if (!editing || selected?.kind !== 'furniture') return;
    const entry = itemBySelection(); if (!entry) return;
    entry.rotation = (rotationFor(entry) + 1) % 4;
    entry.flip = entry.rotation === 2;
    const node = [...$('roomObjects').children].find(child => child.dataset.roomKey === `f:${entry.itemId}`);
    if (node) {
      positionNode(node, entry, 'furniture');
      const direction = node.querySelector('.room-direction');
      if (direction) direction.textContent = CARDINAL[entry.rotation];
    }
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
    const characterStart = CHARACTER_STARTS[index] || [480, 430];
    list.push(kind === 'furniture'
      ? { itemId: item.id, x: 340 + index % 4 * 95, y: 350 + Math.floor(index / 4) * 26, scale: 1, rotation: 0, flip: false }
      : { itemId: item.id, x: characterStart[0], y: characterStart[1] });
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
  function render() { renderStage(); renderEditor(); }
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
      shop = result.shop; draft = copyRoom(profile?.room); editing = true; dirty = false; selected = null;
      status('選擇場景、家具或夥伴；拖曳擺設，按 R 旋轉家具，最後儲存。'); render();
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
    profile = nextProfile || null; accountId = nextAccount; preview = nextPreview;
    if (changedOwner || !isOwner()) {
      editing = false; dirty = false; selected = null; shop = null; drag = null;
      draft = copyRoom(profile?.room); status('');
    } else if (!editing) draft = copyRoom(profile?.room);
    render();
  }
  function onVisible(panel) { visible = panel === 'profile'; refreshAnimation(); }

  $('roomEditToggle').onclick = () => editing ? closeEditor() : openEditor();
  $('roomCancel').onclick = closeEditor;
  $('roomSave').onclick = save;
  $('roomStage').addEventListener('pointerdown', event => {
    if (!editing || saving || event.button > 0) return;
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
    const step = event.shiftKey ? 10 : 1;
    if (event.key === 'ArrowLeft') moveSelection(entry.x - step, entry.y);
    else if (event.key === 'ArrowRight') moveSelection(entry.x + step, entry.y);
    else if (event.key === 'ArrowUp') moveSelection(entry.x, entry.y - step);
    else if (event.key === 'ArrowDown') moveSelection(entry.x, entry.y + step);
    else if ((event.key === 'r' || event.key === 'R') && selected.kind === 'furniture') rotateSelection();
    else if (event.key === 'Delete' || event.key === 'Backspace') $('roomSelection').querySelector('.room-remove')?.click();
    else return;
    event.preventDefault();
  });
  document.addEventListener('visibilitychange', refreshAnimation);
  motion.addEventListener?.('change', refreshAnimation);
  window.LauncherRoom = { setProfile, onVisible, openEditor };
  render();
})();
