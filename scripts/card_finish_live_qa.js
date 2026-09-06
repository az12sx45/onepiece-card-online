'use strict';

// Real two-account Card Finish smoke test. Credentials are accepted only through
// stdin JSON or environment variables and are never written to reports/logs.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const base = new URL(process.env.CARD_QA_URL || 'https://onepiece-card-online.onrender.com');
const mode = String(process.env.CARD_QA_MODE || 'candidate').toLowerCase();
const chrome = process.env.CARD_QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const hits = { game: 0, css: 0, js: 0 };
const report = {
  result: 'FAIL', mode, roomsCreated: 0,
  coverage: { hand: false, drawn: false, peerSync: false, finishHooks: false, naturalDisabledSeen: false, choiceDisabledBlocked: false, choiceDisabledReason: null },
  routeHits: hits, actions: [], milestones: [], browserErrors: { page: 0, console: 0, categories: [] }
};
let currentStage = 'config';
let browser;
const contexts = [];
const pages = [];
let ownedRoom = '';

class QAError extends Error {
  constructor(code, detail) { super(code); this.code = code; this.stage = currentStage; this.detail = detail || null; }
}
const fail = (code, detail) => { throw new QAError(code, detail); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function credentials() {
  let raw = process.env.CARD_QA_ACCOUNTS_JSON || '';
  if (!raw && process.env.CARD_QA_USER_1 && process.env.CARD_QA_PASSWORD_1 && process.env.CARD_QA_USER_2 && process.env.CARD_QA_PASSWORD_2) {
    return [1, 2].map(n => ({ username: process.env[`CARD_QA_USER_${n}`], password: process.env[`CARD_QA_PASSWORD_${n}`] }));
  }
  if (!raw && !process.stdin.isTTY) {
    raw = await new Promise((resolve, reject) => {
      let value = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', chunk => { value += chunk; if (value.length > 65536) reject(new QAError('CREDENTIAL_INPUT_TOO_LARGE')); });
      process.stdin.on('end', () => resolve(value));
      process.stdin.on('error', reject);
    });
  }
  let parsed;
  try { parsed = JSON.parse(raw); } catch { fail('CREDENTIALS_REQUIRED'); }
  const list = Array.isArray(parsed) ? parsed : parsed?.accounts;
  if (!Array.isArray(list) || list.length !== 2 || list.some(x => !x || typeof x.username !== 'string' || typeof x.password !== 'string')) fail('TWO_ACCOUNTS_REQUIRED');
  if (list[0].username === list[1].username) fail('ACCOUNTS_MUST_DIFFER');
  return list.map(x => ({ username: x.username, password: x.password }));
}

function contentType(file) {
  return ({ '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'application/javascript; charset=utf-8' })[path.extname(file)] || 'application/octet-stream';
}
async function installRoutes(context) {
  const map = new Map([
    ['/game.html', ['game', path.join(publicDir, 'game.html')]],
    ['/css/card-finish-v1.css', ['css', path.join(publicDir, 'css/card-finish-v1.css')]],
    ['/js/card_finish_v1.js', ['js', path.join(publicDir, 'js/card_finish_v1.js')]]
  ]);
  await context.route('**/*', async route => {
    let url;
    try { url = new URL(route.request().url()); } catch { return route.continue(); }
    if (url.origin === base.origin && /^\/(images|audio|videos|fonts)\//.test(url.pathname) && process.env.CARD_QA_MEDIA_URL) {
      const headers = {}; const range = route.request().headers().range; if (range) headers.range = range;
      const response = await route.fetch({ url: process.env.CARD_QA_MEDIA_URL + url.pathname + url.search, headers });
      return route.fulfill({ response });
    }
    if (mode !== 'candidate') return route.continue();
    if (url.origin !== base.origin || !map.has(url.pathname)) return route.continue();
    const [key, file] = map.get(url.pathname);
    hits[key]++;
    return route.fulfill({ status: 200, contentType: contentType(file), body: fs.readFileSync(file) });
  });
}

async function snapshot(page) {
  return page.evaluate(() => {
    if (typeof state === 'undefined' || typeof me === 'undefined' || !state || me.playerId == null) return null;
    const own = state.players?.[me.playerId] || {};
    const idOf = value => typeof value === 'number' ? value : (value && typeof value.id === 'number' ? value.id : null);
    return {
      playerId: me.playerId, roundNo: state.roundNo, turnIndex: state.turnIndex, turnStep: state.turnStep,
      deckCount: Array.isArray(state.deck) ? state.deck.length : null,
      discardCount: Array.isArray(state.discard) ? state.discard.length : null,
      discard: Array.isArray(state.discard) ? state.discard.map(idOf) : [],
      lastDiscard: idOf(state.discard?.[state.discard.length - 1]), chestLeft: state.chestLeft,
      pending: state.pending ? { action: String(state.pending.action || ''), target: Number.isInteger(state.pending.target) ? state.pending.target : null, firstDone: !!state.pending.extra?.firstDone, boosted: !!state.pending.extra?.boost } : null,
      own: { alive: !!own.alive, hand: Number.isInteger(own.hand) ? own.hand : null, tempDraw: Number.isInteger(own.tempDraw) ? own.tempDraw : null, frozen: !!own.frozen },
      players: (state.players || []).map(p => ({ id:p.id, alive:!!p.alive, frozen:!!p.frozen, handHidden:p.id===me.playerId ? null : p.hand==null, tempDrawHidden:p.id===me.playerId ? null : p.tempDraw==null }))
    };
  });
}
const publicKey = s => JSON.stringify(s && ({ roundNo:s.roundNo, turnIndex:s.turnIndex, turnStep:s.turnStep, deckCount:s.deckCount, discardCount:s.discardCount, chestLeft:s.chestLeft, pending:s.pending, players:s.players.map(p=>({id:p.id,alive:p.alive,frozen:p.frozen})) }));
// Teach's covered cards may legitimately be hidden from one observer.
const visibleDiscardsAgree = (a, b) => a.length === b.length && a.every((id, i) => id == null || b[i] == null || id === b[i]);
function isKidReplay(before, after, which) {
  const played = which === 'hand' ? before.own.hand : before.own.tempDraw;
  const kept = which === 'hand' ? before.own.tempDraw : before.own.hand;
  if (played !== 11 || after.roundNo !== before.roundNo || after.turnIndex !== before.turnIndex ||
      after.turnIndex !== after.playerId || after.turnStep !== 'choose' || after.pending ||
      !after.own.alive || after.own.hand !== kept || !Number.isInteger(after.own.tempDraw) ||
      after.own.tempDraw === 11 || after.deckCount !== before.deckCount ||
      after.discardCount !== before.discardCount || after.lastDiscard !== 11) return false;
  // Ordinary Kid appends 11, removes one prior non-Kid discard, and returns it
  // as tempDraw. The pile length therefore stays unchanged on a successful play.
  return before.discard.some((id, i) => {
    if (id != null && id !== after.own.tempDraw) return false;
    const expected = before.discard.slice();
    expected.splice(i, 1); expected.push(11);
    return visibleDiscardsAgree(expected, after.discard);
  });
}
function playAcknowledged(before, after, which) {
  const played = which === 'hand' ? before.own.hand : before.own.tempDraw;
  return (after.discardCount > before.discardCount && after.discard.slice(before.discardCount).includes(played)) ||
    isKidReplay(before, after, which);
}
const hasSinglePlay = (beforeCount, sent, which) => sent.length === beforeCount + 1 && sent[sent.length - 1]?.which === which;
async function waitSnapshot(page, predicate, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const s = await snapshot(page); if (s && predicate(s)) return s; await sleep(100); }
  fail('STATE_TIMEOUT');
}
async function waitPeerSync() {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    const pair = await Promise.all(pages.map(snapshot));
    if (pair.every(Boolean) && publicKey(pair[0]) === publicKey(pair[1]) &&
        visibleDiscardsAgree(pair[0].discard, pair[1].discard)) return pair;
    await sleep(100);
  }
  fail('PEER_SYNC_TIMEOUT');
}

async function physicalClick(page, locator, timeout = 9000, allowDisabled = false) {
  locator = locator.first();
  const end = Date.now() + timeout;
  let last = null;
  while (Date.now() < end) {
    if (await locator.count()) {
      last = await locator.evaluate(el => {
        el.scrollIntoView({ block:'center', inline:'center', behavior:'instant' });
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        const x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y);
        const overlays = ['drawOverlay','playedOverlay','enhOverlay','coinOverlay','rewardModal','rewardOverlay','finalOverlay','modal','luffyBoostModal','lawSwapModal','autoTakeoverBanner'].filter(id => {
          const n=document.getElementById(id); if(!n) return false; const q=n.getBoundingClientRect(), c=getComputedStyle(n); return c.display!=='none' && c.visibility!=='hidden' && Number(c.opacity)!==0 && q.width>0 && q.height>0;
        });
        return { visible:r.width>0&&r.height>0&&cs.display!=='none'&&cs.visibility!=='hidden', disabled:!!el.disabled, hit:!!top&&(top===el||el.contains(top)), x, y, top:top?{tag:top.tagName,id:top.id||'',class:String(top.className||'').slice(0,120)}:null, overlays };
      }).catch(() => null);
      if (last?.visible && (allowDisabled || !last.disabled) && last.hit) { await page.mouse.click(last.x, last.y); return last; }
    }
    await sleep(100);
  }
  fail('CONTROL_NOT_ACTIONABLE', last);
}

