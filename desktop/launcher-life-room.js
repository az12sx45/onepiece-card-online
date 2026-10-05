/* Room integration: uses the existing room's geometry, navigation and whole-body renderer. */
(function(root) {
  'use strict';
  const $=id=>document.getElementById(id);
  const data=root.OnePieceLifeData;
  const reserved=root.OnePieceReservedCrew;
  const keyOf=id=>String(id||'').replace(/^room-character-/,'');
  const itemOf=key=>'room-character-'+keyOf(key);
  function requestUuid() {
    const bytes=new Uint8Array(16);root.crypto.getRandomValues(bytes);
    bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  const STATE_NAMES={Idle:'稍作停留',Wander:'四處走走',Work:'正在工作',Eat:'享用餐點',Rest:'休息片刻',Sleep:'安心睡著',Train:'自主訓練',Socialize:'和夥伴聊天',UseFurniture:'使用家具',SpecialAction:'與你互動',EventParticipant:'船上的小插曲'};
  const ERRORS={client_update_required:'請更新啟動器後再使用這位夥伴；原有配置與工作會保留。',character_not_released:'這位夥伴尚未開放。',offline:'暫時無法連線，工作紀錄會在連線後更新。',unavailable:'正在讀取基地資料。',readonly:'參觀時無法指派主人的夥伴。',no_station:'目前沒有可到達且空閒的工作位置。',no_route:'這個位置目前走不到，換個地板格子試試。',invalid_target:'請點房間內的地板或已擺出的家具。',not_owned:'尚未收藏這位夥伴。',busy:'夥伴正在忙，稍候再來。',work_daily_limit:'今天的有酬工作已完成，夥伴仍會自由活動。',wallet_full:'商城金幣已滿，工作成果會保留。',insufficient_coins:'商城金幣不足。',cooldown:'剛剛才互動過，讓夥伴忙一下吧。',revision_conflict:'基地資料已更新，請再試一次。',work_active:'這位夥伴已有工作。',station_busy:'這個工作位置正在使用中。',not_placed:'請先把這位夥伴放進房間。'};
  function create(env) {
    const api=root.onePieceDesktop;
    let controller=null,snapshot=null,serverLife=null,serverRoster=null,serverWallet=null,serverRod=null,serverFishOffers=[],scope='',epoch=0,requestSerial=0,pending=Promise.resolve();
    let savedPositions=new Map(),savedRevision=-1,fetching=null,nextSync=0,lastTick=0,lastUi=0,manualBusy=false,manualKey='',panelKey='',suspending=false;
    const taps=new Map();
    function walker(key){return env.walkers().find(w=>w.key===keyOf(key));}
    function owner(){return env.isOwner();}
    function profile(){return env.profile();}
    function active(){return !!controller&&!!snapshot;}
    function hideAwaitingArrivals(){
      const arrivals=serverLife?.pendingArrivals||profile()?.life?.pendingArrivals||[];
      const pendingKeys=new Set(arrivals.map(a=>keyOf(a.itemId)));
      for(const w of env.walkers())if(pendingKeys.has(w.key)&&!controller?.isBusy(w.key))w.node.hidden=true;
    }
    function status(message,error=false){env.companionStatus(message,error);}
    function roster(){
      const current=profile();
      const source=Array.isArray(current?.releasedCharacterIds)&&Number(current.rosterRevision||0)>=Number(serverRoster?.rosterRevision||0)?current:serverRoster||current;
      return {releasedCharacterIds:(reserved?.releasedKeys(source)||data.characterKeys).map(itemOf),rosterRevision:Number(source?.rosterRevision)||0};
    }
    function ownedIds(){const released=new Set(roster().releasedCharacterIds);return (serverLife?.ownedCharacterIds || profile()?.life?.ownedCharacterIds || profile()?.collection?.launcher?.itemIds?.filter(id=>id.startsWith('room-character-')) || []).filter(id=>released.has(id));}
    function stations() {
      const result=[];
      const table=data?.stations || {};
      for(const target of env.layout().placements.values()) {
        if(target.kind!=='furniture')continue;
        const furnitureKey=env.furnitureKey(target.item);
        const pair=Object.entries(table).find(([,def])=>(def.furnitureKeys||[]).includes(furnitureKey));
        if(!pair)continue;
        const slots=env.spotsAround(target).filter(cell=>!env.cellBlocked(cell,env.walkBlocked())).map(cell=>({id:'single',cell,
          facing:{col:target.cell.col+(target.span.width-1)/2,row:target.cell.row+(target.span.height-1)/2}}));
        if(slots.length)result.push({id:target.entry.itemId,type:pair[0],furnitureKey,cell:target.cell,slots,target});
      }
      const occupied=env.layout().occupied;
      const floorCells=[];
      for(let row=5;row<8;row++)for(let col=1;col<15;col++)if(!occupied.has(`${col}:${row}`))floorCells.push({col,row});
      // Real floor tasks have no imaginary counter; their artwork includes handheld supplies.
      for(const [type,index] of [['deck',0],['training',Math.floor(floorCells.length/2)]]) {
        const cell=floorCells[index];if(!cell)continue;
        result.push({id:type,type,furnitureKey:'',cell,slots:[{id:'floor',cell,facing:{col:cell.col,row:cell.row+1}}]});
      }
      return result;
    }
    function world(){const owned=new Set(ownedIds());return{...roster(),ownedItemIds:[...owned],roomRevision:env.room().revision,stations:stations(),actors:env.walkers().filter(w=>owned.has(w.item.id)).map(w=>({key:w.key,itemId:w.item.id,cell:{...w.cell},moving:!w.attention&&(!!w.segmentCell||!!w.route.length||!!w.dockTravel),available:manualKey===w.key||!w.attention&&w.mode!=='focused'}))};}
    function contextAt(now) {
      const sceneKey=String(env.room().sceneId||'room-scene-crew-cabin').replace(/^room-scene-/,'');
      const fish=serverLife?.fishCollection||profile()?.life?.fishCollection||[];
      return {...(root.OnePieceRoomAmbience?.compute?.(new Date(now),sceneKey)||{}),aquariumFishCount:fish.filter(entry=>entry.inAquarium).length};
    }
    function face(key,cell) {const w=walker(key);return !!w&&env.face(w,cell,performance.now());}
    function setClip(key,clip,meta={}) {
      const w=walker(key);if(!w)return false;
      if(w.lifeReaction&&performance.now()<w.lifeReaction.until)return true;
      w.lifeReaction=null;
      const definition=root.OnePieceLifeActions?.CLIPS?.[clip];
      if(definition?.directional&&meta.stationId) {
        const station=stations().find(value=>value.id===meta.stationId);
        const placed=env.layout().placements.get('f:'+meta.stationId);
        const target=station?.slots.find(slot=>slot.cell.col===w.cell.col&&slot.cell.row===w.cell.row)?.facing||station?.slots[0]?.facing||
          (placed&&{col:placed.cell.col+(placed.span.width-1)/2,row:placed.cell.row+(placed.span.height-1)/2});
        if(target&&!face(key,target))return false;
      }
      const description=root.OnePieceLifeActions?.describe(clip,meta.direction||w.motion.direction);
      if(!description) {
        if(!['idle','wave','listen','talk_happy','talk_annoyed','surprised','focused_use'].includes(clip))return false;
        w.lifeClip=null;w.mode='life-act';env.setPose(w,clip);return true;
      }
      if(description.direction!==w.motion.direction) {
        const delta={east:[1,0],west:[-1,0],north:[0,-1],south:[0,1]}[description.direction];
        if(!face(key,{col:w.cell.col+delta[0],row:w.cell.row+delta[1]}))return false;
      }
      const canvas=w.node.querySelector('.room-walk-sprite');
      const painted=root.OnePieceLifeActions.draw(canvas,w.key,clip,description.direction,meta.elapsedMs||0,env.reducedMotion());
      if(!painted)return false;
      w.mode='life-act';w.lifeClip={clip,direction:description.direction,started:performance.now()-(meta.elapsedMs||0),token:meta.token};
      w.pose='life';w.node.dataset.pose=clip;w.node.dataset.lifeState=meta.state||'';
      canvas.style.setProperty('--room-root-offset','12.5%');canvas.hidden=false;
      w.node.classList.add('has-directional-sprite');w.node.dataset.actionSource='life_v1';w.node.dataset.actionFrame=String(painted.frame);w.node.dataset.direction=description.direction;
      return true;
    }
    const adapter={
      getWorld:world,
      getContext:contextAt,
      favoriteFurniture:key=>root.OnePieceRoomDialogue?.profile?.(key)?.favorite||[],
      activityBeat:(key,furnitureKey,index,context)=>root.OnePieceRoomDialogue?.activity?.(key,furnitureKey,index,context),
      directiveBeat:(key,furnitureKey,kind,index,context)=>root.OnePieceRoomDialogue?.directiveBeat?.(key,furnitureKey,kind,index,context),
      attending:key=>!!walker(key)?.attention,
      hold(key,token){const w=walker(key);if(!w)return false;w.lifeClip=null;w.lifeReaction=null;w.lifeToken=token;w.mode='life-act';w.route=[];w.pause=0;env.hideSpeech(w);env.setPose(w,'idle');return true;},
      callTarget(key){
        const w=walker(key);if(!w)return null;
        const blocked=env.blockedFor(w),candidates=[];
        for(const row of [7,6])for(const col of [7,8,6,9,5,10,4,11])candidates.push({col,row});
        return candidates.find(cell=>!env.cellBlocked(cell,blocked)&&!!env.routeBetween(w.segmentCell||w.cell,cell,blocked))||null;
      },
      plan(key,cell){const w=walker(key);return !!w&&!!env.routeBetween(w.segmentCell||w.cell,cell,env.blockedFor(w));},
      reserve(entries){return entries.every(entry=>adapter.plan(entry.key,entry.cell));},
      move(key,cell,token){const w=walker(key);if(!w)return false;env.hideSpeech(w);w.lifeClip=null;w.lifeReaction=null;w.lifeToken=token;w.pause=0;w.mode='life-approach';const result=env.routeTo(w,cell);if(w.attention&&manualKey!==key)env.deferAttentionMovement(w);return result;},
      arrived(key){const w=walker(key);return !!w&&!w.route.length&&!w.segmentCell&&!w.returnDockBeforeRoute&&!w.dockTravel;},
      face,
      dock(key,station){
        const w=walker(key);if(!w)return false;
        if(!station.target)return true;
        if(w.lifeDockReady===station.id)return true;
        if(!env.startDock(w,station.target))return true;
        w.lifeDockStation=station.id;w.mode='life-dock';return false;
      },
      undock(key){const w=walker(key);if(!w)return false;if(!w.dockOrigin)return true;w.lifeClip=null;w.mode='life-undock';return false;},
      clip:setClip,
      supportsClip:(key,clip)=>root.OnePieceLifeActions?.supported(key,clip)===true,
      clipFailed(key,clip,direction){
        const definition=root.OnePieceLifeActions?.describe(clip,direction||walker(key)?.motion?.direction||'south');
        return !!definition&&root.OnePieceLifeActions.preload(key,clip,definition.direction)?.failed===true;
      },
      hasClip(key,clip,direction){
        const definition=root.OnePieceLifeActions?.describe(clip,direction||walker(key)?.motion?.direction||'south');
        if(!definition)return ['idle','wave','listen','talk_happy','talk_annoyed','surprised'].includes(clip);
        return root.OnePieceLifeActions.preload(key,clip,definition.direction)?.ready===true;
      },
      speak(key,line,mood,meta={}){
        const w=walker(key);if(!w)return;
        const activeClip=meta.activity&&w.lifeClip?{...w.lifeClip}:null;
        w.lifeClip=null;env.speak(w,line,mood);
        if(meta.reactionPose&&meta.reactionMs){
          w.lifeReaction={pose:meta.reactionPose,until:performance.now()+meta.reactionMs,faceCamera:true};
          env.face(w,{col:w.cell.col,row:w.cell.row+1});
          env.setPose(w,meta.reactionPose);
        } else {
          if(meta.pose)env.setPose(w,meta.pose);
          if(activeClip)setClip(key,activeClip.clip,{direction:activeClip.direction,elapsedMs:Math.max(0,performance.now()-activeClip.started),token:meta.token,state:meta.state,stationId:meta.stationId});
        }
      },
      clearSpeech(key){const w=walker(key);if(w)env.hideSpeech(w);},
      release(key,token){const w=walker(key);if(!w||w.lifeToken&&w.lifeToken!==token)return;w.lifeClip=null;w.lifeReaction=null;w.lifeToken=null;w.lifeDockReady=null;w.lifeDockStation=null;delete w.node.dataset.lifeState;env.hideSpeech(w);env.setPose(w,'idle');env.wander(w);},
      wander(key){const w=walker(key);if(w){w.lifeClip=null;env.wander(w);}},
      socialScene(a,b,context){return root.OnePieceRoomDialogue?.scene?.(a,b,Math.floor(Math.random()*10000),context);},
      entry(key){
        const w=walker(key);if(!w)return null;
        const blocked=env.blockedFor(w);
        const entry=[{col:0,row:6},{col:15,row:6},{col:0,row:7},{col:15,row:7}].find(cell=>!env.cellBlocked(cell,blocked));
        if(!entry)return null;
        const targets=[{col:entry.col===0?3:12,row:6},{col:8,row:6},w.cell];
        const to=targets.find(cell=>!!env.routeBetween(entry,cell,blocked));
        return to?{from:entry,to}:null;
      },
      spawnArrival(key,from,token){
        const w=walker(key);if(!w||!ownedIds().includes(itemOf(key)))return false;
        // This is the single entry spawn, before the actor becomes visible in the room.
        env.placeWalker(w,from);w.lifeToken=token;w.node.hidden=false;return true;
      }
    };
    function accept(result,requestEpoch=epoch) {
      if(requestEpoch!==epoch||!result?.life)return false;
      if(serverLife&&Number(result.life.revision)<Number(serverLife.revision))return false;
      const previousFish=JSON.stringify(serverLife?.fishCollection||[]);
      serverLife=result.life;
      if(result.wallet)serverWallet=result.wallet;
      if(result.rod)serverRod=result.rod;
      if(Array.isArray(result.fishOffers))serverFishOffers=result.fishOffers;
      serverRoster={releasedCharacterIds:(reserved?.releasedKeys(result)||data.characterKeys).map(itemOf),rosterRevision:Number(result.rosterRevision)||0};
      if(result.wallet&&owner())root.LauncherProfileShop?.onCompanionWalletChanged(result.wallet);
      if(result.profile?.userId===profile()?.userId)env.acceptProfile(result.profile);
      if(controller)controller.sync(result);
      minigames?.receive(result);
      hideAwaitingArrivals();
      if(previousFish!==JSON.stringify(serverLife.fishCollection||[]))env.onFishChanged?.();
      env.onLifeChanged?.();
      return true;
    }
    function command(type,payload={}) {
      const requestEpoch=epoch;
      const requestId=requestUuid();
      const work=async()=>{
        if(requestEpoch!==epoch||!owner())return{ok:false,error:'readonly'};
        // Signed room content also runs inside older installed Electron cores.
        // Their command allowlist includes fish.release, but not these newer
        // actions. The server handles these exact dispositions atomically.
        const wireType=['fish.cook','fish.sell','rod.upgrade'].includes(type)?'fish.release':type;
        const wirePayload=type==='fish.cook'?{fishId:payload.fishId,disposition:'cook',recipientId:payload.itemId}:
          type==='fish.sell'?{fishId:payload.fishId,disposition:'sell'}:
          type==='rod.upgrade'?{disposition:'upgrade_rod',...payload.itemId?{recipientId:payload.itemId}:{}}:{...payload};
        const body={requestId,expectedRevision:serverLife?.revision||0,type:wireType,payload:wirePayload};
        if(type==='work.reserve')body.payload.roomRevision=env.room().revision;
        if(type==='directive.set'&&!body.payload.directiveId){body.payload.directiveId=body.payload.directive;delete body.payload.directive;}
        let result=await api.commandLauncherLife(body);
        if(requestEpoch!==epoch)return{ok:false,error:'stale'};
        accept(result,requestEpoch);
        if(result?.error==='revision_conflict') {
          // A conflict did not execute the intent. Retry once against the returned revision.
          result=await api.commandLauncherLife({...body,requestId:requestUuid(),expectedRevision:serverLife?.revision||0});
          if(requestEpoch!==epoch)return{ok:false,error:'stale'};
          accept(result,requestEpoch);
        }
        return result||{ok:false,error:'offline'};
      };
      const response=pending.then(work,work).catch(()=>({ok:false,error:'offline'}));pending=response;return response;
    }
    async function refresh() {
      if(fetching||!owner()||typeof api.getLauncherLife!=='function')return fetching;
      const currentEpoch=epoch;
      const promise=(async()=>{
        try {
          const result=await api.getLauncherLife();
          if(currentEpoch!==epoch)return;
          if(!result?.ok){if(ERRORS[result?.error])status(ERRORS[result.error],true);nextSync=Date.now()+15000;return;}
          accept(result,currentEpoch);ensureController();controller?.sync(result);nextSync=Date.now()+30000;
        } catch {nextSync=Date.now()+15000;}
        finally {if(fetching===promise)fetching=null;}
      })();fetching=promise;return promise;
    }
    function ensureController() {
      if(controller||!root.OnePieceLife||!profile()||owner()&&!serverLife)return;
      controller=root.OnePieceLife.create({data,adapter,command,writable:owner(),casualConversation:{foregroundGapMs:75000,pairCooldownMs:90000},onChange:value=>{snapshot=value;renderUi();}});
      controller.sync({...roster(),life:serverLife||profile().life||{ownedCharacterIds:ownedIds(),characters:{},directive:'free'}});
      if(!env.canAnimate())controller.pause();
    }
    function setContext() {
      const next=`${env.accountId()}:${profile()?.userId||0}:${owner()}`;
      if(next!==scope) {
        suspending=true;minigames?.dismiss();suspending=false;
        controller?.dispose();controller=null;snapshot=null;serverLife=null;serverRoster=null;serverWallet=null;serverRod=null;serverFishOffers=[];scope=next;epoch++;
        savedPositions.clear();savedRevision=-1;pending=Promise.resolve();fetching=null;taps.clear();
        nextSync=0;lastTick=0;manualBusy=false;manualKey='';panelKey='';
      }
      ensureController();if(owner())void refresh();renderUi();
    }
    function suspend() {
      suspending=true;minigames?.dismiss();suspending=false;
      if(env.walkers().length) {
        savedPositions=new Map(env.walkers().map(w=>[w.key,{cell:{...w.cell},x:w.x,y:w.y,segmentCell:w.segmentCell&&{...w.segmentCell},direction:w.motion?.direction}]));
        savedRevision=env.renderedRevision();
      }
      controller?.pause();
    }
    function resume() {
      if(savedRevision===env.room().revision&&!env.editing())for(const w of env.walkers()) {
        const saved=savedPositions.get(w.key);if(saved)env.restoreWalker(w,saved);
      }
      ensureController();
      if(controller&&env.canAnimate()){controller.rebind(adapter);controller.resume();}
      hideAwaitingArrivals();
      renderUi();
    }
    function tick(now) {
      if(!active())return;
      if(now-lastTick>200){lastTick=now;controller.tick(Date.now());}
      if(now-lastUi>1000){lastUi=now;renderUi();}
      if(owner()&&Date.now()>=nextSync)void refresh();
    }
    function animate(w,now,delta) {
      if(w.mode==='life-dock'||w.mode==='life-undock') {
        const inward=w.mode==='life-dock';const target=inward?w.dockTarget:w.dockOrigin;
        if(!target||env.moveDock(w,target,now,delta)) {
          if(inward)w.lifeDockReady=w.lifeDockStation;
          else{w.dockOrigin=null;w.dockTarget=null;w.returnDockBeforeRoute=false;w.lifeDockReady=null;}
          w.mode='life-act';
        }
        return true;
      }
      if(w.lifeReaction) {
        if(now<w.lifeReaction.until){
          if(w.lifeReaction.faceCamera)env.face(w,{col:w.cell.col,row:w.cell.row+1});
          env.setPose(w,w.lifeReaction.pose);return true;
        }
        w.lifeReaction=null;
      }
      if(w.lifeClip) {
        const value=root.OnePieceLifeActions.draw(w.node.querySelector('.room-walk-sprite'),w.key,w.lifeClip.clip,w.lifeClip.direction,now-w.lifeClip.started,env.reducedMotion());
        if(value){w.node.dataset.actionFrame=String(value.frame);w.node.dataset.actionSource='life_v1';}
        return true;
      }
      return w.mode==='life-act';
    }
    function renderUi() {
      const toolbar=$('roomLifeToolbar');if(!toolbar)return;
      toolbar.hidden=!profile();
      const schedule=(new Date()).getHours();
      $('roomLifeClock').textContent=schedule>=5&&schedule<11?'清晨':schedule>=11&&schedule<17?'日間':schedule>=17&&schedule<22?'傍晚':'夜間';
      const jobs=snapshot?.jobs||[];
      const summary=snapshot?.offlineSummary;
      $('roomLifeSummary').textContent=summary?.completedJobs?`離開期間完成 ${summary.completedJobs} 件工作${summary.coins?` · 商城金幣 +${summary.coins}`:''}`:jobs.length?`${jobs.length} 位夥伴正在分工，其餘自由活動。`:ownedIds().length?'夥伴會依照心情與作息自由活動。':'收藏第一位夥伴後，船上的日常就會開始。';
      $('roomLifeAutoAssign').hidden=!owner();$('roomLifeAutoAssign').disabled=!active()||manualBusy||env.editing()||!ownedIds().length;
      renderPanel();
    }
    function panelNodes() {
      if($('roomLifeActions'))return;
      const actions=$('roomCompanionActions');if(!actions)return;
      const wrap=document.createElement('div');wrap.id='roomLifeActions';wrap.className='room-life-actions';
      for(const [id,label] of [['Work','工作'],['Fish','釣魚'],['Call','指派移動'],['Gift','點心 · 5'],['Train','訓練'],['Status','詳情']]) {
        const button=document.createElement('button');button.id='roomLife'+id;button.className='ghost-button';button.type='button';button.textContent=label;wrap.append(button);
      }
      actions.append(wrap);
      $('roomLifeGift').title='送點心：使用 5 枚商城金幣，再點一次確認';
      $('roomLifeGift').setAttribute('aria-label','送點心，5 枚商城金幣');
      $('roomLifeWork').setAttribute('aria-expanded','false');
      $('roomLifeStatus').setAttribute('aria-expanded','false');
      const panel=document.createElement('div');panel.id='roomLifeDetails';panel.className='room-life-details';panel.hidden=true;$('roomCompanionSheet').append(panel);
      const work=document.createElement('div');work.id='roomLifeWorkChoices';work.className='room-life-work-choices';work.hidden=true;$('roomCompanionSheet').append(work);
      $('roomLifeWork').onclick=()=>openMinigame('work');
      $('roomLifeCall').onclick=()=>root.LauncherRoom?.beginAssignment?.(env.companionId());$('roomLifeFish').onclick=()=>openMinigame('fishing');$('roomLifeTrain').onclick=()=>openMinigame('training');
      $('roomLifeGift').onclick=()=>{const node=$('roomLifeGift');if(node.dataset.confirm!=='true'){node.dataset.confirm='true';node.textContent='確認 · 5';setTimeout(()=>{delete node.dataset.confirm;node.textContent='點心 · 5';window.LauncherRoom?.refreshCompanion?.();},5000);window.LauncherRoom?.refreshCompanion?.();return;}delete node.dataset.confirm;node.textContent='點心 · 5';runManual('gift');};
      $('roomCompanionSheetClose').onclick=()=>{panel.hidden=true;work.hidden=true;syncPanelShell();$('roomCompanionWheel').focus({preventScroll:true});};
      $('roomLifeStatus').onclick=()=>{work.hidden=true;panel.hidden=!panel.hidden;$('roomCompanionPanel').classList.toggle('show-details',!panel.hidden);$('roomLifeStatus').setAttribute('aria-expanded',String(!panel.hidden));renderPanel();};
    }
    function syncPanelShell() {
      const details=$('roomLifeDetails'),work=$('roomLifeWorkChoices');
      $('roomCompanionSheet').hidden=details.hidden&&work.hidden;
      $('roomCompanionPanel').classList.toggle('show-details',!details.hidden);
      $('roomLifeStatus').setAttribute('aria-expanded',String(!details.hidden));
      $('roomLifeWork').setAttribute('aria-expanded',String(!work.hidden));
      window.LauncherRoom?.refreshCompanion?.();
    }
    function renderPanel() {
      panelNodes();const wrap=$('roomLifeActions');if(!wrap)return;
      const key=keyOf(env.companionId());const actor=snapshot?.characters?.[key];
      if(key!==panelKey){panelKey=key;const gift=$('roomLifeGift');delete gift.dataset.confirm;gift.textContent='點心 · 5';$('roomLifeWorkChoices').hidden=true;$('roomLifeDetails').hidden=true;$('roomLifeWork').setAttribute('aria-expanded','false');$('roomLifeStatus').setAttribute('aria-expanded','false');$('roomCompanionPanel').classList.remove('show-details');}
      wrap.hidden=!active();
      $('roomCompanionActions').hidden=false;
      $('roomCompanionTalk').hidden=!owner();
      for(const button of wrap.querySelectorAll('button')){button.hidden=button.id!=='roomLifeStatus'&&!owner();button.disabled=manualBusy||minigames?.active()||!actor||(button.id!=='roomLifeStatus'&&!owner());}
      const details=$('roomLifeDetails');if(!actor){details.textContent='';syncPanelShell();return;}
      const needs=actor.needs||{};
      const values=[['精神',needs.energy],['飢餓',needs.hunger],['心情',needs.mood],['社交滿足',needs.social],['工作意願',needs.workMotivation]];
      details.replaceChildren();
      const heading=document.createElement('p');heading.textContent=STATE_NAMES[actor.state]||'自由活動';details.append(heading);
      for(const [label,value] of values){const span=document.createElement('span');span.textContent=`${label} ${Math.round(Number(value)||0)}`;details.append(span);}
      const task=snapshot.tasks.find(t=>t.key===key);
      if(task?.jobId&&owner()){const cancel=document.createElement('button');cancel.type='button';cancel.className='ghost-button';cancel.textContent='結束這次分工';cancel.onclick=()=>controller.cancel(key);details.append(cancel);}
      const memories=(actor.memories||[]).filter(m=>m.currentStrength>.15).slice(-2);
      if(memories.length){const p=document.createElement('small');p.textContent='還記得最近和夥伴一起度過的片刻。';details.append(p);}
      syncPanelShell();
    }
    function showWorkChoices() {
      const node=$('roomLifeWorkChoices');$('roomLifeDetails').hidden=true;node.hidden=!node.hidden;$('roomLifeWork').setAttribute('aria-expanded',String(!node.hidden));if(node.hidden){syncPanelShell();return;}node.replaceChildren();
      const key=keyOf(env.companionId());
      for(const station of stations()) {
        const button=document.createElement('button');button.type='button';button.className='ghost-button';
        const def=data?.stations?.[station.type];const efficiency=data?.characters?.[key]?.efficiency?.[station.type]||1;
        button.textContent=`${def?.name||def?.label||station.type} · ${Math.round(efficiency*100)}%`;
        button.onclick=()=>runManual('work',station.id);node.append(button);
      }
      syncPanelShell();
    }
    function openMinigame(kind) {
      const key=keyOf(env.companionId());
      if(!owner()||!controller||manualBusy||env.editing()||!ownedIds().includes(itemOf(key)))return;
      if(!minigames){status('請更新啟動器後再開始夥伴挑戰。',true);return;}
      if((snapshot?.jobs||[]).some(job=>keyOf(job.characterId||job.itemId||job.key)===key)){status(kind==='fishing'?'這位夥伴正在分工，完成後就能自由釣魚；釣魚不消耗工作次數。':'夥伴正在工作，先完成原有分工，再一起挑戰。',true);return;}
      minigames.open({kind,characterId:itemOf(key)});
    }
    async function runManual(action,stationId) {
      const key=keyOf(env.companionId());if(!controller||manualBusy||!key)return;
      manualBusy=true;manualKey=key;renderUi();const currentEpoch=epoch;
      try {
        const result=action==='work'?await controller.assignWork(key,stationId):await controller.interact(key,action);
        if(currentEpoch!==epoch)return;
        const message=result?.ok?(action==='work'?'收到分工，夥伴會走到工作位置。':action==='gift'?'點心已送達，已使用 5 枚商城金幣。':'夥伴回應了你的邀請。'):(ERRORS[result?.error]||'現在無法完成，請稍後再試。');
        if(result?.ok){$('roomLifeWorkChoices').hidden=true;$('roomLifeWork').setAttribute('aria-expanded','false');env.finishManual(itemOf(key));env.roomStatus(message);}
        else status(message,true);
      }finally{if(currentEpoch===epoch){manualBusy=false;manualKey='';renderUi();}}
    }
    function assignDestination(key,target) {
      key=keyOf(key);
      if(!owner())return{ok:false,error:'readonly'};
      if(!controller||!active()||!env.canAnimate()||env.editing())return{ok:false,error:'unavailable'};
      if(minigames?.active()||manualBusy)return{ok:false,error:'busy'};
      const w=walker(key);
      if(!w||!ownedIds().includes(itemOf(key)))return{ok:false,error:'not_owned'};
      const blocked=env.blockedFor(w),from=w.segmentCell||w.cell;
      let request;
      if(target?.kind==='floor') {
        const cell=target.cell;
        if(!Number.isInteger(cell?.col)||!Number.isInteger(cell?.row))return{ok:false,error:'invalid_target'};
        if(env.cellBlocked(cell,blocked)||!env.routeBetween(from,cell,blocked))return{ok:false,error:'no_route'};
        request={kind:'floor',cell:{col:cell.col,row:cell.row}};
      } else if(target?.kind==='furniture') {
        const itemId=String(target.itemId||'');
        const placed=env.layout().placements.get('f:'+itemId);
        if(!placed||placed.kind!=='furniture')return{ok:false,error:'invalid_target'};
        const slots=env.spotsAround(placed).filter(cell=>!env.cellBlocked(cell,blocked))
          .map((cell,index)=>({id:String(index),cell,route:env.routeBetween(from,cell,blocked)}))
          .filter(slot=>!!slot.route).sort((a,b)=>a.route.length-b.route.length)
          .map(({id,cell})=>({id,cell,facing:{col:placed.cell.col+(placed.span.width-1)/2,row:placed.cell.row+(placed.span.height-1)/2}}));
        if(!slots.length)return{ok:false,error:'no_route'};
        const furnitureKey=env.furnitureKey(placed.item);
        const type=Object.entries(data?.stations||{}).find(([,def])=>def.furnitureKeys?.includes(furnitureKey))?.[0]||'inspect';
        request={kind:'furniture',station:{id:itemId,type,furnitureKey,cell:placed.cell,slots,target:placed}};
      } else return{ok:false,error:'invalid_target'};
      if(w.attention&&env.companionId()===itemOf(key))env.finishManual(itemOf(key));
      const result=controller.assignDestination(key,request);
      if(result.ok)env.roomStatus(target.kind==='floor'?'夥伴正走向指定位置。':'夥伴正走向家具。');
      return result;
    }
    function tapped(key) {
      key=keyOf(key);
      // Interrupt a local conversation, while retaining paid work and its reservation.
      if(snapshot?.foreground?.keys?.includes(key))controller?.cancel(key,'player_attention');
      const w=walker(key);if(w)env.focus(w);
      const reaction=controller?.react(key);
      if(w&&reaction?.ok){env.speak(w,reaction.line,reaction.mood);env.setPose(w,reaction.pose||'wave');w.manualUntil=performance.now()+2800;}
      renderPanel();
    }
    if($('roomLifeAutoAssign'))$('roomLifeAutoAssign').onclick=async()=>{
      if(!controller||manualBusy)return;const currentEpoch=epoch;manualBusy=true;renderUi();try{
        const result=await controller.autoAssign(),assigned=result.filter(value=>value.ok).length;
        if(currentEpoch!==epoch)return result;
        status(assigned?`已安排 ${assigned} 位夥伴分工。`:ERRORS[result.find(value=>value.error)?.error]||'夥伴正在忙，或目前沒有可用的工作位置。',!assigned);
        return result;
      }finally{if(currentEpoch===epoch){manualBusy=false;renderUi();}}
    };
    window.addEventListener('pagehide',()=>{if(owner()&&active())void command('checkpoint',{exit:true});});
    const minigames=root.OnePieceRoomMinigames?.create({command,refreshLife:refresh,
      fishCollection(){return serverLife?.fishCollection||profile()?.life?.fishCollection||[];},
      onOpen(id){controller?.pause();const w=walker(id);if(w)env.focus(w);renderUi();},
      onClose(){if(!suspending&&env.canAnimate())controller?.resume();renderUi();},
      onResult(){void refresh();}
    });
    return {setContext,suspend,resume,tick,animate,active,renderPanel,tapped,refresh,assignDestination,
      isBusy:key=>!!controller?.isBusy(key)||!!minigames?.active(),reservations:()=>controller?.reservations()||[],
      cancel:key=>controller?.cancel(key),onPurchase(result){if(!owner())return;accept(result);void refresh();},
      snapshot:()=>snapshot,controller:()=>controller,world,
      fishCollection:()=>serverLife?.fishCollection||profile()?.life?.fishCollection||[],
      fishOffers:()=>serverFishOffers,
      ownedCharacterIds:()=>ownedIds(),
      wallet:()=>serverWallet,
      rod:()=>serverRod,
      aquariumCommand:command};
  }
  root.OnePieceLifeRoom=Object.freeze({create});
})(window);
