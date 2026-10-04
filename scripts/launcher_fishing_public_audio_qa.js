'use strict';

const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const directory='audio/launcher_room/pixabay_fishing_v1';
const expected=new Map([
  ['reel_in_fast.ogg','0bba6c5ca6478f9aed58db21c2061a7724f12841df4a697a2795ad5551dd70d8'],
  ['line_out_drag.ogg','272bfd01799aee0edeb4f9daa8bb86cc70ea263bc35bd89b09c31b03f1c81971'],
  ['line_strain.ogg','856fe1b51061add470111b2309f4afad9045fd5ca290fe53d7cd6fbbb1bafb7d']
]);
const provenance=JSON.parse(fs.readFileSync(path.join(root,'docs/LAUNCHER_FISHING_AUDIO_R11_20261004.json'),'utf8'));
assert.equal(provenance.schema,'launcher-fishing-audio-r11-provenance-v1');
assert.equal(provenance.contentRevision,11);
assert.deepEqual(provenance.selectedAudio.map(item=>item.gamePath).sort(),
  ['reel_in_fast.ogg','line_out_drag.ogg'].map(name=>`public/${directory}/${name}`).sort());
for(const item of provenance.selectedAudio){
  const name=path.basename(item.gamePath);
  assert.equal(item.gameSHA256,expected.get(name),`${name} differs from reviewed R11 provenance.`);
  assert.equal(item.gameBytes,fs.statSync(path.join(root,item.gamePath)).size,
    `${name} byte count differs from reviewed R11 provenance.`);
  assert.equal(new URL(item.sourcePage).host,'pixabay.com');
}
assert.equal(provenance.unchangedAudio.gameSHA256,expected.get('line_strain.ogg'));
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
