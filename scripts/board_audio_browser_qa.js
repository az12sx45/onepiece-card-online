'use strict';

// Read-only browser acceptance: disposable contexts; HTTP GET/HEAD only; no sockets.
// Native audio is instrumented for decode/playhead/signal evidence, not mocked.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || 'C:/Users/王曜瑋/AppData/Local/OpenAI/Codex/runtimes/cua_node/df473e5367fa2b42/bin/node_modules/playwright');
const args = process.argv.slice(2);
const originIndex = args.indexOf('--origin');
const ORIGIN = originIndex >= 0 ? args[originIndex + 1] : 'http://127.0.0.1:18925';
if (!ORIGIN || !/^https?:\/\//.test(ORIGIN)) throw new Error('Use --origin http(s)://host');
const OUTPUT = process.env.BOARD_QA_OUTPUT || 'D:/Codex_QA/board-audio-20260921/browser';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const report = { startedAt: new Date().toISOString(), origin: ORIGIN, readOnly: true, normalAutoplayPolicy: true, checks: [], errors: [], audioResponses: [], blockedWrites: [], scenes: [], screenshots: [] };
fs.mkdirSync(OUTPUT, { recursive: true });
const output = path.join(OUTPUT, 'board-audio-browser-report.json');
function save() { fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); }
function check(name, ok, detail) { report.checks.push({ name, ok: !!ok, detail }); if (!ok) console.error('FAIL', name, JSON.stringify(detail)); save(); }
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function nativeAudioEvidence() {
  const evidence = window.__qaAudio = { contexts: 0, starts: [], media: [], maxOutputPeak: 0, signalFrames: 0 };
  const NativeAudio = window.Audio;
  window.Audio = function(...values) {
    const element = new NativeAudio(...values);
    evidence.media.push(element);
    return element;
  };
  window.Audio.prototype = NativeAudio.prototype;
  Object.setPrototypeOf(window.Audio, NativeAudio);
  const NativeContext = window.AudioContext || window.webkitAudioContext;
  if (NativeContext) window.AudioContext = class extends NativeContext {
    constructor(...values) { super(...values); evidence.contexts += 1; }
    createBufferSource() {
      const source = super.createBufferSource();
      const start = source.start.bind(source);
      source.start = (...values) => {
        let peak = 0;
        const buffer = source.buffer;
        if (buffer) for (let channel = 0; channel < buffer.numberOfChannels; channel++) for (const sample of buffer.getChannelData(channel)) peak = Math.max(peak, Math.abs(sample));
        evidence.starts.push({ at: performance.now(), duration: buffer?.duration, peak, contextState: this.state });
        return start(...values);
      };
      return source;
    }
    createGain() {
      const gain = super.createGain();
      const connect = gain.connect.bind(gain);
      let tapped = false;
      gain.connect = (destination, ...values) => {
        if (!tapped && destination === this.destination) {
          tapped = true;
          const analyser = this.createAnalyser(); analyser.fftSize = 256;
          const silent = NativeContext.prototype.createGain.call(this); silent.gain.value = 0;
          connect(analyser); analyser.connect(silent); silent.connect(this.destination);
          const samples = new Float32Array(analyser.fftSize);
          setInterval(() => { analyser.getFloatTimeDomainData(samples); let peak = 0; for (const sample of samples) peak = Math.max(peak, Math.abs(sample)); evidence.maxOutputPeak = Math.max(evidence.maxOutputPeak, peak); if (peak > 0.000001) evidence.signalFrames++; }, 8);
        }
        return connect(destination, ...values);
      };
      return gain;
    }
  };
  try {
    localStorage.setItem('op_board_user_id', '892109');
    localStorage.setItem('op_board_client_id', 'read-only-audio-qa');
    localStorage.setItem('op_name', '聲音驗證');
    localStorage.setItem('op_player_name', '聲音驗證');
    sessionStorage.setItem('onepiece-board-opening-story-session-v1', JSON.stringify([2092109]));
  } catch (_) {}
}

