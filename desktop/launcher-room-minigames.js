/* Short, server-scored crew challenges. Art stays in the existing asset pipeline. */
(function(root) {
  'use strict';
  const ASSET='opui://launcher/images/launcher_room/';
  const keyOf=value=>String(value||'').replace(/^room-character-/,'');
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
  const DIRS=['left','up','right'];
  const ARROWS={left:'←',up:'↑',right:'→'};
  const DIR_NAMES={left:'左側',up:'中央',right:'右側'};
  const JOBS=Object.freeze({
    supply:{title:'海上補給',guide:'一起裝船',short:'挑選物資',round:'補給',description:'看清訂單，把對的物資全數裝船。',rules:['共 8 輪補給，勾選每張訂單要求的全部物資；不需要的留在原位。','點箱子或按 1／2／3 切換選取；倒數結束裝船，也可按 Enter 提早交卷。','後半段會加快。完全配對 6 輪即可過關，連續正確會累積連擊。']},
    cooking:{title:'香吉士的出餐考驗',guide:'廚房幫手',short:'食材順序',round:'訂單',description:'依照食譜順序備料，讓大家準時開飯。',rules:['共 8 張訂單，依上方食譜，按順序點選食材；同一種食材可以加入多次。','點食材或按 1～6；點「退回一份」或按 Backspace 修正，Enter 出餐。','每張訂單限時 10 秒，完成 6 張即可過關。看清楚再動手，不浪費食材！']},
    repair:{title:'佛朗基的管路檢修',guide:'船塢助手',short:'旋轉接管',round:'管路',description:'轉動管線，讓左側入口一路接到右側出口。',rules:['共 8 面管路板。直管與彎管每點一次順時針轉 90 度；不需要用到全部管線。','點管線或按 1～9 轉動，接好後點「測試通水」或按 Enter。','每面限時 18 秒，修好 6 面即可過關。兩端開口要對齊，相鄰管線才接得上。']},
    navigation:{title:'娜美的航線演練',guide:'航海助手',short:'避礁規劃',round:'航線',description:'避開暗礁，用有限的步數畫出抵達港口的航線。',rules:['共 8 張海圖。從起點逐格點選上下左右相鄰海域，避開暗礁，抵達港口。','可以使用方向鍵移動；點前一格或按 Backspace 退回，Enter 確認出航。','每張海圖限時 16 秒，不能重走格子或超過步數上限。完成 6 張即可過關。']}
  });
  const JOB_LINES={
    cooking:{luffy:'香吉士說得照食譜來……我會忍住不偷吃啦！',zoro:'切好的食材放哪？你報順序，我來備料。',nami:'先照食譜備好，別讓魯夫把晚餐吃光了。',usopp:'這可是大廚騙人布的……咳，香吉士寫的食譜！',sanji:'照順序備料，火候我來顧。可別糟蹋食物。',chopper:'蔬菜也要吃喔！我來幫忙把食材排好。',robin:'呵呵，晚餐的線索都寫在食譜上了。',franky:'備料也得 SUPER 俐落！別把我的可樂倒進鍋裡啊。',brook:'讓我幫忙備料，晚餐後再為大家演奏吧。',jinbe:'照著食譜慢慢來，廚房也講究彼此配合。',ace:'我也來幫忙。放心，還沒開飯我不會先睡著。'},
    repair:{luffy:'這根要轉過來？好！修好了就能繼續冒險！',zoro:'這次只看管線的方向是吧。指出入口，我來接。',nami:'漏水可不是小事，照佛朗基的圖把它接好。',usopp:'小修小補我也很在行！先把兩邊的開口對準。',sanji:'廚房用水可不能停。這邊接穩了再試。',chopper:'原來管線也會不舒服啊……我們把它修好！',robin:'順著入口往前看，斷開的地方就找到了。',franky:'SUPER！把管口接穩，桑尼號就能順暢運轉！',brook:'把每一段接起來，就像樂句彼此呼應呢。',jinbe:'水路通暢，船上才安穩。先看清楚流向吧。',ace:'這種活交給雙手就好，可不能把管子燒壞了。'},
    navigation:{luffy:'娜美畫的海圖！你指路，我們一起往港口走！',zoro:'照你畫的走。這回我不另找近路。',nami:'看清楚暗礁和剩餘步數。可別讓船繞遠路！',usopp:'那片暗礁可不是我吹的！我們從安全的海面過去。',sanji:'娜美小姐的海圖我收好了。先確認安全的航線。',chopper:'我們避開礁石吧，大家平安到港最重要！',robin:'沿著海圖找找看，安全的路往往藏在細節裡。',franky:'桑尼號很結實，也不能拿船底去撞礁石啊！',brook:'安全抵達後，就為港口的朋友奏一首吧。',jinbe:'先看海面，再看暗礁。穩穩把船帶進港。',ace:'海上的路可不少。這回聽你指揮，避開那片礁石。'}
  };
  const PIPE_SIDES=['north','east','south','west'];
  const SIDE_NAMES={north:'上',east:'右',south:'下',west:'左'};
  const pipeSides=(tile,rotation)=> (tile.type==='straight'?[0,2]:[0,1]).map(side=>PIPE_SIDES[(side+rotation)%4]);
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
    let game=null,kind='',jobId='supply',characterId='',phase='closed',generation=0,frame=0,requesting=false,queued=null,roundStart=0,choice=[],directions=[],ingredients=[],rotations=[],course=[],previousFocus=null,lastRound='',lastResult='',lastFeedback=-1;
    let held=false,windowFocused=true,practice=false,actorFrame=0,actorStep=null,actorLane=1;
    const reactionCounts={good:0,miss:0};
    const now=()=>performance.now();
    const voice=()=>VOICES[keyOf(characterId)]||VOICES.luffy;
    const job=()=>JOBS[jobId]||JOBS.supply;
    const introLine=()=>kind==='training'?voice().training:JOB_LINES[jobId]?.[keyOf(characterId)]||voice().work;
    function updateTitle(){document.getElementById('roomMinigameTitle').textContent=kind==='work'?job().title:'甲板特訓';}
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
      jobId=JOBS[input.jobId]?input.jobId:'supply';held=true;options.onOpen?.(characterId);layer.hidden=false;updateTitle();document.getElementById('roomMinigameName').textContent=voice().name;document.getElementById('roomMinigamePortrait').src=portraitUrl();progress.replaceChildren();say(introLine());renderIntro();return true;
    }
    function button(label,fn,className='room-minigame-primary'){const b=node('button',className,label);b.type='button';b.onclick=fn;return b;}
    function renderIntro(message='') {
      phase='intro';body.replaceChildren();const intro=node('div','room-minigame-intro');
      if(kind==='work'){
        const choices=node('div','room-minigame-jobs');choices.setAttribute('role','group');choices.setAttribute('aria-label','選擇工作');
        for(const [id,definition] of Object.entries(JOBS)){const option=button('',()=>{if(requesting)return;jobId=id;updateTitle();say(introLine());renderIntro();body.querySelector(`[data-job="${id}"]`)?.focus({preventScroll:true});},'room-minigame-job');option.dataset.job=id;option.setAttribute('aria-pressed',String(id===jobId));option.append(node('span','room-minigame-job-guide',definition.guide),node('strong','',definition.title),node('span','',definition.short));choices.append(option);}
        intro.append(choices,node('p','room-minigame-shared-budget','四種工作共用每日有酬次數，每次過關獲得 10 枚商城金幣。'));
      }
      intro.append(node('h3','',kind==='work'?job().description:'看過安全路線，再用腳步記住它。'));
      const rules=node('ol');for(const text of kind==='work'?job().rules:['共 4 段航道。先看依序亮起的安全位置，再照順序走。','使用 ←／↑／→ 或畫面上的三個方向鍵；↑ 代表中央航道。','路線由 3 步增至 5 步。完整通過 3 段即可過關，沒有戰鬥能力限制。'])rules.append(node('li','',text));intro.append(rules);
      const warning=node('p','room-minigame-cost',practice?'自由練習不消耗精神，不受冷卻限制，也不領取獎勵。':kind==='work'?'開始後會占用 1 次當日有酬工作；中途結束也會計次。過關可得 10 枚商城金幣與親密度。不及格可在同一場免費重試 2 次。':'開始會消耗 6 點精神並進入 10 分鐘訓練冷卻；中途結束也會計入。過關可提升工作意願與親密度。不及格可在同一場免費重試 2 次。');intro.append(warning);
      const budget=options.workBudget?.(characterId);if(kind==='work'&&budget)intro.append(node('p','room-minigame-budget',`今日剩餘：全帳號最多 ${budget.remainingStartsToday} 次，這位夥伴 ${budget.characterStartsRemainingToday} 次。`));
      if(message)intro.append(node('p','room-minigame-error',message));intro.append(button('準備好了 · 開始挑戰',()=>void start()));if(kind==='training'&&!practice)intro.append(button('先自由練習 · 不領獎',()=>{practice=true;renderIntro();},'room-minigame-secondary'));body.append(intro);body.querySelector('.room-minigame-primary')?.focus({preventScroll:true});
    }
    async function request(type,payload={}) {
      if(requesting)return null;requesting=true;setDisabled(true);const current=generation;
      try {const response=await options.command(type,payload);if(current!==generation)return null;return response||{ok:false,error:'offline'};}
      catch{return current===generation?{ok:false,error:'offline'}:null;}
      finally{if(current===generation){requesting=false;setDisabled(false);}}
    }
    function setDisabled(value){if(!layer)return;layer.dataset.pending=String(value);for(const b of body.querySelectorAll('button'))b.disabled=value||b.dataset.permanentDisabled==='true';}
    async function start(){if(phase!=='intro')return;const response=await request('minigame.start',{characterId,kind,...kind==='work'?{jobId}:{},...practice?{practice:true}:{}});if(!response)return;if(response.minigame&&['playing','ready','failed'].includes(response.minigame.state)){game=response.minigame;if(game.characterId!==characterId||game.kind!==kind){renderRecovery();return;}accept(response);return;}renderIntro(ERRORS[response.error]||response.message||'暫時無法開始，請稍候再試。');}
    function renderRecovery(){phase='recovery';body.replaceChildren(node('h3','','上一次挑戰尚未結束'),node('p','','結束舊挑戰後，即可重新選擇夥伴。原本消耗的工作次數或精神不會退回。'),button('結束舊挑戰',()=>void cancel(false)));say('不會自動領取獎勵。');}
    function accept(response) {
      if(!response?.minigame){showRetry(response);return;}
      game=response.minigame;
      if(kind==='work'){jobId=JOBS[game.jobId]?game.jobId:'supply';updateTitle();}
      if(game.feedback&&game.feedback.roundIndex!==lastFeedback){lastFeedback=game.feedback.roundIndex;say(reaction(game.feedback.correct?'good':'miss'));}
      progress.textContent=`${kind==='work'?job().round:'航道'} ${Math.min(game.roundIndex+1,game.totalRounds)} / ${game.totalRounds}　｜　完成 ${game.correctRounds||0}　｜　連擊 ${game.combo||0}`;
      if(['completed','failed'].includes(game.state)){renderResult();return;}
      if(!['playing','ready'].includes(game.state)){renderEnded();return;}
      if(game.state==='ready'||!game.challenge){void finish();return;}
      if(lastRound===game.challenge.id)return;
      lastRound=game.challenge.id;choice=[];directions=[];ingredients=[];rotations=game.challenge.tiles?.map(tile=>tile.rotation)||[];course=Number.isInteger(game.challenge.start)?[game.challenge.start]:[];queued=null;roundStart=now();phase='showcase';renderRound();cancelAnimationFrame(frame);frame=requestAnimationFrame(tick);
    }
    function renderRound() {
      body.replaceChildren();const challenge=game.challenge;
      const stage=node('div',`room-minigame-stage ${kind} ${kind==='work'?'job-'+jobId:''}`);stage.dataset.round=String(game.roundIndex);body.append(stage);
      const heading=node('div','room-minigame-order');heading.append(node('span','room-minigame-round-number',`0${game.roundIndex+1}`));
      heading.append(node('strong','',kind!=='work'?'記住安全航道':jobId==='supply'?`這一批需要：${challenge.order?.label||{food:'食材',tools:'工具',books:'書籍'}[challenge.order?.category]||'補給'}`:jobId==='cooking'?challenge.recipeLabel||'依序備好食材':jobId==='repair'?'入口 → 接通管線 → 出口':'避開暗礁，抵達港口'));stage.append(heading);
      const timer=node('div','room-minigame-timer');timer.setAttribute('role','progressbar');timer.setAttribute('aria-label','這一輪剩餘時間');timer.setAttribute('aria-valuemin','0');timer.setAttribute('aria-valuemax','100');timer.append(node('span'));stage.append(timer);
      const hint=node('p','room-minigame-hint');hint.id='roomMinigameHint';stage.append(hint);
      if(kind==='work'&&jobId==='supply') {
        const belt=node('div','room-minigame-belt');challenge.crates.forEach((crate,index)=>{
          const label={food:'食材箱',tools:'工具箱',books:'書籍航圖箱'}[crate.category];const cargo=button('',()=>selectCargo(index),'room-minigame-cargo');cargo.dataset.index=String(index);cargo.setAttribute('aria-pressed','false');cargo.setAttribute('aria-label',`${index+1}：${label}`);
          const art=node('img');art.src=`${ASSET}minigames_v1/cargo-${crate.category}.webp`;art.alt='';art.draggable=false;cargo.append(node('kbd','',String(index+1)),art,node('strong','',label),node('span','room-minigame-cargo-state','點選裝船'));belt.append(cargo);
        });stage.append(belt);stage.append(button('裝船 · Enter',()=>void submit(),'room-minigame-primary room-minigame-submit'));
      }else if(kind==='work') {
        if(jobId==='cooking')renderCooking(stage,challenge);
        else if(jobId==='repair')renderRepair(stage,challenge);
        else renderNavigation(stage,challenge);
      }else {
        const lanes=node('div','room-minigame-lanes');for(const dir of DIRS){const lane=node('div','room-minigame-lane');lane.dataset.direction=dir;lane.append(node('span','room-minigame-lane-arrow',ARROWS[dir]),node('span','room-minigame-lane-name',DIR_NAMES[dir]));lanes.append(lane);}const token=node('canvas','room-minigame-runner');token.setAttribute('role','img');token.setAttribute('aria-label',voice().name+'完整人物');token.dataset.lane='up';lanes.append(token);stage.append(lanes);actorLane=1;actorStep=null;cancelAnimationFrame(actorFrame);actorFrame=requestAnimationFrame(paintActor);
        const steps=node('div','room-minigame-steps');for(let i=0;i<challenge.directions.length;i++){const dot=node('span','',String(i+1));dot.setAttribute('aria-label',`第 ${i+1} 步`);steps.append(dot);}stage.append(steps);
        const controls=node('div','room-minigame-directions');for(const dir of DIRS){const b=button(ARROWS[dir],()=>inputDirection(dir),'room-minigame-direction');b.dataset.direction=dir;b.setAttribute('aria-label',DIR_NAMES[dir]);controls.append(b);}stage.append(controls);
      }
      if(game.feedback){const result=node('div',`room-minigame-round-result ${game.feedback.correct?'correct':'miss'}`,game.feedback.correct?'上一輪完整通過！':'上一輪有遺漏或失誤，穩住再來。');stage.append(result);}
      stage.querySelectorAll('button').forEach(b=>{b.disabled=true;});
      layer.focus({preventScroll:true});
    }
    function renderCooking(stage,challenge){
      const recipe=node('ol','room-minigame-recipe');recipe.setAttribute('aria-label','食譜順序');
      for(const [index,id] of challenge.recipe.entries()){const ingredient=challenge.ingredients.find(value=>value.id===id);const item=node('li');item.append(node('small','',String(index+1)),node('span','',ingredient?.label||id));recipe.append(item);}stage.append(recipe);
      const tray=node('div','room-minigame-prep');tray.setAttribute('aria-label','目前備料順序');for(let index=0;index<challenge.recipe.length;index++)tray.append(node('span','',`${index+1} · 待備料`));stage.append(tray);
      const controls=node('div','room-minigame-ingredients');challenge.ingredients.forEach((ingredient,index)=>{const b=button('',()=>addIngredient(index),'room-minigame-ingredient');b.dataset.ingredient=ingredient.id;b.append(node('kbd','',String(index+1)),node('strong','',ingredient.label));controls.append(b);});stage.append(controls);
      const actions=node('div','room-minigame-puzzle-actions');actions.append(button('退回一份',()=>undoInput(),'room-minigame-secondary'),button('完成備料 · Enter',()=>void submit()));stage.append(actions);
    }
    function addIngredient(index){if(phase!=='answer'||requesting||jobId!=='cooking'||ingredients.length>=game.challenge.recipe.length)return;const ingredient=game.challenge.ingredients[index];if(!ingredient)return;ingredients.push(ingredient.id);updateIngredients();}
    function updateIngredients(){body.querySelectorAll('.room-minigame-prep span').forEach((slot,index)=>{const id=ingredients[index];slot.textContent=`${index+1} · ${game.challenge.ingredients.find(item=>item.id===id)?.label||'待備料'}`;slot.classList.toggle('filled',!!id);});}
    function pipeGraphic(tile,rotation){
      const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('aria-hidden','true');const points={north:'50 0',east:'100 50',south:'50 100',west:'0 50'};
      for(const [index,width] of [17,7].entries()){const line=document.createElementNS(ns,'path');line.setAttribute('d',pipeSides(tile,rotation).map(side=>`M50 50 L${points[side]}`).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke',index?'#a8e4d6':'#32787c');line.setAttribute('stroke-width',String(width));line.setAttribute('stroke-linecap','round');svg.append(line);}return svg;
    }
    function renderRepair(stage,challenge){
      const board=node('div','room-minigame-pipe-board');board.setAttribute('aria-label','三乘三管路，左側進水，右側出水');
      challenge.tiles.forEach((tile,index)=>{const b=button('',()=>rotatePipe(index),'room-minigame-pipe');b.dataset.pipe=String(index);if(index===challenge.entry.index)b.dataset.entry=challenge.entry.side;if(index===challenge.exit.index)b.dataset.exit=challenge.exit.side;b.append(node('kbd','',String(index+1)),pipeGraphic(tile,rotations[index]));board.append(b);});stage.append(board);updatePipes();
      const legend=node('p','room-minigame-puzzle-note','左側金色標記是入口，右側是出口。點一格轉 90°。');stage.append(legend);
      const actions=node('div','room-minigame-puzzle-actions');actions.append(button('還原管線',()=>{if(phase!=='answer'||requesting)return;rotations=challenge.tiles.map(tile=>tile.rotation);updatePipes();},'room-minigame-secondary'),button('測試通水 · Enter',()=>void submit()));stage.append(actions);
    }
    function rotatePipe(index){if(phase!=='answer'||requesting||jobId!=='repair'||!game.challenge.tiles[index])return;rotations[index]=(rotations[index]+1)%4;updatePipes();}
    function updatePipes(){body.querySelectorAll('.room-minigame-pipe').forEach((b,index)=>{const tile=game.challenge.tiles[index];b.querySelector('svg').replaceWith(pipeGraphic(tile,rotations[index]));b.setAttribute('aria-label',`管線 ${index+1}，${tile.type==='straight'?'直管':'彎管'}，開口朝${pipeSides(tile,rotations[index]).map(side=>SIDE_NAMES[side]).join('、')}，點一下順時針旋轉`);b.dataset.rotation=String(rotations[index]);});}
    function renderNavigation(stage,challenge){
      const board=node('div','room-minigame-chart');board.setAttribute('aria-label','四乘四海圖');
      for(let index=0;index<challenge.size*challenge.size;index++){const reef=challenge.blocked.includes(index),b=button('',()=>plotCourse(index),'room-minigame-sea-cell');b.dataset.cell=String(index);b.dataset.reef=String(reef);if(reef){b.dataset.permanentDisabled='true';b.disabled=true;}const label=index===challenge.start?'起點':index===challenge.goal?'港口':reef?'暗礁':'海面';b.dataset.label=label;b.setAttribute('aria-label',`海圖第 ${Math.floor(index/challenge.size)+1} 列第 ${index%challenge.size+1} 格，${label}`);b.append(node('span','room-minigame-cell-label',label),node('strong','room-minigame-cell-order',''));board.append(b);}stage.append(board);
      stage.append(node('p','room-minigame-course-budget'));const actions=node('div','room-minigame-puzzle-actions');actions.append(button('退回一格',()=>undoInput(),'room-minigame-secondary'),button('重畫航線',()=>{if(phase!=='answer'||requesting)return;course=[challenge.start];updateCourse();},'room-minigame-secondary'),button('確認出航 · Enter',()=>void submit()));stage.append(actions);updateCourse();
    }
    function plotCourse(index){
      if(phase!=='answer'||requesting||jobId!=='navigation')return;const challenge=game.challenge,last=course[course.length-1];
      if(index===course[course.length-2]){course.pop();updateCourse();return;}
      if(index<0||index>=challenge.size*challenge.size||challenge.blocked.includes(index)||course.includes(index))return;
      const adjacent=Math.abs(Math.floor(last/challenge.size)-Math.floor(index/challenge.size))+Math.abs(last%challenge.size-index%challenge.size)===1;
      if(!adjacent){say('先從目前的位置，走到上下左右相鄰的一格。');return;}if(course.length-1>=challenge.maxSteps){say('步數用完了，退回幾格重新規劃吧。');return;}
      course.push(index);updateCourse();
    }
    function updateCourse(){body.querySelectorAll('.room-minigame-sea-cell').forEach((b,index)=>{const order=course.indexOf(index),current=index===course[course.length-1];b.classList.toggle('on-course',order>=0);b.classList.toggle('current',current);b.setAttribute('aria-pressed',String(order>=0));b.querySelector('.room-minigame-cell-order').textContent=order<0?'':order===0?'起':String(order);});const budget=body.querySelector('.room-minigame-course-budget');if(budget)budget.textContent=`已走 ${course.length-1} / ${game.challenge.maxSteps} 步　·　${course.at(-1)===game.challenge.goal?'已抵達港口，可以確認出航。':'沿著相鄰海面，前往港口。'}`;}
    function undoInput(){if(phase!=='answer'||requesting)return;if(jobId==='cooking'){ingredients.pop();updateIngredients();}else if(jobId==='navigation'&&course.length>1){course.pop();updateCourse();}}
    function selectCargo(index){if(phase!=='answer'||requesting||kind!=='work'||jobId!=='supply')return;const id=game.challenge.crates[index]?.id;if(!id)return;choice=choice.includes(id)?choice.filter(x=>x!==id):[...choice,id];const b=body.querySelector(`[data-index="${index}"]`);b.setAttribute('aria-pressed',String(choice.includes(id)));b.querySelector('.room-minigame-cargo-state').textContent=choice.includes(id)?'已選 · 再點取消':'點選裝船';}
    function inputDirection(dir){if(phase!=='answer'||requesting||kind!=='training'||directions.length>=game.challenge.directions.length)return;directions.push(dir);const next=DIRS.indexOf(dir);actorStep={from:actorLane,to:next,started:now(),duration:280,direction:next<actorLane?'west':next>actorLane?'east':'south'};actorLane=next;const dot=body.querySelectorAll('.room-minigame-steps span')[directions.length-1];dot.textContent=ARROWS[dir];dot.classList.add('entered');if(directions.length===game.challenge.directions.length)void submit();}
    function paintActor(time){const canvas=body?.querySelector('.room-minigame-runner');if(!active()||!canvas)return;const elapsed=actorStep?time-actorStep.started:0,ratio=actorStep?clamp(elapsed/actorStep.duration,0,1):1,moving=actorStep&&ratio<1,position=actorStep?actorStep.from+(actorStep.to-actorStep.from)*ratio:actorLane;canvas.style.left=`calc(${21.3+position*28.7}% - 72px)`;const motion=root.OnePieceRoomMotion,atlas=motion?.preload(keyOf(characterId))?.atlases[moving?actorStep.direction:'south'];if(atlas){const frameIndex=moving?Math.floor(elapsed/70)%4:motion.metadata(keyOf(characterId),root.OnePieceRoomMotionManifest).standingFrame;motion.draw(canvas,atlas,frameIndex);canvas.dataset.wholeBody='true';}actorFrame=requestAnimationFrame(paintActor);}
    function tick() {
      if(!active()||!game?.challenge||!['showcase','answer','waiting'].includes(phase))return;
      const challenge=game.challenge,elapsed=now()-roundStart,showcase=Number(challenge.showcaseMs)||700,windowMs=Number(challenge.answerWindowMs)||4500;
      if(phase==='showcase') {
        document.getElementById('roomMinigameHint').textContent=kind!=='work'?'看清路線，亮過之後才輪到你。':({supply:'補給靠港中，先看訂單…',cooking:'先看食譜順序，準備開始備料。',repair:'先找入口、出口，再觀察管口方向。',navigation:'先看港口和暗礁，準備規劃航線。'}[jobId]);
        if(kind==='training'){const index=Math.floor(Math.max(0,elapsed-400)/550),lit=elapsed>=400&&elapsed<showcase-150&&(elapsed-400)%550<390?challenge.directions[index]:null;for(const lane of body.querySelectorAll('.room-minigame-lane'))lane.classList.toggle('lit',lane.dataset.direction===lit);body.querySelectorAll('.room-minigame-steps span').forEach((dot,i)=>dot.classList.toggle('showing',!!lit&&i===index));}
        if(elapsed>=showcase){phase='answer';layer.dataset.phase='answer';body.querySelectorAll('.room-minigame-stage button').forEach(b=>{b.disabled=b.dataset.permanentDisabled==='true';});for(const lane of body.querySelectorAll('.room-minigame-lane,.room-minigame-steps span'))lane.classList.remove('lit','showing');document.getElementById('roomMinigameHint').textContent=kind!=='work'?`輪到你了！依序走完 ${challenge.directions.length} 步。`:({supply:'選出所有需要的物資，倒數結束自動裝船。',cooking:'依序備料，可退回修正；備好後按 Enter。',repair:'轉動管線，把入口和出口接通，再測試通水。',navigation:'走相鄰海面避開暗礁；到港後按 Enter 確認。'}[jobId]);}
      }
      const percentage=phase==='showcase'?100:clamp(100*(1-(elapsed-showcase)/windowMs),0,100),timer=body.querySelector('.room-minigame-timer');if(timer){timer.firstChild.style.width=`${percentage}%`;timer.setAttribute('aria-valuenow',String(Math.round(percentage)));}
      if(kind==='work'){const belt=body.querySelector('.room-minigame-belt');if(belt)belt.style.setProperty('--cargo-drift',`${clamp((elapsed/(showcase+windowMs)-.5)*18,-9,9)}px`);}
      if(phase==='answer'&&elapsed>=showcase+windowMs)void submit();
      frame=requestAnimationFrame(tick);
    }
    async function submit() {
      if(phase!=='answer'||requesting)return;phase='waiting';cancelAnimationFrame(frame);const current=generation;
      const answer=kind!=='work'?{directions:[...directions]}:jobId==='supply'?{selections:[...choice]}:jobId==='cooking'?{ingredients:[...ingredients]}:jobId==='repair'?{rotations:[...rotations]}:{path:[...course]};
      queued={sessionId:game.id,token:game.token,roundId:game.challenge.id,...answer};
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
    async function askClose(){if(requesting)return;if(!game||!['playing','ready','failed'].includes(game.state)){closeLocal();return;}if(body.querySelector('.room-minigame-confirm'))return;const confirm=node('div','room-minigame-confirm');confirm.append(node('h3','','結束這場挑戰？'),node('p','',game.practice?'結束這次自由練習，不會領取獎勵。':kind==='work'?'工作次數不會退回。關閉確認視窗時，本輪計時仍會繼續。':'精神與訓練冷卻會保留。關閉確認視窗時，本輪計時仍會繼續。'),button('結束並回房間',()=>void cancel(true)),button('繼續挑戰',()=>{confirm.remove();layer.focus({preventScroll:true});},'room-minigame-secondary'));body.append(confirm);confirm.querySelector('button').focus({preventScroll:true});}
    function closeLocal(){generation++;cancelAnimationFrame(frame);cancelAnimationFrame(actorFrame);phase='closed';game=null;queued=null;requesting=false;if(layer)layer.hidden=true;safeResume();if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});}
    function dismiss(){if(!active())return;const old=game;if(old&&['playing','ready','failed'].includes(old.state)&&!requesting)void options.command('minigame.cancel',{sessionId:old.id,token:old.token});closeLocal();}
    function keyDown(event){
      const confirmation=body?.querySelector('.room-minigame-confirm'),focusRoot=confirmation||layer;
      if(event.key==='Tab'){const available=[...focusRoot.querySelectorAll('button:not(:disabled)')].filter(n=>!n.hidden&&n.getClientRects().length);if(!available.length){event.preventDefault();return;}const first=available[0],last=available[available.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}return;}
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();void askClose();return;}if(confirmation||event.repeat)return;
      if(kind==='work'&&phase==='answer'){
        if(/^[1-9]$/.test(event.key)){event.preventDefault();const index=Number(event.key)-1;if(jobId==='supply')selectCargo(index);else if(jobId==='cooking')addIngredient(index);else if(jobId==='repair')rotatePipe(index);}
        else if(event.key==='Enter'){event.preventDefault();void submit();}
        else if(event.key==='Backspace'){event.preventDefault();undoInput();}
        else if(jobId==='navigation'&&event.key.startsWith('Arrow')){const last=course.at(-1),size=game.challenge.size,delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-size,ArrowDown:size}[event.key];if(delta!==undefined){event.preventDefault();plotCourse(last+delta);}}
      }else if(kind==='training'){const dir={ArrowLeft:'left',ArrowUp:'up',ArrowRight:'right'}[event.key];if(dir){event.preventDefault();inputDirection(dir);}}
    }
    // A challenge keeps its clock while unfocused. No free restart or offscreen reward.
    root.addEventListener('blur',()=>{windowFocused=false;});root.addEventListener('focus',()=>{windowFocused=true;});
    return Object.freeze({open,dismiss,active,receive:response=>{if(active()&&game&&response?.minigame?.id===game.id&&['expired','invalidated','cancelled'].includes(response.minigame.state))accept(response);},inspect:()=>({phase,kind,jobId,characterId,roundIndex:game?.roundIndex,selected:[...choice],entered:[...directions],ingredients:[...ingredients],rotations:[...rotations],course:[...course],requesting,windowFocused})});
  }
  root.OnePieceRoomMinigames=Object.freeze({create,VOICES,JOBS});
})(window);
