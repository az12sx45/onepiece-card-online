(() => {
  'use strict';
  const api = window.onePieceDesktop;
  const $ = id => document.getElementById(id);
  const WIDTH = 960;
  const HEIGHT = 540;
  const ROOM_MAX_CHARACTERS = 10;
  const DEFAULT_SCENE = 'room-scene-default';
  const SCENE_FALLBACK = 'opui://launcher/images/launcher_room/scenes/crew-cabin-v2.webp';
  const TYPES = {
    scene: { type: 'room_scene', owned: 'roomScenes', label: '場景' },
    furniture: { type: 'room_furniture', owned: 'roomFurniture', label: '家具' },
    character: { type: 'room_character', owned: 'roomCharacters', label: '夥伴' }
  };
  const reserved = window.OnePieceReservedCrew;
  const ASSET = /^opui:\/\/launcher\/images\/launcher_room\/(?:(scenes|furniture|chibi)\/[a-z0-9-]+|reserved_v1\/(ace|sabo|law|hancock)\/portrait)\.webp$/i;
  const CHARACTER_KEYS = new Set(reserved?.SUPPORTED_KEYS || ['luffy', 'zoro', 'nami', 'chopper', 'sanji', 'robin', 'usopp', 'franky', 'brook', 'jinbe']);
  const MOODS = new Set(['happy', 'surprised', 'focused', 'annoyed']);
  const POSES = new Set(['idle', 'talk_happy', 'talk_annoyed', 'surprised', 'focused_use', 'sit', 'wave', 'listen']);
  const CARDINAL = ['正向', '右轉', '背向', '左轉'];
  const FLOOR = Object.freeze({ columns: 16, rows: 8, top: 267, bottom: 515, backLeft: 164, backRight: 796, frontLeft: 28, frontRight: 932 });
  const FURNITURE_FOOTPRINTS = {
    helm: [2, 2], 'map-table': [3, 2], 'treasure-chest': [2, 1], 'tangerine-tree': [2, 2],
    'swords-rack': [2, 1], 'kitchen-table': [3, 2], 'galley-stove': [3, 2], bookshelf: [2, 1],
    'medicine-cabinet': [2, 1], piano: [3, 2], 'tool-bench': [2, 2]
  };
  // Complete 384px drawings, measured at the front row against the accepted crew art.
  // All four views keep one item scale; saved footprints and placement coordinates stay fixed.
  const FURNITURE_VISUALS = Object.freeze({
    helm: 78, 'map-table': 72, 'treasure-chest': 56,
    'tangerine-tree': 104, 'swords-rack': 84,
    'kitchen-table': 80.25, 'galley-stove': 80.25, bookshelf: 90,
    'medicine-cabinet': 86, piano: 80.25, 'tool-bench': 76
  });
  const FURNITURE_CANVAS = 384;
  const FURNITURE_GROUND_ROOT = Object.freeze([192, 372]);
  // One uniform art multiplier: rear-row adults now match the cabin door's
  // roughly 89 stage-pixel opening. Grid cells and saved positions stay fixed.
  const ROOM_ART_SCALE = 1.5;
  const dialogue = window.OnePieceRoomDialogue || null;
  const locomotion = window.OnePieceRoomMotion || null;
  const motionTable = window.OnePieceRoomMotionManifest || null;
  const el = (tag, className = '', content) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = String(content);
    return node;
  };
  const clamp = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
  const catalogAssetFor = item => typeof item?.asset === 'string' && ASSET.test(item.asset) ? item.asset : '';
  const assetFor = item => {
    const source = catalogAssetFor(item);
    if (source && item?.type === TYPES.scene.type && ['sunny-deck', 'sunny-kitchen', 'sunny-library'].includes(item.key)) {
      return `opui://launcher/images/launcher_room/scenes/${item.key}-v2.webp`;
    }
    const key = item?.type === TYPES.character.type ? keyForCharacter(item) : '';
    return source && key ? portraitFor(key) : source;
  };
  const portraitFor = key => key === 'robin' ? 'opui://launcher/images/launcher_room/robin_v2/portrait.webp' : reserved?.assetUrl(key,'portrait.webp') || `opui://launcher/images/launcher_room/portrait_v3/${key}.webp`;
  const isValidProduct = (item, type) => item?.type === type && typeof item.id === 'string' && /^[a-z0-9-]{3,64}$/.test(item.id) && !!assetFor(item) && (type !== TYPES.character.type || releasedCharacterKeys().has(keyForCharacter(item)));
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
      capacityVersion: 2,
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
  let interactionIndex = 0;
  let dialogueIndex = 0;
  const pairHistory = new Map();
  let viewEpoch = 0;
  let walkBlocked = new Set();
  let companionId = '';
  let companionBusy = false;
  let companionTick = 0;
  let companionLineIndex = 0;
  let companionRequest = 0;
  const companionStats = new Map();
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let renderedRevision = -1;
  const lifeRoom = window.OnePieceLifeRoom?.create({
    walkers: () => walkers, profile: () => profile, accountId: () => accountId, isOwner,
    room: activeRoom, layout: () => layoutRoom(activeRoom()), furnitureKey: keyForFurniture,
    spotsAround, cellBlocked, walkBlocked: () => walkBlocked, blockedFor, routeBetween, routeTo,
    face: faceWalker, setPose, startDock: startFurnitureDock, moveDock: moveFurnitureDock,
    speak: showSpeech, hideSpeech, wander: chooseDestination, canAnimate,
    editing: () => editing, reducedMotion: () => motion.matches, roomStatus: status,
    focus: holdCompanionAttention, deferAttentionMovement,
    finishManual(itemId) {
      if (companionId !== itemId) return;
      const walker = walkers.find(entry => entry.item?.id === itemId);
      if (walker) releaseCompanionAttention(walker, false);
      closeCompanion();
    },
    companionId: () => companionId, companionStatus, renderedRevision: () => renderedRevision,
    placeWalker(walker, cell) {
      const anchor = anchorForCell(cell, { width: 1, height: 1 });
      walker.cell = { ...cell }; walker.x = anchor.x; walker.y = anchor.y;
      walker.segmentCell = null; walker.route = []; walker.targetCell = null;
      walker.node.style.left = `${walker.x / WIDTH * 100}%`; walker.node.style.top = `${walker.y / HEIGHT * 100}%`;
      walker.node.dataset.gridCol = String(cell.col); walker.node.dataset.gridRow = String(cell.row);
    },
    restoreWalker(walker, saved) {
      walker.cell = { ...saved.cell }; walker.x = saved.x; walker.y = saved.y;
      walker.segmentCell = saved.segmentCell; walker.route = saved.segmentCell ? [saved.segmentCell] : [];
      if (saved.direction) walker.motion.direction = saved.direction;
      walker.node.style.left = `${walker.x / WIDTH * 100}%`; walker.node.style.top = `${walker.y / HEIGHT * 100}%`;
      walker.node.style.zIndex = String(10 + Math.round(walker.y));
      walker.node.dataset.gridCol = String(walker.cell.col); walker.node.dataset.gridRow = String(walker.cell.row);
    },
    acceptProfile(next) {
      if (!next || next.userId !== profile?.userId) return;
      const changedRoom = JSON.stringify(profile.room) !== JSON.stringify(next.room) || JSON.stringify(profile.releasedCharacterIds) !== JSON.stringify(next.releasedCharacterIds);
      profile = next;
      if (changedRoom && !editing) {
        const epoch = viewEpoch;
        queueMicrotask(() => { if (epoch === viewEpoch && !editing) render(); });
      }
    }
  });

  function status(message = '', error = false) {
    const target = $('roomStatus');
    target.textContent = message;
    target.classList.toggle('is-error', error);
  }
  function isOwner() { return !!profile?.isSelf && accountId > 0 && !preview; }
  function activeRoom() { return editing ? draft : copyRoom(profile?.room); }
  function catalog() { return Array.isArray(shop?.catalog) ? shop.catalog : []; }
  function fromShop(itemId) { return catalog().find(item => item.id === itemId) || null; }
  function releasedCharacterKeys() { return new Set(reserved?.releasedKeys(profile) || CHARACTER_KEYS); }
  function resolvedItem(itemId, kind) {
    const type = TYPES[kind].type;
    if(kind === 'character' && reserved?.RESERVED_KEYS.includes(String(itemId).replace(/^room-character-/,''))) {
      const owned=profile?.life?.ownedCharacterIds || profile?.collection?.launcher?.itemIds || (isOwner()?shop?.owned?.roomCharacters:[]) || [];
      if(!owned.includes(itemId))return null;
    }
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
    const affinity = Math.max(0, Math.min(100, Number(record?.affinity) || 0));
    const canAct = isOwner() && !!record && !companionBusy;
    const portrait = $('roomCompanionPortrait');
    portrait.onerror = () => { portrait.onerror = null; portrait.src = catalogAssetFor(item); };
    portrait.src = key ? portraitFor(key) : assetFor(item);
    $('roomCompanionPortrait').alt = item.name || details.name || '航海夥伴';
    $('roomCompanionName').textContent = item.name || details.name || '航海夥伴';
    $('roomCompanionRole').textContent = record?.role || details.role || '草帽一行人';
    $('roomCompanionDetail').textContent = record?.description || details.detail || '點擊夥伴可以查看相處進度。';
    $('roomCompanionAffinity').textContent = `${affinity} / 100`;
    $('roomCompanionProgress').value = affinity;
    $('roomCompanionActions').hidden = !isOwner();
    $('roomCompanionTalk').disabled = !canAct || (record && (Number(record.talksRemainingToday) <= 0 || Date.parse(record.nextTalkAt) > Date.now()));
    $('roomCompanionTalk').title = record && Date.parse(record.nextTalkAt) > Date.now() ? `下次可聊天：${remainingTime(record.nextTalkAt)}` : '';
    lifeRoom?.renderPanel();
    refreshCompanion();
  }
  // Same interaction model as the lineage extractor: upright icons travel
  // along an arc and settle on one action. Scrolling never performs an action.
  let companionPositionAt = 0;
  let wheelPhase = 0, wheelTarget = 0, wheelFrame = 0, wheelAt = 0, wheelKey = '', wheelDelta = 0, wheelDrag = null, wheelSuppressClick = false;
  const WHEEL_IDS = ['roomCompanionTalk', 'roomLifeWork', 'roomLifeCall', 'roomLifeGift', 'roomLifeTrain', 'roomLifeStatus'];
  function wheelButtons() {
    return WHEEL_IDS.map($).filter(button => button && !button.hidden && (button.id === 'roomCompanionTalk' || !$('roomLifeActions')?.hidden));
  }
  function resetCompanionWheel() {
    cancelAnimationFrame(wheelFrame); wheelFrame = 0; wheelAt = 0; wheelKey = ''; wheelDelta = 0; wheelDrag = null; wheelSuppressClick = false;
    wheelPhase = 0; wheelTarget = 0;
  }
  function renderCompanionWheel() {
    if (!companionId) return;
    const buttons = wheelButtons(), count = buttons.length;
    const key = `${companionId}:${buttons.map(button => button.id).join(',')}`;
    if (key !== wheelKey) { resetCompanionWheel(); wheelKey = key; }
    if (!count) return;
    const selected = ((Math.round(wheelTarget) % count) + count) % count;
    const mirrored = $('roomCompanionPanel').dataset.side === 'left';
    const phase = ((wheelPhase % count) + count) % count;
    for (const [index, button] of buttons.entries()) {
      const offset = ((index - phase + count * 1.5) % count) - count / 2;
      const angle = offset * 40 * Math.PI / 180;
      const onArc = Math.abs(offset) <= 2.22;
      const x = 28 + 108 * Math.cos(angle), y = 136 + 108 * Math.sin(angle);
      const scale = 1 - Math.min(1, Math.abs(offset) / 2.5) * .16;
      button.style.left = `${mirrored ? 188 - x : x}px`; button.style.top = `${y}px`;
      button.style.transform = `translate(-50%, -50%) scale(${scale})`;
      button.style.opacity = onArc ? String(1 - Math.abs(offset) * .13) : '0';
      // Opacity also hides the back slot. Avoid toggling visibility here: Chromium
      // can retain an inherited hidden state on the masked icon when it re-enters.
      button.style.pointerEvents = onArc ? 'auto' : 'none';
      button.tabIndex = onArc ? 0 : -1;
      button.setAttribute('aria-hidden', String(!onArc));
      button.classList.toggle('is-wheel-current', index === selected);
      button.title = button.id === 'roomLifeGift' ? (button.dataset.confirm === 'true' ? '確認送點心：5 枚商城金幣' : '送點心：5 枚商城金幣') : button.textContent;
    }
    const current = buttons[selected];
    $('roomWheelLabel').textContent = current.id === 'roomLifeGift' ? (current.dataset.confirm === 'true' ? '確認送點心' : '點心 · 5金幣') : current.textContent;
    $('roomCompanionWheel').dataset.selectedAction = current.id;
    $('roomCompanionWheel').setAttribute('aria-label', `夥伴互動輪盤，目前${current.textContent}，滾輪或上下方向鍵切換，Enter執行`);
  }
  function animateCompanionWheel(now) {
    wheelFrame = 0;
    if (!companionId || $('roomCompanionPanel').hidden) return;
    const dt = Math.min(40, Math.max(1, now - (wheelAt || now - 16))); wheelAt = now;
    wheelPhase += (wheelTarget - wheelPhase) * (1 - Math.exp(-dt / 65));
    if (motion.matches || Math.abs(wheelTarget - wheelPhase) < .003) { wheelPhase = wheelTarget; wheelAt = 0; }
    renderCompanionWheel();
    if (wheelPhase !== wheelTarget) wheelFrame = requestAnimationFrame(animateCompanionWheel);
  }
  function rotateCompanionWheel(steps) {
    if (!companionId || wheelButtons().length < 2) return;
    wheelTarget += steps;
    if (motion.matches) { wheelPhase = wheelTarget; renderCompanionWheel(); return; }
    if (!wheelFrame) wheelFrame = requestAnimationFrame(animateCompanionWheel);
  }
  function positionCompanion() {
    const panel = $('roomCompanionPanel');
    if (!companionId || panel.hidden) return;
    const actor = [...$('roomCharacters').children].find(node => node.dataset.roomKey === `c:${companionId}`);
    if (!actor || actor.hidden) { panel.style.visibility = 'hidden'; return; }
    const anchor = actor.getBoundingClientRect(), stage = $('roomStage').getBoundingClientRect();
    const clip = $('roomStage').parentElement.getBoundingClientRect(), profileClip = $('roomStage').closest('.voyage-scroll').getBoundingClientRect();
    const width = document.documentElement.clientWidth, height = window.innerHeight, margin = 8;
    const left = Math.max(margin, clip.left), right = Math.min(width - margin, clip.right);
    const top = Math.max(margin, stage.top, profileClip.top), bottom = Math.min(height - margin, stage.bottom, profileClip.bottom);
    if (anchor.right <= left || anchor.left >= right || anchor.bottom <= top || anchor.top >= bottom) { panel.style.visibility = 'hidden'; return; }
    panel.style.visibility = '';
    const scale = Math.min(1, (height - 24) / 272), menuWidth = 188 * scale, menuHeight = 272 * scale;
    panel.style.setProperty('--room-wheel-scale', String(scale));
    panel.style.width = `${menuWidth}px`; panel.style.height = `${menuHeight}px`;
    let x = anchor.right - anchor.width * .13, side = 'right';
    if (x + menuWidth > width - margin) { x = anchor.left + anchor.width * .13 - menuWidth; side = 'left'; }
    x = Math.max(margin, Math.min(width - menuWidth - margin, x));
    const y = Math.max(margin, Math.min(height - menuHeight - margin, anchor.bottom - anchor.height * .3 - menuHeight / 2));
    if (panel.dataset.side !== side) { panel.dataset.side = side; renderCompanionWheel(); }
    panel.style.left = `${Math.round(x)}px`; panel.style.top = `${Math.round(y)}px`;
    const sheet = $('roomCompanionSheet');
    if (!sheet.hidden) {
      sheet.style.maxHeight = `${height - margin * 2}px`;
      const sheetWidth = Math.min(224, width - margin * 2);
      sheet.style.width = `${sheetWidth}px`;
      let sheetX = side === 'right' ? x + menuWidth + 6 : x - sheetWidth - 6;
      sheetX = Math.max(margin, Math.min(width - sheetWidth - margin, sheetX));
      sheet.style.left = `${Math.round(sheetX)}px`;
      sheet.style.top = `${Math.round(Math.max(margin, Math.min(height - sheet.offsetHeight - margin, y + 28)))}px`;
    }
  }
  function refreshCompanion() { renderCompanionWheel(); positionCompanion(); }
  function movementState(walker) {
    return { mode: walker.mode, route: [...walker.route], segmentCell: walker.segmentCell,
      targetCell: walker.targetCell, pause: walker.pause, lifeClip: walker.lifeClip && { ...walker.lifeClip },
      lifeToken: walker.lifeToken, direction: walker.motion?.direction, pose: walker.pose,
      returnDockBeforeRoute: walker.returnDockBeforeRoute, dockTravel: walker.dockTravel };
  }
  function holdCompanionAttention(walker) {
    if (!walker || walker.attention) return;
    walker.attention = { ...movementState(walker), started: performance.now() };
    walker.route = []; walker.segmentCell = null; walker.lifeClip = null; walker.mode = 'focused'; walker.pause = 0;
    walker.node.classList.remove('is-walking', 'is-turning');
    if (walker.motion) { walker.motion.direction = 'south'; walker.motion.pendingDirection = ''; walker.motion.turnUntil = 0; }
    // The loading fallback is the intact front-facing portrait, never the last side/back frame.
    if (!walker.actionArt?.atlases?.south && !walker.motionArt?.atlases?.south) {
      walker.node.querySelector('.room-walk-sprite').hidden = true;
      walker.node.classList.remove('has-directional-sprite');
    }
    walker.node.dataset.direction = 'south';
    hideSpeech(walker); setPose(walker, 'wave'); walker.manualUntil = performance.now() + 1800;
  }
  function deferAttentionMovement(walker) {
    if (!walker.attention) return;
    Object.assign(walker.attention, movementState(walker));
    walker.route = []; walker.segmentCell = null; walker.lifeClip = null; walker.mode = 'focused';
  }
  function releaseCompanionAttention(walker, restore = true) {
    const saved = walker.attention;
    if (!saved) return;
    walker.attention = null; walker.manualUntil = 0; hideSpeech(walker);
    if (!restore) return;
    if (saved.lifeToken && (saved.lifeToken !== walker.lifeToken || !lifeRoom?.isBusy(walker.key))) {
      setPose(walker, 'idle'); chooseDestination(walker); return;
    }
    const held = performance.now() - saved.started;
    for (const name of ['mode', 'route', 'segmentCell', 'targetCell', 'pause', 'lifeClip', 'returnDockBeforeRoute', 'dockTravel']) walker[name] = saved[name];
    if (walker.lifeClip) walker.lifeClip.started += held;
    if (walker.motion) { walker.motion.direction = saved.direction || 'south'; walker.motion.pendingDirection = ''; walker.motion.turnUntil = 0; }
    setPose(walker, saved.pose === 'walk' || saved.pose === 'life' ? 'idle' : saved.pose || 'idle');
    if (walker.mode === 'focused') chooseDestination(walker);
  }
  function closeCompanion() {
    if (companionTick) clearInterval(companionTick);
    companionTick = 0;
    const previous = companionId;
    companionId = '';
    resetCompanionWheel();
    $('roomCompanionSheet').hidden = true;
    companionRequest++;
    companionBusy = false;
    companionStatus('');
    $('roomCompanionPanel').hidden = true;
    $('roomCompanionPanel').classList.remove('show-details');
    lifeRoom?.renderPanel();
    for (const node of $('roomCharacters').children) {
      node.classList.remove('is-companion-selected'); node.setAttribute('aria-expanded', 'false');
    }
    for (const walker of walkers) {
      if (walker.item?.id === previous) releaseCompanionAttention(walker);
    }
  }
  async function openCompanion(itemId, keyboard = false) {
    if (editing || !activeRoom().characters.some(entry => entry.itemId === itemId)) return;
    if (companionId === itemId && companionBusy) { renderCompanionPanel(); return; }
    if (companionId !== itemId) closeCompanion();
    else if (companionTick) clearInterval(companionTick);
    companionId = itemId;
    if (interaction) finishInteraction(performance.now());
    nextInteractionAt = performance.now() + 5000;
    const walker = walkers.find(entry => entry.item?.id === itemId);
    const actor = [...$('roomCharacters').children].find(node => node.dataset.roomKey === `c:${itemId}`);
    if (actor) { actor.classList.add('is-companion-selected'); actor.setAttribute('aria-expanded', 'true'); }
    lifeRoom?.tapped(keyForCharacter(resolvedItem(itemId, 'character')));
    if (walker) { holdCompanionAttention(walker); walker.node.classList.add('is-companion-selected'); }
    renderCompanionPanel();
    if (keyboard) $('roomCompanionWheel').focus({ preventScroll: true });
    companionTick = setInterval(renderCompanionPanel, 1000);
    if (!isOwner() || typeof api.getLauncherCharacter !== 'function') return;
    const epoch = viewEpoch; const ownerId = accountId; const request = ++companionRequest;
    try {
      const result = await api.getLauncherCharacter(itemId);
      if (epoch !== viewEpoch || ownerId !== accountId || companionId !== itemId || request !== companionRequest || !isOwner()) return;
      if (result?.ok && result.character) { companionStats.set(itemId, result.character); renderCompanionPanel(); }
      else companionStatus('目前無法更新夥伴資料，請稍後再試。', true);
    } catch { if (epoch === viewEpoch && companionId === itemId) companionStatus('目前無法連線，請稍後再試。', true); }
  }
  const COMPANION_ERRORS = {
    client_update_required: '請更新啟動器後再使用這位夥伴；原有配置與工作會保留。', character_not_released: '這位夥伴尚未開放。',
    talk_cooldown: '這位夥伴剛聊過天，稍後再來。', talk_daily_limit: '今天的聊天次數已用完。',
    not_placed: '這位夥伴已離開房間，請重新整理。', not_owned: '這位夥伴尚未收藏。'
  };
  async function performCompanionTalk() {
    if (!isOwner() || !companionId || companionBusy || !companionRecord(companionId)) return;
    const itemId = companionId;
    const epoch = viewEpoch;
    const request = companionRequest;
    companionBusy = true;
    companionStatus('正在與夥伴互動…');
    renderCompanionPanel();
    try {
      const result = await api.interactLauncherCharacter(itemId, 'talk');
      if (epoch !== viewEpoch || request !== companionRequest || itemId !== companionId) return;
      if (result?.character) companionStats.set(itemId, result.character);
      if (!result?.ok) {
        companionStatus(COMPANION_ERRORS[result?.error] || '互動未完成，請稍後再試。', true);
        renderCompanionPanel(); return;
      }
      if (result.wallet) window.LauncherProfileShop?.onCompanionWalletChanged?.(result.wallet);
      if (interaction) finishInteraction(performance.now());
      nextInteractionAt = performance.now() + 5000;
      const walker = walkers.find(entry => entry.item?.id === itemId);
      const key = walker?.key || keyForCharacter(resolvedItem(itemId, 'character'));
      if (lifeRoom?.active()) lifeRoom.cancel(key);
      const beat = dialogue?.interactionBeat?.(key, 'bond', companionLineIndex);
      const lines = beat ? [beat.line, beat.mood] : dialogue?.interaction?.(key, 'bond', companionLineIndex) ||
        ['下次再來聊天吧！', 'happy'];
      companionLineIndex++;
      if (walker && (walker.mode === 'focused' || lifeRoom?.active())) {
        showSpeech(walker, lines[0], lines[1], '親密度 +2');
        if (beat?.pose) setPose(walker, beat.pose);
        walker.manualUntil = performance.now() + 3500;
      }
      companionStatus('聊天完成，親密度增加 2。');
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
    lifeRoom?.suspend();
    if (animationId) cancelAnimationFrame(animationId);
    animationId = 0;
    lastFrame = 0;
    for (const walker of walkers) {
      walker.node.classList.remove('is-walking', 'is-interacting', 'is-conversing', 'is-using-furniture', 'is-turning');
      const speech = walker.node.querySelector('.room-speech');
      if (speech) speech.hidden = true;
      delete walker.node.dataset.sceneId; delete walker.node.dataset.sceneTurn;
      delete walker.node.dataset.listener; delete walker.node.dataset.reaction;
      setPose(walker, 'idle');
    }
    recordSceneEnd(interaction, performance.now());
    walkers = [];
    interaction = null;
    nextInteractionAt = 0;
  }
  function canAnimate() { return visible && !editing && !!profile && !document.hidden && !motion.matches; }
  function setPose(walker, pose) {
    const next = POSES.has(pose) ? pose : 'idle';
    if (walker.pose !== next || !Number.isFinite(walker.poseStartedAt)) walker.poseStartedAt = performance.now();
    if (showAction(walker, next)) { walker.pose = next; walker.node.dataset.pose = next; return; }
    if (next === 'idle' && showMotion(walker, false)) {
      walker.pose = next; walker.node.dataset.pose = next; return;
    }
    // Keep a previously decoded whole figure while the requested direction loads.
    // Loading must never reintroduce the retired cutout poses.
    walker.pose = next; walker.node.dataset.pose = next;
    if (!walker.node.classList.contains('has-directional-sprite')) {
      walker.node.dataset.actionSource = 'loading';
      // portrait_v3 is also an intact new drawing. Keep it visible when loading
      // is interrupted or reduced motion prevents creation of another walker.
    }
  }
  function showAction(walker, pose, now = performance.now()) {
    const atlas = walker.actionArt?.atlases?.[walker.motion?.direction];
    const frame = locomotion?.actionFrame(pose, now - (walker.poseStartedAt || now)) ?? -1;
    const canvas = walker.node.querySelector('.room-walk-sprite');
    if (!atlas || frame < 0 || !locomotion.draw(canvas, atlas, frame, locomotion.ACTION_SHAPE)) return false;
    const root = locomotion.metadata(walker.key, motionTable).root;
    canvas.style.setProperty('--room-root-offset', `${(locomotion.SHAPE.cell - root[1]) / locomotion.SHAPE.cell * 100}%`);
    canvas.hidden = false; walker.node.classList.add('has-directional-sprite');
    walker.node.dataset.directionalAction = 'true'; walker.node.dataset.actionSource = 'acting_v4';
    walker.node.dataset.direction = walker.motion.direction;
    walker.node.dataset.actionFrame = String(frame);
    return true;
  }
  function showMotion(walker, walking) {
    const state = walker.motion;
    const atlas = walker.motionArt?.atlases?.[state?.direction];
    if (!locomotion || !atlas) return false;
    const canvas = walker.node.querySelector('.room-walk-sprite');
    const frame = walking ? state.frame : locomotion.metadata(walker.key, motionTable).standingFrame;
    const shape = locomotion.walkShape(state.direction);
    // Every frame is an intact authored body. Room perspective moves the root;
    // it never warps legs or draws a separately oriented head.
    if (!locomotion.draw(canvas, atlas, frame, shape)) return false;
    const root = locomotion.metadata(walker.key, motionTable).root;
    canvas.style.setProperty('--room-root-offset', `${(locomotion.SHAPE.cell - root[1]) / locomotion.SHAPE.cell * 100}%`);
    canvas.hidden = false;
    walker.node.classList.add('has-directional-sprite');
    walker.node.dataset.direction = state.direction;
    walker.node.dataset.motionFrame = String(frame);
    walker.node.dataset.motionPhase = String(state.phase);
    walker.node.dataset.motionReady = 'true';
    walker.node.dataset.actionSource = 'motion_v4';
    delete walker.node.dataset.directionalAction;
    if (walking) { walker.pose = 'walk'; walker.node.dataset.pose = 'walk'; }
    return true;
  }
  function faceWalker(walker, targetCell, now) {
    if (!locomotion || !walker.motion) return true;
    const direction = locomotion.directionForDelta(targetCell.col - walker.cell.col, targetCell.row - walker.cell.row, walker.motion.direction);
    const ready = !!walker.motionArt?.atlases?.[direction];
    const settled = locomotion.face(walker.motion, direction, now, ready);
    walker.node.classList.toggle('is-turning', ready && !settled);
    if (ready) showMotion(walker, false);
    return settled;
  }
  function cellBlocked(cell, blocked) {
    return cell.col < 0 || cell.row < 0 || cell.col >= FLOOR.columns || cell.row >= FLOOR.rows || blocked.has(cellId(cell.col, cell.row));
  }
  function blockedFor(walker, exempt = []) {
    const blocked = new Set(walkBlocked);
    for (const lease of lifeRoom?.reservations() || []) {
      if (lease.key !== walker.key && !exempt.some(other => other.key === lease.key) && lease.cell)
        blocked.add(cellId(lease.cell.col, lease.cell.row));
    }
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
    const origin = walker.segmentCell || walker.cell;
    const route = routeBetween(origin, goal, blockedFor(walker, exempt));
    if (!route) return false;
    walker.route = walker.segmentCell ? [walker.segmentCell, ...route] : route; walker.targetCell = goal;
    if (walker.dockOrigin) walker.returnDockBeforeRoute = true;
    return true;
  }
  function chooseDestination(walker) {
    if (walker.attention) return;
    if (walker.dockOrigin) { walker.mode = 'undock'; walker.route = []; walker.pause = 0; return; }
    walker.mode = 'wander'; walker.route = []; walker.targetCell = null;
    const origin = walker.segmentCell || walker.cell;
    const options = [];
    for (let row = Math.max(0, origin.row - 3); row <= Math.min(FLOOR.rows - 1, origin.row + 3); row++) {
      for (let col = Math.max(0, origin.col - 4); col <= Math.min(FLOOR.columns - 1, origin.col + 4); col++) {
        const distance = Math.abs(col - origin.col) + Math.abs(row - origin.row);
        if (distance >= 1 && distance <= 4) options.push({ col, row });
      }
    }
    options.sort(() => Math.random() - .5);
    for (const candidate of options) {
      const route = routeBetween(origin, candidate, blockedFor(walker));
      if (!route) continue;
      walker.route = walker.segmentCell ? [walker.segmentCell, ...route] : route; walker.targetCell = candidate; break;
    }
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
    delete walker.node.dataset.listener;
    delete walker.node.dataset.reaction;
  }
  function showSpeech(walker, message, mood, action = '', usingFurniture = false, furnitureKey = '') {
    for (const other of walkers) hideSpeech(other);
    const speech = walker.node.querySelector('.room-speech');
    if (!speech) return;
    speech.querySelector('.room-speech-text').textContent = message;
    const actionNode = speech.querySelector('.room-speech-action');
    const actionLabel = dialogue?.ACTION_LABELS?.[action] || (/[^\u0000-\u007f]/.test(action) ? action : '');
    actionNode.textContent = actionLabel;
    actionNode.hidden = !actionLabel;
    speech.dataset.mood = MOODS.has(mood) ? mood : 'happy';
    speech.hidden = false;
    walker.node.classList.add('is-interacting', usingFurniture ? 'is-using-furniture' : 'is-conversing');
    // These furniture images have no chair or bench: keep both feet on the floor.
    const pose = usingFurniture ? 'focused_use'
      : mood === 'annoyed' ? 'talk_annoyed' : mood === 'surprised' ? 'surprised' : mood === 'focused' ? 'focused_use' : 'talk_happy';
    setPose(walker, pose);
  }
  function sceneFor(first, second, now) {
    const pair = [first.key, second.key].sort().join(':');
    const history = pairHistory.get(pair) || { cursor: 0, until: 0, lastId: '' };
    if (now < history.until) return null;
    // Only nearby placed objects may provide a conversation's physical context.
    const furnitureKeys = [...layoutRoom(activeRoom()).placements.values()].filter(placed => placed.kind === 'furniture' &&
      Math.min(Math.hypot(placed.anchor.x - first.x, placed.anchor.y - first.y), Math.hypot(placed.anchor.x - second.x, placed.anchor.y - second.y)) <= 170
    ).map(placed => keyForFurniture(placed.item));
    const scene = dialogue?.scene?.(first.key, second.key, history.cursor, {
      furnitureKey: furnitureKeys.find(key => dialogue?.profile?.(first.key)?.favorite?.includes(key)) || furnitureKeys[0] || '',
      availableFurnitureKeys: furnitureKeys,
      recentSceneIds: history.recentIds || []
    });
    if (!scene || !Array.isArray(scene.turns) || scene.turns.length < 4 ||
        !scene.turns.every(turn => [first.key, second.key].includes(turn.speaker) && typeof turn.line === 'string')) return null;
    return { ...scene, pair, cursor: history.cursor };
  }
  function spotsAround(target) {
    // The keyboard and table work surface must be approached from their front,
    // opposite the piano back or the table bench. Saved furniture
    // cells stay unchanged; the actor routes to a free floor cell by the keys.
    if (['piano', 'kitchen-table', 'galley-stove', 'helm', 'map-table', 'tool-bench', 'medicine-cabinet', 'bookshelf'].includes(keyForFurniture(target.item))) {
      const middleCol = target.cell.col + Math.floor((target.span.width - 1) / 2);
      const middleRow = target.cell.row + Math.floor((target.span.height - 1) / 2);
      return [[{ col: middleCol, row: target.cell.row + target.span.height }],
        [{ col: target.cell.col - 1, row: middleRow }],
        [{ col: middleCol, row: target.cell.row - 1 }],
        [{ col: target.cell.col + target.span.width, row: middleRow }]][rotationFor(target.entry)];
    }
    const spots = [];
    for (let col = target.cell.col; col < target.cell.col + target.span.width; col++) {
      spots.push({ col, row: target.cell.row - 1 }, { col, row: target.cell.row + target.span.height });
    }
    for (let row = target.cell.row; row < target.cell.row + target.span.height; row++) {
      spots.push({ col: target.cell.col - 1, row }, { col: target.cell.col + target.span.width, row });
    }
    return spots;
  }
  function furnitureDock(walker, target) {
    const key = keyForFurniture(target?.item);
    if (!['piano', 'kitchen-table', 'galley-stove', 'helm', 'map-table', 'tool-bench', 'medicine-cabinet', 'bookshelf'].includes(key)) return null;
    const depth = locomotion.projectedScale(target.anchor.y, FLOOR);
    const side = ['north', 'east', 'south', 'west'][rotationFor(target.entry)];
    // Coordinates follow the actual tabletop / keyboard in the four GPT views.
    // The approach cell and persisted footprint stay reserved and unchanged.
    const offsets = key === 'helm'
      ? {north:[-12,-9],south:[0,-18],east:[-24,-12],west:[24,-12]}
      : ['medicine-cabinet','bookshelf'].includes(key)
        ? {north:[-18,6],south:[-38,-5],east:[-26,-2],west:[26,-2]}
        : ['map-table','tool-bench'].includes(key)
          ? {north:[0,6],south:[0,-7],east:[-26,-5],west:[26,-5]}
          : { north: [0, 4], south: [0, key === 'galley-stove' ? -6 : -27], east: [key === 'piano' ? -24 : -30, -8], west: [key === 'piano' ? 24 : 30, -8] };
    const [dx, dy] = offsets[side];
    // Both drawings retain their former 75 * depth visible scale. Their old
    // 94% translation / 95% origin placed the ground below the grid anchor;
    // shift the actor by that same amount when aligning the drawing's ground.
    const priorGroundOffset = 75 * .01 + depth * (75 * FURNITURE_GROUND_ROOT[1] / FURNITURE_CANVAS - 75 * .95);
    return { x: target.anchor.x + dx * depth * ROOM_ART_SCALE, y: target.anchor.y + (dy * depth - priorGroundOffset) * ROOM_ART_SCALE,
      z: Math.round(target.anchor.y) + (side === 'south' ? 9 : 11), side };
  }
  function startFurnitureDock(walker, target) {
    const dock = furnitureDock(walker, target);
    if (!dock) return null;
    if (!walker.dockOrigin) walker.dockOrigin = { x: walker.x, y: walker.y };
    walker.dockTarget = dock;
    return dock;
  }
  function moveFurnitureDock(walker, target, now, delta) {
    const dx = target.x - walker.x, dy = target.y - walker.y;
    if (Math.abs(dx) < .05 && Math.abs(dy) < .05) {
      walker.dockTravel = false; walker.node.classList.remove('is-walking'); setPose(walker, 'idle');
      if (Number.isFinite(target.z)) walker.node.style.zIndex = String(target.z);
      return true;
    }
    // Finish one ground axis before the next, with the same planted turn and
    // distance-driven gait as a normal route; no sprite teleport or tween slide.
    const horizontal = Math.abs(dx) >= .05;
    const amount = horizontal ? dx : dy;
    const facing = { col: walker.cell.col + (horizontal ? Math.sign(amount) : 0), row: walker.cell.row + (horizontal ? 0 : Math.sign(amount)) };
    if (!faceWalker(walker, facing, now)) { setPose(walker, 'idle'); return false; }
    const scale = locomotion.projectedScale(walker.y, FLOOR);
    const gait = scaledGait(walker.key, walker.motion.direction, scale);
    const travel = Math.min(Math.abs(amount), delta / 1000 * gait.speed);
    if (horizontal) walker.x += Math.sign(amount) * travel; else walker.y += Math.sign(amount) * travel;
    walker.node.style.left = `${walker.x / WIDTH * 100}%`; walker.node.style.top = `${walker.y / HEIGHT * 100}%`;
    walker.node.style.zIndex = String(Number.isFinite(target.z) ? target.z : 10 + Math.round(walker.y));
    walker.node.style.setProperty('--room-character-scale', String(ROOM_ART_SCALE * scale / 1.07 * locomotion.metadata(walker.key, motionTable).displayScale));
    keepSpeechInsideStage(walker);
    walker.dockTravel = true; walker.node.classList.add('is-walking');
    locomotion.advance(walker.motion, travel, gait.stride, { ready: true }); showMotion(walker, true);
    return false;
  }
  function startInteraction(now) {
    if (interaction || !walkers.length || now < nextInteractionAt) return;
    const available = walkers.filter(walker => walker.mode === 'wander' && walker.item?.id !== companionId);
    const stationary = available.filter(walker => !walker.segmentCell &&
      Math.hypot(walker.x - anchorForCell(walker.cell, { width: 1, height: 1 }).x,
        walker.y - anchorForCell(walker.cell, { width: 1, height: 1 }).y) < 1);
    if (!available.length) { nextInteractionAt = now + 2500; return; }
    if (!stationary.length) { nextInteractionAt = now + 200; return; }
    const furnishings = activeRoom().placements
      .map(entry => ({ entry, item: resolvedItem(entry.itemId, 'furniture') }))
      .filter(value => value.item);
    const first = stationary[interactionIndex % stationary.length];
    const activityTargets = furnishings.map(target => ({ ...target,
      beat: dialogue?.activity?.(first.key, keyForFurniture(target.item), dialogueIndex) }))
      .filter(target => target.beat?.speaker === first.key && typeof target.beat?.line === 'string');
    const chat = available.length > 1 && (!activityTargets.length || interactionIndex % 2 === 0);
    if (chat) {
      const partners = available.filter(walker => walker !== first);
      const second = partners[interactionIndex % partners.length];
      if (!beginChat(first, second, now)) { nextInteractionAt = now + 1800; interactionIndex++; return; }
    } else if (activityTargets.length) {
      const target = activityTargets[interactionIndex % activityTargets.length];
      const variation = target.beat;
      const targetLayout = layoutRoom(activeRoom()).placements.get(`f:${target.entry.itemId}`);
      if (!targetLayout) { nextInteractionAt = now + 1600; interactionIndex++; return; }
      const spots = spotsAround(targetLayout);
      spots.sort((a, b) => Math.abs(a.col - first.cell.col) + Math.abs(a.row - first.cell.row) - Math.abs(b.col - first.cell.col) - Math.abs(b.row - first.cell.row));
      const adjacent = spots.find(cell => routeTo(first, cell));
      if (!adjacent) { nextInteractionAt = now + 1600; interactionIndex++; return; }
      first.pause = 0; first.mode = 'approach';
      interaction = { type: 'furniture', actors: [first], furnitureKey: keyForFurniture(target.item),
        target: targetLayout, line: variation.line, mood: variation.mood,
        action: variation.verb, pose: variation.pose,
        phase: 'approach', expires: now + approachDuration(first), holdUntil: 0 };
    } else {
      nextInteractionAt = now + 3000;
    }
    interactionIndex++;
  }
  function beginChat(first, second, now) {
    const scene = sceneFor(first, second, now);
    if (!scene) return false;
    const adjacent = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dc, dr]) => ({ col: first.cell.col + dc, row: first.cell.row + dr }))
      .filter(cell => !cellBlocked(cell, blockedFor(second)))
      .sort((a, b) => Math.abs(a.col - second.cell.col) + Math.abs(a.row - second.cell.row) - Math.abs(b.col - second.cell.col) - Math.abs(b.row - second.cell.row));
    if (!adjacent.some(cell => routeTo(second, cell))) return false;
    first.route = []; first.targetCell = first.cell; first.pause = 0;
    if (first.dockOrigin) first.returnDockBeforeRoute = true;
    second.pause = 0; first.mode = 'approach'; second.mode = 'approach';
    setPose(first, 'wave');
    interaction = { type: 'chat', actors: [first, second], scene, turnIndex: -1, phase: 'approach', expires: now + approachDuration(second), holdUntil: 0 };
    return true;
  }
  function approachDuration(walker) {
    // Budget the actual reserved route at the slowest perspective scale.
    // A small character must not abandon a valid approach after a fixed 20 s.
    let x = walker.x, y = walker.y, milliseconds = 5000;
    for (const cell of walker.route) {
      const next = anchorForCell(cell, { width: 1, height: 1 });
      const dx = next.x - x, dy = next.y - y;
      const direction = locomotion.directionForDelta(dx, dy);
      const speed = locomotion.speedAndStride(walker.key, direction, .72, motionTable).speed;
      milliseconds += (direction === 'north' || direction === 'south' ? Math.abs(dy) : Math.abs(dx)) / speed * 1000 + 250;
      x = next.x; y = next.y;
    }
    return Math.max(20000, milliseconds);
  }
  function finishInteraction(now) {
    if (!interaction) return;
    recordSceneEnd(interaction, now);
    for (const walker of interaction.actors) {
      hideSpeech(walker); delete walker.node.dataset.sceneId; delete walker.node.dataset.sceneTurn;
      walker.node.classList.remove('is-turning'); setPose(walker, 'idle'); chooseDestination(walker);
    }
    interaction = null;
    dialogueIndex++;
    nextInteractionAt = now + 4200 + Math.random() * 2100;
  }
  function recordSceneEnd(event, now) {
    if (!event?.scene || event.turnIndex < 0) return;
    const scene = event.scene;
    const recentIds = [...(pairHistory.get(scene.pair)?.recentIds || []), scene.id].slice(-3);
    pairHistory.set(scene.pair, { cursor: scene.cursor + 1, lastId: scene.id, recentIds,
      until: now + Math.max(15000, Number(scene.cooldownMs) || 45000) });
  }
  function playSceneTurn(event, now) {
    const turn = event.scene.turns[event.turnIndex];
    if (!turn) { finishInteraction(now); return; }
    const speaker = event.actors.find(actor => actor.key === turn.speaker);
    const listener = event.actors.find(actor => actor !== speaker);
    if (!speaker || !listener) { finishInteraction(now); return; }
    showSpeech(speaker, turn.line, turn.mood, turn.action || '和夥伴交談');
    if (POSES.has(turn.pose)) setPose(speaker, turn.pose);
    const reaction = turn.listener?.key === listener.key ? turn.listener : null;
    listener.node.classList.add('is-interacting');
    listener.node.dataset.listener = speaker.key;
    listener.node.dataset.reaction = dialogue?.ACTION_LABELS?.[reaction?.action] || '聆聽';
    setPose(listener, reaction?.action === 'listen' ? 'listen' : POSES.has(reaction?.pose) ? reaction.pose : reaction?.mood === 'surprised' ? 'surprised' : 'idle');
    for (const actor of event.actors) {
      actor.node.dataset.sceneId = event.scene.id;
      actor.node.dataset.sceneTurn = String(event.turnIndex);
    }
    event.holdUntil = now + Math.max(2200, Math.min(7000, Number(turn.durationMs) || 2200 + turn.line.length * 65));
  }
  function updateInteraction(now, delta) {
    const event = interaction;
    if (!event) return;
    if (event.phase === 'approach') {
      const arrived = event.actors.every(walker => !walker.route.length && !walker.returnDockBeforeRoute);
      if (!arrived && now < event.expires) return;
      if (!arrived) { finishInteraction(now); return; }
      if (event.type === 'chat') {
        // Both actors have arrived: use this location, not their pre-walk props.
        event.scene = sceneFor(event.actors[0], event.actors[1], now);
        if (!event.scene) { finishInteraction(now); return; }
      }
      event.phase = event.type === 'furniture' && startFurnitureDock(event.actors[0], event.target) ? 'docking' : 'turning';
      for (const walker of event.actors) { walker.mode = 'interact'; walker.node.classList.remove('is-walking'); }
    }
    if (event.phase === 'docking') {
      if (!moveFurnitureDock(event.actors[0], event.actors[0].dockTarget, now, delta)) return;
      event.phase = 'turning';
    }
    if (event.phase === 'turning') {
      let settled = true;
      if (event.type === 'chat') {
        for (const actor of event.actors) {
          const other = event.actors.find(value => value !== actor);
          if (!faceWalker(actor, other.cell, now)) settled = false;
        }
        if (!settled) { if (now >= event.expires) finishInteraction(now); return; }
        event.phase = 'speaking'; event.turnIndex = 0; playSceneTurn(event, now);
      } else {
        const target = { col: event.target.cell.col + event.target.span.width / 2 - .5,
          row: event.target.cell.row + event.target.span.height / 2 - .5 };
        if (!faceWalker(event.actors[0], target, now)) { if (now >= event.expires) finishInteraction(now); return; }
        event.phase = 'speaking'; event.holdUntil = now + 3600;
        showSpeech(event.actors[0], event.line, event.mood, event.action, true, event.furnitureKey);
        if (event.pose) setPose(event.actors[0], event.pose);
      }
      return;
    }
    if (now < event.holdUntil) return;
    if (event.type === 'chat') {
      event.turnIndex++; playSceneTurn(event, now);
    } else finishInteraction(now);
  }
  function frame(now) {
    animationId = 0;
    if (!canAnimate()) return;
    const delta = Math.min(50, lastFrame ? now - lastFrame : 16);
    lastFrame = now;
    lifeRoom?.tick(now);
    if (!lifeRoom?.active()) startInteraction(now);
    for (const walker of walkers) {
      if (walker.attention) {
        walker.mode = 'focused'; walker.node.classList.remove('is-walking', 'is-turning');
        if (walker.motion) { walker.motion.direction = 'south'; walker.motion.pendingDirection = ''; walker.motion.turnUntil = 0; }
        if (walker.manualUntil && now >= walker.manualUntil) { hideSpeech(walker); setPose(walker, 'idle'); walker.manualUntil = 0; }
        showAction(walker, walker.pose === 'walk' || walker.pose === 'life' ? 'idle' : walker.pose || 'idle', now);
        continue;
      }
      if (lifeRoom?.animate(walker, now, delta)) continue;
      if (walker.pose !== 'walk') showAction(walker, walker.pose || 'idle', now);
      if (walker.returnDockBeforeRoute) {
        if (moveFurnitureDock(walker, walker.dockOrigin, now, delta)) {
          walker.dockOrigin = null; walker.dockTarget = null; walker.returnDockBeforeRoute = false;
        }
        continue;
      }
      if (walker.mode === 'interact') continue;
      if (walker.mode === 'undock') {
        if (moveFurnitureDock(walker, walker.dockOrigin, now, delta)) { walker.dockOrigin = null; walker.dockTarget = null; walker.returnDockBeforeRoute = false; chooseDestination(walker); }
        continue;
      }
      if (walker.mode === 'focused') {
        if (walker.manualUntil && now >= walker.manualUntil) {
          hideSpeech(walker); setPose(walker, 'idle'); walker.manualUntil = 0;
        }
        continue;
      }
      if (walker.pause > 0 && walker.mode === 'wander') {
        walker.pause -= delta;
        walker.node.classList.remove('is-walking'); setPose(walker, 'idle'); continue;
      }
      if (!walker.route.length) {
        walker.node.classList.remove('is-walking');
        if (walker.mode === 'wander' && !lifeRoom?.isBusy(walker.key)) chooseDestination(walker);
        continue;
      }
      const nextCell = walker.route[0];
      if (walkers.some(other => other !== walker && ((other.cell.col === nextCell.col && other.cell.row === nextCell.row) ||
          (other.route?.[0]?.col === nextCell.col && other.route?.[0]?.row === nextCell.row && other.key < walker.key)))) {
        walker.blockedFor = (walker.blockedFor || 0) + delta;
        if (walker.blockedFor > 900 && walker.mode === 'wander') chooseDestination(walker);
        else if (walker.blockedFor > 1000 && walker.mode === 'approach' && walker.targetCell) {
          routeTo(walker, walker.targetCell); walker.blockedFor = 0;
        }
        walker.node.classList.remove('is-walking'); setPose(walker, 'idle'); continue;
      }
      walker.blockedFor = 0;
      const direction = locomotion?.directionForDelta(nextCell.col - walker.cell.col, nextCell.row - walker.cell.row, walker.motion?.direction);
      const decoded = !!walker.motionArt?.atlases?.[direction];
      if (!decoded || !faceWalker(walker, nextCell, now)) {
        walker.node.classList.remove('is-walking'); setPose(walker, 'idle');
        walker.node.dataset.motionReady = String(decoded); continue;
      }
      const target = anchorForCell(nextCell, { width: 1, height: 1 });
      walker.segmentCell = nextCell;
      const dx = target.x - walker.x;
      const dy = target.y - walker.y;
      const scale = locomotion.projectedScale(walker.y, FLOOR);
      const gait = scaledGait(walker.key, direction, scale);
      const step = locomotion.pathStep(dx, dy, direction, delta / 1000 * gait.speed);
      if (step.reached) {
        walker.x = target.x; walker.y = target.y; walker.cell = nextCell; walker.route.shift(); walker.segmentCell = null;
        walker.node.dataset.gridCol = String(nextCell.col); walker.node.dataset.gridRow = String(nextCell.row);
      } else { walker.x += step.dx; walker.y += step.dy; }
      walker.node.style.left = `${walker.x / WIDTH * 100}%`;
      walker.node.style.top = `${walker.y / HEIGHT * 100}%`;
      walker.node.style.zIndex = String(10 + Math.round(walker.y));
      walker.node.style.setProperty('--room-depth', String(locomotion.projectedScale(walker.y, FLOOR)));
      walker.node.style.setProperty('--room-character-scale', String(ROOM_ART_SCALE * locomotion.projectedScale(walker.y, FLOOR) / 1.07 * locomotion.metadata(walker.key, motionTable).displayScale));
      keepSpeechInsideStage(walker);
      walker.node.classList.add('is-walking');
      locomotion.advance(walker.motion, step.travel, gait.stride, { ready: decoded });
      showMotion(walker, true);
      if (!walker.route.length) {
        walker.node.classList.remove('is-walking');
        setPose(walker, 'idle');
      }
    }
    updateInteraction(now, delta);
    if (now - companionPositionAt >= 32) { positionCompanion(); companionPositionAt = now; }
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
        pause: Math.random() * 350, route: [], targetCell: null, mode: 'wander', pose: '',
        motion: locomotion?.createState(), motionArt: locomotion?.preload(keyForCharacter(item)),
        actionArt: locomotion?.preloadActions(keyForCharacter(item)) };
      keepSpeechInsideStage(walker);
      walkers.push(walker);
      setPose(walker, 'idle');
      walker.motionArt?.promise.then(() => {
        if (walkers.includes(walker) && walker.pose === 'idle') setPose(walker, 'idle');
      });
      walker.actionArt?.promise.then(() => {
        if (walkers.includes(walker) && walker.pose !== 'walk') setPose(walker, walker.pose);
      });
    }
    for (const walker of walkers) {
      chooseDestination(walker);
    }
    lifeRoom?.resume();
    for (const walker of walkers) if (walker.item?.id === companionId) { holdCompanionAttention(walker); walker.node.classList.add('is-companion-selected'); }
    if (walkers.length) { nextInteractionAt = performance.now() + 1800; animationId = requestAnimationFrame(frame); }
  }
  function scaledGait(key, direction, depth) {
    const gait = locomotion.speedAndStride(key, direction, depth, motionTable);
    // Keep the same cadence and planted stride when the complete figure grows.
    return { speed: gait.speed * ROOM_ART_SCALE, stride: gait.stride * ROOM_ART_SCALE };
  }
  function positionNode(node, placed) {
    const { entry, kind, span, anchor, cell } = placed;
    const bodyScale = kind === 'character' ? locomotion?.metadata?.(keyForCharacter(placed.item), motionTable)?.displayScale || 1 : 1;
    if (kind === 'character') node.style.setProperty('--room-character-body-scale', String(ROOM_ART_SCALE * bodyScale));
    if (kind === 'character') {
      // The intact static portrait shares the atlas ground root. Its image box
      // is 96×135 stage pixels, while its contained square is 96×96; compensate
      // the transparent pixels below the feet just as the walk canvas does.
      const rootY = locomotion?.metadata?.(keyForCharacter(placed.item), motionTable)?.root?.[1] || 112;
      const cellSize = locomotion?.SHAPE?.cell || 128;
      const portrait = node.querySelector('.room-chibi');
      if (portrait) portrait.style.transform = `translateY(${WIDTH * .1 / (HEIGHT * .25) * (1 - rootY / cellSize) * 100}%)`;
    }
    node.style.left = `${anchor.x / WIDTH * 100}%`;
    node.style.top = `${anchor.y / HEIGHT * 100}%`;
    node.style.zIndex = String(10 + Math.round(anchor.y));
    node.style.setProperty('--room-depth', String(round(.72 + .35 * (anchor.y - FLOOR.top) / (FLOOR.bottom - FLOOR.top))));
    if (kind === 'character') node.style.setProperty('--room-character-scale', String(ROOM_ART_SCALE * (.72 + .35 * (anchor.y - FLOOR.top) / (FLOOR.bottom - FLOOR.top)) / 1.07 * bodyScale));
    node.dataset.gridCol = String(cell.col); node.dataset.gridRow = String(cell.row);
    node.dataset.footprint = `${span.width}x${span.height}`;
    if (kind === 'furniture') {
      const size = ROOM_ART_SCALE * (FURNITURE_VISUALS[keyForFurniture(placed.item)] || 80);
      const depth = locomotion?.projectedScale?.(anchor.y, FLOOR) || .72 + .35 * (anchor.y - FLOOR.top) / (FLOOR.bottom - FLOOR.top);
      node.style.setProperty('--room-size', String(depth / 1.07));
      node.style.setProperty('--room-width', `${size / WIDTH * 100}%`);
      node.style.setProperty('--room-furniture-root-offset', `${(FURNITURE_CANVAS - FURNITURE_GROUND_ROOT[1]) / FURNITURE_CANVAS * 100}%`);
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
    renderedRevision = room.revision;
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
      const walkSprite = el('canvas', 'room-walk-sprite');
      walkSprite.width = 256; walkSprite.height = 256; walkSprite.hidden = true; walkSprite.setAttribute('aria-hidden', 'true');
      const speech = el('div', 'room-speech'); speech.hidden = true;
      speech.setAttribute('role', 'status'); speech.setAttribute('aria-live', 'polite');
      speech.append(el('span', 'room-speech-text'), el('small', 'room-speech-action'));
      node.append(sprite, walkSprite, speech);
      node.dataset.roomKey = `c:${entry.itemId}`;
      node.tabIndex = 0;
      node.setAttribute('role', 'button');
      node.setAttribute('aria-haspopup', 'dialog');
      node.setAttribute('aria-controls', 'roomCompanionPanel');
      node.setAttribute('aria-expanded', String(!editing && companionId === entry.itemId));
      node.setAttribute('aria-label', `查看${item.name || '夥伴'}的詳情與互動`);
      node.onclick = () => { if (!editing) openCompanion(entry.itemId); };
      node.onkeydown = event => {
        if (editing || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault(); openCompanion(entry.itemId, true);
      };
      node.classList.toggle('is-selected', !!selected && selected.kind === 'character' && selected.itemId === entry.itemId);
      node.classList.toggle('is-companion-selected', !editing && companionId === entry.itemId);
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
      if (!result?.ok || !result.shop) { status(COMPANION_ERRORS[result?.error] || '商品無法讀取，請稍後再試。', true); return; }
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
        status(COMPANION_ERRORS[result?.error] || (result?.error === 'revision_conflict' ? '房間已在其他裝置變更。請取消這次編輯，再重新佈置。' : '房間未儲存，請稍後再試。'), true);
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
    const sameRoom = !changedOwner && JSON.stringify(profile?.room) === JSON.stringify(nextProfile?.room) && JSON.stringify(profile?.releasedCharacterIds) === JSON.stringify(nextProfile?.releasedCharacterIds);
    if (changedOwner) viewEpoch++;
    if (changedOwner) { closeCompanion(); companionStats.clear(); pairHistory.clear(); }
    profile = nextProfile || null; accountId = nextAccount; preview = nextPreview;
    if (changedOwner || !isOwner()) {
      editing = false; dirty = false; selected = null; shop = null; drag = null;
      draft = copyRoom(profile?.room); status('');
    } else if (!editing) draft = copyRoom(profile?.room);
    lifeRoom?.setContext();
    if (sameRoom && !editing && $('roomCharacters').children.length) { renderEditor(); renderCompanionPanel(); }
    else render();
  }
  function onVisible(panel) { visible = panel === 'profile'; if (!visible) closeCompanion(); refreshAnimation(); }

  $('roomEditToggle').onclick = () => editing ? closeEditor() : openEditor();
  $('roomCancel').onclick = closeEditor;
  $('roomSave').onclick = save;
  $('roomCompanionClose').onclick = closeCompanion;
  $('roomCompanionTalk').onclick = performCompanionTalk;
  $('roomCompanionWheel').addEventListener('wheel', event => {
    if (!companionId || event.ctrlKey) return;
    event.preventDefault();
    const delta = (event.deltaY || event.deltaX) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 272 : 1);
    if (!Number.isFinite(delta)) return;
    if (wheelDelta && Math.sign(delta) !== Math.sign(wheelDelta)) wheelDelta = 0;
    wheelDelta += delta;
    // A Windows mouse notch commonly sends100/120px. One notch must advance
    // one option; stepping2 across six options makes half of them unreachable.
    if (Math.abs(wheelDelta) >= 48) { const step = Math.sign(wheelDelta); wheelDelta = 0; rotateCompanionWheel(step); }
  }, { passive: false });
  $('roomCompanionWheel').addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) {
      event.preventDefault(); rotateCompanionWheel(['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1); $('roomCompanionWheel').focus({ preventScroll: true });
    } else if ((event.key === 'Enter' || event.key === ' ') && event.target === $('roomCompanionWheel')) {
      event.preventDefault(); const buttons = wheelButtons(); buttons[((Math.round(wheelTarget) % buttons.length) + buttons.length) % buttons.length]?.click();
    }
  });
  $('roomCompanionWheel').addEventListener('pointerdown', event => {
    if (event.button > 0 || event.target.closest('#roomCompanionClose')) return;
    wheelSuppressClick = false; wheelDrag = { id: event.pointerId, start: event.clientY, last: event.clientY, moved: false };
  });
  $('roomCompanionWheel').addEventListener('pointermove', event => {
    if (!wheelDrag || event.pointerId !== wheelDrag.id) return;
    if (event.pointerType === 'mouse' && event.buttons === 0) { wheelDrag = null; wheelSuppressClick = false; return; }
    if (!wheelDrag.moved && Math.abs(event.clientY - wheelDrag.start) < 9) return;
    wheelDrag.moved = true; wheelSuppressClick = true;
    $('roomCompanionWheel').setPointerCapture(event.pointerId);
    const delta = event.clientY - wheelDrag.last;
    if (Math.abs(delta) >= 32) { rotateCompanionWheel(-Math.sign(delta)); wheelDrag.last = event.clientY; }
    event.preventDefault();
  });
  const stopWheelDrag = event => {
    if (wheelDrag?.id !== event.pointerId) return;
    wheelDrag = null;
    if (event.type === 'pointercancel') wheelSuppressClick = false;
    else setTimeout(() => { wheelSuppressClick = false; }, 0);
  };
  document.addEventListener('pointerup', stopWheelDrag, true);
  document.addEventListener('pointercancel', stopWheelDrag, true);
  $('roomCompanionWheel').addEventListener('click', event => {
    if (wheelSuppressClick) { event.preventDefault(); event.stopImmediatePropagation(); wheelSuppressClick = false; return; }
    const buttons = wheelButtons(), index = buttons.indexOf(event.target.closest('button'));
    if (index < 0) return;
    cancelAnimationFrame(wheelFrame); wheelFrame = 0; wheelAt = 0;
    wheelPhase = wheelTarget = index; renderCompanionWheel();
  }, true);
  document.body.append($('roomCompanionPanel'));
  new ResizeObserver(positionCompanion).observe($('roomCompanionPanel'));
  window.addEventListener('resize', positionCompanion);
  document.addEventListener('scroll', positionCompanion, true);
  document.addEventListener('pointerdown', event => {
    if (!companionId || $('roomCompanionPanel').contains(event.target)) return;
    if (event.target.closest('#roomCharacters [data-room-key]')) return;
    closeCompanion();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !companionId) return;
    const actor = [...$('roomCharacters').children].find(node => node.dataset.roomKey === `c:${companionId}`);
    closeCompanion(); actor?.focus({ preventScroll: true }); event.preventDefault();
  });
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
  window.LauncherRoom = { setProfile, onVisible, openEditor, refreshCompanion, onPurchase: (result, itemId) => lifeRoom?.onPurchase(result, itemId) };
  // Enabled only by the local QA harness, never by the packaged launcher.
  if (window.__LAUNCHER_ROOM_QA__ === true) window.__launcherRoomTest = {
    snapshot: () => ({ interaction: interaction && { type: interaction.type, phase: interaction.phase,
      sceneId: interaction.scene?.id, sceneCursor: interaction.scene?.cursor, pair: interaction.scene?.pair,
      turnIndex: interaction.turnIndex, turns: interaction.scene?.turns.length },
    life: lifeRoom?.snapshot(),
    walkers: walkers.map(walker => ({ key: walker.key, cell: { ...walker.cell }, x: walker.x, y: walker.y,
      mode: walker.mode, attention: !!walker.attention, phase: walker.motion?.phase, direction: walker.motion?.direction,
      dock: walker.dockTarget ? { ...walker.dockTarget } : null,
      ready: Object.keys(walker.motionArt?.atlases || {}), route: walker.route.map(cell => ({ ...cell })) })) }),
    lifeWorld: () => lifeRoom?.world(),
    lifeAssign: (key,stationId) => lifeRoom?.controller()?.assignWork(key,stationId),
    lifeInteract: (key,action) => lifeRoom?.controller()?.interact(key,action),
    lifeEvent: id => lifeRoom?.controller()?.scheduleEvent(id),
    lifePool: () => lifeRoom?.controller()?.getEventPool(),
    lifeCancel: key => lifeRoom?.controller()?.cancel(key),
    route: (key, goal) => {
      if (interaction) finishInteraction(performance.now());
      nextInteractionAt = Infinity;
      const walker = walkers.find(entry => entry.key === key);
      if (!walker || !Number.isInteger(goal?.col) || !Number.isInteger(goal?.row)) return false;
      walker.mode = 'wander'; walker.pause = 0;
      return routeTo(walker, goal);
    },
    resumeInteractions: () => { nextInteractionAt = performance.now(); },
    beginChat: (firstKey, secondKey) => {
      if (interaction) finishInteraction(performance.now());
      const first = walkers.find(entry => entry.key === firstKey), second = walkers.find(entry => entry.key === secondKey);
      return !!first && !!second && beginChat(first, second, performance.now());
    }
  };
  render();
})();
