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

function expectedSets() {
  const sets = [];
  for (const variant of VARIANTS) {
    for (let id = 0; id < 20; id += 1) {
      sets.push({
        variant: variant.key,
        id,
        enhanced: variant.enhanced,
        source: variant.source(id),
        layers: Object.fromEntries(ROLES.map(role => [role, `/card-depth/v1/${variant.key}/${id}/${role}.webp`]))
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
  const sets = expectedSets();
  const expectedFiles = new Set();
  for (const set of sets) {
    const mapped = depthFromSource(set.source, `${BASE.origin}/game.html`);
    check(Boolean(mapped), `${set.variant}/${set.id}: original card source maps to depth assets`);
    check(mapped.key === `${set.variant}/${set.id}` && mapped.enhanced === set.enhanced,
      `${set.variant}/${set.id}: mapping preserves variant, id and enhanced state`, mapped);
    for (const role of ROLES) {
      check(mapped[role] === set.layers[role], `${set.variant}/${set.id}: ${role} maps to the exact V1 path`);
      expectedFiles.add(path.normalize(localFile(set.layers[role])).toLowerCase());
    }
  }
  const invalid = [
    '/images/cards/20.webp', '/images/cards/-1.webp', '/images/cards/3.png',
    '/images/cards/enh/x.webp', '/images/cards_lux/03.webp',
    'https://example.invalid/images/cards/3.webp'
  ];
  for (const source of invalid) check(depthFromSource(source, `${BASE.origin}/game.html`) === null, `invalid source is rejected: ${source}`);

  const depthRoot = path.join(PUBLIC_ROOT, 'card-depth', 'v1');
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
    if (pathname.startsWith('/card-depth/v1/')) depthRequests.push(pathname);
  });
  page.on('response', response => {
    const pathname = new URL(response.url()).pathname;
    if (pathname.startsWith('/card-depth/v1/')) depthResponses.push({ pathname, status: response.status(), contentType: response.headers()['content-type'] || '' });
  });
  await page.goto(`${BASE.origin}/game.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.CardFinishV1 && document.querySelectorAll('[data-card-finish]').length === 4);
  return { context, page, depthRequests, depthResponses };
}

async function installDepthAssignmentRecorder(page) {
  await page.evaluate(() => {
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
        if (pathname.startsWith('/card-depth/v1/')) assignments.push(pathname);
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
  });
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

function validateReadyState(state, expected, label, limit) {
  check(state.root.ready === 'ready' && state.root.engaged === 'true' && state.root.locked === 'false' && state.root.static === 'false', `${label}: depth is ready only on an active fine-pointer surface`, state.root);
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
  const angle = Math.hypot(state.pitch, state.yaw);
  check(angle > limit * .85 && angle <= limit + .01, `${label}: edge hover preserves the ${limit}-degree tilt limit`, angle);
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
    await setChoiceFixture(page);
    await installDepthAssignmentRecorder(page);
    const choiceSpecs = [
      { selector: '#playHand [data-card-finish]', variant: 'normal', id: 3, source: '/images/cards/3.webp', limit: 8 },
      { selector: '#playDrawn [data-card-finish]', variant: 'enh', id: 3, source: '/images/cards/enh/3.webp', limit: 8 }
    ];
    const snapshots = [];
    for (const spec of choiceSpecs) {
      const before = depthRequests.length;
      const assignmentsBefore = await page.evaluate(() => window.__CARD_DEPTH_QA_IMAGE_SRC_ASSIGNMENTS__.length);
      await hover(page, spec.selector);
      await waitReady(page, spec.selector);
      const state = await depthState(page.locator(spec.selector));
      validateReadyState(state, {
        background: `/card-depth/v1/${spec.variant}/${spec.id}/background.webp`,
        subject: `/card-depth/v1/${spec.variant}/${spec.id}/subject.webp`,
        foreground: `/card-depth/v1/${spec.variant}/${spec.id}/foreground.webp`
      }, spec.selector, spec.limit);
      const requested = depthRequests.slice(before);
      const assigned = await page.evaluate(start => window.__CARD_DEPTH_QA_IMAGE_SRC_ASSIGNMENTS__.slice(start), assignmentsBefore);
      const expectedAssignments = ROLES.map(role => `/card-depth/v1/${spec.variant}/${spec.id}/${role}.webp`);
      check(assigned.length === 3 && new Set(assigned).size === 3 && expectedAssignments.every(pathname => assigned.includes(pathname)), `${spec.selector}: runtime assigns exactly its three depth image sources once`, { expected: expectedAssignments, assigned });
      check(new Set(requested).size === 3 && ROLES.every(role => requested.includes(`/card-depth/v1/${spec.variant}/${spec.id}/${role}.webp`)), `${spec.selector}: one activation requests exactly its three depth files`, requested);
      check(await page.locator('[data-finish-depth="ready"]').count() === 1, `${spec.selector}: only one of four surfaces is depth-active at a time`);
      if (spec.selector.includes('playHand')) {
        state.pixelMetrics = await validateRenderedMaskPixels(page, page.locator(spec.selector), `/card-depth/v1/${spec.variant}/${spec.id}/foreground.webp`, spec.selector);
      }
      snapshots.push({ spec, state, assigned, requested });
    }
    check(await page.locator(choiceSpecs[0].selector).getAttribute('data-finish-depth') === null && await page.locator(`${choiceSpecs[0].selector} .card-finish-depth`).count() === 0, 'activating drawn card synchronously releases the hand composite');

    const actionsBefore = await page.evaluate(() => window.__depthActions.length);
    const handBox = await page.locator('#playHand').boundingBox();
    await page.mouse.click(handBox.x + handBox.width / 2, handBox.y + handBox.height / 2);
    const actions = await page.evaluate(() => window.__depthActions);
    check(actions.length === actionsBefore + 1 && actions.at(-1)?.type === 'PLAY_CARD' && actions.at(-1)?.which === 'hand', 'depth subtree forwards one physical hand click to the original action exactly once', actions);

    await page.mouse.move(2, 2);
    await page.waitForTimeout(80);
    check(await page.locator('[data-finish-depth="ready"]').count() === 0 && await page.locator('.card-finish-depth').count() === 0, 'pointer leave removes the decoded composite instead of retaining a hidden cache');

    await page.locator('#cardDexBtn').click();
    await page.locator('.card-dex-thumb[data-id="3"]').click();
    await page.waitForFunction(() => ['cardDexPreviewBase', 'cardDexPreviewEnh'].every(id => { const image = document.getElementById(id); return image?.complete && image.naturalWidth > 0; }));
    const dexSpecs = [
      { selector: '#cardDexPreviewBase', variant: 'normal', limit: 12 },
      { selector: '#cardDexPreviewEnh', variant: 'enh', limit: 12 }
    ];
    for (const spec of dexSpecs) {
      const root = page.locator(spec.selector).locator('xpath=ancestor::*[@data-card-finish][1]');
      const rootSelector = `${spec.selector} >> xpath=ancestor::*[@data-card-finish][1]`;
      const before = depthRequests.length;
      const assignmentsBefore = await page.evaluate(() => window.__CARD_DEPTH_QA_IMAGE_SRC_ASSIGNMENTS__.length);
      await root.scrollIntoViewIfNeeded();
      const box = await root.boundingBox();
      await page.mouse.move(box.x + box.width * .78, box.y + box.height * .24);
      await page.waitForFunction(selector => document.querySelector(selector)?.closest('[data-card-finish]')?.dataset.finishDepth === 'ready', spec.selector);
      const state = await depthState(root);
      validateReadyState(state, {
        background: `/card-depth/v1/${spec.variant}/3/background.webp`,
        subject: `/card-depth/v1/${spec.variant}/3/subject.webp`,
        foreground: `/card-depth/v1/${spec.variant}/3/foreground.webp`
      }, rootSelector, spec.limit);
      const expectedAssignments = ROLES.map(role => `/card-depth/v1/${spec.variant}/3/${role}.webp`);
      const assigned = await page.evaluate(start => window.__CARD_DEPTH_QA_IMAGE_SRC_ASSIGNMENTS__.slice(start), assignmentsBefore);
      const requested = depthRequests.slice(before);
      check(assigned.length === 3 && new Set(assigned).size === 3 && expectedAssignments.every(pathname => assigned.includes(pathname)), `${rootSelector}: dex runtime assigns exactly its three depth image sources once`, { expected: expectedAssignments, assigned });
      check(requested.every(pathname => expectedAssignments.includes(pathname)), `${rootSelector}: cache-dependent network observations contain no foreign depth asset`, { expected: expectedAssignments, observed: requested });
      check(await page.locator('[data-finish-depth="ready"]').count() === 1, `${rootSelector}: dex also obeys global single-active ownership`);
      snapshots.push({ spec, state, assigned, requested });
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
    await hover(page, '#cardDepthQaFifth');
    await page.waitForTimeout(250);
    const fifth = await page.locator('#cardDepthQaFifth').evaluate(element => ({
      surface: element.getAttribute('data-finish-surface'),
      ready: element.getAttribute('data-finish-depth'),
      depthChildren: element.querySelectorAll('.card-finish-depth').length
    }));
    check(fifth.surface === null && fifth.ready === null && fifth.depthChildren === 0 && depthRequests.length === maxBefore, 'MAX_SURFACES=4 leaves a fifth injected display inert and request-free', fifth);
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
    await setChoiceFixture(page, '/images/cards/3.webp', '/images/cards/8.webp');
    await installDepthAssignmentRecorder(page);
    await page.evaluate(() => performance.clearResourceTimings());
    const perCycle = [];
    const expectedAssignments = ROLES.map(role => `/card-depth/v1/normal/3/${role}.webp`);
    for (let cycle = 0; cycle < 20; cycle += 1) {
      const before = depthRequests.length;
      const assignmentsBefore = await page.evaluate(() => window.__CARD_DEPTH_QA_IMAGE_SRC_ASSIGNMENTS__.length);
      const timingsBefore = await page.evaluate(() => performance.getEntriesByType('resource').filter(entry => entry.name.includes('/card-depth/v1/')).length);
      await hover(page, '#playHand [data-card-finish]', cycle % 2 ? .74 : .28, cycle % 3 ? .3 : .72);
      await waitReady(page, '#playHand [data-card-finish]');
      check(await page.locator('.card-finish-depth').count() === 1, `hover cycle ${cycle + 1}: exactly one decoded composite is attached`);
      await page.mouse.move(2, 2);
      await page.waitForFunction(() => !document.querySelector('.card-finish-depth') && !document.querySelector('[data-finish-depth="ready"]'));
      const requested = depthRequests.slice(before);
      const assigned = await page.evaluate(start => window.__CARD_DEPTH_QA_IMAGE_SRC_ASSIGNMENTS__.slice(start), assignmentsBefore);
      const timingEntries = await page.evaluate(start => performance.getEntriesByType('resource')
        .filter(entry => entry.name.includes('/card-depth/v1/')).slice(start).map(entry => ({
          path: new URL(entry.name).pathname,
          transferSize: entry.transferSize,
          encodedBodySize: entry.encodedBodySize,
          decodedBodySize: entry.decodedBodySize,
          duration: entry.duration
        })), timingsBefore);
      check(assigned.length === 3 && new Set(assigned).size === 3 && expectedAssignments.every(pathname => assigned.includes(pathname)), `hover cycle ${cycle + 1}: app-level decode lifecycle assigns exactly three assets`, { expected: expectedAssignments, assigned });
      check(requested.every(pathname => expectedAssignments.includes(pathname)), `hover cycle ${cycle + 1}: cache-dependent network observations contain no foreign depth asset`, { expected: expectedAssignments, observed: requested });
      check(timingEntries.every(entry => expectedAssignments.includes(entry.path)), `hover cycle ${cycle + 1}: resource timings contain no foreign depth asset`, timingEntries);
      perCycle.push({ cycle: cycle + 1, assignments: assigned, requests: requested, resourceTimings: timingEntries });
    }
    const timing = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource').filter(entry => entry.name.includes('/card-depth/v1/'));
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
    });
    const assignmentCount = await page.evaluate(() => window.__CARD_DEPTH_QA_IMAGE_SRC_ASSIGNMENTS__.length);
    check(assignmentCount === 60, '20 enter/leave cycles perform exactly 60 app-level depth source assignments', assignmentCount);
    check(depthRequests.every(pathname => expectedAssignments.includes(pathname)) && timing.entries.every(entry => expectedAssignments.includes(entry.path)), '20 enter/leave cycles expose no unexpected network or timing resource', { requests: depthRequests, timings: timing.entries });
    check(timing.count > 0, '20 enter/leave cycles produce measurable browser resource timing evidence', timing);
    check(Number.isFinite(timing.transferSize) && Number.isFinite(timing.decodedBodySize) && timing.decodedBodySize > 0, 'resource timing reports actual transferred/decoded byte totals', timing);
    check(await page.locator('.card-finish-depth').count() === 0, '20-cycle exit leaves no decoded depth image nodes in the DOM');
    report.scenarios.repeatedHover = {
      perCycle,
      timing,
      conclusion: 'DOM image ownership is released on every leave. Per-cycle and aggregate transferSize are reported verbatim; zero-transfer entries indicate browser HTTP/memory-cache reuse. This QA does not measure or claim renderer/GPU memory release.'
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
    await page.evaluate(() => { document.getElementById('playHand').disabled = true; CardFinishV1.refresh(); });
    await page.waitForFunction(() => document.querySelector('#playHand [data-card-finish]')?.dataset.finishLocked === 'true');
    const beforeDisabled = depthRequests.length;
    await hover(page, root);
    await page.waitForTimeout(250);
    check(depthRequests.length === beforeDisabled && await page.locator(`${root} .card-finish-depth`).count() === 0, 'disabled choice neither requests nor attaches depth assets');
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
    const beforeFrozen = depthRequests.length;
    await hover(page, root);
    await page.waitForTimeout(250);
    check(depthRequests.length === beforeFrozen && await page.locator(`${root} .card-finish-depth`).count() === 0, 'frozen choice neither requests nor attaches depth assets');
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
      await hover(page, '#playHand [data-card-finish]');
      await page.waitForTimeout(300);
      const state = await depthState(page.locator('#playHand [data-card-finish]'));
      check(depthRequests.length === 0 && !state.depth && state.root.ready === null, `${mode.name}: unsupported/static mode makes no depth request and attaches no composite`, { requests: depthRequests, state });
      if (mode.expectStatic) check(state.root.static === 'true' && state.root.engaged === null, `${mode.name}: finish controller marks the surface static and unengaged`, state.root);
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
  const failedPath = '/card-depth/v1/normal/3/subject.webp';
  await context.route(`**${failedPath}`, route => route.fulfill({ status: 404, contentType: 'image/webp', body: '' }));
  const requests = [];
  const page = await context.newPage();
  page.on('request', request => { const pathname = new URL(request.url()).pathname; if (pathname.startsWith('/card-depth/v1/')) requests.push(pathname); });
  try {
    await page.goto(`${BASE.origin}/game.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.CardFinishV1);
    await setChoiceFixture(page, '/images/cards/3.webp', '/images/cards/8.webp');
    await hover(page, '#playHand [data-card-finish]');
    await page.waitForTimeout(800);
    const state = await depthState(page.locator('#playHand [data-card-finish]'));
    check(requests.includes(failedPath), 'controlled failure actually requests the designated missing subject');
    check(state.root.ready === null && !state.depth, 'one 404 layer prevents partial composite attachment');
    check(state.original?.complete && state.original.naturalWidth > 0 && Number(state.original.opacity) > 0, '404 fallback leaves the original card visible');
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
  await context.route('**/card-depth/v1/normal/3/*.webp', async route => {
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
    await hover(page, '#playHand [data-card-finish]');
    for (let attempt = 0; attempt < 100 && delayed.length < 3; attempt += 1) await page.waitForTimeout(20);
    check(delayed.length === 3, 'race fixture holds all three old-source depth requests before source replacement', delayed);
    await page.evaluate(() => {
      const image = document.getElementById('imgHand');
      image.src = '/images/cards/enh/3.webp';
      CardFinishV1.refresh();
    });
    await page.waitForFunction(() => { const image = document.getElementById('imgHand'); return image.complete && image.naturalWidth > 0 && new URL(image.currentSrc || image.src).pathname === '/images/cards/enh/3.webp'; });
    await hover(page, '#playHand [data-card-finish]', .72, .28);
    await waitReady(page, '#playHand [data-card-finish]');
    let state = await depthState(page.locator('#playHand [data-card-finish]'));
    check(state.depth.paths[0] === '/card-depth/v1/enh/3/background.webp' && state.original.src === '/images/cards/enh/3.webp', 'new source wins while old depth decodes are still pending', state);
    releaseOld();
    await page.waitForTimeout(600);
    state = await depthState(page.locator('#playHand [data-card-finish]'));
    check(state.root.ready === 'ready' && state.depth.paths[0] === '/card-depth/v1/enh/3/background.webp' && !state.depth.paths.some(value => value.includes('/normal/3/')), 'late old-source completion cannot replace the current composite', state);
    report.scenarios.sourceRace = { delayed, final: state };
  } finally {
    releaseOld();
    await context.close();
  }
}

async function validateLeaveAndDestroyCancellation(browser) {
  for (const mode of ['leave', 'destroy']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    await installPageRoutes(context);
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let requestCount = 0;
    await context.route('**/card-depth/v1/normal/3/*.webp', async route => {
      requestCount += 1;
      await gate;
      const pathname = new URL(route.request().url()).pathname;
      try { await route.fulfill({ status: 200, contentType: 'image/webp', body: fs.readFileSync(localFile(pathname)) }); } catch {}
    });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE.origin}/game.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.CardFinishV1);
      await setChoiceFixture(page, '/images/cards/3.webp', '/images/cards/8.webp');
      await hover(page, '#playHand [data-card-finish]');
      await page.waitForFunction(() => document.querySelector('#playHand [data-card-finish]')?.dataset.finishEngaged === 'true');
      await page.waitForTimeout(100);
      if (mode === 'leave') await page.mouse.move(2, 2);
      else await page.evaluate(() => CardFinishV1.destroy());
      release();
      await page.waitForTimeout(600);
      const state = await depthState(page.locator('#playHand [data-card-finish]'));
      check(requestCount > 0, `${mode}: cancellation case began a real depth load`);
      check(state.root.ready === null && !state.depth && state.root.engaged === null, `${mode}: late decodes cannot attach after cancellation`, state);
      check(state.original?.complete && state.original.naturalWidth > 0, `${mode}: cancellation keeps original fallback visible`);
      if (mode === 'destroy') {
        const before = requestCount;
        await hover(page, '#playHand [data-card-finish]');
        await page.waitForTimeout(250);
        check(requestCount === before, 'destroy removes pointer listeners and prevents new depth requests');
      }
      report.scenarios[`${mode}Cancellation`] = { requestCount, state };
    } finally {
      release();
      await context.close();
    }
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
    await validateLeaveAndDestroyCancellation(browser);
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
