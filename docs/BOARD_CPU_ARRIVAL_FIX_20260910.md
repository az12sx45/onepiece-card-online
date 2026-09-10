# Board CPU 停靠結算卡住修正（2026-09-10）

## 狀態與來源

使用者回報朋友在正式房間以 1 真人＋3 CPU 遊玩，CPU 只停留地圖「停靠結算」、沒有彈窗。以目前正式 `6a6f22c1`／Board `package-0f7755bca2f64ff4` 為基線，在 `D:\Codex_Release_Worktrees\board-state-wire-v1`、`codex/board-cpu-arrival-v1` 修正；此紀錄目前為本機候選，正式發布完成後補驗證與新 package。

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
- 額外隨機長跑在固定重現已通過後主動取消，未計為 PASS。正式公開程式／package 驗證待補；不能把本機修正當作朋友已更新。

## 發布與回復

桌面採程式雜湊清單，需提交修正程式後重建 Board v3 manifest／catalog，先上傳新的 immutable R2 blobs，再推送匹配的程式與清單；Card／Chess package 和 launcher 1.1.6 binary 保持原版。玩家取得修正版後要更新 Board 並重開遊戲。

此修正防止事件視窗再次被 CPU 學技關掉；舊版已遺失的事件 UI 不會靠新增清鎖或重新擲骰冒充復原。回復時以 scoped revert 同步回復程式與 matching package，保留舊 immutable objects 與存檔。
