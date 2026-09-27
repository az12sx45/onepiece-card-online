'use strict';
// Actual Chromium: native canvas/backing pixels and paired legacy/HD presentation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..');
const {chromium}=require(path.join(root,'scripts/launcher_radial_fixture'));
const out=path.join(__dirname,'review-evidence');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const normalizedSha=file=>crypto.createHash('sha256').update(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')).digest('hex');
const keys=['luffy','zoro','nami','usopp','sanji','chopper','robin','franky','brook','jinbe'];
async function main(){
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.json'),'utf8'));
  fs.mkdirSync(out,{recursive:true});
  // Isolated screenshot/readback fixture only. The app's opui protocol is
  // verified separately by its packaged smoke; Chrome has no protocol handler.
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-web-security']});
  const results=[],evidence=[];
  try{
    for(const dpr of [1,2]){
      const context=await browser.newContext({viewport:{width:1160,height:900},deviceScaleFactor:dpr});
      const page=await context.newPage();
      await page.route('opui://**',route=>{
        const rel=decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//,'');
        const file=path.resolve(root,'public',rel);
        return file.startsWith(path.join(root,'public')+path.sep)&&fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:'Missing'});
      });
      await page.setContent('<html><head><style>body{margin:0;background:#17363e;color:#eed9ac;font:14px Arial}h1{font-size:20px;margin:18px}#grid{display:grid;grid-template-columns:76px repeat(4,252px);gap:4px;padding:18px}.title{text-align:center}.label{align-self:center}.sample{height:264px;display:flex;align-items:flex-end;justify-content:center;border-bottom:1px solid #607d7f;position:relative}.sample span{position:absolute;top:2px;left:6px;color:#c2d4d5;font-size:11px}.sample canvas{width:244px;height:244px}</style></head><body><h1>Original whole bodies / current 1.5x art scale / DPR '+dpr+'</h1><div id="grid"></div></body></html>');
      await page.addScriptTag({content:fs.readFileSync(path.join(root,'desktop/launcher-room-motion.js'),'utf8')});
      const checks=await page.evaluate(async({keys,dpr})=>{
        const api=window.OnePieceRoomMotion,records=[],grid=document.querySelector('#grid');
        for(const label of ['Crew','Idle128 before','Idle256 after','Walk128 before','Walk384 after']){const el=document.createElement('div');el.textContent=label;el.className='title';grid.append(el);}
        function assert(value,message){if(!value)throw new Error(message);}
        for(const key of keys){
          const walk=api.preload(key),act=api.preloadActions(key);await Promise.all([walk.promise,act.promise]);
          assert(Object.keys(walk.errors).length===0&&Object.keys(act.errors).length===0,'decode '+key);
          for(const [kind,record,shape,cell] of [['walk',walk,api.WALK_SHAPE,384],['idle',act,api.ACTION_SHAPE,256]]){
            for(const direction of api.DIRECTIONS){
              const canvas=document.createElement('canvas');
              for(let frame=0;frame<shape.frames;frame++){
                assert(api.draw(canvas,record.atlases[direction],frame,shape),'draw '+key);
                assert(canvas.width===cell&&canvas.height===cell,'native backing '+key);
                const pixels=canvas.getContext('2d').getImageData(0,0,cell,cell).data;
                let ink=0,edge=0;for(let y=0;y<cell;y++)for(let x=0;x<cell;x++){const alpha=pixels[(y*cell+x)*4+3];if(alpha)ink++;if((x===0||y===0||x===cell-1||y===cell-1)&&alpha)edge++;}
                assert(ink>100&&edge===0,'body clipped/empty '+key+'/'+direction+'/'+frame);
              }
              let writes=0;for(const property of ['width','height']){const descriptor=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,property);Object.defineProperty(canvas,property,{get(){return descriptor.get.call(this);},set(v){writes++;descriptor.set.call(this,v);}});}
              canvas.getBoundingClientRect=()=>{throw new Error('Per-frame layout read');};
              for(let frame=0;frame<100;frame++)api.draw(canvas,record.atlases[direction],frame%shape.frames,shape);
              assert(writes===0,'reallocated unchanged backing');
              assert(canvas.getContext('2d').imageSmoothingEnabled&&canvas.getContext('2d').imageSmoothingQuality==='high','smoothing');
              records.push({key,kind,direction,dpr,cell,frames:shape.frames,stableBackingDraws:100,layoutReads:0,clippedFrames:0});
            }
          }
          const label=document.createElement('div');label.className='label';label.textContent=key;grid.append(label);
          for(const [kind,version,record,shape,cell,direction] of [
            ['acting',3,act,api.ACTION_SHAPE,128,'south'],['acting',4,act,api.ACTION_SHAPE,256,'south'],
            ['motion',3,walk,api.WALK_SHAPE,128,'east'],['motion',4,walk,api.WALK_SHAPE,384,'east']]){
            const box=document.createElement('div');box.className='sample';const canvas=document.createElement('canvas');
            if(version===3){const img=new Image();img.src=`opui://launcher/images/launcher_room/${kind}_v3/${key}/${direction}.webp`;await img.decode();canvas.width=128;canvas.height=128;canvas.getContext('2d').drawImage(img,0,0,128,128,0,0,128,128);}
            else api.draw(canvas,record.atlases[direction],0,shape);
            const note=document.createElement('span');note.textContent=cell+'px → 244 CSS px / '+244*dpr+' device px';box.append(note,canvas);grid.append(box);
          }
        }
        return records;
      },{keys,dpr});
      results.push(...checks);
      const file=path.join(out,'quality-paired-dpr'+dpr+'.png');await page.locator('body').screenshot({path:file});
      evidence.push({path:path.relative(root,file).replaceAll('\\','/'),sha256:sha(file),dpr,cssCanvas:244,physicalCanvas:244*dpr});
      await context.close();
    }
    assert.equal(results.length,160);
    const report={ok:true,schema:'one-piece-room-hd-quality-qa/1',renderer:{path:'desktop/launcher-room-motion.js',sha256:sha(path.join(root,'desktop/launcher-room-motion.js')),normalizedSha256:normalizedSha(path.join(root,'desktop/launcher-room-motion.js')),hashNormalization:'CRLF to LF only; all other bytes remain significant'},script:{path:'tools/launcher-room/hd-v4/quality_qa.js',sha256:sha(__filename)},manifest:{path:'tools/launcher-room/hd-v4/manifest.json',sha256:sha(path.join(__dirname,'manifest.json'))},checks:results.length,totalFrameChecks:results.reduce((n,r)=>n+r.frames,0),stableBackingDraws:results.reduce((n,r)=>n+r.stableBackingDraws,0),results,evidence,
      scope:'Real headless Chrome DPR1/2 isolated readback fixture with web security disabled for routed opui assets; this does not verify packaged protocol security. Same authored legacy versus HD frames at244 CSSpx (covers current1366px viewport,1216.6pxroom,near-frontFranky at1.5x and1.32body scale), native backing, decoded images and every frame alpha. No new artwork or human acceptance.',visualAcceptance:false,humanAcceptance:false};
    fs.writeFileSync(path.join(out,'QUALITY_QA.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({ok:true,checks:report.checks,frames:report.totalFrameChecks,stableBackingDraws:report.stableBackingDraws,evidence}));
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
