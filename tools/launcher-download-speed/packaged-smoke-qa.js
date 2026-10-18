'use strict';

// Test-only wrapper: a fresh isolated packaged SMOKE run plus CDP eager loading
// for hidden lazy avatar-picker images. The original built smoke/assertions and
// application bytes remain unchanged; no ordinary user profile is accepted.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

async function port() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const chosen = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return chosen;
}

async function connect(url, events) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let next = 0;
  const waiting = new Map();
  socket.addEventListener('message', event => {
    const value = JSON.parse(event.data);
    if (value.id && waiting.has(value.id)) { waiting.get(value.id)(value); waiting.delete(value.id); }
    else if (['Runtime.exceptionThrown', 'Runtime.consoleAPICalled', 'Log.entryAdded'].includes(value.method)) events.push(value);
  });
  return {
    close: () => socket.close(),
    call: (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++next;
      waiting.set(id, resolve);
      socket.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (waiting.delete(id)) reject(new Error('CDP timeout: ' + method)); }, 3000).unref();
    })
  };
}

const SNAPSHOT = `JSON.stringify({url:location.href,ready:document.readyState,stage:document.body?.dataset?.stage,
  visible:!document.hidden,api:Boolean(window.onePieceDesktop),rails:document.querySelectorAll('.game-rail-item').length,
  images:[...document.images].filter(i=>i.getAttribute('src')).map(i=>({src:i.currentSrc||i.src,loading:i.loading,
    complete:i.complete,width:i.naturalWidth,height:i.naturalHeight,rect:i.getBoundingClientRect().toJSON()}))})`;

