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
  const POSES = new Set(['idle', 'talk_happy', 'talk_annoyed', 'surprised', 'focused_use', 'sit', 'wave', 'listen']);
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
    'kitchen-table': [125, 75], bookshelf: [115, 151],
    'medicine-cabinet': [111, 139], piano: [105, 75], 'tool-bench': [155, 116]
  });
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
    const key = item?.type === TYPES.character.type ? keyForCharacter(item) : '';
    return source && key ? `opui://launcher/images/launcher_room/portrait_v2/${key}.webp` : source;
  };
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
    const portrait = $('roomCompanionPortrait');
    portrait.onerror = () => { portrait.onerror = null; portrait.src = catalogAssetFor(item); };
    portrait.src = key ? `opui://launcher/images/launcher_room/portrait_v2/${key}.webp` : assetFor(item);
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
    if (interaction) finishInteraction(performance.now());
    nextInteractionAt = performance.now() + 5000;
    const walker = walkers.find(entry => entry.item?.id === itemId);
    if (walker) walker.node.classList.add('is-companion-selected');
    if (walker && !['job', 'job-approach'].includes(walker.mode)) {
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
      if (interaction) finishInteraction(performance.now());
      nextInteractionAt = performance.now() + 5000;
      syncCompanionWalker(itemId);
      const walker = walkers.find(entry => entry.item?.id === itemId);
      const key = walker?.key || keyForCharacter(resolvedItem(itemId, 'character'));
      const beatKind = action === 'talk' ? 'bond' : action === 'claim' ? 'claim' : 'work';
      const beat = dialogue?.interactionBeat?.(key, beatKind, companionLineIndex);
      const lines = beat ? [beat.line, beat.mood] : dialogue?.interaction?.(key, beatKind, companionLineIndex) ||
        [action === 'talk' ? '下次再來聊天吧！' : action === 'claim' ? '工作已經完成了。' : '我去把這件事做好。', 'happy'];
      companionLineIndex++;
      if (action === 'talk') {
        if (walker && walker.mode === 'focused') {
          showSpeech(walker, lines[0], lines[1], '親密度 +2');
          if (beat?.pose) setPose(walker, beat.pose);
          walker.manualUntil = performance.now() + 3500;
        }
        companionStatus('聊天完成，親密度增加 2。');
      } else if (action === 'start') {
        if (walker) {
          walker.jobIntro = lines;
          if (walker.mode === 'job') {
            const activity = walker.jobBeat;
            showSpeech(walker, activity?.line || lines[0], activity?.mood || lines[1], activity?.verb || '開始工作', !!walker.jobFurnitureKey, walker.jobFurnitureKey);
            if (activity?.pose) setPose(walker, activity.pose);
            walker.jobSpeechUntil = performance.now() + 3000;
            walker.jobIntro = null;
          }
        }
        companionStatus('已安排工作；完成後回來領取展示室金幣。');
      } else {
        if (walker) { showSpeech(walker, lines[0], lines[1], '工作完成'); if (beat?.pose) setPose(walker, beat.pose); }
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
    walker.node.classList.remove('has-directional-sprite');
    walker.node.dataset.directionalAction = 'false';
    walker.node.dataset.actionSource = 'legacy';
    const canvas = walker.node.querySelector('.room-walk-sprite');
    if (canvas) canvas.hidden = true;
    walker.pose = next; walker.node.dataset.pose = next;
    const sprite = walker.node.querySelector('.room-chibi');
    if (!sprite) return;
    if (walker.staticPose === next) return;
    walker.staticPose = next;
    const fallback = assetFor(walker.item);
    sprite.onerror = () => { sprite.onerror = null; sprite.src = fallback; sprite.dataset.artFallback = 'true'; };
    sprite.dataset.artFallback = 'false';
    sprite.src = walker.key ? `opui://launcher/images/launcher_room/action_frames/${walker.key}/${next === 'listen' ? 'idle' : next}.webp` : fallback;
  }
  function showAction(walker, pose, now = performance.now()) {
    const atlas = walker.actionArt?.atlases?.[walker.motion?.direction];
    const frame = locomotion?.actionFrame(pose, now - (walker.poseStartedAt || now)) ?? -1;
    const canvas = walker.node.querySelector('.room-walk-sprite');
    if (!atlas || frame < 0 || !locomotion.draw(canvas, atlas, frame, locomotion.ACTION_SHAPE)) return false;
    const root = locomotion.metadata(walker.key, motionTable).root;
    canvas.style.setProperty('--room-root-offset', `${(locomotion.SHAPE.cell - root[1]) / locomotion.SHAPE.cell * 100}%`);
    canvas.hidden = false; walker.node.classList.add('has-directional-sprite');
    walker.node.dataset.directionalAction = 'true'; walker.node.dataset.actionSource = 'acting_v2';
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
    // A four-neighbor depth segment keeps its column, and therefore slope,
    // constant. Columns change only after a planted direction turn.
    const back = gridPoint(walker.cell.col + .5, 0), front = gridPoint(walker.cell.col + .5, FLOOR.rows);
    const slope = walker.dockTravel ? 0 : (front.x - back.x) / (front.y - back.y);
    const variant = shape === locomotion.DEPTH_WALK_SHAPE ? locomotion.slopeVariant(slope) : 0;
    if (!locomotion.draw(canvas, atlas, frame + variant * locomotion.SHAPE.frames, shape)) return false;
    const root = locomotion.metadata(walker.key, motionTable).root;
    canvas.style.setProperty('--room-root-offset', `${(locomotion.SHAPE.cell - root[1]) / locomotion.SHAPE.cell * 100}%`);
    canvas.hidden = false;
    walker.node.classList.add('has-directional-sprite');
    walker.node.dataset.direction = state.direction;
    walker.node.dataset.motionFrame = String(frame);
    walker.node.dataset.motionVariant = String(variant);
    walker.node.dataset.floorSlope = String(slope);
    walker.node.dataset.motionPhase = String(state.phase);
    walker.node.dataset.motionReady = 'true';
    walker.node.dataset.actionSource = 'motion_v2';
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
    const furnitureKeys = activeRoom().placements.map(entry => keyForFurniture(resolvedItem(entry.itemId, 'furniture')));
    const scene = dialogue?.scene?.(first.key, second.key, history.cursor, {
      furnitureKey: furnitureKeys.find(key => dialogue?.profile?.(first.key)?.favorite?.includes(key)) || furnitureKeys[0] || '',
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
    if (['piano', 'kitchen-table'].includes(keyForFurniture(target.item))) {
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
    if (!['piano', 'kitchen-table'].includes(key)) return null;
    const depth = locomotion.projectedScale(target.anchor.y, FLOOR);
    const side = ['north', 'east', 'south', 'west'][rotationFor(target.entry)];
    // Coordinates follow the actual tabletop / keyboard in the four GPT views.
    // The approach cell and persisted footprint stay reserved and unchanged.
    const offsets = { north: [0, 4], south: [0, -27], east: [key === 'piano' ? -24 : -30, -8], west: [key === 'piano' ? 24 : 30, -8] };
    const [dx, dy] = offsets[side];
    return { x: target.anchor.x + dx * depth, y: target.anchor.y + dy * depth,
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
    const gait = locomotion.speedAndStride(walker.key, walker.motion.direction, scale, motionTable);
    const travel = Math.min(Math.abs(amount), delta / 1000 * gait.speed);
    if (horizontal) walker.x += Math.sign(amount) * travel; else walker.y += Math.sign(amount) * travel;
    walker.node.style.left = `${walker.x / WIDTH * 100}%`; walker.node.style.top = `${walker.y / HEIGHT * 100}%`;
    walker.node.style.zIndex = String(Number.isFinite(target.z) ? target.z : 10 + Math.round(walker.y));
    walker.node.style.setProperty('--room-character-scale', String(scale / 1.07));
    keepSpeechInsideStage(walker);
    walker.dockTravel = true; walker.node.classList.add('is-walking');
    locomotion.advance(walker.motion, travel, gait.stride, { ready: true }); showMotion(walker, true);
    return false;
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
        walker.route = []; walker.jobFurnitureKey = ''; walker.jobFacingCell = null; walker.jobTargetLayout = null;
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
    }).filter(entry => entry.item && entry.placed && dialogue?.activity?.(walker.key, keyForFurniture(entry.item), 0));
    targets.sort((a, b) => Number(favorites.includes(keyForFurniture(b.item))) - Number(favorites.includes(keyForFurniture(a.item))));
    walker.jobFurnitureKey = '';
    walker.jobFacingCell = null; walker.jobTargetLayout = null;
    walker.jobBeat = dialogue?.interactionBeat?.(walker.key, 'work', companionLineIndex++) || null;
    walker.route = []; walker.pause = 0;
    for (const target of targets) {
      const spots = spotsAround(target.placed)
        .filter(cell => !cellBlocked(cell, blockedFor(walker)))
        .sort((a, b) => Math.abs(a.col - walker.cell.col) + Math.abs(a.row - walker.cell.row) - Math.abs(b.col - walker.cell.col) - Math.abs(b.row - walker.cell.row));
      if (spots.some(cell => routeTo(walker, cell))) {
        walker.jobFurnitureKey = keyForFurniture(target.item);
        walker.jobTargetLayout = target.placed;
        walker.jobFacingCell = { col: target.placed.cell.col + target.placed.span.width / 2 - .5,
          row: target.placed.cell.row + target.placed.span.height / 2 - .5 };
        walker.jobBeat = dialogue.activity(walker.key, walker.jobFurnitureKey, companionLineIndex++);
        walker.mode = 'job-approach';
        break;
      }
    }
    if (!walker.jobFurnitureKey) walker.mode = 'job';
    if (walker.mode === 'job') {
      walker.node.classList.toggle('is-using-furniture', !!walker.jobFurnitureKey);
      setPose(walker, walker.jobBeat?.pose || 'focused_use');
    }
    refreshJobBadges();
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
        phase: 'approach', expires: now + 20000, holdUntil: 0 };
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
    interaction = { type: 'chat', actors: [first, second], scene, turnIndex: -1, phase: 'approach', expires: now + 20000, holdUntil: 0 };
    return true;
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
    startInteraction(now);
    if (now >= nextJobBadgeAt) { refreshJobBadges(); nextJobBadgeAt = now + 1000; }
    for (const walker of walkers) {
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
      if (walker.mode === 'job') {
        if (walker.jobSpeechUntil && now >= walker.jobSpeechUntil) { hideSpeech(walker); walker.jobSpeechUntil = 0; }
        if (!companionWorkReady(companionRecord(walker.item?.id))) {
          walker.node.classList.toggle('is-using-furniture', !!walker.jobFurnitureKey);
          setPose(walker, walker.jobBeat?.pose || 'focused_use');
        } else {
          walker.node.classList.remove('is-using-furniture'); setPose(walker, 'wave');
        }
        continue;
      }
      if (walker.pause > 0 && walker.mode === 'wander') {
        walker.pause -= delta;
        walker.node.classList.remove('is-walking'); setPose(walker, 'idle'); continue;
      }
      if (!walker.route.length) {
        walker.node.classList.remove('is-walking');
        if (walker.mode === 'job-approach') {
          if (walker.jobTargetLayout && (walker.dockTarget || startFurnitureDock(walker, walker.jobTargetLayout)) &&
              !moveFurnitureDock(walker, walker.dockTarget, now, delta)) continue;
          if (walker.jobFacingCell && !faceWalker(walker, walker.jobFacingCell, now)) { setPose(walker, 'idle'); continue; }
          walker.mode = 'job';
          const task = walker.jobBeat || (walker.jobIntro
            ? { line: walker.jobIntro[0], mood: walker.jobIntro[1], verb: '開始工作' }
            : dialogue?.interactionBeat?.(walker.key, 'work', companionLineIndex++));
          walker.jobIntro = null;
          if (task) {
            showSpeech(walker, task.line, task.mood, task.verb || '開始工作', !!walker.jobFurnitureKey, walker.jobFurnitureKey);
            setPose(walker, task.pose || 'focused_use'); walker.jobSpeechUntil = now + 3000;
          } else { walker.node.classList.remove('is-using-furniture'); setPose(walker, 'focused_use'); }
        }
        if (walker.mode === 'wander') chooseDestination(walker);
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
        else if (walker.blockedFor > 1500 && walker.mode === 'job-approach') {
          walker.route = []; walker.mode = 'job'; walker.jobFurnitureKey = ''; walker.jobFacingCell = null;
          walker.jobBeat = dialogue?.interactionBeat?.(walker.key, 'work', companionLineIndex++) || null;
          walker.node.classList.remove('is-using-furniture'); setPose(walker, walker.jobBeat?.pose || 'focused_use');
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
      const gait = locomotion.speedAndStride(walker.key, direction, scale, motionTable);
      const step = locomotion.pathStep(dx, dy, direction, delta / 1000 * gait.speed);
      if (step.reached) {
        walker.x = target.x; walker.y = target.y; walker.cell = nextCell; walker.route.shift(); walker.segmentCell = null;
        walker.node.dataset.gridCol = String(nextCell.col); walker.node.dataset.gridRow = String(nextCell.row);
      } else { walker.x += step.dx; walker.y += step.dy; }
      walker.node.style.left = `${walker.x / WIDTH * 100}%`;
      walker.node.style.top = `${walker.y / HEIGHT * 100}%`;
      walker.node.style.zIndex = String(10 + Math.round(walker.y));
      walker.node.style.setProperty('--room-depth', String(locomotion.projectedScale(walker.y, FLOOR)));
      walker.node.style.setProperty('--room-character-scale', String(locomotion.projectedScale(walker.y, FLOOR) / 1.07));
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
    if (kind === 'character') node.style.setProperty('--room-character-scale', String((.72 + .35 * (anchor.y - FLOOR.top) / (FLOOR.bottom - FLOOR.top)) / 1.07));
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
      const walkSprite = el('canvas', 'room-walk-sprite');
      walkSprite.width = 256; walkSprite.height = 256; walkSprite.hidden = true; walkSprite.setAttribute('aria-hidden', 'true');
      const speech = el('div', 'room-speech'); speech.hidden = true;
      speech.setAttribute('role', 'status'); speech.setAttribute('aria-live', 'polite');
      speech.append(el('span', 'room-speech-text'), el('small', 'room-speech-action'));
      const badge = el('span', 'room-work-badge'); badge.hidden = true; badge.setAttribute('aria-hidden', 'true');
      const work = companionRecord(entry.itemId);
      const working = work?.work?.state === 'working' || work?.work?.state === 'ready';
      badge.hidden = !working;
      badge.textContent = companionWorkReady(work) ? '可領取' : '工作中';
      node.append(sprite, walkSprite, speech, badge);
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
  // Enabled only by the local QA harness, never by the packaged launcher.
  if (window.__LAUNCHER_ROOM_QA__ === true) window.__launcherRoomTest = {
    snapshot: () => ({ interaction: interaction && { type: interaction.type, phase: interaction.phase,
      sceneId: interaction.scene?.id, sceneCursor: interaction.scene?.cursor, pair: interaction.scene?.pair,
      turnIndex: interaction.turnIndex, turns: interaction.scene?.turns.length },
    walkers: walkers.map(walker => ({ key: walker.key, cell: { ...walker.cell }, x: walker.x, y: walker.y,
      mode: walker.mode, phase: walker.motion?.phase, direction: walker.motion?.direction,
      dock: walker.dockTarget ? { ...walker.dockTarget } : null, jobFurnitureKey: walker.jobFurnitureKey || '', jobLine: walker.jobBeat?.line || '',
      ready: Object.keys(walker.motionArt?.atlases || {}), route: walker.route.map(cell => ({ ...cell })) })) }),
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
