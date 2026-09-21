# 海格抽選結果插畫與動畫（2026-09-21，已部署）

使用者要求航海錄海格二選一後以真正航海王角色圖片、動畫與實際獎勵圖示展示結果，各事件提供三張隨機圖；後續明確要求「繼續完成並部署」。修改來源為 `D:/Codex_Release_Worktrees/board-voyage-records-v1`，基線 `6c2e4f59d25eb7f5803894ef834d6a318da562f3`。最終發布證據於下方補記。

## 完成的接線

- `public/js/board_sea_event_visuals.js`：24 個事件對應 V2 插畫；以獨立 `crypto.getRandomValues` 選取三個版本之一，同事件避免連續使用同版。只有本機展示暫存，沒有寫入新存檔欄位，不消耗玩法的 `Math.random` 或 seeded RNG。
- `public/js/board_game.js`：在既有 `effectDef.apply`／`applySeaTreasureChestReward` 前後讀取數值差額，顯示實得貝里、HP、PP、骰子修正、位移與實際入袋道具。道具圖由 `gameItemDef`／`itemImageForDisplay` 取得；插畫不決定道具。既有預抽效果、金額、權重、偵查、寶箱洗牌、四選一、CPU、確認按鈕與回合結算保持。
- 操作方只選一次插畫，再將 `visual`、`outcomes`、寶藏 `artTitle` 放入既有 `sea-result`／`chest-result` 的展示 detail，觀看方使用相同資料；沒有新增 Socket.IO event 或持久 gameState 欄位。既有 `BOARD_GAME_STATE` 快照與 server 控制權流程保持。
- `public/css/board_sea_event_reveal.css`：深海青藍／古金結果框，插畫揭曉、光掃、緩慢推鏡及獎勵圖示浮現；紅色扣除數值、寶箱陷阱標籤、桌機／直向手機／橫向手機、減少動態偏好、圖片失敗仍可確認。動畫不延後規則運算。
- `public/board_game.html` 載入 CSS 與 helper，快取版本 `20260921-sea-reveal-v2`。`config/desktop-program-packages-v1.json` 加入兩個核心檔白名單，納入同版桌面套件。
- `public/board_sea_event_preview.html`／`public/js/board_sea_event_preview.js`：獨立圖鑑，可選全部事件、指定三版、隨機揭曉與重播，並列出全部縮圖。此頁使用明確標示的展示數值，不連帳號、Socket.IO、房間或存檔。

## 插畫與來源

24 種事件為金錢 5、天氣 6、寶藏 7、藥物 6。寶箱海域別名使用漂流寶箱群；直接遭遇仍使用原敵人展示與戰鬥入口。

新圖全部使用內建 GPT `image_gen`，每個版本獨立生成完整 1536×1024 場景，角色使用魯夫、娜美、喬巴、羅賓、騙人布、佛朗基、甚平、布魯克、索隆、斯摩格與達絲琪等，風格以動畫線稿、海洋青藍、深海陰影與金色光源搭配航海錄。原始 PNG 保存在各次生成的 `C:/Users/王曜瑋/.codex/generated_images/`，最終 WebP 複製到 `public/images/board/sea_event_reveal/v2/`，沒有替換其他既有角色圖。

逐張完整提示詞、原檔、輸出路徑與 SHA256 分別記錄在：

- `BOARD_SEA_ART_MONEY_WEATHER_V2.json`
- `BOARD_SEA_ART_TREASURE_MEDICINE_V2.json`
- `BOARD_SEA_ART_MEDICINE_VARIANTS_V2.json`
- `BOARD_SEA_ART_WEATHER_VARIANTS_V2.json`
- `BOARD_SEA_ART_COMPLETION_V2.json`：中斷後依確定的生成紀錄補存原圖，以及最後補生成圖片。

接手時已有 4 張 V1 泛海賊圖與尚未接入的 helper；V1 原圖保留但未引用，helper 修改前原文另存於 `D:/Codex_QA/board-sea-event-20260921/preexisting-visuals.js`。既有 `r5.PNG`／`r6.PNG` 修改不屬於本次範圍。

## 驗證與本機檢查

服務：`PORT=18924 npm start`，透過既有 `board_move_fx_qa_isolation.js` 將所有 server/data 存取導向 `D:/Codex_QA/board-sea-event-20260921/isolated-data`，停用資料庫。依賴使用現成 `D:/Codex_Release_Worktrees/battle-chess-launcher-v1/node_modules`，未安裝或修改 node_modules。

本機圖鑑：`http://127.0.0.1:18924/board_sea_event_preview.html`。

新 QA：`scripts/board_sea_event_reveal_qa.js`，僅 localhost、隔離 Chrome context／臨時房間，測試 hook 只注入瀏覽器回應，不寫入正式頁或存檔。初步 195 checks 通過、0 browser errors：實際二選一點選、17 一般結果、7 寶藏入口、5 寶箱、操作方／觀看方同圖與同結果、6 CPU 確認選擇器、實際 HP／PP／貝里／骰子差額、道具圖、桌機與手機尺寸、觀看方刷新，以及展示 RNG／遊戲狀態不變。初步素材仍在生成，不能把此階段當作全部圖片載入驗收。

