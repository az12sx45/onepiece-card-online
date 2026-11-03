import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import {createRequire} from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const {chromium} = require('C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const web = process.env.CARD_ROGER_WEB || 'C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html/android/web';
const script = fs.readFileSync(path.join(web,'card-roger-prediction.js'));
const style = fs.readFileSync(path.join(web,'card-roger-prediction.css'));
const seatStyle = fs.readFileSync(path.join(web,'card-seat-hud.css'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const report = {scope:'Actual canonical Roger marker JS and CSS on real portrait markup with controlled committed STATE, Chrome layout.',
  source:{script:sha256(script),style:sha256(style),seatStyle:sha256(seatStyle)},checks:[],passed:false};
const output = process.env.CARD_ROGER_QA_REPORT || 'D:/Codex_QA/card-roger-prediction-20261104/report.json';
const check = (name,pass,detail) => {
  report.checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});
  assert.ok(pass,name+': '+JSON.stringify(detail));
};

const card = '<div class="phone-seat-card"><div class="phone-seat-copy"><div class="phone-seat-name">玩家</div><div class="phone-seat-gold">金幣 5</div></div><div class="phone-seat-status">護盾</div><span class="phone-seat-next" data-reason="roger">下局先手</span></div>';
const rows = [0,1,2,3,4,5].map(i=>'<div data-seat-id="'+i+'">'+card+'</div>').join('');
const fixture = '<!doctype html><html data-card-seat-hud data-card-phone data-card-fx data-card-piles data-card-stage data-card-hand-dock data-card-menu-layout="v3"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/seat.css"><link rel="stylesheet" href="/roger.css"></head><body><main><section class="phone-card-roster"><div id="players" style="--seat-count:6">'+rows+'</div></section></main><section id="phoneSelfDock"><div id="phoneSelfPlayer" data-seat-id="0">'+card+'</div></section><script>window.__TABLETOP_ANDROID_TEST_ORIGIN=location.origin;let state={phase:"playing",roundNo:1,players:[0,1,2,3,4,5].map(id=>({id})),nextRoundStart:1,rogerPred:null};function render(){return "preserved";}window.CardPhonePresentation={playerVisualElement(id){return id===0?document.getElementById("phoneSelfPlayer"):document.querySelector("#players > [data-seat-id=\\""+id+"\\"]");}};window.commit=(prediction,roundNo=state.roundNo)=>{state={...state,roundNo,rogerPred:prediction};return render();};</script><script src="/roger.js"></script></body></html>';
const server = http.createServer((req,res)=>{
  if (req.url==='/game.html') return res.writeHead(200,{'content-type':'text/html; charset=utf-8'}).end(fixture);
  if (req.url==='/roger.js') return res.writeHead(200,{'content-type':'text/javascript; charset=utf-8'}).end(script);
  if (req.url==='/roger.css') return res.writeHead(200,{'content-type':'text/css; charset=utf-8'}).end(style);
  if (req.url==='/seat.css') return res.writeHead(200,{'content-type':'text/css; charset=utf-8'}).end(seatStyle);
  res.writeHead(404).end();
});
let browser;
try {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page=await browser.newPage({viewport:{width:740,height:360}});
  await page.goto('http://127.0.0.1:'+server.address().port+'/game.html');
  const marker=page.locator('.phone-roger-prediction[data-player-id]');
  check('marker module mounts without initial prediction',await page.evaluate(()=>CardPhonePresentation.rogerPredictionVersion===1)&&await marker.count()===0);
  await page.evaluate(()=>{
    window.uncommittedState={...state,rogerPred:{by:0,pick:1}};
    const cutin=document.createElement('div');
    cutin.id='fake-active-cutin';document.body.append(cutin);
    render();
  });
  check('uncommitted result during cut-in does not mark a portrait',await marker.count()===0);
  const result=await page.evaluate(()=>{
    document.getElementById('fake-active-cutin').remove();
    return commit(uncommittedState.rogerPred);
  });
  await page.waitForFunction(()=>document.querySelector('.phone-roger-prediction'));
  const opponent=await page.evaluate(()=>{
    const tag=document.querySelector('.phone-roger-prediction');
    const card=tag.parentElement,tagBox=tag.getBoundingClientRect(),status=card.querySelector('.phone-seat-status');
    return {seat:card.parentElement.dataset.seatId,id:tag.dataset.playerId,text:tag.textContent,flag:card.querySelector('.phone-seat-next').textContent,
      status:status.textContent,width:tagBox.width,height:tagBox.height,color:getComputedStyle(tag).color};
  });
  check('committed target opponent receives one compact gold label and keeps normal flag and defense',result==='preserved' &&
    await marker.count()===1 && opponent.seat==='1' && opponent.id==='1' && opponent.text==='羅傑預測' && opponent.flag==='下局先手' &&
    opponent.status==='護盾' && opponent.height<=15 && opponent.width>opponent.height*2 &&
    opponent.color==='rgb(255, 227, 161)',opponent);
  await page.evaluate(()=>commit({by:2,pick:0}));
  await page.waitForFunction(()=>document.querySelector('#phoneSelfPlayer .phone-roger-prediction'));
  check('a self prediction is shown on the visible captain only',await marker.count()===1 &&
    await page.locator('#players .phone-roger-prediction').count()===0);
  await page.evaluate(()=>{
    const previous=document.querySelector('#phoneSelfPlayer > .phone-seat-card');
    const clone=previous.cloneNode(true);
    previous.replaceWith(clone);
  });
  await page.waitForFunction(()=>document.querySelector('#phoneSelfPlayer .phone-roger-prediction'));
  check('recreated captain DOM restores exactly one existing marker',await marker.count()===1);
  await page.evaluate(()=>commit(null,2));
  await marker.waitFor({state:'detached'});
  check('next round clears prediction and preserves ordinary flag',await marker.count()===0 &&
    await page.locator('#players > [data-seat-id="1"] .phone-seat-next[data-reason="roger"]').count()===1);
  await page.evaluate(()=>commit({by:3,pick:99}));
  check('unknown public target cannot label an unrelated seat',await marker.count()===0);
  report.passed=true;
} catch(error){
  report.error=error.message;process.exitCode=1;
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,error:report.error,report:output}));
}
