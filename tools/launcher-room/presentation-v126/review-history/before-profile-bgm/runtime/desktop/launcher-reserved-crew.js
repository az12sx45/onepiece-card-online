/* Preinstalled content, not release authority. No ownership, currency or activation side effects.
 * Cross-period collection-base conversations are original fiction, not canon scenes. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.OnePieceReservedCrew=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const LEGACY_KEYS=['luffy','zoro','nami','usopp','sanji','chopper','robin','franky','brook','jinbe'];
  const RESERVED_KEYS=['ace','sabo','law','hancock'];
  const SUPPORTED_KEYS=[...LEGACY_KEYS,...RESERVED_KEYS];
  const keyOf=value=>String(value||'').replace(/^room-character-/,'');
  function releasedKeys(source){
    const values=Array.isArray(source)?source:source?.releasedCharacterIds;
    return [...new Set((Array.isArray(values)?values:LEGACY_KEYS).map(keyOf).filter(key=>SUPPORTED_KEYS.includes(key)))];
  }
  function assetUrl(key,relative){
    if(!RESERVED_KEYS.includes(key))return '';
    if(!/^(?:portrait|(?:walk|acting)\/(?:east|west|north|south)|life\/(?:work-(?:east|west|north|south)|(?:eat|rest|sleep|train)-south))\.webp$/.test(relative))return '';
    return `opui://launcher/images/launcher_room/reserved_v1/${key}/${relative}`;
  }
  const profiles={
    ace:{name:'艾斯',role:'白鬍子海賊團第二隊隊長',detail:'豪爽而有禮，珍惜家人與夥伴。關心魯夫時像個可靠的哥哥，也會坦率地向照顧弟弟的人道謝。',voice:'親切、爽朗、少說大道理；不把每句話都變成火焰笑話。',favorite:['kitchen-table','treasure-chest'],closeTo:['luffy','sabo','jinbe']},
    sabo:{name:'薩波',role:'革命軍參謀總長',detail:'溫和自信，遇到不合理的束縛會認真起來。掛念弟弟，也善於把眼前事情安排妥當。',voice:'從容、直接，對兄弟帶笑意；不捏造成年與艾斯共同冒險。',favorite:['map-table','bookshelf'],closeTo:['luffy','ace','robin']},
    law:{name:'羅',role:'哈特海賊團船長／醫師',detail:'寡言理性，習慣先確認計畫與風險。保有獨立船長的立場，對魯夫的任性常忍不住吐槽。',voice:'短句、冷靜，叫魯夫草帽當家的；不是草帽團船醫或船員。',favorite:['medicine-cabinet','bookshelf'],closeTo:['luffy','chopper']},
    hancock:{name:'漢考克',role:'九蛇海賊團船長／亞馬遜百合皇帝',detail:'氣勢高傲，重視自己的國家與部下。面對魯夫會流露柔軟與羞意；基地中的情感仍是她的單戀。',voice:'對旁人簡潔有威嚴、自稱妾身；魯夫面前會害羞，不把魯夫寫成戀人。',favorite:['kitchen-table','bookshelf'],closeTo:['luffy']}
  };
  const sources={ace:'ace',sabo:'sabo',law:'law',hancock:'Boa_Hancock'};
  const shopMetadata=Object.fromEntries(RESERVED_KEYS.map(key=>[key,{key,itemId:'room-character-'+key,name:key==='law'?'托拉法爾加·羅':profiles[key].name,rarity:'epic',asset:assetUrl(key,'portrait.webp'),role:profiles[key].role,description:profiles[key].detail}]));
  const tuning={
    ace:{traits:['warm_brother','courteous','loyal','easygoing'],weights:{Idle:6,Wander:12,Work:12,Eat:14,Rest:9,Sleep:11,Train:13,Socialize:15,UseFurniture:6,SpecialAction:2},efficiency:{kitchen:.8,navigation:.7,training:1.2,workshop:.85,medical:.65,library:.7,helm:.85,deck:1.1,music:.65}},
    sabo:{traits:['considerate','confident','freedom','organized'],weights:{Idle:6,Wander:10,Work:14,Eat:8,Rest:8,Sleep:7,Train:14,Socialize:14,UseFurniture:11,SpecialAction:2},efficiency:{kitchen:.85,navigation:1.1,training:1.2,workshop:.9,medical:.75,library:1.1,helm:.9,deck:1,music:.7}},
    law:{traits:['analytical','reserved','independent_captain','doctor'],weights:{Idle:8,Wander:7,Work:15,Eat:7,Rest:10,Sleep:8,Train:9,Socialize:7,UseFurniture:17,SpecialAction:2},efficiency:{kitchen:.75,navigation:1.05,training:1,workshop:.9,medical:1.3,library:1.2,helm:.85,deck:.9,music:.6}},
    hancock:{traits:['proud','decisive','protective_ruler','unrequited_affection'],weights:{Idle:10,Wander:10,Work:9,Eat:8,Rest:12,Sleep:8,Train:13,Socialize:9,UseFurniture:9,SpecialAction:2},efficiency:{kitchen:.75,navigation:.85,training:1.2,workshop:.7,medical:.7,library:.9,helm:.85,deck:1,music:.75}}
  };
  const characters=Object.fromEntries(RESERVED_KEYS.map(key=>[key,{
    key,itemId:'room-character-'+key,name:profiles[key].name,traits:tuning[key].traits,weights:tuning[key].weights,
    initialNeeds:{energy:75,hunger:30,mood:65,social:60,workMotivation:65},
    needRates:{energy:.11,hunger:.2,social:.0625,workMotivation:.102},needRateUnit:'per_active_minute',
    efficiency:tuning[key].efficiency,workEfficiency:tuning[key].efficiency,
    schedule:{night:{weights:{Rest:1.2,Sleep:1.2}},morning:{weights:{Work:1.1}}},
    clips:{Work:'work',Eat:'eat',Rest:'rest',Sleep:'sleep',Train:'train',UseFurniture:'work'},
    voiceGuide:profiles[key].voice,canonicalSource:`https://one-piece.com/character/${sources[key]}/index.html`,
    collectionContext:'跨時期收藏基地的原創日常；服裝時期不代表各角色曾在原作此刻共同生活。'
  }]));
  const performance={talk:['focused','idle'],explain:['focused','idle'],nod:['focused','idle'],laugh:['happy','talk_happy'],smile:['happy','talk_happy'],tease:['focused','idle'],protest:['annoyed','talk_annoyed'],reassure:['focused','idle'],admire:['surprised','surprised'],think:['focused','idle'],bow:['focused','wave'],listen:['focused','listen'],startled:['surprised','surprised'],offer:['focused','wave'],work:['focused','focused_use'],rest:['focused','sit']};
  const beat=(line,action='talk')=>({line,action,mood:performance[action][0],pose:performance[action][1]});
  const beats=rows=>rows.map(row=>Array.isArray(row)?beat(...row):beat(row));
  const solo={
    ace:{
      chat:beats([['喲，今天精神不錯嘛。','smile'],'魯夫沒給大家添太多麻煩吧？',['有事就叫我，別一個人搬。','offer'],'帽子借你看可以，可別往天上拋啊。',['這地方真熱鬧。坐下來聊聊？','offer'],'剛才說到哪了？抱歉，肚子一飽就有點睏。']),
      work:beats([['這幾件先整理好，路就空出來了。','work'],'你顧那一邊，剩下的我來。','用完放回原處，下個人也找得到。',['最後再看一遍，答應的事可得做完。','nod']]),
      bond:beats([['你照顧大家的樣子，我看到了。謝啦。','smile'],'不用硬撐，靠一下也沒關係。',['下回有空，再跟我說說你的事。','offer'],'答應你的，我記得。']),
      rest:beats(['風挺舒服的……我就瞇一下。',['飯還沒上？那我等等再睡。','tease'],'別擔心，我沒事，只是睡著了。','你也忙一陣子了，一起歇會兒。']),
      claim:beats([['收妥了，這份交給你。','offer'],'檢查過了，沒有漏下。']),
      furniture:{'kitchen-table':beats(['先留位置，還有人沒坐下呢。','吃完我來收，你也休息一下。']),'treasure-chest':beats(['蓋子別壓到手，我替你扶著。','要用的放上面，省得每次翻到底。'])}
    },
    sabo:{
      chat:beats([['今天想先做什麼？我聽聽。','offer'],'留一點空檔吧，計畫不必把每分鐘塞滿。','那條路被箱子擋住了，先清出來。',['魯夫一安靜，反而讓人想去看看。','tease'],'有自己的想法就說，不必先猜我想聽什麼。',['這裡能自在地坐一會兒，挺好。','smile']]),
      work:beats(['按用途分好，大家拿起來才方便。',['我確認這一邊，你把缺的記下來。','work'],'先把手邊這件收尾，再接下一件。','清單對上了，還要看看實物。']),
      bond:beats(['有不同意的地方，直接告訴我就好。',['你肯把這件事交給我，我會記住。','nod'],'碰到難題就一起想，不急著逞強。',['忙完了？那聽你講講今天吧。','offer']]),
      rest:beats(['先把帽子放好……嗯，這陣風真不小。','放鬆一下，等等再回去。',['今天的麻煩留在門外一會兒吧。','smile'],'安靜的時候，反而聽得到遠處的聲音。']),
      claim:beats(['都對好了，這是你的。',['最後一項也完成了，放心吧。','nod']]),
      furniture:{'map-table':beats(['把走得通的路確認好，再決定往哪邊。','這處記號的意思，請你再說清楚。']),'bookshelf':beats(['先放回同一類，找資料會快很多。','不同的記錄可以並著看，別急著下結論。'])}
    },
    law:{
      chat:beats(['有事？說重點。','先把情況講清楚，我再判斷。','草帽當家的又擅自改計畫了？',['我在想事情，沒在生氣。','think'],'不用替我安排，我有自己的打算。','東西可以放這裡，別混進已經整理好的那一堆。']),
      work:beats(['標記先核對，別憑印象。',['密封用品只清點，別擅自打開。','work'],'這一格已經確認，接著下一格。','順序定好了就照著做，能少出點差錯。']),
      bond:beats(['你剛才注意到的細節，有用。','不必道謝，事情解決就好。',['有話可以直說。我在聽。','listen'],'別勉強。休息不是耽誤。']),
      rest:beats(['現在休息，有事稍後再談。','先讓這裡安靜一會兒。','我知道時間，不必一直提醒。','你也停一下，精神差就容易看漏。']),
      claim:beats(['清點完了，數目一致。','完成。這份收好。']),
      furniture:{'medicine-cabinet':beats(['封口完好，標示也清楚。下一份。','不同用途分開放，別只按瓶子大小。']),'bookshelf':beats(['索引和內容得對得上。','這段得再核對，先做個記號。'])}
    },
    hancock:{
      chat:beats(['有何事？妾身在聽。','東西擺整齊，通道不可擋住。','既然答應了，就把事情做好。',['魯夫……他可有好好吃飯？','think'],'不必圍著看，做你自己的事。','妾身的部下也有她們的判斷，不需要事事代勞。']),
      work:beats(['這一邊由妾身處理。',['清點完再收起，莫要草率。','work'],'不要亂動已整理好的物品。','還有一件，做完便能休息。']),
      bond:beats(['你做事倒是細心。','既是善意，妾身收下。','有困難便直說，含糊其辭有何用。',['今天辛苦了……這句話不必四處宣揚。','nod']]),
      rest:beats(['妾身要歇息片刻。','此處清靜，就在這裡吧。','有急事再來，其餘稍後。',['這茶的香氣，倒不錯。','think']]),
      claim:beats(['已經妥當，收下吧。','既說會做，妾身自然做完。']),
      furniture:{'kitchen-table':beats(['座位留好，別讓端著熱食的人繞路。','這些先收妥，桌面才寬敞。']),'bookshelf':beats(['拿取後便放回原位。','這一卷的字跡，還算清楚。'])}
    }
  };
  const player=(key,repeated,call,gift,train,welcome)=>({talk:solo[key].chat,repeated:beats(repeated),repeatClick:beats(repeated),call:beats(call),gift:beats(gift),train:beats(train),welcome:beats(welcome)});
  const interactionLines={
    ace:player('ace',['聽見啦。別急，慢慢說。','哈哈，叫一次就夠了。','抱歉，剛才恍神了。這回聽著。'],['來了！要我幫什麼？','好，你帶路。','等我把這件放穩。'],[['喔，你還替我留了一份？謝啦！','smile'],'有心了，我會好好收著。','下回換我帶點什麼來。'],['站穩再動，別一下使太大力。','好，再來一輪！','累了就停，不用跟誰比。'],[['打擾啦！往後請多關照。','smile'],'有需要幫忙的就叫我。','先跟大家打聲招呼吧。']),
    sabo:player('sabo',['嗯，我在。是哪件事？','不急，一件一件說。','你這麼有精神，正好陪我聊聊。'],['好，我過去。','帶路吧。','稍等，收好就來。'],['謝謝，我看得出你有挑過。',['這份心意很讓人高興。','smile'],'我會好好用的。'],['先穩住，再慢慢加力。','一起練吧，不必急著分高下。','做到這裡，記得放鬆。'],['打擾了，以後請多關照。',['能在這裡坐下來，真好。','smile'],'我先看看大家需要什麼。']),
    law:player('law',['我聽到了。','還有別的事？','先讓我把這句看完。'],['知道了。','位置在哪？','我過去看。'],['謝了。',['你挑這個，有你的理由吧。','think'],'我收下了。'],['動作放慢，重心先穩住。','不舒服就停。','最後一輪，別多加。'],['我暫時在這裡歇腳。','醫療用品的位置，先讓我確認。','需要我的時候再叫。']),
    hancock:player('hancock',['妾身聽見了。','還有何事？一次說清。','不必反覆催促。'],['知道了，帶路。','待妾身收妥這邊。','妾身這就過去。'],['這份心意，妾身收下。','倒是挑得仔細。','不必緊張，妾身沒有不悅。'],['站直，別急著出力。','既要練，就認真一些。','到此為止，先調整呼吸。'],['這裡便是歇腳之處麼。','不必張揚，照常便好。',['魯夫若來……再告訴妾身。','think']])
  };
  const scenes={},relationships={};
  function pair(a,b,guide,stories,seed={}){
    const id=[a,b].sort().join(':');
    relationships[id]={familiarity:25,friendship:45,rivalry:5,respect:55,...seed,voiceGuide:guide,seedIsGameTuning:true};
    scenes[`${a}:${b}`]=stories.map(([topic,...lines],index)=>({
      id:`reserved-${a}-${b}-${index+1}`,pair:[a,b],topic,tags:[],relationship:guide,cooldownMs:90000,
      turns:lines.map((entry,n)=>{
        const value=Array.isArray(entry)?beat(...entry):beat(entry),reaction=Array.isArray(entry)&&performance[entry[2]]?entry[2]:'listen';
        return {speaker:n%2?b:a,...value,pose:['focused_use','sit'].includes(value.pose)?'idle':value.pose,
          listener:{key:n%2?a:b,action:reaction,mood:performance[reaction][0],pose:performance[reaction][1]},durationMs:Math.max(2300,Math.min(5000,950+Array.from(value.line).length*105))};
      })
    }));
  }
  pair('ace','luffy','義兄弟；哥哥親切照料，弟弟直率依賴，不把普通談話寫成悲劇預告。',[
    ['先留一份',['別全吃光，還有人沒來。','explain','think'],['我有留啊！這盤！','offer'],'那你手上那塊呢？',['這塊我正在吃！','laugh','tease'],['哈哈，好。那盤先放遠一點。','laugh','nod'],['你也坐啦，艾斯！','offer'],'等大家坐好，我就不客氣了。',['好！那我去叫他們！','laugh','smile']],
    ['不必說兩次','魯夫，有沒有好好聽航海士的話？','有啊！海上的事交給娜美！','那就別在人家畫圖時亂摸。','我只是指沒去過的地方嘛！'],
    ['各自的夥伴','你這裡的人，都挺有意思的。','對吧！他們都很厲害！','嗯，看你那個樣子就知道。','下次一起吃飯，我再叫大家來！']
  ],{familiarity:98,friendship:98,respect:90});
  pair('ace','sabo','跨時期收藏基地的假想相聚；只有童年共同經歷，不暗示原作成年曾重聚或共同出航。',[
    ['今天先坐下',['真不習慣，你都長這麼高了。','think','smile'],['你也一樣。帽子倒是一眼就認得。','smile'],'有很多話想問，一時又不知道先問什麼。',['那就從今天開始。不用急。','reassure','nod'],'行。你現在愛喝什麼？','熱茶就好。你呢？','我先看看有沒有吃的。',['這一點，倒不用重新認識。','smile','laugh']],
    ['小時候的勝負','還記得小時候，我們誰先搶到那份飯嗎？','你每次都說是你。','本來就是我啊。','魯夫要是在旁邊，恐怕又有另一個答案。']
  ],{familiarity:95,friendship:98,rivalry:20,respect:90});
  pair('sabo','luffy','義兄弟的自然親近；薩波關心，魯夫不忽然變成乖巧的學生。',[
    ['帽子先扶好',['魯夫，先別跳，這裡正有人端熱的。','explain','startled'],['喔！那我從旁邊過！','offer'],'旁邊也有人。慢慢走。',['好啦。你怎麼跟娜美說一樣的話？','protest','tease'],['看來她平常很辛苦。','tease'],['娜美超厲害的！','admire','smile'],'嗯，那你這次就聽她的。',['這次我有聽啊！','protest','laugh']],
    ['想做的事','今天想做什麼？','去看看那個箱子裡有什麼！','先問主人，可以的話再開。','你陪我去問！一個人等好無聊！']
  ],{familiarity:95,friendship:98,respect:90});
  pair('law','luffy','獨立船長與同盟的收藏基地關係；羅吐槽但不是受命的草帽船員。',[
    ['先把話聽完',['草帽當家的，先聽完再走。','explain'],'你邊走邊說不就好了！',['目的地還沒決定，走去哪？','think'],['前面！到了再看！','offer','protest'],['這不叫計畫。','protest','think'],['那你想一個，我跟你走！','offer'],'別又走到一半跑掉。',['有有趣的東西就一起看嘛！','laugh','think']],
    ['自己的船長','你把我的位置也排進去了？','嗯！一起吃飯啊！','……我說的是工作分配。','那個你自己挑！飯一起吃！']
  ],{familiarity:80,friendship:65,rivalry:16,respect:82});
  pair('law','chopper','尊重彼此醫師專業；不憑對話給玩家診斷或做沒有素材的醫療操作。',[
    ['標示要對得上','這些密封用品是你分的？','嗯！用途跟日期都寫好了！','很好。架上的標記再對一次。','我也正想檢查！你看這一格！','位置清楚，下個人接手也不會弄混。',['對吧！找東西快，才有時間照顧大家！','admire'],'先把這張清單留在外面。','好！不是只有我看得懂才算整理好！']
  ],{familiarity:65,friendship:65,respect:88});
  pair('hancock','luffy','漢考克單戀；魯夫只表現坦率友善與食慾，不回應戀愛承諾。',[
    ['多留的座位',['魯夫……這裡還有位置。','offer'],'喔！那我坐這！有飯嗎？',['有、有的！妾身已替你留好。','smile'],['謝啦，漢考克！大家呢？','laugh','startled'],['你……還想叫其他人？','think'],['一起吃比較好吃啊！','laugh'],'那便……再多留幾個位置。',['好！我去叫他們！','laugh','smile']],
    ['一句謝謝','魯夫，方才的東西可合用？','嗯！幫大忙了！','你……不必如此看著妾身。','我臉上沾了什麼嗎？']
  ],{familiarity:78,friendship:72,respect:85});
  pair('ace','zoro','艾斯感謝照顧魯夫的夥伴，索隆簡短回應。', [['弟弟的夥伴','魯夫平常多虧你們照顧。','那傢伙說走就走，攔不住。','哈哈，我知道。麻煩的地方沒變。','真有事，我們會跟上。']],{familiarity:55,friendship:60,respect:78});
  pair('ace','nami','有禮的兄長與務實航海士。', [['該謝的人','照顧魯夫很費心吧？謝謝妳。','知道就好！光是叫他別碰海圖就夠忙了。','這次我會幫著看住他。','那就拜託你了，別兩個一起跑掉喔。']],{familiarity:55,friendship:62,respect:75});
  pair('ace','usopp','禮貌聽取誇口，但讓手藝有真實表現。', [['真正修好的東西','這個是你修好的？','當然！本大爺修過比這大十倍的！','那這小卡榫是怎麼裝的？','這個啊，先磨順，再留一點伸縮的空間！']],{familiarity:50,friendship:62,respect:65});
  pair('ace','sanji','互相有禮，不把香吉士只寫成供餐工具。', [['客人也能收拾','吃得很好，謝謝。碗我收吧。','放這裡就好，燙的別直接疊。','好。你自己的那份吃了沒？','正要吃，倒是你別吃到一半又睡著。']],{familiarity:55,friendship:65,respect:73});
  pair('ace','chopper','把喬巴當認真醫師，偶發打盹笑點不持續嚇人。', [['先說一聲','剛才睡著了，沒嚇到你吧？','嚇到了！突然一動不動，當然要看啊！','抱歉。讓醫生擔心了。','知道就好！不舒服也得真的告訴我！']],{familiarity:50,friendship:65,respect:75});
  pair('ace','robin','普通基地初交，不虛構共同冒險。', [['留著書籤','這裡有人坐嗎？','沒有。只要別壓到那張書籤就好。','放心，我把帽子放另一邊。','謝謝。這一頁正好可以暫停。']]);
  pair('ace','franky','初交的物件觀察與船匠自豪。', [['看得出用心','這個把手握起來挺順。','嘿！磨過好幾次呢！看得出來吧？','嗯，做得細，搬起來就省事。','懂行啊！用過再告訴我哪裡能改！']]);
  pair('ace','brook','初交音樂與禮貌回應，不安排不可能的舊回憶。', [['聽完再鼓掌','剛才那首還有下一段嗎？','有的。您願意再聽一會兒？','當然。這回我一定醒著聽完。','喲呵呵，那我可要努力留住您的耳朵了。']]);
  pair('ace','jinbe','有交情與信義，也能普通聊天。', [['不用一直站著','甚平，坐吧。這裡不用誰守著。','習慣先看看還有誰需要幫忙。','我也看過了，大家好著呢。','哈哈，那老夫便安心歇口氣。']],{familiarity:86,friendship:85,respect:93});
  pair('sabo','zoro','基地日常觀察，不虛構兩人深交。', [['路要空著','這一邊留給練習，箱子移出去？','嗯，落腳的地方別擋。','知道了，我沿牆排好。','謝了。收完就不會有人絆到。']]);
  pair('sabo','nami','尊重航海專業，不搶著替娜美講課。', [['記號的意思','這兩個記號不同，是水流的差別？','對，一個看表面，另一個得連風向一起看。','難怪不能只照線走。','知道就好，叫魯夫也聽完整句。']]);
  pair('usopp','sabo','溫和追問把誇口引回具體手藝。', [['試過才算','這可是傳說中絕不會鬆掉的裝置！','聽起來很厲害，能讓我看看怎麼拆嗎？','拆、拆當然有祕訣！先按這裡！','有留拆卸的辦法，很實用。']]);
  pair('sabo','sanji','共同照顧他人，留普通笑意。', [['把人叫齊','還缺誰沒來？我去叫。','先叫那幾個忙到忘記時間的。','你自己也算在裡面嗎？','少來，我端完這盤就坐。']]);
  pair('chopper','sabo','尊重醫師並接受提醒。', [['不是別人的事','手上的事放一放，先休息！','我正打算把最後一件做完。','剛才你也這麼說！','被記住了啊。好，這就停。']]);
  pair('sabo','robin','有革命軍交集的熟識，自然相處，不宣稱她加入革命軍。', [['慢慢看完','妳又找到有意思的書了？','嗯，作者在頁邊寫的比正文還長。','那你恐怕得多待一會兒了。','正有此意。茶能放在另一邊嗎？']],{familiarity:78,friendship:75,respect:85});
  pair('sabo','franky','初交實物討論。', [['不只看外表','這個開合的地方，能再看一次嗎？','當然！看裡面的卡榫，重點在這！','原來有第二道保險。','嘿！好看之外，也得放心用嘛！']]);
  pair('sabo','brook','初交的禮貌音樂場景。', [['留到最後一音','我剛才是不是太早鼓掌了？','只早了一個音，熱情倒是恰到好處。','那我再聽一次，這回抓準。','樂意。請把掌聲留到我點頭的時候。']]);
  pair('sabo','jinbe','以魯夫與基地分工為話題，不造舊交。', [['可靠的人','魯夫身邊有你這樣的人，讓人放心。','船長相信老夫，老夫便做好份內之事。','我想，他一定很直接地說出來了。','哈哈，直接得很。連客套都省了。']],{familiarity:40,friendship:57,respect:78});
  pair('law','zoro','戰鬥夥伴間短句，保留各自立場。', [['安靜的地方','這一邊沒人在吵。','所以我才坐這。','那就各做各的。','正好。']],{familiarity:62,friendship:53,respect:78});
  pair('law','nami','合作講求條理，無下屬關係。', [['同一份計畫','先按這個順序，別又臨時換。','你該跟魯夫說，不是跟我。','我已經說過。','那就在他跑掉前再說一次。']],{familiarity:65,friendship:57,respect:75});
  pair('usopp','law','觀察與吐槽，不貶低騙人布能力。', [['先試空的','這次絕對沒問題！本大爺保證！','用空的試一遍。','我正要這麼做！這是專業程序！','那就做。確認了再裝進去。']],{familiarity:55,friendship:50,respect:65});
  pair('law','sanji','飲食喜好與廚師專業，不憑空新增不相容素材。', [['不用麵包','我的那份不要麵包。','知道，已經換好了。還有別的嗎？','沒有。謝了。','那就趁熱吃，別又放著只顧看東西。']],{familiarity:60,friendship:52,respect:73});
  pair('law','robin','理性觀察者，彼此不搶解說。', [['留待核對','這裡和前一頁記的不一樣。','嗯。作者可能只是聽別人說的。','先留記號，別當定論。','同意。未知的部分也該寫清楚。']],{familiarity:66,friendship:58,respect:80});
  pair('law','franky','工程與細節交流，不虛構合作史。', [['分類的理由','這兩組別混在一起。','規格不同嘛！本大爺當然看得出來！','我指的是用過的和沒用過的。','喔，懂了！那再多放一個收納盒！']],{familiarity:48,friendship:48,respect:66});
  pair('law','brook','理性與禮貌幽默，不作無素材診療。', [['今天不研究','別動那份清單。','只是想看看您在忙什麼。我的身體也有許多謎呢。','今天只整理用品。','明白。那謎題就留到您有空的時候。']],{familiarity:45,friendship:45,respect:60});
  pair('law','jinbe','船長與掌舵手平等商量。', [['給下一個人','這邊收好了，換班時照清單核對。','寫得清楚，接手的人就少猜一回。','本來就該如此。','嗯，肯把收尾做完，便是可靠。']],{familiarity:40,friendship:48,respect:74});
  pair('hancock','zoro','初交保持距離，不假設有深交。', [['各留空間','那一邊是妾身放物品之處。','知道。我用這邊就行。','刀鞘莫要橫在通道上。','會收好。妳的箱子也別擋路。']]);
  pair('hancock','nami','各自有主見，保持界線，不虛构情敵。', [['先說清楚','魯夫的座位，留在這裡。','可以。其他人的也得留，別把桌子占滿。','妾身沒有要占滿。','那就說好了，大家都坐得下。']]);
  pair('hancock','usopp','初交緊張但保留真實能力。', [['說實在的','你說這個能固定住？','當、當然！本大爺的技術可不是——','妾身問的是這個。','能！我再把鬆的地方鎖緊一次。']]);
  pair('sanji','hancock','香吉士殷勤，漢考克有界線；無互相戀愛。', [['放下便好','漢考克小姐！您的茶！','放在這裡便好。','點心也一併為您準備了！','妾身收下。你可以去忙自己的事了。']]);
  pair('chopper','hancock','尊重喬巴醫師身分，不把他當寵物。', [['醫生的叮囑','妳剛才一直站著，也該休息了！','妾身並不疲倦。','等累了才停就太晚了！','……既是醫生的提醒，妾身便坐片刻。']]);
  pair('hancock','robin','彼此從容，初交不捏造友誼。', [['把書放回','這卷你可還要看？','暫時不用，妳想翻翻嗎？','嗯。看過便放回此處。','謝謝。頁邊的註記也很有意思。']]);
  pair('hancock','franky','實物整理與高傲界線，不靠外貌評語。', [['高度要合適','這個架子，妾身取物不便。','那就調整！大概這個高度？','再低一些。嗯，就是這裡。','好！用得順手，才算做好！']]);
  pair('hancock','brook','初交的禮貌音樂，不寫騷擾梗。', [['音量放輕','這一段，聲音再輕一些。','遵命。尾音也收短一點？','不必，旋律便照原樣。','明白。您聽得很仔細呢。']]);
  pair('hancock','jinbe','各有國民與夥伴立場，沉著互相尊重。', [['通道留好','這一側已經清妥。','有勞。人多的地方，通道留寬些最好。','妾身不喜歡物品亂堆。','如此，大家來往也都方便。']],{familiarity:55,friendship:45,respect:75});
  pair('ace','law','收藏基地初交；勿虛構海上舊友。', [['先認識一下','你就是羅？我是艾斯。','嗯。哈特海賊團的羅。','有自己的夥伴啊。下回也說說你們的事吧。','有空再談。先把這裡讓出來。']]);
  pair('ace','hancock','收藏基地初交；不假設原作曾會面。', [['弟弟的名字','妳認識魯夫？我是他哥哥。','你……便是魯夫的兄長？','他受妳照顧了。謝謝。','妾身只是……做了想做的事。']]);
  pair('sabo','law','收藏基地初交；薩波道謝，羅保持獨立立場。', [['不必客套','魯夫常提起你。多謝照應。','他也給我添了不少事。','這一點，我大概猜得到。','有機會就讓他把計畫聽完。']]);
  pair('sabo','hancock','收藏基地初交，圍繞日常與魯夫，不製造三角關係。', [['一張便條','這張是留給魯夫的？','正是。若見到他，替妾身轉告。','好，我提醒他親自過來。','……不必說是妾身一直在等。']]);
  pair('law','hancock','各自是船長，關心魯夫的方式不同，不造戀愛競爭。', [['別讓他先走','草帽當家的還沒來？','妾身也在等他。','來了就讓他把這份安排聽完。','妾身會轉告。你莫要對他太兇。']]);
  const eventLines={
    ace:['剩下這幾件，做完就能一起歇了。','好，收得乾乾淨淨！'],
    sabo:['先核對用途，放回大家都找得到的位置。','這樣下個人接手也方便。'],
    law:['密封沒破，標記也對得上。','確認完了。下一份照同樣順序。'],
    hancock:['妾身既已接手，自會整理妥當。','好了。此處不必再操心。']
  };
  const events=RESERVED_KEYS.map(key=>({id:`life-reserved-${key}-supplies`,title:{ace:'把收尾做好',sabo:'留給下一個人',law:'照順序核對',hancock:'親手收妥'}[key],kind:'solo',source:'reserved-crew-v1',requiredCharacters:[key],optionalCharacters:[],requiredFurniture:[],location:{type:'floor',stationType:'deck'},priority:18,cooldownMs:1800000,pairCooldownMs:720000,availablePhases:['morning','day','evening','night'],requiredParticipantPolicy:'owned_and_present_and_available',maxDurationMs:120000,
    steps:[{kind:'speak',actor:key,line:eventLines[key][0],mood:'focused',pose:'idle',durationMs:3500},{kind:'act',actor:key,clip:'work',direction:'south',durationMs:3600},{kind:'speak',actor:key,line:eventLines[key][1],mood:'focused',pose:'idle',durationMs:3000}],requiredActions:[{actor:key,clip:'work',direction:'south',furnitureKey:null}],optionalActionCoverage:{},relationshipDelta:{familiarity:.4,friendship:.25,rivalry:0,respect:.2},memory:{type:`reserved-${key}-supplies`,strength:.5,ttlMs:21600000,maxEntries:16},currencyReward:0}));
  const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
  return freeze({crewContentRevision:1,LEGACY_KEYS,RESERVED_KEYS,SUPPORTED_KEYS,characters,profiles,solo,scenes,relationships,events,interactionLines,shopMetadata,assetUrl,releasedKeys});
});
