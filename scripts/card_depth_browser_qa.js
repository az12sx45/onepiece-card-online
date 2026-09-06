'use strict';

// Browser acceptance QA for Card Depth V1. The asset sweep always uses real
// HTTP responses from CARD_DEPTH_QA_URL; route injection is confined to the
// explicitly labelled failure/race scenarios below.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createInitialState } = require('../server/engine');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_ROOT = path.join(ROOT, 'public');
const BASE = new URL(process.env.CARD_DEPTH_QA_URL || 'http://127.0.0.1:8849');
const OUTPUT = path.resolve(ROOT, process.env.CARD_DEPTH_QA_OUTPUT || 'artifacts/card-depth-v1/browser');
const PLAYWRIGHT = process.env.BOARD_QA_PLAYWRIGHT || process.env.CARD_DEPTH_QA_PLAYWRIGHT || 'playwright';
const CHROME = process.env.BOARD_QA_CHROME || process.env.CARD_DEPTH_QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const VARIANTS = [
  { key: 'normal', source: id => `/images/cards/${id}.webp`, enhanced: false },
  { key: 'enh', source: id => `/images/cards/enh/${id}.webp`, enhanced: true },
  { key: 'lux', source: id => `/images/cards_lux/${id}.webp`, enhanced: false },
  { key: 'lux-enh', source: id => `/images/cards_lux/enh/${id}.webp`, enhanced: true }
];
const ROLES = ['background', 'subject', 'foreground'];
const report = {
  schemaVersion: 1,
  contract: 'Card Depth V1 real-assets plus isolated controlled-failure browser acceptance',
  base: BASE.origin,
  checks: [],
  errors: [],
  realAssetSweep: null,
  scenarios: {}
};
const runtimeDynamicGroups = new Set();
let depthAssetPrefix = '';
let depthPathToGroup = new Map();
let depthCatalog = new Map();

function depthGroups(paths) {
  return new Set(paths.map(pathname => depthPathToGroup.get(pathname)).filter(Boolean));
}

function recordRuntimeGroups(paths, label) {
  const groups = depthGroups(paths);
  groups.forEach(group => runtimeDynamicGroups.add(group));
  check(groups.size < 80, `${label}: runtime never bulk-loads all 80 card-depth groups`, [...groups]);
  return groups;
}

function depthAsset(variant, id, role) {
  const set = depthCatalog.get(`${variant}/${id}`);
  assert.ok(set && set.layers[role], `Unknown depth asset ${variant}/${id}/${role}`);
  return set.layers[role];
}

function loadSharp() {
  const candidates = [];
  if (process.env.CARD_DEPTH_QA_SHARP) candidates.push(process.env.CARD_DEPTH_QA_SHARP);
  try {
    const packageFile = require.resolve(path.join(PLAYWRIGHT, 'package.json'));
    candidates.push(path.join(path.dirname(packageFile), '..', 'sharp'));
  } catch {}
  candidates.push('sharp');
  for (const candidate of candidates) {
    try { return require(candidate); } catch {}
  }
  throw new Error('Sharp is required for the rendered mask/alignment QA. Set CARD_DEPTH_QA_SHARP to its module path.');
}

function check(value, label, detail) {
  assert.ok(value, label);
  report.checks.push({ label, ...(detail === undefined ? {} : { detail }) });
}

function expectedSets(depthFromSource) {
  const sets = [];
  for (const variant of VARIANTS) {
    for (let id = 0; id < 20; id += 1) {
      const source = variant.source(id);
      const mapped = depthFromSource(source, `${BASE.origin}/game.html`);
      sets.push({
        variant: variant.key,
        id,
        enhanced: variant.enhanced,
        source,
        mapped,
        layers: Object.fromEntries(ROLES.map(role => [role, mapped?.[role] || '']))
      });
    }
  }
  return sets;
}

function localFile(resourcePath) {
  const pathname = new URL(resourcePath, BASE).pathname.replace(/^\/+/, '').replaceAll('/', path.sep);
  const candidate = path.resolve(PUBLIC_ROOT, pathname);
  const prefix = `${path.resolve(PUBLIC_ROOT)}${path.sep}`.toLowerCase();
  assert.ok(candidate.toLowerCase().startsWith(prefix), `Asset escaped public root: ${resourcePath}`);
  return candidate;
}

function validateMappingAndInventory() {
  const modulePath = path.join(PUBLIC_ROOT, 'js', 'card_finish_v1.js');
  delete require.cache[require.resolve(modulePath)];
  const { depthFromSource } = require(modulePath);
  check(typeof depthFromSource === 'function', 'runtime exports the pure depthFromSource mapping contract');
  const sets = expectedSets(depthFromSource);
  const expectedFiles = new Set();
  for (const set of sets) {
    const mapped = set.mapped;
    check(Boolean(mapped), `${set.variant}/${set.id}: original card source maps to depth assets`);
    check(mapped.key === `${set.variant}/${set.id}` && mapped.enhanced === set.enhanced,
      `${set.variant}/${set.id}: mapping preserves variant, id and enhanced state`, mapped);
    for (const role of ROLES) {
      check(mapped[role] === set.layers[role], `${set.variant}/${set.id}: ${role} maps to the exact V1 path`);
      expectedFiles.add(path.normalize(localFile(set.layers[role])).toLowerCase());
    }
  }
  depthCatalog = new Map(sets.map(set => [`${set.variant}/${set.id}`, set]));
  depthPathToGroup = new Map(sets.flatMap(set => ROLES.map(role => [set.layers[role], `${set.variant}/${set.id}`])));
  depthAssetPrefix = depthAsset('normal', 0, 'background').replace(/normal\/0\/background\.webp$/, '');
  check(depthAssetPrefix.startsWith('/') && depthAssetPrefix.endsWith('/') && depthAssetPrefix !== depthAsset('normal', 0, 'background'), 'runtime mapping supplies a discoverable same-origin depth asset prefix', depthAssetPrefix);
  const invalid = [
    '/images/cards/20.webp', '/images/cards/-1.webp', '/images/cards/3.png',
    '/images/cards/enh/x.webp', '/images/cards_lux/03.webp',
    'https://example.invalid/images/cards/3.webp'
  ];
  for (const source of invalid) check(depthFromSource(source, `${BASE.origin}/game.html`) === null, `invalid source is rejected: ${source}`);

  const depthRoot = localFile(depthAssetPrefix);
  const actual = fs.existsSync(depthRoot)
    ? fs.readdirSync(depthRoot, { recursive: true, withFileTypes: true })
      .filter(entry => entry.isFile() && /\.webp$/i.test(entry.name))
      .map(entry => path.normalize(path.join(entry.parentPath || entry.path, entry.name)).toLowerCase())
    : [];
  const missing = [...expectedFiles].filter(file => !fs.existsSync(file));
  const unexpected = actual.filter(file => !expectedFiles.has(file));
  check(expectedFiles.size === 240, '80 card variants declare exactly 240 depth assets');
  check(missing.length === 0, 'all 240 authoritative depth asset files exist', missing);
  check(unexpected.length === 0 && actual.length === 240, 'depth V1 directory contains exactly the expected 240 WebP files', unexpected);
  return sets;
}

async function installPageRoutes(context) {
  await context.route('https://cdn.socket.io/**', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript; charset=utf-8',
    body: 'window.io=()=>{const s={on(){return s},emit(){return s},timeout(){return s},disconnect(){return s},connected:false};return s;}'
  }));
  await context.route(/\.(?:mp3|m4a|wav|ogg|mp4|webm)(?:\?.*)?$/i, route => route.abort('blockedbyclient'));
}

