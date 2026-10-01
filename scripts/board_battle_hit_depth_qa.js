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
const BASELINE_REPORT = process.env.BOARD_QA_BASELINE_REPORT
  ? JSON.parse(fs.readFileSync(process.env.BOARD_QA_BASELINE_REPORT, 'utf8')) : null;
let origin = process.env.BOARD_QA_URL || '';
const OUTPUT = process.env.BOARD_QA_OUTPUT || (BASELINE_REF
  ? 'D:/Codex_QA/board-battle-hit-depth-20260929/baseline'
  : 'D:/Codex_QA/board-battle-hit-depth-20260929');
const CHROME = process.env.BOARD_QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const report = { origin, baselineRef: BASELINE_REF || null,
  comparedWith: BASELINE_REPORT ? { path: process.env.BOARD_QA_BASELINE_REPORT, ref: BASELINE_REPORT.baselineRef } : null,
  motionTolerance: { cardMinPx: 2, portraitMinPx: 2.5, relative: 0.1, clipPx: 2,
    note: 'Portrait raw bbox may shift sub-pixel amounts under 3D projection; card center and painted clipping keep the 2px gate.' },
  startedAt: new Date().toISOString(), readOnly: true,
  checks: [], cases: [], pageErrors: [], blockedWrites: [] };
const HIT_ANIMATIONS = new Set(['cardHitShake', 'portraitHit', 'battleBoxHit', 'battleHitShake',
  'totMusicaTargetHitDown', 'battleHitKnockback', 'battleHitKnockbackVertical']);
const HIT_TIMES_MS = [0, 46, 70, 84, 92, 138, 140, 158, 168, 184, 210, 230, 252, 276,
  280, 322, 324, 336, 350, 368, 414, 420, 460, 468, 490, 504, 560, 588, 630, 700, 720];
const ORIGINAL_HIT_MOTION = {
  cardHitShake: { duration: 700, points: [
    [0, 0, 0], [.12, -7, 0], [.24, 8, 0], [.36, -12, 0], [.48, 13, 0],
    [.60, -12, 0], [.72, 8, 0], [.84, -7, 0],
  ] },
  battleBoxHit: { duration: 460, points: [
    [0, 0, 0], [.10, -3, 0], [.20, 4, 0], [.30, -6, 0], [.40, 6, 0],
    [.50, -6, 0], [.60, 6, 0], [.70, -6, 0], [.80, 4, 0], [.90, -3, 0],
  ] },
  totMusicaTargetHitDown: { duration: 720, points: [
    [0, 0, 0], [.22, -7, 24], [.45, 10, 12], [.65, -8, 5], [1, 0, 0],
  ] },
};

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
    const visible = { left: Math.max(clip.left, rect.left), top: Math.max(clip.top, rect.top),
      right: Math.min(clip.right, rect.right), bottom: Math.min(clip.bottom, rect.bottom) };
    visible.width = Math.max(0, visible.right - visible.left);
    visible.height = Math.max(0, visible.bottom - visible.top);
    visible.center = visible.width && visible.height
      ? { x: (visible.left + visible.right) / 2, y: (visible.top + visible.bottom) / 2 } : null;
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
      width: rect.width, height: rect.height,
      visible,
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
    const angle = (parseFloat(parts.at(-1)) || 0) * Math.PI / 180;
    const axis = parts.length >= 4 ? [Number(parts[0]) || 0, Number(parts[1]) || 0]
      : parts[0] === 'x' ? [1, 0] : parts[0] === 'y' ? [0, 1] : [0, 0];
    const axisPitch = axis[0] * Math.sin(angle);
    const axisYaw = -axis[1] * Math.sin(angle);
    const axisTilt = Math.max(Math.abs(axisPitch), Math.abs(axisYaw));
    return { element: element.tagName.toLowerCase() + (element.className ? '.' + String(element.className).trim().replace(/\s+/g, '.') : ''),
      visible, animation: style.animationName, transform, translate: style.translate, rotate: style.rotate,
      tilt: visible ? Math.max(matrixTilt, axisTilt) : 0,
      yaw: visible ? (matrix?.m13 || 0) + axisYaw : 0,
      pitch: visible ? (matrix?.m23 || 0) + axisPitch : 0,
      x: visible ? (matrix?.m41 || 0) : 0,
      y: visible ? (matrix?.m42 || 0) : 0 };
  });
  const rect = root.getBoundingClientRect();
  return { className: root.className, offsetWidth: root.offsetWidth, offsetHeight: root.offsetHeight,
    center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    box: box(root), portraitBox: box(root.querySelector('.battle-portrait, .battle-character-img')),
    maxTilt: Math.max(0, ...samples.map(item => item.tilt)), samples };
};

