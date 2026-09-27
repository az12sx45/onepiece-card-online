'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const historical=require('../presentation-v122/validate_historical_life');
const {webpSize}=require('../validate-fullbody-manifest');
const KEYS=Object.freeze(['ace','sabo','law','hancock']);
const DIRECTIONS=Object.freeze(['east','west','north','south']);
const RELATIVE=Object.freeze(['portrait.webp',...['walk','acting'].flatMap(kind=>DIRECTIONS.map(direction=>`${kind}/${direction}.webp`)),
  ...DIRECTIONS.map(direction=>`life/work-${direction}.webp`),...['eat','rest','sleep','train'].map(action=>`life/${action}-south.webp`)]);
const ASSETS=Object.freeze(KEYS.flatMap(key=>RELATIVE.map(file=>`public/images/launcher_room/reserved_v1/${key}/${file}`)));
const MANIFEST='tools/launcher-room/reserved-v1/manifest.json';
const PREFIX='tools/launcher-room/reserved-v1/';
const SHEETS=Object.freeze({'master':[2,2],'walk-side':[3,2],'walk-front':[3,2],'acting-side':[4,4],'acting-front':[4,4],'work':[4,4],'utility':[4,4]});
const POSES=Object.freeze(['idle','talk_happy','talk_annoyed','surprised','focused_use','sit','wave','listen']);
const WALK=Object.freeze(['step-a','neutral','step-c','neutral']);
function readBound(root,ref){
  assert(ref&&typeof ref.path==='string','Expected bound reserved evidence');assert.match(ref.sha256,/^[a-f0-9]{64}$/);
  const bytes=fs.readFileSync(historical.safePath(root,ref.path));assert.equal(historical.sha256(bytes),ref.sha256,'Reserved evidence changed: '+ref.path);
  if(ref.bytes!==undefined)assert.equal(bytes.length,ref.bytes,'Reserved evidence byte count changed: '+ref.path);return bytes;
}
function pngSize(bytes){assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Expected PNG');return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];}
function numbers(value,length,label){assert(Array.isArray(value)&&value.length===length&&value.every(Number.isFinite),label);}
function near(actual,expected,label){assert(Number.isFinite(actual)&&Math.abs(actual-expected)<=1e-10*Math.max(1,Math.abs(expected)),label);}
function bounds(value,cell,label){numbers(value,4,label);assert(value.every(Number.isInteger)&&value[0]>0&&value[1]>0&&value[2]>value[0]&&value[3]>value[1]&&value[2]<cell&&value[3]<cell,label);}
function noAnatomy(value){
  if(!value||typeof value!=='object')return;
  for(const [key,child] of Object.entries(value)){assert(!['parts','head','limbs','rig','bones','flip','mirror','rotate','shear','stretch'].includes(key),'Anatomy assembly or nonuniform transforms are forbidden');noAnatomy(child);}
}
function artBound(root,ref){assert(ref?.path.startsWith(PREFIX),'New art provenance must remain in reserved-v1');assert(Number.isInteger(ref.bytes)&&ref.bytes>0,'Preserve provenance byte count');return readBound(root,ref);}
function jsonBound(root,ref){return JSON.parse(artBound(root,ref).toString('utf8').replace(/^\uFEFF/,''));}
function sourceSelection(item,index){
  const direction=item.direction,side=['east','west'].includes(direction),row=['east','north'].includes(direction)?0:1;
  if(item.kind==='portrait')return {sheet:'master',cell:[1,1],pose:'idle'};
  if(item.kind==='walk')return {sheet:side?'walk-side':'walk-front',cell:[[0,1,2,1][index],row],pose:WALK[index]};
  if(item.kind==='acting')return {sheet:side?'acting-side':'acting-front',cell:[index%4,row*2+Math.floor(index/4)],pose:POSES[index]};
  return {sheet:item.action==='work'?'work':'utility',cell:[index,item.action==='work'?DIRECTIONS.indexOf(direction):['eat','rest','sleep','train'].indexOf(item.action)],pose:item.action};
}
function validate(root,suppliedManifest){
  // Artwork is unfinished until the exporter supplies the agreed provenance
  // and actual pixel QA. A missing/partial manifest can never satisfy this gate.
  const manifest=suppliedManifest||JSON.parse(fs.readFileSync(historical.safePath(root,MANIFEST),'utf8'));
  assert.equal(manifest.schema,'one-piece-room-reserved-art/1','Reserved art requires its completed provenance schema');
  assert.equal(manifest.status,'PASS','Reserved art export is incomplete');
  assert.equal(manifest.version,'1.2.5');
  assert.equal(manifest.canonicalCharactersOnly,true);
  assert.equal(manifest.releasePolicy,'preloaded-not-released');
  assert.equal(manifest.fixtureSources,false,'Synthetic fixture sources cannot enter a release');
  assert.equal(manifest.visualAccepted,false,'Pixel export cannot claim art acceptance');assert.equal(manifest.humanAcceptance,false);
  assert.equal(manifest.requiresIndependentVisualReview,true);
  assert.equal(manifest.exportContractFinalized,true,'Reserved exporter and actual pixel QA have not been finalized');
  assert.deepEqual(manifest.poseOrder,[...POSES]);assert.deepEqual(manifest.walkOrder,[...WALK]);
  assert.deepEqual(manifest.items.map(item=>item.asset).sort(),[...ASSETS].sort(),'Exactly 68 reserved assets are required');
  const rules=manifest.processingRules;
  assert.equal(rules.wholeFigureOnly,true);assert.equal(rules.anatomyReassembled,false);assert.equal(rules.mirrored,false);
  assert.equal(rules.targetStandingHeightAt128,100);assert.deepEqual(rules.rootAt128,[64,112]);assert.equal(rules.edgeAaRadius,2);
  assert(/complete-image uniform scale/.test(rules.transforms)&&/no per-frame size fit/.test(rules.transforms));
  assert.equal(manifest.importer.path,PREFIX+'import_atlases.py');artBound(root,manifest.importer);
  assert.equal(manifest.legacyExtractor.path,'tools/launcher-room/import_fullbody_v3.py');readBound(root,manifest.legacyExtractor);
  assert.equal(manifest.originalSelection.path,PREFIX+'original-selection.json');const original=jsonBound(root,manifest.originalSelection);
  assert.equal(manifest.resolvedSelection.path,PREFIX+'resolved-selection.json');const resolved=jsonBound(root,manifest.resolvedSelection);
  for(const selection of [original,resolved]){
    assert.equal(selection.schema,'one-piece-room-reserved-selection/1');assert.equal(selection.releasePolicy,'preloaded-not-released');
    assert.deepEqual(Object.keys(selection.characters).sort(),[...KEYS].sort());noAnatomy(selection.characters);
    assert.deepEqual(Object.keys(selection.sources).sort(),Object.keys(manifest.sources).sort());
  }
  assert.deepEqual(original.characters,resolved.characters,'Whole-character calibration changed after selection');
  assert.deepEqual(resolved.sources,manifest.sources,'Resolved sources differ from exported provenance');
  assert.equal(Object.keys(manifest.sources).length,28,'Require four complete seven-sheet GPT source sets');
  const sourceMap=new Map(),byKey=Object.fromEntries(KEYS.map(key=>[key,new Map()]));
  for(const [id,source] of Object.entries(manifest.sources)){
    assert.match(id,/^[a-z0-9][a-z0-9_-]{0,79}$/);assert(KEYS.includes(source.key));assert(Object.hasOwn(SHEETS,source.sheet));
    assert.equal(source.generator,'gpt-image','Only genuine GPT sources may be released');
    assert(!byKey[source.key].has(source.sheet),'Duplicate source sheet');byKey[source.key].set(source.sheet,id);sourceMap.set(id,source);
    for(const field of ['key','sheet','generator','cells','standingReference','ancestry','processing'])assert.deepEqual(source[field],original.sources[id][field],'Original source selection changed: '+id+'/'+field);
    for(const field of ['image','prompt','receipt'])assert.deepEqual(source[field],{...original.sources[id][field],bytes:source[field].bytes},'Original source binding changed');
    assert(source.image.path.endsWith('.png'));assert.deepEqual(pngSize(artBound(root,source.image)),source.dimensions);
    const prompt=artBound(root,source.prompt).toString('utf8').replace(/^\uFEFF/,'').trim();assert(prompt.length>=12&&!(prompt.endsWith('.txt')&&!prompt.includes('\n')),'Actual generation prompt is required');
    const receipt=jsonBound(root,source.receipt);assert(receipt&&typeof receipt==='object'&&!Array.isArray(receipt)&&Object.keys(receipt).length>0,'Actual generation receipt is required');
    const inputHashes=new Set([source.image.sha256]);
    for(const field of ['ancestry','processing']){assert(Array.isArray(source[field]||[]));for(const ref of source[field]||[]){artBound(root,ref);inputHashes.add(ref.sha256);}}
    if(receipt.sourceSha256){assert(inputHashes.has(receipt.sourceSha256),'Receipt does not bind selected source or ancestry');if(receipt.sourceSha256!==source.image.sha256)assert(source.processing?.length>0,'Processed source requires processing evidence');}
    noAnatomy(source.cells||{});noAnatomy(source.standingReference||{});
    const calibration=source.standingCalibration;assert.deepEqual(calibration,resolved.sourceCalibration[id]);
    assert(calibration.standingHeight>0&&Number.isFinite(calibration.standingHeight));assert.equal(calibration.opaqueBounds[3],calibration.standingHeight);
    assert.equal(calibration.frame.source,id);assert.equal(calibration.frame.key,source.key);assert.equal(calibration.frame.pose,'calibration-standing');
  }
  const scales={};
  for(const key of KEYS){
    assert.deepEqual([...byKey[key].keys()].sort(),Object.keys(SHEETS).sort());
    const config=original.characters[key],scale=config.outputScale??1;assert(Number.isFinite(scale)&&scale>0&&scale<=1);
    if(scale!==1)assert(typeof config.outputScaleReason==='string'&&config.outputScaleReason.trim().length>=12);
    const masterHeight=sourceMap.get(byKey[key].get('master')).standingCalibration.standingHeight;
    scales[key]={masterHeight,uniform:100/masterHeight*scale};
  }
  assert.equal(manifest.pixelQa.path,PREFIX+'pixel-qa.json');const pixel=jsonBound(root,manifest.pixelQa);
  assert.equal(pixel.schema,'one-piece-room-reserved-pixel-qa/1');assert.equal(pixel.ok,true);assert.equal(pixel.assetCount,68);assert.equal(pixel.frameCount,324);assert.equal(pixel.humanAcceptance,false);
  assert(/Actual lossless WebP decode/.test(pixel.scope)&&/not art or animation acceptance/.test(pixel.scope),'Keep actual pixel QA separate from visual acceptance');
  assert.deepEqual(pixel.items.map(item=>item.asset).sort(),[...ASSETS].sort());
  const pixels=new Map(pixel.items.map(item=>[item.asset,item]));let totalBytes=0,frameCount=0;
  for(const item of manifest.items){
    assert(KEYS.includes(item.key));assert(item.asset.startsWith(`public/images/launcher_room/reserved_v1/${item.key}/`));
    const relative=item.asset.slice(`public/images/launcher_room/reserved_v1/${item.key}/`.length),kind=relative==='portrait.webp'?'portrait':relative.split('/')[0];
    assert.equal(item.kind,kind);assert(DIRECTIONS.includes(item.direction));
    const cell=kind==='walk'?384:256,columns=kind==='portrait'?1:kind==='acting'?8:4;
    assert.equal(item.cell,cell);assert.equal(item.columns,columns);assert.deepEqual(item.dimensions,[cell*columns,cell]);
    if(kind==='portrait'){assert.equal(item.direction,'south');assert.equal(item.action,undefined);}else if(kind==='life')assert.equal(relative,`life/${item.action}-${item.direction}.webp`);else{assert.equal(relative,`${kind}/${item.direction}.webp`);assert.equal(item.action,undefined);}
    const bytes=readBound(root,{path:item.asset,sha256:item.sha256,bytes:item.bytes});assert(item.bytes>0);totalBytes+=bytes.length;
    assert.deepEqual(webpSize(bytes),item.dimensions,'Reserved WebP dimensions changed');
    assert.equal(item.frames.length,columns);assert.deepEqual(item.sourceIds,[...new Set(item.frames.map(frame=>frame.source))].sort());
    const p=pixels.get(item.asset);assert.equal(p.sha256,item.sha256);assert.deepEqual(p.dimensions,item.dimensions);assert.equal(p.hasAlpha,true);assert.equal(p.frames.length,columns);
    assert.equal(item.report.path,`${PREFIX}reports/${item.key}/${item.action||kind}-${item.direction}.json`);
    const report=jsonBound(root,item.report);assert.equal(report.schema,'one-piece-room-reserved-import-report/1');assert.equal(report.key,item.key);assert.equal(report.asset,item.asset);
    assert.deepEqual(report.dimensions,item.dimensions);assert.equal(report.cell,cell);assert.equal(report.columns,columns);assert.deepEqual(report.root,[cell/2,cell*7/8]);
    assert.deepEqual(report.frames,item.frames);assert.deepEqual(report.sourceIds,item.sourceIds);assert.equal(report.visualAccepted,false);assert.equal(report.humanAcceptance,false);
    for(let index=0;index<columns;index++){
      const frame=item.frames[index],source=sourceMap.get(frame.source),expected=sourceSelection(item,index);assert(source,'Missing frame source');
      assert.equal(source.key,item.key);assert.equal(source.sheet,expected.sheet);assert.equal(frame.index,index);assert.equal(frame.key,item.key);assert.equal(frame.direction,item.direction);assert.equal(frame.pose,expected.pose);assert.deepEqual(frame.sourceCell,expected.cell);
      assert.equal(frame.anatomyReassembled,false);assert.equal(frame.mirrored,false);assert.equal(frame.clipped,false);assert.match(frame.rgbaSha256,/^[a-f0-9]{64}$/);
      bounds(frame.bounds,cell,'Frame has clipped alpha bounds');bounds(frame.opaqueBoundsAtOutput,cell,'Frame has clipped opaque bounds');
      assert(frame.opaqueBoundsAtOutput[2]-frame.opaqueBoundsAtOutput[0]<=Math.ceil(112*cell/128),'Figure exceeds safe width');
      numbers(frame.region,4,'Invalid source region');assert(frame.region.every(Number.isInteger)&&frame.region[0]>=0&&frame.region[1]>=0&&frame.region[2]>0&&frame.region[3]>0&&frame.region[0]+frame.region[2]<=source.dimensions[0]&&frame.region[1]+frame.region[3]<=source.dimensions[1]);
      numbers(frame.sourceAnchor,2,'Invalid source anchor');numbers(frame.localAnchor,2,'Invalid local anchor');numbers(frame.sourceAlphaBounds,4,'Invalid source alpha bounds');numbers(frame.opaqueBounds,4,'Invalid source opaque bounds');
      assert(Number.isInteger(frame.opaquePixels)&&frame.opaquePixels>0);assert(Number.isInteger(frame.removedDistantAlphaPixels)&&frame.removedDistantAlphaPixels>=0);assert.equal(frame.edgeAaRadius,2);
      assert(Array.isArray(frame.sourceAaTouchesImageBoundary)&&frame.sourceAaTouchesImageBoundary.length===4&&frame.sourceAaTouchesImageBoundary.every(value=>typeof value==='boolean'));
      near(frame.sourceUnitScale,scales[item.key].masterHeight/source.standingCalibration.standingHeight,'Source standing calibration changed');near(frame.uniformCharacterScale,scales[item.key].uniform,'Frames must share character scale');
      const scale=frame.sourceUnitScale*frame.uniformCharacterScale*cell/128;near(frame.wholeImageScale,scale,'Whole-body scale differs');numbers(frame.inverseWholeImageTransform,6,'Invalid whole-body transform');
      const transform=[1/scale,0,frame.localAnchor[0]-cell/2/scale,0,1/scale,frame.localAnchor[1]-cell*7/8/scale];frame.inverseWholeImageTransform.forEach((value,i)=>near(value,transform[i],'Nonuniform or shifted body transform'));
      const pf=p.frames[index];assert.equal(pf.index,index);assert.equal(pf.rgbaSha256,frame.rgbaSha256);assert.deepEqual(pf.bounds,frame.bounds);assert.deepEqual(pf.opaqueBounds,frame.opaqueBoundsAtOutput);assert.deepEqual(pf.alphaExtrema,[0,255]);assert.equal(pf.clipped,false);frameCount++;
    }
    if(kind==='walk')assert.equal(item.frames[1].rgbaSha256,item.frames[3].rgbaSha256,'Walk neutral slots must repeat the same complete figure');
  }
  assert.equal(frameCount,324);
  assert.deepEqual(manifest.contactSheets.map(item=>item.key).sort(),[...KEYS].sort(),'Every character requires one complete contact sheet');
  for(const contact of manifest.contactSheets){assert.equal(contact.path,`${PREFIX}contacts/${contact.key}.png`);assert.equal(contact.frameCount,81);assert.deepEqual(contact.dimensions,[1536,2112]);assert.deepEqual(pngSize(artBound(root,contact)),contact.dimensions);}
  return {complete:true,assets:ASSETS.length,frames:frameCount,sources:sourceMap.size,totalBytes,manifest,pixel};
}
module.exports={KEYS,DIRECTIONS,RELATIVE,ASSETS,MANIFEST,readBound,validate};