async function openGame(browser, contextOptions = {}, initScript = null) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block',
    ...contextOptions
  });
  await installPageRoutes(context);
  if (initScript) await context.addInitScript(initScript);
  await context.addInitScript(() => { HTMLMediaElement.prototype.play = function play() { return Promise.resolve(); }; });
  const depthRequests = [];
  const depthResponses = [];
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(String(error)));
  page.on('request', request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith(depthAssetPrefix)) depthRequests.push(pathname);
  });
  page.on('response', response => {
    const pathname = new URL(response.url()).pathname;
    if (pathname.startsWith(depthAssetPrefix)) depthResponses.push({ pathname, status: response.status(), contentType: response.headers()['content-type'] || '' });
  });
  await page.goto(`${BASE.origin}/game.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.CardFinishV1 && document.querySelectorAll('[data-card-finish]').length === 4);
  return { context, page, depthRequests, depthResponses };
}

async function installDepthAssignmentRecorder(page) {
  await page.evaluate(prefix => {
    const key = '__CARD_DEPTH_QA_IMAGE_SRC_ASSIGNMENTS__';
    if (Array.isArray(window[key])) {
      window[key].length = 0;
      return;
    }
    const originalSetAttribute = Element.prototype.setAttribute;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (!descriptor?.get || !descriptor?.set || descriptor.configurable === false) {
      throw new Error('HTMLImageElement.src cannot be instrumented for depth assignment QA');
    }
    const assignments = [];
    const record = value => {
      try {
        const pathname = new URL(String(value), document.baseURI).pathname;
        if (pathname.startsWith(prefix)) assignments.push(pathname);
      } catch {}
    };
    Object.defineProperty(window, key, { configurable: true, value: assignments });
    Element.prototype.setAttribute = function setAttribute(name, value) {
      if (this instanceof HTMLImageElement && String(name).toLowerCase() === 'src') record(value);
      return originalSetAttribute.call(this, name, value);
    };
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set(value) {
        record(value);
        return descriptor.set.call(this, value);
      }
    });
  }, depthAssetPrefix);
}

async function setChoiceFixture(page, handSource = '/images/cards/3.webp', drawnSource = '/images/cards/enh/3.webp') {
  const snapshot = createInitialState(2);
  snapshot.turnStep = 'choose';
  snapshot.turnIndex = 0;
  snapshot.venues = [];
  snapshot.discard = [];
  snapshot.myDeluxe = [];
  snapshot.players[0].hand = 3;
  snapshot.players[0].tempDraw = 8;
  snapshot.players[1].hand = null;
  snapshot.players[1].tempDraw = null;
  await page.evaluate(({ snapshot, handSource, drawnSource }) => {
    me = { roomId: 'card-depth-fixture', playerId: 0, secret: '' };
    state = structuredClone(snapshot);
    feed = [];
    _enhPlayed.clear();
    _lastRoundNo = state.roundNo;
    window.__depthActions = [];
    sendAction = (type, payload) => window.__depthActions.push({ type, which: payload?.which });
    render();
    const assign = (id, source) => {
      const image = document.getElementById(id);
      image.removeAttribute('srcset');
      image.removeAttribute('sizes');
      image.src = source;
    };
    assign('imgHand', handSource);
    assign('imgDrawn', drawnSource);
    CardFinishV1.refresh();
  }, { snapshot, handSource, drawnSource });
  await page.waitForFunction(([handSource, drawnSource]) => {
    const expected = [handSource, drawnSource].map(source => new URL(source, location.href).pathname);
    return ['imgHand', 'imgDrawn'].every((id, index) => {
      const image = document.getElementById(id);
      return image.complete && image.naturalWidth > 0 && new URL(image.currentSrc || image.src).pathname === expected[index];
    });
  }, [handSource, drawnSource]);
}

async function hover(page, selector, x = .78, y = .24) {
  const locator = page.locator(selector);
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, `${selector} is not visible`);
  await page.mouse.move(box.x + box.width * x, box.y + box.height * y);
  return box;
}

async function waitReady(page, selector) {
  await page.waitForFunction(selector => document.querySelector(selector)?.getAttribute('data-finish-depth') === 'ready', selector, { timeout: 20000 });
}

async function depthState(locator) {
  return locator.evaluate(root => {
    const face = root.querySelector(':scope > .card-finish-face');
    const original = face?.querySelector(':scope > img');
    const depth = face?.querySelector(':scope > .card-finish-depth');
    const children = depth ? [...depth.children] : [];
    const toPath = value => { try { return new URL(value, location.href).pathname; } catch { return ''; } };
    const maskText = children[2] ? `${children[2].style.maskImage || ''} ${children[2].style.webkitMaskImage || ''}` : '';
    const maskMatch = maskText.match(/url\(["']?([^"')]+)["']?\)/);
    const css = depth ? getComputedStyle(depth) : null;
    const originalCss = original ? getComputedStyle(original) : null;
    return {
      root: {
        ready: root.getAttribute('data-finish-depth'),
        engaged: root.getAttribute('data-finish-engaged'),
        locked: root.getAttribute('data-finish-locked'),
        static: root.getAttribute('data-finish-static')
      },
      original: original ? {
        id: original.id,
        src: toPath(original.currentSrc || original.src),
        complete: original.complete,
        naturalWidth: original.naturalWidth,
        naturalHeight: original.naturalHeight,
        display: originalCss.display,
        visibility: originalCss.visibility,
        opacity: originalCss.opacity
      } : null,
      depth: depth ? {
        ariaHidden: depth.getAttribute('aria-hidden'),
        pointerEvents: css.pointerEvents,
        display: css.display,
        childCount: children.length,
        classes: children.map(image => image.className),
        paths: children.map(image => toPath(image.currentSrc || image.src)),
        alt: children.map(image => image.getAttribute('alt')),
        draggable: children.map(image => image.getAttribute('draggable')),
        pointerChildren: children.map(image => getComputedStyle(image).pointerEvents),
        transforms: children.map(image => getComputedStyle(image).transform),
        maskPath: maskMatch ? toPath(maskMatch[1]) : '',
        maskSize: children[2] ? (getComputedStyle(children[2]).maskSize || getComputedStyle(children[2]).webkitMaskSize) : '',
        maskRepeat: children[2] ? (getComputedStyle(children[2]).maskRepeat || getComputedStyle(children[2]).webkitMaskRepeat) : ''
      } : null,
      pitch: parseFloat(face?.style.getPropertyValue('--finish-pitch') || '0'),
      yaw: parseFloat(face?.style.getPropertyValue('--finish-yaw') || '0'),
      depthX: depth?.style.getPropertyValue('--finish-depth-x') || '',
      depthY: depth?.style.getPropertyValue('--finish-depth-y') || ''
    };
  });
}

async function validateRenderedMaskPixels(page, root, maskPath, label) {
  const sharp = loadSharp();
  await page.addStyleTag({ content: [
    '[data-card-finish][data-depth-qa-pixels="true"] > .card-finish-face { transform:none!important; transition:none!important; }',
    '[data-card-finish][data-depth-qa-pixels="true"] > .card-finish-face::before,',
    '[data-card-finish][data-depth-qa-pixels="true"] > .card-finish-face::after { opacity:0!important; }',
    '[data-card-finish][data-depth-qa-hide="true"] .card-finish-depth { display:none!important; }'
  ].join('\n') });
  await root.evaluate(element => {
    element.setAttribute('data-depth-qa-pixels', 'true');
    element.setAttribute('data-depth-qa-hide', 'true');
  });
  await page.waitForTimeout(50);
  const baseline = await root.screenshot({ type: 'png', animations: 'disabled' });
  await root.evaluate(element => element.removeAttribute('data-depth-qa-hide'));
  await page.waitForTimeout(50);
  const composite = await root.screenshot({ type: 'png', animations: 'disabled' });
  const baselineRaw = await sharp(baseline).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const compositeRaw = await sharp(composite).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  check(baselineRaw.info.width === compositeRaw.info.width && baselineRaw.info.height === compositeRaw.info.height,
    `${label}: before/after pixel captures have identical geometry`, { baseline: baselineRaw.info, composite: compositeRaw.info });
  const maskRaw = await sharp(localFile(maskPath))
    .resize(baselineRaw.info.width, baselineRaw.info.height, { fit: 'fill', kernel: sharp.kernel.nearest })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let protectedPixels = 0;
  let openPixels = 0;
  let protectedDelta = 0;
  let openDelta = 0;
  let baselineProtectedWhite = 0;
  let compositeProtectedWhite = 0;
  const total = baselineRaw.info.width * baselineRaw.info.height;
  for (let pixel = 0; pixel < total; pixel += 1) {
    const index = pixel * 4;
    const alpha = maskRaw.data[index + 3];
    const delta = Math.abs(baselineRaw.data[index] - compositeRaw.data[index]) +
      Math.abs(baselineRaw.data[index + 1] - compositeRaw.data[index + 1]) +
      Math.abs(baselineRaw.data[index + 2] - compositeRaw.data[index + 2]);
    if (alpha >= 250) {
      protectedPixels += 1;
      protectedDelta += delta / 3;
      if (Math.min(baselineRaw.data[index], baselineRaw.data[index + 1], baselineRaw.data[index + 2]) >= 245) baselineProtectedWhite += 1;
      if (Math.min(compositeRaw.data[index], compositeRaw.data[index + 1], compositeRaw.data[index + 2]) >= 245) compositeProtectedWhite += 1;
    } else if (alpha <= 5) {
      openPixels += 1;
      openDelta += delta / 3;
    }
  }
  const metrics = {
    width: baselineRaw.info.width,
    height: baselineRaw.info.height,
    protectedPixels,
    openPixels,
    protectedMeanRgbDelta: protectedPixels ? protectedDelta / protectedPixels : null,
    openMeanRgbDelta: openPixels ? openDelta / openPixels : null,
    protectedWhiteRatioBefore: protectedPixels ? baselineProtectedWhite / protectedPixels : null,
    protectedWhiteRatioAfter: protectedPixels ? compositeProtectedWhite / protectedPixels : null
  };
  check(protectedPixels > total * .08 && openPixels > total * .25, `${label}: actual alpha mask contains substantial protected frame/text and open artwork regions`, metrics);
  check(metrics.protectedMeanRgbDelta < 5, `${label}: masked original-card pixels stay aligned with the printed frame/text`, metrics);
  check(Math.abs(metrics.protectedWhiteRatioAfter - metrics.protectedWhiteRatioBefore) < .025, `${label}: rendered foreground is not a white mask plate`, metrics);
  check(metrics.openMeanRgbDelta > .5, `${label}: open mask window actually exposes the separate color layers`, metrics);
  const safe = label.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  fs.writeFileSync(path.join(OUTPUT, `${safe}-original.png`), baseline);
  fs.writeFileSync(path.join(OUTPUT, `${safe}-composite.png`), composite);
  await root.evaluate(element => {
    element.removeAttribute('data-depth-qa-pixels');
    element.removeAttribute('data-depth-qa-hide');
  });
  return metrics;
}

function validateReadyState(state, expected, label) {
  check(state.root.ready === 'ready' && state.root.locked === 'false' && state.root.static === 'false', `${label}: visible fine-pointer surface becomes depth-ready without pointer engagement`, state.root);
  check(state.original?.complete && state.original.naturalWidth > 0 && state.original.display !== 'none' && state.original.visibility !== 'hidden' && Number(state.original.opacity) > 0, `${label}: original card remains loaded and visible as fallback`, state.original);
  check(state.depth?.ariaHidden === 'true' && state.depth.pointerEvents === 'none' && state.depth.display !== 'none', `${label}: decorative composite is aria-hidden, visible and pointer transparent`, state.depth);
  check(state.depth?.childCount === 3 && JSON.stringify(state.depth.classes) === JSON.stringify([
    'card-finish-depth-background', 'card-finish-depth-subject', 'card-finish-depth-foreground'
  ]), `${label}: composite has the three ordered role images`, state.depth?.classes);
  check(state.depth.paths[0] === expected.background && state.depth.paths[1] === expected.subject && state.depth.paths[2] === state.original.src,
    `${label}: color layers use depth assets and foreground is a clone of the exact original card`, state.depth.paths);
  check(state.depth.maskPath === expected.foreground && /100%/.test(state.depth.maskSize) && state.depth.maskRepeat === 'no-repeat', `${label}: foreground clone uses the exact alpha mask at full size`, { maskPath: state.depth.maskPath, maskSize: state.depth.maskSize, maskRepeat: state.depth.maskRepeat });
  check(state.depth.alt.every(value => value === '') && state.depth.draggable.every(value => value === 'false') && state.depth.pointerChildren.every(value => value === 'none'), `${label}: all decorative images are empty-alt, non-draggable and pointer transparent`);
  check(state.depth.transforms[0] === 'none' && state.depth.transforms[2] === 'none' && state.depth.transforms[1] !== 'none', `${label}: only the subject receives parallax translation`, state.depth.transforms);
}

function validateTiltState(state, label, limit) {
  check(state.root.ready === 'ready' && state.root.engaged === 'true', `${label}: hover engages tilt without replacing the ready composite`, state.root);
  const angle = Math.hypot(state.pitch, state.yaw);
  check(angle > limit * .85 && angle <= limit + .01, `${label}: edge hover preserves the ${limit}-degree tilt limit`, angle);
  check(state.depthX !== '' && state.depthY !== '', `${label}: hover updates only the subject parallax coordinates`, { x: state.depthX, y: state.depthY });
}

async function inspectRealAssets(page, sets) {
  const entries = sets.flatMap(set => [
    { set: `${set.variant}/${set.id}`, role: 'original', path: set.source },
    ...ROLES.map(role => ({ set: `${set.variant}/${set.id}`, role, path: set.layers[role] }))
  ]);
  return page.evaluate(async entries => {
    async function inspect(entry) {
      const response = await fetch(entry.path, { cache: 'no-store' });
      const contentType = response.headers.get('content-type') || '';
      const bytes = await response.arrayBuffer();
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
      let decoded = null;
      try {
        const blob = new Blob([bytes], { type: contentType });
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement('canvas');
        canvas.width = 96;
        canvas.height = 144;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let alphaMin = 255, alphaMax = 0, transparent = 0, visible = 0, nonWhiteVisible = 0;
        let outerSamples = 0, outerOpaque = 0, lowerSamples = 0, lowerOpaque = 0, windowSamples = 0, windowOpen = 0;
        const rotatedEnh10 = entry.set === 'enh/10' && entry.role === 'foreground';
        const rotatedProtect = [
          [[.224, .426], [.47, .42], [.49, .559], [.22, .564]],
          [[.63, .414], [.903, .425], [.92, .567], [.625, .568]]
        ];
        let leftTextSamples = 0, leftTextOpaque = 0, badgeSamples = 0, badgeOpaque = 0;
        let rotatedOpenSamples = 0, rotatedOpen = 0;
        const protectSamples = [0, 0], protectOpaque = [0, 0];
        const insidePolygon = (px, py, polygon) => {
          let inside = false;
          for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const [xi, yi] = polygon[i];
            const [xj, yj] = polygon[j];
            if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
          }
          return inside;
        };
        for (let index = 0; index < pixels.length; index += 4) {
          const alpha = pixels[index + 3];
          const pixel = index / 4;
          const x = pixel % canvas.width;
          const y = Math.floor(pixel / canvas.width);
          alphaMin = Math.min(alphaMin, alpha);
          alphaMax = Math.max(alphaMax, alpha);
          if (alpha <= 8) transparent += 1;
          if (alpha >= 32) {
            visible += 1;
            if (Math.min(pixels[index], pixels[index + 1], pixels[index + 2]) < 240) nonWhiteVisible += 1;
          }
          const outer = x < canvas.width * .085 || x >= canvas.width * .915 || y < canvas.height * .07 || y >= canvas.height * .93;
          const lower = y >= canvas.height * (2 / 3);
          const artworkWindow = x >= canvas.width * .16 && x < canvas.width * .84 && y >= canvas.height * .17 && y < canvas.height * .625;
          if (outer) { outerSamples += 1; if (alpha >= 250) outerOpaque += 1; }
          if (lower) { lowerSamples += 1; if (alpha >= 250) lowerOpaque += 1; }
          if (artworkWindow) { windowSamples += 1; if (alpha <= 5) windowOpen += 1; }
          if (rotatedEnh10) {
            const nx = (x + .5) / canvas.width;
            const ny = (y + .5) / canvas.height;
            const leftText = nx >= .07 && nx < .225 && ny >= .215 && ny < .765;
            const badge = nx >= .69 && nx < .918 && ny >= .042 && ny < .244;
            const openArtwork = (nx >= .25 && nx < .62 && ny >= .1 && ny < .35) ||
              (nx >= .25 && nx < .85 && ny >= .6 && ny < .9);
            if (leftText) { leftTextSamples += 1; if (alpha >= 250) leftTextOpaque += 1; }
            if (badge) { badgeSamples += 1; if (alpha >= 250) badgeOpaque += 1; }
            if (openArtwork) { rotatedOpenSamples += 1; if (alpha <= 5) rotatedOpen += 1; }
            rotatedProtect.forEach((polygon, polygonIndex) => {
              if (!insidePolygon(nx, ny, polygon)) return;
              protectSamples[polygonIndex] += 1;
              if (alpha >= 250) protectOpaque[polygonIndex] += 1;
            });
          }
        }
        decoded = {
          width: bitmap.width,
          height: bitmap.height,
          alphaMin,
          alphaMax,
          transparent,
          visible,
          nonWhiteVisible,
          sampledPixels: canvas.width * canvas.height,
          outerOpaqueRatio: outerSamples ? outerOpaque / outerSamples : 0,
          lowerOpaqueRatio: lowerSamples ? lowerOpaque / lowerSamples : 0,
          artworkWindowOpenRatio: windowSamples ? windowOpen / windowSamples : 0,
          rotatedEnh10: rotatedEnh10 ? {
            leftTextOpaqueRatio: leftTextSamples ? leftTextOpaque / leftTextSamples : 0,
            badgeOpaqueRatio: badgeSamples ? badgeOpaque / badgeSamples : 0,
            protectOpaqueRatios: protectSamples.map((samples, index) => samples ? protectOpaque[index] / samples : 0),
            artworkOpenRatio: rotatedOpenSamples ? rotatedOpen / rotatedOpenSamples : 0
          } : null
        };
        bitmap.close();
      } catch (error) {
        decoded = { error: String(error) };
      }
      return { ...entry, status: response.status, contentType, bytes: bytes.byteLength, sha256: digest, decoded };
    }
    const output = new Array(entries.length);
    let cursor = 0;
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (cursor < entries.length) {
        const index = cursor++;
        output[index] = await inspect(entries[index]);
      }
    }));
    return output;
  }, entries);
}

async function validateRealAssetSweep(browser, sets) {
  const context = await browser.newContext({ viewport: { width: 800, height: 600 }, serviceWorkers: 'block' });
  await installPageRoutes(context);
  const page = await context.newPage();
  try {
    await page.goto(`${BASE.origin}/game.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const results = await inspectRealAssets(page, sets);
    check(results.length === 320, 'real HTTP sweep covers 80 originals and all 240 depth assets');
    for (const result of results) {
      const label = `${result.set}/${result.role}`;
      check(result.status === 200, `${label}: real HTTP response is 200`, result.status);
      check(/^image\/webp(?:;|$)/i.test(result.contentType), `${label}: real HTTP response is WebP, not an HTML fallback`, result.contentType);
      check(result.bytes > 256 && result.decoded && !result.decoded.error, `${label}: non-empty response decodes in Chromium`, { bytes: result.bytes, decoded: result.decoded });
      check(result.decoded.width > 0 && result.decoded.height > 0 && Math.abs(result.decoded.width / result.decoded.height - 2 / 3) < .001, `${label}: decoded dimensions keep exact 2:3 card ratio`, result.decoded);
      if (result.role === 'subject') {
        check(result.decoded.transparent > 0 && result.decoded.visible > 0 && result.decoded.alphaMin === 0 && result.decoded.alphaMax > 0, `${label}: isolated subject contains both transparent and visible pixels`, result.decoded);
      } else if (result.role === 'foreground') {
        check(result.decoded.transparent > 0 && result.decoded.visible > 0 && result.decoded.alphaMin === 0 && result.decoded.alphaMax > 0, `${label}: foreground mask contains both protected and open alpha regions`, result.decoded);
        check(result.decoded.nonWhiteVisible <= Math.max(4, result.decoded.visible * .01), `${label}: visible mask pixels are white rather than copied color artwork`, result.decoded);
        if (result.set === 'enh/10') {
          const rotated = result.decoded.rotatedEnh10;
          check(result.decoded.outerOpaqueRatio > .8 && rotated && rotated.leftTextOpaqueRatio > .9 &&
            rotated.badgeOpaqueRatio > .75 && rotated.protectOpaqueRatios.length === 2 &&
            rotated.protectOpaqueRatios.every(ratio => ratio > .72) && rotated.artworkOpenRatio > .9,
          `${label}: rotated layout protects the left text, upper-right badge and both recipe.protect title glyphs while opening artwork`, result.decoded);
        } else {
          check(result.decoded.outerOpaqueRatio > .8 && result.decoded.lowerOpaqueRatio > .8 && result.decoded.artworkWindowOpenRatio > .2, `${label}: mask protects the outer frame/lower printed panel while opening the artwork window`, result.decoded);
        }
      }
    }
    for (const set of sets) {
      const layers = results.filter(result => result.set === `${set.variant}/${set.id}` && ROLES.includes(result.role));
      check(layers.length === 3 && layers.every(layer => layer.decoded.width === layers[0].decoded.width && layer.decoded.height === layers[0].decoded.height), `${set.variant}/${set.id}: all three decoded depth assets have identical dimensions`, layers.map(layer => layer.decoded));
    }
    report.realAssetSweep = {
      evidence: 'Direct same-origin browser fetch and Chromium WebP decode; no card-depth route was stubbed.',
      setCount: sets.length,
      responseCount: results.length,
      assets: results
    };
  } finally {
    await context.close();
  }
}

