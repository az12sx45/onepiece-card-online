"use strict";

// Run only against an isolated local server. This never logs in or joins a room.
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const URL = process.env.BOARD_QA_URL || "http://127.0.0.1:18921";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(URL)) throw new Error("Local isolated QA server required");
const OUTPUT = process.env.BOARD_QA_OUTPUT || path.resolve("work/board-move-fx-browser");
const CHROME = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const EXPECTED_FAMILIES = Number(process.env.BOARD_QA_FAMILIES || 102);
const report = { checks: [], errors: [], cases: [], screenshots: [], decode: [] };
const check = (name, pass, detail = null) => report.checks.push({ name, pass: !!pass, detail });
function monitor(page, label) { page.on("pageerror", (error) => report.errors.push(`${label}: ${error.message}`)); }
async function screenshot(page, file) { await page.screenshot({ path: path.join(OUTPUT, file), fullPage: false }); report.screenshots.push(file); }

async function prepareBattle(host) {
  await host.goto(`${URL}/board_game.html?move_fx_qa=1`, { waitUntil: "domcontentloaded" });
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.startBattle && window.BoardCards?.cards?.length, null, { timeout: 30000 });
  await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__, state = debug.getState(), player = state.gameState.players[0];
    const source = window.BoardCards.cards.find((card) => /魯夫/.test(card.name)) || window.BoardCards.cards[0];
    player.crew = [debug.cloneCard({ ...source, level: 50, currentHp: Number.MAX_SAFE_INTEGER })];
    player.crew[0].currentHp = Number(player.crew[0].baseStats?.hp || 1000);
    player.activeCrewIndex = 0; player.pendingBattle = null; state.battleState = null;
    if (!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "isolated-move-fx-qa" });
    debug.ensurePostgameWorldLayout(state.gameState);
    const assignment = state.gameState.postgameWorld.islandAssignments.find((entry) => entry.bossKey === "postgame_douglas_bullet") || state.gameState.postgameWorld.islandAssignments[0];
    const island = debug.getIslandById(assignment.islandId), islandState = debug.getIslandState(assignment.islandId);
    islandState.currentHp = islandState.maxHp; islandState.isDefeated = false;
    debug.startBattle(player, island, islandState);
    Object.assign(state.battleState, { entryTransition: null, prebattleIntro: null, prebattleIntroDone: true, openingPassiveVisual: null, openingPassiveVisualQueue: [], visualEvent: null, animating: false, roundResolved: false, waitingResume: false });
  });
}

async function instrument(page) {
  await page.evaluate(() => {
    const original = HTMLMediaElement.prototype.play;
    window.__fxQa = { audio: [], samples: [], numbers: [], running: false, started: 0 };
    HTMLMediaElement.prototype.play = function (...args) { const item = { src: this.src.split("/").at(-1), time: performance.now(), accepted: null }; if (this.src.includes("move-fx/v1/")) window.__fxQa.audio.push(item); const promise = original.apply(this, args); promise?.then(()=>{item.accepted=true},()=>{item.accepted=false}); return promise; };
    const layer = document.getElementById("damagePop");
    new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
      if (node.nodeType === 1 && node.classList.contains("damage-number")) window.__fxQa.numbers.push({ kind: node.dataset.damageKind, value: Number(node.dataset.damageValue || 0), time: performance.now() - window.__fxQa.started });
    }))).observe(layer, { childList: true });
    const sampleCanvas = document.createElement("canvas"); sampleCanvas.width = 96; sampleCanvas.height = 64;
    const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
    function sample() {
      const qa = window.__fxQa;
      if (qa.running) {
        const canvas = document.querySelector(".board-move-fx-canvas"); let alpha = 0;
        if (canvas && canvas.width) { sampleContext.clearRect(0, 0, 96, 64); sampleContext.drawImage(canvas, 0, 0, 96, 64); const bytes = sampleContext.getImageData(0, 0, 96, 64).data; for (let i = 3; i < bytes.length; i += 4) if (bytes[i]) alpha++; }
        qa.samples.push({ time: performance.now() - qa.started, alpha, active: window.__BOARD_BATTLE_DEBUG__.moveFxRuntime().status().active, legacy: document.getElementById("impactFx")?.classList.contains("active"), particles: document.querySelectorAll(".effect-particle-layer").length });
      }
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
}

