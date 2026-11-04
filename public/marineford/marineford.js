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
 const targetChoice=()=>!busy&&view?.pending?.owner===you&&view.pending.type!=='guess'&&Array.isArray(view.pending.targets)?view.pending:null;
 const ownHand=()=>view?.players[you]?.team==='navy'?$('navyHands'):$('hand');
 const slotName=i=>i===0?'左邊':i===1?'右邊':'新抽';
 const artBase=window.__PO_MARINEFORD_LOCAL_MEDIA__===true?'poasset://marineford/marineford/art/v2/':'art/v2/';
 const artUrl=file=>artBase+file;
 const cardArt=id=>artUrl((cards[id]?.justice?'refined-':'redraw-')+id+'.webp');
 const cardImage=id=>{const c=cards[id],face=node('div',null,'card-face'),img=node('img');face.dataset.card=id;face.dataset.team=c.team;face.dataset.redraw='true';face.title=c.rank+' · '+c.name+'：'+c.effect;img.onload=()=>{face.dataset.loaded='true';};img.src=cardArt(id);img.alt=c.name;img.width=1024;img.height=1536;img.draggable=false;const rank=node('b',String(c.rank),'card-rank'),title=node('strong',c.name,'card-name'),effect=node('span',c.effect,'card-effect');const caption=node('div',null,'card-caption');caption.append(title,effect);face.append(img,rank,caption);return face;};
 function renderNavyStage(){
  let stage=$('executionStage');if(!stage){stage=node('div',null,'execution-stage');stage.id='executionStage';const scaffold=node('img',null,'execution-scaffold');scaffold.src=artUrl('scaffold-field-pirate.webp');scaffold.alt='艾斯跪在處刑台';const hands=node('div');hands.id='navyHands';hands.setAttribute('aria-label','海軍左右手牌');stage.append(scaffold,hands,$('health'));$('table').prepend(stage);}
  const own=view.players[you]?.team==='navy',hands=$('navyHands'),navy=view.players[view.navyId];stage.dataset.own=String(own);$('hand').hidden=own;
  const scaffold=stage.querySelector('.execution-scaffold'),art=artUrl((own?'scaffold-field-navy':'scaffold-field-pirate')+'.webp');if(scaffold.getAttribute('src')!==art)scaffold.src=art;scaffold.alt=own?'海軍視角：艾斯背面與處刑台':'海賊視角：艾斯正面與處刑台';
  if(own){$('hand').replaceChildren();delete $('hand').dataset.cards;return;}
  const stamp='hidden:'+Math.min(2,navy.hand.length);if(hands.dataset.cards!==stamp){hands.dataset.cards=stamp;hands.replaceChildren();for(let slot=0;slot<Math.min(2,navy.hand.length);slot++){const b=button('',()=>{const p=view?.pending;if(p?.owner===you&&p.slots&&slot<p.slots&&!busy)action({type:'CHOOSE',slot});else notify('海軍'+slotName(slot)+'手牌尚未公開');},'navy-slot');b.dataset.slot=slot;const img=node('img');img.src=artUrl('navy-back.webp');img.alt='未公開的海軍手牌';img.draggable=false;b.append(img,node('span',slotName(slot),'navy-slot-label'));hands.append(b);}}
  for(const b of hands.children){b.style.visibility='';const can=!!(view.pending?.owner===you&&view.pending.slots&&Number(b.dataset.slot)<view.pending.slots&&!busy);b.dataset.selectable=String(can);b.disabled=busy;b.setAttribute('aria-label','海軍'+slotName(Number(b.dataset.slot))+'手牌'+(can?'，點擊選擇':'，未公開'));}
 }

 const avatar=id=>{const p=room?.seats[id]||(id===you?me:null),img=node('img');const a=Number(p?.avatar);img.className='avatar';img.src=p?.cpu?artUrl((view?.players[id]?.team||'pirate')+'-back.webp'):'/images/board/avatars/'+(Number.isSafeInteger(a)&&a>=1&&a<=222?a:8)+'.webp';img.alt='';img.setAttribute('aria-label',p?.name||'玩家');img.draggable=false;return img;};
 let equippedBadge=null;
 function badgeImage(item){
  const img=node('img',null,'campaign-badge');
  img.src=artUrl(item.art);img.alt=item.name;return img;
 }
 function readBadge(shop){
  equippedBadge=shop?.catalog?.find(item=>item.id===shop.equipped)||null;
 }
 async function profile(){
  const body=sheet('馬林福特戰績檔案','campaign-profile'),loading=node('p','讀取戰績中…');
  body.append(loading);
  const result=await request('MF_PROFILE');
  if(!body.contains(loading)||$('sheet').hidden)return;
  if(!result.ok){loading.textContent='戰績暫時無法讀取，請稍後重試。';return;}
  const stats=result.stats;
  readBadge(stats.collection);
  const rate=(wins,games)=>games?Math.round(wins/games*100)+'%':'—';
  const shell=node('div',null,'mf-dossier'),cover=node('aside',null,'mf-dossier-cover');
  const identity=node('div',null,'mf-dossier-identity');
  identity.append(avatar(you),node('small','MARINEFORD / 人物檔案'),node('h3',me?.name||'航海者'),node('p',stats.games?'馬林福特參戰者':'初登馬林福特'));
  cover.append(identity);
  const main=node('div',null,'mf-dossier-main'),nav=node('nav',null,'mf-dossier-nav'),panel=node('section',null,'mf-dossier-panel');
  nav.setAttribute('aria-label','戰役檔案分頁');main.append(nav,panel);shell.append(cover,main);body.replaceChildren(shell);
  const factions=[['navy','海軍'],['pirate','海賊']];
  const honors=[
   ['初登戰場','完成第一場對局',stats.games,1],
   ['正義戰功','以海軍身分取得 3 場勝利',stats.navyWins,3],
   ['救援戰功','以海賊身分取得 3 場勝利',stats.pirateWins,3],
   ['頂上老兵','完成 10 場對局',stats.games,10]
  ];
  function metrics(entries){
   const grid=node('dl',null,'mf-dossier-metrics');
   for(const [label,value] of entries){const cell=node('div');cell.append(node('dt',label),node('dd',String(value)));grid.append(cell);}
   return grid;
  }
  function overview(){
   panel.append(node('h3','戰役總覽'),metrics([['出戰',stats.games],['勝場',stats.wins],['敗場',stats.losses],['勝率',rate(stats.wins,stats.games)]]));
   const grid=node('div',null,'mf-dossier-factions');
   for(const [team,label] of factions){
    const tile=node('article'),games=stats[team+'Games'],wins=stats[team+'Wins'];
    tile.dataset.team=team;
    tile.append(badgeImage({art:team+'-back.webp',name:label}),node('h4',label),node('p',games?'出戰 '+games+' 場 · '+wins+' 勝':'尚未以此陣營出戰'),node('strong',rate(wins,games)));
    grid.append(tile);
   }
   panel.append(grid,node('p','含 CPU 對局 '+(stats.cpuGames??0)+' 場','mf-dossier-note'));
   if(result.pending)panel.append(node('p','本場戰績正在儲存。','mf-dossier-note'));
  }
  function history(){
   panel.append(node('h3','近期戰役'));
   const filters=node('div',null,'mf-dossier-filters'),list=node('ul',null,'campaign-history');
   panel.append(filters,list);
   function filter(team){
    for(const control of filters.children)control.setAttribute('aria-pressed',String(control.dataset.team===team));
    list.replaceChildren();
    for(const match of (stats.recent||[]).filter(item=>!team||item.team===team)){
     const entry=node('li'),won=match.winner===match.team,date=new Date(Number(match.ended_at));
     entry.dataset.won=String(won);
     entry.append(node('strong',won?'勝利':'落敗'),node('span',teamName(match.team)+' · '+(match.has_cpu?'含 CPU':'真人對局')),node('time',date.toLocaleDateString('zh-TW')));
     list.append(entry);
    }
    if(!list.children.length)list.append(node('li',team?'近期沒有此陣營的戰績。':'完成第一場對局後，戰績會出現在這裡。'));
   }
   for(const [team,label] of [['','全部'],...factions]){const control=button(label,()=>filter(team),'small-button');control.dataset.team=team;filters.append(control);}
   filter('');
  }
  function achievements(){
   panel.append(node('h3','榮譽陳列'));
   const medals=node('article');
   if(equippedBadge)medals.append(badgeImage(equippedBadge));
   medals.append(node('p','戰役勳章 '+(stats.collection?.balance??0)));panel.append(medals);
   const grid=node('div',null,'mf-dossier-honors');
   for(const [index,[label,condition,value,goal]] of honors.entries()){
    const tile=node('article'),progress=node('progress'),medal=node('span',null,'mf-dossier-medal');
    medal.dataset.medal=String(index);medal.setAttribute('aria-hidden','true');
    tile.dataset.unlocked=String(value>=goal);progress.max=goal;progress.value=Math.min(goal,value);progress.setAttribute('aria-label',label);
    tile.append(medal,node('h4',label),node('p',condition),progress,node('small',value>=goal?'已達成':value+' / '+goal));
    grid.append(tile);
   }
   panel.append(grid);
  }
  const pages=[['總覽',overview],['戰績',history],['榮譽',achievements]];
  function openPage(index){
   for(const [i,control] of [...nav.children].entries())control.setAttribute('aria-pressed',String(i===index));
   panel.replaceChildren();pages[index][1]();
   if(!reduced()){
    for(const [order,item] of [...panel.children].entries()){
     item.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:230,delay:order*35,easing:'ease-out',fill:'backwards'});
    }
    for(const [order,medal] of [...panel.querySelectorAll('[data-unlocked="true"] .mf-dossier-medal')].entries()){
     medal.animate([{opacity:0,transform:'scale(.72)'},{opacity:1,transform:'scale(1.1)',offset:.7},{opacity:1,transform:'scale(1)'}],{duration:430,delay:100+order*65,easing:'ease-out',fill:'backwards'});
    }
   }
  }
  for(const [i,[label]] of pages.entries())nav.append(button(label,()=>openPage(i),'mf-dossier-tab'));
  openPage(0);

 }

 const notify=text=>{clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4000);};
 function request(event,payload={}) {return new Promise(resolve=>socket.timeout(12000).emit(event,payload,(err,result)=>{if(err){notify('連線逾時，請稍後再試');resolve({ok:false});}else{if(!result?.ok)notify(result?.error||'操作未完成');resolve(result||{ok:false});}}));}
 function closeSheet(){$('sheet').hidden=true; }
 function sheet(title,kind='general'){document.querySelector('.mf-friends')?.remove();document.querySelector('.mf-chat')?.remove();refreshFriends=null;chatRefresh=null;$('sheetClose').textContent=view?'返回牌桌':'關閉';delete $('sheet').dataset.choice;$('sheet').dataset.kind=kind;$('sheetTitle').textContent=title;$('sheetBody').replaceChildren();$('sheet').hidden=false;return $('sheetBody');}
 function detail(id,play=false){const c=cards[id],body=sheet(c.rank+' 號 · '+c.name,'detail'),img=cardImage(id);img.classList.add('detail-card');const text=node('div',null,'detail-copy');text.append(node('small',teamName(c.team)+' · '+(c.justice?'正義卡':'角色卡'),'detail-kicker'),node('h3',c.rank+' 號 · '+c.name),node('p',c.effect));const footer=node('div',null,'detail-actions');if(play){const b=button(c.rank===7?'不能主動打出':'打出這張牌',()=>action({type:'PLAY',card:id}));b.disabled=c.rank===7||busy;footer.append(b);}else footer.append(button('返回牌桌',closeSheet));text.append(footer);body.append(img,text);}
 function publicCardTile(id){const c=cards[id],b=button('',()=>detail(id),'public-card-tile'),label=node('span',null,'public-card-label');label.append(node('b',String(c.rank)),node('strong',c.name));b.append(cardImage(id),label);b.setAttribute('aria-label',c.rank+' 號 · '+c.name+'，查看詳情');return b;}
 function gallery(title,ids,explain=false){const body=sheet(title,'gallery'),grid=node('div',null,'gallery');if(explain)body.append(node('p','這裡是已打出的牌及一般敗牌。正義卡正常打出會保留；被擊敗則先補抽，再只把該張正義卡洗回。','sheet-hint'));if(!ids.length)body.append(node('p','目前沒有公開牌'));for(const id of ids){grid.append(publicCardTile(id));}body.append(grid);}
 async function action(a){if(busy||!view)return;busy=true;closeSheet();render();const result=await request('MF_ACTION',{revision:view.revision,action:a});if(!result.ok){busy=false;render();}}
 function showRules(){const b=sheet('遊戲規則');const text=node('div',null,'detail-copy');text.append(node('p','2–6 人，一位海軍對抗海賊團。海軍先行，依順位輪流；每人每輪只進行一回合，抽一張再打一張。連續戰鬥是同一張牌在同一回合內的效果，不會增加回合。海軍保留兩張手牌，海賊保留一張。'),node('p','戰鬥比較手牌數字，敗者公開棄牌、陣營生命減 1，再補抽；平手雙方保留手牌。參戰雙方各自有士氣時，自動消耗 1 個，使這次戰鬥 +2；每場戰鬥最多消耗 1 個。'),node('p','海軍在自己的回合集齊手中與場上全部六張不同正義卡，或登台進度走完六步即獲勝；海賊救援路線走完則救出艾斯並獲勝。戰國元帥不能打出；戰國或正義卡被擊敗，先補牌，再洗回海軍牌堆。'),node('p','海賊牌堆用完，海軍檢視所有海賊公開牌後，將它們洗回牌堆。看牌資訊僅傳給有權查看的人。'),node('p','海軍五號牌抽到幾張就放回幾張；海賊五號牌不足三張時先補牌，再私下排序。海軍被猜中同點數牌只擊敗一張；其餘手牌不公開。場上明牌包含已打出的牌與一般敗牌；正義卡正常打出後保留，被擊敗則只洗回該張牌。'));b.append(text);}
 function openRoomChoice(){
  const body=sheet('房間模式','room-browser');
  const layout=node('div',null,'room-choice-grid'),host=node('section'),guest=node('section');
  const counts=node('div',null,'room-cpu-options');let cpuCount=0;
  for(let count=0;count<=5;count++){
   const option=button(count+' 人',()=>{cpuCount=count;for(const item of counts.children)item.setAttribute('aria-pressed',String(item===option));},'small-button');
   option.setAttribute('aria-pressed',String(count===0));counts.append(option);
  }
  const create=button('建立房間',async()=>{create.disabled=true;try{const result=await request('MF_CREATE',{cpuCount});if(result.ok)closeSheet();}finally{create.disabled=false;}});
  host.append(node('h3','建立房間'),node('p','CPU 人數'),counts,create,button('查看房間清單',openRoomBrowser));
  const form=node('form',null,'room-code-form'),input=node('input');
  input.placeholder='輸入房間代碼';input.maxLength=7;input.required=true;input.autocomplete='off';input.setAttribute('aria-label','房間代碼');
  const submit=node('button','依代碼加入','choice-button');submit.type='submit';form.append(input,submit);
  form.onsubmit=async event=>{event.preventDefault();const code=input.value.trim();if(!code)return;submit.disabled=true;try{const result=await request('MF_JOIN',{code});if(result.ok)closeSheet();}finally{submit.disabled=false;}};
  guest.append(node('h3','加入好友房間'),form);layout.append(host,guest);
  $('sheetClose').textContent='返回主畫面';body.append(layout);
 }
 async function openRoomBrowser(){
  const body=sheet('加入房間','room-browser');
  const join=async code=>{const result=await request('MF_JOIN',{code});if(result.ok)closeSheet();};
  const list=node('div',null,'room-browser-list'),tools=node('div',null,'room-browser-tools');
  const refresh=async()=>{list.replaceChildren(node('p','讀取房間中…'));const result=await request('MF_LIST');if(!body.contains(list))return;const rooms=result.rooms||[];
   list.replaceChildren();if(!rooms.length)list.append(node('p',result.ok?'目前沒有可加入的房間':'房間清單讀取失敗'));
   for(const entry of rooms){const row=node('div',null,'room-browser-row');row.append(node('strong',entry.code),node('span',entry.seats.length+' / 6 人'),button('加入',()=>join(entry.code),'small-button'));list.append(row);}
  };
  tools.append(node('strong','公開房間'),button('重新整理',refresh,'small-button'));
  body.append(button('返回房間模式',openRoomChoice,'small-button'),tools,list);await refresh();
 }
 let enteredLobby=false;
 function friendRequest(event,data={}){
  const secret=localStorage.getItem('opSecret')||localStorage.getItem('op_secret')||'';
  return request(event,{...data,secret});
 }
 let refreshFriends=null;
 async function openFriends(){
  const existing=document.querySelector('.mf-friends');
  if(existing){existing.remove();refreshFriends=null;return;}
  const body=node('aside',null,'mf-friends');body.setAttribute('aria-label','好友');
  const heading=node('header');heading.append(avatar(you),node('strong',me.name+' · 我的好友'),button('縮小',()=>{body.remove();refreshFriends=null;},'small-button'));
  body.append(heading);document.body.append(body);
  const form=node('form',null,'room-code-form'),input=node('input');
  input.placeholder='輸入玩家名稱';input.setAttribute('aria-label','玩家名稱');input.required=true;
  const submit=node('button','送出好友邀請','small-button');submit.type='submit';form.append(input,submit);
  const list=node('div',null,'room-browser-list');body.append(form,button('重新整理',()=>refresh(),'small-button'),list);
  async function refresh(){
   const result=await friendRequest('FRIENDS_GET');
   if(!body.isConnected)return;
   list.replaceChildren();
   if(!result.ok){list.append(node('p','好友清單讀取失敗'));return;}
   list.append(node('small','好友邀請','mf-friends-label'));
   for(const f of result.requestsIn||[]){const row=node('div',null,'room-browser-row');row.append(node('strong',f.name),button('接受',async()=>{await friendRequest('FRIEND_REQUEST_ACCEPT',{userId:f.userId});refresh();},'small-button'),button('拒絕',async()=>{await friendRequest('FRIEND_REQUEST_DECLINE',{userId:f.userId});refresh();},'small-button'));list.append(row);}
   list.append(node('small','好友清單','mf-friends-label'));
   for(const f of [...(result.friends||[])].sort((a,b)=>Number(b.online)-Number(a.online))){const row=node('div',null,'room-browser-row');row.append(node('strong',f.name),node('span',f.online?'在線':'離線'),button('聊天',()=>openFriendChat(f),'small-button'));if(room&&!view&&f.online)row.append(button('邀請入房',async event=>{const b=event.currentTarget;b.disabled=true;const result=await friendRequest('LOBBY_INVITE_SEND',{mode:'marineford',roomId:room.code,toUserId:f.userId});if(result.ok)notify('已送出房間邀請');else b.disabled=false;},'small-button'));list.append(row);}
   for(const f of result.requestsOut||[])list.append(node('p',f.name+' · 等待確認'));
   if(list.children.length===2)list.append(node('p','目前沒有好友或邀請'));
  }
  form.onsubmit=async event=>{event.preventDefault();const name=input.value.trim();if(!name)return;const result=await friendRequest('FRIEND_ADD_BY_NAME',{name});if(result.ok){input.value='';refresh();}};
  refreshFriends=refresh;await refresh();
 }
 let chatRefresh=null;
 function openChat(title,sendMessage,inline=false){
  if(!inline){document.querySelector('.mf-chat')?.remove();chatRefresh=null;}
  const panel=node('aside',null,inline?'mf-room-chat':'mf-chat'),header=node('header'),list=node('div',null,'mf-chat-log'),form=node('form',null,'room-code-form'),input=node('input');
  panel.setAttribute('aria-label',title);list.setAttribute('role','log');header.append(node('strong',title));if(!inline)header.append(button('關閉',()=>{panel.remove();chatRefresh=null;},'small-button'));
  input.required=true;input.maxLength=inline?500:400;input.placeholder='輸入訊息';input.setAttribute('aria-label','聊天訊息');
  const send=node('button','傳送','small-button');send.type='submit';form.append(input,send);
  form.onsubmit=async event=>{event.preventDefault();const message=input.value.trim();if(!message||send.disabled)return;send.disabled=true;try{if((await sendMessage(message)).ok)input.value='';}finally{send.disabled=false;}};
  panel.append(header,list,form);if(!inline)document.body.append(panel);return {panel,list};
 }
 async function openFriendChat(friend){
  const {panel,list}=openChat(friend.name+' · 私訊',async message=>{const result=await friendRequest('DM_SEND',{toUserId:friend.userId,body:message});if(result.ok)await refresh();return result;});
  const refresh=async()=>{const result=await friendRequest('DM_HISTORY',{withUserId:friend.userId,limit:30});if(panel.isConnected&&result.ok){list.replaceChildren(...(result.messages||[]).map(m=>node('p',(Number(m.from)===Number(me.userId)?'我':friend.name)+'：'+m.body)));list.scrollTop=list.scrollHeight;}};
  chatRefresh=refresh;await refresh();
 }
 const roomMessages=new Map();
 let roomChat=null;
 function openRoomChat(){
  const code=room?.code;if(!code||view)return;
  if(roomChat?.code!==code){const {panel,list}=openChat('等待室聊天',body=>request('MF_CHAT',{body}),true);roomChat={code,panel,list};}
  return roomChat.panel;
 }
 function renderRoomChat(){if(!roomChat?.panel.isConnected)return;const {code,list}=roomChat;list.replaceChildren(...(roomMessages.get(code)||[]).map(m=>node('p',m.name+'：'+m.body)));list.scrollTop=list.scrollHeight;}
 socket.on('MF_CHAT',m=>{if(m.code!==room?.code)return;roomMessages.set(m.code,[...(roomMessages.get(m.code)||[]),m].slice(-40));renderRoomChat();});
 for(const event of ['FRIENDS_DIRTY','DM_NEW'])socket.on(event,()=>{if(event==='DM_NEW')chatRefresh?.();else refreshFriends?.();});
 socket.on('EMIT',payload=>{
  if(payload?.type==='toast'&&payload.text){notify(payload.text);return;}
  const inv=payload?.invite;if(payload?.type!=='marineford_lobby_invite'||!inv||view)return;
  document.querySelector('.mf-invite')?.remove();const panel=node('aside',null,'mf-invite');panel.append(node('strong',inv.fromName+' 邀請你加入馬林福特之戰'),node('p','房間 '+inv.roomId));
  for(const [label,action] of [['加入','accept'],['拒絕','reject']])panel.append(button(label,async()=>{panel.remove();if(action==='accept'&&(room||view)){notify('請先離開目前房間');return;}const result=await friendRequest('LOBBY_INVITE_RESPOND',{inviteId:inv.inviteId,action});if(result.ok&&action==='accept'){enteredLobby=true;await request('MF_JOIN',{code:result.roomId});}},'small-button'));
  document.body.append(panel);setTimeout(()=>panel.remove(),Math.max(0,inv.expiresAt-Date.now()));
 });
 function renderLobby(){if(view)return;$('menuButton').hidden=!enteredLobby&&!room;document.body.dataset.screen='lobby';$('justice').hidden=true;$('health').replaceChildren();$('lobby').hidden=false;$('table').hidden=true;const body=$('lobbyBody');body.replaceChildren();$('lobby').dataset.waiting=String(!!room);$('lobby').dataset.splash=String(authenticated&&!room&&!enteredLobby);$('lobby').dataset.mode=!room&&enteredLobby&&authenticated?'main':'entry';if(!authenticated){body.append(node('p','請從啟動器登入帳號後進入馬林福特之戰。'));return;}
  if(!room&&!enteredLobby){const enter=button('',()=>{enteredLobby=true;renderLobby();},'mf-splash');enter.setAttribute('aria-label','點擊進入');enter.append(node('span','MARINEFORD','mf-splash-kicker'),node('strong','馬林福特之戰','mf-splash-title'),node('span','點擊進入','mf-splash-prompt'));body.append(enter);return;}
  if(!room){const identity=node('div',null,'lobby-identity');identity.append(avatar(you),node('strong',me.name),node('span','已登入'));body.append(identity);
   const row=node('div',null,'lobby-entry lobby-menu');
   row.append(button('開始遊戲',openRoomChoice),button('個人頁面',profile),button('遊戲規則',showRules));
   body.append(row);
   const links=node('div',null,'lobby-links');
   links.append(button('好友',openFriends,'small-button'),button('卡片圖鑑',()=>gallery('馬林福特之戰 · 卡片圖鑑',Object.keys(cards)),'small-button'));
   body.append(links);return;}
  const waiting=node('section',null,'mf-waiting');
  const header=node('header'),title=node('div'),controls=node('div',null,'lobby-actions');
  title.append(node('small','馬林福特之戰 · 等待室'),node('h2',room.code,'room-code'));
  controls.append(button('複製房號',async()=>{try{await navigator.clipboard.writeText(room.code);notify('房號已複製');}catch{notify('房號 '+room.code);}},'small-button'),button('好友邀請',openFriends,'small-button'),button('離開房間',leave,'small-button'));
  header.append(title,controls);waiting.append(header);
  const host=Number(me.userId)===Number(room.host),people=room.seats.filter(p=>!p.cpu),cpus=room.seats.filter(p=>p.cpu);
  for(const [label,group] of [['真人玩家',people],['CPU',cpus]]){
   const section=node('section'),grid=node('div',null,'mf-waiting-grid');
   section.append(node('h3',label+' · '+group.length),grid);
   for(const p of group){
    const row=node('article',null,'mf-waiting-seat'),details=node('div');
    const own=p.id===you,isNavy=p.id===room.navyId;
    details.append(node('strong',p.name+(own?' · 我':'')),node('small',(p.host?'房主 · ':'')+(isNavy?'海軍':'海賊')+' · '+(p.ready?'已準備':'未準備')));
    const portrait=avatar(p.id);
    if(!own&&!p.cpu){
     const contact=button('',()=>{
      const menu=sheet(p.name+' · 玩家操作','room-browser');
      menu.append(button('加好友',async()=>{const result=await friendRequest('FRIEND_ADD_BY_NAME',{name:p.name});if(result.ok){notify('已送出好友邀請');closeSheet();}},'small-button'));
      if(host&&p.kickToken)menu.append(button('移出等待室',async()=>{const result=await request('MF_KICK',{slot:p.id,kickToken:p.kickToken});if(result.ok)closeSheet();},'small-button'));
     },'mf-waiting-avatar');
     contact.setAttribute('aria-label',p.name+'的玩家操作');contact.append(portrait);row.append(contact);
    }else row.append(portrait);
    row.append(details);
    if(host&&!isNavy)row.append(button('設為海軍',()=>request('MF_CONFIG',{navyId:p.id}),'small-button'));
    if(own&&!host)row.append(button(p.ready?'取消準備':'準備',()=>request('MF_READY',{ready:!p.ready}),'small-button'));
    grid.append(row);
   }
   if(label==='CPU'&&host){
    const cpuControls=node('div',null,'lobby-actions');
    const add=button('加入 CPU',()=>request('MF_CONFIG',{addCpu:true}),'small-button');
    const remove=button('移除 CPU',()=>request('MF_CONFIG',{removeCpu:true}),'small-button');
    add.disabled=room.seats.length>=6;remove.disabled=!cpus.length;cpuControls.append(add,remove);section.append(cpuControls);
   }
   waiting.append(section);
  }
  if(host){
   const start=button('開始對局',()=>request('MF_START'));
   start.disabled=room.seats.length<2||room.seats.some(p=>!p.ready);
   waiting.append(start);
  }
  waiting.append(openRoomChat());body.append(waiting);renderRoomChat();

 }
 async function leave(){const r=await request('MF_LEAVE');if(r.ok){reset();roomChat?.panel.remove();roomMessages.clear();room=null;view=null;you=-1;sessionStorage.removeItem('marineford.room');closeSheet();render();}}
 function updateText(el,text){if(el.textContent!==text)el.textContent=text;}
 const publicPlays=player=>player.played.filter(id=>!cards[id]?.justice);
 function renderPlayers(actor){
  const root=$('players'),ownTeam=view.players[you]?.team,key=you+':'+view.players.map(p=>p.id+':'+p.team).join('|');
  $('table').dataset.perspective=ownTeam;const allies=view.players.filter(p=>p.team===ownTeam);$('table').style.setProperty('--self-position',((allies.findIndex(p=>p.id===you)+.5)/allies.length*90+5)+'%');
  if(root.dataset.seats!==key){root.dataset.seats=key;root.replaceChildren();for(const side of ['enemy','ally']){
   const row=node('div',null,'fleet-row');row.dataset.side=side;const members=view.players.filter(p=>(p.team===ownTeam)===(side==='ally'));row.style.setProperty('--count',members.length);row.setAttribute('aria-label',side==='ally'?teamName(ownTeam)+'陣線':teamName(ownTeam==='navy'?'pirate':'navy')+'陣線');root.append(row);
   for(const p of members){const seat=node('div',null,'seat');seat.dataset.player=p.id;seat.dataset.side=side;const info=node('div',null,'seat-info'),title=node('strong'),meta=node('small',null,'seat-meta'),morale=node('small',null,'morale');info.append(title,meta,morale);const publicButton=button('',()=>{const now=view.players[p.id];gallery(now.name+'的場上明牌',publicPlays(now),true);},'public-cards');const portrait=button('',()=>{const now=view.players[p.id],body=sheet(now.name+' · '+teamName(now.team),'player');body.append(avatar(p.id),node('h3',now.name),node('p','順位 '+(p.id+1)+' · 手牌 '+now.hand.length+' 張 · 士氣 '+now.morale));const grid=node('div',null,'gallery');for(const id of publicPlays(now)){grid.append(publicCardTile(id));}body.append(node('p','場上明牌 '+publicPlays(now).length+' 張','sheet-hint'),grid);if(p.id===you)body.append(button('對局功能',()=>openMatchMenu()));body.append(button('返回牌桌',closeSheet));},'portrait-button');portrait.setAttribute('aria-label',p.name+'的玩家資訊與公開牌');portrait.append(avatar(p.id));seat.append(portrait,node('span',String(p.id+1).padStart(2,'0'),'seat-number'),info,publicButton);row.append(seat);}
  }}
  for(const p of view.players){const seat=root.querySelector('[data-player="'+p.id+'"]');seat.dataset.current=String(p.id===actor&&view.phase==='playing');seat.dataset.self=String(p.id===you);seat.dataset.team=p.team;const info=seat.querySelector('.seat-info');updateText(info.querySelector('strong'),p.name+(p.id===you?' · 我':''));info.querySelector('strong').title=p.name;updateText(info.querySelector('.seat-meta'),teamName(p.team)+' '+p.hand.length+' 張');updateText(info.querySelector('.morale'),'士氣'+p.morale);const b=seat.querySelector('.public-cards');const played=publicPlays(p);const stamp=played.join('|');if(b.dataset.cards!==stamp){b.dataset.cards=stamp;b.replaceChildren();const strip=node('span',null,'public-thumbs');for(const id of played.slice(-4)){const img=node('img');img.src=cardArt(id);img.alt=cards[id].rank+' · '+cards[id].name;const thumb=node('span',null,'public-thumb');thumb.dataset.card=id;thumb.append(img,node('b',String(cards[id].rank)));strip.append(thumb);}b.append(strip);}b.hidden=!played.length;b.setAttribute('aria-label',p.name+'的場上明牌 '+played.length+' 張，點擊查看全部');b.disabled=busy;}
 }
 function renderTargets(){const pending=targetChoice();$('table').style.setProperty('--ally-height',($('players').querySelector('[data-side="ally"]')?.getBoundingClientRect().height||55)+'px');$('table').dataset.targeting=String(!!pending);for(const seat of $('players').querySelectorAll('.seat')){const allowed=!!pending?.targets.includes(Number(seat.dataset.player));seat.dataset.targetable=String(allowed);seat.querySelector('.target-prompt')?.remove();const portrait=seat.querySelector('.portrait-button');portrait.disabled=!!pending&&!allowed;if(allowed){portrait.setAttribute('aria-label','選擇 '+name(Number(seat.dataset.player)));}}}
 $('players').addEventListener('click',event=>{const pending=targetChoice(),seat=event.target.closest('.seat');if(!pending||!seat)return;event.preventDefault();event.stopImmediatePropagation();const target=Number(seat.dataset.player);if(pending.targets.includes(target))action({type:'CHOOSE',target});},true);
 // hp keys remain the damage recipient. Display only maps them to the opposing team's advance.
 function progressDetail(team){
  const max=team==='navy'?(view.players.length<=3?4:view.players.length+1):6,rescue=team==='navy',body=sheet(rescue?'海賊救援路線':'海軍登台進度'),text=node('div',null,'detail-copy');
  text.append(node('h3',(rescue?'救援':'登台')+' '+(max-view.hp[team])+' / '+max),node('p',rescue?'海軍每被擊敗一張手牌，海賊救援隊前進一步。走完救援路線，登上處刑台救出艾斯，海賊獲勝。':'海賊每被擊敗一張手牌，海軍向處刑台前進一步。走完六步，執行處刑，海軍獲勝。進度只隨卡牌結算推進，不會隨現實時間自動增加。'),node('p','海軍也能在自己的回合完成效果後，以手中與場上集齊六種正義獲勝。未公開的正義手牌不會顯示給其他玩家。'),button('返回牌桌',closeSheet));body.append(text);
 }
 function factionEmblem(damagedTeam){const img=node('img',null,'faction-emblem');img.src=artUrl('emblem-'+(damagedTeam==='navy'?'whitebeard':'marine')+'-source.webp');img.alt=damagedTeam==='navy'?'白鬍子海賊團':'海軍';return img;}
 function renderProgress(hp=view.hp){
  $('justice').hidden=false;const health=$('health'),navyMax=view.players.length<=3?4:view.players.length+1;
  if(health.dataset.limit!==String(navyMax)||!health.querySelector('.advance-route')){
   health.dataset.limit=String(navyMax);health.replaceChildren();health.setAttribute('aria-label','通往艾斯的共同登台路線');
   const route=node('div',null,'advance-route');route.setAttribute('aria-hidden','true');for(let i=0;i<8;i++)route.append(node('i'));health.append(route,node('span','艾斯','route-goal'));
   for(const team of ['navy','pirate']){const h=button('',()=>progressDetail(team),'health-box');h.dataset.team=team;h.append(factionEmblem(team),node('span',team==='navy'?'救援':'登台'),node('strong'));const marker=node('span',null,'route-marker');marker.dataset.team=team;marker.append(factionEmblem(team));route.append(marker);health.append(h);}
  }
  for(const team of ['navy','pirate']){const h=health.querySelector('.health-box[data-team="'+team+'"]'),max=team==='navy'?navyMax:6,spent=max-hp[team],marker=health.querySelector('.route-marker[data-team="'+team+'"]');updateText(h.querySelector('strong'),spent+'/'+max);h.setAttribute('aria-label',(team==='navy'?'海賊救援':'海軍登台')+' '+spent+' / '+max+'，點擊查看規則');marker.style.setProperty('--advance',String((team==='navy'?7-hp[team]:6-hp[team])/(team==='navy'?7:6)));marker.dataset.step=String(spent);h.disabled=busy;}
 }
 // Map both deck surfaces onto the same camera/floor, rather than tilting each pile independently.
 function placeGroundDecks(){
  const table=$('table'),background=table.querySelector('.execution-scaffold');
  if(!view||table.hidden||!background)return;
  const width=table.clientWidth,height=table.clientHeight;
  if(!width||!height)return;
  const navy=view.players[you]?.team==='navy';
  const artHeight=Math.max(height,width*941/1672);
  const overflow=artHeight-height;
  const ally=$('players').querySelector('[data-side="ally"]')?.getBoundingClientRect();
  const bottomLimit=navy?height-20:Math.min(height-22,(ally?.top??height)-table.getBoundingClientRect().top-19);
  // These are the start of the clear ice in each illustration, below the steps.
  const groundRatio=navy?.785:.66;
  const camera=overflow?Math.max(.4,Math.min(1,(artHeight*groundRatio-bottomLimit+42)/overflow)):.4;
  background.style.objectPosition='50% '+camera*100+'%';
  const floor=artHeight*groundRatio-overflow*camera;
  const front=Math.min(bottomLimit,artHeight*.91-overflow*camera);
  const available=Math.max(12,front-floor);
  const tilt=Math.max(.27,Math.min(.41,available/(Math.max(32,width*.065)*1.65)));
  const cardWidth=Math.max(25,Math.min(106,width*.072,height*.16,available/(tilt*1.55+.13)));
  const cardHeight=cardWidth*1.5;
  const depth=Math.sqrt(1-tilt*tilt);
  for(const pile of $('deckZone').children){
   const leftSide=pile.dataset.team==='navy';
   const angle=leftSide?-.085:.085;
   const c=Math.cos(angle),sin=Math.sin(angle);
   const points=[[0,0],[cardWidth,0],[cardWidth,cardHeight],[0,cardHeight]]
    .map(([x,y])=>[c*x-sin*tilt*y,sin*x+c*tilt*y]);
   const xs=points.map(point=>point[0]),ys=points.map(point=>point[1]);
   const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
   let center=width*(leftSide?.20:.80);
   if(navy&&!leftSide&&ally){
    const allyLeft=ally.left-table.getBoundingClientRect().left;
    center=Math.max(width*.32,Math.min(center,allyLeft-(maxX-minX)/2-14));
   }
   const originX=center-(minX+maxX)/2,originY=front-maxY;
   const left=originX+minX-7,top=originY+minY-8;
   const plane=pile.querySelector('.deck-plane'),contact=pile.querySelector('.deck-contact i');
   const matrix=[c,sin,0,0,-sin*tilt,c*tilt,depth,0,sin*depth,-c*depth,tilt,0,originX-left,originY-top,0,1];
   Object.assign(pile.style,{left:left+'px',top:top+'px',width:(maxX-minX+14)+'px',height:(front-top+16)+'px'});
   for(const part of [plane,contact]){
    Object.assign(part.style,{width:cardWidth+'px',height:cardHeight+'px',transform:'matrix3d('+matrix.join(',')+')'});
   }
   pile.dataset.floor=JSON.stringify({floor,front,back:originY+minY,corners:points.map(([x,y])=>[x+originX,y+originY])});
  }
 }
 window.addEventListener('resize',placeGroundDecks);
 function render(){if(!Object.keys(cards).length)return;if(!view){renderLobby();return;}$('menuButton').hidden=false;document.body.dataset.screen='table';$('lobby').hidden=true;$('table').hidden=false;renderProgress();
  const actor=view.pending?.owner??view.turn;renderPlayers(actor);renderTargets();renderNavyStage();
  if(!$('justice').children.length){for(let i=1;i<=6;i++){const id='justice-'+i,b=button(String(i),()=>detail(id),'justice-slot');b.dataset.card=id;b.setAttribute('aria-label','正義 '+i);$('justice').append(b);}}for(const b of $('justice').children){const collected=String(view.players[view.navyId].played.includes(b.dataset.card));if(b.dataset.collected!==collected){b.dataset.collected=collected;b.replaceChildren(collected==='true'?cardImage(b.dataset.card):document.createTextNode(b.dataset.card.split('-')[1]));}b.disabled=busy;}
  if(!$('deckZone').children.length){for(const team of ['navy','pirate']){
   const b=button('',()=>{if(canDraw()&&view.players[you].team===team)action({type:'DRAW'});else gallery(teamName(team)+'場上明牌',view.players.filter(p=>p.team===team).flatMap(publicPlays),true);},'deck');b.dataset.team=team;
   const plane=node('span',null,'deck-plane');for(let i=0;i<7;i++){const img=node('img',null,i===6?'deck-top':'deck-layer');img.src=artUrl(team+'-back.webp');img.alt=i===6?teamName(team)+'牌堆':'';if(i!==6)img.setAttribute('aria-hidden','true');img.draggable=false;img.dataset.layer=String(i);plane.append(img);}const contact=node('span',null,'deck-contact');contact.setAttribute('aria-hidden','true');contact.append(node('i'));b.append(contact,plane,node('b'));$('deckZone').append(b);
  }}
  for(const b of $('deckZone').children){const team=b.dataset.team,count=view.deckCounts[team],layers=Math.min(6,Math.max(0,count-1));b.dataset.active=String(canDraw()&&view.players[you].team===team);b.dataset.empty=String(count===0);b.disabled=busy;b.dataset.count=String(count);
   for(const img of b.querySelectorAll('img')){const i=Number(img.dataset.layer),top=img.classList.contains('deck-top');img.hidden=!top&&i>=layers;img.style.setProperty('--layer-z',(top?layers:i)*1.0+'px');}updateText(b.querySelector('b'),teamName(team)+'牌堆 · '+count);b.setAttribute('aria-label',teamName(team)+'牌堆，剩 '+count+' 張'+(b.dataset.active==='true'?'，點擊抽牌':'，點擊查看公開牌'));
  }
  placeGroundDecks();
  const hand=ownHand(),ids=(view.players[you]?.hand||[]).filter(Boolean),handKey=ids.join('|');if(hand.dataset.cards!==handKey){hand.dataset.cards=handKey;hand.replaceChildren();for(const [slot,id] of ids.entries()){const b=button('',()=>detail(id,!view.pending&&view.turn===you&&view.step==='play'&&!busy),'hand-card');b.dataset.card=id;b.dataset.slot=slot;b.append(cardImage(id));if(view.players[you].team==='navy')b.append(node('span',slotName(slot),'navy-slot-label'));hand.append(b);}}
  for(const held of hand.children){held.style.visibility='';held.disabled=busy;delete held.dataset.peeked;held.querySelector('.peek-owner-tag')?.remove();}
  if(view.pending?.type==='read'&&view.pending.target===you&&Number.isInteger(view.pending.slot)){const held=hand.querySelector('[data-slot="'+view.pending.slot+'"]');if(held){held.dataset.peeked='true';held.append(node('span',name(view.pending.owner)+'正在查看 · '+slotName(view.pending.slot),'peek-owner-tag'));}}
  for(const b of $('navyHands').children){delete b.dataset.peeked;b.querySelector('.peek-owner-tag')?.remove();}
  if(view.pending?.type==='read'&&Number.isInteger(view.pending.slot)){const b=$('navyHands').querySelector('[data-slot="'+view.pending.slot+'"]');if(b){b.dataset.peeked='true';b.append(node('span',name(view.pending.owner)+'正在查看','peek-owner-tag'));}}
  $('players').querySelector('.peek-parked')?.remove();
  if(view.pending?.type==='read'&&Number.isInteger(view.pending.slot)){
   const seat=$('players').querySelector('[data-player="'+view.pending.owner+'"]');
   const back=node('img',null,'peek-parked');back.src=artUrl('navy-back.webp');back.alt='正在查看的海軍手牌';seat?.append(back);
  }
  hand.dataset.picking=String(view.players[you]?.team==='pirate'&&ids.length===2&&!busy&&!view.pending&&view.turn===you&&view.step==='play');
  hand.dataset.playable=String(!busy&&!view.pending&&view.turn===you&&view.step==='play');
  $('turnLabel').textContent=view.phase==='ended'?teamName(view.winner)+'獲勝':busy?'演出中':actor===you?'輪到你了':name(actor)+'的行動';
  $('status').textContent=view.phase==='ended'?'本場對局結束':busy?'等所有玩家看完後繼續':actor!==you?'':view.pending?.slots?'點選要查看的海軍手牌':view.pending?pendingDescription(view.pending):view.step==='draw'?'點發光牌堆抽牌':'點手牌查看與打出';
  const arranging=!busy&&view.pending?.type==='arrange'&&view.pending.owner===you;$('table').dataset.arranging=String(arranging);document.querySelectorAll('.navy-arrange-tag').forEach(e=>e.remove());if(arranging)for(const held of hand.children){const c=cards[held.dataset.card];if(c)held.append(node('span','階級 '+c.rank+' · '+c.name,'navy-arrange-tag'));}const actions=$('actions');actions.replaceChildren();if(view.phase==='ended'){actions.append(button('查看戰果',()=>showResult()),button('返回大廳',leave));return;}if(busy)return;if(arranging){actions.append(node('p','是否交換左右手牌？','arrange-question'),button('維持原位',()=>action({type:'CHOOSE',cards:view.pending.cards.slice()})));if(view.pending.cards.length>1)actions.append(button('交換左右',()=>action({type:'CHOOSE',cards:view.pending.cards.slice().reverse()})));}else if(targetChoice()){actions.append(node('p',pendingDescription(view.pending)+' · 點發光頭像','target-action-hint'));if(view.pending.type==='fight-target')actions.append(button('放棄這次戰鬥',()=>action({type:'CHOOSE',skip:true})));}else if(view.pending?.owner===you&&!view.pending.slots)actions.append(button('進行選擇',showPending));
  const key=view.pending?view.revision+':'+view.pending.type:'';if(view.pending?.owner===you&&key!==pendingKey){pendingKey=key;showPending();}if(!view.pending)pendingKey='';
 }
 const canDraw=()=>!busy&&view?.phase==='playing'&&!view.pending&&view.turn===you&&view.step==='draw';
 const descriptions={'target-guess':'選擇要猜牌的對手',guess:'猜測對手手牌的數字',threshold:'選擇要攻擊的海賊','peek-reader':'選擇查看海軍手牌的隊友','peek-slot':'選一張海軍手牌查看',read:'看完後確認繼續','morale-target':'選擇獲得士氣的隊友',order:'從左到右，安排牌堆最上方的順序',return:'依序選擇放回牌堆底的手牌',copy:'選擇要複製的公開牌','fight-ally':'選擇出戰的海賊','fight-target':'選擇對手，或放棄戰鬥','battle-card':'選擇海軍出戰的手牌',arrange:'調整海軍手牌順序，再讓海賊盲選','battle-slot':'選一張海軍手牌交戰','defeat-choice':'確認被擊敗的手牌；同點數時只選一張',review:'海軍檢視海賊公開牌；確認後補充牌堆，再繼續效果'};
 function pendingDescription(p){return descriptions[p.type]||'完成選擇';}
 function showPending(){const p=view?.pending;if(!p||p.owner!==you||busy)return;if(p.type==='arrange'){closeSheet();return;}if(targetChoice()){closeSheet();$('status').textContent=pendingDescription(p)+' · 點選發光的玩家頭像區';return;}if(p.slots){closeSheet();$('status').textContent='點選艾斯左邊或右邊的海軍手牌';renderNavyStage();return;}const body=sheet(pendingDescription(p),'choice');$('sheet').dataset.choice=p.type;selected=[];const choose=data=>action({type:'CHOOSE',...data});
  if(p.targets&&p.type!=='guess'){const grid=node('div',null,'target-grid');for(const id of p.targets){const player=view.players[id],b=button('',()=>choose({target:id}),'target-choice');b.setAttribute('aria-label',name(id));const copy=node('span',null,'target-copy');copy.append(node('strong',name(id)),node('small',teamName(player.team)+' · 手牌 '+player.hand.length+' · 士氣 '+player.morale));b.append(avatar(id),copy);grid.append(b);}body.append(node('p','點選要使用效果的玩家','sheet-hint'),grid);if(p.type==='fight-target')body.append(button('放棄這次戰鬥',()=>choose({skip:true})));}
  if(p.digits){const hero=node('div',null,'guess-subject');for(const target of p.targets){const badge=node('div');badge.append(avatar(target),node('strong',name(target)));hero.append(badge);}body.append(hero,node('p','選擇手牌號碼','guess-instruction'));const digits=node('div',null,'digits');digits.style.setProperty('--digit-count',Math.min(7,p.digits.length));for(const digit of p.digits){const b=button('',()=>choose({digit}),'guess-number');b.append(node('strong',String(digit)),node('span','號'));b.setAttribute('aria-label','猜 '+digit+' 號');digits.append(b);}body.append(digits,node('p','點選號碼後發動，結果於雷射演出後揭曉','sheet-hint'));}
  if(p.slots){for(let slot=0;slot<p.slots;slot++){const b=button('',()=>choose({slot}),'pick-card'),img=node('img');img.src=artUrl('navy-back.webp');img.alt='未知的海軍手牌';b.append(img,node('span',slotName(slot)+'手牌'));body.append(b);}}
  if(p.cards){const row=node('div',null,'pick-row'),multi=['return','order'].includes(p.type),read=['read','review'].includes(p.type),readable=!!p.cards;body.append(row);let confirm;if(readable)row.dataset.readable='true';
   const refresh=()=>{for(const b of row.children){const index=selected.indexOf(b.dataset.card);b.classList.toggle('selected',index>=0);b.setAttribute('aria-pressed',String(index>=0));b.querySelector('.pick-label').textContent=index>=0?'第 '+(index+1)+' 張':readable?(p.type==='battle-card'?'點選這張出戰':'點選這張牌'):cards[b.dataset.card].name;}if(confirm)confirm.disabled=selected.length!==(p.type==='return'?p.count:p.cards.length);};
   for(const id of p.cards){const b=button('',()=>{if(read){b.classList.toggle('expanded');return;}if(multi){const index=selected.indexOf(id);if(index>=0)selected.splice(index,1);else if(p.type!=='return'||selected.length<p.count)selected.push(id);refresh();}else choose({card:id});},'pick-card');b.dataset.card=id;const label=node('span',cards[id].name,'pick-label');b.append(cardImage(id));if(readable){b.classList.add('pick-readable');const c=cards[id],info=node('span',null,'pick-info');info.append(node('b','階級 '+c.rank,'pick-rank'),node('strong',c.name,'pick-name'),node('span',c.effect,'pick-effect'),label);b.append(info);b.setAttribute('aria-label','階級 '+c.rank+' · '+c.name+'：'+c.effect);}else b.append(label);row.append(b);}
   if(multi){const footer=node('div',null,'sheet-actions');footer.append(node('p',p.type==='return'?'選 '+p.count+' 張，依序放入牌堆底':'依序點牌；第一張是最左／牌堆最上方','sheet-hint'));confirm=button('確認順序',()=>choose({cards:selected.slice()}));footer.append(confirm);body.append(footer);}refresh();
   if(read){const footer=node('div',null,'sheet-actions');footer.append(node('p',p.type==='read'?'只有你能查看牌面；海軍會看到哪張牌正在被查看。':'看完後，公開牌才會洗回海賊牌堆。','sheet-hint'),button('我看完了 · 繼續',()=>choose({done:true})));body.append(footer);}
  }
 }
 function animate(element,frames,options){const a=element.animate(frames,options);activeAnimations.add(a);return a.finished.catch(()=>{}).finally(()=>activeAnimations.delete(a));}
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 async function beat(ms,token){if(token!==epoch)return;const marker=node('i');$('effectLayer').append(marker);await animate(marker,[{opacity:0},{opacity:0}],{duration:ms});marker.remove();}
 async function burst(kind,token){if(token!==epoch)return;const fx=node('img',null,'effect-burst');fx.src=artUrl('fx-'+kind+'.webp');fx.alt='';$('effectLayer').append(fx);window.MFSound?.play(kind);await animate(fx,[{transform:'scale(.15) rotate(-12deg)',opacity:0},{transform:'scale(.85)',opacity:1,offset:.35},{transform:'scale(1.1) rotate(6deg)',opacity:0}],{duration:reduced()?180:850,easing:'ease-out'});fx.remove();}
 const readingTime=(text,minimum=1600)=>Math.max(minimum,Math.min(3200,600+Array.from(text).length*75));
 function resultText(state=view){return state.winner==='pirate'?{title:'艾斯獲救',reason:'海賊登上處刑台，成功救出艾斯。'}:state.hp.pirate===0?{title:'處刑執行',reason:'海軍登上處刑台，執行處刑。'}:{title:'正義集結',reason:'六種正義集齊，海軍獲勝。'};}
 function showResult(){
  if(view?.phase!=='ended')return;
  const match=view,team=match.players[you].team,won=team===match.winner;
  const result=resultText(match),body=sheet('馬林福特之戰 · 戰役結算','campaign-result');
  const banner=node('div',null,'campaign-banner'),verdict=node('div');
  banner.dataset.team=match.winner;
  verdict.append(node('small',teamName(team)+'視角 · '+(won?'勝利':'落敗')),node('h3',result.title),node('p',result.reason));
  banner.append(badgeImage({art:match.winner+'-back.webp',name:teamName(match.winner)}),verdict);body.append(banner);
  const sides=node('div',null,'campaign-sides');
  for(const faction of ['navy','pirate']){
   const group=node('section');group.dataset.team=faction;
   group.append(node('h3',teamName(faction)+' · '+(match.winner===faction?'勝利':'落敗')),node('p','剩餘陣營生命 '+match.hp[faction]));
   for(const player of match.players.filter(p=>p.team===faction)){
    const row=node('div',null,'campaign-player');
    row.append(avatar(player.id),node('span',player.name+(player.id===you?' · 我':'')));
    if(player.id===you){
     if(equippedBadge)row.append(badgeImage(equippedBadge));
     else row.dataset.badgePending='true';
    }
    group.append(row);
   }
   sides.append(group);
  }
  const reward=node('p','正在確認本場勳章…','campaign-reward'),actions=node('div',null,'result-actions');
  actions.append(button('回到牌桌',closeSheet),button('查看戰績',profile),button('返回大廳',leave));
  body.append(sides,reward,actions);
  async function refresh(){
   const data=await request('MF_PROFILE');
   if(!reward.isConnected||view!==match)return;
   reward.textContent=!data.ok||data.pending?'戰績與勳章尚待同步。':'本場獲得 '+(won?30:20)+' 枚戰役勳章';
   if(data.ok){
    readBadge(data.stats.collection);
    const own=body.querySelector('[data-badge-pending]');
    if(own&&equippedBadge){own.append(badgeImage(equippedBadge));delete own.dataset.badgePending;}
   }
  }
  refresh();
 }

 async function progressBeat(e,hp,token){
  if(token!==epoch)return;const board=$('executionStage'),panel=$('health').querySelector('.health-box[data-team="'+e.team+'"]'),marker=$('health').querySelector('.route-marker[data-team="'+e.team+'"]'),max=e.team==='navy'?(view.players.length<=3?4:view.players.length+1):6;
  board.dataset.phase='advance';const routeMax=e.team==='navy'?7:6,from=(routeMax-hp[e.team])/routeMax,to=(routeMax-e.hp)/routeMax;
  $('status').textContent=e.team==='navy'?'海賊突破防線，向艾斯前進':'海軍向處刑台前進';window.MFSound?.play('click');
  // Numbers remain at their previous value until the walking marker reaches its next step.
  await animate(marker,[{bottom:(from*100)+'%',filter:'brightness(1)'},{bottom:((from+to)/2*100)+'%',filter:'brightness(1.8)',offset:.5},{bottom:(to*100)+'%',filter:'brightness(1)'}],{duration:reduced()?150:1250,easing:'ease-in-out'});
  if(token!==epoch)return;hp[e.team]=e.hp;renderProgress(hp);board.dataset.phase='progress';
  await animate(panel,[{filter:'brightness(1)'},{filter:'brightness(1.7)',offset:.3},{filter:'brightness(1)'}],{duration:reduced()?120:650});if(token!==epoch)return;await beat(800,token);if(token===epoch)delete board.dataset.phase;
 }
 function cardOrigin(player,id,navySlot){
  if(player===view.navyId&&Number.isInteger(navySlot))return $('navyHands').querySelector('[data-slot="'+navySlot+'"]');
  if(player===you&&id){const card=[...ownHand().children].find(button=>button.dataset.card===id);if(card)return card;}
  return $('players').querySelector('[data-player="'+player+'"] .portrait-button');
 }
 async function settleDefeat(event,token){
  if(token!==epoch)return;
  const seat=$('players').querySelector('[data-player="'+event.player+'"]');
  const destination=event.recycle?$('deckZone').querySelector('[data-team="navy"] .deck-top'):seat?.querySelector('.public-cards');
  const rect=(destination?.hidden?seat:destination)?.getBoundingClientRect();
  const offset=destination?.hidden?(seat.dataset.side==='ally'?-rect.height/2-12:rect.height/2+12):0;
  const held=cardOrigin(event.player,event.card,event.slot);if(event.player===view.navyId&&held)held.style.visibility='hidden';
  if(!rect?.width)return;
  const layer=$('effectLayer'),face=cardImage(event.card);
  face.classList.add('peek-flight');face.style.cssText='left:calc(50% - 28px);top:calc(50% - 42px);width:56px;height:84px';
  layer.append(face);const from=face.getBoundingClientRect();
  await animate(face,[{transform:'translate(0,0) scale(1)'},{transform:`translate(${rect.x+rect.width/2-from.x-28}px,${rect.y+rect.height/2+offset-from.y-42}px) scale(.32)`}],{duration:reduced()?120:620,fill:'forwards'});
  face.remove();
 }
 function travelFrom(element,source,duration){
  const from=source?.getBoundingClientRect(),to=element.getBoundingClientRect();
  if(!from||!to.width)return Promise.resolve();
  const x=from.x+from.width/2-to.x-to.width/2,y=from.y+from.height/2-to.y-to.height/2;
  const scale=Math.max(.22,Math.min(.85,from.width/to.width));
  return animate(element,[{transform:`translate(${x}px,${y}px) scale(${scale})`,opacity:1},{transform:'translate(0,0) scale(1)',opacity:1}],{duration:reduced()?120:duration,easing:'cubic-bezier(.16,.7,.28,1)'});
 }
 async function scene(text,ids=[],kind='card',token=epoch,source=null,participants=[],options={}){
  const layer=$('effectLayer'),noticeOnly=!ids.length&&!['battle','victory','shuffle'].includes(kind);layer.replaceChildren();layer.dataset.kind=noticeOnly?'notice':kind;layer.dataset.phase='announce';const stage=node('div',null,'effect-stage'),caption=node('p',text,'effect-caption');if(!noticeOnly)layer.append(stage);layer.append(caption);if(noticeOnly)window.MFSound?.play(kind==='morale'?'morale':kind==='miss'?'miss':'play');
  await animate(caption,[{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'translateY(0)'}],{duration:reduced()?80:320});await beat(readingTime(text,1300),token);if(token!==epoch)return;
  if(noticeOnly){await animate(caption,[{opacity:1},{opacity:0}],{duration:220});if(token===epoch)layer.replaceChildren();return;}
  const faces=(kind==='shuffle'&&source==='pirate'?[]:ids).map(id=>{const face=cardImage(id);face.classList.add('effect-card');stage.append(face);return face;});await Promise.all([...stage.querySelectorAll('img')].map(i=>i.decode().catch(()=>{})));if(token!==epoch)return;
  const duration=reduced()?140:800;
  if(source&&['card','defeat'].includes(kind)&&faces.length===1){await travelFrom(faces[0],source,duration);if(token!==epoch)return;}
  if(kind==='battle'){
   if(!faces.length)for(const id of participants){const back=node('img',null,'effect-card hidden-card');back.src=artUrl(view.players[id].team+'-back.webp');back.alt='未公開手牌';stage.append(back);faces.push(back);}
   const wraps=faces.map((face,i)=>{const wrap=node('div',null,'combatant');face.replaceWith(wrap);wrap.append(node('strong',name(participants[i]),'combatant-name'),face,node('small',teamName(view.players[participants[i]]?.team),'combatant-team'));if(options.values){const rank=cards[ids[i]].rank,score=options.values[i];wrap.append(node('strong',String(rank),'battle-math'));}else wrap.append(node('small','手牌不公開','battle-math'));return wrap;});
   const navyHeld=cardOrigin(view.navyId,null,options.navySlot);if(navyHeld&&Number.isInteger(options.navySlot))navyHeld.style.visibility='hidden';
   const versus=node('b','VS','battle-versus');stage.append(versus);layer.dataset.phase='compare';
   await Promise.all(wraps.map((wrap,i)=>travelFrom(wrap,cardOrigin(participants[i],ids[i],options.navySlot),duration)));await beat(1600,token);if(token!==epoch)return;
   for(let i=0;i<wraps.length;i++){
    const team=view.players[participants[i]]?.team,rank=ids[i]?cards[ids[i]].rank:null,score=options.values?.[i],boost=Number(options.boost?.[team]||(score!=null&&rank!=null?score-rank:0));
    if(boost>0){layer.dataset.phase='morale-cheer';caption.textContent=name(participants[i])+' · '+teamName(team)+'助威';const crowd=node('img',null,'morale-crowd');crowd.dataset.team=team;crowd.src=artUrl('redraw-morale-'+team+'.webp');crowd.alt=teamName(team)+'士兵吶喊助威';stage.prepend(crowd);await crowd.decode().catch(()=>{});if(token!==epoch)return;window.MFSound?.play('rally');
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
   if(navyHeld&&token===epoch)navyHeld.style.visibility='';
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
   if(source==='pirate'){
    const destination=plane.getBoundingClientRect(),thumbs=[...$('players').querySelectorAll('.public-thumb')].filter(t=>t.closest('.seat')?.dataset.team==='pirate');
    await Promise.all(thumbs.map(async(thumb,i)=>{const r=thumb.getBoundingClientRect(),copy=thumb.cloneNode(true);copy.setAttribute('aria-hidden','true');Object.assign(copy.style,{position:'fixed',left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px',margin:0,zIndex:4});layer.append(copy);thumb.style.visibility='hidden';await animate(copy,[{transform:'translate(0,0) scale(1)',opacity:1},{transform:'translate('+(destination.x+destination.width/2-r.x-r.width/2)+'px,'+(destination.y+destination.height/2-r.y-r.height/2)+'px) scale(.35)',opacity:.25}],{duration:reduced()?100:660,delay:reduced()?0:Math.min(i,12)*55,easing:'ease-in-out'});copy.remove();}));
    if(token!==epoch)return;
   }
   layer.dataset.kind='ground-shuffle';layer.dataset.phase='shuffle';pile.dataset.shuffling='true';window.MFSound?.play('shuffle');
   for(let i=0;i<5;i++){const back=node('img',null,'deck-shuffle-card');back.src=artUrl((source==='navy'?'navy':'pirate')+'-back.webp');back.alt='';back.setAttribute('aria-hidden','true');back.style.setProperty('--layer-z',(i*1.0)+'px');plane.append(back);backs.push(back);}
   await Promise.all(backs.map((face,i)=>animate(face,[{transform:`translateZ(${i*1.0}px)`},{transform:`translateX(${i<3?-4:4}px) translateZ(${i+3}px)`,offset:.3},{transform:`translateX(${i<3?3:-3}px) translateZ(${i+2}px)`,offset:.65},{transform:`translateZ(${i*1.0}px)`}],{duration:reduced()?180:1600,easing:'ease-in-out'})));for(const back of backs)back.remove();delete pile.dataset.shuffling;if(token!==epoch)return;await beat(650,token);

  }else if(kind==='victory'){
   layer.dataset.phase='victory';stage.classList.add('victory-stage');const winner=options.state.winner,result=resultText(options.state),seal=node('img',null,'victory-seal'),title=node('h2',result.title,'victory-title');seal.src=artUrl(winner+'-back.webp');seal.alt=teamName(winner);stage.prepend(seal,title);caption.textContent=teamName(winner)+'方勝利 · '+result.reason;window.MFSound?.play('victory');await animate(seal,[{transform:'scale(.5) rotate(-12deg)',opacity:0},{transform:'scale(1.07) rotate(2deg)',opacity:1,offset:.7},{transform:'scale(1) rotate(0)'}],{duration:reduced()?150:1600});await animate(title,[{opacity:0,transform:'translateY(25px)',letterSpacing:'.3em'},{opacity:1,transform:'translateY(0)',letterSpacing:'.06em'}],{duration:reduced()?120:950});await beat(3400,token);
  }else{
   layer.dataset.phase='reveal';window.MFSound?.play(kind==='morale'?'morale':kind==='miss'?'miss':'play');await Promise.all(faces.map(face=>{const r=face.getBoundingClientRect(),a=source?.getBoundingClientRect();return animate(face,[{transform:a?`translate(${a.x+a.width/2-r.x-r.width/2}px,${a.y+a.height/2-r.y-r.height/2}px) scale(.45)`:'translateY(30px) scale(.8)',opacity:.2},{transform:'translate(0,0) scale(1)',opacity:1}],{duration,easing:'cubic-bezier(.16,.7,.28,1)'});}));await beat(ids.length?2400:1600,token);
  }
  if(token===epoch){layer.dataset.phase='settle';await animate(caption,[{opacity:1},{opacity:0}],{duration:280});layer.replaceChildren();}
 }

 // Only the public played card supplies the cut-in; never inspect hidden hands.
 async function skillCutin(id,text,token,laser=false){
  const c=cards[id];if(!c){await scene(text,[],'card',token);return;}
  const layer=$('effectLayer');layer.replaceChildren();layer.dataset.kind='cutin';layer.dataset.phase='enter';
  const strip=node('section',null,'mf-cutin'),art=node('div',null,'mf-cutin-art'),copy=node('div',null,'mf-cutin-copy'),image=node('img');
  strip.dataset.team=c.team;strip.dataset.justice=String(!!c.justice);strip.dataset.card=id;strip.setAttribute('role','status');
  strip.dataset.laser=String(laser);image.src=laser?artUrl('kizaru-dialogue.webp'):cardArt(id);image.alt='';image.draggable=false;art.append(image);copy.append(node('strong',laser?'黃猿 · 指尖雷射':c.name),node('p',text));strip.append(art,copy);layer.append(strip);
  // Bound cold image decode too; a missing illustration must not block the room ACK.
  await Promise.race([image.decode().catch(()=>{art.hidden=true;}),new Promise(r=>setTimeout(r,1200))]);if(token!==epoch)return;
  window.MFSound?.play(c.justice?'morale':'slash');
  await animate(strip,[{opacity:0,transform:'translateX(-12%) skewY(-4deg)'},{opacity:1,transform:'translateX(0) skewY(-4deg)'}],{duration:reduced()?100:480});if(token!==epoch)return;
  layer.dataset.phase='hold';await beat(Math.max(1700,readingTime(text,1400)),token);if(token!==epoch)return;
  await animate(strip,[{opacity:1,transform:'translateX(0) skewY(-4deg)'},{opacity:0,transform:'translateX(9%) skewY(-4deg)'}],{duration:reduced()?100:350});if(token===epoch)layer.replaceChildren();
 }
 async function playedFlight(id,source,player,token){
  const layer=$('effectLayer');layer.replaceChildren();layer.dataset.kind='draw';
  const face=cardImage(id);face.classList.add('mf-play-flight');layer.append(face);const from=source?.getBoundingClientRect(),dest=$('players').querySelector('[data-player="'+player+'"]')?.getBoundingClientRect();
  const x=from?from.x+from.width/2:innerWidth*.5,y=from?from.y+from.height/2:innerHeight*.6,tx=dest?dest.x+dest.width*.5:innerWidth*.5,ty=dest?dest.bottom:innerHeight*.25;
  face.style.left=x+'px';face.style.top=y+'px';await animate(face,[{transform:'translate(-50%,-50%) scale(1)',opacity:1},{transform:`translate(calc(-50% + ${tx-x}px),calc(-50% + ${ty-y}px)) scale(.35)`,opacity:.3}],{duration:reduced()?150:650,easing:'ease-in-out'});face.remove();
 }

 async function peekFlight(e,token,returning=false,readCard=null){
  if(token!==epoch)return;
  if(returning)$('players').querySelector('.peek-parked')?.remove();
  const layer=$('effectLayer'),held=$('navyHands').querySelector('[data-slot="'+e.slot+'"]');if(!held)return;
  layer.replaceChildren();layer.dataset.kind='peek-flight';layer.dataset.phase='lift';
  const r=held.getBoundingClientRect(),dest=$('players').querySelector('[data-player="'+e.player+'"]')?.getBoundingClientRect();
  const id=you===e.target?view.players[e.target].hand[e.slot]:null,flight=id?cardImage(id):node('img');
  if(!id){flight.src=artUrl('navy-back.webp');flight.alt='被查看的海軍手牌';}
  flight.classList.add('peek-flight');flight.style.cssText=`left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px`;
  const caption=node('p',name(e.player)+'查看海軍'+slotName(e.slot)+'手牌'+(id?' · '+cards[id].rank+' 號 '+cards[id].name:''),'effect-caption');layer.append(flight,caption);
  const x=dest?dest.x+dest.width/2-r.x-r.width/2:0,y=dest?(dest.y>innerHeight/2?dest.y-r.height-8:dest.bottom+8)-r.y:0;held.style.visibility='hidden';
  const away=`translate(${x}px,${y}px) scale(1.12)`;
  try{await animate(flight,returning?[{transform:away},{transform:'translate(0,0)'}]:[{transform:'translate(0,0)'},{transform:away}],{duration:reduced()?150:700,fill:'forwards'});if(!returning&&readCard&&you===e.player&&token===epoch){const face=cardImage(readCard);face.classList.add('peek-flight');face.style.cssText=flight.style.cssText;face.style.transform=away;flight.replaceWith(face);try{await animate(face,[{transform:away+' rotateY(85deg)'},{transform:away+' rotateY(0deg)'}],{duration:reduced()?90:320,fill:'forwards'});}finally{face.remove();}}else await beat(returning?100:300,token);}
  finally{flight.remove();caption.remove();if(token===epoch)held.style.visibility='';}
 }
 async function pirateGuess(e,token,revealedCard=null){
  const attacker=e.attacker??view.turn;await scene(name(attacker)+'猜 '+name(e.player)+' 的 '+e.digit+' 號：'+(e.hit?'猜中':'未猜中'),[],'card',token);
  if(revealedCard&&token===epoch)await scene(name(e.player)+'的 '+cards[revealedCard].rank+' 號 '+cards[revealedCard].name+' 已公開',[revealedCard],'card',token,cardOrigin(e.player,revealedCard));
 }
 async function guessLaser(e,token,revealedCard=null){
  if(token!==epoch)return;
  const layer=$('effectLayer');layer.replaceChildren();layer.dataset.kind='guess-laser';layer.dataset.phase='charge';
  const allied=view.players[e.attacker??view.turn]?.team===view.players[you]?.team;
  layer.dataset.facing=allied?'back':'front';
  const actor=node('img',null,'laser-kizaru'),shadow=node('i',null,'laser-ground-contact');
  actor.src=artUrl('kizaru-stage-'+(allied?'back':'front')+'.webp');actor.alt='黃猿';
  const target=node('div',null,'laser-target laser-hand-target'),surface=node('div',null,'laser-card-surface'),back=node('img');
  target.dataset.player=e.player;back.src=artUrl('pirate-back.webp');back.alt='海賊手牌';
  const ownCard=you===e.player?view.players[you].hand[0]:null;
  surface.append(ownCard?cardImage(ownCard):back);target.append(surface);
  layer.append(shadow,actor,target);
  await Promise.race([actor.decode().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,1200))]);
  if(token!==epoch)return;
  const r=actor.getBoundingClientRect(),t=surface.getBoundingClientRect();
  const sx=r.x+r.width*(allied?.61:.457),sy=r.y+r.height*(allied?.067:.253),tx=t.x+t.width/2,ty=t.y+t.height/2;
  shadow.style.cssText=`left:${r.x+r.width*.43}px;top:${r.bottom-r.height*.035}px;width:${r.width*.64}px;height:${r.height*.025}px`;
  const spark=node('i',null,'laser-charge');spark.style.left=sx+'px';spark.style.top=sy+'px';layer.append(spark);
  const source=ownCard?cardOrigin(e.player,ownCard):null;
  const originalVisibility=source?.style.visibility;
  if(source)source.style.visibility='hidden';
  try{
   await Promise.all([animate(actor,[{opacity:0,transform:'translateX(-35px)'},{opacity:1,transform:'translateX(0)'}],{duration:reduced()?100:450}),travelFrom(target,source,450)]);
   if(token!==epoch)return;
   await animate(spark,[{transform:'translate(-50%,-50%) scale(.2)',opacity:.3},{transform:'translate(-50%,-50%) scale(1)',opacity:1}],{duration:reduced()?100:800,fill:'forwards'});
   if(token!==epoch)return;
   layer.dataset.phase='fire';window.MFSound?.play('slash');
   const beam=node('i',null,'laser-beam');
   beam.style.cssText=`left:${sx}px;top:${sy}px;width:${Math.hypot(tx-sx,ty-sy)}px;rotate:${Math.atan2(ty-sy,tx-sx)}rad`;layer.append(beam);
   const dodge=e.hit?Promise.resolve():animate(target,[{transform:'translateX(0)'},{transform:'translateX(60px)',offset:.35},{transform:'translateX(60px)'}],{duration:reduced()?150:650,fill:'forwards'});
   await Promise.all([dodge,animate(beam,[{transform:'scaleX(0)',opacity:0},{transform:'scaleX(.1)',opacity:1,offset:.22},{transform:'scaleX(1)',opacity:1,offset:.8},{transform:'scaleX(1)',opacity:0}],{duration:reduced()?150:650})]);
   if(token!==epoch)return;
   beam.remove();spark.remove();layer.dataset.phase=e.hit?'hit':'miss';
   if(e.hit){
    window.MFSound?.play('fire');
    if(revealedCard&&revealedCard!==ownCard)surface.replaceChildren(cardImage(revealedCard));
    surface.dataset.burned='true';
    const rim=node('img',null,'laser-burn-rim');rim.src=artUrl('fx-laser-burn-rim.webp');rim.alt='牌心被雷射燒穿';target.append(rim);
    await Promise.all([animate(surface,[{'--burn-radius':'0px',filter:'brightness(2)'},{'--burn-radius':'26px',filter:'brightness(.9)'}],{duration:reduced()?150:1100,fill:'forwards'}),animate(rim,[{transform:'translate(-50%,-50%) scale(.05)',opacity:0},{transform:'translate(-50%,-50%) scale(1)',opacity:1}],{duration:reduced()?150:1100,fill:'forwards'})]);
   }
   if(token!==epoch)return;
   layer.append(node('p',name(e.player)+(e.hit?' · 猜中 ':' · 未猜中 ')+e.digit+' 號','laser-result'));
   window.MFSound?.play(e.hit?'play':'miss');await beat(1700,token);
   if(token===epoch)layer.replaceChildren();
  }finally{if(source&&token===epoch)source.style.visibility=originalVisibility;}
 }

 async function navyHandShuffle(token){
  if(token!==epoch)return;const layer=$('effectLayer'),held=[...$('navyHands').children].slice(0,2),rects=held.map(e=>e.getBoundingClientRect());layer.replaceChildren();layer.dataset.kind='hand-shuffle';layer.dataset.phase='conceal';
  const caption=node('p','海軍手牌重新整理中','effect-caption');layer.append(caption);window.MFSound?.play('shuffle');
  const flights=rects.map(r=>{const img=node('img',null,'hand-shuffle-back');img.src=artUrl('navy-back.webp');img.alt='未公開的海軍手牌';img.style.width=r.width+'px';img.style.height=r.height+'px';img.style.transform=`translate(${r.x}px,${r.y}px)`;img.style.visibility='hidden';layer.append(img);return img;});
  try{await Promise.all(flights.map(i=>i.decode().catch(()=>{})));if(token!==epoch)return;for(const e of held)e.style.visibility='hidden';for(const img of flights)img.style.visibility='';
   await Promise.all(flights.map((img,i)=>{const r=rects[i],x=innerWidth/2-r.width/2,y=innerHeight*.48-r.height/2,side=i?1:-1;return animate(img,[{transform:`translate(${r.x}px,${r.y}px)`},{transform:`translate(${x+side*4}px,${y}px)`,offset:.3},{transform:`translate(${x-side*r.width*.45}px,${y+side*5}px)`,offset:.48},{transform:`translate(${x+side*r.width*.35}px,${y-side*5}px)`,offset:.68},{transform:`translate(${r.x}px,${r.y}px)`}],{duration:reduced()?300:1900,easing:'ease-in-out',fill:'forwards'});}));await beat(400,token);
  }finally{for(const img of flights)img.remove();if(token===epoch){for(const e of held)e.style.visibility='';caption.remove();}}
 }
 async function present(packet,token){if(token!==epoch)return;busy=true;closeSheet();render();const events=packet.events||[],presentationHP={...view.hp};let victory=false;for(let i=0;i<events.length;i++){if(token!==epoch)return;const e=events[i],p=name(e.player),target=name(e.target);
   if(e.type==='play'){const origin=e.player===you?ownHand().querySelector('[data-card="'+e.card+'"]'):$('players').querySelector('[data-player="'+e.player+'"]');if(e.player===you&&origin)origin.style.visibility='hidden';await playedFlight(e.card,origin,e.player,token);const declared=events.some(a=>['guess','target','peek','challenge'].includes(a.type)&&a.player===e.player);if(!packet.view.pending&&!declared)await skillCutin(e.card,p+' · '+cards[e.card].effect,token);if(cards[e.card].justice)await scene(p+'打出 '+cards[e.card].name,[e.card],'justice',token);}
   else if(e.type==='draw'){
    window.MFSound?.play('draw');const deck=$('deckZone').querySelector('[data-team="'+(view?.players[e.player]?.team||'pirate')+'"] .deck-top');let dest=e.player===you?ownHand():$('players').querySelector('[data-player="'+e.player+'"]'),landing=null;
    if(e.player===you&&view.players[you].team==='navy'){landing=node('button');landing.dataset.slot='2';landing.className='draw-landing';landing.style.visibility='hidden';landing.disabled=true;ownHand().append(landing);dest=landing;}
    if(deck&&dest){const b=dest.getBoundingClientRect(),img=deck.cloneNode(),pile=deck.closest('.deck'),plane=pile.querySelector('.deck-plane'),r=pile.getBoundingClientRect(),w=plane.offsetWidth,h=plane.offsetHeight,flight=node('div',null,'draw-flight');
     // Preserve the nested plane/face transform: flattening this into one matrix jumps in WebKit.
     flight.style.cssText=`position:fixed;left:${r.x}px;top:${r.y}px;width:${w}px;height:${h}px;transform-origin:0 0;transform-style:preserve-3d`;img.removeAttribute('class');img.style.cssText=`position:absolute;inset:0;width:100%;height:100%;object-fit:contain;transform:${getComputedStyle(deck).transform}`;flight.append(img);$('effectLayer').dataset.kind='draw';$('effectLayer').append(flight);pile.dataset.drawing='true';
     await animate(flight,[{transform:getComputedStyle(plane).transform},{transform:`translate(${b.x+b.width/2-r.x-w*.4}px,${b.y+b.height/2-r.y-h*.4}px) scale(.8)`}],{duration:750,easing:'cubic-bezier(.2,.65,.3,1)'});flight.remove();delete pile.dataset.drawing;
    }landing?.remove();
   }
   else if(e.type==='hand-shuffle')await navyHandShuffle(token);
   else if(e.type==='guess'){const text=p+'猜 '+e.targets.map(name).join('、')+' 的 '+e.digit+' 號牌';if(packet.view.players[e.player].team==='navy')await skillCutin(packet.view.players[view.turn]?.played.at(-1),text,token,true);else await scene(text,[],'card',token);}
   else if(e.type==='guess-result'){const outcome=events[i+1]?.type==='defeat'&&events[i+1].player===e.player?events[++i]:null;if(packet.view.players[e.attacker??view.turn].team==='pirate')await pirateGuess(e,token,outcome?.card);else await guessLaser(e,token,outcome?.card);if(outcome){await settleDefeat(outcome,token);await progressBeat(outcome,presentationHP,token);}}
   else if(e.type==='battle'){const secret=events[i+1]?.type==='battle-private'?events[++i]:null;const mine=secret?.cards.find(x=>x.player===you);const held=[...ownHand().children].find(b=>b.dataset.card===mine?.card);if(held)held.style.visibility='hidden';const outcome=['defeat','tie'].includes(events[i+1]?.type)?events[++i]:null;const publicCard=view.players[view.turn]?.played.at(-1)||'';await scene(name(e.attacker)+' 對戰 '+name(e.defender),secret?secret.cards.map(x=>x.card):[],'battle',token,null,secret?secret.cards.map(x=>x.player):[e.attacker,e.defender],{navySlot:e.navySlot,values:secret?.values,boost:e.boost||{},outcome,fx:publicCard.startsWith('pirate')?'fire':publicCard.startsWith('justice')?'ice':'quake'});if(outcome?.type==='defeat'){await settleDefeat(outcome,token);await progressBeat(outcome,presentationHP,token);}}
   else if(e.type==='defeat'){const origin=cardOrigin(e.player,e.card,e.slot);if(e.player===view.navyId&&origin)origin.style.visibility='hidden';await scene(p+'的 '+cards[e.card].rank+' 號 '+cards[e.card].name+' 被擊敗',[e.card],'defeat',token,origin);await settleDefeat(e,token);await progressBeat(e,presentationHP,token);}
   else if(e.type==='miss'){if(events[i-1]?.type!=='guess-result')await scene(p+'沒有 '+e.digit+' 號牌',[],'miss',token);}
   else if(e.type==='tie')await scene('平手 · 雙方保留手牌',[],'card',token);
   else if(e.type==='resisted')await scene(p+'未被擊敗',[],'card',token);
   else if(e.type==='shuffle')await scene(e.reason==='defeated-special'?e.cards.map(id=>cards[id].name).join('、')+' 洗回海軍牌堆；其他場上明牌保留':e.team==='navy'?'被擊敗的特殊牌洗回海軍牌堆':'海賊場上明牌洗回牌堆',e.cards||[],'shuffle',token,e.team);
   else if(e.type==='target')await skillCutin(packet.view.players[view.turn]?.played.at(-1),p+'對 '+target+' 使用卡片效果',token);
   else if(e.type==='peek')await skillCutin(packet.view.players[view.turn]?.played.at(-1),p+'查看 '+target+' 的一張手牌',token);
   else if(e.type==='peek-slot')await peekFlight(e,token,false,packet.view.pending?.cards?.[0]);
   else if(e.type==='peek-return')await peekFlight(e,token,true);
   else if(e.type==='challenge')await skillCutin(packet.view.players[view.turn]?.played.at(-1),p+'挑戰 '+target,token);
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
 socket.on('MF_CLOSED',packet=>{reset();roomChat?.panel.remove();roomMessages.clear();room=null;view=null;you=-1;sessionStorage.removeItem('marineford.room');closeSheet();render();notify(packet?.reason||'本場已結束，回到大廳');});
 socket.on('MF_LOBBY',r=>{room=r;if(Array.isArray(r.chat))roomMessages.set(r.code,r.chat);refreshFriends?.();sessionStorage.setItem('marineford.room',r.code);you=r.you;renderLobby();});
 socket.on('MF_STATE',packet=>{document.querySelector('.mf-friends')?.remove();refreshFriends=null;roomChat?.panel.remove();reset();view=packet.view;you=packet.you;lastSequence=packet.sequence;render();});
 socket.on('MF_PRESENT',packet=>{if(packet.sequence<=Math.max(lastSequence,queuedSequence))return;queuedSequence=packet.sequence;const token=epoch;queue=queue.then(()=>present(packet,token)).catch(()=>{if(token===epoch){notify('演出已恢復，正在同步牌桌');request('MF_JOIN',{code:room.code});}});});
 socket.on('MF_CAN_ACT',packet=>{if(packet.sequence===lastSequence){busy=false;render();}});
 socket.on('MF_RECOVER',packet=>{reset();view=packet.view;you=packet.you;lastSequence=packet.sequence;closeSheet();render();});
 socket.on('disconnect',()=>{authenticated=false;reset();$('connection').textContent='重新連線中…';closeSheet();});
 socket.on('connect',async()=>{let secret='',deviceId='';try{secret=localStorage.getItem('opSecret')||localStorage.getItem('op_secret')||'';deviceId=localStorage.getItem('op_device_id')||'';}catch{}if(!secret){$('connection').textContent='尚未登入';renderLobby();return;}const result=await request('SOCIAL_AUTH',{secret,deviceId});if(!result.ok)return;me=result.me;authenticated=true;$('connection').textContent='已連線';const saved=sessionStorage.getItem('marineford.room');if(saved){const joined=await request('MF_JOIN',{code:saved});if(!joined.ok){sessionStorage.removeItem('marineford.room');room=null;view=null;}}render();});
 $('sheetClose').onclick=closeSheet;
 function openMatchMenu(){const body=sheet('馬林福特之戰');body.append(button('返回牌桌',closeSheet),button('我的航海者檔案',profile),button(window.MFSound?.muted?'音效：關閉':'音效：開啟',event=>{const muted=window.MFSound.toggle();event.currentTarget.textContent=muted?'音效：關閉':'音效：開啟';}),button('卡片圖鑑',()=>gallery('卡片圖鑑',Object.keys(cards))),button('遊戲規則',showRules),button(view?.phase==='playing'?'繼續對局':'離開房間',view?.phase==='playing'?closeSheet:leave));if(view&&me?.userId===room?.host)body.append(button('結束本場並回大廳',()=>{const b=sheet('結束本場對局？');b.append(node('p','所有玩家會回到大廳，本場不計結果。'),button('確認結束',()=>request('MF_CLOSE')),button('繼續對局',closeSheet));}));};
 $('menuButton').onclick=openMatchMenu;
 fetch('cards.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(list=>{cards=Object.fromEntries(list.map(c=>[c.id,c]));render();}).catch(()=>notify('卡片資料載入失敗，請重新進入遊戲'));
})();
