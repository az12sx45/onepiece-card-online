// Integration QA for the independently authored Card Finish layer.
// Choice checks use a renderer fixture. Live socket QA is a separate script.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || 'playwright');
const { createInitialState } = require('../server/engine');
const root = path.resolve(__dirname, '..');
const url = process.env.BOARD_QA_URL || 'http://127.0.0.1:8849';
const out = path.resolve(root, process.env.CARD_QA_OUTPUT || 'artifacts/card-finish-v1');
const report = { mode: 'renderer-fixture-and-dex', checks: [], errors: [], screenshots: [] };
function check(value, label) { assert.ok(value, label); report.checks.push(label); }
const inline = html => [...html.replace(/\r\n/g,'\n').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m => !/\bsrc\s*=/.test(m[1])).map(m => m[2]);
const snapshot = createInitialState(2);
snapshot.turnStep = 'choose'; snapshot.turnIndex = 0; snapshot.venues = [];
snapshot.discard = []; snapshot.myDeluxe = [];
snapshot.players[0].hand = 8; snapshot.players[0].tempDraw = 3;
snapshot.players[1].hand = null; snapshot.players[1].tempDraw = null;
async function readyImages(page, selector) {
  await page.waitForFunction(s => [...document.querySelectorAll(s)].filter(i => i.getAttribute('src')).every(i => i.complete && i.naturalWidth > 0), selector);
}
async function setFixture(page, player = {}, extra = {}) {
  await page.evaluate(({ snapshot, player, extra }) => {
    me = { roomId: 'card-finish-fixture', playerId: 0, secret: '' };
    state = structuredClone(snapshot); Object.assign(state.players[0], player); Object.assign(state, extra);
    feed = []; _enhPlayed.clear(); _lastRoundNo = state.roundNo;
    window.__finishActions = [];
    sendAction = (type, payload) => window.__finishActions.push({ type, which: payload?.which });
    render();
  }, { snapshot, player, extra });
  await readyImages(page, '#imgHand,#imgDrawn');
}
async function center(page, selector) {
  const locator = page.locator(selector);
  await locator.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(100);
  const r = await locator.boundingBox(); assert.ok(r?.width > 0, selector + ' visible');
  return { x: r.x + r.width * .7, y: Math.min((await page.evaluate(() => innerHeight)) - 3, r.y + r.height * .3) };
}
async function physicalClick(page, selector, touch) {
  const point = await center(page, selector);
  if (touch) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(70);
}
async function noAction(page, selector, touch, label) {
  await page.evaluate(() => { window.__finishActions = []; });
  await physicalClick(page, selector, touch);
  check((await page.evaluate(() => window.__finishActions)).length === 0, label);
}
async function expectAction(page, selector, which, touch, label) {
  await page.evaluate(() => { window.__finishActions = []; });
  await physicalClick(page, selector, touch);
  const actions = await page.evaluate(() => window.__finishActions);
  check(actions.length === 1 && actions[0].type === 'PLAY_CARD' && actions[0].which === which, label);
}
async function takeShot(page, name) {
  await page.screenshot({ path: path.join(out, name), fullPage: false }); report.screenshots.push(name);
}
async function transformed(page, selector) {
  return page.locator(selector).evaluate(el => getComputedStyle(el).transform);
}
async function sweepTilt(page, selector, limit, tag) {
  const surface=page.locator(selector);
  await surface.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
  await page.waitForTimeout(180);
  for(const [x,y] of [[.03,.5],[.97,.5],[.5,.03],[.5,.97],[.03,.03],[.97,.97]]) {
    const r=await surface.boundingBox();
    await page.mouse.move(r.x+r.width*x,r.y+r.height*y);
    await page.waitForTimeout(190);
    const state=await surface.evaluate(el=>{
      const face=el.querySelector('.card-finish-face'),css=face.style;
      return {angle:Math.hypot(parseFloat(css.getPropertyValue('--finish-pitch')),parseFloat(css.getPropertyValue('--finish-yaw'))),
        engaged:el.dataset.finishEngaged,overflow:el.closest('button')?getComputedStyle(el.closest('button')).overflow:null};
    });
    check(state.engaged==='true'&&state.angle>limit*.9&&state.angle<=limit+.001,tag+': strong edge/corner tilt '+x+','+y);
    if(state.overflow!==null)check(state.overflow==='visible',tag+': active projection not clipped');
    if(state.overflow!==null) {
      const fixed=await surface.evaluate(el=>{const s=getComputedStyle(el.closest('button'));return {transform:s.transform,animation:s.animationName,shadow:s.boxShadow,background:s.backgroundColor,border:s.borderTopColor};});
      check(fixed.transform==='none'&&fixed.animation==='none'&&fixed.shadow==='none'&&fixed.background==='rgba(0, 0, 0, 0)'&&fixed.border==='rgba(0, 0, 0, 0)',tag+': no fixed backing frame while face tilts');
    }
  }
  await takeShot(page,tag+'-strong-angle.png');
  await page.mouse.move(2,2); await page.waitForTimeout(190);
  check(await surface.getAttribute('data-finish-engaged')===null,tag+': leave resets tilt');
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const oldHtml = execFileSync('git', ['show', '14d089027b8af8ee80e64f18b88a02dca20b0fb2:public/game.html'], { cwd: root, encoding: 'utf8', maxBuffer: 4000000 });
  const newHtml = fs.readFileSync(path.join(root, 'public/game.html'), 'utf8');
  check(JSON.stringify(inline(oldHtml)) === JSON.stringify(inline(newHtml)), 'all inline game scripts match the production rollback commit');
  check(!/op-holo|pokemon-cards-css|card.holo.v1/.test(newHtml), 'game HTML no longer references the abandoned adaptation');
  check((newHtml.match(/data-card-finish=/g) || []).length === 4, 'exactly four display hooks');
  const browser = await chromium.launch({ executablePath: process.env.BOARD_QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const spec of [{ width: 1440, height: 1000, touch: false }, { width: 390, height: 844, touch: true }, { width: 667, height: 375, touch: true }, { width: 932, height: 430, touch: true }]) {
      const tag = String(spec.width), ctx = await browser.newContext({ viewport: { width: spec.width, height: spec.height }, isMobile: spec.touch, hasTouch: spec.touch, deviceScaleFactor: 1 });
      const page = await ctx.newPage(); page.setDefaultTimeout(10000);
      page.on('pageerror', e => report.errors.push(tag + ': ' + String(e)));
      await page.route('https://cdn.socket.io/**', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io=()=>{const s={on(){return s},emit(){return s},timeout(){return s},disconnect(){return s},connected:false};return s;}' }));
      await page.addInitScript(() => { HTMLMediaElement.prototype.play = function () { return Promise.resolve(); }; });
      await page.goto(url + '/game.html', { waitUntil: 'networkidle' });
      for (const id of ['0','3','5','7','8','10']) {
        await page.locator('#cardDexBtn').click();
        await page.locator('.card-dex-thumb[data-id="' + id + '"]').click();
        await readyImages(page, '#cardDexPreviewBase,#cardDexPreviewEnh');
        check(await page.locator('#cardDexPreviewBase').getAttribute('src') === 'images/cards/' + id + '.webp', tag + ': dex base artwork ' + id);
        check(await page.locator('#cardDexPreviewEnh').getAttribute('src') === 'images/cards/enh/' + id + '.webp', tag + ': dex enhanced artwork ' + id);
        if (id === '8') {
          await page.locator('#cardDexPreviewEnh').scrollIntoViewIfNeeded();
          const ratios = await page.locator('#cardDexPreviewBase,#cardDexPreviewEnh').evaluateAll(es => es.map(e => {const r=e.getBoundingClientRect();return {w:r.width,h:r.height,ratio:e.naturalWidth/e.naturalHeight,x:r.x};}));
          check(ratios.every(r => Math.abs(r.w/r.h-r.ratio) < .005 && r.w > 75 && r.x >= 0 && r.x+r.w <= spec.width+1), tag + ': complete dex images keep natural aspect');
          const point = await center(page, '#cardDexPreviewEnh'); await page.mouse.move(point.x, point.y); await page.waitForTimeout(160);
          if (spec.touch) check(await transformed(page,'#cardDexPreviewEnh >> ..') === 'none', tag + ': dex static on touch');
          else check((await transformed(page,'#cardDexPreviewEnh >> ..')).startsWith('matrix3d'), tag + ': dex uses perspective on pointer');
          await takeShot(page, 'dex-' + tag + '.png');
          if(!spec.touch)await sweepTilt(page,'#cardDexPreviewEnh >> .. >> ..',12,'dex-'+tag);
        }
        await page.locator('#cardDexClose').click();
        check(await page.locator('#cardDexOverlay').isHidden(), tag + ': dex close ' + id);
      }
      await setFixture(page);
      check(await page.locator('#myPlayZone [data-card-finish]').count() === 2, tag + ': two original choice buttons each contain one finish');
      const wrappers=await page.locator('#playHand,#playDrawn').evaluateAll(es=>es.map(e=>{const c=getComputedStyle(e),f=getComputedStyle(e.querySelector('.card-finish-face'));return {background:c.backgroundColor,border:c.borderTopColor,shadow:c.boxShadow,animation:c.animationName,transform:c.transform,faceAnimation:f.animationName};}));
      check(wrappers.every(c=>c.background==='rgba(0, 0, 0, 0)'&&c.border==='rgba(0, 0, 0, 0)'&&c.shadow==='none'&&c.animation==='none'&&c.transform==='none'),tag+': both stationary button backings are transparent');
      check(wrappers.every(c=>c.faceAnimation===(spec.touch?'none':'finishChoiceGlow')),tag+': glow belongs to moving face only, static on touch');
      if(!spec.touch){
        await sweepTilt(page,'#playHand [data-card-finish]',8,'choice-'+tag);
        const a=await page.locator('#playHand').boundingBox(),b=await page.locator('#playDrawn').boundingBox();
        await page.evaluate(()=>{window.__finishActions=[];});
        await page.mouse.click((a.x+a.width+b.x)/2,Math.max(a.y,b.y)+Math.min(a.height,b.height)/2);
        await page.waitForTimeout(80);
        check((await page.evaluate(()=>window.__finishActions)).length===0,tag+': gap does not select either card');
      }
      await expectAction(page,'#playHand','hand',spec.touch,tag + ': hand forwards exactly one original action');
      await expectAction(page,'#playDrawn','drawn',spec.touch,tag + ': drawn forwards exactly one original action');
      await setFixture(page,{frozen:true});
      check(await page.locator('#playHand').isDisabled(),tag + ': frozen hand is disabled');
      check(await page.locator('#playHand .card-finish-face').evaluate(e=>getComputedStyle(e).animationName)==='none',tag+': frozen card has no selection glow');
      await noAction(page,'#playHand',spec.touch,tag + ': frozen physical tap emits nothing');
      const frozen = await page.locator('#playHand').evaluate(e => {const mask=getComputedStyle(e,'::after');return {content:mask.content,background:mask.backgroundImage,opacity:mask.opacity,pointer:mask.pointerEvents,z:Number(mask.zIndex),childZ:Number(getComputedStyle(e.querySelector('[data-card-finish]')).zIndex)};});
      check(frozen.content !== 'none' && frozen.background.includes('freeze-mask') && Number(frozen.opacity)>0 && frozen.pointer==='none',tag + ': original ice mask survives');
      check(frozen.z>frozen.childZ,tag + ': ice mask remains above finish');
      await takeShot(page,'frozen-'+tag+'.png');
      await expectAction(page,'#playDrawn','drawn',spec.touch,tag + ': frozen player can play drawn');
      for (const pair of [{hand:7,tempDraw:8,blocked:'#playDrawn',allowed:'#playHand',which:'hand'},{hand:8,tempDraw:7,blocked:'#playHand',allowed:'#playDrawn',which:'drawn'}]) {
        await setFixture(page,pair);
        check(await page.locator(pair.blocked).isDisabled(),tag + ': Nami restriction ' + pair.hand);
        await noAction(page,pair.blocked,spec.touch,tag + ': Nami prohibited click is ignored ' + pair.hand);
        await expectAction(page,pair.allowed,pair.which,spec.touch,tag + ': Nami allowed click ' + pair.hand);
      }
      await setFixture(page);
      await page.evaluate(()=>{state.venues=[{name:CARD_VENUE[8]},{name:CARD_VENUE[3]}];render();});
      check(await page.locator('#imgHand').getAttribute('src')==='images/cards/8.webp' && await page.locator('#playHand [data-card-finish]').getAttribute('data-finish-surface')==='plain',tag + ': no premature foil before original enhancement swap');
      await page.waitForFunction(()=>['playHand','playDrawn'].every(id=>document.querySelector('#'+id+' [data-card-finish]').dataset.finishSurface==='foil'));
      await readyImages(page,'#imgHand,#imgDrawn');
      check(await page.locator('#imgHand').getAttribute('src')==='images/cards/enh/8.webp',tag + ': original enhancement completes first');
      await page.evaluate(()=>{state.myDeluxe=[8,3];render();}); await readyImages(page,'#imgHand,#imgDrawn');
      check(await page.locator('#imgHand').getAttribute('src')==='images/cards_lux/enh/8.webp' && await page.locator('#playDrawn [data-card-finish]').getAttribute('data-finish-surface')==='foil',tag + ': deluxe enhanced images recognized');
      const point = await center(page,'#playHand [data-card-finish]'); await page.mouse.move(point.x,point.y); await page.waitForTimeout(180);
      const face='#playHand .card-finish-face';
      if(spec.touch)check(await transformed(page,face)==='none',tag + ': choice static on touch');
      else check((await transformed(page,face)).startsWith('matrix3d'),tag + ': choice can tilt');
      const size=await page.locator('#imgHand,#imgDrawn').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {width:r.width,ratio:e.naturalWidth/e.naturalHeight,cssRatio:e.clientWidth/e.clientHeight};}));
      check(size.every(s=>s.width>70&&Math.abs(s.ratio-s.cssRatio)<.01),tag + ': both choice images preserve aspect');
      await takeShot(page,'choice-'+tag+'.png');
      await page.emulateMedia({reducedMotion:'reduce'}); await page.mouse.move(point.x+3,point.y+3);await page.waitForTimeout(80);
      check(await transformed(page,face)==='none',tag + ': reduced motion disables tilt');
      check(await page.locator(face).evaluate(e=>getComputedStyle(e).animationName)==='none',tag+': reduced motion disables face pulse');
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.evaluate(()=>{state.venues=[];render();});await readyImages(page,'#imgHand,#imgDrawn');
      await page.waitForFunction(()=>document.querySelector('#playHand [data-card-finish]').dataset.finishSurface==='plain');
      check(await page.locator('#imgHand').getAttribute('src')==='images/cards_lux/8.webp',tag + ': original plain image and finish return together');
      await page.evaluate(()=>{state.turnStep='draw';render();});
      check(await page.locator('#myPlayZone').isHidden(),tag + ': leaving choice hides original buttons');
      await ctx.close();
    }
    check(report.errors.length===0,'no page errors');report.result='PASS';
  } catch(error) {report.result='FAIL';report.failure=String(error);throw error;}
  finally {await browser.close();fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));console.log('CARD_FINISH_BROWSER_QA='+report.result+' checks='+report.checks.length);}
})().catch(e=>{console.error(e);process.exitCode=1;});