async function runCase(page, spec, capture) {
  await page.evaluate(async (spec) => {
    const host = window.opener, debug = host.__BOARD_GAME_DEBUG__, state = debug.getState(), battle = state.battleState;
    const move = window.BoardMoveFxCatalog.moves[spec.moveId], fx = window.__BOARD_BATTLE_DEBUG__.moveFxRuntime();
    const type = spec.type || "attack", side = spec.side || "player", targetSide = type === "attack" || ['control','debuff'].includes(spec.moveType) ? (side === "player" ? "enemy" : "player") : side;
    const player = state.gameState.players[0].crew[0];
    const startHp = {player:Number(player.baseStats?.hp||player.maxHp||277),enemy:Number(battle.enemyCombatant.maxHp||1760)};
    const finalHp = {...startHp}; if(type==='attack')finalHp[targetSide] = Math.max(1,finalHp[targetSide]-(spec.hits||[123]).reduce((a,b)=>a+b,0));
    player.currentHp=finalHp.player; battle.enemyCombatant.currentHp=finalHp.enemy;
    const event = { id: "movefx-" + spec.label + "-" + Date.now(), moveId: spec.moveId, moveName: spec.moveName || move.moveName, moveType: spec.moveType || (type === "attack" ? "attack" : "shield"), side, targetSide, actorName: side === "player" ? "魯夫" : battle.enemyCombatant.name, type, hitDamages: spec.hits || [123], damage: (spec.hits || [123]).reduce((a,b)=>a+b,0), miss: !!spec.miss, duration: 4500, hitEffect: "punch_heavy.webp", fatalGuard: !!spec.guard, fatalGuardLabel: "不屈", startHp, finalHp };
    if (type !== "attack") { event.damage = 0; event.hitDamages = []; }
    if (!spec.cold) await fx.warm(event);
    fx.clear();
    const qa = window.__fxQa; qa.audio = []; qa.samples = []; qa.numbers = []; qa.running = true; qa.started = performance.now();
    battle.animating = true; battle.visualEvent = { ...event, id: event.id + "-cast", type: "dice", diceFace: 3, baseDiceFace: 3, duration: 1650 };
    debug.notifyBattleWindow(); window.__BOARD_BATTLE_DEBUG__.refresh();
    await new Promise((done) => setTimeout(done, 1900));
    qa.started = performance.now(); battle.visualEvent = event; debug.notifyBattleWindow(); window.__BOARD_BATTLE_DEBUG__.refresh();
    qa.profile = fx.resolve(event);
    // The same snapshot may be redelivered by local sync; it must not replay SFX.
    window.__BOARD_BATTLE_DEBUG__.refresh();
  }, spec);
  const contact = spec.type === "status" ? 420 : ((spec.hits?.length || 1) > 1 ? 645 : 875);
  if (capture) { await page.waitForTimeout(contact); await screenshot(page, capture); }
  await page.waitForTimeout(3000 - (capture ? contact : 0));
  const result = await page.evaluate(() => { const qa = window.__fxQa; qa.running = false; return { audio: qa.audio, samples: qa.samples, numbers: qa.numbers, profile: { family: qa.profile.familyId, animation: qa.profile.animation, castSound:qa.profile.castSound, sound:qa.profile.sound }, state: window.__BOARD_BATTLE_DEBUG__.moveFxRuntime().status(), overflow: document.documentElement.scrollWidth > innerWidth + 2, portrait:document.body.classList.contains('battle-phone-portrait'), orientationNotice:getComputedStyle(document.getElementById('battleOrientationNotice')).display, hud: [...document.querySelectorAll("#playerHudMeta,#enemyHudMeta")].map((el)=>({ text:el.textContent, visible:!!el.getBoundingClientRect().width })) }; });
  result.label = spec.label; report.cases.push(result);
  const visible = result.samples.filter((x)=>x.alpha > 0), hitSounds = result.audio.filter((x)=>x.src.includes("__hit.")), castSounds = result.audio.filter((x)=>x.src.includes("__cast."));
  check(`${spec.label}: cast once`, castSounds.length === 1, castSounds.length);
  check(`${spec.label}: cast matches selected variant`,castSounds[0]?.src === result.profile.castSound?.split('/').at(-1));
  check(`${spec.label}: audio playback accepted`,result.audio.every((item)=>item.accepted===true));
  check(`${spec.label}: hit sound count`, hitSounds.length === (spec.miss || spec.type === "status" ? 0 : (spec.hits?.length || 1)), hitSounds.length);
  check(`${spec.label}: alpha`, spec.miss || spec.cold ? visible.length === 0 : visible.length > 0, visible.length);
  check(`${spec.label}: cleanup`, result.state.active === 0 && result.samples.at(-1).alpha === 0);
  if (!spec.cold && !spec.guard) check(`${spec.label}: no generic VFX`, !result.samples.some((x)=>x.legacy || x.particles > 0));
  check(`${spec.label}: viewport`, !result.overflow && result.hud.length===2 && result.hud.every((x)=>x.visible) && (!result.portrait||result.orientationNotice==='grid'));
  if (spec.expectedArt) check(`${spec.label}: variant art`, result.profile.family === spec.expectedArt, result.profile);
  if (spec.expectedAnimation) check(`${spec.label}: variant animation`, result.profile.animation === spec.expectedAnimation,result.profile);
  if (spec.type === "status") check(`${spec.label}: full aura duration`, visible.at(-1)?.time - visible[0]?.time >= 540);
  return result;
}

