'use strict';

// Read-only browser presentation QA: hit classes are applied to disposable DOM only.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function loadPlaywright() {
  if (process.env.BOARD_QA_PLAYWRIGHT) return require(process.env.BOARD_QA_PLAYWRIGHT);
  try { return require('playwright'); } catch (_) { /* Codex bundles its own runtime. */ }
  const runtime = path.join(process.env.LOCALAPPDATA || '', 'OpenAI', 'Codex', 'runtimes', 'cua_node');
  if (fs.existsSync(runtime)) {
    for (const entry of fs.readdirSync(runtime, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const modulePath = path.join(runtime, entry.name, 'bin', 'node_modules', 'playwright');
      if (fs.existsSync(modulePath)) return require(modulePath);
    }
  }
  throw new Error('Playwright unavailable. Set BOARD_QA_PLAYWRIGHT to its module directory.');
}
const { chromium } = loadPlaywright();

const PUBLIC = path.resolve(__dirname, '..', 'public');
const ROOT = path.resolve(__dirname, '..');
const BASELINE_REF = process.env.BOARD_QA_BASELINE_REF || '';
let origin = process.env.BOARD_QA_URL || '';
const OUTPUT = process.env.BOARD_QA_OUTPUT || (BASELINE_REF
  ? 'D:/Codex_QA/board-battle-hit-depth-20260929/baseline'
  : 'D:/Codex_QA/board-battle-hit-depth-20260929');
const CHROME = process.env.BOARD_QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const report = { origin, baselineRef: BASELINE_REF || null, startedAt: new Date().toISOString(), readOnly: true,
  checks: [], cases: [], pageErrors: [], blockedWrites: [] };

const MIME = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.wasm': 'application/wasm',
};

