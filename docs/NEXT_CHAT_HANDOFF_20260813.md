# 新聊天室完整交接提示詞（2026-08-13）

以下內容可整段貼到新的 Codex 聊天室。這是目前最新交接文件；2026-07-27 與 2026-07-28 的舊交接已在 2026-08-19 專案清理時刪除，不得再把其中的舊「下一階段」當成目前進度。

新聊天室必須先完整閱讀、只讀查證並回報，未經使用者確認前不要修改檔案。

---

你正在接手 One Piece 主題 Board 大富翁專案：

`C:\Users\王曜瑋\Documents\Codex\2026-04-20-1-2-start-html-game-html`

## 一、接手後第一件事

先依序完整閱讀：

1. `AGENTS.md`
2. `docs/NEXT_CHAT_HANDOFF_20260813.md`（本文件）
3. `docs/PROJECT_OVERVIEW.md`
4. `docs/GAME_RULES.md`
5. `docs/FILE_MAP.md`
6. `docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`
7. `docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`
8. `docs/POSTGAME_BOSS_RELICS.md`
9. `docs/DEV_WORKFLOW.md` 的 V113～V206，尤其 V119～V169 與 V170～V206
10. 若任務涉及戰鬥受擊方向，再讀 `docs/BATTLE_OPPOSITE_HIT_GENERATION_PROGRESS.md`
11. 若任務涉及血統抽取外觀，再讀 `docs/FORMAL_LINEAGE_BATTLE_PARITY_PROMPT_20260728.md`，但其中舊階段狀態只作歷史參考

閱讀後先用繁體中文回報，不要立刻修改。回報必須包含：

- 目前正式完成到哪裡。
- 最新完成的覺醒路基六王銃語音／全黑靜音 V207、行動前六式時點 V205 與六王銃必殺演出 V206、正式六式水墨圖 V204、隨機六式規則 V203、血統抽取終局光束層級 V202、蛋頭島原地圖斜向五格航路 V201，以及抽取器選擇頁敵方卡層級 V200、血統抽取 KO 恢復 V199、開場被動純演出攻擊 V198、CPU 開場對話／一般戰鬥時序 V197、伽治複製兵整隊攔截／隱形黑換圖時序 V195、Tot Musica／全戰鬥傷害跳字 V191 流程。
- 主狀態權威與 iframe 顯示層的分工。
- 這次使用者接著要做的需求可能影響哪些實際入口。
- 多人同步、存檔相容、一般戰鬥不得被特殊戰鬥改壞等風險。
- 預計先做哪些只讀檢查與驗證。

等待使用者確認後才開始修改。

## 二、目前總進度

### 全破後系統

- `docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md` 的第 0～13 階段已完成，不是停在舊交接文件的第 5 階段。
- 拉夫德魯後全房解鎖全破後世界、無風帶消失、十三座 Boss 島與航線、正式醫院轉研究所、正式酒館轉競技場均已接入。
- Boss 島開啟後不鎖玩家來時的路；全破後四皇島也不鎖回頭路，方便重複挑戰。
- 研究所已包含免費醫療、永久角色實例、角色收藏／交換、完整血統因子、培育、S／SS／SSS 成長與原角色突破。
- 血統培育角色從基礎未進化狀態開始，但正式起手有四招，升級後會像原角色一樣學習新招；終局 Boss 培育角色的數據與招式威力已提高。
- 競技場對手為 Lv.99、滿修行、滿突破、最高型態；只可使用出戰時選定的兩名船員，擊敗後可進入血統抽取。
- 第 11 階段 CPU 行為、第 12 階段 109 種全圖鑑及第 13 階段完整回歸均已完成。

### 血統因子抽取