async function main(argv = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    assert(['--exe', '--qa-root'].includes(key), 'Unknown argument: ' + key);
    const value = argv[++index];
    assert(value && !value.startsWith('--'), 'Missing value: ' + key);
    options[key.slice(2)] = path.resolve(value);
  }
  assert(options.exe && options['qa-root'], 'Use --exe and a new absolute --qa-root.');
  const qa = options['qa-root'];
  assert(!fs.existsSync(qa), 'The complete QA root must be new; existing user profiles cannot be used.');
  assert(fs.lstatSync(options.exe).isFile() && !fs.lstatSync(options.exe).isSymbolicLink(), 'Use a regular packaged executable.');
  const archive = path.join(path.dirname(options.exe), 'resources/app.asar');
  const before = { exe: hash(options.exe), asar: hash(archive) };
  fs.mkdirSync(qa);
  const originalReport = path.join(qa, 'original-smoke-report.json');
  const screenshot = path.join(qa, 'launcher.png');
  const debugPort = await port();
  const environment = { ...process.env, OP_DESKTOP_SMOKE: '1', OP_DESKTOP_PREVIEW: '1',
    OP_DESKTOP_USER_DATA: path.join(qa, 'isolated-user-data'), OP_DESKTOP_CACHE_ROOT: path.join(qa, 'isolated-cache'),
    OP_DESKTOP_SMOKE_REPORT: originalReport, OP_DESKTOP_SCREENSHOT_PATH: screenshot,
    OP_DESKTOP_SCREENSHOT_VIEW: 'library', OP_DESKTOP_VIEWPORT: '1440x900', OP_DESKTOP_SMOKE_PROFILE_ASSETS: '1' };
  delete environment.ELECTRON_RUN_AS_NODE;
  delete environment.OP_DESKTOP_SMOKE_MEDIA_ASSETS;
  const stdout = fs.openSync(path.join(qa, 'stdout.log'), 'wx');
  const stderr = fs.openSync(path.join(qa, 'stderr.log'), 'wx');
  const child = spawn(options.exe, ['--noerrdialogs', '--remote-debugging-port=' + debugPort], {
    env: environment, windowsHide: true, stdio: ['ignore', stdout, stderr]
  });
  const report = { ok: false, exe: options.exe, isolatedQaRoot: qa, ownedProcessId: child.pid,
    smokeMode: true, originalAssertionsPreserved: true, binaryBefore: before, events: [], snapshots: [], intervention: null };
  let exited = false, exitCode = null, connection;
  child.once('error', error => { report.processError = error.message; exited = true; });
  child.once('exit', code => { exited = true; exitCode = code; });
  const deadline = Date.now() + 80000;
  let lastSnapshot = 0;
  try {
    while (!exited && Date.now() < deadline) {
      try {
        if (!connection) {
          const targets = await (await fetch('http://127.0.0.1:' + debugPort + '/json/list', { signal: AbortSignal.timeout(1000) })).json();
          const target = targets.find(target => target.type === 'page');
          if (target) { connection = await connect(target.webSocketDebuggerUrl, report.events); await connection.call('Runtime.enable'); }
        }
        if (connection && Date.now() - lastSnapshot > 250) {
          const result = await connection.call('Runtime.evaluate', { expression: SNAPSHOT, returnByValue: true });
          if (result.result?.result?.value) {
            const state = JSON.parse(result.result.result.value);
            lastSnapshot = Date.now();
            if (!report.intervention && state.stage === 'app' && state.rails === 3 && state.api && state.ready === 'complete') {
              report.preIntervention = state;
              // Only this wrapper-launched process with its new isolated SMOKE
              // profile is modified. No application source, slots or real data.
              const changed = await connection.call('Runtime.evaluate', { returnByValue: true,
                expression: `JSON.stringify((()=>{const images=[...document.images].filter(i=>i.loading==='lazy');
                  const pending=images.filter(i=>!i.complete).length;for(const image of images)image.loading='eager';
                  return {testOnly:true,forcedEager:images.length,pendingBefore:pending}})())` });
              report.intervention = JSON.parse(changed.result.result.value);
            }
            if (report.intervention && state.images.every(image => image.complete && image.width > 0)) report.loadedImages = state;
            if (report.snapshots.length < 8 || state.images.filter(image => !image.complete).length === 0)
              report.snapshots.push({ at: new Date().toISOString(), stage: state.stage, rails: state.rails,
                images: state.images.length, pendingImages: state.images.filter(image => !image.complete).length,
                brokenImages: state.images.filter(image => image.complete && !image.width).map(image => image.src) });
          }
        }
      } catch (error) { report.lastDiagnosticError = error.message; }
      await sleep(100);
    }
    if (!exited) { report.timedOut = true; child.kill(); }
    report.exitCode = exitCode;
    if (fs.existsSync(originalReport)) report.originalSmoke = JSON.parse(fs.readFileSync(originalReport, 'utf8'));
    report.screenshot = fs.existsSync(screenshot) ? { path: screenshot, bytes: fs.statSync(screenshot).size, sha256: hash(screenshot) } : null;
    report.binaryAfter = { exe: hash(options.exe), asar: hash(archive) };
    assert.deepEqual(report.binaryAfter, before, 'The packaged application changed during smoke.');
    report.ok = exitCode === 0 && report.originalSmoke?.ok === true && Boolean(report.intervention) && Boolean(report.screenshot)
      && report.preIntervention?.stage === 'app' && report.preIntervention?.rails === 3 && report.preIntervention?.api === true;
  } finally {
    connection?.close();
    fs.closeSync(stdout); fs.closeSync(stderr);
    fs.writeFileSync(path.join(qa, 'wrapper-report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  }
  console.log(JSON.stringify({ ok: report.ok, exitCode, forcedEager: report.intervention?.forcedEager,
    originalSmokePassed: report.originalSmoke?.ok, screenshot: report.screenshot?.path,
    report: path.join(qa, 'wrapper-report.json') }));
  assert(report.ok, 'The original packaged smoke did not pass; inspect the retained reports.');
  return report;
}

if (require.main === module) main().catch(error => { console.error(error.stack); process.exitCode = 1; });
module.exports = { main };
