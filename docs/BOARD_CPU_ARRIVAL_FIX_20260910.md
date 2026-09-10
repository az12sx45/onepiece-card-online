# Board CPU 停靠結算卡住修正（2026-09-10）

## 狀態與來源

使用者回報朋友在正式房間以 1 真人＋3 CPU 遊玩，CPU 只停留地圖「停靠結算」、沒有彈窗。以修前正式 `6a6f22c1`／Board `package-0f7755bca2f64ff4` 為基線，在 `D:\Codex_Release_Worktrees\board-state-wire-v1`、`codex/board-cpu-arrival-v1` 修正。2026-09-10 15:22:25（Asia/Taipei）已從 Render 確認新版身分，15:22:37 完成正式公開檔案驗證。

- 修正程式 commit：`5889ecc9e1686b136fd6a623b8fc8962a49408d0`。
- 程式與套件 release commit：`0b12c706f6f41c92a94968d1548a3580ba3577c5`，已推送 `main` 並在 Render 生效。
- 新 Board package：`package-40947c7bd7fe4b29`，manifest SHA-256 `c3a7b45fae657b8d911c41074808b8fb86f19fe8d5afdb75fafa142e2509cb91`。
- 清單 3,487 檔／1,284,470,988 bytes／36 程式；相對省流量完整包只增加 `board_game.html` 和 `js/board_game.js` 兩個 blob、4,317,685 bytes。Card／Chess releaseId 與 manifest 保持原值。

## 原因與修正

- 正式本機大廳建立 1 真人＋3 CPU，自然航行在第 4 輪重現：CPU2 移動中完成「偉大航道第一步」，經驗獎勵令凱洛特升到 Lv.15 並排入新招式學習。移動完成先開海域選擇，再由 CPU 自動替換招式；舊程式無條件關閉共用 modal，留下 `resolutionLock=true`、無 pendingMove／battle／modal，CPU 永遠等待演出。
- 新同步差異編碼沒有參與這個重現：單一真人是狀態發送端，接收 full／delta 都是 0；連線、host 控制權與版本 ACK 正常。這是原 CPU 學招式流程的視窗所有權問題。
- `public/js/board_game.js`：自動學習的 known／learn／replace／skip 與失效佇列清理，只能關閉當次原有且仍存在的 `.move-learn-ui`。背景學習保留海域、寶箱及其他事件原 DOM 與事件處理器，亦不透過下一個學技工作覆蓋它。原 CPU 選招策略及即時學習資料處理保留。
- 不設逾時跳過結算，不強制清除結算鎖，不改獎勵、回合、state 欄位、id、存檔格式、localStorage key 或 Socket.IO event。正常事件按鈕仍負責完成原結算及交棒。

## 驗證與界線

- `PORT=18891 npm start` 可正常提供頁面與真 Socket.IO 房間；本機沒有 DATABASE_URL，使用隔離記憶體房間。
- 自然卡住證據：`D:\Codex_QA\board-cpu-arrival-20260910\natural-long\cpu-arrival-report.json`、`stalled-full-payload.json` 與 `cpu-arrival-last.png`。未修改真人存檔或啟動器快取。
- `scripts/board_cpu_arrival_qa.js` 的 `BOARD_QA_MODE=targeted`：真實 1 真人＋3 CPU 大廳搭配隔離記憶體的待學佇列與正式落點流程。`BOARD_QA_BASELINE=1` 使用修前 `6a6f22c1` 程式 route：replace／known／invalid／multiple 四種背景學技都穩定關掉海格 modal；原 CPU 可見學技和真人可見學技二例原本通過。
- 修後 targeted 六例全 PASS、0 頁面／console 錯誤：四種背景學技保留同一個原海格 DOM 與 handler、原 CPU 完成事件並交棒；可見 CPU 連續兩招與真人確認替換／跳過下一招仍正常。證據在上述 QA 目錄的 `targeted-baseline-final` 和 `targeted-fixed`。沒有把難以用合法牌組觸發的 learn／skip 自動資料分支當作已單獨覆蓋；這兩分支由同一個視窗保護實作及獨立 review 確認。
- `scripts/lan_refresh_flow_qa.js` 真雙 Chromium context 建房／加入／開始／交棒／刷新／待續戰鬥恢復 PASS，12 名招募、guest 3 次差異解碼、0 恢復／failure／error；host 與 guest 戰鬥 overlay 都正常開啟。JS 語法、scoped diff check 與獨立程式 review PASS。
- 額外隨機長跑在固定重現已通過後主動取消，未計為 PASS。正式驗證確認新版供應，不能把它當作朋友已更新。
- 桌面 catalog QA PASS：91 份程式、340 個本機引用、0 遺漏媒體／外部程式引用、legacy v2 bytes 不變、Git HEAD 與 deterministic 重建相符。真本機 Board runtime identity 已回 200、新 package／SHA。
- 正式服務驗證 PASS：health 正常，三款 runtime identity 都是 200／no-store、releaseId／manifest SHA／entryPath 與清單完全一致；4 份 catalog／manifest metadata 及 36 份 Board 程式公開 GET 的 size／SHA 全數相符，文件執行 MIME 為 text/html。共讀取 9,707,763 body bytes，未建立正式測試房或操作真人存檔。腳本與證據為 `D:\Codex_QA\board-cpu-arrival-20260910\verify-production.cjs`、`production-verify-report.json` 與 `deployment-observations.json`。本機 QA server 已停止，18891 無 listener。

## 發布與回復

R2 已完成 3,170 個 unique blobs 檢查，`uploaded=2`、`skipped=3168`。2026-09-10 15:16:20（Asia/Taipei）兩份新檔公開 GET 都回 200，大小與 SHA-256 完全一致；HTML 下載物件為 `application/octet-stream` 且含 `no-transform`，執行 MIME 仍由 manifest 提供。紀錄為 `D:\Codex_QA\board-cpu-arrival-20260910\r2-publish.log` 與 `r2-verify-report.json`。

桌面採程式雜湊清單，需提交修正程式後重建 Board v3 manifest／catalog，先上傳新的 immutable R2 blobs，再推送匹配的程式與清單；Card／Chess package 和 launcher 1.1.6 binary 保持原版。玩家取得修正版後要更新 Board 並重開遊戲。

本輪沒有重新下載完整 1.28 GB 或重跑 launcher installer。沿用前次已驗證的 1.1.6 下載／runtime 程式與 metadata 規則，以本輪兩份新 blob 的公開 size／SHA、catalog QA 及正式 runtime identity／程式完整性確認新版供應；不能把這些結果當成朋友電腦已更新完成。

兩個既有開發樹的相同函式與入口 query 已精準回套，並同步各自四份專案文件：`C:\Users\王曜瑋\Documents\Codex\2026-04-20-1-2-start-html-game-html` 與 `D:\Codex_Release_Worktrees\battle-chess-launcher-v1`。函式基線先核對，回套以外 bytes 保留，兩份 JS 語法與 12 份檔案的 scoped diff 檢查通過；未帶入或提交原有無關修改。證據：`D:\Codex_QA\cpu-arrival-audit-20260910\backport\report.json`。

此修正防止事件視窗再次被 CPU 學技關掉；舊版已遺失的事件 UI 不會靠新增清鎖或重新擲骰冒充復原。回復時以 scoped revert 同步回復程式與 matching package，保留舊 immutable objects 與存檔。
