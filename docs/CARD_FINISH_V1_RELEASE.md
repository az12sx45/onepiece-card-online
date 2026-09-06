# Card Finish V1 — 獨立實作正式發布紀錄

日期：2026-09-06。使用者已授權「改成獨立實作、補完測試後再發布」。本文件取代上一輪 V458 GPL 候選的發布計畫；舊候選沒有上線。

## 正式發布完成

- 2026-09-06 19:30:48（Asia/Taipei）已由正式站直接讀到新版；Git／部署程式版本為 `986430ca300ea32bb0f06f4cdf9aba4b1a96db68`，已推送 `origin/main`。Render 內部 deploy ID 未透過控制台取得；以下以公開 bytes 與 Git blob 完全一致確認實際部署版本，不將 push 成功當成上線證據。
- 正式入口：https://onepiece-card-online.onrender.com/start.html 。對局頁：https://onepiece-card-online.onrender.com/game.html 。
- 實際公開修改只有下表三檔。2026-09-06 19:31:53 直接 HTTP 200、Content-Type 正確，且三檔皆與該提交 Git blob 逐 byte／SHA-256 相同。其餘 9 個提交檔案為 QA 腳本／文件，不是新增公開素材。
- 舊 Holo CSS、JS、NOTICE、LICENSE 的四個公開網址仍為 HTTP 404；原 GPL 來源及授權在本機保留。沒有發布比較頁、rank 圖、Board／launcher 修改、卡圖或媒體檔。
- 正式回復點為 `14d089027b8af8ee80e64f18b88a02dca20b0fb2`。需撤回時，在最新 main 對發布提交執行 `git revert 986430ca300ea32bb0f06f4cdf9aba4b1a96db68`，檢查限定差異後推送並重新驗證 Render；不 force push／reset，也不整份覆寫 game.html。
- 最後的驗收文件提交使用 `[skip render]`，只更新此紀錄與索引，不重啟已驗收的遊戲服務；依據 [Render 官方略過部署說明](https://render.com/docs/deploys#skipping-an-auto-deploy)。

| 公開檔案 | SHA-256 |
| --- | --- |
| `public/game.html` | `b1b181dcb2a4c13e0df768e2bccc875eb92142f194b18a629f984bd907e17d54` |
| `public/css/card-finish-v1.css` | `f88d6afd9dab24adaa76615af42e00ff76d7e878ea94e04e74510b209393c964` |
| `public/js/card_finish_v1.js` | `a0ada07146f7e3bb173e1f2c23cdd8c55fa0d04f4c417cbd3314aafedf8512e7` |

### 完成的驗收與界線

- 單元 `4,437`、browser fixture `172`、predeploy `93`、postdeploy `97` 項全部 PASS。新提交與回復點的原 inline 遊戲 script 完全相同（只正規化 CRLF），沒有改出牌／強化／同步的原遊戲程式。
- 正式 live 兩次真人對局均直接讀取公開 HTML／CSS／JS，三份 code route substitution 次數全部為 `0`；使用正式登入、backend、engine 和 Socket，沒有注入牌堆或模擬 Socket。
- 第一個 live 案例自然抽到青雉：drawn 出牌與目標正常，對手凍結手牌的實體點擊不送 ACTION、不改 state，合法 drawn 可送出並同步。此房沒有涵蓋 hand，報告如實為 `INCOMPLETE_NATURAL_ROUND_END`，不單獨當成 hand/drawn 全覆蓋。
- 第二個 live 案例為完整 PASS：hand 基拉、新抽 drawn 騙人布，各恰好一個 PLAY_CARD，技能目標與猜數字正常完成，對手的公開 state／棄牌／回合一致，私人手牌未洩漏；自然 disabled 數字 1 點擊被擋。兩次合併涵蓋 hand、drawn、自然冰凍禁選與 peer sync，page errors 都為 `0`。
- Console 各有 4 筆 HTTP 404 訊息；不是本次三個公開檔案（已另逐檔驗證 200／雜湊），未將此結果宣稱為全站零 404。影音映射本機相同原素材以保留演出並減少流量；另有四張代表卡圖從正式站直接下載通過 SHA 比對。
- 娜美 7+6／8 的兩種排列由 renderer fixture 驗證；沒有宣稱真人自然抽到。手機以 Chrome 觸控／視窗模擬驗收，包含 390、667、932 寬度，未宣稱實體手機驗收。
- postdeploy 已驗證乾淨 desktop／mobile／reduced-motion、四卡面接點、圖鑑開關，以及既有 `op-card-v7.5` profile 重新整理取得新程式。舊 profile 建立時有 228 筆媒體預載使用 QA 空內容節流，因此此結果只证明舊使用者的程式更新，不是全素材離線驗收；沒有為此次效果升級 SW 或強迫重載所有卡圖。
- 測試房透過自身 ROOM_FINISHED／LEAVE_ROOM 結束，測試瀏覽器已關閉；沒有保存密碼、HAR、trace，沒有完成整季排行結算，也沒有讀寫 Board 進度。

### 證據與原始來源同步

驗收產物在隔離發布樹 `D:/Codex_Release_Worktrees/card-holo-v458-release`：

- `artifacts/card-finish-v1/browser-report.json`
- `artifacts/card-finish-v1/live-release-files.json`
- `artifacts/card-finish-v1/real-candidate-2026-09-06T11-21-38-886Z.json`
- `artifacts/card-finish-v1/real-live-2026-09-06T11-31-28-593Z.json`
- `artifacts/card-finish-v1/real-live-2026-09-06T11-32-41-807Z.json`
- `artifacts/card-holo-release-v458/card-finish-predeploy-state.json`
- `artifacts/card-holo-release-v458/card-finish-postdeploy-report.json`

新獨立 CSS／JS、四個 HTML 接點、三份 QA 腳本與五份專案文件已同步回原 C 槽主來源。C 槽 game.html 的其他未發布修改保留，未整檔推上正式；正式合併版的驗收是在上述隔離樹執行。大型媒體未另行複製或重傳。

以下為發布前歷史快照；其中「尚未 push／部署」描述的是當時階段，現在狀態以本節為準。


## 發布範圍

- `public/game.html`：保留最新正式版，只改四個卡面接點、圖鑑容器 class 與兩個新資源引用。
- `public/css/card-finish-v1.css`、`public/js/card_finish_v1.js`：獨立顯示層；引用版本 `20260906-finish-v1`。
- 相關 QA 腳本與專案文件可隨 Git 留存，不是網站的新公開素材。
- 舊 `card-holo-v1.css`／`card_holo_v1.js`、Pokemon Cards CSS 的 NOTICE／LICENSE、比較頁、上游 checkout 與本機 reports **不發布**。原 GPL 檔案保留原授權，不刪除授權標頭或改標 MIT。
- 不更新套件、server、DB、原卡圖、Card／Board 規則、啟動器或其他未發布變更。

## 獨立實作的來源邊界

實作工作由未繼承舊實作上下文的獨立代理執行；只接收功能規格、原遊戲 DOM id 與新的 DOM 契約。明確禁止開啟舊特效、衍生碼或上游 checkout。從標準 CSS／PointerEvent 等 Web API 編寫新檔；不是移除原版授權文字、換變數名稱後重發。原卡圖只作遊戲原有圖像使用，不新增第三方材質。

新 DOM 契約為 `[data-card-finish="plain|foil"] > .card-finish-face > img`；選牌另有 `data-finish-context="choice"`。裝飾使用 pseudo-element，不攔截原 button 點擊。光膜依真正顯示的強化卡圖路徑切換，不改強化判定或原動畫時序。觸控／減少動態採靜態，disabled／冰凍停用視覺反應。

本紀錄說明實際開發來源邊界，不代表對所有智慧財產問題提供法律保證，也不替整個專案新增 GPL、MIT 或其他授權。

## 基準與回復

- 遠端：`https://github.com/az12sx45/onepiece-card-online.git`，正式分支 `main`。
- 正式網址：`https://onepiece-card-online.onrender.com/game.html`。
- 基準／回復 commit：`14d089027b8af8ee80e64f18b88a02dca20b0fb2`；本機回復分支 `codex/rollback-before-card-holo-v458`。
- 隔離發布樹：`D:/Codex_Release_Worktrees/card-holo-v458-release`，只明確 stage 本文件列出的檔案，不使用整樹 `git add`。
- 回復方式：針對本次實際發布 commit 作 `git revert` 後沿原流程推送，保留之後其他更新；不覆蓋整份 game.html、不 reset main，不將 C 槽歷史 before 當成正式回復來源。

## 驗收狀態

- 獨立來源審核沒有發現阻擋發布的整合問題。新版單元測試 `card_finish_unit_qa.js` 共 `4,437` 項 assertions PASS；真正瀏覽器測試 `card_finish_browser_qa.js` 共 `172` 項 PASS，page errors 為 `0`。舊特效的 38／82／51 項結果只保留作歷史紀錄，沒有拿來代替新版驗收。
- 已用兩個正式授權測試帳號正常登入，在正式 backend、engine 與 Socket 上建立隨機低暴露房號、`0 CPU` 的雙真人對局；測試瀏覽器只以 response substitution 換入候選 `game.html`、新 CSS 與新 JS，並未改正式站程式。手動驗收的權威手牌與新抽牌各完成一次 `PLAY_CARD`，每次都只提交一次，另一端的回合／棄牌狀態一致；騙人布目標數字 `1` 的 disabled 實體點擊沒有送出事件，合法數字才完成。
- `scripts/card_finish_live_qa.js` 的連續雙瀏覽器 candidate runner 已 PASS：自然抽到手牌 `16` 青雉並完成 `PICK_TARGET` 後，對手被冰凍的手牌經實體點擊沒有送 `ACTION`、權威 state 也未變；之後以新抽牌 `3` 香吉士完成 `PLAY_CARD` 與 `PICK_TARGET`。報告的 `hand`、`drawn`、`peerSync`、`finishHooks`、`naturalDisabledSeen`、`choiceDisabledBlocked` 均為 `true`，兩端 state 一致、page errors 為 `0`。同源本機影音映射保留原演出與時序。
- `card_finish_release_qa.js --phase predeploy` 共 `93` 項 PASS，涵蓋 desktop／mobile／reduced 三種模式、四份實際資源雜湊與既有 `op-card-v7.5` Service Worker profile；證據為 `artifacts/card-holo-release-v458/card-finish-predeploy-state.json`。娜美兩牌選擇的禁選仍只有 fixture 覆蓋，尚未在自然真人對局遇到，不能把它另稱為自然案例。
- 帳密只允許經 stdin JSON 或環境變數提供，不寫入腳本、報告、console、HAR 或 trace。目前沒有 commit、push 或 Render 部署；正式公開版上線後仍需用不攔截程式碼的 live 模式與 postdeploy Service Worker 流程重驗。
