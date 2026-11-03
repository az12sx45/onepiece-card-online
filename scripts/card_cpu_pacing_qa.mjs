import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import fs from 'node:fs';
import {createRequire, Module} from 'node:module';
import net from 'node:net';
import path from 'node:path';
import {setTimeout as wait} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';

const filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(filename), '..');
const serverEntry = path.join(root, 'server/index.js');
const require = createRequire(serverEntry);
const fixtureSource = String.raw`
process.on('message', ({key, type, roomId, fixture}) => {
  try {
    if (!roomId.startsWith('QA-CPU-PACING-')) throw Error('isolated QA room required');
    const room = rooms.get(roomId);
    if (!room) throw Error('QA room not joined');
    if (type === 'seed') {
      const seats = new Map(room.state.players.map(p => [p.id, p]));
      const st = createInitialState(4);
      st.roundNo = fixture === 'fallback' ? 702 : 701;
      st.turnIndex = 2;
      st.turnStep = ['fallback','kata','roger'].includes(fixture) ? 'choose' : 'draw';
      st.venues = [{name:'西羅布村'}];
      st.deck = [2, 12, 8, 13, 14, 6, 15, 10, 9];
      st.discard = [16];
      st.log = [];
      for (const p of st.players) {
        if (p.id < 2) {
          const old = seats.get(p.id);
          if (!old || !old.secret) throw Error('QA needs two joined real human seats');
          Object.assign(p, {client:old.client, displayName:old.displayName, avatar:old.avatar, secret:old.secret});
        } else {
          p.isCPU = true;
        }
        p.alive = true;
        p.hand = [1, 2, 0, 3][p.id];
        p.tempDraw = null;
        p.frozen = false;
      }
      if (fixture === 'frozen') st.players[2].frozen = true;
      if (fixture === 'fallback') Object.assign(st.players[2], {hand:6,tempDraw:7});
      if (fixture === 'kata') {
        st.pending = {action:'kata-order', n:3, cards:[11,14,18]};
        st.deck = [2, 12, 8, 13, 6, 15, 18, 14, 11];
      }
      if (fixture === 'roger') {
        st.venues = [{name:'奧羅傑克森號'}];
        st.pending = {action:'roger',caster:1};
      }
      room.state = st;
      room.phase = 'playing';
      room._cpuFastForward = false;
      room._presentationReady = null;
      room._venueReady = null;
      if (fixture === 'venue') cardVenueReady.begin(room);
      else if (fixture !== 'fallback') cardPresentationReady.begin(room);
      broadcastState(room);
      runCpuLoop(roomId);
    }
    const st = room.state;
    process.send({key, value:{step:st.turnStep, turn:st.turnIndex,
      deckTail:st.deck.slice(-3), discard:st.discard.slice(), pending:st.pending?.action ?? null,
      rejected:st.log.filter(line=>line.includes('必須打 7') || line.includes('只能打剛抽')).length,
      cpuTimer:!!room._cpuLoopTimer}});
  } catch (error) {
    process.send({key,error:error.message});
  }
});
`;

