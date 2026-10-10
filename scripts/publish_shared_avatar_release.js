'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{execFileSync}=require('child_process');
const P=require('../tools/desktop-r2-publisher/publish');
const root=path.resolve(__dirname,'..');
async function main(){
  const source=process.argv[2];assert(source&&path.isAbsolute(source),'Absolute reviewed package report required.');
  const report=JSON.parse(fs.readFileSync(source));assert.equal(report.status,'BUILT');
  assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim(),report.sourceCommit,'Publish only committed source revision.');
  const live=process.argv.includes('--live');let context;
  if(live){const config=P.loadLiveConfiguration(),sdk=require('@aws-sdk/client-s3');context={client:new sdk.S3Client(config),bucket:config.bucket,HeadObjectCommand:sdk.HeadObjectCommand,PutObjectCommand:sdk.PutObjectCommand};}
  const read=async(logical,expected)=>{
    const match=logical.match(/^images\/avatars\/(\d+)\.webp$/);
    const canonical=match&&Number(match[1])>=51&&Number(match[1])<=222?`images/board/avatars/${match[1]}.webp`:logical;
    assert(/^images\/(?:board\/)?avatars\/(?:\d+)\.webp$/.test(logical)||['start.html','profile.html','game.html'].includes(logical),'Unexpected delta path');
    const bytes=P.readGitHeadBlob(root,canonical);assert.equal(bytes.length,expected.size);assert.equal(P.sha256Bytes(bytes),expected.sha256);return bytes;
  };
  const results=[];try{
    const pending=report.records.slice();
    async function worker(){while(pending.length){const record=pending.shift();assert.equal(record.key,P.objectKeyForSha256(record.sha256));results.push({sha256:record.sha256,...await P.publishRecord(record,read,context)});if(results.length%25===0)console.log('Verified/uploaded '+results.length+'/'+report.records.length);}}
    const jobs=await Promise.allSettled(Array.from({length:4},()=>worker()));
    for(const job of jobs)if(job.status==='rejected')throw job.reason;
    results.sort((a,b)=>a.sha256.localeCompare(b.sha256));
    const result={status:'PASS',mode:live?'live':'dry-run',sourceCommit:report.sourceCommit,files:results.length,results};
    fs.writeFileSync(path.join(path.dirname(source),'publish-games-'+(live?'live':'dry')+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({status:'PASS',mode:result.mode,files:results.length}));
  }finally{context?.client.destroy();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
