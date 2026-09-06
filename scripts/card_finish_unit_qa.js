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
    for (const role of ['background', 'subject', 'foreground']) equal(depth[role], `/card-depth/v1/${variant}/${id}/${role}.webp`, 'Each depth role uses the versioned asset directory');
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
function makeHost() {
  const observers = new Set();
  const requestedImages = [];
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
        if (!String(value).startsWith('/card-depth/')) { this.naturalWidth = 1242; this.naturalHeight = 1863; }
        requestedImages.push(this);
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
  let frameId = 0;
  const window = new Events();
  Object.assign(window, {
    document, MutationObserver: Observer,
    CSS: css, navigator: { connection },
    matchMedia: (query) => query.includes('reduced-motion') ? reduced : fine,
    getComputedStyle: (element) => element.computed,
    requestAnimationFrame: (callback) => { frameId += 1; pendingFrames.set(frameId, callback); return frameId; },
    cancelAnimationFrame: (id) => pendingFrames.delete(id)
  });
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
  return { window, document, cards, overlay, fine, reduced, connection, css, pendingFrames, observers, requestedImages, pendingDecodes, flushMutations, flushFrame };
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
  const depthHost = makeHost();
  const first = depthHost.cards[0], second = depthHost.cards[1];
  const poseDepth = (card = first) => { card.root.dispatch('pointermove'); depthHost.flushFrame(); };
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  const completeImages = async () => {
    for (let stage = 0; stage < 3; stage += 1) {
      [...depthHost.pendingDecodes.values()].forEach((decode) => decode.resolve());
      await settle(); depthHost.flushMutations();
    }
  };
  const absent = (card, label) => {
    equal(card.root.getAttribute('data-finish-depth'), null, label + ': no ready metadata');
    equal(card.face.querySelector('.card-finish-depth'), null, label + ': original image is the only artwork');
    equal(card.face.children[0], card.picture, label + ': original image stays first');
  };
  equal(depthHost.requestedImages.length, 0, 'Initial mount never fetches depth images');
  depthHost.cards[4].root.dispatch('pointermove'); depthHost.flushFrame();
  equal(depthHost.requestedImages.length, 0, 'The fifth surface cannot fetch depth images');
  poseDepth();
  equal(depthHost.requestedImages.length, 3, 'First eligible hover requests only its three images');
  equal(depthHost.pendingDecodes.size, 3, 'All three layers must decode');
  absent(first, 'While decoding');
  const decodes = [...depthHost.pendingDecodes.values()];
  decodes[0].resolve(); decodes[1].resolve(); await settle();
  absent(first, 'Two layers ready');
  decodes[2].resolve(); await settle(); depthHost.flushMutations();
  absent(first, 'The three assets are decoded but source clone is pending');
  equal(depthHost.pendingDecodes.size, 1, 'Source clone decode also gates readiness');
  equal(depthHost.requestedImages.at(-1).getAttribute('src'), 'https://card.test/images/cards/1.webp', 'Fixed foreground reuses the exact original source');
  await completeImages();
  equal(first.root.getAttribute('data-finish-depth'), 'ready', 'Only the complete composite becomes ready');
  const composite = first.face.querySelector('.card-finish-depth');
  equal(composite.getAttribute('aria-hidden'), 'true', 'The decorative subtree is hidden from accessibility');
  equal(composite.children.length, 3, 'Composite has exactly three ordered layers');
  equal(composite.children.every((image) => image.getAttribute('alt') === '' && image.getAttribute('draggable') === 'false'), true, 'Decorative images add no labels or dragging');
  equal(composite.style.properties.get('--finish-depth-x'), '0.960px', 'Latest pointer controls subject displacement');
  equal(composite.children[0].style.properties.has('transform') || composite.children[2].style.properties.has('transform'), false, 'Background and printed foreground have no inline transform');
  equal(composite.children[2].style.properties.get('mask-image'), 'url("/card-depth/v1/normal/1/foreground.webp")', 'Foreground displays original pixels only through its alpha mask');
  equal(composite.children[2].style.properties.get('-webkit-mask-image'), 'url("/card-depth/v1/normal/1/foreground.webp")', 'Foreground supports the prefixed mask property');
  equal(composite.children.some((image) => image.getAttribute('src')?.endsWith('/foreground.webp')), false, 'The mask preload never becomes a visible image');
  equal(depthHost.pendingFrames.size, 0, 'Completing assets starts no animation loop');
  poseDepth();
  equal(depthHost.requestedImages.length, 4, 'Further movement reuses three decoded assets and the cached source clone');
  poseDepth(second);
  absent(first, 'Hover moves directly to another surface');
  equal(first.root.getAttribute('data-finish-engaged'), null, 'The former surface immediately loses tilt');
  equal(composite.children.every((image) => image.getAttribute('src') === null), true, 'The former surface releases all decoded image sources');
  equal(depthHost.pendingDecodes.size, 3, 'Only the new surface owns pending decodes');
  await completeImages();
  equal(second.root.getAttribute('data-finish-depth'), 'ready', 'The new surface can show its own composite');
  second.root.dispatch('pointerleave');
  absent(second, 'Pointer leaves');

  poseDepth();
  const staleImages = depthHost.requestedImages.slice(-3);
  const staleDecodes = [...depthHost.pendingDecodes.values()];
  first.picture.setAttribute('src', '/images/cards_lux/enh/19.webp'); depthHost.flushMutations();
  absent(first, 'Source changes while loading');
  staleDecodes.forEach((decode) => decode.resolve()); await settle();
  absent(first, 'Stale decode completion');
  equal(staleImages.every((image) => image.getAttribute('src') === null), true, 'Source change clears stale image sources');
  poseDepth();
  equal(depthHost.requestedImages.slice(-3).every((image) => image.getAttribute('src').startsWith('/card-depth/v1/lux-enh/19/')), true, 'The new request follows the exact luxury enhancement source');
  await completeImages();
  equal(first.root.getAttribute('data-finish-depth'), 'ready', 'Replacement source displays after its own decode');

  for (const [label, block, unblock] of [
    ['Disabled button', () => first.parent.setAttribute('disabled', ''), () => first.parent.removeAttribute('disabled')],
    ['Frozen source', () => first.picture.setAttribute('class', 'card-frozen'), () => first.picture.removeAttribute('class')],
    ['Hidden ancestor', () => first.parent.setAttribute('hidden', ''), () => first.parent.removeAttribute('hidden')],
    ['Reduced motion', () => { depthHost.reduced.matches = true; depthHost.reduced.dispatch('change'); }, () => { depthHost.reduced.matches = false; depthHost.reduced.dispatch('change'); }],
    ['Coarse pointer', () => { depthHost.fine.matches = false; depthHost.fine.dispatch('change'); }, () => { depthHost.fine.matches = true; depthHost.fine.dispatch('change'); }],
    ['Save Data', () => { depthHost.connection.saveData = true; depthHost.connection.dispatch('change'); }, () => { depthHost.connection.saveData = false; depthHost.connection.dispatch('change'); }]
  ]) {
    poseDepth(); await completeImages();
    block(); depthHost.flushMutations();
    absent(first, label);
    const requests = depthHost.requestedImages.length;
    poseDepth();
    equal(depthHost.requestedImages.length, requests, label + ': cannot start more image requests');
    unblock(); depthHost.flushMutations();
  }
  for (const event of ['pointerleave', 'pointercancel']) {
    poseDepth(); first.root.dispatch(event); await completeImages(); absent(first, event + ' during loading');
  }
  for (const event of ['blur', 'scroll']) {
    poseDepth(); await completeImages(); depthHost.window.dispatch(event); absent(first, event);
  }
  poseDepth(); depthHost.document.hidden = true; depthHost.document.dispatch('visibilitychange'); await completeImages();
  absent(first, 'Document hidden during loading');
  depthHost.document.hidden = false; depthHost.document.dispatch('visibilitychange');
  const beforeTouch = depthHost.requestedImages.length;
  first.root.dispatch('pointermove', { pointerType: 'touch' }); depthHost.flushFrame();
  equal(depthHost.requestedImages.length, beforeTouch, 'Touch never requests depth assets');
  depthHost.css.enabled = false; poseDepth();
  equal(depthHost.requestedImages.length, beforeTouch, 'Missing CSS mask support prevents asset requests');
  absent(first, 'Missing CSS mask support');
  depthHost.css.enabled = true;

  poseDepth(); [...depthHost.pendingDecodes.values()][1].reject(); await settle();
  absent(first, 'One asset decode fails');
  equal(depthHost.pendingDecodes.size, 0, 'A failed composite releases its other pending images');
  const afterFailure = depthHost.requestedImages.length;
  poseDepth();
  equal(depthHost.requestedImages.length, afterFailure, 'An asset failure is not retried on every pointer frame');
  first.root.dispatch('pointerleave');
  poseDepth();
  depthHost.requestedImages[depthHost.requestedImages.length - 1].naturalWidth = 600;
  await completeImages(); absent(first, 'Mismatched layer dimensions');
  first.root.dispatch('pointerleave');
  first.picture.setAttribute('src', '/images/cards/20.webp'); depthHost.flushMutations();
  const beforeInvalid = depthHost.requestedImages.length;
  poseDepth();
  equal(depthHost.requestedImages.length, beforeInvalid, 'An invalid original path sends no depth requests');
  first.picture.setAttribute('src', '/images/cards/8.webp'); first.picture.setAttribute('srcset', '/other.webp 2x'); depthHost.flushMutations();
  poseDepth(); equal(depthHost.requestedImages.length, beforeInvalid, 'An unknown responsive image stays on its original');
  first.picture.removeAttribute('srcset'); depthHost.flushMutations();
  first.picture.currentSrc = 'https://card.test/images/cards/3.webp';
  poseDepth(); equal(depthHost.requestedImages.length, beforeInvalid, 'A stale currentSrc cannot be cloned into the new card');
  first.picture.currentSrc = 'https://card.test/images/cards/8.webp';
  first.root.dispatch('pointerleave');
  poseDepth();
  [...depthHost.pendingDecodes.values()].forEach((decode) => decode.resolve()); await settle();
  equal(depthHost.pendingDecodes.size, 1, 'Source clone is independently pending');
  [...depthHost.pendingDecodes.values()][0].reject(); await settle(); absent(first, 'Original source clone decode fails');
  first.root.dispatch('pointerleave');
  poseDepth();
  [...depthHost.pendingDecodes.values()].forEach((decode) => decode.resolve()); await settle();
  const staleClone = [...depthHost.pendingDecodes.values()][0];
  first.picture.setAttribute('src', '/images/cards/3.webp');
  first.picture.currentSrc = 'https://card.test/images/cards/3.webp';
  depthHost.flushMutations(); staleClone.resolve(); await settle();
  absent(first, 'Source changes during cached foreground clone decode');
  const beforeUnloaded = depthHost.requestedImages.length;
  first.picture.complete = false; poseDepth();
  equal(depthHost.requestedImages.length, beforeUnloaded, 'An original image that has not loaded cannot start depth');
  first.picture.complete = true; first.picture.dispatch('load');
  poseDepth();
  depthHost.window.CardFinishV1.destroy();
  await completeImages(); absent(first, 'Destroy during loading');
  equal(depthHost.pendingDecodes.size, 0, 'Destroy retains no pending depth images');
  equal(depthHost.pendingFrames.size, 0, 'Depth teardown retains no frame');
  equal(depthHost.document.scans, 1, 'Depth lifecycle performs no document-wide scans');
  equal(first.root.events.has('pointerdown') || first.root.events.has('click'), false, 'Depth installs no pointerdown or click handler');
  equal(depthHost.connection.events.get('change').size, 0, 'Destroy removes Save Data change listener');
}

checkDepthLifecycle().then(() => process.stdout.write(`CARD_FINISH_UNIT_QA=PASS (${checks} assertions)\n`)).catch((error) => { console.error(error); process.exitCode = 1; });
