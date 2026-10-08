'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../../..'),source='C:/Users/王曜瑋/Documents/Codex/2026-04-20-1-2-start-html-game-html/handoffs/launcher-life-dialogue-expansion-20261008/proposal.json';
if(!process.argv.includes('--draft-only'))throw Error('Editorial draft only: awaiting proposal-v2 review. This script must not integrate content.');
const raw=fs.readFileSync(source),d=JSON.parse(raw),edits=[];
// Observations which have no state in this game are rewritten, never assumed.
const changes={
luffy:{arrive:'你們在這裡啊！一起玩吧！',favorite_furniture:'這張桌子不錯！吃飯的時候叫大家一起來吧！',awkward_furniture:'這些藥瓶我看不懂，還是別亂碰好了！',fish_loss:'跑掉了！我還想釣上來看看呢！',rare_fish:'喂！這條好特別！先叫大家來看！',forge_request:'佛朗基！幫我的釣竿變得更厲害吧！',work:'有什麼要幫忙的？指給我看！',train:'再來一次！我要練得更厲害！',rain:'雨好大！等雨停了再出去玩吧！',spring:'春天到了！天氣好的時候一起去外面看看吧！'},
zoro:{favorite_furniture:'刀放在架上，拿的時候也順手。',fish_loss:'跑了。再試一次。',forge_request:'佛朗基，這根竿子還能再強化吧？',train:'腳下站穩，別只顧著使力。',spring:'天氣暖了。找塊平地練練。'},
nami:{favorite_furniture:'把海圖攤開，航線就看得清楚了。',awkward_furniture:'工具這麼多，先告訴我該用哪一把。',fish_win:'釣到了！回去看看香吉士打算怎麼料理吧。',fish_loss:'先別急著再拋，檢查一下魚線。',forge_request:'佛朗基，強化交給你了。別把好好的零件浪費掉喔。',meal:'大家的份都要留好，別讓魯夫全拿走。',work:'東西按用途分好，舊的先別急著丟。',train:'肩膀放鬆，別只想著使蠻力。',morning:'早上的風怎麼樣？出門前先看一下窗外。',dusk:'趁天還亮，把外面的東西收進來。',night:'聲音小一點，別吵到準備休息的人。',rain:'要是衣服淋濕了，記得攤開晾。',snow:'鞋底的雪拍掉再進來！',spring:'橘子樹也喜歡暖一點的天氣呢。'},
usopp:{favorite_furniture:'細的活也難不倒本大爺！先把工具準備好！',awkward_furniture:'這藥櫃……我還是等船醫來再開。',fish_win:'看到了吧！這就是本大爺的釣魚技術！',forge_request:'佛朗基，這根竿子還能加點厲害的機關吧？',meal:'吃飽了，本大爺才能繼續大顯身手！',work:'先想好做法再動手！這可是本大爺的經驗！',night:'這時候看什麼都像怪影子……我只是確認一下！',snow:'這種天氣最容易留下腳印！本大爺可不會看漏！',spring:'花粉別黏到剛上的漆就好了。'},
sanji:{arrive:'喲，過來歇一會兒吧。吃飯前記得洗手。',depart:'我去看看廚房，你們先聊。',favorite_furniture:'吃飯的地方乾淨，大家才能安心坐下。',awkward_furniture:'這些工具還是交給船匠吧，我可不讓它們碰食材。',fish_win:'釣到了。先確認魚種，再想想怎麼料理。',fish_loss:'空手也得吃飯。別垂著頭回來。',rare_fish:'先確認牠習慣什麼水、能不能吃，再決定怎麼處理。',fish_handoff:'交給廚師就好，你先去洗手。',forge_request:'佛朗基，幫我把竿子強化一下。晚餐的食材就靠它了。',work:'先把這件做好。忙歸忙，也別糟蹋東西。',morning:'早飯可不能省。起來的人都好好吃一頓。',dusk:'晚飯想吃什麼？我再想個做法。',night:'餓了就說，我可不讓人空著肚子睡。',rain:'要是淋濕了，先擦乾再喝熱湯。',snow:'鞋子濕了就換，別光顧著看雪。',thunder:'離窗邊遠一點，天氣這麼差就別出去了。',spring:'春天的食材，清爽一點的做法也不錯。',summer:'天熱，食物別在外面放太久。'},
chopper:{arrive:'你來啦！有不舒服就告訴我喔！',awkward_furniture:'這本我還看不懂，我再慢慢查！',fish_win:'成功了！欸，真的釣上來了！',fish_handoff:'香吉士，處理之前先看看有沒有尖刺喔！',forge_request:'佛朗基，能幫我把釣竿做得更好握嗎？',meal:'吃飯也要吃菜！不是只有甜的就夠了！',work:'先看清楚再動手，弄混了可不行！',dusk:'光太暗就別勉強看細字了。',rain:'要是頭髮濕了，先擦乾再休息！',snow:'外面好冷！你也記得戴好帽子！',summer:'曬太久要休息！找個陰涼的地方！'},
robin:{arrive:'這裡很舒服呢，我待一會兒。',favorite_furniture:'看看這些書，也許會找到有趣的記錄呢。',forge_request:'佛朗基，能請你替我的釣竿做些調整嗎？',dusk:'光慢慢暗了，讀書的人也該歇一會兒了。',night:'夜裡適合安靜地聊一會兒呢。',rain:'書別放得太靠窗，萬一雨飄進來就可惜了。',spring:'春天的光，坐在窗邊也很舒服呢。',summer:'熱飲不必急著喝，等它涼一些吧。'},
franky:{arrive:'來啦！有什麼想做的，儘管說！',depart:'我去另一間看看，需要船匠就叫我！',favorite_furniture:'有個穩當的工作檯，細活就好做多啦！',awkward_furniture:'這些書怎麼分類？我可得先問清楚！',fish_loss:'跑了啊。先看看導環，再試一次！',forge_request:'SUPER！先把工具準備好，讓這根釣竿更帶勁！',work:'先把底座弄穩，做東西可不能馬虎！',dusk:'天暗了，手上的活先安全收好。',night:'工具都要收好，別留零件在地上。',rain:'怕潮的材料先蓋好，雨可不會等我們！',spring:'天氣暖了，正好把新點子做出來！',summer:'這天氣，真想來一瓶冰可樂！'},
brook:{arrive:'打擾了，可以在這裡待一會兒嗎？',favorite_furniture:'琴鍵乾乾淨淨的，看著就想彈一曲呢。',awkward_furniture:'開飯之前，我先等廚師安排吧。喲呵呵呵！',fish_win:'魚上鉤了！今天真是好節奏！',forge_request:'佛朗基先生，釣竿的強化就拜託您了。喲呵呵呵！',meal:'大家一起用餐，連湯都格外暖呢。',work:'樂器要好好收，不然下回可唱不痛快。',morning:'早安，要是想聽一段輕快的，儘管說。',snow:'雪落得真安靜，真想配一段慢曲呢。',thunder:'剛才的低音可真響。我還是等天氣好些再演奏。'},
jinbe:{favorite_furniture:'握舵不必只靠蠻力，感受船的回應。',awkward_furniture:'細的活容老夫慢慢學，先說說該如何做。',rare_fish:'先查清楚魚種，別隨意換水折騰牠。',forge_request:'佛朗基，釣竿的強化就有勞你了。',work:'手上的事再查一遍，穩妥些總是好的。',morning:'早上出去之前，先看看海面是否平穩。',dusk:'風涼了，外面的東西也該收了。',rain:'地板要是濕了，走路就慢些。',spring:'水暖起來，魚活動的地方也會變呢。'},
ace:{depart:'我去另一間看看。你們先聊，別等我。',favorite_furniture:'有張桌子讓大家一起坐，就熱鬧多了。',awkward_furniture:'這些細零件，先告訴我怎麼用吧。',fish_win:'這條真有精神！剛才可沒那麼容易拉！',forge_request:'佛朗基，幫我把竿子再弄強一點吧。',meal:'哈哈，吃太飽可別又睡著了！',work:'有需要搬的就叫我，我來搭把手。',morning:'早啊。今天都打算去哪裡？',rain:'濕衣服慢慢晾，別靠火太近。',snow:'手冷了就進來歇歇，別硬撐。',spring:'春天的景色，坐下來看一會兒也不錯。'},
sabo:{favorite_furniture:'地圖上的路線，出發前再核對一次吧。',fish_win:'不錯，先看看這條魚要怎麼安排。',fish_loss:'別急，我陪你檢查一下魚線。',forge_request:'佛朗基，能幫我把釣竿調整得更好用嗎？',work:'我來幫忙清點，你把需要留意的記下來。',night:'手上的事做完就歇歇，不用一個人全扛著。',rain:'門邊可以留塊乾布，回來的人也用得到。'},
law:{favorite_furniture:'分類清楚，取用的時候才不會拿錯。',fish_loss:'先檢查魚線。別一失敗就急著再拋。',forge_request:'佛朗基，這根竿子的強化交給你。',meal:'洗完手再吃。我不急。',work:'核對過的和沒核對的分開，別混在一起。',train:'姿勢不對就先停。休息過再練。',dusk:'光不夠的時候，精細的活留到明天。',snow:'手指要是凍僵了就停，別硬做精細的活。',winter:'手暖起來再做精細的活。別逞強。'}
};
const poseFor=(scene,key,n=0)=>scene==='fish_loss'?'talk_annoyed':scene==='rare_fish'?'surprised':['arrive','depart'].includes(scene)?n?'talk_happy':'wave':scene==='forge_request'?'focused_use':scene==='awkward_furniture'?'surprised':key==='law'||key==='zoro'||key==='jinbe'?'listen':n%3===1?'surprised':'talk_happy';
const moodFor=pose=>pose==='talk_annoyed'?'annoyed':pose==='surprised'?'surprised':['talk_happy','wave'].includes(pose)?'happy':'focused';
const solo=d.solo_lines.map(x=>{const text=changes[x.actor]?.[x.scene]||x.text;if(text!==x.text)edits.push({id:x.id,before:x.text,after:text,reason:'Remove unsupported prop, injury, damage, outcome or target assumptions'});const pose=poseFor(x.scene,x.actor);return {id:x.id,actor:x.actor,scene:x.scene,text,pose,mood:moodFor(pose),...(x.furniture_key?{furniture:x.furniture_key}:{}),cooldownMs:x.repeat.cooldown_seconds*1000,classification:'game_original'};});
const pairs=d.interactions.map((x,i)=>({id:x.id,pair:x.actors,scene:x.scene,cooldownMs:x.repeat.cooldown_seconds*1000,classification:'game_original',turns:x.turns.map((t,n)=>{const pose=poseFor(x.scene,t.speaker,n);return {speaker:t.speaker,line:t.text,pose,mood:moodFor(pose),durationMs:t.duration_ms,gapAfterMs:t.gap_after_ms,listener:{key:t.listener,pose:n%3===1?'surprised':'listen'}};})}));
const pairEdits={
0:['你在這裡啊！要不要去外面？','先歇一下吧。','好！那我們一起待一會兒！'],
1:['我去那邊看看！','先看看天氣，外套也記得拿。','喔！那我準備好再走！'],
2:['這條好特別！','先別晃！我得把牠的樣子記下來！','好！那你快看！'],
4:['我還想再練！','練習也得休息，別勉強自己！','好吧。那陪我坐一下！'],
5:['這些故事真有趣！','以前的人留下來的記錄，有時比故事更有意思呢。','那也說給我聽吧！'],
6:['佛朗基！幫我的釣竿變得更厲害吧！','交給我！先看看怎麼強化最合適！','弄好我就去釣大的！'],
9:['艾斯，吃飯可別又睡著啦！','你也是。大家的份可別全拿走喔。','知道啦！一起吃吧！'],
10:['有什麼要搬的？交給我吧！','先看清楚裡面裝什麼，重的我們一起搬。','好！那你拿另一邊！'],
13:['練完再休息就行。','還是要留意有沒有受傷！','……知道了。'],
14:['我去另一間看看。','先看清楚方向，別又走錯。','知道了。'],
16:['海圖上的地名，有時候會換名字呢。','舊名字也可能記著更早的港口。','那我會把兩個都留著。'],
18:['家具用得不順的時候，你能修吧？','那當然！先找出是哪裡不順，不用急著全換！','能修就好。那就拜託你啦。'],
19:['強化的時候，能用的零件別全換掉。','放心！先看怎麼做最合適！','好，換下的也留給我看看。'],
22:['晚上看什麼都像怪影子……','喲呵呵呵！要我陪您待一會兒嗎？','我沒被嚇到！只是確認！'],
23:['處理魚之前，先看看有沒有尖刺。','沒錯！不認得的魚也得先查清楚！','謝了，醫生。先洗手等飯吧。'],
25:['這條魚要怎麼料理，得先看牠的習性。','在急流裡生活的魚，肉質也常有不同。','那我先查清楚，再決定做法。'],
26:['有時兩本書說的不一樣，要怎麼辦？','先看它們記的是不是同一種植物呢。','對！名字很像，也要看清楚葉子！'],
27:['藥品標籤看不清楚的時候，不能隨便猜吧？','先核對原記錄，再重寫。','嗯！我會仔細核對！'],
28:['這些書能陪我們很久，書架也要好好保養呢。','交給我！保管重要的東西，也是船匠的工作！','謝謝。這樣讀起來也安心。'],
29:['琴架也得站得穩，演奏起來才痛快！','喲呵呵呵！那還要請您多照看呢。','包在我身上！有哪裡不順就說！'],
31:['魯夫一看到飯就想全拿走。','你吃起來也沒客氣多少啊。','哈哈，那吃完一起收吧。'],
33:['查到的資料，還是得把來源記清楚。','不確定的，先放在待核對的那一邊呢。','好，不把猜測混進去。'],
34:['佛朗基，釣竿的強化交給你。','沒問題！先看看受力和零件，再動手！','那就拜託了。'],
35:['處理魚之前，種類確認了再動手。','那當然。我可不拿大家的晚餐冒險。','好。需要人手的時候再叫我。']};
for(const [i,lines]of Object.entries(pairEdits))pairs[i].turns.forEach((t,n)=>{if(t.line!==lines[n])edits.push({id:pairs[i].id,turn:n,before:t.line,after:lines[n],reason:'Remove unsupported scene facts while preserving relationship'});t.line=lines[n];});
const furnitureByPair={5:'bookshelf',10:'treasure-chest',18:'tool-bench',21:'tool-bench',26:'bookshelf',27:'medicine-cabinet',28:'bookshelf',29:'piano',33:'bookshelf'};
for(const [i,furniture]of Object.entries(furnitureByPair))pairs[i].furniture=furniture;
const content={version:47,classification:'game_original',verifiedOriginalQuotes:0,solo,pairs};
fs.mkdirSync(__dirname,{recursive:true});fs.writeFileSync(path.join(__dirname,'draft-content.json'),JSON.stringify(content,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'review.json'),JSON.stringify({source,sourceSha256:crypto.createHash('sha256').update(raw).digest('hex'),counts:{solo:solo.length,pairs:pairs.length,turns:pairs.reduce((n,x)=>n+x.turns.length,0)},edits,stagedNewActions:d.new_actions.map(x=>({id:x.id,status:'not_generated_not_loaded'})),limits:['All text is original game adaptation; zero verified original quotations','No handoff, rod inspection or injury animation is claimed; existing full-body acting loops only','Eligibility must be proven by room/event adapter']},null,2)+'\n');
console.log(JSON.stringify({status:'DRAFT_NOT_APPROVED',solo:solo.length,pairs:pairs.length,editorialCorrections:edits.length,stagedActions:d.new_actions.length}));
