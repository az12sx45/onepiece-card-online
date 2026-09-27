# ONE PIECE 角色生活基地：實作前稽核

日期：2026-09-27。需求來源：使用者的 MASTER PROMPT，實際附件第 0–31 節（末尾在防重複範例箭頭結束）。本文件在新增生活系統程式前建立；下列設計與測試計畫不表示已完成或已通過。

## 正式來源與保護範圍

- 正式工作樹：`D:\Codex_Release_Worktrees\board-voyage-records-v1`；目前工作樹啟動器 1.1.16。
- 本次隔離候選：`C:\Codex_Candidates\launcher-character-life-1.2.0`，由已發布來源 `fff29a25298d60401a4e61fd96358f1622e6478b` 建立。正式樹有其他遊戲修改，交付只同步本次有證據的檔案及文件段落。
- 不改 Board/Card/Chess 遊戲規則、存檔、Socket.IO 遊戲事件、帳號 secret 或玩家購買紀錄。保留商品 ID、房間座標、四向家具、玩家親密度與原有商城錢包。
- 此階段未提供可呼叫的 LATTICE 任務 API；已有專案登記 `fc1f1991-a190-4cd1-8933-947297d0ebbe` 僅作來源識別。本次未聲稱建立任務、寫入決策或完成圖譜分析。

## 現有架構與可沿用能力

| 範圍 | 已核對來源 | 沿用與問題 |
| --- | --- | --- |
| Electron／原遊戲啟動 | desktop/main.js、preload.js、launcher.js、program-runtime.js | 主程序限制 renderer IPC、下載／版本簽章／三遊戲啟動保留；新資源需明確加入 protocol allowlist 和封裝清單 |
| 帳號／保存 | desktop/auth-service.js；server/index.js、db.js | secret 留主程序、雙槽加密保存；生命資料不可混入帳號檔或 gameState |
| 擁有權／商店 | server/launcher-profile-shop.js | 唯一權威為 PostgreSQL launcherOwnedV1.items；catalog 不代表擁有；購買在 profile row lock 下扣商城金幣 |
| 房間／家具 | desktop/launcher-room.js/.css | 16×8 投影格、BFS、阻擋、固定家具比例、四向旋轉、桌琴接點保留；需加獨占預約及任務中止釋放 |
| 角色生成 | launcher-room.js；server room normalization | 目前只生成 owned 且 placed；上限 8 同時在 server、auth、renderer。升為 10，舊客戶端不可把十人存檔靜默截成八人 |
| 走路 | launcher-room-motion.js、motion-data.js；motion_v3 | 四方向各四幀，實際移動距離控制步態、整身轉向、深度縮放保留；不拆頭身、不拉伸肢體 |
| 表情／既有動畫 | acting_v3、portrait_v3 | acting_v3 八格是八個獨立單幀姿勢，不能冒充連續工作動畫。新增完整身體動作圖集 |
| 對話／角色設定 | launcher-room-dialogue.js；LAUNCHER_CREW_RELATIONSHIPS_20260927.md | 十人、45 組關係、成段對話可重用；單一全域互動限制多人背景生活。部分單人台詞直接提未必在場者，新增內容要按實際參與者分支 |
| 工作／商城錢包 | server/launcher-profile-shop.js | 舊工作僅五分鐘計時、10 幣、每日六次／每人兩次，UI 已隱藏。需實際站點、工作階段、server job ID、唯一收益收據、離線聚合 |
| UI／好友 | launcher.html、launcher-profile-shop.js/.css | 保留可編輯名片、圓頭像框、留言、收藏、三遊戲數據、好友參觀；同一小型角色面板加入動作與狀態 |
| 音樂 | profile-shop.js；public/audio/profile_bgm、bgm | 已購 BGM 與停止／切頁生命週期保留，不自動疊加生活音效干擾音樂 |
| Asset 管理／發布 | desktop/package.json、main.js；scripts/desktop_launcher_package_qa.js；tools/desktop-r2-publisher | 新素材需原稿／prompt／receipt／hash、尺寸／alpha 檢查、實際畫面檢視、封裝啟動與公開簽章／SHA 回讀 |

