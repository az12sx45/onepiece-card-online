
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
    if (main?.dataset.cardPhoneMounted) return;
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


/* Android presentation module: vendor/card-interact */
/* interact.js 1.10.28, MIT. License retained below and in interact.LICENSE.txt. */
/*
Copyright (c) 2012-present Taye Adeyemi <dev@taye.me>

Permission is hereby granted, free of charge, to any person 
obtaining a copy of this software and associated 
documentation files (the "Software"), to deal in the Software 
without restriction, including without limitation the rights 
to use, copy, modify, merge, publish, distribute, sublicense, 
and/or sell copies of the Software, and to permit persons to 
whom the Software is furnished to do so, subject to the 
following conditions:

The above copyright notice and this permission notice shall 
be included in all copies or substantial portions of the 
Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY 
KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE 
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR 
PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR 
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR 
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE 
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/
(()=>{
const origin=window.__TABLETOP_ANDROID_TEST_ORIGIN||"https://onepiece-card-online.onrender.com";
if(location.origin!==origin||! ["/game.html","/tutorial.html"].includes(location.pathname))return;
const module={exports:{}},exports=module.exports;
/* interact.js 1.10.28 | https://raw.github.com/taye/interact.js/main/LICENSE */

!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):(t="undefined"!=typeof globalThis?globalThis:t||self).interact=e()}(this,(function(){"use strict";function t(t,e){var n=Object.keys(t);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(t);e&&(r=r.filter((function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),n.push.apply(n,r)}return n}function e(e){for(var n=1;n<arguments.length;n++){var r=null!=arguments[n]?arguments[n]:{};n%2?t(Object(r),!0).forEach((function(t){a(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):t(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function n(t){return n="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},n(t)}function r(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}function i(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,d(r.key),r)}}function o(t,e,n){return e&&i(t.prototype,e),n&&i(t,n),Object.defineProperty(t,"prototype",{writable:!1}),t}function a(t,e,n){return(e=d(e))in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}function s(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function");t.prototype=Object.create(e&&e.prototype,{constructor:{value:t,writable:!0,configurable:!0}}),Object.defineProperty(t,"prototype",{writable:!1}),e&&l(t,e)}function c(t){return c=Object.setPrototypeOf?Object.getPrototypeOf.bind():function(t){return t.__proto__||Object.getPrototypeOf(t)},c(t)}function l(t,e){return l=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(t,e){return t.__proto__=e,t},l(t,e)}function u(t){if(void 0===t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return t}function p(t){var e=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(t){return!1}}();return function(){var n,r=c(t);if(e){var i=c(this).constructor;n=Reflect.construct(r,arguments,i)}else n=r.apply(this,arguments);return function(t,e){if(e&&("object"==typeof e||"function"==typeof e))return e;if(void 0!==e)throw new TypeError("Derived constructors may only return object or undefined");return u(t)}(this,n)}}function f(){return f="undefined"!=typeof Reflect&&Reflect.get?Reflect.get.bind():function(t,e,n){var r=function(t,e){for(;!Object.prototype.hasOwnProperty.call(t,e)&&null!==(t=c(t)););return t}(t,e);if(r){var i=Object.getOwnPropertyDescriptor(r,e);return i.get?i.get.call(arguments.length<3?t:n):i.value}},f.apply(this,arguments)}function d(t){var e=function(t,e){if("object"!=typeof t||null===t)return t;var n=t[Symbol.toPrimitive];if(void 0!==n){var r=n.call(t,e||"default");if("object"!=typeof r)return r;throw new TypeError("@@toPrimitive must return a primitive value.")}return("string"===e?String:Number)(t)}(t,"string");return"symbol"==typeof e?e:e+""}var h=function(t){return!(!t||!t.Window)&&t instanceof t.Window},v=void 0,g=void 0;function m(t){v=t;var e=t.document.createTextNode("");e.ownerDocument!==t.document&&"function"==typeof t.wrap&&t.wrap(e)===e&&(t=t.wrap(t)),g=t}function y(t){return h(t)?t:(t.ownerDocument||t).defaultView||g.window}"undefined"!=typeof window&&window&&m(window);var b=function(t){return!!t&&"object"===n(t)},x=function(t){return"function"==typeof t},w={window:function(t){return t===g||h(t)},docFrag:function(t){return b(t)&&11===t.nodeType},object:b,func:x,number:function(t){return"number"==typeof t},bool:function(t){return"boolean"==typeof t},string:function(t){return"string"==typeof t},element:function(t){if(!t||"object"!==n(t))return!1;var e=y(t)||g;return/object|function/.test("undefined"==typeof Element?"undefined":n(Element))?t instanceof Element||t instanceof e.Element:1===t.nodeType&&"string"==typeof t.nodeName},plainObject:function(t){return b(t)&&!!t.constructor&&/function Object\b/.test(t.constructor.toString())},array:function(t){return b(t)&&void 0!==t.length&&x(t.splice)}};function E(t){var e=t.interaction;if("drag"===e.prepared.name){var n=e.prepared.axis;"x"===n?(e.coords.cur.page.y=e.coords.start.page.y,e.coords.cur.client.y=e.coords.start.client.y,e.coords.velocity.client.y=0,e.coords.velocity.page.y=0):"y"===n&&(e.coords.cur.page.x=e.coords.start.page.x,e.coords.cur.client.x=e.coords.start.client.x,e.coords.velocity.client.x=0,e.coords.velocity.page.x=0)}}function T(t){var e=t.iEvent,n=t.interaction;if("drag"===n.prepared.name){var r=n.prepared.axis;if("x"===r||"y"===r){var i="x"===r?"y":"x";e.page[i]=n.coords.start.page[i],e.client[i]=n.coords.start.client[i],e.delta[i]=0}}}var S={id:"actions/drag",install:function(t){var e=t.actions,n=t.Interactable,r=t.defaults;n.prototype.draggable=S.draggable,e.map.drag=S,e.methodDict.drag="draggable",r.actions.drag=S.defaults},listeners:{"interactions:before-action-move":E,"interactions:action-resume":E,"interactions:action-move":T,"auto-start:check":function(t){var e=t.interaction,n=t.interactable,r=t.buttons,i=n.options.drag;if(i&&i.enabled&&(!e.pointerIsDown||!/mouse|pointer/.test(e.pointerType)||0!=(r&n.options.drag.mouseButtons)))return t.action={name:"drag",axis:"start"===i.lockAxis?i.startAxis:i.lockAxis},!1}},draggable:function(t){return w.object(t)?(this.options.drag.enabled=!1!==t.enabled,this.setPerAction("drag",t),this.setOnEvents("drag",t),/^(xy|x|y|start)$/.test(t.lockAxis)&&(this.options.drag.lockAxis=t.lockAxis),/^(xy|x|y)$/.test(t.startAxis)&&(this.options.drag.startAxis=t.startAxis),this):w.bool(t)?(this.options.drag.enabled=t,this):this.options.drag},beforeMove:E,move:T,defaults:{startAxis:"xy",lockAxis:"xy"},getCursor:function(){return"move"},filterEventType:function(t){return 0===t.search("drag")}},_=S,P={init:function(t){var e=t;P.document=e.document,P.DocumentFragment=e.DocumentFragment||O,P.SVGElement=e.SVGElement||O,P.SVGSVGElement=e.SVGSVGElement||O,P.SVGElementInstance=e.SVGElementInstance||O,P.Element=e.Element||O,P.HTMLElement=e.HTMLElement||P.Element,P.Event=e.Event,P.Touch=e.Touch||O,P.PointerEvent=e.PointerEvent||e.MSPointerEvent},document:null,DocumentFragment:null,SVGElement:null,SVGSVGElement:null,SVGElementInstance:null,Element:null,HTMLElement:null,Event:null,Touch:null,PointerEvent:null};function O(){}var k=P;var D={init:function(t){var e=k.Element,n=t.navigator||{};D.supportsTouch="ontouchstart"in t||w.func(t.DocumentTouch)&&k.document instanceof t.DocumentTouch,D.supportsPointerEvent=!1!==n.pointerEnabled&&!!k.PointerEvent,D.isIOS=/iP(hone|od|ad)/.test(n.platform),D.isIOS7=/iP(hone|od|ad)/.test(n.platform)&&/OS 7[^\d]/.test(n.appVersion),D.isIe9=/MSIE 9/.test(n.userAgent),D.isOperaMobile="Opera"===n.appName&&D.supportsTouch&&/Presto/.test(n.userAgent),D.prefixedMatchesSelector="matches"in e.prototype?"matches":"webkitMatchesSelector"in e.prototype?"webkitMatchesSelector":"mozMatchesSelector"in e.prototype?"mozMatchesSelector":"oMatchesSelector"in e.prototype?"oMatchesSelector":"msMatchesSelector",D.pEventTypes=D.supportsPointerEvent?k.PointerEvent===t.MSPointerEvent?{up:"MSPointerUp",down:"MSPointerDown",over:"mouseover",out:"mouseout",move:"MSPointerMove",cancel:"MSPointerCancel"}:{up:"pointerup",down:"pointerdown",over:"pointerover",out:"pointerout",move:"pointermove",cancel:"pointercancel"}:null,D.wheelEvent=k.document&&"onmousewheel"in k.document?"mousewheel":"wheel"},supportsTouch:null,supportsPointerEvent:null,isIOS7:null,isIOS:null,isIe9:null,isOperaMobile:null,prefixedMatchesSelector:null,pEventTypes:null,wheelEvent:null};var I=D;function M(t,e){if(t.contains)return t.contains(e);for(;e;){if(e===t)return!0;e=e.parentNode}return!1}function z(t,e){for(;w.element(t);){if(R(t,e))return t;t=A(t)}return null}function A(t){var e=t.parentNode;if(w.docFrag(e)){for(;(e=e.host)&&w.docFrag(e););return e}return e}function R(t,e){return g!==v&&(e=e.replace(/\/deep\//g," ")),t[I.prefixedMatchesSelector](e)}var C=function(t){return t.parentNode||t.host};function j(t,e){for(var n,r=[],i=t;(n=C(i))&&i!==e&&n!==i.ownerDocument;)r.unshift(i),i=n;return r}function F(t,e,n){for(;w.element(t);){if(R(t,e))return!0;if((t=A(t))===n)return R(t,e)}return!1}function X(t){return t.correspondingUseElement||t}function Y(t){var e=t instanceof k.SVGElement?t.getBoundingClientRect():t.getClientRects()[0];return e&&{left:e.left,right:e.right,top:e.top,bottom:e.bottom,width:e.width||e.right-e.left,height:e.height||e.bottom-e.top}}function L(t){var e,n=Y(t);if(!I.isIOS7&&n){var r={x:(e=(e=y(t))||g).scrollX||e.document.documentElement.scrollLeft,y:e.scrollY||e.document.documentElement.scrollTop};n.left+=r.x,n.right+=r.x,n.top+=r.y,n.bottom+=r.y}return n}function q(t){for(var e=[];t;)e.push(t),t=A(t);return e}function B(t){return!!w.string(t)&&(k.document.querySelector(t),!0)}function V(t,e){for(var n in e)t[n]=e[n];return t}function W(t,e,n){return"parent"===t?A(n):"self"===t?e.getRect(n):z(n,t)}function G(t,e,n,r){var i=t;return w.string(i)?i=W(i,e,n):w.func(i)&&(i=i.apply(void 0,r)),w.element(i)&&(i=L(i)),i}function N(t){return t&&{x:"x"in t?t.x:t.left,y:"y"in t?t.y:t.top}}function U(t){return!t||"x"in t&&"y"in t||((t=V({},t)).x=t.left||0,t.y=t.top||0,t.width=t.width||(t.right||0)-t.x,t.height=t.height||(t.bottom||0)-t.y),t}function H(t,e,n){t.left&&(e.left+=n.x),t.right&&(e.right+=n.x),t.top&&(e.top+=n.y),t.bottom&&(e.bottom+=n.y),e.width=e.right-e.left,e.height=e.bottom-e.top}function K(t,e,n){var r=n&&t.options[n];return N(G(r&&r.origin||t.options.origin,t,e,[t&&e]))||{x:0,y:0}}function $(t,e){var n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:function(t){return!0},r=arguments.length>3?arguments[3]:void 0;if(r=r||{},w.string(t)&&-1!==t.search(" ")&&(t=J(t)),w.array(t))return t.forEach((function(t){return $(t,e,n,r)})),r;if(w.object(t)&&(e=t,t=""),w.func(e)&&n(t))r[t]=r[t]||[],r[t].push(e);else if(w.array(e))for(var i=0,o=e;i<o.length;i++){var a=o[i];$(t,a,n,r)}else if(w.object(e))for(var s in e){$(J(s).map((function(e){return"".concat(t).concat(e)})),e[s],n,r)}return r}function J(t){return t.trim().split(/ +/)}var Q=function(t,e){return Math.sqrt(t*t+e*e)},Z=["webkit","moz"];function tt(t,e){t.__set||(t.__set={});var n=function(n){if(Z.some((function(t){return 0===n.indexOf(t)})))return 1;"function"!=typeof t[n]&&"__set"!==n&&Object.defineProperty(t,n,{get:function(){return n in t.__set?t.__set[n]:t.__set[n]=e[n]},set:function(e){t.__set[n]=e},configurable:!0})};for(var r in e)n(r);return t}function et(t,e){t.page=t.page||{},t.page.x=e.page.x,t.page.y=e.page.y,t.client=t.client||{},t.client.x=e.client.x,t.client.y=e.client.y,t.timeStamp=e.timeStamp}function nt(t){t.page.x=0,t.page.y=0,t.client.x=0,t.client.y=0}function rt(t){return t instanceof k.Event||t instanceof k.Touch}function it(t,e,n){return t=t||"page",(n=n||{}).x=e[t+"X"],n.y=e[t+"Y"],n}function ot(t,e){return e=e||{x:0,y:0},I.isOperaMobile&&rt(t)?(it("screen",t,e),e.x+=window.scrollX,e.y+=window.scrollY):it("page",t,e),e}function at(t){return w.number(t.pointerId)?t.pointerId:t.identifier}function st(t,e,n){var r=e.length>1?lt(e):e[0];ot(r,t.page),function(t,e){e=e||{},I.isOperaMobile&&rt(t)?it("screen",t,e):it("client",t,e)}(r,t.client),t.timeStamp=n}function ct(t){var e=[];return w.array(t)?(e[0]=t[0],e[1]=t[1]):"touchend"===t.type?1===t.touches.length?(e[0]=t.touches[0],e[1]=t.changedTouches[0]):0===t.touches.length&&(e[0]=t.changedTouches[0],e[1]=t.changedTouches[1]):(e[0]=t.touches[0],e[1]=t.touches[1]),e}function lt(t){for(var e={pageX:0,pageY:0,clientX:0,clientY:0,screenX:0,screenY:0},n=0;n<t.length;n++){var r=t[n];for(var i in e)e[i]+=r[i]}for(var o in e)e[o]/=t.length;return e}function ut(t){if(!t.length)return null;var e=ct(t),n=Math.min(e[0].pageX,e[1].pageX),r=Math.min(e[0].pageY,e[1].pageY),i=Math.max(e[0].pageX,e[1].pageX),o=Math.max(e[0].pageY,e[1].pageY);return{x:n,y:r,left:n,top:r,right:i,bottom:o,width:i-n,height:o-r}}function pt(t,e){var n=e+"X",r=e+"Y",i=ct(t),o=i[0][n]-i[1][n],a=i[0][r]-i[1][r];return Q(o,a)}function ft(t,e){var n=e+"X",r=e+"Y",i=ct(t),o=i[1][n]-i[0][n],a=i[1][r]-i[0][r];return 180*Math.atan2(a,o)/Math.PI}function dt(t){return w.string(t.pointerType)?t.pointerType:w.number(t.pointerType)?[void 0,void 0,"touch","pen","mouse"][t.pointerType]:/touch/.test(t.type||"")||t instanceof k.Touch?"touch":"mouse"}function ht(t){var e=w.func(t.composedPath)?t.composedPath():t.path;return[X(e?e[0]:t.target),X(t.currentTarget)]}var vt=function(){function t(e){r(this,t),this.immediatePropagationStopped=!1,this.propagationStopped=!1,this._interaction=e}return o(t,[{key:"preventDefault",value:function(){}},{key:"stopPropagation",value:function(){this.propagationStopped=!0}},{key:"stopImmediatePropagation",value:function(){this.immediatePropagationStopped=this.propagationStopped=!0}}]),t}();Object.defineProperty(vt.prototype,"interaction",{get:function(){return this._interaction._proxy},set:function(){}});var gt=function(t,e){for(var n=0;n<e.length;n++){var r=e[n];t.push(r)}return t},mt=function(t){return gt([],t)},yt=function(t,e){for(var n=0;n<t.length;n++)if(e(t[n],n,t))return n;return-1},bt=function(t,e){return t[yt(t,e)]},xt=function(t){s(n,t);var e=p(n);function n(t,i,o){var a;r(this,n),(a=e.call(this,i._interaction)).dropzone=void 0,a.dragEvent=void 0,a.relatedTarget=void 0,a.draggable=void 0,a.propagationStopped=!1,a.immediatePropagationStopped=!1;var s="dragleave"===o?t.prev:t.cur,c=s.element,l=s.dropzone;return a.type=o,a.target=c,a.currentTarget=c,a.dropzone=l,a.dragEvent=i,a.relatedTarget=i.target,a.draggable=i.interactable,a.timeStamp=i.timeStamp,a}return o(n,[{key:"reject",value:function(){var t=this,e=this._interaction.dropState;if("dropactivate"===this.type||this.dropzone&&e.cur.dropzone===this.dropzone&&e.cur.element===this.target)if(e.prev.dropzone=this.dropzone,e.prev.element=this.target,e.rejected=!0,e.events.enter=null,this.stopImmediatePropagation(),"dropactivate"===this.type){var r=e.activeDrops,i=yt(r,(function(e){var n=e.dropzone,r=e.element;return n===t.dropzone&&r===t.target}));e.activeDrops.splice(i,1);var o=new n(e,this.dragEvent,"dropdeactivate");o.dropzone=this.dropzone,o.target=this.target,this.dropzone.fire(o)}else this.dropzone.fire(new n(e,this.dragEvent,"dragleave"))}},{key:"preventDefault",value:function(){}},{key:"stopPropagation",value:function(){this.propagationStopped=!0}},{key:"stopImmediatePropagation",value:function(){this.immediatePropagationStopped=this.propagationStopped=!0}}]),n}(vt);function wt(t,e){for(var n=0,r=t.slice();n<r.length;n++){var i=r[n],o=i.dropzone,a=i.element;e.dropzone=o,e.target=a,o.fire(e),e.propagationStopped=e.immediatePropagationStopped=!1}}function Et(t,e){for(var n=function(t,e){for(var n=[],r=0,i=t.interactables.list;r<i.length;r++){var o=i[r];if(o.options.drop.enabled){var a=o.options.drop.accept;if(!(w.element(a)&&a!==e||w.string(a)&&!R(e,a)||w.func(a)&&!a({dropzone:o,draggableElement:e})))for(var s=0,c=o.getAllElements();s<c.length;s++){var l=c[s];l!==e&&n.push({dropzone:o,element:l,rect:o.getRect(l)})}}}return n}(t,e),r=0;r<n.length;r++){var i=n[r];i.rect=i.dropzone.getRect(i.element)}return n}function Tt(t,e,n){for(var r=t.dropState,i=t.interactable,o=t.element,a=[],s=0,c=r.activeDrops;s<c.length;s++){var l=c[s],u=l.dropzone,p=l.element,f=l.rect,d=u.dropCheck(e,n,i,o,p,f);a.push(d?p:null)}var h=function(t){for(var e,n,r,i=[],o=0;o<t.length;o++){var a=t[o],s=t[e];if(a&&o!==e)if(s){var c=C(a),l=C(s);if(c!==a.ownerDocument)if(l!==a.ownerDocument)if(c!==l){i=i.length?i:j(s);var u=void 0;if(s instanceof k.HTMLElement&&a instanceof k.SVGElement&&!(a instanceof k.SVGSVGElement)){if(a===l)continue;u=a.ownerSVGElement}else u=a;for(var p=j(u,s.ownerDocument),f=0;p[f]&&p[f]===i[f];)f++;var d=[p[f-1],p[f],i[f]];if(d[0])for(var h=d[0].lastChild;h;){if(h===d[1]){e=o,i=p;break}if(h===d[2])break;h=h.previousSibling}}else r=s,void 0,void 0,(parseInt(y(n=a).getComputedStyle(n).zIndex,10)||0)>=(parseInt(y(r).getComputedStyle(r).zIndex,10)||0)&&(e=o);else e=o}else e=o}return e}(a);return r.activeDrops[h]||null}function St(t,e,n){var r=t.dropState,i={enter:null,leave:null,activate:null,deactivate:null,move:null,drop:null};return"dragstart"===n.type&&(i.activate=new xt(r,n,"dropactivate"),i.activate.target=null,i.activate.dropzone=null),"dragend"===n.type&&(i.deactivate=new xt(r,n,"dropdeactivate"),i.deactivate.target=null,i.deactivate.dropzone=null),r.rejected||(r.cur.element!==r.prev.element&&(r.prev.dropzone&&(i.leave=new xt(r,n,"dragleave"),n.dragLeave=i.leave.target=r.prev.element,n.prevDropzone=i.leave.dropzone=r.prev.dropzone),r.cur.dropzone&&(i.enter=new xt(r,n,"dragenter"),n.dragEnter=r.cur.element,n.dropzone=r.cur.dropzone)),"dragend"===n.type&&r.cur.dropzone&&(i.drop=new xt(r,n,"drop"),n.dropzone=r.cur.dropzone,n.relatedTarget=r.cur.element),"dragmove"===n.type&&r.cur.dropzone&&(i.move=new xt(r,n,"dropmove"),n.dropzone=r.cur.dropzone)),i}function _t(t,e){var n=t.dropState,r=n.activeDrops,i=n.cur,o=n.prev;e.leave&&o.dropzone.fire(e.leave),e.enter&&i.dropzone.fire(e.enter),e.move&&i.dropzone.fire(e.move),e.drop&&i.dropzone.fire(e.drop),e.deactivate&&wt(r,e.deactivate),n.prev.dropzone=i.dropzone,n.prev.element=i.element}function Pt(t,e){var n=t.interaction,r=t.iEvent,i=t.event;if("dragmove"===r.type||"dragend"===r.type){var o=n.dropState;e.dynamicDrop&&(o.activeDrops=Et(e,n.element));var a=r,s=Tt(n,a,i);o.rejected=o.rejected&&!!s&&s.dropzone===o.cur.dropzone&&s.element===o.cur.element,o.cur.dropzone=s&&s.dropzone,o.cur.element=s&&s.element,o.events=St(n,0,a)}}var Ot={id:"actions/drop",install:function(t){var e=t.actions,n=t.interactStatic,r=t.Interactable,i=t.defaults;t.usePlugin(_),r.prototype.dropzone=function(t){return function(t,e){if(w.object(e)){if(t.options.drop.enabled=!1!==e.enabled,e.listeners){var n=$(e.listeners),r=Object.keys(n).reduce((function(t,e){return t[/^(enter|leave)/.test(e)?"drag".concat(e):/^(activate|deactivate|move)/.test(e)?"drop".concat(e):e]=n[e],t}),{}),i=t.options.drop.listeners;i&&t.off(i),t.on(r),t.options.drop.listeners=r}return w.func(e.ondrop)&&t.on("drop",e.ondrop),w.func(e.ondropactivate)&&t.on("dropactivate",e.ondropactivate),w.func(e.ondropdeactivate)&&t.on("dropdeactivate",e.ondropdeactivate),w.func(e.ondragenter)&&t.on("dragenter",e.ondragenter),w.func(e.ondragleave)&&t.on("dragleave",e.ondragleave),w.func(e.ondropmove)&&t.on("dropmove",e.ondropmove),/^(pointer|center)$/.test(e.overlap)?t.options.drop.overlap=e.overlap:w.number(e.overlap)&&(t.options.drop.overlap=Math.max(Math.min(1,e.overlap),0)),"accept"in e&&(t.options.drop.accept=e.accept),"checker"in e&&(t.options.drop.checker=e.checker),t}if(w.bool(e))return t.options.drop.enabled=e,t;return t.options.drop}(this,t)},r.prototype.dropCheck=function(t,e,n,r,i,o){return function(t,e,n,r,i,o,a){var s=!1;if(!(a=a||t.getRect(o)))return!!t.options.drop.checker&&t.options.drop.checker(e,n,s,t,o,r,i);var c=t.options.drop.overlap;if("pointer"===c){var l=K(r,i,"drag"),u=ot(e);u.x+=l.x,u.y+=l.y;var p=u.x>a.left&&u.x<a.right,f=u.y>a.top&&u.y<a.bottom;s=p&&f}var d=r.getRect(i);if(d&&"center"===c){var h=d.left+d.width/2,v=d.top+d.height/2;s=h>=a.left&&h<=a.right&&v>=a.top&&v<=a.bottom}if(d&&w.number(c)){s=Math.max(0,Math.min(a.right,d.right)-Math.max(a.left,d.left))*Math.max(0,Math.min(a.bottom,d.bottom)-Math.max(a.top,d.top))/(d.width*d.height)>=c}t.options.drop.checker&&(s=t.options.drop.checker(e,n,s,t,o,r,i));return s}(this,t,e,n,r,i,o)},n.dynamicDrop=function(e){return w.bool(e)?(t.dynamicDrop=e,n):t.dynamicDrop},V(e.phaselessTypes,{dragenter:!0,dragleave:!0,dropactivate:!0,dropdeactivate:!0,dropmove:!0,drop:!0}),e.methodDict.drop="dropzone",t.dynamicDrop=!1,i.actions.drop=Ot.defaults},listeners:{"interactions:before-action-start":function(t){var e=t.interaction;"drag"===e.prepared.name&&(e.dropState={cur:{dropzone:null,element:null},prev:{dropzone:null,element:null},rejected:null,events:null,activeDrops:[]})},"interactions:after-action-start":function(t,e){var n=t.interaction,r=(t.event,t.iEvent);if("drag"===n.prepared.name){var i=n.dropState;i.activeDrops=[],i.events={},i.activeDrops=Et(e,n.element),i.events=St(n,0,r),i.events.activate&&(wt(i.activeDrops,i.events.activate),e.fire("actions/drop:start",{interaction:n,dragEvent:r}))}},"interactions:action-move":Pt,"interactions:after-action-move":function(t,e){var n=t.interaction,r=t.iEvent;if("drag"===n.prepared.name){var i=n.dropState;_t(n,i.events),e.fire("actions/drop:move",{interaction:n,dragEvent:r}),i.events={}}},"interactions:action-end":function(t,e){if("drag"===t.interaction.prepared.name){var n=t.interaction,r=t.iEvent;Pt(t,e),_t(n,n.dropState.events),e.fire("actions/drop:end",{interaction:n,dragEvent:r})}},"interactions:stop":function(t){var e=t.interaction;if("drag"===e.prepared.name){var n=e.dropState;n&&(n.activeDrops=null,n.events=null,n.cur.dropzone=null,n.cur.element=null,n.prev.dropzone=null,n.prev.element=null,n.rejected=!1)}}},getActiveDrops:Et,getDrop:Tt,getDropEvents:St,fireDropEvents:_t,filterEventType:function(t){return 0===t.search("drag")||0===t.search("drop")},defaults:{enabled:!1,accept:null,overlap:"pointer"}},kt=Ot;function Dt(t){var e=t.interaction,n=t.iEvent,r=t.phase;if("gesture"===e.prepared.name){var i=e.pointers.map((function(t){return t.pointer})),o="start"===r,a="end"===r,s=e.interactable.options.deltaSource;if(n.touches=[i[0],i[1]],o)n.distance=pt(i,s),n.box=ut(i),n.scale=1,n.ds=0,n.angle=ft(i,s),n.da=0,e.gesture.startDistance=n.distance,e.gesture.startAngle=n.angle;else if(a||e.pointers.length<2){var c=e.prevEvent;n.distance=c.distance,n.box=c.box,n.scale=c.scale,n.ds=0,n.angle=c.angle,n.da=0}else n.distance=pt(i,s),n.box=ut(i),n.scale=n.distance/e.gesture.startDistance,n.angle=ft(i,s),n.ds=n.scale-e.gesture.scale,n.da=n.angle-e.gesture.angle;e.gesture.distance=n.distance,e.gesture.angle=n.angle,w.number(n.scale)&&n.scale!==1/0&&!isNaN(n.scale)&&(e.gesture.scale=n.scale)}}var It={id:"actions/gesture",before:["actions/drag","actions/resize"],install:function(t){var e=t.actions,n=t.Interactable,r=t.defaults;n.prototype.gesturable=function(t){return w.object(t)?(this.options.gesture.enabled=!1!==t.enabled,this.setPerAction("gesture",t),this.setOnEvents("gesture",t),this):w.bool(t)?(this.options.gesture.enabled=t,this):this.options.gesture},e.map.gesture=It,e.methodDict.gesture="gesturable",r.actions.gesture=It.defaults},listeners:{"interactions:action-start":Dt,"interactions:action-move":Dt,"interactions:action-end":Dt,"interactions:new":function(t){t.interaction.gesture={angle:0,distance:0,scale:1,startAngle:0,startDistance:0}},"auto-start:check":function(t){if(!(t.interaction.pointers.length<2)){var e=t.interactable.options.gesture;if(e&&e.enabled)return t.action={name:"gesture"},!1}}},defaults:{},getCursor:function(){return""},filterEventType:function(t){return 0===t.search("gesture")}},Mt=It;function zt(t,e,n,r,i,o,a){if(!e)return!1;if(!0===e){var s=w.number(o.width)?o.width:o.right-o.left,c=w.number(o.height)?o.height:o.bottom-o.top;if(a=Math.min(a,Math.abs(("left"===t||"right"===t?s:c)/2)),s<0&&("left"===t?t="right":"right"===t&&(t="left")),c<0&&("top"===t?t="bottom":"bottom"===t&&(t="top")),"left"===t){var l=s>=0?o.left:o.right;return n.x<l+a}if("top"===t){var u=c>=0?o.top:o.bottom;return n.y<u+a}if("right"===t)return n.x>(s>=0?o.right:o.left)-a;if("bottom"===t)return n.y>(c>=0?o.bottom:o.top)-a}return!!w.element(r)&&(w.element(e)?e===r:F(r,e,i))}function At(t){var e=t.iEvent,n=t.interaction;if("resize"===n.prepared.name&&n.resizeAxes){var r=e;n.interactable.options.resize.square?("y"===n.resizeAxes?r.delta.x=r.delta.y:r.delta.y=r.delta.x,r.axes="xy"):(r.axes=n.resizeAxes,"x"===n.resizeAxes?r.delta.y=0:"y"===n.resizeAxes&&(r.delta.x=0))}}var Rt,Ct,jt={id:"actions/resize",before:["actions/drag"],install:function(t){var e=t.actions,n=t.browser,r=t.Interactable,i=t.defaults;jt.cursors=function(t){return t.isIe9?{x:"e-resize",y:"s-resize",xy:"se-resize",top:"n-resize",left:"w-resize",bottom:"s-resize",right:"e-resize",topleft:"se-resize",bottomright:"se-resize",topright:"ne-resize",bottomleft:"ne-resize"}:{x:"ew-resize",y:"ns-resize",xy:"nwse-resize",top:"ns-resize",left:"ew-resize",bottom:"ns-resize",right:"ew-resize",topleft:"nwse-resize",bottomright:"nwse-resize",topright:"nesw-resize",bottomleft:"nesw-resize"}}(n),jt.defaultMargin=n.supportsTouch||n.supportsPointerEvent?20:10,r.prototype.resizable=function(e){return function(t,e,n){if(w.object(e))return t.options.resize.enabled=!1!==e.enabled,t.setPerAction("resize",e),t.setOnEvents("resize",e),w.string(e.axis)&&/^x$|^y$|^xy$/.test(e.axis)?t.options.resize.axis=e.axis:null===e.axis&&(t.options.resize.axis=n.defaults.actions.resize.axis),w.bool(e.preserveAspectRatio)?t.options.resize.preserveAspectRatio=e.preserveAspectRatio:w.bool(e.square)&&(t.options.resize.square=e.square),t;if(w.bool(e))return t.options.resize.enabled=e,t;return t.options.resize}(this,e,t)},e.map.resize=jt,e.methodDict.resize="resizable",i.actions.resize=jt.defaults},listeners:{"interactions:new":function(t){t.interaction.resizeAxes="xy"},"interactions:action-start":function(t){!function(t){var e=t.iEvent,n=t.interaction;if("resize"===n.prepared.name&&n.prepared.edges){var r=e,i=n.rect;n._rects={start:V({},i),corrected:V({},i),previous:V({},i),delta:{left:0,right:0,width:0,top:0,bottom:0,height:0}},r.edges=n.prepared.edges,r.rect=n._rects.corrected,r.deltaRect=n._rects.delta}}(t),At(t)},"interactions:action-move":function(t){!function(t){var e=t.iEvent,n=t.interaction;if("resize"===n.prepared.name&&n.prepared.edges){var r=e,i=n.interactable.options.resize.invert,o="reposition"===i||"negate"===i,a=n.rect,s=n._rects,c=s.start,l=s.corrected,u=s.delta,p=s.previous;if(V(p,l),o){if(V(l,a),"reposition"===i){if(l.top>l.bottom){var f=l.top;l.top=l.bottom,l.bottom=f}if(l.left>l.right){var d=l.left;l.left=l.right,l.right=d}}}else l.top=Math.min(a.top,c.bottom),l.bottom=Math.max(a.bottom,c.top),l.left=Math.min(a.left,c.right),l.right=Math.max(a.right,c.left);for(var h in l.width=l.right-l.left,l.height=l.bottom-l.top,l)u[h]=l[h]-p[h];r.edges=n.prepared.edges,r.rect=l,r.deltaRect=u}}(t),At(t)},"interactions:action-end":function(t){var e=t.iEvent,n=t.interaction;if("resize"===n.prepared.name&&n.prepared.edges){var r=e;r.edges=n.prepared.edges,r.rect=n._rects.corrected,r.deltaRect=n._rects.delta}},"auto-start:check":function(t){var e=t.interaction,n=t.interactable,r=t.element,i=t.rect,o=t.buttons;if(i){var a=V({},e.coords.cur.page),s=n.options.resize;if(s&&s.enabled&&(!e.pointerIsDown||!/mouse|pointer/.test(e.pointerType)||0!=(o&s.mouseButtons))){if(w.object(s.edges)){var c={left:!1,right:!1,top:!1,bottom:!1};for(var l in c)c[l]=zt(l,s.edges[l],a,e._latestPointer.eventTarget,r,i,s.margin||jt.defaultMargin);c.left=c.left&&!c.right,c.top=c.top&&!c.bottom,(c.left||c.right||c.top||c.bottom)&&(t.action={name:"resize",edges:c})}else{var u="y"!==s.axis&&a.x>i.right-jt.defaultMargin,p="x"!==s.axis&&a.y>i.bottom-jt.defaultMargin;(u||p)&&(t.action={name:"resize",axes:(u?"x":"")+(p?"y":"")})}return!t.action&&void 0}}}},defaults:{square:!1,preserveAspectRatio:!1,axis:"xy",margin:NaN,edges:null,invert:"none"},cursors:null,getCursor:function(t){var e=t.edges,n=t.axis,r=t.name,i=jt.cursors,o=null;if(n)o=i[r+n];else if(e){for(var a="",s=0,c=["top","bottom","left","right"];s<c.length;s++){var l=c[s];e[l]&&(a+=l)}o=i[a]}return o},filterEventType:function(t){return 0===t.search("resize")},defaultMargin:null},Ft=jt,Xt={id:"actions",install:function(t){t.usePlugin(Mt),t.usePlugin(Ft),t.usePlugin(_),t.usePlugin(kt)}},Yt=0;var Lt={request:function(t){return Rt(t)},cancel:function(t){return Ct(t)},init:function(t){if(Rt=t.requestAnimationFrame,Ct=t.cancelAnimationFrame,!Rt)for(var e=["ms","moz","webkit","o"],n=0;n<e.length;n++){var r=e[n];Rt=t["".concat(r,"RequestAnimationFrame")],Ct=t["".concat(r,"CancelAnimationFrame")]||t["".concat(r,"CancelRequestAnimationFrame")]}Rt=Rt&&Rt.bind(t),Ct=Ct&&Ct.bind(t),Rt||(Rt=function(e){var n=Date.now(),r=Math.max(0,16-(n-Yt)),i=t.setTimeout((function(){e(n+r)}),r);return Yt=n+r,i},Ct=function(t){return clearTimeout(t)})}};var qt={defaults:{enabled:!1,margin:60,container:null,speed:300},now:Date.now,interaction:null,i:0,x:0,y:0,isScrolling:!1,prevTime:0,margin:0,speed:0,start:function(t){qt.isScrolling=!0,Lt.cancel(qt.i),t.autoScroll=qt,qt.interaction=t,qt.prevTime=qt.now(),qt.i=Lt.request(qt.scroll)},stop:function(){qt.isScrolling=!1,qt.interaction&&(qt.interaction.autoScroll=null),Lt.cancel(qt.i)},scroll:function(){var t=qt.interaction,e=t.interactable,n=t.element,r=t.prepared.name,i=e.options[r].autoScroll,o=Bt(i.container,e,n),a=qt.now(),s=(a-qt.prevTime)/1e3,c=i.speed*s;if(c>=1){var l={x:qt.x*c,y:qt.y*c};if(l.x||l.y){var u=Vt(o);w.window(o)?o.scrollBy(l.x,l.y):o&&(o.scrollLeft+=l.x,o.scrollTop+=l.y);var p=Vt(o),f={x:p.x-u.x,y:p.y-u.y};(f.x||f.y)&&e.fire({type:"autoscroll",target:n,interactable:e,delta:f,interaction:t,container:o})}qt.prevTime=a}qt.isScrolling&&(Lt.cancel(qt.i),qt.i=Lt.request(qt.scroll))},check:function(t,e){var n;return null==(n=t.options[e].autoScroll)?void 0:n.enabled},onInteractionMove:function(t){var e=t.interaction,n=t.pointer;if(e.interacting()&&qt.check(e.interactable,e.prepared.name))if(e.simulation)qt.x=qt.y=0;else{var r,i,o,a,s=e.interactable,c=e.element,l=e.prepared.name,u=s.options[l].autoScroll,p=Bt(u.container,s,c);if(w.window(p))a=n.clientX<qt.margin,r=n.clientY<qt.margin,i=n.clientX>p.innerWidth-qt.margin,o=n.clientY>p.innerHeight-qt.margin;else{var f=Y(p);a=n.clientX<f.left+qt.margin,r=n.clientY<f.top+qt.margin,i=n.clientX>f.right-qt.margin,o=n.clientY>f.bottom-qt.margin}qt.x=i?1:a?-1:0,qt.y=o?1:r?-1:0,qt.isScrolling||(qt.margin=u.margin,qt.speed=u.speed,qt.start(e))}}};function Bt(t,e,n){return(w.string(t)?W(t,e,n):t)||y(n)}function Vt(t){return w.window(t)&&(t=window.document.body),{x:t.scrollLeft,y:t.scrollTop}}var Wt={id:"auto-scroll",install:function(t){var e=t.defaults,n=t.actions;t.autoScroll=qt,qt.now=function(){return t.now()},n.phaselessTypes.autoscroll=!0,e.perAction.autoScroll=qt.defaults},listeners:{"interactions:new":function(t){t.interaction.autoScroll=null},"interactions:destroy":function(t){t.interaction.autoScroll=null,qt.stop(),qt.interaction&&(qt.interaction=null)},"interactions:stop":qt.stop,"interactions:action-move":function(t){return qt.onInteractionMove(t)}}},Gt=Wt;function Nt(t,e){var n=!1;return function(){return n||(g.console.warn(e),n=!0),t.apply(this,arguments)}}function Ut(t,e){return t.name=e.name,t.axis=e.axis,t.edges=e.edges,t}function Ht(t){return w.bool(t)?(this.options.styleCursor=t,this):null===t?(delete this.options.styleCursor,this):this.options.styleCursor}function Kt(t){return w.func(t)?(this.options.actionChecker=t,this):null===t?(delete this.options.actionChecker,this):this.options.actionChecker}var $t={id:"auto-start/interactableMethods",install:function(t){var e=t.Interactable;e.prototype.getAction=function(e,n,r,i){var o=function(t,e,n,r,i){var o=t.getRect(r),a=e.buttons||{0:1,1:4,3:8,4:16}[e.button],s={action:null,interactable:t,interaction:n,element:r,rect:o,buttons:a};return i.fire("auto-start:check",s),s.action}(this,n,r,i,t);return this.options.actionChecker?this.options.actionChecker(e,n,o,this,i,r):o},e.prototype.ignoreFrom=Nt((function(t){return this._backCompatOption("ignoreFrom",t)}),"Interactable.ignoreFrom() has been deprecated. Use Interactble.draggable({ignoreFrom: newValue})."),e.prototype.allowFrom=Nt((function(t){return this._backCompatOption("allowFrom",t)}),"Interactable.allowFrom() has been deprecated. Use Interactble.draggable({allowFrom: newValue})."),e.prototype.actionChecker=Kt,e.prototype.styleCursor=Ht}};function Jt(t,e,n,r,i){return e.testIgnoreAllow(e.options[t.name],n,r)&&e.options[t.name].enabled&&ee(e,n,t,i)?t:null}function Qt(t,e,n,r,i,o,a){for(var s=0,c=r.length;s<c;s++){var l=r[s],u=i[s],p=l.getAction(e,n,t,u);if(p){var f=Jt(p,l,u,o,a);if(f)return{action:f,interactable:l,element:u}}}return{action:null,interactable:null,element:null}}function Zt(t,e,n,r,i){var o=[],a=[],s=r;function c(t){o.push(t),a.push(s)}for(;w.element(s);){o=[],a=[],i.interactables.forEachMatch(s,c);var l=Qt(t,e,n,o,a,r,i);if(l.action&&!l.interactable.options[l.action.name].manualStart)return l;s=A(s)}return{action:null,interactable:null,element:null}}function te(t,e,n){var r=e.action,i=e.interactable,o=e.element;r=r||{name:null},t.interactable=i,t.element=o,Ut(t.prepared,r),t.rect=i&&r.name?i.getRect(o):null,ie(t,n),n.fire("autoStart:prepared",{interaction:t})}function ee(t,e,n,r){var i=t.options,o=i[n.name].max,a=i[n.name].maxPerElement,s=r.autoStart.maxInteractions,c=0,l=0,u=0;if(!(o&&a&&s))return!1;for(var p=0,f=r.interactions.list;p<f.length;p++){var d=f[p],h=d.prepared.name;if(d.interacting()){if(++c>=s)return!1;if(d.interactable===t){if((l+=h===n.name?1:0)>=o)return!1;if(d.element===e&&(u++,h===n.name&&u>=a))return!1}}}return s>0}function ne(t,e){return w.number(t)?(e.autoStart.maxInteractions=t,this):e.autoStart.maxInteractions}function re(t,e,n){var r=n.autoStart.cursorElement;r&&r!==t&&(r.style.cursor=""),t.ownerDocument.documentElement.style.cursor=e,t.style.cursor=e,n.autoStart.cursorElement=e?t:null}function ie(t,e){var n=t.interactable,r=t.element,i=t.prepared;if("mouse"===t.pointerType&&n&&n.options.styleCursor){var o="";if(i.name){var a=n.options[i.name].cursorChecker;o=w.func(a)?a(i,n,r,t._interacting):e.actions.map[i.name].getCursor(i)}re(t.element,o||"",e)}else e.autoStart.cursorElement&&re(e.autoStart.cursorElement,"",e)}var oe={id:"auto-start/base",before:["actions"],install:function(t){var e=t.interactStatic,n=t.defaults;t.usePlugin($t),n.base.actionChecker=null,n.base.styleCursor=!0,V(n.perAction,{manualStart:!1,max:1/0,maxPerElement:1,allowFrom:null,ignoreFrom:null,mouseButtons:1}),e.maxInteractions=function(e){return ne(e,t)},t.autoStart={maxInteractions:1/0,withinInteractionLimit:ee,cursorElement:null}},listeners:{"interactions:down":function(t,e){var n=t.interaction,r=t.pointer,i=t.event,o=t.eventTarget;n.interacting()||te(n,Zt(n,r,i,o,e),e)},"interactions:move":function(t,e){!function(t,e){var n=t.interaction,r=t.pointer,i=t.event,o=t.eventTarget;"mouse"!==n.pointerType||n.pointerIsDown||n.interacting()||te(n,Zt(n,r,i,o,e),e)}(t,e),function(t,e){var n=t.interaction;if(n.pointerIsDown&&!n.interacting()&&n.pointerWasMoved&&n.prepared.name){e.fire("autoStart:before-start",t);var r=n.interactable,i=n.prepared.name;i&&r&&(r.options[i].manualStart||!ee(r,n.element,n.prepared,e)?n.stop():(n.start(n.prepared,r,n.element),ie(n,e)))}}(t,e)},"interactions:stop":function(t,e){var n=t.interaction,r=n.interactable;r&&r.options.styleCursor&&re(n.element,"",e)}},maxInteractions:ne,withinInteractionLimit:ee,validateAction:Jt},ae=oe;var se={id:"auto-start/dragAxis",listeners:{"autoStart:before-start":function(t,e){var n=t.interaction,r=t.eventTarget,i=t.dx,o=t.dy;if("drag"===n.prepared.name){var a=Math.abs(i),s=Math.abs(o),c=n.interactable.options.drag,l=c.startAxis,u=a>s?"x":a<s?"y":"xy";if(n.prepared.axis="start"===c.lockAxis?u[0]:c.lockAxis,"xy"!==u&&"xy"!==l&&l!==u){n.prepared.name=null;for(var p=r,f=function(t){if(t!==n.interactable){var i=n.interactable.options.drag;if(!i.manualStart&&t.testIgnoreAllow(i,p,r)){var o=t.getAction(n.downPointer,n.downEvent,n,p);if(o&&"drag"===o.name&&function(t,e){if(!e)return!1;var n=e.options.drag.startAxis;return"xy"===t||"xy"===n||n===t}(u,t)&&ae.validateAction(o,t,p,r,e))return t}}};w.element(p);){var d=e.interactables.forEachMatch(p,f);if(d){n.prepared.name="drag",n.interactable=d,n.element=p;break}p=A(p)}}}}}};function ce(t){var e=t.prepared&&t.prepared.name;if(!e)return null;var n=t.interactable.options;return n[e].hold||n[e].delay}var le={id:"auto-start/hold",install:function(t){var e=t.defaults;t.usePlugin(ae),e.perAction.hold=0,e.perAction.delay=0},listeners:{"interactions:new":function(t){t.interaction.autoStartHoldTimer=null},"autoStart:prepared":function(t){var e=t.interaction,n=ce(e);n>0&&(e.autoStartHoldTimer=setTimeout((function(){e.start(e.prepared,e.interactable,e.element)}),n))},"interactions:move":function(t){var e=t.interaction,n=t.duplicate;e.autoStartHoldTimer&&e.pointerWasMoved&&!n&&(clearTimeout(e.autoStartHoldTimer),e.autoStartHoldTimer=null)},"autoStart:before-start":function(t){var e=t.interaction;ce(e)>0&&(e.prepared.name=null)}},getHoldDuration:ce},ue=le,pe={id:"auto-start",install:function(t){t.usePlugin(ae),t.usePlugin(ue),t.usePlugin(se)}},fe=function(t){return/^(always|never|auto)$/.test(t)?(this.options.preventDefault=t,this):w.bool(t)?(this.options.preventDefault=t?"always":"never",this):this.options.preventDefault};function de(t){var e=t.interaction,n=t.event;e.interactable&&e.interactable.checkAndPreventDefault(n)}var he={id:"core/interactablePreventDefault",install:function(t){var e=t.Interactable;e.prototype.preventDefault=fe,e.prototype.checkAndPreventDefault=function(e){return function(t,e,n){var r=t.options.preventDefault;if("never"!==r)if("always"!==r){if(e.events.supportsPassive&&/^touch(start|move)$/.test(n.type)){var i=y(n.target).document,o=e.getDocOptions(i);if(!o||!o.events||!1!==o.events.passive)return}/^(mouse|pointer|touch)*(down|start)/i.test(n.type)||w.element(n.target)&&R(n.target,"input,select,textarea,[contenteditable=true],[contenteditable=true] *")||n.preventDefault()}else n.preventDefault()}(this,t,e)},t.interactions.docEvents.push({type:"dragstart",listener:function(e){for(var n=0,r=t.interactions.list;n<r.length;n++){var i=r[n];if(i.element&&(i.element===e.target||M(i.element,e.target)))return void i.interactable.checkAndPreventDefault(e)}}})},listeners:["down","move","up","cancel"].reduce((function(t,e){return t["interactions:".concat(e)]=de,t}),{})};function ve(t,e){if(e.phaselessTypes[t])return!0;for(var n in e.map)if(0===t.indexOf(n)&&t.substr(n.length)in e.phases)return!0;return!1}function ge(t){var e={};for(var n in t){var r=t[n];w.plainObject(r)?e[n]=ge(r):w.array(r)?e[n]=mt(r):e[n]=r}return e}var me=function(){function t(e){r(this,t),this.states=[],this.startOffset={left:0,right:0,top:0,bottom:0},this.startDelta=void 0,this.result=void 0,this.endResult=void 0,this.startEdges=void 0,this.edges=void 0,this.interaction=void 0,this.interaction=e,this.result=ye(),this.edges={left:!1,right:!1,top:!1,bottom:!1}}return o(t,[{key:"start",value:function(t,e){var n,r,i=t.phase,o=this.interaction,a=function(t){var e=t.interactable.options[t.prepared.name],n=e.modifiers;if(n&&n.length)return n;return["snap","snapSize","snapEdges","restrict","restrictEdges","restrictSize"].map((function(t){var n=e[t];return n&&n.enabled&&{options:n,methods:n._methods}})).filter((function(t){return!!t}))}(o);this.prepareStates(a),this.startEdges=V({},o.edges),this.edges=V({},this.startEdges),this.startOffset=(n=o.rect,r=e,n?{left:r.x-n.left,top:r.y-n.top,right:n.right-r.x,bottom:n.bottom-r.y}:{left:0,top:0,right:0,bottom:0}),this.startDelta={x:0,y:0};var s=this.fillArg({phase:i,pageCoords:e,preEnd:!1});return this.result=ye(),this.startAll(s),this.result=this.setAll(s)}},{key:"fillArg",value:function(t){var e=this.interaction;return t.interaction=e,t.interactable=e.interactable,t.element=e.element,t.rect||(t.rect=e.rect),t.edges||(t.edges=this.startEdges),t.startOffset=this.startOffset,t}},{key:"startAll",value:function(t){for(var e=0,n=this.states;e<n.length;e++){var r=n[e];r.methods.start&&(t.state=r,r.methods.start(t))}}},{key:"setAll",value:function(t){var e=t.phase,n=t.preEnd,r=t.skipModifiers,i=t.rect,o=t.edges;t.coords=V({},t.pageCoords),t.rect=V({},i),t.edges=V({},o);for(var a=r?this.states.slice(r):this.states,s=ye(t.coords,t.rect),c=0;c<a.length;c++){var l,u=a[c],p=u.options,f=V({},t.coords),d=null;null!=(l=u.methods)&&l.set&&this.shouldDo(p,n,e)&&(t.state=u,d=u.methods.set(t),H(t.edges,t.rect,{x:t.coords.x-f.x,y:t.coords.y-f.y})),s.eventProps.push(d)}V(this.edges,t.edges),s.delta.x=t.coords.x-t.pageCoords.x,s.delta.y=t.coords.y-t.pageCoords.y,s.rectDelta.left=t.rect.left-i.left,s.rectDelta.right=t.rect.right-i.right,s.rectDelta.top=t.rect.top-i.top,s.rectDelta.bottom=t.rect.bottom-i.bottom;var h=this.result.coords,v=this.result.rect;if(h&&v){var g=s.rect.left!==v.left||s.rect.right!==v.right||s.rect.top!==v.top||s.rect.bottom!==v.bottom;s.changed=g||h.x!==s.coords.x||h.y!==s.coords.y}return s}},{key:"applyToInteraction",value:function(t){var e=this.interaction,n=t.phase,r=e.coords.cur,i=e.coords.start,o=this.result,a=this.startDelta,s=o.delta;"start"===n&&V(this.startDelta,o.delta);for(var c=0,l=[[i,a],[r,s]];c<l.length;c++){var u=l[c],p=u[0],f=u[1];p.page.x+=f.x,p.page.y+=f.y,p.client.x+=f.x,p.client.y+=f.y}var d=this.result.rectDelta,h=t.rect||e.rect;h.left+=d.left,h.right+=d.right,h.top+=d.top,h.bottom+=d.bottom,h.width=h.right-h.left,h.height=h.bottom-h.top}},{key:"setAndApply",value:function(t){var e=this.interaction,n=t.phase,r=t.preEnd,i=t.skipModifiers,o=this.setAll(this.fillArg({preEnd:r,phase:n,pageCoords:t.modifiedCoords||e.coords.cur.page}));if(this.result=o,!o.changed&&(!i||i<this.states.length)&&e.interacting())return!1;if(t.modifiedCoords){var a=e.coords.cur.page,s={x:t.modifiedCoords.x-a.x,y:t.modifiedCoords.y-a.y};o.coords.x+=s.x,o.coords.y+=s.y,o.delta.x+=s.x,o.delta.y+=s.y}this.applyToInteraction(t)}},{key:"beforeEnd",value:function(t){var e=t.interaction,n=t.event,r=this.states;if(r&&r.length){for(var i=!1,o=0;o<r.length;o++){var a=r[o];t.state=a;var s=a.options,c=a.methods,l=c.beforeEnd&&c.beforeEnd(t);if(l)return this.endResult=l,!1;i=i||!i&&this.shouldDo(s,!0,t.phase,!0)}i&&e.move({event:n,preEnd:!0})}}},{key:"stop",value:function(t){var e=t.interaction;if(this.states&&this.states.length){var n=V({states:this.states,interactable:e.interactable,element:e.element,rect:null},t);this.fillArg(n);for(var r=0,i=this.states;r<i.length;r++){var o=i[r];n.state=o,o.methods.stop&&o.methods.stop(n)}this.states=null,this.endResult=null}}},{key:"prepareStates",value:function(t){this.states=[];for(var e=0;e<t.length;e++){var n=t[e],r=n.options,i=n.methods,o=n.name;this.states.push({options:r,methods:i,index:e,name:o})}return this.states}},{key:"restoreInteractionCoords",value:function(t){var e=t.interaction,n=e.coords,r=e.rect,i=e.modification;if(i.result){for(var o=i.startDelta,a=i.result,s=a.delta,c=a.rectDelta,l=0,u=[[n.start,o],[n.cur,s]];l<u.length;l++){var p=u[l],f=p[0],d=p[1];f.page.x-=d.x,f.page.y-=d.y,f.client.x-=d.x,f.client.y-=d.y}r.left-=c.left,r.right-=c.right,r.top-=c.top,r.bottom-=c.bottom}}},{key:"shouldDo",value:function(t,e,n,r){return!(!t||!1===t.enabled||r&&!t.endOnly||t.endOnly&&!e||"start"===n&&!t.setStart)}},{key:"copyFrom",value:function(t){this.startOffset=t.startOffset,this.startDelta=t.startDelta,this.startEdges=t.startEdges,this.edges=t.edges,this.states=t.states.map((function(t){return ge(t)})),this.result=ye(V({},t.result.coords),V({},t.result.rect))}},{key:"destroy",value:function(){for(var t in this)this[t]=null}}]),t}();function ye(t,e){return{rect:e,coords:t,delta:{x:0,y:0},rectDelta:{left:0,right:0,top:0,bottom:0},eventProps:[],changed:!0}}function be(t,e){var n=t.defaults,r={start:t.start,set:t.set,beforeEnd:t.beforeEnd,stop:t.stop},i=function(t){var i=t||{};for(var o in i.enabled=!1!==i.enabled,n)o in i||(i[o]=n[o]);var a={options:i,methods:r,name:e,enable:function(){return i.enabled=!0,a},disable:function(){return i.enabled=!1,a}};return a};return e&&"string"==typeof e&&(i._defaults=n,i._methods=r),i}function xe(t){var e=t.iEvent,n=t.interaction.modification.result;n&&(e.modifiers=n.eventProps)}var we={id:"modifiers/base",before:["actions"],install:function(t){t.defaults.perAction.modifiers=[]},listeners:{"interactions:new":function(t){var e=t.interaction;e.modification=new me(e)},"interactions:before-action-start":function(t){var e=t.interaction,n=t.interaction.modification;n.start(t,e.coords.start.page),e.edges=n.edges,n.applyToInteraction(t)},"interactions:before-action-move":function(t){var e=t.interaction,n=e.modification,r=n.setAndApply(t);return e.edges=n.edges,r},"interactions:before-action-end":function(t){var e=t.interaction,n=e.modification,r=n.beforeEnd(t);return e.edges=n.startEdges,r},"interactions:action-start":xe,"interactions:action-move":xe,"interactions:action-end":xe,"interactions:after-action-start":function(t){return t.interaction.modification.restoreInteractionCoords(t)},"interactions:after-action-move":function(t){return t.interaction.modification.restoreInteractionCoords(t)},"interactions:stop":function(t){return t.interaction.modification.stop(t)}}},Ee=we,Te={base:{preventDefault:"auto",deltaSource:"page"},perAction:{enabled:!1,origin:{x:0,y:0}},actions:{}},Se=function(t){s(n,t);var e=p(n);function n(t,i,o,a,s,c,l){var p;r(this,n),(p=e.call(this,t)).relatedTarget=null,p.screenX=void 0,p.screenY=void 0,p.button=void 0,p.buttons=void 0,p.ctrlKey=void 0,p.shiftKey=void 0,p.altKey=void 0,p.metaKey=void 0,p.page=void 0,p.client=void 0,p.delta=void 0,p.rect=void 0,p.x0=void 0,p.y0=void 0,p.t0=void 0,p.dt=void 0,p.duration=void 0,p.clientX0=void 0,p.clientY0=void 0,p.velocity=void 0,p.speed=void 0,p.swipe=void 0,p.axes=void 0,p.preEnd=void 0,s=s||t.element;var f=t.interactable,d=(f&&f.options||Te).deltaSource,h=K(f,s,o),v="start"===a,g="end"===a,m=v?u(p):t.prevEvent,y=v?t.coords.start:g?{page:m.page,client:m.client,timeStamp:t.coords.cur.timeStamp}:t.coords.cur;return p.page=V({},y.page),p.client=V({},y.client),p.rect=V({},t.rect),p.timeStamp=y.timeStamp,g||(p.page.x-=h.x,p.page.y-=h.y,p.client.x-=h.x,p.client.y-=h.y),p.ctrlKey=i.ctrlKey,p.altKey=i.altKey,p.shiftKey=i.shiftKey,p.metaKey=i.metaKey,p.button=i.button,p.buttons=i.buttons,p.target=s,p.currentTarget=s,p.preEnd=c,p.type=l||o+(a||""),p.interactable=f,p.t0=v?t.pointers[t.pointers.length-1].downTime:m.t0,p.x0=t.coords.start.page.x-h.x,p.y0=t.coords.start.page.y-h.y,p.clientX0=t.coords.start.client.x-h.x,p.clientY0=t.coords.start.client.y-h.y,p.delta=v||g?{x:0,y:0}:{x:p[d].x-m[d].x,y:p[d].y-m[d].y},p.dt=t.coords.delta.timeStamp,p.duration=p.timeStamp-p.t0,p.velocity=V({},t.coords.velocity[d]),p.speed=Q(p.velocity.x,p.velocity.y),p.swipe=g||"inertiastart"===a?p.getSwipe():null,p}return o(n,[{key:"getSwipe",value:function(){var t=this._interaction;if(t.prevEvent.speed<600||this.timeStamp-t.prevEvent.timeStamp>150)return null;var e=180*Math.atan2(t.prevEvent.velocityY,t.prevEvent.velocityX)/Math.PI;e<0&&(e+=360);var n=112.5<=e&&e<247.5,r=202.5<=e&&e<337.5;return{up:r,down:!r&&22.5<=e&&e<157.5,left:n,right:!n&&(292.5<=e||e<67.5),angle:e,speed:t.prevEvent.speed,velocity:{x:t.prevEvent.velocityX,y:t.prevEvent.velocityY}}}},{key:"preventDefault",value:function(){}},{key:"stopImmediatePropagation",value:function(){this.immediatePropagationStopped=this.propagationStopped=!0}},{key:"stopPropagation",value:function(){this.propagationStopped=!0}}]),n}(vt);Object.defineProperties(Se.prototype,{pageX:{get:function(){return this.page.x},set:function(t){this.page.x=t}},pageY:{get:function(){return this.page.y},set:function(t){this.page.y=t}},clientX:{get:function(){return this.client.x},set:function(t){this.client.x=t}},clientY:{get:function(){return this.client.y},set:function(t){this.client.y=t}},dx:{get:function(){return this.delta.x},set:function(t){this.delta.x=t}},dy:{get:function(){return this.delta.y},set:function(t){this.delta.y=t}},velocityX:{get:function(){return this.velocity.x},set:function(t){this.velocity.x=t}},velocityY:{get:function(){return this.velocity.y},set:function(t){this.velocity.y=t}}});var _e=o((function t(e,n,i,o,a){r(this,t),this.id=void 0,this.pointer=void 0,this.event=void 0,this.downTime=void 0,this.downTarget=void 0,this.id=e,this.pointer=n,this.event=i,this.downTime=o,this.downTarget=a})),Pe=function(t){return t.interactable="",t.element="",t.prepared="",t.pointerIsDown="",t.pointerWasMoved="",t._proxy="",t}({}),Oe=function(t){return t.start="",t.move="",t.end="",t.stop="",t.interacting="",t}({}),ke=0,De=function(){function t(e){var n=this,i=e.pointerType,o=e.scopeFire;r(this,t),this.interactable=null,this.element=null,this.rect=null,this._rects=void 0,this.edges=null,this._scopeFire=void 0,this.prepared={name:null,axis:null,edges:null},this.pointerType=void 0,this.pointers=[],this.downEvent=null,this.downPointer={},this._latestPointer={pointer:null,event:null,eventTarget:null},this.prevEvent=null,this.pointerIsDown=!1,this.pointerWasMoved=!1,this._interacting=!1,this._ending=!1,this._stopped=!0,this._proxy=void 0,this.simulation=null,this.doMove=Nt((function(t){this.move(t)}),"The interaction.doMove() method has been renamed to interaction.move()"),this.coords={start:{page:{x:0,y:0},client:{x:0,y:0},timeStamp:0},prev:{page:{x:0,y:0},client:{x:0,y:0},timeStamp:0},cur:{page:{x:0,y:0},client:{x:0,y:0},timeStamp:0},delta:{page:{x:0,y:0},client:{x:0,y:0},timeStamp:0},velocity:{page:{x:0,y:0},client:{x:0,y:0},timeStamp:0}},this._id=ke++,this._scopeFire=o,this.pointerType=i;var a=this;this._proxy={};var s=function(t){Object.defineProperty(n._proxy,t,{get:function(){return a[t]}})};for(var c in Pe)s(c);var l=function(t){Object.defineProperty(n._proxy,t,{value:function(){return a[t].apply(a,arguments)}})};for(var u in Oe)l(u);this._scopeFire("interactions:new",{interaction:this})}return o(t,[{key:"pointerMoveTolerance",get:function(){return 1}},{key:"pointerDown",value:function(t,e,n){var r=this.updatePointer(t,e,n,!0),i=this.pointers[r];this._scopeFire("interactions:down",{pointer:t,event:e,eventTarget:n,pointerIndex:r,pointerInfo:i,type:"down",interaction:this})}},{key:"start",value:function(t,e,n){return!(this.interacting()||!this.pointerIsDown||this.pointers.length<("gesture"===t.name?2:1)||!e.options[t.name].enabled)&&(Ut(this.prepared,t),this.interactable=e,this.element=n,this.rect=e.getRect(n),this.edges=this.prepared.edges?V({},this.prepared.edges):{left:!0,right:!0,top:!0,bottom:!0},this._stopped=!1,this._interacting=this._doPhase({interaction:this,event:this.downEvent,phase:"start"})&&!this._stopped,this._interacting)}},{key:"pointerMove",value:function(t,e,n){this.simulation||this.modification&&this.modification.endResult||this.updatePointer(t,e,n,!1);var r,i,o=this.coords.cur.page.x===this.coords.prev.page.x&&this.coords.cur.page.y===this.coords.prev.page.y&&this.coords.cur.client.x===this.coords.prev.client.x&&this.coords.cur.client.y===this.coords.prev.client.y;this.pointerIsDown&&!this.pointerWasMoved&&(r=this.coords.cur.client.x-this.coords.start.client.x,i=this.coords.cur.client.y-this.coords.start.client.y,this.pointerWasMoved=Q(r,i)>this.pointerMoveTolerance);var a,s,c,l=this.getPointerIndex(t),u={pointer:t,pointerIndex:l,pointerInfo:this.pointers[l],event:e,type:"move",eventTarget:n,dx:r,dy:i,duplicate:o,interaction:this};o||(a=this.coords.velocity,s=this.coords.delta,c=Math.max(s.timeStamp/1e3,.001),a.page.x=s.page.x/c,a.page.y=s.page.y/c,a.client.x=s.client.x/c,a.client.y=s.client.y/c,a.timeStamp=c),this._scopeFire("interactions:move",u),o||this.simulation||(this.interacting()&&(u.type=null,this.move(u)),this.pointerWasMoved&&et(this.coords.prev,this.coords.cur))}},{key:"move",value:function(t){t&&t.event||nt(this.coords.delta),(t=V({pointer:this._latestPointer.pointer,event:this._latestPointer.event,eventTarget:this._latestPointer.eventTarget,interaction:this},t||{})).phase="move",this._doPhase(t)}},{key:"pointerUp",value:function(t,e,n,r){var i=this.getPointerIndex(t);-1===i&&(i=this.updatePointer(t,e,n,!1));var o=/cancel$/i.test(e.type)?"cancel":"up";this._scopeFire("interactions:".concat(o),{pointer:t,pointerIndex:i,pointerInfo:this.pointers[i],event:e,eventTarget:n,type:o,curEventTarget:r,interaction:this}),this.simulation||this.end(e),this.removePointer(t,e)}},{key:"documentBlur",value:function(t){this.end(t),this._scopeFire("interactions:blur",{event:t,type:"blur",interaction:this})}},{key:"end",value:function(t){var e;this._ending=!0,t=t||this._latestPointer.event,this.interacting()&&(e=this._doPhase({event:t,interaction:this,phase:"end"})),this._ending=!1,!0===e&&this.stop()}},{key:"currentAction",value:function(){return this._interacting?this.prepared.name:null}},{key:"interacting",value:function(){return this._interacting}},{key:"stop",value:function(){this._scopeFire("interactions:stop",{interaction:this}),this.interactable=this.element=null,this._interacting=!1,this._stopped=!0,this.prepared.name=this.prevEvent=null}},{key:"getPointerIndex",value:function(t){var e=at(t);return"mouse"===this.pointerType||"pen"===this.pointerType?this.pointers.length-1:yt(this.pointers,(function(t){return t.id===e}))}},{key:"getPointerInfo",value:function(t){return this.pointers[this.getPointerIndex(t)]}},{key:"updatePointer",value:function(t,e,n,r){var i,o,a,s=at(t),c=this.getPointerIndex(t),l=this.pointers[c];return r=!1!==r&&(r||/(down|start)$/i.test(e.type)),l?l.pointer=t:(l=new _e(s,t,e,null,null),c=this.pointers.length,this.pointers.push(l)),st(this.coords.cur,this.pointers.map((function(t){return t.pointer})),this._now()),i=this.coords.delta,o=this.coords.prev,a=this.coords.cur,i.page.x=a.page.x-o.page.x,i.page.y=a.page.y-o.page.y,i.client.x=a.client.x-o.client.x,i.client.y=a.client.y-o.client.y,i.timeStamp=a.timeStamp-o.timeStamp,r&&(this.pointerIsDown=!0,l.downTime=this.coords.cur.timeStamp,l.downTarget=n,tt(this.downPointer,t),this.interacting()||(et(this.coords.start,this.coords.cur),et(this.coords.prev,this.coords.cur),this.downEvent=e,this.pointerWasMoved=!1)),this._updateLatestPointer(t,e,n),this._scopeFire("interactions:update-pointer",{pointer:t,event:e,eventTarget:n,down:r,pointerInfo:l,pointerIndex:c,interaction:this}),c}},{key:"removePointer",value:function(t,e){var n=this.getPointerIndex(t);if(-1!==n){var r=this.pointers[n];this._scopeFire("interactions:remove-pointer",{pointer:t,event:e,eventTarget:null,pointerIndex:n,pointerInfo:r,interaction:this}),this.pointers.splice(n,1),this.pointerIsDown=!1}}},{key:"_updateLatestPointer",value:function(t,e,n){this._latestPointer.pointer=t,this._latestPointer.event=e,this._latestPointer.eventTarget=n}},{key:"destroy",value:function(){this._latestPointer.pointer=null,this._latestPointer.event=null,this._latestPointer.eventTarget=null}},{key:"_createPreparedEvent",value:function(t,e,n,r){return new Se(this,t,this.prepared.name,e,this.element,n,r)}},{key:"_fireEvent",value:function(t){var e;null==(e=this.interactable)||e.fire(t),(!this.prevEvent||t.timeStamp>=this.prevEvent.timeStamp)&&(this.prevEvent=t)}},{key:"_doPhase",value:function(t){var e=t.event,n=t.phase,r=t.preEnd,i=t.type,o=this.rect;if(o&&"move"===n&&(H(this.edges,o,this.coords.delta[this.interactable.options.deltaSource]),o.width=o.right-o.left,o.height=o.bottom-o.top),!1===this._scopeFire("interactions:before-action-".concat(n),t))return!1;var a=t.iEvent=this._createPreparedEvent(e,n,r,i);return this._scopeFire("interactions:action-".concat(n),t),"start"===n&&(this.prevEvent=a),this._fireEvent(a),this._scopeFire("interactions:after-action-".concat(n),t),!0}},{key:"_now",value:function(){return Date.now()}}]),t}();function Ie(t){Me(t.interaction)}function Me(t){if(!function(t){return!(!t.offset.pending.x&&!t.offset.pending.y)}(t))return!1;var e=t.offset.pending;return Ae(t.coords.cur,e),Ae(t.coords.delta,e),H(t.edges,t.rect,e),e.x=0,e.y=0,!0}function ze(t){var e=t.x,n=t.y;this.offset.pending.x+=e,this.offset.pending.y+=n,this.offset.total.x+=e,this.offset.total.y+=n}function Ae(t,e){var n=t.page,r=t.client,i=e.x,o=e.y;n.x+=i,n.y+=o,r.x+=i,r.y+=o}Oe.offsetBy="";var Re={id:"offset",before:["modifiers","pointer-events","actions","inertia"],install:function(t){t.Interaction.prototype.offsetBy=ze},listeners:{"interactions:new":function(t){t.interaction.offset={total:{x:0,y:0},pending:{x:0,y:0}}},"interactions:update-pointer":function(t){return function(t){t.pointerIsDown&&(Ae(t.coords.cur,t.offset.total),t.offset.pending.x=0,t.offset.pending.y=0)}(t.interaction)},"interactions:before-action-start":Ie,"interactions:before-action-move":Ie,"interactions:before-action-end":function(t){var e=t.interaction;if(Me(e))return e.move({offset:!0}),e.end(),!1},"interactions:stop":function(t){var e=t.interaction;e.offset.total.x=0,e.offset.total.y=0,e.offset.pending.x=0,e.offset.pending.y=0}}},Ce=Re;var je=function(){function t(e){r(this,t),this.active=!1,this.isModified=!1,this.smoothEnd=!1,this.allowResume=!1,this.modification=void 0,this.modifierCount=0,this.modifierArg=void 0,this.startCoords=void 0,this.t0=0,this.v0=0,this.te=0,this.targetOffset=void 0,this.modifiedOffset=void 0,this.currentOffset=void 0,this.lambda_v0=0,this.one_ve_v0=0,this.timeout=void 0,this.interaction=void 0,this.interaction=e}return o(t,[{key:"start",value:function(t){var e=this.interaction,n=Fe(e);if(!n||!n.enabled)return!1;var r=e.coords.velocity.client,i=Q(r.x,r.y),o=this.modification||(this.modification=new me(e));if(o.copyFrom(e.modification),this.t0=e._now(),this.allowResume=n.allowResume,this.v0=i,this.currentOffset={x:0,y:0},this.startCoords=e.coords.cur.page,this.modifierArg=o.fillArg({pageCoords:this.startCoords,preEnd:!0,phase:"inertiastart"}),this.t0-e.coords.cur.timeStamp<50&&i>n.minSpeed&&i>n.endSpeed)this.startInertia();else{if(o.result=o.setAll(this.modifierArg),!o.result.changed)return!1;this.startSmoothEnd()}return e.modification.result.rect=null,e.offsetBy(this.targetOffset),e._doPhase({interaction:e,event:t,phase:"inertiastart"}),e.offsetBy({x:-this.targetOffset.x,y:-this.targetOffset.y}),e.modification.result.rect=null,this.active=!0,e.simulation=this,!0}},{key:"startInertia",value:function(){var t=this,e=this.interaction.coords.velocity.client,n=Fe(this.interaction),r=n.resistance,i=-Math.log(n.endSpeed/this.v0)/r;this.targetOffset={x:(e.x-i)/r,y:(e.y-i)/r},this.te=i,this.lambda_v0=r/this.v0,this.one_ve_v0=1-n.endSpeed/this.v0;var o=this.modification,a=this.modifierArg;a.pageCoords={x:this.startCoords.x+this.targetOffset.x,y:this.startCoords.y+this.targetOffset.y},o.result=o.setAll(a),o.result.changed&&(this.isModified=!0,this.modifiedOffset={x:this.targetOffset.x+o.result.delta.x,y:this.targetOffset.y+o.result.delta.y}),this.onNextFrame((function(){return t.inertiaTick()}))}},{key:"startSmoothEnd",value:function(){var t=this;this.smoothEnd=!0,this.isModified=!0,this.targetOffset={x:this.modification.result.delta.x,y:this.modification.result.delta.y},this.onNextFrame((function(){return t.smoothEndTick()}))}},{key:"onNextFrame",value:function(t){var e=this;this.timeout=Lt.request((function(){e.active&&t()}))}},{key:"inertiaTick",value:function(){var t,e,n,r,i,o,a,s=this,c=this.interaction,l=Fe(c).resistance,u=(c._now()-this.t0)/1e3;if(u<this.te){var p,f=1-(Math.exp(-l*u)-this.lambda_v0)/this.one_ve_v0;this.isModified?(t=0,e=0,n=this.targetOffset.x,r=this.targetOffset.y,i=this.modifiedOffset.x,o=this.modifiedOffset.y,p={x:Ye(a=f,t,n,i),y:Ye(a,e,r,o)}):p={x:this.targetOffset.x*f,y:this.targetOffset.y*f};var d={x:p.x-this.currentOffset.x,y:p.y-this.currentOffset.y};this.currentOffset.x+=d.x,this.currentOffset.y+=d.y,c.offsetBy(d),c.move(),this.onNextFrame((function(){return s.inertiaTick()}))}else c.offsetBy({x:this.modifiedOffset.x-this.currentOffset.x,y:this.modifiedOffset.y-this.currentOffset.y}),this.end()}},{key:"smoothEndTick",value:function(){var t=this,e=this.interaction,n=e._now()-this.t0,r=Fe(e).smoothEndDuration;if(n<r){var i={x:Le(n,0,this.targetOffset.x,r),y:Le(n,0,this.targetOffset.y,r)},o={x:i.x-this.currentOffset.x,y:i.y-this.currentOffset.y};this.currentOffset.x+=o.x,this.currentOffset.y+=o.y,e.offsetBy(o),e.move({skipModifiers:this.modifierCount}),this.onNextFrame((function(){return t.smoothEndTick()}))}else e.offsetBy({x:this.targetOffset.x-this.currentOffset.x,y:this.targetOffset.y-this.currentOffset.y}),this.end()}},{key:"resume",value:function(t){var e=t.pointer,n=t.event,r=t.eventTarget,i=this.interaction;i.offsetBy({x:-this.currentOffset.x,y:-this.currentOffset.y}),i.updatePointer(e,n,r,!0),i._doPhase({interaction:i,event:n,phase:"resume"}),et(i.coords.prev,i.coords.cur),this.stop()}},{key:"end",value:function(){this.interaction.move(),this.interaction.end(),this.stop()}},{key:"stop",value:function(){this.active=this.smoothEnd=!1,this.interaction.simulation=null,Lt.cancel(this.timeout)}}]),t}();function Fe(t){var e=t.interactable,n=t.prepared;return e&&e.options&&n.name&&e.options[n.name].inertia}var Xe={id:"inertia",before:["modifiers","actions"],install:function(t){var e=t.defaults;t.usePlugin(Ce),t.usePlugin(Ee),t.actions.phases.inertiastart=!0,t.actions.phases.resume=!0,e.perAction.inertia={enabled:!1,resistance:10,minSpeed:100,endSpeed:10,allowResume:!0,smoothEndDuration:300}},listeners:{"interactions:new":function(t){var e=t.interaction;e.inertia=new je(e)},"interactions:before-action-end":function(t){var e=t.interaction,n=t.event;return(!e._interacting||e.simulation||!e.inertia.start(n))&&null},"interactions:down":function(t){var e=t.interaction,n=t.eventTarget,r=e.inertia;if(r.active)for(var i=n;w.element(i);){if(i===e.element){r.resume(t);break}i=A(i)}},"interactions:stop":function(t){var e=t.interaction.inertia;e.active&&e.stop()},"interactions:before-action-resume":function(t){var e=t.interaction.modification;e.stop(t),e.start(t,t.interaction.coords.cur.page),e.applyToInteraction(t)},"interactions:before-action-inertiastart":function(t){return t.interaction.modification.setAndApply(t)},"interactions:action-resume":xe,"interactions:action-inertiastart":xe,"interactions:after-action-inertiastart":function(t){return t.interaction.modification.restoreInteractionCoords(t)},"interactions:after-action-resume":function(t){return t.interaction.modification.restoreInteractionCoords(t)}}};function Ye(t,e,n,r){var i=1-t;return i*i*e+2*i*t*n+t*t*r}function Le(t,e,n,r){return-n*(t/=r)*(t-2)+e}var qe=Xe;function Be(t,e){for(var n=0;n<e.length;n++){var r=e[n];if(t.immediatePropagationStopped)break;r(t)}}var Ve=function(){function t(e){r(this,t),this.options=void 0,this.types={},this.propagationStopped=!1,this.immediatePropagationStopped=!1,this.global=void 0,this.options=V({},e||{})}return o(t,[{key:"fire",value:function(t){var e,n=this.global;(e=this.types[t.type])&&Be(t,e),!t.propagationStopped&&n&&(e=n[t.type])&&Be(t,e)}},{key:"on",value:function(t,e){var n=$(t,e);for(t in n)this.types[t]=gt(this.types[t]||[],n[t])}},{key:"off",value:function(t,e){var n=$(t,e);for(t in n){var r=this.types[t];if(r&&r.length)for(var i=0,o=n[t];i<o.length;i++){var a=o[i],s=r.indexOf(a);-1!==s&&r.splice(s,1)}}}},{key:"getRect",value:function(t){return null}}]),t}();var We=function(){function t(e){r(this,t),this.currentTarget=void 0,this.originalEvent=void 0,this.type=void 0,this.originalEvent=e,tt(this,e)}return o(t,[{key:"preventOriginalDefault",value:function(){this.originalEvent.preventDefault()}},{key:"stopPropagation",value:function(){this.originalEvent.stopPropagation()}},{key:"stopImmediatePropagation",value:function(){this.originalEvent.stopImmediatePropagation()}}]),t}();function Ge(t){return w.object(t)?{capture:!!t.capture,passive:!!t.passive}:{capture:!!t,passive:!1}}function Ne(t,e){return t===e||("boolean"==typeof t?!!e.capture===t&&!1==!!e.passive:!!t.capture==!!e.capture&&!!t.passive==!!e.passive)}var Ue={id:"events",install:function(t){var e,n=[],r={},i=[],o={add:a,remove:s,addDelegate:function(t,e,n,o,s){var u=Ge(s);if(!r[n]){r[n]=[];for(var p=0;p<i.length;p++){var f=i[p];a(f,n,c),a(f,n,l,!0)}}var d=r[n],h=bt(d,(function(n){return n.selector===t&&n.context===e}));h||(h={selector:t,context:e,listeners:[]},d.push(h));h.listeners.push({func:o,options:u})},removeDelegate:function(t,e,n,i,o){var a,u=Ge(o),p=r[n],f=!1;if(!p)return;for(a=p.length-1;a>=0;a--){var d=p[a];if(d.selector===t&&d.context===e){for(var h=d.listeners,v=h.length-1;v>=0;v--){var g=h[v];if(g.func===i&&Ne(g.options,u)){h.splice(v,1),h.length||(p.splice(a,1),s(e,n,c),s(e,n,l,!0)),f=!0;break}}if(f)break}}},delegateListener:c,delegateUseCapture:l,delegatedEvents:r,documents:i,targets:n,supportsOptions:!1,supportsPassive:!1};function a(t,e,r,i){if(t.addEventListener){var a=Ge(i),s=bt(n,(function(e){return e.eventTarget===t}));s||(s={eventTarget:t,events:{}},n.push(s)),s.events[e]||(s.events[e]=[]),bt(s.events[e],(function(t){return t.func===r&&Ne(t.options,a)}))||(t.addEventListener(e,r,o.supportsOptions?a:a.capture),s.events[e].push({func:r,options:a}))}}function s(t,e,r,i){if(t.addEventListener&&t.removeEventListener){var a=yt(n,(function(e){return e.eventTarget===t})),c=n[a];if(c&&c.events)if("all"!==e){var l=!1,u=c.events[e];if(u){if("all"===r){for(var p=u.length-1;p>=0;p--){var f=u[p];s(t,e,f.func,f.options)}return}for(var d=Ge(i),h=0;h<u.length;h++){var v=u[h];if(v.func===r&&Ne(v.options,d)){t.removeEventListener(e,r,o.supportsOptions?d:d.capture),u.splice(h,1),0===u.length&&(delete c.events[e],l=!0);break}}}l&&!Object.keys(c.events).length&&n.splice(a,1)}else for(e in c.events)c.events.hasOwnProperty(e)&&s(t,e,"all")}}function c(t,e){for(var n=Ge(e),i=new We(t),o=r[t.type],a=ht(t)[0],s=a;w.element(s);){for(var c=0;c<o.length;c++){var l=o[c],u=l.selector,p=l.context;if(R(s,u)&&M(p,a)&&M(p,s)){var f=l.listeners;i.currentTarget=s;for(var d=0;d<f.length;d++){var h=f[d];Ne(h.options,n)&&h.func(i)}}}s=A(s)}}function l(t){return c(t,!0)}return null==(e=t.document)||e.createElement("div").addEventListener("test",null,{get capture(){return o.supportsOptions=!0},get passive(){return o.supportsPassive=!0}}),t.events=o,o}},He={methodOrder:["simulationResume","mouseOrPen","hasPointer","idle"],search:function(t){for(var e=0,n=He.methodOrder;e<n.length;e++){var r=n[e],i=He[r](t);if(i)return i}return null},simulationResume:function(t){var e=t.pointerType,n=t.eventType,r=t.eventTarget,i=t.scope;if(!/down|start/i.test(n))return null;for(var o=0,a=i.interactions.list;o<a.length;o++){var s=a[o],c=r;if(s.simulation&&s.simulation.allowResume&&s.pointerType===e)for(;c;){if(c===s.element)return s;c=A(c)}}return null},mouseOrPen:function(t){var e,n=t.pointerId,r=t.pointerType,i=t.eventType,o=t.scope;if("mouse"!==r&&"pen"!==r)return null;for(var a=0,s=o.interactions.list;a<s.length;a++){var c=s[a];if(c.pointerType===r){if(c.simulation&&!Ke(c,n))continue;if(c.interacting())return c;e||(e=c)}}if(e)return e;for(var l=0,u=o.interactions.list;l<u.length;l++){var p=u[l];if(!(p.pointerType!==r||/down/i.test(i)&&p.simulation))return p}return null},hasPointer:function(t){for(var e=t.pointerId,n=0,r=t.scope.interactions.list;n<r.length;n++){var i=r[n];if(Ke(i,e))return i}return null},idle:function(t){for(var e=t.pointerType,n=0,r=t.scope.interactions.list;n<r.length;n++){var i=r[n];if(1===i.pointers.length){var o=i.interactable;if(o&&(!o.options.gesture||!o.options.gesture.enabled))continue}else if(i.pointers.length>=2)continue;if(!i.interacting()&&e===i.pointerType)return i}return null}};function Ke(t,e){return t.pointers.some((function(t){return t.id===e}))}var $e=He,Je=["pointerDown","pointerMove","pointerUp","updatePointer","removePointer","windowBlur"];function Qe(t,e){return function(n){var r=e.interactions.list,i=dt(n),o=ht(n),a=o[0],s=o[1],c=[];if(/^touch/.test(n.type)){e.prevTouchTime=e.now();for(var l=0,u=n.changedTouches;l<u.length;l++){var p=u[l],f={pointer:p,pointerId:at(p),pointerType:i,eventType:n.type,eventTarget:a,curEventTarget:s,scope:e},d=Ze(f);c.push([f.pointer,f.eventTarget,f.curEventTarget,d])}}else{var h=!1;if(!I.supportsPointerEvent&&/mouse/.test(n.type)){for(var v=0;v<r.length&&!h;v++)h="mouse"!==r[v].pointerType&&r[v].pointerIsDown;h=h||e.now()-e.prevTouchTime<500||0===n.timeStamp}if(!h){var g={pointer:n,pointerId:at(n),pointerType:i,eventType:n.type,curEventTarget:s,eventTarget:a,scope:e},m=Ze(g);c.push([g.pointer,g.eventTarget,g.curEventTarget,m])}}for(var y=0;y<c.length;y++){var b=c[y],x=b[0],w=b[1],E=b[2];b[3][t](x,n,w,E)}}}function Ze(t){var e=t.pointerType,n=t.scope,r={interaction:$e.search(t),searchDetails:t};return n.fire("interactions:find",r),r.interaction||n.interactions.new({pointerType:e})}function tn(t,e){var n=t.doc,r=t.scope,i=t.options,o=r.interactions.docEvents,a=r.events,s=a[e];for(var c in r.browser.isIOS&&!i.events&&(i.events={passive:!1}),a.delegatedEvents)s(n,c,a.delegateListener),s(n,c,a.delegateUseCapture,!0);for(var l=i&&i.events,u=0;u<o.length;u++){var p=o[u];s(n,p.type,p.listener,l)}}var en={id:"core/interactions",install:function(t){for(var e={},n=0;n<Je.length;n++){var i=Je[n];e[i]=Qe(i,t)}var a,c=I.pEventTypes;function l(){for(var e=0,n=t.interactions.list;e<n.length;e++){var r=n[e];if(r.pointerIsDown&&"touch"===r.pointerType&&!r._interacting)for(var i=function(){var e=a[o];t.documents.some((function(t){return M(t.doc,e.downTarget)}))||r.removePointer(e.pointer,e.event)},o=0,a=r.pointers;o<a.length;o++)i()}}(a=k.PointerEvent?[{type:c.down,listener:l},{type:c.down,listener:e.pointerDown},{type:c.move,listener:e.pointerMove},{type:c.up,listener:e.pointerUp},{type:c.cancel,listener:e.pointerUp}]:[{type:"mousedown",listener:e.pointerDown},{type:"mousemove",listener:e.pointerMove},{type:"mouseup",listener:e.pointerUp},{type:"touchstart",listener:l},{type:"touchstart",listener:e.pointerDown},{type:"touchmove",listener:e.pointerMove},{type:"touchend",listener:e.pointerUp},{type:"touchcancel",listener:e.pointerUp}]).push({type:"blur",listener:function(e){for(var n=0,r=t.interactions.list;n<r.length;n++){r[n].documentBlur(e)}}}),t.prevTouchTime=0,t.Interaction=function(e){s(i,e);var n=p(i);function i(){return r(this,i),n.apply(this,arguments)}return o(i,[{key:"pointerMoveTolerance",get:function(){return t.interactions.pointerMoveTolerance},set:function(e){t.interactions.pointerMoveTolerance=e}},{key:"_now",value:function(){return t.now()}}]),i}(De),t.interactions={list:[],new:function(e){e.scopeFire=function(e,n){return t.fire(e,n)};var n=new t.Interaction(e);return t.interactions.list.push(n),n},listeners:e,docEvents:a,pointerMoveTolerance:1},t.usePlugin(he)},listeners:{"scope:add-document":function(t){return tn(t,"add")},"scope:remove-document":function(t){return tn(t,"remove")},"interactable:unset":function(t,e){for(var n=t.interactable,r=e.interactions.list.length-1;r>=0;r--){var i=e.interactions.list[r];i.interactable===n&&(i.stop(),e.fire("interactions:destroy",{interaction:i}),i.destroy(),e.interactions.list.length>2&&e.interactions.list.splice(r,1))}}},onDocSignal:tn,doOnInteractions:Qe,methodNames:Je},nn=en,rn=function(t){return t[t.On=0]="On",t[t.Off=1]="Off",t}(rn||{}),on=function(){function t(e,n,i,o){r(this,t),this.target=void 0,this.options=void 0,this._actions=void 0,this.events=new Ve,this._context=void 0,this._win=void 0,this._doc=void 0,this._scopeEvents=void 0,this._actions=n.actions,this.target=e,this._context=n.context||i,this._win=y(B(e)?this._context:e),this._doc=this._win.document,this._scopeEvents=o,this.set(n)}return o(t,[{key:"_defaults",get:function(){return{base:{},perAction:{},actions:{}}}},{key:"setOnEvents",value:function(t,e){return w.func(e.onstart)&&this.on("".concat(t,"start"),e.onstart),w.func(e.onmove)&&this.on("".concat(t,"move"),e.onmove),w.func(e.onend)&&this.on("".concat(t,"end"),e.onend),w.func(e.oninertiastart)&&this.on("".concat(t,"inertiastart"),e.oninertiastart),this}},{key:"updatePerActionListeners",value:function(t,e,n){var r,i=this,o=null==(r=this._actions.map[t])?void 0:r.filterEventType,a=function(t){return(null==o||o(t))&&ve(t,i._actions)};(w.array(e)||w.object(e))&&this._onOff(rn.Off,t,e,void 0,a),(w.array(n)||w.object(n))&&this._onOff(rn.On,t,n,void 0,a)}},{key:"setPerAction",value:function(t,e){var n=this._defaults;for(var r in e){var i=r,o=this.options[t],a=e[i];"listeners"===i&&this.updatePerActionListeners(t,o.listeners,a),w.array(a)?o[i]=mt(a):w.plainObject(a)?(o[i]=V(o[i]||{},ge(a)),w.object(n.perAction[i])&&"enabled"in n.perAction[i]&&(o[i].enabled=!1!==a.enabled)):w.bool(a)&&w.object(n.perAction[i])?o[i].enabled=a:o[i]=a}}},{key:"getRect",value:function(t){return t=t||(w.element(this.target)?this.target:null),w.string(this.target)&&(t=t||this._context.querySelector(this.target)),L(t)}},{key:"rectChecker",value:function(t){var e=this;return w.func(t)?(this.getRect=function(n){var r=V({},t.call(e,n));return"width"in r||(r.width=r.right-r.left,r.height=r.bottom-r.top),r},this):null===t?(delete this.getRect,this):this.getRect}},{key:"_backCompatOption",value:function(t,e){if(B(e)||w.object(e)){for(var n in this.options[t]=e,this._actions.map)this.options[n][t]=e;return this}return this.options[t]}},{key:"origin",value:function(t){return this._backCompatOption("origin",t)}},{key:"deltaSource",value:function(t){return"page"===t||"client"===t?(this.options.deltaSource=t,this):this.options.deltaSource}},{key:"getAllElements",value:function(){var t=this.target;return w.string(t)?Array.from(this._context.querySelectorAll(t)):w.func(t)&&t.getAllElements?t.getAllElements():w.element(t)?[t]:[]}},{key:"context",value:function(){return this._context}},{key:"inContext",value:function(t){return this._context===t.ownerDocument||M(this._context,t)}},{key:"testIgnoreAllow",value:function(t,e,n){return!this.testIgnore(t.ignoreFrom,e,n)&&this.testAllow(t.allowFrom,e,n)}},{key:"testAllow",value:function(t,e,n){return!t||!!w.element(n)&&(w.string(t)?F(n,t,e):!!w.element(t)&&M(t,n))}},{key:"testIgnore",value:function(t,e,n){return!(!t||!w.element(n))&&(w.string(t)?F(n,t,e):!!w.element(t)&&M(t,n))}},{key:"fire",value:function(t){return this.events.fire(t),this}},{key:"_onOff",value:function(t,e,n,r,i){w.object(e)&&!w.array(e)&&(r=n,n=null);var o=$(e,n,i);for(var a in o){"wheel"===a&&(a=I.wheelEvent);for(var s=0,c=o[a];s<c.length;s++){var l=c[s];ve(a,this._actions)?this.events[t===rn.On?"on":"off"](a,l):w.string(this.target)?this._scopeEvents[t===rn.On?"addDelegate":"removeDelegate"](this.target,this._context,a,l,r):this._scopeEvents[t===rn.On?"add":"remove"](this.target,a,l,r)}}return this}},{key:"on",value:function(t,e,n){return this._onOff(rn.On,t,e,n)}},{key:"off",value:function(t,e,n){return this._onOff(rn.Off,t,e,n)}},{key:"set",value:function(t){var e=this._defaults;for(var n in w.object(t)||(t={}),this.options=ge(e.base),this._actions.methodDict){var r=n,i=this._actions.methodDict[r];this.options[r]={},this.setPerAction(r,V(V({},e.perAction),e.actions[r])),this[i](t[r])}for(var o in t)"getRect"!==o?w.func(this[o])&&this[o](t[o]):this.rectChecker(t.getRect);return this}},{key:"unset",value:function(){if(w.string(this.target))for(var t in this._scopeEvents.delegatedEvents)for(var e=this._scopeEvents.delegatedEvents[t],n=e.length-1;n>=0;n--){var r=e[n],i=r.selector,o=r.context,a=r.listeners;i===this.target&&o===this._context&&e.splice(n,1);for(var s=a.length-1;s>=0;s--)this._scopeEvents.removeDelegate(this.target,this._context,t,a[s][0],a[s][1])}else this._scopeEvents.remove(this.target,"all")}}]),t}(),an=function(){function t(e){var n=this;r(this,t),this.list=[],this.selectorMap={},this.scope=void 0,this.scope=e,e.addListeners({"interactable:unset":function(t){var e=t.interactable,r=e.target,i=w.string(r)?n.selectorMap[r]:r[n.scope.id],o=yt(i,(function(t){return t===e}));i.splice(o,1)}})}return o(t,[{key:"new",value:function(t,e){e=V(e||{},{actions:this.scope.actions});var n=new this.scope.Interactable(t,e,this.scope.document,this.scope.events);return this.scope.addDocument(n._doc),this.list.push(n),w.string(t)?(this.selectorMap[t]||(this.selectorMap[t]=[]),this.selectorMap[t].push(n)):(n.target[this.scope.id]||Object.defineProperty(t,this.scope.id,{value:[],configurable:!0}),t[this.scope.id].push(n)),this.scope.fire("interactable:new",{target:t,options:e,interactable:n,win:this.scope._win}),n}},{key:"getExisting",value:function(t,e){var n=e&&e.context||this.scope.document,r=w.string(t),i=r?this.selectorMap[t]:t[this.scope.id];if(i)return bt(i,(function(e){return e._context===n&&(r||e.inContext(t))}))}},{key:"forEachMatch",value:function(t,e){for(var n=0,r=this.list;n<r.length;n++){var i=r[n],o=void 0;if((w.string(i.target)?w.element(t)&&R(t,i.target):t===i.target)&&i.inContext(t)&&(o=e(i)),void 0!==o)return o}}}]),t}();var sn=function(){function t(){var e=this;r(this,t),this.id="__interact_scope_".concat(Math.floor(100*Math.random())),this.isInitialized=!1,this.listenerMaps=[],this.browser=I,this.defaults=ge(Te),this.Eventable=Ve,this.actions={map:{},phases:{start:!0,move:!0,end:!0},methodDict:{},phaselessTypes:{}},this.interactStatic=function(t){var e=function e(n,r){var i=t.interactables.getExisting(n,r);return i||((i=t.interactables.new(n,r)).events.global=e.globalEvents),i};return e.getPointerAverage=lt,e.getTouchBBox=ut,e.getTouchDistance=pt,e.getTouchAngle=ft,e.getElementRect=L,e.getElementClientRect=Y,e.matchesSelector=R,e.closest=z,e.globalEvents={},e.version="1.10.28",e.scope=t,e.use=function(t,e){return this.scope.usePlugin(t,e),this},e.isSet=function(t,e){return!!this.scope.interactables.get(t,e&&e.context)},e.on=Nt((function(t,e,n){if(w.string(t)&&-1!==t.search(" ")&&(t=t.trim().split(/ +/)),w.array(t)){for(var r=0,i=t;r<i.length;r++){var o=i[r];this.on(o,e,n)}return this}if(w.object(t)){for(var a in t)this.on(a,t[a],e);return this}return ve(t,this.scope.actions)?this.globalEvents[t]?this.globalEvents[t].push(e):this.globalEvents[t]=[e]:this.scope.events.add(this.scope.document,t,e,{options:n}),this}),"The interact.on() method is being deprecated"),e.off=Nt((function(t,e,n){if(w.string(t)&&-1!==t.search(" ")&&(t=t.trim().split(/ +/)),w.array(t)){for(var r=0,i=t;r<i.length;r++){var o=i[r];this.off(o,e,n)}return this}if(w.object(t)){for(var a in t)this.off(a,t[a],e);return this}var s;return ve(t,this.scope.actions)?t in this.globalEvents&&-1!==(s=this.globalEvents[t].indexOf(e))&&this.globalEvents[t].splice(s,1):this.scope.events.remove(this.scope.document,t,e,n),this}),"The interact.off() method is being deprecated"),e.debug=function(){return this.scope},e.supportsTouch=function(){return I.supportsTouch},e.supportsPointerEvent=function(){return I.supportsPointerEvent},e.stop=function(){for(var t=0,e=this.scope.interactions.list;t<e.length;t++)e[t].stop();return this},e.pointerMoveTolerance=function(t){return w.number(t)?(this.scope.interactions.pointerMoveTolerance=t,this):this.scope.interactions.pointerMoveTolerance},e.addDocument=function(t,e){this.scope.addDocument(t,e)},e.removeDocument=function(t){this.scope.removeDocument(t)},e}(this),this.InteractEvent=Se,this.Interactable=void 0,this.interactables=new an(this),this._win=void 0,this.document=void 0,this.window=void 0,this.documents=[],this._plugins={list:[],map:{}},this.onWindowUnload=function(t){return e.removeDocument(t.target)};var n=this;this.Interactable=function(t){s(i,t);var e=p(i);function i(){return r(this,i),e.apply(this,arguments)}return o(i,[{key:"_defaults",get:function(){return n.defaults}},{key:"set",value:function(t){return f(c(i.prototype),"set",this).call(this,t),n.fire("interactable:set",{options:t,interactable:this}),this}},{key:"unset",value:function(){f(c(i.prototype),"unset",this).call(this);var t=n.interactables.list.indexOf(this);t<0||(n.interactables.list.splice(t,1),n.fire("interactable:unset",{interactable:this}))}}]),i}(on)}return o(t,[{key:"addListeners",value:function(t,e){this.listenerMaps.push({id:e,map:t})}},{key:"fire",value:function(t,e){for(var n=0,r=this.listenerMaps;n<r.length;n++){var i=r[n].map[t];if(i&&!1===i(e,this,t))return!1}}},{key:"init",value:function(t){return this.isInitialized?this:function(t,e){t.isInitialized=!0,w.window(e)&&m(e);return k.init(e),I.init(e),Lt.init(e),t.window=e,t.document=e.document,t.usePlugin(nn),t.usePlugin(Ue),t}(this,t)}},{key:"pluginIsInstalled",value:function(t){var e=t.id;return e?!!this._plugins.map[e]:-1!==this._plugins.list.indexOf(t)}},{key:"usePlugin",value:function(t,e){if(!this.isInitialized)return this;if(this.pluginIsInstalled(t))return this;if(t.id&&(this._plugins.map[t.id]=t),this._plugins.list.push(t),t.install&&t.install(this,e),t.listeners&&t.before){for(var n=0,r=this.listenerMaps.length,i=t.before.reduce((function(t,e){return t[e]=!0,t[cn(e)]=!0,t}),{});n<r;n++){var o=this.listenerMaps[n].id;if(o&&(i[o]||i[cn(o)]))break}this.listenerMaps.splice(n,0,{id:t.id,map:t.listeners})}else t.listeners&&this.listenerMaps.push({id:t.id,map:t.listeners});return this}},{key:"addDocument",value:function(t,e){if(-1!==this.getDocIndex(t))return!1;var n=y(t);e=e?V({},e):{},this.documents.push({doc:t,options:e}),this.events.documents.push(t),t!==this.document&&this.events.add(n,"unload",this.onWindowUnload),this.fire("scope:add-document",{doc:t,window:n,scope:this,options:e})}},{key:"removeDocument",value:function(t){var e=this.getDocIndex(t),n=y(t),r=this.documents[e].options;this.events.remove(n,"unload",this.onWindowUnload),this.documents.splice(e,1),this.events.documents.splice(e,1),this.fire("scope:remove-document",{doc:t,window:n,scope:this,options:r})}},{key:"getDocIndex",value:function(t){for(var e=0;e<this.documents.length;e++)if(this.documents[e].doc===t)return e;return-1}},{key:"getDocOptions",value:function(t){var e=this.getDocIndex(t);return-1===e?null:this.documents[e].options}},{key:"now",value:function(){return(this.window.Date||Date).now()}}]),t}();function cn(t){return t&&t.replace(/\/.*$/,"")}var ln=new sn,un=ln.interactStatic,pn="undefined"!=typeof globalThis?globalThis:window;ln.init(pn);var fn=Object.freeze({__proto__:null,edgeTarget:function(){},elements:function(){},grid:function(t){var e=[["x","y"],["left","top"],["right","bottom"],["width","height"]].filter((function(e){var n=e[0],r=e[1];return n in t||r in t})),n=function(n,r){for(var i=t.range,o=t.limits,a=void 0===o?{left:-1/0,right:1/0,top:-1/0,bottom:1/0}:o,s=t.offset,c=void 0===s?{x:0,y:0}:s,l={range:i,grid:t,x:null,y:null},u=0;u<e.length;u++){var p=e[u],f=p[0],d=p[1],h=Math.round((n-c.x)/t[f]),v=Math.round((r-c.y)/t[d]);l[f]=Math.max(a.left,Math.min(a.right,h*t[f]+c.x)),l[d]=Math.max(a.top,Math.min(a.bottom,v*t[d]+c.y))}return l};return n.grid=t,n.coordFields=e,n}}),dn={id:"snappers",install:function(t){var e=t.interactStatic;e.snappers=V(e.snappers||{},fn),e.createSnapGrid=e.snappers.grid}},hn=dn,vn={start:function(t){var n=t.state,r=t.rect,i=t.edges,o=t.pageCoords,a=n.options,s=a.ratio,c=a.enabled,l=n.options,u=l.equalDelta,p=l.modifiers;"preserve"===s&&(s=r.width/r.height),n.startCoords=V({},o),n.startRect=V({},r),n.ratio=s,n.equalDelta=u;var f=n.linkedEdges={top:i.top||i.left&&!i.bottom,left:i.left||i.top&&!i.right,bottom:i.bottom||i.right&&!i.top,right:i.right||i.bottom&&!i.left};if(n.xIsPrimaryAxis=!(!i.left&&!i.right),n.equalDelta){var d=(f.left?1:-1)*(f.top?1:-1);n.edgeSign={x:d,y:d}}else n.edgeSign={x:f.left?-1:1,y:f.top?-1:1};if(!1!==c&&V(i,f),null!=p&&p.length){var h=new me(t.interaction);h.copyFrom(t.interaction.modification),h.prepareStates(p),n.subModification=h,h.startAll(e({},t))}},set:function(t){var n=t.state,r=t.rect,i=t.coords,o=n.linkedEdges,a=V({},i),s=n.equalDelta?gn:mn;if(V(t.edges,o),s(n,n.xIsPrimaryAxis,i,r),!n.subModification)return null;var c=V({},r);H(o,c,{x:i.x-a.x,y:i.y-a.y});var l=n.subModification.setAll(e(e({},t),{},{rect:c,edges:o,pageCoords:i,prevCoords:i,prevRect:c})),u=l.delta;l.changed&&(s(n,Math.abs(u.x)>Math.abs(u.y),l.coords,l.rect),V(i,l.coords));return l.eventProps},defaults:{ratio:"preserve",equalDelta:!1,modifiers:[],enabled:!1}};function gn(t,e,n){var r=t.startCoords,i=t.edgeSign;e?n.y=r.y+(n.x-r.x)*i.y:n.x=r.x+(n.y-r.y)*i.x}function mn(t,e,n,r){var i=t.startRect,o=t.startCoords,a=t.ratio,s=t.edgeSign;if(e){var c=r.width/a;n.y=o.y+(c-i.height)*s.y}else{var l=r.height*a;n.x=o.x+(l-i.width)*s.x}}var yn=be(vn,"aspectRatio"),bn=function(){};bn._defaults={};var xn=bn;function wn(t,e,n){return w.func(t)?G(t,e.interactable,e.element,[n.x,n.y,e]):G(t,e.interactable,e.element)}var En={start:function(t){var e=t.rect,n=t.startOffset,r=t.state,i=t.interaction,o=t.pageCoords,a=r.options,s=a.elementRect,c=V({left:0,top:0,right:0,bottom:0},a.offset||{});if(e&&s){var l=wn(a.restriction,i,o);if(l){var u=l.right-l.left-e.width,p=l.bottom-l.top-e.height;u<0&&(c.left+=u,c.right+=u),p<0&&(c.top+=p,c.bottom+=p)}c.left+=n.left-e.width*s.left,c.top+=n.top-e.height*s.top,c.right+=n.right-e.width*(1-s.right),c.bottom+=n.bottom-e.height*(1-s.bottom)}r.offset=c},set:function(t){var e=t.coords,n=t.interaction,r=t.state,i=r.options,o=r.offset,a=wn(i.restriction,n,e);if(a){var s=function(t){return!t||"left"in t&&"top"in t||((t=V({},t)).left=t.x||0,t.top=t.y||0,t.right=t.right||t.left+t.width,t.bottom=t.bottom||t.top+t.height),t}(a);e.x=Math.max(Math.min(s.right-o.right,e.x),s.left+o.left),e.y=Math.max(Math.min(s.bottom-o.bottom,e.y),s.top+o.top)}},defaults:{restriction:null,elementRect:null,offset:null,endOnly:!1,enabled:!1}},Tn=be(En,"restrict"),Sn={top:1/0,left:1/0,bottom:-1/0,right:-1/0},_n={top:-1/0,left:-1/0,bottom:1/0,right:1/0};function Pn(t,e){for(var n=0,r=["top","left","bottom","right"];n<r.length;n++){var i=r[n];i in t||(t[i]=e[i])}return t}var On={noInner:Sn,noOuter:_n,start:function(t){var e,n=t.interaction,r=t.startOffset,i=t.state,o=i.options;o&&(e=N(wn(o.offset,n,n.coords.start.page))),e=e||{x:0,y:0},i.offset={top:e.y+r.top,left:e.x+r.left,bottom:e.y-r.bottom,right:e.x-r.right}},set:function(t){var e=t.coords,n=t.edges,r=t.interaction,i=t.state,o=i.offset,a=i.options;if(n){var s=V({},e),c=wn(a.inner,r,s)||{},l=wn(a.outer,r,s)||{};Pn(c,Sn),Pn(l,_n),n.top?e.y=Math.min(Math.max(l.top+o.top,s.y),c.top+o.top):n.bottom&&(e.y=Math.max(Math.min(l.bottom+o.bottom,s.y),c.bottom+o.bottom)),n.left?e.x=Math.min(Math.max(l.left+o.left,s.x),c.left+o.left):n.right&&(e.x=Math.max(Math.min(l.right+o.right,s.x),c.right+o.right))}},defaults:{inner:null,outer:null,offset:null,endOnly:!1,enabled:!1}},kn=be(On,"restrictEdges"),Dn=V({get elementRect(){return{top:0,left:0,bottom:1,right:1}},set elementRect(t){}},En.defaults),In=be({start:En.start,set:En.set,defaults:Dn},"restrictRect"),Mn={width:-1/0,height:-1/0},zn={width:1/0,height:1/0};var An=be({start:function(t){return On.start(t)},set:function(t){var e=t.interaction,n=t.state,r=t.rect,i=t.edges,o=n.options;if(i){var a=U(wn(o.min,e,t.coords))||Mn,s=U(wn(o.max,e,t.coords))||zn;n.options={endOnly:o.endOnly,inner:V({},On.noInner),outer:V({},On.noOuter)},i.top?(n.options.inner.top=r.bottom-a.height,n.options.outer.top=r.bottom-s.height):i.bottom&&(n.options.inner.bottom=r.top+a.height,n.options.outer.bottom=r.top+s.height),i.left?(n.options.inner.left=r.right-a.width,n.options.outer.left=r.right-s.width):i.right&&(n.options.inner.right=r.left+a.width,n.options.outer.right=r.left+s.width),On.set(t),n.options=o}},defaults:{min:null,max:null,endOnly:!1,enabled:!1}},"restrictSize");var Rn={start:function(t){var e,n=t.interaction,r=t.interactable,i=t.element,o=t.rect,a=t.state,s=t.startOffset,c=a.options,l=c.offsetWithOrigin?function(t){var e=t.interaction.element,n=N(G(t.state.options.origin,null,null,[e])),r=n||K(t.interactable,e,t.interaction.prepared.name);return r}(t):{x:0,y:0};if("startCoords"===c.offset)e={x:n.coords.start.page.x,y:n.coords.start.page.y};else{var u=G(c.offset,r,i,[n]);(e=N(u)||{x:0,y:0}).x+=l.x,e.y+=l.y}var p=c.relativePoints;a.offsets=o&&p&&p.length?p.map((function(t,n){return{index:n,relativePoint:t,x:s.left-o.width*t.x+e.x,y:s.top-o.height*t.y+e.y}})):[{index:0,relativePoint:null,x:e.x,y:e.y}]},set:function(t){var e=t.interaction,n=t.coords,r=t.state,i=r.options,o=r.offsets,a=K(e.interactable,e.element,e.prepared.name),s=V({},n),c=[];i.offsetWithOrigin||(s.x-=a.x,s.y-=a.y);for(var l=0,u=o;l<u.length;l++)for(var p=u[l],f=s.x-p.x,d=s.y-p.y,h=0,v=i.targets.length;h<v;h++){var g=i.targets[h],m=void 0;(m=w.func(g)?g(f,d,e._proxy,p,h):g)&&c.push({x:(w.number(m.x)?m.x:f)+p.x,y:(w.number(m.y)?m.y:d)+p.y,range:w.number(m.range)?m.range:i.range,source:g,index:h,offset:p})}for(var y={target:null,inRange:!1,distance:0,range:0,delta:{x:0,y:0}},b=0;b<c.length;b++){var x=c[b],E=x.range,T=x.x-s.x,S=x.y-s.y,_=Q(T,S),P=_<=E;E===1/0&&y.inRange&&y.range!==1/0&&(P=!1),y.target&&!(P?y.inRange&&E!==1/0?_/E<y.distance/y.range:E===1/0&&y.range!==1/0||_<y.distance:!y.inRange&&_<y.distance)||(y.target=x,y.distance=_,y.range=E,y.inRange=P,y.delta.x=T,y.delta.y=S)}return y.inRange&&(n.x=y.target.x,n.y=y.target.y),r.closest=y,y},defaults:{range:1/0,targets:null,offset:null,offsetWithOrigin:!0,origin:null,relativePoints:null,endOnly:!1,enabled:!1}},Cn=be(Rn,"snap");var jn={start:function(t){var e=t.state,n=t.edges,r=e.options;if(!n)return null;t.state={options:{targets:null,relativePoints:[{x:n.left?0:1,y:n.top?0:1}],offset:r.offset||"self",origin:{x:0,y:0},range:r.range}},e.targetFields=e.targetFields||[["width","height"],["x","y"]],Rn.start(t),e.offsets=t.state.offsets,t.state=e},set:function(t){var e=t.interaction,n=t.state,r=t.coords,i=n.options,o=n.offsets,a={x:r.x-o[0].x,y:r.y-o[0].y};n.options=V({},i),n.options.targets=[];for(var s=0,c=i.targets||[];s<c.length;s++){var l=c[s],u=void 0;if(u=w.func(l)?l(a.x,a.y,e):l){for(var p=0,f=n.targetFields;p<f.length;p++){var d=f[p],h=d[0],v=d[1];if(h in u||v in u){u.x=u[h],u.y=u[v];break}}n.options.targets.push(u)}}var g=Rn.set(t);return n.options=i,g},defaults:{range:1/0,targets:null,offset:null,endOnly:!1,enabled:!1}},Fn=be(jn,"snapSize");var Xn={aspectRatio:yn,restrictEdges:kn,restrict:Tn,restrictRect:In,restrictSize:An,snapEdges:be({start:function(t){var e=t.edges;return e?(t.state.targetFields=t.state.targetFields||[[e.left?"left":"right",e.top?"top":"bottom"]],jn.start(t)):null},set:jn.set,defaults:V(ge(jn.defaults),{targets:void 0,range:void 0,offset:{x:0,y:0}})},"snapEdges"),snap:Cn,snapSize:Fn,spring:xn,avoid:xn,transform:xn,rubberband:xn},Yn={id:"modifiers",install:function(t){var e=t.interactStatic;for(var n in t.usePlugin(Ee),t.usePlugin(hn),e.modifiers=Xn,Xn){var r=Xn[n],i=r._defaults,o=r._methods;i._methods=o,t.defaults.perAction[n]=i}}},Ln=Yn,qn=function(t){s(n,t);var e=p(n);function n(t,i,o,a,s,c){var l;if(r(this,n),tt(u(l=e.call(this,s)),o),o!==i&&tt(u(l),i),l.timeStamp=c,l.originalEvent=o,l.type=t,l.pointerId=at(i),l.pointerType=dt(i),l.target=a,l.currentTarget=null,"tap"===t){var p=s.getPointerIndex(i);l.dt=l.timeStamp-s.pointers[p].downTime;var f=l.timeStamp-s.tapTime;l.double=!!s.prevTap&&"doubletap"!==s.prevTap.type&&s.prevTap.target===l.target&&f<500}else"doubletap"===t&&(l.dt=i.timeStamp-s.tapTime,l.double=!0);return l}return o(n,[{key:"_subtractOrigin",value:function(t){var e=t.x,n=t.y;return this.pageX-=e,this.pageY-=n,this.clientX-=e,this.clientY-=n,this}},{key:"_addOrigin",value:function(t){var e=t.x,n=t.y;return this.pageX+=e,this.pageY+=n,this.clientX+=e,this.clientY+=n,this}},{key:"preventDefault",value:function(){this.originalEvent.preventDefault()}}]),n}(vt),Bn={id:"pointer-events/base",before:["inertia","modifiers","auto-start","actions"],install:function(t){t.pointerEvents=Bn,t.defaults.actions.pointerEvents=Bn.defaults,V(t.actions.phaselessTypes,Bn.types)},listeners:{"interactions:new":function(t){var e=t.interaction;e.prevTap=null,e.tapTime=0},"interactions:update-pointer":function(t){var e=t.down,n=t.pointerInfo;if(!e&&n.hold)return;n.hold={duration:1/0,timeout:null}},"interactions:move":function(t,e){var n=t.interaction,r=t.pointer,i=t.event,o=t.eventTarget;t.duplicate||n.pointerIsDown&&!n.pointerWasMoved||(n.pointerIsDown&&Gn(t),Vn({interaction:n,pointer:r,event:i,eventTarget:o,type:"move"},e))},"interactions:down":function(t,e){!function(t,e){for(var n=t.interaction,r=t.pointer,i=t.event,o=t.eventTarget,a=t.pointerIndex,s=n.pointers[a].hold,c=q(o),l={interaction:n,pointer:r,event:i,eventTarget:o,type:"hold",targets:[],path:c,node:null},u=0;u<c.length;u++){var p=c[u];l.node=p,e.fire("pointerEvents:collect-targets",l)}if(!l.targets.length)return;for(var f=1/0,d=0,h=l.targets;d<h.length;d++){var v=h[d].eventable.options.holdDuration;v<f&&(f=v)}s.duration=f,s.timeout=setTimeout((function(){Vn({interaction:n,eventTarget:o,pointer:r,event:i,type:"hold"},e)}),f)}(t,e),Vn(t,e)},"interactions:up":function(t,e){Gn(t),Vn(t,e),function(t,e){var n=t.interaction,r=t.pointer,i=t.event,o=t.eventTarget;n.pointerWasMoved||Vn({interaction:n,eventTarget:o,pointer:r,event:i,type:"tap"},e)}(t,e)},"interactions:cancel":function(t,e){Gn(t),Vn(t,e)}},PointerEvent:qn,fire:Vn,collectEventTargets:Wn,defaults:{holdDuration:600,ignoreFrom:null,allowFrom:null,origin:{x:0,y:0}},types:{down:!0,move:!0,up:!0,cancel:!0,tap:!0,doubletap:!0,hold:!0}};function Vn(t,e){var n=t.interaction,r=t.pointer,i=t.event,o=t.eventTarget,a=t.type,s=t.targets,c=void 0===s?Wn(t,e):s,l=new qn(a,r,i,o,n,e.now());e.fire("pointerEvents:new",{pointerEvent:l});for(var u={interaction:n,pointer:r,event:i,eventTarget:o,targets:c,type:a,pointerEvent:l},p=0;p<c.length;p++){var f=c[p];for(var d in f.props||{})l[d]=f.props[d];var h=K(f.eventable,f.node);if(l._subtractOrigin(h),l.eventable=f.eventable,l.currentTarget=f.node,f.eventable.fire(l),l._addOrigin(h),l.immediatePropagationStopped||l.propagationStopped&&p+1<c.length&&c[p+1].node!==l.currentTarget)break}if(e.fire("pointerEvents:fired",u),"tap"===a){var v=l.double?Vn({interaction:n,pointer:r,event:i,eventTarget:o,type:"doubletap"},e):l;n.prevTap=v,n.tapTime=v.timeStamp}return l}function Wn(t,e){var n=t.interaction,r=t.pointer,i=t.event,o=t.eventTarget,a=t.type,s=n.getPointerIndex(r),c=n.pointers[s];if("tap"===a&&(n.pointerWasMoved||!c||c.downTarget!==o))return[];for(var l=q(o),u={interaction:n,pointer:r,event:i,eventTarget:o,type:a,path:l,targets:[],node:null},p=0;p<l.length;p++){var f=l[p];u.node=f,e.fire("pointerEvents:collect-targets",u)}return"hold"===a&&(u.targets=u.targets.filter((function(t){var e,r;return t.eventable.options.holdDuration===(null==(e=n.pointers[s])||null==(r=e.hold)?void 0:r.duration)}))),u.targets}function Gn(t){var e=t.interaction,n=t.pointerIndex,r=e.pointers[n].hold;r&&r.timeout&&(clearTimeout(r.timeout),r.timeout=null)}var Nn=Object.freeze({__proto__:null,default:Bn});function Un(t){var e=t.interaction;e.holdIntervalHandle&&(clearInterval(e.holdIntervalHandle),e.holdIntervalHandle=null)}var Hn={id:"pointer-events/holdRepeat",install:function(t){t.usePlugin(Bn);var e=t.pointerEvents;e.defaults.holdRepeatInterval=0,e.types.holdrepeat=t.actions.phaselessTypes.holdrepeat=!0},listeners:["move","up","cancel","endall"].reduce((function(t,e){return t["pointerEvents:".concat(e)]=Un,t}),{"pointerEvents:new":function(t){var e=t.pointerEvent;"hold"===e.type&&(e.count=(e.count||0)+1)},"pointerEvents:fired":function(t,e){var n=t.interaction,r=t.pointerEvent,i=t.eventTarget,o=t.targets;if("hold"===r.type&&o.length){var a=o[0].eventable.options.holdRepeatInterval;a<=0||(n.holdIntervalHandle=setTimeout((function(){e.pointerEvents.fire({interaction:n,eventTarget:i,type:"hold",pointer:r,event:r},e)}),a))}}})},Kn=Hn;var $n={id:"pointer-events/interactableTargets",install:function(t){var e=t.Interactable;e.prototype.pointerEvents=function(t){return V(this.events.options,t),this};var n=e.prototype._backCompatOption;e.prototype._backCompatOption=function(t,e){var r=n.call(this,t,e);return r===this&&(this.events.options[t]=e),r}},listeners:{"pointerEvents:collect-targets":function(t,e){var n=t.targets,r=t.node,i=t.type,o=t.eventTarget;e.interactables.forEachMatch(r,(function(t){var e=t.events,a=e.options;e.types[i]&&e.types[i].length&&t.testIgnoreAllow(a,r,o)&&n.push({node:r,eventable:e,props:{interactable:t}})}))},"interactable:new":function(t){var e=t.interactable;e.events.getRect=function(t){return e.getRect(t)}},"interactable:set":function(t,e){var n=t.interactable,r=t.options;V(n.events.options,e.pointerEvents.defaults),V(n.events.options,r.pointerEvents||{})}}},Jn=$n,Qn={id:"pointer-events",install:function(t){t.usePlugin(Nn),t.usePlugin(Kn),t.usePlugin(Jn)}},Zn=Qn;var tr={id:"reflow",install:function(t){var e=t.Interactable;t.actions.phases.reflow=!0,e.prototype.reflow=function(e){return function(t,e,n){for(var r=t.getAllElements(),i=n.window.Promise,o=i?[]:null,a=function(){var a=r[s],c=t.getRect(a);if(!c)return 1;var l,u=bt(n.interactions.list,(function(n){return n.interacting()&&n.interactable===t&&n.element===a&&n.prepared.name===e.name}));if(u)u.move(),o&&(l=u._reflowPromise||new i((function(t){u._reflowResolve=t})));else{var p=U(c),f=function(t){return{coords:t,get page(){return this.coords.page},get client(){return this.coords.client},get timeStamp(){return this.coords.timeStamp},get pageX(){return this.coords.page.x},get pageY(){return this.coords.page.y},get clientX(){return this.coords.client.x},get clientY(){return this.coords.client.y},get pointerId(){return this.coords.pointerId},get target(){return this.coords.target},get type(){return this.coords.type},get pointerType(){return this.coords.pointerType},get buttons(){return this.coords.buttons},preventDefault:function(){}}}({page:{x:p.x,y:p.y},client:{x:p.x,y:p.y},timeStamp:n.now()});l=function(t,e,n,r,i){var o=t.interactions.new({pointerType:"reflow"}),a={interaction:o,event:i,pointer:i,eventTarget:n,phase:"reflow"};o.interactable=e,o.element=n,o.prevEvent=i,o.updatePointer(i,i,n,!0),nt(o.coords.delta),Ut(o.prepared,r),o._doPhase(a);var s=t.window,c=s.Promise,l=c?new c((function(t){o._reflowResolve=t})):void 0;o._reflowPromise=l,o.start(r,e,n),o._interacting?(o.move(a),o.end(i)):(o.stop(),o._reflowResolve());return o.removePointer(i,i),l}(n,t,a,e,f)}o&&o.push(l)},s=0;s<r.length&&!a();s++);return o&&i.all(o).then((function(){return t}))}(this,e,t)}},listeners:{"interactions:stop":function(t,e){var n=t.interaction;"reflow"===n.pointerType&&(n._reflowResolve&&n._reflowResolve(),function(t,e){t.splice(t.indexOf(e),1)}(e.interactions.list,n))}}},er=tr;if(un.use(he),un.use(Ce),un.use(Zn),un.use(qe),un.use(Ln),un.use(pe),un.use(Xt),un.use(Gt),un.use(er),un.default=un,"object"===("undefined"==typeof module?"undefined":n(module))&&module)try{module.exports=un}catch(t){}return un.default=un,un}));

window.POCardInteract=module.exports;
})();


/* Android presentation module: card-phone-table */
/* Presentation adapter: move original controls once; never copy game state,
   dispatch gameplay commands, replace handlers, or change disabled flags. */
(() => {
  'use strict';
  const origin = window.__TABLETOP_ANDROID_TEST_ORIGIN || 'https://onepiece-card-online.onrender.com';
  if (location.origin !== origin || !['/game.html','/tutorial.html'].includes(location.pathname)) return;
  function mount() {
    const root = document.documentElement, main = document.querySelector('main');
    const hand = document.getElementById('myPlayZone'), players = document.getElementById('players');
    const header = document.querySelector('header > div'), table = main?.querySelector(':scope > section');
    if (!main || !hand || !players || !header || !table || main.dataset.cardPhoneMounted) return;
    // Own these classes independently of the older adapter's animation-frame timing.
    document.getElementById('venues')?.closest('.card')?.classList.add('android-card-venues');
    document.getElementById('btnDraw')?.closest('.card')?.classList.add('android-card-deck');
    main.dataset.cardPhoneMounted = 'true'; root.dataset.cardPhone = 'table';
    const node = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls; if(text)n.textContent=text; return n; };
    const button = (text, fn) => { const b=node('button','phone-card-control',text); b.type='button';b.onclick=fn;return b; };
    const aside = main.querySelector(':scope > aside'), log = document.getElementById('logBox')?.closest('.card');
    const discard = document.getElementById('discard')?.closest('.card');
    const drawer=node('section','phone-card-sheet');drawer.id='phoneCardSheet';drawer.hidden=true;drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');
    const sheetHead=node('div','phone-card-sheet-head'),title=node('h2','','牌桌資料'),content=node('div','phone-card-sheet-body');
    title.id='phoneCardSheetTitle';drawer.setAttribute('aria-labelledby',title.id);
    let restore=[],opener=null;
    function close() { drawer.dispatchEvent(new Event('phone-card-sheet-close'));for(const [n,marker] of restore){if(n.classList.contains('phone-card-preview')){n.remove();marker.remove();}else marker.replaceWith(n);}restore=[];drawer.hidden=true;root.removeAttribute('data-card-sheet');opener?.focus({preventScroll:true}); }
    function open(name, nodes) { if(!drawer.hidden)close();opener=document.activeElement;title.textContent=name;content.replaceChildren();
      for(const n of nodes.filter(Boolean)){const marker=document.createComment('phone-card-return');n.before(marker);restore.push([n,marker]);content.append(n);}
      drawer.hidden=false;root.dataset.cardSheet=name;closeButton.focus({preventScroll:true});
    }
    const closeButton=button('返回牌桌',close);sheetHead.append(title,closeButton);drawer.append(sheetHead,content);document.body.append(drawer);
    drawer.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'&&drawer.getAttribute('aria-modal')!=='false'){const all=[...drawer.querySelectorAll('button,input,select,[tabindex="0"]')].filter(n=>!n.disabled&&n.getClientRects().length);const first=all[0],last=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
    const storage=node('div','phone-card-storage');storage.hidden=true;document.body.append(storage);
    const actions=node('div','phone-card-round-actions');
    for(const id of ['btnCpuSkip','btnNextRound']){const b=document.getElementById(id);if(b)actions.append(b);}
    actions.setAttribute("aria-label","本局結束與觀戰操作");table.append(actions);
    const history=node('section','phone-card-history');history.setAttribute('aria-label','棄牌與對局紀錄');for(const n of [discard,log])if(n)history.append(n);main.append(history);
    const originalMusic=document.getElementById('bgmBar');if(originalMusic)storage.append(originalMusic);
    const dex=document.getElementById('cardDexBtn');
    const menu=node('div','phone-card-menu');
    if(dex){menu.append(dex);dex.addEventListener('click',close);}
    const roster=button('玩家詳情',()=>open('玩家詳情',[aside]));
    const records=button('棄牌與紀錄',()=>open('棄牌與紀錄',[discard,log]));
    const music=button('音效設定',()=>open('音效設定',[originalMusic]));
    const venuePanel=document.getElementById('venues')?.closest('.card');
    menu.append(roster,button('場地詳情',()=>open('場地詳情',[venuePanel])),records,music,button('遊戲選項',()=>{location.href=origin+'/__mobile_game_options__';}));storage.append(menu);
    const menuButton=button('選單',()=>open('選單',[menu]));menuButton.id='phoneCardMenu';header.append(menuButton);
    const turn=node('div','phone-card-turn');
    for(const id of ['turnLbl','stepLbl']){const span=document.getElementById(id);if(span)turn.append(span);}
    header.insertBefore(turn,menuButton);const staleTurn=log?.querySelector('.text-xs');if(staleTurn)staleTurn.hidden=true;
    const step=document.getElementById('stepLbl');
    if(step){const translate=()=>{const label=({draw:'抽牌',choose:'選牌',ended:'本局結束'})[step.textContent.trim()]||step.textContent;step.dataset.phoneLabel=label;step.setAttribute('aria-label',label);};translate();new MutationObserver(translate).observe(step,{childList:true,subtree:true,characterData:true});}
    aside.classList.add('phone-card-roster');main.prepend(aside);
    const rosterHeading=players.previousElementSibling;
    if(rosterHeading)rosterHeading.textContent='玩家';
    table.classList.add('phone-card-battlefield');
    const held=node('div','phone-card-held');held.setAttribute('aria-label','目前手牌');table.append(held);let heldSignature='';
    const syncHeld=()=>{const source=players.querySelector('.grow > .flex.items-start');const signature=source?.innerHTML||'';if(signature===heldSignature)return;heldSignature=signature;held.replaceChildren();if(source){const copy=source.cloneNode(true);copy.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));held.append(node('div','','目前手牌'),copy);}};
    new MutationObserver(syncHeld).observe(players,{childList:true,subtree:true});syncHeld();

    const board=table.querySelector(':scope > .grid');if(board)board.classList.add('phone-card-surface');
    hand.classList.add('phone-card-choice');
    // The older tutorial owns the same controls directly; normalize only their container.
    if(hand.querySelector(':scope > #playHand')){
      const pair=node('div','grid'),hint=node('div','','請從兩張牌中選一張打出');hint.id='chooseHint';
      pair.append(document.getElementById('playHand'),document.getElementById('playDrawn'));
      hand.prepend(hint,pair);
    }
    const previewButtons=node('div','phone-card-previews');
    for(const [id,label] of [['imgHand','查看手牌'],['imgDrawn','查看新牌']]){
      previewButtons.append(button(label,()=>{const source=document.getElementById(id);if(!source?.getAttribute('src'))return;if(window.CardPhonePresentation?.inspect){window.CardPhonePresentation.inspect('hand',id==='imgHand'?0:1);return;}
        const view=node('div','phone-card-preview'),img=node('img','');img.src=source.currentSrc||source.src;img.alt=label;view.append(img);storage.append(view);open(label,[view]);
        // Read-only artwork preview; the original card remains the only play control.
      }));
    }
    for(const [i,b] of [...previewButtons.children].entries()){b.setAttribute('aria-label',b.textContent);b.textContent=i?'新牌 · 放大':'手牌 · 放大';}
    hand.append(previewButtons);
    // The original renderer continues to own the discard pile, including order and backs.
    if(discard){const pile=document.getElementById('discard');pile.addEventListener('click',e=>{if(pile.__discardDragJustHappened)return;const source=e.target.closest('img')||e.target.closest('button')?.querySelector('img')||pile.querySelector('[data-pile-top="true"] img')||pile.querySelector('img:last-of-type');if(!source)return;if(window.CardPhonePresentation?.inspect){window.CardPhonePresentation.inspect('discard',[...pile.querySelectorAll('img')].indexOf(source));return;}const view=node('div','phone-card-preview'),img=node('img','');img.src=source.currentSrc||source.src;img.alt='棄牌';view.append(img);storage.append(view);open('查看棄牌',[view]);});}

    // Close a reading sheet when the original game opens a required choice.
    const modal=document.getElementById('modal');if(modal)new MutationObserver(()=>{if(!modal.classList.contains('hidden')&&!drawer.hidden)close();}).observe(modal,{attributes:true,attributeFilter:['class']});
    window.CardPhonePresentation={closeSheet:()=>{if(drawer.hidden)return false;close();return true;},openView:(name,view)=>{view.classList.add('phone-card-preview');storage.append(view);open(name,[view]);},openPlayers:()=>open('玩家詳情',[aside]),openVenues:()=>open('場地詳情',[venuePanel]),openRecords:()=>open('棄牌與紀錄',[discard,log])};
    const guide=document.getElementById('tutorialPanel'),guideStep=document.getElementById('tutorialStepLbl');
    if(guide&&guideStep){
      let lastStep=-1;
      const focusGuide=()=>{const i=parseInt(guideStep.textContent,10)-1;
        const targets=['#players','#venues','#players','#btnDraw','#myPlayZone','#players','#players','#discard','#logBox','#players','#cardDexBtn','#btnDraw'];
        const target=document.querySelector(targets[i]),focus=document.getElementById('tutorialFocus');if(!target||!focus)return;
        const r=target.getBoundingClientRect(),limit=main.getBoundingClientRect().right;
        Object.assign(focus.style,{left:Math.max(2,r.left-2)+'px',top:Math.max(2,r.top-2)+'px',width:Math.max(0,Math.min(r.width+4,limit-r.left-2))+'px',height:Math.max(0,Math.min(r.height+4,innerHeight-r.top-4))+'px'});
      };
      const syncGuide=()=>{
        if(guide.classList.contains('hidden')){root.removeAttribute('data-card-tutorial');if(lastStep>=0&&!drawer.hidden)close();lastStep=-1;return;}
        const i=parseInt(guideStep.textContent,10)-1;root.dataset.cardTutorial=String(i);
        if(i!==lastStep){lastStep=i;if(!drawer.hidden)close();
          if([2,5,6,9].includes(i))open('玩家詳情',[aside]);
          if([7,8].includes(i))open('棄牌與紀錄',[discard,log]);
          if(i===10)open('選單',[menu]);
        }
        // Spatial wording only; the tutorial's original step/action engine remains intact.
        for(const id of ['tutorialSub','tutorialTip']){const n=document.getElementById(id);if(n)n.textContent=n.textContent.replaceAll('右側','玩家區').replaceAll('右邊玩家框','玩家框').replaceAll('下方日誌','對局日誌');}
        requestAnimationFrame(focusGuide);
      };
      new MutationObserver(syncGuide).observe(guideStep,{childList:true,subtree:true,characterData:true});
      new MutationObserver(syncGuide).observe(guide,{attributes:true,attributeFilter:['class']});
      window.addEventListener('resize',()=>requestAnimationFrame(focusGuide),{passive:true});syncGuide();
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();


/* Android presentation module: card-phone-controls */
/* Mobile interaction layer. Reads only the viewer-visible model and delegates
 * every command to the original enabled button. No save or socket schema changes. */
(() => {
  'use strict';
  const origin=window.__TABLETOP_ANDROID_TEST_ORIGIN||'https://onepiece-card-online.onrender.com';
  if(location.origin!==origin||!['/game.html','/tutorial.html'].includes(location.pathname))return;
  function mount(){
    const api=window.CardPhonePresentation,root=document.documentElement;
    if(!api||root.dataset.cardControls)return;
    root.dataset.cardControls='touch';
    const $=id=>document.getElementById(id),players=$('players'),hand=$('myPlayZone'),sheet=$('phoneCardSheet');
    const make=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
    // A touch may emit a compatibility click after its button removes the sheet.
    // Suppress only that same pointer's click; never swallow a new touch or keys.
    let consumedTouch=null;
    document.addEventListener('click',e=>{if(consumedTouch&&e.isTrusted&&e.pointerType==='touch'&&e.pointerId===consumedTouch.id&&performance.now()-consumedTouch.time<600){consumedTouch=null;e.preventDefault();e.stopImmediatePropagation();}},true);
    const btn=(text,fn,cls='')=>{
      const n=make('button','phone-card-control '+cls,text);n.type='button';let touch=null,lastTouch=-Infinity;
      // Touch activation does not wait for the browser's compatibility click after
      // a swipe. Ignore that later click, but retain keyboard/programmatic clicks.
      n.onclick=e=>{if(e.detail>0&&performance.now()-lastTouch<600)return;fn(e);};
      n.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&!n.disabled)touch={id:e.pointerId,x:e.clientX,y:e.clientY};});
      n.addEventListener('pointermove',e=>{if(touch&&Math.hypot(e.clientX-touch.x,e.clientY-touch.y)>10)touch.cancelled=true;});
      n.addEventListener('pointercancel',()=>{touch=null;});
      n.addEventListener('pointerup',e=>{const start=touch;touch=null;if(!start||start.cancelled||start.id!==e.pointerId||n.disabled||Math.hypot(e.clientX-start.x,e.clientY-start.y)>10)return;e.preventDefault();lastTouch=performance.now();consumedTouch={id:e.pointerId,time:lastTouch};fn(e);});
      return n;
    };
    const model=()=>typeof state==='object'&&state?state:null;
    const own=()=>{const s=model();return typeof me==='object'&&s?s.players?.[me.playerId]:null;};
    const phaseKey=()=>{const s=model(),p=own();return JSON.stringify([typeof me==='object'?[me.roomId,me.playerId]:null,s?.roundNo,s?.phase,s?.turnIndex,s?.turnStep,p?.hand,p?.tempDraw,p?.frozen,p?.skipNext,s?.deck?.length,s?.discard?.length,s?.venues]);};
    const cardInfo=id=>{try{const m=typeof CARD_TEXT==='object'?CARD_TEXT[id]:null;return {name:m?.name||'卡牌詳情',effect:typeof cardLine==='function'?cardLine(id):''};}catch{return{name:'卡牌詳情',effect:''};}};
    const imageFor=id=>{try{return typeof CARD==='function'?CARD(id):'';}catch{return '';}};
    const activeCardButtons=()=>[$('playHand'),$('playDrawn')];
    const entriesFor=kind=>{
      const s=model(),p=own();
      if(kind==='hand')return [p?.hand,p?.tempDraw].flatMap((id,i)=>{
        if(id==null)return[];const control=activeCardButtons()[i],src=$(i?'imgDrawn':'imgHand')?.src;
        const ownArt=players.querySelectorAll('.grow > .flex.items-start img')[i]?.src;
        return [{id,slot:i,label:i?'新抽的牌':'保留的手牌',src:hand.classList.contains('hidden')?(ownArt||imageFor(id)):(src||ownArt||imageFor(id)),control,...cardInfo(id)}];
      });
      const imgs=[...$('discard').querySelectorAll('img')];
      return imgs.map((img,i)=>{const id=s?.discard?.[i],secret=!!(id&&typeof id==='object'&&id.back);return {id,secret,slot:i,label:`棄牌 ${i+1} / ${imgs.length}`,src:img.currentSrc||img.src,...(secret?{name:'秘密棄牌',effect:'這張牌尚未公開，只能查看牌背。'}:cardInfo(id))};});
    };
    let forwarding=false,inspector=null;
    function inspect(kind,slot=0){
      const entries=entriesFor(kind);if(!entries.length)return;
      const source=kind==='discard'?$('discard').querySelector('button[data-pile-top="true"] img,button:last-child img'):(hand.classList.contains('hidden')?document.querySelectorAll('.phone-card-held img')[slot]:$(slot?'imgDrawn':'imgHand'));
      const flightOrigin=source?.getBoundingClientRect();
      api.closeSheet();
      let index=Math.max(0,entries.findIndex(e=>e.slot===slot)),committed=false,validKey=phaseKey(),handRelease=null;
      function borrowSelection(){handRelease?.();handRelease=null;if(kind==='hand'){const slot=entries[index].slot,node=hand.classList.contains('hidden')?document.querySelectorAll('.phone-card-held img')[slot]:$(slot?'imgDrawn':'imgHand');handRelease=api.borrowCardVisual?.(node);}}
      const view=make('div','phone-card-inspector'),art=make('div','phone-card-inspector-art'),img=make('img','');img.draggable=false;art.append(img);
      const info=make('section','phone-card-inspector-info'),tag=make('div','phone-card-inspector-tag'),name=make('h3',''),effect=make('p','phone-card-effect');
      const text=make('div','phone-card-inspector-copy');text.append(tag,name,effect);
      const nav=make('div','phone-card-inspector-nav'),counter=make('span',''),prev=btn('‹',()=>step(-1)),next=btn('›',()=>step(1));prev.setAttribute('aria-label','上一張');next.setAttribute('aria-label','下一張');nav.append(prev,counter,next);
      const notice=make('p','phone-card-action-note'),confirm=btn('打出這張牌',()=>commit(),'phone-card-primary');confirm.id='phoneCardConfirm';
      const footer=make('div','phone-card-inspector-actions');footer.append(notice,confirm);info.append(text,nav,footer);view.append(art,info);
      function canPlay(){const e=entries[index];return kind==='hand'&&!committed&&phaseKey()===validKey&&!hand.classList.contains('hidden')&&e.control?.isConnected&&!e.control.disabled&&$('modal')?.classList.contains('hidden');}
      function refresh(){const e=entries[index];if(img.getAttribute('src')!==e.src)img.src=e.src;img.alt=e.name;img.dataset.phoneSecret=String(!!e.secret);tag.textContent=e.label;name.textContent=e.name;effect.textContent=e.effect;counter.textContent=`${index+1} / ${entries.length}　左右滑動換卡`;prev.disabled=index===0;next.disabled=index===entries.length-1;confirm.hidden=kind!=='hand';confirm.disabled=!canPlay();
        if(kind==='hand'){for(const b of activeCardButtons())b.dataset.cardSelected=String(b===e.control);updateAction();}
        notice.textContent=kind==='discard'?'僅查看，不會打出卡牌':phaseKey()!==validKey?'牌局已更新，請返回重新選牌':hand.classList.contains('hidden')?'目前僅能查看，輪到你選牌時才能打出':entries[index].control?.disabled?'目前規則禁止打出這張牌，可切換另一張查看':'確認效果後，再按下方按鈕打出';if(kind==='hand'&&!canPlay()){tag.textContent=notice.textContent;tag.setAttribute('role','status');}else tag.removeAttribute('role');
      }
      function step(delta){api.cancelCardFlights?.('inspect');index=Math.max(0,Math.min(entries.length-1,index+delta));refresh();borrowSelection();updateAction();}
      function commit(){if(!canPlay()){refresh();return;}committed=true;confirm.disabled=true;const control=entries[index].control;api.closeSheet();forwarding=true;try{control.click();}finally{forwarding=false;}}
      api.openView(kind==='discard'?'查看棄牌':'選牌與效果',view);sheet.dataset.inspectKind=kind;sheet.setAttribute('aria-modal',kind==='hand'?'false':'true');
      inspector={refresh,key:validKey,commit,canPlay,kind};refresh();borrowSelection();updateAction();
      // The card already arrived in the hand. Inspection expands in place, with no second flight.
      if(!matchMedia('(prefers-reduced-motion: reduce)').matches)img.animate([{opacity:.3,transform:'scale(.97)'},{opacity:1,transform:'scale(1)'}],{duration:160});
      const gestureTarget=kind==='hand'?text:art;
      let dragX=0;const gesture=window.POCardInteract?.(gestureTarget).draggable({startAxis:'x',lockAxis:'x',inertia:false,listeners:{start(){dragX=0;},move(e){dragX+=e.dx;img.style.transform=`translateX(${Math.max(-70,Math.min(70,dragX))}px) rotate(${dragX/45}deg)`;},end(e){img.style.transform='';if(!String(e.originalEvent?.type||'').includes('cancel')&&Math.abs(dragX)>40)step(dragX<0?1:-1);dragX=0;}}});
      sheet.addEventListener('phone-card-sheet-close',()=>{handRelease?.();handRelease=null;gesture?.unset();inspector=null;delete sheet.dataset.inspectKind;sheet.setAttribute('aria-modal','true');for(const b of activeCardButtons())delete b.dataset.cardSelected;updateAction();},{once:true});
      gestureTarget.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}if(e.key==='ArrowRight'){e.preventDefault();step(1);}});gestureTarget.tabIndex=0;gestureTarget.setAttribute('aria-label','卡牌效果，可左右滑動或按方向鍵切換');
    }
    api.inspect=inspect;
    document.addEventListener('click',e=>{if(sheet.dataset.inspectKind==='hand'&&!sheet.contains(e.target)&&!e.target.closest('#playHand,#playDrawn,.phone-card-turn-status'))api.closeSheet();},true);
    for(const [i,control] of activeCardButtons().entries())control.addEventListener('click',e=>{if(forwarding)return;e.preventDefault();e.stopImmediatePropagation();inspect('hand',i);},true);
    const held=document.querySelector('.phone-card-held');
    held?.addEventListener('click',e=>{const img=e.target.closest('img');if(img)inspect('hand',[...held.querySelectorAll('img')].indexOf(img));});
    held?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inspect('hand');}});if(held){held.tabIndex=0;held.setAttribute('role','button');held.setAttribute('aria-label','查看目前手牌效果');}
    players.addEventListener('click',e=>{const row=e.target.closest('#players > div');if(!row||sheet.contains(players))return;api.openPlayers();row.scrollIntoView({block:'nearest'});});
    players.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('#players > div')){e.preventDefault();e.target.click();}});
    $('venues')?.addEventListener('click',e=>{if(e.target.closest('.venue-card')&&!sheet.contains($('venues')))api.openVenues();});
    const pile=$('discard');
    const enlargePileTargets=()=>{for(const [i,img] of [...pile.querySelectorAll('img')].entries()){if(img.parentElement!==pile)continue;const target=make('button','phone-card-discard-target');target.type='button';target.setAttribute('aria-label',`查看第 ${i+1} 張棄牌`);img.before(target);target.append(img);target.onclick=e=>{if(e.target===target)img.click();};}};
    new MutationObserver(enlargePileTargets).observe(pile,{childList:true});enlargePileTargets();
    const logHeading=$('logBox')?.previousElementSibling;
    if(logHeading){logHeading.setAttribute('role','button');logHeading.tabIndex=0;logHeading.setAttribute('aria-label','展開紀錄');logHeading.addEventListener('click',api.openRecords);logHeading.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();api.openRecords();}});}
    const status=make('div','phone-card-turn-status');status.setAttribute('aria-live','polite');hand.before(status);
    const draw=btn('抽一張牌',()=>{const source=$('btnDraw');if(!source.disabled)source.click();else if(!hand.classList.contains('hidden')){if(inspector?.kind==='hand')inspector.commit();else inspect('hand',activeCardButtons()[0].disabled?1:0);}},'phone-card-primary phone-card-draw-action');draw.id='phoneCardDraw';status.append(draw);const message=make('span','');status.prepend(message);
    function updateAction(){const canDraw=!$('btnDraw').disabled,choosing=!hand.classList.contains('hidden');draw.hidden=false;status.hidden=false;draw.disabled=!(canDraw||choosing);draw.textContent=canDraw?'抽一張\n牌':choosing?'選擇\n卡牌':'等待\n回合';if(choosing&&inspector?.kind==='hand'){draw.textContent='打出\n卡牌';draw.disabled=!inspector.canPlay();}draw.setAttribute('aria-label',canDraw?'抽一張牌':choosing&&inspector?.kind==='hand'?'打出選中的卡牌':choosing?'選擇卡牌':'等待其他玩家');}
    let lastStatus='';
    function sync(){
      inspector?.refresh();
      const s=model(),canDraw=!$('btnDraw').disabled,choosing=!hand.classList.contains('hidden');
      const current=players.querySelector('.current .font-semibold');const who=current?.firstChild?.textContent?.trim()||$('turnLbl')?.textContent||'其他玩家';
      const label=canDraw?'輪到你了，先抽一張牌':choosing?'點選卡牌查看效果，再確認打出':s?.phase==='ended'||s?.turnStep==='ended'?'本局結束，查看結果':`等待 ${who} 行動`;
      if(label!==lastStatus){lastStatus=label;message.textContent=label;}
      updateAction();root.dataset.cardAction=canDraw?'draw':choosing?'choose':'wait';
      for(const row of players.children){row.tabIndex=0;row.setAttribute('role','button');row.setAttribute('aria-label',`查看 ${row.querySelector('.font-semibold')?.textContent.trim()||'玩家'} 的狀態`);}
      for(const entry of entriesFor('hand'))entry.control?.setAttribute('aria-label',`查看${entry.name}效果`);
      const hint=$('chooseHint');if(hint&&choosing&&hint.textContent!=='點選卡牌看效果，再確認打出')hint.textContent='點選卡牌看效果，再確認打出';
    }
    let queued=false;const schedule=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;sync();});};
    new MutationObserver(schedule).observe(players,{childList:true,subtree:true});
    new MutationObserver(schedule).observe(hand,{attributes:true,attributeFilter:['class'],subtree:true});
    new MutationObserver(schedule).observe($('btnDraw'),{attributes:true,attributeFilter:['disabled']});
    const modal=$('modal');
    function improveChoices(){
      if(modal.classList.contains('hidden'))return;
      for(const b of modal.querySelectorAll('button[data-i]')){
        if(b.dataset.phoneTarget)continue;const row=players.children[Number(b.dataset.i)];if(!row)continue;
        b.dataset.phoneTarget='true';b.classList.add('phone-card-target');
        const original=b.textContent,avatar=row.querySelector('img.rounded-full'),name=row.querySelector('.font-semibold');
        const text=make('span','phone-card-target-copy'),title=make('strong','',name?.textContent.trim()||original),detail=make('small','',b.disabled?'目前不可選擇':'點選這位玩家');text.append(title,detail);b.replaceChildren();
        if(avatar){const img=avatar.cloneNode();img.removeAttribute('id');img.alt='';b.append(img);}b.append(text);
        const flags=row.querySelector('.grow > .flex.gap-1');if(flags){const copy=make('span','phone-card-target-flags',flags.textContent.trim());b.append(copy);}
      }
    }
    new MutationObserver(improveChoices).observe(modal,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    sync();improveChoices();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();


/* Android presentation module: card-duel-finishers */
/* Cosmetic selection never receives a card id. Only the public loser's face is used. */
(() => {
  function mount(){
    const api=window.CardPhonePresentation;if(!api)return;
    const catalog=[
      ['fire-fist','火拳','burn'],['ice-sphere','冰球','ice'],['triple-slash','三刀斬','slash'],['thunderbolt','雷擊','bolt'],
      ['magma-fist','熔岩拳','melt'],['sandstorm','沙嵐','sand'],['dark-vortex','暗穴','vortex'],['quake-ring','震空','quake'],
      ['paw-cannon','熊掌衝擊','push'],['light-beam','光束','pierce'],['meteor','隕石','crush'],['dragon-breath','熱息','burn-wave'],
      ['phoenix-flame','不死鳥炎','rise'],['poison-dragon','毒龍','poison'],['rubber-barrage','拳槍連打','barrage'],
      ['flame-kick','炎腳','bisect'],['water-dragon','水龍','wash'],['mochi-drill','糯團鑽','drill'],['string-cage','線牢','grid'],['thunder-orb','雷球','orb']
    ];
    let bag=[];function pick(){if(!bag.length){bag=catalog.slice();for(let i=bag.length-1;i>0;i--){const b=new Uint32Array(1);crypto.getRandomValues(b);const j=Math.floor(b[0]/4294967296*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}}return bag.pop();}
    api.duelFinisherCatalog=catalog.map(([id,label,damage])=>({id,label,damage}));
    api.pickDuelFinisher=pick;
    api.playDuelScene=function({scene,from,to,d,bounds,anchor,handAnchor,animate,later,make,name,card,validCard}){
      const hasWinner=[from,to].includes(d.winnerId)&&Number.isInteger(d.winnerId)&&d.winnerId>=0;
      const arena=make('section','phone-duel-arena'),result=make('div','phone-duel-result','決鬥'),versus=make('strong','phone-duel-versus','VS');
      arena.setAttribute('aria-label',`${name(from)} 與 ${name(to)} 決鬥`);arena.dataset.phase='entry';arena.append(result,versus);scene.append(arena);
      const cards=[];
      for(const [i,id]of [from,to].entries()){
        const a=handAnchor(anchor(id,bounds)),slot=make('div','phone-duel-slot'),holder=make('div','phone-duel-card-wrap'),cardNode=make('img','phone-duel-card'),status=make('div','phone-duel-status','手牌保密');
        slot.dataset.player=String(id);slot.dataset.side=i?'right':'left';cardNode.src='images/cards/back.webp';cardNode.alt=name(id)+' 的決鬥卡背';const number=make('strong','phone-duel-number');number.hidden=true;holder.append(cardNode,number);slot.append(make('h3','',name(id)),holder,status);arena.append(slot);
        const r=cardNode.getBoundingClientRect();if(a)animate(cardNode,[{transform:`translate(${a.x-r.x-r.width/2}px,${a.y-r.y-r.height/2}px) scale(.25) rotate(${i?18:-18}deg)`,opacity:0},{transform:'translate(0,0) scale(1)',opacity:1}],1000);
        cards.push({id,a,slot,holder,cardNode,status,number});
      }
      const loser=hasWinner?cards.find(c=>c.id!==d.winnerId):null,finish=hasWinner?api.pickDuelFinisher():null;
      if(finish)arena.dataset.finisher=finish[0];
      later(()=>{
        arena.dataset.phase='attack';versus.textContent='';for(const c of cards)c.status.textContent='交鋒中';
        if(!loser)return;
        const [id,label,damage]=finish;result.textContent=label; // Random cosmetic move, never the winning card's identity.
        const effect=make('div','duel-finisher-art');effect.dataset.finisher=id;effect.setAttribute('aria-hidden','true');loser.holder.append(effect);
        const diagonal=['meteor','thunderbolt','light-beam'].includes(id),spiral=['sandstorm','dark-vortex','mochi-drill','water-dragon'].includes(id),up=['phoenix-flame','poison-dragon'].includes(id);
        const facing=loser.slot.dataset.side==='left'?-1:1;
        animate(effect,[{transform:`translate(${facing*(diagonal?-75:spiral?0:up?0:-60)}%,${diagonal?-90:up?65:0}%) scale(${spiral?.25:.65}) scaleX(${facing}) rotate(${spiral?-100:-12}deg)`,opacity:0},{transform:`translate(0,0) scale(1.05) scaleX(${facing})`,opacity:1,offset:.22},{transform:`translate(${facing*5}%,0) scale(1.18) scaleX(${facing}) rotate(${spiral?60:4}deg)`,opacity:1,offset:.75},{transform:`translate(${facing*(up?0:20)}%,${up?-55:15}%) scale(${spiral?1.7:1.3}) scaleX(${facing}) rotate(${spiral?140:10}deg)`,opacity:0}],3000);
        later(()=>{
          arena.dataset.phase='impact';loser.slot.dataset.damage=damage;
          if(validCard(d.loserCardId)){loser.cardNode.src=card(d.loserCardId);loser.cardNode.alt='公開的敗方手牌';loser.cardNode.dataset.revealed='public-loser';loser.number.textContent=String(d.loserCardId);loser.number.setAttribute('aria-label',`敗方手牌 ${d.loserCardId} 號`);loser.number.hidden=false;}
          damageCard(loser,damage,animate,later,make);
        },650);
      },1200);
      later(()=>{
        arena.dataset.phase='result';arena.dataset.resolved='true';result.textContent=hasWinner?`${name(d.winnerId)} 勝出`:'雙方平手';
        for(const c of cards){c.slot.dataset.outcome=!hasWinner?'draw':c===loser?'lost':'won';c.status.textContent=!hasWinner?'平手 · 手牌不公開':c===loser?'落敗 · 公開手牌':'勝出 · 手牌保密';}
      },7700);
      later(()=>{
        arena.dataset.phase='return';
        for(const c of cards){
          const r=c.cardNode.getBoundingClientRect(),target=c===loser?document.querySelector('.phone-discard-stack')?.getBoundingClientRect():null;
          const a=target?{x:target.x+target.width/2,y:target.y+target.height/2}:c.a;if(!a)continue;
          // A damaged public card returns to the pile; no hidden winner face is queried.
          const fragments=[...c.holder.querySelectorAll('.duel-card-fragment')];
          if(c===loser&&fragments.length){for(const piece of fragments)animate(piece,[{transform:getComputedStyle(piece).transform,opacity:.45},{transform:`translate(${a.x-r.x-r.width/2}px,${a.y-r.y-r.height/2}px) scale(.15)`,opacity:0}],1200);continue;}
          if(c===loser){c.cardNode.getAnimations().forEach(n=>n.cancel());}
          animate(c.cardNode,[{transform:'translate(0,0) scale(1)',opacity:c===loser?.6:1},{transform:`translate(${a.x-r.x-r.width/2}px,${a.y-r.y-r.height/2}px) scale(.2)`,opacity:0}],1200);
        }
      },6300);
    };
    function damageCard(c,kind,animate,later,make){
      const img=c.cardNode;c.holder.dataset.damage=kind;
      // Masks remove the actual card texture. Fragments clone only this publicly revealed loser.
      const hole=['burn','pierce','drill','burn-wave','barrage'].includes(kind);
      if(hole){
        const x=kind==='burn-wave'?28:50,y=kind==='barrage'?40:50;
        img.style.setProperty('--duel-hole-x',x+'%');img.style.setProperty('--duel-hole-y',y+'%');
        const set=n=>{const mask=`radial-gradient(ellipse at ${x}% ${y}%,transparent 0 ${n}%,#000 ${n+2}%)`;img.style.maskImage=mask;img.style.webkitMaskImage=mask;};
        // Timed steps share the scene epoch, so disconnect/background cancels every step.
        for(let n=0;n<=48;n++)later(()=>set(n*(kind==='pierce'?.55:1.2)),n*42);
        animate(img,[{transform:'translate(0,0)',filter:'brightness(1)'},{transform:'translate(7px,-3px)',filter:kind==='burn'?'sepia(1) saturate(2) brightness(.65)':'brightness(1.8)',offset:.2},{transform:kind==='drill'?'rotate(22deg) scale(.7)':'translate(0,0)',filter:'brightness(.5)',opacity:.8}],2400);
        return;
      }
      if(['vortex','melt','poison','push','rise','wash'].includes(kind)){
        const end={vortex:'rotate(300deg) scale(0)',melt:'translateY(80%) scale(1.15,.05)',poison:'translateY(35%) skewX(18deg) scale(.85,.15)',push:'translate(110%,-35%) rotate(35deg) scale(.1)',rise:'translateY(-90%) rotate(-10deg) scale(.6)',wash:'translate(90%,30%) rotate(25deg) scale(.3)'}[kind];
        animate(img,[{transform:'none',opacity:1},{transform:end,filter:kind==='poison'?'hue-rotate(80deg) blur(5px)':kind==='wash'?'blur(8px)':'brightness(.6)',opacity:0}],2400);return;
      }
      const pieces=kind==='bisect'?['polygon(0 0,100% 0,0 100%)','polygon(100% 0,100% 100%,0 100%)']:kind==='slash'?['inset(0 50% 0 0)','inset(0 0 0 50%)']:null;
      const clips=pieces||Array.from({length:kind==='sand'?36:kind==='grid'?16:12},(_,i)=>{const cols=kind==='sand'?6:4,rows=kind==='sand'?6:kind==='grid'?4:3,x=i%cols,y=Math.floor(i/cols);return `polygon(${x/cols*100}% ${y/rows*100}%,${(x+1)/cols*100}% ${y/rows*100}%,${(x+1)/cols*100}% ${(y+1)/rows*100}%,${x/cols*100}% ${(y+1)/rows*100}%)`;});
      img.style.visibility='hidden';
      clips.forEach((clip,i)=>{
        const p=make('img','duel-card-fragment');p.src=img.src;p.alt='';p.setAttribute('aria-hidden','true');p.style.clipPath=clip;c.holder.append(p);
        const sign=i%2?-1:1,angle=i*2.399,dx=pieces?sign*65:Math.cos(angle)*(kind==='sand'?130:70),dy=pieces?sign*28:Math.sin(angle)*65+35;
        const freeze=kind==='ice',delay=freeze?700:kind==='sand'?i*18:0;
        if(freeze)p.style.filter='grayscale(1) sepia(.7) hue-rotate(145deg) saturate(2) brightness(1.4)';
        animate(p,[{transform:'translate(0,0) rotate(0)',opacity:1},{transform:`translate(${dx*.25}px,${dy*.25}px) rotate(${sign*8}deg)`,opacity:1,offset:.35},{transform:`translate(${dx}px,${dy}px) rotate(${sign*(kind==='crush'?85:30)}deg) scale(${kind==='sand'?.2:kind==='orb'?.5:.85})`,opacity:.45}],freeze?1700:2400,delay);
      });
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();


/* Android presentation module: card-hud-combat */
/* Public HUD reactions only. Uses authoritative outcome kinds; never reveals cards. */
(() => {
 function mount(){
  const api=window.CardPhonePresentation;if(!api)return;
  const reactions=new Set();
  api.cancelHudReactions=()=>{for(const a of reactions)a.cancel();reactions.clear();};
  api.playHudAttack=({kind,source,target,detail,scene,make,mark,animate,later})=>{
   if(!['hit','miss','shield-block','dodge-block'].includes(kind)||!source||!target)return false;
   const sniper=kind==='hit'||kind==='miss'||Number.isInteger(detail.digit),evade=kind==='miss'||kind==='dodge-block',shield=kind==='shield-block';
   scene.dataset.attack=sniper?'usopp-green-star':'guarded-effect';scene.dataset.reaction=evade?'evade':shield?'shield':'hit';
   const row=api.playerVisualElement?.(target.id),sign=target.x>innerWidth*.55?-1:1;
   const duration=3600,impactAt=1450,dx=target.x-source.x,dy=target.y-source.y,angle=Math.atan2(dy,dx)*180/Math.PI;
   const sprite=(point,part)=>{const n=mark(point,'phone-sniper-sprite');n.dataset.sprite=part;return n;};
   if(sniper){const scope=sprite(target,'aim');animate(scope,[{transform:'translate(-50%,-50%) scale(1.5) rotate(-40deg)',opacity:0},{transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.45},{transform:'translate(-50%,-50%) scale(.85)',opacity:0}],1400);}
   const projectile=sniper?sprite(source,'seed'):mark(source,'phone-hud-impact');projectile.dataset.flight='attack';
   const t=(x,y,rot=angle,scale=1)=>`translate(calc(-50% + ${x}px),calc(-50% + ${y}px)) rotate(${rot}deg) scale(${scale})`;
   animate(projectile,[{transform:t(0,0,angle,.45),opacity:0},{transform:t(0,0),opacity:1,offset:.1},{transform:t(dx,dy),opacity:1,offset:.65},{transform:t(evade?dx+(dx<0?-130:130):shield?dx*.65:dx,evade?dy-15:shield?dy-80:dy,shield?angle+120:angle,shield?.45:evade?.7:1.2),opacity:0}],1500,500);
   // Announce the public result only after the projectile has reached the target.
   later(()=>{scene.dataset.outcome=kind;const badge=mark(target,'phone-sniper-result');badge.dataset.outcome=kind;badge.textContent=kind==='hit'?'命中！':kind==='miss'?'猜錯・未命中':shield?'護盾擋下':'閃避成功';badge.style.left=Math.max(85,Math.min(innerWidth-85,target.x))+'px';badge.style.top=Math.min(innerHeight-50,target.y+65)+'px';animate(badge,[{opacity:0,transform:'translate(-50%,12px) scale(.8)'},{opacity:1,transform:'translate(-50%,0) scale(1.1)',offset:.15},{opacity:1,transform:'translate(-50%,0)',offset:.85},{opacity:0,transform:'translate(-50%,-8px)'}],1800);},impactAt);
   if(row&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    const frames=evade?[{transform:'translate(0,0)'},{transform:`translate(${sign*48}px,20px) rotate(${sign*5}deg)`,offset:.32},{transform:`translate(${sign*48}px,20px) rotate(${sign*5}deg)`,offset:.64},{transform:'translate(0,0)'}]:[{transform:'translate(0,0)'},{transform:'translate(-5px,3px)',offset:.25},{transform:'translate(5px,0)',offset:.42},{transform:'translate(-3px,0)',offset:.6},{transform:'translate(0,0)'}];
    const a=row.animate(frames,{duration:evade?2200:1100,delay:evade?750:1450,easing:'ease-in-out'});reactions.add(a);a.finished.then(()=>{a.cancel();reactions.delete(a);},()=>reactions.delete(a));
   }
   if(shield){
    const guard=mark(target,'phone-hud-defense');guard.dataset.status='protect';guard.dataset.block='true';
    animate(guard,[{transform:'translate(-50%,-50%) scale(.4)',opacity:0},{transform:'translate(-50%,-50%) scale(1.15)',opacity:1,offset:.25},{transform:'translate(-50%,-50%) scale(1.28)',opacity:1,offset:.58},{transform:'translate(-50%,-50%) scale(1)',opacity:0}],duration);
    later(()=>{const spark=mark(target,'phone-hud-impact');spark.dataset.impact='shield';animate(spark,[{transform:'translate(-50%,-50%) scale(.3)',opacity:0},{transform:'translate(-50%,-50%) scale(1.05)',opacity:1,offset:.3},{transform:'translate(-50%,-50%) scale(1.4)',opacity:0}],1000);},1450);
   }else if(evade){
    const swoosh=sprite(target,'evade');animate(swoosh,[{transform:'translate(-65%,-50%) scale(.4)',opacity:0},{transform:'translate(-40%,-50%) scale(1.1)',opacity:1,offset:.4},{transform:'translate(-10%,-50%) scale(1.4)',opacity:0}],1400,1100);
    const avatar=row?.querySelector('img.rounded-full');
    if(avatar)for(const [i,offset]of [0,20].entries()){const ghost=make('img','phone-evade-afterimage');ghost.src=avatar.src;ghost.alt='';ghost.style.left=target.x+'px';ghost.style.top=target.y+'px';scene.append(ghost);animate(ghost,[{transform:'translate(-50%,-50%)',opacity:0},{transform:`translate(calc(-50% + ${sign*offset}px),-35%)`,opacity:.4-i*.1,offset:.4},{transform:`translate(calc(-50% + ${sign*(offset+35)}px),-15%)`,opacity:0}],1800,550+i*90);}
    if(kind==='dodge-block'){const art=mark(target,'phone-hud-defense');art.dataset.status='dodge';animate(art,[{transform:'translate(-50%,-50%) scale(.6)',opacity:0},{transform:`translate(calc(-50% + ${sign*28}px),-35%) scale(1)`,opacity:1,offset:.5},{opacity:0}],2200);}
   }else later(()=>{const hit=sprite(target,'impact');animate(hit,[{transform:'translate(-50%,-50%) scale(.2)',opacity:0},{transform:'translate(-50%,-50%) scale(1.35)',opacity:1,offset:.16},{transform:'translate(-50%,-50%) scale(1.15)',opacity:1,offset:.65},{transform:'translate(-50%,-50%) scale(1.45)',opacity:0}],1700);const shards=sprite(target,'fragments');animate(shards,[{transform:'translate(-50%,-50%) scale(.3)',opacity:0},{transform:'translate(-50%,-50%) scale(1.3)',opacity:1,offset:.3},{transform:'translate(-50%,-30%) scale(1.8)',opacity:0}],1800);},impactAt);
   return true;
  };
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();


/* Android presentation module: card-phone-fx */
/* Presentation only. Original callbacks, routed EMITs and viewer-visible STATE
 * remain authoritative. No gameplay commands or hidden-state reads. */
(() => {
  'use strict';
  const origin=window.__TABLETOP_ANDROID_TEST_ORIGIN||'https://onepiece-card-online.onrender.com';
  if(location.origin!==origin||!['/game.html','/tutorial.html'].includes(location.pathname))return;
  function mount(){
    const root=document.documentElement;
    if(!root.dataset.cardPhone||root.dataset.cardFx)return;
    root.dataset.cardFx='1';root.dataset.cardCinema='1';
    const $=id=>document.getElementById(id),make=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text!=null)n.textContent=text;return n;};
    const current=()=>typeof state==='object'?state:null,viewer=()=>typeof me==='object'?me.playerId:null;
    const name=id=>current()?.players?.[id]?.client?.displayName||current()?.players?.[id]?.displayName||(Number.isInteger(id)&&id>=0?`P${id+1}`:'全體玩家');
    const validCard=id=>Number.isInteger(id)&&id>=0&&id<20;
    const card=id=>validCard(id)?`images/cards/${id}.webp`:'images/cards/back.webp';
    const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fast=()=>typeof isCpuSkipFastMode==='function'&&isCpuSkipFastMode();
    const modal=$('modal'),layer=make('div','phone-interaction-fx');layer.id='phoneInteractionFx';layer.setAttribute('aria-live','polite');layer.setAttribute('aria-atomic','true');document.body.append(layer);
    const actions={usopp:[1,'狙擊瞄準','選擇對手，再猜手牌尾數'],robin:[2,'偵察手牌','只有偵察者能看見手牌內容'],sanji:[3,'決鬥','選擇要決鬥的對手'],zoro:[5,'斬擊棄牌','選擇技能目標'],law:[6,'ROOM・交換','選擇交換對象'],nami:[7,'雷電麻痺','選擇技能目標'],luffy:[8,'連續挑戰','依原規則選擇對手'],kaido:[10,'雷鳴八卦','選擇技能目標'],killer:[13,'解除防禦','選擇技能目標'],bigmom:[14,'靈魂威嚇','由對手選擇交幣或淘汰'],'bigmom-pay':[14,'靈魂抉擇','選擇交幣或淘汰'],'bigmom-coin':[14,'命運判定','依原規則擲硬幣'],queen:[12,'硬幣判定','依原規則決定結果'],'kata-order':[15,'預見未來','查看並安排原本的頂牌順序'],aokiji:[16,'冰凍時刻','選擇技能目標'],'teach-multipick':[17,'黑暗覆蓋','選擇原本允許覆蓋的牌'],roger:[19,'預測勝者','選擇你預測的玩家']};
    function avatar(id){const source=$('players')?.children[id]?.querySelector('img.rounded-full');const img=make('img','phone-fx-avatar');img.alt=name(id);if(source?.src)img.src=source.src;else img.src='images/cards/back.webp';return img;}
    const effectBorrows=new Set();
    let deferredResults=[];window.CardPhonePresentation.flushDeferredResults=()=>{for(const text of deferredResults.splice(0))burst('notice',null,null,text);};
    let fxTimer=null,queuedFx=[],activeFx=null,layoutFrame=0,lastGuess=null,fxEpoch=0;const fxDelays=new Set();
    function later(fn,ms){const epoch=fxEpoch,t=setTimeout(()=>{fxDelays.delete(t);if(epoch===fxEpoch)fn();},ms);fxDelays.add(t);return t;}
    function cancelDelays(){for(const release of effectBorrows)release();effectBorrows.clear();window.CardPhonePresentation.cancelHudReactions?.();fxEpoch++;for(const t of fxDelays)clearTimeout(t);fxDelays.clear();}
    const statusLayer=make('div','phone-interaction-fx');statusLayer.id='phonePlayerStatusFx';document.body.append(statusLayer);
    const videoOpen=()=>!$('enhOverlay')?.classList.contains('hidden')||!!window.CardPhonePresentation?.isCoinBusy?.();
    function enqueue(fx){queuedFx.push(fx);}
    function resumeFx(){if(!fxTimer&&!videoOpen()&&!window.CardPhonePresentation?.isCardEntering?.()){if(privateQueued){flushPrivate();return;}if(privateOpen)return;const next=queuedFx.shift();if(next)renderBurst(...next);}}
    document.addEventListener('phone-card-center-ready',resumeFx);
    const players=$('players'),focusLayer=make('div','phone-hud-focus');focusLayer.id='phoneHudFocus';focusLayer.setAttribute('aria-hidden','true');document.body.append(focusLayer);
    function railBounds(){
      if(!players?.closest('main'))return null;
      const r=players.getBoundingClientRect();if(!r.width||!r.height)return null;
      root.style.setProperty('--phone-roster-bottom',Math.ceil(r.bottom+6)+'px');
      return r;
    }
    function anchor(id,rail){
      const row=window.CardPhonePresentation?.playerVisualElement?.(id)||players.children[id],img=row?.querySelector('img.rounded-full');if(!row||!img)return null;
      const r=img.getBoundingClientRect(),x=r.left+r.width/2;
      const self=row.id==='phoneSelfPlayer',clipped=!self&&(x<rail.left+24||x>rail.right-24);
      return {id,x:self?x:Math.max(rail.left+24,Math.min(rail.right-24,x)),y:r.top+r.height/2,clipped,self};
    }
    function clearFx(){deferredResults=[];cancelDelays();delete root.dataset.cardFxPhase;statusLayer.replaceChildren();clearTimeout(fxTimer);fxTimer=null;activeFx=null;queuedFx=[];lastGuess=null;layer.replaceChildren();}
    function burst(kind,from,to,label,detail){
      if(kind==='notice')detail={title:'戰況播報',result:label};
      const outcome=['hit','miss','shield-block','dodge-block'].includes(kind);
      if(outcome)queuedFx=queuedFx.filter(f=>!(f[0]==='shot'&&f[1]===from&&f[2]===to));
      const replacesGuess=outcome&&activeFx?.[0]==='shot'&&activeFx[1]===from&&activeFx[2]===to;
      if(videoOpen()||privateOpen||window.CardPhonePresentation?.isCardEntering?.()||fxTimer){enqueue([kind,from,to,label,detail]);return;}
      renderBurst(kind,from,to,label,detail);
    }
    function renderBurst(kind,from,to,label,detail={}){
      const rail=railBounds();if(!rail||document.hidden||fast())return;
      cancelDelays();clearTimeout(fxTimer);activeFx=[kind,from,to,label,detail];layer.replaceChildren();layer.dataset.kind=kind;
      const scene=make('div','phone-hud-scene');scene.dataset.source=String(from);scene.dataset.target=String(to);scene.dataset.phase='narration';layer.append(scene);root.dataset.cardFxPhase='narration';
      const title=detail.title||(Number.isInteger(from)?name(from)+(Number.isInteger(to)&&to!==from?' → '+name(to):''):'戰況播報');
      const result=detail.result||label,notice=make('div','phone-action-notice');notice.dataset.action=kind;
      const symbol=make('strong','phone-action-symbol',Number.isInteger(detail.digit)?String(detail.digit):kind==='swap'?'⇄':'');if(detail.status&&!Number.isInteger(detail.digit))symbol.dataset.status=detail.status;
      if(!symbol.textContent&&!detail.status)symbol.hidden=true;
      const neutral={hit:'騙人布・綠星狙擊',miss:'騙人布・綠星狙擊',swap:'準備交換手牌',slash:'斬擊手牌',lightning:'雷電攻擊',ice:'冰凍攻擊',break:'解除防禦',guard:'防禦技能發動','shield-block':'護盾展開','dodge-block':'閃避發動',discard:'手牌移入棄牌堆'};
      const copy=make('div','phone-action-copy');copy.append(make('strong','',title),make('span','',neutral[kind]||result));notice.append(symbol,copy);scene.append(notice);
      notice.style.top=Math.min(innerHeight-100,rail.bottom+10)+'px';notice.style.width=Math.min(640,innerWidth-32)+'px';notice.style.left='50%';
      const reading=['aim','select','shot'].includes(kind)?900:Math.min(3800,Math.max(2200,(title.length+result.length)*65));scene.dataset.readingMs=String(reading);
      const duration=kind==='duel'?9200:kind==='notice'?400:kind==='scan'?2900:['hit','miss','shield-block','dodge-block'].includes(kind)?3600:1800;
      function mark(a,cls){const n=make('span',cls);n.dataset.player=String(a.id);n.style.left=a.x+'px';n.style.top=a.y+'px';scene.append(n);return n;}
      function animate(n,frames,ms=1400,delay=0){if(reduce())return;n.animate(frames,{duration:ms,delay,easing:'cubic-bezier(.2,.7,.25,1)',fill:'both'});}
      function handAnchor(a){if(a?.id!==viewer())return a;const r=window.CardPhonePresentation?.cardPlayerRect?.(a.id);return r?{...a,x:r.left+r.width/2,y:r.top+r.height/2}:a;}
      function travel(a,b,reverse=false){a=handAnchor(a);b=handAnchor(b);if(!a||!b||a.id===b.id)return;const n=make('img','phone-hud-card');n.src='images/cards/back.webp';n.alt='';n.dataset.from=String(a.id);n.dataset.to=String(b.id);n.style.left=a.x+'px';n.style.top=a.y+'px';scene.append(n);const dx=b.x-a.x,dy=b.y-a.y;animate(n,[{transform:'translate(-50%,-50%) scale(.7)',opacity:0},{transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.1},{transform:`translate(calc(-50% + ${dx/2}px),calc(-50% + ${dy/2+(reverse?-35:35)}px)) rotate(${reverse?-15:15}deg)`,opacity:1,offset:.5},{transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.6)`,opacity:0}],1600);}
      later(()=>{
        scene.dataset.phase='effect';root.dataset.cardFxPhase='effect';notice.hidden=true;
        const bounds=railBounds()||rail,source=anchor(from,bounds),ids=Number.isInteger(to)&&to>=0?[to]:['guard','skill','discard'].includes(kind)?[from]:[...(current()?.players||[])].flatMap((p,i)=>p.alive&&i!==from?[i]:[]);
        if(detail.open){if(kind==='video'){clearTimeout(fxTimer);fxTimer=null;activeFx=null;layer.replaceChildren();delete root.dataset.cardFxPhase;}detail.open();return;}
        if(kind==='notice')return;
        if(source){const origin=mark(source,'phone-hud-origin');animate(origin,[{transform:'translate(-50%,-50%) scale(.8)',opacity:0},{transform:'translate(-50%,-50%) scale(1.1)',opacity:1,offset:.3},{transform:'translate(-50%,-50%) scale(1.2)',opacity:0}],duration);}
        if(kind==='duel'&&detail.duel){window.CardPhonePresentation.playDuelScene({scene,from,to,d:detail.duel,bounds,anchor,handAnchor,animate,later,make,name,card,validCard});return;}
        for(const id of ids){const target=['slash','discard'].includes(kind)?handAnchor(anchor(id,bounds)):anchor(id,bounds);if(!target)continue;
          if(kind==='swap'){if(from===viewer()||id===viewer())window.CardPhonePresentation?.maskHandArt?.();travel(source,target);travel(target,source,true);continue;}
          if(kind==='scan'){if(id===viewer()&&id!==from){const node=window.CardPhonePresentation.ownHandElement?.(),release=window.CardPhonePresentation.borrowCardVisual?.(node);if(release){effectBorrows.add(release);later(()=>{const a={left:source.x-24,top:source.y-36,width:48,height:72},done=()=>{release();effectBorrows.delete(release);};if(!window.CardPhonePresentation.flyCard?.({from:a,to:node,src:'images/cards/back.webp',kind:'scan-return',hideTarget:false,replace:false,onFinish:done}))done();},1600);}}const scope=mark(target,'phone-hud-lock');animate(scope,[{transform:'translate(-50%,-50%) scale(1.4)',opacity:0},{transform:'translate(-50%,-50%) scale(.9)',opacity:1,offset:.5},{opacity:0}],1500);if(from!==viewer())travel(target,source);continue;}
          if(['slash','lightning','ice'].includes(kind)){
            const art=mark(target,'phone-effect-art');art.dataset.effect=kind;
            const frames=kind==='slash'?[{transform:'translate(-80%,-65%) scale(.5) rotate(-20deg)',opacity:0},{transform:'translate(-50%,-50%) scale(1.15) rotate(0)',opacity:1,offset:.35},{transform:'translate(-25%,-35%) scale(1.3) rotate(12deg)',opacity:0}]:kind==='lightning'?[{transform:'translate(-50%,-85%) scaleY(.2)',opacity:0},{transform:'translate(-50%,-65%) scaleY(1)',opacity:1,offset:.25},{transform:'translate(-50%,-65%) scale(1.04)',opacity:.8,offset:.75},{opacity:0}]:[{transform:'translate(-50%,-50%) scale(.35)',opacity:0},{transform:'translate(-50%,-50%) scale(1.1)',opacity:1,offset:.6},{transform:'translate(-50%,-50%) scale(1.15)',opacity:0}];animate(art,frames,1700);continue;
          }
          if(kind==='break'){
            for(const sign of [-1,1]){const half=mark(target,'phone-hud-defense');half.dataset.status='protect';half.style.clipPath=sign<0?'inset(0 50% 0 0)':'inset(0 0 0 50%)';animate(half,[{transform:'translate(-50%,-50%)',opacity:1},{transform:`translate(calc(-50% + ${sign*40}px),-15%) rotate(${sign*30}deg)`,opacity:0}],1500);}continue;
          }
          if(source&&window.CardPhonePresentation.playHudAttack?.({kind,source,target,detail,scene,make,mark,animate,later}))continue;
          if(detail.status){const art=mark(target,'phone-hud-defense');art.dataset.status=detail.status;animate(art,detail.status==='dodge'?[{transform:'translate(-80%,-50%)',opacity:0},{transform:'translate(-35%,-50%)',opacity:1,offset:.4},{transform:'translate(0,-50%)',opacity:0}]:[{transform:'translate(-50%,-50%) scale(.4)',opacity:0},{transform:'translate(-50%,-50%) scale(1.15)',opacity:1,offset:.35},{transform:'translate(-50%,-50%) scale(1)',opacity:0}],1700);continue;}
          if(['shot','hit','miss','aim'].includes(kind)){
            const scope=mark(target,'phone-hud-lock');animate(scope,[{transform:'translate(-50%,-50%) scale(1.7) rotate(-35deg)',opacity:0},{transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.5},{opacity:0}],1500);
            if(kind==='hit'){const hit=mark(target,'phone-hud-impact');animate(hit,[{opacity:0,transform:'translate(-50%,-50%) scale(.2)'},{opacity:1,transform:'translate(-50%,-50%) scale(1.2)',offset:.5},{opacity:0}],800,800);}continue;
          }
          const pulse=mark(target,'phone-hud-origin');animate(pulse,[{transform:'translate(-50%,-50%) scale(.7)',opacity:0},{transform:'translate(-50%,-50%) scale(1.4)',opacity:1,offset:.4},{transform:'translate(-50%,-50%) scale(1.7)',opacity:0}],1500);
        }
      },reading);
      const deferResult=!!neutral[kind]&&window.CardPhonePresentation.deferResultText;if(deferResult)deferredResults.push(title+'：'+result);
      if(neutral[kind]&&!deferResult)later(()=>{scene.dataset.phase='result';root.dataset.cardFxPhase='result';notice.hidden=false;copy.lastChild.textContent=result;},reading+duration);
      fxTimer=setTimeout(()=>{layer.replaceChildren();delete root.dataset.cardFxPhase;fxTimer=null;activeFx=null;resumeFx();},reading+duration+(neutral[kind]&&!deferResult?1300:0));
    }
    // Persistent public defense icons are anchored to the original portraits.
    const defenseLayer=make('div','phone-defense-badges');defenseLayer.id='phoneDefenseBadges';document.body.append(defenseLayer);let defenseSignature='';
    function syncDefense(){
      const rail=railBounds(),s=current();if(!rail||!s?.players){defenseLayer.replaceChildren();defenseSignature='';return;}
      const items=[];s.players.forEach((p,id)=>{if(!p.alive)return;const a=anchor(id,rail),row=window.CardPhonePresentation?.playerVisualElement?.(id)||players.children[id],box=row?.querySelector('.grow')?.getBoundingClientRect();if(!a||a.clipped||!box?.width)return;let n=0;for(const [key,status]of [['protected','protect'],['dodging','dodge']])if(p[key])items.push({id,status,x:box.right-26-24*n++,y:box.bottom-25});});
      const signature=JSON.stringify(items);if(signature===defenseSignature)return;defenseSignature=signature;defenseLayer.replaceChildren();
      for(const item of items){const icon=make('span','phone-defense-badge');icon.dataset.player=String(item.id);icon.dataset.status=item.status;icon.style.left=item.x+'px';icon.style.top=item.y+'px';icon.title=icon.ariaLabel=`${name(item.id)}：${item.status==='protect'?'護盾保護中':'閃避待觸發'}`;icon.setAttribute('role','img');defenseLayer.append(icon);}
    }
    let defenseFrame=0;
    new MutationObserver(()=>{if(!defenseFrame)defenseFrame=requestAnimationFrame(()=>{defenseFrame=0;syncDefense();});}).observe(players,{childList:true,subtree:true});
    function refreshAnchors(){if(layoutFrame)return;layoutFrame=requestAnimationFrame(()=>{layoutFrame=0;if(!railBounds()){clearFx();focusLayer.replaceChildren();return;}if(activeFx){const notice=layer.querySelector('.phone-action-notice');if(notice){notice.style.width=Math.min(640,innerWidth-32)+'px';notice.style.top=Math.min(innerHeight-100,railBounds().bottom+10)+'px';}}decorate();});}
    players.addEventListener('scroll',refreshAnchors,{passive:true});window.addEventListener('resize',refreshAnchors,{passive:true});
    new ResizeObserver(refreshAnchors).observe(players);
    // Select through the actual upper player entry, forwarding to the original modal button.
    players.addEventListener('click',e=>{const row=e.target.closest('#players > div');if(!row||modal.classList.contains('hidden')||modal.dataset.interaction!=='target')return;const i=[...players.children].indexOf(row),button=modal.querySelector(`button[data-i="${i}"]`);if(!button)return;e.preventDefault();e.stopImmediatePropagation();if(!button.disabled)button.click();},true);
    function decorate(){
      railBounds();syncDefense();
      for(const row of players.children)delete row.dataset.fxTarget;
      const box=modal?.querySelector('.card');if(!box||modal.classList.contains('hidden')){focusLayer.replaceChildren();delete modal.dataset.interaction;flushPrivate();return;}
      const pending=current()?.pending,info=actions[pending?.action];
      const stage=box.querySelector('[data-d]')?'guess':box.querySelector('[data-i]')?'target':'choice';
      modal.dataset.interaction=info?stage:'choice';
      if(info&&stage==='target')for(const b of box.querySelectorAll('button[data-i]')){const row=players.children[Number(b.dataset.i)];if(row)row.dataset.fxTarget=b.disabled?'disabled':'available';}
      if(info&&stage==='guess'){let id=pending.extra?.target;if(id==null&&typeof localPending==='object')id=localPending?.target;const rail=railBounds(),a=rail&&anchor(id,rail);if(a){let lock=focusLayer.firstElementChild;if(!lock){lock=make('span','phone-hud-lock');focusLayer.append(lock);}lock.dataset.player=String(id);lock.style.left=a.x+'px';lock.style.top=a.y+'px';}else focusLayer.replaceChildren();}else focusLayer.replaceChildren();
      if(!info||box.querySelector('.phone-skill-intro'))return;
      const intro=make('div','phone-skill-intro'),art=make('img','');art.src=card(info[0]);art.alt='';
      const copy=make('div','');copy.append(make('strong','',stage==='guess'?'騙人布・狙擊瞄準':info[1]));
      let target=pending.extra?.target;if(target==null&&typeof localPending==='object')target=localPending?.target;
      copy.append(make('span','',stage==='guess'?`目標：${name(target)} · 猜尾數（不能選 1）`:info[2]));
      intro.append(art,copy);
      if(stage==='guess'){const heading=box.querySelector('.text-lg');if(heading)heading.textContent=`${name(target)} · 猜尾數（不能選 1）`;const scope=make('div','phone-fx-scope');scope.append(avatar(target));intro.append(scope);}
      box.prepend(intro);
    }
    // Capture only visual feedback; the original enabled button still handles it.
    modal?.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b||b.disabled)return;
      if(!reduce())b.animate([{filter:'brightness(1.5)'},{filter:'brightness(1)'}],{duration:240});
      const p=current()?.pending;
      if(b.hasAttribute('data-i'))burst(p?.action==='usopp'?'aim':'select',viewer(),Number(b.dataset.i),p?.action==='usopp'?'鎖定目標':'選定對象');
      if(b.hasAttribute('data-d')){const target=p?.extra?.target??(typeof localPending==='object'?localPending?.target:null);burst('shot',viewer(),target,`狙擊尾數 ${b.dataset.d} · 等待判定`,{digit:Number(b.dataset.d),title:`${name(viewer())} 猜 ${name(target)}`,result:'選擇尾數 · 等待判定'});}
    },true);
    new MutationObserver(decorate).observe(modal,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});

    // Private reveals never use a public event's cardId or another player's hand.
    let privateItems=[],privateQueued=false,privateOpen=false,privateReleases=[];
    const reveal=make('section','phone-private-reveal');reveal.id='phonePrivateReveal';reveal.hidden=true;reveal.dataset.layout='grid';reveal.setAttribute('role','dialog');reveal.setAttribute('aria-modal','false');reveal.setAttribute('aria-label','只有你可見的偵察結果');document.body.append(reveal);
    function clearPrivate(animateReturn=false){
      const api=window.CardPhonePresentation,returns=[...reveal.querySelectorAll('figure')].map((n,i)=>({rect:n.querySelector('img')?.getBoundingClientRect(),item:reveal._items?.[i]})),releases=privateReleases.splice(0);
      api.cancelCardFlights?.('peek');privateItems=[];privateQueued=false;privateOpen=false;reveal.hidden=true;reveal.replaceChildren();reveal._items=null;
      let pending=1;const done=()=>{if(--pending===0){for(const release of releases)release?.();queueMicrotask(resumeFx);}};
      if(animateReturn)for(const {rect,item} of returns){if(!rect||!validCard(item?.id))continue;pending++;if(!api.flyCard?.({from:rect,to:api.cardPlayerRect?.(item.from)||$('btnDraw'),src:'images/cards/back.webp',kind:'peek-return',hideTarget:false,onFinish:done}))done();}
      done();
    }
    window.CardPhonePresentation.isEffectBusy=()=>!!fxTimer||queuedFx.length>0||privateQueued||privateOpen;
    window.CardPhonePresentation.clearPrivateReveal=clearPrivate;
    function flushPrivate(){
      if(fxTimer||window.CardPhonePresentation?.isCardEntering?.()||!privateQueued||!privateItems.length||(!root.dataset.cardFlow&&!modal.classList.contains('hidden'))||videoOpen())return;
      const api=window.CardPhonePresentation;api.cancelCardFlights?.('peek');for(const release of privateReleases.splice(0))release?.();privateQueued=false;privateOpen=true;reveal.hidden=false;reveal.replaceChildren();
      const head=make('header',''),close=make('button','phone-card-control','看完了・返回牌桌');close.id='phonePrivateDone';close.type='button';close.addEventListener('click',()=>clearPrivate(true));head.append(make('strong','','偵察結果 · 僅你可見'),close);
      const body=make('div','phone-private-cards'),items=privateItems.slice();reveal._items=items;reveal.dataset.count=String(items.length);
      const columns=Math.min(items.length,6),rows=Math.ceil(items.length/columns);body.style.setProperty('--reveal-columns',columns);body.style.setProperty('--reveal-rows',rows);
      for(const item of items){const figure=make('figure','');figure.dataset.owner=Number.isInteger(item.from)?String(item.from):'';figure.append(make('figcaption','',Number.isInteger(item.from)?name(item.from)+' 的手牌':item.label));if(validCard(item.id)){const img=make('img','');img.src=card(item.id);img.alt=(typeof CARD_TEXT==='object'?CARD_TEXT[item.id]?.name:'')||'已揭曉的牌';figure.append(img);const number=make('span','phone-reveal-number',String(item.id));number.setAttribute('aria-label','卡牌號碼 '+item.id);figure.append(number);}else figure.append(make('p','',item.text));body.append(figure);}
      reveal.append(head,body);
      if(items.some(item=>item.from===viewer())){const release=api.borrowCardVisual?.(api.ownHandElement?.());if(release)privateReleases.push(release);}
      requestAnimationFrame(()=>{if(!privateOpen||reveal._items!==items)return;for(let i=0;i<items.length;i++){const item=items[i],img=body.children[i]?.querySelector('img');if(img)api.flyCard?.({from:api.cardPlayerRect(item.from)||$('btnDraw'),to:img,src:img.src,flip:true,kind:'peek'});}});
    }
    function addPrivate(items){if(!privateOpen&&!privateQueued)privateItems=[];privateItems.push(...items);privateItems=privateItems.slice(-12);privateQueued=true;queueMicrotask(flushPrivate);}
    const eventFx={usopp_hit:['hit','狙擊命中'],usopp_miss:['miss','狙擊未命中'],robin_peek:['scan','偵察手牌'],law_swap:['swap','交換手牌'],zoro_discard:['slash','斬擊棄牌'],nami_paralyze:['lightning','麻痺生效'],aokiji_freeze:['ice','凍結生效'],killer_disarm:['break','解除防禦'],chopper_status:['guard','防禦狀態'],bigmom_status:['guard','防禦狀態']};
    function onEvent(e){
      if(window.CardPhonePresentation?.committingPresentation)return;
      if(!e||typeof e!=='object')return;
      if(e.to!=null&&e.to!=='all'&&e.to!==viewer())return;
      if(e.type==='card_guess'&&e.to==='all'&&Number.isInteger(e.digit)&&e.digit>=0&&e.digit<=9){lastGuess={from:e.casterId,to:e.targetId,digit:e.digit};burst('shot',e.casterId,e.targetId,'等待判定',{digit:e.digit,title:`${name(e.casterId)} 猜 ${name(e.targetId)}`,result:'選擇尾數 · 等待判定'});return;}
      if(e.type==='card_defense'&&e.to==='all'&&['protect','dodge'].includes(e.status)){const guess=lastGuess?.from===e.casterId&&lastGuess?.to===e.targetId?lastGuess:null;burst(e.status==='protect'?'shield-block':'dodge-block',e.casterId,e.targetId,e.status==='protect'?'護盾擋下':'閃避成功',{status:e.status,digit:guess?.digit,title:`${name(e.casterId)} → ${name(e.targetId)}`,result:`${e.status==='protect'?'護盾擋下效果':'閃避成功 · 已消耗'}${guess?' · 未判定猜中／猜錯':''}`});lastGuess=null;return;}
      if(!root.dataset.cardFlow&&e.type==='log'&&e.to==='all'&&typeof e.text==='string'&&/^(薩波|基德|紅髮|香克斯|羅傑|奎因|大媽)/.test(e.text)){burst('notice',null,null,e.text);return;}
      const visual=eventFx[e.type];
      if(visual){let detail;
        if(e.type.startsWith('usopp_')){detail={digit:e.digit,title:`${name(e.casterId)} 猜 ${name(e.targetId)}`,result:e.type==='usopp_hit'?'猜中！狙擊命中':'猜錯 · 狙擊未命中'};lastGuess=null;}
        else if(e.type==='law_swap')detail={title:`${name(e.casterId)} ⇄ ${name(e.targetId)}`,result:'兩人已交換手牌'};
        else if(['chopper_status','bigmom_status'].includes(e.type)&&['protect','dodge'].includes(e.status))detail={status:e.status,title:name(e.casterId),result:e.status==='protect'?'獲得護盾 · 保護中':'獲得閃避 · 等待觸發'};
        burst(visual[0],e.casterId,e.all||e.mode==='all'?null:e.targetId??e.casterId,visual[1]+(e.type.startsWith('usopp_')?` · 尾數 ${e.digit}`:''),detail);return;}
      if(e.type==='duel')return; // The original public duel_log invokes the sequenced wrapper.
      if(e.type==='silent_discard')return; // No card face: event can contain non-public IDs.
      if(e.type==='play_fx'){const label=validCard(e.cardId)&&typeof CARD_TEXT==='object'?CARD_TEXT[e.cardId]?.name:'技能';burst('skill',e.playerId,null,`${label}發動`);return;}
      if(e.to!==viewer()||viewer()==null)return; // Private data requires explicit server recipient.
      if(e.type==='robin_view'&&validCard(e.cardId))addPrivate([{id:e.cardId,label:name(e.targetId),from:e.targetId}]);
      else if(e.type==='kata_peek'||e.type==='teach_cover')addPrivate((e.cards||[]).filter(validCard).map((id,i)=>({id,label:e.type==='kata_peek'?`頂牌 ${i+1}`:`覆蓋牌 ${i+1}`})));
      else if(e.type==='peek')addPrivate((e.lines||[]).filter(s=>typeof s==='string').map(text=>({text,label:'偵察情報'})));
      // law_view is owned by the original swap-confirm dialog; animate its image via CSS.
    }
    if(typeof playEnhFxFor==='function'){const originalVideo=playEnhFxFor;playEnhFxFor=function(id){if(fast()||window.CardPhonePresentation?.committingPresentation)return;const title=validCard(id)&&typeof CARD_TEXT==='object'?CARD_TEXT[id]?.name:'強化招式';burst('video',null,null,'強化招式發動',{title:title||'強化招式',result:'強化效果發動',open:()=>originalVideo(id)});};}
    if(typeof playDuel==='function')playDuel=function(opts){if(!opts||window.CardPhonePresentation?.committingPresentation)return;burst('duel',opts.leftId,opts.rightId,'決鬥開始',{duel:opts,title:`${name(opts.leftId)} 對決 ${name(opts.rightId)}`,result:'雙方卡牌進場，準備對決'});};
    function showLawComparison(target,id){
      const host=$('lawSwapModal'),targetImg=$('lawTargetImg');if(!host||!targetImg)return;
      let grid=host.querySelector('.phone-law-comparison');
      if(!grid){grid=make('div','phone-law-comparison');const originalRow=targetImg.parentElement;originalRow.before(grid);originalRow.hidden=true;const own=make('figure',''),other=make('figure','');own.id='phoneLawOwnCard';other.id='phoneLawTargetCard';own.append(make('figcaption',''),make('img',''));other.append(make('figcaption',''));other.append(targetImg);grid.append(own,other);}
      const p=current()?.players?.[viewer()],ownId=p?.hand??p?.tempDraw,own=grid.children[0],other=grid.children[1];
      own.dataset.owner=String(viewer());other.dataset.owner=String(target);own.querySelector('figcaption').textContent=name(viewer())+' 的手牌';other.querySelector('figcaption').textContent=name(target)+' 的手牌';
      own.querySelector('img').src=card(ownId);own.querySelector('img').alt=validCard(ownId)?'你保留的手牌 '+ownId:'你的未公開手牌';targetImg.src=card(id);targetImg.alt='已允許查看的手牌 '+id;
      host.dataset.compareTarget=String(target);host.dataset.compareCard=String(id);
    }
    socket.on('STATE',()=>{const host=$('lawSwapModal');if(host&&!host.classList.contains('hidden')&&host.dataset.compareTarget!=null)queueMicrotask(()=>showLawComparison(Number(host.dataset.compareTarget),Number(host.dataset.compareCard)));});
    if(typeof openLawSwap==='function'){const originalOpen=openLawSwap;openLawSwap=function(target,id){if(window.CardPhonePresentation?.committingPresentation)return;burst('scan',viewer(),target,'偵察手牌',{title:`${name(viewer())} 查看 ${name(target)}`,result:'偵察結果僅你可見',open:()=>{originalOpen(target,id);showLawComparison(target,id);}});};}
    window.CardPhonePresentation.presentEffectEvent=onEvent;
    let lastPublic=null,lastRound=null,lastIdentity=null;
    function onState(s){
      if(!s?.players)return;
      const identity=JSON.stringify([typeof me==='object'?me.roomId:null,viewer()]);if(lastIdentity!==null&&identity!==lastIdentity){clearPrivate();lastPublic=null;clearFx();}lastIdentity=identity;
      const round=s.roundNo;if(lastRound!=null&&round!==lastRound){clearPrivate();lastPublic=null;clearFx();}lastRound=round;
      const snapshot=s.players.map(p=>({alive:p.alive,protected:p.protected,dodging:p.dodging,frozen:p.frozen,skipNext:p.skipNext,iceArmed:p.iceArmed,iceInfected:p.iceInfected,gold:p.gold}));
      if(lastPublic&&lastPublic.length===snapshot.length){snapshot.forEach((p,i)=>{const before=lastPublic[i];const changes=[];for(const [key,label]of [['protected','保護'],['dodging','閃避'],['frozen','凍結'],['skipNext','麻痺'],['iceArmed','冰鬼檢查'],['iceInfected','冰鬼感染']])if(!!p[key]!==!!before[key])changes.push(p[key]?`${label}獲得`:`${label}解除`);if(before.alive&&!p.alive)changes.push('淘汰');if(Number.isFinite(p.gold)&&Number.isFinite(before.gold)&&p.gold!==before.gold)changes.push(`金幣 ${p.gold-before.gold>0?'+':''}${p.gold-before.gold}`);if(changes.length&&!fast()&&!fxTimer&&!queuedFx.length&&!window.CardPhonePresentation?.isCardEntering?.()){const row=window.CardPhonePresentation?.playerVisualElement?.(i)||$('players')?.children[i];if(row){const r=row.getBoundingClientRect();if(r.right>0&&r.left<innerWidth){const badge=make('span','phone-player-change',changes.join(' · '));badge.style.left=Math.max(4,Math.min(innerWidth-155,r.left))+'px';badge.style.top=Math.min(innerHeight-32,r.bottom+4)+'px';statusLayer.append(badge);setTimeout(()=>badge.remove(),2600);}if(!reduce())row.animate([{filter:'brightness(1.4)'},{filter:'brightness(1)'}],{duration:1000});}}});}
      lastPublic=snapshot;queueMicrotask(decorate);
    }
    const video=$('enhVideo'),overlay=$('enhOverlay');
    if(video&&overlay){video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');const skip=make('span','phone-enh-skip','點畫面略過');skip.setAttribute('aria-hidden','true');overlay.append(skip);new MutationObserver(()=>{if(!overlay.classList.contains('hidden')){if(activeFx)queuedFx.unshift(activeFx);cancelDelays();delete root.dataset.cardFxPhase;clearTimeout(fxTimer);fxTimer=null;activeFx=null;layer.replaceChildren();if(privateOpen){window.CardPhonePresentation?.cancelCardFlights?.('peek');reveal.hidden=true;privateQueued=true;}}else {flushPrivate();resumeFx();}}).observe(overlay,{attributes:true,attributeFilter:['class']});video.addEventListener('error',()=>{if(!overlay.classList.contains('hidden'))overlay.click();});}
    if(typeof socket==='object'&&socket?.on){socket.on('JOINED',()=>{clearPrivate();lastPublic=null;});socket.on('EMIT',onEvent);socket.on('STATE',onState);socket.on('disconnect',()=>{clearPrivate();lastPublic=null;clearFx();});}
    document.addEventListener('visibilitychange',()=>{if(document.hidden){clearFx();}});
    decorate();onState(current());
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();


/* Android presentation module: card-phone-piles */
/* Count-aware image stacks. Original deck button, discard order and callbacks stay authoritative. */
(() => {
  const origin=window.__TABLETOP_ANDROID_TEST_ORIGIN||'https://onepiece-card-online.onrender.com';
  if(location.origin!==origin||location.pathname!=='/game.html')return;
  function mount(){
    const api=window.CardPhonePresentation,root=document.documentElement,$=id=>document.getElementById(id);
    if(!api||!root.dataset.cardPhone||root.dataset.cardPiles)return;
    root.dataset.cardPiles='1';
    const make=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
    const model=()=>typeof state==='object'?state:null;
    const table=document.querySelector('.phone-card-battlefield'),history=document.querySelector('.phone-card-history');
    const venues=$('venues'),venuePanel=venues.closest('.card'),deck=$('btnDraw'),deckPanel=deck.closest('.card'),discard=$('discard'),discardPanel=discard.closest('.card');
    discardPanel.classList.add('phone-card-discard-pile');table.append(discardPanel);history.prepend(venuePanel);
    const deckLayers=make('span','phone-pile-layers'),discardLayers=make('span','phone-pile-layers');
    deckLayers.setAttribute('aria-hidden','true');discardLayers.setAttribute('aria-hidden','true');deck.prepend(deckLayers);const discardStack=make('div','phone-discard-stack');discard.before(discardStack);discardStack.append(discardLayers,discard);
    const deckLabel=make('span','phone-pile-label'),discardLabel=make('button','phone-pile-label');deckPanel.append(deckLabel);discardPanel.append(discardLabel);
    discardLabel.type='button';discardLabel.setAttribute('aria-label','查看棄牌堆');discardLabel.onclick=()=>api.inspect?.('discard',Math.max(0,(api.presentedDiscardCount?.()??model()?.discard?.length??0)-1));
    discard.tabIndex=0;discard.setAttribute('role','button');discard.setAttribute('aria-label','查看棄牌堆');discard.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();discardLabel.click();}});
    const empty=make('span','phone-pile-empty','尚無棄牌');discardPanel.append(empty);
    function layers(node,count,covered=false){
      if(node.dataset.count===String(count))return;
      node.dataset.count=String(count);const depth=Math.min(16,Math.max(0,count-1)*.35);
      node.dataset.depth=String(depth);const pieces=[];
      for(let i=0;i<count-(covered?1:0);i++){const n=make('i','phone-pile-card');n.style.transform='translate('+((count-1-i)*depth/Math.max(1,count-1)*.18)+'px,'+((count-1-i)*depth/Math.max(1,count-1))+'px)';pieces.push(n);}
      node.replaceChildren(...pieces);
    }
    const intro=make('section','phone-venue-intro');intro.id='phoneVenueIntro';intro.hidden=true;intro.setAttribute('role','dialog');intro.setAttribute('aria-modal','true');intro.setAttribute('aria-labelledby','phoneVenueIntroTitle');
    const title=make('h2','','本局場地');title.id='phoneVenueIntroTitle';
    const cards=make('div','phone-venue-intro-cards'),enter=make('button','phone-card-control','開始本局');enter.type='button';enter.id='phoneVenueContinue';
    intro.append(title,cards,enter);document.body.append(intro);
    let pendingKey=null,activeKey=null,seen=new Set();
    try{seen=new Set(JSON.parse(sessionStorage.getItem('po-card-venue-intro-v1')||'[]'));}catch{}
    function closeIntro(){intro.hidden=true;activeKey=null;const first=model()?.venues?.[0]?.name;if(first)api.setVenueBackground?.(document.body.dataset.venue||first,{enter:true});deck.focus({preventScroll:true});}
    enter.onclick=closeIntro;intro.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeIntro();}if(e.key==='Tab'){e.preventDefault();enter.focus();}});
    function showIntro(){
      if(!pendingKey||!intro.hidden||!$('enhOverlay').classList.contains('hidden')||!$('phoneCardSheet').hidden||api.presentationEffectsBusy?.())return;
      const copies=[...venues.children].map(n=>{const copy=n.cloneNode(true);copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));return copy;});if(!copies.length)return;
      cards.replaceChildren(...copies);activeKey=pendingKey;pendingKey=null;seen.add(activeKey);seen=new Set([...seen].slice(-40));try{sessionStorage.setItem('po-card-venue-intro-v1',JSON.stringify([...seen]));}catch{}
      intro.hidden=false;enter.focus({preventScroll:true});
    }
    function sync(){
      const s=model();if(!s)return;
      const count=Array.isArray(s.deck)?s.deck.length:0,items=s.discard||[],presented=api.presentedDiscardCount?.()??items.length;
      layers(deckLayers,count);layers(discardLayers,presented,true);
      deck.dataset.pileCount=String(count);discard.dataset.pileCount=String(presented);
      deck.setAttribute('aria-label',deck.disabled?'抽牌堆，剩餘 '+count+' 張，目前不可抽牌':'點擊抽牌堆抽一張牌，剩餘 '+count+' 張');
      deckLabel.dataset.drawReady=String(!deck.disabled);deckLabel.textContent=deck.disabled?'抽牌堆 · '+count+' 張':'點擊抽牌 · '+count+' 張';discardLabel.textContent='棄牌 · '+presented+' 張　查看';
      empty.hidden=presented>0;
      [...discard.querySelectorAll('img')].forEach((img,i)=>{const secret=!!(items[i]&&typeof items[i]==='object'&&items[i].back===true);img.dataset.phoneSecret=String(secret);const b=img.closest('button');if(b){b.dataset.pileTop=String(i===presented-1);b.tabIndex=$('phoneCardSheet').contains(discard)||i===presented-1?0:-1;}});
      const key=s.phase!=='lobby'&&s.turnStep&&s.venues?.length?JSON.stringify([typeof me==='object'?me.roomId:null,s.roundNo,s.venues.map(v=>v.name)]):null;
      if(activeKey&&activeKey!==key)closeIntro();
      pendingKey=key&&!seen.has(key)?key:null;
      showIntro();
    }
    let queued=false;const schedule=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;sync();});};
    api.syncCardPiles=schedule;
    new MutationObserver(schedule).observe(venues,{childList:true,subtree:true});
    new MutationObserver(schedule).observe(discard,{childList:true,subtree:true});
    new MutationObserver(schedule).observe(deck,{attributes:true,attributeFilter:['disabled']});
    new MutationObserver(schedule).observe($('players'),{childList:true,subtree:true});
    for(const n of [$('modal'),$('enhOverlay'),$('phoneCardSheet')])new MutationObserver(schedule).observe(n,{attributes:true,attributeFilter:['class','hidden']});
    if(typeof socket==='object')socket.on?.('STATE',schedule);
    sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();


/* Android presentation module: card-phone-flight */
/* Visual card travel only: no commands, no opponent-hand lookups. */
(() => {
  const origin=window.__TABLETOP_ANDROID_TEST_ORIGIN||'https://onepiece-card-online.onrender.com';
  if(location.origin!==origin||location.pathname!=='/game.html')return;
  function mount(){
    const api=window.CardPhonePresentation,$=id=>document.getElementById(id);
    if(!api||document.getElementById('phoneCardFlights'))return;
    const layer=document.createElement('div');layer.id='phoneCardFlights';layer.setAttribute('aria-hidden','true');document.body.append(layer);
    const flights=new Set(),back='images/cards/back.webp';
    // A moving card owns its source surface until it lands. Hide the frame and
    // shadow too; overlapping animations release only their own reference.
    const borrowed=new Map();
    api.borrowCardVisual=node=>{
      if(!node)return ()=>{};
      node=node.closest?.('#playHand,#playDrawn')||node;
      let entry=borrowed.get(node);if(!entry){entry={refs:0,previous:node.getAttribute('data-card-visual-borrowed')};borrowed.set(node,entry);node.setAttribute('data-card-visual-borrowed','true');}entry.refs++;
      let released=false;return ()=>{if(released)return;released=true;if(borrowed.get(node)!==entry)return;if(--entry.refs>0)return;if(entry.previous==null)node.removeAttribute('data-card-visual-borrowed');else node.setAttribute('data-card-visual-borrowed',entry.previous);borrowed.delete(node);};
    };
    function restoreBorrowed(){for(const [node,entry]of borrowed){if(entry.previous==null)node.removeAttribute('data-card-visual-borrowed');else node.setAttribute('data-card-visual-borrowed',entry.previous);}borrowed.clear();}
    const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fast=()=>typeof isCpuSkipFastMode==='function'&&isCpuSkipFastMode();
    const rect=node=>node?.getBoundingClientRect?node.getBoundingClientRect():node;
    const visible=node=>node?.isConnected&&node.getClientRects().length&&rect(node).width>0;
    const playerRect=(id,cardId)=>{
      if(typeof me==='object'&&id===me.playerId){const own=cardId!=null?(state?.players?.[id]?.tempDraw===cardId?$('imgDrawn'):$('imgHand')):ownCard();if(visible(own))return rect(own);}
      const row=api.playerVisualElement?.(id)||$('players')?.children[id],img=row?.querySelector('img.rounded-full');if(!visible(img))return null;
      const r=rect(img),rail=rect($('players')),x=row.id==='phoneSelfPlayer'?r.left+r.width/2:Math.max(rail.left+26,Math.min(rail.right-26,r.left+r.width/2));
      return {left:x-24,top:r.top,width:48,height:72};
    };
    api.cardPlayerRect=playerRect;
    api.ownHandElement=ownCard;
    function cancel(kind){for(const f of [...flights])if(!kind||f.kind===kind)f.stop();}
    api.cancelCardFlights=cancel;
    api.flyCard=({from,to,src,secret=false,flip=false,kind='inspect',arc=0,hideTarget=true,replace=true,onFinish=null})=>{
      const a=rect(from),b=rect(to);if(!a?.width||!b?.width||!a.height||!b.height||document.hidden||fast())return false;
      if(replace)cancel(kind);
      if(reduced())return false;
      let angle=0;
      if(to?.nodeType===1)for(let n=to;n&&n!==document.body;n=n.parentElement){const t=getComputedStyle(n).transform;if(t&&t!=='none'){const m=new DOMMatrixReadOnly(t);angle+=Math.atan2(m.b,m.a)*180/Math.PI;}}
      const width=to?.offsetWidth||b.width,height=to?.offsetHeight||b.height;
      const ghost=document.createElement('div');ghost.className='phone-card-flight';ghost.dataset.kind=kind;ghost.dataset.secret=String(secret);
      Object.assign(ghost.style,{left:(b.left+(b.width-width)/2)+'px',top:(b.top+(b.height-height)/2)+'px',width:width+'px',height:height+'px'});
      const art=document.createElement('img');art.src=flip?back:src||back;art.alt='';art.draggable=false;ghost.append(art);layer.append(ghost);
      const target=to?.classList&&hideTarget?to:null;target?.classList.add('phone-card-flight-landing');
      const dx=a.left+a.width/2-b.left-b.width/2,dy=a.top+a.height/2-b.top-b.height/2;
      const sx=a.width/width,sy=a.height/height,animation=ghost.animate([
        {transform:`translate(${dx}px,${dy}px) scale(${sx},${sy}) rotate(-7deg)`,opacity:1},
        {transform:`translate(${dx*.42}px,${dy*.42-28+arc}px) scale(${.65+.35*sx},${.65+.35*sy}) rotate(6deg)`,opacity:1,offset:.55},
        {transform:`translate(0,0) scale(1) rotate(${angle}deg)`,opacity:1}
      ],{duration:1100,easing:'cubic-bezier(.22,.65,.28,1)',fill:'forwards'});
      let timer=null,done=false;
      const f={kind,stop(){if(done)return;done=true;clearTimeout(timer);animation.cancel();target?.classList.remove('phone-card-flight-landing');ghost.remove();flights.delete(f);onFinish?.();}};flights.add(f);
      if(flip){art.animate([{transform:'rotateY(0)'},{transform:'rotateY(90deg)',offset:.5},{transform:'rotateY(0)'}],{duration:440,delay:470,easing:'ease-in-out'});timer=setTimeout(()=>{art.src=src||back;},690);}
      animation.finished.then(f.stop,()=>{});return true;
    };
    function ownCard(){const p=typeof state==='object'&&typeof me==='object'?state?.players?.[me.playerId]:null,stage=$('phonePlayedStage');if(stage&&!stage.hidden&&stage.dataset.player===String(me.playerId)&&stage.dataset.card===String(p?.hand)&&p?.tempDraw!=null&&visible($('imgDrawn')))return $('imgDrawn');return visible($('imgHand'))?$('imgHand'):document.querySelector('.phone-card-held img');}
    api.flySwap=(from,to)=>{
      const id=typeof me==='object'?me.playerId:null;if(id!==from&&id!==to||from===to)return false;
      const local=ownCard(),remote=playerRect(id===from?to:from);if(!visible(local)||!remote)return false;
      // Public swap events carry no authority to show the other player's card face.
      const here=rect(local);api.flyCard({from:here,to:remote,src:back,kind:'swap-out',arc:-28,hideTarget:false});
      api.flyCard({from:remote,to:local,src:back,kind:'swap-in',arc:28});return true;
    };
    let previous=null,pendingDraw=false,queued=false,drawLayoutFrame=0,drawLayoutRetries=0;
    function sync(){
      if(typeof state!=='object'||!state||typeof me!=='object')return;
      const s=state,p=s.players?.[me.playerId],next={key:JSON.stringify([me.roomId,me.playerId,s.roundNo]),phase:s.phase,turn:s.turnIndex,step:s.turnStep,count:s.deck?.length,draw:p?.tempDraw};
      if(previous&&previous.key!==next.key){cancel();pendingDraw=false;}
      if(previous?.key===next.key&&previous.phase!=='lobby'&&next.phase!=='lobby'&&previous.turn===me.playerId&&next.turn===me.playerId&&previous.step==='draw'&&next.step==='choose'&&previous.count>next.count&&next.draw!=null)pendingDraw=true;
      if(next.phase==='lobby'||next.turn!==me.playerId||next.step!=='choose')pendingDraw=false;
      previous=next;
      if(pendingDraw&&!document.hidden&&!fast()&&$('enhOverlay')?.classList.contains('hidden')&&$('drawOverlay')?.classList.contains('hidden')&&$('phoneVenueIntro')?.hidden){
        const target=$('imgDrawn');if(visible(target)){pendingDraw=false;drawLayoutRetries=0;const r=rect($('btnDraw')),w=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pile-w'))||r.width;
          api.flyCard({from:{left:r.left,top:r.top,width:Math.min(w,r.width),height:Math.min(w,r.width)*1.5},to:target,src:target.src,flip:true,kind:'draw'});
        }else if(!drawLayoutFrame&&drawLayoutRetries++<30){drawLayoutFrame=requestAnimationFrame(()=>{drawLayoutFrame=0;sync();});}
      }
    }
    const schedule=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;sync();});};
    new MutationObserver(schedule).observe($('players'),{childList:true,subtree:true});
    for(const id of ['enhOverlay','drawOverlay','phoneVenueIntro'])if($(id))new MutationObserver(schedule).observe($(id),{attributes:true,attributeFilter:['class','hidden']});
    $('phoneCardSheet')?.addEventListener('phone-card-sheet-close',()=>cancel('inspect'));
    const law=$('lawSwapModal');if(law)new MutationObserver(()=>{if(law.classList.contains('hidden'))cancel('law-view');}).observe(law,{attributes:true,attributeFilter:['class']});
    if(typeof socket==='object'){
      socket.on?.('STATE',schedule);
      for(const event of ['JOINED','disconnect'])socket.on?.(event,()=>{previous=null;pendingDraw=false;cancelAnimationFrame(drawLayoutFrame);drawLayoutFrame=0;drawLayoutRetries=0;cancel();restoreBorrowed();});
      socket.on?.('EMIT',e=>{if(!api.committingPresentation&&e?.type==='law_view'&&e.to===me.playerId&&Number.isInteger(e.cardId)&&e.cardId>=0&&e.cardId<20)queueMicrotask(()=>{const target=$('lawTargetImg');if(visible(target)&&!law.classList.contains('hidden'))api.flyCard({from:playerRect(e.targetId),to:target,src:target.src,flip:true,kind:'law-view'});});});
    }
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancel();restoreBorrowed();pendingDraw=false;previous=null;}});
    window.addEventListener('resize',()=>cancel(),{passive:true});sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();


/* Android presentation module: card-phone-stage */
/* Display sequencing only. Engine state, authoritative discard, actions and saves are untouched. */
(() => {
  const origin=window.__TABLETOP_ANDROID_TEST_ORIGIN||'https://onepiece-card-online.onrender.com';
  if(location.origin!==origin||location.pathname!=='/game.html')return;
  function mount(){
    const api=window.CardPhonePresentation,$=id=>document.getElementById(id),root=document.documentElement;
    if(!api||root.dataset.cardStage)return;root.dataset.cardStage='1';
    const make=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
    const current=()=>typeof state==='object'?state:null,viewer=()=>typeof me==='object'?me.playerId:null;
    const fast=()=>document.hidden||(typeof isCpuSkipFastMode==='function'&&isCpuSkipFastMode());
    const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
    const players=$('players'),history=document.querySelector('.phone-card-history'),log=$('logBox').closest('.card');
    const dock=make('section','phone-self-dock');dock.id='phoneSelfDock';dock.setAttribute('aria-label','自己的狀態與紀錄');
    const self=make('div','phone-self-player');self.id='phoneSelfPlayer';self.tabIndex=0;self.setAttribute('role','button');
    const records=make('button','phone-card-control','對局日誌');records.type='button';records.id='phoneCompactLog';records.onclick=()=>api.openRecords();
    self.onclick=()=>players.children[viewer()]?.click();self.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();self.click();}};
    dock.append(self,records);history.append(dock);
    api.playerVisualElement=id=>id===viewer()&&players.closest('main')?self:players.children[id];
    const chest=make('section','phone-treasure');chest.id='phoneTreasure';chest.setAttribute('aria-label','公共寶箱剩餘金幣');
    const chestArt=make('i','phone-treasure-art'),balance=make('div','phone-treasure-balance'),caption=make('span','','寶箱剩餘'),number=$('chestLbl');
    const oldChest=number?.parentElement;if(oldChest)oldChest.hidden=true;balance.append(caption);if(number)balance.append(number);balance.append(make('small','','枚金幣'));chest.append(chestArt,balance);history.insertBefore(chest,dock);
    const coinLayer=make('div','phone-coin-flights');coinLayer.id='phoneCoinFlights';coinLayer.setAttribute('aria-hidden','true');document.body.append(coinLayer);
    let selfSignature='',lastBalance=null,lastGold=null,identity=null,coinAnimations=[];
    function clearCoins(){for(const a of coinAnimations)a.cancel();coinAnimations=[];coinLayer.replaceChildren();}
    function syncHud(){
      const s=current();if(!s)return;
      const key=JSON.stringify([typeof me==='object'?me.roomId:null,viewer()]);if(identity!==key){identity=key;lastBalance=null;lastGold=null;clearCoins();selfSignature='';}
      [...players.children].forEach((row,i)=>row.dataset.phoneSelf=String(i===viewer()));
      const row=players.children[viewer()];if(row&&!root.dataset.cardSeatHud){const sig=row.innerHTML+'|'+row.className;if(sig!==selfSignature){selfSignature=sig;const copy=row.cloneNode(true);copy.removeAttribute('data-phone-self');copy.removeAttribute('tabindex');copy.removeAttribute('role');copy.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));copy.querySelectorAll('.grow > .flex.items-start').forEach(n=>n.remove());self.replaceChildren(copy);self.setAttribute('aria-label','查看自己的完整狀態');}}
      const value=Number(number?.textContent),gold=(s.players||[]).map(p=>p.gold||0);
      chest.setAttribute('aria-label',Number.isFinite(value)?`公共寶箱剩餘 ${value} 枚金幣`:'公共寶箱');
      if(lastBalance!=null&&Number.isFinite(value)&&value!==lastBalance&&!fast()&&!reduced()){
        chestArt.getAnimations().forEach(a=>a.cancel());chestArt.animate([{transform:'scale(1)'},{transform:'scale(1.12) rotate(-5deg)'},{transform:'scale(1)'}],{duration:1000});
        const winners=gold.map((g,i)=>g>(lastGold?.[i]??g)?i:null).filter(Number.isInteger);
        for(let i=0;i<Math.min(6,Math.abs(value-lastBalance));i++){
          const coin=make('i','phone-treasure-coin'),a=chestArt.getBoundingClientRect(),row=api.playerVisualElement(winners[i%Math.max(1,winners.length)]),b=row?.querySelector('img.rounded-full')?.getBoundingClientRect();
          const x=a.left+a.width/2,y=a.top+a.height/2,dx=b?b.left+b.width/2-x:(i-2.5)*18,dy=b?b.top+b.height/2-y:-45;
          Object.assign(coin.style,{left:x+'px',top:y+'px'});coinLayer.append(coin);const animation=coin.animate([{transform:'translate(-50%,-50%) scale(.6)',opacity:0},{transform:`translate(calc(-50% + ${dx*.45}px),calc(-50% + ${dy*.45-30}px)) scale(1.15)`,opacity:1,offset:.5},{transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.65)`,opacity:0}],{duration:1400,delay:i*110,easing:'ease-in-out'});coinAnimations.push(animation);animation.finished.then(()=>{coin.remove();coinAnimations=coinAnimations.filter(a=>a!==animation);},()=>coin.remove());
        }
      }
      lastBalance=Number.isFinite(value)?value:null;lastGold=gold;
    }
    // Original rows stay in index order for controllers; only the visual self row moves.
    let hudQueued=false;const scheduleHud=()=>{if(hudQueued)return;hudQueued=true;queueMicrotask(()=>{hudQueued=false;syncHud();});};
    new MutationObserver(scheduleHud).observe(players,{childList:true,subtree:true});
    if(number)new MutationObserver(scheduleHud).observe(number,{childList:true,characterData:true,subtree:true});

    const stage=make('section','phone-played-stage');stage.id='phonePlayedStage';stage.hidden=true;stage.setAttribute('aria-live','polite');
    const stageName=make('div','phone-stage-name'),stageImg=make('img','phone-stage-card'),stageStatus=make('div','phone-stage-status');stageImg.alt='場中央打出的卡';stage.append(stageName,stageImg,stageStatus);document.body.append(stage);
    let queue=[],active=null,seen=new Set(),timer=null,stageKey=null;
    const originalFlash=typeof showPlayedFlash==='function'?showPlayedFlash:null;
    const busy=()=>!!current()?.pending||['modal','enhOverlay','lawSwapModal','luffyBoostModal','duelFx','kidConfirmModal'].some(id=>{const n=$(id);return n&&!n.classList.contains('hidden')&&n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden'&&getComputedStyle(n).opacity!=='0';})||!!$('phoneInteractionFx')?.children.length||!!$('phoneCardFlights')?.querySelector('[data-kind="swap-in"],[data-kind="peek"],[data-kind="law-view"]');
    api.isCardEntering=()=>!!active&&['enter','display','place'].includes(active.phase);
    api.isCardResolving=()=>!!active||queue.length>0;
    api.isLocalCardPreview=()=>!!active?.localPreview;
    api.previewKid=()=>{if(active)return;const s=current();queue.push({id:11,by:viewer(),index:s?.discard?.length||0,round:s?.roundNo,callbacks:[],localPreview:true});start();};
    api.cancelLocalCardPreview=()=>{if(active?.localPreview)clearStage();};
    api.presentedDiscardCount=()=>{const s=current(),holds=[active,...queue].filter(Boolean).filter(x=>x.round===s?.roundNo).map(x=>x.index);return holds.length?Math.min(s?.discard?.length||0,...holds):s?.discard?.length||0;};
    function repaint(){api.syncCardPiles?.();}
    function callbacks(item){for(const fn of item.callbacks.splice(0)){try{fn();}catch{}}}
    function clearStage(){clearTimeout(timer);timer=null;try{_flashBusy=false;_enhSignal=null;}catch{}queue=[];active=null;seen.clear();stage.hidden=true;stageImg.style.visibility='';root.removeAttribute('data-card-resolving');api.cancelCardFlights?.('play-enter');api.cancelCardFlights?.('play-exit');repaint();}
    function start(){
      if(active||!queue.length||fast())return;active=queue.shift();const x=active;stage.hidden=false;stageImg.style.visibility='';root.dataset.cardResolving='1';stage.dataset.player=String(x.by);stage.dataset.card=String(x.id);stage.dataset.phase='enter';x.phase='enter';
      stageName.textContent=(typeof pname==='function'?pname(x.by):`P${x.by+1}`)+' 打出';stageStatus.textContent='發動效果';
      stageImg.src=typeof isEnhancedNow==='function'&&isEnhancedNow(x.id)?CARD_ENH(x.id):CARD(x.id);
      const flies=api.flyCard?.({from:api.cardPlayerRect?.(x.by,x.id),to:stageImg,src:stageImg.src,kind:'play-enter'});
      if(x.by===viewer())api.maskHandArt?.(current()?.players?.[x.by]?.tempDraw===x.id?$('imgDrawn'):$('imgHand'));
      repaint();timer=setTimeout(()=>{if(active!==x)return;x.phase='display';stage.dataset.phase='display';stageStatus.textContent='展示卡牌';timer=setTimeout(()=>{if(active!==x)return;x.phase='place';stage.dataset.phase='place';stageStatus.textContent='放上場地';timer=setTimeout(()=>{if(active!==x)return;x.phase='resolve';x.readyAt=performance.now();stage.dataset.phase='resolve';stageStatus.textContent='發動效果';callbacks(x);document.dispatchEvent(new Event('phone-card-center-ready'));tick();},reduced()?50:650);},reduced()?100:700);},flies?1100:100);
    }
    function tick(){
      clearTimeout(timer);timer=null;const x=active;if(!x)return;
      if(fast()){clearStage();return;}
      if(x.phase!=='resolve')return;
      callbacks(x);
      const confirmed=x.confirmed===true;
      if(!confirmed||busy()||performance.now()-x.readyAt<1200){x.quietAt=null;timer=setTimeout(tick,120);return;}
      if(x.quietAt==null)x.quietAt=performance.now();if(performance.now()-x.quietAt<400){timer=setTimeout(tick,120);return;}
      x.phase='exit';stage.dataset.phase='exit';stageStatus.textContent='移入棄牌堆';
      const target=document.querySelector('.phone-discard-stack'),r=target?.getBoundingClientRect(),w=r?parseFloat(getComputedStyle(document.querySelector('#btnDraw .phone-pile-card')||target).width):0;
      const flies=r&&api.flyCard?.({from:stageImg,to:{left:r.left,top:r.top,width:w||60,height:(w||60)*1.5},src:stageImg.src,kind:'play-exit',hideTarget:false});stageImg.style.visibility=flies?'hidden':'';
      timer=setTimeout(()=>{if(active!==x)return;stageImg.style.visibility='';active=null;stage.hidden=true;root.removeAttribute('data-card-resolving');repaint();start();},flies?1100:80);
    }
    if(originalFlash)showPlayedFlash=function(id,by,opt={}){
      if(api.suppressKidFlash&&id===11)return;
      const item=[active,...queue].find(x=>x&&x.id===id&&x.by===by);
      if(item){if(typeof opt.onDone==='function'){item.callbacks.push(opt.onDone);if(item.phase==='resolve')callbacks(item);}return;}
      return originalFlash(id,by,opt); // Preserve original non-play reveals and Kid pre-confirmation.
    };
    function onEvent(e){
      if(api.committingPresentation)return;
      if(e?.type!=='log'||e.to!=='all'||typeof e.text!=='string')return;
      const match=e.text.match(/ 打出 (\d+)｜/),s=current();if(!match||!s||s.phase==='lobby'||fast())return;
      const id=Number(match[1]),by=s.turnIndex;if(!Number.isInteger(id)||id<0||id>19||!s.players?.[by])return;
      if(active?.localPreview&&active.id===id&&active.by===by){active.localPreview=false;return;}
      const identityKey=JSON.stringify([typeof me==='object'?me.roomId:null,viewer(),s.roundNo]);if(stageKey&&stageKey!==identityKey)clearStage();stageKey=identityKey;
      const index=s.discard?.length||0,key=JSON.stringify([typeof me==='object'?me.roomId:null,s.roundNo,index,id,by]);
      seen.add(key);if(seen.size>100)seen=new Set([...seen].slice(-60));queue.push({id,by,index,round:s.roundNo,callbacks:[]});start();repaint();
    }
    api.presentPlayEvent=onEvent;
    function onState(s){for(const x of [active,...queue])if(x&&x.round===s?.roundNo)x.confirmed=true;const key=JSON.stringify([typeof me==='object'?me.roomId:null,viewer(),s?.roundNo]);if(stageKey&&stageKey!==key)clearStage();stageKey=key;scheduleHud();repaint();}
    if(typeof socket==='object'){socket.on?.('EMIT',onEvent);socket.on?.('STATE',onState);for(const event of ['disconnect','JOINED'])socket.on?.(event,()=>{clearStage();clearCoins();lastBalance=null;lastGold=null;stageKey=null;});}
    document.addEventListener('visibilitychange',()=>{if(document.hidden){clearStage();clearCoins();}});
    syncHud();onState(current());
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();


/* Android presentation module: card-phone-targets */
/* Pick the original target button through its visible portrait. Defense rules remain server-owned. */
(() => {
  const origin=window.__TABLETOP_ANDROID_TEST_ORIGIN||'https://onepiece-card-online.onrender.com';
  if(location.origin!==origin||location.pathname!=='/game.html')return;
  function mount(){
    const api=window.CardPhonePresentation,root=document.documentElement,modal=document.getElementById('modal'),players=document.getElementById('players');
    if(!api||document.getElementById('phoneTargetHint'))return;
    const hint=document.createElement('div');hint.id='phoneTargetHint';hint.hidden=true;hint.setAttribute('role','status');document.body.append(hint);
    let marked=new Map(),queued=false;
    function restore(){for(const [row,label]of marked){delete row.dataset.phoneAim;delete row.dataset.phonePicked;row.removeAttribute('aria-disabled');if(label==null)row.removeAttribute('aria-label');else row.setAttribute('aria-label',label);}marked.clear();}
    function sync(){
      restore();const buttons=modal.classList.contains('hidden')?[]:[...modal.querySelectorAll('button[data-i]')];
      hint.hidden=!buttons.length;
      if(!buttons.length){delete root.dataset.cardDirectTargets;return;}
      root.dataset.cardDirectTargets='1';
      const multi=!!modal.querySelector('#mtDone');hint.textContent=multi?'點亮起的頭像選人，再按「完成」':'點亮起的頭像選人 · 🛡 護盾／🌀 閃避仍可選';
      for(const button of buttons){const id=Number(button.dataset.i),row=api.playerVisualElement?.(id)||players.children[id];if(!row)continue;
        marked.set(row,row.getAttribute('aria-label'));row.dataset.phoneAim=button.disabled?'disabled':'available';row.dataset.phonePicked=String(multi&&button.classList.contains('border-amber-400'));row.setAttribute('aria-disabled',String(button.disabled));
        const p=typeof state==='object'?state?.players?.[id]:null,n=row.querySelector('.font-semibold')?.textContent.trim()||`P${id+1}`;
        row.setAttribute('aria-label',`${button.disabled?'不可選擇':'選擇'} ${n}${p?.protected?'，護盾':''}${p?.dodging?'，閃避':''}`);
      }
    }
    const schedule=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;sync();});};
    document.addEventListener('click',e=>{
      if(e.target.closest('.phone-seat-status-icon')||!root.dataset.cardDirectTargets||modal.classList.contains('hidden'))return;
      const row=e.target.closest('main #players > div,#phoneSelfPlayer');if(!row)return;
      const id=row.id==='phoneSelfPlayer'?(typeof me==='object'?me.playerId:null):[...players.children].indexOf(row),button=modal.querySelector(`button[data-i="${id}"]`);
      if(!button)return;e.preventDefault();e.stopImmediatePropagation();if(!button.disabled)button.click();schedule();
    },true);
    new MutationObserver(schedule).observe(modal,{childList:true,subtree:true,attributes:true,attributeFilter:['class','disabled']});
    new MutationObserver(schedule).observe(players,{childList:true,subtree:true});
    document.getElementById('phoneCardSheet')?.addEventListener('phone-card-sheet-close',schedule);
    if(typeof socket==='object'){socket.on?.('STATE',schedule);socket.on?.('disconnect',()=>{restore();hint.hidden=true;delete root.dataset.cardDirectTargets;});}
    sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();


/* Android presentation module: card-hand-dock */
/* Own-hand presentation only; original inspection/confirmation still sends actions. */
(()=>{
  const origin=window.__TABLETOP_ANDROID_TEST_ORIGIN||'https://onepiece-card-online.onrender.com';
  if(location.origin!==origin||location.pathname!=='/game.html')return;
  function mount(){
    const root=document.documentElement,hand=document.getElementById('myPlayZone'),held=document.querySelector('.phone-card-held');
    if(!root.dataset.cardPhone||!hand||!held||root.dataset.cardHandDock)return;
    root.dataset.cardHandDock='1';let key=null;
    const close=()=>{delete root.dataset.handOpen;for(const b of hand.querySelectorAll('.grid > button'))b.setAttribute('aria-expanded','false');held.setAttribute('aria-expanded','false');};
    const open=()=>{root.dataset.handOpen='1';for(const b of hand.querySelectorAll('.grid > button'))b.setAttribute('aria-expanded','true');held.setAttribute('aria-expanded','true');};
    for(const zone of [hand,held]){
      zone.addEventListener('click',e=>{
        // Touch first lifts the fan. A later tap uses the existing inspect path.
        if(e.pointerType==='touch'&&!root.dataset.handOpen){e.preventDefault();e.stopImmediatePropagation();open();}
      },true);
      zone.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});
    }
    document.addEventListener('pointerdown',e=>{if(!hand.contains(e.target)&&!held.contains(e.target))close();},true);
    function sync(s){const p=s?.players?.[typeof me==='object'?me.playerId:-1];const next=JSON.stringify([s?.roundNo,s?.turnIndex,s?.turnStep,p?.hand,p?.tempDraw]);if(next!==key){key=next;close();}}
    if(typeof socket==='object'){socket.on?.('STATE',sync);socket.on?.('disconnect',close);socket.on?.('JOINED',close);}
    document.addEventListener('visibilitychange',()=>{if(document.hidden)close();});
    sync(typeof state==='object'?state:null);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();


/* Android presentation module: card-phone-library */
/* Viewer-visible libraries and venue selection; no hidden-hand reads or game commands. */
(() => {
  const origin=window.__TABLETOP_ANDROID_TEST_ORIGIN||'https://onepiece-card-online.onrender.com';
  if(location.origin!==origin||location.pathname!=='/game.html')return;
  function mount(){
    const api=window.CardPhonePresentation,root=document.documentElement,$=id=>document.getElementById(id);
    if(!api||root.dataset.cardLibrary)return;root.dataset.cardLibrary='1';
    const node=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text!=null)n.textContent=text;return n;};
    const button=(text,fn)=>{const b=node('button','phone-card-control',text);b.type='button';b.onclick=fn;return b;};
    const screen=node('section','phone-library');screen.id='phoneLibrary';screen.hidden=true;screen.setAttribute('role','dialog');screen.setAttribute('aria-modal','true');screen.setAttribute('aria-labelledby','phoneLibraryTitle');
    const head=node('div','phone-library-head'),title=node('h2','','卡牌'),back=button('返回牌桌',()=>close()),body=node('div','phone-library-body'),foot=node('div','phone-library-footer');title.id='phoneLibraryTitle';head.append(title,back);screen.append(head,body,foot);document.body.append(screen);
    let kind='',page=0,detail=null,opener=null,signature='';
    const venueNames=['德雷斯羅薩鬥技場','艾尼艾斯大廳','阿拉巴斯坦','巴拉蒂','佐烏','和之國','龐克哈薩德','維薩利亞','魚人島','九蛇島','鬼島','夏波帝諸島','萬國','蜂巢島','奧羅傑克森號'];
    const slugs=['dressrosa','enieslobby','alabasta','baratie','zou','wano','punkhazard','weatheria','fishmanisland','amazonlily','onigashima','sabaody','wholecake','hachinosu','oro-jackson'];
    const valid=id=>Number.isInteger(id)&&id>=0&&id<=19;
    function entries(){
      if(kind==='dex')return Array.from({length:20},(_,id)=>({id,name:CARD_TEXT[id]?.name||'卡牌',src:CARD(id),count:CARD_COUNTS[id],enh:isEnhancedNow(id)}));
      if(kind==='venues')return (state?.venues||[]).map(v=>({venue:v.name,name:v.name,src:VEN(v.name)}));
      return (state?.discard||[]).slice(0,api.presentedDiscardCount?.()??Infinity).map((item,index)=>{const secret=!!(item&&typeof item==='object'&&item.back===true),id=typeof item==='number'?item:item?.id;return {id:secret?null:id,secret,index,name:secret?'未公開的棄牌':valid(id)?CARD_TEXT[id]?.name:'棄牌',src:secret||!valid(id)?CARD(null).replace('null.webp','back.webp'):CARD(id)};});
    }
    function close(){screen.hidden=true;kind='';detail=null;opener?.focus?.({preventScroll:true});}
    api.closeLibrary=close;
    function open(next){api.closeSheet();if(typeof closeCardDex==='function')closeCardDex();opener=document.activeElement;kind=next;page=0;detail=null;signature='';screen.hidden=false;paint();back.focus({preventScroll:true});}
    api.openDiscard=()=>open('discard');api.openCardLibrary=()=>open('dex');api.openVenues=()=>open('venues');
    const oldInspect=api.inspect;api.inspect=(k,slot)=>k==='discard'?open('discard'):oldInspect(k,slot);
    // One stable world behind the HUD; only the scenery crossfades when explicitly changed.
    const world=node('div','phone-venue-world');world.id='phoneVenueWorld';world.setAttribute('aria-hidden','true');const planes=[node('div','phone-venue-plane'),node('div','phone-venue-plane')];world.append(...planes);document.body.prepend(world);root.dataset.cardWorld='1';planes[0].style.backgroundImage='var(--card-table-art)';planes[0].style.opacity='1';planes[1].style.opacity='0';
    const arrival=node('div','phone-venue-arrival');arrival.id='phoneVenueArrival';arrival.hidden=true;arrival.setAttribute('role','status');document.body.append(arrival);
    let worldGeneration=0,worldFront=0,desiredVenue='',arrivalTimer=null,worldAnimation=null;
    const stopArrival=()=>{clearTimeout(arrivalTimer);arrival.hidden=true;worldAnimation?.cancel();worldAnimation=null;delete root.dataset.cardVenueEntering;};
    api.isVenueEntering=()=>root.dataset.cardVenueEntering==='true';
    function enterWorld(name){stopArrival();if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;root.dataset.cardVenueEntering='true';arrival.textContent='進入 '+name;arrival.hidden=false;worldAnimation=world.animate([{transform:'scale(1.045)',filter:'brightness(.65)'},{transform:'scale(1)',filter:'brightness(1)'}],{duration:1100,easing:'cubic-bezier(.2,.7,.25,1)'});arrivalTimer=setTimeout(stopArrival,1250);}
    api.setVenueBackground=async(name,{enter=false}={})=>{
      const i=venueNames.indexOf(name);if(i<0)return false;
      if(desiredVenue===name){if(enter)enterWorld(name);return true;}
      desiredVenue=name;const token=++worldGeneration,variable='--venue-'+slugs[i],art=getComputedStyle(root).getPropertyValue(variable).trim();
      const url=/^url\(["']?(.*?)["']?\)$/.exec(art)?.[1];if(!url){desiredVenue=document.body.dataset.venue||'';return false;}
      try{const image=new Image();image.src=url;await image.decode();}catch{if(token===worldGeneration)desiredVenue=document.body.dataset.venue||'';return false;}
      if(token!==worldGeneration)return false;
      const next=1-worldFront;planes[next].style.backgroundImage=art;planes[next].style.opacity='1';planes[worldFront].style.opacity='0';worldFront=next;
      document.body.dataset.venue=name;document.body.classList.add('venue-on');root.style.setProperty('--card-venue-art',art);world.dataset.venue=name;
      document.querySelectorAll('#venues img[data-name]').forEach(img=>img.closest('.venue-card')?.setAttribute('aria-pressed',String(img.dataset.name===name)));
      if(enter)enterWorld(name);return true;
    };
    if(typeof toggleVenueBackground==='function')toggleVenueBackground=api.setVenueBackground;
    function image(e){const img=node('img','');img.src=e.src;img.alt=e.name;img.draggable=false;return img;}
    function paint(){
      if(screen.hidden)return;const list=entries();title.textContent=kind==='dex'?'卡片圖鑑':kind==='venues'?'本局場地':`棄牌堆 · 共 ${list.length} 張`;
      body.replaceChildren();foot.replaceChildren();screen.dataset.kind=kind;screen.dataset.detail=String(detail!=null);
      if(detail!=null){
        const e=list[detail];if(!e){detail=null;paint();return;}
        back.textContent='返回列表';back.onclick=()=>{detail=null;paint();};
        const art=node('div','phone-library-art'),info=node('div','phone-library-copy');art.append(image(e));info.append(node('h3','',e.name));
        if(e.secret)info.append(node('p','','這張牌尚未公開，只顯示卡背。'));
        else if(e.venue){info.append(node('p','',venueDesc(e.venue)),button(document.body.dataset.venue===e.venue?'進入目前場地':'進入此場地',()=>{api.setVenueBackground(e.venue,{enter:true});close();}));}
        else if(valid(e.id)){
          info.append(node('p','',cardLine(e.id)));
          if(kind==='dex'){
            info.append(node('p','',`牌組張數：${e.count}　${CARD_VENUE[e.id]?'強化場地：'+CARD_VENUE[e.id]:'無強化場地'}`));
            const enhanced=button('查看強化牌面',()=>{const img=art.querySelector('img');const selected=img.dataset.enh==='true';img.dataset.enh=String(!selected);img.src=selected?CARD(e.id):CARD_ENH(e.id);enhanced.textContent=selected?'查看強化牌面':'查看普通牌面';});info.append(enhanced);
          }
        }
        body.append(art,info);return;
      }
      back.textContent='返回牌桌';back.onclick=close;
      // Paged rows fit low-height screens; no horizontal scrollbar, all entries reachable.
      const capacity=innerWidth<1000?8:12,total=Math.max(1,Math.ceil(list.length/capacity));page=Math.min(page,total-1);
      const grid=node('div','phone-library-grid');grid.style.setProperty('--library-cols',innerWidth<1000?'4':'6');
      list.slice(page*capacity,(page+1)*capacity).forEach((e,j)=>{
        const b=button('',()=>{detail=page*capacity+j;paint();});b.classList.add('phone-library-item');b.dataset.secret=String(!!e.secret);b.dataset.card=String(e.secret?'back':e.id??e.venue);b.append(image(e),node('span','',e.name));
        if(kind==='dex')b.append(node('small','',`×${e.count}${e.enh?' · 本局強化':''}`));grid.append(b);
      });
      if(!list.length)grid.append(node('p','','目前沒有棄牌'));
      body.append(grid);const prev=button('上一頁',()=>{page--;paint();}),next=button('下一頁',()=>{page++;paint();});prev.disabled=page===0;next.disabled=page===total-1;foot.append(prev,node('span','',`${page+1} / ${total}　點卡牌查看詳情`),next);
    }
    // Capture before old dex/discard handlers so one click opens one surface.
    document.addEventListener('click',e=>{
      if(e.target.closest('#cardDexBtn')){e.preventDefault();e.stopImmediatePropagation();open('dex');return;}
      const venue=e.target.closest('#venues .venue-card');if(venue&&!$('phoneCardSheet')?.contains(venue)){const name=venue.querySelector('img')?.dataset.name;if(name){e.preventDefault();e.stopImmediatePropagation();api.setVenueBackground(name,{enter:true});}return;}
    },true);
    screen.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();if(detail!=null){detail=null;paint();}else close();}});
    function sync(){
      const validVenues=state?.venues?.filter(v=>venueNames.includes(v.name))||[];if(validVenues.length&&!validVenues.some(v=>v.name===desiredVenue))api.setVenueBackground(validVenues[0].name);
      if(!screen.hidden){const sig=JSON.stringify([state?.roundNo,kind==='discard'?state?.discard:state?.venues]);if(sig!==signature){signature=sig;paint();}}
      alignAvatars();
    }
    function alignAvatars(){for(const img of document.querySelectorAll('main #players img.rounded-full,#phoneSelfPlayer img.rounded-full')){if(img.classList.contains('phone-seat-avatar')||img.parentElement.classList.contains('phone-avatar-wrap'))continue;const wrap=node('span','phone-avatar-wrap');img.before(wrap);wrap.append(img);}}
    let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;sync();});};
    new MutationObserver(schedule).observe($('players'),{childList:true,subtree:true});new MutationObserver(schedule).observe($('phoneSelfPlayer'),{childList:true,subtree:true});
    socket.on('STATE',schedule);for(const e of ['disconnect','JOINED'])socket.on(e,()=>{close();stopArrival();});window.addEventListener('resize',()=>{if(!screen.hidden)paint();});sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();


/* Android presentation module: card-phone-coin */
/* Coin outcome comes only from the server's existing public log, never local RNG. */
(() => {
  const origin=window.__TABLETOP_ANDROID_TEST_ORIGIN||'https://onepiece-card-online.onrender.com';
  if(location.origin!==origin||location.pathname!=='/game.html')return;
  function mount(){
    const api=window.CardPhonePresentation,$=id=>document.getElementById(id),root=document.documentElement;
    if(!api||$('phoneCoinToss'))return;
    const make=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
    const overlay=make('section','phone-coin-toss');overlay.id='phoneCoinToss';overlay.hidden=true;overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');
    const title=make('h2','','擲硬幣'),coin=make('div','phone-toss-coin'),front=make('div','phone-toss-face'),back=make('div','phone-toss-face phone-toss-back'),result=make('p','','');coin.append(front,back);overlay.append(title,coin,result);document.body.append(overlay);
    let timer=null,resultTimer=null,batchOutcome=null;
    api.prepareCoinBatch=events=>{const log=events?.find(e=>e?.type==='log'&&e.to==='all'&&/擲到\s*(正面|反面)/.test(e.text||''));batchOutcome=log?{face:/擲到\s*正面/.test(log.text)?'heads':'tails',text:typeof formatLogWithNames==='function'?formatLogWithNames(log.text):log.text}:null;};
    function clear(){clearTimeout(timer);clearTimeout(resultTimer);timer=resultTimer=null;overlay.hidden=true;coin.getAnimations().forEach(a=>a.cancel());document.dispatchEvent(new Event('phone-card-center-ready'));}
    api.cancelCoin=clear;api.isCoinBusy=()=>!overlay.hidden;
    if(typeof playCoinFx==='function')playCoinFx=function(){
      if(api.committingPresentation)return;
      if(document.hidden||(typeof isCpuSkipFastMode==='function'&&isCpuSkipFastMode()))return;
      clear();overlay.hidden=false;overlay.dataset.venue=document.body.dataset.venue||'';result.textContent='硬幣判定中…';title.textContent='命運擲幣';
      const outcome=batchOutcome;overlay.dataset.face=outcome?.face||'unknown';
      const box=coin.getBoundingClientRect(),source={x:innerWidth-Math.max(48,box.width/2+12),y:innerHeight-Math.max(48,box.height/2+12)},dx=source.x-(box.left+box.width/2),dy=source.y-(box.top+box.height/2);overlay.dataset.launchX=String(source.x);overlay.dataset.launchY=String(source.y);
      const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches,duration=reduce?700:2400,end=outcome?.face==='tails'?1980:1800;
      if(!reduce)coin.animate([{transform:`translate(${dx}px,${dy}px) rotateX(12deg) rotateY(0) rotateZ(-25deg) scale(.65)`},{transform:`translate(${dx*.35}px,${dy*.1-80}px) rotateX(10deg) rotateY(900deg) rotateZ(20deg) scale(1.08)`,offset:.5},{transform:`translateY(24px) rotateX(48deg) rotateY(${end}deg) rotateZ(12deg) scale(.78)`}],{duration,easing:'cubic-bezier(.2,.65,.3,1)',fill:'forwards'});
      else coin.style.transform=outcome?.face==='tails'?'rotateX(48deg) rotateY(180deg)':'rotateX(48deg)';
      resultTimer=setTimeout(()=>{result.textContent=outcome?.text||'判定完成，請查看對局紀錄';title.textContent=outcome?.face==='heads'?'正面':outcome?.face==='tails'?'反面':'判定完成';},duration);
      timer=setTimeout(clear,duration+1700);
    };
    function decorate(){const modal=$('modal'),button=modal?.querySelector('#okBtn'),pending=typeof state==='object'?state?.pending:null;const isCoin=['queen','bigmom-coin'].includes(pending?.action)&&!!button;
      if(!isCoin){if(modal?.dataset.coinAction)delete modal.dataset.coinAction;return;}
      modal.dataset.coinAction=pending.action;if(button.dataset.coinAction)return;button.dataset.coinAction='true';button.classList.add('phone-toss-button');button.textContent='';button.title='點硬幣，拋向場中央';const hint=make('span','phone-coin-prompt','點硬幣拋擲');button.append(hint);button.setAttribute('aria-label','擲硬幣，依伺服器原規則判定');
    }
    new MutationObserver(decorate).observe($('modal'),{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    for(const e of ['disconnect','JOINED'])socket.on(e,clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});decorate();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();


/* Android presentation module: card-pile-actions */
/* Animate only viewer-visible cards. Random selection and every rule remain on the server. */
(() => {
 const origin=window.__TABLETOP_ANDROID_TEST_ORIGIN||'https://onepiece-card-online.onrender.com';
 if(location.origin!==origin||location.pathname!=='/game.html')return;
 function mount(){
  const api=window.CardPhonePresentation,$=id=>document.getElementById(id);if(!api)return;
  const layer=document.createElement('div');layer.id='phonePileAction';layer.hidden=true;layer.setAttribute('aria-live','polite');document.body.append(layer);
  const label=document.createElement('strong');layer.append(label);
  let generation=0,waiting=null,prepared=false,pileRelease=null;
  const fast=()=>document.hidden||(typeof isCpuSkipFastMode==='function'&&isCpuSkipFastMode());
  const delay=ms=>new Promise(r=>setTimeout(r,fast()?0:ms));
  const discard=()=>document.querySelector('.phone-discard-stack');
  const pileRect=n=>{const r=n?.getBoundingClientRect();if(!r)return null;const w=Math.min(r.width,parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pile-w'))||80);return {left:r.left,top:r.top,width:w,height:w*1.5};};
  function hintAt(n){const r=n?.getBoundingClientRect();if(r)Object.assign(label.style,{left:Math.max(85,Math.min(innerWidth-85,r.left+r.width/2))+'px',top:Math.min(innerHeight-38,r.bottom+28)+'px',width:'170px'});}
  const pileLabel=()=>document.querySelector('.phone-pile-label[aria-label="查看棄牌堆"]');
  function showPileLabel(){const n=pileLabel();if(n)n.style.visibility='';}
  function clear(){pileRelease?.();pileRelease=null;generation++;waiting=null;prepared=false;layer.hidden=true;showPileLabel();layer.querySelectorAll('img').forEach(n=>n.remove());discard()?.removeAttribute('data-kid-draw');api.suppressKidFlash=true;api.cancelLocalCardPreview?.();api.restoreHandArt?.();}
  api.cancelPileAction=clear;
  async function shuffle(node,text,token){
   if(fast())return;layer.hidden=false;label.textContent=text;layer.dataset.phase='shuffle';hintAt(node);if(node===discard()&&pileLabel())pileLabel().style.visibility='hidden';
   const r=pileRect(node);if(!r)return;const release=api.borrowCardVisual?.(node)||(()=>{});pileRelease=release;
   const cards=[];for(let i=0;i<6;i++){const n=document.createElement('img');n.src='images/cards/back.webp';n.alt='';Object.assign(n.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});layer.append(n);cards.push(n);
    n.animate([{transform:`translate(${i*2}px,${-i*2}px) rotate(0)`},{transform:`translate(${(i%2?1:-1)*(r.width*.8)}px,${-22-i*3}px) rotate(${i%2?18:-18}deg)`,offset:.3},{transform:`translate(${i%2?-12:12}px,${-i*3}px) rotate(0)`,offset:.55},{transform:`translate(${i%2?r.width*.6:-r.width*.6}px,${-12-i*3}px) rotate(${i%2?-12:12}deg)`,offset:.78},{transform:`translate(0,${-i*2}px) rotate(0)`}],{duration:1800,delay:i*45,easing:'ease-in-out',fill:'both'});
   }await delay(2150);for(const n of cards)n.remove();release();if(pileRelease===release)pileRelease=null;if(token===generation)layer.hidden=true;
  }
  const masked=new Set();api.maskHandArt=n=>{n=n||api.ownHandElement?.();if(n)masked.add(api.borrowCardVisual(n));};
  api.restoreHandArt=()=>{for(const release of masked)release();masked.clear();};
  api.suppressKidFlash=true;
  if(typeof showKidConfirm==='function')showKidConfirm=async function(which){
   if(waiting)return;const token=++generation;waiting={which,ready:false,round:state?.roundNo,turn:state?.turnIndex};api.closeSheet?.();hideModal();api.previewKid?.();
   while(token===generation&&api.isCardEntering?.())await delay(60);if(token!==generation)return;
   await shuffle(discard(),'基德 · 棄牌洗牌中',token);if(token!==generation||!waiting)return;
   waiting.ready=true;layer.hidden=false;layer.dataset.phase='pick';label.textContent=`棄牌 ${state?.discard?.length||0} 張 · 點擊抽取`;discard()?.setAttribute('data-kid-draw','ready');
  };
  api.isKidAwaiting=()=>!!waiting;
  window.addEventListener('click',e=>{
   if(!waiting&&!prepared)return;
   const hit=e.target.closest?.('.phone-discard-stack,.phone-pile-label[aria-label="查看棄牌堆"]');
   if(!hit&&!e.target.closest?.('#playHand,#playDrawn,#phoneCardConfirm,#btnDraw'))return;
   e.preventDefault();e.stopImmediatePropagation();if(!hit||prepared||!waiting?.ready)return;
   const which=waiting.which;waiting=null;prepared=true;layer.hidden=true;showPileLabel();discard()?.removeAttribute('data-kid-draw');sendAction('PLAY_CARD',{which});
  },true);
  api.beforePileBatch=s=>{if(waiting&&s&&(s.roundNo!==waiting.round||s.turnIndex!==waiting.turn||s.turnStep!=='choose'))clear();};
  api.presentPileBatch=async (events,next)=>{
   const token=generation,old=state,viewer=me?.playerId;
   const play=events.find(e=>e.to==='all'&&e.type==='log'&&/ 打出 \d+｜/.test(e.text||''));
   const id=Number(play?.text.match(/ 打出 (\d+)｜/)?.[1]);
   const blocked=new Set(events.filter(e=>e.type==='card_defense').map(e=>e.targetId));
   const affected=(old?.players||[]).flatMap((p,i)=>p.alive&&!blocked.has(i)&&!p.protected&&!p.dodging?[i]:[]);
   const fly=async (from,to,kind,mask=false)=>{if(mask)api.maskHandArt();const yes=api.flyCard?.({from,to,src:'images/cards/back.webp',secret:true,kind,replace:false,hideTarget:false});if(yes)await delay(1150);};
   if(id===0&&events.some(e=>e.type==='log'&&/^薩波：影響/.test(e.text||''))){
    layer.hidden=false;label.textContent='薩波 · 手牌收回牌堆';layer.dataset.phase='return';hintAt($('btnDraw'));
    await Promise.all(affected.map(i=>fly(api.cardPlayerRect?.(i),pileRect($('btnDraw')),'sabo-return',i===viewer)));
    if(token!==generation)return;await shuffle($('btnDraw'),'薩波 · 洗牌中',token);if(token!==generation)return;
    layer.hidden=false;label.textContent='重新發牌';layer.dataset.phase='deal';await Promise.all(affected.map(i=>fly(pileRect($('btnDraw')),api.cardPlayerRect?.(i),'sabo-deal')));
   }else if(id===11&&events.some(e=>e.type==='log'&&/^基德：棄牌堆洗牌抽/.test(e.text||''))){
    if(!prepared)await shuffle(discard(),'基德 · 棄牌洗牌中',token);prepared=false;if(token!==generation)return;
    layer.hidden=false;label.textContent='從棄牌堆抽取';layer.dataset.phase='draw';const target=old.turnIndex===viewer?$('imgDrawn'):api.cardPlayerRect?.(old.turnIndex);
    await fly(pileRect(discard()),target,'kid-draw');
   }else if(id===11&&events.some(e=>e.type==='log'&&/^基德（強化）/.test(e.text||''))){
    layer.hidden=false;label.textContent='基德 · 逆時針傳遞手牌';layer.dataset.phase='pass';
    if(affected.length>1)await Promise.all(affected.map((i,k)=>fly(api.cardPlayerRect?.(i),api.cardPlayerRect?.(affected[(k+affected.length-1)%affected.length]),'kid-pass',i===viewer)));
   }else{
    // Never read opponents' hidden cards. Every outgoing card is a back.
    const out=events.some(e=>e.type==='silent_discard'&&e.by===viewer)||events.some(e=>e.type==='zoro_discard'&&(e.targetId===viewer||e.all));
    if(out&&!events.some(e=>e.type==='duel')){await fly(api.cardPlayerRect?.(viewer),pileRect(discard()),'hand-discard',true);if(next?.players?.[viewer]?.alive&&next.players[viewer].hand!=null)await fly(pileRect($('btnDraw')),api.cardPlayerRect?.(viewer),'hand-redraw');}
   }
   if(token===generation){layer.hidden=true;prepared=false;showPileLabel();}
  };
  for(const type of ['disconnect','JOINED'])socket.on(type,()=>{clear();api.suppressKidFlash=true;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clear();api.suppressKidFlash=true;}});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();


/* Android presentation module: card-turn-draw */
/* Same DRAW command and pending guard, without the old draw cutscene. */
(() => {
 function mount(){
  const api=window.CardPhonePresentation;if(!api||typeof state==='undefined')return;
  if(location.pathname==='/game.html'&&typeof playDrawFxThenDraw==='function')playDrawFxThenDraw=function(){
   const p=state?.players?.[me.playerId];
   if(state?.turnStep!=='draw'||state.turnIndex!==me.playerId||p?.skipNext===true||_drawPlaying||_drawActionPending||api.canSendPresentedAction&&!api.canSendPresentedAction(document.getElementById('btnDraw')))return;
   _drawActionPending={roundNo:state.roundNo??null,turnIndex:state.turnIndex??null,turnStep:state.turnStep??null,deckLength:state.deck?.length??null,sent:true};
   sendAction('DRAW');
  };
  const tag=document.createElement('div');tag.id='cardActiveTurn';tag.setAttribute('role','status');tag.setAttribute('aria-live','polite');document.body.append(tag);let previous='';
  function sync(){
   if(!state?.players)return;const id=state.turnIndex,p=state.players[id],own=id===me.playerId,ended=state.turnStep==='ended';
   const label=p?.client?.displayName||p?.displayName||p?.client?.name||`P${id+1}`;
   const phase=ended?'本局結束':({draw:'抽牌',choose:'選牌'})[state.turnStep]||'等待行動';
   const text=ended?phase:`${own?'你的回合':label+' 的回合'} · ${phase}`,key=JSON.stringify([state.roundNo,id,ended]);
   if(tag.textContent!==text)tag.textContent=text;tag.dataset.own=String(own);tag.hidden=!p||state.phase==='lobby';
   for(const [i,row]of [...document.querySelectorAll('#players > div')].entries())row.dataset.activeTurn=String(i===id&&!ended);
   const self=document.getElementById('phoneSelfPlayer');if(self)self.dataset.activeTurn=String(own&&!ended);
   if(previous!==key){previous=key;if(!matchMedia('(prefers-reduced-motion: reduce)').matches)tag.animate([{opacity:.4,transform:'translateX(-50%) scale(.95)'},{opacity:1,transform:'translateX(-50%) scale(1)'}],{duration:650});}
  }
  let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;sync();});};
  new MutationObserver(schedule).observe(document.getElementById('players'),{childList:true,subtree:true});
  if(typeof socket==='object')socket.on('STATE',schedule);sync();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();


/* Android presentation module: card-seat-hud */
/* Stable visual seats. Server player IDs/DOM indices stay untouched; CSS order
 * follows this round's startSeat and the engine's increasing-seat traversal. */
(() => {
  const origin=window.__TABLETOP_ANDROID_TEST_ORIGIN||'https://onepiece-card-online.onrender.com';
  if(location.origin!==origin||location.pathname!=='/game.html')return;
  function mount(){
    const api=window.CardPhonePresentation,root=document.documentElement,players=document.getElementById('players');
    if(!api||!players||root.dataset.cardSeatHud)return;
    root.dataset.cardSeatHud='1';
    // Keep the original live balance and venue nodes/listeners inside one art-backed dock.
    const history=document.querySelector('.phone-card-history'),chest=document.getElementById('phoneTreasure'),venuePanel=document.getElementById('venues')?.closest('.card');
    if(history&&chest&&venuePanel){
      const resources=document.createElement('section');resources.id='phoneMatchResources';resources.setAttribute('aria-label','公共寶箱與本局場地');document.body.append(resources);resources.append(chest,venuePanel);
      const caption=chest.querySelector('.phone-treasure-balance>span:first-child');if(caption)caption.textContent='寶箱剩餘';
      const title=venuePanel.firstElementChild;if(title){title.setAttribute('role','button');title.tabIndex=0;title.setAttribute('aria-label','查看全部本局場地');title.onclick=()=>api.openVenues();title.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();api.openVenues();}};}
    }
    const self=document.getElementById('phoneSelfPlayer'),selfDock=document.getElementById('phoneSelfDock');if(selfDock)document.body.append(selfDock);
    const cached=new Map();let queued=false,selfSignature='';
    const make=(tag,cls)=>{const n=document.createElement(tag);n.className=cls;return n;};
    const text=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
    function create(){
      const card=make('div','phone-seat-card'),avatar=make('img','phone-seat-avatar rounded-full'),rank=make('b','phone-seat-rank'),copy=make('div','phone-seat-copy grow'),name=make('div','phone-seat-name font-semibold'),gold=make('div','phone-seat-gold'),icons=make('div','phone-seat-status'),phase=make('span','phone-seat-phase');
      const next=make('span','phone-seat-next'),flag=make('i','phone-seat-next-flag'),nextText=make('span','');flag.setAttribute('aria-hidden','true');next.append(flag,nextText);
      avatar.alt='';avatar.draggable=false;copy.append(name,gold);card.append(avatar,rank,copy,icons,phase,next);
      return {card,avatar,rank,name,gold,icons,phase,next,nextText,statusKey:''};
    }
    const statuses=[['protected',0,'護盾'],['dodging',1,'閃避'],['frozen',2,'凍結'],['skipNext',3,'麻痺'],['iceArmed',4,'冰鬼檢查'],['iceInfected',4,'冰鬼感染']];
    const explanations={protected:'抵擋一般受影響技能；到自己下次開始抽牌時解除。標示無視保護的招式仍可生效，也可能被技能解除。',dodging:'下一次受到可閃避的技能影響時，抵消該次效果並消耗閃避。標示無視閃避的招式仍可生效，也可能被技能解除。',frozen:'下一次出牌只能打剛抽到的牌，不能打原本手牌；合法出牌後解除凍結。',skipNext:'下次輪到自己時跳過該回合，並解除麻痺。',iceArmed:'本回合出牌會接受冰鬼檢查：打出奇數牌會被淘汰；打出偶數牌則解除冰鬼檢查。',iceInfected:'下次輪到自己時轉為冰鬼檢查；屆時打出奇數牌會被淘汰，打出偶數牌可解除。',offline:'此玩家目前斷線，並非戰鬥負面狀態。重新連線後會依遊戲同步狀態更新。'};
    document.addEventListener('click',e=>{
      const badge=e.target.closest('.phone-seat-status-icon');if(!badge)return;
      e.preventDefault();e.stopImmediatePropagation();const key=badge.dataset.status,label=badge.getAttribute('aria-label'),view=make('article','phone-status-detail'),art=make('div','phone-status-detail-art');art.style.backgroundPosition=badge.style.backgroundPosition;art.setAttribute('aria-hidden','true');
      const title=make('h3',''),copy=make('p','');title.textContent=label;copy.textContent=explanations[key]||'';view.append(art,title,copy);api.openView('狀態詳情',view);
    },true);
    function sync(){
      const s=typeof state==='object'?state:null,viewer=typeof me==='object'?me.playerId:null;
      if(!s?.players?.length)return;
      const count=s.players.length,start=Number.isInteger(s.startSeat)?((s.startSeat%count)+count)%count:0;
      // Same precedence as engine.nextRound, including an eliminated Roger holder.
      const roger=Number.isInteger(s.nextRoundStart)&&s.nextRoundStart>=0&&s.nextRoundStart<count,next=roger?s.nextRoundStart:(start+1)%count;
      const hasSelf=Number.isInteger(viewer)&&viewer>=0&&viewer<count;root.style.setProperty('--seat-count',String(Math.max(1,count-(hasSelf?1:0))));if(selfDock)selfDock.hidden=!hasSelf;
      const liveIds=new Set();
      s.players.forEach((p,i)=>{
        const row=players.children[i];if(!row)return;liveIds.add(p.id??i);
        let view=cached.get(p.id??i);if(!view){view=create();cached.set(p.id??i,view);}
        const original=row.querySelector(':scope > .flex');
        if(original)original.classList.add('phone-seat-original');
        if(view.card.parentElement!==row)row.prepend(view.card);
        const order=(i-start+count)%count,active=s.turnIndex===i&&p.alive&&s.turnStep!=='ended'&&s.phase!=='lobby';
        row.style.order=String(order);row.dataset.seatOrder=String(order+1);row.dataset.seatId=String(i);row.dataset.seatActive=String(!!active);row.dataset.seatOut=String(!p.alive);row.dataset.seatSelf=String(i===viewer);
        if(active)row.setAttribute('aria-current','step');else row.removeAttribute('aria-current');
        const label=p.client?.displayName||p.displayName||p.client?.name||`P${i+1}`;
        text(view.rank,String(order+1));view.rank.title=`本局第 ${order+1} 順位`;
        text(view.name,(i===viewer?'你 · ':'')+label);view.name.title=label;
        text(view.gold,`金幣 ${p.gold||0}${p.isCPU?' · CPU':''}`);
        view.next.hidden=i!==next;view.next.dataset.reason=roger?'roger':'rotation';text(view.nextText,roger?'下局先手 · 羅傑':'下局先手');view.next.title=roger?'一般羅傑效果：持有者出局，但下局由持有者先手；強化預測勝者不影響這個標記':'依本局起始順位輪替，這位玩家下局先手';
        const src=typeof AVA==='function'?AVA(p.client?.avatar??p.avatar):original?.querySelector('img.rounded-full')?.getAttribute('src');
        if(src&&view.avatar.getAttribute('src')!==src)view.avatar.src=src;
        const list=statuses.filter(([key])=>p[key]&&(key!=='iceInfected'||!p.iceArmed));if(p.client?.offline)list.push(['offline',5,'斷線']);
        const key=JSON.stringify([!p.alive,list]);
        if(view.statusKey!==key){view.statusKey=key;view.icons.replaceChildren();
          if(!p.alive)text(view.icons,'已出局');
          else if(!list.length)text(view.icons,`第 ${order+1} 順位`);
          else for(const [key,index,label] of list){const badge=make('button','phone-seat-status-icon');badge.type='button';badge.dataset.status=key;badge.style.backgroundPosition=`${(index%3)*50}% ${Math.floor(index/3)*100}%`;badge.setAttribute('aria-label',label);view.icons.append(badge);}
        }else if(p.alive&&!list.length)text(view.icons,`第 ${order+1} 順位`);
        view.phase.hidden=!active;text(view.phase,'▼ '+(i===viewer?'你的回合':'正在行動')+' · '+(s.pending?'技能':s.turnStep==='draw'?'抽牌':'選牌'));
        if(i===viewer&&self){const signature=view.card.outerHTML;if(signature!==selfSignature){selfSignature=signature;self.replaceChildren(view.card.cloneNode(true));}self.dataset.seatId=String(i);self.dataset.seatOrder=String(order+1);self.dataset.seatActive=String(!!active);self.dataset.seatOut=String(!p.alive);self.setAttribute('aria-label',`自己的資訊，第 ${order+1} 順位，${label}`);}
      });
      for(const id of cached.keys())if(!liveIds.has(id))cached.delete(id);
      api.playerVisualElement=id=>id===viewer&&players.closest('main')?self:players.children[id];
    }
    const schedule=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;sync();});};
    new MutationObserver(schedule).observe(players,{childList:true,subtree:true});
    socket.on('STATE',schedule);socket.on('JOINED',()=>{cached.clear();schedule();});
    sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();


/* Android presentation module: card-phone-flow */
/* Queue complete EMIT/STATE transactions for presentation. Server rules and
 * packet formats stay unchanged; stale displayed controls cannot send actions. */
(() => {
  const origin=window.__TABLETOP_ANDROID_TEST_ORIGIN||'https://onepiece-card-online.onrender.com';
  if(location.origin!==origin||location.pathname!=='/game.html')return;
  function mount(){
    const api=window.CardPhonePresentation,root=document.documentElement,$=id=>document.getElementById(id);
    if(!api||root.dataset.cardFlow||typeof socket!=='object'||!socket.listeners||!socket.off)return;
    root.dataset.cardFlow='1';
    const listeners={EMIT:socket.listeners('EMIT').slice(),STATE:socket.listeners('STATE').slice()};
    for(const type of ['EMIT','STATE'])for(const fn of listeners[type])socket.off(type,fn);
    let batches=[],events=[],latest=null,timer=null,eventTimer=null,settling=false,epoch=0,activeBatch=null;
    const visible=id=>{const n=$(id);return !!n&&!n.hidden&&!n.classList.contains('hidden')&&n.getClientRects().length>0;};
    const fast=()=>document.hidden||(typeof isCpuSkipFastMode==='function'&&isCpuSkipFastMode());
    const signature=s=>JSON.stringify(s&&[s.roundNo,s.turnIndex,s.turnStep,s.pending,s.players?.map(p=>[p.alive,p.hand,p.tempDraw,p.gold,p.protected,p.dodging,p.frozen,p.skipNext])]);
    const effects=()=>!!api.isEffectBusy?.()||!!api.isCoinBusy?.()||['enhOverlay','drawOverlay','coinOverlay'].some(visible)||!!$('phoneCardFlights')?.children.length;
    const reading=()=>!!api.isVenueEntering?.()||visible('phoneCardSheet')||visible('phonePrivateReveal')||visible('phoneLibrary')||visible('cardDexOverlay')||visible('phoneVenueIntro');
    const stage=()=>!!api.isCardResolving?.()&&!api.isLocalCardPreview?.()&&!state?.pending;
    const busy=()=>!fast()&&(effects()||reading()||stage());
    function dispatch(type,value){for(const fn of listeners[type])fn.call(socket,value);}
    function updateLock(){root.dataset.cardFlowBusy=String(!fast()&&(effects()||reading()||stage()||settling||batches.length>0));}
    function schedule(){clearTimeout(timer);timer=setTimeout(pump,60);}
    function commit(batch,previewed=false){
      api.committingPresentation=previewed;
      try{for(const e of batch.events){if(previewed&&e.type==='enh_fx')continue;dispatch('EMIT',e);}if(batch.state)dispatch('STATE',batch.state);}
      finally{api.committingPresentation=false;requestAnimationFrame(()=>requestAnimationFrame(()=>api.restoreHandArt?.()));}
    }
    const pause=()=>new Promise(r=>setTimeout(r,60));
    async function pump(){
      updateLock();if(settling)return;
      if(!batches.length){delete root.dataset.cardFlowQueued;return;}
      root.dataset.cardFlowQueued=String(batches.length);
      if(busy()){schedule();return;}
      const batch=batches.shift(),generation=epoch;settling=true;activeBatch=batch;updateLock();
      const valid=()=>generation===epoch;
      if(!fast()){
        api.deferResultText=true;api.prepareCoinBatch?.(batch.events);
        for(const e of batch.events)api.presentPlayEvent?.(e);
        // First the played card enters the center; results are not applied yet.
        while(valid()&&!fast()&&api.isCardEntering?.())await pause();
        if(!valid())return;
        const lawScan=batch.events.some(e=>e.type==='law_view'&&e.to===me.playerId);
        const privateFaces=batch.events.some(e=>e.to===me.playerId&&['robin_view','kata_peek','teach_cover'].includes(e.type));
        for(const e of batch.events){
          // Enhanced Law sends a textual peek and a card view for the same private result.
          // The comparison already shows both cards; do not open a second reading gate.
          const duplicateScan=lawScan&&e.type==='peek'&&e.to===me.playerId&&e.lines?.length&&e.lines.every(line=>typeof line==='string'&&line.startsWith('ROOM・SCAN：'));
          if(!duplicateScan){
            if(privateFaces&&e.type==='peek'&&e.to===me.playerId){
              // Card faces already carry the result; retain blocked/empty-target notices only.
              const lines=(e.lines||[]).filter(line=>typeof line==='string'&&/(保護|閃避|無法|無牌)/.test(line));
              if(lines.length)api.presentEffectEvent?.({...e,lines});
            }else api.presentEffectEvent?.(e);
          }
          if(e.type==='coin_fx'&&typeof playCoinFx==='function')playCoinFx();
          if(e.type==='enh_fx'&&typeof playEnhFxFor==='function')playEnhFxFor(e.cardId);
          if(e.type==='law_view'&&e.to===me.playerId&&typeof openLawSwap==='function')openLawSwap(e.targetId,e.cardId);
          if(e.type==='duel'&&typeof playDuel==='function'){
            const log=batch.events.find(x=>x.type==='duel_log'&&(x.loserId===e.leftId||x.loserId===e.rightId));
            playDuel({...e,loserSide:log?(log.loserId===e.leftId?'left':'right'):null,loserCardId:log?.cardId});
          }
        }
        while(valid()&&!fast()&&effects())await pause();
        if(!valid())return;
        await api.presentPileBatch?.(batch.events,batch.state);
        while(valid()&&!fast()&&effects())await pause();
        if(!valid())return;
      }
      api.deferResultText=false;
      if(!fast()){api.flushDeferredResults?.();while(valid()&&!fast()&&effects())await pause();if(!valid())return;}
      commit(batch,!fast());activeBatch=null;
      requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!valid())return;settling=false;updateLock();schedule();}));
    }
    function flushEvents(){clearTimeout(eventTimer);eventTimer=null;if(!events.length)return;if(events.some(e=>e.type==='log'&&/ 打出 \d+｜/.test(e.text||'')))return;batches.push({events:events.splice(0),state:null});pump();}
    socket.on('EMIT',e=>{
      if(['idle_warning','auto_control_changed','lobby','nav_game'].includes(e?.type)){dispatch('EMIT',e);return;}
      events.push(e);clearTimeout(eventTimer);eventTimer=setTimeout(flushEvents,100);
    });
    socket.on('STATE',s=>{
      api.beforePileBatch?.(s);latest=s;clearTimeout(eventTimer);eventTimer=null;batches.push({events:events.splice(0),state:s});
      // Background/CPU-fast views never accumulate a replay backlog.
      if(fast()&&!settling){for(const b of batches.splice(0))commit(b);updateLock();return;}
      pump();
    });
    function reset(){api.deferResultText=false;epoch++;clearTimeout(timer);clearTimeout(eventTimer);batches=[];events=[];latest=null;settling=false;activeBatch=null;api.restoreHandArt?.();delete root.dataset.cardFlowQueued;root.dataset.cardFlowBusy='false';}
    for(const e of ['disconnect','JOINED'])socket.on(e,reset);
    const originalSend=typeof sendAction==='function'?sendAction:null;
    api.canSendPresentedAction=target=>!stage()&&!api.isKidAwaiting?.()&&!effects()&&(!reading()||$('phoneCardSheet')?.dataset.inspectKind==='hand'&&!!target?.closest?.('#phoneCardConfirm,#playHand,#playDrawn'))&&!settling&&!batches.length&&(!latest||signature(latest)===signature(state));
    if(originalSend)sendAction=function(type,payload){if(type!=='TAKE_BACK_CONTROL'&&!fast()&&(batches.length||latest&&signature(latest)!==signature(state)))return;return originalSend(type,payload);};
    api.waitForPresentationIdle=()=>new Promise(resolve=>{const generation=epoch;function check(){if(epoch!==generation||fast()||!busy()&&!settling){resolve();return;}setTimeout(check,80);}setTimeout(check,80);});
    const actionTarget=n=>n?.closest?.('#btnDraw,#playHand,#playDrawn,#phoneCardDraw,#phoneCardConfirm,#modal button,#lawSwapModal button,#luffyBoostModal button,#btnNextRound,main #players [data-fx-target="available"],[data-phone-aim="available"]');
    // Window capture precedes the existing document-level portrait forwarding.
    for(const type of ['click','pointerdown','pointerup','keydown'])window.addEventListener(type,e=>{
      if(type==='keydown'&&!['Enter',' '].includes(e.key))return;
      if(actionTarget(e.target)&&!fast()&&!api.canSendPresentedAction(e.target)){e.preventDefault();e.stopImmediatePropagation();}
    },true);
    new MutationObserver(()=>{updateLock();if(batches.length)schedule();}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class','data-phase']});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){api.closeSheet?.();api.closeLibrary?.();api.clearPrivateReveal?.();api.cancelCoin?.();if(batches.length||activeBatch){const pending=[activeBatch,...batches].filter(Boolean);reset();for(const b of pending)commit(b);}}else schedule();});
    api.presentationQueueSize=()=>batches.length+(settling?1:0);api.presentationEffectsBusy=effects;
    updateLock();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
