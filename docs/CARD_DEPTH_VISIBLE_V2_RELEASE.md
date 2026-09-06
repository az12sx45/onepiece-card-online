# Card Depth visible V2 — 可見卡預載與桌面素材包

## 狀態（2026-09-07，截至本段）

V1 已於 `40929bcade833267f48599135f9fdd29215f53d5` 正式上線，Render 切換時間為 2026-09-07 02:08:49（Asia/Taipei）。V2 的 R2 素材發布已完成，正式 release commit、Render 切換時間、現有啟動器實際更新與 postdeploy 結果尚待填入，不能預填 PASS。

本輪正式工作樹為 `D:/Codex_Release_Worktrees/card-depth-desktop-bundle-v1`。舊 `docs/CARD_DEPTH_V1_RELEASE.md` 及四份專案文件下方的「尚未發布」段落保留為當時歷史快照；目前狀態以本文件及四份文件頂端新段落為準，不刪除或改寫舊失敗證據。

## V1 已完成的正式證據

以下報告位於 `D:/Codex_Release_Worktrees/card-holo-v458-release/artifacts/`，屬 V1 的歷史發布證據，不等同 V2 驗收：

- `card-depth-v1/live-assets/report-1788718163998.json`：正式公開程式 3 檔與分層素材 240 檔，共 243／243 live bytes／SHA PASS。
- `card-depth-v1/sw/depth-v1-postdeploy-report.json`：沿用原有 Chrome profile 與 `op-card-v7.5`，74 項 PASS。只屬桌機 Chromium，沒有實體手機的宣稱。
- `card-depth-v1/browser-live/browser-report.json`：2,262 項 PASS，80 組／320 個真實 HTTP、0 page errors。
- V1 候選的 runtime unit 4,901 項與兩次真實兩帳號 candidate 已通過；兩次 candidate 證據為 `card-finish-v1/real-candidate-2026-09-06T17-59-45-524Z.json`、`real-candidate-2026-09-06T18-00-44-158Z.json`。它們不是部署後真人驗收，且各有 4 筆既有媒體 404，不宣稱全站零 404。
- V1 部署後真人 runner 的 `card-finish-v1/live-qa-failure-2026-09-06T18-10-24-559Z/failure-summary.json` 為 `MENU_NOT_READY`：遇到既有、非本輪擁有的四人房第 2 回合，未操作或退出該房。此項未完成，不是 PASS。
- `naturalDisabledSeen` 的技能禁選數字與禁選卡片是不同驗收範圍；`choiceDisabledBlocked: false` 不得改述為真人已驗證禁選卡片阻擋。

V1 原始分層清單仍為 `docs/CARD_DEPTH_V1_ASSETS.json`，240 檔／13,632,032 bytes，LF SHA-256 為 `88d1f47444cfc6bedbdfce27648947530909f1f8323d4ff8842ce699092969db`。保留其 `/card-depth/v1/` 製作與發布 provenance。

## V2 顯示及資源契約

- 符合桌機精準指標等條件且位於可見區域的卡片於 idle 預載；hover 不再作為首次載入門檻，只更新既有角度／反光等互動視覺。最多 2 個載入工作並行、最多 4 個既有 Card Finish surfaces，不增加卡面接點。
- web 只對可見卡 lazy-load，不在頁面初始化時預抓整套 80 卡。離開可見區域、隱藏、換圖、凍結／禁選、移除或失敗等生命週期須依 V2 QA 驗證，不以無限預載或無界 decoded cache 換取即時顯示。
- 手機／觸控及減少動態維持原卡靜態回退；省流量、遮罩不支援或分層載入失敗時不載分層素材，仍可保留原有的輕量 CSS 角度／反光。不改點擊、disabled、文字或互動命中區域。
- `background.webp`、`subject.webp`、`foreground.webp` 沿用已審查位元組。foreground 仍只是 alpha mask，套在原圖 clone 上，不直接顯示成白色遮罩；原文字、數字與框保持固定。
- 公開 runtime 為 `public/js/card_finish_v1.js`、`public/css/card-finish-v1.css`、`public/game.html`，新 query 為 `20260907-depth-visible-v2`。Card／Board 規則、Socket event、DB、帳號、存檔及 `BOARD_GAME_STATE` 均不變。
- 模型、Python venv、SAM embedding cache 與製作中間檔仍只在製作端，不進網站、installer 或 R2 玩家素材包。

## 現有桌面啟動器相容方案

240 份相同位元組另提供 `public/images/card-depth/v1/{normal|enh|lux|lux-enh}/{0..19}/{background,subject,foreground}.webp`；原 `public/card-depth/v1/` 不刪除。runtime 使用新的 `/images/card-depth/v1/` 路徑，讓現有 launcher 1.1.4 的安全路徑驗證、Card 分類及 `/images/*` request interceptor 直接相容，不增加第五個素材根目錄或更改 catalog schema。

現有玩家須在啟動器的遊戲庫按「下載更新」，才能取得並驗證新增素材；不是自動全套下載，也不要求重裝或升版 launcher installer。完成後遊戲中由既有本機 CAS／`opcache` 供應，重開不應重抓同 SHA 的內容。尚未更新的 receipt 仍可啟動原已安裝版本，缺少 alias 時回退 Render；不能保證所有現有安裝立即離線命中。HTML、JS、CSS、登入、房間、同步與雲端服務仍由正式站提供，不宣稱整款遊戲完全離線。

