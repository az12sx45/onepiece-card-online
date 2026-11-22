'use strict';
const http=require('node:http');
const crypto=require('node:crypto');
const sharp=require('sharp');
const {createStore,ensureDeletionSchema}=require('./storage');
const segmenter=new Intl.Segmenter('zh-TW',{granularity:'grapheme'});
const countText=value=>[...segmenter.segment(value)].length;
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const clean=value=>String(value??'').normalize('NFC').replace(/[\u0000-\u001F\u007F-\u009F]/g,' ').replace(/\s{2,}/g,' ').trim();
class ApiError extends Error {constructor(status,message,code){super(message);this.status=status;if(code)this.code=code;}}
function json(res,status,payload){if(res.writableEnded)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(payload));}
function readJson(req){return new Promise((resolve,reject)=>{const chunks=[];let size=0,tooBig=false;req.on('data',chunk=>{size+=chunk.length;if(size>240000){tooBig=true;return;}chunks.push(chunk);});req.on('end',()=>{if(tooBig)return reject(new ApiError(413,'照片或內容太大，請重新選擇照片'));try{const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!data||typeof data!=='object'||Array.isArray(data))throw new Error();resolve(data);}catch{reject(new ApiError(400,'JSON 格式不正確'));}});req.on('error',reject);});}
function requireJson(req){if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw new ApiError(415,'必須使用 JSON');}
function integer(value,min,max,fallback){const n=Number(value??fallback);if(!Number.isInteger(n)||n<min||n>max)throw new ApiError(400,'請確認組別、樣式及頁碼');return n;}
async function rows(store,sql,params=[]){return (await store.query(sql,params))[0]?.results||[];}
async function one(store,sql,params=[]){return (await rows(store,sql,params))[0];}
async function normalizeWish(input,{importing=false}={}){
  const author=clean(input.guest_name??input.author),message=clean(input.blessing_text??input.message);
  const style=integer(input.style_id??input.style,1,10,1),group=integer(input.group_number??input.group,1,15);
  const avatarGender=input.avatar_gender===undefined?'unspecified':input.avatar_gender;
  if(!['male','female','unspecified'].includes(avatarGender))throw new ApiError(400,'請重新選擇預設頭像');
  if(countText(author)<1||countText(author)>20||[...author].length>100)throw new ApiError(400,'署名請填 1～20 字');
  const graphemes=countText(message);
  if(graphemes<1||graphemes>30||[...message].length>300)throw new ApiError(400,'祝福最多 30 字（Emoji 算一字）');
  if(/(?:https?:\/\/|www\.|[A-Za-z0-9_-]{15,}\.(?:com|net|xyz|tw))/i.test(message))throw new ApiError(400,'祝福內容請不要放網址');
  const avatar=String(input.avatar||'');let image=null;
  if(avatar){
    if(!importing&&input.consent!==true)throw new ApiError(400,'請確認照片及公開展示授權');
    if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(avatar))throw new ApiError(400,'頭像需要壓縮後的 JPEG 照片');
    const buffer=Buffer.from(avatar.split(',')[1],'base64');
    if(!buffer.length||buffer.length>153600)throw new ApiError(413,'照片須小於 150 KB');
    try{
      const meta=await sharp(buffer,{limitInputPixels:16777216,failOn:'error'}).metadata();
      if(meta.format!=='jpeg'||!meta.width||!meta.height||meta.width>4096||meta.height>4096)throw new Error();
      // Authenticated backups already contain the canonical stripped thumbnail.
      // Preserve its bytes so restoring the same backup keeps the same avatar ID.
      let output=importing&&meta.width===480&&meta.height===480&&!meta.orientation&&!meta.exif?buffer:await sharp(buffer,{limitInputPixels:16777216}).rotate().resize(480,480,{fit:'cover',position:'centre'}).jpeg({quality:82,mozjpeg:true}).toBuffer();
      if(output.length>153600)output=await sharp(output).jpeg({quality:60,mozjpeg:true}).toBuffer();
      if(output.length>153600)throw new Error();
      image={id:hash(output),base64:output.toString('base64'),bytes:output.length};
    }catch{throw new ApiError(400,'無法讀取這張照片，請重新選擇 JPEG 照片');}
  }
  const key=String(input.idempotencyKey??input.submission_key??'');
  if(key&&!/^[A-Za-z0-9_-]{12,100}$/.test(key))throw new ApiError(400,'送出識別碼不正確');
  const content={author,message,style,group,avatar:image?.id||null};
  // The default has the same meaning as the field absent in v2 submissions.
  // Keep that canonical hash unchanged so old pending UUID retries stay valid.
  if(avatarGender!=='unspecified')content.avatar_gender=avatarGender;
  return {author,message,graphemes,style,group,image,avatarGender,key:key||`legacy_${crypto.randomUUID()}`,requestHash:hash(JSON.stringify(content))};
}
async function createApp(env=process.env){
  const store=await createStore(env);
  if(env.D1_AUTO_MIGRATE==='true'&&store.mode==='d1')await store.migrate();
  // This additive capability does not depend on a deployment env-var change.
  // It never rewrites or purges existing wishes, including legacy soft deletes.
  const deletionReady=await ensureDeletionSchema(store);
  // Refuse to listen if credentials or schema are unusable, even when Render's
  // service still has its default TCP readiness check.
  await store.query('SELECT id,avatar_gender FROM wishes LIMIT 0');
  await store.query('SELECT id FROM playback_state WHERE id=1');
  const origins=new Set((env.ALLOWED_ORIGINS||'https://tantan-lily-photo-groups-2026.onrender.com').split(',').map(s=>s.trim()).filter(Boolean));
  const subscribers=new Set();let stopped=false,mutationTail=Promise.resolve(),polling=false;
  const serialize=fn=>{const task=mutationTail.then(fn);mutationTail=task.catch(()=>{});return task;};
  const publicBase=(env.PUBLIC_API_URL||'').replace(/\/$/,'');
  function present(w){return {id:w.id,author:w.guest_name,message:w.blessing_text,style:w.style_id,group:w.group_number,at:w.created_at,guest_name:w.guest_name,blessing_text:w.blessing_text,group_number:w.group_number,style_id:w.style_id,created_at:new Date(w.created_at).toISOString(),avatar_path:w.avatar_id?`${publicBase}/api/avatars/${w.id}`:null,avatar_gender:w.avatar_gender??'unspecified',moderation_status:w.moderation_status};}
  function authorize(req){
    const expected=String(env.ADMIN_TOKEN||''),supplied=String(req.headers.authorization||'').replace(/^Bearer /,'');
    if(expected.length<24)throw new ApiError(503,'管理員授權尚未設定');
    const suppliedBytes=Buffer.from(supplied),expectedBytes=Buffer.from(expected);
    if(suppliedBytes.length!==expectedBytes.length||!crypto.timingSafeEqual(suppliedBytes,expectedBytes))throw new ApiError(401,'需要管理員授權');
  }
  function cors(req,res){
    const origin=req.headers.origin;
    res.setHeader('Vary','Origin');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
    if(origin&&!origins.has(origin))throw new ApiError(403,'來源不允許');
    if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Access-Control-Allow-Methods','GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization, Idempotency-Key, Last-Event-ID');
    res.setHeader('Access-Control-Expose-Headers','Retry-After, Content-Disposition');
  }
  async function meta(){return await one(store,'SELECT MAX((SELECT COALESCE(MAX(id),0) FROM wishes),(SELECT COALESCE(MAX(wish_id),0) FROM deleted_receipts)) AS latest,MAX((SELECT COALESCE(MAX(seq),0) FROM wish_events),(SELECT COALESCE(MAX(event_seq),0) FROM deleted_receipts)) AS cursor');}
  async function playbackSnapshot(after,limit=100){
    const state=await one(store,'SELECT paused,latest_id,updated_at FROM playback_state WHERE id=1');
    if(!state)throw new Error('Playback state migration is missing.');
    const info={paused:state.paused===1,latest:state.latest_id,updated_at:state.updated_at,persistent:true};
    // A newly opened display starts at this watermark, rather than replaying
    // every historical page-turn button. Pause/resume remains durable state.
    if(after===undefined)return {...info,commands:[],hasMore:false,nextCursor:state.latest_id};
    const result=await rows(store,'SELECT id,action,created_at FROM playback_commands WHERE id>? AND id<=? AND created_at>=? ORDER BY id ASC LIMIT ?',[after,state.latest_id,Date.now()-60000,limit+1]);
    const commands=result.slice(0,limit),hasMore=result.length>limit;
    return {...info,commands,hasMore,nextCursor:hasMore?commands.at(-1).id:state.latest_id};
  }
  async function playbackCommand(input){
    const action=String(input.action||''),key=String(input.requestId||'');
    if(!['pause','resume','next','prev','replay'].includes(action))throw new ApiError(400,'播放指令不正確');
    if(!/^[A-Za-z0-9_-]{12,100}$/.test(key))throw new ApiError(400,'播放指令識別碼不正確');
    return serialize(async()=>{
      const existing=await one(store,'SELECT id,action,created_at FROM playback_commands WHERE request_key=?',[key]);
      if(existing){if(existing.action!==action)throw new ApiError(409,'這個識別碼已用於其他播放指令');return {ok:true,duplicate:true,command:existing,state:await playbackSnapshot()};}
      await store.query('INSERT OR IGNORE INTO playback_commands(action,request_key,created_at) VALUES(?,?,?)',[action,key,Date.now()]);
      const saved=await one(store,'SELECT id,action,created_at FROM playback_commands WHERE request_key=?',[key]);
      if(!saved||saved.action!==action)throw new ApiError(409,'播放指令識別碼衝突');
      return {ok:true,duplicate:false,command:saved,state:await playbackSnapshot()};
    });
  }
  async function list(url,admin=false){
    const after=integer(url.searchParams.get('after'),0,Number.MAX_SAFE_INTEGER,0),limit=integer(url.searchParams.get('limit'),1,200,200);
    // Capture a cursor before the snapshot. A concurrent insert may replay twice,
    // which ID deduplication handles; it must never fall into a cursor gap.
    const info=await meta();
    const result=await rows(store,`SELECT * FROM wishes WHERE id>? ${admin?'':"AND moderation_status='approved'"} ORDER BY id ASC LIMIT ?`,[after,limit+1]);
    return {wishes:result.slice(0,limit).map(present),...info,hasMore:result.length>limit,persistent:true,storage:store.mode};
  }
  async function insert(input,req,{importing=false}={}){
    const suppliedKey=String(req?.headers['idempotency-key']??input.idempotencyKey??input.submission_key??'');
    if(suppliedKey&&!/^[A-Za-z0-9_-]{12,100}$/.test(suppliedKey))throw new ApiError(400,'送出識別碼不正確');
    return serialize(async()=>{
      if(suppliedKey&&await one(store,'SELECT wish_id FROM deleted_receipts WHERE submission_key=?',[suppliedKey]))throw new ApiError(410,'這則祝福已由管理員永久刪除，原送出編號不能再次使用。','WISH_DELETED');
      const wish=await normalizeWish(input,{importing});
      if(suppliedKey)wish.key=suppliedKey;
      const existing=await one(store,'SELECT * FROM wishes WHERE submission_key=?',[wish.key]);
      if(existing){if(existing.request_hash!==wish.requestHash)throw new ApiError(409,'這次送出識別碼已用於其他內容，請重新送出');return {ok:true,id:existing.id,wish:present(existing),duplicate:true,persistent:true};}
      // Keep exact retries of old receipts valid; only new public submissions
      // require the explicit choice, including guests who upload a selfie.
      if(!importing&&!['male','female'].includes(wish.avatarGender))throw new ApiError(400,'請先選擇男生或女生，再送出祝福','GENDER_REQUIRED');
      const ip=String(req?.headers['x-forwarded-for']||req?.socket.remoteAddress||'import').split(',')[0].trim(),clientHash=hash(ip+'|'+wish.author.toLocaleLowerCase('zh-TW'));
      let now=Date.now();
      if(importing){const date=input.created_at??input.at;if(date){const parsed=typeof date==='number'?date:Date.parse(date);if(Number.isFinite(parsed)&&parsed>0&&parsed<=Date.now()+300000)now=parsed;}}
      if(!importing){
        const recent=await rows(store,'SELECT created_at FROM wishes WHERE client_hash=? AND created_at>? ORDER BY created_at DESC LIMIT 12',[clientHash,now-3600000]);
        if(recent.length>=12||(recent[0]&&now-recent[0].created_at<Number(env.RATE_COOLDOWN_MS??15000)))throw new ApiError(429,'祝福已收到，請稍後再送另一則');
      }
      const status=importing?(['approved','pending','hidden','deleted'].includes(input.moderation_status)?input.moderation_status:'approved'):(env.MODERATION_REQUIRED==='true'?'pending':'approved'),statements=[];
      if(wish.image)statements.push({sql:'INSERT OR IGNORE INTO avatars(id,image_base64,mime_type,byte_size,width,height,created_at) SELECT ?,?,?,?,480,480,? WHERE NOT EXISTS(SELECT 1 FROM deleted_receipts WHERE submission_key=?)',params:[wish.image.id,wish.image.base64,'image/jpeg',wish.image.bytes,now,wish.key]});
      statements.push({sql:'INSERT OR IGNORE INTO wishes(guest_name,group_number,blessing_text,blessing_grapheme_count,avatar_id,avatar_gender,style_id,moderation_status,created_at,updated_at,submission_key,request_hash,client_hash) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM deleted_receipts WHERE submission_key=?)',params:[wish.author,wish.group,wish.message,wish.graphemes,wish.image?.id||null,wish.avatarGender,wish.style,status,now,now,wish.key,wish.requestHash,clientHash,wish.key]});
      await store.batch(statements);
      const saved=await one(store,'SELECT * FROM wishes WHERE submission_key=?',[wish.key]);
      if(!saved&&await one(store,'SELECT wish_id FROM deleted_receipts WHERE submission_key=?',[wish.key]))throw new ApiError(410,'這則祝福已由管理員永久刪除，原送出編號不能再次使用。','WISH_DELETED');
      if(!saved||saved.request_hash!==wish.requestHash)throw new ApiError(409,'送出資料衝突，請重新確認');
      pollSubscribers().catch(()=>{});return {ok:true,id:saved.id,wish:present(saved),duplicate:false,persistent:true};
    });
  }
  async function hardDelete(id){
    return serialize(async()=>{
      const old=await one(store,'SELECT id,avatar_id FROM wishes WHERE id=?',[id]);
      if(!old){const receipt=await one(store,'SELECT event_seq FROM deleted_receipts WHERE wish_id=?',[id]);if(!receipt)throw new ApiError(404,'找不到祝福');return {ok:true,id,deleted:true,duplicate:true,persistent:true,cursor:receipt.event_seq};}
      const now=Date.now();
      // The FK event row first reserves the shared AUTOINCREMENT cursor. Keep its
      // minimal tombstone, remove FK children, then delete the wish and any image
      // that has no remaining reference (including hidden/legacy-deleted wishes).
      await store.batch([
        {sql:"INSERT INTO wish_events(wish_id,event_type,created_at) SELECT id,'reset',? FROM wishes WHERE id=?",params:[now,id]},
        {sql:'INSERT OR IGNORE INTO deleted_receipts(wish_id,submission_key,deleted_at,event_seq) SELECT id,submission_key,?,(SELECT MAX(seq) FROM wish_events WHERE wish_id=wishes.id) FROM wishes WHERE id=?',params:[now,id]},
        {sql:'DELETE FROM wish_events WHERE wish_id=?',params:[id]},
        {sql:'DELETE FROM wishes WHERE id=?',params:[id]},
        {sql:'DELETE FROM avatars WHERE id=? AND NOT EXISTS(SELECT 1 FROM wishes WHERE avatar_id=avatars.id)',params:[old.avatar_id]}
      ]);
      const receipt=await one(store,'SELECT event_seq FROM deleted_receipts WHERE wish_id=?',[id]);
      if(!receipt)throw new Error('Deletion receipt read-back incomplete.');
      return {ok:true,id,deleted:true,duplicate:false,persistent:true,cursor:receipt.event_seq};
    });
  }
  function sendEvent(sub,type,data,seq){
    if(sub.res.destroyed||sub.res.writableEnded)return;
    if(sub.res.writableLength>1024*1024){sub.res.end();subscribers.delete(sub);return;}
    sub.res.write(`id: ${seq}\nevent: ${type}\ndata: ${JSON.stringify(data)}\n\n`);sub.cursor=seq;
  }
  async function replay(sub){
    const events=await rows(store,"WITH events AS (SELECT seq,wish_id,event_type FROM wish_events WHERE seq>? UNION ALL SELECT event_seq AS seq,wish_id,'deleted' AS event_type FROM deleted_receipts WHERE event_seq>? ORDER BY seq ASC LIMIT 200) SELECT e.seq,e.event_type,e.wish_id AS event_wish_id,w.* FROM events e LEFT JOIN wishes w ON w.id=e.wish_id ORDER BY e.seq ASC",[sub.cursor,sub.cursor]);
    for(const e of events){if(e.event_type==='deleted'||!e.id)sendEvent(sub,'reset',{reason:'deleted',id:e.event_wish_id,status:'deleted',cursor:e.seq},e.seq);else if(e.event_type==='wish'&&e.moderation_status==='approved')sendEvent(sub,'wish',present(e),e.seq);else sendEvent(sub,'reset',{reason:'moderation',id:e.id,status:e.moderation_status,cursor:e.seq},e.seq);}
    return events.length;
  }
  async function pollSubscribers(){
    if(polling||stopped||!subscribers.size)return;polling=true;
    try{for(const sub of subscribers){try{await replay(sub);}catch{if(!sub.res.writableEnded)sub.res.write(': database temporarily unavailable; reconnect will replay\n\n');}}}finally{polling=false;}
  }
  const server=http.createServer(async(req,res)=>{
    try{
      cors(req,res);if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
      const url=new URL(req.url,'http://localhost');
      if(req.method==='GET'&&url.pathname==='/health'){json(res,200,{ok:true,version:2,persistent:true,writable:true,playback:true,avatar_gender:true,avatar_gender_required:true,hard_delete:deletionReady,storage:store.mode,...await meta()});return;}
      if(req.method==='GET'&&url.pathname==='/api/playback'){
        const after=url.searchParams.has('after')?integer(url.searchParams.get('after'),0,Number.MAX_SAFE_INTEGER):undefined;
        json(res,200,await playbackSnapshot(after,integer(url.searchParams.get('limit'),1,100,100)));return;
      }
      if(req.method==='GET'&&url.pathname==='/api/wishes'){json(res,200,await list(url));return;}
      if(req.method==='POST'&&url.pathname==='/api/wishes'){requireJson(req);const result=await insert(await readJson(req),req);json(res,result.duplicate?200:201,result);return;}
      const avatarMatch=url.pathname.match(/^\/api\/avatars\/(\d+)$/);
      if(req.method==='GET'&&avatarMatch){
        const image=await one(store,"SELECT a.image_base64,a.mime_type FROM avatars a JOIN wishes w ON w.avatar_id=a.id WHERE w.id=? AND w.moderation_status='approved'",[Number(avatarMatch[1])]);
        if(!image)throw new ApiError(404,'找不到照片');res.writeHead(200,{'Content-Type':image.mime_type,'Cache-Control':'no-store'});res.end(Buffer.from(image.image_base64,'base64'));return;
      }
      if(req.method==='GET'&&url.pathname==='/api/stream'){
        let cursor=integer(req.headers['last-event-id']??url.searchParams.get('cursor'),0,Number.MAX_SAFE_INTEGER,0);
        if(!url.searchParams.has('cursor')&&!req.headers['last-event-id']&&url.searchParams.has('after')){const after=integer(url.searchParams.get('after'),0,Number.MAX_SAFE_INTEGER,0);cursor=(await one(store,'SELECT MAX((SELECT COALESCE(MAX(seq),0) FROM wish_events WHERE wish_id<=?),(SELECT COALESCE(MAX(event_seq),0) FROM deleted_receipts WHERE wish_id<=?)) AS cursor',[after,after])).cursor;}
        const info=await meta();if(cursor>info.cursor)cursor=0;
        res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Connection':'keep-alive','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'});
        res.write(`retry: 4000\nevent: ready\ndata: ${JSON.stringify({...info,persistent:true})}\n\n`);
        const sub={res,cursor};subscribers.add(sub);req.on('close',()=>subscribers.delete(sub));await replay(sub);return;
      }
      if(url.pathname.startsWith('/api/admin/')){
        authorize(req);
        if(req.method==='GET'&&url.pathname==='/api/admin/playback'){json(res,200,await playbackSnapshot());return;}
        if(req.method==='POST'&&url.pathname==='/api/admin/playback'){requireJson(req);const result=await playbackCommand(await readJson(req));json(res,result.duplicate?200:201,result);return;}
        const adminAvatar=url.pathname.match(/^\/api\/admin\/avatars\/(\d+)$/);
        if(req.method==='GET'&&adminAvatar){const image=await one(store,'SELECT a.image_base64,a.mime_type FROM avatars a JOIN wishes w ON w.avatar_id=a.id WHERE w.id=?',[Number(adminAvatar[1])]);if(!image)throw new ApiError(404,'找不到照片');res.writeHead(200,{'Content-Type':image.mime_type});res.end(Buffer.from(image.image_base64,'base64'));return;}
        if(req.method==='GET'&&url.pathname==='/api/admin/wishes'){json(res,200,await list(url,true));return;}
        const match=url.pathname.match(/^\/api\/admin\/wishes\/(\d+)$/);
        if(req.method==='DELETE'&&match){const result=await hardDelete(integer(match[1],1,Number.MAX_SAFE_INTEGER));json(res,200,result);pollSubscribers().catch(()=>{});return;}
        if(req.method==='PATCH'&&match){
          requireJson(req);const input=await readJson(req),status=input.moderation_status;
          if(!['approved','hidden','pending','deleted'].includes(status))throw new ApiError(400,'審核狀態不正確');
          if(status==='deleted'){const result=await hardDelete(integer(match[1],1,Number.MAX_SAFE_INTEGER));json(res,200,result);pollSubscribers().catch(()=>{});return;}
          const result=await serialize(async()=>{const old=await one(store,'SELECT * FROM wishes WHERE id=?',[Number(match[1])]);if(!old)throw new ApiError(404,'找不到祝福');if(old.moderation_status===status)return old;const now=Date.now();await store.query('UPDATE wishes SET moderation_status=?,updated_at=? WHERE id=?',[status,now,old.id]);return {...old,moderation_status:status};});
          json(res,200,{ok:true,wish:present(result)});pollSubscribers().catch(()=>{});return;
        }
        if(req.method==='GET'&&['/api/admin/export.csv','/api/admin/export.json'].includes(url.pathname)){
          const all=[];let after=0;
          while(true){const page=await rows(store,'SELECT w.*,a.image_base64 FROM wishes w LEFT JOIN avatars a ON a.id=w.avatar_id WHERE w.id>? ORDER BY w.id LIMIT 200',[after]);all.push(...page);if(page.length<200)break;after=page.at(-1).id;}
          if(url.pathname.endsWith('.json')){res.setHeader('Content-Disposition','attachment; filename="wedding-wishes.json"');json(res,200,{version:2,exported_at:new Date().toISOString(),wishes:all.map(w=>({...present(w),submission_key:w.submission_key,avatar:w.image_base64?'data:image/jpeg;base64,'+w.image_base64:''}))});return;}
          const fields=['id','guest_name','group_number','blessing_text','avatar_path','avatar_gender','created_at','style_id','moderation_status'],escape=value=>'"'+String(value??'').replace(/^[=+\-@\t\r]/,"'$&").replace(/"/g,'""')+'"';
          const csv='\uFEFF'+[fields.join(','),...all.map(w=>{const p=present(w);return fields.map(k=>escape(p[k])).join(',');})].join('\r\n');
          res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="wedding-wishes.csv"'});res.end(csv);return;
        }
        if(req.method==='POST'&&url.pathname==='/api/admin/import'){
          requireJson(req);const input=await readJson(req);if(!Array.isArray(input.wishes)||input.wishes.length>200)throw new ApiError(400,'每批匯入最多 200 則');
          const imported=[];for(const wish of input.wishes){const canonical={...wish,idempotencyKey:wish.submission_key||`import_${hash(JSON.stringify(wish)).slice(0,48)}`};imported.push(await insert(canonical,req,{importing:true}));}
          json(res,200,{ok:true,imported:imported.length,ids:imported.map(w=>w.id)});return;
        }
      }
      throw new ApiError(404,'找不到此頁');
    }catch(error){
      if(res.headersSent){if(!res.writableEnded)res.end();return;}
      const status=error.status||503;if(status===429)res.setHeader('Retry-After','15');
      if(!error.status)console.error('Wedding API persistent operation failed:',error.message);
      json(res,status,{error:error.status?error.message:'資料庫暫時無法連線，祝福尚未送出，請稍後重試',...(error.status&&error.code?{error_code:error.code}:{}),persistent:store.persistent});
    }
  });
  server.keepAliveTimeout=63000;
  const interval=setInterval(()=>pollSubscribers().catch(()=>{}),Number(env.SSE_POLL_MS||3000));interval.unref();
  const heartbeat=setInterval(()=>{for(const sub of subscribers)if(!sub.res.destroyed)sub.res.write(': ping\n\n');},18000);heartbeat.unref();
  async function close(){stopped=true;clearInterval(interval);clearInterval(heartbeat);for(const sub of subscribers)sub.res.end();await mutationTail;await new Promise(resolve=>server.close(resolve));await store.close();}
  return {server,store,close,insert,normalizeWish};
}
if(require.main===module){createApp().then(app=>{const port=Number(process.env.PORT||10000);app.server.listen(port,'0.0.0.0',()=>console.log('Wedding wishes v2 listening',port,'storage:',app.store.mode));let closing=false;const stop=()=>{if(closing)return;closing=true;app.close().then(()=>process.exit(0));setTimeout(()=>process.exit(1),25000).unref();};process.on('SIGTERM',stop);process.on('SIGINT',stop);}).catch(error=>{console.error('Wedding API startup refused:',error.message);process.exitCode=1;});}
module.exports={createApp,normalizeWish,countText};