async function startStaticServer() {
  const baseline = new Map();
  if (BASELINE_REF) {
    for (const relative of ['board_battle.html', 'board_game.html', 'css/board_character_depth.css']) {
      baseline.set(relative, execFileSync('git', ['show', `${BASELINE_REF}:public/${relative}`],
        { cwd: ROOT, maxBuffer: 24 * 1024 * 1024 }));
    }
  }
  const server = http.createServer((request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    let filename;
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      filename = path.resolve(PUBLIC, `.${pathname}`);
    } catch (_) {
      response.writeHead(400).end();
      return;
    }
    if (!filename.startsWith(PUBLIC + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    const relative = path.relative(PUBLIC, filename).replace(/\\/g, '/');
    if (baseline.has(relative)) {
      const bytes = baseline.get(relative);
      response.writeHead(200, {
        'Content-Type': MIME[path.extname(filename).toLowerCase()] || 'application/octet-stream',
        'Content-Length': bytes.length, 'Cache-Control': 'no-store',
      });
      response.end(request.method === 'HEAD' ? undefined : bytes);
      return;
    }
    fs.stat(filename, (error, stat) => {
      if (error || !stat.isFile()) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, {
        'Content-Type': MIME[path.extname(filename).toLowerCase()] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': 'no-store',
      });
      if (request.method === 'HEAD') response.end();
      else fs.createReadStream(filename).pipe(response);
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

fs.mkdirSync(OUTPUT, { recursive: true });
function check(name, pass, detail) {
  report.checks.push({ name, pass: Boolean(pass), detail });
  if (!pass) console.error(`FAIL ${name}: ${JSON.stringify(detail)}`);
}
function save() {
  report.ok = report.checks.every(row => row.pass) && report.pageErrors.length === 0;
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUTPUT, 'result.json'), JSON.stringify(report, null, 2));
}

const measure = ({ selector }) => {
  const root = document.querySelector(selector);
  if (!root) return null;
  const clipElement = document.querySelector('.battle-viewport');
  const clipRect = clipElement?.getBoundingClientRect();
  const clip = {
    left: Math.max(0, clipRect?.left || 0), top: Math.max(0, clipRect?.top || 0),
    right: Math.min(innerWidth, clipRect?.right ?? innerWidth),
    bottom: Math.min(innerHeight, clipRect?.bottom ?? innerHeight),
  };
  const box = element => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
      width: rect.width, height: rect.height,
      clipped: { left: Math.max(0, clip.left - rect.left), top: Math.max(0, clip.top - rect.top),
        right: Math.max(0, rect.right - clip.right), bottom: Math.max(0, rect.bottom - clip.bottom) } };
  };
  const candidates = [root, ...root.querySelectorAll(
    '.card-inner, .portrait-wrap, .battle-portrait, .battle-portrait-stage, ' +
    '.battle-character-img, .battle-fallback-card, .board-character-depth-model-face'
  )];
  const samples = candidates.map(element => {
    const style = getComputedStyle(element);
    let visible = Boolean(element.getClientRects().length);
    for (let node = element; visible && node instanceof Element; node = node.parentElement) {
      const nodeStyle = getComputedStyle(node);
      if (nodeStyle.display === 'none' || nodeStyle.visibility === 'hidden') visible = false;
    }
    const transform = style.transform;
    const matrix = transform === 'none' ? null : new DOMMatrixReadOnly(transform);
    const matrixTilt = matrix && matrix.is2D === false
      ? Math.max(Math.abs(matrix.m13), Math.abs(matrix.m23), Math.abs(matrix.m31), Math.abs(matrix.m32))
      : 0;
    const parts = style.rotate.trim().split(/\s+/);
    const angle = Math.abs(parseFloat(parts.at(-1)) || 0);
    const axisTilt = parts.length >= 4 && Math.hypot(Number(parts[0]) || 0, Number(parts[1]) || 0) > 0.1
      ? Math.sin(angle * Math.PI / 180) : 0;
    return { element: element.tagName.toLowerCase() + (element.className ? '.' + String(element.className).trim().replace(/\s+/g, '.') : ''),
      visible, animation: style.animationName, transform, rotate: style.rotate,
      tilt: visible ? Math.max(matrixTilt, axisTilt) : 0,
      yaw: visible ? (matrix?.m13 || 0) : 0,
      pitch: visible ? (matrix?.m23 || 0) : 0,
      x: visible ? (matrix?.m41 || 0) : 0,
      y: visible ? (matrix?.m42 || 0) : 0 };
  });
  const rect = root.getBoundingClientRect();
  return { className: root.className, offsetWidth: root.offsetWidth, offsetHeight: root.offsetHeight,
    center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    box: box(root), portraitBox: box(root.querySelector('.battle-portrait, .battle-character-img')),
    maxTilt: Math.max(0, ...samples.map(item => item.tilt)), samples };
};

async function makeContext(browser, spec) {
  const context = await browser.newContext({ viewport: spec.viewport, reducedMotion: spec.reduced ? 'reduce' : 'no-preference',
    hasTouch: spec.mobile, isMobile: spec.mobile, deviceScaleFactor: 1 });
  await context.route('**/*', route => {
    if (['GET', 'HEAD'].includes(route.request().method())) return route.continue();
    report.blockedWrites.push({ method: route.request().method(), url: route.request().url() });
    return route.abort('blockedbyclient');
  });
  await context.routeWebSocket('**/*', socket => socket.close());
  context.on('page', page => page.on('pageerror', error => report.pageErrors.push({ url: page.url(), message: error.message })));
  return context;
}

async function prepareIframe(page) {
  await page.waitForSelector('#playerCard .battle-portrait');
  await page.evaluate(() => {
    const portraits = [
      ['playerPortrait', 'playerPortraitWrap', 'images/board/battle/portraits/evolutions/sanji_evolution_2/normal.webp'],
      ['enemyPortrait', 'enemyPortraitWrap', 'images/board/battle/enemies/postgame_saga/normal.webp'],
    ];
    for (const [imageId, wrapId, source] of portraits) {
      const image = document.getElementById(imageId);
      image.src = source;
      image.classList.remove('is-empty');
      document.getElementById(wrapId).classList.add('has-portrait');
    }
  });
  await page.waitForFunction(() => ['playerPortrait', 'enemyPortrait'].every(id => {
    const image = document.getElementById(id);
    return image?.complete && image.naturalWidth > 0;
  }), null, { timeout: 15000 });
  await page.waitForFunction(() => ['playerCard', 'enemyCard'].every(id =>
    document.getElementById(id)?.classList.contains('board-frame-inset-host')), null, { timeout: 10000 });
}

async function prepareMap(page) {
  await page.evaluate(() => {
    const fixture = document.createElement('section');
    fixture.id = 'battleHitDepthQaFixture';
    fixture.className = 'battle-grid';
    fixture.style.cssText = 'position:fixed;inset:12% 5%;z-index:99999;padding:12px;background:#061322;';
    fixture.innerHTML = `
      <div class="battle-box battle-fighter player" id="battleHitDepthQaPlayer">
        <div class="name">我方角色</div>
        <div class="battle-portrait-stage">
          <img class="battle-character-img" src="images/board/battle/portraits/evolutions/sanji_evolution_2/normal.webp" alt="">
        </div>
      </div>
      <div class="battle-box battle-fighter enemy" id="battleHitDepthQaEnemy">
        <div class="name">敵方角色</div>
        <div class="battle-portrait-stage">
          <img class="battle-character-img" src="images/board/battle/enemies/postgame_saga/normal.webp" alt="">
        </div>
      </div>`;
    document.body.appendChild(fixture);
  });
  await page.waitForFunction(() => [...document.querySelectorAll('#battleHitDepthQaFixture img')]
    .every(image => image.complete && image.naturalWidth > 0), null, { timeout: 15000 });
}

async function prepareTotMusica(page) {
  await prepareIframe(page);
  await page.evaluate(() => {
    const stage = document.getElementById('battleStage');
    const fx = document.getElementById('totMusicaDualFx');
    const fixtureStyle = document.createElement('style');
    fixtureStyle.textContent = `
      #totMusicaDualFx { opacity: 1 !important; visibility: visible !important; transition: none !important; }
      #totMusicaDualFx .tot-musica-dual-actor-card { opacity: 1 !important; visibility: visible !important; transition: none !important; }
    `;
    document.head.appendChild(fixtureStyle);
    stage.classList.add('tot-musica-battle-mode');
    fx.classList.add('show', 'persistent-stage', 'enemy-present', 'boss-revealed');
    const sources = [
      ['totMusicaBossPortrait', 'images/board/battle/enemies/postgame_tot_musica/normal.webp'],
      ['totMusicaRealPortrait', 'images/board/battle/portraits/evolutions/sanji_evolution_2/normal.webp'],
      ['totMusicaSongPortrait', 'images/board/battle/enemies/postgame_saga/normal.webp'],
    ];
    for (const [id, source] of sources) document.getElementById(id).src = source;
  });
  await page.waitForFunction(() => ['totMusicaBossPortrait', 'totMusicaRealPortrait', 'totMusicaSongPortrait']
    .every(id => {
      const image = document.getElementById(id);
      return image?.complete && image.naturalWidth > 0;
    }), null, { timeout: 15000 });
  await page.waitForTimeout(400);
}

async function seekTotImpact(page, selector, reduced, fraction = 0.2) {
  await page.evaluate(({ selector, reduced, fraction }) => {
    const fx = document.getElementById('totMusicaDualFx');
    fx.classList.add('show', 'persistent-stage', 'enemy-present', 'boss-revealed');
    const target = document.querySelector(selector);
    target.classList.remove('portrait-hit');
    void target.offsetWidth;
    target.classList.add('portrait-hit');
    const animations = target.getAnimations({ subtree: false });
    for (const animation of animations) {
      const duration = Number(animation.effect?.getTiming().duration) || 700;
      animation.pause();
      animation.currentTime = reduced ? Math.min(80, duration / 2) : duration * fraction;
    }
  }, { selector, reduced, fraction });
  return page.evaluate(measure, { selector });
}

async function runTotCase(browser, spec) {
  const context = await makeContext(browser, spec);
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/board_battle.html?battle_hit_depth_qa=tot-musica`,
      { waitUntil: 'domcontentloaded', timeout: 30000 });
    await prepareTotMusica(page);
    const stateBefore = await page.evaluate(() =>
      JSON.stringify(window.__BOARD_BATTLE_DEBUG__?.latestView?.() || null));
    const selectors = {
      boss: '#totMusicaBossFrame', real: '#totMusicaRealFrame', song: '#totMusicaSongFrame',
    };
    const initial = {};
    for (const [name, selector] of Object.entries(selectors)) initial[name] = await page.evaluate(measure, { selector });
    check(`${spec.name} vertical stage geometry`,
      initial.boss && initial.real && initial.song &&
      initial.boss.box.top < initial.real.box.top && initial.boss.box.top < initial.song.box.top,
      Object.fromEntries(Object.entries(initial).map(([name, value]) => [name, value?.box?.top])));

    await page.evaluate(() => document.getElementById('totMusicaDualFx').classList.add('wave-impact'));
    const boss = await seekTotImpact(page, selectors.boss, spec.reduced, 0.12);
    const bossScreenshot = path.join(OUTPUT, `${spec.name}-boss-up.png`);
    await page.screenshot({ path: bossScreenshot });
    report.cases.push({ name: `${spec.name}/boss-up`, before: initial.boss, impact: boss, screenshot: bossScreenshot });
    check(`${spec.name} boss hit pose active`, boss?.samples[0]?.animation !== 'none', boss?.samples[0]?.animation);
    if (spec.reduced) check(`${spec.name} boss reduced motion stays flat`, boss.maxTilt < 0.01, boss.samples[0]);
    else check(`${spec.name} boss recoils up with 3D pitch`,
      boss.samples[0].y < -3 && Math.abs(boss.samples[0].pitch) > 0.02,
      { y: boss.samples[0].y, pitch: boss.samples[0].pitch });

    await page.evaluate(() => {
      const fx = document.getElementById('totMusicaDualFx');
      fx.classList.add('show', 'persistent-stage', 'enemy-present', 'boss-revealed');
      fx.classList.remove('wave-impact');
      fx.classList.add('enemy-impact');
      document.getElementById('totMusicaBossFrame').classList.remove('portrait-hit');
    });
    for (const side of ['real', 'song']) {
      const impact = await seekTotImpact(page, selectors[side], spec.reduced);
      const screenshot = path.join(OUTPUT, `${spec.name}-${side}-down.png`);
      await page.screenshot({ path: screenshot });
      report.cases.push({ name: `${spec.name}/${side}-down`, before: initial[side], impact, screenshot });
      check(`${spec.name}/${side} hit pose active`,
        impact?.samples[0]?.animation === (spec.reduced ? 'cardHitReduced' : 'totMusicaTargetHitDown'),
        impact?.samples[0]?.animation);
      if (spec.reduced) check(`${spec.name}/${side} reduced motion stays flat`, impact.maxTilt < 0.01, impact.samples[0]);
      else check(`${spec.name}/${side} recoils down with 3D pitch`,
        impact.samples[0].y > 3 && Math.abs(impact.samples[0].pitch) > 0.02,
        { y: impact.samples[0].y, pitch: impact.samples[0].pitch });
    }
    const stateAfter = await page.evaluate(() =>
      JSON.stringify(window.__BOARD_BATTLE_DEBUG__?.latestView?.() || null));
    check(`${spec.name} combat view untouched`, stateBefore === stateAfter,
      { beforeBytes: stateBefore.length, afterBytes: stateAfter.length });
  } finally {
    await context.close();
    save();
  }
}

async function runCase(browser, spec) {
  const context = await makeContext(browser, spec);
  const page = await context.newPage();
  const pageName = spec.page === 'iframe' ? 'board_battle.html' : 'board_game.html';
  try {
    const query = spec.page === 'map' ? 'layout=responsive&battle_hit_depth_qa=1' : 'battle_hit_depth_qa=1';
    await page.goto(`${origin}/${pageName}?${query}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (spec.page === 'iframe') await prepareIframe(page);
    else await prepareMap(page);
    if (spec.iframePortrait) {
      const orientation = await page.evaluate(() => {
        const notice = document.getElementById('battleOrientationNotice');
        const box = notice.getBoundingClientRect();
        return { active: document.body.classList.contains('battle-phone-portrait'),
          display: getComputedStyle(notice).display,
          covered: box.left <= 0 && box.top <= 0 && box.right >= innerWidth && box.bottom >= innerHeight,
          overflowX: document.documentElement.scrollWidth - innerWidth };
      });
      check(`${spec.name} rotate-device notice covers phone`,
        orientation.active && orientation.display === 'grid' && orientation.covered, orientation);
      check(`${spec.name} no horizontal page overflow`, orientation.overflowX <= 1, orientation);
    }
    if (spec.coop) await page.evaluate(() => document.getElementById('playerCard').classList.add('has-coop-allies'));
    const stateBefore = await page.evaluate(() => {
      if (window.__BOARD_GAME_DEBUG__) {
        const state = window.__BOARD_GAME_DEBUG__.getState();
        return JSON.stringify({ gameState: state.gameState, battleState: state.battleState });
      }
      return JSON.stringify(window.__BOARD_BATTLE_DEBUG__?.latestView?.() || null);
    });
    const yawBySide = {};
    const directionBySide = {};
    for (const side of ['player', 'enemy']) {
      const selector = spec.page === 'iframe' ? `#${side}Card` : `#battleHitDepthQa${side === 'player' ? 'Player' : 'Enemy'}`;
      const hitClass = spec.page === 'iframe' ? 'portrait-hit' : 'hit';
      const before = await page.evaluate(measure, { selector });
      check(`${spec.name}/${side} target exists`, Boolean(before?.offsetWidth && before?.offsetHeight), before);
      if (!before) continue;
      await page.evaluate(({ selector, hitClass }) => {
        const target = document.querySelector(selector);
        target.classList.remove(hitClass);
        void target.offsetWidth;
        target.classList.add(hitClass);
      }, { selector, hitClass });
      const frames = [];
      const times = spec.reduced ? [45, 90, 150] : [70, 140, 220, 310, 420];
      let elapsed = 0;
      for (const at of times) {
        await page.waitForTimeout(at - elapsed);
        frames.push({ at, ...(await page.evaluate(measure, { selector })) });
        elapsed = at;
      }
      await page.evaluate(({ selector, hitClass, reduced }) => {
        const target = document.querySelector(selector);
        target.classList.remove(hitClass);
        void target.offsetWidth;
        target.classList.add(hitClass);
        const relevant = target.getAnimations({ subtree: true }).filter(animation =>
          /cardHitShake|cardHitReduced|battleBoxHit|battleBoxHitReduced/.test(animation.animationName));
        for (const animation of relevant) {
          animation.pause();
          animation.currentTime = reduced ? 80 : 84;
        }
      }, { selector, hitClass, reduced: spec.reduced });
      const impact = await page.evaluate(measure, { selector });
      const peak = Math.max(impact.maxTilt, ...frames.map(frame => frame.maxTilt));
      const yaw = impact.samples.map(item => item.yaw)
        .reduce((best, value) => Math.abs(value) > Math.abs(best) ? value : best, 0);
      yawBySide[side] = yaw;
      const animations = impact.samples.map(item => item.animation);
      const screenshot = path.join(OUTPUT, `${spec.name}-${side}.png`);
      await page.screenshot({ path: screenshot });
      await page.evaluate(({ selector, hitClass }) => document.querySelector(selector)?.classList.remove(hitClass),
        { selector, hitClass });
      await page.waitForTimeout(260);
      const after = await page.evaluate(measure, { selector });
      const clipping = { before: before.box.clipped,
        frames: frames.map(frame => ({ at: frame.at, card: frame.box.clipped, portrait: frame.portraitBox?.clipped })),
        impact: { card: impact.box.clipped, portrait: impact.portraitBox?.clipped } };
      const details = { before, frames, impact, after, peak, yaw, clipping, screenshot };
      report.cases.push({ name: `${spec.name}/${side}`, ...details });
      directionBySide[side] = { before, impact };
      check(`${spec.name}/${side} hit animation active`, animations.some(name =>
        spec.page === 'iframe' ? /portraitHit|cardHitShake|cardHitReduced/.test(name)
          : /battleHitShake|battleBoxHit|battleBoxHitReduced/.test(name)), animations);
      if (!BASELINE_REF) check(`${spec.name}/${side} ${spec.reduced ? 'reduced motion stays flat' : 'hit has 3D tilt'}`,
        spec.reduced ? peak < 0.01 : peak > 0.015, { peak, frames: frames.map(frame => ({ at: frame.at, maxTilt: frame.maxTilt })) });
      check(`${spec.name}/${side} layout box unchanged`, frames.every(frame =>
        frame.offsetWidth === before.offsetWidth && frame.offsetHeight === before.offsetHeight) &&
        impact.offsetWidth === before.offsetWidth && impact.offsetHeight === before.offsetHeight,
      { before: [before.offsetWidth, before.offsetHeight], frames: frames.map(frame => [frame.offsetWidth, frame.offsetHeight]),
        impact: [impact.offsetWidth, impact.offsetHeight] });
      check(`${spec.name}/${side} no lingering 3D tilt`, after.maxTilt < 0.01, { after: after.maxTilt });
      if (spec.page === 'iframe' && !spec.iframePortrait && !BASELINE_REF) {
        const hitBoxes = [...frames, impact];
        const newCardClip = hitBoxes.some(frame => Object.keys(before.box.clipped).some(edge =>
          frame.box.clipped[edge] > before.box.clipped[edge] + 2));
        const newPortraitClip = hitBoxes.some(frame => frame.portraitBox && before.portraitBox &&
          Object.keys(before.portraitBox.clipped).some(edge =>
            frame.portraitBox.clipped[edge] > before.portraitBox.clipped[edge] + 2));
        check(`${spec.name}/${side} no new viewport clipping`, !newCardClip && !newPortraitClip, clipping);
      }
    }
    const player = directionBySide.player, enemy = directionBySide.enemy;
    if (spec.page === 'iframe' && player && enemy) {
      const separation = { x: enemy.before.center.x - player.before.center.x,
        y: enemy.before.center.y - player.before.center.y };
      check(`${spec.name} card centers remain side-by-side`,
        Math.abs(separation.x) > Math.abs(separation.y), separation);
    }
    if (!BASELINE_REF && !spec.reduced && !spec.mapPortrait) check(`${spec.name} opposite hit yaw`,
      yawBySide.player * yawBySide.enemy < 0 &&
        Math.abs(yawBySide.player) > 0.015 && Math.abs(yawBySide.enemy) > 0.015, yawBySide);
    if (spec.mapPortrait) {
      check(`${spec.name} fighters stack vertically`,
        Boolean(player && enemy && Math.abs(player.before.center.y - enemy.before.center.y) >
          Math.abs(player.before.center.x - enemy.before.center.x)),
        { player: player?.before.center, enemy: enemy?.before.center });
      if (!spec.reduced && player && enemy) {
        for (const [side, target, source] of [['player', player, enemy], ['enemy', enemy, player]]) {
          const expected = Math.sign(target.before.center.y - source.before.center.y);
          const actual = target.impact.samples[0]?.y || 0;
          const pitch = target.impact.samples[0]?.pitch || 0;
          check(`${spec.name}/${side} pushed away along vertical attack`,
            expected * actual > 3 && Math.abs(pitch) > 0.02,
            { expected, actual, pitch });
        }
      }
    }
    const stateAfter = await page.evaluate(() => {
      if (window.__BOARD_GAME_DEBUG__) {
        const state = window.__BOARD_GAME_DEBUG__.getState();
        return JSON.stringify({ gameState: state.gameState, battleState: state.battleState });
      }
      return JSON.stringify(window.__BOARD_BATTLE_DEBUG__?.latestView?.() || null);
    });
    check(`${spec.name} combat state untouched`, stateBefore === stateAfter,
      { beforeBytes: stateBefore.length, afterBytes: stateAfter.length });
  } finally {
    await context.close();
    save();
  }
}

