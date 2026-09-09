# 航海錄多人同步省流量版（2026-09-10）

## 狀態與適用範圍

本文件保存本機設計與 QA 基線。使用者已於 2026-09-10 授權上線，正式發行使用 `D:\Codex_Release_Worktrees\board-state-wire-v1` 的隔離分支；發布身分、進度與線上證據以 `BOARD_STATE_WIRE_RELEASE_20260910.md` 為準。更新前完整包為 `package-68ec6b205918f818`，其程式來源已核對為 `D:\Codex_Release_Worktrees\battle-chess-launcher-v1`。同樣的傳輸改動亦精準回植至 C 槽 Board 開發主樹，保留兩樹其他差異。

前端仍產生完整 `BOARD_GAME_STATE.payload` 上傳，server 仍執行原身份、控制權、baseVersion CAS、設定保留與完整快照快取。只改 server 向支援新版的接收端傳送資料的方式；遊戲規則、state 欄位、角色／道具 id、存檔格式、localStorage key、Socket.IO event 名稱都沿用原值。

## 傳輸方式與恢復

- 新頁面在 `BOARD_JOIN_GAME` 加 `stateEncoding: "board-copy-v1"`；未宣告的舊頁面始終收到原完整快照。新版頁面連到舊伺服器時也接受原完整快照。
- `server/board-state-wire.js` 以每個 socket 的弱引用保留最後**送給該接收端**的 JSON、房號、版本。發送者的 ACK 不代表收到快照，不推進接收基準。
- `public/js/board_state_wire.js` 從上一份 JSON 建立 256 個 UTF-16 字元的區塊索引。新版封包仍使用 `BOARD_GAME_STATE`，帶 `encoding`、`baseVersion`、`patch`；patch 是字串片段與 `[起點, 長度]` 複製範圍。解碼後是完整原始 JSON，再交原套用流程。
- 編碼後 UTF-8 JSON 封包至少小 20% 才採用，否則回傳完整快照；原 WebSocket per-message-deflate 壓縮繼續存在。這個門檻不代表每包壓縮後都保證省 20%，實際比例另行量測。
- codec 設 30 MiB 文字／UTF-8 上限、8192 chunks、複製範圍／長度／雙 32-bit checksum 檢查與編碼工作量上限。checksum 用來發現損壞，不取代連線認證。
- `public/js/board_state_receiver.js` 在遊戲正規化／動畫延後／版本篩選前保存不可變 JSON 基準，因此遊戲修改物件、延後套用或忽略自己的狀態都不會污染下個解碼基準。
- 初次接收、重新 JOIN、`BOARD_STATE_REQUEST` 都走完整資料。基準或 checksum 錯誤時，接收端丟棄損壞封包並透過原 `BOARD_STATE_REQUEST` 補回完整資料；補回前不套用後續差異。斷線與重連清除傳輸基準，原 pending state 恢復流程保留。
- baseline 只存在記憶體，不進房間存檔。以目前單一 server 的 Socket.IO room adapter 廣播；若日後改多程序／跨主機 adapter，需另行設計各節點的傳輸基準。

