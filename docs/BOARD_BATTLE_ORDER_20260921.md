# 戰鬥圖片與技能音效時序修復（2026-09-21）

正式來源 `D:/Codex_Release_Worktrees/board-voyage-records-v1`；基線 `afea08a234f559f83cb2eb688f4fa1d34ceaa6a8`／Board `package-866f9d61a53eca35`。使用者回報圖片不流暢、致死時提早及重複顯示、技能音在擲骰時發出，並要求修正部署。

## 原因與修正

- `public/js/board_battle.js`：原替補面板依已結算的 raw HP 提前呼叫倒地；受擊計時器又一律回 normal，造成受擊→站回→再次受擊／倒地。改為接觸後展示 HP 歸零才保持 hit→dizzy，正式 knockout 沿用姿勢並只淡出一次。同一角色的倒地動作與回呼有身份保護；真正復活、換角、換戰鬥會重置。
- 替補／結果面板、尼卡待覺醒不跨過正在播放的攻擊。舊快照若殘留 animating，會在該事件 duration＋2400ms 且 HP 演出確實完成後容許結果 fallback；不重算傷害、不解鎖正式回合。
- 畫面輪詢不重設相同圖片 src，仍保留圖片載入失敗的既有 fallback。最近 512 個視覺事件 ID 去重，避免 A／B／A 重送重播；不新增網路事件或持久欄位。
- 技能 cast 音從普通／追加擲骰移到實際第一段出手：單擊 480ms、連擊 360ms，治療／狀態效果在 360ms 發聲；命中音仍在接觸時。Tot Musica 依 judge／launch／enemy attack 階段發聲；六王銃原特寫／命中 voice 路徑保留，不疊一般 cast。
- `public/js/board_game.js` 僅在普通攻擊、治療、狀態與切磋的結果事件補既有 `castSfx`，保留自訂／舊招式音檔；更新 iframe 版本。兩個 HTML 更新主 JS query。沒有更動擲骰、命中、傷害、HP 結算、PP、掉落、存檔 key、Socket.IO event 或 BOARD_GAME_STATE 權威。
- `scripts/build_board_program_update.js` 移除過時的 39 程式硬限制，沿用 baseline manifest 與 config 路徑完全相等檢查。本次仍為 43 程式／4,112 媒體，只有四個既有程式可更新，沒有新增素材。

## 本機驗證

隔離 `PORT=18926 npm start`，沿用 `board_move_fx_qa_isolation.js`，正式資料庫停用，測試資料置於 `D:/Codex_QA/board-battle-order-20260921/isolated-data`。所有證據放同一 QA 根目錄。

- `board_battle_order_browser_qa.js`：真 Chrome 的玩家／敵方致死、提早結果／替補、多段連擊、尼卡與手機橫向，逐 frame 收集圖片／class／HP／面板。以舊 Git blob 比較重現 13 項失敗（38 checks、JS errors 0），新版 **38/38**。修復前後資料分別在 `baseline-corrected/`、`browser/`。最初 fixture 的 selector／about:blank 初始化錯誤另留於 `baseline-browser/`，不當作產品缺陷證據。
- `board_battle_knockout_timing_qa.js`：**68/68**，倒地單次、同角色復活／換角、combo、尼卡、結果面板、stale animating 有界恢復、晚到替補面板沿用倒地期限、同 src fallback、512 ID 去重及 Tot Musica 音效階段。
- `board_move_fx_integration_qa.js`：**23/23**，骰子零技能音、單擊／連擊／support cast 時點、命中音、miss／六王銃／自訂音效。
- `board_move_fx_browser_qa.js`：**159/159**，12 案例、errors 空，prepare／首骰／追加骰不發技能音，第一 action cast 單次，hit 同傷害數字出現、重送不重播、桌機／手機與觀戰。未變更的完整圖集解碼此次不重做。首輪 158/159 的慢載入 fixture 因加入骰子等待而提早載完；僅把 QA 攔截延至完整命中之後。首輪工具輸出保留，最終報告為 `move-fx-audio/report.json`。
- 原 `battle_impact_order_qa.js` 通過：非致死 100%→20% HP 與受擊圖仍在接觸後更新、被動展示不扣血、手機無溢出。觀看佇列 **41**、分段傳輸 **58** 項通過。
- `lan_refresh_flow_qa.js`：隔離兩個 Chrome context 建房／加入／開始、交棒、F5、兩端戰鬥恢復通過，errors／failures 空。
- 新 `board_program_update_qa.js`：**31/31**，39／43 程式 fixture、config 增刪與污染拒絕、候選內容／v2／manifest 保護、inspect 不寫入。

