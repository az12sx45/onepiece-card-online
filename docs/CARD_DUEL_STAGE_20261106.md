# Card 經典戰鬥舞台與私密牌號

來源為正式 main `dbc45faa4377df86cf0fbb86944c1379b84cdc05` 的獨立 sparse 候選 `D:/Codex_Release_Worktrees/card-duel-stage-20261106`。原 Card 與 Android 未提交原稿保持不動。本文件為實作／驗證記錄，正式發布須由啟動器交接收據與公開讀回確認。

## 玩家畫面

對打使用雙方卡背、公開頭像與玩家名；以公開 duelId 決定馬林福特廣場、鬼島屋頂或德雷斯羅薩競技場，使各玩家觀看同一場景。雙方各有獨立招式貼圖，交鋒後才決勝；特效選擇不讀手牌。介面不顯示場地介紹、技能說明或演出步驟，只有 VS、KO 與簡短勝負。

兩位對決者可在卡背上看雙方原始牌號。其他玩家沒有私密數字節點或私密可存取文字；確定輸家後才在畫面翻開公開敗方手牌，勝方保持背面。平手不翻牌。所有卡圖與招式圖保持比例；敗方只裂紋／傾倒，不拉扁圖像。

## 私密資料與同步

`server/engine.js` 在淘汰清牌前捕捉雙牌，分別送兩筆 `to:playerId` 的 `duel_private`，含 `duelId,leftId,rightId,leftCardId,rightCardId`；`duel` 與 `duel_log` 以相同 UUID 關聯，公開事件只含原有勝負與敗方牌號。平手同樣只送雙方私密牌號，沒有公開敗方事件。原始卡 ID 不套香吉士比較加成或尾數轉換。沒有新增存檔／STATE 私密欄位。

`getVisibleState` 中的 `pending.extra.keep` 僅 pending actor 可見，修正其他玩家能從該欄看出保留牌的缺口。共用 `server/index.js` 不需修改，原有數字 `to` 路由只分送同 `meta.playerId` 的 socket。

`card-duel-private.js` 只接受收件人等於目前玩家、且玩家位於雙方 ID 的合法私密事件；以同 UUID 與左右 ID 精確結合公開事件，不能從 STATE／pending 推牌。只消費一次並保留有界防重播記錄；斷線、換房、背景取消後不重用舊牌號。新／舊 client 與真 Socket.IO 分送驗證見最終報告，不能只靠 CSS 隱藏當作隔離證明。

## 播放生命週期

`card-duel-runtime.js` 只接管決鬥的 `playDuel`，保留其他既有演出。對打排隊與圖片準備納入 `isEffectBusy`，等原有演出清空後直接進卡牌／頭像舞台，略過舊 native 文字前奏。預載三背景及當場招式，圖片準備最多等五秒；舞台本身 9.2 秒。仍由原 presentation gate 等真人 ACK，再推進 CPU；本模組不自行 ACK。

所有舞台回呼與動畫受同一取消 epoch 管理，換房、斷線、換局、背景或 pagehide 會清除場景、排隊、計時、私密暫存並恢復手牌。正常結束同樣恢復手牌。回卡動畫保持卡背／公開敗方權限。

## 檔案與發布

- 新增 `public/js/card-duel-private.js`、`public/js/card-duel-stage.js`、`public/js/card-duel-runtime.js`、`public/css/card-duel-stage.css`。
- `public/game.html` 載入共用模組，與 `public/js/card-desktop-table.js` 改用精確 duelId 配對及私人投影，保留原 EOL。
- 新增三張 `public/images/card-duel/arena-*-v1.webp`，合計 672,618 bytes。生成提示、原圖位置、大小與 SHA 見 `CARD_DUEL_STAGE_ASSETS_20261106.json`。原圖使用內建 imagegen 生成並保留。
- 二十種既有招式從已發布 CSS 的內嵌素材讀取，不新增不存在的 `art/` 分發路徑。
- 啟動器負責新增四個 programme 白名單與三個媒體記錄；預期 Card 為 36 programme／1,098 media，完整保留原 1,095 媒體紀錄。不得用 programme-only builder 或舊 v2 generic 全量重建替代。

## 驗證證據與界線

證據目錄：`D:/Codex_QA/card-duel-stage-20261106`。