中斷前補充檢查為 198/198（包含動畫偏好及圖片失敗確認）；接續重新執行原 `lan_refresh_flow_qa.js` 通過真 Socket.IO 建房、加入、開始、交棒、觀看方刷新與雙頁待續戰鬥恢復，errors 空。自動化驗證不代表真人遊玩、實體手機或外網好友連線測試。

## 最終素材與發布前驗證

- 72/72 張獨立 WebP、各 1536×1024、72 個不同 SHA256，總計 21,812,054 bytes。逐張比對 GPT 原始 PNG、五份來源紀錄與最終檔；統整於 `BOARD_SEA_EVENT_ASSET_INDEX_V2.json`。
- 正式接線的隔離 Chrome／Socket.IO QA 最終 **210/210** 通過，72 張全部瀏覽器解碼，0 缺圖請求、0 頁面錯誤。涵蓋 24 事件、5 寶箱、CPU 確認、同圖同結果、刷新、一般／減少動態、圖片失敗仍可確認、1440×900／390×844／360×780／932×430。
- 證據：`D:/Codex_QA/board-sea-event-20260921/qa-final/sea-event-reveal-report.json` 與同目錄截圖；LAN 回歸另存 `lan-refresh-flow-report.json`。
- `scripts/build_board_sea_event_release.js` 僅接受固定基線，從已提交 Git 來源建立外部凍結候選；41 程式、72 新圖、4,040 既有媒體，共 4,153 logical files、76 變動 blobs。只有明確 `--candidate ... --promote` 才寫正式 Board v3 metadata；Card／Chess、v2、原媒體及來源樹不變。
- `scripts/board_sea_event_release_builder_qa.js` 隔離 fixture **24/24** 通過：缺圖、未提交圖、額外圖、未授權程式、既有媒體、rank、v2、候選竄改與多檔皆拒絕；檢查模式零寫入、明確 promote 範圍正確。結果已保存於 `D:/Codex_QA/board-sea-event-20260921/release-builder-qa-report.json`。

## 公開發布

依使用者「續續完成並部屬」指示執行。來源提交 `f66dc1fce7111d0f894b7779c634b8b94d8768d8`，凍結候選位於 `D:/Codex_QA/board-sea-event-20260921/release-candidate`，已重新讀取驗證後 promote。

- Board 套件：`package-b3342dbd8b206231`；manifest SHA256 `b767e1c146e47ec6c29497c0fcfb59e096b6a0eac450a1d3fdbf0a45bdde877f`。
- 4,153 logical files／1,397,133,580 bytes；保留 4,040 舊媒體，更新 2 舊程式、新增 2 程式與 72 圖；僅 `public/desktop/catalog-v3.json` 及新 Board manifest 變動。
- 完整 R2 publisher dry-run 驗證 4,153 logical files／3,836 unique blobs，全部 Git HEAD 來源 bytes／SHA 通過。76 新 immutable blobs 共 26,191,640 bytes（約 26.2 MB）全部成功上傳。
- 首次 R2 公開逐檔下載於 39 檔後遇到單次請求逾時；另行完整重試 **76/76** bytes／SHA 通過，重試批次沒有任何錯誤或重送。保留首次失敗證據與完成報告，確認全部素材可用才推送。
- 正式 release commit `b50ae945a8a3fd9b03fc14192a990e94cfd9564f` 已推送 main；2026-09-21 **20:29:44（Asia/Taipei）** 公開 runtime 實際切換至 `package-b3342dbd8b206231`。
- 20:30:02 公開完整性 **45 checks** 通過：health、三遊戲 runtime identity、catalog／manifest、全部 41 份 Board 程式 size／SHA、RECOVERED 舊端點 410。Card／Chess 套件保持原值。
- 20:30:06 正式原 URL 的 **72/72** 新圖 HTTP 200、WebP MIME、size／SHA256 完整通過，零重試。
- 公開 Chrome **91/91** 通過：實際圖鑑操作全部 24×3 版本、72 張解碼、隨機／下一事件／縮圖按鈕、一般／減少動態、1440×900／932×430／390×844。正式 Board 頁透過瀏覽器回應 hook 只呼叫純結果 renderer，確認已部署 helper／CSS／圖示、無玩法狀態變動；此項不冒稱正式線上房間遊玩。全新未登入 context 攔截非 GET／HEAD 及 WebSocket，0 頁面錯誤、0 修改或 socket 請求，共 174 GET。
- 27 份保護檔（24 server/data、兩張既存 rank 修改、catalog-v2）發布後 size／SHA 全數不變；V1 原圖保留且不納入本次發布。正式存檔沒有進行寫入測試。
- 證據統一在 `D:/Codex_QA/board-sea-event-20260921/`：`release-candidate/release-inputs.json`、`r2-dry-run.json`、`release/r2-live-delta-1789993163159.json`、`release/r2-verify-retry.json`、`release/runtime-transition.json`、`release/live-verify.json`、`release/public-art-verify.json`、`public-readonly/public-readonly-report.json` 與截圖、`protected-after.json`。
- 已停止本次自建的隔離 npm 服務，18924 無監聽；隔離測試資料及證據均保留。
- 收尾只更新文件並以 `[skip render]` 提交，不再次啟動已驗收服務。

網頁重新整理即可使用；桌面版從更新器下載約 26.2 MB 更新後重開。公開圖鑑：<https://onepiece-card-online.onrender.com/board_sea_event_preview.html>；正式遊戲：<https://onepiece-card-online.onrender.com/board_start.html>。