async function checkOriginalHitMotion(page, selector, animationName, label) {
  const expected = ORIGINAL_HIT_MOTION[animationName];
  const actual = await page.evaluate(({ selector, animationName, points }) => {
    const target = document.querySelector(selector);
    const animation = target?.getAnimations({ subtree: true }).find(item => item.animationName === animationName);
    if (!animation?.effect?.target) return null;
    const duration = Number(animation.effect.getComputedTiming().duration);
    const animatedStyle = getComputedStyle(animation.effect.target);
    const names = animatedStyle.animationName.split(/\s*,\s*/);
    const easing = animatedStyle.animationTimingFunction.split(/\s*,\s*/)[names.indexOf(animationName)];
    const originalTime = animation.currentTime;
    animation.pause();
    const samples = points.map(([at]) => {
      animation.currentTime = duration * at;
      const style = getComputedStyle(animation.effect.target);
      const matrix = style.transform === 'none' ? null : new DOMMatrixReadOnly(style.transform);
      return { at, x: matrix?.m41 || 0, y: matrix?.m42 || 0 };
    });
    animation.currentTime = originalTime;
    return { duration, easing, samples };
  }, { selector, animationName, points: expected.points });
  check(`${label} original hit duration and easing`,
    actual && Math.abs(actual.duration - expected.duration) < 1 && actual.easing === 'ease',
    { expected: { duration: expected.duration, easing: 'ease' }, actual });
  check(`${label} original hit displacement at every keyframe`,
    actual && actual.samples.length === expected.points.length && actual.samples.every((sample, index) => {
      const [at, x, y] = expected.points[index];
      return sample.at === at && Math.abs(sample.x - x) < .5 && Math.abs(sample.y - y) < .5;
    }), { expected: expected.points, actual: actual?.samples });
  return actual;
}

function motionBox(box, neutral) {
  if (!box) return null;
  const center = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
  const visibleCenter = box.visible.center;
  const baseCenter = neutral && { x: (neutral.left + neutral.right) / 2,
    y: (neutral.top + neutral.bottom) / 2 };
  return { center, visibleCenter, bounds: { left: box.left, top: box.top,
    right: box.right, bottom: box.bottom, width: box.width, height: box.height }, clipped: box.clipped,
    delta: baseCenter ? { x: center.x - baseCenter.x, y: center.y - baseCenter.y } : { x: 0, y: 0 },
    visibleDelta: neutral?.visible.center && visibleCenter
      ? { x: visibleCenter.x - neutral.visible.center.x, y: visibleCenter.y - neutral.visible.center.y }
      : null };
}

async function captureHitTrace(page, selector, hitClass) {
  const captured = await page.evaluate(({ selector, hitClass, names, times }) => {
    const target = document.querySelector(selector);
    target.classList.remove(hitClass);
    void target.offsetWidth;
    target.classList.add(hitClass);
    const hitAnimations = target.getAnimations({ subtree: true })
      .filter(animation => names.includes(animation.animationName));
    for (const animation of hitAnimations) {
      animation.pause();
      animation.currentTime = 0;
    }
    const clipRect = document.querySelector('.battle-viewport')?.getBoundingClientRect();
    const clip = { left: Math.max(0, clipRect?.left || 0), top: Math.max(0, clipRect?.top || 0),
      right: Math.min(innerWidth, clipRect?.right ?? innerWidth),
      bottom: Math.min(innerHeight, clipRect?.bottom ?? innerHeight) };
    const boxFromRect = rect => {
      if (!rect) return null;
      const visible = { left: Math.max(clip.left, rect.left), top: Math.max(clip.top, rect.top),
        right: Math.min(clip.right, rect.right), bottom: Math.min(clip.bottom, rect.bottom) };
      visible.width = Math.max(0, visible.right - visible.left);
      visible.height = Math.max(0, visible.bottom - visible.top);
      visible.center = visible.width && visible.height
        ? { x: (visible.left + visible.right) / 2, y: (visible.top + visible.bottom) / 2 } : null;
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
        width: rect.width ?? rect.right - rect.left, height: rect.height ?? rect.bottom - rect.top, visible,
        clipped: { left: Math.max(0, clip.left - rect.left), top: Math.max(0, clip.top - rect.top),
          right: Math.max(0, rect.right - clip.right), bottom: Math.max(0, rect.bottom - clip.bottom) } };
    };
    const box = element => boxFromRect(element?.getBoundingClientRect());
    const paintedPortrait = portrait => {
      if (!portrait) return null;
      const raw = portrait.getBoundingClientRect();
      const wrap = portrait.closest('.portrait-wrap');
      if (!wrap) return boxFromRect(raw);
      const style = getComputedStyle(wrap);
      if (!['hidden', 'clip'].includes(style.overflowX) || !['hidden', 'clip'].includes(style.overflowY)) {
        return boxFromRect(raw);
      }
      const mask = wrap.getBoundingClientRect();
      const painted = { left: Math.max(raw.left, mask.left), top: Math.max(raw.top, mask.top),
        right: Math.min(raw.right, mask.right), bottom: Math.min(raw.bottom, mask.bottom) };
      if (painted.right <= painted.left || painted.bottom <= painted.top) return null;
      return boxFromRect(painted);
    };
    const frames = [];
    for (const atMs of times) {
      for (const animation of hitAnimations) {
        const duration = Number(animation.effect.getComputedTiming().duration);
        animation.currentTime = Math.min(atMs, duration);
      }
      const style = getComputedStyle(target);
      const portrait = target.querySelector('.battle-portrait, .battle-character-img');
      frames.push({ atMs, offsetWidth: target.offsetWidth,
        rootStyle: { animation: style.animationName, transform: style.transform,
          translate: style.translate, rotate: style.rotate },
        card: box(target), portrait: box(portrait), portraitPainted: paintedPortrait(portrait) });
    }
    return { animations: hitAnimations.map(animation => ({ name: animation.animationName,
      duration: animation.effect.getComputedTiming().duration })),
    calcSupport: CSS.supports('translate', 'calc(100% * 100% * sin(-14deg) / 3600px) 0'), frames };
  }, { selector, hitClass, names: [...HIT_ANIMATIONS], times: HIT_TIMES_MS });
  const neutral = captured.frames[0];
  const samples = captured.frames.map(frame => ({ atMs: frame.atMs, offsetWidth: frame.offsetWidth,
    rootStyle: frame.rootStyle, card: motionBox(frame.card, neutral.card),
    portrait: motionBox(frame.portrait, neutral.portrait),
    portraitPainted: motionBox(frame.portraitPainted, neutral.portraitPainted) }));
  const peaks = {};
  for (const part of ['card', 'portrait']) {
    peaks[part] = {};
    for (const axis of ['x', 'y']) {
      const values = samples.map(sample => (part === 'card'
        ? sample[part]?.visibleDelta?.[axis] : sample[part]?.delta?.[axis])).filter(Number.isFinite);
      peaks[part][axis] = values.length ? { min: Math.min(...values), max: Math.max(...values) } : null;
    }
  }
  return { animations: captured.animations, calcSupport: captured.calcSupport, samples, peaks };
}

