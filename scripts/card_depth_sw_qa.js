'use strict';

// Two-phase Service Worker release evidence for Card Depth V1. This script
// observes the existing production SW and its cache; it never registers or
// uploads a replacement SW source.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_ROOT = path.join(ROOT, 'public');
const OUTPUT = path.join(ROOT, 'artifacts', 'card-depth-v1', 'sw');
const BASELINE_FILE = path.join(OUTPUT, 'frame-v3-baseline.json');
const POSTDEPLOY_FILE = path.join(OUTPUT, 'depth-v1-postdeploy-report.json');
const PROFILE = path.join(OUTPUT, 'profiles', 'frame-v3');
const CACHE_NAME = 'op-card-v7.5';
const BASELINE_COMMIT = '01d6c760468e45f11e5ab56d034372af26c17583';
const OLD_QUERY = 'v=20260906-finish-frame-v3';
const NEW_QUERY = 'v=20260907-depth-v1';
const DEFAULT_PRODUCTION = 'https://onepiece-card-online.onrender.com';
const OLD_CODE = [
  { path: '/game.html', type: /^text\/html/i },
  { path: `/css/card-finish-v1.css?${OLD_QUERY}`, type: /^text\/css/i },
  { path: `/js/card_finish_v1.js?${OLD_QUERY}`, type: /^(?:application|text)\/javascript/i }
];
const NEW_CODE = [
  { path: '/game.html', type: /^text\/html/i },
  { path: `/css/card-finish-v1.css?${NEW_QUERY}`, type: /^text\/css/i },
  { path: `/js/card_finish_v1.js?${NEW_QUERY}`, type: /^(?:application|text)\/javascript/i }
];
const REPRESENTATIVE_ASSETS = ['normal', 'enh', 'lux', 'lux-enh'].flatMap(variant =>
  ['background', 'subject', 'foreground'].map(role => ({
    path: `/card-depth/v1/${variant}/3/${role}.webp`,
    type: /^image\/webp/i
  }))
);

