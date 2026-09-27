'use strict';
// Exercise meaningful rejection paths in memory. Never change source, art,
// historical evidence, notices, catalogs or wallets while probing the gate.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const gate=require('./validate_release'),history=require('./validate_historical');
function run(root){const read=gate.reader(root),bind=file=>({path:file,sha256:history.sha256(read(file))}),review={art:bind(gate.ART_MANIFEST),gameBaseline:bind(gate.EVIDENCE_PREFIX+'game-baseline.json'),releaseScope:['desktop/main.js']},results=[];
 const reject=(name,action)=>{assert.throws(action,name);results.push({name,status:'PASS'});};
 const artMutation=(name,mutate)=>{const art=JSON.parse(read(gate.ART_MANIFEST));mutate(art);const bytes=Buffer.from(JSON.stringify(art)),fakeRead=file=>file===gate.ART_MANIFEST?bytes:read(file),fakeReview={...review,art:{path:gate.ART_MANIFEST,sha256:history.sha256(bytes)}};reject(name,()=>gate.validateArt(fakeRead,fakeReview));};
 gate.validateArt(read,review);gate.validateNotes(root,read);gate.validateGames(root,read,review);
 artMutation('rejects missing new view',art=>art.assets.pop());
 artMutation('rejects non-GPT provenance',art=>art.tool='unverified');
 artMutation('rejects unsupported furniture size',art=>art.assets.find(item=>item.path.includes('/furniture_views/')).width=768);
 artMutation('rejects mismatched directional scale',art=>art.assets.find(item=>item.path.includes('/furniture_views/')).uniformScale*=2);
 const asset=gate.EXPANSION_ASSETS[0];reject('rejects changed pixels with stale provenance',()=>gate.validateArt(file=>{const bytes=read(file);if(file!==asset)return bytes;const changed=Buffer.from(bytes);changed[changed.length-1]^=1;return changed;},review));
 const notePath='config/launcher-announcements-v1.json',noteMutation=(name,mutate)=>{const notes=JSON.parse(read(notePath));mutate(notes);const bytes=Buffer.from(JSON.stringify(notes));reject(name,()=>gate.validateNotes(root,file=>file===notePath?bytes:read(file)));};
 noteMutation('rejects changing a published old notice',notes=>notes.announcements.find(item=>item.requiredRelease?.version==='1.2.7').summary+=' changed');
 noteMutation('rejects unannounced expansion release',notes=>notes.announcements=notes.announcements.filter(item=>item.requiredRelease?.version!=='1.2.8'));
 noteMutation('rejects a parseable offset timestamp rejected by the serving validator',notes=>notes.announcements.find(item=>item.requiredRelease?.version==='1.2.8').publishedAt='2026-09-28T04:39:11.453256+08:00');
 noteMutation('rejects excess UTC timestamp precision rejected by the serving validator',notes=>notes.announcements.find(item=>item.requiredRelease?.version==='1.2.8').publishedAt='2026-09-27T20:39:11.453256Z');
 noteMutation('rejects unlocked preloaded character note',notes=>notes.announcements.push({id:'invalid-law-launch',status:'published',requiresCharacterId:'room-character-law'}));
 reject('rejects game edits in launcher scope',()=>gate.validateGames(root,read,{...review,releaseScope:['public/js/board_game.js']}));
 const gamePath='public/desktop/catalog-v3.json';reject('rejects changed game package catalog',()=>gate.validateGames(root,file=>file===gamePath?Buffer.from('{}'):read(file),review));
 return{schema:'launcher-expansion-release-gate-negative-qa/1',status:'PASS',checks:results.length,results,sourceHashes:Object.fromEntries([...gate.GATE_FILES,'tools/launcher-room/expansion-v128/negative_qa.js'].map(file=>[file,history.sha256(read(file))])),artManifestSha256:review.art.sha256,createdAt:new Date().toISOString()};
}
module.exports={run};
if(require.main===module){const root=process.argv[2]||path.resolve(__dirname,'../../..'),report=run(root),output=process.argv[3];if(output){fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});}console.log(JSON.stringify({status:report.status,checks:report.checks,output:output||null}));}