- 正式權威在 `public/js/board_game.js`；戰鬥 iframe 不得自行扣抽取器、決定正式結果或發放因子。
- 正式顯示與三階段操作由 `public/js/board_lineage_extraction.js`、`public/css/board_lineage_extraction.css` 與戰鬥頁共同呈現；`public/js/board_battle.js` 只橋接命令、事件與顯示。
- 確認使用抽取器時立即扣一個，成功或失敗都不退；放棄不扣。同一 attempt 不得重複扣除或重複發放。
- 成功只取得一份完整血統因子，不直接生成角色；必須到研究所培育。
- 一般敵人、海格、司法島、推進城、Marineford、四皇、艾爾巴夫、伊姆、競技場、十三島 Boss、洛克斯與共鬥等正式勝利出口都已接上抽取機會。
- 共鬥每名實際參戰者各用自己的抽取器並各自結算；觀看方不能操作；CPU 自動處理且不可卡住結算。

### 十三島 Boss 與攜帶物

- 十三名 Boss 的七狀態大半身圖、反方向玩家側受擊圖、專屬外框、登島情報、特殊機制、狀態列專用圖示與點擊說明均已接入。
- 具體規則以 `docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt` 與正式程式為準，不要依聊天記憶重創 Boss 類型或被動。
- 巴雷特戰鬥主卡使用一般半身戰鬥圖；超級融合只用專屬狀態圖示與六孔明細。六名船員的攜帶物對應骰點 1～6 六孔，吸收效果、破壞、空孔與歸還狀態都可由圖示查看。
- 薩卡、捷風、Tot Musica 等階段圖與特殊機制已存在；不要再用一般 CSS 方格取代已完成的圖片式 UI。
- 史基至綠牛十三件專屬攜帶物，每次勝利由每位實際參戰者各自判定固定 10%。
- 洛克斯的名刀「日蝕」基礎 10%，依個人約克解碼器提升為 20%／30%／40%；觀看方不判定。
- 覺醒黑焰羽衣為速度與最大生命各 +30%。日蝕使攻擊、特攻各 +20%，並可依正式門檻追加第三骰；總點 12 為 ×2.05，13～18 每點再增加 ×0.15。
- 14 件正式資料、效果與圖片路徑以 `docs/POSTGAME_BOSS_RELICS.md` 為準。

### 約克十三張線索與蛋頭島

- 十三張線索、圖片式重要道具背包、排牌解碼器與簡單／普通／困難三階均已正式接入。
- 失敗不消耗線索、不降階；個人解碼進度與全房蛋頭島揭露是分開狀態。
- 第一位完成者只揭露一次全房蛋頭島；其他玩家仍可自行升級個人解碼器。
- 蛋頭島使用原 5120×3976 地圖內的右側斜向五格航路；V201 已取消 5692px 擴寬，九個候選起點、既有島／路線 id 與同步 state 不變，舊快照會在重建時恢復正式尺寸。
- CPU 集滿十三種線索時自動取得二階，不自動三階；觀看方不可代操作。
- York 示範頁只能當 UI／敘述參考，正式狀態仍以主遊戲與完整 `BOARD_GAME_STATE` 快照為準。

### 共鬥

- 已有共鬥玩家視角切換，入口位於玩家 HUD 右側下緣；點選參戰者只切觀看畫面，不改真正操作權。
- 非本人回合仍不可操作；共鬥交棒時會自動跟隨目前操作玩家。
- 技能仍只作用於自己的船員；戰鬥道具可消耗自己一整個行動支援另一位共鬥玩家。
- 全隊倒下的參戰者會進入「待救援 2 回合」，只在該玩家自己的兩次待救援回合計數；可自救或由隊友使用復活道具救援。
- 一般共鬥與特殊關卡已統一玩家戰績／獎勵顯示，也有等待其他玩家完成血統抽取的提示。

### 其他近期完成項目

- Boss 與四皇正式敵框已接入；CPU 觀看四皇時也應載入完整框。凱多中央雷雲透明度已降低，第二條血會切換第二型態圖。
- 新世界香吉士裝備傑爾馬 66 戰鬥服後，輪到他可戰鬥的回合才啟動隱形黑變身；七張戰鬥圖、招式、被動、數據與迷彩圖均有正式接線。
- 招式已區分物攻／特攻；特攻招式前顯示「（特）」；提高防禦的效果會說明是防禦或特防。
- 最終之島通關後保留黎明宴會／紀錄功能；宴會不消耗回合。
- 拉夫德魯的 Boss 島移動功能已改成大熊肉球果實傳送：選定目的地當回合不立刻抵達，下一個自己的回合才從最終之島飛往 Boss 島，沿用正式 pending 航行與落地結算。

