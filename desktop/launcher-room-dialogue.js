/* Original room vignettes; sources and performance contract: docs/LAUNCHER_CREW_CANON_20260926.md. */
(function (root) {
  'use strict';
  const KEYS = Object.freeze(['luffy', 'zoro', 'nami', 'usopp', 'sanji', 'chopper', 'robin', 'franky', 'brook', 'jinbe']);
  const MOODS = Object.freeze(['happy', 'surprised', 'focused', 'annoyed']);
  const POSES = Object.freeze(['idle', 'talk_happy', 'talk_annoyed', 'surprised', 'focused_use', 'sit', 'wave']);
  // Intent tokens are mapped to existing poses. They do not assert that extra sprites exist.
  const PERFORMANCE = Object.freeze({
    talk: ['happy', 'talk_happy'], explain: ['focused', 'focused_use'], nod: ['focused', 'idle'],
    laugh: ['happy', 'talk_happy'], tease: ['happy', 'talk_happy'], protest: ['annoyed', 'talk_annoyed'],
    reassure: ['happy', 'talk_happy'], admire: ['surprised', 'surprised'], think: ['focused', 'focused_use'],
    bow: ['happy', 'wave'], listen: ['focused', 'idle'], startled: ['surprised', 'surprised'],
    offer: ['happy', 'wave'], work: ['focused', 'focused_use'], rest: ['focused', 'sit']
  });
  const ACTIONS = Object.freeze(Object.keys(PERFORMANCE));
  const PROFILES = {
    luffy: { name: '魯夫', role: '船長', detail: '想到有趣的事就先動起來。平常直率愛鬧，夥伴認真時也會毫不猶豫地相信對方。', voice: '短句、直接、好奇；不替專家解說。', favorite: ['kitchen-table', 'helm'], closeTo: ['zoro', 'usopp', 'chopper', 'sanji', 'jinbe'] },
    zoro: { name: '索隆', role: '劍士', detail: '把約定與修練看得很重，關心常藏在行動裡。和香吉士鬥嘴，遇到正事仍有默契。', voice: '簡短、乾脆、少解釋；方向感只是偶爾的笑點。', favorite: ['swords-rack'], closeTo: ['luffy', 'chopper', 'sanji'] },
    nami: { name: '娜美', role: '航海士', detail: '敏銳地讀取天候，能把吵鬧的一船人拉回正事。精打細算，也替同伴準備周到。', voice: '俐落、有條理；關懷不必都換算成錢。', favorite: ['map-table', 'tangerine-tree'], closeTo: ['luffy', 'usopp', 'robin', 'sanji'] },
    usopp: { name: '騙人布', role: '狙擊手', detail: '愛誇口也容易緊張，但手藝和瞄準是真本事。即使害怕，仍想成為能保護夥伴的勇敢戰士。', voice: '先逞強再露餡；談手藝時有具體判斷。', favorite: ['tool-bench', 'treasure-chest'], closeTo: ['luffy', 'chopper', 'franky', 'nami'] },
    sanji: { name: '香吉士', role: '廚師', detail: '嘴上不饒人，仍記得每個人的口味與份量。對女士殷勤，對食物與餓肚子的人十分認真。', voice: '女士面前柔和；對男夥伴嘴硬但照顧到位。', favorite: ['kitchen-table', 'tangerine-tree'], closeTo: ['nami', 'robin', 'luffy', 'zoro'] },
    chopper: { name: '喬巴', role: '船醫', detail: '好奇又容易相信別人，受到稱讚會藏不住高興。診療時認真果斷，不容許夥伴逞強傷身。', voice: '開心與害羞外露；醫療判斷清楚，不只賣萌。', favorite: ['medicine-cabinet', 'bookshelf'], closeTo: ['usopp', 'robin', 'zoro', 'luffy'] },
    robin: { name: '羅賓', role: '考古學家', detail: '安靜觀察，喜歡追究事物的來歷。溫柔地接住同伴，偶爾平靜地說出讓人發毛的想像。', voice: '從容、簡潔、偶有冷幽默；不是每句都像怪談。', favorite: ['bookshelf', 'map-table'], closeTo: ['chopper', 'nami', 'franky'] },
    franky: { name: '佛朗基', role: '船匠', detail: '對造船與機關充滿熱情，外表豪放卻很重感情。既懂大工程，也照顧同伴的小麻煩。', voice: '豪爽、具體、有自豪感；口頭禪留給慶祝。', favorite: ['tool-bench', 'helm'], closeTo: ['usopp', 'robin', 'brook'] },
    brook: { name: '布魯克', role: '音樂家', detail: '禮貌與輕快的骷髏玩笑並存。重視約定，也珍惜有人一起聽歌、吃飯的日常。', voice: '禮貌、輕巧的收尾；骨頭笑話有限量，安靜時也真誠。', favorite: ['piano', 'bookshelf'], closeTo: ['luffy', 'franky', 'jinbe'] },
    jinbe: { name: '甚平', role: '掌舵手', detail: '重情重義、待人踏實，把經驗變成讓同伴安心的行動。面對船上的胡鬧也有寬厚的笑意。', voice: '沉穩口語，偶爾自稱老夫；不居高臨下說教。', favorite: ['helm', 'map-table'], closeTo: ['luffy', 'nami', 'robin'] }
  };
  const b = (line, action = 'talk') => ({ line, action, mood: PERFORMANCE[action][0], pose: PERFORMANCE[action][1] });
  const SOLO = {
    luffy: {
      chat: [b('你剛才藏了什麼？讓我看看！', 'admire'), b('這裡還能擺個好玩的東西吧？'), b('大家忙完了沒？我想到一個遊戲！', 'offer'), b('你不想去？好，那我們找別的玩。', 'nod'), b('我聽不懂那麼多啦。你說往哪邊？', 'think'), b('剛剛笑得最大聲的是你吧！', 'laugh')],
      work: [b('這一堆都要搬？那就一起搬走！', 'work'), b('要我守著？好，有人來我就喊！', 'nod'), b('先說好，什麼東西不能碰？', 'think'), b('這箱很輕嘛。下一箱在哪？', 'work')],
      bond: [b('下次發現好玩的，你也要叫我！', 'offer'), b('你說會做到，那我就等你！', 'reassure'), b('不用一直跟我道謝啦，一起玩吧！', 'laugh'), b('你今天沒什麼精神耶。要不要坐這裡？', 'offer')],
      rest: [b('我先躺一下。開飯一定要叫我。', 'rest'), b('喔，大家還沒回來？那我等。', 'rest'), b('這裡看得到天空，挺不錯的嘛。'), b('剛才那個夢太好玩了，我再睡一下！', 'laugh')],
      furniture: { 'kitchen-table': [b('我只拿自己的盤子！……我的是哪個？', 'think'), b('椅子搬好了，大家快過來！', 'offer')], helm: [b('甚平說別亂轉。那我負責看前面！', 'nod'), b('有東西冒出海面了！你看那邊！', 'admire')] }
    },
    zoro: {
      chat: [b('找我？說吧，我聽著。', 'nod'), b('今天手感不對。再練一次。', 'think'), b('站遠點，刀還沒收。', 'explain'), b('你剛才那一下倒挺俐落。', 'nod'), b('這點聲音，還吵不醒我。', 'tease'), b('我沒迷路，是門換邊了吧。', 'protest')],
      work: [b('重的放這邊。我一次搬。', 'work'), b('刀架我整理，刃口別朝外。', 'work'), b('通道留著，別讓人絆到。', 'explain'), b('這邊我顧。忙完再來換。', 'nod')],
      bond: [b('還不放棄？行，再陪你一輪。', 'nod'), b('做不到的現在練，沒什麼丟臉。', 'reassure'), b('水放這了。你也歇一下。', 'offer'), b('有事就叫我，別自己硬扛。', 'reassure')],
      rest: [b('練完再睡，今天算做到了。', 'rest'), b('醒著。只是眼睛懶得睜。', 'rest'), b('你要坐就坐，留個位置給刀。', 'nod'), b('這風不錯。讓我多待一會兒。', 'rest')],
      furniture: { 'swords-rack': [b('刀鞘也得擦。只顧刀刃可不行。', 'work'), b('這把放內側，拿取才不會碰傷人。', 'explain')] }
    },
    nami: {
      chat: [b('先聽我說完航線，再搶著出發。', 'explain'), b('風變了。你幫我把窗邊的紙壓住。', 'work'), b('這片海還沒畫上去呢。總有一天要補齊。', 'think'), b('你發現那朵雲了？眼力不錯。', 'admire'), b('別急著買，我們先看看船上有沒有。', 'explain'), b('都平安回來了？那就好。', 'reassure')],
      work: [b('我把潮位補上，等等就能對航線。', 'work'), b('清單給我，缺的和想要的分開寫。', 'explain'), b('橘子樹先移到有光的地方。', 'work'), b('船員的份都算進去了，不會漏你的。', 'nod')],
      bond: [b('你把那個小記號記住啦？很幫忙呢。', 'admire'), b('來，這段海圖借你看，可別弄濕。', 'offer'), b('今天你也忙壞了，茶一起喝吧。', 'offer'), b('放心，我會找一條大家都能通過的路。', 'reassure')],
      rest: [b('這幾分鐘風不會變，讓我歇一下。', 'rest'), b('算好了！現在誰也別往帳本上加字。', 'protest'), b('難得有這麼安靜的下午。', 'rest'), b('那邊有空位，別踩到橘子樹的影子。', 'tease')],
      furniture: { 'map-table': [b('這條線是暗礁的位置，別當成捷徑。', 'explain'), b('昨天的風向要另記，不能蓋掉今天的。', 'work')], 'tangerine-tree': [b('土還濕，今天先不用添水。', 'think'), b('新葉長出來了。嗯，這位置挑得不錯。')] }
    },
    usopp: {
      chat: [b('本大爺的新發明，只差最後一顆螺絲！', 'explain'), b('我不是怕，我是在估計撤退路線。', 'protest'), b('別動那根線，我剛調到最合適的張力。', 'work'), b('你也看見了吧？那一下正中紅心！', 'admire'), b('故事還沒講完！最厲害的在後面。', 'offer'), b('要幫忙就直說嘛，我又不是會跑。', 'reassure')],
      work: [b('先拿空的試，不准把正式的直接裝上去！', 'explain'), b('這個卡榫讓我磨一下，不能硬塞。', 'work'), b('靶子固定好，我再測一次。', 'work'), b('今天不吹牛。這個我真的修得好。', 'nod')],
      bond: [b('你剛才信我會射中？嘿，那當然！'), b('我怕歸怕，說好幫你就會來。', 'reassure'), b('這是試作品，你願意幫我看看嗎？', 'offer'), b('小聲點啦，剛剛嚇一跳的事別告訴喬巴。', 'think')],
      rest: [b('讓我喘口氣。英雄也要休息。', 'rest'), b('沒睡，我在腦中畫設計圖。', 'tease'), b('工具都收了，這回真的可以停工。', 'rest'), b('安靜得很好。千萬別突然叫我。', 'think')],
      furniture: { 'tool-bench': [b('磨掉這裡的毛邊，手就不會被刮到。', 'work'), b('成功了！等等，再測一次才算數。', 'admire')], 'treasure-chest': [b('鎖沒壞，是木頭吸水脹起來了。', 'think'), b('我先墊住蓋子，手伸進去才不會夾到。', 'work')] }
    },
    sanji: {
      chat: [b('先洗手。肚子再餓也不差這一下。', 'explain'), b('這味道還差一點……嗯，現在行了。', 'think'), b('娜美小姐的茶，哪個混蛋也別偷喝。', 'protest'), b('晚回來也有你的份，別急著吞。', 'reassure'), b('今天有想吃的就說，我看食材來做。', 'offer'), b('好東西得讓人吃進肚子，擺著看幹嘛。')],
      work: [b('刀給我。你把洗好的菜瀝乾。', 'work'), b('桌角擦一遍，端湯才不會滑。', 'explain'), b('剩下的食材還能熬湯，不准丟。', 'work'), b('火我看著，你去叫還沒吃的人。', 'nod')],
      bond: [b('還記得那道菜？下次給你做。'), b('手燙到了？放下，我來就好。', 'reassure'), b('有你幫忙備料，今天能早點開飯。', 'nod'), b('吃不完就說，別勉強，也別糟蹋。', 'explain')],
      rest: [b('爐火關好了。終於能喝口熱的。', 'rest'), b('那群傢伙吃得還真乾淨。'), b('菜單明天再想，現在讓我坐一下。', 'rest'), b('剩的這塊留給你，慢慢吃。', 'offer')],
      furniture: { 'kitchen-table': [b('盤子別疊那麼高。這盤我端。', 'work'), b('全部盛好了，別讓最後來的人吃冷飯。', 'offer')], 'tangerine-tree': [b('娜美小姐答應的兩顆，只摘這兩顆。', 'work'), b('皮也留著，洗乾淨可以添香氣。', 'explain')] }
    },
    chopper: {
      chat: [b('先坐下讓我看看，逞強不會好得比較快！', 'explain'), b('這種葉子很像，但不能光看顏色認。', 'think'), b('笨、笨蛋！說我可靠也沒用啦……嘿嘿，你真的這麼想？', 'laugh'), b('大家沒事的時候，我也有好多東西想研究。', 'offer'), b('別把藥片和糖放一起！拿錯會很危險。', 'protest'), b('我剛學會新的包法，你看這裡不會勒。', 'explain')],
      work: [b('藥瓶標籤朝外，先看清楚再拿。', 'work'), b('我在核對份量，等一下再跟你玩。', 'think'), b('用過的繃帶分開放，不能混回去。', 'work'), b('有人不舒服就叫我，我聽得到！', 'offer')],
      bond: [b('你記得帶水來啊，謝謝你。'), b('我把這頁弄懂了！想先講給你聽。', 'offer'), b('一點點進步也是進步，對吧？', 'think'), b('你不用裝成沒事，我會陪著你。', 'reassure')],
      rest: [b('藥箱扣好了，這下我能放心歇一會兒。', 'rest'), b('才不是看書看睡著，我只是閉眼想。', 'protest'), b('今天的筆記比昨天多懂一點了。'), b('你也休息，等等我們再繼續。', 'offer')],
      furniture: { 'medicine-cabinet': [b('快用完的記在這欄，不能等缺了才找。', 'work'), b('繃帶收乾燥一點，這層剛好。', 'work')], bookshelf: [b('這裡有兩種說法，我要再對照看看。', 'think'), b('原來圖旁邊的小字也很重要！', 'admire')] }
    },
    robin: {
      chat: [b('你看，頁角那個記號比正文還有趣。', 'offer'), b('原來你也注意到了。我們再找找。'), b('這麼安靜……我還以為又有人被埋在書堆下面了。', 'tease'), b('別急著下結論，這頁缺了一角。', 'think'), b('今天的故事，你想從哪裡聽起？', 'offer'), b('喬巴的筆記很仔細。我讀得很開心。')],
      work: [b('先把書頁壓平，墨跡還沒乾。', 'work'), b('這個字有別的寫法，我再核對一次。', 'think'), b('書名留在外側，你下次就找得到了。', 'work'), b('先記下看見的，再寫我們的猜想。', 'explain')],
      bond: [b('我記得你上次問的事。今天有新線索了。', 'offer'), b('陪我坐一會兒吧，不說話也很好。', 'reassure'), b('這個結局還是由你親自翻到比較有趣。', 'tease'), b('能把發現說給人聽，是很好的事呢。')],
      rest: [b('書籤放好了，故事可以等我們一下。', 'rest'), b('你帶來的茶很香，謝謝。'), b('聽著大家吵鬧，倒也讀得下去。', 'tease'), b('今天先停在這裡，留一點好奇給明天。', 'rest')],
      furniture: { bookshelf: [b('同一件事有不同的記載，值得並排讀。', 'think'), b('這本借給你，折頁的地方我已經修好了。', 'offer')], 'map-table': [b('舊地名和現在不同，先別急著劃掉。', 'explain'), b('這裡畫了一口井，也許曾經有人生活。', 'think')] }
    },
    franky: {
      chat: [b('聽這聲音！轉起來一點都不卡了。', 'admire'), b('先說你想怎麼用，我再想怎麼造。', 'offer'), b('看著不起眼？少了這根可就散啦。', 'explain'), b('哪裡不順手，現在就告訴我。', 'nod'), b('這木頭還能用，老伙計有的是本事。'), b('好，尺寸都對上了！SUPER！', 'laugh')],
      work: [b('量兩次再下手，省得你重新搬材料。', 'work'), b('把底座壓穩，我來鎖這邊。', 'work'), b('這裡加護邊，喬巴跑過來也不會刮到。', 'explain'), b('裝好還不算完，得試到真的能用。', 'think')],
      bond: [b('你一直留著我做的東西？可惡，挺感動的啊。'), b('這個點子別丟，我們把它做出來！', 'offer'), b('有錯就改，做東西哪有一開始就全對的。', 'reassure'), b('來，最後這顆螺絲交給你。', 'offer')],
      rest: [b('工具收好了，現在欣賞成品才舒服。', 'rest'), b('這杯可樂來得正是時候。'), b('今天修好的地方，明天再聽聽聲音。', 'think'), b('別催我，我正在想下一個好點子呢。', 'tease')],
      furniture: { 'tool-bench': [b('這顆換下來留作樣本，別混回好零件。', 'work'), b('機關動得漂亮，也得停得穩才行。', 'explain')], helm: [b('鬆緊調到這裡，轉起來才有回饋。', 'work'), b('甚平，等會兒幫我試試手感。', 'offer')] }
    },
    brook: {
      chat: [b('想聽哪一種曲子？我先把拍子慢下來。', 'offer'), b('喲呵呵呵！您連最後那個弱拍都聽到了？真叫人開心。', 'laugh'), b('我已經坐得很端正了，骨架也端正。', 'tease'), b('不用急著鼓掌，我還藏了一段結尾呢。', 'tease'), b('有人一起哼歌，海上就熱鬧多了。'), b('今天這個聲音，值得記進新曲子裡。', 'think')],
      work: [b('先把弦調準，再為大家練一段。', 'work'), b('這頁樂譜壓好了，不會隨風旅行。', 'work'), b('我在找大家都唱得上的調。', 'think'), b('先聽四拍，您再跟進來就好。', 'explain')],
      bond: [b('您還記得上次的旋律，我很高興。'), b('不會唱也沒關係，我們一起慢慢來。', 'reassure'), b('這段留給您點曲，今天想聽什麼？', 'offer'), b('有人等著聽我演奏，我就想好好練習。')],
      rest: [b('先讓音符停一會兒，海聲也很好聽。', 'rest'), b('茶真暖。雖然我沒有能暖起來的胃。', 'tease'), b('能坐在熱鬧的房間裡，真好啊。', 'rest'), b('今天已經很愉快，明天再接著奏。')],
      furniture: { piano: [b('這個弱音剛好，旁邊讀書也不會被吵到。', 'work'), b('準備好了嗎？這次請大家一起拍手。', 'offer')], bookshelf: [b('譜頁少了一拍，我試著把前後接起來。', 'think'), b('原來同一段旋律還有這種唱法。', 'admire')] }
    },
    jinbe: {
      chat: [b('有什麼想法就說，老夫也想聽聽。', 'offer'), b('船穩了，你們安心忙自己的吧。', 'reassure'), b('剛才那一下接得好，不必都推說運氣。', 'nod'), b('這船每天都有新動靜，倒不會無聊。', 'laugh'), b('看水面之前，先感覺船身怎麼動。', 'explain'), b('事情一件件來，我在這裡幫手。', 'nod')],
      work: [b('先確認繩子收妥，再調這邊的舵。', 'work'), b('風和水流方向不同，得一起看。', 'think'), b('這趟我顧著，你先去用餐。', 'reassure'), b('慢些轉。等船身回穩了再加力。', 'explain')],
      bond: [b('你說的那件事，老夫記著呢。', 'nod'), b('不必急著獨當一面，同伴就是要互相幫忙。', 'reassure'), b('來，坐下說。這裡聽得清楚。', 'offer'), b('有你留意小地方，大家走得更踏實。')],
      rest: [b('忙完坐在一起，茶也更好喝。', 'rest'), b('這段海流平穩，老夫也歇口氣。', 'rest'), b('你們的笑聲，比風浪還遠就聽得見。', 'tease'), b('等會兒換我收拾，你先坐著。', 'offer')],
      furniture: { helm: [b('這道浪推過來時，順勢放一點舵。', 'work'), b('方向穩住了，現在不用一直修正。', 'explain')], 'map-table': [b('娜美標的這一段，我記下來了。', 'nod'), b('這裡水色不同，先留個記號提醒大家。', 'work')] }
    }
  };
  // Played only after a successful server-authorized work claim; these are completed acts.
  const CLAIM = {
    luffy: [b('弄好了！嘿嘿，接下來換你帶我去找好玩的！', 'laugh'), b('你交代的都做完啦。這些給你，別弄丟喔！', 'offer')],
    zoro: [b('都處理好了。東西收著，我去練一會兒。', 'nod'), b('交代的事做完了。剩下的你看著辦。', 'offer')],
    nami: [b('清點過了，一樣也沒少。報酬記得收好。', 'nod'), b('事情辦妥了。買東西前先看清楚價格喔。', 'explain')],
    usopp: [b('完成了！交給本大爺果然沒錯，這次可是實績！', 'laugh'), b('都完成了，我還多檢查了一遍。這下能放心了吧！', 'reassure')],
    sanji: [b('收拾妥當了。報酬收著，別忙到忘了吃飯。', 'offer'), b('好了，這邊不用你操心。趁熱吃點東西吧。', 'reassure')],
    chopper: [b('都確認好了！嘿嘿，今天也幫上大家的忙了。', 'laugh'), b('這份工作完成了。你也辛苦了，休息一下吧！', 'offer')],
    robin: [b('已經整理妥當了。你託付的東西都在這裡。', 'offer'), b('收尾也完成了。現在能安心喝杯茶了呢。', 'talk')],
    franky: [b('做完也試過了，這才叫交工！收下吧！', 'offer'), b('最後一處也弄好了！來，欣賞一下成果吧！', 'admire')],
    brook: [b('已經完成了，請您收下。能幫上忙真好。', 'bow'), b('今天的工作圓滿收尾！接下來，容我奏一段輕快的吧。', 'offer')],
    jinbe: [b('都已辦妥，這份交給你。接下來也從容些吧。', 'offer'), b('老夫這邊收尾了。你若還有事，也別一個人硬撐。', 'reassure')]
  };
  for (const key of KEYS) SOLO[key].claim = CLAIM[key];
  const SCENES = {};
  const RELATIONSHIPS = {};
  // Text is authored for the named pair; there is no name-substitution dialogue fallback.
  const t = (line, action = 'talk', reaction = 'listen') => [line, action, reaction];
  const s = (topic, tags, turns) => ({ topic, tags, turns });
  const add = (a, c, relationship, stories) => {
    const pairKey = `${a}:${c}`;
    RELATIONSHIPS[pairKey] = relationship;
    SCENES[pairKey] = stories.map((story, index) => ({
      id: `${a}-${c}-${index + 1}`, pair: [a, c], topic: story.topic, tags: story.tags,
      relationship, cooldownMs: 90000,
      turns: story.turns.map(([line, action, reaction], n) => ({
        speaker: n % 2 ? c : a, ...b(line, action),
        listener: { key: n % 2 ? a : c, action: reaction, mood: PERFORMANCE[reaction][0], pose: PERFORMANCE[reaction][1] },
        durationMs: Math.max(2300, Math.min(5000, 950 + Array.from(line).length * 105))
      }))
    }));
  };
  add('luffy', 'zoro', '船長對第一位夥伴的直率信任；索隆用行動支持並拉住魯莽。', [
    s('訓練的最後一下', ['swords-rack'], [t('你不是說最後一下？剛才也是最後一下！', 'think'), t('那一下沒做好，不算。', 'explain'), t('喔！那我等你做好再一起出去。', 'nod', 'nod'), t('行。別站到刀前面等。', 'reassure')]),
    s('高處的空位', [], [t('那上面空著耶，我們爬上去看看！', 'admire'), t('先看看架子承不承重。', 'explain'), t('你看完了？那我先上！', 'talk', 'protest'), t('我還沒看完。給我下來。', 'protest', 'startled')]),
    s('不必多說的換班', [], [t('你還不睡？剛才不是很睏？', 'think'), t('你在這裡亂晃，誰睡得安穩。', 'tease'), t('哈哈，我去叫別人來陪我，你睡吧！', 'laugh', 'nod'), t('有動靜喊我。別自己跑太遠。', 'nod')])
  ]);
  add('luffy', 'nami', '魯夫相信娜美的航海判斷；娜美制止胡來但理解他的好奇。', [
    s('窗外那朵雲', ['map-table'], [t('那朵雲像個大拳頭！我們去下面看看！', 'admire'), t('底下正在下大雨。你先把窗關上。', 'explain'), t('那等雨停了再去？', 'think', 'nod'), t('等我看過風向。這次記得等我說完。', 'nod')]),
    s('海圖上的空白', ['map-table'], [t('這裡怎麼沒畫？紙不夠大嗎？', 'think'), t('還沒去過，不能亂畫。', 'explain'), t('那我們去！回來你就能畫了！', 'offer', 'talk'), t('說得輕巧……不過，那確實是我的打算。', 'talk')]),
    s('搬動橘子樹', ['tangerine-tree'], [t('娜美，我幫你把樹搬過來了！', 'offer'), t('太靠裡面了，葉子照不到光。', 'explain'), t('那搬到你指的地方就好吧？', 'nod'), t('對，慢慢放。這次真的幫上忙了。', 'reassure', 'laugh')])
  ]);
  add('luffy', 'usopp', '愛玩且信任彼此；魯夫會相信誇張故事，騙人布的技術也是真本事。', [
    s('不是發射鈕', ['tool-bench'], [t('騙人布！按這個會飛嗎？', 'admire'), t('那是固定夾！你怎麼什麼都想發射！', 'protest'), t('喔。那你能做一個會飛的嗎？', 'think', 'think'), t('……小一點的可以。先別把椅子搬來！', 'explain', 'laugh')]),
    s('一百個標靶', [], [t('你能一口氣打中一百個？好厲害！', 'admire'), t('當然！本大爺只要……有一百個靶子。', 'explain'), t('那我去做！紙的也行吧？', 'offer', 'startled'), t('等等，我先示範十個！十個也很厲害！', 'protest')]),
    s('把小零件找回來', ['treasure-chest'], [t('你的東西滾進下面了，我伸手拿！', 'offer'), t('輕一點，那根彈簧壓扁就不能用了。', 'explain'), t('拿到了！沒壞吧？', 'talk', 'think'), t('一點都沒歪。嘿，這次合作得不錯！', 'talk', 'laugh')])
  ]);
  add('luffy', 'sanji', '貪吃的船長與嘴硬照料所有人的廚師；信任不只圍繞偷吃。', [
    s('空盤子的工作', ['kitchen-table'], [t('香吉士，今天我幫你！要做什麼？', 'offer'), t('把空盤子放好。空的，聽清楚沒？', 'explain'), t('放好了！這樣大家就能一起吃了吧？', 'talk', 'nod'), t('算你有幫忙。坐好，第一鍋就來。', 'talk', 'admire')]),
    s('廚師的新味道', ['kitchen-table'], [t('這個跟昨天不一樣！', 'admire'), t('換了做法。哪裡不一樣，說說看。', 'think'), t('不知道怎麼說，可是我還想吃！', 'laugh', 'talk'), t('你這傢伙……行，這句就夠了。', 'talk')]),
    s('留給晚回來的人', [], [t('剩這一盤，沒人要嗎？', 'think'), t('有人還在忙，這是留給他的。', 'explain'), t('那我去叫他！一起吃比較好！', 'offer', 'nod'), t('去吧，別把人連椅子一起拖來。', 'tease', 'laugh')])
  ]);
  add('luffy', 'chopper', '一起好奇玩耍；魯夫承認喬巴的醫師判斷，喬巴敢管住船長。', [
    s('醫生先說完', ['medicine-cabinet'], [t('只是撞一下而已，我還能跑！', 'talk', 'protest'), t('能跑也要檢查！先把手給我。', 'explain'), t('喔，那你看好了我再跑。', 'nod', 'nod'), t('嗯，這樣才對。等我說可以才走。', 'work')]),
    s('書裡的小動物', ['bookshelf'], [t('這隻好奇怪！喬巴，你跟牠說過話嗎？', 'admire'), t('那是畫，我又沒見過真的。', 'explain'), t('遇到了你一定要問問牠！', 'offer', 'admire'), t('好！不過你別一見面就抓起來。', 'talk')]),
    s('夠不到的那一格', [], [t('上面那瓶要拿下來嗎？', 'offer'), t('要！標籤朝這裡，別晃它。', 'explain'), t('這樣？我可以一直幫你拿。', 'nod', 'talk'), t('那你幫我把空盒放回去，這個比較安全！', 'offer')])
  ]);
  add('luffy', 'robin', '魯夫直接接納羅賓的興趣；羅賓從容回應好奇並偶爾逗他。', [
    s('日記裡的晚餐', ['bookshelf'], [t('你笑什麼？書裡有好玩的嗎？', 'think'), t('有人把晚餐清單抄進探險日記了。', 'tease'), t('那不是很好嗎？冒險完就知道吃什麼！', 'talk', 'laugh'), t('原來如此。倒是很適合你來寫序。', 'talk')]),
    s('遺跡的門', ['map-table'], [t('這張圖的門後面是什麼？', 'admire'), t('沒畫出來。也許得到了那裡才知道。', 'think'), t('那就去開門！你想看吧？', 'offer', 'talk'), t('想。不過先讓娜美找到能靠岸的地方。', 'nod')]),
    s('熱鬧也能讀書', [], [t('我們在這邊玩，會吵到你嗎？', 'think'), t('不會。只要別讓骰子飛進茶裡。', 'tease'), t('好！我把杯子移到旁邊！', 'offer', 'nod'), t('謝謝。這回故事和遊戲都能繼續了。', 'talk')])
  ]);
  add('luffy', 'franky', '魯夫對機關毫不掩飾的興奮，讓佛朗基樂於展示又得防止亂按。', [
    s('測試椅子', ['tool-bench'], [t('這張椅子會變形嗎？', 'admire'), t('不會。這次的本事是坐再久也不晃！', 'explain'), t('喔！那我可以跳上去嗎？', 'talk', 'protest'), t('是坐！你給我先用坐的測試！', 'protest')]),
    s('亮燈的瞬間', [], [t('佛朗基！剛才這裡亮起來了！', 'admire'), t('修好的指示燈，這才是它該有的樣子。', 'explain'), t('再亮一次！我去叫喬巴來看！', 'offer', 'laugh'), t('哈！等人齊了，我把原理一起講給你們聽。', 'laugh')]),
    s('珍惜修好的船', ['helm'], [t('轉起來順多了！你剛修好的？', 'admire'), t('對，別只是轉著玩，它可是在帶大家回來。', 'explain'), t('知道啦。這傢伙還要陪我們去好多地方！', 'nod', 'talk'), t('說得好，船長。那就好好用它！', 'reassure')])
  ]);
  add('luffy', 'brook', '魯夫愛宴會與音樂；布魯克珍惜被邀請加入熱鬧的日常。', [
    s('不等飯後的歌', ['piano'], [t('布魯克，現在唱！不用等吃完！', 'offer'), t('可以，但請先把嘴裡那一口嚥下去。', 'explain'), t('好了！這一段我會！', 'laugh', 'admire'), t('那就由您帶頭。拍子慢一點，大家才跟得上！', 'offer')]),
    s('慢下來的拍子', ['piano'], [t('你今天彈得好慢喔。', 'think'), t('想讓剛忙完的人放鬆一下。您不喜歡嗎？', 'think'), t('喜歡啊！聽著就想躺下來。', 'talk', 'talk'), t('那我繼續。睡著也算是很好的評價呢。', 'tease')]),
    s('有人等的練習', [], [t('你在這裡練？等會兒也彈給大家聽吧！', 'offer'), t('我還有一處沒練順，要再等一會兒。', 'think'), t('沒關係，我叫他們等等！', 'nod', 'talk'), t('謝謝您。有聽眾等著，這一遍要更認真了。', 'work')])
  ]);
  add('luffy', 'jinbe', '魯夫放心交付判斷；甚平穩重照應，也會被船長的直率逗笑。', [
    s('交給掌舵的人', ['helm'], [t('浪變大了耶！要我做什麼？', 'admire'), t('先讓大家站穩。舵交給老夫。', 'explain'), t('好！甚平說站穩，大家聽到了沒！', 'offer', 'nod'), t('聽到了，船長，你自己也算在裡頭。', 'tease', 'laugh')]),
    s('不用總是客氣', [], [t('你又等大家坐了才坐，這裡有位置啊！', 'offer'), t('習慣先看看有沒有人需要幫手。', 'nod'), t('那我幫你看，你坐這裡！', 'reassure', 'laugh'), t('哈哈，那老夫就領船長這份心意了。', 'laugh')]),
    s('水裡的見聞', ['map-table'], [t('你在水裡看過最大的東西有多大？', 'admire'), t('有些大得要游好一段才看見尾巴。', 'explain'), t('我也想看！你帶路，我坐船！', 'offer', 'nod'), t('坐船就對了。等航線合適，再帶你瞧瞧。', 'reassure')])
  ]);
  add('zoro', 'nami', '娜美能管住索隆的粗線條；索隆尊重航海判斷，也默默分擔勞務。', [
    s('不用拔刀的工作', ['tangerine-tree'], [t('枯枝剪掉就行了吧。', 'nod'), t('對，但用這把小剪刀，別拔你的刀。', 'explain'), t('知道了。這根也剪？', 'think', 'nod'), t('那根留著。你肯先問，真讓人放心。', 'tease')]),
    s('認錯的門', [], [t('我去拿水，怎麼又走回來了。', 'think', 'protest'), t('因為你繞著同一張桌子轉。', 'explain'), t('嘖。水壺在另一邊？', 'protest', 'nod'), t('這邊。順便幫我帶一杯，別再繞了。', 'offer')]),
    s('搬海圖用的桌子', ['map-table'], [t('要搬就說，別一個人推。', 'offer'), t('往窗邊一點，我需要光。', 'explain'), t('這樣夠了？', 'work', 'nod'), t('剛好。謝啦，這下不用瞇著眼畫了。', 'talk')])
  ]);
  add('zoro', 'usopp', '索隆看得見騙人布的真本事；騙人布在被依賴時把害怕收起來。', [
    s('握把的細活', ['tool-bench'], [t('這裡打滑，你能弄牢嗎？', 'think'), t('那當然！纏的方向反過來就穩了。', 'explain'), t('嗯。這種細活交給你省事。', 'nod', 'talk'), t('嘿，知道本大爺可靠就好。再試試看！', 'offer')]),
    s('靶子背後', [], [t('你要試射？我幫你把靶子掛高。', 'offer'), t('可以，但掛好一定要走開喔。', 'explain'), t('你不是打得準嗎？', 'tease', 'protest'), t('打得準也不能拿夥伴當背板啊！', 'protest', 'nod')]),
    s('有點害怕也能做', ['treasure-chest'], [t('鎖在響，你怎麼還不開？', 'think'), t('我在聽裡面有沒有機關，專業一點嘛。', 'explain'), t('那你聽。我在這裡。', 'nod', 'talk'), t('……嗯。好，這次可以開了。', 'work')])
  ]);
  add('zoro', 'sanji', '鬥嘴與競爭包著可靠的合作；避免把日常寫成真心敵視。', [
    s('嘴硬的加餐', ['kitchen-table'], [t('份量怎麼比昨天少。', 'protest'), t('另一盤還在我手上，急什麼，綠藻頭。', 'protest'), t('誰急了。放這邊。', 'nod', 'tease'), t('自己拿。熱的那盤在下面，別燙到。', 'explain')]),
    s('搬桌子的節拍', [], [t('抬高點，圈圈眉，桌子歪了。', 'protest'), t('是你沒看門框！數三下一起轉。', 'protest'), t('一、二、三。就這樣，別鬆手。', 'work', 'nod'), t('用不著你教。落地，慢一點。', 'work')]),
    s('刀與菜刀', ['swords-rack'], [t('那是擦刀布，不是廚房抹布。', 'explain'), t('我知道。給你拿了條乾淨的，省得你找。', 'offer'), t('……謝了。', 'nod', 'tease'), t('少見啊。再說一次，我好記住。', 'tease', 'protest')])
  ]);
  add('zoro', 'chopper', '索隆寡言地照顧喬巴，喬巴在治療時絕不讓步。', [
    s('不算嚴重也要包紮', ['medicine-cabinet'], [t('這點擦傷，等練完再說。', 'nod', 'protest'), t('不行！汗沾上去更麻煩，現在就包。', 'explain'), t('知道了。手放這裡？', 'nod', 'nod'), t('對，別用力。一下子就好。', 'work')]),
    s('靠近一點的書', ['bookshelf'], [t('你一直踮腳，想拿哪本？', 'think'), t('藍色那本！不是旁邊的大本。', 'offer'), t('拿著。下次叫我就行。', 'offer', 'talk'), t('謝謝！我會自己搬椅子……但今天先謝謝你！', 'talk')]),
    s('睡著的醫生', [], [t('喬巴，書快掉下去了。', 'nod', 'startled'), t('我沒睡！我在想剛才那一段。', 'protest'), t('嗯。想完就去休息，書我放好了。', 'reassure', 'nod'), t('那你也不准偷偷多練一輪。', 'explain')])
  ]);
  add('zoro', 'robin', '安靜相處、各自專注；羅賓以淡淡幽默回應索隆的直白。', [
    s('讀書的界線', ['bookshelf'], [t('我在這邊練，不會碰到你的書。', 'nod'), t('謝謝。書頁比較難擋住劍氣呢。', 'tease'), t('不會讓它飛過去。', 'explain', 'talk'), t('那我就安心看下一章了。', 'rest')]),
    s('古老的刀圖', ['swords-rack'], [t('這張圖的刀，握法有點怪。', 'think'), t('可能是畫的人沒握過，也可能是儀式用的。', 'explain'), t('不能光看畫就下定論啊。', 'nod', 'nod'), t('正是如此。你的眼光幫了忙。', 'talk')]),
    s('安靜的同伴', [], [t('你不用找話說，我坐一會兒。', 'rest'), t('我也正好不打算說話。', 'talk'), t('嗯。那這裡借我靠著。', 'nod', 'tease'), t('請便。至少別靠在要抽走的那本書上。', 'tease')])
  ]);
  add('zoro', 'franky', '戰士說清楚使用需求，船匠把簡單需求認真做好。', [
    s('刀架不用發光', ['swords-rack'], [t('架子夠牢就行，別加奇怪的機關。', 'explain'), t('連照明也不要？拿刀時多帥啊！', 'admire'), t('我閉著眼也拿得到。', 'nod', 'laugh'), t('哈！行，給你做個最硬派的。', 'work')]),
    s('留得下的重量', ['tool-bench'], [t('這個練習用的，能再重一點嗎？', 'think'), t('能。不過先加底座，免得你放下就砸穿地。', 'explain'), t('地板會壞？那你先弄。', 'nod', 'nod'), t('這就對了，鍛鍊也得替船想想！', 'work')]),
    s('不用逞能的搬運', [], [t('這塊長，我拿前面。', 'offer'), t('後面交給我！轉角喊一聲。', 'nod'), t('現在轉，慢點。', 'work', 'nod'), t('好，配合得不錯。省下一次補門框的活！', 'laugh')])
  ]);
  add('zoro', 'brook', '兩位劍士尊重技藝；音樂家禮貌試探，索隆直接給回饋。', [
    s('練刀的拍子', ['piano'], [t('剛才那段，再彈一遍。', 'offer'), t('您喜歡？我可以彈得熱鬧些。', 'think'), t('不用，就這個速度。步子好配。', 'explain', 'nod'), t('明白。我守住拍子，您專心練。', 'work')]),
    s('出鞘的聲音', ['swords-rack'], [t('你的劍收回去幾乎沒聲音。', 'think'), t('練久了，總想少驚動別人一點。', 'explain'), t('不錯。再讓我看看剛才那一下。', 'nod', 'bow'), t('樂意。請站到這一側，免得碰到您。', 'offer')]),
    s('睡眠的伴奏', [], [t('我要睡了。別突然換大聲的。', 'rest'), t('那我改成輕一點的，替您送入夢鄉。', 'reassure'), t('也別唱什麼奇怪的鬼故事。', 'protest', 'tease'), t('放心，今天的演奏者已經夠像鬼了。', 'tease')])
  ]);
  add('zoro', 'jinbe', '實務上的沉默默契；兩人不需要長篇說教就能照應彼此。', [
    s('先過完這道浪', ['helm'], [t('船斜了。現在不能練？', 'think'), t('等這道浪過去，給老夫半分鐘。', 'explain'), t('好，我先把重的固定住。', 'work', 'nod'), t('多謝，這樣大家腳下也安穩。', 'nod')]),
    s('輪到誰休息', [], [t('你站了很久，這邊我看著。', 'offer'), t('你才剛練完，不必勉強。', 'think'), t('看著而已，沒那麼累。', 'nod', 'talk'), t('那老夫去喝杯茶，很快就回來。', 'rest')]),
    s('腳下的重心', ['swords-rack'], [t('你剛才晃都沒晃，怎麼站的？', 'think'), t('不是把腿鎖死，先順著船身卸力。', 'explain'), t('……懂了。再晃一次試試。', 'work', 'laugh'), t('哈哈，浪可不聽老夫發號施令。等一等吧。', 'laugh')])
  ]);
  add('nami', 'usopp', '常一起擔心危險，也能靠天候知識與發明解決問題；娜美看穿誇口。', [
    s('沒有雷的測試', ['tool-bench'], [t('這次只測風，不准忽然冒出奇怪的東西。', 'explain'), t('放心！我連驚喜開關都拆掉了！', 'reassure'), t('原來你真的裝過。把拆下來的也交出來。', 'protest', 'startled'), t('……妳怎麼總能聽出重點啊。', 'think')]),
    s('敢不敢看箱子', ['treasure-chest'], [t('那箱子在響，你剛才說你一點都不怕？', 'think'), t('當然！我只是要確認妳準備好了。', 'explain'), t('我準備好站遠一點了。你請。', 'tease', 'startled'), t('等等！我們先一起聽，兩個人比較準。', 'offer')]),
    s('畫得準的刻度', ['map-table'], [t('你做的刻度很清楚，小字也不會糊。', 'talk'), t('這可是狙擊手的眼力！需要再細一點嗎？', 'admire'), t('現在這樣正好。下次海圖尺也交給你。', 'offer', 'talk'), t('包在我身上。喂，這句稱讚可要記住喔！', 'laugh')])
  ]);
  add('nami', 'sanji', '香吉士對娜美殷勤，娜美自然使喚也懂得肯定他的照顧。', [
    s('不用太甜的茶', ['kitchen-table'], [t('今天想喝清爽一點的，糖少放。', 'offer'), t('當然，娜美小姐！我再配一片橘子如何？', 'admire'), t('可以。你也替還沒喝的人倒一杯吧。', 'nod', 'nod'), t('早就準備好了，大家的份一杯也沒少。', 'reassure')]),
    s('先問再摘', ['tangerine-tree'], [t('你盯著那兩顆很久了，想做甜點？', 'tease'), t('被娜美小姐看穿了。香氣實在太好了。', 'talk'), t('熟了，可以摘。留一份讓我嚐嚐。', 'offer', 'admire'), t('第一份一定送到您面前！', 'bow')]),
    s('清單外的心意', [], [t('採買清單上怎麼多了薑？', 'think'), t('妳不是說晚上轉冷？煮熱湯用的。', 'explain'), t('我才提一次，你就記得啦。這項留下。', 'talk', 'talk'), t('哪能讓航海士吹著冷風還喝涼的。', 'reassure')])
  ]);
  add('nami', 'chopper', '娜美體貼喬巴的需要，喬巴也用醫師身分照顧操心的娜美。', [
    s('忘了休息的航海士', ['map-table'], [t('再畫完這條線，我就停。', 'think', 'protest'), t('妳剛才已經說三次了，眼睛要休息！', 'explain'), t('好啦。那你幫我把筆蓋好。', 'nod', 'talk'), t('嗯！我計時，這回不准偷偷繼續。', 'work')]),
    s('重要的採買', ['medicine-cabinet'], [t('藥品裡最急的是哪幾樣？標給我看。', 'offer'), t('這三樣。可是會不會很貴？', 'think'), t('需要的就得補，這筆不省。', 'nod', 'admire'), t('太好了！我會把用量記得更清楚。', 'reassure')]),
    s('落葉不是生病', ['tangerine-tree'], [t('喬巴，你怎麼守在樹旁邊？', 'think'), t('它掉了葉子。我在想是不是哪裡不舒服。', 'think'), t('這片老了，新芽長得很好，你看。', 'explain', 'admire'), t('真的耶！下次我先看新芽再擔心。', 'talk')])
  ]);
  add('nami', 'robin', '能互相交流專長與安靜日常的同伴；娜美也接得住羅賓的冷幽默。', [
    s('兩張不同的地圖', ['map-table'], [t('你的舊地圖多了一條河，現在沒有了。', 'think'), t('也許改道了。旁邊那個地名還在。', 'explain'), t('那就先把舊河道用細線補上。', 'work', 'nod'), t('好。我找年代，你畫位置，正好。', 'nod')]),
    s('不太嚇人的故事', ['bookshelf'], [t('今天讀什麼？別又突然講沉船裡的事喔。', 'tease'), t('是一個人把所有積蓄藏在書裡的故事。', 'talk'), t('這個可以。最後找到了嗎？', 'admire', 'tease'), t('找到了，可惜他忘記放在哪一頁。', 'tease', 'protest')]),
    s('橘子樹旁的午後', ['tangerine-tree'], [t('這邊光線剛好，妳的椅子搬過來吧。', 'offer'), t('不會擋到妳澆水嗎？', 'think'), t('不會，妳還能提醒魯夫別踩進來。', 'talk', 'laugh'), t('呵呵，那我就在這裡當安靜的看守。', 'rest')])
  ]);
  add('nami', 'franky', '娜美要求實用與可靠，佛朗基以工程熱情回應；也能共同規劃。', [
    s('不是每樣都要加機關', ['tool-bench'], [t('我只需要抽屜不會滑開，聽清楚喔。', 'explain'), t('所以不用自動彈出？我都畫好了！', 'admire'), t('航海時自動彈出，我會先被它撞到。', 'protest', 'think'), t('有道理。改成單手就能扣住，這個實用吧！', 'offer')]),
    s('風口的位置', ['tangerine-tree'], [t('這裡能擋一點風，又不遮住陽光嗎？', 'think'), t('做一片能調角度的擋板就行。', 'explain'), t('讓我先量今天風從哪邊來。', 'work', 'nod'), t('好，妳定方向，我把底座做穩。', 'work')]),
    s('可靠的小修理', ['helm'], [t('昨天說的鬆動已經沒了，你修過了？', 'think'), t('妳說完我就看了，還順便查過旁邊。', 'nod'), t('謝啦。這種地方穩了，我看航線也安心。', 'talk', 'talk'), t('這句比誇它好看還管用啊！', 'laugh')])
  ]);
  add('nami', 'brook', '娜美給音樂家清楚界線，布魯克禮貌配合，也能用音樂幫忙。', [
    s('數字別跟著跑', ['piano'], [t('先別越彈越快，我的數字都跟著亂了。', 'protest'), t('抱歉，我把拍子放慢。這樣可以嗎？', 'bow'), t('嗯，這樣很好。等我算完再熱鬧。', 'nod', 'talk'), t('那結尾留到您合上帳本的時候。', 'offer')]),
    s('雨天的樂譜', ['bookshelf'], [t('樂譜收裡面，海風帶著雨。', 'explain'), t('多虧您提醒！我的譜差點先出去旅行。', 'startled'), t('紙角壓這裡。我可不想出海撈樂譜。', 'work', 'nod'), t('那我演奏一首不需要您出航的謝禮。', 'bow')]),
    s('聽懂的停頓', [], [t('你剛才故意停一下，是在等大家唱？', 'think'), t('是的，有人唱進來，曲子就不只屬於我了。', 'talk'), t('那下次先給我一個眼神，我也能接上。', 'offer', 'admire'), t('樂意之至！雖然我沒有眼睛，仍會朝您這邊看。', 'tease')])
  ]);
  add('nami', 'jinbe', '航海士判讀航線，掌舵手把指示落實；互相尊重專業。', [
    s('半拍之後轉舵', ['helm'], [t('下一道浪過了再轉，不用搶。', 'explain'), t('明白，老夫等妳的訊號。', 'nod'), t('現在！沿著右邊那條深色水線。', 'work', 'nod'), t('已經對上了。好判斷，船身很穩。', 'reassure')]),
    s('圖上沒有的變化', ['map-table'], [t('海圖寫的是順流，船卻被推向左邊。', 'think'), t('表面和下面流向不同，能感覺到拖力。', 'explain'), t('那我加個記號，下次也要提醒大家。', 'work', 'nod'), t('老夫把發生的位置說清楚，妳慢慢記。', 'offer')]),
    s('把功勞分回來', [], [t('今天靠得真平穩，杯子都沒晃。', 'talk'), t('是妳挑的時機好，老夫只是照著做。', 'nod'), t('照著做也得有本事啊，這句誇你就收下。', 'reassure', 'laugh'), t('哈哈，那就收下。下次也請多指點。', 'bow')])
  ]);
  add('usopp', 'sanji', '廚師看穿誇口仍肯定手藝；狙擊手能以小發明幫忙。', [
    s('攪拌器的真本事', ['kitchen-table'], [t('新發明！不用手也能一直攪！', 'admire'), t('能停下來嗎？不能停就先別放進鍋裡。', 'think'), t('當然能！這個卡榫一扣……你看！', 'work', 'nod'), t('行，這次有用。先用空碗測完再上桌。', 'nod')]),
    s('沒說出口的肚子餓', [], [t('我忙得連吃飯都忘了，真是辛苦的英雄。', 'tease'), t('少繞圈，給你留了。坐下。', 'offer'), t('你怎麼知道我還沒吃？', 'admire', 'talk'), t('你那張嘴一安靜，八成就在做東西。', 'tease')]),
    s('修好的抽屜', ['tool-bench'], [t('你說卡住的抽屜，我調好了。', 'offer'), t('不會一拉整個掉出來吧？', 'think'), t('才不會！我試了十次，這裡還加了擋片。', 'explain', 'nod'), t('謝了。等晚餐，你那份給你多添一點。', 'talk', 'admire')])
  ]);
  add('usopp', 'chopper', '喬巴容易信誇張故事；騙人布喜歡被崇拜，也會在實務上照顧他。', [
    s('不是一萬個人的工程', ['tool-bench'], [t('這可是我指揮一萬個工匠才想出的設計！', 'admire'), t('一萬個？可是剛才只有你坐在這裡啊。', 'think'), t('那、那是腦中的一萬個點子！', 'protest', 'admire'), t('原來是這樣！那你先教我其中一個！', 'offer')]),
    s('真的需要勇氣', [], [t('剛才那聲音太突然，我是故意往後站的。', 'explain'), t('我也嚇到了。可是你還是回來扶住我。', 'talk'), t('那當然，總不能把你留在前面。', 'nod', 'admire'), t('嗯！我下次也會先看看你在哪。', 'reassure')]),
    s('藥箱的小改裝', ['medicine-cabinet'], [t('加上這條帶子，藥箱就不會一直撞到腿。', 'explain'), t('真的比較穩！會不會很難拆？', 'admire'), t('這裡一拉就行，我留了快扣。', 'work', 'nod'), t('太好了！趕著拿藥的時候也不會卡住！', 'talk')])
  ]);
  add('usopp', 'robin', '誇口和冷幽默形成反差；羅賓也認真欣賞騙人布的觀察與手藝。', [
    s('箱子裡的聲音', ['treasure-chest'], [t('這箱子好像在敲，我先研究一下。', 'think'), t('也許裡面有人想出來。', 'tease', 'startled'), t('別這麼平靜地說恐怖的話啊！', 'protest', 'talk'), t('呵呵，是蓋子上的環。我替你按住了。', 'reassure')]),
    s('看得出的修補', ['bookshelf'], [t('這本的封面修好了，幾乎看不出來吧！', 'offer'), t('看得出來你把紋路也對齊了，很細心呢。', 'talk'), t('連這都看出來？我可是磨了好久。', 'admire', 'nod'), t('所以才想好好謝謝你。', 'reassure')]),
    s('故事要有結尾', [], [t('那怪物一看見我，立刻嚇得逃進海裡！', 'admire'), t('接著呢？你不是說它本來不會游泳？', 'think', 'startled'), t('呃，所以我又把它救上來了！', 'explain', 'talk'), t('原來是個救援故事。這個結尾我喜歡。', 'talk')])
  ]);
  add('usopp', 'franky', '兩名手作夥伴分享技術；佛朗基不奪走騙人布的小發明成就。', [
    s('小機關不必變大', ['tool-bench'], [t('我想做一個單手就能開的扣子。', 'think'), t('好點子！要不要加成三段連動？', 'admire'), t('先別加！喬巴只需要一按就開。', 'protest', 'nod'), t('對，給誰用最要緊。這次聽你的。', 'nod')]),
    s('卡住的一毫米', ['tool-bench'], [t('尺寸都對，怎麼一裝就卡住？', 'think'), t('別急，邊緣這裡還有一點毛邊。', 'explain'), t('喔！不是整個做錯，磨這裡就行！', 'admire', 'nod'), t('沒錯。你前面做得很好，別一口氣全否定了。', 'reassure')]),
    s('讓作品署名', [], [t('大家都以為那個小架子是你做的。', 'think'), t('那就跟他們說是你啊，這本來就是你的作品。', 'nod'), t('我還以為放在你工具台上，就算你的了。', 'talk', 'laugh'), t('胡說！下次把名字刻上去，挺起胸膛！', 'reassure')])
  ]);
  add('usopp', 'brook', '騙人布擅長把故事演得熱鬧，布魯克能配樂也能看穿漏洞。', [
    s('怪談配錯了樂', ['piano'], [t('等我說到門打開，你就彈最嚇人的！', 'explain'), t('明白。要讓您自己也嚇一跳的程度嗎？', 'tease'), t('不用！嚇觀眾就好，講故事的人要保持冷靜！', 'protest', 'talk'), t('那我先給您一個提示音，再開始。', 'reassure')]),
    s('不會倒的譜架', ['tool-bench'], [t('我在底下加了重量，現在不怕風吹。', 'offer'), t('真是幫了大忙，我終於能專心看譜。', 'bow'), t('先等一下，你還是要把紙夾住。', 'explain', 'startled'), t('啊，差點只留下穩穩的架子。多謝提醒！', 'laugh')]),
    s('英勇故事的節拍', [], [t('這段是在追逐，曲子要越來越快！', 'admire'), t('再快您就來不及說話了，要不要先留一拍？', 'think'), t('對喔。那一拍剛好讓我說最厲害的那句。', 'nod', 'talk'), t('好，我把舞台留給您，結尾再一起收。', 'offer')])
  ]);
  add('usopp', 'jinbe', '甚平不取笑恐懼，以具體指導幫騙人布把準備轉成自信。', [
    s('起霧的信號', ['helm'], [t('我做了提示燈，霧裡也找得到大家！', 'offer'), t('很周到。但這面要擋一下，別照進掌舵人的眼睛。', 'explain'), t('啊，對！加個遮光片就能調方向了。', 'work', 'nod'), t('試的時候叫老夫，我站遠些幫你看。', 'offer')]),
    s('先承認手在抖', [], [t('我手抖是船在動，才不是緊張。', 'protest'), t('船確實在動。先把腳站開一點。', 'explain'), t('咦，這樣真的穩多了。', 'admire', 'nod'), t('穩住再瞄，準備多一分，心裡就踏實一分。', 'reassure')]),
    s('拉得緊也解得開', ['tool-bench'], [t('這個結拉不開，夠結實了吧！', 'admire'), t('結實是好事。等要拆的時候，你打算怎麼辦？', 'think'), t('……再留一個活扣？', 'think', 'nod'), t('正是。會繫，也要能在需要時解開。', 'explain')])
  ]);
  add('sanji', 'chopper', '廚師與醫生一起照顧船員；香吉士也記得喬巴不是只吃甜食的小孩。', [
    s('醫生也要吃飯', ['medicine-cabinet'], [t('喬巴，湯放這裡。先喝了再看書。', 'offer'), t('等一下，這裡的份量快算完了！', 'think'), t('我不碰你的筆記。碗放旁邊，別餓著算。', 'nod', 'talk'), t('好。那你也坐下，你是不是還沒吃？', 'offer')]),
    s('甜點後的正餐', ['kitchen-table'], [t('甜的留到後面，先把這份吃了。', 'explain'), t('我知道啦！我是在看它會不會融化。', 'protest'), t('替你收涼的地方了，慢慢吃。', 'reassure', 'admire'), t('你連這都想到了！那我不用一直回頭看了。', 'talk')]),
    s('燙紅的指尖', [], [t('只是碰到鍋邊，一點紅而已。', 'nod', 'protest'), t('手不是對你很重要嗎？讓我檢查！', 'explain'), t('……有道理。麻煩你了，醫生。', 'nod', 'talk'), t('嗯！等我看完再去忙，不准偷溜。', 'work')])
  ]);
  add('sanji', 'robin', '香吉士殷勤照料，羅賓從容道謝與逗趣；不把互動寫成確定戀情。', [
    s('書籤旁的茶', ['bookshelf'], [t('羅賓小姐，茶放在您不會碰倒的這側。', 'offer'), t('謝謝。你連我慣用哪邊翻頁都記住了。', 'talk'), t('讓您安穩讀書，這點小事當然要留意。', 'bow', 'talk'), t('那我記得休息，免得你的茶一直等我。', 'tease')]),
    s('食譜裡的舊名字', ['kitchen-table'], [t('這張舊食譜的字，能請您幫我看看嗎？', 'think'), t('這是香料的舊名，不是另一種材料。', 'explain'), t('原來如此！難怪怎麼配都不對。', 'admire', 'talk'), t('成功以後，我想嚐嚐歷史的味道。', 'offer')]),
    s('看起來嚇人的點心', [], [t('今天試了新模子，您喜歡哪個形狀？', 'offer'), t('這個像小小的骷髏，很可愛。', 'talk', 'startled'), t('原來您喜歡這種！那我把眼窩做得更整齊。', 'work', 'tease'), t('呵呵，也替布魯克留一個吧，他會很高興。', 'talk')])
  ]);
  add('sanji', 'franky', '兩個實務專家互相照應；廚師的味覺與船匠的誇張創意會起衝突。', [
    s('別把可樂倒進去', ['kitchen-table'], [t('那鍋不是給你加燃料的，瓶子放下。', 'protest'), t('我還沒倒啊！只是覺得顏色挺配。', 'explain'), t('顏色配也不代表味道配。你的杯子在那邊。', 'explain', 'nod'), t('行，料理聽你的。我等現成的好味道！', 'talk')]),
    s('高一點的工作台', ['tool-bench'], [t('備料台能再高一點嗎？一直彎著腰不順手。', 'think'), t('能。你站平常的位置，我量你的手肘。', 'work'), t('這個高度就好，下面還得能收東西。', 'explain', 'nod'), t('懂了。外表不亂加，空間給你留足！', 'work')]),
    s('先擦掉眼淚', [], [t('飯還沒吃，怎麼又哭起來了？', 'think'), t('剛才聽到人家好好保存舊船的故事嘛。', 'talk'), t('行了，擦把臉。湯冷了味道就差了。', 'offer', 'nod'), t('謝了，兄弟。這種熱湯，現在喝特別對味。', 'talk')])
  ]);
  add('sanji', 'brook', '廚師與音樂家一起照料宴會；一方直接，一方禮貌而愛玩笑。', [
    s('熱湯與慢曲', ['piano'], [t('剛端上熱湯，別把大家唱得站起來。', 'explain'), t('明白，先用讓人坐得住的旋律。', 'nod'), t('吃完再鬧。你那份也留好了。', 'offer', 'bow'), t('謝謝！有晚餐等著，演奏更有力氣了。', 'talk')]),
    s('骨頭也算客人', ['kitchen-table'], [t('你想吃軟一點還是脆一點的？', 'think'), t('脆一點吧，我很欣賞清楚的骨感。', 'tease', 'protest'), t('我問口感，不是問你的感想。', 'protest', 'laugh'), t('喲呵呵，失禮了。請給我您拿手的那份。', 'bow')]),
    s('廚房外的排練', [], [t('你在這兒練，切菜倒是挺有節奏。', 'talk'), t('那我維持這個拍子，不會突然加速。', 'nod'), t('很好。結尾停一下，我剛好把這盤端出去。', 'work', 'nod'), t('那就讓菜先登場，我替它留個漂亮的空拍。', 'offer')])
  ]);
  add('sanji', 'jinbe', '兩人常先顧別人；會互相提醒對方也接受照顧。', [
    s('掌舵的人那一份', ['helm'], [t('這份幫你放穩，能騰出一隻手嗎？', 'offer'), t('這段先不行，等拐過前面再說。', 'explain'), t('那我等，省得你又吃冷的。', 'nod', 'talk'), t('多謝。轉過去老夫就坐下，不讓廚師白忙。', 'reassure')]),
    s('搬完再開火', ['kitchen-table'], [t('那箱放乾燥的地方，別靠著熱鍋。', 'explain'), t('這裡如何？地面也不會擋人。', 'work'), t('正好。重的都搬完了，你歇一下。', 'nod', 'nod'), t('還有你手上那袋，交給老夫再一起歇。', 'offer')]),
    s('不用剩最後一份', [], [t('你怎麼又等大家拿完才拿？', 'think'), t('看每個人都有了，老夫才放心。', 'nod'), t('我的份量算得很清楚，你也在裡面。', 'reassure', 'talk'), t('哈哈，倒是老夫多慮了。那就先嚐一口！', 'laugh')])
  ]);
  add('chopper', 'robin', '羅賓溫柔肯定喬巴的學習與判斷，喬巴也主動關照她。', [
    s('自己找到的答案', ['bookshelf'], [t('這個字好難，我查了三次才找到！', 'admire'), t('你還把相似的寫法記在旁邊了，很仔細呢。', 'talk'), t('才、才不是想讓妳誇我！下次就不會認錯了。', 'talk', 'talk'), t('那下次遇見它，我先請教喬巴醫生。', 'reassure')]),
    s('不只照顧小醫生', [], [t('羅賓，妳肩膀一直沒動，會不會痠？', 'think'), t('有一點，被你發現了。', 'nod'), t('書先放下，讓我看看！', 'offer', 'nod'), t('好，今天就聽醫生的。', 'reassure')]),
    s('怪故事的邊界', ['medicine-cabinet'], [t('舊書說這種草晚上會唱歌，真的嗎？', 'admire'), t('也可能是採藥的人把蟲聲記到草身上了。', 'think'), t('那要分開查，不能直接當成藥的特徵！', 'explain', 'nod'), t('正是。你已經會先問證據在哪裡了呢。', 'talk')])
  ]);
  add('chopper', 'franky', '喬巴對機關興奮，佛朗基認真替他設計；專業上互相學習。', [
    s('這次不是變身', ['tool-bench'], [t('哇！這裡打開以後還有一層！', 'admire'), t('特地做給你的，小瓶子不會跟繃帶擠一起。', 'offer'), t('那我拿藥會快很多！不是只有帥而已耶！', 'admire', 'laugh'), t('當然，帥和好用，這次一起做到！', 'laugh')]),
    s('醫生想知道的構造', [], [t('你這邊是機關，那不舒服的時候怎麼辦？', 'think'), t('先分清楚哪裡壞了，機關和身體分開看。', 'explain'), t('能畫給我嗎？我也想知道怎麼幫忙。', 'offer', 'talk'), t('好，慢慢講給你聽。這份心意我收到了！', 'reassure')]),
    s('矮一點的把手', ['medicine-cabinet'], [t('這個把手我搆得到，可是拉起來好吃力。', 'think'), t('那就不算做好。把位置再降一點。', 'work'), t('真的可以？我還以為是我力氣太小。', 'admire', 'nod'), t('東西是給你用的，當然要照你的手來做！', 'reassure')])
  ]);
  add('chopper', 'brook', '喬巴認真關心特殊的身體，布魯克用幽默化解疑問並肯定醫生。', [
    s('量不到的額頭', ['medicine-cabinet'], [t('你的額頭摸起來涼涼的……等一下，你是骨頭。', 'think'), t('是的，這個問題我也沒法用臉色回答您。', 'tease'), t('不能照一般方法看，我再記清楚一點。', 'work', 'nod'), t('謝謝您還這麼認真地替我想。', 'bow')]),
    s('跟得上的節拍', ['piano'], [t('我拍到第三下就亂了，你能慢一點嗎？', 'think'), t('當然。先只跟第一拍，其他交給我。', 'explain'), t('一、空、空……這次跟上了！', 'admire', 'talk'), t('很好！等您點頭，我們再多加一拍。', 'reassure')]),
    s('不必藏住高興', [], [t('你剛才說我的拍子很準，是真的嗎？', 'think'), t('真的，我有認真聽，沒有客套。', 'nod'), t('嘿嘿……那我下次還要一起！', 'talk', 'talk'), t('一定替您留位置，小小的樂手也是重要的同伴。', 'offer')])
  ]);
  add('chopper', 'jinbe', '喬巴不因外形差異放棄照顧；甚平平等尊重醫師的專業。', [
    s('大手也得放鬆', ['medicine-cabinet'], [t('甚平，手給我看看，握舵太久也會累。', 'offer'), t('好，這樣放可以嗎，醫生？', 'nod'), t('可以，不要出力，讓我看得清楚。', 'work', 'nod'), t('那就麻煩你。檢查完老夫也會記得休息。', 'reassure')]),
    s('海裡的知識', ['bookshelf'], [t('書上這種魚，我沒見過，真的會發光嗎？', 'admire'), t('會，但得在很暗的水裡才看得清楚。', 'explain'), t('原來不是一直亮！我要把這句補進筆記。', 'work', 'talk'), t('還想知道什麼，老夫能答的就說給你聽。', 'offer')]),
    s('搬得動與看得到', [], [t('這箱我搬得動！不用幫我。', 'protest'), t('老夫知道。只是箱子擋住你的路了。', 'explain'), t('啊……那你幫我看前面，我來搬？', 'think', 'nod'), t('好，先往左一點。咱們一起把它送到。', 'reassure')])
  ]);
  add('robin', 'franky', '安靜的考古學家與感性的船匠互相尊重；以物件留住故事。', [
    s('舊木片的來歷', ['tool-bench'], [t('這塊舊木頭，你特地留下來了？', 'think'), t('上面有以前修補的痕跡，丟掉怪可惜的。', 'talk'), t('修補也是它走過的路，留下很好。', 'nod', 'talk'), t('妳懂就好。可惡，突然讓人有點鼻酸啊。', 'talk')]),
    s('書架與祕密抽屜', ['bookshelf'], [t('新書架多了一個小抽屜。', 'think'), t('給妳放書籤和零碎筆記，省得掉進縫裡。', 'explain'), t('很貼心。用來藏祕密也正合適。', 'tease', 'admire'), t('喂，真藏了什麼可別讓我修的時候嚇一跳啊！', 'laugh')]),
    s('圖樣也有功能', ['map-table'], [t('這個花紋其實是排水道，不只是裝飾。', 'explain'), t('真的假的？拐角的位置還真能導水。', 'admire'), t('造它的人想得很仔細，跟你一樣。', 'talk', 'talk'), t('這話我愛聽！來，咱們把結構畫完整。', 'offer')])
  ]);
  add('robin', 'brook', '重視故事與記憶的兩人可以安靜對談，也能接住彼此冷幽默。', [
    s('沒有聲音的樂譜', ['bookshelf'], [t('這頁寫了一首歌的名字，卻沒有譜。', 'think'), t('名字我沒聽過，旁邊有記錄怎麼唱嗎？', 'think'), t('只有一句「大家一起唱」，很簡單的記錄呢。', 'talk', 'nod'), t('那至少知道了，寫下它的人當時並不孤單。', 'talk')]),
    s('讀書的配樂', ['piano'], [t('你把旋律放輕了，是怕打擾我嗎？', 'think'), t('是的，我看您剛翻到很認真的地方。', 'nod'), t('其實是一本笑話集，只是這頁不太好笑。', 'tease', 'startled'), t('那我得努力些，不能讓音樂也輸給那一頁。', 'tease')]),
    s('不用勉強笑出來', [], [t('今天的曲子很安靜。要我陪你坐一會兒嗎？', 'offer'), t('那真好。有時候不彈也想有人在旁邊。', 'talk'), t('我正好帶了書，我們慢慢待著。', 'rest', 'nod'), t('謝謝。等您翻完這章，我再試下一段。', 'reassure')])
  ]);
  add('robin', 'jinbe', '兩人尊重記錄與親身經驗的差別；語氣平穩而非互相說教。', [
    s('記錄和親眼所見', ['map-table'], [t('舊記錄說這裡有一道逆流，你見過嗎？', 'think'), t('見過相似的，但季節不同，不能當成同一次。', 'explain'), t('我把兩件事分開記，不急著合在一起。', 'work', 'nod'), t('這樣穩妥。老夫再說說當時的水色。', 'offer')]),
    s('茶桌上的船員們', [], [t('你已經習慣大家突然喊起來了嗎？', 'tease'), t('還在學。有時候喊得最大聲，事情反倒最小。', 'laugh'), t('譬如最後一塊點心不見的時候。', 'talk', 'laugh'), t('哈哈，那件事在船長心裡可不算小。', 'laugh')]),
    s('不同的稱呼', ['bookshelf'], [t('這兩個名字指的是同一個地方。', 'explain'), t('老夫聽過左邊那個，右邊倒是頭一次。', 'think'), t('我也只在書上見過。你能教我怎麼念嗎？', 'offer', 'nod'), t('當然。咱們一人補一半，名字就完整了。', 'talk')])
  ]);
  add('franky', 'brook', '豪放船匠與禮貌音樂家能共同把宴會做好，也理解老物件的感情。', [
    s('別把音量開到最大', ['piano'], [t('新底座！這次再大的聲音也撐得住！', 'admire'), t('太好了，不過大家的耳朵未必也撐得住。', 'tease'), t('哈！也是，那先用平常的音量試。', 'laugh', 'nod'), t('您聽，這樣聲音已經更穩了，不必更大聲。', 'work')]),
    s('小刮痕要留下', ['tool-bench'], [t('這道痕我能修平，要全部磨掉嗎？', 'think'), t('這一小道留下吧，看著會想起練過的曲子。', 'talk'), t('懂了。壞的修好，記得住的留著。', 'nod', 'bow'), t('謝謝您，這樣拿在手上還是熟悉的老朋友。', 'talk')]),
    s('動作和節奏', [], [t('我擺姿勢的時候，你幫我來個響亮的結尾！', 'offer'), t('沒問題。您先停穩，我才好把音放準。', 'explain'), t('好！一、二——SUPER！', 'admire', 'talk'), t('正好落在拍子上！這次連謝幕都配齊了。', 'laugh')])
  ]);
  add('franky', 'jinbe', '船匠與掌舵手用各自感覺維護船；信任來自準確的回饋。', [
    s('聽得到的小震動', ['helm'], [t('剛換好的軸，你轉起來感覺怎樣？', 'think'), t('大致順，回到中間還有一點細震。', 'explain'), t('連這都感覺得出來！我再調半圈。', 'work', 'nod'), t('現在好了。這個手感老夫記住了。', 'nod')]),
    s('不是越硬越好', ['tool-bench'], [t('我想再加一片，讓這裡更硬。', 'think'), t('留一點活動的餘地，浪推來時會不會更穩？', 'think'), t('有道理。加固連接處，讓這一段卸力。', 'work', 'nod'), t('你定結構，試船的感覺老夫幫你記。', 'offer')]),
    s('船在手裡的安心', [], [t('你掌舵的時候，我都能放心去忙別處。', 'talk'), t('有你把船顧好，老夫才能放心轉舵。', 'nod'), t('哈，這就叫配合！下次也照這樣來。', 'laugh', 'talk'), t('好。誰先發現不對，就喊另一個。', 'reassure')])
  ]);
  add('brook', 'jinbe', '兩個閱歷深的夥伴珍惜平靜陪伴；能一起笑，也願意互相傾聽。', [
    s('浪聲的空拍', ['piano'], [t('這段想留一點空白，讓海浪接進來。', 'think'), t('很好，浪小的時候，就連安靜也聽得見。', 'talk'), t('您願意坐到這首結束嗎？', 'offer', 'nod'), t('願意。茶還熱，老夫不急著走。', 'rest')]),
    s('禮貌的骨頭笑話', [], [t('今天的風真舒服，吹得我起雞皮疙瘩。', 'tease'), t('哈哈，你身上還找得到起疙瘩的地方嗎？', 'tease'), t('找不到，所以只好請您替我感受一下。', 'laugh', 'laugh'), t('那老夫替你點頭，這陣風確實不錯。', 'laugh')]),
    s('值夜的人也有歌聽', ['helm'], [t('大家睡了，我彈輕一點陪您掌舵吧。', 'offer'), t('有勞了。你若累了，隨時去歇。', 'reassure'), t('還不累。能把曲子彈給醒著的人聽就很好。', 'talk', 'nod'), t('那老夫好好聽，等天亮再請你喝茶。', 'offer')])
  ]);

  const ACTION_LABELS = Object.freeze({ talk: '交談', explain: '說明', nod: '點頭', laugh: '開懷', tease: '打趣', protest: '抗議', reassure: '安慰', admire: '驚喜', think: '思考', bow: '致意', listen: '聆聽', startled: '吃驚', offer: '招呼', work: '專心', rest: '休息' });
  const FURNITURE_VERBS = Object.freeze({ helm: '查看航向', 'map-table': '核對海圖', 'treasure-chest': '查看箱子', 'tangerine-tree': '照顧橘子樹', 'swords-rack': '整理刀架', 'kitchen-table': '整理餐桌', bookshelf: '翻閱書籍', 'medicine-cabinet': '清點藥品', piano: '練習樂曲', 'tool-bench': '修整零件' });
  const hasKey = key => Object.prototype.hasOwnProperty.call(PROFILES, key);
  const pairKeyFor = (a, c) => !hasKey(a) || !hasKey(c) || a === c ? null : Object.prototype.hasOwnProperty.call(SCENES, `${a}:${c}`) ? `${a}:${c}` : `${c}:${a}`;
  const at = (values, index) => { const n = Number(index); return values[((Number.isFinite(n) ? Math.trunc(n) : 0) % values.length + values.length) % values.length]; };
  const tuple = beat => [beat.line, beat.mood];
  const copyBeat = beat => beat ? { ...beat } : null;
  const deepFreeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(deepFreeze); Object.freeze(value); } return value; };
  const profile = key => hasKey(key) ? PROFILES[key] : null;
  const hasPair = (first, second) => !!pairKeyFor(first, second);
  const scene = (first, second, index = 0, context = {}) => {
    const key = pairKeyFor(first, second);
    if (!key) return null;
    const all = SCENES[key];
    const tagged = context && context.furnitureKey ? all.filter(value => value.tags.includes(context.furnitureKey)) : [];
    const excluded = new Set(Array.isArray(context?.recentSceneIds) ? context.recentSceneIds : []);
    const preferred = tagged.length ? tagged : all;
    const fresh = preferred.filter(value => !excluded.has(value.id));
    // If contextual choices were all recently used, broaden before repeating one.
    const broadFresh = all.filter(value => !excluded.has(value.id));
    const selected = at(fresh.length ? fresh : broadFresh.length ? broadFresh : all, index);
    return { ...selected, pair: [...selected.pair], tags: [...selected.tags], turns: selected.turns.map(value => ({ ...value, listener: { ...value.listener } })) };
  };
  // Legacy consumers receive the first line spoken by each requested character.
  // New consumers must play scene().turns in authored order, even for a reversed encounter.
  const pair = (first, second, index = 0) => {
    const value = scene(first, second, index);
    return value ? [first, second].map(key => tuple(value.turns.find(beat => beat.speaker === key))) : null;
  };
  const interactionBeat = (key, kind = 'chat', index = 0) => {
    if (!hasKey(key)) return null;
    const resolved = ['chat', 'work', 'bond', 'rest', 'claim'].includes(kind) ? kind : 'chat';
    return { speaker: key, ...copyBeat(at(SOLO[key][resolved], index)) };
  };
  const greeting = (key, index = 0) => { const value = interactionBeat(key, 'chat', index); return value ? tuple(value) : null; };
  const interaction = (key, kind = 'chat', index = 0) => { const value = interactionBeat(key, kind, index); return value ? tuple(value) : null; };
  const activity = (key, furnitureKey, index = 0) => {
    const values = hasKey(key) && Object.prototype.hasOwnProperty.call(SOLO[key].furniture, furnitureKey) && SOLO[key].furniture[furnitureKey];
    if (!values) return null;
    const value = at(values, index);
    return { speaker: key, ...copyBeat(value), verb: FURNITURE_VERBS[furnitureKey] || '使用家具', furnitureKey };
  };
  const CHARACTER_LINES = Object.fromEntries(KEYS.map(key => [key, {
    chat: SOLO[key].chat.map(value => value.line),
    reply: SOLO[key].bond.map(value => value.line),
    furniture: Object.fromEntries(Object.entries(SOLO[key].furniture).map(([name, values]) => [name, tuple(values[0])]))
  }]));
  const CHAT_MOODS = Object.fromEntries(KEYS.map(key => [key, SOLO[key].chat.map(value => value.mood)]));
  const PAIR_LINES = Object.fromEntries(Object.entries(SCENES).map(([key, values]) => [key, values.map(value => value.turns.slice(0, 2).map(tuple))]));
  [PROFILES, SOLO, SCENES, RELATIONSHIPS, CHARACTER_LINES, CHAT_MOODS, PAIR_LINES].forEach(deepFreeze);
  const api = Object.freeze({ KEYS, MOODS, POSES, ACTIONS, ACTION_LABELS, PROFILES, SOLO, SCENES, RELATIONSHIPS, CHARACTER_LINES, CHAT_MOODS, PAIR_LINES, profile, hasPair, scene, pair, greeting, interaction, interactionBeat, activity });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.OnePieceRoomDialogue = api;
})(typeof window !== 'undefined' ? window : globalThis);
