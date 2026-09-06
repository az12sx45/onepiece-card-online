# Card Finish V1 — 獨立實作預發布紀錄

日期：2026-09-06。使用者已授權「改成獨立實作、補完測試後再發布」。本文件取代上一輪 V458 GPL 候選的發布計畫；舊候選沒有上線。

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