async function validateFourHooksAndActions(browser) {
  const session = await openGame(browser);
  const { context, page, depthRequests } = session;
  try {
    await installDepthAssignmentRecorder(page);
    await page.mouse.move(2, 2);
    const choiceSpecs = [
      { selector: '#playHand [data-card-finish]', variant: 'normal', id: 3, source: '/images/cards/3.webp', limit: 8 },
      { selector: '#playDrawn [data-card-finish]', variant: 'enh', id: 3, source: '/images/cards/enh/3.webp', limit: 8 }
    ];
    const choiceRequestStart = depthRequests.length;
    const choiceAssignmentStart = await page.evaluate(() => window.__CARD_DEPTH_QA_IMAGE_SRC_ASSIGNMENTS__.length);
    await setChoiceFixture(page);
    await Promise.all(choiceSpecs.map(spec => waitReady(page, spec.selector)));
    const choiceRequested = depthRequests.slice(choiceRequestStart);
    const choiceAssigned = await page.evaluate(start => window.__CARD_DEPTH_QA_IMAGE_SRC_ASSIGNMENTS__.slice(start), choiceAssignmentStart);
    const choiceGroups = recordRuntimeGroups(choiceRequested, 'two visible play choices');
    check(choiceGroups.size === 2 && choiceGroups.has('normal/3') && choiceGroups.has('enh/3'), 'only the two visible play choices auto-load their depth groups', [...choiceGroups]);
    const snapshots = [];
    for (const spec of choiceSpecs) {
      const expected = {
        background: depthAsset(spec.variant, spec.id, 'background'),
        subject: depthAsset(spec.variant, spec.id, 'subject'),
        foreground: depthAsset(spec.variant, spec.id, 'foreground')
      };
      const expectedAssignments = ROLES.map(role => expected[role]);
      const requested = choiceRequested.filter(pathname => expectedAssignments.includes(pathname));
      const assigned = choiceAssigned.filter(pathname => expectedAssignments.includes(pathname));
      const idleState = await depthState(page.locator(spec.selector));
      validateReadyState(idleState, expected, spec.selector);
      check(idleState.root.engaged === null && Math.hypot(idleState.pitch, idleState.yaw) < .01 && idleState.depthX === '' && idleState.depthY === '', `${spec.selector}: idle auto-load does not fake pointer tilt or parallax`, idleState);
      check(assigned.length === 3 && new Set(assigned).size === 3 && expectedAssignments.every(pathname => assigned.includes(pathname)), `${spec.selector}: visible-idle load assigns exactly its three depth image sources once`, { expected: expectedAssignments, assigned });
      check(requested.length >= 3 && new Set(requested).size === 3 && requested.every(pathname => expectedAssignments.includes(pathname)), `${spec.selector}: visible-idle load requests only its three-file set (mask paint may reuse the foreground URL)`, requested);

      const beforeHoverRequests = depthRequests.length;
      const beforeHoverAssignments = await page.evaluate(() => window.__CARD_DEPTH_QA_IMAGE_SRC_ASSIGNMENTS__.length);
      await hover(page, spec.selector);
      await page.waitForFunction(selector => document.querySelector(selector)?.getAttribute('data-finish-engaged') === 'true', spec.selector);
      const state = await depthState(page.locator(spec.selector));
      validateTiltState(state, spec.selector, spec.limit);
      check(depthRequests.length === beforeHoverRequests && await page.evaluate(() => window.__CARD_DEPTH_QA_IMAGE_SRC_ASSIGNMENTS__.length) === beforeHoverAssignments, `${spec.selector}: hover changes presentation only and performs no depth load`);
      check(await page.locator('[data-finish-depth="ready"]').count() === 2 && await page.locator('[data-finish-engaged="true"]').count() === 1, `${spec.selector}: multiple visible cards stay ready while only one is pointer-engaged`);
      if (spec.selector.includes('playHand')) {
        state.pixelMetrics = await validateRenderedMaskPixels(page, page.locator(spec.selector), depthAsset(spec.variant, spec.id, 'foreground'), spec.selector);
      }
      snapshots.push({ spec, idleState, state, assigned, requested });
    }
    check(await page.locator(choiceSpecs[0].selector).getAttribute('data-finish-depth') === 'ready' && await page.locator(`${choiceSpecs[0].selector} .card-finish-depth`).count() === 1, 'engaging the drawn card does not release the hand card visible-idle composite');

    const actionsBefore = await page.evaluate(() => window.__depthActions.length);
    const handBox = await page.locator('#playHand').boundingBox();
    await page.mouse.click(handBox.x + handBox.width / 2, handBox.y + handBox.height / 2);
    const actions = await page.evaluate(() => window.__depthActions);
    check(actions.length === actionsBefore + 1 && actions.at(-1)?.type === 'PLAY_CARD' && actions.at(-1)?.which === 'hand', 'depth subtree forwards one physical hand click to the original action exactly once', actions);

    await page.mouse.move(2, 2);
    await page.waitForTimeout(80);
    check(await page.locator('[data-finish-depth="ready"]').count() === 2 && await page.locator('.card-finish-depth').count() === 2 && await page.locator('[data-finish-engaged="true"]').count() === 0, 'pointer leave clears tilt but preserves visible-idle composites');

    const dexRequestStart = depthRequests.length;
    const dexAssignmentStart = await page.evaluate(() => window.__CARD_DEPTH_QA_IMAGE_SRC_ASSIGNMENTS__.length);
    await page.locator('#cardDexBtn').click();
    await page.locator('.card-dex-thumb[data-id="3"]').click();
    await page.waitForFunction(() => ['cardDexPreviewBase', 'cardDexPreviewEnh'].every(id => { const image = document.getElementById(id); return image?.complete && image.naturalWidth > 0; }));
    const dexSpecs = [
      { selector: '#cardDexPreviewBase', variant: 'normal', limit: 12 },
      { selector: '#cardDexPreviewEnh', variant: 'enh', limit: 12 }
    ];
    await Promise.all(dexSpecs.map(spec => page.waitForFunction(selector => document.querySelector(selector)?.closest('[data-card-finish]')?.dataset.finishDepth === 'ready', spec.selector)));
    const dexRequested = depthRequests.slice(dexRequestStart);
    const dexAssigned = await page.evaluate(start => window.__CARD_DEPTH_QA_IMAGE_SRC_ASSIGNMENTS__.slice(start), dexAssignmentStart);
    const dexGroups = recordRuntimeGroups(dexRequested, 'two visible card-dex previews');
    check(dexGroups.size === 2 && dexGroups.has('normal/3') && dexGroups.has('enh/3'), 'opening the dex auto-loads only its two visible preview groups', [...dexGroups]);
    for (const spec of dexSpecs) {
      const root = page.locator(spec.selector).locator('xpath=ancestor::*[@data-card-finish][1]');
      const rootSelector = `${spec.selector} >> xpath=ancestor::*[@data-card-finish][1]`;
      const expected = {
        background: depthAsset(spec.variant, 3, 'background'),
        subject: depthAsset(spec.variant, 3, 'subject'),
        foreground: depthAsset(spec.variant, 3, 'foreground')
      };
      const expectedAssignments = ROLES.map(role => expected[role]);
      const assigned = dexAssigned.filter(pathname => expectedAssignments.includes(pathname));
      const requested = dexRequested.filter(pathname => expectedAssignments.includes(pathname));
      const idleState = await depthState(root);
      validateReadyState(idleState, expected, rootSelector);
      check(idleState.root.engaged === null, `${rootSelector}: card-dex auto-load remains idle before hover`, idleState.root);
      check(assigned.length === 3 && new Set(assigned).size === 3 && expectedAssignments.every(pathname => assigned.includes(pathname)), `${rootSelector}: dex visible-idle load assigns exactly three sources once`, { expected: expectedAssignments, assigned });
      check(requested.every(pathname => expectedAssignments.includes(pathname)), `${rootSelector}: cache-dependent dex network observations contain no foreign depth asset`, { expected: expectedAssignments, observed: requested });
      const beforeHoverRequests = depthRequests.length;
      const beforeHoverAssignments = await page.evaluate(() => window.__CARD_DEPTH_QA_IMAGE_SRC_ASSIGNMENTS__.length);
      await root.scrollIntoViewIfNeeded();
      const box = await root.boundingBox();
      await page.mouse.move(box.x + box.width * .78, box.y + box.height * .24);
      await page.waitForFunction(selector => document.querySelector(selector)?.closest('[data-card-finish]')?.dataset.finishEngaged === 'true', spec.selector);
      const state = await depthState(root);
      validateTiltState(state, rootSelector, spec.limit);
      check(depthRequests.length === beforeHoverRequests && await page.evaluate(() => window.__CARD_DEPTH_QA_IMAGE_SRC_ASSIGNMENTS__.length) === beforeHoverAssignments, `${rootSelector}: dex hover performs no depth load`);
      check(await page.locator('[data-finish-depth="ready"]').count() === 4 && await page.locator('[data-finish-engaged="true"]').count() === 1, `${rootSelector}: all four visible hooks can remain ready but only one is engaged`);
      snapshots.push({ spec, idleState, state, assigned, requested });
    }
    check(await page.locator('[data-card-finish]').count() === 4, 'all four original game attachment points remain present');
    const maxBefore = depthRequests.length;
    await page.evaluate(() => {
      const extra = document.createElement('span');
      extra.id = 'cardDepthQaFifth';
      extra.setAttribute('data-card-finish', 'plain');
      extra.setAttribute('data-finish-context', 'choice');
      extra.style.cssText = 'position:fixed;left:8px;top:8px;width:120px;display:block;z-index:99999';
      extra.innerHTML = '<span class="card-finish-face"><img src="/images/cards/3.webp" alt=""></span>';
      document.body.append(extra);
      CardFinishV1.refresh();
    });
    await page.waitForFunction(() => document.querySelector('#cardDepthQaFifth img')?.complete && document.querySelector('#cardDepthQaFifth img')?.naturalWidth > 0);
    await page.waitForTimeout(400);
    const fifth = await page.locator('#cardDepthQaFifth').evaluate(element => ({
      surface: element.getAttribute('data-finish-surface'),
      ready: element.getAttribute('data-finish-depth'),
      depthChildren: element.querySelectorAll('.card-finish-depth').length
    }));
    check(fifth.surface === null && fifth.ready === null && fifth.depthChildren === 0 && depthRequests.length === maxBefore, 'MAX_SURFACES=4 leaves a fifth visible display inert and request-free without requiring hover', fifth);
    await page.evaluate(() => document.getElementById('cardDepthQaFifth')?.remove());
    report.scenarios.fourHooks = snapshots;
  } finally {
    await context.close();
  }
}

