'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process');
const BASELINE='435cb91f44cb7674fbcfd5b9674a9d07cf469c05';
const FILE='server/desktop-distribution.js';
const PREFIX='tools/launcher-room/presentation-v126/review-evidence/formal-merge/';
const BEFORE=PREFIX+'desktop-distribution.before.js';
const OLD_RAW='0b7fb7242db21e5c1faa0d1b26c0c35e47afeb11a152d4efb867c4739525bc57';
const OLD_NORMALIZED='c9330072bab54d00370735b6fcc01bbcef76e101183dc42b9222e0f4d5769255';
const ANCHOR="  'LAUNCHER_LIFE_GET', 'LAUNCHER_LIFE_COMMAND',";
const ADDED="  'LAUNCHER_ANNOUNCEMENTS_GET', 'LAUNCHER_ANNOUNCEMENT_READ',";
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const normalize=bytes=>Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n'));
function insert(bytes){const text=bytes.toString('utf8');assert.equal(text.split(ANCHOR).length,2);assert(!text.includes(ADDED));const eol=text.includes(ANCHOR+'\r\n')?'\r\n':'\n';return Buffer.from(text.replace(ANCHOR+eol,ANCHOR+eol+ADDED+eol));}
function validate(root){
 const before=fs.readFileSync(path.join(root,BEFORE));assert.equal(sha(before),OLD_RAW);assert.equal(sha(normalize(before)),OLD_NORMALIZED);
 const base=cp.execFileSync('git',['cat-file','blob',BASELINE+':'+FILE],{cwd:root,windowsHide:true});
 const current=fs.readFileSync(path.join(root,FILE)),expected=insert(before),candidate=insert(base);
 assert([sha(normalize(expected)),sha(normalize(candidate))].includes(sha(normalize(current))),'Distribution allows only the two new launcher announcement events and retains existing Board policy');
 return {path:FILE,rawSha256:sha(expected),normalizedSha256:sha(normalize(expected)),reviewedBaseNormalizedSha256:sha(normalize(candidate)),reason:'Exact one-line insertion of announcement GET/READ events into the byte-pinned formal Board distribution; all other formal bytes preserved.',before:{path:BEFORE,sha256:OLD_RAW}};
}
module.exports={validate,insert,BEFORE,FILE,OLD_RAW,OLD_NORMALIZED};
if(require.main===module)console.log(JSON.stringify(validate(path.resolve(__dirname,'../../..'))));