function parseArgs(argv) {
  const options = {
    phase: 'capture-baseline',
    productionBase: process.env.CARD_DEPTH_PRODUCTION_BASE || DEFAULT_PRODUCTION,
    releaseCommit: process.env.CARD_DEPTH_RELEASE_COMMIT || '',
    playwright: process.env.BOARD_QA_PLAYWRIGHT || process.env.CARD_DEPTH_QA_PLAYWRIGHT || 'playwright',
    chrome: process.env.BOARD_QA_CHROME || process.env.CARD_DEPTH_QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const take = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`);
      index += 1;
      return value;
    };
    if (argument === '--phase') options.phase = take();
    else if (argument === '--production-base') options.productionBase = take();
    else if (argument === '--release-commit') options.releaseCommit = take();
    else if (argument === '--playwright') options.playwright = take();
    else if (argument === '--chrome') options.chrome = take();
    else if (argument === '--help') options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!['capture-baseline', 'postdeploy'].includes(options.phase)) throw new Error('--phase must be capture-baseline or postdeploy');
  options.productionBase = new URL(options.productionBase).origin;
  if (options.phase === 'postdeploy' && !options.releaseCommit) throw new Error('--release-commit is required for postdeploy evidence');
  return options;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function atomicJson(file, value) {
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function record(report) {
  return (condition, label, detail) => {
    assert.ok(condition, label);
    report.checks.push({ label, ...(detail === undefined ? {} : { detail }) });
  };
}

async function fetchResource(base, resourcePath) {
  const url = new URL(resourcePath, `${base}/`).href;
  const response = await fetch(url, {
    cache: 'no-store',
    redirect: 'follow',
    signal: AbortSignal.timeout(45000),
    headers: { 'user-agent': 'ONE-PIECE-Card-Depth-V1-SW-QA/1.0' }
  });
  const body = Buffer.from(await response.arrayBuffer());
  return {
    path: resourcePath,
    url,
    status: response.status,
    contentType: response.headers.get('content-type') || '',
    bytes: body.length,
    sha256: sha256(body),
    body,
    text: body.toString('utf8'),
    headers: {
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
      date: response.headers.get('date')
    }
  };
}

function publicResource(resource) {
  const { body, text, ...safe } = resource;
  return safe;
}

async function fetchResources(base, definitions) {
  const values = await Promise.all(definitions.map(definition => fetchResource(base, definition.path)));
  return Object.fromEntries(values.map(value => [value.path, value]));
}

function gitBlob(commit, resourcePath) {
  const pathname = new URL(resourcePath, 'https://release.invalid').pathname;
  const gitPath = `public${pathname}`;
  return {
    gitPath,
    body: execFileSync('git', ['show', `${commit}:${gitPath}`], { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 })
  };
}

function validateDirect(resources, definitions, commit, check, label) {
  const parity = [];
  for (const definition of definitions) {
    const response = resources[definition.path];
    check(response.status === 200, `${label}: ${definition.path} returns 200`, response.status);
    check(definition.type.test(response.contentType), `${label}: ${definition.path} has the expected content type`, response.contentType);
    check(response.bytes > 256, `${label}: ${definition.path} is non-empty and not a fallback`, response.bytes);
    const blob = gitBlob(commit, definition.path);
    const expectedSha256 = sha256(blob.body);
    check(response.sha256 === expectedSha256, `${label}: ${definition.path} matches the exact release commit blob`);
    parity.push({ path: definition.path, gitPath: blob.gitPath, liveSha256: response.sha256, releaseSha256: expectedSha256, bytes: response.bytes });
  }
  return parity;
}

async function ensureController(context, base) {
  const page = context.pages()[0] || await context.newPage();
  await page.goto(`${base}/start.html`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) {
    await page.reload({ waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 60000 });
  }
  return page;
}

async function controllerState(page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration('/');
    return {
      controlled: Boolean(navigator.serviceWorker.controller),
      controllerScript: navigator.serviceWorker.controller?.scriptURL || null,
      controllerState: navigator.serviceWorker.controller?.state || null,
      scope: registration?.scope || null,
      activeScript: registration?.active?.scriptURL || null,
      activeState: registration?.active?.state || null
    };
  });
}

async function cacheSnapshot(page, resourcePaths) {
  return page.evaluate(async ({ cacheName, resourcePaths }) => {
    async function digest(buffer) {
      return [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))]
        .map(value => value.toString(16).padStart(2, '0')).join('');
    }
    const names = await caches.keys();
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    const resources = {};
    for (const resourcePath of resourcePaths) {
      const response = await cache.match(new URL(resourcePath, location.origin).href);
      if (!response) {
        resources[resourcePath] = { found: false };
        continue;
      }
      const bytes = await response.arrayBuffer();
      resources[resourcePath] = {
        found: true,
        status: response.status,
        contentType: response.headers.get('content-type') || '',
        bytes: bytes.byteLength,
        sha256: await digest(bytes)
      };
    }
    return {
      names,
      entryCount: keys.length,
      depthEntries: keys.map(request => new URL(request.url).pathname).filter(pathname => pathname.startsWith('/card-depth/v1/')),
      resources
    };
  }, { cacheName: CACHE_NAME, resourcePaths });
}

async function waitCached(page, paths) {
  await page.waitForFunction(async ({ cacheName, paths }) => {
    const cache = await caches.open(cacheName);
    const matches = await Promise.all(paths.map(resourcePath => cache.match(new URL(resourcePath, location.origin).href)));
    return matches.every(Boolean);
  }, { cacheName: CACHE_NAME, paths }, { timeout: 60000 });
}

function cleanResources(resources) {
  return Object.fromEntries(Object.entries(resources).map(([key, value]) => [key, publicResource(value)]));
}

async function captureBaseline(chromium, options) {
  fs.mkdirSync(OUTPUT, { recursive: true });
  if (fs.existsSync(BASELINE_FILE)) throw new Error(`Refusing to overwrite baseline: ${BASELINE_FILE}`);
  if (fs.existsSync(PROFILE) && fs.readdirSync(PROFILE).length) throw new Error(`Refusing to reuse non-empty baseline profile: ${PROFILE}`);
  const report = {
    schemaVersion: 1,
    phase: 'capture-baseline',
    contract: 'Formal frame-v3 production and a dedicated real Chrome profile controlled by the unchanged production Service Worker.',
    createdAt: new Date().toISOString(),
    productionBase: options.productionBase,
    baselineCommit: BASELINE_COMMIT,
    baselineQuery: OLD_QUERY,
    cacheName: CACHE_NAME,
    browserScope: 'Desktop Chromium profile only; no physical/mobile claim.',
    checks: []
  };
  const check = record(report);
  const code = await fetchResources(options.productionBase, [...OLD_CODE, { path: '/sw.js', type: /^(?:application|text)\/javascript/i }]);
  report.directParity = validateDirect(code, OLD_CODE, BASELINE_COMMIT, check, 'frame-v3 production');
  const swBlob = gitBlob(BASELINE_COMMIT, '/sw.js');
  check(code['/sw.js'].status === 200 && code['/sw.js'].sha256 === sha256(swBlob.body), 'frame-v3 production sw.js matches baseline commit');
  check(code['/game.html'].text.includes(`css/card-finish-v1.css?${OLD_QUERY}`) && code['/game.html'].text.includes(`js/card_finish_v1.js?${OLD_QUERY}`), 'baseline game.html references both formal frame-v3 resources');
  check(!code['/game.html'].text.includes(NEW_QUERY), 'baseline game.html does not yet reference depth-v1 code');
  check(code['/sw.js'].text.includes(`'${CACHE_NAME}'`), `baseline Service Worker declares ${CACHE_NAME}`);

  fs.mkdirSync(path.dirname(PROFILE), { recursive: true });
  const context = await chromium.launchPersistentContext(PROFILE, {
    headless: true,
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'allow',
    ...(fs.existsSync(options.chrome) ? { executablePath: options.chrome } : {}),
    args: ['--no-first-run', '--no-default-browser-check']
  });
  const nonce = crypto.randomUUID();
  try {
    const page = await ensureController(context, options.productionBase);
    await page.evaluate(nonce => localStorage.setItem('__CARD_DEPTH_V1_SW_BASELINE__', nonce), nonce);
    await page.goto(`${options.productionBase}/game.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitCached(page, OLD_CODE.map(resource => resource.path));
    const controller = await controllerState(page);
    const cache = await cacheSnapshot(page, OLD_CODE.map(resource => resource.path));
    check(controller.controlled && controller.controllerScript === `${options.productionBase}/sw.js`, 'dedicated frame-v3 profile is controlled by the production SW', controller);
    check(cache.names.includes(CACHE_NAME), `dedicated frame-v3 profile contains ${CACHE_NAME}`, cache.names);
    check(cache.depthEntries.length === 0, 'predeploy frame-v3 profile contains no card-depth-v1 asset cache entries', cache.depthEntries);
    for (const resource of OLD_CODE) {
      const cached = cache.resources[resource.path];
      check(cached.found && cached.status === 200 && cached.sha256 === code[resource.path].sha256, `baseline cache ${resource.path} matches direct frame-v3 production bytes`, cached);
    }
    report.profile = { path: PROFILE, nonce, controller, cache };
  } finally {
    await context.close();
  }
  report.production = cleanResources(code);
  report.result = 'PASS';
  report.checkCount = report.checks.length;
  atomicJson(BASELINE_FILE, report);
  process.stdout.write(`CARD_DEPTH_SW_QA=PASS phase=capture-baseline checks=${report.checkCount} profile=${PROFILE}\n`);
}

