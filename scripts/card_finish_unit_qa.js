/* Independently implemented requirement checks, 2026-09-06. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { finishFromSource, selectFinish, mapPointer, depthFromSource, mapDepthPointer } = require('../public/js/card_finish_v1.js');
const base = 'https://card.test/game.html';
let checks = 0;
function equal(actual, expected, message) {
  assert.equal(actual, expected, message);
  checks += 1;
}

for (const source of [
  '/images/cards/enh/1.webp', '/images/cards_lux/enh/12.webp',
  'images/cards/enh/7.webp?v=2', 'https://card.test/images/cards_lux/enh/10.webp#card'
]) equal(finishFromSource(source, base), 'foil', `Enhanced source recognized: ${source}`);

for (const source of [
  null, undefined, '', ' ', '/images/cards/1.webp', '/images/cards/base/1.webp',
  '/images/cards_lux/1.webp', '/images/cards/enh/1.png', '/images/cards/enh/name.webp',
  '/images/cards/enh/1.webp.bak', '/elsewhere/images/cards/enh/1.webp',
  '/images/cards/enh/1.webp/extra', '/images/cards/enh/-1.webp', 'http://['
]) equal(finishFromSource(source, base), 'plain', `Non-enhanced source stays plain: ${source}`);

equal(selectFinish('choice', 'foil', '/images/cards/1.webp', base), 'plain', 'Choice ignores requested foil while the original image remains plain');
equal(selectFinish('choice', 'plain', '/images/cards/enh/1.webp', base), 'foil', 'Choice follows the actual enhanced image despite a stale requested mode');
equal(selectFinish('choice', 'foil', null, base), 'plain', 'Missing choice image cannot enable foil');
equal(selectFinish(null, 'foil', '/images/cards/1.webp', base), 'foil', 'Catalogue accepts its explicit enhanced-preview mode');
equal(selectFinish(null, 'plain', '/images/cards/enh/1.webp', base), 'plain', 'Catalogue plain preview follows its explicit mode');

for (const [directory, variant] of [['cards', 'normal'], ['cards/enh', 'enh'], ['cards_lux', 'lux'], ['cards_lux/enh', 'lux-enh']]) {
  for (let id = 0; id < 20; id += 1) {
    const depth = depthFromSource(`images/${directory}/${id}.webp`, base);
    equal(depth.key, `${variant}/${id}`, 'Every original source has its exact depth variant');
    for (const role of ['background', 'subject', 'foreground']) equal(depth[role], `/images/card-depth/v1/${variant}/${id}/${role}.webp`, 'Each depth role uses the launcher-compatible versioned asset directory');
  }
}
for (const source of [null, '', '/images/cards/20.webp', '/images/cards/-1.webp', '/images/cards/01.webp', '/images/cards/name.webp', '/images/cards/1.png', '/images/CARDS/1.webp', '/images/cards/1.webp.bak', 'https://other.test/images/cards/1.webp', 'data:image/webp;base64,test', 'http://[']) {
  equal(depthFromSource(source, base), null, 'Unknown source cannot request depth assets');
}
equal(depthFromSource('https://card.test/images/cards/3.webp?v=1#preview', base).key, 'normal/3', 'Same-origin source query does not change identity');

const bounds = { left: 100, top: 80, width: 200, height: 300 };
for (const enhanced of [false, true]) {
  const edge = mapDepthPointer(300, 380, bounds, enhanced);
  equal(edge.x, enhanced ? 2 : 1.6, 'Subject horizontal motion scales with card width');
  equal(edge.y, enhanced ? 1.2 : .96, 'Subject vertical motion scales with card width');
  equal(mapDepthPointer(200, 230, bounds, enhanced).x, 0, 'Subject center remains registered');
  equal(mapDepthPointer(900, -900, bounds, enhanced).x, edge.x, 'Subject movement clamps outside the root');
  equal(mapDepthPointer(NaN, Infinity, { left: 0, top: 0, width: 0, height: 0 }, enhanced).y, 0, 'Invalid depth geometry remains neutral');
}
for (const [context, limit] of [['choice', 8], ['catalogue', 12]]) {
  const center = mapPointer(200, 230, bounds, context);
  equal(Math.abs(center.pitch), 0, 'Card center has no pitch');
  equal(Math.abs(center.yaw), 0, 'Card center has no yaw');
  for (let x = -100; x <= 500; x += 25) {
    for (let y = -100; y <= 600; y += 25) {
      const point = mapPointer(x, y, bounds, context);
      assert.ok(Math.hypot(point.pitch, point.yaw) <= limit + 1e-12, `${context} total tilt exceeds its angular budget`);
      assert.ok(Object.values(point).every(Number.isFinite), 'All optical properties must be finite');
      assert.ok(point.lightX >= 24 && point.lightX <= 76 && point.lightY >= 18 && point.lightY <= 82, 'Reflection remains inside its safe region');
      checks += 3;
    }
  }
  const left = mapPointer(100, 230, bounds, context);
  const right = mapPointer(300, 230, bounds, context);
  equal(right.yaw, limit, 'Edge reaches the stronger requested angle');
  equal(mapPointer(200, 80, bounds, context).pitch, limit, 'Top edge reaches the stronger requested angle');
  equal(left.yaw, -right.yaw, 'Horizontal tilt is symmetric');
  equal(mapPointer(NaN, Infinity, { left: 0, top: 0, width: 0, height: 0 }, context).yaw, 0, 'Invalid coordinates and empty geometry remain neutral');
}

// A small event/observer host exercises the real controller's scheduling and
// teardown. Browser layout and the optical appearance require separate UI QA.
function makeHost(options = {}) {
  const observers = new Set();
  const intersections = new Set();
  const requestedImages = [];
  const requestedSources = [];
  const pendingDecodes = new Map();
  function mutation(target, attributeName) {
    observers.forEach((observer) => {
      const options = observer.targets.get(target);
      if (options && options.attributes && (!options.attributeFilter || options.attributeFilter.includes(attributeName))) {
        observer.records.push({ target, attributeName, type: 'attributes' });
      }
    });
  }
  function childMutation(target, addedNodes, removedNodes) {
    observers.forEach((observer) => {
      if (observer.targets.get(target)?.childList) observer.records.push({ target, type: 'childList', addedNodes, removedNodes });
    });
  }
  class Events {
    constructor() { this.events = new Map(); }
    addEventListener(name, callback) {
      if (!this.events.has(name)) this.events.set(name, new Set());
      this.events.get(name).add(callback);
    }
    removeEventListener(name, callback) { if (this.events.has(name)) this.events.get(name).delete(callback); }
    dispatch(name, extra = {}) {
      const event = Object.assign({
        pointerType: 'mouse', clientX: 260, clientY: 140,
        preventDefault() { throw new Error('The visual controller must not cancel input'); },
        stopPropagation() { throw new Error('The visual controller must not intercept input'); }
      }, extra);
      if (this.events.has(name)) [...this.events.get(name)].forEach((callback) => callback(event));
    }
  }
  class Element extends Events {
    constructor(tag, attributes = {}) {
      super();
      this.tagName = tag.toUpperCase();
      this.attributes = new Map(Object.entries(attributes));
      this.children = [];
      this.parentElement = null;
      this.isConnected = true;
      this.complete = true;
      this.naturalWidth = 1242;
      this.naturalHeight = 1863;
      this.generated = false;
      this.computed = { display: 'block', visibility: 'visible', opacity: '1' };
      this.style = {
        properties: new Map(),
        setProperty(name, value) { this.properties.set(name, value); },
        removeProperty(name) { this.properties.delete(name); }
      };
      this.classList = { contains: (name) => (this.getAttribute('class') || '').split(/\s+/).includes(name) };
    }
    append(element) { this.children.push(element); element.parentElement = this; childMutation(this, [element], []); return element; }
    remove() {
      if (!this.parentElement) return;
      const parent = this.parentElement;
      parent.children.splice(parent.children.indexOf(this), 1);
      this.parentElement = null;
      childMutation(parent, [], [this]);
    }
    contains(element) { return this === element || this.children.some((child) => child.contains(element)); }
    get hidden() { return this.attributes.has('hidden'); }
    getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
    setAttribute(name, value) {
      this.attributes.set(name, String(value)); mutation(this, name);
      if (this.generated && this.tagName === 'IMG' && name === 'src') {
        if (!String(value).startsWith('/images/card-depth/')) { this.naturalWidth = 1242; this.naturalHeight = 1863; }
        requestedImages.push(this);
        requestedSources.push(String(value));
      }
    }
    removeAttribute(name) {
      if (this.attributes.delete(name)) mutation(this, name);
      if (name === 'src' && pendingDecodes.has(this)) {
        pendingDecodes.get(this).reject(new Error('Image source removed'));
        pendingDecodes.delete(this);
      }
    }
    decode() {
      return new Promise((resolve, reject) => pendingDecodes.set(this, {
        resolve: () => { this.complete = true; pendingDecodes.delete(this); resolve(); },
        reject: (error = new Error('Fixture decode failure')) => { pendingDecodes.delete(this); reject(error); }
      }));
    }
    getClientRects() { return this.isConnected ? [bounds] : []; }
    getBoundingClientRect() { return bounds; }
    closest() {
      for (let current = this; current; current = current.parentElement) {
        if ((current.tagName === 'BUTTON' && current.attributes.has('disabled')) || current.classList.contains('card-frozen')) return current;
      }
      return null;
    }
    querySelector(selector) {
      for (const child of this.children) {
        if ((selector === 'img' && child.tagName === 'IMG') || (selector.startsWith('.') && child.classList.contains(selector.slice(1)))) return child;
        const result = child.querySelector(selector);
        if (result) return result;
      }
      return null;
    }
  }
  class Observer {
    constructor(callback) { this.callback = callback; this.targets = new Map(); this.records = []; observers.add(this); }
    observe(target, options) { this.targets.set(target, options); }
    disconnect() { this.targets.clear(); this.records = []; }
  }
  class Intersection {
    constructor(callback, settings) { this.callback = callback; this.settings = settings; this.targets = new Set(); intersections.add(this); }
    observe(target) { this.targets.add(target); }
    disconnect() { this.targets.clear(); }
  }
  const body = new Element('body');
  const overlay = body.append(new Element('div'));
  const cards = [];
  for (let index = 0; index < 5; index += 1) {
    const parent = index < 2 ? body.append(new Element('button')) : overlay;
    const root = parent.append(new Element('span', { 'data-card-finish': index === 3 ? 'foil' : 'plain' }));
    if (index < 2) root.setAttribute('data-finish-context', 'choice');
    const face = root.append(new Element('span', { class: 'card-finish-face' }));
    const picture = face.append(new Element('img', { src: '/images/cards/1.webp' }));
    cards.push({ root, face, picture, parent });
  }
  const document = new Events();
  Object.assign(document, { baseURI: base, hidden: false, readyState: 'complete', scans: 0 });
  document.querySelectorAll = () => { document.scans += 1; return cards.map((card) => card.root); };
  document.createElement = (tag) => { const element = new Element(tag); element.generated = true; element.complete = false; element.naturalWidth = 828; element.naturalHeight = 1242; return element; };
  const fine = new Events(); fine.matches = true;
  const reduced = new Events(); reduced.matches = false;
  const connection = new Events(); connection.saveData = false;
  const css = { enabled: true, supports() { return this.enabled; } };
  const pendingFrames = new Map();
  const pendingIdle = new Map();
  const pendingTimers = new Map();
  let frameId = 0;
  let taskId = 0;
  const window = new Events();
  Object.assign(window, {
    document, MutationObserver: Observer,
    CSS: css, navigator: { connection },
    matchMedia: (query) => query.includes('reduced-motion') ? reduced : fine,
    getComputedStyle: (element) => element.computed,
    requestAnimationFrame: (callback) => { frameId += 1; pendingFrames.set(frameId, callback); return frameId; },
    cancelAnimationFrame: (id) => pendingFrames.delete(id),
    IntersectionObserver: Intersection,
    setTimeout: (callback, delay) => { taskId += 1; pendingTimers.set(taskId, { callback, delay }); return taskId; },
    clearTimeout: (id) => pendingTimers.delete(id)
  });
  if (options.idle !== false) {
    window.requestIdleCallback = (callback, settings) => { taskId += 1; pendingIdle.set(taskId, { callback, settings }); return taskId; };
    window.cancelIdleCallback = (id) => pendingIdle.delete(id);
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/js/card_finish_v1.js'), 'utf8'), { window, URL });
  function flushMutations() {
    for (let round = 0; round < 20; round += 1) {
      let delivered = false;
      observers.forEach((observer) => {
        if (observer.records.length) {
          const records = observer.records.splice(0);
          observer.callback(records);
          delivered = true;
        }
      });
      if (!delivered) return;
    }
    throw new Error('Mutation processing did not settle');
  }
  function flushFrame() {
    const callbacks = [...pendingFrames.values()];
    pendingFrames.clear();
    callbacks.forEach((callback) => callback(16));
  }
  function setIntersection(card, visible, ratio = visible ? 1 : 0) {
    intersections.forEach((observer) => {
      if (observer.targets.has(card.root)) observer.callback([{ target: card.root, isIntersecting: visible, intersectionRatio: ratio }]);
    });
  }
  function flushIdle() {
    const callbacks = [...pendingIdle.values()]; pendingIdle.clear();
    callbacks.forEach(({ callback }) => callback({ didTimeout: false, timeRemaining: () => 50 }));
  }
  function flushTimers() {
    const callbacks = [...pendingTimers.values()]; pendingTimers.clear();
    callbacks.forEach(({ callback }) => callback());
  }
  return { window, document, cards, overlay, fine, reduced, connection, css, pendingFrames, pendingIdle, pendingTimers,
    observers, intersections, requestedImages, requestedSources, pendingDecodes, flushMutations, flushFrame, setIntersection, flushIdle, flushTimers };
}

const host = makeHost();
const choice = host.cards[0];
const dex = host.cards[3];
const pose = (card) => { card.root.dispatch('pointermove'); host.flushFrame(); };
const neutral = (card, reason) => {
  equal(card.root.getAttribute('data-finish-engaged'), null, `${reason}: engagement clears`);
  equal(card.face.style.properties.size, 0, `${reason}: all optical coordinates clear`);
  equal(host.pendingFrames.size, 0, `${reason}: no pending animation remains`);
};
equal(host.cards.filter((card) => card.root.getAttribute('data-finish-surface')).length, 4, 'Only four marked surfaces are mounted');
equal(host.cards[4].root.getAttribute('data-finish-surface'), null, 'Additional marked elements are untouched');
for (let count = 0; count < 12; count += 1) choice.root.dispatch('pointermove', { clientX: 100 + count * 12 });
equal(host.pendingFrames.size, 1, 'A pointer burst coalesces to one frame');
host.flushFrame();
equal(choice.root.getAttribute('data-finish-engaged'), 'true', 'Mouse movement engages the surface');
equal(host.pendingFrames.size, 0, 'Rendering never starts a continuing animation loop');
equal(choice.face.style.properties.size, 7, 'An active pose has the expected optical coordinates');
choice.root.dispatch('pointermove');
choice.root.dispatch('pointerleave');
neutral(choice, 'Pointer leave');

pose(choice);
choice.root.dispatch('pointermove');
choice.picture.setAttribute('src', '/images/cards/enh/1.webp');
host.flushMutations();
neutral(choice, 'Original image source changed');
equal(choice.root.getAttribute('data-finish-surface'), 'foil', 'The rendered choice source enables foil');
choice.root.setAttribute('data-card-finish', 'plain');
host.flushMutations();
equal(choice.root.getAttribute('data-finish-surface'), 'foil', 'An unrelated requested mode cannot override the real choice source');
choice.picture.setAttribute('src', '/images/cards/1.webp');
host.flushMutations();
equal(choice.root.getAttribute('data-finish-surface'), 'plain', 'The rendered choice source also removes foil');

pose(choice);
choice.parent.setAttribute('disabled', '');
host.flushMutations();
neutral(choice, 'Original button disabled');
equal(choice.root.getAttribute('data-finish-locked'), 'true', 'Disabled button removes all optical layers');
choice.parent.removeAttribute('disabled');
host.flushMutations();
pose(choice);
choice.picture.setAttribute('class', 'card-frozen');
host.flushMutations();
neutral(choice, 'Original image frozen');
equal(choice.root.getAttribute('data-finish-locked'), 'true', 'Frozen image locks its enclosing surface');
choice.picture.removeAttribute('class');
host.flushMutations();

pose(dex);
host.overlay.setAttribute('hidden', '');
host.flushMutations();
neutral(dex, 'Catalogue ancestor hidden');
equal(dex.root.getAttribute('data-finish-locked'), 'true', 'Hidden catalogue cannot retain active optics');
host.overlay.removeAttribute('hidden');
host.flushMutations();
pose(dex);
equal(dex.root.getAttribute('data-finish-engaged'), 'true', 'Catalogue works after reopening');
host.window.dispatch('scroll');
neutral(dex, 'Scroll');
pose(choice);
host.window.dispatch('blur');
neutral(choice, 'Window blur');
pose(choice);
choice.root.dispatch('pointercancel');
neutral(choice, 'Pointer cancellation');
pose(choice);
host.document.hidden = true;
host.document.dispatch('visibilitychange');
neutral(choice, 'Document hidden');
host.document.hidden = false;
host.document.dispatch('visibilitychange');

pose(choice);
choice.root.dispatch('pointermove', { pointerType: 'touch' });
neutral(choice, 'Touch input');
host.reduced.matches = true;
host.reduced.dispatch('change');
choice.root.dispatch('pointermove');
neutral(choice, 'Reduced motion');
equal(choice.root.getAttribute('data-finish-static'), 'true', 'Reduced motion selects static rendering');
host.reduced.matches = false;
host.reduced.dispatch('change');
host.fine.matches = false;
host.fine.dispatch('change');
choice.root.dispatch('pointermove');
neutral(choice, 'Coarse primary pointer');
equal(host.document.scans, 1, 'Pointer and lifecycle changes never scan the whole document');
equal(choice.root.events.has('click'), false, 'The controller installs no click handler');

host.window.CardFinishV1.destroy();
equal(host.pendingFrames.size, 0, 'Destroy cancels all work');
equal([...host.observers].filter((observer) => observer.targets.size).length, 0, 'Destroy disconnects every mutation observer');
equal(choice.root.getAttribute('data-finish-surface'), null, 'Destroy removes controller metadata');
equal([...choice.root.events.values()].reduce((total, listeners) => total + listeners.size, 0), 0, 'Destroy removes pointer listeners');
equal(host.pendingDecodes.size, 0, 'Destroy releases all unfinished depth image decodes');

async function checkDepthLifecycle() {
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  const depthCount = (fixture) => fixture.requestedSources.filter((src) => src.startsWith('/images/card-depth/')).length;
  const readyCount = (fixture) => fixture.cards.filter((card) => card.root.getAttribute('data-finish-depth') === 'ready').length;
  const absent = (card, label) => {
    equal(card.root.getAttribute('data-finish-depth'), null, label + ': no ready metadata');
    equal(card.face.querySelector('.card-finish-depth'), null, label + ': original is the only artwork');
    equal(card.face.children[0], card.picture, label + ': original stays first');
  };
  const pose = (fixture, card = fixture.cards[0]) => { card.root.dispatch('pointermove'); fixture.flushFrame(); };
  const startIdle = async (fixture) => {
    fixture.flushIdle(); fixture.flushTimers(); await settle(); fixture.flushMutations();
  };
  const completeImages = async (fixture) => {
    for (let stage = 0; stage < 20; stage += 1) {
      [...fixture.pendingDecodes.values()].forEach((decode) => decode.resolve());
      await settle(); fixture.flushMutations();
      if (!fixture.pendingDecodes.size) return;
    }
    throw new Error('Decode work did not settle within the fixture bound');
  };
  const reenter = async (fixture, card = fixture.cards[0]) => {
    fixture.setIntersection(card, false); fixture.setIntersection(card, true);
    fixture.flushMutations(); await startIdle(fixture);
  };
  const destroy = async (fixture) => {
    fixture.window.CardFinishV1.destroy(); await settle(); fixture.flushMutations();
    equal(fixture.pendingIdle.size + fixture.pendingTimers.size + fixture.pendingFrames.size, 0, 'Destroy removes idle, timer and RAF work');
    equal(fixture.pendingDecodes.size, 0, 'Destroy releases pending decodes');
    equal([...fixture.intersections].every((observer) => observer.targets.size === 0), true, 'Destroy disconnects intersection observers');
  };

  const css = fs.readFileSync(path.join(__dirname, '../public/css/card-finish-v1.css'), 'utf8');
  const readyRule = css.split(/\r?\n/).find((line) => line.includes('[data-finish-depth="ready"]'));
  equal(!!readyRule && !readyRule.includes('data-finish-engaged'), true, 'A complete depth composite is visible without hover engagement');

  const h = makeHost();
  const first = h.cards[0], second = h.cards[1];
  equal(h.requestedImages.length, 0, 'Initial mount never fetches before a visibility observation');
  equal(h.pendingIdle.size, 0, 'Unobserved surfaces do not schedule speculative idle loads');
  h.setIntersection(h.cards[4], true); pose(h, h.cards[4]); await startIdle(h);
  equal(depthCount(h), 0, 'Fifth surface remains request-free even when observed and pointed at');
  h.setIntersection(first, true, 0); await startIdle(h);
  equal(depthCount(h), 0, 'Zero intersection area is not eligible');
  h.setIntersection(first, true);
  equal(h.pendingIdle.size, 1, 'Visible original schedules exactly one controlled idle task');
  h.window.CardFinishV1.refresh(); h.flushMutations();
  equal(h.pendingIdle.size, 1, 'Repeated sync does not duplicate the idle task');
  equal(depthCount(h), 0, 'Visibility alone does not start a synchronous download');
  await startIdle(h);
  equal(depthCount(h), 3, 'Idle loads exactly the visible card three assets without any hover');
  equal(h.pendingDecodes.size, 3, 'All three assets have independent decode gates');
  absent(first, 'Assets pending');
  const decodes = [...h.pendingDecodes.values()];
  decodes[0].resolve(); decodes[1].resolve(); await settle();
  absent(first, 'Only two assets decoded');
  decodes[2].resolve(); await settle(); h.flushMutations();
  absent(first, 'Source clone is still pending');
  equal(h.pendingDecodes.size, 1, 'Source clone independently gates readiness');
  equal(h.requestedSources.at(-1), 'https://card.test/images/cards/1.webp', 'Foreground clone reuses exact original URL');
  await completeImages(h);
  equal(first.root.getAttribute('data-finish-depth'), 'ready', 'Idle completion automatically attaches the full composite');
  equal(first.root.getAttribute('data-finish-engaged'), null, 'Automatic readiness does not invent hover engagement');
  const composite = first.face.querySelector('.card-finish-depth');
  equal(composite.getAttribute('aria-hidden'), 'true', 'Decorative subtree is hidden from accessibility');
  equal(composite.children.length, 3, 'Visible subtree has exactly three ordered role images');
  equal(composite.children.map((image) => image.getAttribute('class')).join(','), 'card-finish-depth-background,card-finish-depth-subject,card-finish-depth-foreground', 'Layer order is background, subject and original clone');
  equal(composite.children.every((image) => image.getAttribute('alt') === '' && image.getAttribute('draggable') === 'false'), true, 'Decorative images add no labels or dragging');
  equal(composite.style.properties.size, 0, 'Idle pose has neutral subject displacement');
  equal(composite.children[2].style.properties.get('mask-image'), 'url("/images/card-depth/v1/normal/1/foreground.webp")', 'Clone uses standard alpha mask');
  equal(composite.children[2].style.properties.get('-webkit-mask-image'), 'url("/images/card-depth/v1/normal/1/foreground.webp")', 'Clone uses prefixed alpha mask');
  equal(composite.children.some((image) => image.getAttribute('src')?.endsWith('/foreground.webp')), false, 'Mask preloader is never a visible white layer');
  equal(h.pendingFrames.size, 0, 'Automatic readiness starts no animation loop');

  h.setIntersection(second, true); await startIdle(h); await completeImages(h);
  equal(readyCount(h), 2, 'Two visible surfaces remain depth-ready simultaneously');
  pose(h);
  equal(composite.style.properties.get('--finish-depth-x'), '0.960px', 'Eligible hover keeps existing bounded subject parallax');
  pose(h, second);
  equal(first.root.getAttribute('data-finish-engaged'), null, 'Switching hover clears only the former engagement');
  equal(first.face.querySelector('.card-finish-depth'), composite, 'Switching hover retains the former decoded subtree');
  equal(h.cards.filter((card) => card.root.getAttribute('data-finish-engaged') === 'true').length, 1, 'Only one surface is engaged among multiple ready cards');
  const retained = depthCount(h);
  for (const event of ['pointerleave', 'pointercancel', 'blur', 'scroll', 'resize']) {
    pose(h);
    if (event.startsWith('pointer')) first.root.dispatch(event);
    else h.window.dispatch(event);
    await settle(); h.flushMutations();
    equal(first.face.querySelector('.card-finish-depth'), composite, event + ': retains existing depth');
    equal(first.root.getAttribute('data-finish-depth'), 'ready', event + ': remains ready');
    equal(first.root.getAttribute('data-finish-engaged'), null, event + ': clears engagement');
    equal(first.face.style.properties.size + composite.style.properties.size, 0, event + ': returns to neutral pose');
  }
  for (let cycle = 0; cycle < 20; cycle += 1) {
    pose(h); first.root.dispatch('pointerleave');
    h.flushIdle(); await settle();
  }
  equal(depthCount(h), retained, 'Twenty hover cycles make no additional depth source assignments');
  equal(readyCount(h), 2, 'Hover cycles do not evict visible composites');

  h.setIntersection(first, false); h.flushMutations();
  absent(first, 'Offscreen invalidation');
  equal(composite.children.every((image) => image.getAttribute('src') === null), true, 'Offscreen invalidation clears retained image sources');
  equal(second.root.getAttribute('data-finish-depth'), 'ready', 'Offscreen cleanup affects only its own surface');
  h.setIntersection(first, true); h.setIntersection(first, false);
  equal(h.pendingIdle.size, 0, 'Leaving viewport cancels idle work before requests');
  await startIdle(h); equal(depthCount(h), retained, 'Cancelled idle work is request-free');
  await reenter(h);
  const oldImages = h.requestedImages.slice(-3), oldDecodes = [...h.pendingDecodes.values()];
  first.picture.setAttribute('src', '/images/cards_lux/enh/19.webp'); h.flushMutations();
  absent(first, 'Source changes while loading');
  oldDecodes.forEach((decode) => decode.resolve()); await settle();
  absent(first, 'Late old-source completions');
  equal(oldImages.every((image) => image.getAttribute('src') === null), true, 'Source invalidation clears old image sources');
  await startIdle(h);
  equal(h.requestedSources.slice(-3).every((src) => src.startsWith('/images/card-depth/v1/lux-enh/19/')), true, 'Replacement automatically requests only the new exact variant');
  await completeImages(h);
  equal(first.root.getAttribute('data-finish-depth'), 'ready', 'Replacement becomes ready without another pointer event');

  for (const [label, block, unblock] of [
    ['Disabled', () => first.parent.setAttribute('disabled', ''), () => first.parent.removeAttribute('disabled')],
    ['Frozen', () => first.picture.setAttribute('class', 'card-frozen'), () => first.picture.removeAttribute('class')],
    ['Hidden ancestor', () => first.parent.setAttribute('hidden', ''), () => first.parent.removeAttribute('hidden')],
    ['Reduced motion', () => { h.reduced.matches = true; h.reduced.dispatch('change'); }, () => { h.reduced.matches = false; h.reduced.dispatch('change'); }],
    ['Coarse pointer', () => { h.fine.matches = false; h.fine.dispatch('change'); }, () => { h.fine.matches = true; h.fine.dispatch('change'); }],
    ['Save Data', () => { h.connection.saveData = true; h.connection.dispatch('change'); }, () => { h.connection.saveData = false; h.connection.dispatch('change'); }],
    ['No CSS mask', () => { h.css.enabled = false; h.window.dispatch('resize'); }, () => { h.css.enabled = true; h.window.dispatch('resize'); }],
    ['Document hidden', () => { h.document.hidden = true; h.document.dispatch('visibilitychange'); }, () => { h.document.hidden = false; h.document.dispatch('visibilitychange'); }]
  ]) {
    await startIdle(h); await completeImages(h);
    block(); h.flushMutations(); await settle();
    absent(first, label);
    const count = depthCount(h);
    pose(h); await startIdle(h);
    equal(depthCount(h), count, label + ': idle and pointer cannot load assets');
    unblock(); h.flushMutations(); await startIdle(h); await completeImages(h);
    equal(first.root.getAttribute('data-finish-depth'), 'ready', label + ': becoming eligible restores idle depth without hover');
  }

  h.setIntersection(second, false);
  await reenter(h);
  [...h.pendingDecodes.values()][1].reject(); await settle(); h.flushMutations();
  absent(first, 'One asset decode failure');
  equal(h.pendingDecodes.size, 0, 'A failed asset releases its sibling decodes');
  const afterFailure = depthCount(h);
  for (let cycle = 0; cycle < 3; cycle += 1) { pose(h); first.root.dispatch('pointerleave'); await startIdle(h); }
  equal(depthCount(h), afterFailure, 'Failure does not retry on hover/leave or repeated idle');
  await reenter(h);
  h.requestedImages.at(-1).naturalWidth = 600;
  await completeImages(h); absent(first, 'Mismatched layer dimensions');
  for (const source of ['/images/cards/20.webp', 'https://other.test/images/cards/3.webp', '/images/cards/01.webp']) {
    first.picture.setAttribute('src', source); h.flushMutations();
    const before = depthCount(h); await startIdle(h);
    equal(depthCount(h), before, 'Invalid or foreign source stays request-free: ' + source);
    absent(first, 'Invalid source');
  }
  first.picture.setAttribute('src', '/images/cards/8.webp');
  first.picture.setAttribute('srcset', '/other.webp 2x'); h.flushMutations();
  const beforeResponsive = depthCount(h); await startIdle(h);
  equal(depthCount(h), beforeResponsive, 'Responsive source stays on original fallback');
  first.picture.removeAttribute('srcset'); first.picture.currentSrc = 'https://card.test/images/cards/3.webp'; h.flushMutations();
  await startIdle(h); equal(depthCount(h), beforeResponsive, 'Stale currentSrc cannot be cloned');
  first.picture.currentSrc = 'https://card.test/images/cards/8.webp'; first.picture.dispatch('load'); h.flushMutations();
  await startIdle(h);
  [...h.pendingDecodes.values()].forEach((decode) => decode.resolve()); await settle();
  equal(h.pendingDecodes.size, 1, 'Foreground clone has its own pending decode');
  [...h.pendingDecodes.values()][0].reject(); await settle();
  absent(first, 'Foreground clone decode failure');
  await reenter(h);
  [...h.pendingDecodes.values()].forEach((decode) => decode.resolve()); await settle();
  const oldClone = [...h.pendingDecodes.values()][0];
  first.picture.setAttribute('src', '/images/cards/3.webp');
  first.picture.currentSrc = 'https://card.test/images/cards/3.webp';
  first.picture.complete = false; h.flushMutations();
  oldClone.resolve(); await settle();
  absent(first, 'Source changes during original clone decode');
  const beforeUnloaded = depthCount(h); await startIdle(h);
  equal(depthCount(h), beforeUnloaded, 'Incomplete original cannot start an idle depth load');
  first.picture.complete = true; first.picture.dispatch('load'); h.flushMutations();
  await startIdle(h);
  const outstanding = [...h.pendingDecodes.values()];
  await destroy(h);
  outstanding.forEach((decode) => decode.resolve()); await settle(); absent(first, 'Late completions after destroy');
  const afterDestroy = depthCount(h);
  h.setIntersection(first, true); pose(h); await startIdle(h);
  equal(depthCount(h), afterDestroy, 'Destroyed controller cannot start new work');
  equal(first.root.events.has('pointerdown') || first.root.events.has('click'), false, 'No pointerdown or click handlers are installed');
  equal(h.connection.events.get('change').size, 0, 'Destroy removes Save Data listener');
  equal(h.document.scans, 2, 'Only initial load and the explicit refresh scan the document');

  const interrupted = makeHost();
  const interruptedCard = interrupted.cards[0];
  interrupted.setIntersection(interruptedCard, true); await startIdle(interrupted);
  const offscreenCompletions = [...interrupted.pendingDecodes.values()];
  interrupted.setIntersection(interruptedCard, false);
  equal(interrupted.pendingDecodes.size, 0, 'Going offscreen during decode releases all pending images');
  offscreenCompletions.forEach((decode) => decode.resolve()); await settle();
  absent(interruptedCard, 'Offscreen late decode completion');
  await reenter(interrupted);
  const staticCompletions = [...interrupted.pendingDecodes.values()];
  interrupted.reduced.matches = true; interrupted.reduced.dispatch('change');
  staticCompletions.forEach((decode) => decode.resolve()); await settle();
  absent(interruptedCard, 'Reduced motion during pending decode');
  equal(interrupted.pendingIdle.size, 0, 'Static transition leaves no queued idle retry');
  await destroy(interrupted);

  const capped = makeHost();
  for (let index = 0; index < 4; index += 1) {
    capped.cards[index].picture.setAttribute('src', '/images/cards/' + index + '.webp');
    capped.setIntersection(capped.cards[index], true);
  }
  capped.flushMutations();
  equal(capped.pendingIdle.size, 4, 'Four eligible hooks have at most four idle jobs');
  equal([...capped.intersections].every((observer) => observer.settings.rootMargin === '0px'), true, 'Intersection observation does not prefetch beyond the viewport');
  await startIdle(capped);
  equal(depthCount(capped), 6, 'At most two card jobs start their three assets concurrently');
  equal(capped.pendingDecodes.size, 6, 'Only two card asset groups are pending');
  const firstBatch = [...capped.pendingDecodes.entries()];
  firstBatch.slice(0, 3).forEach(([, decode]) => decode.resolve()); await settle();
  equal(depthCount(capped), 6, 'A slot remains occupied while its original clone decodes');
  const cloneEntry = [...capped.pendingDecodes.entries()].find(([image]) => !image.getAttribute('src').startsWith('/images/card-depth/'));
  cloneEntry[1].resolve(); await settle(); capped.flushMutations();
  equal(depthCount(capped), 9, 'Finishing one complete card admits exactly one queued card');
  equal(capped.pendingDecodes.size, 6, 'The queue keeps at most two pending card groups');
  await completeImages(capped);
  equal(depthCount(capped), 12, 'All four current surfaces eventually load exactly their twelve assets');
  equal(readyCount(capped), 4, 'MAX_SURFACES permits four independently ready surfaces');
  equal(capped.pendingIdle.size + capped.pendingFrames.size, 0, 'Finished queue leaves no perpetual scheduler');
  await destroy(capped);

  const queued = makeHost();
  queued.cards.slice(0, 4).forEach((card, index) => {
    card.picture.setAttribute('src', '/images/cards/' + index + '.webp');
    queued.setIntersection(card, true);
  });
  queued.flushMutations(); await startIdle(queued);
  queued.setIntersection(queued.cards[2], false);
  queued.cards[3].picture.setAttribute('src', '/images/cards/9.webp'); queued.flushMutations();
  await startIdle(queued); await completeImages(queued);
  equal(queued.requestedSources.some((src) => src.startsWith('/images/card-depth/v1/normal/2/')), false, 'Offscreen queued card never starts requests');
  equal(queued.requestedSources.some((src) => src.startsWith('/images/card-depth/v1/normal/3/')), false, 'Replaced queued generation never starts old requests');
  equal(queued.requestedSources.filter((src) => src.startsWith('/images/card-depth/v1/normal/9/')).length, 3, 'Latest queued generation loads exactly its own assets');
  await destroy(queued);

  const queuedDestroy = makeHost();
  queuedDestroy.cards.slice(0, 4).forEach((card) => queuedDestroy.setIntersection(card, true));
  await startIdle(queuedDestroy);
  equal(depthCount(queuedDestroy), 6, 'Queued teardown starts with two loading and two waiting cards');
  const destroyedCompletions = [...queuedDestroy.pendingDecodes.values()];
  await destroy(queuedDestroy);
  destroyedCompletions.forEach((decode) => decode.resolve()); await settle();
  equal(depthCount(queuedDestroy), 6, 'Destroy does not start either queued card after slots are released');
  equal(readyCount(queuedDestroy), 0, 'Destroyed queued work cannot attach any composite');

  const fallback = makeHost({ idle: false });
  fallback.setIntersection(fallback.cards[0], true);
  equal(fallback.pendingTimers.size, 1, 'No requestIdleCallback uses one cancellable fallback timer');
  equal(fallback.requestedSources.length, 0, 'Fallback scheduling is not synchronous loading');
  fallback.setIntersection(fallback.cards[0], false);
  equal(fallback.pendingTimers.size, 0, 'Offscreen transition cancels fallback timer');
  fallback.setIntersection(fallback.cards[0], true); await startIdle(fallback); await completeImages(fallback);
  equal(readyCount(fallback), 1, 'Fallback timer automatically loads only its visible card');
  await destroy(fallback);
}
checkDepthLifecycle().then(() => process.stdout.write(`CARD_FINISH_UNIT_QA=PASS (${checks} assertions)\n`)).catch((error) => { console.error(error); process.exitCode = 1; });
