'use strict';

const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

const root=path.resolve(__dirname,'..');
const directory='audio/launcher_room/pixabay_fishing_v1';
const expected=new Map([
  ['reel_in_fast.ogg','6afa2406345448a4ee6fc9fc2ef3b88a508c1519fe3518f33f53b6216849f66f'],
  ['line_out_drag.ogg','e3b05cad60b01354829b798b0ed87e121a443a5ce08559b8612b2f5c7e09c17d'],
  ['line_strain.ogg','da30ac86421c85b64f4eea3c94aaf3218aef47bbcc7200ff5ead5e6c4e10a1a2']
]);
const provenance=JSON.parse(fs.readFileSync(path.join(root,'docs/LAUNCHER_FISHING_AUDIO_R15_20261005.json'),'utf8'));
assert.equal(provenance.schema,'launcher-fishing-audio-r15-candidate-v1');
assert.deepEqual(provenance.audio.map(item=>item.path).sort(),
  [...expected.keys()].map(name=>`public/${directory}/${name}`).sort());
for(const item of provenance.audio){
  const name=path.basename(item.path);
  assert.equal(item.newAudio.sha256,expected.get(name),`${name} differs from reviewed R15 provenance.`);
  assert.equal(item.newAudio.bytes,fs.statSync(path.join(root,item.path)).size,
    `${name} byte count differs from reviewed R15 provenance.`);
  assert.equal(new URL(item.previousSource.sourcePage).host,'pixabay.com');
}
assert(provenance.licenseEvidence.some(item=>item.source==='https://opengameart.org/content/fisheefects'&&item.license.includes('CC0')));
assert(provenance.licenseEvidence.some(item=>item.source==='https://opengameart.org/content/swishes-sound-pack'&&item.license==='CC0'));
const files=fs.readdirSync(path.join(root,'public',directory)).sort();
assert.deepEqual(files,[...expected.keys()].sort(),'Only reviewed public fishing sounds may be distributed.');
let totalBytes=0;
for(const [name,hash] of expected){
  const bytes=fs.readFileSync(path.join(root,'public',directory,name));
  assert.equal(bytes.subarray(0,4).toString('ascii'),'OggS',`${name} is not Ogg audio.`);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hash,`${name} differs from reviewed audio.`);
  totalBytes+=bytes.length;
}
const packageJson=JSON.parse(fs.readFileSync(path.join(root,'desktop/package.json'),'utf8'));
const resources=packageJson.build.extraResources.filter(item=>item.to.startsWith('launcher-assets/audio/launcher_room/'));
assert.deepEqual(resources,[{
  from:'../public/audio/launcher_room/pixabay_fishing_v1',
  to:'launcher-assets/audio/launcher_room/pixabay_fishing_v1',
  filter:[...expected.keys()]
}],'The full installer must contain only the reviewed public fishing sounds.');
const source=fs.readFileSync(path.join(root,'desktop/launcher-room-minigames.js'),'utf8');
assert(!source.includes('fishing_master_v1'),'Public renderer must not reference private extracted audio.');
for(const name of expected.keys())assert(source.includes(name),`Fishing renderer does not load ${name}.`);
const inlineHashes=new Map([
  ['cast','51463751bab683db4190abac7751cfa4231412afe887efe8c88a4d9548f95468'],
  ['splash','1ea66110ff281dfe10a31f0314852c031f072d629e813d4576b1b07177bdc2c8']
]);
assert.deepEqual(provenance.inlineBank.assets.map(item=>item.event).sort(),['cast','flick','splash']);
for(const item of provenance.inlineBank.assets.filter(item=>inlineHashes.has(item.event))){
  const match=source.match(new RegExp(`\\b${item.event}:'([A-Za-z0-9+/=]+)'`));
  assert(match,`Missing inline ${item.event} game effect.`);
  const bytes=Buffer.from(match[1],'base64');
  assert.equal(bytes.subarray(0,4).toString('ascii'),'OggS');
  assert.equal(bytes.length,item.encodedBytes);
  assert.equal(hash(bytes),item.outputSHA256);
  assert.equal(item.outputSHA256,inlineHashes.get(item.event));
}
const revision16=JSON.parse(fs.readFileSync(path.join(root,'docs/LAUNCHER_FISHING_AUDIO_R16_20261005.json'),'utf8'));
assert.equal(revision16.schema,'launcher-fishing-audio-r16-candidate-v1');
assert(revision16.licenseSources.some(item=>item.officialPage==='https://kenney.nl/assets/interface-sounds'&&item.license.includes('CC0')));
const r16Hashes=new Map([
  ['anticipation','9bc89f6d7bc548f8ebc3f838540a7a2abc57fe8a55740a3f93af314ed37ad0c2'],
  ['direction','306486d9df15c147e9be612fe120864e83742b3efcdd90954644b8cc2e032140'],
  ['bite','62a28aa2ed99240d7544f6c4b5d2f3d5bb759c2ebe66ff22ada68a4ed15a9c66'],
  ['hook','ed62e98719a3f4df1be55abeffcd1609c2442479f75153a2c1d58274be797db5'],
  ['flick','15cfb1a27f749e870ff7af909fcaf7813373cd3d4771c8e148f0dbdc04c89cae']
]);
assert.deepEqual(revision16.derivedInlineClips.map(item=>item.name).sort(),[...r16Hashes.keys()].sort());
for(const item of revision16.derivedInlineClips){
  const match=source.match(new RegExp(`\\b${item.name}:'([A-Za-z0-9+/=]+)'`));
  assert(match,`Missing inline R16 ${item.name} sound.`);
  const bytes=Buffer.from(match[1],'base64');
  assert.equal(bytes.subarray(0,4).toString('ascii'),'OggS');
  assert.equal(bytes.length,item.bytes);
  assert.equal(hash(bytes),item.outputSha256);
  assert.equal(item.outputSha256,r16Hashes.get(item.name));
  assert(item.sourceParts.every(part=>part.license.includes('CC0')&&/^https:\/\//.test(part.sourcePage)));
}
const main=fs.readFileSync(path.join(root,'desktop/main.js'),'utf8');
const resolverSource=main.match(/function resolveLauncherResource\(requestUrl\) \{[\s\S]*?\r?\n\}/)?.[0];
assert(resolverSource,'Launcher asset resolver was not found.');
const resolveResource=vm.runInNewContext(`(${resolverSource})`,{
  URL,path,LAUNCHER_SCHEME:'opui',launcherResourceRoot:()=>path.join(root,'public')
});
for(const name of expected.keys()){
  const relative=`${directory}/${name}`;
  assert.equal(resolveResource(`opui://launcher/${relative}`),path.join(root,'public',relative),
    `Packaged public audio is unreachable: ${name}.`);
}
assert(totalBytes<50000,'Fishing audio content update unexpectedly grew.');
assert.equal(resolveResource(`opui://launcher/${directory}/unreviewed.ogg`),null);
for(const name of ['reel_in_loop.ogg','line_out_loop.ogg',
  'direction_left.ogg','direction_right.ogg','direction_up.ogg'])
  assert.equal(resolveResource(`opui://launcher/${directory}/${name}`),null,
    `${name} is not an installed 1.2.23 resource path.`);
assert.equal(resolveResource('opui://launcher/audio/launcher_room/fishing_master_v1/se_click_play_reel_in.ogg'),null);
console.log(`LAUNCHER_FISHING_PUBLIC_AUDIO_QA=PASS clips=${expected.size} bytes=${totalBytes}`);