async function holdFixtureHitClass(page, selector, hitClass, hold) {
  await page.evaluate(({ selector, hitClass, hold }) => {
    const target = document.querySelector(selector);
    target.__boardQaHitObserver?.disconnect();
    if (!hold) {
      delete target.__boardQaHitObserver;
      target.classList.remove(hitClass);
      return;
    }
    target.__boardQaHitObserver = new MutationObserver(() => {
      if (!target.classList.contains(hitClass)) target.classList.add(hitClass);
    });
    target.__boardQaHitObserver.observe(target, { attributes: true, attributeFilter: ['class'] });
  }, { selector, hitClass, hold });
}

function compareHitTrace(name, trace) {
  if (!BASELINE_REPORT) return;
  const baseline = BASELINE_REPORT.cases.find(entry => entry.name === name)?.motionTrace;
  check(`${name} baseline visual trace available`, Boolean(baseline),
    { baselineRef: BASELINE_REPORT.baselineRef, name });
  if (!baseline) return;
  const matchingTimes = baseline.samples.length === trace.samples.length && baseline.samples.every((frame, index) =>
    frame.atMs === trace.samples[index].atMs);
  check(`${name} same exact hit frame times`, matchingTimes,
    { expected: baseline.samples.map(frame => frame.atMs), actual: trace.samples.map(frame => frame.atMs) });
  if (!matchingTimes) return;
  const intentionalRecoil = /^(?:iframe-|map-(?:desktop|mobile|portrait|narrow-desktop))/.test(name) &&
    /\/(?:player|enemy)$/.test(name);
  const recoilAxis = name.startsWith('map-narrow-desktop/') || name.startsWith('map-portrait-')
    ? 'y' : 'x';
  const outwardEdge = name.endsWith('/player')
    ? (recoilAxis === 'y' ? 'top' : 'left')
    : (recoilAxis === 'y' ? 'bottom' : 'right');
  for (const part of ['card', 'portrait']) {
    if (part === 'portrait' && !baseline.samples[0].portrait && !trace.samples[0].portrait) continue;
    const peakLoss = [];
    const displacement = [];
    const clipping = [];
    for (const axis of ['x', 'y']) {
      if (intentionalRecoil && axis === recoilAxis) continue;
      const oldPeak = baseline.peaks?.[part]?.[axis], newPeak = trace.peaks?.[part]?.[axis];
      if (!oldPeak || !newPeak) continue;
      if (oldPeak.min < -3 && newPeak.min > oldPeak.min + Math.max(part === 'portrait' ? 2.5 : 2, -oldPeak.min * .1)) {
        peakLoss.push({ axis, direction: 'negative', baseline: oldPeak.min, candidate: newPeak.min });
      }
      if (oldPeak.max > 3 && newPeak.max < oldPeak.max - Math.max(part === 'portrait' ? 2.5 : 2, oldPeak.max * .1)) {
        peakLoss.push({ axis, direction: 'positive', baseline: oldPeak.max, candidate: newPeak.max });
      }
    }
    for (let index = 0; index < baseline.samples.length; index += 1) {
      const oldFrame = baseline.samples[index], newFrame = trace.samples[index];
      const oldBox = oldFrame[part], newBox = newFrame[part];
      if (!oldBox || !newBox) continue;
      const oldDelta = part === 'card' ? oldBox.visibleDelta : oldBox.delta;
      const newDelta = part === 'card' ? newBox.visibleDelta : newBox.delta;
      if (oldDelta && newDelta) for (const axis of ['x', 'y']) {
        if (intentionalRecoil && axis === recoilAxis) continue;
        const amount = oldDelta[axis];
        if (Math.abs(amount) < 3) continue;
        const tolerance = Math.max(part === 'portrait' ? 2.5 : 2, Math.abs(amount) * .1);
        if (Math.sign(newDelta[axis]) !== Math.sign(amount) ||
          Math.abs(newDelta[axis]) + tolerance < Math.abs(amount)) {
          displacement.push({ atMs: oldFrame.atMs, axis, baseline: amount,
            candidate: newDelta[axis], tolerance });
        }
      }
      for (const edge of ['left', 'top', 'right', 'bottom']) {
        if (intentionalRecoil && edge === outwardEdge) continue;
        const oldClip = part === 'portrait' ? oldFrame.portraitPainted || oldBox : oldBox;
        const newClip = part === 'portrait' ? newFrame.portraitPainted || newBox : newBox;
        if (newClip.clipped[edge] > oldClip.clipped[edge] + 2) {
          clipping.push({ atMs: oldFrame.atMs, edge, baseline: oldClip.clipped[edge],
            candidate: newClip.clipped[edge], rawBaseline: oldBox.clipped[edge],
            rawCandidate: newBox.clipped[edge] });
        }
      }
    }
    check(`${name} ${part} signed peak displacement matches original`, peakLoss.length === 0, peakLoss);
    check(`${name} ${part} visible displacement matches original`, displacement.length === 0, displacement);
    check(`${name} ${part} viewport clipping matches original`, clipping.length === 0, clipping);
  }
}