async function login(page, account) {
  currentStage = 'login';
  await page.goto(new URL('/start.html', base).href, { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForFunction(() => typeof window.__stageNow === 'string', null, { timeout:60000 });
  if (await page.evaluate(() => window.__stageNow === 'press')) await page.keyboard.press('Enter');
  await page.waitForFunction(() => ['auth','boot','menu','profileCloud'].includes(window.__stageNow), null, { timeout:30000 });
  if (await page.evaluate(() => window.__stageNow === 'auth')) {
    await page.locator('input[placeholder*="帳號"]').fill(account.username);
    await page.locator('input[type="password"]').fill(account.password);
    await page.locator('input[type="password"]').press('Enter');
  }
  await page.waitForFunction(() => ['menu','profileCloud'].includes(window.__stageNow), null, { timeout:45000 }).catch(() => fail('AUTH_FAILED'));
  if (await page.evaluate(() => window.__stageNow === 'profileCloud')) fail('PROFILE_REQUIRED');
  const saved = await page.evaluate(() => localStorage.getItem('op_last_password'));
  if (saved) fail('PASSWORD_PERSISTED');
}

async function enterChoice(page) {
  if (!await page.evaluate(() => window.__stageNow === 'menu')) fail('MENU_NOT_READY');
  await physicalClick(page, page.getByRole('button', { name:/開始遊戲|Start Game/i }));
  await page.waitForFunction(() => window.__stageNow === 'choice', null, { timeout:10000 });
}

async function createAndStartRoom() {
  currentStage = 'lobby';
  await Promise.all(pages.map(enterChoice));
  await physicalClick(pages[0], pages[0].locator('.grid.grid-cols-4.gap-2 button').first());
  await physicalClick(pages[0], pages[0].getByRole('button', { name:/建立新房間|Create New Room/i }));
  await pages[0].waitForFunction(() => window.__stageNow === 'waiting' && typeof __lobby !== 'undefined' && !!__lobby.roomId, null, { timeout:12000 });
  ownedRoom = await pages[0].evaluate(() => String(__lobby.roomId));
  report.roomsCreated = 1;
  await pages[1].locator('input[maxlength="8"]').fill(ownedRoom);
  await physicalClick(pages[1], pages[1].getByRole('button', { name:/加入房間|Join Room/i }));
  await Promise.all(pages.map(p => p.waitForFunction(() => window.__stageNow === 'waiting' && __lobby.snapshot?.players?.length === 2, null, { timeout:15000 })));
  for (const page of pages) await physicalClick(page, page.locator('.lobby-player button'));
  await pages[0].waitForFunction(() => __lobby.snapshot?.players?.length === 2 && __lobby.snapshot.players.every(p => p.ready), null, { timeout:10000 });
  await physicalClick(pages[0], pages[0].getByRole('button', { name:/開始遊戲|Start Game/i }));
  await Promise.all(pages.map(p => p.waitForURL(/\/game\.html(?:\?|$)/, { timeout:30000 })));
  await Promise.all(pages.map(p => p.waitForFunction(() => typeof state !== 'undefined' && state && typeof me !== 'undefined' && me.playerId != null, null, { timeout:30000 })));
  const hooks = await Promise.all(pages.map(p => p.evaluate(() => ({ finishes:document.querySelectorAll('#myPlayZone [data-card-finish]').length, faces:document.querySelectorAll('#myPlayZone .card-finish-face').length }))));
  report.coverage.finishHooks = hooks.every(x => x.finishes === 2 && x.faces === 2);
  if (!report.coverage.finishHooks) fail('FINISH_HOOKS_MISSING');
  await waitPeerSync();
  await Promise.all(pages.map(page => page.evaluate(() => {
    window.__finishActions=[];
    socket.onAnyOutgoing((event,data)=>{if(event==='ACTION') window.__finishActions.push({type:data.type,which:data.payload?.which});});
  })));
}

async function pendingStep() {
  const pair = await waitPeerSync(), pending = pair[0].pending;
  if (!pending) return false;
  const responder = (pending.action === 'queen' || pending.action === 'bigmom-pay') ? pending.target : pair[0].turnIndex;
  const index = pair.findIndex(x => x.playerId === responder);
  if (index < 0) fail('PENDING_RESPONDER_MISSING');
  const page = pages[index];
  currentStage = `pending:${pending.action}`;
  let locator, type;
  if (pending.action === 'luffy-boost') { locator=page.locator('#luffyBoostGo:not(.hidden)'); type='LUFFY_BOOST_COMMIT'; }
  else if (pending.action === 'bigmom-pay') { locator=(await page.locator('#payBtn:not([disabled])').count())?page.locator('#payBtn'):page.locator('#dieBtn'); type='BIGMOM_CHOICE'; }
  else if (pending.action === 'queen') { locator=page.locator('#okBtn'); type='QUEEN_COIN'; }
  else if (pending.action === 'bigmom-coin') { locator=page.locator('#okBtn'); type='BIGMOM_COIN'; }
  else if (pending.action === 'kata-order') { locator=page.locator('#okOrder'); type='ORDER_COMMIT'; }
  else if (pending.action === 'teach-multipick') {
    const first=page.locator('#modal input[type="checkbox"]').first(); if(await first.count()) await physicalClick(page, first);
    locator=page.locator('#okM'); type='MULTIPICK_COMMIT';
  } else if (pending.action === 'usopp' && await page.locator('#modal button[data-d]').count()) {
    const banned=page.locator('#modal button[data-d="1"]');
    if(await banned.count() && await banned.isDisabled()) { const before=publicKey(await snapshot(page)); await physicalClick(page,banned,3000,true); await sleep(250); if(publicKey(await snapshot(page))!==before) fail('DISABLED_DIGIT_CHANGED_STATE'); report.coverage.naturalDisabledSeen=true; }
    locator=page.locator('#modal button[data-d]:not([disabled])').filter({hasNotText:/^1$/}).first(); type='PICK_DIGIT';
  } else if (pending.action === 'luffy' && pending.firstDone && await page.locator('#btnCancel').count()) { locator=page.locator('#btnCancel'); type='LUFFY_SECOND'; }
  else if ((pending.action === 'law' || pending.action === 'killer') && await page.locator('#noBtn').count()) { locator=page.locator('#noBtn'); type='PICK_CANCEL'; }
  else { locator=page.locator('#modal button[data-i]:not([disabled])').first(); type='PICK_TARGET'; }
  await physicalClick(page, locator);
  report.actions.push({ actor:index, type });
  await sleep(350);
  return true;
}

async function resolvePending() {
  for (let i=0;i<12;i++) {
    const pair=await waitPeerSync(); if(!pair[0].pending) return;
    await pendingStep();
  }
  fail('PENDING_STEP_LIMIT');
}

async function playTurn(which) {
  const pair = await waitPeerSync();
  const index = pair.findIndex(x => x.playerId === pair[0].turnIndex);
  if (index < 0 || !['draw','choose'].includes(pair[0].turnStep) || pair[0].pending) fail('EXPECTED_HUMAN_DRAW_OR_CHOICE');
  const page=pages[index], observer=pages[1-index];
  if (pair[0].turnStep === 'draw') {
    currentStage=`draw:${which}`;
    await physicalClick(page,page.locator('#btnDraw'));
  }
  const chosen=await waitSnapshot(page,s=>s.turnStep==='choose'&&s.turnIndex===s.playerId&&s.own.tempDraw!=null,12000);
  const observerState=await waitSnapshot(observer,s=>s.roundNo===chosen.roundNo&&s.turnIndex===chosen.turnIndex&&s.turnStep==='choose',8000);
  const actorSeen=observerState.players.find(p=>p.id===chosen.playerId);
  if(!actorSeen?.handHidden||!actorSeen?.tempDrawHidden) fail('PRIVATE_CARD_LEAK');
  const disabled = await page.evaluate(() => ({ hand:document.querySelector('#playHand')?.disabled===true, drawn:document.querySelector('#playDrawn')?.disabled===true }));
  if(disabled.hand||disabled.drawn) {
    report.coverage.naturalDisabledSeen=true;
    const banned=disabled.hand?'hand':'drawn';
    const count=await page.evaluate(()=>window.__finishActions.length);
    const before=publicKey(await snapshot(page));
    await physicalClick(page,page.locator(banned==='hand'?'#playHand':'#playDrawn'),9000,true);
    await sleep(250);
    if(await page.evaluate(()=>window.__finishActions.length)!==count || publicKey(await snapshot(page))!==before) fail('DISABLED_CHOICE_SENT_ACTION');
    report.coverage.choiceDisabledBlocked=true;
    report.coverage.choiceDisabledReason=chosen.own.frozen?'aokiji-frozen':'nami-7-plus-6-or-8';
    which=disabled.hand?'drawn':'hand';
  } else if(process.env.CARD_QA_MORE_TURNS) {
    const weight={16:100,7:90,4:80,10:70,15:60,2:50,1:30,8:-50,9:-100,19:-30};
    const h=weight[chosen.own.hand]||0,d=weight[chosen.own.tempDraw]||0;
    if(h!==d) which=h>d?'hand':'drawn';
  }
  if(!disabled.hand&&!disabled.drawn&&(which==='hand'?chosen.own.hand:chosen.own.tempDraw)===9) which=which==='hand'?'drawn':'hand';
  const played=which==='hand'?chosen.own.hand:chosen.own.tempDraw;
  currentStage=`play:${which}`;
  const sentBefore=await page.evaluate(()=>window.__finishActions.filter(x=>x.type==='PLAY_CARD').length);
  await physicalClick(page,page.locator(which==='hand'?'#playHand':'#playDrawn'));
  if(played===11 && await page.locator('#kidDo').count()) await physicalClick(page,page.locator('#kidDo'));
  await waitSnapshot(page,s=>playAcknowledged(chosen,s,which),9000);
  const sent=await page.evaluate(()=>window.__finishActions.filter(x=>x.type==='PLAY_CARD'));
  if(!hasSinglePlay(sentBefore,sent,which)) fail('PLAY_EVENT_COUNT_OR_SLOT');
  report.actions.push({actor:index,type:'PLAY_CARD',which,card:played});
  report.coverage[which]=true;
  await waitPeerSync();
  await resolvePending();
  const after=(await waitPeerSync())[0];
  report.milestones.push({ roundNo:after.roundNo, turnIndex:after.turnIndex, turnStep:after.turnStep, deckCount:after.deckCount, discardCount:after.discardCount, chestLeft:after.chestLeft, pending:after.pending?.action||null });
}

async function cleanup() {
  if (ownedRoom) {
    try { await pages[0].evaluate(roomId => new Promise(resolve => {
      if(typeof socket==='undefined'||typeof me==='undefined'||me.roomId!==roomId) return resolve();
      socket.timeout(2500).emit('ROOM_FINISHED',{roomId,secret:me.secret},()=>resolve());
    }),ownedRoom); } catch {}
    for (const page of pages) {
      try { await page.evaluate(roomId => new Promise(resolve => {
        if (typeof socket === 'undefined' || typeof me === 'undefined' || me.roomId !== roomId) return resolve();
        const done=()=>resolve(); const timer=setTimeout(done,2500);
        socket.emit('LEAVE_ROOM',{roomId,playerId:me.playerId,secret:me.secret},()=>{clearTimeout(timer);done();});
      }), ownedRoom); } catch {}
    }
  }
  for (const context of contexts) { try { await context.close(); } catch {} }
  try { if(browser) await browser.close(); } catch {}
}

async function saveFailure(error) {
  const dir=path.join(root,'artifacts/card-finish-v1',`live-qa-failure-${new Date().toISOString().replace(/[:.]/g,'-')}`);
  fs.mkdirSync(dir,{recursive:true});
  for(let i=0;i<pages.length;i++) try { await pages[i].evaluate(()=>document.querySelectorAll('input[type="password"]').forEach(el=>{el.value='';el.removeAttribute('value');})); await pages[i].screenshot({path:path.join(dir,`page-${i+1}.png`),fullPage:false}); } catch {}
  const states=[]; for(const page of pages) try { states.push(await snapshot(page)); } catch { states.push(null); }
  fs.writeFileSync(path.join(dir,'failure-summary.json'),JSON.stringify({code:error?.code||'UNEXPECTED',stage:error?.stage||currentStage,detail:error?.detail||null,states},null,2));
  return path.relative(root,dir).replace(/\\/g,'/');
}

async function main() {
  let error=null;
  try {
    if(!['candidate','live'].includes(mode)) fail('BAD_MODE');
    const accounts=await credentials();
    const { chromium } = require(process.env.CARD_QA_PLAYWRIGHT || process.env.BOARD_QA_PLAYWRIGHT || 'playwright');
    browser=await chromium.launch({headless:true,...(fs.existsSync(chrome)?{executablePath:chrome}:{})});
    for(let i=0;i<2;i++) {
      const context=await browser.newContext({viewport:{width:1440,height:950},serviceWorkers:'block'});
      contexts.push(context); await installRoutes(context);
      await context.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(String(key)==='op_last_password')return;return original.call(this,key,value);};try{localStorage.removeItem('op_last_password');}catch{}});
      const page=await context.newPage(); page.setDefaultTimeout(10000); pages.push(page);
      page.on('pageerror',()=>report.browserErrors.page++); page.on('console',msg=>{if(msg.type()==='error'){report.browserErrors.console++; const category=msg.text().match(/net::ERR_[A-Z_]+|status of [0-9]{3}/)?.[0]||'other-redacted'; if(!report.browserErrors.categories.includes(category))report.browserErrors.categories.push(category);}});
    }
    await Promise.all(pages.map((p,i)=>login(p,accounts[i])));
    await createAndStartRoom();
    await playTurn('hand');
    if(['draw','choose'].includes((await waitPeerSync())[0].turnStep)) await playTurn('drawn');
    for(let i=0;i<Number(process.env.CARD_QA_MORE_TURNS||0) && !report.coverage.choiceDisabledBlocked;i++) {
      const s=(await waitPeerSync())[0];
      if(s.roundNo!==1 || !['draw','choose'].includes(s.turnStep) || s.players.filter(p=>p.alive).length!==2) break;
      await playTurn(i%2?'drawn':'hand');
    }
    report.coverage.peerSync=true;
    if(mode==='candidate'&&Object.values(hits).some(n=>n<2)) fail('CANDIDATE_ROUTE_MISS');
    report.result=report.coverage.hand&&report.coverage.drawn?'PASS':'INCOMPLETE_NATURAL_ROUND_END';
  } catch(e) {
    error=e instanceof QAError?e:new QAError('UNEXPECTED');
    report.failure={code:error.code,stage:error.stage};
    report.failureArtifact=await saveFailure(error);
  } finally { await cleanup(); }
  const out=path.join(root,'artifacts/card-finish-v1',`real-${mode}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
  fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));
  process.stdout.write(JSON.stringify(report)+'\n');
  if(error) process.exitCode=1;
}

function selfTest() {
  const assert = require('node:assert/strict');
  const { createInitialState, applyAction } = require('../server/engine');
  let checks = 0;
  const check = (value, label) => { assert.ok(value, label); checks++; };
  const summarize = st => ({
    playerId:0, roundNo:st.roundNo, turnIndex:st.turnIndex, turnStep:st.turnStep,
    deckCount:st.deck.length, discardCount:st.discard.length, discard:st.discard,
    lastDiscard:st.discard[st.discard.length-1], pending:st.pending, own:st.players[0]
  });
  const initial = createInitialState(2);
  initial.turnIndex=0; initial.turnStep='choose'; initial.venues=[]; initial.discard=[13];
  initial.players[0].hand=2; initial.players[0].tempDraw=11;
  const before=summarize(initial);
  const after=summarize(applyAction(initial,{playerId:0,type:'PLAY_CARD',payload:{which:'drawn'}}).state);
  check(JSON.stringify(after.discard)==='[11]' && after.own.tempDraw===13 && after.turnStep==='choose', 'engine reproduces [13] to [11] and the returned choice');
  check(playAcknowledged(before,after,'drawn'), 'ordinary Kid is acknowledged without pile growth');
  check(!playAcknowledged(before,before,'drawn'), 'unchanged Kid state is not acknowledged');
  check(!playAcknowledged({...before,own:{...before.own,tempDraw:7}}, {...after,discard:[13],lastDiscard:13},'drawn'), 'ordinary card with unchanged discard is not acknowledged');
  check(!playAcknowledged(before,{...after,own:{...after.own,tempDraw:12}},'drawn'), 'returned card must come from the prior pile');
  check(!playAcknowledged(before,{...after,own:{...after.own,hand:3}},'drawn'), 'kept card must match the selected slot');
  check(!playAcknowledged(before,{...after,deckCount:before.deckCount-1},'drawn'), 'Kid does not draw from the deck');
  check(!playAcknowledged(before,{...after,turnIndex:1},'drawn'), 'repeated choose belongs to the original actor');
  check(!playAcknowledged(before,{...after,pending:{action:'killer'}},'drawn'), 'Kid replay cannot carry a pending effect');
  check(playAcknowledged({...before,own:{...before.own,tempDraw:7}}, {...after,discard:[13,7],discardCount:2,lastDiscard:7},'drawn'), 'ordinary growing discard remains acknowledged');
  const handBefore={...before,own:{...before.own,hand:11,tempDraw:2}};
  check(playAcknowledged(handBefore,after,'hand'), 'Kid in the hand slot preserves its other card');
  check(!visibleDiscardsAgree([13],[11]), 'same pile count cannot mask stale peer state');
  check(visibleDiscardsAgree([11],[11]), 'matching public pile synchronizes');
  check(visibleDiscardsAgree([null,11],[13,11]), 'Teach privacy differences remain valid');
  check(hasSinglePlay(0,[{which:'drawn'}],'drawn'), 'one outgoing selected-slot play succeeds');
  check(!hasSinglePlay(0,[],'drawn'), 'missing outgoing play fails');
  check(!hasSinglePlay(0,[{which:'drawn'},{which:'drawn'}],'drawn'), 'duplicate outgoing plays fail');
  check(!hasSinglePlay(0,[{which:'hand'}],'drawn'), 'wrong outgoing slot fails');
  process.stdout.write(JSON.stringify({result:'PASS',mode:'self-test',checks})+'\n');
}
if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest();
  else main();
}
