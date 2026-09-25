/* Original room dialogue for the ten canon Straw Hat crew members. */
(function (root) {
  'use strict';

  const KEYS = Object.freeze(['luffy', 'zoro', 'nami', 'usopp', 'sanji', 'chopper', 'robin', 'franky', 'brook', 'jinbe']);
  const MOODS = Object.freeze(['happy', 'surprised', 'focused', 'annoyed']);
  const PROFILES = {
    luffy: { name: '魯夫', role: '船長', detail: '想探索新地方，也總會先想到同伴有沒有吃飽。', favorite: ['kitchen-table', 'helm'], closeTo: ['zoro', 'nami', 'sanji', 'chopper', 'jinbe'] },
    zoro: { name: '索隆', role: '劍士', detail: '把練刀當成每天的功課；找路時最好有人同行。', favorite: ['swords-rack'], closeTo: ['luffy', 'sanji', 'chopper'] },
    nami: { name: '娜美', role: '航海士', detail: '熟悉海圖、天氣與帳本，也很在意船上的橘子樹。', favorite: ['map-table', 'tangerine-tree'], closeTo: ['luffy', 'usopp', 'robin', 'sanji'] },
    usopp: { name: '騙人布', role: '狙擊手', detail: '點子多，擅長修補和發明；緊張時仍努力鼓起勇氣。', favorite: ['tool-bench', 'treasure-chest'], closeTo: ['luffy', 'chopper', 'franky'] },
    sanji: { name: '香吉士', role: '廚師', detail: '用餐點照顧每位夥伴，對食材和火候十分講究。', favorite: ['kitchen-table', 'tangerine-tree'], closeTo: ['nami', 'robin', 'luffy', 'zoro'] },
    chopper: { name: '喬巴', role: '船醫', detail: '認真準備藥品，也會因同伴一句稱讚而害羞。', favorite: ['medicine-cabinet', 'bookshelf'], closeTo: ['robin', 'usopp', 'zoro', 'luffy'] },
    robin: { name: '羅賓', role: '考古學家', detail: '喜歡安靜讀書、觀察線索，總能溫柔地照顧夥伴。', favorite: ['bookshelf', 'map-table'], closeTo: ['chopper', 'nami', 'sanji'] },
    franky: { name: '佛朗基', role: '船匠', detail: '熱愛設計與修理，船上有新機關時總想先試一遍。', favorite: ['tool-bench', 'helm'], closeTo: ['usopp', 'brook', 'robin'] },
    brook: { name: '布魯克', role: '音樂家', detail: '用演奏替漫長航程添上節奏，說話帶著輕快的幽默。', favorite: ['piano', 'bookshelf'], closeTo: ['luffy', 'franky', 'jinbe'] },
    jinbe: { name: '甚平', role: '掌舵手', detail: '沉著判讀海流和風浪，樂於讓同伴安心前進。', favorite: ['helm', 'map-table'], closeTo: ['luffy', 'nami', 'brook'] }
  };

  // The entries are short, newly written lines rather than quotations from the work.
  // Every context has several options so repeated visits do not immediately repeat a line.
  const SOLO = {
    luffy: {
      chat: ['那邊看起來很好玩，我們一起去看看！', '大家都在啊，那今天一定很熱鬧。', '下一座島會有什麼？我已經等不及了！', '先找個地方吃飯，然後再出發！', '剛剛那陣風真舒服，想去甲板看看。', '你也想冒險？那就跟上來吧！'],
      reply: ['好啊，等我把這口吃完！', '我相信你，一起去吧！', '別想太多，先試試看！', '哈哈，這樣才有意思！'],
      work: ['我去看看前面有沒有新發現！', '有人需要幫忙？交給我！', '先把大家叫齊，一起動手比較快。', '我去把東西搬過來！'],
      bond: ['跟你待在一起，感覺今天會很有趣！', '下次有好玩的事，也記得叫我。', '有你在，這趟旅程一定更熱鬧。', '謝啦！我們再一起出去走走。'],
      rest: ['吃飽了就有力氣繼續玩！', '我先在這裡坐一下，等大家回來。', '風一吹，差點睡著了。', '休息夠了，現在去哪裡？'],
      furniture: { 'kitchen-table': [['今天有什麼吃的？我可以幫忙試味道！', 'happy'], ['這盤聞起來太香了，我先坐好等。', 'happy'], ['香吉士還沒開動？那我再等一下。', 'focused']], helm: [['前面有座島嗎？我想親眼看看！', 'surprised'], ['從這裡看出去，海好大啊！', 'happy']] }
    },
    zoro: {
      chat: ['我先把今天的訓練做完。', '刀放在這裡，等等就能開始練。', '這條走道還算安靜，適合活動一下。', '你看到我剛才放的水壺了嗎？', '想練習的話，先站穩再動。', '我認得回去的路……大概。'],
      reply: ['嗯，我會過去看看。', '等我練完這一輪。', '有事就直說，我聽著。', '別急，先看清楚方向。'],
      work: ['我去整理刀架，別碰到刀刃。', '這邊由我看著，你去忙吧。', '搬重的東西？放著，我來。', '先把通道清出來，大家才好走。'],
      bond: ['你還在啊。想聊就坐一會兒。', '跟你一起練，時間過得挺快。', '有麻煩就叫我，不用客氣。', '下次走遠一點……你帶路。'],
      rest: ['練完了，我在這裡閉眼休息。', '別吵，我只睡一下。', '這個角落風不錯。', '刀擦好了，現在可以休息。'],
      furniture: { 'swords-rack': [['刀都收齊了，少一把我馬上知道。', 'focused'], ['先確認刀柄，再開始練。', 'focused'], ['別把道具擺在刀架前面。', 'annoyed']], 'map-table': [['這條線怎麼又回到原點？', 'annoyed'], ['有人能把船頭方向標清楚嗎？', 'focused']] }
    },
    nami: {
      chat: ['今天的風向有點變，我再確認一次航線。', '補給要先列清單，才不會買漏。', '橘子樹那邊曬得到太陽嗎？', '這筆花費是誰記的？我要再核對。', '雲層移得很快，晚點可能下雨。', '先算好預算，剩下的才能放心花。'],
      reply: ['可以，我先把航線畫完。', '這樣安排比較省事，也比較省錢。', '好主意，但帳本要記清楚。', '交給我，我會把天氣看好。'],
      work: ['我去更新海圖，別碰桌上的標記。', '今天的收支我來核對。', '橘子樹要澆水，幫我拿桶子來。', '我先看雲，再決定何時出發。'],
      bond: ['你記得幫忙記帳，我很放心。', '下次看海圖時可以坐在旁邊。', '今天幫了大忙，這筆我會記得。', '陪我照顧橘子樹？動作要輕一點。'],
      rest: ['等這張海圖標好，我就休息。', '難得風平浪靜，坐一會兒也不錯。', '橘子樹看起來很好，我安心了。', '帳算平了，今天可以喝杯茶。'],
      furniture: { 'map-table': [['這段海流變快了，航線得往西修。', 'focused'], ['把風向和潮汐一起標上去。', 'focused'], ['誰把我的標記移開了？', 'annoyed']], 'tangerine-tree': [['葉子長得很好，今天別澆太多水。', 'happy'], ['這顆快熟了，記得輕輕採。', 'focused']] }
    },
    usopp: {
      chat: ['我剛想出一個很厲害的機關！', '這東西看起來普通，其實大有學問。', '要是突然有怪聲，我會先去偵察！', '我在工具箱找到一顆剛好能用的零件。', '下次瞄準練習，你來幫我看結果。', '那箱子會不會自己動？我先確認一下。'],
      reply: ['當然有辦法，先給我一點時間。', '嘿嘿，這可是我擅長的！', '我有準備啦，真的！', '一起來，兩個人比較好試。'],
      work: ['這個零件我來調整。', '先別按開關！讓我退遠一點。', '我把工具分類，找起來比較快。', '試射前先清空前面的走道。'],
      bond: ['你願意聽我講完這個設計？太好了！', '下次測試新機關，也讓你第一個看。', '有你幫忙，我這次肯定不會手忙腳亂。', '剛才那一下有點嚇人……謝謝你陪我。'],
      rest: ['新機關試好了，我要喘口氣。', '先坐一下，等心跳慢一點。', '我的工具先放這裡，沒人會動吧？', '休息完再來試第二版。'],
      furniture: { 'tool-bench': [['加上這個彈簧，反應一定更快！', 'happy'], ['等一下，這顆螺絲怎麼多出來了？', 'surprised'], ['這個角度剛好，測試時站遠一點。', 'focused']], 'treasure-chest': [['裡面會不會有機關？我先從旁邊看。', 'surprised'], ['開箱前先聽聽裡面有沒有聲音。', 'focused']] }
    },
    sanji: {
      chat: ['今天的菜單要看大家的胃口。', '食材新鮮，晚餐就能多做一道。', '廚房的火候我來看，別讓鍋子空燒。', '娜美小姐的茶要再熱一點。', '羅賓小姐想吃清淡些，我記下了。', '吃飯時間快到了，先把桌子擦乾淨。'],
      reply: ['好，交給我準備。', '等一下，這道菜需要一點時間。', '先坐好，熱的馬上來。', '我知道了，份量會幫你留著。'],
      work: ['我去處理食材，待會就能開飯。', '餐具還差幾副，我補上。', '先熬湯，味道才會慢慢出來。', '這鍋讓我顧著，你去休息。'],
      bond: ['你記得大家的口味，幫我省了不少工夫。', '下次有想吃的，直接告訴我。', '一起備料也不錯，你切得很整齊。', '今天先做一道你喜歡的。'],
      rest: ['廚房整理完，我再坐下喝茶。', '這個時間剛好能讓麵團醒一下。', '大家吃得開心，我就放心了。', '等鍋子冷了，我也休息一會兒。'],
      furniture: { 'kitchen-table': [['鍋裡還差一點火候，先別偷吃。', 'focused'], ['餐點都好了，請大家趁熱吃。', 'happy'], ['這盤留給晚點回來的夥伴。', 'happy']], 'tangerine-tree': [['這顆橘子香氣正好，拿來做甜點吧。', 'focused'], ['先問娜美小姐再摘。', 'focused']] }
    },
    chopper: {
      chat: ['藥箱我重新排好了，拿取更方便！', '你有沒有哪裡不舒服？我可以看看。', '這本書寫的藥草，我想再研究一下。', '今天大家都有好好吃飯嗎？', '我找到一種新的繃帶綁法！', '如果累了要說，別一直硬撐。'],
      reply: ['真、真的嗎？我會繼續努力。', '我來看看，先別亂動。', '這個我知道！讓我找一下筆記。', '好，我把藥箱帶過去。'],
      work: ['我去清點藥品，缺的要記下來。', '繃帶我換到最容易拿的位置。', '先量一下體溫，別只說自己沒事。', '這一頁醫書我想抄進筆記。'],
      bond: ['你記得來看我，我、我才沒有很高興呢！', '下次一起讀這本書，好嗎？', '我幫你準備了常用的藥品。', '跟你聊完，我又有信心了！'],
      rest: ['大家都沒受傷，我終於能歇一下。', '我在這裡看書，不會睡著的……', '熱茶真舒服，手也暖起來了。', '藥箱收好後，安心多了。'],
      furniture: { 'medicine-cabinet': [['繃帶補齊了，藥水也按用途排好！', 'happy'], ['這瓶快用完了，得補一點。', 'focused'], ['藥名要朝外，不然會拿錯。', 'focused']], bookshelf: [['這段配方我先抄下來。', 'focused'], ['羅賓說的那頁找到了！', 'happy']] }
    },
    robin: {
      chat: ['這本書裡的地圖，有幾處很有意思。', '船上的談話，也像一段段小故事。', '今天的光線很適合在這裡讀書。', '這座島的記載，和我們看過的圖案相近。', '喬巴借的書，我先放回原位。', '有空的話，我想再看看航海日誌。'],
      reply: ['呵呵，我也好奇後來如何。', '我們可以一起慢慢看。', '這個線索值得記下來。', '別急，書頁裡或許有答案。'],
      work: ['我去整理書架，方便大家查找。', '這段文字我再核對一遍。', '海圖旁的舊記號，我想描下來。', '借來的書要按順序放回去。'],
      bond: ['你也喜歡這個故事？下次一起讀。', '和你談線索，總能想到新的角度。', '喬巴推薦的那本書，我也想借你看。', '你願意陪我讀完這一章嗎？'],
      rest: ['我在這裡坐一會兒，順便翻幾頁書。', '海聲配上安靜的午後，很適合閱讀。', '書籤放好了，晚點再接著看。', '熱茶和一本書，今天就很好。'],
      furniture: { bookshelf: [['這段古老的記載，似乎和島上的遺跡有關。', 'focused'], ['先把書按年代排好，比較容易查。', 'focused'], ['這個故事的結尾，我還想再看一次。', 'happy']], 'map-table': [['這座島的輪廓，像書上畫過的圖案。', 'focused'], ['把這個地名記下來，之後查證。', 'focused']] }
    },
    franky: {
      chat: ['這個接頭換掉，機關運作會更順。', '陽光號的聲音一變，我就知道哪裡要檢查。', '我畫了新設計，先給你看草圖。', '工具台整理好了，今天可以大修一場！', '這塊板材還能派上用場，別丟。', '要不要看看我剛改好的轉軸？'],
      reply: ['包在我身上，等一下就好。', '這構想不錯，讓我加強一下。', '好，先量尺寸再動手。', '交給我，會修得更牢靠。'],
      work: ['我去鎖緊船上的零件。', '這個輪軸需要上油。', '讓工具回到原位，下一次才找得到。', '修好後要再試轉三圈。'],
      bond: ['你的點子很有料，下次一起改圖。', '來，我教你怎麼看這個轉軸。', '有你幫忙，工程做得更順。', '完成了！一起看看成果。'],
      rest: ['工具擦完了，坐下欣賞一下成果。', '零件都固定住，我能放心歇會兒。', '下個設計等喝完這杯再畫。', '今天船上的狀態真好。'],
      furniture: { 'tool-bench': [['螺絲再鎖半圈，這下穩了！', 'happy'], ['量過尺寸了，新零件剛剛好。', 'focused'], ['這機關動起來的聲音真棒！', 'happy']], helm: [['舵柄有點鬆，我來調緊。', 'focused'], ['轉向很順，甚平用起來會舒服。', 'happy']] }
    },
    brook: {
      chat: ['今天想聽輕快一點的旋律嗎？', '海浪正好替我的曲子打拍子。', '這段和弦很適合晚餐後演奏。', '我想為大家練一首新曲子。', '剛剛的風聲，讓我想起一段旋律。', '要是你願意，我可以先彈前奏。'],
      reply: ['當然，請坐下聽。', '這個節奏我很喜歡。', '我再試一次，讓音符更輕快。', '好，我為你換一段旋律。'],
      work: ['我去調音，等一下就能演奏。', '這首曲子的節拍先練穩。', '把樂譜收好，海風可別吹走了。', '晚餐後的音樂由我準備。'],
      bond: ['你聽得真仔細，我想再彈一段。', '這首曲子有你在場，感覺更完整。', '下次想聽什麼風格？告訴我吧。', '謝謝你陪我練到最後。'],
      rest: ['練完琴，讓手指也休息一會兒。', '我先聽聽海的節奏。', '音符停了，餘韻還在呢。', '歇一會兒，再為大家演奏。'],
      furniture: { piano: [['第一個音準了，這段可以開始。', 'happy'], ['這個節奏讓大家跟著拍手吧。', 'happy'], ['我把結尾再練輕一些。', 'focused']], bookshelf: [['這頁樂譜寫得真細，我要試試看。', 'focused'], ['找到想彈的段落了！', 'happy']] }
    },
    jinbe: {
      chat: ['潮流正在變，掌舵時得留心。', '大家休息夠了，再出航也不遲。', '這片海看似平靜，底下的流向仍要查。', '先穩住方向，遠處的浪就不難過。', '船上各司其職，航程自然順暢。', '今天天氣很好，適合調整航線。'],
      reply: ['好，我會留意風浪。', '先穩住船，再談下一步。', '說得有理，我們一起確認。', '嗯，按這個節奏前進。'],
      work: ['我去掌舵，請大家站穩。', '海流變化我再測一次。', '先確認舵位，再調整航向。', '這段航道由我來看。'],
      bond: ['與你同航，我心裡踏實。', '有疑慮就說，我們一起商量。', '你觀察得很仔細，幫了大忙。', '風浪來時，彼此照應便好。'],
      rest: ['船行得穩，我可以坐下喝口茶。', '這個時候聽浪聲，最能察覺變化。', '先讓大家歇息，晚些再調航線。', '一段平穩的航程，也值得珍惜。'],
      furniture: { helm: [['這股海流從船尾推來，舵要放穩。', 'focused'], ['現在順流，大家可以安心。', 'happy'], ['轉向之前，先讓船身過完這道浪。', 'focused']], 'map-table': [['這條航道水深足夠，可以通過。', 'focused'], ['把潮汐時刻加在圖上。', 'focused']] }
    }
  };

  // Dialogues are indexed by two known characters. A reversed visit swaps speakers.
  // Each sentence stands on its own, so that both speaker orders remain natural.
  const PAIR_LINES = {};
  const defaultMood = { luffy: 'happy', zoro: 'focused', nami: 'focused', usopp: 'surprised', sanji: 'happy', chopper: 'happy', robin: 'focused', franky: 'happy', brook: 'happy', jinbe: 'focused' };
  const utterance = (value, fallback) => Array.isArray(value) ? [value[0], value[1]] : [value, fallback];
  const addPair = (a, b, scenes) => { PAIR_LINES[`${a}:${b}`] = scenes.map(([first, second]) => [utterance(first, defaultMood[a]), utterance(second, defaultMood[b])]); };

  addPair('luffy', 'zoro', [
    ['索隆，你又在這裡練刀啊？', '這裡夠寬，正好讓我練一輪。'],
    ['我去叫大家吃飯，你也要來！', '練完就去，幫我留一份。'],
    ['下一座島一定很好玩！', '先讓娜美確認靠岸的地方。']
  ]);
  addPair('luffy', 'nami', [
    ['娜美，前面那座島看到了嗎？', '看到了，先等我確認海流。'],
    ['我們可以現在出發嗎？', '補給算完就走，別又把食物吃光。'],
    ['那朵雲好像要追過來！', '那是風向在變，先回船上。']
  ]);
  addPair('luffy', 'usopp', [
    ['騙人布，你的新機關做好了？', '快好了！先讓我把零件鎖緊。'],
    ['一起去甲板看看吧！', '好，我剛好想測試射程。']
  ]);
  addPair('luffy', 'sanji', [
    ['廚房的味道太香了，我可以先吃嗎？', '再等一點，大家的份還在鍋裡。'],
    ['今天要做幾盤？我肚子餓了！', '先把桌子排好，我就端上來。'],
    ['這份是不是我的？', '名字都還沒寫，別急著拿。']
  ]);
  addPair('luffy', 'chopper', [
    ['喬巴，忙完就一起去甲板吧！', '等我把藥箱扣好就去。'],
    ['你讀的書有新發現嗎？', '有！但要讓我從頭講。']
  ]);
  addPair('luffy', 'robin', [
    ['羅賓，那本書在說哪座島？', '一座很久以前的島，或許還能找到線索。'],
    ['你找到有趣的故事了嗎？', '呵呵，這一章很適合講給你聽。']
  ]);
  addPair('luffy', 'franky', [
    ['佛朗基，這個開關是做什麼的？', '先別按，我還在調整轉軸！'],
    ['船今天跑得真順！', '剛保養完，聲音都不一樣了。']
  ]);
  addPair('luffy', 'brook', [
    ['布魯克，晚餐時彈首熱鬧的吧！', '沒問題，我已經想好節奏了。'],
    ['這曲子聽起來像在跑步！', '呵呵，那我把速度再加一些。']
  ]);
  addPair('luffy', 'jinbe', [
    ['甚平，這片海能快一點通過嗎？', '順著流走更穩，等下就到了。'],
    ['你的舵握得真穩！', '大家都放心，我才能專心掌舵。'],
    ['下一站有什麼好看的？', '先聽娜美的航線，再一起去看。']
  ]);
  addPair('zoro', 'nami', [
    ['我只是走到另一邊看看。', '索隆，餐廳就在你身後。'],
    ['這張圖的箭頭有點多。', '因為你上次連唯一的箭頭都看反了。'],
    ['去甲板的路不是這邊？', '先站住，我帶你走一次。']
  ]);
  addPair('zoro', 'usopp', [
    ['測試機關前先把位置畫清楚。', '放心，我這次真的有標記！'],
    ['別把工具放在練刀的地方。', '好啦，我馬上搬到工作台。']
  ]);
  addPair('zoro', 'sanji', [
    [['廚房那邊也有練刀的空間。', 'annoyed'], ['別拿刀在我切菜的地方揮。', 'annoyed']],
    [['那盤先給練完的人。', 'annoyed'], ['先洗手，再說你練了多少。', 'annoyed']],
    [['別把盤子放在我刀上。', 'annoyed'], ['別把刀放在餐桌上。', 'annoyed']]
  ]);
  addPair('zoro', 'chopper', [
    ['練習時擦破一點，不用緊張。', '一點也要處理！先坐下。'],
    ['你那藥箱帶著太重了吧。', '常用的都要帶，才不會來不及。']
  ]);
  addPair('zoro', 'robin', [
    ['這裡夠安靜，我練完就走。', '沒關係，翻書聲也不會打擾你。'],
    ['你書上的那幅圖像不像海圖？', '像，但它標的是更久以前的道路。']
  ]);
  addPair('zoro', 'franky', [
    ['刀架再固定一點，拿刀時會晃。', '我去加兩顆螺絲，馬上穩。'],
    ['這塊木板擋到練習的位置。', '等我量完尺寸就搬開。']
  ]);
  addPair('zoro', 'brook', [
    ['你彈慢一點，我在算招式。', '那我給你一段穩穩的節拍。'],
    ['這曲子節奏挺好。', '練習時能用得上，我很高興。']
  ]);
  addPair('zoro', 'jinbe', [
    ['剛才船身一晃，方向要變？', '浪從側面來，先把舵穩住。'],
    ['船尾有空地，我去練刀。', '可以，等這段浪過了再動。']
  ]);
  addPair('nami', 'usopp', [
    ['買零件前先給我看清單。', '我把每顆螺絲都寫上去了！'],
    ['這個機關會不會又吃掉預算？', '只要再一個小零件，真的。']
  ]);
  addPair('nami', 'sanji', [
    ['香吉士，橘子先留幾顆給大家。', '當然，我只用熟透的做甜點。'],
    ['這杯茶剛好，謝啦。', '需要再熱一點隨時告訴我。'],
    ['晚餐食材夠嗎？我記在帳上。', '夠了，娜美小姐，我會控制份量。']
  ]);
  addPair('nami', 'chopper', [
    ['藥品清單交給我，靠岸時一起買。', '好！我把最需要的圈起來。'],
    ['今天的天氣會冷一點。', '那我提醒大家帶件外套。']
  ]);
  addPair('nami', 'robin', [
    ['羅賓，這座島的舊航線你看過嗎？', '有一段記載，或許能和你的海圖對上。'],
    ['橘子樹那邊的光線很好。', '等你澆完水，我想在旁邊讀書。'],
    ['這筆舊地名我查不到。', '我來翻翻文獻，或許有別的寫法。']
  ]);
  addPair('nami', 'franky', [
    ['舵旁邊那塊板能再加固嗎？', '我已經量好了，今天就處理。'],
    ['零件費用先說清楚。', '我把尺寸和數量都寫在紙上了。']
  ]);
  addPair('nami', 'brook', [
    ['等我算完帳，再聽你練琴。', '那我先彈一段輕的，不打擾你。'],
    ['晚上的演奏別太大聲。', '明白，我會讓音量配合海風。']
  ]);
  addPair('nami', 'jinbe', [
    ['這段海流比圖上寫的快。', '我也感覺到了，舵會略往左調。'],
    ['先繞過那片淺灘。', '好，我沿著你標的深水線走。'],
    ['夜裡潮位會上升。', '我會在換潮前把船停穩。']
  ]);
  addPair('usopp', 'sanji', [
    ['我的新工具能幫你攪拌！', '先在空碗試，別直接碰晚餐。'],
    ['這道菜看起來很難做。', '不難，火候記住就行。']
  ]);
  addPair('usopp', 'chopper', [
    ['你看，新機關可以把藥箱推過來！', '真的嗎？那要先確認不會翻倒！'],
    ['剛才的聲音只是工具掉了。', '我、我知道！只是想檢查一下。'],
    ['這顆零件小得像藥丸。', '別放進我的藥盒裡啦！']
  ]);
  addPair('usopp', 'robin', [
    ['這個符號像不像機關的記號？', '有點像，但年代可能更早。'],
    ['你先說那本書裡寫了什麼。', '呵呵，聽完後再決定要不要打開箱子。']
  ]);
  addPair('usopp', 'franky', [
    ['我畫了新機關，這裡能加彈簧嗎？', '可以，先把支架再做厚一點。'],
    ['這個按鈕終於不會卡住了！', '軸承換過了，現在試試第二次。'],
    ['零件全都排好了，我們開工吧！', '先量好尺寸，等等一次裝到位。']
  ]);
  addPair('usopp', 'brook', [
    ['你的琴聲可以當測試信號。', '好啊，第一個音響起就開始。'],
    ['等我數到三，你就演奏！', '請放心，我會跟上你的節奏。']
  ]);
  addPair('usopp', 'jinbe', [
    ['海上起霧時，我能做個提示燈。', '很實用，但光別照到掌舵的人。'],
    ['那道浪比我想的高！', '站穩，這波過去就平順了。']
  ]);
  addPair('sanji', 'chopper', [
    ['喬巴，熱湯先幫你留一碗。', '謝謝！我待會整理完藥箱就來。'],
    ['這份營養夠嗎？你幫我看看。', '夠了，再加點蔬菜會更好。']
  ]);
  addPair('sanji', 'robin', [
    ['羅賓小姐，茶和點心放在這裡。', '謝謝，正好讀到想休息的地方。'],
    ['晚餐想吃清淡一點嗎？', '可以，今天的湯聞起來很好。']
  ]);
  addPair('sanji', 'franky', [
    ['廚房的門鉸鏈又有點響。', '我吃完飯就帶工具過去看。'],
    ['工作台旁別放食材。', '放心，我會把零件收乾淨。']
  ]);
  addPair('sanji', 'brook', [
    ['晚餐後你彈首輕快的吧。', '很樂意，讓大家吃得更愉快。'],
    ['你的演奏讓飯桌熱鬧不少。', '你的料理也給我新的節奏。']
  ]);
  addPair('sanji', 'jinbe', [
    ['掌舵辛苦了，熱茶先放旁邊。', '多謝，這段海流過去我就喝。'],
    ['晚餐時間需要先替你留份嗎？', '是，等船身穩了我就過來。']
  ]);
  addPair('chopper', 'robin', [
    ['羅賓，這頁的藥草名字我看不懂。', '我陪你查後面的索引。'],
    ['我把你借的書讀完了！', '很快呢，要不要再看另一本？'],
    ['這個筆記可以畫圖嗎？', '當然，畫出葉子的形狀更好認。']
  ]);
  addPair('chopper', 'franky', [
    ['藥箱的扣子鬆了，能幫我修嗎？', '沒問題，我加個更牢的鉸鏈。'],
    ['這個裝置會不會夾到手？', '我會加護蓋，讓大家放心用。']
  ]);
  addPair('chopper', 'brook', [
    ['這首曲子聽了好放鬆。', '那我把後面也彈得柔和一些。'],
    ['我可以跟著打拍子嗎？', '請來！有你的拍子會更熱鬧。']
  ]);
  addPair('chopper', 'jinbe', [
    ['風浪大時，藥箱要固定在哪？', '靠內側的櫃子較穩，我陪你搬。'],
    ['你的手臂有沒有不舒服？', '多謝關心，掌舵時我會留意。']
  ]);
  addPair('robin', 'franky', [
    ['這道機關的圖樣，和書裡畫的很相似。', '有意思，我來比較一下結構。'],
    ['書架的支架很牢固，謝謝你。', '你那些書很重，當然要做穩。']
  ]);
  addPair('robin', 'brook', [
    ['這本書提到一首很古老的曲子。', '有譜嗎？我想試著彈出來。'],
    ['你的旋律讓這一頁更有畫面。', '你的故事讓我知道該怎麼演奏。']
  ]);
  addPair('robin', 'jinbe', [
    ['舊書裡說這裡曾有另一道水路。', '海底的流向或許還留著痕跡。'],
    ['夜航時能看到那座島嗎？', '天氣清朗的話，遠遠就能辨認。']
  ]);
  addPair('franky', 'brook', [
    ['琴架再加個扣環，海浪來了也不怕。', '太好了，演奏時我就不用扶著。'],
    ['新音箱的聲音怎麼樣？', '低音很穩，我想再試一首。']
  ]);
  addPair('franky', 'jinbe', [
    ['舵柄的軸承我剛換過。', '轉起來輕多了，手感很好。'],
    ['海流一急，這片板會不會震？', '我試過了，仍要在大浪後再檢查。']
  ]);
  addPair('brook', 'jinbe', [
    ['海浪這段節拍很穩，我想配上琴聲。', '我掌舵時也會跟著輕輕打拍。'],
    ['這首曲子適合夜航嗎？', '很適合，聲音溫和，讓大家安心。']
  ]);

  const CHARACTER_LINES = Object.fromEntries(KEYS.map(key => [key, {
    chat: SOLO[key].chat,
    reply: SOLO[key].reply,
    furniture: Object.fromEntries(Object.entries(SOLO[key].furniture).map(([name, lines]) => [name, lines[0]]))
  }]));
  const CHAT_MOODS = Object.fromEntries(KEYS.map(key => [key, [defaultMood[key], key === 'zoro' || key === 'nami' ? 'annoyed' : 'happy']]));
  const FURNITURE_VERBS = Object.freeze({ helm: '掌舵', 'map-table': '看海圖', 'treasure-chest': '查看寶箱', 'tangerine-tree': '照顧橘子樹', 'swords-rack': '整理刀架', 'kitchen-table': '準備餐點', bookshelf: '閱讀', 'medicine-cabinet': '整理藥箱', piano: '彈琴', 'tool-bench': '修理裝備' });
  const hasKey = key => Object.prototype.hasOwnProperty.call(PROFILES, key);
  const at = (values, index) => values[((Math.trunc(Number(index)) || 0) % values.length + values.length) % values.length];
  const profile = key => hasKey(key) ? PROFILES[key] : null;
  const hasPair = (firstKey, secondKey) => hasKey(firstKey) && hasKey(secondKey) && firstKey !== secondKey &&
    (Object.prototype.hasOwnProperty.call(PAIR_LINES, `${firstKey}:${secondKey}`) || Object.prototype.hasOwnProperty.call(PAIR_LINES, `${secondKey}:${firstKey}`));
  const pair = (firstKey, secondKey, index = 0) => {
    if (!hasKey(firstKey) || !hasKey(secondKey) || firstKey === secondKey) return null;
    const direct = PAIR_LINES[`${firstKey}:${secondKey}`];
    if (direct) return at(direct, index);
    const reverse = PAIR_LINES[`${secondKey}:${firstKey}`];
    const chosen = reverse && at(reverse, index);
    return chosen ? [chosen[1], chosen[0]] : null;
  };
  const greeting = (key, index = 0) => hasKey(key) ? [at(SOLO[key].chat, index), at(CHAT_MOODS[key], index)] : null;
  const interaction = (key, kind = 'chat', index = 0) => {
    if (!hasKey(key)) return null;
    const resolved = ['chat', 'work', 'bond', 'rest'].includes(kind) ? kind : 'chat';
    return [at(SOLO[key][resolved], index), at(CHAT_MOODS[key], index)];
  };
  const activity = (key, furnitureKey, index = 0) => {
    const lines = hasKey(key) && SOLO[key].furniture[furnitureKey];
    if (!lines) return null;
    const [line, mood] = at(lines, index);
    return { line, mood, verb: FURNITURE_VERBS[furnitureKey] || '使用家具' };
  };
  const api = Object.freeze({ KEYS, MOODS, PROFILES, CHARACTER_LINES, CHAT_MOODS, PAIR_LINES, profile, hasPair, pair, greeting, interaction, activity });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.OnePieceRoomDialogue = api;
})(typeof window !== 'undefined' ? window : globalThis);