async function validateRepeatedHoverResources(browser) {
  const session = await openGame(browser);
  const { context, page, depthRequests } = session;
  try {
    await installDepthAssignmentRecorder(page);
    await page.evaluate(() => performance.clearResourceTimings());
    await page.mouse.move(2, 2);
    await setChoiceFixture(page, '/images/cards/3.webp', '/images/cards/8.webp');
    await Promise.all([
      waitReady(page, '#playHand [data-card-finish]'),
      waitReady(page, '#playDrawn [data-card-finish]')
    ]);
    // Ready is set when the composite attaches; allow its CSS mask paint request
    // to enter Resource Timing before proving later pointer events are inert.
    await page.waitForTimeout(150);
    const perCycle = [];
    const expectedAssignments = ROLES.map(role => depthAsset('normal', 3, role));
    const initialAssignments = await page.evaluate(() => window.__CARD_DEPTH_QA_IMAGE_SRC_ASSIGNMENTS__.filter(pathname => pathname.includes('/normal/3/')));
    const initialRequests = depthRequests.filter(pathname => expectedAssignments.includes(pathname));
    check(initialAssignments.length === 3 && new Set(initialAssignments).size === 3, 'visible-idle setup assigns the hand depth assets exactly once before any hover', initialAssignments);
    check(initialRequests.length >= 3 && new Set(initialRequests).size === 3 && initialRequests.every(pathname => expectedAssignments.includes(pathname)), 'visible-idle setup requests only the hand three-file set before any hover', initialRequests);
    recordRuntimeGroups(depthRequests, 'repeated-hover visible-idle setup');
    for (let cycle = 0; cycle < 20; cycle += 1) {
      const before = depthRequests.length;
      const assignmentsBefore = await page.evaluate(() => window.__CARD_DEPTH_QA_IMAGE_SRC_ASSIGNMENTS__.length);
      const timingsBefore = await page.evaluate(prefix => performance.getEntriesByType('resource').filter(entry => new URL(entry.name).pathname.startsWith(prefix)).length, depthAssetPrefix);
      await hover(page, '#playHand [data-card-finish]', cycle % 2 ? .74 : .28, cycle % 3 ? .3 : .72);
      await page.waitForFunction(() => document.querySelector('#playHand [data-card-finish]')?.dataset.finishEngaged === 'true');
      const engaged = await depthState(page.locator('#playHand [data-card-finish]'));
      check(engaged.root.ready === 'ready' && engaged.root.engaged === 'true' && Math.hypot(engaged.pitch, engaged.yaw) > 0 && engaged.depthX !== '' && engaged.depthY !== '', `hover cycle ${cycle + 1}: existing composite only receives tilt/parallax`, engaged);
      await page.mouse.move(2, 2);
      await page.waitForFunction(() => !document.querySelector('[data-finish-engaged="true"]'));
      const idle = await depthState(page.locator('#playHand [data-card-finish]'));
      check(idle.root.ready === 'ready' && idle.root.engaged === null && idle.depthX === '' && idle.depthY === '', `hover cycle ${cycle + 1}: leave clears tilt/parallax but keeps visible-idle depth ready`, idle);
      const requested = depthRequests.slice(before);
      const assigned = await page.evaluate(start => window.__CARD_DEPTH_QA_IMAGE_SRC_ASSIGNMENTS__.slice(start), assignmentsBefore);
      const timingEntries = await page.evaluate(({ start, prefix }) => performance.getEntriesByType('resource')
        .filter(entry => new URL(entry.name).pathname.startsWith(prefix)).slice(start).map(entry => ({
          path: new URL(entry.name).pathname,
          transferSize: entry.transferSize,
          encodedBodySize: entry.encodedBodySize,
          decodedBodySize: entry.decodedBodySize,
          duration: entry.duration
        })), { start: timingsBefore, prefix: depthAssetPrefix });
      check(assigned.length === 0 && requested.length === 0 && timingEntries.length === 0, `hover cycle ${cycle + 1}: hover/leave performs zero image assignment and zero network work`, { assigned, requested, timingEntries });
      perCycle.push({ cycle: cycle + 1, assignments: assigned, requests: requested, resourceTimings: timingEntries, engaged, idle });
    }
    const timing = await page.evaluate(prefix => {
      const entries = performance.getEntriesByType('resource').filter(entry => new URL(entry.name).pathname.startsWith(prefix));
      return {
        count: entries.length,
        transferSize: entries.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
        encodedBodySize: entries.reduce((sum, entry) => sum + (entry.encodedBodySize || 0), 0),
        decodedBodySize: entries.reduce((sum, entry) => sum + (entry.decodedBodySize || 0), 0),
        zeroTransferEntries: entries.filter(entry => entry.transferSize === 0 && entry.decodedBodySize > 0).length,
        entries: entries.map(entry => ({
          path: new URL(entry.name).pathname,
          transferSize: entry.transferSize,
          encodedBodySize: entry.encodedBodySize,
          decodedBodySize: entry.decodedBodySize,
          duration: entry.duration
        }))
      };
    }, depthAssetPrefix);
    const assignmentCount = await page.evaluate(() => window.__CARD_DEPTH_QA_IMAGE_SRC_ASSIGNMENTS__.length);
    check(assignmentCount === 6, 'two visible cards assign six depth sources once; 20 hover cycles add none', assignmentCount);
    check(new Set(depthRequests).size === 6 && depthGroups(depthRequests).size === 2 && timing.entries.every(entry => depthGroups([entry.path]).size === 1), '20 hover cycles expose only the two visible-idle three-file sets and no hover-triggered resource', { requests: depthRequests, timings: timing.entries });
    check(timing.count >= 6, 'visible-idle loads produce measurable browser resource timing evidence before hover', timing);
    check(Number.isFinite(timing.transferSize) && Number.isFinite(timing.decodedBodySize) && timing.decodedBodySize > 0, 'resource timing reports actual transferred/decoded byte totals', timing);
    check(await page.locator('.card-finish-depth').count() === 2 && await page.locator('[data-finish-depth="ready"]').count() === 2, '20-cycle exit retains the two currently visible ready composites');
    report.scenarios.repeatedHover = {
      perCycle,
      timing,
      conclusion: 'Visible cards load once during idle time. Pointer movement only changes tilt/parallax and performs no later source assignment or request. Transfer totals are reported verbatim; this QA does not measure or claim renderer/GPU memory release.'
    };
  } finally {
    await context.close();
  }
}