async function main() {
  const local = origin ? null : await startStaticServer();
  if (local) origin = local.url;
  report.origin = origin;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: CHROME });
    const desktop = { viewport: { width: 1440, height: 900 }, mobile: false, reduced: false };
    const mobile = { viewport: { width: 932, height: 430 }, mobile: true, reduced: false };
    const portrait = { viewport: { width: 390, height: 844 }, mobile: true, reduced: false, mapPortrait: true };
    const iframePortrait = { viewport: { width: 390, height: 844 }, mobile: true, reduced: false, iframePortrait: true };
    const reduced = { viewport: { width: 1440, height: 900 }, mobile: false, reduced: true };
    if (BASELINE_REF) {
      await runCase(browser, { page: 'iframe', name: 'iframe-mobile-baseline', ...mobile });
      await runCase(browser, { page: 'iframe', name: 'iframe-portrait-baseline', ...iframePortrait });
    } else for (const page of ['iframe', 'map']) {
      for (const [variant, settings] of Object.entries({ desktop, mobile, reduced })) {
        await runCase(browser, { page, name: `${page}-${variant}`, ...settings });
      }
    }
    if (!BASELINE_REF) {
      await runCase(browser, { page: 'iframe', name: 'iframe-portrait-390x844', ...iframePortrait });
      await runCase(browser, { page: 'map', name: 'map-portrait-390x844', ...portrait });
      await runCase(browser, { page: 'iframe', name: 'iframe-coop-desktop', ...desktop, coop: true });
      await runTotCase(browser, { name: 'tot-musica-desktop', ...desktop });
      await runTotCase(browser, { name: 'tot-musica-mobile', ...mobile });
      await runTotCase(browser, { name: 'tot-musica-reduced', ...reduced });
    }
    check('no browser exceptions', report.pageErrors.length === 0, report.pageErrors);
  } finally {
    await browser?.close();
    if (local) await new Promise(resolve => local.server.close(resolve));
    save();
  }
  console.log(JSON.stringify({ ok: report.ok, checks: report.checks.length,
    failed: report.checks.filter(row => !row.pass).map(row => row.name), output: OUTPUT }));
  if (!report.ok) process.exitCode = 1;
}
main().catch(error => {
  report.fatal = error.stack || String(error);
  save();
  console.error(report.fatal);
  process.exitCode = 1;
});
