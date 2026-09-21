# 桌面版入口與流量分流

日期：2026-09-22。正式來源：`D:\Codex_Release_Worktrees\board-voyage-records-v1`。使用者同意「保留下載頁、遊戲限桌面版，並部署」。本次只調整共用 server 的入口及素材傳輸，涵蓋航海錄、卡牌與霸海戰棋。

## 行為

- `/`、`/download` 顯示約 11 KB 的三遊戲下載入口，沒有外部字型、圖片或配樂；只再讀取小型 launcher-release metadata。Windows 安裝檔仍直接來自 R2，1.1.7 無需重裝。
- 一般瀏覽器的舊遊戲 HTML 回零 body 的 302 到 `/download`；JS、CSS、WASM 等遊戲程式回 403，遊戲 Socket.IO 握手拒絕。URL 的 `desktop=1`、Referer 等均不授權。
- 既有 Electron renderer 依預設 UA 相容辨認。這是正常客戶端入口限制，不是不可偽造的裝置認證。原帳號與房間控制權驗證保持，已取得的離線程式不可遠端收回。
- Node 主程序的既有無 UA／`node`／`node-XMLHttpRequest` 連線限於登入、註冊、個人檔案、好友及私訊事件；遊戲事件另在 packet middleware 拒絕。真 renderer 正常使用三遊戲事件。
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
| 真 HTTP／Socket.IO fixtures | 119/119，`gate/desktop-distribution-gate-report.json`；Chrome、Electron、Node 三種 UA／兩種 transport、媒體、metadata、編碼與 worker |
| Chrome 下載頁與 worker | 38/38，`browser-report.json`；1366／390／320px、每頁兩請求合計 11,074 bytes；真 worker 更新後保留三種 storage 哨兵 |
| 真 Electron 44／既有 AuthService | 66/66、errors 0，`D:/Codex_QA/desktop-distribution-20260922/electron/desktop-distribution-electron-report.json`；實際登入／註冊／restore 類別使用隔離 fixture，沒有正式帳號操作 |
| 既有 Electron program protocol | PASS，同上目錄 `program-stdout.log`；HTML/CSS/JS/worker/WASM/image 本機讀取，API 保持 network；程式 cache 停用後 media 仍走 opcache |
| 三套件 Git 程式來源 | Card 29、Board 43、Chess 23 SHA 全符合 manifest；正式 Linux 三 runtime API 在部署前均 200，版本維持 |
| 保護檔 | `protected-baseline.json`／`protected-after.json`，30/30 SHA 不變 |

目前尚未推送／部署；待 R2 CORS、完整 LAN 無 console error 回歸及公开驗證後补上生效時間與 commit。

初次雙頁 LAN 的房間、加入、開始、交棒、刷新、續戰與 delta wire 均成功；console 發現 R2 未回 CORS，使跨網域音效 fetch 和字型被擋。此為 redirect 整合必須修復的問題，保留首輪報告，修正後重新完整執行。

R2 原有公開素材的跨來源讀取遵循 [Cloudflare CORS 文件](https://developers.cloudflare.com/r2/buckets/cors/)，僅開 GET／HEAD 與 Range 讀取，不允許上傳或修改；如有既存規則須保留。配置前後與 public Range/CORS 證據另存 QA 目錄。

既有 DPAPI publisher key 的 `GetBucketCors` 回 403 AccessDenied，未執行任何 Put、更未覆寫未知設定。`r2-cors/cors-error.json` 保存去敏證據；Cloudflare 控制台需要登入，已請使用者在該頁完成。一般分流及舊啟動器相容實作已可審閱，素材 fallback 的跨來源讀取修復完成前暫不推送。
