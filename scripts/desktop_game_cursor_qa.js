'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const WORKER_FLAG = '--electron-worker';
const STYLE_ID = 'desktop-game-cursor-policy-v4';
const POLICY_MARKER = '__ONE_PIECE_GAME_CURSOR_POLICY_V4__';

function optionValue(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return '';
  if (!args[index + 1] || args[index + 1].startsWith('--')) {
    throw new Error(`${name} requires a path.`);
  }
  return args[index + 1];
}

function resolveInstalledModule(installedAsar) {
  const target = path.resolve(installedAsar);
  if (/\.js$/i.test(target)) return target;
  if (/\.asar$/i.test(target)) return path.join(target, 'game-cursor-policy.js');
  const candidates = [
    path.join(target, 'game-cursor-policy.js'),
    path.join(target, 'desktop', 'game-cursor-policy.js'),
    path.join(target, 'resources', 'app.asar', 'game-cursor-policy.js'),
    path.join(target, 'app.asar', 'game-cursor-policy.js')
  ];
  const direct = candidates.find((candidate) => fs.existsSync(candidate));
  if (direct) return direct;
  throw new Error(`Cannot locate game-cursor-policy.js under ${target}`);
}

function inferInstalledResourceRoot(installedAsar) {
  const target = path.resolve(installedAsar);
  if (/\.asar$/i.test(target)) return path.join(path.dirname(target), 'cursor-policy');
  const candidates = [
    path.join(target, 'resources', 'cursor-policy'),
    path.join(target, 'cursor-policy')
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function resolveElectronExecutable() {
  if (process.env.OP_DESKTOP_ELECTRON_EXECUTABLE) {
    return path.resolve(process.env.OP_DESKTOP_ELECTRON_EXECUTABLE);
  }
  try {
    const resolved = require(path.join(ROOT, 'desktop', 'node_modules', 'electron'));
    if (typeof resolved === 'string') return resolved;
  } catch { /* Report a focused error below. */ }
  const suffix = process.platform === 'win32' ? 'electron.exe' : 'electron';
  const candidate = path.join(ROOT, 'desktop', 'node_modules', 'electron', 'dist', suffix);
  if (fs.existsSync(candidate)) return candidate;
  throw new Error('Electron runtime not found. Run desktop npm ci, or set OP_DESKTOP_ELECTRON_EXECUTABLE.');
}

function makeTempRoot() {
  const preferred = process.platform === 'win32' && fs.existsSync('D:\\')
    ? 'D:\\Codex_BuildCache\\qa'
    : path.join(os.tmpdir(), 'onepiece-desktop-qa');
  fs.mkdirSync(preferred, { recursive: true });
  return fs.mkdtempSync(path.join(preferred, 'cursor-policy-'));
}

function removeOwnedTempRoot(tempRoot) {
  const resolved = path.resolve(tempRoot);
  const parent = path.dirname(resolved);
  if (!path.basename(resolved).startsWith('cursor-policy-') || path.parse(resolved).root === resolved) {
    throw new Error(`Refusing to remove unsafe QA path: ${resolved}`);
  }
  if (!path.basename(parent).toLowerCase().includes('qa')) {
    throw new Error(`Refusing to remove QA path outside a qa directory: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}

function runController() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    process.stdout.write([
      'Usage: node scripts/desktop_game_cursor_qa.js [options]',
      '  --installed-asar PATH  Test game-cursor-policy.js from an installed app.asar or app directory.',
      '  --resource-root PATH   Override cursor-policy resource root.',
      'Environment: OP_DESKTOP_ELECTRON_EXECUTABLE may point to Electron 44.'
    ].join('\n') + '\n');
    return;
  }

  const installedAsar = optionValue(args, '--installed-asar');
  const modulePath = installedAsar
    ? resolveInstalledModule(installedAsar)
    : path.join(ROOT, 'desktop', 'game-cursor-policy.js');
  const resourceRoot = path.resolve(
    optionValue(args, '--resource-root') ||
      (installedAsar ? inferInstalledResourceRoot(installedAsar) : path.join(ROOT, 'public'))
  );
  const electronExecutable = resolveElectronExecutable();
  const tempRoot = makeTempRoot();
  const reportPath = path.join(tempRoot, 'report.json');
  const userData = path.join(tempRoot, 'user-data');
  const sessionData = path.join(tempRoot, 'session-data');
  fs.mkdirSync(userData, { recursive: true });
  fs.mkdirSync(sessionData, { recursive: true });

  const environment = { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' };
  delete environment.ELECTRON_RUN_AS_NODE;
  const child = spawnSync(electronExecutable, [
    __filename,
    WORKER_FLAG,
    '--module-path', modulePath,
    '--resource-root', resourceRoot,
    '--report', reportPath,
    '--user-data', userData,
    '--session-data', sessionData
  ], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 120000,
    windowsHide: true,
    env: environment
  });

  let failure;
  try {
    if (child.error) {
      throw new Error([
        child.error.message,
        child.stdout && `stdout:\n${child.stdout.trim()}`,
        child.stderr && `stderr:\n${child.stderr.trim()}`
      ].filter(Boolean).join('\n'));
    }
    if (child.status !== 0) {
      throw new Error([
        `Electron QA exited with ${child.status}.`,
        child.stdout && `stdout:\n${child.stdout.trim()}`,
        child.stderr && `stderr:\n${child.stderr.trim()}`
      ].filter(Boolean).join('\n'));
    }
    assert.equal(fs.existsSync(reportPath), true, 'Electron worker did not create its JSON report.');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.ok, true, report.error || 'Electron cursor QA failed.');
    process.stdout.write(`desktop_game_cursor_qa: PASS (${report.assertions} assertions, Electron ${report.electronVersion}, ${report.mode})\n`);
  } catch (error) {
    failure = error;
  }
  try {
    removeOwnedTempRoot(tempRoot);
  } catch (cleanupError) {
    if (!failure) failure = cleanupError;
    else process.stderr.write(`desktop_game_cursor_qa cleanup warning: ${cleanupError.message}\n`);
  }
  if (failure) throw failure;
}

function listenerProbe() {
  return `(() => {
    window.__qaListenerCounts = Object.create(null);
    const count = (scope, type) => {
      const key = scope + ':' + type;
      window.__qaListenerCounts[key] = (window.__qaListenerCounts[key] || 0) + 1;
    };
    const documentAdd = document.addEventListener.bind(document);
    document.addEventListener = function(type, listener, options) {
      count('document', type);
      return documentAdd(type, listener, options);
    };
    const windowAdd = window.addEventListener.bind(window);
    window.addEventListener = function(type, listener, options) {
      count('window', type);
      return windowAdd(type, listener, options);
    };
    window.__qaDrag = { starts: 0, drops: 0 };
  })();`;
}

function controlsMarkup() {
  return `
    <button id="button"><span id="button-child">child</span></button>
    <button id="button-b">B</button>
    <input id="text-input" type="text" value="">
    <input id="checkbox" type="checkbox">
    <select id="select"><option>one</option></select>
    <input id="range" type="range">
    <textarea id="textarea"></textarea>
    <div id="editable" contenteditable="true">edit</div>
    <div id="native-wait" style="cursor: wait !important">wait</div>
    <div id="native-grab" style="cursor: grab !important">grab</div>
    <div id="native-zoom" style="cursor: zoom-in !important">zoom</div>
    <div id="native-text" style="cursor: text !important">text</div>
    <img id="drag-image" draggable="true" alt="drag" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==">
    <div id="drop-target">drop</div>
    <script>
      document.getElementById('drag-image').addEventListener('dragstart', () => window.__qaDrag.starts++);
      document.getElementById('drop-target').addEventListener('drop', () => window.__qaDrag.drops++);
    </script>`;
}

function fixtureDocument({ requestId, includeFrames = false, externalOrigin = '' }) {
  const frames = includeFrames
    ? `<iframe id="same-frame" name="fixture-same" src="/frame-a"></iframe>
       <iframe id="cross-frame" name="fixture-cross" src="${externalOrigin}/external-frame"></iframe>`
    : '';
  return `<!doctype html>
  <html><head><meta charset="utf-8"><title>cursor qa</title>
  <script>${listenerProbe()}</script>
  <style>body{min-height:1600px} iframe{width:360px;height:260px}</style></head>
  <body data-request-id="${requestId}">${controlsMarkup()}${frames}</body></html>`;
}

function startServer(handler) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections?.();
  });
}

async function waitFor(check, description, timeout = 10000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeout) {
    try {
      const value = await withTimeout(Promise.resolve().then(check), 1500, `${description} probe`);
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`Timed out waiting for ${description}${lastError ? `: ${lastError.message}` : ''}`);
}

function withTimeout(promise, timeout, description) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out during ${description}`)), timeout);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

function frameEval(frame, code, description, timeout = 5000) {
  return withTimeout(frame.executeJavaScript(code), timeout, description);
}

function traceStage(message) {
  process.stderr.write(`[cursor-qa +${Math.round(process.uptime() * 1000)}ms] ${message}\n`);
}

function allFrames(webContents) {
  return webContents.mainFrame.framesInSubtree.filter((frame) => !frame.isDestroyed() && !frame.detached);
}

async function waitForFrame(webContents, predicate, description) {
  return waitFor(
    () => allFrames(webContents).find((frame) => predicate(frame)),
    description
  );
}

async function waitForPolicy(frame, description) {
  await waitFor(async () => {
    try {
      return await frameEval(frame,
        `Boolean(window.${POLICY_MARKER} && document.getElementById(${JSON.stringify(STYLE_ID)}))`
        , `${description} policy probe`
      );
    } catch {
      return false;
    }
  }, `${description} policy injection`);
}

async function inspectFrame(frame) {
  return frameEval(frame, `(() => {
    const cursor = (id) => {
      const node = document.getElementById(id);
      return node ? getComputedStyle(node).cursor : null;
    };
    const style = document.getElementById(${JSON.stringify(STYLE_ID)});
    return {
      href: location.href,
      origin: location.origin,
      marker: Boolean(window.${POLICY_MARKER}),
      legacyMarker: Boolean(window.__ONE_PIECE_GAME_CURSOR_FEEDBACK_V1__),
      styleCount: document.querySelectorAll('#${STYLE_ID}').length,
      styleText: style?.textContent || '',
      finePointer: matchMedia('(any-hover: hover) and (any-pointer: fine)').matches,
      cursors: {
        body: getComputedStyle(document.body).cursor,
        button: cursor('button'),
        buttonChild: cursor('button-child'),
        textInput: cursor('text-input'),
        checkbox: cursor('checkbox'),
        select: cursor('select'),
        range: cursor('range'),
        textarea: cursor('textarea'),
        editable: cursor('editable'),
        wait: cursor('native-wait'),
        grab: cursor('native-grab'),
        zoom: cursor('native-zoom'),
        text: cursor('native-text')
      },
      listenerCounts: { ...window.__qaListenerCounts }
    };
  })()`, 'inspect frame');
}

function cursorState(cursor) {
  return String(cursor).match(/(?:card_cursor_buggy_glove|board_cursor_nami_quill)_(default|pointer|pressed)_/i)?.[1]?.toLowerCase() || '';
}

function expectedThemeNeedle(gameId) {
  return gameId === 'board' ? 'board_cursor_nami_quill_' : 'card_cursor_buggy_glove_';
}

function checkInjectedSnapshot(snapshot, gameId, origin, countAssertion) {
  countAssertion(snapshot.marker, true, `${gameId}: V4 marker is present`);
  countAssertion(snapshot.legacyMarker, true, `${gameId}: compatibility marker is present`);
  countAssertion(snapshot.styleCount, 1, `${gameId}: style is injected once`);
  countAssertion(snapshot.finePointer, true, `${gameId}: Electron exposes a desktop fine pointer`);
  countAssertion(snapshot.styleText.includes('../images/'), false, `${gameId}: relative image URLs were rewritten`);
  countAssertion(snapshot.styleText.includes(`${origin}/images/`), true, `${gameId}: cursor images use the exact game origin`);
  const needle = expectedThemeNeedle(gameId);
  for (const [name, value] of Object.entries(snapshot.cursors)) {
    countAssertion(String(value).includes(needle), true, `${gameId}: ${name} keeps the themed cursor`);
  }
  for (const name of ['button', 'buttonChild', 'checkbox', 'select', 'range']) {
    countAssertion(cursorState(snapshot.cursors[name]), 'pointer', `${gameId}: ${name} is pointer-themed`);
  }
  for (const name of ['body', 'textInput', 'textarea', 'editable', 'wait', 'text']) {
    countAssertion(cursorState(snapshot.cursors[name]), 'default', `${gameId}: ${name} is default-themed`);
  }
  for (const name of ['grab', 'zoom']) {
    countAssertion(cursorState(snapshot.cursors[name]), 'pointer', `${gameId}: inline ${name} is pointer-themed`);
  }
  for (const key of [
    'document:pointerover', 'document:pointerdown', 'document:pointerup',
    'document:pointercancel', 'document:dragstart', 'window:blur'
  ]) {
    countAssertion(snapshot.listenerCounts[key], 1, `${gameId}: ${key} listener is de-duplicated`);
  }
}

async function normalizeFixtureCursors(frame) {
  await frameEval(frame, `(() => {
    const ids = ['button-child','text-input','checkbox','select','range','textarea','editable',
      'native-wait','native-grab','native-zoom','native-text'];
    for (const id of ids) {
      document.getElementById(id).dispatchEvent(new PointerEvent('pointerover', {
        bubbles: true, isPrimary: true, pointerType: 'mouse'
      }));
    }
  })()`, 'normalize fixture cursors');
}

async function testInputAndDrag(frame, countAssertion) {
  const result = await frameEval(frame, `(() => {
    const input = document.getElementById('text-input');
    input.focus();
    document.execCommand('insertText', false, 'Q');
    const image = document.getElementById('drag-image');
    const dragAllowed = image.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true }));
    const dropAllowed = document.getElementById('drop-target')
      .dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true }));
    return {
      value: input.value,
      dragAllowed,
      dropAllowed,
      draggable: image.draggable,
      counters: { ...window.__qaDrag }
    };
  })()`, 'input and drag behavior');
  countAssertion(result.value, 'Q', 'text input still accepts typing');
  countAssertion(result.dragAllowed, true, 'explicit dragstart is not cancelled');
  countAssertion(result.dropAllowed, true, 'explicit drop is not cancelled');
  countAssertion(result.draggable, true, 'explicit draggable attribute is preserved');
  countAssertion(result.counters.starts, 1, 'game dragstart handler still runs');
  countAssertion(result.counters.drops, 1, 'game drop handler still runs');
}

async function testPointerFeedback(frame, gameId, countAssertion) {
  const result = await frameEval(frame, `(async () => {
    const a = document.getElementById('button-child');
    const b = document.getElementById('button-b');
    const fire = (node, type, pointerType = 'mouse') => node.dispatchEvent(new PointerEvent(type, {
      bubbles: true, isPrimary: true, button: 0, pointerType, clientX: 44, clientY: 55
    }));
    fire(a, 'pointerdown');
    const down = {
      pressed: document.body.classList.contains('game-cursor-pressed'),
      pulses: document.querySelectorAll('.game-cursor-click-pulse').length,
      cursor: getComputedStyle(a).cursor
    };
    fire(b, 'pointerover');
    fire(b, 'pointerup');
    const up = {
      pressed: document.body.classList.contains('game-cursor-pressed'),
      cursorA: getComputedStyle(a).cursor,
      cursorB: getComputedStyle(b).cursor
    };
    window.dispatchEvent(new Event('blur'));
    const blur = {
      pressed: document.body.classList.contains('game-cursor-pressed'),
      pulses: document.querySelectorAll('.game-cursor-click-pulse').length
    };
    fire(a, 'pointerdown', 'touch');
    const touch = {
      pressed: document.body.classList.contains('game-cursor-pressed'),
      pulses: document.querySelectorAll('.game-cursor-click-pulse').length
    };
    return { down, up, blur, touch };
  })()`, 'pointer feedback behavior');
  countAssertion(cursorState(result.down.cursor), 'pressed', `${gameId}: pointerdown selects pressed art`);
  countAssertion(result.down.pressed, true, `${gameId}: pointerdown sets pressed state`);
  countAssertion(result.down.pulses, 1, `${gameId}: pointerdown renders one feedback pulse`);
  countAssertion(result.up.pressed, false, `${gameId}: pointerup on another element clears pressed state`);
  countAssertion(cursorState(result.up.cursorA), 'pointer', `${gameId}: original target restores pointer art`);
  countAssertion(cursorState(result.up.cursorB), 'pointer', `${gameId}: release target keeps pointer art`);
  countAssertion(result.blur.pressed, false, `${gameId}: blur clears pressed state`);
  countAssertion(result.blur.pulses, 0, `${gameId}: blur clears feedback pulse`);
  countAssertion(result.touch.pressed, false, `${gameId}: touch does not enable mouse pressed state`);
  countAssertion(result.touch.pulses, 0, `${gameId}: touch does not render mouse feedback`);
}

async function runTheme({ BrowserWindow, installGameCursorPolicy, gameId, primary, external, resourceRoot, countAssertion, lifecycle }) {
  traceStage(`${gameId}: create window`);
  const window = new BrowserWindow({
    show: false,
    width: 1100,
    height: 760,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  try {
    installGameCursorPolicy(window.webContents, gameId, { origin: primary.origin, resourceRoot });
    installGameCursorPolicy(window.webContents, gameId, { origin: primary.origin, resourceRoot });
    traceStage(`${gameId}: load main fixture`);
    await withTimeout(window.loadURL(`${primary.origin}/main?theme=${gameId}`), 15000, `${gameId} main loadURL`);
    const main = window.webContents.mainFrame;
    await waitForPolicy(main, `${gameId} main frame`);
    const same = await waitForFrame(window.webContents, (frame) => frame.url.includes('/frame-a'), `${gameId} same-origin iframe`);
    await waitForPolicy(same, `${gameId} same-origin iframe`);
    const cross = await waitForFrame(window.webContents, (frame) => frame.url.startsWith(external.origin), `${gameId} cross-origin iframe`);

    await normalizeFixtureCursors(main);
    const mainSnapshot = await inspectFrame(main);
    checkInjectedSnapshot(mainSnapshot, gameId, primary.origin, countAssertion);
    const sameSnapshot = await inspectFrame(same);
    countAssertion(sameSnapshot.marker, true, `${gameId}: same-origin iframe receives policy`);
    countAssertion(sameSnapshot.styleCount, 1, `${gameId}: same-origin iframe receives one style`);
    const crossSnapshot = await inspectFrame(cross);
    countAssertion(crossSnapshot.marker, false, `${gameId}: cross-origin iframe gets no marker`);
    countAssertion(crossSnapshot.styleCount, 0, `${gameId}: cross-origin iframe gets no style`);

    await testInputAndDrag(main, countAssertion);
    await testPointerFeedback(main, gameId, countAssertion);
    traceStage(`${gameId}: base behavior complete`);

    if (lifecycle) {
      traceStage(`${gameId}: create lifecycle frames`);
      await frameEval(main, `(() => {
        const blank = document.createElement('iframe');
        blank.id = 'blank-frame'; blank.name = 'fixture-blank';
        document.body.appendChild(blank);
        const srcdoc = document.createElement('iframe');
        srcdoc.id = 'srcdoc-frame'; srcdoc.name = 'fixture-srcdoc';
        srcdoc.srcdoc = '<!doctype html><html><head></head><body><button id="srcdoc-button">srcdoc</button></body></html>';
        document.body.appendChild(srcdoc);
        const dynamic = document.createElement('iframe');
        dynamic.id = 'dynamic-frame'; dynamic.name = 'fixture-dynamic'; dynamic.src = '/frame-dynamic-a';
        document.body.appendChild(dynamic);
      })()`, `${gameId} create lifecycle frames`);
      const blank = await waitForFrame(window.webContents, (frame) => frame.name === 'fixture-blank', 'about:blank iframe');
      const srcdoc = await waitForFrame(window.webContents, (frame) => frame.name === 'fixture-srcdoc', 'srcdoc iframe');
      const dynamicA = await waitForFrame(window.webContents, (frame) => frame.url.includes('/frame-dynamic-a'), 'dynamic same-origin iframe');
      await waitForPolicy(blank, 'about:blank iframe');
      await waitForPolicy(srcdoc, 'srcdoc iframe');
      await waitForPolicy(dynamicA, 'dynamic same-origin iframe');
      for (const [label, frame] of [['about:blank', blank], ['srcdoc', srcdoc], ['dynamic', dynamicA]]) {
        const snapshot = await inspectFrame(frame);
        countAssertion(snapshot.marker, true, `${label} frame inherits the exact origin policy`);
        countAssertion(snapshot.styleCount, 1, `${label} frame receives one style`);
      }

      traceStage(`${gameId}: navigate dynamic frame`);
      await frameEval(main, `document.getElementById('dynamic-frame').src = '/frame-dynamic-b'`, `${gameId} navigate dynamic frame`);
      const dynamicB = await waitForFrame(window.webContents, (frame) => frame.url.includes('/frame-dynamic-b'), 'navigated dynamic iframe');
      await waitForPolicy(dynamicB, 'navigated dynamic iframe');
      let dynamicRequest = await frameEval(dynamicB, `Number(document.body.dataset.requestId)`, 'read dynamic request id');
      countAssertion((await inspectFrame(dynamicB)).styleCount, 1, 'navigated iframe receives one fresh style');
      traceStage(`${gameId}: reload dynamic frame`);
      await frameEval(dynamicB, 'location.reload()', 'reload dynamic iframe');
      const reloadedDynamic = await waitFor(async () => {
        const frame = allFrames(window.webContents).find((item) => item.url.includes('/frame-dynamic-b'));
        if (!frame) return false;
        try {
          const requestId = await frameEval(frame, `Number(document.body.dataset.requestId || 0)`, 'probe reloaded dynamic iframe');
          return requestId > dynamicRequest ? frame : false;
        } catch { return false; }
      }, 'dynamic iframe reload');
      await waitForPolicy(reloadedDynamic, 'reloaded dynamic iframe');
      countAssertion((await inspectFrame(reloadedDynamic)).styleCount, 1, 'reloaded iframe receives one style');

      traceStage(`${gameId}: reload main frame`);
      const mainRequest = Number(await frameEval(main, `document.body.dataset.requestId`, 'read main request id'));
      window.webContents.reload();
      await waitFor(async () => {
        try {
          return Number(await frameEval(window.webContents.mainFrame, `document.body.dataset.requestId || 0`, 'probe reloaded main frame')) > mainRequest;
        } catch { return false; }
      }, 'main frame reload');
      await waitForPolicy(window.webContents.mainFrame, 'reloaded main frame');
      await normalizeFixtureCursors(window.webContents.mainFrame);
      const reloadedMain = await inspectFrame(window.webContents.mainFrame);
      checkInjectedSnapshot(reloadedMain, gameId, primary.origin, countAssertion);
      traceStage(`${gameId}: lifecycle complete`);
    }
  } finally {
    if (!window.isDestroyed()) window.destroy();
    traceStage(`${gameId}: window destroyed`);
  }
}

async function runElectronWorker() {
  const { app, BrowserWindow } = require('electron');
  const args = process.argv.slice(2);
  const reportPath = path.resolve(optionValue(args, '--report'));
  const modulePath = path.resolve(optionValue(args, '--module-path'));
  const resourceRoot = path.resolve(optionValue(args, '--resource-root'));
  app.setPath('userData', path.resolve(optionValue(args, '--user-data')));
  app.setPath('sessionData', path.resolve(optionValue(args, '--session-data')));
  app.commandLine.appendSwitch('disable-background-networking');
  // The fixture intentionally closes its first themed window before opening the
  // second. Keep Electron alive until the worker has written its final report.
  app.on('window-all-closed', () => {});

  const report = {
    ok: false,
    assertions: 0,
    electronVersion: process.versions.electron,
    mode: modulePath.toLowerCase().includes('.asar') ? 'installed-asar' : 'source'
  };
  const countAssertion = (actual, expected, message) => {
    assert.equal(actual, expected, message);
    report.assertions += 1;
  };
  let external;
  let primary;
  const resourceReads = Object.create(null);
  const originalReadFileSync = fs.readFileSync;
  fs.readFileSync = function instrumentedRead(filePath, ...rest) {
    const normalized = path.normalize(String(filePath));
    if (normalized.startsWith(path.normalize(resourceRoot + path.sep))) {
      const relative = path.relative(resourceRoot, normalized).replaceAll('\\', '/');
      resourceReads[relative] = (resourceReads[relative] || 0) + 1;
    }
    return originalReadFileSync.call(fs, filePath, ...rest);
  };

  try {
    traceStage('app.whenReady');
    await app.whenReady();
    let requestSequence = 0;
    external = await startServer((request, response) => {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><html><head></head><body id="external">external</body></html>');
    });
    primary = await startServer((request, response) => {
      const url = new URL(request.url, 'http://fixture.invalid');
      requestSequence += 1;
      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store'
      });
      response.end(fixtureDocument({
        requestId: requestSequence,
        includeFrames: url.pathname === '/main',
        externalOrigin: external.origin
      }));
    });

    traceStage(`require policy module: ${modulePath}`);
    const { installGameCursorPolicy } = require(modulePath);
    countAssertion(typeof installGameCursorPolicy, 'function', 'policy module exports installGameCursorPolicy');
    await runTheme({ BrowserWindow, installGameCursorPolicy, gameId: 'board', primary, external, resourceRoot, countAssertion, lifecycle: true });
    const readsAfterBoard = { ...resourceReads };
    await runTheme({ BrowserWindow, installGameCursorPolicy, gameId: 'card', primary, external, resourceRoot, countAssertion, lifecycle: false });

    countAssertion(resourceReads['css/board-cursor-nami-v3.css'], 1, 'board CSS is read once');
    countAssertion(resourceReads['css/card-cursor-buggy-v3.css'], 1, 'card CSS is read once');
    countAssertion(resourceReads['js/game_cursor_feedback_v1.js'], 2, 'feedback JS is read once per cached theme payload');
    countAssertion(readsAfterBoard['css/board-cursor-nami-v3.css'], 1, 'frame lifecycle does not reread board CSS');
    countAssertion(readsAfterBoard['js/game_cursor_feedback_v1.js'], 1, 'frame lifecycle does not reread feedback JS');
    report.ok = true;
    traceStage('all assertions complete');
  } catch (error) {
    report.error = error && error.stack ? error.stack : String(error);
    traceStage(`failure: ${error.message || error}`);
  } finally {
    fs.readFileSync = originalReadFileSync;
    traceStage('close fixture servers');
    if (primary) await closeServer(primary.server);
    if (external) await closeServer(external.server);
    traceStage(`write report: ${reportPath}`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    app.exit(report.ok ? 0 : 1);
  }
}

if (process.argv.includes(WORKER_FLAG) || process.versions.electron) {
  runElectronWorker().catch((error) => {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  });
} else {
  try {
    runController();
  } catch (error) {
    process.stderr.write(`desktop_game_cursor_qa: FAIL\n${error.stack || error}\n`);
    process.exitCode = 1;
  }
}
