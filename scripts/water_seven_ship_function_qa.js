"use strict";
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {chromium}=require(process.env.BOARD_QA_PLAYWRIGHT||'D:/LATTICE/projects/tabletop-series/qa-browser/node_modules/playwright-core');
const BASE=process.env.BOARD_QA_URL||'http://127.0.0.1:18943',OUT=process.env.BOARD_QA_OUTPUT||'D:/Codex_QA/water-seven-ship-depth-20260924/functions';
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(BASE).hostname));fs.mkdirSync(OUT,{recursive:true});
const old=execFileSync('git',['show','4f4170331f0e323786f93dd8d7535e868985dc6d:public/board_water_seven.html'],{cwd:path.resolve(__dirname,'..')});
const report={cases:[],errors:[]};
async function snapshot(host){return host.evaluate(()=>{const d=window.__BOARD_GAME_DEBUG__,p=d.getCurrentPlayer();return {coins:p.coins,levels:structuredClone(p.shipUpgradeLevels),slots:p.shipSlotsUnlocked,equipped:structuredClone(p.shipEquippedGear),items:Object.fromEntries(['ship_plank','ship_toolbox','ship_coating_resin','ship_adam_wood','ship_patch_canvas'].map(id=>[id,d.inventoryItemCount(p,id)]))}})}
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 for(const baseline of [true,false]){
 const context=await browser.newContext({viewport:{width:1440,height:900}});if(baseline)await context.route('**/board_water_seven.html*',r=>r.fulfill({status:200,contentType:'text/html',body:old}));
 const host=await context.newPage();host.on('pageerror',e=>report.errors.push(e.message));
 await host.goto(BASE+'/board_game.html?desktop_frame=1');await host.waitForFunction(()=>window.__BOARD_GAME_DEBUG__?.openWaterSevenWindow);
 await host.evaluate(()=>{const d=window.__BOARD_GAME_DEBUG__,s=d.getState(),p=d.getCurrentPlayer();p.coins=100000;p.shipUpgradeLevels={sail:0,rudder:0,watchtower:0,kitchen:0,training:0};p.shipSlotsUnlocked=0;p.shipEquippedGear=[null,null,null,null];p.location={kind:'island',islandId:'island-24'};s.gameState.phase='town';for(const id of ['ship_plank','ship_toolbox','ship_coating_resin','ship_adam_wood','ship_patch_canvas'])d.grantFormalItemToPlayer(p,id,100);d.openWaterSevenWindow(p)});
 const frame=host.frameLocator('#waterSevenPageFrame');await frame.locator('[data-upgrade="training"]').waitFor();
 if(!baseline)await host.frames().find(f=>f.url().includes('board_water_seven.html')).waitForFunction(()=>window.__WATER_SEVEN_DEPTH__?.status().ready);
 const before=await snapshot(host);await frame.locator('[data-upgrade="training"]').click();
 await host.waitForFunction(()=>window.__BOARD_GAME_DEBUG__.getCurrentPlayer().shipUpgradeLevels.training===1);
 await frame.locator('[data-tab="slots"]').click();await frame.locator('[data-open-now="0"]').click();
 await host.waitForFunction(()=>window.__BOARD_GAME_DEBUG__.getCurrentPlayer().shipSlotsUnlocked===1);
 await frame.locator('[data-tab="gear"]').click();await frame.locator('[data-select-gear="ship_patch_canvas"]').click();await frame.locator('[data-equip="ship_patch_canvas"]').click();
 await host.waitForFunction(()=>window.__BOARD_GAME_DEBUG__.getCurrentPlayer().shipEquippedGear[0]==='ship_patch_canvas');
 const equipped=await snapshot(host);await frame.locator('[data-equip="ship_patch_canvas"]').click();
 await host.waitForFunction(()=>!window.__BOARD_GAME_DEBUG__.getCurrentPlayer().shipEquippedGear[0]);
 const after=await snapshot(host);assert.equal(after.levels.training,1);assert.equal(after.slots,1);assert.ok(after.coins<before.coins);assert.equal(after.items.ship_patch_canvas,before.items.ship_patch_canvas);
 await frame.locator('#waterSevenExitBtn').click();await host.waitForFunction(()=>!document.querySelector('#waterSevenPageOverlay').classList.contains('open'));
 await host.evaluate(()=>window.__BOARD_GAME_DEBUG__.openWaterSevenWindow());await frame.locator('[data-tab="slots"]').click();
 assert.deepEqual(await snapshot(host),after);
 const water=host.frames().find(f=>f.url().includes('board_water_seven.html'));await water.goto(water.url());await frame.locator('[data-tab="slots"]').click();assert.deepEqual(await snapshot(host),after);
 report.cases.push({baseline,before,equipped,after,reopenAndIframeReload:true});await context.close();
 }
 assert.deepEqual(report.cases[1].before,report.cases[0].before);assert.deepEqual(report.cases[1].equipped,report.cases[0].equipped);assert.deepEqual(report.cases[1].after,report.cases[0].after);assert.equal(report.errors.length,0);report.ok=true;
}catch(e){report.failure=e.stack;process.exitCode=1}finally{fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));await browser.close()}console.log(JSON.stringify(report))})();