async function newContext(browser, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  await context.addInitScript(nativeAudioEvidence);
  await context.route('**/*', route => {
    if (['GET', 'HEAD'].includes(route.request().method())) return route.continue();
    report.blockedWrites.push({ method: route.request().method(), url: route.request().url() });
    return route.abort('blockedbyclient');
  });
  await context.routeWebSocket('**/*', socket => socket.close({ code: 1000, reason: 'read-only audio QA' }));
  context.on('page', page => {
    page.on('pageerror', error => report.errors.push({ url: page.url(), message: error.message }));
    page.on('response', response => { if (/\/audio\/board_game\//.test(response.url())) report.audioResponses.push({ url: response.url(), status: response.status() }); });
  });
  return context;
}

async function playing(page, id, timeout = 20000) {
  await page.waitForFunction(id => { const s = window.BgmManager?.status(); return s?.playing && s.currentChoice?.id === id; }, id, { timeout });
  const before = await page.evaluate(() => BgmManager.status());
  await wait(260);
  const after = await page.evaluate(() => BgmManager.status());
  return { before: before.currentTime, after: after.currentTime, id: after.currentChoice.id, advanced: after.currentTime > before.currentTime + 0.08, startedAt: after.currentStartedAt };
}

async function layout(page, label) {
  if (await page.locator('#boardToolsToggle').count() && await page.locator('#boardToolsPanel').evaluate(node => node.hidden)) await page.locator('#boardToolsToggle').click();
  await page.getByRole('button', { name: '聲音設定', exact: true }).click();
  await page.waitForTimeout(230);
  const boxes = await page.evaluate(() => {
    const panel = document.querySelector('.board-audio__panel');
    const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    return { viewport: { width: innerWidth, height: innerHeight }, panel: box(panel), trigger: box(document.querySelector('.board-audio__trigger')), rangeCount: panel.querySelectorAll('input[type="range"]').length, focusedCheckbox: document.activeElement === panel.querySelector('input'), pageOverflow: document.documentElement.scrollWidth > innerWidth + 2 };
  });
  check(`${label}: popover fits viewport`, boxes.panel.left >= -1 && boxes.panel.top >= -1 && boxes.panel.right <= boxes.viewport.width + 1 && boxes.panel.bottom <= boxes.viewport.height + 1, boxes);
  check(`${label}: ranges and keyboard focus`, boxes.rangeCount === 2 && boxes.focusedCheckbox, boxes);
  check(`${label}: no horizontal page overflow`, !boxes.pageOverflow, boxes);
  if (await page.locator('#boardToolsPanel').count()) {
    await page.locator('.board-audio__sample').click();
    check(`${label}: audio interaction preserves voyage menu`, await page.locator('#boardToolsPanel').evaluate(node => !node.hidden));
  }
  const shot = path.join(OUTPUT, `${label}.png`); await page.screenshot({ path: shot }); report.screenshots.push(shot);
  await page.keyboard.press('Escape');
  check(`${label}: Escape restores focus`, await page.evaluate(() => document.querySelector('.board-audio__panel').hidden && document.activeElement === document.querySelector('.board-audio__trigger') && document.activeElement.getClientRects().length > 0));
}

async function transitionPause(page) {
  await page.locator('[data-scene-index="5"]').click();
  await page.waitForFunction(() => BgmManager.status().playing && BgmManager.status().currentChoice?.id === 'oden_store');
  const inFlight = await page.evaluate(() => ({ current: BgmManager.status().currentChoice.id, active: __qaAudio.media.filter(audio => !audio.paused).map(audio => ({ source: audio.src, volume: audio.volume })) }));
  check('crossfade pause regression starts with old and new audio active', inFlight.active.length === 2, inFlight);
  await page.locator('#musicToggle').click();
  await wait(650);
  const muted = await page.evaluate(() => ({ enabled: BgmManager.status().enabled, playing: BgmManager.status().playing, audible: __qaAudio.media.filter(audio => !audio.paused && audio.volume > 0.001).map(audio => ({ source: audio.src, volume: audio.volume })), all: __qaAudio.media.map(audio => ({ source: audio.src, paused: audio.paused, volume: audio.volume })) }));
  check('mute during crossfade silences every old and new BGM within 650ms', !muted.enabled && !muted.playing && muted.audible.length === 0, muted);
  await page.locator('#musicToggle').click();
  const resumed = await playing(page, 'oden_store');
  await wait(1500);
  const active = await page.evaluate(() => __qaAudio.media.filter(audio => !audio.paused && audio.volume > 0.001).map(audio => ({ source: audio.src, volume: audio.volume })));
  check('resume after crossfade mute plays only the latest track', resumed.advanced && active.length === 1 && decodeURIComponent(active[0].source).includes('Oden store'), { resumed, active });
}

async function transitionOnly(browser) {
  const context = await newContext(browser); const page = await context.newPage();
  try {
    await page.goto(`${ORIGIN}/board_audio_preview.html`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-scene-index="0"]').click();
    await playing(page, 'becoming_pirate_king'); await wait(1500);
    await transitionPause(page);
  } finally { await context.close(); }
}

async function preview(browser) {
  const context = await newContext(browser); const page = await context.newPage();
  await page.goto(`${ORIGIN}/board_audio_preview.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.BoardAudio && document.querySelectorAll('[data-scene-index]').length === 22);
  check('preview begins without autoplay or AudioContext', await page.evaluate(() => !BgmManager.status().playing && __qaAudio.contexts === 0));
  const ids = ['becoming_pirate_king','to_the_ocean','landing_at_town','grand_line_cold_island','grand_line_hot_island','oden_store','sanjis_feast','chopper','miss_allsunday','village_harbor','gold_uunan','usopp_danger','stealth_night_shadow','one_hour_evacuation','fight_continues','duel','shinkenshoubu','cant_escape_fight','cant_lose','we_did_it','mother_sea','reliable_friend'];
  for (const [index, id] of ids.entries()) {
    await page.locator(`[data-scene-index="${index}"]`).click();
    const result = await playing(page, id); report.scenes.push({ index, ...result });
    check(`scene ${index + 1} ${id}: real MP3 playhead advances`, result.advanced, result);
  }
  console.log('Audio browser QA: 22 scene MP3 playheads checked');
  const sameBefore = await page.evaluate(() => BgmManager.status());
  await page.locator('[data-scene-index="21"]').click(); await wait(300);
  const sameAfter = await page.evaluate(() => BgmManager.status());
  check('same scene does not restart track', sameAfter.currentStartedAt === sameBefore.currentStartedAt && sameAfter.currentTime >= sameBefore.currentTime, { before: sameBefore.currentTime, after: sameAfter.currentTime });
  await page.locator('[data-scene-index="1"]').click(); await page.locator('[data-scene-index="5"]').click(); await page.locator('[data-scene-index="7"]').click();
  const final = await playing(page, 'chopper'); check('rapid scene requests settle on latest', final.advanced, final);
  await wait(1500);
  check('completed crossfade leaves one playing BGM element', await page.evaluate(() => __qaAudio.media.filter(a => !a.paused && a.readyState >= 2).length === 1));
  await transitionPause(page);
  await page.waitForFunction(() => BoardAudio.status().loadedAssets === 8);
  for (const cue of ['tap','select','confirm','cancel','draw','reward','heal','danger','victory','defeat']) {
    await wait(110);
    const before = await page.evaluate(() => { __qaAudio.maxOutputPeak = 0; __qaAudio.signalFrames = 0; return __qaAudio.starts.length; });
    await page.locator(`#sfxList [data-board-sfx="${cue}"]`).click(); await wait(180);
    const result = await page.evaluate(before => ({ count: __qaAudio.starts.length - before, starts: __qaAudio.starts.slice(before), peak: __qaAudio.maxOutputPeak, signalFrames: __qaAudio.signalFrames }), before);
    check(`cue ${cue}: one decoded source and nonzero output`, result.count === 1 && result.starts[0]?.peak > 0 && result.peak > 0 && result.signalFrames > 0, result);
  }
  await wait(150); await page.locator('#sfxList [data-board-sfx="tap"]').focus();
  const keyBefore = await page.evaluate(() => __qaAudio.starts.length); await page.keyboard.press('Enter'); await wait(120);
  check('trusted keyboard activation has one SFX', await page.evaluate(before => __qaAudio.starts.length === before + 1, keyBefore));
  await page.getByRole('button', { name: '聲音設定', exact: true }).click();
  const sfxSlider = page.getByRole('slider', { name: '操作音效音量' }); await sfxSlider.focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
  check('keyboard slider changes persistent SFX volume', await page.evaluate(() => BoardAudio.status().volume === 0.01 && localStorage.getItem('board_sfx_volume') === '0.01'));
  await page.keyboard.press('Escape');
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.BoardAudio);
  check('SFX volume survives reload', await page.evaluate(() => BoardAudio.status().volume === 0.01));
  await page.evaluate(() => BoardAudio.setVolume(0.65));
  for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 932, height: 430 }]) {
    await page.setViewportSize(size); await layout(page, `preview-${size.width}x${size.height}`);
  }
  await context.close();
}

