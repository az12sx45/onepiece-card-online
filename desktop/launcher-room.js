(() => {
  'use strict';
  const api = window.onePieceDesktop;
  const $ = id => document.getElementById(id);
  const WIDTH = 960;
  const HEIGHT = 540;
  const DEFAULT_SCENE = 'room-scene-default';
  const SCENE_FALLBACK = 'opui://launcher/images/desktop_launcher/desktop_launcher_cabin_bg_v1.png';
  const TYPES = {
    scene: { type: 'room_scene', owned: 'roomScenes', label: '場景' },
    furniture: { type: 'room_furniture', owned: 'roomFurniture', label: '家具' },
    character: { type: 'room_character', owned: 'roomCharacters', label: '夥伴' }
  };
  const ASSET = /^opui:\/\/launcher\/images\/launcher_room\/(scenes|furniture|chibi)\/[a-z0-9-]+\.webp$/i;
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
  const blankRoom = () => ({ revision: 0, sceneId: DEFAULT_SCENE, placements: [], characters: [] });
  function copyRoom(source) {
    const room = source && typeof source === 'object' ? source : {};
    return {
      revision: Math.max(0, Math.trunc(clamp(room.revision, 0, Number.MAX_SAFE_INTEGER, 0))),
      sceneId: typeof room.sceneId === 'string' ? room.sceneId : DEFAULT_SCENE,
      placements: (Array.isArray(room.placements) ? room.placements : []).slice(0, 24).map(item => ({
        itemId: String(item?.itemId || ''), x: clamp(item?.x, 0, WIDTH, 480), y: clamp(item?.y, 0, HEIGHT, 410),
        scale: clamp(item?.scale, .5, 1.5, 1), flip: item?.flip === true
      })),
      characters: (Array.isArray(room.characters) ? room.characters : []).slice(0, 3).map(item => ({
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
    walkers = [];
  }
  function canAnimate() { return visible && !editing && !!profile && !document.hidden && !motion.matches; }
  function chooseDestination(walker) {
    const anchor = { x: clamp(walker.anchor.x, 65, 895, 480), y: clamp(walker.anchor.y, 345, 485, 430) };
    const bounds = { xMin: Math.max(65, anchor.x - 115), xMax: Math.min(895, anchor.x + 115), yMin: Math.max(345, anchor.y - 35), yMax: Math.min(485, anchor.y + 35) };
    walker.targetX = bounds.xMin + Math.random() * (bounds.xMax - bounds.xMin);
    walker.targetY = bounds.yMin + Math.random() * (bounds.yMax - bounds.yMin);
    walker.pause = 500 + Math.random() * 1500;
  }
  function frame(now) {
    animationId = 0;
    if (!canAnimate()) return;
    const delta = Math.min(50, lastFrame ? now - lastFrame : 16);
    lastFrame = now;
    for (const walker of walkers) {
      if (walker.pause > 0) { walker.pause -= delta; walker.node.classList.remove('is-walking'); continue; }
      const dx = walker.targetX - walker.x;
      const dy = walker.targetY - walker.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 2) { chooseDestination(walker); continue; }
      const step = Math.min(distance, delta * .022);
      walker.x += dx / distance * step;
      walker.y += dy / distance * step;
      walker.node.style.left = `${walker.x / WIDTH * 100}%`;
      walker.node.style.top = `${walker.y / HEIGHT * 100}%`;
      walker.node.style.zIndex = String(100 + Math.round(walker.y));
      walker.node.style.setProperty('--facing', dx < 0 ? '-1' : '1');
      walker.node.classList.add('is-walking');
    }
    animationId = requestAnimationFrame(frame);
  }
  function refreshAnimation() {
    stopAnimation();
    if (!canAnimate()) return;
    for (const placement of activeRoom().characters) {
      const node = [...$('roomCharacters').children].find(child => child.dataset.roomKey === `c:${placement.itemId}`);
      if (!node) continue;
      const startX = clamp(placement.x, 65, 895, 480);
      const startY = clamp(placement.y, 345, 485, 430);
      node.style.left = `${startX / WIDTH * 100}%`;
      node.style.top = `${startY / HEIGHT * 100}%`;
      const walker = { node, anchor: placement, x: startX, y: startY, pause: Math.random() * 1800, targetX: startX, targetY: startY };
      chooseDestination(walker);
      walkers.push(walker);
    }
    if (walkers.length) animationId = requestAnimationFrame(frame);
  }
  function positionNode(node, entry, kind) {
    node.style.left = `${entry.x / WIDTH * 100}%`;
    node.style.top = `${entry.y / HEIGHT * 100}%`;
    node.style.zIndex = String((kind === 'character' ? 100 : 20) + Math.round(entry.y));
    if (kind === 'furniture') {
      node.style.setProperty('--room-scale', String(entry.scale));
      node.style.setProperty('--facing', entry.flip ? '-1' : '1');
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
    stage.setAttribute('aria-label', `${profile?.name || '航海者'}的航海夥伴房間${editing ? '，可拖曳與用方向鍵調整' : ''}`);
    $('roomCaption').textContent = profile ? `${profile.name || '航海者'}的航海夥伴房間` : '登入後展示你的航海房間';
    const furniture = $('roomObjects'); furniture.replaceChildren();
    const characters = $('roomCharacters'); characters.replaceChildren();
    for (const entry of room.placements) {
      const item = resolvedItem(entry.itemId, 'furniture');
      const source = assetFor(item);
      if (!source) continue;
      const node = el('img', 'room-object');
      node.src = source; node.alt = item.name || '家具'; node.draggable = false;
      node.dataset.roomKey = `f:${entry.itemId}`;
      node.classList.toggle('is-selected', !!selected && selected.kind === 'furniture' && selected.itemId === entry.itemId);
      positionNode(node, entry, 'furniture'); furniture.append(node);
    }
    for (const entry of room.characters) {
      const item = resolvedItem(entry.itemId, 'character');
      const source = assetFor(item);
      if (!source) continue;
      const node = el('img', 'room-chibi');
      node.src = source; node.alt = item.name || '航海夥伴'; node.draggable = false;
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
    panel.append(el('strong', '', item?.name || '已選物件'), el('small', '', `座標 ${Math.round(entry.x)}, ${Math.round(entry.y)} · 可拖曳或用方向鍵微調`));
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
      const flip = el('button', 'ghost-button', entry.flip ? '朝右' : '朝左'); flip.type = 'button';
      flip.onclick = () => { entry.flip = !entry.flip; const node = [...$('roomObjects').children].find(child => child.dataset.roomKey === `f:${entry.itemId}`); if (node) positionNode(node, entry, 'furniture'); markChanged(); renderSelection(); };
      panel.append(flip);
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
    if (list.length >= (kind === 'furniture' ? 24 : 3)) { status(kind === 'furniture' ? '房間最多擺 24 件家具。' : '房間最多邀請 3 位夥伴。', true); return; }
    const index = list.length;
    list.push(kind === 'furniture'
      ? { itemId: item.id, x: 340 + index % 4 * 95, y: 350 + Math.floor(index / 4) * 26, scale: 1, flip: false }
      : { itemId: item.id, x: 310 + index * 165, y: 440 });
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
    loading = true; renderEditor(); status('正在讀取你已購買的房間商品…');
    try {
      const result = await api.getLauncherShop();
      if (!result?.ok || !result.shop) { status('商品無法讀取，請稍後再試。', true); return; }
      if (!isOwner()) return;
      shop = result.shop; draft = copyRoom(profile?.room); editing = true; dirty = false; selected = null;
      status('選擇場景、家具或夥伴，拖曳後儲存。'); render();
    } catch { status('目前無法連線，請稍後再試。', true); }
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
    } catch { status('房間未儲存，請檢查連線後再試。', true); }
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
  $('roomShopButton').onclick = () => {
    if (dirty) { status('先儲存房間，再前往商店挑選新商品。', true); return; }
    const category = TYPES[tab].type;
    closeEditor();
    window.LauncherProfileShop?.openShopCategory?.(category);
  };
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
    else if (event.key === 'Delete' || event.key === 'Backspace') $('roomSelection').querySelector('.room-remove')?.click();
    else return;
    event.preventDefault();
  });
  document.addEventListener('visibilitychange', refreshAnimation);
  motion.addEventListener?.('change', refreshAnimation);
  window.LauncherRoom = { setProfile, onVisible, openEditor };
  render();
})();
