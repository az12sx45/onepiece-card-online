# 我的航海錄：完整紀錄與原團續玩

## 來源與發布狀態

2026-09-14 使用者授權實作及部署。從正式 main `3ac13b7bfd3324a86b7d7186d9985d7cfbd5b58f` 建立 `D:\Codex_Release_Worktrees\board-voyage-records-v1`／`codex/board-voyage-records-v1`。基線公開 Board package 為 `package-40947c7bd7fe4b29`；7 份正式入口、程式與 metadata 已核對 Git HEAD 大小和 SHA。C 槽舊開發樹不是本輪發布來源。

程式提交 `a8ae9555e60b4f365903838a84ff5d718e2b8120`，本機驗收完成。2026-09-14 22:56（Asia/Taipei）已上傳並從公開網址完整驗證 4 個新 R2 blobs，共 4,486,101 bytes。Board package 為 `package-682d04d78ff3aeba`，manifest SHA-256 為 `c1f3910abfd961cbdf686005ac336425040a20eaf5858377d5120b22061c6017`。Release `ca3a54a3c69dd4d1951bf5b37e076928dd1779bb` 已推送 main；2026-09-14 23:03（Asia/Taipei）Render 新版公開驗證通過。既有兩張 ranks 圖片的大小寫 checkout 差異不納入提交。

## 使用方式

1. 從一周目開始即可保存。遊戲中的「存檔」保存已同步的整場世界，包括全部玩家、船員、道具、任務、地圖、回合及待續戰鬥。
2. 出航入口 →「繼續航海」→「我的航海錄」列出目前帳號有權使用的紀錄。卡片顯示名稱、成員、周目、回合、保存時間與版本，可重新命名。
3. 單人成員紀錄直接繼續；共同紀錄開啟原團等待室。其他成員從同一份紀錄加入，全部原真人加入且準備後才開始，原生 CPU 席位保留。
4. 「另存個人副本」建立新的私人紀錄，其他原玩家角色由 CPU 代管。副本的任務、獎勵與事件不會合併回原團。交易或切磋須先由原團完成，才能另存個人副本，避免互動對象轉 CPU 後失去操作入口。合作邀請仍沿用既有 CPU 加入／略過控制。
5. 自動保存保留最近 5 個自動備份，另保留最近一次手動保存。從指定備份續玩會建立個人副本，原共同紀錄仍存在。
6. 舊版共有紀錄及個人分流保留。舊本機存檔或已知原房號雲端存檔只能明確匯入為個人新紀錄；伺服器驗證帳號出現在存檔內。`RECOVERED` 共用備份不再自動選取，原始舊檔不刪除。

## 保存與同步界線

- 沿用 `BOARD_CAMPAIGN_LIST`、`BOARD_CAMPAIGN_OPEN`、`BOARD_CAMPAIGN_SAVE`、`BOARD_CAMPAIGN_SAVED`、`BOARD_GAME_STATE`。campaign／存檔外層版本為 2，遊戲 state、角色及道具 id 保留。
- 原團保存一份完整 snapshot；不再從成員 branchRecords 拼裝人物或 OR 合併不同世界旗標。v1 分流只有明確另存才建立新紀錄。
- 正式身份由同一 Socket 的 `SOCIAL_AUTH` 驗證結果決定，client 提供的 userId 不能擴張權限。一般房間及同步控制同樣使用已驗證身份。本機無 DB 的 loopback 預覽不等於正式帳號驗證。
- 保存使用伺服器已接受的 room snapshot，檢查 room `baseVersion` 及 campaign `expectedRevision`；PostgreSQL 寫入亦有 revision 比對。別的房間存入新版後，舊房間不能覆蓋它。
- 本機保存 key 保留 `onepiece-board-manual-save-v1` 前綴，依帳號與 campaign／房間隔離。雲端舊 `/api/board-save/:roomCode` 無驗證共享介面關閉；舊資料只走已驗證明確匯入。

## 驗證

第一輪本機 Chrome 3 個隔離 contexts 的完整 browser QA 通過 20 checks／0 page 或 console errors，產物在 `D:/Codex_QA/board-voyage-records-20260914/browser/mu1cpaq3/`。涵蓋一周目同隊清單、他隊不可讀取、非行動隊員本機 999 回合仍保存 server 第 8 回合、名稱同步、全員準備與再集合、完整船員／金幣／道具／地圖／seed／待續戰鬥恢復、雙端戰鬥 iframe 與刷新身份、個人副本第 23 回合不改原團第 9 回合、指定備份新 ID 和第二隊獨立紀錄。桌機及 390px 手機截圖已檢視，無橫向溢出。

固定狀態由既有 debug API 設定，戰鬥用正式 startBattle 產生後設為 pending；這不是自然通關測試。自動備份的 handler 已透過真 Socket 保存，計時器另行定向驗證。先前兩輪因測試 fixture 遺留 iframe／runner 重新讀列表收合 details 中止，原失敗產物保留。

