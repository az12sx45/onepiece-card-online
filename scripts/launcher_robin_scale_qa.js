'use strict';
// Real Chromium and production room/atlas drawing. Isolated accounts and clock;
// autonomous life decisions are paused only to keep comparison actors together.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),Module=require('node:module');
const overlay=path.resolve(__dirname,'..'),root=path.resolve(process.env.LAUNCHER_ROBIN_SOURCE_ROOT||overlay);
const readPath=file=>fs.existsSync(path.join(overlay,file))?path.join(overlay,file):path.join(root,file);
const out=path.resolve(process.env.LAUNCHER_ROBIN_SCALE_QA_OUT||path.join(root,'tools/launcher-room/presentation-v127/review-evidence/robin-scale'));
assert(!fs.existsSync(out),'Use a fresh output directory');fs.mkdirSync(out,{recursive:true});
process.env.LAUNCHER_LIFE_INTEGRATION_OUT=out;
const keys=['luffy','nami','robin','sanji'],directions=['east','west','north','south'];
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const files=['launcher-room.js','launcher-room.css','launcher-room-motion.js','launcher-room-motion-data.js','launcher-life-actions.js','launcher-life-room.js','launcher.html'];
const bindings=()=>Object.fromEntries(files.map(file=>[file,sha(fs.readFileSync(readPath('desktop/'+file)))]));
const startedSources=bindings(),results=[],captures=[];
const helperPath=path.join(root,'scripts/launcher_radial_fixture.js');let source=fs.readFileSync(helperPath,'utf8');
source=source.replace("const read=file=>fs.readFileSync(fs.existsSync(path.join(root,'desktop',file))?path.join(root,'desktop',file):path.join(sourceRoot,'desktop',file),'utf8');",`const overlay=${JSON.stringify(overlay)};const read=file=>fs.readFileSync(fs.existsSync(path.join(overlay,'desktop',file))?path.join(overlay,'desktop',file):path.join(sourceRoot,'desktop',file),'utf8');`);
source=source.replace("const file=path.resolve(sourceRoot,'public',rel);", "const file=fs.existsSync(path.resolve(overlay,'public',rel))?path.resolve(overlay,'public',rel):path.resolve(sourceRoot,'public',rel);");
source=source.replace("return file.startsWith(path.join(sourceRoot,'public')+path.sep)&&fs.existsSync(file)?", "return (file.startsWith(path.join(sourceRoot,'public')+path.sep)||file.startsWith(path.join(overlay,'public')+path.sep))&&fs.existsSync(file)?");
const anchor='    await page.addScriptTag({content:read(file)});';assert(source.includes(anchor));
source=source.replace(anchor,anchor+"\n    if(file==='launcher-life.js')await page.evaluate(()=>{const original=OnePieceLife;window.OnePieceLife={...original,create:options=>({...original.create(options),tick:()=>{}})};});");
const helper=new Module(helperPath,module);helper.filename=helperPath;helper.paths=Module._nodeModulePaths(path.dirname(helperPath));helper._compile(source,helperPath);const fixture=helper.exports;
async function shot(page,name){const file=path.join(out,name+'.png');await page.locator('#roomStage').screenshot({path:file});captures.push({name,path:path.basename(file),sha256:sha(fs.readFileSync(file))});}
async function fresh(owned=keys){const f=await fixture.create({owned});await f.page.evaluate(async keys=>{for(const key of keys){await OnePieceRoomMotion.preloadActions(key).promise;for(const action of ['work','read','eat','rest','sleep','train'])for(const direction of ['east','west','north','south']){const r=OnePieceLifeActions.preload(key,action,direction);if(r)await r.promise;}}},owned);return f;}
async function pixels(page){return page.evaluate(keys=>keys.filter(key=>document.querySelector('[data-room-key="c:room-character-'+key+'"]')).map(key=>{const node=document.querySelector('[data-room-key="c:room-character-'+key+'"]'),canvas=node.querySelector('canvas');const data=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height).data;let left=canvas.width,top=canvas.height,right=0,bottom=0,opaque=0;for(let i=3;i<data.length;i+=4)if(data[i]>24){const p=(i-3)/4,x=p%canvas.width,y=Math.floor(p/canvas.width);left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);opaque++;}const box=canvas.getBoundingClientRect(),shell=node.getBoundingClientRect(),stage=document.getElementById('roomStage').getBoundingClientRect();return{key,source:node.dataset.actionSource,frame:node.dataset.motionFrame,pose:node.dataset.pose,cell:canvas.width,bounds:[left,top,right,bottom],logicalBounds:[left,top,right,bottom].map(v=>v/canvas.width*128),bodyWidth:(right-left)/canvas.width*box.width,bodyHeight:(bottom-top)/canvas.height*box.height,feetY:box.y+bottom/canvas.height*box.height-stage.y,rootY:shell.bottom-stage.y,scale:Number(getComputedStyle(node).getPropertyValue('--room-character-scale')),opaque};}),keys);}
async function pose(page,kind,direction='south',frame=0){return page.evaluate(({keys,kind,direction,frame})=>{for(const key of keys){const node=document.querySelector('[data-room-key="c:room-character-'+key+'"]'),canvas=node.querySelector('canvas');node.classList.add('has-directional-sprite');canvas.hidden=false;canvas.style.setProperty('--room-root-offset','12.5%');if(kind==='walk'){OnePieceRoomMotion.draw(canvas,OnePieceRoomMotion.preload(key).atlases[direction],frame);node.dataset.actionSource='motion_v4';}else if(kind==='acting'){OnePieceRoomMotion.draw(canvas,OnePieceRoomMotion.preloadActions(key).atlases[direction],frame,OnePieceRoomMotion.ACTION_SHAPE);node.dataset.actionSource='acting_v4';}else{const action=OnePieceLifeActions.supported(key,kind)?kind:'work';if(!OnePieceLifeActions.draw(canvas,key,action,direction,frame*OnePieceLifeActions.CLIPS[action].frameMs))throw Error('Missing life clip');node.dataset.actionSource='life_v1';}node.dataset.pose=kind;node.dataset.motionFrame=String(frame);}}, {keys,kind,direction,frame});}
function pass(name,detail={}){results.push({name,status:'PASS',...detail});console.log('PASS '+name);}
(async()=>{const browser=await fixture.chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-web-security']});fixture.setBrowser(browser);
try{
  const f=await fresh(),page=f.page;
  try{
    await pose(page,'acting');const current=await pixels(page);const robin=current.find(x=>x.key==='robin'),nami=current.find(x=>x.key==='nami');
    assert(current.every(x=>x.opaque>0));assert(current.every(x=>Math.abs(x.rootY-robin.rootY)<.05),'comparison at equal floor depth');
    pass('equal-depth-crew-standing',{actors:current,robinToNamiHeight:robin.bodyHeight/nami.bodyHeight});await shot(page,'desktop-standing');
    const originalScale=await page.evaluate(()=>OnePieceRoomMotionManifest.characters.robin.displayScale);assert.equal(originalScale,1.03,'Keep existing slightly taller Robin display height');
    await page.evaluate(async()=>{const image=new Image();image.src='opui://launcher/images/launcher_room/acting_v4/robin/south.webp';await image.decode();const canvas=document.querySelector('[data-room-key="c:room-character-robin"] canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,256,256);ctx.drawImage(image,0,0,256,256,0,0,256,256);});
    const before=await pixels(page);await shot(page,'desktop-standing-before');
    await pose(page,'acting');
    pass('prior-art-comparison-only-robin-pixels-vary-height-scale-unchanged',{before,after:await pixels(page),originalScale});
    const frames=[];
    for(const direction of directions)for(const kind of ['walk','acting','work','read'])for(let frame=0;frame<(kind==='acting'?8:4);frame++){
      await pose(page,kind,direction,frame);const actors=await pixels(page);frames.push({kind,direction,frame,actors});
      for(const a of actors){assert(a.bounds[0]>0&&a.bounds[1]>0&&a.bounds[2]<a.cell&&a.bounds[3]<a.cell,'Unclipped complete figure '+a.key);if(a.key==='robin')assert(Math.abs(a.feetY-a.rootY)<3,'Robin ground anchor remains stable');}
      if(frame===0&&(kind==='walk'||kind==='work'))await shot(page,'desktop-'+kind+'-'+direction);
    }
    for(const kind of ['eat','rest','sleep','train'])for(let frame=0;frame<4;frame++){await pose(page,kind,'south',frame);const actors=await pixels(page);frames.push({kind,direction:'south',frame,actors});const a=actors.find(x=>x.key==='robin');assert(Math.abs(a.feetY-a.rootY)<2,'Robin life ground anchor');if(frame===0)await shot(page,'desktop-'+kind);}
    fs.writeFileSync(path.join(out,'all-rendered-frames.json'),JSON.stringify(frames,null,2));
    pass('complete-authoring-pixel-bounds-all-directions-actions-and-life',{frameSets:frames.length,actorFrames:frames.length*keys.length});
    const upright=frames.filter(f=>f.kind==='walk'||f.kind==='acting'&&f.frame!==5||['work','read','eat','train'].includes(f.kind)).map(f=>f.actors.find(x=>x.key==='robin').bodyHeight);
    assert(Math.max(...upright)/Math.min(...upright)<1.07,'No upright walk/action/life size jump');pass('robin-upright-height-does-not-jump-between-sources',{min:Math.min(...upright),max:Math.max(...upright)});
    await page.setViewportSize({width:390,height:844});await pose(page,'acting');await shot(page,'narrow-standing');await pose(page,'train');await shot(page,'narrow-training');
    const narrow=await page.evaluate(()=>({viewport:innerWidth,body:document.body.scrollWidth,stage:document.getElementById('roomStage').getBoundingClientRect().width,container:document.querySelector('.room-stage-scroll').getBoundingClientRect().width}));assert(narrow.body<=narrow.viewport+1);pass('390px-contained-room-and-readable-figures',{...narrow});assert.deepEqual(f.errors,[]);
  }finally{await page.close();}
  for(const direction of directions){const f=await fresh(['robin']),page=f.page;try{
    assert(await page.evaluate(({keys,direction})=>keys.every(key=>{__launcherRoomTest.lifeCancel(key);const w=__launcherRoomTest.snapshot().walkers.find(v=>v.key===key);return __launcherRoomTest.route(key,{col:w.cell.col+(direction==='east'?3:direction==='west'?-3:0),row:w.cell.row+(direction==='south'?3:direction==='north'?-3:0)});}),{keys:['robin'],direction}));
    const trail=[];for(let i=0;i<20;i++){await fixture.advance(page,100);trail.push({state:await fixture.snap(page),pixels:await pixels(page)});if([3,7,11,15].includes(i))await shot(page,'route-'+direction+'-'+i);}
    fs.writeFileSync(path.join(out,'route-'+direction+'.json'),JSON.stringify(trail,null,2)); for(const key of ['robin']){const moving=trail.flatMap(t=>t.pixels.filter(n=>n.key===key&&n.pose==='walk'));assert(new Set(moving.map(x=>x.frame)).size===4,'distance-driven route must show all four '+key+' frames');}
    const movingPixels=trail.flatMap(t=>t.pixels.filter(a=>a.pose==='walk'));assert(movingPixels.length>=8&&movingPixels.every(a=>a.cell===384),'Native HD walking canvas preserved; standing turn pause uses 256px acting art');
    assert.deepEqual(f.errors,[]);fs.writeFileSync(path.join(out,'route-'+direction+'.json'),JSON.stringify(trail,null,2));pass('actual-distance-driven-route-'+direction,{samples:trail.length,nativeCell:384});
  }finally{await page.close();}}
  const completedSources=bindings();assert.deepEqual(completedSources,startedSources,'Source changed during QA');
  const report={schema:'one-piece-robin-scale-qa/1',status:'PASS',generatedAt:new Date().toISOString(),checks:results.length,results,captures,startedSources,completedSources,testScriptSha256:sha(fs.readFileSync(__filename)),humanAcceptance:false,scope:'Real headless Chromium production renderer and route controller; isolated IPC and paused autonomous decisions. Web security disabled only for canvas alpha readback. Does not establish protocol security, human visual acceptance, real account purchase, or deployment.'};fs.writeFileSync(path.join(out,'ROBIN_SCALE_QA.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:'PASS',checks:results.length,out}));
}finally{await browser.close();}})().catch(error=>{fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:error.stack,results},null,2));console.error(error);process.exitCode=1;});