## 必修缺口

1. 沒有需求、個性權重、生活狀態、日夜、每日方針、短期記憶或四維關係數值。
2. 同 owner 的 profile 重畫會清空 walkers；Life 必須獨立於 DOM，只有房間布置改變才重綁演出。
3. 既有 pairHistory 未依 owner 隔離；新事件歷史、冷卻和回覆必須跟帳號／被參觀者綁定。
4. 購買成功缺少 account epoch 防護、入場 queue 與一次性 acknowledgement；新買角色不會自行走入。
5. 舊工作沒有具體工作站；stationary expression 並不等於切菜、閱讀、修理。須有動作幀與可見階段。
6. 沒有持久 lastExitTime／lastSimulatedAt；profile updated_at 不能當離線時間。
7. 泛用 PROFILE_UPDATE 目前接受未知 JSON branch；新 Life 權威使用獨立 server state／ledger，並加入同名 branch 防注入保護。
8. 現有家具不含床、冰箱、爐灶、椅子。不能把背景畫內家具當可占用物件；活動只使用已放置的真實站點，地板活動只在可達空格。

## 新架構與介面

### 資料與生命控制

- `desktop/launcher-life-data.js`：UMD 純資料，十人需要／權重、九類工作站及所有角色效率、四維關係初值、作息／方針、事件條件／步驟、短期記憶規則、玩家互動台詞。
- `desktop/launcher-life.js`：純 CharacterLifeController，注入時鐘、亂數、畫面 adapter。11 種狀態：Idle/Wander/Work/Eat/Rest/Sleep/Train/Socialize/UseFurniture/SpecialAction/EventParticipant。Life tick 低頻；原 RAF 仍負責走路。
- owned 解鎖事件；owned ∩ active ∩ available 才能參與。事件缺必要角色不進候選，缺可選角色走明確短分支，絕不為事件生成角色。
- 角色各自任務並行；前景故事同時一個，避免對話洗版。事件、台詞、pair 冷卻、近期 ring、加權選擇與重複懲罰共同控制節奏。稀有事件間隔數分鐘。
- 家具 slot 與目標格預約，尋路失敗／編輯／切帳號／取消皆釋放；不以 teleport 解決死路。
- 需求有界、溫和回復，無死亡、永久負面或喪失收藏。四維關係不混同玩家親密度，也不加入戀愛系統。

### Server 與購買

- `server/launcher-life.js`／`launcher-life-store.js`：server-owned state、鎖定 profile 的交易、持久 command dedup 與工作 payout ledger。不可接受 client reward/time/owned/efficiency。
- 兩個新傳輸入口 `getLauncherLife()`／`commandLauncherLife({requestId,expectedRevision,type,payload})`；具名 commands reserve/activate/complete/cancel、directive、player interaction、event memory、arrival ack、checkpoint。每個 command server 重驗。
- 工作：預約 → 角色實際尋路／到接點 → activate → 動作階段／短休 → server 到期 → complete 收據 → 回到自主 AI。背景每秒不跑 server AI。
- 離線採有限 aggregate，僅推進已啟動合法工作；游標一次前進到 now，不重算截斷時段；wallet full 留待領，重試不重領。保留旧 activeWork 的一次性兼容與原日限額。
- 新買角色在同購買 transaction 建 pending arrival；舊 owned 遷移為已到達。上限端到端十人，不移動既有 saved placements。入口可達時依序走入，歡迎者只能從已在場 owned 選取。
- 訪客只讀公開投影，不推進主人錢包／私有記憶。切換帳號、好友頁或晚到回覆不能跨 owner 更新。

### 演出與 UI