## 三、目前正式戰鬥主版本與近期功能

最新正式主頁版本字串：

`20260814-lucci-rokuogan-audio-v48`

戰鬥 iframe 與主頁目前統一為 `20260814-lucci-rokuogan-audio-v48`；V203～V207 只改覺醒羅布・路基的專屬 Boss 規則、狀態 view、正式水墨圖、六王銃必殺演出與其音效生命週期，不得把此機制擴散到一般戰鬥。

主要檔案：

- `public/board_battle.html`
- `public/js/board_battle.js`
- `public/js/board_game.js`
- `public/css/board_lineage_extraction.css`
- `public/js/board_lineage_extraction.js`
- `scripts/tot_musica_full_dual_qa.js`
- `scripts/battle_damage_numbers_qa.js`
- `scripts/judge_clone_intercept_qa.js`
- `public/images/board/battle/tot_musica_dual/`

### 已定案的戰鬥流程

- Tot Musica 使用全螢幕專用雙世界舞台，不得中途閃回一般左右單挑戰鬥畫面。
- 開戰先把六名船員拖入左右各三格；每邊第一格先發，後兩格為替補。
- 選招階段 Boss 不出現。左右兩名我方船員各有自己的四鍵操作盤；點一邊只在自己的半邊顯示下一層，兩邊選完才共同結算。
- 左右 HUD 要保留 HP、等級、屬性、攜帶物與狀態；攜帶物可點開完整說明。下方不要重複「左隊／右隊」或頭像。
- 左右骰子都要完成自己的全部追加骰鏈；同一側第一、第二、第三骰依序共用同一骰位，不同時排三顆。
- 同步只看兩邊第一骰是否同為單數或同為雙數。骰鏈播完後畫面會恢復顯示兩邊第一骰，再進行碰撞判定。
- 不同奇偶時骰子碎裂，兩道攻擊各自向上，傷害只剩各自基礎的 5%。
- 同奇偶時骰子融合，兩名角色共同出招並形成向上合流衝擊。
- 同屬性 +50%、第一骰同點 +50%、同為物攻或同為特攻 +20%，可相加疊加。
- 攻擊由下往上飛 4.2 秒；鏡頭經長背景升到 Boss 高處。Boss 約在發射後 3.1 秒、命中前約 1.1 秒才由上方壓下，交會瞬間才切受擊圖、更新 HP 並跳出合計傷害。
- Boss 回合完全反向：先把鏡頭拉到高處，Boss 出現並完成骰鏈、向下攻擊，鏡頭回到我方後才結算兩人受擊。
- 中央只保留小型 `↑ 查看 Boss`；Boss 觀察畫面不顯示我方操作 UI，使用 `↓ 返回我方` 回到選招。
- Tot Musica 的正式最大 HP 是 5160。新的挑戰必須以 5160／5160 開始；Boss 現身先顯示受擊前 HP，命中瞬間才顯示扣血。
- 致死時依序為 `hit.webp` 命中、`dizzy.webp` 失衡、向下墜落退場，再顯示專用舞台上的勝利結算；不得重新出現舊一般敵人位置或 HP 0 站立圖。
- Boss 四招都應是有傷害的攻擊招式。

### V189 最後修正

- 額外骰子不再誤當同步奇偶依據：戰鬥頁以畫面恢復後的兩顆第一骰重新防呆判定；即使 event 的舊 `synchronized` 值錯誤，不同奇偶仍只能碎裂。
- 戰後血統抽取 root 已提升到 Tot Musica 專用層上方。擊倒後應能看見「進行提取／不要提取」，不會被全螢幕舞台蓋住。
- 抽取完成或放棄後才顯示「返回地圖」。
- 若返回時還有約克線索或重要道具揭露，battle iframe 會先關閉，讓地圖頁揭露可操作；關閉揭露後才清除戰鬥並交棒。
- 932×430 時抽取敵卡、文字與按钮已調整在可視範圍內，不應互相重疊或溢出。

### V191 最新修正