async function hoverDexCard(page, selector) {
  const root = page.locator(selector).locator('xpath=ancestor::*[@data-card-finish][1]');
  await root.scrollIntoViewIfNeeded();
  const box = await root.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, `${selector} depth root is not visible`);
  await page.mouse.move(box.x + box.width * .72, box.y + box.height * .28);
  await page.waitForFunction(selector => document.querySelector(selector)?.closest('[data-card-finish]')?.dataset.finishDepth === 'ready', selector, { timeout: 30000 });
  return root.evaluate(element => ({
    ready: element.dataset.finishDepth,
    original: new URL(element.querySelector('.card-finish-face > img').currentSrc).pathname,
    layers: [...element.querySelectorAll('.card-finish-depth > img')].map(image => ({
      className: image.className,
      path: new URL(image.currentSrc || image.src).pathname,
      maskImage: image.style.maskImage || image.style.webkitMaskImage || ''
    }))
  }));
}

async function postdeploy(chromium, options) {
  assert.ok(fs.existsSync(BASELINE_FILE), `Missing baseline: ${BASELINE_FILE}`);
  if (fs.existsSync(POSTDEPLOY_FILE)) throw new Error(`Refusing to overwrite postdeploy report: ${POSTDEPLOY_FILE}`);
  const before = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  assert.equal(before.result, 'PASS', 'Saved SW baseline is not PASS');
  assert.equal(before.productionBase, options.productionBase, 'Production origin differs from captured baseline');
  assert.ok(before.profile?.path === PROFILE && fs.existsSync(PROFILE), 'Dedicated baseline profile is missing');
  const releaseCommit = execFileSync('git', ['rev-parse', '--verify', `${options.releaseCommit}^{commit}`], { cwd: ROOT, encoding: 'utf8' }).trim();
  const report = {
    schemaVersion: 1,
    phase: 'postdeploy',
    contract: 'Direct release-byte parity plus preserved frame-v3 profile refresh under the unchanged production SW.',
    createdAt: new Date().toISOString(),
    productionBase: options.productionBase,
    releaseCommit,
    baselineFile: BASELINE_FILE,
    cacheName: CACHE_NAME,
    browserScope: 'Desktop Chromium profile only; no physical/mobile claim.',
    checks: []
  };
  const check = record(report);
  const definitions = [...NEW_CODE, { path: '/sw.js', type: /^(?:application|text)\/javascript/i }, ...REPRESENTATIVE_ASSETS];
  const live = await fetchResources(options.productionBase, definitions);
  report.codeParity = validateDirect(live, NEW_CODE, releaseCommit, check, 'depth-v1 production');
  report.assetParity = validateDirect(live, REPRESENTATIVE_ASSETS, releaseCommit, check, 'depth-v1 representative asset');
  check(live['/game.html'].text.includes(`css/card-finish-v1.css?${NEW_QUERY}`) && live['/game.html'].text.includes(`js/card_finish_v1.js?${NEW_QUERY}`), 'deployed game.html references both depth-v1 query resources');
  check(live['/sw.js'].status === 200 && live['/sw.js'].sha256 === before.production['/sw.js'].sha256, 'production Service Worker source remains byte-identical to captured frame-v3 baseline');

  const context = await chromium.launchPersistentContext(PROFILE, {
    headless: true,
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'allow',
    ...(fs.existsSync(options.chrome) ? { executablePath: options.chrome } : {}),
    args: ['--no-first-run', '--no-default-browser-check']
  });
  try {
    const page = await ensureController(context, options.productionBase);
    const nonce = await page.evaluate(() => localStorage.getItem('__CARD_DEPTH_V1_SW_BASELINE__'));
    check(nonce === before.profile.nonce, 'postdeploy opens the exact dedicated predeploy frame-v3 profile');
    await page.goto(`${options.productionBase}/game.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.CardFinishV1 && document.querySelectorAll('[data-card-finish]').length === 4, null, { timeout: 30000 });
    await page.locator('#cardDexBtn').click();
    await page.locator('.card-dex-thumb[data-id="3"]').click();
    await page.waitForFunction(() => ['cardDexPreviewBase', 'cardDexPreviewEnh'].every(id => { const image = document.getElementById(id); return image?.complete && image.naturalWidth > 0; }));
    const baseState = await hoverDexCard(page, '#cardDexPreviewBase');
    await page.mouse.move(2, 2);
    await page.waitForFunction(() => !document.querySelector('.card-finish-depth'));
    const enhancedState = await hoverDexCard(page, '#cardDexPreviewEnh');
    const exercisedAssets = REPRESENTATIVE_ASSETS.filter(asset => /\/(?:normal|enh)\/3\//.test(asset.path));
    await waitCached(page, [...NEW_CODE.map(resource => resource.path), ...exercisedAssets.map(asset => asset.path)]);
    const cache = await cacheSnapshot(page, [...OLD_CODE.slice(1).map(resource => resource.path), ...NEW_CODE.map(resource => resource.path), ...exercisedAssets.map(asset => asset.path)]);
    const controller = await controllerState(page);
    check(controller.controlled && controller.controllerScript === `${options.productionBase}/sw.js`, 'preserved profile remains controlled by the production SW after depth-v1 deployment', controller);
    for (const resource of NEW_CODE) {
      const cached = cache.resources[resource.path];
      check(cached.found && cached.status === 200 && cached.sha256 === live[resource.path].sha256, `preserved old-SW profile caches exact deployed ${resource.path}`, cached);
    }
    for (const resource of exercisedAssets) {
      const cached = cache.resources[resource.path];
      check(cached.found && cached.status === 200 && cached.sha256 === live[resource.path].sha256, `preserved old-SW profile lazily caches exact runtime asset ${resource.path}`, cached);
    }
    check(baseState.ready === 'ready' && enhancedState.ready === 'ready', 'preserved frame-v3 profile executes both normal and enhanced depth composites', { baseState, enhancedState });
    await page.screenshot({ path: path.join(OUTPUT, 'preserved-frame-v3-profile-depth-v1.png'), fullPage: false });
    report.preservedProfile = { nonce, controller, cache, baseState, enhancedState };
  } finally {
    await context.close();
  }
  report.production = cleanResources(live);
  report.result = 'PASS';
  report.checkCount = report.checks.length;
  atomicJson(POSTDEPLOY_FILE, report);
  process.stdout.write(`CARD_DEPTH_SW_QA=PASS phase=postdeploy checks=${report.checkCount} oldProfileRefresh=PASS\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write([
      'Usage: node scripts/card_depth_sw_qa.js --phase capture-baseline|postdeploy [options]',
      `  --production-base URL  default ${DEFAULT_PRODUCTION}`,
      '  --release-commit REF   required for postdeploy',
      '  --playwright PATH      Playwright module path',
      '  --chrome PATH          Chrome executable path',
      '',
      `Baseline output: ${BASELINE_FILE}`,
      `Postdeploy output: ${POSTDEPLOY_FILE}`,
      'Run postdeploy only after the release operator confirms deployment.'
    ].join('\n') + '\n');
    return;
  }
  const { chromium } = require(options.playwright);
  if (options.phase === 'capture-baseline') await captureBaseline(chromium, options);
  else await postdeploy(chromium, options);
}

main().catch(error => {
  process.stderr.write(`CARD_DEPTH_SW_QA=FAIL ${error.stack || error}\n`);
  process.exitCode = 1;
});