async function fallbackAndFrames(browser) {
  const context = await newContext(browser); const page = await context.newPage();
  await page.goto(`${ORIGIN}/board_audio_preview.html`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-scene-index="0"]').click(); await playing(page, 'becoming_pirate_king');
  await context.route('**/audio/board_game/bgm_new/*', async route => {
    const url = decodeURIComponent(route.request().url());
    if (url.includes('To The Ocean')) { await wait(1500); return route.fulfill({ status: 404, body: 'Expected QA unavailable track' }); }
    return route.fallback();
  });
  const old = await page.evaluate(() => BgmManager.status());
  await page.locator('[data-scene-index="1"]').click(); await wait(350);
  check('loading replacement preserves old BGM', await page.evaluate(id => BgmManager.status().currentChoice?.id === id && BgmManager.status().playing, old.currentChoice.id));
  await wait(1600);
  const failed = await page.evaluate(() => BgmManager.status());
  check('failed replacement preserves old BGM and playhead', failed.currentChoice?.id === old.currentChoice.id && failed.playing && failed.currentTime > old.currentTime, { old: old.currentTime, after: failed.currentTime, id: failed.currentChoice?.id });
  await page.evaluate(() => { const frame = document.createElement('iframe'); frame.id = 'audio-child'; frame.src = 'board_water_seven.html'; frame.style.cssText = 'width:900px;height:480px;display:block'; document.body.prepend(frame); });
  const frame = page.frameLocator('#audio-child');
  await frame.locator('body').waitFor(); await page.waitForFunction(() => document.querySelector('#audio-child').contentWindow.BoardAudio);
  const shared = await page.evaluate(() => { const child = document.querySelector('#audio-child').contentWindow; return { sameMixer: child.BoardAudio === BoardAudio, noOwnBgm: !child.BgmManager || child.BgmManager === BgmManager, contexts: child.__qaAudio.contexts, audioElements: child.__qaAudio.media.length, controls: child.document.querySelectorAll('.board-audio').length }; });
  check('embedded scene reuses parent mixer without another BGM/context', shared.sameMixer && shared.noOwnBgm && shared.contexts === 0 && shared.audioElements === 0 && shared.controls === 0, shared);
  await page.evaluate(() => { BgmManager.setEnabled(false); BoardAudio.setEnabled(false); const child = document.querySelector('#audio-child').contentDocument; const button = child.createElement('button'); button.id = 'qa-gesture'; button.textContent = '檢查靜音'; button.style.cssText = 'position:fixed;left:10px;top:10px;z-index:2147483647'; child.body.prepend(button); });
  await wait(600); await frame.locator('#qa-gesture').click(); await wait(200);
  check('child trusted gesture preserves explicit music and SFX mute', await page.evaluate(() => !BgmManager.status().enabled && !BgmManager.status().playing && !BoardAudio.status().enabled));
  await context.close();
}