- 新增 logical 資源：240 檔／13,632,032 bytes。
- 新增 CAS 唯一內容：211 blobs／13,479,592 bytes；相同 mask 內容去重，與既有 Card＋Board 清單的 SHA 交集為 0。
- 新 Card manifest：`public/desktop/manifests/card-assets-440918e609684317.json`，710 檔／705,711,887 bytes；catalog 內 manifest SHA-256 為 `46bc6d59f66c6ec5c26e2d7291c5b1ec65f466f6c2a70560c6a39ba11faed263`。
- Board 保持 `board-assets-eb95373ee6ab1aa3.json` 及其原位元組；既有 Card manifest 保留供 rollout 參考。
- 211 個 unique blobs 已由發布器以 HEAD／conditional PUT／HEAD 發布；首次為 `uploaded=211`、`skipped=3486`、`skippedRace=0`，緊接完整重跑為 `uploaded=0`、`skipped=3697`、`skippedRace=0`。發布器不刪除或覆寫既有物件。

`desktop/generated/image-manifest.json`、`desktop/generated/asset-manifest.json`、`public/desktop/catalog-v1.json` 需與 alias inventory 一致。`desktop/package.json` 與 package QA 同步目前引用與 retained manifests，僅維持後續建置一致性；本次不發布新 installer，也不改 `public/desktop/launcher-release-v1.json`。

## 發布順序與待驗項

1. 在新正式工作樹的實體素材目錄核對 240 個 alias 與 V1 原檔的 SHA／大小；不得寫入舊發布樹的 `public/images` junction 或混入 r5／r6、Board、備份／模型等未授權差異。
2. alias inventory 進入正式本機 Git HEAD 後，依序建立 image manifest、unified asset manifest、game catalog；生成器要求 HEAD 與實體素材一致，僅 stage 不足。核對 Card 新增範圍及 Board 清單完全不變。
3. `desktop_card_depth_bundle_qa.js`、manifest／catalog／package、asset-store／runtime cache／SW isolation、R2 publisher fixture 與 dry-run、Card unit 4,983、browser 2,273（80 組）均已通過。
4. 沿用 `tools/desktop-r2-publisher/publish.js`／`publish-saved-r2.ps1`，以 `desktop/blobs/sha256/<前兩碼>/<SHA>` 發布 immutable 內容；首次上傳 211 個、略過 3,486 個，完整重跑新增 0、略過 3,697 個，沒有覆寫、刪除或競態提交。
5. R2 位元組驗證完成後，才發布 Render 的 aliases、catalog、immutable manifest 與 runtime；正式 commit／切換時間／live hash 結果：**待主流程**。
6. 用現有 launcher 1.1.4 驗證按更新後只抓新增內容、本機 `X-OnePiece-Desktop-Cache: hit`、foreground mask、重開不重抓、Render fallback 與修復；執行 V2 browser 80 卡及獨立舊 SW profile postdeploy。桌面、正式真人、V2 browser／postdeploy 結果：**待主流程**。

## V2 獨立 Service Worker 基線

`scripts/card_depth_visible_v2_sw_qa.js` 使用獨立 `artifacts/card-depth-visible-v2/sw/`，不覆寫舊 V1 script、profile、baseline 或 postdeploy 報告。

已完成的更新前基線位於 `D:/Codex_Release_Worktrees/card-holo-v458-release/artifacts/card-depth-visible-v2/sw/depth-v1-baseline.json`，**82 assertions PASS**：正式 `40929bca`、舊 query `20260907-depth-v1`、12 份 `/card-depth/v1/` 代表素材與 Git blob／SW cache 一致，controller 為既有 `op-card-v7.5`。新 alias 12 個 HTTP 404 僅記錄為尚未發布觀察，alias cache entries 為 0。

profile 固定在同一證據根的 `profiles/depth-v1`。postdeploy 必須延續此 profile 及 nonce，使用新 query `20260907-depth-visible-v2` 與 `/images/card-depth/v1/` 代表素材，驗證可見卡不需 hover 即完成載入、舊 cache key 保留與新 bytes 一致。本輪優先從原證據樹執行已鎖定腳本，指定新的正式 release commit，不需搬移 profile；新正式工作樹內的同名腳本只作程式交付。若日後改變證據位置，須另外記錄與驗證 baseline／profile 的延續關係，不能新建乾淨 profile 冒充升級。V2 postdeploy 目前**尚未執行**。

## 回滾

優先只撤回 V2 runtime／idle 預載或顯示策略，保留新增 alias、catalog、immutable manifests 與 R2 CAS。既有 launcher 會阻止安裝較舊的 manifest；直接 revert catalog 或刪掉 alias 不是已更新 receipt 的可靠降版方法，也可能破壞尚未更新客戶端的 Render fallback。

若必須更改素材集合，需另設經審查的前進版本清單與遷移／驗證計畫，不直接覆寫 immutable manifest。不要使用 V1 之前的回復分支撤銷僅屬 V2 的更新；V1 已上線的 80 卡分層與歷史證據應保留。
