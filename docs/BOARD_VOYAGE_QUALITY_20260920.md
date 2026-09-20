# 航海錄操作與任務提示更新（2026-09-20）

## 正式來源與範圍

正式來源 `D:/Codex_Release_Worktrees/board-voyage-records-v1`，基線 `33e2356bfce44db308c15b7918efb69c077f79f5`。使用者授權實作並部署五項改善；只發布 Board，既有 ranks 圖片差異與 Card／Chess 程式不納入。

- 地圖工具列新增「快速航行」，預設關閉。日常擲骰改為 650 ms 翻滾加 550 ms 結果停留；首次完成開箱後，重複洗牌縮至 1.1 秒。首次開箱、劇情、戰鬥及 Boss 演出與獎勵確認保留。偏好和已看過開箱標記只寫入本機 `onepiece-board-quick-voyage-v1`，不新增 gameState 欄位。觀看端沿用既有事件 duration/detail 跟隨操作方速度，舊事件保留原計時。
- 戰鬥操作期間顯示「現在該考慮什麼」：特防提升、當回合與下回合護盾、泰佐洛金流 2/3、香克斯屬性無效和低血量。使用權威狀態及實際最大 HP，不預測傷害或改傷害公式。劇情、演出、結算與觀看期間隱藏。
- 第 83／89 話明列 A／S 委託皆需 30 億懸賞。任務日誌與任務島顯示目前門檻；達標後保留一個主線需要的可接委託。保留既有已接取、已完成、研究委託、獎勵與門檻，不另造任務 id。
- 開局選人詳情補上正式被動效果，招式可展開；桌機長文可捲動，手機直向與低高度橫向使用可讀排版。
- 主線／委託完成通知依序播放，顯示在戰鬥與 modal 上方；船上任務入口標示可領數量。多人收到本地玩家新完成狀態時提示；首次載入、重連、讀檔與重複快照不重播。提示本身不發獎，仍由玩家領取。

## 檔案與驗證

程式：`public/js/board_game.js`、`board_battle.js`、`board_missions.js`，`public/board_game.html`、`board_battle.html`。新增 QA：`scripts/board_quick_voyage_qa.js`、`board_battle_decision_hints_qa.js`、`board_mission_guidance_qa.js`、`board_draft_passive_browser_qa.js`。既有 `board_spectator_release_verify.js` 支援 `BOARD_QA_BASELINE`，核對指定基線的新增 blob 及其他遊戲保持不變；`board_spectator_playback_browser_qa.js` 可用 `BOARD_QA_QUICK_DICE=1` 檢查雙頁快速骰子。

`PORT=18920 npm start` 在使用者電腦成功啟動，沿用外部既有依賴，未修改 node_modules。未設定正式 DATABASE_URL，帳號與世界狀態皆為隔離 QA fixture。

- 快速航行 20 checks、0 errors；實測骰子 1216 ms、首次洗牌 4565 ms、重複洗牌 1137 ms；真正 rollDice 到選路 1429 ms，步數、結果與演出鎖正確。
- 戰鬥提示 45 checks、0 errors；當前／下一輪護盾、可替補／無替補／最終階段、最大 HP 加成、提示清除與唯讀性通過。
- 選人 35 個可選角色 × 桌機 1440×900、手機 390×844／932×430；文字存在、可捲動、無橫向裁切，預覽不改船員；0 errors。已目視截圖。
- 120 話既有主線與完整領獎回歸通過，未解析獎勵為空。
- 任務定向 832 checks、0 errors；涵蓋三尺寸、120 組抽選、已接任務保留、既有存檔選單穩定、完成通知佇列與真實 BOARD_GAME_STATE 接收器 fixture。遠端新完成只提示一次，重連靜默；NPC 說明區避免工具列重疊，日誌長條件可用鍵盤／觸控捲動。
- 雙頁 LAN 建房、加入、開始、交棒與刷新後身份／待續戰鬥恢復通過；0 failures/errors。斷線快照版本 42→43 補送及舊交易／戰鬥快照拒絕通過。
- 雙頁快速骰子測試 PASS，0 failures/errors；兩次骰面結果停留 547／657 ms，點數與 FIFO 順序正確，待套用的狀態 checkpoint 在兩次播完後才生效；戰鬥、交錯分段與控制權交接亦通過。
- Remote playback 13、battle spectator 41、state wire 611 checks 通過。多人觀看完整流程循序重跑 PASS，0 failures/errors；第一次與其他瀏覽器 QA 並行時，15 ms 取樣漏掉骰子起始片段，計得 1672 ms，原報告保留。未修改程式或門檻的循序重跑為 1778 ms（門檻 1770），交錯分段、延遲 iframe、動作順序與控制權交接均通過；此與 deterministic queue 測試一同判定為取樣排程差異。

證據：`D:/Codex_QA/board-quality-20260920/`。上述為本機自動化與受控狀態測試，不等於真人跨網路、實體手機或長時間多人遊玩驗收。

## 發布與回復

狀態：本機驗證完成，正在發布。程式提交後從 Git HEAD 建立 Board v3 manifest/catalog，先 dry-run、上傳 immutable blob 並公開 GET 核對 size/SHA，再推送 matching 程式與 metadata；最後讀回正式 health、三款 runtime identity、manifest 與全部 Board 程式。

回復保留歷史 immutable manifests/blobs，以基線五個 Board 程式恢復後重建匹配套件；不得修改玩家帳號、世界存檔、已領獎紀錄或無關圖片。
