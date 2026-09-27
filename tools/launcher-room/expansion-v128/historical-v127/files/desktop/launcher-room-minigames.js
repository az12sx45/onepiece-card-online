/* Short, server-scored crew challenges. Art stays in the existing asset pipeline. */
(function(root) {
  'use strict';
  const ASSET='opui://launcher/images/launcher_room/';
  const keyOf=value=>String(value||'').replace(/^room-character-/,'');
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
  const DIRS=['left','up','right'];
  const ARROWS={left:'←',up:'↑',right:'→'};
  const DIR_NAMES={left:'左側',up:'中央',right:'右側'};
  // Original collection-base dialogue. Ace is Whitebeard's second division commander.
  const VOICES={
    luffy:{name:'魯夫',work:'肉要留到裝船之後？好啦！我來搬！',training:'再快一點！這次我要一口氣跑過去！',good:'喔喔！配合得真好！',miss:'啊，跑太快了！再看清楚一次。',win:'做到了！忙完一起吃飯吧！'},
    zoro:{name:'索隆',work:'這幾箱交給我。你把該搬的指出來。',training:'先站穩。看到空隙，再往前。',good:'這個步子不錯。繼續。',miss:'別急著動，先看清楚。',win:'還能再練。不過這回做得不差。'},
    nami:{name:'娜美',work:'照清單裝船！弄錯了可得重新搬喔。',training:'注意風向跟落點，選好路再動！',good:'很好，照這個節奏！',miss:'喂，先看提示啦！',win:'全都核對好了。這次算你可靠！'},
    usopp:{name:'騙人布',work:'交給我這個補給大隊長！先、先看一下清單。',training:'這可是勇敢海上戰士的敏捷訓練！',good:'看到了吧！這就是合作的力量！',miss:'剛才只是試探！下一次來真的！',win:'哈哈！又多了一段可以講的冒險！'},
    sanji:{name:'香吉士',work:'食材別壓壞。裝好後，我替大家準備晚餐。',training:'重心放穩，腳步才跟得上。',good:'好，這一回俐落多了。',miss:'呼吸放慢，別亂了步子。',win:'辛苦了。待會兒給你加一道菜。'},
    chopper:{name:'喬巴',work:'藥品和食材都要收好，不能讓大家缺東西。',training:'別勉強！我會看著你的步子。',good:'太好了！你的反應越來越快！',miss:'有沒有受傷？沒事就慢慢再來。',win:'一起完成了！我、我也很高興啦！'},
    robin:{name:'羅賓',work:'書和航圖放在乾燥的那箱。謝謝你幫忙。',training:'記住每一處空隙，答案就連起來了。',good:'呵呵，觀察得很仔細。',miss:'再留意一下順序，會有新發現。',win:'和你一起整理，事情變得有趣多了。'},
    franky:{name:'佛朗基',work:'工具各就各位！桑尼號可少不了它們！',training:'讓我看看你 SUPER 的腳步！',good:'SUPER！就是這股勁！',miss:'調整一下！好機器也得校準嘛！',win:'漂亮！這才是可靠的搭檔！'},
    brook:{name:'布魯克',work:'我也來搬吧。別讓樂譜被箱子壓住了。',training:'跟著節拍走。喲呵呵呵！',good:'節拍對上了，真悅耳！',miss:'哎呀，這一拍走音了。',win:'完美收尾！讓我為您奏一曲吧。'},
    jinbe:{name:'吉貝爾',work:'重物放穩，再顧輕的。一起來便不費力。',training:'穩住重心，順勢而動。無須慌張。',good:'嗯，判斷得很好。',miss:'先穩住。下一步仍來得及。',win:'互相信任，事情自然做得妥當。'},
    ace:{name:'艾斯',work:'我來搭把手。你顧清單，這邊交給我。',training:'放輕鬆，我陪你走一輪。',good:'不錯嘛！再接下一個！',miss:'沒事，穩一下。還有下一次。',win:'幹得漂亮！謝啦，有你輕鬆多了。'}
  };
  const EXTRA_REACTIONS={
    luffy:{good:['哈哈！這一批也到手了！','接得真準！下一個也來吧！'],miss:['咦？這個不是要的？再來一次！','剛才沒看清！下一個交給我！']},
    zoro:{good:['穩住，照這樣做。','嗯，節奏抓到了。'],miss:['重新看一遍順序。','腳步別亂。還沒結束。']},
    nami:{good:['這次一項都沒漏，很好！','核對完成！下一批也拜託你。'],miss:['少了一項，回頭再看清單。','放慢一下，我們把順序對好。']},
    usopp:{good:['不愧是我的搭檔！','哈哈！剛才那一下很漂亮嘛！'],miss:['等等，剛才風太大！','不要慌！我、我還看得清楚！']},
    sanji:{good:['俐落，這樣大家都省力。','好，手腳配合得上了。'],miss:['先看好再下手，別浪費力氣。','收穩重心，再接下一個。']},
    chopper:{good:['成功了！我有看到喔！','你做得好棒！再一起試試看！'],miss:['別緊張，我們還能再來。','慢一點也沒關係，安全第一！']},
    robin:{good:['線索都對上了，真好。','這樣整理起來，一目了然呢。'],miss:['呵呵，謎底似乎拐了個彎。','不用急，答案還留在那裡。']},
    franky:{good:['配合得 SUPER 順！','檢查通過！下一批！'],miss:['重新調整，就能對上！','喔喔，這裡得再校準一下！']},
    brook:{good:['這一段流暢得像旋律呢！','喲呵呵！下一拍也請多指教。'],miss:['慢半拍，再找回節奏吧。','沒關係，演奏還沒結束呢。']},
    jinbe:{good:['很好，穩穩接住了。','不疾不徐，正是如此。'],miss:['還有下一回，先把氣息穩住。','浪勢一變，也別急著搶先。']},
    ace:{good:['接得漂亮！下一個我看著。','哈哈，有你幫忙真省心。'],miss:['別皺眉，重新看一遍就好。','我替你看這邊，下一次穩穩來。']}
  };
  for(const [key,extra] of Object.entries(EXTRA_REACTIONS)){VOICES[key].good=[VOICES[key].good,...extra.good];VOICES[key].miss=[VOICES[key].miss,...extra.miss];}
  const ERRORS={offline:'連線中斷，這一輪暫停送出。重新連線後可再送出。',unavailable:'暫時連不上基地，請稍後再試。',minigame_active:'上一場挑戰還沒結束，可繼續查看或結束後重開。',minigame_expired:'這場挑戰已逾時，請關閉後重新開始。',minigame_cooldown:'夥伴剛完成訓練，休息一下再來。',cooldown:'夥伴還在休息，稍後再來。',work_daily_limit:'今天的有酬工作次數已用完。',insufficient_energy:'夥伴的精神不足，先讓他休息一下。',character_busy:'夥伴正在工作，請先完成原有分工。',work_active:'夥伴正在工作，請先完成原有分工。',not_placed:'請先把這位夥伴放進房間。',character_not_released:'這位夥伴尚未開放。',readonly:'參觀好友時不能指派主人的夥伴。',minigame_not_ready:'還沒到交卷時間，稍候再試。',minigame_invalid:'這場挑戰已失效，請關閉後重新開始。'};
  Object.assign(ERRORS,{needs_rest:'夥伴有些累了，先休息恢復精神；也可以自由練習，不領取獎勵。',interaction_cooldown:'訓練還在冷卻中。可以先自由練習，不領取獎勵。',invalid_minigame_session:'這場挑戰已失效，請關閉後重新開始。',minigame_too_early:'這一輪仍在判定，稍候片刻再送出。',minigame_round_conflict:'挑戰進度已更新，請關閉後重新進入。',wallet_full:'商城錢包需要先空出至少 10 枚金幣，才能開始有酬工作。'});
  function node(tag,className,text) {const value=document.createElement(tag);if(className)value.className=className;if(text!==undefined)value.textContent=text;return value;}
  function create(options) {
    let layer=null,card=null,body=null,feedback=null,progress=null,closeButton=null,live=null;
    let game=null,kind='',characterId='',phase='closed',generation=0,frame=0,requesting=false,queued=null,roundStart=0,choice=[],directions=[],previousFocus=null,lastRound='',lastResult='',lastFeedback=-1;
    let held=false,windowFocused=true,practice=false,actorFrame=0,actorStep=null,actorLane=1;
    const reactionCounts={good:0,miss:0};
    const now=()=>performance.now();
    const voice=()=>VOICES[keyOf(characterId)]||VOICES.luffy;
    const reaction=type=>{const lines=voice()[type];return Array.isArray(lines)?lines[reactionCounts[type]++%lines.length]:lines;};
    const active=()=>phase!=='closed';
    function say(text) {if(feedback)feedback.textContent=text;if(live)live.textContent=text;}
    function safeResume(){if(held){held=false;options.onClose?.();}}
    function ensure() {
      if(layer)return;
      layer=node('section','room-minigame-overlay');layer.hidden=true;layer.id='roomMinigameOverlay';layer.tabIndex=-1;layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-labelledby','roomMinigameTitle');
      card=node('div','room-minigame-card');layer.append(card);
      const head=node('header','room-minigame-head'),titles=node('div');
      titles.append(node('span','room-minigame-eyebrow','CREW CHALLENGE'));
      const title=node('h2');title.id='roomMinigameTitle';titles.append(title);
      closeButton=node('button','room-minigame-close','×');closeButton.type='button';closeButton.setAttribute('aria-label','結束並關閉挑戰');closeButton.onclick=()=>void askClose();head.append(titles,closeButton);card.append(head);
      progress=node('div','room-minigame-progress');card.append(progress);
      body=node('div','room-minigame-body');card.append(body);
      const captain=node('footer','room-minigame-crew');const portrait=node('img');portrait.id='roomMinigamePortrait';portrait.alt='';portrait.draggable=false;
      const quote=node('div');const name=node('strong');name.id='roomMinigameName';feedback=node('p');feedback.setAttribute('data-testid','minigame-feedback');quote.append(name,feedback);captain.append(portrait,quote);card.append(captain);
      live=node('span','room-minigame-sr');live.setAttribute('aria-live','polite');layer.append(live);document.body.append(layer);
      layer.addEventListener('keydown',keyDown);
    }
    function portraitUrl(){const key=keyOf(characterId);return key==='robin'?`${ASSET}robin_v2/portrait.webp`:root.OnePieceReservedCrew?.assetUrl(key,'portrait.webp')||`${ASSET}portrait_v3/${key}.webp`;}
    function open(input) {
      if(active()||!VOICES[keyOf(input.characterId)])return false;
      ensure();generation++;game=null;queued=null;requesting=false;lastRound='';lastResult='';lastFeedback=-1;practice=false;reactionCounts.good=0;reactionCounts.miss=0;kind=input.kind;characterId=input.characterId;phase='intro';previousFocus=document.activeElement;root.OnePieceRoomMotion?.preload(keyOf(characterId));
      held=true;options.onOpen?.(characterId);layer.hidden=false;document.getElementById('roomMinigameTitle').textContent=kind==='work'?'海上補給':'甲板特訓';document.getElementById('roomMinigameName').textContent=voice().name;document.getElementById('roomMinigamePortrait').src=portraitUrl();progress.replaceChildren();say(voice()[kind]);renderIntro();return true;
    }
    function button(label,fn,className='room-minigame-primary'){const b=node('button',className,label);b.type='button';b.onclick=fn;return b;}
    function renderIntro(message='') {
      phase='intro';body.replaceChildren();const intro=node('div','room-minigame-intro');
      intro.append(node('h3','',kind==='work'?'看清訂單，把對的物資全數裝船。':'看過安全路線，再用腳步記住它。'));
      const rules=node('ol');for(const text of kind==='work'?['共 8 輪補給，勾選每張訂單要求的全部物資；不需要的留在原位。','點箱子或按 1／2／3 切換選取；倒數結束裝船，也可按 Enter 提早交卷。','後半段會加快。完全配對 6 輪即可過關，連續正確會累積連擊。']:['共 4 段航道。先看依序亮起的安全位置，再照順序走。','使用 ←／↑／→ 或畫面上的三個方向鍵；↑ 代表中央航道。','路線由 3 步增至 5 步。完整通過 3 段即可過關，沒有戰鬥能力限制。'])rules.append(node('li','',text));intro.append(rules);
      const warning=node('p','room-minigame-cost',practice?'自由練習不消耗精神，不受冷卻限制，也不領取獎勵。':kind==='work'?'開始後會占用 1 次當日有酬工作；中途結束也會計次。過關可得 10 枚商城金幣與親密度。不及格可在同一場免費重試 2 次。':'開始會消耗 6 點精神並進入 10 分鐘訓練冷卻；中途結束也會計入。過關可提升工作意願與親密度。不及格可在同一場免費重試 2 次。');intro.append(warning);
      const budget=options.workBudget?.(characterId);if(kind==='work'&&budget)intro.append(node('p','room-minigame-budget',`今日剩餘：全帳號最多 ${budget.remainingStartsToday} 次，這位夥伴 ${budget.characterStartsRemainingToday} 次。`));
      if(message)intro.append(node('p','room-minigame-error',message));intro.append(button('準備好了 · 開始挑戰',()=>void start()));if(kind==='training'&&!practice)intro.append(button('先自由練習 · 不領獎',()=>{practice=true;renderIntro();},'room-minigame-secondary'));body.append(intro);body.querySelector('button')?.focus({preventScroll:true});
    }
    async function request(type,payload={}) {
      if(requesting)return null;requesting=true;setDisabled(true);const current=generation;
      try {const response=await options.command(type,payload);if(current!==generation)return null;return response||{ok:false,error:'offline'};}
      catch{return current===generation?{ok:false,error:'offline'}:null;}
      finally{if(current===generation){requesting=false;setDisabled(false);}}
    }
    function setDisabled(value){if(!layer)return;layer.dataset.pending=String(value);for(const b of body.querySelectorAll('button'))b.disabled=value;}
    async function start(){if(phase!=='intro')return;const response=await request('minigame.start',{characterId,kind,...practice?{practice:true}:{}});if(!response)return;if(response.minigame&&['playing','ready','failed'].includes(response.minigame.state)){game=response.minigame;if(game.characterId!==characterId||game.kind!==kind){renderRecovery();return;}accept(response);return;}renderIntro(ERRORS[response.error]||response.message||'暫時無法開始，請稍候再試。');}
    function renderRecovery(){phase='recovery';body.replaceChildren(node('h3','','上一次挑戰尚未結束'),node('p','','結束舊挑戰後，即可重新選擇夥伴。原本消耗的工作次數或精神不會退回。'),button('結束舊挑戰',()=>void cancel(false)));say('不會自動領取獎勵。');}
    function accept(response) {
      if(!response?.minigame){showRetry(response);return;}
      game=response.minigame;
      if(game.feedback&&game.feedback.roundIndex!==lastFeedback){lastFeedback=game.feedback.roundIndex;say(reaction(game.feedback.correct?'good':'miss'));}
      progress.textContent=`${kind==='work'?'補給':'航道'} ${Math.min(game.roundIndex+1,game.totalRounds)} / ${game.totalRounds}　｜　完成 ${game.correctRounds||0}　｜　連擊 ${game.combo||0}`;
      if(['completed','failed'].includes(game.state)){renderResult();return;}
      if(!['playing','ready'].includes(game.state)){renderEnded();return;}
      if(game.state==='ready'||!game.challenge){void finish();return;}
      if(lastRound===game.challenge.id)return;
      lastRound=game.challenge.id;choice=[];directions=[];queued=null;roundStart=now();phase='showcase';renderRound();cancelAnimationFrame(frame);frame=requestAnimationFrame(tick);
    }
    function renderRound() {
      body.replaceChildren();const challenge=game.challenge;
      const stage=node('div',`room-minigame-stage ${kind}`);stage.dataset.round=String(game.roundIndex);body.append(stage);
      const heading=node('div','room-minigame-order');heading.append(node('span','room-minigame-round-number',`0${game.roundIndex+1}`));
      heading.append(node('strong','',kind==='work'?`這一批需要：${challenge.order?.label||{food:'食材',tools:'工具',books:'書籍'}[challenge.order?.category]||'補給'}`:'記住安全航道'));stage.append(heading);
      const timer=node('div','room-minigame-timer');timer.setAttribute('role','progressbar');timer.setAttribute('aria-label','這一輪剩餘時間');timer.setAttribute('aria-valuemin','0');timer.setAttribute('aria-valuemax','100');timer.append(node('span'));stage.append(timer);
      const hint=node('p','room-minigame-hint');hint.id='roomMinigameHint';stage.append(hint);
      if(kind==='work') {
        const belt=node('div','room-minigame-belt');challenge.crates.forEach((crate,index)=>{
          const label={food:'食材箱',tools:'工具箱',books:'書籍航圖箱'}[crate.category];const cargo=button('',()=>selectCargo(index),'room-minigame-cargo');cargo.dataset.index=String(index);cargo.setAttribute('aria-pressed','false');cargo.setAttribute('aria-label',`${index+1}：${label}`);
          const art=node('img');art.src=`${ASSET}minigames_v1/cargo-${crate.category}.webp`;art.alt='';art.draggable=false;cargo.append(node('kbd','',String(index+1)),art,node('strong','',label),node('span','room-minigame-cargo-state','點選裝船'));belt.append(cargo);
        });stage.append(belt);stage.append(button('裝船 · Enter',()=>void submit(),'room-minigame-primary room-minigame-submit'));
      }else {
        const lanes=node('div','room-minigame-lanes');for(const dir of DIRS){const lane=node('div','room-minigame-lane');lane.dataset.direction=dir;lane.append(node('span','room-minigame-lane-arrow',ARROWS[dir]),node('span','room-minigame-lane-name',DIR_NAMES[dir]));lanes.append(lane);}const token=node('canvas','room-minigame-runner');token.setAttribute('role','img');token.setAttribute('aria-label',voice().name+'完整人物');token.dataset.lane='up';lanes.append(token);stage.append(lanes);actorLane=1;actorStep=null;cancelAnimationFrame(actorFrame);actorFrame=requestAnimationFrame(paintActor);
        const steps=node('div','room-minigame-steps');for(let i=0;i<challenge.directions.length;i++){const dot=node('span','',String(i+1));dot.setAttribute('aria-label',`第 ${i+1} 步`);steps.append(dot);}stage.append(steps);
        const controls=node('div','room-minigame-directions');for(const dir of DIRS){const b=button(ARROWS[dir],()=>inputDirection(dir),'room-minigame-direction');b.dataset.direction=dir;b.setAttribute('aria-label',DIR_NAMES[dir]);controls.append(b);}stage.append(controls);
      }
      if(game.feedback){const result=node('div',`room-minigame-round-result ${game.feedback.correct?'correct':'miss'}`,game.feedback.correct?'上一輪完整通過！':'上一輪有遺漏或失誤，穩住再來。');stage.append(result);}
      stage.querySelectorAll('button').forEach(b=>{b.disabled=true;});
      layer.focus({preventScroll:true});
    }
    function selectCargo(index){if(phase!=='answer'||requesting||kind!=='work')return;const id=game.challenge.crates[index]?.id;if(!id)return;choice=choice.includes(id)?choice.filter(x=>x!==id):[...choice,id];const b=body.querySelector(`[data-index="${index}"]`);b.setAttribute('aria-pressed',String(choice.includes(id)));b.querySelector('.room-minigame-cargo-state').textContent=choice.includes(id)?'已選 · 再點取消':'點選裝船';}
    function inputDirection(dir){if(phase!=='answer'||requesting||kind!=='training'||directions.length>=game.challenge.directions.length)return;directions.push(dir);const next=DIRS.indexOf(dir);actorStep={from:actorLane,to:next,started:now(),duration:280,direction:next<actorLane?'west':next>actorLane?'east':'south'};actorLane=next;const dot=body.querySelectorAll('.room-minigame-steps span')[directions.length-1];dot.textContent=ARROWS[dir];dot.classList.add('entered');if(directions.length===game.challenge.directions.length)void submit();}
    function paintActor(time){const canvas=body?.querySelector('.room-minigame-runner');if(!active()||!canvas)return;const elapsed=actorStep?time-actorStep.started:0,ratio=actorStep?clamp(elapsed/actorStep.duration,0,1):1,moving=actorStep&&ratio<1,position=actorStep?actorStep.from+(actorStep.to-actorStep.from)*ratio:actorLane;canvas.style.left=`calc(${21.3+position*28.7}% - 72px)`;const motion=root.OnePieceRoomMotion,atlas=motion?.preload(keyOf(characterId))?.atlases[moving?actorStep.direction:'south'];if(atlas){const frameIndex=moving?Math.floor(elapsed/70)%4:motion.metadata(keyOf(characterId),root.OnePieceRoomMotionManifest).standingFrame;motion.draw(canvas,atlas,frameIndex);canvas.dataset.wholeBody='true';}actorFrame=requestAnimationFrame(paintActor);}
    function tick() {
      if(!active()||!game?.challenge||!['showcase','answer','waiting'].includes(phase))return;
      const challenge=game.challenge,elapsed=now()-roundStart,showcase=Number(challenge.showcaseMs)||700,windowMs=Number(challenge.answerWindowMs)||4500;
      if(phase==='showcase') {
        document.getElementById('roomMinigameHint').textContent=kind==='work'?'補給靠港中，先看訂單…':'看清路線，亮過之後才輪到你。';
        if(kind==='training'){const index=Math.floor(Math.max(0,elapsed-400)/550),lit=elapsed>=400&&elapsed<showcase-150&&(elapsed-400)%550<390?challenge.directions[index]:null;for(const lane of body.querySelectorAll('.room-minigame-lane'))lane.classList.toggle('lit',lane.dataset.direction===lit);body.querySelectorAll('.room-minigame-steps span').forEach((dot,i)=>dot.classList.toggle('showing',!!lit&&i===index));}
        if(elapsed>=showcase){phase='answer';layer.dataset.phase='answer';body.querySelectorAll('.room-minigame-stage button').forEach(b=>{b.disabled=false;});for(const lane of body.querySelectorAll('.room-minigame-lane,.room-minigame-steps span'))lane.classList.remove('lit','showing');document.getElementById('roomMinigameHint').textContent=kind==='work'?'選出所有需要的物資，倒數結束自動裝船。':`輪到你了！依序走完 ${challenge.directions.length} 步。`;}
      }
      const percentage=phase==='showcase'?100:clamp(100*(1-(elapsed-showcase)/windowMs),0,100),timer=body.querySelector('.room-minigame-timer');if(timer){timer.firstChild.style.width=`${percentage}%`;timer.setAttribute('aria-valuenow',String(Math.round(percentage)));}
      if(kind==='work'){const belt=body.querySelector('.room-minigame-belt');if(belt)belt.style.setProperty('--cargo-drift',`${clamp((elapsed/(showcase+windowMs)-.5)*18,-9,9)}px`);}
      if(phase==='answer'&&elapsed>=showcase+windowMs)void submit();
      frame=requestAnimationFrame(tick);
    }
    async function submit() {
      if(phase!=='answer'||requesting)return;phase='waiting';cancelAnimationFrame(frame);const current=generation;
      queued={sessionId:game.id,token:game.token,roundId:game.challenge.id,...kind==='work'?{selections:[...choice]}:{directions:[...directions]}};
      body.querySelectorAll('button').forEach(b=>{b.disabled=true;});say('正在核對這一輪…');
      const wait=Math.max(0,Date.parse(game.challenge.notBefore)-Date.now()+60);if(wait>0)await new Promise(resolve=>setTimeout(resolve,Math.min(wait,10000)));
      if(current!==generation||!active())return;
      await sendAnswer();
    }
    async function sendAnswer(){if(!queued)return;const response=await request('minigame.answer',queued);if(!response)return;const recovered=response.error==='minigame_round_conflict'&&response.minigame?.id===game.id&&response.minigame.roundIndex>game.roundIndex;if(response.ok||recovered){queued=null;accept(response);}else if(response.minigame&&['expired','cancelled','invalidated'].includes(response.minigame.state))accept(response);else showRetry(response);}
    function showRetry(response) {
      if(response?.error==='wallet_full'){phase='rewardPending';cancelAnimationFrame(frame);body.replaceChildren(node('h3','','成果已保留，錢包需要空間'),node('p','','商城錢包至少需要空出 10 枚金幣。購物後再從工作入口回來，即可結算這場成果；不會重複使用工作次數。'),button('保留成果，返回房間',()=>closeLocal()));say('成果已保留。購物後再從工作入口回來領取即可。');return;}
      const messages={needs_rest:'夥伴有些累了，先休息恢復精神，再開始訓練。',interaction_cooldown:'夥伴需要休息一下，訓練冷卻結束後再來；也可選擇自由練習。',invalid_minigame_session:'這場挑戰已失效或不屬於目前帳號，請關閉後重新開始。',minigame_too_early:'稍候片刻再送出，這一輪正在完成判定。',minigame_round_conflict:'挑戰進度已更新，請關閉後重新進入以讀取最新進度。'};
      phase='retry';cancelAnimationFrame(frame);const text=ERRORS[response?.error]||'這次送出未完成。可再次送出，已確認的成果不會重複計算。';say(text);
      if(messages[response?.error]){say(messages[response.error]);body.replaceChildren(node('p','',messages[response.error]),button('返回房間',()=>closeLocal()));return;}
      const old=body.querySelector('.room-minigame-retry');old?.remove();const strip=node('div','room-minigame-retry');strip.append(node('p','',text),button(queued?'重新送出這一輪':'重新結算',()=>void (queued?sendAnswer():finish())));body.append(strip);
    }
    async function finish(){phase='waiting';cancelAnimationFrame(frame);body.replaceChildren(node('h3','','挑戰完成，正在結算…'));say('成果確認後才會發放獎勵。');const current=generation,wait=Math.max(0,Date.parse(game.finishNotBefore)-Date.now()+60);if(wait>0)await new Promise(resolve=>setTimeout(resolve,Math.min(wait,30000)));if(current!==generation||!active())return;const response=await request('minigame.finish',{sessionId:game.id,token:game.token});if(!response)return;if(response.ok)accept(response);else showRetry(response);}
    function renderResult() {
      const resultKey=`${game.id}:${game.attempt||1}`;if(lastResult===resultKey)return;lastResult=resultKey;phase='result';cancelAnimationFrame(frame);const result=game.result||{};body.replaceChildren();const box=node('div',`room-minigame-result ${result.passed?'passed':''}`);box.append(node('span','room-minigame-eyebrow',result.passed?'CHALLENGE CLEAR':'KEEP PRACTICING'),node('h3','',result.passed?'配合成功！':'差一點，再調整步調。'),node('p','',`完整通過 ${result.correctRounds||0} / ${result.totalRounds||game.totalRounds} 輪`));
      const rewards=node('div','room-minigame-rewards');rewards.append(node('strong','',game.practice?'自由練習 · 不領獎勵':result.coins?`商城金幣 +${result.coins}`:kind==='work'?'本次沒有金幣獎勵':'工作意願 +'+(result.workMotivation||0)));if(result.affinity)rewards.append(node('span','',`親密度 +${result.affinity}`));box.append(rewards,node('p','room-minigame-cost',result.canRetry?`還有 ${result.attemptsRemaining} 次免費重試，不再消耗工作次數或精神。`:game.practice?'自由練習不消耗精神。':kind==='work'?'本次已使用 1 次有酬工作。下一場會重新計次。':'本次已消耗 6 點精神。夥伴需要休息 10 分鐘再訓練。'));
      const row=node('div','room-minigame-result-actions');row.append(button('返回房間',()=>void askClose()));if(result.canRetry)row.append(button('再試一次 · 不額外消耗',()=>void retryAttempt(),'room-minigame-secondary'));else if(kind==='training')row.append(button('再練一次 · 不領獎',()=>{game=null;practice=true;lastResult='';lastRound='';lastFeedback=-1;renderIntro();},'room-minigame-secondary'));else row.append(button('查看下一場規則',()=>{game=null;lastResult='';lastRound='';lastFeedback=-1;renderIntro();},'room-minigame-secondary'));box.append(row);body.append(box);say(result.passed?voice().win:reaction('miss'));options.onResult?.(game);row.firstChild.focus({preventScroll:true});
    }
    function renderEnded(){phase='ended';cancelAnimationFrame(frame);body.replaceChildren(node('h3','','這場挑戰已結束'),node('p','','没有發放未完成的獎勵。下次開始前可再確認消耗與規則。'),button('返回房間',()=>closeLocal()));say(game.state==='expired'?'挑戰逾時，夥伴先回房間了。':'下回再一起挑戰吧。');}
    async function cancel(close=true){if(requesting)return;const response=await request('minigame.cancel',{sessionId:game.id,token:game.token});if(!response)return;if(response.ok){if(close)closeLocal();else{game=null;lastRound='';renderIntro();}}else{say(ERRORS[response.error]||'暫時無法確認取消，重新連線後再試。');}}
    async function retryAttempt(){const response=await request('minigame.retry',{sessionId:game.id,token:game.token});if(!response)return;if(response.ok||response.minigame?.id===game.id&&response.minigame.attempt>game.attempt){lastFeedback=-1;lastRound='';queued=null;accept(response);}else say(ERRORS[response.error]||'現在無法重新開始，請稍後再試。');}
    async function askClose(){if(requesting)return;if(!game||!['playing','ready','failed'].includes(game.state)){closeLocal();return;}if(body.querySelector('.room-minigame-confirm'))return;const confirm=node('div','room-minigame-confirm');confirm.append(node('h3','','結束這場挑戰？'),node('p','',game.practice?'結束這次自由練習，不會領取獎勵。':kind==='work'?'工作次數不會退回。關閉確認視窗時，本輪計時仍會繼續。':'精神與訓練冷卻會保留。關閉確認視窗時，本輪計時仍會繼續。'),button('結束並回房間',()=>void cancel(true)),button('繼續挑戰',()=>confirm.remove(),'room-minigame-secondary'));body.append(confirm);confirm.querySelector('button').focus({preventScroll:true});}
    function closeLocal(){generation++;cancelAnimationFrame(frame);cancelAnimationFrame(actorFrame);phase='closed';game=null;queued=null;requesting=false;if(layer)layer.hidden=true;safeResume();if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});}
    function dismiss(){if(!active())return;const old=game;if(old&&['playing','ready','failed'].includes(old.state)&&!requesting)void options.command('minigame.cancel',{sessionId:old.id,token:old.token});closeLocal();}
    function keyDown(event){if(event.key==='Tab'){const available=[...layer.querySelectorAll('button:not(:disabled)')].filter(n=>!n.hidden&&n.getClientRects().length);if(!available.length){event.preventDefault();return;}const first=available[0],last=available[available.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}return;}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();void askClose();return;}if(event.repeat)return;if(kind==='work'&&/^[123]$/.test(event.key)){event.preventDefault();selectCargo(Number(event.key)-1);}else if(kind==='work'&&event.key==='Enter'&&phase==='answer'){event.preventDefault();void submit();}else if(kind==='training'){const dir={ArrowLeft:'left',ArrowUp:'up',ArrowRight:'right'}[event.key];if(dir){event.preventDefault();inputDirection(dir);}}}
    // A challenge keeps its clock while unfocused. No free restart or offscreen reward.
    root.addEventListener('blur',()=>{windowFocused=false;});root.addEventListener('focus',()=>{windowFocused=true;});
    return Object.freeze({open,dismiss,active,receive:response=>{if(active()&&game&&response?.minigame?.id===game.id&&['expired','invalidated','cancelled'].includes(response.minigame.state))accept(response);},inspect:()=>({phase,kind,characterId,roundIndex:game?.roundIndex,selected:[...choice],entered:[...directions],requesting,windowFocused})});
  }
  root.OnePieceRoomMinigames=Object.freeze({create,VOICES});
})(window);
