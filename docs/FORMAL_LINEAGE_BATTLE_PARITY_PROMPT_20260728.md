# 正式戰鬥血統抽取完整對照與修正提示詞（2026-07-28）

以下內容可整段貼到新的 Codex 聊天室。這不是要求從零重做血統抽取，也不是要求開始第 6 階段；目標是把已完成的第 5 階段正式戰鬥抽取，完整對照使用者確認過的 V65 示範頁，補齊正式頁仍簡化或遺漏的視覺、操作與手機行為。

---

你要接手 One Piece 主題 Board 大富翁的「正式戰後血統因子抽取」完整對照與修正。

專案位置：

`C:\Users\王曜瑋\Documents\Codex\2026-04-20-1-2-start-html-game-html`

固定正式入口：

`http://127.0.0.1:8787/board_start.html`

如果 8787 已經運行，不要再開第二個伺服器，不要中斷目前房間。

## 一、先理解目前狀態

第 5 階段不是尚未實作，而是已於 `DEV_WORKFLOW.md` V85 接入正式頁：

- `public/js/board_game.js`：正式狀態、資格、庫存消耗、成功率、CPU、共鬥、完整因子與結算門檻。
- `public/board_battle.html`：載入正式血統抽取 CSS／JS。
- `public/js/board_battle.js`：正式 battle view 顯示與開始／完成／放棄命令橋接。
- `public/css/board_lineage_extraction.css`：正式抽取畫面樣式。
- `public/js/board_lineage_extraction.js`：正式抽取畫面與三階段操作控制器。

目前正式版的規則與狀態大致已完成，但不能只相信 V85 的摘要就宣稱視覺完全一致。你必須把正式頁逐項與使用者已確認的隔離示範比較，修正不一致處；不能覆蓋或重寫 V85 已完成的狀態權威。

## 二、開始前必讀，順序不可跳

請依序完整閱讀：

1. `AGENTS.md`
2. `docs/PROJECT_OVERVIEW.md`
3. `docs/GAME_RULES.md`
4. `docs/FILE_MAP.md`
5. `docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`
6. `docs/DEV_WORKFLOW.md`
7. `docs/NEXT_CHAT_HANDOFF_20260813.md`
8. `docs/FORMAL_LINEAGE_BATTLE_PARITY_PROMPT_20260728.md`

`DEV_WORKFLOW.md` 不可只看最後一段，至少要完整閱讀：

- V54～V63：七連彈巢、單點停輪、逐幀慣性、文字位置、三階段與發射演出定案。
- V65：手機完整等比例縮放，以及縮放後彈巢／光束座標換算。
- V83～V85：七種正式抽取器經濟、圖片式商品卡與正式第 5 階段接入。

歷史紀錄有衝突時以較新版本為準：

- V58 雙擊鎖定已被 V59 單點立即停輪與鎖定取代。
- V59 單段 CSS 旋轉已被 V60 `requestAnimationFrame` 慣性減速取代。
- V65 是目前手機與縮放座標基準。
- V85 是正式狀態與命令橋接基準，但不是免檢查的視覺完成證明。

## 三、必須完整閱讀示範頁

完整閱讀：

- `public/board_lineage_extraction_battle_demo.html`

這一頁是使用者逐次確認過的視覺與操作基準。不能只看截圖，也不能只複製最後幾段 CSS。請追清楚下列示範函式、狀態與版面：

- `fitStageToViewport()`
- `rectInStageSpace()`
- `positionExtractorCylinder()`
- `positionExtractionFx()`
- `buildExtractorCylinder()`
- `updateExtractorCylinder()`
- 逐幀慣性旋轉、即時停輪與孔位吸附
- 單點鎖定、第一個目標開始前返回選彈
- 第一階段 8～15 個 OSU 式縮圈點
- 第二階段左右鎖針
- 第三階段固定環／脈衝環
- 三階段狀態格與說明位置
- 八秒發射、封存、成功回收／失敗掙脫
- 選中抽取器在 90° 轉向時的殘影處理
- 七種抽取器各自的孔位背光、充能光與光束顏色
- 手機 844×390 與直向 390×844 的完整縮放

示範頁只提供 UI、手感與演出參考。禁止把下列示範假資料接入正式頁：

- `stock: 3`
- 假敵人／假 HP／假獎勵
- 示範自己執行的成功率亂數
- 示範頁的重播按鈕與重新模擬入口
- 任何示範 local state 取代正式 `battle.lineageExtraction`

示範頁本身不要修改；除非使用者另外明確要求改示範，否則它是本輪固定比對基準。

## 四、用 rg 追正式流程，不要憑印象讀巨型 JS

先用 `rg` 追下列正式入口及函式關係，再閱讀命中的相鄰程式：

### 主遊戲正式狀態

`public/js/board_game.js`