async function formal(browser) {
  const context = await newContext(browser); const page = await context.newPage();
  await page.goto(`${ORIGIN}/board_start.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.BgmManager && window.BoardAudio);
  check('formal lobby has one sound control', await page.locator('.board-audio__trigger').count() === 1);
  await page.locator('#boardEntryStartBtn').click();
  const lobbyPlay = await playing(page, 'becoming_pirate_king'); check('formal lobby starts actual music after entry click', lobbyPlay.advanced, lobbyPlay);
  if (new URL(ORIGIN).hostname === '127.0.0.1' || new URL(ORIGIN).hostname === 'localhost') {
    await page.fill('#boardAuthUsername', 'audio_browser_qa'); await page.locator('#boardAuthSubmitBtn').click();
    await page.waitForFunction(() => document.body.dataset.entryStage === 'app');
    report.lobbyLayoutMode = 'local preview entry, no remote authentication';
  } else {
    // Expose the already-delivered lobby DOM for layout checks only. No account,
    // auth bypass on the server, session token, room or gameplay write is used.
    await page.evaluate(() => { document.body.dataset.entryStage = 'app'; });
    report.lobbyLayoutMode = 'read-only delivered lobby DOM, unauthenticated';
  }
  for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 932, height: 430 }]) {
    await page.setViewportSize(size); await layout(page, `formal-lobby-${size.width}x${size.height}`);
  }
  await page.goto(`${ORIGIN}/board_game.html?layout=responsive&seed=2092109`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__ && window.BoardAudio, null, { timeout: 30000 });
  await page.evaluate(() => { window.__BOARD_GAME_DEBUG__.closeModal(); });
  for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 932, height: 430 }]) {
    await page.setViewportSize(size); await layout(page, `formal-game-${size.width}x${size.height}`);
  }
  for (const name of ['board_battle.html','board_impel_down.html','board_marineford.html','board_water_seven.html','board_spar_selection_demo.html','board_york_clue_puzzle_formal_demo.html']) {
    await page.goto(`${ORIGIN}/${name}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.BoardAudio);
    check(`${name}: standalone sound control`, await page.locator('.board-audio__trigger').count() === 1);
  }
  await page.goto(`${ORIGIN}/board_fixed_viewport.html?seed=2092109`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#boardFixedFrame')?.contentWindow.document.querySelector('.board-audio__trigger'), null, { timeout: 30000 });
  const fixedOwner = await page.evaluate(() => { const child = document.querySelector('#boardFixedFrame').contentWindow; return { parentAudio: !!window.BoardAudio, parentBgm: !!window.BgmManager, childAudio: !!child.BoardAudio, childBgm: !!child.BgmManager, controls: child.document.querySelectorAll('.board-audio__trigger').length }; });
  check('fixed viewport wrapper delegates ownership to game iframe', !fixedOwner.parentAudio && !fixedOwner.parentBgm && fixedOwner.childAudio && fixedOwner.childBgm && fixedOwner.controls === 1, fixedOwner);
  await context.close();
  const touchContext = await newContext(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const touchPage = await touchContext.newPage();
  await touchPage.goto(`${ORIGIN}/board_game.html?seed=2092109`, { waitUntil: 'domcontentloaded' });
  await touchPage.waitForURL(/board_fixed_viewport\.html/);
  await touchPage.waitForFunction(() => document.querySelector('#boardFixedFrame')?.contentWindow.__BOARD_GAME_DEBUG__, null, { timeout: 30000 });
  const child = touchPage.frameLocator('#boardFixedFrame');
  await child.locator('body').evaluate(() => window.__BOARD_GAME_DEBUG__.closeModal());
  await child.locator('#boardToolsToggle').click(); await child.locator('.board-audio__trigger').click();
  await touchPage.waitForTimeout(230);
  check('touch fixed viewport game iframe owns active sound popover', await touchPage.evaluate(() => { const child = document.querySelector('#boardFixedFrame').contentWindow; return !window.BoardAudio && child.document.querySelector('.board-audio__trigger').getAttribute('aria-expanded') === 'true' && !child.document.querySelector('.board-audio__panel').hidden && !child.document.querySelector('#boardToolsPanel').hidden; }));
  const touchShot = path.join(OUTPUT, 'formal-fixed-touch-390x844.png'); await touchPage.screenshot({ path: touchShot }); report.screenshots.push(touchShot);
  await touchPage.keyboard.press('Escape');
  check('touch fixed viewport Escape restores visible trigger', await child.locator('body').evaluate(() => document.activeElement === document.querySelector('.board-audio__trigger') && document.activeElement.getClientRects().length > 0));
  await touchContext.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  try {
    if (args.includes('--transition-only')) await transitionOnly(browser);
    else { await preview(browser); await fallbackAndFrames(browser); await formal(browser); }
    check('no browser JavaScript exceptions', report.errors.length === 0, report.errors);
    report.finishedAt = new Date().toISOString(); report.ok = report.checks.every(item => item.ok); save();
    console.log(JSON.stringify({ ok: report.ok, passed: report.checks.filter(item => item.ok).length, checks: report.checks.length, report: output }));
    if (!report.ok) process.exitCode = 1;
  } finally { await browser.close(); }
}
main().catch(error => { report.fatal = { message: error.message, stack: error.stack }; save(); console.error(error.stack); process.exitCode = 1; });