(async () => {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ["--autoplay-policy=no-user-gesture-required"] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const preview = await context.newPage(); monitor(preview, "preview");
    await preview.goto(`${URL}/board_move_fx_preview.html`, { waitUntil: "domcontentloaded" });
    await preview.waitForFunction(()=>window.__BOARD_MOVE_FX_PREVIEW__);
    await preview.evaluate(()=>window.__BOARD_MOVE_FX_PREVIEW__.select("luffy_pistol"));
    await preview.waitForFunction(()=>!document.getElementById("play").disabled && [...document.querySelectorAll('img:not([hidden])')].every((image)=>image.complete&&image.naturalWidth>0));
    await preview.click("#play"); await preview.waitForTimeout(370); await screenshot(preview,"preview-desktop.png");
    check("preview: searchable data", await preview.locator("#move option").count() > 0);
    await preview.setViewportSize({ width:390, height:844 }); await screenshot(preview,"preview-phone.png");
    check("preview: mobile no horizontal overflow", await preview.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const host = await context.newPage(); monitor(host,"host"); await prepareBattle(host);
    const popup = context.waitForEvent("page"); await host.evaluate(()=>window.open("board_battle.html?move_fx_qa=1","_blank")); const battle = await popup; monitor(battle,"battle");
    await battle.waitForLoadState("domcontentloaded"); await battle.waitForFunction(()=>window.__BOARD_BATTLE_DEBUG__?.latestView()?.battle, null,{ timeout:30000 }); await instrument(battle);
    await runCase(battle,{label:"single",moveId:"luffy_pistol",hits:[123]},"battle-single-desktop.png");
    check('battle: sprite stays below damage numbers',await battle.evaluate(()=>{const canvas=document.querySelector('.board-move-fx-canvas'),numbers=document.getElementById('damagePop');return canvas?.parentElement===numbers.parentElement && Number(getComputedStyle(canvas).zIndex)<Number(getComputedStyle(numbers).zIndex)}));
    await runCase(battle,{label:"combo",moveId:"luffy_gatling",hits:[40,41,42]});
    await runCase(battle,{label:"miss",moveId:"luffy_pistol",hits:[0],miss:true});
    await runCase(battle,{label:"guard",moveId:"luffy_pistol",hits:[0],guard:true});
    await runCase(battle,{label:"support",moveId:"ace_guard",type:"status",moveType:"shield"});
    await runCase(battle,{label:"variant",moveId:"sanji_bien_cuit_grill_shot",moveName:"隱形黑・流星蕎麥麵",expectedArt:"kick_sweep"});
    await runCase(battle,{label:"phase-attack",moveId:"postgame_shiki_lion_ground_scroll",moveType:"special",expectedArt:"stone_crush",expectedAnimation:"projectile"});
    await runCase(battle,{label:"phase-control",moveId:"postgame_shiki_lion_ground_scroll",type:"status",moveType:"control",expectedArt:"stone_crush",expectedAnimation:"aura"});
    await battle.setViewportSize({width:932,height:430}); await runCase(battle,{label:"phone-landscape",moveId:"luffy_pistol",hits:[123],side:"enemy"},"battle-phone-landscape.png");
    await battle.setViewportSize({width:390,height:844}); await runCase(battle,{label:"phone-portrait",moveId:"ace_fist",hits:[123]},"battle-phone-portrait.png");
    // Fresh decoder entry is held beyond the complete hit; loading must not replay it late.
    const sheet = await battle.evaluate(()=>BoardMoveFxCatalog.families.room_cut.sheet);
    await context.route(`**/${sheet.split("?")[0]}*`, async(route)=>{await new Promise((done)=>setTimeout(done,3300));await route.continue();});
    await runCase(battle,{label:"slowload",moveId:"law_room",cold:true,hits:[123]});
    await battle.waitForTimeout(750);
    check("slowload: no late animation",await battle.evaluate(()=>window.__BOARD_BATTLE_DEBUG__.moveFxRuntime().status().active===0));
    await context.unrouteAll({behavior:"wait"});
    report.decode = await preview.evaluate(async()=>{
      const results=[];for(const [name,family] of Object.entries(BoardMoveFxCatalog.families)){
        const image=new Image();image.src=family.sheet;
        try {await image.decode();const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,64,64);const data=ctx.getImageData(0,0,64,64).data;let opaque=0,transparent=0;for(let i=3;i<data.length;i+=4){if(data[i])opaque++;else transparent++;}results.push({name,width:image.naturalWidth,height:image.naturalHeight,opaque,transparent,ok:image.naturalWidth===2048&&image.naturalHeight===1024&&opaque>0&&transparent>0});}
        catch(error){results.push({name,ok:false,error:String(error)})}image.src='';
      }return results;
    });
    check("families: browser decode and alpha", report.decode.length===EXPECTED_FAMILIES && report.decode.every((row)=>row.ok), `${report.decode.filter((x)=>x.ok).length}/${report.decode.length}`);
    report.audioDecode=await preview.evaluate(async()=>{
      const moves=[...Object.values(BoardMoveFxCatalog.moves),...BoardMoveFxCatalog.variants.map((variant)=>variant.profile)];
      const paths=[...new Set(moves.flatMap((move)=>[move.sound,move.castSound].filter(Boolean)))];
      const context=new AudioContext(),results=[];
      for(const path of paths){try{const response=await fetch(path);if(!response.ok)throw new Error('HTTP '+response.status);const buffer=await context.decodeAudioData(await response.arrayBuffer());let energy=0,peak=0;for(let channel=0;channel<buffer.numberOfChannels;channel++){const data=buffer.getChannelData(channel);for(const sample of data){energy+=sample*sample;peak=Math.max(peak,Math.abs(sample))}}results.push({path,duration:buffer.duration,channels:buffer.numberOfChannels,peak,rms:Math.sqrt(energy/(buffer.length*buffer.numberOfChannels)),ok:buffer.duration>0&&buffer.duration<1.5&&energy>0&&peak<1})}catch(error){results.push({path,ok:false,error:String(error)})}}
      await context.close();return results;
    });
    check('audio: all catalog assets decode without silence or clipping',report.audioDecode.length>=450&&report.audioDecode.every((row)=>row.ok),report.audioDecode.length);
    check("browser: no JS errors",report.errors.length===0,report.errors);
    await context.close();
  } finally { await browser.close(); report.ok=report.checks.every((item)=>item.pass);fs.writeFileSync(path.join(OUTPUT,"report.json"),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,failed:report.checks.filter((x)=>!x.pass),output:OUTPUT})); }
  if(!report.ok)process.exitCode=1;
})().catch((error)=>{console.error(error);process.exitCode=1;});