async function capturePairedTravel(page, spec) {
  return page.evaluate(({ pageKind, coop, reduced }) => {
    const iframe = pageKind === 'iframe';
    const roots = {
      player: document.querySelector(iframe ? '#playerCard' : '#battleHitDepthQaPlayer'),
      enemy: document.querySelector(iframe ? '#enemyCard' : '#battleHitDepthQaEnemy'),
    };
    if (!roots.player || !roots.enemy) return null;
    if (iframe && coop) roots.player.classList.add('has-coop-allies');
    const mover = side => iframe && coop && side === 'player'
      ? roots.player.querySelector('.card-inner') : roots[side];
    const attackClass = iframe ? 'portrait-attack' : 'attack';
    const hitClass = iframe ? 'portrait-hit' : 'hit';
    const hitFractions = iframe ? [0, .12, .24, .36, .48, .60, .72, .84, 1]
      : [0, .10, .20, .30, .40, .50, .60, .70, .80, .90, 1];
    const viewport = document.querySelector('.battle-viewport')?.getBoundingClientRect();
    const clip = { left: Math.max(0, viewport?.left || 0), top: Math.max(0, viewport?.top || 0),
      right: Math.min(innerWidth, viewport?.right ?? innerWidth),
      bottom: Math.min(innerHeight, viewport?.bottom ?? innerHeight) };
    const clear = () => {
      for (const root of Object.values(roots)) root.classList.remove(attackClass, hitClass);
      void roots.player.offsetWidth;
      void roots.enemy.offsetWidth;
    };
    const center = (element, root) => {
      const rect = element.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      const rootStyle = getComputedStyle(root);
      const rootClips = root !== element && ['hidden', 'clip'].includes(rootStyle.overflowX);
      const left = Math.max(clip.left, rect.left, rootClips ? rootRect.left : -Infinity);
      const right = Math.min(clip.right, rect.right, rootClips ? rootRect.right : Infinity);
      const top = Math.max(clip.top, rect.top, rootClips ? rootRect.top : -Infinity);
      const bottom = Math.min(clip.bottom, rect.bottom, rootClips ? rootRect.bottom : Infinity);
      const visible = right > left && bottom > top
        ? { x: (left + right) / 2, y: (top + bottom) / 2,
          width: right - left, height: bottom - top } : null;
      return { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2,
        width: rect.width, height: rect.height, visible };
    };
    const sampleAction = (side, className, names, fractions) => {
      clear();
      const root = roots[side];
      const target = mover(side);
      if (!target) return { error: `missing ${side} moving element` };
      root.classList.add(className);
      const animations = root.getAnimations({ subtree: true }).filter(item =>
        item.effect?.target === target &&
        (names.includes(item.animationName) ||
          ['battleHitKnockback', 'battleHitKnockbackVertical'].includes(item.animationName)));
      const animation = animations.find(item => names.includes(item.animationName));
      if (!animation) {
        const available = root.getAnimations({ subtree: true }).map(item => ({
          name: item.animationName, target: item.effect?.target?.className || null }));
        const computed = getComputedStyle(target).animationName;
        clear();
        return { error: `missing ${side} ${className} animation`, computed, available };
      }
      for (const item of animations) item.pause();
      const duration = Number(animation.effect.getComputedTiming().duration);
      const samples = fractions.map(at => {
        for (const item of animations) {
          item.currentTime = Number(item.effect.getComputedTiming().duration) * at;
        }
        return { at, ...center(target, root) };
      });
      const name = animation.animationName;
      clear();
      return { name, duration, samples };
    };
    const pairs = [];
    for (const attackSide of ['player', 'enemy']) {
      clear();
      const defendSide = attackSide === 'player' ? 'enemy' : 'player';
      const attacker = mover(attackSide), defender = mover(defendSide);
      const attackBase = center(attacker, roots[attackSide]);
      const defendBase = center(defender, roots[defendSide]);
      const axis = Math.abs(defendBase.y - attackBase.y) > Math.abs(defendBase.x - attackBase.x)
        ? 'y' : 'x';
      const direction = Math.sign(defendBase[axis] - attackBase[axis]);
      const hit = sampleAction(defendSide, hitClass,
        reduced ? [iframe ? 'cardHitReduced' : 'battleBoxHitReduced']
          : [iframe ? 'cardHitShake' : 'battleBoxHit'],
        reduced ? [0, .5, 1] : hitFractions);
      const attack = reduced ? null : sampleAction(attackSide, attackClass,
        iframe ? [attackSide === 'enemy' ? 'enemyCardAttackShake' : 'cardAttackShake']
          : [axis === 'y'
            ? (attackSide === 'enemy' ? 'battleBoxEnemyAttackStacked' : 'battleBoxPlayerAttackStacked')
            : (attackSide === 'enemy' ? 'battleBoxEnemyAttack' : 'battleBoxPlayerAttack')],
        iframe ? [0, .38, 1] : [0, .42, 1]);
      pairs.push({ attackSide, defendSide, axis, direction,
        attackBase, defendBase, attack, hit });
    }
    clear();
    return pairs;
  }, { pageKind: spec.page, coop: Boolean(spec.coop), reduced: Boolean(spec.reduced) });
}