async function validateLockedAndFrozen(browser) {
  const session = await openGame(browser);
  const { context, page, depthRequests } = session;
  try {
    await setChoiceFixture(page, '/images/cards/3.webp', '/images/cards/8.webp');
    const root = '#playHand [data-card-finish]';
    const handRequestCount = () => depthRequests.filter(pathname => pathname.includes('/normal/3/')).length;
    await page.evaluate(() => { document.getElementById('playHand').disabled = true; CardFinishV1.refresh(); });
    await page.waitForFunction(() => document.querySelector('#playHand [data-card-finish]')?.dataset.finishLocked === 'true');
    const beforeDisabled = handRequestCount();
    await hover(page, root);
    await page.waitForTimeout(250);
    check(handRequestCount() === beforeDisabled && await page.locator(`${root} .card-finish-depth`).count() === 0, 'disabled choice neither requests nor attaches its depth assets');
    const actionsBefore = await page.evaluate(() => window.__depthActions.length);
    const disabledBox = await page.locator('#playHand').boundingBox();
    await page.mouse.click(disabledBox.x + disabledBox.width / 2, disabledBox.y + disabledBox.height / 2);
    check(await page.evaluate(() => window.__depthActions.length) === actionsBefore, 'disabled choice still emits no original action');

    await page.evaluate(() => {
      const button = document.getElementById('playHand');
      button.disabled = false;
      document.getElementById('imgHand').classList.add('card-frozen');
      CardFinishV1.refresh();
    });
    await page.waitForFunction(() => document.querySelector('#playHand [data-card-finish]')?.dataset.finishLocked === 'true');
    const beforeFrozen = handRequestCount();
    await hover(page, root);
    await page.waitForTimeout(250);
    check(handRequestCount() === beforeFrozen && await page.locator(`${root} .card-finish-depth`).count() === 0, 'frozen choice neither requests nor attaches its depth assets');
    check(await page.locator('#imgHand').evaluate(image => image.complete && image.naturalWidth > 0 && getComputedStyle(image).display !== 'none'), 'locked/frozen fallback keeps the original card visible');
    report.scenarios.lockedFrozen = { requests: depthRequests };
  } finally {
    await context.close();
  }
}