最後版 `scripts/board_voyage_records_server_qa.js` 通過 104 assertions：真 HTTP／Socket.IO 和隔離 mock PostgreSQL 驗證正式 auth 分支、偽造帳號拒絕、完整快照、CAS、5 次 auto＋最近 manual、交易／切磋副本保護、帳號 SQL 篩選、舊版固定 migration ID／branch 保留與原房號匯入。

最終 20 項 browser 重跑通過，報告 `D:/Codex_QA/board-voyage-records-20260914/browser-final/report.json`。既有 `scripts/lan_refresh_flow_qa.js` 亦通過雙端建房／加入／開始／交棒／刷新與戰鬥恢复，guest 3 次 delta 解碼、0 recoveries、0 errors。

`scripts/board_voyage_records_auth_browser_qa.js` 通過 11 checks／0 errors：三個隔離固定帳號走正式 PROFILE_GET／SOCIAL_AUTH；10 次 auth 實際延遲 402–452ms，5 次新局／刷新／集合的 JOIN 全在 auth ACK 後發送，並驗證正式身份下的共同保存、他帳號隔離與原團恢復。報告 `D:/Codex_QA/board-voyage-records-20260914/auth-browser/mu1cvkm2/report.json`。前端定向 VM 48 assertions 全通過：24 項本機 scope／同步 ACK、14 項 auth capability 與 10 項 auto checkpoint 節流；報告在 `D:/Codex_QA/board-voyage-records-20260914/frontend/frontend-vm-result.json`。

JS 語法與辨識 CRLF 的 diff 空白檢查通過；保留原檔未修改行的混合換行。所有 QA 使用隔離資料，不能將 mock PostgreSQL 或 fixture 視為正式真人存檔驗收。

## 發布與回復

提交明確程式白名單後，`scripts/build_desktop_program_catalog.js` 從 Git HEAD 重建 Board v3 manifest／catalog；新 immutable blobs 以既有 R2 publisher 發布、核對公開 GET 大小與 SHA，再推 matching 程式與 metadata 至 main。Card／Chess package、舊 manifests／blobs 與 launcher installer 保持原值。

發布後核對三款 runtime identity、Board metadata 及全部 Board 程式公開 bytes。桌面玩家需下載 Board 更新並重新開啟遊戲。回退不得刪除 v2 紀錄，也不得重新開啟舊共享 RECOVERED 路徑；應保留存檔模組並針對故障功能修正，避免舊版按個人分流格式覆蓋新資料。

## 桌面增量發布證據

`build_desktop_program_catalog.js` 與 `desktop_program_catalog_qa.js` 通過：全部 91 份程式、340 references、0 unresolved media／external references、Git HEAD source bytes 一致。既有 `desktop_r2_program_publish_qa.js` 通過 immutable／metadata／條件寫入驗證。新 Board 清單保持 3,487 個檔案、36 份程式；Card／Chess package 和其餘 3,483 個 Board 邏輯檔案與 baseline 相同。

本輪採固定來源 commit、package、manifest SHA 與 4 條 path／SHA／size／MIME 白名單的外部 delta wrapper，呼叫未修改的 `loadPublishInventory` 與 `publishInventory`。dry-run 4/4、實際上傳 `uploaded=4`／`skipped=0`／`skippedRace=0`；原 3,166 個既有 unique blobs 未重傳或重新全量驗證。先前 full dry-run 為耗時手動中止，不列為通過。R2 公開 GET 4/4 大小和 SHA 完全符合，HTML metadata 經既有 publisher 的 no-transform／binary 規則檢查。

證據：`D:/Codex_QA/board-voyage-records-20260914/release/delta-live-1789397773382.json`、`r2-verify.json`；操作 helper 與 DPAPI wrapper 在同目錄，沒有把認證資料寫入專案。桌面若已完整下載上一包，新增內容為 4,486,101 bytes（約 4.49 MB）；需更新 Board 後重新開啟。

## 正式上線結果

2026-09-14 23:03:03.647（Asia/Taipei）首次觀測正式 Board `package-682d04d78ff3aeba`；23:03:07.316 完成 `board_voyage_records_release_verify.js`：40 checks／45 次 HTTP 回應，health 1、三款 runtime identity 200／no-store、4 份 catalog／manifest、36 份 Board 程式大小／SHA 及 HTML MIME 全通過，舊 `GET /api/board-save/RECOVERED` 為 410。共接收 9,728,191 body bytes，證據為 `D:/Codex_QA/board-voyage-records-20260914/release/live-verify.json`。正式入口：`https://onepiece-card-online.onrender.com/board_start.html?view=campaigns`。

23:03:52.562 額外完成唯讀正式權限檢查：`/api/board-runtime` 表示 DB 已啟用；未登入 Socket 送 `BOARD_CAMPAIGN_LIST {}` 得到 `{ok:false,error:"auth_required"}`，沒有紀錄資料。證據 `release/live-unauth-1789398232562.json`。上述公開驗證未建立或修改正式帳號、房間、真人存檔；完整登入／續玩功能驗收是本機隔離 fixture 證據。

本輪本機 QA 18914 listener（PID 18460）已核對後停止。C 槽四份專案文件同步正式來源與完成狀態；文件補記使用 `[skip render]`，避免再觸發伺服器重啟。