async function checkPairedTravel(page, spec) {
  const pairs = await capturePairedTravel(page, spec);
  check(`${spec.name} paired travel traces available`, Boolean(pairs?.length === 2), pairs);
  if (!pairs?.length) return;
  for (const pair of pairs) {
    const label = `${spec.name}/${pair.attackSide}-attacks`;
    check(`${label} moving element animation available`,
      Boolean(pair.hit?.samples?.length && (spec.reduced || pair.attack?.samples?.length)),
      { attack: pair.attack?.error ? pair.attack : pair.attack?.name,
        hit: pair.hit?.error ? pair.hit : pair.hit?.name });
    if (!pair.hit?.samples?.length || (!spec.reduced && !pair.attack?.samples?.length)) continue;
    const hitSamples = pair.hit.samples.map(sample => ({ at: sample.at,
      raw: (sample[pair.axis] - pair.defendBase[pair.axis]) * pair.direction,
      visible: sample.visible && pair.defendBase.visible
        ? (sample.visible[pair.axis] - pair.defendBase.visible[pair.axis]) * pair.direction : null,
      visibleFraction: sample.visible
        ? sample.visible[pair.axis === 'x' ? 'width' : 'height'] /
          sample[pair.axis === 'x' ? 'width' : 'height'] : 0 }));
    const peak = hitSamples.reduce((best, sample) => sample.raw > best.raw ? sample : best);
    const data = { ...pair, hitSamples, peak };
    report.cases.push({ name: label, pairedTravel: data });
    if (spec.reduced) {
      check(`${label} reduced-motion card has no recoil`,
        hitSamples.every(sample => Math.abs(sample.raw) < 2), hitSamples);
      continue;
    }
    const forward = (pair.attack.samples[1][pair.axis] - pair.attackBase[pair.axis]) * pair.direction;
    const floor = spec.page === 'iframe' ? 100 : 12;
    check(`${label} attacker moves toward defender`, pair.direction !== 0 && forward > floor,
      { direction: pair.direction, forward, attack: pair.attack });
    check(`${label} whole-card knockback matches attacker travel`,
      forward > floor && peak.raw >= forward * .9 && peak.raw <= forward * 1.1,
      { attackerForwardPx: forward, defenderOutwardPx: peak.raw,
        ratio: forward > 0 ? peak.raw / forward : null, at: peak.at, axis: pair.axis });
    check(`${label} knockback remains visibly on screen`,
      peak.visible !== null && peak.visible > Math.min(45, forward * .45) &&
        peak.visibleFraction >= .3,
      { attackerForwardPx: forward, defenderVisiblePx: peak.visible,
        visibleFraction: peak.visibleFraction });
    check(`${label} action returns to neutral`,
      Math.abs((pair.attack.samples.at(-1)[pair.axis] - pair.attackBase[pair.axis]) * pair.direction) < 2 &&
        Math.abs(hitSamples.at(-1).raw) < 2,
      { attackEnd: pair.attack.samples.at(-1), hitEnd: hitSamples.at(-1) });
  }
}

