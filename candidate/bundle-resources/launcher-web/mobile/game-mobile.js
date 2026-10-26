
/* Android presentation module: game-mobile */
(function () {
  'use strict';
  // Native injects this only into documents on the official game origin. The
  // separate exact origin override exists solely for the local layout QA runner.
  const allowedOrigin = window.__TABLETOP_ANDROID_TEST_ORIGIN || 'https://onepiece-card-online.onrender.com';
  if (location.origin !== allowedOrigin || window.__TABLETOP_ANDROID_GAME_UI__) return;
  window.__TABLETOP_ANDROID_GAME_UI__ = true;

  const path = location.pathname.replace(/\/+$/, '').toLowerCase();
  const kinds = {
    '/start.html': 'card-start', '/game.html': 'card',
    '/profile.html': 'card-profile', '/shop.html': 'card-shop',
    '/result.html': 'card-result', '/tutorial.html': 'card-tutorial',
    '/board_start.html': 'board-start', '/board_game.html': 'board',
    '/board_fixed_viewport.html': 'board-frame', '/board_battle.html': 'board-battle',
    '/board_impel_down.html': 'board-prison',
    '/board_lobby.html': 'board-lobby', '/board_marineford.html': 'board-marineford',
    '/board_water_seven.html': 'board-shipyard', '/board_spar_selection_demo.html': 'board-spar',
    '/board_york_clue_puzzle_formal_demo.html': 'board-puzzle',
    '/chess/index.html': 'chess-start', '/chess/battle-game.html': 'chess'
  };
  const kind = kinds[path];
  if (!kind) return;

  // This runs before Board's inline redirect. Preserve room, account handoff,
  // portable-assets, and hash parameters; only choose its existing responsive UI.
  if (kind === 'board') {
    const url = new URL(location.href);
    url.searchParams.set('layout', 'responsive');
    url.searchParams.set('portable_assets', '1');
    history.replaceState(history.state, '', url.href);
  } else if (kind === 'board-frame') {
    // Old saved links can still point at the desktop wrapper. Navigate within
    // the same allowed origin to the full responsive game rather than scaling it.
    const url = new URL('board_game.html', location.href);
    url.search = location.search;
    url.hash = location.hash;
    url.searchParams.set('layout', 'responsive');
    url.searchParams.set('portable_assets', '1');
    url.searchParams.delete('desktop_frame');
    location.replace(url.href);
    return;
  }

  function markDocument() {
    if (!document.documentElement) return false;
    if (document.documentElement.dataset.platform !== 'android') document.documentElement.dataset.platform = 'android';
    if (document.documentElement.dataset.gameUi !== kind) document.documentElement.dataset.gameUi = kind;
    return true;
  }
  markDocument();

  let scheduled = false;
  const setProperty = (node, name, value) => {
    if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
  };
  function updateViewport() {
    const root = document.documentElement;
    if (!root) return;
    const viewport = window.visualViewport;
    setProperty(root, '--android-vw', `${Math.round(viewport?.width || innerWidth)}px`);
    setProperty(root, '--android-vh', `${Math.round(viewport?.height || innerHeight)}px`);
    setProperty(root, '--android-viewport-top', `${Math.round(viewport?.offsetTop || 0)}px`);
  }
  function schedulePresentation() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      markDocument();
      updateViewport();
      adaptCardPanels();
      // Board's map controller owns command placement and camera lifecycle.
      // Viewport geometry is updated only on real viewport events here.
    });
  }

  function adaptCardPanels() {
    if (!['card','card-tutorial'].includes(kind)) return;
    const main = document.querySelector('main');
    const aside = main?.querySelector(':scope > aside');
    const log = document.getElementById('logBox')?.closest('.card');
    // Move the original bound elements, never clone controls or game state.
    if (aside && log && log.parentElement !== aside) aside.append(log);
    const addClass = (node, name) => { if (node && !node.classList.contains(name)) node.classList.add(name); };
    addClass(main?.querySelector(':scope > section'), 'android-card-table');
    addClass(document.getElementById('venues')?.closest('.card'), 'android-card-venues');
    addClass(document.getElementById('btnDraw')?.closest('.card'), 'android-card-deck');
    addClass(document.getElementById('discard')?.closest('.card'), 'android-card-discards');
    addClass(log, 'android-card-log');
  }

  function fitShipMenu() {
    if (kind !== 'board') return;
    const map = document.getElementById('boardGameMap');
    const viewport = document.getElementById('boardViewport');
    const menu = map?.querySelector('.ship-action-menu');
    if (!menu || !viewport || !map.offsetWidth) return;
    if (menu.dataset.phoneCarousel === 'true') return;
    // The map keeps its authoritative pan/zoom. Counter-scale only its command
    // panel so touch targets stay device-sized, keeping it inside the map DOM
    // where the original close/action handlers expect to find it.
    const mapRect = map.getBoundingClientRect();
    const viewRect = viewport.getBoundingClientRect();
    const scale = mapRect.width / map.offsetWidth;
    if (!Number.isFinite(scale) || scale <= 0) return;
    setProperty(menu, '--android-menu-unscale', String(1 / scale));
    const width = Math.min(440, viewRect.width - 24);
    const height = Math.min(280, viewRect.height - 76);
    setProperty(menu, '--android-menu-width', `${width}px`);
    setProperty(menu, '--android-menu-height', `${height}px`);
    setProperty(menu, '--android-menu-x', `${(viewRect.right - width - 12 - mapRect.left) / scale}px`);
    setProperty(menu, '--android-menu-y', `${(viewRect.bottom - height - 12 - mapRect.top) / scale}px`);
  }

  function initialize() {
    markDocument();
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) viewport.content = 'width=device-width,initial-scale=1,viewport-fit=cover';
    schedulePresentation();
    // Child replacement and class changes are how the existing games render
    // rooms, prompts, inventory, and battles. We observe presentation only.
    if (!kind.startsWith('board')) {
      const observer = new MutationObserver(schedulePresentation);
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
    }
    // A swipe that reads a long subtitle must not become the story renderer's
    // subsequent tap-to-advance click. Native pan-y remains enabled; no pointer
    // movement is cancelled and no gameplay action is synthesized.
    const readableScrollers = '.final-ending-lines,.final-imu-dialogue,.final-robin-dialogue,.final-ritual-dialogue,.prebattle-quote,.tavern-reveal-invitation';
    const readingPointers = new Map();
    let readingSwipe = null;
    document.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'touch') return;
      const node = event.target.closest?.(readableScrollers);
      if (!node || node.scrollHeight <= node.clientHeight + 1) return;
      readingPointers.set(event.pointerId, { node, x: event.clientX, y: event.clientY, moved: false });
    }, { capture: true, passive: true });
    document.addEventListener('pointermove', event => {
      const pointer = readingPointers.get(event.pointerId);
      if (pointer && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 8) pointer.moved = true;
    }, { capture: true, passive: true });
    const finishReadingPointer = event => {
      const pointer = readingPointers.get(event.pointerId);
      if (pointer?.moved) readingSwipe = { node: pointer.node, until: performance.now() + 650 };
      readingPointers.delete(event.pointerId);
    };
    document.addEventListener('pointerup', finishReadingPointer, { capture: true, passive: true });
    document.addEventListener('pointercancel', finishReadingPointer, { capture: true, passive: true });
    document.addEventListener('click', event => {
      if (readingSwipe && performance.now() < readingSwipe.until && readingSwipe.node.contains(event.target)) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }, true);
    // Titles have no hover gesture on phones. Focus reveals the same existing
    // description without dispatching game commands or changing disabled state.
    const tooltip = document.createElement('div');
    tooltip.id = 'androidGameHint';
    tooltip.setAttribute('role', 'status');
    tooltip.hidden = true;
    document.body.append(tooltip);
    let hintTimer;
    document.addEventListener('focusin', (event) => {
      const target = event.target.closest?.('[title]');
      if (!target?.title || target.matches('input,textarea,select')) return;
      tooltip.textContent = target.title;
      tooltip.hidden = false;
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => { tooltip.hidden = true; }, 3500);
    });
    document.addEventListener('focusout', () => { tooltip.hidden = true; });
  }
  window.addEventListener('resize', schedulePresentation, { passive: true });
  window.visualViewport?.addEventListener('resize', schedulePresentation, { passive: true });
  window.visualViewport?.addEventListener('scroll', schedulePresentation, { passive: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();


/* Android presentation module: board-phone-render-lifecycle */
/* Phone-only presentation reuse. Inputs include local UI state, never game writes. */
(() => {
  'use strict';
  const screens=new WeakMap(), depth=new WeakMap(), metrics={};
  const phone=()=>document.documentElement?.dataset.platform==='android';
  const serial=values=>JSON.stringify(values,(_key,value)=>value instanceof Set?[...value]:value instanceof Map?[...value]:value);
  function begin(root,name,values){
    if(!phone()||!root)return true;
    let signature;try{signature=name+'|'+innerWidth+'x'+innerHeight+'|'+serial(values);}catch(_){return true;}
    const prior=screens.get(root),children=[...root.childNodes];
    const m=metrics[name]??={renders:0,reuses:0,changes:[]};
    if(prior?.signature===signature&&prior.children&&children.length===prior.children.length&&children.every((n,i)=>n===prior.children[i])){m.reuses++;return false;}
    m.renders++;if(prior){m.changes.push(prior.signature===signature?'children':'inputs');if(m.changes.length>8)m.changes.shift();}
    const entry={signature,children:null};screens.set(root,entry);
    requestAnimationFrame(()=>{if(root.isConnected&&screens.get(root)===entry)entry.children=[...root.childNodes];});
    return true;
  }
  function depthChanged(state,phase,host){
    if(!phone())return true;
    const image=state.image;
    const signature=[image.getAttribute('src'),image.getAttribute('srcset'),image.getAttribute('sizes'),image.getAttribute('class'),image.getAttribute('style'),image.hidden,image.complete,image.naturalWidth,image.naturalHeight,host?.getAttribute('class'),host?.getAttribute('style')].join('|');
    let phases=depth.get(state);if(!phases){phases=new Map();depth.set(state,phases);}
    const old=phases.get(phase),layer=state.depth?.layer;
    if(old?.signature===signature&&old.layer===layer)return false;
    phases.set(phase,{signature,layer});return true;
  }
  window.TabletopPhoneRenderLifecycle=Object.freeze({begin,depthChanged,snapshot:()=>JSON.parse(JSON.stringify(metrics))});
})();


/* Android presentation module: phone-board-layout-runtime */
/* Board phone presentation lifecycle. Source elements, events and game state
 * remain authoritative. Subscribers share one render transaction; their DOM
 * work is not observed as a new source render. No interval or map-style poll. */
(() => {
  'use strict';
  if (window.TabletopBoardPhoneLayout) return;
  const subscribers = new Map();
  const positions = new Map();
  const paneKeys = new WeakMap();
  const paneNodes = new Set();
  const metrics = { flushes: 0, sourceMicrotasks: 0, observedRecords: 0, relevantRecords: 0, ownedTransactions: 0, subscriberRuns: {}, restores: 0, scrollEvents: 0 };
  let observer, started = false, suspended = false, frame = 0, restoreFrame = 0, sourceTask = 0, sourceGeneration = 0;
  const beforePaint = window.queueMicrotask ? callback => window.queueMicrotask(callback) : callback => Promise.resolve().then(callback);
  let revision = 0, records = [], reasons = new Set(), activeScreen = null, ownDepth = 0;
  let pendingRestore = [], inputSequence = 0;
  const html = () => document.documentElement;
  const enabled = () => html()?.dataset.platform === 'android';
  const gameUi = () => html()?.dataset.gameUi || '';
  const valid = sub => !sub.gameUis.size || sub.gameUis.has(gameUi());
  const rootNodes = sub => sub.roots.flatMap(selector => [...document.querySelectorAll(selector)]);
  function inScope(record, sub) {
    if (record.target === html()) return true;
    const target = record.target instanceof Element ? record.target : record.target.parentElement;
    if (target && sub.roots.some(selector => target.closest(selector))) return true;
    if (record.type !== 'childList') return false;
    return [...record.addedNodes, ...record.removedNodes].some(node => node instanceof Element && sub.roots.some(selector => node.matches(selector) || node.querySelector(selector)));
  }
  function observe() {
    if (!observer || !started || suspended || ownDepth || !document.body) return;
    // Discovery has no attribute watch: camera transforms and CSS animations
    // therefore cannot invalidate unrelated management or battle screens.
    observer.observe(document.body, { childList: true, subtree: true });
    observer.observe(html(), { attributes: true, attributeOldValue: true, attributeFilter: ['data-game-ui', 'data-platform'] });
    const roots = new Set();
    for (const sub of subscribers.values()) if (valid(sub)) for (const node of rootNodes(sub)) roots.add(node);
    for (const node of roots) observer.observe(node, { childList: true, subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['class', 'hidden', 'src'] });
  }
  function own(fn) {
    ownDepth++;
    if (ownDepth === 1 && observer) {
      const waiting = observer.takeRecords();
      if (waiting.length) accept(waiting);
      observer.disconnect();
    }
    metrics.ownedTransactions++;
    try { return fn(); }
    finally { ownDepth--; if (!ownDepth) observe(); }
  }
  function request(reason = 'manual', sameCheckpoint = false) {
    reasons.add(String(reason));
    if (!started || suspended) return;
    if (reason === 'source' || sameCheckpoint) {
      if (sourceTask) return;
      const token = sourceTask = ++sourceGeneration;
      // Source renderers can replace a page from their own RAF callback. A
      // second RAF would let that frame paint the unadapted desktop DOM.
      // Normalize in the same microtask checkpoint, before the browser paints.
      beforePaint(() => {
        if (sourceTask !== token) return;
        sourceTask = 0;
        if (suspended) return;
        if (frame) cancelAnimationFrame(frame);
        frame = 0; metrics.sourceMicrotasks++; flush();
      });
      return;
    }
    if (frame || sourceTask) return;
    frame = requestAnimationFrame(flush);
  }
  function accept(batch) {
    metrics.observedRecords += batch.length;
    const interested = [...subscribers.values()].filter(valid);
    const relevant = batch.filter(record => !(record.type === 'attributes' && record.oldValue === record.target.getAttribute(record.attributeName)) && interested.some(sub => inScope(record, sub)));
    if (!relevant.length) return;
    metrics.relevantRecords += relevant.length;
    records.push(...relevant);
    request('source');
  }
  function flush() {
    frame = 0;
    if (!enabled() || suspended) { records = []; reasons.clear(); return; }
    const batch = records; records = [];
    const why = [...reasons]; reasons.clear();
    revision++; metrics.flushes++;
    const all = why.some(reason => reason !== 'source');
    const context = Object.freeze({ gameUi: gameUi(), revision, reason: why.join(','), reasons: why, records: batch,
      structural: batch.some(record => record.type === 'childList'), modal: document.getElementById('boardModal'), backdrop: document.getElementById('boardModalBack'), screen: activeScreen?.name || '' });
    own(() => {
      for (const [name, sub] of subscribers) {
        if (!valid(sub) || !all && !batch.some(record => inScope(record, sub))) continue;
        metrics.subscriberRuns[name] = (metrics.subscriberRuns[name] || 0) + 1;
        sub.callback(context);
      }
    });
    for (const node of paneNodes) if (!node.isConnected) paneNodes.delete(node);
    if (pendingRestore.length) {
      // A rebuilt reading pane must not paint once at zero before returning
      // to its saved position. Keep the later PC-renderer reconciliation too.
      applyRestores(pendingRestore);
      scheduleRestore();
    }
  }
  function applyRestores(wanted) {
    for (const { node, key, screenKey, initial } of wanted) {
      if (!node.isConnected || activeScreen?.key !== screenKey || paneKeys.get(node) !== key) continue;
      const saved = positions.get(key) || initial;
      if (!saved) continue;
      const top = Math.max(0, Math.min(saved.top, node.scrollHeight - node.clientHeight));
      const left = Math.max(0, Math.min(saved.left, node.scrollWidth - node.clientWidth));
      if (Math.abs(node.scrollTop - top) > .5) { node.scrollTop = top; metrics.restores++; }
      if (Math.abs(node.scrollLeft - left) > .5) { node.scrollLeft = left; metrics.restores++; }
    }
  }
  function scheduleRestore() {
    if (restoreFrame) cancelAnimationFrame(restoreFrame);
    const sequence = inputSequence;
    // The PC renderer restores scroll in its own two animation frames. Run
    // after that transaction, before accepting a later native user gesture.
    restoreFrame = requestAnimationFrame(() => {
      restoreFrame = requestAnimationFrame(() => {
        restoreFrame = 0;
        const wanted = pendingRestore; pendingRestore = [];
        if (sequence !== inputSequence || suspended) return;
        applyRestores(wanted);
      });
    });
  }
  function setScreen(screen, panes = []) {
    if (!screen) { activeScreen = null; pendingRestore = []; return; }
    activeScreen = { name: String(screen.name), key: String(screen.key) };
    for (const { node, key: paneKey, initial } of panes) {
      if (!(node instanceof HTMLElement)) continue;
      const key = activeScreen.key + '|' + paneKey;
      if (paneKeys.get(node) === key) continue;
      paneKeys.set(node, key); paneNodes.add(node);
      if (positions.has(key) || initial === 'start') pendingRestore.push({ node, key, screenKey: activeScreen.key, inputSequence, initial: initial === 'start' ? { top: 0, left: 0 } : null });
    }
  }
  function captureScroll(event) {
    const node = event.target;
    const key = paneKeys.get(node);
    if (!key || !node.isConnected || !activeScreen || !key.startsWith(activeScreen.key + '|')) return;
    if (pendingRestore.some(entry => entry.node === node && entry.inputSequence === inputSequence)) return;
    metrics.scrollEvents++;
    positions.delete(key);
    positions.set(key, { top: node.scrollTop, left: node.scrollLeft });
    // Per-document presentation memory only. Never write game/localStorage.
    while (positions.size > 256) positions.delete(positions.keys().next().value);
  }
  function subscribe(name, callback, options = {}) {
    if (subscribers.has(name)) throw Error('Duplicate Board phone layout subscriber: ' + name);
    const roots = options.roots || ['#boardModalBack'];
    if (!roots.length || roots.some(selector => typeof selector !== 'string')) throw Error('Board layout requires explicit root selectors');
    subscribers.set(name, { callback, roots, gameUis: new Set(options.gameUis || []) });
    if (started) { observer.disconnect(); observe(); request('subscribe:' + name); }
    return () => { subscribers.delete(name); if (observer) { observer.disconnect(); observe(); } };
  }
  function start() {
    if (started) return;
    started = true; observer = new MutationObserver(accept); observe(); request('initial');
    document.addEventListener('scroll', captureScroll, true);
    for (const type of ['pointerdown', 'touchstart', 'wheel', 'keydown']) document.addEventListener(type, () => { inputSequence++; }, { capture: true, passive: true });
    window.addEventListener('resize', () => request('resize'), { passive: true });
    window.visualViewport?.addEventListener('resize', () => request('visual-viewport'), { passive: true });
    window.addEventListener('pagehide', () => {
      suspended = true; observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      if (restoreFrame) cancelAnimationFrame(restoreFrame);
      frame = restoreFrame = sourceTask = 0; records = []; reasons.clear(); pendingRestore = [];
    });
    window.addEventListener('pageshow', () => { suspended = false; observe(); request('pageshow'); });
  }
  window.TabletopBoardPhoneLayout = Object.freeze({ subscribe, request, withOwnedDOM: own, setScreen,
    snapshot: () => ({ ...metrics, subscriberRuns: { ...metrics.subscriberRuns }, revision, activeScreen: activeScreen ? { ...activeScreen } : null,
      subscribed: [...subscribers.keys()], roots: [...new Set([...subscribers.values()].filter(valid).flatMap(sub => sub.roots))], panes: paneNodes.size, rememberedPanes: positions.size, suspended, scheduled: Boolean(frame || sourceTask), pendingRestores: pendingRestore.length }) });
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
})();


/* Android presentation module: phone-panels */
/* Phone panel contracts. A source render is normalized once. All buttons,
 * inputs and their listeners remain inside the original source modal. */
(function () {
  'use strict';
  const origin = window.__TABLETOP_ANDROID_TEST_ORIGIN || 'https://onepiece-card-online.onrender.com';
  if (location.origin !== origin || window.__TABLETOP_PHONE_PANELS__) return;
  window.__TABLETOP_PHONE_PANELS__ = true;
  const runtime = window.TabletopBoardPhoneLayout;
  if (!runtime) throw Error('Board phone layout runtime must load before phone-panels');

  // One explicit screen identity owns the outer content/actions slots. The
  // source renderer still owns the artwork and internal layout of each pane.
  const screens = [
    ['crew-detail', 'crew', '.crew-detail-ui', '.crew-detail-heading', '.crew-detail-info'],
    ['crew-list', 'crew', '.crew-roster-ui', '.crew-roster-heading', '.crew-manage-list'],
    ['shop-quantity', 'shop', '.shop-quantity-box', '.shop-quantity-title', '.shop-quantity-box'],
    ['shop', 'shop', '.shop-shell', '.shop-title', '.shop-list,.shop-desc-text'],
    ['backpack-target', 'quantity', '.backpack-target-ui', '.backpack-target-heading', '.backpack-target-grid'],
    ['healing-quantity', 'quantity', '.healing-quantity-ui', '.healing-quantity-heading', '.healing-quantity-info'],
    ['training-quantity', 'quantity', '.training-quantity-ui', '.training-quantity-heading', '.training-quantity-info'],
    ['backpack', 'backpack', '.backpack-shell', '.modal-title', '.backpack-list,.phone-v006-backpack-preview-read'],
    ['research', 'research', '.research-lab-ui', '.research-lab-heading', '.research-lab-content,.research-lab-detail-copy,.research-lab-card-grid,.research-lab-list'],
    ['hospital', 'hospital', '.hospital-ui', '.hospital-heading', '.hospital-crew-grid,.hospital-service-copy'],
    ['training-detail', 'equipment', '.training-detail-ui', '.training-detail-heading', '.training-detail-copy,.training-detail-stats'],
    ['carry', 'equipment', '.carry-item-ui', '.carry-item-heading', '.carry-item-list,.carry-current-copy'],
    ['cosmetic', 'equipment', '.cosmetic-frame-ui', '.cosmetic-frame-heading', '.cosmetic-frame-list'],
    ['mission-journal', 'missions', '.mission-journal-ui', '.mission-journal-heading', '.mission-journal-list,.phone-mission-journal-reading'],
    ['mission-board', 'missions', '.mission-board-ui,.mission-shell', '.mission-board-heading,.topbar', '.mission-board-list,.mission-wall,.detail-content'],
    ['records', 'records', '.save-load-ui', '.save-load-heading', '.save-load-body'],
    ['fleet', 'ship-info', '.fleet-info-ui', '.fleet-info-heading', '.fleet-role-list,.fleet-role-detail'],
    ['ship', 'ship-info', '.ship-info-ui', '.ship-info-heading', '.ship-info-content'],
    ['codex', 'codex', '.defeated-codex-ui', '.defeated-codex-heading', '.defeated-codex-list,.defeated-codex-detail'],
    ['arena', 'arena', '.arena-ui', '.arena-heading', '.arena-crew,.arena-rules'],
    ['learn', '', '.move-learn-ui', '.move-learn-heading', '.move-learn-grid'],
    ['captain', '', '.captain-selection-ui', '.captain-selection-heading', '.captain-selection-list'],
    ['cpu', '', '.cpu-strategy-ui', '.cpu-strategy-heading', '.cpu-strategy-list'],
    ['fixed-step', 'prompt', '.fixed-step-ui', '.fixed-step-heading', '.fixed-step-grid'],
    ['map-node', 'prompt', '.map-node-info-ui', '.map-node-info-heading', '.map-node-info-copy'],
    ['island-decision', 'prompt', '.island-decision-ui', '.island-decision-heading', '.island-decision-copy'],
    ['sea-train', 'prompt', '.sea-train-ticket-ui', '.sea-train-ticket-heading', '.sea-train-ticket-copy']
  ];
  const narrative = '.final-ending-cinematic,.final-imu-descent[data-final-imu-scene],.final-robin-reading,.final-activation-cinematic,.prebattle-scene,.prebattle-dialogue,.opening-story-scene,.opening-story-dialogue,.opening-story-shell,.sea-chest-draft-ui,.starter-draft-ui,.draft-recruitment-shell,.draft-harbor-ui,.board-phone-draft-dock,.tavern-game-shell,.tavern-result-ui,.sea-event-choice-ui,.sea-event-result-ui,.sea-chest-stage-shell,.sea-reveal,[data-judicial-chest-choice],#confirmEventIslandBtn';
  // Event scenes are identified by their actual source content in narrative.
  // A previous scene's presentation dataset can outlive source innerHTML and
  // must not misclassify the next shop/crew page for its first painted frame.
  const excludedModal = '.draft-recruitment-modal,.final-imu-fullscreen-modal,.final-robin-fullscreen-modal,.final-activation-fullscreen-modal,.final-ending-fullscreen-modal,.final-boss-compass-fullscreen-modal';
  const footerSelector = '.backpack-footer-actions,.crew-roster-footer,.mission-journal-close,.research-lab-footer,.hospital-actions,.save-load-actions';
  const bodies = ':scope > .phone-drawer-body,:scope > .phone-v006-generic-body';
  const footers = ':scope > .phone-drawer-footer,:scope > .phone-v006-generic-footer';
  const boundaryRegions = {
    backpack: { meta: '.backpack-owner-line', navigation: '.backpack-category-tabs' },
    research: { status: '.research-lab-footer-notice' }
  };
  const mark = (node, key, value) => { if (node && node.dataset[key] !== value) node.dataset[key] = value; };
  const backpackReadingRegistrations = new WeakSet();
  let normalizedRenders = 0, classifications = 0;

  function frame(modal, drawer) {
    let body = modal.querySelector(bodies), dock = modal.querySelector(footers);
    if (!body && modal.childNodes.length) {
      const footer = modal.querySelector(footerSelector) || [...modal.children].reverse().find(node => node.matches('.modal-row'));
      body = document.createElement('div'); body.className = drawer ? 'phone-drawer-body' : 'phone-v006-generic-body';
      for (const node of [...modal.childNodes]) body.append(node);
      modal.append(body);
      if (footer) {
        const notice = footer.querySelector('.research-lab-footer-notice');
        if (notice) body.append(notice);
        dock = document.createElement('footer'); dock.className = drawer ? 'phone-drawer-footer' : 'phone-v006-generic-footer';
        dock.append(footer); modal.append(dock);
      }
      normalizedRenders++;
    }
    mark(body, 'phoneSlot', 'content'); mark(dock, 'phoneSlot', 'actions');
    return { body, dock };
  }
  function viewKey(modal, screen, source) {
    const identity = source?.getAttribute('aria-label') || (screen === 'prompt' ? source?.querySelector('.modal-title,h3,h4')?.textContent.trim() : '') || '';
    const item = screen === 'shop-quantity' ? source?.querySelector('.shop-quantity-item>span')?.textContent.trim() || '' : '';
    const tabs = [...modal.querySelectorAll('[aria-selected="true"],[data-research-tab].is-active,[data-research-tab].active,[data-ship-info-page].is-active')]
      .map(node => node.id || [...node.attributes].filter(attribute => /^data-(?!phone)/.test(attribute.name)).map(attribute => attribute.name + '=' + attribute.value).join(',')).join(';');
    const detail = screen === 'research' ? source?.querySelector('.research-lab-detail') : null;
    const detailAction = detail?.querySelector('[data-research-store],[data-research-retrieve]');
    const instance = detailAction ? detailAction.dataset.researchStore || detailAction.dataset.researchRetrieve : detail?.querySelector('.research-lab-detail-card>strong')?.textContent.trim();
    const subview = detail ? 'detail:' + (instance || '') : screen === 'research' && source?.querySelector('.research-lab-cultivation-result') ? 'cultivation-result' : 'list';
    const confirm = screen === 'research' ? source?.querySelector('[data-research-factor-analysis-confirm],[data-research-breakthrough-confirm]') : null;
    const decision = confirm ? [...confirm.attributes].filter(attribute => /^data-research-.*confirm$/.test(attribute.name)).map(attribute => attribute.name + '=' + attribute.value).join(',') : '';
    return [screen, modal.dataset.scrollIdentity || '', identity, item, tabs, subview, decision].join('|');
  }
  function screenRegions(body, source, header, name) {
    if (source === body || source?.parentElement !== body) return;
    const extra = boundaryRegions[name] || {};
    for (const node of body.children) {
      let role = node === source ? 'screen' : node === header || node.matches('.modal-title') ? 'header' : node.matches('.modal-sub') ? 'meta' : '';
      if (!role) for (const [candidate, selector] of Object.entries(extra)) if (node.matches(selector)) { role = candidate; break; }
      if (role) mark(node, 'phoneRegion', role);
    }
    const regions = [...body.children].filter(node => node.dataset.phoneRegion && !node.hidden);
    if (!regions.some(node => node.dataset.phoneRegion === 'screen')) return;
    mark(body, 'phoneLayout', 'regions');
    const tracks = regions.map(node => node.dataset.phoneRegion === 'screen' ? 'minmax(0,1fr)' : 'auto').join(' ');
    if (body.style.getPropertyValue('--phone-content-rows') !== tracks) body.style.setProperty('--phone-content-rows', tracks);
    regions.forEach((node, index) => { const row = String(index + 1); if (node.style.getPropertyValue('--phone-region-row') !== row) node.style.setProperty('--phone-region-row', row); });
  }
  function missionJournalLayout(source) {
    if (!source?.matches('.mission-journal-ui')) return;
    let detail = source.querySelector(':scope>.phone-v006-mission-detail');
    if (!detail) {
      const parts = [...source.children].filter(node => node.matches('.mission-journal-rank,.mission-journal-detail-title,.mission-journal-detail-copy,.mission-journal-progress,.mission-journal-reward,.mission-journal-primary-action,.mission-journal-secondary-action'));
      if (!parts.length) return;
      detail = document.createElement('div'); detail.className = 'phone-v006-mission-detail';
      parts[0].before(detail); parts.forEach(node => detail.append(node)); mark(detail, 'phoneArt', 'panel');
    }
    for (const [selector, className] of [
      ['.mission-journal-rank,.mission-journal-detail-title,.mission-journal-detail-copy,.mission-journal-progress,.mission-journal-reward', 'phone-mission-journal-reading'],
      ['.mission-journal-primary-action,.mission-journal-secondary-action', 'phone-mission-journal-actions']
    ]) {
      if (detail.querySelector(':scope>.' + className)) continue;
      const parts = [...detail.children].filter(node => node.matches(selector));
      if (!parts.length) continue;
      const slot = document.createElement('div'); slot.className = className;
      parts[0].before(slot); parts.forEach(node => slot.append(node));
    }
  }
  function classifyModal(modal, backdrop) {
    if (!modal || !backdrop) return;
    classifications++;
    const scene = modal.matches(excludedModal) || Boolean(modal.querySelector(narrative));
    if (scene) {
      mark(modal, 'phoneShell', 'scene'); mark(modal, 'phoneScreen', 'scene');
      for (const node of [modal, backdrop]) node.removeAttribute('data-phone-drawer');
      runtime.setScreen(null); return;
    }
    const contract = screens.find(([, , selector]) => modal.querySelector(selector));
    const [name, drawer, selector, headerSelector, paneSelector] = contract || ['prompt', '', '', '.modal-title', '.modal-sub,.companion-grid'];
    for (const node of [modal, backdrop]) {
      if (drawer) mark(node, 'phoneDrawer', drawer); else node.removeAttribute('data-phone-drawer');
    }
    mark(modal, 'phoneShell', 'page'); mark(modal, 'phoneScreen', name);
    const { body, dock } = frame(modal, drawer);
    if (!body) return;
    const source = selector ? modal.querySelector(selector) : body;
    if (name === 'mission-journal') missionJournalLayout(source);
    const header = modal.querySelector(headerSelector);
    mark(header, 'phoneRegion', 'header'); mark(source, 'phoneRegion', 'screen');
    screenRegions(body, source, header, name);
    if (name === 'backpack' && source && !source.querySelector('.phone-v006-backpack-preview-read') && !backpackReadingRegistrations.has(source)) {
      backpackReadingRegistrations.add(source);
      runtime.request('backpack-reading-registration', true);
    }
    const panes = [body, ...(paneSelector ? modal.querySelectorAll(paneSelector) : [])];
    const occurrences = new Map();
    const keyed = panes.map(node => {
      const stableClass = [...node.classList].filter(value => !/^(is-|phone-)/.test(value)).sort().join('.');
      const base = node === body ? 'content' : node.id || stableClass || node.tagName.toLowerCase();
      const index = occurrences.get(base) || 0; occurrences.set(base, index + 1);
      const backpackReading = name === 'backpack' && node.matches('.phone-v006-backpack-preview-read');
      const missionReading = name === 'mission-journal' && node.matches('.phone-mission-journal-reading');
      const selected = backpackReading ? modal.querySelector('.backpack-item-row.is-selected') : null;
      const selection = backpackReading ? JSON.stringify([modal.querySelector('#backpackPocketCurrent')?.dataset.backpackTab || '', selected?.dataset.backpackAction || '', selected?.dataset.backpackKind || '', selected?.dataset.backpackName || '']) : '';
      const missionSelection = missionReading ? modal.querySelector('[data-journal-select].is-selected')?.dataset.journalSelect || '' : '';
      const key = base + ':' + index + (backpackReading ? '|selection:' + selection : missionReading ? '|mission:' + missionSelection : ''); mark(node, 'phoneScrollKey', key);
      const reading = backpackReading || missionReading || node === body || name === 'research' && node.matches('.research-lab-content,.research-lab-detail-copy');
      return { node, key, initial: reading ? 'start' : 'source' };
    });
    runtime.setScreen(backdrop.classList.contains('open') ? { name, key: viewKey(modal, name, source) } : null, keyed);
  }
  function foldShipyardInfo() {
    if (document.documentElement.dataset.gameUi !== 'board-shipyard') return;
    if (document.querySelector('.screen')?.dataset.phoneShipLayout === 'pages') return;
    const dock = document.getElementById('dockPanel'); if (!dock) return;
    const stage = document.getElementById('shipStage'), upgrades = document.getElementById('upgradeMap');
    if (stage && upgrades && upgrades.parentElement !== dock) stage.after(upgrades);
    for (const [selector, label] of [['.foreman', '船塢說明'], ['.bonus-strip', '全隊效果與材料']]) {
      const content = document.querySelector(selector); if (!content || content.closest('.phone-shipyard-details')) continue;
      const details = document.createElement('details'); details.className = 'phone-shipyard-details';
      const summary = document.createElement('summary'); summary.textContent = label;
      details.append(summary, content); dock.append(details);
    }
  }
  function fitChessInfo() {
    if (document.documentElement.dataset.gameUi !== 'chess') return;
    const dock = document.querySelector('.battle-dock'), profile = document.getElementById('piece-profile');
    if (dock && profile && profile.parentElement !== dock) dock.prepend(profile);
  }
  function synchronize(context = {}) {
    const root = document.documentElement; if (!root || root.dataset.platform !== 'android') return;
    mark(root, 'phonePanels', '3'); foldShipyardInfo(); fitChessInfo();
    if (root.dataset.gameUi === 'board') {
      const modal = document.getElementById('boardModal'), backdrop = document.getElementById('boardModalBack');
      const onlySource = context.reasons?.length && context.reasons.every(reason => reason === 'source');
      const local = context.records?.filter(record => record.target === backdrop || modal?.contains(record.target)) || [];
      // A source quantity counter, typewritten word or portrait src does not
      // create another page. Native flow handles its new content directly.
      const textOrPortraitOnly = local.length && local.every(record => record.type === 'attributes' ? record.attributeName === 'src' : record.type === 'childList' && [...record.addedNodes, ...record.removedNodes].every(node => node.nodeType === Node.TEXT_NODE));
      if (onlySource && textOrPortraitOnly && (modal?.querySelector(bodies) || modal?.dataset.phoneShell === 'scene')) return;
      classifyModal(modal, backdrop);
    }
  }
  runtime.subscribe('phone-panel-contracts', synchronize, { roots: ['#boardModalBack', '#dockPanel', '#shipStage', '.foreman', '.bonus-strip', '.battle-dock', '#piece-profile'] });
  window.TabletopBoardPhonePanels = Object.freeze({
    snapshot: () => ({ normalizedRenders, classifications, screen: document.getElementById('boardModal')?.dataset.phoneScreen || '', contracts: screens.map(([name, drawer, selector]) => ({ name, drawer, selector })) })
  });
})();


/* Android presentation module: board-phone-opening */
(function () {
  'use strict';
  const origin = window.__TABLETOP_ANDROID_TEST_ORIGIN || 'https://onepiece-card-online.onrender.com';
  if (location.origin !== origin || !/\/board_game\.html$/i.test(location.pathname)) return;
  let scheduled = false;
  const records = new WeakMap();

  function adaptOpening() {
    const modal = document.getElementById('boardModal');
    const shell = modal?.querySelector('.draft-recruitment-shell');
    if (!shell) return;
    let dock = shell.querySelector(':scope > .board-phone-draft-dock');
    if (!dock) {
      dock = document.createElement('footer');
      dock.className = 'board-phone-draft-dock';
      dock.setAttribute('aria-label', '開局操作');
      shell.append(dock);
    }
    // The game binds these exact nodes after rendering. Moving them keeps the
    // original permission, disabled, animation, and click handlers intact.
    const primary = shell.querySelector('#confirmDraftOrderBtn,#recruitRollBtn,.draft-wheel-spin-btn');
    const saved = shell.querySelector('#setupLoadGameBtn');
    if (primary && primary.parentNode !== dock) dock.append(primary);
    if (saved && saved.parentNode !== dock) dock.append(saved);
    dock.classList.toggle('has-primary', Boolean(primary));
    // A nested overlay inherits the stage's lower stacking layer. Put the
    // original overlay beside the dock so its confirm action sits above it.
    const detail = shell.querySelector('#draftDetailOverlay');
    if (detail && detail.parentNode !== shell) shell.append(detail);

    // Order remains available on each wheel/candidate screen without taking
    // the height needed by the action and the character artwork.
    if (!shell.classList.contains('draft-mode-order')) {
      const order = shell.querySelector('.draft-voyage-order');
      if (order && !records.has(order)) {
        const disclosure = document.createElement('details');
        disclosure.className = 'board-phone-draft-order';
        const summary = document.createElement('summary');
        summary.textContent = '查看選角順序';
        disclosure.append(summary);
        order.parentNode.insertBefore(disclosure, order);
        disclosure.append(order);
        if (shell.classList.contains('draft-mode-wheel')) {
          const side = shell.querySelector('.draft-wheel-side:last-child');
          if (side) side.prepend(disclosure);
        }
        records.set(order, disclosure);
      }
    }
  }

  function schedule() {
    if (window.TabletopBoardPhoneLayout) { window.TabletopBoardPhoneLayout.request('opening'); return; }
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; adaptOpening(); });
  }
  function initialize() {
    if (window.TabletopBoardPhoneLayout) {
      window.TabletopBoardPhoneLayout.subscribe('opening', adaptOpening, { gameUis: ['board'], roots: ['#boardModal'] }); return;
    }
    schedule();
    new MutationObserver(schedule).observe(document.body, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden']
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();


/* Android presentation module: board-phone-dialog */
(function () {
  'use strict';
  const origin = window.__TABLETOP_ANDROID_TEST_ORIGIN || 'https://onepiece-card-online.onrender.com';
  if (location.origin !== origin || !/\/board_(?:game|fixed_viewport|battle)\.html$/.test(location.pathname) || window.__TABLETOP_PHONE_DIALOG__) return;
  window.__TABLETOP_PHONE_DIALOG__ = true;
  const scenes = '.final-ending-cinematic,.final-imu-descent,.final-robin-reading:not(.over-ritual),.final-activation-cinematic,.tavern-reveal-overlay,.prebattle-dialogue.is-open,.phase2-dialogue.is-open';
  const skipSelector = '#finalEndingSkipBtn,.final-story-skip-btn,.tavern-reveal-skip,.prebattle-skip-btn';
  // Measured original cutouts, visible alpha >=32. Other same-origin portraits
  // get a bounded canvas measurement on first load, cached per source image.
  const knownBottomGap = {
    "images/board/story/speakers/luffy_smile.webp": 0,
    "images/board/story/speakers/luffy_serious.webp": 0,
    "images/board/story/speakers/luffy_laugh.webp": 0,
    "images/board/story/speakers/luffy_reunion_laugh.webp": 0,
    "images/board/story/speakers/luffy_promise_serious.webp": 0,
    "images/board/story/speakers/luffy_angry_ace.webp": 0,
    "images/board/story/speakers/nami_chart.webp": 0,
    "images/board/story/speakers/nami_banquet_confused.webp": 0,
    "images/board/story/speakers/nami_shocked.webp": 0,
    "images/board/story/speakers/nami_smile.webp": 0,
    "images/board/story/speakers/nami_angry_warning.webp": 0,
    "images/board/story/speakers/robin_reading.webp": 0.068359375,
    "images/board/story/speakers/robin_poneglyph_focus.webp": 0,
    "images/board/story/speakers/robin_reveal.webp": 0,
    "images/board/story/speakers/robin_smile.webp": 0,
    "images/board/story/speakers/robin_sorrow.webp": 0,
    "images/board/story/speakers/zoro_calm.webp": 0,
    "images/board/story/speakers/zoro_ready_calm.webp": 0,
    "images/board/story/speakers/zoro_smirk.webp": 0,
    "images/board/story/speakers/zoro_banquet.webp": 0,
    "images/board/story/speakers/sanji_serious.webp": 0,
    "images/board/story/speakers/sanji_smoke_observe.webp": 0,
    "images/board/story/speakers/sanji_cry_smile.webp": 0,
    "images/board/story/speakers/sanji_cook.webp": 0,
    "images/board/story/speakers/jinbe_solemn.webp": 0,
    "images/board/story/speakers/jinbe_resolve.webp": 0,
    "images/board/story/speakers/jinbe_smile.webp": 0,
    "images/board/story/speakers/jinbe_angry_guard.webp": 0,
    "images/board/story/speakers/usopp_panic.webp": 0,
    "images/board/story/speakers/usopp_brave.webp": 0,
    "images/board/story/speakers/usopp_story.webp": 0,
    "images/board/story/speakers/usopp_yasopp_conflicted.webp": 0,
    "images/board/story/speakers/usopp_brave_sniper.webp": 0,
    "images/board/story/speakers/oden_carving.webp": 0,
    "images/board/story/speakers/oden_laugh.webp": 0,
    "images/board/story/speakers/roger_memory_serious.webp": 0,
    "images/board/story/speakers/roger_memory_laugh.webp": 0,
    "images/board/story/speakers/joyboy_message_apology.webp": 0,
    "images/board/story/speakers/joyboy_message_dawn.webp": 0,
    "images/board/story/speakers/joyboy_message_laugh.webp": 0,
    "images/board/story/speakers/vivi_royal_resolve.webp": 0,
    "images/board/story/speakers/vivi_lili_truth.webp": 0,
    "images/board/story/speakers/vivi_smile.webp": 0,
    "images/board/story/speakers/shirahoshi_prayer.webp": 0,
    "images/board/story/speakers/shirahoshi_cry_smile.webp": 0,
    "images/board/story/speakers/shirahoshi_resolve.webp": 0,
    "images/board/story/speakers/momonosuke_resolve.webp": 0,
    "images/board/story/speakers/momonosuke_command.webp": 0.06770833333333333,
    "images/board/story/speakers/momonosuke_dragon_command.webp": 0.007161458333333333,
    "images/board/story/speakers/momonosuke_dragon_dawn.webp": 0.022135416666666668,
    "images/board/story/speakers/brook_violin.webp": 0,
    "images/board/story/speakers/brook_cry_laugh.webp": 0,
    "images/board/story/speakers/brook_banquet.webp": 0,
    "images/board/story/speakers/franky_proud.webp": 0,
    "images/board/story/speakers/franky_cry.webp": 0,
    "images/board/story/speakers/franky_engineer.webp": 0,
    "images/board/story/speakers/chopper_worried.webp": 0,
    "images/board/story/speakers/chopper_happy.webp": 0,
    "images/board/story/speakers/chopper_determined.webp": 0,
    "images/board/story/speakers/bonney_resolve.webp": 0,
    "images/board/story/speakers/kuma_memory_smile.webp": 0,
    "images/board/story/speakers/lilith_explain.webp": 0,
    "images/board/story/speakers/sabo_command.webp": 0,
    "images/board/story/speakers/sabo_discovery_shock.webp": 0,
    "images/board/story/speakers/koala_worried.webp": 0,
    "images/board/story/speakers/koala_urgent_stop.webp": 0,
    "images/board/story/speakers/dragon_counterattack.webp": 0,
    "images/board/story/speakers/gorosei_mars_authority.webp": 0,
    "images/board/story/speakers/gorosei_mars_crumbling.webp": 0,
    "images/board/story/speakers/gorosei_warcury_contempt.webp": 0,
    "images/board/story/speakers/gorosei_warcury_crumbling.webp": 0,
    "images/board/story/speakers/gorosei_nusjuro_cold_judgement.webp": 0,
    "images/board/story/speakers/gorosei_nusjuro_crumbling.webp": 0,
    "images/board/story/speakers/gorosei_ju_peter_crumbling.webp": 0,
    "images/board/story/speakers/garling_crumbling.webp": 0,
    "images/board/story/speakers/bigmom_tea_party.webp": 0.04350828729281768,
    "images/board/story/speakers/bigmom_soul_pressure.webp": 0.0718232044198895,
    "images/board/story/speakers/bigmom_rage.webp": 0.0393646408839779,
    "images/board/story/speakers/shanks_calm.webp": 0,
    "images/board/story/speakers/shanks_pressure.webp": 0.09323204419889503,
    "images/board/story/speakers/shanks_smile.webp": 0,
    "images/board/story/speakers/shanks_reunion_smile.webp": 0,
    "images/board/story/speakers/shanks_serious_calm.webp": 0,
    "images/board/story/speakers/shanks_griffon_draw.webp": 0,
    "images/board/story/speakers/yasopp_father_smile.webp": 0.15950520833333334,
    "images/board/story/speakers/yasopp_serious_test.webp": 0.15885416666666666,
    "images/board/story/speakers/beckman_smoke_calm.webp": 0,
    "images/board/story/speakers/lucky_roux_laugh_meat.webp": 0,
    "images/board/story/speakers/lucky_roux_teasing_laugh.webp": 0,
    "images/board/story/speakers/kaido_human_grin.webp": 0,
    "images/board/story/speakers/kaido_rage.webp": 0,
    "images/board/story/speakers/kaido_beast_form.webp": 0.055248618784530384,
    "images/board/story/speakers/blackbeard_grin.webp": 0.07251381215469613,
    "images/board/story/speakers/blackbeard_dark_pressure.webp": 0.020027624309392266,
    "images/board/story/speakers/blackbeard_quake_rage.webp": 0.031767955801104975,
    "images/board/story/speakers/prometheus_homie.webp": 0.13397790055248618,
    "images/board/story/speakers/zeus_homie.webp": 0.21892265193370167,
    "images/board/story/speakers/napoleon_homie.webp": 0.03591160220994475,
    "images/board/story/speakers/imu_silhouette_calm.webp": 0,
    "images/board/story/speakers/imu_silhouette_threat.webp": 0.018229166666666668,
    "images/board/story/speakers/loki_serious.webp": 0,
    "images/board/story/speakers/loki_rage.webp": 0,
    "images/board/story/speakers/loki_smirk.webp": 0,
    "images/board/story/speakers/dorry_laugh.webp": 0.021484375,
    "images/board/story/speakers/dorry_angry.webp": 0,
    "images/board/story/speakers/brogy_laugh.webp": 0.06767955801104972,
    "images/board/story/speakers/brogy_angry.webp": 0.031767955801104975,
    "images/board/story/speakers/oimo_happy.webp": 0.008463541666666666,
    "images/board/story/speakers/oimo_shout.webp": 0,
    "images/board/story/speakers/kashi_laugh.webp": 0.03125,
    "images/board/story/speakers/kashi_shout.webp": 0.041666666666666664,
    "images/board/story/speakers/killingham_cold.webp": 0.049723756906077346,
    "images/board/story/speakers/killingham_retreat.webp": 0.10082872928176796,
    "images/board/story/speakers/sommers_cold.webp": 0,
    "images/board/story/speakers/sommers_shocked.webp": 0,
    "images/board/story/speakers/vegapunk_broadcast.webp": 0.026243093922651933,
    "images/board/story/speakers/zunesha_voice.webp": 0.015883977900552487,
    "images/board/story/speakers/giant_child_cry.webp": 0,
    "images/board/story/speakers/giant_child_smile.webp": 0,
    "images/board/tavern_recruit/crew_v3/zoro_accept.webp": 0,
    "images/board/tavern_recruit/crew_v3/zoro_decline.webp": 0,
    "images/board/tavern_recruit/crew_v3/nami_accept.webp": 0.008463541666666666,
    "images/board/tavern_recruit/crew_v3/nami_decline.webp": 0.007161458333333333,
    "images/board/tavern_recruit/crew_v3/usopp_accept.webp": 0.009765625,
    "images/board/tavern_recruit/crew_v3/usopp_decline.webp": 0,
    "images/board/tavern_recruit/crew_v3/sanji_accept.webp": 0.010416666666666666,
    "images/board/tavern_recruit/crew_v3/sanji_decline.webp": 0,
    "images/board/tavern_recruit/crew_v3/chopper_accept.webp": 0.051432291666666664,
    "images/board/tavern_recruit/crew_v3/chopper_decline.webp": 0.0234375,
    "images/board/tavern_recruit/crew_v3/robin_accept.webp": 0,
    "images/board/tavern_recruit/crew_v3/robin_decline.webp": 0.005859375,
    "images/board/tavern_recruit/crew_v3/franky_accept.webp": 0.012369791666666666,
    "images/board/tavern_recruit/crew_v3/franky_decline.webp": 0.01171875,
    "images/board/tavern_recruit/crew_v3/brook_accept.webp": 0.0026041666666666665,
    "images/board/tavern_recruit/crew_v3/brook_decline.webp": 0.001953125,
    "images/board/tavern_recruit/crew_v3/jinbe_accept.webp": 0.009114583333333334,
    "images/board/tavern_recruit/crew_v3/jinbe_decline.webp": 0,
    "images/board/story/opening/roger_execution_calm.webp": 0.022786458333333332,
    "images/board/story/opening/roger_execution_smile.webp": 0.02734375,
    "images/board/story/speakers/island_intro_shopkeeper.webp": 0.016927083333333332,
    "images/board/story/speakers/island_intro_crocus.webp": 0.00390625,
    "images/board/tavern_recruit/characters/tavern_owner_makino.webp": 0,
    "images/board/story/speakers/luffy_pre_timeskip_tavern_invite.webp": 0,
    "images/board/mission_island/morgans_open.webp": 0,
    "images/board/water_seven/paulie.webp": 0,
    "images/board/story/speakers/luffy_pre_timeskip_enies.webp": 0,
    "images/board/story/speakers/island_intro_spandam.webp": 0,
    "images/board/story/speakers/island_intro_magellan.webp": 0,
    "images/board/story/speakers/luffy_pre_timeskip_war.webp": 0,
    "images/board/story/aokiji_capture/source/aokiji_capture_serious_v3.webp": 0,
    "images/board/story/aokiji_capture/source/aokiji_capture_lazy_v3.webp": 0,
    "images/board/story/aokiji_capture/source/aokiji_capture_mercy_v3.webp": 0,
    "images/board/story/speakers/york_explain.webp": 0,
    "images/board/battle/enemies/postgame_rocks/normal.webp": 0,
    "images/board/battle/enemies/postgame_rocks/angry.webp": 0,
    "images/board/final_island/robin_reading_cutout.webp": 0,
    "images/board/final_island/final_imu_silhouette.png": 0.015883977900552487
  };
  // Approved mask pairs keep their effective visible silhouette boundary.
  const knownMaskedBottomGap = {
    "images/board/battle/portraits/luffy/normal.webp|images/board-depth/v1/images-board-battle-portraits-luffy-normal-39d7be69/mask.webp": 0,
    "images/board/battle/portraits/zoro/normal.webp|images/board-depth/v1/images-board-battle-portraits-zoro-normal-51c81b3e/mask.webp": 0,
    "images/board/battle/portraits/nami/normal.webp|images/board-depth/v1/images-board-battle-portraits-nami-normal-c7027f1b/mask.webp": 0,
    "images/board/battle/portraits/sanji/normal.webp|images/board-depth/v1/images-board-battle-portraits-sanji-normal-3c59b7fd/mask.webp": 0,
    "images/board/battle/portraits/law/normal.webp|images/board-depth/v1/images-board-battle-portraits-law-normal-01677cc8/mask.webp": 0,
    "images/board/battle/portraits/robin/normal.webp|images/board-depth/v1/images-board-battle-portraits-robin-normal-85d13df7/mask.webp": 0,
    "images/board/battle/portraits/hancock/normal.webp|images/board-depth/v1/images-board-battle-portraits-hancock-normal-9446bf7d/mask.webp": 0,
    "images/board/battle/portraits/carrot/normal.webp|images/board-depth/v1/images-board-battle-portraits-carrot-normal-60590140/mask.webp": 0,
    "images/board/battle/portraits/ace/normal.webp|images/board-depth/v1/images-board-battle-portraits-ace-normal-4c093bd8/mask.webp": 0,
    "images/board/battle/portraits/sabo/normal.webp|images/board-depth/v1/images-board-battle-portraits-sabo-normal-7efc8cd8/mask.webp": 0,
    "images/board/battle/portraits/yamato/normal.webp|images/board-depth/v1/images-board-battle-portraits-yamato-normal-08351291/mask.webp": 0,
    "images/board/battle/portraits/corazon/normal.webp|images/board-depth/v1/images-board-battle-portraits-corazon-normal-7be1148b/mask.webp": 0,
    "images/board/battle/portraits/usopp/normal.webp|images/board-depth/v1/images-board-battle-portraits-usopp-normal-193dc9f3/mask.webp": 0,
    "images/board/battle/portraits/chopper/normal.webp|images/board-depth/v1/images-board-battle-portraits-chopper-normal-cdd98d88/mask.webp": 0,
    "images/board/battle/portraits/jinbe/normal.webp|images/board-depth/v1/images-board-battle-portraits-jinbe-normal-52dbcc95/mask.webp": 0,
    "images/board/battle/portraits/brook/normal.webp|images/board-depth/v1/images-board-battle-portraits-brook-normal-20590358/mask.webp": 0,
    "images/board/battle/portraits/franky/normal.webp|images/board-depth/v1/images-board-battle-portraits-franky-normal-b14dd5e1/mask.webp": 0,
    "images/board/battle/portraits/oden/normal.webp|images/board-depth/v1/images-board-battle-portraits-oden-normal-a2da32c1/mask.webp": 0,
    "images/board/battle/portraits/rayleigh/normal.webp|images/board-depth/v1/images-board-battle-portraits-rayleigh-normal-6cdcb9eb/mask.webp": 0,
    "images/board/battle/portraits/garp/normal.webp|images/board-depth/v1/images-board-battle-portraits-garp-normal-b37791ad/mask.webp": 0,
    "images/board/battle/portraits/vivi/normal.webp|images/board-depth/v1/images-board-battle-portraits-vivi-normal-5a81a841/mask.webp": 0,
    "images/board/battle/portraits/koby/normal.webp|images/board-depth/v1/images-board-battle-portraits-koby-normal-88ff72ff/mask.webp": 0,
    "images/board/battle/portraits/smoker/normal.webp|images/board-depth/v1/images-board-battle-portraits-smoker-normal-f52f21b8/mask.webp": 0,
    "images/board/battle/portraits/tashigi/normal.webp|images/board-depth/v1/images-board-battle-portraits-tashigi-normal-53fd09ad/mask.webp": 0,
    "images/board/battle/portraits/kuzan/normal.webp|images/board-depth/v1/images-board-battle-portraits-kuzan-normal-3097ddd2/mask.webp": 0,
    "images/board/battle/portraits/fujitora/normal.webp|images/board-depth/v1/images-board-battle-portraits-fujitora-normal-e3c8f64c/mask.webp": 0,
    "images/board/battle/portraits/bartolomeo/normal.webp|images/board-depth/v1/images-board-battle-portraits-bartolomeo-normal-f1f8cc45/mask.webp": 0,
    "images/board/battle/portraits/cavendish/normal.webp|images/board-depth/v1/images-board-battle-portraits-cavendish-normal-cd678de0/mask.webp": 0,
    "images/board/battle/portraits/kinemon/normal.webp|images/board-depth/v1/images-board-battle-portraits-kinemon-normal-d885013c/mask.webp": 0,
    "images/board/battle/portraits/ivankov/normal.webp|images/board-depth/v1/images-board-battle-portraits-ivankov-normal-a5d92351/mask.webp": 0,
    "images/board/battle/portraits/kuma/normal.webp|images/board-depth/v1/images-board-battle-portraits-kuma-normal-3dc935c7/mask.webp": 0,
    "images/board/battle/portraits/dragon/normal.webp|images/board-depth/v1/images-board-battle-portraits-dragon-normal-39d9a146/mask.webp": 0,
    "images/board/battle/portraits/kid/normal.webp|images/board-depth/v1/images-board-battle-portraits-kid-normal-a3cdfe42/mask.webp": 0,
    "images/board/battle/portraits/killer/normal.webp|images/board-depth/v1/images-board-battle-portraits-killer-normal-09bd0852/mask.webp": 0,
    "images/board/battle/portraits/perona/normal.webp|images/board-depth/v1/images-board-battle-portraits-perona-normal-60acb7f5/mask.webp": 0,
    "images/board/battle/portraits/mansherry/normal.webp|images/board-depth/v1/images-board-battle-portraits-mansherry-normal-1e966ac6/mask.webp": 0,
    "images/board/battle/portraits/whitebeard/normal.webp|images/board-depth/v1/images-board-battle-portraits-whitebeard-normal-664e7eb1/mask.webp": 0,
    "images/board/battle/portraits/jozu/normal.webp|images/board-depth/v1/images-board-battle-portraits-jozu-normal-c853e856/mask.webp": 0,
    "images/board/battle/portraits/vista/normal.webp|images/board-depth/v1/images-board-battle-portraits-vista-normal-529af53a/mask.webp": 0,
    "images/board/battle/portraits/izo/normal.webp|images/board-depth/v1/images-board-battle-portraits-izo-normal-befd4a15/mask.webp": 0,
    "images/board/battle/portraits/little_oars_jr/normal.webp|images/board-depth/v1/images-board-battle-portraits-little-oars-jr-normal-39070164/mask.webp": 0,
    "images/board/battle/portraits/squard/normal.webp|images/board-depth/v1/images-board-battle-portraits-squard-normal-9f988eff/mask.webp": 0,
    "images/board/battle/portraits/marco/normal.webp|images/board-depth/v1/images-board-battle-portraits-marco-normal-c0a1075a/mask.webp": 0,
    "images/board/battle/portraits/prison_buggy/normal.webp|images/board-depth/v1/images-board-battle-portraits-prison-buggy-normal-87f74bbc/mask.webp": 0,
    "images/board/battle/portraits/prison_mr3/normal.webp|images/board-depth/v1/images-board-battle-portraits-prison-mr3-normal-5456a35a/mask.webp": 0,
    "images/board/battle/portraits/prison_mr2_bon_clay/normal.webp|images/board-depth/v1/images-board-battle-portraits-prison-mr2-bon-clay-normal-f0d21b7f/mask.webp": 0,
    "images/board/battle/portraits/prison_mr1_daz_bones/normal.webp|images/board-depth/v1/images-board-battle-portraits-prison-mr1-daz-bones-normal-2730eb83/mask.webp": 0,
    "images/board/battle/portraits/prison_crocodile/normal.webp|images/board-depth/v1/images-board-battle-portraits-prison-crocodile-normal-2e1a0289/mask.webp": 0,
    "images/board/battle/portraits/uta/normal.webp|images/board-depth/v1/images-board-battle-portraits-uta-normal-e6d4ed1b/mask.webp": 0,
    "images/board/battle/portraits/mihawk/normal.webp|images/board-depth/v1/images-board-battle-portraits-mihawk-normal-e9fa694b/mask.webp": 0,
    "images/board/battle/portraits/roger/normal.webp|images/board-depth/v1/images-board-battle-portraits-roger-normal-37629423/mask.webp": 0,
    "images/board/battle/portraits/evolutions/luffy_gear_second/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-luffy-gear-second-normal-d35adcec/mask.webp": 0,
    "images/board/battle/portraits/evolutions/zoro_santoryu_plus/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-zoro-santoryu-plus-normal-cfe848a5/mask.webp": 0,
    "images/board/battle/portraits/evolutions/nami_clima_tact_plus/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-nami-clima-tact-plus-normal-3f2f95eb/mask.webp": 0,
    "images/board/battle/portraits/evolutions/sanji_diable_jambe/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-sanji-diable-jambe-normal-7f20ee9b/mask.webp": 0,
    "images/board/battle/portraits/evolutions/chopper_rumble_ball_plus/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-chopper-rumble-ball-plus-normal-b3ced4f4/mask.webp": 0,
    "images/board/battle/portraits/evolutions/usopp_sogeking/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-usopp-sogeking-normal-b706f41f/mask.webp": 0,
    "images/board/battle/portraits/evolutions/robin_cien_fleur/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-robin-cien-fleur-normal-83263c37/mask.webp": 0,
    "images/board/battle/portraits/evolutions/franky_weapon_left/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-franky-weapon-left-normal-d0ab3ed6/mask.webp": 0,
    "images/board/battle/portraits/evolutions/brook_yomi_swordsman/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-brook-yomi-swordsman-normal-d3ad5f53/mask.webp": 0,
    "images/board/battle/portraits/evolutions/carrot_moon_lion/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-carrot-moon-lion-normal-100908b4/mask.webp": 0,
    "images/board/battle/portraits/evolutions/luffy_evolution_2/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-luffy-evolution-2-normal-88e2dbd6/mask.webp": 0,
    "images/board/battle/portraits/evolutions/luffy_gear_fifth/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-luffy-gear-fifth-normal-824ddec2/mask.webp": 0,
    "images/board/battle/portraits/evolutions/zoro_evolution_2/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-zoro-evolution-2-normal-183446b9/mask.webp": 0,
    "images/board/battle/portraits/evolutions/zoro_zorojuro/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-zoro-zorojuro-normal-fabb3e54/mask.webp": 0,
    "images/board/battle/portraits/evolutions/nami_evolution_2/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-nami-evolution-2-normal-9dbc5f03/mask.webp": 0,
    "images/board/battle/portraits/evolutions/sanji_evolution_2/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-sanji-evolution-2-normal-7f3faef2/mask.webp": 0,
    "images/board/battle/portraits/evolutions/usopp_evolution_2/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-usopp-evolution-2-normal-75d1c339/mask.webp": 0,
    "images/board/battle/portraits/evolutions/chopper_evolution_2/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-chopper-evolution-2-normal-9227795d/mask.webp": 0,
    "images/board/battle/portraits/evolutions/law_new_world/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-law-new-world-normal-54b717bd/mask.webp": 0,
    "images/board/battle/portraits/evolutions/smoker_new_world/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-smoker-new-world-normal-af57fa8a/mask.webp": 0,
    "images/board/battle/portraits/evolutions/tashigi_new_world/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-tashigi-new-world-normal-63675d3e/mask.webp": 0,
    "images/board/battle/portraits/evolutions/kid_new_world/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-kid-new-world-normal-3debfff2/mask.webp": 0,
    "images/board/battle/portraits/evolutions/perona_new_world/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-perona-new-world-normal-71eb7931/mask.webp": 0,
    "images/board/battle/portraits/evolutions/rayleigh_young/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-rayleigh-young-normal-964e02e5/mask.webp": 0,
    "images/board/battle/portraits/evolutions/koby_colonel/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-koby-colonel-normal-603350b4/mask.webp": 0,
    "images/board/battle/portraits/evolutions/whitebeard_evolution_1/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-whitebeard-evolution-1-normal-a2c7f218/mask.webp": 0,
    "images/board/battle/portraits/evolutions/kuzan_evolution_1/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-kuzan-evolution-1-normal-4ba14f4d/mask.webp": 0,
    "images/board/battle/portraits/evolutions/mihawk_evolution_1/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-mihawk-evolution-1-normal-94ce4880/mask.webp": 0,
    "images/board/battle/portraits/evolutions/roger_evolution_1/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-roger-evolution-1-normal-bca144bb/mask.webp": 0,
    "images/board/battle/portraits/evolutions/prison_buggy_escape_alliance/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-prison-buggy-escape-alliance-no-b7ed6bb4/mask.webp": 0,
    "images/board/battle/portraits/evolutions/prison_mr3_candle_strategist/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-prison-mr3-candle-strategist-no-a7b817ed/mask.webp": 0,
    "images/board/battle/portraits/evolutions/prison_mr1_steel_blade/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-prison-mr1-steel-blade-normal-ff6dff7f/mask.webp": 0,
    "images/board/battle/portraits/evolutions/prison_crocodile_desert_alliance/normal.webp|images/board-depth/v1/images-board-battle-portraits-evolutions-prison-crocodile-desert-allianc-b8a70ff1/mask.webp": 0
  };
  const framedPlaceholder = new Set(["images/board/battle/portraits/placeholder/normal.webp"]);
  const imageBounds = new WeakMap(), waitingImages = new WeakSet();
  let scheduled = false, railFrame = 0;
  const menus = new WeakMap();
  let activeMenuScene = null;
  function setHidden(node, hidden) { if (node.hidden !== hidden) node.hidden = hidden; }
  function setPosition(node, key, value) { if (node.style.getPropertyValue(key) !== value) node.style.setProperty(key, value); }

  function closeMenu(scene) {
    const menu = menus.get(scene);
    if (!menu) return;
    scene.dataset.phoneMenuOpen = 'false';
    setHidden(menu.sheet, true);
    menu.entry.setAttribute('aria-expanded', 'false');
    const prev = scene.querySelector('#finalEndingPrevBtn');
    if (prev) { setHidden(prev, true); prev.inert = true; }
    if (activeMenuScene === scene) activeMenuScene = null;
  }

  function positionPrevious(scene) {
    const menu = menus.get(scene), prev = scene.querySelector('#finalEndingPrevBtn');
    if (!menu || !prev) return;
    const opened = scene.dataset.phoneMenuOpen === 'true';
    setHidden(menu.previousSlot, !prev);
    if (!opened) { setHidden(prev, true); prev.inert = true; return; }
    const r = menu.previousSlot.getBoundingClientRect(), s = menu.sheet.getBoundingClientRect();
    const visible = r.top >= s.top + 4 && r.bottom <= s.bottom - 4;
    setHidden(prev, !visible); prev.inert = !visible;
    if (visible) {
      setPosition(prev, '--phone-prev-x', `${r.left}px`);
      setPosition(prev, '--phone-prev-y', `${r.top}px`);
      setPosition(prev, '--phone-prev-width', `${r.width}px`);
    }
  }

  function organizeMenu(scene) {
    let menu = menus.get(scene);
    if (!menu) {
      const entry = document.createElement('button');
      entry.type = 'button'; entry.className = 'phone-story-menu-toggle';
      entry.setAttribute('aria-label', '劇情選單'); entry.setAttribute('aria-expanded', 'false');
      const sheet = document.createElement('div');
      sheet.className = 'phone-story-menu'; sheet.hidden = true;
      sheet.setAttribute('role', 'region'); sheet.setAttribute('aria-label', '劇情選單');
      const previousSlot = document.createElement('div');
      previousSlot.className = 'phone-menu-prev-slot'; previousSlot.hidden = true;
      previousSlot.setAttribute('aria-hidden', 'true'); sheet.append(previousSlot);
      menu = { entry, sheet, previousSlot }; menus.set(scene, menu);
      entry.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        if (scene.dataset.phoneMenuOpen === 'true') { closeMenu(scene); return; }
        if (activeMenuScene) closeMenu(activeMenuScene);
        scene.dataset.phoneMenuOpen = 'true'; setHidden(sheet, false); sheet.scrollTop = 0;
        entry.setAttribute('aria-expanded', 'true'); activeMenuScene = scene;
        positionPrevious(scene);
      });
      sheet.addEventListener('click', event => event.stopPropagation());
      sheet.addEventListener('scroll', () => positionPrevious(scene), { passive: true });
      scene.append(sheet, entry);
    }
    // Auto/speed/skip have direct source listeners, bound only once per story
    // session. Keep this exact toolbar in the stable scene, outside dialogue's
    // innerHTML replacement. Previous/next/branches rely on dialogue delegation:
    // previous stays in its source DOM and is positioned over this placeholder.
    const toolbar = scene.querySelector('.final-ending-playback-controls');
    if (toolbar && toolbar.parentElement !== menu.sheet) menu.sheet.append(toolbar);
    const captionToggle = scene.querySelector('.phone-caption-toggle');
    if (captionToggle && captionToggle.parentElement !== menu.sheet) menu.sheet.append(captionToggle);
    scene.querySelectorAll(skipSelector).forEach(node => {
      // Keep the exact once-bound source skip outside the rebuilding caption
      // and the low-frequency menu. Source hidden/disabled permissions survive.
      if (node.parentElement !== scene) scene.append(node);
      if (node.textContent !== '跳過') node.textContent = '跳過';
      node.dataset.phoneDirectSkip = 'true';
      node.setAttribute('aria-label', '跳過這段劇情');
    });
    setHidden(menu.previousSlot, !scene.querySelector('#finalEndingPrevBtn'));
    positionPrevious(scene);
  }

  function positionEntry(scene) {
    const menu = menus.get(scene);
    if (!menu) return;
    const selectors = '.final-ending-dialogue,.final-imu-dialogue,.final-robin-dialogue,.tavern-reveal-invitation,.tavern-reveal-caption,.prebattle-quote';
    const candidates = Array.from(scene.querySelectorAll(selectors)).filter(node => {
      const r = node.getBoundingClientRect();
      return !node.closest('[hidden]') && getComputedStyle(node).display !== 'none' && r.width > 1 && r.height > 1;
    });
    let caption = candidates.at(-1);
    if (scene.classList.contains('tavern-reveal-overlay')) {
      caption = scene.querySelector(scene.dataset.stage === 'choice' ? '.tavern-reveal-caption' : '.tavern-reveal-invitation');
    }
    if (!caption) { menu.entry.dataset.phoneRail = 'false'; return; }
    const r = caption.getBoundingClientRect();
    const sr=scene.getBoundingClientRect();
    const skip=Array.from(scene.querySelectorAll(skipSelector)).find(node=>{
      const q=node.getBoundingClientRect();return !node.hidden&&getComputedStyle(node).display!=='none'&&q.width>1&&q.height>1;
    });
    const skipRect=skip?.getBoundingClientRect();
    // The entrance is a stable scene node. Put its transparent 48px cell next
    // to the original Skip without moving the delegated Previous out of copy.
    const left=skipRect?skipRect.left-52:sr.right-8-48;
    setPosition(menu.entry, '--phone-entry-x', `${left}px`);
    setPosition(menu.entry, '--phone-entry-y', `${skipRect?skipRect.top:sr.top+4}px`);
    // The ending portrait remains in its source caption ancestry (z30) while
    // this sheet is z20 so its delegated Previous can sit above it. Use the
    // character's opposite side; a pointer-transparent portrait must not paint
    // over Auto/Speed even when hit-testing would still succeed.
    const sheetRight=scene.matches('.final-ending-cinematic')
      ? innerWidth - r.left - 8 - Math.min(280,innerWidth*.48)
      : innerWidth - r.right + 8;
    setPosition(menu.sheet, '--phone-sheet-right', `${sheetRight}px`);
    setPosition(menu.sheet, '--phone-sheet-bottom', `${innerHeight - r.top + 8}px`);
    setPosition(menu.sheet, '--phone-sheet-max-height', `${Math.max(80, r.top - 16)}px`);
    menu.entry.dataset.phoneRail = 'true';
  }

  function scheduleRailLayout() {
    if (railFrame) return;
    // Other subscribers finish normalizing the original scene controls in
    // this transaction. Measure once on the next frame, after those writes,
    // rather than relying on another observer loop to correct stale bounds.
    railFrame = requestAnimationFrame(() => {
      railFrame = 0;
      const measure = () => document.querySelectorAll(scenes).forEach(positionEntry);
      if (window.TabletopBoardPhoneLayout) window.TabletopBoardPhoneLayout.withOwnedDOM(measure);
      else measure();
    });
  }

  function labelToggle(scene, button) {
    const hidden = scene.dataset.phoneCaptionHidden === 'true';
    const label = hidden ? '顯示字幕' : '看場景';
    if (button.textContent !== label) button.textContent = label;
    button.setAttribute('aria-expanded', String(!hidden));
    button.setAttribute('aria-label', hidden ? '顯示這段劇情的字幕與選項' : '暫時收起字幕，查看完整場景');
  }

  function mountToggle(scene) {
    let toggle = scene.querySelector('.phone-caption-toggle');
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'phone-caption-toggle';
      // This is a presentation action. It never calls a next/skip/choice control.
      toggle.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const hidden = scene.dataset.phoneCaptionHidden !== 'true';
        scene.dataset.phoneCaptionHidden = String(hidden);
        labelToggle(scene, toggle);
        closeMenu(scene);
      });
      scene.append(toggle);
    }
    labelToggle(scene, toggle);
  }

  function organizeImu(dialogue) {
    if (dialogue.querySelector(':scope > .phone-imu-copy')) return;
    const paragraphs = Array.from(dialogue.children).filter(node => node.matches('p'));
    if (!paragraphs.length) return;
    const copy = document.createElement('div');
    copy.className = 'phone-imu-copy';
    copy.setAttribute('tabindex', '0');
    copy.setAttribute('aria-label', '伊姆劇情字幕，可上下捲動');
    paragraphs[0].before(copy);
    paragraphs.forEach(node => copy.append(node));
  }

  function alignBottomArt(img) {
    if (!img.complete || !img.naturalWidth) {
      if (!waitingImages.has(img)) { waitingImages.add(img); img.addEventListener('load', schedule); }
      return;
    }
    const url=img.currentSrc || img.src,mask=img.dataset.portraitMask || '';
    let bounds=imageBounds.get(img);
    if (!bounds || bounds.url!==url || bounds.mask!==mask) {
      const pathname=new URL(url,location.href).pathname;
      const key=pathname.slice(pathname.indexOf('/images/board/')+1);
      const maskedKey=`${key}|${mask}`;
      if(mask&&Object.hasOwn(knownMaskedBottomGap,maskedKey))bounds={url,gap:knownMaskedBottomGap[maskedKey],method:'compiled-mask-alpha32'};
      else if(mask)bounds={url,gap:0,method:'mask-metadata-unavailable'};
      else if(framedPlaceholder.has(key))bounds={url,gap:0,method:'framed-placeholder'};
      else if (Object.hasOwn(knownBottomGap,key)) bounds={url,gap:knownBottomGap[key],method:'measured-alpha32'};
      else {
        try {
          const scale=Math.min(1,512/img.naturalWidth,512/img.naturalHeight),canvas=document.createElement('canvas');
          canvas.width=Math.max(1,Math.round(img.naturalWidth*scale)); canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
          const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(img,0,0,canvas.width,canvas.height);
          const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
          let bottom=canvas.height-1,found=false;
          for(;bottom>=0&&!found;bottom--)for(let x=0;x<canvas.width;x++)if(pixels[(bottom*canvas.width+x)*4+3]>=32){found=true;break;}
          bounds={url,gap:found?(canvas.height-bottom-2)/canvas.height:0,method:found?'sampled-alpha32':'no-visible-alpha'};
        } catch { bounds={url,gap:0,method:'canvas-unavailable'}; }
      }
      bounds.mask=mask;imageBounds.set(img,bounds);
    }
    const containedHeight=Math.min(img.clientWidth/img.naturalWidth,img.clientHeight/img.naturalHeight)*img.naturalHeight;
    setPosition(img,'--phone-art-offset',`${Math.max(0,bounds.gap*containedHeight)}px`);
    img.dataset.phoneAlphaAlign=bounds.method;
  }

  function refresh() {
    scheduled = false;
    if (document.documentElement?.dataset.platform !== 'android') return;
    if (document.documentElement.dataset.phoneDialog !== '5') document.documentElement.dataset.phoneDialog = '5';
    if (activeMenuScene && (!activeMenuScene.isConnected || (activeMenuScene.matches('.prebattle-dialogue,.phase2-dialogue') && !activeMenuScene.classList.contains('is-open')))) closeMenu(activeMenuScene);
    document.querySelectorAll(scenes).forEach(mountToggle);
    document.querySelectorAll(scenes).forEach(organizeMenu);
    document.querySelectorAll('.final-ending-dialogue').forEach(dialogue => {
      const body = dialogue.querySelector('.final-ending-dialogue-body');
      dialogue.dataset.phoneSpeaker = body?.querySelector('.final-ending-speaker') ? 'true' : 'false';
      dialogue.dataset.phoneChoices = body?.querySelector('.final-ending-inline-choices') ? 'true' : 'false';
      const next = body?.querySelector('#finalEndingNextBtn');
      if (next) next.setAttribute('aria-label', (next.textContent || '').trim() || '繼續劇情');
      body?.querySelectorAll('.final-ending-inline-choice').forEach(choice => {
        // Wide choices show all source copy in two lines; swipe the strip to
        // read a long choice rather than hiding words or shrinking the font.
        const width = Math.max(240, Math.ceil(Array.from((choice.textContent || '').trim()).length / 2) * 16 + 24);
        setPosition(choice, '--phone-choice-width', `${width}px`);
      });
    });
    document.querySelectorAll('.final-imu-dialogue').forEach(organizeImu);
    document.querySelectorAll('.tavern-reveal-overlay').forEach(overlay => {
      // The source scenery is larger than the viewport and translated to its
      // centre. Keep the exact host frame on the stable viewport overlay.
      const host=overlay.querySelector('.tavern-reveal-host-frame');
      if(host&&host.parentElement!==overlay)overlay.append(host);
    });
    document.querySelectorAll('.final-imu-dialogue').forEach(dialogue => {
      dialogue.dataset.phoneActionCount = String(dialogue.querySelectorAll('.final-imu-actions button').length);
    });
    document.querySelectorAll('.final-ending-lines,.final-robin-line,.phone-imu-copy,.prebattle-text,.tavern-reveal-line').forEach(node => {
      if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '0');
    });
    document.querySelectorAll('.final-ending-speaker-portrait img,.final-imu-figure img,.final-robin-portrait img,.tavern-reveal-host,.tavern-reveal-choice-portrait').forEach(alignBottomArt);
    scheduleRailLayout();
  }
  function schedule() { if (window.TabletopBoardPhoneLayout) { window.TabletopBoardPhoneLayout.request('dialogue'); return; } if (!scheduled) { scheduled = true; requestAnimationFrame(refresh); } }
  function initialize() {
    // Keep every source button, its disabled state, event handler, and story text.
    if (window.TabletopBoardPhoneLayout) window.TabletopBoardPhoneLayout.subscribe('dialogue', refresh, { gameUis: ['board','board-battle'], roots: ['#boardModalBack', '.prebattle-dialogue', '.phase2-dialogue', '.tavern-reveal-overlay'] });
    else new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'src'] });
    // Source scenes may finish a caption entrance without a DOM mutation.
    // Recompute the stable rail from its final bounds, including popup slots.
    for (const type of ['animationend', 'transitionend']) document.addEventListener(type, event => {
      if (event.target.closest?.(scenes)) schedule();
    }, true);
    schedule();
    window.addEventListener('pagehide', () => {
      if (railFrame) cancelAnimationFrame(railFrame);
      railFrame = 0;
    });
    const pointers = new Map();
    let suppress = null;
    const scrollers = '.phone-imu-copy,.final-ending-lines,.final-robin-line,.prebattle-text,.tavern-reveal-line,.final-ending-inline-choices,.phone-story-menu';
    document.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'touch') return;
      const node = event.target.closest?.(scrollers);
      if (node && (node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1)) pointers.set(event.pointerId, { node, x: event.clientX, y: event.clientY, moved: false });
    }, { capture: true, passive: true });
    document.addEventListener('pointermove', event => {
      const p = pointers.get(event.pointerId);
      if (p && Math.hypot(event.clientX - p.x, event.clientY - p.y) > 8) p.moved = true;
    }, { capture: true, passive: true });
    const finish = event => {
      const p = pointers.get(event.pointerId);
      if (p?.moved) suppress = { node: p.node, until: performance.now() + 700 };
      pointers.delete(event.pointerId);
    };
    document.addEventListener('pointerup', finish, { capture: true, passive: true });
    document.addEventListener('pointercancel', finish, { capture: true, passive: true });
    document.addEventListener('click', event => {
      if (activeMenuScene && !activeMenuScene.isConnected) activeMenuScene = null;
      if (activeMenuScene) {
        const menu = menus.get(activeMenuScene);
        const directSkip = event.target.closest?.('[data-phone-direct-skip="true"]');
        if (directSkip && activeMenuScene.contains(directSkip)) {
          // Closing a popup must not consume this direct source action. Let the
          // same tap reach its real callback instead of requiring a second tap.
          closeMenu(activeMenuScene); return;
        }
        const prev = event.target.closest?.('#finalEndingPrevBtn');
        if (prev && activeMenuScene.contains(prev)) {
          // Allow the original delegated previous handler to run, then close.
          const scene = activeMenuScene; setTimeout(() => closeMenu(scene), 0);
          return;
        }
        if (menu && !menu.sheet.contains(event.target) && !menu.entry.contains(event.target)) {
          closeMenu(activeMenuScene); event.preventDefault(); event.stopImmediatePropagation(); return;
        }
      }
      if (suppress && performance.now() < suppress.until && suppress.node.contains(event.target)) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }, true);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && activeMenuScene) {
        closeMenu(activeMenuScene); event.preventDefault(); event.stopImmediatePropagation();
      }
    }, true);
    window.addEventListener('resize', () => { schedule(); if (activeMenuScene) positionPrevious(activeMenuScene); }, { passive: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();


/* Android presentation module: board-phone-static-map-data */
/* Generated by build-static-map-v025.mjs from verified existing art. */
window.TabletopPhoneStaticMapData={"width":5120,"height":3976,"pixels":[5120,3976],"decorations":[["images/board/decorations/sea_beasts/sea_beast_01.webp",2670,1259,200,0],["images/board/decorations/sea_beasts/sea_beast_02.webp",3129,1760,320,0],["images/board/decorations/sea_beasts/sea_beast_03.webp",3474,2976,360,0],["images/board/decorations/sea_beasts/sea_beast_04.webp",3861,936,360,0],["images/board/decorations/sea_beasts/sea_beast_05.webp",4224,2134,360,0],["images/board/decorations/sea_beasts/sea_beast_06.webp",4569,1352,360,0],["images/board/decorations/sea_beasts/sea_beast_07.webp",2741,2521,360,0],["images/board/decorations/reefs/reef_02.webp",2290,2607,120,0],["images/board/decorations/reefs/reef_02.webp",2628,2383,60,0],["images/board/decorations/reefs/reef_02.webp",3093,2539,80,0],["images/board/decorations/reefs/reef_02.webp",3552,2201,120,0],["images/board/decorations/reefs/reef_02.webp",3904,1469,160,0],["images/board/decorations/reefs/reef_02.webp",3957,2994,120,0],["images/board/decorations/reefs/reef_02.webp",2908,2905,200,0],["images/board/decorations/reefs/reef_02.webp",2581,1992,80,0],["images/board/decorations/reefs/reef_02.webp",3570,1618,80,0],["images/board/decorations/reefs/reef_02.webp",3932,2720,80,0],["images/board/decorations/reefs/reef_02.webp",4583,939,160,0],["images/board/decorations/reefs/reef_02.webp",4487,2838,120,0],["images/board/decorations/reefs/reef_02.webp",4657,1732,120,0],["images/board/decorations/reefs/reef_03.webp",2013,1849,120,0],["images/board/decorations/reefs/reef_03.webp",2731,1739,80,0],["images/board/decorations/reefs/reef_03.webp",3179,2578,120,0],["images/board/decorations/reefs/reef_03.webp",3669,3303,200,0],["images/board/decorations/reefs/reef_03.webp",3424,1334,160,0],["images/board/decorations/reefs/reef_03.webp",3779,2080,120,0],["images/board/decorations/reefs/reef_03.webp",4160,1085,120,0],["images/board/decorations/reefs/reef_03.webp",4146,1725,80,0],["images/board/decorations/reefs/reef_03.webp",4497,2255,120,0],["images/board/decorations/reefs/reef_03.webp",4515,1010,80,0],["images/board/decorations/reefs/reef_04.webp",1856,1750,80,0],["images/board/decorations/reefs/reef_04.webp",3090,2617,80,0],["images/board/decorations/reefs/reef_04.webp",3331,1092,80,0],["images/board/decorations/reefs/reef_04.webp",4181,3165,80,0],["images/board/decorations/reefs/reef_04.webp",4526,2667,80,0],["images/board/decorations/reefs/reef_05.webp",1874,2013,80,0],["images/board/decorations/reefs/reef_05.webp",2272,1014,120,0],["images/board/decorations/reefs/reef_05.webp",2553,2827,80,0],["images/board/decorations/reefs/reef_05.webp",4313,2450,80,0],["images/board/decorations/reefs/reef_05.webp",3054,1387,80,0],["images/board/decorations/reefs/reef_05.webp",4281,1277,240,0],["images/board/decorations/reefs/reef_05.webp",4177,2639,80,0],["images/board/decorations/reefs/reef_05.webp",3566,2660,120,0]],"basePixels":[5120,3976],"encoding":"lossless-webp","nativeResolution":true,"asset":"map-static-v025.webp","sha256":"1e0bb68e72d26d9ef2214dcf78f2eb85e6be2ad5edd5375343c786e4b49b1fd0","bytes":16193584,"sources":[{"file":"images/board/backgrounds/board_bg_map_main.webp","sha256":"d363ffa8b3ee3c55667052e0211060847053ad78130df1ded2ce748e1d51698f"},{"file":"images/board/decorations/sea_beasts/sea_beast_01.webp","sha256":"e1885816dba719e7258087110340dc68918f14792a3957afb81f2086c1d4f422"},{"file":"images/board/decorations/sea_beasts/sea_beast_02.webp","sha256":"252c3e9007efdddab8bed6c5ae7a2e948e2c2402f378e7f1ecd4786192140c4b"},{"file":"images/board/decorations/sea_beasts/sea_beast_03.webp","sha256":"6de8b527bba418fc363ebbfafbc1b39ea898b424cf4ba8cf5fb337c4b21a4358"},{"file":"images/board/decorations/sea_beasts/sea_beast_04.webp","sha256":"a0a770b6899cd82d1ac7dad482474091a843f191789efb65fa9c97bd68346ddf"},{"file":"images/board/decorations/sea_beasts/sea_beast_05.webp","sha256":"2fe762260fde26857b42e421bf448c354220772f36a39f9caea1f417d58cb0c5"},{"file":"images/board/decorations/sea_beasts/sea_beast_06.webp","sha256":"81755ba1532cad1f0cc857f52d0c2adcc698525d563b3a7773b0aa35143a5155"},{"file":"images/board/decorations/sea_beasts/sea_beast_07.webp","sha256":"80c6ba75b03b9d34b1d8fbb3f18939f1ff85d7630445c308b42166cc007667be"},{"file":"images/board/decorations/reefs/reef_02.webp","sha256":"2f85053a76b3d1a9f51b77af9eb826132ca458ba9efe60000fe8053ab3895a8b"},{"file":"images/board/decorations/reefs/reef_03.webp","sha256":"385c3c222b2bd46016499e95444439612ce1af5d71ca3e6c332574dee143aded"},{"file":"images/board/decorations/reefs/reef_04.webp","sha256":"7db8ad181a6de015fa5cb18ec4507d63c6dc2717c04c945ff93d6b5a1b062e6f"},{"file":"images/board/decorations/reefs/reef_05.webp","sha256":"c95f9ba02c224d7839ec6f3fea7431a7798157a7083e1e2a2a543e0caed51050"}]};


/* Android presentation module: board-phone-static-map */
/* Persistent, precomposed fixed artwork. Dynamic map callbacks stay in source. */
(() => {
 'use strict';
 const data=window.TabletopPhoneStaticMapData;
 const states=new WeakMap();let pool=null,owner=null;
 const stats={imageReuses:0,transactions:0,compositeLoads:0,compositeFailures:0};
 const phone=()=>document.documentElement?.dataset.platform==='android';
 const signature=layout=>JSON.stringify(Object.values(layout.decorations||{}).filter(d=>d.asset).map(d=>[d.asset,d.x,d.y,d.size||64,d.rotation||0]));
 const expected=data&&JSON.stringify(data.decorations);
 function restore(map,s){if(!s.applied)return;s.previous?map.style.setProperty('--board-map-bg',s.previous):map.style.removeProperty('--board-map-bg');s.applied=false;delete map.dataset.phoneStaticMap;}
 function useStaticMap(map,layout){
  if(!phone()||!data||!map)return false;
  let s=states.get(map);
  if(!s){s={previous:map.style.getPropertyValue('--board-map-bg'),ready:false,applied:false,failed:false,eligible:false};states.set(map,s);
   // A style change can happen without renderMap. Restore original art through
   // the real renderer, never leave an original/vintage mixed presentation.
   s.style=map.dataset.mapVisualStyle;
   const observer=new MutationObserver(()=>{const next=map.dataset.mapVisualStyle;if(next===s.style)return;s.style=next;requestAnimationFrame(()=>{if(map.isConnected)window.__BOARD_GAME_DEBUG__?.renderAll();});});
   observer.observe(map,{attributes:true,attributeFilter:['data-map-visual-style']});
   window.addEventListener('pagehide',e=>{if(!e.persisted)observer.disconnect();});
  }
  s.eligible=map.dataset.mapVisualStyle!=='vintage'&&parseFloat(map.style.width)===data.width&&parseFloat(map.style.height)===data.height&&signature(layout)===expected;
  if(!s.eligible){restore(map,s);return false;}
  if(s.failed)return false;
  if(s.ready){if(!s.applied){map.style.setProperty('--board-map-bg',`url("${s.image.src}")`);map.dataset.phoneStaticMap='ready';s.applied=true;}return true;}
  if(!s.image){
   const image=s.image=new Image();image.decoding='async';image.src=(window.__TABLETOP_ANDROID_TEST_ORIGIN||'poapp://app')+'/mobile/art-ui/'+data.asset;
   stats.compositeLoads++;
   image.decode().then(()=>{
    s.ready=true;
    // Switch only after complete decode, in one rendering task. A custom layout
    // or a style changed during the decode must keep the normal source artwork.
    if(!map.isConnected||!s.eligible||map.dataset.mapVisualStyle==='vintage')return;
    map.style.setProperty('--board-map-bg',`url("${image.src}")`);s.applied=true;map.dataset.phoneStaticMap='ready';
    map.querySelectorAll(':scope > .map-decoration').forEach(n=>n.remove());
   }).catch(()=>{s.failed=true;stats.compositeFailures++;});
  }
  return false;
 }
 function key(img){return img.getAttribute('src')+'|'+img.className;}
 function begin(map){
  if(!phone()||!map)return;
  owner=map;pool=new Map();stats.transactions++;
  for(const img of map.querySelectorAll('.island-visual-art img,img.ship-art')){
   if(!img.complete||!img.naturalWidth)continue;
   const k=key(img),list=pool.get(k)||[];list.push(img);pool.set(k,list);
  }
 }
 function prepare(node){
  if(!pool||!owner||!(node instanceof Element))return;
  // Replace only image leaves. Every fresh button and its freshly captured
  // island/player/route handler remains intact after save or network changes.
  for(const img of node.querySelectorAll('.island-visual-art img,img.ship-art')){
   const old=pool.get(key(img))?.shift();if(!old)continue;
   for(const attr of [...old.attributes])if(!img.hasAttribute(attr.name)&&!['loading','decoding','fetchpriority'].includes(attr.name))old.removeAttribute(attr.name);
   for(const attr of img.attributes)if(!['src','loading','decoding','fetchpriority'].includes(attr.name)&&old.getAttribute(attr.name)!==attr.value)old.setAttribute(attr.name,attr.value);
   img.replaceWith(old);stats.imageReuses++;
  }
 }
 function end(){pool=null;owner=null;}
 window.TabletopPhoneStaticMap=Object.freeze({useStaticMap,begin,prepare,end,snapshot:()=>({...stats})});
})();


/* Android presentation module: board-phone-map */
(function () {
  'use strict';
  const origin = window.__TABLETOP_ANDROID_TEST_ORIGIN || 'https://onepiece-card-online.onrender.com';
  if (location.origin !== origin || location.pathname.toLowerCase() !== '/board_game.html') return;
  if (window.__TABLETOP_PHONE_MAP__) return;
  window.__TABLETOP_PHONE_MAP__ = true;
  const menus = new WeakMap();
  const cameraControlPanels = new WeakSet();
  const overviewCamera = { camera: null, regionalMin: null };
  let scheduled = false, presentationFrame = 0, presentationSuspended = false, layoutRuntime = null, initialCameraApplied = false;
  let handledTouchTap = null;
  let currentName = null;
  let fallbackHelmRule = null;
  const HELM_RADIUS = 294;
  const HELM_GROWTH = HELM_RADIUS / 256;
  let cameraFrame = 0, cameraUntil = 0;
  // This controller owns one map instance, not Image/Element prototypes. The
  // source renderer may replace every island after a turn; retired images must
  // leave the observer and queue instead of keeping old map generations alive.
  // Keep every original src/onerror/DOM listener. Native lazy loading is the
  // fallback; near-view promotion and explicit decode have a shared two-slot
  // budget, and wait until the camera gesture has settled.
  const mapArtwork = new Map(), decodeQueue = new Map();
  let imageObserver = null, artworkChanges = null, decoding = 0, decodeIdle = 0, decodeWakeIsIdle = false;
  let cameraBusyUntil = 0, artworkDisposed = false, artworkMap = null;
  let originalMapAppend = null, mapAppendHook = null;
  function cancelDecodeWake() {
    if (!decodeIdle) return;
    if (decodeWakeIsIdle) cancelIdleCallback(decodeIdle);
    else clearTimeout(decodeIdle);
    decodeIdle = 0;
  }
  function drainMapDecodes() {
    decodeIdle = 0;
    if (artworkDisposed || document.hidden) return;
    if (performance.now() < cameraBusyUntil) { queueMapDecode(); return; }
    // IntersectionObserver already supplied geometry. Never read 94 image
    // rectangles here: prioritize visible entries using its existing snapshot.
    const ordered = [...decodeQueue].sort((a, b) => a[1] - b[1]);
    for (const [image] of ordered) {
      if (decoding >= 2) break;
      decodeQueue.delete(image);
      const state = mapArtwork.get(image);
      if (!state || !image.isConnected || !image.getAttribute('src')) continue;
      if (image.complete && image.naturalWidth) { state.decoded = true; continue; }
      decoding++; state.active = true;
      image.fetchPriority = 'auto'; image.loading = 'eager';
      const ready = typeof image.decode === 'function' ? image.decode() : new Promise(resolve => {
        if (image.complete) resolve();
        else { image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }); }
      });
      Promise.resolve(ready).catch(() => {}).finally(() => {
        decoding--; state.active = false; state.decoded = !!image.naturalWidth;
        queueMapDecode();
      });
    }
    if (decodeQueue.size && decoding < 2) queueMapDecode();
  }
  function queueMapDecode(image, priority = 1) {
    if (image) {
      const state = mapArtwork.get(image);
      if (!state || state.active || state.decoded) return;
      decodeQueue.set(image, Math.min(priority, decodeQueue.get(image) ?? Infinity));
    }
    if (artworkDisposed || document.hidden || decodeIdle || decoding >= 2 || !decodeQueue.size) return;
    const afterGesture = Math.ceil(cameraBusyUntil - performance.now());
    decodeWakeIsIdle = afterGesture <= 0 && !!window.requestIdleCallback;
    decodeIdle = decodeWakeIsIdle ? requestIdleCallback(drainMapDecodes, { timeout: 180 })
      : setTimeout(drainMapDecodes, Math.max(24, afterGesture));
  }
  function retireMapArtwork(node) {
    if (!(node instanceof Element)) return;
    const images = node.matches('img') ? [node] : node.querySelectorAll('img');
    for (const image of images) {
      imageObserver?.unobserve(image); decodeQueue.delete(image); mapArtwork.delete(image);
    }
  }
  function prepareMapArtwork(node) {
    if (!(node instanceof Element)) return;
    const images = node.matches('img') && node.closest('.island-node,.map-decoration') ? [node]
      : node.matches('.island-node,.map-decoration') ? node.querySelectorAll('img') : [];
    for (const image of images) {
      if (mapArtwork.has(image)) continue;
      mapArtwork.set(image, { active: false, decoded: false });
      image.loading = 'lazy'; image.decoding = 'async'; image.fetchPriority = 'low';
      imageObserver?.observe(image);
    }
  }
  function disposeMapArtwork() {
    if (artworkDisposed) return;
    artworkDisposed = true; cancelDecodeWake(); imageObserver?.disconnect(); artworkChanges?.disconnect();
    decodeQueue.clear(); mapArtwork.clear();
    if (artworkMap?.appendChild === mapAppendHook) artworkMap.appendChild = originalMapAppend;
  }
  function installArtworkScheduling() {
    const map = document.getElementById('boardGameMap');
    if (!map || map.dataset.phoneArtworkScheduling) return !!map;
    artworkMap = map;
    if ('IntersectionObserver' in window) imageObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const image = entry.target;
        if (!entry.isIntersecting) { decodeQueue.delete(image); continue; }
        const r = entry.boundingClientRect, view = entry.rootBounds;
        const critical = view && r.right > view.left + 160 && r.left < view.right - 160
          && r.bottom > view.top + 160 && r.top < view.bottom - 160;
        queueMapDecode(image, critical ? 0 : 1);
      }
    }, { root: document.getElementById('boardViewport'), rootMargin: '160px' });
    // Scope the renderer hook to this one map instance. All original DOM nodes,
    // listeners, insertion return values, map rules and image URLs are retained.
    originalMapAppend = map.appendChild;
    mapAppendHook = function (node) { window.TabletopPhoneStaticMap?.prepare(node); prepareMapArtwork(node); return originalMapAppend.call(this, node); };
    map.appendChild = mapAppendHook;
    artworkChanges = new MutationObserver(records => {
      for (const record of records) {
        if (record.target !== map && !record.target.closest?.('.island-node,.map-decoration')) continue;
        for (const node of record.removedNodes) retireMapArtwork(node);
        // appendChild is the source renderer's fast path; this covers source
        // fragment/replaceChildren insertions without altering their methods.
        for (const node of record.addedNodes) prepareMapArtwork(node);
      }
    });
    artworkChanges.observe(map, { childList: true, subtree: true });
    map.querySelectorAll(':scope > .island-node,:scope > .map-decoration').forEach(prepareMapArtwork);
    map.dataset.phoneArtworkScheduling = 'lifecycle-idle-two-slot';
    window.addEventListener('pagehide', event => { if (!event.persisted) disposeMapArtwork(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelDecodeWake(); else queueMapDecode();
    });
    return true;
  }
  if (!installArtworkScheduling()) {
    const mounting = new MutationObserver(() => {
      if (installArtworkScheduling()) mounting.disconnect();
    });
    mounting.observe(document, { childList: true, subtree: true });
  }
  // Presentation memory only. No game/save/socket fields are introduced.
  const automatic = { turn: '', shown: false, resume: false };
  const management = '.crew-roster-ui,.crew-detail-ui,.backpack-shell,.backpack-target-ui,.mission-journal-ui,.ship-info-ui,.fleet-info-ui,.training-detail-ui,.carry-item-ui,.cosmetic-frame-ui';
  function mark(name, value) {
    if (document.documentElement.dataset[name] !== value) document.documentElement.dataset[name] = value;
  }
  function visible(node) {
    if (!node) return false;
    for (let parent = node; parent; parent = parent.parentElement) {
      const css = getComputedStyle(parent);
      if (parent.hidden || css.display === 'none' || css.visibility === 'hidden' || Number(css.opacity) === 0) return false;
    }
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }
  function currentTurn() {
    const api = window.__BOARD_GAME_DEBUG__, state = api?.getState?.(), game = state?.gameState;
    const player = api?.getCurrentPlayer?.();
    return { api, state, game, player, key: game && player ? [game.seed, game.round, game.currentPlayerIndex, player.id].join('|') : '' };
  }
  function shouldEnable(turn) {
    const { api, state, game, player } = turn;
    const blocked = reason => ({ enabled: false, reason });
    if (!game || !player || game.phase !== 'main') return blocked('not-main');
    if (player.isCPU === true || player.isCpu === true || player.cpu === true || String(player.clientId || '').startsWith('board-cpu-')) return blocked('cpu');
    if (game.pendingMove || game.movementAnimating || game.diceRolling || state.seaTrainAnimation || state.kumaPawAnimation) return blocked('movement');
    if (state.battleState || game.battleExitLock || visible(document.getElementById('battlePageOverlay'))) return blocked('battle');
    if (game.routePrompt || game.tradePrompt || game.coopBattlePrompt || game.activeTrade || game.islandDecision || game.resolutionLock || api.sparQa?.blocksCurrentTurn?.()) return blocked('pending-choice');
    if (api.getOpeningStoryStatus?.().active || state.finalIslandRevealActive || api.isItemRevealPending?.() || visible(document.querySelector('#evolutionHud.show'))) return blocked('story');
    if (visible(document.getElementById('turnTransitionBanner'))) return blocked('turn-transition');
    if (visible(document.getElementById('boardModalBack')) || [...document.querySelectorAll('dialog[open]')].some(visible)) return blocked('modal');
    if (visible(document.querySelector('#boardToolsPanel:not([hidden])')) || visible(document.querySelector('.board-audio__panel:not([hidden])'))) return blocked('panel');
    if (player.pendingIslandServiceChoice?.requiredEntry === true) return blocked('required-entry');
    const lan = api.boardLanStatus?.();
    if (lan?.enabled && (!lan.connected || lan.awaitingInitialState || lan.applying || lan.playback?.active || Number(lan.playback?.pending || 0) > 0)) return blocked('sync');
    if (api.hasPendingRemoteBattleViews?.()) return blocked('remote-battle');
    // `actionable` alone also covers CPU controls and move-learning notices.
    // These exact source title/aria values are set only for canUseShipActions.
    const ship = [...document.querySelectorAll('#boardGameMap .ship-token.current.actionable')].find(node =>
      node.dataset.playerId === String(player.id) && node.title === '點擊開啟本回合操作'
      && node.getAttribute('aria-label')?.includes('的船，開啟本回合操作') && !node.disabled && visible(node));
    return ship ? { enabled: true, reason: 'original-own-turn-control', ship } : blocked('original-control-unavailable');
  }
  function automaticCommands(turn) {
    if (turn.key !== automatic.turn) {
      automatic.turn = turn.key; automatic.shown = false; automatic.resume = false;
    }
    mark('phoneMapAutoTurn', turn.key);
    const modal = document.getElementById('boardModal');
    if (visible(document.getElementById('boardModalBack')) && modal?.querySelector(management)) automatic.resume = true;
    const eligible = shouldEnable(turn), existing = document.querySelector('#boardGameMap .ship-action-menu');
    if (!eligible.enabled) {
      // Every phone human command surface yields to source interaction locks,
      // including one manually reopened through its original ship token. A
      // screen-space portal must never remain above a tools/modal screen.
      // A manually opened CPU menu retains its original fields and handlers.
      // Opening the source tools disclosure temporarily replaces this strip.
      // Remember only that presentation so closing it restores source controls.
      const humanCommands = existing?.dataset.phoneCarousel === 'true' && !existing.classList.contains('is-cpu');
      if (humanCommands && eligible.reason === 'panel') automatic.resume = true;
      if (humanCommands) existing.remove();
      mark('phoneMapAuto', automatic.resume ? 'resume' : 'blocked'); mark('phoneMapAutoReason', eligible.reason);
      return;
    }
    if (existing) {
      automatic.shown = true;
      mark('phoneMapAuto', 'shown'); mark('phoneMapAutoReason', 'original-menu-open');
      return;
    }
    // Original map renders rebuild the menu within the same turn. Restore the
    // eligible local player's controls whenever they are absent, after every
    // original ownership and interaction lock has been checked above.
    // The existing token listener still validates ownership/locks and opens the
    // original menu. Never synthesize a roll or call a game action directly.
    eligible.ship.click();
    const opened = document.querySelector('#boardGameMap .ship-action-menu:not(.is-cpu)');
    if (opened) {
      automatic.shown = true; automatic.resume = false;
      opened.dataset.phoneAutoShown = 'true';
      createCarousel(opened); positionMenu(opened);
    }
    mark('phoneMapAuto', opened ? 'shown' : 'blocked');
    mark('phoneMapAutoReason', opened ? 'original-ship-click' : 'source-declined');
  }
  function property(node, name, value) {
    if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
  }
  function element(tag, className, text) {
    const node = document.createElement(tag); node.className = className;
    if (text) node.textContent = text;
    if (tag === 'button') node.type = 'button';
    return node;
  }
  function nearPointer(event, pointer) {
    return !!pointer && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) <= 12;
  }
  function touchClick(event, pointer) {
    if (event.pointerType === 'touch' || event.sourceCapabilities?.firesTouchEvents === true) return true;
    if (event.pointerType || event.sourceCapabilities?.firesTouchEvents === false) return false;
    // Older WebViews report compatibility clicks as MouseEvent. A keyboard
    // click has detail zero and must still reach the original controller.
    return !event.pointerType && event.isTrusted && event.detail > 0 && nearPointer(event, pointer);
  }
  function zoom(direction, steps = 1) {
    const viewport = document.getElementById('boardViewport');
    if (!viewport) return;
    const r = viewport.getBoundingClientRect();
    for (let i = 0; i < steps; i++) viewport.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true, cancelable: true, deltaY: direction > 0 ? -80 : 80,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2
    }));
  }
  function focusShip() { document.getElementById('focusPlayerBtn')?.click(); }
  function fitInitialRoute(turn) {
    const { api, state, game, player } = turn;
    const viewport = document.getElementById('boardViewport'), map = document.getElementById('boardGameMap');
    const board = game?.boardData, camera = state?.panZoom;
    if (!viewport || !map?.offsetWidth || !board || !camera) return false;
    const island = id => api.getIslandById?.(id);
    const point = node => Number.isFinite(node?.pxX) && Number.isFinite(node?.pxY)
      ? { x: node.pxX, y: node.pxY } : null;
    const available = id => api.getAvailableRoutes?.(id, player) || [];
    const atSea = player.location?.kind === 'sea';
    const route = atSea ? api.getRouteById?.(player.location.routeId) : available(player.location?.islandId)[0];
    if (!route) return false;
    const fromId = atSea ? player.location.fromIslandId || route.from : player.location.islandId;
    const toId = route.from === fromId ? route.to : route.from;
    const from = island(fromId), to = island(toId), a = point(from), b = point(to);
    if (!a || !b) return false;
    // Read the actual runtime sea tiles, including original endpoint nudges.
    const tilesFrom = (item, id) => {
      const tiles = board.seaTiles.filter(tile => tile.routeId === item.id).sort((left, right) => left.index - right.index);
      return item.from === id ? tiles : tiles.reverse();
    };
    const incoming = { x: b.x - a.x, y: b.y - a.y }, length = Math.hypot(incoming.x, incoming.y) || 1;
    const continuation = available(toId).filter(item => item.id !== route.id).map(item => {
      const tiles = tilesFrom(item, toId), next = point(tiles[0]) || point(island(item.from === toId ? item.to : item.from));
      if (!next) return null;
      const dx = next.x - b.x, dy = next.y - b.y;
      return { route: item, tiles: tiles.slice(0, 3), score: (incoming.x * dx + incoming.y * dy) / (length * (Math.hypot(dx, dy) || 1)) };
    }).filter(Boolean).sort((left, right) => right.score - left.score)[0];
    const routeTiles = tilesFrom(route, fromId), furtherTiles = continuation?.tiles || [];
    const entries = [{ node: from, selector: '.island-node' }, { node: to, selector: '.island-node' },
      ...[...routeTiles, ...furtherTiles].map(node => ({ node, selector: '.sea-tile' }))];
    const view = viewport.getBoundingClientRect(), mapRect = map.getBoundingClientRect();
    const actualScale = mapRect.width / map.offsetWidth;
    if (!(actualScale > 0)) return false;
    const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    for (const entry of entries) {
      const p = point(entry.node);
      if (!p) return false;
      const node = [...map.querySelectorAll(entry.selector)].find(element =>
        Math.abs(parseFloat(element.style.left) - p.x) < 0.5 && Math.abs(parseFloat(element.style.top) - p.y) < 0.5);
      if (!node) return false;
      // Include original artwork that deliberately extends beyond its button.
      for (const painted of [node, ...node.querySelectorAll('.island-visual,.island-visual-art,.island-visual-img,.elbaph-island-visual')]) {
        const r = painted.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        bounds.left = Math.min(bounds.left, (r.left - mapRect.left) / actualScale);
        bounds.top = Math.min(bounds.top, (r.top - mapRect.top) / actualScale);
        bounds.right = Math.max(bounds.right, (r.right - mapRect.left) / actualScale);
        bounds.bottom = Math.max(bounds.bottom, (r.bottom - mapRect.top) / actualScale);
      }
    }
    // Preserve the regional two-island composition while giving it more sea.
    let safeTop = 12;
    for (const hud of document.querySelectorAll('#boardToolsToggle,#mapTurnBanner')) {
      if (visible(hud)) safeTop = Math.max(safeTop, hud.getBoundingClientRect().bottom - view.top + 8);
    }
    const safe = { left: 12, top: safeTop, right: view.width - 12, bottom: view.height - 156 };
    if (safe.right <= safe.left || safe.bottom <= safe.top || !Number.isFinite(bounds.left)) return false;
    const fit = .82 * Math.min(camera.scale, camera.maxScale,
      (safe.right - safe.left) / (bounds.right - bounds.left + 24),
      (safe.bottom - safe.top) / (bounds.bottom - bounds.top + 24));
    if (!(fit > 0)) return false;
    const centerX = (safe.left + safe.right) / 2;
    let centerY = (safe.top + safe.bottom) / 2;
    // Short landscape screens can use their actual unused top margin before
    // the enlarged corner helm. Preserve scale and every original art bound.
    const fittedTop = centerY - (bounds.bottom - bounds.top) * fit / 2;
    const upShift = view.height <= 340 ? Math.max(0, fittedTop - safe.top - 1) : 0;
    centerY -= upShift;
    // Only presentation camera state changes. The source wheel handler applies
    // its own .9 step, clampPan and applyPanZoom; no parallel DOM transform.
    // Lower this phone-only floor to the fitted region so the next manual
    // wheel/pinch does not jump back to the desktop .58 minimum.
    camera.minScale = Math.min(camera.minScale, fit);
    camera.scale = fit / 0.9;
    camera.x = centerX - (bounds.left + bounds.right) / 2 * camera.scale;
    camera.y = centerY - (bounds.top + bounds.bottom) / 2 * camera.scale;
    viewport.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 80,
      clientX: view.left + centerX, clientY: view.top + centerY }));
    mark('phoneMapCamera', 'regional');
    mark('phoneMapCameraRoute', route.id);
    mark('phoneMapCameraIslands', `${fromId}|${toId}`);
    mark('phoneMapCameraContinuation', continuation?.route.id || '');
    mark('phoneMapCameraFurtherTiles', furtherTiles.map(tile => tile.id).join('|'));
    mark('phoneMapCameraBounds', JSON.stringify(bounds));
    mark('phoneMapCameraSafe', JSON.stringify(safe));
    mark('phoneMapCameraFit', String(fit));
    mark('phoneMapCameraUpShift', String(upShift));
    mark('phoneMapCameraRegionTop', String(centerY - (bounds.bottom - bounds.top) * fit / 2));
    return true;
  }
  function ensureCameraControls(panel) {
    if (!panel || cameraControlPanels.has(panel)) return;
    cameraControlPanels.add(panel);
    // Capture only the regional floor before the original target handler fits
    // the whole map. Repeated overview clicks must not replace it with the
    // much smaller overview floor. This is local camera presentation memory.
    panel.addEventListener('click', event => {
      const button = event.target instanceof Element ? event.target.closest('button') : null;
      if (button?.id !== 'viewWholeMapBtn' || button.disabled) return;
      const camera = currentTurn().state?.panZoom;
      if (camera && overviewCamera.camera !== camera && Number.isFinite(camera.minScale) && camera.minScale > 0) {
        overviewCamera.camera = camera; overviewCamera.regionalMin = camera.minScale;
      }
    }, true);
    // A panel bubble listener runs after the existing target handlers. Keep
    // those handlers, the original toolbar disclosure and source wheel clamp;
    // only reconcile the phone's two supported camera views afterwards.
    panel.addEventListener('click', event => {
      const button = event.target instanceof Element ? event.target.closest('button') : null;
      if (!button || button.disabled || !['viewWholeMapBtn','focusPlayerBtn'].includes(button.id)) return;
      const turn = currentTurn(), camera = turn.state?.panZoom;
      if (!camera) return;
      if (button.id === 'viewWholeMapBtn') {
        if (overviewCamera.camera === camera && Number.isFinite(camera.scale) && camera.scale > 0) {
          // Whole-map fit is deliberately below the regional minimum. Without
          // this phone floor the next +/pinch jumps back by roughly fivefold.
          camera.minScale = Math.min(overviewCamera.regionalMin, camera.scale);
          mark('phoneMapCamera', 'overview');
        }
      } else {
        if (overviewCamera.camera === camera && Number.isFinite(overviewCamera.regionalMin)) {
          camera.minScale = overviewCamera.regionalMin;
        }
        overviewCamera.camera = null; overviewCamera.regionalMin = null;
        // Source focus has already centered the player at >= .88. Reuse the
        // existing phone route fit to restore the two-island view. If no route
        // can be fitted, that original player camera remains the fallback.
        // A successful fit retains its normal manual-camera mode: enabling
        // source auto-center would force >= .88 again on the next render.
        if (!fitInitialRoute(turn)) mark('phoneMapCamera', 'player');
      }
      schedule();
    });
  }
  function ensureToolbar() {
    const panel = document.getElementById('boardToolsPanel');
    ensureCameraControls(panel);
    if (!panel || document.getElementById('phoneMapTools')) return;
    const toolbar = element('div', 'phone-map-tools'); toolbar.id = 'phoneMapTools';
    toolbar.setAttribute('role', 'toolbar'); toolbar.setAttribute('aria-label', '地圖視角');
    for (const [id, label, description, action] of [
      ['phoneMapZoomIn', '＋', '拉近地圖', () => zoom(1)],
      ['phoneMapZoomOut', '−', '拉遠地圖', () => zoom(-1)]
    ]) {
      const button = element('button', 'phone-map-tool', label);
      button.id = id;
      button.setAttribute('aria-label', description); button.addEventListener('click', action);
      toolbar.append(button);
    }
    toolbar.addEventListener('pointerdown', event => event.stopPropagation());
    toolbar.addEventListener('click', event => event.stopPropagation());
    const heading = panel.querySelector('.board-tools-heading');
    if (heading) heading.after(toolbar);
    else panel.prepend(toolbar);
  }
  function describeTurnBanner() {
    mark('phoneMapHud', 'compact');
    const toggle = document.getElementById('boardToolsToggle');
    // The source aria-label already describes both disclosure states. Avoid
    // the shared title-to-focus hint painting another label over the map.
    if (toggle?.hasAttribute('title')) toggle.removeAttribute('title');
    const name = document.querySelector('#mapTurnBanner .map-turn-name');
    const label = name?.textContent?.trim();
    // Keep the source name node/text; ellipsis only changes its visual width.
    if (label && name.getAttribute('aria-label') !== label) name.setAttribute('aria-label', label);
  }
  function syncCurrentName(menu, label) {
    if (!menu || menu.classList.contains('is-cpu') || !menu.isConnected || !visible(menu)
      || !shouldEnable(currentTurn()).enabled || !label) {
      if (currentName) { currentName.remove(); currentName = null; }
      return;
    }
    if (!currentName?.isConnected) {
      currentName = element('div', 'phone-ship-current-name');
      currentName.id = 'phoneShipCurrentName';
      currentName.setAttribute('role', 'status');
      currentName.setAttribute('aria-live', 'polite'); currentName.setAttribute('aria-atomic', 'true');
      document.body.append(currentName);
    }
    if (currentName.textContent !== label) currentName.textContent = label;
  }
  function createCarousel(menu) {
    const isCpu = menu.classList.contains('is-cpu');
    const actions = Array.from(menu.querySelectorAll('[data-ship-action]'));
    const fields = Array.from(menu.querySelectorAll('.ship-action-field'));
    const slides = [...fields, ...actions];
    if (!slides.length) return;
    menu.dataset.phoneCarousel = 'true';
    menu.dataset.phoneMapCommands = isCpu ? 'icons' : 'helm';
    menu.setAttribute('role', 'region'); menu.setAttribute('aria-label', isCpu ? '船長指令，左右切換選項' : '船長指令，沿輪舵轉動切換，點中央執行');
    const stage = element('div', 'phone-ship-stage');
    const footer = element('div', 'phone-ship-navigation');
    const previous = element('button', 'phone-ship-arrow', '‹');
    previous.setAttribute('aria-label', '上一個船長指令');
    const next = element('button', 'phone-ship-arrow', '›');
    next.setAttribute('aria-label', '下一個船長指令');
    let helmArt = null, helmHint = null;
    if (!isCpu) {
      const inner = element('div', 'phone-ship-helm-inner');
      inner.setAttribute('aria-hidden', 'true'); stage.append(inner);
      helmArt = element('div', 'phone-ship-helm-art');
      helmArt.setAttribute('aria-hidden', 'true'); stage.append(helmArt);
      const hint = element('div', 'phone-ship-rotate-hint');
      helmHint = hint;
      hint.setAttribute('aria-hidden', 'true');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 20 20'); svg.setAttribute('focusable', 'false');
      const curve = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      curve.setAttribute('d', 'M4 17A13 13 0 0 1 17 4M2 12l2 5 5-2M12 2l5 2-2 5');
      svg.append(curve); hint.append(svg); stage.append(hint);
      // Human commands use the whole helm for swiping. Keep the original
      // arrows only for CPU fields, without adding invisible Tab stops.
      previous.hidden = true; next.hidden = true;
      previous.tabIndex = -1; next.tabIndex = -1;
      stage.tabIndex = -1;
    }
    const position = element('span', 'phone-ship-position');
    if (isCpu) {
      position.setAttribute('aria-live', 'polite'); position.setAttribute('aria-atomic', 'true');
    } else position.setAttribute('aria-hidden', 'true');
    slides.forEach(slide => {
      slide.classList.add('phone-ship-slide');
      if (slide.matches('[data-ship-action]')) {
        const label = slide.getAttribute('aria-label') || slide.textContent.trim();
        slide.setAttribute('aria-label', label);
        // The shared phone title-to-focus hint would cover this icon strip.
        // Keep its original description accessible without a floating tooltip.
        if (slide.title && slide.title !== label) slide.setAttribute('aria-description', slide.title);
        slide.removeAttribute('title');
        slide.dataset.phoneActionLabel = label;
      }
      stage.append(slide);
    });
    menu.querySelector('.ship-command-main')?.setAttribute('hidden', '');
    menu.querySelector('.ship-command-secondary-actions')?.setAttribute('hidden', '');
    footer.append(previous, position, next); menu.append(stage, footer);
    const state = { slides, index: 0, rotation: 0 };
    let motionFrame = 0, pendingAngle = null;
    let inertiaFrame = 0, inertiaActive = false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let helmAnimation = null, animationMode = '', lastPose = 0, animationUnavailable = false;
    // Transform keyframes do not mutate DOM style attributes. Dragging must
    // not wake the whole-page style observers and their layout/visibility scans.
    function prepareHelmAnimation() {
      if (!helmArt || animationUnavailable || helmAnimation) return !!helmAnimation;
      try {
        const animation = helmArt.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(0deg)' }],
          { duration: 1, fill: 'both' });
        if (!animation.effect?.setKeyframes || !animation.effect?.updateTiming) {
          animation.cancel(); animationUnavailable = true; return false;
        }
        animation.pause(); animation.currentTime = 0;
        helmAnimation = animation;
      } catch (_) { animationUnavailable = true; return false; }
      return true;
    }
    function setHelmPose(angle) {
      if (!Number.isFinite(angle) || !helmArt) return;
      if (prepareHelmAnimation()) {
        if (animationMode !== 'paused') {
          helmAnimation.pause();
          helmAnimation.effect.updateTiming({ duration: 1, easing: 'linear', fill: 'both' });
          helmAnimation.currentTime = 0; animationMode = 'paused';
        }
        const transform = `rotate(${angle}deg)`;
        helmAnimation.effect.setKeyframes([{ transform }, { transform }]);
      } else {
        // Old WebViews can still update a CSSOM rule without per-frame DOM
        // mutations. Only one human helm exists; CPU controls do not match it.
        if (!fallbackHelmRule) {
          const style = element('style', 'phone-helm-motion-fallback');
          style.textContent = 'html[data-platform="android"][data-game-ui="board"] #boardGameMap .ship-action-menu[data-phone-carousel="true"]:not(.is-cpu) .phone-ship-helm-art { transform:rotate(0deg); }';
          document.head.append(style); fallbackHelmRule = style.sheet.cssRules[0].style;
        }
        fallbackHelmRule.setProperty('transform', `rotate(${angle}deg)`);
      }
      lastPose = angle;
    }
    function cancelMotionFrame() {
      if (motionFrame) cancelAnimationFrame(motionFrame);
      motionFrame = 0; pendingAngle = null;
    }
    function cancelInertiaFrame() {
      if (inertiaFrame) cancelAnimationFrame(inertiaFrame);
      inertiaFrame = 0; inertiaActive = false;
    }
    function syncHelmHint(angle) {
      if (!helmHint || !Number.isFinite(angle)) return;
      // Eight handles are 45deg apart. At rest choose a real handle gap in
      // the visible quarter; free rotation must not leave the badge on a spoke.
      let gap = angle + 22.5 + 45 * Math.round((180 - angle) / 45);
      if (gap < 190) gap += 45;
      else if (gap > 240) gap -= 45;
      const radians = gap * Math.PI / 180;
      property(helmHint, '--phone-helm-hint-x', `${HELM_RADIUS + 224 * HELM_GROWTH * Math.cos(radians) - 15}px`);
      property(helmHint, '--phone-helm-hint-y', `${HELM_RADIUS + 224 * HELM_GROWTH * Math.sin(radians) - 15}px`);
    }
    function paintHelmAngle(angle) {
      if (!Number.isFinite(angle)) return;
      state.rotation = angle; setHelmPose(angle);
      const index = ((Math.round(angle / 45) % slides.length) + slides.length) % slides.length;
      if (index !== state.index) show(index, true);
    }
    function stopHelmMotion(angle) {
      cancelMotionFrame(); cancelInertiaFrame();
      if (Number.isFinite(angle)) paintHelmAngle(angle);
      delete stage.dataset.phoneHelmMotion;
      syncHelmHint(state.rotation);
    }
    function previewHelmMotion(angularDelta, baseAngle) {
      const base = Number.isFinite(baseAngle) ? baseAngle : state.rotation;
      // Finger angle and wheel angle share the same clockwise-positive client
      // coordinate system. The wheel tracks 1:1 without a horizontal mapping.
      pendingAngle = base + angularDelta;
      if (!motionFrame) motionFrame = requestAnimationFrame(() => {
        motionFrame = 0;
        const angle = pendingAngle; pendingAngle = null;
        if (menu.isConnected && Number.isFinite(angle)) paintHelmAngle(angle);
      });
    }
    function screenHelmPivot() {
      const view = document.getElementById('boardViewport')?.getBoundingClientRect();
      const visual = window.visualViewport;
      const right = visual && Number.isFinite(visual.offsetLeft) && visual.width > 0
        ? visual.offsetLeft + visual.width : window.innerWidth;
      const bottom = visual && Number.isFinite(visual.offsetTop) && visual.height > 0
        ? visual.offsetTop + visual.height : window.innerHeight;
      // Match the fitted ring's fixed screen corner and existing .5px seam
      // overscan; never derive this pivot from the panned/scaled world map.
      return { x: Math.min(view?.right ?? right, right) + .5,
        y: Math.min(view?.bottom ?? bottom, bottom) + .5 };
    }
    function sampleHelmPointer(pointer, event) {
      const now = performance.now();
      const x = event.clientX - pointer.pivot.x, y = event.clientY - pointer.pivot.y;
      const radius = Math.hypot(x, y);
      if (radius < 48) {
        // atan2 is unstable next to the pivot. Re-entry establishes a fresh
        // bearing, preserving the last pose instead of jumping across centre.
        cancelMotionFrame(); pointer.previewBase = lastPose - pointer.angularDelta;
        pointer.polar = null; pointer.lastMotionTime = 0; pointer.motionSign = 0;
        pointer.lastSampleTime = now;
        pointer.samples = [{ time: now, angle: pointer.angularDelta }]; return;
      }
      const polar = Math.atan2(y, x) * 180 / Math.PI;
      if (pointer.polar === null) {
        pointer.polar = polar; pointer.dragRadius = radius;
      } else {
        const delta = ((polar - pointer.polar + 540) % 360) - 180;
        pointer.polar = polar; pointer.angularDelta += delta;
        if (Math.abs(delta) > .02) {
          const sign = Math.sign(delta);
          if (pointer.motionSign && sign !== pointer.motionSign) {
            // A late deliberate reversal must not inherit the old direction's
            // speed. Start the velocity window at that last actual segment.
            pointer.samples = [{ time: pointer.lastSampleTime, angle: pointer.angularDelta - delta }];
          }
          pointer.motionSign = sign; pointer.lastMotionTime = now;
        }
      }
      pointer.lastSampleTime = now;
      pointer.samples.push({ time: now, angle: pointer.angularDelta });
      while (pointer.samples.length > 2 && pointer.samples[1].time < now - 100) pointer.samples.shift();
      while (pointer.samples.length > 32) pointer.samples.shift();
      const arc = Math.abs(pointer.angularDelta) * Math.PI / 180 * pointer.dragRadius;
      if (pointer.previewed || arc > 10) {
        if (!pointer.previewed) {
          try { stage.setPointerCapture(event.pointerId); } catch (_) {}
          stage.dataset.phoneHelmMotion = 'dragging'; suppressPointerClick(pointer, event);
        }
        pointer.previewed = true;
        previewHelmMotion(pointer.angularDelta, pointer.previewBase);
      }
    }
    function releasedAngularVelocity(pointer) {
      const now = performance.now(), samples = pointer.samples;
      if (!pointer.lastMotionTime || now - pointer.lastMotionTime > 100 || samples.length < 2) return 0;
      const end = samples[samples.length - 1];
      let first = samples[0];
      const cutoff = now - 100;
      if (first.time < cutoff && samples[1].time > first.time) {
        const next = samples[1], fraction = Math.min(1, (cutoff - first.time) / (next.time - first.time));
        first = { time: cutoff, angle: first.angle + (next.angle - first.angle) * fraction };
      }
      const duration = end.time - first.time;
      if (duration < 8) return 0;
      return Math.max(-.8, Math.min(.8, (end.angle - first.angle) / duration));
    }
    function coastHelm(pointer) {
      const velocity = releasedAngularVelocity(pointer);
      if (reducedMotion.matches || Math.abs(velocity) < .025) { stopHelmMotion(); return; }
      cancelMotionFrame(); cancelInertiaFrame();
      const from = lastPose, began = performance.now(), decay = 280;
      inertiaActive = true; stage.dataset.phoneHelmMotion = 'inertia';
      const advance = time => {
        inertiaFrame = 0;
        if (!inertiaActive) return;
        if (!menu.isConnected || reducedMotion.matches) { stopHelmMotion(); return; }
        const elapsed = Math.max(0, time - began), remaining = Math.exp(-elapsed / decay);
        paintHelmAngle(from + velocity * decay * (1 - remaining));
        if (Math.abs(velocity * remaining) < .012 || elapsed >= 1400) { stopHelmMotion(); return; }
        inertiaFrame = requestAnimationFrame(advance);
      };
      inertiaFrame = requestAnimationFrame(advance);
    }
    function focusCurrent() {
      if (isCpu) next.focus({ preventScroll: true });
      else {
        const current = slides[state.index];
        (current.disabled ? stage : current).focus({ preventScroll: true });
      }
    }
    function show(index, preservePose = false) {
      const focused = document.activeElement;
      const delta = index - state.index;
      if (isCpu || !preservePose) state.rotation += delta * 45;
      state.index = ((index % slides.length) + slides.length) % slides.length;
      slides.forEach((slide, i) => { if (slide.hidden !== (i !== state.index)) slide.hidden = i !== state.index; });
      menu.dataset.phoneSlide = String(state.index);
      menu.dataset.phoneField = String(slides[state.index].matches('.ship-action-field'));
      if (!isCpu && !preservePose) {
        cancelMotionFrame(); cancelInertiaFrame(); setHelmPose(state.rotation);
        delete stage.dataset.phoneHelmMotion; syncHelmHint(state.rotation);
      }
      const label = slides[state.index].dataset.phoneActionLabel || slides[state.index].querySelector('span')?.textContent || '';
      if (position.textContent !== label) position.textContent = label;
      if (!isCpu) syncCurrentName(menu, position.textContent);
      if (focused && slides.some(slide => slide.hidden && slide.contains(focused))) focusCurrent();
    }
    previous.addEventListener('click', () => show(state.index - 1));
    next.addEventListener('click', () => show(state.index + 1));
    menu.addEventListener('keydown', event => {
      if (event.target.matches('select,input,textarea')) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); show(state.index + (event.key === 'ArrowLeft' ? -1 : 1));
      } else if (event.key === 'Escape') menu.remove();
    });
    let start = null, suppressClickUntil = 0, suppressedPointer = null, dispatchingTap = false;
    function suppressPointerClick(pointer, event) {
      suppressClickUntil = performance.now() + 700;
      suppressedPointer = { pointerType: pointer?.pointerType || event.pointerType,
        pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    }
    stage.addEventListener('pointerdown', event => {
      if (!isCpu && event.isPrimary === false) {
        stopHelmMotion();
        start = null; suppressPointerClick(null, event); return;
      }
      if (event.isPrimary === false || event.button !== 0 || event.target.closest('select')) return;
      // A new physical tap must not inherit the previous swipe's click guard.
      // Retain the original centre button for its delegated tap action;
      // a gesture starting on the decorative rim cannot execute a command.
      suppressClickUntil = 0;
      const stoppedInertia = !isCpu && inertiaActive;
      if (stoppedInertia) stopHelmMotion();
      const action = event.target.closest('[data-ship-action]');
      start = { x: event.clientX, y: event.clientY, pointerId: event.pointerId,
        pointerType: event.pointerType, time: performance.now(), moved: 0,
        action: action && !action.disabled ? action : null };
      if (!isCpu) {
        start.previewBase = lastPose; start.pivot = screenHelmPivot();
        start.stoppedInertia = stoppedInertia; start.angularDelta = 0;
        start.polar = null; start.dragRadius = 48; start.lastMotionTime = 0; start.motionSign = 0;
        start.lastSampleTime = performance.now();
        start.samples = [{ time: start.lastSampleTime, angle: 0 }];
        sampleHelmPointer(start, event);
      }
      // Touch taps dispatch the stored original button explicitly below. Keep
      // their capture on the stage from the start, so live slide hiding cannot
      // discard the pointer halfway through a multi-option drag.
      const target = !isCpu && event.pointerType === 'touch' ? stage
        : event.target.closest('[data-ship-action]') || stage;
      try { target.setPointerCapture(event.pointerId); } catch (_) {}
    }, { passive: true });
    stage.addEventListener('pointermove', event => {
      if (start?.pointerId === event.pointerId) {
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        start.moved = Math.max(start.moved, Math.hypot(dx, dy));
        if (!isCpu) {
          sampleHelmPointer(start, event);
        }
      }
    }, { passive: true });
    stage.addEventListener('pointerup', event => {
      if (!start || start.pointerId !== event.pointerId) return;
      const pointer = start, dx = event.clientX - pointer.x, dy = event.clientY - pointer.y; start = null;
      if (isCpu) {
        if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          suppressPointerClick(pointer, event); show(state.index + (dx < 0 ? 1 : -1));
        }
        return;
      }
      sampleHelmPointer(pointer, event);
      if (pointer.previewed) {
        stopHelmMotion(pointer.previewBase + pointer.angularDelta);
        suppressPointerClick(pointer, event); coastHelm(pointer); return;
      }
      stopHelmMotion();
      if (pointer.stoppedInertia || Math.max(pointer.moved, Math.hypot(dx, dy)) > 10) {
        suppressPointerClick(pointer, event); return;
      }
      if (pointer.pointerType !== 'touch') return;
      suppressPointerClick(pointer, event);
      const action = pointer.action;
      if (!action || action !== slides[state.index] || action.disabled || action.hidden
        || !menu.contains(action) || !visible(action)) return;
      const bounds = action.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right
        || event.clientY < bounds.top || event.clientY > bounds.bottom) return;
      // A browser may omit its compatibility click for a new touch shortly
      // after a swipe. Dispatch the stable tap through the original button,
      // once; a later native click is suppressed even if the menu was removed.
      handledTouchTap = { ...suppressedPointer, until: suppressClickUntil };
      dispatchingTap = true;
      try { action.click(); } finally { dispatchingTap = false; }
    }, { passive: true });
    stage.addEventListener('pointercancel', event => {
      const pointer = start; start = null;
      if (!isCpu) {
        stopHelmMotion();
        suppressPointerClick(pointer, event);
      }
    }, { passive: true });
    stage.addEventListener('click', event => {
      if (dispatchingTap || performance.now() >= suppressClickUntil) return;
      const pointerClick = touchClick(event, suppressedPointer)
        || (suppressedPointer?.pointerType !== 'touch' && event.detail > 0);
      if (pointerClick) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }, true);
    // This runs after the original delegated action. A swallowed swipe never
    // arms a resume, and no menu is reopened merely because it was dismissed.
    menu.addEventListener('click', event => {
      const action = event.target.closest('[data-ship-action]');
      if (!menu.classList.contains('is-cpu') && action && !action.disabled
        && ['items','crew','mission','fleet','ship'].includes(action.dataset.shipAction)
        && visible(document.getElementById('boardModalBack'))) automatic.resume = true;
      schedule();
    });
    menus.set(menu, state); show(0);
    // The desktop placement helper focuses its first bound control on the next
    // frame. A CPU select on another page must never scroll the carousel away.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (menu.isConnected && !menu.contains(document.activeElement)) {
        if (isCpu) previous.focus({ preventScroll: true }); else focusCurrent();
      }
      const active = document.activeElement;
      if (slides.some(slide => slide.hidden && slide.contains(active))) {
        if (isCpu) previous.focus({ preventScroll: true }); else focusCurrent();
      }
    }));
  }
  function ensureScreenMenu(menu) {
    if (menu.classList.contains('is-cpu') || typeof menu.showPopover !== 'function') return false;
    if (menu.dataset.phoneMapPlacement === 'viewport' && menu.matches(':popover-open')) return true;
    // A manual popover is a non-modal paint portal: the exact bound element
    // remains a child of boardGameMap, so original delegated actions, close
    // queries, turn renders and removal still own it. Only its containing box
    // leaves the transformed world. No clone, moved callback or camera state.
    menu.setAttribute('popover', 'manual');
    try {
      menu.showPopover();
      if (!menu.matches(':popover-open')) { menu.removeAttribute('popover'); return false; }
    }
    catch (_) { menu.removeAttribute('popover'); return false; }
    for (const [name, value] of Object.entries({ position: 'fixed', left: 'auto', top: 'auto',
      right: '-.5px', bottom: '-.5px', transform: 'none', margin: '0' })) {
      menu.style.setProperty(name, value, 'important');
    }
    menu.dataset.phoneMapPlacement = 'viewport';
    return true;
  }
  function positionMenu(menu) {
    if (ensureScreenMenu(menu)) return;
    // Feature fallback for old Android WebViews without Popover. CPU controls
    // also retain their source map strip and original field placement.
    const map = document.getElementById('boardGameMap'), viewport = document.getElementById('boardViewport');
    if (!map?.offsetWidth || !viewport) return;
    const mapRect = map.getBoundingClientRect(), view = viewport.getBoundingClientRect();
    const scale = mapRect.width / map.offsetWidth;
    if (!Number.isFinite(scale) || scale <= 0) return;
    const isCpu = menu.classList.contains('is-cpu');
    const width = isCpu ? Math.min(menu.dataset.phoneField === 'true' ? 360 : 208, view.width - 24) : HELM_RADIUS;
    const height = isCpu ? 80 : HELM_RADIUS;
    property(menu, '--android-menu-unscale', String(1 / scale));
    property(menu, '--android-menu-width', `${width}px`);
    property(menu, '--android-menu-height', `${height}px`);
    const visual = window.visualViewport;
    // The playable WebView/visual viewport already excludes system navigation.
    // Subtracting safe-area insets here left a visible sea strip on two edges.
    const visualRight = visual && Number.isFinite(visual.offsetLeft) && visual.width > 0
      ? visual.offsetLeft + visual.width : window.innerWidth;
    const visualBottom = visual && Number.isFinite(visual.offsetTop) && visual.height > 0
      ? visual.offsetTop + visual.height : window.innerHeight;
    const right = isCpu ? view.right : Math.min(view.right, visualRight);
    const bottom = isCpu ? view.bottom : Math.min(view.bottom, visualBottom);
    const x = isCpu ? view.left + (view.width - width) / 2 : right - width;
    property(menu, '--android-menu-x', `${(x - mapRect.left) / scale}px`);
    property(menu, '--android-menu-y', `${(bottom - height - (isCpu ? 10 : 0) - mapRect.top) / scale}px`);
  }
  function present() {
    if (presentationFrame) cancelAnimationFrame(presentationFrame);
    presentationFrame = 0;
    scheduled = false; ensureToolbar(); describeTurnBanner();
    document.querySelectorAll('#boardGameMap .ship-action-menu').forEach(menu => {
      if (!menus.has(menu)) createCarousel(menu);
      if (menus.has(menu)) positionMenu(menu);
    });
    const turn = currentTurn(), eligible = shouldEnable(turn);
    if (!initialCameraApplied && eligible.enabled) {
      initialCameraApplied = fitInitialRoute(turn);
    }
    automaticCommands(turn);
    const menu = document.querySelector('#boardGameMap .ship-action-menu[data-phone-carousel="true"]:not(.is-cpu)');
    const state = menu && menus.get(menu);
    syncCurrentName(menu, state?.slides[state.index]?.dataset.phoneActionLabel || '');
  }
  function schedule() {
    if (scheduled || presentationSuspended) return;
    scheduled = true; presentationFrame = requestAnimationFrame(() => {
      presentationFrame = 0;
      if (layoutRuntime) layoutRuntime.withOwnedDOM(present); else present();
    });
  }
  function scheduleCameraPlacement() {
    if (cameraFrame) return;
    cameraFrame = requestAnimationFrame(() => {
      cameraFrame = 0;
      const fallback = document.querySelectorAll('#boardGameMap .ship-action-menu[data-phone-carousel="true"]:not([data-phone-map-placement="viewport"])');
      if (!fallback.length) return;
      fallback.forEach(positionMenu);
      // Source focus/overview animate for 220ms. Follow that original camera
      // transition so the quarter remains flush throughout, not just at rest.
      const layer = document.getElementById('boardPanZoomLayer');
      const transitioning = layer?.getAnimations?.().some(animation => animation.playState === 'running' || animation.pending);
      if (performance.now() < cameraUntil || transitioning) scheduleCameraPlacement();
    });
  }
  function initialize() {
    mark('phoneMapKeyboard', 'false');
    document.addEventListener('keydown', event => {
      if (['Tab','ArrowLeft','ArrowRight'].includes(event.key)) mark('phoneMapKeyboard', 'true');
    }, true);
    document.addEventListener('pointerdown', event => {
      handledTouchTap = null;
      mark('phoneMapKeyboard', 'false');
    }, { capture: true, passive: true });
    document.addEventListener('click', event => {
      const pointer = handledTouchTap;
      if (!pointer || !event.isTrusted || performance.now() >= pointer.until
        || !touchClick(event, pointer) || !nearPointer(event, pointer)) return;
      if (event.pointerId > 0 && pointer.pointerId > 0 && event.pointerId !== pointer.pointerId) return;
      event.preventDefault(); event.stopImmediatePropagation();
    }, true);
    const ignoreCarouselRecord = record => record.target instanceof Element
      && !!record.target.closest('.ship-action-menu[data-phone-carousel="true"]');
    const onSource = context => {
      if (context?.reasons?.every(reason => reason === 'source')
        && context.records.every(ignoreCarouselRecord)) return;
      present();
    };
    layoutRuntime = window.TabletopBoardPhoneLayout || null;
    if (layoutRuntime) {
      layoutRuntime.subscribe('board-map-commands', onSource, { gameUis: ['board'], roots: [
        '#boardGameMap', '#mapTurnBanner', '#boardModalBack', '#boardToolsPanel', '.board-audio__panel',
        '#battlePageOverlay', '#turnTransitionBanner', '#evolutionHud', '#itemRevealHud', '#boardToastWrap', 'dialog'
      ] });
    }
    const cameraSignals = new MutationObserver(records => {
      let presentationChanged = false, cameraChanged = false;
      for (const record of records) {
        if (record.oldValue === record.target.getAttribute(record.attributeName)) continue;
        // Rotation/slide accessibility is owned by the carousel itself. It
        // updates its caption synchronously, without rescanning turn locks or
        // every modal on each 45 degree boundary of a finger gesture.
        if (ignoreCarouselRecord(record)) continue;
        if (record.type === 'attributes' && record.attributeName === 'style') {
          if (record.target.id === 'boardPanZoomLayer') { cameraChanged = true; continue; }
          if (record.target.matches?.('.phone-ship-helm-art,.phone-ship-rotate-hint,.ship-action-menu[data-phone-carousel="true"]')) continue;
        }
        presentationChanged = true;
      }
      if (presentationChanged) schedule();
      if (cameraChanged) {
        const layer = document.getElementById('boardPanZoomLayer');
        const animated = layer && parseFloat(layer.style.transitionDuration || layer.style.transition?.match(/[\d.]+m?s/)?.[0] || '0') > 0;
        cameraBusyUntil = performance.now() + (animated ? 240 : 100);
        cameraUntil = animated ? performance.now() + 240 : 0;
        if (document.querySelector('#boardGameMap .ship-action-menu[data-phone-carousel="true"]:not([data-phone-map-placement="viewport"])')) scheduleCameraPlacement();
      }
    });
    const observeSignals = () => {
      const layer = document.getElementById('boardPanZoomLayer'), map = document.getElementById('boardGameMap');
      if (layer) cameraSignals.observe(layer, { attributes: true, attributeOldValue: true, attributeFilter: ['style'] });
      if (map) cameraSignals.observe(map, { attributes: true, attributeOldValue: true, subtree: true, attributeFilter: ['title','aria-label','data-player-id'] });
    };
    observeSignals();
    // A standalone old WebView can run this module without the shared phone
    // lifecycle. Its fallback watches source structure/state, never camera
    // style attributes across the entire document.
    const fallbackChanges = !layoutRuntime ? new MutationObserver(records => {
      if (records.some(record => !ignoreCarouselRecord(record))) schedule();
    }) : null;
    const observeFallback = () => fallbackChanges?.observe(document.body, { childList: true, subtree: true,
      attributes: true, attributeFilter: ['class','hidden'] });
    observeFallback();
    window.addEventListener('pagehide', () => {
      presentationSuspended = true; cameraSignals.disconnect(); fallbackChanges?.disconnect();
      if (presentationFrame) cancelAnimationFrame(presentationFrame);
      if (cameraFrame) cancelAnimationFrame(cameraFrame);
      presentationFrame = cameraFrame = 0; scheduled = false;
    });
    window.addEventListener('pageshow', () => {
      presentationSuspended = false; observeSignals(); observeFallback(); schedule();
    });
    window.addEventListener('resize', schedule, { passive: true });
    window.visualViewport?.addEventListener('resize', schedule, { passive: true });
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();


/* Android presentation module: board-phone-v006 */
/* Android v006 Board layout. No rules, persistence or networking are changed.
 * Original controls stay in their source modal/scene event delegation ancestor.
 * The shared image kit supplies skins through data-phone-art hooks. */
(() => {
  'use strict';
  let html=document.documentElement;
  const kinds=new Set(['board','board-start','board-battle','board-spar','board-puzzle']);
  const mark=(node,key,value)=>{if(node&&node.dataset[key]!==value)node.dataset[key]=value;};
  const art=(node,value='panel')=>{if(node?.dataset.phoneArt?.startsWith('source-')&&!value.startsWith('source-'))return;mark(node,'phoneArt',value);};
  const narrative='.final-ending-cinematic,.final-imu-descent[data-final-imu-scene],.final-robin-reading,.final-activation-cinematic,.prebattle-dialogue,.opening-story-shell,.sea-chest-draft-ui,.starter-draft-ui,.draft-recruitment-shell,.draft-harbor-ui,.board-phone-draft-dock,.tavern-game-shell,.tavern-result-ui,.sea-event-choice-ui,.sea-event-result-ui,.sea-chest-stage-shell,.sea-reveal,[data-judicial-chest-choice],#confirmEventIslandBtn';
  function group(parent,selector,className){
    if(!parent||parent.querySelector(':scope > .'+className))return;
    const nodes=[...parent.children].filter(node=>node.matches(selector));if(!nodes.length)return;
    const wrap=document.createElement('div');wrap.className=className;nodes[0].before(wrap);nodes.forEach(n=>wrap.append(n));art(wrap);
  }
  const managementScreens='.crew-roster-ui,.crew-detail-ui,.backpack-shell,.backpack-target-ui,.training-quantity-ui,.healing-quantity-ui,.mission-journal-ui,.mission-board-ui,.ship-info-ui,.fleet-info-ui,.defeated-codex-ui,.research-lab-ui,.training-detail-ui,.carry-item-ui,.cosmetic-frame-ui,.shop-shell,.shop-quantity-box,.hospital-ui,.arena-ui,.captain-selection-ui,.cpu-strategy-ui,.save-load-ui,.move-learn-ui';
  function modalLayout(){
    const modal=document.getElementById('boardModal');if(!modal)return;
    const excluded=modal.matches('.draft-recruitment-modal,.final-imu-fullscreen-modal,.final-robin-fullscreen-modal,.final-activation-fullscreen-modal,.final-ending-fullscreen-modal,.final-boss-compass-fullscreen-modal')||Boolean(modal.querySelector(narrative));
    if(!excluded&&modal.querySelector(managementScreens))mark(modal,'phoneManagementFullscreen','true');
    else if(modal.hasAttribute('data-phone-management-fullscreen'))modal.removeAttribute('data-phone-management-fullscreen');
    if(excluded){if(modal.dataset.phoneV006Modal){delete modal.dataset.phoneV006Modal;modal.removeAttribute('data-phone-art');modal.removeAttribute('data-phone-skin');}return;}
    const kind=modal.querySelector('.move-learn-ui')?'learn':modal.querySelector('.captain-selection-ui')?'captain':modal.querySelector('.cpu-strategy-ui')?'cpu':modal.dataset.phoneDrawer||'prompt';mark(modal,'phoneV006Modal',kind);art(modal);
    let body=modal.querySelector(':scope > .phone-drawer-body,:scope > .phone-v006-generic-body');
    if(!body){
      // In the APK the panel contracts subscriber is the only outer-slot
      // normalizer. Keep the legacy standalone fallback separate.
      if(runtime)return;
      const nodes=[...modal.childNodes];if(!nodes.length)return;
      body=document.createElement('div');body.className='phone-v006-generic-body';
      const lastRow=[...modal.children].reverse().find(n=>n.matches('.modal-row'));const footer=lastRow?document.createElement('footer'):null;
      if(footer)footer.className='phone-v006-generic-footer';
      nodes.forEach(n=>{if(n!==lastRow)body.append(n);});modal.append(body);if(footer){footer.append(lastRow);modal.append(footer);}
    }
    const learn=body.querySelector('.move-learn-ui');
    if(learn)for(const [selector,className]of [['.move-learn-character-caption,.move-learn-new-skill','phone-v006-move-learn-new-info'],['.move-learn-hint,.move-learn-actions','phone-v006-move-learn-footer']]){
      if(learn.querySelector(':scope>.'+className))continue;const parts=[...learn.children].filter(node=>node.matches(selector));if(!parts.length)continue;
      const wrap=document.createElement('div');wrap.className=className;parts[0].before(wrap);parts.forEach(node=>wrap.append(node));
    }
    const backpackPreview=body.querySelector('.backpack-preview');
    if(backpackPreview&&!backpackPreview.querySelector(':scope>.phone-v006-backpack-preview-read')){
      const parts=[...backpackPreview.children].filter(node=>node.matches('.backpack-preview-top,#backpackPreviewName,#backpackPreviewTier,#backpackPreviewMeta'));
      if(parts.length){const read=document.createElement('div');read.className='phone-v006-backpack-preview-read';parts[0].before(read);parts.forEach(node=>read.append(node));}
    }
    group(body.querySelector('.backpack-target-ui'),'.backpack-target-item-stage,.backpack-target-item-name,.backpack-target-item-info,.backpack-target-hint','phone-v006-backpack-target-item');
    const mission=body.querySelector('.mission-journal-ui');
    group(mission,'.mission-journal-rank,.mission-journal-detail-title,.mission-journal-detail-copy,.mission-journal-progress,.mission-journal-reward,.mission-journal-primary-action,.mission-journal-secondary-action','phone-v006-mission-detail');
    const shop=body.querySelector('.shop-shell');
    if(shop){const desc=body.querySelector(':scope > .shop-description-bar');const side=shop.querySelector('.shop-side');if(desc&&side)side.append(desc);}
    const crew=body.querySelector('.crew-detail-ui');
    if(crew){
      const footer=crew.querySelector(':scope > .crew-detail-footer'),action=crew.querySelector(':scope > .crew-detail-actions');if(footer&&action&&!footer.contains(action))footer.prepend(action);
      const form=crew.querySelector('.crew-detail-form-line'),info=crew.querySelector('.crew-detail-info');
      if(form&&info&&form.parentElement!==info){const stats=info.querySelector(':scope>.crew-detail-section');if(stats)stats.after(form);else info.prepend(form);}
    }
    const hospital=body.querySelector('.hospital-ui');
    group(hospital,'.hospital-subtitle,.hospital-service-visual,.hospital-service-copy','phone-v006-hospital-service');
    body.querySelectorAll('.research-lab-card').forEach(card=>group(card,'.research-lab-card-detail,.research-lab-card-action','phone-v006-research-card-actions'));
    const captain=body.querySelector('.captain-selection-ui');group(captain,'.captain-selection-portrait-stage,.captain-selection-character-caption,.captain-selection-character-info,.captain-selection-hint','phone-v006-captain-detail');
    const arena=body.querySelector('.arena-ui');
    if(arena){group(arena,'.arena-island,.arena-rules','phone-v006-arena-summary');const summary=arena.querySelector('.phone-v006-arena-summary'),crew=arena.querySelector('.arena-crew');if(summary&&crew&&!crew.contains(summary))crew.append(summary);}
    group(body.querySelector('.ship-info-ui'),'.ship-info-vessel-stage,.ship-info-vessel-caption,.ship-info-status-bar','phone-v006-ship-preview');
    group(body.querySelector('.cosmetic-frame-ui'),'.cosmetic-frame-preview-area,.cosmetic-frame-preview-name,.cosmetic-frame-preview-status','phone-v006-cosmetic-preview');
    group(body.querySelector('.carry-item-ui'),'.carry-current-icon-stage,.carry-current-name,.carry-current-copy,.carry-current-action','phone-v006-carry-current');
    modal.querySelectorAll('button,select,summary').forEach(n=>art(n,n.matches('select')?'field':n.matches('.primary,.primary-btn')?'primary-button':'button'));
    modal.querySelectorAll('.crew-manage-card,.hospital-crew-card,.research-lab-card,.backpack-item-row,.shop-item-row,.mission-journal-row,.defeated-codex-row').forEach(n=>art(n,n.matches('button')?'row':'card'));
    body.querySelectorAll('.backpack-list-panel,.backpack-preview,.crew-detail-info,.mission-journal-list,.defeated-codex-list,.defeated-codex-detail').forEach(n=>art(n));
    if(modal.dataset.phoneManagementFullscreen==='true'&&modal.dataset.phoneV006Modal==='crew'){
      const roster=body.querySelector('.crew-roster-ui'),list=roster?.querySelector('.crew-manage-list');
      if(roster&&list){
        const bounds=roster.getBoundingClientRect(),listBounds=list.getBoundingClientRect(),footer=roster.querySelector(':scope>.crew-roster-footer'),bottom=footer?Math.min(bounds.bottom,footer.getBoundingClientRect().top-4):bounds.bottom,available=Math.floor(bottom-listBounds.top);
        if(available>=80){const count=Math.max(1,Math.min(list.childElementCount||1,Math.floor((available+4)/84))),row=Math.min(90,Math.floor((available-(count-1)*4)/count)),height=count*row+(count-1)*4;for(const [name,value]of [['--phone-roster-row-height',row+'px'],['--phone-roster-viewport-height',height+'px']])if(list.style.getPropertyValue(name)!==value)list.style.setProperty(name,value);mark(list,'phoneRosterVisibleRows',String(count));}
      }
    }
  }
  function sourcePanels(){
    const kind=html.dataset.gameUi;
    const selectors={
      'board-start':'.player-card,.entry-auth-card,.sheet,.lobby-shell,.lobby-chat,.seat-card,.campaign-save-panel,.account-profile-menu,.campaign-remove-dialog,.adventure-gallery',
      'board-battle':'[data-layout-id="playerHud"],[data-layout-id="enemyHud"],[data-layout-id="actionPanel"],[data-layout-id="infoPanel"],.status-popover,.battle-decision-hints,.postgame-boss-mechanic-panel,.coop-view-menu,.tot-musica-team-lane,.postgame-world-column',
      'board': '#phoneMapTools,#mapTurnBanner,.ship-action-menu,#boardToolsPanel'
    };
    if(selectors[kind])document.querySelectorAll(selectors[kind]).forEach(n=>{if(n.dataset.phoneArt?.startsWith('source-'))return;if(kind==='board-battle'&&n.matches('.hud-panel')){art(n,'battle-hud');mark(n,'phoneSkin','battle-hud');}else art(n);});
    if(kind==='board-battle'){
      document.querySelectorAll('.tot-musica-team-setup-ui .battle-command-heading>span').forEach(n=>{const hint='點船員，再點左／右隊位置';if(n.textContent!==hint)n.textContent=hint;});
      document.querySelectorAll('[data-tot-team-slot]>.tot-musica-team-order').forEach(n=>{const position=Number(n.parentElement.dataset.totTeamPosition)+1,label=position+(position===1?'・先發':'');n.setAttribute('aria-label',label);if(n.textContent!==String(position))n.textContent=String(position);});
    }
    if(kind==='board-battle'){
      const panel=document.getElementById('postgameBossMechanicPanel');
      if(panel&&!panel.querySelector(':scope > .phone-v006-boss-header')){const head=document.createElement('header');head.className='phone-v006-boss-header';panel.prepend(head);for(const id of ['postgameBossMechanicIsland','postgameBossMechanicTitle','postgameBossMechanicClose']){const n=document.getElementById(id);if(n)head.append(n);}}
    }
    document.querySelectorAll('.board-hotkeys-dialog,.adventure-gallery,#boardFriendDock,#boardInviteSheet').forEach(n=>art(n));
    // Image skin only, no fabricated replacement controls.
    const controlRoots={'board-start':'.page,.board-entry,dialog','board-battle':'[data-layout-id="actionPanel"],#infoContent,.coop-view-switch,.status-popover','board':'#phoneMapTools,.ship-action-menu,#boardToolsPanel,#boardTools'};
    if(controlRoots[kind])document.querySelectorAll(controlRoots[kind]).forEach(root=>root.querySelectorAll('button,summary,select').forEach(n=>art(n,n.matches('select')?'field':n.matches('.primary,.primary-btn,.home-menu-btn.primary')?'primary-button':'button')));
    if(kind==='board-battle')restoreSourceBattleArt();
  }
  function restoreSourceBattleArt(){
    const native=node=>{art(node,'source-art');mark(node,'phoneSkin','source-art');};
    document.querySelectorAll('.hud-panel,.tot-musica-world-hud,#totMusicaBossHud,[data-layout-id="actionPanel"],.action-button,.battle-command-choice,.battle-command-notice-button,.battle-switch-card,.tot-musica-world-command,.postgame-world-column').forEach(native);
    // These source buttons use state-specific CSS paint, rather than a bitmap.
    // Keep that paint while excluding them from the generated mobile skin.
    document.querySelectorAll('.postgame-world-action,.status-icon').forEach(node=>{art(node,'source-css');mark(node,'phoneSkin','source-css');});
    document.querySelectorAll('.action-button').forEach(button=>{
      if(button.querySelector(':scope>.phone-battle-source-action-face'))return;
      const parts=[...button.children].filter(n=>n.matches('.action-button-frame,.action-symbol,.action-label'));
      if(!parts.length)return;const face=document.createElement('div');face.className='phone-battle-source-action-face';parts.forEach(n=>face.append(n));button.append(face);
    });
    const panel=document.querySelector('[data-layout-id="infoPanel"]'),content=document.getElementById('infoContent');
    if(!panel||!content)return;
    const frame=content.querySelector('.battle-command-panel-frame,.battle-switch-panel-frame,.postgame-world-panel-frame');
    if(frame){
      const previous=panel.querySelector(':scope>.phone-battle-source-panel-frame');
      // This bitmap has no gameplay listener. A source poll recreates the same
      // frame while the phone keeps it outside the source-owned reading pane.
      // Keep its decoded, already painted node when all source attributes match.
      if(previous&&previous.complete&&previous.naturalWidth&&battleImageKey(previous)===battleImageKey(frame)){frame.remove();lifecycle.retainedFrames++;}
      else{previous?.remove();frame.classList.add('phone-battle-source-panel-frame');panel.prepend(frame);}
    }
    if(panel.querySelector(':scope>.phone-battle-source-panel-frame'))native(panel);
  }
  let queued=false,frameId=0,observer=null,runtime=null,paused=false,lastEntryView='',battleScrollScope='',battleSourceRevision=0,battleSourceRestorePending=false;
  const lifecycle={refreshes:0,battleRefreshes:0,sourceRebuilds:0,scrollRestores:0,ignoredBattleRecords:0,sourceBatches:0,retainedImages:0,retainedFrames:0};
  const battleImages=new WeakMap();
  function battleImageKey(image){
    return [...image.attributes].filter(a=>!a.name.startsWith('data-phone-'))
      .map(a=>[a.name,a.name==='class'?a.value.split(/\s+/).filter(c=>c&&!c.startsWith('phone-')).sort().join(' '):a.value])
      .sort(([a],[b])=>a.localeCompare(b)).map(([name,value])=>name+'='+value).join('|');
  }
  function retainBattleImages(){
    if(html.dataset.gameUi!=='board-battle')return;
    // Only decorative child images are retained. Source buttons are rebuilt
    // normally, so their fresh handlers are never accumulated or substituted.
    // No source interval, animation, state, event or portrait setter is wrapped.
    const roots='#playerStatusIcons,#enemyStatusIcons,#totMusicaRealStatusIcons,#totMusicaSongStatusIcons,#totMusicaBossStatusIcons,#infoContent,#playerCard,#enemyCard,#totMusicaRealFrame,#totMusicaSongFrame,#totMusicaBossFrame';
    for(const root of document.querySelectorAll(roots)){
      const previous=battleImages.get(root)||new Map(),next=new Map(),occurrences=new Map();
      const selector=root.matches('#playerCard,#enemyCard,#totMusicaRealFrame,#totMusicaSongFrame,#totMusicaBossFrame')?':scope>.cosmetic-frame-layer,:scope>.tot-musica-dual-nika-layer':'img';
      for(let image of root.querySelectorAll(selector)){
        const signature=battleImageKey(image),ordinal=occurrences.get(signature)||0,key=signature+'|'+ordinal;
        occurrences.set(signature,ordinal+1);
        const decoded=previous.get(key);
        if(decoded&&decoded!==image&&!decoded.isConnected&&decoded.complete&&decoded.naturalWidth){image.replaceWith(decoded);image=decoded;lifecycle.retainedImages++;}
        // One current source tree per root, never an accumulating image cache.
        next.set(key,image);
      }
      battleImages.set(root,next);
    }
  }
  const scrollMemory=new Map(),scrollKeys=new WeakMap();
  const scrollPanes='.tot-musica-team-board,.tot-musica-team-roster,.postgame-world-actions,.tot-musica-world-option-grid,.battle-switch-grid,.battle-command-scroll,.battle-item-target-grid,.battle-command-body,.skill-scroll,#infoContent,#playerHudMeta,#enemyHudMeta,#battleDecisionHints,.oars-lottery-scroll,.phone-battle-gba-detail';
  const scrollRoles=scrollPanes.split(',');
  let battlePanelDismissed=false,battlePresentationScope='',totOpenWorld='',totActionPending=false;
  let gbaSelection='',gbaContext='',gbaDispatching=false,gbaRequestedMode='';
  const gbaChoices='.battle-command-choice,.battle-switch-card';
  const gbaName=button=>button.querySelector('.battle-command-choice-name,.battle-switch-name')?.textContent.trim()||button.textContent.trim();
  const gbaKey=button=>[...button.attributes].filter(a=>a.name.startsWith('data-')&&!a.name.startsWith('data-phone')).map(a=>a.name+'='+a.value).sort().join('|')+'|'+gbaName(button);
  function gbaBattleCommands(panel,content,stage,scope){
    const enabled=!stage.classList.contains('tot-musica-battle-mode')&&panel.dataset.phoneBattleSheet==='open';
    mark(panel,'phoneGba',String(enabled));
    const screen=!enabled?'':content.querySelector('[data-item-target-back]')?'target':content.querySelector('.battle-switch-ui')?'party':content.querySelector('[aria-label="戰鬥道具"]')?'bag':!content.querySelector(':scope>section')&&gbaRequestedMode==='partners'?'party':'';
    mark(panel,'phoneBattleScreen',screen);mark(html,'phoneBattleScreen',screen);
    if(!enabled)return;
    const header=panel.querySelector('.phone-battle-sheet-header');
    let subtitle=header.querySelector('.phone-battle-sheet-subtitle');
    if(!subtitle){subtitle=document.createElement('small');subtitle.className='phone-battle-sheet-subtitle';header.append(subtitle);}
    const sourceHint=screen?content.querySelector('.battle-switch-heading span,.battle-command-heading span')?.textContent.trim()||'':'';
    if(subtitle.textContent!==sourceHint)subtitle.textContent=sourceHint;
    const buttons=[...content.querySelectorAll(gbaChoices)],context=scope+'|'+content.querySelector(':scope>section')?.getAttribute('aria-label')+'|'+buttons.map(gbaKey).join(';')+'|'+(content.querySelector('[data-item-target-back]')?.textContent.trim()||'');
    if(context!==gbaContext){gbaContext=context;gbaSelection='';}
    let detail=panel.querySelector(':scope>.phone-battle-gba-detail');
    if(!detail){detail=document.createElement('aside');detail.className='phone-battle-gba-detail';detail.setAttribute('aria-live','polite');detail.append(document.createElement('strong'),document.createElement('small'));panel.append(detail);}
    let use=panel.querySelector(':scope>.phone-battle-gba-use');
    if(!use){use=document.createElement('button');use.type='button';use.className='phone-battle-gba-use';use.textContent='使用';art(use,'button');use.addEventListener('click',()=>{
      const current=[...content.querySelectorAll(gbaChoices)].find(b=>gbaKey(b)===gbaSelection);
      if(!current||current.disabled)return;
      gbaDispatching=true;try{current.click();}finally{gbaDispatching=false;gbaSelection='';schedule();}
    });panel.append(use);}
    const actionLabel=screen==='party'?'換人':'使用';if(use.textContent!==actionLabel)use.textContent=actionLabel;
    const selected=buttons.find(b=>gbaKey(b)===gbaSelection);
    for(const button of buttons){const on=button===selected;mark(button,'phoneGbaSelected',String(on));button.setAttribute('aria-pressed',String(on));}
    const name=selected?gbaName(selected):'選擇項目';
    const selectHint=screen==='party'?'選擇夥伴後按換人':screen==='target'?'選擇對象後按使用':'點選後查看說明，再按使用';
    let text=selected?[...selected.querySelectorAll('.battle-command-choice-meta,.battle-switch-meta,.battle-switch-status')].map(n=>n.textContent.trim()).filter(Boolean).join(' ・ '):(buttons.length?selectHint:content.textContent.trim());
    const escapeNotice=content.querySelector('.battle-command-escape-notice .battle-command-notice-meta')?.textContent.trim();
    if(escapeNotice)text=[text,escapeNotice].filter(Boolean).join(' ・ ');
    const changedName=detail.firstElementChild.textContent!==name;
    if(changedName)detail.firstElementChild.textContent=name;
    if(detail.lastElementChild.textContent!==text)detail.lastElementChild.textContent=text;
    if(changedName)detail.scrollTop=0;
    use.disabled=!selected||selected.disabled;
    const close=panel.querySelector('.phone-battle-sheet-close');
    if(close.textContent!=='返回')close.textContent='返回';
    close.setAttribute('aria-label',content.querySelector('[data-item-target-back]')?'返回道具清單':'返回戰鬥指令');
  }
  function battlePresentation(){
    if(html.dataset.gameUi!=='board-battle')return;
    const stage=document.getElementById('battleStage'),panel=document.querySelector('[data-layout-id="infoPanel"]'),content=document.getElementById('infoContent');
    if(!stage||!panel||!content)return;
    let header=panel.querySelector(':scope>.phone-battle-sheet-header');
    if(!header){header=document.createElement('header');header.className='phone-battle-sheet-header';const title=document.createElement('strong');title.className='phone-battle-sheet-title';const close=document.createElement('button');close.type='button';close.className='phone-battle-sheet-close';close.textContent='回戰場';close.setAttribute('aria-label','收起戰鬥選單，回到戰場');close.addEventListener('click',()=>{const back=panel.dataset.phoneGba==='true'&&content.querySelector('[data-item-target-back]');gbaSelection='';if(back){back.click();schedule();return;}battlePanelDismissed=true;totOpenWorld='';schedule();});art(close,'button');header.append(title,close);panel.prepend(header);}
    const ui=content.querySelector(':scope>.battle-command-ui,:scope>.battle-switch-ui');
    let view;try{view=window.__BOARD_BATTLE_DEBUG__?.latestView?.();}catch(_error){}
    const battle=view?.battle||{},scope=[battle.battleId||battle.id||battle.islandId,view?.player?.id,view?.activeCard?.id,view?.enemy?.key,battle.roundIndex||battle.round].join('|');
    if(scope!==battlePresentationScope){battlePresentationScope=scope;battlePanelDismissed=false;totOpenWorld='';totActionPending=false;}
    const idle=Boolean(content.querySelector('.battle-command-idle'))||!content.children.length;
    const compulsory=Boolean(battle.postgameBossMechanic?.prompt||battle.yonkoPrompt||battle.judicialSwitchPrompt||battle.needsReplacement||battle.result||battle.canFinish||battle.coopRescueWait?.active||panel.classList.contains('tot-musica-dual-action-mode'));
    const special=compulsory||panel.classList.contains('result-mode');
    if(idle)battlePanelDismissed=false;
    const watchOnly=battle.canControl===false||battle.animating||battle.canAct===false;
    mark(panel,'phoneBattleSheet',special?'required':idle||watchOnly||battlePanelDismissed?'closed':'open');
    mark(html,'phoneBattleSheet',panel.dataset.phoneBattleSheet);
    const dual=Boolean(content.querySelector('.postgame-dual-command-ui'))&&panel.classList.contains('tot-musica-dual-action-mode');
    let nav=stage.querySelector(':scope>.phone-tot-world-nav');
    if(!nav){nav=document.createElement('nav');nav.className='phone-tot-world-nav';nav.setAttribute('aria-label','選擇雙世界行動');for(const world of ['real','song']){const button=document.createElement('button');button.type='button';button.dataset.phoneTotWorld=world;button.append(document.createElement('strong'),document.createElement('small'));button.addEventListener('click',()=>{totOpenWorld=totOpenWorld===world?'':world;schedule();});art(button,'button');nav.append(button);}stage.append(nav);}
    const sourceHidden=panel.hidden||panel.classList.contains('is-hidden')||panel.classList.contains('dialogue-hidden')||stage.matches('.tot-musica-resolving,.tot-musica-wave-launching,.tot-musica-enemy-turn,.tot-musica-boss-view')||panel.classList.contains('tot-musica-boss-preview-hidden');
    const navHidden=!dual||watchOnly||sourceHidden;if(nav.hidden!==navHidden)nav.hidden=navHidden;
    mark(html,'phoneTotReady',String(dual&&!watchOnly&&!sourceHidden));
    if(dual){
      const columns=[...content.querySelectorAll('.postgame-world-column')];
      if(totActionPending&&(columns.find(n=>n.classList.contains('song')===(totOpenWorld==='song'))?.querySelector('.tot-musica-world-selected')||columns.every(n=>[...n.querySelectorAll('button')].every(b=>b.disabled)))){totOpenWorld='';totActionPending=false;}
      for(const column of columns){const world=column.classList.contains('song')?'song':'real',button=nav.querySelector(`[data-phone-tot-world="${world}"]`),head=column.querySelector('.postgame-world-heading'),name=head?.querySelector('span')?.childNodes[0]?.textContent.trim()||head?.textContent.trim()||'船員',status=head?.querySelector('small')?.textContent.trim()||'選擇行動';const nameText=(world==='real'?'現實世界':'歌世界')+'・'+name;const strong=button.querySelector('strong'),small=button.querySelector('small');if(strong.textContent!==nameText)strong.textContent=nameText;if(small.textContent!==status)small.textContent=status;button.setAttribute('aria-expanded',String(totOpenWorld===world));mark(column,'phoneTotVisible',String(totOpenWorld===world));}
      mark(panel,'phoneBattleSheet',totOpenWorld&&!sourceHidden?'dual-open':'closed');mark(html,'phoneBattleSheet',panel.dataset.phoneBattleSheet);mark(html,'phoneTotWorld',totOpenWorld||'none');
    }else mark(html,'phoneTotWorld','none');
    const activeColumn=dual&&totOpenWorld?content.querySelector(`.postgame-world-column${totOpenWorld==='song'?'.song':':not(.song)'}`):null;
    const worldBack=activeColumn?.querySelector('[data-tot-world-back]'),modeTitle=activeColumn?.querySelector('.tot-musica-world-mode-head>b')?.textContent.trim();
    const label=dual&&totOpenWorld?(modeTitle?(totOpenWorld==='real'?'現實':'歌世界')+'・'+modeTitle:nav.querySelector(`[data-phone-tot-world="${totOpenWorld}"] strong`).textContent):ui?.getAttribute('aria-label')||document.getElementById('infoTitle')?.textContent||'戰鬥指令',title=header.querySelector('strong');if(title.textContent!==label)title.textContent=label;
    const close=header.querySelector('button'),hideClose=special&&!dual;if(close.hidden!==hideClose)close.hidden=hideClose;
    const setup=Boolean(content.querySelector('.tot-musica-team-setup-ui')),workScreen=stage.classList.contains('tot-musica-boss-view')?'boss-preview':setup?'team':'none';mark(html,'phoneBattleWorkScreen',workScreen);
    for(const meta of document.querySelectorAll('#playerHudMeta,#enemyHudMeta')){
      if(!meta.childElementCount)continue;
      const basics=[...meta.children].filter(node=>node.matches('.pill')&&(node.matches('.attribute-pill')||/^(HP\s|Lv\.)/.test(node.textContent.trim())));
      if(basics.length){const wrap=document.createElement('div');wrap.className='phone-battle-hud-basics';for(const node of basics){mark(node,'phoneHudSummary',node.matches('.attribute-pill')?'attribute':/^HP\s/.test(node.textContent.trim())?'hp':'level');wrap.append(node);}meta.prepend(wrap);}
      let carry=[...meta.children].find(node=>node.matches('.carry-pill,[data-phone-enemy-carry]')||/^攜帶物[：:]/.test(node.textContent.trim()));
      if(!carry&&meta.id==='enemyHudMeta'){carry=document.createElement('span');carry.className='pill';carry.dataset.phoneEnemyCarry='true';carry.textContent='攜帶物：—';carry.setAttribute('aria-label','原敵方資料未提供攜帶物');meta.append(carry);}
      if(carry){mark(carry,'phoneHudSummary','carry');art(carry,'source-css');mark(carry,'phoneSkin','source-css');}
      if(!meta.querySelector(':scope>.phone-battle-hud-reading')) {
        const reading=document.createElement('div');reading.className='phone-battle-hud-reading';
        const hp=meta.querySelector('[data-phone-hud-summary="hp"]');if(hp)reading.append(hp);
        for(const pill of [...meta.children])if(pill.matches('.pill')&&pill!==carry)reading.append(pill);
        meta.append(reading);
      }
    }
    gbaBattleCommands(panel,content,stage,scope);
    battleScrollSurface(panel,content);
  }
  function battleScrollSurface(panel,content){
    const screen=panel.dataset.phoneBattleScreen,sheet=panel.dataset.phoneBattleSheet;
    // Full pages and mandatory prompts share the persistent source element.
    // Compact attack/escape strips retain the established GBA field layout.
    const active=sheet==='required'||sheet==='dual-open'||sheet==='open'&&['party','bag','target'].includes(screen);
    mark(content,'phoneBattleScroll',active?'persistent':'source');
    const containers='.battle-command-ui,.battle-switch-ui,.battle-command-body,.battle-command-scroll,.battle-item-target-layout,.skill-scroll,.partner-scroll,.oars-lottery-scroll,.tot-musica-team-board,.tot-musica-team-roster,.postgame-dual-world-grid,.postgame-world-column,.postgame-world-actions,.tot-musica-world-option-grid';
    content.querySelectorAll(containers).forEach(node=>mark(node,'phoneBattleFlow','content'));
    content.querySelectorAll('.battle-command-heading,.tot-musica-world-mode-head').forEach(node=>mark(node,'phoneBattleChrome','heading'));
    content.querySelectorAll('.oars-betting-footer,.postgame-dual-confirm').forEach(node=>mark(node,'phoneBattleChrome','actions'));
    content.querySelectorAll('.tot-musica-team-setup-ui').forEach(node=>mark(node,'phoneBattleComposition','teams'));
  }
  function openOriginalBattleMode(event){
    if(html.dataset.gameUi!=='board-battle')return;
    const button=event.target instanceof Element?event.target.closest('[data-mode]'):null;
    if(button&&!button.disabled){battlePanelDismissed=false;gbaSelection='';gbaRequestedMode=button.dataset.mode;schedule();}
    const choice=event.target instanceof Element?event.target.closest(gbaChoices):null;
    if(choice&&!choice.disabled&&!gbaDispatching&&choice.closest('[data-phone-gba="true"]')){event.preventDefault();event.stopImmediatePropagation();gbaSelection=gbaKey(choice);schedule();return;}
    const action=event.target instanceof Element?event.target.closest('[data-tot-world-action],[data-tot-world-item-target],[data-tot-world-item-side]'):null;if(action&&!action.disabled){totActionPending=true;schedule();}
  }
  function battleView(){let view;try{view=window.__BOARD_BATTLE_DEBUG__?.latestView?.();if(!view)view=JSON.parse(localStorage.getItem('onepiece-board-battle-snapshot-v1'))?.view;}catch(_error){}return view;}
  function battleScrollKey(node){
    // Semantic ownership survives original innerHTML renders. Cosmetic classes,
    // a new round, or opening the other Tot world do not identify a new list.
    const content=document.getElementById('infoContent'),world=node.id==='infoContent'?content.querySelector('.postgame-world-column[data-phone-tot-visible="true"]'):node.closest('.postgame-world-column'),section=node.closest('.battle-command-ui,.battle-switch-ui');
    const owner=world||section||content||node.parentElement,role=node.id?'#'+node.id:scrollRoles.find(selector=>node.matches(selector))||node.tagName;
    const worldName=world?(world.classList.contains('song')?'song':'real'):'single';
    const mode=world?.querySelector('.tot-musica-world-mode-head>b')?.textContent.trim()||'commands';
    const label=(section||content?.querySelector(':scope>.battle-command-ui,:scope>.battle-switch-ui'))?.getAttribute('aria-label')||gbaRequestedMode||'field';
    const ordinal=node.id||owner===node?0:[...(owner?.querySelectorAll(role)||[])].indexOf(node);
    const subject=node.id==='playerHudMeta'?battleView()?.activeCard?.id||'':node.matches('.phone-battle-gba-detail')?node.firstElementChild?.textContent||'':'';
    return [battleScrollScope,label,worldName,mode,role,Math.max(0,ordinal),subject].join('|');
  }
  function rememberBattleScroll(key,node){
    if(!key)return;
    scrollMemory.delete(key);scrollMemory.set(key,{top:node.scrollTop,left:node.scrollLeft});
    // This is transient presentation memory, not a game/save field.
    if(scrollMemory.size>96)scrollMemory.delete(scrollMemory.keys().next().value);
  }
  function restoreBattleScroll(){
    if(html.dataset.gameUi!=='board-battle')return;
    const view=battleView(),battle=view?.battle||{},scope=[battle.battleId||battle.id||battle.islandId,view?.player?.id,view?.enemy?.key].join('|');
    if(scope!==battleScrollScope){battleScrollScope=scope;scrollMemory.clear();}
    document.querySelectorAll(scrollPanes).forEach(n=>{
      const key=battleScrollKey(n),registered=scrollKeys.get(n);
      if(registered?.key===key&&registered.revision===battleSourceRevision)return;
      scrollKeys.set(n,{key,revision:battleSourceRevision});const position=scrollMemory.get(key);
      if(!position){if(registered&&registered.key!==key&&n.id==='infoContent'){if(n.scrollTop){n.scrollTop=0;lifecycle.scrollRestores++;}if(n.scrollLeft){n.scrollLeft=0;lifecycle.scrollRestores++;}}return;}
      const top=Math.max(0,Math.min(position.top,n.scrollHeight-n.clientHeight)),left=Math.max(0,Math.min(position.left,n.scrollWidth-n.clientWidth));
      if(Math.abs(n.scrollTop-top)>.5){n.scrollTop=top;lifecycle.scrollRestores++;}
      if(Math.abs(n.scrollLeft-left)>.5){n.scrollLeft=left;lifecycle.scrollRestores++;}
    });
    battleSourceRestorePending=false;
  }
  function captureBattleScroll(event){
    const n=event.target;if(html.dataset.gameUi!=='board-battle'||!(n instanceof Element)||!n.matches(scrollPanes)||!n.isConnected)return;
    const key=battleScrollKey(n);if(scrollKeys.get(n)?.key!==key||battleSourceRestorePending)return;
    rememberBattleScroll(key,n);
  }
  function entryNavigation(){
    if(html.dataset.gameUi!=='board-start')return;
    const view=document.querySelector('.view.active')?.dataset.view||'';
    // The source opens the friends drawer for Social. Collapse that same
    // original drawer when leaving Social, before the next screen's controls.
    if(lastEntryView==='social'&&view&&view!=='social')window.BoardShared?.closeFriends?.();
    lastEntryView=view;
  }
  const ownedRoots=['#boardModal','#phoneMapTools','#mapTurnBanner','#boardGameMap .ship-action-menu','#boardToolsPanel','#boardTools','#battleStage','html[data-game-ui="board-start"] .page','html[data-game-ui="board-spar"] .stage','html[data-game-ui="board-puzzle"] .stage','#difficultyScreen','#puzzleScreen'];
  const battleContentRoots='#infoContent,#playerHudMeta,#enemyHudMeta,#statusPopover,#coopViewSwitch,#postgameBossMechanicPanel,#battleDecisionHints';
  function battleRecordRelevant(record){
    const target=record.target instanceof Element?record.target:record.target.parentElement;if(!target)return false;
    if(target===html)return true;
    if(target.closest(battleContentRoots))return true;
    if(target.matches('#battleStage,[data-layout-id="infoPanel"],[data-layout-id="actionPanel"],#infoTitle,.hud-panel'))return true;
    // Portrait animation classes and dice/effect ticks do not change a menu.
    // Source content insertion into the stage can introduce a real new layer.
    return record.type==='childList'&&[...record.addedNodes,...record.removedNodes].some(node=>node instanceof Element&&(node.matches(battleContentRoots)||node.querySelector(battleContentRoots)));
  }
  function noteSourceRecords(records){
    const rebuilt=records.some(record=>record.type==='childList'&&record.target instanceof Element&&record.target.matches('#infoContent,#playerHudMeta,#enemyHudMeta'));
    if(!rebuilt)return;
    battleSourceRevision++;battleSourceRestorePending=true;lifecycle.sourceRebuilds++;
    // Detached source scrollers can still contain the final native position.
    // Do not let a detached zero overwrite the last connected scroll event.
    for(const record of records)if(record.type==='childList')for(const removed of record.removedNodes){
      if(!(removed instanceof Element))continue;
      for(const node of [removed,...removed.querySelectorAll(scrollPanes)]){
        const key=scrollKeys.get(node)?.key;if(key&&(node.scrollTop>0||node.scrollLeft>0||!scrollMemory.has(key)))rememberBattleScroll(key,node);
      }
    }
  }
  function observeFallback(){
    if(!observer||paused)return;
    // Only the legacy single-module fallback owns these concrete scene roots.
    // The full APK uses the shared runtime's one lifecycle/observer.
    const roots=new Set(ownedRoots.flatMap(selector=>[...document.querySelectorAll(selector)]));
    for(const root of roots)observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','data-phone-drawer']});
    observer.observe(html,{attributes:true,attributeFilter:['data-game-ui','data-platform']});
  }
  function refresh(context={}){
    queued=false;frameId=0;if(paused||html.dataset.platform!=='android'||!kinds.has(html.dataset.gameUi))return;
    const records=[...(context.records||[]),...(observer?.takeRecords()||[])];
    if(html.dataset.gameUi==='board-battle'){
      lifecycle.sourceBatches++;noteSourceRecords(records);
      const onlySource=context.reasons?context.reasons.length>0&&context.reasons.every(reason=>reason==='source'):context.reason==='source';
      if(records.length&&onlySource&&records.every(record=>!battleRecordRelevant(record))){lifecycle.ignoredBattleRecords+=records.length;return;}
      lifecycle.battleRefreshes++;
    }
    observer?.disconnect();
    try{lifecycle.refreshes++;mark(html,'phoneV006','board');if(html.dataset.gameUi==='board')modalLayout();entryNavigation();retainBattleImages();sourcePanels();battlePresentation();restoreBattleScroll();}
    finally{observeFallback();}
  }
  const schedule=()=>{
    if(paused)return;
    if(runtime){runtime.request('board-v006-input');return;}
    if(!queued){queued=true;frameId=requestAnimationFrame(()=>refresh());}
  };
  const start=()=>{
    html=document.documentElement;runtime=window.TabletopBoardPhoneLayout;
    if(runtime)runtime.subscribe('board-v006',refresh,{gameUis:[...kinds],roots:ownedRoots});
    else{observer=new MutationObserver(records=>{noteSourceRecords(records);schedule();});refresh();window.addEventListener('resize',schedule,{passive:true});}
    document.addEventListener('scroll',captureBattleScroll,true);document.addEventListener('click',openOriginalBattleMode,true);
    window.addEventListener('pagehide',()=>{paused=true;if(frameId)cancelAnimationFrame(frameId);frameId=0;queued=false;observer?.disconnect();});
    window.addEventListener('pageshow',event=>{if(!event.persisted&&!paused)return;paused=false;observeFallback();schedule();});
    window.__TABLETOP_PHONE_BATTLE_RUNTIME__=Object.freeze({version:18,snapshot:()=>({...lifecycle,paused,queued,sourceRevision:battleSourceRevision,scrollEntries:scrollMemory.size,sharedScheduler:!!runtime})});
  };
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})();


/* Android presentation module: board-phone-battle-background */
(function () {
  'use strict';
  if (!window.__TABLETOP_ANDROID_GAME_UI__ || location.pathname.toLowerCase() !== '/board_battle.html') return;

  // Source owns the backdrop choice. Retain a dedicated composited backdrop
  // while foreground effects repaint, replacing its image only after decode.
  const stages = new WeakMap();
  window.TabletopPhoneBattleBackground = {
    apply(stage, url) {
      if (!stage || !url || document.documentElement?.dataset.platform !== 'android') return false;
      let state = stages.get(stage);
      if (!state) {
        state = { requested: '', generation: 0, pending: null, current: null, failed: '', attempts: 0, retryAt: 0 };
        stages.set(stage, state);
      }
      if (state.requested !== url) {
        state.requested = url;
        state.generation += 1;
        if (state.pending) state.pending.onload = state.pending.onerror = null;
        state.pending = null;
        state.failed = '';
        state.attempts = 0;
        state.retryAt = 0;
      }
      // Check the requested URL first: A -> pending B -> A must cancel B even
      // though the source's displayed-url guard still correctly reports A.
      if ((stage.dataset.battleBgUrl === url && state.layer?.isConnected && state.current) || state.pending) return true;
      // Retry transient failures using the source's existing refresh calls,
      // with a bounded backoff instead of creating another timer or loop.
      if (state.failed === url && (state.attempts >= 3 || Date.now() < state.retryAt)) return true;
      const generation = state.generation;
      const image = new Image();
      state.attempts += 1;
      state.pending = image;
      let decoding = false;
      const active = () => state.generation === generation && state.requested === url && state.pending === image;
      const release = () => { image.onload = image.onerror = null; };
      const failed = () => {
        release();
        if (!active()) return;
        state.pending = null;
        state.failed = url;
        state.retryAt = Date.now() + 3000;
      };
      const commit = () => {
        release();
        if (!active()) return;
        state.pending = null;
        if (!stage.isConnected || !image.naturalWidth) return;
        // Hold only the displayed image and the pending replacement, so the
        // decoded image is available when CSS consumes the same original URL.
        state.current = image;
        if (!state.layer?.isConnected) {
          const css = getComputedStyle(stage);
          state.background = css.backgroundImage;
          const layer = document.createElement('div');
          layer.className = 'phone-battle-backdrop';
          layer.setAttribute('aria-hidden', 'true');
          Object.assign(layer.style, {position:'absolute',inset:'0',pointerEvents:'none',zIndex:'0',transform:'translateZ(0)',contain:'paint',backgroundColor:css.backgroundColor,backgroundSize:css.backgroundSize,backgroundPosition:css.backgroundPosition,backgroundRepeat:css.backgroundRepeat});
          state.layer = layer;
          stage.prepend(layer);
        }
        state.layer.style.backgroundImage = state.background.replace(/url\([^)]*\)/g, `url("${url}")`);
        stage.style.backgroundImage = 'none';
        stage.dataset.battleBgUrl = url;
      };
      const loaded = () => {
        if (!active() || decoding) return;
        decoding = true;
        if (!image.naturalWidth) { failed(); return; }
        try {
          if (typeof image.decode === 'function') image.decode().then(commit, failed);
          else commit();
        } catch (_decodeError) { failed(); }
      };
      image.onload = loaded;
      image.onerror = failed;
      image.src = url;
      if (image.complete && image.naturalWidth) loaded();
      return true;
    }
  };
})();