- 所有正式直接傷害命中都會在真正受擊者上方產生獨立傷害數字；連續攻擊每一下分開顯示。普通為黃橙色，暴擊為更大的紅金爆發字並附「暴擊」，MISS 與回復各自分色。
- 暴擊顯示只沿用 `board_game.js` 既有正式判定，不在 iframe 重擲，也不改傷害倍率、回合、狀態或同步。
- Tot Musica 每顆骰 1800ms 滾動＋800ms 停留，第一骰碰撞前停 700ms、碰撞 1100ms、融合停留 1300ms；垂直鏡頭 2900ms、攻擊上下飛行 4200ms。一輪玩家／敵方攻擊最低約 13.8／14 秒，追加骰每顆再加 2.6 秒。
- Boss 打下來時兩位船員會各自在自己的位置跳傷害；玩家打上去則在 Boss 上方跳合計傷害。結果說明使用短句且限制在原圖框內。

### V192 伽治複製兵最新修正

- 複製兵平時完全隱藏，不再常駐擋住文斯莫克・伽治；只有我方攻擊實際命中時才以反向圖片逐名衝出。
- 每段攻擊各消耗一名複製兵並使該段對伽治傷害歸零；三兵面對四段連擊正式結果為 `[0, 0, 0, 第四段傷害]`。指定打複製兵也會逐段清兵，但整招不傷伽治。
- 戰鬥頁依短暫 `judgeCloneBlocks` 對每一段顯示士兵、命中爆裂及「擋下」；兵用完後剩餘段才切伽治受擊圖與傷害跳字。低骰 30%／高骰貫穿舊規則已取消；每三次伽治行動補一兵仍保留。

- V192 定向 QA 在 1600×900 與 932×430 均為 `errors=[]`、`failures=[]`；證據目錄為 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/judge_clone_intercept_20260813_v2/`。

### V193 伽治護衛顯示微調

- 待機時仍完全隱藏複製兵；只有該段傷害被攔截時，較大的反向士兵才衝到伽治圖正前方，攔截期間允許直接遮住伽治，強化代替承傷的辨識度。
- 原中文「擋下」跳字改成同介面風格的 `GUARD`，不改任何逐段扣兵、生產進度、傷害、CPU 或同步規則；正式 query 為 `20260813-judge-clone-guard-v33`。

### V194 伽治士兵完整入框

- 攔截兵不再使用會超出敵方 portrait 容器的尺寸；基準寬高、底部位置及動畫峰值同步收回安全範圍，頭、腳與武器都完整顯示，但仍站在伽治圖正前方代替承傷。
- QA 新增每一次攔截士兵都必須完整位於圖層邊界內的檢查；正式 query 為 `20260813-judge-clone-contain-v34`。

### V195 伽治整隊攔截與香吉士換圖時序

- 伽治目前剩幾名複製兵，玩家攻擊開始就一次讓幾名士兵由右側衝出，在伽治正前方排成完整護衛線；連擊每一段接觸時再依序打飛一名。三兵仍只抵銷前三段，正式傷害與生產規則未改。
- 三兵與兩兵隊形已收進敵方圖片框，桌機與 932×430 均不裁切；待機仍完全不顯示士兵。
- 新世界香吉士裝備戰鬥服時，動畫前與五秒變身演出中主卡都保持原名稱與 `sanji_evolution_2/normal.webp`；事件結束後才切為隱形黑與 `sanji_stealth_black/stealth.webp`。正式 query 與內嵌戰鬥頁快取版本為 `20260813-guard-squad-sanji-timing-v35`。

### V196 一般戰鬥單一動畫與受擊時序

- 正式戰鬥 iframe 開啟後，`playBattleActionAnimation()` 直接讓位給 iframe 的 visual event，不再於正式擲骰／命中流程前另外播放舊 modal 攻擊；傷害與 CPU 行動仍只結算一次。
- 羅傑的「海賊王的霸王色」等開場能力下降被動統一用 `morale` 狀態發動圖，避免被誤認成開場攻擊；真正攻擊仍在擲骰後才使用 attack 圖。
- 戰鬥頁命中前以 `startHp`／`startSnapshot` 維持正常圖及攻擊前 HP，接觸時才切 `hit` 並扣顯示 HP。正式 query 與內嵌戰鬥頁快取版本為 `20260813-battle-impact-order-v36`。

### V197 CPU 開場對話恢復

- CPU／自動觀察原本在偵測到 `prebattleIntro` 時直接呼叫完成，導致所有 CPU 戰鬥開場對話消失；現在只回報等待，不再改寫完成狀態。
- iframe 依原本順序播完我方與敵方台詞並送回 `intro-done` 後，CPU 才選招；V196 的不重複假打與命中後受擊時序保留。正式 query 為 `20260813-battle-dialogue-impact-order-v37`。

### V198 開場被動純演出攻擊

- 依使用者確認，羅傑「海賊王的霸王色」等 debuff 開場被動可使用 `angry` 攻擊姿勢呈現發動感，但不是一次正式攻擊。
- `passive-opening` 事件明記 `cosmeticOnly: true`、`damage: 0`、`hitDamages: []`；戰鬥頁只播放發動者出手與能力下降特效，不切敵方受擊圖、不跳傷害、不改權威或畫面 HP。
- CPU 正式實戰逐幀驗證：開場被動期間捷風維持 986／986；羅傑之後選「神避」、骰 4，正式 attack 才降到 890／986。正式 query 為 `20260813-opening-passive-cosmetic-attack-v38`。

### V199 血統抽取敵方卡恢復

- 伽治看不到不是角色圖片缺檔，也不是伽治單獨問題；共用 KO 退場計時器、`portrait-ko` 與敵方隱藏標記會在抽取頁開啟後繼續生效，因此任何抽取來源都可能被較慢的擊倒 callback 再次淡出。
- 戰鬥頁現在依正式 `lineageExtraction.scopeKey` 先停止敵方 KO／fade／announce／portrait timers，清除隱藏標記及攻擊／受擊／擊倒 class，恢復原 `#enemyCard` 正常圖後才刷新抽取 UI。伽治的複製兵護衛 timer、節點與 class 同時清空。
- 已驗證十三名新 Boss 13／13、正式可抽取圖鑑 109／109 在「是否進行提取」詢問頁可見；伽治在 1600×900 與 932×430 均顯示原正式圖，複製兵層隱藏且無 overflow。正式 query 為 `20260813-lineage-enemy-restore-v39`，未改抽取權威、庫存、因子發放或同步 state。

