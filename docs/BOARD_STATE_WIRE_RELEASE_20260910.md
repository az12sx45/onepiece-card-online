# Board 省流量版發布紀錄（2026-09-10）

## 發布狀態

使用者已授權發布。發行分支為 `codex/board-state-wire-v1`，目錄 `D:\Codex_Release_Worktrees\board-state-wire-v1`，由遠端 main `9fee7f7fe1b68387011eb4961c0a29c5c95cc502` 建立。此紀錄目前為部署前候選，尚未確認線上新版生效；完成時補上正式 commit／package 及 GET 證據。

- 程式 commit：`e88f8741`。
- 新 Board package：`package-0f7755bca2f64ff4`；manifest SHA-256：`9ddb9b90c4e7ddbf3183cc25de503ecade57a0924c5125d079d4f3b473bf1149`。
- manifest：`public/desktop/manifests/board-package-0f7755bca2f64ff4.json`，3,487 檔、1,284,470,447 bytes、36 份程式。相對舊完整包只需取得 13 個新 blob／5,334,946 bytes。
- Card `package-ca025698d8851a35`、Chess `package-cdab9e869c05f12d` 保持原有 metadata／manifest bytes。
- R2 已逐一驗證 3,170 unique blobs，新增 13、沿用 3,157，沒有覆寫舊 key。公開 URL 的 13 個新檔完整 GET／size／SHA 全符；10 HTML 確認 binary／no-transform。

## 改動

- 前端完整上傳、server 完整權威快取／權限／CAS 保留；新 client opt-in `board-copy-v1`，完整 JSON 以區塊引用節省重複下載；舊版、初次、重連與錯誤恢復用 full。
- Board 10 份 HTML 加單一固定版本註解以建立全新 content-addressed keys。其餘 DOM、路徑、程式行為不因註解改變。
- 新 HTML R2 object 以 `application/octet-stream`／`no-transform` 供下載；manifest 保持 `text/html`，已驗證的本機 runtime 仍正常當網頁執行。採新 key 避免舊 Cloudflare 快取，舊 objects／manifest 不覆寫。
- 新增 wire／receiver 兩份 JS，Board program 白名單 34→36。Card／Chess 套件、launcher 1.1.6 binary、其他未發布的遊戲與圖片修改不在本次發布中。

## 驗證紀錄

- 發行樹 `PORT=18890 npm start` 通過；本機未設資料庫，只測記憶體房間。
- codec 823 checks；四連線 13 類、17 有效版本；雙 Chromium context 建房／加入／開始／交棒／刷新／待續戰鬥恢復，3 次差異解碼、0 page errors。
- publisher v2 與 v3 回歸通過：新 binary profile、舊 metadata 精準相容、manifest MIME 保留、size／SHA／未知 metadata 拒絕、`IfNoneMatch:*` 與競態處理。
- package catalog QA：三款、91 份程式、340 個本機引用、0 遺漏素材引用、0 外部程式引用，legacy v2 不變，Git HEAD bytes 與決定性重建通過。實體本機 runtime identity 三款均 200／no-store，Board 為新 package；隔離 endpoint 損毀／快取 fixture 通過。
- `scripts/desktop_board_wire_update_qa.js --live-download` 使用已安裝 ASAR 的原始 1.1.6 AssetStore／runtime：13 新檔 SHA／size 全符、HTML Range 100–199 與正確 100-byte partial 206 續傳成功，10 HTML 在本機 runtime 回 text/html。15 個網路請求全部 R2，ASAR 前後 SHA 不變。這是隔離快取下載驗證，不等於玩家已按更新。
- 同腳本 `--live-download --full-upgrade` 完整升級通過：獨立快取由舊 receipt 執行原始 `installGame("board")`，真 R2 取得 13 新檔後為 `installed`／`canLaunch=true`，新 receipt／manifest 身分與 36 份程式 SHA 全符。原始 ASAR、receipt、manifest 與 3,168 個來源 blobs 事後雜湊全數不變。完整報告：`D:\Codex_QA\board-state-wire-release-20260910\legacy-1.1.6-update-gBzPs0\report.json`。
- 發布前 Render `BOARD_ROOM_LIST` 唯讀查詢列表為 0 房；此 API 不含 solo campaign，也沒有在線人數，所以不表示能證明完全無人。既有 API 無法刪除普通已開局測試房，線上不建立這類房；四人流程在本機完成。
- 量測是壓縮應用資料模型，非 Render 帳單。小改約省 99%，大幅跨存檔約省 46%。發行重跑與瀏覽器測試並行時 encode 曾約 92 ms；不宣稱固定 CPU 耗時或固定每小時流量。
- 數值與完整性證據目錄：`D:\Codex_QA\board-state-wire-release-20260910\`。

## 更新與回復

發布後玩家在啟動器下載管理更新《新世界航海錄》，重新開啟遊戲以載入新版。四人都更新才全部使用差異傳輸；舊版仍可連線但持續接收完整快照。已開啟的舊頁面需重開，不能僅依「可遊玩」文字判斷版本。

回復時優先把 server 的差異 sender 接線退回完整廣播，新 client 相容 full。若整體回復，使用上面 main 基線的匹配 HTML／JS、config、catalog；保留舊 immutable manifest 和 blobs，不操作玩家存檔。不要只回復 HTML 卻留下不符的 runtime package，否則桌面會回退網站下載。