/* Android presentation module: board-phone-battle-render */
/* Retain unchanged source renderers, including their original event handlers.
 * No timer/poll suppression, DOM prototype overrides, save fields or game actions. */
(() => {
  'use strict';
  if (window.TabletopPhoneBattleRender) return;
  const entries = new WeakMap();
  const metrics = { rendered: 0, reused: 0, invalidated: 0 };
  function begin(root, renderer, values) {
    if (!root || document.documentElement?.dataset.platform !== 'android'
      || document.documentElement.dataset.gameUi !== 'board-battle') return true;
    let signature;
    try { signature = renderer + '|' + JSON.stringify(values); } catch (_) { return true; }
    const previous = entries.get(root);
    const children = [...root.childNodes];
    if (previous?.signature === signature && previous.children
      && previous.children.length === children.length
      && children.every((node, i) => node === previous.children[i])) {
      metrics.reused++;
      return false;
    }
    if (previous) metrics.invalidated++;
    metrics.rendered++;
    const entry = { signature, children: null };
    entries.set(root, entry);
    // Capture after the original renderer and phone layout transaction finish.
    // A replacement renderer invalidates this token before it can commit.
    requestAnimationFrame(() => {
      if (root.isConnected && entries.get(root) === entry) entry.children = [...root.childNodes];
    });
    return true;
  }
  window.TabletopPhoneBattleRender = Object.freeze({ begin, snapshot: () => ({ ...metrics }) });
})();


