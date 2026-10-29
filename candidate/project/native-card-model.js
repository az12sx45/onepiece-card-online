'use strict';
// A presentation projection, never a second rules engine. Wire names and
// payloads are the existing server/engine.js contract. No hidden deck is kept.
const clone = value => JSON.parse(JSON.stringify(value));
const validCard = n => Number.isInteger(n) && n >= 0 && n < 20;
const actor = s => ['queen','bigmom-pay'].includes(s?.pending?.action) ? s.pending.target : s?.pending?.caster??s?.turnIndex;
function project(s, viewer) {
  const p=s.pending, mine=actor(s)===viewer;
  return {
    roundNo:s.roundNo,turnIndex:s.turnIndex,turnStep:s.turnStep,deckCount:s.deck?.length||0,
    chestCoins:s.chestCoins??s.chestLeft??0,HOT:s.HOT??14,venues:clone(s.venues||[]),
    myDeluxe:clone(s.myDeluxe||[]),log:clone(s.log||[]),final:clone(s.final||null),
    viewerCanNext:!!s.viewerCanNext,viewerIsHost:!!s.viewerIsHost,cpuSkipAvailable:!!s.cpuSkipAvailable,
    players:(s.players||[]).map(x=>({id:x.id,name:String(x.client?.displayName||x.displayName||`P${x.id+1}`),
      avatar:x.client?.avatar??x.avatar??1,alive:!!x.alive,gold:x.gold||0,isCPU:!!x.isCPU,
      autoControlled:!!x.autoControlled,offline:!!x.offline,title:x.client?.title||x.title||'',rank:clone(x.client?.rank||x.rank||null),
      hand:x.id===viewer&&validCard(x.hand)?x.hand:null,drawn:x.id===viewer&&validCard(x.tempDraw)?x.tempDraw:null,
      protected:!!x.protected,dodging:!!x.dodging,frozen:!!x.frozen,skipNext:!!x.skipNext,
      iceInfected:!!x.iceInfected,iceArmed:!!x.iceArmed})),
    discard:(s.discard||[]).map(x=>validCard(x)?x:(x?.coverBy==='teach'&&x.owner!==viewer?null:validCard(x?.id)?x.id:null)),
    pending:p?{action:p.action,actor:actor(s),target:p.target??null,
      extra:mine?clone(p.extra||{}):{},cards:mine?clone(p.cards||[]):[]}:null
  };
}
const option=(label,type,payload={})=>({label,type,payload});
function controls(s,viewer,local={}) {
  if(!s)return {kind:'waiting',title:'等待連線'};
  const p=s.pending,me=s.players.find(x=>x.id===viewer);
  if(s.final)return {kind:'final',title:'賽季結算',options:[]};
  if(me?.autoControlled&&!me.isCPU)return {kind:'confirm',title:'目前由 CPU 代打',options:[option('接回操作','TAKE_BACK_CONTROL')]};
  if(p&&p.actor===viewer){
    const extra=p.extra||{},targets=s.players.filter(x=>x.alive&&x.id!==viewer).map(x=>x.id);
    if(p.action==='usopp'&&extra.target!=null)return {kind:'digits',title:'選擇尾數（不能選 1）',options:[0,2,3,4,5,6,7,8,9].map(d=>option(String(d),'PICK_DIGIT',{digit:d}))};
    if(p.action==='luffy-boost')return {kind:'confirm',title:'魯夫・四檔：發動全場比武',options:[option('發動','LUFFY_BOOST_COMMIT')]};
    if(p.action==='queen'||p.action==='bigmom-coin')return {kind:'coin',title:'點擊硬幣擲出',options:[option('擲硬幣',p.action==='queen'?'QUEEN_COIN':'BIGMOM_COIN')]};
    if(p.action==='bigmom-pay')return {kind:'confirm',title:'Soul or Life?',options:[...(me?.gold>0?[option('交出 1 金幣','BIGMOM_CHOICE',{choice:'pay'})]:[]),option('接受淘汰','BIGMOM_CHOICE',{choice:'die'})]};
    if(p.action==='kata-order')return {kind:'order',title:'依序點選頂牌：第一張在最上方',cards:p.cards,type:'ORDER_COMMIT'};
    if(p.action==='teach-multipick')return {kind:'multi',title:'選擇要覆蓋到棄牌堆的卡',cards:p.cards,type:'MULTIPICK_COMMIT'};
    if(p.action==='law'&&Number.isInteger(extra.previewTarget)&&local.action!=='law')local={action:'law',target:extra.previewTarget};
    if(['law','killer'].includes(p.action)&&extra.boost&&local.action===p.action&&Number.isInteger(local.target))return {
      kind:'confirm',title:p.action==='law'?'要交換手牌嗎？':'要進行決鬥嗎？',card:local.card??null,
      options:[...(p.action==='law'&&local.card==null?[option('再次查看','PICK_TARGET',{target:local.target,preview:true})]:[]),option(p.action==='law'?'交換':'決鬥','PICK_TARGET',{target:local.target,[p.action==='law'?'swap':'duel']:true}),option('不發動','PICK_CANCEL')]};
    if(['usopp','robin','sanji','zoro','law','nami','luffy','kaido','killer','bigmom','aokiji','roger'].includes(p.action))return {
      kind:'targets',title:p.action==='usopp'?'點選上方玩家，猜他的手牌':'點選要發動效果的玩家',targets,
      type:p.action==='luffy'&&extra.firstDone?'LUFFY_SECOND':'PICK_TARGET',targetPayload:p.action==='law'&&extra.boost?{preview:true}:{},
      options:p.action==='luffy'&&extra.firstDone?[option('略過第二位','LUFFY_SECOND',{target:-1})]:[]};
    return {kind:'unsupported',title:'此效果尚未接入原生操作：'+p.action};
  }
  if(s.turnStep==='ended')return {kind:'ended',title:s.viewerCanNext?'本局結束':'等待房主或勝者開始下一局',options:s.viewerCanNext?[option('下一局','NEXT_ROUND')]:[]};
  if(!me?.alive||s.turnIndex!==viewer||p)return {kind:'waiting',title:p?'等待玩家完成效果':'等待其他玩家行動',options:s.cpuSkipAvailable?[option('跳過 CPU 演出','HOST_SKIP_CPU')]:[]};
  if(s.turnStep==='draw')return {kind:'draw',title:'你的回合・點擊牌堆抽牌',options:[option('抽牌','DRAW')]};
  if(s.turnStep==='choose'){
    const forced=!me.frozen&&[me.hand,me.drawn].includes(7)&&[me.hand,me.drawn].some(x=>x===6||x===8);
    return {kind:'play',title:me.frozen?'凍結：只能打出新抽的牌':forced?'必須打出娜美':'選擇一張牌，再確認打出',options:[['hand',me.hand],['drawn',me.drawn]].filter(([k,c])=>validCard(c)&&(!me.frozen||k==='drawn')&&(!forced||c===7)).map(([which,card])=>({...option('打出','PLAY_CARD',{which}),card,which}))};
  }
  return {kind:'waiting',title:'等待回合更新'};
}
// EMIT is followed by STATE by the existing server. Preserve those transaction
// boundaries; outcome logs and the next state are committed only after effects.
function steps(before,after,events,viewer) {
  const out=[],logs=events.filter(x=>x.type==='log').map(x=>String(x.text||''));
  if(after.venues?.length&&(!before||before.roundNo!==after.roundNo))out.push({kind:'venues',venues:clone(after.venues)});
  const played=logs.map(t=>t.match(/打出\s+(\d+)｜/)).find(Boolean);
  if(played){const card=Number(played[1]),by=before?.turnIndex??after.turnIndex,me=before?.players.find(x=>x.id===viewer);out.push({kind:'play',card,actor:by,other:by===viewer?(me?.hand===card?me.drawn:me?.hand):null});}
  if(before&&before.turnStep==='draw'&&after.turnStep==='choose'&&!played)out.push({kind:'draw',actor:before.turnIndex,card:after.players.find(x=>x.id===before.turnIndex)?.drawn??null});
  const duelLosses=events.filter(x=>x.type==='duel_log');
  for(const e of events){
    if(e.type==='duel'){
      out.push({kind:'announce',text:'雙方發起決鬥'});
      out.push({kind:'duel',left:e.leftId,right:e.rightId,winner:e.winnerId??null,losses:duelLosses.filter(x=>x.loserId===e.leftId||x.loserId===e.rightId).map(x=>({actor:x.loserId,card:x.cardId}))});
    }else if(['robin_view','law_view'].includes(e.type))out.push({kind:'peek',actor:e.targetId,cards:[e.cardId],title:e.type==='law_view'?'ROOM・SCAN':'查看手牌',private:true});
    else if(['kata_peek','teach_cover'].includes(e.type))out.push({kind:'peek',actor:-1,cards:e.cards||[],title:e.type==='kata_peek'?'查看牌堆頂牌':'覆蓋牌確認',private:true});
    else if(e.type==='law_swap')out.push({kind:'swap',event:clone(e)});
    else if(e.type==='robin_peek'&&e.casterId!==viewer)out.push({kind:'peek_notice',actor:e.casterId,targets:e.all?before.players.filter(x=>x.alive&&!x.protected&&!x.dodging&&x.id!==e.casterId).map(x=>x.id):[e.targetId]});
    else if(e.type==='enh_fx')out.push({kind:'video',card:e.cardId});
    else if(e.type==='card_guess')out.push({kind:'announce',text:`猜測尾數 ${e.digit}`,actor:e.casterId,target:e.targetId});
    else if(['usopp_hit','usopp_miss','card_defense','killer_disarm','nami_paralyze','aokiji_freeze','chopper_status','bigmom_status','zoro_discard'].includes(e.type))out.push({kind:'effect',effect:e.type,event:clone(e)});
    else if(e.type==='coin_fx'){
      const outcome=logs.find(text=>/擲到\s*(正面|反面)/.test(text));
      out.push({kind:'coin',face:outcome?(/擲到\s*正面/.test(outcome)?'heads':'tails'):'unknown',text:outcome||'判定完成，請查看對局紀錄'});
    }
    else if(e.type==='reward_chest')out.push({kind:'reward',event:clone(e),private:true});
  }
  if(played&&Number(played[1])===0)out.push({kind:'shuffle',pile:'deck',actors:before.players.filter(x=>x.alive&&!x.protected&&!x.dodging).map(x=>x.id)});
  if(played&&Number(played[1])===11&&after.turnStep==='choose'&&after.turnIndex===before?.turnIndex)out.push({kind:'kid',actor:before.turnIndex,card:after.players.find(x=>x.id===before.turnIndex)?.drawn??null});
  if(played&&Number(played[1])===11&&logs.some(x=>x.includes('逆時針傳遞')))out.push({kind:'pass',actors:before.players.filter(x=>x.alive&&!x.protected&&!x.dodging).map(x=>x.id)});
  if(played)out.push({kind:'discard_played',card:Number(played[1])});
  // Never interpolate winner names/cards into advance narration.
  if(logs.length)out.push({kind:'result',lines:logs});
  return out;
}
exports.project=project;exports.controls=controls;exports.steps=steps;exports.validCard=validCard;
