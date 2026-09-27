# 角色生活系統：獨立美術與內容最終核對

日期：2026-09-27。結論：**此審稿範圍 PASS，有下列非阻擋限制；原先抓到的 blocking 已修並回看。**

## 範圍與證據

- 候選來源：`C:\Codex_Candidates\launcher-character-life-1.2.0`；正式 D 槽與部署由 root 處理，本報告不宣稱已部署。
- 實際看過十人128clips／512完整動作格，與已接受 acting_v3 idle、motion_v3 neutral並排。長圖另分頁成1480px以下，維持128px cell檢查。初稿、修後contact與逐檔SHA均保留。
- 看過root實際renderer的32個家具四向接點畫面；喬巴r2以最新四張targeted圖覆蓋舊總覽該格。這是隔離fixture截圖目視，不是本人操作完整實機遊戲。
- 閱讀183事件、四條chain各optional/else以及十人玩家talk/repeated/call/gift/train/welcome。數字測試不代替人設與美術判斷。

## 發現、處置與回看

### ART-LUFFY — resolved

- 原問題：Initial work/utility introduced a yellow waist sash and overlarge head (upper-third silhouette55–60px versus approved42px).
- 修正／回看：Four-direction work plus four south utility sequences redrawn as complete figures from approved old identity only; sash removed; finaltrain whole-figure×1.06. Work46/eat41/train41px upper-third silhouette; standing height98/98/94px. Sources and rejected predecessors preserved.
- 位置：`public/images/launcher_room/life_v1/luffy/work-*.webp`, `public/images/launcher_room/life_v1/luffy/{eat,rest,sleep,train}-south.webp`

### ART-ZORO — resolved

- 原問題：Initial work/utility head43–47px wide against approved28px, shortening the body substantially.
- 修正／回看：Two whole-body GPT sheets use approved white-shirt era, both eyes open, slim original body; finalwork30/eat29/train29px upper-third silhouette, standing95/95/94px. No body-part assembly.
- 位置：`public/images/launcher_room/life_v1/zoro/work-*.webp`, `public/images/launcher_room/life_v1/zoro/{eat,rest,sleep,train}-south.webp`

### ART-USOPP — resolved_by_other_agent_and_rechecked

- 原問題：Read itself matched approved head width39vs40px; initialwork/craft/utility were too small-headed (30/33/29px). Shrinking read alone would have worsened likeness.
- 修正／回看：Final four-frame contacts for all16clips now agree in face, goggles, nose, outfit and head/body relation. Independently visually rechecked all final cells.
- 位置：`public/images/launcher_room/life_v1/usopp/*.webp`

### ART-FRANKY — resolved_by_root_and_rechecked

- 原問題：Initial upright life artwork98–100px versus83px accepted idle made him grow on action changes.
- 修正／回看：Whole-character scale calibration by root. Finalwork/read/craft/train restored approximately83px; huge BF-37 shoulders and mechanical forearms stay intact.
- 位置：`public/images/launcher_room/life_v1/franky/*.webp`

### ART-JINBE-EAT — resolved_by_root_and_rechecked

- 原問題：Initialeat82px reduced the head/shoulders with the whole body, not merely folded legs.
- 修正／回看：Whole-clip×1.15; final four frames rechecked against98pxidle, now approximately94px and same recognisable broad stature.
- 位置：`public/images/launcher_room/life_v1/jinbe/eat-south.webp`

### CONTACT-CHOPPER-R2 — resolved_by_root_and_rechecked

- 原問題：Originalr2behind medicine cabinet hid almost the entire actor.
- 修正／回看：Targeted latest4screenshots show left-side position: hat, both eyes, front hand and feet readable; cabinet still naturally occludes right side. The older all-contact-review composite is superseded for this one case.
- 位置：`contact/chopper-medicine-cabinet-r2-f0.png`, `contact/chopper-medicine-cabinet-r2-f1.png`, `contact/chopper-medicine-cabinet-r2-f2.png`, `contact/chopper-medicine-cabinet-r2-f3.png`

### CONTENT-LEGACY-CONTEXT — resolved

- 原問題：Legacy pair scenes summoned unowned third actors, asserted present bandaging or described piano playing without a piano. Some weather/hour statements did not follow actual schedule.
- 修正／回看：39scenes/121turns corrected;151IDs,pairs,tags,ordering retained.112scenes retain every original line.8legacy bondlines adjusted for no unseen actor/held prop. Per-scene reasons and before/after saved in final-editorial-changes.json.
- 位置：`desktop/launcher-room-dialogue.js`

### POLICY-CONTROLLER — resolved_by_controller_agent_and_readback

- 原問題：Earlier controller used45–65secforeground/90secfallbackpair despite180sec/720secdata policy.
- 修正／回看：Current source reads policy.foregroundGapMs/pairCooldownMs and rare bounds; nextForegroundAt=now+foregroundGapMs and pairsMath.max(policy,event). No gameplay-duration claim from this source inspection.
- 位置：`desktop/launcher-life.js`, `desktop/launcher-life-data.js`

