# 桌面版入口與流量分流

日期：2026-09-22。正式來源：`D:\Codex_Release_Worktrees\board-voyage-records-v1`。使用者同意「保留下載頁、遊戲限桌面版，並部署」。本次只調整共用 server 的入口及素材傳輸，涵蓋航海錄、卡牌與霸海戰棋。

## 行為

- `/`、`/download` 顯示約 11 KB 的三遊戲下載入口，沒有外部字型、圖片或配樂；只再讀取小型 launcher-release metadata。Windows 安裝檔仍直接來自 R2，1.1.7 無需重裝。
- 一般瀏覽器的舊遊戲 HTML 回零 body 的 302 到 `/download`；JS、CSS、WASM 等遊戲程式回 403，遊戲 Socket.IO 握手拒絕。URL 的 `desktop=1`、Referer 等均不授權。
- 既有 Electron renderer 依預設 UA 相容辨認。這是正常客戶端入口限制，不是不可偽造的裝置認證。原帳號與房間控制權驗證保持，已取得的離線程式不可遠端收回。
- Node 主程序不依賴代理可能補上的 UA，沒有 Origin／Fetch Metadata 的連線只允許 14 個既有登入、註冊、個人檔案、好友及私訊事件；遊戲事件另在 packet middleware 拒絕。帶瀏覽器 Origin／Fetch Metadata 的普通連線拒絕握手，真 renderer 正常使用三遊戲事件。
- `/health`、`/api/*`、catalog／package manifest／launcher metadata 保持服務。所有 v3 manifests 驗 SHA 後建立 6,192 個唯一媒體路徑，請求只回 R2 SHA blob 302、不傳素材 body。未列名媒體 404，R2 失敗不再由 Render 傳同一素材備援。
- 觸控 Windows 筆電的 `images/board/mobile/manifest-v397.json` 為唯一 images 下的小型 JSON 例外，僅 Electron 可讀。
- 舊 `/sw.js` 對一般瀏覽器提供退役 worker：更新啟用後解除註冊並轉下載頁。保留 localStorage、IndexedDB、CacheStorage，並不自動搬移僅存在舊瀏覽器的存檔；既有雲端紀錄仍走原帳號服務。已開啟且離線的舊頁面不能即時撤回。
- `OP_DESKTOP_ONLY=0` 是伺服器環境回復開關，預設啟用限制；不能由 query 或客戶端更改。

## 套件與保護

Board `package-41425d61d6f49184`、Card `package-ca251af687e50daf`、Chess `package-d37cd9a585600687` 維持。Launcher 1.1.7、所有 catalog 與遊戲 manifest 均未改動。本次新增頁面僅供網站下載，不加入已簽發遊戲程式集合。

Git HEAD 與三個 manifest 逐一核對：Card 29、Board 43、Chess 23 個程式 SHA 完全一致。Windows 工作樹 `core.autocrlf=true`，本機 runtime API 的逐 byte 驗證會回 program digest mismatch；不改正式程式去迎合本機換行，公開 Linux runtime 與 bytes 必須另驗。

開始前記錄 30 份保護檔共 37,661,647 bytes：24 份正式 server/data、兩張既有 rank 修改、catalog-v2/v3、launcher release 與本機已安裝 Board receipt。保留既有未提交 ranks 與 sea_event_reveal/v1，不納入提交。本機 npm 18927 透過 opt-in preload 將所有存檔 I/O 導入 `D:/Codex_QA/desktop-only-20260922/isolated-data` 並停用資料庫。

## 驗證與部署紀錄

證據根目錄：`D:/Codex_QA/desktop-only-20260922`。