if (process.argv.includes('--fixture-server')) {
  // Test-only bad advice exercises the engine's normal rejection path.
  const cpu = require('./cpu.js');
  const choose = cpu.pickCpuCardSmart;
  cpu.pickCpuCardSmart = (st, playerId) => st.roundNo === 702 ? 'hand' : choose(st, playerId);
  // Load the exact production entry point; append only local fixture IPC.
  const mod = new Module(serverEntry);
  mod.filename = serverEntry;
  mod.paths = Module._nodeModulePaths(path.dirname(serverEntry));
  mod._compile(fs.readFileSync(serverEntry, 'utf8') + '\n' + fixtureSource, serverEntry);
} else {
  const out = process.env.CARD_CPU_PACING_REPORT || 'D:/Codex_QA/card-cpu-pacing-20261104/report.json';
  const tracked = ['server/index.js','server/engine.js','server/cpu.js','server/card_presentation_ready.js','server/card_venue_ready.js'];
  const sourceHashes = () => Object.fromEntries(tracked.map(relative => [relative,
    createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex')]));
  const report = {
    scope:'Local production server entry and engine over two independent real Socket.IO guest connections, with isolated deterministic fixture state. No production accounts, browser visibility, or physical-device claims.',
    sourceSHA256:sourceHashes(), checks:[], passed:false,
  };
  let child;
  const clients = [];
  const check = (name, ok, detail) => {
    report.checks.push({name,ok:!!ok,...(detail === undefined ? {} : {detail})});
    assert.ok(ok, name + (detail === undefined ? '' : ': ' + JSON.stringify(detail)));
  };
  const until = async (name, condition, timeout = 2500) => {
    const end = performance.now() + timeout;
    do {
      const value = condition();
      if (value) return value;
      await wait(10);
    } while (performance.now() < end);
    throw Error(name + ' timed out');
  };
  const choosePort = async () => {
    const probe = net.createServer().listen(0,'127.0.0.1');
    await once(probe,'listening');
    const {port} = probe.address();
    await new Promise((resolve,reject) => probe.close(error => error ? reject(error) : resolve()));
    return port;
  };
  try {
    const port = await choosePort();
    // Socket.IO's own Engine.IO dependency provides the WebSocket wire client.
    const socketIoRequire = createRequire(require.resolve('socket.io'));
    const engineRequire = createRequire(socketIoRequire.resolve('engine.io'));
    const WebSocket = engineRequire('ws');
    let listening = false, logs = '';
    child = spawn(process.execPath,[filename,'--fixture-server'],{
      cwd:root,windowsHide:true,env:{...process.env,DATABASE_URL:'',PORT:String(port)},
      stdio:['ignore','pipe','pipe','ipc'],
    });
    const capture = bytes => {
      logs = (logs + String(bytes)).slice(-2000);
      if (logs.includes('Server listening on')) listening = true;
    };
    child.stdout.on('data',capture);
    child.stderr.on('data',capture);
    await until('production server listens',() => {
      if (child.exitCode !== null) throw Error('Fixture server failed to start: '+logs);
      return listening;
    },10000);
    check('production entrypoint starts locally',listening);
    let request = 0;
    const rpc = (type, roomId, fixture) => new Promise((resolve,reject) => {
      const key = ++request;
      const timeout = setTimeout(() => { child.off('message', receive); reject(Error(type + ' IPC timed out')); },2000);
      const receive = result => {
        if (result?.key !== key) return;
        clearTimeout(timeout);
        child.off('message',receive);
        if (result.error) reject(Error(result.error));
        else resolve(result.value);
      };
      child.on('message',receive);
      child.send({key,type,roomId,fixture});
    });
    async function connect(roomId, displayName, resume) {
      const socket = new WebSocket('ws://127.0.0.1:'+port+'/socket.io/?EIO=4&transport=websocket',{
        headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/144.0.0.0 Safari/537.36 Electron/44.1.1'},
      });
      const client = {socket,state:null,identity:null,connected:false,events:[],error:null};
      clients.push(client);
      const send = (event,payload) => socket.send('42'+JSON.stringify([event,payload]));
      client.action = (type,payload) => send('ACTION',{roomId,...client.identity,type,payload});
      client.ack = (gate,type='PRESENTATION_READY',payload={}) => client.action(type,{id:gate.id,roundNo:gate.roundNo,...payload});
      client.close = async () => {
        if (socket.readyState === WebSocket.CLOSED) return;
        const closed = new Promise(resolve => socket.once('close',resolve));
        socket.close();
        await closed;
      };
      socket.on('error',error => {client.error = error;});
      socket.on('message',buffer => {
        const packet = buffer.toString();
        if (packet.startsWith('0')) socket.send('40');
        else if (packet.startsWith('2')) socket.send('3'+packet.slice(1));
        else if (packet.startsWith('40')) client.connected = true;
        else if (packet.startsWith('42')) {
          const [event,value] = JSON.parse(packet.slice(2));
          if (event === 'JOINED') client.identity = value;
          if (event === 'STATE') client.state = value;
          if (event === 'EMIT') client.events.push(value);
        }
      });
      await until('Socket.IO connect',() => {if (client.error) throw client.error;return client.connected;});
      send('JOIN_ROOM',{roomId,displayName,...(resume ? {pid:resume.playerId,secret:resume.secret,resumeOnly:true} : {})});
      await until('guest JOINED and STATE',() => client.identity && client.state);
      return client;
    }
    async function room(fixture) {
      const roomId = 'QA-CPU-PACING-'+fixture+'-'+Date.now();
      const a = await connect(roomId,'Pacing A');
      const b = await connect(roomId,'Pacing B');
      check(fixture+': two independent joined human seats',a.identity.playerId === 0 && b.identity.playerId === 1);
      await rpc('seed',roomId,fixture);
      await until('fixture broadcast to both humans',() => a.state?.roundNo >= 701 && b.state?.roundNo >= 701);
      return {a,b,roomId};
    }
    const sameWaiting = (state, gate, key = 'presentationReady') => state?.[key]?.id === gate.id && state[key].waiting;
    const rounded = start => Math.round(performance.now()-start);

    {
      const {a,b,roomId} = await room('frozen');
      const gate = a.state.presentationReady;
      check('frozen: no CPU pacing timer while presentation is pending',!(await rpc('snapshot',roomId)).cpuTimer);
      a.ack(gate);
      await until('first ACK recorded',() => a.state.presentationReady?.ready.length === 1);
      b.ack(gate,'PRESENTATION_READY',{id:'stale-gate-id'});
      await wait(5200);
      check('slow connected reader and stale ACK block CPU even after 5 seconds',
        sameWaiting(a.state,gate) && a.state.presentationReady.ready.length === 1 && a.state.turnStep === 'draw');
      check('CPU did not queue a competing timer during the wait',!(await rpc('snapshot',roomId)).cpuTimer);
      const first = performance.now();
      b.ack(gate);
      await until('CPU draws after final actual ACK',() => a.state.turnStep === 'choose',1600);
      check('CPU draw follows final ACK promptly',rounded(first) < 1500,{ms:rounded(first)});
      check('draw/hand stays private from both humans',a.state.players[2].hand === null && b.state.players[2].tempDraw === null);
      const drawGate = a.state.presentationReady;
      check('the CPU draw opens its own gate',drawGate?.waiting && drawGate.id !== gate.id);
      a.ack(drawGate);
      await wait(650);
      check('one draw ACK cannot expose CPU played card',sameWaiting(a.state,drawGate) && a.state.discard.length === 1);
      const second = performance.now();
      b.ack(drawGate);
      await until('frozen CPU legally plays the drawn card',() => a.state.discard[1] === 9,1600);
      const snap = await rpc('snapshot',roomId);
      check('frozen CPU plays drawn 9 promptly with no invalid hand attempt',
        snap.discard[1] === 9 && snap.rejected === 0 && rounded(second) < 1500,{ms:rounded(second),card:snap.discard[1],rejected:snap.rejected});
      await a.close(); await b.close();
    }
    {
      const {a,b,roomId} = await room('fallback');
      await until('real mandatory Nami rejection',() => a.state.log.some(line => line.includes('必須打 7')));
      const gate = a.state.presentationReady;
      check('the rejection itself is presented before alternative play',gate?.waiting && a.state.turnStep === 'choose');
      a.ack(gate);
      await wait(600);
      const snapshot = await rpc('snapshot',roomId);
      check('CPU does not bypass the rejection ACK barrier',sameWaiting(a.state,gate) && snapshot.rejected === 1 && snapshot.discard.length === 1);
      const start = performance.now();
      b.ack(gate);
      await until('CPU tries one legal alternative after ACK',() => a.state.discard.length === 2,1600);
      const after = await rpc('snapshot',roomId);
      check('fallback plays required card 7 without another rejection',after.discard.at(-1) === 7 && after.rejected === 1,{ms:rounded(start),card:after.discard.at(-1),rejected:after.rejected});
      await a.close(); await b.close();
    }
    {
      const {a,b,roomId} = await room('kata');
      const gate = a.state.presentationReady;
      a.ack(gate);
      b.ack(gate);
      await until('CPU Katakuri sort resolves',() => !a.state.pending,1600);
      const after = await rpc('snapshot',roomId);
      check('Katakuri preserves actual top cards and order',JSON.stringify(after.deckTail) === '[18,14,11]',after.deckTail);
      await a.close(); await b.close();
    }
    {
      const {a,b,roomId} = await room('roger');
      const gate = a.state.presentationReady;
      a.ack(gate);
      b.ack(gate);
      await until('prior broadcast gate released',() => !a.state.presentationReady?.waiting);
      await wait(900);
      check('CPU turn owner cannot predict for a human discarded Roger',
        a.state.turnIndex === 2 && a.state.pending?.caster === 1 && !a.state.rogerPred &&
        !(await rpc('snapshot',roomId)).cpuTimer);
      b.action('PICK_TARGET',{target:0});
      await until('human holder resolves their own Roger',() => !a.state.pending && a.state.rogerPred?.by === 1);
      check('human Roger choice remains accepted and authoritative',a.state.rogerPred?.pick === 0);
      await a.close(); await b.close();
    }
    {
      const {a,b,roomId} = await room('venue');
      const gate = a.state.venueReady;
      a.ack(gate,'VENUE_READY');
      await wait(550);
      check('venue waits for final human independently of presentation',sameWaiting(a.state,gate,'venueReady') && a.state.turnStep === 'draw' && !(await rpc('snapshot',roomId)).cpuTimer);
      const start = performance.now();
      b.ack(gate,'VENUE_READY');
      await until('final venue ACK resumes CPU',() => a.state.turnStep === 'choose',1600);
      check('final venue ACK releases to short CPU beat',rounded(start) < 1500,{ms:rounded(start)});
      await a.close(); await b.close();
    }
    {
      const {a,b,roomId} = await room('reconnect');
      const gate = a.state.presentationReady;
      a.ack(gate);
      await until('reconnect: first ACK',() => a.state.presentationReady?.ready.length === 1);
      await b.close();
      await until('reconnect: second seat marked offline',() => a.state.players[1]?.offline);
      const returned = await connect(roomId,'Pacing B',b.identity);
      check('same human seat reconnects to same gate without advancing CPU',
        returned.identity.playerId === b.identity.playerId && sameWaiting(returned.state,gate) && returned.state.turnStep === 'draw');
      returned.ack(gate);
      await until('reconnected last reader ACK resumes CPU',() => a.state.turnStep === 'choose',1600);
      check('reconnected final reader ACK releases barrier',a.state.turnStep === 'choose');
      await a.close(); await returned.close();
    }
    {
      const {a,b,roomId} = await room('offline');
      const gate = a.state.presentationReady;
      a.ack(gate);
      await until('offline: first ACK',() => a.state.presentationReady?.ready.length === 1);
      const start = performance.now();
      await b.close();
      await until('disconnected seat marked offline',() => a.state.players[1]?.offline);
      await wait(1300);
      check('disconnected human remains required during grace',sameWaiting(a.state,gate) &&
        a.state.presentationReady.required.includes(1) && a.state.turnStep === 'draw' && !(await rpc('snapshot',roomId)).cpuTimer);
      await until('real offline grace + CPU take-over releases barrier',() => a.state.turnStep === 'choose',9500);
      check('existing offline takeover releases gate after grace and resumes CPU',
        a.state.players[1].isCPU && rounded(start) >= 7900 && rounded(start) < 10000,{ms:rounded(start)});
      await a.close();
    }
    check('production source hashes stable throughout QA',JSON.stringify(report.sourceSHA256) === JSON.stringify(sourceHashes()));
    report.passed = true;
  } catch (error) {
    report.error = error.message;
    process.exitCode = 1;
  } finally {
    for (const {socket} of clients) socket.terminate();
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child,'exit');
      child.kill();
      await exited;
    }
    fs.mkdirSync(path.dirname(out),{recursive:true});
    fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,error:report.error,report:out}));
  }
}