### V200 抽取器選擇頁敵方卡層級

- V199 的第一次 QA 只停在「是否進行提取」詢問頁，沒有實際按進七連彈巢；選擇頁研究艙根層為 140、敵卡為 100，因此圖片雖已載入且 DOM 顯示可見，實際仍被全螢幕背景完全遮住。
- 抽取操作模式現把原 `#enemyCard` 提升至 160，維持右側原正式人物圖與外觀框；複製兵護衛層仍清空。QA 新增實際點擊與 `elementFromPoint()` 遮擋判定，不再把「已載入但被蓋住」當作通過。
- 伽治 1600×900 與 932×430 的抽取器選擇頁均實測 `enemyIsTopLayer=true`、無 overflow、`errors=[]`、`failures=[]`。正式 query 為 `20260813-lineage-operation-enemy-layer-v40`。

### V202 血統抽取終局光束層級

- V200 把操作模式敵卡提升至 160 後，三階段完成時由 `playOutcome()` 移到 `#battleStage` 的最終採樣光束仍只有 110，低於研究艙 140 與人物卡 160，因此伽治抽取時光束有播放但被完全遮住。
- 現只把戰鬥舞台直屬的終局採樣光束提升至 170；小遊戲光束、成功率、抽取器扣除、完整因子發放及同步 state 都未改。
- 1600×900 與 932×430 正式流程都已真正開始並完成伽治抽取，確認光束寬 686px／300px、opacity 1、動畫正常、無 overflow，`errors=[]`、`failures=[]`。正式 query 為 `20260813-lineage-outcome-beam-layer-v42`。

### V203～V207 覺醒羅布・路基隨機六式、正式水墨圖、六王銃與語音