| 驗證 | 結果與證據 |
| --- | --- |
| 真 HTTP／Socket.IO fixtures | 135/135，`gate/desktop-distribution-gate-report.json`；包含任意 proxy UA／瀏覽器 UA 的 originless main 白名單與遊戲拒絕、Origin／Fetch Metadata 拒絕、兩種 transport、媒體、metadata、編碼與 worker |
| Chrome 下載頁與 worker | 38/38，`browser-report.json`；1366／390／320px、每頁兩請求合計 11,074 bytes；真 worker 更新後保留三種 storage 哨兵 |
| 真 Electron 44／既有 AuthService | 66/66、errors 0，`D:/Codex_QA/desktop-distribution-20260922/electron/desktop-distribution-electron-report.json`；實際登入／註冊／restore 類別使用隔離 fixture，沒有正式帳號操作 |
| 既有 Electron program protocol | PASS，同上目錄 `program-stdout.log`；HTML/CSS/JS/worker/WASM/image 本機讀取，API 保持 network；程式 cache 停用後 media 仍走 opcache |
| 三套件 Git 程式來源 | Card 29、Board 43、Chess 23 SHA 全符合 manifest；正式 Linux 三 runtime API 在部署前均 200，版本維持 |
| 保護檔 | `protected-baseline.json`／`protected-after.json`，30/30 SHA 不變 |

來源提交為 `c87d4954d71e80acbc08a616056a28a4d6779885`。使用者登入 Cloudflare 後已完成 CORS 修復，部署前 LAN 與分流檢查均通過，公開生效仍需另驗。

初次雙頁 LAN 的房間、加入、開始、交棒、刷新、續戰與 delta wire 均成功；console 發現 R2 未回 CORS，使跨網域音效 fetch 和字型被擋。此為 redirect 整合必須修復的問題，保留首輪報告，修正後重新完整執行。

