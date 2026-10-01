/* Short, server-scored crew challenges. Art stays in the existing asset pipeline. */
(function(root) {
  'use strict';
  const ASSET='opui://launcher/images/launcher_room/';
  const FISH_LABELS=Object.freeze({'balloon-catfish':'氣球鯰魚','glistening-saury':'閃亮秋刀魚','smile-jellyfish':'微笑水母','panda-shark':'熊貓鯊'});
  const keyOf=value=>String(value||'').replace(/^room-character-/,'');
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
  const DIRS=['left','up','right'];
  const ARROWS={left:'←',up:'↑',right:'→'};
  const DIR_NAMES={left:'左側',up:'中央',right:'右側'};
  const JOBS=Object.freeze({
    supply:{title:'海上補給',guide:'一起裝船',short:'挑選物資',round:'補給',description:'看清訂單，把對的物資全數裝船。',rules:['共 8 輪補給，勾選每張訂單要求的全部物資；不需要的留在原位。','點箱子或按 1／2／3 切換選取；倒數結束裝船，也可按 Enter 提早交卷。','後半段會加快。完全配對 6 輪即可過關，連續正確會累積連擊。']},
    cooking:{title:'香吉士的出餐考驗',guide:'廚房幫手',short:'食材順序',round:'訂單',description:'依照食譜順序備料，讓大家準時開飯。',rules:['共 8 張訂單，依上方食譜，按順序點選食材；同一種食材可以加入多次。','點食材或按 1～6；點「退回一份」或按 Backspace 修正，Enter 出餐。','每張訂單限時 10 秒，完成 6 張即可過關。看清楚再動手，不浪費食材！']},
    repair:{title:'佛朗基的管路檢修',guide:'船塢助手',short:'旋轉接管',round:'管路',description:'轉動管線，讓左側入口一路接到右側出口。',rules:['共 8 面管路板。直管與彎管每點一次順時針轉 90 度；不需要用到全部管線。','點管線或按 1～9 轉動，接好後點「測試通水」或按 Enter。','每面限時 18 秒，修好 6 面即可過關。兩端開口要對齊，相鄰管線才接得上。']},
    navigation:{title:'娜美的航線演練',guide:'航海助手',short:'避礁規劃',round:'航線',description:'避開暗礁，用有限的步數畫出抵達港口的航線。',rules:['共 8 張海圖。從起點逐格點選上下左右相鄰海域，避開暗礁，抵達港口。','可以使用方向鍵移動；點前一格或按 Backspace 退回，Enter 確認出航。','每張海圖限時 16 秒，不能重走格子或超過步數上限。完成 6 張即可過關。']},
    fishing:{title:'千陽號海釣',guide:'浮標與魚線',short:'拋竿 · 抽竿 · 捲線',round:'釣點',description:'拋出釣竿，盯著大浮標；真正沉入水面才抽竿，再交替捲線與放線。',rules:['共有 3 個釣點，成功釣起 2 次就能收藏一尾作品中出現的魚。可以一直再玩，商城金幣最多持有 500 枚。','點「拋竿」後等魚靠近。浮標輕晃只是試餌；浮標猛地沉下、水花濺起時，按「抽竿」或空白鍵。太早抽竿會驚走魚。','上鉤後按住「捲線」縮短魚的距離；張力變黃、變紅時，鬆開捲線並點「放線」降低張力。張力滿格會斷線。']}
  });
  const JOB_LINES={
    cooking:{luffy:'香吉士說得照食譜來……我會忍住不偷吃啦！',zoro:'切好的食材放哪？你報順序，我來備料。',nami:'先照食譜備好，別讓魯夫把晚餐吃光了。',usopp:'這可是大廚騙人布的……咳，香吉士寫的食譜！',sanji:'照順序備料，火候我來顧。可別糟蹋食物。',chopper:'蔬菜也要吃喔！我來幫忙把食材排好。',robin:'呵呵，晚餐的線索都寫在食譜上了。',franky:'備料也得 SUPER 俐落！別把我的可樂倒進鍋裡啊。',brook:'讓我幫忙備料，晚餐後再為大家演奏吧。',jinbe:'照著食譜慢慢來，廚房也講究彼此配合。',ace:'我也來幫忙。放心，還沒開飯我不會先睡著。',sabo:'先把食材備妥，魯夫才不會趁我們不注意偷吃。',law:'食材按順序來。處理魚的刀具別和其他食材混放。'},
    repair:{luffy:'這根要轉過來？好！修好了就能繼續冒險！',zoro:'這次只看管線的方向是吧。指出入口，我來接。',nami:'漏水可不是小事，照佛朗基的圖把它接好。',usopp:'小修小補我也很在行！先把兩邊的開口對準。',sanji:'廚房用水可不能停。這邊接穩了再試。',chopper:'原來管線也會不舒服啊……我們把它修好！',robin:'順著入口往前看，斷開的地方就找到了。',franky:'SUPER！把管口接穩，桑尼號就能順暢運轉！',brook:'把每一段接起來，就像樂句彼此呼應呢。',jinbe:'水路通暢，船上才安穩。先看清楚流向吧。',ace:'這種活交給雙手就好，可不能把管子燒壞了。',sabo:'佛朗基應該有留下接管圖。先看清楚，再動手。',law:'先找漏點，再對準管口。別把這裡弄成第二間手術室。'},
    navigation:{luffy:'娜美畫的海圖！你指路，我們一起往港口走！',zoro:'照你畫的走。這回我不另找近路。',nami:'看清楚暗礁和剩餘步數。可別讓船繞遠路！',usopp:'那片暗礁可不是我吹的！我們從安全的海面過去。',sanji:'娜美小姐的海圖我收好了。先確認安全的航線。',chopper:'我們避開礁石吧，大家平安到港最重要！',robin:'沿著海圖找找看，安全的路往往藏在細節裡。',franky:'桑尼號很結實，也不能拿船底去撞礁石啊！',brook:'安全抵達後，就為港口的朋友奏一首吧。',jinbe:'先看海面，再看暗礁。穩穩把船帶進港。',ace:'海上的路可不少。這回聽你指揮，避開那片礁石。',sabo:'革命軍也常靠海圖行動。先避開礁石，再決定進港路線。',law:'暗礁的位置看清楚了嗎？別讓草帽當家的臨時改航線。'},
    fishing:{luffy:'魚上鉤了嗎？太好了！香吉士，今晚加菜！',zoro:'別跟魚硬拽。它換方向時再穩住線。',nami:'先看浪和魚線！斷竿的費用可別算到我頭上。',usopp:'這可是勇敢海上戰士的魚竿！喂，先別把我拖下去！',sanji:'先把魚安全釣上來。晚餐要不要用牠，我會看食材決定。',chopper:'牠好像很有力氣！魚線太緊就放鬆一點。',robin:'呵呵，魚影轉彎了。順著牠的動作找空隙吧。',franky:'魚竿可是我調過的！跟浪配合，SUPER 地收線！',brook:'魚影跟著節拍左右游呢。可惜我沒有眼睛，喲呵呵呵！',jinbe:'水流一變，先鬆線。感覺到牠的去向再收竿。',ace:'哈哈，上鉤了！別急著拉斷魚線，慢慢來。',sabo:'魯夫會想直接把魚拉上甲板吧。先別學他，跟著魚的方向調整。',law:'魚往深處衝就鬆線。急著收竿只會讓魚線斷掉。'}
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
    ace:{name:'艾斯',work:'我來搭把手。你顧清單，這邊交給我。',training:'放輕鬆，我陪你走一輪。',good:'不錯嘛！再接下一個！',miss:'沒事，穩一下。還有下一次。',win:'幹得漂亮！謝啦，有你輕鬆多了。'},
    sabo:{name:'薩波',work:'我來搬重的。清單上的數量，麻煩你再核對一遍。',training:'先看清下一步，別讓衝勁蓋過判斷。',good:'判斷得好！接下來也交給你了。',miss:'別急，換個角度再看一次。',win:'辛苦了。這回配合得真不錯。'},
    law:{name:'羅',work:'按清單分類。船上還有別的事，別重搬第二次。',training:'先觀察路線，再行動。無謂的動作省下來。',good:'……不錯，這樣效率高得多。',miss:'停。先把順序理清再動。',win:'完成了。你比草帽當家的更聽得進計畫。'}
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
    ace:{good:['接得漂亮！下一個我看著。','哈哈，有你幫忙真省心。'],miss:['別皺眉，重新看一遍就好。','我替你看這邊，下一次穩穩來。']},
    sabo:{good:['好，這一步抓得準。','就照這個節奏接下去。'],miss:['沒關係，把局面看清楚再出手。','先穩住，我們還有下一回。']},
    law:{good:['正確。下一輪照同樣的方法。','嗯，總算不用我重講一次。'],miss:['順序錯了。回頭看第一步。','別亂動。先確認位置。']}
  };
  for(const [key,extra] of Object.entries(EXTRA_REACTIONS)){VOICES[key].good=[VOICES[key].good,...extra.good];VOICES[key].miss=[VOICES[key].miss,...extra.miss];}
  const ERRORS={offline:'連線中斷，這一輪暫停送出。重新連線後可再送出。',unavailable:'暫時連不上基地，請稍後再試。',minigame_active:'上一場挑戰還沒結束，可繼續查看或結束後重開。',minigame_expired:'這場挑戰已逾時，請關閉後重新開始。',minigame_cooldown:'夥伴剛完成訓練，休息一下再來。',cooldown:'夥伴還在休息，稍後再來。',work_daily_limit:'暫時無法結算工作，請稍後再試。',insufficient_energy:'夥伴的精神不足，先讓他休息一下。',character_busy:'夥伴正在工作，請先完成原有分工。',work_active:'夥伴正在工作，請先完成原有分工。',not_placed:'請先把這位夥伴放進房間。',character_not_released:'這位夥伴尚未開放。',readonly:'參觀好友時不能指派主人的夥伴。',minigame_not_ready:'還沒到交卷時間，稍候再試。',minigame_invalid:'這場挑戰已失效，請關閉後重新開始。',fish_collection_full:'漁獲收藏已滿；仍可繼續海釣，若要保存新魚請先放生一尾。',fish_aquarium_locked:'先取得千陽號水族館酒吧場景或水族箱家具，才能展示漁獲。',fish_aquarium_full:'魚缸目前最多展示六尾魚。'};
  Object.assign(ERRORS,{needs_rest:'夥伴有些累了，先休息恢復精神；也可以自由練習，不領取獎勵。',interaction_cooldown:'訓練還在冷卻中。可以先自由練習，不領取獎勵。',invalid_minigame_session:'這場挑戰已失效，請關閉後重新開始。',minigame_too_early:'這一輪仍在判定，稍候片刻再送出。',minigame_round_conflict:'挑戰進度已更新，請關閉後重新進入。',wallet_full:'商城錢包需要先空出至少 10 枚金幣，才能開始有酬工作。'});
  function node(tag,className,text) {const value=document.createElement(tag);if(className)value.className=className;if(text!==undefined)value.textContent=text;return value;}
  function create(options) {
    let layer=null,card=null,body=null,feedback=null,progress=null,closeButton=null,live=null;
    let game=null,kind='',jobId='supply',characterId='',phase='closed',generation=0,frame=0,requesting=false,queued=null,roundStart=0,choice=[],directions=[],ingredients=[],rotations=[],course=[],counterMoves=[],previousFocus=null,lastRound='',lastResult='',lastFeedback=-1;
    let held=false,windowFocused=true,practice=false,actorFrame=0,actorStep=null,actorLane=1,reelTimer=0,lastFishingTimeout=0,lastKeyboardReel=0,serverClockOffset=0;
    const reactionCounts={good:0,miss:0};
    const now=()=>performance.now();
    const fishingNow=()=>Date.now()+serverClockOffset;
    function syncServerClock(response){const observed=Date.parse(response?.serverNow);if(Number.isFinite(observed))serverClockOffset=observed-Date.now();}
    const voice=()=>VOICES[keyOf(characterId)]||VOICES.luffy;
    const job=()=>JOBS[jobId]||JOBS.supply;
    const introLine=()=>kind==='training'?voice().training:JOB_LINES[jobId]?.[keyOf(characterId)]||voice().work;
    function updateTitle(){document.getElementById('roomMinigameTitle').textContent=kind==='work'?job().title:'甲板特訓';if(layer)layer.dataset.job=kind==='work'?jobId:'training';}
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
    function portraitUrl(){const key=keyOf(characterId);return key==='robin'?`${ASSET}robin_v2/portrait.webp`:root.OnePieceReservedCrew?.assetUrl(key,'portrait.webp')||`${ASSET}${root.OnePieceRoomMotion?.LUFFY_ART_ENABLED===true&&key==='luffy'?'portrait_v4':'portrait_v3'}/${key}.webp`;}
    function open(input) {
      if(active()||!VOICES[keyOf(input.characterId)])return false;
      ensure();generation++;game=null;queued=null;requesting=false;lastRound='';lastResult='';lastFeedback=-1;practice=false;serverClockOffset=0;lastKeyboardReel=0;reactionCounts.good=0;reactionCounts.miss=0;kind=input.kind;characterId=input.characterId;phase='intro';previousFocus=document.activeElement;root.OnePieceRoomMotion?.preload(keyOf(characterId));
      jobId=JOBS[input.jobId]?input.jobId:'supply';held=true;options.onOpen?.(characterId);layer.hidden=false;updateTitle();document.getElementById('roomMinigameName').textContent=voice().name;
      const portrait=document.getElementById('roomMinigamePortrait');portrait.onerror=root.OnePieceRoomMotion?.LUFFY_ART_ENABLED===true&&keyOf(characterId)==='luffy'?()=>{portrait.onerror=null;portrait.src=`${ASSET}portrait_v3/luffy.webp`;}:null;portrait.src=portraitUrl();
      progress.replaceChildren();say(introLine());renderIntro();return true;
    }
    function button(label,fn,className='room-minigame-primary'){const b=node('button',className,label);b.type='button';b.onclick=fn;return b;}
    function renderIntro(message='') {
      phase='intro';body.replaceChildren();const intro=node('div','room-minigame-intro');
      if(kind==='work'){
        const choices=node('div','room-minigame-jobs');choices.setAttribute('role','group');choices.setAttribute('aria-label','選擇工作');
        for(const [id,definition] of Object.entries(JOBS)){const option=button('',()=>{if(requesting)return;jobId=id;updateTitle();say(introLine());renderIntro();body.querySelector(`[data-job="${id}"]`)?.focus({preventScroll:true});},'room-minigame-job');option.dataset.job=id;option.setAttribute('aria-pressed',String(id===jobId));option.append(node('span','room-minigame-job-guide',definition.guide),node('strong','',definition.title),node('span','',definition.short));choices.append(option);}
        intro.append(choices,node('p','room-minigame-shared-budget','工作小遊戲不限遊玩次數。過關可獲商城金幣，持有上限 500 枚；海釣另可收藏漁獲。'));
      }
      intro.append(node('h3','',kind==='work'?job().description:'看過安全路線，再用腳步記住它。'));
      const rules=node('ol');for(const text of kind==='work'?job().rules:['共 4 段航道。先看依序亮起的安全位置，再照順序走。','使用 ←／↑／→ 或畫面上的三個方向鍵；↑ 代表中央航道。','路線由 3 步增至 5 步。完整通過 3 段即可過關，沒有戰鬥能力限制。'])rules.append(node('li','',text));intro.append(rules);
      const warning=node('p','room-minigame-cost',practice?'自由練習不領取獎勵；正式訓練也可以不限次數遊玩。':kind==='work'?'工作可以不限次數挑戰。過關最多取得 10 枚金幣，已接近 500 枚上限時只補足差額；中途離開不給獎勵。':'訓練可以不限次數挑戰，過關可提升工作意願與親密度；中途離開不給獎勵。');intro.append(warning);
      if(kind==='work'&&jobId==='fishing')intro.append(fishCollectionView());
      if(message)intro.append(node('p','room-minigame-error',message));intro.append(button('準備好了 · 開始挑戰',()=>void start()));if(kind==='training'&&!practice)intro.append(button('先自由練習 · 不領獎',()=>{practice=true;renderIntro();},'room-minigame-secondary'));body.append(intro);body.querySelector('.room-minigame-primary')?.focus({preventScroll:true});
    }
    function fishCollectionView(){
      const collection=node('section','room-fishing-collection');collection.append(node('h4','','我的漁獲收藏'));
      const fish=(options.fishCollection?.()||[]).filter(entry=>entry&&FISH_LABELS[entry.speciesId]);
      collection.append(node('p','',fish.length?`已收藏 ${fish.length} / 64 尾；魚缸展示 ${fish.filter(entry=>entry.inAquarium).length} / 6 尾。${fish.length>=64?'收藏已滿；仍可玩海釣，要保存新魚請先放生一尾。':''}`:'尚未釣到魚。過關後會加入收藏。'));
      const list=node('div','room-fishing-collection-list');for(const entry of [...fish].reverse()){
        const card=node('div','room-fishing-collection-item');const art=node('img');art.src=`${ASSET}fish_v1/${entry.speciesId}.webp`;art.alt='';art.draggable=false;
        const name=node('strong','',FISH_LABELS[entry.speciesId]);const action=button(entry.inAquarium?'收回收藏':'放進水族箱',async()=>{
          const response=await request('fish.place',{fishId:entry.id,inAquarium:!entry.inAquarium});
          if(response?.ok){renderIntro();body.querySelector(`[data-fish-id="${entry.id}"]`)?.focus({preventScroll:true});say(entry.inAquarium?'已收回收藏。':'已放進水族箱。');options.onResult?.(game);}
          else if(response)say(ERRORS[response.error]||'目前無法變更魚缸展示，請稍後再試。');
        },'room-fishing-collection-action');action.dataset.fishId=entry.id;
        const release=button('放生',async()=>{
          if(release.dataset.confirmed!=='true'){release.dataset.confirmed='true';release.textContent='確定永久放生';release.classList.add('confirm-release');return;}
          const response=await request('fish.release',{fishId:entry.id});
          if(response?.ok){renderIntro();say(`${FISH_LABELS[entry.speciesId]}已放回海中。`);options.onResult?.(game);}
          else if(response)say('放生未完成，請稍後再試。');
        },'room-fishing-collection-action room-fishing-release');
        card.append(art,name,action,release);list.append(card);
      }collection.append(list);return collection;
    }
    async function request(type,payload={}) {
      if(requesting)return null;requesting=true;setDisabled(true);const current=generation;
      try {const response=await options.command(type,payload);if(current!==generation)return null;return response||{ok:false,error:'offline'};}
      catch{return current===generation?{ok:false,error:'offline'}:null;}
      finally{if(current===generation){requesting=false;setDisabled(false);updateFishingV2();}}
    }
    function setDisabled(value){if(!layer)return;layer.dataset.pending=String(value);for(const b of body.querySelectorAll('button'))b.disabled=(value&&b.dataset.fishAction!=='reel')||b.dataset.permanentDisabled==='true';}
    async function start(){if(phase!=='intro')return;const response=await request('minigame.start',{characterId,kind,...kind==='work'?{jobId}:{},...kind==='work'&&jobId==='fishing'?{fishingVersion:2}:{},...practice?{practice:true}:{}});if(!response)return;if(response.minigame&&['playing','ready','failed'].includes(response.minigame.state)){game=response.minigame;if(game.characterId!==characterId||game.kind!==kind){renderRecovery();return;}accept(response);return;}renderIntro(ERRORS[response.error]||response.message||'暫時無法開始，請稍候再試。');}
    function renderRecovery(){phase='recovery';body.replaceChildren(node('h3','','上一次挑戰尚未結束'),node('p','','結束舊挑戰後，即可重新選擇夥伴。未完成的獎勵不會發放。'),button('結束舊挑戰',()=>void cancel(false)));say('不會自動領取獎勵。');}
    function accept(response) {
      if(!response?.minigame){showRetry(response);return;}
      syncServerClock(response);
      const previousFishingStage=game?.challenge?.id&&game.challenge.id===response.minigame.challenge?.id&&game.challenge.fishingVersion===2?game.challenge.stage:null;
      game=response.minigame;
      if(kind==='work'){jobId=JOBS[game.jobId]?game.jobId:'supply';updateTitle();}
      if(game.feedback&&game.feedback.roundIndex!==lastFeedback){lastFeedback=game.feedback.roundIndex;say(reaction(game.feedback.correct?'good':'miss'));}
      progress.textContent=`${kind==='work'?job().round:'航道'} ${Math.min(game.roundIndex+1,game.totalRounds)} / ${game.totalRounds}　｜　完成 ${game.correctRounds||0}　｜　連擊 ${game.combo||0}`;
      if(['completed','failed'].includes(game.state)){renderResult();return;}
      if(!['playing','ready'].includes(game.state)){renderEnded();return;}
      if(game.state==='ready'||!game.challenge){void finish();return;}
      if(lastRound===game.challenge.id){
        if(jobId==='fishing'&&game.challenge.fishingVersion===2){
          updateFishingV2();
          if(previousFishingStage!==game.challenge.stage){
            const target=game.challenge.stage==='fight'?body.querySelector('[data-fish-action=reel]'):layer;
            target?.focus({preventScroll:true});
          }
        }
        return;
      }
      stopReeling();lastRound=game.challenge.id;choice=[];directions=[];ingredients=[];rotations=game.challenge.tiles?.map(tile=>tile.rotation)||[];course=Number.isInteger(game.challenge.start)?[game.challenge.start]:[];counterMoves=[];queued=null;roundStart=now();phase=jobId==='fishing'&&game.challenge.fishingVersion===2?'answer':'showcase';renderRound();cancelAnimationFrame(frame);frame=requestAnimationFrame(tick);
    }
    function renderRound() {
      body.replaceChildren();const challenge=game.challenge;
      const stage=node('div',`room-minigame-stage ${kind} ${kind==='work'?'job-'+jobId:''} ${jobId==='fishing'&&challenge.fishingVersion===2?'fishing-v2':''}`);stage.dataset.round=String(game.roundIndex);body.append(stage);
      const heading=node('div','room-minigame-order');heading.append(node('span','room-minigame-round-number',`0${game.roundIndex+1}`));
      heading.append(node('strong','',kind!=='work'?'記住安全航道':jobId==='supply'?`這一批需要：${challenge.order?.label||{food:'食材',tools:'工具',books:'書籍'}[challenge.order?.category]||'補給'}`:jobId==='cooking'?challenge.recipeLabel||'依序備好食材':jobId==='repair'?'入口 → 接通管線 → 出口':jobId==='fishing'&&challenge.fishingVersion===2?'拋竿 → 浮標下沉 → 抽竿 → 控制張力':'魚影正在拉扯魚線'));stage.append(heading);
      const timer=node('div','room-minigame-timer');timer.setAttribute('role','progressbar');timer.setAttribute('aria-label','這一輪剩餘時間');timer.setAttribute('aria-valuemin','0');timer.setAttribute('aria-valuemax','100');timer.append(node('span'));stage.append(timer);
      const hint=node('p','room-minigame-hint');hint.id='roomMinigameHint';stage.append(hint);
      if(kind==='work'&&jobId==='supply') {
        const belt=node('div','room-minigame-belt');challenge.crates.forEach((crate,index)=>{
          const label={food:'食材箱',tools:'工具箱',books:'書籍航圖箱'}[crate.category];const cargo=button('',()=>selectCargo(index),'room-minigame-cargo');cargo.dataset.index=String(index);cargo.setAttribute('aria-pressed','false');cargo.setAttribute('aria-label',`${index+1}：${label}`);
          const art=node('img');art.src=`${ASSET}minigames_v1/cargo-${crate.category}.webp`;art.alt='';art.draggable=false;art.style.setProperty('--cargo-order',String(index));cargo.append(node('kbd','',String(index+1)),art,node('strong','',label),node('span','room-minigame-cargo-state','點選裝船'));belt.append(cargo);
        });stage.append(belt);stage.append(button('裝船 · Enter',()=>void submit(),'room-minigame-primary room-minigame-submit'));
      }else if(kind==='work') {
        if(jobId==='cooking')renderCooking(stage,challenge);
        else if(jobId==='repair')renderRepair(stage,challenge);
        else if(jobId==='fishing')challenge.fishingVersion===2?renderFishingV2(stage,challenge):renderFishing(stage,challenge);
        else renderNavigation(stage,challenge);
      }else {
        const lanes=node('div','room-minigame-lanes');for(const dir of DIRS){const lane=node('div','room-minigame-lane');lane.dataset.direction=dir;lane.append(node('span','room-minigame-lane-arrow',ARROWS[dir]),node('span','room-minigame-lane-name',DIR_NAMES[dir]));lanes.append(lane);}const token=node('canvas','room-minigame-runner');token.setAttribute('role','img');token.setAttribute('aria-label',voice().name+'完整人物');token.dataset.lane='up';lanes.append(token);stage.append(lanes);actorLane=1;actorStep=null;cancelAnimationFrame(actorFrame);actorFrame=requestAnimationFrame(paintActor);
        const steps=node('div','room-minigame-steps');for(let i=0;i<challenge.directions.length;i++){const dot=node('span','',String(i+1));dot.setAttribute('aria-label',`第 ${i+1} 步`);steps.append(dot);}stage.append(steps);
        const controls=node('div','room-minigame-directions');for(const dir of DIRS){const b=button(ARROWS[dir],()=>inputDirection(dir),'room-minigame-direction');b.dataset.direction=dir;b.setAttribute('aria-label',DIR_NAMES[dir]);controls.append(b);}stage.append(controls);
      }
      if(game.feedback){const result=node('div',`room-minigame-round-result ${game.feedback.correct?'correct':'miss'}`,game.feedback.correct?'上一輪完整通過！':'上一輪有遺漏或失誤，穩住再來。');stage.append(result);}
      if(!(jobId==='fishing'&&challenge.fishingVersion===2))stage.querySelectorAll('button').forEach(b=>{b.disabled=true;});
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
    function stopReeling(){if(reelTimer){clearInterval(reelTimer);reelTimer=0;}}
    async function sendFishingAction(action){
      if(phase!=='answer'||requesting||jobId!=='fishing'||game?.challenge?.fishingVersion!==2)return;
      const currentRound=game.challenge.id;
      const response=await request('minigame.answer',{sessionId:game.id,token:game.token,roundId:currentRound,counterMoves:[action]});
      if(!response)return;
      if(response.ok){accept(response);return;}
      if(response.error==='fishing_action_cooldown')return;
      if(response.error==='minigame_round_conflict'&&response.minigame?.roundIndex>game.roundIndex){accept(response);return;}
      if(response.minigame&&['expired','cancelled','invalidated'].includes(response.minigame.state)){accept(response);return;}
      say(ERRORS[response.error]||'海釣操作暫時沒有送達；請看浮標後再試一次。');
    }
    function renderFishingV2(stage,challenge){
      const sea=node('div','room-fishing-sea room-fishing-v2-sea');sea.setAttribute('role','img');sea.setAttribute('aria-label','放大的海面、釣竿、魚線、浮標及魚影');
      const rod=node('img','room-fishing-v2-rod');rod.src=`${ASSET}fishing_v2/rod.webp`;rod.alt='';rod.draggable=false;
      const line=document.createElementNS('http://www.w3.org/2000/svg','svg');line.setAttribute('class','room-fishing-v2-line');line.setAttribute('viewBox','0 0 1000 560');line.setAttribute('preserveAspectRatio','none');
      for(const [name,shape] of [['desktop-wait','M 520 210 Q 585 195 650 275'],['desktop-fight','M 520 210 Q 590 190 650 275'],['mobile-wait','M 520 220 Q 590 205 650 196'],['mobile-fight','M 520 220 Q 590 200 650 196']]){const curve=document.createElementNS('http://www.w3.org/2000/svg','path');curve.setAttribute('class',name);curve.setAttribute('d',shape);line.append(curve);}
      const shadow=node('img','room-fishing-v2-shadow');shadow.src=`${ASSET}fish_v1/balloon-catfish.webp`;shadow.alt='';shadow.draggable=false;
      const splash=node('img','room-fishing-v2-splash');splash.src=`${ASSET}fishing_v2/splash.webp`;splash.alt='';splash.draggable=false;
      const float=node('img','room-fishing-v2-bobber');float.src=`${ASSET}fishing_v2/bobber.webp`;float.alt='';float.draggable=false;
      const seaCaption=node('span','room-fishing-v2-sea-caption');seaCaption.textContent='千陽號船舷 · 海釣';
      sea.append(node('div','room-fishing-wake'),shadow,line,rod,splash,float,seaCaption);stage.append(sea);
      const steps=node('div','room-fishing-v2-steps');for(const label of ['1 拋竿','2 看浮標','3 抽竿','4 捲線'])steps.append(node('span','',label));stage.append(steps);
      const panel=node('div','room-fishing-v2-panel');const signal=node('strong','room-fishing-v2-signal');signal.setAttribute('aria-live','polite');const sub=node('span','room-fishing-v2-sub');panel.append(signal,sub);stage.append(panel);
      const meters=node('div','room-fishing-v2-meters');for(const [type,label] of [['distance','魚離船舷'],['tension','魚線張力']]){const meter=node('div',`room-fishing-v2-meter ${type}`);const title=node('div','room-fishing-v2-meter-title');title.append(node('strong','',label),node('span','',type==='distance'?'100 %':'12 %'));const track=node('div','room-fishing-v2-track');track.setAttribute('role','progressbar');track.setAttribute('aria-label',label);track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.append(node('span'));meter.append(title,track);meters.append(meter);}stage.append(meters);
      const actions=node('div','room-fishing-v2-actions');
      const cast=button('拋竿 · Enter',()=>void sendFishingAction('cast'),'room-fishing-v2-action primary');cast.dataset.fishAction='cast';
      const hook=button('浮標沉了！抽竿 · Enter',()=>void sendFishingAction('hook'),'room-fishing-v2-action hook');hook.dataset.fishAction='hook';
      const reel=node('button','room-fishing-v2-action reel','按住捲線 · 空白鍵');reel.type='button';reel.dataset.fishAction='reel';
      reel.addEventListener('pointerdown',event=>{if(reel.disabled||event.button!==0)return;event.preventDefault();void sendFishingAction('reel');stopReeling();reelTimer=setInterval(()=>void sendFishingAction('reel'),560);});
      const slack=button('放線 · ↓',()=>void sendFishingAction('slack'),'room-fishing-v2-action slack');slack.dataset.fishAction='slack';
      actions.append(cast,hook,reel,slack);stage.append(actions);
      updateFishingV2();
    }
    function updateFishingV2(){
      const challenge=game?.challenge;if(jobId!=='fishing'||challenge?.fishingVersion!==2)return;
      const sea=body.querySelector('.room-fishing-v2-sea');if(!sea)return;
      const at=fishingNow(),biting=challenge.stage==='wait'&&at>=Date.parse(challenge.biteAt),nibbling=challenge.stage==='wait'&&!biting&&at>=Date.parse(challenge.biteAt)-1250;
      sea.dataset.stage=challenge.stage;sea.dataset.biting=String(biting);sea.dataset.nibbling=String(nibbling);sea.dataset.pull=challenge.pull||'steady';
      const activeStep=challenge.stage==='cast'?0:challenge.stage==='wait'?biting?2:1:3;
      body.querySelectorAll('.room-fishing-v2-steps span').forEach((item,index)=>{item.classList.toggle('active',index===activeStep);item.classList.toggle('done',index<activeStep);});
      const text=challenge.stage==='cast'?'先拋竿，浮標會落在海面上。':challenge.stage==='wait'?(biting?'浮標沉下去了！現在抽竿！':nibbling?'魚在試餌，只是輕晃；等浮標整個沉下。':'盯著浮標；魚影靠近時先別抽竿。'):challenge.pull==='surge'?'魚正在猛衝！張力高就放線。':'魚已上鉤！按住捲線，留意張力。';
      const signal=body.querySelector('.room-fishing-v2-signal');if(signal&&signal.textContent!==text)signal.textContent=text;
      const hint=body.querySelector('#roomMinigameHint');if(hint&&hint.textContent!==text)hint.textContent=text;
      const sub=body.querySelector('.room-fishing-v2-sub');if(sub)sub.textContent=challenge.stage==='wait'?biting?`抽竿窗口還有 ${Math.max(0,((Date.parse(challenge.hookUntil)-at)/1000)).toFixed(1)} 秒`:'浮標會先輕啄再猛沉；只在沉下時抽竿。':challenge.stage==='fight'?'張力過高會斷線；放線可讓魚冷靜。':'點按拋竿，從船舷把浮標送出去。';
      const actions=body.querySelectorAll('[data-fish-action]');for(const action of actions){const type=action.dataset.fishAction;action.hidden=!(type==='cast'&&challenge.stage==='cast'||type==='hook'&&challenge.stage==='wait'||['reel','slack'].includes(type)&&challenge.stage==='fight');if(type==='hook')action.disabled=!biting||requesting;}
      for(const [type,value] of [['distance',challenge.distance],['tension',challenge.tension]]){const meter=body.querySelector(`.room-fishing-v2-meter.${type}`);if(!meter)continue;const amount=clamp(value,0,100);meter.querySelector('.room-fishing-v2-track span').style.width=`${amount}%`;meter.querySelector('.room-fishing-v2-track').setAttribute('aria-valuenow',String(Math.round(amount)));meter.querySelector('.room-fishing-v2-meter-title span').textContent=`${Math.round(amount)} %`;if(type==='tension')meter.dataset.risk=amount>=78?'danger':amount>=55?'warning':'safe';}
    }
    function tickFishingV2(){
      updateFishingV2();const challenge=game?.challenge;if(!challenge||challenge.fishingVersion!==2)return;
      if(challenge.stage==='wait'&&fishingNow()>Date.parse(challenge.hookUntil)+150&&!requesting&&now()-lastFishingTimeout>1300){lastFishingTimeout=now();void sendFishingAction('timeout');}
      if(challenge.stage==='fight'&&fishingNow()>Date.parse(challenge.fightUntil)+150&&!requesting&&now()-lastFishingTimeout>1300){lastFishingTimeout=now();void sendFishingAction('timeout');}
    }
    function renderFishing(stage,challenge){
      const sea=node('div','room-fishing-sea');sea.setAttribute('role','img');sea.setAttribute('aria-label','千陽號船舷外的海面、魚線、浮標與水下魚影');
      sea.append(node('div','room-fishing-wake'),node('div','room-fishing-line'),node('div','room-fishing-float'),node('div','room-fishing-shadow'));stage.append(sea);
      const panel=node('div','room-fishing-panel');const signal=node('strong','room-fishing-signal');signal.setAttribute('aria-live','polite');panel.append(signal);
      const steps=node('div','room-fishing-steps');steps.setAttribute('aria-label','本次拉扯進度');for(let i=0;i<challenge.pulls.length;i++)steps.append(node('span','',String(i+1)));panel.append(steps);stage.append(panel);
      const controls=node('div','room-fishing-controls');for(const [move,label,key] of [['left','← 向左拉','ArrowLeft'],['slack','↓ 鬆線','ArrowDown'],['right','向右拉 →','ArrowRight']]){
        const control=button(label,()=>addFishingMove(move),'room-fishing-control');control.dataset.move=move;control.setAttribute('aria-label',`${label}，鍵盤 ${key}`);controls.append(control);
      }stage.append(controls);updateFishing();
    }
    function updateFishing(){
      const challenge=game?.challenge;if(!challenge||jobId!=='fishing')return;
      const pull=challenge.pulls[counterMoves.length],sea=body.querySelector('.room-fishing-sea'),signal=body.querySelector('.room-fishing-signal');
      if(sea)sea.dataset.pull=pull||'landed';
      if(signal)signal.textContent=pull?{left:'魚影向左急衝，魚線繃緊！',right:'魚影向右急衝，魚線繃緊！',deep:'魚影猛潛，水面一陣翻騰！'}[pull]:'魚線穩住了！正在收竿…';
      body.querySelectorAll('.room-fishing-steps span').forEach((dot,index)=>{dot.classList.toggle('done',index<counterMoves.length);dot.classList.toggle('current',index===counterMoves.length);dot.textContent=index<counterMoves.length?'✓':String(index+1);});
    }
    function addFishingMove(move){
      if(phase!=='answer'||requesting||jobId!=='fishing'||counterMoves.length>=game.challenge.pulls.length)return;
      const pull=game.challenge.pulls[counterMoves.length],expected={left:'right',right:'left',deep:'slack'}[pull];counterMoves.push(move);
      const sea=body.querySelector('.room-fishing-sea');if(sea){sea.classList.remove('reel-good','reel-miss');void sea.offsetWidth;sea.classList.add(move===expected?'reel-good':'reel-miss');}
      updateFishing();if(counterMoves.length===game.challenge.pulls.length)void submit();
    }
    function undoInput(){if(phase!=='answer'||requesting)return;if(jobId==='cooking'){ingredients.pop();updateIngredients();}else if(jobId==='navigation'&&course.length>1){course.pop();updateCourse();}}
    function selectCargo(index){if(phase!=='answer'||requesting||kind!=='work'||jobId!=='supply')return;const id=game.challenge.crates[index]?.id;if(!id)return;choice=choice.includes(id)?choice.filter(x=>x!==id):[...choice,id];const b=body.querySelector(`[data-index="${index}"]`);b.setAttribute('aria-pressed',String(choice.includes(id)));b.querySelector('.room-minigame-cargo-state').textContent=choice.includes(id)?'已選 · 再點取消':'點選裝船';}
    function inputDirection(dir){if(phase!=='answer'||requesting||kind!=='training'||directions.length>=game.challenge.directions.length)return;directions.push(dir);const next=DIRS.indexOf(dir);actorStep={from:actorLane,to:next,started:now(),duration:280,direction:next<actorLane?'west':next>actorLane?'east':'south'};actorLane=next;const dot=body.querySelectorAll('.room-minigame-steps span')[directions.length-1];dot.textContent=ARROWS[dir];dot.classList.add('entered');if(directions.length===game.challenge.directions.length)void submit();}
    function paintActor(time){const canvas=body?.querySelector('.room-minigame-runner');if(!active()||!canvas)return;const elapsed=actorStep?time-actorStep.started:0,ratio=actorStep?clamp(elapsed/actorStep.duration,0,1):1,moving=actorStep&&ratio<1,position=actorStep?actorStep.from+(actorStep.to-actorStep.from)*ratio:actorLane;canvas.style.left=`calc(${21.3+position*28.7}% - 72px)`;const motion=root.OnePieceRoomMotion,atlas=motion?.preload(keyOf(characterId))?.atlases[moving?actorStep.direction:'south'];if(atlas){const frameIndex=moving?Math.floor(elapsed/70)%4:motion.metadata(keyOf(characterId),root.OnePieceRoomMotionManifest).standingFrame;motion.draw(canvas,atlas,frameIndex);canvas.dataset.wholeBody='true';}actorFrame=requestAnimationFrame(paintActor);}
    function tick() {
      if(!active()||!game?.challenge||!['showcase','answer','waiting'].includes(phase))return;
      if(jobId==='fishing'&&game.challenge.fishingVersion===2){tickFishingV2();frame=requestAnimationFrame(tick);return;}
      const challenge=game.challenge,elapsed=now()-roundStart,showcase=Number(challenge.showcaseMs)||700,windowMs=Number(challenge.answerWindowMs)||4500;
      if(phase==='showcase') {
        document.getElementById('roomMinigameHint').textContent=kind!=='work'?'看清路線，亮過之後才輪到你。':({supply:'補給靠港中，先看訂單…',cooking:'先看食譜順序，準備開始備料。',repair:'先找入口、出口，再觀察管口方向。',navigation:'先看港口和暗礁，準備規劃航線。',fishing:'浮標正在晃動。等魚上鉤再選擇收線方向。'}[jobId]);
        if(kind==='training'){const index=Math.floor(Math.max(0,elapsed-400)/550),lit=elapsed>=400&&elapsed<showcase-150&&(elapsed-400)%550<390?challenge.directions[index]:null;for(const lane of body.querySelectorAll('.room-minigame-lane'))lane.classList.toggle('lit',lane.dataset.direction===lit);body.querySelectorAll('.room-minigame-steps span').forEach((dot,i)=>dot.classList.toggle('showing',!!lit&&i===index));}
        if(elapsed>=showcase){phase='answer';layer.dataset.phase='answer';body.querySelectorAll('.room-minigame-stage button').forEach(b=>{b.disabled=b.dataset.permanentDisabled==='true';});for(const lane of body.querySelectorAll('.room-minigame-lane,.room-minigame-steps span'))lane.classList.remove('lit','showing');document.getElementById('roomMinigameHint').textContent=kind!=='work'?`輪到你了！依序走完 ${challenge.directions.length} 步。`:({supply:'選出所有需要的物資，倒數結束自動裝船。',cooking:'依序備料，可退回修正；備好後按 Enter。',repair:'轉動管線，把入口和出口接通，再測試通水。',navigation:'走相鄰海面避開暗礁；到港後按 Enter 確認。',fishing:'左右急衝要反向牽制；猛潛時鬆線。觀察魚影，穩住五次拋竿！'}[jobId]);}
      }
      const percentage=phase==='showcase'?100:clamp(100*(1-(elapsed-showcase)/windowMs),0,100),timer=body.querySelector('.room-minigame-timer');if(timer){timer.firstChild.style.width=`${percentage}%`;timer.setAttribute('aria-valuenow',String(Math.round(percentage)));}
      if(kind==='work'){const belt=body.querySelector('.room-minigame-belt');if(belt)belt.style.setProperty('--cargo-drift',`${clamp((elapsed/(showcase+windowMs)-.5)*18,-9,9)}px`);}
      if(phase==='answer'&&elapsed>=showcase+windowMs)void submit();
      frame=requestAnimationFrame(tick);
    }
    async function submit() {
      if(phase!=='answer'||requesting)return;phase='waiting';cancelAnimationFrame(frame);const current=generation;
      const answer=kind!=='work'?{directions:[...directions]}:jobId==='supply'?{selections:[...choice]}:jobId==='cooking'?{ingredients:[...ingredients]}:jobId==='repair'?{rotations:[...rotations]}:jobId==='fishing'?{counterMoves:[...counterMoves]}:{path:[...course]};
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
    async function finish(){phase='waiting';cancelAnimationFrame(frame);body.replaceChildren(node('h3','','挑戰完成，正在結算…'));say('成果確認後才會發放獎勵。');const current=generation,wait=Math.max(0,Date.parse(game.finishNotBefore)-fishingNow()+60);if(wait>0)await new Promise(resolve=>setTimeout(resolve,Math.min(wait,30000)));if(current!==generation||!active())return;const response=await request('minigame.finish',{sessionId:game.id,token:game.token});if(!response)return;if(response.ok)accept(response);else showRetry(response);}
    function renderResult() {
      const resultKey=`${game.id}:${game.attempt||1}`;if(lastResult===resultKey)return;lastResult=resultKey;phase='result';cancelAnimationFrame(frame);const result=game.result||{};body.replaceChildren();const box=node('div',`room-minigame-result ${result.passed?'passed':''}`);box.append(node('span','room-minigame-eyebrow',result.passed?'CHALLENGE CLEAR':'KEEP PRACTICING'),node('h3','',result.passed?'配合成功！':'差一點，再調整步調。'),node('p','',`完整通過 ${result.correctRounds||0} / ${result.totalRounds||game.totalRounds} 輪`));
      const rewards=node('div','room-minigame-rewards');rewards.append(node('strong','',game.practice?'自由練習 · 不領獎勵':result.coins?`商城金幣 +${result.coins}`:kind==='work'&&result.passed?'金幣已達 500 枚上限':kind==='work'?'本次沒有金幣獎勵':'工作意願 +'+(result.workMotivation||0)));if(result.affinity)rewards.append(node('span','',`親密度 +${result.affinity}`));box.append(rewards,node('p','room-minigame-cost',result.catchCollectionFull?'漁獲收藏已滿 64 尾；本次仍照常計算成績與金幣。要留下新魚，請先在收藏中放生一尾。':result.canRetry?`這一場還能重試 ${result.attemptsRemaining} 次；新的一場也不限次數。`:kind==='work'?'工作小遊戲可不限次數再玩；持有金幣上限 500 枚。':'訓練可不限次數再玩。'));
      if(result.catch&&Object.hasOwn(FISH_LABELS,result.catch.speciesId)){
        const catchCard=node('div','room-fishing-catch');const fish=node('img');fish.src=`${ASSET}fish_v1/${result.catch.speciesId}.webp`;fish.alt=result.catch.label||'釣到的魚';fish.draggable=false;
        const copy=node('div');copy.append(node('span','room-minigame-eyebrow','NEW CATCH'),node('strong','',result.catch.label||'新漁獲'),node('small','','已加入漁獲收藏。香吉士料理菜單將於後續更新開放。'));
        const place=button('放進水族箱',async()=>{const response=await request('fish.place',{fishId:result.catch.id,inAquarium:true});if(response?.ok){place.textContent='已放進水族箱';place.dataset.permanentDisabled='true';place.disabled=true;say('魚已放進千陽號水族館酒吧的魚缸。');options.onResult?.(game);}else if(response){say(ERRORS[response.error]||'現在無法把魚放進水族箱，漁獲已保存在收藏。');}},'room-minigame-secondary');
        copy.append(place);catchCard.append(fish,copy);box.append(catchCard);
      }
      const row=node('div','room-minigame-result-actions');row.append(button('返回房間',()=>void askClose()));if(result.canRetry)row.append(button('這場再試一次',()=>void retryAttempt(),'room-minigame-secondary'));else row.append(button(kind==='training'?'再練一場':'再玩一場',()=>{game=null;practice=false;lastResult='';lastRound='';lastFeedback=-1;renderIntro();},'room-minigame-secondary'));box.append(row);body.append(box);say(result.passed?voice().win:reaction('miss'));options.onResult?.(game);row.firstChild.focus({preventScroll:true});
    }
    function renderEnded(){phase='ended';cancelAnimationFrame(frame);body.replaceChildren(node('h3','','這場挑戰已結束'),node('p','','没有發放未完成的獎勵。下次開始前可再確認消耗與規則。'),button('返回房間',()=>closeLocal()));say(game.state==='expired'?'挑戰逾時，夥伴先回房間了。':'下回再一起挑戰吧。');}
    async function cancel(close=true){if(requesting)return;const response=await request('minigame.cancel',{sessionId:game.id,token:game.token});if(!response)return;if(response.ok){if(close)closeLocal();else{game=null;lastRound='';renderIntro();}}else{say(ERRORS[response.error]||'暫時無法確認取消，重新連線後再試。');}}
    async function retryAttempt(){const response=await request('minigame.retry',{sessionId:game.id,token:game.token});if(!response)return;if(response.ok||response.minigame?.id===game.id&&response.minigame.attempt>game.attempt){lastFeedback=-1;lastRound='';queued=null;accept(response);}else say(ERRORS[response.error]||'現在無法重新開始，請稍後再試。');}
    async function askClose(){if(requesting)return;if(!game||!['playing','ready','failed'].includes(game.state)){closeLocal();return;}if(body.querySelector('.room-minigame-confirm'))return;stopReeling();const confirm=node('div','room-minigame-confirm');confirm.append(node('h3','','結束這場挑戰？'),node('p','',game.practice?'結束自由練習後不會領取獎勵。':'未完成的獎勵不會發放；關閉確認視窗時，本輪仍會繼續。'),button('結束並回房間',()=>void cancel(true)),button('繼續挑戰',()=>{confirm.remove();layer.focus({preventScroll:true});},'room-minigame-secondary'));body.append(confirm);confirm.querySelector('button').focus({preventScroll:true});}
    function closeLocal(){generation++;stopReeling();cancelAnimationFrame(frame);cancelAnimationFrame(actorFrame);phase='closed';game=null;queued=null;requesting=false;if(layer)layer.hidden=true;safeResume();if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});}
    function dismiss(){if(!active())return;const old=game;if(old&&['playing','ready','failed'].includes(old.state)&&!requesting)void options.command('minigame.cancel',{sessionId:old.id,token:old.token});closeLocal();}
    function keyDown(event){
      const confirmation=body?.querySelector('.room-minigame-confirm'),focusRoot=confirmation||layer;
      if(event.key==='Tab'){const available=[...focusRoot.querySelectorAll('button:not(:disabled)')].filter(n=>!n.hidden&&n.getClientRects().length);if(!available.length){event.preventDefault();return;}const first=available[0],last=available[available.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}return;}
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();void askClose();return;}if(confirmation)return;
      if(kind==='work'&&phase==='answer'&&jobId==='fishing'&&game?.challenge?.fishingVersion===2){
        const stage=game.challenge.stage,action=event.key==='ArrowDown'&&stage==='fight'?'slack':(event.key==='Enter'||event.key===' ')?stage==='cast'?'cast':stage==='wait'&&fishingNow()>=Date.parse(game.challenge.biteAt)?'hook':stage==='fight'?'reel':null:null;
        if(action){event.preventDefault();if(action==='reel'){if(now()-lastKeyboardReel<520)return;lastKeyboardReel=now();}else if(event.repeat)return;void sendFishingAction(action);}return;
      }
      if(event.repeat)return;
      if(kind==='work'&&phase==='answer'){
        if(jobId==='fishing'&&['ArrowLeft','ArrowRight','ArrowDown'].includes(event.key)){event.preventDefault();addFishingMove({ArrowLeft:'left',ArrowRight:'right',ArrowDown:'slack'}[event.key]);return;}
        if(/^[1-9]$/.test(event.key)){event.preventDefault();const index=Number(event.key)-1;if(jobId==='supply')selectCargo(index);else if(jobId==='cooking')addIngredient(index);else if(jobId==='repair')rotatePipe(index);}
        else if(event.key==='Enter'){event.preventDefault();void submit();}
        else if(event.key==='Backspace'){event.preventDefault();undoInput();}
        else if(jobId==='navigation'&&event.key.startsWith('Arrow')){const last=course.at(-1),size=game.challenge.size,delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-size,ArrowDown:size}[event.key];if(delta!==undefined){event.preventDefault();plotCourse(last+delta);}}
      }else if(kind==='training'){const dir={ArrowLeft:'left',ArrowUp:'up',ArrowRight:'right'}[event.key];if(dir){event.preventDefault();inputDirection(dir);}}
    }
    // A challenge keeps its clock while unfocused. No free restart or offscreen reward.
    root.addEventListener('blur',()=>{windowFocused=false;stopReeling();});root.addEventListener('focus',()=>{windowFocused=true;});root.addEventListener('pointerup',stopReeling);root.addEventListener('pointercancel',stopReeling);
    return Object.freeze({open,dismiss,active,receive:response=>{if(active()&&game&&response?.minigame?.id===game.id&&['expired','invalidated','cancelled'].includes(response.minigame.state))accept(response);},inspect:()=>({phase,kind,jobId,characterId,roundIndex:game?.roundIndex,selected:[...choice],entered:[...directions],ingredients:[...ingredients],rotations:[...rotations],course:[...course],counterMoves:[...counterMoves],requesting,windowFocused})});
  }
  root.OnePieceRoomMinigames=Object.freeze({create,VOICES,JOBS});
})(window);
