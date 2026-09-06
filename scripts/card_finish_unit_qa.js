/* Independently implemented requirement checks, 2026-09-06. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { finishFromSource, selectFinish, mapPointer } = require('../public/js/card_finish_v1.js');
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

const bounds = { left: 100, top: 80, width: 200, height: 300 };
for (const [context, limit] of [['choice', 2.5], ['catalogue', 6]]) {
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
  equal(left.yaw, -right.yaw, 'Horizontal tilt is symmetric');
  equal(mapPointer(NaN, Infinity, { left: 0, top: 0, width: 0, height: 0 }, context).yaw, 0, 'Invalid coordinates and empty geometry remain neutral');
}

// A small event/observer host exercises the real controller's scheduling and
// teardown. Browser layout and the optical appearance require separate UI QA.
function makeHost() {
  const observers = new Set();
  function mutation(target, attributeName) {
    observers.forEach((observer) => {
      const options = observer.targets.get(target);
      if (options && options.attributes && (!options.attributeFilter || options.attributeFilter.includes(attributeName))) {
        observer.records.push({ target, attributeName, type: 'attributes' });
      }
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
      this.computed = { display: 'block', visibility: 'visible', opacity: '1' };
      this.style = {
        properties: new Map(),
        setProperty(name, value) { this.properties.set(name, value); },
        removeProperty(name) { this.properties.delete(name); }
      };
      this.classList = { contains: (name) => (this.getAttribute('class') || '').split(/\s+/).includes(name) };
    }
    append(element) { this.children.push(element); element.parentElement = this; return element; }
    get hidden() { return this.attributes.has('hidden'); }
    getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); mutation(this, name); }
    removeAttribute(name) { if (this.attributes.delete(name)) mutation(this, name); }
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
        if ((selector === 'img' && child.tagName === 'IMG') || (selector === '.card-finish-face' && child.classList.contains('card-finish-face'))) return child;
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
  const fine = new Events(); fine.matches = true;
  const reduced = new Events(); reduced.matches = false;
  const pendingFrames = new Map();
  let frameId = 0;
  const window = new Events();
  Object.assign(window, {
    document, MutationObserver: Observer,
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
  return { window, document, cards, overlay, fine, reduced, pendingFrames, observers, flushMutations, flushFrame };
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

process.stdout.write(`CARD_FINISH_UNIT_QA=PASS (${checks} assertions)\n`);
