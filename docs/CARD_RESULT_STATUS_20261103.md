# Card 結果斜圖與頭像狀態時序（2026-11-03）

狀態：READY_FOR_INTEGRATION，與既有 entry/video 波次一併交接。來源為正式 `card-native-server-adapter-20261029` 分支，基底提交 `45602234069809a36c17fca0cc971144919df425`。本文件只記本次追加；原影片／入場／場地介紹／手機樣式修正見 CARD_ANDROID_VIDEO_STARTUP_20261103.md。

## 實際行為

- 大媽擲幣及喬巴取得保護／閃避時，先跑原判定，再播結果斜圖，斜圖結束後才跑頭像取得動畫並提交狀態徽章。修正前確實可在斜圖前看到新頭像防禦圖示，基底重現保留於 QA。
- 保護／閃避擋住技能只保留原擋招效果與日誌，不另播一張斜圖。多目標仍有真實成功結果時保留一次結果播報。
- 大媽選交幣／拒絕及其淘汰是原招式的後續，不再次播斜圖；尚待選擇的威嚇不提前報結果。
- 奎因同次施放的連續擲幣／麻痺傳遞最多播一次有效結果，之後自動跳過回合不重播；同玩家同回合的新施放可正常播報。娜美對已麻痺目標沒有新狀態時不重播。魯夫對不同目標的第二次真實決鬥仍可播報。
- 公開結果重送不再次播放。取消、背景、斷線或重連時丟棄舊取得動畫，晚到圖片不重啟斜圖；權威狀態仍按原流程收斂。未新增私人手牌讀取或改動規則。

## 來源與維護

共享 Android 根目錄：`C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html/android`。

- `web/card-result-cutins.js` 升至 resultCutinVersion 2，SHA256 eb6f4b3fb7794389178b11f34258556cd0ebfb98275c9e032e7379dab9669940。
- 新增 `web/card-status-reveal.js`，avatarStatusRevealVersion 1，SHA256 763263c8a8bf3e9696d7809b90cd80fc2ef9f1c7a4ce39adf7b9f398902917f1。只延後同次 accepted batch 中原物件參照的公開 BigMom／Chopper protect/dodge 取得事件，held queue 不計 busy，避免與結果等待互鎖。真 card_defense 原路。
- status 必須在 result 之後註冊，成為最外層 pile wrapper。`mobile-sources.mjs`、`build-card-desktop.mjs` 均以 status 最後；HTML 依序 result→media flow→status→match entry。`scripts/build_card_media_flow.mjs` 負責 inline status，entry guard 要求 result>=2 與 status>=1；快取 token 為 20261103-entry-startup3。
- 正式維護新增 `scripts/card_result_repetition_qa.mjs`、`card_status_timing_qa.mjs`，同步調整既有 `card_result_cutins_qa.mjs` 的 defense/pay 預期。
- 對玩家的變更只有 game.html、generated card-desktop-table.js。小 CSS、原桌機 CSS、41 張原圖、影片、server/engine.js、server/index.js 與 APK/IPA 全部沿用前一候選。

## 已執行證據與限制

- D:/Codex_QA/card-result-repetition-20261103/fix-final/report.json：71 PASS，真 engine/decorator 產生結果，含 Queen 同次與新施放、pay/decline、防禦與新舊麻痺、重送及取消；baseline 的舊缺口失敗保留。
- 同目錄 classifier-v2-final/report.json：366 PASS／140 真 engine fixtures。actual-android、actual-ios、actual-desktop/report.json 各386 PASS，直接使用凍結 HTML＋exact retained mobile 或 generated desktop，不注入 result module；其中包括同頁 Queen 首判→重送→兩次後續 coin→auto DRAW，三端均無額外斜圖。
- D:/Codex_QA/card-status-timing-20261103/final/report.json：111 PASS／0 errors，desktop／Android63／iOS63／iOS58 實際 EMIT/STATE：四端驗大媽兩面（自己protect／對手dodge）；desktop另驗喬巴protect、取消、背景、重連與真擋招，喬巴dodge只列module單元收集／釋放驗證；模型及 persistent 徽章在斜圖中維持前 snapshot，取得動畫在斜圖後。報告含起訖來源綁定。
- D:/Codex_QA/card-result-status-20261103/sync-final-source-bound.json：真 npm start＋Socket.IO 雙視窗8 PASS，來源前後相同，含閱讀閘門、重整恢復及他人手牌隱私。syntax-diff-check.json 記6個 script語法與限定差異檢查。
- D:/Codex_QA/card-match-entry-20261103/result-status-delta-cold/report.json：66 PASS／0 errors，desktop／Android63／iOS63／iOS58 冷入場；新result/status版本閘門、遮罩、selected CSS與第一份模型等來源綁定通過。
- 上述是隔離瀏覽器／真本機引擎證據，不等於實體 Android／iPhone、正式帳號或公開部署驗收。沒有新 LATTICE API，沒有假造持久 task／graph 完成。

完整最新 raw/Git LF SHA、冷入場回歸與交接狀態以 D:/Codex_QA/card-entry-video-20261103/artifact-inventory.json、verification-summary.json 與協調 handoff 為準。首次三項 QA 保留原 source binding，沒有把較早 bytes 的報告改稱本次重跑。
