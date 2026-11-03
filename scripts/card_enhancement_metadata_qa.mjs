import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const {chromium,webkit} = require('C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidate = process.env.CARD_METADATA_CANDIDATE === '1';
const base = candidate ? 'worktree' : (process.env.CARD_METADATA_BASE_REF || '82560b99d1dec6fdaa827342d41ce079b6b39f8c');
const source = candidate ? fs.readFileSync(path.join(root,'public/game.html'),'utf8') :
  execFileSync('git',['show',base+':public/game.html'],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
const marker = 'window.__cardOriginalEnhVideo = playEnhFxFor;';
const start = source.indexOf('const ENH_VID =');
const end = source.indexOf(marker,start) + marker.length;
assert.ok(start >= 0 && end > start, 'published media function boundaries');
const mediaSource = source.slice(start,end);
const moviePath = process.env.CARD_METADATA_MOVIE || 'C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html/public/videos/enh/1.mp4';
const movie = fs.readFileSync(moviePath);
const sha = data => createHash('sha256').update(data).digest('hex');
const modes = (process.env.CARD_METADATA_MODES || (candidate ? 'chromium' : 'chromium,webkit')).split(',');
const reportPath = process.env.CARD_METADATA_REPORT || 'D:/Codex_QA/card-android-metadata-20261104/'+(candidate?'candidate-prime.json':'preload-repro.json');
const report = {
  scope:(candidate ? 'Exact worktree inline prepare/play code; ' : 'Published inline prepare code; ')+'original MP4 bytes and native browser media APIs. Controlled test-only HTTP Range constraint holds sample data until first actual play() call. Chromium Android UA and WebKit here are desktop browser engines, not Android WebView hardware.',
  base,sourceSHA256:sha(source),mediaFunctionSHA256:sha(mediaSource),
  movie:{path:moviePath,size:movie.length,sha256:sha(movie)},checks:[],traces:{},ranges:[],passed:false,
};
const check = (name, ok, detail) => {
  report.checks.push({name,ok:!!ok,...(detail === undefined ? {} : {detail})});
  assert.ok(ok,name+': '+JSON.stringify(detail));
};
const startAt = performance.now();
const released = new Set();
const maxPreplay = 65536;
const server = http.createServer((req,res) => {
  const url = new URL(req.url,'http://localhost');
  if (url.pathname === '/probe') {
    const header = '<meta charset="utf-8"><style>.hidden{display:none}</style><main id="enhOverlay" class="hidden"><video id="enhVideo" muted playsinline></video></main>';
    return res.writeHead(200,{'content-type':'text/html; charset=utf-8'}).end(header);
  }
  if (url.pathname === '/play-started') {
    released.add(url.searchParams.get('case'));
    return res.writeHead(204).end();
  }
  if (url.pathname !== '/enh.mp4') return res.writeHead(404).end();
  const id = url.searchParams.get('case');
  const m = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  if (req.headers.range && !m) return res.writeHead(416,{'content-range':'bytes */'+movie.length}).end();
  const from = m ? Number(m[1]) : 0;
  const to = m?.[2] ? Math.min(movie.length-1,Number(m[2])) : movie.length-1;
  const status = m ? 206 : 200;
  const row = {id,range:req.headers.range||null,status,from,to,bytes:0,startMs:Math.round(performance.now()-startAt)};
  report.ranges.push(row);
  if (from > to) return res.writeHead(416,{'content-range':'bytes */'+movie.length}).end();
  res.writeHead(status,{'content-type':'video/mp4','content-length':to-from+1,
    'accept-ranges':'bytes','cache-control':'no-store',
    ...(status === 206 ? {'content-range':'bytes '+from+'-'+to+'/'+movie.length} : {})});
  if (id?.endsWith('-play-pending')) return res.end(movie.subarray(from,to+1));
  res.flushHeaders();
  let pos = from, timer;
  res.on('close',() => clearTimeout(timer));
  const send = () => {
    if (res.destroyed) return;
    if (pos > to) return res.end();
    // Let a tail request obtain the real moov atom. Constrain only early
    // sample data, as a resource that cannot buffer until it begins playback.
    const limit = released.has(id) || from > movie.length-32768 ? to+1 : Math.min(to+1,maxPreplay);
    const next = Math.min(limit,pos+32768);
    const advanced = next > pos;
    if (advanced) {
      const chunk = movie.subarray(pos,next);
      row.bytes += chunk.length;
      pos = next;
      res.write(chunk);
    }
    timer = setTimeout(send,advanced ? 8 : 25);
  };
  send();
});
const ua = 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/156.0.0.0 Mobile Safari/537.36 ONEPIECE_TABLETOP_ANDROID (Electron/44.1.1 compatibility)';
const browsers = new Set();
let origin;

async function scenario(browser,mode,kind) {
  const id = mode+'-'+kind;
  const p = await browser.newPage({isMobile:true,hasTouch:true,userAgent:ua});
  try {
    await p.goto(origin+'/probe');
    await p.evaluate(({candidate,kind,id}) => {
      window.isCpuSkipFastMode = () => false;
      window.__TABLETOP_ANDROID_GAME_UI__=true;
      window._enhFxForceTimer=null;
      window.wasPlayingBeforeDuck=false;
      window.rows = [];
      const v = document.getElementById('enhVideo');
      window.snapshot = () => {
        let buffered = 0;
        for (let i=0;i<v.buffered.length;i++) if (v.buffered.start(i)<=.05) {buffered=v.buffered.end(i);break;}
        return {ms:Math.round(performance.now()),readyState:v.readyState,width:v.videoWidth,buffered,
          time:v.currentTime,paused:v.paused,src:v.getAttribute('src'),hidden:v.parentElement.classList.contains('hidden')};
      };
      window.mark = type => rows.push({type,...snapshot()});
      for (const type of ['loadedmetadata','loadeddata','canplay','playing','pause','seeking','seeked','waiting','ended','error']) {
        v.addEventListener(type,() => mark(type));
      }
      for (const type of ['load','play','pause']) {
        const original = v[type].bind(v);
        let count=0;
        v[type] = (...args) => {
          mark('native-'+type);
          if (!candidate || type !== 'play') return original(...args);
          count++;
          if (kind==='play-pending'&&count<=2) {
            mark('injected-main-play-pending');
            return new Promise((resolve,reject)=>{
              (window.rejectOldPlayback??=[]).push(()=>reject(new DOMException('QA obsolete play','NotAllowedError')));
            });
          }
          if (kind==='prep-pending'&&count===1) {
            mark('injected-first-prime-pending');
            return new Promise((resolve,reject)=>{
              window.rejectOldPrime=()=>reject(new DOMException('QA obsolete prime','NotAllowedError'));
            });
          }
          if ((kind==='prep-gesture'&&count===1)||(kind==='play-gesture'&&(count===2||count===3))) {
            mark('injected-gesture-denial');
            return Promise.reject(new DOMException('QA autoplay policy','NotAllowedError'));
          }
          const promise=original(...args);
          const current=new URL(v.src).searchParams.get('case')||id;
          const allow=()=>{void fetch('/play-started?case='+current);};
          if(kind==='cancel'&&current===id)setTimeout(allow,1000);else allow();
          return promise;
        };
      }
    },{candidate,kind,id});
    await p.addScriptTag({content:mediaSource});
    await p.evaluate(id => {
      ENH_VID[1] = '/enh.mp4?case='+id;
      window.prepared = null;
      window.preparing = window.__prepareCardEnhVideo(1).then(ok => {window.prepared=ok;mark('prepared-'+ok);return ok;});
    },id);
    if (candidate) {
      const button=p.getByRole('button',{name:'點一下播放強化影片'});
      if (kind==='prep-gesture'||kind==='prep-pending') {
        await button.waitFor({state:'visible',timeout:4000});
        const prompt=await p.evaluate(()=>({snap:snapshot(),pending:window.prepared===null,
          offer:window.__readCardEnhVideoTrace().find(row=>row.type==='prime-tap-offered')}));
        check(id+' gives a real local tap before any overlay is revealed',
          prompt.snap.hidden&&prompt.pending&&prompt.offer?.detail===(kind==='prep-pending'?'pending':'gesture'),prompt);
        await button.click();
        if(kind==='prep-pending')await p.evaluate(()=>window.rejectOldPrime());
      }
      if (kind==='cancel') {
        await p.waitForFunction(()=>rows.some(row=>row.type==='native-play'),{},{timeout:2500});
        const old=await p.evaluate(async next=>{
          window.__cancelPreparedEnhVideo();
          const result=await window.preparing;
          ENH_VID[2]='/enh.mp4?case='+next;
          window.prepared=null;
          window.preparing=window.__prepareCardEnhVideo(2).then(ok=>{window.prepared=ok;return ok;});
          return result;
        },id+'-next');
        check(id+' cancelled source resolves false while its replacement loads',old===false);
      }
      await p.waitForFunction(()=>window.prepared===true,{},{timeout:5000});
      const prepared=await p.evaluate(()=>({snapshot:snapshot(),trace:window.__readCardEnhVideoTrace(),rows:rows.slice()}));
      const ready=prepared.trace.find(row=>row.type==='prepare-ready'&&(kind!=='cancel'||row.card===2));
      const readyWithoutPrime=kind==='play-pending';
      const preparedAsExpected=readyWithoutPrime
        ? ready?.detail==='buffer'&&!prepared.trace.some(row=>row.type==='prime-start')
        : !!ready&&['prime-frame','buffer-after-prime'].includes(ready.detail)&&
          prepared.trace.some(row=>row.type===(kind==='prep-gesture'||kind==='prep-pending'?'prime-tap':'prime-start')&&row.muted);
      check(id+(readyWithoutPrime?' ordinary preload is ready before the Android prime timer':' actual Android prime decodes and rewinds before ready'),
        preparedAsExpected && prepared.snapshot.hidden && prepared.snapshot.paused && prepared.snapshot.readyState>=2 &&
        prepared.snapshot.width===1920 && prepared.snapshot.time<.02,{ready,snapshot:prepared.snapshot});
      if(kind==='prep-pending'){
        check(id+' late rejection of the hung call cannot replace the tapped native play',
          prepared.rows.filter(row=>row.type==='native-play').length===2 &&
          prepared.trace.filter(row=>row.type==='prime-tap-offered').length===1 &&
          !prepared.trace.some(row=>row.type==='prime-rejected') && prepared.snapshot.src==='/enh.mp4?case='+id);
      }
      if(kind==='cancel'){
        check(id+' old callbacks do not mark cancelled source ready',
          prepared.trace.some(row=>row.card===1&&row.type==='prepare-cancel') &&
          !prepared.trace.some(row=>row.card===1&&row.type==='prepare-ready') && prepared.snapshot.src.endsWith('-next'));
      }
      if(kind==='auto'){
        const hidden=await p.evaluate(()=>{
          const before=rows.filter(row=>row.type==='native-play').length;
          Object.defineProperty(document,'hidden',{configurable:true,value:true});
          try {
            window.__cardOriginalEnhVideo(1);
            return {before,after:rows.filter(row=>row.type==='native-play').length,
              overlayHidden:snapshot().hidden,source:snapshot().src};
          } finally { delete document.hidden; }
        });
        check(id+' direct legacy call while backgrounded neither plays nor reveals the prepared source',
          hidden.before===hidden.after&&hidden.overlayHidden&&hidden.source===prepared.snapshot.src,hidden);
      }
      await p.evaluate(card=>window.__cardOriginalEnhVideo(card),kind==='cancel'?2:1);
      if(kind==='play-gesture'||kind==='play-pending'){
        await button.waitFor({state:'visible',timeout:5200});
        const prompt=await p.evaluate(()=>({loading:document.getElementById('enhOverlay').dataset.enhState==='loading',
          trace:window.__readCardEnhVideoTrace()}));
        const offer=prompt.trace.find(row=>row.type==='play-tap-offered');
        const retry=prompt.trace.find(row=>row.type==='play-muted');
        const delay=offer?.ms-retry?.ms;
        const pending=kind==='play-pending';
        check(id+' unmuted and muted attempts keep one manual fallback within the original deadline',
          await button.count()===1 && prompt.loading && offer?.detail===(pending?'pending':'gesture') &&
          (!pending||delay>=1900&&delay<3100),{offer,retry,delay});
        if(pending){
          await p.evaluate(()=>window.rejectOldPlayback.at(-1)());
          check(id+' a late denial leaves the already offered tap available',await button.isVisible());
        }
        await button.click();
        if(pending)await p.evaluate(()=>window.rejectOldPlayback[0]());
      }
      await p.waitForFunction(()=>window.__readCardEnhVideoTrace().some(row=>row.type==='play-close'&&row.detail==='ended'),{},{timeout:9500});
      const after=await p.evaluate(()=>({snapshot:snapshot(),trace:window.__readCardEnhVideoTrace(),rows:rows.slice()}));
      report.traces[id+'-candidate']=after.trace;
      const play=after.trace.find(row=>row.type==='playing');
      const ended=after.trace.find(row=>row.type==='play-close'&&row.detail==='ended');
      check(id+' original playback starts at opening frames and ends on same prepared file',
        play?.time<100 && ended?.time>=5000 && after.snapshot.hidden && after.snapshot.src===null &&
        after.rows.filter(row=>row.type==='native-load').length===(kind==='cancel'?4:2) &&
        (!['play-gesture','play-pending'].includes(kind)||after.trace.some(row=>row.type==='play-tap')),
        {startMs:play?.time,endMs:ended?.time,loads:after.rows.filter(row=>row.type==='native-load').length});
      if(kind==='play-pending'){
        check(id+' exactly one tapped third play recovers without old pending rejections resurfacing',
          after.rows.filter(row=>row.type==='native-play').length===3 &&
          after.trace.filter(row=>row.type==='play-tap-offered').length===1 &&
          after.trace.filter(row=>row.type==='play-rejected').length===1 &&
          after.trace.find(row=>row.type==='play-rejected').ms<after.trace.find(row=>row.type==='play-tap').ms);
      }
      check(id+' bounded diagnostic trace carries no URLs or credentials',
        after.trace.length<=48 && after.trace.every(row=>!('src'in row)&&!('url'in row)&&!('roomId'in row)&&!('secret'in row)));
      return;
    }
    if (kind === 'published') {
      await p.waitForTimeout(1700);
      const before = await p.evaluate(() => snapshot());
      check(id+' has no playable buffer while normal preparation awaits it',
        before.readyState < 3 && before.buffered < 2 && before.hidden,before);
      await p.waitForFunction(() => window.prepared === false,{}, {timeout:17000});
      const rows = await p.evaluate(() => window.rows);
      check(id+' reaches exact published 15s false without any first play()',
        !rows.some(r => r.type === 'native-play') && rows.at(-1)?.type === 'prepared-false' &&
        rows.at(-1).ms-rows[0].ms >= 14800,{elapsedMs:rows.at(-1)?.ms-rows[0]?.ms});
      check(id+' used genuine 206 and fetched the real tail metadata',
        report.ranges.some(r => r.id===id && r.status===206 && r.from>movie.length-32768 && r.bytes>0));
      return;
    }
    await p.waitForTimeout(650);
    const before = await p.evaluate(() => snapshot());
    check(id+' starts under the same unreadied buffer constraint',before.readyState < 3 && before.hidden,before);
    await p.evaluate(id => {
      const v = document.getElementById('enhVideo');
      v.muted = true;
      // The actual HTMLMediaElement play() starts before the readiness
      // promise. Only the fixture's transport release is injected.
      window.prime = v.play();
      window.prime.catch(() => {});
      void fetch('/play-started?case='+id);
    },id);
    await p.waitForFunction(() => window.prepared === true && rows.some(r => r.type==='playing') && snapshot().time>.06,
      {},{timeout:5500});
    const playing = await p.evaluate(() => snapshot());
    check(id+' native play activates real decode and progress before any visible layer',
      playing.hidden && playing.width === 1920 && playing.time > .06,playing);
    await p.evaluate(async () => {
      const v = document.getElementById('enhVideo');
      v.pause();
      const seek = new Promise(resolve => v.addEventListener('seeked',resolve,{once:true}));
      v.currentTime = 0;
      await seek;
    });
    const rewound = await p.evaluate(() => snapshot());
    check(id+' pauses and rewinds the same still-hidden source to its opening frame',
      rewound.hidden && rewound.paused && rewound.time < .03 && rewound.src === before.src,rewound);
    await p.evaluate(async () => {
      const v = document.getElementById('enhVideo');
      v.parentElement.classList.remove('hidden');
      await v.play();
    });
    await p.waitForFunction(() => rows.some(r => r.type==='ended'),{},{timeout:9000});
    const rows = await p.evaluate(() => window.rows);
    check(id+' visible playback ends normally without a second source load',
      rows.filter(r=>r.type==='native-load').length === 1 && rows.filter(r=>r.type==='native-play').length === 2 &&
      rows.some(r=>r.type==='playing'&&!r.hidden) && rows.at(-1).time >= 5.0,
      {duration:rows.at(-1).time});
  } finally {
    report.traces[id] = await p.evaluate(() => window.rows || []).catch(() => []);
    await p.close();
  }
}

try {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  origin = 'http://127.0.0.1:'+server.address().port;
  const results = await Promise.allSettled(modes.map(async mode => {
    assert.ok(mode==='chromium'||mode==='webkit');
    const b = mode==='webkit' ? await webkit.launch({headless:true}) :
      await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,
        args:['--autoplay-policy=no-user-gesture-required']});
    browsers.add(b);
    try {
      const kinds = process.env.CARD_METADATA_SCENARIOS?.split(',') ||
        (candidate ? ['auto','prep-gesture','prep-pending','play-gesture','play-pending','cancel'] : ['published','prime']);
      const scenarios = await Promise.allSettled(kinds.map(kind=>scenario(b,mode,kind)));
      for (const row of scenarios) if (row.status==='rejected') throw row.reason;
    } finally {
      await b.close();
      browsers.delete(b);
    }
  }));
  const errors = results.filter(r=>r.status==='rejected').map(r=>r.reason?.message);
  if (errors.length) throw Error(errors.join('; '));
  report.passed = true;
} catch (error) {
  report.error = error.message;
  process.exitCode = 1;
} finally {
  for (const b of browsers) await b.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  fs.mkdirSync(path.dirname(reportPath),{recursive:true});
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,error:report.error,reportPath}));
}