async function validateStaticModes(browser) {
  const modes = [
    { name: 'mobile', context: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, expectStatic: true },
    { name: 'reduced', context: { reducedMotion: 'reduce' }, expectStatic: true },
    { name: 'save-data', init: () => {
      const connection = new EventTarget();
      Object.defineProperty(connection, 'saveData', { value: true, configurable: true });
      Object.defineProperty(navigator, 'connection', { value: connection, configurable: true });
    }, expectStatic: false },
    { name: 'no-mask-support', init: () => {
      const original = CSS.supports.bind(CSS);
      CSS.supports = (property, value) => /mask-image/i.test(String(property)) ? false : original(property, value);
    }, expectStatic: false }
  ];
  for (const mode of modes) {
    const session = await openGame(browser, mode.context || {}, mode.init || null);
    const { context, page, depthRequests } = session;
    try {
      await setChoiceFixture(page);
      await page.waitForTimeout(500);
      const state = await depthState(page.locator('#playHand [data-card-finish]'));
      check(depthRequests.length === 0 && !state.depth && state.root.ready === null && state.root.engaged === null, `${mode.name}: visible card stays request-free and depth-free without pointer activation`, { requests: depthRequests, state });
      if (mode.expectStatic) check(state.root.static === 'true', `${mode.name}: finish controller marks the surface static`, state.root);
      else check(state.root.static === 'false', `${mode.name}: data-saving/capability mode disables depth without misreporting pointer capability`, state.root);
      check(state.original?.complete && state.original.naturalWidth > 0, `${mode.name}: original card remains the fallback`);
      report.scenarios[mode.name] = state;
    } finally {
      await context.close();
    }
  }
}