- 舊版「行動後依序點燈、節點回血、高骰／控制拆燈」已正式取消。每個玩家行動回合開始、玩家尚未操作前，路基會從尚未使用的六式隨機抽出一式，同一循環不重複；此時只加能力並顯示水墨圖，不選敵招、不攻擊也不扣血。
- 剃／鐵塊／紙繪／月步／指槍／嵐腳分別使本回合速度／防禦／閃避／特防／攻擊／特攻 ×1.8。第六式抽出只標記待發；真正輪到路基攻擊才固定施放威力 480、必中、無視 50% 防禦的覺醒・六王銃；保留後排 3% 非致命震傷，施放後六式重置。
- iframe 會在行動前播放約 2.5 秒對應六式正式水墨圖與「能力提高 80%」；HUD 詳細框顯示已使用、目前生效、剩餘數與六王銃預警。六張透明 WebP 已逐字核對後歸檔於 `public/images/board/battle/postgame_mechanics/lucci_six_powers/`，HTML 文字只作載入失敗備援，正式頁不引用 `incoming/`。
- 六王銃正式圖在 `public/images/board/battle/postgame_mechanics/lucci_rokuogan/`：戰場與平板留白先全黑，發動圖慢慢浮現並以 0.92→1.36→1.06 回縮／前衝／回縮模擬揍向玩家；命中圖接觸我方的瞬間才播放受擊、更新畫面 HP 與跳傷害數字。
- 六王銃正式語音在 `public/audio/board_game/sfx/postgame_boss/lucci_rokuogan/`。全黑前立即暫停 BGM、停止並封鎖一般音效；浮現時播 `lucci_rokuogan_call.mp3`，真正接觸時播 `lucci_rokuogan_hit.mp3` 並保留專用命中衝擊音，演出結束或頁面離開時解除鎖定並淡入 BGM。語音載入失敗不能卡住戰鬥。
- `scripts/lucci_six_powers_qa.js` 已驗證 6／6 不重複、抽取前後 HP 不變、前五次非六王銃、第六次敵方攻擊才固定六王銃、必中／480／0.5 與 6→0 重置；八張 1254×1254 正式圖與兩段正式 MP3 均解碼成功，1600×900、932×430 的靜音／恢復、語音時點、必殺縮放、命中與傷害數字均無 overflow，`errors=[]`、`failures=[]`。證據在 `lucci_six_powers_20260814_v48/`。

### V191 驗證證據

- `node --check` 已通過：
  - `public/js/board_battle.js`
  - `public/js/board_game.js`
  - `scripts/tot_musica_full_dual_qa.js`
  - `scripts/battle_damage_numbers_qa.js`
- V191 驗證時 `http://127.0.0.1:8787/board_game.html` 回 HTTP 200；8787 已有服務在執行，重跑前先確認現有程序，不要直接再開第二個 server。
- Chrome／bundled Playwright 已在 1600×900 與 932×430 完整跑過：
  - 編隊與左右選招。
  - 故意把舊同步旗標設錯的 6／5 第一骰防呆。
  - 三骰完整同步。
  - Boss 5160／5160 現身，命中才變 4861／5160。
  - 第二回合擊倒與專用退場。
  - 血統抽取詢問。
  - 放棄抽取。
  - 返回地圖。
  - 約克線索揭露。
  - 揭露關閉後 `battleState=null`。
- 兩種 viewport 結果均為 `errors=[]`、`failures=[]`。
- 定向傷害跳字 QA 通過普通 123、暴擊 456、三連擊 31／42／53、MISS，以及 932×430 無越框；Tot Musica 完整 QA 通過向上合擊 299、敵方向下兩名各 601、第二回合擊倒、抽取、放棄與返回地圖。
- 最新结果目录：
  - `tmp/tot-musica-full-dual-qa`
  - `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/battle_damage_numbers_20260813`

### 重跑 Tot Musica QA

專案本身未必能直接 `require("playwright")`，可使用 Codex bundled runtime：

```powershell
$env:NODE_PATH='C:\Users\王曜瑋\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
$env:BOARD_QA_OUTPUT='tmp\tot-musica-handoff-check'
& 'C:\Users\王曜瑋\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'scripts\tot_musica_full_dual_qa.js'
```

手機橫向可再加：

