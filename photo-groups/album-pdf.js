/* Offline wedding album: raster pages preserve native CJK and color emoji. */
(() => {
  'use strict';
  const WIDTH=1200,HEIGHT=1600,MM_TO_PT=72/25.4;
  const BODY='"Microsoft JhengHei","PingFang TC","Noto Sans TC","Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const SERIF='"Noto Serif TC","PMingLiU","Songti TC","Microsoft JhengHei","Apple Color Emoji","Segoe UI Emoji",serif';
  const COLORS={paper:'#fffaf2',ink:'#70525b',rose:'#ac6c7d',gold:'#bda275',line:'#ddc9ab',muted:'#a48f85'};
  const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('zh-Hant',{granularity:'grapheme'}):null;
  function aborted(){const error=new Error('已停止製作祝福書');error.name='AbortError';return error;}
  function check(signal){if(signal?.aborted)throw aborted();}
  function waitFor(promise,signal){
    if(!signal)return Promise.resolve(promise);
    return new Promise((resolve,reject)=>{
      const source=Promise.resolve(promise);
      if(signal.aborted){source.catch(()=>{});reject(aborted());return;}
      const stop=()=>{signal.removeEventListener('abort',stop);reject(aborted());};
      signal.addEventListener('abort',stop,{once:true});
      source.then(value=>{signal.removeEventListener('abort',stop);resolve(value)},error=>{signal.removeEventListener('abort',stop);reject(error)});
    });
  }
  async function yieldToUI(signal){let timer;try{await waitFor(new Promise(resolve=>{timer=setTimeout(resolve,0)}),signal);}finally{clearTimeout(timer)}check(signal);}
  function imageFromData(uri,label,signal){
    check(signal);
    if(typeof uri!=='string'||!/^data:image\/(?:jpeg|png|svg\+xml)(?:;|,)/i.test(uri))throw new Error(label+'不是可離線使用的圖片');
    return new Promise((resolve,reject)=>{
      const image=new Image();let timer;
      const clear=()=>{clearTimeout(timer);image.onload=null;image.onerror=null;signal?.removeEventListener('abort',stop);};
      const stop=()=>{clear();image.removeAttribute('src');reject(aborted());};
      image.onload=()=>{clear();if(!(image.naturalWidth>0&&image.naturalHeight>0)){reject(new Error(label+'無法讀取'));return;}resolve(image);};
      image.onerror=()=>{clear();reject(new Error(label+'無法讀取，請重新載入後再試'));};
      signal?.addEventListener('abort',stop,{once:true});
      timer=setTimeout(()=>{clear();image.removeAttribute('src');reject(new Error(label+'讀取逾時，請重新製作'));},15000);
      image.src=uri;
    });
  }
  function font(context,size,{weight=500,serif=false}={}){context.font=weight+' '+size+'px '+(serif?SERIF:BODY);}
  function graphemes(value){const text=String(value??'').normalize('NFC');return segmenter?Array.from(segmenter.segment(text),part=>part.segment):Array.from(text);}
  function linesFor(context,text,width){
    const lines=[];let line='';
    for(const part of graphemes(text)){
      if(part==='\n'||part==='\r\n'){lines.push(line);line='';continue;}
      if(part==='\r')continue;
      if(line&&context.measureText(line+part).width>width){lines.push(line);line=part;}else line+=part;
    }
    lines.push(line);return lines;
  }
  function textBlock(context,text,box,{max=64,min=18,lineHeight=1.5,weight=500,serif=false,color=COLORS.ink}={}){
    if(!String(text??''))return;
    let size=max,lines;
    for(;size>=min;size-=2){
      font(context,size,{weight,serif});lines=linesFor(context,text,box.width-12);
      if(lines.length*size*lineHeight<=box.height-12&&lines.every(line=>context.measureText(line).width<=box.width-12))break;
    }
    if(size<min)throw new Error('有一段署名或祝福太長，無法完整排入祝福書，請先檢查匯出內容');
    context.fillStyle=color;context.textAlign='center';context.textBaseline='middle';
    const top=box.y+(box.height-lines.length*size*lineHeight)/2;
    for(let index=0;index<lines.length;index++)context.fillText(lines[index],box.x+box.width/2,top+(index+.5)*size*lineHeight);
  }
  function smallText(context,text,x,y,size=25,color=COLORS.muted,{align='center',serif=false,weight=400}={}){
    font(context,size,{serif,weight});context.textAlign=align;context.textBaseline='middle';context.fillStyle=color;context.fillText(text,x,y);
  }
  function rule(context,y,width=220){context.strokeStyle=COLORS.gold;context.lineWidth=1.5;context.beginPath();context.moveTo((WIDTH-width)/2,y);context.lineTo((WIDTH+width)/2,y);context.stroke();}
  function heart(context,x,y,size=45){
    context.save();context.translate(x,y);context.scale(size/50,size/50);context.beginPath();context.moveTo(0,22);context.bezierCurveTo(-46,-4,-26,-35,0,-15);context.bezierCurveTo(26,-35,46,-4,0,22);context.strokeStyle=COLORS.rose;context.lineWidth=2;context.stroke();context.restore();
  }
  function contained(image,box){const scale=Math.min(box.width/image.naturalWidth,box.height/image.naturalHeight);return {x:box.x+(box.width-image.naturalWidth*scale)/2,y:box.y+(box.height-image.naturalHeight*scale)/2,width:image.naturalWidth*scale,height:image.naturalHeight*scale};}
  function background(context,assets){
    context.fillStyle=COLORS.paper;context.fillRect(0,0,WIDTH,HEIGHT);
    const glow=context.createRadialGradient(WIDTH/2,150,20,WIDTH/2,500,1200);glow.addColorStop(0,'#fffdf8');glow.addColorStop(1,'#f6e9df');context.fillStyle=glow;context.fillRect(0,0,WIDTH,HEIGHT);
    if(assets.paperGrain){context.save();context.globalAlpha=.33;const pattern=context.createPattern(assets.paperGrain,'repeat');if(pattern){context.fillStyle=pattern;context.fillRect(0,0,WIDTH,HEIGHT);}context.restore();}
    if(assets.botanical){
      context.save();context.globalAlpha=.55;context.drawImage(assets.botanical,-35,1110,315,407);context.translate(WIDTH,0);context.scale(-1,1);context.drawImage(assets.botanical,-35,32,285,368);context.restore();
    }
    context.strokeStyle=COLORS.gold;context.lineWidth=1.6;context.strokeRect(53,53,WIDTH-106,HEIGHT-106);
    context.strokeStyle=COLORS.line;context.lineWidth=.9;context.strokeRect(66,66,WIDTH-132,HEIGHT-132);
  }
  function dateLabel(value){const date=new Date(value);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(date):'';}
  function coverBackground(context,image){
    context.fillStyle=COLORS.paper;context.fillRect(0,0,WIDTH,HEIGHT);
    const rect=contained(image,{x:0,y:0,width:WIDTH,height:HEIGHT});
    context.drawImage(image,rect.x,rect.y,rect.width,rect.height);
  }
  function cover(context,data,assets){
    coverBackground(context,assets.frontCover);
    smallText(context,'WEDDING WISHES',WIDTH/2,215,27,COLORS.gold,{serif:true});
    heart(context,WIDTH/2,278,42);
    textBlock(context,'幸福祝福書',{x:155,y:318,width:890,height:118},{max:88,min:44,serif:true,weight:600,color:COLORS.rose,lineHeight:1.2});
    textBlock(context,data.coupleName||'仁鈞 ♡ 姮儒',{x:155,y:445,width:890,height:65},{max:44,min:28,lineHeight:1.15});
    const rect=contained(assets.couple,{x:145,y:565,width:910,height:610});
    context.save();context.shadowColor='#684c492b';context.shadowBlur=23;context.shadowOffsetY=10;context.fillStyle='#fffef9';context.fillRect(rect.x-21,rect.y-21,rect.width+42,rect.height+42);context.restore();
    context.drawImage(assets.couple,rect.x,rect.y,rect.width,rect.height);
    context.strokeStyle='#dfcbaa';context.lineWidth=1;context.strokeRect(rect.x-8,rect.y-8,rect.width+16,rect.height+16);
    smallText(context,'珍藏 '+data.wishes.length+' 份祝福',WIDTH/2,1360,35,COLORS.rose);
    smallText(context,'WITH LOVE, ALWAYS',WIDTH/2,1416,24,COLORS.gold,{serif:true});
    const exported=dateLabel(data.exportedAt);if(exported)smallText(context,exported,WIDTH/2,1462,22,COLORS.muted);
  }
  function backCover(context,data,assets){
    coverBackground(context,assets.backCover);
    heart(context,WIDTH/2,410,52);
    textBlock(context,'謝謝你，成為我們\n幸福故事裡的一頁。',{x:180,y:535,width:840,height:170},{max:56,min:30,serif:true,weight:500,color:COLORS.rose,lineHeight:1.45});
    textBlock(context,'每一份祝福，都會被我們好好珍藏。',{x:180,y:770,width:840,height:150},{max:44,min:28,lineHeight:1.5});
    rule(context,970,180);
    textBlock(context,data.coupleName||'仁鈞 ♡ 姮儒',{x:180,y:1030,width:840,height:90},{max:52,min:28,lineHeight:1.25,color:COLORS.rose});
    smallText(context,'珍藏 '+data.wishes.length+' 份祝福',WIDTH/2,1190,31,COLORS.gold);
  }
  function drawRoundAvatar(context,image){
    const x=WIDTH/2,y=454,radius=173;
    context.save();context.shadowColor='#75555019';context.shadowBlur=25;context.shadowOffsetY=8;context.beginPath();context.arc(x,y,radius+15,0,Math.PI*2);context.fillStyle='#fffefa';context.fill();context.restore();
    context.strokeStyle=COLORS.gold;context.lineWidth=2.3;context.beginPath();context.arc(x,y,radius+15,0,Math.PI*2);context.stroke();
    context.save();context.beginPath();context.arc(x,y,radius,0,Math.PI*2);context.clip();
    const side=Math.min(image.naturalWidth,image.naturalHeight);context.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,x-radius,y-radius,radius*2,radius*2);context.restore();
  }
  function guestPage(context,data,wish,index,assets,avatar){
    background(context,assets);
    smallText(context,'幸福祝福書',WIDTH/2,145,33,COLORS.rose,{serif:true,weight:600});
    smallText(context,'A NOTE FOR THE NEWLYWEDS',WIDTH/2,195,19,COLORS.gold,{serif:true});rule(context,235,170);
    drawRoundAvatar(context,avatar);
    textBlock(context,wish.guestName||'賓客',{x:155,y:684,width:890,height:210},{max:66,min:18,lineHeight:1.38,weight:600,color:COLORS.rose});
    rule(context,922,120);
    textBlock(context,wish.blessingText,{x:164,y:965,width:872,height:347},{max:66,min:20,lineHeight:1.5,weight:500});
    const created=dateLabel(wish.createdAt);if(created)smallText(context,created,WIDTH/2,1390,23,COLORS.muted);
    smallText(context,data.coupleName||'仁鈞 ♡ 姮儒',155,1475,25,COLORS.gold,{align:'left'});
    smallText(context,String(index+1).padStart(2,'0')+' / '+data.wishes.length,WIDTH-150,1475,25,COLORS.gold,{align:'right',serif:true});
  }
  async function jpegBytes(canvas,signal){
    const blob=await waitFor(new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('無法產生祝福書圖片，請稍後重試')),'image/jpeg',.91)),signal);
    return new Uint8Array(await waitFor(blob.arrayBuffer(),signal));
  }
  async function create(data,{onProgress,signal}={}){
    check(signal);
    if(!window.PDFLib?.PDFDocument)throw new Error('PDF 工具尚未載入，請重新整理管理頁後再試');
    if(!data||data.schemaVersion!==1||!Array.isArray(data.wishes)||!data.assets)throw new Error('祝福書資料格式不正確');
    const total=data.wishes.length+2,images={};
    const progress=current=>{try{onProgress?.({current,total})}catch{}check(signal);};
    progress(0);
    let canvas;
    try{
      if(document.fonts?.ready)await waitFor(document.fonts.ready,signal);
      for(const key of ['couple','frontCover','backCover','botanical','paperGrain','defaultMale','defaultFemale','defaultNeutral']){
        if(!data.assets[key]&&['botanical','paperGrain'].includes(key))continue;
        images[key]=await imageFromData(data.assets[key],key==='couple'?'新人合照':'婚禮裝飾與預設頭像',signal);
      }
      const pdf=await waitFor(window.PDFLib.PDFDocument.create(),signal);
      pdf.setTitle(String(data.title||'仁鈞＆姮儒｜幸福祝福書'));pdf.setAuthor(String(data.coupleName||'仁鈞 ♡ 姮儒'));pdf.setSubject('婚禮祝福與笑容的離線紀念冊');pdf.setLanguage('zh-TW');pdf.setCreator('Wedding Album');
      const exported=new Date(data.exportedAt);if(Number.isFinite(exported.getTime())){pdf.setCreationDate(exported);pdf.setModificationDate(exported);}
      for(let pageIndex=0;pageIndex<total;pageIndex++){
        check(signal);canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=HEIGHT;
        const context=canvas.getContext('2d',{alpha:false});if(!context)throw new Error('這個瀏覽器無法繪製祝福書，請使用新版 Safari、Chrome 或 Edge');
        let guestImage;
        try{
          if(pageIndex===0)cover(context,data,images);
          else if(pageIndex===total-1)backCover(context,data,images);
          else{
            const wish=data.wishes[pageIndex-1];
            if(!wish||typeof wish.guestName!=='string'||typeof wish.blessingText!=='string')throw new Error('其中一則祝福缺少署名或文字');
            if(wish.avatar)guestImage=await imageFromData(wish.avatar,'賓客頭像',signal);
            const avatar=guestImage||(wish.avatarGender==='male'?images.defaultMale:wish.avatarGender==='female'?images.defaultFemale:images.defaultNeutral);
            guestPage(context,data,wish,pageIndex-1,images,avatar);
          }
          const jpg=await waitFor(pdf.embedJpg(await jpegBytes(canvas,signal)),signal),page=pdf.addPage([180*MM_TO_PT,240*MM_TO_PT]);
          page.drawImage(jpg,{x:0,y:0,width:180*MM_TO_PT,height:240*MM_TO_PT});
        }finally{if(guestImage)guestImage.removeAttribute('src');canvas.width=1;canvas.height=1;canvas=null;}
        progress(pageIndex+1);await yieldToUI(signal);
      }
      const bytes=await waitFor(pdf.save({useObjectStreams:true}),signal);check(signal);
      return new Blob([bytes],{type:'application/pdf'});
    }finally{
      if(canvas){canvas.width=1;canvas.height=1;}
      for(const image of Object.values(images))image.removeAttribute('src');
    }
  }
  window.WeddingAlbumPDF=Object.freeze({create});
})();