async function validateMissingLayerFallback(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  await installPageRoutes(context);
  const failedPath = depthAsset('normal', 3, 'subject');
  await context.route(`**${failedPath}`, route => route.fulfill({ status: 404, contentType: 'image/webp', body: '' }));
  const requests = [];
  const page = await context.newPage();
  page.on('request', request => { const pathname = new URL(request.url()).pathname; if (pathname.startsWith(depthAssetPrefix)) requests.push(pathname); });
  try {
    await page.goto(`${BASE.origin}/game.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.CardFinishV1);
    await setChoiceFixture(page, '/images/cards/3.webp', '/images/cards/8.webp');
    await page.waitForTimeout(1200);
    const state = await depthState(page.locator('#playHand [data-card-finish]'));
    check(requests.includes(failedPath), 'controlled failure actually requests the designated missing subject');
    check(state.root.ready === null && state.root.engaged === null && !state.depth, 'one auto-loaded 404 layer prevents partial composite attachment without pointer input');
    check(state.original?.complete && state.original.naturalWidth > 0 && Number(state.original.opacity) > 0, '404 fallback leaves the original card visible');
    recordRuntimeGroups(requests, 'controlled missing-layer fallback');
    report.scenarios.missingLayer = { controlledFailure: failedPath, requests, state };
  } finally {
    await context.close();
  }
}

async function validateSourceRace(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  await installPageRoutes(context);
  let releaseOld;
  const oldGate = new Promise(resolve => { releaseOld = resolve; });
  const delayed = [];
  await context.route(`**${depthAssetPrefix}normal/3/*.webp`, async route => {
    const pathname = new URL(route.request().url()).pathname;
    delayed.push(pathname);
    await oldGate;
    const file = localFile(pathname);
    try { await route.fulfill({ status: 200, contentType: 'image/webp', body: fs.readFileSync(file) }); } catch {}
  });
  const page = await context.newPage();
  try {
    await page.goto(`${BASE.origin}/game.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.CardFinishV1);
    await setChoiceFixture(page, '/images/cards/3.webp', '/images/cards/8.webp');
    for (let attempt = 0; attempt < 100 && delayed.length < 3; attempt += 1) await page.waitForTimeout(20);
    check(delayed.length === 3, 'visible-idle race fixture holds all three old-source depth requests before source replacement', delayed);
    await page.evaluate(() => {
      const image = document.getElementById('imgHand');
      image.src = '/images/cards/enh/3.webp';
      CardFinishV1.refresh();
    });
    await page.waitForFunction(() => { const image = document.getElementById('imgHand'); return image.complete && image.naturalWidth > 0 && new URL(image.currentSrc || image.src).pathname === '/images/cards/enh/3.webp'; });
    await waitReady(page, '#playHand [data-card-finish]');
    let state = await depthState(page.locator('#playHand [data-card-finish]'));
    check(state.root.engaged === null && state.depth.paths[0] === depthAsset('enh', 3, 'background') && state.original.src === '/images/cards/enh/3.webp', 'new visible source auto-load wins while old depth decodes are still pending', state);
    releaseOld();
    await page.waitForTimeout(600);
    state = await depthState(page.locator('#playHand [data-card-finish]'));
    check(state.root.ready === 'ready' && state.root.engaged === null && state.depth.paths[0] === depthAsset('enh', 3, 'background') && !state.depth.paths.some(value => value.includes('/normal/3/')), 'late old-source completion cannot replace the current idle composite', state);
    recordRuntimeGroups([...delayed, ...ROLES.map(role => depthAsset('enh', 3, role))], 'rapid source replacement race');
    report.scenarios.sourceRace = { delayed, final: state };
  } finally {
    releaseOld();
    await context.close();
  }
}

async function validateOffscreenVisibility(browser) {
  const session = await openGame(browser);
  const { context, page, depthRequests } = session;
  try {
    await installDepthAssignmentRecorder(page);
    await page.evaluate(() => {
      const root = document.querySelector('#playHand [data-card-finish]');
      root.style.cssText = 'position:fixed;left:40px;top:2000px;width:240px;height:360px;display:block;z-index:1';
      CardFinishV1.refresh();
    });
    await page.waitForTimeout(100);
    await setChoiceFixture(page, '/images/cards/3.webp', '/images/cards/8.webp');
    await waitReady(page, '#playDrawn [data-card-finish]');
    await page.waitForTimeout(350);
    const offscreenRequests = depthRequests.filter(pathname => pathname.includes('/normal/3/'));
    const offscreenAssignments = await page.evaluate(() => window.__CARD_DEPTH_QA_IMAGE_SRC_ASSIGNMENTS__.filter(pathname => pathname.includes('/normal/3/')));
    let state = await depthState(page.locator('#playHand [data-card-finish]'));
    check(offscreenRequests.length === 0 && offscreenAssignments.length === 0 && state.root.ready === null && !state.depth, 'offscreen registered card performs zero depth assignment/request while another visible card can become ready', { offscreenRequests, offscreenAssignments, state });

    const before = depthRequests.length;
    await page.evaluate(() => { document.querySelector('#playHand [data-card-finish]').style.top = '100px'; });
    await waitReady(page, '#playHand [data-card-finish]');
    state = await depthState(page.locator('#playHand [data-card-finish]'));
    const enteredRequests = depthRequests.slice(before).filter(pathname => pathname.includes('/normal/3/'));
    check(enteredRequests.length >= 3 && new Set(enteredRequests).size === 3 && state.root.engaged === null, 'moving the card into the viewport auto-loads only one three-file group without hover', { enteredRequests, state });
    recordRuntimeGroups(depthRequests, 'offscreen-to-visible transition');

    await page.evaluate(() => { document.querySelector('#playHand [data-card-finish]').style.top = '2000px'; });
    await page.waitForFunction(() => !document.querySelector('#playHand [data-card-finish]')?.hasAttribute('data-finish-depth'));
    state = await depthState(page.locator('#playHand [data-card-finish]'));
    check(state.root.ready === null && state.root.engaged === null && !state.depth, 'leaving the viewport releases the composite while retaining the original fallback', state);
    report.scenarios.offscreenVisibility = { offscreenRequests, offscreenAssignments, enteredRequests, final: state };
  } finally {
    await context.close();
  }
}

async function validateDestroyCancellation(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  await installPageRoutes(context);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const requests = [];
  await context.route(`**${depthAssetPrefix}normal/3/*.webp`, async route => {
    requests.push(new URL(route.request().url()).pathname);
    await gate;
    const pathname = new URL(route.request().url()).pathname;
    try { await route.fulfill({ status: 200, contentType: 'image/webp', body: fs.readFileSync(localFile(pathname)) }); } catch {}
  });
  const page = await context.newPage();
  try {
    await page.goto(`${BASE.origin}/game.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.CardFinishV1);
    await setChoiceFixture(page, '/images/cards/3.webp', '/images/cards/8.webp');
    for (let attempt = 0; attempt < 100 && requests.length < 3; attempt += 1) await page.waitForTimeout(20);
    check(requests.length === 3, 'destroy cancellation begins the visible-idle three-file depth load without hover', requests);
    await page.evaluate(() => CardFinishV1.destroy());
    release();
    await page.waitForTimeout(600);
    const state = await depthState(page.locator('#playHand [data-card-finish]'));
    check(state.root.ready === null && !state.depth && state.root.engaged === null, 'destroy prevents late visible-idle decodes from attaching', state);
    check(state.original?.complete && state.original.naturalWidth > 0, 'destroy cancellation keeps original fallback visible');
    const before = requests.length;
    await hover(page, '#playHand [data-card-finish]');
    await page.waitForTimeout(250);
    check(requests.length === before, 'destroy removes pointer/visibility listeners and prevents new depth requests');
    recordRuntimeGroups(requests, 'destroy cancellation');
    report.scenarios.destroyCancellation = { requests, state };
  } finally {
    release();
    await context.close();
  }
}

async function main() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const sets = validateMappingAndInventory();
  const { chromium } = require(PLAYWRIGHT);
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(CHROME) ? { executablePath: CHROME } : {}) });
  try {
    await validateRealAssetSweep(browser, sets);
    await validateFourHooksAndActions(browser);
    await validateRepeatedHoverResources(browser);
    await validateLockedAndFrozen(browser);
    await validateStaticModes(browser);
    await validateMissingLayerFallback(browser);
    await validateSourceRace(browser);
    await validateOffscreenVisibility(browser);
    await validateDestroyCancellation(browser);
    check(runtimeDynamicGroups.size > 0 && runtimeDynamicGroups.size < 80, 'all dynamic runtime scenarios touch only displayed/tested card groups, never the full 80-card catalog', [...runtimeDynamicGroups]);
    report.runtimeDynamicGroups = [...runtimeDynamicGroups];
    check(report.errors.length === 0, 'browser emitted no unhandled page errors', report.errors);
    report.result = 'PASS';
  } catch (error) {
    report.result = 'FAIL';
    report.failure = error.stack || String(error);
    throw error;
  } finally {
    await browser.close();
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(OUTPUT, 'browser-report.json'), `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`CARD_DEPTH_BROWSER_QA=${report.result} checks=${report.checks.length} realSets=${report.realAssetSweep?.setCount || 0}\n`);
  }
}

main().catch(error => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
