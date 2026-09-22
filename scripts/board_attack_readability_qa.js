'use strict';

// Reuse the established real battle/audio fixture; additional measurements below
// compare committed baseline sprites with the current local candidate. No rooms.
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
process.env.BOARD_QA_URL ||= 'http://127.0.0.1:18931';
process.env.BOARD_QA_OUTPUT ||= 'D:/Codex_QA/hotkeys-fx-20260922/attack';
process.env.BOARD_QA_ASSET_DECODE = '0';
const fixture = fs.readFileSync(path.join(__dirname,'board_move_fx_browser_qa.js'),'utf8');
const prefix = fixture.slice(0,fixture.indexOf('(async () => {'));
const body = String.raw`
async function recordDraws(page) {
  await page.evaluate(()=>{
    window.__readableDraws=[];
    const original=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=function(...args){
      const q=window.__fxQa;
      if(q?.running&&q.phase==='action'&&this.canvas.classList.contains('board-move-fx-canvas')) {
        window.__readableDraws.push({time:performance.now()-q.started,width:args[7],height:args[8],alpha:this.globalAlpha,frameX:args[1],frameY:args[2]});
      }
      return original.apply(this,args);
    };
  });
}
(async()=>{
  fs.mkdirSync(OUTPUT,{recursive:true});
  const root=path.resolve(__dirname,'..'),measurements=[];
  const {execFileSync}=require('node:child_process');
  const baseline=Object.fromEntries(['board_battle','board_move_fx'].map(name=>[name,execFileSync('git',['show','6c706729955b0e8efe1159f45c2285a78a347670:public/js/'+name+'.js'],{cwd:root,maxBuffer:4*1024*1024})]));
  const browser=await chromium.launch({headless:true,executablePath:CHROME,args:['--autoplay-policy=no-user-gesture-required']});
  try {
    for(const mode of ['before','after']) {
      const context=await browser.newContext({viewport:{width:1440,height:900}});
      await context.addInitScript(()=>{try{localStorage.setItem('op_board_user_id','892231');localStorage.setItem('op_board_client_id','qa-attack-readability');}catch(_){}});
      if(mode==='before')for(const[name,source]of Object.entries(baseline))await context.route('**/js/'+name+'.js*',r=>r.fulfill({contentType:'application/javascript',body:source}));
      const host=await context.newPage();monitor(host,mode+' host');await prepareBattle(host);
      const popup=context.waitForEvent('page');await host.evaluate(()=>window.open('board_battle.html?attack_readability_qa=1','_blank'));const page=await popup;
      monitor(page,mode+' battle');await page.waitForFunction(()=>window.__BOARD_BATTLE_DEBUG__?.latestView()?.battle);await instrument(page);await recordDraws(page);
      for(const spec of [
        {key:'desktop',width:1440,height:900,hits:[123]},
        {key:'landscape',width:932,height:430,hits:[123]},
        {key:'scaled-stage',width:1440,height:900,hits:[123],scale:.75},
        {key:'combo',width:1440,height:900,hits:[30,40,50]},
        {key:'spectator-combo',width:932,height:430,hits:[30,40,50],spectator:true},
      ]) {
        await page.setViewportSize({width:spec.width,height:spec.height});
        await page.evaluate(scale=>{const stage=document.getElementById('battleStage');stage.style.transform=scale?'scale('+scale+')':'';stage.style.transformOrigin='top left';window.__readableDraws=[];},spec.scale||0);
        const result=await runCase(page,{...spec,label:mode+'-'+spec.key,moveId:'luffy_pistol'},mode+'-'+spec.key+'.png');
        const data=await page.evaluate(()=>{const e=document.getElementById('battleStage'),r=e.getBoundingClientRect();return {draws:__readableDraws,stage:{width:e.clientWidth,height:e.clientHeight,screenWidth:r.width,screenHeight:r.height}};});
        const impacts=result.fxPlays.filter(p=>p.phase==='impact'),launches=result.fxPlays.filter(p=>p.phase==='launch');
        const windows=impacts.map((p,i)=>{const end=i<impacts.length-1?launches[i+1]?.time:Infinity;const rows=data.draws.filter(d=>d.time>=p.time&&d.time<end);return {at:p.time,last:rows.at(-1)?.time,duration:rows.length?rows.at(-1).time-p.time:0,width:rows.find(d=>d.alpha>.5)?.width,height:rows.find(d=>d.alpha>.5)?.height,alphaVisible:result.samples.some(s=>s.alpha>0&&s.time>=p.time+(i===impacts.length-1&&mode==='after'?p.duration+140:p.duration-100)&&s.time<p.time+(i===impacts.length-1&&mode==='after'?p.duration+240:p.duration))};});
        const last=windows.at(-1),expected=(spec.hits.length>1?420:700)+(mode==='after'?240:0);
        check(mode+' '+spec.key+': last impact remains visible to intended end',last.duration>=expected-85&&last.duration<=expected+100&&last.alphaVisible,{expected,last});
        if(spec.hits.length>1)check(mode+' '+spec.key+': early hits finish before next launch',windows.slice(0,-1).every((w,i)=>w.duration>=340&&w.duration<=465&&w.last<launches[i+1].time),windows);
        measurements.push({mode,key:spec.key,windows,stage:data.stage,launches,impacts});
      }
      await context.close();
    }
    for(const key of ['desktop','landscape','scaled-stage','combo','spectator-combo']){
      const before=measurements.find(m=>m.mode==='before'&&m.key===key),after=measurements.find(m=>m.mode==='after'&&m.key===key);
      const ratios=after.windows.map((w,i)=>w.width/before.windows[i].width);
      check(key+': measured attack dimensions grow 30 percent',ratios.every(n=>Math.abs(n-1.3)<.001),ratios);
      check(key+': contact times unchanged',after.impacts.every((v,i)=>Math.abs(v.time-before.impacts[i].time)<100),{before:before.impacts,after:after.impacts});
      check(key+': last visible tail increases about 240ms',Math.abs((after.windows.at(-1).duration-before.windows.at(-1).duration)-240)<90,{before:before.windows.at(-1),after:after.windows.at(-1)});
    }
    report.measurements=measurements;check('no browser JavaScript errors',report.errors.length===0,report.errors);
  }finally{await browser.close();}
})().catch(e=>{report.fatal=e.stack;console.error(e);}).finally(()=>{report.ok=!report.fatal&&report.checks.every(c=>c.pass);fs.writeFileSync(path.join(OUTPUT,'readability-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,failed:report.checks.filter(c=>!c.pass).map(c=>c.name),fatal:report.fatal,output:OUTPUT}));if(!report.ok)process.exitCode=1;});
`;
new Function('require','__dirname',prefix+body)(require,__dirname);
