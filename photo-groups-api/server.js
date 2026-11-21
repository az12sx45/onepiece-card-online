'use strict';
const http=require('http');
const crypto=require('crypto');

const ORIGIN='https://tantan-lily-photo-groups-2026.onrender.com';
const PORT=Number(process.env.PORT||10000);
const MAX_ENTRIES=600;
const entries=[];
const subscribers=new Set();
const limits=new Map();
let serial=0;

function cors(req,res){
  const origin=req.headers.origin;
  if(origin && origin!==ORIGIN){
    res.writeHead(403,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    res.end(JSON.stringify({error:'來源不允許'}));
    return false;
  }
  res.setHeader('Access-Control-Allow-Origin',ORIGIN);
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Vary','Origin');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  return true;
}
function json(res,status,payload){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});
 res.end(JSON.stringify(payload));
}
function clean(s,max){
 return String(s||'').normalize('NFKC').replace(/[\u0000-\u001F\u007F-\u009F]/g,' ').replace(/\s{2,}/g,' ').trim().slice(0,max);
}
function ipHash(req){
 const raw=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim();
 return crypto.createHash('sha256').update(raw).digest('hex').slice(0,16);
}
function checkRate(k){
 const now=Date.now();
 if(limits.size>5000)for(const [id,ts] of limits){if(now-ts.last>3600e3)limits.delete(id)}
 const l=limits.get(k)||{last:0,times:[]};
 l.times=l.times.filter(t=>now-t<3600e3);
 if(now-l.last<15000) return 15;
 if(l.times.length>=12) return 3600-Math.floor((now-l.times[0])/1000);
 l.last=now;l.times.push(now);limits.set(k,l);
 return 0;
}
function broadcast(item){
 const msg='id: '+item.id+'\nevent: wish\ndata: '+JSON.stringify(item)+'\n\n';
 for(const response of subscribers){
   try{response.write(msg)}catch{ subscribers.delete(response) }
 }
}
function readJson(req){
 return new Promise((resolve,reject)=>{
   const chunks=[];let len=0;let stopped=false;
   req.on('data',chunk=>{len+=chunk.length;if(len>10000){stopped=true;reject(new Error('太長'));req.destroy()}else chunks.push(chunk)});
   req.on('end',()=>{if(stopped)return;try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))}catch{reject(new Error('JSON 格式錯誤'))}});
   req.on('error',reject);
 });
}
const server=http.createServer(async(req,res)=>{
 if(!cors(req,res))return;
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/health'&&req.method==='GET'){json(res,200,{ok:true,count:entries.length,version:1});return}
 if(url.pathname==='/api/wishes'&&req.method==='GET'){
   const after=Math.max(0,Number(url.searchParams.get('after')||0)||0);
   const last=entries.filter(w=>w.id>after).slice(-200);
   json(res,200,{wishes:last,latest:serial,persistent:false});
   return;
 }
 if(url.pathname==='/api/stream'&&req.method==='GET'){
   res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Connection':'keep-alive','Cache-Control':'no-cache, no-transform'});
   res.write('retry: 4000\n\n');
   const after=Math.max(0,Number(url.searchParams.get('after')||0)||0);
   for(const item of entries.filter(w=>w.id>after).slice(-120)){
      res.write('id: '+item.id+'\nevent: wish\ndata: '+JSON.stringify(item)+'\n\n');
   }
   subscribers.add(res);
   req.on('close',()=>subscribers.delete(res));
   return;
 }
 if(url.pathname==='/api/wishes'&&req.method==='POST'){
   if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json')){json(res,415,{error:'必須使用 JSON'});return}
   let item;
   try{item=await readJson(req)}catch{if(!res.writableEnded)json(res,400,{error:'訊息格式不正確'});return}
   if(!item || typeof item!=='object'){json(res,400,{error:'內容不正確'});return}
   const author=clean(item.author,20),message=clean(item.message,130);
   const style=Number(item.style),group=Number(item.group);
   if(author.length<1||message.length<2||message.length>120||!Number.isInteger(style)||style<1||style>10||!Number.isInteger(group)||group<1||group>15){
     json(res,400,{error:'請確認文字、組別及祝福框樣式'});return;
   }
   if(/(?:https?:\/\/|www\.|[A-Za-z0-9_-]{15,}\.(?:com|net|xyz|tw))/i.test(message)){
      json(res,400,{error:'祝福內容請不要放網址'});return;
   }
   const wait=checkRate(ipHash(req));
   if(wait){json(res,429,{error:'祝福已收到，請稍後再送另一則',retryAfter:wait});return}
   const wish={id:++serial,author,message,style,group,at:Date.now()};
   entries.push(wish);
   if(entries.length>MAX_ENTRIES)entries.shift();
   broadcast(wish);
   json(res,201,{ok:true,id:wish.id,wish});
   return;
 }
 json(res,404,{error:'找不到此頁'});
});
server.keepAliveTimeout=63000;
setInterval(()=>{
 for(const client of subscribers)try{client.write(': ping\n\n')}catch{subscribers.delete(client)}
},18000).unref();
server.listen(PORT,'0.0.0.0',()=>console.log('Wedding wishes service listening',PORT));
