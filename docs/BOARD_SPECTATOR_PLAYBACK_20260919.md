# 航海錄觀看動作連續播放修正（2026-09-19）

## 來源與發布狀態

正式來源 `D:\Codex_Release_Worktrees\board-voyage-records-v1`，基線 `dc7d77d5`。本輪唯讀比對公開 board_game.js SHA 相符，board_battle.js 排除 checkout CRLF 差異後相同。C 槽歷史樹只更新文件指向；既有 ranks 大小寫差異不在修改範圍。

使用者於 2026-09-19 明確授權修正後部署。目前本機驗證已通過，正在準備線上與桌面更新；正式上線結果於文末另記，本機驗證不代表正式玩家已取得更新。

## 根因及修改

- 原觀看端新 UI 事件會清除上一事件；移動事件直接連續改座標，集中抵達會跳格。新增 board_remote_playback.js 在解碼後依收到順序播放；骰子完成翻滾與 3 秒結果展示、移動按來源步速逐格顯示、事件視窗至少展示 1.5 秒。相同演出的相鄰快照只留最新一份，不合併不同動作。
- 原戰鬥頁優先讀最新 API 覆蓋傳入快照，再取消上一招計時器。父頁以既有 BOARD_GAME_EVENT 的 battle/visual 通道補送各招唯讀畫面，避免完整狀態 latest-pending 合併漏掉中間招式；iframe 去重並依完整時間播放。顯示事件沿用 64 KiB 上限，超大畫面仍走原完整快照；本次不宣稱所有 Boss 畫面大小或流量帳單均已驗證。
- 慢載入 iframe 暫存的招式依序交付，覆蓋層真正顯示後才開始計時。戰鬥結束與 260 ms 關閉動畫完成後，才播放下一段地圖動作，避免演出藏在戰鬥頁後方。
- 真人與 CPU 在播放期间等待，結束後按最新權威快照恢復操作。斷線／分頁接手清除待播內容；重連、刷新直接恢復伺服器進度。保留 wire 解碼、版本守衛、玩家身份與持久存檔。
- 同一回合的例行快照保留觀看事件視窗；換回合、移動、戰鬥或新事件仍切換畫面。

## 檔案

- 執行：public/js/board_game.js、board_battle.js、新增 board_remote_playback.js；public/board_game.html、board_battle.html 更新載入 query。
- QA：scripts/board_remote_playback_qa.js、board_battle_spectator_playback_qa.js、board_spectator_playback_browser_qa.js。原 board_reconnect_client_qa.js 補齊 mock Socket 的 connected/id，符合現行 JOIN guard；第一次舊 fixture 在 JOIN 前 timeout 的結果未列為通過。
- DEV_WORKFLOW、PROJECT_OVERVIEW、GAME_RULES、FILE_MAP 同步。不改卡牌、素材、Socket.IO event 名稱、數值、資料 id、localStorage key 或持久 gameState 欄位。
- 發布清單 config/desktop-program-packages-v1.json 加入新播放模組，Board 程式由 36 增至 37 檔；以來源提交重建 v3 catalog/manifest，先驗證新增 immutable blobs，再推正式 main。Card/Chess package 與既有 ranks 差異排除。

## 驗證

- 本機 PORT=18919 npm start 成功，使用既有外部依賴，沒有修改 node_modules。未設 DATABASE_URL，未測正式帳號／資料庫。
- 確定性測試：地圖佇列 13 checks、戰鬥佇列 41 checks、原 wire codec 611 checks／278 patches；JS 語法通過。
- lan_refresh_flow_qa.js：兩頁建房、加入、開始、交棒、刷新身份、待續戰鬥 PASS；0 failures/errors，觀看端 3 次 delta、0 recoveries。
- board_reconnect_client_qa.js：修正 mock 後，斷線保留結算、42→43 補傳及過期交易／戰鬥快照拒絕 PASS。
- 新 Chrome 双頁測試使用正式 UI／真 Socket.IO 與明確 fixture；原始重現第一骰在約 6 ms 被第二骰蓋掉，逐格只有約 1／8 ms。候選骰面約 3 秒、移動約 320 ms；另測慢 iframe 的 FIFO、可見後計時、結算後回地圖、真人交棒前後控制權與手機橫向畫面。最終結果和截圖在 D:\Codex_QA\board-spectator-playback-20260919，以最終報告為準。

本機受控測試不等於真人跨網路對局、自然通關、所有技能或正式部署驗收。

## 最終雙頁結果

最終房間 B6886，result.json 的 failures/errors 均為空。地圖兩骰各展示 3010／3122 ms，移動間隔 320／329 ms；慢載入戰鬥依骰子→攻擊順序播放 1799／2176 ms。兩份實際 notifyBattleWindow 事件為 32093／32140 bytes，均低於既有上限。

戰鬥終止快照等待最後一招，退場完成後地圖骰子才開始（open=false、closing=false、battle active=false）。伺服器接受交棒後，觀看端在佇列期間拒絕有效 luffy_pistol 指令，排隊完成後恢復 canControl/canAct。桌機 1280×720、手機橫向 844×390 截圖可見完整骰面、人物與觀看提示；390×844 直向維持原旋轉裝置提示。

證據目錄的 file-hashes.json 記錄六個受驗檔案，最終 board_game.js SHA-256 為 210bfe489ff7a593106e4db48df754630b03052c946fc9f4de3e43adadcf5cc1。早期失敗包含 iframe 先播最新招式、入場前開始計時及地圖提前 260 ms 在退場動畫後播放，均已修正後重新驗證；不能把中間失敗紀錄当作最終通過。
