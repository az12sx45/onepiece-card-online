# 航海錄與個人頁發布（2026-09-19）

## 航海錄與 Card 個人頁已部署（2026-09-20）

正式 release `457673be30d8fdc7c38daa49ee5b10b6fd9e8cdc` 已推送 main，2026-09-20 00:06:21（Asia/Taipei）完整公開讀回通過 42 checks／43 HTTP 回應。核對 health、三款 runtime identity、catalog／三份 manifests、全部 29 份 Card 程式與五份 Board 更新程式，大小／SHA 均一致；Board／Chess 套件保留。正式 Card 為 `package-ca251af687e50daf`，Board 為 `package-7be289c0375a59c2`。

正式 URL 的個人頁 Chrome QA 通過 67 checks、0 uncaught errors；實際公開 HTML bytes 對照來源提交完全相同，桌機／手機模擬、反光／景深／靜態降級及關閉／回退皆通過。帳號與 Socket 仍為隔離 fixture，沒有寫入真實帳號；不代表真人跨網路對局或實體手機驗收。證據：`D:/Codex_QA/profile-deploy-20260919/release/live-verify-1789833981513.json`、`D:/Codex_QA/profile-deploy-20260919/live-ui/report.json` 及截圖。

舊快取本機驗證 17 checks PASS：使用 Git 原樣 SW 與新舊個人頁，其他預快取資源為空 fixture，CSP 停用個人頁腳本。實際 SW 線上導航取得新版並取代舊快取，離線重讀新版；234 次本機 GET、0 外部請求、0 page errors。證據 `D:/Codex_QA/profile-deploy-20260919/sw/report-1789833749746.json`。這是受控本機測試，不等於正式站既有使用者驗收。

網頁重新整理後使用新版；桌面啟動器下載遊戲更新後重開遊戲，Card 只需新增 153,741 bytes 的程式 blob，不需重裝啟動器。現有 SW 導航 network-first，網路失敗仍可回退舊快取。下文等待發布段落保留為操作過程紀錄。

正式入口：[新世界航海錄](https://onepiece-card-online.onrender.com/board_start.html)、[偉大航道爭霸戰個人頁](https://onepiece-card-online.onrender.com/profile.html)。

## 正式來源與範圍

使用者要求部署目前更新的《新世界航海錄》及《偉大航道爭霸戰》個人頁。正式來源為 `D:/Codex_Release_Worktrees/board-voyage-records-v1`，本次基線 `b70e2e104a0cb286bdbd33fa90da085c263a2f54`。

航海錄觀看動作修正已在正式服務生效；2026-09-19 23:54:33（Asia/Taipei）重新完整讀回，`board_spectator_release_verify.js` 通過 41 checks，Board 為 `package-7be289c0375a59c2`。證據：`D:/Codex_QA/profile-deploy-20260919/board-before/live-verify.json`。該結果核對 health、三款 runtime identity、catalog／manifest、37 份 Board 程式 SHA／size，以及舊存檔端點關閉；不冒充新一輪真人連線遊玩驗收。

個人頁僅合併 C 樹 `artifacts/profile-card-finish-20260919/profile.before.html` 到 `public/profile.html` 的卡片放大視窗差異，保留 D 樹新版 cursor query、本地 Socket.IO vendor 與其他正式內容。使用既有 Card Finish／Depth visible V2；一般豪華卡反光、強化卡 foil、桌機人物景深，觸控／reduced-motion 靜態顯示。保留懸賞令獨立靜態預覽、原圖與失敗回退，新增關閉按鈕、焦點管理及視窗尺寸限制。

不包含 Card 對戰排版示範、索隆深度示範、歷史 C 樹 Board 程式、既有 ranks 大小寫差異。沒有改遊戲規則、帳號資料、存檔、Socket event 或後端。

## 本機驗證

- `PORT=18929 npm start` 使用既有外部依賴啟動成功，未修改 node_modules；沒有 DATABASE_URL，帳號由隔離 fixture 驗證畫面。
- QA 重用原個人頁 runner，輸出至 `D:/Codex_QA/profile-deploy-20260919`，sourcePath 指向正式 D 樹，並先攔截本地 vendor／既有 socket script，避免真實帳號連線。保留 C 樹原測試證據。
- 61 checks PASS、0 uncaught page errors；涵蓋一般／強化收藏點擊、景深、傾斜、切換與清理、按鈕／Escape／遮罩關閉、懸賞令、原图與分層失敗回退、手機直橫向及 reduced-motion。桌機與手機模擬截圖已檢視，不等於實體手機或真實帳號驗收。
- 檔案及 Git blob SHA-256 均為 `bc60257f14ed68281315f9e8bada222519ac4eb7aef0c9f44bb5708dfbc6a7c6`；profile 沿用混合換行，發布直接核對指定提交的實際 bytes。`git -c core.whitespace=cr-at-eol diff --check` 通過；反向移除四個 scoped 區塊後與原正式頁內容相同。

## 發布方式

scoped 程式與文件提交後，從 Git HEAD 建置 v3 desktop catalog／manifest。僅更新 Card 的 profile.html immutable blob；Board／Chess 與舊 manifest 保留。

先 dry-run、上傳新增 blob、公開 GET 核對大小／SHA，之後推送 matching 程式與 metadata。成功必須以正式 runtime、程式與 manifest 讀回確認，不能只用 Git push 作完成證據。正式 Card package 與發布結果於完成後補記。

回復時使用本次基線 profile.html 與 catalog，保留不可變歷史 manifest／blob，不回退已生效的 Board 修正。

## 個人頁發布準備結果

來源提交 `0242bd83f6a1695e2c5b7bf650e92cb80227f162`；Card `package-ca251af687e50daf`，manifest SHA-256 `a112d313b2ed51ef1b7e1362c15f26b3b6b6b64287d4516abf6870846954c5cc`。套件仍為 739 個檔案；只有 profile.html 更新，新增下載 153,741 bytes。

catalog QA 全部通過：三款遊戲共 92 份程式、343 個引用，Git HEAD／runtime／deterministic build 核對通過，legacy v2 不變。單檔 immutable dry-run、R2 上傳 1/1 及公開 GET 的 bytes／SHA／no-transform metadata 核對通過；證據位於外部 release 子目錄。Board／Chess 套件完全保留。接下來推送正式 main，等待 Render 切換並核對公開頁面。