## 128px 量測摘錄

上段寬度是「不透明人物上方三分之一輪廓」的寬度，包含帽髮；不是自動精準分割的臉部尺寸。坐/睡高度較低是姿勢本身，不能一律拉成站高。

|角色／動作|舊站姿高／上段寬|初稿高／上段寬|修後高／上段寬|
|---|---:|---:|---:|
|luffy work|98 / 42|98 / 55|98 / 46|
|luffy eat|98 / 42|98 / 57|98 / 41|
|luffy train|98 / 42|98 / 60|95 / 42|
|zoro work|96 / 28|98 / 47|95 / 30|
|zoro eat|96 / 28|98 / 44|95 / 29|
|zoro train|96 / 28|93 / 43|94 / 29|
|usopp work|99 / 40|99 / 30|99 / 41|
|usopp read|99 / 40|98 / 39|98 / 39|
|usopp craft|99 / 40|99 / 33|99 / 41|
|franky work|83 / 70|99 / 86|83 / 72|
|franky read|83 / 70|98 / 93|81 / 77|
|franky craft|83 / 70|99 / 91|83 / 75|
|franky train|83 / 70|100 / 82|83 / 68|
|jinbe eat|98 / 56|82 / 59|97 / 67|

## 台詞實際修改

- 不是保留所有舊句：本輪改39場／121句，另8句舊SOLO bond回覆；151個id、pair、tag、回合次序都程式對照原稿驗證不變，112场逐句完全未改。完整before/after與逐場原因：`final-editorial-changes.json`。
- 具體移除未擁有第三人被叫來／拿東西、沒有鋼琴卻當場彈奏、medicine瓶罐動作被說成當場包紮、任意時段卻強制天亮／下雨等矛盾。合理的舊日回憶仍可提到原作夥伴。
- 十人玩家回覆有各自語氣：索隆短促直接、娜美安排實際細節、騙人布逞強但有手藝、香吉士照顧吃飯、喬巴以醫師身分關心、羅賓從容、佛朗基重製作與人情、布魯克禮貌幽默、甚平沉穩；魯夫直率好奇。並非全員同一口頭禪，也不把這些新寫對白宣稱成原作台詞。
- 四條chain缺optional時均有不召喚缺角的收尾。所有required必須已擁有且在場；QA列舉1024子集與optional組合。角色容量已和server/room約定對齊10。
- 原`launcher_room_dialogue_qa.js`：23799 checks PASS；新`launcher_life_content_qa.js`：384242 assertions PASS。大量子集／字串比較會放大數字，不能解讀成同數量的人工作品驗收。

## 非阻擋限制

- **SANJI-PROPORTION**：Accepted original Sanjiwork/cook silhouette remains15–18%wider in the upper third than oldidle; face/fringe side, black suit and body coherence stay canonical to the accepted outfit. Root rejected a later wrong-eye/back-button pilot rather than replace these12clips.
- **OCCLUSION**：Brookr2piano backboard hides lower body/hands; north-facing read/work props hide behind the body/hair/cape. These are depth occlusion, not detached heads or missing exported limbs. Robinr2reads beside the cabinet; Chopperr2uses latest targeted images.
- **FOUR-FRAME-AMPLITUDE**：Each loop has four authored full-body frames with visible hand/page/tool changes and small recovery. Rest/sleep mostly use low amplitude breath/blink. This is limited sprite animation, not continuous3D skeletal motion; static contacts cannot certify every live transition timing or frame pacing.
- **FREE-WORK-PROP**：Generic work loop holds a small board/tray and wiping cloth. Specialist loops are actual read/cook/craft/medicine/music/helm where matching art and stations exist. A spoken request for future work is not counted as a completed action.

## 最終來源雜湊

- `desktop/launcher-life-data.js`：`51aa5267b4cb26339ee446b411d8ea3c524979dace164f0a23ce7ca82fc1c625`
- `desktop/launcher-room-dialogue.js`：`5c4fbdf5166f810b8bdebbc21df32b8a954d7e1cc146a7f0c0507082dcc9a35f`
- `scripts/launcher_life_content_qa.js`：`6f837f64d7f726d2d7dbbcfbb76dd4318cac1db008c42c7e2eb43d82b8690758`
- `scripts/launcher_room_dialogue_qa.js`：`2e6616a7158eadad64424508b5310c5710cb80931cd8e026ebd1308f5ca41bce`
- 128素材清單本身SHA256：`01fb6d9c92e296aba0eebabab50fca8247bda579f2db6e5d23006379be8ed1e1`；每張SHA見`independent-final-assets.sha256.txt`與JSON。

## 未宣稱的項目

未宣稱公開部署、實體手機測試、人類海迷試玩、每個runtime轉場/FPS通過。對家具接點的判断限定於已看過的fixture截圖；四幀有連續手／頁／工具位置變化，但不包裝成完整3D骨架動畫。