R2 原有公開素材的跨來源讀取遵循 [Cloudflare CORS 文件](https://developers.cloudflare.com/r2/buckets/cors/)，僅開 GET／HEAD 與 Range 讀取，不允許上傳或修改；如有既存規則須保留。配置前後與 public Range/CORS 證據另存 QA 目錄。

既有 DPAPI publisher key 的 `GetBucketCors` 回 403 AccessDenied，未執行任何 Put、更未覆寫未知設定。`r2-cors/cors-error.json` 保存去敏證據。使用者完成 Cloudflare 登入後，控制台確認原本無 CORS 規則；新增 public read-only `AllowedOrigins: [*]`、`AllowedMethods: [GET, HEAD]`、`AllowedHeaders: [Range]`、ExposeHeaders 為 Content-Length／Content-Range／ETag／Accept-Ranges、MaxAgeSeconds 3600。未改憑證、物件或寫入權限。

OPTIONS 立即生效，舊 CDN HIT 回應仍缺標頭，因此僅針對 `game-assets.rihdi.tw` 做 hostname purge；未清除其他網站的快取。其後 canonical 公開網址的 image/audio/font × 三個 Origin × HEAD/Range/OPTIONS **27/27 PASS**，只讀 576 bytes 媒體。證據：`r2-cors/dashboard-change.json`、`hostname-purge.json`、`public-cors-after-purge.json`。

修復後完整雙頁 LAN **PASS、failures/errors 均空**，涵蓋建房／加入／開始／回合交棒／刷新身份／續戰／delta wire；證據 `lan-refresh-after-cors.json`。本機分流 verifier **131/131 PASS**，含 90 個去重程式 HTTP、七個媒體樣本 R2 302 零 body、分段 MIME/CORS、安裝檔可用，證據 `local-release-after-purge.json`。三套件 95 logical 程式以 Git HEAD 逐 SHA 核對也全過，另存 `program-git-sha.json`。

公開 verifier 的 WebSocket 拒絕斷言更正：Engine.IO 對拒絕的 HTTP Upgrade 回 400 與精確字串 `desktop_required`，而 polling 回 403。現在同時要求沒有 101 upgrade、拒絕狀態及精確原因，不能把任意 400 當成功。真請求與六個判定案例見 `websocket-rejection-probe.json`。

CORS 後重啟獨立 Electron QA 時自動審核拒絕該程式啟動，原因僅為 `blocked by policy`；沒有換殼重試以繞過。先前的真 Electron 66/66 結果仍保留，新增的 CORS 原生解碼改透過內建 Chromium 與 loopback fixture 驗證，不宣稱 Electron 69/69。

內建 Chromium 最終 **3/3 PASS**：三個未加 cache-bust 的 R2 正式網址跨域 fetch、逐 SHA／size 核對，圖片 `createImageBitmap`、音效 `decodeAudioData`、字型 `FontFace.load` 均成功；讀取合計 77,094 bytes。證據 `cors-browser/chromium-cors-report.json`，不操作正式帳號與房間。全部部署前必要檢查完成，接續推送與公開驗收。

## 公開代理相容修正

首次發布 `e999374e639e6bc40bf3bea9cbd1885890b79f58` 於 2026-09-22 01:20:07（台北）上線，公開 release 134/134、三尺寸瀏覽器 38/38 均通過，但補驗實際預設 Node Socket.IO 發現無自訂標頭的主程序 WebSocket 回 `desktop_required`；polling 及 Electron renderer 兩種 transport 正常。另以 raw Upgrade 驗證：無 UA 被拒、明確 node UA 成功。推測代理補入 UA；未取得代理內部標頭，不當成已觀測事實。

為維持下載版連線，01:27:33 完成回復 `9e0744d92b8047e9e4b8be9261508bc1eba51689`（Render `dep-daomh40ae00c73c51vig`）。修正 `isLauncherProcess` 改依 Origin／Fetch Metadata 判別相容主程序，不依賴 UA 值；14 事件白名單、所有遊戲 packet 拒絕與原帳號驗證均維持。新增公開 Socket verifier，直接使用舊啟動器相同預設 client headers，防止本機測試漏掉正式代理差異。首次失敗證據 `public-socket-report.json` 保留；修正版必須重新公開驗收後才算完成部署。

## 最終上線與驗收

修正版 `4916d0a8a69cf41af2194b4faf0ed0ce970937a8` 於 **2026-09-22 01:39:00（台北）**正式上線，Render `dep-daomkp7f3r2c73d94qtg` 顯示 Live，資料庫連線及 Board PostgreSQL ready。回復動作自動關閉的 Auto-Deploy 已恢復 On Commit，本次修正以 Manual Deploy latest commit 發布。

- `public-socket-final-verified.json`：**10/10 PASS**。預設無自訂標頭 launcher main、Electron UA renderer 的 WebSocket／polling 全可連；main 兩種 transport 的唯讀 `BOARD_ROOM_LIST` 都回 `desktop_required`；普通 Origin／Fetch Metadata 連線均明確拒絕。這是真 Node 公開代理連線測試，非正式帳號登入或真人多人遊玩。
- `public-release-final.json`：**134/134 PASS**，2026-09-22 01:40:25（台北）。三套件 runtime identity 與 manifest 正確，90 個去重程式全驗公開 bytes/SHA；普通 HTML 302、程式 403、素材 R2 302 零 body、Range/CORS、安裝檔 HEAD 可用。一次完整校驗讀取 24,782,807 bytes，不代表玩家每局流量。
- `public-browser-final/browser-report.json`：**38/38 PASS、0 errors**。1366／390／320px，下載頁每次兩請求、合計 11,074 bytes；worker 退役保留三種儲存。測試瀏覽器與 loopback fixture 均正常關閉。
- `protected-final.json`：**30/30** 檔案 SHA／大小不變，共 37,661,647 bytes；三套遊戲 package、launcher 1.1.7 及既有未提交素材維持。

Socket verifier 首次執行因清理使用不存在的 `socket.io.close` 中止；當時 main WebSocket 已連線且遊戲拒絕兩項均過。移除該呼叫，沿用每例 forceNew socket 的 `disconnect()` 清理後，完整 10 項通過；`public-socket-final.json` 保留工具失敗紀錄。此為 QA 修正，不需要重部署產品。收尾文件與 QA 清理修正使用 `[skip render]` 提交。