```powershell
$env:BOARD_QA_WIDTH='932'
$env:BOARD_QA_HEIGHT='430'
$env:BOARD_QA_OUTPUT='tmp\tot-musica-handoff-phone-check'
& 'C:\Users\王曜瑋\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'scripts\tot_musica_full_dual_qa.js'
```

`tmp/` 只存 QA 證據，不得當正式素材或主流程來源。

## 四、正式權威與不可破壞邊界

- `public/js/board_game.js` 是主遊戲、戰鬥結果、抽取器消耗、因子發放、獎勵、回合與同步權威。
- `public/js/board_battle.js` 與 `public/board_battle.html` 主要負責戰鬥 iframe 顯示、输入與命令橋接，不得自己建立另一份正式狀態。
- Board 多人同步傳完整 `BOARD_GAME_STATE` 快照；不要為單一功能新增獨立 localStorage key、Socket.IO event 或 server 狀態。
- 不得任意改名既有角色、招式、Boss、道具、島嶼、路線、任務與素材 id。
- 不得從記憶大改 `board_game.js`，先用 `rg` 找實際呼叫鏈、normalize、save/load、battle view 與 finish/endTurn 入口。
- Tot Musica 是特殊顯示與特殊結算掛點，但不得修改一般戰鬥的行動順序、CPU 出招、共鬥交棒或通用 damage pipeline，除非實際證據顯示問題位於共用入口。
- 如果一般 CPU 戰鬥卡死或同回合出現兩招，先重現並確認是不是特殊舞台事件洩漏；不要用全域延遲或跳過回合硬解。
- 正式頁不得引用任何 `incoming/` 素材；新圖遵守「生成→展示→確認→歸檔→接入」，文字保持 HTML。
- 工作樹有大量使用者既有／未追蹤檔案，不得 `git reset --hard`、清理、覆蓋或把未追蹤視為垃圾。
- `npm start` 若回報 8787 已占用，先查現有服務；這通常表示 server 已在執行，不是程式語法失敗。

## 五、下一聊天室的工作方式

1. 先讀本文件與指定正式文件。
2. 根據使用者下一個具體問題，用 `rg` 找真正入口與呼叫鏈。
3. 先重現問題，記錄桌機與 932×430 畫面、console error、權威 battle state 與 iframe view。
4. 只改最小範圍；不要順手重構。
5. 影響戰鬥時至少跑 `node --check`、正式 HTTP 與相關瀏覽器 QA。
6. 影響同步時再用兩個瀏覽器身分驗證建立房間、加入、控制權、完整快照與重整恢復。
7. 每次修改後更新 `docs/DEV_WORKFLOW.md`，並依內容同步 `PROJECT_OVERVIEW.md`、`GAME_RULES.md`、`FILE_MAP.md` 與專題文件。

## 六、接手後第一次回報範本

請先回報：

> 我已完整閱讀 AGENTS.md、2026-08-13 交接文件、PROJECT_OVERVIEW、GAME_RULES、FILE_MAP，以及此次需求相關的專題文件與 DEV_WORKFLOW V113～V207。目前全破後第 0～13 階段均已完成；最新正式版本是覺醒羅布・路基六王銃語音與全黑靜音 V207（`20260814-lucci-rokuogan-audio-v48`），並包含行動前六式與六王銃必殺演出 V205／V206、正式六式水墨圖 V204、隨機六式規則 V203、血統抽取終局光束 V202、蛋頭島原地圖斜向五格航路 V201、抽取器選擇頁敵方卡層級 V200、血統抽取 KO 恢復 V199、開場被動純演出攻擊 V198、CPU 開場對話／一般戰鬥時序 V197、伽治／隱形黑 V195、全戰鬥傷害跳字與 Tot Musica V191。主遊戲與正式結果權威在 `board_game.js`，戰鬥頁只負責顯示與命令橋接。接下來我會先只讀追查使用者新需求的實際呼叫鏈與同步風險，回報後等待確認，不會先改檔。

若實際讀到的程式或較新的文件與本交接不同，以目前正式程式、最新 `DEV_WORKFLOW.md` 與使用者最新指示為準，並先向使用者指出差異。
