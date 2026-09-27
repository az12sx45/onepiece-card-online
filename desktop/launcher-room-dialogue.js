/* Original room vignettes; editorial sources: docs/LAUNCHER_CREW_RELATIONSHIPS_20260927.md. Stable API contract: docs/LAUNCHER_CREW_CANON_20260926.md. */
(function (root) {
  'use strict';
  const reserved = typeof module === 'object' && module.exports ? require('./launcher-reserved-crew.js') : root.OnePieceReservedCrew;
  const KEYS = Object.freeze(reserved?.SUPPORTED_KEYS || ['luffy', 'zoro', 'nami', 'usopp', 'sanji', 'chopper', 'robin', 'franky', 'brook', 'jinbe']);
  const MOODS = Object.freeze(['happy', 'surprised', 'focused', 'annoyed']);
  const POSES = Object.freeze(['idle', 'talk_happy', 'talk_annoyed', 'surprised', 'focused_use', 'sit', 'wave', 'listen']);
  // Intent tokens are mapped to existing poses. They do not assert that extra sprites exist.
  const PERFORMANCE = Object.freeze({
    talk: ['focused', 'idle'], explain: ['focused', 'idle'], nod: ['focused', 'idle'],
    laugh: ['happy', 'talk_happy'], smile: ['happy', 'talk_happy'], tease: ['focused', 'idle'], protest: ['annoyed', 'talk_annoyed'],
    reassure: ['focused', 'idle'], admire: ['surprised', 'surprised'], think: ['focused', 'idle'],
    bow: ['focused', 'wave'], listen: ['focused', 'listen'], startled: ['surprised', 'surprised'],
    offer: ['focused', 'wave'], work: ['focused', 'focused_use'], rest: ['focused', 'sit']
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
      chat: [b('喂！你也來！我們正要開始！', 'offer'), b('這東西怎麼玩的？先讓我試一下！', 'admire'), b('好無聊——騙人布又跑去哪了？', 'think'), b('哈哈哈！你剛才那個臉，再做一次！', 'laugh'), b('你會的我不會。那就交給你啊！', 'nod'), b('那邊好像有什麼！走，去看看！', 'offer')],
      work: [b('這一堆都要搬？那就一起搬走！', 'work'), b('要我守著？好，有人來我就喊！', 'nod'), b('先說好，什麼東西不能碰？', 'think'), b('這箱很輕嘛。下一箱在哪？', 'work')],
      bond: [b('下次也一起來！少一個人就不好玩了！', 'offer'), b('你說的地方，我也想去！帶路吧！', 'admire'), b('做得到啦。你不是已經決定了？', 'nod'), b('你怎麼不笑？有人欺負你嗎？', 'think')],
      rest: [b('開飯再叫我。不是開飯就先別叫。', 'rest'), b('這裡風好大，躺著超舒服！', 'laugh'), b('我剛才夢到一座會跑的島耶。', 'admire'), b('大家都在啊。那我再睡一下。', 'rest')],
      furniture: { 'kitchen-table': [b('這盤沒人坐！……喔，原來還有人沒來。', 'think'), b('香吉士！我坐好了！下一盤呢！', 'offer'), b('盤子都空了，還能再來一輪吧！', 'admire'), b('等等，我去把外面的人叫進來！', 'offer')], helm: [b('前面有東西！大大的！甚平你看！', 'admire'), b('這個交給甚平，我負責找島！', 'nod'), b('哈哈，轉過去的時候風都變了！', 'laugh'), b('娜美！還要多久才會到沒去過的地方？', 'offer')] }
    },
    zoro: {
      chat: [b('嗯？有事就說。', 'nod'), b('再一輪。剛才那下不算。', 'think'), b('刀還沒收，別靠那麼近。', 'explain'), b('這點吵鬧，還不至於睡不著。', 'tease'), b('……剛說完就更吵了。', 'protest'), b('等我練完。很快。', 'nod')],
      work: [b('重的放這邊。我一次搬。', 'work'), b('刀架我整理，刃口別朝外。', 'work'), b('通道留著，別讓人絆到。', 'explain'), b('這邊我顧。忙完再來換。', 'nod')],
      bond: [b('還要再來？行，站穩。', 'offer'), b('別老看別人。你自己的步子呢？', 'explain'), b('沒事。這邊我顧。', 'nod'), b('知道怕還沒退，已經不錯了。', 'nod')],
      rest: [b('醒著。只是懶得睜眼。', 'rest'), b('別坐刀上。旁邊有位子。', 'nod'), b('輪到我再叫。這班換你。', 'rest'), b('這裡挺好。吵的那幾個不在。', 'rest')],
      furniture: { 'swords-rack': [b('刀鞘也得擦，別只顧刀刃。', 'work'), b('順序沒錯。拿起來才順手。', 'nod'), b('別碰白色那把。要看就站這裡看。', 'explain'), b('今天還沒練夠，先不收。', 'think')] }
    },
    nami: {
      chat: [b('等一下！先把話聽完再往外衝！', 'protest'), b('風向變了，窗邊那幾張幫我壓住。', 'explain'), b('這片海，總有一天要親手畫進去。', 'think'), b('買之前先問我，別又搬一堆用不到的回來。', 'explain'), b('人都回來了？……好，這就好。', 'nod'), b('今天誰把濕杯子放在我的海圖上？', 'protest')],
      work: [b('我把潮位補上，等等就能對航線。', 'work'), b('清單給我，缺的和想要的分開寫。', 'explain'), b('橘子樹先移到有光的地方。', 'work'), b('船員的份都算進去了，不會漏你的。', 'nod')],
      bond: [b('你還記得那個記號啊，省了我好多事。', 'talk'), b('想知道航線就問我。先把重點聽清楚喔。', 'offer'), b('累了就坐吧。我剛好也想歇一下。', 'offer'), b('有我看著航線，你還怕找不到路嗎？', 'tease')],
      rest: [b('我只休息一會兒，誰都不准加新麻煩。', 'rest'), b('帳算完了！終於能喝杯茶。', 'talk'), b('這種天氣，曬衣服剛剛好。', 'think'), b('香吉士的點心還有一份，別讓魯夫看見。', 'tease')],
      furniture: { 'map-table': [b('暗礁在這裡。這條可不是捷徑。', 'explain'), b('這張是我畫的，別折到海岸線。', 'work'), b('先看雲，再對風。指針可不會把全部告訴你。', 'think'), b('差這一角……畫完就能接起來了。', 'work')], 'tangerine-tree': [b('土還濕，不用再澆了。', 'think'), b('誰想摘，先來問我。聽見沒有？', 'explain'), b('新葉長出來了呢。這裡的光剛剛好。', 'talk'), b('嗯，聞起來還是熟悉的味道。', 'rest')] }
    },
    usopp: {
      chat: [b('來得正好！見識一下本大爺的新發明！', 'offer'), b('我不是怕，我是先替大家看好退路！', 'protest'), b('別拉那根線！那不是裝飾！', 'protest'), b('看到了吧！正中紅心，沒有第二下！', 'admire'), b('故事還沒完！厲害的在後面！', 'offer'), b('你說修這個？哼，拿過來吧。', 'nod')],
      work: [b('先拿空的試，不准把正式的直接裝上去！', 'explain'), b('這個卡榫讓我磨一下，不能硬塞。', 'work'), b('靶子固定好，我再測一次。', 'work'), b('今天不吹牛。這個我真的修得好。', 'nod')],
      bond: [b('你剛才真的信我？……嘿，那當然會中！', 'laugh'), b('怕歸怕，答應你的事我記著。', 'nod'), b('這個還沒給別人看。你先幫我試試。', 'offer'), b('剛才尖叫那聲就當沒聽見，說好了！', 'protest')],
      rest: [b('英雄也要喘口氣。不是累倒，是喘氣。', 'rest'), b('別突然喊我！差點把點子嚇忘了！', 'protest'), b('今天工具都收好了，誰也別來借。', 'rest'), b('我只躺一下，夢裡還得繼續冒險呢。', 'tease')],
      furniture: { 'tool-bench': [b('這裡再磨一點，拉起來才不會咬手。', 'work'), b('成功！……等等，再試一次才準。', 'admire'), b('這顆小螺絲才是重點。小不代表沒用！', 'explain'), b('不准亂收！我知道每一片放在哪！', 'protest')], 'treasure-chest': [b('不是打不開，我在聽機關的聲音。', 'think'), b('原來是木頭脹了。哼，早就猜到了。', 'tease'), b('蓋子先墊著，夾到手就什麼都做不了了。', 'work'), b('這裡面要是有寶藏，可得算我一份喔！', 'offer')] }
    },
    sanji: {
      chat: [b('肚子餓了？洗手，馬上就好。', 'offer'), b('還差一點香氣……嗯，就這個。', 'think'), b('這盤是娜美小姐的，伸手前想清楚。', 'protest'), b('晚回來也有飯吃，急著吞什麼。', 'explain'), b('有想吃的就說。冰箱裡有的，我想辦法。', 'offer'), b('別把剩菜丟了，還能做一鍋好湯。', 'work')],
      work: [b('刀給我。你把洗好的菜瀝乾。', 'work'), b('桌角擦一遍，端湯才不會滑。', 'explain'), b('剩下的食材還能熬湯，不准丟。', 'work'), b('火我看著，你去叫還沒吃的人。', 'nod')],
      bond: [b('上次那道還想吃？行，我記著。', 'nod'), b('忙的時候也得顧好自己，別逞強。', 'offer'), b('做事挺仔細。下次也來幫忙吧。', 'talk'), b('吃飽再忙，廚房不會把你那份收走。', 'reassure')],
      rest: [b('爐火關了，這下能喝一口熱茶。', 'rest'), b('吃得連醬都不剩……算有眼光。', 'tease'), b('菜單明天再想，現在不接加餐。', 'rest'), b('那塊不是剩下的，是留給你的。', 'offer')],
      furniture: { 'kitchen-table': [b('端穩。湯潑了可不是再擦一次就完事。', 'work'), b('最後那位還沒坐下，別把他的也吃了。', 'explain'), b('盤子都拿來。空盤子才讓廚師看得舒服。', 'talk'), b('剛起鍋，這個要趁熱。', 'offer')], 'tangerine-tree': [b('只摘答應好的兩顆。娜美小姐的樹可得顧好。', 'work'), b('這香氣，用一點果皮就夠了。', 'think'), b('還差一點熟，今天先留著。', 'nod'), b('點心做得好不好，等她嚐一口就知道。', 'talk')] }
    },
    chopper: {
      chat: [b('有哪裡不舒服？先讓我看，不准逞強！', 'explain'), b('這兩種葉子很像，不能只認顏色！', 'think'), b('笨蛋！誇我也不會高興啦！……嘿嘿。', 'laugh'), b('騙人布剛才說的，你也聽到了嗎？好厲害！', 'admire'), b('藥跟糖不要放一起！真的會拿錯！', 'protest'), b('等我把這一行看完，就去找你們玩！', 'offer')],
      work: [b('藥瓶標籤朝外，先看清楚再拿。', 'work'), b('我在核對份量，等一下再跟你玩。', 'think'), b('用過的繃帶分開放，不能混回去。', 'work'), b('有人不舒服就叫我，我聽得到！', 'offer')],
      bond: [b('你還記得提醒我休息啊！謝謝！', 'talk'), b('這個我研究懂了！你要聽嗎？', 'offer'), b('今天有比昨天好一點！真的！', 'admire'), b('不舒服就說。我是醫生，不會嫌你麻煩！', 'reassure')],
      rest: [b('藥箱扣好了，嗯……可以休息一下。', 'rest'), b('沒睡著！我只是不小心閉了眼睛！', 'protest'), b('明天還要再看一遍。這裡不能記錯。', 'think'), b('你也坐一下，我分你一小塊甜的。', 'offer')],
      furniture: { 'medicine-cabinet': [b('這瓶快用完了，先記起來。', 'work'), b('標籤朝外，急用時才不會找不到。', 'work'), b('沒問過我，不准自己拿來吃！', 'explain'), b('繃帶放乾燥的這層……好了！', 'nod')], bookshelf: [b('這兩本寫的不一樣，我要再比一次。', 'think'), b('原來還有這種情況！得記下來！', 'admire'), b('不是只看圖，旁邊的小字也要看！', 'explain'), b('這一頁看懂了！下一次就能認出來！', 'laugh')] }
    },
    robin: {
      chat: [b('你也對這個記號有興趣嗎？', 'offer'), b('這一頁的空白，比寫了字的地方更有意思呢。', 'think'), b('大家突然安靜，我還以為被什麼拖走了。', 'tease'), b('不急，缺的那一角也許還找得到。', 'think'), b('你想先聽結局？那可少了不少樂趣。', 'tease'), b('這個小東西……做得真可愛。', 'talk')],
      work: [b('先把書頁壓平，墨跡還沒乾。', 'work'), b('這個字有別的寫法，我再核對一次。', 'think'), b('書名留在外側，你下次就找得到了。', 'work'), b('先記下看見的，再寫我們的猜想。', 'explain')],
      bond: [b('上次你問的事，我找到另一種說法了。', 'offer'), b('坐吧。安靜一會兒也很好。', 'offer'), b('先別急著說，我想猜猜你會怎麼回答。', 'tease'), b('有人願意聽，記下這些就更有意思了。', 'talk')],
      rest: [b('書籤放在這裡，明天再繼續。', 'rest'), b('咖啡的香味剛剛好，謝謝。', 'talk'), b('這麼吵還能讀書，我也有點習慣了呢。', 'tease'), b('你看窗邊，光慢慢移過去了。', 'rest')],
      furniture: { bookshelf: [b('同一件事，兩個人寫得完全不同呢。', 'think'), b('這本的書脊修好了，可以放心翻。', 'offer'), b('別擦掉頁邊的小字，也許是很久以前的讀者。', 'explain'), b('找到你了。原來一直夾在這一頁。', 'talk')], 'map-table': [b('這個地名比港口還老，先留著吧。', 'think'), b('一口井、一條路。這裡曾經有人住呢。', 'think'), b('地圖只畫了門口，裡面得親眼去看。', 'offer'), b('線路變了，舊路也不必急著擦掉。', 'explain')] }
    },
    franky: {
      chat: [b('聽聽！這才是機關該有的聲音！', 'admire'), b('想做什麼就說！先讓我看看你的點子！', 'offer'), b('這一根不起眼？少了它，整個都得散！', 'explain'), b('哪裡不好使，指出來！現在就改！', 'nod'), b('舊木頭怎麼了？還有的是地方用得上！', 'protest'), b('成啦！這回才叫 SUPER！', 'laugh')],
      work: [b('量兩次再下手，省得你重新搬材料。', 'work'), b('把底座壓穩，我來鎖這邊。', 'work'), b('這裡加護邊，喬巴跑過來也不會刮到。', 'explain'), b('裝好還不算完，得試到真的能用。', 'think')],
      bond: [b('這個你還留著啊……可惡，有點感動啊！', 'talk'), b('別光想，把草圖拿來！咱們做一個！', 'offer'), b('歪了就改。放著不管才叫浪費材料！', 'explain'), b('你的點子可別只放在心裡，說出來一起想！', 'offer')],
      rest: [b('工具歸位！接下來，欣賞成品！', 'rest'), b('哈！這時候來口可樂，剛剛好！', 'laugh'), b('我在聽船的聲音。修好哪裡，聽得出來。', 'think'), b('別催，帥氣的設計也得醞釀一下！', 'tease')],
      furniture: { 'tool-bench': [b('量好了再切！切短了可長不回來！', 'work'), b('會動還不算完，停下來也得穩！', 'explain'), b('換下來的分開放，別再拿回去裝！', 'work'), b('哈哈！一點不卡，這才配交給大家用！', 'laugh')], helm: [b('這個手感得讓甚平試。船是拿來開的！', 'offer'), b('太鬆不行，太緊也不行。再調一點。', 'work'), b('聽到了，那道小聲音就在這裡。', 'think'), b('老伙計，接下來還要靠你帶我們走遠點！', 'talk')] }
    },
    brook: {
      chat: [b('來得正好。今天想聽輕快一點的嗎？', 'offer'), b('喲呵呵呵，您連那個小小的錯音都聽到了！', 'laugh'), b('我已經坐得很端正了，骨架可以作證。', 'tease'), b('先別鼓掌，我還留著一小段呢。', 'offer'), b('有人一起哼，曲子就會往別的方向走呢。', 'talk'), b('剛才那個聲音很好聽，讓我記一下。', 'think')],
      work: [b('先把弦調準，再為大家練一段。', 'work'), b('這頁樂譜壓好了，不會隨風旅行。', 'work'), b('我在找大家都唱得上的調。', 'think'), b('先聽四拍，您再跟進來就好。', 'explain')],
      bond: [b('您還記得上一回的旋律，真好。', 'talk'), b('慢一點也沒關係，這段我跟著您。', 'offer'), b('下一首讓您選。想熱鬧，還是想安靜？', 'offer'), b('那個位子替您留著，隨時來聽。', 'talk')],
      rest: [b('音符歇一會兒，現在換海聲了。', 'rest'), b('茶很香。真想深深吸一口……雖然沒有肺。', 'tease'), b('我不睡，只是想多坐一會兒。', 'rest'), b('今天的安可結束了，明天請早。', 'tease')],
      furniture: { piano: [b('先試一個音……嗯，這個音量正好。', 'work'), b('這一段，請大家一起拍手！', 'offer'), b('慢半拍也無妨，我們從這裡再接。', 'work'), b('今天的最後一首，留給還醒著的人。', 'offer')], bookshelf: [b('同一段旋律，竟有兩種寫法。', 'think'), b('這裡少了一頁。前面的曲調我還記得。', 'think'), b('找到適合大家一起唱的調了。', 'talk'), b('請輕一點翻，老樂譜的脾氣比較脆。', 'tease')] }
    },
    jinbe: {
      chat: [b('哦，來了。這裡剛好空著。', 'offer'), b('舵穩著呢，你們安心忙吧。', 'nod'), b('剛才那一下不錯。別全說成運氣。', 'nod'), b('哈哈，這艘船可真沒一刻冷清。', 'laugh'), b('別只看水面，腳下的船也會告訴你。', 'explain'), b('先聽你說，老夫的話等會兒也不遲。', 'offer')],
      work: [b('先確認繩子收妥，再調這邊的舵。', 'work'), b('風和水流方向不同，得一起看。', 'think'), b('這趟我顧著，你先去用餐。', 'reassure'), b('慢些轉。等船身回穩了再加力。', 'explain')],
      bond: [b('你說的事，老夫還記得。後來怎樣了？', 'think'), b('這回你顧這邊，另一邊交給老夫。', 'nod'), b('不用急著走。坐一會兒，再慢慢說。', 'offer'), b('這個小地方你也留意到了，不錯。', 'talk')],
      rest: [b('手離了舵，倒得想想往哪裡擺了。', 'tease'), b('這段水流平，老夫也歇口氣。', 'rest'), b('你們笑得這麼遠都聽得到，在玩什麼？', 'think'), b('不急，這壺茶喝完再收。', 'rest')],
      furniture: { helm: [b('浪推過來了，順著它放一點。', 'work'), b('方向穩了，不必一直跟它較力。', 'explain'), b('這個手感，船匠確實費了心思。', 'nod'), b('娜美，下一個轉向聽妳的。', 'offer')], 'map-table': [b('這段先記著，進去時還得看看水色。', 'think'), b('圖上的線很細，海裡可得留足位置。', 'explain'), b('把這裡和風向對起來，就看得清楚些。', 'work'), b('妳畫的，老夫記住了。', 'nod')] }
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
  Object.assign(PROFILES, reserved?.profiles || {});
  Object.assign(SOLO, reserved?.solo || {});
  for (const key of KEYS) if (CLAIM[key]) SOLO[key].claim = CLAIM[key];
  const SCENES = {};
  const RELATIONSHIPS = {};
  // Text is authored for the named pair; there is no name-substitution dialogue fallback.
  const t = (line, action = 'talk', reaction = 'listen') => [line, action, reaction];
  const s = (topic, tags, turns) => ({ topic, tags, turns });
  // A conversation is not a furniture dock. Do not mime tools or sit on an absent chair.
  // Furniture activity() keeps its separately authored focused_use/sit pose contract.
  const conversationPose = action => action === 'work' || action === 'rest' ? 'idle' : PERFORMANCE[action][1];
  const add = (a, c, relationship, stories) => {
    const pairKey = `${a}:${c}`;
    RELATIONSHIPS[pairKey] = relationship;
    SCENES[pairKey] = stories.map((story, index) => ({
      id: `${a}-${c}-${index + 1}`, pair: [a, c], topic: story.topic, tags: story.tags,
      relationship, cooldownMs: 90000,
      turns: story.turns.map(([line, action, reaction], n) => ({
        speaker: n % 2 ? c : a, ...b(line, action), pose: conversationPose(action),
        listener: { key: n % 2 ? a : c, action: reaction, mood: PERFORMANCE[reaction][0], pose: conversationPose(reaction) },
        durationMs: Math.max(2300, Math.min(5000, 950 + Array.from(line).length * 105))
      }))
    }));
  };
  add('luffy', 'zoro', '不用反覆確認的信任。魯夫先行動，索隆嫌他吵卻會跟上；索隆認真時，魯夫不打斷也不說教。', [
    s('睡覺的人也算一份', [], [t('索隆！我們要玩猜拳，你也來！', 'offer'), t('不玩。我要睡。', 'rest'), t('好！那你贏了叫你！', 'laugh', 'startled'), t('睡著要怎麼贏啊。', 'protest', 'laugh')]),
    s('還差幾下', ['swords-rack'], [t('喂，你到底還要練多久？', 'think'), t('還有三百。餓了就先去。', 'nod'), t('那我吃完再來！你那份我不吃！', 'offer', 'think'), t('……最好是。', 'tease', 'laugh')]),
    s('船長往前看', ['helm'], [t('前面那個黑黑的是島嗎？', 'admire'), t('不知道。你不是想去看？', 'nod'), t('嗯！那就去！', 'laugh', 'nod'), t('先看清楚再說。別又自己跳下去。', 'explain', 'talk')])
  ]);
  add('luffy', 'nami', '航線交給娜美、冒險衝動留給魯夫。娜美的火氣來自收拾爛攤子，信任不需要變成順從的小孩。', [
    s('海圖不是摺紙', ['map-table'], [t('娜美，海圖能折成船嗎？', 'offer'), t('你敢折，我就讓你自己記住每一條海岸線。', 'protest', 'startled'), t('那還是妳畫，我坐真的船好了！', 'laugh', 'protest'), t('很好，這次總算想清楚了。', 'protest', 'startled')]),
    s('越大的雲越想去', ['map-table'], [t('那邊的雲好大！裡面有什麼啊？', 'admire'), t('有會把你吹走的風。現在往反方向。', 'explain', 'protest'), t('欸——我們不是要去沒去過的地方嗎！', 'protest', 'think'), t('等船平安到了，你愛看多久都行！', 'protest', 'nod')]),
    s('空著的地方', ['map-table'], [t('這一塊怎麼空白？忘了畫？', 'think'), t('還沒親眼看過。我要畫自己的海圖。', 'think'), t('那就一起去看！這邊，還有這邊！', 'offer', 'talk'), t('手指擦乾淨再指……嗯，都會去的。', 'talk', 'laugh')]),
    s('還沒闖禍的船長', [], [t('娜美！妳剛剛是不是叫我？', 'offer'), t('沒有。你先說，你又闖了什麼禍？', 'think'), t('還沒有啊！', 'laugh', 'protest'), t('那個「還」是怎麼回事！', 'protest', 'laugh')])
  ]);
  add('luffy', 'usopp', '兩個玩伴能把小玩意講成大冒險。魯夫真心驚嘆，騙人布順勢吹大；需要手藝時則信得毫不猶豫。', [
    s('不能按的那一顆', ['tool-bench'], [t('這顆紅的按下去會怎樣？', 'admire'), t('哼哼，問得好！那是本大爺的秘密——', 'explain', 'admire'), t('我可以按了吧！', 'offer', 'startled'), t('我還沒接好啊！先別碰！', 'protest', 'startled')]),
    s('釣上來的島', [], [t('騙人布，你真的釣過一座島？', 'admire'), t('千真萬確！只是魚線太細，我讓牠走了。', 'explain', 'admire'), t('那就換粗一點的，再釣一次！', 'offer', 'startled'), t('不用！那座島今天休息！', 'protest', 'think')]),
    s('笑臉畫在哪', ['tool-bench'], [t('幫我畫一個旗子！要超厲害的！', 'offer'), t('你剛才畫的那張呢？', 'think'), t('大家都說那是魚骨頭。', 'protest', 'laugh'), t('哈！放著，本大爺幫你把船長的臉救回來。', 'laugh', 'admire')])
  ]);
  add('luffy', 'sanji', '魯夫用吃光表達認可，香吉士用罵聲守住廚房；廚師知道餓肚子的分量，船長也不懷疑他的本事。', [
    s('最大的那份', ['kitchen-table'], [t('香吉士！下次開飯，我要最大的那份！', 'admire'), t('你哪次不是？先把上次只記得吃忘了說的補上。', 'protest', 'think'), t('好吃！超好吃！', 'offer', 'nod'), t('這還差不多。下次也不准剩。', 'protest', 'laugh')]),
    s('試吃的意見', ['kitchen-table'], [t('剛才那個，再給我一個！', 'admire'), t('先說味道怎麼樣，這可是試做的。', 'think'), t('再給我十個！', 'laugh', 'talk'), t('……算了，你的意見我聽懂了。', 'tease', 'admire')]),
    s('廚師還沒坐下', ['kitchen-table'], [t('下次開飯，你也要一起吃！', 'think'), t('知道了。廚師總得先把收尾做好。', 'work'), t('那我等你！……一下下也算等吧！', 'offer', 'startled'), t('連這個都要討價還價。別偷吃我的就行。', 'protest', 'laugh')]),
    s('剛才你也笑了', [], [t('香吉士，你剛剛也在笑吧！', 'laugh'), t('誰叫你說要安靜，自己先笑出來。', 'tease', 'laugh'), t('哈哈！可是你也笑了啊！', 'offer', 'think'), t('行了行了。別笑到岔氣。', 'tease', 'laugh')])
  ]);
  add('luffy', 'chopper', '一起對稀奇事興奮，卻不抹掉船醫的地位；喬巴能對船長發脾氣，魯夫相信他而非把他當寵物。', [
    s('棉花糖雲', [], [t('喬巴，那朵雲像不像你的棉花糖？', 'admire'), t('像！不過雲真的不能吃嗎？', 'think'), t('試過才知道！', 'offer', 'admire'), t('等等！你不准從這裡跳！', 'protest', 'startled')]),
    s('醫生說了才算', ['medicine-cabinet'], [t('不痛了，就算好了吧？', 'talk'), t('不行！恢復得怎麼樣，要確認過才知道！', 'protest', 'startled'), t('喔，那下次也交給你！', 'offer', 'protest'), t('當然！你也不准自己亂下結論！', 'explain', 'nod')]),
    s('真的會聽懂', [], [t('剛才那隻鳥罵你什麼？', 'think'), t('牠沒有罵我，牠說有人搶牠的餅乾。', 'explain', 'think'), t('是牠的啊？我還以為掉在那裡。', 'startled', 'protest'), t('果然是你！下次看清楚，別連鳥的份也吃掉！', 'protest', 'startled')])
  ]);
  add('luffy', 'robin', '羅賓不把魯夫的奇想都糾正成常識；魯夫不懂考古卻在乎她想看什麼，兩人的信任可以很短。', [
    s('古書裡的怪獸', ['bookshelf'], [t('這個長三個頭！真的有嗎？', 'admire'), t('也可能只是畫家畫錯了，捨不得擦掉。', 'tease', 'think'), t('有就好了！三個頭可以一起吃飯！', 'laugh', 'talk'), t('那餐費大概也很驚人呢。', 'tease', 'laugh')]),
    s('想看的那個地方', ['map-table'], [t('你一直看這個地方。想去？', 'think'), t('嗯。想看看石頭上還留著什麼字。', 'think'), t('好啊！妳看字，我去找好玩的！', 'offer', 'talk'), t('那麼，請先別把寫字的石頭敲開。', 'tease', 'startled')]),
    s('猜拳寫在臉上', ['bookshelf'], [t('羅賓，下次跟我猜拳！我想好要出什麼了！', 'offer'), t('已經寫在你臉上了呢。', 'talk', 'protest'), t('真的嗎！那我換一個！', 'protest', 'talk'), t('好。這次記得連表情一起換。', 'talk', 'laugh')]),
    s('最響的安靜', [], [t('羅賓，妳剛剛在笑什麼？', 'think'), t('你們說要安靜，卻比誰喊得大聲。', 'tease', 'think'), t('那我贏了！', 'laugh', 'talk'), t('嗯，連比賽是誰開始的都忘了呢。', 'tease', 'laugh')])
  ]);
  add('luffy', 'franky', '船長的毫無保留驚嘆正中船匠的浪漫。佛朗基可以陪著胡鬧，但碰到船就有自己的堅持。', [
    s('明明只是抽屜', ['tool-bench'], [t('佛朗基！這個也會變形嗎！', 'admire'), t('現在還不會。你覺得往哪裡展開好？', 'think', 'admire'), t('全部！上面再加個大炮！', 'admire', 'laugh'), t('懂行啊，船長！……不過得先想好裝在哪裡！', 'laugh', 'nod')]),
    s('要叫大家一起看', [], [t('你剛才說的那個變形，再講一次！', 'admire'), t('喂，剛才不是聽得最起勁嗎！', 'protest', 'laugh'), t('想像不出來嘛！一定超厲害的！', 'offer', 'talk'), t('哈哈！那就從最帥的地方再講一遍！', 'laugh', 'admire')]),
    s('船不只是坐的', ['helm'], [t('這傢伙每天都跟我們一起冒險耶。', 'talk'), t('當然！船可不是只把人從這裡搬到那裡。', 'explain', 'nod'), t('哈哈！那你可要把它顧好！', 'offer', 'nod'), t('用得著你說！它要去的地方還多著呢。', 'reassure', 'laugh')])
  ]);
  add('luffy', 'brook', '魯夫對音樂與骷髏都坦率好奇；布魯克可以接荒唐話，日常的邀請比反覆感傷更能呈現珍惜。', [
    s('骷髏怎麼唱', ['piano'], [t('布魯克，你都沒嘴唇，怎麼吹口哨啊？', 'think'), t('這個嘛……我自己也想過。', 'think', 'admire'), t('哈哈哈！你也不知道啊！再吹一次！', 'laugh', 'laugh'), t('那就不研究了，請聽！', 'offer', 'admire')]),
    s('鼓掌不是搶拍', ['piano'], [t('這段我會！噔噔噔——！', 'laugh'), t('船長，您又比我早到副歌了。', 'tease', 'think'), t('那你也快一點！', 'offer', 'laugh'), t('喲呵呵呵，那大家可要跟緊了！', 'laugh', 'admire')]),
    s('不等到宴會才唱', [], [t('下次唱歌，我也要一起！', 'offer'), t('好啊。船長喜歡熱鬧一些的吧？', 'think'), t('嗯！我會的那段要唱兩次！', 'reassure', 'talk'), t('那就先約好了。副歌可別又提早進來喔。', 'offer', 'nod')])
  ]);
  add('luffy', 'jinbe', '魯夫把甚平當能一起玩的可靠夥伴，甚平尊重船長又能拉住危險；不要全寫成父親訓小孩。', [
    s('海底要自己看', ['map-table'], [t('海底真有會發光的魚？', 'admire'), t('有。越暗的地方，看起來越清楚。', 'explain', 'admire'), t('帶我去！啊，我不能游，那坐船去！', 'offer', 'laugh'), t('哈哈，這回倒先想到了。找個好地方給你看。', 'laugh', 'admire')]),
    s('掌舵的也要加入', ['helm'], [t('甚平！下一個換你唱！', 'offer'), t('老夫的歌，可沒布魯克那麼好聽。', 'think'), t('我又沒問好不好聽！快來！', 'laugh', 'laugh'), t('好！舵穩住，就來一段。', 'offer', 'admire')]),
    s('原來笑點在這裡', [], [t('騙人布以前說被怪魚追三天，你信嗎？', 'think'), t('頭一次聽，老夫還認真想了是哪種魚。', 'think', 'admire'), t('哈哈！我也是！', 'admire', 'startled'), t('原來如此。下回聽故事，得多留意他的表情。', 'laugh', 'laugh')])
  ]);
  add('zoro', 'nami', '娜美直接使喚，索隆嘴上嫌麻煩卻做得快；方向笑點有上限，也保留航海士與戰鬥員各司其職。', [
    s('桌子不是床', ['map-table'], [t('這裡空著，借我歇一下。', 'rest'), t('那是放海圖的地方。休息去旁邊。', 'protest', 'think'), t('海圖有那麼大？', 'think', 'protest'), t('對，剛好比你的懶腰還大。旁邊去！', 'protest', 'nod')]),
    s('門沒有自己走', [], [t('出口不是在這邊？', 'think'), t('你剛從那裡進來。', 'explain', 'think'), t('……有人改過房間吧。', 'protest', 'protest'), t('改的是你腦袋裡的地圖！跟著我！', 'protest', 'nod')]),
    s('信得過的守夜', ['helm'], [t('還在想航線？', 'think'), t('嗯。你有空的話，幫我留意一下外面。', 'offer'), t('知道了。妳慢慢想。', 'nod', 'talk'), t('有你這句就夠了。', 'talk', 'nod')])
  ]);
  add('zoro', 'usopp', '索隆不配合浮誇演說，也不否定真正的技術；騙人布怕他莽撞，必要時敢大聲阻止。', [
    s('靶子後面的人', [], [t('你說百發百中，什麼情況都行？', 'tease'), t('當然！……前提是別有人自己跑到靶子後面！', 'protest', 'think'), t('怎麼，沒把握？', 'tease', 'protest'), t('有把握也不能拿夥伴練膽子！', 'protest', 'nod')]),
    s('纏得好的握把', ['tool-bench'], [t('這個鬆了。能弄緊？', 'think'), t('哼，小意思。本大爺可是——', 'explain'), t('行。交給你。', 'nod', 'startled'), t('……至少把我的介紹聽完嘛！', 'protest', 'tease')]),
    s('怕也沒有退開', ['treasure-chest'], [t('你躲那麼遠，鎖怎麼開？', 'think'), t('我是在觀察！裡面說不定有東西！', 'protest'), t('有就砍了。你開鎖。', 'nod', 'think'), t('別把鎖也砍了啊……好，我來。', 'work', 'nod')])
  ]);
  add('zoro', 'sanji', '互嗆、競爭、默契並存。照顧藏在實物與行動裡，不互相溫柔稱讚，也不是認真憎恨。', [
    s('多出來的那碗', ['kitchen-table'], [t('這碗怎麼放我這？', 'think'), t('煮多了。你要是不吃就拿走，綠藻頭。', 'protest'), t('有酒就更好了。', 'tease', 'protest'), t('有飯吃還挑！碗底也給我吃乾淨。', 'protest', 'talk')]),
    s('誰擋了路', [], [t('讓開，圈圈眉。', 'protest'), t('上次端湯的時候，也是你擋在路中間！', 'protest'), t('……左邊。', 'nod', 'nod'), t('知道了。下次別又擠到喬巴。', 'explain', 'nod')]),
    s('刀有各自的用途', ['swords-rack'], [t('切薄片，有那麼多講究？', 'tease'), t('當然。不是什麼東西都劈成兩半就好。', 'protest', 'tease'), t('行，下次留一盤。', 'nod', 'protest'), t('想吃就記得幫忙。嘴巴說說可不算！', 'protest', 'laugh')])
  ]);
  add('zoro', 'chopper', '寡言的劍士會給喬巴依靠；船醫遇到逞強立刻嚴厲。索隆承認醫囑但不是每次都乖得毫無摩擦。', [
    s('不痛不是沒受傷', ['medicine-cabinet'], [t('你又要提醒什麼？', 'nod'), t('下次受了傷，不准再用小傷兩個字帶過！', 'protest', 'startled'), t('……記住了。', 'protest', 'work'), t('還有，不准自己拆繃帶！這句也記住！', 'explain', 'nod')]),
    s('打瞌睡的鼻子', ['bookshelf'], [t('喬巴，鼻子快壓到書了。', 'nod', 'startled'), t('啊！我沒睡！我只是……在記！', 'protest'), t('去睡。記不住就明天再看。', 'reassure', 'think'), t('那你也去睡，不准趁我不在練刀喔。', 'explain', 'nod')]),
    s('要拿哪一本', ['bookshelf'], [t('又在找書？', 'offer', 'admire'), t('想看藍色那本！可是還有上一本文字沒記完。', 'offer'), t('一本一本來。書又不會跑。', 'nod', 'talk'), t('我知道！……只是想學的太多了嘛。', 'offer', 'tease')]),
    s('沒睡也瞞不過醫生', [], [t('又盯著我做什麼？', 'think'), t('你昨晚是不是又沒睡？', 'think'), t('睡不睡也歸醫生管？', 'protest', 'protest'), t('熬夜練刀就歸我管！不准裝傻！', 'protest', 'nod')])
  ]);
  add('zoro', 'robin', '兩人容得下安靜，羅賓的輕描淡寫與索隆的直線反應形成反差；不把默契硬寫成曖昧。', [
    s('安靜的位子', ['bookshelf'], [t('我在這裡睡，不吵妳。', 'rest'), t('好。你若開始打鼾，我會翻頁大聲一點。', 'tease', 'think'), t('我不打鼾。', 'protest', 'talk'), t('那我們就都很安靜呢。', 'talk', 'rest')]),
    s('古畫裡的握法', ['swords-rack'], [t('那把刀畫反了。', 'think'), t('也許畫的是不會用刀的人。', 'think'), t('會先砍到自己的腳。', 'explain', 'talk'), t('難怪下一頁只剩一隻鞋。', 'tease', 'startled')]),
    s('不用替人找話', [], [t('妳剛才在笑什麼？', 'think'), t('你問了三次出口，三次都往另一邊走。', 'tease', 'protest'), t('……那妳怎麼不說。', 'protest', 'talk'), t('我想看看第四次會不會不同。', 'tease', 'protest')])
  ]);
  add('zoro', 'franky', '索隆只談用途，佛朗基堅持用途之外也要帥。戰士的重量與船匠的地板形成具體衝突。', [
    s('刀架不需要登場', ['swords-rack'], [t('刀架牢就好。不要機關。', 'explain'), t('打開時冒點煙，三把刀一起升起來呢？', 'admire', 'protest'), t('我拔刀不用等煙散。', 'protest', 'think'), t('嘖！那就把帥藏在結構裡！', 'work', 'nod')]),
    s('比地板還結實', ['tool-bench'], [t('這個再加重。', 'offer'), t('你打算練手，還是練穿地板？', 'think', 'think'), t('地板撐得住就行。', 'nod', 'protest'), t('喂！先等我把底座做出來！', 'protest', 'nod')]),
    s('船匠不借武器', [], [t('木頭卡住的時候，不能直接切？', 'offer'), t('得先看有什麼用。整塊留著，可能更合適。', 'protest', 'think'), t('知道了。要幫忙就說。', 'work', 'nod'), t('嘿！有你這句，省下不少力氣！', 'laugh', 'tease')])
  ]);
  add('zoro', 'brook', '尊重彼此劍術，說話節奏卻相反。布魯克用禮貌包住玩笑，索隆只留下必要的肯定。', [
    s('聽步子', ['piano'], [t('剛才那段，再來一次。', 'offer'), t('喜歡嗎？我可以再加個華麗的轉音。', 'admire', 'think'), t('不用。那個拍子剛好。', 'nod', 'bow'), t('明白，劍士先生需要的是步子啊。', 'talk', 'nod')]),
    s('收劍比解說快', ['swords-rack'], [t('出手挺快。', 'nod', 'bow'), t('過獎。其實祕訣是放鬆肩膀——', 'explain'), t('下次一起練。我想看看你的步子。', 'offer', 'talk'), t('樂意之至。您還真是一句就約好了呢。', 'tease', 'nod')]),
    s('不在睡覺時嚇人', [], [t('你能不能走路出個聲。', 'protest'), t('抱歉。我已經很努力踩出腳步聲了。', 'bow'), t('你站我旁邊，我一睜眼都是骨頭。', 'protest', 'laugh'), t('那下次先說早安。骨頭就不換了。', 'tease', 'protest')])
  ]);
  add('zoro', 'jinbe', '兩人以實際判斷交換信任；甚平有經驗但不擺師父架子，索隆會觀察技術也敢坦白要求。', [
    s('先把東西固定', ['helm'], [t('等會兒還會晃？', 'think'), t('右邊有道浪。你那些重物，先綁牢些。', 'explain'), t('知道。這邊我來。', 'work', 'nod'), t('有你看著，老夫就專心顧舵。', 'nod', 'nod')]),
    s('換班不用推辭', [], [t('輪到我了。你去歇。', 'nod'), t('剛好，茶還熱著。你要一杯麼？', 'offer'), t('換成酒。', 'tease', 'laugh'), t('哈哈，值完這一班再喝。', 'laugh', 'nod')]),
    s('穩不是站死', ['swords-rack'], [t('剛才那一下，你腳沒動。', 'think'), t('力氣跟著船卸掉，就不必硬頂。', 'explain'), t('嗯……再來一次。', 'work', 'think'), t('在這裡？先把旁邊的杯子挪開吧。', 'tease', 'nod')])
  ]);
  add('nami', 'usopp', '會一起怕，也能一起想辦法。娜美看穿吹牛卻真心依賴騙人布的發明，兩人都不是只會躲的背景。', [
    s('說明書最後一行', ['tool-bench'], [t('這次不會噴出花吧？', 'think'), t('當然不會！我已經改成——', 'explain', 'protest'), t('等一下。你先把最後一句說完。', 'protest', 'startled'), t('……不會噴任何東西。這樣總行了吧！', 'protest', 'tease')]),
    s('都想站在後面', ['treasure-chest'], [t('你剛才不是說，這種箱子開過一千個？', 'think'), t('對，所以我決定把這次機會讓給妳。', 'explain', 'protest'), t('免了，我很尊重前輩。你請。', 'tease', 'startled'), t('那、那我們數三聲一起開！不准偷跑！', 'offer', 'nod')]),
    s('真正管用的東西', ['map-table'], [t('這支筆很好畫，不會一直漏墨了。', 'talk', 'admire'), t('哼哼！換了裡面的細管，這可是精密技術。', 'explain'), t('再幫我改兩支。我下張海圖要用。', 'offer', 'talk'), t('兩支是吧！……喂，稱讚怎麼順便變訂單了？', 'protest', 'laugh')]),
    s('昨晚誰先尖叫', [], [t('昨晚先尖叫的是誰啊？', 'tease'), t('那叫警告！我替大家發現危險！', 'protest', 'think'), t('對，連我都被你的警告嚇到了。', 'tease', 'protest'), t('妳也叫了吧！那聲明明比我大！', 'protest', 'protest')])
  ]);
  add('nami', 'sanji', '香吉士見娜美會明顯變軟、變熱情；娜美懂得差遣也會真心道謝，不把她寫成只懂佔便宜。', [
    s('連名字都變甜', ['kitchen-table'], [t('香吉士，今天的茶不要太甜。', 'offer'), t('遵命，娜美小姐！連香氣都替妳挑好了！', 'smile'), t('茶可以。端來的時候別轉圈就好。', 'tease', 'think'), t('當然！我會穩穩地替妳送來！', 'smile', 'talk')]),
    s('摘橘子的許可', ['tangerine-tree'], [t('你是不是又在打我橘子的主意？', 'tease'), t('只要兩顆！我想做一道配下午茶的點心。', 'offer'), t('熟的那兩顆可以。我的那份多留一點。', 'nod', 'admire'), t('當然！娜美小姐的那份，我親自端來！', 'bow', 'talk')]),
    s('沒有催的晚餐', ['kitchen-table'], [t('先幫我留著，這段畫完就吃。', 'think'), t('已經替妳保溫了。湯在這裡，先喝一口。', 'offer', 'talk'), t('你每次都記得。謝啦。', 'talk', 'admire'), t('娜美小姐說謝謝了……！今晚再加一道！', 'laugh', 'protest')]),
    s('答應以前先問我', [], [t('香吉士，你剛剛是不是又替我答應了什麼？', 'think'), t('只是一點小事，娜美小姐交給我！', 'smile'), t('那下次先問我。我的休息時間也是小事嗎？', 'protest', 'startled'), t('當然不是！誰都不准打擾娜美小姐休息！', 'smile', 'tease')])
  ]);
  add('nami', 'chopper', '娜美會護著喬巴，也會被醫生訓；喬巴不是拿甜食就能打發的小寵物，而是能作決定的夥伴。', [
    s('醫生抓到熬夜的人', ['bookshelf'], [t('我沒有累，這一頁算完就好。', 'protest'), t('妳剛才算了兩遍，答案還不一樣！', 'explain', 'startled'), t('……被你看到了啊。', 'think', 'protest'), t('當然！我是來叫妳休息的，不是幫妳找橡皮擦！', 'protest', 'nod')]),
    s('先買藥', ['medicine-cabinet'], [t('藥箱還缺哪些？寫給我。', 'offer'), t('這兩種比較貴，可以再等——', 'think', 'protest'), t('藥不能等。其他人的零食才要等。', 'explain', 'admire'), t('嗯！我把用量也寫清楚！', 'work', 'nod')]),
    s('誇獎藏不住', [], [t('剛才喬巴一開口，那兩個就乖乖坐下了呢。', 'tease', 'admire'), t('別、別這樣說啦！醫生本來就要那樣！', 'protest'), t('好，我們可靠的船醫。', 'talk', 'laugh'), t('妳這樣誇我……我也不會多給糖喔！', 'laugh', 'tease')])
  ]);
  add('nami', 'robin', '兩個女性夥伴有自己的興趣與鬆弛日常。娜美能吐槽羅賓的陰暗想像，羅賓會逗她而非總當老師。', [
    s('一本適合睡前的書', ['bookshelf'], [t('這本好看嗎？想睡前翻一點。', 'offer'), t('很好看。失蹤的人到第三章才從牆裡出來。', 'talk', 'startled'), t('……有沒有牆裡沒人的？', 'protest', 'tease'), t('有一本海邊旅行。只是船長不見了。', 'tease', 'protest')]),
    s('讀不完的午後', ['tangerine-tree'], [t('今天真安靜。難得不用急著安排下一件事。', 'think'), t('那就先把這一會兒留給自己吧。', 'tease', 'think'), t('嗯，晚一點再想也來得及。', 'rest', 'talk'), t('我也這麼想。多待一會兒吧。', 'offer', 'talk')]),
    s('地名底下的人', ['map-table'], [t('舊地圖上這裡明明是一座港口。', 'think'), t('名字留下了，居民也許搬到別處了。', 'explain'), t('到了附近，我們繞過去看看吧。', 'offer', 'talk'), t('嗯。妳畫海岸，我找留下的字。', 'nod', 'nod')]),
    s('還沒來得及阻止', [], [t('妳是不是早就知道他們會吵起來？', 'think'), t('我只猜他們撐不過一分鐘。', 'tease', 'think'), t('那妳怎麼不攔一下？', 'protest', 'talk'), t('還沒來得及，妳就來了。', 'tease', 'protest')])
  ]);
  add('nami', 'franky', '實用、預算對上船匠的浪漫，不是永遠否決。娜美看見維修成果，佛朗基能接受具體限制。', [
    s('窗簾不需要發射', [], [t('我要的是會遮光的窗簾。', 'explain'), t('那就做個按鈕，一按整片展開，多帥！', 'admire', 'protest'), t('還要把人彈出去嗎？', 'tease', 'think'), t('那是另一個設計……好啦，先做普通的！', 'protest', 'nod')]),
    s('這筆錢可以花', ['map-table'], [t('這塊板一定要換？', 'think'), t('外面看不出來，裡面已經吃不住力了。', 'explain'), t('好。船的東西不能省在這裡。', 'nod', 'talk'), t('就等妳這句！我會挑塊配得上它的！', 'work', 'nod')]),
    s('一直在響的抽屜', ['tool-bench'], [t('晚上終於沒有喀啦喀啦的聲音了。', 'talk'), t('小意思！換了個卡扣，船晃也不跑。', 'explain', 'talk'), t('這種改造，我很贊成。', 'tease', 'laugh'), t('嘿，沒有大炮也能叫好作品吧！', 'laugh', 'nod')])
  ]);
  add('nami', 'brook', '娜美直截了當劃界線，布魯克禮貌接住而不糾纏；音樂能改變日常氣氛，並非只剩失禮笑話。', [
    s('帳本的拍子', ['piano'], [t('先停一下，我都跟著你的拍子算錯了。', 'protest', 'startled'), t('失禮了。要我改成慢板嗎？', 'bow'), t('改成沒有聲音的那種。', 'tease', 'think'), t('那是休止符專場。容我安靜演出。', 'tease', 'laugh')]),
    s('配合天氣', [], [t('下雨的時候，樂譜可得先收好。', 'explain', 'startled'), t('記住了。我倒想寫一首雨天的曲子。', 'admire'), t('可以寫，別拿真的雨來泡。', 'protest', 'bow'), t('放心，這次只有音符會滴滴答答。', 'tease', 'talk')]),
    s('留下來的安可', ['piano'], [t('剛才最後那段，怎麼不彈下去了？', 'think'), t('怕耽誤大家休息。您還想聽？', 'offer'), t('想。這次我不算帳了。', 'rest', 'talk'), t('那麼，就為這杯茶再加一段。', 'offer', 'nod')])
  ]);
  add('nami', 'jinbe', '航海士判讀，掌舵手落實，兩人也會彼此修正與肯定；專業交接用明確訊號，不泛講人生道理。', [
    s('等到我的訊號', ['helm'], [t('下回遇到那種浪，先別轉，等我的訊號。', 'explain'), t('明白。先讓船頭穩住。', 'nod', 'nod'), t('那道浪過後就往右，別提早。', 'explain', 'think'), t('交給老夫。這個時機，老夫記住了。', 'nod', 'talk')]),
    s('海圖以外的水', ['map-table'], [t('這片水的顏色和圖上不一樣。', 'think'), t('底下的流變了。讓老夫再看看浪紋。', 'think'), t('好，我把兩邊的風也記下來。', 'work', 'nod'), t('兩邊對上了再走，省得白繞一圈。', 'nod', 'nod')]),
    s('船上最該小心的人', [], [t('以前魯夫說只去旁邊看看，你還真信了？', 'protest', 'startled'), t('那時他講得很肯定，老夫以為——', 'think', 'protest'), t('他說旁邊，通常就是看不到的地方！', 'protest', 'think'), t('原來如此。這條也得記進航海須知啊。', 'laugh', 'talk')])
  ]);
  add('usopp', 'sanji', '香吉士能拆穿空話，卻尊重騙人布真正做得到的事；關心藏在端飯和留面子，非訓話式鼓勵。', [
    s('攪拌器不能搶廚師', ['tool-bench'], [t('看！本大爺的自動攪拌器，能省十個廚師！', 'explain'), t('先省下它噴到牆上的半碗醬吧。', 'protest', 'startled'), t('那是高速試驗！把速度降下來就行！', 'protest', 'think'), t('降吧。攪得勻，我就拿它做今晚的醬。', 'work', 'admire')]),
    s('勇士的肚子', ['kitchen-table'], [t('本大爺守在這裡，半天沒挪過一步！', 'explain'), t('難怪肚子叫得隔壁都聽見了。拿去。', 'offer', 'startled'), t('這、這是戰士集中精神的聲音！', 'protest', 'tease'), t('隨便你。邊吃邊集中，別掉滿桌。', 'tease', 'talk')]),
    s('沒喊出來的謝謝', ['tool-bench'], [t('抽屜修好了！你看，拉到底也不會掉。', 'offer'), t('正好。裡面的東西拿出來看看。', 'nod', 'think'), t('這不是我愛吃的魚嗎？', 'admire', 'talk'), t('本來就是你的。吃完把抽屜留給我用。', 'tease', 'laugh')]),
    s('這次讓你說完', [], [t('本大爺剛才可是差一點就——', 'explain'), t('就怎樣？這次我聽你說完。', 'talk', 'startled'), t('……你突然不吐槽，我反而忘了。', 'think', 'tease'), t('先想好再吹。要是真有麻煩，就直說。', 'reassure', 'nod')])
  ]);
  add('usopp', 'chopper', '崇拜會把騙人布的牛越吹越大，醫學卻是喬巴的主場；保留玩伴關係，不讓其中一人永遠是傻瓜。', [
    s('一萬人的掌聲', [], [t('當年一萬個人，都等著本大爺登場！', 'explain', 'admire'), t('一萬個！你站在哪裡才聽得完他們說話？', 'admire'), t('當、當然是最高的地方！', 'explain', 'admire'), t('那我也要練高一點！先搬張椅子！', 'offer', 'startled')]),
    s('不能出門的病', ['medicine-cabinet'], [t('糟了，我得了今天不能整理房間的病。', 'think', 'startled'), t('真的？哪裡痛？把手伸出來！', 'work', 'startled'), t('不用這麼認真！只是看到灰塵就……', 'protest', 'think'), t('那就戴上口罩。這下可以整理了！', 'offer', 'protest')]),
    s('醫生的箱扣', ['tool-bench'], [t('試試這個扣子，戴手套也開得了。', 'offer', 'think'), t('真的！拿藥的時候就不會卡住了！', 'admire'), t('哼，船上的大醫生，工具可不能掉鏈子。', 'tease', 'laugh'), t('少、少誇我啦！……再幫我做另一邊好不好？', 'laugh', 'talk')])
  ]);
  add('usopp', 'robin', '騙人布的虛張聲勢遇上羅賓平靜補刀；她也看得見細工和想像力，不能每場都只把他嚇哭。', [
    s('箱子裡的敲門聲', ['treasure-chest'], [t('這箱子……剛才是不是敲了一下？', 'think'), t('也許裡面的人想出來。', 'talk', 'startled'), t('妳不要那麼平靜地說有人啊！', 'protest', 'tease'), t('那你站近一點，我們確認看看。', 'offer', 'startled')]),
    s('看得出的修補', ['bookshelf'], [t('書脊黏好了。哼，簡單得很。', 'explain'), t('連原來的花紋都接回去了。', 'talk', 'admire'), t('那、那個花了比較久。我想別把圖遮住。', 'think', 'talk'), t('我很喜歡。這一頁也一起留下了呢。', 'talk', 'laugh')]),
    s('故事不能少一個人', [], [t('最後，本大爺一箭射穿了怪物的帽子！', 'explain'), t('牠為什麼戴帽子？', 'think', 'startled'), t('因為……怕冷！是個很怕冷的怪物！', 'explain', 'talk'), t('那就替牠留一頂吧。你不是已經贏了？', 'tease', 'think')])
  ]);
  add('usopp', 'franky', '共同熱愛手藝但尺度不同。佛朗基有船匠權威，仍讓騙人布保留自己的發明、判斷與成就感。', [
    s('別把小機關做大', ['tool-bench'], [t('這扣子是單手開的。不要改成雙炮管啊！', 'explain', 'think'), t('喔？拇指這麼一頂……嘿，有你的！', 'admire'), t('要的就是這種手感，省力又不會誤開。', 'explain', 'nod'), t('好，這部分聽你的。外殼我替你磨牢！', 'work', 'talk')]),
    s('一起卡在最後一步', ['tool-bench'], [t('奇怪，明明照圖做的，怎麼差一點？', 'think'), t('先別敲。你看看底下那顆墊片。', 'explain', 'think'), t('啊！多放了一片！', 'startled', 'tease'), t('哈！不是每次都得造新東西，有時少一片就成了！', 'laugh', 'talk')]),
    s('不只是船匠的名字', [], [t('喂，介紹的時候別全算成你做的喔。', 'protest'), t('誰搶你功勞了？機關可是你想的。', 'nod', 'talk'), t('那我先講原理，你最後讓它動！', 'offer', 'admire'), t('成交！這次我們兩個一起帥！', 'laugh', 'laugh')])
  ]);
  add('usopp', 'brook', '吹牛的敘事與配樂能彼此抬轎，也能當場穿幫。騙人布怕骷髏氣氛，布魯克自己也怕可怕的事。', [
    s('英雄出場的音樂', ['piano'], [t('等我說到巨人倒下，你就彈最厲害的那段！', 'explain'), t('明白。剛剛那聲尖叫要配嗎？', 'think', 'startled'), t('那是巨人的！不是我的！', 'protest', 'tease'), t('好的，巨人的高音真細緻呢。', 'tease', 'protest')]),
    s('最不該怕鬼的人', [], [t('窗邊那個影子……你去看看。', 'think'), t('請不要推我！萬一真是幽靈怎麼辦？', 'startled', 'protest'), t('你自己不就是骷髏嗎！', 'protest', 'protest'), t('骷髏也會害怕的啊！一起去！', 'protest', 'nod')]),
    s('譜架的用處', ['tool-bench'], [t('新譜架好了！船晃的時候也夾得住。', 'offer', 'admire'), t('太好了。上面這個小架子呢？', 'think'), t('放茶杯。你老是彈到一半找不到杯子。', 'tease', 'talk'), t('連這個都記著。今晚請您先點曲子。', 'offer', 'laugh')])
  ]);
  add('usopp', 'jinbe', '甚平有時把誇口當真，使騙人布得自己找台階；真正遇到害怕時，給他可做的事而非抽象打氣。', [
    s('傳說要講清楚', [], [t('我以前可是馴服過海裡最大的怪魚！', 'explain'), t('哦？背鰭是圓的，還是分成三岔？', 'think', 'startled'), t('那個……牠太大了，我只看得到頭。', 'think'), t('原來如此。下次畫給老夫看看，或許認得。', 'offer', 'startled')]),
    s('手抖也能發訊號', ['helm'], [t('要是霧大到連人都看不到，還能傳訊號嗎？', 'think'), t('能。先確認兩邊看得見什麼，不能只顧自己喊。', 'explain'), t('懂了！連這個也得挑準地方！', 'admire', 'nod'), t('嗯。觀察的本事，到那時就派得上用場。', 'reassure', 'nod')]),
    s('會解開的繩結', ['tool-bench'], [t('看！越扯越緊，絕對不會鬆！', 'explain'), t('不錯。現在你試試把它解開。', 'offer', 'think'), t('……糟了，真的不會鬆。', 'startled', 'tease'), t('哈哈，留個繩耳。綁得牢，也要解得開。', 'explain', 'nod')])
  ]);
  add('sanji', 'chopper', '廚師和醫師一起照料全船，也管彼此逞強。甜食笑點之外保留喬巴的專業，不拿他當寵物餵。', [
    s('醫生自己的那份', ['kitchen-table'], [t('喬巴，別只管別人，自己的正餐也要記得。', 'offer'), t('我知道！醫生也得有精神才能幫忙！', 'explain'), t('知道就好。忙過頭時，我可會提醒你。', 'reassure', 'nod'), t('那你也一樣！不能只嚐味道就算吃過！', 'protest', 'think')]),
    s('甜的不能替代全部', ['kitchen-table'], [t('棉花糖等一下。先吃這個。', 'explain'), t('我知道！正餐有正餐的營養！', 'protest'), t('知道就把藏在盤底的拿出來。', 'tease', 'startled'), t('你怎麼發現的……明明只藏了一小團！', 'protest', 'laugh')]),
    s('廚師的手也得看', ['medicine-cabinet'], [t('在廚房忙的時候，總會有點小碰傷。', 'nod'), t('所以才不能隨便帶過！你不是最重視這雙手嗎！', 'protest', 'think'), t('……知道了。有事會找你，醫生。', 'offer', 'work'), t('說好了！不准只報一半！', 'explain', 'nod')]),
    s('醫生也算在大家裡', [], [t('小醫生，你也該歇會兒了。', 'offer'), t('大家的情況我還沒問完！', 'explain'), t('大家好得很。最該問的是你自己。', 'tease', 'think'), t('那我們一起休息！你也別偷偷回廚房！', 'protest', 'smile')])
  ]);
  add('sanji', 'robin', '香吉士熱情獻殷勤，羅賓平靜接話偶爾故意偏題；她的回應是同伴信任，不暗示已成戀人。', [
    s('茶不能替人翻書', ['bookshelf'], [t('羅賓小姐，咖啡好了！再來一份點心嗎？', 'offer'), t('謝謝。先放這裡，我想把這段看完。', 'talk'), t('那我等妳。需要我翻頁也可以！', 'smile', 'tease'), t('翻頁我自己來。點心倒是很需要。', 'tease', 'smile')]),
    s('古書裡的食材', ['bookshelf'], [t('這個果子的名字，我從沒聽過。', 'think'), t('是舊稱。旁邊畫的葉子，也許認得出來。', 'explain'), t('真的！那就能試著重做這道菜了。', 'admire', 'talk'), t('做好請留一份。我也想知道書裡是什麼味道。', 'offer', 'admire')]),
    s('甜點的名字', ['kitchen-table'], [t('還記得上次那道點心嗎？名字我還沒想好。', 'offer'), t('像一隻從沙裡伸出來的手呢。', 'think', 'startled'), t('手、手嗎？那明明是照花做的……', 'think', 'tease'), t('我很喜歡。下次也留著那個形狀吧。', 'talk', 'laugh')]),
    s('不用每次都忙起來', [], [t('羅賓小姐，有什麼能替妳效勞的？', 'smile'), t('陪我聊聊。你不用每次都忙起來。', 'talk'), t('只要陪妳就行？樂意之至！', 'smile', 'talk'), t('嗯，先從你剛才沒說完的故事開始吧。', 'offer', 'smile')])
  ]);
  add('sanji', 'franky', '兩個職人都挑剔手感和成品，能嫌對方亂來也肯互相配合；佛朗基的可樂不取代所有食物。', [
    s('不是所有東西都加可樂', ['kitchen-table'], [t('先說好，下次也不准往湯裡加可樂。', 'protest', 'think'), t('上次只是放在旁邊，又沒倒！', 'protest'), t('上次你也是這麼說。', 'protest', 'tease'), t('好啦！我就喝我的可樂，好好吃你做的！', 'laugh', 'nod')]),
    s('合手才是好台子', ['tool-bench'], [t('工作台高半寸。再高就不好使力。', 'explain'), t('這麼講就對了！你平常切菜站哪裡？', 'think'), t('這邊。手肘過去不能撞到。', 'explain', 'work'), t('懂了，給你留足。做好可得請我吃一頓！', 'offer', 'tease')]),
    s('還惦記著那個故事', ['kitchen-table'], [t('那個故事，你到現在還惦記著啊？', 'tease'), t('你懂什麼！那個老頭等了整整十年啊！', 'protest'), t('知道了。下次有後續，我再說給你聽。', 'offer', 'talk'), t('那還用說！可別給我漏掉結尾！', 'protest', 'tease')]),
    s('留一聲給醒著的人', [], [t('喂，你怎麼一開口就那麼大聲？', 'protest'), t('精神夠足才叫 SUPER 啊！', 'laugh', 'think'), t('休息的人也會被你喊醒。', 'protest', 'think'), t('哈！那下一聲留到大家都醒了再來！', 'laugh', 'nod')])
  ]);
  add('sanji', 'brook', '廚師和音樂家一起把宴會做起來；香吉士直接吐槽，布魯克用禮貌和小笑話接回，不每句提骨頭。', [
    s('盛湯不用配快板', ['piano'], [t('慢一點，我端湯都跟著你加速了。', 'protest', 'startled'), t('失禮了！這段改成散步的速度。', 'bow'), t('等人坐齊再鬧。熱的別讓大家錯過。', 'explain', 'nod'), t('明白。先請各位用餐，安可稍候！', 'offer', 'talk')]),
    s('沒有胃也算一份', ['kitchen-table'], [t('你的牛奶。別一開口又講沒胃。', 'offer', 'startled'), t('啊，笑話先被您拿走了。', 'tease'), t('那就喝。甜點也給你留著。', 'nod', 'talk'), t('謝謝。這次我就安靜享用了。', 'bow', 'nod')]),
    s('廚房聽得到', [], [t('剛才那首不錯。下次再彈。', 'nod', 'admire'), t('原來您也記得那首？', 'think'), t('那個拍子聽過就記得了。做事時還會想起來。', 'tease', 'laugh'), t('喲呵呵，那下次就替您留著這首。', 'laugh', 'talk')])
  ]);
  add('sanji', 'jinbe', '兩個習慣先照顧旁人的人互相拉到餐桌前；平實、有笑意，不連續敬語推辭或泛談責任。', [
    s('舵旁的飯', ['helm'], [t('還沒輪到人換班？先吃，這碗端得住。', 'offer'), t('謝了。過了這個彎，老夫就放手。', 'nod'), t('那我等這個彎，別又冒出下一個。', 'tease', 'laugh'), t('哈哈，被你看穿了。這次說到做到。', 'laugh', 'nod')]),
    s('海裡的食材', ['kitchen-table'], [t('這種海藻在哪種水裡長？味道不太一樣。', 'think'), t('水流快的岩邊常見。老夫可以指給你看。', 'explain', 'admire'), t('好。知道長在哪裡，下次就能挑對。', 'nod', 'talk'), t('那老夫也想嚐嚐，你打算怎麼煮它。', 'offer', 'nod')]),
    s('別只挑小的', ['kitchen-table'], [t('甚平，你拿那個碗吃得飽？', 'think'), t('想著大家都還沒盛，就先拿小些。', 'nod'), t('鍋裡多的是。別替我的份量操心。', 'offer', 'talk'), t('好，那這回老夫可不客氣了。', 'laugh', 'nod')]),
    s('不用一直道謝', [], [t('只是叫你一起歇口氣，別又謝個沒完。', 'tease'), t('習慣了。你們照顧得周到。', 'nod'), t('少來，你顧著大家的時候可沒先問誰謝你。', 'tease', 'think'), t('哈哈，說得也是。那老夫就不客氣了。', 'laugh', 'nod')])
  ]);
  add('chopper', 'robin', '羅賓喜歡喬巴的小心思但尊重醫師判斷；喬巴主動關心她。冷幽默會收住，不把他一直嚇著。', [
    s('自己找出的答案', ['bookshelf'], [t('羅賓！這段我看懂了！不是同一種葉子！', 'admire'), t('嗯，葉脈不一樣。你先發現的。', 'talk', 'laugh'), t('也、也沒多厲害啦！我才看了三次！', 'laugh', 'tease'), t('那我把另一頁留給你，醫生。', 'offer', 'admire')]),
    s('讀書的人要動一動', [], [t('妳坐太久了，肩膀會痛喔。', 'explain'), t('被發現了。再看一頁也不行嗎？', 'tease', 'protest'), t('不行！剛才已經再看一頁了！', 'protest', 'talk'), t('好，那陪我走一小段吧。', 'offer', 'nod')]),
    s('可怕的故事到這裡', ['bookshelf'], [t('那個人掉進洞裡，後來呢？', 'think'), t('鞋子先浮了上來。', 'talk', 'startled'), t('人呢？人有沒有事！', 'startled', 'think'), t('他把鞋脫掉游回來了。這次可以放心。', 'reassure', 'laugh')])
  ]);
  add('chopper', 'franky', '喬巴對機械是真心崇拜，也會用醫師眼光發問；佛朗基享受觀眾，卻願意為小醫生解決具體麻煩。', [
    s('還沒開始就發亮', ['tool-bench'], [t('你說的那個構造，也能用來變形嗎？', 'admire'), t('嘿，有些地方還得想一想！你倒是問到重點了！', 'explain', 'admire'), t('真的做好了，一定要第一個告訴我！', 'offer', 'laugh'), t('當然！你這麼期待，本大爺更有幹勁啦！', 'laugh', 'admire')]),
    s('醫生想檢查', ['medicine-cabinet'], [t('機械的地方不會痛，就不用管了嗎？', 'think'), t('也得管！軸卡了，就要檢查、上油。', 'explain', 'think'), t('旁邊還是你的身體，有異樣也要告訴我！', 'explain', 'nod'), t('行！機械歸我，身體就拜託醫生了。', 'reassure', 'laugh')]),
    s('把手要拿得到', ['medicine-cabinet'], [t('太高了，拿藥每次都要先搬凳子。', 'think'), t('那就改低。多低你用著最順？', 'offer', 'think'), t('到這裡！可是大瓶的還要放得下。', 'explain', 'nod'), t('一起算進去！這可是醫生自己的藥櫃！', 'work', 'admire')]),
    s('想學的還有那麼多', [], [t('佛朗基，你小時候就想造船了嗎？', 'think'), t('早著呢！想造的東西多到自己都記不住！', 'laugh', 'admire'), t('我也是！想學的醫術多到一天根本不夠！', 'admire', 'nod'), t('哈！那你每學會一樣，本大爺就替你慶祝一次！', 'offer', 'laugh')])
  ]);
  add('chopper', 'brook', '醫生認真看待骷髏的特殊身體，音樂家不嘲弄那份認真；玩笑與安靜陪伴都能成立。', [
    s('量不到的體溫', ['medicine-cabinet'], [t('你沒有皮膚，平常怎麼知道自己不舒服？', 'think'), t('這個嘛……骨頭的事，我也得仔細想想。', 'tease', 'think'), t('有跟平常不一樣的地方，就要告訴我喔！', 'protest', 'nod'), t('好。您這麼認真，我也會好好留意的。', 'reassure', 'nod')]),
    s('藏不住的拍子', ['piano'], [t('我練拍子的時候，常常不小心越數越快。', 'think'), t('先選自己跟得上的速度，就不容易急。', 'offer'), t('那下次你聽聽看，我有沒有數穩！', 'admire', 'laugh'), t('樂意。等您穩了，我們再試更長的一段。', 'offer', 'laugh')]),
    s('笑出來就不藏了', [], [t('布魯克，我剛剛真的有幫上忙嗎？', 'think'), t('當然。您一來，大家就安心了。', 'reassure', 'laugh'), t('笨蛋！說這種話我也不會高興啦！', 'laugh', 'tease'), t('好的，那我就假裝沒看見您在笑。', 'tease', 'laugh')])
  ]);
  add('chopper', 'jinbe', '甚平把喬巴當醫師，喬巴對陌生身體求知而不亂下結論；體型不同不等於大人哄小孩。', [
    s('身體的事不是打擾', ['medicine-cabinet'], [t('不舒服的時候，要把哪裡不對說清楚喔。', 'work'), t('知道。老夫有時怕小事也來打擾你。', 'think'), t('身體的事才不是打擾！我是醫生啊！', 'explain', 'nod'), t('那就交給你了，醫生。', 'nod', 'laugh')]),
    s('不能只照書上猜', ['bookshelf'], [t('魚人的這一段，書上寫得好少。', 'think'), t('想問什麼？老夫知道的都可以講。', 'offer', 'admire'), t('太好了！我先記你的情況，不跟別人的混在一起。', 'work', 'nod'), t('嗯，問慢一點。老夫也得想清楚才回答。', 'talk', 'nod')]),
    s('搬得動也得看路', [], [t('下次那麼大的東西，我也能幫忙搬！', 'offer'), t('力氣老夫相信。可別把前面的路全擋住。', 'explain', 'startled'), t('啊……光想到抱得動了。', 'think', 'tease'), t('到時你先喊一聲，老夫替你看著路。', 'offer', 'laugh')])
  ]);
  add('robin', 'franky', '考古學家在意物件留下的痕跡，船匠在意如何留得住。語氣冷暖相反但平等，不捏造官方戀情。', [
    s('舊痕跡也有用', ['tool-bench'], [t('這塊木頭上的刻痕，能留著嗎？', 'offer'), t('能。補背面就夠了，正面不碰。', 'nod'), t('很好，刻字的人恐怕沒想到還有人讀它。', 'talk', 'think'), t('嘿，那就讓它再多留一段日子！', 'work', 'talk')]),
    s('書架的祕密', ['bookshelf'], [t('這一格怎麼比旁邊淺？', 'think'), t('發現啦！後面藏了個小抽屜！', 'admire'), t('很適合放不想被人找到的東西呢。', 'tease', 'think'), t('只是書籤！妳怎麼一說就像有案子！', 'protest', 'tease')]),
    s('先別催結尾', [], [t('我還沒講到故事結尾呢。', 'talk'), t('知道！可那傢伙一直留著人家做的東西啊！', 'protest'), t('嗯，最後也沒有丟掉。', 'talk', 'nod'), t('這樣才對嘛！……後面呢？妳繼續說！', 'smile', 'talk')])
  ]);
  add('robin', 'brook', '能談舊歌與記錄，也能接住荒誕的黑色幽默；相處不用每場揭開悲劇或互相療癒。', [
    s('字和旋律', ['bookshelf'], [t('這首歌的歌詞，和書裡記的不一樣。', 'think'), t('到了不同的港口，總有人換掉一兩句。', 'explain'), t('那你把記得的唱給我聽，我寫在旁邊。', 'offer', 'talk'), t('樂意。這一版，就多了一位記錄的人。', 'bow', 'nod')]),
    s('適合怪談的伴奏', ['piano'], [t('剛才那一段，很適合有人從地板爬出來。', 'tease', 'startled'), t('請不要在我腳邊說這種話！', 'startled', 'tease'), t('放心，這裡的地板是佛朗基修的。', 'reassure', 'think'), t('您安慰的重點，好像稍微偏了一點。', 'protest', 'talk')]),
    s('安靜也有聽眾', [], [t('剛才說到那首歌的來歷，怎麼不說下去了？', 'offer'), t('以為您在想事情，便想等一等。', 'talk'), t('我有在聽。請繼續吧。', 'nod', 'talk'), t('那就接著剛才的地方，不重新開場了。', 'offer', 'nod')])
  ]);
  add('robin', 'jinbe', '學者的記錄與掌舵手的親身經驗相互補足；兩人都有幽默，不把每句話寫成沉重人生格言。', [
    s('書上的港口', ['map-table'], [t('這個港口，書上說入冬就沒有人了。', 'think'), t('還有人，只是把船搬到另一面避風。', 'explain'), t('原來如此。寫書的人大概只待了一天。', 'tease', 'talk'), t('哈哈，下次多待兩天，記載就不一樣了。', 'laugh', 'nod')]),
    s('船上沒有寧靜時段', [], [t('還習慣嗎？每天都這麼熱鬧。', 'think'), t('正想問，什麼時候最安靜。', 'think', 'tease'), t('大家都在吃第一口飯的時候。', 'tease', 'laugh'), t('那老夫可得把握，想來也只是一眨眼。', 'laugh', 'talk')]),
    s('不同的名字', ['bookshelf'], [t('海底也用這個名字稱呼它嗎？', 'think'), t('老夫聽過另一個稱呼。意思比較像回家的水。', 'explain'), t('很有意思。只寫成洋流，就少了一點東西。', 'think', 'nod'), t('那把兩個都記下吧。會有人看得懂的。', 'offer', 'talk')])
  ]);
  add('franky', 'brook', '船匠替音樂家造能用的東西，音樂家替船匠的張揚配拍；也尊重老物件，不固定成大聲與小聲之爭。', [
    s('登場要等四拍', ['piano'], [t('等我手一合，你就給我最響的那一下！', 'admire'), t('好。先等四拍，一、二——', 'explain', 'admire'), t('SUPER！', 'laugh', 'startled'), t('……三、四。您又搶先了，容我重來。', 'tease', 'laugh')]),
    s('刮痕不必全磨掉', ['tool-bench'], [t('這裡能磨平，看起來跟新的一樣。', 'offer'), t('這道小痕可以留著嗎？我已經看習慣了。', 'think'), t('明白。該修的修，這道留著！', 'nod', 'talk'), t('謝謝。拿在手裡，還是熟悉的感覺。', 'bow', 'talk')]),
    s('聽出哪裡鬆了', ['piano'], [t('這一聲不對，是裡頭鬆了？', 'think'), t('您也聽到了？每次彈這個音就會響。', 'think'), t('再來一次。我聽聲音找地方。', 'work', 'nod'), t('那就麻煩您了。修好後，第一首給船匠先生。', 'offer', 'laugh')]),
    s('笑聲也能編成曲', [], [t('你笑那幾聲，怎麼每次都那麼齊？', 'think'), t('喲呵呵呵！音樂家的習慣吧。', 'laugh', 'admire'), t('哈哈哈！那我的笑也能編一段？', 'laugh', 'think'), t('能，不過您的音量恐怕得占兩個人的位置。', 'tease', 'laugh')])
  ]);
  add('franky', 'jinbe', '造船的人與操船的人能聽懂同一個細節。佛朗基驕傲，甚平給準確回饋，尊重不靠長篇致詞。', [
    s('船匠要聽實話', ['helm'], [t('怎麼樣？這個舵回得夠漂亮吧！', 'admire'), t('很順。不過轉到這裡，有一點輕響。', 'explain', 'think'), t('喔？再轉一次，讓我摸這邊。', 'work', 'nod'), t('就這裡。慢慢來，老夫替你穩著。', 'work', 'nod')]),
    s('不是一味加重', ['tool-bench'], [t('要更穩，我就再補一層！', 'offer'), t('不急。太重了，轉回來反而慢。', 'explain', 'think'), t('有道理。那從連接這裡改。', 'work', 'nod'), t('改完讓老夫試一圈，手上最清楚。', 'offer', 'admire')]),
    s('好船遇上好手', ['helm'], [t('你剛才那一下，連杯子都沒晃！', 'admire'), t('船聽得進手上的力，自然好操。', 'nod', 'laugh'), t('哈哈！你這傢伙，誇船比誇我還管用！', 'laugh', 'talk'), t('都是真話。往後還得一起顧著它。', 'nod', 'nod')]),
    s('安靜反而不習慣', [], [t('大家說這裡太吵，你也這麼想？', 'think'), t('若忽然安靜，老夫反倒要找找人都去哪了。', 'talk', 'laugh'), t('哈哈！你已經很懂這群傢伙了嘛！', 'laugh', 'think'), t('還有些要學。像是你為何總在最後再喊一聲。', 'tease', 'laugh')])
  ]);
  add('brook', 'jinbe', '兩個閱歷深的夥伴也能輕鬆開玩笑、聽歌喝茶；避免每場都用孤獨或人生大道理收尾。', [
    s('跟著浪的空拍', ['piano'], [t('剛才這一下停頓，您也聽到了？', 'think'), t('嗯，像浪退下去、下一道還沒來。', 'talk', 'admire'), t('說得真好。那我替後面多留一拍。', 'work', 'nod'), t('老夫就等著下一道了。', 'tease', 'laugh')]),
    s('茶涼的理由', ['kitchen-table'], [t('茶涼得真快。也許是我沒有體溫。', 'tease'), t('老夫這杯也涼了。大概只是聊得久。', 'talk', 'think'), t('啊，難得的骷髏笑話被事實打敗了。', 'tease', 'laugh'), t('哈哈！重新泡一壺，你再想一個。', 'offer', 'laugh')]),
    s('值夜不必一直說話', ['helm'], [t('下回休息時，想聽什麼樣的曲子呢？', 'offer'), t('安靜些的就好。不過老夫不太會跟著唱。', 'think'), t('有人聽就足夠了，拍子也不用趕。', 'reassure', 'nod'), t('那就約好了。老夫會慢慢聽的。', 'nod', 'talk')]),
    s('笑話還有後半段', [], [t('您還沒笑，是這個笑話太老了嗎？', 'think'), t('老夫剛才在想，你怎麼總能一本正經地說出來。', 'think'), t('一本正經嗎？那恐怕是我的臉改不了了。', 'tease', 'laugh'), t('哈哈，原來這句才是後半段。', 'laugh', 'bow')])
  ]);

  Object.assign(SCENES, reserved?.scenes || {});
  for (const [key, scenes] of Object.entries(reserved?.scenes || {})) RELATIONSHIPS[key] = scenes[0].relationship;
  const ACTION_LABELS = Object.freeze({ talk: '交談', explain: '說明', nod: '點頭', laugh: '開懷', smile: '微笑', tease: '打趣', protest: '抗議', reassure: '安慰', admire: '驚喜', think: '思考', bow: '致意', listen: '聆聽', startled: '吃驚', offer: '招呼', work: '專心', rest: '休息' });
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
    // Presence of an explicit availability list opts into strict physical context.
    // The legacy API without this list keeps its complete authored scene pool.
    const available = Array.isArray(context?.availableFurnitureKeys) ? new Set(context.availableFurnitureKeys) : null;
    const eligible = available ? all.filter(value => !value.tags.length || value.tags.some(tag => available.has(tag))) : all;
    if (!eligible.length) return null;
    const tagged = context && context.furnitureKey ? eligible.filter(value => value.tags.includes(context.furnitureKey)) : [];
    const excluded = new Set(Array.isArray(context?.recentSceneIds) ? context.recentSceneIds : []);
    const preferred = tagged.length ? tagged : eligible;
    const fresh = preferred.filter(value => !excluded.has(value.id));
    // If contextual choices were all recently used, broaden before repeating one.
    const broadFresh = eligible.filter(value => !excluded.has(value.id));
    const selected = at(fresh.length ? fresh : broadFresh.length ? broadFresh : eligible, index);
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