async function captureRecoilPeakScreenshot(page, spec, side) {
  const pose = await page.evaluate(({ side, coop }) => {
    const player = document.getElementById('playerCard');
    const enemy = document.getElementById('enemyCard');
    player.classList.remove('portrait-attack', 'portrait-hit');
    enemy.classList.remove('portrait-attack', 'portrait-hit');
    if (coop) player.classList.add('has-coop-allies');
    const root = side === 'player' ? player : enemy;
    const target = coop && side === 'player' ? root.querySelector('.card-inner') : root;
    root.classList.add('portrait-hit');
    const animations = root.getAnimations({ subtree: true }).filter(item =>
      item.effect?.target === target &&
      ['cardHitShake', 'battleHitKnockback'].includes(item.animationName));
    if (!animations.some(item => item.animationName === 'cardHitShake')) return null;
    for (const animation of animations) {
      animation.pause();
      animation.currentTime = Number(animation.effect.getComputedTiming().duration) * .25;
    }
    const rect = target.getBoundingClientRect();
    return { at: .25, animations: animations.map(item => item.animationName),
      center: { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 },
      translate: getComputedStyle(target).translate };
  }, { side, coop: Boolean(spec.coop) });
  check(`${spec.name}/${side} recoil screenshot pose available`, Boolean(pose), pose);
  if (!pose) return;
  const screenshot = path.join(OUTPUT, `${spec.name}-${side}-recoil-25pct.png`);
  try {
    await page.screenshot({ path: screenshot });
  } finally {
    await page.evaluate(() => {
      document.getElementById('playerCard').classList.remove('portrait-hit');
      document.getElementById('enemyCard').classList.remove('portrait-hit');
    });
  }
  report.cases.push({ name: `${spec.name}/${side}-recoil-frame`, pose, screenshot });
}

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
    // renderBattle emits stats-only fighters; its old portrait selectors have no live image nodes.
    const fixture = document.createElement('section');
    fixture.id = 'battleHitDepthQaFixture';
    fixture.className = 'battle-grid';
    fixture.style.cssText = 'position:fixed;inset:12% 5%;z-index:99999;padding:12px;background:#061322;';
    fixture.innerHTML = `
      <div class="battle-box battle-fighter player" id="battleHitDepthQaPlayer">
        <div class="name">我方角色 ・ 山治</div>
        <div class="meta">S級 ・ 戰鬥員 ・ Lv.50 ・ 生命值 320/400 ・ 攻擊 180 ・ 防禦 120 ・ 特攻 140 ・ 特防 130 ・ 速度 160</div>
        <div class="battle-hp"><span style="width:80%"></span></div>
        <div class="meta">狀態：正常</div>
        <div class="meta">被動：連擊</div>
        <div class="meta">攜帶物：無</div>
        <div class="meta">船長：目前上場</div>
      </div>
      <div class="battle-box battle-fighter enemy" id="battleHitDepthQaEnemy">
        <div class="name">敵方角色</div>
        <div class="meta">級別 S級 ・ Lv.50 ・ 推薦戰力 4000+ ・ 速度 140</div>
        <div class="battle-hp"><span style="width:65%"></span></div>
        <div class="meta">生命值 260/400 ・ 攻擊 170 ・ 防禦 125 ・ 特攻 155 ・ 特防 120</div>
        <div class="meta">狀態：正常</div>
      </div>`;
    document.body.appendChild(fixture);
  });
  check('map fixture mirrors live stats-only fighters', await page.evaluate(() => {
    const fixture = document.getElementById('battleHitDepthQaFixture');
    return fixture?.querySelectorAll('.battle-box.battle-fighter').length === 2 &&
      fixture.querySelectorAll('.battle-portrait-stage, .battle-character-img, img').length === 0;
  }));
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
    if (!spec.reduced) await checkOriginalHitMotion(page, selectors.boss, 'cardHitShake', `${spec.name}/boss`);
    const bossScreenshot = path.join(OUTPUT, `${spec.name}-boss-up.png`);
    await page.screenshot({ path: bossScreenshot });
    const bossTrace = spec.reduced ? null : await captureHitTrace(page, selectors.boss, 'portrait-hit');
    if (bossTrace) compareHitTrace(`${spec.name}/boss-up`, bossTrace);
    report.cases.push({ name: `${spec.name}/boss-up`, before: initial.boss, impact: boss,
      motionTrace: bossTrace, screenshot: bossScreenshot });
    check(`${spec.name} boss hit pose active`, boss?.samples[0]?.animation !== 'none', boss?.samples[0]?.animation);
    if (spec.reduced) check(`${spec.name} boss reduced motion stays flat`, boss.maxTilt < 0.01, boss.samples[0]);
    else if (!BASELINE_REF) {
      check(`${spec.name} boss tilts away from actors below`,
        boss.samples[0].pitch < -0.02, { pitch: boss.samples[0].pitch });
    }

    await page.evaluate(() => {
      const fx = document.getElementById('totMusicaDualFx');
      fx.classList.add('show', 'persistent-stage', 'enemy-present', 'boss-revealed');
      fx.classList.remove('wave-impact');
      fx.classList.add('enemy-impact');
      document.getElementById('totMusicaBossFrame').classList.remove('portrait-hit');
    });
    for (const side of ['real', 'song']) {
      const impact = await seekTotImpact(page, selectors[side], spec.reduced, .22);
      if (!spec.reduced) await checkOriginalHitMotion(page, selectors[side], 'totMusicaTargetHitDown', `${spec.name}/${side}`);
      const screenshot = path.join(OUTPUT, `${spec.name}-${side}-down.png`);
      await page.screenshot({ path: screenshot });
      const motionTrace = spec.reduced ? null : await captureHitTrace(page, selectors[side], 'portrait-hit');
      if (motionTrace) compareHitTrace(`${spec.name}/${side}-down`, motionTrace);
      report.cases.push({ name: `${spec.name}/${side}-down`, before: initial[side], impact,
        motionTrace, screenshot });
      check(`${spec.name}/${side} hit pose active`,
        impact?.samples[0]?.animation === (spec.reduced ? 'cardHitReduced' : 'totMusicaTargetHitDown'),
        impact?.samples[0]?.animation);
      if (spec.reduced) check(`${spec.name}/${side} reduced motion stays flat`, impact.maxTilt < 0.01, impact.samples[0]);
      else if (!BASELINE_REF) {
        check(`${spec.name}/${side} tilts away from boss above`,
          impact.samples[0].pitch > 0.02, { pitch: impact.samples[0].pitch });
      }
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
    if (spec.name === 'map-narrow-desktop') {
      const layout = await page.evaluate(() => {
        const rules = [];
        const walk = (list, media = []) => {
          for (const rule of list) {
            if (rule.selectorText?.includes('.battle-grid') && rule.style?.gridTemplateColumns) {
              rules.push({ selector: rule.selectorText, columns: rule.style.gridTemplateColumns, media });
            }
            if (rule.cssRules) walk(rule.cssRules, rule.conditionText
              ? [...media, rule.conditionText] : media);
          }
        };
        for (const sheet of document.styleSheets) {
          try { walk(sheet.cssRules); } catch (_) { /* Cross-origin CSS is not needed here. */ }
        }
        return { innerWidth, media720: matchMedia('(max-width:720px)').matches,
          columns: getComputedStyle(document.getElementById('battleHitDepthQaFixture')).gridTemplateColumns,
          display: getComputedStyle(document.getElementById('battleHitDepthQaFixture')).display, rules };
      });
      check(`${spec.name} narrow desktop layout active`,
        layout.innerWidth === 700 && layout.media720, layout);
    }
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
      if (spec.page === 'iframe') await holdFixtureHitClass(page, selector, hitClass, true);
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
      await page.evaluate(({ selector, hitClass, reduced, pageKind }) => {
        const target = document.querySelector(selector);
        target.classList.remove(hitClass);
        void target.offsetWidth;
        target.classList.add(hitClass);
        const relevant = target.getAnimations({ subtree: true }).filter(animation =>
          /cardHitShake|cardHitReduced|battleBoxHit|battleBoxHitReduced/.test(animation.animationName));
        for (const animation of relevant) {
          animation.pause();
          const duration = Number(animation.effect?.getComputedTiming().duration) || 700;
          animation.currentTime = reduced ? 80 : duration * (pageKind === 'map' ? .10 : .12);
        }
      }, { selector, hitClass, reduced: spec.reduced, pageKind: spec.page });
      const impact = await page.evaluate(measure, { selector });
      const peak = Math.max(impact.maxTilt, ...frames.map(frame => frame.maxTilt));
      const yaw = impact.samples.map(item => item.yaw)
        .reduce((best, value) => Math.abs(value) > Math.abs(best) ? value : best, 0);
      yawBySide[side] = yaw;
      const animations = impact.samples.map(item => item.animation);
      if (!spec.reduced) await checkOriginalHitMotion(page, selector,
        spec.page === 'iframe' ? 'cardHitShake' : 'battleBoxHit', `${spec.name}/${side}`);
      const screenshot = path.join(OUTPUT, `${spec.name}-${side}.png`);
      await page.screenshot({ path: screenshot });
      const motionTrace = spec.reduced ? null : await captureHitTrace(page, selector, hitClass);
      if (motionTrace) compareHitTrace(`${spec.name}/${side}`, motionTrace);
      if (spec.page === 'iframe') await holdFixtureHitClass(page, selector, hitClass, false);
      else await page.evaluate(({ selector, hitClass }) => document.querySelector(selector)?.classList.remove(hitClass),
        { selector, hitClass });
      await page.waitForTimeout(260);
      const after = await page.evaluate(measure, { selector });
      const clipping = { before: before.box.clipped,
        frames: frames.map(frame => ({ at: frame.at, card: frame.box.clipped, portrait: frame.portraitBox?.clipped })),
        impact: { card: impact.box.clipped, portrait: impact.portraitBox?.clipped } };
      const details = { before, frames, impact, after, peak, yaw, clipping, motionTrace, screenshot };
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
      if (spec.page === 'iframe' && !spec.iframePortrait && !BASELINE_REF && !BASELINE_REPORT) {
        const hitBoxes = [...frames, impact];
        const allowedEdge = side === 'player' ? 'left' : 'right';
        const newCardClip = hitBoxes.some(frame => Object.keys(before.box.clipped).some(edge =>
          edge !== allowedEdge && frame.box.clipped[edge] > before.box.clipped[edge] + 2));
        const newPortraitClip = hitBoxes.some(frame => frame.portraitBox && before.portraitBox &&
          Object.keys(before.portraitBox.clipped).some(edge =>
            edge !== allowedEdge && frame.portraitBox.clipped[edge] > before.portraitBox.clipped[edge] + 2));
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
    if (!BASELINE_REF && !spec.reduced && !spec.mapPortrait) {
      const enemyDirection = Math.sign((enemy?.before.center.x || 0) - (player?.before.center.x || 0));
      check(`${spec.name} signed hit yaw follows attack side`,
        enemyDirection !== 0 && enemyDirection * yawBySide.player > 0.015 &&
          enemyDirection * yawBySide.enemy < -0.015,
        { enemyDirection, yawBySide });
    }
    if (spec.mapPortrait) {
      check(`${spec.name} fighters stack vertically`,
        Boolean(player && enemy && Math.abs(player.before.center.y - enemy.before.center.y) >
          Math.abs(player.before.center.x - enemy.before.center.x)),
        { player: player?.before.center, enemy: enemy?.before.center });
      if (!BASELINE_REF && !spec.reduced && player && enemy) {
        for (const [side, target, source] of [['player', player, enemy], ['enemy', enemy, player]]) {
          const expected = Math.sign(target.before.center.y - source.before.center.y);
          const pitch = target.impact.samples[0]?.pitch || 0;
          check(`${spec.name}/${side} tilts away from vertical attack`,
            expected * pitch > 0.02, { expected, pitch });
        }
      }
    }
    if (!BASELINE_REF && ['iframe-desktop', 'iframe-coop-desktop', 'map-desktop',
      'map-narrow-desktop',
      'iframe-reduced', 'iframe-coop-reduced', 'map-reduced'].includes(spec.name)) {
      await checkPairedTravel(page, spec);
    }
    if (!BASELINE_REF && ['iframe-desktop', 'iframe-coop-desktop'].includes(spec.name)) {
      for (const side of ['player', 'enemy']) await captureRecoilPeakScreenshot(page, spec, side);
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
  if (BASELINE_REPORT) check('comparison baseline is a passing pre-depth run',
    BASELINE_REPORT.ok === true && Boolean(BASELINE_REPORT.baselineRef),
    { ok: BASELINE_REPORT.ok, ref: BASELINE_REPORT.baselineRef });
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: CHROME });
    const desktop = { viewport: { width: 1440, height: 900 }, mobile: false, reduced: false };
    const mobile = { viewport: { width: 932, height: 430 }, mobile: true, reduced: false };
    const portrait = { viewport: { width: 390, height: 844 }, mobile: true, reduced: false, mapPortrait: true };
    const iframePortrait = { viewport: { width: 390, height: 844 }, mobile: true, reduced: false, iframePortrait: true };
    const reduced = { viewport: { width: 1440, height: 900 }, mobile: false, reduced: true };
    for (const page of ['iframe', 'map']) {
      for (const [variant, settings] of Object.entries(BASELINE_REF ? { desktop, mobile }
        : { desktop, mobile, reduced })) {
        await runCase(browser, { page, name: `${page}-${variant}`, ...settings });
      }
    }
    await runCase(browser, { page: 'iframe', name: 'iframe-portrait-390x844', ...iframePortrait });
    await runCase(browser, { page: 'map', name: 'map-portrait-390x844', ...portrait });
    await runCase(browser, { page: 'iframe', name: 'iframe-coop-desktop', ...desktop, coop: true });
    if (!BASELINE_REF) await runCase(browser,
      { page: 'iframe', name: 'iframe-coop-reduced', ...reduced, coop: true });
    await runCase(browser, { page: 'map', name: 'map-narrow-desktop',
      viewport: { width: 700, height: 768 }, mobile: false, reduced: false, mapPortrait: true });
    await runTotCase(browser, { name: 'tot-musica-desktop', ...desktop });
    await runTotCase(browser, { name: 'tot-musica-mobile', ...mobile });
    if (!BASELINE_REF) await runTotCase(browser, { name: 'tot-musica-reduced', ...reduced });
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