- `scripts/card_duel_privacy_qa.js`：662 項、34 場真 engine 對決，逐動作與原規則狀態及舊事件比對；包含 3／8／10／13、平手、阻擋與 8 強化不決鬥。
- `scripts/card_duel_private_client_qa.js`：57 項 Node VM，私密資格、一次消費、防重播、清理、錯誤配對、busy／圖片等待與取消。包含舊 retained flow 在共用入口補投影、合法 proof 的雙重處理、跨 UUID 公開 log 校正及舊 server 不帶 UUID 的相容。`client-before-repro.json` 保留兩個已修復問題的修前證據。
- `scripts/card_duel_boot_qa.js`：16 項 native late-API 啟動回歸。新 defer 模組即使在 `interactive` 先執行，也會等原 `DOMContentLoaded`／介面就緒後安裝；重試有界、重複就緒不重綁。runtime 會等私密 attach 與原 FX busy getter 建好才接管，防止提早 ACK。
- `scripts/card_duel_stage_visual_qa.cjs`：真圖與終態矩形檢查；此 fixture 直接套用動畫最後影格，不能當成真時間或 ACK 驗收。
- `scripts/card_duel_stage_browser_qa.cjs`：真 server／Socket.IO／瀏覽器／保留原生樣式整合，最終通過數與限制依其報告追加。

本機瀏覽器、VM、host fixture、公開 HTTP 與 CAS 驗證都不等於實機或正式帳號驗收。本階段 tools 未提供 LATTICE API，沒有宣稱持久任務／圖譜寫入或三核心驗收。

補充素材契約：終態幾何 58 項；正式桌面 CSS 與 iOS retained CSS 各 20 種貼圖必須是長度大於 1,000 的 inline data URI、解碼寬高大於 1，排除透明 1×1 fallback。兩種 CSS 各 4 項資產契約通過，40 個 duelId 的 API 與實際 renderer 素材相同；沒有外部 art 路徑請求。幾何／素材檢查不可替代真時間與原生入口驗收。

## 最終本機整合驗收

`accepted-summary.json` 為正式主要本機證據：301 項瀏覽器檢查通過、零瀏覽器錯誤；另 literal npm start 與程式 HTTP 原始位元組讀回六項通過。桌面與 Android/iOS retained fixture 共用凍結產品；源碼、受保護 CSS、事件序列、私密投影、CPU／ACK、幾何與舊頁相容分列。

- desktop：69 項通過，`D:/Codex_QA/card-duel-stage-20261106/browser-final-desktop/report.json`。
- retainedNativeUI：223 項通過，`D:/Codex_QA/card-duel-stage-20261106/browser-native-phase-final/report.json`。
- legacyCompatibility：9 項通過，`D:/Codex_QA/card-duel-stage-20261106/browser-final-legacy/report.json`。

對決勝／敗／平手、魯夫兩次目標與 UUID 關聯、切背景／重整／換局取消、舞台後真人 ACK 與 CPU 恢復均有實測。手機在同一冷啟動連線依 932×430、667×375、390×844、320×740 的真結果檢查卡片、頭像、名稱不遮擋。三十六張捕捉結果的矩形後檢查同樣通過。

來源保真：`published-dependencies-postwrite.json` 逐一寫後重讀 23 個已物化的未改程式依賴，皆等 immutable EED record；另七個未物化檔案未宣稱還原。修改的 game.html、desktop JS、engine 保留本次測試 working CRLF，由發布者明確接受為行尾例外；提交前後逐一比對 working/index/commit RAW。四份原文件的 committed prefix 完整保留，只追加記錄。`accepted-source-verification.json` 另明列未改 server/index.js 的 checkout EOL-only 差異：其 committed blob 保持正式基底，不將共用檔當功能修改；不得把該行寫成 raw 完全相同。

前置失敗與修前報告均保留且不計通過：sparse 缺原 cards.json、座位重排假設、舊頁 route.fulfill 觸發 Chrome LNA、入場／回卡動作被誤當靜態幾何、過早取樣不同 viewer 的冷啟動時序。兩個真產品缺口（native late API 與 retained flow 未走新 private bridge）均已修正並有新來源測試。

原生界線：fixture 使用已發布 Android/iOS retained JS/CSS 並明列實際含 Electron 相容 token 的 UA，`nativeEntryVerified=false`。不將此說成實際原生入口／headers／provider 過渡、實機、正式帳號或影片解碼驗收；真正正常更新與公開讀回由啟動器發布驗證。發布狀態仍須看啟動器最終 RELEASED 收據。
