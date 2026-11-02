/* Marineford: server-authoritative rules; only this viewer's private cards arrive here. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id), socket=io({transports:['websocket','polling']});
 let cards={},room=null,view=null,you=-1,me=null,busy=false,queue=Promise.resolve(),epoch=0,lastSequence=-1,queuedSequence=-1,toastTimer,selected=[],pendingKey='',authenticated=false;
 const activeAnimations=new Set();
 const teamName=t=>t==='navy'?'海軍':'海賊';
 const name=id=>view?.players[id]?.name||room?.seats[id]?.name||'玩家';
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
 const button=(text,fn,cls='choice-button')=>{const b=node('button',text,cls);b.type='button';b.onclick=event=>{window.MFSound?.play('click');fn(event);};return b;};
 const ownHand=()=>view?.players[you]?.team==='navy'?$('navyHands'):$('hand');
 const slotName=i=>i===0?'左邊':i===1?'右邊':'新抽';
 const cardArt=id=>'art/v2/'+(cards[id]?.justice?'refined-':'redraw-')+id+'.webp';
 const cardImage=id=>{const c=cards[id],face=node('div',null,'card-face'),img=node('img');face.dataset.card=id;face.dataset.team=c.team;face.dataset.redraw='true';face.title=c.rank+' · '+c.name+'：'+c.effect;img.onload=()=>{face.dataset.loaded='true';};img.src=cardArt(id);img.alt=c.name;img.width=1024;img.height=1536;img.draggable=false;const rank=node('b',String(c.rank),'card-rank'),title=node('strong',c.name,'card-name'),effect=node('span',c.effect,'card-effect');face.append(img,rank,title,effect);return face;};
 function renderNavyStage(){
  let stage=$('executionStage');if(!stage){stage=node('div',null,'execution-stage');stage.id='executionStage';const scaffold=node('img',null,'execution-scaffold');scaffold.src='art/v2/scaffold-field-pirate.webp';scaffold.alt='艾斯跪在處刑台';const hands=node('div');hands.id='navyHands';hands.setAttribute('aria-label','海軍左右手牌');stage.append(scaffold,hands,$('health'));$('table').prepend(stage);}
  const own=view.players[you]?.team==='navy',hands=$('navyHands'),navy=view.players[view.navyId];stage.dataset.own=String(own);$('hand').hidden=own;
  const scaffold=stage.querySelector('.execution-scaffold'),art='art/v2/'+(own?'scaffold-field-navy':'scaffold-field-pirate')+'.webp';if(scaffold.getAttribute('src')!==art)scaffold.src=art;scaffold.alt=own?'海軍視角：艾斯背面與處刑台':'海賊視角：艾斯正面與處刑台';
  if(own){$('hand').replaceChildren();delete $('hand').dataset.cards;return;}
  const stamp='hidden:'+navy.hand.length;if(hands.dataset.cards!==stamp){hands.dataset.cards=stamp;hands.replaceChildren();for(let slot=0;slot<navy.hand.length;slot++){const b=button('',()=>{const p=view?.pending;if(p?.owner===you&&p.slots&&slot<p.slots&&!busy)action({type:'CHOOSE',slot});else notify('海軍'+slotName(slot)+'手牌尚未公開');},'navy-slot');b.dataset.slot=slot;const img=node('img');img.src='art/v2/navy-back.webp';img.alt='未公開的海軍手牌';img.draggable=false;b.append(img,node('span',slotName(slot),'navy-slot-label'));hands.append(b);}}
  for(const b of hands.children){const can=!!(view.pending?.owner===you&&view.pending.slots&&Number(b.dataset.slot)<view.pending.slots&&!busy);b.dataset.selectable=String(can);b.disabled=busy;b.setAttribute('aria-label','海軍'+slotName(Number(b.dataset.slot))+'手牌'+(can?'，點擊選擇':'，未公開'));}
 }

 const avatar=id=>{const p=room?.seats[id]||(id===you?me:null),img=node('img');const a=Number(p?.avatar);img.className='avatar';img.src=p?.cpu?'art/v2/'+(view?.players[id]?.team||'pirate')+'-back.webp':'/images/board/avatars/'+(Number.isSafeInteger(a)&&a>=1&&a<=222?a:8)+'.webp';img.alt='';img.setAttribute('aria-label',p?.name||'玩家');img.draggable=false;return img;};
 async function profile(){const body=sheet('航海者檔案','profile'),loading=node('p','讀取戰績中…');body.append(loading);const result=await request('MF_PROFILE');if($('sheetTitle').textContent!=='航海者檔案')return;body.replaceChildren();const hero=node('div',null,'profile-hero');hero.append(avatar(you),node('h2',me?.name||'航海者'),node('p','MARINEFORD · 頂上戰爭篇'));body.append(hero);if(!result.ok){body.append(node('p','戰績暫時無法讀取，請稍後重試。'));return;}const grid=node('div',null,'profile-metrics');for(const [key,label]of [['games','完成對局'],['wins','勝場'],['navyGames','海軍出戰'],['navyWins','海軍勝場'],['pirateGames','海賊出戰'],['pirateWins','海賊勝場']]){const box=node('div');box.style.setProperty('--digits',String(String(result.stats[key]||0).length));box.append(node('strong',String(result.stats[key]||0)),node('span',label));grid.append(box);}body.append(grid,node('p',result.pending?'本場戰績同步中，請稍後重新開啟。':'含 CPU 的完成對局也計入；中途結束不計戰績。','sheet-hint'));}

 const notify=text=>{clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4000);};
 function request(event,payload={}) {return new Promise(resolve=>socket.timeout(12000).emit(event,payload,(err,result)=>{if(err){notify('連線逾時，請稍後再試');resolve({ok:false});}else{if(!result?.ok)notify(result?.error||'操作未完成');resolve(result||{ok:false});}}));}
 function closeSheet(){ $('sheet').hidden=true; }
 function sheet(title,kind='general'){$('sheet').dataset.kind=kind;$('sheetTitle').textContent=title;$('sheetBody').replaceChildren();$('sheet').hidden=false;return $('sheetBody');}
 function detail(id,play=false){const c=cards[id],body=sheet(c.name,'detail'),img=cardImage(id);img.classList.add('detail-card');const text=node('div',null,'detail-copy');text.append(node('small',teamName(c.team)+' · '+(c.justice?'正義卡':'角色卡'),'detail-kicker'),node('h3',c.name),node('p',c.effect));const footer=node('div',null,'detail-actions');if(play){const b=button(c.rank===7?'不能主動打出':'打出這張牌',()=>action({type:'PLAY',card:id}));b.disabled=c.rank===7||busy;footer.append(b);}else footer.append(button('返回牌桌',closeSheet));text.append(footer);body.append(img,text);}
 function gallery(title,ids,explain=false){const body=sheet(title,'gallery'),grid=node('div',null,'gallery');if(explain)body.append(node('p','這裡是已打出的牌及一般敗牌。正義卡正常打出會保留；被擊敗則先補抽，再只把該張正義卡洗回。','sheet-hint'));if(!ids.length)body.append(node('p','目前沒有公開牌'));for(const id of ids){const b=button('',()=>detail(id),'');b.append(cardImage(id));grid.append(b);}body.append(grid);}
 async function action(a){if(busy||!view)return;busy=true;closeSheet();render();const result=await request('MF_ACTION',{revision:view.revision,action:a});if(!result.ok){busy=false;render();}}
 function renderLobby(){if(view)return;document.body.dataset.screen='lobby';$('justice').hidden=true;$('health').replaceChildren();$('lobby').hidden=false;$('table').hidden=true;const body=$('lobbyBody');body.replaceChildren();$('lobby').dataset.waiting=String(!!room);if(!authenticated){body.append(node('p','請從啟動器登入帳號後進入頂上戰爭篇。'));return;}
  if(!room){const identity=node('div',null,'lobby-identity');identity.append(avatar(you),node('strong',me.name),node('span','出航準備'));body.append(identity,node('h2','加入頂上之戰','lobby-heading'));
   const row=node('div',null,'lobby-entry'),host=node('div',null,'lobby-host'),join=node('div',null,'lobby-join');host.append(node('small','召集同伴'),button('建立房間',()=>request('MF_CREATE')));const input=node('input');input.placeholder='輸入房間代碼';input.maxLength=7;input.autocomplete='off';input.setAttribute('aria-label','房間代碼');join.append(input,button('加入房間',()=>request('MF_JOIN',{code:input.value.trim()})));row.append(host,join);body.append(row,node('p','2–6 人 · 一位海軍對抗海賊團 · 可加入 CPU','lobby-note'));const links=node('div',null,'lobby-links');links.append(button('航海者檔案',profile,'small-button'),button('卡片圖鑑',()=>gallery('頂上戰爭 · 卡片圖鑑',Object.keys(cards)),'small-button'));body.append(links);return;}
  body.append(node('h2',room.code,'room-code'));for(const p of room.seats){const row=node('div',null,'room-seat');row.append(node('span',String(p.id+1).padStart(2,'0')),node('strong',p.name),node('span',p.id===room.navyId?'海軍':'海賊'),node('small',p.ready?'已準備':'準備中'));if(me.userId===room.host&&p.id!==room.navyId)row.append(button('海軍',()=>request('MF_CONFIG',{navyId:p.id}),'small-button'));body.append(row);}
  const row=node('div',null,'lobby-actions');if(me.userId===room.host){if(room.seats.length<6)row.append(button('加入 CPU',()=>request('MF_CONFIG',{addCpu:true})));if(room.seats.some(p=>p.cpu))row.append(button('移除 CPU',()=>request('MF_CONFIG',{removeCpu:true})));row.append(button('開始對局',()=>request('MF_START')));}else{const p=room.seats[you];row.append(button(p?.ready?'取消準備':'準備',()=>request('MF_READY',{ready:!p?.ready})));}row.append(button('離開房間',leave,'small-button'));body.append(row,node('p','海軍先行，依順位輪流。戰鬥時有士氣就自動消耗 1 個，戰力 +2。','lobby-note'));
 }
 async function leave(){const r=await request('MF_LEAVE');if(r.ok){reset();room=null;view=null;you=-1;sessionStorage.removeItem('marineford.room');closeSheet();render();}}
 function updateText(el,text){if(el.textContent!==text)el.textContent=text;}
 function renderPlayers(actor){
  const root=$('players'),ownTeam=view.players[you]?.team,key=you+':'+view.players.map(p=>p.id+':'+p.team).join('|');
  $('table').dataset.perspective=ownTeam;
  if(root.dataset.seats!==key){root.dataset.seats=key;root.replaceChildren();for(const side of ['enemy','ally']){
   const row=node('div',null,'fleet-row');row.dataset.side=side;const members=view.players.filter(p=>(p.id===you)===(side==='ally'));row.style.setProperty('--count',members.length);row.setAttribute('aria-label',side==='ally'?'我的資訊':'其他玩家');root.append(row);
   for(const p of members){const seat=node('div',null,'seat');seat.dataset.player=p.id;const info=node('div',null,'seat-info'),title=node('strong'),meta=node('small',null,'seat-meta'),morale=node('small',null,'morale');info.append(title,meta,morale);const publicButton=button('',()=>{const now=view.players[p.id];gallery(now.name+'的場上明牌',now.played,true);},'public-cards');const portrait=button('',()=>{const now=view.players[p.id],body=sheet(now.name+' · '+teamName(now.team),'player');body.append(avatar(p.id),node('h3',now.name),node('p','順位 '+(p.id+1)+' · 手牌 '+now.hand.length+' 張 · 士氣 '+now.morale));const grid=node('div',null,'gallery');for(const id of now.played){const b=button('',()=>detail(id),'');b.append(cardImage(id));grid.append(b);}body.append(node('p','場上明牌 '+now.played.length+' 張','sheet-hint'),grid);if(p.id===you)body.append(button('對局功能',()=>openMatchMenu()));body.append(button('返回牌桌',closeSheet));},'portrait-button');portrait.setAttribute('aria-label',p.name+'的玩家資訊與公開牌');portrait.append(avatar(p.id));seat.append(portrait,node('span',String(p.id+1).padStart(2,'0'),'seat-number'),info,publicButton);row.append(seat);}
  }}
  for(const p of view.players){const seat=root.querySelector('[data-player="'+p.id+'"]');seat.dataset.current=String(p.id===actor&&view.phase==='playing');seat.dataset.self=String(p.id===you);seat.dataset.team=p.team;const info=seat.querySelector('.seat-info');updateText(info.querySelector('strong'),p.name+(p.id===you?' · 我':''));info.querySelector('strong').title=p.name;updateText(info.querySelector('.seat-meta'),teamName(p.team)+' '+p.hand.length+' 張');updateText(info.querySelector('.morale'),'士氣'+p.morale);const b=seat.querySelector('.public-cards');const stamp=p.played.join('|');if(b.dataset.cards!==stamp){b.dataset.cards=stamp;b.replaceChildren();const strip=node('span',null,'public-thumbs');for(const id of p.played.slice(-4)){const img=node('img');img.src=cardArt(id);img.alt=cards[id].rank+' · '+cards[id].name;const thumb=node('span',null,'public-thumb');thumb.append(img,node('b',String(cards[id].rank)));strip.append(thumb);}b.append(strip,node('span',p.played.length?'明牌 '+p.played.length:'尚無明牌','public-count'));}b.setAttribute('aria-label',p.name+'的場上明牌 '+p.played.length+' 張，點擊查看全部');b.disabled=busy;}
 }
 // hp keys remain the damage recipient. Display only maps them to the opposing team's advance.
 function progressDetail(team){
  const max=team==='navy'?(view.players.length<=3?4:view.players.length+1):6,rescue=team==='navy',body=sheet(rescue?'海賊救援路線':'海軍登台進度'),text=node('div',null,'detail-copy');
  text.append(node('h3',(rescue?'救援':'登台')+' '+(max-view.hp[team])+' / '+max),node('p',rescue?'海軍每被擊敗一張手牌，海賊救援隊前進一步。走完救援路線，登上處刑台救出艾斯，海賊獲勝。':'海賊每被擊敗一張手牌，海軍向處刑台前進一步。走完六步，執行處刑，海軍獲勝。進度只隨卡牌結算推進，不會隨現實時間自動增加。'),node('p','海軍也能在自己的回合完成效果後，以手中與場上集齊六種正義獲勝。未公開的正義手牌不會顯示給其他玩家。'),button('返回牌桌',closeSheet));body.append(text);
 }
 function renderProgress(hp=view.hp){
  $('justice').hidden=false;const health=$('health'),navyMax=view.players.length<=3?4:view.players.length+1;
  if(health.dataset.limit!==String(navyMax)||!health.querySelector('.advance-route')){
   health.dataset.limit=String(navyMax);health.replaceChildren();health.setAttribute('aria-label','通往艾斯的共同登台路線');
   const route=node('div',null,'advance-route');route.setAttribute('aria-hidden','true');for(let i=0;i<8;i++)route.append(node('i'));health.append(route,node('span','艾斯','route-goal'));
   for(const team of ['navy','pirate']){const h=button('',()=>progressDetail(team),'health-box');h.dataset.team=team;h.append(node('span',team==='navy'?'救援':'登台'),node('strong'));const marker=node('span',null,'route-marker');marker.dataset.team=team;marker.append(node('b',team==='navy'?'救':'刑'));route.append(marker);health.append(h);}
  }
  for(const team of ['navy','pirate']){const h=health.querySelector('.health-box[data-team="'+team+'"]'),max=team==='navy'?navyMax:6,spent=max-hp[team],marker=health.querySelector('.route-marker[data-team="'+team+'"]');updateText(h.querySelector('strong'),spent+'/'+max);h.setAttribute('aria-label',(team==='navy'?'海賊救援':'海軍登台')+' '+spent+' / '+max+'，點擊查看規則');marker.style.setProperty('--advance',String(spent/max));marker.dataset.step=String(spent);h.disabled=busy;}
 }
 // Map both deck surfaces onto the same camera/floor, rather than tilting each pile independently.
 function placeGroundDecks(){
  if(!view||$('table').hidden)return;const W=$('table').clientWidth,H=$('table').clientHeight,sceneH=Math.max(H,W*941/1672),crop=(sceneH-H)*.4,navy=view.players[you]?.team==='navy';
  if(W<=0||H<=0)return;
  const horizon=sceneH*.42-crop,floor=sceneH*(navy?.77:.65)-crop,front=H*.945,back=Math.min(front-18,Math.max(H*.815,floor+5)),ratio=(back-horizon)/(front-horizon),fw=Math.max(54,Math.min(118,W*.08));
  for(const pile of $('deckZone').children){const cx=W*(pile.dataset.team==='navy'?.34:.66),rear=W*.5+(cx-W*.5)*ratio,tw=fw*ratio;
   const world=[[rear-tw/2,back],[rear+tw/2,back],[cx+fw/2,front],[cx-fw/2,front]],left=Math.min(...world.map(p=>p[0]))-6,top=back-14,width=Math.max(...world.map(p=>p[0]))-left+6;
   pile.style.left=left+'px';pile.style.top=top+'px';pile.style.width=width+'px';pile.style.height=(front-top+16)+'px';
   const q=world.map(([x,y])=>[x-left,y-top]),[[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=q,dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3,dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3,den=dx1*dy2-dx2*dy1,g=(dx3*dy2-dx2*dy3)/den,j=(dx1*dy3-dx3*dy1)/den;
   const w=fw,h=fw*1.5,m=[(x1-x0+g*x1)/w,(y1-y0+g*y1)/w,0,g/w,(x3-x0+j*x3)/h,(y3-y0+j*y3)/h,0,j/h,0,-1,1,0,x0,y0,0,1],plane=pile.querySelector('.deck-plane');
   plane.style.width=w+'px';plane.style.height=h+'px';plane.style.transform='matrix3d('+m.join(',')+')';const contact=pile.querySelector('.deck-contact i');contact.style.width=w+'px';contact.style.height=h+'px';contact.style.transform=plane.style.transform;pile.dataset.floor=JSON.stringify({corners:world,horizon,floor,front,back});
  }
 }
 window.addEventListener('resize',placeGroundDecks);
 function render(){if(!Object.keys(cards).length)return;if(!view){renderLobby();return;}document.body.dataset.screen='table';$('lobby').hidden=true;$('table').hidden=false;renderProgress();
  const actor=view.pending?.owner??view.turn;renderPlayers(actor);renderNavyStage();
  if(!$('justice').children.length){for(let i=1;i<=6;i++){const id='justice-'+i,b=button(String(i),()=>detail(id),'justice-slot');b.dataset.card=id;b.setAttribute('aria-label','正義 '+i);$('justice').append(b);}}for(const b of $('justice').children){const collected=String(view.players[view.navyId].played.includes(b.dataset.card));if(b.dataset.collected!==collected){b.dataset.collected=collected;b.replaceChildren(collected==='true'?cardImage(b.dataset.card):document.createTextNode(b.dataset.card.split('-')[1]));}b.disabled=busy;}
  if(!$('deckZone').children.length){for(const team of ['navy','pirate']){
   const b=button('',()=>{if(canDraw()&&view.players[you].team===team)action({type:'DRAW'});else gallery(teamName(team)+'場上明牌',view.players.filter(p=>p.team===team).flatMap(p=>p.played),true);},'deck');b.dataset.team=team;
   const plane=node('span',null,'deck-plane');for(let i=0;i<7;i++){const img=node('img',null,i===6?'deck-top':'deck-layer');img.src='art/v2/'+team+'-back.webp';img.alt=i===6?teamName(team)+'牌堆':'';if(i!==6)img.setAttribute('aria-hidden','true');img.draggable=false;img.dataset.layer=String(i);plane.append(img);}const contact=node('span',null,'deck-contact');contact.setAttribute('aria-hidden','true');contact.append(node('i'));b.append(contact,plane,node('b'));$('deckZone').append(b);
  }}
  for(const b of $('deckZone').children){const team=b.dataset.team,count=view.deckCounts[team],layers=Math.min(6,Math.max(0,count-1));b.dataset.active=String(canDraw()&&view.players[you].team===team);b.dataset.empty=String(count===0);b.disabled=busy;b.dataset.count=String(count);
   for(const img of b.querySelectorAll('img')){const i=Number(img.dataset.layer),top=img.classList.contains('deck-top');img.hidden=!top&&i>=layers;img.style.setProperty('--layer-z',(top?layers:i)*1.0+'px');}updateText(b.querySelector('b'),teamName(team)+'牌堆 · '+count);b.setAttribute('aria-label',teamName(team)+'牌堆，剩 '+count+' 張'+(b.dataset.active==='true'?'，點擊抽牌':'，點擊查看公開牌'));
  }
  placeGroundDecks();
  const hand=ownHand(),ids=(view.players[you]?.hand||[]).filter(Boolean),handKey=ids.join('|');if(hand.dataset.cards!==handKey){hand.dataset.cards=handKey;hand.replaceChildren();for(const [slot,id] of ids.entries()){const b=button('',()=>detail(id,!view.pending&&view.turn===you&&view.step==='play'&&!busy),'hand-card');b.dataset.card=id;b.dataset.slot=slot;b.append(cardImage(id));if(view.players[you].team==='navy')b.append(node('span',slotName(slot),'navy-slot-label'));hand.append(b);}}
  for(const held of hand.children){held.style.visibility='';held.disabled=busy;}hand.dataset.playable=String(!busy&&!view.pending&&view.turn===you&&view.step==='play');
  $('turnLabel').textContent=view.phase==='ended'?teamName(view.winner)+'獲勝':busy?'演出中':actor===you?'輪到你了':name(actor)+'的行動';
  $('status').textContent=view.phase==='ended'?'本場對局結束':busy?'等所有玩家看完後繼續':view.pending?pendingDescription(view.pending):view.step==='draw'?'點兩側發光牌堆抽牌':'選擇要打出的牌';
  const actions=$('actions');actions.replaceChildren();if(view.phase==='ended'){actions.append(button('查看戰果',()=>showResult()),button('返回大廳',leave));return;}if(busy){actions.append(node('p','演出完成後繼續','waiting'));return;}if(canDraw())actions.append(node('p','點擊發光的'+teamName(view.players[you].team)+'牌堆抽牌','action-hint'));else if(view.pending?.owner===you)actions.append(button('進行選擇',showPending));else if(view.turn===you&&!view.pending)actions.append(node('p','點手牌查看與打出','action-hint'));else actions.append(node('p','等待 '+name(actor),'action-hint'));
  const key=view.pending?view.revision+':'+view.pending.type:'';if(view.pending?.owner===you&&key!==pendingKey){pendingKey=key;showPending();}if(!view.pending)pendingKey='';
 }
 const canDraw=()=>!busy&&view?.phase==='playing'&&!view.pending&&view.turn===you&&view.step==='draw';
 const descriptions={'target-guess':'選擇要猜牌的對手',guess:'猜測對手手牌的數字',threshold:'選擇要攻擊的海賊','peek-reader':'選擇查看海軍手牌的隊友','peek-slot':'選一張海軍手牌查看',read:'看完後確認繼續','morale-target':'選擇獲得士氣的隊友',order:'從左到右，安排牌堆最上方的順序',return:'依序選擇放回牌堆底的手牌',copy:'選擇要複製的公開牌','fight-ally':'選擇出戰的海賊','fight-target':'選擇對手，或放棄戰鬥','battle-card':'選擇海軍出戰的手牌',arrange:'調整海軍手牌順序，再讓海賊盲選','battle-slot':'選一張海軍手牌交戰','defeat-choice':'確認被擊敗的手牌；同點數時只選一張',review:'海軍檢視海賊公開牌；確認後補充牌堆，再繼續效果'};
 function pendingDescription(p){return descriptions[p.type]||'完成選擇';}
 function showPending(){const p=view?.pending;if(!p||p.owner!==you||busy)return;if(p.slots){closeSheet();$('status').textContent='點選艾斯左邊或右邊的海軍手牌';renderNavyStage();return;}const body=sheet(pendingDescription(p),'choice');$('sheet').dataset.choice=p.type;selected=[];const choose=data=>action({type:'CHOOSE',...data});
  if(p.targets&&p.type!=='guess'){const grid=node('div',null,'target-grid');for(const id of p.targets){const player=view.players[id],b=button('',()=>choose({target:id}),'target-choice');b.setAttribute('aria-label',name(id));const copy=node('span',null,'target-copy');copy.append(node('strong',name(id)),node('small',teamName(player.team)+' · 手牌 '+player.hand.length+' · 士氣 '+player.morale));b.append(avatar(id),copy);grid.append(b);}body.append(node('p','點選要使用效果的玩家','sheet-hint'),grid);if(p.type==='fight-target')body.append(button('放棄這次戰鬥',()=>choose({skip:true})));}
  if(p.digits){body.append(node('p','猜 '+p.targets.map(name).join('、')+' 的手牌','sheet-hint'));const digits=node('div',null,'digits');for(const digit of p.digits)digits.append(button(String(digit),()=>choose({digit}),'small-button'));body.append(digits);}
  if(p.slots){for(let slot=0;slot<p.slots;slot++){const b=button('',()=>choose({slot}),'pick-card'),img=node('img');img.src='art/v2/navy-back.webp';img.alt='未知的海軍手牌';b.append(img,node('span',slotName(slot)+'手牌'));body.append(b);}}
  if(p.cards){const row=node('div',null,'pick-row'),multi=['return','order','arrange'].includes(p.type),read=['read','review'].includes(p.type);body.append(row);let confirm;
   const refresh=()=>{for(const b of row.children){const index=selected.indexOf(b.dataset.card);b.classList.toggle('selected',index>=0);b.querySelector('.pick-label').textContent=index>=0?'第 '+(index+1)+' 張':cards[b.dataset.card].name;}if(confirm)confirm.disabled=selected.length!==(p.type==='return'?p.count:p.cards.length);};
   for(const id of p.cards){const b=button('',()=>{if(read){b.classList.toggle('expanded');return;}if(multi){const index=selected.indexOf(id);if(index>=0)selected.splice(index,1);else if(p.type!=='return'||selected.length<p.count)selected.push(id);refresh();}else choose({card:id});},'pick-card');b.dataset.card=id;b.append(cardImage(id),node('span',cards[id].name,'pick-label'));row.append(b);}
   if(multi){const footer=node('div',null,'sheet-actions');footer.append(node('p',p.type==='return'?'選 '+p.count+' 張，依序放入牌堆底':'依序點牌；第一張是最左／牌堆最上方','sheet-hint'));confirm=button('確認順序',()=>choose({cards:selected.slice()}));footer.append(confirm);body.append(footer);refresh();}
   if(read){const footer=node('div',null,'sheet-actions');footer.append(node('p',p.type==='read'?'只有你能看到這張手牌。':'看完後，公開牌才會洗回海賊牌堆。','sheet-hint'),button('我看完了 · 繼續',()=>choose({done:true})));body.append(footer);}
  }
 }
 function animate(element,frames,options){const a=element.animate(frames,options);activeAnimations.add(a);return a.finished.catch(()=>{}).finally(()=>activeAnimations.delete(a));}
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 async function beat(ms,token){if(token!==epoch)return;const marker=node('i');$('effectLayer').append(marker);await animate(marker,[{opacity:0},{opacity:0}],{duration:ms});marker.remove();}
 async function burst(kind,token){if(token!==epoch)return;const fx=node('img',null,'effect-burst');fx.src='art/v2/fx-'+kind+'.webp';fx.alt='';$('effectLayer').append(fx);window.MFSound?.play(kind);await animate(fx,[{transform:'scale(.15) rotate(-12deg)',opacity:0},{transform:'scale(.85)',opacity:1,offset:.35},{transform:'scale(1.1) rotate(6deg)',opacity:0}],{duration:reduced()?180:850,easing:'ease-out'});fx.remove();}
 const readingTime=(text,minimum=1600)=>Math.max(minimum,Math.min(3200,600+Array.from(text).length*75));
 function resultText(state=view){return state.winner==='pirate'?{title:'艾斯獲救',reason:'海賊登上處刑台，成功救出艾斯。'}:state.hp.pirate===0?{title:'處刑執行',reason:'海軍登上處刑台，執行處刑。'}:{title:'正義集結',reason:'六種正義集齊，海軍獲勝。'};}
 function showResult(){if(view?.phase!=='ended')return;const result=resultText(),body=sheet('頂上戰爭 · 戰果','result'),seal=node('img',null,'result-seal');seal.src='art/v2/'+view.winner+'-back.webp';seal.alt=teamName(view.winner);const text=node('div',null,'result-copy');text.append(node('small',teamName(view.winner)+'方勝利'),node('h2',result.title),node('p',result.reason),node('p',view.players.filter(p=>p.team===view.winner).map(p=>p.name).join('、'),'result-roster'));const actions=node('div',null,'result-actions');actions.append(button('返回牌桌查看',closeSheet),button('返回大廳',leave));text.append(actions);body.append(seal,text);}
 async function progressBeat(e,hp,token){
  if(token!==epoch)return;const board=$('executionStage'),panel=$('health').querySelector('.health-box[data-team="'+e.team+'"]'),marker=$('health').querySelector('.route-marker[data-team="'+e.team+'"]'),max=e.team==='navy'?(view.players.length<=3?4:view.players.length+1):6;
  board.dataset.phase='advance';const from=(max-hp[e.team])/max,to=(max-e.hp)/max;
  $('status').textContent=e.team==='navy'?'海賊突破防線，向艾斯前進':'海軍向處刑台前進';window.MFSound?.play('click');
  // Numbers remain at their previous value until the walking marker reaches its next step.
  await animate(marker,[{bottom:(from*100)+'%',filter:'brightness(1)'},{bottom:((from+to)/2*100)+'%',filter:'brightness(1.8)',offset:.5},{bottom:(to*100)+'%',filter:'brightness(1)'}],{duration:reduced()?150:1250,easing:'ease-in-out'});
  if(token!==epoch)return;hp[e.team]=e.hp;renderProgress(hp);board.dataset.phase='progress';
  await animate(panel,[{filter:'brightness(1)'},{filter:'brightness(1.7)',offset:.3},{filter:'brightness(1)'}],{duration:reduced()?120:650});if(token!==epoch)return;await beat(800,token);if(token===epoch)delete board.dataset.phase;
 }
 async function scene(text,ids=[],kind='card',token=epoch,source=null,participants=[],options={}){
  const layer=$('effectLayer');layer.replaceChildren();layer.dataset.kind=kind;layer.dataset.phase='announce';const stage=node('div',null,'effect-stage'),caption=node('p',text,'effect-caption');layer.append(stage,caption);
  await animate(caption,[{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'translateY(0)'}],{duration:reduced()?80:320});await beat(readingTime(text,1300),token);if(token!==epoch)return;
  const faces=ids.map(id=>{const face=cardImage(id);face.classList.add('effect-card');stage.append(face);return face;});await Promise.all([...stage.querySelectorAll('img')].map(i=>i.decode().catch(()=>{})));if(token!==epoch)return;
  const duration=reduced()?140:800;
  if(kind==='battle'){
   if(!faces.length)for(const id of participants){const back=node('img',null,'effect-card hidden-card');back.src='art/v2/'+view.players[id].team+'-back.webp';back.alt='未公開手牌';stage.append(back);faces.push(back);}
   const wraps=faces.map((face,i)=>{const wrap=node('div',null,'combatant');face.replaceWith(wrap);wrap.append(node('strong',name(participants[i]),'combatant-name'),face,node('small',teamName(view.players[participants[i]]?.team),'combatant-team'));if(options.values){const rank=cards[ids[i]].rank,score=options.values[i];wrap.append(node('strong',String(rank),'battle-math'));}else wrap.append(node('small','手牌不公開','battle-math'));return wrap;});
   const versus=node('b','VS','battle-versus');stage.append(versus);layer.dataset.phase='compare';
   await Promise.all(wraps.map((wrap,i)=>animate(wrap,[{transform:`translateX(${i?120:-120}px) scale(.85)`,opacity:0},{transform:'translateX(0) scale(1)',opacity:1}],{duration,easing:'cubic-bezier(.16,.7,.28,1)'})));await beat(1600,token);if(token!==epoch)return;
   for(let i=0;i<wraps.length;i++){
    const team=view.players[participants[i]]?.team,rank=ids[i]?cards[ids[i]].rank:null,score=options.values?.[i],boost=Number(options.boost?.[team]||(score!=null&&rank!=null?score-rank:0));
    if(boost>0){layer.dataset.phase='morale-cheer';caption.textContent=name(participants[i])+' · '+teamName(team)+'助威';const crowd=node('img',null,'morale-crowd');crowd.dataset.team=team;crowd.src='art/v2/redraw-morale-'+team+'.webp';crowd.alt=teamName(team)+'士兵吶喊助威';stage.prepend(crowd);await crowd.decode().catch(()=>{});if(token!==epoch)return;window.MFSound?.play('rally');
     await animate(crowd,[{opacity:0,transform:'translateY(45px) scale(.94)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:reduced()?100:650});await beat(1100,token);if(token!==epoch)return;
     layer.dataset.phase='morale-add';caption.textContent=name(participants[i])+' 消耗 1 士氣 · 戰鬥力 +2';const math=wraps[i].querySelector('.battle-math');math.textContent=rank!=null?rank+' + 士氣 2 = '+score:'士氣 +2 · 手牌不公開';const plus=node('b','+2','morale-plus');wraps[i].append(plus);window.MFSound?.play('morale');await animate(plus,[{opacity:0,transform:'translateY(20px) scale(.6)'},{opacity:1,transform:'translateY(0) scale(1.15)',offset:.45},{opacity:1,transform:'scale(1)'}],{duration:reduced()?100:850});await beat(1200,token);if(token!==epoch)return;await animate(crowd,[{opacity:1},{opacity:0}],{duration:350});crowd.remove();plus.remove();
    }else if(score!=null)wraps[i].querySelector('.battle-math').textContent=rank+' = '+score;
   }
   layer.dataset.phase='compare';caption.textContent=name(participants[0])+' 對戰 '+name(participants[1]);await beat(1500,token);if(token!==epoch)return;
   layer.dataset.phase='charge';caption.textContent='交鋒';window.MFSound?.play('slash');await Promise.all(faces.map((face,i)=>animate(face,[{transform:'translateX(0)'},{transform:`translateX(${i?18:-18}px) rotate(${i?4:-4}deg) scale(1.04)`}],{duration:reduced()?80:650})));
   layer.dataset.phase='impact';await Promise.all(faces.map((face,i)=>animate(face,[{transform:`translateX(${i?18:-18}px) scale(1.04)`},{transform:`translateX(${i?-35:35}px) rotate(${i?-8:8}deg)`,offset:.55},{transform:'translateX(0) rotate(0)'}],{duration:reduced()?100:700,easing:'ease-in'})));await burst(options.fx||'quake',token);await beat(500,token);if(token!==epoch)return;
   layer.dataset.phase='result';const outcome=options.outcome;
   if(outcome?.type==='defeat'){
    const index=participants.indexOf(outcome.player),old=faces[index];if(old){if(old.classList.contains('hidden-card')){const face=cardImage(outcome.card);face.classList.add('effect-card');old.replaceWith(face);faces[index]=face;await face.querySelector('img').decode().catch(()=>{});}const face=faces[index];face.classList.add('defeated-card');await animate(face,[{filter:'brightness(1.8)',transform:'rotate(0)'},{filter:'brightness(.65)',transform:'rotate(7deg) translateY(12px)'}],{duration:reduced()?120:800,fill:'forwards'});}
    caption.textContent=name(outcome.player)+' 的 '+cards[outcome.card].rank+' 號「'+cards[outcome.card].name+'」被擊敗';
   }else caption.textContent=outcome?.type==='tie'?'平手 · 雙方保留手牌':'雙方手牌比較';
   await beat(readingTime(caption.textContent,2600),token);
  }else if(kind==='justice'){
   const id=ids[0],rank=cards[id].rank,face=faces[0],aura=node('div',null,'justice-aura');aura.style.backgroundImage='url("'+cardArt(id)+'")';stage.prepend(aura);
   layer.dataset.phase='justice-awaken';window.MFSound?.play(rank===3?'ice':rank===4||rank===6?'morale':'quake');
   const a=source?.getBoundingClientRect(),r=face.getBoundingClientRect();await animate(face,[{opacity:0,transform:a?`translate(${a.x+a.width/2-r.x-r.width/2}px,${a.y+a.height/2-r.y-r.height/2}px) scale(.4)`:'scale(.4)'},{opacity:1,transform:'translate(0,0) scale(1)'}],{duration:reduced()?120:900,easing:'cubic-bezier(.16,.7,.28,1)'});
   if(token!==epoch)return;await Promise.all([animate(aura,[{opacity:0,transform:'scale(.7)'},{opacity:.65,transform:'scale(1.06)',offset:.65},{opacity:.35,transform:'scale(1.1)'}],{duration:reduced()?150:1500}),animate(face,[{filter:'brightness(1) drop-shadow(0 0 0 #9ddfff)'},{filter:'brightness(1.15) drop-shadow(0 0 25px #9ddfff)',offset:.5},{filter:'brightness(1) drop-shadow(0 0 12px #9ddfff)'}],{duration:reduced()?150:1500})]);
   if(token!==epoch)return;layer.dataset.phase='justice-release';await burst(rank===3?'ice':rank===5?'fire':'quake',token);await beat(1500,token);
  }else if(kind==='defeat'){
   layer.dataset.phase='reveal';await Promise.all(faces.map(face=>animate(face,[{opacity:0,transform:'scale(.75)'},{opacity:1,transform:'scale(1)'}],{duration})));await beat(1700,token);layer.dataset.phase='impact';await burst(ids[0]?.startsWith('navy')?'ice':'fire',token);layer.dataset.phase='result';for(const face of faces)face.classList.add('defeated-card');await beat(2200,token);
  }else if(kind==='shuffle'){
   layer.dataset.phase='return';if(faces.length){await Promise.all(faces.map(face=>animate(face,[{opacity:0,transform:'scale(.8)'},{opacity:1,transform:'scale(1)'}],{duration})));await beat(1600,token);await Promise.all(faces.map(face=>animate(face,[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.3) translateY(90px)'}],{duration})));for(const face of faces)face.remove();}
   if(token!==epoch)return;const pile=$('deckZone').querySelector('[data-team="'+(source==='navy'?'navy':'pirate')+'"]');if(!pile)return;const plane=pile.querySelector('.deck-plane'),backs=[];
   layer.dataset.kind='ground-shuffle';layer.dataset.phase='shuffle';pile.dataset.shuffling='true';window.MFSound?.play('shuffle');
   for(let i=0;i<5;i++){const back=node('img',null,'deck-shuffle-card');back.src='art/v2/'+(source==='navy'?'navy':'pirate')+'-back.webp';back.alt='';back.setAttribute('aria-hidden','true');back.style.setProperty('--layer-z',(i*1.0)+'px');plane.append(back);backs.push(back);}
   await Promise.all(backs.map((face,i)=>animate(face,[{transform:`translateZ(${i*1.0}px)`},{transform:`translateX(${i<3?-4:4}px) translateZ(${i+3}px)`,offset:.3},{transform:`translateX(${i<3?3:-3}px) translateZ(${i+2}px)`,offset:.65},{transform:`translateZ(${i*1.0}px)`}],{duration:reduced()?180:1600,easing:'ease-in-out'})));for(const back of backs)back.remove();delete pile.dataset.shuffling;if(token!==epoch)return;await beat(650,token);

  }else if(kind==='victory'){
   layer.dataset.phase='victory';stage.classList.add('victory-stage');const winner=options.state.winner,result=resultText(options.state),seal=node('img',null,'victory-seal'),title=node('h2',result.title,'victory-title');seal.src='art/v2/'+winner+'-back.webp';seal.alt=teamName(winner);stage.prepend(seal,title);caption.textContent=teamName(winner)+'方勝利 · '+result.reason;window.MFSound?.play('victory');await animate(seal,[{transform:'scale(.5) rotate(-12deg)',opacity:0},{transform:'scale(1.07) rotate(2deg)',opacity:1,offset:.7},{transform:'scale(1) rotate(0)'}],{duration:reduced()?150:1600});await animate(title,[{opacity:0,transform:'translateY(25px)',letterSpacing:'.3em'},{opacity:1,transform:'translateY(0)',letterSpacing:'.06em'}],{duration:reduced()?120:950});await beat(3400,token);
  }else{
   layer.dataset.phase='reveal';window.MFSound?.play(kind==='morale'?'morale':kind==='miss'?'miss':'play');await Promise.all(faces.map(face=>{const r=face.getBoundingClientRect(),a=source?.getBoundingClientRect();return animate(face,[{transform:a?`translate(${a.x+a.width/2-r.x-r.width/2}px,${a.y+a.height/2-r.y-r.height/2}px) scale(.45)`:'translateY(30px) scale(.8)',opacity:.2},{transform:'translate(0,0) scale(1)',opacity:1}],{duration,easing:'cubic-bezier(.16,.7,.28,1)'});}));await beat(ids.length?2400:1600,token);
  }
  if(token===epoch){layer.dataset.phase='settle';await animate(caption,[{opacity:1},{opacity:0}],{duration:280});layer.replaceChildren();}
 }

 async function present(packet,token){if(token!==epoch)return;busy=true;closeSheet();render();const events=packet.events||[],presentationHP={...view.hp};let victory=false;for(let i=0;i<events.length;i++){if(token!==epoch)return;const e=events[i],p=name(e.player),target=name(e.target);
   if(e.type==='play'){const origin=e.player===you?ownHand().querySelector('[data-card="'+e.card+'"]'):$('players').querySelector('[data-player="'+e.player+'"]');if(e.player===you&&origin)origin.style.visibility='hidden';await scene(p+'打出 '+cards[e.card].name,[e.card],cards[e.card].justice?'justice':'card',token,origin);}
   else if(e.type==='draw'){
    window.MFSound?.play('draw');const deck=$('deckZone').querySelector('[data-team="'+(view?.players[e.player]?.team||'pirate')+'"] .deck-top');let dest=e.player===you?ownHand():$('players').querySelector('[data-player="'+e.player+'"]'),landing=null;
    if(e.player===you&&view.players[you].team==='navy'){landing=node('button');landing.dataset.slot='2';landing.className='draw-landing';landing.style.visibility='hidden';landing.disabled=true;ownHand().append(landing);dest=landing;}
    if(deck&&dest){const b=dest.getBoundingClientRect(),img=deck.cloneNode(),pile=deck.closest('.deck'),plane=pile.querySelector('.deck-plane'),r=pile.getBoundingClientRect(),w=plane.offsetWidth,h=plane.offsetHeight,flight=node('div',null,'draw-flight');
     // Preserve the nested plane/face transform: flattening this into one matrix jumps in WebKit.
     flight.style.cssText=`position:fixed;left:${r.x}px;top:${r.y}px;width:${w}px;height:${h}px;transform-origin:0 0;transform-style:preserve-3d`;img.removeAttribute('class');img.style.cssText=`position:absolute;inset:0;width:100%;height:100%;object-fit:contain;transform:${getComputedStyle(deck).transform}`;flight.append(img);$('effectLayer').dataset.kind='draw';$('effectLayer').append(flight);pile.dataset.drawing='true';
     await animate(flight,[{transform:getComputedStyle(plane).transform},{transform:`translate(${b.x+b.width/2-r.x-w*.4}px,${b.y+b.height/2-r.y-h*.4}px) scale(.8)`}],{duration:750,easing:'cubic-bezier(.2,.65,.3,1)'});flight.remove();delete pile.dataset.drawing;
    }landing?.remove();
   }
   else if(e.type==='guess')await scene(p+'猜 '+e.targets.map(name).join('、')+' 的 '+e.digit+' 號牌',[],'miss',token);
   else if(e.type==='battle'){const secret=events[i+1]?.type==='battle-private'?events[++i]:null;const mine=secret?.cards.find(x=>x.player===you);const held=[...ownHand().children].find(b=>b.dataset.card===mine?.card);if(held)held.style.visibility='hidden';const outcome=['defeat','tie'].includes(events[i+1]?.type)?events[++i]:null;const publicCard=view.players[view.turn]?.played.at(-1)||'';await scene(name(e.attacker)+' 對戰 '+name(e.defender),secret?secret.cards.map(x=>x.card):[],'battle',token,null,secret?secret.cards.map(x=>x.player):[e.attacker,e.defender],{values:secret?.values,boost:e.boost||{},outcome,fx:publicCard.startsWith('pirate')?'fire':publicCard.startsWith('justice')?'ice':'quake'});if(outcome?.type==='defeat')await progressBeat(outcome,presentationHP,token);}
   else if(e.type==='defeat'){await scene(p+'的 '+cards[e.card].rank+' 號 '+cards[e.card].name+' 被擊敗',[e.card],'defeat',token);await progressBeat(e,presentationHP,token);}
   else if(e.type==='miss')await scene(p+'沒有 '+e.digit+' 號牌',[],'miss',token);
   else if(e.type==='tie')await scene('平手 · 雙方保留手牌',[],'card',token);
   else if(e.type==='resisted')await scene(p+'未被擊敗',[],'card',token);
   else if(e.type==='shuffle')await scene(e.reason==='defeated-special'?e.cards.map(id=>cards[id].name).join('、')+' 洗回海軍牌堆；其他場上明牌保留':e.team==='navy'?'被擊敗的特殊牌洗回海軍牌堆':'海賊場上明牌洗回牌堆',e.cards||[],'shuffle',token,e.team);
   else if(e.type==='target')await scene(p+'對 '+target+' 使用卡片效果',[],'card',token);
   else if(e.type==='peek')await scene(p+'查看 '+target+' 的一張手牌',[],'card',token);
   else if(e.type==='challenge')await scene(p+'挑戰 '+target,[],'card',token);
   else if(e.type==='decline')await scene(p+'選擇不發起戰鬥',[],'card',token);
   else if(e.type==='order')await scene(p+'完成 '+e.count+' 張牌的排序',[],'card',token);
   else if(e.type==='return')await scene(p+'將 '+e.count+' 張手牌放回海軍牌堆底',[],'card',token);
   else if(e.type==='review')await scene('等待海軍檢視 '+e.count+' 張海賊公開牌',[],'card',token);
   else if(e.type==='empty-deck')await scene(teamName(e.team)+'牌堆已空，繼續本回合',[],'card',token);
   else if(e.type==='morale')await scene(p+'獲得 '+e.amount+' 士氣',[],'morale',token);
   else if(e.type==='morale-use'){/* Render the existing public boost beside the actual battle card after allies cheer. */}
   else if(e.type==='victory'){victory=true;await scene('本場戰果揭曉',e.justice||[],'victory',token,null,[],{state:packet.view});}
  }if(token!==epoch)return;view=packet.view;you=packet.you;lastSequence=packet.sequence;busy=true;render();if(victory)showResult();await request('MF_ACK',{sequence:packet.sequence});
 }
 function reset(){epoch++;document.querySelectorAll('.fortress-impact').forEach(e=>e.remove());if($('executionStage'))delete $('executionStage').dataset.phase;$('players').replaceChildren();$('players').dataset.seats='';$('justice').replaceChildren();$('deckZone').replaceChildren();for(const a of activeAnimations)a.cancel();activeAnimations.clear();$('effectLayer').replaceChildren();queue=Promise.resolve();busy=false;pendingKey='';lastSequence=-1;queuedSequence=-1;}
 socket.on('MF_CLOSED',()=>{reset();room=null;view=null;you=-1;sessionStorage.removeItem('marineford.room');closeSheet();render();notify('本場已結束，回到大廳');});
 socket.on('MF_LOBBY',r=>{room=r;sessionStorage.setItem('marineford.room',r.code);you=r.you;renderLobby();});
 socket.on('MF_STATE',packet=>{reset();view=packet.view;you=packet.you;lastSequence=packet.sequence;render();});
 socket.on('MF_PRESENT',packet=>{if(packet.sequence<=Math.max(lastSequence,queuedSequence))return;queuedSequence=packet.sequence;const token=epoch;queue=queue.then(()=>present(packet,token)).catch(()=>{if(token===epoch){notify('演出已恢復，正在同步牌桌');request('MF_JOIN',{code:room.code});}});});
 socket.on('MF_CAN_ACT',packet=>{if(packet.sequence===lastSequence){busy=false;render();}});
 socket.on('MF_RECOVER',packet=>{reset();view=packet.view;you=packet.you;lastSequence=packet.sequence;closeSheet();render();});
 socket.on('disconnect',()=>{authenticated=false;reset();$('connection').textContent='重新連線中…';closeSheet();});
 socket.on('connect',async()=>{let secret='',deviceId='';try{secret=localStorage.getItem('opSecret')||localStorage.getItem('op_secret')||'';deviceId=localStorage.getItem('op_device_id')||'';}catch{}if(!secret){$('connection').textContent='尚未登入';renderLobby();return;}const result=await request('SOCIAL_AUTH',{secret,deviceId});if(!result.ok)return;me=result.me;authenticated=true;$('connection').textContent='已連線';const saved=sessionStorage.getItem('marineford.room');if(saved){const joined=await request('MF_JOIN',{code:saved});if(!joined.ok){sessionStorage.removeItem('marineford.room');room=null;view=null;}}render();});
 $('sheetClose').onclick=closeSheet;
 function openMatchMenu(){const body=sheet('頂上戰爭篇');body.append(button('返回牌桌',closeSheet),button('我的航海者檔案',profile),button(window.MFSound?.muted?'音效：關閉':'音效：開啟',event=>{const muted=window.MFSound.toggle();event.currentTarget.textContent=muted?'音效：關閉':'音效：開啟';}),button('卡片圖鑑',()=>gallery('卡片圖鑑',Object.keys(cards))),button('遊戲規則',()=>{const b=sheet('遊戲規則');const text=node('div',null,'detail-copy');text.append(node('p','2–6 人，一位海軍對抗海賊團。海軍先行，依順位輪流；每人每輪只進行一回合，抽一張再打一張。連續戰鬥是同一張牌在同一回合內的效果，不會增加回合。海軍保留兩張手牌，海賊保留一張。'),node('p','戰鬥比較手牌數字，敗者公開棄牌、陣營生命減 1，再補抽；平手雙方保留手牌。參戰雙方各自有士氣時，自動消耗 1 個，使這次戰鬥 +2；每場戰鬥最多消耗 1 個。'),node('p','海軍在自己的回合集齊手中與場上全部六張不同正義卡，或登台進度走完六步即獲勝；海賊救援路線走完則救出艾斯並獲勝。戰國元帥不能打出；戰國或正義卡被擊敗，先補牌，再洗回海軍牌堆。'),node('p','海賊牌堆用完，海軍檢視所有海賊公開牌後，將它們洗回牌堆。看牌資訊僅傳給有權查看的人。'),node('p','海軍五號牌抽到幾張就放回幾張；海賊五號牌不足三張時先補牌，再私下排序。海軍被猜中同點數牌只擊敗一張；其餘手牌不公開。場上明牌包含已打出的牌與一般敗牌；正義卡正常打出後保留，被擊敗則只洗回該張牌。'));b.append(text);}),button(view?.phase==='playing'?'繼續對局':'離開房間',view?.phase==='playing'?closeSheet:leave));if(view&&me?.userId===room?.host)body.append(button('結束本場並回大廳',()=>{const b=sheet('結束本場對局？');b.append(node('p','所有玩家會回到大廳，本場不計結果。'),button('確認結束',()=>request('MF_CLOSE')),button('繼續對局',closeSheet));}));};
 $('menuButton').onclick=openMatchMenu;
 fetch('cards.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(list=>{cards=Object.fromEntries(list.map(c=>[c.id,c]));render();}).catch(()=>notify('卡片資料載入失敗，請重新進入遊戲'));
})();
