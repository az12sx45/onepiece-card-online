'use strict';

// Bounded, unauthenticated Socket.IO probes. No accounts, login, rooms or game
// state are created. Only launcher-main probes emit read-only BOARD_ROOM_LIST.
// Electron cases use its User-Agent in Node; they are not Electron UI tests.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const args = process.argv.slice(2);
function arg(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing ${name} value`);
  return args[index + 1];
}
const TIMEOUT = 8000;
const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36';
const ELECTRON = BROWSER + ' Electron/37.3.1';

function reserveReport(requested, initial) {
  const target = path.extname(requested).toLowerCase() === '.json' ? requested : path.join(requested, 'socket-report.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const output = attempt === 0 ? target : target.slice(0, -5) + `-${stamp}-${attempt}.json`;
    try {
      fs.writeFileSync(output, JSON.stringify(initial, null, 2) + '\n', { flag: 'wx' });
      return output;
    } catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  throw new Error('Cannot reserve a new report; prior reports were preserved');
}

function connect(io, base, transport, headers) {
  // Deliberately omit extraHeaders for the launcher's default Node connection.
  const socket = io(base, {
    transports: [transport], upgrade: false, reconnection: false,
    forceNew: true, autoConnect: false, timeout: TIMEOUT,
    ...(headers === undefined ? {} : { extraHeaders: headers }),
  });
  return new Promise(resolve => {
    const timer = setTimeout(() => finish({ connected: false, error: 'probe_timeout' }), TIMEOUT + 1000);
    let settled = false;
    function finish(result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ socket, result });
    }
    socket.once('connect', () => finish({ connected: true, transport: socket.io.engine.transport.name }));
    socket.once('connect_error', error => finish({ connected: false, error: error.message,
      description: typeof error.description === 'string' ? error.description : error.description?.message || '',
      status: typeof error.context?.status === 'number' ? error.context.status : null }));
    socket.connect();
  });
}

function deniedRoomList(socket) {
  return new Promise(resolve => {
    socket.timeout(4000).emit('BOARD_ROOM_LIST', {}, (error, value) => resolve(error
      ? { acknowledged: false, error: 'ack_timeout' }
      : { acknowledged: true, ok: value?.ok, error: value?.error || '', downloadUrl: value?.downloadUrl || '',
        // Never persist room contents if the server unexpectedly permits this.
        returnedRoomList: Array.isArray(value?.rooms) }));
  });
}

function rawHandshake(base, transportName, extraHeaders) {
  const target = new URL(`/socket.io/?EIO=4&transport=${transportName}&t=socket-regression`, base);
  const http = require(target.protocol === 'https:' ? 'node:https' : 'node:http');
  return new Promise((resolve, reject) => {
    const headers = { ...extraHeaders };
    if (transportName === 'websocket') Object.assign(headers, {
      Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13',
      'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'),
    });
    const request = http.get(target, { headers });
    request.setTimeout(TIMEOUT, () => request.destroy(new Error('handshake_timeout')));
    request.on('error', reject);
    request.on('upgrade', (response, socket) => { socket.destroy(); resolve({ status: response.statusCode, upgraded: true, bodyBytes: 0, reason: '' }); });
    request.on('response', response => {
      const chunks = []; let length = 0;
      response.on('error', reject);
      response.on('data', chunk => {
        length += chunk.length;
        if (length > 8192) { response.destroy(new Error('handshake_body_too_large')); return; }
        chunks.push(chunk);
      });
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8').trim();
        let reason = text;
        try { const value = JSON.parse(text); reason = value.message || value.error || ''; } catch (_) { /* Upgrade errors are plain text. */ }
        resolve({ status: response.statusCode, upgraded: false, bodyBytes: length,
          // Record only the distribution reason; never handshake session data.
          reason: reason === 'desktop_required' ? reason : 'unexpected_response' });
      });
    });
  });
}

async function main() {
  if (args.includes('--help')) {
    console.log('NODE_PATH=<launcher desktop/node_modules> node scripts/desktop_distribution_socket_verify.js --base <http(s)://origin> --out <report.json or directory>\nEight single-transport Socket.IO connections; four small refusal probes; no retries, login or rooms. Existing reports are preserved.');
    return;
  }
  const url = new URL(arg('--base', 'https://onepiece-card-online.onrender.com'));
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('--base must be a plain HTTP(S) origin');
  const base = url.origin;
  const report = { ok: null, startedAt: new Date().toISOString(), base,
    scope: 'Real Node socket.io-client default launcher headers and Electron-UA compatibility probes. No login/accounts/rooms; only launcher BOARD_ROOM_LIST is emitted and must be denied. This does not test actual Electron UI or account login.',
    retries: 0, cases: [], checks: [], errors: [] };
  const output = reserveReport(path.resolve(arg('--out', 'desktop-distribution-socket-report.json')), report);
  const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  const check = (name, pass, details) => { report.checks.push({ name, pass: !!pass, details }); save(); };
  try {
    let io;
    try { ({ io } = require('socket.io-client')); }
    catch (_) { throw new Error('socket.io-client is unavailable; set NODE_PATH to the installed launcher desktop/node_modules directory'); }
    report.clientModule = require.resolve('socket.io-client');
    for (const transport of ['websocket', 'polling']) {
      const fetchHeaders = { 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': transport === 'websocket' ? 'websocket' : 'cors' };
      const cases = [
        { name: 'launcher-main-default', accepted: true },
        { name: 'electron-renderer-ua', accepted: true, headers: { 'User-Agent': ELECTRON, Origin: base, ...fetchHeaders } },
        { name: 'browser-origin', accepted: false, headers: { 'User-Agent': BROWSER, Origin: base } },
        { name: 'browser-fetch-metadata', accepted: false, headers: { 'User-Agent': BROWSER, ...fetchHeaders } },
      ];
      for (const test of cases) {
        const record = { name: test.name, transport, startedAt: new Date().toISOString(), expectedConnected: test.accepted,
          suppliedHeaders: test.headers || null, headerMode: test.headers ? 'explicit compatibility probe' : 'default socket.io-client; extraHeaders omitted' };
        report.cases.push(record);
        let socket;
        try {
          const opened = await connect(io, base, transport, test.headers);
          socket = opened.socket; record.connection = opened.result;
          if (test.accepted) {
            check(`${test.name} ${transport} connects`, record.connection.connected && record.connection.transport === transport, record.connection);
            if (test.name === 'launcher-main-default') {
              record.roomListAck = record.connection.connected ? await deniedRoomList(socket) : { acknowledged: false, error: 'not_connected' };
              check(`launcher main ${transport} cannot use game events`, record.roomListAck.acknowledged && record.roomListAck.ok === false
                && record.roomListAck.error === 'desktop_required' && !record.roomListAck.returnedRoomList, record.roomListAck);
            }
          } else {
            record.handshake = await rawHandshake(base, transport, test.headers);
            check(`${test.name} ${transport} rejected explicitly`, !record.connection.connected && record.connection.error !== 'probe_timeout'
              && !record.handshake.upgraded && [400, 403].includes(record.handshake.status) && record.handshake.reason === 'desktop_required',
            { connection: record.connection, handshake: record.handshake });
          }
        } catch (error) {
          record.error = error.message;
          check(`${test.name} ${transport} completes`, false, { error: error.message });
        } finally {
          // Each probe owns a forceNew manager; disconnect closes its transport.
          if (socket) { socket.disconnect(); socket.removeAllListeners(); }
          record.finishedAt = new Date().toISOString(); save();
        }
      }
    }
  } catch (error) { report.errors.push(error.stack || String(error)); }
  finally {
    report.finishedAt = new Date().toISOString();
    report.ok = report.errors.length === 0 && report.checks.length === 10 && report.checks.every(item => item.pass);
    save();
    console.log(JSON.stringify({ ok: report.ok, base, total: report.checks.length, cases: report.cases.length,
      failures: report.checks.filter(item => !item.pass), errors: report.errors, output }, null, 2));
    process.exitCode = report.ok ? 0 : 1;
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
