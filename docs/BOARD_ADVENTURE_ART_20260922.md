# 冒險抽選插畫與個人圖鑑（2026-09-22）

使用者明確選擇完成並測試後「直接更新下載版」。正式來源為 D:\Codex_Release_Worktrees\board-voyage-records-v1；C 槽副本不作發布來源。

## 範圍

- 既有海格 24 種 × 3 張 = 72 張，本次逐檔確認 1536 × 1024、72 個不同 SHA。
- 新增寶箱 wood/copper/silver/gold/gem、推進城 patrol/key/magellan/ivankov/hidden、司法島 heal/pp/attack/defense/speed/shield/revive/burst，各 3 張，共 54 張。
- 全部新圖使用內建 GPT imagegen；PNG 原稿保留，僅本機尺寸／WebP 編碼轉換，三份 BOARD_ADVENTURE_ART_*_V1.json 記錄完整 prompt、来源、SHA、尺寸與檢查結果。
- 合計 42 組、126 張，維持 3:2 深海／青綠／金色的航海王角色冒險插畫。實際隨機選一張，相同事件不連續選同版，獨立視覺 RNG 不消耗遊戲 RNG。

## 收藏與存檔

大廳與航海選單提供「冒險插畫圖鑑」，分類、進度、未解鎖占位、只看已解鎖、放大與前後切換。未解鎖版本不載入圖片。寶箱結果亦顯示原海格來源縮圖，使既有七種寶箱海格插畫仍可遇見。

玩家新增可選 `adventureArt`（合法 art ID 到首次遇見時間），舊存檔正規化為空集合；既有遊戲欄位／事件／key 不更名。CPU 不保存收藏，觀看別人的事件不計入自己的圖鑑；實際受推進城事件影響的小隊成員各自記錄同一版本。此欄位隨既有完整 BOARD_GAME_STATE 同步，顯示時不重抽。

個人永久收藏使用 `op_board_art_collection_v1:<userId>` 本機快取，與既有 PROFILE_GET／PROFILE_UPDATE 的 `stats.boardArtCollectionV1` 同步。伺服器在單一 UPSERT 中原子聯集並取較早時間，保留其它 stats、titles、bounties；不新增資料表或事件。離線先保留本機，重連重試；新局不清空收藏。更新前未記錄逐張遇見資料，不猜測回填。

## 展示時序

推進城圖待轉盤停妥才出現，同一事件的 800ms 輪詢不重建圖片。司法島待原 4550ms 揭曉時間顯示；第六階段既有補給也完整呈現後才進最終結算。所有更動皆為展示／收藏，不更改抽選機率、傷害、獎勵或控制權。

## 驗證與發布

本機驗證完成，尚未部署。隔離測試目錄 `D:/Codex_QA/draw-result-art-20260922`，`npm start` port 18929 使用既有資料隔離 preload、停用 DB 連線；未用正式存檔測試。保護基線記錄於 protected-baseline.json，29份檔案初次核對全部不變，既有 ranks/r5.PNG、r6.PNG 與未追蹤 sea_event_reveal/v1 不提交。

- 素材：54個不同WebP，共20,629,444 bytes；完整PNG來源SHA、WebP SHA、1536×1024解碼與精確檔名集合通過。既有72張與基線Git bytes完全一致，Chrome126/126全部解碼。
- `board_art_collection_qa.js`：73項通過，實際PGlite PostgreSQL引擎執行從server抽出的完整UPSERT，兩client聯集／最早時間／其它stats保留；真Chrome離線補存、重開、未解鎖不取圖、三尺寸、帳號切換與登出。
- `board_adventure_runtime_qa.js`：44項通過，舊存檔／JSON roundtrip、CPU與其他玩家隔離、5推進城事件同隊行為、8種實際buff及重複領獎阻擋、真推進城bridge 2550ms顯圖且輪詢不換DOM、司法島4550ms顯圖、桌機與橫向手機排版。戰鬥直向手機仍沿用既有「請將裝置橫向」遮罩，不宣稱直向戰鬥可玩。
- `board_sea_event_reveal_qa.js`：222項通過，真localhost雙頁房間、全部24海格與5寶箱、逐張收藏與觀戰不授予、快照／刷新、CPU確認、減少動態、圖片失敗fallback。首次新增來源縮圖擠出小螢幕確認按鈕，改為內文滾動與固定頭尾後完整重跑通過；首輪報告保留。
- `board_adventure_settlement_qa.js`：21項通過，6階段獎勵在展示後繼續／最終結算、重入不重發；等待中刻意重建raid物件，捕捉並修復第六階段舊引用寫入問題。最終callback重新取得當前raid。真Chrome最後階段9項通過，54次getBattleView輪詢後11,424.5ms才結算。
- 首份候選尚未上傳／推送前，另以500ms中斷、全新context及真loadManualGame重現末階段等待中刷新卡住。補上只針對已領取末階段補給的恢復續行，重用原圖／buff、不重發階段獎勵或擊殺紀錄；本頁WeakSet防重入、舊timer不結算已替換battle、已通關不重加clearCount。首份本機候選保留於QA，未發布，重新建立最終候選。
- 獨立review找到延遲storage事件跨帳號與登出未清內存兩個邊界，先重選owner再比對storage key，空owner清內存但不刪舊帳號快取；真瀏覽器新增3項回歸通過。首輪SQL測試字串替換的`$`被當替換語法、popup QA init script於無origin文件讀storage兩個fixture錯誤亦已修正，非產品／正式資料錯誤。
- `lan_refresh_flow_qa.js`：建立／加入／開始／交棒／重整恢復與戰鬥iframe均通過，failures與errors為空；既有`board_battle_knockout_timing_qa.js` 68項通過，致死展示與擲骰無技能音回歸保持。
- `board_adventure_art_release_builder_qa.js`：24項隔離Git fixture通過，46程式、54新圖、4112保留媒體，共4212 logical files，65個更新檔；防缺圖／額外檔／舊素材更動／候選竄改與顯式promote驗證。語法及git diff --check通過。

末階段修正後，真Chrome重新驗證正常結算9/9與新context還原途中快照4/4，均無JS錯誤。恢復前後皆為同一judicial:burst第3張，phaseClaims維持1、finalClaims從0至1、endTurn僅1次；ordinary load清除visualEvent仍由raidPhaseReward恢復，另有VM覆蓋。此為隔離Chrome與LAN快照測試，非正式帳號、實體手機或Electron人工遊玩驗收。

新增三支程式進入既有桌面白名單，專用builder固定本次來源基線，只更新Board。最終候選來源57ecf1eef3971a9e08986ac62ee261e05a820b55，套件package-ba5b139c7f2fd8cf、manifest SHA ac05f7cdbf3d0b10110e68e7782b3071598857c7fd8ca2da27cf4b5d5ad29eaa；4212項、1,417,830,546 logical bytes。公開R2與runtime待發布後補驗。網頁遊玩gate、啟動器版本、Card／Chess及catalog-v2保留。