- `ensureLineageExtractionOpportunity()`
- `lineageExtractionEligiblePlayers()`
- `lineageExtractorOptionsForPlayer()`
- `normalizeLineageExtractionEntry()`
- `beginLineageExtractionAttempt()`
- `completeLineageExtractionAttempt()`
- `grantCompleteLineageFactor()`
- `autoResolveCpuLineageExtraction()`
- `battleStartLineageExtraction()`
- `battleCompleteLineageExtraction()`
- `battleDeclineLineageExtraction()`
- `lineageExtractionViewForPlayer()`
- `lineageExtractionAllResolved()`
- `finishBattle()`
- `canFinish`
- `BOARD_GAME_STATE`
- `scheduleBoardLanStatePush()`

### 戰鬥 iframe 與命令橋接

`public/js/board_battle.js`

- `callLineageExtractionAction()`
- `refreshLineageExtraction()`
- `postMessage`
- `onepiece-board-battle-command-v1`
- battle snapshot 更新
- iframe 訊息後優先重讀主遊戲最新 battle view 的競態修正

### 正式抽取控制器

`public/js/board_lineage_extraction.js`

- `ensureRoot()`
- `renderOffer()`
- `renderCylinder()`
- `positionCylinder()`
- `cylinderMotionFrame()`
- `lockCylinderSelection()`
- `beginMinigame()`
- `spawnStartTarget()`
- `spawnTimedTarget()`
- `beginLockPhase()`
- `beginSealPhase()`
- `positionOutcomeBeam()`
- `playOutcome()`
- `renderResult()`
- `renderWaiting()`
- `refresh()`

### 正式版面與素材

- `public/board_battle.html`
- `public/css/board_lineage_extraction.css`
- `public/js/board_items.js`
- `public/images/board/lineage_extraction_ui/`

不要修改或從 `incoming/`、備份、snapshot、`tmp/` 取得正式素材。

## 五、第一輪先回報，不要直接改

完成上述閱讀與追蹤後，先用繁體中文在 40 行內回報：

1. 正式戰鬥從敵人 HP 歸零到原結算的完整函式／狀態鏈。
2. `board_game.js`、`board_battle.js`、`board_lineage_extraction.js` 各自責任。
3. 正式版與 V65 示範已一致的項目。
4. 正式版與 V65 示範仍不一致的項目。
5. 預計只修改哪些正式檔案。
6. 是否需要新圖片；目前原則上既有素材足夠，不要為了方便重新生圖。
7. 桌機、平板、手機、CPU、觀看方與雙視窗測試方法。

等使用者確認後，才開始修正。不要在第一輪先重寫程式。

## 六、已知必查差異，不可漏掉

以下是目前程式已觀察到的高風險差異。你要以實際畫面再次驗證；若仍存在，必須修正，不能只在報告中提到：

### 1. 七連彈巢不能在第一階段後消失

目前正式 `beginMinigame()` 會呼叫 `hideSections()`，可能把 `lineage-cylinder-scene` 隱藏。

使用者已定案：

- 選定抽取器後，巨型七連彈巢不能消失。
- 第一、第二、第三階段都要保留彈巢。
- 最終八秒發射與成功／失敗等待期間也要保留彈巢。
- 鎖定後彈巢與未選抽取器只淡化，不消失。
- 選中孔位維持清楚，抽取器仍在左側圓槽內。

不要為了保留彈巢而遮住敵人卡、三階段目標或文字。

### 2. 最終演出不能只放一張抽取器圖

目前正式 `playOutcome()` 可能只顯示 `.lineage-outcome-launcher`、單條光束與命中環，沒有完整沿用示範的發射底框和透明軌道。

使用者已定案：

- `lineage_extractor_launcher_frame_v2.webp` 必須保留。
- 發射底框的左圓、中央細線、金屬扣件、透明軌道與右側發射口都要顯示。
- 框內光束位於底框圖片下方，從透明軌道槽透出。
- 光束不能蓋過金屬框、中央細線或發射口。
- 框外光束才從發射口延伸到敵人。
- 抽取器固定在左圓內，先尖端朝上，再同軸順時針轉 90°。
- 不能出現未旋轉抽取器殘影。
- 發射區的光束不可在中途變暗。

### 3. 八秒結果演出要完整

完整流程必須接近示範頁：

1. 抽取器充能。
2. 抽取器順時針轉 90°。
3. 光沿底框透明軌道前進。
4. 從發射口射向原敵人角色框。
5. 命中敵人並出現三次封存脈衝。
6. 等待完整結果，總長約 8 秒。
7. 成功時樣本沿光路回收並封存。
8. 失敗時敵人／樣本掙脫、光束崩解並轉紅。
9. 演出結束後才顯示正式結果，然後回原戰鬥結算。

不得提前清除 `#enemyCard` 或呼叫正式 `finishBattle()`。