/* Android presentation module: board-events-phone-v006 */
(function () {
  'use strict';
  const allowed=window.__TABLETOP_ANDROID_TEST_ORIGIN||'https://onepiece-card-online.onrender.com';
  if(location.origin!==allowed)return;
  const path=location.pathname.toLowerCase();
  if(!['/board_game.html','/board_york_clue_puzzle_formal_demo.html'].includes(path))return;
  let pending=false;
  const mark=(node,name,value)=>{if(node&&node.dataset[name]!==value)node.dataset[name]=value;};
  const move=(node,parent)=>{if(node&&parent&&node.parentElement!==parent)parent.append(node);};
  function seaChoiceLayout(root){
    const cards=[...root.querySelectorAll('button.sea-event-choice-card[data-sea-choice]')];
    const footer=root.querySelector(':scope > .sea-event-choice-actions');
    if(!cards.length||!footer)return;
    const actions=[...footer.querySelectorAll('button')];
    if(!actions.length||actions.some(button=>!button.matches('[data-sea-choice]')))return;
    const focused=document.activeElement;
    const focusedAction=actions.find(button=>button===focused||button.contains(focused));
    const focusCard=focusedAction?cards.find(card=>card.dataset.seaChoice===focusedAction.dataset.seaChoice):null;
    actions.forEach(button=>{if(!button.hidden)button.hidden=true;if(button.tabIndex!==-1)button.tabIndex=-1;});
    if(!footer.hidden)footer.hidden=true;
    if(!footer.inert)footer.inert=true;
    mark(root,'phoneChoiceTap','cards');
    if(focusCard?.isConnected&&!focusCard.disabled)focusCard.focus({preventScroll:true});
  }
  function seaResultLayout(root,type){
    if(type==='sea-result'){
      let copy=root.querySelector(':scope > .phone-sea-result-copy');
      if(!copy){copy=document.createElement('div');copy.className='phone-sea-result-copy';root.querySelector('.sea-event-result-actions')?.before(copy);if(!copy.parentElement)root.append(copy);}
      move(root.querySelector('.sea-event-result-description'),copy);
      move(root.querySelector('.sea-event-result-summary'),copy);
    }else if(type==='chest'&&root.classList.contains('is-result')){
      let header=root.querySelector(':scope > .phone-sea-chest-result-header');
      if(!header){header=document.createElement('header');header.className='phone-sea-chest-result-header';root.prepend(header);}
      let body=root.querySelector(':scope > .phone-sea-chest-result-body');
      if(!body){body=document.createElement('div');body.className='phone-sea-chest-result-body';header.after(body);}
      move(root.querySelector('.sea-chest-stage-title'),header);
      move(root.querySelector('.sea-chest-result-card'),body);
      const copy=root.querySelector('.sea-chest-stage-head');
      if(copy){if(!copy.classList.contains('phone-sea-chest-result-copy'))copy.classList.add('phone-sea-chest-result-copy');move(copy,body);}
      const footer=root.querySelector('.sea-chest-shuffle-row');
      if(footer&&!footer.classList.contains('phone-sea-chest-result-footer'))footer.classList.add('phone-sea-chest-result-footer');
    }
  }
  function panelButton(label,action){const b=document.createElement('button');b.type='button';b.textContent=label;b.className='phone-event-panel-toggle';b.dataset.phoneSkin='button';b.addEventListener('click',action);return b;}
  function classifyModal(){
    const modal=document.getElementById('boardModal');if(!modal)return;
    const selectors=[['sea-choice','.sea-event-choice-ui'],['chest','.sea-chest-stage-shell'],['sea-reveal','.sea-reveal'],['sea-result','.sea-event-result-ui'],['judicial-chest','[data-judicial-chest-choice]'],['island-event','#confirmEventIslandBtn']];
    const type=selectors.find(([,selector])=>modal.querySelector(selector))?.[0];
    if(!type){if(modal.hasAttribute('data-phone-event'))modal.removeAttribute('data-phone-event');return;}
    mark(modal,'phoneEvent',type);
    const root=modal.querySelector('.sea-event-choice-ui,.sea-chest-stage-shell,.sea-reveal,.sea-event-result-ui');
    if(root&&type==='sea-choice')seaChoiceLayout(root);
    if(root)seaResultLayout(root,type);
    mark(root,'phoneSkin','panel');
    modal.querySelectorAll('.sea-event-ui-action,.sea-chest-shuffle-row,.sea-reveal-actions,.sea-event-choice-actions,.sea-event-result-actions').forEach(n=>mark(n,'phoneSkin',n.matches('button')?'primary-button':'action-bar'));
    if(type==='judicial-chest'||type==='island-event'){
      if(!modal.querySelector(':scope > .phone-event-heading')){
        const heading=document.createElement('header');heading.className='phone-event-heading';heading.dataset.phoneSkin='header';
        [...modal.children].filter(n=>n.matches('.modal-title,.modal-sub')).forEach(n=>heading.append(n));modal.prepend(heading);
        const body=document.createElement('div');body.className='phone-event-content';
        [...modal.children].filter(n=>n!==heading&&!n.matches('.modal-row')).forEach(n=>body.append(n));heading.after(body);
        [...modal.children].filter(n=>n.matches('.modal-row')).forEach(n=>{n.classList.add('phone-event-footer');n.dataset.phoneSkin='action-bar';});
      }
    }
  }
  function puzzle(){
    const stage=document.querySelector('.puzzle-stage');if(!stage)return;
    const panel=document.querySelector('.clue-panel');
    if(!stage.querySelector('.phone-puzzle-clue-drawer')){
      const drawer=document.createElement('aside');drawer.className='phone-puzzle-clue-drawer';drawer.hidden=true;drawer.dataset.phoneSkin='panel';drawer.setAttribute('aria-label','十三張卡牌線索');
      const toggle=panelButton('查看線索',()=>setOpen(drawer.hidden));toggle.classList.add('phone-puzzle-clue-toggle');toggle.setAttribute('aria-expanded','false');
      const close=panelButton('返回排牌',()=>setOpen(false));close.classList.add('phone-puzzle-clue-close');
      function setOpen(open){drawer.hidden=!open;stage.classList.toggle('phone-puzzle-clues-open',open);toggle.setAttribute('aria-expanded',String(open));}
      drawer.append(close);stage.append(toggle,drawer);move(panel,drawer);
    }
    move(document.getElementById('sequenceMessage'),stage);
    stage.querySelector('.action-panel')?.setAttribute('data-phone-skin','action-bar');
    mark(document.querySelector('.result-stage'),'phoneSkin','panel');
    mark(document.getElementById('resultClose'),'phoneSkin','primary-button');
  }
  function sync(){pending=false;const html=document.documentElement;if(html?.dataset.platform!=='android')return;mark(html,'phoneEvents','6');if(path==='/board_game.html')classifyModal();else puzzle();}
  function schedule(){if(window.TabletopBoardPhoneLayout){window.TabletopBoardPhoneLayout.request('events');return;}if(!pending){pending=true;requestAnimationFrame(sync);}}
  function init(){if(window.TabletopBoardPhoneLayout){window.TabletopBoardPhoneLayout.subscribe('events',sync,{gameUis:['board','board-puzzle'],roots:['#boardModal','.puzzle-stage','.result-stage']});return;}schedule();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']});window.addEventListener('resize',schedule);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();


/* Android presentation module: board-pages-phone-v006 */
/* Android-only Board dungeon and shipyard presentation. Rules, source event
   delegation, original inputs and source persistence keys remain unchanged. */
(() => {
  'use strict';
  const kinds = new Set(['board-prison','board-shipyard','board-marineford']);
  const $ = id => document.getElementById(id);
  const mark = (n, key, value) => { if (n && n.dataset[key] !== value) n.dataset[key] = value; };
  const art = (n, type='panel') => mark(n, 'phoneArt', type);
  const node = cls => { const n=document.createElement('div');n.className=cls;return n; };
  const stableImages = new WeakMap();
  const imageOwnerAttributes = ['data-floor','data-recruit','data-slot-index','data-view-slot'];
  function sourceImageKey(image, newSource=null) {
    return [...image.attributes].filter(a=>!a.name.startsWith('data-phone-')&&!(newSource&&(a.name==='class'||a.name==='style')&&a.value===''&&!newSource.hasAttribute(a.name)))
      .map(a=>[a.name,a.name==='class'?a.value.split(/\s+/).filter(c=>c&&!c.startsWith('phone-')).sort().join(' '):a.value])
      .sort(([a],[b])=>a.localeCompare(b)).map(([name,value])=>name+'='+value).join('|');
  }
  function sourceImageOwner(image, root) {
    const owners=[];
    for(let parent=image.parentElement;parent&&parent!==root;parent=parent.parentElement) {
      const attributes=imageOwnerAttributes.filter(name=>parent.hasAttribute(name)).map(name=>[name,parent.getAttribute(name)]);
      if(attributes.length)owners.push(attributes);
    }
    return JSON.stringify(owners);
  }
  function retainStableImages(kind) {
    const selectors=kind==='board-prison'?['floorList','prisonerGrid']:kind==='board-marineford'?['executionSlots','helperLineup','bossLineup']:[];
    const scope=kind==='board-prison'?$('frame'):document.querySelector('.marineford');
    // Leave every source spin, reel and execution transition to its original
    // image lifecycle. Resume with a fresh one-tree cache after it has ended.
    const visible=n=>n&&!n.closest('[hidden]')&&n.getClientRects().length>0;
    const playingSelector=kind==='board-prison'?'.reward-spin:not(.settled),.rail-recruit-spin.spinning':'.execution-playing,.execution-card-split,.conqueror-guard-split';
    const animating=scope&&((kind==='board-prison'&&scope.matches('.escape-dice-active')&&visible(scope))||[...scope.querySelectorAll(playingSelector)].some(visible)||(kind==='board-marineford'&&$('modalBack')?.classList.contains('show')&&$('modal')?.classList.contains('lottery-running-modal')));
    const generatedLayer='.board-character-depth-alpha-layer,.board-character-depth-model-layer';
    for(const id of selectors) {
      const root=$(id);if(!root)continue;
      if(animating){stableImages.delete(root);continue;}
      const previous=new Map(),oldOccurrences=new Map(),oldByOwner=new Map();
      // Depth cleanup changes the detached image's class before decorating the
      // new parent. Read its complete CURRENT source attributes each time.
      for(const entry of stableImages.get(root)||[]) {
        if(entry.image.closest(generatedLayer))continue;
        const signature=entry.owner+'|'+sourceImageKey(entry.image),ordinal=oldOccurrences.get(signature)||0;
        oldOccurrences.set(signature,ordinal+1);previous.set(signature+'|'+ordinal,entry.image);
        if(!oldByOwner.has(entry.owner))oldByOwner.set(entry.owner,[]);
        oldByOwner.get(entry.owner).push(entry.image);
      }
      const next=[],occurrences=new Map();
      for(let image of root.querySelectorAll('img')) {
        if(image.closest(generatedLayer))continue;
        const owner=sourceImageOwner(image,root),signature=owner+'|'+sourceImageKey(image),ordinal=occurrences.get(signature)||0;
        occurrences.set(signature,ordinal+1);
        let decoded=previous.get(signature+'|'+ordinal);
        if(!decoded)for(const candidate of oldByOwner.get(owner)||[]) {
          if(candidate===image||candidate.isConnected||!candidate.complete||candidate.naturalWidth<=0)continue;
          // Source depth cleanup can leave class="" or style="" behind. Only
          // restore that detached old node to this new source's exact shape.
          const empty=['class','style'].filter(name=>candidate.getAttribute(name)===''&&!image.hasAttribute(name));
          if(!empty.length||sourceImageKey(candidate,image)!==sourceImageKey(image))continue;
          for(const name of empty)candidate.removeAttribute(name);
          decoded=candidate;break;
        }
        // Preserve only an already decoded decorative image. New source
        // buttons, their listeners, text and state always remain in place.
        if(decoded&&decoded!==image&&!decoded.isConnected&&decoded.complete&&decoded.naturalWidth>0&&sourceImageKey(decoded)===sourceImageKey(image)){image.replaceWith(decoded);image=decoded;}
        next.push({image,owner});
      }
      stableImages.set(root,next);
    }
  }
  function shipyard() {
    const screen=document.querySelector('.screen'), main=screen?.querySelector('.main');
    const dock=$('dockPanel'), map=$('upgradeMap'), detail=$('workDetail'), slots=$('slotBoard');
    const workshop=screen?.querySelector('.workshop'), work=workshop?.querySelector('.work-body');
    if(!screen||!main||!dock||!map||!detail||!workshop||!work)return;
    // This marker hands ownership of these original nodes to one presentation
    // adapter. The earlier folding adapter must not move them back on refresh.
    mark(screen,'phoneShipLayout','pages');
    let navigation=$('phoneShipNavigation'), view=shipyard.views?.get(screen);
    if(!navigation) {
      navigation=document.createElement('footer');navigation.id='phoneShipNavigation';navigation.className='phone-ship-navigation';
      const tabs=workshop.querySelector('.tabs');if(!tabs)return;
      tabs.setAttribute('aria-label','水之七島頁面');navigation.append(tabs);screen.append(navigation);
      for(const button of tabs.querySelectorAll('[data-tab]')) {
        mark(button,'phoneShipTarget',button.dataset.tab);
        button.setAttribute('aria-controls',button.dataset.tab==='upgrades'?'upgradeMap':'workList');
      }
      for(const [key,label,id]of [['dock','船塢總覽','dockPanel'],['info','材料與效果','phoneShipInfo']]) {
        const button=document.createElement('button');button.type='button';button.textContent=label;
        button.dataset.phoneShipTarget=key;button.setAttribute('aria-controls',id);
        // The source gear tab owns the neutral full-ship camera. Let the
        // original delegate select it; this button only chooses our dock page.
        if(key==='dock')button.dataset.tabJump='gear';
        art(button,'tab');tabs.append(button);
      }
      const back=document.createElement('button');back.id='phoneShipBack';back.type='button';back.textContent='返回列表';
      back.setAttribute('aria-controls','upgradeMap workList');art(back,'button');screen.querySelector('.topbar').append(back);
      const info=document.createElement('section');info.id='phoneShipInfo';info.setAttribute('aria-label','船塢說明、材料與全隊效果');main.append(info);
      for(const selector of ['.foreman','.bonus-strip']) {
        const original=screen.querySelector(selector);if(!original)continue;
        const folded=original.closest('.phone-shipyard-details');info.append(original);if(folded)folded.remove();
      }
      work.prepend(map);
      if(slots)dock.append(slots);
      const toast=$('toast');if(toast)screen.append(toast);
      const offsets=new Map();let pendingRestore=null,restoreFrame=0,inputSequence=0;
      const readingNodes=()=>[map,$('workList'),detail.querySelector('.phone-pages-detail-body'),dock,info].filter(Boolean);
      const readingKey=()=>[screen.dataset.phoneShipPage,screen.dataset.phoneShipDetail,screen.dataset.phoneShipSelection||''].join('|');
      const paneKey=element=>element.id||'detail-body';
      const remember=()=>{
        const saved=new Map();for(const element of readingNodes())if(element.getClientRects().length)saved.set(paneKey(element),[element.scrollLeft,element.scrollTop]);
        offsets.set(readingKey(),saved);
      };
      const applyReadingPosition=token=>{
        if(!token||token!==pendingRestore||token.sequence!==inputSequence||token.key!==readingKey()||!screen.isConnected)return;
        for(const element of readingNodes())if(element.getClientRects().length){const point=token.points?.get(paneKey(element))||[0,0];element.scrollLeft=point[0];element.scrollTop=point[1];}
      };
      const reconcileReadingPosition=()=>{
        if(restoreFrame)cancelAnimationFrame(restoreFrame);
        const token=pendingRestore;if(!token){restoreFrame=0;return;}
        // The original document click delegate queues selectedCard.scrollIntoView
        // in a RAF. Window bubbling runs afterwards, so this single RAF restores
        // the saved reading position later in that SAME frame, before paint.
        restoreFrame=requestAnimationFrame(()=>{restoreFrame=0;applyReadingPosition(token);if(pendingRestore===token)pendingRestore=null;});
      };
      const choose=(page,mode='list',selection='')=>{
        remember();mark(screen,'phoneShipPage',page);mark(screen,'phoneShipDetail',mode);mark(screen,'phoneShipSelection',selection);
        pendingRestore={key:readingKey(),sequence:inputSequence,points:offsets.get(readingKey())};
      };
      view={sync(active){
        const previous=screen.dataset.phoneShipSourceTab;
        if(!screen.dataset.phoneShipPage) {mark(screen,'phoneShipPage',active);mark(screen,'phoneShipDetail','list');}
        // A source tab change can also arrive from an original callback. Never
        // let the gear camera underneath an overview replace its visible page.
        else if(previous&&previous!==active&&['upgrades','gear','slots'].includes(screen.dataset.phoneShipPage)&&screen.dataset.phoneShipPage!==active)choose(active);
        mark(screen,'phoneShipSourceTab',active);
        for(const button of navigation.querySelectorAll('[data-phone-ship-target]')) {
          const current=button.dataset.phoneShipTarget===screen.dataset.phoneShipPage;
          if(current&&button.getAttribute('aria-current')!=='page')button.setAttribute('aria-current','page');
          else if(!current&&button.hasAttribute('aria-current'))button.removeAttribute('aria-current');
        }
        if(pendingRestore) {
          // Normalize rebuilt panes immediately in the source microtask, then
          // reconcile the original source RAF without letting a zero frame paint.
          applyReadingPosition(pendingRestore);
          if(!restoreFrame)reconcileReadingPosition();
        }
      }};
      if(!shipyard.views)shipyard.views=new WeakMap();shipyard.views.set(screen,view);
      screen.addEventListener('click',event=>{
        const target=event.target.closest('button,[data-select-upgrade],[data-select-gear]');if(!target||!screen.contains(target))return;
        if(target.matches(':disabled'))return;
        // Capture chooses the screen before the original document delegate
        // renders. No source action is cloned, stopped or called a second time.
        if(target.dataset.phoneShipTarget)choose(target.dataset.phoneShipTarget);
        else if(target.id==='phoneShipBack')choose(screen.dataset.phoneShipPage);
        else if(target.dataset.selectUpgrade)choose('upgrades','detail',target.dataset.selectUpgrade);
        else if(target.dataset.selectGear)choose('gear','detail',target.dataset.selectGear);
        else if(target.dataset.tabJump)choose(target.dataset.tabJump);
        else if(target.hasAttribute('data-open-slot'))choose('slots');
        else return;
      },true);
      window.addEventListener('click',event=>{if(screen.contains(event.target)){schedule();reconcileReadingPosition();}});
      // Formal snapshots rebuild the original list too. Capture its reading
      // position before that source handler, then restore after its scroll RAF.
      // Never replace the source snapshot, selection, or command callbacks.
      const isReadingUpdate=event=>event.type==='storage'
        ? event.key==='onepiece-board-water-seven-snapshot-v1'
        : event.origin===location.origin&&event.source===window.parent&&event.data?.type==='board-water-seven-update';
      const beforeReadingUpdate=event=>{
        if(!isReadingUpdate(event)||!screen.isConnected)return;
        remember();pendingRestore={key:readingKey(),sequence:inputSequence,points:offsets.get(readingKey())};
      };
      const afterReadingUpdate=event=>{if(isReadingUpdate(event)){schedule();reconcileReadingPosition();}};
      for(const type of ['message','storage']) {
        window.addEventListener(type,beforeReadingUpdate,true);
        window.addEventListener(type,afterReadingUpdate);
      }
      const cancelReadingRestore=()=>{inputSequence++;pendingRestore=null;if(restoreFrame)cancelAnimationFrame(restoreFrame);restoreFrame=0;};
      for(const type of ['pointerdown','touchstart','wheel','keydown'])document.addEventListener(type,cancelReadingRestore,{capture:true,passive:true});
      window.addEventListener('pagehide',cancelReadingRestore);
    }
    if (detail && !detail.querySelector(':scope > .phone-pages-detail-body')) {
      const button=detail.querySelector(':scope > .primary-btn');
      const content=node('phone-pages-detail-body');for(const n of [...detail.childNodes])if(n!==button)content.append(n);
      detail.append(content);
      if(button){const footer=node('phone-pages-detail-action');footer.append(button);detail.append(footer);art(footer,'action-bar');}
    }
    const active=navigation.querySelector('.tab.active')?.dataset.tab||'upgrades';
    mark(dock,'phoneWorkTab',active);mark(workshop,'phoneWorkTab',active);view?.sync(active);
    document.querySelectorAll('.topbar,.wallet,.dock-head,.workshop,#phoneShipInfo,.phone-pages-detail-body').forEach(n=>art(n));
    document.querySelectorAll('.ship-switch button,.tabs button').forEach(n=>art(n,'tab'));
    document.querySelectorAll('.gear-card,.slot-progress-card,.ship-callout').forEach(n=>art(n,'card'));
    document.querySelectorAll('.upgrade-effect-row,.upgrade-cost-summary').forEach(n=>art(n,'row'));
  }
  function marinefordNavigation(scene) {
    if(!scene||!$('executionZone')||!$('helperLineup')||!$('bossLineup'))return;
    let navigation=$('phoneMarineNavigation');
    if(!navigation) {
      navigation=document.createElement('footer');navigation.id='phoneMarineNavigation';navigation.className='phone-marine-navigation';
      const tabs=document.createElement('nav');tabs.className='phone-marine-tabs';tabs.setAttribute('aria-label','頂上戰爭頁面');
      const pages=[['execution','處刑台','executionZone'],['crew','己方隊伍','helperLineup'],['enemy','敵方資訊','bossLineup']];
      for(const [key,label,id]of pages){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.phoneMarineTarget=key;b.setAttribute('aria-controls',id);art(b,'tab');tabs.append(b);}
      navigation.append(tabs);scene.append(navigation);
      // These are page-local reading offsets, never game or save state. The
      // persistent source roots and original visible controls stay singular.
      const reading=new Map();
      const activate=key=>{
        const next=pages.find(p=>p[0]===key);if(!next)return;
        const previous=pages.find(p=>p[0]===scene.dataset.phoneMarinePage);
        if(previous)reading.set(previous[0],$(previous[2]).scrollTop);
        mark(scene,'phoneMarinePage',key);
        for(const [name,,id]of pages){const button=tabs.querySelector('[data-phone-marine-target="'+name+'"]');if(name===key)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');$(id).setAttribute('aria-hidden',String(name!==key));}
        $(next[2]).scrollTop=reading.get(key)||0;
      };
      tabs.addEventListener('click',event=>{const button=event.target.closest('[data-phone-marine-target]');if(button&&tabs.contains(button))activate(button.dataset.phoneMarineTarget);});
      activate('execution');
    }
  }
  function marineford() {
    const modal=$('modal');
    art(modal);
    // The source scene isolates stacking. Keep the ORIGINAL audio control in
    // that scene so its z45 can sit below the modal z60, instead of painting
    // above the scene's entire stacking context and covering the close button.
    const scene=document.querySelector('.marineford'), audio=document.querySelector('.board-audio--floating');
    if(scene&&audio&&audio.parentElement!==scene)scene.append(audio);
    marinefordNavigation(scene);
    if(modal?.children.length&&!modal.querySelector(':scope > .phone-pages-modal-body')) {
      const head=modal.querySelector(':scope > .modal-head');
      const footer=[...modal.children].filter(n=>n.matches('.tool-row')).at(-1);
      const content=node('phone-pages-modal-body');
      for(const n of [...modal.childNodes]) if(n!==head&&n!==footer&&!n.matches?.('[data-close-modal]'))content.append(n);
      if(head){for(const close of [...modal.querySelectorAll(':scope > [data-close-modal]')])head.append(close);}
      modal.append(content);
      if(footer){const dock=node('phone-pages-modal-actions');dock.append(footer);modal.append(dock);art(dock,'action-bar');}
      mark(modal,'phoneZones','ready');
    }
    document.querySelectorAll('.top-hud,.modal-head,.intel,.hormone-panel,.phone-pages-modal-body').forEach(n=>art(n));
    document.querySelectorAll('.select-card,.result-card,.leader-card,.helper-card').forEach(n=>art(n,'card'));
    document.querySelectorAll('.lottery-reel').forEach(n=>art(n,'card'));
    modal?.querySelectorAll('.result-grid,.lottery-stage').forEach(n=>mark(n,'phoneColumns',String(Math.min(2,n.children.length)||1)));
  }
  function prison() {
    document.querySelectorAll('.title-plate,.resource-row,.tower,.event-panel,.team-modal,.recruit-modal').forEach(n=>art(n));
    document.querySelectorAll('.command-dock,.team-modal-actions,.recruit-modal-actions').forEach(n=>art(n,'action-bar'));
    document.querySelectorAll('.floor-row,.prisoner-card,.recruit-chip').forEach(n=>art(n,'card'));
  }
  let queued=false;
  function refresh() {
    queued=false;const html=document.documentElement, kind=html.dataset.gameUi;
    if(html.dataset.platform!=='android'||!kinds.has(kind))return;
    mark(html,'phonePagesV006',kind);
    retainStableImages(kind);
    if(kind==='board-shipyard')shipyard();if(kind==='board-marineford')marineford();if(kind==='board-prison')prison();
    const scope=kind==='board-shipyard'?document.querySelector('.screen'):kind==='board-marineford'?document.querySelector('.marineford'):$('frame');
    scope?.querySelectorAll('button,summary,select').forEach(n=>art(n,n.matches('select')?'field':n.matches('.primary,.primary-btn')?'primary-button':n.dataset.phoneArt==='tab'?'tab':'button'));
  }
  const schedule=()=>{if(window.TabletopBoardPhoneLayout){window.TabletopBoardPhoneLayout.request('pages');return;}if(!queued){queued=true;requestAnimationFrame(refresh);}};
  const start=()=>{if(window.TabletopBoardPhoneLayout){window.TabletopBoardPhoneLayout.subscribe('pages',refresh,{gameUis:[...kinds],roots:['#frame','.screen','.marineford']});return;}refresh();const o=new MutationObserver(schedule);o.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']});o.observe(document.documentElement,{attributes:true,attributeFilter:['data-game-ui','data-platform']});window.addEventListener('resize',schedule);};
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})();


/* Android presentation module: board-phone-judicial-reward */
/* Phone-only Judicial reveal. The source Board settles RNG/coins/EXP/bonus
 * before this module runs. No game state, reward id, storage or command writes. */
(() => {
  'use strict';
  const enabled = () => document.documentElement?.dataset.platform === 'android';
  const labels = { heal:'急救', pp:'彈藥', attack:'總攻', defense:'鐵壁', speed:'突擊', shield:'屏障', revive:'救援', burst:'霸氣' };
  const iconKeys = new Set([...Object.keys(labels), 'unknown']);
  const fallback = Object.keys(labels).map(id => ({ id, label:labels[id], iconKey:id }));
  let waiting = null, presentation = null;
  const owned = fn => window.TabletopBoardPhoneLayout?.withOwnedDOM ? window.TabletopBoardPhoneLayout.withOwnedDOM(fn) : fn();
  const icon = entry => {
    const img = document.createElement('img'), key = iconKeys.has(entry?.iconKey || entry?.id) ? entry.iconKey || entry.id : 'unknown';
    img.src = `images/board/judicial_raid_ui/reward_icons/${key}.webp`;
    img.alt = entry?.label || labels[key] || '突破補給'; img.draggable = false;
    return img;
  };
  const sameSource = (session, source) => {
    try { return !!source && session.options.sourceWindow() === source && source.location.origin === location.origin; }
    catch (_) { return false; }
  };
  function live(session) {
    try { return session.options.isCurrent() && session.options.canControl(); } catch (_) { return false; }
  }
  function releaseWait(result) {
    const active = waiting;
    if (!active) return;
    waiting = null; clearInterval(active.watchdog); clearTimeout(active.attachTimeout);
    try { active.options.sourceWindow()?.TabletopJudicialReward?.dismiss(active.eventId); } catch (_) {}
    active.resolve(result);
  }
  function wait(event, options) {
    if (!enabled() || event?.type !== 'raid-phase-reward' || !event.id || !options.canControl()) return null;
    releaseWait(true);
    return new Promise(resolve => {
      const active = waiting = { eventId:String(event.id), options, resolve, attached:false };
      // A missing/failed phone child must still fall back to the PC wait.
      active.attachTimeout = setTimeout(() => { if (waiting === active && !active.attached) releaseWait(false); }, 5000);
      // This exists only while an interactive reveal owns a pending source wait.
      // It never refreshes DOM or game data; it releases stale/closed viewers.
      active.watchdog = setInterval(() => {
        let source;
        try { source = options.sourceWindow(); } catch (_) {}
        if (!live(active) || !source || source.closed || document.hidden) releaseWait(true);
        else if (active.attached) {
          try {
            if (!source.TabletopJudicialReward?.isPresent(active.eventId)) releaseWait(true);
          } catch (_) { releaseWait(true); }
        }
      }, 750);
    });
  }
  function connect(eventId, source) {
    const active = waiting;
    if (!active || active.eventId !== eventId || !sameSource(active, source) || !live(active)) return false;
    active.attached = true; clearTimeout(active.attachTimeout); return true;
  }
  function complete(eventId, source) {
    const active = waiting;
    if (!active || active.eventId !== eventId || !active.attached || !sameSource(active, source) || !live(active)) return false;
    releaseWait(true); return true;
  }
  function host() {
    try {
      if (window.parent !== window && window.parent.TabletopJudicialReward) return window.parent.TabletopJudicialReward;
      if (window.opener && !window.opener.closed && window.opener.TabletopJudicialReward) return window.opener.TabletopJudicialReward;
    } catch (_) {}
    return null;
  }
  function closePresentation() {
    const active = presentation;
    if (!active) return;
    presentation = null;
    cancelAnimationFrame(active.frame); active.timers.forEach(clearTimeout);
    owned(() => {
      active.root.classList.remove('show', 'settled');
      active.root.removeAttribute('data-phone-reward');
      active.root.removeAttribute('data-phone-reward-phase');
      active.root.removeAttribute('aria-modal');
      active.root.removeAttribute('role'); active.root.removeAttribute('aria-label');
    });
  }
  function present(event, options) {
    if (!enabled() || event?.type !== 'raid-phase-reward' || !event.id) return false;
    const root = document.getElementById('raidPhaseFx'), authority = host();
    // The same-origin Board wait is required for indefinite manual interaction.
    if (!root || !authority) return false;
    if (presentation?.eventId === String(event.id)) return true;
    closePresentation();
    const bonus = event.bonus || event.reward?.bonus || {};
    const segments = (bonus.segments || event.segments || fallback).filter(entry => entry && typeof entry.id === 'string');
    if (!segments.length) return false;
    let target = segments.findIndex(entry => entry.id === bonus.id);
    if (target < 0) target = Math.max(0, Math.min(segments.length - 1, Number(bonus.index) || 0));
    const chosen = bonus.id ? bonus : segments[target];
    const wheel = document.getElementById('raidRewardWheel'), shell = wheel?.closest('.raid-wheel-shell');
    if (!wheel || !shell) return false;
    const label = document.getElementById('raidRewardLabel'), description = document.getElementById('raidRewardDescription');
    const rewardIcon = document.getElementById('raidRewardIcon'), scene = document.getElementById('raidRewardScene');
    const text = root.querySelector('.raid-reward-text');
    const active = presentation = { root, wheel, eventId:String(event.id), options, authority, phase:'idle', frame:0, timers:[], position:0,
      velocity:0, direction:-1, pointer:null, attached:false, spectator:!options.canControl(), target, segments, chosen, row:72, finished:false };
    let panel = root.querySelector('.phone-raid-reel-panel'), hint = root.querySelector('.phone-raid-swipe-hint');
    let controls = root.querySelector('.phone-raid-controls'), skip, primary;
    owned(() => {
      root.dataset.phoneReward = 'manual'; root.dataset.phoneRewardPhase = 'idle'; root.classList.add('show'); root.classList.remove('settled');
      root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', '司法島突破補給');
      document.getElementById('raidClearText').textContent = event.finalVictory ? '司法島全數突破' : '突破成功';
      document.getElementById('raidDefeatedName').textContent = `${event.defeatedName || '敵人'} 擊破`;
      document.getElementById('raidNextEnemyName').textContent = event.finalVictory ? '通關獎勵結算後回到海圖' : event.nextEnemyName ? `下一戰：${event.nextEnemyName}` : '準備下一戰';
      if (!panel) { panel = document.createElement('div'); panel.className = 'phone-raid-reel-panel'; shell.before(panel); panel.append(shell); }
      if (!hint) { hint = document.createElement('div'); hint.className = 'phone-raid-swipe-hint'; panel.append(hint); }
      let copy = root.querySelector('.phone-raid-copy');
      if (!copy) { copy = document.createElement('div'); copy.className = 'phone-raid-copy'; text.append(copy); copy.append(description, scene); }
      text.prepend(rewardIcon);
      if (!controls) {
        controls = document.createElement('div'); controls.className = 'phone-raid-controls';
        controls.innerHTML = '<button type="button" data-phone-reward-skip>略過動畫</button><button type="button" data-phone-reward-primary>轉動補給</button>';
        root.append(controls);
      }
      skip = controls.querySelector('[data-phone-reward-skip]'); primary = controls.querySelector('[data-phone-reward-primary]');
      skip.disabled = false; primary.disabled = false; primary.textContent = '轉動補給';
      primary.setAttribute('data-phone-art-button', 'primary'); skip.setAttribute('data-phone-art-button', 'secondary');
      hint.innerHTML = '<span aria-hidden="true">↕</span> 上下滑動轉輪';
      label.textContent = '滑動揭曉補給'; description.textContent = '拖動轉輪，放開後會依滑動方向慢慢停下。';
      rewardIcon.replaceChildren(icon({id:'unknown',label:'尚未揭曉'})); scene.replaceChildren();
      const fragment = document.createDocumentFragment();
      for (let cycle = 0; cycle < 3; cycle++) for (const entry of segments) {
        const row = document.createElement('div'); row.className = 'raid-slot-item'; row.dataset.rewardId = entry.id;
        const image = document.createElement('span'); image.className = 'raid-slot-icon'; image.append(icon(entry));
        const name = document.createElement('span'); name.className = 'raid-slot-label'; name.textContent = labels[entry.id] || entry.label || '補給';
        row.append(image, name); fragment.append(row);
      }
      wheel.replaceChildren(fragment); shell.tabIndex = 0; shell.setAttribute('role', 'button'); shell.setAttribute('aria-label', '上下滑動轉動補給輪盤，或按轉動補給');
      shell.setAttribute('aria-disabled', String(active.spectator));
    });
    const mod = (a, b) => ((a % b) + b) % b;
    function update() {
      if (presentation !== active) return;
      const period = active.row * segments.length;
      wheel.style.transform = `translateY(${(shell.clientHeight - active.row) / 2 - period + mod(active.position, period)}px)`;
    }
    function phase(value) { active.phase = value; root.dataset.phoneRewardPhase = value; }
    function reveal() {
      if (presentation !== active) return;
      cancelAnimationFrame(active.frame); active.frame = 0; active.pointer = null;
      active.position = -target * active.row; update(); phase('result');
      owned(() => {
        root.classList.add('settled'); label.textContent = chosen.label || '補給完成';
        description.textContent = chosen.appliedText ? `${chosen.description || '獲得突破補給。'}（${chosen.appliedText}）` : chosen.description || '獲得突破補給。';
        rewardIcon.replaceChildren(icon(chosen));
        const art = window.BoardAdventureArt?.resolve(chosen.visual);
        if (art) scene.innerHTML = window.BoardAdventureArt.artMarkup(chosen.visual);
        for (const row of wheel.children) row.classList.toggle('is-winning', row.dataset.rewardId === segments[target].id);
        hint.textContent = '突破補給已揭曉'; primary.textContent = '繼續'; primary.disabled = active.spectator; skip.disabled = true;
      });
    }
    function coast(velocity) {
      if (presentation !== active) return;
      cancelAnimationFrame(active.frame);
      const releaseVelocity = Math.max(-3.8, Math.min(3.8, velocity));
      if (Math.abs(releaseVelocity) > .04) active.direction = Math.sign(releaseVelocity);
      const period = active.row * segments.length, start = active.position;
      const remainder = mod(-target * active.row - start, period);
      let distance = active.direction > 0 ? remainder : mod(-remainder, period);
      const speed = Math.max(.35, Math.abs(releaseVelocity));
      distance += Math.max(0, Math.ceil((speed * 500 - distance) / period)) * period;
      const duration = Math.max(600, 2 * distance / speed);
      const slope = Math.min(2, Math.abs(releaseVelocity) * duration / Math.max(1, distance));
      const started = performance.now();
      phase('coasting'); primary.disabled = true; primary.textContent = '轉動中'; hint.textContent = '正在減速…';
      // One continuous curve lands on the already-settled source reward.
      // A quick release (slope=2) decelerates linearly from the exact release
      // speed to zero; there is no second landing phase that speeds up again.
      function frame(now) {
        if (presentation !== active || active.phase !== 'coasting') return;
        const p = Math.min(1, (now - started) / duration);
        const progress = (-2 * p ** 3 + 3 * p ** 2) + (p ** 3 - 2 * p ** 2 + p) * slope;
        active.position = start + active.direction * distance * progress;
        active.velocity = active.direction * distance / duration * ((-6 * p * p + 6 * p) + (3 * p * p - 4 * p + 1) * slope);
        update();
        if (p === 1) reveal(); else active.frame = requestAnimationFrame(frame);
      }
      active.velocity = releaseVelocity;
      active.frame = requestAnimationFrame(frame);
    }
    function usable() { return presentation === active && active.attached && !active.finished && !active.spectator && options.canControl(); }
    shell.onpointerdown = e => {
      if (!usable() || active.phase === 'result' || active.pointer !== null || e.button > 0) return;
      e.preventDefault(); e.stopPropagation(); cancelAnimationFrame(active.frame);
      active.pointer = e.pointerId; active.lastY = e.clientY; active.startY = e.clientY; active.lastTime = performance.now(); active.velocity = 0; active.moved = false;
      phase('dragging'); shell.setPointerCapture(e.pointerId); hint.textContent = '放開後慢慢停下';
    };
    shell.onpointermove = e => {
      if (active.pointer !== e.pointerId || active.phase !== 'dragging') return;
      if (!usable()) { active.pointer = null; return; }
      e.preventDefault(); e.stopPropagation();
      const now = performance.now(), dy = e.clientY - active.lastY, dt = Math.max(1, now - active.lastTime);
      active.position += dy; active.lastY = e.clientY; active.lastTime = now;
      if (Math.abs(e.clientY - active.startY) >= 6) active.moved = true;
      if (Math.abs(dy) > .1) { active.direction = Math.sign(dy); active.velocity = active.velocity * .3 + dy / dt * .7; }
      update();
    };
    function release(e) {
      if (active.pointer !== e.pointerId) return;
      e.preventDefault(); e.stopPropagation(); active.pointer = null;
      if (shell.hasPointerCapture(e.pointerId)) shell.releasePointerCapture(e.pointerId);
      if (!active.moved) { phase('idle'); primary.disabled = false; primary.textContent = '轉動補給'; hint.innerHTML = '<span aria-hidden="true">↕</span> 上下滑動轉輪'; return; }
      const idle = performance.now() - active.lastTime;
      coast(e.type === 'pointercancel' || idle > 100 ? 0 : active.velocity);
    }
    shell.onpointerup = release; shell.onpointercancel = release;
    shell.onlostpointercapture = e => { if (active.pointer === e.pointerId) { active.pointer = null; coast(0); } };
    shell.onkeydown = e => { if (!usable() || active.phase === 'result') return; if (['ArrowDown','ArrowUp',' ','Enter'].includes(e.key)) { e.preventDefault(); coast(e.key === 'ArrowDown' ? 2 : -2); } };
    skip.onclick = () => { if (usable()) reveal(); };
    primary.onclick = () => {
      if (!usable()) return;
      if (active.phase !== 'result') { coast(-2.1); return; }
      if (authority.complete(active.eventId, window)) { active.finished = true; closePresentation(); }
    };
    update();
    if (active.spectator) {
      hint.textContent = '觀看補給揭曉'; primary.disabled = skip.disabled = true;
      coast(-2.1); active.timers.push(setTimeout(closePresentation, Math.max(11000, Number(event.duration) || 11000)));
    } else {
      primary.disabled = skip.disabled = true;
      const attach = () => {
        if (presentation !== active || active.attached) return;
        if (authority.connect(active.eventId, window)) { active.attached = true; primary.disabled = skip.disabled = false; }
      };
      attach(); for (const delay of [0,100,500,1500,3500]) active.timers.push(setTimeout(attach, delay));
      active.timers.push(setTimeout(() => {
        if (presentation !== active || active.attached) return;
        active.spectator = true; hint.textContent = '觀看補給揭曉'; coast(-2.1);
        active.timers.push(setTimeout(closePresentation, 6000));
      }, 4500));
    }
    return true;
  }
  function abort() {
    const root = document.getElementById('raidPhaseFx');
    closePresentation(); releaseWait(false);
    if (!root) return;
    owned(() => {
      const panel = root.querySelector('.phone-raid-reel-panel'), shell = root.querySelector('.raid-wheel-shell');
      if (panel && shell) { panel.before(shell); panel.remove(); }
      const copy = root.querySelector('.phone-raid-copy');
      if (copy) { copy.before(...copy.childNodes); copy.remove(); }
      if (shell) {
        const center = document.getElementById('raidRewardIcon'); if (center) shell.append(center);
        shell.removeAttribute('tabindex'); shell.removeAttribute('role'); shell.removeAttribute('aria-label'); shell.removeAttribute('aria-disabled');
        for (const name of ['onpointerdown','onpointermove','onpointerup','onpointercancel','onlostpointercapture','onkeydown']) shell[name] = null;
      }
      root.querySelector('.phone-raid-controls')?.remove();
    });
  }
  function abandon() {
    const active = presentation;
    if (active?.attached) active.authority.complete(active.eventId, window);
    closePresentation(); releaseWait(true);
  }
  window.addEventListener('pagehide', abandon);
  document.addEventListener('visibilitychange', () => { if (document.hidden) abandon(); });
  window.addEventListener('resize', () => {
    const active = presentation;
    if (!active) return;
    const shell = active.wheel.closest('.raid-wheel-shell'), period = active.row * active.segments.length;
    active.wheel.style.transform = `translateY(${(shell.clientHeight - active.row) / 2 - period + ((active.position % period) + period) % period}px)`;
  });
  window.TabletopJudicialReward = Object.freeze({ wait, connect, complete, present, abort,
    dismiss:eventId => { if (presentation?.eventId === eventId) closePresentation(); },
    isPresent:eventId => presentation?.eventId === eventId,
    snapshot:() => ({ waiting:waiting ? {eventId:waiting.eventId,attached:waiting.attached} : null,
      presentation:presentation ? {eventId:presentation.eventId,phase:presentation.phase,position:presentation.position,velocity:presentation.velocity,
        direction:presentation.direction,attached:presentation.attached,spectator:presentation.spectator,target:presentation.chosen.id} : null }) });
})();


/* Android presentation module: phone-art-ui */
/* Board Android artwork only: presentation attributes, never game actions. */
(() => {
  'use strict';
  const icons = {wheel:0,crew:1,inventory:2,map:3,battle:4,skill:5,cards:6,chess:7,home:8,chat:9,shop:10,settings:11,save:12,left:13,right:14,down:15,close:16,more:17,search:18,back:19};
  const quiet = '.phone-story-menu-toggle,[data-phone-direct-skip="true"],#finalEndingNextBtn';
  let observer, scheduled = false;
  const processed = new WeakSet();
  let lastOrigin;
  const setStyle=(node,key,value)=>{if(node.style.getPropertyValue(key)!==value)node.style.setProperty(key,value);};
  function mount(context = {}) {
    const root = document.documentElement;
    if (!root || root.dataset.platform !== 'android' || !root.dataset.gameUi?.startsWith('board')) return;
    if(root.dataset.phoneArtUi!=='6')root.dataset.phoneArtUi = '6';
    const origin = window.__TABLETOP_ANDROID_TEST_ORIGIN || 'poapp://app';
    const files = {normal:'button-normal-v006.png',primary:'button-primary-v006.png',panel:'panel-v006.png',icons:'icons-v006.png','crew-row':'crew-row-transparent-v008.png','map-hud':'map-hud-compact-v009.png','command-helm':'command-helm-v010.png','sea-choice':'sea-choice-frame-v015.png','sea-choice-screen':'sea-choice-screen-v016.png','service-panel':'service-panel-v018.png','fit-panel':'mobile-panel-v013.png','fit-row':'mobile-row-v013.svg'};
    if(lastOrigin!==origin){for (const [key,file] of Object.entries(files)) setStyle(root,`--phone-art-${key}`,`url("${origin}/mobile/art-ui/${file}")`);lastOrigin=origin;}
    const scope = new Set();
    if(context.records?.length && context.reasons?.every(reason=>reason==='source')){
      for(const record of context.records){if(record.type==='childList')for(const node of record.addedNodes)if(node instanceof Element&&node.isConnected)scope.add(node);if(record.type==='attributes'&&record.target instanceof Element)scope.add(record.target);}
    }else scope.add(document);
    const select=selector=>{const nodes=new Set();for(const node of scope){if(node.matches?.(selector))nodes.add(node);for(const child of node.querySelectorAll(selector))nodes.add(child);}return [...nodes];};
    select('button,summary,[role="button"],input[type="button"],input[type="submit"]').forEach(node => {
      if(processed.has(node))return;processed.add(node);
      if (node.matches(quiet)) return;
      if(root.dataset.gameUi==='board'&&node.closest('#boardGameMap')&&node.matches('.sea-tile,.island-node,.ship-token,.route-arrow,.map-marker-pin')){
        delete node.dataset.phoneSkin; delete node.dataset.phoneArt;
        return;
      }
      if(node.id==='boardToolsToggle'&&!node.dataset.phoneIcon)node.dataset.phoneIcon='wheel';
      const current = node.dataset.phoneSkin || node.dataset.phoneArt;
      if (!current) {
        const picture = node.querySelector('img,canvas') || getComputedStyle(node).backgroundImage.includes('url(');
        const primary = node.matches('.primary,.primary-btn,.btn-primary,[data-primary="true"]') || /^(rollDiceBtn|draftStartBtn|draftConfirmPickBtn|startGameBtn|readyBtn)$/.test(node.id);
        node.dataset.phoneSkin = picture ? 'art-card' : primary ? 'primary-button' : 'button';
      }
    });
    select('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]),select,textarea').forEach(node => {
      if (!node.dataset.phoneSkin && !node.dataset.phoneArt) node.dataset.phoneSkin='field';
    });
    select('[data-phone-skin],[data-phone-art]').forEach(node => {
      if (!node.dataset.phoneSkin && node.dataset.phoneArt) node.dataset.phoneSkin = node.dataset.phoneArt;
      const icon = node.dataset.phoneIcon || node.dataset.phoneArtIcon;
      if (Object.hasOwn(icons,icon)) {
        const index = icons[icon];
        setStyle(node,'--phone-icon-x',`${(index % 4) * 100 / 3}%`);
        setStyle(node,'--phone-icon-y',`${Math.floor(index / 4) * 25}%`);
      }
    });
  }
  function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(() => { scheduled = false; mount(); }); } }
  function start() {
    mount();
    if (!document.documentElement?.dataset.gameUi?.startsWith('board')) return;
    if (window.TabletopBoardPhoneLayout) {
      window.TabletopBoardPhoneLayout.subscribe('artwork', mount, { gameUis: ['board','board-battle','board-start','board-lobby','board-prison','board-shipyard','board-marineford','board-spar','board-puzzle'], roots: ['#boardModalBack','#boardToolsPanel','#boardGameHud','#boardMapHud','.ship-action-menu','#battleStage','html[data-game-ui="board-start"] .page','html[data-game-ui="board-spar"] .page','html[data-game-ui="board-puzzle"] .page','#frame','.screen','.marineford','#detailBackdrop','#selectionScreen','.puzzle-stage','.result-stage'] }); return;
    }
    observer = new MutationObserver(schedule);
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();


/* Android presentation module: board-phone-prompts */
/* Encounter presentation only. Original nodes, IDs, disabled flags and
 * listeners stay in the original encounter-ui / boardModal ancestor. */
(() => {
  'use strict';
  const page = location.pathname.split('/').pop();
  if (page !== 'board_game.html' && document.documentElement?.dataset.gameUi !== 'board') return;
  let pending = false;
  function group(panel, className, selectors) {
    if (panel.querySelector(':scope > .' + className)) return;
    const nodes = [...panel.children].filter(node => node.matches(selectors));
    if (!nodes.length) return;
    const wrapper = document.createElement('div');
    wrapper.className = className;
    nodes[0].before(wrapper);
    for (const node of nodes) wrapper.append(node);
  }
  function layout() {
    pending = false;
    const html = document.documentElement;
    if (!html || html.dataset.platform !== 'android' || html.dataset.gameUi !== 'board') return;
    for (const panel of document.querySelectorAll('#boardModal .encounter-ui')) {
      group(panel, 'phone-encounter-portrait', '.encounter-portrait-stage,.encounter-portrait-caption');
      group(panel, 'phone-encounter-reading', '.encounter-context,.encounter-stat-grid,.encounter-message,.encounter-detail');
    }
  }
  function schedule() {
    if (window.TabletopBoardPhoneLayout) { window.TabletopBoardPhoneLayout.request('encounter'); return; }
    if (pending) return;
    pending = true;
    requestAnimationFrame(layout);
  }
  if (window.TabletopBoardPhoneLayout) window.TabletopBoardPhoneLayout.subscribe('encounter', layout, { gameUis: ['board'], roots: ['#boardModal'] });
  else new MutationObserver(schedule).observe(document, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  schedule();
})();


/* Android presentation module: board-phone-lineage */
(function () {
  'use strict';
  if (!/(?:^|\/)board_battle\.html$/i.test(location.pathname)
    && document.documentElement?.dataset.gameUi !== 'board-battle') return;
  const signatures = new WeakMap();
  const copies = new WeakSet();
  function eligible(root) {
    const html = document.documentElement;
    return html?.dataset.platform === 'android' && html.dataset.gameUi === 'board-battle'
      && root?.classList.contains('is-open');
  }
  function bind(root, copy) {
    if (!copy || copies.has(copy)) return;
    copies.add(copy);
    const update = () => {
      if (!eligible(root)) return;
      const signature = copy.textContent || '';
      if (signatures.has(copy) && signatures.get(copy) === signature) return;
      signatures.set(copy, signature);
      copy.scrollTop = 0;
    };
    update();
    new MutationObserver(update).observe(copy, { childList: true, subtree: true, characterData: true });
  }
  function attach() {
    const root = document.getElementById('lineageExtractionRoot');
    if (!root) return false;
    bind(root, root.querySelector('[data-lineage-info-copy]'));
    bind(root, root.querySelector('[data-lineage-action-copy]'));
    return true;
  }
  if (window.TabletopBoardPhoneLayout) window.TabletopBoardPhoneLayout.subscribe('lineage', attach, { gameUis: ['board-battle'], roots: ['#lineageExtractionRoot'] });
  else if (!attach()) {
    const mounted = new MutationObserver(() => {
      if (attach()) mounted.disconnect();
    });
    mounted.observe(document, { childList: true, subtree: true });
  }
})();


/* Android presentation module: board-phone-reveals */
/* Presentation-only reading position. The source rebuilds this original text
   node for every new reveal, including repeated copies of the same item. */
(() => {
  'use strict';
  const page = location.pathname.split('/').pop();
  if (page !== 'board_game.html' && document.documentElement?.dataset.gameUi !== 'board') return;
  let lastNameNode;
  let queued = false;
  function refresh() {
    queued = false;
    const html = document.documentElement;
    if (!html || html.dataset.platform !== 'android' || html.dataset.gameUi !== 'board') return;
    const name = document.getElementById('itemRevealName');
    const reader = document.querySelector('#itemRevealHud .item-reveal-dialogue');
    if (!name?.firstChild || !reader || name.firstChild === lastNameNode) return;
    lastNameNode = name.firstChild;
    reader.scrollTop = 0;
  }
  if (window.TabletopBoardPhoneLayout) window.TabletopBoardPhoneLayout.subscribe('reveal', refresh, { gameUis: ['board'], roots: ['#itemRevealHud'] });
  else new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(refresh);
  }).observe(document, { childList: true, subtree: true });
})();


/* Android presentation module: board-phone-scene-visibility */
/* Suspend only the fully covered map's rendering. Keep its DOM, camera and state. */
(() => {
  'use strict';
  let viewport, previous='', suspended=false;
  function sync(){
    const html=document.documentElement;
    if(html?.dataset.platform!=='android'||html.dataset.gameUi!=='board')return;
    const map=document.getElementById('boardViewport');if(!map)return;
    if(viewport!==map){viewport=map;previous=map.style.contentVisibility;suspended=false;}
    const battle=document.getElementById('battlePageOverlay'),back=document.getElementById('boardModalBack'),modal=document.getElementById('boardModal');
    const covered=Boolean((battle?.classList.contains('open')&&battle.classList.contains('ready')&&!battle.classList.contains('transitioning')&&!battle.classList.contains('closing'))||(back?.classList.contains('open')&&modal?.dataset.phoneShell==='page'));
    if(covered===suspended)return;
    suspended=covered;map.style.contentVisibility=covered?'hidden':previous;
    map.dataset.phoneMapSuspended=String(covered);
  }
  function start(){window.TabletopBoardPhoneLayout?.subscribe('scene-visibility',sync,{gameUis:['board'],roots:['#boardModalBack','#battlePageOverlay']});sync();}
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})();