Socket.IO 保證同一連線訊息順序，但不保證斷線期間送達，所以重連必須重新建立完整基準，參見 [官方 delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/)。Render 的 HTTP 與 WebSocket 回應均計入出站用量，參見 [官方 outbound bandwidth](https://render.com/docs/outbound-bandwidth)。

## 量測結果與界線

量測使用目前 WebSocket 壓縮參數 `level=6, memLevel=7`，獨立 `Z_SYNC_FLUSH` 並移除 WebSocket 壓縮尾碼，比較含 Socket.IO event envelope 的應用資料。這不是網卡封包、真人長時間對局或 Render 帳單實測，未包含 TCP/TLS、HTTP、握手及其他事件。

71 份含四個角色紀錄的歷史存檔只讀載入；多數並非四位真人。先在記憶體套現行 `log.slice(-500)`、`boardUiEvent=null`，再模擬變動，原存檔不變：

| 情境 | 原完整傳輸 | 新傳輸 | 減量 |
| --- | ---: | ---: | ---: |
| 71 份小改回合／目前玩家／時間 | 5,914,534 B | 18,146 B | 99.69% |
| 71 份 500 筆紀錄移位與追加 | 5,783,327 B | 23,553 B | 99.59% |
| 70 對不同歷史存檔的大幅替換 | 5,796,075 B | 3,108,970 B | 46.36% |

小改每次每位接收端由 50,936–121,496 B 降至 251–258 B。這只代表指定小改，不能直接乘成「四人每小時固定用量」，也不能假設戰鬥每次都如此。歷史案例 encode 最大約 39 ms；新增 JSON 基準也使用 CPU／記憶體，尚無多房間壓力測試。

四個真 Socket.IO 連線的固定測試資料：四位全部切為新版後，5 次更新共 15 次差異廣播精確還原；壓縮模型 1,360,629 B → 6,309 B，減少 99.54%。整組測試刻意加入舊版、初始完整包、交棒、損壞恢復，共 17 次有效版本，其數字不能拿來推算真人行為頻率。

## 已完成驗證

- `scripts/board_state_wire_qa.js`：823 checks，Unicode／插入刪除／陣列移位 fuzz、無效 patch、大小與範圍限制、browser 匯出、接收基準隔離、舊伺服器完整包與恢復。以上量測案例均無壓縮後膨脹。
- `scripts/board_state_wire_integration_qa.js`：4 個真 Socket.IO clients，13 類檢查；建房／加入／準備／開始、精確 roundtrip、交棒、新舊共存、設定保留、未授權／過期版本／無效 payload 拒絕、損壞回補、跨房隔離、重新 JOIN opt-in/out、重連及全新版持續更新。
- `scripts/lan_refresh_flow_qa.js`：2 個隔離 Chromium contexts 建房、加入、開始、玩家刷新身份、回合交棒、待續戰鬥恢復到兩邊 overlay；確認實際瀏覽器解碼 3 次 delta、0 次資料恢復錯誤，無 page errors。新增 wire status 斷言，避免只測到舊 full 路徑。
- `scripts/board_reconnect_client_qa.js`：同版本舊快照不能覆蓋本機 pending、斷線後 pending 上傳、stale trade／battle 不回退。測試 fixture 原只攔 `/socket.io/socket.io.js`，已補目前 vendor URL（含 query）；修正 fixture 後 PASS。
- D 樹 `PORT=18888 npm start` 與 Board 頁面可用；C 樹 `PORT=18889 npm start`、入口與新 JS HTTP 200、同一 4-client integration 13 類／17 有效版本及 codec 823 checks 亦通過。資料庫未設定的既有警告屬本機限制；此輪不使用正式帳號、不連正式房間、不寫真存檔。
- 各變更 JS 語法、精準 diff 與獨立唯讀 review 通過。測試後停止本輪本機服務。

本機數值與回植記錄在 `D:\Codex_QA\board-state-wire-20260910\`，其中 `codec-report.json` 保存最後正規化後的完整量測，不含真人姓名或快照內容。

重跑方式：用 Node 執行 `scripts/board_state_wire_qa.js`，可用 `BOARD_WIRE_QA_SAVE_DIR` 指向只讀歷史資料；另開本機 `npm start` 後，以 `BOARD_QA_URL` 指向 loopback 執行 integration 與 refresh flow。瀏覽器測試依環境設 `BOARD_QA_CHROME`、`BOARD_QA_PLAYWRIGHT`／`NODE_PATH`；reconnect fixture 使用 `BOARD_QA_BASE_URL`。

## 發布與回復

1. 選取本輪 Board 傳輸檔、精準 index／game.js／HTML 改動與文件，不混入既有 Card、Chess、圖片或上一輪 desktop downloader 的未發布改動。
2. D 的 `config/desktop-program-packages-v1.json` 已加入兩份新 JS 白名單。正式提交程式後，依現行從 Git HEAD 讀取正式 bytes 的 `scripts/build_desktop_program_catalog.js` 產生新 Board manifest／catalog；不改舊 immutable manifest。C 樹沒有 desktop config，不整份複製 D 設定。
3. 發布前完成新程式 blobs 的實際 GET 大小與 SHA 驗證。此前 R2 網域改寫 HTML 的問題仍需解決，不能只看 HTTP 200 或 HEAD 就切換 catalog。
4. Render 程式、config 與新 manifest／catalog 須一致，使 runtime identity 驗證成功；否則桌面會退回網站而增加 HTTP。發布後四人完成 Board「下載更新」再量 Metrics／Outbounds；遊戲程式更新本身不需修改存檔。
5. 可先停用 server 差異發送，回到原 full broadcast，保留新版 client（它也支援 full）。若回復整份客戶端，需一併恢復匹配的 package/catalog；不修改已發布 immutable blobs 或玩家存檔。

舊 `package-68ec6b205918f818` 不會自動具備省流量功能；以發布報告中的新 package 身分與更新後 receipt 為準。
