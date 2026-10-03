/* Short, server-scored crew challenges. Art stays in the existing asset pipeline. */
(function(root) {
  'use strict';
  const ASSET='opui://launcher/images/launcher_room/';
  const FISH_LABELS=Object.freeze({'balloon-catfish':'氣球鯰魚','glistening-saury':'閃亮秋刀魚','smile-jellyfish':'微笑水母','panda-shark':'熊貓鯊','butterflyfish':'蝶魚','adventure-fish':'冒險魚','cola-sunfish':'可樂翻車魚','reef-shark':'鯊魚','elephant-tuna':'象鼻鮪魚','lovely-angel':'可愛天使魚','striped-clam':'條紋蛤蜊','cutie-piranha':'可愛食人魚','claw-shrimp':'剪刀蝦','pumpkin-octopus':'南瓜章魚','maple-salmon':'紅葉鮭魚','lava-flounder':'熔岩比目魚','treasure-pearl-clam':'寶藏珍珠貝','electric-catfish':'感電鯰魚','demon-bonito':'鬼鰹魚','guiding-anglerfish':'引路鮟鱇魚','ice-fish':'冰晶魚','beat-alligator':'節奏鱷魚','aurora-sunfish':'極光翻車魚','burning-dragon':'燃燒龍','great-terigius':'巨型泰利吉烏斯','golden-whale':'黃金鯨'});
  const FISH_BAITS=Object.freeze({worm:{label:'蟲餌',note:'適合近岸的小型魚'},shrimp:{label:'蝦餌',note:'吸引礁區魚群'},lure:{label:'亮片擬餌',note:'遠處的大魚也會追逐'}});
  const FISH_SPOTS=Object.freeze({shore:{label:'近岸水流',note:'船邊的淺水與緩流',x:57,y:45},reef:{label:'珊瑚礁邊',note:'礁石間的魚影較活躍',x:68,y:46},deep:{label:'外海深水',note:'深處可能遇到有力的大魚',x:80,y:47},freshwater:{label:'淡水池',note:'淡水魚與水邊生物出沒',x:59,y:48},magma:{label:'熔岩潭',note:'炙熱水域有罕見魚影',x:67,y:50},rainbow:{label:'虹色水域',note:'彩色水面藏著稀有魚群',x:72,y:47}});
  const FISH_CAST_ZONES=Object.freeze({near:{label:'近處水面',key:'↓',x:46,y:55},mid:{label:'中距水面',key:'●',x:66,y:45},far:{label:'遠處水面',key:'↑',x:81,y:34}});
  const ROD_UPGRADE_COSTS=Object.freeze([20,35,55]);
  const UA_FISH=new Set(['adventure-fish','panda-shark','elephant-tuna','lovely-angel','striped-clam','cutie-piranha','claw-shrimp','pumpkin-octopus','maple-salmon','lava-flounder','treasure-pearl-clam','electric-catfish','demon-bonito','guiding-anglerfish','ice-fish','beat-alligator','aurora-sunfish','burning-dragon','great-terigius','golden-whale']);
  const fishArt=id=>`${ASSET}${UA_FISH.has(id)?'fish_ua':Object.hasOwn({'balloon-catfish':1,'glistening-saury':1,'smile-jellyfish':1,'panda-shark':1},id)?'fish_v1':'fish_v3'}/${id==='golden-whale'?'golden-whale-v2':id}.webp`;
  const spotArt=id=>`${ASSET}${['freshwater','magma','rainbow'].includes(id)?'fishing_v4':'fishing_v3'}/sea-${id}.webp`;
  const hideMissingFishArt=art=>{art.onerror=null;art.remove();};
  const keyOf=value=>String(value||'').replace(/^room-character-/,'');
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
  const DIRS=['left','up','right'];
  const ARROWS={left:'←',up:'↑',right:'→'};
  const DIR_NAMES={left:'左側',up:'中央',right:'右側'};
  const WORK_SCENES=Object.freeze({supply:'supply-deck-v2.webp',cooking:'cooking-galley-v2.webp',repair:'repair-workbench-v2.webp',navigation:'navigation-chart-v2.webp'});
  const ingredientArt=id=>`${ASSET}minigames_v2/ingredient-${id}.webp`;
  const JOBS=Object.freeze({
    supply:{title:'海上補給',guide:'一起裝船',short:'挑選物資',round:'補給',description:'看清訂單，把對的物資全數裝船。',rules:['共 8 輪補給，勾選每張訂單要求的全部物資；不需要的留在原位。','點箱子或按 1／2／3 切換選取；倒數結束裝船，也可按 Enter 提早交卷。','後半段會加快。完全配對 6 輪即可過關，連續正確會累積連擊。']},
    cooking:{title:'香吉士的出餐考驗',guide:'廚房幫手',short:'食材順序',round:'訂單',description:'依照食譜順序備料，讓大家準時開飯。',rules:['共 8 張訂單，依上方食譜，按順序點選食材；同一種食材可以加入多次。','點食材或按 1～6；點「退回一份」或按 Backspace 修正，Enter 出餐。','每張訂單限時 10 秒，完成 6 張即可過關。看清楚再動手，不浪費食材！']},
    repair:{title:'佛朗基的管路檢修',guide:'船塢助手',short:'旋轉接管',round:'管路',description:'轉動管線，讓左側入口一路接到右側出口。',rules:['共 8 面管路板。直管與彎管每點一次順時針轉 90 度；不需要用到全部管線。','點管線或按 1～9 轉動，接好後點「測試通水」或按 Enter。','每面限時 18 秒，修好 6 面即可過關。兩端開口要對齊，相鄰管線才接得上。']},
    navigation:{title:'娜美的航線演練',guide:'航海助手',short:'避礁規劃',round:'航線',description:'避開暗礁，用有限的步數畫出抵達港口的航線。',rules:['共 8 張海圖。從起點逐格點選上下左右相鄰海域，避開暗礁，抵達港口。','可以使用方向鍵移動；點前一格或按 Backspace 退回，Enter 確認出航。','每張海圖限時 16 秒，不能重走格子或超過步數上限。完成 6 張即可過關。']},
    fishing:{title:'千陽號海釣',guide:'浮標與魚線',short:'拋竿 · 抽竿 · 捲線',round:'釣點',description:'拋出釣竿，盯著大浮標；真正沉入水面才抽竿，再交替捲線與放線。',rules:['共有 3 個釣點，成功釣起 2 次就能收藏一尾作品中出現的魚。可以一直再玩，商城金幣最多持有 500 枚。','點「拋竿」後等魚靠近。浮標輕晃只是試餌；浮標猛地沉下、水花濺起時，按「抽竿」或空白鍵。太早抽竿會驚走魚。','上鉤後按住「捲線」縮短魚的距離；外圈耐壓由綠轉黃、紅，耗到 0% 就斷線。鬆開捲線或放線可回復。']}
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
  Object.assign(ERRORS,{needs_rest:'夥伴有些累了，先休息恢復精神；也可以自由練習，不領取獎勵。',interaction_cooldown:'訓練還在冷卻中。可以先自由練習，不領取獎勵。',invalid_minigame_session:'這場挑戰已失效，請關閉後重新開始。',minigame_too_early:'這一輪仍在判定，稍候片刻再送出。',minigame_round_conflict:'挑戰進度已更新，請關閉後重新進入。',wallet_full:'商城錢包需要先空出至少 10 枚金幣，才能開始有酬工作。',insufficient_coins:'商城金幣不足；先完成有酬工作，再回來請佛朗基改裝。',rod_max_level:'這支釣竿已經改裝到最高等級。'});
  function node(tag,className,text) {const value=document.createElement(tag);if(className)value.className=className;if(text!==undefined)value.textContent=text;return value;}
  function create(options) {
    let layer=null,card=null,body=null,feedback=null,progress=null,closeButton=null,live=null;
    let game=null,kind='',jobId='supply',characterId='',phase='closed',generation=0,frame=0,requesting=false,queued=null,roundStart=0,choice=[],directions=[],ingredients=[],rotations=[],course=[],counterMoves=[],previousFocus=null,lastRound='',lastResult='',lastFeedback=-1;
    let held=false,windowFocused=true,practice=false,actorFrame=0,actorStep=null,actorLane=1,reelTimer=0,lastFishingTimeout=0,lastKeyboardReel=0,serverClockOffset=0,selectedBait='worm',selectedSpot='shore',selectedCastZone='mid';
    let fishingV4Reeling=false,fishingV4Paying=false,fishingV4Steer=0,fishingV4Pointer=null,fishingV4ReelPointer=null,fishingV4PayPointer=null,fishingV4QueuedCast=false,fishingV4QueuedControl=false,fishingV4QueuedHook=false,fishingV4LastSync=0;
    let fishingV4CastPower=52,fishingV4ChargeStarted=0,fishingV4ChargePointer=null,fishingV4ChargeKey=false,fishingV4CastClickSuppressed=false;
    let fishingV4VisualChallenge=null,fishingV4VisualTension=10,fishingV4VisualDistance=100,fishingV4VisualAt=0;
    let fishingV5PositionAt=0,fishingV5Display=null,fishingV5Hud=null;
    let fishingV4ClockAnchor=null,fishingV4ClockPerf=0,fishingV4ClockLast=0,lastClockSample=null;
    let fishingResultShownAt=0;
    const fishingResultHeldKeys=new Set();
    let fishingRodLevel=0,fishingRodKnown=false,fishingRodNextCost=ROD_UPGRADE_COSTS[0];
    const reactionCounts={good:0,miss:0};
    const now=()=>performance.now();
    const fishingNow=()=>{
      if(kind==='fishing'&&fishingV4ClockAnchor!==null){
        fishingV4ClockLast=Math.max(fishingV4ClockLast,fishingV4ClockAnchor+now()-fishingV4ClockPerf);
        return fishingV4ClockLast;
      }
      return Date.now()+serverClockOffset;
    };
    function syncServerClock(response){
      const observed=Date.parse(response?.serverNow);if(!Number.isFinite(observed))return;
      serverClockOffset=observed-Date.now();
      if(kind!=='fishing'||![4,5].includes(response.minigame?.fishingVersion)&&![4,5].includes(response.minigame?.challenge?.fishingVersion))return;
      const sample=lastClockSample?.response===response?lastClockSample:null;
      const sampledAt=sample?(sample.sentAt+sample.receivedAt)/2:Date.now();
      const candidate=observed+Math.max(0,Date.now()-sampledAt);
      const previous=fishingV4ClockAnchor===null?0:fishingNow();
      fishingV4ClockAnchor=Math.max(previous,candidate);
      fishingV4ClockPerf=now();fishingV4ClockLast=fishingV4ClockAnchor;
    }
    const voice=()=>VOICES[keyOf(characterId)]||VOICES.luffy;
    const job=()=>JOBS[jobId]||JOBS.supply;
    const introLine=()=>kind==='training'?voice().training:JOB_LINES[jobId]?.[keyOf(characterId)]||voice().work;
    function updateTitle(){document.getElementById('roomMinigameTitle').textContent=kind==='fishing'?'千陽號海釣':kind==='work'?job().title:'甲板特訓';if(layer){layer.dataset.job=kind==='fishing'?'fishing':kind==='work'?jobId:'training';layer.querySelector('.room-minigame-head .room-minigame-eyebrow').textContent=kind==='fishing'?'FISHING ADVENTURE':'CREW CHALLENGE';}}
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
      layer.addEventListener('keydown',keyDown);layer.addEventListener('keyup',keyUp);
    }
    function portraitUrl(){const key=keyOf(characterId);return key==='robin'?`${ASSET}robin_v2/portrait.webp`:root.OnePieceReservedCrew?.assetUrl(key,'portrait.webp')||`${ASSET}${root.OnePieceRoomMotion?.LUFFY_ART_ENABLED===true&&key==='luffy'?'portrait_v4':'portrait_v3'}/${key}.webp`;}
    function open(input) {
      if(active()||!VOICES[keyOf(input.characterId)])return false;
      ensure();generation++;game=null;queued=null;requesting=false;lastRound='';lastResult='';lastFeedback=-1;practice=false;serverClockOffset=0;fishingV4ClockAnchor=null;fishingV4ClockPerf=0;fishingV4ClockLast=0;lastClockSample=null;fishingResultShownAt=0;fishingResultHeldKeys.clear();lastKeyboardReel=0;selectedBait='worm';selectedSpot='shore';selectedCastZone='mid';fishingV4CastPower=52;fishingV4ChargeStarted=0;fishingV4ChargePointer=null;fishingV4ChargeKey=false;fishingV4CastClickSuppressed=false;reactionCounts.good=0;reactionCounts.miss=0;kind=input.kind;characterId=input.characterId;phase='intro';previousFocus=document.activeElement;root.OnePieceRoomMotion?.preload(keyOf(characterId));
      jobId=kind==='fishing'?'fishing':JOBS[input.jobId]?input.jobId:'supply';held=true;options.onOpen?.(characterId);layer.hidden=false;updateTitle();document.getElementById('roomMinigameName').textContent=voice().name;
      const portrait=document.getElementById('roomMinigamePortrait');portrait.onerror=root.OnePieceRoomMotion?.LUFFY_ART_ENABLED===true&&keyOf(characterId)==='luffy'?()=>{portrait.onerror=null;portrait.src=`${ASSET}portrait_v3/luffy.webp`;}:null;portrait.src=portraitUrl();
      progress.replaceChildren();say(introLine());renderIntro();return true;
    }
    function button(label,fn,className='room-minigame-primary'){const b=node('button',className,label);b.type='button';b.onclick=fn;return b;}
    function updateFishingRod(response){
      const raw=response?.rod?.level??response?.life?.fishingRodLevel;
      if(!Number.isInteger(raw)||raw<0||raw>ROD_UPGRADE_COSTS.length)return;
      fishingRodLevel=raw;fishingRodKnown=true;
      const next=response?.rod?.nextCost;
      fishingRodNextCost=raw===ROD_UPGRADE_COSTS.length?null:Number.isInteger(next)&&next>=0?next:ROD_UPGRADE_COSTS[raw];
      updateRodWorkshop();
    }
    function updateRodWorkshop(){
      const workshop=body?.querySelector('.room-fishing-v4-workshop');if(!workshop)return;
      const level=fishingRodLevel,max=ROD_UPGRADE_COSTS.length,cost=fishingRodNextCost;
      workshop.querySelector('.room-fishing-v4-workshop-level').textContent=fishingRodKnown?`Lv ${level} / ${max}`:'資料讀取中';
      workshop.querySelector('.room-fishing-v4-workshop-current').textContent=!fishingRodKnown?'正在讀取釣竿狀態。':level===0?'目前：標準釣竿。':`目前：收線每秒多縮短 ${(level*.45).toFixed(2)} 距離；捲線時張力每秒少增加 ${(level*.4).toFixed(1)}。`;
      workshop.querySelector('.room-fishing-v4-workshop-next').textContent=!fishingRodKnown?'連上基地後才能改裝。':level===max?'已滿級；魚種與咬鉤機率不受釣竿等級影響。':'下一級：收線每秒再多縮短 0.45 距離，捲線時張力每秒再少增加 0.4；魚種與咬鉤機率不變。';
      const upgrade=workshop.querySelector('.room-fishing-v4-workshop-upgrade');
      upgrade.textContent=!fishingRodKnown?'釣竿資料讀取中':level===max?'已升至最高等級':`請佛朗基改裝 · ${cost} 金幣`;
      upgrade.disabled=requesting||!fishingRodKnown||level===max;
    }
    function rodWorkshop(){
      const workshop=node('details','room-fishing-v4-details room-fishing-v4-workshop');
      const summary=node('summary');summary.append(node('strong','','佛朗基的釣竿工房'),node('span','room-fishing-v4-workshop-level'));
      workshop.append(summary,node('p','room-fishing-v4-workshop-copy','騙人布想出釣具機關，佛朗基在千陽號工房加固魚竿。每次改裝都會讓收線稍快、張力累積稍慢。'),node('p','room-fishing-v4-workshop-current'),node('p','room-fishing-v4-workshop-next'));
      const upgrade=button('',()=>void upgradeFishingRod(),'room-fishing-v4-workshop-upgrade');workshop.append(upgrade,node('p','room-fishing-v4-workshop-feedback'));
      return workshop;
    }
    async function upgradeFishingRod(){
      if(kind!=='fishing'||phase!=='intro'||requesting||!fishingRodKnown||fishingRodLevel===ROD_UPGRADE_COSTS.length)return;
      const response=await request('rod.upgrade');if(!response)return;
      const workshop=body.querySelector('.room-fishing-v4-workshop');if(!workshop)return;
      workshop.open=true;
      if(response.ok){updateFishingRod(response);const message=`佛朗基已把釣竿改裝到 Lv ${fishingRodLevel}。下一竿就能用上新釣竿。`;workshop.querySelector('.room-fishing-v4-workshop-feedback').textContent=message;say(message);}
      else if(response.error==='offline'||response.error==='unavailable'){
        // The server may have committed the debit even if its reply was lost.
        // Block another purchase until a fresh life read resolves the level.
        fishingRodKnown=false;updateRodWorkshop();
        const message='改裝回應中斷，正在核對釣竿等級與金幣；核對完成前不能再次改裝。';
        workshop.querySelector('.room-fishing-v4-workshop-feedback').textContent=message;say(message);
        try{await options.refreshLife?.();}catch{}
        if(workshop.isConnected&&fishingRodKnown){
          workshop.querySelector('.room-fishing-v4-workshop-feedback').textContent=`已重新讀取釣竿：Lv ${fishingRodLevel}。請確認等級後再決定是否改裝。`;
        }
      }
      else{const message=ERRORS[response.error]||response.message||'改裝未完成，請稍後再試。';workshop.querySelector('.room-fishing-v4-workshop-feedback').textContent=message;say(message);}
    }
    function renderIntro(message='') {
      phase='intro';if(kind==='fishing')layer.dataset.fishingStage='intro';body.replaceChildren();const intro=node('div','room-minigame-intro');
      if(kind==='fishing'){
        const setup=node('div','room-fishing-v4-intro');
        const scene=node('div','room-fishing-v4-intro-scene');
        scene.style.backgroundImage='linear-gradient(90deg,#062735ad,#06273522),url("'+spotArt(selectedSpot)+'")';
        scene.append(node('span','room-fishing-v4-eyebrow','千陽號 · 自由海釣'),node('strong','',FISH_SPOTS[selectedSpot].label),node('span','',FISH_SPOTS[selectedSpot].note));
        const spots=node('fieldset','room-fishing-v4-choices room-fishing-v4-spots');spots.append(node('legend','','釣點'));
        for(const [id,definition] of Object.entries(FISH_SPOTS)){
          const choice=button(definition.label,()=>{selectedSpot=id;renderIntro();body.querySelector('[data-spot="'+id+'"]')?.focus({preventScroll:true});},'room-fishing-v4-choice');
          choice.dataset.spot=id;choice.setAttribute('aria-pressed',String(selectedSpot===id));choice.setAttribute('aria-label',definition.label+'，'+definition.note);
          choice.style.backgroundImage='linear-gradient(0deg,#092e40e8,#092e4070),url("'+spotArt(id)+'")';spots.append(choice);
        }
        const baits=node('fieldset','room-fishing-v4-choices room-fishing-v4-baits');baits.append(node('legend','','魚餌'));
        for(const [id,definition] of Object.entries(FISH_BAITS)){
          const choice=button('',()=>{selectedBait=id;renderIntro();body.querySelector('[data-bait="'+id+'"]')?.focus({preventScroll:true});},'room-fishing-v4-choice');
          choice.dataset.bait=id;choice.setAttribute('aria-pressed',String(selectedBait===id));choice.setAttribute('aria-label',definition.label+'，'+definition.note);
          const art=node('img');art.src=ASSET+'fishing_v3/bait-'+id+'.webp';art.alt='';art.draggable=false;
          choice.append(art,node('span','',definition.label));baits.append(choice);
        }
        const startButton=button('開始釣魚',()=>void start(),'room-fishing-v4-start');
        const note=node('p','room-fishing-v4-intro-note',(options.fishCollection?.()||[]).length>=64?'收藏已滿 64 尾；仍可釣魚，放生舊魚後才能收藏新魚。':'六處釣點有不同魚群；一竿成功釣起一尾就立即收藏，不消耗工作次數。');
        setup.append(scene,spots,baits,startButton,note);
        if(message)setup.append(node('p','room-minigame-error',message));
        const how=node('details','room-fishing-v4-details');how.append(node('summary','','怎麼釣？'));
        how.append(node('p','','按住拋竿鍵、Enter 或空白鍵，力度會在 0～100 之間持續往返；看準近、中、遠區段鬆開就拋竿。浮標猛沉時抽竿。上鉤後看魚游的方向，把竿往同一側帶；魚發力時先鬆開捲線，必要時按住放線，讓魚線強度回復。魚勢平穩再按住捲線。鍵盤可用空白鍵捲線、↓ 放線、← → 控竿。'));
        const collection=node('details','room-fishing-v4-details room-fishing-v4-collection');
        collection.append(node('summary','','我的漁獲收藏'),fishCollectionView());
        setup.append(rodWorkshop(),how,collection);intro.append(setup);body.append(intro);updateRodWorkshop();startButton.focus({preventScroll:true});return;
      }
      if(kind==='work'){
        const choices=node('div','room-minigame-jobs');choices.setAttribute('role','group');choices.setAttribute('aria-label','選擇工作');
        for(const [id,definition] of Object.entries(JOBS)){if(id==='fishing')continue;const option=button('',()=>{if(requesting)return;jobId=id;updateTitle();say(introLine());renderIntro();body.querySelector(`[data-job="${id}"]`)?.focus({preventScroll:true});},'room-minigame-job');option.dataset.job=id;option.setAttribute('aria-pressed',String(id===jobId));option.style.backgroundImage=`linear-gradient(0deg,#06242fe8,#082c3a22 75%),url("${ASSET}minigames_v1/${WORK_SCENES[id]}")`;option.append(node('span','room-minigame-job-guide',definition.guide),node('strong','',definition.title),node('span','',definition.short));choices.append(option);}
        intro.append(choices);
      }
      intro.classList.add('room-minigame-intro-visual');
      const hero=node('div','room-minigame-intro-hero');hero.style.backgroundImage=`linear-gradient(90deg,#062530da,#06253024),url("${ASSET}${kind==='work'?`minigames_v1/${WORK_SCENES[jobId]}`:'minigames_v2/training-deck.webp'}")`;
      hero.append(node('span','room-minigame-eyebrow',kind==='work'?'CREW WORK':'CREW TRAINING'),node('strong','',kind==='work'?job().short:'記住亮起的航道'),node('span','',kind==='work'?'過關最多 +10 金幣 · 可重複挑戰':'看路線，照順序踏上航道'));
      intro.append(hero);
      const rules=node('ol');for(const text of kind==='work'?job().rules:['共 4 段航道。先看依序亮起的安全位置，再照順序走。','使用 ←／↑／→ 或畫面上的三個方向鍵；↑ 代表中央航道。','路線由 3 步增至 5 步。完整通過 3 段即可過關，沒有戰鬥能力限制。'])rules.append(node('li','',text));const help=node('details','room-minigame-rules');help.append(node('summary','','操作與獎勵'),rules);intro.append(help);
      const warning=node('p','room-minigame-cost',practice?'自由練習 · 不領獎':kind==='work'?'不限次數 · 金幣持有上限 500 枚':'不限次數 · 提升工作意願與親密度');intro.append(warning);
      if(message)intro.append(node('p','room-minigame-error',message));
      const startButton=button(kind==='training'?'開始訓練':'開始挑戰',()=>void start());startButton.dataset.action='start';intro.append(startButton);
      if(kind==='fishing'||kind==='work'&&jobId==='fishing')intro.append(fishCollectionView());
      if(kind==='training'&&!practice)intro.append(button('先自由練習 · 不領獎',()=>{practice=true;renderIntro();},'room-minigame-secondary'));body.append(intro);startButton.focus({preventScroll:true});
    }
    function fishCollectionView(){
      const collection=node('section','room-fishing-collection');collection.append(node('h4','','我的漁獲收藏'));
      const fish=(options.fishCollection?.()||[]).filter(entry=>entry&&typeof entry.speciesId==='string');
      const discovered=new Set(fish.filter(entry=>Object.hasOwn(FISH_LABELS,entry.speciesId)).map(entry=>entry.speciesId)).size;
      collection.append(node('p','',fish.length?`已發現 ${discovered} / ${Object.keys(FISH_LABELS).length} 種，收藏 ${fish.length} / 64 尾；魚缸展示 ${fish.filter(entry=>entry.inAquarium).length} / 6 尾。${fish.length>=64?'收藏已滿；仍可釣魚，若要保存新魚請先放生一尾。':''}`:'尚未釣到魚。每次成功釣起一尾就會加入收藏。'));
      const list=node('div','room-fishing-collection-list');for(const entry of [...fish].reverse()){
        const card=node('div','room-fishing-collection-item');const art=node('img');art.src=fishArt(entry.speciesId);art.alt='';art.draggable=false;art.onerror=()=>hideMissingFishArt(art);
        const name=node('strong','',FISH_LABELS[entry.speciesId]||entry.label||'未知漁獲');const action=button(entry.inAquarium?'收回收藏':'放進水族箱',async()=>{
          const response=await request('fish.place',{fishId:entry.id,inAquarium:!entry.inAquarium});
          if(response?.ok){renderIntro();body.querySelector(`[data-fish-id="${entry.id}"]`)?.focus({preventScroll:true});say(entry.inAquarium?'已收回收藏。':'已放進水族箱。');options.onResult?.(game);}
          else if(response)say(ERRORS[response.error]||'目前無法變更魚缸展示，請稍後再試。');
        },'room-fishing-collection-action');action.dataset.fishId=entry.id;
        const release=button('放生',async()=>{
          if(release.dataset.confirmed!=='true'){release.dataset.confirmed='true';release.textContent='確定永久放生';release.classList.add('confirm-release');return;}
          const response=await request('fish.release',{fishId:entry.id});
          if(response?.ok){renderIntro();say(`${FISH_LABELS[entry.speciesId]||entry.label||'漁獲'}已放回海中。`);options.onResult?.(game);}
          else if(response)say('放生未完成，請稍後再試。');
        },'room-fishing-collection-action room-fishing-release');
        card.append(art,name,action,release);list.append(card);
      }collection.append(list);return collection;
    }
    async function request(type,payload={}) {
      if(requesting)return null;requesting=true;setDisabled(true);const current=generation,sentAt=Date.now();
      try {const response=await options.command(type,payload);if(current!==generation)return null;lastClockSample={response,sentAt,receivedAt:Date.now()};return response||{ok:false,error:'offline'};}
      catch{return current===generation?{ok:false,error:'offline'}:null;}
      finally{if(current===generation){requesting=false;setDisabled(false);updateRodWorkshop();updateFishingV2();updateFishingV4();}}
    }
    function setDisabled(value){if(!layer)return;layer.dataset.pending=String(value);for(const b of body.querySelectorAll('button'))b.disabled=(value&&b.dataset.fishAction!=='reel'&&!b.classList.contains('room-fishing-v4-reel')&&!b.classList.contains('room-fishing-v4-pay')&&!b.classList.contains('room-fishing-v4-hook'))||b.dataset.permanentDisabled==='true';}
    async function start(){if(phase!=='intro')return;const response=await request('minigame.start',{characterId,kind,...kind==='fishing'?{baitId:selectedBait,spotId:selectedSpot,fishingVersion:5}:kind==='work'?{jobId}:{},...kind==='work'&&jobId==='fishing'?{fishingVersion:2}:{},...practice?{practice:true}:{}});if(!response)return;if(response.minigame&&['playing','ready','failed'].includes(response.minigame.state)){game=response.minigame;if(game.characterId!==characterId||game.kind!==kind){renderRecovery();return;}accept(response);return;}renderIntro(kind==='fishing'&&response.error==='work_active'?'夥伴正在分工。完成原有分工後即可自由釣魚；釣魚不消耗工作次數。':ERRORS[response.error]||response.message||'暫時無法開始，請稍候再試。');}
    function renderRecovery(){phase='recovery';body.replaceChildren(node('h3','','上一次挑戰尚未結束'),node('p','','結束舊挑戰後，即可重新選擇夥伴。未完成的獎勵不會發放。'),button('結束舊挑戰',()=>void cancel(false)));say('不會自動領取獎勵。');}
    function accept(response) {
      if(!response?.minigame){showRetry(response);return;}
      syncServerClock(response);
      const previousFishingStage=game?.challenge?.id&&game.challenge.id===response.minigame.challenge?.id&&[2,3,4,5].includes(game.challenge.fishingVersion)?game.challenge.stage:null;
      game=response.minigame;
      if(kind==='work'){jobId=JOBS[game.jobId]?game.jobId:'supply';updateTitle();}
      if(kind==='fishing'){selectedBait=Object.hasOwn(FISH_BAITS,game.baitId)?game.baitId:selectedBait;selectedSpot=Object.hasOwn(FISH_SPOTS,game.spotId)?game.spotId:selectedSpot;}
      if(game.feedback&&game.feedback.roundIndex!==lastFeedback){lastFeedback=game.feedback.roundIndex;say(reaction(game.feedback.correct?'good':'miss'));}
      progress.textContent=kind==='fishing'&&game.fishingVersion===5?`${FISH_SPOTS[selectedSpot].label} · ${FISH_BAITS[selectedBait].label}`:kind==='fishing'?`${FISH_SPOTS[selectedSpot].label} · ${FISH_BAITS[selectedBait].label}　｜　一竿一尾，釣起就收藏`: `${kind==='work'?job().round:'航道'} ${Math.min(game.roundIndex+1,game.totalRounds)} / ${game.totalRounds}　｜　完成 ${game.correctRounds||0}　｜　連擊 ${game.combo||0}`;
      if(['completed','failed'].includes(game.state)){renderResult();return;}
      if(!['playing','ready'].includes(game.state)){renderEnded();return;}
      if(game.state==='ready'||!game.challenge){void finish();return;}
      if(lastRound===game.challenge.id){
        if(jobId==='fishing'&&[2,3,4,5].includes(game.challenge.fishingVersion)){
          if([4,5].includes(game.challenge.fishingVersion))updateFishingV4();else updateFishingV2();
          if(previousFishingStage!==game.challenge.stage){
            const target=[4,5].includes(game.challenge.fishingVersion)?body.querySelector(game.challenge.stage==='wait'?'.room-fishing-v4-hook':'.room-fishing-v4-reel')||layer:game.challenge.stage==='fight'?body.querySelector('[data-fish-action=reel]'):layer;
            target?.focus({preventScroll:true});
          }
        }
        return;
      }
      stopReeling();fishingV4Reeling=false;fishingV4Paying=false;fishingV4Steer=0;fishingV4ChargeStarted=0;fishingV4ChargePointer=null;fishingV4ChargeKey=false;fishingV4PayPointer=null;fishingV4ReelPointer=null;fishingV4CastClickSuppressed=false;fishingV4QueuedCast=false;fishingV4QueuedControl=false;fishingV4QueuedHook=false;fishingV4VisualChallenge=null;fishingV5Display=null;fishingV5Hud=null;lastRound=game.challenge.id;choice=[];directions=[];ingredients=[];rotations=game.challenge.tiles?.map(tile=>tile.rotation)||[];course=Number.isInteger(game.challenge.start)?[game.challenge.start]:[];counterMoves=[];queued=null;roundStart=now();phase=jobId==='fishing'&&[2,3,4,5].includes(game.challenge.fishingVersion)?'answer':'showcase';renderRound();cancelAnimationFrame(frame);frame=requestAnimationFrame(tick);
    }
    function renderRound() {
      body.replaceChildren();const challenge=game.challenge;
      const stage=node('div',`room-minigame-stage ${kind} ${kind==='work'?'job-'+jobId:''} ${jobId==='fishing'&&[2,3].includes(challenge.fishingVersion)?'fishing-v2':''} ${kind==='fishing'?'fishing-v3':''}`);stage.dataset.round=String(game.roundIndex);body.append(stage);
      const heading=node('div','room-minigame-order');heading.append(node('span','room-minigame-round-number',`0${game.roundIndex+1}`));
      heading.append(node('strong','',kind==='fishing'?`${FISH_SPOTS[selectedSpot].label} · ${FISH_BAITS[selectedBait].label} · 拋竿釣魚`:kind!=='work'?'記住安全航道':jobId==='supply'?`這一批需要：${challenge.order?.label||{food:'食材',tools:'工具',books:'書籍'}[challenge.order?.category]||'補給'}`:jobId==='cooking'?challenge.recipeLabel||'依序備好食材':jobId==='repair'?'入口 → 接通管線 → 出口':jobId==='navigation'?'避開暗礁 · 航向港口':jobId==='fishing'&&challenge.fishingVersion===2?'拋竿 → 浮標下沉 → 抽竿 → 控制張力':'魚影正在拉扯魚線'));stage.append(heading);
      const timer=node('div','room-minigame-timer');timer.setAttribute('role','progressbar');timer.setAttribute('aria-label','這一輪剩餘時間');timer.setAttribute('aria-valuemin','0');timer.setAttribute('aria-valuemax','100');timer.append(node('span'));stage.append(timer);
      const hint=node('p','room-minigame-hint');hint.id='roomMinigameHint';stage.append(hint);
      if(kind==='fishing'&&[4,5].includes(challenge.fishingVersion)){
        stage.classList.add('fishing-v4');if(challenge.fishingVersion===5)stage.classList.add('fishing-v5');layer.dataset.fishingVersion=String(challenge.fishingVersion);renderFishingV4(stage,challenge);
      }else if(kind==='work'&&jobId==='supply') {
        const belt=node('div','room-minigame-belt');challenge.crates.forEach((crate,index)=>{
          const label={food:'食材箱',tools:'工具箱',books:'書籍航圖箱'}[crate.category];const cargo=button('',()=>selectCargo(index),'room-minigame-cargo');cargo.dataset.index=String(index);cargo.setAttribute('aria-pressed','false');cargo.setAttribute('aria-label',`${index+1}：${label}`);
          const art=node('img');art.src=`${ASSET}minigames_v1/cargo-${crate.category}.webp`;art.alt='';art.draggable=false;art.style.setProperty('--cargo-order',String(index));cargo.append(node('kbd','',String(index+1)),art,node('strong','',label),node('span','room-minigame-cargo-state','點選裝船'));belt.append(cargo);
        });stage.append(belt);stage.append(button('裝船 · Enter',()=>void submit(),'room-minigame-primary room-minigame-submit'));
      }else if(kind==='work') {
        if(jobId==='cooking')renderCooking(stage,challenge);
        else if(jobId==='repair')renderRepair(stage,challenge);
        else if(jobId==='fishing')challenge.fishingVersion===2?renderFishingV2(stage,challenge):renderFishing(stage,challenge);
        else renderNavigation(stage,challenge);
      }else if(kind==='fishing'){
        renderFishingV2(stage,challenge);
      }else {
        const lanes=node('div','room-minigame-lanes');for(const dir of DIRS){const lane=node('div','room-minigame-lane');lane.dataset.direction=dir;lane.append(node('span','room-minigame-lane-arrow',ARROWS[dir]),node('span','room-minigame-lane-name',DIR_NAMES[dir]));lanes.append(lane);}const token=node('canvas','room-minigame-runner');token.setAttribute('role','img');token.setAttribute('aria-label',voice().name+'完整人物');token.dataset.lane='up';lanes.append(token);stage.append(lanes);actorLane=1;actorStep=null;cancelAnimationFrame(actorFrame);actorFrame=requestAnimationFrame(paintActor);
        const steps=node('div','room-minigame-steps');for(let i=0;i<challenge.directions.length;i++){const dot=node('span','',String(i+1));dot.setAttribute('aria-label',`第 ${i+1} 步`);steps.append(dot);}stage.append(steps);
        const controls=node('div','room-minigame-directions');for(const dir of DIRS){const b=button(ARROWS[dir],()=>inputDirection(dir),'room-minigame-direction');b.dataset.direction=dir;b.setAttribute('aria-label',DIR_NAMES[dir]);controls.append(b);}stage.append(controls);
      }
      if(game.feedback){const result=node('div',`room-minigame-round-result ${game.feedback.correct?'correct':'miss'}`,game.feedback.correct?'上一輪完整通過！':'上一輪有遺漏或失誤，穩住再來。');stage.append(result);}
      if(!(jobId==='fishing'&&[2,3,4,5].includes(challenge.fishingVersion)))stage.querySelectorAll('button').forEach(b=>{b.disabled=true;});
      layer.focus({preventScroll:true});
    }
    function foodArt(id){const art=node('img','room-minigame-food-art');art.src=ingredientArt(id);art.alt='';art.draggable=false;return art;}
    function renderCooking(stage,challenge){
      const recipe=node('ol','room-minigame-recipe');recipe.setAttribute('aria-label','食譜順序');
      for(const [index,id] of challenge.recipe.entries()){const ingredient=challenge.ingredients.find(value=>value.id===id);const item=node('li');item.append(node('small','',String(index+1)),foodArt(id),node('span','',ingredient?.label||id));recipe.append(item);}stage.append(recipe);
      const tray=node('div','room-minigame-prep');tray.setAttribute('aria-label','目前備料順序');for(let index=0;index<challenge.recipe.length;index++){const slot=node('span','room-minigame-prep-slot');slot.append(node('small','',String(index+1)),node('strong','','待備料'));tray.append(slot);}stage.append(tray);
      const controls=node('div','room-minigame-ingredients');challenge.ingredients.forEach((ingredient,index)=>{const b=button('',()=>addIngredient(index),'room-minigame-ingredient');b.dataset.ingredient=ingredient.id;b.append(node('kbd','',String(index+1)),foodArt(ingredient.id),node('strong','',ingredient.label));controls.append(b);});stage.append(controls);
      const actions=node('div','room-minigame-puzzle-actions');actions.append(button('退回一份',()=>undoInput(),'room-minigame-secondary'),button('完成備料 · Enter',()=>void submit()));stage.append(actions);
    }
    function addIngredient(index){if(phase!=='answer'||requesting||jobId!=='cooking'||ingredients.length>=game.challenge.recipe.length)return;const ingredient=game.challenge.ingredients[index];if(!ingredient)return;ingredients.push(ingredient.id);updateIngredients();}
    function updateIngredients(){body.querySelectorAll('.room-minigame-prep-slot').forEach((slot,index)=>{const id=ingredients[index],label=game.challenge.ingredients.find(item=>item.id===id)?.label||'待備料';slot.replaceChildren(node('small','',String(index+1)),...(id?[foodArt(id)]:[]),node('strong','',label));slot.classList.toggle('filled',!!id);});}
    function pipeGraphic(tile,rotation){
      const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('aria-hidden','true');const points={north:'50 0',east:'100 50',south:'50 100',west:'0 50'};
      const route=pipeSides(tile,rotation).map(side=>`M50 50 L${points[side]}`).join(' ');
      for(const [name,width,color] of [['outer',43,'#29333a'],['rim',37,'#bd9655'],['metal',29,'#456f77'],['water',17,'#66bed1']]){const line=document.createElementNS(ns,'path');line.setAttribute('d',route);line.setAttribute('fill','none');line.setAttribute('stroke',color);line.setAttribute('stroke-width',String(width));line.setAttribute('stroke-linecap','butt');line.setAttribute('class',`room-pipe-${name}`);svg.append(line);}
      const hub=document.createElementNS(ns,'circle');hub.setAttribute('cx','50');hub.setAttribute('cy','50');hub.setAttribute('r','16');hub.setAttribute('class','room-pipe-hub');svg.append(hub);return svg;
    }
    function renderRepair(stage,challenge){
      const board=node('div','room-minigame-pipe-board');board.setAttribute('aria-label','三乘三管路，左側進水，右側出水');
      challenge.tiles.forEach((tile,index)=>{const b=button('',()=>rotatePipe(index),'room-minigame-pipe');b.dataset.pipe=String(index);if(index===challenge.entry.index)b.dataset.entry=challenge.entry.side;if(index===challenge.exit.index)b.dataset.exit=challenge.exit.side;b.append(node('kbd','',String(index+1)),pipeGraphic(tile,rotations[index]));board.append(b);});stage.append(board);updatePipes();
      const legend=node('p','room-minigame-puzzle-note','入口 → 出口 · 點管線旋轉');stage.append(legend);
      const actions=node('div','room-minigame-puzzle-actions');actions.append(button('還原管線',()=>{if(phase!=='answer'||requesting)return;rotations=challenge.tiles.map(tile=>tile.rotation);updatePipes();},'room-minigame-secondary'),button('測試通水 · Enter',()=>void submit()));stage.append(actions);
    }
    function rotatePipe(index){if(phase!=='answer'||requesting||jobId!=='repair'||!game.challenge.tiles[index])return;rotations[index]=(rotations[index]+1)%4;updatePipes();}
    function updatePipes(){
      const challenge=game.challenge,flow=new Set(),entry=challenge.entry.index;
      if(pipeSides(challenge.tiles[entry],rotations[entry]).includes(challenge.entry.side)){
        const queue=[entry];flow.add(entry);
        for(const index of queue){const row=Math.floor(index/3),col=index%3;
          for(const [side,neighbor] of [['north',row>0?index-3:-1],['east',col<2?index+1:-1],['south',row<2?index+3:-1],['west',col>0?index-1:-1]]){
            if(neighbor<0||flow.has(neighbor)||!pipeSides(challenge.tiles[index],rotations[index]).includes(side))continue;
            const opposite=PIPE_SIDES[(PIPE_SIDES.indexOf(side)+2)%4];
            if(pipeSides(challenge.tiles[neighbor],rotations[neighbor]).includes(opposite)){flow.add(neighbor);queue.push(neighbor);}
          }
        }
      }
      body.querySelectorAll('.room-minigame-pipe').forEach((b,index)=>{const tile=challenge.tiles[index];b.querySelector('svg').replaceWith(pipeGraphic(tile,rotations[index]));b.setAttribute('aria-label',`管線 ${index+1}，${tile.type==='straight'?'直管':'彎管'}，開口朝${pipeSides(tile,rotations[index]).map(side=>SIDE_NAMES[side]).join('、')}，點一下順時針旋轉`);b.dataset.rotation=String(rotations[index]);b.dataset.flow=String(flow.has(index));});
      const board=body.querySelector('.room-minigame-pipe-board');if(board)board.dataset.connected=String(flow.has(challenge.exit.index)&&pipeSides(challenge.tiles[challenge.exit.index],rotations[challenge.exit.index]).includes(challenge.exit.side));
    }
    function renderNavigation(stage,challenge){
      const board=node('div','room-minigame-chart');board.setAttribute('aria-label','四乘四海圖');
      for(let index=0;index<challenge.size*challenge.size;index++){const reef=challenge.blocked.includes(index),b=button('',()=>plotCourse(index),'room-minigame-sea-cell');b.dataset.cell=String(index);b.dataset.reef=String(reef);if(reef){b.dataset.permanentDisabled='true';b.disabled=true;}const label=index===challenge.start?'起點':index===challenge.goal?'港口':reef?'暗礁':'海面';b.dataset.label=label;b.setAttribute('aria-label',`海圖第 ${Math.floor(index/challenge.size)+1} 列第 ${index%challenge.size+1} 格，${label}`);if(reef||index===challenge.goal){const icon=node('img','room-minigame-nav-art');icon.src=`${ASSET}minigames_v2/nav-${reef?'reef':'port'}.webp`;icon.alt='';icon.draggable=false;b.append(icon);}b.append(node('span','room-minigame-cell-label',label),node('strong','room-minigame-cell-order',''));board.append(b);}stage.append(board);
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
    function updateCourse(){body.querySelectorAll('.room-minigame-sea-cell').forEach((b,index)=>{const order=course.indexOf(index),current=index===course[course.length-1];b.classList.toggle('on-course',order>=0);b.classList.toggle('current',current);b.setAttribute('aria-pressed',String(order>=0));b.querySelector('.room-minigame-cell-order').textContent=order<0?'':order===0?'起':String(order);});const budget=body.querySelector('.room-minigame-course-budget');if(budget)budget.textContent=`${course.length-1} / ${game.challenge.maxSteps} 步 · ${course.at(-1)===game.challenge.goal?'抵達港口':'前往港口'}`;}
    function stopReeling(){if(reelTimer){clearInterval(reelTimer);reelTimer=0;}}
    async function sendFishingAction(action){
      if(phase!=='answer'||requesting||jobId!=='fishing'||![2,3].includes(game?.challenge?.fishingVersion))return;
      const currentRound=game.challenge.id;
      const response=await request('minigame.answer',{sessionId:game.id,token:game.token,roundId:currentRound,counterMoves:[action],...(action==='cast'&&game.challenge.fishingVersion===3?{castZone:selectedCastZone}:{})});
      if(!response)return;
      if(response.ok){accept(response);return;}
      if(response.error==='fishing_action_cooldown')return;
      if(response.error==='minigame_round_conflict'&&response.minigame?.roundIndex>game.roundIndex){accept(response);return;}
      if(response.minigame&&['expired','cancelled','invalidated'].includes(response.minigame.state)){accept(response);return;}
      say(ERRORS[response.error]||'海釣操作暫時沒有送達；請看浮標後再試一次。');
    }
    function positionFishingV3(sea,id){
      if(sea.dataset.castZone===id)return;
      const zone=FISH_CAST_ZONES[id]||FISH_CAST_ZONES.mid;
      sea.style.setProperty('--cast-x',`${zone.x}%`);sea.style.setProperty('--cast-y',`${zone.y}%`);sea.dataset.castZone=id;
      const line=sea.querySelector('.room-fishing-v2-line .v3-line');
      if(line)line.setAttribute('d',`M 520 210 Q ${Math.round((520+zone.x*10)/2)} 160 ${zone.x*10} ${Math.round(zone.y*5.6)}`);
      sea.querySelectorAll('.room-fishing-v3-zone').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.castZone===id)));
    }
    function selectFishingCastZone(id){
      if(kind!=='fishing'||phase!=='answer'||game?.challenge?.stage!=='cast'||!Object.hasOwn(FISH_CAST_ZONES,id))return;
      selectedCastZone=id;const sea=body.querySelector('.room-fishing-v3-sea');if(sea)positionFishingV3(sea,id);updateFishingV2();
    }
    function renderFishingV2(stage,challenge){
      const isV3=challenge.fishingVersion===3,spot=FISH_SPOTS[selectedSpot]||FISH_SPOTS.shore;
      const sea=node('div',`room-fishing-sea room-fishing-v2-sea${isV3?' room-fishing-v3-sea':''}`);sea.setAttribute('role',isV3?'group':'img');sea.setAttribute('aria-label',isV3?`${spot.label}海釣畫面，觀察浮標與魚影並操作下緣按鈕`:'放大的海面、釣竿、魚線、浮標及魚影');
      if(isV3){sea.dataset.spot=selectedSpot;sea.style.backgroundImage=`linear-gradient(0deg,#04283866,transparent 45%),url("${ASSET}fishing_v3/sea-${selectedSpot}.webp")`;}
      const rod=node('img','room-fishing-v2-rod');rod.src=`${ASSET}fishing_v2/rod.webp`;rod.alt='';rod.draggable=false;
      const line=document.createElementNS('http://www.w3.org/2000/svg','svg');line.setAttribute('class','room-fishing-v2-line');line.setAttribute('viewBox','0 0 1000 560');line.setAttribute('preserveAspectRatio','none');
      for(const [name,shape] of [['desktop-wait','M 520 210 Q 585 195 650 275'],['desktop-fight','M 520 210 Q 590 190 650 275'],['mobile-wait','M 520 220 Q 590 205 650 196'],['mobile-fight','M 520 220 Q 590 200 650 196']]){const curve=document.createElementNS('http://www.w3.org/2000/svg','path');curve.setAttribute('class',name);curve.setAttribute('d',shape);line.append(curve);}
      if(isV3){const curve=document.createElementNS('http://www.w3.org/2000/svg','path');curve.setAttribute('class','v3-line');line.append(curve);}
      const shadow=node('img','room-fishing-v2-shadow');shadow.src=`${ASSET}fish_v1/balloon-catfish.webp`;shadow.alt='';shadow.draggable=false;
      const splash=node('img','room-fishing-v2-splash');splash.src=`${ASSET}fishing_v2/splash.webp`;splash.alt='';splash.draggable=false;
      const float=node('img','room-fishing-v2-bobber');float.src=`${ASSET}fishing_v2/bobber.webp`;float.alt='';float.draggable=false;
      const seaCaption=node('span','room-fishing-v2-sea-caption');seaCaption.textContent=isV3?`千陽號 · ${spot.label} · ${FISH_BAITS[selectedBait].label}`:'千陽號船舷 · 海釣';
      sea.append(node('div','room-fishing-wake'),shadow,line,rod,splash,float,seaCaption);
      if(isV3){
        const zones=node('div','room-fishing-v3-zones');zones.setAttribute('role','group');zones.setAttribute('aria-label','選擇拋竿落點，近處、中距或遠處');
        for(const [id,definition] of Object.entries(FISH_CAST_ZONES)){
          const choice=button(`${definition.key} ${definition.label}`,()=>selectFishingCastZone(id),'room-fishing-v3-zone');choice.dataset.castZone=id;choice.style.setProperty('--zone-x',`${definition.x}%`);choice.style.setProperty('--zone-y',`${definition.y}%`);choice.setAttribute('aria-pressed',String(selectedCastZone===id));choice.setAttribute('aria-label',`${definition.label}，按下後再點拋竿`);zones.append(choice);
        }
        sea.append(zones);
        const target=node('div','room-fishing-v3-target');target.setAttribute('aria-hidden','true');sea.append(target);sea.append(node('div','room-fishing-v3-fish-cue'));
        positionFishingV3(sea,challenge.castZone||selectedCastZone);
      }
      stage.append(sea);
      const steps=node('div','room-fishing-v2-steps');for(const label of ['1 拋竿','2 看浮標','3 抽竿','4 捲線'])steps.append(node('span','',label));stage.append(steps);
      const panel=node('div','room-fishing-v2-panel');const signal=node('strong','room-fishing-v2-signal');signal.setAttribute('aria-live','polite');const sub=node('span','room-fishing-v2-sub');panel.append(signal,sub);(isV3?sea:stage).append(panel);
      const meters=node('div','room-fishing-v2-meters');for(const [type,label] of [['distance','魚離船舷'],['tension','魚線張力']]){const meter=node('div',`room-fishing-v2-meter ${type}`);const title=node('div','room-fishing-v2-meter-title');title.append(node('strong','',label),node('span','',type==='distance'?'100 %':'12 %'));const track=node('div','room-fishing-v2-track');track.setAttribute('role','progressbar');track.setAttribute('aria-label',label);track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.append(node('span'));meter.append(title,track);meters.append(meter);}(isV3?sea:stage).append(meters);
      const actions=node('div','room-fishing-v2-actions');
      const cast=button(isV3?'瞄準後拋竿 · Enter':'拋竿 · Enter',()=>void sendFishingAction('cast'),'room-fishing-v2-action primary');cast.dataset.fishAction='cast';
      const hook=button('浮標沉了！抽竿 · Enter',()=>void sendFishingAction('hook'),'room-fishing-v2-action hook');hook.dataset.fishAction='hook';
      const reel=node('button','room-fishing-v2-action reel','按住捲線 · 空白鍵');reel.type='button';reel.dataset.fishAction='reel';
      reel.addEventListener('pointerdown',event=>{if(reel.disabled||event.button!==0)return;event.preventDefault();void sendFishingAction('reel');stopReeling();reelTimer=setInterval(()=>void sendFishingAction('reel'),560);});
      const slack=button('放線 · ↓',()=>void sendFishingAction('slack'),'room-fishing-v2-action slack');slack.dataset.fishAction='slack';
      actions.append(cast,hook,reel,slack);
      if(isV3){for(const [action,label] of [['steerLeft','← 向左牽制'],['steerRight','向右牽制 →']]){const steer=button(label,()=>void sendFishingAction(action),'room-fishing-v2-action steer');steer.dataset.fishAction=action;actions.append(steer);}}
      (isV3?sea:stage).append(actions);
      updateFishingV2();
    }
    function updateFishingV2(){
      const challenge=game?.challenge;if(jobId!=='fishing'||![2,3].includes(challenge?.fishingVersion))return;
      const sea=body.querySelector('.room-fishing-v2-sea');if(!sea)return;
      if(challenge.fishingVersion===3){if(Object.hasOwn(FISH_CAST_ZONES,challenge.castZone))selectedCastZone=challenge.castZone;positionFishingV3(sea,selectedCastZone);}
      const at=fishingNow(),biting=challenge.stage==='wait'&&at>=Date.parse(challenge.biteAt),nibbling=challenge.stage==='wait'&&!biting&&at>=Date.parse(challenge.biteAt)-1250;
      sea.dataset.stage=challenge.stage;sea.dataset.biting=String(biting);sea.dataset.nibbling=String(nibbling);sea.dataset.pull=challenge.pull||'steady';sea.dataset.pullDirection=challenge.pullDirection||'steady';
      const activeStep=challenge.stage==='cast'?0:challenge.stage==='wait'?biting?2:1:3;
      body.querySelectorAll('.room-fishing-v2-steps span').forEach((item,index)=>{item.classList.toggle('active',index===activeStep);item.classList.toggle('done',index<activeStep);});
      const direction=challenge.fishingVersion===3?challenge.pullDirection||'steady':'steady';
      const text=challenge.stage==='cast'?(challenge.fishingVersion===3?`點海面選${FISH_CAST_ZONES[selectedCastZone].label}，再拋出${FISH_BAITS[selectedBait].label}。`:'先拋竿，浮標會落在海面上。'):challenge.stage==='wait'?(biting?'浮標沉下去了！現在抽竿！':nibbling?'魚在試餌，只是輕晃；等浮標整個沉下。':'盯著浮標；魚影靠近時先別抽竿。'):direction==='left'?'魚往左衝！向右牽制或先放線。':direction==='right'?'魚往右衝！向左牽制或先放線。':direction==='deep'?'魚猛往深處鑽！先放線減張力。':challenge.pull==='surge'?'魚正在猛衝！張力高就放線。':'魚已上鉤！按住捲線，留意張力。';
      const signal=body.querySelector('.room-fishing-v2-signal');if(signal&&signal.textContent!==text)signal.textContent=text;
      const hint=body.querySelector('#roomMinigameHint');if(hint&&hint.textContent!==text)hint.textContent=text;
      const sub=body.querySelector('.room-fishing-v2-sub');if(sub)sub.textContent=challenge.stage==='wait'?biting?`抽竿窗口還有 ${Math.max(0,((Date.parse(challenge.hookUntil)-at)/1000)).toFixed(1)} 秒`:'浮標會先輕啄再猛沉；只在沉下時抽竿。':challenge.stage==='fight'?'張力過高會斷線；放線可讓魚冷靜。':challenge.fishingVersion===3?'按 ↑／↓ 或點海面圈選落點。':'點按拋竿，從船舷把浮標送出去。';
      const fishCue=sea.querySelector('.room-fishing-v3-fish-cue');if(fishCue){const cue=challenge.stage==='fight'?direction==='left'?'← 魚往左 · 向右牽制':direction==='right'?'魚往右 → · 向左牽制':direction==='deep'?'↓ 魚往深處 · 放線':'魚勢平穩 · 趁現在捲線':'';if(fishCue.textContent!==cue)fishCue.textContent=cue;}
      const actions=body.querySelectorAll('[data-fish-action]');for(const action of actions){const type=action.dataset.fishAction;action.hidden=!(type==='cast'&&challenge.stage==='cast'||type==='hook'&&challenge.stage==='wait'||['reel','slack','steerLeft','steerRight'].includes(type)&&challenge.stage==='fight'&&(challenge.fishingVersion===3||!type.startsWith('steer')));if(type==='hook')action.disabled=!biting||requesting;}
      for(const [type,value] of [['distance',challenge.distance],['tension',challenge.tension]]){const meter=body.querySelector(`.room-fishing-v2-meter.${type}`);if(!meter)continue;const amount=clamp(value,0,100);meter.querySelector('.room-fishing-v2-track span').style.width=`${amount}%`;meter.querySelector('.room-fishing-v2-track').setAttribute('aria-valuenow',String(Math.round(amount)));meter.querySelector('.room-fishing-v2-meter-title span').textContent=`${Math.round(amount)} %`;if(type==='tension')meter.dataset.risk=amount>=78?'danger':amount>=55?'warning':'safe';}
    }
    function tickFishingV2(){
      updateFishingV2();const challenge=game?.challenge;if(!challenge||![2,3].includes(challenge.fishingVersion))return;
      if(challenge.stage==='wait'&&fishingNow()>Date.parse(challenge.hookUntil)+150&&!requesting&&now()-lastFishingTimeout>1300){lastFishingTimeout=now();void sendFishingAction('timeout');}
      if(challenge.stage==='fight'&&fishingNow()>Date.parse(challenge.fightUntil)+150&&!requesting&&now()-lastFishingTimeout>1300){lastFishingTimeout=now();void sendFishingAction('timeout');}
    }
    function fishingV4Challenge(){const challenge=game?.challenge;return kind==='fishing'&&[4,5].includes(challenge?.fishingVersion)?challenge:null;}
    function fishingV4CastZone(power){return power<35?'near':power<70?'mid':'far';}
    function fishingV5CastPower(elapsed){const leg=(Math.max(0,elapsed)%2400)/1200;return Math.round((leg<=1?leg:2-leg)*100);}
    function fishingV4CastTarget(power){return{x:46+.35*power,y:55-.21*power};}
    function fishingV4SteerAt(sea,event){const rect=sea.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width;return x<.42?-1:x>.58?1:0;}
    function setFishingV4Power(power){
      fishingV4CastPower=clamp(Math.round(power),0,100);selectedCastZone=fishingV4CastZone(fishingV4CastPower);
      const sea=body?.querySelector('.room-fishing-v4-sea');if(!sea)return;
      const point=fishingV4CastTarget(fishingV4CastPower);sea.dataset.castZone=selectedCastZone;
      sea.style.setProperty('--cast-x',point.x+'%');sea.style.setProperty('--cast-y',point.y+'%');
      sea.style.setProperty('--cast-power',fishingV4CastPower+'%');
      const readout=sea.querySelector('.room-fishing-v4-cast-readout');if(readout)readout.textContent=`${fishingV4CastPower}% · ${FISH_CAST_ZONES[selectedCastZone].label}`;
      const track=sea.querySelector('.room-fishing-v4-cast-track');if(track)track.setAttribute('aria-valuenow',String(fishingV4CastPower));
      if(fishingV4Challenge()?.fishingVersion===5)sea.querySelectorAll('.room-fishing-v4-cast-zones span').forEach((label,index)=>label.classList.toggle('active',['near','mid','far'][index]===selectedCastZone));
    }
    function startFishingV4Charge(){
      if(fishingV4Challenge()?.stage!=='cast'||fishingV4ChargeStarted)return;
      fishingV4ChargeStarted=now();setFishingV4Power(0);
      const sea=body.querySelector('.room-fishing-v4-sea');if(sea)sea.dataset.charging='true';
    }
    function finishFishingV4Charge(){
      if(!fishingV4ChargeStarted)return;
      setFishingV4Power(fishingV4Challenge()?.fishingVersion===5?fishingV5CastPower(now()-fishingV4ChargeStarted):Math.max(8,(now()-fishingV4ChargeStarted)/15));
      fishingV4ChargeStarted=0;
      const sea=body?.querySelector('.room-fishing-v4-sea');if(sea){
        sea.dataset.charging='false';sea.classList.add('cast-release');setTimeout(()=>sea.classList.remove('cast-release'),560);
        if(fishingV4Challenge()?.fishingVersion===5){sea.classList.add('line-settling');setTimeout(()=>sea.classList.remove('line-settling'),850);}
      }
      void sendFishingV4Action('cast');
    }
    function setFishingV4Control(reeling,steer,paying=fishingV4Paying){
      const challenge=fishingV4Challenge();if(!challenge||challenge.stage!=='fight')return;
      if(body?.querySelector('.room-minigame-confirm'))return;
      // A second finger may keep moving on the reel pad while the pay button
      // is held. The active pay pointer always takes priority until release.
      const nextPaying=Boolean(paying)||fishingV4PayPointer!==null,nextReeling=Boolean(reeling)&&!nextPaying,nextSteer=Math.sign(clamp(steer,-1,1));
      if(fishingV4Reeling===nextReeling&&fishingV4Steer===nextSteer&&fishingV4Paying===nextPaying)return;
      fishingV4Reeling=nextReeling;fishingV4Paying=nextPaying;fishingV4Steer=nextSteer;
      const sea=body.querySelector('.room-fishing-v4-sea');if(sea){sea.dataset.reeling=String(nextReeling);sea.dataset.paying=String(nextPaying);sea.dataset.steer=String(nextSteer);}
      const control=body.querySelector('.room-fishing-v4-reel');if(control)control.dataset.reeling=String(nextReeling);
      const pay=body.querySelector('.room-fishing-v4-pay');if(pay)pay.dataset.paying=String(nextPaying);
      return sendFishingV4Action('control');
    }
    async function sendFishingV4Action(action){
      const challenge=fishingV4Challenge();if(phase!=='answer'||!challenge)return;
      if(requesting){if(action==='cast')fishingV4QueuedCast=true;if(action==='control')fishingV4QueuedControl=true;if(action==='hook')fishingV4QueuedHook=true;return;}
      fishingV4LastSync=now();
      const payload={sessionId:game.id,token:game.token,roundId:challenge.id,counterMoves:[action]};
      if(action==='cast'){payload.castZone=selectedCastZone;payload.castPower=fishingV4CastPower;}
      if(action==='control'){payload.reeling=fishingV4Reeling;payload.steer=fishingV4Steer;payload.paying=fishingV4Paying;}
      const response=await request('minigame.answer',payload);
      if(response?.ok)accept(response);
      else if(response?.error==='fishing_action_cooldown'){}
      else if(response?.minigame&&['expired','cancelled','invalidated'].includes(response.minigame.state))accept(response);
      else if(response?.error==='minigame_round_conflict'&&response.minigame?.roundIndex>game.roundIndex)accept(response);
      else if(response)say(ERRORS[response.error]||'海釣連線暫時中斷，保持魚線並重試。');
      if(fishingV4QueuedCast&&fishingV4Challenge()?.stage==='cast'&&phase==='answer'){
        fishingV4QueuedCast=false;queueMicrotask(()=>void sendFishingV4Action('cast'));
      }else if(fishingV4QueuedHook&&fishingV4Challenge()?.stage==='wait'&&phase==='answer'){
        fishingV4QueuedHook=false;queueMicrotask(()=>void sendFishingV4Action('hook'));
      }else if(fishingV4QueuedControl&&fishingV4Challenge()?.stage==='fight'&&phase==='answer'){
        fishingV4QueuedControl=false;queueMicrotask(()=>void sendFishingV4Action('control'));
      }
    }
    function renderFishingV4(stage,challenge){
      const isV5=challenge.fishingVersion===5;
      const sea=node('div','room-fishing-v4-sea');sea.dataset.spot=selectedSpot;sea.setAttribute('role','group');sea.setAttribute('aria-label',isV5?'千陽號釣魚海面。按住拋竿蓄力、放開決定距離；浮標沉下時抽竿；上鉤後看魚的方向，把釣竿帶往同側，鬆開捲線回復魚線強度。':'千陽號釣魚海面。按住拋竿蓄力、放開決定距離；浮標沉下時抽竿；上鉤後拖動捲線控制左右方向，魚線過緊時按住放線。');
      sea.style.backgroundImage='linear-gradient(0deg,#04283850,transparent 52%),url("'+spotArt(selectedSpot)+'")';
      const water=node('div','room-fishing-v4-water'),fish=node('div','room-fishing-v4-fish'),target=node('div','room-fishing-v4-target');
      // The actual catch stays hidden until landing; a neutral water shadow
      // avoids showing a shark silhouette before a clam or octopus is caught.
      fish.setAttribute('aria-hidden','true');
      const line=document.createElementNS('http://www.w3.org/2000/svg','svg');line.setAttribute('class','room-fishing-v4-line');line.setAttribute('viewBox','0 0 1000 600');line.setAttribute('preserveAspectRatio','none');
      for(const className of ['room-fishing-v4-line-shadow','room-fishing-v4-line-thread']){
        const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('class',className);line.append(path);
      }
      const rod=node('img','room-fishing-v4-rod');rod.src=ASSET+(isV5?'fishing_v5/rod-no-line-v1.webp':'fishing_v2/rod.webp');rod.alt='';rod.draggable=false;rod.addEventListener('load',()=>updateFishingV4());
      const splash=node('img','room-fishing-v4-splash');splash.src=ASSET+(selectedSpot==='magma'?'fishing_v5/splash-magma-v1.webp':'fishing_v2/splash.webp');splash.alt='';splash.draggable=false;
      const bobber=node('img','room-fishing-v4-bobber');bobber.src=ASSET+'fishing_v2/bobber.webp';bobber.alt='';bobber.draggable=false;
      const signal=node('strong','room-fishing-v4-signal');signal.setAttribute('aria-live','polite');
      const gauge=node('div','room-fishing-v4-gauge');gauge.setAttribute('role','meter');gauge.setAttribute('aria-label',isV5?'魚線強度':'釣線張力');gauge.setAttribute('aria-valuemin','0');gauge.setAttribute('aria-valuemax','100');
      const gaugeSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');gaugeSvg.setAttribute('viewBox','0 0 160 160');gaugeSvg.setAttribute('aria-hidden','true');
      // Original vector HUD: a readable tension scale wrapped around a
      // nautical reel. The supplied Wii atlas is a visual reference only.
      gaugeSvg.innerHTML='<defs><linearGradient id="roomFishingV4Brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0b2"/><stop offset=".3" stop-color="#c89237"/><stop offset=".65" stop-color="#7e5423"/><stop offset="1" stop-color="#f4d380"/></linearGradient><radialGradient id="roomFishingV4Navy"><stop offset="0" stop-color="#1b6472"/><stop offset=".68" stop-color="#0b394d"/><stop offset="1" stop-color="#061e32"/></radialGradient><linearGradient id="roomFishingV4Steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff9e7"/><stop offset=".45" stop-color="#b4c6c6"/><stop offset="1" stop-color="#527384"/></linearGradient></defs><circle class="room-fishing-v4-dial-shadow" cx="80" cy="80" r="70"/><circle class="room-fishing-v4-dial-bezel" cx="80" cy="80" r="66"/><path class="room-fishing-v4-dial-track" d="M 33 127 A 66 66 0 1 1 127 127"/><path class="room-fishing-v4-dial-progress" d="M 33 127 A 66 66 0 1 1 127 127"/><path class="room-fishing-v4-dial-danger" d="M 141 55 A 66 66 0 0 1 127 127"/><circle class="room-fishing-v4-dial-face" cx="80" cy="80" r="54"/><g class="room-fishing-v4-dial-spool"><ellipse cx="80" cy="46" rx="12" ry="17"/><ellipse cx="80" cy="46" rx="12" ry="17" transform="rotate(72 80 80)"/><ellipse cx="80" cy="46" rx="12" ry="17" transform="rotate(144 80 80)"/><ellipse cx="80" cy="46" rx="12" ry="17" transform="rotate(216 80 80)"/><ellipse cx="80" cy="46" rx="12" ry="17" transform="rotate(288 80 80)"/></g><circle class="room-fishing-v4-dial-hub" cx="80" cy="80" r="19"/><g class="room-fishing-v4-dial-arm"><path d="M 80 82 L 80 31"/><circle cx="80" cy="27" r="7"/></g><circle class="room-fishing-v4-dial-pin" cx="80" cy="80" r="7"/>';
      gaugeSvg.querySelector('.room-fishing-v4-dial-arm').style.transform='rotate(-135deg)';
      gauge.append(node('span','room-fishing-v4-gauge-label',isV5?'魚線強度':'釣線張力'),gaugeSvg,node('strong','room-fishing-v4-gauge-value',isV5?'100 / 100':'0%'),node('small','room-fishing-v4-gauge-status',isV5?'強度充足':'安全'));
      const directionCue=node('div','room-fishing-v4-direction');directionCue.append(node('span','','魚的方向'),node('strong','','—'),node('small','',isV5?'釣竿要跟著魚移動':'拖動捲線牽制'));
      directionCue.append(node('em','','已收回 0%'));
      if(isV5){
        const hud=node('div','room-fishing-v5-hud');hud.setAttribute('role','group');hud.setAttribute('aria-label','釣竿表：魚線耐壓、魚的拉力與剩餘魚距；耐壓歸零就會斷線');
        hud.append(node('span','room-fishing-v5-handle'));
        const strengthBox=node('div','room-fishing-v5-strength');
        const dial=node('div','room-fishing-v5-dial');dial.setAttribute('role','meter');dial.setAttribute('aria-label','魚線耐壓');dial.setAttribute('aria-valuemin','0');dial.setAttribute('aria-valuemax','100');const spool=node('span','room-fishing-v5-dial-spool');spool.append(node('span','room-fishing-v5-dial-crank'));dial.append(node('span','room-fishing-v5-pressure-ring'),spool,node('span','room-fishing-v5-dial-hub'));
        const strengthCopy=node('div','room-fishing-v5-strength-copy');strengthCopy.append(node('span','','耐壓'),node('strong','room-fishing-v5-pressure-value','100%'),node('small','room-fishing-v5-strength-value','0% 斷線'));strengthBox.append(dial,strengthCopy);
        const pullArc=node('div','room-fishing-v5-pull-arc');pullArc.setAttribute('role','meter');pullArc.setAttribute('aria-label','魚的拉力等級');pullArc.setAttribute('aria-valuemin','0');pullArc.setAttribute('aria-valuemax','3');pullArc.append(node('span','room-fishing-v5-pull-arc-band'),node('span','room-fishing-v5-pull-needle'),node('strong','room-fishing-v5-force-value','平穩'));
        const position=node('div','room-fishing-v5-position');
        const catchLabel=node('div','room-fishing-v5-catch-label');catchLabel.append(node('span','','剩餘魚距'),node('strong','room-fishing-v5-distance','0.0 m'));
        const catchTrack=node('div','room-fishing-v5-catch-track');catchTrack.setAttribute('role','meter');catchTrack.setAttribute('aria-label','剩餘魚距');catchTrack.setAttribute('aria-valuemin','0');catchTrack.setAttribute('aria-valuemax','100');const catchRail=node('span','room-fishing-v5-catch-rail');catchRail.append(node('span','room-fishing-v5-catch-fill'));for(let index=1;index<10;index++){const guide=node('span','room-fishing-v5-guide');guide.style.setProperty('--guide',String(index));catchRail.append(guide);}catchRail.append(node('span','room-fishing-v5-rail-marker'));catchTrack.append(node('span','room-fishing-v5-boat','船'),catchRail,node('span','room-fishing-v5-fish-end','魚'));
        position.append(catchLabel,catchTrack);
        hud.append(strengthBox,pullArc,position);fishingV5Hud=hud;
      }
      const castMeter=node('div','room-fishing-v4-cast-meter');castMeter.append(node('div','room-fishing-v4-cast-heading','拋竿力度'),node('strong','room-fishing-v4-cast-readout','52% · 中距離'));
      const castTrack=node('div','room-fishing-v4-cast-track');castTrack.setAttribute('role','progressbar');castTrack.setAttribute('aria-label','拋竿力度');castTrack.setAttribute('aria-valuemin','0');castTrack.setAttribute('aria-valuemax','100');castTrack.append(node('span'));
      const castZones=node('div','room-fishing-v4-cast-zones');castZones.append(node('span','','近岸'),node('span','','中段'),node('span','','遠海'));castMeter.append(castTrack,castZones);
      const cast=button(isV5?'按住看往返力度 · 放開拋竿':'按住蓄力 · 放開拋竿',()=>{},'room-fishing-v4-primary room-fishing-v4-cast');
      cast.hidden=challenge.stage!=='cast';
      cast.addEventListener('pointerdown',event=>{if(event.button!==0||cast.disabled)return;event.preventDefault();event.stopPropagation();fishingV4ChargePointer=event.pointerId;cast.setPointerCapture(event.pointerId);startFishingV4Charge();});
      cast.addEventListener('pointerup',event=>{if(fishingV4ChargePointer!==event.pointerId)return;event.preventDefault();event.stopPropagation();fishingV4ChargePointer=null;fishingV4CastClickSuppressed=true;finishFishingV4Charge();});
      cast.addEventListener('pointercancel',event=>{if(fishingV4ChargePointer!==event.pointerId)return;event.stopPropagation();fishingV4ChargePointer=null;fishingV4ChargeStarted=0;sea.dataset.charging='false';setFishingV4Power(52);});
      cast.addEventListener('click',event=>{if(fishingV4CastClickSuppressed){fishingV4CastClickSuppressed=false;return;}if(event.detail===0&&fishingV4Challenge()?.stage==='cast'){setFishingV4Power(52);void sendFishingV4Action('cast');}});
      const hook=button('抽竿！· 空白鍵',()=>void sendFishingV4Action('hook'),'room-fishing-v4-primary room-fishing-v4-hook');
      hook.hidden=challenge.stage!=='wait';hook.disabled=true;
      const fightControls=node('div','room-fishing-v4-fight-controls');fightControls.hidden=challenge.stage!=='fight';
      const reel=node('button','room-fishing-v4-primary room-fishing-v4-reel');reel.type='button';reel.dataset.reeling='false';reel.setAttribute('aria-label',isV5?'按住收線；在按鈕左側或右側拖動可把釣竿帶往同側，鬆開可回復魚線強度':'按住捲線，向左右拖動控制釣竿方向');
      const reelZones=node('span','room-fishing-v4-reel-zones');
      if(isV5)reelZones.append(node('span','room-fishing-v5-steer-left','◀'),node('span','room-fishing-v5-reel-key','空白'),node('span','room-fishing-v5-steer-right','▶'));
      else reelZones.textContent='← 左　　中　　右 →';
      reel.append(reelZones,node('strong','',isV5?'按住收線':'按住捲線 · 拖動控竿'));
      reel.addEventListener('pointerdown',event=>{if(event.button!==0||reel.disabled)return;event.preventDefault();event.stopPropagation();fishingV4ReelPointer=event.pointerId;reel.setPointerCapture(event.pointerId);const rect=reel.getBoundingClientRect(),ratio=(event.clientX-rect.left)/rect.width;setFishingV4Control(true,isV5?(ratio<.36?-1:ratio>.64?1:0):0,fishingV4Paying);});
      reel.addEventListener('pointermove',event=>{if(fishingV4ReelPointer!==event.pointerId)return;const rect=reel.getBoundingClientRect(),ratio=(event.clientX-rect.left)/rect.width;setFishingV4Control(true,ratio<.36?-1:ratio>.64?1:0,fishingV4Paying);});
      reel.addEventListener('pointerup',event=>{event.preventDefault();event.stopPropagation();if(fishingV4ReelPointer!==event.pointerId)return;fishingV4ReelPointer=null;setFishingV4Control(false,isV5?fishingV4Steer:0,fishingV4Paying);});
      reel.addEventListener('pointercancel',event=>{event.stopPropagation();if(fishingV4ReelPointer!==event.pointerId)return;fishingV4ReelPointer=null;setFishingV4Control(false,isV5?fishingV4Steer:0,fishingV4Paying);});
      reel.addEventListener('click',event=>{if(event.detail!==0)return;setFishingV4Control(true,fishingV4Steer);setTimeout(()=>setFishingV4Control(false,fishingV4Steer),450);});
      const pay=node('button','room-fishing-v4-primary room-fishing-v4-pay','↓ 放線');pay.type='button';pay.dataset.paying='false';pay.setAttribute('aria-label',isV5?'按住放線，讓魚游開並回復魚線強度':'按住放線，降低釣線張力');
      pay.addEventListener('pointerdown',event=>{if(event.button!==0||pay.disabled)return;event.preventDefault();event.stopPropagation();fishingV4PayPointer=event.pointerId;pay.setPointerCapture(event.pointerId);setFishingV4Control(false,fishingV4Steer,true);});
      pay.addEventListener('pointerup',event=>{if(fishingV4PayPointer!==event.pointerId)return;event.preventDefault();event.stopPropagation();fishingV4PayPointer=null;setFishingV4Control(fishingV4ReelPointer!==null,fishingV4Steer,false);});
      pay.addEventListener('pointercancel',event=>{if(fishingV4PayPointer!==event.pointerId)return;event.stopPropagation();fishingV4PayPointer=null;setFishingV4Control(fishingV4ReelPointer!==null,fishingV4Steer,false);});
      pay.addEventListener('click',event=>{if(event.detail!==0)return;setFishingV4Control(false,fishingV4Steer,true);setTimeout(()=>setFishingV4Control(fishingV4ReelPointer!==null,fishingV4Steer,false),450);});
      fightControls.append(reel,pay);
      sea.append(water,fish,line,rod,splash,bobber,target,signal,...(isV5?[fishingV5Hud]:[gauge,directionCue]),castMeter,cast,hook,fightControls);stage.append(sea);
      sea.addEventListener('pointerdown',event=>{
        if(event.button!==0||event.target.closest('button'))return;
        const current=fishingV4Challenge();if(!current)return;
        event.preventDefault();sea.setPointerCapture(event.pointerId);fishingV4Pointer={id:event.pointerId,stage:current.stage};
        if(current.stage==='fight')setFishingV4Control(fishingV4Reeling,fishingV4SteerAt(sea,event));
      });
      sea.addEventListener('pointermove',event=>{
        if(fishingV4Pointer?.id!==event.pointerId)return;
        if(fishingV4Pointer.stage==='fight')setFishingV4Control(fishingV4Reeling,fishingV4SteerAt(sea,event));
      });
      sea.addEventListener('pointerup',event=>{
        if(fishingV4Pointer?.id!==event.pointerId)return;
        const stageAtPress=fishingV4Pointer.stage;fishingV4Pointer=null;
        if(stageAtPress==='wait'&&sea.dataset.biting==='true')void sendFishingV4Action('hook');
        else if(stageAtPress==='fight'&&!isV5)setFishingV4Control(fishingV4Reeling,0);
      });
      sea.addEventListener('pointercancel',event=>{if(fishingV4Pointer?.id!==event.pointerId)return;fishingV4Pointer=null;setFishingV4Control(fishingV4Reeling,isV5?fishingV4Steer:0);});
      setFishingV4Power(fishingV4CastPower);updateFishingV4();
    }
    function fishingV4RodTip(sea){
      const rod=sea.querySelector('.room-fishing-v4-rod'),width=rod.offsetWidth,height=rod.offsetHeight;
      if(!rod.naturalWidth||!rod.naturalHeight||!width||!height)return{x:450,y:245};
      // Tip coordinates measured on the bundled 1536x1024 transparent rod art.
      const contentWidth=Math.min(width,height*rod.naturalWidth/rod.naturalHeight);
      const contentHeight=contentWidth*rod.naturalHeight/rod.naturalWidth;
      const tipX=(width-contentWidth)/2+contentWidth*(1484/1536);
      const tipY=(height-contentHeight)/2+contentHeight*(42/1024);
      const style=getComputedStyle(rod),origin=style.transformOrigin.split(' ').map(parseFloat);
      const pivotX=Number.isFinite(origin[0])?origin[0]:width*.25,pivotY=Number.isFinite(origin[1])?origin[1]:height*.82;
      const matrix=style.transform==='none'||typeof DOMMatrixReadOnly!=='function'?null:new DOMMatrixReadOnly(style.transform);
      const dx=tipX-pivotX,dy=tipY-pivotY;
      const x=rod.offsetLeft+pivotX+(matrix?matrix.a*dx+matrix.c*dy:dx);
      const y=rod.offsetTop+pivotY+(matrix?matrix.b*dx+matrix.d*dy:dy);
      return{x:x/Math.max(1,sea.clientWidth)*1000,y:y/Math.max(1,sea.clientHeight)*600};
    }
    function updateFishingV5(){
      const challenge=fishingV4Challenge(),sea=body?.querySelector('.room-fishing-v4-sea');
      if(challenge?.fishingVersion!==5||!sea)return;
      const at=fishingNow(),bite=Date.parse(challenge.biteAt),nibble=Date.parse(challenge.nibbleAt),hookUntil=Date.parse(challenge.hookUntil);
      const biting=challenge.stage==='wait'&&at>=bite&&at<=hookUntil,nibbling=challenge.stage==='wait'&&at>=nibble&&at<bite;
      const sampleTime=Date.parse(challenge.lastSimAt),sampleAge=Number.isFinite(sampleTime)?clamp((at-sampleTime)/1000,0,.85):0;
      const sourceX=Number.isFinite(challenge.fishX)?challenge.fishX:.5,sourceY=Number.isFinite(challenge.fishY)?challenge.fishY:.55;
      const velocityX=Number.isFinite(challenge.fishVelocityX)?challenge.fishVelocityX:0;
      const velocityY=Number.isFinite(challenge.fishVelocityY)?challenge.fishVelocityY:0;
      const targetX=clamp(sourceX+velocityX*sampleAge,.1,.9),targetY=clamp(sourceY+velocityY*sampleAge,.4,.75);
      const displayAt=now();
      if(!fishingV5Display)fishingV5Display={x:targetX,y:targetY};
      else{
        const elapsed=clamp((displayAt-fishingV5PositionAt)/1000,0,.1),blend=1-Math.exp(-elapsed*15);
        fishingV5Display.x+=(targetX-fishingV5Display.x)*blend;
        fishingV5Display.y+=(targetY-fishingV5Display.y)*blend;
      }
      fishingV5PositionAt=displayAt;
      const fish=fishingV5Display,direction=['left','right'].includes(challenge.pullDirection)?challenge.pullDirection:'steady';
      const surge=challenge.runState==='surge';
      const pullIntensity=Number.isFinite(challenge.pullIntensity)?clamp(challenge.pullIntensity,0,1):(surge?0.55:0.08);
      const maxStrength=Math.max(1,Number(challenge.maxStrength)||100),strength=clamp(challenge.strength,0,maxStrength);
      const strengthRatio=clamp(strength/maxStrength,0,1),risk=strengthRatio<=.26?'danger':strengthRatio<=.52?'warning':'safe';
      const distance=clamp(challenge.distance,0,100),closeness=1-distance/100;
      sea.dataset.stage=challenge.stage;sea.dataset.biting=String(biting);sea.dataset.nibbling=String(nibbling);
      layer.dataset.fishingStage=challenge.stage;
      sea.dataset.pullDirection=direction;sea.dataset.runState=surge?'surge':'calm';sea.dataset.reeling=String(fishingV4Reeling);
      sea.dataset.paying=String(fishingV4Paying);sea.dataset.steer=String(fishingV4Steer);sea.dataset.risk=risk;
      sea.style.setProperty('--fish-facing',velocityX<-.008?'-1':'1');
      sea.style.setProperty('--pull-intensity',pullIntensity.toFixed(3));
      sea.style.setProperty('--pull-period',`${Math.round(940-pullIntensity*530)}ms`);
      sea.style.setProperty('--pull-bend',`${((direction==='left'?-1:direction==='right'?1:0)*pullIntensity*9).toFixed(2)}deg`);
      sea.style.setProperty('--pull-splash-opacity',(0.36+pullIntensity*0.53).toFixed(3));
      if(fishingV5Hud){
        fishingV5Hud.dataset.risk=risk;fishingV5Hud.dataset.surge=String(surge);
        fishingV5Hud.dataset.fishDirection=direction;fishingV5Hud.dataset.steer=String(fishingV4Steer);
        fishingV5Hud.dataset.reeling=String(fishingV4Reeling);fishingV5Hud.dataset.paying=String(fishingV4Paying);
        const forceGrade=pullIntensity<.25?0:pullIntensity<.58?1:pullIntensity<.82?2:3;
        const forceNames=['平穩','輕拉','急拉','猛拉'];
        fishingV5Hud.dataset.force=['calm','light','hard','fierce'][forceGrade];
        // The outer ring is the remaining line capacity used by the server's
        // snap rule. A shrinking colored arc now reaches zero when the line breaks.
        const remainingPressure=Math.round(strengthRatio*100);
        fishingV5Hud.dataset.pressureRisk=risk;
        fishingV5Hud.style.setProperty('--pressure-angle',`${(strengthRatio*300).toFixed(1)}deg`);
        fishingV5Hud.style.setProperty('--pull-fill',`${Math.round(pullIntensity*100)}%`);
        fishingV5Hud.style.setProperty('--pull-needle-x',`${(21+54*Math.sin(Math.PI*pullIntensity)).toFixed(1)}%`);
        fishingV5Hud.style.setProperty('--pull-needle-y',`${(88-76*pullIntensity).toFixed(1)}%`);
        const dial=fishingV5Hud.querySelector('.room-fishing-v5-dial');dial.setAttribute('aria-valuenow',String(remainingPressure));dial.setAttribute('aria-valuetext',`魚線耐壓剩餘 ${remainingPressure}%；歸零斷線`);
        const pullArc=fishingV5Hud.querySelector('.room-fishing-v5-pull-arc');pullArc.setAttribute('aria-valuenow',String(forceGrade));pullArc.setAttribute('aria-valuetext',forceNames[forceGrade]);
        fishingV5Hud.querySelector('.room-fishing-v5-force-value').textContent=forceNames[forceGrade];
        fishingV5Hud.querySelector('.room-fishing-v5-pressure-value').textContent=`${remainingPressure}%`;
        const remainingDistance=Math.round(distance);
        const castY=Number.isFinite(challenge.castTarget?.y)?challenge.castTarget.y*100:(FISH_CAST_ZONES[challenge.castZone||selectedCastZone]||FISH_CAST_ZONES.mid).y;
        const castFarness=clamp((FISH_CAST_ZONES.near.y-castY)/(FISH_CAST_ZONES.near.y-FISH_CAST_ZONES.far.y),0,1);
        // The fight engine owns a relative 0–100 distance. Convert it using
        // this cast's landing depth so the rod rail reads like a distance gauge.
        const shownMeters=(distance/100*(18+36*castFarness)).toFixed(1);
        const distanceLabel=fishingV5Hud.querySelector('.room-fishing-v5-distance');distanceLabel.textContent=`${shownMeters} m`;
        distanceLabel.title='依本作拋竿落點換算的魚距';
        fishingV5Hud.querySelector('.room-fishing-v5-position').style.setProperty('--marker-percent',`${(11+remainingDistance*.82).toFixed(2)}%`);
        const catchTrack=fishingV5Hud.querySelector('.room-fishing-v5-catch-track');catchTrack.setAttribute('aria-valuenow',String(remainingDistance));catchTrack.setAttribute('aria-valuetext',`本作換算魚距 ${shownMeters} 公尺`);
        catchTrack.querySelector('.room-fishing-v5-catch-fill').style.width=`${(remainingDistance*.82).toFixed(2)}%`;
        catchTrack.querySelector('.room-fishing-v5-rail-marker').style.left=`${(11+remainingDistance*.82).toFixed(2)}%`;
      }
      const signal=sea.querySelector('.room-fishing-v4-signal');
      const next=challenge.stage==='cast'?fishingV4ChargeStarted?'放開拋竿，依力度決定落點':'按住下方拋竿，蓄力後放開':challenge.stage==='wait'?biting?'浮標猛沉！現在抽竿！':nibbling?'輕啄而已，等浮標猛沉':'等浮標整個沉下再抽竿':risk==='danger'?'魚線強度快耗盡！鬆開捲線':surge&&direction==='left'?'魚向左衝！點海面左側，先鬆開捲線':surge&&direction==='right'?'魚向右衝！點海面右側，先鬆開捲線':strengthRatio<.6?'鬆開捲線，讓魚線強度回復':'魚勢平穩，按住捲線把魚帶近';
      if(signal.textContent!==next)signal.textContent=next;
      const cast=sea.querySelector('.room-fishing-v4-cast'),hook=sea.querySelector('.room-fishing-v4-hook'),fightControls=sea.querySelector('.room-fishing-v4-fight-controls');
      cast.hidden=challenge.stage!=='cast';hook.hidden=challenge.stage!=='wait';fightControls.hidden=challenge.stage!=='fight';hook.disabled=!biting;
      sea.querySelector('.room-fishing-v4-reel').dataset.reeling=String(fishingV4Reeling);
      sea.querySelector('.room-fishing-v4-pay').dataset.paying=String(fishingV4Paying);
      const castPoint=challenge.castTarget&&Number.isFinite(challenge.castTarget.x)&&Number.isFinite(challenge.castTarget.y)?{x:challenge.castTarget.x*100,y:challenge.castTarget.y*100}:FISH_CAST_ZONES[challenge.castZone||selectedCastZone]||FISH_CAST_ZONES.mid;
      // During the wait, the cast landing point sets perspective. Once hooked,
      // the remaining fish distance drives the water disturbance toward the
      // boat. The fish's horizontal position remains the source of left/right
      // movement, so the splash never becomes a disconnected direction icon.
      const castFarness=clamp((FISH_CAST_ZONES.near.y-castPoint.y)/(FISH_CAST_ZONES.near.y-FISH_CAST_ZONES.far.y),0,1);
      const apparentNearness=challenge.stage==='fight'?closeness:1-castFarness;
      sea.style.setProperty('--bobber-scale',(.58+.90*apparentNearness).toFixed(3));
      // Fight splashes need a stronger depth curve than cast ripples: at a
      // distant 72% they are compact, but at 28% they are clearly larger even
      // at opposite points of the splash animation. Cap the near end by the
      // fish's 18–82% horizontal projection so no edge is clipped.
      const splashScale=challenge.stage==='fight'?.20+1.48*closeness*closeness:.48+1.05*apparentNearness;
      const splashWidth=clamp(sea.clientWidth*.2,120,210)*splashScale;
      sea.style.setProperty('--splash-width',`${splashWidth.toFixed(1)}px`);
      const visualX=50+(fish.x-.5)*76;
      const floatX=challenge.stage==='fight'?visualX:castPoint.x;
      const floatY=challenge.stage==='fight'?31+30*closeness+(fish.y-.57)*10:castPoint.y;
      sea.style.setProperty('--fish-x',visualX.toFixed(2)+'%');sea.style.setProperty('--fish-y',(floatY+4).toFixed(2)+'%');
      sea.style.setProperty('--fish-scale',(.8+.65*closeness).toFixed(3));
      sea.style.setProperty('--float-x',floatX.toFixed(2)+'%');sea.style.setProperty('--float-y',floatY.toFixed(2)+'%');
      const bobOffset=biting?0:nibbling?Math.sin(at/90)*3:Math.sin(at/270)*2.5+(challenge.stage==='fight'?Math.sin(at/(145-pullIntensity*70))*pullIntensity*5:0);
      sea.style.setProperty('--bob-offset',`${bobOffset.toFixed(1)}px`);
      sea.style.setProperty('--bob-tilt',`${(nibbling?Math.sin(at/130)*5:Math.sin(at/390)*2+(challenge.stage==='fight'?Math.sin(at/(180-pullIntensity*90))*pullIntensity*9:0)).toFixed(1)}deg`);
      const origin=fishingV4RodTip(sea);
      let endX=floatX*10,endY=floatY*6,ringWidth=0,ringHeight=0;
      if(challenge.stage==='wait'){
        const bobber=sea.querySelector('.room-fishing-v4-bobber'),bobberStyle=getComputedStyle(bobber);
        const bobberBox=bobber.getBoundingClientRect(),lineBox=sea.querySelector('.room-fishing-v4-line').getBoundingClientRect();
        const paintHeight=Math.min(bobber.offsetHeight,bobber.offsetWidth*bobber.naturalHeight/Math.max(1,bobber.naturalWidth));
        // The eyelet sits at image y=141/1199. Include object-fit letterboxing,
        // scale and tilt; the fight stage instead sends the line into the water.
        const eyeletFromCenter=(bobber.offsetHeight-paintHeight)/2+paintHeight*(141/1199)-bobber.offsetHeight/2;
        const matrix=typeof DOMMatrixReadOnly==='function'?new DOMMatrixReadOnly(bobberStyle.transform==='none'?'matrix(1,0,0,1,0,0)':bobberStyle.transform):{a:1,b:0};
        const tilt=Math.atan2(matrix.b,matrix.a),visualScale=(Number.parseFloat(bobberStyle.scale)||1)*Math.hypot(matrix.a,matrix.b);
        endX=(bobberBox.left+bobberBox.width/2-Math.sin(tilt)*eyeletFromCenter*visualScale-lineBox.left)*1000/Math.max(1,lineBox.width);
        endY=(bobberBox.top+bobberBox.height/2+Math.cos(tilt)*eyeletFromCenter*visualScale-lineBox.top)*600/Math.max(1,lineBox.height);
        ringWidth=bobber.offsetWidth*visualScale*1000/Math.max(1,lineBox.width);
        ringHeight=paintHeight*visualScale*600/Math.max(1,lineBox.height);
      }
      const span=Math.hypot(endX-origin.x,endY-origin.y);
      const sagPixels=(challenge.stage==='fight'?(fishingV4Paying?20:fishingV4Reeling?Math.max(2,6-pullIntensity*4):Math.max(2,13-pullIntensity*10)):13)*clamp(span/350,.35,1.1);
      const routeAroundBobber=challenge.stage==='wait'&&origin.y>endY+ringHeight*.25&&Math.abs(origin.x-endX)<ringWidth*1.8;
      let path;
      if(routeAroundBobber){
        const side=origin.x<endX?-1:1,outsideX=endX+side*(ringWidth*.58+4),aboveY=endY-ringHeight*.17;
        path=`M ${origin.x.toFixed(1)} ${origin.y.toFixed(1)} Q ${(outsideX+side*ringWidth*.11).toFixed(1)} ${((origin.y+aboveY)/2+sagPixels*.25).toFixed(1)} ${outsideX.toFixed(1)} ${aboveY.toFixed(1)} Q ${(endX+side*ringWidth*.28).toFixed(1)} ${(aboveY-ringHeight*.04).toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`;
      }else{
        const bendX=(origin.x+endX)/2,bendY=(origin.y+endY)/2+sagPixels*2*600/Math.max(1,sea.clientHeight);
        path=`M ${origin.x.toFixed(1)} ${origin.y.toFixed(1)} Q ${bendX.toFixed(1)} ${bendY.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`;
      }
      for(const filament of sea.querySelectorAll('.room-fishing-v4-line path'))filament.setAttribute('d',path);
    }
    function updateFishingV4(){
      if(fishingV4Challenge()?.fishingVersion===5){updateFishingV5();return;}
      const challenge=fishingV4Challenge(),sea=body?.querySelector('.room-fishing-v4-sea');if(!challenge||!sea)return;
      const at=fishingNow(),bite=Date.parse(challenge.biteAt),nibble=Date.parse(challenge.nibbleAt),hookUntil=Date.parse(challenge.hookUntil);
      const biting=challenge.stage==='wait'&&at>=bite&&at<=hookUntil,nibbling=challenge.stage==='wait'&&at>=nibble&&at<bite;
      const start=Date.parse(challenge.motionStartedAt),t=Number.isFinite(start)?Math.max(0,(at-start)/1000):0,seedPhase=(Number(challenge.motionSeed||0)%6283)/1000;
      const position=seconds=>{const time=Math.max(0,t-seconds);return{
        x:clamp(.5+.31*Math.sin(time*1.15+seedPhase)+.09*Math.sin(time*2.2+seedPhase*.37),.1,.9),
        y:clamp(.57+.13*Math.sin(time*.76+seedPhase*1.7),.38,.78)
      };};
      const fish=position(0),before=position(.25),dx=fish.x-before.x,dy=fish.y-before.y;
      const direction=fish.y>.68&&dy>.008?'deep':dx>.022?'right':dx<-.022?'left':'steady';
      const visualClock=now();
      if(fishingV4VisualChallenge!==challenge){
        fishingV4VisualChallenge=challenge;fishingV4VisualTension=clamp(challenge.tension,0,100);
        fishingV4VisualDistance=clamp(challenge.distance,0,100);fishingV4VisualAt=visualClock;
      }else if(challenge.stage==='fight'){
        const dt=clamp((visualClock-fishingV4VisualAt)/1000,0,.12),gear=clamp(Number(challenge.rodLevel)||0,0,3);
        const leaseUntil=Date.parse(challenge.controlLeaseUntil);
        const confirmed=Number.isFinite(leaseUntil)&&fishingNow()<leaseUntil?challenge.control||{reeling:false,steer:0}:{reeling:false,steer:0};
        const counter=steer=>direction==='left'&&steer===1||direction==='right'&&steer===-1;
        const wrong=steer=>direction==='left'&&steer===-1||direction==='right'&&steer===1;
        // Never forecast a safer line until the server confirms a new control.
        const aligned=counter(fishingV4Steer)&&counter(confirmed.steer);
        const opposed=wrong(fishingV4Steer)||wrong(confirmed.steer);
        const visualReeling=fishingV4Reeling||confirmed.reeling===true;
        const visualPaying=!visualReeling&&fishingV4Paying&&confirmed.paying===true;
        const escape=.68+(direction==='deep'?.32:0);
        if(visualReeling){
          if(fishingV4Reeling&&confirmed.reeling===true)
            fishingV4VisualDistance=clamp(fishingV4VisualDistance-(9.5+gear*.45+(aligned?1.8:0)-(opposed?1.9:0)-(direction==='deep'?.7:0)-escape)*dt,0,100);
          fishingV4VisualTension=clamp(fishingV4VisualTension+(8-gear*.4+(direction==='deep'?1.4:0)+(opposed?4.4:0)-(aligned?4:0))*dt,0,100);
        }else{
          fishingV4VisualDistance=clamp(fishingV4VisualDistance+(escape+(visualPaying?3.2:0))*dt,0,100);
          const resting=15+(direction==='deep'?5:0),difference=resting-fishingV4VisualTension;
          fishingV4VisualTension=clamp(fishingV4VisualTension+Math.sign(difference)*Math.min(Math.abs(difference),(visualPaying?29:16)*dt),0,100);
        }
      }
      fishingV4VisualAt=visualClock;
      if(dx<-.005)sea.style.setProperty('--fish-facing','-1');
      else if(dx>.005)sea.style.setProperty('--fish-facing','1');
      sea.dataset.stage=challenge.stage;sea.dataset.biting=String(biting);sea.dataset.nibbling=String(nibbling);
      sea.dataset.pullDirection=direction;sea.dataset.reeling=String(fishingV4Reeling);sea.dataset.paying=String(fishingV4Paying);sea.dataset.steer=String(fishingV4Steer);
      const tension=fishingV4VisualTension,risk=tension>=75?'danger':tension>=50?'warning':'safe';
      sea.dataset.risk=risk;
      const gauge=sea.querySelector('.room-fishing-v4-gauge');gauge.setAttribute('aria-valuenow',String(Math.round(tension)));
      gauge.querySelector('.room-fishing-v4-dial-arm').style.transform=`rotate(${-135+tension*2.7}deg)`;
      gauge.querySelector('.room-fishing-v4-dial-progress').style.strokeDasharray=`${(tension*3.11).toFixed(1)} 312`;
      gauge.querySelector('.room-fishing-v4-gauge-value').textContent=`${Math.round(tension)}%`;
      gauge.querySelector('.room-fishing-v4-gauge-status').textContent=risk==='danger'?'危險 · 立刻放線':risk==='warning'?'偏緊 · 小心收線':'安全 · 可以捲線';
      const directionCue=sea.querySelector('.room-fishing-v4-direction');
      directionCue.querySelector('strong').textContent=direction==='left'?'← 魚往左':direction==='right'?'魚往右 →':direction==='deep'?'↓ 魚往深處':'魚勢平穩';
      directionCue.querySelector('small').textContent=direction==='left'?'向右拖動控竿':direction==='right'?'向左拖動控竿':direction==='deep'?'先放線降張力':'趁現在捲線';
      directionCue.querySelector('em').textContent=`已收回 ${Math.round(100-fishingV4VisualDistance)}%`;
      const closeness=1-fishingV4VisualDistance/100;
      sea.style.setProperty('--fish-scale',String(Math.round((.82+.75*closeness)*1000)/1000));
      const bobberScale=Math.round((1+.24*closeness)*1000)/1000;
      sea.style.setProperty('--bobber-scale',String(bobberScale));
      const signal=sea.querySelector('.room-fishing-v4-signal');
      const next=challenge.stage==='cast'?fishingV4ChargeStarted?'放開拋竿，依力度決定落點':'按住下方拋竿，蓄力後放開':challenge.stage==='wait'?biting?'浮標猛沉！現在抽竿！':nibbling?'輕啄而已，等浮標猛沉':'看魚影靠近，等牠咬餌':risk==='danger'?'魚線太緊！按住放線':direction==='left'?'魚往左衝 ← 向右拖動捲線':direction==='right'?'魚往右衝 → 向左拖動捲線':direction==='deep'?'魚往深處鑽，先按住放線':'按住捲線，把魚帶近';
      if(signal.textContent!==next)signal.textContent=next;
      const cast=sea.querySelector('.room-fishing-v4-cast'),hook=sea.querySelector('.room-fishing-v4-hook'),fightControls=sea.querySelector('.room-fishing-v4-fight-controls');
      cast.hidden=challenge.stage!=='cast';hook.hidden=challenge.stage!=='wait';fightControls.hidden=challenge.stage!=='fight';hook.disabled=!biting;
      sea.querySelector('.room-fishing-v4-reel').dataset.reeling=String(fishingV4Reeling);sea.querySelector('.room-fishing-v4-pay').dataset.paying=String(fishingV4Paying);
      const waterY=36+(fish.y-.38)*64;
      const visualX=fish.x*100+(44-fish.x*100)*(.68*closeness)+(challenge.stage==='fight'?fishingV4Steer*6:0);
      const visualY=waterY+(challenge.stage==='fight'?closeness*26:0);
      sea.style.setProperty('--fish-x',visualX+'%');sea.style.setProperty('--fish-y',visualY+'%');
      const castPoint=challenge.castTarget&&Number.isFinite(challenge.castTarget.x)&&Number.isFinite(challenge.castTarget.y)?{x:challenge.castTarget.x*100,y:challenge.castTarget.y*100}:FISH_CAST_ZONES[challenge.castZone||selectedCastZone]||FISH_CAST_ZONES.mid;
      const floatX=challenge.stage==='fight'?visualX:castPoint.x,floatY=challenge.stage==='fight'?visualY-10:castPoint.y;
      sea.style.setProperty('--float-x',floatX+'%');sea.style.setProperty('--float-y',floatY+'%');
      // Keep the thin filament attached to the actual rod tip and the small
      // ring on the bobber. Both share the same frame-based water movement.
      const bobOffset=biting?0:nibbling?Math.sin(at/90)*3:Math.sin(at/270)*2.5;
      sea.style.setProperty('--bob-offset',`${bobOffset.toFixed(1)}px`);
      sea.style.setProperty('--bob-tilt',`${(nibbling?Math.sin(at/130)*5:Math.sin(at/390)*2).toFixed(1)}deg`);
      const origin=fishingV4RodTip(sea),endX=floatX*10,bobber=sea.querySelector('.room-fishing-v4-bobber');
      const ringAboveCenter=bobber.offsetHeight*.39*bobberScale*(biting?.82:1);
      const endY=floatY*6+((biting?38:0)+bobOffset-ringAboveCenter)*600/Math.max(1,sea.clientHeight);
      const span=Math.hypot(endX-origin.x,endY-origin.y);
      const sagPixels=(challenge.stage==='fight'?(fishingV4Paying?20:clamp((85-tension)*.2,2,17)):13)*clamp(span/350,.35,1.1);
      const bendX=(origin.x+endX)/2,bendY=(origin.y+endY)/2+sagPixels*2*600/Math.max(1,sea.clientHeight);
      const path=`M ${origin.x.toFixed(1)} ${origin.y.toFixed(1)} Q ${bendX.toFixed(1)} ${bendY.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`;
      for(const filament of sea.querySelectorAll('.room-fishing-v4-line path'))filament.setAttribute('d',path);
    }
    function tickFishingV4(){
      if(fishingV4ChargeStarted&&fishingV4Challenge()?.stage==='cast')setFishingV4Power(fishingV4Challenge()?.fishingVersion===5?fishingV5CastPower(now()-fishingV4ChargeStarted):Math.min(100,(now()-fishingV4ChargeStarted)/15));
      updateFishingV4();
      const challenge=fishingV4Challenge();if(!challenge||phase!=='answer'||body?.querySelector('.room-minigame-confirm'))return;
      if(now()-fishingV4LastSync>=1000&&!requesting)void sendFishingV4Action(challenge.stage==='fight'?'control':'sync');
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
    function paintActor(time){const canvas=body?.querySelector('.room-minigame-runner');if(!active()||!canvas)return;const elapsed=actorStep?time-actorStep.started:0,ratio=actorStep?clamp(elapsed/actorStep.duration,0,1):1,moving=actorStep&&ratio<1,position=actorStep?actorStep.from+(actorStep.to-actorStep.from)*ratio:actorLane;canvas.style.left=`${21.3+position*28.7}%`;const motion=root.OnePieceRoomMotion,atlas=motion?.preload(keyOf(characterId))?.atlases[moving?actorStep.direction:'south'];if(atlas){const frameIndex=moving?Math.floor(elapsed/70)%4:motion.metadata(keyOf(characterId),root.OnePieceRoomMotionManifest).standingFrame;motion.draw(canvas,atlas,frameIndex);canvas.dataset.wholeBody='true';}actorFrame=requestAnimationFrame(paintActor);}
    function tick() {
      if(!active()||!game?.challenge||!['showcase','answer','waiting'].includes(phase))return;
      if(jobId==='fishing'&&[4,5].includes(game.challenge.fishingVersion)){tickFishingV4();frame=requestAnimationFrame(tick);return;}
      if(jobId==='fishing'&&[2,3].includes(game.challenge.fishingVersion)){tickFishingV2();frame=requestAnimationFrame(tick);return;}
      const challenge=game.challenge,elapsed=now()-roundStart,showcase=Number(challenge.showcaseMs)||700,windowMs=Number(challenge.answerWindowMs)||4500;
      if(phase==='showcase') {
        document.getElementById('roomMinigameHint').textContent=kind!=='work'?'看亮起的航道':({supply:'看訂單',cooking:'看食譜順序',repair:'找入口與出口',navigation:'找港口與暗礁',fishing:'觀察浮標'}[jobId]);
        if(kind==='training'){const index=Math.floor(Math.max(0,elapsed-400)/550),lit=elapsed>=400&&elapsed<showcase-150&&(elapsed-400)%550<390?challenge.directions[index]:null;for(const lane of body.querySelectorAll('.room-minigame-lane'))lane.classList.toggle('lit',lane.dataset.direction===lit);body.querySelectorAll('.room-minigame-steps span').forEach((dot,i)=>dot.classList.toggle('showing',!!lit&&i===index));}
        if(elapsed>=showcase){phase='answer';layer.dataset.phase='answer';body.querySelectorAll('.room-minigame-stage button').forEach(b=>{b.disabled=b.dataset.permanentDisabled==='true';});for(const lane of body.querySelectorAll('.room-minigame-lane,.room-minigame-steps span'))lane.classList.remove('lit','showing');document.getElementById('roomMinigameHint').textContent=kind!=='work'?`依序踏上 ${challenge.directions.length} 步`:({supply:'選箱裝船',cooking:'照順序備料',repair:'旋轉接通管線',navigation:'避礁到港口',fishing:'觀察魚影'}[jobId]);}
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
      body.querySelectorAll('button').forEach(b=>{b.disabled=true;});say('核對中…');
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
    async function finish(){phase='waiting';cancelAnimationFrame(frame);body.replaceChildren(node('h3','',kind==='fishing'?'魚正被帶上甲板…':'挑戰完成，正在結算…'));say(kind==='fishing'?'正在確認這次漁獲。':'成果確認後才會發放獎勵。');const current=generation,wait=Math.max(0,Date.parse(game.finishNotBefore)-fishingNow()+60);if(wait>0)await new Promise(resolve=>setTimeout(resolve,Math.min(wait,30000)));if(current!==generation||!active())return;const response=await request('minigame.finish',{sessionId:game.id,token:game.token});if(!response)return;if(response.ok)accept(response);else showRetry(response);}
    function fishingResultAction(action){return event=>{
      // A still-held reel key or pointer must never dismiss the catch as the
      // completed session swaps the controls for result buttons.
      if(now()-fishingResultShownAt<400||fishingResultHeldKeys.size){event.preventDefault();return;}
      return action();
    };}
    function renderFishingV3Result(result){
      fishingResultShownAt=now();
      const caught=result.catch&&typeof result.catch.speciesId==='string'?result.catch:null;
      const box=node('div',`room-fishing-v3-result ${caught?'caught':'miss'}`);
      const heading=node('h3','',caught?'釣起來了！':result.catchCollectionFull?'釣到了，收藏已滿':'這一竿讓魚逃走了');heading.tabIndex=-1;
      box.append(node('span','room-minigame-eyebrow',caught?'NEW CATCH':'THE FISH GOT AWAY'),heading);
      box.append(node('p','room-fishing-v3-result-spot',`${FISH_SPOTS[selectedSpot].label} · ${FISH_BAITS[selectedBait].label}`));
      if(caught){
        const art=node('img','room-fishing-v3-catch-art');art.src=fishArt(caught.speciesId);art.alt=caught.label||FISH_LABELS[caught.speciesId]||'釣到的魚';art.draggable=false;art.onerror=()=>hideMissingFishArt(art);
        box.append(art,node('strong','room-fishing-v3-catch-name',caught.label||FISH_LABELS[caught.speciesId]||'新漁獲'),node('p','','這尾魚已加入漁獲收藏。看完後再按下方按鈕繼續。'));
        const place=button('放進水族箱',fishingResultAction(async()=>{const response=await request('fish.place',{fishId:caught.id,inAquarium:true});if(response?.ok){place.textContent='已放進水族箱';place.dataset.permanentDisabled='true';place.disabled=true;say('魚已放進水族箱。');options.onResult?.(game);}else if(response)say(ERRORS[response.error]||'目前無法放進水族箱，漁獲仍保存在收藏。');}),'room-minigame-secondary');box.append(place);
      }else box.append(node('p','',result.catchCollectionFull?'先到漁獲收藏放生一尾，就能保存新魚。':'換個餌或釣點，再試著觀察浮標下沉的時機。'));
      const row=node('div','room-minigame-result-actions');row.append(button('看完了，再釣一竿',fishingResultAction(()=>{game=null;lastResult='';lastRound='';lastFeedback=-1;phase='intro';body.replaceChildren(node('p','room-fishing-v4-loading','正在回到同一處海面…'));void start();}),'room-minigame-primary'),button('換魚餌與釣點',fishingResultAction(()=>{game=null;lastResult='';lastRound='';lastFeedback=-1;renderIntro();}),'room-minigame-secondary'),button('返回房間',fishingResultAction(()=>void askClose()),'room-minigame-secondary'));box.append(row);body.append(box);
      card.scrollTop=0;heading.focus({preventScroll:true});
      say(caught?`${caught.label||FISH_LABELS[caught.speciesId]||'魚'}已加入收藏。`:result.catchCollectionFull?'漁獲收藏已滿，請先放生一尾。':reaction('miss'));options.onResult?.(game);
    }
    function renderResult() {
      const resultKey=`${game.id}:${game.attempt||1}`;if(lastResult===resultKey)return;lastResult=resultKey;phase='result';if(kind==='fishing')layer.dataset.fishingStage='result';cancelAnimationFrame(frame);const result=game.result||{};body.replaceChildren();if(kind==='fishing'){renderFishingV3Result(result);return;}const box=node('div',`room-minigame-result ${result.passed?'passed':''}`);box.append(node('span','room-minigame-eyebrow',result.passed?'CHALLENGE CLEAR':'KEEP PRACTICING'),node('h3','',result.passed?'配合成功！':'差一點，再調整步調。'),node('p','',`完整通過 ${result.correctRounds||0} / ${result.totalRounds||game.totalRounds} 輪`));
      const rewards=node('div','room-minigame-rewards');rewards.append(node('strong','',game.practice?'自由練習 · 不領獎勵':result.coins?`商城金幣 +${result.coins}`:kind==='work'&&result.passed?'金幣已達 500 枚上限':kind==='work'?'本次沒有金幣獎勵':'工作意願 +'+(result.workMotivation||0)));if(result.affinity)rewards.append(node('span','',`親密度 +${result.affinity}`));box.append(rewards,node('p','room-minigame-cost',result.catchCollectionFull?'漁獲收藏已滿 64 尾；本次仍照常計算成績與金幣。要留下新魚，請先在收藏中放生一尾。':result.canRetry?`這一場還能重試 ${result.attemptsRemaining} 次；新的一場也不限次數。`:kind==='work'?'工作小遊戲可不限次數再玩；持有金幣上限 500 枚。':'訓練可不限次數再玩。'));
      if(result.catch&&Object.hasOwn(FISH_LABELS,result.catch.speciesId)){
        const catchCard=node('div','room-fishing-catch');const fish=node('img');fish.src=fishArt(result.catch.speciesId);fish.alt=result.catch.label||'釣到的魚';fish.draggable=false;fish.onerror=()=>hideMissingFishArt(fish);
        const copy=node('div');copy.append(node('span','room-minigame-eyebrow','NEW CATCH'),node('strong','',result.catch.label||'新漁獲'),node('small','','已加入漁獲收藏。香吉士料理菜單將於後續更新開放。'));
        const place=button('放進水族箱',async()=>{const response=await request('fish.place',{fishId:result.catch.id,inAquarium:true});if(response?.ok){place.textContent='已放進水族箱';place.dataset.permanentDisabled='true';place.disabled=true;say('魚已放進千陽號水族館酒吧的魚缸。');options.onResult?.(game);}else if(response){say(ERRORS[response.error]||'現在無法把魚放進水族箱，漁獲已保存在收藏。');}},'room-minigame-secondary');
        copy.append(place);catchCard.append(fish,copy);box.append(catchCard);
      }
      const row=node('div','room-minigame-result-actions');row.append(button('返回房間',()=>void askClose()));if(result.canRetry)row.append(button('這場再試一次',()=>void retryAttempt(),'room-minigame-secondary'));else row.append(button(kind==='training'?'再練一場':'再玩一場',()=>{game=null;practice=false;lastResult='';lastRound='';lastFeedback=-1;renderIntro();},'room-minigame-secondary'));box.append(row);body.append(box);say(result.passed?voice().win:reaction('miss'));options.onResult?.(game);row.firstChild.focus({preventScroll:true});
    }
    function renderEnded(){phase='ended';cancelAnimationFrame(frame);body.replaceChildren(node('h3','',kind==='fishing'?'這次釣魚已結束':'這場挑戰已結束'),node('p','',kind==='fishing'?'這次沒有保存漁獲；隨時可以再來釣一竿。':'沒有發放未完成的獎勵。下次開始前可再確認消耗與規則。'),button('返回房間',()=>closeLocal()));say(game.state==='expired'?'挑戰逾時，夥伴先回房間了。':'下回再一起挑戰吧。');}
    async function cancel(close=true){if(requesting)return;const response=await request('minigame.cancel',{sessionId:game.id,token:game.token});if(!response)return;if(response.ok){if(close)closeLocal();else{game=null;lastRound='';renderIntro();}}else{say(ERRORS[response.error]||'暫時無法確認取消，重新連線後再試。');}}
    async function retryAttempt(){const response=await request('minigame.retry',{sessionId:game.id,token:game.token});if(!response)return;if(response.ok||response.minigame?.id===game.id&&response.minigame.attempt>game.attempt){lastFeedback=-1;lastRound='';queued=null;accept(response);}else say(ERRORS[response.error]||'現在無法重新開始，請稍後再試。');}
    async function askClose(){if(requesting)return;if(!game||!['playing','ready','failed'].includes(game.state)){closeLocal();return;}if(body.querySelector('.room-minigame-confirm'))return;stopReeling();fishingV4ReelPointer=null;fishingV4PayPointer=null;fishingV4Pointer=null;if(fishingV4Challenge()?.stage==='fight')await setFishingV4Control(false,0,false);if(!game||!['playing','ready','failed'].includes(game.state)){closeLocal();return;}const confirm=node('div','room-minigame-confirm');confirm.append(node('h3','',kind==='fishing'?'結束這次釣魚？':'結束這場挑戰？'),node('p','',kind==='fishing'?'尚未釣起的魚不會加入收藏；關閉確認視窗時仍可繼續。':game.practice?'結束自由練習後不會領取獎勵。':'未完成的獎勵不會發放；關閉確認視窗時，本輪仍會繼續。'),button('結束並回房間',()=>void cancel(true)),button('繼續挑戰',()=>{confirm.remove();layer.focus({preventScroll:true});},'room-minigame-secondary'));body.append(confirm);confirm.querySelector('button').focus({preventScroll:true});}
    function closeLocal(){generation++;stopReeling();fishingV4Reeling=false;fishingV4Paying=false;fishingV4Steer=0;fishingV4Pointer=null;fishingV4ReelPointer=null;fishingV4PayPointer=null;fishingV4ChargePointer=null;fishingV4ChargeStarted=0;fishingV4ChargeKey=false;fishingV4QueuedCast=false;fishingV4QueuedHook=false;fishingV4QueuedControl=false;fishingV4VisualChallenge=null;fishingV5Display=null;fishingResultHeldKeys.clear();fishingResultShownAt=0;cancelAnimationFrame(frame);cancelAnimationFrame(actorFrame);phase='closed';game=null;queued=null;requesting=false;if(layer)layer.hidden=true;safeResume();if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});}
    function dismiss(){if(!active())return;const old=game;if(old&&['playing','ready','failed'].includes(old.state)&&!requesting)void options.command('minigame.cancel',{sessionId:old.id,token:old.token});closeLocal();}
    function keyDown(event){
      if(kind==='fishing'&&phase==='answer'&&fishingV4Challenge()&&[' ','Enter'].includes(event.key))fishingResultHeldKeys.add(event.key);
      if(kind==='fishing'&&phase==='result'&&[' ','Enter'].includes(event.key)&&(fishingResultHeldKeys.has(event.key)||!event.target?.closest?.('button'))){event.preventDefault();return;}
      const confirmation=body?.querySelector('.room-minigame-confirm'),focusRoot=confirmation||layer;
      if(event.key==='Tab'){const available=[...focusRoot.querySelectorAll('button:not(:disabled)')].filter(n=>!n.hidden&&n.getClientRects().length);if(!available.length){event.preventDefault();return;}const first=available[0],last=available[available.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}return;}
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();void askClose();return;}if(confirmation)return;
      if(phase==='answer'&&fishingV4Challenge()){
        const stage=game.challenge.stage;
        if(stage==='fight'&&['ArrowLeft','ArrowRight'].includes(event.key)){
          event.preventDefault();setFishingV4Control(fishingV4Reeling,event.key==='ArrowLeft'?-1:1);return;
        }
        if(stage==='fight'&&event.key==='ArrowDown'){
          event.preventDefault();setFishingV4Control(false,fishingV4Steer,true);return;
        }
        if(event.key===' '||event.key==='Enter'){
          event.preventDefault();if(stage==='cast'&&!event.repeat){fishingV4ChargeKey=true;startFishingV4Charge();}
          else if(stage==='wait'&&!event.repeat&&body.querySelector('.room-fishing-v4-sea')?.dataset.biting==='true')void sendFishingV4Action('hook');
          else if(stage==='fight'&&event.key===' ')setFishingV4Control(true,fishingV4Steer);
          else if(stage==='fight'&&event.key==='Enter'&&!event.repeat){setFishingV4Control(true,fishingV4Steer);setTimeout(()=>setFishingV4Control(false,fishingV4Steer),450);}
          return;
        }
        return;
      }
      if(phase==='answer'&&jobId==='fishing'&&[2,3].includes(game?.challenge?.fishingVersion)){
        const stage=game.challenge.stage,steer=game.challenge.fishingVersion===3;
        if(steer&&stage==='cast'&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)){
          event.preventDefault();if(event.repeat)return;const zones=Object.keys(FISH_CAST_ZONES),current=zones.indexOf(selectedCastZone),step=['ArrowUp','ArrowRight'].includes(event.key)?1:-1;selectFishingCastZone(zones[Math.max(0,Math.min(zones.length-1,current+step))]);return;
        }
        const action=event.key==='ArrowDown'&&stage==='fight'?'slack':steer&&stage==='fight'&&event.key==='ArrowLeft'?'steerLeft':steer&&stage==='fight'&&event.key==='ArrowRight'?'steerRight':(event.key==='Enter'||event.key===' ')?stage==='cast'?'cast':stage==='wait'&&fishingNow()>=Date.parse(game.challenge.biteAt)?'hook':stage==='fight'?'reel':null:null;
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
    function keyUp(event){
      fishingResultHeldKeys.delete(event.key);
      if(phase!=='answer'||!fishingV4Challenge())return;
      if(game.challenge.stage==='cast'&&(event.key===' '||event.key==='Enter')&&fishingV4ChargeKey){event.preventDefault();fishingV4ChargeKey=false;finishFishingV4Charge();return;}
      if(game.challenge.stage!=='fight')return;
      if(event.key===' '){event.preventDefault();setFishingV4Control(false,fishingV4Steer);}
      if(event.key==='ArrowDown'){event.preventDefault();setFishingV4Control(false,fishingV4Steer,false);}
      if(event.key==='ArrowLeft'&&fishingV4Steer===-1||event.key==='ArrowRight'&&fishingV4Steer===1){event.preventDefault();setFishingV4Control(fishingV4Reeling,0);}
    }
    // A challenge keeps its clock while unfocused. No free restart or offscreen reward.
    root.addEventListener('keyup',event=>fishingResultHeldKeys.delete(event.key));
    root.addEventListener('blur',()=>{windowFocused=false;stopReeling();fishingResultHeldKeys.clear();fishingV4ReelPointer=null;fishingV4PayPointer=null;fishingV4ChargePointer=null;fishingV4ChargeStarted=0;fishingV4ChargeKey=false;const sea=body?.querySelector('.room-fishing-v4-sea');if(sea)sea.dataset.charging='false';if(fishingV4Challenge()?.stage==='cast'&&!fishingV4QueuedCast)setFishingV4Power(52);setFishingV4Control(false,0,false);});root.addEventListener('focus',()=>{windowFocused=true;});root.addEventListener('pointerup',event=>{stopReeling();if(fishingV4ReelPointer===event.pointerId){fishingV4ReelPointer=null;setFishingV4Control(false,0,fishingV4Paying);}if(fishingV4PayPointer===event.pointerId){fishingV4PayPointer=null;setFishingV4Control(fishingV4ReelPointer!==null,fishingV4Steer,false);}});root.addEventListener('pointercancel',event=>{stopReeling();if(fishingV4ReelPointer===event.pointerId){fishingV4ReelPointer=null;setFishingV4Control(false,0,fishingV4Paying);}if(fishingV4PayPointer===event.pointerId){fishingV4PayPointer=null;setFishingV4Control(fishingV4ReelPointer!==null,fishingV4Steer,false);}});
    return Object.freeze({open,dismiss,active,receive:response=>{updateFishingRod(response);if(active()&&game&&response?.minigame?.id===game.id&&['expired','invalidated','cancelled'].includes(response.minigame.state))accept(response);},inspect:()=>({phase,kind,jobId,characterId,roundIndex:game?.roundIndex,selected:[...choice],entered:[...directions],ingredients:[...ingredients],rotations:[...rotations],course:[...course],counterMoves:[...counterMoves],requesting,windowFocused})});
  }
  root.OnePieceRoomMinigames=Object.freeze({create,VOICES,JOBS});
})(window);