### 4. 七種顏色必須一致

沿用示範與 `EXTRACTOR_VISUALS`：

- 標準：`73 232 221`
- 精密：`142 242 250`
- 力量：`255 72 68`
- 技巧：`76 218 244`
- 速度：`79 226 238`
- 能力者：`190 87 255`
- 皇級：`246 54 91`

孔位背光、選中光、90° 充能閃光、框內光束、框外光束、命中環與成功回收樣本都要跟抽取器顏色一致；失敗破裂才統一轉紅。

### 5. 慣性與停輪要和 V60 一樣

- 使用 `requestAnimationFrame` 依實際 elapsed time 更新，不要寫死每幀永遠 16ms。
- 滾輪與快速上下滑動可以累積速度。
- 放手後快速旋轉，再平滑減速。
- 低於門檻才吸附到最近的 `360 / 7` 孔位。
- 旋轉途中點左圓要立即以當下實際角度停輪，不等待預定終點。
- 一種抽取器時七格相同；兩種交叉；三種以上依可用種類循環。
- 七顆抽取器隨彈巢旋轉時，本體仍保持尖端朝上。

不要增加底部確認按鈕；左圓單點就是鎖定。再次點擊返回選彈，只能發生在第一個計時目標開始前。

### 6. 三階段必須在原敵人卡內操作

- 不重建敵人卡。
- 保留原 `#enemyCard`、`.portrait-wrap`、姓名、HUD、HP、`cosmeticFrameId`／`enemyCosmeticFrameId` 外觀框。
- 目標只能放在敵人 portrait 安全範圍。
- 不能蓋姓名、階級、HP、外觀框主要裝飾。
- 第一階段第一個中央點必須由玩家點擊後才開始計時。
- 第一階段依 ED／CB／A／S／SS／SSS 為 8／9／10／12／14／15 點。
- 第一階段累積 3 次 Miss 只結束第一階段，仍要進第二、第三階段。
- 第二階段只保留清楚的一組左右鎖針，不要塞太多圖。
- 第三階段必須讓固定 Perfect 區與縮放脈衝環一眼看懂。

### 7. 狀態格與文字位置

- 三格狀態必須位於發射底框右側與敵人卡左側的空白區。
- 說明文字放在三格下方，不得蓋彈巢、發射底框或敵人卡。
- 抽取器名稱與成功率／持有量在發射底框下方同一長框內同列顯示。
- 所有文字上下左右置中，不得只做水平置中。
- 不可讓文字溢出圖片原生框。

### 8. 手機不能只裁桌機畫面

對照示範 V65：

- 手機橫向必須完整看到整個正式戰鬥／抽取舞台。
- 保留正式舞台內部比例，再等比例縮小置中，不可把圓形彈巢拉成橢圓。
- Safari `visualViewport` 改變、網址列收合與旋轉後要重新對位。
- 使用 DOM rect 計算彈巢或光束時，必須換算回舞台內部座標，避免被外層 transform 縮放兩次。
- 敵人紅框、三格狀態與發射口不能被右側裁掉。
- 手機支援上下滑動與單點停輪；觸控不能造成整頁捲動。

至少實測：

- 1440×900
- 1024×768
- 844×390 橫向手機
- 390×844 直向手機

## 七、正式狀態權威不可破壞

視覺修正時必須保留下列 V85 正式規則：

- 只有 `postgameWorld.researchLabsActive` 後的新勝利建立抽取機會。
- 戰敗、逃跑、黑轉我方前哨戰不抽取。
- 沒有抽取器時直接 `unavailable`，不多卡一步。
- 「不要提取」為 `declined`，不消耗抽取器。
- 確認抽取器時，由 `board_game.js` 立即扣 1 個。
- 成功或失敗都不退還。
- 同一 `attemptId` 重複開始不能重複扣除。
- 同一 `attemptId` 重複完成不能重複發放。
- 正式成功率亂數只能在 `board_game.js` 執行一次。
- iframe 只能回傳三階段 grades，不能自行決定 success。
- 成功只新增一份 `researchLab.completeFactors`，不直接生成角色。
- 完整因子不可一般交易。
- 所有人完成、放棄或 unavailable 後，原戰鬥才能結算。
- 共鬥每位實際參戰者各自使用自己的抽取器與結果。
- CPU 自動處理，不得等待 UI。
- 觀看方只觀看，不可送開始、完成或放棄命令。

不要新增新的 Socket.IO event 或 localStorage key。繼續沿用完整 `BOARD_GAME_STATE` 快照與既有 battle command bridge。

## 八、正式版資料不可使用示範假值

正式抽取器只能來自目前玩家實際重要道具庫存：

