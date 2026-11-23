/* 19 x 26 cm wedding print package. Conversion and assembly stay in this tab. */
(() => {
  'use strict';
  const BASE=new URL('.',document.currentScript.src),DPI=300,MM=DPI/25.4,PT=72/25.4;
  const TRIM={width:190,height:260},BLEED=3,WIDTH=196,HEIGHT=266;
  const PIXELS={width:Math.round(WIDTH*MM),height:Math.round(HEIGHT*MM)};
  const PROFILE='Coated_Fogra39L_VIGC_300',PROFILE_FILE='./vendor/icc/'+PROFILE+'.icc';
  const SERIF='"Noto Serif TC","PMingLiU","Songti TC","Microsoft JhengHei",serif';
  const BODY='"Microsoft JhengHei","PingFang TC","Noto Sans TC","Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const C={paper:'#fffaf2',ink:'#70525b',rose:'#ac6c7d',gold:'#bda275',line:'#ddc9ab',muted:'#9c8580'};
  const encoder=new TextEncoder(),segmenter=new Intl.Segmenter('zh-TW',{granularity:'grapheme'});
  let dependencies;
  function cancelled(){const e=new Error('已取消製作印刷檔');e.name='AbortError';return e;}
  function check(signal){if(signal?.aborted)throw cancelled();}
  function waitFor(promise,signal){
    if(!signal)return Promise.resolve(promise);
    return new Promise((resolve,reject)=>{const source=Promise.resolve(promise);if(signal.aborted){source.catch(()=>{});reject(cancelled());return;}
      const stop=()=>{signal.removeEventListener('abort',stop);reject(cancelled());};signal.addEventListener('abort',stop,{once:true});
      source.then(value=>{signal.removeEventListener('abort',stop);resolve(value)},error=>{signal.removeEventListener('abort',stop);reject(error)});
    });
  }
  async function yieldUI(signal){await waitFor(new Promise(resolve=>setTimeout(resolve,0)),signal);check(signal);}
  async function readBytes(url,signal){
    const controller=new AbortController(),stop=()=>controller.abort();let timer;
    signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted)controller.abort();
    try{
      return await waitFor(Promise.race([(async()=>{const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw new Error('無法下載印刷色彩描述檔，請重試');return new Uint8Array(await r.arrayBuffer());})(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('下載印刷色彩描述檔逾時，請重試'));},30000);})]),signal);
    }finally{clearTimeout(timer);controller.abort();signal?.removeEventListener('abort',stop);}
  }
  async function loadDependencies(signal){
    if(!dependencies){
      dependencies=Promise.all([import(new URL('./vendor/lcms/lcms.js',BASE).href),readBytes(new URL(PROFILE_FILE,BASE))]).catch(error=>{dependencies=null;throw error;});
    }
    return waitFor(dependencies,signal);
  }
  function imageFromData(uri,label,signal){
    check(signal);if(typeof uri!=='string'||!/^data:image\/(jpeg|png|svg\+xml)(;|,)/i.test(uri))throw new Error(label+'資料不完整，請重新製作');
    return new Promise((resolve,reject)=>{
      const img=new Image();let timer;const clear=()=>{clearTimeout(timer);img.onload=null;img.onerror=null;signal?.removeEventListener('abort',stop);};
      const stop=()=>{clear();img.removeAttribute('src');reject(cancelled());};signal?.addEventListener('abort',stop,{once:true});
      img.onload=()=>{clear();if(!img.naturalWidth||!img.naturalHeight){reject(new Error(label+'無法讀取'));return;}resolve(img);};
      img.onerror=()=>{clear();reject(new Error(label+'無法讀取，尚未製作印刷檔'));};timer=setTimeout(()=>{clear();img.removeAttribute('src');reject(new Error(label+'讀取逾時'));},15000);img.src=uri;
    });
  }
  function parts(value){return Array.from(segmenter.segment(String(value??'').normalize('NFC')),p=>p.segment);}
  function dateLabel(value){const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(d):'';}
  function font(ctx,points,{serif=false,weight=500}={}){ctx.font=weight+' '+(points*25.4/72)+'px '+(serif?SERIF:BODY);}
  function text(ctx,value,x,y,points=11,color=C.ink,options={}){font(ctx,points,options);ctx.textAlign=options.align||'center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(String(value),x,y);}
  function linesFor(ctx,value,width){const lines=[];let line='';for(const ch of parts(value)){if(ch==='\n'||ch==='\r\n'){lines.push(line);line='';continue;}if(ch==='\r')continue;if(line&&ctx.measureText(line+ch).width>width){lines.push(line);line=ch;}else line+=ch;}lines.push(line);return lines;}
  function textBlock(ctx,value,box,{max=22,min=12,lineHeight=1.55,color=C.ink,serif=false,weight=500}={}){
    let lines,size=max;for(;size>=min;size-=.5){font(ctx,size,{serif,weight});lines=linesFor(ctx,value,box.width);if(lines.length*size*25.4/72*lineHeight<=box.height&&lines.every(line=>ctx.measureText(line).width<=box.width))break;}
    if(size<min)throw new Error('署名或祝福無法完整排入印刷頁，請先檢查文字');
    const leading=size*25.4/72*lineHeight,top=box.y+(box.height-leading*lines.length)/2;
    lines.forEach((line,i)=>text(ctx,line,box.x+box.width/2,top+(i+.5)*leading,size,color,{serif,weight}));
  }
  function rule(ctx,x,y,width=32){ctx.strokeStyle=C.gold;ctx.lineWidth=.2;ctx.beginPath();ctx.moveTo(x-width/2,y);ctx.lineTo(x+width/2,y);ctx.stroke();}
  function heart(ctx,x,y,size=4){ctx.save();ctx.translate(x,y);ctx.scale(size/50,size/50);ctx.beginPath();ctx.moveTo(0,22);ctx.bezierCurveTo(-46,-4,-26,-35,0,-15);ctx.bezierCurveTo(26,-35,46,-4,0,22);ctx.strokeStyle=C.rose;ctx.lineWidth=2;ctx.stroke();ctx.restore();}
  function contain(img,box){const scale=Math.min(box.width/img.naturalWidth,box.height/img.naturalHeight);return {x:box.x+(box.width-img.naturalWidth*scale)/2,y:box.y+(box.height-img.naturalHeight*scale)/2,width:img.naturalWidth*scale,height:img.naturalHeight*scale};}
  function photo(ctx,img,box){const r=contain(img,box);ctx.save();ctx.shadowColor='#684c4920';ctx.shadowBlur=1.6;ctx.shadowOffsetY=.7;ctx.fillStyle='#fffef9';ctx.fillRect(r.x-2,r.y-2,r.width+4,r.height+4);ctx.restore();ctx.drawImage(img,r.x,r.y,r.width,r.height);ctx.strokeStyle=C.line;ctx.lineWidth=.16;ctx.strokeRect(r.x-.8,r.y-.8,r.width+1.6,r.height+1.6);}
  function botanical(ctx,img,x,y,width,rotate=0){if(!img)return;ctx.save();ctx.translate(x,y);ctx.rotate(rotate);ctx.globalAlpha=.84;ctx.drawImage(img,0,0,width,width*img.naturalHeight/img.naturalWidth);ctx.restore();}
  function background(ctx,assets,{cover=false,blank=false}={}){
    ctx.fillStyle=C.paper;ctx.fillRect(0,0,WIDTH,HEIGHT);
    if(blank){botanical(ctx,assets.botanical,-6,203,47);return;}
    ctx.strokeStyle=C.gold;ctx.lineWidth=.2;ctx.strokeRect(12,12,WIDTH-24,HEIGHT-24);ctx.strokeStyle=C.line;ctx.lineWidth=.12;ctx.strokeRect(13.6,13.6,WIDTH-27.2,HEIGHT-27.2);
    if(cover){botanical(ctx,assets.botanical,-9,-10,76);botanical(ctx,assets.botanical,WIDTH+9,HEIGHT+10,76,Math.PI);}
    else{botanical(ctx,assets.botanical,WIDTH+8,75,50,Math.PI);botanical(ctx,assets.botanical,-7,207,48);}
  }
  function frontCover(ctx,data,assets,inner=false){
    background(ctx,assets,{cover:true});text(ctx,'WEDDING WISHES',98,40,9,C.gold,{serif:true});heart(ctx,98,51,5);
    textBlock(ctx,'幸福祝福書',{x:25,y:61,width:146,height:19},{max:30,min:25,color:C.rose,serif:true,weight:600});
    text(ctx,data.coupleName,98,91,17,C.rose);
    photo(ctx,assets.couple,{x:58,y:111,width:80,height:60});
    text(ctx,'珍藏 '+data.wishes.length+' 份祝福',98,199,12,C.rose);rule(ctx,98,210,24);
    text(ctx,inner?'每一句祝福，都值得好好珍藏。':'WITH LOVE, ALWAYS',98,223,inner?11:9,C.gold,{serif:!inner});
    const date=dateLabel(data.exportedAt);if(date)text(ctx,'收錄至 '+date,98,240,8,C.muted);
  }
  function backCover(ctx,data,assets,inner=false){
    background(ctx,assets,{cover:true});heart(ctx,98,68,6);
    textBlock(ctx,'謝謝你，成為我們\n幸福故事裡的一頁。',{x:29,y:89,width:138,height:34},{max:21,min:18,color:C.rose,serif:true});
    textBlock(ctx,'每一份祝福，\n都是我們一生珍藏的禮物。',{x:33,y:139,width:130,height:26},{max:13,min:12});
    rule(ctx,98,181,30);text(ctx,data.coupleName,98,197,15,C.rose);text(ctx,'珍藏 '+data.wishes.length+' 份祝福',98,216,10,C.gold);
    if(inner)text(ctx,'願愛與祝福，常在我們心裡。',98,237,9,C.muted);
  }
  function guestPage(ctx,data,wish,index,assets,avatar){
    background(ctx,assets);const center=98+(index%2===0?-3:3); // Title page is recto; first guest is verso.
    text(ctx,'幸福祝福書',center,29,12,C.rose,{serif:true,weight:600});text(ctx,'A NOTE FOR THE NEWLYWEDS',center,38,7,C.gold,{serif:true});rule(ctx,center,45,28);
    const radius=19,y=84;ctx.fillStyle='#fffef9';ctx.beginPath();ctx.arc(center,y,21,0,Math.PI*2);ctx.fill();ctx.strokeStyle=C.gold;ctx.lineWidth=.2;ctx.stroke();
    ctx.save();ctx.beginPath();ctx.arc(center,y,radius,0,Math.PI*2);ctx.clip();const side=Math.min(avatar.naturalWidth,avatar.naturalHeight);ctx.drawImage(avatar,(avatar.naturalWidth-side)/2,(avatar.naturalHeight-side)/2,side,side,center-radius,y-radius,38,38);ctx.restore();
    textBlock(ctx,wish.guestName||'賓客',{x:center-73,y:114,width:146,height:23},{max:19,min:12,color:C.rose,weight:600});
    rule(ctx,center,145,20);textBlock(ctx,wish.blessingText,{x:center-71,y:155,width:142,height:47},{max:23,min:14,lineHeight:1.6});
    const date=dateLabel(wish.createdAt);if(date)text(ctx,date,center,220,8,C.muted);
    text(ctx,data.coupleName,center-69,241,8,C.gold,{align:'left'});text(ctx,String(index+1).padStart(2,'0')+' / '+data.wishes.length,center+69,241,8,C.gold,{align:'right',serif:true});
  }
  async function toCMYK(canvas,lcms,transform,signal){
    const ctx=canvas.getContext('2d'),out=new Uint8Array(PIXELS.width*PIXELS.height*4);let offset=0;
    for(let y=0;y<PIXELS.height;y+=64){check(signal);const rows=Math.min(64,PIXELS.height-y),rgba=ctx.getImageData(0,y,PIXELS.width,rows).data,rgb=new Uint8Array(PIXELS.width*rows*3);
      for(let p=0,q=0;p<rgba.length;p+=4){rgb[q++]=rgba[p];rgb[q++]=rgba[p+1];rgb[q++]=rgba[p+2];}
      const converted=lcms.cmsDoTransform(transform,rgb,PIXELS.width*rows);if(!(converted instanceof Uint8Array)||converted.length!==PIXELS.width*rows*4)throw new Error('印刷色彩轉換失敗，未建立檔案');out.set(converted,offset);offset+=converted.length;
      if(y%256===0)await yieldUI(signal);
    }
    return out;
  }
  async function newDocument(data,profileBytes,label){
    const {PDFDocument,PDFName,PDFString}=window.PDFLib,pdf=await PDFDocument.create();pdf.setTitle(data.title+'｜'+label);pdf.setAuthor(data.coupleName);pdf.setSubject('19 x 26 cm; 3 mm bleed; 300 dpi; CMYK '+PROFILE);pdf.setLanguage('zh-TW');pdf.setCreator('Wedding Print Album');pdf.setProducer('Wedding Print Album / pdf-lib / LittleCMS');
    const date=new Date(data.exportedAt);if(Number.isFinite(date.getTime())){pdf.setCreationDate(date);pdf.setModificationDate(date);}
    const profile=pdf.context.register(pdf.context.flateStream(profileBytes,{N:4,Alternate:'DeviceCMYK'}));
    const intent=pdf.context.register(pdf.context.obj({Type:'OutputIntent',S:'GTS_PDFX',OutputConditionIdentifier:PDFString.of('FOGRA39'),RegistryName:PDFString.of('http://www.color.org'),Info:PDFString.of(PROFILE),DestOutputProfile:profile}));pdf.catalog.set(PDFName.of('OutputIntents'),pdf.context.obj([intent]));
    return pdf;
  }
  function addCMYKPage(pdf,bytes){
    const p=window.PDFLib,page=pdf.addPage([WIDTH*PT,HEIGHT*PT]);page.setTrimBox(BLEED*PT,BLEED*PT,TRIM.width*PT,TRIM.height*PT);page.setBleedBox(0,0,WIDTH*PT,HEIGHT*PT);
    const ref=pdf.context.register(pdf.context.flateStream(bytes,{Type:'XObject',Subtype:'Image',Width:PIXELS.width,Height:PIXELS.height,ColorSpace:'DeviceCMYK',BitsPerComponent:8,Interpolate:false,Intent:'RelativeColorimetric'}));
    const name=page.node.newXObject('PrintPage',ref);page.pushOperators(p.pushGraphicsState(),p.concatTransformationMatrix(WIDTH*PT,0,0,HEIGHT*PT,0,0),p.drawObject(name),p.popGraphicsState());
  }
  const crcTable=(()=>{const a=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;a[n]=c>>>0;}return a;})();
  async function crc32(bytes,signal){let crc=0xffffffff;for(let i=0;i<bytes.length;i++){crc=crcTable[(crc^bytes[i])&255]^(crc>>>8);if(i&&i%1048576===0)await yieldUI(signal);}return (crc^0xffffffff)>>>0;}
  async function zip(files,signal){
    const output=[],directory=[];let offset=0,dirSize=0;
    for(const file of files){check(signal);const name=encoder.encode(file.name),bytes=file.bytes,crc=await crc32(bytes,signal);if(bytes.length>0xffffffff||offset>0xffffffff)throw new Error('印刷檔過大，請分冊製作');
      const header=new Uint8Array(30+name.length),h=new DataView(header.buffer);h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(12,33,true);h.setUint32(14,crc,true);h.setUint32(18,bytes.length,true);h.setUint32(22,bytes.length,true);h.setUint16(26,name.length,true);header.set(name,30);
      const central=new Uint8Array(46+name.length),c=new DataView(central.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(14,33,true);c.setUint32(16,crc,true);c.setUint32(20,bytes.length,true);c.setUint32(24,bytes.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);central.set(name,46);
      output.push(header,bytes);directory.push(central);offset+=header.length+bytes.length;dirSize+=central.length;
    }
    if(offset+dirSize>0xffffffff)throw new Error('印刷檔過大，請分冊製作');const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,dirSize,true);e.setUint32(16,offset,true);check(signal);return new Blob([...output,...directory,end],{type:'application/zip'});
  }
  function instructions(data,total,profileHash){return '\ufeff'+[
    '仁鈞＆姮儒｜19×26公分精裝祝福書 印刷交付說明','',
    '01_內頁_19x26cm.pdf：'+total+'頁；扉頁＋'+data.wishes.length+'則公開祝福（每則一頁）＋謝詞；末尾視需要補一頁留白，使總頁數為偶數。',
    '02_封面_19x26cm.pdf、03_封底_19x26cm.pdf：各一頁完整設計。封面合照寬度80mm，保留原始比例。',
    '成品尺寸：190×260mm。PDF含四邊各3mm出血，MediaBox／BleedBox為196×266mm，TrimBox為190×260mm（距檔案邊3mm）。',
    '內頁均為單頁，請勿自行將左右頁拼版。重要文字與頭像至少避開裝訂側15mm、其他紙邊7mm；頭像直徑38mm。',
    '所有頁面為約300dpi的CMYK平面影像，文字與Emoji已平面化，沒有外連圖片或未嵌入字型；文字不能搜尋／編輯。',
    '色彩：由sRGB經LittleCMS ICC色彩管理轉換為'+PROFILE+'，並在每份PDF嵌入OutputIntent。此為FOGRA39／總墨量300%描述檔；若印廠有指定輸出描述檔，請交由印廠先做色彩預檢與打樣。',
    'ICC SHA-256：'+profileHash,
    '本檔未宣稱PDF/X認證。請在正式量產前由印廠預檢尺寸、顏色及圖片品質。','',
    '精裝封殼待加工：封面／封底已排好，但不是含書背的整張裱紙刀模。書背寬度、灰板尺寸、包邊、書溝、蝴蝶頁與印廠配頁要求，須由印廠依最終紙張及'+total+'頁內頁確認；請印廠將這兩頁設計套入其精裝模板，不可直接把3mm出血當作精裝包邊。',
    '紙張可先向店家評估157g特銅紙；本檔沒有假設紙厚，也沒有自動猜測書背寬度。',
    '未包含隱藏／待審核／已刪除祝福、管理金鑰、組別或送出識別碼。資料只在目前瀏覽器製作，沒有傳給外部轉檔服務。',
    '收錄日期（Asia/Taipei）：'+dateLabel(data.exportedAt)+'；此為匯出日期，不是婚禮日期。',
    '店家規格：https://www.jdprinting.com.tw/front/Service/Detail?idx=1121',
    'ICC資料：https://registry.color.org/profile-registry/Coated_Fogra39L_VIGC_300',''
  ].join('\r\n');}
  async function create(data,{onProgress,signal}={}){
    check(signal);if(!window.PDFLib?.PDFDocument)throw new Error('PDF工具尚未載入，請重整控制台');
    if(!data||data.schemaVersion!==1||!Array.isArray(data.wishes)||!data.assets)throw new Error('印刷資料不完整');
    if(data.wishes.some(w=>!w||typeof w.guestName!=='string'||typeof w.blessingText!=='string'||parts(w.blessingText).length>30))throw new Error('印刷祝福內容不完整或超過30字');
    const count=data.wishes.length+2,innerPages=count+(count%2),total=innerPages+2,assets={},files=[];let canvas,lcms,inputProfile,outputProfile,transform,done=0;
    const progress=message=>{check(signal);try{onProgress?.({current:done,total,message})}catch(e){check(signal)}};
    try{
      progress('正在準備19×26公分印刷版與色彩描述檔…');const [module,profileBytes]=await loadDependencies(signal);check(signal);
      lcms=await waitFor(module.instantiate({locateFile:()=>new URL('./vendor/lcms/lcms.wasm',BASE).href}),signal);
      inputProfile=lcms.cmsCreate_sRGBProfile();outputProfile=lcms.cmsOpenProfileFromMem(profileBytes,profileBytes.length);
      if(!inputProfile||!outputProfile)throw new Error('無法讀取印刷色彩描述檔');
      const inputType=lcms.cmsFormatterForColorspaceOfProfile(inputProfile,1,false),outputType=lcms.cmsFormatterForColorspaceOfProfile(outputProfile,1,false);
      transform=lcms.cmsCreateTransform(inputProfile,inputType,outputProfile,outputType,1,0x2000);if(!transform)throw new Error('無法建立CMYK印刷色彩轉換');
      if(document.fonts?.ready)await waitFor(document.fonts.ready,signal);
      for(const key of ['couple','botanical','defaultMale','defaultFemale','defaultNeutral'])assets[key]=await imageFromData(data.assets[key],key==='couple'?'新人合照':'花卉與預設頭像',signal);
      if(assets.couple.naturalWidth<945||assets.couple.naturalHeight<709)throw new Error('新人合照解析度不足，請先準備適合印刷的原始照片');
      const profileHash=Array.from(new Uint8Array(await waitFor(crypto.subtle.digest('SHA-256',profileBytes),signal)),v=>v.toString(16).padStart(2,'0')).join('');
      const inner=await newDocument(data,profileBytes,'內頁'),front=await newDocument(data,profileBytes,'封面'),back=await newDocument(data,profileBytes,'封底');
      async function renderPage(pdf,draw,label){
        check(signal);progress('正在製作'+label+'（'+(done+1)+' / '+total+'頁）…');canvas=document.createElement('canvas');canvas.width=PIXELS.width;canvas.height=PIXELS.height;
        try{const ctx=canvas.getContext('2d',{alpha:false,colorSpace:'srgb',willReadFrequently:true});if(!ctx)throw new Error('瀏覽器無法製作高解析印刷頁，請改用電腦版Chrome或Edge');ctx.setTransform(MM,0,0,MM,0,0);draw(ctx);await yieldUI(signal);const bytes=await toCMYK(canvas,lcms,transform,signal);check(signal);addCMYKPage(pdf,bytes);}
        finally{canvas.width=1;canvas.height=1;canvas=null;}done++;progress();await yieldUI(signal);
      }
      await renderPage(front,ctx=>frontCover(ctx,data,assets),'封面');await renderPage(back,ctx=>backCover(ctx,data,assets),'封底');
      await renderPage(inner,ctx=>frontCover(ctx,data,assets,true),'內頁扉頁');
      for(let i=0;i<data.wishes.length;i++){check(signal);const w=data.wishes[i];let uploaded;
        try{if(w.avatar){uploaded=await imageFromData(w.avatar,'第'+(i+1)+'位賓客的自拍',signal);if(uploaded.naturalWidth<449||uploaded.naturalHeight<449)throw new Error('第'+(i+1)+'位賓客的自拍不足300dpi，請先更換清晰照片');}
          const avatar=uploaded||(w.avatarGender==='male'?assets.defaultMale:w.avatarGender==='female'?assets.defaultFemale:assets.defaultNeutral);await renderPage(inner,ctx=>guestPage(ctx,data,w,i,assets,avatar),'第'+(i+1)+'則祝福');
        }finally{uploaded?.removeAttribute('src');}
      }
      await renderPage(inner,ctx=>backCover(ctx,data,assets,true),'內頁謝詞');if(count%2)await renderPage(inner,ctx=>background(ctx,assets,{blank:true}),'末頁留白');
      progress('正在封裝內頁、封面與封底PDF，請稍候…');
      for(const [name,pdf] of [['01_內頁_19x26cm.pdf',inner],['02_封面_19x26cm.pdf',front],['03_封底_19x26cm.pdf',back]]){check(signal);files.push({name,bytes:await waitFor(pdf.save({useObjectStreams:true}),signal)});await yieldUI(signal);}
      files.push({name:'04_印刷說明.txt',bytes:encoder.encode(instructions(data,innerPages,profileHash))});const result=await zip(files,signal);progress('印刷檔已完成：內頁'+innerPages+'頁，另附封面、封底及送印說明。');return result;
    }finally{
      if(canvas){canvas.width=1;canvas.height=1;}for(const img of Object.values(assets))img.removeAttribute('src');
      if(lcms){if(transform)lcms.cmsDeleteTransform(transform);if(inputProfile)lcms.cmsCloseProfile(inputProfile);if(outputProfile)lcms.cmsCloseProfile(outputProfile);}
    }
  }
  window.WeddingPrintPDF=Object.freeze({create});
})();