- room.js 提供 route/arrived/face/dock/undock/action/speech adapter，繼續使用現有 BFS 與整身步態。
- 新 `launcher-life-actions.js` 只讀完整身體動作圖集；不把舊八種表情交替當工作。GPT 參考已接受角色設計製作，實際 alpha／根部／家具接觸／原尺寸 QA 後才採用。
- 現有角色面板新增聊天、工作／自動分配、呼喚、送禮、訓練、狀態；方針與工作結果為低干擾文字，不在所有頭上飄錢。
- 只改需求相關背景／家具素材；已接受的 1.1.16 小比例空間保留，新增物件沿用角色標尺。

## 需求追蹤與驗證計畫

| 需求節 | 實作位置／驗證 |
| --- | --- |
| 0、25–30 | 本文件、藝術來源紀錄、實際遊戲截圖、作者／角色設定審查、桌機與 390 寬、packaged smoke |
| 1–2、22–23 | server ownership／purchase、controller roster、0／1／2／10 owned、缺人事件、首次入場、重登不重播、晚到購買回覆 |
| 3–5、18、20 | controller needs／weights／schedule／directive、可控時鐘與長時模擬、狀態多樣性與安全上下限 |
| 6–9、19、24 | station registry、任務生命週期、真的動作圖集、阻擋／占用／取消、server job receipt、離線／跨日／滿錢包／重試 |
| 10–15、21、31 | 四維初值／變化、所有 pair、三人／chain 缺人分支、實際走到場、短期記憶衰退／上限、低頻／冷卻／近期去重 |
| 16–17 | 原面板互動、角色專屬點擊反應、送禮真實消耗／冷卻、親密度、鍵盤可操作與 visitor read-only |

## 預計檔案

- 新增：上述四個 life 模組、server store、Life 專用 QA、動作圖集與來源／manifest、功能驗收紀錄。
- 修改：desktop room/profile-shop/HTML/CSS/main/preload/auth/package；server shop/index/desktop-distribution；精確 asset/packaging QA；docs/DEV_WORKFLOW.md、PROJECT_OVERVIEW.md、GAME_RULES.md、FILE_MAP.md。
- 不覆寫不相關遊戲、原始素材、真實 saves；來源與發布驗證都保留 actual versus simulated 的區分。

## 實作前證據

三個獨立稽核輸出位於 `C:\Codex_Candidates\launcher-life-audit`，涵蓋 backend／frontend／content。backend 純合成 probes 7 項僅證明原 projection 行為，不代表 DB concurrency 或遊戲驗收。本文件建立後才開始實作；完成狀態將另記錄在交付文件，不能將本計畫當成通過報告。

## 2026-09-27 實作完成讀回

上述模組、所有權／購買入場、10人相容、狀態／需求／關係／事件／方針、家具動作與server金幣收據已在1.2.0實作。精確架構與限制見 `docs/LAUNCHER_LIFE_SYSTEM.md`，128組完整人物512格與32接點實際渲染證據見 `docs/LAUNCHER_LIFE_ART_20260927.json`。審稿抓出的魯夫／索隆／騙人布比例及服装、佛朗基與吉貝爾尺度、喬巴藥櫃遮擋、舊台詞未持有第三人均已修正並回看。保留原規劃與失敗歷史，沒有把本文件的計畫視為驗收。

Windows1.2.0封裝完成：244419451bytes，SHA256 `453cb33058897c5661ec2f5b8ab5e565866e9a0ed134a61a9d280f10cbcbba6b`。252 ASAR entries與全部應用程式／569resources逐檔比對，真Electron468素材載入成功，零缺圖；公開安裝檔完整HTTPS GET已讀回並重新算SHA相同。簽署清單與後端發布、正式D同步另以交付紀錄核對，不由封裝成功推論。舊房間編輯／所有權78、個人頁商城97回歸通過。模型視覺審稿／fixture／PGlite並非真人驗收或真實帳號購買。