- `lineage_extractor_standard`
- `lineage_extractor_precision`
- `lineage_extractor_resonance_power`
- `lineage_extractor_resonance_skill`
- `lineage_extractor_resonance_speed`
- `lineage_extractor_ability`
- `lineage_extractor_emperor`

必須顯示正式名稱、實際數量、對目前敵人的實際加成。不得把示範的 `stock: 3`、固定敵人或固定抽取器順序寫回正式狀態。

## 九、多人與中斷安全

至少驗證：

1. 單人真人：選擇、三階段、成功、失敗、放棄、無抽取器。
2. CPU：有抽取器與無抽取器都不會卡住。
3. 觀看方：畫面可更新但所有操作無效。
4. 共鬥兩名參戰者：一人完成時仍等待另一人；兩人各扣自己的道具。
5. 共鬥一人有抽取器、一人沒有：後者 unavailable，前者完成後才可結算。
6. 兩個視窗：開始、完成、結果與完整因子在完整快照中一致。
7. 旋轉中收到較舊 iframe snapshot：不能把彈巢切回詢問。
8. 確認抽取器後重整：不能退道具或再扣一次。
9. 完成後重送命令：不能再發一份因子。
10. 結果動畫中 battle view 更新：不能重播兩次、跳過結果或提前 finish。

測試使用隔離瀏覽器 context 或測試房，不得刪除、重設或污染使用者正式 localStorage、server save 與現有房間。

## 十、修改範圍

優先只修改：

- `public/js/board_lineage_extraction.js`
- `public/css/board_lineage_extraction.css`
- 必要時修改 `public/js/board_battle.js`
- 必要時更新 `public/board_battle.html` 的 cache query

只有發現正式權威狀態 bug 時，才最小修改 `public/js/board_game.js`。不要順手重構巨型 `board_game.js`，不要改抽取器數值、道具 id、敵人資料或其他戰鬥規則。

不要修改：

- `public/board_lineage_extraction_battle_demo.html`（本輪固定參考）
- 舊卡牌遊戲
- `tmp/`
- `backups/`
- `_codex_backups/`
- `_restore_backup_*/`
- 使用者正式存檔

## 十一、完成驗證

完成後必須執行：

- `node --check public/js/board_lineage_extraction.js`
- `node --check public/js/board_battle.js`
- 若有修改則 `node --check public/js/board_game.js`
- `public/board_battle.html` inline script 語法檢查
- 正式 CSS／JS／所有引用 WebP 路徑存在
- 正式頁與新增 query HTTP 200
- `git diff --check`
- Chrome 1440×900 實際畫面
- Chrome 1024×768 實際畫面
- 手機 844×390 實際觸控畫面
- 手機 390×844 不裁切
- 至少兩個視窗測試共鬥／觀看／同步
- 實測戰鬥勝利後的「進行提取／不要提取」
- 實測七連彈巢旋轉、停輪、三階段、八秒成功與失敗演出
- 實測回到原戰鬥結算並正常返回地圖

畫面驗證不能只量 DOM；必須真的截圖檢查文字、圖片、圓框、彈巢、發射口、光束與敵人卡是否對齊。

## 十二、文件更新

每次實際修改都必須更新：

- `docs/DEV_WORKFLOW.md`
- 正式功能或架構有變動時更新 `docs/PROJECT_OVERVIEW.md`
- 正式規則或數值有變動時更新 `docs/GAME_RULES.md`
- 新增檔案、素材或職責變動時更新 `docs/FILE_MAP.md`
- 血統企劃或階段邊界變動時更新 `docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`
- 重大進度完成後更新 `docs/NEXT_CHAT_HANDOFF_20260813.md`

紀錄必須寫清楚：

- 實際修改檔案
- 對照示範修正了哪些差異
- 哪些 V85 正式規則保持不變
- 桌機／平板／手機畫面結果
- 單人／CPU／觀看／共鬥／雙視窗結果
- 快取版本
- 是否影響存檔 schema、`BOARD_GAME_STATE`、localStorage 或 Socket.IO

## 十三、完成條件

只有同時滿足以下條件才能說「正式戰鬥抽取完成」：

- 正式規則仍由 `board_game.js` 權威處理。
- 正式畫面完整沿用原敵人卡與外觀框。
- 七連彈巢在三階段與結果演出都持續顯示。
- 彈巢、發射底框、透明軌道、90° 抽取器與光束層級吻合 V65 示範。
- 三階段在敵人 portrait 安全區內操作。
- 八秒成功／失敗演出完整。
- 桌機、平板、手機都不裁切、不變形、不重疊。
- 放棄、無抽取器、CPU、觀看方、共鬥、重整與重送都不會卡住或重複結算。
- 原戰鬥獎勵與返回地圖流程仍正常。
- 文件與驗證紀錄已更新。

完成閱讀後先提交第一輪差異報告，等使用者確認再修改；不要直接跳到第 6 階段研究所培育。