以上為自動化瀏覽器、時序與本機 Socket.IO 測試，不代表實體手機或遠端真人對戰。桌機／橫向截圖已目視檢查。正式 24 資料檔、既有兩張 rank 修改與 catalog-v2 共 27 份先記 size／SHA；未提交 V1 圖片保留。

## 發布

來源提交 `141e7fdd42c4023b4066984846e28d4b3b8fb0e7` 已凍結，候選 `package-41425d61d6f49184` build／inspect／promote 通過。Manifest `eeb5e84246d69618029b6e89151ba93dab48777427dff9b947ec311cb2cd6089`，4,155 檔／1,397,173,371 bytes；4,112 媒體全部沿用，僅更新 `board_battle.html`、`board_game.html`、`js/board_battle.js`、`js/board_game.js` 四個程式。

- Release `9e0744d92b8047e9e4b8be9261508bc1eba51689` fast-forward 推送至 origin/main；公開 runtime 於 **2026-09-21 23:25:12（UTC+8）** 讀回新 release／manifest，轉換紀錄在 `release/runtime-transition.json`。
- 完整來源 dry-run：4,155 logical／3,838 unique，全部核對通過。精確四檔 delta 共 5,229,404 bytes 上傳成功，公開 R2 GET size／SHA **4/4** 通過。工具拒絕範圍外程式、任何媒體與 Card／Chess／v2 變更；證據在 `r2-dry-run.json`、`release/r2-*-delta-*.json`、`release/r2-verify.json`。
- 正式站 health、三遊戲 runtime、catalog／manifest SHA、43 程式 size／SHA 與舊端點關閉驗證 **47 checks** 通過，`release/live-verify.json`。
- 正式站真 Chrome 擊倒演出 **38/38**、JS errors 0；五情境含玩家／敵方致死、結果／替補提前到達、多段連擊手機橫向、尼卡待覺醒。逐 frame 與圖片 src 變更記錄在 `public-browser/battle-order-report.json`，桌機與橫向截圖已檢視。
- 正式站技能音效 **29/29**、JS errors 0；prepare／首骰／追加骰技能音為 0，攻擊 cast 505ms 單次，命中音 864.9ms 與傷害數字同步，輔助 cast 386.3ms 單次，同事件重送不重播，所有播放請求成功。並驗證實際載入兩支 JS SHA 與來源提交一致；證據 `public-audio/public-audio-report.json`。
- 公開瀏覽器僅用一次性 context 中的展示 fixture，導覽前封鎖非 GET／HEAD 與 WebSocket，未寫入正式房間或存檔。此為公開程式自動化驗收，不代表真人遠端連線／實體手機測試。
- 部署後重驗 27 份保護檔共 37,659,300 bytes，size／SHA 全部與本輪基線相同；未提交 V1 素材保留，18926 本輪 npm 服務已停止。`protected-baseline.json`、`protected-after.json` 可比對。

正式入口：https://onepiece-card-online.onrender.com/board_start.html 。網頁重新整理；桌面版更新約 5.2 MB 後重開。收尾僅文件提交使用 `[skip render]`，保持已驗收程式與套件不變。
