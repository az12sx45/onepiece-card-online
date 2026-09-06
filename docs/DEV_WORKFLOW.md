# Dev Workflow

## 霸海戰棋桌面發布整合（2026-09-07，R2 素材已上傳／分階段發布中）

- 來源與邊界：正式接入來源固定為 `D:\航海王西洋棋\GRAND-LINE-BATTLE-多人發布版-v1`。執行程式整理至 `public/chess/`；大型美術只建立 `images/chess/assets/*` 邏輯路徑，不複製進 Git 或 Render 的 `public`。本輪不碰 Card／Board 的遊戲規則、素材 id、localStorage key、Socket event 或 `BOARD_GAME_STATE`。
- 桌面素材清單：新增 `config/desktop-chess-assets-v1.json`、`public/desktop/manifests/chess-assets-4a14ed8c714c0b60.json` 與 `public/desktop/catalog-v2.json`。Chess 清單為 `1,380` 檔／`330,834,762` bytes，manifest SHA-256 為 `ea710d9921d2826200dd41a808e222c7c337dd4a4f276e338eb4324f4a18adad`；同一 `catalog-v2` 繼續引用既有 Card `710` 檔／`705,711,887` bytes 與 Board `3,451` 檔／`1,276,186,364` bytes，兩者 release id、manifest SHA 與位元組不變。
- 舊版相容：`public/desktop/catalog-v1.json` 保持原位元組與 Chess unavailable。只有 `1.1.5` 啟動器讀取 schema 2 的 `catalog-v2.json`、辨識 `card|board|chess`，並以獨立 `onepiece-chess-desktop-v1` partition 開啟 `/chess/index.html`；舊 `1.1.4` 不會因第三款資料結構而中斷原兩款遊戲的下載或更新。
- R2 發布：publisher 新增明確 `--game chess` 與 `--chess-source <release public/assets>`，逐檔驗證來源 realpath、大小及 SHA，沿用只 HEAD／條件式 PUT、無刪除／無覆寫的 CAS 流程。正式結果為 `1,370` 個 unique blobs／`329,861,974` bytes，`uploaded=1367`、`skipped=3`；抽樣完整 GET 為 HTTP `200`，Range `0-1023` 為 `206` 且 Cloudflare cache `HIT`。
- 程式供應：Express 的本機靜態檔優先；只有缺少的 `/images/chess/assets/*` 才會經已驗證的 `catalog-v2`／Chess manifest 映射，`302` 到精確 SHA-256 R2 CAS。越界路徑拒絕、未知項目 `404`、清單暫時失效 `503`。桌面安裝完成後同一路徑由本機 CAS 攔截，遊戲執行中不必逐張從網站重載。
- 多人權威：root 新增固定 `chess.js@1.4.0`。伺服器維護 authenticated Chess room、等待室／準備階段、CPU／觀戰／好友邀請與斷線重接；`CHESS_MOVE` 只接受 `from`／`to`／`promotion`，重新驗證座位、顏色、回合及序號，再由 server 計算 FEN、SAN、吃子與將死／和棋。客戶端偽造 FEN、非法步或自行宣告 `CHESS_GAME_OVER` 都不能改變權威棋局。
- 房間限制：目前 `chessRooms` 仍是單一 Node process 的記憶體狀態；Render 重啟會結束進行中的 Chess 房，亦不能直接水平擴成多 instance。無 socket 的房間只在現行 process 內依 idle TTL 清理；未新增資料庫棋局保存。
- 啟動器候選：`desktop/package.json` 為 `1.1.5`，x64 installer `ONE-PIECE-Tabletop-Launcher-1.1.5-x64.exe` 為 `152,185,039` bytes，SHA-256 `a49462b5a9a0990e82a8fe4883a6c785c93b7b1c2c891391d49067bec3e938aa`。本段建立時，正式 `public/desktop/launcher-release-v1.json` 仍鎖在 `1.1.4`；必須先部署程式／catalog 並以未公開 1.1.5 驗收，再上傳 installer、簽署並以第二次提交提升 stable manifest，避免未驗收版本被自動更新。
- 驗證：來源 release integrity、Chess bundle、真 Socket.IO 多人 protocol、Chess R2 fallback、三遊戲 catalog、R2 publisher、三遊戲 AssetStore 安裝／更新／解除安裝、Service Worker partition、runtime cache、source／packaged launcher package 與 Electron media smoke 均 PASS。packaged smoke 實際命中 Card image／audio／video、Board audio／video 與 Chess image 的本機 cache／Range `206`，並保留 NVIDIA GTX 1050 Ti／D3D11 硬體加速。
- 瀏覽器邊界：正式共用瀏覽器啟動頁仍不開放 Chess。R2 抽樣回應目前沒有 `Access-Control-Allow-Origin`；在 Cloudflare R2 CORS 正式設定並完成 browser QA 前，不把直接網頁版當成已支援。這不影響 Electron 由同源本機攔截器供應已安裝 Chess 素材。
- 回復方式：Stage A 可對本輪程式／catalog／server 提交做 scoped revert，既有 `catalog-v1`、Card／Board manifests 與 R2 immutable blobs 保留；若 Stage B 已提升 1.1.5，發布新的較高版修正版，不覆寫或刪除已簽署 installer／CAS，也不要把 stable manifest 反降回較舊版本。

## Card Depth visible V2／桌面素材包（2026-09-07，已發布）

截至本段，V2 `248610c5` 已於 2026-09-07 02:56:35（Asia/Taipei）切換到 Render；下方「V1 尚未發布」只保留為當時的歷史快照，不再代表目前線上狀態。R2、公開位元組、browser 與舊 SW profile 的 V2 postdeploy 均已完成。

- V1：`40929bcade833267f48599135f9fdd29215f53d5` 已於 2026-09-07 02:08:49（Asia/Taipei）切換到 Render。243／243 live bytes／SHA、既有 SW profile 74 項、browser-live 2,262 項（80 組／320 個 HTTP、0 page errors）PASS；證據詳見 `docs/CARD_DEPTH_VISIBLE_V2_RELEASE.md`。V1 部署後真人 runner 在既有非本輪擁有的四人房第 2 回合遇到 `MENU_NOT_READY`，未操作或退出該房，這次正式真人驗收不是 PASS。
- V2 顯示契約：符合條件且位於可見區域的卡片於 idle 預載；hover 不再作為首次載入門檻，只更新既有角度／反光等互動視覺。最多 2 個載入工作並行、最多 4 個既有 surfaces；手機／觸控與減少動態維持靜態，省流量或不支援遮罩時不載分層素材並保留輕量 CSS 角度／反光。web 只載入可見卡，不在進頁時預抓全套 80 卡。
- 桌面相容：新增 `public/images/card-depth/v1/` 的 240 個相同位元組 aliases，原 `public/card-depth/v1/` 保留。現有 launcher 1.1.4 可沿用 `/images/*` 攔截器及 Card manifest；既有玩家須在遊戲庫按「下載更新」，不是自動下載，也不是更新啟動器 installer。完成下載及驗證後遊戲中由本機 CAS 供應，未更新的舊 receipt 仍可回退 Render。
- 新增量為 240 logical files／13,632,032 bytes，CAS 去重後為 211 unique blobs／13,479,592 bytes。首次 immutable R2 發布為 `uploaded=211`、`skipped=3486`，立即完整重跑為 `uploaded=0`、`skipped=3697`；新 Card 清單為 710 檔／705,711,887 bytes，Board 清單及其 SHA 不變。
- 本輪範圍為 Card Finish JS／CSS／HTML query、aliases、desktop 清單／打包清單、對應 QA 與文件；不改 Card／Board 規則、Socket event、DB、帳號或存檔。模型／venv 仍只在製作端，不進 R2 素材包或 public。
- V2 獨立 SW 基線 82 項 PASS；正式 postdeploy 延續同一 V1 profile 與 nonce，77 項／`oldProfileRefresh=PASS`，一般／強化卡在 `engaged=null` 時已 `ready`。V2 unit 4,983、正式 browser 2,273（80 組／320 HTTP／0 page errors）、desktop bundle／manifest／catalog／cache／package 均通過；正式 5 份程式／清單與 240 aliases 共 245／245 HTTP bytes／SHA PASS。使用者實際點按 launcher 的 UI 保留為交付後確認，本輪沒有改動其安裝 receipt。
- 文件交付：本段同步 `DEV_WORKFLOW.md`、`PROJECT_OVERVIEW.md`、`GAME_RULES.md`、`FILE_MAP.md`，新增 `CARD_DEPTH_VISIBLE_V2_RELEASE.md`；文件存在與限定 `git diff --check` 檢查，不另執行模型或部署。
- 回滾優先僅撤回 V2 runtime／預載策略，保留 alias、catalog、immutable manifest 與 CAS，避免已更新 receipt 觸發反降版保護；不要拿 V1 之前的回復點撤銷這次更新。

## Card Depth V1 全套 80 卡（2026-09-07，候選驗收通過／尚未發布）

- 使用者同意免費模型的本機製作流程。新增 `tools/card-depth/` 製作、檢視、SAM 局部 alpha 修補及逐卡保護配方；模型與獨立 Python 環境在 D:/Codex_Tools，不修改遊戲套件、不把模型傳給玩家。
- 最終 80 張已完成美術審查與重建，`public/card-depth/v1/` 共 240 個 WebP、13,632,032 bytes；80 個原圖 SHA 與 240 個分層素材 SHA／大小全數核對通過。清單為 `docs/CARD_DEPTH_V1_ASSETS.json`，LF SHA-256：`88d1f47444cfc6bedbdfce27648947530909f1f8323d4ff8842ce699092969db`。
- Card Finish JS/CSS 按需載入背景、人物及固定框 alpha mask，原字與框沿用原圖；人工修補僅改 alpha，不重畫、不改原卡或共用遊戲規則。C／D 的 22 份頂層工具與 6 份 jobs 雜湊一致，模型／venv 不進 Git 或 public。
- `npm start` 8849 成功；runtime 單元 4,901、最終全卡 browser 2,262 項 PASS，涵蓋 80 組／320 個真實 HTTP 回應，page errors 0。最終素材清單與精確 282 個候選路徑均通過唯讀核對；這不是正式站部署後驗收。
- 真實兩帳號 candidate 連續兩輪 PASS：`real-candidate-2026-09-06T17-59-45-524Z.json` 的 hand、drawn、peerSync、depthHand、depthDrawn 均為 true；`real-candidate-2026-09-06T18-00-44-158Z.json` 另完成 6 次出牌，涵蓋基德取回後繼續選牌與香吉士 PK，直到自然 ended。兩份證據均在 D 樹 `artifacts/card-finish-v1/`，page errors 皆為 0，console 仍各有 4 筆既有媒體 404；不宣稱全站零 404。首輪基拉對話 QA 失敗證據仍保留。`naturalDisabledSeen` 只證明技能禁選數字；兩輪皆未完成禁選卡片的真人阻擋案例，不得把 `choiceDisabledBlocked: false` 改述為通過。
- 本輪僅局部同步 C／D 的 `DEV_WORKFLOW.md`、`PROJECT_OVERVIEW.md`、`FILE_MAP.md`、`GAME_RULES.md` 頂端 Card Depth 狀態，保留各樹原有歷史與其他差異。三份新增驗收工具及來源／授權索引詳見 FILE_MAP。
- 回復點 `01d6c760` / `codex/rollback-before-card-depth-v1` 已保留。尚未 push／部署，接續的部署、正式 live 與 SW 更新驗收由主流程完成；詳見 `docs/CARD_DEPTH_V1_RELEASE.md`，目前不宣稱正式上線。

## Card Finish 出牌固定框修正 V3（2026-09-06，已發布）

- `public/css/card-finish-v1.css` 將出牌 button 固定背景／邊框／陰影／chooseCardGlow 移除，保留穩定 hit target；卡面金色細邊／呼吸提示／鍵盤焦點都跟隨 face 傾斜。冰凍遮罩及禁選維持原行為。
- 併入 V2 出牌 8°、圖鑑 12°；`game.html` 只更新兩個引用為 `20260906-finish-frame-v3`，`card_finish_v1.js` 不改其他邏輯。沒有改卡圖、規則、server、DB 或同步。
- 兩份既有 QA 工具新增透明固定層／face 光／邊角等檢查：單元 4,441、browser 215 項 PASS、0 page errors，桌機與觸控／reduced、禁選與點擊皆通過。真 SW 舊 V1 baseline 19 項 PASS。npm start 8849 成功；本機無 DB，未拿 fixture 冒充正式登入。
- 程式提交 `ff72fbfb` 已推送 main，21:00:08（Asia/Taipei）驗證正式三檔 bytes 與 Git blob 相同。postdeploy 139 項 PASS，真舊 SW profile 升級及乾淨桌機／觸控／reduced 皆通過。程式提交白名單為公開三檔、兩份 QA 腳本與五份文件；全部同步 C 主來源，保留其他未發布修改。
- 正式雙帳號測試發現 QA 原先錯誤假設所有出牌都增加棄牌數，對基德正常取回棄牌誤判 timeout。只補正 `scripts/card_finish_live_qa.js`（C、D 同步），保留單次送出、原 slot、真 backend／Socket、peer 與隱私檢查；`--self-test` 原 engine 18 項及語法檢查 PASS。原失敗證據保留，回復點為 7655c7b9／`codex/rollback-before-card-frame-v3`，撤回用 scoped revert ff72fbfb。
- 最終驗收、SHA、兩帳號報告及界線詳見 `docs/CARD_FINISH_V1_RELEASE.md`。QA／文件補記使用 `[skip render]`，不改 public、不重啟正式服務。
- 21:06:34 的正式雙帳號重跑 PASS：手牌基德／新抽基拉各一次 PLAY_CARD，目標、對手公開 state、回合及私牌隱藏通過，四接點有效，code substitution 0、page errors 0。當次未自然遇到禁選，仍由 renderer fixture 覆蓋；4 筆其他 404 如實保留。報告 `artifacts/card-finish-v1/real-live-2026-09-06T13-06-34-303Z.json`，測試房與瀏覽器均已清理。

### 前一輪 V2 本機紀錄（歷史，併入 V3）

- 依使用者要求，`public/js/card_finish_v1.js` 的滑鼠合成最大傾角：出牌 2.5°→8°、圖鑑 6°→12°；光膜強度、150ms 過渡、原點擊與遊戲流程不變。
- `public/css/card-finish-v1.css` 只在卡片實際傾斜時放寬按鈕 overflow，防止卡面邊緣被裁切；冰凍／禁選／靜態時仍沿用原遮罩及裁切。game.html 的兩個引用更新為 `20260906-finish-tilt-v2`，未改 inline 遊戲程式。
- 同步兩份 QA 工具：單元 4,441 assertions PASS；browser 193 checks PASS、0 page errors，包含 8°／12° 四邊與角落、復位、兩卡間隙不誤選、禁選／冰凍、桌機與手機模擬、reduced-motion。已目視檢查傾斜截圖，卡面完整。npm start 在 8849 可開；本機無資料庫，不宣稱這次新增正式登入／多人验收。
- 上述五個程式／工具檔及紀錄同步到 C 槽主來源與隔離樹。沒有 commit、push 或部署；線上仍是已驗收的 986430ca。報告與截圖：`D:/Codex_Release_Worktrees/card-holo-v458-release/artifacts/card-finish-tilt-v2/`。

## Card Finish V1 正式發布完成（2026-09-06）

- 已部署 `986430ca300ea32bb0f06f4cdf9aba4b1a96db68`；正式 game.html、新 CSS／JS 三檔 bytes 與 Git blob 相同，未帶入舊 GPL 候選或其他未發布修改。
- 單元 4,437、browser 172、predeploy 93、postdeploy 97 項 PASS。正式 live 雙帳號已完成 hand／drawn、自然青雉冰凍禁選、技能目標與對手同步；舊 SW 更新、乾淨桌機／觸控／減少動態也通過。手機為模擬，娜美禁選為 fixture；不宣稱全站零 404。
- 新 runtime、三份 QA 腳本及五份文件同步回 C 槽主來源，其他未發布修改保留。回復點為 14d08902，使用發布提交的 scoped revert。完整 SHA、證據及限制見 `docs/CARD_FINISH_V1_RELEASE.md`。
- 最後驗收文件以 `[skip render]` 提交，部署程式維持 986430ca，不再重啟服務。

### 發布前驗收紀錄（歷史）

- 公開候選範圍只有 `public/game.html`、`public/css/card-finish-v1.css`、`public/js/card_finish_v1.js`。新 CSS／JS 由獨立來源完成，`game.html` 只增加四個卡面接點、圖鑑容器 class 與兩個 versioned 引用；不改原 inline 遊戲程式。
- 獨立來源審核無 blocker。`card_finish_unit_qa.js` 為 `4,437` assertions PASS；`card_finish_browser_qa.js` 為 `172` 項 PASS、`0` page errors。
- 正式雙帳號已在 production backend／engine／Socket 建立 `0 CPU` 雙真人候選對局。手動驗收的手牌／新抽牌各一次權威 `PLAY_CARD` 均只送一次且另一端一致，騙人布數字 `1` disabled 的實體點擊也沒有送事件。連續 `card_finish_live_qa.js` candidate runner 另自然遇到青雉冰凍：冰凍手牌實體點擊不送 `ACTION`、state 不變，之後香吉士 drawn 與兩次 `PICK_TARGET` 正常完成；hand／drawn／peer sync／finish hooks／自然禁選與禁選攔截皆為 true，page errors 為 `0`。
- `card_finish_release_qa.js --phase predeploy` 為 `93` 項 PASS，涵蓋 desktop／mobile／reduced、四份實際資源 SHA 與舊 `op-card-v7.5` Service Worker profile。娜美兩牌禁選仍只有 fixture 覆蓋，尚未自然遇到；正式站上線後的 live／postdeploy 也尚未執行，因此不能視為已部署。
- 未 commit、push 或部署，也未修改 server、DB、卡牌規則、Board、存檔或同步。詳細來源邊界、回復方式與驗收限制見 `docs/CARD_FINISH_V1_RELEASE.md`。

### Card V458 舊 GPL 候選（歷史，未上線）

- 前次五檔候選為當時的 `public/game.html`、`public/css/card-holo-v1.css`、`public/js/card_holo_v1.js`、`public/third_party/pokemon-cards-css/NOTICE.md` 與 `LICENSE.txt`。相關檔案留在本機且維持原授權，不納入 Card Finish V1 發布，也不以改標方式重新發布。
- 舊 38／82／51 項 QA 與未完成真實出牌的狀態只作歷史紀錄，詳見 `docs/CARD_HOLO_V458_RELEASE_REPORT.md`。

## 修改紀錄：桌面啟動器 1.1.4 發布準備 V463（2026-09-06，R2 已上傳／Render 待驗證）

- 內容與邊界：`1.1.4` Windows x64 安裝包已納入 V461 高效能 GPU 偏好與 V462 桌面遊戲游標接管；沒有新增 Card／Board gameplay、同步或存檔變更。《霸海戰棋》維持 disabled，`public/images/ranks/r5.PNG`、`r6.PNG` 繼續排除且未修改。
- 產物：本機候選為 `D:\OnePieceDesktopBuilds\release-1.1.4\ONE-PIECE-Tabletop-Launcher-1.1.4-x64.exe`，大小 `152,113,427` bytes，SHA-256 `f6edd9313eb51bbc8e75ac52cdd55a7df26a39ec47090c0c97efab8b9d90bcb9`。同一 immutable installer 已上傳至 `https://game-assets.rihdi.tw/desktop/launcher/releases/1.1.4/ONE-PIECE-Tabletop-Launcher-1.1.4-x64.exe`；完整下載為 HTTP 200、bytes／SHA 一致（cache MISS），Range `0-63` 為 HTTP 206、MZ 64 bytes（cache HIT）。
- 更新信任：Ed25519 signed candidate 已驗證並提升為 `public/desktop/launcher-release-v1.json`。更新服務驗證 `current=1.1.3` 回傳 `updateAvailable=true`，同版 `1.1.4` 回傳 `false`；舊 `1.1.2` 因未內建新信任根，仍需手動安裝新版。
- QA：GPU preference、Web cursor、source／packaged Electron cursor `168` assertions、update service、signature、R2 publisher、Service Worker isolation、deployment manifest、catalog，以及 source／packaged／installer package QA 均 PASS。packaged media 的 Range `206`、cache hit 與 NVIDIA active GPU smoke 亦 PASS；`npm start` 於 8797 的三個入口回 HTTP 200。因本機沒有資料庫，本輪不宣稱新增正式登入驗證。
- 待發布驗證：R2 完整下載與 Range 已通過；Render source 尚待部署與線上驗證，因此 V463 仍不記為完整正式發布。V461／V462 的本機 hotpatch 紀錄保留為當時歷史狀態。

## 修改紀錄：桌面遊戲游標全框架接管 V462（2026-09-06）

- 目標：修正 Card／Board 在桌面啟動器內仍會因頁面原生 `text`、`zoom`、`grab`、`wait` 或動態 iframe 樣式而暫時跳回系統游標的問題；沿用已核准的巴奇白手套與娜美羽毛筆三態圖片及既有熱點，不重畫、不改素材檔名。
- Web 樣式：`public/css/card-cursor-buggy-v3.css` 與 `board-cursor-nami-v3.css` 升為 V4 規則，改以 `any-hover:hover`＋`any-pointer:fine` 支援同時具備觸控與滑鼠的裝置，讓一般、可互動與按下狀態一致使用各遊戲 theme cursor。原生文字、縮放、抓取、等待等游標外觀會被 theme 取代，但文字輸入 caret、點擊行為與明確拖曳功能本身不變。
- Web 回饋：`public/js/game_cursor_feedback_v1.js` 加入 V4 guard，只處理必要的 pointer event；遇到 runtime inline `cursor:... !important` 時才做最小範圍修正，並預載三態圖。舊 V1 已存在時會升級同一 guard，不重複綁定或產生雙圈；不增加 `mousemove`、`requestAnimationFrame` 或全 DOM 輪詢。
- 網頁接點：Card 六頁與 Board 九個正式 document／iframe 的 CSS、JS query 統一升版，避免沿用舊 V3 CSS／V1 feedback 快取；既有十五頁範圍、圖片路徑及黑墨／紅金點擊效果維持不變。
- 桌面框架：新增 `desktop/game-cursor-policy.js`，在 `webContents` 的主 frame／`frame-created`／`dom-ready` 注入打包內同一份 theme CSS 與 feedback script。只允許遊戲正式 exact origin，繼承的 `about:blank`／`about:srcdoc` 還必須有可信任父 frame，且 payload 會在 renderer 再驗證 origin；不新增 IPC、`nodeIntegrationInSubFrames` 或 renderer Node 權限。`desktop/main.js` 在遊戲正式 launch 前安裝 policy，V461 GPU 偏好保持原樣。
- 打包：`desktop/package.json` 將 `game-cursor-policy.js` 列入 ASAR 白名單，並把兩份 public CSS 與 `game_cursor_feedback_v1.js` 原位元組複用到 `cursor-policy/` extraResources；不複製第二套游標規則或圖片。source 與本機已安裝版的 `desktop_launcher_package_qa` 均 PASS，結果為 `235` 個 ASAR entries、`77` 個 launcher files、catalog 加 Card／Board 兩份 manifest 共 `3` 檔，三份 cursor-policy 資源與 public 原檔 SHA 完全一致；Chess 仍是 disabled，只有 Card／Board 兩款可玩。
- Web／框架驗證：本機 `GAME_CURSOR_QA=PASS`，涵蓋 Card 6 頁、Board 9 頁、touch、legacy guard、動態 native cursor 與 explicit drag。Electron 44.1.1 的 fallback fixture `desktop_game_cursor_qa` 在 source 為 `168` 項 assertions／`1.67s` PASS，在本機已安裝 ASAR＋resources 為 `168` 項／`3.78s` PASS，另一次獨立重跑為 `168` 項／`1.5s` PASS；涵蓋主／子／about frame、origin、inline `!important`、三態、input／drag 與 cached resources。
- 本機套用：已 hotpatch `D:\ONE PIECE TABLETOP SERIES\resources\app.asar`，SHA-256 為 `8c66dc3d3aa840482aa57cdbfdf853b407f10dbcb8b5e256754838aa76d139ee`，並把三份實際資源複製到 `resources\cursor-policy\`。相較原有內容只變更 ASAR 既有 `main.js`／`package.json` 並新增 `game-cursor-policy.js`；復原檔重用 `D:\Codex_BuildCache\launcher-gpu-v461\app-gpu.asar`，SHA-256 `f923dd67a1a043ade779cfdb23a9655ed20981b262b99ad90b315c25bbed731b`，沒有再建立重複備份。
- 已安裝回歸：`DESKTOP_INSTALLED_MEDIA_SMOKE=PASS source=packaged cache=hit chromiumCache=selected-root`；Card image／audio／video 與 Board audio／video 都由本機命中並通過 Range `206`。V461 的 high-performance request 保留，NVIDIA GeForce GTX 1050 Ti active、Intel HD 630 inactive，GPU compositing／rasterization／video decode／WebGL 均 enabled；GPU preference 與 Service Worker isolation QA 也 PASS。這些是游標、媒體及啟動接點驗證，不宣稱為完整遊戲長時間壓力或 FPS benchmark。
- QA 診斷：已安裝 fixture 第一輪曾在 120 秒逾時；測試腳本補上 stage、bounded `loadURL`／`executeJavaScript` 與 teardown 診斷後重跑 3.78 秒通過，沒有因診斷而修改 product。`npm start` 在本機 8797 的 `start.html`、`board_start.html`、`board_game.html` 都回 HTTP 200，檢查後已正常停止 server。
- 發布與相容：版本維持 `1.1.3`；本輪不重建 NSIS、不發布 Render／R2，其他玩家尚未取得 V462。只處理網頁內容區的桌面游標 UI；OS 對話框、原生視窗 titlebar 與網頁外的 native drag 不在此 cursor policy 範圍。本機套用沒有修改帳號、素材快取、遊戲儲存、Card／Board 規則、同步、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。

## 修改紀錄：桌面啟動器高效能 GPU 偏好 V461（2026-09-06）

- 目的：讓桌面啟動器與其開啟的 Card／Board Electron 視窗預設向 Chromium 要求高效能 GPU，改善多顯示卡 Windows 電腦可能把遊戲分配到省電顯示核心的情況；這是 adapter 選擇偏好，不是效能保證或遊戲渲染架構重寫。
- 啟動順序：`desktop/main.js` 在載入任何專案模組、建立 `BrowserWindow` 及 `app.whenReady()` 前只呼叫一次 `configureGpuPreference(app.commandLine)`。一般情況加入 `force_high_performance_gpu`；若啟動參數已明確指定 `disable-gpu`，保留軟體模式，若指定 `force_low_power_gpu`，保留省電模式，不追加互相衝突的 switch。既有 `force_high_performance_gpu` 亦不重複加入。
- 安全邊界：不呼叫 `app.disableHardwareAcceleration()`，也不加入 `ignore-gpu-blocklist`，不修改 Windows 登錄檔或玩家系統設定。只有一張顯示卡或沒有獨顯時，仍由 Chromium 在安全清單內選擇可用 adapter；多張獨顯時本功能也不會自行 benchmark 並保證挑出絕對最快的一張。
- 診斷：只有既有 smoke 模式會以 `app.getGPUInfo('complete')` 收集 `requestedPreference`、active adapters、renderer 與 feature status。查詢設有 3 秒上限，逾時或 API 失敗只寫入 `unavailable` 診斷，不會拖慢或阻擋一般玩家啟動；正式 UI、日誌及遊戲狀態不新增 GPU 資訊。
- QA：新增 `scripts/desktop_gpu_preference_qa.js`，靜態與 VM fixture 驗證 software／low-power／high-performance 三條路徑、冪等性、設定時機及未關閉硬體加速；結果為 `DESKTOP_GPU_PREFERENCE_QA=PASS`。`scripts/desktop_launcher_package_qa.js` 亦為 PASS。開發版及已安裝 1.1.3 executable 的 smoke 都通過，實機回報 active adapter 為 `NVIDIA GeForce GTX 1050 Ti`、renderer 為 ANGLE D3D11，`Intel(R) HD Graphics 630` 為 inactive；`gpu_compositing`、`rasterization`、`video_decode` 與 WebGL 都是 enabled。
- 媒體回歸：Card／Board 抽樣的 image／audio／video 均通過完整讀取、Range `206` 與 `cache=hit`。這些結果證明 GPU request、硬體加速狀態與本機媒體供應接點正常，不等於完整遊戲場景的 FPS、延遲或長時間效能 benchmark。
- 補充驗證：`node --check`、`git diff --check`、`desktop_runtime_asset_cache_qa`、`desktop_service_worker_isolation_qa` 均通過；`npm start` 在本機 8797 成功啟動，`board_start.html`、`board_game.html`、`start.html` 皆 HTTP 200，檢查後停止測試 server。本機未設定 DATABASE_URL，因此此項僅確認靜態頁面可開，不宣稱驗證正式帳號與資料庫。既有 `r5.PNG`／`r6.PNG` 未修改。
- 本機套用：已把驗證後的 `main.js` 單檔套入 `D:\ONE PIECE TABLETOP SERIES\resources\app.asar`。套用前後共 `185` 個 ASAR 內檔逐一比對 SHA，只有 `main.js` 改變；新 ASAR SHA-256 為 `f923dd67a1a043ade779cfdb23a9655ed20981b262b99ad90b315c25bbed731b`。唯一 rollback 位於 `D:\Codex_BuildCache\launcher-gpu-v461\app-before-gpu.asar`，大小約 3 MB，原 SHA-256 為 `b87de74b5971f8bb0937b3bb918c7c2ad274094ad1431fdbf564e560e432772e`。
- 發布狀態：本輪沒有發布 Render／R2、沒有重建 NSIS，也沒有變更 `1.1.3` 版號；R2 上 immutable 1.1.3 原始安裝包保持不變，因此其他玩家尚未取得本次 GPU preference，必須等未來新版安裝包才會配送。這次本機 ASAR 套用沒有修改帳號、素材快取、遊戲儲存或 Windows 登錄檔。
- 相容範圍：沒有修改啟動器 UI、Card／Board 規則、戰鬥、同步、資料 id、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。

## 修改紀錄：桌面啟動器 1.1.3／簽章更新與快取安全 V460（2026-09-06）

- 版本與範圍：`desktop/package.json`／`package-lock.json` 升為 `1.1.3`，正式 Windows x64 包仍只包含本機啟動器、兩款遊戲所需的目前 catalog／manifest、核准的啟動器 UI 素材與兩支預覽影片；Card／Board 大型媒體不塞進 NSIS，而由安裝後的素材下載器取得。《霸海戰棋》仍只展示且不可安裝。
- 素材來源：Card／Board 的圖片、音樂、影片與字型以 `public/desktop/catalog-v1.json` 的 `assetBlobBaseUrl` 指向 Cloudflare R2 immutable CAS；正式啟動器只接受 `https://game-assets.rihdi.tw/desktop/blobs/sha256`，測試來源只能由 QA 明確注入本機 loopback。R2 失敗時逐檔退回 Render，兩個來源都必須通過 manifest 的 size／SHA-256 才能進入 receipt／last-known-good。網頁程式、登入、聊天室、房間、存檔與 WebSocket 仍由 Render 負責。
- 啟動器更新信任：`desktop/launcher-update-service.js` 內建經審查的 Ed25519 公鑰。只有版本高於本機的 `updateAvailable` manifest 才必須包含固定欄位的 `artifact` 與 `signature`；簽章覆蓋 schema、channel、platform、arch、version、publishedAt 及完整 artifact，未知演算法、未知 keyId、遭修改內容、錯誤簽章、非允許 HTTPS origin、錯誤檔名／大小／SHA-256 或非 MZ／PE 檔案都 fail closed。Render 與 `https://game-assets.rihdi.tw` 是目前唯二允許的安裝檔來源。
- 簽章金鑰：私鑰只存在 `%LOCALAPPDATA%\ONEPIECE-Tabletop\publisher\launcher-signing-key.json`，以目前 Windows 使用者的 DPAPI 保護；repo 與啟動器只保存公鑰。`initialize-launcher-signing-key.js` 負責建立／檢查金鑰，`sign-launcher-release.ps1` 只在簽章子程序期間解密並注入 private PKCS8，輸出到 Local AppData 的候選區，不會直接覆寫公開 manifest。換電腦或 Windows 使用者時必須使用受控移轉方式或建立新版公鑰啟動器，不能只複製 DPAPI 密文。
- 安裝檔發布：`publish-launcher-artifact.js`／`publish-saved-launcher.ps1` 只接受經人工確認版本、bytes 與 SHA-256 的 canonical x64 `.exe`，先驗證 MZ／PE，預設 dry run；live 只可寫入 `desktop/launcher/releases/<version>/<filename>`，使用 HEAD、`If-None-Match: *` 條件式 PUT 與發布後 HEAD，禁止刪除或覆寫既有版本。發布 artifact 與簽章 release manifest 是兩個分離步驟。
- 1.1.3 正式安裝檔：`https://game-assets.rihdi.tw/desktop/launcher/releases/1.1.3/ONE-PIECE-Tabletop-Launcher-1.1.3-x64.exe`，`152,106,399` bytes，SHA-256 `c51a5e5bd7a2fed5f27fce3a8745cb8abc37f72a8ed678c305eccfc2f7894e0b`。live 發布後第二次執行得到 `skipped`，公開網址完整下載回來的 bytes／SHA 完全一致；Range 回應 `206`，Cloudflare 快取由 `MISS` 轉為 `HIT`。安裝檔未配置商用 Authenticode 憑證，因此 Windows 仍可能顯示未知發行者。
- 1.1.2→1.1.3 過渡：`public/desktop/launcher-release-v1.json` 暫時保留 V454 的 `1.1.2` 且不宣告 artifact，避免舊 1.1.2 客戶端嘗試使用它尚未信任的 R2 更新來源。1.1.3 先以人工安裝完成信任根更新；之後的 1.1.4+ 才能由 1.1.3 驗證 Ed25519 manifest 並從 R2 自動更新。
- 快取與解除安裝安全：`desktop/asset-store.js` 拒絕磁碟根／UNC 分享根作下載位置，快取根必須具有 `.onepiece-tabletop-cache-owner-v1.json` 且內容精確對應目前路徑；舊快取只有在 receipt／manifest 目錄及內容完整通過驗證後才會被接管。所有受管理父層在寫入、改名、清理或解除安裝前都會逐層 `lstat` 拒絕 symlink／junction，並用 `realpath` 確認仍在實際快取根內；另一款遊戲仍引用或正在下載的共用 SHA blob 不會被刪除。
- 啟動器專用盒彩：`launcher_{card,board,chess}_{lid_front_panel,box_shell_fixed}_v1.png` 六張圖由 `desktop/package.json` 明確打包並經 `opui://launcher` 顯示；`build_desktop_game_catalog.js`／QA 將這六張與 `images/desktop_launcher/` 一樣視為 launcher-only，避免 Card／Board 下載清單重複攜帶只供啟動器翻盒動畫使用的素材。
- 驗證：`DESKTOP_LAUNCHER_UPDATE_QA=PASS` 覆蓋 Ed25519 正常／竄改／未知 key／錯誤來源、下載大小與 SHA、PE、取消及啟動；`LAUNCHER_MANIFEST_SIGNATURE_QA=PASS` 覆蓋簽章 canonical bytes 與 Windows DPAPI round trip；`DESKTOP_R2_LAUNCHER_PUBLISH_QA=PASS` 覆蓋 canonical key、dry run、條件式建立、metadata 衝突與無 Delete API；`DESKTOP_ASSET_STORE_QA=PASS` 覆蓋正式來源白名單、ownership、合法舊快取接管、磁碟根、managed junction、receipt／manifest 路徑、單款解除安裝與共用 blob 保護。package、catalog、Service Worker 隔離、設定與安裝後媒體 smoke 亦已通過。
- 修改範圍：桌面啟動器／下載器、R2 發布與簽章工具、對應 QA、六張新桌遊盒圖及三份專案文件；沒有修改 Card／Board 規則、資料 id、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`，因此 `docs/GAME_RULES.md` 不變。既有 `public/images/ranks/r5.PNG`／`r6.PNG` 工作樹差異未碰觸。

## 修改紀錄：桌面遊戲素材 Cloudflare R2 分發 V459（2026-09-05）

- 目的：把桌面啟動器安裝／更新 Card 與 Board 圖片、音樂、影片及字型時的約 1.8 GB 大檔流量移到物件儲存；Render 仍是帳號、API、HTML／JS／CSS、WebSocket、catalog 與 manifest 的控制面，不搬動網頁遊戲或多人狀態。
- R2：專用 bucket 為 `onepiece-game-assets`，公開讀取使用自訂網域 `https://game-assets.rihdi.tw`；內容以 SHA-256 去重並固定寫入 `desktop/blobs/sha256/<前兩碼>/<完整 SHA-256>`。`config/desktop-asset-delivery-v1.json` 是 catalog 建置時唯一的素材來源設定，產出的 `public/desktop/catalog-v1.json` 會帶 `assetBlobBaseUrl`，禁止帳密、query、fragment、非 HTTPS 公網或尾端斜線。
- CDN 快取：Cloudflare Cache Rule 名稱固定為 `ONE PIECE R2 immutable assets`，完整 URI wildcard 為 `https://game-assets.rihdi.tw/desktop/blobs/sha256/*`。命中範圍設為 Cache eligible；Edge TTL 與 Browser TTL 都採 origin，直接服從發布器寫入的 immutable Cache-Control，不另設容易和內容版本衝突的固定秒數。
- 啟動器：新版本先用 R2 的 immutable CAS URL 下載，再以原 Render 邏輯路徑作逐檔 fallback；兩個來源最後都必須通過 manifest 宣告的 size／SHA-256 才能寫入既有 `opcache` 與 receipt。Range 續傳、重試、取消、last-known-good 與損壞修復語意保留；R2 缺檔、暫時錯誤或位元組不符不會直接破壞上一個可啟動版本。
- 發布工具：`tools/desktop-r2-publisher/publish.js` 只讀正式 catalog 與 Card／Board immutable manifests，先驗證每個來源位元組，再按 SHA 去重。預設為不連網的 dry run；live 模式只執行 `HeadObject` 與帶 `If-None-Match: *` 的條件式 `PutObject`，使用正確 MIME、`public, max-age=31536000, immutable` 與 `sha256` metadata，既有物件若 metadata 不一致便停止，沒有刪除或覆寫路徑。
- 憑證：R2 Access Key ID／Secret 只允許 bucket `onepiece-game-assets` 的 Object Read & Write。`save-r2-credential.ps1` 從剪貼簿逐欄接收後立即清空剪貼簿，使用目前 Windows 使用者的 DPAPI 加密到 `%LOCALAPPDATA%\ONEPIECE-Tabletop\publisher\r2-credentials.json`；`publish-saved-r2.ps1` 僅在發布程序期間解密成 process environment，結束後還原／清除。密鑰不得寫入 repo、文件、啟動器、安裝檔、catalog、manifest、命令歷史或 Git。
- 相容性：網頁版仍直接由 Render 供應原路徑；既有啟動器會忽略新增的 catalog 欄位並繼續向 Render 下載。支援 R2 的新版啟動器也保留 Render fallback，已驗證的舊 receipt／CAS 可直接沿用，所以這次切換不要求玩家重抓相同 SHA 的素材。沒有更動 Card／Board 規則、帳號、房間、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。
- 驗證：`desktop_r2_publish_qa.js` 覆蓋兩份 manifest 去重、Git committed SVG 位元組、dry-run 無網路、既有物件略過、metadata 衝突拒絕、412 競態後重驗與無刪除路徑；`desktop_asset_store_qa.js` 覆蓋 R2 優先、Range 續傳／重試、SHA 失敗不污染 LKG 及 Render fallback；`desktop_game_catalog_qa.js` 鎖定正式 HTTPS 來源與設定檔一致。首次正式 live upload 已上傳 `3486` 個唯一 blob、共 `1,800,547,515` bytes，全部成功；緊接著第二輪得到 `uploaded=0`、`skipped=3486`，確認物件可重跑且沒有重複上傳。自訂網域實測第一個完整請求為 Cloudflare cache `MISS`，再次請求轉為 `HIT`，Range 請求回應 `206 Partial Content`。
- 修改檔案：`config/desktop-asset-delivery-v1.json`、`desktop/asset-store.js`、`public/desktop/catalog-v1.json`、`scripts/build_desktop_game_catalog.js`、三支 R2／catalog／asset-store QA、`tools/desktop-r2-publisher/` 與三份專案文件；既有 `public/images/ranks/r5.PNG`／`r6.PNG` 工作樹差異未碰觸。

## 修改紀錄：多人續戰略過玩家擲骰／戰鬥四鍵排版 V458（2026-09-05）

- 問題：玩家完成一輪戰鬥、回合交給下一名玩家，再輪回自己續戰後，點擊攻擊會沒有玩家骰便直接執行敵方；右下攻擊／夥伴／道具／逃跑四鍵也過度貼近外框且間距不一致。
- 根因：`startBattleRound()` 只清除 battle 頂層的 `playerPerformedAction`、骰值與摘要，沒有把新輪狀態存回 `battle.coop.runtimes[playerId]`。`prepareCoopBattleCommandRuntime()` 在玩家點招時因此把上一輪 `playerPerformedAction=true` 套回，結算器便略過玩家。另有 `firstActor`／`secondActor` 沒在新輪清除，使續戰可能沿用上一輪敵方先攻。
- 修正：新輪一律清空兩個先攻欄位，並在一般開輪、Boss／四皇開輪提示、最終關卡提示、開輪狀態中斷及提示續行完成後，把清空及開場效果處理後的狀態寫回既有共鬥 runtime。沒有改 `gameState` schema、角色／招式／道具 ID、localStorage key、Socket.IO event 或完整快照架構。
- 排版：`board_battle.html` 的主指令網格改為桌機左右各 5.25% 安全內縮、水平與垂直共用 `clamp(8px, 1vw, 14px)`；1100px 以下縮小 gap，且 600px 以下低高度橫向畫面改為左右各 15% 內縮，讓兩列維持正 gap 且不碰框。其他招式／道具／替補網格未改。
- 驗證：`node --check public/js/board_game.js` 與新 QA 通過。`BATTLE_TURN_RESUME_ACTION_QA=PASS` 實跑兩玩家交棒：續戰由第 1 輪進第 2 輪，全域與 runtime 的 performed／dice／summary 皆清空，舊 enemy-first 亦清空；由 iframe 點香吉士招式後先得到玩家骰 5、敵骰仍空、PP 25→24。四鍵在 1920×1080 的左右內距各 48.375px、gap 14px，在 932×430 的左右內距約 55.03px、水平／垂直 gap 約 6.95／6.86px，均無溢出。
- 相容回歸：`battle_refresh_recovery_qa.js` 五種 queued／visual／fallback／observer／spar 同輪刷新接回通過；`lan_refresh_flow_qa.js` 的兩裝置房間、回合同步及雙方續戰 overlay 通過；`coop_battle_view_switch_qa.js` 的三人共鬥操作／觀看切換、窄版與圖片檢查通過。本機未設定 `DATABASE_URL` 的警告只影響 DB 功能，靜態 Board QA 正常。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/battle_turn_resume_action_qa.js` 及四份專案文件；既有 `public/images/ranks/r5.PNG`／`r6.PNG` 工作樹差異未碰觸。

## 修改紀錄：娜美羽毛筆方向／拖曳與全螢幕卷軸 V457（2026-09-05）

- 需求：《新世界航海錄》的羽毛筆改為筆尖朝左下；拖曳地圖與可抓取物件時不能跳回系統 `grab`／`grabbing`；兩款遊戲在全螢幕／無邊框顯示時隱藏右側白色根層卷軸。
- 根因：V456 只在 `html`／`body` 套用羽毛筆，而且刻意保留原生拖曳語意；`.board-viewport` 等子元素的 `grab`／`grabbing` 因 CSS 優先序蓋掉自訂游標，舊 QA 也把這項覆蓋誤當成應保留行為。
- 素材：保留所有 V2 原圖，新增 `board_cursor_nami_quill_*_v3.png`。三態均由核准 V2 精確逆時針旋轉 90 度，維持 48×48 RGBA 真透明；default／pointer 熱點校正在 `(4,43)`，pressed 校正在 `(5,43)`。
- 接入：Board 九個正式頁改載入 `board-cursor-nami-v3.css`，主地圖、血統因子圓筒、水之七島船艦校位、Tot Musica 名單與原生 draggable 皆持續使用羽筆；拖曳按下時切到 pressed。Card 六頁改載入 `card-cursor-buggy-v3.css`，外觀仍沿用核准的 V2 巴奇白手套。兩款 V3 CSS 只隱藏 `html`／`body` 的卷軸外觀，不封鎖 overflow，因此滾輪、觸控與鍵盤捲動仍有效，聊天室／modal／清單等內層卷軸不受影響。
- 邊界：文字輸入、卡牌海報放大、Board 準星／等待及 touch-only 原有語意不變；共用點擊腳本、帳號、房間、戰鬥、回合、存檔、`BOARD_GAME_STATE` 與 Socket.IO event 均未修改。
- 驗證：`node --check scripts/game_cursor_qa.js` 通過；隔離 8847 伺服器實跑 15 頁，逐像素確認 V3 是 V2 的精確 90 度旋轉且筆尖位於左下，驗證拖曳前後都不掉筆、根層卷軸不可見但 Card／Board 各可滾動 640px、內層 overflow 未被鎖死及 932×430 touch-only 排除。結果為 `GAME_CURSOR_QA=PASS`。
- 桌面更新：重建 image／unified asset manifest 與遊戲 catalog，Board 更新為 `assets-eb95373ee6ab1aa3`（3451 檔）；Card 素材未變，沿用原 immutable manifest 與原 SHA。建置器現在會安全重用內容相同但建立時間較早的 immutable manifest，圖片清單以最後一次 `public/images` 變更 commit 為來源；舊 Board manifest 暫留正式站供 rollout 回退，但新版啟動器打包篩選只帶 catalog 當前引用的 Card／Board 兩份清單。

## 修改紀錄：巴奇白手套／娜美羽毛筆游標 V456（2026-09-05）

- 需求：依確認稿把卡牌游標改成只保留白手套與短袖口、完全沒有手臂；平常／可點擊使用張開手勢，按下時換成捏合手勢。《新世界航海錄》改用娜美畫海圖的白羽毛筆，筆尖為真正熱點。
- 素材：由核准的透明 ImageGen 母圖等比例縮製六張獨立 48×48 RGBA PNG，新增 `card_cursor_buggy_glove_*_v2.png` 與 `board_cursor_nami_quill_*_v2.png`；V1 素材與 CSS 保留作可回復版本，不覆寫原圖。
- 接入：Card 六頁改載入 `card-cursor-buggy-v2.css`，Board 九頁改載入 `board-cursor-nami-v2.css`；既有 `game_cursor_feedback_v1.js` 的無狀態事件橋不改。巴奇點擊仍採短紅金回饋；娜美的點擊回饋改成不規則黑墨手繪圈與小墨點，不再顯示藍色光圈。
- 邊界：只改桌機精準游標與視覺回饋；touch-only、文字輸入、disabled、卡牌海報放大，以及 Board 既有拖曳／準星行為維持原狀。沒有改帳號、房間、卡牌、戰鬥、回合、存檔、`BOARD_GAME_STATE` 或 Socket.IO event。
- 驗證：`node --check` 通過；隔離 8846 伺服器的 `game_cursor_qa.js` 實跑 Card／Board 三態、六張不同 SHA 的 48×48 RGBA 真透明 PNG、巴奇／筆尖熱點、黑墨圈、disabled／text／zoom-in／grab／grabbing／crosshair／wait、按下清理與零水平溢出；932×430 touch-only 不套用自訂游標。結果為 `GAME_CURSOR_QA=PASS`。

## 修改紀錄：兩款遊戲專屬三態游標 V455（2026-09-05）

- 需求：《偉大航道爭霸戰》使用巴奇白手套造型，《新世界航海錄》使用娜美海圖筆造型；兩款遊戲各自擁有預設、可點擊、按下三態，不能共用啟動器的 `opui://` 私有素材路徑。
- 素材：以內建 ImageGen 產生兩張 RGBA 透明母圖，再輸出六張 48×48 正式 PNG。卡牌素材放在 `public/images/ui/cursors/`，Board 素材放在 `public/images/board/cursors/`，讓桌面下載 manifest 自動分到正確遊戲且不互相混入。
- 接入：新增 `public/css/card-cursor-buggy-v1.css`、`public/css/board-cursor-nami-v1.css` 與共用 `public/js/game_cursor_feedback_v1.js`。CSS 只在 `hover:hover` 且 `pointer:fine` 套用；既有 `pointer` 元素由語意 selector 或執行時 computed cursor 採用亮起態，按下時短暫使用 pressed 圖並顯示不攔截操作的 300ms 光圈。
- 範圍：Card 六個正式頁與 Board 九個獨立 document／iframe 均載入各自 CSS 與共用腳本。文字輸入仍使用 `text`，卡牌海報仍保留 `zoom-in`，Board 的 `grab`／`grabbing`／`crosshair`／`wait` 既有功能不在未按下時被覆蓋；touch-only 平板完全不啟用自訂游標或點擊光圈。
- 驗證：`node --check` 通過共用腳本與 `scripts/game_cursor_qa.js`。Chrome 實跑 1440×900 卡牌入口、Board 入口及戰鬥 iframe，確認三態檔名、按下 class／光圈建立與清理、文字輸入、六張 48×48 RGBA 真透明素材及零水平溢出；932×430 觸控情境確認不套用游標且不產生回饋節點。結果為 `GAME_CURSOR_QA=PASS`。
- 相容邊界：本次只新增客戶端游標外觀與輸入回饋，不改帳號、卡牌、角色、道具、回合、存檔、localStorage key、Socket.IO event、多人同步或 `BOARD_GAME_STATE`。

## 修改紀錄：桌面啟動器更新查詢入口 V454（2026-09-05）

- 新增 `public/desktop/launcher-release-v1.json`，提供正式站同源 HTTPS 的 stable／win32／x64 版本查詢入口；目前公開版本為 `1.1.2`。
- 本次 manifest 只表示現行版本，未宣告 `artifact`，因此 1.1.2 啟動器檢查時只會顯示「目前已是最新版本」，不會下載或執行檔案。未來只有在已完成新版安裝檔簽章、大小、SHA-256 與下載網址驗證後，才可加入 artifact。
- 發布範圍只有一份靜態 JSON 與四份文件，不改 Card／Board 程式、規則、存檔、帳號、Socket.IO event、localStorage key 或 `BOARD_GAME_STATE`；`public/images/ranks/r5.PNG`／`r6.PNG` 的既有工作樹差異未納入提交。

## 修改紀錄：卡牌進場隱藏遮罩回歸修復 V434（2026-09-04）

- 問題與原因：V433 改用預編譯 Tailwind 後，外部 CSS 先載入，但舊 inline `.modal { display:flex }` 在後方覆蓋 `.hidden { display:none }`，使空的通用對話框一進場便顯示全螢幕暗幕與中央空白橫框，並攔截所有操作。
- 修正：`public/game.html` 對 `#modal.hidden`、`#coinOverlay.hidden`、`#playedOverlay.hidden`、`#drawHint.hidden`、`#chooseHint.hidden` 加入明確 `display:none`；既有流程移除 `.hidden` 時仍照原條件開啟，不改對話框內容、動畫或操作入口。
- 回歸保護：`scripts/card_runtime_performance_qa.js` 檢查五條明確隱藏規則；`scripts/card_render_batch_browser_qa.js` 在實際載入後讀取所有進場遮罩、掛機提示與階段提示的 computed style，不依賴 `.hidden` class 本身來放行，確認沒有任何隱藏層暴露或攔截進場操作。
- 相容邊界：只修正卡牌頁 CSS cascade 與 QA，不改牌效、抽牌、回合、Socket.IO event、帳號、localStorage、存檔、桌面素材清單或 Board `BOARD_GAME_STATE`。
- 驗證：`CARD_RUNTIME_PERFORMANCE_QA=PASS`、`CARD_RENDER_BATCH_BROWSER_QA=PASS`（含 `overlays=hidden`）；兩支 QA 腳本均通過 `node --check`。`npm start` 後 `/game.html` 與靜態 CSS 均為 HTTP 200，頁面含 V434 selector 且沒有 Tailwind CDN。修改檔案另含四份專案文件，未碰使用者的 `r5.PNG`／`r6.PNG`。

## 修改紀錄：卡牌／桌面啟動器運行效能 V433（2026-09-04）

- 卡牌頁不再於執行時載入 Tailwind CDN 編譯器；`styles/card-tailwind.input.css` 經固定 Tailwind 3.4.17 產生 `public/css/card-tailwind-v1.min.css`，`public/game.html` 直接載入版本化靜態 CSS。`STATE`、會新增日誌的 `EMIT` 與相容 `addMsg()` 改由 `requestAnimationFrame` 合併同影格完整渲染；場地、棄牌、玩家與日誌使用穩定 fingerprint，只重建真正變動的區塊，牌堆彈跳也只在張數改變時觸發。
- 抽牌影片的 `ended`、點擊略過與 failsafe 現在共用單次 settled guard，完成時清除計時器及 listener，確保一次操作最多送一個 `DRAW`。麻痺自動跳過沿用既有 `_autoSkipKey`，同一 round／turn／draw／skipNext 狀態最多送一次，收到已離開該條件的 `STATE` 即同步清空。重複的牌堆 disabled 指派及第二份麻痺自動抽牌已移除；決鬥卡背統一使用既有較小的 `images/cards/back.webp`。
- 桌面端在遊戲開啟時把已驗證 manifest 建成 path／token 的記憶體索引，媒體 request hot path 只做 Map lookup，不再逐次執行 `stat` 或 SHA-256。單檔不超過 8 MiB 的素材共用最高 192 MiB 記憶體 LRU，並合併同檔並行讀取；超過 8 MiB 的影片／音訊維持串流與 Range 回應，不塞入 LRU。影音 seek／換場取消 Web stream 時會立即 unpipe 並關閉底層檔案串流，不會累積 HDD file handle；讀取長度異常才清除該遊戲索引並排入原有完整性／修復檢查，manifest／receipt／SHA 仍是內容權威。
- Card／Board 繼續使用分離的非持久 Electron partition，並以 `cache:false` 關閉 Chromium HTTP 磁碟快取；登入 localStorage 仍只活在本次程序。一般關閉再開遊戲不清除同次程序中的音量／顯示設定與 Board 手動存檔，只有登出、被踢或切換素材根目錄才清除；舊視窗遲到的 closed／renderer gone／load failure 也不能清掉後開的新視窗索引。V8 code cache 與 Chromium session／GPU／network cache 改放在玩家已儲存的素材根目錄之下，因此目前選擇 D 槽時會使用 D 槽的 `runtime/code-cache/<gameId>` 與 `runtime/chromium-session-v1`，不再把這些遊戲快取壓到 C 槽。帳號加密狀態仍留在原 userData，不做不安全的密碼遷移。桌面啟動器版本升為 `1.1.1`，`runtime-asset-cache.js` 已列入 ASAR 白名單。
- 相容邊界：沒有更動卡牌／Board 規則、角色或道具 ID、Socket.IO event 名稱、localStorage key、持久存檔 schema 或 `BOARD_GAME_STATE`。效能診斷初期 C 槽曾為 `0 bytes` 可用且 Chromium 明確回報 GPU／network cache 建立失敗；最後重測已有 32,965,406,720 bytes（約 30.7 GiB）可用。這個空間變化不是本次刪除使用者檔案所造成；程式仍將可安全移動的遊戲快取改放 D 槽，避免將來 C 槽壓力再度影響遊戲。
- 驗證：`CARD_RUNTIME_PERFORMANCE_QA=PASS`（draw pending／背景麻痺即時處理）、`CARD_RENDER_BATCH_BROWSER_QA=PASS`、`DESKTOP_RUNTIME_ASSET_CACHE_QA=PASS`（影音 cancel closed、repair=0、window guard、harden once）；`desktop_asset_store_qa.js`、`desktop_service_worker_isolation_qa.js`、`desktop_launcher_package_qa.js`、`desktop_game_catalog_qa.js` 均通過。實際安裝 NSIS 到獨立 D 槽目錄後，`desktop_installed_media_smoke.js` 驗證 Card WebP／MP3／MP4 與 Board MP3／MP4 的 HEAD、Range、全檔 SHA 及 `cache=hit`，並確認 Chromium cache 實際位於選定素材根目錄。`npm start` 後 `start.html`、`game.html`、卡牌靜態 CSS、`board_start.html` 與 `/api/board-runtime` 都回傳 HTTP 200；本機未設定 `DATABASE_URL` 的既有 DB environment warning 符合預期。最終 NSIS 為 `ONE-PIECE-Tabletop-Launcher-1.1.1-x64.exe`，131,819,132 bytes，SHA-256 `BC01662C9073193E9D04958A23EB1D46D266BA38F0281EC8E34F46FD92E257DF`。
- 修改檔案：`public/game.html`、`public/css/card-tailwind-v1.min.css`、`styles/card-tailwind.input.css`、根 `package.json`／`package-lock.json`、`desktop/main.js`、`desktop/runtime-asset-cache.js`、`desktop/package.json`／`desktop/package-lock.json`、`scripts/card_runtime_performance_qa.js`、`scripts/card_render_batch_browser_qa.js`、`scripts/desktop_runtime_asset_cache_qa.js`、`scripts/desktop_installed_media_smoke.js`、`scripts/desktop_launcher_package_qa.js` 及四份專案文件；未碰使用者的 `r5.PNG`／`r6.PNG` 工作樹內容。

## 修改紀錄：桌面下載清單 Git 位元組一致性 V432（2026-09-04）

- 正式部署後逐檔比對發現 `launcher_board_logo_v1.svg` 在 Windows 工作樹是 CRLF，但 Render 實際供應 Git `HEAD` 的 LF；V431 manifest 因此記錄錯誤的 3,698 bytes／SHA，會讓 Card 與 Board 下載在該共用 SVG 校驗失敗。
- `build_desktop_asset_manifest.js` 現在對可能受 `core.autocrlf` 影響的 SVG 直接讀取 Git committed blob，manifest 描述的是正式部署會提供的位元組；`desktop_asset_manifest_qa.js` 也以同一 committed blob 驗證 size／SHA，避免乾淨工作樹掩蓋 EOL 轉換。`.gitattributes` 固定 byte-addressed catalog／manifest 為 `-text`，確保未來 Windows checkout 與打包不會改寫其換行。新清單記錄該 SVG 為 3,644 bytes、SHA-256 `95ad37b2a1ba595eb396b4168549016b20b4de3b861857dfe422f9328643d662`，並移除兩份不可用的舊 immutable manifest。
- 驗證：全素材 QA 通過 3,894／3,894；兩款 manifest 共 3,893 個唯一資產與 Git 正規化內容一致、缺檔 0、宣告衝突 0；game catalog、下載器、Service Worker 隔離、package QA 皆通過。新 NSIS 與實裝後 EXE 都以真實 receipt 驗證 6,378-byte MP3、1,465,396-byte MP4、`opcache` 命中及 Range 206。
- 最終安裝檔：`ONE-PIECE-Tabletop-Launcher-1.1.0-x64.exe`，131,816,290 bytes，SHA-256 `EECA3DCDC7DB9A11FF10049F5AC9063BAAB3BC1DAF2EEBF79D1F9D59ED59139E`。修改範圍只有兩支 manifest script、重建的 desktop manifest／catalog、兩份新 game manifest 與四份文件；未碰使用者的 `r5.PNG`／`r6.PNG` 工作樹變更。

## 修改紀錄：ONE PIECE TABLETOP SERIES 桌面啟動器 V431（2026-09-03）

- 需求：把原先約 2 GB、把所有圖片直接塞進去的桌面 Beta 改成遊戲公司式小型啟動器。玩家先安裝啟動器、登入共用帳號，再於遊戲庫查看《偉大航道爭霸戰》《新世界航海錄》《霸海戰棋》；前兩款可各自下載／暫停／修復／更新／啟動，西洋棋維持「製作中」且沒有可偽造的安裝或啟動 IPC。
- 視覺：新增深海船長室 16:9 背景、羅盤＋骰子＋船錨的透明徽章，以及 NSIS 航海艙側欄／標頭圖。正式 `.ico` 同時用於安裝檔、執行檔、桌面捷徑、開始功能表與解除安裝程式；NSIS 使用 164×314 側欄與 150×57 標頭。原始生成 PNG、正式轉檔、提示詞、尺寸與 SHA-256 分開保存在 `desktop/assets/`，不覆蓋遊戲既有素材。
- 啟動器：`desktop/launcher.html`／CSS／JS 為完全本機 UI，不必先下載整款遊戲才能開啟；包含登入／註冊、三款遊戲庫、遊戲簡介、下載管理、空間與下載位置、目前版本狀態及失敗後啟動 last-known-good。正式版移除略過登入；設計預覽只允許 unpackaged 開發環境的明確環境變數。
- 帳號：沿用正式 `AUTH_LOGIN`／`AUTH_REGISTER`／`PROFILE_GET`／`PRESENCE_SET`／`SESSION_KICK`；密碼不落地，secret 只用 Electron `safeStorage` 加密保存。暫時斷線、timeout 或 DB 延遲不會誤刪登入；只有伺服器明確拒絕權杖才清除。遊戲視窗採非持久 partition，主框架才可取得一次 localStorage bootstrap，登出／被踢會關閉視窗並清除 localStorage、Service Worker 與 CacheStorage。
- 素材下載：由 `public/desktop/catalog-v1.json` 指到不可變的 card／board manifest，涵蓋圖片、音樂、影片與字型。下載後以 SHA-256 內容位址存入共用 CAS，相同檔案跨兩款遊戲只保存一次；支援 `.part` Range 續傳、有限並行、磁碟預留、取消、暫時錯誤重試、完整驗證、原子 receipt／manifest／last-known-good catalog，以及更新只取變更檔。有效性索引以檔案指紋避免每次啟動同步重算三千多份雜湊，並以有界背景抽查保留同大小毀損偵測。
- 網頁邊界：遊戲 HTML、規則、帳號、好友、聊天室、房間、雲端存檔與多人同步仍走正式 Render；本機只攔截已安裝 receipt 中、路徑／大小／SHA 全部符合的 `/images`、`/audio`、`/videos`、`/fonts`。桌面 session 會清除並阻擋網站根 `/sw.js`，避免瀏覽器 Service Worker 再把同一批媒體寫進 CacheStorage；找不到或驗證失敗的素材仍回退正式 HTTP。
- 清單：card 為 464 檔／692,057,506 bytes，board 為 3,442 檔／1,276,165,651 bytes；兩款合併後為 3,471 個唯一 blob／1,800,504,399 bytes。《霸海戰棋》沒有 manifest。Windows 大小寫碰撞、`incoming`、備份、私人資料、西洋棋 runtime、server 與資料庫密鑰不進任何遊戲包。
- 建置：Electron `44.1.1`、electron-builder `26.15.3`、socket.io-client `4.8.1` 固定版本；NSIS 產生可選安裝位置、桌面與開始功能表捷徑的 `ONE-PIECE-Tabletop-Launcher-1.1.0-x64.exe`，最終為 131,816,373 bytes，SHA-256 `3041AC5E0C7640871AEED6B87AFD309C02887FAF7687B28440766E2A2040F2AA`。安裝包只含啟動器本身、兩支預覽短片、三款封面、帳號頭像及 catalog／manifest，不含 1.8 GB 遊戲素材。尚未配置商用程式碼簽章，因此 Windows SmartScreen 可能顯示未知發行者。
- 驗證：`desktop_asset_manifest_qa.js` full（3,894／3,894 hash）、`desktop_game_catalog_qa.js`、`desktop_asset_store_qa.js`、`desktop_service_worker_isolation_qa.js`、`desktop_installed_media_smoke.js` 與 `desktop_launcher_package_qa.js` 均通過；fixture 覆蓋 Range 續傳、CAS 去重、差異更新、同大小毀損修復、重啟快速命中、last-known-good 與暫時錯誤重試。Electron 開發模式檢查 1440×900 登入與 960×640 遊戲庫，custom protocol 的 HEAD／一般 Range／suffix Range／416 均通過，並以真實 receipt 對 6,378-byte MP3 與 1,465,396-byte MP4 完成 HTTPS→`opcache` 命中、完整 SHA 與 Range 206。最終 NSIS 在 `D:\OnePieceDesktopBuilds\2026-09-03-launcher-v1\installed-final-v431` 靜默實裝成功，桌面／開始捷徑都指向存在的 EXE、內含 ICO 與來源 SHA 相同，安裝後 EXE 的 launcher smoke 與 media smoke 再次通過；正式產物不提交到 Git。
- 修改檔案：`desktop/main.js`、`desktop/preload.js`、`desktop/game-preload.js`、`desktop/game-session-policy.js`、`desktop/auth-service.js`、`desktop/asset-store.js`、`desktop/launcher.html`、`desktop/launcher.css`、`desktop/launcher.js`、`desktop/package.json`、`desktop/package-lock.json`、`desktop/assets/`、`desktop/generated/asset-manifest.json`、`public/images/desktop_launcher/desktop_launcher_cabin_bg_v1.png`、`public/desktop/`、`scripts/build_desktop_asset_manifest.js`、`scripts/desktop_asset_manifest_qa.js`、`scripts/build_desktop_game_catalog.js`、`scripts/desktop_game_catalog_qa.js`、`scripts/desktop_asset_store_qa.js`、`scripts/desktop_service_worker_isolation_qa.js`、`scripts/desktop_installed_media_smoke.js`、`scripts/desktop_launcher_package_qa.js` 及四份專案文件。

## 修改紀錄：Windows 桌面圖片快取 Beta V430（2026-09-03）

- 需求：讓 Windows 玩家先下載圖片素材再遊玩，降低正式網站大量角色圖、介面圖首次顯示時的等待；登入、好友、聊天室、房間、雲端存檔與多人同步仍使用正式 Render 服務。
- 架構：新增獨立 `desktop/` Electron 殼，固定載入 `https://onepiece-card-online.onrender.com/game_launcher_preview.html?desktop=1`。只有同源 `/images/*` 請求可依受控 manifest 改由安裝目錄讀取；找不到檔案、大小不符、SHA-256 不符或 realpath 逸出圖片根目錄時，不攔截原請求並回退正式 HTTP。沒有把 server、資料庫設定、帳密或私人存檔包進安裝檔。
- 安全：renderer 維持 `nodeIntegration:false`、`contextIsolation:true`、`sandbox:true`，拒絕新視窗、外站導覽與權限要求；本機圖片只經 token 化的安全 custom protocol 提供，不把任意檔案路徑交給頁面。
- 素材：`scripts/build_desktop_image_manifest.js` 以 Git `HEAD` 與實體目錄雙重比對，從正式 `public/images` 建立 3,185 筆相對路徑、大小與 SHA-256；總量 1,198,481,706 bytes。Git tree 中 `r5/r6` 各有大小寫不同的兩份檔案，Windows 無法無歧義保存，因此四個 URL 明列於 `excludedCaseCollisions` 並固定走線上。QA 另拒絕其他未提交圖片、大小寫碰撞、symlink、禁入目錄與雜湊不符；`battle_chess`、`incoming`、`private`、備份與非圖片檔不進圖片包。
- 打包：Electron `44.1.1`、electron-builder `26.15.3` 固定版本；輸出 Windows x64 NSIS 安裝檔 `ONE-PIECE-Tabletop-Desktop-1.0.0-x64.exe`，大小 1,307,344,862 bytes，SHA-256 `A6AB3F425100FA216D5A141DCDB8853BF4F0B4FA5CA043E3FF238AA0134AA992`。Beta 尚未設定正式 app icon 或程式碼簽章，Windows 可能顯示未知發行者警告。
- 驗證：manifest full QA 為 `PASS files=3185 hashed=3185 excludedCaseCollisions=4`；開發模式、`win-unpacked` 與 NSIS 靜默安裝後三層 smoke 均成功。smoke 逐張重算安裝包內全部 3,185 份雜湊，並確認指定 launcher URL、標題入口、開始按鈕、收藏室與三盒 DOM；安裝後報告 `cacheHits=9`、`remoteFallbacks=0`、`validationFailures=0`、`smokeVerificationFailures=0`，強制探測 `avatars/1.png` byte 數相同且回應 `X-OnePiece-Desktop-Cache: hit`。另以 `npm start` 在 8799 啟動正式 server，launcher、`/api/board-runtime` 與同一張圖片皆為 HTTP 200；本機未設定 `DATABASE_URL` 的既有警告符合預期。本版只本機化圖片，音樂與影片仍由網站串流。
- 修改檔案：`.gitignore`、`desktop/main.js`、`desktop/preload.js`、`desktop/offline.html`、`desktop/package.json`、`desktop/package-lock.json`、`desktop/generated/image-manifest.json`、`scripts/build_desktop_image_manifest.js`、`scripts/desktop_image_manifest_qa.js`、`docs/DEV_WORKFLOW.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`。

## 修改紀錄：Board 多人斷線重連防回朔與正式目錄整併 V429（2026-09-03）

- 問題：真人回合在 Socket 斷線期間完成後，舊版會丟失最後一次完整快照；同時本機 CPU 仍可能繼續推進。重新連線時，server 的舊快照或較舊分頁又能覆蓋較新的本機進度，造成回合、畫面或獎勵突然回朔。
- 客戶端：`public/js/board_game.js` 新增僅存在記憶體的單一 in-flight 與 latest-only pending 快照佇列。每次送出都攜帶 `baseVersion` 與下一版號；斷線或等待權威快照時鎖住真人控制與 CPU 自動行動，但允許斷線前已開始的動畫／結算完成並把最終狀態留在 pending。重連時若 server 回報 `stateCurrent` 便補送最新 pending；若 server 已有更新版本，則丟棄本機舊佇列並套用權威狀態，不盲目重送。任何低於目前確認版本的完整快照都直接拒絕，原有的交易結束與戰鬥追趕例外也不再允許低版本回寫。
- 伺服器：`server/index.js` 對 `BOARD_GAME_STATE` 採 compare-and-set，只有 `baseVersion` 等於房間目前版本且宣告版本等於 `current + 1` 才接受，接受後版本固定遞增一；過期寫入回覆 `stale_version`。一般 Board 遊戲中，`userId` 或 `clientId` 相同時，後加入的遊戲 socket 會成為唯一控制者，舊 socket 收到新增的 `BOARD_SOCKET_FENCED` 後離開遊戲房；其後送出的狀態、事件或快照請求一律回覆 `stale_socket`。campaign 重連流程未改。
- 相容：沒有改名既有 Socket.IO event、角色／道具 id、localStorage key 或持久 `gameState` schema；`pendingState`、`inFlightState`、`joinedOnce` 都只是頁面 runtime。`public/board_game.html` 的正式主程式 query 更新為 `20260903-reconnect-monotonic-v429`。
- QA：新增 `scripts/board_reconnect_client_qa.js`，重現一名真人＋一名 CPU 在真人結算中斷線、離線完成結算、收到同版舊快照及重連補傳，確認 CPU 停止、最新 round／標記／貝里保留、只送一份 `baseVersion=42`／`version=43`；另注入低版本的 `trade-close` 與 `battle-*` 快照，確認兩者都不能改回合、標記、戰鬥畫面或 LAN 版本。新增 `scripts/board_state_monotonicity_qa.js`，使用真實 Socket.IO 驗證新鮮版本接受、過期版本拒絕且不廣播，以及新 socket 接管後舊 socket 的 state／event／request 全遭拒絕。
- 回歸：`node --check` 通過 `server/index.js`、`public/js/board_game.js` 與兩支新增 QA；`board_reconnect_client_qa.js`、`board_state_monotonicity_qa.js`、`spar_lan_sync_qa.js`、`refresh_resume_qa.js`、`lan_refresh_flow_qa.js` 均為 PASS／`failures=[]`。最後一支以兩個瀏覽器完成建房、加入、換手、刷新、滿 HP 選角與雙視窗戰鬥顯示。`npm start` 已由唯一正式目錄啟動並監聽 8787；本機未設定 `DATABASE_URL` 的既有帳號資料庫警告不影響 Board 靜態頁與 Socket.IO 測試。
- 目錄整理：先逐一確認工作樹狀態、commit 祖先關係與正式 `origin/main` 已包含歷史，再移除三個 C 槽重複 release worktree `2026-04-20-board-release-v389`、`2026-08-31-board-release-v394`、`2026-08-31-board-release-v396`，以及 D 槽暫存 `2026-09-03-board-launcher-release-v429`；本機 branches `codex/board-release-v389`、`codex/board-release-v394`、`codex/board-release-v396`、`codex/board-launcher-release-v428` 一併刪除。C 槽約釋放 5.64 GiB，D 槽約釋放 1.85 GiB，清理完成時 `git worktree list` 只保留正式開發目錄。刪除的是已驗證的重複工作樹／本機分支，檔案本身無資源回收筒備份，但其 commit 歷史仍在 `origin/main`；未碰 `tmp/`、`backups/`、`_codex_backups/`、素材來源或其他未判定為重複的日期資料夾。
- 修改檔案：`server/index.js`、`public/js/board_game.js`、`public/board_game.html`、`scripts/board_reconnect_client_qa.js`、`scripts/board_state_monotonicity_qa.js`、`scripts/spar_lan_sync_qa.js`、`scripts/lan_refresh_flow_qa.js`、`docs/DEV_WORKFLOW.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`。

## 修改紀錄：桌遊啟動器／最新版航海錄正式發布邊界 V428（2026-09-03）

- 需求：把三盒桌遊啟動器與最新版《新世界航海錄》接到既有線上站，同時保留原《偉大航道爭霸戰》，《霸海戰棋》完成前不得發布或連入正式站。
- 接法：網站 `/` 仍由既有 `start.html` 開啟卡牌；卡牌登入後的隱藏骰子改進 `game_launcher_preview.html?from=card-secret`。啟動器登入後只開放卡牌與航海錄；第三盒保留核准封面與排列，但正式帳號環境移除 `href`、標示 `aria-disabled` 並不建立影片節點。只有 loopback 且伺服器明確回報無帳號資料庫的開發預覽，才恢復本機西洋棋路徑。
- 後端邊界：release 以 `origin/main` 的正式 `server/index.js` 為底，只加入唯讀 `/api/board-runtime`；未帶入開發中的 `CHESS_*` 房間、邀請或戰鬥事件。`public/battle_chess/`、`incoming/`、`secret_modes/`、私人 save/campaign、未採用素材及西洋棋預覽影片一律排除。
- 發布內容：更新 V397～V427 的 Board 正式入口、首頁／社交、BGM、青雉首次入獄劇情與正式素材；新增 launcher HTML／CSS／JS、九張實際引用圖片及卡牌／航海錄兩支 Hover 影片。沒有改 `BOARD_GAME_STATE`、既有 id、存檔 schema 或 Board Socket.IO event 名稱。
- 開發驗證：launcher 專項實跑通過本機 press→auth→gallery、正式帳號假伺服器登入／secret 重驗、1540×660 三盒固定座標、932×430 與 390×844 containment；正式模式確認 Chess `href=null` 且無 Chess video。發布工作只在由 `origin/main` 建立的 `codex/board-launcher-release-v428` worktree 精準 stage，不由 detached 開發目錄直接推送。
- 發布候選驗證：`DEPLOYMENT_ASSET_MANIFEST_QA=PASS`（3964 檔、1300 個 literal assets、49 個 linked files，無 Chess／incoming／私人存檔）；PostgreSQL campaign/save、BGM continuity、正式首頁／好友／私訊／Board 邀請、108/108 行動素材暖載、固定視角三尺寸、刷新續接，以及青雉單機五情境與 2 真人＋2 CPU 完整快照均通過。`npm audit --omit=dev` 為 0 high／0 critical，仍有 Express 4 間接 `qs` 的 3 項 moderate，因自動修復會跨到 Express 5，本版不在發布途中做不相干的主版本升級。

## 修改紀錄：三合一桌遊啟動／共用登入入口 V427（2026-09-03）

- 需求：三盒桌遊收藏頁不能一開啟就直接露出遊戲選擇，要補上「全螢幕點擊進入 → 帳號登入／建立帳號 → 三盒收藏室」的正式啟動節奏。
- 實作：`game_launcher_preview.html` 新增獨立全視窗 press、中央 auth 與 boot 失敗重試層；正式環境沿用同源 `AUTH_LOGIN`／`AUTH_REGISTER`／`PROFILE_GET`，驗證成功再送 `PRESENCE_SET` 並開放三個原連結。有效既有 secret 可在點擊後自動驗證；`SESSION_KICK` 會鎖回登入。密碼只存在送出當下的記憶體與表單，送出即清空，並移除舊 `op_last_password` 明文鍵。
- 本機邊界：只有 loopback 且 `/api/board-runtime` 明確回報 `accountDatabaseEnabled:false` 時可空白登入；本機模式會清掉該 local origin 的失效 secret，建立和 Board 相同規則的穩定測試 user id。runtime 查詢有 8 秒中止與重試，非 loopback／狀態未知一律不開 bypass。
- 相容：登入前以 `inert`／`aria-hidden` 鎖住收藏室及三個連結；登入後沿用原 `1540×660` 固定畫布、Logo、三個 `300×400` 盒座標、四點透視、160ms Hover 懶載／單盒播放／離開釋放，以及 `start.html`、`board_start.html`、`battle_chess/index.html` 三條 href。根路由仍維持既有卡牌入口，未改任何 Board 規則、存檔、`BOARD_GAME_STATE` 或 Socket.IO event 名稱。
- 驗證：`node --check` 通過 launcher 與 `game_launcher_entry_qa.js`；8787 本機實跑 press→auth→空白登入→gallery，舊 local secret 被隔離，三盒座標仍為 `(180.656,213.813)`／`(619.984,213.813)`／`(1059.328,213.813)` 且皆 `300×400`，Hover 影片可播放並在離開後移除 `src`。932×430、390×844 登入卡皆在視窗內。8798 隔離帳號伺服器實際完成 `AUTH_LOGIN`→`PROFILE_GET`→`PRESENCE_SET`、重整後既有 secret 自動驗證，雙 secret key 與 user id 正確且密碼未落地；所有情境 `pageerror=[]`。

## 修改紀錄：恢復共用好友／聊天室外殼 V426（2026-09-02）

- 需求：浮動好友面板與聊天室屬於之後要和《偉大航道爭霸戰》共用的正式功能，不能視為無效入口移除。
- 實作：local-preview 恢復首頁「好友與聊天室」、右側好友 Dock、聊天 Tray、邀請層與社交直達頁；未接正式帳號時明確標示為保留中的共用入口。玩家資料仍隱藏，繼續航海仍只在有實際紀錄時顯示；房間選擇頁保留好友浮動入口提示，只移除重複的底部返回按鈕。
- 邊界：未新增假的好友或聊天資料，也未改 `SOCIAL_*`／`DM_*`／邀請 Socket.IO event；正式帳號接回後仍使用既有完整社交流程。
- 驗證：1600×900 與 390×844 本機實跑皆顯示「開始航海」「好友與聊天室」及浮動好友／聊天外殼，社交頁提示正確且 `pageerror=[]`；8797 正式帳號 QA 仍為 `ok:true`，四入口、好友確認、私訊、房邀請及雙真人 lobby 全通過。

## 修改紀錄：本機首頁只顯示有效入口 V425（2026-09-02）

- 需求：本機預覽登入後的下一層只保留確實可用的按鈕，移除會進入空內容或尚未接上帳號服務的功能。
- 實作：local-preview 首頁固定移除「好友與聊天室」與錯誤鎖定的「玩家資料」，並隱藏共用好友 Dock／聊天 Tray／邀請層；「繼續航海」只有伺服器實際回傳可用 campaign 時才顯示，沒有紀錄時只留下置中的「開始航海」。出航方式頁同步移除重複返回列與失效好友提示，保留頂部返回。
- 邊界：所有條件都以 `data-entry-auth-source=local-preview` 限制；正式登入環境仍保留四入口與好友／玩家資料。帳號、房間、campaign、`BOARD_GAME_STATE` 與 Socket.IO event 均未改。
- 驗證：Chrome 於 1600×900、390×844 空白登入後皆只顯示「開始航海」；好友 Dock、玩家資料與空 campaign 不可見，開始航海可進房間選擇、頂部返回可回首頁，兩尺寸 `pageerror=[]`。

## 修改紀錄：本機直接登入預覽 V424（2026-09-02）

- 需求：先讓 `127.0.0.1:8787/board_start.html` 可由登入卡直接進入下一個主畫面，正式帳密整合留待部署時接回。
- 實作：`server/index.js` 新增唯讀 `/api/board-runtime` 能力旗標；只有 loopback 主機且伺服器明確回報未啟用帳號資料庫時，`board_start.js` 才進入 `local-preview`，可空白按「登入」建立本機測試身分。正式站、非 loopback 網址與已啟用資料庫環境仍走既有同源帳密驗證。
- 安全／相容：本機預覽不保存密碼或 secret、不呼叫正式帳號伺服器，Board 房間仍連本機 Socket；同時修正入口在 top-level await 前讀取尚未初始化常數，造成登入事件未掛載的 TDZ 問題。未新增 `gameState` 欄位或 Socket.IO event。
- 驗證：`node --check public/js/board_start.js` 與 `node --check server/index.js` 通過；8787 `/api/board-runtime` 回傳 `accountDatabaseEnabled:false`；Chrome 實跑空白登入由 `auth` 進入 `app`，`data-entry-auth-source=local-preview` 且未寫入 `opSecret`／`op_secret`。

## 修改紀錄：新世界航海錄橫向主畫面／中央登入視窗 V422（2026-09-02）

- 需求：登入入口改成和《偉大航道爭霸戰》相同的全螢幕主畫面節奏；使用者提供的直式角色封面重構成真正 16:9 橫向背景，點擊後不能再顯示左封面＋右登入版面，而是在同一背景上彈出中央小視窗。
- 素材：以內建 ImageGen 參考使用者圖片生成 `public/images/board/backgrounds/board_entry_horizontal_v1.webp`（1672×941、502,494 bytes）；四名角色、骰子、海上航線、船與四邊金框都留在畫面內。正式頁只載入 WebP，原始 1672×941 PNG 保存在 `backgrounds/incoming/`，完整提示詞記錄於 `board_entry_horizontal_v1.prompt.md`。
- 畫面：press 階段使用橫向圖全螢幕 `cover`，正式 SVG Logo 疊在中央，底部顯示閃爍「點擊繼續」；透明 `#boardEntryStartBtn` 覆蓋完整視窗，所以滑鼠、觸控與原鍵盤入口都能繼續。auth／boot 維持同一背景，只顯示中央登入或讀取卡；移除舊左側封面 DOM，短橫向畫面套用緊湊登入排版。
- 邊界：只修改 `public/board_start.html` 與新增入口背景素材／提示紀錄；`board_start.js`、`begin()`、secret 驗證、登入／註冊、直接 room/campaign 續接、好友、房間、存檔、Socket.IO event 與 `BOARD_GAME_STATE` 全部不變。入口使用獨立 `--board-entry-bg`，登入後 Board 主頁原 `--board-bg` 不受影響。
- 驗證：`npm start` 在 8787 正常提供頁面（本機未設定 `DATABASE_URL` 的既有警告不影響靜態入口）。`board_home_social_qa.js` 於乾淨 8797 QA server 通過 1600×900、1024×768、390×844 的主畫面、既有 secret boot、帳密登入、四入口、好友／私訊／房邀請與雙真人 lobby，結果 `ok:true / errors:[]`。另以 Chrome 932×430 定向量測，主畫面文件為 932×430、整頁按鈕邊界為 `(0,0)-(932,430)`、Logo 完整在視窗內；登入卡為 `(251,53)-(681,377)`、無水平或垂直 overflow、舊封面節點數為 0，背景 URL 正確且 `pageerror=[]`。

## 修改紀錄：青雉 Lv99／劇情內嵌選項與海上背景 V421（2026-09-02）

- 需求：首次入獄青雉要比一般版本更強，玩家的放行／挑戰二選一不能跳離劇情，也不能以「逃跑」描述；背景改為參考前期青雉騎腳踏車在海上閒晃的場景。
- 規則：只把首次入獄攔截戰建立為劇情專屬 Lv99；Marineford 正式青雉仍維持 Lv92，玩家取得的青雉／庫山資料不受影響。挑戰仍禁止中途離開與共鬥，且不提供經驗、貝里、掉落物或血統因子。
- 畫面：放行／挑戰選項直接嵌入既有全螢幕角色劇情對話框，選擇後在同一介面接續回應；玩家可見文案改用「接受青雉放行／直接挑戰青雉」，不使用「逃跑」字樣。青雉現身到兩種回應全段共用 `public/images/board/story/backgrounds/aokiji_capture/aokiji_capture_bicycle_sea_story_v1.webp`，三張透明立繪維持前景疊圖。
- 同步／相容：沿用 `pendingAokijiCaptureStory`、每玩家 `impelDown.aokijiFirstCaptureStorySeen`、既有 battle snapshot 與完整 `BOARD_GAME_STATE`；內部選擇值仍為 `fight`／`leave`，不新增 Socket.IO event、localStorage key 或存檔欄位。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`public/images/board/story/backgrounds/aokiji_capture/aokiji_capture_bicycle_sea_story_v1.webp`、`public/images/board/story/backgrounds/aokiji_capture/aokiji_capture_bicycle_sea_story_v1.prompt.md`、`scripts/aokiji_first_capture_story_qa.js`、`scripts/aokiji_first_capture_lan_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check` 通過 `public/js/board_game.js` 與兩支青雉 QA，`git diff --check` 通過本次程式／素材紀錄／文件。`npm start` 於 8787 啟動正式入口（本機未設定 `DATABASE_URL`，靜態頁與 Socket.IO QA 可正常使用）。`aokiji_first_capture_story_qa.js` 以五個隔離 BrowserContext 實跑桌機 1600×900、短橫向 932×430、罰款不足及挑戰強制勝／敗，結果 `ok:true / failures:[] / errors:[]`；確認兩顆選項留在同一劇情對話框、統一海面冰路背景、立繪完整、無 HUD／overflow，Lv99 青雉為 HP 952／攻 304／防 282／特攻 351／特防 295／速度 206。`aokiji_first_capture_lan_qa.js` 建立 2 真人＋2 CPU 房，確認 pending／release 完整快照一致、觀看端唯讀、控制端刷新可續選、同一背景與 CPU 自動放行，`failures:[] / errors:[]`。

## 修改紀錄：青雉首次入獄透明立繪接入 V420（2026-09-02）

- 需求：將使用者放入專案的三張青雉去背圖統一改成正式名稱並接上首次入獄劇情；劇情仍使用原對話框，不顯示戰鬥 HP UI，左右雙臂與手掌不可被裁切。
- 素材：正式 runtime 檔名為 `source/aokiji_capture_lazy_v3.webp`、`aokiji_capture_mercy_v3.webp`、`aokiji_capture_serious_v3.webp`。慵懶圖為 646×969，放行與認真圖為 1024×1536；三張都是有有效 alpha 的 RGBA WebP。僅改名，不重繪、縮放或覆寫圖片內容。
- 接入：`AOKIJI_CAPTURE_STORY_PORTRAITS` 改引用 V3 WebP，主頁 query 更新為 `20260902-aokiji-cutout-portraits-v420`；舊的不存在 `*_source_v2.png` runtime 路徑不再使用。劇情規則、台詞、選項、存檔欄位及多人完整快照結構皆不變。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`public/images/board/story/aokiji_capture/`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check` 通過 `public/js/board_game.js` 與青雉單機 QA。以 Codex 內建 Playwright 依賴實跑 `aokiji_first_capture_story_qa.js` 的五個隔離 BrowserContext，桌機 1600×900 與短橫向 932×430 三姿勢皆成功載入且整張立繪位於視窗內，對話／選項無 overflow、劇情中 HP HUD 不可見；全滅放行、罰款不足、挑戰強制勝／敗均完成，結果 `ok:true / failures:[] / errors:[]`。三張正式 URL 均回應 HTTP 200，`git diff --check` 通過。

## 修改紀錄：首次入獄青雉攔截劇情 V419（2026-09-02）

- 需求：第一次原本要因全隊瀕死／戰敗或罰款不足送進推進城時，先讓青雉以正式角色對話格式說明規則，滿狀態後由真人選擇直接挑戰或道謝離開；不可拿戰鬥圖當立繪，也不可在劇情中顯示 HP HUD。
- 素材：本版先完成懶散抬手、伸手放行、冰手認真三張 V2 來源圖與雙臂安全構圖；CSS 使用 `contain`，並為 560px 以下橫向畫面限制人物高度，避免容器伸出視窗。使用者後續完成的透明正式圖與 runtime 路徑已由 V420 接替。
- 規則：新增每玩家一次的 `impelDown.aokijiFirstCaptureStorySeen` 與全局 `pendingAokijiCaptureStory`。首次攔截立即滿 HP／PP並保存原押送來源；放行後依來源繼續或換回合。挑戰沿用 Marineford 青雉，禁止逃跑／共鬥與所有獎勵；勝利放行，敗北／投降正式入獄。CPU 自動放行，觀看端按鈕唯讀。
- 同步／恢復：pending、選擇、battle snapshot 均走既有完整 `BOARD_GAME_STATE`，沒有新增 Socket.IO event 或 localStorage key；劇情選擇前、選擇後、挑戰開始／結束都強制推送，刷新可恢復幕次與控制權。既有澤法爆炸 QA 先標記本旗標，避免其專項測試被新的一次性劇情攔截。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`public/images/board/story/aokiji_capture/`、`scripts/aokiji_first_capture_story_qa.js`、`scripts/aokiji_first_capture_lan_qa.js`、`scripts/postgame_zephyr_end_point_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check` 通過主程式與三支相關 QA；`aokiji_first_capture_story_qa.js` 以五個隔離 BrowserContext 實跑全滅放行（1600×900／932×430）、罰款不足、挑戰強制勝／敗，確認台詞、兩顆選項、滿 HP／PP、無 HUD、無 overflow、每張立繪整體都在視窗內，`failures=0 / errors=0`。`aokiji_first_capture_lan_qa.js` 以本機 Socket.IO 建立 2 真人＋2 CPU 房，確認 pending／release 完整快照一致、觀看端不能選、控制端刷新仍可選、CPU 自動放行，`failures=[] / errors=[]`。`refresh_resume_qa.js` 與 `postgame_zephyr_end_point_qa.js` 均 exit 0；`git diff --check` 通過。`npm start` 已有 8787 正式服務持續監聽，本輪沿用該服務完成 HTTP、Chrome 與 Socket.IO 驗證。

## 修改紀錄：新世界航海錄主畫面／登入入口 V418（2026-09-02）

- 需求：從桌遊收藏點入 `board_start.html` 時，不再立即攤開玩家卡、房間、紀錄與好友；操作節奏改成和《偉大航道爭霸戰》一致的「主畫面 → 登入 → 主選單」。
- 畫面：新增全螢幕《新世界航海錄》主畫面，只保留既有核准封面、正式 Logo、簡短引導與「開始航海」；第二層為深海金色登入／註冊卡。桌機左右分欄，390px 手機改為封面底圖＋置中表單；登入前 `.page`、好友 dock、聊天室與邀請框都不建立。
- 帳號：沿用同源 Socket.IO 的 `AUTH_LOGIN`／`AUTH_REGISTER`／`PROFILE_GET`，有效既有 `opSecret` 只需在主畫面按一次便驗證進入，不重選名稱與頭像。驗證成功後才同步 `opSecret`／`op_secret`、`op_user_id`、Board user id、名稱、頭像、稱號與金幣，再初始化原 `BoardShared`、campaign 與房間流程；只記住最後帳號，不新增或保存密碼。
- 銜接：登入後仍只顯示 V394 的「開始航海／繼續航海／好友與聊天室／玩家資料」四入口；`view=lobby|modeSelect|campaigns|social`、`room`、`campaign` 會先驗證身分再直達。`SESSION_KICK` 改回本頁 `?kicked=1` 登入畫面，不再跳到卡牌頁。
- 驗證：`node --check` 通過；`board_home_social_qa` 以隔離假帳號實際送出 `AUTH_LOGIN`、取得 `PROFILE_GET` 並確認不保存密碼，再於 1600×900、1024×768、390×844 驗證主畫面、登入／註冊、有效 secret boot、四選單、好友接受、即時私訊、房邀請、雙真人同房及直達 lobby，結果 `ok:true / errors:[]`。`board_portable_asset_prefetch_qa` 亦在先通過帳號入口後通過：108/108 暖載、0 解碼預建、96 張地圖圖、26 次導覽快取命中、強制首敗後重試成功，`errors:[] / failures:[]`。
- 邊界：不修改帳號 schema、`AUTH_*`／`PROFILE_GET` payload、房號、campaign schema、任何 `BOARD_*` event、`BOARD_GAME_STATE`、遊戲規則或三款遊戲的其他入口。
- 修改檔案：`public/board_start.html`、`public/js/board_start.js`、`public/js/board_shared.js`、`scripts/board_home_social_qa.js`、`scripts/board_home_social_qa_server.js`、`scripts/board_portable_asset_prefetch_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。

## 修改紀錄：啟動頁 Logo 上移避讓 V417（2026-09-01）

- 問題：V415 的 Logo 為 `680×226.6625` 並位於 `y=30.35`，底部到 `257.0125`；盒架與三盒從 `y=213.8` 開始，因此靜態重疊約 43.2px，Hover 抬盒後重疊更大。
- 修正：只把 `.launcher-brand` 改為 `top:0 / width:560px`，完整保留圖片且維持水平置中；Logo 新尺寸 `560×186.6625`、`x=490 / y=0`。`.game-shelf` 加入 `z-index:3`，避免陰影接觸時覆蓋盒面；三盒座標、尺寸、影片四點透視及 href 全部不動。HTML cache query 更新為 `20260901-logo-clearance-v19`。
- 驗證：`1540×660` 下 Logo 與靜態盒架間距為 27.1375px；中盒 Hover 後頂端 `y=194.6`，仍有 7.9375px 淨空。`1280×720`、`390×844`、`932×430` 的換算回設計畫布間距均為約 27.1375px，頁面零 overflow；瀏覽器截圖確認 Logo 不裁切且不擋盒子。Hover 影片實播成功，離開後三支 `src/currentSrc` 全釋放，頁面 console warning／error 為 0。
- 邊界：沒有修改三盒位置、V416 展示成片、三款遊戲入口、規則、存檔、Socket.IO event 或 `BOARD_GAME_STATE`。
- 修改檔案：`public/game_launcher_preview.html`、`public/css/game_launcher_preview.css`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。

## 修改紀錄：固定比例三盒完整 Hover 成片 V416（2026-09-01）

- 需求：依使用者已確認的正式啟動頁比例與位置重新錄製，不再沿用 V414 的 1920×1080 錄影構圖；Logo、背景與三盒必須和目前 `1540×660` 核准頁完全相同，並由左至右逐盒完整播完才移到下一盒。
- 錄製：OBS Browser Source、Base／Output／來源全部固定 `1540×660`、60fps、1:1、BT.709；直接載入正式 `game_launcher_preview.html`，不經 iframe、Chrome 外框或桌面 DPI 擷取。錄影期間以一次性 query 控制器預載三支 V2 短片、加入白色游標，並逐支等待真正的 `ended` 事件；錄完已把 HTML／JS 還原為 V415 原始 SHA-256。
- 輸出：新增 `public/videos/game_launcher/game_launcher_three_box_hover_demo_fixed_v3.mp4`，33.32 秒、H.264 High、1540×660、60fps、yuv420p、BT.709、無音軌、faststart，5,281,841 bytes，SHA-256 `C43992845B00A05AE9C21673CDB89A19F7C3595C7E3362CB0722E72ED503033C`。V414 的 V2 成片保留且未覆蓋。
- 驗證：瀏覽器預演完成狀態為 `complete`，核准三盒座標仍為 `x≈180.6625 / 619.9875 / 1059.325`、`y=213.8`、各 `300×400`；OBS 四張原生 screenshot 與成片 5.5／14.8／24.0 秒抽幀均確認 Card／Board／Chess 正確貼合各自梯形盒面。OBS 實際輸出 2000 幀、成片 metadata 為 7:3／60fps 且只有一條視訊流。一次性 OBS profile／scene、WebSocket 開關、錄影控制程式與正式頁暫時 query 均在錄完後還原或移除。
- 修改檔案：`public/videos/game_launcher/game_launcher_three_box_hover_demo_fixed_v3.mp4`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。

## 修改紀錄：啟動頁固定核准構圖 V415（2026-09-01）

- 基準：直接量測使用者目前開啟且確認最滿意的正式候選頁，CSS viewport 為 `1540×660`。核准座標固定為 Logo `x=430 / y=30.35 / 680×226.6625`、盒架 `x=127 / y=213.8 / 1286×406.6`，三盒各 `300×400` 並位於 `x≈180.6625 / 619.9875 / 1059.325`、`y=213.8`。
- 實作：新增 `1540×660` 的 `.launcher-stage`，把背景、暗角、Logo 與三盒包進同一張固定 7:3 設計畫布。移除會分別重排 Logo、間距、盒寬與手機橫向捲動的寬高 media query；JS 只依目前根視窗的可用寬高取單一比例、整張置中縮放，較寬或較高螢幕以深海黑留邊，不拉伸、不裁切、不改物件相對位置。query 更新為 `20260901-fixed-composition-v18`。
- 互動：三個原 href、300×400 盒面、Hover 抬盒、160ms 按需影片、單盒播放、離開釋放、四點透視矩陣、觸控／reduced-motion 限制均保留；外層 transform 不改內部 300×400 邏輯座標。
- 邊界：只修改隔離候選啟動頁及其專用 CSS／JS；未修改卡牌、Board、Chess 的入口、登入、房間、存檔、Socket.IO event、`BOARD_GAME_STATE` 或任何遊戲規則。
- 驗證：重新載入原 `1540×660 @ DPR 1.25` 分頁後，Logo、盒架、shell 與三盒所有座標／尺寸逐項和修改前完全相同。另在 `1280×720`、`932×430`、`390×844`、`1920×1080` 重新載入，四種尺寸皆完整置中、零頁面 overflow，換算回設計畫布的最大幾何誤差小於 `0.00011px`；三盒 V2 影片逐盒實播成功，離開後 active/source 皆歸零。`node --check public/js/game_launcher_preview.js` 通過，頁面、V18 CSS／JS 均 HTTP 200，啟動頁自身 console warning／error 為 0。
- 修改檔案：`public/game_launcher_preview.html`、`public/css/game_launcher_preview.css`、`public/js/game_launcher_preview.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。

## 修改紀錄：啟動頁三盒完整 Hover 示範影片 V414（2026-09-01）

- 修正：V413 錄影 fixture 的 iframe 在 OBS Browser Source 中只取得半高動態 viewport，造成頁面被壓在上半部；第一次又誤裁到播放前的靜止段，因此 V1 已自正式影片目錄撤下並移到 `_codex_artifacts/rejected/`。V414 改成直接渲染啟動頁 DOM，以固定 1920×1080 錄影畫布和獨立背景層保持正式頁比例。
- 輸出：新增 `public/videos/game_launcher/game_launcher_three_box_hover_demo_v2.mp4`。錄影開始後才載入帶 `run` 參數的頁面，游標依序停在偉大航道爭霸戰、新世界航海錄、霸海戰棋；每盒均等待其 V2 預覽影片真正觸發 `ended` 後才移往下一盒，控制器於 33 秒自動停止。
- 邊界：沒有修改正式啟動頁互動、三款遊戲入口、規則、存檔、同步或三支 V2 盒內短片；OBS WebSocket、隔離 profile／scene 均已還原與移除。
- 驗證：錄影前以 OBS 原生 1920×1080 screenshot 分別確認完整背景、正常比例及 Card／Board／Chess 三盒實際播放畫面；成片 3 秒間隔接觸圖確認三段依序出現且沒有半高黑屏。V2 為 32.82 秒、H.264 High、1920×1080、60fps、BT.709、無音軌、6,842,320 bytes，SHA-256 `405677B05ACC17EB71313B985E06A7772C8BE16D1F93CE58D2D96E43F1BC0310`。

## 維護紀錄：Codex 測試截圖與 QA 輸出清理（2026-09-01）

- 範圍：只整理專案根目錄的 `_codex_artifacts`；先逐一解析絕對路徑並確認都位於該目錄，保留目前啟動頁 V2 所需的 `game_launcher_video_v2`，再移除 29 個 2026-08-24～2026-08-27 已結束測試的 QA 子目錄、13 張舊根目錄測試截圖，以及本次錄影的暫存逐幀圖、失敗 take、OBS 臨時設定與一次性 capture server。
- 保留：`game_launcher_video_v2/contact_sheets/` 只留下 Card／Board／Chess 三張最終 V2 接觸圖，`filters/` 留下三份最終 FFmpeg filtergraph；正式 `public` 素材、遊戲程式、存檔、`tmp`、`backups`、`_codex_backups` 均未動。
- 使用者確認「大清理」後，第二階段以固定絕對路徑、預期 byte 數、目錄邊界、reparse point 與 writer lock 兩階段驗證：永久刪除 5 個已完成啟動頁子代理 JSONL、封存的「0815」／舊 Board UI 接手／推進城示範共 8 個聊天室檔（10,617,787,453 bytes），18 個已確認不再使用的 Codex 生圖目錄（2,166,198,345 bytes），以及使用者 `.codex/qa`、`.codex/.tmp` 與專案 `.codex/qa`（384,235,447 bytes）。正在寫入的 `.codex/cache` 未刪。
- 驗證：本次大清理合計移除 13,168,221,245 bytes，磁碟實測增加 13,173,760,000 bytes；目前聊天室 `01a0185f…`、未完成 FR-U 4、反方向受擊圖、`opposite_hit_support`、最近兩份正式 Logo 生圖及三支正式 V2 MP4 均存在。`session_index.jsonl` 的 3 行已刪聊天室舊索引已移除且目前聊天室索引保留；Codex 封存清單已不再顯示三個被刪舊聊天室。`_codex_artifacts` 仍只剩目前工作目錄的 6 個最終 QA 檔，共約 0.78 MiB。

## 修改紀錄：啟動頁真正 3:4 動態取景 V412（2026-09-01）

- 問題：V410 雖輸出為 `720×960`，內容仍是橫向實機畫面置中，上下用同幀模糊延伸；放進直式桌遊盒後，主要人物與動作只占中間一條，不能算真正的直式剪輯。使用者另指定 Board 改播戰鬥片段，不再使用擲骰航行遭遇。
- 錄製：以隔離 OBS Browser Source 重新錄下三段 `1920×1080`、60fps 正式頁演出。卡牌為維薩利亞場地、抽到 `3` 號香吉士、打出後選玩家 PK；Board 為五檔魯夫對覺醒羅布・路基、選招、擲骰、出手與命中；Chess 為 KING「丹弓皇」。fixture／測試局面只存在錄影服務，未寫回正式牌堆、Board state 或棋局。
- 剪輯工具：新增 `scripts/game_launcher_video/render_true_3x4.py` 與三份 `plans/*.json`。每鏡先依時間切段，以 cosine ease 追蹤 `panX/panY` 與最多 1.2 倍 zoom，再從 16:9 母帶取真正 `810×1080` 視窗並縮成 `720×960`；全片沒有 padding、黑邊或模糊補圖。工具會拒絕非 1920×1080 母帶、非 `_v2.mp4` 輸出與既有輸出，FFmpeg 使用 `-n` 防止覆蓋。
- 成片：三支皆為 H.264 High、30fps、BT.709、yuv420p、無音軌、faststart。`card_sanji_duel_preview_v2.mp4` 為 8.40 秒／1,554,991 bytes／SHA-256 `EABF37EB247D6EA0E17AF056558344D850C1A29DE8E4D7D628F49FCF02BF8D08`；`board_battle_preview_v2.mp4` 為 8.50 秒／2,781,349 bytes／SHA-256 `8E9511275A0690B442CFDBD250C9169FF62E3988B3D677C36786C5D9A33F1798`；`chess_king_attack_preview_v2.mp4` 為 5.70 秒／1,536,652 bytes／SHA-256 `15F929A037203C058FD2135573D2C048794B20EEFBDCA205D84842CAA47D3DB8`。
- 接入：`game_launcher_preview.html` 改讀三支 V2，CSS／JS query 更新為 `20260901-hover-clips-v16`。V411 的各盒 `data-preview-quad`、homography `matrix3d`、延遲載入、一次只播一盒、離開釋放、reduced-motion 與觸控停用規則全部沿用。
- 邊界：只改隔離候選啟動頁的影片來源、版本化成片、可重建剪輯工具與文件；沒有改卡牌、Board、Chess 的正式入口、規則、存檔、同步、音樂、Socket.IO event 或 `BOARD_GAME_STATE`。
- 驗證：三支母帶均確認為 1920×1080／60fps；三支 V2 均確認為 720×960／30fps／3:4／BT.709 且無音軌。逐段 2fps 接觸圖人工檢查香吉士卡面與 PK、五檔／路基／骰子／命中跳字、KING 題字／飛行／命中均位於直式裁框，未出現黑邊、模糊補邊或人物拉伸。`node --check public/js/game_launcher_preview.js` 與 `py -3 -m py_compile scripts/game_launcher_video/render_true_3x4.py` 通過；獨立 `PORT=8830 npm start` 成功監聽，候選頁、V16 CSS、V16 JS 均 HTTP 200，三支 V2 均以 `Range: bytes=0-1023` 回傳 HTTP 206／`video/mp4`。本機未設 `DATABASE_URL` 的提示為既有靜態預覽行為，測試服務完成後已關閉。

## 修改紀錄：啟動頁影片四點透視 V411（2026-09-01）

- 問題：V410 的三段影片已用各盒面的 `clip-path` 裁成梯形邊界，但影片內容本身仍維持水平矩形；盒框雖能遮住四邊，遊戲畫面的水平線與垂直線不會隨盒面傾斜，看起來仍像平面影片疊在盒子上。
- 實作：三個 `.game-slot` 新增各自沿用 V406 盒框內緣的四點百分比座標。`game_launcher_preview.js` 依 `.box-front` 實際寬高建立 homography，輸出響應式 `matrix3d` 到 `--preview-warp`，把影片左上、右上、右下、左下真正映射到對應盒面四角；`ResizeObserver` 會在盒面尺寸改變時重算。影片改用 `object-fit:cover`、左上為 transform origin、取消影片本身的 clip-path，反光層仍使用原四點裁切，外框繼續位於最上層遮邊。
- 穩定性：投影矩陣保存在 `.game-slot` CSS 變數，不掛在會被停止播放流程替換的 `<video>` 節點，因此切換盒子、離開後釋放媒體圖層再重新播放，四點透視都不會遺失。三支 V410 MP4 未重新編碼、改名或覆蓋；query 更新為 `20260901-hover-clips-v15`。
- 邊界：只調整隔離候選啟動頁的 HTML／CSS／JS 顯示層；三個入口、影片內容、卡牌／Board／Chess 規則、登入、房間、存檔、Socket.IO event 與 `BOARD_GAME_STATE` 均不變。
- 驗證：`node --check public/js/game_launcher_preview.js` 通過。瀏覽器 `1280×720` 逐盒播放確認三支影片內容均隨盒面傾斜、四角受各自外框遮住，切換時仍只有目前盒子的影片有 `currentSrc` 並播放。以 `300×400`、手機盒寬 `278×370.6667`、放大 `900×1200` 三種尺寸逐角反算，三盒最大四角誤差不超過 `2.274e-13 px`。獨立 `PORT=8829 npm start` 成功監聽；候選頁、V15 CSS、V15 JS 均 HTTP 200。本機未設 `DATABASE_URL` 的提示為既有靜態預覽行為，測試服務完成後已關閉。

## 修改紀錄：三盒正式玩法 Hover 短片 V410（2026-09-01）

- 需求：滑鼠移到桌遊盒時，不增加文字、按鈕或遮住封面，而是在盒面內播放各遊戲的精彩實機片段。三段內容固定為：卡牌抽到並打出 `3` 號香吉士後選玩家 PK；Board 擲骰、逐格航行並觸發海格遭遇；Chess 由 KING 以相鄰斜吃施放「丹弓皇」。
- 錄製：三段均由正式程式流程實際觸發，不是另做假動畫。卡牌使用只存在於錄製程序的隔離房間配置，把真人手牌設為 `8`、下一抽設為 `3`、對手手牌設為 `2`，仍依正式 `DRAW → PLAY_CARD → PICK_TARGET → duel` 結算；Board 只在錄影頁暫存狀態中把 `route-island-8-island-9` 的海格設為遭遇格，正式點船、擲出 3、逐格航行到情報面板；Chess 使用正式 `king-bishop` 的 `d4 → e3` 相鄰斜吃與 `king-tankyudon` 動畫。這些錄影 fixture／FEN 都沒有寫進遊戲 runtime。
- 素材：成片獨立放在 `public/videos/game_launcher/`，不混入三款遊戲原素材目錄。三支皆為 `720×960`、H.264 High、24fps、無音軌、faststart：`card_sanji_duel_preview_v1.mp4` 為 8.00 秒／464,771 bytes／SHA-256 `9F039D43208D99A5205C55F42B3D6B15123E37761AEA38D2EDC88DCD13B4069E`；`board_roll_encounter_preview_v1.mp4` 為 7.58 秒／543,694 bytes／SHA-256 `FB202D36820DC43F9DF7B4D19B283A44E89F73DD30B506D25533C39A3A5FDCA3`；`chess_king_attack_preview_v1.mp4` 為 5.50 秒／374,048 bytes／SHA-256 `9262E8FC3DC33B661F9A674BFA7C71EA9921D217A25CB5BCE2F92CB2FA56902D`。橫向實機畫面置於直式盒面的清楚中央視窗，上下以同幀暗化模糊延伸，不拉伸人物。
- 播放：`game_launcher_preview.html` 的三個 `.box-front` 各加入一個沒有 `src` 的 muted／playsinline／loop `<video>`；`game_launcher_preview.js` 只在 `(hover:hover) and (pointer:fine)` 且未要求 reduced motion 時，停留 160ms 後才從 `data-src` 載入。一次只播放一盒，真正 `play()` 成功才淡入；離開、失焦、切換分頁或媒體偏好變更會立即停播、歸零並替換成乾淨 video 節點，既釋放硬體影片圖層又保留瀏覽器 HTTP 快取。影片 `pointer-events:none`，整盒原連結仍是唯一點擊區。三款影片分別沿用 V406 的梯形 clip-path，外框、反光和 hover 抬盒仍在影片之上；query 更新為 `20260901-hover-clips-v14`。
- 邊界：只改隔離候選啟動頁、專用 CSS／JS、三支啟動頁影片與文件；沒有改卡牌牌組／香吉士規則、Board 擲骰／遭遇／`BOARD_GAME_STATE`、Chess KING 規則或三款入口，也沒有新增存檔欄位、localStorage key、Socket.IO event、登入或部署路由。
- 驗證：`node --check public/js/game_launcher_preview.js` 通過；三支影片與 HTML／CSS／JS 皆 HTTP 200、影片支援 byte range。瀏覽器 `1280×720` 實測初始三支 `currentSrc` 全空、滑入後才載入與播放、切換時只有一支播放、離開後 `src`／`currentSrc` 清空且三盒完整復原；修正並複驗「播放過的中盒在另一盒播放時消失」的媒體合成層問題。`390×844` 觸控模擬為 `hover:false`、三支零載入、`scrollWidth=390`；`932×430` Logo bottom `134.48`、盒面 top `171.88`、零重疊且無頁面 overflow。reduced motion 模擬下滑入仍零載入；console warning／error 為 0。

## 修改紀錄：手繪 TABLETOP SERIES 頂部 Logo V409（2026-09-01）

- 需求：V408 移除冗長標題後仍需在三盒上方保留一枚真正畫出的系列 Logo；使用者否決像第四款遊戲名稱的「冒險港」，最後確認只使用主字 `ONE PIECE` 與小字 `TABLETOP SERIES`，不再加中文名稱、引導句或預覽標籤。
- 素材：使用內建 ImageGen 產生透明 `2172×724 RGBA` 橫向徽章 `public/images/game_launcher/launcher_tabletop_series_logo_v1.png`，SHA-256 為 `2AE34A49D112F92FBE44BF30C4489AE9A1D7A2D100BF5669121E0BC4B5E91355`。黃銅、深海藍、海浪、羅盤、船舵、卡牌、骰子與棋子均燒在同一張圖內；字樣只有 `ONE PIECE`／`TABLETOP SERIES`。未採用的命名草稿只留在 ImageGen 生成紀錄，沒有接入或保留於專案 runtime 素材目錄。
- 接入：`game_launcher_preview.html` 預載 Logo，頁面標題改為 `ONE PIECE TABLETOP SERIES`；可見 `h1` 只包含這張圖片與同名 `alt`，不使用 HTML／CSS 重排文字。Logo 絕對定位在盒架上方，桌機不改 V408 盒面落桌位置；手機縮至 92～96vw，短橫向視窗另外限制為 42vw。CSS query 更新為 `20260901-tabletop-series-logo-v11`。
- 邊界：仍為隔離候選啟動頁；三個盒子的 href、V406 專屬盒框、透視封面、卡牌／Board／Chess 程式、根路由、部署、登入、房間、存檔、Socket.IO event 與 `BOARD_GAME_STATE` 全部不變。
- 驗證：素材為 `Format32bppArgb`，四角 Alpha 皆為 0；瀏覽器實測 `1280×720`、`390×844`、`932×430`。桌機 Logo 與三盒完整同屏；手機 Logo `374.8×124.9`、第一盒完整顯示且頁面 `scrollWidth=390`；短橫向 Logo bottom `134.5`、盒面 top `171.9`，零重疊且頁面尺寸維持 `932×430`。圖片解碼完成、三個連結存在、console warning／error 為 0。另以 `PORT=8827 npm start` 啟動，候選頁、V11 CSS、Logo 與三個入口共 6 個網址均 HTTP 200；未設 `DATABASE_URL` 為既有本機靜態預覽提示。

## 修改紀錄：啟動頁純盒面陳列 V408（2026-09-01）

- 需求：使用者不喜歡頁面額外顯示的 `ONE PIECE GAME COLLECTION`、`偉大航道遊戲收藏`、引導句與「啟動首頁設計預覽」，並認為標題過多、過雜。
- 介面：`game_launcher_preview.html` 移除整個可見標題區與底部預覽說明，只留下航海收藏室背景與三個完整可點桌遊盒；封面本身的正式 Logo 成為唯一可見名稱。瀏覽器頁籤標題縮成 `ONE PIECE`，另保留螢幕閱讀器專用的隱藏 `選擇遊戲` 標題。
- 排版：桌機用單列滿高 grid 固定原本盒面落桌位置，移除標題後不讓盒子上飄；手機維持水平 scroll snap，改為在可視高度內置中。三個 href、盒彩框、封面、hover／focus 與盒面透視均不變；CSS query 更新為 `20260901-titleless-shelf-v10`。
- 邊界：仍是隔離候選頁，不取代正式根路由，不改卡牌、Board、西洋棋程式、登入、房間、存檔或 Socket.IO event。
- 驗證：現有 8787 服務下候選頁與三個入口均 HTTP 200；DOM 只剩一個不可見無障礙標題、三個遊戲連結與三張封面，五段不需要的可見文案均為 0。瀏覽器實測桌機 `1280×720` 與手機 `390×844`：桌機盒架位置維持 `top≈270 / bottom≈677`，手機第一盒完整顯示並保留左右滑動。

## 修改紀錄：新世界航海錄 BGM 連貫性 V407（2026-09-01）

- 問題：短 modal、換玩家、重複 render 與大量 `force:true` 會讓不同 `musicScope` 立刻換曲；選曲器又刻意排除正在播放的歌曲。新音檔尚未成功播放時，舊版管理器已先改寫 current 狀態，因此手機載入慢或 autoplay 失敗時可能出現中斷、錯歌或重疊。
- 播放器：`bgm_manager.js` 改為「準備新音檔並成功 `play()` 後才交棒」，使用約 2.6～3.2 秒交叉淡化、最新請求序號、可取消的延後切換、同曲不重播、戰鬥／高潮保留期與鎖定後只處理最後場景。失敗會清理候選 Audio 並保留舊曲；既有公開 API、`board_bgm_enabled`／`board_bgm_volume` key 與父頁共用方式維持。
- 片段：56 首 `bgm_new` OST 逐首加入 `cueInSec`、`cueOutSec` 與 `gainDb`，播放時跳過實測首尾靜音並於 cue 區間循環，不修改原始 MP3；循環點會先短淡出、回到 cue-in 再淡入，避免整首播完後硬跳接。音量修正限制在 -4～+6 dB；34 秒的 `more_and_more` 改為不循環且避免過度使用。20 首 `bgm/` 主題曲仍獨立保留，不在普通小場景間輪切。
- 導演：海上、一般島嶼、冷／熱島、商店、酒館、醫院、研究所、海上事件、一般戰、13 名周目 Boss、洛克斯、高潮、勝利、推進城樓層、頂上戰爭及各段漫畫劇情均有明確首選曲。登島選擇沿用地圖曲；Boss 遭遇視窗直接沿用即將開戰的專屬曲，不先插播一次通用前奏；服務 modal 停留 8 秒、事件停留 5 秒後才換，期間關閉會取消；整段漫畫劇情只建立一個 story scope，不逐幕切歌。
- 影片：新增可巢狀 audio focus。卡塔庫栗見聞色與頂上戰爭霸王色影片播放時把 BGM 壓至 8%／6%，期間連舊 `force` 也不能換曲；結束、錯誤、逾時或離頁均釋放並平滑恢復。既有五檔與六王銃專屬流程不改。
- 邊界：只改 Board 音樂 metadata、選曲、播放控制、Board／戰鬥／Marineford 接點、cache query、專項 QA 與文件；沒有新增 `BOARD_GAME_STATE` 欄位、Socket.IO event、角色／道具／地圖 id 或存檔 schema，也沒有碰卡牌與西洋棋遊戲。
- 驗證：`node --check` 通過六份修改／測試 JS；`node scripts/board_bgm_continuity_qa.js` 驗證 56／56 音檔、片段／音量、首選路由、14 組周目／洛克斯 Boss 接線、只保留最後解鎖請求、短場景取消、同曲延續、載入失敗回復、cue loop、focus 鎖與靜態接線並 PASS。`PORT=8798 npm start` 成功監聽；正式頁、三支 BGM JS 與 5.36 MiB 冷島 MP3 均 HTTP 200，MP3 支援 byte range。本機未設 `DATABASE_URL` 為既有靜態預覽提示；當次沒有可用瀏覽器控制連線，因此沒有宣稱額外互動式／聽感 QA。

## 修改紀錄：三款專屬盒彩框／逐框透視 V406（2026-09-01）

- 素材：將使用者完成去背的棕紅、海藍、黑紫盒框非破壞性另存為 `launcher_card_box_frame_cutout_v1.png`、`launcher_board_box_frame_cutout_v1.png`、`launcher_chess_box_frame_cutout_v1.png`；三張均為 `1086×1448 RGBA`。SHA-256 依序為 `B5CF8BA94BE335BC9087FC497383C25D3DEF86960BF9F8C38E0C3AA7CE3AA59E`、`2C7BD3EF0AB2E746F92BFA19A2ED661D5C18747D8860EF7EAD7EB5FACD4CE0AA`、`85896BEF4C9A5E1839378307E82AE1F45B291BC3BE85A77D38A22102742014B5`；Downloads 來源及 V405 共用框都保留。
- 校準：三框的透明開口不同，`build_game_launcher_perspective_covers.py` 改為每個 job 各自保存 frame 與 homography quad。卡牌使用 `(74,155)`／`(887,172)`／`(887,1322)`／`(74,1265)`，Board 使用 `(70,133)`／`(882,154)`／`(882,1313)`／`(70,1255)`，Chess 使用 `(76,134)`／`(890,153)`／`(890,1357)`／`(75,1298)`；輸出升版為 card V2、Board／Chess V5。
- 接入：候選頁三個 frame `src` 與 preload 分別改讀專屬框，三張封面改讀逐框透視成品；反光層也拆成三組 matching polygon。盒子 DOM、三個 href、hover、桌機三欄、手機水平 scroll snap 與 `1086:1448` 比例不變；CSS query 更新為 `20260901-themed-box-frames-v9`。
- 防呆：重建工具會找出各框最大的封閉透明開口與外部透明畫布；任何開口未覆蓋或封面溢出外框都直接失敗，避免只靠目視判斷。
- 邊界：只改隔離啟動頁、專用 CSS、版本化盒彩框／封面衍生圖、重建工具及文件；正式首頁、部署、登入、房間、存檔、Socket.IO event、遊戲規則與 `BOARD_GAME_STATE` 均未更動。
- 驗證：三張合成圖以原尺寸目視，四角、斜底邊、右側盒脊、人物及 Logo 都正常；重建結果分別為開口 `902,861`／`911,217`／`947,272` pixels，三者皆 `uncovered=0`、`min_alpha=255`、`outer_spill=0`。既有 8787 服務下候選頁、V9 CSS、三框、三封面及三入口共 11 個網址皆 HTTP 200。瀏覽器控制當次沒有可用連線，因此未宣稱額外的互動式瀏覽器截圖。

## 修改紀錄：四角透視封面校準 V405（2026-09-01）

- 問題：V403／V404 仍是把正面圖片鋪在盒框後方再用 CSS 裁切，沒有把封面四個原始角真正映射到盒框四角；即使不露縫，圖面線條仍不像印刷在斜盒面上。
- 校準：由 `launcher_box_frame_cutout_v3.webp` 透明開口的四條直邊線性擬合，交點約為左上 `(76,161)`、右上 `(885,179)`、右下 `(885,1319)`、左下 `(76,1264)`。正式輸出使用各向外約 2 px 的 `(74,158)`、`(887,176)`、`(887,1322)`、`(74,1266)`，讓抗鋸齒邊也由盒框而非頁面背景覆蓋。
- 產物：新增 `scripts/build_game_launcher_perspective_covers.py`，以 OpenCV homography 將每張完整來源封面的四角一對一轉換到上述四點，輸出同為 `1086×1448` 的透明畫布：`launcher_card_cover_perspective_v1.png`、`launcher_board_cover_logo_perspective_v4.png`、`launcher_chess_cover_logo_perspective_v4.png`。來源 `cover.jpg` 與兩張 V3 使用者成品均未覆蓋。
- 接入：候選頁三張 `src`／preload 改讀透視成品；`.box-front` 回到完整畫布，不再用 CSS polygon 假裁封面，圖片一律 `object-fit:contain`。反光層單獨使用同一四點 polygon，hover 只調色、不再放大封面，確保任何互動狀態四角都不偏移。CSS query 更新為 `20260901-four-corner-perspective-v8`。
- 邊界：只改隔離啟動頁、專用 CSS、版本化衍生圖、重建工具與文件；三個 href、遊戲規則、正式首頁、部署、登入、房間、存檔、Socket.IO event 與 `BOARD_GAME_STATE` 均未更動。
- 驗證：三張透視成品逐張與正式盒框原尺寸疊合目視，四角、Logo、人物及斜底邊皆對齊。再以盒框最大內部透明連通區 903,939 pixels 逐像素比對，三張成品的 `alpha=0` 未覆蓋像素皆為 0；既有 8787 服務下候選頁、V8 CSS、三張透視成品與盒框共 6 個網址均 HTTP 200。

## 修改紀錄：使用者正式封面／霸海戰棋正名 V404（2026-09-01）

- 素材：使用者提供兩張已含正式 Logo 的完整封面，非破壞性另存為 `public/images/game_launcher/launcher_board_cover_logo_v3.png`（`998×1360`、SHA-256 `801C9858A326099C0D8C024853FD43FD420FFD6A79C93868B19CC4B4312DC5EC`）與 `launcher_chess_cover_logo_v3.png`（`1086×1448`、SHA-256 `FD157C20872DE0364EF0A007581A7FA23CB6B53F221E85FCAD7333F36181C7EE`）。Downloads 來源、V1／V2 封面及舊 SVG Logo 全部保留、沒有覆蓋。
- 接入：候選頁的 Board／Chess `src` 與 preload 改讀兩張 V3 成品；因 Logo 已燒進封面，移除兩個 `.box-logo` 節點、兩張 SVG preload 與未再使用的 CSS 規則，避免雙重 Logo。V403 全出血盒面與使用者挖空盒框繼續共用。
- 正名：Chess 顯示名稱與 `aria-label`／`alt` 由「霸海棋戰」統一改為「霸海戰棋」，與使用者提供的成品 Logo 一致；遊戲 href 仍為既有 `battle_chess/index.html`。
- 邊界：只改隔離啟動頁、專用素材／CSS 及文件；不改 Chess 內部規則、Board、卡牌、正式根路由、部署、登入、房間、存檔、同步或 `BOARD_GAME_STATE`。CSS query 更新為 `20260901-provided-cover-v7`。
- 驗證：兩張 V3 成品依正式 V6 全出血 polygon 合成並疊上 `launcher_box_frame_cutout_v3.webp` 逐張目視，人物、Logo、右側與右下皆填滿且無空隙。既有 8787 服務下候選頁、V7 CSS、兩張新封面與盒框共 5 個網址均 HTTP 200；runtime `.box-logo` 節點為 0，舊名稱為 0，新名稱為 2。

## 修改紀錄：右下全出血補滿 V403（2026-09-01）

- 問題：V402 把右邊整條邊線由上到下提早內縮到 93%，但實際盒框開口的右側在大部分高度保持垂直，只有最底端才由黃銅護角收進去，因此右下透明開口可能露出頁面背景。
- 修正：保留 V402 的正面範圍、圖片透視比例與斜底邊，將裁切改為 `polygon(0 0, 100% 0, 100% 100%, 0 94.5%)`。封面完整延伸到右上、右下與盒框底部，實際斜面和護角改由 `launcher_box_frame_cutout_v3.webp` 本身遮出，不再以 CSS 過早切掉圖片。
- 邊界：只改候選啟動頁 CSS 與 cache query；封面、Logo、盒框、href、正式首頁、部署、存檔、同步與規則均未更動。query 更新為 `20260901-full-bleed-cover-v6`。
- 驗證：用 `1086×1448` 正式 Board 封面依 V6 polygon 合成並疊上正式盒框目視，頂、左、右與右下透明開口均有圖，底邊由盒框自然遮成斜面且沒有黑縫；既有 8787 服務下候選頁與 V6 CSS 均 HTTP 200。

## 修改紀錄：盒面梯形透視填滿 V402（2026-09-01）

- 問題：V401 已把封面放進使用者提供的挖空盒框，但盒框正面不是矩形；上緣微斜、右下收窄且底邊往右下延伸，矩形 `.box-front` 會讓封面與實體盒角度不一致，斜邊附近也可能露出背景。
- 校正：依 `launcher_box_frame_cutout_v3.webp` 的 `1086×1448` 透明開口量測，將盒面容器調為 `top:10.55%`、`left:5.25%`、`width:77.15%`、`height:81.1%`，並以 `polygon(0 0, 100% 2.5%, 93% 100%, 0 94.5%)` 建立響應式梯形。封面多鋪進盒框下方，由黃銅護角與盒邊遮住 overscan，因此四邊填滿、不留黑縫；同時提供 `-webkit-clip-path` 給 iPad／Safari。
- 圖片：三張封面改用 `object-fit: fill` 服貼同一透視正面，不產生新裁圖、不覆寫原封面；Board／Chess 只做約 5% 的橫向透視壓縮。兩張 Logo 往內收為 `left:6%`／`width:84%` 並上移至 `bottom:6.5%`，避免被右下斜角與底框裁掉。
- 邊界：只修改候選啟動頁專用 CSS 與 stylesheet query；三個 href、正式首頁、部署、登入、房間、存檔、同步、`BOARD_GAME_STATE`、遊戲規則與素材檔均未更動。query 更新為 `20260901-trapezoid-cover-v5`。
- 驗證：以原尺寸封面、梯形遮罩及正式挖空盒框離線合成逐角目視，確認頂部、左右與斜底邊均由封面覆蓋且人物未被切掉；`PORT=8799 npm start` 成功監聽，候選頁、V5 CSS、盒框及兩張 filled 封面共 5 個網址皆 HTTP 200。本機未設 `DATABASE_URL` 的提示為既有靜態預覽行為。

## 修改紀錄：原封面滿版補圖／挖空盒框 V401（2026-09-01）

- 需求修正：保留使用者喜歡的 V398 `新世界航海錄`／`霸海戰棋` 原封面人物與構圖，不改用另一套重畫封面；只把兩張圖底部的深藍文字預留面板補成自然場景，再把 V400 的正式 Logo 放在補圖上，封面不再有空白輸入區。
- 補圖：以原圖作 ImageGen 編修參考，新增 `launcher_board_box_preview_filled_v2.png`（海洋、島嶼與發光航線延伸）及 `launcher_chess_box_preview_filled_v2.png`（紅橙／紫色能量海面與棋盤延伸），皆為 `1086×1448`。原 `launcher_board_box_preview_v1.png`／`launcher_chess_box_preview_v1.png` 完整保留、沒有覆蓋；先前另外產生的滿版候選也沒有接入 runtime。
- 盒框：使用者提供的挖空透明 WebP 非破壞性另存為 `launcher_box_frame_cutout_v3.webp`（`1086×1448`），以單一前景圖取代 V399 盒殼的底圖＋四段遮罩；中心顯示封面、右側保留實體盒脊、外圍保留透明區。三盒共用同一盒框，卡牌正式 `cover.jpg` 不變。
- 接入：`game_launcher_preview.html` 預載並引用兩張 filled 封面與挖空盒框；Board／Chess 封面在透視正面採 `object-fit: cover`，V400 Logo 直接疊在下方延伸場景並上移避開盒框。整盒仍是唯一連結，沒有封面按鈕、說明、類型或輸入區；CSS query 更新為 `20260901-filled-cover-v4`。
- 邊界：仍只修改隔離候選啟動頁、專用 CSS、版本化素材與文件；沒有更換 server 根路由、部署清單、登入、房間、存檔、Socket.IO event、`BOARD_GAME_STATE`、Board 規則或三款既有遊戲入口。
- 驗證：獨立 `PORT=8799 npm start` 成功監聽；本機未設 `DATABASE_URL` 的資料庫提示符合既有行為，候選頁、CSS、盒框、兩張 filled 封面、兩張 Logo 與三個入口共 10 個網址均 HTTP 200。瀏覽器完成 1440×900、1024×768、932×430、390×844 檢查：所有圖片解碼成功，3 個盒框、2 個 Logo、3 個整盒連結皆存在，舊盒殼／舊候選封面 runtime 節點與封面按鈕皆為 0；頁面無橫向 overflow，手機盒架可正常滑到 Board／Chess，短橫向畫面三盒底部仍在 420px 內。

## 修改紀錄：航海錄／棋戰封面 Logo V400（2026-09-01）

- 需求：`新世界航海錄` 與 `霸海戰棋` 不能只在封面下方放普通文字，要像既有 `偉大航道爭霸戰` 一樣有正式封面 Logo，同時不能重新加入遮圖的說明或按鈕。
- 素材：新增 `public/images/game_launcher/launcher_board_logo_v1.svg` 與 `launcher_chess_logo_v1.svg`。兩者以精準向量中文字製作，避免生成圖誤字；航海錄使用青藍海圖、古金羅盤與波浪線，棋戰使用深紅黑金、紫色棋局能量與棋冠紋章。Logo 背景透明，名稱保持 HTML 可讀的 `alt`。
- 接入：Board／Chess 盒面的普通 `.box-title-mark` 改成 Logo 圖，限制於候選封面原本預留的底部深藍區；卡牌仍完全沿用既有 `cover.jpg`。三盒繼續以整盒作連結，沒有封面按鈕、遊戲類型或說明。
- 邊界：只修改候選啟動頁與專用素材／CSS；不改三款遊戲入口、登入、房間、存檔、同步、Board 規則或發布清單。CSS query 更新為 `20260901-gallery-logo-v3`。
- 驗證：1440×900 三盒同列與 390×844 水平滑動皆完成目視；兩張外部 SVG 均解碼為 300×78 natural size，手機實際顯示約 193×51，中文、外框及徽記保持可辨識。頁面無橫向 overflow，封面按鈕節點仍為 0。

## 修改紀錄：航海收藏室背景／生圖實體盒殼 V399（2026-09-01）

- 問題：V398 的純 CSS 漸層背景、假上緣與折角盒厚仍像網頁卡片，沒有真正桌遊盒的材質、側脊與陳列空間；同時三款名稱需要正式統一。
- 視覺：以內建 ImageGen 分別產生 `1672×941` 的航海收藏室／海景／木桌背景 `public/images/game_launcher/launcher_gallery_background_v2.png`，以及 `1086×1448`、外圍透明的深藍木質桌遊盒殼 `launcher_box_shell_v2.png`。盒殼含實體上蓋厚度、右側書背、黃銅護角、繩結與浪紋；原始卡牌封面與兩張既有候選封面仍由 HTML 直接嵌入，沒有讓生成模型重畫文字或覆蓋來源圖。
- 實作：重寫 `public/game_launcher_preview.html` 與專用 CSS；移除舊漸層海面、虛線航路、CSS 假盒頂／盒側／盒底，改以同一張透明盒殼的底層與四段前景遮罩把封面真正夾入正面凹槽。桌機三盒陳列在背景木桌，手機改成置中水平滑動與 scroll snap，保留鍵盤 focus、hover 抬盒與 reduced-motion。
- 簡化：依回饋移除盒面上的遊戲類型、說明與啟動按鈕，整個桌遊盒即為可點選區。卡牌完整保留既有封面；Board／Chess 只在候選圖原本預留的深藍標題區放名稱，不遮住角色與棋盤主圖。
- 名稱：三盒統一為 `ONE PIECE 偉大航道爭霸戰`、`ONE PIECE 新世界航海錄`、`ONE PIECE 霸海戰棋`；卡牌第一款名稱依使用者指定，Board／Chess 採本次新命名。
- 邊界：仍是獨立預覽頁，沒有修改 server 根路由、登入、房間、存檔、`BOARD_GAME_STATE`、Socket.IO event、卡牌／Board 正式入口或 Render 發布清單；Chess 連結仍只供本機 junction 預覽。
- 驗證：本機 8787 服務下新頁、CSS、兩張新素材與三個既有入口均 HTTP 200。瀏覽器實測 1440×900、1024×768、932×430、390×844；三個 `1086×1448` 盒殼、12 段邊框遮罩與全部封面皆完成解碼。桌機／平板三盒完整位於 viewport 且無頁面橫向 overflow；932×430 三盒底部為 420px，完整保留；390×844 頁面本身不橫溢，盒架可水平捲動 604px 並正常切換三盒。盒面按鈕、類型與說明節點皆為 0。

## 修改紀錄：三遊戲桌遊盒啟動頁候選 V398（2026-09-01）

- 需求：先提供卡牌、大富翁與西洋棋共用啟動頁的實際版型，三張遊戲圖都要像獨立桌遊盒，而不是一般平面選單；卡牌直接沿用既有正式封面，大富翁與西洋棋先使用本次確認中的候選圖。
- 實作：新增隔離頁 `public/game_launcher_preview.html` 與專用樣式 `public/css/game_launcher_preview.css`。每盒以 HTML/CSS 建立正面、上緣、右側盒脊、下方盒厚、桌面接觸陰影、滑過抬起及鍵盤 focus；名稱、說明與入口按鈕保持 HTML，不燒進圖片。卡牌封面使用 `object-fit: contain`，不裁切或覆寫 `public/images/cover.jpg`。
- 素材：將已展示的 Board／Chess ImageGen 候選各保留一份描述性副本於 `public/images/game_launcher/launcher_board_box_preview_v1.png` 與 `launcher_chess_box_preview_v1.png`；原生成檔不刪除，既有卡牌、Board 與西洋棋正式素材均未覆蓋。
- 入口邊界：本頁仍是獨立候選網址，不修改 server 根路由 `/`、`public/start.html`、`public/board_start.html`、`BOARD_GAME_STATE`、登入／房間／存檔／同步或部署清單。三盒按鈕只由候選頁分別連到現有卡牌、Board 與本機 Chess 頁；正式線上入口與 EXE 打包方式等待使用者看圖後再決定。
- 驗證：`npm start` 已於 8787 啟動靜態頁；`game_launcher_preview.html`、`start.html`、`board_start.html`、`battle_chess/index.html` 均 HTTP 200。瀏覽器實測 1440×900、1024×768、932×430、390×844：三張圖片解碼完成、三盒與名稱皆存在、桌機／平板三欄、手機單欄、無橫向 overflow；932×430 經短視窗壓縮後三盒完整位於 viewport，console warnings／errors 為空。

## 修改紀錄：行動裝置進場素材預下載 V397（2026-08-31）

- 問題：V396 已降低 iPad 地圖圖片的解碼記憶體，但第一次真正需要圖片時仍可能受網路速度影響；Board 全部原圖約 1.93 GiB，不能一次預載，因此只建立觸控行動裝置進場必需清單。
- 預下載：平板／手機開啟 `board_start.html` 250 ms 後，依 `public/images/board/mobile/manifest-v397.json` 背景下載 105 張 mobile WebP 與進化、重要道具、約克線索三張演出框，共 108 個檔案、5,039,358 bytes（約 4.81 MiB）。同時最多 6 個請求，只讀取 response bytes 存入 HTTP cache，不建立 `Image` 或提前解碼。
- 進場保護：單人 campaign、離線及線上房間三條進場路徑共用同一閘門；尚未完成時顯示持續進度畫面。第一次最多 30 秒，若 manifest 或個別素材失敗，進場前再以新請求重試最多 15 秒；仍失敗才提示並沿用已完成快取進場，不會永久卡住多人房。
- 準時顯示：地圖與 1～50 號頭像使用與 manifest 完全相同的版本網址；約克卡牌、寶箱結果、重要道具框及進化框也收斂到同一版本。重要道具與進化演出會等待當次所需圖片完成解碼後才顯示，避免先出現空框。
- 快取：只有帶 `v=20260831-portable-prefetch-v397` 的 mobile／三張指定框圖，以及檔名已版本化的 manifest，回傳 `Cache-Control: public, max-age=31536000, immutable`；無版本素材、HTML 與 JS 仍為 `max-age=0`，日後換圖不會被舊快取鎖死。
- 邊界：不改 `BOARD_GAME_STATE`、campaign、存檔、角色／道具／地圖 id、Socket.IO event、回合、戰鬥或原始大圖；桌機略過預下載，其他未列入 manifest 的素材仍按實際需要載入。
- 檔案：修改 `public/board_start.html`、`public/board_game.html`、`public/js/board_start.js`、`public/js/board_shared.js`、`public/js/board_game.js`、`server/index.js`；新增 `public/images/board/mobile/manifest-v397.json`、`scripts/build_board_mobile_prefetch_manifest.js`、`scripts/board_portable_asset_prefetch_qa.js`，並同步四份專案文件。
- 驗證：六支 V397 JS 均通過 `node --check`，manifest 重建為 108／108 且無缺檔；`npm start` 於 8800 啟動，兩個正式 HTML 皆 HTTP 200。iPad QA 驗證 108／108 下載、預載 `<img>` 0、108／108 immutable、無版本素材 `max-age=0`、進圖後 96／96 mobile 地圖，24 個實際唯一素材逐一有 resource entry 且 `transferSize=0`；故意讓一張圖第一次回 503 後，進場閘門顯示 107／108，第二次請求恢復為 108／108、`attempts=2` 並自動進圖。既有固定視角 QA 在 1024×768、932×430、390×844 全部通過，三尺寸皆無原尺寸地圖、無提前解碼演出框及 browser error。

## 修改紀錄：iPad 進入地圖記憶體降載 V396（2026-08-31）

- 問題：iPad 由等待室進入 `board_fixed_viewport.html` 時，WebKit 顯示「重複發生問題」。實際線上 1 真人＋3 CPU 量測沒有重新導向循環或 JS 例外，但主地圖初始同時建立 116 張已解碼圖片；重複元素估算約 345.5 MiB、唯一圖片約 144.8 MiB，再加上 DPR 2、CSS 濾鏡、合成圖層與 iframe，會對 iOS WebContent 造成顯著記憶體壓力。
- 修正：固定視角外框只在觸控行動裝置替內頁加入 `portable_assets=1`。地圖島嶼、海獸、礁石、船圖與 1～50 號頭像改讀 `public/images/board/mobile/` 的等比例 WebP 衍生檔；桌機、戰鬥、詳情與正式原圖維持原路徑。105 張衍生檔合計約 2.9 MB，原圖完全未覆寫。
- 延遲載入：進化人物框、重要道具揭露框與約克線索牌框的初始 `src` 改成 `data-src`，只有真正播放該演出時才指定 `src`。沒有新增預載全部素材，避免第一次進房額外耗用 Render 流量；瀏覽器仍會依標準 HTTP cache 保存已使用的小圖。
- 邊界：不改 `BOARD_GAME_STATE`、存檔、角色／道具／地圖 id、Socket.IO event、回合或戰鬥。主頁／共用模組 query 更新為 `20260831-ipad-memory-v396`。
- 檔案：修改 `public/board_fixed_viewport.html`、`public/board_game.html`、`public/js/board_game.js`、`public/js/board_shared.js`、`scripts/board_fixed_viewport_qa.js`；新增 `public/images/board/mobile/` 105 張顯示衍生檔，並同步四份專案文件。
- 驗證：`node --check` 通過主程式、共用模組與 QA；既有 8787 `npm start` 頁面回傳 200。固定視角 QA 於 1024×768、932×430、390×844 驗證 1920×900 內頁、query 保留、縮放點擊、96/96 張地圖圖片皆讀 mobile 路徑、三張隱藏大框初始請求為 0、browser errors 為 0；重複元素解碼估算降為約 50.7 MiB、唯一地圖圖片約 14.8 MiB，三尺寸皆 `failures=[]`。桌機 1920×900 未被導向固定外框且維持原圖。

## 修改紀錄：卡牌首頁裝置識別啟動修正 V395（2026-08-31）

- 線上雙帳號回歸發現舊卡牌首頁的非 React 好友程式可能早於 Babel 主程式完成編譯，先呼叫尚未建立的 `getDeviceId`；不會阻斷登入與房間，但會留下 page error，並可能略過第一次好友登入。
- 修正：在 `public/start.html` 最前面的同步 script 先建立與既有規則相同的 `window.getDeviceId`，之後 React 主程式仍可沿用原函式；沒有改帳號 key、密碼、卡牌房 Socket event、Board 狀態或遊戲規則。
- 驗證：V394 線上雙帳號流程已實際完成舊卡牌 2 人等待室、Board 首頁 4 選單、正式好友、即時私訊、Board 房邀請及 2/4 同房；V395 發布後須重跑並確認兩頁 `pageerror=[]`。

## 修改紀錄：Board 首頁主選單／正式好友私訊 V394（2026-08-31）

- 首頁：`board_start.html` 登入後固定先顯示「開始航海／繼續航海／好友與聊天室／玩家資料」四選單；建立／加入房間、共有航海紀錄與社交說明各自進入第二層 view，不再一開頁就把房間或整份紀錄鋪在首頁。帳號卡、既有房間、campaign 與本機測試資料流程不改。
- 正式社交：移除 `board_shared.js` 的假好友、假邀請與假聊天內容，改以目前 Board Socket 進行 `SOCIAL_AUTH`、`PRESENCE_SET`、`FRIENDS_GET`、好友新增／確認／拒絕／刪除、`DM_HISTORY`、`DM_SEND`、`FRIENDS_DIRTY` 與 `DM_NEW`。好友名單、在線狀態、待確認邀請、歷史訊息與即時未讀都使用雲端帳號及資料庫；未登入或本機沒有 `DATABASE_URL` 時顯示明確不可用狀態，不再造出預覽玩家。
- Board 房邀請：沿用既有 `LOBBY_INVITE_SEND`／`LOBBY_INVITE_RESPOND`，只增加 `mode:"board"` payload；server 會在 `boardRooms` 驗證邀請者確實在等待室、房間未開局、雙方為好友且接收者在線。Board 邀請用 `EMIT.type="board_lobby_invite"`，不會被舊卡牌頁誤當成卡牌房；接受後前往同一個 `board_start.html?view=lobby&room=...` 並由原 `BOARD_JOIN_ROOM` 加入。
- 遊戲中：正式 `board_game.js` 的 LAN Socket 也交給同一份社交模組，因此好友與私訊在進入地圖後仍保持連線；沒有新增 `gameState`／campaign 欄位、角色／道具／地圖 id，也未改完整 `BOARD_GAME_STATE` 權威。
- 檔案：修改 `public/board_start.html`、`public/js/board_start.js`、`public/js/board_shared.js`、`public/board_game.html`、`public/js/board_game.js`、`server/index.js`；新增 `scripts/board_home_social_qa_server.js`、`scripts/board_home_social_qa.js`，並同步四份專案文件。開始頁、共用模組與主遊戲 query 統一為 `20260831-home-social-v394`。
- 驗證：`node --check` 通過 server、三支正式 JS 與兩支專項 QA；正式 `PORT=8798 npm start` 啟動，`board_start.html`／`board_game.html` 皆 HTTP 200 且載入 V394。帶 mock PostgreSQL 的真實 Socket.IO 專項測試以 1600×900 與 1024×768 兩個獨立登入身分完成：首頁 4 選單、首頁不展開房間／紀錄、好友確認、正式私訊寫入與另一端 `DM_NEW`、建立 Board 房、好友房邀請、接受後兩端同房 2/4；結果 `ok=true`、`errors=[]`，截圖與 JSON 位於 `.codex/qa/board_home_social_v394/`。

## 修改紀錄：觀看方正式介面補齊 V393（2026-08-31）

- 盤點：逐一比對正式 `emitSpectatorModalEvent()` 的 15 種實際 kind 與 `openSpectatorBoardModal()` 分流，確認 `final-island-revisit`、`final-boss-voyage-compass` 原本沒有專用 renderer，會落回通用藍色行動 HUD；其餘海域卡、寶箱、商店、醫院、研究所、競技場、司法島、酒館與任務牆均已有正式觀看版。
- 修正：最終之島重訪改由操作方與觀看方共用 `finalIslandRevisitPanelConfig()` 及既有航海情報框；大熊 Boss 航向羅盤改由雙方共用同一份 13 張 cover-flow markup。操作方每次左右切換線索牌都以輕量事件同步目前 `selectedBossKey`，不額外傳完整快照；觀看端立即切到相同卡片，但所有卡片、箭頭與確認均維持唯讀，只保留「關閉觀看」。
- 防線：未知 `spectator-modal` kind 不再呼叫藍色 `showBoardUiHud()`，改以既有 `encounter_panel_frame.webp` 航海情報框顯示唯讀摘要。沒有新增 Socket.IO event 名稱、gameState／battleState 欄位、localStorage key、角色／道具／地圖 id；規則結果仍由操作方與完整 `BOARD_GAME_STATE` 決定。
- 檔案：修改 `public/js/board_game.js`、`public/board_game.html`、新增 `scripts/spectator_modal_ui_qa.js`，並同步四份專案文件。正式主頁 query 更新為 `20260831-spectator-formal-ui-v393`。
- 驗證：`node --check` 通過主程式與專項 QA；靜態比對顯示 15 種正式 emit kind 的未處理數為 0。獨立 8796 `npm start` 服務建立兩個真人 Socket.IO 房，在 1280×720 與 1024×768 依序由房主送出最終之島重訪、13 卡大熊羅盤與未知 kind；觀看端分別得到正式航海框、13 張唯讀羅盤與正式後備框，三者 `oldBlueHudOpen=false`，兩尺寸均 `errors=[]`、`failures=[]`。首次直接以專案 Node 執行因專案未安裝 Playwright 而停止，未修改正式依賴；改用 Codex 隨附唯讀 Node 套件後完整通過。兩組截圖已目視確認無裁切。

## 修改紀錄：觀看端寶箱完整演出同步 V392（2026-08-31）

- 問題澄清：觀看方的「舊 UI」不是只有過期畫面未清除，而是操作方進入漂流寶箱時，其他玩家看不到四箱與洗牌；開箱後也因事件未帶寶箱種類／圖片，只能落回通用藍色結果框。
- 同步：沿用 V391 的非持久化 `BOARD_GAME_EVENT`，把寶箱流程拆成 `chest-draft`、`chest-shuffle`、`chest-result` 三個 `spectator-modal` kind。事件只帶四個候選的槽位／種類／最終順序、比例 id 與最後抽中的種類／圖片，不新增 Socket.IO event 名稱、不寫入 `BOARD_GAME_STATE` 或存檔。
- UI：操作方與觀看方共用同一組寶箱 draft／result markup。觀看方依序顯示四個正式寶箱、翻面洗牌、最後抽中的木／銅／銀／金／寶石箱圖片與 `important_item_reveal_panel_frame.webp`；觀看卡片不綁選擇事件並禁止滑鼠操作。一般海域卡結果流程不改。
- 檔案：修改 `public/js/board_game.js`、`public/board_game.html` 與四份專案文件；主頁 query 更新為 `20260831-lan-spectator-chest-sync-v392`。沒有新增頂層 state、localStorage key、角色／道具／地圖 id。
- 驗證：`node --check public/js/board_game.js`、`node --check server/index.js`、`git diff --check` 通過。真實 Socket.IO 房以兩個正式 Board DOM 頁驗證：觀看方 draft 為 4 箱、洗牌完成為 4 張 ready 卡、結果取得實際 `gold` 種類、`chest_gold.webp` 與金色重要道具框，三段皆未建立 `.sea-event-result-ui` 通用藍框，雙頁 page error 為 0。

## 修改紀錄：多人流量瘦身／觀看端舊 UI 清除 V391（2026-08-31）

- 需求：降低四人房的 Render 傳輸量，同時修正觀看方偶爾停留在舊骰子、舊提示或舊海域選擇畫面的問題；不得犧牲刷新後的完整狀態恢復。
- 壓縮／紀錄：Socket.IO WebSocket 啟用 `perMessageDeflate`（1 KiB 以上、level 6、雙向 no-context-takeover）。`gameState.log` 在載入、追加與產生存檔前都只保留最新 500 筆；舊存檔會先把依歷史紀錄判斷的外觀獎勵轉成既有永久玩家狀態，再裁切。原本以紀錄長度作亂數鹽的流程改取最近紀錄雜湊，避免到 500 筆後固定重複。
- 同步分層：`BOARD_GAME_STATE` 仍是玩家、地圖、戰鬥與刷新恢復的唯一完整權威快照。新增不快取、不寫存檔的 `BOARD_GAME_EVENT`，只傳短暫 UI 與逐格船位；移動每格傳輕量位置，最多每 4 格補一份完整檢查點，抵達、事件、戰鬥與其他重要狀態仍送完整快照。server 限制事件 64 KiB，並沿用目前行動者／戰鬥／切磋／交易控制權驗證。
- 舊 UI：完整存檔的 `boardUiEvent` 固定為 `null`；短暫事件帶 `createdAt`／`expiresAt` 與 server 房間序號，觀看端拒絕過期或倒序事件，到期會清除 HUD、骰子與屬於該事件的觀看彈窗。交棒提示仍會延後套用下一份完整快照，維持原動畫順序。
- 檔案：修改 `server/index.js`、`public/js/board_game.js`、`public/board_game.html`，並同步四份專案文件；主頁 query 為 `20260831-lan-event-compression-v391`。沒有新增頂層 `gameState` 欄位、localStorage key，也沒有改角色／道具／Boss／地圖 id。
- 驗證：`node --check server/index.js`、`node --check public/js/board_game.js`、`git diff --check` 通過；`npm start` 於 `127.0.0.1:8787` 啟動且主頁 HTTP 200。真實 WebSocket 雙端驗證壓縮協商、完整快照、輕量事件與非當前玩家拒絕；正式頁 DOM 驗證觀看船位會動但權威位置不變、短暫 HUD 到期清除、過期快照事件不重播且 page error 為 0。四連線房收到 3／3 fan-out，刷新請求取回相同完整版本。750 筆測試紀錄保存後為 500 筆且 `boardUiEvent=null`；現有 `B1007` 樣本由 1,887,341 bytes／gzip 232,420 bytes 降為 833,831／118,504，`CURRENT` 樣本由 4,879,566／169,088 降為 640,255／75,874（只在記憶體模擬，不覆寫玩家存檔）。

## 修改紀錄：線上發布隔離與 Board 雲端持久化 V390（2026-08-31）

- 需求：整理並部署 Board，但不能用本機舊 commit 覆蓋既有卡牌正式站；西洋棋暫不發布。
- 發布基底：正式部署鎖定 GitHub `az12sx45/onepiece-card-online` 的遠端 `main`（盤點時為 `885b0e7`），另建 `codex/board-release-v389` worktree／分支作發布組裝，不在目前 detached、含大量未追蹤檔案的工作區直接提交。
- 持久化：Render 有 `DATABASE_URL` 時，`board_saves` 與 `board_campaigns` 使用新增的 PostgreSQL JSONB 表與時間索引，寫入採 upsert；沒有資料庫的本機測試仍沿用 `server/data/board_saves`、`server/data/board_campaigns` JSON，既有 API、Socket.IO event 與 `BOARD_GAME_STATE` schema 不改。
- 發布排除：`.gitignore` 排除西洋棋 junction／圖示、所有 Board 素材 `incoming` 來源稿、本機 QA 輸出，以及本機玩家 save／campaign JSON；正式發布只整理執行頁、執行 JS、正式素材與伺服器程式。平板固定比例頁、切磋秘密選角頁與約克正式謎題頁雖保留歷史 `demo` 檔名，實際由正式流程載入，已列為發布必備檔。
- 依賴安全：發布 worktree 移除遠端曾誤追蹤的 `node_modules`，以 lockfile 乾淨 `npm ci`；`npm audit fix --package-lock-only` 將既有 semver 範圍內套件鎖到 Express 4.22.2、Socket.IO 4.8.1、Engine.IO 6.6.9、ws 8.21.3 與 qs 6.15.3，production／全依賴 audit 均為 0 vulnerabilities，不執行跨 major 自動升級。
- 發布前驗證：103 個正式／QA JavaScript 全部通過 `node --check`；無 `DATABASE_URL` 的檔案模式完成 PUT／GET／跨房號 fallback／DELETE；mock PostgreSQL 建表、upsert、讀取、最新備援與刪除輸出 `BOARD_PERSISTENCE_DB_QA=PASS`。素材清單共 3,836 檔、1,281 條直接素材引用與 37 條正式頁／script／stylesheet 引用全數存在，且不含西洋棋、`incoming`、私人 JSON 或超過 100 MiB 的單檔。另完成 2 真人＋2 CPU 一周目 5 Boss／二周目 15 Boss 長跑（29 張截圖、0 failure）、三裝置 LAN、切磋正式／LAN、戰鬥刷新五情境、Tot Musica 雙世界、13 Boss UI／素材、武器庫 94 件／4,371 組、卡塔庫栗與桌機／平板／手機固定視窗回歸；production npm audit 為 0 vulnerabilities。實際 GitHub 上傳、Render 建置與線上 smoke test 完成後再由部署回報保存結果。

## 修改紀錄：背景骰子融合與發布範圍修正 V389（2026-08-31）

- 需求：骰子要更像背景原生物件，不能像一張發光方圖貼上去；西洋棋暫不隨本次 Board 發布。
- 骰子：再縮小外觀，透明度降至 24%，改成背景同色的低飽和／低亮度；圓形遮罩從原本保留至 52% 收緊為 43%，在 49% 開始淡出並於 61% 完全透明，去掉大部分黑底與外圍火圈，只留下像背景浮雕的骰體。
- 發布範圍：移除登入後的西洋棋 portal、路由與樣式；本機 `public/battle_chess` junction 持續由 `.gitignore` 排除，既有西洋棋原專案與已製作的未使用 SVG 不刪除，之後另行接入。
- 檔案：修改 `public/start.html` 並同步專案文件；Board 入口、登入條件與帳號交接未變。
- 驗證：以正式背景、中央主選單尺寸及同一套 CSS 建立一次性視覺 QA（驗證後已刪除）：1280×720 時骰子邊界約 `(54,349,83,83)`；1024×768 時約 `(23,374,68,68)`，皆完整位於畫面內且無橫向 overflow。線上首頁與骰子均回傳 200；乾淨瀏覽器重載無 console error，登入前入口數仍為 0；`git diff --check` 通過。

## 修改紀錄：背景融合骰子／西洋棋入口 V388（2026-08-31）

- 需求：登入後的隱藏入口不要黏在主選單卡片上；改為一顆骰子與一枚西洋棋棋子融入卡牌首頁的動畫背景，背景裁切／縮放時也要保持在同一場景位置。
- 背景對位：新增獨立 `secret-mode-scene` 16:9 虛擬畫布，尺寸採與 `object-fit: cover` 背景影片相同的 cover 計算。骰子固定於左側金幣區，棋子固定於右側卡牌區；桌機、平板或橫向手機裁切時會隨背景畫布一起縮放與位移。影片失敗改用 Ken Burns 封面時，入口內層會套用同一組 18 秒縮放／上移節奏。
- 顯示／互動：兩個入口由登入成功後才建立的 `MainMenu` 透過 React portal 放入背景層，因此登入前 DOM 數量仍為 0。兩者無文字、無按鈕底框，預設低亮度並帶輕微漂移；滑鼠、鍵盤聚焦或觸碰時才加亮。骰子進入 `board_start.html?from=secret-route` 並保留 V387 帳號交接，棋子進入 `battle_chess/index.html`。
- 素材隔離：骰子沿用 Board 的正式 `odd_dice.webp`；新增透明 `public/images/secret_modes/battle_chess_piece.svg`，以西洋棋離線版既有 favicon 的皇冠棋子語彙重畫為橘金背景用的小圖標。線上測試以 `public/battle_chess` junction 指向原本西洋棋離線版，沒有複製、改名或混入其正式素材；`.gitignore` 排除該測試 junction。
- 檔案：修改 `public/start.html`、`.gitignore`，新增 `public/images/secret_modes/battle_chess_piece.svg`，並同步三份專案文件；西洋棋原專案檔案未修改。
- 驗證：秘密入口數量／portal／登入階段／兩目標路徑／16:9 cover／4:3 安全裁切與舊卡片圖標移除的靜態檢查全數通過，`node --check public/js/board_shared.js`、`git diff --check` 通過。線上測試站的骰子、皇冠棋子 SVG、西洋棋首頁及其主 JS 均回傳 200；實際瀏覽器在 1265×720 與 1024×768 載入卡牌首頁無 console error、無橫向 overflow，登入前入口數為 0。4:3 的虛擬背景左右各裁約 178px 後，兩入口以可視邊緣安全公式保留在畫面內。登入後位置與點擊交由使用者帳號實際查看，測試未代填或讀取帳密。

## 修改紀錄：卡牌登入後秘密航線入口 V387（2026-08-31）

- 需求：玩家先沿用原卡牌遊戲帳號登入；登入成功後的主選單才顯示一枚低調的小型秘密圖標，點擊後進入 Board 開始頁。未登入、登入畫面與按任意鍵畫面都不顯示入口。
- 入口：移除原本固定在左下角、登入前也能看見的「航／大富翁」文字測試連結；改在 `MainMenu` 卡片左下放置 42px 海賊旗小圖標，預設低亮度，滑鼠／鍵盤聚焦時才略微發光，不增加一般主選單按鈕。
- 帳號交接：點擊時把 `PROFILE_GET` 的 `user_id`、玩家名稱、頭像、已裝備稱號、金幣與既有 `opSecret` 寫入 Board 已使用的本機帳號鍵，再進入 `board_start.html?from=secret-route`。`board_shared.js` 仍以 `op_user_id` 作正式身分，並補讀 Board 專用稱號／金幣鍵；沒有改角色、存檔 schema 或 Socket.IO event。
- 上線修復：本機卡牌頁原先改為抓取不固定版本的 React／Babel，實際 Chrome 會在新版 Babel 轉換舊 JSX 時停止啟動；改回正式站已驗證的 React 18.3.1／Babel 7.24.7 固定網址，並補回非 React 社交程式會使用的 `window.getDeviceId`。這只修復啟動依賴，不改卡牌規則。
- 檔案：修改 `public/start.html`、`public/js/board_shared.js`，並同步三份專案文件。
- 驗證：`node --check public/js/board_shared.js`、秘密入口／帳號鍵／目標路徑靜態檢查與 `git diff --check` 通過。Cloudflare 線上測試網址的 `/`、`board_start.html`、`board_shared.js`、圖標素材及 Socket.IO polling handshake 均回傳 200；實際 Chrome 可正常顯示「按任意鍵開始」與登入頁，登入前 `.board-secret-entry` 為 0，頁面無本次程式錯誤。登入後畫面保留給使用者以自己的帳號實際確認，未由測試程式代填帳密。

## 修改紀錄：帳號綁定開始頁主選單 V386（2026-08-31）

- 需求：正式上線會帶入玩家帳號，開始頁不應每次要求輸入名字並攤開 50 個頭像；個人進度與集合入口也應在開始頁依登入帳號直接顯示。
- 首頁：玩家卡改為唯讀顯示目前帳號的頭像、名稱、稱號與金幣，新增「建立／加入航海房」與「玩家資料」兩個主選單。`op_user_id` 存在時標示「已連結登入帳號」，名稱與頭像鎖定為帳號資料；沒有正式帳號時才允許在收合的玩家資料選單修改本機測試名稱與頭像。
- 紀錄：`我的航海紀錄` 從第二層房間選擇頁移到首頁。server 仍只回傳目前 user id 所屬 campaign；每張卡新增此帳號的保存時間、輪數、位置、最多六名船員摘要與目前狀態，個人按鈕改名「繼續個人航海」。建立／加入新房仍走原本第二層頁面，沒有改 Socket.IO event、campaign schema 或既有 id。
- 排版：首頁 hero 縮短以提早露出選單與紀錄；手機選單改單欄，玩家卡與紀錄維持 12px 安全邊距，並調整 hero 高度避開右上好友面板。開始頁 query 更新為 `20260831-account-menu-v386`。
- 檔案：修改 `public/board_start.html`、`public/js/board_start.js`，並同步四份專案文件。
- 驗證：`node --check public/js/board_start.js` 與 `git diff --check` 通過。正式 8787 實際開啟時首頁只顯示帳號卡、兩個主選單與我的航海紀錄；本機測試預設頭像按鈕數為 0，開啟玩家資料後才建立 50 個。建立／加入按鈕仍進入原建房／房號加入頁。桌機實際截圖正常；390×844 檢查文件 `scrollWidth === clientWidth`，選單與紀錄均在頁面內，好友面板不再遮住標題，console error 為 0。

## 修改紀錄：個人分流直接讀取所選紀錄 V385（2026-08-31）

- 問題：開始頁按「個別遊玩」後會立即換到 `board_game.html`，但開始頁的 Socket 仍短暫佔用同一 campaign 席位；新頁連線因此可能被誤判為 `campaign_already_connected`。前端遇到加入失敗又沿用普通房的後備流程開啟 `setup-order`，造成已有進度的玩家看見「開始出航」。
- 修正：`BOARD_CAMPAIGN_OPEN` 的個人房連線會標記為一次性換頁席位；只有相同 user id、相同 client id 的新遊戲頁可接手，接手後標記立即消失。正常遊戲中的第二條連線與集合局重複登入仍會拒絕，不放寬中途加入規則。
- 讀檔保護：帶有 `campaign` query 的遊戲頁在收到 server 快照前不再渲染／播出新航海設定，也禁止以本機空白狀態 seed 房間；畫面改顯示「正在讀取個人航海紀錄」。加入或讀檔失敗時只顯示返回開始頁，不建立新局，避免覆蓋所選分流。
- 檔案：修改 `server/index.js`、`public/js/board_game.js`、`public/board_game.html`、`public/board_campaign_2p2cpu_qa.html`，並同步四份專案文件。主頁 query 更新為 `20260831-campaign-direct-load-v385`。
- 驗證：`server/index.js`、`public/js/board_game.js` 與 QA 內嵌 JS 均通過 `node --check`。全新 `npm start` 於 `127.0.0.1:8788` 執行 4／4 輪 2 真人＋2 CPU 協定 QA；每名玩家皆以開始頁 socket 建立個人房，再由另一條相同裝置 socket 接手，兩份快照均直接保持 `phase: turn`，代理 CPU 捨棄、個人紀錄、集合合併、重複登入阻擋與刷新續接皆通過。正式 8787 換成新版後再跑 4／4 輪同測試，console error／warn 為 0；另以不存在的 campaign 實測失敗頁只顯示讀檔保護訊息與返回按鈕，沒有「開始出航」。兩批共 8 份 `QA玩家*` campaign 均在驗證成員後精確清除，正式 `伊多` 紀錄保持唯一一份。

## 修改紀錄：二周目共有航海紀錄／個人分流重新集合 V384（2026-08-30）

- 需求：原房成員解鎖二周目後要能從同一張共有紀錄各自遊玩；其他原真人在個人局中由代理 CPU 操作，代理取得的角色、位置、道具與培養成果不寫回本人。大家要重新一起玩時，必須各自先存檔／離場，進同一集合等待室並全部準備；集合局採發起者分流的回合、當前狀態與原生 CPU，真人席位則換成每人自己的最新個人紀錄。
- 儲存：新增 `server/data/board_campaigns/<campaignId>.json` schema 1。首次由已解鎖二周目的正常房手動存檔建立成員名單、每人個人紀錄及每人分流；之後每次只更新存檔者自己的 `memberRecords`／`branchRecords`。二周目、最終之島、研究所、蛋頭島與結局等房間共同解鎖採單向合併，不會被較舊分流關回去。campaign id 由原 room code 加房間建立時間產生，避免 server 重啟後新房號碰撞舊紀錄。
- 開局／同步：開始頁新增「共有航海紀錄」卡，可開個人分流或集合等待室。個人局只讓本人為真人，其餘原真人是 `isProxyCPU`；原生 CPU 保留。集合等待室名單固定，不能增減 CPU，只有紀錄成員可加入；全部已進入的真人準備後由房主開始。開局後禁止新成員與同帳號重複連入，只有起始真人在 30 秒 grace 內可刷新續接；逾時或明確離開後改回代理 CPU。本功能沿用完整 `BOARD_GAME_STATE`，只在存檔外層新增 `campaignContext`，沒有改既有角色／道具／地圖 id。
- Windows 安全寫入：同一 campaign 的寫入以 server promise queue 串行化；若 Windows／OneDrive／防毒暫鎖既有 JSON 而使 rename 回報 `EPERM`／`EACCES`／`EEXIST`，改用同一 queue 內的覆寫備援並清除暫存檔，避免兩名玩家同時存檔偶發失敗。
- UI：開始頁桌機、平板與手機沿用海賊桌遊風格；窄版切換 view 時會回到頁首，並在好友列下方保留安全間距，避免遮住共有紀錄標題與按鈕。主頁 JS query 為 `20260830-shared-campaign-v384`；開始頁共用／頁面 query 為 `20260830-shared-campaign-v4`／`v6`。
- 檔案：修改 `server/index.js`、`public/js/board_shared.js`、`public/js/board_start.js`、`public/js/board_game.js`、`public/board_start.html`、`public/board_game.html`；新增可重跑的 `public/board_campaign_2p2cpu_qa.html`，並同步四份專案文件。
- 驗證：四份正式 JS 均通過 `node --check`，`git diff --check` 通過；全新 `npm start` 於 `127.0.0.1:8787` 啟動（本機未設 `DATABASE_URL`，不影響 Board／Socket.IO）。QA 首批 4／4 通過後，第二批抓到一次 Windows `rename EPERM`；加入安全覆寫後重啟，再連續執行兩批共 8／8 輪通過。每輪均建立 2 真人＋2 原生 CPU，驗證兩個同時個人房、雙方並行存檔、代理進度捨棄、各自位置／船員帶回、發起者回合與原生 CPU 帶入、共享解鎖合併、固定名單、非成員／重複中途加入阻擋及 30 秒內續接。開始頁另以預設桌機、768×1024、390×844 檢查，手機版好友列與共有紀錄的實際 bounding rect 已無重疊。QA 產生的 14 份測試 campaign（含失敗暫存）確認成員皆為 `QA玩家*` 後已清除，正式目錄目前沒有殘留測試紀錄。

## 修改紀錄：圖鑑出沒區域簡化標示 V383（2026-08-29）

- 需求：區域名稱不要重複列出同一字母的航線本體。`B東` 本身即代表 B航線與東側海格；同一字母若西、東兩側都有，直接顯示「B航線區域」。
- 顯示規則：單側存在時以該側吸收航線本體，例如 A航線＋A東顯示為「A東」、F西＋F航線顯示為「F西」；西、東同時存在時不論是否另有航線本體，一律合併為「F航線區域」。只有航線本體時仍顯示「F航線」，南北四皇航線與二周目限定前綴不變。
- 邊界／快取：只壓縮 `spawnRegionLabel` 的圖鑑文字，`spawnRegionIds`、正式 21 區配置、島嶼／海格抽選、等級追趕、存檔與多人同步均未改。主頁 JS query 更新為 `20260829-codex-region-labels-v383`。
- 檔案：修改 `public/js/board_game.js`、`public/board_game.html`、`scripts/codex_encounter_unlock_qa.js`，並同步更新四份專案文件。
- 驗證：兩份 JS 通過 `node --check`；全新 `npm start` 服務於 `127.0.0.1:8793`。桌機／平板圖鑑 QA 確認巴其為「A東／B西」、摩利亞的 F西＋F東合併為「F航線區域」、二周目三名限定角色標示不變、無 overflow；雙真人 Socket.IO 房 `B9727` 同步通過，最終 `ok=true`、`errors=[]`、`failures=[]`。報告與截圖位於 `.codex/qa/codex_region_labels_v383/`。

## 修改紀錄：圖鑑顯示正式出沒區域 V382（2026-08-29）

- 問題：V381 已讓敵人島與海格依 21 區正式生成，但全圖鑑仍由 `lineageCodexProfileSource()` 顯示舊泛稱「敵人島／海格航路」，玩家無法從圖鑑查到 A航線、B西、北／南四皇航線等定向刷怪位置。
- 實作：`lineageCodexCatalog()` 現在以角色的正式 enemy key 反查 `BoardEnemySpawnRegions.assignments`，依設計器相同順序產生 `spawnRegionIds` 與 `spawnRegionLabel`。一般角色列出所有實際候選區；伊姆、麒麟格姆、索瑪茲分別顯示「二周目限定：北四皇航線／G西／南四皇航線」。沒有區域配置的競技場或固定劇情角色仍回退原本地點文字。
- UI／相容：圖鑑左側角色列改顯示區域摘要，詳情右下標題改為「出沒區域」並保留最後遇見位置；未遇見角色仍維持 `????`。沒有新增存檔欄位、localStorage key、Socket.IO event 或改動生成規則，主頁 JS query 更新為 `20260829-codex-spawn-regions-v382`。
- 檔案：修改 `public/js/board_game.js`、`public/board_game.html`、`scripts/codex_encounter_unlock_qa.js`、`scripts/regional_enemy_spawn_qa.js`，並同步更新四份專案文件。區域 QA 的多人等待條件改成收到相同島嶼／enemy key／等級／區域／周目標記才繼續，避免只看版本號時過早取樣客端初始隨機敵人。
- 驗證：三份 JS 均通過 `node --check`；全新 `npm start` 服務於 `127.0.0.1:8792`。圖鑑專項在 1600×900 與 1024×768 實際打開圖鑑，確認巴其為「A航線／A東／B西」、三名二周目限定角色位置正確、角色列與詳情均顯示正式區域、無 overflow；雙真人 Socket.IO 房 `B2347` 的遇見解鎖完整快照同步亦通過。結果 `ok=true`、`errors=[]`、`failures=[]`，報告與截圖位於 `.codex/qa/codex_spawn_regions_v382/`。另跑完整區域生成／最低等級／主線隔離回歸，雙真人房 `B9840` 同步通過，報告位於 `.codex/qa/regional_enemy_spawns_v382_regression/`。

## 修改紀錄：航線限定敵人生成／最低等級追趕 V381（2026-08-29）

- 需求：把 V380 使用者確認的 21 區／30 名敵人配置接進正式遊戲；一般敵人實際進戰鬥時若等級過低，要提升到目前船隊最高等級減 5。
- 實作：新增 `public/js/board_enemy_spawn_regions.js` 作為設計器與正式主遊戲共用唯一預設。敵人島依 7×7 島號判定北／南四皇航線或 A～G 航線三種覆蓋；海格依實際 route 端點判定，橫向 B～C 海格屬 B航線／B東／C西／C航線，縱向海格屬該欄的西／完整／東三區，顛倒山五條入口歸 A航線。現有未擊敗敵人島載入時會升級為新版區域配置，刷新敵人與海格遭遇沿用同表。
- 周目：一周目固定排除伊姆、麒麟格姆、索瑪茲；`game.postgameWorld.unlocked === true` 後分別只加入北四皇航線、G西、南四皇航線。這三人的隨機出沒帶有 `isRegionalSpawnEncounter`，不會誤觸伊姆最終戰／艾爾巴夫神之騎士劇情；一般遭遇版 Domi Reversi 會改為攻擊／特攻各降一階，避免只有最終戰專屬欄位而無一般效果。
- 等級：`regionalEncounterMinimumLevel()` 取整船隊最高角色等級－5，限制在 Lv.1～99。一般敵人島在新的正式 `startBattle()` 入口才往上補並保留當前 HP 比例；海格敵人在產生本次遭遇時套用同一下限。高於下限的敵人不降等，固定 Boss、四皇、副本、二周目 13 Boss、切磋與同一筆 `pendingBattle` 續戰都不受影響。
- 同步／相容：沒有新增頂層 `gameState` 欄位、localStorage key 或 Socket.IO event；區域、預設版本、周目模式與最低等級標記只存在既有 `enemyProfile`／battle snapshot，繼續由完整 `BOARD_GAME_STATE` 廣播。主頁 query 為 `20260829-regional-enemy-spawns-v381`，battle iframe／battle JS 分別為 `v123`／`v359`。
- 檔案：新增 `public/js/board_enemy_spawn_regions.js`、`scripts/regional_enemy_spawn_qa.js`；修改兩個正式戰鬥 HTML、`public/js/board_game.js`、`public/js/board_battle.js`、設計器 HTML／JS，並同步四份專案文件。
- 驗證：四支正式 JS 與 QA 均通過 `node --check`，並另開全新 `npm start` 服務於 `127.0.0.1:8791` 驗證正式頁。Chrome 專項 QA 驗證 21 區／30 名共用表、A～G／橫縱／南北／顛倒山映射、全部現役敵人島均只取區內敵人、一／二周目三名限定敵人、伊姆／神之騎士主線隔離、海格 Lv.55 下限，以及真正呼叫 `startBattle()` 時 Lv.7→Lv.55；兩個獨立真人瀏覽器建立 Socket.IO 房 `B8547`，房主把 Lv.10 敵人依 Lv.80 船隊提升到 Lv.75 後，客端收到相同 key、等級、區域與周目標記。最終 `ok=true`、`failures=[]`、`browserErrors=[]`，設計器 1440px 無 overflow；報告與截圖位於 `.codex/qa/regional_enemy_spawns_v381_fresh/`。另跑 `scripts/codex_encounter_unlock_qa.js`，桌機／平板遇見解鎖及雙真人房 `B8749` 完整快照同步均通過。

## 修改紀錄：敵人出沒建議預設 V380（2026-08-29）

- 需求：不要讓敵人出沒設計器維持空白，先由 Codex 依目前地圖與角色安排填一版可直接修改的預設。
- 實作：21 個區域依 A→G 由弱至強、原作勢力／故地與相鄰航線過渡填入建議名單，並加入逐區設計備註。30 名候選都有至少一個預設區域；伊姆在北四皇航線、麒麟格姆在 G西、索瑪茲在南四皇航線，仍標為二周目限定。設計器新增「恢復建議預設」與「全部清空」，草稿 key 升為專用 V3；已有內容的 V2 草稿會保留，空白 V2 草稿則載入建議預設。
- 邊界：仍只修改獨立設計工具與文件，沒有改主遊戲敵人抽選、地圖、存檔、`BOARD_GAME_STATE` 或 Socket.IO event。正式接入仍等待使用者完成 JSON。
- 驗證：`node --check public/js/board_enemy_spawn_designer.js` 通過；預設共 21／21 區、30／30 名候選都有配置，引用 key 全數存在且無區域內重複。正式工具頁載入後摘要顯示 21 區／30 名，A→G 平均敵人階級單調上升；桌機與手機版無水平 overflow，console error／warn 為 0。

## 修改紀錄：二周目伊姆／神之騎士團出沒設計 V379（2026-08-29）

- 需求：伊姆與神之騎士團在二周目開放後也能依指定航線遇見；一周目不能混入。
- 實作：目錄產生器除了 `ENEMY_POOLS`，另解析正式 `FINAL_GATE_ENEMY_PROFILE` 與 `ELBAPH_GOD_KNIGHT_PROFILES`。設計器新增伊姆、麒麟格姆、索瑪茲三名 S 級候選與「二周目」標籤，並新增一般／二周目限定篩選。JSON 會輸出 `availability: second_playthrough`、來源群組及 `game.postgameWorld.unlocked === true` 條件。
- 邊界：只修改獨立設計工具、產生目錄與文件；主遊戲 `pickSeaEncounterEnemy()`、敵人島生成、存檔與多人同步尚未改動。三名角色要等使用者完成區域 JSON 後才接進指定航線，其他固定 Boss 不加入一般隨機候選。
- 驗證：`node scripts/build_enemy_spawn_designer_catalog.js` 成功輸出 30 名，27 名一般、3 名二周目限定且 key 無重複；新增 JS 通過 `node --check`，正式工具頁 HTTP 200。S 級＋二周目篩選只顯示三名，敵人卡均顯示二周目標籤；輸出 JSON 保留三人的解鎖條件。桌機與窄版無水平 overflow，console error／warn 為 0。

## 修改紀錄：敵人出沒區域設計器 V378（2026-08-29）

- 需求：依目前 7×7 地圖規劃角色固定出沒區域；一般範圍先看第 2～6 排。完整字母航線包含航線本身與左右兩側海格，字母西／東只含指定側；第 1 排及 1～2 排間海格改稱北四皇航線，第 7 排及 6～7 排間海格改稱南四皇航線。使用者要先在獨立網頁配置，再把輸出的設定交給 Codex 接進主遊戲。
- 實作：新增 `public/board_enemy_spawn_designer.html`、`public/css/board_enemy_spawn_designer.css`、`public/js/board_enemy_spawn_designer.js`。頁面提供可高亮範圍的 7×7 航線示意圖、21 個區域、敵人肖像卡、名稱／ID 搜尋、階級篩選、區域備註、草稿自動保存、JSON 匯入／下載與「複製給 Codex」。輸出包含 schema、區域語意、正式 enemy key、區域反查、未配置敵人與目錄 hash。
- 資料：新增 `scripts/build_enemy_spawn_designer_catalog.js`，以括號／字串安全解析正式 `public/js/board_game.js::ENEMY_POOLS`，產生 `public/js/board_enemy_spawn_designer_catalog.js`；本次解析 27 名一般敵人。四皇、劇情 Boss、推進城與固定戰役敵人不列入一般隨機池。
- 邊界：未修改 `public/js/board_game.js`、地圖資料、敵人生成、圖鑑顯示、存檔、`BOARD_GAME_STATE`、localStorage 既有 key 或 Socket.IO event。新草稿 key 只屬獨立設計頁；正式主遊戲仍沿用 V377 前的距離／階級抽選，等待使用者交回 JSON 後另行接入。
- 驗證：`node scripts/build_enemy_spawn_designer_catalog.js` 成功輸出 27 名且無重複 key；兩支新增 JS 通過 `node --check`。正式 `npm start` 於 port 8787 啟動，設計頁 HTTP 200。實際配置 B航線 2 名、B西 1 名、北四皇航線 1 名，跨區切換與備註均保留；搜尋＋階級篩選、複製與下載按鈕正常，複製出的 JSON 可解析為 schema 1、21 區、27 名敵人。1280×720、932×430、390×844 均無水平 overflow；頁面 console error／warn 為 0。本機未設定 `DATABASE_URL`，不影響靜態工具頁驗證。

## 修改紀錄：全圖鑑遇見即解鎖 V377（2026-08-29）

- 需求：全圖鑑只要實際遇見角色就要開啟，不再要求玩家同時持有並擊敗角色。
- 修正：`lineageCodexCatalog()` 的 `revealed` 改以既有 `encounterCount > 0` 為唯一解鎖條件；船團資訊的全圖鑑摘要改顯示已遇見種類，圖鑑說明同步更新。一般戰鬥建立時仍沿用既有 `recordEncounteredEnemy()`；玩家主動加入共鬥或同島待續戰鬥自動合併時，新增該參戰者各自的遭遇紀錄，避免只有發起者解鎖。
- 相容性：沒有新增或改名 `gameState` 欄位、角色／敵人 id、localStorage key 或 Socket.IO event；仍使用 `player.defeatedEnemies` 的既有 `encounterCount`、時間與地點欄位，由完整 `BOARD_GAME_STATE` 同步。舊存檔原本已有遇見但未擊敗／未持有的紀錄，開啟圖鑑時會直接依新規則揭露。
- 檔案：修改 `public/js/board_game.js`、`public/board_game.html`、`scripts/draft_codex_privacy_qa.js`，新增 `scripts/codex_encounter_unlock_qa.js`，同步 `docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。主頁 query 為 `20260829-codex-encounter-unlock-v377`。
- 驗證：`node --check` 通過主程式與兩支圖鑑 QA。專項 Chrome QA 在 1600×900、1024×768 驗證未遇見維持鎖定、第一次遇見在未持有且零擊敗時立即揭露、同一戰鬥重複正規化不重複計數、另一名參戰玩家獨立解鎖、新戰鬥再次遇見才累加至 2；清單／詳情正式圖與階級圖均載入，文字明確為「遇見・未討伐」，兩種 viewport 無文件 overflow。另以兩個獨立瀏覽器身分建立正式 Socket.IO 房 `B4390`，房主推送同場兩名玩家的遭遇紀錄後，客戶端在 `BOARD_GAME_STATE` version 2 同時看到房主與自身圖鑑解鎖。正式 `PORT=8841 npm start`、主頁 HTTP 200 與 V377 query 通過；整體 `ok=true`、`errors=[]`、`failures=[]`，證據位於 `.codex/qa/codex_encounter_unlock_v377/`。

## 修改紀錄：2 真人＋2 CPU 全周目驗證與攻略書 V376（2026-08-29）

- 範圍：新增 `scripts/full_campaign_2p2cpu_qa.js`，以兩個獨立真人瀏覽器身分建立正式 Socket.IO 房間，再加入 CPU1、CPU2；完整驗證 A→B→CPU1→CPU2 交棒、四皇、伊姆、最終之島結局、二周目 13 名 Boss、洛基試煉、約克 13／13 解碼與洛克斯終戰。戰鬥只在確認正式進場、同步、HP、招式與機制資料後，以敵方 HP 歸零加速勝利，不跳過正式 `battleFinish()`、獎勵揭示、血統抽取決定、島嶼重建與多人快照。
- QA 防誤判：`scripts/lan_refresh_flow_qa.js` 改為等待真正顯示中的 lobby；`scripts/battle_entry_recovery_qa.js` 會等開場被動演出結束後才判定可操作；`scripts/spar_formal_battle_qa.js` 增加第二輪逾時診斷。完整長跑的截圖工具會等待雙頁快照套用完成，並固定 battle iframe 取景，避免測試器因連續瞬間切換 Boss 而把上一場退場遮罩誤認為遊戲卡死。
- 攻略產物：新增 `scripts/annotate_guide_screenshots.py` 與 `scripts/build_one_piece_board_guide.py`，把 29 張實測畫面加上黃色編號與重點說明，並產生 `artifacts/one_piece_board_complete_guide_v1/航海王大富翁_一周目二周目全Boss超詳細攻略_V1.docx`。內容含完整流程、20 場主線／二周目關鍵戰（四皇、伊姆、13 Boss、洛基、洛克斯）、多人／共鬥／推進城／PK、208 件道具的取得方式與商店價格、巴雷特武器庫 4,371 種不同雙裝組合排行，以及卡住時的恢復判讀。
- 相容性：本輪沒有改動正式角色、Boss、道具、掉落、地圖、戰鬥、`BOARD_GAME_STATE`、localStorage key 或 Socket.IO event；只新增／修正 QA 與文件產生工具。`docs/GAME_RULES.md` 規則內容不需變更。
- 驗證：正式 `npm start` 服務可開啟；完整 2 真人＋2 CPU 長跑輸出 29 張關鍵畫面，完成一周目 5 場關鍵 Boss、二周目 13 Boss＋洛基＋洛克斯、13／13 約克線索與最終雙端同步。專項回歸通過 `refresh_resume_qa.js`、`lan_refresh_flow_qa.js`、`battle_entry_recovery_qa.js`、`spar_formal_battle_qa.js`、`postgame_boss_fresh_hp_qa.js`、`postgame_boss_mechanics_qa.js`、`cpu_post_coop_island_choice_qa.js`、`tot_musica_player_world_coop_qa.js`、`tot_musica_full_dual_qa.js`、`battle_critical_system_qa.js`（45／45）、`bullet_arsenal_full_compatibility_qa.js`（95 件、94 件可用、4,371 組）、`coop_deferred_result_turn_qa.js`。未發現新的正式流程卡死；曾出現的 reload／遮罩問題來自加速器在同步套用中立刻切下一戰，已在 QA 等待條件中隔離，且不修改正式規則。

## 修改紀錄：四人實玩交棒／刷新完整接回 V375（2026-08-28）

- 問題：多人正式房的 server lobby 不保存裝置專屬 `isMe`；非房主刷新時，舊 `storedLobbyProfile()` 因而退回房主資料，造成自己的船不能操作、CPU 控制權誤顯示。擲骰動畫開始時只同步了演出、尚未寫入 `pendingMove`，刷新可回到擲骰前重骰；海域二選一刷新後也會把本人當旁觀者，只留下「關閉觀看」。目前玩家的待續戰鬥又可能在 `boardLan.applying` 尚未解除時建立，首次戰鬥快照被擋下後不再補送，其他玩家看不到續戰畫面。開局招募則會在 clone 後的等級同步把最大 HP 校正 +1，形成 66/67 等非滿血狀態。
- 修正：`public/js/board_shared.js` 先以本機已保存的 `userId`／`clientId` 比對 server lobby，再以房主作最後後備；不改任何 storage key。地圖骰在動畫前就把最終步數寫入既有 `pendingMove`，附帶短期動畫結束時間，刷新後由原控制玩家等待同一顆骰演出時間到達再接著移動，不會重骰。海域選牌事件會依同步事件中的原兩張 `slotId`／`typeId` 為本人重建可操作介面；旁觀者仍只觀看。自動續戰與 pending movement 都等 `boardLan.applying` 解除後才啟動，確保新的 battle snapshot 會廣播給全房；相同同步版本的外部延遲重複快照會忽略，避免行動者剛開啟的續戰被舊畫面蓋掉，但 `turn-banner` 播完後的內部延後套用會明確放行，確保房主、客戶端與 CPU 真正切到下一位。戰鬥收尾時由主頁深海底色立即遮住正在關閉的 iframe 並標成隱藏，避免重整交棒邊界短暫露出空角色 HP 佔位。真人／CPU 選角統一先完成角色進度同步，再以校正後最大 HP 建立滿血新船員。
- 相容性：`diceAnimationEndsAt` 只放在既有 `pendingMove` 物件且結束演出／接回移動時立即刪除；戰鬥收尾遮罩只在既有 overlay 的 `closing` 狀態生效。沒有新增頂層 `gameState` 欄位、localStorage key 或 Socket.IO event。角色、Boss、道具、地圖與戰鬥規則未改，13 Boss 全新挑戰滿血／同一 `pendingBattle` 殘血續戰規則維持。主頁 query 更新為 `20260828-lan-refresh-flow-v375`，大廳／主頁共用身分 query 為 `20260828-lan-refresh-identity-v3`。
- 檔案：修改 `public/js/board_shared.js`、`public/js/board_game.js`、`public/board_game.html`、`public/board_start.html`，新增 `scripts/lan_refresh_flow_qa.js`，並同步 `docs/DEV_WORKFLOW.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`。
- 驗證：`node --check` 通過正式 JS 與 QA。正式 server 於 port 8840 以 `npm start` 成功啟動；本機未設定 `DATABASE_URL`，不影響 Board 靜態與 Socket.IO 測試。實際建立「2 真人＋2 CPU」房，完成 12 次選角並實玩四輪以上，覆蓋 CPU／真人航行、顛倒山分岔、海域二選一、寶箱、醫院、酒館、一般敵人島、持續戰鬥、戰鬥換人與雙頁旁觀。實玩先抓到相同版本保護誤擋 `turn-banner` 內部延後套用，導致一頁已到 CPU、另一頁仍停在上一位的卡點；修正後跨多次真人／CPU 交棒保持一致。非房主擲骰中刷新保留同一結果並落到敵人島；送出招式後刷新可接回傷害與 HP；房主在 CPU 戰鬥中刷新後 CPU 仍完成行動並交棒，兩頁 `console error=[]`。`scripts/lan_refresh_flow_qa.js` 增加同版本 `turn-banner` 延後套用回歸後連續三次通過，真實 Socket.IO 雙頁亦驗證身分、12 名滿血招募與雙頁續戰；桌機 1280×720、手機橫向 844×390 都確認戰鬥收尾遮罩為可見深海底色且 V375 query 生效。`scripts/refresh_resume_qa.js`、`scripts/postgame_boss_fresh_hp_qa.js` 亦通過，後者 13／13 Boss 均為新挑戰 100% HP、同場續戰 41% HP。

## 修改紀錄：戰鬥刷新不中斷結算 V370（2026-08-28）

- 問題：玩家與敵人的行動已鎖定、骰子／攻擊動畫正在播放時，完整快照可能正好保存「已有雙方指令但尚未完成結算」的中間狀態；刷新會清掉瀏覽器中的非同步動畫工作，載回後卻又因雙方指令已存在而無法重新選招，形成偶發卡住，再刷一次才可能碰到可恢復的快照。
- 修正：`public/js/board_game.js` 在一般戰鬥／共鬥／切磋開始結算前，把本輪未執行的乾淨戰鬥與相關玩家狀態寫入同分頁 `sessionStorage` 暫存點；刷新載入同一場、同一輪、同一組行動時先還原該暫存點，再只由具控制權的玩家重新跑一次結算。正常結算、開新輪與離開戰鬥都會清除暫存；沒有新版暫存的舊快照仍會接回既有排隊行動。旁觀者只顯示快照，不會代替出戰玩家執行。
- 相容性：暫存點只存在本機分頁、最長保留 10 分鐘，不加入 `gameState`、手動／雲端存檔或 `BOARD_GAME_STATE` payload schema；未更動角色／道具／招式 id、localStorage key、Socket.IO event、傷害規則、共鬥交棒與 PK 的 `A→B→C→D` 地圖回合順序。主頁 query 更新為 `20260828-battle-refresh-recovery-v370`。
- 驗證：`node --check public/js/board_game.js`、`node --check scripts/battle_refresh_recovery_qa.js` 通過；`PORT=8838 npm start` 成功且正式頁／V370 腳本 HTTP 200。`scripts/battle_refresh_recovery_qa.js` 五種情境全部通過：雙方鎖招後立即刷新、攻擊動畫中刷新、沒有新版暫存的舊快照、非控制者旁觀、切磋 PK 刷新；均只接回一次、離開動畫鎖、到達可操作／可結算／正常交棒狀態並清除暫存，旁觀者沒有取得控制權。既有 `scripts/refresh_resume_qa.js`、`scripts/battle_entry_recovery_qa.js`、`scripts/spar_formal_battle_qa.js` 亦通過。13 Boss 行為回歸沒有新增規則 failure，但完整素材檢查仍因既有 Tot Musica／歐斯狀態圖與 KING 面板底圖缺檔而回報 3 組素材 failure，與本次刷新修正無關。

## 修改紀錄：招式徽章精準置中／移除徽章文字 V369（2026-08-28）

- 需求：右側招式卡的類別圖標要位於原圓形徽章正中心，徽章內／下方不再顯示「物攻／特攻／強化」等文字；中央新招式詳情仍依 V368 只顯示類型文字。
- 修正：`.move-learn-current-badge` 改為單一 CSS Grid 並使用 `place-items:center`，移除徽章 `<small>` 類型文字節點；圖標維持 V368 的 60% 高度／66% 最大寬安全尺寸。主頁 query 更新為 `20260828-move-type-icons-centered-v369`。
- 邊界：只改招式學習 modal 的徽章排版與文字；正式圖標、類型映射、招式資料、傷害規則、存檔與多人同步均未改變。
- 驗證：`PORT=8807 npm start` 成功啟動，頁面／腳本 HTTP 200。`scripts/move_learn_type_icons_qa.js` 在 1600×900、1024×768、932×430 全部通過：徽章文字數為 0、圖標全部位於框內，桌機中心最大偏差 0.0078125px、平板 0px、手機橫向 0.0078125px，中央詳情仍為純文字類型，modal 與文字無 overflow；截圖位於 `.codex/qa/move_learn_type_icons_v369/`。本機未設定 `DATABASE_URL`，不影響靜態 Board UI 驗證，完成後已停止測試程序。

## 修改紀錄：招式圖標框內限制／詳情文字化 V368（2026-08-28）

- 問題：V367 新圖標的有效圖形比舊版大，右側招式卡中的短刀、斬光等會碰到甚至超過既有圓形徽章框；中央新招式詳情同時顯示類型圖標與「物攻／特攻」文字，資訊重複。
- 修正：右側 `.move-learn-current-badge img` 從高度 84%／最大寬 92% 收到高度 60%／最大寬 66%，仍以 `object-fit:contain` 等比顯示；中央 `.move-learn-new-type-value` 移除 `<img>`，只保留類型文字。主頁 `board_game.js` query 更新為 `20260828-move-type-icons-contained-v368`。
- 邊界：只調整招式學習 modal 的圖標尺寸與中央類型呈現；正式 8 張 WebP、招式類別映射、招式資料、傷害規則、存檔與多人同步均未改變。
- 驗證：`PORT=8806 npm start` 成功啟動，正式頁與腳本皆 HTTP 200。更新後的 `scripts/move_learn_type_icons_qa.js` 在 1600×900、1024×768、932×430 全部通過：每張圖標都位於徽章框及招式卡矩形內，中央類型圖標數為 0 且文字存在，modal／文字皆無 overflow；截圖位於 `.codex/qa/move_learn_type_icons_v368/`。本機未設定 `DATABASE_URL`，不影響本次靜態 Board UI 驗證，完成後已停止測試程序。

## 修改紀錄：全套招式類別圖標正式接入 V367（2026-08-28）

- 輸入核對：使用者放入的 `*_game_style_source_v2-Photoroom.webp` 共 8 張，名稱依序對應物攻、特攻、強化、弱化、治療、護盾、控制與狀態；每張皆為 1254×1254 四通道 WebP，Alpha 同時包含 0／部分透明／255，不是黑底假去背。
- 正式素材：以 Lanczos3 縮放為既有規格 256×256，WebP quality 92、alphaQuality 100，正式覆蓋 `physical_attack.webp`、`special_attack.webp`、`buff.webp`、`debuff.webp`、`heal.webp`、`shield.webp`、`control.webp`、`status.webp`。舊版 8 張先保存於 `incoming/formal_v2_no_frame_before_v367/`，使用者的 1254×1254 去背來源保留不動。
- 接線／快取：既有類別檔名與 `moveLearnTypeView()` 對應不變，只將 `MOVE_LEARN_TYPE_ICON_VERSION` 更新為 `20260828-v3-game-style`，道具戰鬥類後備物攻圖也使用相同 query；主頁 `board_game.js` query 更新為 `20260828-move-type-icons-v367`。未改招式 id、分類、傷害規則、存檔或多人同步。
- 驗證：`PORT=8805 npm start` 成功啟動，正式頁與 8 張圖標皆 HTTP 200。`scripts/move_learn_type_icons_qa.js` 在 1600×900、1024×768、932×430 三種畫面全部通過：類別映射正確、自然尺寸皆為 256×256、圖標不超出招式卡、modal 不超出 viewport、文字無 overflow，且沒有 console／HTTP 錯誤；截圖位於 `.codex/qa/move_learn_type_icons_v367/`。本機未設定 `DATABASE_URL`，不影響本次靜態 Board UI 驗證，完成後已停止測試程序。

## 修改紀錄：全套招式類別圖標遊戲風格原稿 V366（2026-08-28）

- 需求更正：V365 的拳頭物攻與圓球特攻不採用；原本 8 種招式類別圖標都要重新製作，而且整套必須符合正式招式學習面板的畫風。
- 風格：以 `move_learn_panel_frame.webp` 作為唯一畫風參考，統一使用深海藍、黑鐵、古金細邊、雕刻航海工藝及克制的類別色光；8 張皆為粗輪廓、置中、可在 48×48 辨識的單一圖形，不使用拼圖。
- 圖形：物攻為交叉海賊短刀、特攻為青紫霸氣斬光、強化為旗幟上升箭頭、弱化為鎖鏈破裂下降箭頭、治療為綠心十字與水滴、防護為海浪圓盾、控制為手銬、狀態為航海羅盤星。
- 保存：8 張 ImageGen 獨立 PNG 皆為 1254×1254 RGB 白底，存於 `public/images/board/move_learn_ui/move_type_icons/incoming/*_game_style_source_v2.png`；完整提示詞與逐檔 SHA-256 位於 `MOVE_TYPE_ICON_GAME_STYLE_V2_PROMPTS.md`。
- 邊界：此階段尚未去背或覆蓋正式素材；使用者後續提供的去背 WebP 已於 V367 正式接入。

## 修改紀錄：物攻／特攻簡化圖標原稿 V365（2026-08-27）

- 需求：重做「物攻」與「特攻」兩張招式類別圖標，降低原本雙刀爆光與銀河漩渦的複雜度；圖標要一眼可辨識，背景由使用者後續自行去除。
- 生成：使用內建 ImageGen 分別生成兩張獨立 PNG。物攻改為單一深色拳頭與三條紅橘撞擊線；特攻改為單一藍紫能量球、中央四角星與短閃電。兩張都沒有文字、人物、外框或場景，使用純白背景。
- 保存：原稿非破壞性存於 `public/images/board/move_learn_ui/move_type_icons/incoming/physical_attack_redesign_source_v1.png` 與 `special_attack_redesign_source_v1.png`。SHA-256 分別為 `4DBE5C544DE19E622301D69E75296491E8C468A9070A257EE747B66F7ABDAACC`、`C3083DA9F544546170B0F4F21C600F4BF8EEC9F89E4FF4394B0D568CF8088919`。
- 邊界：依使用者要求未去背，也未覆蓋正式 `physical_attack.webp`／`special_attack.webp`；此兩張 V1 原稿之後已被使用者否決，正式候選以 V366 全套 V2 為準。

## 修改紀錄：進化框內視窗／防止角色溢出 V364（2026-08-27）

- 問題：V363 恢復原動畫的 1.01～1.06 倍角色脈衝縮放後，閃爍過程中的角色矩形邊角仍可能短暫超出裝飾框。
- 修正：在進化前／後角色圖外增加固定的 `.evolution-character-window`；視窗與 `evolution_portrait_frame_v1.webp` 共用完全相同的響應式寬高與置中座標，並依框內緣使用 `clip-path: inset(8.5% 6.8% 9.5% 6.8%)` 及 `overflow:hidden`。原角色和進化後角色的縮放只在這個視窗內播放，不會露出框外。
- 演出維持：沒有改寫原本的 8.2 秒關鍵影格；材料仍貼近角色，原角色先彩色／黑白閃爍，進化後角色再彩色／黑白閃爍，最後彩色定格。正式頁仍只使用一張共用框。
- 邊界／快取：只修改共用進化 HUD 的裁切容器與尺寸；未改四類進化規則、材料扣除、角色／招式資料、存檔、同步事件或戰鬥 iframe。主頁 query 更新為 `20260827-evolution-frame-fit-v364`。
- 驗證：`scripts/zorojuro_enma_qa.js` 28 項全部通過；1600×900 實測角色視窗與框同為 322.5×430，844×390 同為 90×120，兩者矩形座標完全相同、`overflow:hidden` 與內緣裁切皆生效。原角色及進化後角色的黑白反相畫面、材料貼近與最終消失亦通過，證據位於 `.codex/qa/zorojuro_evolution_frame_v364/`。`PORT=8804 npm start` 成功啟動，正式頁與框素材皆 HTTP 200；頁面包含 V364 query、角色視窗與裁切規則，且不包含覺醒框引用。本機未設定 `DATABASE_URL`，不影響本次靜態 Board 頁驗證，完成後已停止測試程序。

## 修改紀錄：恢復原進化動畫／單純加框 V363（2026-08-27）

- 需求澄清：保留專案原本的 8.2 秒進化動畫，只在角色圖外加一張框；不要旋轉能量印、垂直光柱、菱形展開、兩階段框變身或完成後的材料徽章。
- 恢復流程：材料維持原定位，貼近角色下半部啟動；原角色依原關鍵影格連續黑白／彩色閃爍，接著切換進化後角色並再做相同黑白／彩色閃爍，最後恢復彩色定格。材料依原動畫在 68% 後縮小消失，不滑到右側。角色原本的 1.01～1.06 倍脈衝縮放與完整矩形畫面也一併恢復。
- 單一框：正式 HUD 只保留 `evolution_portrait_frame_v1.webp`，沿用 V359 的 `evolutionCharacterFrame` 動畫覆蓋進化前後角色；移除第二張覺醒框 DOM、兩套框切換 keyframes、stage 偽元素特效與角色菱形／內緣裁切。V361／V362 素材留存但正式頁不引用。
- 邊界／快取：只回復進化 HUD 顯示層，`flag`／`paper`／`prime`／`enma` 四類都使用同一套原動畫加框；未改進化條件、材料扣除、角色／招式資料、存檔、同步事件或戰鬥 iframe。主頁 query 更新為 `20260827-evolution-original-frame-only-v363`。
- 驗證：`scripts/zorojuro_enma_qa.js` 28 項全部通過，實測材料與角色中心水平距離約 0、垂直間距 0；原角色與進化後角色都捕捉到 `grayscale(1) invert(1)` 黑白反相畫面，最終材料 opacity 0、單一框 opacity 1、stage 偽元素 animation 均為 `none`。四類進化、1600×900 與 844×390 無 overflow；證據位於 `.codex/qa/zorojuro_evolution_frame_v363/`。`PORT=8803 npm start` 成功啟動，正式頁與共用框素材皆 HTTP 200；頁面包含 V363 query、單框動畫，不包含覺醒框、能量印或光柱引用。本機未設定 `DATABASE_URL`，不影響此次靜態 Board 頁驗證，完成後已停止測試程序。

## 修改紀錄：進化框克制版 V362（2026-08-27）

- 問題：V361 覺醒框把大部分金屬提高到白金亮度，外框光暈、青紫能量與徽飾同時達峰，完成畫面搶過角色主體，整體過度華麗。
- 素材：以 V361 覺醒框為修改目標、V359 沉睡框為材質與克制程度參考，透過內建 ImageGen 重製 `evolution_portrait_frame_awakened_v2.webp`。主體回到黑鐵與古金，只保留細金邊、頂部羅盤、小型側晶與少量青紫能量脈絡；移除整圈白熱、放射光環、外側碎晶與爆炸星芒。生成輸出未帶 Alpha，正式 WebP 精確套回原框遮罩，1086×1448 RGBA，Alpha 差異像素 0，SHA-256 `23A7207C342DC2A24E93A6672DE65349B53F97B201FD8B0C8A1A5692140F234A`。
- 演出：沉睡框退場與克制版覺醒框進場改為較長、較柔和的交叉淡入；白光陰影、主題光暈與亮度峰值同步降低，完成狀態只保留 18px 主題光與 `brightness(1.02)`，角色仍是畫面焦點。
- 邊界／快取：V361 素材保留但正式頁改讀 V362，不覆蓋舊框；未改進化條件、材料、角色資料、存檔、同步事件或戰鬥 iframe。主頁 query 更新為 `20260827-evolution-restrained-frame-v362`。
- 驗證：`scripts/zorojuro_enma_qa.js` 28 項全部通過，包含四類進化、沉睡／覺醒框交叉切換、角色對位、1600×900 與 844×390 無 overflow；最終與轉換截圖位於 `.codex/qa/zorojuro_evolution_frame_v362/`。`PORT=8802 npm start` 成功啟動，正式頁與 V2 覺醒框素材皆 HTTP 200，頁面包含 V362 query；本機未設定 `DATABASE_URL`，不影響此次靜態 Board 頁驗證，完成後已停止測試程序。

## 修改紀錄：進化框兩階段覺醒 V361（2026-08-27）

- 問題：V360 雖然已有能量印、光柱與新形態展開，但前後共用同一張框，框本身沒有任何型態差異，看起來仍只有角色完成進化。
- 兩階段框：演出前半段保留 `evolution_portrait_frame_v1.webp` 沉睡框；能量達峰時讓舊框白熱、退場，再由 `evolution_portrait_frame_awakened_v1.webp` 亮金覺醒框爆發進場並留在完成畫面。兩張框共用完全相同的 1086×1448 幾何與 Alpha 遮罩，覺醒框只提升金色裝甲、頂／底徽飾與青紫能量，不侵入中央角色區。
- 素材：覺醒框先由內建 ImageGen 依原框幾何製作；因生成來源未保留透明通道，正式 WebP 以原框 Alpha 遮罩精確還原透明中央與外圍，Alpha 差異像素為 0。正式素材 SHA-256 為 `922BA61818383C6A6908F933A3780FF6145D01C1FB7E9B0FF47D5FC9857779E4`，完整提示詞與來源紀錄位於 `docs/EVOLUTION_PORTRAIT_FRAME_IMAGEGEN_PROMPT.md`。
- 邊界／快取：只修改共用進化 HUD 的框層與動畫，`flag`／`paper`／`prime`／`enma` 四類全部沿用；未改進化條件、材料、角色資料、存檔欄位、同步事件或戰鬥 iframe。主頁 query 更新為 `20260827-evolution-awakened-frame-v361`。
- 驗證：`scripts/zorojuro_enma_qa.js` 28 項全部通過，確認兩張框載入、初始／轉換／完成 opacity、四類主題皆套用兩段框動畫、覺醒框與角色矩形對位，以及 1600×900／844×390 無 overflow；最終與轉換截圖位於 `.codex/qa/zorojuro_evolution_frame_v361/`。`PORT=8801 npm start` 成功啟動，正式頁與覺醒框素材皆 HTTP 200，頁面包含新素材、兩段動畫與 V361 query；本機未設定 `DATABASE_URL`，不影響此次靜態 Board 頁驗證，完成後已停止測試程序。

## 修改紀錄：進化覺醒感／角色圖框內限制 V360（2026-08-27）

- 問題：共用框接入後只有前後圖淡入與閃白，視覺上仍像單純換圖；原角色動畫最高放大 1.06 倍，會在轉換瞬間超過框緣。進化材料在舊動畫 68% 後完全消失，完成畫面也無法辨識觸發材料。
- 角色限制：進化前後角色圖統一以框內緣 `clip-path` 裁切，並移除所有大於 1 倍的角色／框縮放。新形態改由框中央的菱形區域向四角展開，最終可視區固定停在框內，不會再露出外框外的長方形圖片角落。
- 覺醒演出：共用 stage 新增依 `--evolution-line`／`--evolution-glow` 著色的旋轉能量印與垂直光柱；流程為材料在中央啟動、舊形態閃白、能量印與光柱達峰、新形態菱形展開。材料完成後滑到角色框右側並縮成帶主題色邊框的徽章，保持可見但不遮住角色。
- 邊界／快取：改動只作用於共用進化 HUD，`flag`／`paper`／`prime`／`enma` 四類全部套用；未改進化條件、材料扣除、角色／招式資料、存檔欄位、同步事件或戰鬥 iframe。主頁 query 更新為 `20260827-evolution-frame-contained-material-v360`。
- 驗證：`PORT=8800 npm start` 成功啟動，正式頁 HTTP 200 且包含新框內裁切、覺醒動畫與 V360 query，完成後已停止測試程序。`scripts/zorojuro_enma_qa.js` 27 項全部通過，確認四類主題、材料完成時仍可見、角色／框對位、中央菱形展開、旋轉能量印／光柱，以及 1600×900／844×390 無 overflow。最終與轉換截圖位於 `.codex/qa/zorojuro_evolution_frame_v360/`。

## 修改紀錄：全進化角色圖共用 UI 框 V359（2026-08-27）

- 設計／素材：使用內建 ImageGen 生成 1086×1448、中央與外圍皆有真實 Alpha 的直式海賊 RPG 框；黑鐵、古金、海浪、羅盤與少量青紫能量只分布在邊緣，不把角色、武器、文字或底板畫進素材。正式素材為 `public/images/board/evolution_ui/evolution_portrait_frame_v1.webp`，WebP 仍為四通道透明，中央像素 RGBA 為 `0,0,0,0`，SHA-256 為 `A0A342DA9AF6C5D527F58E3E675623197ACEC208C663AAA618BB61F7A84355A0`；生成規格記錄於 `docs/EVOLUTION_PORTRAIT_FRAME_IMAGEGEN_PROMPT.md`。
- 接入：共用 `evolution-hud` 的進化前／進化後角色圖上方新增同尺寸透明框層，素材物件仍在框層上方。框使用既有 `--evolution-glow`，並隨原本 8.2 秒覺醒節奏淡入、閃光與定格；selector 不綁單一角色或 `enma`，所以被打穿的旗幟、3D2Y 報紙、巔峰生命紙與閻魔四類正式進化演出全部套用。
- 邊界：34 組正式進化 normal portrait 均確認為 1086×1448，框與角色圖共用相同 `max-width`／`max-height`／定位，不修改進化條件、角色資料、素材動畫、對話、存檔欄位、同步事件或戰鬥 iframe。主頁 query 更新為 `20260827-evolution-portrait-frame-v359`。
- 驗證：`npm start` 首次執行因 8787 已有既存 Node server 而回報 `EADDRINUSE`，改以 `PORT=8799 npm start` 成功啟動同一專案；正式 `board_game.html` HTTP 200 且包含新素材與 V359 query，完成後已停止 8799 測試程序。`scripts/zorojuro_enma_qa.js` 25 項全部通過，另逐一檢查 `flag`／`paper`／`prime`／`enma` 四類均套用共用框；素材 1086×1448／Alpha、框動畫、框與角色圖矩形精確一致、1600×900 與 844×390 無 overflow。視覺截圖位於 `.codex/qa/zorojuro_evolution_frame_v359/`。

## 修改紀錄：閻魔試煉完整畫面 V358（2026-08-27）

- 原因：閻魔畫面原本使用 `object-fit: cover`，切幕還會由 `scale(1.035)` 縮回，抽取／奪回霸氣動畫最高放大到 `scale(1.05)`，因此切入與特效期間四周確實會被裁掉。
- 修正：六張圖改用 `object-fit: contain`，移除切幕與兩組狀態動畫的縮放／位移；保留淡入、亮度、飽和度及紫光特效。不同螢幕比例會以深色留邊完整顯示，不再裁掉圖片內容。對話框仍按原設計覆蓋在畫面下方。
- 邊界／快取：未改台詞、六幕節奏、HUD、觸發、戰鬥或進化規則。正式 query 為 `20260827-enma-trial-full-frame-v358`，iframe 為 `20260827-enma-trial-full-frame-v122`。
- 驗證：三份 JS `node --check` 通過；1600×900 與 932×430 六幕專項 `pass=true`、`errors=[]`，逐幕 computed `objectFit=contain`、無 overflow，台詞、HUD 隱藏與播完恢復操作亦正常。證據位於 `C:/Users/王曜瑋/.codex/qa/zoro_enma_trial_full_frame_v358/`。

## 修改紀錄：閻魔試煉六幕放慢 V357（2026-08-27）

- 節奏：六幕停留時間依序調整為 3.0、3.0、2.4、2.4、3.8、4.2 秒；短促反應不低於 2.4 秒，較長的決意與勝戰宣言保留更長閱讀時間。
- 邊界／快取：動態 recovery 會依新的六幕總長度自動延後，不會中途跳過；台詞、圖片、HUD、觸發、戰鬥與進化規則均不變。正式 query 為 `20260827-enma-trial-slower-pacing-v357`，iframe 為 `20260827-enma-trial-slower-pacing-v121`。
- 驗證：三份 JS `node --check` 通過；1600×900 與 932×430 六幕專項 `pass=true`、`errors=[]`，六幕時間、台詞、無 overflow、HUD 隱藏及播完恢復操作皆正常。證據位於 `C:/Users/王曜瑋/.codex/qa/zoro_enma_trial_slower_pacing_v357/`。

## 修改紀錄：閻魔試煉第五幕決意台詞 V356（2026-08-27）

- 台詞：第五幕由「不，我就要這把刀。」替換為「閻魔嗎……等我習慣它，就能變得更強吧。」並延長至 3.2 秒；第一、六幕固定台詞及第二至第四幕均不變。
- 邊界／快取：未改圖片、HUD、觸發、戰鬥或進化規則。正式 query 為 `20260827-enma-trial-resolve-line-v356`，iframe 為 `20260827-enma-trial-resolve-line-v120`。

## 修改紀錄：閻魔試煉固定首尾台詞 V355（2026-08-27）

- 台詞：依使用者指定，第一幕固定為「來測試這把新刀如何。」，第六幕固定為「你也想測試我嗎？我會贏下這場戰鬥，證明給你看的。」；第二至第五幕維持 V354 的原作試刀脈絡短句。
- 邊界／快取：未改圖片、HUD 隱藏、正式對話框、動態 recovery、觸發條件、戰鬥數值或索隆十郎進化。正式 query 為 `20260827-enma-trial-fixed-bookends-v355`，iframe 為 `20260827-enma-trial-fixed-bookends-v119`。
- 驗證：三份 JS `node --check` 通過；1600×900 與 932×430 六幕專項 `pass=true`、`errors=[]`，首尾固定台詞、中間四句、HUD 隱藏、無標題／按鈕及播完恢復操作皆正常。證據位於 `C:/Users/王曜瑋/.codex/qa/zoro_enma_trial_fixed_bookends_v355/`。

## 修改紀錄：閻魔試煉原作脈絡台詞 V354（2026-08-27）

- 原作核對：試刀與手臂乾縮段落對應漫畫第 955 話、動畫第 956 集；依「試斬、察覺霸氣被抽取、短促咒罵、命令歸還霸氣、拒絕換刀、認定馴服後會更強」的原作順序重寫六幕。台詞採遊戲繁中改寫，不把來源字幕大段逐字照搬，也不混入羅格鎮三代鬼徹劇情。
- 顯示／節奏：六幕依序為「那就試試看……！」、「……！這把刀在吸走我的霸氣。」、「可惡……！」、「給我還回來！」、「不，我就要這把刀。」與「閻魔嗎……等我習慣它，就能變得更強吧。」；全部沿用正式藍金玩家對話框。
- 快取／驗證：正式 query 為 `20260827-enma-trial-original-dialogue-v354`，iframe 為 `20260827-enma-trial-original-dialogue-v118`。三份 JS `node --check` 通過；1600×900 與 932×430 六幕專項均 `pass=true`、`errors=[]`，確認六句、素材、無標題／按鈕、HUD 隱藏及播完恢復皆正常。

## 修改紀錄：閻魔試煉六幕完整對話與保護計時 V353（2026-08-27）

- 對話／節奏：原本空白的第二至第五幕補上新世界索隆台詞，六幕現在依序呈現試刀、察覺霸氣被抽走、手臂乾縮、奪回霸氣、理解駕馭方式與勝戰宣言；中間四幕停留時間調整為 2.4～2.7 秒，全部沿用正式藍金玩家對話框。
- 提前結束修正：原本一般開場共用的 9 秒 recovery watchdog 會在加長後於第四幕把劇情強制標成完成。現在只有閻魔 cinematic 依六幕實際總長度再加 3 秒容錯計算 recovery 時間；一般開戰仍維持原本 9 秒，不改戰鬥指令、同步格式、存檔欄位或索隆十郎進化條件。
- 檔案／快取：修改 `public/js/board_game.js`、兩個正式 HTML、`scripts/zoro_enma_trial_intro_qa.js` 與四份專案文件。正式 query 為 `20260827-enma-trial-full-dialogue-v353`，iframe 為 `20260827-enma-trial-full-dialogue-v117`。
- 驗證：三份 JS `node --check` 通過；1600×900 與 932×430 專項逐幕確認六張 1672×941 素材、六句台詞／說話者、正式玩家對話框、無標題、無額外按鈕、劇情期間 HUD 隱藏、結束後 HUD／操作權恢復，結果 `pass=true`、`errors=[]`。證據位於 `C:/Users/王曜瑋/.codex/qa/zoro_enma_trial_full_dialogue_v353/`。

## 修改紀錄：閻魔試煉移除頂部標題 V351（2026-08-27）

- 顯示：移除六幕 cinematic 頂部的「閻魔試煉」標題節點與整組 badge CSS，避免遮住索隆頭部、刀身或背景。演出現在只保留六張畫面、需要時出現的正式玩家對話框，以及右下六點進度。
- 邊界／快取：未改血量 HUD 隱藏、正式對話框、台詞、圖片、節奏、觸發、數值或同步。正式 query 為 `20260827-enma-trial-no-title-v351`，iframe 為 `20260827-enma-trial-no-title-v115`。
- 檔案／驗證：修改 `public/board_battle.html`、`public/js/board_battle.js`、`public/js/board_game.js`、`public/board_game.html`、`scripts/zoro_enma_trial_intro_qa.js` 及四份專案文件。三份 JS `node --check` 通過；1600×900 與 932×430 閻魔專項 `pass=true`、`errors=[]`，六幕 `titleCount=0`，劇情期間 HUD／相剋圖示維持隱藏，正式玩家對話框正常，結束後 UI 與操作權完整恢復。證據位於 `C:/Users/王曜瑋/.codex/qa/zoro_enma_trial_no_title_v351/`。

## 修改紀錄：閻魔試煉隱藏戰鬥 HUD 與正式對話框 V350（2026-08-27）

- 顯示：閻魔六幕播放期間，正式戰鬥頁會暫時隱藏我方／敵方血量 HUD 與中央力／技／速相剋圖示，讓畫面只保留 cinematic、閻魔試煉標記與幕次進度；劇情結束或同步端先收到完成快照時都會清除 `enma-trial-cinematic-active`，完整恢復原戰鬥 UI。
- 對話：移除 V349 另外設計的紫黑長框。第一幕與第六幕改為直接使用遊戲既有 `prebattle-quote player` 結構、`prebattle-speaker`／`prebattle-text` 排版，以及正式 `images/board/battle_hud_dialogue_ui/battle_dialogue_player_frame.webp` 藍金玩家對話框；無台詞的中間四幕不顯示對話框。
- 邊界／快取：只修改閻魔 cinematic 的顯示層與結束清理，不改六張圖、台詞、觸發條件、戰鬥數值、索隆十郎進化、普通開戰對話、按鈕、存檔或同步資料格式。正式 query 為 `20260827-enma-trial-dialogue-hud-v350`，iframe 為 `20260827-enma-trial-dialogue-hud-v114`。
- 檔案：修改 `public/board_battle.html`、`public/js/board_battle.js`、`public/js/board_game.js`、`public/board_game.html`、`scripts/zoro_enma_trial_intro_qa.js`，並同步更新本文件、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`。
- 驗證：三份相關 JS `node --check` 通過；閻魔專項於 1600×900 桌機與 932×430 平板皆 `pass=true`、`errors=[]`，逐幕確認 `playerHudVisible=false`、`enemyHudVisible=false`、`matchupChipVisible=false`，兩個台詞幕皆載入正式玩家對話框，結束後三項 UI 全恢復且 `canAct=true`，無水平／垂直溢位。一般開戰對話／CPU 回歸 `errors=[]`；進場恢復、watchdog 與海上遭遇回歸 `errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/qa/zoro_enma_trial_dialogue_hud_v350/`、`battle_prebattle_intro_v350/`、`battle_entry_recovery_v350/`。

## 修改紀錄：新世界索隆・閻魔試煉戰鬥開場 V349（2026-08-27）

- 劇情邊界：這次只呈現和之國「閻魔吸取霸氣、手臂乾縮、索隆強行收回霸氣」的試刀過程；角色從頭到尾都是赤膊、綠色腹卷的新世界索隆。內容明確排除羅格鎮買三代鬼徹、賭手臂試刀及刀店畫面，也不會在勝利前提前顯示索隆十郎。
- 觸發：目前出戰卡必須是索隆且有效型態精確為 `zoro_evolution_2`，並攜帶 `enma`（單獨裝備或放在巴雷特的武器庫均可）；未帶閻魔、其他索隆型態、已進化的索隆十郎與 PK／切磋都不觸發。六幕播放期間沿用既有 `prebattleIntro` 鎖定，不能先選招，播完才恢復戰鬥操作。
- 演出：第一幕顯示「來測試這把新刀如何。」；中間依序為霸氣被抽出、右臂乾縮、強行收回霸氣、手臂恢復；最後顯示「你也想測試我嗎？我會贏下這場戰鬥，證明給你看的。」。沒有新增按鈕，六幕自動播放，桌機與平板共用全畫面雙圖層交叉淡入、紫色閃光、試煉標記、對話框及六點進度。
- 素材：使用內建 ImageGen，以使用者提供的閻魔吸取霸氣畫面為主要動作／服裝參考、`Enma_Infobox.webp` 為刀身參考、新世界索隆正式 portrait 為身分參考，產出六張獨立畫面；正式 WebP 位於 `public/images/board/battle/cinematics/enma_trial_v1/`，皆為 1672×941。來源圖未被移動、修改或覆蓋，生成來源與逐幕 prompt 記錄於 `docs/ENMA_TRIAL_IMAGEGEN_PROMPTS.md`。
- 同步／快取：cinematic 直接附在既有 `battle.prebattleIntro` 完整快照內，播放完成仍走既有 intro acknowledge 與 `BOARD_GAME_STATE` 推送；未新增 `gameState` 欄位、localStorage key、Socket.IO event 或第五顆按鈕。`BATTLE_PAGE_VERSION` 更新為 `20260827-enma-trial-intro-v113`，主頁與戰鬥頁 query 更新為 `20260827-enma-trial-intro-v349`。
- 檔案：修改 `public/js/board_game.js`、`public/js/board_battle.js`、`public/board_battle.html`、`public/board_game.html`；新增六張 cinematic WebP、`scripts/zoro_enma_trial_intro_qa.js` 與 `docs/ENMA_TRIAL_IMAGEGEN_PROMPTS.md`。
- 驗證：相關三份 JS `node --check` 通過；`npm start` 於 8828 port 正常提供正式頁（本機未設定 `DATABASE_URL`）。閻魔開場專項 QA 通過：6／6 素材皆 HTTP 200 且為 1672×941、單件／武器庫皆觸發、五組排除條件正確、六幕順序與台詞正確、劇情期間無提前選招、結束後 `canAct=true`，1600×900 桌機及 932×430 平板均無 overflow。一般開戰對話／CPU 回歸 `errors=[]`；索隆十郎勝利進化 24／24 通過；戰鬥進場恢復、watchdog 與海上遭遇回歸 `errors=[]`、`failures=[]`。QA 證據位於工作區外 `C:/Users/王曜瑋/.codex/qa/*_v349/`。

## 修改紀錄：閻魔勝利進化・索隆十郎 V348（2026-08-27）

- 規則：新增 S 級不可交易攜帶物「閻魔」。裝備者獲得物攻 ×1.15、8% 暴擊與暴擊傷害倍率 +0.15；新世界索隆必須實際參戰並贏得一場非切磋戰鬥，才會永久特殊進化成索隆十郎。閻魔可單獨裝備或放在巴雷特的武器庫內，進化後不消耗，之後卸下也不會退化；沒有參戰、戰敗、PK／切磋、錯誤型態或未攜帶閻魔均不計算。
- 型態／招式：新增 `zoro_zorojuro` 三階特殊型態、專屬能力與四招物理招式「閻魔・煉獄鬼斬」「一刀流・飛龍火焰」「閻王三刀流」「一百三情・飛龍侍極」；進化時沿用既有進化 HUD，不增加戰鬥按鈕或新存檔欄位。勝利判定只讀取實際參戰索引，並在既有完整 `BOARD_GAME_STATE` 路徑推送型態、招式與能力結果。
- 掉落：KING 原本的「KING 的佩刀」10% 獨立掉落維持不變；另新增第二次獨立 10% 閻魔掉落判定，兩件可以同場一起獲得，且各自具有重複結算防護。
- 素材：以使用者提供的索隆十郎與閻魔參考圖，透過 ImageGen 產出獨立 Board 素材。正式道具圖為 `public/images/board/items/postgame_boss_relics/enma.webp`（1254×1254 黑底）；七張戰鬥表情位於 `public/images/board/battle/portraits/evolutions/zoro_zorojuro/`（normal／angry／hit／hit_enemy／morale／weak／dizzy，皆 1086×1448）。normal 已修正為精確三把刀，hit_enemy 明確由畫面左側受擊。
- 檔案：修改 `public/js/board_items.js`、`public/js/board_cards.js`、`public/js/board_game.js`、`public/board_game.html`、`scripts/generate_item_catalog.js`、`scripts/battle_critical_system_qa.js`、`scripts/bullet_arsenal_full_compatibility_qa.js`，新增 `scripts/zorojuro_enma_qa.js` 與上述八張正式 WebP；正式 query 為 `20260827-zorojuro-enma-v348`。
- 驗證：相關 JS 與 QA 的 `node --check` 通過；索隆十郎／閻魔專項 24 項全部通過，包含真實 `startBattle`→`finishBattle`、四招換裝、PK 排除、武器庫、卸裝不退化、桌機與 844×390 平板進化 HUD。完整暴擊回歸 45／45、Boss 遺物玩家效果 36／36、武器庫 94／94 件與 4,371／4,371 組不同兵裝組合均通過；正式 `board_game.html` 回應 HTTP 200。

## 修改紀錄：斜切「爆擊」銘牌 V336（2026-08-26）

- 顯示：依使用者最新指定，正式暴擊重新直接顯示「爆擊」二字。標牌置於白熱金傷害數字上方，以深紅／近黑斜切銘牌、細金色上下邊、兩側金色切片、金字暗紅硬影組成；標牌與數字在命中第一拍同步彈入，之後一起上飄淡出。普通傷害、MISS、治療與不屈／GUARD 不建立標牌。
- 素材／邊界：V335 原創彎刀圖示、來源 PNG 與 prompt 均保留，沒有刪除或覆蓋，但正式傷害節點已停止建立圖示。沒有修改暴擊判定、角色／技能／道具機率、暴擊倍率、多段索引、傷害、HUD、存檔或同步。正式 query 為 `20260826-critical-label-plate-v336`，戰鬥 iframe 為 `20260826-critical-label-plate-v112`。
- 驗證：`public/js/board_battle.js`、`public/js/board_game.js`、`scripts/battle_damage_numbers_qa.js` 的 `node --check` 通過；定向 QA 確認暴擊節點顯示精確文字「爆擊」、斜切 gradient／clip-path 與 `criticalLabelSnap` 生效、舊圖示不再建立，普通／三段／MISS／治療隔離維持，932×430 平板在 viewport 內且無 overflow，`errors=[]`、`failures=[]`。完整暴擊規則、三段動畫與 HUD 回歸 45／45 通過。`npm start` 於 8798 port 正常提供正式頁；本機未設定 `DATABASE_URL`。證據位於 `C:/Users/王曜瑋/.codex/qa/battle_damage_numbers_v336/` 與 `C:/Users/王曜瑋/.codex/qa/battle_critical_system_v336/`。

## 修改紀錄：LoL 式小型暴擊圖示結構 V335（2026-08-26）

- 設計：依使用者提出的 LoL 方向，採用「傷害數字維持可讀、旁邊附一枚固定暴擊符號、第一拍強化」的資訊結構；沒有複製 LoL 圖示或商標。使用內建 ImageGen 生成原創的「彎刀擊穿四芒羅盤星」透明圖示，白刃／古金／深紅／近黑配色對應目前海賊 UI。原始 1254×1254 RGBA PNG 保存在 `incoming/critical_strike_cutlass_icon_v1_source.png`，正式素材裁切與縮放成 128×128 透明 WebP `critical_strike_cutlass_icon_v1.webp`，生成 prompt 記錄於同資料夾的 `CRITICAL_STRIKE_CUTLASS_ICON_V1_PROMPT.md`。
- 接入：撤下 V334 包圍數字的大型 CSS 金紅放射線與交叉閃切；正式暴擊保留 92.8px 白熱金數字、近黑硬框、紅黑立體影與短促命中停頓，另外只在暴擊節點建立小圖示。桌機圖示約 40px、932×430 平板約 26px，定位於負號左側並隨暴擊節點一起彈入／淡出；普通傷害、MISS、治療與被擋下均不建立圖示。
- 邊界／快取：未修改暴擊判定、機率、倍率、多段索引、傷害、角色／技能／道具 id、戰鬥 HUD、存檔或同步。正式 query 為 `20260826-critical-cutlass-icon-v335`，戰鬥 iframe 為 `20260826-critical-cutlass-icon-v111`。
- 驗證：正式 JS 與傷害 QA 的 `node --check` 通過；素材檢查確認來源及正式 WebP 都為四通道透明 alpha，正式檔為 128×128、SHA-256 `51AB5074E2B981B7905AEE8AAD5895E4DDD3EA3D70A7677D8A5B2B9A4A199EC0`。定向 QA 確認暴擊圖示載入成功、桌機 40px、`criticalIconSnap` 生效，非暴擊節點沒有圖示，普通／三段／MISS／治療隔離維持，932×430 平板在 viewport 內且無 overflow，`errors=[]`、`failures=[]`；完整暴擊規則、三段動畫與 HUD 回歸 45／45 通過。`npm start` 於 8798 port 正常提供正式頁；本機未設定 `DATABASE_URL`。證據位於 `C:/Users/王曜瑋/.codex/qa/battle_damage_numbers_v335/` 與 `C:/Users/王曜瑋/.codex/qa/battle_critical_system_v335/`。

## 修改紀錄：白熱金放射爆點暴擊 V334（2026-08-26）

- 顯示：在使用者開放配色與樣式後，撤下 V333 的黑紅墨刷底板，改為個人定稿的經典遊戲暴擊語彙。數字維持桌機 92.8px，使用白熱金字面、近黑硬描邊、赤紅／暗紅／黑三層立體落影；命中瞬間從數字中心展開一圈金紅硬邊放射線，並加上兩道交叉閃切。前 6%～13% 保留短促命中停頓，放射線在動畫中段前收回，不增加任何文字或 bitmap。
- 邊界／快取：辨識度來自金色高能量配色、放射爆點與停頓，不依靠永久放大字級。普通傷害、MISS、治療、戰鬥 HUD、暴擊判定／機率／倍率／多段索引及存檔／同步均未修改。正式 query 為 `20260826-critical-gold-burst-v334`，戰鬥 iframe 為 `20260826-critical-gold-burst-v110`。
- 驗證：相關正式 JS 與傷害跳字 QA 的 `node --check` 通過；定向 QA 確認桌機 92.8px 白熱金字面 `rgb(255, 241, 160)`、近黑描邊、金紅 `criticalRayBurst` 與 `criticalCrossFlash` 生效，普通／三段／MISS／治療隔離維持，932×430 平板在 viewport 內且無 overflow，`errors=[]`、`failures=[]`。完整暴擊規則、三段動畫與 HUD 回歸 45／45 通過。`npm start` 於 8798 port 正常提供正式頁；本機未設定 `DATABASE_URL`。證據位於 `C:/Users/王曜瑋/.codex/qa/battle_damage_numbers_v334/` 與 `C:/Users/王曜瑋/.codex/qa/battle_critical_system_v334/`。

## 修改紀錄：原字級黑紅漫畫斬痕暴擊 V333（2026-08-26）

- 顯示：依使用者指出「要樣式更明顯、不是把字變大」，將暴擊桌機字級由 V332 的 107.2px 退回 92.8px；亮白字面、鮮紅粗框、深紅硬影與黑色外輪廓保留。原本數字下方的單一紅線改為穿過數字後方的窄型黑紅漫畫墨刷斬痕，使用不規則刷痕輪廓與紅／黑／暗紅硬分層，搭配金色四芒羅盤星，以固定視覺符號區分暴擊，不再依靠放大字級。
- 邊界／快取：沒有增加文字或 bitmap，普通傷害、MISS、治療、戰鬥 HUD、暴擊判定／機率／倍率／多段索引及存檔／同步均未修改。正式 query 為 `20260826-critical-ink-slash-v333`，戰鬥 iframe 為 `20260826-critical-ink-slash-v109`。
- 驗證：相關正式 JS 與傷害跳字 QA 的 `node --check` 通過；定向 QA 確認桌機暴擊字級 92.8px、黑紅漸層墨刷斬痕 `criticalInkSlash`、金色羅盤星及數字樣式生效，普通／三段／MISS／治療隔離維持，932×430 平板在 viewport 內且無 overflow，`errors=[]`、`failures=[]`。完整暴擊規則、三段動畫與 HUD 回歸 45／45 通過。`npm start` 於 8798 port 正常提供正式頁；本機未設定 `DATABASE_URL`。證據位於 `C:/Users/王曜瑋/.codex/qa/battle_damage_numbers_v333/` 與 `C:/Users/王曜瑋/.codex/qa/battle_critical_system_v333/`。

## 修改紀錄：高對比大型暴擊數字 V332（2026-08-26）

- 顯示：針對 V331 與普通傷害仍不夠分離的問題，暴擊桌機字級由 92.8px 提高到 107.2px，改成亮白字面、6px 鮮紅粗框、深紅硬質立體影與黑色外輪廓；右上羅盤星由深紅小記號改成更大的金色四芒星，下方紅色斬線同步加寬加粗。命中前段的縮放由 1.2 提高到 1.28，維持短促、清楚且不使用額外文字或滿畫面 bitmap 特效。
- 邊界／快取：普通傷害仍為約 75.2px，MISS、治療、技能按鈕、戰鬥 HUD、暴擊判定／機率／倍率／多段索引及存檔／同步均未修改。正式 query 為 `20260826-critical-high-contrast-v332`，戰鬥 iframe 為 `20260826-critical-high-contrast-v108`。
- 驗證：相關正式 JS 與傷害跳字 QA 的 `node --check` 通過；定向 QA 確認亮白填色 `rgb(255, 248, 232)`、鮮紅描邊 `rgb(200, 24, 50)`、107.2px 桌機尺寸、金色四芒星及紅斬線動畫生效，普通／三段／MISS／治療隔離維持，932×430 平板在 viewport 內且無 overflow，`errors=[]`、`failures=[]`。完整暴擊規則、三段動畫與 HUD 回歸 45／45 通過。`npm start` 於 8798 port 正常提供正式頁；本機未設定 `DATABASE_URL`。證據位於 `C:/Users/王曜瑋/.codex/qa/battle_damage_numbers_v332/` 與 `C:/Users/王曜瑋/.codex/qa/battle_critical_system_v332/`。

## 修改紀錄：遊戲案例研究版羅盤暴擊數字 V331（2026-08-26）

- 顯示：參考動作 RPG 以顏色直接區別高傷害、狩獵遊戲用小型幾何記號標示會心，以及《航海王》遊戲的星形命中語彙後，重新設計為米白高對比字面、黑墨粗描邊、深紅錯位立體影、右上小型四芒羅盤閃光及數字下方短紅斬線。標記與斬線只在命中前段短促出現，取消大面積爆炸框與長時間模糊光暈，沒有額外文字或 bitmap。
- 邊界／快取：只有正式傷害跳字 CSS、QA 斷言與快取版本改變；暴擊判定、機率、倍率、多段索引、角色／技能／道具資料、戰鬥 HUD、存檔與多人同步均未修改。正式 query 為 `20260826-critical-compass-number-v331`，戰鬥 iframe 為 `20260826-critical-compass-number-v107`。
- 驗證：相關正式 JS 與 `scripts/battle_damage_numbers_qa.js` 的 `node --check` 通過；傷害跳字 QA 確認桌機暴擊數字 92.8px、米白填色 `rgb(255, 241, 208)`、黑墨描邊、深紅羅盤／斬線動畫均生效，普通／三段／MISS／治療隔離不變，932×430 平板在 viewport 內且無 overflow，`errors=[]`、`failures=[]`。完整暴擊規則、三段動畫與 HUD 回歸 45／45 通過。`npm start` 於 8798 port 正常提供正式頁；本機未設定 `DATABASE_URL`，資料庫功能於本次靜態／戰鬥 QA 停用。證據位於 `C:/Users/王曜瑋/.codex/qa/battle_damage_numbers_v331/` 與 `C:/Users/王曜瑋/.codex/qa/battle_critical_system_v331/`。

## 修改紀錄：黑字紅框與輕量暴擊光暈 V330（2026-08-26）

- 顯示：依使用者指定將暴擊數字改為黑色字面、深紅色粗描邊，保留黑紅立體陰影；另加入只作用在數字本身的短暫紅色光暈，約前 10% 動畫達到最亮、之後快速收回。沒有爆炸外框、斬光、bitmap 或額外文字。
- 邊界／快取：沿用 V329 的 96px 桌機尺寸與戰鬥 HUD 精簡；沒有修改暴擊判定、機率、倍率、多段索引、技能／角色詳情、角色／招式／道具 id、存檔或同步。修改 `public/board_battle.html`、`public/board_game.html`、`public/js/board_game.js`、`scripts/battle_damage_numbers_qa.js` 與四份正式文件；正式 query 為 `20260826-critical-black-red-outline-v330`，戰鬥 iframe 為 `20260826-critical-black-red-outline-v106`。
- 驗證：相關 JS 的 `node --check` 通過；傷害數字 QA 確認黑色填色 `rgb(8, 0, 2)`、深紅描邊 `rgb(181, 18, 36)`、`criticalInkFlash` 生效、偽元素外框均為 none，普通／三段／MISS／治療隔離維持，932×430 平板在 viewport 內且無 overflow，`errors=[]`、`failures=[]`。完整暴擊規則、三段動畫與 HUD 回歸 45／45 通過。`npm start` 於 8798 port 正常提供正式頁；本機未設定 `DATABASE_URL`，資料庫功能於本次靜態／戰鬥 QA 停用。

## 修改紀錄：單純深紅黑暴擊字 V329（2026-08-26）

- 顯示：依使用者回饋撤下 V328 的鋸齒爆炸外框，正式暴擊現在只保留深紅色 Impact 傾斜粗體、純黑描邊與輕量黑紅立體陰影；沒有漸層底圖、偽元素外框、斬光、額外發光或文字標籤。桌機暴擊字約 96px，一般傷害約 75px，仍以尺寸與深紅黑配色區分。
- 邊界／快取：戰鬥 HUD 仍不顯示暴擊率／倍率，角色詳情與技能效果說明保留；沒有修改暴擊判定、機率、倍率、多段索引、角色／招式／道具 id、存檔或同步。修改 `public/board_battle.html`、`public/board_game.html`、`public/js/board_game.js`、`scripts/battle_damage_numbers_qa.js` 與四份正式文件；正式 query 為 `20260826-critical-dark-red-type-v329`，戰鬥 iframe 為 `20260826-critical-dark-red-type-v105`。
- 驗證：`public/js/board_game.js`、`public/js/board_battle.js` 與傷害數字 QA 的 `node --check` 通過；傷害數字 QA 確認深紅填色 `rgb(173, 15, 34)`、黑描邊、前後偽元素／額外數字動畫均為 none，普通／三段／MISS／治療樣式不變，932×430 平板在 viewport 內且無 overflow，`errors=[]`、`failures=[]`。完整暴擊規則、三段動畫與 HUD 回歸 45／45 通過。`npm start` 於 8798 port 正常提供正式頁；本機未設定 `DATABASE_URL`，資料庫功能於本次靜態／戰鬥 QA 停用。

## 修改紀錄：紅黑暴擊字與爆炸外框 V328（2026-08-26）

- 顯示：依使用者指定將正式暴擊傷害數字主色由白金／紅色改為鮮紅、暗紅與黑色，描邊改為純黑，陰影與光暈只使用紅黑色系。V327 的兩道交叉斬光已移除，改成數字背後單一簡單鋸齒爆炸外框：外層紅至黑漸層、內層黑底，兩層都由 CSS polygon／gradient 組成。
- 邊界／快取：維持不顯示「暴擊」／`CRITICAL!` 等額外文字、不載入 bitmap、戰鬥 HUD 不顯示暴擊率／倍率；沒有修改暴擊判定、機率、倍率、多段索引、技能效果文字、角色詳情、角色／招式／道具 id、存檔或同步。修改 `public/board_battle.html`、`public/board_game.html`、`public/js/board_game.js`、`scripts/battle_damage_numbers_qa.js` 與四份正式文件；正式 query 為 `20260826-critical-red-black-burst-v328`，戰鬥 iframe 為 `20260826-critical-red-black-burst-v104`。
- 驗證：`public/js/board_game.js`、`public/js/board_battle.js` 與傷害數字 QA 的 `node --check` 通過；傷害數字 QA 確認桌機 102.4px 紅黑漸層、黑描邊、CSS 外／內爆炸框、無文字標牌／bitmap，普通／三段／MISS／治療樣式不變，932×430 平板在 viewport 內且無 overflow，`errors=[]`、`failures=[]`。完整暴擊規則、三段動畫與 HUD 回歸仍為 45／45 通過。`npm start` 於 8798 port 正常提供正式頁；本機未設定 `DATABASE_URL`，資料庫功能於本次靜態／戰鬥 QA 停用。

## 修改紀錄：強化暴擊辨識與精簡戰鬥狀態列 V327（2026-08-26）

- 暴擊顯示：維持不顯示「暴擊」／`CRITICAL!` 文字與不載入 bitmap 的規則，將暴擊傷害數字由桌機約 90px 提高至約 102px，並加強白黃紅漸層、黑色外框、立體陰影、瞬間縮放及兩道 CSS 交叉斬光的尺寸／亮度；一般傷害仍約 75px，因此可直接靠尺寸、色彩和動態辨認。
- 狀態列：正式獨立戰鬥頁的我方 HUD 移除「暴擊率／暴擊傷害倍率」pill；主遊戲內嵌後備戰鬥資訊列同步移除同段文字。角色詳情仍顯示完整暴擊率、倍率、特性與來源，技能卡自身的「10%暴擊／20%暴擊」效果說明也保留。
- 邊界／快取：沒有修改暴擊判定、角色 profile、等級／進化／兵裝加成、傷害倍率、多段判定、敵我限制、技能按鈕、角色／招式／道具 id、存檔或同步格式。修改 `public/board_battle.html`、`public/board_game.html`、`public/js/board_battle.js`、`public/js/board_game.js`、兩份暴擊 QA 與四份正式文件；正式 query 為 `20260826-critical-clear-hud-v327`，戰鬥 iframe 為 `20260826-critical-clear-hud-v103`。
- 驗證：四份修改 JS 的 `node --check` 通過；`scripts/battle_damage_numbers_qa.js` 確認桌機暴擊數字 102.4px、無文字標牌／bitmap、普通傷害／三段一般傷害／MISS／治療樣式不變，932×430 平板在 viewport 內且無 overflow，`errors=[]`、`failures=[]`。`scripts/battle_critical_system_qa.js` 確認桌機與 1024×768 平板 HUD 均移除暴擊資訊、技能內文保留、三段暴擊索引正確，完整規則與 UI 共 45／45 通過。`npm start` 於 8798 port 正常提供正式頁；本機未設定 `DATABASE_URL`，資料庫功能於本次靜態／戰鬥 QA 停用。

## 修改紀錄：純 CSS 暴擊傷害數字 V326（2026-08-26）

- 顯示：正式戰鬥頁不再於暴擊傷害數字後方載入 `critical_hit_burst_v1.webp`，也不增加「暴擊」或 `CRITICAL!` 等文字。暴擊只以傷害數字本身呈現：Impact 系列傾斜粗體、白金至赤紅漸層、深色立體描邊、亮度彈跳，以及兩條由 CSS gradient／clip-path 生成的交叉斬光；一般傷害、三段一般傷害與 MISS 保持原顯示。
- 邊界：沒有刪除或覆蓋 V323 的既有生成圖與原始來源，只停止正式 CSS 引用，方便日後追溯；沒有修改暴擊率、傷害倍率、多段判定、敵我限制、角色／招式／道具 id、戰鬥指令、存檔、`BOARD_GAME_STATE` 或 Socket.IO。
- 檔案／快取：修改 `public/board_battle.html`、`public/js/board_game.js`、`public/board_game.html`、`scripts/battle_damage_numbers_qa.js` 與四份正式文件。主頁 query 為 `20260826-critical-css-number-v326`，戰鬥 iframe 為 `20260826-critical-css-number-v102`。
- 驗證：`node --check public/js/board_game.js` 與傷害數字 QA 語法通過；`scripts/battle_damage_numbers_qa.js` 實測普通傷害、暴擊、三段一般傷害、MISS、治療樣式隔離與 932×430 平板，確認暴擊節點沒有文字標牌／bitmap URL、兩條 CSS 斬光與數字動畫生效、治療仍走一般動畫、平板在 viewport 內且無 overflow，`errors=[]`、`failures=[]`。`scripts/battle_critical_system_qa.js` 角色／敵將 profile、兵裝、單段／多段傷害、敵我限制與桌機／平板 UI 共 45／45 通過。`npm start` 於 8798 port 正常提供正式頁；本機未設定 `DATABASE_URL`，資料庫功能於本次靜態／戰鬥 QA 停用。

## 修改紀錄：全敵將血統暴擊與洛克斯 30% V325（2026-08-26）

- 範圍／規則：正式血統因子培育可取得的 66 種敵人來源身份全部新增我方專屬 `criticalRateBase` 與 `criticalStyle`，涵蓋一般敵人、推進城、頂上戰爭、四皇、伊姆、神之騎士團、十三島 Boss 與洛克斯。判定仍依目前陣營：敵方／CPU／Boss 出戰時固定 0%，培育成我方永久角色後才使用自己的 profile，並正常疊加等級、進化、招式與兵裝。
- 人物差異：數值依原作戰鬥方式與精準度配置，不按職能平均。例如斯潘達姆 3%、路基 19%、覺醒路基 22%、卡塔庫栗 24%、紅髮 25%；洛克斯依玩家指定為 Lv.1 基礎 30%，特性為「世界之王・霸王要害」。Lv.99 固定成長、技能／兵裝加成、50% 總上限與 ×2 傷害上限不變。
- 培育／相容：新培育角色在永久實例建立時依 `factor.enemyKey` 寫入來源 profile；即使覺醒路基等來源共用基礎玩家模板，也會保留來源身份的暴擊率。讀取既有船上／研究收藏的血統角色時，依 `cultivatedFromEnemyKey`／`lineageSourceEnemyKey` 自動回填新版值，不需重新培育；沒有新增研究所 schema、localStorage key、Socket.IO event 或新的同步欄位。
- 檔案／快取／驗證：修改 `public/js/board_game.js`、兩個正式 HTML、`scripts/battle_critical_system_qa.js`，並同步五份正式文件。正式 query 為 `20260826-lineage-critical-profiles-v325`，戰鬥 iframe 為 `20260826-lineage-critical-profiles-v101`。專項驗證 66／66 個 profile、66 個不同特性、66／66 種來源逐一正式培育、洛克斯 30%、我方／敵方陣營切換及舊存檔回填；連同既有角色、裝備、傷害與桌機／平板 UI 共 45／45，`errors=[]`、`failureCount=0`。`npm start` 於獨立 8798 port 正常提供正式頁面；本機未設定 `DATABASE_URL`，資料庫功能於此次靜態／戰鬥 QA 中停用。

## 修改紀錄：玩家限定暴擊與角色形象機率 V324（2026-08-26）

- 規則／角色：敵方、CPU 與 Boss 的最終暴擊率固定為 0%，敵方招式自帶暴擊加成、必定暴擊及巴雷特吸收的狙擊瞄準鏡等來源都不會使敵方暴擊。判定依目前陣營而非角色出身；原敵方角色被招募並在我方出戰後，會依自己的角色 profile、等級、進化、招式與兵裝正常暴擊。51 名正式玩家角色依人物戰鬥形象重新拉開 Lv.1 基礎值至 2%～18%；劍豪、狙擊手、殺手及精準型角色較高，例如索隆／羅／御田／比斯塔 15%、卡文迪許／奇拉／羅傑 16%、雷利／以藏 17%、鷹眼／騙人布 18%，魔人歐斯仍為 2%。
- 成長／顯示：Lv.20／40／60／80／99 與一階／二階進化加成、招式與兵裝加成、50% 機率上限及 ×2 傷害上限不變。角色詳情與我方戰鬥 HUD 繼續顯示目前暴擊率／倍率；敵方 HUD 與主頁備援戰鬥框不再顯示暴擊資訊。實際玩家暴擊仍只用 V323 的無文字生成圖與傷害數字演出。
- 檔案／快取：修改 `public/js/board_cards.js`、`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/battle_critical_system_qa.js`、`scripts/bullet_absorbed_items_qa.js`，並同步主文件與 Boss 遺物說明。正式資料／程式 query 為 `20260826-player-only-critical-profiles-v324`，戰鬥 iframe 為 `20260826-player-only-critical-profiles-v100`；沒有新增或改名角色、招式、道具 id、`gameState` 欄位、localStorage key 或 Socket.IO event。
- 驗證：正式 JavaScript 與兩份修改後 QA 均通過 `node --check`。玩家限定暴擊專項 38／38；巴雷特六孔確認六個瞄準鏡與最低亂數仍為一般傷害 312、暴擊數 0；傷害數字／無文字圖片演出回歸、Boss 遺物 36／36、全量武器庫 93／93 與 4,278／4,278 組、十三 Boss 13／13 均為 `errors=[]`、`failures=[]`。`npm start` 於獨立 8798 port 正常提供正式頁面；本機未設定 `DATABASE_URL`，資料庫功能於此次靜態／戰鬥 QA 中停用。

## 修改紀錄：暴擊命中改為無文字生成圖 V323（2026-08-26）

- 玩家定案：實際暴擊命中不顯示中文、英文或任何額外標牌文字；正式 DOM 不再建立 `.damage-critical-label`，只保留傷害數字與圖像演出。
- 素材／顯示：使用 Codex 內建 ImageGen 產生透明紅金交叉斬擊爆發圖，正式 WebP 為 `public/images/board/battle/effects/critical_hit/critical_hit_burst_v1.webp`，原始 RGBA PNG 與完整 prompt 分開保存在同目錄 `incoming/` 與 `CRITICAL_HIT_BURST_PROMPT.md`。暴擊時圖片於傷害數字後方縮放、提亮及淡出；一般傷害、MISS、GUARD 與回復不使用此圖。
- 快取／邊界：正式 query 更新為 `20260826-critical-profiles-items-image-fx-v323`，戰鬥 iframe 為 `20260826-critical-profiles-items-image-fx-v99`。這次只取代 V322 的臨時文字標牌，不改 51 名角色 profile、五件暴擊兵裝、傷害倍率、技能說明、按鈕、存檔或多人同步。
- 驗證：素材與正式檔均為 1254×1254 RGBA 且保留 Alpha；傷害 QA 確認暴擊節點文字只有 `-456`、文字標牌數量 0、正式背景圖載入，1600×900 與 932×430 均在 viewport 且無 overflow。暴擊系統 36／36、巴雷特六孔吸收回歸皆為 `errors=[]`、`failures=[]`。

## 修改紀錄：角色個別暴擊、暴擊兵裝與命中特效 V322（2026-08-26）

- 角色／成長：正式 51 名可玩角色不再共用角色類型基礎值；`public/js/board_cards.js` 逐角建立 `criticalRateBase` 與 `criticalStyle`，Lv.1 基礎依人物戰鬥形象落在 2%～13%。例如魔人歐斯 2%、曼雪莉 3%、魯夫 5%、索隆／羅 10%、騙人布／以藏 12%、鷹眼 13%；Lv.20／40／60／80／99 與一階／二階進化加成維持原規則。自訂角色才依既有角色類型使用後備值。
- 道具／倍率：狙擊瞄準鏡維持 10% 暴擊；疾風鉤爪與櫻十・木枯各新增 5% 暴擊。格里芬之劍使暴擊傷害倍率 +0.2，赤色伯爵的傘劍使倍率 +0.1；一般基礎仍為 ×1.5，合計上限 ×2。五件都走通用攜帶物 context，所以單件、巴雷特武器庫內裝與巴雷特吸收孔位共用相同規則；不新增道具 id、價格或取得方式。
- 顯示／演出：角色詳情與戰鬥 HUD 同時顯示目前暴擊率和傷害倍率，技能維持在效果列顯示「10%暴擊／20%暴擊」且沒有角標或第五顆按鈕。V322 曾短暫使用英文標牌，已由上方 V323 完全移除並改成無文字生成圖。
- 檔案／快取：修改 `public/js/board_cards.js`、`public/js/board_items.js`、`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、三份相關 QA，並重產 `docs/ITEM_CATALOG.md`、同步四份主文件與 `docs/POSTGAME_BOSS_RELICS.md`。正式資料／程式 query 為 `20260826-critical-profiles-items-fx-v322`，戰鬥 iframe 版本為 `20260826-critical-profiles-items-fx-v98`；未新增或改名 `gameState`、localStorage key、Socket.IO event 或同步欄位。
- 驗證：`node --check` 通過正式 JavaScript 與 QA；暴擊專項 36／36，涵蓋 51／51 個別 profile、55 個技能、五件道具、50% 機率上限、×2 傷害上限、多段逐段、武器庫雙兵裝與桌機／平板 HUD。Boss 遺物 36／36、巴雷特六孔回歸及全量武器庫結構／玩家效果 93／93、4,278／4,278 組皆為 `errors=[]`、`failures=[]`。`npm start` 於獨立 8798 port 正常提供頁面，本機 8787 既有服務未中止；未設定 `DATABASE_URL`，資料庫功能於本次靜態 QA 停用。

## 修改紀錄：技能暴擊文字精簡與移除角標 V321（2026-08-26）

- 介面／文字：依玩家定案移除正式戰鬥頁與主頁備援招式卡右上角的「暴+／暴++／必暴」小角標及其 CSS；暴擊 metadata 與計算完全保留，招式效果列直接顯示「10%暴擊／20%暴擊」，不使用「暴擊率+10%」格式。未增加、刪除或改排任何技能／主指令按鈕。
- 範圍／快取：修改 `public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html` 與 `scripts/battle_critical_system_qa.js`；主程式／戰鬥程式 query 為 `20260826-critical-text-only-v321`，戰鬥 iframe 版本為 `20260826-critical-text-only-v97`。角色、招式與道具 id、暴擊機率、傷害倍率、存檔欄位、localStorage key、Socket.IO event 均未改。
- 驗證：三份 JavaScript 通過 `node --check`；暴擊專項 29／29，鎖定 0 個角標、四顆技能、技能內文「10%暴擊／20%暴擊」、桌機 1600×900、平板 1024×768、無 overflow 與逐段暴擊動畫。一般傷害數字／手機視窗及十三 Boss 機制回歸均為 `errors=[]`、`failures=[]`；`npm start` 於獨立 8798 port 正常啟動，本機 8787 port 原已有其他服務，未予中止。本機未設定 `DATABASE_URL`，資料庫功能於此次靜態 QA 中停用。

## 修改紀錄：角色／招式通用暴擊系統 V320（2026-08-26）

- 規則／數值：所有角色現在都有基礎暴擊率，戰鬥型／偵查型／移動型／輔助型依序為 6%／7%／6%／4%，未知類型預設 5%；Lv.20、40、60、80 各 +1%，Lv.99 再 +1%，一階／二階進化分別 +2%／+4%，狙擊、劍士等角色天賦另加 1%～3%。一般暴擊率上限 50%，直接物理／特殊攻擊暴擊傷害固定為 1.5 倍；輔助招式不能暴擊，多段招式逐段獨立判定，單一段數只會套用一次暴擊倍率。
- 招式／介面：`public/js/board_cards.js` 以既有招式名稱加入暴擊 metadata，目前 349 個直接攻擊中 55 個有招式加成（36 個 +10%、19 個 +20%）；沒有增加第五顆按鈕，原招式卡只在右上角顯示「暴+／暴++」，並預留未來「必暴」metadata。角色詳情與正式戰鬥 HUD 顯示當前暴擊率，桌機與平板仍維持原本四顆主指令。
- 裝備／巴雷特：瞄準鏡的 +10% 併入同一個角色暴擊率，不再另做一次獨立傷害倍率；單獨攜帶、武器庫內裝與巴雷特吸收孔位都走同一判定。即使吸收六個瞄準鏡也只會到 50% 上限，命中暴擊時仍只乘一次 1.5，而不是疊成 `1.5^6`。純傷害預覽不消耗隨機數，只有正式結算與演出才擲暴擊。
- 檔案／相容性：修改 `public/js/board_cards.js`、`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`，新增 `scripts/battle_critical_system_qa.js`，並更新 `scripts/bullet_absorbed_items_qa.js`。正式主頁／戰鬥頁 query 為 `20260826-critical-system-v320`；沒有修改角色、招式、道具 id，沒有新增或改名 `gameState`、localStorage key 或 Socket.IO event。
- 驗證：上述五份正式 JavaScript／QA 均通過 `node --check`；`npm start` 於 8798 port 正常提供正式頁面。暴擊專項為 28／28，包含等級、進化、天賦、技能、瞄準鏡、武器庫、50% 上限、單段／多段、預覽不偷骰、桌機 1600×900、平板 1024×768 與逐段暴擊動畫；十件 Boss 遺物為 36／36，武器庫為結構／玩家效果 93／93、4,278 組，傷害數字與十三 Boss 機制回歸皆為 `errors=[]`、`failures=[]`。本機未設定 `DATABASE_URL`，資料庫功能於此次靜態 QA 中停用。

## 修改紀錄：疾風圍巾速度單次套用 V319（2026-08-26）

- 原因／修正：`choice_scarf` 在玩家 `currentBattleStat()` 同時依固定 item id 乘 1.25，又依正式 `choice_lock_speed_bonus` effect kind 再乘一次 1.25，經整數取整後實測成約 1.565 倍。現移除舊 id 特判，只保留資料定義的 `speedBonus: 0.25` 單一來源，因此單件與武器庫內裝都只提高約 25% 速度；首次直接攻擊鎖招規則不變。
- 範圍／快取：只修改 `public/js/board_game.js` 的玩家速度計算、`scripts/bullet_arsenal_full_compatibility_qa.js` 的修正後推薦池，以及 `public/board_game.html` 主程式 query；沒有修改道具 id、價格、取得方式、存檔欄位、localStorage key、Socket.IO event、巴雷特吸收版或其他速度道具。正式主程式 query 為 `20260826-choice-scarf-single-speed-v319`。
- 驗證：`node --check` 通過 `public/js/board_game.js` 與全量 QA；`npm start` 於 8798 port 正常提供 V319 主程式。正式瀏覽器實測疾風圍巾單件速度為 1.252 倍（基礎數值取整後的 +25%），疾風貝／黑焰羽衣對照為 1.15／1.299；全量結果為結構 93／93、玩家效果 93／93、4,278／4,278 組可用，`runtimeAnomalies=[]`、`errors=[]`、`failures=[]`。疾風圍巾已重新納入正常排名；本機未設定 `DATABASE_URL`，資料庫功能於此次靜態 QA 中停用。

## 修改紀錄：十件 Boss 遺物玩家端效果 V318（2026-08-26）

- 問題／修正：V317 稽核找出的十件 Boss 遺物已從「只能裝入但玩家效果未完整接線」改為正式可用；單獨攜帶與放入「巴雷特的武器庫」兩種模式共用同一套兵裝 context 與獨立 runtime。補齊戰鬥數值、直接攻擊／整招連擊、命中與落空、受擊、回合末、致命傷、戰勝貝里及戰鬥狀態文字掛點；巴雷特吸收武器庫時仍只取得空外殼，破孔前兩件內裝兵裝保持封存。
- 定案規則：櫻十・木枯為速度／物攻各 +20% 與每場首次整招直接傷害 -40%；黃金戒三次有效直接攻擊後束縛一回合、雙防永久 -1，戰勝貝里為基礎值 +200%；Battle Smasher 三次命中蓄熱，下一次直接攻擊 +40%、無視 20% 防禦，命中或落空都消耗，反噬最大 HP 30% 但最低留 1；魔王樂譜只對多段招式依 +1%、+2%、+4% 無上限翻倍；七星劍每損失完整 5% 最大 HP 增傷 4%，最高 +76%。
- 定案規則（續）：KING 佩刀背火受直接傷害 -25%，被直接命中後熄火，熄火時速度與下一次直接攻擊各 +25%，只有完成直接攻擊才復燃；土龍特攻 +30%，只反制敵人連續兩次行動使用同一直接招式；傘劍在整招結算後吸取實傷 20%，溢補轉最大 HP 15% 護盾；Ragnir 特攻 +20%，第三朵冰雲生成當下立即凍結並清空；生命種子低於 70% HP 時回復／累積，依 1／2／3 顆復活 12%／24%／36%，每場只復活一次。
- 檔案／快取：修改 `public/js/board_items.js`、`public/js/board_game.js`、`public/board_game.html`，新增 `scripts/postgame_boss_relic_player_effects_qa.js`，更新 `scripts/bullet_arsenal_full_compatibility_qa.js` 與重產 `docs/ITEM_CATALOG.md`；並同步 `docs/DEV_WORKFLOW.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/POSTGAME_BOSS_RELICS.md`。正式主頁資料／主程式 query 為 `20260826-postgame-relic-player-effects-v318`；沒有新增或改名 `gameState`、localStorage key 或 Socket.IO event。
- 驗證：`node --check` 通過兩份正式 JavaScript 與兩份 QA；十件遺物以正式瀏覽器在單件／武器庫兩模式完成 36／36 專項檢查，`failures=0`、`errors=[]`。全 93 件兵裝仍為結構 93／93、玩家效果處理 93／93，4,278 種不同兵裝組合皆完成；既有武器庫裝卸／雙 runtime／空外殼／破孔恢復專項、十三 Boss 13／13 機制與桌機／手機圖像回歸均為 `failures=[]`、`errors=[]`。一般 CPU 戰鬥完整採樣 38 次，確認開場對話後會實際選招、扣除敵方 HP，`lastError=""`。V318 當時仍存在的疾風圍巾速度重複套用已由上方 V319 修正。`npm start` 於 8798 port 正常啟動；本機未設定 `DATABASE_URL`，資料庫功能於此次靜態／戰鬥 QA 中停用。

## 測試紀錄：武器庫全兵裝相容性與 4,278 組配對掃描 V317（2026-08-25）

- 測試範圍：新增 `scripts/bullet_arsenal_full_compatibility_qa.js`，從 `docs/ITEM_CATALOG.md` 讀取目前 94 件角色攜帶物，扣除武器庫本身後，逐一測試 93 件兵裝的第 1／第 2 槽正式裝入、有效 context、槽位獨立 runtime、戰鬥序列化、單槽卸回、雙兵裝共存及整個武器庫卸回。另以 Lv.99 索隆、能力者測試敵人、七種物理／特殊／火／水／雷／聲音／連擊代表招式，比較單獨裝備與武器庫內裝後的最大 HP、五項戰鬥數值與傷害路徑。
- 結果（V317 當時）：93／93 件通過武器庫結構與生命週期測試，`structuralFailures=[]`、瀏覽器 `errors=[]`；當時玩家端效果處理器稽核為 83／93，列出的十件 Boss 遺物尚未完整執行玩家效果。這十件缺口已由上方 V318 修正並重測為 93／93，本段保留作歷史稽核紀錄。
- 額外異常（V317 當時）：疾風圍巾的 `choice_scarf` item id 與 `choice_lock_speed_bonus` effect kind 在玩家速度計算中各乘一次 1.25，實測單件為 1.565 倍而非敘述的 1.25 倍；此異常已由 V319 修正。
- 配對掃描（V317 當時）：93 件不同兵裝兩兩組合共 4,278 組全部完成計算；當時排除十件未接效果後為 3,403 組。V318 已讓 4,278 組全部具備玩家端處理器，V319 再把修正後的疾風圍巾重新納入正常推薦。
- 檔案／驗證：只新增測試工具並同步 `docs/DEV_WORKFLOW.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`；沒有修改正式遊戲程式、資料 id、存檔欄位或 Socket.IO event。測試工具通過 `node --check`，完整結果輸出至工作區外 `arsenal_full_compatibility_v317/bullet_arsenal_full_compatibility_result.json`。工具依設計因 10 個效果缺口及 1 個倍率異常回傳非零，總計 `failures=11`；`npm start` 於 8798 port 正常啟動，本機無 `DATABASE_URL`，資料庫功能在此次瀏覽器 QA 中停用。

## 修改紀錄：武器庫戰鬥狀態列內層兵裝選擇 V316（2026-08-25）

- 問題／修正：戰鬥狀態列原本把「巴雷特的武器庫」與內裝兩件兵裝展開成三顆攜帶物標籤，會擠壓其他狀態。現在狀態列只保留一顆「巴雷特的武器庫」；點開後才在既有詳情浮窗內顯示兩個兵裝選項，玩家選擇其中一件即可查看該件目前狀態與完整效果。
- 規則／邊界：兩件內裝兵裝仍同時生效並各自保存 runtime；禁止同種兵裝、背包扣還、巴雷特只吸收空外殼、破孔前封存與破孔後恢復等規則均未改。一般攜帶物仍維持原本單一詳情浮窗，Tot Musica 雙世界戰鬥沿用同一套武器庫顯示。沒有新增 `gameState` 欄位、localStorage key、Socket.IO event 或第五顆戰鬥指令。
- 檔案：修改 `public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`，新增 `scripts/bullet_arsenal_battle_hud_qa.js`，並同步 `docs/DEV_WORKFLOW.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`。正式主頁 query 為 `20260825-arsenal-nested-hud-v316`，戰鬥頁 query／iframe 版本為 `20260825-arsenal-nested-hud-v96`。
- 驗證：三份 JavaScript 均通過 `node --check`。新戰鬥 HUD 專項在 1600×900 與 932×430 均確認狀態列只有 1 顆武器庫、舊兵裝標籤為 0、浮窗內有 2 個可選兵裝、兩件詳情切換正確、浮窗未超出視窗且 HUD 無 overflow，`errors=[]`、`failures=[]`。既有武器庫完整規則／桌機／平板 QA 全數通過；十三 Boss 隔離回歸亦為 `bossCount=13`、`errors=[]`、`failures=[]`。`npm start` 於獨立 8798 port 啟動，兩個正式 HTML 與 V316／V96 JavaScript 四個網址均為 HTTP 200；本機未設定 `DATABASE_URL`，資料庫功能於此次靜態／戰鬥 QA 中停用，測試後停止臨時服務。

## 修改紀錄：十三島 Boss 全新挑戰滿血 V315（2026-08-25）

- 問題／修正：原本只有 Tot Musica、泰佐洛與澤法被列入「全新挑戰固定滿血」名單，其他十名 Boss 會直接沿用島嶼 `currentHp`；撤退、其他玩家留下的進度或舊快照因而可能讓吸血伯爵等 Boss 以殘血開始新戰。現在滿血名單直接由十三名正式 `POSTGAME_BOSS_DEFS` 產生，所有無風帶 Boss 的全新挑戰都會先把島嶼與戰鬥 HP 設為該 Boss 的完整最大值。
- 續戰／邊界：同一筆 `pendingBattle` 仍從保存的 Boss HP、狀態與機制進度繼續，不會補滿；同島既有共鬥會先走共鬥加入流程。一般敵島、四皇、推進城、海軍本部、洛基試煉與洛克斯終戰沒有納入這個十三島名單。沒有新增 `gameState` 欄位、localStorage key 或 Socket.IO event。正式主頁 query 為 `20260825-postgame-fresh-full-hp-v315`。
- 檔案：修改 `public/js/board_game.js`、`public/board_game.html`，新增 `scripts/postgame_boss_fresh_hp_qa.js`，並同步 `docs/DEV_WORKFLOW.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`。
- 驗證：主程式與專項 QA 均通過 `node --check`。專項瀏覽器 QA 逐一將 13 名 Boss 的島嶼 HP 壓到 37% 後發起新挑戰，13／13 均恢復完整 HP；再將同一戰鬥保存為 41% HP 的 `pendingBattle`，13／13 均維持殘血續戰，`errors=[]`、`failures=[]`。既有十三 Boss 機制／桌機／手機隔離回歸亦為 `bossCount=13`、`errors=[]`、`failures=[]`。`npm start` 等效的正式 server 於獨立 8798 port 啟動，主頁與 V315 主程式皆 HTTP 200；本機未設定 `DATABASE_URL`，資料庫功能於此次靜態／戰鬥 QA 中停用，測試後停止臨時服務。

## 修改紀錄：覺醒路基六王銃先現身再受擊 V314（2026-08-25）

- 順序修正：依使用者澄清，六王銃不應在黑幕衝擊途中就把我方切成受擊圖。現在 5.2 秒必殺動畫完整結束並退去黑幕後，先強制顯示我方正常角色圖 0.6 秒；第 5.8 秒才播放命中語音、切正式 `hit.webp`、扣除畫面 HP、跳傷害數字、播放命中特效與震動，受擊圖維持 1.6 秒。
- 事件／邊界：主程式的六王銃專屬 attack visual duration 由 5.2 秒延長為 7.6 秒，確保下一回合不會插入三段演出；BGM 與一般音效保持鎖定到受擊完成再恢復。只修改六王銃顯示時序，威力 480、必中、無視 50% 防禦、六式循環、權威 HP、存檔、多人 event 與其他 Boss 不變。正式主頁／戰鬥頁 query 為 `20260825-lucci-rokuogan-reveal-before-hit-v314`。
- 驗證：三份 JavaScript 均通過 `node --check`。路基專項 QA 在 1600×900／932×430 均實測：黑幕退去後先為 `normal.webp`、HP 800／800、無傷害字且最後語音仍為 `call`；下一段才成為 `hit.webp`、HP 479／800、顯示 `-321` 且最後語音改為 `hit`，`errors=[]`、`failures=[]`。六式 6／6、威力／必中／無視防禦與 BGM 生命週期亦通過；十三 Boss 隔離回歸為 13／13、`errors=[]`、`failures=[]`。`npm start` 於獨立 8798 port 啟動，兩個正式 HTML 與 V314 主程式／戰鬥 UI 皆 HTTP 200；測試後已停止臨時服務。

## 修改紀錄：覺醒路基六王銃受擊停留 V313（2026-08-25）

- 原因／修正：六王銃在第 3.3 秒衝擊接觸時就已切換我方受擊圖，但受擊圖原本僅維持 1.1 秒，會在 5.2 秒黑幕完全退去前接近結束，玩家真正看見時只剩短暫一瞬。現保留命中語音、傷害跳字、顯示 HP 與衝擊時點，只把我方受擊圖停留延長為 2.5 秒，使黑幕退去後仍清楚可見。
- 邊界：只修改 `public/js/board_battle.js` 的六王銃專屬受擊 pose 計時、更新戰鬥頁 cache query，並擴充既有路基專項 QA；沒有更動六式抽取、六王銃威力 480、必中、無視 50% 防禦、BGM／語音生命週期、存檔、多人 event 或其他 Boss。正式戰鬥頁 query 為 `20260825-lucci-rokuogan-hit-hold-v313`。
- 驗證：`node --check` 通過戰鬥 UI 與路基專項 QA。`scripts/lucci_six_powers_qa.js` 在 1600×900 與 932×430 均實測黑幕完全退去後 `playerHitPose=true`、正式 `hit.webp` 已解碼，並再次通過六式 6／6、六王銃必中／威力／無視防禦、語音與 BGM 生命週期，`errors=[]`、`failures=[]`；十三 Boss 隔離回歸為 13／13、`errors=[]`、`failures=[]`。`npm start` 於獨立 8798 port 啟動，正式戰鬥頁與 V313 戰鬥 UI 均 HTTP 200；測試後已停止臨時服務。

## 修改紀錄：卡塔庫栗見聞色短版影片 V312（2026-08-25）

- 素材：使用者已在 Board 專用路徑重新剪短 `public/videos/board/postgame_bosses/katakuri/future_sight_red_eyes.mp4`；新版為 4.671 秒、1,465,396 bytes、1920×1080、SHA-256 `BD9A48DA7894CDF90A22B3634E1965AD4C30482A3C723940550C0CF070590AF3`。實際檢查中段與結尾皆保留卡塔庫栗紅眼見聞色畫面。
- 程式／邊界：正式演出時間由 5.6 秒同步縮為 4.8 秒，戰鬥頁 fallback 同步更新；流程仍為開戰對話 → 見聞色特寫 → 預知骰，沒有新增按鈕、存檔欄位或多人 event。另一款遊戲的 `public/videos/enh/15.mp4` 未移動、未改寫，SHA-256 仍為 `63F2BBB9C527768D01A4D8A51C1A51CB6EDF4CB03C90AA154323DBF2079A3516`。正式 query 更新為 `20260825-katakuri-short-video-v312`。
- 驗證：新版影片由瀏覽器解碼為 4.671 秒、1920×1080、readyState 4，並實際檢視中段與結尾；四份 JavaScript 均通過 `node --check`。卡塔庫栗專項確認開戰對話 gate → Board 專用影片 → 預知骰、四顆原指令、桌機／932×430 與既有攻防規則，`errors=[]`、`failures=[]`；十三 Boss 隔離回歸為 13／13，`errors=[]`、`failures=[]`。`npm start` 於獨立 8798 port 啟動，兩個正式 HTML、V312 主程式／戰鬥 UI 及新影片皆 HTTP 200；測試後已停止臨時服務。

## 修改紀錄：卡塔庫栗影片獨立為 Board 專用素材 V311（2026-08-25）

- 素材隔離：V310 曾直接讀取另一款遊戲留下的 `public/videos/enh/15.mp4`；依使用者指正，現從原片 9.00 秒起精確裁切 5.47 秒紅眼見聞色段落，重新編碼為 1920×1080 H.264／AAC，另存至 `public/videos/board/postgame_bosses/katakuri/future_sight_red_eyes.mp4`。原 `15.mp4` 不移動、不覆蓋、不刪除，SHA-256 仍為 `63F2BBB9C527768D01A4D8A51C1A51CB6EDF4CB03C90AA154323DBF2079A3516`。
- 程式／邊界：卡塔庫栗 visual event 與戰鬥頁影片 fallback 均改讀 Board 專用新檔，起播時間改為 0；正式頁 query 更新為 `20260825-katakuri-board-video-v311`。遊戲仍維持開戰對話 → 見聞色特寫 → 預知骰，沒有新增按鈕、存檔欄位、Socket.IO event，其他 Boss 不變。
- 驗證：新檔為 5.472 秒、2,023,314 bytes、SHA-256 `F2D2C22143273973054EED0A39B805EC5D37C7993177D6D15B1233CF38DAAFBD`，瀏覽器解碼為 1920×1080、readyState 4，並實際檢視紅眼畫面。三份 JavaScript `node --check` 通過；卡塔庫栗專項確認新路徑、三段順序、四顆原指令、桌機／932×430 及原攻防規則，`errors=[]`、`failures=[]`；十三 Boss 回歸 13／13，`errors=[]`、`failures=[]`。

## 修改紀錄：卡塔庫栗見聞色特寫與預知骰演出 V310（2026-08-25）

- 演出順序：卡塔庫栗戰每名玩家的行動開始時，現在固定等待原本開戰對話完整結束，接著播放 `public/videos/enh/15.mp4` 最後約 5.6 秒的見聞色紅眼特寫，特寫隱藏後才送出既有 `dice` visual event，讓預知骰實際翻滾並停在公開點數。三段演出不重疊，開場被動視覺也不會插入「對話 → 特寫 → 預知骰」之間。
- 作用域／同步：只新增卡塔庫栗專屬 `postgame-katakuri-future-sight` 暫時 visual event、戰鬥頁影片遮罩與兩次既有完整戰鬥快照推送；沒有新增永久按鈕、頂層 `gameState` 欄位、localStorage key、Socket.IO event 或 server 欄位。正面出招後的攻擊／夥伴／道具／逃跑四顆指令、整輪防禦與其他十二名 Boss 規則不變。正式主頁與戰鬥頁 query 更新為 `20260825-katakuri-cinematic-dice-v310`。
- 檔案／驗證：修改 `public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/katakuri_future_sight_qa.js` 及四份專案文件；沿用使用者提供的既有 `public/videos/enh/15.mp4`，沒有改寫影片。三份 JavaScript 均通過 `node --check`。專項 QA 實測開戰對話期間 `visualType=""`、對話後特寫可見且影片路徑正確、特寫隱藏後預知骰為 `rolling=true`，並再次通過四顆一般指令、15%～90% 防禦、PP 消耗、桌機與 932×430，`errors=[]`、`failures=[]`；十三 Boss 回歸為 13／13、`errors=[]`、`failures=[]`。`npm start` 於獨立 8798 port 啟動，兩個正式 HTML、V310 主程式／戰鬥 UI 及影片均 HTTP 200；資料庫功能因本機未設 `DATABASE_URL` 停用，測試後已停止臨時服務。

## 修改紀錄：卡塔庫栗正面出招保留一般指令 V309（2026-08-25）

- 規則修正：選擇「正面出招」後不是強制立刻選招，而是回到原本四顆戰鬥指令；玩家仍可攻擊、換夥伴、使用道具或嘗試逃跑。只有最後真的使用招式時才比較該招第一骰與預知骰；換人、道具及逃跑不做未來視骰點比較，仍各自遵守原本的有效條件與 Boss 禁止逃跑等既有規則。
- 介面／邏輯：移除卡塔庫栗專屬的 `attackOnly` 顯示限制及主程式對換人、道具、逃跑的二次拒絕；暫時二選一與永久四顆指令數量不變，防禦仍會放棄整個行動。沒有修改其他 Boss、頂層 `gameState`、localStorage key、Socket.IO event 或 server 欄位。正式主頁與戰鬥頁 query 更新為 `20260825-katakuri-normal-actions-v309`。
- 檔案／驗證：修改 `public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/katakuri_future_sight_qa.js` 及四份專案文件。四份 JavaScript 均通過 `node --check`；卡塔庫栗專項實際選擇正面出招後，攻擊／夥伴／道具／逃跑四顆按鈕皆為可用，桌機與 932×430 無 overflow，預知失效及 15%～90% 防禦回歸仍通過，`errors=[]`、`failures=[]`。十三 Boss 回歸為 13／13 且 `errors=[]`、`failures=[]`。`npm start` 於獨立 8798 port 啟動，兩個正式 HTML 與 V309 主程式／戰鬥 UI JavaScript 均 HTTP 200；測試後已停止臨時服務。

## 修改紀錄：卡塔庫栗「預知未來」攻防抉擇 V308（2026-08-25）

- 規則：只重製第 10 名十三島 Boss「夏洛特・卡塔庫栗」。每名玩家行動開始時，卡塔庫栗不受速度影響先擲一顆公開預知骰；玩家再從暫時二選一決定正面出招或防禦。正面出招回到原四招，招式第一骰低於預知骰時整招失效但照常扣 PP，等於或高於才完整結算；防禦消耗整個行動，依一顆防禦骰把該輪卡塔庫栗所有直接傷害降低點數 ×15%，不減持續狀態傷害。
- 相容：奇數／偶數骰會分別限制預知骰、正常招式第一骰或防禦骰並消耗一次；共鬥每位交棒玩家各自預知、選擇，防禦只綁定該玩家與該輪。CPU 依預知點數、目前生命與收尾機會選擇出招或防禦。移除舊版猜招、冷靜、封鎖預知與 5% 反擊流程；卡塔庫栗仍為 1600 HP、原四招與原獎勵，其他十二名 Boss 不變。
- UI／同步：戰鬥頁先顯示預知骰與兩顆暫時選項；選擇正面出招後才顯示原四招，沒有永久第五顆按鈕。新狀態只保存於既有 battle mechanic 快照；沒有新增頂層 `gameState` 欄位、localStorage key、Socket.IO event 或 server 欄位。正式主頁與戰鬥頁 query 為 `20260825-katakuri-future-sight-v308`。
- 檔案：修改 `public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/postgame_boss_mechanics_qa.js`、新增 `scripts/katakuri_future_sight_qa.js`，並同步四份專案文件。
- 驗證：`node --check` 通過主程式、戰鬥 UI 與兩份 QA。十三 Boss 回歸為 13／13、`errors=[]`、`failures=[]`；卡塔庫栗專項確認永久按鈕 4、暫時選項 2，桌機與 932×430 均無 overflow，防禦骰 1～6 對 1000 直接傷害依序剩 850／700／550／400／250／100，預知 6 對第一骰 5 時敵方 HP 不變且 PP 扣 1。CPU 實戰在預知 5 時會選防禦、完成該輪並離開戰鬥，`lastError=""`。

## 修改紀錄：伊多雲端存檔入口復原與 QA 隔離（2026-08-25）

- 存檔復原：確認伊多的正式房號存檔 `server/data/board_saves/B5611.json` 完整保留（2026-08-19 15:20、第 460 回合、伊多與 CPU1～CPU3），將其原樣接回跨房讀檔入口 `server/data/board_saves/RECOVERED.json`；沒有改寫遊戲內容、房號、玩家或 `gameState` 欄位。
- 原因／修正：`scripts/york_clue_puzzle_formal_integration_qa.js` 原本在隔離房完成存讀檔測試後呼叫正式 `deleteManualSave()`，連帶刪除全域 `RECOVERED`。清理流程改為只移除該 QA 瀏覽器 context 的兩個本機測試 key，並只 DELETE 本次隨機 `YQ...` 測試房號，不再碰正式跨房備份。
- 驗證：`node --check` 通過 QA 腳本；正式約克整合 QA 以隨機房 `YQ7FI8NP` 完成，存讀檔清理 `deleted=true`、多人同步收斂且 `errors=[]`。QA 前後 `RECOVERED.json` 都存在且 SHA-256 保持 `5BBB6E13E26D78F3DF6F3C4DCB16B9603B58D03FB829B9B8FF175585E62F8569`；復原檔與 `B5611.json` 的 SHA-256 完全一致，JSON 可解析且仍為第 460 回合、目前玩家伊多。正式 `/api/board-save/RECOVERED` 回傳伊多存檔，不再落入其他房號的最新檔案後備選擇。

## 修改紀錄：約克十三張牌三階後新題目練習 V307（2026-08-24）

- 規則／入口：真人玩家集齊十三種線索且已持有三階約克座標解碼器後，重要道具背包不再鎖住入口，按鈕改顯示「再玩新題目」。進入後簡單、普通、困難三種難度都可選，並明示這是三階練習、沒有額外加成獎勵。
- 新題目／權威驗證：每次重新開啟練習頁都由本次 overlay channel 建立新的暫時題目變體；同一次開啟內維持相同題目，重新開啟則換題。內嵌頁仍只回傳排牌答案，`board_game.js` 以自己保存的變體識別碼重建同一份唯一解後驗證，不信任 iframe 自報答案。
- 無獎勵：練習成功只顯示完成結果；不新增或重複發放解碼器、不提高 `yorkDecoderTier`、名刀「日蝕」掉落率、線索數、蛋頭島狀態或其他道具／加成。沒有新增 `gameState` 欄位、localStorage key、Socket.IO event 或 server 欄位；一般第一次至三階的穩定題組與 CPU 只自動取得二階的規則不變。
- 檔案：修改 `public/js/board_york_clue_puzzle.js`、`public/js/board_game.js`、`public/board_york_clue_puzzle_formal_demo.html`、`public/board_game.html`、`scripts/york_clue_puzzle_qa.js`、`scripts/york_clue_puzzle_formal_integration_qa.js` 及四份專案文件。正式 query 為 `20260824-york-tier3-practice-v307`；整合 QA 的十三 Boss 遺物清單同步由已移出孤島池的洛基改為正式第 12 位魔人歐斯。
- 驗證：四份 JavaScript 均通過 `node --check`。題目產生器抽查 12 組基礎題與練習變體，確認變體可重現、重新開題會換答案且所有題目仍為唯一解，`failures=[]`。正式整合 QA 通過第一次簡單解碼、T1→T2→T3、三階缺少變體拒絕、三階練習成功、三難度可點、重新開啟取得不同變體、答案權威驗證、錯題、CPU 二階限制、存讀檔、多人觀看方鎖定及日蝕／十三 Boss 掉落回歸；練習前後 `tier=3`、解碼器 `[0,0,1]`、線索 `13`、蛋頭島狀態完全相同，`errors=[]`。`npm start` 於 8787 啟動成功；資料庫功能因本機未設 `DATABASE_URL` 停用，但靜態 Board 與 Socket.IO QA 正常完成。

## 修改紀錄：巴雷特武器庫禁止同種兵裝 V306（2026-08-24）

- 規則／UI：武器庫兩個兵裝槽只能裝入不同 id 的攜帶物；例如戰鬥服＋九尾幻面可以，兩件戰鬥服不行。另一槽已裝備的同種道具會在整備清單停用並顯示所在槽位，正式裝入函式也會再次拒絕，拒絕時不扣除背包或替換原槽。
- 舊存檔：讀取到重複兵裝時保留第一個槽位，後一件安全退回玩家背包，不刪除物品；若涉及最大 HP 兵裝，會依原生命比例換算目前 HP。沒有新增頂層 gameState 欄位、localStorage key、Socket.IO event 或 server 欄位。
- 檔案：修改 `public/js/board_game.js`、`public/js/board_items.js`、三個 Board HTML、`scripts/bullet_arsenal_qa.js`、道具清單及相關規則／總覽／檔案地圖／Boss 遺物文件。正式主程式與道具資料 query 為 `20260824-arsenal-unique-items-v306`。
- 驗證：主程式、道具資料及兩份武器庫／吸收 QA 均通過 `node --check`。武器庫 17 項規則確認同種拒絕後背包數與兩槽不變、舊重複配置退回一件、不同兵裝雙效果、空外殼封存與破孔恢復；1600×900／932×430 整備 UI 均鎖住另一槽同種道具，無破圖或 overflow，`errors=[]`、`failures=[]`。六孔吸收／最高傷害回歸亦為 `errors=[]`、`failures=[]`，空武器庫倍率維持 1.0。`npm start` 在 8787 啟動成功；三個 Board HTML、主程式及道具資料皆 HTTP 200 並載入 V306 query／文字。

## 修改紀錄：巴雷特只吸收空武器庫、破孔後兵裝生效 V305（2026-08-24）

- 巴雷特戰：六孔吸收到 `bullet_large_bullet_armor`「巴雷特的武器庫」時，只建立空武器庫外殼，不再展開兩件內裝兵裝，也不把內裝的增傷、速度、最大 HP、一次性效果或其他能力交給巴雷特。既有戰鬥快照若仍保存舊版 `arsenalItems`，載入時會清空巴雷特端的內裝副本。
- 原持有人：兩件兵裝仍保存在原角色的武器庫資料內，但武器庫孔位未破壞前維持封存、不生效；第一骰對應的直接攻擊命中並破壞該孔後，原角色的兩件兵裝才同時恢復效果。六孔詳情顯示「空武器庫・內裝兵裝封存中（破孔後生效）」，不新增按鈕或存檔欄位。
- 檔案：修改 `public/js/board_game.js`、`public/board_game.html`、`scripts/bullet_arsenal_qa.js`、`scripts/bullet_absorbed_items_qa.js` 及規則／總覽／檔案地圖／Boss 遺物文件；正式主程式 query 為 `20260824-cpu-battle-empty-arsenal-v305`。
- 驗證：`node --check` 通過主程式與三份 QA JavaScript。武器庫專項 15 項邏輯確認巴雷特吸收效果數為 0、空外殼不提高巴雷特最大 HP、破孔前原持有人有效兵裝數為 0 且最大 HP 維持基礎值 118，破孔後兩件恢復並回到 153；1600×900／932×430 UI 均無破圖或 overflow，結果 `errors=[]`、`failures=[]`。六孔極限傷害回歸確認武器庫倍率為 1.0，其他重複吸收道具、護盾、回復、特殊效果與傷害 UI 全部通過；60 次 CPU 實戰採樣也完成巴雷特戰並離場，`errors=[]`、`lastError=""`。`npm start` 因既有 8787 server 佔用回報 `EADDRINUSE`；沿用該 server 確認主頁與 V305 主程式皆 HTTP 200，且正式 query／空武器庫規則已載入。

## 修改紀錄：CPU 戰鬥傷害結算卡死修正 V304（2026-08-24）

- 原因：CPU 能正常等待開場台詞並選招，但一般招式進入傷害／治療／狀態與攜帶物結算後，數段由單攜帶物改成多攜帶物的程式提早結束迴圈，後續仍引用迴圈內的 `ctx`／`carryEffect`，依路徑拋出 `carryEffect is not defined` 或 `ctx is not defined`，令 `playerAction` 留在等待動畫／回合結算。
- 修正：只校正 `storeBattleCarryDamageAfterHit()`、`applyPlayerHpThresholdBattleCarryEffects()`、`tryCancelStatusWithBattleCarry()` 的迴圈作用域，並讓 `applyBattleHealingEffects()` 明確尋找醫療背包 context；沒有更動 CPU 選招、傷害公式、道具效果、Boss 規則、回合權威、`BOARD_GAME_STATE`、localStorage key 或 Socket.IO event。
- QA 工具：`scripts/battle_prebattle_intro_qa.js` 的頁面例外改記完整 stack，新增可調 sample 數及回合／HP／result 採樣，方便區分「CPU 已選招」與「戰鬥已實際結算」。
- 驗證：修正前正式流程依序重現 `carryEffect is not defined`、`ctx is not defined`，堆疊最後定位至 `applyBattleHealingEffects()`；修正後 CPU 對薩卡完整出招並離開戰鬥、對巴雷特正常等待開場後出招，兩次均 `errors=[]`、`lastError=""`。`node --check` 通過主程式與 QA 腳本。`docs/GAME_RULES.md` 不需因 V304 更新，因戰鬥規則未改。

## 修改紀錄：背包道具圖統一黑底 V303（2026-08-24）

- 顯示：正式道具圖片本身繼續保留透明 Alpha，背包左側大型預覽、右側道具清單縮圖及從背包開啟的船員選擇道具窗改由介面容器提供純黑底；九尾幻面、七星劍與傑爾馬66戰鬥服等去背圖在背包內因此仍與既有黑底道具圖一致。
- 作用域：只修改 `public/board_game.html` 的背包專用 CSS，並將主程式 cache query 更新為 `20260824-backpack-item-black-v303`，確保重整後取得最新頁面；不修改任何圖片、道具資料、效果、戰鬥動畫、戰鬥頁、回合、存檔或多人同步。`docs/GAME_RULES.md` 不需更新，因規則未改。
- 驗證：本機瀏覽器以 1280×720 桌機及 932×430 手機橫向實際載入含道具存檔；背包大型預覽、8 列可見清單縮圖及船員選擇道具窗皆為 `rgb(0, 0, 0)`，圖片全數載入且 modal／document 水平 overflow 均為 0。九尾幻面、七星劍與戰鬥服仍為 1254×1254 RGBA、Alpha 0～255。`npm start` 因既有 8787 server 佔用回報 `EADDRINUSE`；沿用該正式 server 確認新版主頁 HTTP 200 且載入 `20260824-backpack-item-black-v303` query。

## 修改紀錄：戰鬥演出攜帶物透明素材替換 V302（2026-08-24）

- 素材：依使用者指定，將 `D:\FFOutput` 的三張 Photoroom 去背 WebP 以剪下方式改成正式固定檔名，分別覆蓋戴彭的九尾幻面 `public/images/board/items/devon_kyubi_mask.webp`、七星劍 `public/images/board/items/postgame_boss_relics/saga_seven_star_sword.webp` 與傑爾馬66戰鬥服 `public/images/board/items/postgame_boss_relics/judge_germa66_battle_suit.webp`；三個外部來源檔移動完成後已不存在。
- 作用域：只替換正式戰鬥動畫既有路徑所讀取的三張圖片，不修改道具 id、名稱、效果、戰鬥規則、HTML／JavaScript、`BOARD_GAME_STATE`、localStorage key 或 Socket.IO event；正式戰鬥頁仍沿用原三個素材路徑。
- 驗證：移動前確認三張來源皆為 1254×1254 RGBA WebP，Alpha 範圍 0～255；移動後重新檢查正式檔尺寸、Alpha 與來源 SHA-256 一致，並確認 `D:\FFOutput` 三個來源路徑均已移除。`npm start` 因既有 8787 server 佔用而回報 `EADDRINUSE`；沿用該正式 server 確認戰鬥頁與三張 WebP 均 HTTP 200，HTTP 內容 SHA-256 亦與移入來源一致。

## 修改紀錄：推進城同層邀請組隊與共鬥逃獄 V301（2026-08-24）

- 組隊入口：推進城不再把同樓層玩家自動視為隊伍。只有目前回合玩家可從原「目前小隊」欄開啟組隊視窗，邀請同樓層且尚未組隊的真人；發出邀請會完成邀請者本回合，受邀者輪到自己時可接受或拒絕，接受／拒絕本身不消耗該回合。成功後以同一 `teamId` 組隊，邀請狀態與隊伍狀態沿用玩家既有 `impelDown` 快照並隨完整 `BOARD_GAME_STATE` 同步，沒有新增 localStorage key 或 Socket.IO event，也沒有新增第五顆指令按鈕。
- 事件／路線：每回合仍由當前玩家抽事件與決定全隊路線；巡邏、鑰匙、麥哲倫與伊娃等事件作用於已正式組隊且仍在同樓層的成員，隱藏囚犯只由抽中事件的當前玩家個別抽取。當隊伍所有成員的全隊 HP 與所有招式 PP 都已全滿時，伊娃科夫不會進入本次事件池；任一成員有 HP 或 PP 缺口時才會出現。
- 戰鬥／救援：非救援戰遇敵時建立推進城專用共鬥，同樓層隊員各行動一次後才完成本輪，隊員在全域玩家順序不相鄰也可正確交棒。單一玩家全隊瀕死先進入既有兩次本人回合的待救援；只有所有參戰隊員都倒下才判定逃獄失敗並押往海軍本部。既有牢外救援維持單人處理：成功救出目標，失敗只把救援者送往海軍本部。
- UI／檔案：修改 `public/js/board_game.js`、`public/js/board_impel_down.js`、`public/board_impel_down.html`、`public/board_game.html`，新增 `scripts/impel_down_team_invite_coop_qa.js`，並同步更新四份專案文件。窄版組隊視窗改為固定於目前 viewport、內容可捲動，沒有使用新圖片或改動既有四顆推進城指令。正式主頁／推進城頁 query 為 `20260824-impel-team-invite-coop-v4`／`20260824-team-invite-coop-v16`。
- 驗證：`node --check` 通過三份 JavaScript；專項 QA 實際呼叫正式邀請／接受指令，確認 A 發出邀請後回合交給中間順位 B、C 接受後仍停在 C 的回合，另覆蓋未組隊不共用、B 同層但未入隊、滿狀態排除伊娃／受傷後恢復、隱藏囚犯只給當前玩家、非相鄰 A→C 共鬥交棒、兩回合待救援及牢外救援保持單人，結果 `errors=[]`、`failures=[]`。1440×900 與 760×900 組隊 UI 無水平 overflow；`npm start` 因既有 8787 server 佔用回報 `EADDRINUSE`，確認該 server 的正式主頁 HTTP 200 且已載入新版 query，未停止使用者現有 server。

## 修改紀錄：商店取消懸賞鎖與戰略骰券定價 V300（2026-08-24）

- 商店解鎖：一般道具商店 115 件商品全部取消懸賞／稀有度購買門檻。商品一開始就會完整顯示，不再出現「懸賞不足」鎖定列；是否能購買只比較現有貝里與折扣後價格。`SHOP_ITEMS.unlockBounty` 固定為 0，商店庫存階段固定為 `ALL`，購買與數量確認流程不再呼叫 `itemUnlockedByBounty()`。其他非商店流程仍保留原稀有度／懸賞判定，避免擴大影響。
- 戰略商品價格：`fixed_step`「指定步數券」由 650 提高為 3,800 貝里；`odd_dice`／`even_dice`「單數骰子／雙數骰子」由 900 提高為各 4,800 貝里。三者皆高於新局 3,000 貝里，開局看得到但買不起；奇偶骰能控制兩次戰鬥第一骰，故高於單次指定移動步數的券。
- 相容與範圍：沒有改道具 id、效果、商店商品數、船隻商品、背包、折扣、回合、戰鬥、`BOARD_GAME_STATE`、localStorage key、Socket.IO event 或 server 快照。正式 query 更新為 `20260824-shop-no-bounty-lock-v3`。
- 檔案：修改 `public/js/board_items.js`、`public/js/board_game.js`、`public/board_game.html`、`public/board_water_seven.html`、`public/board_角色編輯器.html`、兩份商店 QA、`docs/ITEM_CATALOG.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：資料 QA 確認一般商店 115 件、船隻 16／16、三件戰略商品皆高於 3,000、商店商品解鎖門檻全部為 0，且商店購買／數量流程沒有懸賞檢查。1440×900 與 932×430 正式商店 UI 以零懸賞玩家測試，兩者均為 115 列、鎖定列 0、鎖標 0、可捲動、無水平 overflow／破圖／頁面錯誤，並能購買 S 級寶樹亞當木片。`npm start` 於 8799 啟動成功，正式 HTML／道具／主程式均 HTTP 200；瀏覽器另確認 8787 正式頁實際載入新版兩個 query。既有 `battle_parity_dice_relay_flag_qa.js` 重跑兩次皆在與本次無關的交棒海賊旗整輪替補等待（第 354 行）逾時；本次沒有修改該戰鬥／交棒規則，未把此舊測試問題誤列為通過。

## 修改紀錄：一般商店價格與全船隻商品 V299（2026-08-24）

- 價格稽核：對照新局 3,000 貝里與一般戰鬥 T5～T1 的 1,260／2,040／2,940／4,350／6,300 貝里獎勵，重新調整 104 件原本明顯偏低的商店價格。永久角色攜帶物提高幅度最大，C／B／A 級最低分別為 1,000／1,500／3,000；船隻永久裝備依 C／B／A／S 級與實際效益定為 1,200～9,800；強力航海、回復、減傷、奇偶骰與永久修行商品同步提高。80～180 貝里的基本單體解狀態藥與小補給保留低價，避免前期補給被鎖死。
- 船隻商店：16 件 `ship` 類道具全部加入一般道具商店且都有正售價。原本只在稀有池的 `ship_dream_medical_galley`「夢幻廚房與醫療聯艙」改為 9,800 貝里，`ship_adam_wood`「寶樹亞當木片」改為 6,000 貝里；其餘 14 件船裝／船材亦完成定價。商店原本會整批排除 S 級商品，現只對 `category === "ship"` 開例外，其他 S 級稀有道具仍不會進入一般商店。
- 相容與範圍：只改既有道具的 `price`／`obtain.shops`、一般商店 S 級船隻篩選與 HTML cache query；沒有改 id、道具效果、庫存結構、回合、戰鬥、`BOARD_GAME_STATE`、localStorage key、Socket.IO event 或 server 快照。S 級船材實際購買仍走原 `addInventoryItem()` 與完整狀態同步。
- 清單／檔案：重新產生 `docs/ITEM_CATALOG.md`，維持 207 件總數，現有 115 件一般商店商品且 16 件船隻道具全部可購買。修改 `public/js/board_items.js`、`public/js/board_game.js`、`public/board_game.html`、`public/board_water_seven.html`、`public/board_角色編輯器.html`、`scripts/generate_item_catalog.js`、四份必更文件；新增 `scripts/item_shop_balance_qa.js` 與 `scripts/item_shop_balance_ui_qa.js`。正式 query 為 `20260824-item-shop-rebalance-v2`。
- 驗證：五份修改／新增 JavaScript `node --check` 通過；資料 QA 確認正式道具 178、一般商店 115、船隻 16／16、商店零價船隻 0、非船隻 S 級誤上架 0，並鎖定 16 件船隻售價與永久攜帶物價格底線。正式商店 UI 於 1440×900／932×430 均顯示 115 列、可捲動、無水平 overflow／破圖／頁面錯誤，實際以 6,000 貝里購買寶樹亞當木片後正確扣款並進入背包。`npm start` 於 8799 正常提供三個正式檔案 HTTP 200；未設定 `DATABASE_URL` 的訊息為既有本機狀態。巴雷特武器庫、吸收道具／不屈／九尾及十三 Boss 回歸均為 `failures=[]`。

## 修改紀錄：巴雷特的武器庫與全道具清單 V298（2026-08-24）

- 道具改版：保留既有 `bullet_large_bullet_armor` id 以相容舊存檔、掉落與多人快照，名稱／效果正式改為「巴雷特的武器庫」。武器庫本身占角色原本 1 個攜帶物欄，玩家可在原攜帶物整備彈窗中另外裝入 2 件背包攜帶物；兩件效果與各自的一次性／累積狀態同時生效，不增加戰鬥指令按鈕。武器庫不能裝入另一個武器庫；原始 V298 曾允許同名兵裝並存，現行規則已由 V306 覆寫為兩槽不得重複相同 id。
- 背包／存檔：內裝物會從背包與正式庫存扣除；卸下單槽只歸還該件，卸下、替換武器庫或移除持有角色時，兩件兵裝與空武器庫全部回到背包。兩個槽位使用固定索引與獨立 battle runtime key，第一槽為空時第二槽不會左移；`arsenalItems` 保存於既有角色 `battleCarryItem` 物件並隨完整 `BOARD_GAME_STATE` 同步，沒有新增頂層 gameState 欄位、localStorage key、Socket.IO event 或 server 欄位。
- 戰鬥／Boss：一般戰鬥的能力值、傷害、命中、減傷、治療、換人、獎勵與一次性效果都會逐件讀取武器庫內兵裝。此段原始 V298 曾讓巴雷特展開兩件效果；現行規則已由 V305 覆寫為只吸收空外殼，內裝在原持有人端封存至破孔後才生效。舊「大型子彈號裝甲」隊友增傷／減傷效果已移除。
- 素材：使用 OpenAI ImageGen 生成獨立黑底武器庫圖，正式 `bullet_arsenal.webp` 與原始 PNG 分開保存；舊 `bullet_large_bullet_armor.webp` 未修改或覆蓋。提示詞、尺寸與 SHA-256 記錄於 `docs/BULLET_ARSENAL_IMAGEGEN_PROMPT.md`。
- 清單：新增 `scripts/generate_item_catalog.js`，直接讀取正式 `board_items.js` 的 178 件資料及 `board_game.js` 仍在使用的 29 件角色攜帶物，交叉整理商店、事件池、一般道具掉落、戰鬥攜帶物掉落與特殊獎勵來源，輸出 `docs/ITEM_CATALOG.md`。目前共 207 件：航海 15、戰鬥 27、船隻 16、角色攜帶物 94、重要道具 55；113 件列有一般道具商店價格，其餘明示不可購買或研究所價格。
- 檔案：修改 `public/js/board_items.js`、`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/bullet_absorbed_items_qa.js`、`docs/POSTGAME_BOSS_RELICS.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`；新增正式／來源圖、`scripts/bullet_arsenal_qa.js`、`scripts/generate_item_catalog.js`、`docs/ITEM_CATALOG.md`、`docs/BULLET_ARSENAL_IMAGEGEN_PROMPT.md` 與 QA 截圖。正式 query 為 `20260824-bullet-arsenal-v1`。
- 驗證：五份修改／新增 JavaScript `node --check` 通過，`npm start` 於 8787 正常提供正式頁；武器庫專項 QA 14 項規則、1600×900 與 932×430 UI 皆為 `errors=[]`、`failures=[]`。更新後巴雷特六孔／最高傷害回歸與既有巴雷特不屈／九尾／受擊順序回歸也全數 `failures=[]`。道具清單產生器確認 207 個 id 各只出現一次、五類總數相符、所有取得方式非空且 113 件一般商店品價格皆大於 0；正式圖與兩張 UI 截圖已人工檢查。

## 修改紀錄：目前回合船形呼吸光 V297（2026-08-24）

- 使用者修正：撤除 V296 的圓形呼吸環，改由目前可操作船的透明船圖本身套用金白色與玩家船色的 `drop-shadow` 呼吸光；發光依船帆、船身與桅杆透明輪廓延伸，不再形成固定圓框，玩家名稱牌與航線不參與發光。
- 操作／相容：仍只在既有 `current.actionable` 成立時播放，滑入／聚焦會加快節奏，減少動態偏好保留靜態船形描邊；不可操作時完全停止。沒有修改船圖、船 token 點擊、回合、位置、同步或存檔。正式主頁 query 更新為 `20260824-current-ship-silhouette-glow-v144`。
- 檔案：修改 `public/board_game.html`、`scripts/ship_turn_breathing_glow_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：重跑 `node --check`、1600×900／932×430 船形發光 QA、原指令盤點擊、解析鎖、減少動態模式與 overflow；結果記錄於 `tmp/ship_turn_breathing_glow_qa/`。

## 修改紀錄：目前回合船呼吸燈 V296（2026-08-24）

- 顯示規則：地圖上只有同時具備既有 `current` 與 `actionable` 狀態的船，才在船身周圍顯示金色搭配玩家船色的 1.65 秒呼吸光圈；滑鼠移入與鍵盤聚焦時會加亮，提示可點擊並開啟原船長指令盤。
- 防誤導：移動、骰子、事件、彈窗、戰鬥、解析鎖或 LAN 非本機控制等使船隻暫時不可操作時，仍可保留目前回合標記，但不顯示呼吸燈。偏好減少動態效果的裝置改為靜態亮環，不持續縮放。
- 相容：只讀既有船 token 的 `current`／`actionable` class 與 `--ship-color`，沒有修改回合權威、點擊事件、地圖位置、玩家／船隻 id、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。正式主頁 query 更新為 `20260824-current-ship-breathing-glow-v143`。
- 檔案：修改 `public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`；新增 `scripts/ship_turn_breathing_glow_qa.js`。
- 驗證：`node --check public/js/board_game.js` 與新 QA 腳本通過；`npm start` 於 8843 正常提供正式頁，未設定 `DATABASE_URL` 的警告為既有開發環境狀態。Chrome QA 於 1600×900／932×430 均為 `errors=[]`、`failures=[]`，確認只有一艘目前可操作船顯示 84px 呼吸環、點擊可開原船長指令盤、`resolutionLock` 時保留目前船但移除 actionable／呼吸燈，且頁面無 overflow；兩張截圖已人工檢查光圈包住船身且未遮擋名稱與航線。

## 修改紀錄：共鬥提取／結算延至本人回合 V295（2026-08-24）

- 回合規則：共鬥勝利後只讓目前大富翁回合的參戰者處理自己的血統因子提取並查看結算；其他真人參戰者各自保存一份待結算結果，輪到本人的地圖回合才自動重新開啟。觀看方與尚未輪到的參戰者不顯示提取頁或獎勵結算，也不能送出提取、放棄或完成戰鬥指令。
- 回合續行：延後結果使用原戰鬥頁與原血統抽取介面；本人確認後回到地圖並繼續同一回合，不呼叫 `endTurn()`。若同一玩家累積多場待結算，依序處理後才進入原本的待續戰鬥、肉球轉送、技能學習或共鬥後服務島選擇。
- 狀態／相容：新增每位玩家的 `pendingCoopBattleResults` 佇列並在舊存檔載入時正規化；每筆保存原 battle snapshot、個人抽取 entry 與既有共鬥結算預覽，沿用 `BOARD_GAME_STATE` 完整快照，不新增 `gameState` 頂層欄位、localStorage key、Socket.IO event 或 server 欄位。共同獎勵仍只在原戰鬥勝利時發放一次，延後頁只負責本人提取與查看，不會重送貝里、懸賞金、EXP 或道具。
- 顯示：延後頁的完成按鈕改為「回到地圖，繼續本回合」；共鬥勝利時忽略手動共鬥視角切換，只顯示目前結算者。正式主頁／戰鬥頁 query 為 `20260824-coop-result-own-turn-v142`／`v95`。
- 檔案：修改 `public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`；新增 `scripts/coop_deferred_result_turn_qa.js`。
- 驗證：三份 JavaScript `node --check` 通過；`npm start` 於 8842 正常提供靜態頁（未設定 `DATABASE_URL` 的 DB 警告為既有開發環境狀態）。新 QA 為 `errors=[]`、`failures=[]`，驗證三名真人拆分待結算、非本人回合雙重鎖定、本人回合自動開啟、抽取選擇、完成後不換回合、獎勵不重送及第三人佇列保留。既有共鬥視角、Tot Musica 玩家分世界、刷新恢復與三裝置 LAN 單獨重跑皆通過；血統敵卡 QA 的伽治正式流程與 12 名 Boss 通過，仍回報既有 Tot Musica 專用舞台使敵卡中心點不是最上層的 1 項檢查，與本次回合／同步修改無關。

## 修改紀錄：奇偶骰子與交棒海賊旗 V294（2026-08-24）

- 新戰鬥道具：新增 `odd_dice`「單數骰子」與 `even_dice`「雙數骰子」。使用時仍從既有「道具」指令進入，再於原資訊框內選擇我方或敵方；接下來 2 次該側行動的第一顆戰鬥骰固定只從單數或雙數合法骰面抽取，第二／第三顆追加骰不受影響。同側再次使用會以新奇偶覆蓋舊效果並重設為 2 次，HUD 狀態圖示顯示目前奇偶與剩餘次數。
- 新角色攜帶物：暫定名 `relay_pirate_flag`「交棒海賊旗」。持有者確實完成攻擊、使用道具或澤法解除行動，且敵我本輪都結算完後，開啟既有替補清單讓玩家選擇存活船員；持有者不會瀕死、道具不會消耗。手動換人、持有者已倒下／已被其他機制換下或沒有存活後備時不觸發。
- Boss／多人相容：奇偶效果保存於既有 battle snapshot；我方效果依玩家 id 分開、敵方效果共用。Tot Musica 單人雙世界與玩家分世界介面都保留 `targetSide`；交棒旗在 Tot 戰只沿持有者所屬世界既有順位自動換上下一名存活船員，不能跨世界。KING 仍只讀被控制後的第一骰並延至下一回合切換背火。沒有新增第五顆主指令、`gameState` 頂層欄位、localStorage key、Socket.IO event 或 server 欄位。
- 素材：以 ImageGen 分別產生三張獨立 1:1 海賊 RPG 道具圖，原始 1254×1254 PNG 保存於 `public/images/board/items/incoming/`，正式頁使用黑底不透明 1024×1024 WebP `odd_dice.webp`、`even_dice.webp`、`relay_pirate_flag.webp`；既有素材未被覆蓋。
- 取得：兩顆奇偶骰加入道具商店與進階補給池；交棒海賊旗加入道具商店與寶藏池。正式 query 為道具資料 `20260824-parity-dice-relay-flag-v3`、主頁 `v141`、戰鬥頁 `v94`。
- 檔案：修改 `public/js/board_items.js`、`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`；新增三張正式 WebP、三張 `incoming` 原始 PNG 與 `scripts/battle_parity_dice_relay_flag_qa.js`。
- 驗證：四份 JavaScript `node --check` 通過；`npm start` 於 8842 正常提供靜態頁（未設定 `DATABASE_URL` 的 DB 警告為既有開發環境狀態）。新道具 QA 為 `errors=[]`、`failures=[]`，涵蓋定義／商店／事件池、兩次第一骰奇偶、覆蓋重設、追加骰不套用、正式選邊按鈕可見、四顆主指令、Tot Musica `targetSide`／同世界交棒、完整敵我一輪後交棒、無後備／已換下／手動換人保護、1440×900／932×430 與圖片 HTTP。KING、Tot Musica 玩家分世界／反擊、十三 Boss、刷新恢復及三裝置 LAN 回歸均通過；`tot_musica_full_dual_qa.js` 的戰鬥與雙世界流程完成，但仍回報既有分隊名冊可見圖為 5/6 的單一素材檢查，與本次三個新道具無關。

## 修改紀錄：KING 背火狀態視覺 V293（2026-08-23）

- 顯示：KING 戰鬥時不再只靠敵方狀態列的 36×36 機制圖示辨認背火。敵方角色框現在常駐顯示「背火點燃・火焰防護」或「背火熄滅・輸出窗口」，敵方 HUD 也同步顯示同一狀態；小圖示角標由「火／速」改成更直接的「燃／熄」。
- 狀態差異：點燃時角色框使用橘紅火光、浮動餘燼與暖色邊框；熄滅時原立繪以冷色壓暗、灰燼與速度線呈現高速型態。效果全部是獨立 CSS 疊層，沒有修改、覆蓋或重製 KING 既有七張戰鬥立繪。
- 切換與受擊：只有 `flameOn` 在同一場戰鬥中真正改變時，才於下一回合狀態套用後播放「背火燃起／背火熄滅」動畫與對應音效；首次載入、重整與相同快照重繪不重播。玩家攻擊點燃中的 KING 時，正式 attack visual event 會標記 `kingFlameGuarded`，命中位置播放「火焰防護」護盾脈衝，讓低傷害不會看起來像計算錯誤。
- 隱藏與範圍：常駐狀態、切換大字與受擊提示都不公開奇偶、第一顆骰或 10% 數值；玩家仍需自行把 KING 顯示過的骰面與下一回合狀態連起來。只修改 `postgame_king` 顯示與既有 attack visual event 附加資料，不新增第五顆按鈕、戰鬥指令、`gameState` 頂層欄位、localStorage key、Socket.IO event 或 server 欄位，也不影響 KING 佩刀被巴雷特吸收時的效果。正式主頁／戰鬥頁 query 為 `20260823-king-flame-state-v140`／`v93`。
- 檔案：修改 `public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/king_hidden_parity_qa.js`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`board_game.js`、`board_battle.js` 與 `king_hidden_parity_qa.js` 的 `node --check` 通過。1440×900／932×430 定向 QA 的 `errors=[]`、`failures=[]`，覆蓋點燃／熄滅常駐狀態、燃／熄角標、兩種切換動畫、火焰防護受擊脈衝、100／1000 傷害與 visual metadata、隱藏資訊、圖片、文字與角色框越界；截圖人工檢查確認桌機與平板四顆指令未受影響。十三 Boss 整體回歸亦為 `errors=[]`、`failures=[]`，正式主頁在瀏覽器載入新版 query 且無 console error。

## 修改紀錄：KING 隱藏奇偶背火 V292（2026-08-22）

- 規則：KING 開場背火點燃；每次完成行動後只記錄該次第一顆骰，奇數排定下一回合點燃、偶數排定下一回合熄滅。排定狀態跟隨既有 Boss battle snapshot，到下一回合開始才套用；追加骰與總和不參與，舊的丹弓皇固定熄火與玩家技能後自動點火已移除。
- 數值：背火點燃時，玩家直接傷害由保留 35% 改為只保留 10%；背火熄滅時仍承受完整傷害，並保留既有速度 ×1.35、攻擊／特攻 ×1.18、造成傷害 ×1.20。
- 隱藏資訊：正式登島情報、機制面板與狀態文字不出現奇數、偶數、第一顆骰、10%、35% 或丹弓皇提示，只說明背火會在回合間變化並顯示當下「點燃／熄滅」；戰鬥骰本身照常顯示，讓玩家自行觀察下一回合狀態找出規律。
- 相容與範圍：只修改 `postgame_king` 的 Boss 狀態、傷害規則與顯示文案；不修改 KING 佩刀被巴雷特吸收時的攜帶物效果，也不影響其他 Boss、四顆戰鬥指令、`gameState` 頂層欄位、localStorage key、Socket.IO event 或 server 欄位。舊 King 戰鬥快照保留當下背火狀態並移除舊窗口旗標。正式主頁／戰鬥頁 query 為 `20260822-king-hidden-parity-v139`／`v92`。
- 檔案：修改 `public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/postgame_boss_mechanics_qa.js`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`；新增 `scripts/king_hidden_parity_qa.js`。
- 驗證：`board_game.js`、`board_battle.js`、新 QA 與更新後十三 Boss QA 的 `node --check` 通過。1440×900 與 932×430 定向 QA 均為 `errors=[]`、`failures=[]`：總和為奇數但第一骰 2 時下一回合熄火；總和為偶數但第一骰 3 時下一回合點火；狀態在同回合不提前改變；1000 傷害於點燃／熄滅時分別結算 100／1000；玩家面板沒有洩漏隱藏規則、破圖或溢出。十三 Boss 整體回歸更新 King 正式預期後亦為 `errors=[]`、`failures=[]`。

## 修改紀錄：巴雷特吸收道具結算、不屈與九尾幻化 V291（2026-08-20）

- 問題：巴雷特承受直接攻擊時，舊流程先破壞骰面對應孔位，再遍歷仍生效孔位結算受擊效果，導致剛好被打中的衝擊貝、反傷與其他受擊型道具跳過自己的最後一次效果；傑爾馬66戰鬥服也可能在致命傷處理前先失效。九尾幻面雖已有克制屬性換算，但戰鬥畫面沒有明確發動提示，玩家看起來像完全沒發動。
- 修正：巴雷特的同次直接命中改為先結算當下仍在六孔內的受擊效果，再破壞第一骰對應孔位並歸還道具；一次性使用狀態與儲存量一併歸還，不因換回持有人重置。戰鬥服在致命傷落地前發動「不屈」、本次傷害歸零並提高防禦／速度；即使傷害歸零，這次已成功命中的攻擊仍依骰面破壞一個孔位。
- 顯示：致命傷被擋時在受擊位置顯示「不屈」，六孔資料卡持續顯示「待命／已發動」，已破壞歸還後也保留本場使用狀態。巴雷特持有戴彭九尾幻面時，攻擊會轉為目前目標的克制屬性，戰鬥訊息、敵方效果提示、紀錄與六孔詳情都顯示「九尾幻化」及克制關係。
- 相容與範圍：六孔結算順序與九尾提示只在 `postgame_douglas_bullet` 啟用；一般戰鬥只補上既有傑爾馬66戰鬥服的不屈視覺。沒有新增道具／Boss id、第五顆按鈕、`gameState` 頂層欄位、localStorage key、Socket.IO event 或 server 欄位。正式主頁／戰鬥頁 query 為 `20260820-bullet-item-activation-v138`／`v91`。
- 檔案：修改 `public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`；新增 `scripts/bullet_item_activation_qa.js`。
- 驗證：`board_game.js`、`board_battle.js` 與新 QA 的 `node --check` 通過。1440×900 與 932×430 定向 QA 均為 `errors=[]`、`failures=[]`：確認不屈擋下致命傷、只消耗一孔的一次性效果、骰面孔照常破壞、六孔待命／已發動狀態、九尾幻化轉為克制屬性且屬性倍率為 ×2、六個衝擊貝先各儲存傷害再破壞命中孔。既有巴雷特重複裝備／最高傷害 QA 與十三 Boss 整體回歸亦為 `failures=[]`。

## 修改紀錄：Tot Musica 單人反擊銜接與受阻提示 V290（2026-08-20）

- 問題：單人固定普通攻擊重現時，玩家先攻後的 Tot Musica 反擊本身可正常執行；但 Boss 被冰凍、束縛或麻痺判定擋住時，原專用流程只有戰鬥紀錄，雙世界舞台沒有任何演出便直接進下一輪，玩家會看到「打完後她沒攻擊」且不知道原因。另外玩家雙世界行動後沒有一個 Tot 專屬反擊前整理點，舊／異常快照若誤留通用 replacement 或失效敵方指令，可能在第二行動前提前中止。
- 修正：玩家先攻且 Tot Musica 未被擊倒時，先用她自己的雙世界前線規則整理存活者、清除不應攔截此 Boss 的通用 replacement，並確認待執行敵方招式仍有效；Boss 已死亡、逃跑成功或任一世界全滅仍維持原本終止結果，不會強制補打。單人與多人玩家分世界都沿用同一個 Boss 專用保護，不改一般戰鬥回合器。
- 顯示：Tot Musica 因冰凍／束縛／麻痺無法行動時，仍在雙世界專用舞台顯示 Boss、受阻原因及左右「本輪未受攻擊」，停留後才進下一輪；這是既有狀態阻止行動的可視化，不取消控制招式效果，也不偽造傷害。
- 相容與範圍：只修改 `postgame_tot_musica` 的玩家行動後整理、敵方受阻事件與戰鬥頁對應演出；沒有新增角色／招式／Boss id、第五顆按鈕、`gameState` 頂層欄位、localStorage key、Socket.IO event 或 server 欄位。正式主頁／戰鬥頁 query 為 `20260820-tot-musica-counterattack-v137`／`v90`。
- 檔案：修改 `public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`；新增 `scripts/tot_musica_counterattack_qa.js`。
- 驗證：`board_game.js`、`board_battle.js` 與新 QA 的 `node --check` 通過。單人受阻定向 QA 在 1440×900 與 932×430 均為 `errors=[]`、`failures=[]`，確認冰凍原因、Boss 可見、左右未受攻擊、無橫向／文字溢出且正常進第二輪；單人完整實戰確認無異常狀態時玩家先攻後 Tot Musica 仍接續擲骰、向下攻擊、左右各自扣血與同世界自動替補，`errors=[]`、`failures=[]`。三玩家分世界 QA、十三 Boss 整體回歸及刷新恢復亦通過。

## 修改紀錄：Tot Musica 多人分世界共鬥 V289（2026-08-20）

- 分隊：單人挑戰維持把自己的存活船員分成現實／歌世界；共鬥達 2 名玩家時改為分配「玩家」，每名玩家的整隊船員固定留在同一世界。既有分隊會保留，新加入者自動編入玩家數較少的一邊；兩邊同人數時先補現實世界。
- 操作：每個世界只由目前前線玩家操作自己的船員與道具。現實世界先選、完整快照交棒給歌世界後再選，兩邊指令齊備才共用一次 Tot Musica／Boss 判定；仍沿用原本攻擊、夥伴、道具、逃跑四顆指令，不新增第五顆按鈕或獨立同步事件。
- 接替與敗北：角色倒下先由該玩家自己的存活船員自動接替；該玩家全隊倒下或撤離時，才由同世界下一名仍可戰鬥的玩家接棒。只有現實或歌世界的所有玩家都無法戰鬥時，才因雙世界無法維持而整場敗北；不進入通用單角色 replacement。
- 先攻：同步行動的有效速度改取兩名目前出戰者中的較快者，行動優先度取兩個已選行動中的較高者；仍先比較優先度，再比較有效速度，同值由玩家先手。Boss HP、樂章、奇偶同步、動畫與命中位置維持共用。
- 狀態與相容：玩家世界、前線游標、目前待選世界及兩邊暫存行動都保存在既有 battle `postgameBossMechanic`，跟隨完整 `BOARD_GAME_STATE` 快照；沒有新增 `gameState` 頂層欄位、localStorage key、Socket.IO event 或 server 欄位。改動只在 `postgame_tot_musica` 且共鬥至少 2 人時啟用，其他 Boss 仍走原共鬥。
- 檔案：修改 `public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/tot_musica_full_dual_qa.js`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`；新增 `scripts/tot_musica_player_world_coop_qa.js`。正式主頁／戰鬥頁 query 為 `20260820-tot-musica-player-world-coop-v136`／`v89`。
- 驗證：四份本輪 JavaScript `node --check` 通過，`npm start` 於 8797 正常提供頁面。多人定向 QA 在 1600×900 與 932×430 均為 `errors=[]`、`failures=[]`，確認三名玩家分為 2＋1、新玩家補較少世界、完整六人船員隊不拆分、現實選完交棒歌世界、四顆指令不增生、較高優先度、較快有效速度、同玩家自動替補、同世界下一玩家接替及單世界全滅敗北。單人 Tot 完整實戰、十三 Boss 面板、傷害跳字、刷新恢復亦通過；三裝置 LAN 多入口回歸的房主／平板／手機 seed、版本、身分與選角控制一致，`errors=[]`、`failures=[]`。

## 修改紀錄：Tot Musica 換人、先攻與連續攻擊鏡頭 V288（2026-08-20）

- 規則：任一世界的目前船員倒下，依雙世界開戰編排自動換上該世界下一名存活船員；若現實世界或歌世界整隊倒下且無法立即復活，才判定挑戰失敗。先攻速度改取兩名出戰者套用狀態、攜帶物及隊伍效果後的較慢值，行動優先度亦採兩邊較低者。
- 修正：Tot 專屬自動補位完成後同步清除通用 `replacement`／`needsReplacement` 並保存 coop runtime，避免死亡先發在下一輪被通用輪詢重新開啟一般替補。玩家先攻且 Boss 接著行動時，戰鬥頁維持高處視角直接接 Boss 骰鏈，不再回到玩家舞台後重爬；Boss 先攻仍保留原升鏡。
- 命中：我方合擊光束與爆點重新對準 Boss 中心並置於 Boss 前景；敵方紅紫雙路箭頭終點改為左右船員中心，桌機與手機均依相同比例落位。所有改動只在 `postgame_tot_musica`／`tot-dual` 生效，沒有新增按鈕、存檔欄位、localStorage key、Socket.IO event 或 server 狀態。
- 檔案：修改 `public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/tot_musica_full_dual_qa.js`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式主頁／戰鬥頁 query 為 `20260820-tot-musica-turn-camera-hit-v135`／`v88`。
- 驗證：三份 JavaScript `node --check` 通過；`npm start` 於 8796 正常提供主頁與戰鬥頁。Tot 完整 Chrome QA 在 1600×900 與 932×430 均為 `errors=[]`、`failures=[]`：較慢邊決定先攻、玩家→Boss 連續高處視角沒有選招畫面或重複升鏡、我方爆點距 Boss 中心約 6～8px、敵方箭頭落在兩名船員範圍、首名倒下後同隊第二順位自動補位，第二回合可繼續擊倒 Boss 並完成血統決定、掉落揭露與返回。十三 Boss 面板、通用傷害跳字、刷新恢復均通過；三裝置 LAN QA 第一次同時加入超過既有 12 秒等待，立即重跑後房主／平板／手機的 seed、版本、身分與選角控制一致，`errors=[]`、`failures=[]`。

## 修改紀錄：澤法炸藥岩倒數縮短為 4 V286（2026-08-20）

- 規則：澤法最後終結點的起始倒數由 6 次敵方行動改為 4 次；每次澤法完成行動仍減少 1，歸零仍立即引爆並攻略失敗。解除規則維持保底 +1、骰 5／6 為 +2、累積 3 點完成。
- 相容：新戰鬥直接以 4／4 開始；舊待續快照若仍保存 5 或 6，載入時會壓到 4，已剩 1～4 的戰鬥保留原剩餘值。半血轉黑腕後炸藥岩仍存在、倒數繼續，只有真正解除才停止。
- 範圍：只修改 `postgame_zephyr` 倒數常數、提示文字、快取版本、QA 與文件；2000 HP、1000 HP 黑腕線、左側場上炸藥岩、四顆 2×2 指令、其他 Boss 與一般戰鬥不變。正式主頁／戰鬥頁 query 為 `20260820-zephyr-countdown-four-v133`／`v86`。
- 檔案：修改 `public/js/board_game.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/postgame_zephyr_end_point_qa.js`、`scripts/postgame_boss_mechanics_qa.js`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：四份相關 JavaScript `node --check` 通過，正式主頁／戰鬥頁 HTTP 200 且載入 V133／V86。澤法定向 Chrome QA 在 1600×900 與 932×430 為 `ok=true`、`errors=[]`、`failures=[]`，確認 4／4 起始、每次行動減 1、四次歸零引爆、半血黑腕後仍顯示倒數 4、解除照常完成，以及舊 6→4 快照轉換。十三 Boss 回歸首次遇到既有圖片未及解碼的時序失敗，五個列出素材逐一 HTTP 200；立即重跑為 `bossCount=13`、`errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/08/19/01a0185f-258e-73f0-817a-35e162778d0d/zephyr_countdown_four_v286/` 與同層 `postgame_boss_mechanics_v286_rerun/`。

## 修改紀錄：澤法 2000 HP 與黑腕階段炸藥岩持續 V285（2026-08-19）

- 問題：澤法原始資料雖寫 1480 HP，但通用 Lv.99 平衡後實戰只剩約 986 HP；玩家一次重擊便容易碰到半血線。半血轉黑腕的舊函式同時把 `dynaRockDisarmed` 設為 true、進度補成 3／3，讀取快照時又把所有第二階段強制視為已解除，因此玩家只是攻擊澤法，左側炸藥岩就直接消失。
- 修正：全新澤法挑戰固定以 2000／2000 HP 進場；舊待續戰鬥升到 2000 最大 HP 時按原 HP 比例換算，不補滿傷勢。第一階段傷害仍最低停在 1000 HP，達半血只切換黑腕圖與招式，不再改動炸藥岩進度、解除旗標或倒數。
- 選擇：只要炸藥岩尚未解除／引爆且戰鬥未結束，黑腕階段仍在澤法左側顯示同一顆場上炸藥岩，玩家可繼續選擇解除或直接攻擊澤法；只有解除確實到 3／3 才停止倒數並隱藏。若持續攻擊但未擊敗澤法，倒數仍會隨澤法行動遞減，歸零照常攻略失敗。
- 存檔相容：`POSTGAME_ZEPHYR_MECHANIC_VERSION` 升為 3。V2 快照若是半血轉階造成的錯誤自動解除，會依既有解除紀錄恢復實際進度並重新啟動原剩餘倒數；含「最後的炸藥岩解除成功」紀錄的真正解除則保持完成。沿用完整 battle snapshot，不新增 localStorage 或 Socket.IO 欄位。
- 範圍：只修改 `postgame_zephyr` 的 HP 覆寫、轉階、正規化與炸藥岩可見／可操作條件；四顆共用指令、2×2 排版、其他十二名 Boss、一般戰鬥與玩家傷害公式不變。正式主頁／戰鬥頁 query 為 `20260819-zephyr-bomb-persist-v132`／`v85`。
- 檔案：修改 `public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/postgame_zephyr_end_point_qa.js`、`scripts/postgame_boss_mechanics_qa.js`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：四份本輪 JavaScript `node --check` 通過；`npm start` 於 8794 正常提供靜態頁（未設定 `DATABASE_URL` 的 DB 警告為既有開發環境狀態）。澤法定向 Chrome QA 為 `ok=true`、`errors=[]`、`failures=[]`：驗證 2000／2000、2500 輸入被截為 1000 傷害、半血後黑腕＋炸藥岩同時顯示、仍可解除、第二階段倒數 0 敗北、V1→V3 及錯誤 V2 半血快照恢復；1600×900 與 932×430 均無越框。十三 Boss 回歸為 `bossCount=13`、`errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/08/19/01a0185f-258e-73f0-817a-35e162778d0d/zephyr_bomb_persist_v285/` 與同層 `postgame_boss_mechanics_v285/`。

## 修改紀錄：澤法場上炸藥岩雙目標選擇 V284（2026-08-19）

- 操作：澤法第一階段把炸藥岩直接放在敵方卡框左側並跨住左邊框，作為獨立場上目標。玩家可點擊炸藥岩，直接消耗本次行動並走既有 `battleZephyrDisarm`／`zephyr-disarm` 權威流程；若要攻擊澤法，仍使用原本「攻擊」按鈕與招式清單。
- 範圍：機制面板內的終結點Ⅲ改回純狀態卡，不再可點；共用戰鬥指令仍只有攻擊、夥伴、道具、逃跑四顆與固定 2×2。場上按鈕及敵方框 `overflow: visible` 只在 `postgame_zephyr` 第一階段、倒數有效且炸藥岩未解除／未引爆時啟用，第二階段與其他 Boss 不渲染。
- 素材：依使用者提供的電影畫面，以內建 ImageGen 產生粉紅液體金屬圓筒炸藥岩；原始 1024×1536 透明 PNG 存於 `public/images/board/battle/postgame_mechanics/postgame_zephyr/incoming/dyna_stone_cylinder_source_v2.png`，正式 512×768 透明 WebP 為上一層 `dyna_stone_cylinder_v2.webp`（84,568 bytes）。
- 檔案：修改 `public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/postgame_zephyr_end_point_qa.js` 與 Boss／規則／流程文件；新增上述兩份素材。正式主頁／戰鬥頁 query 為 `20260819-zephyr-field-target-v131`／`v84`。
- 驗證：四份本輪 JavaScript `node --check` 通過；`npm start` 測試服務的主頁、戰鬥頁與正式炸藥岩素材皆為 HTTP 200。澤法定向 Chrome QA 在 1600×900 與 932×430 都為 `ok=true`、`errors=[]`、`failures=[]`，確認場上目標跨住敵方框左緣、位於 viewport 內、命令只送一次、機制面板不再可點、解除／轉階後目標隱藏，且四顆主指令仍為 2×2。十三 Boss 回歸另驗證炸藥岩只在 `postgame_zephyr` 顯示，結果為 `bossCount=13`、`errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/08/19/01a0185f-258e-73f0-817a-35e162778d0d/zephyr_field_target_v284/` 與同層 `postgame_boss_mechanics_v284/`。

## 修改紀錄：澤法阻止引爆移回專屬面板 V283（2026-08-19）

- 問題：V282 把「阻止引爆」做成共用戰鬥指令區的第五顆按鈕，並把原本 2×2 指令格臨時切成三欄，會改動所有戰鬥共用的排版結構；這超出只調整澤法 Boss 戰的範圍。
- 修正：完全移除第五顆靜態按鈕、`has-zephyr-action` 三欄樣式、動態顯示邏輯與額外確認頁。攻擊、換人、道具、逃跑恢復固定四顆與原本 2×2 排列；只有澤法專屬機制面板內的「終結點Ⅲ」在倒數有效時可點擊，點下後直接沿用既有 `zephyr-disarm` 權威指令並消耗本回合。
- 隔離：新增的可點擊卡片只由 `postgame_zephyr` 且 `state.canDisarm` 時渲染；其他 Boss、一般戰鬥、Tot Musica 專用操作、共同指令 DOM、戰鬥數值、回合、CPU、battle snapshot、localStorage key 與 Socket.IO event 均不改。
- 檔案：修改 `public/js/board_battle.js`、`public/board_battle.html`、`public/js/board_game.js`、`public/board_game.html`、`scripts/postgame_zephyr_end_point_qa.js`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式主頁／戰鬥頁 query 為 `20260819-zephyr-panel-action-v130`／`v83`。
- 驗證：三份 JavaScript `node --check` 通過；正式 `npm start` 服務的主頁、戰鬥頁與炸藥岩素材皆為 HTTP 200 並載入 V130／V83。澤法定向 Chrome QA 在 1600×900 與 932×430 均為 `ok=true`、`errors=[]`、`failures=[]`，兩種尺寸都確認主指令僅有 `attack`／`partners`／`items`／`escape` 四顆、欄列各 2、沒有 `has-zephyr-action`，且點擊終結點Ⅲ只送出一次既有解除命令。十三 Boss 整體機制回歸另為 `bossCount=13`、`errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/08/19/01a0185f-258e-73f0-817a-35e162778d0d/zephyr_panel_action_v283/` 與同層 `postgame_boss_mechanics_v283/`。

## 修改紀錄：澤法最終終結點阻止戰 V282（2026-08-19）

- 正名與情境：正式顯示名由 `Z／捷風` 統一為「澤法」，但 Boss 穩定 key `postgame_zephyr`、島嶼配置、掉落物 id、localStorage key 與 Socket.IO event 均不改。戰鬥改為電影 Z 的最終終結點阻止戰：終結點Ⅰ、Ⅱ已毀，終結點Ⅲ從 6 次敵方行動開始引爆倒數，歸零立即攻略失敗。
- 玩家反制：第一階段新增「阻止引爆」指令，消耗一次行動並保證解除 +1，骰到 5／6 為 +2，累積 3 點便解除炸藥岩、停止倒數並切入黑腕決戰；CPU 也會在倒數存在時優先解除。直接攻擊可把澤法打到 50% HP 後轉階，但第一階段不會越過半血直接擊倒。
- 原作性格：保留 Battle Smasher 指定招式的海樓石捕獲，能力者被命中後跳過下一次行動；黑腕階段加入「教官的看破」，同一名船員連續重複相同直接攻擊時只保留 65% 傷害。轉階時重新選擇符合新招式表的待執行敵方指令，載入時不重置招式 PP。
- UI 與素材：戰鬥頁新增三張終結點卡、6 次倒數、3 點解除進度、專屬「阻止引爆」按鈕與確認面板。以內建 ImageGen 的 `stylized-concept` 模式生成單顆透明炸藥岩；原始 1254×1254 PNG 存於 `public/images/board/battle/postgame_mechanics/postgame_zephyr/incoming/dyna_stone_source_v1.png`，正式 512×512 透明 WebP 為同目錄上一層的 `dyna_stone_v1.webp`。
- 存檔相容：`POSTGAME_ZEPHYR_MECHANIC_VERSION` 升為 2；舊版 `heat`／`armor`／`overheat` 快照正規化為 6 次倒數與 0／3 解除進度並移除舊欄位。完整 battle snapshot 仍由既有 `BOARD_GAME_STATE` 推送／套用，不新增獨立儲存來源。
- 檔案：修改 `public/js/board_game.js`、`public/js/board_battle.js`、`public/js/board_items.js`、`public/js/onepiece_prebattle_lines.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/prebattle_dialogue_quality_qa.js`、`scripts/postgame_boss_mechanics_qa.js`、相關專案文件；新增 `scripts/postgame_zephyr_end_point_qa.js` 與上述兩個炸藥岩素材。
- 驗證：本輪 JavaScript `node --check` 與進場台詞品質 QA 通過；定向 Chrome QA 在 1600×900 與 932×430 均為 `ok=true`、`errors=[]`、`failures=[]`，確認正式名稱、三終結點、圖片載入、專屬按鈕／確認面板、2→+1、6→+2、3／3 解除、倒數 0 敗北、50% HP／解除兩條黑腕轉階、重複招式 100→65、舊名稱與 V1 快照轉換。十三 Boss 整體機制回歸另為 `bossCount=13`、`errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/08/19/01a0185f-258e-73f0-817a-35e162778d0d/zephyr_end_point_v282_final/` 與同層 `postgame_boss_mechanics_v282_final/`。

## 修改紀錄：泰佐洛三段金流改用一般換人介面 V281（2026-08-19）

- 問題：存活角色被泰佐洛第三次命中、金流到 3／3 時，戰鬥頁會優先開啟「金流完全淹沒・強制替補」專用圖片卡；實際需求只要沿用一般角色替補的純文字清單。
- 修正：`postgameBossMechanicView()` 不再建立 `tesoro_forced_switch` 圖片提示，戰鬥頁也移除該專用渲染分支；3／3 仍建立既有 `replacement`，直接由 `renderReplacement()` 顯示名稱、等級、屬性、HP 與 PP。一般 `battleChooseReplacement` 現在同時負責清除退場角色的泰佐洛金流、取消專屬旗標並維持下回合才行動；舊快照若只有 `forcedSwitch`，也會先正規化成一般 replacement 再完成換人。
- 相容與範圍：只改換人入口與相容處理；第三擊取消未執行指令、當回合選人、退場清流、下回合行動、致死第三擊走一般倒下、Golden Tesoro 40% 承傷均不變。沒有新增或改名 battle／`gameState` 欄位、資料 id、localStorage key、Socket.IO event 或 server 格式；正式主頁／戰鬥頁 query 為 `20260819-tesoro-ordinary-replacement-v128`／`v81`。
- 檔案：修改 `public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/battle_attribute_tesoro_scope_qa.js`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：三支 JavaScript `node --check` 通過；正式 8787 `npm start` 服務的 `board_game.html`、`board_battle.html` 均為 HTTP 200 並載入 V128／V81。Chrome 1600×900、932×430 定向 QA 均為 `ok=true`、`failures=[]`、`errors=[]`；兩種尺寸的 3／3 畫面皆有 5 個一般替補按鈕、圖片數 0、專用提示數 0。實際以 `battleChooseReplacement` 換人後索引切到 1、原角色金流／控制歸零、`forcedSwitch`／replacement 清空；V2 舊狀態亦可用一般指令完成。證據位於 `tesoro_ordinary_replacement_v281/`。

## 修改紀錄：泰佐洛致死第三擊不觸發金流替補 V280（2026-08-19）

- 問題：泰佐洛的傷害會先把目前船員 HP 扣到 0，之後 `postgameBossMechanicAfterMove()` 仍替該船員追加第 3 段金流，導致一般倒下流程被「金流完全淹沒・強制替補」覆蓋。
- 修正：`postgameTesoroSetControl()` 現在只替結算後仍存活的船員增加金流。若第三次命中同時使 HP 歸零，金流維持原本 2／3，不建立 `forcedSwitch`、`tesoro-gold` replacement 或金流淹滿提示，改由既有一般擊倒／替補流程接手；若角色經既有被動復活後仍存活，則照常增加金流。舊快照若已保存「死亡角色＋`tesoro-gold`」狀態，正規化時會移除專屬原因並保留一般 replacement。
- 相容與範圍：存活角色承受第三次命中時仍會 3／3 並在同一回合強制替補；第一／Golden Tesoro 兩階段、3000 HP、40% 承傷、傷害、回合、CPU、battle snapshot、機制版本 4、localStorage key 與 Socket.IO event 均未改。正式主頁／戰鬥頁 query 為 `20260819-tesoro-lethal-third-hit-v127`／`v80`。
- 檔案：修改 `public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/battle_attribute_tesoro_scope_qa.js`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：三支 JavaScript `node --check` 通過。Chrome 1600×900、932×430 定向 QA 均為 `ok=true`、`failures=[]`、`errors=[]`；存活角色的第 1／2／3 次命中仍為 1／3、2／3、3／3 並正常強制替補，致死第三擊則為 HP 0、金流 2／3、`forced=false`、`needsReplacement=false`、`replacementReason=""`。錯誤舊快照另驗證可轉成 `result="replacement"`、保留原倒下索引且不再顯示 `tesoro_forced_switch`。一般戰鬥隔離、泰佐洛兩階段、三段液面、變身、40% 承傷及第一型態耐久回歸同步通過；證據位於 `tesoro_lethal_third_hit_v280/`。

## 修改紀錄：專案暫存、備份與重複資產清理（2026-08-19）

- 盤點：在 detached HEAD 與大量未追蹤正式檔的前提下，不使用 `git clean`；先依固定目錄、正式頁引用、檔案大小與 SHA-256 清查。確認 `.codex-runtime/`、`tmp/`、`backups/`、`_codex_backups/`、`_restore_backup_*/`、`_codex_artifacts/` 均不是正式執行權威。
- 刪除：移除 `.codex-runtime/` 34,347 檔／4,778.90 MiB、三組本機備份 1,634 檔／970.26 MiB、912 個舊 `tmp/` QA 檔／995.81 MiB、1,390 個未被文件引用的 `_codex_artifacts/` 檔／385.90 MiB、海軍本部 787 個未引用製作幀／766.13 MiB、Board 道具三組 137 個鏡像來源圖／220.87 MiB、54 個已有正式同雜湊副本的 `incoming/` 圖／24.99 MiB，以及 4 個 `_old` 圖、兩份舊交接、兩份「複製.js」與兩個臨時文字檔；合計約 7.95 GiB。
- 保留：`tmp/tot-musica-full-dual-qa/` 保留最新 19 檔／34.26 MiB；`_codex_artifacts/` 保留 13 個文件直接引用證據／13.89 MiB；`incoming/` 保留 586 個沒有相同正式副本的來源檔；頂上戰爭保留正式頁實際引用的 24fps WebP、頂部守衛幀及左右守衛半圖共 4 檔／5.68 MiB。
- 備份：刪除前已將本機 `backups/`、`_codex_backups/`、`_restore_backup_*/` 與 `.codex-runtime` 兩組還原點逐檔和 `D:/Codex_Project_Backups/20260725-before-lineage-factor-full/` 比對；1,659 檔全部 SHA-256 相同，沒有缺檔或差異。D 槽完整專案快照未刪除。
- 防止復發：新增根目錄 `.gitignore`，排除 `node_modules/`、本機 Codex／QA 產物及本機備份／還原目錄；不忽略正式 `public/` 素材或 `incoming/` 原始來源。
- 相容與範圍：未修改遊戲規則、程式入口、資料 id、素材正式路徑、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。`docs/GAME_RULES.md` 不需更新。
- 檔案：新增 `.gitignore`；刪除上述暫存、備份、重複圖與歷史／臨時文件；更新 `docs/NEXT_CHAT_HANDOFF_20260813.md`、`docs/FORMAL_LINEAGE_BATTLE_PARITY_PROMPT_20260728.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：所有核准刪除目標 `Test-Path` 均為 false；`node --check` 通過 `public/js/board_game.js`、`public/js/board_battle.js` 與 `scripts/tot_musica_full_dual_qa.js`。`npm start` 正常在 8787 提供正式頁；`board_game.html`、`board_marineford.html`、海軍本部保留四檔與正式 Board 道具皆為 HTTP 200，被清除的來源影片為 404。Chrome 1440×900 載入兩頁皆無 page error、request failure 或 document overflow；主頁只保留專案原有的 `/favicon.ico` 404，頂上戰爭頁 console error 為 0。清理後 C 槽可用空間為 14.11 GiB。

## 修改紀錄：刷新快速恢復與同步降載 V279（2026-08-19）

- 問題：連線頁刷新時，房間快照內殘留的上一回合 `turn-banner` 會先播放約 2.8 秒才套用快照；同時初始狀態索取每約 0.9 秒重送一次，重送快照又會重設延遲計時器，造成頁面長時間停在讀取房間、CPU／真人卡住及整局同步流量持續增加。
- 修正：初始化取得第一份既有快照時，直接套用遊戲進度並把舊回合提示標為已處理，不重播舊頁面的轉場。正常快速刷新不再改寫 `turnStep`、不額外 `renderAll()`、不顯示房間讀取視窗；只有超過 2.4 秒仍未取得快照才顯示等待說明。狀態索取改為遞增間隔且最多四次，成功、建局、失敗或斷線都會清除本機重試追蹤。
- 相容與範圍：沿用完整 `BOARD_GAME_STATE`、既有 `gameState` 欄位、資料 id、localStorage key 與 Socket.IO event；只調整首次連線／刷新恢復，不修改一般回合同步、戰鬥、泰佐洛或 CPU 規則。正式主頁 query 為 `20260819-refresh-fast-resume-v126`。
- 檔案：修改 `public/js/board_game.js`、`public/board_game.html`、`scripts/refresh_resume_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：兩份 JavaScript `node --check` 通過。Chrome 專屬 QA 加入 2.8 秒舊回合提示，既有房仍在正常等待時間內直接恢復第 460 回合、沒有讀取視窗或殘留重試；房主 CPU 自行完成待續移動並交棒第 461 回合，非房主沒有代跑 CPU。另驗證房主真的無回應時只送四次請求、計時器停止並顯示延遲等待說明；全部 `failures=[]`、`errors=[]`。正式 8787 頁 HTTP 200 且載入 V126；`npm start` 另啟因正式 server 已占用 8787 回報預期的 `EADDRINUSE`。

## 修改紀錄：泰佐洛第一型態耐久修正 V278（2026-08-19）

- 問題：泰佐洛資料原為 1500 HP，但進戰前通用 Lv.99 敵人平衡會把島嶼狀態壓到約 986 HP，半血變身線只剩約 493 HP；第一型態因此常被一次攻擊直接打進 Golden Tesoro。
- 修正：泰佐洛專屬完整 HP 改為 3000；全新挑戰在通用平衡後重新套用 3000／3000，讀取同一場 `pendingBattle` 時不回滿。開場防禦、特防由各 +1 改為各 +2，並在既有被動說明中明示。Golden Tesoro 的半血變身、40% 承傷與金流河規則不變。
- 相容與範圍：只調整 `postgame_gild_tesoro`，沿用既有島嶼、battle snapshot、localStorage key 與 Socket.IO event；一般戰鬥、其他 Boss、玩家傷害公式及刷新後 CPU 續行均未修改。正式主頁 query 為 `20260819-tesoro-first-phase-defense-v125`。
- 檔案：修改 `public/js/board_game.js`、`public/board_game.html`、`scripts/battle_attribute_tesoro_scope_qa.js`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：兩份 JavaScript `node --check` 通過。Chrome 1600×900、932×430 專屬 QA 都確認第一型態為 3000 HP、防禦與特防 +2；模擬承受 1400 點重擊後仍為第一型態、HP 1600、沒有排入變身。既有三段金流、強制替補、Golden Tesoro 變身、第二階段 40% 承傷、普通戰隔離與桌機／手機 UI 回歸全部 `failures=[]`、`errors=[]`。

## 修改紀錄：刷新後 CPU 自動續行 V277（2026-08-19）

- 問題：連線頁刷新時，初始 `BOARD_GAME_STATE` 會連同舊頁面的 `movementAnimating`、`diceRolling`、`resolutionLock`、`battleExitLock` 一起恢復；但產生這些動畫鎖的舊計時器已不存在，輪到 CPU 時便會永久停在等待演出。
- 修正：只有刷新後取得的第一份遠端快照會清除上述四個失效的頁面動畫鎖；真正的 `pendingMove`、路線／交易／共鬥／島嶼選擇與戰鬥快照仍保留。快照套用完成後，僅具 CPU 控制權的房主會重新排一次 CPU 自動步驟。後續一般 LAN 同步仍完整保留當下動畫鎖，不改正常演出時序。
- 相容與範圍：沒有新增或改名 `gameState` 欄位、localStorage key、Socket.IO event 或資料 id；一般真人回合、非刷新同步及泰佐洛專屬戰鬥均未修改。正式主頁 query 為 `20260819-refresh-cpu-resume-v124`。
- 檔案：修改 `public/js/board_game.js`、`public/board_game.html`、`scripts/refresh_resume_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：兩份 JavaScript `node --check` 通過。專屬 Chrome QA 重播既有房刷新、含舊動畫鎖的 CPU 回合刷新、同局非房主觀看與全新房建立；房主 CPU 案由第 460 回合自行完成待續移動並交棒到第 461 回合，四個動畫鎖全部解除、`lastResult` 有值、同步版本 42→43；非房主保持第 460 回合且 `canRun=false`、沒有替 CPU 行動，全部 `failures=[]`、`errors=[]`。

## 修改紀錄：泰佐洛變身前後統一金流河 V276（2026-08-19）

- 規則：泰佐洛第一階段與 Golden Tesoro 全程共用每名船員各自 0～3 段金流。敵方非增益／治療招式每次成功命中固定增加一段；3／3 立即進入同回合替補並取消尚未執行的原指令，替補下回合才出手，退到後排者清空金流。
- 變身：半血仍切換 Golden Tesoro 圖與四招，但不清除金流、不改成共用 -3～+3 戰線，也沒有兩層外殼或第三階段。Golden Tesoro 固定只承受玩家原傷害的 40%，HP 歸零後正常擊倒。
- 相容與範圍：`POSTGAME_TESORO_MECHANIC_VERSION` 升為 4；舊第二階段的正向共用刻度轉入目前角色，舊第三階段回到 Golden Tesoro，舊外殼／必殺旗標歸零。沿用既有 battle snapshot、localStorage key 與 Socket.IO event，只修改泰佐洛專屬權威規則和戰鬥頁狀態顯示。正式主頁／戰鬥頁 query 為 `20260819-tesoro-gold-river-unified-v123`／`v79`。
- 檔案：修改 `public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/battle_attribute_tesoro_scope_qa.js`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：三份本輪 JavaScript `node --check` 通過。Chrome 1600×900、932×430 專屬 QA 為 `ok=true`、`failures=[]`、`errors=[]`；實測變身保留後排角色 2／3 金流、Golden 命中令目前角色 0→1、玩家反擊不降低金流、100 點輸入只承受 40、HP 0 不被外殼救回、一般戰鬥金流隱藏。兩種比例的六人狀態框均在 viewport 內，無舊共用戰線／外殼文字；截圖為 `tesoro_rework_20260818/tesoro_golden_mechanic_detail_{desktop,phone_landscape}.png`。正式頁與戰鬥頁 HTTP 200 且載入新版 query；`npm start` 另啟時因既有正式 server 已占用 8787 回報 `EADDRINUSE`，故沿用該 server 驗證。

## 修改紀錄：房主刷新恢復目前進度 V275（2026-08-18）

- 問題：`BOARD_JOIN_GAME` 會先送 `BOARD_LOBBY`、再送既有 `BOARD_GAME_STATE`、最後才回覆 join 結果。房主刷新時，舊版在收到房間名單後便提前建立新局，令 `awaitingInitialState` 變成 false；隨後真正的既有快照若來源是同一個持久 `clientId`，便被當成自己的回傳訊息忽略，因此畫面跳回開局選角。
- 修正：新增只存在本機連線流程的 `initialStateCanSeed` 門閂。必須等 join 回覆明確確認「房間沒有快照」且目前裝置可 seed，房主才能建立新局；收到既有快照、加入失敗或斷線時一律清除門閂。沒有新增或改名 `gameState` 欄位、localStorage key、Socket.IO event 或資料 id。
- 檔案：修改 `public/js/board_game.js`、`public/board_game.html`，新增 `scripts/refresh_resume_qa.js`，並同步更新專案文件。正式主頁 query 為 `20260818-refresh-resume-v122`。
- 驗證：`node --check public/js/board_game.js` 與 `node --check scripts/refresh_resume_qa.js` 通過。專屬 Chrome QA 依正式伺服器順序重播「房間名單 → 快照 → join 回覆」：既有房間正確恢復 `main`、第 460 回合與「擲骰前進」，全新房間仍進入 `setup-order`；兩案 `pageerror=[]`、初始等待／seed 門閂皆在完成後關閉。正式頁 HTTP 200 且載入新版 query；`npm start` 另啟時因既有正式 server 已占用 8787 回報 `EADDRINUSE`，故沿用該 server 驗證。

## 修改紀錄：Golden Tesoro 變身回合解除卡死 V274（2026-08-18）

- 問題：玩家先手把泰佐洛打進半血後，敵人會立刻換成 Golden Tesoro 圖與第二階段四招；但本回合預先排好的敵方指令仍指向第一階段招式。第二順位執行時找不到該招式，因而直接中止，畫面看似停在黃金巨人登場後。
- 修正：第二／第三階段切換時，只針對 `postgame_gild_tesoro` 重新驗證並改選當前型態的敵方指令；載入舊快照時若仍保存失效的第一階段指令，也會先換成當前型態可用招式。一般戰鬥、其他 Boss、傷害與回合排序均未修改。
- 檔案：修改 `public/js/board_game.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/battle_attribute_tesoro_scope_qa.js` 與相關文件；正式主頁／戰鬥頁 query 為 `20260818-tesoro-golden-transition-v121`／`v78`。
- 驗證：三份 JavaScript 語法檢查通過；Chrome 1600×900 與 932×430 都實際由第一階段先手打進半血，確認切到 Golden Tesoro、四招全部換新、巨人同回合成功使用「黃金神之怒」、`animating=false` 且本輪正常結束。完整 QA 為 `ok=true`、`failures=[]`、`errors=[]`；截圖為 `tesoro_rework_20260818/tesoro_golden_transition_resolved_{desktop,phone_landscape}.png`。

## 修改紀錄：泰佐洛金流河正式圖片素材 V273（2026-08-18）

- 視覺：以內建 ImageGen 生成 1254×1254、具透明通道的液態黃金素材 `gold_river_fill_v1.webp`，取代 V254 的 CSS 漸層與重複半圓波紋。圖像仍由原本固定在 `#playerPortraitWrap` 的容器裁切成 35%／68%／全滿三段，並保留淡淡的人物可見度、金色流光與圖框裁切。
- 素材：正式 WebP 位於 `public/images/board/battle/postgame_mechanics/tesoro_gold_shell/`；ImageGen 原始 PNG 保存在同目錄 `incoming/`，完整提示詞記錄於 `GOLD_RIVER_IMAGEGEN_PROMPT.md`。正式頁不引用收件區。
- 相容：只替換泰佐洛第一階段金流的視覺素材；三次命中、當回合替補、退隊清流、Golden Tesoro 第二／三階段、傷害、回合、CPU、快照、localStorage key 與 Socket.IO event 均未修改。正式主頁／戰鬥頁 query 為 `20260818-tesoro-gold-river-art-v120`／`v77`。
- 修改檔案：`public/board_battle.html`、`public/js/board_game.js`、`public/board_game.html`、`scripts/battle_attribute_tesoro_scope_qa.js`、金流正式／來源素材、提示詞與相關專案文件。
- 驗證：三個 JS `node --check` 通過；Chrome 1600×900 與 932×430 定向 QA 為 `ok=true`、`failures=[]`、`errors=[]`。正式圖 HTTP 載入為 1254×1254；一般戰鬥仍隱藏金流；三段實測高度約 35%／67%／103%，攻擊／受擊期間固定在角色框，第三次命中與替補規則仍通過。截圖位於 `tesoro_rework_20260818/tesoro_gold_river_level_{1,2,3}_desktop.png` 及手機橫向同名檔。

## 修改紀錄：戰鬥屬性恢復原色文字 V272（2026-08-18）

- 決定：依使用者確認，角色屬性不使用圖片圖示，恢復原本的彩色文字膠囊；`力` 為紅色、`速` 為藍色、`技` 為綠色，無屬性則顯示中性色 `無`。
- 範圍：主遊戲角色資料、一般戰鬥雙方 HUD、中央屬性相剋提示及 Tot Musica 專用雙人戰鬥 HUD 全部使用同一文字規則；修行、船隻、司法島、推進城及其他功能圖片圖示不變。四張既有素材保留於素材目錄但不再作為屬性標籤，其中 `neutral.webp` 仍可供非屬性的通用備援圖使用。
- 檔案：修改 `public/js/board_game.js`、`public/board_game.html`、`public/js/board_battle.js`、`public/board_battle.html` 與 `scripts/single_character_icons_qa.js`；正式主頁 query 為 `20260818-attribute-text-v117`，battle iframe query 為 `20260818-attribute-text-v71`。
- 驗證：三支 JavaScript 語法檢查通過；更新後的瀏覽器 QA 於 1600×900、1024×768、932×430 實際檢查主頁、戰鬥、水之七島及推進城，確認屬性節點只含文字、圖片數 0、破圖 0、越框 0、失敗 0。桌機截圖另人工確認文字置中及紅／藍／綠漸層正確。純顯示修改，不改屬性剋制、傷害、角色資料、回合、存檔或多人同步。

## 修改紀錄：地圖正式預設恢復原版 V271（2026-08-18）

- 決定：使用者檢查 V270 對照圖後選擇原始版，因此未帶 `map_visual` 參數的正式頁改回原本藍色海面、冰藍路線與原色島嶼。
- 保留：復古航海圖 CSS 與切換入口沒有刪除；只有明確指定 `map_visual=vintage` 才會套用，`map_visual=original` 與未指定參數皆為原版。
- 檔案：修改 `public/board_game.html`、`public/js/board_game.js`；正式主頁 query 為 `20260818-map-original-default-v116`。
- 驗證：JavaScript 語法、正式頁 HTTP 與 Chrome 預設載入通過；預設 class 為 `game-board`、資料標記為 `original`，再切到 vintage 與切回 original 仍可正常運作。沒有修改地圖座標、路線、事件、存檔或多人同步。

## 修改紀錄：可回復的復古航海地圖濾鏡 V270（2026-08-18）

- 範圍：正式地圖的海面底圖、路線、海格、島嶼與海上裝飾改用做舊航海圖色調；上方回合框、工具按鈕、玩家船、標記、文字與彈窗不套濾鏡。
- 回復：既有 CSS 原始版沒有刪除或改寫；`map_visual=original` 會移除唯一的 `map-visual-vintage` 覆蓋層，`map_visual=vintage` 顯示復古版。另提供 `window.setBoardMapVisualStyle("original"|"vintage")` 即時切換，不寫入存檔、localStorage 或多人快照。
- 檔案：修改 `public/board_game.html`、`public/js/board_game.js`，新增 `scripts/board_map_vintage_qa.js`；正式主頁 query 為 `20260818-map-vintage-v115`。
- 驗證：先保存修改前 1600×900／932×430 原始版基準，再以相同遊戲狀態逐一截取 1600×900、1024×768、932×430 的原始版與復古版。QA 確認海面、路線、海格與島圖樣式均有改變，但全部地圖節點位置／尺寸、上方 UI 幾何與樣式完全一致；破圖、文件 overflow、瀏覽器／HTTP 錯誤均為 0。另通過平板、手機橫向、手機直向 1920:900 固定比例回歸。
- 相容性：純顯示修改；不改地圖寬高、島嶼／海格座標、路線、事件、玩家位置、回合、戰鬥、任務、資料 id、存檔、`BOARD_GAME_STATE` 或 Socket.IO event。

## 修改紀錄：圓框圖示光學置中回歸 V269（2026-08-18）

- 問題：V268 只驗證 `<img>` 元素沒有越過父容器，沒有檢查透明圖檔內真正可見圖案的位置；因此部分圖示雖然 CSS 置中，圖案本身仍偏上、偏下或貼近圓框。
- 修正：`scripts/prepare_single_character_replacement_icons.js` 現在會依有效 Alpha 邊界裁切、保留光效安全距離、等比例縮放，最後重新放到 256×256 透明畫布的光學中心；司法島與推進城共用的 `unknown.webp` 也由同一份置中結果同步。
- 檔案：當時重新輸出修行、船隻升級、司法島補給、推進城事件與屬性共 30 張正式 WebP；V272 已讓四張素材退出屬性標籤，目前 QA 對其餘 26 張功能圖示仍檢查圖案中心偏差、透明度、尺寸與四邊安全距離，`neutral.webp` 的非屬性備援用途保留。
- 驗證：30/30 張皆為 256×256 Alpha WebP；有效圖案 X/Y 中心偏差皆不超過 0.5px，四邊安全距離至少 18px。Chrome 實際截圖檢查 1600×900、1024×768、932×430 的修行、船隻、水之七島、司法島、推進城、屬性、船團及圖鑑，QA `ok=true`、失敗 0、破圖 0、越框 0。
- 相容性：只重新置中顯示素材並加強 UI QA；不修改遊戲規則、角色／招式／道具／島嶼 id、回合、戰鬥判定、存檔、同步或 `BOARD_GAME_STATE`。

## 修改紀錄：全遊戲單字代用圖示清理 V268（2026-08-17）

- 範圍：盤點正式 Board 主頁、戰鬥、水之七島與推進城，將修行六能力、船隻五升級、司法島九種突破補給、推進城五種事件、力／速／技／無屬性，以及船團／圖鑑摘要、黑色遭遇格、島嶼與道具錯圖備援中原本用單一中文字或問號冒充圖示的項目改成圖片；骰面、階級、Lv、撲克牌牌面與圖鑑保密 `????` 保留為資料。
- 素材：ImageGen 產出五張無文字、無外框圖示表，切成 29 個獨立設計及 30 個正式 256×256 Alpha WebP（推進城 `unknown` 共用司法島神秘寶箱）；原圖放在各目錄 `incoming/`，正式頁只引用上一層正式圖檔。完整提示詞記錄於 `docs/SINGLE_CHARACTER_ICON_IMAGEGEN_PROMPTS_20260817.md`。
- 檔案：修改 `public/js/board_game.js`、`public/board_game.html`、`public/js/board_battle.js`、`public/board_battle.html`、`public/js/board_impel_down.js`、`public/board_impel_down.html`、`public/board_water_seven.html`；新增五組圖示目錄、`scripts/prepare_single_character_replacement_icons.js` 與 `scripts/single_character_icons_qa.js`。正式主頁 query 為 `20260817-single-character-icons-v113`。
- 驗證：JavaScript 語法與四個正式頁 HTTP 皆通過；Chrome 1600×900、1024×768、932×430 共檢查 12 個頁面狀態，所有指定圖示數量、圖片解碼、正式路徑、256×256 新素材、框內位置與舊單字節點均通過，瀏覽器／HTTP 錯誤為 0。
- 相容性：只改素材與 DOM 顯示；不修改角色、招式、島嶼、任務、道具 id、戰鬥判定、回合、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。
- 後續：V272 依使用者決定把 `力／速／技／無` 恢復成原色文字；本版其餘 26 張功能與備援圖示仍沿用。

## 修改紀錄：新招式學習類別圖示去外框 V267（2026-08-17）

- 範圍：重製 V266 的八種招式類別圖示，移除圖檔本身的金色方框、圓環、角飾、青色寶石及黑色底盤，只保留中央招式符號與能量光效；介面原本用來承載圖示的金色圓形格仍保留。
- 素材：以 imagegen 依原 3×3 圖表編修成 `move_type_icons_sprite_imagegen_source_v2_no_frame.png`，再切成八張 256×256 Alpha WebP。V1／V2 原圖與完整提示詞留在 `incoming/`，正式頁只引用上一層正式圖檔。
- 檔案：替換 `public/images/board/move_learn_ui/move_type_icons/` 八張正式圖示，修改 `public/js/board_game.js`、`public/board_game.html`、`scripts/prepare_move_type_icons.js`、`scripts/move_learn_type_icons_qa.js` 與提示詞紀錄。正式主頁 query 為 `20260817-move-type-icons-noframe-v111`。
- 驗證：Chrome 1600×900、1024×768、932×430 均實際開啟正式學招介面；八類映射、256×256 尺寸、透明 WebP、正式路徑、圖片／文字入框與 viewport 全數通過，瀏覽器及 HTTP 錯誤為 0。
- 相容性：只替換顯示素材與圖示尺寸，不修改招式類別、物攻／特攻判定、威力、PP、學習／遺忘流程、存檔、同步或 `BOARD_GAME_STATE`。

## 修改紀錄：新招式學習類別圖示 V266（2026-08-17）

- 範圍：正式「新招式學習」畫面的招式類別不再以 `物／特／強／弱／療／盾／控／狀` 單字冒充圖示；新招式資料與四個既有招式列改用物攻、特攻、強化、弱化、治療、護盾、控制、狀態八種正式圖示，類別名稱只保留為輔助標籤與無障礙文字。
- 素材：依正式深色海洋／古金海賊 RPG 框風格，以 imagegen 產生 3×3 圖示組，保留原圖與提示詞於 `public/images/board/move_learn_ui/move_type_icons/incoming/`；正式頁只引用上一層八張 256×256 透明 WebP，不引用 `incoming/`。
- 檔案：修改 `public/js/board_game.js`、`public/board_game.html`；新增八張正式圖示、`scripts/prepare_move_type_icons.js`、`scripts/move_learn_type_icons_qa.js` 與提示詞紀錄。正式主頁 query 為 `20260817-move-type-icons-v110`。
- 驗證：Chrome 1600×900、1024×768、932×430 均實際打開新招式學習介面；八種類別映射、5 個同畫面圖示、256×256 尺寸、正式路徑、舊單字節點移除、圖片／文字入框與 viewport 全數通過，瀏覽器及 HTTP 錯誤為 0。
- 相容性：沒有修改招式類別、物攻／特攻判定、威力、PP、學習／遺忘流程、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。

## 修改紀錄：Board CPU 簡化名稱 V265（2026-08-17）

- 範圍：Board 等待室與正式遊戲的自動玩家名稱統一為 `CPU1`、`CPU2`、`CPU3`，移除「CPU 航海士 A／B／C」等舊顯示名稱；既有等待室及舊存檔載入時也會依原 CPU slot 即時正規化。
- 檔案：修改 `public/js/board_start.js`、`server/index.js`、`public/js/board_game.js`、`public/board_start.html`、`public/board_game.html`；新增 `scripts/board_cpu_names_qa.js`。正式 query 為 `20260817-cpu-simple-names-v2`／`20260817-cpu-simple-names-v109`。
- 驗證：啟動正式 server 後，以 Chrome 1600×900 建立一名真人與三名 CPU 的線上房間；等待室及正式遊戲均讀到 `CPU1／CPU2／CPU3`，瀏覽器例外與 HTTP 錯誤皆為 0。另通過三份 JavaScript 與 QA 腳本語法檢查。
- 相容性：只改 Board CPU 顯示名稱及載入正規化，不修改 CPU `userId`／`clientId`、玩家控制權、Socket.IO event、localStorage key、遊戲快照欄位或舊卡牌遊戲 CPU 名稱。

## 修改紀錄：顛倒山登山劇情與五海路教學 V264（2026-08-17）

- 範圍：真人玩家首次抵達顛倒山時，先播放兩幕八句的全螢幕登山劇情，再回到正式地圖亮出五條主航線；娜美、魯夫與旁白在劇情中說明點選亮起海格、唯一占用制，以及剩餘步數如何接續。
- 素材：使用 imagegen 生成無文字的顛倒山／雙子岬入口 16:9 劇情背景，轉為 `public/images/board/story/backgrounds/reverse_mountain/reverse_mountain_route_choice_story.webp`；角色與規則文字維持 HTML 顯示。
- 流程：沿用既有 `claimedBranchId` 判斷首次選路，不新增存檔欄位；CPU 與已占有航線的玩家不重播。劇情播放期間先建立正式 `routePrompt`，不持久鎖住 `resolutionLock`，即使重整也能直接恢復選路。
- 檔案：修改 `public/js/board_game.js`、`public/board_game.html`；新增正式背景與 `scripts/reverse_mountain_story_qa.js`。正式主頁 query 為 `20260817-reverse-mountain-story-v108`。
- 驗證：Chrome 1600×900 與 932×430 實際播放全部八句；背景、娜美／魯夫圖、文字、按鈕均在可視範圍。結束後 `resolutionLock=false`、保留 3 步、五條 `routeIds` 與 25 格亮起海格；已占有航線時不重播。瀏覽器例外、HTTP 錯誤及版面溢出皆為 0。
- 相容性：未修改五條 route id、唯一占用規則、移動扣步、任務事件、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 格式。

## 修改紀錄：同行夥伴角色圖下移 V263（2026-08-17）

- 範圍：將同行三席框內的角色圖整體下移，讓頭髮與頭頂完整留在上方金框下方；姓名木牌與空席編號維持原位。
- 檔案：修改 `public/board_game.html` 與 `scripts/draft_crew_frame_layout_qa.js`；正式主頁 query 為 `20260817-draft-crew-portrait-lower-v107`。
- 驗證：`2/3`、`3/3` 的順位、轉盤、選人三階段及 1600×900、1024×768、932×430 均回歸；QA 通過且桌機滿席截圖確認魯夫、索隆、娜美的頭頂均未被裁切。
- 相容性：未修改角色圖片、角色名稱資料、選角規則、持久狀態、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。

## 修改紀錄：同行夥伴姓名木牌對位 V262（2026-08-17）

- 範圍：將同行夥伴姓名從角色洞口下緣移到每格底部木製名牌正中央；角色圖保持在上方透明洞內，空席編號也固定在洞口中央。
- 檔案：修改 `public/board_game.html` 與 `scripts/draft_crew_frame_layout_qa.js`；正式主頁 query 為 `20260817-draft-crew-nameplate-v106`。
- 驗證：`2/3`、`3/3` 的順位、轉盤、選人三階段及 1600×900、1024×768、932×430 均回歸；QA 量測所有姓名位於同行框高度 76%～92% 的木牌安全區，並檢查省略、破圖與水平溢出。
- 相容性：未修改角色名稱資料、選角規則、持久狀態、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。

## 修改紀錄：同行夥伴類型圖示移除 V261（2026-08-17）

- 範圍：只移除開局抽選流程「同行夥伴」三席框內，角色右上角的戰鬥／偵查／移動／輔助類型圖示；角色卡、圖鑑與其他頁面的類型顯示均保留。
- 檔案：修改 `public/js/board_game.js`、`public/board_game.html` 與 `scripts/draft_crew_frame_layout_qa.js`；正式主頁 query 為 `20260817-draft-crew-no-role-icon-v105`。
- 驗證：以 `2/3` 與 `3/3` 狀態回歸順位、轉盤、選人三階段，要求同行框 `roleIconCount=0`，並續查角色圖、名稱、空席、破圖與版面溢出。
- 相容性：未修改角色 `roleType` 資料、選角規則、持久狀態、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。

## 修改紀錄：同行夥伴三格挖空框正式接入 V260（2026-08-17）

- 範圍：依既有同行夥伴框與 V259 通用順位底框重畫三席框；外圍與三個角色洞皆為真正 Alpha 透明，角色圖置於框後、金框與 HTML 名稱／類型圖示置於前方，空席能直接透出港口背景。
- 正式接入：正式替換 `public/images/board/draft_recruitment/draft_crew_slots_frame.webp`，同步校正 `public/board_game.html` 的框比例、透明洞安全區與圖層順序；`public/js/board_game.js` 加入素材版本，主頁 query 為 `20260817-draft-crew-cutout-v104`。
- 檔案：修改 `public/images/board/draft_recruitment/draft_crew_slots_frame.webp`、`public/board_game.html`、`public/js/board_game.js`；新增 `scripts/draft_crew_frame_layout_qa.js`。
- 驗證：正式 WebP 為 1672×941 RGBA，外圍及三洞 Alpha 均為 0；以 `2/3` 空一席及 `3/3` 滿席，實際跑過順位確定、轉盤、選人三種正式 DOM，並以 Chrome 1600×900、1024×768、932×430 完成 12 張截圖。正式素材載入、三格數量、角色圖／名稱／類型圖示、長名省略、水平溢出與瀏覽器例外全部通過。
- 相容性：未修改選角規則、候選池、玩家操作權、持久狀態、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`；正式頁沒有引用 `incoming/`。

## 修改紀錄：1～4 人通用選角順序底框與全流程排版 V259（2026-08-17）

- 範圍：重畫開局選角順序底框；左側固定四個順位／輪次標籤框，右側改為不被望遠鏡或地圖侵入的四條完整羊皮紙；玩家欄依 1～4 名玩家動態平分。
- 全流程：同步校正「順位確定」、「轉盤尚未轉動／轉動中」、「轉完進入候選名單」三種容器。平板轉盤按鈕與結果框不再重疊；932×430 橫向畫面將轉盤與按鈕／結果分置左右，不再裁掉下半部；候選頁的船員框不再壓到下方卡牌框。
- 檔案：正式替換 `public/images/board/draft_recruitment/draft_order_compass_board.webp`，並修改 `public/board_game.html`、`public/js/board_game.js`；新增 `scripts/draft_order_flow_layout_qa.js` 驗證實際轉盤至候選名單的轉場。正式 query 為 `20260817-draft-order-universal-v103`。
- 驗證：Chrome 1600×900 完整跑過 1、2、3、4 人四個畫面節點，另以 1024×768 與 932×430 回歸四人流程；共 24 張截圖。正式 2400×600 WebP、順位欄數、狀態格數、超長名稱、文字／圖片載入、安全區、框位重疊、頁面溢出與瀏覽器例外全部通過。
- 相容性：未修改選角順序、轉盤機率、候選池、玩家操作權、持久狀態、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。正式頁沒有引用 `incoming/`。

## 修改紀錄：四人選角底圖安全區校正 V258（2026-08-17）

- 範圍：保留 V257 的四個固定玩家欄，不重畫底圖；依 `draft_order_compass_board.webp` 的實際構圖，把玩家欄與十二個抽取狀態完整縮回中央羊皮紙，避開左側木牌與右側望遠鏡／卷軸裝飾。
- 檔案：`public/board_game.html`、`scripts/draft_codex_privacy_qa.js`，並同步更新三份專案文件。正式主頁 query 為 `20260817-draft-board-safe-area-v102`。
- 驗證：正式 Chrome 1600×900 與 1024×768 均確認六張候選卡正常；四人欄與十二個狀態格的合併邊界固定在底圖寬度 17.6%～81.5%、高度 15.5%～87.5%，全部位於羊皮紙安全區，頁面無溢出、瀏覽器例外或圖鑑回歸失敗。
- 相容性：只調整現有底圖上的 CSS 內距與欄寬，不修改底圖檔、選角順序、轉盤、候選池、同步或存檔資料。

## 歷史修改紀錄：四人選角排版與圖鑑身分保密 V257（2026-08-17，圖鑑條件已由 V377 取代）

- 範圍：四人三輪蛇形選角不再把同一玩家的頭像與名稱重複排列十二次；航程順位板改為四個固定玩家欄、三輪狀態列，上方摘要也只保留四名玩家與各自 `已選 x/3`。順位、正反向輪次與 12 次抽取順序不變。
- 圖鑑（當時規則）：角色只有在玩家「目前擁有至少一個永久實例」且「曾正式擊敗」兩項同時成立時才揭露；此條件已由 V377 的「正式戰鬥遇見即解鎖」取代。未遇見列與詳情仍不建立角色 portrait／階級圖片節點。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`scripts/draft_codex_privacy_qa.js`，並同步更新三份專案文件。正式主頁 query 為 `20260817-draft-codex-privacy-v101`。
- 驗證：`node --check` 通過；正式 Chrome 1600×900 與 1024×768 均確認四個玩家欄、十二個輪次格、候選卡、上方四人摘要全部在框內且頁面無溢出。圖鑑另覆蓋「擁有且擊敗／只擁有／只擊敗／兩者皆無」四種真值組合，三種鎖定狀態均未載入角色圖或階級圖，也未洩漏姓名、來源與地點。
- 相容性：沒有修改抽取順序、轉盤結果、候選池、角色／敵人 id、持久欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`；圖鑑揭露條件在開啟介面時由既有 `crew`／研究收藏及 `defeatedEnemies` 即時計算。

## 修改紀錄：大航海時代出航旁白 V256（2026-08-17）

- 範圍：依使用者逐段確認的第二段劇情，將開局序章「大航海時代出航」三句宣傳式旁白改為直接承接羅傑遺言、眾人奔向大海與時代開幕；保留既有船隊出航背景及所有播放控制。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`scripts/opening_story_dialogue_qa.js`，並同步更新三份專案文件。正式主頁 query 為 `20260817-great-pirate-departure-v100`。
- 驗證：`node --check` 通過；正式 Chrome 1600×900 從五句羅傑處刑連續播放至三句出航旁白，逐句核對內容、章節背景、人物圖、閃白標題與框位，頁面無溢出或瀏覽器例外，共保存八張逐句截圖。
- 相容性：沒有改動序章觸發、章節順序、播放時間、圖片、選角、主線、持久狀態、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。

## 修改紀錄：羅傑處刑原句校正 V255（2026-08-17）

- 範圍：依使用者逐段確認的第一段劇情，只校正開局序章「羅傑處刑」五個節拍；刪除虛構群眾問話與三句遊戲改寫，羅傑改說確認過的兩句繁中原意版本，保留原背景、平靜／微笑人物圖、處刑閃白與「大航海時代——開幕」。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`scripts/opening_story_dialogue_qa.js`，並同步更新三份專案文件。正式主頁 query 為 `20260817-roger-original-line-v99`。
- 驗證：`node --check` 通過；正式 Chrome 1600×900 依序播放五句，逐句核對說話者、文字、羅傑 calm／smile 圖、處刑閃白與標題，人物圖載入、對話框框位及頁面溢出均正常，並保存五張逐句截圖。
- 相容性：沒有改動序章觸發、播放時間、操作按鈕、選角、主線、持久狀態、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。

## 修改紀錄：120 話主線流程與 CPU 推進修正 V254（2026-08-17）

- 範圍：修正 CPU 在第 2 話及其他狀態型任務被 `goalBaseline` 永久扣成 0 的問題；基準現在只套用海格、戰鬥、使用道具等真正的累計事件，船員數、懸賞、島嶼／副本／結局旗標等即時狀態直接讀目前值。`mainMission` 正規化版本升為 3，舊快照中的無效狀態型基準會自動清除。
- 任務流程：拆開第 18、26、37、54、101～107、111～114 話的重複條件；第 116 話改為伊姆第一條血量真正打破、進入第二階段才完成。真人按一次領獎會連續領取當下已經完成的主線，減少只為重複開日誌的空轉。
- 平衡：四個賞金門檻改為 2.5 億／5 億／12 億／30 億；前 1～10、11～20、21～30 話 EXP 分別調為原值 35%／50%／70%，第 31 話後保留；日誌明示基礎 EXP 仍受船員成長補正。第 41～44 話合計補足 20 木板與 4 工具箱；第 120 話追加不可消耗、不可交易的永久重要道具「黎明航路生命卡」。
- 檔案：`public/js/board_missions.js`、`public/js/board_items.js`、`public/js/board_game.js`、`public/board_game.html`、`scripts/main_mission_regression_qa.js`、`scripts/main_mission_browser_qa.js`，並同步更新三份專案文件。正式 query 為 `20260817-main-mission-reward-v2`／`20260817-main-mission-flow-v2`／`20260817-main-mission-flow-v98`。
- 驗證：靜態語法檢查通過；正式頁回歸確認 120/120 真人可領、41 件原獎勵與新永久道具都可解析、CPU 第 1→2 話能推進且累計型第 5 話仍保留基準、重複 goal 簽章為 0、四個賞金門檻不會被先前主線獎勵自動跨過、水之七島供給為 20／4。Chrome 1600×900 與 932×430 任務日誌按鈕、文字均無裁切，另以三客戶桌機／平板／手機測試房間 B4824，加入、控制權與完整快照同步無錯誤。
- 相容性：沒有改名任務、道具、角色、地圖、localStorage key 或 Socket.IO event，也沒有增加新的玩家／房間快照欄位；沿用既有 `mainMission.goalBaseline` 並在載入時遷移。

## 修改紀錄：戰鬥進場角色口吻校正 V253（2026-08-17）

- 範圍：依實際人物性格重寫上一版新增的 22 位後期敵人台詞池及 25 組高關聯對話，移除「超越這份見聞色」、直接解說覺醒／血統因子／背火及暴露鹽弱點等不像人物會說的句子。
- 檔案：`public/js/onepiece_prebattle_lines.js` 重寫口吻；`public/js/board_game.js` 新增能力／遊戲規則解說句過濾；`scripts/prebattle_dialogue_quality_qa.js` 新增規則旁白掃描；`scripts/battle_prebattle_intro_qa.js` 支援以 `BOARD_QA_BOSS_KEY` 指定實測 Boss；`public/board_game.html` 更新快取版本，並同步更新三份專案文件。
- 驗證：`node --check` 與靜態對話 QA 均通過，3,760 組正式配對的系統句、機制解說句及超過 30 字台詞皆為 0；另以正式戰鬥頁指定卡塔庫栗，驗證新台詞可見、CPU 在對話結束前不行動、結束後才出招，桌機／手機畫面無溢出及瀏覽器例外。
- 相容性：沒有修改戰鬥演出時間、傷害、回合、CPU 戰術、角色／敵人 id、持久狀態或多人同步格式。正式 query 為 `20260817-prebattle-character-voice-v3`／`20260817-prebattle-character-voice-v97`。

## 修改紀錄：戰鬥進場自然對話完善 V252（2026-08-17）

- 範圍：移除戰前對話中的「誰上場／出戰／迎戰／登場」式系統播報，補齊四皇、最終敵人、神之騎士團與十三 Boss 區域的後期對話；不修改戰鬥傷害、CPU 戰術、播放時間、回合、持久狀態或多人事件。
- 檔案：`public/js/onepiece_prebattle_lines.js` 新增 22 位敵人的雙句台詞池與 25 組高關聯配對；`public/js/board_game.js` 擴充敵人 key、過濾系統式文字並加入形態／類型自然備援；`public/board_game.html` 更新快取；同步修訂兩份人工審閱清單，新增 `scripts/prebattle_dialogue_quality_qa.js`，並強化 `scripts/battle_prebattle_intro_qa.js` 的自然台詞檢查。
- 驗證：`node --check` 通過正式對話資料、主遊戲與兩支 QA；靜態 QA 確認 42 個角色池、65 個敵人池、3,760 組配對、22 位擴充敵人及 83 個配對角色 key 均可取得自然台詞，系統式台詞與超長台詞皆為 0。另以 `npm start` 執行正式戰鬥頁瀏覽器 QA，確認開場對話可見、CPU 會等待播放完成、完成後才行動、沒有文字／頁面溢出與瀏覽器例外。
- 相容性：沒有新增或改名角色、敵人、招式、道具及地圖 id，沒有修改 `gameState`、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 快照格式。正式 query 為 `20260817-prebattle-natural-dialogue-v2`／`20260817-prebattle-natural-dialogue-v96`。

## 修改紀錄：開局角色階級重整 V251（2026-08-17）

- 範圍：依確認名單重整首周目開局角色階級，不修改劇情限定角色、最終之島後四人、選角流程、同步欄位或事件名稱。
- 檔案：`public/js/board_cards.js` 調整薩波、雷利、烏塔、騙人布、娜美、曼雪莉、佩羅娜的 `tier`；`public/board_game.html` 與 `public/board_marineford.html` 更新正式角色資料快取版本；新增 `scripts/opening_roster_tier_qa.js`。
- 規則結果：S 6、A 8、B 5、C 5、D 6、E 5，共 35 名。現有 `tier` 同時參與招募階級、預設基礎數值與成長率；烏塔保留自訂 `baseStats`，其成長率隨 B 級更新。
- 驗證：執行 `node --check public/js/board_cards.js`、`node --check scripts/opening_roster_tier_qa.js`、`node scripts/opening_roster_tier_qa.js`，並以 `npm start` 確認正式主頁、角色資料與頂上戰爭頁可載入。

本文件描述修改大富翁 / Board 遊戲時的標準流程。

## 1. 先確認需求範圍

先判斷改動屬於哪一類：

- 大廳 / 房間 / 線上同步。
- 主地圖 / 移動 / 落點事件。
- 戰鬥。
- 角色資料。
- 道具 / 商店 / 掉落。
- 任務。
- 特殊區域：司法島、推進城、Marineford、Water Seven、四皇、最終島。
- UI / RWD / 素材。
- 存檔 / 讀檔 / 舊資料相容。

若需求只說「大富翁遊戲」，不要修改舊卡牌遊戲規則。

## 2. 修改前先讀哪些檔案

所有 Board 改動基本要先看：

- `package.json`
- `server/index.js`
- `public/board_start.html`
- `public/js/board_start.js`
- `public/js/board_shared.js`
- `public/board_game.html`
- `public/js/board_game.js`

依功能再加讀：

- 角色：`public/js/board_cards.js`
- 道具 / 商店 / 掉落：`public/js/board_items.js`
- 任務：`public/js/board_missions.js`
- 地圖：`public/js/board_map_layout_override.js`、`public/js/board_map_align.js`
- 戰鬥 UI：`public/board_battle.html`、`public/js/board_battle.js`
- 推進城：`public/board_impel_down.html`、`public/js/board_impel_down.js`
- Marineford：`public/board_marineford.html`
- Water Seven：`public/board_water_seven.html`
- 音效 / 特效：`public/js/battle_hit_effect_settings.js`、`public/js/battle_sfx_catalog.js`
- BGM：`public/js/bgm_metadata.js`、`public/js/choose_bgm.js`、`public/js/bgm_manager.js`
- 素材規格：`public/images/board/battle/**/README.md`

## 3. 判斷會不會影響同步

只要符合任一條件，就視為會影響同步：

- 新增、刪除或改名 `gameState`、`battleState`、player、ship、mission、item、map 欄位。
- 改變目前行動玩家、回合、階段、移動、戰鬥、交易、合作戰流程。
- 改變 `BOARD_*` event payload。
- 改變 `userId`、`clientId`、`isMe`、玩家身份判斷。
- 改變讀檔 / 存檔 payload。
- 新增特殊 UI 頁面與主遊戲之間的 localStorage / postMessage / command bridge。

同步相關改動要檢查：

- `server/index.js` 的 `BOARD_JOIN_ROOM`、`BOARD_START_GAME`、`BOARD_JOIN_GAME`、`BOARD_GAME_STATE`、`BOARD_STATE_REQUEST`。
- `server/index.js` 的 `canAcceptBoardGameStateUpdate()` 與行動者判斷 helper。
- `public/js/board_game.js` 的 `setupBoardLanSocket()`。
- `public/js/board_game.js` 的 `pushBoardLanState()` / `pushBoardLanStateUnchecked()`。
- `public/js/board_game.js` 的 `canPushBoardLanState()`。
- `public/js/board_game.js` 的 `applyBoardLanPayload()`。
- `public/js/board_game.js` 的 `createManualSavePayload()`、`loadManualGame()`、`normalizeLoadedGameState()`。

## 4. 修改時的原則

- 優先延續既有函式與資料格式。
- 不要順手整理巨大檔案或更名大量 id。
- 新增資料欄位時，要補讀檔 normalize 預設值。
- 新增素材時，要確認實際路徑與大小寫。
- 新增任務 goal 或事件 kind 時，要同時補觸發點與進度更新。
- 改戰鬥時，要檢查一般敵人、四皇、特殊副本、最終戰是否共用同一段流程。
- 改 UI 時，要找出 style 在 HTML、JS 注入、或兩者都有。

## 5. 測試流程

目前 `package.json` 沒有 `npm test` script。程式修改後至少做以下手動驗證。

基本啟動：

1. 執行 `npm start`。
2. 開啟 `http://localhost:3000` 或 server 實際印出的 port。
3. 確認靜態頁面與 Socket.IO client 可載入。

Board 單機流程：

1. 進入 `board_start.html`。
2. 建立本機或 fallback lobby。
3. 開始遊戲。
4. 擲骰移動。
5. 觸發至少一個海域或島嶼事件。
6. 手動存檔，再重整讀檔。

多人同步流程：

1. 開兩個瀏覽器視窗或分頁。
2. 一個建立房間，另一個加入。
3. host 開始遊戲。
4. 測試目前玩家行動後另一個 client 是否同步。
5. 測試非目前玩家是否被 UI 或 server 阻止推送關鍵狀態。
6. 重整其中一個 client，確認能從 server 或其他 client 取得狀態。

戰鬥流程：

1. 觸發一般敵島或海域戰鬥。
2. 測試玩家招式、敵方回合、勝利、失敗或撤退。
3. 如果改到特殊 Boss，要測對應四皇、特殊副本或最終戰。

任務 / 道具流程：

1. 確認任務出現。
2. 觸發任務 goal。
3. 確認進度、完成、獎勵。
4. 若改道具，測試取得、使用、消耗、背包顯示。

UI / RWD：

1. 桌機寬度檢查主地圖與 modal。
2. 手機寬度檢查文字是否溢出。
3. 檢查 z-index、overlay、按鈕可點擊區域。
4. 檢查圖片、音效、影片路徑是否 404。

## 6. 回報修改內容

完成後回報時包含：

- 修改了哪些檔案。
- 改了哪個流程或資料。
- 是否影響多人同步。
- 是否影響存檔相容。
- 做過哪些測試。
- 未測或仍有風險的地方。

如果只改文件，回報新增 / 修改文件與是否有檢查檔案存在即可。

## 7. 修改紀錄規範

每次 Codex 修改程式、資料、素材目錄或本機工具後，都要同步更新文件。

必做：

- 在本文件的「修改紀錄」新增日期、修改範圍、檔案與驗證結果。
- 若改架構、入口、工具、同步或素材分類，更新 `docs/PROJECT_OVERVIEW.md`。
- 若改規則、角色、道具、戰鬥、任務、副本、進化條件，更新 `docs/GAME_RULES.md`。
- 若新增、刪除或改變重要檔案職責，更新 `docs/FILE_MAP.md`。
- 若改工作規則或未來 Codex 必須遵守的流程，更新 `AGENTS.md`。

紀錄格式：

```md
### YYYY-MM-DD

- 範圍：簡述改了什麼功能或資料。
- 檔案：列出主要檔案。
- 驗證：列出有跑的檢查；未測也要寫明。
- 風險：同步、存檔、素材或規則風險；沒有就寫無。
```

## 8. 修改紀錄

### 2026-07-30

#### 戰鬥相反方向受擊圖全部完成

- 日期：2026-07-30。
- 範圍：重新掃描正式玩家、進化與敵人戰鬥 portrait 資料夾；只有同時具有非空 `normal.webp`、`angry.webp`、`hit.webp`、`morale.webp`、`weak.webp`、`dizzy.webp` 的資料夾列入。合格來源共 149 組（玩家 51、玩家進化 32、敵人 66），已全部建立相反方向受擊圖。
- 檔案：玩家與玩家進化的正式輸出為各角色資料夾內的 `hit_enemy.webp`；敵人的正式輸出為各敵人資料夾內的 `hit_player.webp`。另更新 `public/images/board/battle/opposite_hit_incoming/`、`docs/BATTLE_OPPOSITE_HIT_GENERATION_PROGRESS.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 生成與人工驗證：每名角色以原 `hit.webp` 為主要編輯底圖，另把其餘五張正式狀態圖排成接觸表一併提供作角色一致性參考；候選圖先進中央收件區，再與來源並排檢查衝擊方向、頭部反應、角色身份、文字／刺青／疤痕、配件、武器與背景後才移入正式資料夾。左右固定特徵錯誤的候選均重生或局部修正，未通過稿沒有移入正式資料夾。
- 檔案驗證：重新依六狀態資格掃描，確認正式輸出為玩家 51、玩家進化 32、敵人 66，共 149 張；每張均可解碼為 RGB WebP，尺寸與各自來源 `hit.webp` 完全一致，缺檔、格式、色彩模式、尺寸與解碼錯誤均為 0。`opposite_hit_incoming/` 最終檔案數為 0，進度表為 `verified` 149、`pending` 0。
- 略過項目：`portraits/placeholder/` 缺五張狀態圖；`portraits/evolutions/uta_evolution_1/` 與 `enemies/lucci/` 的六張狀態檔均為空檔，因此不列入 149 組合格來源。正式非空路基敵人資料夾為 `enemies/rob_lucci/`。
- 風險：本次只新增素材與追蹤文件，未修改 `board_cards.js`、`board_game.js`、`board_battle.js` 的 portrait 選擇函式，也未接入任何戰鬥方向判斷；不影響規則、回合、戰鬥數值、CPU、觀看方、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`，因此 `docs/PROJECT_OVERVIEW.md` 與 `docs/GAME_RULES.md` 不宣稱此功能已接入。

#### 戰鬥相反方向受擊圖正式接入 V111

- 日期：2026-07-30。
- 範圍：`board_cards.js` 的玩家／進化 portrait 與 `board_game.js` 的玩家 fallback／敵人 portrait 新增 `hitPlayerSide`、`hitEnemySide`；主遊戲既有戰鬥演出及 `board_battle.js` 的正式 `hit` 狀態都改依本場 `side` 選圖。玩家與進化站敵方時使用 `hit_enemy.webp`，敵人培育角色站我方時使用 `hit_player.webp`，原本正常站位仍使用既有 `hit.webp`。
- 檔案：`public/js/board_cards.js`、`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、三份 portrait `README.md`、`docs/BATTLE_OPPOSITE_HIT_GENERATION_PROGRESS.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 正式資料驗證：`BoardCards` 51／51 玩家與 32／32 進化型態均帶兩個方向欄位；`arenaOpponentProfile("luffy")` 的最高型態五檔魯夫敵方受擊路徑為 `portraits/evolutions/luffy_gear_fifth/hit_enemy.webp`；`lineageCultivationTemplateForEnemy("akainu")` 的我方受擊路徑為 `enemies/akainu/hit_player.webp`。四個代表性正式路徑均回傳 HTTP 200。
- 正式畫面驗證：以正式 `board_battle.html` 的 attack visual event 實際播放兩個跨陣營情境。Chrome 1440×900 中敵方五檔魯夫載入 `hit_enemy.webp`、我方赤犬培育個體載入 `hit_player.webp`；1024×768 平板再次確認敵方方向圖。兩張實際受擊圖均解碼為 1086×1448，沿用原卡片尺寸與排版。
- 程式與素材驗證：`node --check` 通過 `board_cards.js`、`board_game.js`、`board_battle.js`；兩個 HTML 沒有 inline script；重新掃描 51 名玩家、32 種進化、66 名敵人，`hit_enemy.webp`／`hit_player.webp` 缺圖 0。8787 的正式入口、主遊戲、戰鬥頁、三支新版 query 腳本及代表性新圖均回應 HTTP 200，`git diff --check` 通過。
- 相容性：舊存檔／舊多人快照沒有方向欄位時，戰鬥頁依序回退 `hit`、`hurt`、`normal`、`idle`。沒有新增或改名 `gameState`、battle state、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 欄位；戰鬥數值、招式、命中、回合、CPU 與觀看方同步規則不變。正式 query 更新為 `20260730-directional-hit-portraits-v1`。

#### 約克十三張線索單人三難度排牌示範 V112

- 日期：2026-07-30。
- 範圍：新增後依玩法確認調整獨立可玩示範頁 `public/board_york_clue_puzzle_demo.html`。每次載入使用 `crypto.getRandomValues()` 建立新種子，為單一玩家生成簡單、普通、困難三套不同的 1～13 正確排列；每張牌各帶位置、左右、相鄰或間隔線索，產題後由內建回溯解題器計數，只接受唯一解。
- 難度：簡單最多弱化 4 條精確線索，實測保留約 9 條直接座標／精確位移；普通最多弱化 8 條，實測約 5 條直接線索；困難會盡量把 9 條以上改為左右、相鄰、間隔、奇偶或端點等關係線索，只保留解出唯一答案所需的直接錨點。三種難度各自保存目前排列、嘗試次數與完成狀態。
- 操作：正式約克撲克牌框與十三座 Boss 島圖會組成可拖曳牌列；桌機可拖放，平板可先點牌再點另一張交換，也可使用左右移動、重新洗牌、回復初始排列與確認解碼。畫面已移除自動排入正解按鈕，錯誤確認只提示線索仍矛盾，不指出錯牌；完成後顯示蛋頭島與本題嘗試次數。
- 交換與鎖定：點牌改為明確兩段式操作；第一下只讓該牌發出金色呼吸光並成為待交換牌，再點第二張未鎖定牌才互換位置，再點同一張則取消。十三個位置下方各有「鎖定／解鎖」按鈕；鎖住的是位置與當下牌，點擊交換、拖曳、左右移動與重新洗牌都不能移出或移入，洗牌只重排未鎖定位置。回復初始排列會解除全部鎖定，完成題目後鎖定按鈕停止操作。
- 唯一解與隨機驗證：連續載入 20 次，共產生 20 個不同種子與 60 套不同排列；60／60 題的解題器計數皆為 1、未超過推演節點上限，每輪三套答案皆不同，且簡單、普通、困難的直接線索數量皆嚴格遞減。另以內部稽核介面把三種正確排列逐一送入「確認解碼」，三題都能完成；錯誤排列不會誤判成功。
- 畫面與服務驗證：Chrome 1440×900、1024×768 與手機橫向 844×390 均顯示 13 條線索、13 個位置、13 個鎖定按鈕與三種難度選項；小螢幕會把完整 1024×720 遊戲台等比例縮入視窗，橫向較適合閱讀與操作。各尺寸的 document、body、線索清單、牌列、鎖定列與詳情區水平／垂直 overflow 均為 0，破圖、HTTP 4xx、console error 與 page exception 均為 0。另實測第一下只發光、第二下才交換、鎖定目標拒絕交換、鎖定牌在洗牌後保持原位、解鎖恢復操作，以及回復初始排列會清除全部鎖定；平板點選交換與難度切換也正常。示範頁及其正式既有素材回應 HTTP 200，HTML inline script 語法檢查與 `git diff --check` 通過。
- 隔離邊界：本輪只新增示範頁與文件，不修改 `board_game.html`、`board_game.js`、正式約克線索道具、蛋頭島解鎖、存檔、CPU、多人同步、`localStorage`、Socket.IO event 或 `BOARD_GAME_STATE`；正式規則仍以現行程式與 `GAME_RULES.md` 為準。

### 2026-07-10

- 範圍：把 6 組角色進化外觀框從示範頁正式接入遊戲。`新世界索隆框`、`新世界香吉士框`、`新世界娜美框`、`狙擊王框`、`新世界羅框`、`凱洛特月獅框` 會在對應進化形態的船員詳情外觀框清單中出現，尚未手動選框的對應形態會預設套用自己的角色框；正式戰鬥頁移除舊的固定通用框 `<img>`，改由 `public/js/board_battle.js` 依 `cosmeticFrameId` 動態插入框素材，並套用示範頁定稿的 X / Y / W / H / opacity / strength / z / blend。主頁與戰鬥頁 script query 更新為 `20260710-evolution-cosmetic-frames-v1`。
- 檔案：`public/board_cosmetic_frame_demo.html`、`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check public/js/board_battle.js`；解析 `public/board_cosmetic_frame_demo.html` 內嵌 script；掃描 6 組新角色框與 2 組通用框素材路徑，確認實體檔案存在；若伺服器在 `127.0.0.1:8787` 執行，確認 `board_game.html`、`board_battle.html`、新版主頁 / 戰鬥頁 JS 與代表性新框素材回應 200。
- 風險：沿用船員卡 `cosmeticFrameId` 與既有 `ownedCosmeticFrameIds`，不新增 Socket.IO event、localStorage key 或新的同步主欄位；改動集中在船員詳情可選規則、戰鬥頁視覺圖層與快取版本，需實機確認不同框的前後 z 層符合示範頁。

- 範圍：新增正式戰鬥頁外觀框測試入口 `public/board_battle_frame_test.html`。頁面提供新世界索隆、新世界香吉士、新世界娜美、狙擊王、新世界羅與凱洛特月獅型態六個按鈕，會寫入臨時 `onepiece-board-battle-snapshot-v1` 並開啟正式 `board_battle.html`，用正式 HUD / 戰鬥卡預覽外觀框效果。
- 檔案：`public/board_battle_frame_test.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：解析 `public/board_battle_frame_test.html` 內嵌 script；掃描六名角色與測試敵人羅布・路基共 42 條戰鬥 portrait 路徑，缺圖 0；執行 `node --check public/js/board_battle.js`、`node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_battle_frame_test.html` 回應 200。
- 風險：測試頁會覆寫本機 `onepiece-board-battle-snapshot-v1` 這個戰鬥頁快照，方便已開啟的正式戰鬥頁更新；不修改主遊戲手動存檔、房間狀態、Socket.IO event 或任何 `gameState` 欄位。若正在打一場正式戰鬥，測試完要從主遊戲重新進戰鬥讓快照回到正式狀態。

- 範圍：集中整理 Board 遊戲圖片到 `public/images/board/`，並更新正式 Board 頁面、Board JS、戰鬥特效設定與素材說明檔的圖片引用。Board 專用資料夾已搬到 `board/backgrounds`、`board/battle`、`board/game`、`board/story`、`board/ui`、`board/decorations`、`board/evolution`、`board/final_island`、`board/impel_down`、`board/islands`、`board/marineford`、`board/mission_island`、`board/ships`、`board/shops`、`board/tavern_recruit`、`board/water_seven`；`avatars` 與 `items` 因舊頁面仍共用，保留原資料夾並複製一份到 `board/avatars`、`board/items` 供 Board 讀取。同步把主頁 / 戰鬥頁快取版本更新為 `20260710-board-image-folder-v1`。
- 檔案：`public/images/board/`、`public/board*.html`、`public/js/board*.js`、`public/js/battle_hit_effect_settings.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行所有正式 Board JS 與 `public/js/battle_hit_effect_settings.js` 的 `node --check`；解析 `portrait-folder-tool.ps1`；掃描 288 條正式 Board 靜態圖片路徑，缺圖 0；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_battle.html`、新版 `/js/board_game.js?v=20260710-board-image-folder-v1`、`/js/board_battle.js?v=20260710-board-image-folder-v1` 與 9 個代表性 `images/board/...` 圖片路徑皆回應 200。
- 風險：這是大量素材路徑搬移，需特別確認平板 / 電腦瀏覽器沒有快取舊 JS；舊 battle 圖片根層已完整複製到 `public/images/board/battle/` 後移除，正式 Board 檔案已改讀 `images/board/...`。`avatars` 與 `items` 因舊頁面仍共用，原資料夾保留。

- 範圍：讓角色專屬外觀框也能在船員詳情中選擇。五檔・尼卡會在自己的外觀框清單中看到 `五檔・尼卡框`，既有或新覺醒五檔若尚未手動選框會預設使用此框；若玩家改選 `3D2Y 框`、`黃金電話蟲框` 或無框，戰鬥頁會照該船員的 `cosmeticFrameId` 顯示，不再由五檔框強制壓過其他選擇。
- 檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：與圖片搬移一起執行所有正式 Board JS 的 `node --check`；確認 `board_game.html`、`board_battle.html`、新版主遊戲 / 戰鬥 JS 回應 200；用 `rg` 確認文件不再保留五檔框強制壓過通用框的現行規則說法。
- 風險：沿用船員卡 `cosmeticFrameId`，不新增 Socket.IO event 或 localStorage key；角色專屬框不寫入玩家通用 `activeCosmeticFrameId`，避免影響其他船員自動套框。

- 範圍：預先建立 6 個角色進化專屬外觀框素材資料夾，讓使用者可直接放入待改名圖片。新增預留目錄 `zoro_new_world/`、`sanji_new_world/`、`nami_new_world/`、`sogeking/`、`law_new_world/`、`carrot_moon_lion/`；此步只建素材目錄與文件索引，尚未接入正式外觀框資料、戰鬥頁或船員選框 UI。
- 檔案：`public/images/board/battle/cosmetic_frames/zoro_new_world/`、`public/images/board/battle/cosmetic_frames/sanji_new_world/`、`public/images/board/battle/cosmetic_frames/nami_new_world/`、`public/images/board/battle/cosmetic_frames/sogeking/`、`public/images/board/battle/cosmetic_frames/law_new_world/`、`public/images/board/battle/cosmetic_frames/carrot_moon_lion/`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：用 PowerShell 建立並列出 6 個資料夾；未執行 `npm start`，因本次未改正式遊戲程式或可載入素材。
- 風險：目前資料夾為空，Git 不會追蹤空目錄；等使用者放入素材後需再改名、更新外觀框設定、接正式戰鬥頁並做路徑 200 / `node --check` 驗證。

- 範圍：整理使用者放入的 6 組角色進化外觀框素材，並加入外觀框示範頁供微調。新世界索隆素材改名為 `top_sword.webp`、`left_sword.webp`、`right_sword.webp`、`aura.webp`；新世界香吉士改名為 `frame.webp`、`aura.webp`、`left_flame_kick.webp`、`right_flame_kick.webp`；新世界娜美改名為 `frame.webp`、`aura.webp`、`zeus_cloud_left.webp`、`thunder_right.webp`；狙擊王改名為 `frame.webp`、`aura.webp`、`mask_top.webp`；新世界羅改名為 `frame.webp`、`room_aura.webp`；凱洛特月獅改名為 `frame.webp`、`left_fur_lightning.webp`、`right_moon_claw.webp`。`public/board_cosmetic_frame_demo.html` 下拉選單新增這 6 組，可切換五檔、新世界索隆、新世界香吉士、新世界娜美、狙擊王、新世界羅與凱洛特月獅的戰鬥半身圖 / 表情，並調整圖層 X / Y / W / H / opacity / strength / z / blend 後輸出 JSON。此筆當時只接示範頁；2026-07-10 已於上方紀錄正式接入戰鬥頁與船員選框 UI。
- 檔案：`public/board_cosmetic_frame_demo.html`、`public/images/board/battle/cosmetic_frames/zoro_new_world/`、`public/images/board/battle/cosmetic_frames/sanji_new_world/`、`public/images/board/battle/cosmetic_frames/nami_new_world/`、`public/images/board/battle/cosmetic_frames/sogeking/`、`public/images/board/battle/cosmetic_frames/law_new_world/`、`public/images/board/battle/cosmetic_frames/carrot_moon_lion/`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用 Pillow 產生臨時縮圖總覽確認 20 張素材內容；執行 Node 解析 `public/board_cosmetic_frame_demo.html` 內嵌 script；用 jsdom 執行示範頁並確認角色下拉有 7 個選項、可切換索隆 / 凱洛特角色圖與表情；掃描示範頁與動態角色半身圖共 73 條 `images/board/**/*.webp` 引用，確認實體檔案皆存在；列出 6 個資料夾確認正式檔名。
- 風險：只改素材檔名與本機示範頁，不新增 `gameState` 欄位、不改 Socket.IO event 或 localStorage key。當時正式頁尚未引用這 6 組新框；2026-07-10 已使用定稿座標接入船員選框與戰鬥頁。

- 範圍：補強舊紀錄外觀框回補條件。`public/js/board_game.js` 的讀檔同步現在不只依司法島通關寶箱與 `3D2Y 的報紙` 補框，也會用司法島 `clearCount` / `cleared` / 島嶼擊破狀態 / 舊 log 回補黃金電話蟲框，並用玩家 Marineford `win`、`rewards`、正式道具與舊 log 回補 3D2Y 框；回補後會自動套給尚未裝框的船員。`public/board_game.html` script query 更新為 `20260710-cosmetic-frame-backfill-v1`。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check public/js/board_battle.js`；確認 `http://127.0.0.1:8787/board_game.html` 與新版 `/js/board_game.js?v=20260710-cosmetic-frame-backfill-v1` 回應 200。
- 風險：回補條件會讓有司法島通關紀錄的存檔內玩家都取得黃金電話蟲框；Marineford 的 3D2Y 框仍以玩家個別成功紀錄、獎勵或 log 判斷。未改 Socket.IO event 名稱或 localStorage key。

- 範圍：讓玩家可在船員詳情中為單一船員選擇外觀框。`public/js/board_game.js` 新增船員卡 `cosmeticFrameId` 正規化、可裝框清單、裝備 / 卸下框操作與外觀框選擇 modal；船員詳情會顯示目前外觀框並提供「選擇外觀框」按鈕。戰鬥 view 改讀目前上場船員的 `cosmeticFrameId`，不同船員可各自使用不同框；新解鎖的司法島 / 3D2Y 框會自動套給目前尚未裝框的隊伍船員。`public/board_game.html` script query 更新為 `20260710-crew-cosmetic-frames-v1`。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check public/js/board_battle.js`；確認 `http://127.0.0.1:8787/board_game.html`、新版 `/js/board_game.js?v=20260710-crew-cosmetic-frames-v1`、`/board_battle.html` 回應 200。
- 風險：新增船員卡 `cosmeticFrameId` 欄位並保留玩家 `ownedCosmeticFrameIds` / `activeCosmeticFrameId` 作為解鎖與舊版預設欄位；不改 Socket.IO event 名稱或 localStorage key。後續已改成五檔・尼卡框也是角色專屬可選框，會尊重玩家在船員詳情中的外觀框選擇。

- 範圍：固定 `3D2Y 框` 與 `黃金電話蟲框` 的示範頁定稿座標，並接入正式戰鬥頁。`public/js/board_game.js` 新增玩家外觀框狀態 `ownedCosmeticFrameIds` / `activeCosmeticFrameId`、舊存檔依司法島通關寶箱與 `3D2Y 的報紙` 自動補框、司法島通關自動解鎖 / 裝備黃金電話蟲框、頂上戰爭成功救援自動解鎖 / 裝備 3D2Y 框，並將目前外觀框透過 battle view 傳給戰鬥 iframe。`public/board_battle.html` / `public/js/board_battle.js` 會在玩家戰鬥卡顯示對應通用外觀框；後續已改成五檔・尼卡框也是角色專屬可選框。
- 檔案：`public/board_cosmetic_frame_demo.html`、`public/board_battle.html`、`public/js/board_battle.js`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check public/js/board_battle.js`；解析 `public/board_cosmetic_frame_demo.html` 內嵌 script；確認 `http://127.0.0.1:8787/board_cosmetic_frame_demo.html`、`/board_battle.html`、新版 `/js/board_battle.js?v=20260710-cosmetic-frames-v1` 與兩組外觀框素材路徑回應 200。
- 風險：新增玩家外觀框欄位但不改 Socket.IO event 名稱或 localStorage key；此階段只做通關解鎖與正式戰鬥頁顯示，船員個別選框 UI 於後續修改補上。黃金電話蟲框仍使用使用者提供的原圖與目前定稿 z-index。

### 2026-07-09

- 範圍：整理使用者提供的兩組角色外觀框素材並新增通用示範頁。將 3D2Y 報紙緞帶 / 方框素材放到 `public/images/board/battle/cosmetic_frames/three_d_two_y/`，將黃金電話蟲光圈 / 方框素材放到 `public/images/board/battle/cosmetic_frames/golden_den_den/`；新增 `public/board_cosmetic_frame_demo.html`，沿用五檔框示範頁的方形戰鬥卡預覽，可切換 `3D2Y 框` / `黃金電話蟲框`、五檔表情、背景、卡片大小，並微調每組不同圖層數的 X / Y / W / H / opacity / strength / z / blend 與角色圖濾鏡後輸出 JSON。
- 檔案：`public/board_cosmetic_frame_demo.html`、`public/images/board/battle/cosmetic_frames/three_d_two_y/`、`public/images/board/battle/cosmetic_frames/golden_den_den/`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_cosmetic_frame_demo.html` 內嵌 script；確認 `http://127.0.0.1:8787/board_cosmetic_frame_demo.html` 回應 200；列出六張已歸位素材並確認示範頁引用的背景、五檔半身圖與兩組外觀框素材路徑皆存在。
- 風險：只新增本機示範頁與素材目錄，不改正式戰鬥頁、角色資料、道具獎勵、存檔欄位、Socket.IO event 或 localStorage key；黃金電話蟲主框來源檔不是 Photoroom 透明版，示範頁先以較低 z-index 放在角色圖後方，正式接入前需確認是否補透明版。

- 範圍：修正索瑪茲戰後到伊姆降臨的劇情銜接可能重複播放。`recoverPendingElbaphGateSequence()` 現在會在 `resolutionLock` 期間直接略過，避免 `renderAll()` 於索瑪茲戰後劇情 / 伊姆降臨動畫播放中又重啟同一段銜接；同時將舊命名 `FINAL_ELBAPH_AFTER_IMU_LANDING_ENDING` 改為 `FINAL_ELBAPH_GOD_KNIGHTS_ARRIVAL_ENDING`，讓程式名稱符合「神之騎士團先、伊姆後」的實際順序，並更新 `board_game.js` 載入版本為 `20260709-elbaph-recovery-lock-v1`。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_game.html` 與新版 `js/board_game.js?v=20260709-elbaph-recovery-lock-v1` 回應 200；用 `rg` 確認程式碼中的舊 `FINAL_ELBAPH_AFTER_IMU_LANDING_ENDING` 名稱已移除，恢復器有 `resolutionLock` guard。
- 風險：只改艾爾巴夫劇情銜接防重入與快取版本，不改戰鬥規則、存檔欄位、Socket.IO event 或 localStorage key；若真的中斷重讀，讀檔 normalize 會把 `resolutionLock` 歸零後再恢復銜接。

- 範圍：依使用者要求移除伊姆與黑轉支配惡魔化框上的角。正式戰鬥頁將 `.black-turn-demon-horns` 設為不顯示且惡魔化狀態 opacity 為 0；黑轉示範頁同步隱藏 `.demon-horns`，並從微調預設 / 輸出 JSON 移除 `horns` 圖層，讓目前只保留左翼、右翼、方框、紅眼與名牌。同步更新主頁 `BATTLE_PAGE_VERSION` 與戰鬥頁 script query 為 `20260709-blackturn-demo-port-v6`。
- 檔案：`public/board_battle.html`、`public/board_black_turn_demo.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`、`node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_battle.html`、`http://127.0.0.1:8787/js/board_battle.js?v=20260709-blackturn-demo-port-v6`、`http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200；用 `rg` 確認示範頁不再有 `horns` 微調預設或「角」圖層標籤。
- 風險：純視覺與快取版本更新；`demon_horns_shadow.webp` 素材與既有隱藏 img 標籤保留備用，不改黑轉規則、存檔格式、Socket.IO event 或 localStorage key。

- 範圍：修正正式戰鬥頁黑轉支配前半段仍擋住原本戰鬥對象與伊姆的層級問題。正式頁的黑轉特效位於 `battle-fx-layer`，該外層原本固定 `z-index: 60`，會整包壓在角色卡上方，導致內層卡片即使 z-index 較低仍會擋住原本角色。新增 `battle-stage.black-turn-casting` 將 `battle-fx-layer` 降到 z-index 1，80% 翻面時再加 `black-turn-front` 升到 z-index 80，讓抽取過程與示範頁一致：前半段在角色卡後方，翻面完成才到前景；同步更新戰鬥頁版本為 `20260709-blackturn-demo-port-v5`。
- 檔案：`public/board_battle.html`、`public/js/board_battle.js`、`public/js/board_game.js`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`、`node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_battle.html` 與新版 `js/board_battle.js?v=20260709-blackturn-demo-port-v5` 回應 200；檢查黑轉開始會加 `black-turn-casting`，80% 才加 `black-turn-front`。
- 風險：只改伊姆黑轉支配正式視覺層級與快取版本，不改黑轉規則、存檔格式、Socket.IO event 或 localStorage key。

- 範圍：修正正式戰鬥頁黑轉支配翻轉後伊姆圖像又出現的問題。`blackTurnEnemyCardYield` 在 88% 之後將伊姆整張敵方卡 opacity 壓到 0，並且黑轉視覺結束清理時不再移除敵方卡的 `black-turn-receiver`，讓伊姆原卡保持退場狀態直到下一個 battle view 切到被黑轉角色；同步更新戰鬥頁版本為 `20260709-blackturn-demo-port-v4`。
- 檔案：`public/board_battle.html`、`public/js/board_battle.js`、`public/js/board_game.js`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`、`node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_battle.html` 與新版 `js/board_battle.js?v=20260709-blackturn-demo-port-v4` 回應 200；用 `rg` 確認 `blackTurnEnemyCardYield` 最後 opacity 為 0，且結束計時器不再移除 `black-turn-receiver`。
- 風險：只改伊姆黑轉支配正式視覺結尾與快取版本，不改黑轉規則、存檔格式、Socket.IO event 或 localStorage key。

- 範圍：修正正式戰鬥頁黑轉支配移植後與示範頁不一致的多餘演出。移除正式頁黑轉施放時額外觸發的 cut-in、畫面震動、敵方 angry pose、我方 hit pose 與浮動標題條；`swap-front` 改到 80% 翻面當下才套用，避免抽取卡在抵達伊姆後方但尚未翻面前跑到前景蓋住不該蓋的圖片。同步更新戰鬥頁版本為 `20260709-blackturn-demo-port-v3`。
- 檔案：`public/board_battle.html`、`public/js/board_battle.js`、`public/js/board_game.js`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`、`node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_battle.html` 與新版 `js/board_battle.js?v=20260709-blackturn-demo-port-v3` 回應 200；檢查 `playBlackTurnCastFx()` 已移除黑轉專用 cut-in / shake / 強制 pose，且 `swap-front` 排程為 `duration * 0.8`。
- 風險：只收斂伊姆黑轉支配正式視覺演出與快取版本，不改黑轉規則、存檔格式、Socket.IO event 或 localStorage key。

- 範圍：將已確認的黑轉支配示範頁演出接入正式戰鬥頁。`public/board_battle.html` 的黑轉抽取卡改用示範頁同款 `translate3d(...)` / linear 動畫，12% 後顯示、30% 走同一直線中繼點、35% 到伊姆整張卡中心後方、80% 側面切 angry / 惡魔化、80.01% 從另一側翻回；伊姆敵方卡改成整張卡與配件一起 `blackTurnEnemyCardYield` 退到後方，黑轉名牌只保留底圖不顯示名字。`public/js/board_battle.js` 補 `--black-turn-move-30-*` 計算與 8400ms 基準時間，`public/js/board_game.js` 將正式黑轉視覺事件 duration 改為 8400 並更新戰鬥頁版本。
- 檔案：`public/board_battle.html`、`public/js/board_battle.js`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`、`node --check public/js/board_game.js`；解析 `public/board_battle.html` 內嵌 script；確認 `http://127.0.0.1:8787/board_battle.html` 回應 200；用 `rg` 確認正式頁已使用 `translate3d`、`blackTurnEnemyCardYield`、`duration: 8400` 與新版 `BATTLE_PAGE_VERSION`。
- 風險：只改伊姆黑轉支配正式視覺演出、事件 duration 與快取版本，不新增或改名 `gameState` 欄位、不改 Socket.IO event 名稱、不改黑轉規則與存檔格式。

- 範圍：依使用者提供的最新黑轉支配惡魔化配件 JSON，將 `public/board_black_turn_demo.html` 的 CSS fallback 同步到目前 `layerDefaults`。示範頁未套 JS 變數前也會使用左翼 `x-21 y46.5 w50 h100 strength0.5`、右翼 `x123 y46.5 w50 h100 strength0.5`、角 `x50 y-1.5 w71 h56 strength0.5`、方框 `x50 y50 w130.5 h135.5 strength1.35 z10`、紅眼 `x50 y22.5 w78.5 h86 opacity0.3 strength0.5 normal`、名牌 `x50 y101 w126 h26 strength0.5`，角色暗化 fallback 改為 brightness 80。
- 檔案：`public/board_black_turn_demo.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200；用 `rg` 檢查示範頁 fallback 值已與最新 JSON 對齊。
- 風險：只改本機黑轉支配示範頁 CSS 預設值與文件，不改正式戰鬥頁、黑轉規則、存檔、Socket.IO event 或 localStorage key。

- 範圍：依使用者要求讓黑轉支配示範頁名牌只保留原圖、不顯示名字。`public/board_black_turn_demo.html` 保留 `demon_nameplate.webp` 名牌底圖圖層，但在惡魔化狀態下將 `.captured-nameplate` 文字層 `display: none`，不再顯示「黑轉・角色名」。
- 檔案：`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200；用 `rg` 確認 `demon-nameplate-img` 仍存在且 `.captured-nameplate` 在惡魔化狀態下隱藏。
- 風險：只改本機黑轉示範頁名牌文字顯示，不改正式戰鬥頁、黑轉規則、存檔、Socket.IO event 或 localStorage key。

- 範圍：修正黑轉支配示範頁翻轉看起來像「翻一半又翻回來」的問題。`public/board_black_turn_demo.html` 的 `blackTurnExtractCard` 在 80% 轉到 `rotateY(88deg)` 側面，80.01% 瞬間切到 `rotateY(-88deg)`，88% 回到正面；angry 圖與惡魔化配件也提前到 `duration * 0.8` 側面時切換，讓觀感像同一次完整翻面，而不是 0 -> 88 -> 0 退回原面。
- 檔案：`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200；用 `rg` 確認 `80.01%`、`rotateY(-88deg)` 與 `duration * 0.8` 已接入。
- 風險：只改本機黑轉示範頁翻轉視覺，不改正式戰鬥頁、黑轉規則、存檔、Socket.IO event 或 localStorage key。

- 範圍：依使用者要求再加快黑轉支配示範頁的抽取移動段。`public/board_black_turn_demo.html` 將抽取抵達伊姆後方的 keyframe 從 43% 提前到 35%，`moveEndAt` 同步從 43 改為 35；翻轉仍維持 80% 才開始，惡魔化與收尾節奏不變。
- 檔案：`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200；用 `rg` 確認 `35%, 54%`、`moveEndAt = 35` 與翻轉 80% 已接入。
- 風險：只改本機黑轉示範頁抽取移動速度，不改正式戰鬥頁、黑轉規則、存檔、Socket.IO event 或 localStorage key。

- 範圍：依使用者澄清「只要移動速度條快，翻轉不用」調整黑轉支配示範頁。`public/board_black_turn_demo.html` 將 `BASE_DURATION` 從 4200ms 恢復為 8400ms，讓翻轉、惡魔化與收尾節奏回到原本速度；抽取移動段單獨加速，從 12% 到 43% 一路線性抵達 `end-x` / `end-y`，43% 到 80% 停在伊姆後方等待翻轉，80% 才開始翻面。
- 檔案：`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200；用 `rg` 確認 `BASE_DURATION = 8400`、`moveEndAt = 43`、抽取 keyframe 43% 與翻轉 80% 已接入。
- 風險：只改本機黑轉示範頁抽取移動速度，不改正式戰鬥頁、黑轉規則、存檔、Socket.IO event 或 localStorage key。

- 範圍：依使用者要求將黑轉支配示範頁整體速度加快一倍。`public/board_black_turn_demo.html` 的 `BASE_DURATION` 從 8400ms 改為 4200ms，所有抽取、對齊、翻轉、惡魔化時間點仍用原本比例計算；速度下拉的預設文字從「慢速 1x」改為「標準 1x」以符合新的基準速度。
- 檔案：`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200；用 `rg` 確認 `BASE_DURATION = 4200` 與「標準 1x」已接入。
- 風險：只改本機黑轉示範頁基準播放速度與顯示文字，不改正式戰鬥頁、黑轉規則、存檔、Socket.IO event 或 localStorage key。

- 範圍：依使用者要求讓黑轉支配示範頁抽取卡「同速不停到底」。`public/board_black_turn_demo.html` 的抽取移動段改為 12% 到 74% 一路線性到 `end-x` / `end-y`；30% 與 54% 的位置由 JS 按同一直線比例預先計算成 `--move-30-x/y`、`--move-54-x/y`，避免中途煞車；移除 66% 到 74% 的停住段，提示文字也改到 74% 才顯示抵達後方，80% 再開始翻轉。
- 檔案：`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200；確認抽取關鍵幀使用 `--move-30-x/y`、`--move-54-x/y` 與 74% 終點。
- 風險：只改本機黑轉示範頁抽取移動節奏，不改正式戰鬥頁、黑轉規則、存檔、Socket.IO event 或 localStorage key。

- 範圍：修正黑轉支配示範頁抽取卡移動途中像停頓三次的問題。`public/board_black_turn_demo.html` 的 `.black-turn-fx.show .captured-card` 動畫 timing function 從 `cubic-bezier(0.16, 0.84, 0.18, 1)` 改為 `linear`，避免 CSS 在 30%、54%、66% 等中繼關鍵幀每段重新 ease 造成走走停停；位置、終點、66% 到伊姆後方、74% 停住與 80% 翻轉節奏維持不變。
- 檔案：`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200；用 `rg` 確認 `blackTurnExtractCard` 已使用 `linear`。
- 風險：只改本機黑轉示範頁抽取移動速度曲線，不改正式戰鬥頁、黑轉規則、存檔、Socket.IO event 或 localStorage key。

- 範圍：優化黑轉支配示範頁抽取卡頓。`public/board_black_turn_demo.html` 的抽取卡不再用 `left` / `top` 逐幀移動，改成固定 `left: 0; top: 0` 並以 `translate3d(calc(var(...) - 50%), ...)` 移動，保留原本 66% 對齊伊姆後方、74% 停住、80% 翻轉的節奏；同時把 `will-change` 收斂為 `transform, opacity, filter`，避免瀏覽器每幀做不必要的 layout 重排。
- 檔案：`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200；確認抽取關鍵幀已改用 `translate3d(...)`，且 `captured-card` 保持 `overflow: visible` 避免惡魔化配件被裁切。
- 風險：只改本機黑轉示範頁抽取卡的動畫實作方式，不改正式戰鬥頁、黑轉規則、存檔、Socket.IO event 或 localStorage key；若示範頁順暢再移植正式戰鬥頁。

- 範圍：依使用者要求先修黑轉支配示範頁的抽取終點。`public/board_black_turn_demo.html` 的 `blackTurnExtractCard` 改成 54% 還在 `end-entry` 路徑中，66% 起已完全到 `end-x` / `end-y`（伊姆整張卡中心後方）且保持不旋轉，74% 仍停在伊姆後方，80% 才開始翻轉；避免示範頁看起來像從伊姆旁邊滑進去而不是先到正後方對齊。
- 檔案：`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200；確認示範頁 `blackTurnExtractCard` 在 66% / 74% 使用 `left: var(--end-x)` 與 `top: var(--end-y)`。
- 風險：只改本機黑轉示範頁的視覺關鍵幀，不改正式戰鬥頁、黑轉規則、存檔、Socket.IO event 或 localStorage key；使用者確認示範頁後再移植正式戰鬥頁。

- 範圍：修正正式戰鬥頁黑轉抽取終點沒有完全對齊伊姆後方的問題。`public/js/board_battle.js` 的 `positionBlackTurnCastFx()` 改用整張 `playerCard` / `enemyCard` 的中心與尺寸計算 start / end / card-w / card-h，對齊 `public/board_black_turn_demo.html` 示範頁基準；不再用 `playerPortraitWrap` / `enemyPortraitWrap` 內部頭像框當終點，避免抽出的卡只對到伊姆圖框而不是伊姆整張戰鬥卡後方。同步更新主頁 `BATTLE_PAGE_VERSION` 與戰鬥頁 script query 為 `20260709-blackturn-card-align-v1`。
- 檔案：`public/board_battle.html`、`public/js/board_battle.js`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`、`node --check public/js/board_game.js`；用 `rg` 確認正式頁黑轉定位使用 `refs.playerCard` / `refs.enemyCard` 且新版 `20260709-blackturn-card-align-v1` 已接入；示範頁未改動，仍維持基準節奏。
- 風險：只改正式戰鬥頁黑轉視覺定位基準與快取版本，不改示範頁、不改黑轉抽選規則、被支配船員資料、伊姆技能數值、戰鬥結算、`gameState` / `battleState` 欄位、Socket.IO event 或 localStorage key。

- 範圍：修正上一輪誤動黑轉示範頁的問題。依使用者指出「原本示範頁是對的」，將 `public/board_black_turn_demo.html` 的黑轉抽取 / 翻轉節奏恢復到原本基準：`end-entry` 使用原安全距離、66% 顯示「開始翻轉」、74% 才加 `swap-front`、80% 進入伊姆中心翻面；正式戰鬥頁也先恢復同一組基準節奏。同步更新主頁 `BATTLE_PAGE_VERSION` 與戰鬥頁 script query 為 `20260709-blackturn-demo-restore-v1`，避免讀到上一輪錯改的 `blackturn-flip-sync` 版本。
- 檔案：`public/board_battle.html`、`public/js/board_battle.js`、`public/js/board_game.js`、`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`、`node --check public/js/board_game.js`；執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；用 `rg` 確認示範頁恢復 `duration * 0.66` / `duration * 0.74`，正式頁版本為 `20260709-blackturn-demo-restore-v1`。
- 風險：只還原黑轉支配示範頁與正式頁的視覺節奏 / 快取版本，不改黑轉抽選規則、被支配船員資料、伊姆技能數值、戰鬥結算、`gameState` / `battleState` 欄位、Socket.IO event 或 localStorage key；後續若要修正式頁，應以此示範頁為不可改基準。

- 範圍：依使用者回饋再修伊姆黑轉支配抽取與翻轉銜接。正式戰鬥頁與 `public/board_black_turn_demo.html` 將抽出卡的 `end-entry` 安全距離加大，讓抽出段停在伊姆卡外側；`swap-front` 從 74% 延後到 82%，伊姆複製圖也延後到翻轉段才顯示，避免抽出的角色圖在移動途中蓋住原本出戰角色或伊姆，並讓伊姆與被支配角色在同一段同步翻轉。同步更新主頁 `BATTLE_PAGE_VERSION` 與戰鬥頁 script query 為 `20260709-blackturn-flip-sync-v1`。
- 檔案：`public/board_battle.html`、`public/js/board_battle.js`、`public/js/board_game.js`、`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`、`node --check public/js/board_game.js`；執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_battle.html`、`/board_black_turn_demo.html` 回應 200；用 `rg` 確認 `clearBase` / `0.82` / 新版 `20260709-blackturn-flip-sync-v1` 已接入；用 PowerShell 掃描本次修改檔案尾端空白。因本專案未安裝 Playwright，視覺仍需由使用者用示範頁與正式戰鬥頁實機確認。
- 風險：只改黑轉支配的視覺路徑、翻轉時間點與快取版本，不改黑轉抽選規則、被支配船員資料、伊姆技能數值、戰鬥結算、`gameState` / `battleState` 欄位、Socket.IO event 或 localStorage key。

- 範圍：依使用者要求試撤五檔・尼卡框的雲冠圖層。正式戰鬥頁 `public/board_battle.html` 不再插入 `nika_cloud_crown.webp`，`public/board_nika_frame_demo.html` 也移除雲冠 CSS、圖片與微調面板中的 `cloudCrown` 圖層；目前尼卡框只保留日光、左右白煙、主方框與角色名字文字。同步更新主頁 `BATTLE_PAGE_VERSION` 與戰鬥頁 script query 為 `20260709-nika-no-crown-v1`，避免平板 / iframe 讀到舊雲冠。
- 檔案：`public/board_battle.html`、`public/board_nika_frame_demo.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check public/js/board_battle.js`；執行 Node 解析 `public/board_nika_frame_demo.html` 內嵌 script；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_battle.html`、`/board_nika_frame_demo.html` 回應 200；用 `rg` 確認正式頁與示範頁不再引用 `nika_cloud_crown.webp`，新版 `20260709-nika-no-crown-v1` 已接入；因目前 Board 檔案多為 git untracked，改用 PowerShell 掃描本次修改檔案尾端空白。
- 風險：只移除五檔・尼卡框的雲冠視覺與快取版本，不改五檔覺醒條件、角色資料、技能數值、`gameState` / `battleState` 欄位、Socket.IO event 或 localStorage key；`nika_cloud_crown.webp` 檔案保留在素材資料夾備用。

- 範圍：再次修正伊姆黑轉支配抽取演出。正式戰鬥頁與 `public/board_black_turn_demo.html` 新增 `start-exit` / `end-entry` 座標，抽出的角色卡在玩家角色中心與伊姆中心時維持不可見，離開玩家角色卡後才顯示，靠近伊姆時先停在伊姆旁邊，翻轉階段才進入伊姆中心，避免遮住原本出戰角色與伊姆。另將伊姆本體與黑轉演出中的伊姆複製圖排除暗化：伊姆保留黑轉配件但不套黑轉暗化 / 褪色濾鏡，被支配船員才套暗化。同步更新主頁 `BATTLE_PAGE_VERSION` 與戰鬥頁 script query 為 `20260709-blackturn-clear-extract-v1`。
- 檔案：`public/board_battle.html`、`public/js/board_battle.js`、`public/js/board_game.js`、`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check public/js/board_battle.js`；執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_battle.html`、`/board_black_turn_demo.html` 回應 200；用 `rg` 確認 `start-exit` / `end-entry`、`black-turn-imu-active` 與新版 `20260709-blackturn-clear-extract-v1` 已接入；因目前 Board 檔案多為 git untracked，改用 PowerShell 掃描本次修改檔案尾端空白。
- 風險：只改黑轉支配正式戰鬥頁與示範頁的視覺路徑 / 濾鏡 / 快取版本，不改黑轉抽選規則、被支配船員資料、伊姆技能數值、戰鬥結算、`gameState` / `battleState` 欄位、Socket.IO event 或 localStorage key；仍需實機看一次抽取路徑是否符合使用者期待。

- 範圍：依使用者回饋修正伊姆黑轉支配抽取層級。正式戰鬥頁的 `black-turn-cast-fx` 預設 z-index 從 8 降到 1，低於玩家 / 敵方角色卡，讓被黑轉角色卡從原本角色圖後方抽出與移動時不蓋住原本角色；到翻轉階段仍沿用既有 `swap-front` 升到前景。同步更新主頁 `BATTLE_PAGE_VERSION` 與戰鬥頁 script query 為 `20260709-blackturn-behind-player-v1`，避免平板 / iframe 讀到舊層級。
- 檔案：`public/board_battle.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check public/js/board_battle.js`；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_battle.html` 回應 200；用 `rg` 確認 `black-turn-cast-fx` 預設 `z-index: 1`、`swap-front` 保持 `z-index: 58`，且新版 `20260709-blackturn-behind-player-v1` 已接入；因目前 Board 檔案多為 git untracked，改用 PowerShell 掃描本次修改檔案尾端空白。
- 風險：只改黑轉支配正式戰鬥頁視覺層級與快取版本，不改黑轉抽選規則、被支配船員資料、伊姆技能數值、戰鬥結算、`gameState` / `battleState` 欄位、Socket.IO event 或 localStorage key；仍需實機看一次抽取前段是否完全不遮住原本角色。

- 範圍：套用使用者提供的五檔・尼卡框最新座標。正式戰鬥頁與 `public/board_nika_frame_demo.html` 的 `frame` 圖層由 `y 50 / w 119 / h 130` 改為 `y 48.5 / w 116 / h 116`，其他日光、左右白煙、雲冠與角色本體濾鏡維持使用者貼上的設定。同步更新主頁 `BATTLE_PAGE_VERSION` 與戰鬥頁 script query 為 `20260709-nika-frame-values-v1`，避免平板 / iframe 讀到舊座標。
- 檔案：`public/board_battle.html`、`public/board_nika_frame_demo.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check public/js/board_battle.js`；執行 Node 解析 `public/board_nika_frame_demo.html` 內嵌 script；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_battle.html`、`/board_nika_frame_demo.html` 回應 200；用 `rg` 確認 `20260709-nika-frame-values-v1` 與 `y: 48.5, w: 116, h: 116` 已接入；因目前 Board 檔案多為 git untracked，改用 PowerShell 掃描本次修改檔案尾端空白。
- 風險：只改五檔・尼卡框圖層座標與快取版本，不改五檔覺醒條件、角色資料、技能數值、戰鬥流程、`gameState` / `battleState` 欄位、Socket.IO event 或 localStorage key；仍需實機看一次桌機 / 平板框線是否貼齊角色卡。

- 範圍：依使用者要求移除五檔・尼卡框的名牌底圖。正式戰鬥頁 `public/board_battle.html` 不再插入 `nika_nameplate.webp` 圖層，`public/board_nika_frame_demo.html` 也移除名牌底圖圖片、CSS 與微調面板中的 `nameplate` 圖層；角色名稱文字本身保留。同步更新主頁 `BATTLE_PAGE_VERSION` 與戰鬥頁 script query 為 `20260709-nika-no-nameplate-v1`，避免平板 / iframe 讀到舊框。
- 檔案：`public/board_battle.html`、`public/board_nika_frame_demo.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；執行 Node 解析 `public/board_nika_frame_demo.html` 內嵌 script；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_battle.html`、`/board_nika_frame_demo.html` 回應 200；用 `rg` 確認正式頁與示範頁不再引用 `nika_nameplate.webp`，新版 `20260709-nika-no-nameplate-v1` 已接入；因目前 Board 檔案多為 git untracked，改用 PowerShell 掃描本次修改檔案尾端空白。
- 風險：只移除五檔・尼卡框的名牌底圖視覺與快取版本，不改五檔覺醒條件、角色資料、技能數值、`gameState` / `battleState` 欄位、Socket.IO event 或 localStorage key；`nika_nameplate.webp` 檔案保留在素材資料夾備用。

- 範圍：依使用者回饋，讓正式戰鬥頁的伊姆黑轉抽取動畫對齊 `public/board_black_turn_demo.html` 示範頁。被抽出的角色卡在抽出與拖到伊姆後方階段維持完整不透明、不壓暗、不提前翻轉；抵達伊姆後方才切到前景、原地翻轉、切 angry / attack 圖並展開惡魔化配件，最後停住到視覺事件收尾。同步更新主頁 `BATTLE_PAGE_VERSION` 與戰鬥頁 script query 為 `20260709-blackturn-demo-match-v1`，避免 iframe 快取舊動畫。
- 檔案：`public/board_battle.html`、`public/js/board_battle.js`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`、`node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_battle.html` 回應 200；用 `rg` 確認 `blackTurnExtractCard`、`swap-front` 與新版 `20260709-blackturn-demo-match-v1` 已接入；因目前 Board 檔案多為 git untracked，改用 PowerShell 掃描本次修改檔案尾端空白。
- 風險：只改黑轉支配的正式戰鬥頁視覺節奏與快取版本，不改黑轉抽選規則、被支配船員敵人資料、伊姆技能數值、戰鬥結算、`gameState` / `battleState` 欄位、Socket.IO event 或 localStorage key；仍需實機看一次伊姆施法是否完全符合示範頁觀感。

- 範圍：將黑轉支配示範頁定稿的惡魔化配件正式接入獨立戰鬥頁。`public/board_battle.html` 新增黑轉左右翼、角、方框、紅眼與名牌圖層；伊姆本戰敵方卡片與 `final_black_turn_*` 被支配船員前哨戰會常駐惡魔化配件與暗化濾鏡，黑轉施法演出則在約 88% 進度切成被支配角色的 angry / attack 圖並展開同款配件。同步更新主頁 `BATTLE_PAGE_VERSION` 與戰鬥頁 script query，避免 iframe 快取舊頁面。
- 檔案：`public/board_battle.html`、`public/js/board_battle.js`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`、`node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_battle.html` 回應 200，且 6 張 `public/images/board/battle/black_turn/*.webp` 皆回應 200；用 `rg` 確認 `black-turn-demon-active`、`syncBlackTurnDemonFrame`、`blackTurnDemonCastName` 與新版 `20260709-blackturn-demon-frame-v1` 已接入；因目前 Board 檔案多為 git untracked，改用 PowerShell 掃描本次修改檔案尾端空白。
- 風險：只改黑轉支配與伊姆 / 被支配船員的正式戰鬥頁視覺，不改黑轉抽選規則、被支配船員敵人資料、伊姆技能數值、戰鬥結算、`gameState` / `battleState` 欄位、Socket.IO event 或 localStorage key；仍需實機看一次伊姆戰、黑轉施法與切入前哨戰的配件尺寸。

- 範圍：套用使用者輸出的五檔・尼卡框定稿座標，更新 `public/board_nika_frame_demo.html` 預設值，並正式接入獨立戰鬥頁玩家卡片。當目前上場角色為 `luffy_gear_fifth` 或顯示名稱含「五檔 / 尼卡」時，`public/board_battle.html` 會在玩家 `combat-card` 上顯示日光、左右白煙、雲冠、主方框與名牌配件；普通魯夫與覺醒前待機演出不會先顯示尼卡框。
- 檔案：`public/board_nika_frame_demo.html`、`public/board_battle.html`、`public/js/board_battle.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`；執行 Node 解析 `public/board_nika_frame_demo.html` 內嵌 script；確認 `http://127.0.0.1:8787/board_battle.html` 與 `/board_nika_frame_demo.html` 回應 200；確認 6 張 `public/images/board/battle/nika_frame/*.webp` 皆回應 200；用 `rg` 確認 `nika-frame-active`、`isNikaFrameCombatant` 與新版 `20260709-nika-frame-v1` 已接入；因目前 Board 檔案多為 git untracked，改用 PowerShell 掃描本次修改檔案尾端空白。
- 風險：只改五檔上場時的戰鬥頁視覺與示範頁預設座標，不改五檔覺醒條件、角色資料、技能數值、`gameState` / `battleState` 欄位、Socket.IO event 或 localStorage key；仍需實機用五檔角色進戰鬥看一次桌機 / 平板比例。

- 範圍：依使用者要求，把五檔・尼卡框本機示範頁改成沿用黑轉示範頁的調整方式。`public/board_nika_frame_demo.html` 由原本置中直式預覽改為方形 `combat-card` 戰鬥卡比例，保留尼卡 6 個實際素材圖層，並新增黑轉頁同款背景選擇、卡片大小選擇、圖層 blend、角色圖亮度 / 飽和 / 對比 / 白光 / 暗角 / 光影微調；輸出 JSON 會標示 `cardShape: "square"` 且保留各圖層 asset path。
- 檔案：`public/board_nika_frame_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_nika_frame_demo.html` 內嵌 script；用 Python 確認尼卡框、五檔 portrait 與示範背景素材路徑皆存在；確認 `http://127.0.0.1:8787/board_nika_frame_demo.html` 回應 200；執行 `git diff --check -- public/board_nika_frame_demo.html docs/PROJECT_OVERVIEW.md docs/FILE_MAP.md docs/DEV_WORKFLOW.md`。
- 風險：只改本機尼卡框示範頁與文件，不改正式戰鬥頁、五檔覺醒流程、存檔欄位、Socket.IO event 或 localStorage key；正式套用仍需等使用者確認方形卡座標。

- 範圍：歸位五檔・尼卡框正式測試素材，並把本機示範頁從 CSS 假配件改為實際圖片圖層。`public/images/board/battle/nika_frame/` 現在包含 `nika_card_frame.webp`、`nika_cloud_crown.webp`、`nika_sun_glow.webp`、`nika_cloud_left.webp`、`nika_cloud_right.webp`、`nika_nameplate.webp`；`public/board_nika_frame_demo.html` 會用五檔魯夫五種 portrait 預覽這 6 個素材，並可微調各圖層 X / Y / W / H / opacity / strength / z，輸出含 asset path 的 JSON。
- 檔案：`public/board_nika_frame_demo.html`、`public/images/board/battle/nika_frame/*.webp`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：重新命名使用者放入的 6 張 WebP；用 Pillow 確認素材尺寸與 RGBA；執行 Node 解析 `public/board_nika_frame_demo.html` 內嵌 script；確認 `http://127.0.0.1:8787/board_nika_frame_demo.html` 回應 200；用瀏覽器確認頁面載入 6 張尼卡配件圖、圖層下拉與輸出 JSON 都正常；執行 `git diff --check -- public/board_nika_frame_demo.html docs/PROJECT_OVERVIEW.md docs/FILE_MAP.md docs/DEV_WORKFLOW.md`。
- 風險：仍是獨立靜態示範頁，不讀寫 `gameState` / `battleState`、不連 Socket.IO、不新增 localStorage key、不影響正式戰鬥頁或五檔覺醒流程；正式接進戰鬥頁需等使用者確認座標。

### 2026-07-08

- 範圍：新增五檔・尼卡框本機示範頁。`public/board_nika_frame_demo.html` 使用既有 `luffy_gear_fifth` 戰鬥半身圖，先以 CSS 做可調的尼卡框構圖：太陽光環、白煙雲框、尼卡方框、左右解放鼓、閃光與名牌；可切換普通 / 戰意 / 士氣 / 受擊 / 虛弱五種五檔表情，並輸出各圖層 X / Y / W / H / opacity / strength / z JSON。頁面另提供透明背景尼卡框生圖提示詞，方便之後用 GPT 生成正式素材再歸位。
- 檔案：`public/board_nika_frame_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_nika_frame_demo.html` 內嵌 script；確認五檔 `normal` / `angry` / `morale` portrait 檔案存在；確認 `http://127.0.0.1:8787/board_nika_frame_demo.html` 回應 200；用瀏覽器確認頁面有 5 種表情、`sunHalo` / `cloudRing` / `frame` / `drumLeft` / `drumRight` / `sparkles` / `nameplate` 7 個圖層、輸出 JSON 與生圖提示文字；執行 `git diff --check -- public/board_nika_frame_demo.html`。
- 風險：新增獨立靜態示範頁，不讀寫 `gameState` / `battleState`、不連 Socket.IO、不新增 localStorage key、不影響正式戰鬥頁或五檔覺醒流程；正式尼卡框仍需使用者確認示範效果或提供生圖素材後再接入。

- 範圍：讓黑轉支配示範頁的伊姆初始卡片也套完整惡魔化配件，不只顯示方框。伊姆敵方卡片新增同款左翼、右翼、角、方框、紅眼與名牌圖層；配件使用與被黑轉角色相同的 CSS 變數，因此微調面板改動 `leftWing` / `rightWing` / `horns` / `frame` / `eyes` / `nameplate` 時，伊姆初始卡與被黑轉角色停格都會同步對齊。順手把圖層下拉預設從舊 `wings` 改為目前第一個 key `leftWing`。
- 檔案：`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；確認伊姆卡片含 `enemy-demon-layer` 的左翼、右翼、角、方框、紅眼、名牌 6 個配件，且 `setLayerVars()` 同步寫入 `refs.fx` 與 `refs.enemyCard`；確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200；用瀏覽器確認伊姆初始卡片有 6 個配件、圖層下拉預設為 `leftWing`，且伊姆卡片拿到 `--demon-leftWing-x: -21%`、`--demon-rightWing-x: 123%` 與 `--demon-horns-z: 7`；執行 `git diff --check -- public/board_black_turn_demo.html docs/PROJECT_OVERVIEW.md docs/FILE_MAP.md docs/DEV_WORKFLOW.md`。
- 風險：只改本機黑轉示範頁與文件，不改正式戰鬥頁、黑轉規則、存檔、Socket.IO event 或 localStorage key；正式移植時需同步處理伊姆初始卡與被支配角色停格兩組配件。

- 範圍：套用使用者輸出的黑轉支配左右翼新預設。`leftWing` 改為 `x -21 y 46.5 w 50 h 100 opacity 1 strength 0.5 z 1 normal`，`rightWing` 改為 `x 123 y 46.5 w 50 h 100 opacity 1 strength 0.5 z 1 normal`；同步更新 CSS fallback 與 `layerDefaults`，其他角色本體濾鏡、角、方框、紅眼與名牌設定維持不變。
- 檔案：`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；確認 `leftWing` / `rightWing` 預設值與 CSS fallback 均為使用者輸出的新數值；確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200；執行 `git diff --check -- public/board_black_turn_demo.html docs/PROJECT_OVERVIEW.md docs/DEV_WORKFLOW.md`。
- 風險：只改本機黑轉示範頁左右翼預設與文件，不改正式戰鬥頁、素材檔、黑轉規則、存檔、Socket.IO event 或 localStorage key；正式移植仍需同步使用 `leftWing` / `rightWing` 新 key。

- 範圍：將黑轉支配惡魔翅膀素材拆成左右兩張並接入示範頁。由 `demon_wings_shadow.webp` 產生 `demon_wing_left_shadow.webp` 與 `demon_wing_right_shadow.webp`，清掉低 alpha 邊緣殘留後分別裁切透明圖；示範頁原本單一 `wings` 圖層改為 `leftWing` / `rightWing`，可分開調整 X / Y / W / H / opacity / strength / z / blend。預設座標依原本整張翅膀顯示位置換算為左翼 `x -19.1 y 56.7 w 121.7 h 227.2`、右翼 `x 118.7 y 58.5 w 122.1 h 228.3`。
- 檔案：`public/images/board/battle/black_turn/demon_wing_left_shadow.webp`、`public/images/board/battle/black_turn/demon_wing_right_shadow.webp`、`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：用 PIL 確認左右翼新素材皆為 RGBA 且非 0 bytes；執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；確認 `leftWing` / `rightWing`、新素材路徑與左右翼 CSS class 已接入；確認 `http://127.0.0.1:8787/images/board/battle/black_turn/demon_wing_left_shadow.webp`、`http://127.0.0.1:8787/images/board/battle/black_turn/demon_wing_right_shadow.webp`、`http://127.0.0.1:8787/board_black_turn_demo.html` 皆回應 200；用瀏覽器確認微調面板顯示「左翅膀 / 右翅膀」，輸出 JSON 含 `layers.leftWing` / `layers.rightWing` 且已無舊 `layers.wings`；執行 `git diff --check -- public/board_black_turn_demo.html docs/PROJECT_OVERVIEW.md docs/FILE_MAP.md docs/DEV_WORKFLOW.md`。
- 風險：只改本機黑轉示範頁與新增拆分素材，原始 `demon_wings_shadow.webp` 保留不刪；不改正式戰鬥頁、黑轉規則、存檔、Socket.IO event 或 localStorage key。由於 JSON key 從 `wings` 改為 `leftWing` / `rightWing`，正式移植時需同步對應新 key。

- 範圍：套用使用者新輸出的黑轉支配示範頁視覺預設。角色本體濾鏡 `portrait.brightness` 從 58 調為 80，`saturation 72`、`contrast 132`、`tint 0.32`、`vignette 0.62`、`shadow 24` 與翅膀、角、方框、紅眼、名牌圖層座標 / 層級 / 濃度維持使用者輸出的定稿值。
- 檔案：`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；確認 `portraitDefaults.brightness` 為 80、`frame` 預設 `opacity: 1`，且 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200；執行 `git diff --check -- public/board_black_turn_demo.html docs/PROJECT_OVERVIEW.md docs/DEV_WORKFLOW.md`。
- 風險：只改本機黑轉示範頁的角色本體亮度預設與文件，不改正式戰鬥頁、素材檔、黑轉規則、存檔、Socket.IO event 或 localStorage key。

- 範圍：修正前一輪對「伊姆本來就有這個框」的理解。黑轉支配示範頁現在讓伊姆敵方卡片一開始就顯示 `demon_card_frame.webp` 同款方框，新增 `.enemy-demon-frame` 疊在伊姆 portrait 外；同時將被支配角色的 `frame` 圖層預設 `opacity` 從 0 恢復為 1，讓黑轉完成後看起來像被支配角色接上伊姆原本的支配框。
- 檔案：`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；確認 `.enemy-demon-frame`、`demon_card_frame.webp` 與 `frame` 預設 `opacity: 1` 已接入；確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200；執行 `git diff --check -- public/board_black_turn_demo.html docs/PROJECT_OVERVIEW.md docs/FILE_MAP.md docs/DEV_WORKFLOW.md`。
- 風險：只改本機黑轉示範頁的伊姆初始方框顯示、被支配角色方框預設與文件，不改正式戰鬥頁、素材檔、黑轉規則、存檔、Socket.IO event 或 localStorage key。

- 範圍：依使用者回饋調整黑轉支配示範頁惡魔化方框。因伊姆戰鬥卡本身已有框感，示範頁將 `frame` 圖層保留在微調工具中，但預設 `opacity` 從 1 改為 0，避免黑轉後被支配角色看起來像直接套用伊姆既有框；使用者仍可手動拉高透明度比較效果。
- 檔案：`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；用字串檢查確認 `frame` 預設 `opacity: 0`；確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200；執行 `git diff --check -- public/board_black_turn_demo.html docs/PROJECT_OVERVIEW.md docs/DEV_WORKFLOW.md`。
- 風險：只改本機黑轉示範頁方框圖層預設透明度與文件，不改正式戰鬥頁、素材檔、黑轉規則、存檔、Socket.IO event 或 localStorage key。

- 範圍：黑轉支配示範頁新增「角色圖調整」。黑轉完成後的被支配角色本體現在可調亮度、飽和、對比、紫紅覆蓋、暗角與紅影；停格卡片新增紫紅覆蓋 / 暗角 pseudo layer，濾鏡透過 CSS 變數套用。座標輸出 JSON 也新增 `portrait` 區塊，讓使用者可把角色本體濾鏡參數一起回傳，並新增「重置角色圖」按鈕；「全部重置」會同時重置裝飾圖層與角色圖濾鏡。
- 檔案：`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200；用 `rg` 確認 `角色圖調整`、`portraitDefaults`、`--portrait-brightness` 與 JSON `portrait` 欄位已接入；用瀏覽器填入亮度 44、飽和 38、對比 150、紫紅 0.55、暗角 0.8、紅影 36，確認 CSS 變數與輸出 JSON 同步；執行 `git diff --check -- public/board_black_turn_demo.html docs/PROJECT_OVERVIEW.md docs/FILE_MAP.md docs/DEV_WORKFLOW.md`。
- 風險：只改本機黑轉示範頁的視覺調整工具與文件，不改正式戰鬥頁、素材檔、黑轉規則、存檔、Socket.IO event 或 localStorage key；此紀錄當時尚未移植正式戰鬥頁，2026-07-09 已接入正式戰鬥頁。

- 範圍：套用使用者輸出的黑轉支配惡魔化裝飾座標為示範頁預設值。`layerDefaults` 改為翅膀 `x50 y61.5 w260 h260 opacity1 strength0.5 z1 normal`、角 `x50 y-1.5 w71 h56 opacity1 strength0.5 z7 normal`、方框 `x50 y50 w130.5 h135.5 opacity1 strength1.35 z10 normal`、紅眼 `x50 y22.5 w78.5 h86 opacity0.3 strength0.5 z9 normal`、名牌 `x50 y101 w126 h26 opacity1 strength0.5 z10 normal`。
- 檔案：`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；用字串檢查確認五個 `layerDefaults` 已套用指定座標 / 層級 / 濃度；確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200；執行 `git diff --check -- public/board_black_turn_demo.html docs/PROJECT_OVERVIEW.md docs/DEV_WORKFLOW.md`。
- 風險：只改本機黑轉示範頁預設座標與文件，不改正式戰鬥頁、素材檔、黑轉規則、存檔、Socket.IO event 或 localStorage key；此紀錄當時尚未移植正式戰鬥頁，2026-07-09 已接入正式戰鬥頁。

- 範圍：黑轉支配示範頁裝飾圖層取消固定長寬比例。將翅膀、角、方框、紅眼與名牌圖層的 `object-fit` 從 `contain` 改為 `fill`，讓微調面板的 W / H 可以真正各自拉伸，不再因圖片原比例而只改外框尺寸。
- 檔案：`public/board_black_turn_demo.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：用 `rg` 確認示範頁 5 個 `.demon-*` 裝飾圖層皆使用 `object-fit: fill`；執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200。
- 風險：只改本機黑轉示範頁裝飾圖層的顯示方式與文件，不改正式戰鬥頁、素材檔、黑轉規則、存檔、Socket.IO event 或 localStorage key。

- 範圍：黑轉支配示範頁微調面板新增濃度、上下層級與混合模式控制。惡魔化裝飾素材皆確認為 RGBA alpha，因此翅膀、角、方框與名牌預設改用 `normal` 混合，紅眼保留 `screen`，並以 `brightness()` 提高預設濃度，減少裝飾看起來太透明的問題。每個圖層現在可調整 X / Y / W / H / opacity / strength / z / blend；名牌文字在惡魔化狀態下會跟隨名牌圖層 z 值保持在名牌圖前。
- 檔案：`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：用 Python/PIL 確認 `public/images/board/battle/black_turn/*.webp` 皆為 RGBA alpha；執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200；用瀏覽器測試微調面板切到方框後調整 strength、z 與 blend，確認 CSS 變數與輸出 JSON 同步。
- 風險：只改本機黑轉示範頁與文件，不改正式戰鬥頁、素材檔、黑轉規則、存檔、Socket.IO event 或 localStorage key；新座標 / 層級輸出仍需使用者確認後才移植正式戰鬥頁。

### 2026-07-07

- 範圍：黑轉支配示範頁新增裝飾微調與座標輸出。示範頁寬度與舞台高度放大，降低惡魔化裝飾被邊界擋住的機率；新增「裝飾微調」面板，可切換翅膀、角、方框、紅眼與名牌，調整 X / Y / W / H / opacity，並即時套用到 CSS 變數。輸出框會產生百分比座標 JSON，包含 `unit`、`anchor`、`note` 與各圖層座標，並提供複製、重置單一圖層與全部重置。
- 檔案：`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200；用瀏覽器載入示範頁，確認 `layerSelect` 有 5 個圖層、座標輸出 JSON 產生，並測試調整方框 X / W 會同步更新 CSS 變數與輸出值。
- 風險：只改本機黑轉示範頁與文件，不改正式戰鬥頁、素材檔、黑轉規則、存檔、Socket.IO event 或 localStorage key；座標尚未移植到正式戰鬥頁。

- 範圍：依使用者回饋微調黑轉支配示範頁惡魔化停格。移除示範頁中的 `demon_inner_aura.webp` 旋轉圓形與相關旋轉動畫；翅膀與角改成固定座標與固定縮放，不再脈動或漂移；惡魔方框、紅眼光與名字牌提高圖層，確保方框壓在被黑轉角色圖前面。
- 檔案：`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：用 `rg` 確認 `public/board_black_turn_demo.html` 已無 `demon-aura`、`demonAuraSpin`、`demonWingPulse` 與 `demon_inner_aura` 引用；執行 Node 解析內嵌 script；確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200；用瀏覽器載入示範頁等待停格，確認只剩 5 個 `.demon-layer`、`hasAura=false`、人物圖 z-index 為 2、方框 z-index 為 8，並截圖確認圓形消失且方框在圖前。
- 風險：只改本機黑轉示範頁與文件，不改正式戰鬥頁、素材檔、黑轉規則、存檔、Socket.IO event 或 localStorage key。

- 範圍：黑轉支配示範頁新增背景圖切換。工具列加入「背景」下拉選單，預設使用 `elbaph_imu_descent_giant_tree.webp`，並可切換最終之島暗天、瑪麗喬亞革命戰、盤古城深處、黑鬍子黑暗漩渦或回到原本黑霧漸層；舞台改用 CSS 變數控制背景圖與位置，切換後會重新計算黑轉抽出 / 落點座標。
- 檔案：`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；確認五張示範背景來源檔案存在；確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 與預設背景圖 URL 回應 200；用瀏覽器載入示範頁，確認 `backgroundSelect` 預設為 `elbaph_imu`、舞台套用 `with-background` 且 CSS `background-image` 指向 `elbaph_imu_descent_giant_tree.webp`，截圖確認黑轉停格與背景同時顯示。
- 風險：只改本機黑轉示範頁與文件，不改正式戰鬥頁、背景素材檔、黑轉規則、存檔、Socket.IO event 或 localStorage key。

- 範圍：將黑轉支配惡魔化 UI 配件套進本機示範頁。`public/board_black_turn_demo.html` 現在會在被抽出的船員抵達伊姆位置並完成翻轉後，切成該角色 `angry.webp`，再疊加 `demon_card_frame.webp`、`demon_inner_aura.webp`、`demon_horns_shadow.webp`、`demon_wings_shadow.webp`、`demon_eye_glow.webp`、`demon_nameplate.webp`，讓停格畫面呈現被黑轉惡魔化狀態；抽出與移動前半段不套裝飾，維持原節奏。
- 檔案：`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script；確認示範頁引用的六張 `public/images/board/battle/black_turn/*.webp` 皆存在；確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200。
- 風險：只改本機黑轉示範頁與文件，不改正式戰鬥頁、黑轉規則、存檔、Socket.IO event 或 localStorage key；此紀錄當時尚未移植正式戰鬥頁，2026-07-09 已接入正式戰鬥頁。

- 範圍：整理使用者新增的黑轉支配惡魔化 UI 配件圖。將 `D:/FFOutput/` 的六張 Photoroom 圖複製到 `public/images/board/battle/black_turn/` 並改為正式檔名：`demon_card_frame.webp`、`demon_inner_aura.webp`、`demon_horns_shadow.webp`、`demon_wings_shadow.webp`、`demon_eye_glow.webp`、`demon_nameplate.webp`；此步當時僅歸位素材，尚未套進示範頁或正式戰鬥頁。
- 檔案：`public/images/board/battle/black_turn/`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認六個來源檔案存在；複製後列出 `public/images/board/battle/black_turn/*.webp` 檔名與大小；確認 `http://127.0.0.1:8787/images/board/battle/black_turn/demon_card_frame.webp` 回應 200。
- 風險：只新增素材與文件，不改程式、不改正式戰鬥頁、戰鬥規則、存檔或多人同步。

- 範圍：依使用者第十一次回饋只修黑轉支配示範頁的翻轉段。前半段抽出 / 移動不動；伊姆整張卡翻到後方時不再把 opacity 壓到 0.08 近乎消失，改為保持 0.72 的可見暗化狀態，側面也保留 0.9 可見度，讓伊姆卡仍看得到、但明確退到被黑轉角色後方。
- 檔案：`public/board_black_turn_demo.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script，並確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200。
- 風險：只改本機黑轉示範頁的伊姆翻轉 opacity / filter / scale，不改正式戰鬥頁、戰鬥規則、存檔或多人同步。

- 範圍：依使用者第十次回饋放慢黑轉支配示範頁。示範頁基準總長由 6200ms 改為 8400ms，速度選單的預設標籤改為「慢速 1x」，並加入「超慢 0.5x」選項，保留更慢 / 稍快供比較。
- 檔案：`public/board_black_turn_demo.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script，並確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200。
- 風險：只改本機黑轉示範頁速度設定，不改正式戰鬥頁、戰鬥規則、存檔或多人同步。

- 範圍：依使用者第九次回饋修正黑轉支配示範頁的閃爍與翻轉同步。黑轉 FX 層不再用 `display:none/block` 重建，改用 `visibility` 與 `.show` 觸發子動畫，減少重播時一幀閃爍；伊姆整張卡與被黑轉角色卡的翻轉時間點統一為 74% 開始、80% 到側面、88% 完成，生氣圖也改在 80% 側面時切換，讓兩張卡貼齊翻轉。
- 檔案：`public/board_black_turn_demo.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script，並確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200。
- 風險：只改本機黑轉示範頁的動畫觸發與 CSS keyframes，不改正式戰鬥頁、戰鬥規則、存檔或多人同步。

- 範圍：依使用者第八次回饋修正黑轉支配示範頁的伊姆翻轉。伊姆讓位時不再只讓 `battle-portrait` 圖片翻轉，而是改由整張 `.combat-card.enemy` 執行 `blackTurnEnemyCardYield`，讓伊姆外框、內框、名字牌與圖片一起翻到後面；圖片本身只保留 idle 動作，避免框圖分離。
- 檔案：`public/board_black_turn_demo.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script，並確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200。
- 風險：只改本機黑轉示範頁的伊姆卡片 CSS 動畫，不改正式戰鬥頁、戰鬥規則、存檔或多人同步。

- 範圍：修正黑轉支配示範頁被抽出角色卡大小。被抽出的內部人物圖不再用 `auto` 尺寸，而是明確填滿「角色卡大小扣掉 padding」的區域；抽出起點、落點改為整張角色卡正中心；被抽卡寬高改用來源玩家卡實際尺寸，避免連框一起抽出時看起來縮小或位置偏掉。
- 檔案：`public/board_black_turn_demo.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script，確認圖片引用存在，並確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200。
- 風險：只改本機黑轉示範頁的尺寸計算與 CSS，不改正式戰鬥頁、戰鬥規則、存檔或多人同步。

- 範圍：依使用者第七次回饋調整黑轉支配示範頁。被抽出的船員不再只有人物圖，而是改成整張戰鬥角色卡一起被抽走，包含外框、內部圖框與名字牌；抽出與落點座標也改用整張角色卡中心，讓「連圖帶框」的移動感與左右戰鬥卡一致。
- 檔案：`public/board_black_turn_demo.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script，確認示範目標圖片引用存在，並確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200。
- 風險：只改本機黑轉示範頁的展示卡框與定位，不改正式戰鬥頁、戰鬥規則、存檔或多人同步。

- 範圍：依使用者第六次回饋修正黑轉支配示範頁前後層級。黑轉 FX 在抽出與移動階段維持低於伊姆角色卡，讓被抽出的船員先到伊姆後方；到翻轉開始後才加上 `swap-front` 把被黑轉船員拉到前景停住。另關閉多餘的伊姆複製圖，避免伊姆複製圖與被黑轉船員同時卡在框後面。
- 檔案：`public/board_black_turn_demo.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script，並確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200。
- 風險：只改本機黑轉示範頁的展示層級與多餘複製圖顯示，不改正式戰鬥頁、戰鬥規則、存檔或多人同步。

- 範圍：依使用者第五次回饋修正黑轉支配示範頁層級。伊姆角色卡 z-index 提高到黑轉 FX 之上，讓被抽出的角色移到伊姆側時停在伊姆圖後方，不再蓋到伊姆前面；我方角色卡仍維持在 FX 上方，確保抽出時不蓋住我方圖。
- 檔案：`public/board_black_turn_demo.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script，並確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200。
- 風險：只改本機黑轉示範頁 z-index，不改正式戰鬥頁、戰鬥規則、存檔或多人同步。

- 範圍：依使用者第四次回饋修正黑轉支配示範頁。被抽出的船員圖片不再使用透明淡入、變暗或低透明度，從我方圖後方直接以不透明狀態移到伊姆後方；到伊姆側翻轉時改由 JS 直接把同一張顯示圖換成該角色 `angry.webp`，最後正面停住，避免 3D 背面圖片沒有顯示的問題。
- 檔案：`public/board_black_turn_demo.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script，確認示範目標圖片引用存在，並確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200。
- 風險：只改本機黑轉示範頁，不改正式戰鬥頁、戰鬥規則、存檔或多人同步。

- 範圍：依使用者第三次回饋微調黑轉支配示範頁。被抓船員抽出時正面仍用 `dizzy` 圖，但翻到伊姆側後背面改為該角色 `angry` 圖；演出結束後不再移除 FX 層，讓被黑轉角色停在伊姆位置，保持生氣圖作為支配完成狀態。
- 檔案：`public/board_black_turn_demo.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script，確認示範目標的 `angry.webp` 引用存在，並確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200。
- 風險：只改本機黑轉示範頁，不改正式戰鬥頁、戰鬥規則、存檔或多人同步。

- 範圍：依使用者第二次回饋微調黑轉支配示範頁。黑轉 FX 層級改成低於我方角色卡，讓被抓船員抽出時不會往前蓋住我方圖；抽到伊姆那側後只做一次 `rotateY(180deg)` 翻轉並淡出，不再連續轉到 360 度。
- 檔案：`public/board_black_turn_demo.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script，並確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200。
- 風險：只改本機黑轉示範頁的層級與 CSS keyframes，不改正式戰鬥頁、戰鬥規則、存檔或多人同步。

- 範圍：依使用者回饋微調黑轉支配示範頁的抽出節奏。被支配船員從我方角色圖後方抽出並拖到伊姆後方的階段不再 `rotateY` 翻轉；到達伊姆後方後，才開始原地翻轉並壓到前景，讓「抽出」與「翻面交換」兩個動作更清楚分開。
- 檔案：`public/board_black_turn_demo.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script，並確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200。
- 風險：只改本機黑轉示範頁的 CSS keyframes 與狀態文字，不改正式 `board_battle.html` / `board_battle.js`、不讀寫存檔、不影響同步。

- 範圍：新增伊姆 `Domi Reversi・黑轉支配` 本機示範頁。`public/board_black_turn_demo.html` 使用既有伊姆與船員戰鬥 portrait，重現「從玩家角色圖後方抽出被支配船員、拖到伊姆角色圖後方、伊姆翻到後面、被支配船員翻到前面」的演出，並提供被支配目標、速度、自動循環、重播與切換我方角色按鈕，方便不重打艾爾巴夫 / 伊姆流程就反覆檢查節奏。
- 檔案：`public/board_black_turn_demo.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 Node 解析 `public/board_black_turn_demo.html` 內嵌 script，並確認 `http://127.0.0.1:8787/board_black_turn_demo.html` 回應 200。
- 風險：獨立靜態示範頁，不讀寫 `gameState` / `battleState`、不連 Socket.IO、不新增 localStorage key、不影響正式戰鬥流程；正式黑轉演出仍需在 `board_battle.html` 實機確認。

- 範圍：修正四皇與伊姆疊層血條的跨條傷害。玩家攻擊仍先依原公式計算傷害，但若敵人尚未進第二型態且本次傷害會跨過半血門檻，會把實際扣血與多段 hit 顯示封頂在剛好打穿第一條；超出的傷害不會延續到第二條。四皇 `activateYonkoSecondHpBar()` 與伊姆 `applyFinalGatePhaseTransitions()` 進入第二型態時都會把敵方 HP 設為最後一條滿血，伊姆第一條被打到 0 也會先進第二型態而不是直接勝利。主頁 script 版本更新為 `20260707-layered-boss-damage-cap-v1`。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`git diff --check -- public/js/board_game.js public/board_game.html docs/PROJECT_OVERVIEW.md docs/GAME_RULES.md docs/DEV_WORKFLOW.md`；用 `rg` 確認 `capLayeredBossHitDamagesAtFirstHpBar()`、`canTriggerFinalGateSecondHpBar()`、`20260707-layered-boss-damage-cap-v1` 已接入；確認 `http://127.0.0.1:8787/board_game.html` 回應 200 並含新版 script query。
- 風險：只調整四皇 / 伊姆第一條血跨門檻時的實際扣血與第二型態 HP 重設，不改傷害公式、敵人最大 HP、技能倍率、掉落、Socket.IO event 或 localStorage key；仍需實機確認第一條打爆時傷害數字與切第二型態後滿血顯示符合預期。

- 範圍：放慢並重做伊姆 `Domi Reversi・黑轉支配` 的戰鬥頁演出。黑轉視覺事件時間加長為 6200ms；戰鬥頁新增伊姆臨時複製圖，並依實際敵方 portrait 框尺寸設定被抽離船員圖片大小。演出改為從玩家角色圖後方抽出被支配船員，拖到伊姆角色圖後方，最後伊姆圖翻到後面、被支配船員圖翻到前面。主頁 `BATTLE_PAGE_VERSION`、主頁 script query 與戰鬥頁 script query 更新為 `20260707-blackturn-swap-fx-v1`。
- 檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check public/js/board_battle.js`、`git diff --check -- public/js/board_game.js public/js/board_battle.js public/board_game.html public/board_battle.html docs/PROJECT_OVERVIEW.md docs/GAME_RULES.md docs/FILE_MAP.md docs/DEV_WORKFLOW.md`；用 `rg` 確認 `blackTurnEnemyPortrait`、`blackTurnEnemySwap`、`duration: 6200`、`20260707-blackturn-swap-fx-v1` 已接入；確認 `http://127.0.0.1:8787/board_game.html` 與 `/board_battle.html` 回應 200 並含新版 script query。
- 風險：只改黑轉支配的戰鬥頁視覺節奏與快取版本，不改黑轉抽選規則、被支配船員資料、伊姆技能數值、戰鬥結算、Socket.IO event 或 localStorage key；仍需實機看一次平板與電腦上的尺寸、前後翻轉與切入支配戰節奏。

- 範圍：調整伊姆 `Domi Reversi・黑轉支配` 的觸發時機與戰鬥頁演出。艾爾巴夫索瑪茲戰後、喬巴治療與伊姆降臨劇情結束後，先建立伊姆 `final_gate` 戰鬥；戰鬥開場對話與開場被動處理完成後，排入 `finalGateBlackTurnCastPending` 的 `black-turn-cast` 視覺事件。戰鬥頁新增黑轉專用 FX 層，會用被選中船員自己的半身圖，從玩家角色圖後方抽出、拖到伊姆角色圖後方並翻轉；事件播完後才呼叫原本 `startFinalGateBlackTurnBattle()`，抽出最低等可支配船員並切入 `final_gate_black_turn` 支配戰。主頁與戰鬥頁 script 版本更新為 `20260707-blackturn-cast-fx-v1`。
- 檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check public/js/board_battle.js`；用 `rg` 確認 `finalGateBlackTurnCastPending`、`black-turn-cast`、`blackTurnCastFx`、`20260707-blackturn-cast-fx-v1` 已接入，且 `startFinalGateBattle()` 不再於伊姆降臨後直接 return `startFinalGateBlackTurnBattle()`。
- 風險：不改黑轉支配抽選規則、被支配船員敵人資料、伊姆技能數值、戰鬥結算、Socket.IO event 或 localStorage key；新增的是 battleState 內暫時視覺事件與戰鬥頁純 UI 動畫，仍需實機看一次伊姆戰開場、黑轉施法、切入支配戰與擊敗後回伊姆本戰的節奏。

- 範圍：依使用者固定流程復原 Board 伺服器存檔，不新增首頁按鈕或自動讀檔入口。將最新有五檔・尼卡的 `B4143` server 存檔複製成 `server/data/board_saves/B5036.json`、`server/data/board_saves/B3079.json`、`server/data/board_saves/B8098.json`，讓玩家維持從 `board_start.html` 進入、到 `board_game.html?room=<房號>&online=1` 的 setup / 選角畫面或右上角按「讀取存檔」讀回伺服器備份。另修正線上讀取舊伺服器存檔後無法操作的身份問題：所有伺服器讀檔入口在手動讀取時，若存檔內沒有任何真人玩家對得上目前瀏覽器 profile，會把目前行動的真人玩家 id / clientId 接到本機 profile；server 端允許房主送出的 `load-save` 狀態覆蓋舊快照，避免被舊行動者 id 卡住。伺服器讀檔 API 也恢復不同房號可讀的習慣：指定房號沒有存檔時，自動 fallback 到最新一份有效 Board server save。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`server/index.js`、`server/data/board_saves/B5036.json`、`server/data/board_saves/B3079.json`、`server/data/board_saves/B8098.json`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check server/index.js`；確認 `/api/board-save/B5036`、`/api/board-save/B3079`、`/api/board-save/B8098` 回傳 200，並確認不存在的測試房號會 fallback 回最新有效存檔；用 Node 解析三份存檔，確認房號正確、第 275 回合、目前玩家為伊多且包含 `luffy_gear_fifth`；用 in-app browser 走原流程開 `board_game.html?room=B5036&online=1`、`board_game.html?room=B3079&online=1` 與 `board_game.html?room=B8098&online=1`，按「讀取存檔」再按「讀伺服器備份」，確認伊多船 token 變為 `current actionable`，點船可開啟含「擲骰子 / 背包 / 任務 / 查看船員 / 船團資訊 / 船隻資訊」的操作選單。
- 風險：不新增首頁入口、不改手動存檔 payload 格式、localStorage key、Socket.IO event 名稱或遊戲規則；讀伺服器備份時可能會重綁第一位真人玩家身份，僅在目前 profile 沒有對上任何真人玩家時生效。

### 2026-07-06

- 範圍：套用使用者定稿的艾爾巴夫 / 伊姆降臨劇情文字。重逢段落改為巨人族豪邁酒宴、卡西稱讚烏索普眼神可靠；神之騎士團突襲段落改為魯夫指揮索隆、香吉士、娜美、烏索普、喬巴先救孩子；麒麟格姆 / 索瑪茲戰後段落改為救下孩子、斬開荊棘、喬巴補藥與巨人反擊；伊姆降臨段落改為伊姆質問索瑪茲與麒麟格姆、魯夫確認幕後首領後進入黑轉支配；黑轉支配戰鬥 log 改用魯夫、娜美、索隆、香吉士提示。主頁 script / iframe 版本更新為 `20260706-elbaph-user-script-v1`。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`git diff --check -- public/js/board_game.js public/board_game.html docs/PROJECT_OVERVIEW.md docs/GAME_RULES.md docs/DEV_WORKFLOW.md`；用 `rg` 確認新版台詞、黑轉支配提示與 `20260706-elbaph-user-script-v1` 已接入；確認 `http://127.0.0.1:8787/board_game.html` 回應 `HTTP 200`。
- 風險：只改玩家可見劇情文字、戰鬥提示 log 與快取版本，不新增 `gameState` 欄位、不改敵人數值、黑轉支配抽選、戰鬥結算、Socket.IO event 或 localStorage key；仍需實機看一次艾爾巴夫完整劇情節奏與伊姆降臨 modal 排版。

- 範圍：重排艾爾巴夫終局劇情順序，新增伊姆戰前「Domi Reversi・黑轉支配」前哨戰。玩家抵達艾爾巴夫後不再先播伊姆降臨，而是先播放巨人島重逢與麒麟格姆 / 索瑪茲突襲西村，接著依序進入麒麟格姆戰與索瑪茲戰。索瑪茲戰後，喬巴治療台詞會插在孩子救回後、戰場短暫安靜下來前，實際全隊 HP / PP 也在播放索瑪茲戰後劇情前先回滿；治療完成後才播放地圖伊姆降臨動畫與伊姆正式出場。伊姆出場後抽離目前玩家隊伍中最低等且可被支配的一名船員，建立 `final_gate_black_turn` 戰鬥。被支配船員使用自己的已學招式作為敵方招式並套用我方半身圖，該船員在隊伍中暫時以 0 HP 不可上場；擊敗後不給一般戰鬥掉落 / 任務獎勵，船員回隊並直接接入伊姆本戰。新增 player 進度欄位 `finalGateChopperHealed`、`finalGateBlackTurnCleared`、`finalGateBlackTurnCrewId`、`finalGateBlackTurnCrewName`，補上新玩家預設、讀檔 normalize、開發退回艾爾巴夫重置、pending battle 續戰、結果頁自動完成與多人一回合暫停保留流程。主頁 script / iframe 版本更新為 `20260706-elbaph-knights-first-imu-later-v1`。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用 `rg` 確認開場不再呼叫伊姆降臨、神之騎士團突襲劇情、索瑪茲戰後喬巴治療台詞、伊姆後降臨流程、快取版本與重置欄位已接入。
- 風險：這次新增 player 存檔欄位與一種特殊 `battleState.islandKind`，並重排艾爾巴夫終局流程；未新增 Socket.IO event 或 localStorage key，多人同步仍靠完整 `BOARD_GAME_STATE` 快照。需要實機測一次艾爾巴夫開場神之騎士團先登場、兩場戰後喬巴治療、伊姆降臨動畫、黑轉前哨戰 round-pause 交棒、勝利後接伊姆本戰。

### 2026-07-04

- 範圍：修正艾爾巴夫篇神之騎士團戰鬥不會自動跳下一位玩家。麒麟格姆 / 索瑪茲戰鬥的 `round-pause` 不再排除自動交棒；新增艾爾巴夫勝敗結果 auto finish timer，沿用操作權檢查避免觀看方觸發；多人勝利時不再立刻接戰後劇情與下一場，而是先 `endTurn()`，讓該玩家下次輪到時由 `recoverPendingElbaphGateSequence()` 接續麒麟格姆戰後 / 索瑪茲戰後劇情。多人局的艾爾巴夫銜接恢復也限制為目前行動玩家，避免其他玩家回合被非當前玩家的艾爾巴夫進度拉走。主頁 `BATTLE_PAGE_VERSION` 與 `board_game.js` script query 更新為 `20260704-elbaph-auto-handoff-v1`。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用 `rg` 確認 `scheduleElbaphGodKnightBattleAutoFinish`、艾爾巴夫救援戰暫停 log、`recoverAnyPendingElbaphGateSequence()` 的目前玩家限制與 `20260704-elbaph-auto-handoff-v1` 已接入；確認 `http://127.0.0.1:8787/board_game.html` 回應 `HTTP 200`。
- 風險：改到多人戰鬥結算與終局劇情銜接，但不新增 `gameState` 欄位、不改神之騎士團敵人數值、獎勵、伊姆戰規則、Socket.IO event 或 localStorage key；實機需確認 3-4 人局中麒麟格姆未擊破、麒麟格姆擊破、索瑪茲擊破三種情境都會依序交棒並在原玩家下回合接續。

- 範圍：修正戰鬥頁斬擊命中特效方向，讓斬擊 / 風斬圖依攻擊方掃向受擊方；拳擊、火焰、雷擊等爆點型特效維持原地命中。伊姆最終門戰接上四皇同款 `phaseHpBars` 顯示，第一層用目前層血量與 `X2`，第二型態顯示最後一條血；同步更新主頁 `BATTLE_PAGE_VERSION`、`board_game.js` script query 與戰鬥頁 `board_battle.js` script query 為 `20260704-battle-slash-imu-hp-v1`。
- 檔案：`public/js/board_battle.js`、`public/board_battle.html`、`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check public/js/board_battle.js`；用 `rg` 確認 `directionalSlashHit`、`battlePhaseHpBarsForView`、`finalGatePhaseHpBarsForView` 與 `20260704-battle-slash-imu-hp-v1` 已接入；啟動本機 server 後確認 `http://127.0.0.1:8787/board_game.html` 與 `http://127.0.0.1:8787/board_battle.html` 回應 `HTTP 200`。
- 風險：只改戰鬥頁視覺方向與伊姆 HUD 顯示，不新增 `gameState` 欄位、不改伊姆總 HP、技能、傷害、第二型態觸發、Socket.IO event 或 localStorage key；實機仍需用玩家攻擊與敵人攻擊各看一次斬擊方向。

- 範圍：替換並補強瑪麗喬亞支線五老星半身圖與崩壞台詞。將使用者提供的三張正常版圖複製到 `public/images/board/story/speakers/`，檔名為 `gorosei_mars_authority.webp`、`gorosei_warcury_contempt.webp`、`gorosei_nusjuro_cold_judgement.webp`；馬卡斯·馬茲聖、托普曼·沃裘利聖、伊特贊巴隆·V·納斯壽郎聖預設改用正常版，仍保留各自 `crumbling` pose。伊姆倒下後新增三句崩壞版台詞，納斯壽郎聖崩壞台詞改為「吾等的不老之身……在崩解。」；謝潑德·十·彼得聖與費加蘭德·加林聖維持原崩壞圖。主頁 `board_game.js` 快取版本更新為 `20260704-gorosei-nusjuro-line-v1`。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`public/images/board/story/speakers/gorosei_mars_authority.webp`、`public/images/board/story/speakers/gorosei_warcury_contempt.webp`、`public/images/board/story/speakers/gorosei_nusjuro_cold_judgement.webp`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_game.html` 與三張新五老星半身圖路徑皆回應 `HTTP 200`；用 `rg` 確認三張正常版檔名、三句崩壞台詞與 `20260704-gorosei-nusjuro-line-v1` 已接入。
- 風險：只改玩家可見劇情半身圖、台詞與快取版本，不新增 `gameState` 欄位、不改戰鬥流程、敵人資料、Socket.IO event 或 localStorage key；保留舊崩壞圖避免後續需要老化 pose 時失去素材。

### 2026-07-03

- 範圍：整理並接入伊姆戰後「同一時間・聖地瑪麗喬亞」劇情素材，並修正劇情播放順序與背景切點。將 `public/images/board/story/` 根目錄 12 張新圖改名歸位：2 張背景移到 `public/images/board/story/backgrounds/mary_geoise/`，10 張人物半身圖移到 `public/images/board/story/speakers/`；瑪麗喬亞支線改到艾爾巴夫託付與下一條航路播完後，先顯示「同一時間，在瑪麗喬亞……」過場，再切到聖地前線與盤古城深處兩幕；聖地前線保留到「克爾拉咬緊牙，也追了上去。」為止，盤古城深處背景從「兩人穿過崩塌的神之地。」才開始；同步為薩波、克爾拉、龍、五老星與加林聖接入 speaker pose，主頁 `board_game.js` 快取版本更新為 `20260703-mary-geoise-chamber-cut-v1`。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`public/images/board/story/backgrounds/mary_geoise/`、`public/images/board/story/speakers/`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_game.html` 與新瑪麗喬亞背景 / 半身圖路徑皆回應 `HTTP 200`；用 `rg` 確認 `mary-geoise-time-card`、`maryGeoiseRevolutionBattle`、`pangaea-secret-chamber`、新版 speaker pose 與 `20260703-mary-geoise-chamber-cut-v1` 已接入；確認 `public/images/board/story` 根目錄已無散落 `.webp` 檔。
- 風險：只改玩家可見劇情素材路徑、章節背景、播放順序與 speaker pose，不新增 `gameState` 欄位、不改台詞文字、戰鬥流程、敵人資料、Socket.IO event 或 localStorage key；新增過場與章節切幕會多一次「下一幕」操作 / 自動播放節點。

- 範圍：依使用者要求微調「同一時間・聖地瑪麗喬亞」劇情 speaker 與五老星台詞；不再讓「神之騎士團」有台詞，將五老星相關台詞分配給馬卡斯·馬茲聖、托普曼·沃裘利聖、伊特贊巴隆·V·納斯壽郎聖、謝潑德·十·彼得聖與費加蘭德·加林聖，並更新馬卡斯·馬茲聖 / 托普曼·沃裘利聖的壓迫台詞；同步更新主頁 `board_game.js` 快取版本為 `20260703-mary-geoise-gorosei-lines-v1`。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用 `rg` 確認五個五老星名字、新版五老星台詞與 `20260703-mary-geoise-gorosei-lines-v1` 已接入，且 `speaker: "神之騎士團"` 不再存在；啟動本機 server 後確認 `http://127.0.0.1:8787/board_game.html` 回應 `HTTP 200`。
- 風險：只改玩家可見 speaker 名稱、台詞文字與快取版本，不新增 `gameState` 欄位、不改台詞順序、戰鬥流程、敵人資料、Socket.IO event 或 localStorage key。

### 2026-07-02

- 範圍：在擊退伊姆後、艾爾巴夫託付前新增並重寫「同一時間・聖地瑪麗喬亞」劇情章節。革命軍攻入聖地時原本被神之騎士團與五老星壓制，伊姆倒下後敵方急速老化、革命軍反擊，最後以薩波與克爾拉看見未知巨大輪廓並說「這是……」收尾，保留後續接最終之島真相的空間；同步更新主頁 `board_game.js` 快取版本為 `20260702-mary-geoise-script-v2`。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；啟動本機 server 後確認 `http://127.0.0.1:8787/board_game.html` 回應 `HTTP 200`；用 `rg` 確認「同一時間・聖地瑪麗喬亞」、薩波 / 克爾拉懸念台詞與新版 `20260702-mary-geoise-script-v2` 已接入。
- 風險：只新增玩家可見劇情文字與快取版本，不新增 `gameState` 欄位、不改伊姆 / 神之騎士團戰鬥、革命軍 gameplay、敵人資料、Socket.IO event 或 localStorage key。

### 2026-06-30

- 範圍：依使用者提供的新版文字更新艾爾巴夫篇劇情台詞，涵蓋艾爾巴夫重逢、伊姆降臨後分兵、兩名神之騎士團戰後、艾爾巴夫託付與下一條航路；地圖降臨小段保留原本一致文字，並更新主頁 `board_game.js` 快取版本為 `20260630-elbaph-script-v1`。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_game.html` 回應 `HTTP 200`；用 `rg` 確認新版台詞與 `20260630-elbaph-script-v1` 已接入。
- 風險：只改玩家可見劇情文字與快取版本，不新增 `gameState` 欄位、不改艾爾巴夫 / 伊姆戰鬥流程、敵人資料、Socket.IO event 或 localStorage key。

### 2026-06-29

- 範圍：將四皇與終局劇情中玩家可見的終局島名統一正名為「最終之島」，並更新主頁 `board_game.js` 快取版本為 `20260629-final-island-name-v1`；程式內既有 `finalIsland` / `final-island` 等穩定 id 不改名。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；啟動本機 server 後確認 `http://127.0.0.1:8787/board_game.html` 回應 `HTTP 200`；用 `rg` 確認 active 路徑 `public/js/board_game.js`、`public/board_game.html`、`docs/` 不再有舊終局島名，且新版 `20260629-final-island-name-v1` 已接入。
- 風險：只改顯示文案與快取版本，不新增 `gameState` 欄位、不改最終島 / 最終門路線 id、Socket.IO event 或 localStorage key。

- 範圍：補上地圖標記取消 / 改標入口。新增 `playerMapMarker()`、`mapMarkerMatchesTarget()`、`mapMarkerButtonsMarkup()` 與 `bindMapMarkerButtons()`，島嶼與海格查看 modal 會依目前玩家的既有標記顯示「標記這裡」、「改標這裡」、「取消標記」或「取消原標記」；每位玩家仍維持最多 1 個 `mapMarkers` 標記。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_game.html` 回應 `HTTP 200`；用 `rg` 確認 `mapMarkerButtonsMarkup`、`bindMapMarkerButtons`、`取消標記`、`取消原標記` 與新版 `20260629-map-marker-clear-v1` 已接入。
- 風險：只改地圖標記 modal UI 與主頁快取版本，不新增 `gameState` 欄位、不改 `mapMarkers` 資料格式、Socket.IO event 或 localStorage key。

- 範圍：接上艾爾巴夫正式島嶼圖。將使用者新增在 `public/images/board/islands/` 的 ChatGPT 原始長檔名圖片改名為 `elbaph_island.webp`，`ISLAND_IMAGE_MAP.elbaph` 改指向 `images/board/islands/elbaph_island.webp`，並把艾爾巴夫地圖節點樣式改為完整 `contain` 顯示島嶼 cutout，不再使用劇情背景裁切圖。
- 檔案：`public/images/board/islands/elbaph_island.webp`、`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_game.html` 與 `/images/board/islands/elbaph_island.webp` 皆回應 `HTTP 200`；用 `rg` 確認 `ISLAND_IMAGE_MAP.elbaph`、新版 `20260629-elbaph-island-image-v1` 與正式圖片路徑已接入。
- 風險：只改素材檔名、島嶼縮圖路徑、顯示樣式與快取版本，不改最終之島啟動條件、路線 id、`gameState` 欄位、Socket.IO event 或 localStorage key。

- 範圍：移除艾爾巴夫正式島圖後方 / 下方殘留文字。有正式 `elbaph_island.webp` 圖片時，`buildElbaphIslandVisual()` 只輸出島嶼圖，不再輸出「艾爾巴夫 / 巨人島」標籤；只有無圖 fallback 時才顯示文字徽章。
- 檔案：`public/js/board_game.js`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_game.html` 回應 `HTTP 200`；抽查 `buildElbaphIslandVisual()` 確認有圖分支不再輸出 `strong` / `small` 文字。
- 風險：只改艾爾巴夫地圖節點 HTML 顯示，不改素材、規則、同步欄位、Socket.IO event 或 localStorage key。

- 範圍：恢復抵達艾爾巴夫時的地圖降臨動畫。第一次觸發艾爾巴夫災變時，`startElbaphGateSequence()` 會先呼叫 `playFinalGateMapDescent()`，等地圖降臨動畫結束後才進入艾爾巴夫災變全螢幕劇情；後續伊姆 final gate 分支移除 `elbaph/finalGateAnchor` 的跳過判斷，抵達或回合開始仍會先播地圖降臨再開伊姆提示。同步更新主頁 script 版本為 `20260629-elbaph-map-descent-v1`。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_game.html`、`/images/board/final_island/final_gate_map_portal.png`、`/images/board/final_island/final_gate_map_imu.png` 皆回應 `HTTP 200`；用 `rg` 確認 `skipMapDescent` 已移除，兩個分支都會呼叫 `playFinalGateMapDescent(player, source)`，且新版 `20260629-elbaph-map-descent-v1` 已接入。
- 風險：只調整艾爾巴夫 / 伊姆流程的前置視覺等待與快取版本，不改最終之島條件、路線 id、戰鬥敵人、獎勵、`gameState` 欄位、Socket.IO event 或 localStorage key。

### 2026-06-28

- 範圍：修正最終之島前一島沒有明確變成艾爾巴夫。`ensureFinalIslandLayout()` 會把最後航路 anchor 島與對應 `islandStates` 同步轉成 `elbaph` / `finalGateAnchor`，清掉原本敵島、商店、任務或暫時服務殘留；最終之島解鎖後艾爾巴夫會對所有玩家可見，主地圖也新增明確的艾爾巴夫節點樣式。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_game.html` 回應 `HTTP 200`；用 `rg` 確認 `kind-elbaph`、`buildElbaphIslandVisual` 與新版 `20260628-elbaph-anchor-v1` 已接入。
- 風險：只修正最終島 layout 套用、地圖可見性與本機顯示，不改最終之島啟動條件、路線 id、Socket.IO event 或 localStorage key；舊存檔載入時會由 normalize 重套 anchor 狀態。

- 範圍：補上艾爾巴夫連接點的島嶼圖片顯示。`ISLAND_IMAGE_MAP.elbaph` 暫用既有 `images/board/final_island/endings/backgrounds/elbaph_arrival_reunion.webp`，`buildElbaphIslandVisual()` 會用該圖做地圖縮圖並保留艾爾巴夫 / 巨人島標籤；若圖片讀取失敗仍保留文字 fallback。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_game.html` 與 `/images/board/final_island/endings/backgrounds/elbaph_arrival_reunion.webp` 皆回應 `HTTP 200`；用 `rg` 確認 `ISLAND_IMAGE_MAP.elbaph`、`elbaph-island-art` 與 `buildElbaphIslandVisual()` 圖片分支已接入。
- 風險：只接入既有圖片作為地圖縮圖，不新增素材、不改最終之島規則、同步欄位、Socket.IO event 或 localStorage key；未來若補正式 `images/board/islands/elbaph_island.webp` 可只替換路徑。

- 範圍：移除開戰前對話的跳過按鈕。獨立戰鬥頁 `ensurePrebattleIntroLayer()` 不再渲染 `data-prebattle-skip` 按鈕與監聽，prebattle 對話固定自動播完以維持節奏；四皇第二階段 `data-phase2-skip` 與主劇情播放器跳過控制保留。同步更新 `BATTLE_PAGE_VERSION`、主頁與戰鬥頁 script query。
- 檔案：`public/js/board_battle.js`、`public/js/board_game.js`、`public/board_battle.html`、`public/board_game.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check public/js/board_battle.js`；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_battle.html` 皆回應 `HTTP 200`；用 `Select-String` 確認 `data-prebattle-skip` 已不存在、`data-phase2-skip` 仍存在，且新版 `20260628-prebattle-no-skip-v1` 已接入。
- 風險：只改戰鬥頁開戰前對話的本機 UI，不改 prebattle 自動完成流程、`battleState` 欄位、Socket.IO event 或 localStorage key；實機需確認開戰前對話播完後仍正常解鎖行動。

- 範圍：修正魯夫五檔・尼卡自動覺醒影片與背景音樂重疊。影片播放前會用 `BgmManager.fadeOut(0)` 立即暫停目前 BGM，播放期間 `playBgmForContext()` 會暫時忽略自動切歌；影片正常結束、讀取失敗或 fallback 後再恢復原本 BGM。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_start.html` 與 `/board_game.html` 皆回應 `HTTP 200`；確認 `luffyGearFifthVideoBgmPaused`、`silenceBgmForLuffyGearFifthVideo()` 與新版 `20260628-nika-video-bgm-v1` 已接入。
- 風險：只改五檔覺醒影片的本機 BGM 播放控制與主頁 script 快取版本，不改五檔觸發條件、角色進化資料、`battleState` / `gameState` 欄位、Socket.IO event 或 localStorage key；實機需確認影片結束後戰鬥 BGM 會恢復。

- 範圍：修正 CPU 使用安布里歐·伊娃科夫等輔助角色時可能只補血 / 上 buff 導致戰鬥打不完。CPU 戰鬥選招新增 `devObserverBattleMoveCanDamage()`，power 0 的純治療 / buff / 護盾 / 特殊支援招不再算攻擊招；CPU 自動學招替換時保留至少 1 招可造成傷害的技能；舊狀態若上場角色已沒有可用傷害招，戰鬥中會先補回攻擊招，補不回才換上其他有攻擊招的存活船員。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用 Node 載入 `BoardCards` 抽查伊娃科夫技能分類，確認 `顏面衝擊`、`死亡媚眼` 為 damage，`人妖王奇蹟` 為 utility；確認 `http://127.0.0.1:8787/board_start.html` 與 `/board_game.html` 皆回應 `HTTP 200`；確認新版 `20260628-cpu-damage-move-v1` 已接入。
- 風險：只改 CPU / 自動測試的戰鬥選招、學招替換與舊狀態修復，不改技能資料、真人手動學招、`gameState` 欄位、Socket.IO event 或 localStorage key；實機需確認 CPU 輔助角色仍會在低血量時合理補血，但不會無限拖戰。

- 範圍：新增攜帶物選單返回按鈕。`openEquipBattleCarryModal()` 支援 `returnTo` 來源，從船員詳情進入時「返回」會回同一角色詳情，從船員管理列表進入時會回列表並保留同一列展開；從主畫面快捷入口進入時返回等同關閉。裝備 / 卸下後仍停留在攜帶物選單。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_start.html` 與 `/board_game.html` 皆回應 `HTTP 200`；用 `Select-String` 確認 `backEquipCarryBtn`、`returnTo: "detail"`、`returnTo: "crewManage"` 與新版 `20260628-carry-modal-back-v1` 已接入。
- 風險：只改船員攜帶物 modal 的返回導覽與主頁 script 快取版本，不改攜帶物資料、背包資料、`gameState` 欄位、Socket.IO event 或 localStorage key；實機需確認三個入口的返回目的符合預期。

- 範圍：修正船員頁面攜帶物操作後面板消失。攜帶物選單中裝備 / 卸下成功後改為刷新同一名船員的攜帶物選單；船員詳情直接卸下後回到同一角色詳情；船員管理列表直接卸下後回到船員管理並保留同一列展開。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_start.html` 與 `/board_game.html` 皆回應 `HTTP 200`；用 `Select-String` 確認 `openCrewManagementModal(player, openIndex)` 與新版 `20260628-carry-modal-stay-v1` 已接入。
- 風險：只改船員 / 攜帶物 modal 的前端刷新流程與主頁 script 快取版本，不改攜帶物 id、效果、背包資料結構、`gameState` 欄位、Socket.IO event 或 localStorage key；實機需確認從角色詳情與船員管理兩個入口操作時都會停在預期面板。

- 範圍：修正四皇特殊攜帶物無法卸下。四皇首次擊破獎勵不再以 `bound: true` 發放；新增 `isLockedBattleCarryItem()`，讓舊存檔中已帶 `bound` 的戴彭的九尾幻面、格里芬之劍、無畏之心、太陽海賊團的徽章仍可卸下、換裝並回到背包，其他真正綁定攜帶物維持不能卸下。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_start.html` 與 `/board_game.html` 皆回應 `HTTP 200`；用 `Select-String` 確認 `YONKO_COUNTER_ITEM_IDS`、`isLockedBattleCarryItem` 與新版 `20260628-yonko-carry-unlock-v1` 已接入。
- 風險：只改四皇對策攜帶物的綁定 / 卸下判斷與主頁 script 快取版本，不改道具 id、道具效果、取得條件、`gameState` 欄位、Socket.IO event 或 localStorage key；實機需確認舊存檔已裝備的四皇道具能正常卸下並回背包。

- 範圍：修正 Marineford / 頂上戰爭篇最終 Boss 結算。`finalizeMarinefordBattleStep()` 新增可指定不交棒與清場後 callback 的選項；打倒最後一名 Boss 戰國元帥時，會完成救援、清除戰鬥狀態並立刻開回 Marineford 成功救援頁，不再等到玩家下一回合才看到成功救援。青雉、黃猿、赤犬擊破後仍維持推進下一名 Boss 但先交棒。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_marineford.html` 皆回應 `HTTP 200`；用 `Select-String` 確認 `finalizeMarinefordBattleStep` 的 `advanceTurn: false` 分支與新版 `20260628-marineford-final-success-v1` 已接入。
- 風險：只調整 Marineford 最終 Boss 成功時的結算導向與主頁 script 快取版本，不新增 `gameState` 欄位、不改 `marinefordHold` 結構、Socket.IO event 或 localStorage key；仍建議實機確認戰國戰鬥結果顯示後能立即看到成功救援與 3D2Y 報紙道具展示。

- 範圍：修正核心 EXP 分配。`grantExpToLivingCrew()` 不再跳過瀕死船員，改為瀕死隊員取得 50% EXP；存活支援仍為 95%，出戰者為 100%。同時將幸運海鷗蛋與其他 `exp_bonus_self` 攜帶物接入個人 EXP 結算，在低等追趕倍率後追加對應百分比，並在紀錄中顯示道具加成來源。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用 `npm.cmd start` 啟動本機 server 後確認 `http://127.0.0.1:8787/board_start.html` 與 `/board_game.html` 皆回應 `HTTP 200`；用 `Select-String` 確認 `FAINTED_CREW_EXP_RATIO`、`cardSelfExpBonusInfo`、`exp_bonus_self` 與新版 `20260628-exp-share-lucky-egg-v1` 已接入。
- 風險：只改 EXP 數值分配與主頁 script 快取版本，不新增 `gameState` 欄位、不改角色 / 道具 id、Socket.IO event 或 localStorage key；實機仍需確認戰鬥 / 任務結算 log 的瀕死成長與幸運海鷗蛋加成顯示符合預期。

- 範圍：簡化四皇疊層血條的 HP 文字顯示。底層戰鬥仍保留原本總 `maxHp` 作為兩階段判斷，避免實際耐久被翻倍；主遊戲戰鬥 modal 與獨立戰鬥頁 HUD 改用目前血條的 `layerCurrentHp/layerMaxHp` 顯示，例如上層血條顯示半血上限並搭配 `X2`，第二型態顯示最後一條血，不再顯示總血量造成混亂。同步更新 `BATTLE_PAGE_VERSION`、`board_game.js` 與 `board_battle.js` query，避免快取舊 HUD。
- 檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check public/js/board_battle.js`；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_battle.html` 皆回應 `HTTP 200`；用 `Select-String` 確認 `battleEnemyHpTextForDisplay`、`combatantHpTextForDisplay` 與新版 `20260628-yonko-layer-hp-v1` 已接入。
- 風險：只改四皇 HP 文字與血條 HUD 顯示，不改四皇敵人 `maxHp`、傷害計算、半血換型態、獎勵、`gameState` 欄位、Socket.IO event 或 localStorage key；實機仍需確認攻擊動畫扣血時文字與血條同步。

### 2026-06-27

- 範圍：修正 Marineford / 頂上戰爭篇戰鬥結果不會自動跳下一位玩家。主戰鬥結果渲染時，若目前戰鬥是 Marineford、已有結果且沒有瀕死換人，持有操作權的主遊戲端會用本機 timer 排程呼叫既有 `finishBattle()`；多人局會自動保存未擊破 Boss 的 `pendingBattle` 或推進下一名 Boss 後交棒，單人局則自動回到 Marineford 頁面。本機排程 key 不寫入同步快照，避免觀看方或重整後殘留旗標誤觸發。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_marineford.html` 皆回應 `HTTP 200`；用 `Select-String` 確認 `scheduleMarinefordBattleAutoFinish` 與新版 `board_game.js` query 已接入。
- 風險：只新增 Marineford 戰鬥結果的本機自動 finish 排程，不新增 `gameState` 欄位、不改 `marinefordHold` 結構、Socket.IO event 或 localStorage key；仍建議實機多人確認戰鬥結果顯示約 1.2 秒後會交棒，且觀看方不會自行觸發結算。

- 範圍：收斂 Marineford / 頂上戰爭頁底部區塊。底部提示 / 操作區整段隱藏，不再顯示白鬍子池、隊伍狀態、處刑台調整、開始救援、進入戰鬥、整備按鈕與「自願挑戰 / 幫忙救援」說明文字；救援骰數量與按鈕移到右上「剩餘回合」chip 旁。主要流程改由點擊目前敵人卡片接續，未開戰時依狀態執行抽處刑台、抽支援、選處刑台或開始救援，救援中則進入目前 Boss 戰。同步更新 `MARINEFORD_PAGE_VERSION` 與 `board_game.js` query，避免 iframe 快取舊版。
- 檔案：`public/board_marineford.html`、`public/js/board_game.js`、`public/board_game.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；抽出 `public/board_marineford.html` inline script 以 `new Function()` 解析通過；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_marineford.html` 皆回應 `HTTP 200`；用 `Select-String` 確認 `remainingTurnsText`、`handleBossCardAction`、`bottom-dock` hidden 與新版 `MARINEFORD_PAGE_VERSION` 已接入。
- 風險：只調整 Marineford 頁面操作入口與顯示位置，不改救援骰規則、處刑倒數、`marinefordHold.rescueDice` 欄位、Socket.IO event 或 localStorage key；實機需確認平板右上 chip 不擠壓狀態列。

- 範圍：新增戴彭的九尾幻面戰鬥頁開場演出。當上場角色攜帶九尾幻面且原屬性沒有克制目前敵人屬性時，主戰鬥流程會在戰前對話與開場被動視覺事件結束後排入 `kyubi-mask` 視覺事件，演出期間納入 `openingPassiveVisualPending()` 鎖定，玩家不能先選招。戰鬥頁會顯示道具圖飛向角色圖，接著讓我方屬性欄輪轉約 2 秒後停在克制屬性；若原屬性已克制敵人則不播放。同步更新戰鬥頁與主頁 script / iframe 版本字串，避免快取舊頁面。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`public/js/board_battle.js`、`public/board_battle.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check public/js/board_battle.js`；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_battle.html` 皆回應 `HTTP 200`；用 `rg` 確認 `kyubi-mask`、`kyubiMaskVisualPending`、`kyubiMaskFx` 與新版 `BATTLE_PAGE_VERSION` 已接入。
- 風險：新增的是戰鬥中的 transient 視覺事件欄位 `battle.kyubiMaskVisualPending` / `kyubiMaskVisualAnimating` / `kyubiMaskVisualPlayed`，不改道具 id、取得來源、裝備資料、Socket.IO event 或 localStorage key；實機仍需確認不同螢幕比例下道具飛行位置與屬性欄輪轉不遮擋操作面板。

- 範圍：放寬 Marineford / 頂上戰爭篇處刑台倒數。主遊戲與獨立 Marineford 頁面的倒數由 20 回合調整為 40 回合；Boss 戰結束仍依實際戰鬥回合數扣除倒數。擊破非最終 Boss 後新增 1 顆救援骰，玩家可在頂上戰爭頁面自行決定何時擲 1d6，加回所有進行中、未救出 / 未處刑的處刑台 slot；若倒數已到 0 且手上有救援骰，會要求先擲骰才能進下一戰。`normalizeMarinefordHold()` 透過 `executionTurnVersion` v3 升級舊存檔，進行中的 slot 會補上 20 回合但最多不超過新版基礎 40 回合，並補 `rescueDice` 預設值維持舊存檔相容。
- 顯示修正：頂上戰爭頁面的底部 dock 改回可見；`擲救援骰 xN` 按鈕固定顯示，`x0` 時灰掉不可按、有骰子時可按並套用金色醒目樣式。同步更新 `MARINEFORD_PAGE_VERSION` 與 `board_game.js` script query，避免 iframe 或主頁快取舊版 Marineford 頁面而看不到按鈕。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`public/board_marineford.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；抽出 `public/board_marineford.html` 的 inline script 以 `new Function()` 解析通過；確認 `http://127.0.0.1:8787/board_start.html`、`board_game.html`、`board_marineford.html` 皆回應 200；用內建瀏覽器檢查 Marineford 頁面，底部 dock computed display 為 `grid`，救援骰按鈕在 `x0` 時仍可見但 disabled。
- 風險：此改動影響 Marineford 救援難度與舊存檔 normalize；新增 `marinefordHold.rescueDice` 內部欄位與 Marineford 頁面 `rollRescueDie` command type，已在 normalize 補預設值；未改 Socket.IO event 或 localStorage key。

### 2026-06-26

- 範圍：調整戴彭的九尾幻面效果。正式道具說明改為攻擊屬性永遠轉為克制目前敵人的屬性；戰鬥判定在 `battleMoveAttackAttribute()` 先檢查裝備者是否攜帶九尾幻面，若有就回傳目前敵方屬性的克制屬性。紅髮香克斯轉相戰不再使用舊版每 3 回合 1 次 x1.3 補正，而是直接轉成克制目前轉相並使用正常 x2；原本干擾預判 / 敵方閃避下降輔助保留。
- 檔案：`public/js/board_game.js`、`public/js/board_items.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check public/js/board_items.js`；用 `rg` 確認舊版 `canUseDevonMaskVsShanks`、`devonMaskShanksRound`、`wrongAttributeMultiplier` 與 `九尾幻面可補正` 已不在程式中，並確認 `devonKyubiMaskCounterAttribute` 與新版道具說明已接入。
- 風險：此改動會顯著提高九尾幻面的泛用戰鬥強度，尤其所有有屬性的敵人都會被轉成克制；未改道具 id、取得來源、裝備欄位、`gameState` 主欄位、Socket.IO event 或 localStorage key。

- 範圍：新增劇情播放控制。四皇據點、最終島、最終門 / 艾爾巴夫 / 伊姆戰後等共用全螢幕劇情播放器新增「自動 / 速度 / 跳過」；速度設定保存在本機 `onepiece-board-story-playback-v1`，用於劇情等待與自動換句。最終之島啟動儀式與羅賓讀取段落改用可清除的計時器並提供跳過，獨立戰鬥頁的戰前對話與四皇第二階段對話新增本機跳過按鈕。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`public/js/board_battle.js`、`public/board_battle.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check public/js/board_battle.js`；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_battle.html` 皆回應 `HTTP 200`；用 `rg` 確認 `finalEndingAutoBtn`、`finalEndingSpeedSelect`、`finalEndingSkipBtn`、`data-prebattle-skip`、`data-phase2-skip` 與 `final-story-skip-btn` 已接入。
- 風險：主劇情自動與速度是本機播放設定，不改戰鬥、掉落、回合、同步欄位或 Socket.IO event；戰鬥頁跳過只縮短本機視覺等待，仍需多人實機確認觀戰端跳過不會造成操作方節奏困惑。

- 範圍：修正觀戰端瀕死角色消失後又閃回。`public/js/board_battle.js` 新增 KO 隱藏鎖，當玩家或敵方角色完成瀕死淡出後，若後續同步仍是同一名 0HP 角色，就維持 `portrait-ko` 隱藏狀態，不再重設 hit / dizzy 圖；換上新角色、復活或切換戰鬥時自動解除。
- 檔案：`public/js/board_battle.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`；確認 `http://127.0.0.1:8787/board_battle.html` 回應 `HTTP 200`；用 `rg` 確認 `knockoutHiddenCombatantKeys` 與 KO 隱藏判斷已接入。
- 風險：只改獨立戰鬥頁的前端顯示鎖，不改 HP、換人、共鬥交棒、`battleState` 欄位、Socket.IO event 或 localStorage key；仍需兩端實機觀戰確認瀕死淡出後不再閃回。

- 範圍：調整紅髮劇情耶穌布半身圖比例。新增 speaker portrait 內層圖片的 CSS 縮放變數，並只針對 `耶穌布` 套用 `1.3` 倍顯示補正，讓包含完整長槍的圖不會顯得比其他角色小；原圖檔、台詞與 pose 對照不變。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_game.html` 回應 `HTTP 200`；用 `rg` 確認 `finalEndingSpeakerPortraitStyle` 與耶穌布縮放設定已接入。
- 風險：只改劇情 speaker 圖顯示比例，不改圖片素材、紅髮劇情台詞、四皇戰鬥機制、同步欄位、Socket.IO event 或 localStorage key；仍需實機觀看紅髮父子對話確認 1.3 倍是否剛好。

- 範圍：微調紅髮劇情騙人布父子對話半身圖比例與高度。`騙人布` / `烏索普` 的 `conflicted` pose 因素材較接近上半身特寫，於「我有很多話想問你」、「也有很多話想罵你」等句顯得比其他 pose 大，現在僅針對該 pose 套用 `0.7` 倍顯示補正並上移 `24%`。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_game.html` 回應 `HTTP 200`；用 `rg` 確認 `conflicted` pose 縮放與上移設定已接入。
- 風險：只改騙人布單一劇情 pose 的顯示比例與高度，不改素材檔、紅髮劇情台詞、同步欄位、Socket.IO event 或 localStorage key；仍需實機看父子對話確認比例與位置是否自然。

- 範圍：接入紅髮劇情拉奇魯專用半身圖。將使用者提供的拉奇魯大笑 / 調侃圖複製為 `public/images/board/story/speakers/lucky_roux_teasing_laugh.webp`，新增 `拉奇魯` 的 `tease` pose，並只把「一見面就說要搶東西，真不愧是你啊！」這句改用新 pose；前面丟肉段落仍使用原本 `lucky_roux_laugh_meat.webp`。
- 檔案：`public/js/board_game.js`、`public/images/board/story/speakers/lucky_roux_teasing_laugh.webp`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_game.html` 與 `/images/board/story/speakers/lucky_roux_teasing_laugh.webp` 皆回應 `HTTP 200`；用 `rg` 確認拉奇魯 `tease` pose 與該句台詞已接入。
- 風險：只新增一張紅髮劇情 speaker 素材與單句 pose 對照，不改紅髮劇情台詞、四皇戰鬥機制、同步欄位、Socket.IO event 或 localStorage key。

- 範圍：調整海上列車黃金票目的地。背包使用黃金票時，除了既有標記島之外，現在固定提供「水之七島」可選目的地；尚未標記島嶼也能先搭乘到水之七島，若標記島就是水之七島則不重複顯示。同步更新黃金票背包說明與道具資料描述。
- 檔案：`public/js/board_game.js`、`public/js/board_items.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check public/js/board_items.js`；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html` 皆回應 `HTTP 200`；用 `rg` 確認水之七島固定站與黃金票說明已接入。
- 風險：只改黃金票使用 modal 的目的地清單與道具文案，不新增 `gameState` 主欄位、不改道具 id、消耗規則、Socket.IO event 或 localStorage key；仍需實機確認搭乘到水之七島後會正常進入船塢 / 商店服務流程。

- 範圍：簡化四皇疊層血條標記。四皇血條不再顯示「上層血條 / 最後一條」或額外 HP 說明；高於半血時血條縮短一點並只在右側顯示 `X2`，剩最後一層時回到原本血條寬度與紅橘色，不再顯示額外文字。
- 檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_battle.html`、`public/board_game.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check public/js/board_battle.js`；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_battle.html` 皆回應 `HTTP 200`。
- 風險：只改四皇血條 UI 文字與寬度，不改半血切相、傷害、回復上限、同步欄位、Socket.IO event 或 localStorage key；仍需實機確認平板 / 電腦血條右側 `X2` 不擠壓版面。

- 範圍：調整四皇疊層血條。四皇仍使用原本總 `maxHp`，不再把原本 900 多 HP 變成兩條各 900 多 HP；高於半血門檻時同一條血條用新色與右側 `X2` 表示上層血條，打到半血後清除四皇身上的狀態、能力階級與專屬 buff / 場地累積並切入第二型態，剩最後一層時回到原本紅橘血條且不顯示額外文字。第二階段後敵方回復 / 再生會被限制在最後一層半血上限內。
- 檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_battle.html`、`public/board_game.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check public/js/board_battle.js`。
- 風險：只改 `battleState` 內既有四皇 `phase2` 判定與血條呈現，不新增 `gameState` 主欄位、不改 Socket.IO event 或 localStorage key；仍需實機打四皇確認半血切相、狀態清除、觀看方血條顏色與 `X2` 同步符合預期。

- 範圍：替換四皇紅髮香克斯戰前劇情文本。`yonko_shanks.story.chapters` 改為「久別重逢的宴會」、「騙人布與耶穌布」、「正事開始」、「約定之戰」四段，移除原本混在劇情裡的轉相、見聞殺與蓄勢教學語氣；紅髮戰鬥 `mechanics` / `advice` 保持原樣。新背景與耶穌布、班貝克曼、拉奇魯半身圖尚未正式接入，暫時沿用既有紅髮背景與文字顯示。
- 檔案：`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_battle.html` 皆回應 `HTTP 200`。
- 風險：只替換紅髮戰前劇情文字與章節數 / 時長，不改四皇戰鬥機制、轉相 / 見聞蓄勢規則、獎勵、Road Poneglyph、同步欄位、Socket.IO event 或 localStorage key；缺圖角色會先以文字方式顯示，待素材補齊後再接 speaker portrait。

- 範圍：整理並接入紅髮劇情素材。將 `public/images/board/story/` 根目錄中的 4 張紅髮背景改名移到 `public/images/board/story/backgrounds/yonko/`，對應「久別重逢的宴會」、「騙人布與耶穌布」、「正事開始」、「約定之戰」；將當時 15 張紅髮相關去背半身圖改名移到 `public/images/board/story/speakers/`，並更新紅髮劇情背景 key 與 speaker pose 對照。
- 檔案：`public/js/board_game.js`、`public/images/board/story/backgrounds/yonko/`、`public/images/board/story/speakers/`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `public/images/board/story` 根目錄已無散落檔案；用 `rg` 確認紅髮四段劇情引用 `yonko_shanks_story_banquet_arrival`、`yonko_shanks_story_usopp_yasopp`、`yonko_shanks_story_challenge`、`yonko_shanks_story_promise_duel`，並確認新 speaker 檔名已接入對照表。
- 風險：只搬移本次新增的紅髮劇情素材並更新劇情顯示路徑，不改四皇戰鬥機制、獎勵、Road Poneglyph、同步欄位、Socket.IO event 或 localStorage key；若未來再替換素材，需維持目前正式檔名或同步更新 speaker / background mapping。

- 範圍：新增多人局敵人佔用排除。海格遭遇抽敵、敵島重新佔據與敵島新開戰前，會根據目前 `state.battleState` 與各玩家 `pendingBattle` 計算仍在進行的 enemy key，避免不同地點同時產生同一個敵人；同一敵島 / 同一海格格子的接續戰與共鬥會以 location key 排除，不受影響。
- 檔案：`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用 `rg` 確認 `activeEnemyReservationKeys`、`refreshEnemyIslandProfileIfReservedElsewhere`、海格遭遇重檢與「已在別處交戰」log 已接入。
- 風險：不新增 `gameState` 欄位、不改 Socket.IO event 或 localStorage key；若所有一般敵人都被佔用，最後 fallback 仍可能選到可用池中的敵人，因此 4 人局正常敵人數量下應不會撞名，但極端自訂池仍需留意。

- 範圍：替換四皇凱多戰前劇情文本。`yonko_kaido.story.chapters` 改為「重返鬼島」、「百獸殘影」、「跨過我吧」三段，移除原本混在劇情裡的龍鱗破壞與覺醒教學語氣；凱多戰鬥 `mechanics` / `advice` 保持原樣。
- 檔案：`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_battle.html` 皆回應 `HTTP 200`。
- 風險：只替換凱多戰前劇情文字與劇情章節時長，不改四皇戰鬥機制、龍鱗 / 覺醒規則、獎勵、Road Poneglyph、同步欄位、Socket.IO event 或 localStorage key。

### 2026-06-25

- 範圍：隱藏船員詳情的下一階進化名稱。船員詳情仍顯示目前階段 / 總階數與一般進化條件，但下一階提示不寫出進化形態名稱，條件符合時按鈕只顯示「進化」。
- 檔案：`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_battle.html` 皆回應 `HTTP 200`。
- 風險：只改船員詳情 modal 顯示文字，不改進化資料、進化條件、素材消耗、`gameState` 欄位、Socket.IO event 或 localStorage key。

- 範圍：調整船員詳情特殊覺醒顯示。魯夫五檔等 `specialAwakening` 會重新列入總進化階數，讓玩家看得到總共有幾階；但下一階條件與「進化」按鈕仍只顯示一般進化，不顯示特殊覺醒觸發方式。
- 檔案：`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_battle.html` 皆回應 `HTTP 200`。
- 風險：只改船員詳情的階段摘要顯示，不改五檔覺醒條件、戰鬥中覺醒流程、角色資料、`gameState` 欄位、Socket.IO event 或 localStorage key。

- 範圍：曾短暫隱藏船員詳情中的特殊覺醒階段顯示，後續同日依需求改為仍列入總階數，但不顯示特殊覺醒觸發方式。
- 檔案：`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_battle.html` 皆回應 `HTTP 200`。
- 風險：只改船員詳情的階段摘要顯示，不改五檔覺醒條件、戰鬥中覺醒流程、角色資料、`gameState` 欄位、Socket.IO event 或 localStorage key。

- 範圍：船員詳情新增進化階段摘要。依角色一般進化資料的最高 `stage` 顯示目前階段 / 總階數，無進化角色顯示「無進化」。
- 檔案：`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_battle.html` 皆回應 `HTTP 200`。
- 風險：只改船員詳情 modal 顯示文字，不改進化條件、素材消耗、角色資料、`gameState` 欄位、Socket.IO event 或 localStorage key。

- 範圍：調整船員詳情的進化操作顯示。下一階進化條件未滿足時不再顯示 disabled 的進化按鈕；只有等級與素材都符合時才顯示「進化」按鈕。背包進化素材選人清單保留不可進化原因顯示。
- 檔案：`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_battle.html` 皆回應 `HTTP 200`。
- 風險：只改船員詳情 modal 的按鈕生成條件，不改進化判定、素材消耗、角色資料、`gameState` 欄位、Socket.IO event 或 localStorage key。

- 範圍：移除一般敵人池中的副本 / 劇情敵人重複。麥哲倫、青雉、黃猿、赤犬與斯潘達姆只保留在推進城、Marineford、司法島專屬流程；一般 T1 敵人池留空，並補強選敵 fallback，讓指定階級池空掉時會改從其他一般敵人池抽取。
- 檔案：`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用 Node 掃描 `enemyProfile` 定義，確認 51 筆定義、51 個 unique key、0 個重複 key；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_battle.html` 皆回應 `HTTP 200`。
- 風險：不新增 `gameState` 欄位、不改 Socket.IO event 或 localStorage key；舊存檔若已經在敵島上保存了舊的一般敵人快照，可能要等敵島重新配置或重開局才會完全消失。

- 範圍：調整戰鬥頁 buff / debuff 圖示出現順序。戰鬥頁會在 `passive-opening`、狀態技、強化技與攻擊附帶狀態期間先保留事件前的狀態圖示；等被動 / 招式文字與狀態特效播出後才刷新成新的 buff / debuff 圖示。開場被動尚未演出前也會暫時隱藏它新增的能力階級圖示，避免戰前對話期間先看到結果。
- 檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check public/js/board_battle.js`；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_battle.html` 皆回應 `HTTP 200`。
- 風險：只新增戰鬥 view 的開場被動待播資訊與戰鬥頁顯示延遲，不改被動效果、傷害計算、Socket.IO event 名稱或 localStorage key；需實機確認連續多段 hit 附帶 debuff 時圖示刷新時機符合視覺節奏。

- 範圍：調整開場被動 debuff 的視覺呈現。`passive-opening` 造成敵方 debuff 時不再讓目標播放受擊圖或場景震動，改為只顯示能力下降的 debuff 狀態特效與文字，避免玩家誤以為被動造成了直接傷害。
- 檔案：`public/js/board_battle.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_battle.html` 皆回應 `HTTP 200`。
- 風險：只改戰鬥頁視覺呈現，不改被動效果、戰鬥數值、同步欄位、Socket.IO event 或 localStorage key；需實機確認紫色 debuff / 下降粒子在敵方身上足夠明顯。

- 範圍：新增開場被動視覺演出並修正瀕死圖時序。角色開場被動造成 buff / debuff 時會排入 `passive-opening` 視覺事件，等戰前對話結束後播放角色出招、cut-in 與狀態特效，演出期間鎖住戰鬥行動；戰鬥頁最後一擊不再在命中中途提前切瀕死圖，改為招式受擊圖演完後由 knockout 事件切瀕死、淡出與替補，並避免舊 portrait timer 讓已淡出的角色又顯示回來。
- 檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check public/js/board_battle.js`；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_battle.html` 皆回應 `HTTP 200`。
- 風險：新增的是 battleState 內的短暫視覺佇列與 `battle.visualEvent` 類型，不改 Socket.IO event 名稱、localStorage key 或角色被動數值；仍需多人實機確認觀看方能在戰前對話後同步看到開場被動，並確認最後一擊後的瀕死淡出不再閃回。

- 範圍：補強開場被動提示。角色開場被動若套用我方 buff 或敵方 debuff，戰鬥紀錄改為明確顯示「開場被動」與實際能力變化，例如敵方攻擊-1、命中-1，避免玩家剛進新戰鬥看到敵方 debuff 時誤以為是上一場殘留。
- 檔案：`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_start.html` 回應 `HTTP 200`。
- 風險：只改戰鬥紀錄文字與文件，不改開場被動效果、戰鬥數值、同步欄位、Socket.IO event 或 localStorage key；實機需確認戰鬥 log 能清楚看到是哪位角色的開場被動造成 debuff。

- 範圍：當時將四皇第二型態改成雙血條流程；此版本後續已於 2026-06-26 調整為原總血量內的半血疊層，同一條血條用右側 `X2` 與顏色表示仍有上層血。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`public/js/board_battle.js`、`public/board_battle.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check public/js/board_battle.js`；確認 `http://127.0.0.1:8787/board_start.html`、`/board_game.html`、`/board_battle.html` 皆回應 `HTTP 200`。
- 風險：此為舊版流程紀錄；目前四皇血條規則以 2026-06-26 的半血疊層版本為準。

- 範圍：修正重要道具展示未看完就切下一位玩家。新增 item reveal idle callback 與 `endTurn()` 等待鎖；只要重要道具展示 HUD 還在動畫、等待點擊或佇列中，回合交接會先延後，等玩家收下最後一個重要道具後才執行原本的下一位玩家橫幅與同步推送；同步在既有 debug 物件加入道具展示測試 helper。
- 檔案：`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用 Node/jsdom 載入 `board_game.html` 與主程式，模擬 `queueImportantItemReveal("fearless_heart")` 後呼叫 `endTurn()`，確認 currentPlayerIndex 會停在原玩家，點掉道具 HUD 後才交棒；確認 `http://127.0.0.1:8787/board_game.html` 回應 `HTTP 200`。
- 風險：只延後回合交接時機，不改道具取得、獎勵內容、戰鬥勝負、`gameState` 欄位、Socket.IO event 或 localStorage key；實機仍需確認多人房觀看方收到同步時已在道具展示後。

- 範圍：替換四皇大媽戰前劇情文本。`yonko_bigmom.story.chapters` 改為使用者確認的「甜點王國」、「被撞破的寶物庫」、「茶會了結」三段，套用萬國外景、寶物庫被撞破與靈魂茶會大廳三張既有背景圖；台詞依使用者最後確認版寫入，不再保留原本混在劇情中的 HP、PP、代價支付等機制教學句。
- 檔案：`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用 `rg` 確認大媽新場景標題與使用者確認的關鍵台詞存在，且舊大媽劇情中的機制教學句已不在 `yonko_bigmom.story.chapters` 中；確認 `http://127.0.0.1:8787/board_game.html` 回應 `HTTP 200`。
- 風險：只替換大媽戰前劇情文字、背景對應與 speaker pose，不改四皇戰鬥機制、靈魂拷問規則、獎勵、Road Poneglyph、同步欄位、Socket.IO event 或 localStorage key。

### 2026-06-24

- 範圍：整理 Board 劇情半身圖素材。將四皇劇情與最終島劇情共用的 speaker portrait 統一移到 `public/images/board/story/speakers/`，原本的 87 張劇情半身圖與新加入的魯夫、甚平 / 吉貝爾、娜美憤怒半身圖共 90 張都由同一資料夾供應；同步將黑鬍子劇情中艾斯挑釁相關段落改用新的 `angry` pose。
- 檔案：`public/js/board_game.js`、`public/images/board/story/speakers/`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用 `rg` 確認主程式不再引用舊 speaker 路徑且 `images/board/story/speakers`、`luffy_angry_ace`、`jinbe_angry_guard`、`nami_angry_warning` 存在；確認三張新圖與舊共用半身圖皆可用 HTTP 200 讀取；確認 `http://127.0.0.1:8787/board_game.html` 回應 `HTTP 200`。
- 風險：只搬移劇情半身圖素材與改劇情 pose / 圖片路徑，不改 `gameState` 欄位、Socket.IO event、戰鬥規則、獎勵或 localStorage key；需實機觀看黑鬍子劇情確認半身圖位置與尺寸符合預期。

- 範圍：替換四皇黑鬍子戰前劇情文本。`yonko_blackbeard.story.chapters` 改為「抵達黑鬍子據點」、「黑暗吞噬」、「雙果實的震動」三段對峙式劇情，移除劇情中的 HP、PP、後排、暗穴層數等機制教學語氣；黑鬍子戰鬥 `mechanics` / `advice` 保持原樣。
- 檔案：`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用 `rg` 確認黑鬍子劇情新標題存在，且舊劇情教學句已不在 `yonko_blackbeard.story.chapters` 中；確認 `http://127.0.0.1:8787/board_game.html` 回應 `HTTP 200`。
- 風險：只替換黑鬍子戰前劇情文字，不改四皇戰鬥機制、獎勵、Road Poneglyph、同步欄位、Socket.IO event 或 localStorage key。

- 範圍：將海格寶箱抽選與揭曉從一般對話框改成全螢幕舞台式 overlay。新增 `sea-chest-stage-modal` / `sea-chest-stage-backdrop` / `sea-chest-stage-shell` 等樣式，寶箱圖直接浮在舞台上，不再放在 `board-modal` 的白色 / 玻璃對話框卡片中；結果揭曉也沿用同一舞台樣式。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用 `rg` 確認 `sea-chest-stage-modal`、`sea-chest-stage-backdrop`、`sea-chest-stage-shell` 存在且寶箱抽選 / 揭曉 `openModal()` 均帶入舞台 class；確認 `http://127.0.0.1:8787/board_game.html` 回應 `HTTP 200`。
- 風險：只調整寶箱 UI 呈現方式，不改寶箱比例、抽選結果、木箱陷阱、同步欄位、Socket.IO event 或 localStorage key；需實機確認桌機 / 平板寶箱沒有被一般對話框視覺包住。

- 範圍：調整寶箱洗牌互動。寶箱候選展示後不再自動倒數洗牌，也不新增第二層確認對話框；同一個寶箱畫面內新增「確認洗牌」按鈕，玩家按下後才翻面、洗牌並開放抽選。CPU / 自動測試 selector 也加入 `#startSeaChestShuffleBtn:not(:disabled)`，避免 CPU 停在展示階段。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用 `rg` 確認 `startSeaTreasureChestShuffle`、`startSeaChestShuffleBtn`、`sea-chest-shuffle-row` 存在且舊 `armSeaTreasureChestShuffle` 已不存在；確認 `http://127.0.0.1:8787/board_game.html` 回應 `HTTP 200`。
- 風險：只調整寶箱洗牌的啟動方式與 CPU 點擊 selector，不改寶箱比例、獎懲、同步欄位、Socket.IO event 或 localStorage key；實機需確認玩家不按「確認洗牌」時不會自動洗牌。

- 範圍：調整寶箱候選抽取規則。四選一寶箱的 4 個候選不再保證不同類型，改為每個候選位置都依該事件權重獨立抽一次，因此同一輪可重複出現木、銅、銀、金或寶石寶箱。
- 檔案：`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用 `rg` 確認 `drawWeightedTreasureChestTypes` 取代 `drawWeightedUniqueTreasureChestTypes`，且文件說明候選可重複；確認 `http://127.0.0.1:8787/board_game.html` 回應 `HTTP 200`。
- 風險：只調整候選寶箱抽取方式，不改寶箱權重數值、木箱陷阱效果、同步欄位、Socket.IO event 或 localStorage key。

- 範圍：調整海格寶箱抽選演出與木箱效果。四選一寶箱不再一開始就只顯示背面，而是先展示 4 個候選寶箱正面與類型，再翻成黑影背面並洗牌後啟用選擇；木寶箱改為必定陷阱，會隨機造成貝里損失、HP 損失或 PP 損耗，銅箱以上才給獎勵。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用 `rg` 確認 `applySeaWoodChestTrap`、`sea-chest-stage-note`、`seaChestShuffle` 存在；確認寶箱選擇按鈕初始為 disabled，洗牌完成後才啟用；確認 `http://127.0.0.1:8787/board_game.html` 回應 `HTTP 200`。
- 風險：只調整寶箱 modal 演出與木箱獎懲，不新增 `gameState` 欄位、不改 Socket.IO event 或 localStorage key；需實機確認觀看方節奏與 CPU 不會在洗牌前點選。

- 範圍：將所有寶藏類海格改成四選一寶箱抽選，不再有寶藏卡直接給指定步數券、守護護符、稀有補給或直接扣道具。新增 `SEA_TREASURE_CHEST_WEIGHT_PROFILES`，讓標準寶箱海域、漂流寶箱群、航路券寶箱、護符寶箱、被撬過的寶箱、假寶藏箱、沉船寶庫、古代遺物寶箱各自使用不同木、銅、銀、金、寶石候選權重；舊 `SEA_EVENT_DEFS` 中的寶藏定義也同步改成寶箱抽選旗標。
- 檔案：`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用 `rg` 確認 `SEA_TREASURE_CHEST_WEIGHT_PROFILES`、`chestProfile`、`seaTreasureChestProfilePool`、`seaTreasureChestProfileOddsText` 存在，且 `SEA_CARD_EFFECTS.treasure` 不再含直接給 / 扣道具流程；確認 `http://127.0.0.1:8787/board_game.html` 回應 `HTTP 200`。
- 風險：只調整寶藏海格的獎勵入口與權重，不新增 `gameState` 欄位、不改 Socket.IO event 或 localStorage key；實機需確認不同寶藏事件 modal 顯示不同權重文字且抽選結果正常。

- 範圍：修正翻到海格寶箱卡沒有進入選寶箱流程。補上 `chest` 海格類型資訊、共用寶藏卡背、固定四選一寶箱效果與 CPU 選牌評分，讓舊存檔或舊資料中的寶箱海域不再 fallback 成金錢事件；二選一畫面點擊時沿用已抽出的效果，不再重新抽一次，避免偵查 / 顯示與實際結果不同；同步將寶石寶箱檔名修正為 `chest_gem.webp`。
- 檔案：`public/js/board_game.js`、`public/images/board/game/sea_chests/chest_gem.webp`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用 `rg` 確認 `SEA_EVENT_TYPE_INFO`、`SEA_CARD_BACK_IMAGE_MAP`、`drawSeaCardEffect` 與 CPU 評分都包含 `chest`；確認 `public/images/board/game/sea_chests/chest_gem.webp` 存在且舊空白檔名不存在；確認 `http://127.0.0.1:8787/board_game.html` 回應 `HTTP 200`。
- 風險：只修正 `chest` 類型導向寶箱抽選與素材檔名，不改既有 `treasure` 卡池中的其他寶藏效果、不新增 `gameState` 欄位、不改 Socket.IO event 或 localStorage key。

### 2026-06-23

- 範圍：強化海格事件與新增寶箱抽選。金錢、天氣、寶藏、藥物事件改成更有感的獎勵 / 代價，貝里獎勵會依海域與回合放大；寶藏事件「漂流寶箱群 / 沉船寶庫」與舊寶箱入口改成木、銅、銀、金、寶石 5 種寶箱抽 4 種洗牌後讓玩家選 1 張。新增寶箱抽選 UI、結果顯示、觀看方結果同步、CPU 自動點擊 selector 與 Board 專用圖片資料夾 `public/images/board/game/sea_chests/`。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`public/images/board/game/sea_chests/`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用 `rg` 確認 `SEA_TREASURE_CHEST_TYPES`、`openSeaTreasureChestDraft`、`data-sea-treasure-chest`、`sea-chest-draft-grid` 與新事件名稱存在，且舊 `CHEST_POOL` / `CHEST_REWARD_POOL` 已無殘留；啟動 server 後確認 `http://127.0.0.1:8787/board_game.html` 回應 `HTTP 200`。
- 風險：新增海格寶藏選擇 modal，但不新增 `gameState` 主欄位、不改 Socket.IO event 或 localStorage key；寶箱圖片尚待補入，缺圖時會以文字 fallback 顯示；需實機測試真人 / 觀看方 / CPU 抽寶箱節奏。

- 範圍：將海格寶箱圖片路徑從舊卡牌素材區移出，改為 Board 專用 `public/images/board/game/sea_chests/`，避免新 Board 寶箱圖與舊卡牌遊戲素材混在一起；同步更新程式常數與文件說明。
- 檔案：`public/js/board_game.js`、`public/images/board/game/sea_chests/`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用 `rg` 確認舊卡牌寶箱路徑已無引用，且新路徑 `images/board/game/sea_chests` / `public/images/board/game/sea_chests` 存在於程式與文件。
- 風險：只調整尚未放圖的寶箱素材路徑，不改抽選結果、同步欄位、Socket.IO event 或 localStorage key；海格卡背已於下一筆紀錄獨立搬出舊卡牌素材區。

- 範圍：將海格事件二選一卡背圖片從舊卡牌素材區移出，改為 Board 專用 `public/images/board/game/sea_cards/backs/`。搬移 `money_back.webp`、`weather_back.webp`、`treasure_back.webp`、`medicine_back.webp`、`unknown_back.webp`，並更新 `SEA_CARD_BACK_IMAGE_MAP`。
- 檔案：`public/js/board_game.js`、`public/images/board/game/sea_cards/backs/`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用 `rg` 確認主流程與文件已改用 `images/board/game/sea_cards/backs` / `public/images/board/game/sea_cards/backs`，且舊卡背資料夾已移除。
- 風險：只搬移 Board 海格事件卡背，不改海格事件抽選、效果、同步欄位、Socket.IO event、localStorage key，也不動舊卡牌遊戲仍使用的 `public/images/cards/` 其他素材。

- 範圍：取消主地圖船隻移動的目標格提示。移除金色目的格提示圈的 CSS、目的地推估 helper 與地圖 render 呼叫；保留每步約 0.32 秒的逐格移動節奏。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用 `rg` 確認 `map-move-destination-ring`、`mapMoveDestinationPulse`、`estimateMoveDestinationTarget`、`currentMoveDestinationTarget` 與 `renderMoveDestinationRing` 已不存在於 `public/board_game.html` / `public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_game.html` 回應 `HTTP 200`。
- 風險：只移除純 UI 提示，不改擲骰、路線、移動結果、`gameState` 主欄位、Socket.IO event 或 localStorage key；實機需確認移動中沒有殘留金色圈，且平板 / 桌機地圖操作正常。

### 2026-06-22

- 範圍：依使用者要求將海格事件視覺回復原本流程。移除海格二選一卡翻牌延遲、五色分類樣式與直接遭遇的紅色戰鬥卡預覽；保留島嶼抵達徽章 HUD。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用 `rg` 確認 `SEA_EVENT_VISUAL_INFO`、`selectSeaEventChoice`、`event-card-type-badge`、`seaCardFlip` 與海格五色分類樣式已不存在於 `public/js/board_game.js` / `public/board_game.html`；確認 `http://127.0.0.1:8787/board_game.html` 回應 `HTTP 200`。
- 風險：只回復海格 UI 呈現與點卡節奏，不改海格抽卡池、事件效果、戰鬥規則、`gameState` 主欄位、Socket.IO event 或 localStorage key；島嶼抵達徽章仍會同步顯示，需實機確認不擋後續落點 modal。

- 範圍：海格事件視覺與島嶼落點提示。海格二選一事件卡改成翻牌式卡片，依紅戰鬥、金寶箱、青天氣、紫襲來、綠補給做視覺分類；直接遭遇海格在進戰鬥前顯示紅色戰鬥卡預覽。玩家抵達島嶼時會先顯示同步島嶼徽章 HUD，常見分類為商店、酒館、任務、敵島。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用 `rg` 確認 `SEA_EVENT_VISUAL_INFO`、`selectSeaEventChoice`、`islandArrivalBadgeInfo`、`event-card-type-badge` 與 `theme-island-*` 樣式存在；確認 `http://127.0.0.1:8787/board_game.html` 回應 `HTTP 200`。
- 風險：只新增 UI 呈現、翻牌延遲與同步 HUD 事件，不改海格抽卡池、事件效果、戰鬥規則、`gameState` 主欄位、Socket.IO event 或 localStorage key；仍需實機確認平板 / 桌機上卡片高度、觀看方結果彈窗與島嶼徽章時機符合預期。

- 範圍：整理缺漏道具圖片。將新加入的五張道具圖依內容改名為正式 `GAME_ITEMS` 路徑，補齊四皇對策道具與舊時代進化素材圖。
- 檔案：`public/images/board/items/devon_kyubi_mask.webp`、`public/images/board/items/griffon_sword.webp`、`public/images/board/items/fearless_heart.webp`、`public/images/board/items/sun_pirates_badge.webp`、`public/images/board/items/prime_vivre_card.webp`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：用 Node 載入 `public/js/board_items.js` 的 `GAME_ITEMS`，比對 `images/board/items/*.webp` 實體檔，確認 135 個道具中 `itemImagesMissing` 為 0。
- 風險：只更名道具素材與文件，不改道具資料、掉落規則、同步 payload、localStorage key 或 `gameState` 欄位。

### 2026-06-22

- 範圍：整理推進城六層背景素材。將新加入的六張圖片依畫面內容改名為正式路徑：紅蓮地獄、猛獸地獄、飢餓地獄、灼熱地獄、極寒地獄、無限地獄。
- 檔案：`public/images/board/impel_down/levels/level_1_red_hell.webp`、`public/images/board/impel_down/levels/level_2_beast_hell.webp`、`public/images/board/impel_down/levels/level_3_hunger_hell.webp`、`public/images/board/impel_down/levels/level_4_blazing_hell.webp`、`public/images/board/impel_down/levels/level_5_freezing_hell.webp`、`public/images/board/impel_down/levels/level_6_infinite_hell.webp`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：列出 `public/images/board/impel_down/levels/` 檔案，確認六個正式 webp 檔案存在且有檔案大小。
- 風險：只更名副本樓層背景素材與文件，不改遊戲規則、同步 payload、localStorage key 或 `gameState` 欄位。

### 2026-06-22

- 範圍：修正 CPU 四皇據點自動流程。CPU 抵達四皇島並看到四皇劇情 / 機制面板時，會先依既有 `devObserverShouldChallengeYonkoNow()` 策略判斷；若應挑戰且開始按鈕可點，會自動按下進入四皇戰，不再停在面板上。
- 檔案：`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `http://127.0.0.1:8787/board_start.html` 回應 `HTTP 200`。
- 風險：只補 CPU 自動點擊四皇開戰按鈕，不新增 `gameState` 欄位、不改四皇戰鬥規則、Socket.IO event 或 localStorage key；仍需實機 CPU 跑到四皇島確認劇情播放、策略判斷與開戰同步符合預期。

### 2026-06-22

- 範圍：修正多人非共鬥戰鬥的瀕死替補節奏。敵方先攻或其他效果造成上場角色瀕死時，玩家選完替補並播完上場動畫後會將戰鬥設為 `round-pause`、保存進度並交棒；替補角色不會立刻進入可操作的新回合。司法島、推進城、Marineford 與一般敵島都共用此規則；單人測試仍會直接續下一輪。
- 檔案：`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`。
- 風險：不新增 `gameState` 欄位、不改 Socket.IO event 或 localStorage key；仍需實機多人測試確認替補上場動畫、觀看方同步、交棒橫幅與副本續戰節奏符合預期。

### 2026-06-19

- 範圍：新增固定文件維護規則，要求每次 Codex 修改程式、資料、素材目錄或工具後，都要同步更新專案文件與修改紀錄。
- 檔案：`AGENTS.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認五份文件存在，並用 `rg` 搜尋「修改紀錄」、「目前正式進化條件」、「本機工具」等關鍵段落。
- 風險：只改文件，不影響遊戲規則、同步或存檔。

### 2026-06-19

- 範圍：整理角色進化資料，新增 / 調整新世界進化、凱洛特月獅型態、進化名稱與正式進化素材條件。
- 檔案：`public/js/board_cards.js`、`docs/GAME_RULES.md`。
- 驗證：執行 `node --check public/js/board_cards.js`；用 Node 載入 `BoardCards` 驗證 32 個進化與指定素材條件。
- 風險：只改角色資料與文件，未新增 `gameState` 欄位；舊存檔中已取得角色會依目前進化資料讀取下一階段。

### 2026-06-19

- 範圍：整理角色 / 進化 / 敵人 portrait 資料夾與缺圖清單，確認缺圖後備為黑影占位圖。
- 檔案：`public/images/board/battle/portraits/**`、`public/images/board/battle/enemies/**`、`portrait-folder-tool.ps1`、`open-portrait-folder-tool.cmd`、`docs/FILE_MAP.md`。
- 驗證：掃描 `BoardCards.evolutionForms`、角色卡與敵人 key，確認角色 51 個、進化 32 個都有 portrait；缺圖敵人資料夾已補齊。
- 風險：新增空資料夾需實際放入圖片才會被 git 追蹤；未改同步流程。

### 2026-06-19

- 範圍：建立固定本機測試入口與一鍵啟動方式，使用 `http://127.0.0.1:8787/board_start.html`。
- 檔案：`start-board-server.cmd`、`public/start-board-server.cmd`、相關文件。
- 驗證：確認 `http://127.0.0.1:8787/board_start.html` 回應 200。
- 風險：只影響本機啟動方式，不影響遊戲規則或同步 payload。

### 2026-06-19

- 範圍：重新整理角色技能命名規則，保留 move id，補上角色味更明確的起手招式名稱，並讓同一角色進化鏈內的基礎、進化與後期技能不再重複名稱。
- 檔案：`public/js/board_cards.js`、`docs/GAME_RULES.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_cards.js`；用 Node VM 載入 `BoardCards`，確認 51 位角色、32 個進化形態、83 個可戰鬥形態都有 Lv.1 傷害招式，且每條進化鏈 duplicate move name 數為 0。
- 風險：保留既有 move id 與 `gameState` 欄位，不影響多人同步 payload；技能顯示名稱改變，若玩家已記住舊名稱需要重新熟悉。

### 2026-06-19

- 範圍：更新戰鬥特效檢查工具，加入進化形態與後期技能，並顯示命中特效、命中音效、施放音效、播放按鈕與缺規格篩選。
- 檔案：`public/board_戰鬥特效檢查.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：用 Node 檢查 HTML 內嵌 script 語法；透過 jsdom 載入工具頁與外部 script，確認 51 位角色、83 個可戰鬥形態、1413 招、833 個命中特效 / 音效列可渲染；確認 `http://127.0.0.1:8787/board_%E6%88%B0%E9%AC%A5%E7%89%B9%E6%95%88%E6%AA%A2%E6%9F%A5.html` 回應 200。
- 風險：只改本機檢查工具與文件，不影響 `gameState`、戰鬥判定或多人同步 payload。

### 2026-06-19

- 範圍：讓戰鬥特效檢查工具可在本地覆寫單招命中特效、命中音效與施放音效，支援存入 localStorage、匯入 / 匯出 JSON，並讓音效選單與顯示以中文名稱為主。
- 檔案：`public/board_戰鬥特效檢查.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：用 Node 檢查 HTML 內嵌 script 語法；用 jsdom 載入工具頁並模擬修改 `luffy_pistol`，確認 localStorage 寫入 `{ effect, sfx, castSfx }`；確認工具頁 HTTP 回應 200。
- 風險：本地覆寫只存在瀏覽器 localStorage 或匯出的 JSON，尚未直接寫回正式 `battle_hit_effect_settings.js`；不影響同步 payload。

### 2026-06-19

- 範圍：調整技能學習階段規則。有下一階進化的角色 / 形態只保留到下一階進化等級以前的技能，Lv.50-95 後期技能只加到無進化角色或最終形態。
- 檔案：`public/js/board_cards.js`、`docs/GAME_RULES.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_cards.js`；用 Node VM 載入 `BoardCards`，確認 51 位角色、32 個進化形態、83 個可戰鬥形態、1044 招，32 個有下一階的形態沒有超過進化等級上限，且同一進化鏈 duplicate move name 數為 0。
- 風險：保留 move id 與 `gameState` 欄位，不影響同步 payload；舊存檔中原形態已學到的高等招會在同步 catalog 時被移除，玩家需要進化到對應形態才能再使用後續招式。

### 2026-06-19

- 範圍：再次檢查並收斂角色技能名稱，移除自動後綴與明顯自創招式名，優先使用動畫 / 漫畫出現過的招式、果實能力名、霸氣類型或角色已知戰鬥動作；可信名稱不足的後期補招改為不產生。
- 檔案：`public/js/board_cards.js`、`docs/GAME_RULES.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_cards.js`；用 Node VM 載入 `BoardCards`，確認 51 位角色、32 個進化形態、83 個可戰鬥形態、658 招，所有形態都有 Lv.1 傷害招式、沒有進化等級上限違規、同一角色內 duplicate move name 數為 0；掃描玩家實際可見招式名稱，未再命中進階 / 高階 / 終式 / 終擊 / 新世界等自創後綴。
- 風險：保留 move id 與 `gameState` 欄位，不影響同步 payload；部分角色後期可學招式數量變少，避免用自創名稱湊滿招式。

### 2026-06-19

- 範圍：補強技能名稱與進化強度檢查，消除整條進化鏈內的剩餘同名招式，並調整新世界喬巴與新世界克洛克達爾的 Lv.1 代表攻擊威力，避免剛進化時低於進化前最高傷害。
- 檔案：`public/js/board_cards.js`、`docs/GAME_RULES.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_cards.js`；用 Node VM 載入 `BoardCards`，確認 51 位角色、32 個進化形態、83 個可戰鬥形態、651 招，所有形態都有 Lv.1 傷害招式、同形態 duplicate move name 數為 0、整條進化鏈 duplicate move name 數為 0、進化後最高傷害退化數為 0、剛進化 Lv.1 最高傷害低於進化前最高傷害數為 0。
- 風險：保留 move id 與 `gameState` 欄位，不影響同步 payload；兩個進化形態的招式威力提高，會讓新世界喬巴與新世界克洛克達爾剛進化時更穩定。

### 2026-06-19

- 範圍：產生角色 / 進化技能審閱用文字清單，方便人工檢查招式名稱、等級、類型、PP、威力、move id 與效果文字。
- 檔案：`character_skill_review_list.txt`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：用 Node VM 載入 `BoardCards` 產生 UTF-8 BOM 文字檔，確認清單 656 行，包含 51 位基礎角色、32 個進化形態與 651 招；檔案地圖已標記此清單不是正式資料來源。
- 風險：只新增審閱報表與文件，不影響遊戲資料、同步 payload 或存檔。

### 2026-06-19

- 範圍：將角色 / 進化技能審閱清單改成固定欄寬對齊版，按角色與形態分段，效果文字另起一行，降低記事本開啟時的混亂感。
- 檔案：`character_skill_review_list.txt`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：重新產生 UTF-8 BOM 文字檔，確認 1689 行、BOM 為 `EF BB BF`、沒有 `??` 亂碼片段；抽查前 40 行確認欄位對齊。
- 風險：只改審閱報表格式與文件，不影響遊戲資料、同步 payload 或存檔。

### 2026-06-19

- 範圍：調整進化後技能學習流程。一般進化保留原本上場技能，只將第一個真正新的進化招式排入待學習佇列讓玩家選擇替換；進化形態後續招式改由進化等級起逐級學習；五檔・尼卡保留特殊覺醒，直接切換五檔預設招式。
- 檔案：`public/js/board_game.js`、`public/js/board_cards.js`、`character_skill_review_list.txt`、`docs/GAME_RULES.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js` 與 `node --check public/js/board_cards.js`；用 Node VM 載入 `BoardCards` 驗證 32 個進化形態中，31 個一般進化在進化等級只有 1 個真正新 move id 可學，五檔・尼卡可直接取得五檔招式；模擬進化後 active move ids，確認一般進化保留舊招且會排 1 招待學，五檔直接換招；重新產生技能審閱清單 1689 行、651 招。
- 風險：保留 `moveId`、`unlockedMoveIds` 與既有待學習佇列欄位，不新增同步 payload 欄位；舊存檔同步後，已進化角色會保留合法舊招並可透過新技能提示補學進化招。

### 2026-06-20

- 範圍：修正技能學習等級重疊問題，除了基礎角色開局自帶與五檔覺醒直換外，同一角色 / 形態同一等級最多只會排入 1 招升級學習招式；沿用進化前同一 `moveId` 的招式不再佔用進化當下的新招等級。
- 檔案：`public/js/board_cards.js`、`character_skill_review_list.txt`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_cards.js`；用 Node VM 載入 `BoardCards` 確認 51 位角色、32 個進化形態、651 招，非預期同級學習重複數為 0，31 個一般進化在進化等級都有且只有 1 個真正新 move id，五檔 4 招預設招式標記為 Lv.51 覺醒直換；重新產生 UTF-8 BOM 技能審閱清單 1690 行。
- 風險：保留既有 `moveId` 與 `gameState` 欄位，不影響多人同步 payload；部分招式的 `unlockLevel` 會往後錯開，舊存檔同步 catalog 後會依新等級顯示待學習招式。

### 2026-06-20

- 範圍：依使用者手動修改的 `character_skill_review_list.txt` 校正正式技能名稱，將二檔魯夫「巨人手槍」改為「巨人槍」、四檔「彈力防禦」改為「坦克人」、新世界香吉士「牛肉爆裂」改為「魔神風腳」。
- 檔案：`public/js/board_cards.js`、`docs/GAME_RULES.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_cards.js`；用 Node VM 載入 `BoardCards` 並解析 `character_skill_review_list.txt`，確認 646 個唯一 move id 全部對上，文字檔與正式資料差異數為 0。
- 風險：只改顯示名稱與後期名稱候選，不改 `moveId`、技能威力、PP、效果、學習等級、`gameState` 或同步 payload。

### 2026-06-20

- 範圍：修正司法島副本階段擊破後的回合交接。階段敵人被打倒後仍先完整播放獎勵 / buff 與下一階段換人選單；玩家選好下一位出戰角色後，只初始化下一階段共享敵人並交棒，不再立刻讓同一玩家開下一階段。輪到已參與司法島且仍在司法島的玩家時，即使沒有舊 `pendingBattle` 也會用共享 raid 狀態自動續戰。
- 檔案：`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`。
- 風險：只調整司法島結算與自動續戰判斷，不新增 `gameState` 欄位，不改 Socket.IO event 或 localStorage key；需要實機多人測試確認一招擊破後的視覺節奏與旁觀同步符合預期。

### 2026-06-20

- 範圍：新增戰鬥進場對話重新設計清單，將 51 個原角色、32 個進化形態與 45 個敵人對話 key 全部展開成 TSV，包含目前對話角色 key、敵人分類、配對類型、現有角色句 / 敵人句、來源與 GPT 改寫欄位。
- 檔案：`prebattle_dialogue_redesign_list.tsv`、`scripts/generate_prebattle_dialogue_redesign_list.js`、`docs/FILE_MAP.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check scripts/generate_prebattle_dialogue_redesign_list.js`；執行 `node scripts/generate_prebattle_dialogue_redesign_list.js`，確認輸出 83 個可戰鬥形態、45 個敵人 key、3735 筆組合；抽查 TSV 前幾列、專屬配對與分類配對中文欄位正常。
- 風險：只新增審閱清單與產生器，不改正式 `public/js/onepiece_prebattle_lines.js`、`gameState`、同步 payload 或戰鬥播放流程；清單暴露出部分進化形態目前缺獨立對話 key，需後續正式導入時再決定是否新增 alias 或獨立進場句。

### 2026-06-21

- 範圍：修正 Marineford / 頂上戰爭篇多人回合交接。多人局中 Marineford 戰鬥結算後改走交棒流程；未擊破 Boss 的 round-pause 會保存為 `pendingBattle`，保留 Boss HP 與狀態，下次輪到該玩家時用 Marineford 專屬 resume 分支續戰；擊破 Boss 後推進下一戰但先交棒。單人測試仍維持結算後直接回 Marineford 頁面。
- 檔案：`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用 `rg` 確認 `isPendingMarinefordBattle`、`resumeMarinefordBattle`、`finalizeMarinefordBattleStep` 與 round-pause 保存流程皆存在。
- 風險：不新增 `gameState` 欄位、不改 Socket.IO event 或 localStorage key；需要實機多人測試確認 Marineford 戰鬥頁 finish 後的交棒橫幅、下次輪到原玩家時的自動續戰，以及通關後招募頁開啟時機符合預期。

### 2026-06-21

- 範圍：匯入使用者完成的戰鬥進場對話 TSV，將 `GPT新版角色句` / `GPT新版敵人句` 寫入正式 `public/js/onepiece_prebattle_lines.js` 的 `pairLines`；同時讓 `prebattleHeroKey()` 與清單產生器優先使用角色實際形態名稱命中配對，保留白鬍子與愛德華·紐蓋特等進化差異。
- 檔案：`public/js/onepiece_prebattle_lines.js`、`public/js/board_game.js`、`prebattle_dialogue_redesign_list.tsv`、`scripts/generate_prebattle_dialogue_redesign_list.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/onepiece_prebattle_lines.js`、`node --check public/js/board_game.js`、`node --check scripts/generate_prebattle_dialogue_redesign_list.js`；用 Node VM 載入正式資料確認 83 個形態、45 個敵人、3735 組 `pairLines` 全部可命中，缺 pair 數 0、超過 30 字台詞數 0。
- 風險：只改進場對話資料與對話 key 查找順序，不新增 `gameState` 欄位、不改同步 payload；GPT 備註中的「原作語意」仍需日後人工逐字校稿，實機需確認戰鬥前對話視窗排版與節奏。

### 2026-06-21

- 範圍：新增戰鬥進場對話純文字審閱清單，將 GPT 新版角色句、敵人句與備註依角色 / 進化形態分段列出，方便不用開 TSV 也能人工校稿。
- 檔案：`prebattle_dialogue_text_list.txt`、`docs/FILE_MAP.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：由 `prebattle_dialogue_redesign_list.tsv` 產生 UTF-8 BOM 文字檔，確認 3735 組、15194 行，抽查前段中文與分段格式正常。
- 風險：只新增審閱報表與文件，不影響正式 `public/js/onepiece_prebattle_lines.js`、`gameState` 或同步 payload。

### 2026-06-22

- 範圍：長測發現共鬥瀕死替補後，交棒橫幅尚未真正切到下一位玩家前，原玩家可能再次送出戰鬥行動，造成 `turnStep=共鬥交棒`、`battle.result=replacement` 與 `needsReplacement=true` 殘留並在 seed `1940188` 第 117 回合 timeout。新增 `battle.coop.handoffPending` 短暫鎖，排程共鬥交棒橫幅時先鎖住戰鬥操作，橫幅 callback 完成真正 handoff 後再解除。
- 檔案：`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；使用 `scripts/growth_curve_playtest.js --seeds 940131,940148,940165 --turns 150 --players 4 --target-ending --no-focus-ending-captain` 回歸，5 次嘗試中 3 次跑滿 150 回合、2 次依既有早期重抽條件停止，未再出現 `turn-timeout`，stderr 為空。
- 風險：新增的是 `battleState.coop` 內的 transient handoff flag，不新增 `gameState` 主欄位、不改 Socket.IO event 或 localStorage key；仍需實機多人確認真人端與觀看方在交棒橫幅期間都無法插入舊玩家行動。

- 範圍：長測 4 CPU 局反覆出現 `restart-reselect-bad-start-no-recruits`、`restart-reselect-early-economy-prison`，且部分玩家隊伍未滿 / 等級偏低就進推進城或高風險路線。調整正式 CPU 選路與 `scripts/growth_curve_playtest.js` 的自動玩家評分，新增早期保守期：隊伍未滿、平均等級太低或戰力不足時優先酒館補隊伍，並大幅降低司法島、推進城、Marineford 與非舒適敵島權重。
- 檔案：`public/js/board_game.js`、`scripts/growth_curve_playtest.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check scripts/growth_curve_playtest.js`；確認 `http://127.0.0.1:8787/board_start.html` 回傳 200。長測批次持續執行中，後續會補充 4 CPU 開局與結局目標結果。
- 風險：只調整 CPU 路線評分與測試腳本，不新增 `gameState` 欄位、不改 Socket.IO event、localStorage key 或實際副本 / 戰鬥規則；仍需長測確認是否過度保守導致結局進度變慢。

- 範圍：長測 seed `1950141` 第 49 回合發現海格共鬥 timeout：索隆仍在共鬥戰鬥中，但草帽路飛已逃跑的 runtime 殘留 `needsReplacement=true`，`battleView` 可能誤判成離場玩家需要替補，導致自動玩家一直等不到可選候補。調整共鬥 runtime sanitize、替補玩家搜尋、存活判斷與逃跑結算，讓已逃跑 / 已戰敗離場的 runtime 立即清除替補旗標並不再參與替補判定。
- 檔案：`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check scripts/growth_curve_playtest.js`；確認 `http://127.0.0.1:8787/board_start.html` 回傳 200。以 `scripts/growth_curve_playtest.js --seeds 1950141 --turns 120 --players 4 --target-ending --no-focus-ending-captain` 重跑時，使用者要求停止，批次停在第 20 回合，stderr 為空，尚未跑到原 timeout 的第 49 回合。
- 風險：只清理 `battleState.coop.runtimes` 的 transient 替補狀態，不新增 `gameState` 欄位、不改 Socket.IO event 或 localStorage key；仍需之後補跑同 seed 至第 49 回合以上，並用實機確認共鬥逃跑者不會被觀看方誤帶回替補選單。

- 範圍：新增給外部 GPT / 遊戲設計助手閱讀的總報告，整理目前 Board 遊戲定位、技術同步架構、核心流程、地圖、角色技能與進化、道具、任務、戰鬥、共鬥、副本、CPU、旁觀同步需求、近期進度、已知風險，以及希望 GPT 回答的功能 / 視覺 / UI / 平衡 / 測試建議格式。
- 檔案：`gpt_game_review_report.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認 `gpt_game_review_report.md` 存在，並用 `rg` 搜尋「給 GPT 的閱讀任務」、「目前已知風險」、「請 GPT 回答時遵守的格式」等關鍵段落。
- 風險：只新增整理報告與文件索引，不改正式遊戲規則、程式、資料 id、`gameState`、Socket.IO event 或 localStorage key；報告內容若與程式碼日後變動不一致，仍以正式程式與 `docs/GAME_RULES.md` 為準。

- 範圍：調整船隻移動體驗。主地圖移動步長統一為約 0.32 秒，符合每步 0.25 到 0.35 秒的可讀節奏；新增金色目的格提示圈，依目前 `pendingMove` 推估可確定的落點，遇到分岔、顛倒山或必須停靠互動的島時不預告未決路線；CPU / 測試快轉只壓縮每步等待動畫，不改實際擲骰、路線、落點或事件結果。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用 `rg` 確認 `map-move-destination-ring`、`MAP_MOVEMENT_STEP_MS` 與文件紀錄存在；啟動 `npm start` 後確認 `http://127.0.0.1:8787/board_start.html` 回傳 200。
- 風險：金色目的格圈為純 UI 推估，不新增 `gameState` 欄位、不改 Socket.IO event 或 localStorage key；實機仍需確認桌機 / 平板地圖縮放下金圈不遮擋船隻，且路線分岔與特殊島停靠時提示符合玩家預期。

### 2026-07-11

- 範圍：預先建立新一批通用外觀框素材資料夾，供後續匯入推進城麥哲倫框與四皇黑鬍子 / 大媽 / 凱多 / 紅髮框素材。
- 檔案：`public/images/board/battle/cosmetic_frames/impel_down_magellan/`、`public/images/board/battle/cosmetic_frames/yonko_blackbeard/`、`public/images/board/battle/cosmetic_frames/yonko_bigmom/`、`public/images/board/battle/cosmetic_frames/yonko_kaido/`、`public/images/board/battle/cosmetic_frames/yonko_shanks/`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：用 PowerShell `Get-ChildItem` 確認 5 個新素材資料夾已存在，並更新素材目錄索引。
- 風險：本次只新增空素材資料夾與文件紀錄，尚未接入正式 `cosmeticFrameId`、解鎖條件、戰鬥頁圖層設定、`gameState`、Socket.IO event 或 localStorage key。

- 範圍：匯入並改名推進城麥哲倫框與四皇黑鬍子 / 大媽 / 凱多 / 紅髮框素材，每組整理為 `frame.webp`、`left_part.webp`、`right_part.webp`、`aura.webp`；同時將 5 組新框加入 `public/board_cosmetic_frame_demo.html` 預覽清單，並讓示範頁每個圖層可調整 `rotate`、`flipX`、`flipY`。
- 檔案：`public/board_cosmetic_frame_demo.html`、`public/images/board/battle/cosmetic_frames/impel_down_magellan/`、`public/images/board/battle/cosmetic_frames/yonko_blackbeard/`、`public/images/board/battle/cosmetic_frames/yonko_bigmom/`、`public/images/board/battle/cosmetic_frames/yonko_kaido/`、`public/images/board/battle/cosmetic_frames/yonko_shanks/`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認 5 組資料夾皆包含 `aura.webp`、`frame.webp`、`left_part.webp`、`right_part.webp`，並檢查示範頁匯出的 JSON 會帶出角度與翻轉欄位。
- 風險：本次只影響素材命名與本機示範頁，尚未把 5 組新成就框接入正式 `COSMETIC_FRAME_DEFS`、戰鬥頁正式圖層、解鎖判斷、`gameState`、Socket.IO event 或 localStorage key。

- 範圍：依使用者在示範頁輸出的 JSON，更新推進城麥哲倫框與四皇黑鬍子 / 大媽 / 凱多 / 紅髮框的預設 X / Y / W / H、透明度、濃度、層級、混合模式、角度與翻轉設定；推進城與黑鬍子預覽角色改為新世界索隆。
- 檔案：`public/board_cosmetic_frame_demo.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行示範頁內嵌 script 語法檢查，並掃描 `asset` 引用確認 46 個素材路徑皆存在。
- 風險：本次仍只更新本機示範頁的預設視覺參數，不影響正式外觀框解鎖、正式戰鬥頁、`gameState`、Socket.IO event 或 localStorage key。

- 範圍：新增正式戰鬥頁測試用接入。`public/js/board_battle.js` 增加推進城麥哲倫框與四皇黑鬍子 / 大媽 / 凱多 / 紅髮框的 `COSMETIC_FRAME_CONFIGS`，正式頁外觀框圖層支援 `rotate`、`flipX`、`flipY`；`public/board_battle_frame_test.html` 增加 5 個成就框測試入口；`public/board_battle.html` 更新 JS 版本號避免快取。
- 檔案：`public/js/board_battle.js`、`public/board_battle.html`、`public/board_battle_frame_test.html`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`；檢查正式戰鬥頁測試入口與正式戰鬥頁 HTML 內嵌 script 語法；掃描正式戰鬥 JS 與測試頁中的圖片路徑；確認 `http://127.0.0.1:8787/board_battle_frame_test.html` 與 `http://127.0.0.1:8787/board_battle.html?frameTest=1` 可回應；用 jsdom 點擊測試頁第 11 張紅髮框卡片，確認寫入的臨時 snapshot `cosmeticFrameId` 為 `yonkoShanks`。
- 風險：本次只讓新框能透過正式戰鬥頁測試入口預覽，不新增正式解鎖條件、不改船員詳情選框、不寫入主遊戲存檔欄位、不改 Socket.IO event 或 localStorage key。

- 範圍：依使用者第二次輸出的 JSON 微調推進城・毒龍框與四皇大媽框座標。推進城左毒龍 X 改為 146，主框縮為 105 x 108.5；大媽主框移到 Y 48.5 並縮高為 106；同步更新正式戰鬥頁測試設定與示範頁預設值，並更新 `board_battle.html` 的 JS query 版本號。
- 檔案：`public/board_cosmetic_frame_demo.html`、`public/js/board_battle.js`、`public/board_battle.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`；檢查示範頁與正式測試頁內嵌 script 語法；掃描外觀框素材路徑；確認正式戰鬥頁測試入口與 `board_battle.html?frameTest=1` 可回應。
- 風險：仍只調整示範頁與正式戰鬥頁測試用視覺參數，不改正式外觀框解鎖、船員詳情選框、主遊戲存檔、Socket.IO event 或 localStorage key。

- 範圍：調整角色專屬外觀框的可裝備判斷，讓 `狙擊王框` 可從狙擊王進化到新世界騙人布後保留並繼續在船員詳情中選用；原本騙人布仍不能直接裝備狙擊王框，角色框的自動預設也仍只在原對應形態套用。
- 檔案：`public/js/board_game.js`、`docs/GAME_RULES.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用靜態腳本檢查 `sogeking` 定義含 `inheritToFormIds: ["usopp_evolution_2"]`，且角色框預設函式以 `includeInherited: false` 避免新世界騙人布被自動強塞狙擊王框。
- 風險：不新增 `gameState` 主欄位、不改 localStorage key 或 Socket.IO event；既有存檔中已裝備狙擊王框的新世界騙人布會保留，未裝框者只是在船員詳情多出可手動選用的狙擊王框。

- 範圍：把使用者測試 OK 的 `推進城・毒龍框`、`四皇黑鬍子框`、`四皇大媽框`、`四皇凱多框`、`四皇紅髮框` 正式接入主遊戲外觀框系統。`public/js/board_game.js` 新增 5 個通用成就框定義與別名；擊退麥哲倫會解鎖毒龍框，四皇首次打倒對應 glyph 時會解鎖對應四皇框；讀舊存檔時會用麥哲倫討伐紀錄 / 舊 log、玩家自己的四皇首勝 glyph、拓本欄位與拓本道具回補。主頁 script query 與戰鬥頁版本字串更新為 `20260711-achievement-cosmetic-frames-v1`。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用靜態腳本檢查 5 個新框定義、麥哲倫 / 四皇授予流程與舊紀錄回補流程；確認 `http://127.0.0.1:8787/board_start.html` / `board_game.html` 皆回應 200；執行 `git diff --check`。
- 風險：沿用既有 `ownedCosmeticFrameIds` / `cosmeticFrameId` 欄位，不新增 localStorage key、不改 Socket.IO event；新框是通用成就框，解鎖後可在船員詳情逐一選用。

### 2026-07-12

- 範圍：預先建立 8 組新外觀框素材資料夾，供使用者放入已生成圖片後再改名與接入：四檔魯夫、新世界騙人布、新世界喬巴、新世界羅賓、靈魂之王布魯克、佛朗基將軍、四皇全倒、伊姆 / 空白王座。
- 檔案：`public/images/board/battle/cosmetic_frames/luffy_gear_fourth/`、`public/images/board/battle/cosmetic_frames/usopp_new_world/`、`public/images/board/battle/cosmetic_frames/chopper_new_world/`、`public/images/board/battle/cosmetic_frames/robin_new_world/`、`public/images/board/battle/cosmetic_frames/brook_soul_king/`、`public/images/board/battle/cosmetic_frames/franky_shogun/`、`public/images/board/battle/cosmetic_frames/yonko_all_clear/`、`public/images/board/battle/cosmetic_frames/final_imu/`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認 8 個資料夾已建立；目前資料夾為空，尚未接 `public/board_cosmetic_frame_demo.html`、`public/js/board_battle.js`、`public/js/board_game.js` 或正式解鎖條件。
- 風險：本次只新增空素材目錄與文件紀錄，不改遊戲規則、存檔欄位、Socket.IO event、localStorage key 或正式戰鬥頁顯示。

- 範圍：匯入並改名 8 組新外觀框素材，每組整理為 `frame.webp`、`left_part.webp`、`right_part.webp`、`aura.webp`；新增四檔魯夫、新世界騙人布、新世界喬巴、新世界羅賓、靈魂之王布魯克、佛朗基將軍、四皇全倒、空白王座框到 `public/board_cosmetic_frame_demo.html`，並補上對應進化角色 portrait 選項供微調。
- 檔案：`public/board_cosmetic_frame_demo.html`、`public/images/board/battle/cosmetic_frames/luffy_gear_fourth/`、`public/images/board/battle/cosmetic_frames/usopp_new_world/`、`public/images/board/battle/cosmetic_frames/chopper_new_world/`、`public/images/board/battle/cosmetic_frames/robin_new_world/`、`public/images/board/battle/cosmetic_frames/brook_soul_king/`、`public/images/board/battle/cosmetic_frames/franky_shogun/`、`public/images/board/battle/cosmetic_frames/yonko_all_clear/`、`public/images/board/battle/cosmetic_frames/final_imu/`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認 8 組資料夾皆包含 `aura.webp`、`frame.webp`、`left_part.webp`、`right_part.webp`；用 Node 檢查示範頁內嵌 script 可解析，並掃描 79 個 `images/board/battle/...webp` 引用皆存在。
- 風險：本次只影響素材檔名與本機示範頁預設座標，尚未接正式 `COSMETIC_FRAME_CONFIGS`、正式解鎖條件、船員詳情選框、主遊戲存檔、Socket.IO event 或 localStorage key。

- 範圍：依使用者輸出的 JSON 更新 7 組新框座標，並同步接入正式戰鬥頁測試配置與測試入口：新世界騙人布、新世界喬巴、新世界羅賓、靈魂之王布魯克、佛朗基將軍、四皇全倒、空白王座。四檔魯夫框尚未收到座標，仍只保留示範頁預設值。
- 檔案：`public/board_cosmetic_frame_demo.html`、`public/js/board_battle.js`、`public/board_battle.html`、`public/board_battle_frame_test.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`；檢查示範頁與正式測試入口內嵌 script 語法；掃描示範頁、正式戰鬥 JS、測試入口中的 `images/board/battle/...webp` 引用；確認 `board_battle_frame_test.html` 與 `board_battle.html?frameTest=1` 可回應。
- 風險：本次只讓 7 組新框能在正式戰鬥頁測試入口預覽，不新增 `COSMETIC_FRAME_DEFS`、不改主遊戲解鎖、船員詳情選框、存檔欄位、Socket.IO event 或 localStorage key。

- 範圍：補上四檔魯夫框的使用者調整座標，並同步接入正式戰鬥頁測試配置與 `public/board_battle_frame_test.html` 測試入口；更新 `board_battle.html` 的 JS query 版本避免快取。
- 檔案：`public/board_cosmetic_frame_demo.html`、`public/js/board_battle.js`、`public/board_battle.html`、`public/board_battle_frame_test.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`；檢查示範頁與正式測試入口內嵌 script 語法；掃描 95 個靜態 `images/board/battle/...webp` 引用；確認 `board_battle_frame_test.html` 與 `board_battle.html?frameTest=1` 可回應，並用靜態腳本確認 `luffyGearFourth` 測試入口與正式配置存在。
- 風險：本次仍只接正式戰鬥頁測試預覽，不新增主遊戲 `COSMETIC_FRAME_DEFS`、不改解鎖條件、船員詳情選框、存檔欄位、Socket.IO event 或 localStorage key。

- 範圍：將使用者測試 OK 的 8 組新外觀框正式接入主遊戲。四檔魯夫、新世界騙人布、新世界喬巴、新世界羅賓、靈魂之王布魯克與佛朗基將軍加入角色進化專屬框；四皇全倒框與空白王座框加入通用成就框。四皇全倒框會在四張四皇框都取得後解鎖，空白王座框會在擊退伊姆時解鎖；舊存檔載入時也會依既有四皇 glyph / 拓本道具 / 已擁有四皇框、`finalGateDefeated` / `finalGateDefeatedBy` 或伊姆擊退 log 回補。同步更新主頁 script 版本號避免快取。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check public/js/board_battle.js`；檢查 `public/board_cosmetic_frame_demo.html` 與 `public/board_battle_frame_test.html` 內嵌 script 語法；掃描 175 個靜態 `images/board/battle/...` 素材引用；用靜態腳本確認 8 個新框定義、進化形態對應、四皇全倒 / 伊姆回補與授予流程；確認 `http://127.0.0.1:8787/board_game.html`、`board_battle_frame_test.html`、`board_battle.html?frameTest=1` 皆回應 200；執行 `git diff --check` 未報錯。
- 風險：沿用既有 `ownedCosmeticFrameIds`、`activeCosmeticFrameId` 與船員卡 `cosmeticFrameId` 欄位，不新增 localStorage key、不改 Socket.IO event；角色專屬框仍只在對應進化形態可選，通用成就框解鎖後可由船員詳情逐一選用。

- 範圍：補齊角色進化框的舊紀錄 / 後階繼承規則。`四檔魯夫框` 現在可在魯夫覺醒成 `luffy_gear_fifth` 五檔・尼卡後保留並繼續於船員詳情選用；五檔本身仍預設使用 `五檔・尼卡框`，不會自動被四檔框覆蓋。主頁 script query 與戰鬥頁版本字串更新為 `20260712-cosmetic-frames-v2`。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；用靜態腳本確認 `luffyGearFourth` 含 `inheritToFormIds: ["luffy_gear_fifth"]`、五檔 form id 存在、`defaultCharacterCosmeticFrameId()` 仍以 `includeInherited: false` 避免五檔自動套四檔框；確認 `http://127.0.0.1:8787/board_game.html` 回應 200；掃描本次修改檔案尾端空白。
- 風險：只調整角色專屬框可選判斷，不新增 `gameState` 欄位、不改 localStorage key 或 Socket.IO event；既有五檔魯夫讀檔後會在選框列表多出四檔魯夫框，但目前已裝備的框不會被強制改掉。

- 範圍：記錄使用者指定的下一批想製作角色進化框待辦清單，包含二檔魯夫、司法島索隆、新世界斯摩格、新世界基德、上校克比、10號船長庫山、年輕雷利、愛德華·紐蓋特、新世界鷹眼、年輕羅傑、四皇巴奇與新世界克洛克達爾。
- 檔案：`docs/GAME_RULES.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：用 `rg` 確認 `docs/GAME_RULES.md` 可搜尋到 `待製作角色進化框`，並用 Node 腳本確認 12 個指定 form id 皆已記錄。
- 風險：本次只改文件待辦，不新增素材資料夾、不接入 `COSMETIC_FRAME_DEFS`、不改正式戰鬥頁、存檔欄位、Socket.IO event 或 localStorage key。

- 範圍：預先建立新世界鷹眼、年輕羅傑、四皇巴奇與新世界克洛克達爾 4 組角色進化外觀框素材資料夾，供使用者放入已生成圖片後再改名與接入。
- 檔案：`public/images/board/battle/cosmetic_frames/mihawk_new_world/`、`public/images/board/battle/cosmetic_frames/roger_young/`、`public/images/board/battle/cosmetic_frames/buggy_yonko/`、`public/images/board/battle/cosmetic_frames/crocodile_new_world/`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：用 PowerShell `Get-ChildItem` 確認 4 個新素材資料夾已存在，並更新素材路徑概覽與待辦說明。
- 風險：本次只新增空素材目錄與文件紀錄，尚未改名素材、接入示範頁、正式戰鬥頁、`COSMETIC_FRAME_DEFS`、存檔欄位、Socket.IO event 或 localStorage key。

- 範圍：補齊下一批 12 組角色進化外觀框素材資料夾，包含二檔魯夫、司法島索隆、新世界斯摩格、新世界基德、上校克比、10號船長庫山、年輕雷利、愛德華·紐蓋特、新世界鷹眼、年輕羅傑、四皇巴奇與新世界克洛克達爾；同時在待辦規則表加上對應素材資料夾欄位。
- 檔案：`public/images/board/battle/cosmetic_frames/luffy_gear_second/`、`public/images/board/battle/cosmetic_frames/zoro_enies_lobby/`、`public/images/board/battle/cosmetic_frames/smoker_new_world/`、`public/images/board/battle/cosmetic_frames/kid_new_world/`、`public/images/board/battle/cosmetic_frames/koby_colonel/`、`public/images/board/battle/cosmetic_frames/kuzan_tenth_captain/`、`public/images/board/battle/cosmetic_frames/rayleigh_young/`、`public/images/board/battle/cosmetic_frames/whitebeard_newgate/`、`public/images/board/battle/cosmetic_frames/mihawk_new_world/`、`public/images/board/battle/cosmetic_frames/roger_young/`、`public/images/board/battle/cosmetic_frames/buggy_yonko/`、`public/images/board/battle/cosmetic_frames/crocodile_new_world/`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：用 PowerShell `Get-ChildItem` 確認 12 個素材資料夾已存在並檢查目前皆尚未放入檔案；用 `rg` 確認文件可搜尋到 12 個資料夾名稱。
- 風險：本次只新增空素材目錄與文件紀錄，尚未改名素材、接入示範頁、正式戰鬥頁、`COSMETIC_FRAME_DEFS`、存檔欄位、Socket.IO event 或 localStorage key。

- 範圍：匯入下一批 12 組角色進化外觀框素材到通用框示範頁。每組素材依提示詞輸出順序改名為 `frame.webp`、`left_part.webp`、`right_part.webp`、`aura.webp`；`public/board_cosmetic_frame_demo.html` 新增 12 組框款、對應進化角色半身圖選項，以及共用四圖層初始座標，供使用者微調後輸出 JSON。
- 檔案：`public/board_cosmetic_frame_demo.html`、`public/images/board/battle/cosmetic_frames/luffy_gear_second/`、`public/images/board/battle/cosmetic_frames/zoro_enies_lobby/`、`public/images/board/battle/cosmetic_frames/smoker_new_world/`、`public/images/board/battle/cosmetic_frames/kid_new_world/`、`public/images/board/battle/cosmetic_frames/koby_colonel/`、`public/images/board/battle/cosmetic_frames/kuzan_tenth_captain/`、`public/images/board/battle/cosmetic_frames/rayleigh_young/`、`public/images/board/battle/cosmetic_frames/whitebeard_newgate/`、`public/images/board/battle/cosmetic_frames/mihawk_new_world/`、`public/images/board/battle/cosmetic_frames/roger_young/`、`public/images/board/battle/cosmetic_frames/buggy_yonko/`、`public/images/board/battle/cosmetic_frames/crocodile_new_world/`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：用 Node 檢查 `public/board_cosmetic_frame_demo.html` 內嵌 script 可解析；掃描示範頁中的 80 個靜態 `images/board/battle/...webp` 引用；確認 12 個新框資料夾皆包含 `frame.webp`、`left_part.webp`、`right_part.webp`、`aura.webp`，並確認 12 組對應進化 portrait 的 `normal` / `angry` / `morale` / `hit` / `weak` / `dizzy` 檔案存在。
- 風險：本次只接入本機示範頁，不改正式戰鬥頁 `COSMETIC_FRAME_CONFIGS`、主遊戲 `COSMETIC_FRAME_DEFS`、解鎖條件、船員詳情選框、存檔欄位、Socket.IO event 或 localStorage key。

- 範圍：依使用者輸出的 JSON 定稿值更新 12 組待製作角色進化外觀框在 `public/board_cosmetic_frame_demo.html` 的預設座標、尺寸、層級、透明度、混合模式、角度與翻轉設定；二檔魯夫重複貼上的值採用同一組，基德與庫山段落中斷的大括號依圖層內容補回完整設定。
- 檔案：`public/board_cosmetic_frame_demo.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：用 Node 檢查 `public/board_cosmetic_frame_demo.html` 內嵌 script 可解析；掃描示範頁靜態 `images/board/battle/...webp` 引用；確認 `http://127.0.0.1:8787/board_cosmetic_frame_demo.html` 回應 200。
- 風險：本次只更新示範頁預設值，不接正式戰鬥頁、不新增主遊戲外觀框定義、不改解鎖條件、船員詳情選框、存檔欄位、Socket.IO event 或 localStorage key。

- 範圍：將 12 組已定稿座標接入正式戰鬥頁測試預覽。`public/js/board_battle.js` 新增二檔魯夫、司法島索隆、新世界斯摩格、新世界基德、上校克比、10號船長庫山、年輕雷利、愛德華・紐蓋特、新世界鷹眼、年輕羅傑、四皇巴奇與新世界克洛克達爾的 `COSMETIC_FRAME_CONFIGS` 與 alias；`public/board_battle_frame_test.html` 新增 12 個測試按鈕，會寫入臨時 battle snapshot 並用正式 `board_battle.html` 預覽；同步更新戰鬥頁 / 主頁戰鬥 iframe 版本避免快取。
- 檔案：`public/js/board_battle.js`、`public/board_battle_frame_test.html`、`public/board_battle.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`、`node --check public/js/board_game.js`；檢查 `public/board_battle_frame_test.html` 內嵌 script 語法；掃描正式戰鬥 JS 與測試入口的 `images/board/battle/...webp` 引用；確認 `board_battle_frame_test.html` 與 `board_battle.html?frameTest=1` 回應 200；用 jsdom 點擊測試頁二檔魯夫卡片，確認臨時 snapshot 寫入 `cosmeticFrameId: "luffyGearSecond"`。
- 風險：本次只接入正式戰鬥頁與測試入口，不新增主遊戲 `COSMETIC_FRAME_DEFS`、不改船員詳情選框 / 解鎖流程、不新增 `gameState` 欄位、Socket.IO event 或 localStorage key。

- 範圍：依使用者最新輸出的 JSON 微調二檔魯夫框左側 JET 拳圖層，同步更新示範頁與正式戰鬥頁預覽設定；新值為 `x: 87`、`y: 71`、`w: 97`、`rotate: -79`、`flipY: true`。
- 檔案：`public/board_cosmetic_frame_demo.html`、`public/js/board_battle.js`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`；檢查 `public/board_cosmetic_frame_demo.html` 與 `public/board_battle_frame_test.html` 內嵌 script 語法；確認 `board_cosmetic_frame_demo.html`、`board_battle_frame_test.html` 與 `board_battle.html?frameTest=1` 回應 200。
- 風險：本次只調整既有外觀框座標，不改素材檔名、不新增主遊戲外觀框解鎖、不改存檔欄位、Socket.IO event 或 localStorage key。

- 範圍：整理使用者新放入的新世界索隆新版外觀框素材，保留舊版正式遊戲素材不動，將新圖改名為 `frame_v2.webp`、`left_part_v2.webp`、`right_part_v2.webp`、`aura_v2.webp`，並讓 `public/board_cosmetic_frame_demo.html` 的新世界索隆框改用新版三刀主框、阿修羅鬼氣與亡者戲斬擊圖層供微調。
- 檔案：`public/board_cosmetic_frame_demo.html`、`public/images/board/battle/cosmetic_frames/zoro_new_world/`、`docs/DEV_WORKFLOW.md`。
- 驗證：檢查 `public/board_cosmetic_frame_demo.html` 內嵌 script 語法；確認新版 4 個 `zoro_new_world/*_v2.webp` 素材存在；確認 `board_cosmetic_frame_demo.html` 回應 200。
- 風險：本次只接入示範頁調整，不改正式戰鬥頁 `COSMETIC_FRAME_CONFIGS`、主遊戲外觀框解鎖、船員詳情選框、存檔欄位、Socket.IO event 或 localStorage key。

- 範圍：依使用者輸出的新世界索隆框 JSON 定稿值，更新示範頁與正式戰鬥頁 `zoroNewWorld` 為新版三刀主框 / 阿修羅鬼氣 / 亡者戲斬擊素材與座標；同步更新戰鬥頁 script 版本與主遊戲 battle iframe 版本，避免舊框快取殘留。
- 檔案：`public/board_cosmetic_frame_demo.html`、`public/js/board_battle.js`、`public/board_battle.html`、`public/js/board_game.js`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`、`node --check public/js/board_game.js`；檢查 `public/board_cosmetic_frame_demo.html` 與 `public/board_battle_frame_test.html` 內嵌 script 語法；掃描正式戰鬥 JS 與示範頁的 `images/board/battle/...webp` 引用；確認 `board_cosmetic_frame_demo.html`、`board_battle_frame_test.html` 與 `board_battle.html?frameTest=1` 回應 200。
- 風險：本次只替換新世界索隆既有角色專屬框的視覺素材與座標，不新增 `COSMETIC_FRAME_DEFS`、不改解鎖條件、船員詳情選框邏輯、存檔欄位、Socket.IO event 或 localStorage key。

- 範圍：依使用者要求刪除新世界索隆舊版外觀框素材 `top_sword.webp`、`left_sword.webp`、`right_sword.webp` 與舊 `aura.webp`，將新版 `frame_v2.webp`、`left_part_v2.webp`、`right_part_v2.webp`、`aura_v2.webp` 改為正式檔名 `frame.webp`、`left_part.webp`、`right_part.webp`、`aura.webp`，並同步更新示範頁與正式戰鬥頁路徑；戰鬥頁版本更新避免快取舊圖。
- 檔案：`public/images/board/battle/cosmetic_frames/zoro_new_world/`、`public/board_cosmetic_frame_demo.html`、`public/js/board_battle.js`、`public/board_battle.html`、`public/js/board_game.js`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認 `zoro_new_world` 目錄只剩新版 `frame.webp`、`left_part.webp`、`right_part.webp`、`aura.webp`；執行 `node --check public/js/board_battle.js`、`node --check public/js/board_game.js`；檢查示範頁與正式戰鬥測試頁內嵌 script 語法；掃描相關頁面的 `images/board/battle/...webp` 引用；確認 `board_cosmetic_frame_demo.html`、`board_battle_frame_test.html` 與 `board_battle.html?frameTest=1` 回應 200。
- 風險：本次只整理新世界索隆外觀框素材檔名與引用，不改主遊戲外觀框 id、解鎖條件、存檔欄位、Socket.IO event 或 localStorage key。

- 範圍：提高正式戰鬥頁 HUD 狀態欄層級，讓玩家 / 敵方名字、血條、階段血條、攜帶物 / 屬性資訊與狀態圖示固定顯示在角色外觀框裝飾之上；同步更新戰鬥頁與主遊戲 battle iframe 版本，避免舊 CSS 快取。
- 檔案：`public/board_battle.html`、`public/js/board_game.js`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；檢查 `public/board_battle.html` 的 HUD z-index 與 `BATTLE_PAGE_VERSION` 已同步；確認 `board_battle_frame_test.html` 與 `board_battle.html?frameTest=1` 回應 200。
- 風險：本次只改 HUD 層級與版本號，不改戰鬥邏輯、外觀框 id、解鎖條件、存檔欄位、Socket.IO event 或 localStorage key。

- 範圍：依使用者輸出的新世界索隆框 JSON 微調阿修羅鬼氣光效圖層，將 `aura` 改為 `y: 45`、`opacity: 0.45`、`strength: 2.3`；同步更新示範頁、正式戰鬥頁設定與戰鬥頁版本，避免舊座標快取。
- 檔案：`public/board_cosmetic_frame_demo.html`、`public/js/board_battle.js`、`public/board_battle.html`、`public/js/board_game.js`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`、`node --check public/js/board_game.js`；檢查示範頁與正式戰鬥測試頁內嵌 script 語法；確認 `board_cosmetic_frame_demo.html`、`board_battle_frame_test.html` 與 `board_battle.html?frameTest=1` 回應 200。
- 風險：本次只調整新世界索隆既有外觀框的光效圖層，不改素材檔名、外觀框 id、解鎖條件、存檔欄位、Socket.IO event 或 localStorage key。

- 範圍：依使用者輸出的新世界索隆框 JSON 再次定稿整組外觀框數值：`aura` 改為 `y: 27.5 / w: 148 / h: 132.5 / opacity: 1 / z: 13`，左右配件 `strength` 分別為 `1.5` 與 `1.8`，主框 `flipY: true`；同步更新示範頁、正式戰鬥頁設定與戰鬥頁版本，避免舊座標快取。
- 檔案：`public/board_cosmetic_frame_demo.html`、`public/js/board_battle.js`、`public/board_battle.html`、`public/js/board_game.js`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`、`node --check public/js/board_game.js`；檢查示範頁與正式戰鬥測試頁內嵌 script 語法；確認 `board_cosmetic_frame_demo.html`、`board_battle_frame_test.html` 與 `board_battle.html?frameTest=1` 回應 200。
- 風險：本次只調整新世界索隆既有外觀框的視覺圖層數值，不改素材檔名、外觀框 id、解鎖條件、存檔欄位、Socket.IO event 或 localStorage key。

- 範圍：依使用者輸出的新世界索隆框 JSON 微調阿修羅鬼氣光效位置，將 `zoroNewWorld.layers.aura.y` 從 `27.5` 改為 `38.5`；同步更新示範頁、正式戰鬥頁設定與戰鬥頁版本，避免舊座標快取。
- 檔案：`public/board_cosmetic_frame_demo.html`、`public/js/board_battle.js`、`public/board_battle.html`、`public/js/board_game.js`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`、`node --check public/js/board_game.js`；檢查示範頁與正式戰鬥測試頁內嵌 script 語法；確認 `board_cosmetic_frame_demo.html`、`board_battle_frame_test.html` 與 `board_battle.html?frameTest=1` 回應 200。
- 風險：本次只調整新世界索隆既有外觀框的光效 y 座標，不改素材檔名、外觀框 id、解鎖條件、存檔欄位、Socket.IO event 或 localStorage key。

### 2026-07-14

- 範圍：建立敵人外觀框待整理素材目錄，供羅布・路基、卡古、多佛朗明哥、艾尼路、月光莫利亞、戰國、赤犬、黃猿、青雉 9 組敵人框放入生成圖；新增 `public/images/board/battle/enemy_frames/` 與各敵人子資料夾，預計後續整理為 `frame.webp`、`left_part.webp`、`right_part.webp`、`aura.webp` 後再接入示範頁與正式戰鬥頁。
- 檔案：`public/images/board/battle/enemy_frames/`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認 9 個敵人外觀框資料夾已建立；本次只新增空素材目錄與文件紀錄，未修改 JS / HTML 執行邏輯。

- 範圍：整理 9 組敵人外觀框生成圖，統一改名為每組固定的 `frame.webp`、`left_part.webp`、`right_part.webp`、`aura.webp`；羅布・路基套用新補的豹尾配件，艾尼路套用雷鼓長棍與雷神拳配件。
- 檔案：`public/images/board/battle/enemy_frames/**`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認每個敵人框資料夾都只保留 `aura.webp`、`frame.webp`、`left_part.webp`、`right_part.webp` 四個檔案；本次只整理素材檔名與文件紀錄，尚未接入示範頁或正式戰鬥頁。
- 風險：本次未接入正式戰鬥頁、示範頁、敵人 id、存檔欄位、Socket.IO event 或 localStorage key；空資料夾需等素材放入後再改名與接程式。

- 範圍：將 9 組敵人外觀框接入 `public/board_cosmetic_frame_demo.html` 供調整，新增敵人 portrait 選項與敵人半身圖路徑輸出；同時新增「顯示普通框」開關，關閉時只隱藏示範用普通戰鬥卡底框 / 內框，保留卡片尺寸，方便檢查較細的自製框。
- 檔案：`public/board_cosmetic_frame_demo.html`、`public/images/board/battle/enemy_frames/**`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：檢查 `public/board_cosmetic_frame_demo.html` 內嵌 script 語法；掃描示範頁 80 個靜態圖片引用；確認 9 組敵人框皆有 `aura.webp`、`frame.webp`、`left_part.webp`、`right_part.webp`，且 9 組敵人 portrait 皆有 `normal` / `angry` / `morale` / `hit` / `weak` / `dizzy`；確認 `http://127.0.0.1:8787/board_cosmetic_frame_demo.html` 回應 200。
- 風險：本次只接入本機示範頁，不改正式戰鬥頁、敵人 id、主遊戲外觀框解鎖、存檔欄位、Socket.IO event 或 localStorage key。

- 範圍：依使用者輸出的 JSON 定稿 9 組敵人外觀框在通用示範頁的預設座標、尺寸、旋轉、翻轉、透明度、強度、層級與混合模式；同時讓每組外觀框可帶自己的 `showBaseFrame` 預設值，路基 / 卡古保留普通底框，其餘敵人框切換時預設隱藏普通底框。
- 檔案：`public/board_cosmetic_frame_demo.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：檢查 `public/board_cosmetic_frame_demo.html` 內嵌 script 語法；確認示範頁 80 個靜態圖片引用存在；確認 `http://127.0.0.1:8787/board_cosmetic_frame_demo.html` 回應 200。
- 風險：本次只更新示範頁預設值與普通底框預設開關，不接正式戰鬥頁、不改敵人 id、主遊戲外觀框解鎖、存檔欄位、Socket.IO event 或 localStorage key。

- 範圍：將 9 組敵人外觀框從示範頁接入正式戰鬥頁與正式戰鬥頁測試入口。`public/js/board_battle.js` 新增敵人框正式設定與 alias，外觀框套用流程改為玩家 / 敵方卡共用，敵人 view 可用 `cosmeticFrameId` / `enemyCosmeticFrameId` 套框；`public/board_battle.html` 讓敵方卡可顯示外框外掛配件，並可依 `showBaseFrame: false` 隱藏普通底框；`public/board_battle_frame_test.html` 新增羅布・路基、卡古、多佛朗明哥、艾尼路、月光莫利亞、戰國、赤犬、黃猿、青雉 9 個正式戰鬥頁測試按鈕，會把框套到右側敵人卡。
- 檔案：`public/js/board_battle.js`、`public/board_battle.html`、`public/board_battle_frame_test.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`；檢查 `public/board_battle_frame_test.html` 與 `public/board_cosmetic_frame_demo.html` 內嵌 script 語法；確認 9 組敵人框素材與 9 組敵人 portrait 檔案存在；靜態確認 9 個敵人框測試入口皆有 `target: "enemy"`，玩家框會清空、敵人物件會寫入 `cosmeticFrameId: fighter.frameId`；確認 `http://127.0.0.1:8787/board_battle_frame_test.html`、`http://127.0.0.1:8787/board_battle.html?frameTest=1` 與 `http://127.0.0.1:8787/js/board_battle.js?v=20260714-enemy-frame-formal-v1` 回應 200。
- 風險：本次只接正式戰鬥頁顯示能力與正式戰鬥頁測試入口，不改主遊戲敵人自動套框、不新增掉落 / 解鎖流程、不改敵人 id、`gameState` 欄位、Socket.IO event 或 localStorage key。

- 範圍：將 9 組敵人外觀框接入主遊戲正式戰鬥流程。`public/js/board_game.js` 依敵人 key / 中文名稱在 `getBattleView()` 與戰鬥視覺 snapshot 暫時帶入 `cosmeticFrameId`，讓羅布・路基、卡古、多佛朗明哥、艾尼路、月光莫利亞、戰國、赤犬、黃猿、青雉進正式戰鬥時自動套用敵方外觀框；`public/board_battle.html` 提高招式 / 道具 / 換人面板、戰鬥文字、狀態提示、屬性按鈕與骰子動畫層級，避免外觀框配件遮住技能敘述或骰到幾點。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`public/board_battle.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、`node --check public/js/board_battle.js`；用靜態腳本確認 `getBattleView()` 與 `getBattleVisualSnapshot()` 都會輸出 `enemyCosmeticFrameIdFor(enemy)`，並確認 9 組敵人 key / 中文名稱對應敵人框；確認 `board_game.html`、`board_battle.html?frameTest=1` 與新版 `/js/board_battle.js?v=20260714-enemy-frames-live-v1` 可回應。
- 風險：本次只在戰鬥 view / visual snapshot 暫時帶入敵人框 id，不寫回 `battle.enemyCombatant`，不新增掉落 / 解鎖流程，不改敵人 id、`gameState` 欄位、Socket.IO event 或 localStorage key。

- 範圍：整理神之騎士團索瑪茲與麒麟格姆兩組敵人外觀框素材，依生成順序統一改名為 `frame.webp`、`left_part.webp`、`right_part.webp`、`aura.webp`；`public/board_cosmetic_frame_demo.html` 新增兩名敵人的 portrait 與四圖層框款，供使用者調整座標、尺寸、透明度、強度、層級、混合模式、角度與翻轉後輸出 JSON。
- 檔案：`public/board_cosmetic_frame_demo.html`、`public/images/board/battle/enemy_frames/enemy_sommers/`、`public/images/board/battle/enemy_frames/enemy_killingham/`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認兩組資料夾皆只包含 `aura.webp`、`frame.webp`、`left_part.webp`、`right_part.webp`；檢查 `public/board_cosmetic_frame_demo.html` 內嵌 script 語法、兩組框設定與素材路徑，並確認示範頁可由本機伺服器回應。
- 風險：本次只整理素材並接入示範頁，尚未接入 `public/js/board_battle.js`、正式戰鬥頁測試入口或主遊戲自動套框；不改敵人 id、掉落 / 解鎖規則、存檔欄位、Socket.IO event 或 localStorage key。

### 2026-07-15

- 範圍：修復正式戰鬥頁操作區被推出畫面的回歸。先前為提高外觀框上方 HUD / 技能 / 操作區層級時，`.hud-panel`、`.info-panel`、`.action-panel` 的 `position: relative` 覆蓋了 `.layout-item` 的絕對定位，導致正式頁操作列落到戰鬥舞台下方；本次恢復三區 `position: absolute` 並保留既有高 z-index。敵方 HUD 的預設 y 座標從負值校回與我方同列，舊版微調草稿若仍存負值也會在載入時校正。正式外觀框測試 snapshot 同步改為 `canAct: true`，可直接檢查攻擊、夥伴、道具、逃跑按鈕。戰鬥頁版本更新為 `20260715-battle-controls-layout-fix-v1` 避免舊快取。
- 檔案：`public/board_battle.html`、`public/board_battle_frame_test.html`、`public/js/board_battle.js`、`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用獨立 Chrome headless 實際載入正式戰鬥頁，修正前量得操作列 `y=706`、戰鬥舞台高度僅 `576px`；修正後確認 HUD、資訊面板與操作列 bounding rect 均落在舞台內，四個操作按鈕顯示且可用，再執行 JS / HTML 語法、HTTP 與 `git diff --check` 檢查。
- 風險：本次只恢復戰鬥 UI 定位、測試 snapshot 行動狀態與快取版本，不改外觀框設定、戰鬥判定、玩家控制權、存檔欄位、localStorage key 或 Socket.IO event。

- 範圍：依使用者輸出的 JSON 定稿索瑪茲與麒麟格姆敵人框座標、尺寸、旋轉、翻轉、透明度、強度、層級與混合模式；同步加入正式 `public/js/board_battle.js` 框設定與 alias、`public/board_battle_frame_test.html` 兩個敵人測試入口，並讓主遊戲依 `god_knight_sommers` / `god_knight_killingham` 或中文名稱在正式戰鬥 view 自動套用框。戰鬥頁與主頁 JS 查詢版本更新為 `20260715-god-knight-frames-v1`。
- 檔案：`public/board_cosmetic_frame_demo.html`、`public/js/board_battle.js`、`public/js/board_game.js`、`public/board_battle_frame_test.html`、`public/board_battle.html`、`public/board_game.html`、`public/images/board/battle/enemy_frames/enemy_sommers/`、`public/images/board/battle/enemy_frames/enemy_killingham/`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`、`node --check public/js/board_game.js`；檢查示範頁與正式戰鬥測試頁內嵌 script 語法；確認 8 張敵人框素材存在；確認正式戰鬥測試頁、正式戰鬥頁、新版戰鬥 JS 與兩組主框素材皆回應 200。
- 風險：本次只增加敵人框顯示、測試入口與戰鬥 view 暫時框 id，不改索瑪茲 / 麒麟格姆戰鬥數值、敵人 id、劇情順序、掉落 / 解鎖規則、`gameState` 欄位、Socket.IO event 或 localStorage key。

- 範圍：修正正式戰鬥頁對話框被底部資訊／操作盤遮住。開戰前角色對話與第二階段敵方對話播放、淡出期間會隱藏左右底部面板；對話完整結束或第二階段對話按下「跳過」後才重新顯示操作盤。沿用戰鬥頁既有對話執行狀態，不新增遊戲快照欄位；主頁與戰鬥頁快取版本更新為 `20260715-battle-dialogue-controls-v1`。
- 檔案：`public/js/board_battle.js`、`public/js/board_game.js`、`public/board_battle.html`、`public/board_game.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_battle.js`、`node --check public/js/board_game.js`；確認固定入口、正式主遊戲頁、正式戰鬥頁與新版戰鬥 JS 回應 HTTP 200。使用獨立 Chrome headless 實際載入正式 `board_battle.html`：桌機 1440×900、平板 1024×768 在開戰對話期間的資訊／操作盤均為 `display: none`，對話淡出後恢復為 `display: grid` 且四個按鈕存在；第二階段對話正常結束與按「跳過」兩條路徑也都由隱藏恢復顯示，瀏覽器執行例外 0。另檢查修改 HTML 的 inline script 語法並執行 `git diff --check`。
- 風險：只改正式戰鬥 iframe 的面板顯示時機與快取版本，不改戰鬥判定、對話文字、玩家控制權、`gameState` / `battleState` 欄位、localStorage key 或 Socket.IO event。

- 範圍：調整指定步數券的正式使用流程。玩家在背包選定 1～6 步並成功消耗道具後，會直接呼叫既有 `rollDice()` 的指定步數分支，建立 `pendingMove`、顯示可選航線／海格並繼續移動，不再要求玩家關閉背包後再按一次「擲骰前進」；指定步數仍不播放隨機骰動畫、不套用一般擲骰船隻加成。主遊戲快取版本更新為 `20260715-fixed-step-auto-move-v1`。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、檢查 `public/board_game.html` inline script 語法，並確認正式入口、主遊戲頁與新版 JS 回應 HTTP 200。以正式 `board_game.html` 在桌機 1440×900、平板 1024×768 實際從背包選擇 4／6 步：擲骰按鈕點擊數皆為 0，`pendingMove` 步數正確、顛倒山 5 條航線與 25 個對應海格立即亮起、道具扣除、骰子動畫未出現且瀏覽器執行例外 0。另以兩個不同 `userId`／`clientId` 視窗加入臨時房間，操作方選擇 3 步後取得 server ACK，觀看方同步收到相同 `lastRoll`、`pendingMove`、5 條航線、25 個海格與道具扣除結果，且觀看方操作按鈕保持停用；最後執行 `git diff --check`。
- 風險：沿用既有 `presetStep`、`pendingMove` 與 `BOARD_GAME_STATE` 推送流程，不新增或改名存檔欄位、localStorage key、Socket.IO event 或道具 id；一般擲骰、CPU 與船隻加成規則不變。

- 範圍：建立開局序章素材收件目錄 `public/images/board/story/opening/`，供使用者放入已完成的 5 張背景、2 張羅傑處刑人物圖與 4 張夥伴職能徽記；本階段只準備素材目錄，尚未改名、搬移或接入正式開局流程。
- 檔案：`public/images/board/story/opening/`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用 `Resolve-Path` 確認序章素材目錄已存在，並檢查 `docs/FILE_MAP.md` 已記錄新目錄職責。
- 風險：目前目錄尚未放入素材，也未修改劇情文字、開局選角、多人同步、`gameState`、localStorage key 或 Socket.IO event；需等使用者放入圖片並確認後才會接正式頁。

- 範圍：將使用者放入的 11 張序章圖正式改名並接到開局選角前流程。全新 `setup-order` 會先用既有全螢幕劇情播放器呈現羅格鎮處刑、羅傑宣言、大航海時代、出發港與四種夥伴職能介紹，結束或跳過後才產生原本的隨機順位並進入三輪蛇形選秀；沒有新增個別角色被動說明。多人啟動順序改為先完成 `BOARD_JOIN_GAME` / 初始快照判斷，再開啟 setup UI；同種子 `setup-order` 同步不打斷觀看方本機序章，正式進入 `setup-draft` 才同步關閉。手動讀檔明確略過序章，主頁 script 版本更新為 `20260715-opening-prologue-v1`。
- 檔案：`public/images/board/story/opening/` 內 11 張正式素材、`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；瀏覽器載入 11 張序章素材皆成功，5 張背景為 1672×941、2 張羅傑人物圖為 1024×1536、4 張職能徽記為 1254×1254。以正式 `board_game.html` 實測桌機 1440×900 與平板 1024×768：羅傑 calm / smile 切換、處刑閃白與「大航海時代——開幕」、四種職能徽記、返回 / 繼續 / 自動 / 速度 / 跳過均可見，結束後開啟「本局選角順序」，平板無水平溢出或多餘文字捲軸，瀏覽器執行例外 0。另以兩個獨立 `userId` / `clientId` 視窗加入臨時房：兩端先取得同一 seed 序章，房主本機跳過不會中斷觀看方，房主按「開始選角」後兩端同步為同一 `setup-draft` / `draftOrder` 並關閉序章；再於序章播放中實際執行手動存檔與讀檔，讀回後不重播序章並正確回到「本局選角順序」。確認正式入口、主頁、新版 JS 與 11 張素材 HTTP 200；`board_game.html` 沒有可執行的 inline script，並執行 `git diff --check`。
- 風險：不新增或改名 `gameState` / `battleState` 欄位、Socket.IO event、角色 / 道具 / 地圖 id 或既有 localStorage key；只新增本機 `sessionStorage` key `onepiece-board-opening-story-session-v1` 記錄同一瀏覽器工作階段看過的 seed。開局多人啟動會等待 join callback，若房間加入失敗則回到本機 setup UI，不會卡在空白地圖。

### 2026-07-16

- 範圍：建立開局全螢幕轉盤選角 UI 的素材收件目錄 `public/images/board/draft_recruitment/`，供使用者放入依序確認完成的 13 張生成圖；本階段只建立目錄，尚未改名、轉檔或接入正式開局選角流程。
- 檔案：`public/images/board/draft_recruitment/`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用 `Resolve-Path` 確認素材收件目錄存在，並確認 `docs/FILE_MAP.md` 已記錄目錄職責。
- 風險：目前目錄尚未放入素材，不改現有擲骰選角、角色資料、被動能力、開局序章、多人同步、`gameState`、localStorage key 或 Socket.IO event；待使用者放圖後才會整理檔名並製作正式頁。

- 範圍：將使用者放入的 13 張圖片統一改為正式英文檔名並接入開局選角。序章後的順位、命運轉盤、三名候選、角色詳情與登船確認改為全螢幕港口招募介面；候選卡顯示角色圖、職能徽記、屬性、代表招式與原始被動，詳情顯示既有數值、完整被動與招式。轉盤的 S～E 六區仍對應既有 1～6 / `T1`～`T6` 招募結果，三輪蛇形選秀、CPU、角色池與候選降階規則不變；觀看方新增 `draft-wheel` Board UI 演出同步，正式狀態仍走完整 `BOARD_GAME_STATE`。
- 檔案：`public/images/board/draft_recruitment/` 內 13 張正式素材、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；以正式 `board_game.html` 在桌機 1440×900 跑完單人三輪順位、轉盤、候選、詳情、登船至 `phase=main`，並在平板 1024×768 實際檢查順位、轉盤、候選角色圖與詳情，兩種尺寸皆無頁面水平溢出且瀏覽器執行例外 0。另以兩個獨立 `userId` / `clientId` 視窗從正式 `board_start.html` 建房、加入與開始：操作方轉到 T6 後，觀看方同步播放轉盤、收到相同 `recruitRolls` 與三張候選、確認按鈕 disabled；選中 `corazon` 後兩端 `draftPickIndex` 與船員資料一致，例外 0。最後確認 13 張素材路徑與正式頁 HTTP 200、HTML inline script、JS 語法及 `git diff --check`。
- 風險：視覺與 Board UI 演出有調整，但不改角色 / 職能 / 被動文字、招募階級機率、CPU 規則、角色 id、`gameState` / `battleState` 欄位、localStorage key 或 Socket.IO event；底層繼續保存原本 `recruitRolls` 物件，舊存檔相容。平板使用響應式縮排，極窄手機仍需避免長被動文字造成詳情區過度捲動。

- 範圍：修正正式轉盤選角的已選角色框與捲軸排版。`draft_crew_slots_frame.webp` 原始畫布上下含透明留白，現在由 CSS 依素材實際可見邊界裁切放大，船員窗口重新定位，角色圖在窗口內放大並裁切，不再掉到框體下方。候選名單依角色數動態計算桌機最多 6 欄、窄畫面最多 4 欄及所需列數，卡片自動縮放至同一頁；角色詳情改為使用目前 viewport 可容納的加大視窗，移除重複資訊並取消候選 / 被動區內部捲軸。主遊戲快取版本更新為 `20260716-draft-wheel-fit-v2`。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；以正式 `board_game.html` 在桌機 1440×900 完成三輪選角，實際確認第一名角色加入後完整位於放大的船員窗口內，9 名候選同頁顯示且候選 grid 的 `scrollHeight <= clientHeight`，加大詳情視窗為 1140×760、被動／招式內容完整容納，頁面水平溢出 0、瀏覽器例外 0。平板 1024×768 實測順位、船員框、轉盤、5 名候選與詳情視窗，候選和詳情均無可見捲軸、所有按鈕位於 viewport 內、水平／垂直頁面溢出 0、瀏覽器例外 0；最後確認正式入口、主頁、新版 JS HTTP 200 並執行 `git diff --check`。
- 風險：僅調整正式選角頁 CSS 與候選 / 詳情顯示 markup，不改角色圖路徑、角色／職能／被動文字、招募機率、蛇形順位、CPU、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`；極端長被動會使用較小的既有響應式字級直接排入詳情區，不以捲軸呈現。

- 範圍：使用內建圖片生成流程製作「船長指令盤」改版來源素材。先定稿 1536×1024 主外框，再以其木材、古銅金、繩索、羅盤、深海藍與青綠海浪風格連續生成 1254×1254 共用主要按鈕框，以及擲骰／前進、背包、船員、技能、任務、船團、船隻資訊 7 個圖示；所有圖片不含 UI 功能文字並保留乾淨白底，供使用者後續自行去背。
- 檔案：`public/images/board/ship_command/source/` 內 9 張 PNG、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：逐張人工檢查主體、用途辨識度、相同材質／配色、邊緣是否裁切與 UI 留白；再以 Pillow 讀取 9 張來源，確認主外框為 1536×1024、其餘 8 張為 1254×1254、全部可正常解碼，四角皆接近純白。以白底差異 bbox 檢查所有圖均保有正邊界，圖示四邊至少保留 38px，主外框／按鈕框雖接近畫布邊緣但沒有裁切；確認來源目錄共 9 個預期檔名。
- 風險：目前是未去背的生成來源圖，只供後續視覺定稿，不接入正式 `ship-action-menu`；不修改正式頁、擲骰、技能學習、背包、任務、船員、船團、船隻資訊、CPU 控制、多人體驗、`gameState`、localStorage key 或 Socket.IO event。主外框與按鈕框邊界留白較窄，使用者去背時需避免裁掉外框金屬邊緣。

- 範圍：將使用者放入的 9 張去背船長指令盤 WebP 改為固定正式檔名並歸位到 `public/images/board/ship_command/` 根層，未去背 PNG 保留在 `source/`。正式地圖船隻操作選單改為圖片式海賊指令盤：中央顯示玩家目前船型，擲骰／續戰或特殊區域前進、背包、船員為三個主要入口，技能、任務、船團、船隻資訊位於底部；沒有可學技能時顯示停用狀態。CPU 指令盤保留回合速度、個性與三個資訊入口。指令盤會依地圖 viewport 自動改放船隻上／下方並水平收進畫面，主遊戲快取版本更新為 `20260716-ship-command-ui-v1`。
- 檔案：`public/images/board/ship_command/` 內 9 張正式 WebP、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認固定入口、正式主遊戲頁、新版 JS 與 9 張正式素材皆回應 HTTP 200。使用獨立 Chrome headless 從正式 `board_game.html` 完成三輪選角至主地圖後點擊目前船隻：桌機 1440×900 與平板 1024×768 的指令盤皆完整位於地圖 viewport，頁面水平溢出 0；確認玩家目前船圖與全部指令盤素材載入成功、7 個原功能 action 存在、背包按鈕可開啟正式背包，瀏覽器執行例外 0。另執行 HTML inline script、素材透明通道與 `git diff --check` 檢查。
- 風險：本次只改正式地圖船隻操作選單外觀、素材與 viewport 擺位；所有 action 繼續呼叫原本函式，不改擲骰、續戰、推進城／海軍本部前進、技能、任務、船員、船團、船隻或 CPU 規則，不新增或改名 `gameState` 欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 流程。去背素材外緣仍有少量低透明像素，但不影響目前正式畫面。

- 範圍：修復跨房號雲端讀檔被新房號開局自動存檔取代的問題。正式「讀伺服器備份」改為固定讀取既有 `RECOVERED` 雲端槽，因此從任何房號都會看到同一份五檔尼卡紀錄；玩家主動按「存檔」時會同時更新目前房號與 `RECOVERED`，選角結束的靜默自動存檔仍只寫目前房號，不再污染跨房號雲端槽。「刪除全部存檔」則會清除目前房號與 `RECOVERED`。主遊戲快取版本更新為 `20260716-global-cloud-save-v1`。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認 `RECOVERED` API 回傳 HTTP 200、第 275 回合、4 名玩家且內容含 `luffy_gear_fifth`；確認正式主遊戲頁與 `board_game.js?v=20260716-global-cloud-save-v1` 回應 HTTP 200，並靜態確認正式讀檔固定使用 `GLOBAL_BOARD_SAVE_ROOM_CODE`、主動存檔才傳入 `updateGlobal: true`。最後執行 HTML inline script 與 `git diff --check`。
- 風險：不刪除或覆寫現有房號 JSON；既有 `RECOVERED.json` 的五檔尼卡第 275 回合內容原樣保留。不新增 `gameState` / `battleState` 欄位、localStorage key 或 Socket.IO event。日後玩家主動按「刪除全部存檔」會依畫面文字同時刪除跨房號雲端槽，需再次確認後再操作。

- 範圍：建立背包第二層 UI 素材收件目錄，將逐張生成並人工確認完成的背包大型主框、分類標籤框、道具格框與使用／確認按鈕框 4 張白底 PNG 複製進專案並改為固定來源檔名，供使用者去背後放回；此階段尚未替換正式背包介面。
- 檔案：`public/images/board/backpack_ui/source/` 內 4 張 PNG、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認 4 張來源圖皆存在且非 0 bytes，檔名分別為 `backpack_panel_frame.png`、`backpack_category_tab_frame.png`、`backpack_item_slot_frame.png`、`backpack_primary_button_frame.png`；逐張檢查主體完整、白底、無文字、無裁切且與正式船長指令盤材質一致，並執行 `git diff --check`。
- 風險：目前只新增白底生成來源與文件，不修改正式 `openBackpackModal()`、道具分類、使用條件、指定步數、船員選擇、存檔、`gameState`、localStorage key 或 Socket.IO event；去背完成前正式頁不得引用這 4 張來源 PNG。

- 範圍：將使用者放入的 4 張去背背包 UI WebP 改為固定正式檔名並歸位到 `public/images/board/backpack_ui/` 根層，白底 PNG 保留在 `source/`。正式 `openBackpackModal()` 改為同船長指令盤風格的「航海背包」大型第二層介面：5 種分類同時顯示，左側顯示背包開合動畫、選中道具圖、名稱、品質、說明與原操作按鈕，右側改成每頁最多 8 格的 2×4 道具分頁，底部提供上一頁、返回指令盤與下一頁；返回時會重新開啟目前船隻的船長指令盤。主遊戲快取版本更新為 `20260716-backpack-ui-v1`。
- 檔案：`public/images/board/backpack_ui/` 內 4 張正式 WebP、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js` 與 `public/board_game.html` inline script 檢查；確認正式入口、主遊戲頁、新版 JS 與 4 張正式素材回應 HTTP 200。使用獨立 Chrome headless 從正式頁讀取第 275 回合五檔尼卡 `RECOVERED` 雲端紀錄，實際由船長指令盤點進背包：桌機 1440×900 顯示 5 分類、重要道具 8 格與 `1 / 2` 分頁，下一頁切換為 `2 / 2`；平板 1024×768 顯示航海道具 8 格、指定步數券「使用」按鈕與完整框體。兩種尺寸的 modal 均位於 viewport、道具 grid 無內部溢出、頁面水平溢出 0；實際點擊指定步數券可開啟 6 個步數按鈕，取消後返回新版背包，背包底部亦可返回新版船長指令盤，瀏覽器例外 0。最後檢查正式 WebP RGBA 透明通道並執行 `git diff --check`。
- 風險：本次只改正式背包主介面的素材、排版、分頁與返回導覽；道具分類 id、數量、使用 action、指定步數自動移動、船員目標選擇、獎勵與解鎖條件皆沿用原邏輯。不新增或改名 `gameState` / `battleState` 欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 流程；指定步數／船員目標等下一層確認視窗仍保留既有外觀，後續依使用者指定再逐一改版。

### 2026-07-17

- 範圍：依使用者要求移除正式航海背包左側的翻開背包圖與開啟動畫顯示，選中道具圖改為單獨置中並放大；背包分類、分頁、道具說明、使用按鈕與返回船長指令盤流程不變。主遊戲快取版本更新為 `20260717-backpack-preview-clean-v1`。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js` 與 `public/board_game.html` inline script 檢查；確認正式背包 markup 已無 `.backpack-bag-art`，選中道具框改為單欄置中排版，並執行正式頁 HTTP 與 `git diff --check`。
- 風險：只移除背包圖的視覺元素並調整道具預覽尺寸；`backpack_open_ui.webp` / `backpack_closed_ui.webp` 素材與舊 CSS 保留備用，不改任何道具數量、使用 action、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。

- 範圍：重新校正正式航海背包分類、道具與底部按鈕的格線對齊。分類標籤與道具格不再常駐疊加第二層完整金框，只在目前分類、選中道具或滑過時顯示半透明發光，避免與主框既有格線形成雙框；右側移除佔用第一列高度的分類標題列，2×4 道具內容依主框實際內距與列距貼齊八格；底部按鈕改用主框原始窄／寬／窄比例，「返回指令盤」移到中央寬格左半部，避開羅盤。
- 檔案：`public/board_game.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用正式 `RECOVERED` 雲端紀錄從船長指令盤開啟背包，桌機 1440×900 與平板 1024×768 實際檢查 5 個分類、8 個道具格與三個底部按鈕；兩種尺寸的 grid 均無溢出，重要道具可切換 `1 / 2`、指定步數可開啟 6 個步數按鈕並取消返回，瀏覽器例外 0。另執行 HTML inline script 與 `git diff --check`。
- 風險：純 CSS 對齊與選中視覺調整，不改背包 markup、素材檔、分類／道具 id、使用 action、分頁資料、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。

- 範圍：依使用者要求將正式航海背包右側道具區由 2×4 分頁改回單欄橫條式清單。右側以深海藍內容底遮住主框原本八格內線，每個道具使用完整橫向道具框顯示圖片、名稱、分類與數量，所有道具一次寫入 DOM 並以金色垂直捲軸上下瀏覽；移除上一頁、下一頁與頁碼，只保留返回指令盤。主遊戲快取版本更新為 `20260717-backpack-scroll-list-v1`。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js` 與 HTML inline script 檢查；使用正式 `RECOVERED` 雲端紀錄實際開啟背包，桌機 1440×900 的重要道具分類一次建立 14 條橫列、可由 `scrollTop 0` 捲到最大 `915`，平板 1024×768 的航海道具建立 8 條橫列且可垂直捲動，兩種尺寸皆無水平溢出、modal 完整位於 viewport。指定步數可開啟 6 個步數按鈕並取消返回，返回指令盤正常，瀏覽器例外 0；最後執行 `git diff --check`。
- 風險：本次只改背包道具清單呈現與瀏覽方式；分類／道具 id、排序、數量、選中道具預覽、使用 action、指定步數與其他道具規則不變，不新增或改名 `gameState` / `battleState` 欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。

- 範圍：修正正式航海背包橫條道具選項看起來像兩張框拼接的問題。確認原 `backpack_item_slot_frame.webp` 素材本身包含左小框與右長框後，改由既有的單一長框 `backpack_category_tab_frame.webp` 直接以 `object-fit: fill` 拉伸覆蓋每一列；道具圖示、名稱、品質與數量繼續疊在同一個完整底框上。主遊戲快取版本更新為 `20260717-backpack-single-row-frame-v1`。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、HTML inline script 語法、正式頁與新版 JS HTTP 200、桌機 1440×900／平板 1024×768 正式背包畫面、道具清單垂直捲動與 `git diff --check`。
- 風險：只替換道具橫列的底框視覺來源與快取版本，不刪除舊素材，不改道具 id、數量、排序、分類、使用 action、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。

- 範圍：建立船員介面改版素材收件資料夾 `public/images/board/crew_ui/incoming/`，供使用者放入已去背的船員名冊主框、單一船員橫條、船長徽章、角色詳情主框與資訊框；目前不改正式頁、角色資料或船員操作流程。
- 檔案：新增目錄 `public/images/board/crew_ui/incoming/`；更新 `docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認資料夾已建立且位於 `public/images/board/crew_ui/incoming/`。
- 風險：收件資料夾尚不被 `board_game.html` 或 `board_game.js` 引用，不改角色 id、頭像路徑、船員數值、攜帶物、`gameState`、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。

- 範圍：將使用者完成去背的 5 張船員 UI WebP 由收件資料夾固定命名並歸檔至 `public/images/board/crew_ui/` 根層。正式 `openCrewManagementModal()` 改為海賊風格「船員名冊」：名冊主框、可捲動的單一船員橫條、目前船長徽章與原有展開操作；正式 `openCharacterDetail()` 改為角色詳情主框，角色圖置於左側透明挖空窗下層，右側以兩個資訊框呈現數值與招式／被動，並保留原有進化、修行、攜帶物、外觀框與關閉按鈕。主遊戲快取版本更新為 `20260717-crew-ui-v1`。
- 檔案：`public/images/board/crew_ui/crew_roster_panel_frame.webp`、`crew_member_row_frame.webp`、`crew_captain_emblem.webp`、`crew_detail_panel_frame.webp`、`crew_info_section_frame.webp`、`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：逐張檢查 5 張正式 WebP 的去背、外框與角色挖空窗；執行 `node --check public/js/board_game.js` 與 HTML inline script 檢查。使用正式 `RECOVERED` 雲端紀錄在 Chrome 實際由船長指令盤開啟「查看船員」：桌機 1440×900 名冊顯示 1～4 名以上船員的橫條、捲軸與展開按鈕；點擊詳情成功開啟新版角色詳情。平板 1024×768 的詳情 modal 為 983×655、未超出 viewport 或產生水平捲動，角色圖、兩個資訊框、修行／攜帶物／卸下／外觀框按鈕皆可見。確認所有 5 張正式素材可載入；最後執行正式頁 HTTP、素材 HTTP 與 `git diff --check`。
- 風險：只改正式船員名冊／角色詳情的 HTML、CSS 與素材引用；角色 id、頭像來源 fallback、隊伍人數、HP／EXP／數值計算、進化條件、攜帶物裝卸、船長切換、CPU、`gameState` / `battleState` 欄位、localStorage key、Socket.IO event、`BOARD_GAME_STATE` 推送與套用均沿用既有流程。角色詳情左側顯示既有角色圖片來源，若個別角色原圖本身含背景，仍會連同原圖背景一起顯示在挖空窗內。

- 範圍：修正新版船員名冊展開操作與頭像定位。`hidden` 操作列改為只在目前點選的船員顯示，並在展開後以明確金框操作列呈現「詳情／更換或裝備攜帶物／卸下攜帶物／設為船長」；頭像改為相對橫條素材圓框的固定定位，姓名與 HP／EXP 欄改保留在右側資訊區，不再壓到頭像。
- 檔案：`public/board_game.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用正式雲端紀錄在 Chrome 桌機 1440×900 實際展開第一名船員，未展開時可見操作列數為 0，展開後為 1，四個操作按鈕皆存在且可見；平板 1024×768 的名冊 modal 為 983×655、展開橫條為 715×163、操作列為 454×38，頁面水平溢出為 0。另執行 HTML inline script 與 `git diff --check`。
- 風險：僅調整船員名冊的 CSS 排版與可見狀態，不改任何按鈕 handler、船員 id、角色資料、攜帶物、船長切換、同步、`gameState`、localStorage key 或 Socket.IO event。

### 2026-07-17

- 範圍：修正正式船員名冊橫條框的比例與互動流程。名冊改為兩欄等比例 2:1 的角色橫條，直接對應 `crew_member_row_frame.webp` 的原始 1774×887 畫布；圓形角色窗也改以素材實際挖空的位置與直徑定位，避免把圓框壓成橢圓或讓角色圖蓋住資訊欄。點擊名冊角色現在直接開啟角色詳情，不再展開名冊內的操作列；「設為船長」、裝備／更換／卸下攜帶物都集中於詳情，詳情可返回名冊，攜帶物與外觀框的返回也會保留這條路徑。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js` 與 HTML inline script 檢查；正式 `board_game.html`、新版 `board_game.js?v=20260717-crew-direct-detail-v1` HTTP 200。以正式 `RECOVERED` 雲端紀錄實測桌機 1440×900 與平板 1024×768：名冊橫條分別為 458×229、351×175，皆維持約 2:1；頭像窗 85×85、65×65，皆為 1:1；橫條素材使用 `object-fit: cover`，沒有名冊操作列。點第一名船員可直接開啟詳情，詳情同時可見「設為船長」與「更換攜帶物」，按返回名冊可回到名冊；兩種尺寸的頁面水平溢出皆為 0、瀏覽器例外 0。最後執行 `git diff --check`。
- 風險：只調整正式船員 UI 的格線、素材定位與既有按鈕入口；不更動角色 id、角色數值、攜帶物資料、船長資料欄位、CPU、多人控制權、`BOARD_GAME_STATE`、localStorage key 或 Socket.IO event。船員超過四名時仍使用名冊既有垂直捲動以顯示後續兩欄列。

#### 2026-07-17 — 船員視窗安全尺寸與詳情對位

- 範圍：將正式船員名冊主框限制為最大 1080px／86vw／120vh，船員詳情再獨立縮至最大 980px／80vw／108vh，避免兩個圖片式 modal 佔滿或超出畫面。依 `crew_detail_panel_frame.webp` 的實際挖空重新校正左側角色窗、右側兩個資訊框、底部功能列與返回按鈕；角色圖保持比例並以底部為基準放大 1.16 倍，改善不同角色圖縮在挖空窗下半部的問題。資訊文字提高最小字級，保留框內捲動；功能按鈕集中在底部木板框，返回按鈕改為同尺寸可見按鈕。主頁快取版本更新為 `20260717-crew-layout-fit-v2`。
- 檔案：`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js` 與 HTML inline script 檢查；以正式 `RECOVERED` 雲端紀錄實際檢查桌機 1440×900 與平板 1024×768。桌機名冊為 1080×720、詳情為 972×648；平板名冊為 881×587、詳情為 819×546，四個視窗均完整位於 viewport。角色窗、兩個資訊框、修行／船長／攜帶物／外觀框與返回按鈕全部有可見尺寸且落在素材框內，頁面水平／垂直溢出皆為 0、瀏覽器例外 0。正式主頁與新版 JS HTTP 200，最後執行 `git diff --check`。
- 風險：只改正式船員 modal 的 CSS 尺寸、圖層縮放、文字與按鈕位置，不改角色圖來源、角色 id、船員數值、船長切換、攜帶物規則、`gameState`、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 同步流程。極長數值或招式內容仍在各自資訊框內垂直捲動，不會撐大整個詳情視窗。

#### 2026-07-17 — 詳情角色圖上移與說明木板底

- 範圍：依使用者正式頁截圖修正船員詳情左側角色窗。保留角色圖 1.16 倍等比例縮放與底部基準，再將圖片相對窗口向上移 14%，讓五檔尼卡等角色的圖像頂端貼到挖空窗頂，不再保留大段空白。角色圖下方的目前形態／進化說明改成近乎不透明的深色木板漸層，增加金色邊框、內框與陰影，左右及底部直接貼齊角色框，不再留下藍色空隙。主頁快取版本更新為 `20260717-crew-portrait-edge-v4`。
- 檔案：`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js` 與 HTML inline script 檢查；使用正式 `RECOVERED` 雲端紀錄開啟五檔尼卡與鷹眼詳情，桌機 1440×900 實際確認五檔雲霧貼到窗口頂、鷹眼帽子沒有被裁掉、說明木板底與金邊可見，木板底部與角色窗底部間距為 0。詳情 modal 完整位於 viewport，頁面水平／垂直溢出為 0、瀏覽器例外 0；正式主頁與新版 JS HTTP 200，最後執行 `git diff --check`。
- 風險：只改船員詳情角色圖的視覺位移與說明區底色，不改角色圖片檔案、角色資料、進化文字、船員數值、遊戲狀態、存檔或多人同步流程；角色圖仍由窗口裁切，因此不會壓到右側資訊或底部操作列。

#### 2026-07-17 — 船員透明矩形與角色窗縫隙修正

- 範圍：移除正式船員名冊與船員詳情透明 modal 本體的矩形陰影及毛玻璃，陰影改套在實際透明主框圖片上，讓投影沿素材輪廓顯示，不再於模糊地圖上形成半透明方框。詳情左側角色窗略向左擴寬，讓角色圖片伸入金框下層，消除角色圖與左側框線間的可見縫隙。主頁快取版本更新為 `20260717-crew-transparent-gap-v5`。
- 檔案：`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用正式 `RECOVERED` 雲端紀錄從船員名冊進入鷹眼詳情，桌機 1440×900 實際確認名冊與詳情 modal 的計算樣式均為透明背景、無矩形 `box-shadow`、無 `backdrop-filter`，主框圖片以透明輪廓投影；角色圖左右邊界均延伸至角色窗口框線下方，左側不再露縫。詳情完整位於 viewport，頁面水平／垂直溢出為 0、瀏覽器例外 0；另檢查平板 1024×768 排版、正式主頁與新版 JS HTTP 200、JS／HTML inline script 語法及 `git diff --check`。
- 風險：只改船員圖片式 modal 的背景投影、角色窗寬度與快取版本，不改角色圖來源、名冊／詳情操作、船員數值、船長或攜帶物規則、`gameState`、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。

#### 2026-07-17 — 船員詳情角色圖放大與框後遮邊

- 範圍：放大正式船員詳情左側角色圖，角色舞台由原本 23.1%×61.5% 擴為 25.5%×65.5%，並向四周延伸到不透明金色外框下層；角色圖保持比例放大至 1.2 倍，讓外框在上層自然遮住圖片邊緣，避免角色放大後被窗口邊界硬切。主頁快取版本更新為 `20260717-crew-portrait-large-v6`。
- 檔案：`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：以正式 `RECOVERED` 雲端紀錄實際開啟五檔尼卡與鷹眼詳情，檢查寬帽、雲霧與角色身體在金框內的尺寸及遮邊；另檢查桌機 1440×900、平板 1024×768、正式頁 HTTP 200、JS／HTML inline script 語法與 `git diff --check`。
- 風險：只調整角色圖片舞台及等比例縮放，不改圖片檔、角色 id、數值、詳情操作、進化、船長、攜帶物、存檔或多人同步流程；金色主框仍維持較高圖層，不會被放大的角色圖覆蓋。

### 2026-07-18

#### 船員名冊／詳情整體主框放大與角色圖還原

- 範圍：依使用者澄清，完整還原前一版角色圖的窗口位置、大小、上移量與 1.16 倍縮放；改為放大船員名冊與船員詳情的整體圖片式 modal。名冊由最大 1080px／86vw／120vh 放大為 1260px／94vw／138vh，詳情由最大 980px／80vw／108vh 放大為 1160px／92vw／132vh，小於 900px 寬度時也提高可用比例，同時以 `vw`、`vh` 共同限制，避免桌機或平板被 viewport 邊緣裁切。主頁快取版本更新為 `20260718-crew-modal-large-v7`。
- 檔案：`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用正式 `RECOVERED` 雲端紀錄實際開啟船員名冊與五檔尼卡／鷹眼詳情，檢查桌機 1440×900、平板 1024×768 的主框尺寸、viewport 邊界、角色圖還原、按鈕與資訊框位置；另執行正式頁 HTTP 200、JS／HTML inline script 語法與 `git diff --check`。
- 風險：只改名冊／詳情 modal 的整體尺寸並撤回誤改的角色圖放大，不改角色圖片檔、船員 id、數值、進化、船長、攜帶物、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。

#### 修行詳情 UI 素材收件資料夾

- 範圍：確認修行詳情大型主框、修行數值橫條框與材料規則羊皮紙框共 3 張生成圖的比例及版位符合正式介面需求，建立 `public/images/board/training_ui/incoming/` 供使用者放入去背完成的素材；此階段尚未接入正式修行詳情。
- 檔案：`public/images/board/training_ui/incoming/.gitkeep`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認收件資料夾存在，且正式 `board_game.html`／`board_game.js` 尚未引用其中檔案；執行 `git diff --check`。
- 風險：本次只新增素材收件資料夾與文件，不修改 `openTrainingDetailModal()`、修行點數、能力換算、材料規則、角色資料、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`；去背素材完成檢查及固定命名前不得接入正式頁。

#### 修行詳情圖片式 UI 正式接入

- 範圍：檢查使用者放入的 3 張去背 WebP 皆具 RGBA 透明通道後，由收件資料夾固定命名並歸檔為 `training_detail_panel_frame.webp`、`training_stat_row_frame.webp`、`training_material_rules_frame.webp`。正式 `openTrainingDetailModal()` 改為 3:2 海賊木框介面：左側沿用角色圖，中央以六條素材列顯示生命／攻擊／防禦／戰術／意志／速度的修行點數、修行與記憶來源、進度及實際加成，右側羊皮紙框搭配既有道具圖整理五組材料規則，內容超出時可框內捲動；底部保留完整換算規則、返回船員與關閉。從名冊進入詳情再進修行時會保留返回來源，返回詳情後仍可回名冊。主頁快取版本更新為 `20260718-training-ui-v1`。
- 檔案：`public/images/board/training_ui/training_detail_panel_frame.webp`、`public/images/board/training_ui/training_stat_row_frame.webp`、`public/images/board/training_ui/training_material_rules_frame.webp`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認三張正式素材尺寸分別為 1536×1024、2400×360、1024×1536，模式皆為 RGBA 且 alpha 範圍為 0～255；執行 `node --check public/js/board_game.js` 與 HTML inline script 檢查。使用正式 `RECOVERED` 雲端紀錄由船員名冊點五檔尼卡，依序進入船員詳情與修行詳情：桌機 1440×900 的 modal 為 1240×827、四周至少保留 37px；平板 1024×768 為 963×642、四周至少保留 31px。兩種尺寸皆顯示 6 條修行列、5 組材料規則、三張正式素材與兩個底部按鈕，所有正式素材自然尺寸正確、頁面水平／垂直溢出為 0、瀏覽器例外 0；返回船員可回五檔詳情，再返回名冊。另確認正式頁、新版 JS 與三張素材 HTTP 200，最後執行 `git diff --check`。
- 風險：本次只改修行詳情的正式 UI、素材引用與返回來源傳遞；`TRAINING_STATS`、每項修行上限、生命／五維／速度換算、材料效果、角色 id、角色數值、存檔欄位、localStorage key、Socket.IO event 與 `BOARD_GAME_STATE` 均未變更。右側材料規則使用代表性既有道具圖，不新增道具資料或素材 id。

#### 修行詳情角色圖頂對齊與標題分區

- 範圍：依使用者要求調整正式修行詳情的文字層級與角色窗。上方大型標題牌只保留角色名字，移除名字後方的「修行詳情」與第二行等級／類型／總加成；角色圖改以窗口頂邊為縮放基準向下呈現，左側窗口底部新增不透明深色木板標籤顯示「修行詳情」。主頁快取版本更新為 `20260718-training-title-layout-v2`。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用正式 `RECOVERED` 雲端紀錄實際檢查五檔尼卡與鷹眼的修行詳情，確認角色圖頂端貼齊窗口、寬帽與雲霧未被金框硬切、上方標題只有名字、左側底部木板顯示「修行詳情」；另檢查桌機 1440×900、平板 1024×768、返回流程、正式頁 HTTP 200、JS／HTML inline script 語法與 `git diff --check`。
- 風險：只調整修行詳情角色圖片的對齊基準與標題文字位置，不改角色圖檔、修行數值、材料規則、角色資料、存檔或多人同步流程。

#### 修行詳情六角修行圖

- 範圍：將正式修行詳情左側角色圖下方的木板空位改為即時六角雷達圖，六個角依序顯示生命、攻擊、防禦、戰術、意志、速度目前修行點數，圖形以各項 30 點上限換算比例；上方大型標題牌仍只顯示角色名字。主頁快取版本更新為 `20260718-training-radar-v3`。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：以正式 `RECOVERED` 雲端紀錄檢查五檔尼卡與鷹眼，確認角色圖頂對齊、六角圖六個標籤／數值與中央六條修行資料一致；檢查桌機 1440×900、平板 1024×768、正式頁 HTTP 200、JS／HTML inline script 語法與 `git diff --check`。
- 風險：六角圖只讀取既有角色 `training` 六項數值並在前端繪製，不新增或改名存檔欄位，不改每項上限、能力換算、角色資料、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。

#### 六角修行圖類型與數值完整顯示

- 範圍：移除正式修行詳情左下六角圖上方的「修行詳情」重複標題，將木板區全部高度提供給圖表，增加圖表上下安全距離，讓生命、攻擊、防禦、戰術、意志、速度六個完整類型名稱及各自點數保持可見。主頁快取版本更新為 `20260718-training-radar-labels-v4`。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用正式 `RECOVERED` 雲端紀錄檢查五檔尼卡與鷹眼，確認六角圖沒有「修行詳情」標題、六個類型與數值完整顯示；另檢查桌機 1440×900、平板 1024×768、正式頁 HTTP 200、JS／HTML inline script 語法與 `git diff --check`。
- 風險：只調整六角圖的可用高度與標題呈現，不改六項修行數值、上限、能力換算、角色資料、存檔或多人同步流程。

#### 六角圖加高與戰術標籤避讓

- 範圍：修正正式修行詳情六角圖最下方「戰術」被底部金色裝飾遮擋。左下木板區由角色窗高度 30% 加高為 35%，六角圖的中心、半徑與標籤半徑同步上移，並增加底部安全距離；上方角色圖縮放由 1.16 倍調回 1.1 倍，維持頂對齊並減少角色邊緣裁切。主頁快取版本更新為 `20260718-training-radar-clear-v5`。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用正式 `RECOVERED` 雲端紀錄檢查五檔尼卡與鷹眼，確認「戰術」及數值完整位於金色裝飾上方，六個標籤皆可見，角色圖頂端與身體呈現未被異常放大；另檢查桌機 1440×900、平板 1024×768、正式頁 HTTP 200、JS／HTML inline script 語法與 `git diff --check`。
- 風險：只調整左側角色圖縮放及六角圖的視覺分區，不改修行點數、能力換算、角色圖檔、角色資料、存檔或多人同步流程。

#### 修行材料標題對位與詳情內直接使用

- 範圍：正式修行詳情右側羊皮紙標題由「材料規則」改為「修行材料」，並由框頂 4.8% 下移至 7.2%，使文字落在素材標題框中央。內容改列出玩家實際持有的修行鳥羽、藍波飲、四階修行材料、招式修行卷及戰鬥記憶貝與數量；點擊材料直接對目前詳情角色使用，數量大於一時沿用既有數量選擇，使用成功或取消後返回同一角色修行詳情，不能使用則顯示滿值／無招式／記憶已滿原因。主頁快取版本更新為 `20260718-training-material-use-v6`。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用正式 `RECOVERED` 雲端紀錄檢查桌機 1440×900、平板 1024×768 的「修行材料」標題框位、持有數量、停用原因與捲動；另以不寫回存檔的隔離頁面狀態，將五檔尼卡生命修行設為 0、生命鳥羽設為 2，點擊後成功進入目前角色的既有數量流程，取消可回修行詳情；再次確定使用 1 個後，持有數由 2 變 1、生命修行由 0 變 1，並返回同一修行詳情。執行正式頁／新版 JS HTTP 200、JS／HTML inline script 語法與 `git diff --check`。
- 風險：新增的是修行詳情內的既有材料使用入口；材料 id、效果、上限、消耗、能力換算、任務紀錄、道具使用事件、`gameState` 欄位、localStorage key、Socket.IO event 與 `BOARD_GAME_STATE` 同步流程不變。觀看方沒有目前玩家控制權時材料按鈕會停用。

#### 修行材料清單限制於羊皮紙格

- 範圍：修正正式修行詳情右側材料清單向下超過羊皮紙色內容格、壓到指南針與封蠟裝飾的問題。捲動區左／右／底界依素材紙張內緣重新內縮，底界由面板 8.5% 提高為 15%，並增加底部內距；材料超出可視高度時仍使用既有垂直捲軸，但只在羊皮紙範圍內顯示。主頁快取版本更新為 `20260718-training-material-paper-fit-v7`。
- 檔案：`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用正式 `RECOVERED` 雲端紀錄檢查桌機 1440×900、平板 1024×768，確認第一項與最後可見材料、文字、圖示及捲軸皆位於羊皮紙色內容格內；平板清單可由 `scrollTop 0` 捲至最大 `203`，最後一項戰鬥記憶貝完整顯示且與捲動區底部保留 8px，沒有壓到指南針、封蠟或外框。另執行正式頁／新版 JS HTTP 200、HTML inline script 語法與 `git diff --check`。
- 風險：只縮小修行材料清單的可視與捲動範圍，不改材料內容、排序、持有數量、點擊 handler、消耗、修行效果、存檔或多人同步流程。

#### 修行材料完整列與左界內縮

- 範圍：依使用者判定「半列也算超框」，將正式修行材料捲動區固定為每頁完整 5 列，列高由羊皮紙可用高度等分，使用整列捲動吸附，初始與捲到底都不露出半列。使用者澄清超出的是左側後，左界由面板 10% 內縮至 18%，右界維持 12%，使材料圖示、文字與捲軸全部留在羊皮紙色格子內。主頁快取版本更新為 `20260718-training-material-full-rows-v8`。
- 檔案：`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用正式 `RECOVERED` 雲端紀錄檢查桌機 1440×900、平板 1024×768，確認初始畫面只顯示 5 個完整材料列；平板捲動區由 `scrollTop 0` 捲至最大 `225` 時，最後 5 列完整顯示、最後一列仍完全位於捲動區內，最左圖示避開羊皮紙卷邊，右側文字與捲軸未超過羊皮紙內緣。另執行正式頁／新版 JS HTTP 200、HTML inline script 語法與 `git diff --check`。
- 風險：只調整材料清單列高、捲動吸附與水平內縮，不改材料 id、名稱、數量、停用原因、點擊使用、消耗、修行效果、存檔或多人同步流程。

#### 修行六角圖總數據／修行數據切換

- 範圍：正式修行詳情左下六角雷達圖改為預設顯示角色目前生命、攻擊、防禦、戰術、意志、速度總能力值；點擊圖面切換為六項修行點數，再點一次切回總能力。圖中央顯示目前模式，滑鼠、觸控與鍵盤皆使用同一按鈕入口；主頁快取版本更新為 `20260718-training-radar-toggle-v9`。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：以隔離正式流程完成三名角色選擇後進入修行詳情，桌機 1440×900 與平板 1024×768 都預設顯示總數據（測試角色為生命 132、攻擊 98、防禦 94、戰術 102、意志 108、速度 107）；點擊後完整切換為測試修行數據 6／9／12／15／18／21，再次點擊返回同一組總數據。兩種尺寸的六項標籤皆位於雷達木框內、modal 完整位於 viewport、頁面水平／垂直溢出皆為 0，瀏覽器無例外。另執行 `node --check public/js/board_game.js`、正式 HTML inline script 語法、正式頁／新版 JS HTTP 200 與 `git diff --check`。
- 風險：只切換雷達圖的顯示來源；總能力沿用角色已同步的 `baseStats`，修行點數沿用既有 training 資料，不新增或改名 `gameState` 欄位，不改角色能力計算、材料、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 同步流程。

#### 修行道具圖片式數量視窗

- 範圍：將使用者放入 `training_ui/incoming/` 的 `training_item_quantity_frame.webp` 檢查後移至正式素材根層，接入修行鳥羽／藍波飲／四階修行材料與戰鬥記憶貝的多數量選擇流程。新 16:9 圖片式視窗依素材框位顯示道具圖、道具名稱、持有數、目前角色與修行概況、減少／數量／增加、最多有效數量及確認／返回按鈕；既有控制項 id 與事件處理維持不變。主頁快取版本更新為 `20260718-training-quantity-ui-v10`。
- 檔案：`public/images/board/training_ui/training_item_quantity_frame.webp`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：以隔離正式流程完成三名角色選擇後測試生命鳥羽與戰鬥記憶貝；桌機 1440×900 的視窗為 960×540，平板 1024×768 同為 960×540，均完整位於 viewport，所有控制項位於圖片框內且頁面水平／垂直溢出為 0。生命鳥羽持有 5 個時可由 1 加至 2、減回 1，再向下循環到最大有效 5；戰鬥記憶貝持有 3 個時可由 1 加至 2並顯示最大有效 3。取消均返回同一修行詳情；平板確認使用 2 個生命鳥羽後，持有數由 5 變 3、生命修行由 0 變 2並返回修行詳情。圖片載入尺寸為 1672×941，瀏覽器無例外。另執行 `node --check public/js/board_game.js`、正式 HTML inline script 語法、正式頁／新版 JS／新增 WebP HTTP 200 與 `git diff --check`。
- 風險：只替換多數量選擇的 UI 結構與樣式；單一有效數量仍沿用原本直接使用，材料 id、持有數計算、最大有效數量、消耗、修行／記憶效果、角色能力、任務紀錄、localStorage key、Socket.IO event 與 `BOARD_GAME_STATE` 同步流程不變。

#### 修行道具數量視窗文字對齊

- 範圍：依 `training_item_quantity_frame.webp` 實際 1672×941 框位重新校正正式數量視窗文字層；標題、道具資料列、角色狀態列、減少／數量／增加、最多有效／使用數量及底部確認／返回文字分別下移至各自木框的垂直中心，不修改圖片本身。主頁快取版本更新為 `20260718-training-quantity-align-v11`。
- 檔案：`public/board_game.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：在正式 `board_game.html` 以桌機 1440×900、平板 1024×768 實際開啟 960×540 數量視窗；逐項檢查標題、道具名稱／持有數、角色狀態、加減號、中央數量、最多有效／使用數量與確認／返回文字均落在素材對應框的垂直中央，視窗完整位於 viewport，頁面水平／垂直溢出皆為 0。另執行 `node --check public/js/board_game.js`、正式 HTML inline script 語法、正式頁／新版 JS／正式 WebP HTTP 200 與 `git diff --check`。
- 風險：只調整數量視窗的 CSS 百分比位置與高度，不改圖片、控制項 id、加減事件、最大有效數量、道具消耗、返回流程、存檔或多人同步。

#### 修行道具數量視窗圓形道具圖修正

- 範圍：依 `training_item_quantity_frame.webp` 的實際透明圓孔（原圖約 x=310–519、y=247–457）重新校正左側道具圖遮罩；圓形容器擴大並移到素材內圈，補滿深黑底，圖片改為完整覆蓋後以圓形裁切，避免露出後方地圖或殘留方形黑底。主頁快取版本更新為 `20260718-training-quantity-icon-v12`。
- 檔案：`public/board_game.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：在正式 `board_game.html` 以桌機 1440×900、平板 1024×768 開啟修行道具數量視窗，確認生命鳥羽圖片覆蓋圓孔、黑底完整、圓形邊緣不越過金框，視窗完整位於 viewport 且頁面無水平／垂直溢出；另執行 `node --check public/js/board_game.js`、正式 HTML inline script 語法、正式頁／新版 JS／道具圖 HTTP 200 與 `git diff --check`。
- 風險：僅調整正式數量視窗道具圖的 CSS 定位、遮罩、底色與填滿方式；不修改素材檔、道具 id、持有數、使用效果、存檔欄位或多人同步。

#### 修行道具數量視窗完整圖與加減鍵對齊

- 範圍：保留左側圓孔已補滿的深黑底，將道具圖片縮回圓孔內 86% 並使用 `object-fit:contain`，使生命鳥羽等直向素材完整顯示、不再被圓邊裁掉；依數量底圖左右方框中心重新定位 `－` 與 `＋`，同步微調命中區的上緣、寬度與高度。主頁快取版本更新為 `20260718-training-quantity-controls-v13`。
- 檔案：`public/board_game.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：在正式 `board_game.html` 以桌機 1440×900、平板 1024×768 開啟生命鳥羽數量視窗，確認完整羽毛位於黑色圓孔內，黑底仍填滿至金框；`－` 與 `＋` 的文字中心及按鈕命中區分別對準左右木框，視窗與頁面無溢出。另執行 `node --check public/js/board_game.js`、正式 HTML inline script、正式頁／新版 JS／道具圖 HTTP 200 與 `git diff --check`。
- 風險：只調整道具圖內縮比例與加減鍵 CSS；控制項 id、循環／加減事件、最大有效數量、消耗、修行效果、存檔與多人同步不變。

#### Board 手機／平板主畫面全螢幕範圍

- 範圍：新增 Board 專用 `board_manifest.webmanifest`，入口固定為 `board_start.html`，scope 明確涵蓋同目錄正式流程，顯示模式優先使用 `fullscreen`、以 `standalone` 相容後備並鎖定橫向；在 `board_start.html`、`board_game.html` 補齊 manifest、Apple／通用 mobile web app、黑色透明狀態列、主畫面名稱、theme color 與 touch icon。舊卡牌入口的 `manifest.webmanifest` 不修改。大廳到主遊戲仍沿用同來源 `location.href`，正式戰鬥／推進城／Marineford／水之七島仍在主遊戲外層內以全畫面 iframe 顯示。
- 檔案：`public/board_manifest.webmanifest`、`public/board_start.html`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：解析 Board manifest JSON，確認 `start_url=./board_start.html`、`scope=./`、`display=fullscreen`、fallback 含 `standalone`；檢查兩個正式外層頁皆載入同一 manifest 且具有 Apple／mobile web app 標記，確認正式入口、主遊戲、manifest 與兩個 icon HTTP 200。另執行 `node --check public/js/board_start.js`、`node --check public/js/board_game.js`、兩頁 HTML inline script 語法與 `git diff --check`。Safari 主畫面是否移除網址工具列須在 iPhone／iPad 刪除舊捷徑、重新加入後實機驗證。
- 風險：iPhone／iPad 會把主畫面捷徑的 manifest／web clip 設定快取於安裝時，既有捷徑必須刪除後從 `board_start.html` 重新「加入主畫面」才會套用；本次不修改房間導航、Socket.IO event、遊戲狀態、存檔或同步。

#### 2026-07-18 — 擲骰介面素材收件資料夾

- 範圍：建立 `public/images/board/dice_ui/incoming/`，供使用者放入新擲骰主框與 1～9 點骰面生成圖；本階段只建立素材收件區，尚未統一命名或接入正式擲骰流程。
- 檔案：`public/images/board/dice_ui/incoming/.gitkeep`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認收件資料夾存在，且正式 `board_game.html`／`board_game.js` 尚未引用 `dice_ui/incoming/`；執行 `git diff --check`。
- 風險：只新增素材收件資料夾與文件，不修改骰子範圍、移動型被動、擲骰事件、指定步數卷、角色移動、`gameState`、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`；素材檢查與固定命名前不得接入正式頁。

#### 2026-07-18 — 全螢幕航海骰與 1～9 骰面正式接入

- 範圍：檢查使用者提供的主框與 1～9 點共 10 張 RGBA WebP，確認點數、尺寸與透明通道後固定命名歸檔至 `public/images/board/dice_ui/`。正式 `dice-hud` 改為覆蓋整個 viewport 的航海木框介面，上方顯示玩家／行動、中央輪播實際骰面、下方顯示本次範圍或條件；數字／特殊文字骰仍保留文字 fallback。骰面預先載入，一般滾動延長為約 2.4～3.2 秒，結果停留 3 秒後才關閉。`getTeamEffects()` 將移動型有效人數封頂 3 名，移動骰最高由 10 修正為 9，符合職能被動最高 3 名規則；指定步數券流程不變。主頁快取版本更新為 `20260718-dice-ui-v1`。
- 檔案：`public/images/board/dice_ui/dice_stage_frame.webp`、`public/images/board/dice_ui/dice_face_1.webp`～`dice_face_9.webp`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認 10 張正式素材存在、主框為 1672×941、九張骰面均為 1254×1254 RGBA 且 alpha 範圍為 0～255；執行 `node --check public/js/board_game.js` 與正式 HTML script 檢查。使用正式 `board_game.html` 實際瀏覽器渲染桌機 1440×900 與平板 1024×768，檢查主框、標題、1～9 骰面、結果停格、底部說明、全螢幕遮罩及 viewport 溢出；確認正式頁、JS 與 10 張素材 HTTP 200，最後執行 `git diff --check`。
- 風險：移動型第 4 名以上不再額外提高移動骰上限、戰鬥速度或逃跑成功門檻，這是依「職能被動最高 3 名」規則修正既有漏封頂行為；不新增或改名 `gameState` 欄位，不改角色／道具 id、指定步數券、移動路線、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。多人觀看方仍使用既有 `dice` UI event 的 `maxFace`、`result` 與 `settleDelay` 播放相同骰面。

#### 2026-07-18 — 攜帶物整備 UI 素材收件資料夾

- 範圍：建立 `public/images/board/carry_item_ui/incoming/`，供使用者放入攜帶物整備主框生成圖；本階段只建立素材收件區，尚未統一命名或接入正式船員詳情與攜帶物裝卸流程。
- 檔案：`public/images/board/carry_item_ui/incoming/.gitkeep`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認收件資料夾存在，且正式 `board_game.html`／`board_game.js` 尚未引用 `carry_item_ui/incoming/`；執行 `git diff --check`。
- 風險：只新增素材收件資料夾與文件，不修改攜帶物 id、裝備驗證、鎖定與卸下規則、背包數量、角色資料、`gameState`、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`；素材完成檢查及固定命名前不得接入正式頁。

#### 2026-07-18 — 攜帶物整備 UI 正式接入

- 範圍：檢查使用者放入的去背 WebP 為 1659×948 RGBA、alpha 範圍 0～255，確認左側道具窗為真正透明挖空後固定命名為 `carry_item_panel_frame.webp`。正式 `openEquipBattleCarryModal()` 改為圖片式 16:9 攜帶物整備：左側顯示目前道具、名稱、稀有度、效果與卸下按鈕，右側以可捲動橫列完成裝備／更換，底部返回來源；船員詳情與目前玩家船員卡都移除獨立卸下按鈕，統一只留「攜帶物」入口。依使用者檢查回饋，右側標題與數量向中間內縮並下移，避開上方海浪角飾；清單恢復較長的橫條寬度，上下邊界仍避開四角裝飾，每頁只呈現 5 個完整項目。主頁快取版本更新為 `20260718-carry-item-ui-v1`。
- 檔案：`public/images/board/carry_item_ui/carry_item_panel_frame.webp`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認正式 `board_game.html` 與新 WebP HTTP 200。以隔離正式流程在 Chrome 實際建立 3 名船員並放入 76 個測試攜帶物：桌機 1440×900 的視窗為 1240×709、平板 1024×768 為 973×556，兩者均完整位於 viewport、頁面水平／垂直溢出為 0且無瀏覽器例外；實際由名冊進入船員詳情再開啟攜帶物，裝備後左側正確顯示 1254×1254 道具圖與可用的卸下按鈕，卸下後背包項目由 75 回到 76並顯示未裝備狀態，返回按鈕回到同一船員詳情。另確認平板右側標題與數量避開上方角飾，較長的清單橫條仍留在主框內且上下不壓四角裝飾；最後執行 HTML script、素材存在與 `git diff --check`。
- 風險：本次只改正式攜帶物 UI 結構、入口文字及素材引用；`battleCarryItem` 欄位、攜帶物字串 id、能力者裝備限制、綁定／四皇對策卸下判斷、背包數量移轉、任務事件、角色資料、localStorage key、Socket.IO event 與 `BOARD_GAME_STATE` 同步流程全部沿用既有程式。觀看方與非目前操作玩家的控制權仍沿用原本外層入口判斷。

### 2026-07-19

#### 攜帶物清單避開底部海浪裝飾

- 範圍：保留使用者偏好的右側長橫條寬度，將正式攜帶物清單底界由主框底部 18.2% 上收至 23%，使第五個完整項目停在左右下方海浪裝飾上緣之前；標題、數量、左側目前攜帶物與底部返回按鈕位置不變。
- 檔案：`public/board_game.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：以正式 `board_game.html` 的隔離遊戲狀態在平板 1024×768 開啟攜帶物整備，確認 5 個完整清單項目、文字、圖示與操作按鈕皆位於底部海浪裝飾上方，視窗完整位於 viewport 且頁面無水平／垂直溢出；另執行 HTML script、正式頁 HTTP 200 與 `git diff --check`。
- 風險：只上收清單可視範圍，不改清單寬度、排序、捲動、攜帶物 id、裝備／更換／卸下、背包數量、存檔或多人同步流程。

#### 外觀框選擇 UI 素材收件資料夾

- 範圍：建立 `public/images/board/cosmetic_frame_ui/incoming/`，供使用者放入外觀框選擇與即時角色預覽主框生成圖；本階段只建立素材收件區，尚未統一命名或接入正式 `openCrewCosmeticFrameModal()`。
- 檔案：`public/images/board/cosmetic_frame_ui/incoming/.gitkeep`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認收件資料夾存在，且正式 `board_game.html`／`board_game.js` 尚未引用 `cosmetic_frame_ui/incoming/`；執行 `git diff --check`。
- 風險：只新增素材收件資料夾與文件，不修改外觀框 id、既有戰鬥外觀框圖層素材、角色限制、解鎖條件、裝備狀態、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`；素材檢查與固定命名前不得接入正式頁。

#### 2026-07-19 — 正式外觀框選擇與即時實裝預覽

- 範圍：檢查使用者放入 `cosmetic_frame_ui/incoming/` 的去背 WebP 為 1672×941 RGBA、alpha 範圍 0～255，確認左側預覽舞台、右側捲動清單與底部雙按鈕安全區後固定命名為 `cosmetic_frame_panel_frame.webp`。正式 `openCrewCosmeticFrameModal()` 改用圖片式航海外觀框介面，左側以目前船員角色圖與正式戰鬥框相同的方形卡比例、圖片路徑及圖層座標即時呈現套框效果；右側可選無框、通用成就框與目前角色可用專屬框，依使用者回饋移除清單縮圖，只顯示框名、來源與使用／預覽狀態，並將清單四邊內縮避開素材角飾，每頁固定呈現 4 個完整文字列並整列吸附捲動，不露出被外框裁掉的半列。點選清單只更新本次預覽，不修改船員；按「裝備此框／改成無框」後才沿用既有 `equipCrewCosmeticFrame()` 寫入並推送 `BOARD_GAME_STATE`，返回則回到同一船員詳情。主頁快取版本更新為 `20260719-cosmetic-frame-ui-v1`。
- 檔案：`public/images/board/cosmetic_frame_ui/cosmetic_frame_panel_frame.webp`、`public/js/board_cosmetic_frame_preview.js`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_cosmetic_frame_preview.js`、`node --check public/js/board_game.js`，確認預覽資料引用的 78 個正式圖片路徑全部存在。以正式 `board_game.html` 的隔離頁面狀態從船員名冊進入角色詳情與外觀框視窗：桌機 1440×900 實測黃金電話蟲框、平板 1024×768 實測 3D2Y 框，主框均完整位於 viewport、清單可捲動且頁面水平／垂直溢出為 0；再以 9 張已解鎖通用框加無框共 10 個文字選項測試捲到最末 `空白王座框`，畫面只顯示 4 個完整文字列，沒有縮圖、半列或文字壓住素材角飾，選中項仍完整可見。點選框後確認 `cosmeticFrameId` 仍未變更，按確認後才由空值改為 `goldenDenDen`。另確認正式頁、新版 JS 與正式 WebP HTTP 200、所有預覽圖層載入成功、HTML inline script 語法與 `git diff --check`。
- 風險：新增的是外觀框選擇的視覺主框與確認前預覽步驟；不新增或改名 `gameState` 欄位，不更動框款 id、解鎖／角色限制、舊存檔回補、實際戰鬥頁框效果、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 格式。只有確認動作會沿用既有同步推送。

#### 2026-07-19 — 任務日誌 UI 素材收件資料夾

- 範圍：確認使用者生成的任務清單橫條具備正圓等級框、乾淨文字區與獨立狀態牌後，建立 `public/images/board/mission_journal_ui/incoming/`，供放入任務日誌主框與可重複清單橫條；本階段尚未固定命名或接入正式 `openMissionJournalModal()`。
- 檔案：`public/images/board/mission_journal_ui/incoming/.gitkeep`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認收件資料夾存在，且正式 `board_game.html`／`board_game.js` 尚未引用 `mission_journal_ui/incoming/`；執行 `git diff --check`。
- 風險：只新增素材收件資料夾與文件，不修改個人／共同任務內容、接取上限、進度、貢獻、領取、放棄、獎勵、任務 id、`gameState`、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`；素材完成檢查及固定命名前不得接入正式頁。

#### 2026-07-19 — 任務日誌 UI 正式接入

- 範圍：檢查使用者放入的兩張去背 WebP，主框為 1672×941 RGBA、可重複任務橫條為 2172×724 RGBA，確認透明範圍與內容安全區後固定命名為 `mission_journal_panel_frame.webp`、`mission_journal_row_frame.webp`。正式 `openMissionJournalModal()` 改為圖片式任務日誌：左側以可捲動長條清單顯示任務等級、名稱、類型、進度及狀態，點選任務只更新本次 modal 的右側選取項；右側顯示等級徽記、條件、進度、獎勵、共同參與者／貢獻，以及既有領取、共同領取和放棄操作。空清單與關閉流程也納入同一主框。主頁快取版本更新為 `20260719-mission-journal-ui-v1`。
- 檔案：`public/images/board/mission_journal_ui/mission_journal_panel_frame.webp`、`public/images/board/mission_journal_ui/mission_journal_row_frame.webp`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、正式 HTML inline script、兩張新素材存在與 HTTP 200、正式頁 HTTP 200 及 `git diff --check`。在正式 `board_game.html` 的隔離狀態建立 3 筆個人任務，桌機 1440×900 與平板 1024×768 實際開啟任務日誌；確認素材全數載入、主框完整位於 viewport、頁面無水平／垂直溢出、點選任務後右側標題與按鈕正確切換。另實際領取完成任務、放棄未完成任務並關閉視窗，任務清單分別由 3 筆降為 2 筆、再降為 1 筆。
- 風險：本次只替換正式任務日誌的呈現結構與本次視窗選取狀態；不新增或改名 `gameState` 欄位，不改任務 id、接取／共同任務上限、進度計算、貢獻、獎勵、領取與放棄函式、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。多人狀態仍由原本任務操作及完整快照同步。

#### 2026-07-19 — 任務日誌圖文比例校正

- 範圍：依正式桌機與平板畫面重新校正任務日誌內所有圖文比例；放大左側任務列與右側詳情的等級圖，提升清單名稱、進度、狀態、詳情標題、條件、進度、獎勵與按鈕的最低字級，並維持各文字在素材既有安全區內。主頁快取版本更新為 `20260719-mission-journal-ui-v2`。
- 檔案：`public/board_game.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：以正式 `board_game.html` 在桌機 1440×900、平板 1024×768 建立 3 筆任務並實際開啟任務日誌，確認等級圖未超出圓框、所有文字未壓到金框或海浪裝飾、任務列與右側按鈕仍完整可用；另執行 JS、HTML script、正式頁與素材 HTTP 200、`git diff --check`。
- 風險：只調整正式任務日誌 CSS 圖文尺寸與快取版本；不改任務資料、進度、領獎、放棄、共同任務、存檔或多人同步。

#### 2026-07-19 — 任務日誌 S～E 圓形等級章正式接入

- 範圍：檢查使用者放入 `mission_journal_ui/` 的六張去背圓形等級章，依圖中文字確認第 1～6 張分別為 A、B、C、D、E、S，統一命名為 `mission_rank_a.webp`～`mission_rank_s.webp`。正式任務日誌的左側任務列小圓框與右側詳情大圓框改為依任務等級共用這套圓形圖，不再引用任務島的橫向 `rank_*.webp`。主頁快取版本更新為 `20260719-mission-rank-ui-v3`。
- 檔案：`public/images/board/mission_journal_ui/mission_rank_a.webp`～`mission_rank_s.webp`、`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認六張正式素材存在且檔名與圖中文字一一對應；執行 `node --check public/js/board_game.js`、HTML inline script、正式頁／新版 JS／六張素材 HTTP 200 與 `git diff --check`。以正式 `board_game.html` 在桌機 1440×900、平板 1024×768 開啟包含不同等級的任務日誌，確認小圓章與大圓章均等比例完整顯示在圓框內。
- 風險：只替換任務日誌的等級圖片來源與素材命名；任務島原有等級素材、任務 grade/id、進度、領取、放棄、共同任務、存檔及多人同步全部不變。

#### 2026-07-19 — 任務日誌圓形等級章中心與直徑校正

- 範圍：依六張新圓章各自不同的透明留白與實際圓章外徑，為 S～E 分別設定顯示比例；左側小圓框的中心右移並加寬容器，右側大圓框的中心左移、微調上下範圍，讓圓章外圈不再貼住或偏離素材金屬圓框。主頁快取版本更新為 `20260719-mission-rank-align-v4`。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：在正式任務日誌分兩組建立 S/A/B 與 C/D/E 任務，於桌機 1440×900、平板 1024×768 檢查左右圓框；確認六種圓章視覺外徑一致、中心對齊、未接觸金屬框且維持正圓。另執行 JS、HTML script、正式頁與六張素材 HTTP 200、`git diff --check`。
- 風險：只校正任務日誌圓章 CSS 與等級 class；不修改任何任務規則、資料 id、存檔或同步。

#### 2026-07-19 — 船團資訊與討伐紀錄 UI 素材收件資料夾

- 範圍：確認船團資訊主框、職能階段橫列框、討伐紀錄主框與敵人清單橫列框共 4 張生成圖的版位符合正式功能需求，建立 `public/images/board/fleet_info_ui/incoming/` 與 `public/images/board/defeated_codex_ui/incoming/` 供使用者放入完成去背的素材；本階段尚未固定命名或接入正式船團／討伐紀錄流程。
- 檔案：`public/images/board/fleet_info_ui/incoming/.gitkeep`、`public/images/board/defeated_codex_ui/incoming/.gitkeep`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認兩個收件資料夾皆已建立，且正式 `board_game.html`／`board_game.js` 尚未引用任一 `incoming/` 路徑；執行 `git diff --check`。
- 風險：只新增素材收件資料夾與文件紀錄，不修改戰鬥型、偵查型、移動型、輔助型的 1～3 人階段效果，不修改討伐紀錄資料、敵人 id、`gameState`、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。

#### 2026-07-19 — 正式船團資訊與討伐紀錄 UI 接入

- 範圍：檢查使用者放入的 4 張 RGBA WebP，將兩張 1672×941 主框、2400×480 敵人橫列框固定命名歸檔；1920×819 職能階段橫列的實際 alpha 範圍僅為 1858×287，先裁掉上下透明留白後歸檔，避免正式介面縮小錯位。`openFleetInfoModal()` 改為圖片式船團資訊，左側切換四職能，右側同時顯示固有說明、完整 1～3 階效果、開啟／鎖定與尚差人數、目前實際效果，並區分偵查實際人數與瞭望台補正。`openDefeatedEnemyCodexModal()` 改為左側可捲動敵人清單與中右詳情，保留 portrait fallback、空紀錄、返回船團與關閉流程。主頁快取版本更新為 `20260719-fleet-codex-ui-v1`。
- 檔案：`public/images/board/fleet_info_ui/fleet_info_panel_frame.webp`、`public/images/board/fleet_info_ui/fleet_role_stage_row_frame.webp`、`public/images/board/defeated_codex_ui/defeated_codex_panel_frame.webp`、`public/images/board/defeated_codex_ui/defeated_enemy_row_frame.webp`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、正式 HTML inline script、四張素材尺寸／alpha／路徑、正式頁與素材 HTTP 200、`git diff --check`；以正式 `board_game.html` 於桌機 1440×900 與平板 1024×768 開啟船團資訊及討伐紀錄，切換四職能與多筆敵人記錄，確認主框、圖片、文字、三階橫列、清單、詳情與按鈕皆在安全區且可操作。
- 風險：只替換船團與討伐紀錄的呈現及視窗內選取狀態；不修改 `getTeamEffects()` 職能計算、敵人 id、討伐紀錄欄位、戰鬥累計、`gameState`、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。

#### 2026-07-19 — 船團資訊與討伐紀錄圖框精細對齊

- 範圍：依正式畫面逐區重新比對素材框線，不再只檢查主框是否溢出。船團頂部四個概要欄加入框內圓章並重排文字／數值，左側四職能操作區縮回各自木框，放大且置中職能圖、移除重複覆蓋的小狀態框；右側職能圖、標題、固有說明與三階效果區重新貼合素材安全區。職能階段橫列不再整張強制壓扁，改以原圖左右端點等比例顯示、中間文字區延展。討伐清單的小角色圖改為六角框內裁切並放大，名稱、等級與討伐數重新對齊各自文字槽。主頁快取版本更新為 `20260719-fleet-codex-ui-v2`。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/DEV_WORKFLOW.md`。
- 驗證：從正式 `board_game.html` 完成開局選角後實際進入船長指令，於桌機 1440×900、平板 1024×768 切換戰鬥／偵查／移動／輔助四頁並逐筆切換 6 筆討伐紀錄；確認圓章、職能圖、三階端點、六角頭像、標題、說明、數值、捲動清單與底部按鈕均貼合素材框，沒有壓到金邊或穿出安全區。另執行 JS、HTML script、素材與正式頁 HTTP 200、`git diff --check`。
- 風險：本次只修正正式船團／討伐 UI 的 HTML 標示與 CSS 疊合座標；不改職能被動數值、討伐資料格式、敵人／角色 id、存檔、localStorage、Socket.IO event 或 `BOARD_GAME_STATE`。

#### 2026-07-19 — 船團資訊圓章與長數值安全區再校正

- 範圍：依使用者回饋先只處理正式船團資訊。頂部四格改為圓章固定座標及「標題在上、數值在下」的獨立裁切區，避免高額懸賞／貝里與標題互相擠壓；左側四列改用絕對安全區分別定位圓章、名稱／人數與階段，取消選中列的水平位移。職能圓章與右側詳情圓章依素材圓孔直徑放大置中，所有文字容器補齊 overflow 限制。主頁快取版本更新為 `20260719-fleet-codex-ui-v3`。
- 檔案：`public/board_game.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：在正式 `board_game.html` 注入 987,654,321 懸賞與 123,456,789 貝里作長字串壓力測試，於桌機 1440×900、平板 1024×768及手機橫向 844×390 實際開啟並切換船團職能；確認頂部圓章、四職能圓章與詳情圓章中心一致，所有標題、數值、人數、階段說明及目前效果均未產生水平或垂直 overflow。另執行正式頁語法、HTTP 與 `git diff --check`。
- 風險：只修改船團資訊 CSS 與快取版本；討伐紀錄、職能規則、存檔欄位、角色／敵人 id、localStorage、Socket.IO event 和 `BOARD_GAME_STATE` 均不變。

#### 2026-07-19 — 船團職能階段狀態牌對齊

- 範圍：只校正船團資訊左側四列的「第 1～3 階／未開啟」文字，依素材小木框實際範圍改為列內 x=74.5%、y=40%、寬 19%、高 37%，補固定 line-height 與裁切，其他船團版位不變。主頁快取版本更新為 `20260719-fleet-codex-ui-v4`。
- 檔案：`public/board_game.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：在正式 `board_game.html` 完成選角後開啟船團資訊，同時檢查「未開啟」、「第 1 階」、「第 2 階」三種狀態；四列狀態牌量測皆位於指定小框內且文字 overflow 為 false，並以 1440×900 實際截圖確認。另執行 HTML script、正式頁 HTTP 200 與 `git diff --check`。
- 風險：只移動職能列狀態文字；不改其他 UI、職能計算、討伐紀錄、存檔或多人同步。

#### 2026-07-19 — 討伐紀錄圖文安全區與敵人階級章校正

- 範圍：依 `defeated_codex_panel_frame.webp` 與 `defeated_enemy_row_frame.webp` 的實際框線重新校正正式討伐紀錄。左側清單整體移回素材欄位，放大並置中敵人頭像，名稱／階級／最高等級改置於中央長框，討伐次數置中於右側小框；右側敵人標題、四列數值與最後討伐地點重新對準各自安全區，四列標籤改用固定比例欄位避免左右飄移。敵人詳情右上階級圓框改為依 S～E 共用任務日誌的 `mission_rank_*.webp` 圓形等級章，保持等比例與文字替代說明。頂部與清單長數值保留框內裁切／省略保護。主頁快取版本更新為 `20260719-fleet-codex-ui-v7`。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/DEV_WORKFLOW.md`。
- 驗證：以正式 `board_game.html` 建立 10 筆討伐紀錄（包含長敵人名、長地點、九位數討伐數與大量島／海紀錄），在桌機 1440×900、平板 1024×768、手機橫向 844×390 實際開啟討伐紀錄並逐筆切換；確認敵人頭像、中央文字、右側討伐數、詳情標題、S 級圓章、四列標籤／數值與地點均落在素材框內，長內容只在自己的框內省略。另執行 JS、HTML inline script、正式頁／新版 JS／主框／橫列框／S～E 六張圓章 HTTP 與 `git diff --check`。
- 風險：只修改討伐紀錄的 CSS 座標、階級章圖片來源與顯示 helper；不改 `defeatedEnemies` 欄位格式、討伐累計、敵人 id、戰鬥結果、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。

#### 2026-07-19 — 討伐紀錄階級圓章獨立置中

- 範圍：只校正討伐詳情右上角的敵人階級圓章，不連動其他文字或整體版位。依主框原圖圓孔量測中心將容器由 x=87.95%、y=34.93% 修正至 x=86.72%、y=34.23%，並沿用任務日誌已校正的 S～E 各別縮放比例；新增安全階級 class helper，讓不同透明留白的六張圓章各自等比例置中。主頁快取版本更新為 `20260719-fleet-codex-ui-v8`。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/DEV_WORKFLOW.md`。
- 驗證：正式頁以 S～E 六筆敵人紀錄開啟討伐詳情；桌機 1440×900 與平板 1024×768 實際截圖確認 S 級圓章位於素材金框中心。瀏覽器量測 S 級圓章容器中心與圖片盒中心的水平差為 0 px，視覺 alpha 中心換算後垂直差小於 0.2 px；另確認六張階級圖路徑存在並執行 JS、HTML、HTTP 與 `git diff --check`。
- 風險：只新增討伐階級圖的顯示 class、獨立座標與每級縮放；不修改任務日誌圓章、其他討伐文字區、階級資料、戰鬥、存檔或多人同步。

### 2026-07-20

#### 討伐紀錄中央透明框與敵人圖對齊

- 範圍：檢查使用者新增的去背討伐主框為 1690×931 RGBA，中央獨立透明孔實測為 x=613～943、y=297～766；素材統一命名為 `defeated_codex_panel_frame_cutout.webp` 並接入正式 `openDefeatedEnemyCodexModal()`。主框以正式 modal 比例填滿，角色圖容器改用透明孔換算後的精確範圍（left 36.27%、top 31.9%、width 19.59%、height 50.48%），角色圖改在主框後方以 `cover` 填滿，讓金色四邊與四角保持在圖片上層；角色名稱仍位於透明孔底部。主頁快取版本更新為 `20260720-defeated-cutout-v9`。
- 檔案：`public/images/board/defeated_codex_ui/defeated_codex_panel_frame_cutout.webp`、`public/board_game.html`、`public/js/board_game.js`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用正式 `board_game.html` 建立赤犬討伐紀錄並開啟討伐詳情；桌機 1440×900 與平板 1024×768 實際截圖確認敵人圖完整填滿透明孔，四邊及四角未壓住金框、未露出後方地圖，角色名稱仍在孔內。瀏覽器量測主框載入自然尺寸為 1690×931，角色圖容器與圖片盒均為 250.75×363.64 px（桌機 modal 1280×720.38），沒有額外位移。另執行 JS、HTML inline script、正式頁／新版 JS／新主框 HTTP 200 與 `git diff --check`。
- 風險：只替換討伐主框素材並校正中央敵人圖的圖層與容器；舊非挖空主框保留但正式頁不再引用。不修改清單、文字、階級圓章、敵人 id、`defeatedEnemies`、戰鬥累計、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。

#### 討伐敵人圖填滿與清單選中框移除

- 範圍：依正式畫面回饋只調整兩個區域。中央敵人圖在既有透明孔內放大 6%，保留中心裁切並將孔底色由深藍改為近黑，避免金框內緣露出藍色；左側目前選中敵人列移除青藍色 inset／外發光框，只保留原本的亮度與飽和度提示。其他清單座標、文字、右側詳情及階級章不變。主頁快取版本更新為 `20260720-defeated-cutout-v10`。
- 檔案：`public/board_game.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：正式 `board_game.html` 建立赤犬與青雉兩筆討伐紀錄；桌機 1440×900、平板 1024×768 實際開啟討伐詳情，確認敵人圖填滿中央孔、四周未露出深藍底且仍由金框覆蓋，選中列沒有青藍邊框並可辨識目前項目。瀏覽器 computed style 確認選中列 `box-shadow:none`、圖片 transform 為 1.06、底色為 `rgb(2, 5, 8)`；另執行 JS、HTML、正式頁／新版 JS HTTP 與 `git diff --check`。
- 風險：只修改討伐 UI 的圖片縮放、孔底色及選中列裝飾；不改敵人圖片來源、清單操作、討伐資料、戰鬥、存檔或多人同步。

#### 討伐紀錄中央圖藍色接縫修正

- 範圍：逐像素檢查 `defeated_codex_panel_frame_cutout.webp` 的中央 alpha 孔後，確認孔內透明像素乾淨；正式畫面看到的青藍細線來自角色圖容器與透明孔精確貼齊時的次像素縮放接縫。將中央角色圖層向金框下方四周各延伸約 6 個素材像素（left 35.92%、top 31.26%、width 20.3%、height 51.77%），由上層金框遮住延伸區；角色名稱標籤同步收回至原本安全位置。主頁快取版本更新為 `20260720-defeated-cutout-v11`。
- 檔案：`public/board_game.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用正式討伐紀錄 modal 檢查桌機與平板比例，確認中央圖四邊不再露出頁面藍色接縫且金框仍完整覆蓋；另執行 HTML inline script 語法檢查、正式頁 HTTP 200 與 `git diff --check`。
- 風險：未修改角色圖本身、敵人資料、戰鬥／討伐規則、存檔欄位或多人同步；僅擴大金框後方的中央圖片顯示層。

#### 討伐紀錄羅布・路基圖片相容

- 範圍：查明正式敵人資料與舊討伐存檔使用穩定 key `lucci`，實際戰鬥立繪資料夾則為 `rob_lucci`；討伐紀錄原本直接用 key 組路徑，因而請求不存在的 `battle/enemies/lucci/normal.webp`。新增僅供討伐圖片路徑使用的 `lucci` → `rob_lucci` 相容對應，圖片與備援路徑共用同一轉換，不改敵人 key。主頁快取版本更新為 `20260720-defeated-cutout-v12`。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認 `public/images/board/battle/enemies/rob_lucci/normal.webp` 存在並可由正式頁 HTTP 200 載入；在正式頁的討伐 modal DOM 套用 `lucci` 相容後路徑，以桌機 1440×900 與平板 1024×768 實際截圖確認中央詳情顯示羅布・路基圖片，中央孔四邊亮青接縫像素為 0。另執行 `node --check`、HTML inline script、正式頁 HTTP 及 `git diff --check`。
- 風險：未改 `lucci`／`rob_lucci` 的既有資料 id、敵人數值、戰鬥流程、討伐存檔格式、localStorage、Socket.IO event 或 `BOARD_GAME_STATE`；只修正討伐 UI 的素材資料夾別名。

#### 船隻資訊 UI 素材收件目錄建立

- 範圍：確認船隻資訊全螢幕主框、孔位共用橫列、永久升級共用橫列與船材／船隻道具共用橫列共四張生成素材的版面可用，建立 `public/images/board/ship_info_ui/` 作為統一收件與後續正式歸檔位置。目前尚未改動或接入正式 `openShipInfoModal()`。
- 檔案：`public/images/board/ship_info_ui/`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認素材目錄存在，並確認 `docs/FILE_MAP.md` 已登記其目前收件用途；正式頁、遊戲狀態與既有船隻資訊流程尚未變動。
- 風險：空資料夾本身不影響遊戲；使用者放入四張素材後仍須逐張檢查尺寸、比例、透明邊界與內容安全區，完成統一命名後才能接入正式頁。

#### 正式船隻資訊四分頁全螢幕介面

- 範圍：檢查使用者放入的四張船隻資訊素材並統一命名為 `ship_info_panel_frame.webp`、`ship_info_slot_row_frame.webp`、`ship_info_upgrade_row_frame.webp`、`ship_info_item_row_frame.webp`。正式 `openShipInfoModal()` 攄為全螢幕航海主框，左側固定顯示目前船型與船名，右側提供船體總覽、裝備孔位、永久升級、船材道具四分頁；水之七島入口仍呼叫既有 `openWaterSevenWindow()`，其他地點顯示不可用提示。桌機孔位採雙欄、平板採單欄，升級與道具清單每次完整呈現三列後在素材框內捲動，避免顯示半列預覽。主頁快取版本更新為 `20260720-ship-info-ui-v1`。
- 檔案：`public/images/board/ship_info_ui/ship_info_panel_frame.webp`、`public/images/board/ship_info_ui/ship_info_slot_row_frame.webp`、`public/images/board/ship_info_ui/ship_info_upgrade_row_frame.webp`、`public/images/board/ship_info_ui/ship_info_item_row_frame.webp`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：正式 `board_game.html` 套用與正式 DOM、CSS 相同的船隻資訊面板，在桌機 1440×900 與平板 1024×768 逐一檢查四個分頁；主框、船圖、標題、分頁、狀態列與按鈕均位於素材框內，升級／道具頁只顯示完整列並可內部捲動，兩種 viewport 皆無文件水平或垂直溢出。另執行 `node --check`、HTML inline script 語法檢查、正式頁／新版 JS／四張素材 HTTP 200 與 `git diff --check`。
- 風險：只替換船隻資訊的顯示結構、素材與分頁事件；不修改船隻 id、裝備孔位、永久升級數值、材料數量、水之七服務、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。

#### 船隻資訊孔位單欄與道具文字框校正

- 範圍：依正式畫面回饋將裝備孔位由桌機雙欄改為桌機／平板一致的單欄排列，每個孔位獨佔一排並在既有內容區內捲動。船材道具頁重新限制名稱、效果說明、階級與分類的內容盒寬度，長名稱與說明最多顯示兩行並在各自素材框內截斷，避免 padding 或長字串越過右側欄位。主頁快取版本更新為 `20260720-ship-info-ui-v2`。
- 檔案：`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：以正式船隻資訊 DOM 在桌機與平板 viewport 檢查孔位及船材道具分頁，確認孔位每列僅一張、文字不跨出名稱／效果／階級／分類框；另執行 JS、HTML inline script、正式頁／新版 JS HTTP 與 `git diff --check`。
- 風險：僅修改船隻資訊 CSS 排版與快取版本；不變更孔位解鎖、裝備內容、道具數量、升級規則、水之七服務、存檔或多人同步。

#### 船材／船隻道具名稱格內縮

- 範圍：依正式畫面回饋單獨校正船材道具列的名稱區，將名稱盒左右安全距離往素材金框內縮、縮小最高字級，並同時限制寬度、兩行總高度及逐字斷行；最長的正式船隻裝備名稱也只能在名稱木框內顯示，不會跨到數量格或中央效果區。主頁快取版本更新為 `20260720-ship-info-ui-v3`。
- 檔案：`public/board_game.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：以正式最長名稱「夢幻廚房與醫療聯艙」及更長壓力測試字串，在桌機與平板 viewport 開啟正式船材道具分頁，確認文字盒四邊位於名稱素材框內；另執行 HTML inline script、正式頁／新版 JS HTTP 與 `git diff --check`。
- 風險：只調整船隻資訊名稱格的 CSS 與快取版本；不修改任何道具名稱、字串 id、數量、效果、存檔或同步。

#### 學習技能／替換招式 UI 素材收件目錄建立

- 範圍：確認全螢幕技能學習主框生成圖的版面可用；左側角色透明窗、中央新招式名稱／四項資料／效果區、右側四個既有招式橫列、底部提示及確認／放棄按鈕皆具備獨立安全區。建立 `public/images/board/move_learn_ui/` 作為統一收件位置，目前尚未改動或接入正式 `processNextPendingMoveLearn()`。
- 檔案：`public/images/board/move_learn_ui/`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認素材目錄存在，並確認 `docs/FILE_MAP.md` 已登記為收件用途；正式技能學習、替換、放棄、佇列與同步流程尚未變動。
- 風險：空資料夾本身不影響遊戲；素材放入後仍須檢查尺寸、透明邊界與內容安全區，統一命名後才能接入正式頁。

#### 正式學習技能／替換招式全螢幕介面

- 日期：2026-07-20。
- 範圍：檢查使用者放入的 1672×941 RGBA 去背 WebP，確認左側角色窗是真正透明挖空後統一命名為 `move_learn_panel_frame.webp`。正式 `processNextPendingMoveLearn()` 在角色已滿 4 個招式時改為圖片式航海介面：左側顯示角色與等級資料，中央顯示新招式名稱、類型、需求等級、最大 PP、威力與效果，右側固定顯示 4 個既有招式。點右側招式只會選取並更新底部提示，必須再按「確認替換」才寫入；「先不學」、未滿 4 招時直接學會、待學習佇列清理及既有同步排程均保留。主頁快取版本更新為 `20260720-move-learn-ui-v1`。
- 檔案：`public/images/board/move_learn_ui/move_learn_panel_frame.webp`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；以正式素材、正式 CSS 與等同正式 DOM 的技能替換面板，在桌機 1440×900、平板 1024×768 實際截圖檢查角色窗、中央資料、右側 4 招、選中狀態、提示與雙按鈕，兩種尺寸皆完整位於 viewport 且文字留在各自素材安全區。另確認正式頁、新版 JS 與素材 HTTP 200，完成 HTML inline script 語法與 `git diff --check`。
- 風險：只替換學招／換招的顯示結構，並把原本點招式立即替換改為選取後確認；不修改招式 id、可攜帶上限、解鎖等級、技能效果、待學習佇列欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 同步格式。

#### 招式修行卷使用後立即接續學招流程

- 日期：2026-07-20。
- 範圍：修正 `applySkillTrainingItemToTarget()` 使用招式修行卷後只消耗道具、加入待學習佇列，卻又重開修行詳情或停在選人視窗，導致玩家看不到後續結果的問題。角色已滿 4 招時，使用捲軸後現在會立即關閉原視窗並開啟正式全螢幕替換介面；未滿 4 招時會立即學會、顯示提示，再回修行詳情或航海背包。主頁快取版本更新為 `20260720-move-learn-scroll-fix-v2`。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`；確認滿 4 招分支在道具消耗及佇列建立後直接呼叫 `processNextPendingMoveLearn()`，未滿 4 招分支則寫入新招式並返回原來源。另確認正式頁、新版 JS HTTP 200，完成 HTML inline script 與 `git diff --check`。
- 風險：不修改招式修行卷 id、候選招式排序、道具消耗數量、4 招上限、待學習佇列資料格式、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`；只修正使用後的視窗接續與成功提示。

#### 替換招式列 PP／威力框對齊

- 日期：2026-07-20。
- 範圍：依正式介面回饋，只校正全螢幕學招介面右側四個既有招式列。PP 與威力欄分別對準素材 x=64.7% 與 x=80.3% 的兩個小金框；最終版將「PP／威力」標籤固定在小金框正上方，只有數字或「效果」置中放進框內，並把平板最小標籤／數值提高為 6px／9px，桌機最高提高為 10px／15px。其他角色窗、新招式資料、效果、提示及按鈕版位不變。主頁快取版本更新為 `20260720-move-learn-meta-align-v5`。
- 檔案：`public/board_game.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：以正式 `move_learn_panel_frame.webp`、正式 CSS 與四個代表招式列，在桌機 1440×900、平板 1024×768 實際截圖逐列確認 PP／威力標籤位於框上、數值位於框內，沒有壓線或超框；另執行 JS、HTML inline script、正式頁／新版 JS HTTP 及 `git diff --check`。
- 風險：只修改右側既有招式列的 PP／威力文字座標、大小與顏色；不修改招式 PP、威力數值、替換規則、捲軸消耗、存檔或多人同步。

#### 選擇本回合船長 UI 素材收件目錄建立

- 日期：2026-07-20。
- 範圍：確認「選擇本回合船長」全螢幕主框與船員共用橫列兩張生成素材版面可用，建立 `public/images/board/captain_selection_ui/incoming/` 作為去背素材收件位置。目前尚未改動或接入正式 `openCaptainSelectionModal()`。
- 檔案：`public/images/board/captain_selection_ui/incoming/.gitkeep`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認收件資料夾與保留檔存在，並確認 `docs/FILE_MAP.md` 已登記用途；正式頁與現有選擇船長流程尚未變動。
- 風險：收件目錄不影響遊戲；素材放入後仍須檢查尺寸、透明範圍、圓形角色孔與文字安全區，統一命名後才能接入正式頁。

#### 正式選擇本回合船長全螢幕介面

- 日期：2026-07-20。
- 範圍：檢查收件區兩張去背 WebP 的尺寸與 alpha，統一命名為 `captain_selection_panel_frame.webp`、`captain_selection_row_frame.webp` 並接入正式 `openCaptainSelectionModal()`。介面左側預覽目前點選船員的大圖、類型、等級、HP／PP／速度與被動，右側以共用橫列列出最多 4 名船員；點橫列只切換預覽，按「確認任命」後才改變船長。目前船長與瀕死船員會顯示狀態，瀕死船員維持不可選。主頁快取版本更新為 `20260720-captain-selection-ui-v1`。
- 檔案：`public/images/board/captain_selection_ui/captain_selection_panel_frame.webp`、`public/images/board/captain_selection_ui/captain_selection_row_frame.webp`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js` 與 HTML inline script 語法檢查；用正式頁、正式 CSS、正式 `openCaptainSelectionModal()` 與四名正式角色資料，在 Chrome 1440×900、1024×768 實際截圖檢查主框、角色窗、圓形頭像、四列內容、狀態、提示與雙按鈕，兩種 viewport 均無文件溢出。另實際觸發確認任命，確認 `activeCrewIndex` 由 0 改為 1；瀕死列及確認按鈕皆 disabled。正式頁與兩張素材確認 HTTP 200，並完成 `git diff --check`。
- 風險：只替換選擇船長的顯示與確認互動；不修改角色 id、船長效果、戰鬥上場規則、`activeCrewIndex` 欄位名稱、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 格式。任命後仍沿用既有 `renderAll()` 同步路徑。

#### 指定本回合步數 UI 素材收件目錄建立

- 日期：2026-07-20。
- 範圍：確認 1672×941 的「指定本回合步數」去背生成圖版面可用，外框、左側道具窗、名稱／說明區、右側兩排三列共六個步數框、底部提示及返回按鈕皆有獨立安全區；建立 `public/images/board/fixed_step_ui/incoming/` 作為素材收件位置。目前尚未改動或接入正式 `openFixedStepModal()`。
- 檔案：`public/images/board/fixed_step_ui/incoming/.gitkeep`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：以 Pillow 確認來源圖為 1672×941 RGBA，alpha 範圍 0～255 且包含 245243 個全透明像素；確認收件資料夾與文件登記存在，並執行 `git diff --check`。
- 風險：只新增素材收件資料夾與文件，不修改指定步數券 id、持有數、消耗、1～6 步規則、直接顯示路線的既有流程、存檔欄位或多人同步。素材放入並統一命名前不得由正式頁引用。

#### 正式指定本回合步數全螢幕介面

- 日期：2026-07-20。
- 範圍：檢查收件區 1672×941、含 alpha 的去背 WebP，統一命名為 `fixed_step_panel_frame.webp` 並接入正式 `openFixedStepModal()`。介面左側顯示指定步數券、目前持有數、道具說明及直接顯示路線提示；右側以兩排三列提供 1～6 步。點選步數後仍沿用既有道具扣除、`presetStep`、紀錄、重繪與 `rollDice()` 指定步數分支，直接進入可走路線／抵達格選擇，不再要求玩家另按骰子。主頁快取版本更新為 `20260720-fixed-step-ui-v1`。
- 檔案：`public/images/board/fixed_step_ui/fixed_step_panel_frame.webp`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：以正式 `board_game.html`、正式素材及正式 `openFixedStepModal()` 在 Chrome 1440×900 與 1024×768 實際截圖，逐區確認左側道具圖／名稱／說明、六個步數框、底部提示與返回背包按鈕都位於素材安全區，兩種 viewport 均完整留在畫面內。另執行 `node --check public/js/board_game.js`、HTML inline script 語法、正式頁／新版 JS／兩張道具與主框素材 HTTP、圖片尺寸與 alpha、`git diff --check`。
- 風險：只替換指定步數視窗的顯示結構與素材；不修改 `fixed_step` id、持有數、消耗數量、1～6 步規則、`presetStep` 欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 格式。

#### 背包道具選擇角色 UI 素材收件目錄建立

- 日期：2026-07-20。
- 範圍：建立 `public/images/board/backpack_target_ui/incoming/`，供「背包道具－選擇使用角色」全螢幕主框收件。預定版面包含左側道具圖／名稱／持有數／說明、右側最多四名船員的 2×2 選擇框、底部狀態提示與返回背包按鈕；目前尚未改動或接入正式 `openBackpackCrewTargetModal()`。
- 檔案：`public/images/board/backpack_target_ui/incoming/.gitkeep`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認收件資料夾與保留檔存在，並確認 `docs/FILE_MAP.md` 已登記用途；正式治療、進化、修行、招式補學、被動強化、修行重置與選人流程皆未變動。
- 風險：空收件目錄不影響遊戲；素材放入後仍須檢查尺寸、透明挖空、四個正圓頭像框及文字安全區，統一命名後才能接入正式頁。

#### 正式背包道具選擇角色全螢幕介面

- 日期：2026-07-20。
- 範圍：檢查收件區 1672×941 RGBA 去背 WebP，確認左側道具窗與四個角色頭像孔皆有透明 alpha 後，統一命名為 `backpack_target_panel_frame.webp` 並接入正式 `openBackpackCrewTargetModal()`。左側顯示道具圖、名稱、持有數及可捲動說明；右側以 2×2 固定框顯示最多四名船員的正圓頭像、名稱、階級／屬性、等級、HP、修行／進化狀態與不可用原因，右下沿用各模式原操作鍵。治療、進化、修行、招式補學、被動強化及修行重置共用此版面，返回背包與後續數量視窗仍沿用既有事件。主頁快取版本更新為 `20260720-backpack-target-ui-v1`。
- 檔案：`public/images/board/backpack_target_ui/backpack_target_panel_frame.webp`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：以正式 `board_game.html`、正式素材及正式 `openBackpackCrewTargetModal()`，分別用治療與修行模式、四名正式角色在 Chrome 1440×900、1024×768 實際截圖；確認四個頭像保持正圓並填滿挖空孔，名稱、狀態、不可用原因、操作鍵、左側道具資訊、底部提示及返回鍵皆位於素材安全區，兩種 viewport 都完整留在畫面內。另執行 JS、HTML inline script、正式頁／新版 JS／素材 HTTP、圖片尺寸與 alpha、`git diff --check`。
- 風險：只替換背包道具選人視窗的顯示結構與素材；不修改任何道具 id、數量、治療／修行／進化效果、目標判定、後續數量選擇、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 格式。

#### 背包道具選人六名上限暫時保護

- 日期：2026-07-20。
- 範圍：確認正式 `TEAM_LIMIT` 為 6，先前四格主框錯把多人 4 人上限當成船員上限。新六格素材完成前，將右側 2×2 角色區改為可垂直捲動的三列內容，第 5、6 名船員可捲入原有四個視窗並正常操作，不再被 `overflow:hidden` 隱藏；主頁快取版本更新為 `20260720-backpack-target-ui-v2`。最終素材仍須重做成 3×2 六格，讓六名船員同時可見。
- 檔案：`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認 `TEAM_LIMIT = 6`、角色清單仍由完整 `player.crew` 產生，CSS 第三列可垂直捲入可視區；執行 HTML inline script、正式頁／新版 JS HTTP 與 `git diff --check`。
- 風險：暫時只修正第 5、6 名船員的可達性；不修改隊伍上限、角色資料、道具目標判定、存檔或多人同步。四格美術仍不是最終六名同時顯示版。

#### 背包道具選人正式六格主框

- 日期：2026-07-20。
- 範圍：檢查使用者重做的 1671×941 RGBA 去背 WebP，確認左側道具窗及右側 3×2 六個圓孔皆有透明區後，替換正式 `backpack_target_panel_frame.webp`。角色區由暫時 2×2 可捲動排列改為 3×2 六格，完整 `TEAM_LIMIT = 6` 船員可同時顯示；重新校正六個正圓頭像、名稱、階級／屬性、狀態文字與右下操作鍵。主頁快取版本更新為 `20260720-backpack-target-ui-v3`。
- 檔案：`public/images/board/backpack_target_ui/backpack_target_panel_frame.webp`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用六名正式角色分別在 Chrome 1440×900、1024×768 開啟治療選人介面，逐格確認六個頭像保持正圓且填入透明孔、六個名稱／資訊／按鈕均在素材框內，並確認不需捲動即可同時看到第 1～6 名。另執行 HTML inline script、正式頁／新版 JS／素材 HTTP、圖片尺寸與 alpha、`git diff --check`。
- 風險：只替換六格素材與角色區排版；不修改 `TEAM_LIMIT`、角色資料、道具目標判定、治療／修行／進化效果、存檔或多人同步。

#### 背包道具選人六個圓形頭像逐欄校正

- 日期：2026-07-20。
- 範圍：依正式六格素材 alpha 孔位逐一量測六個透明圓的像素座標；修正原本所有卡片共用同一水平百分比，造成第二、三欄頭像逐欄偏左的問題。頭像容器改為固定 `aspect-ratio: 1/1` 的真正正圓，第一欄、第二欄、第三欄分別使用 5%、8%、9.4% 左距，並放大至 48% 覆蓋透明孔邊緣；上下兩排共用已驗證的垂直位置。主頁快取版本更新為 `20260720-backpack-target-ui-v4`。
- 檔案：`public/board_game.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：以六名正式角色在 Chrome 1440×900、1024×768 實際截圖，逐一檢查左中右三欄及上下兩排；六張角色圖皆置中填滿素材圓孔、保持正圓，沒有露出深藍孔底或壓住金框。另執行 JS、HTML inline script、正式頁／新版 JS HTTP 與 `git diff --check`。
- 風險：只修改六個角色頭像的 CSS 尺寸與逐欄水平位置；不修改角色圖路徑、角色資料、道具使用、存檔或多人同步。

#### 背包道具選人角色資訊三線逐欄對齊

- 日期：2026-07-20。
- 範圍：依正式六格素材每張角色卡右側的三條金色橫線，將資訊固定為三個獨立列：第 1 列階級／屬性、第 2 列 Lv／HP、第 3 列模式狀態或不可用原因；移除資訊列重複出現的角色名，並把原因留在第 3 列。以素材原始 1671×941 像素分別量測上下兩排金線位置，確認兩排三欄起點約為 x=727、1088、1440；角色卡改用逐欄 CSS 變數，三列直接共用同一實測左端，不再以巢狀百分比及 `<br>` 行高估算。第 2、3 列改成各自固定的 grid row 並取消 `overflow:auto`，不再出現需拖曳才能看字的內部捲軸。另將「要對誰使用……？」標題與副標整組由 2.7% 下移至 4.9%，避開標題框上緣及中央裝飾；左側道具名稱與持有數合併為單行「道具名稱*數量」，取消分欄造成的長名稱截斷，並放大道具說明字級、略減內距。角色名木牌與六個圓形頭像位置不變。主頁快取版本更新為 `20260720-backpack-target-ui-v11`。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/DEV_WORKFLOW.md`。
- 驗證：用六名正式角色及治療道具，在 Chrome 1440×900、1024×768 實際開啟正式選人 UI 並逐格對照三條金色橫線；六格的階級／屬性、Lv／HP、狀態原因均各自位於對應橫線正上方，第二、三欄水平起點亦落在各自資訊區內，沒有互疊或超框。另執行 JS、HTML inline script、正式頁／新版 JS HTTP 與 `git diff --check`。
- 風險：只修改背包道具選人視窗的資訊文字內容與 CSS 座標／字級；不修改角色名、階級、屬性、HP 數值、道具效果、目標判定、存檔或多人同步。

#### CPU 蒙其・D・龍戰鬥進場防卡

- 日期：2026-07-20。
- 範圍：修正 CPU 蒙其・D・龍進入戰鬥後可能停在全螢幕轉場、必須 F5 才恢復的時序問題。CPU 會立即略過戰前對話，而龍的開場被動「革命風暴」同時排入首次上場速度 +1 視覺事件；原流程可能在戰鬥覆蓋層尚未完成開啟時重繪並重啟轉場。現在開場被動視覺只會在覆蓋層同時具備 `open`、`ready` 且戰鬥 iframe 已載入後播放，尚未就緒時以短間隔等待；進場計時已建立時的重繪不再清除或重設該轉場，視覺播放失敗亦會解除動畫鎖。主頁快取版本更新為 `20260720-cpu-opening-passive-entry-fix-v1`。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、HTML inline script 語法檢查、正式入口／主遊戲／新版 JS HTTP 200 與 `git diff --check`。另以正式 `board_game.html?cpu4=1` 注入正式蒙其・D・龍與隨機一般敵島，模擬 CPU 立即略過戰前對話；在 Chrome 1440×900、1024×768 逐段觀察 0.1～5 秒轉場，兩種尺寸都先保留被動佇列，直到覆蓋層具備 `open`／`ready` 且 iframe `loaded=true` 後才播放 `passive-opening`，5 秒內演出與動畫鎖均結束。戰鬥層完整覆蓋 viewport、文件無水平或垂直溢出，瀏覽器例外為 0。
- 風險：只調整戰鬥進場與開場被動視覺的本機時序；不修改「革命風暴」的速度、開場階級或風／暴風傷害效果，不新增 `gameState`／`battleState` 欄位，不改角色 id、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 格式。其他具有開場被動的 CPU 角色亦會套用同一安全等待。

#### 治療道具使用數量 UI 素材收件目錄建立

- 日期：2026-07-20。
- 範圍：依正式 `openBackpackHealingQuantityModal()` 現有內容建立 `public/images/board/healing_quantity_ui/incoming/`，供單張 16:9 圖片式數量視窗收件。預定框位包含標題、正圓道具圖、道具名稱／持有數、目標角色／目前 HP、減少／數量／增加、最多有效數量／預計回復 HP，以及確認使用／返回選人；有效數量只有 1 時仍沿用現有直接使用，不開數量視窗。目前尚未改動或接入正式頁。
- 檔案：`public/images/board/healing_quantity_ui/incoming/.gitkeep`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認收件資料夾與 `.gitkeep` 存在，並確認 `docs/FILE_MAP.md` 已登記用途；正式治療道具選人、最大有效數量、預估回復、加減、消耗與返回流程均未變動。
- 風險：空收件目錄不影響遊戲；素材放入後仍須檢查尺寸、透明範圍、圓孔與文字安全區，再統一命名接入。此步不修改治療道具 id、回復數值、可用目標、數量計算、存檔或多人同步。

#### 正式治療道具使用數量圖片式介面

- 日期：2026-07-20。
- 範圍：檢查收件區 1672×941 RGBA 去背 WebP 的尺寸、alpha、正圓道具孔與各文字安全區，統一命名為 `healing_item_quantity_frame.webp` 並接入正式 `openBackpackHealingQuantityModal()`。介面顯示道具圖、名稱、持有數、目標角色目前／最大 HP、減少／數量／增加、最多有效數量、預計回復 HP，以及確定使用／返回選人；有效數量只有 1 時仍沿用原本直接使用。所有原事件 ID 與治療套用函式保留，主頁快取版本更新為 `20260720-healing-quantity-ui-v1`。
- 檔案：`public/images/board/healing_quantity_ui/healing_item_quantity_frame.webp`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check public/js/board_game.js` 通過；正式 `board_start.html`、`board_game.html` 與新素材皆以本機伺服器確認 HTTP 200。實際瀏覽器以 1440×900 桌機、1024×768 平板及 844×390 橫向手機進入航海背包、選擇小塊帶骨肉與目標船員；三種尺寸均無框位或視窗溢出。數量由 1 加到 2 時預覽由 60 更新為 120 HP，確定使用後角色 HP 由 1 變 121、持有數由 5 變 3；返回選人會關閉數量介面、回到原選人頁，且不扣道具也不改 HP。HTML 無可執行 inline script，`git diff --check` 已執行。
- 風險：本次只替換多數量治療視窗的圖片與排版；不修改道具 id、回復值、最大有效數量計算、只有 1 個時直接使用的分支、背包資料、`gameState` 欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 格式。

#### CPU 指令 UI 素材收件目錄建立

- 日期：2026-07-20。
- 範圍：確認「CPU 指令」16:9 全螢幕主框與可重複 CPU 玩家策略橫列兩張生成素材版面可用，建立 `public/images/board/cpu_strategy_ui/incoming/` 作為去背素材收件位置。主框包含標題、同步說明、最多三列內容區、房主／觀看提示與關閉按鈕；橫列包含正圓玩家頭像孔、CPU 名稱、策略說明、策略選擇及狀態小框。目前尚未改動或接入正式 `openCpuStrategyModal()`。
- 檔案：`public/images/board/cpu_strategy_ui/incoming/.gitkeep`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認新資料夾與 `.gitkeep` 存在，並確認 `docs/FILE_MAP.md` 已登記用途。正式頁右上「CPU指令」仍只在房間含 CPU 玩家時顯示，原本的均衡／升等／支援／主線四種策略、房主控制與多人同步均未變動。
- 風險：空收件資料夾不影響遊戲；素材放入後仍須檢查尺寸、透明範圍、正圓頭像孔及主框與橫列的實際比例，再統一命名接入。此步不修改 CPU 決策、策略 id、`gameState.settings`、房主權限、Socket.IO event 或 `BOARD_GAME_STATE` 格式。

#### 正式 CPU 指令圖片式介面

- 日期：2026-07-20。
- 範圍：將使用者提供的 1672×941 主框與重新生成的 2172×724 超寬 CPU 橫列框統一命名為 `cpu_strategy_panel_frame.webp`、`cpu_strategy_row_frame.webp`，接入正式 `openCpuStrategyModal()`。房間最多三名 CPU 各列顯示正圓頭像、名稱、目前策略說明、策略下拉選單與房主／觀看狀態；橫列依 alpha 可見範圍 2135×224（約 9.53:1）等比例裁切填入中央區，沒有橫向拉伸。CPU 名稱縮進上方名稱框金邊的安全區並水平／垂直置中，介面鎖定手機文字縮放，狀態文字則依素材小框中心定位。主頁腳本與橫列素材加入 `20260720-cpu-strategy-ui-v3`／`20260720-cpu-strategy-row-v2` 快取版本。
- 檔案：`public/images/board/cpu_strategy_ui/cpu_strategy_panel_frame.webp`、`public/images/board/cpu_strategy_ui/cpu_strategy_row_frame.webp`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：兩張正式素材皆為 RGBA WebP 且具有透明 alpha；主框 1672×941、橫列 2172×724。實際瀏覽器以 1440×900 桌機、1024×768 平板及 844×390 橫向手機建立 1 名真人加 3 名 CPU，確認主框、三列、頭像、名稱、說明、策略選擇與狀態均在框內，素材保持 3:1 原圖畫布比例並以透明區裁切顯示，正式素材請求 HTTP 200。平板上把第一名 CPU 從均衡改為主線後，`gameState.settings.cpuStrategyByPlayerId` 更新為 `objective`，說明同步顯示「優先拓本、四皇與最終之島，較少繞去補資源。」；關閉按鈕可正常返回。另執行 `node --check public/js/board_game.js`、HTML inline script 語法檢查與 `git diff --check`。
- 風險：本次只替換 CPU 指令視窗的圖片、排版與素材快取版本；不修改 `balanced`／`level`／`support`／`objective` 策略 id、CPU 決策、房主控制權、`gameState.settings.cpuStrategyByPlayerId` 結構、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 格式。橫列內容依三名 CPU 的正式上限配置，極窄直向手機仍建議橫向遊玩。

### 2026-07-21

#### 戰鬥前遭遇 UI 素材收件目錄建立

- 日期：2026-07-21。
- 範圍：確認使用者生成的 16:9 戰鬥前遭遇主框與獨立戰鬥指令按鈕框版面可用，建立 `public/images/board/encounter_ui/incoming/` 作為去背素材收件位置。這套素材預定共用於普通敵人島強制戰鬥、海格強制遭遇、敵人島強制加入共鬥，以及保留可略過規則的海格共鬥；四皇與司法島不納入此共用介面。
- 檔案：`public/images/board/encounter_ui/incoming/.gitkeep`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認資料夾與 `.gitkeep` 存在，並在 `docs/FILE_MAP.md` 登記用途。主框具備敵人圖片窗、名稱、六格情報、兩個資訊區與底部指令位置；按鈕框為單一獨立橫框，可重複用於進入戰鬥、繼續戰鬥、加入共鬥與略過。
- 風險：目前只建立素材收件位置，尚未接入正式 `openEnemyIslandModal()`、`openSeaEncounterEnemyPreview()` 或 `openCoopBattlePromptModal()`；不修改普通敵人島強制戰鬥、海格遭遇、共鬥選擇、偵查情報、戰鬥狀態、存檔或多人同步規則。

#### 正式戰鬥前遭遇圖片式介面

- 日期：2026-07-21。
- 範圍：檢查收件區主框 1672×941 RGBA WebP 與按鈕框 2172×724 RGBA WebP 的尺寸、透明範圍及文字安全區，統一命名為 `encounter_panel_frame.webp`、`encounter_action_button_frame.webp` 並接入正式普通敵人島、海格遭遇與同地點共鬥提示。共用版面將標題、角色圖、名稱、地點、六格情報、主要說明、規則／參戰名單及操作按鈕逐區定位；長名稱限制在各自框內省略，說明文字限制行數並保留安全內距。普通敵人島與海格遭遇仍只有進入／繼續戰鬥，敵人島共鬥仍只能加入，海格共鬥仍可加入或略過；四皇與司法島維持原介面。未開啟偵查效果時不顯示敵人圖、身份與數值。主頁快取版本更新為 `20260721-encounter-ui-v1`。
- 檔案：`public/images/board/encounter_ui/encounter_panel_frame.webp`、`public/images/board/encounter_ui/encounter_action_button_frame.webp`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check public/js/board_game.js` 通過；正式 `board_start.html`、`board_game.html` 與兩張正式素材確認 HTTP 200。以正式 `board_game.html`、正式 CSS／素材及代表性長敵人名稱，在 Chrome 1440×900 桌機與 1024×768 平板實際截圖；角色圖填滿左側窗口，六格情報、兩段長說明與按鈕均在素材安全區，兩種尺寸都沒有元素 scroll overflow。另檢查事件 ID 與原處理函式仍相連，並執行 HTML inline script 語法檢查與 `git diff --check`。
- 風險：本次只替換三種戰鬥前提示的圖片、文字排版及資料映射；不修改敵人島／海格強制戰鬥、海格共鬥略過、偵查解鎖、敵人生成、戰鬥建立、掉落、回合、CPU、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 格式。`docs/GAME_RULES.md` 不需更新，因遊戲規則與數值未變。

#### 戰鬥前遭遇標題置中微調

- 日期：2026-07-21。
- 範圍：普通敵人島、海格遭遇戰及敵人島／海格共鬥全部移除標題木牌內重複的「強制戰鬥／強制加入／可選擇加入或略過」小標，主標題改為單行並稍微下移至木牌中央；加入與略過方式直接由底部按鈕呈現。主頁快取版本更新為 `20260721-encounter-ui-v2`。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：執行 `node --check public/js/board_game.js`、HTML inline script 語法檢查、正式頁與新版 JS HTTP 200、桌機／平板實際瀏覽器版面檢查及 `git diff --check`。
- 風險：只調整普通敵人島、海格遭遇戰及共鬥畫面的標題文字與垂直位置；不修改強制戰鬥、共鬥加入／略過、敵人資料、偵查、戰鬥建立、存檔或多人同步規則。`docs/GAME_RULES.md` 不需更新，因規則未變。

#### 地圖情報與顛倒山 UI 素材收件目錄建立

- 日期：2026-07-21。
- 範圍：檢查使用者生成的兩張 1672×941 RGB PNG，確認第一張具備顛倒山固定五條航線、五個正圓徽章孔、規則說明與底部操作安全區；第二張具備島嶼／海格圖片孔、摘要、六格情報、羊皮紙說明、航線資訊與底部操作安全區。建立 `public/images/board/map_info_ui/incoming/`，供去背後統一收件、命名與正式接入。
- 檔案：`public/images/board/map_info_ui/incoming/.gitkeep`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用 System.Drawing 確認兩張原始 PNG 均為 1672×941、Format24bppRgb，並逐區檢查圖片孔、五列航線、六格情報、長文字安全區與底部按鈕區完整且未被裝飾遮擋；確認收件資料夾及 `.gitkeep` 已建立，`docs/FILE_MAP.md` 已登記用途。
- 風險：目前只建立素材收件位置，尚未接入正式 `inspectSeaTile()`、`inspectIsland()` 或 `openInversionMountainOverview()`；不修改偵查顯示、地圖標記、航線占用、島嶼狀態、存檔或多人同步規則。

#### 正式地圖節點情報與顛倒山五航線圖片式介面

- 日期：2026-07-21。
- 範圍：檢查使用者放入的兩張 1672×941 RGBA WebP，統一命名歸檔為 `map_node_info_panel_frame.webp` 與 `inversion_mountain_overview_frame.webp`。正式 `inspectSeaTile()`／`inspectIsland()` 改用共用圖片式節點情報主框，依既有偵查狀態顯示或遮蔽敵人資料，保留海格／島嶼標記按鈕；正式 `openInversionMountainOverview()` 改為固定五列航線，顯示編號、航路、目的地、可選擇／已占用與占用者。所有文字逐區限制在素材安全框內，主頁快取版本更新為 `20260721-map-info-ui-v1`。
- 檔案：`public/images/board/map_info_ui/map_node_info_panel_frame.webp`、`public/images/board/map_info_ui/inversion_mountain_overview_frame.webp`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check public/js/board_game.js` 通過；使用正式 `board_game.html` 在 Chrome 1440×900 桌機與 1024×768 平板，分別實際點擊一般島嶼、海上格及顛倒山。兩種尺寸的節點情報皆完整顯示六格資料，顛倒山皆完整顯示五條航線；modal、主要內容區與文件均無溢出，圓形節點圖保持正圓，右側「可選擇／尚未被占用」沒有截字。另確認正式頁、JS 與兩張素材 HTTP 200，完成 HTML inline script、素材路徑及 `git diff --check`。
- 風險：本次只替換三個既有查看流程的素材、資料排版與主頁快取版本；不修改偵查被動、海格／島嶼標記、航線數量、目的地、`claimedBranchRoutes`、回合、移動、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 格式。`docs/GAME_RULES.md` 不需更新，因遊戲規則與數值未變。

#### 地圖圓形島圖校正與敵島情報距離限制

- 日期：2026-07-21。
- 範圍：依 `map_node_info_panel_frame.webp` 實際圓形內圈重新校正正式節點圖的左、上、直徑與圖片縮放，避免島嶼圖壓到金框，並把透明／留白區的黑底改為海洋藍漸層。重新核對既有偵查型 1～3 階與偵查台 Lv3 規則後，將普通敵人島的敵人身份／階級／等級／屬性／類型／HP 限制為「具備偵查台 Lv3，且目標是目前所在島或位於目前偵查範圍」才可顯示；曾探索但已離開偵查範圍的敵島只顯示敵影。戰鬥前敵島提示與地圖、航線、節點情報共用相同判定；主頁快取版本更新為 `20260721-map-info-visibility-v2`。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check public/js/board_game.js` 通過，HTML inline script 數量為 0；正式 `board_start.html`、`board_game.html`、新版 JS 與節點主框素材均回應 HTTP 200。使用正式 `board_game.html` 在 Chrome 1440×900 桌機與 1024×768 平板實際點開羅格鎮節點情報，圓圖相對主框固定為左 9.82%、上 17.02%、直徑 26.02%，兩種尺寸都保持正圓、完整落在金框內並顯示海洋藍底，主框與頁面 X／Y 溢出皆為 0。另在正式 runtime 將同一普通敵島分別設為遠距已探索、目前所在及無偵查台 Lv3 三種情境：遠距不顯示敵名，目前所在且 Lv3 會顯示，無 Lv3 即使目前所在仍不顯示；最後執行 `git diff --check` 通過（僅出現既有其他檔案換行警告）。
- 風險：本次只收緊既有敵島情報顯示範圍並校正圖片位置；不改偵查型被動距離、偵查台等級、敵人生成、戰鬥、回合、移動、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 格式。

#### 手動存檔／讀檔 UI 素材收件目錄建立

- 日期：2026-07-21。
- 範圍：建立 `public/images/board/save_load_ui/incoming/`，供手動存檔／讀檔圖片式介面的五張去背素材收件。預定素材為存讀檔共用主面板、單張存檔資料卡、主要操作按鈕、次要／取消按鈕與刪除危險按鈕；目前尚未改動或接入正式 `saveManualGame()`、`openLoadGameModal()`、`loadManualGame()` 或 `deleteManualSave()`。
- 檔案：`public/images/board/save_load_ui/incoming/.gitkeep`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認收件資料夾與 `.gitkeep` 存在，並確認 `docs/FILE_MAP.md` 已登記用途；正式頁尚未引用任何 `save_load_ui/incoming/` 路徑。
- 風險：空收件目錄不影響遊戲；素材放入後仍須逐張檢查尺寸、alpha、透明邊界、比例及文字安全區，再統一命名接入。此步不修改存檔內容、`gameState`／`battleState`、`RECOVERED`、localStorage key、伺服器存檔 API、玩家身份重綁或 `BOARD_GAME_STATE` 同步流程。

#### 正式手動存檔／讀檔圖片式介面

- 日期：2026-07-21。
- 範圍：檢查使用者放入的五張 1536×1024 RGBA WebP，依用途統一命名為 `save_load_panel_frame.webp`、`save_record_card_frame.webp`、`save_load_primary_button_frame.webp`、`save_load_secondary_button_frame.webp` 與 `save_load_danger_button_frame.webp`，並移出 `incoming/` 收件區。正式存檔完成／失敗、讀檔搜尋／無存檔、單一存檔、本機與伺服器不同進度、讀檔失敗及刪除結果全部改用共用航海主框；標題、說明、存檔來源徽章、五列資料與底部按鈕文字皆依各自素材框置中。存檔卡顯示來源、時間、回合、目前玩家、目前階段與戰鬥狀態，雙進度時並列兩張卡，底部依原按鈕 ID 套用主要、次要與紅色刪除框。主頁快取版本更新為 `20260721-save-load-ui-v1`。
- 檔案：`public/images/board/save_load_ui/save_load_panel_frame.webp`、`public/images/board/save_load_ui/save_record_card_frame.webp`、`public/images/board/save_load_ui/save_load_primary_button_frame.webp`、`public/images/board/save_load_ui/save_load_secondary_button_frame.webp`、`public/images/board/save_load_ui/save_load_danger_button_frame.webp`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check public/js/board_game.js` 通過，HTML inline script 數量為 0；正式 `board_start.html`、`board_game.html`、新版 JS 與五張正式素材均回應 HTTP 200。以隔離的瀏覽器儲存空間及攔截的存檔 API，在正式 Chrome 1440×900 桌機與 1024×768 平板實際開啟存檔成功、存檔失敗、讀檔搜尋、無存檔、單一存檔、雙進度選擇、刪除結果；主框、存檔卡、按鈕與文件均無 X／Y 溢出。另實際點擊讀取伺服器與讀取本機按鈕，分別恢復測試存檔第 6 輪與第 1 輪，並執行素材路徑檢查及 `git diff --check`。測試未讀寫既有 localStorage 或伺服器存檔。
- 風險：本次只替換手動存檔／讀檔各狀態的圖片、文字排版與主頁快取版本；保留原按鈕 ID、存檔內容、`gameState`／`battleState`、`RECOVERED`、localStorage key、伺服器存檔 API、刪除範圍、玩家身份重綁、Socket.IO event 與 `BOARD_GAME_STATE` 同步流程。`docs/GAME_RULES.md` 不需更新，因遊戲規則與數值未變。

#### 手動存檔／讀檔按鈕文字置中校正

- 日期：2026-07-21。
- 範圍：依三張 1536×1024 按鈕 WebP 的實際不透明框範圍重新校正文字層。素材的有效按鈕框位於原圖約 Y=300～735，正式頁裁切後只占按鈕容器上方約 60%；文字層因此改為對齊這段可見框的垂直中心，水平仍依內側木板安全區置中。
- 檔案：`public/board_game.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用 alpha 閾值確認主要、次要與危險按鈕框的有效範圍，並在正式 `board_game.html` 的 Chrome 1440×900 桌機與 1024×768 平板重新開啟本機／伺服器雙進度畫面；四個按鈕文字均落在各自可見框的水平與垂直中心，主框及頁面無溢出。另執行 HTML inline script、正式頁 HTTP 200 與 `git diff --check`。
- 風險：只調整按鈕文字層位置；不修改按鈕 ID、事件處理、存檔、讀檔、刪除、localStorage、伺服器 API 或 `BOARD_GAME_STATE` 同步流程。`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新，因功能、規則與檔案職責未變。

#### 手動刪除存檔第二層確認

- 日期：2026-07-21。
- 範圍：正式單一存檔與本機／伺服器雙進度畫面的「刪除全部存檔」不再直接執行刪除，先開啟共用航海主框的不可復原警告，沿用既有紅色危險按鈕與深色次要按鈕；只有按下 `confirmDeleteSaveBtn` 才呼叫原 `deleteManualSave()`，按下 `cancelDeleteSaveBtn` 僅關閉警告。主頁 JS 快取版本更新為 `20260721-save-load-ui-v2`。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用隔離的瀏覽器儲存空間及攔截的存檔 API，在正式 Chrome 1440×900 桌機與 1024×768 平板從讀檔畫面實際點擊「刪除全部存檔」；警告主框、紅色確認與深色取消按鈕完整顯示且文字位於素材框中心。取消後本機存檔仍存在且未送出 DELETE；再次開啟並確認後才移除本機存檔、送出原伺服器刪除請求並顯示刪除結果。另執行 `node --check`、HTML inline script、正式頁／新版 JS HTTP 200 與 `git diff --check`。
- 風險：只新增刪除前的確認門檻；不修改實際刪除範圍、localStorage key、伺服器 API、存檔內容、讀檔、玩家身份重綁、Socket.IO event 或 `BOARD_GAME_STATE` 同步流程。`docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新，因遊戲規則、檔案與素材職責未變。

#### 初選階段關閉讀檔後恢復正式流程

- 日期：2026-07-21。
- 範圍：修正 `setup-order`／`setup-draft` 的正式讀檔入口覆蓋強制初選 modal 後，取消讀檔只執行 `closeModal()` 而使畫面失去操作入口的問題。`openLoadGameModal()` 現在記錄是否由初選階段開啟；取消、無存檔、讀檔失敗、刪除取消／結果確認或點擊航海主框外側時，先結束讀檔 session，再以 `openSetupStep({ skipOpeningStory: true })` 依現有 phase、轉盤結果與選角進度重新開啟順位、階級轉盤或角色候選介面。搜尋中的非同步讀檔以 session id 防止關閉後舊回應再次覆蓋初選畫面；成功讀取則先清除回復旗標，再沿用原本存檔 phase 流程。主頁 JS 快取版本更新為 `20260721-setup-load-resume-v1`。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用隔離的瀏覽器 localStorage 與攔截的存檔 API，在正式 Chrome 1440×900 桌機與 1024×768 平板進入 `setup-draft` 階級轉盤。從畫面內「讀取存檔」開啟正式圖片式讀檔後，分別實際按「取消」與點擊主框外側；兩條路徑都重新出現同一位玩家、同一輪的 `recruitRollBtn` 階級轉盤，modal 恢復 `draft-recruitment-modal` 強制初選狀態，等待舊 GET 回應後也不會再次跳回讀檔。另在 `setup-order` 順位確認畫面驗證取消與點擊外側均恢復 `confirmDraftOrderBtn`；從階級轉盤真正讀取 `setup-order` 存檔後則依存檔階段回到順位確認，而不是回復舊轉盤。最後執行 `node --check`、HTML inline script、正式頁／新版 JS HTTP 200 與 `git diff --check`。
- 風險：只補初選讀檔關閉後的 UI 回復與非同步 session 失效；不重擲階級、不重排順位、不改 `draftOrder`、`draftSequence`、`draftPickIndex`、`recruitRolls`、存檔內容、讀檔身份重綁、回合、CPU、Socket.IO event 或 `BOARD_GAME_STATE` 同步格式。`docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新，因規則、檔案與素材職責未變。

#### 海格事件圖片式介面素材收件目錄建立

- 日期：2026-07-21。
- 範圍：依正式 `resolveSeaTile()`、`openSeaEventChoice()`、`triggerSeaEvent()`、`spectatorSeaChoiceModal()` 與 `spectatorCardResultModal()` 確認海格事件 UI 範圍。非直接遭遇海格才進兩張類型卡選擇；選卡沿用畫面已預抽的 `effectDef`，一般金錢／天氣／藥物效果進結果確認，寶藏效果轉入既有四寶箱舞台，直接遭遇戰轉入既有遭遇提示。規劃兩張 1536×1024 RGBA WebP 主框：雙卡選擇主框與單卡揭曉／結果主框；另依使用者要求重做金錢、天氣、寶藏、藥物、未知／危險五張 1024×1536 直式事件卡，使卡片改為與正式新版 UI 相同的深色海洋、古木、黃銅金框與青綠寶石風格。操作按鈕沿用既有正式航海按鈕框。建立 `public/images/board/sea_event_ui/incoming/` 等待使用者放入去背素材。
- 檔案：`public/images/board/sea_event_ui/incoming/.gitkeep`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：以 `rg` 確認操作方、CPU selector 與觀看方共用的正式事件鏈，並核對 `SEA_CARD_BACK_IMAGE_MAP`、`SEA_EVENT_TYPE_INFO`、`seaChoiceReveal`、`seaChoiceTypeReveal`、`seaChoiceBattleRisk`、`resolutionLock`、`emitSpectatorModalEvent()` 與 `applyPostResolution()`；確認收件資料夾與 `.gitkeep` 已建立，正式頁尚未引用 `sea_event_ui/incoming/`。
- 風險：目前只建立素材收件位置與調整素材規劃，尚未修改海格抽選、權重、偵查揭露、效果、寶箱、遭遇戰、CPU、回合、存檔、Socket.IO event 或 `BOARD_GAME_STATE`。寶箱舞台與海格遭遇戰提示已完成，不納入本次重做；新卡片接入時會改 `SEA_CARD_BACK_IMAGE_MAP` 的正式顯示路徑，但維持 `money`、`weather`、`treasure`、`chest`、`medicine`、`encounter`、`unknown` 等穩定 id。

#### 正式海格事件二選一、揭曉與一般結果圖片式介面

- 日期：2026-07-21。
- 範圍：檢查使用者放入的兩張 1536×1024 RGBA WebP 主框與五張 1024×1536 RGBA WebP 直式事件卡，統一命名並移出 `incoming/` 收件區。正式 `openSeaEventChoice()` 改用雙卡主框、五種新版卡片及既有航海操作按鈕框；玩家可直接點卡或底部「選這張」，兩個入口仍保留相同 `data-sea-choice`／`data-sea-type`。一般金錢／天氣／藥物事件由單卡結果主框顯示類型、效果與航海結果；`spectatorSeaChoiceModal()` 與新的觀看方一般結果介面共用相同版型。`sea-result` 同步資料補上既有 `typeId` 對應的卡片顯示路徑，未新增同步狀態欄位。寶藏仍進既有四寶箱舞台，直接遭遇仍進既有遭遇提示。主頁快取版本更新為 `20260721-sea-event-ui-v1`。
- 檔案：`public/images/board/sea_event_ui/sea_event_choice_panel_frame.webp`、`public/images/board/sea_event_ui/sea_event_result_panel_frame.webp`、`public/images/board/sea_event_ui/sea_event_card_money.webp`、`public/images/board/sea_event_ui/sea_event_card_weather.webp`、`public/images/board/sea_event_ui/sea_event_card_treasure.webp`、`public/images/board/sea_event_ui/sea_event_card_medicine.webp`、`public/images/board/sea_event_ui/sea_event_card_unknown.webp`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check public/js/board_game.js` 通過。使用正式 `board_game.html` 與隔離的 Chrome 測試資料，在 1440×900 桌機與 1024×768 平板實際令玩家落在主要類型為天氣的海格，開啟雙卡選擇、直接點擊天氣卡、查看單卡揭曉結果並按下 `confirmSeaEventBtn`；兩種尺寸的主框、卡片、說明與按鈕皆在素材安全區，按鈕文字位於圖片框中央，modal 與文件均無 X／Y 溢出，所有 WebP `naturalWidth`／`naturalHeight` 正常且 runtime exception 為 0。確認後 `resolutionLock` 由 true 回到 false，原「前進 3 格」效果正常建立並繼續消耗 `pendingMove`。另完成 HTML inline script、七張新素材與共用按鈕路徑、正式頁／新版 JS HTTP 200 及 `git diff --check`。
- 風險：本次只替換海格事件選擇與一般結果的圖片、文字排版、觀看方顯示資料及快取版本；不修改 `SEA_CARD_TYPE_POOLS`、預抽 `effectDef`、偵查揭露、事件效果、四寶箱獎勵、遭遇戰、共鬥、回合、CPU 評分、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 格式。`docs/GAME_RULES.md` 不需更新，因規則與數值未變。

#### 海格事件雙卡背景比例與卡片邊界校正

- 日期：2026-07-21。
- 範圍：依實際主框與五張直式卡的透明邊界修正二選一畫面比例。雙卡背景主框由原生 3:2 顯示改為縱向拉伸至 1.13:1，使主框內兩個卡槽的可見比例與直式事件卡一致；事件卡圖片另外依共同 RGBA 透明留白放大 121.5%，讓卡片金框的實際不透明邊界精準落在卡槽四邊，不再超出下緣或在左右留下不一致空隙。單卡結果主框維持原本 3:2，但套用相同透明邊界校正。主頁快取版本更新為 `20260721-sea-event-ui-v2`。
- 檔案：`public/board_game.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用正式 `board_game.html` 在隔離 Chrome 測試環境重跑天氣／藥物與天氣／寶藏兩組二選一。1440×900 桌機的雙卡主框為 966.1×855，1024×768 平板則完整置於 95% 視窗高度；兩張卡的可見 RGBA 邊界皆貼合主框卡槽，說明區與底部按鈕仍維持原位置。另實際點開天氣結果，確認單卡外框也貼合左側卡槽；兩種尺寸均無 modal 或文件 X／Y 溢出，runtime exception 為 0。
- 風險：只調整海格事件主框顯示比例、卡片透明留白縮放與快取版本；不修改卡片 id、抽選、效果、偵查、CPU selector、觀看方資料、回合、存檔或多人同步。`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新，因正式功能、規則及檔案職責未變。

#### 海格事件背景包覆與深色留邊

- 日期：2026-07-21。
- 範圍：依使用者回饋再放大二選一背景主框，主框顯示比例由 1.13:1 調整為 1.28:1；卡牌本身不跟著背景放大，透明畫布校正由 121.5% 收至 116%，讓雙卡金框完整落在背景卡槽內，四周保留可辨識的深黑海軍藍底。單卡結果畫面也使用 116% 卡片校正，保留少量深色包覆邊界。主頁快取版本更新為 `20260721-sea-event-ui-v3`。
- 檔案：`public/board_game.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：在正式 `board_game.html` 以 Chrome 1440×900 與 1024×768 實際觸發海格二選一及天氣結果。桌機雙卡主框為 1094.4×855，平板為 933.9×729.6；卡片金框均完整位於背景卡槽內，左右與上下可見深色底，說明框及按鈕未位移。單卡結果左側也保留相同深色包覆感；modal、文件皆無 X／Y 溢出，runtime exception 為 0。
- 風險：只調整背景主框寬度、卡片視覺縮放與快取版本；不修改素材檔、事件卡資料、抽選、效果、CPU、觀看方、回合、存檔或多人同步。`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 海格事件背景最大化與雙卡獨立置中

- 日期：2026-07-21。
- 範圍：依使用者回饋將二選一背景主框放大至視窗寬 97%、高 95%，取消固定長寬比，讓桌機與平板都使用接近可用視窗上限的背景面積。由於素材中的左右卡槽中心並非完全鏡像，兩張卡不再共用同一個水平偏移：左卡使用卡片區內 `left: 5.35%`，右卡使用 `left: 10.5%`；另將卡片下移卡片區高度的 0.45%，使兩張卡各自對準背景卡槽的水平與垂直中心。主頁快取版本更新為 `20260721-sea-event-ui-v4`。
- 檔案：`public/board_game.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用正式 `board_game.html` 在 Chrome 1440×900 與 1024×768 實際觸發雙卡選擇。桌機背景為 1396.8×855，平板為 992×729.6；依素材卡槽中心比例量測，桌機左右卡水平中心誤差分別為 +0.04px／-0.04px，平板為 +0.03px／-0.04px，平板垂直中心誤差均為 +0.05px。兩個尺寸均保留明顯深色底，modal 與文件無 X／Y 溢出，runtime exception 為 0。
- 風險：只調整二選一主框顯示尺寸、左右卡片視覺定位與快取版本；不修改卡片資料、選擇器、事件抽選、效果、CPU、觀看方、回合、存檔或多人同步。`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 海格事件背景上下滿版與卡牌四向留邊

- 日期：2026-07-21。
- 範圍：依追加回饋將二選一背景主框高度由視窗高 95% 拉長至 100%，並覆寫共用 `max-height` 為 `100dvh`，使背景在桌機與平板都完整延伸至畫面上下緣。卡片透明畫布校正由 116% 收至 110%，在維持左右卡槽獨立置中的同時，讓卡片金框上、下、左、右都保留清楚的深色背景。主頁快取版本更新為 `20260721-sea-event-ui-v5`。
- 檔案：`public/board_game.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用正式 `board_game.html` 在 Chrome 1440×900 與 1024×768 實際觸發雙卡選擇。桌機背景為 1396.8×900、平板為 992×768，均從畫面上緣延伸至下緣；左右卡水平中心誤差維持 +0.04px／-0.04px 以內，垂直中心誤差為 +0.05px 以內，四向皆可見深色包覆底。modal 與文件無 X／Y 溢出，runtime exception 為 0。
- 風險：只調整二選一背景高度、卡片視覺縮放與快取版本；不修改事件卡資料、選擇器、抽選、效果、CPU、觀看方、回合、存檔或多人同步。`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 海格事件等比例卡牌背框

- 日期：2026-07-21。
- 範圍：依使用者釐清的需求，不再以整體主背景的拉伸比例充當卡牌留邊；左右卡槽各新增一個獨立 `.sea-event-choice-card-backing` 深色背框。背框固定為與卡牌可見金框相同的直式 `0.683:1` 比例，卡牌置於背框內側 4%，寬高均為背框的 92%，因此背景只比卡牌大一圈且四邊均露出深黑海軍藍底。左右背框仍分別對準素材卡槽中心，玩家卡片按鈕與觀看方唯讀卡片共用相同結構；`data-sea-choice`／`data-sea-type` 保留在原卡片按鈕。主頁快取版本更新為 `20260721-sea-event-ui-v6`。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用正式 `board_game.html` 在 Chrome 1440×900 與 1024×768 實際觸發雙卡選擇。桌機背框／卡牌比例為 0.6830／0.6814，四邊留底約左右 11.8px、上下 16.9px；平板比例為 0.6830／0.6811，留底約左右 10.2px、上下 14.5px。兩種尺寸的卡牌與背框中心誤差皆不超過 0.01px，modal 與文件無 X／Y 溢出，runtime exception 為 0。
- 風險：只新增卡牌背框的顯示結構、樣式及快取版本；不修改事件卡素材、資料 id、選擇器、抽選、效果、CPU、觀看方同步資料、回合、存檔或多人同步。`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 海格事件原生背景方格四邊等距校正

- 日期：2026-07-21。
- 範圍：依使用者再次釐清，移除前一版額外建立的深色卡牌背框，改由雙卡主背景素材內原有的左右金色方格直接包住卡牌。卡牌使用不繪製背景的 `.sea-event-choice-card-position` 獨立置中；二選一主框調整為 `1.2236:1`，卡片定位框高度調整為卡片區的 67.66%、上緣 7.82%，使仍維持 `0.683:1` 的卡牌到原背景金框內緣在上、下、左、右保留相同視覺距離。依兩次追加要求，四邊露出的原背景距離先增加原始尺寸的 0.5 倍、再增加 0.3 倍，總計調為原版的 1.8 倍。主頁快取版本更新為 `20260721-sea-event-ui-v11`。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用正式 `board_game.html` 的同一套正式 HTML／CSS，在隔離 Chrome 以 1440×900 桌機與 1024×768 平板檢查雙卡畫面。桌機主框約為 1101.2×900、平板主框約為 939.7×768；兩張卡均保持 `0.683:1` 並置於各自原生方格中央。依主框素材內原生卡槽的可見邊界量測，卡牌到金框內緣在桌機四邊約 32.4px、平板四邊約 27.6px；modal 與文件均無 X／Y 溢出。
- 風險：只移除誤加的視覺背框並調整二選一主背景比例、卡片大小與定位；不修改事件卡素材、資料 id、`data-sea-choice`／`data-sea-type`、抽選、效果、CPU、觀看方同步資料、回合、存檔或多人同步。`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新，因正式功能、規則、素材與檔案職責未變。

#### 海格事件卡牌下緣留底視覺校正

- 日期：2026-07-21。
- 範圍：依實畫面回饋保留目前卡牌上緣位置 `top:7.82%` 不動，將卡片定位框高度由卡片區的 67.66% 收為 66.6%；卡牌仍維持 `0.683:1` 等比例並以各自原生方格的水平中心定位。這項校正只把可見卡牌下緣往上收，使背景金框下方露底增加、視覺距離與使用者認可的上方留底一致。主頁快取版本更新為 `20260721-sea-event-ui-v12`。
- 檔案：`public/board_game.html`、`docs/DEV_WORKFLOW.md`。
- 驗證：使用正式 `board_game.html` 的同一套正式 HTML／CSS，在隔離 Chrome 以 1440×900 桌機與 1024×768 平板檢查雙卡畫面。卡牌上緣位置維持不變，可見下緣分別往上收約 5.1px／4.4px；兩張卡的水平中心誤差不超過 0.02px，modal 與文件均無 X／Y 溢出。
- 風險：只調整二選一卡牌的視覺高度與快取版本；不修改卡槽背景素材、事件卡素材、資料 id、選擇器、抽選、效果、CPU、觀看方、回合、存檔或多人同步。`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 醫院圖片式介面素材收件目錄建立

- 日期：2026-07-22。
- 範圍：依正式 `resolveLanding()`、`openHospitalModal()`、`finishIslandServiceTurn()` 與 CPU 醫院處理流程確認醫院介面範圍。現行醫院只有 `full_crew_restore` 一項免費服務，會恢復全隊 HP、所有招式 PP、清除能力階級並結束回合；原按鈕為「全隊恢復」與「離開醫院」，治療後沿用既有行動通知，不新增結果視窗。規劃醫院主框、最多六名船員共用的治療狀態卡、主要治療按鈕與次要離開按鈕共四張 WebP，建立 `public/images/board/hospital_ui/incoming/` 等待使用者放入去背素材。
- 檔案：`public/images/board/hospital_ui/incoming/.gitkeep`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認收件資料夾與 `.gitkeep` 存在，`docs/FILE_MAP.md` 已登記根目錄與收件用途；正式 `board_game.html`／`board_game.js` 尚未引用 `hospital_ui/incoming/`。
- 風險：本次只建立素材收件位置與記錄圖片規劃，尚未修改 `openHospitalModal()`、`HOSPITAL_SERVICES`、HP／PP／能力階級恢復、免費費用、任務事件、回合、CPU、存檔、Socket.IO event 或 `BOARD_GAME_STATE`。正式接入前會逐張檢查尺寸、Alpha、透明邊界與文字安全區。

#### 正式醫院圖片式介面

- 日期：2026-07-22。
- 範圍：檢查使用者放入的四張 RGBA WebP，固定命名並移出 `incoming/` 收件區。正式 `openHospitalModal()` 改用 1672×941 醫療航海主框、最多六名船員共用的狀態卡、主要恢復按鈕與次要離開按鈕；左側顯示醫院島圖與既有免費整備說明，右側 3×2 六格顯示角色圖、名稱、等級、HP、PP 與瀕死／需要整備／狀態良好。主標、副標、醫院圖、船員圖、狀態文字及兩個按鈕文字均依素材可視框置中；按鈕保留原 `data-hospital-service="full_crew_restore"` 與 `leaveHospitalBtn`，CPU 仍使用相同 selector。觀看方新增既有 `spectator-modal` 的 `hospital` 分支，共用同一版型但只顯示「等待操作／關閉觀看」，不提供治療操作。主頁 JS 快取版本更新為 `20260722-hospital-ui-v1`。
- 檔案：`public/images/board/hospital_ui/hospital_panel_frame.webp`、`public/images/board/hospital_ui/hospital_crew_status_card_frame.webp`、`public/images/board/hospital_ui/hospital_primary_button_frame.webp`、`public/images/board/hospital_ui/hospital_secondary_button_frame.webp`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check public/js/board_game.js` 與 HTML inline script 語法檢查通過；四張正式 WebP 路徑存在且 16 個醫院畫面圖片節點均成功載入。正式 `board_game.html` 在隔離 Chrome 以 1440×900 桌機與 1024×768 平板實際開啟醫院，主框分別約為 1397×786 與 992×558，六格船員卡、角色圖、服務說明及兩個按鈕均在素材安全區，主標／副標水平置中，六張角色圖水平中心誤差不超過 0.01px，兩個按鈕文字水平中心誤差為 0、垂直中心依可視框校正為 -1px，頁面與 modal 無溢出。實際點擊「全隊恢復」後六名船員 HP／所有招式 PP 全滿、能力階級歸零、視窗關閉並進入下一回合；實際點擊「離開醫院」後船員 HP／PP／能力階級完全不變，只關閉視窗並進入下一回合。另以正式大廳建立兩人房，在第二個 Chrome 視窗確認觀看方收到六格唯讀醫院介面、九個醫院 UI 素材節點均載入、沒有 `data-hospital-service` 操作按鈕且可正常關閉，兩窗 runtime exception 均為 0；正式入口／新版 JS／四張素材 HTTP 200 與 `git diff --check` 亦通過。
- 風險：本次只替換醫院的圖片、排版及觀看方呈現；不修改 `HOSPITAL_SERVICES`、免費費用、HP／PP／能力階級恢復、任務事件、回合結束、CPU 判斷、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 格式。`docs/GAME_RULES.md` 不需更新，因規則與數值未變。

#### 司法島進入／參戰確認圖片式介面素材收件目錄建立

- 日期：2026-07-22。
- 範圍：依正式 `resolveLanding()`、`openJudicialRaidModal()`、`startJudicialRaid()` 與 `joinJudicialRaid()` 確認司法島進入介面的三種狀態。尚未開戰或失敗重置時顯示「發起討伐／暫不挑戰」；進行中依玩家參戰紀錄顯示「加入討伐／繼續司法島討伐／整備後重新加入」與「暫不加入」；已通關時顯示「再次發起討伐／離開」。主操作在全隊無存活船員時維持 disabled。畫面還須容納斯潘達姆、布魯諾、卡莉法、加布拉、卡古、羅布・路基六階進度、目前敵人共享 HP，以及最多四名玩家的狀態、加入階段、傷害、承傷、治療與行動次數。規劃一張 1672×941 RGBA WebP 主框、一張 1536×512 RGBA WebP 六階段共用框及一張 1536×512 RGBA WebP 參戰玩家共用框；司法島圖、既有敵人正常圖與正式航海操作按鈕框直接沿用。建立 `public/images/board/judicial_raid_ui/incoming/` 等待使用者放入去背素材。
- 檔案：`public/images/board/judicial_raid_ui/incoming/.gitkeep`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：以 `rg` 核對三種 modal 分支、`hasLivingCrew` disabled 條件、`JUDICIAL_RAID_PHASES` 六階順序、`judicialRaidPhaseLine()`、`judicialRaidParticipantRows()`、共享 HP 的參戰人數倍率，以及 CPU／自動觀察流程沿用的 `startJudicialRaidBtn`、`joinJudicialRaidBtn`；確認收件資料夾與 `.gitkeep` 已建立，正式頁尚未引用 `judicial_raid_ui/incoming/`。
- 風險：目前只建立素材收件位置與圖片規劃，尚未修改司法島階段、敵人、共享 HP、參戰人數倍率、獎勵、回合交棒、CPU、存檔、Socket.IO event 或 `BOARD_GAME_STATE`。`docs/PROJECT_OVERVIEW.md` 與 `docs/GAME_RULES.md` 不需更新，因正式功能與規則尚未變動。

#### 正式司法島進入／參戰確認圖片式介面

- 日期：2026-07-22。
- 範圍：檢查使用者放入的 1672×941 主框與兩張 1536×512 共用框，確認 RGBA 透明邊界後固定命名並移出 `incoming/`。正式 `openJudicialRaidModal()` 的尚未開戰／失敗重置、進行中與已攻破三種分支改用同一司法要塞版型：左側放既有司法島圖或目前階段敵人正常圖及共享 HP，右上以 3×2 顯示斯潘達姆、布魯諾、卡莉法、加布拉、卡古、羅布・路基六階進度，右下以 2×2 顯示最多四名玩家的狀態、加入階段、傷害、承傷、治療與行動。階段框與玩家框保持原生 3:1 比例縮入主框既有槽位，人物圓孔不拉成橢圓；主標、副標、左側圖片、資訊與按鈕文字依各素材實際可視框置中。保留原 `startJudicialRaidBtn`、`joinJudicialRaidBtn`、`restartJudicialRaidBtn`、`skipJudicialRaidBtn`、`leaveJudicialRaidBtn` 及全隊瀕死 disabled。觀看方新增既有 `spectator-modal` 的 `judicial-raid` 唯讀分支，共用相同版型但只顯示等待與關閉觀看。主頁 JS 快取版本更新為 `20260722-judicial-raid-ui-v1`。
- 檔案：`public/images/board/judicial_raid_ui/judicial_raid_panel_frame.webp`、`public/images/board/judicial_raid_ui/judicial_raid_phase_frame.webp`、`public/images/board/judicial_raid_ui/judicial_raid_participant_frame.webp`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check public/js/board_game.js` 與 HTML inline script 語法檢查通過。正式 `board_game.html` 在隔離 Chrome 以 1440×900 桌機與 1024×768 平板實際開啟尚未開戰、討伐進行中及已攻破畫面；主框分別約為 1397×786 與 992×558，六階段、四名玩家、左側司法島／敵人、共享 HP 與兩個操作按鈕均在素材安全區，文件與 modal 無溢出。主標位於主木牌中心，副標位於獨立長框中心；六個敵人圖與四個玩家頭像相對各自卡框垂直中心誤差不超過 0.01px，兩個按鈕文字相對可視框水平中心誤差為 0、垂直中心誤差不超過 0.12px，三張正式司法島 UI 素材均成功載入。實際按下「暫不挑戰」與「離開」均只關閉視窗並進入下一回合；「發起討伐」、「加入討伐／繼續」與「再次發起討伐」均建立原 `isJudicialRaid` 戰鬥並保留共享進度，加入者寫入原參戰紀錄；全隊瀕死時「發起討伐」維持 disabled。另由正式大廳建立兩人房，第二個 Chrome 視窗收到六階段唯讀畫面、沒有發起／加入／再次討伐控制，關閉觀看正常，操作方發起後兩窗 `battleState.isJudicialRaid` 同步一致且 runtime exception 為 0。正式入口／新版 JS／三張素材 HTTP 200 與 `git diff --check` 亦通過。
- 風險：本次只替換司法島進入／參戰確認的圖片、排版及觀看方呈現；不修改 `JUDICIAL_RAID_PHASES`、敵人資料、共享 HP 人數倍率、階段進度、參戰重入、獎勵、任務、回合交棒、CPU 決策、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 格式。`docs/GAME_RULES.md` 不需更新，因規則與數值未變。
#### 正式島嶼縮圖海洋藍背景統一

- 範圍：檢查 `public/board_game.html` 與 `public/js/board_game.js` 內正式流程實際使用 `ISLAND_IMAGE_MAP` 的島嶼縮圖容器。
- 地圖節點情報 `.map-node-visual` 已使用海洋藍漸層，維持既有校正尺寸與敵人情報顯示規則不變。
- 醫院 `.hospital-service-visual` 與司法島未開戰時 `.judicial-raid-feature-visual.is-island` 統一使用相同海洋藍漸層（`#4aa8ca` → `#176889` → `#0a3853`），避免透明島圖露出深青黑／深藍黑底。
- 司法島開戰後顯示的是敵人肖像，不屬於島嶼縮圖，因此保留原有深色肖像背景；主地圖島圖則維持透明疊在既有海面上的呈現方式，避免增加不必要的色塊。
- 本次只調整正式 UI 背景色；島嶼圖片、規則、資料 id、存檔結構、`BOARD_GAME_STATE` 與事件同步均未變更。
- 驗證：正式 `board_game.html` 由隔離 Chrome 實際開啟醫院與司法島未開戰介面；1440×900 桌機及 1024×768 平板均顯示相同三段海洋藍漸層，島圖載入成功、透明邊緣無黑底且 modal 水平／垂直溢出皆為 0。另切換司法島圖片類別確認敵人肖像仍使用原深色漸層，runtime exception 為 0。

#### 海上列車黃金票目的地 UI 素材收件準備

- 日期：2026-07-22。
- 正式入口確認：玩家在「航海背包 → 關鍵物品」選取 `sea_train_golden_ticket` 並按「使用」，由既有 `use_sea_train_ticket:<itemId>` 動作進入 `openSeaTrainGoldenTicketModal()`。
- 原流程保留：固定目的地為水之七島；已標記島嶼時再顯示標記站；玩家位於島上時可「標記目前島／改標記目前島」；依所在位置動態顯示「搭乘到…／進入…」，並保留「取消」返回關鍵物品背包。最多同時出現兩張目的地卡與四個操作按鈕。
- 素材規劃：建立 `public/images/board/sea_train_ticket_ui/incoming/`，預計收取一張 1672×941 RGBA 主框與一張 1536×512 RGBA 共用目的地卡框；海上列車黃金票、島嶼縮圖、海上列車動態圖與底部按鈕沿用既有正式素材，不重複生成。
- 目前只建立收件目錄與文件索引，尚未接入正式頁；不修改黃金票取得、標記、移動、落點結算、回合、CPU、道具數量、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。

#### 正式海上列車黃金票目的地圖片式介面

- 日期：2026-07-22。
- 範圍：檢查使用者放入的 1672×941 與 1536×512 RGBA WebP，依用途固定命名為 `sea_train_ticket_panel_frame.webp`、`sea_train_destination_card_frame.webp` 並移出 `incoming/`。正式 `openSeaTrainGoldenTicketModal()` 改用黃金票主框：左側沿用既有黃金票道具圖，中央顯示目前位置、標記終點與固定車站，右側依原狀態顯示一或兩張標記站／水之七島目的地卡；島圖使用與地圖情報一致的海洋藍漸層，保持正圓並對準卡框透明孔。底部沿用正式遭遇按鈕框，保留原 `seaTrainMarkBtn`、`seaTrainCancelBtn` 與 `data-sea-train-destination`。主標、副標、三列狀態、島圖、卡片文字及按鈕文字均依圖片內實際可見框置中。主頁快取版本更新為 `20260722-sea-train-ticket-ui-v1`。
- 檔案：`public/images/board/sea_train_ticket_ui/sea_train_ticket_panel_frame.webp`、`public/images/board/sea_train_ticket_ui/sea_train_destination_card_frame.webp`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check public/js/board_game.js` 與 HTML inline script 語法檢查通過。正式 `board_game.html` 在隔離 Chrome 以 1440×900 桌機及 1024×768 平板，分別實際開啟未標記與已將羅格鎮標記為目的地的畫面；四種畫面均無 modal／文件溢出，所有圖片成功載入，島圖為海洋藍正圓。按鈕文字相對可視框的桌機中心誤差為 0px，平板水平誤差不超過 0.01px、垂直誤差為 0px。實際按取消會回重要道具背包；標記後重新開啟會由一張目的地卡變成羅格鎮與水之七島兩張；點水之七島會播放既有海上列車動畫並抵達 `island-24`，runtime exception 為 0。
- 風險：本次只替換黃金票目的地選擇的圖片與排版；不修改 `sea_train_golden_ticket` id、取得或消耗、固定站、玩家標記欄位、目的地名稱、動畫、落點結算、回合、CPU、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 格式。`docs/GAME_RULES.md` 不需更新，因規則與數值未變。

#### 多人開局導頁本機身分保留

- 日期：2026-07-22。
- 範圍：雙視窗驗證黃金票到站同步時，確認 `BOARD_NAV_GAME` 廣播攜帶的是房間共用 lobby，不包含針對各 client 的 `isMe`；原導頁處理直接 `shared.saveLobby(lobby)`，使 `board_game.html` 的 `storedLobbyProfile()` 可能回退選到房主，並以房主 `clientId` 覆蓋觀看方本機 id。導頁前改呼叫現有 `saveAndRenderLobby(lobby)`，依本機 `profile.userId` 重建 `isMe` 並只為自己的 player 保留 `profile.clientId`；`board_start.js` 快取版本更新為 `20260722-nav-identity-v1`。
- 檔案：`public/js/board_start.js`、`public/board_start.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：由正式 `board_start.html` 建立兩人房、第二位玩家加入並 ready、房主開始遊戲；兩個獨立 Chrome context 進入 `board_game.html?online=1` 後保有不同 `clientId`，兩端套用相同房主完整快照。房主由正式航海背包開啟黃金票 UI 時，觀看方沒有私人目的地操作 modal；房主搭乘到水之七島後，兩端同一玩家位置皆為 `island-24`、同步版本一致、伺服器 ack 為 `ok`，兩窗 runtime exception 均為 0。
- 風險：只修正大廳到主遊戲的本機身分標記交接；不修改 `BOARD_NAV_GAME`、`BOARD_JOIN_GAME`、`BOARD_GAME_STATE` 名稱或 payload，不新增 lobby／`gameState` 欄位，不更動 userId／clientId 產生方式、房主權限、回合控制、存檔或遊戲規則。`docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新，因規則及檔案職責未變。

#### 水之七島船塢總覽／永久升級 UI 素材收件準備

- 日期：2026-07-22。
- 正式入口確認：玩家落在水之七島 `island-24`，或在船隻資訊按下 `openShipDockBtn`，由 `openWaterSevenWindow()` 以全畫面 iframe 開啟 `board_water_seven.html?board=1&ship=<shipId>&lockShip=1`。正式頁以 `getWaterSevenView()` 提供玩家船隻、貝里、四種船材、五項升級、四孔裝備與背包船隻道具，再以既有 `water-seven-command` 回傳升級、開孔、裝備與卸下操作。
- 保留定位：不更動六艘船的 `shipConfigs`、各視角船圖、camera、船圖切換動畫、`sail`／`watchtower`／`training`／`kitchen`／`rudder` 五個既有部位錨點、SVG 連線、四個 `slotTune` 孔位座標或 F4 校準資料。新版主框必須以透明船隻舞台包住既有定位，不可為了配合素材移動船圖或重算部位。
- 素材規劃：建立 `public/images/board/water_seven_ui/incoming/`，第一階段收取一張 1672×941 RGBA 船塢／永久升級主框、一張 1536×640 RGBA 共用船隻部位標記框，以及一張 1536×512 RGBA 共用升級效果列框。保利、六艘船、四種船材道具圖與正式操作按鈕沿用既有素材，不重複生成。
- 檔案：`public/images/board/water_seven_ui/incoming/.gitkeep`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認收件資料夾與 `.gitkeep` 已建立，`docs/FILE_MAP.md` 已區分現有船圖／定位素材與新版 UI 收件用途；正式 `board_water_seven.html`、`public/js/board_game.js`、船隻規則、定位及同步資料尚未修改。
- 風險：目前只建立素材收件位置與圖片規劃；不修改永久升級效果／費用、開孔、船隻裝備、S 級限制、材料、玩家船型、關閉後結束回合、localStorage key、iframe command、Socket.IO event 或 `BOARD_GAME_STATE`。

#### 正式水之七島船塢總覽／永久升級圖片式介面

- 日期：2026-07-22。
- 範圍：驗收使用者放入的三張 RGBA WebP，確認透明船隻舞台與透明人物孔後，固定命名為 `water_seven_shipyard_upgrade_panel_frame.webp`、`water_seven_ship_part_marker_frame.webp`、`water_seven_upgrade_effect_row_frame.webp` 並移出 `incoming/`。正式 `board_water_seven.html` 第一階段改為同一張 1672×941 船塢總覽主框：左側沿用保利人物圖與原說明，中央沿用目前玩家船型、五個升級部位與部位切換，右側顯示所選部位名稱、說明、Lv1～Lv3 效果、啟用狀態、下一級費用與原升級按鈕；底部顯示貝里、四種船材與目前全隊效果。五個部位使用共用 12:5 標記框，三級效果使用共用 3:1 列框，操作按鈕沿用正式航海按鈕框；標題、保利說明、部位名稱／標籤／等級、效果文字／狀態、資源數值與按鈕文字均依素材可視框置中。主頁與 iframe 快取版本更新為 `20260722-water-seven-upgrade-ui-v1`。
- 定位保留：未修改六艘船的 `shipConfigs`、視角圖片、camera、focus、轉向動畫、SVG 船體錨點、四個 `slotTune` 孔位與 F4 校準輸出；五個部位標記中心仍為桅杆 `17%／18%`、偵查台 `82%／18%`、修行場 `17%／53%`、廚房 `30%／78%`、船尾 `75%／75%`。新增的圖片框只包住既有按鈕位置，沒有重算船隻或部位座標。
- 檔案：`public/images/board/water_seven_ui/water_seven_shipyard_upgrade_panel_frame.webp`、`public/images/board/water_seven_ui/water_seven_ship_part_marker_frame.webp`、`public/images/board/water_seven_ui/water_seven_upgrade_effect_row_frame.webp`、`public/board_water_seven.html`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check public/js/board_game.js` 與 `board_game.html`／`board_water_seven.html` inline script 語法檢查通過；正式入口、主遊戲、版本化 JS、Water Seven iframe 與三張新素材皆為 HTTP 200。隔離 Chrome 以 1440×900 桌機及 1024×768 平板實際顯示新船塢，三張效果列、五個部位框、五項改造資源、保利及船圖全部載入，文件水平／垂直溢出均為 0；點選船尾後正式焦點、選取框與右側標題同步變成 `rudder`／船尾，F4 校準面板仍可開啟。另逐艘載入 `ship_01`～`ship_06`，六艘船圖均成功且五個部位中心都維持上述百分比。由正式 `board_game.html` 將目前玩家置於 `island-24` 後呼叫原 `openWaterSevenWindow()`，確認 iframe URL 為 `board=1&ship=<目前船型>&lockShip=1`；實際將桅杆由 Lv0 升為 Lv1 後，原費用 8,000 貝里及 5 個船材木板正確扣除，iframe 顯示 `Lv 1 / 3`，關閉後 overlay 與 `resolutionLock` 正常解除；開孔、裝備 `ship_patch_canvas` 及再次按下卸裝亦分別正確寫入 1 個孔位、孔位 1 道具與空孔位。再由正式 `board_start.html` 建立兩人房、第二視窗加入並準備後開始遊戲；房主開啟船塢時觀看方沒有私人 overlay，房主升級並關閉後，兩窗的桅杆等級、貝里與木板一致為 Lv1／42,000／15，`BOARD_GAME_STATE` 版本及 server ack 正常且兩窗 runtime exception 均為 0。`git diff --check` 亦通過。
- 風險：本次只重整水之七島總覽與永久升級的圖片及排版；不修改五項永久升級效果／費用、開孔、船隻裝備、S 級限制、玩家船型、關閉後結束回合、`WATER_SEVEN_SNAPSHOT_KEY`、iframe command、localStorage key、Socket.IO event、`BOARD_GAME_STATE` 格式或存檔欄位。`docs/GAME_RULES.md` 不需更新，因規則與數值未變；船隻裝備與開孔頁籤仍保留原功能，後續再各自進行圖片式 UI 改版。

#### 水之七島總覽可讀性、人物裁切與整體比例修正

- 日期：2026-07-22。
- 範圍：依實際畫面回饋放大保利說明、功能頁籤、部位名稱／標籤、升級效果、狀態、費用、資源與全隊效果文字；部位右側窄格的等級改為上下置中的 `Lv` 與 `目前／最高等級` 兩行，避免不規則斷行。保利人物與 `paulie_portrait_bg.webp` 由主框上層改到主框下層，裁切區精確對準 1672×941 主框的透明人物孔 `x=108～320、y=176～516`，說明文字則維持在主框上層，因此人物、背景與金框不再互相覆蓋。整張固定比例 UI 等比例放大約 6% 並以視窗中央裁切最外側繩索裝飾，`body`／`.demo-page` 保持 `overflow: hidden`，桌機及平板不產生卷軸。底部移除「船材／背包持有」欄頭；依主框 y=820 的五個深色內框實測中心 x≈214.5／309／403／497.5／593.5，將資源區改為 `left:9.995%`、`width:28.335%` 並把各欄文字安全寬度限制為約 74%，使貝里與四種材料不再壓到金框。正式 overlay 移除原 `waterSevenPageCloseBtn` 右上叉叉，改把主框右下空白大格設為 `waterSevenExitBtn`「離開」按鈕，仍送出原 `water-seven-close`。快取版本更新為 `20260722-water-seven-upgrade-ui-v5`。
- 檔案：`public/board_water_seven.html`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：隔離 Chrome 以 1440×900 與 1024×768 顯示新版總覽，整體面板分別約為 1526×859 與 1085×611 並保持置中；人物裁切框與主框透明孔換算位置差小於 0.4px，主框、部位框、三級效果列與資源圖片全部成功載入。以正式數值貝里 67,050、木板 69、工具箱 86、樹脂 44、亞當木片 0 重現後，桌機五格水平中心對素材內框的最大誤差約 1.14px、平板約 0.79px，全部名稱／數量及五個欄位的水平／垂直 DOM 溢出均為 0；兩種尺寸瀏覽器捲軸寬高亦為 0。正式 `board_game.html` 開出的 iframe 攜帶 `v=20260722-water-seven-upgrade-ui-v5`，父頁右上舊叉叉節點數為 0；右下「離開」顯示上述五項正式資源，點擊後 overlay 關閉、`resolutionLock` 解除且單人測試回合由 1 正常進到 2，runtime exception 為 0。
- 風險：只修正尺寸、字級、裁切層級、資源框安全區、離開按鈕位置與快取版本；新按鈕仍走原關閉事件與回合流程。不修改保利台詞、船隻圖片用途、五個部位座標、六艘船的 camera／focus／動畫、升級資料、費用、開孔、裝備、F4 校準、回合規則、存檔、Socket.IO event 或 `BOARD_GAME_STATE`。`docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新，因規則及檔案職責未變。

#### 正式水之七島船隻裝備圖片式介面

- 日期：2026-07-22。
- 範圍：驗收 `incoming/` 的 1024×1024 RGBA WebP，確認外圍透明、中央為海洋藍後，固定命名為 `water_seven_ship_equipment_slot_frame.webp` 並移出收件區。正式「船隻裝備」頁籤沿用既有船塢主框；四個原 `slotTune` 按鈕改套同一張正方形孔位框，已裝備、空孔與未開放狀態仍使用原道具圖、空孔提示與鎖頭。右側正式裝備清單重用 `water_seven_upgrade_effect_row_frame.webp`：左格置中既有裝備圖，中央顯示名稱、類型與效果，右格顯示階級、持有數與裝備狀態；詳情區保留名稱、階級、類型、持有數、完整效果、說明及原操作按鈕。選到清單下方的裝備後以 `scrollIntoView({ block: "nearest" })` 保持該卡可見。船隻後方聚光在 `gear` 模式由 29% 收窄到 17%、整層透明度降為 `.15`。依最終畫面回饋保留原四條孔位連接線與船體端點，改以高權重覆寫 `.slot-socket.equipped` 等舊樣式，把金色孔位框後方的黃色 radial-gradient 與 box-shadow 在已裝備、空孔、鎖定三種狀態全部設為透明／無陰影；已裝備框只留貼框的深色短陰影。所有孔位、連線與端點座標不變。主頁 JS 與 iframe 快取版本更新為 `20260722-water-seven-gear-ui-v2`。
- 正式功能保留：裝備仍送出 `water-seven-command: equip-gear`，點擊已裝備船體孔位仍送出 `unequip-slot`；正式 `waterSevenCommandEquipGear()` 繼續檢查背包持有、同船最多一件 S 級與第一個已開啟空孔位，沒有空孔仍提示先開孔。鎖定孔位仍前往「開孔」，空孔仍前往「船隻裝備」，最多四孔、各裝備效果、CPU、觀看方、存檔與完整快照同步流程都未改。
- 檔案：`public/images/board/water_seven_ui/water_seven_ship_equipment_slot_frame.webp`、`public/board_water_seven.html`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：新素材為 1024×1024 RGBA，透明 alpha 範圍正常；正式頁、主遊戲、版本化 iframe、新孔位框與共用資料列皆為 HTTP 200。隔離 Chrome 以 1440×900 桌機及 1024×768 平板實際顯示 12 件裝備的壓力資料，四個孔位框均與原按鈕同中心，中央裝備安全區為框寬高 62%，所有圖片成功載入，文件水平／垂直溢出與列內文字 DOM 溢出均為 0；切換完成後兩種尺寸的背景聚光透明度皆穩定為 `.15`、透明邊界為 17%。正式孔位連線層恢復顯示；已裝備、空孔與鎖定 socket 的 computed background 均為透明、box-shadow 均為 none。清單選到最後一件 S 級「夢幻廚房與醫療聯艙」後，桌機自動捲動 `scrollTop=1058` 且選中卡完整留在可視區，卡框與點擊區外框完全重合。直接頁面實際將可樂輔助引擎裝到孔位 3、由船體孔位卸下，狀態依序為 `ship_cola_aux_engine`／空孔；三個已開啟孔位全滿時按鈕顯示「沒有空孔位」，操作後仍維持原裝備並顯示「沒有空孔位，先在水之七島開孔。」。正式 `board_game.html` 開出的 iframe 攜帶 `v=20260722-water-seven-gear-ui-v2`，只列出正式背包持有的三件裝備並顯示「航海」類型；由正式頁按下「裝到孔位 3」及船體孔位 3 後，父頁玩家狀態正確裝入再卸下，右下離開後 overlay `open`／`closing` 均清除且 `resolutionLock=false`，四張新孔位框與所有裝備圖均成功載入，runtime exception 為 0。
- 風險：本次只替換船隻裝備頁籤的圖片、排版、選取可視性、孔位框後方背景／陰影，以及 `gear` 模式的船體背景聚光寬度；不修改六艘船的 camera／focus／動畫、孔位連線顯示、任何 `slotTune` socket／target 座標、F4 校準資料、開孔費用、十二件裝備名稱／數值／圖片用途、S 級限制、回合、CPU、觀看方、`WATER_SEVEN_SNAPSHOT_KEY`、localStorage key、存檔欄位、Socket.IO event 或 `BOARD_GAME_STATE` 格式。`docs/GAME_RULES.md` 不需更新，因規則與數值未變。

#### 正式水之七島開孔圖片式介面

- 日期：2026-07-22。
- 範圍：驗收 `incoming/` 的 1536×512 RGBA WebP，確認四角透明、alpha 內容範圍為 `(43, 67)～(1493, 444)`，固定命名為 `water_seven_slot_unlock_progress_row_frame.webp` 並移出收件區。正式「開孔」頁籤在右側主框內同時顯示四張共用進度列：左格置中既有正方形孔位框與 1～4 編號，中央依原字串顯示孔位名稱及完整貝里／船材費用，右格置中「已開啟／施工」與原「已完成／開孔」按鈕。四列使用固定 grid 填滿既有工作區，頁面、清單與列內均不產生卷軸；原固定說明句仍保留在每列的 `aria-label`，避免在窄框內壓縮主要費用。舊的下方重複摘要在 `slots` 模式隱藏，實際操作仍使用原 `data-open-now`，只有 `state.slotsUnlocked` 對應的下一孔按鈕可用。依實際畫面回饋，原先只套在 `gear` 模式的孔位透明覆寫同步補到 `slots` 模式，使舊 `.slot-socket.equipped` 黃色 radial-gradient 與 box-shadow 不會在開孔頁重新出現；連接線層未隱藏。主頁 JS 與 iframe 快取版本更新為 `20260722-water-seven-slots-ui-v2`。
- 正式功能保留：四孔仍只能依序開啟，最高四孔；費用仍為第 1 孔 6,000 B／木板 3、第 2 孔 10,000 B／木板 5／工具箱 1、第 3 孔 16,000 B／木板 8／工具箱 3／亞當木 1、第 4 孔 40,000 B／木板 12／工具箱 5／樹脂 2／亞當木 3。iframe 仍送出 `water-seven-command: open-slot`，正式 `waterSevenCommandOpenSlot()` 仍以玩家目前 `shipSlotsUnlocked` 決定真正下一孔並檢查材料；CPU 自動開孔、完整快照、存檔與多人同步流程不變。中央船圖、四個 `slotTune` socket／target 座標、孔位框與原四條連接線均未移動。
- 檔案：`public/images/board/water_seven_ui/water_seven_slot_unlock_progress_row_frame.webp`、`public/board_water_seven.html`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：素材為 1536×512 RGBA WebP，四角 alpha 為 0、中央 alpha 為 255。隔離 Chrome 以 1440×900 桌機及 1024×768 平板顯示 2／4 孔狀態，兩種尺寸皆同時顯示四列；文件、清單、四列、標題、費用及操作區水平／垂直 DOM 溢出均為 0，所有按鈕文字相對圖片按鈕框的水平／垂直中心誤差均為 0，原孔位連接線 opacity 為 1，開孔頁已裝備、空孔與鎖定 socket 的 computed background 均為透明、background-image 為 none、box-shadow 為 none，所有圖片成功載入且 runtime exception 為 0。由正式 `board_game.html` 以 `openWaterSevenWindow()` 開啟的 iframe 攜帶 `v=20260722-water-seven-slots-ui-v2`；第三孔為唯一可操作列，實際按下後父頁玩家孔位由 2 變 3，貝里 67,050→51,050、木板 100→92、工具箱 100→97、亞當木 100→99，iframe 狀態同步為前三孔「已開啟」並把唯一可操作列移到第四孔。
- 風險：本次只替換開孔頁籤的圖片、排版、重複摘要顯示與孔位框後方舊黃色背景／陰影；不修改開孔費用、扣款／扣料、依序開孔、最大孔數、六艘船圖、camera／focus／動畫、孔位／連線顯示或座標、船隻裝備、永久升級、回合、CPU、觀看方、`WATER_SEVEN_SNAPSHOT_KEY`、localStorage key、存檔欄位、Socket.IO event 或 `BOARD_GAME_STATE` 格式。`docs/GAME_RULES.md` 不需更新，因規則與數值未變。

#### 推進城隱藏囚犯招募結果 UI 素材收件準備

- 日期：2026-07-22。
- 正式入口確認：推進城囚犯抽選完成後，`impelDrawRecruit()` 將抽到的角色寫入 `pendingRecruitId`；外部推進城頁完成揭曉並送出結束行動後，`impelEndTurn()` 由該欄位呼叫 `openImpelDownRecruitResultModal()`。這是正式玩家流程中的私人決策視窗，不是戰鬥頁，也不是未被目前五種推進城事件使用的舊通用事件結果框。
- 原流程保留：隊伍未滿六人時顯示新囚犯資料並提供 `acceptImpelRecruitBtn`「收下夥伴」及 `rejectImpelRecruitBtn`「放棄」；隊伍已滿時顯示最多六名現有船員，使用 `data-impel-replace-crew` 選擇捨棄並收下新夥伴，或以 `rejectFullImpelRecruitBtn` 放棄本次招募。放棄不加入隊伍且不從推進城抽池移除；替換時原有道具歸還、船長索引及抽池處理維持既有規則。
- 素材規劃：建立 `public/images/board/impel_down_ui/incoming/`，預計收取一張 1672×941 RGBA WebP 招募結果主框，以及一張 1024×640 RGBA WebP 可重複使用的船員替換卡框；兩張素材內含各自的操作安全框位。新囚犯與現有船員圖片及階級／屬性資料沿用既有正式素材，不重複生成。
- 檔案：`public/images/board/impel_down_ui/incoming/.gitkeep`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：以 `rg` 核對 `pendingRecruitId` 的寫入／結算關係、隊伍未滿與隊伍已滿兩個 modal 分支，以及 CPU／自動觀察流程依賴的 `acceptImpelRecruitBtn`、`rejectImpelRecruitBtn`、`rejectFullImpelRecruitBtn` 與 `data-impel-replace-crew`；確認收件資料夾與 `.gitkeep` 已建立，正式頁尚未引用 `impel_down_ui/incoming/`。
- 風險：目前只建立素材收件位置與圖片規劃，尚未修改囚犯抽選、招募／放棄／替換、抽池、攜帶道具、目前船長、回合交棒、CPU、觀看方、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。`docs/PROJECT_OVERVIEW.md` 與 `docs/GAME_RULES.md` 不需更新，因正式功能與規則尚未變動。

#### 正式推進城隱藏囚犯招募結果圖片式介面

- 日期：2026-07-22。
- 範圍：驗收使用者放入的兩張 RGBA WebP，固定命名為 `impel_down_prisoner_recruit_result_panel_frame.webp` 與 `impel_down_prisoner_replacement_card_frame.webp` 並移出 `incoming/`。素材尺寸分別為 1672×941、1024×640，alpha 內容範圍分別為 `(29, 22)～(1643, 919)`、`(26, 32)～(998, 608)`，四邊均保留透明區。正式 `openImpelDownRecruitResultModal()` 改用同一張主框顯示兩種結果：左側固定顯示新囚犯圖片、階級、姓名、職能、屬性、等級與 HP／PP／攻擊／防禦／速度；隊伍未滿六人時，右側顯示招募候選與被動能力，底部保留收下夥伴／放棄；隊伍已滿時，右側改為 3×2 六張現有船員替換卡，顯示人物、姓名、等級、HP／PP、屬性與職能。主框標題、說明、人物資料與所有操作文字均依素材安全框置中。人物圖另依主框左側實際拱形內孔重新定位為 `left:13.64%`、`top:14.35%`、`width:14.35%`、`height:40.91%`，使用同曲率裁切，並清除舊囚犯卡片繼承的 10px padding、145% 圖片尺寸、陰影與向上位移，避免人物壓到金框或在框內留下不等距底色。主頁 JS 快取版本更新為 `20260722-impel-prisoner-recruit-ui-v1`。
- 正式功能保留：隊伍未滿仍使用 `acceptImpelRecruitBtn`／`rejectImpelRecruitBtn`，隊伍已滿仍使用六個 `data-impel-replace-crew` 與 `rejectFullImpelRecruitBtn`。收下、放棄、替換、原船員攜帶物歸還、船長索引調整、推進城抽池、CPU 自動決策、回合交棒及觀看方完整快照套用均沿用原流程；私人決策視窗只出現在目前操作方，觀看方不會取得可操作 modal。
- 檔案：`public/images/board/impel_down_ui/impel_down_prisoner_recruit_result_panel_frame.webp`、`public/images/board/impel_down_ui/impel_down_prisoner_replacement_card_frame.webp`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check public/js/board_game.js`、`board_game.html` inline script 語法、兩張正式素材路徑、正式頁 HTTP 200 與 `git diff --check` 均通過。隔離 Chrome 以 1440×900 桌機及 1024×768 平板實際顯示隊伍未滿與隊伍已滿兩種介面，面板分別約為 1397×786、992×558，頁面與 modal 均無水平／垂直卷軸；標題、姓名與按鈕位於素材框中心，六張替換卡及角色圖片均載入。實際點擊收下、放棄、第四名替換與滿隊放棄四條流程，確認新囚犯加入／不加入、指定索引替換與 `pendingRecruitId` 清除皆正確。兩個正式房間視窗測試中，操作方顯示一個私人結果 modal、觀看方為零；收下後兩窗隊伍均為原船員加新囚犯，`BOARD_GAME_STATE` 版本由 2 更新為 3、目前玩家及 server ack 一致，兩窗 runtime exception 皆為 0。
- 風險：本次只替換招募結果與滿隊替換的圖片、排版及人物裁切；不修改囚犯資料、名稱、台詞、能力、招募結果、隊伍上限、抽池、攜帶物、船長、CPU、回合規則、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 格式。`docs/GAME_RULES.md` 不需更新，因規則與數值未變。

#### 正式推進城進入／玩家救援與被關牢籠圖片式介面

- 日期：2026-07-23。
- 正式入口確認：主地圖 `resolveLanding()` 判定玩家落在 `island.kind === "impel_down"` 時呼叫 `openImpelDownModal()`；已是推進城囚犯的玩家仍直接開啟 `openImpelDownWindow()`，未被關的目前行動玩家才顯示進入／救援確認。救援列只收錄其他 `impelDown.active === true` 且 `status === "locked"` 的玩家，四人上限下最多三列；點擊仍由原 `data-impel-rescue` 呼叫 `startImpelDownBattle()`，不是另建展示入口或戰鬥頁 UI。
- 素材：驗收使用者放入的三張 RGBA WebP，固定命名並移出 `incoming/`。`impel_down_entry_rescue_panel_frame.webp` 為 1672×941，alpha 內容範圍 `(34, 24)～(1637, 917)`；`impel_down_rescue_player_row_frame.webp` 為 1536×300，alpha 內容範圍 `(24, 42)～(1512, 257)`；`impel_down_captive_cage_overlay.webp` 為 1024×1280，alpha 內容範圍 `(58, 32)～(966, 1248)`。三張素材四角均透明，正式頁不引用 `incoming/`。
- 進入／救援介面：`openImpelDownModal()` 非囚犯分支改為同一張 1672×941 主框；左側沿用 `impel_down_island.webp`，以海洋藍漸層填滿透明／留白區並精確裁入拱形孔，顯示島名、入口層級與副本行動。右側無囚犯時顯示空狀態；有囚犯時使用最多三張共用救援列框，左格顯示該玩家目前船長的 `weak`／`normal` 正式戰鬥圖，中間顯示玩家名、LEVEL、樓層、階級、被捕原因與原失敗警告，右格置中「救援」。底部「進入推進城／離開」與所有文字、圖片、點擊區均依素材內框置中；保留 `enterImpelIslandBtn`、`leaveImpelIslandBtn` 及 `data-impel-rescue`。
- 被關牢籠：`board_impel_down.html` 的人物舞台改套 `impel_down_captive_cage_overlay.webp`；牢籠覆蓋圖 `inset: 0` 並以 `width/height: 100%` 與 `.cage` 完全重合，角色圖縮在鐵欄安全區，舊 CSS `.bars`／`.lock` 隱藏。既有 `.cage.free` 狀態只讓新牢籠圖淡出及微幅上移，`locked`、`free`、樓層切換、事件按鈕與副本快照邏輯均未更動。主遊戲腳本快取版本更新為 `20260723-impel-entry-rescue-ui-v1`，推進城 iframe 版本更新為 `20260723-entry-rescue-cage-ui-v1`。
- 檔案：`public/images/board/impel_down_ui/impel_down_entry_rescue_panel_frame.webp`、`public/images/board/impel_down_ui/impel_down_rescue_player_row_frame.webp`、`public/images/board/impel_down_ui/impel_down_captive_cage_overlay.webp`、`public/board_game.html`、`public/js/board_game.js`、`public/board_impel_down.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：三張 WebP 尺寸、RGBA、alpha 範圍與透明四角均通過；正式 Chrome 以 1440×900 桌機及 1024×768 平板顯示無囚犯與三名囚犯兩種主框，主框分別約 1397×786 與 992×558，文件水平／垂直溢出為 0。三張救援列框與各自卡片 DOM 完全重合，島圖與拱形裁切區完全重合，標題、島嶼資料、三列玩家資料、救援按鈕及底部兩個按鈕的 DOM 溢出均為 0，所有正式素材與人物圖片成功載入且 runtime exception 為 0。副本頁桌機與平板鎖定狀態的牢籠圖均與 `.cage` 外框完全重合；解除狀態後牢籠 opacity 為 0，人物及原控制區保留。實際點擊「離開」後正常結束回合；點擊「進入推進城」後開啟帶新版號的正式 iframe；以一名被關玩家實際點擊「救援」後，原 `battleState.impelDown` 正確保留 `rescue: true`、`prisonerPlayerId`、樓層與 `eventId: "rescue"`。
- 風險：本次只替換推進城進入／救援確認及被關人物牢籠的圖片、排版與快取版本；不修改推進城六層、入場／離開、逃籠骰、救援失敗押往海軍本部、戰鬥頁、事件、招募、CPU、觀看方、回合、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 格式。`docs/GAME_RULES.md` 不需更新，因規則、名稱、台詞與數值未變。

#### 正式推進城副本頁完整圖片式介面

- 日期：2026-07-23。
- 正式入口與狀態：主地圖仍由 `openImpelDownWindow()` 建立全螢幕 iframe，正式頁為 `public/board_impel_down.html`，外部邏輯為 `public/js/board_impel_down.js`；父頁透過既有 `onepiece-board-impel-down-snapshot-v1`／`onepiece-board-impel-down-command-v1` localStorage 橋接完整 view 與玩家指令。新版介面完整覆蓋既有 `locked`、`wait_event`、`free`、`event`、`move`、`recruit`、`escaped` 狀態，不新增展示快捷入口，也不修改進入、救援或戰鬥頁。
- 素材：驗收並將八張 RGBA WebP 固定命名後移出 `incoming/`。`impel_down_dungeon_panel_frame.webp` 與 `impel_down_hidden_prisoner_pool_panel_frame.webp` 均為 1672×941；`impel_down_floor_row_frame.webp`、`impel_down_action_command_frame.webp` 均為 1536×384；`impel_down_dice_event_reveal_frame.webp` 為 1024×1024；`impel_down_event_roulette_row_frame.webp` 為 1536×320；`impel_down_prisoner_candidate_card_frame.webp`、`impel_down_prisoner_draw_roulette_panel_frame.webp` 均為 1536×1024。八張素材四角透明，alpha 內容範圍依序為 `(30,24)～(1642,917)`、`(20,28)～(1516,356)`、`(67,20)～(1468,364)`、`(24,28)～(1000,995)`、`(93,20)～(1443,300)`、`(32,25)～(1640,917)`、`(27,38)～(1512,986)`、`(38,36)～(1498,988)`；正式頁沒有引用 `incoming/`。
- 排版：1672×941 副本主框依原圖比例置中，標題、玩家階級、四項資源、六層樓層列、中央人物／牢籠舞台、事件揭曉與底部行動區均依素材內框定位。六張既有 `level_1_red_hell.webp` 至 `level_6_infinite_hell.webp` 透過主框中央透明區顯示，父頁只在既有 view 的 `rule` 加入對應圖片路徑。4:1 樓層列與行動框、正方形事件框、1536×320 事件列、1672×941 抽池主框及 3:2 囚犯候選卡／輪盤都保持素材原比例，不以 CSS 拉成其他比例；候選卡依 3+2 槽位置中。新版覆寫不加入先前被移除的寬黃色背光，既有牢籠圖與線條仍保留。
- 功能保留：六層名稱／階級／背景、五種推進城事件、五名隱藏囚犯、抽選權重、提高機率、貝里消耗、逃籠骰、移動／直接逃出、等待、往上、返回地圖及招募結果全部沿用原資料與按鈕。事件抽選、囚犯抽選、逃籠骰、靜態事件結果、移動結果與逃出結果改在新版事件框或輪盤顯示；原按鈕文字、command id、CPU、觀看方、回合、存檔與完整快照同步流程沒有改動。
- 檔案：`public/images/board/impel_down_ui/` 上述八張素材、`public/board_impel_down.html`、`public/js/board_impel_down.js`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check`、`board_impel_down.html` inline script 語法、CSS 解析、八張正式素材路徑與 HTTP 200、正式頁 DOM／runtime 狀態模擬及 `git diff --check` 均通過。DOM 測試逐一顯示 `locked`、`free`、`event`、`move`、`recruit`、`escaped`，確認六列樓層、五張囚犯卡、原操作按鈕、事件輪盤、囚犯輪盤與逃籠骰均正常建立且 runtime exception 為 0。Codex Chrome 外掛在本次工作階段初始化時持續回報 `Cannot redefine property: process`；依瀏覽器驗證規範未改用其他自動化工具代替，因此 1440×900 與 1024×768 的正式 Chrome 畫面仍待外掛恢復後補驗，不能列為已通過。
- 風險：本次只替換推進城副本頁的圖片、排版、唯讀樓層背景路徑與快取版本；不修改樓層規則、事件／囚犯 JSON、名稱、台詞、數值、按鈕字串、戰鬥頁、進入／救援、招募結果、CPU、觀看方、回合、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 格式。`docs/GAME_RULES.md` 不需更新，因規則與數值未變。

#### 正式推進城副本主畫面放大與重疊修正

- 日期：2026-07-23。
- 範圍：依正式畫面回饋放大 `board_impel_down.html` 的固定比例主框，寬度改為 `min(118vw, 100dvh × 1672/941)`；1440×900 換算為約 1599×900，1024×768 換算為約 1208×680，外側裝飾由無卷軸視窗裁切，樓層列、中央舞台、右側事件框與資源框仍完整留在可視區。副本 iframe 與主頁快取版本更新為 `20260723-full-image-ui-layout-v2`／`20260723-impel-full-ui-layout-v2`。
- 指令區重排：原 4:1 行動指令框寬度由主框的 88% 改為 41.5%，固定置於 `left:24.9%`、`bottom:3.9%`；它不再覆蓋六層樓層列、右側事件框或中央牢籠。標題與說明不再共用會互相擠壓的 grid，分別對準素材左上、左下兩個獨立內框；四個原按鈕維持 2×2，文字以 grid 完全水平／垂直置中並限制在各自框內。
- 人物與牢籠：中央舞台放大為主框的 32.8%×49.6%，允許完整牢籠延伸顯示；`.cage-wrap` 清除舊版 `min-width:260px`，固定保持 4:5，牢籠圖改用 `object-fit:contain`。角色圖使用舞台內絕對定位與 `object-fit:contain`，寬 72%、高 80%，不再被父層裁切或因平板最小寬度而變形。換算後牢籠下緣為主框 77.31%，指令框上緣為 77.67%，保留 0.35% 間距。
- 檔案：`public/board_impel_down.html`、`public/board_game.html`、`public/js/board_game.js`、`docs/DEV_WORKFLOW.md`。
- 驗證：外部 JS、HTML inline script 與 CSS 語法、正式頁及版本化腳本 HTTP 200、桌機／平板座標換算與 `git diff --check` 均通過；兩種尺寸的樓層列、人物牢籠、事件框、資源框與指令框換算後皆位於視窗可視範圍，牢籠與指令框不相交。Codex Chrome 外掛仍於初始化回報 `Cannot redefine property: process`，因此本次未把 1440×900／1024×768 的實際 Chrome 畫面誤列為通過，待外掛恢復後補驗。
- 風險：本次只調整正式推進城副本主框縮放、人物／牢籠顯示、指令框位置與文字置中；不修改任何按鈕字串、command id、樓層、事件、囚犯、骰子、招募、戰鬥、CPU、觀看方、回合、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新，因正式功能、規則與素材職責未變。

#### 正式推進城 V3 主框與囚犯雙軌抽選介面

- 日期：2026-07-23。
- 素材驗收：`incoming/` 的兩張圖片均為 1672×941 RGBA WebP 且四角 alpha 為 0。新主框固定命名為 `impel_down_dungeon_panel_frame_v3.webp`，alpha 內容範圍 `(42,28)～(1630,913)`，中央透明人物孔的連通範圍為 `(635,321)～(946,719)`；新囚犯抽選框固定命名為 `impel_down_prisoner_draw_roulette_panel_frame_v3.webp`，alpha 內容範圍 `(57,28)～(1614,913)`，左右透明軌道分別為 `(309,321)～(831,556)` 與 `(841,321)～(1357,556)`。兩張素材已移出收件區，正式頁不引用 `incoming/`。
- V3 主框排版：六個樓層框與底部指令／四個橫向按鈕已畫入新主框，因此 `.floor-row-frame` 與 `.command-frame-art` 在 V3 正式頁隱藏，樓層文字、目前玩家、樓層階級、指令標題、說明與四個原按鈕直接依新素材內框定位。中央人物舞台使用素材透明孔的實測百分比 `left:37.98%`、`top:34.11%`、`width:18.6%`、`height:42.3%`；牢籠固定 4:5 並占孔高 97.5%，角色使用 `object-fit:contain`、寬高 88%，完整顯示且不被裁切。底部四按鈕改為單列，仍依序使用原 primary／secondary／third／返回地圖節點及事件。
- 抽事件沿用：沒有新增或替換抽事件素材；`impel_down_dice_event_reveal_frame.webp` 仍同時負責逃籠骰、抽事件與靜態結果。它在新主框改為 `left:61.8%`、`top:29.8%`、`width:26.5%` 的正方形，較 V2 的 20.3% 放大約三成並貼合右側新框；事件轉盤仍以原 `impel_down_event_roulette_row_frame.webp` 建立 32 列動畫。
- 囚犯雙軌輪盤：招募抽選時的 event panel 改為主框寬 96%、1672:941；V3 主框置於卡片軌道上層，候選卡只會透過兩個透明孔顯示。既有 29 張 3:2 候選卡寬度提高為 `clamp(190px,20vw,320px)`，停下位置對準右軌中心 `left:75.4%`；五格機率、標題、狀態與下方招募結果則依 V3 素材框位重排。抽中 id、卡片順序、轉動時間、提高機率、費用與招募結算未修改。
- 快取：推進城 iframe／外部 JS 使用 `20260723-full-image-ui-layout-v3`，主頁 `board_game.js` 使用 `20260723-impel-full-ui-layout-v3`。
- 檔案：`public/images/board/impel_down_ui/impel_down_dungeon_panel_frame_v3.webp`、`public/images/board/impel_down_ui/impel_down_prisoner_draw_roulette_panel_frame_v3.webp`、`public/board_impel_down.html`、`public/js/board_impel_down.js`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：兩張 WebP 尺寸、RGBA、alpha 範圍與透明孔均通過；外部 JS、HTML inline script、CSS 解析、正式素材路徑、版本化正式頁 HTTP 200 與 `git diff --check` 均通過。jsdom 正式狀態檢查涵蓋 `locked`、`event`、`recruit`，六列樓層、五張囚犯卡與主框載入均無 runtime exception；實際觸發招募抽選建立 29 張卡、V3 雙軌框與 96% 寬面板，實際觸發抽事件仍建立原正方形外框及 32 張事件列。1440×900／1024×768 座標換算中，樓層、人物牢籠、右側事件框、底部說明及四按鈕交疊面積均為 0。Codex Chrome 外掛初始化仍回報 `Cannot redefine property: process`，所以未將實際 Chrome 畫面誤列為通過，待外掛恢復或使用者提供正式截圖後補驗。
- 風險：本次只替換副本主底圖與囚犯抽選底圖、重新對齊現有文字／圖片／按鈕；不修改抽事件外框、任何按鈕字串、樓層、事件、囚犯、抽選權重、費用、骰子、招募結果、戰鬥、CPU、觀看方、回合、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。`docs/GAME_RULES.md` 不需更新，因規則與數值未變。

#### 正式推進城 V10 事件轉盤雙指針與九張狀態插畫

- 日期：2026-07-23。
- 人物／牢籠對框：V3 中央透明孔仍為 `(635,321)～(946,719)`，`.captain` 維持寬高 100% 的 `cover` 與拱頂 polygon 裁切；`impel_down_captive_cage_overlay.webp` 的容器及圖片改為人物孔 100% 寬高，取消 V5 的 110% 外擴，使牢籠四邊不再超出原底圖人物框。`free` 狀態仍以同一中心淡出並上移，不改人物圖。
- 素材：驗收 incoming 九張 1024×1024 RGBA WebP，alpha extrema 均為 0～255、四角全部透明；依正式職責固定命名並移到 `public/images/board/impel_down_ui/`。五張事件結果圖為 `impel_down_event_result_patrol.webp`、`impel_down_event_result_key.webp`、`impel_down_event_result_magellan.webp`、`impel_down_event_result_ivankov.webp`、`impel_down_event_result_hidden.webp`；四張狀態圖為 `impel_down_state_wait_event.webp`、`impel_down_state_move_choice.webp`、`impel_down_state_move_escape_choice.webp`、`impel_down_state_escaped.webp`。`incoming/` 已恢復只保留 `.gitkeep`，正式頁不引用收件區。
- 正式狀態對應：`event` 依既有 `event.id` 顯示五張對應插畫；`wait_event` 顯示已開籠與沙漏；`move` 依既有 `allowEscape` 決定一般上下兩路或擊退麥哲倫後的上下／直接逃出三路；`escaped` 顯示成功逃出。右側事件外框、上方正式事件標題與下方 `commandState()` 說明全部保留，框中央只顯示透明插畫，舊 `.static-event-symbol` 圓形符號、內層事件名稱與 tag 文字不再建立。插畫使用 `object-fit:contain`、置中及 1.07 倍安全縮放，不增加黃色背光。
- 事件轉盤雙指針：沿用既有 `reward-slot-pointer` DOM，在 `.event-reward` 內改為中央中獎線左右各一個相向箭頭；箭頭固定貼近事件列兩側，顏色使用與正式框一致的黑鐵主體、窄古銅分隔及中央低飽和青藍寶石色，只保留黑色落影與一像素古銅收邊，不使用亮黃色、大面積純藍、寬光暈或黃色背光。指針高度跟隨原 `--slot-step` 對應的 `clamp(40px,4.25vw,62px)`，因此轉盤停住時仍精確指向 `REWARD_SLOT_TARGET_INDEX` 的中央列；招募輪盤不套用此樣式。
- 快取：推進城 iframe／外部 JS 使用 `20260723-full-image-ui-layout-v10`，主頁 `board_game.js` 使用 `20260723-impel-full-ui-layout-v10`。
- 檔案：上述九張 `public/images/board/impel_down_ui/` 素材、`public/board_impel_down.html`、`public/js/board_impel_down.js`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：九張 WebP 的格式、尺寸、RGBA、alpha 範圍、透明四角、正式檔名與路徑均通過；外部 JS、HTML inline script、CSS 解析、正式頁與版本化腳本 HTTP 200、`git diff --check` 均通過。jsdom 逐一載入五種 `event`、`wait_event`、普通 `move`、`allowEscape` 三選一 `move` 與 `escaped`，九種狀態各只建立一張正確 `.static-event-scene`，框內 `.static-event-symbol` 與多餘文字均為 0；原事件標題、說明、主要按鈕與 `allowEscape` 的「直接逃出」啟用狀態保持正確。實際觸發事件抽選仍建立 32 個事件項目、32 張原事件列底圖與原圖示／名稱，唯一 `.reward-slot-pointer` computed display 為 `block`、位於 `top:50%` 並高於事件列；招募轉盤沒有事件雙指針。Codex Chrome 外掛初始化仍回報 `Cannot redefine property: process`，因此實際 Chrome 畫面待外掛恢復或使用者提供正式截圖後補驗。
- 風險：本次只新增事件轉盤左右指針並保留九張靜態插畫，不修改事件 id、正式台詞、事件池、權重、隱藏事件保底、抽選停止位置、戰鬥、治療、招募、上下移動、直接逃出、按鈕字串、command id、CPU、觀看方、回合、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。`docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新，因規則、數值與素材職責未變。

#### 正式推進城 V11 六層監獄場景全螢幕背景

- 日期：2026-07-23。
- 正式入口：仍由主遊戲 `openImpelDownWindow()` 開啟 `board_impel_down.html` 全螢幕 iframe；沒有新增展示入口或快捷按鈕。
- 背景層級：`board_impel_down.js` 的 `render()` 仍讀取父頁既有唯讀 `rule.image`，但不再把樓層場景設為 `.frame` 的局部背景，改設到最外層 `.screen`。`.screen` 使用 `background-size:cover`、置中且不重複，六張 `level_1_red_hell.webp` 至 `level_6_infinite_hell.webp` 會依目前 LEVEL 自動鋪滿整個視窗；`.frame.impel-image-ui` 改為透明，讓同一張全螢幕場景從 V3 主框中央透明孔及主框外圍連續露出。
- 排版保留：1672×941 主框仍使用原比例與原縮放方式，監獄金屬框、樓層列、標題、資源、人物牢籠、右側事件／狀態框、抽選輪盤及底部按鈕的百分比座標均未改；本次不放大事件圖，也不拉伸主框。
- 快取：推進城 iframe／外部 JS 使用 `20260723-full-image-ui-layout-v11`，主頁 `board_game.js` 使用 `20260723-impel-full-ui-layout-v11`。
- 檔案：`public/board_impel_down.html`、`public/js/board_impel_down.js`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check public/js/board_impel_down.js`、`node --check public/js/board_game.js`、`board_impel_down.html` inline script 編譯與 CSS 解析均通過。jsdom 依序切換 LEVEL 1～6，六種狀態都把正確的 `rule.image` 設到唯一 `.screen`，同時確認 `linear-gradient` 保留、`.frame` 背景為 `none`、事件框與牢籠各維持一組；六張樓層圖片皆存在且正式 HTTP 200。`.screen` computed background 為 `cover`、置中、`no-repeat`，因此 1440×900 與 1024×768 都會由目前樓層圖覆滿視窗而不留下純黑空白；主框尺寸公式與全部內部座標未改。固定入口、正式主頁、版本化推進城頁及兩支版本化腳本均 HTTP 200，`git diff --check` 通過。Codex Chrome 連線初始化仍回報 `Cannot redefine property: process`，依 Chrome 驗證規範未改用其他瀏覽器自動化冒充，因此本次實際 Chrome 桌機／平板畫面仍待外掛恢復或使用者提供正式截圖後補驗。
- 風險：本次只移動既有六張樓層背景的顯示層級；不修改樓層資料、背景路徑、事件圖、事件／囚犯抽選、牢籠、按鈕字串、command id、戰鬥、CPU、觀看方、回合、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。`docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新，因規則、數值、素材與檔案職責未變。

#### 正式推進城入口島嶼縮圖原色修正

- 日期：2026-07-23。
- 問題與原因：正式 `openImpelDownModal()` 進入／救援確認視窗左側沿用 `images/board/islands/impel_down_island.webp`，縮圖容器的海洋藍漸層只用來填補透明／留白區；但圖片本身另套用了 `mix-blend-mode:screen`，會把石牆、火光與海水一起和藍底濾色，造成整張推進城縮圖泛藍。
- 修正：`.impel-entry-island-art img` 改為 `mix-blend-mode:normal`、`filter:none`，讓島嶼素材使用原色顯示；外層海洋藍漸層、拱形裁切、`object-fit:contain`、尺寸與位置全部保留，因此透明區仍是海洋藍，但不再染到島圖本體。
- 快取：正式 `board_game.js` 引用更新為 `20260723-impel-entry-island-color-v1`。
- 檔案：`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check public/js/board_game.js`、`board_game.html` inline script 編譯與 CSS 解析通過。jsdom 在正式樣式中建立 `.impel-entry-island-art > img`，computed style 為 `mix-blend-mode:normal`、`filter:none`、`object-fit:contain`、置中；外層仍保留海洋藍 `radial-gradient`、`overflow:hidden`，正式縮圖素材亦存在。固定入口、正式主頁、新版號腳本與 `impel_down_island.webp` 均 HTTP 200，`git diff --check` 通過。Codex Chrome 連線在同一工作階段仍受初始化錯誤阻擋，因此實際桌機／平板畫面待外掛恢復或使用者刷新正式頁確認後補驗。
- 風險：本次只移除推進城入口縮圖的濾色；不修改原素材、其他島嶼縮圖、推進城副本六層背景、入口／離開／救援按鈕、戰鬥、CPU、觀看方、回合、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。`docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 頂上戰爭正式主介面素材收件準備

- 日期：2026-07-23。
- 正式入口與範圍：下一個改版目標是 `public/board_marineford.html` 的正式主畫面，只規劃外圍主框、左側多人處刑台情報列、右側目前 Boss 卡，以及右上處刑倒數／救援骰框。主地圖仍由既有 Marineford 流程開啟正式全螢幕頁，不新增展示入口或快捷按鈕。
- 既有動畫保留：`public/images/board/marineford/backgrounds/marineford_stage_bg.webp`、`props/execution_platform.webp`、`props/execution_guard_crossed_swords.png`、`props/execution_cut_video/**`、`props/haki/conqueror_intro.mp4`，以及正式頁內的舉刀、斬落、霸王色、守衛裂開、角色救出／處刑與成功失敗動畫全部保留。新主框中央必須是大面積透明安全區，不得畫入處刑台、守衛、角色、武器、光效或文字，也不得遮擋現有動畫圖層。
- 素材規格：建立 `public/images/board/marineford_ui/incoming/`，預計收取四張去背 WebP：1672×941 全畫面主框、1536×512 多人處刑台情報列框、1024×1280 目前 Boss 卡框、1536×512 處刑倒數／救援骰框。所有圖均不得含正式文字、角色、Boss、處刑台或士兵，文字與既有角色圖由程式置中放入安全框。
- 檔案：`public/images/board/marineford_ui/incoming/.gitkeep`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：確認收件資料夾與 `.gitkeep` 存在；用 `rg` 核對正式頁的 `executionZone`、`executionSlots`、`bossLineup`、`helperLineup`、`remainingTurnsText`、`rescueDiceBtn`，以及處刑台／守衛／霸王色動畫素材路徑。正式 `board_marineford.html` 尚未引用 `marineford_ui/incoming/`。
- 風險：本次只建立素材收件區與提示詞規格，尚未修改正式頁、動畫、按鈕、Boss、處刑倒數、救援骰、多人、CPU、觀看方、回合、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。`docs/PROJECT_OVERVIEW.md` 與 `docs/GAME_RULES.md` 不需更新。

#### 正式頂上戰爭全螢幕圖片式主介面

- 日期：2026-07-23。
- 還原點：接入新圖前已將當時的 `public/board_marineford.html`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md` 與 `docs/DEV_WORKFLOW.md` 完整複製到 `.codex-runtime/restore-points/marineford-ui-before-new-images-20260723-v1/`，並以 `MANIFEST.md` 記錄用途；逐檔 SHA-256 比對均與接入前來源一致。此資料夾只供使用者不喜歡新版時精確復原，正式頁不會引用還原點。
- 素材驗收與歸位：四張使用者提供的去背 WebP 已由 `incoming/` 移至 `public/images/board/marineford_ui/`，固定命名為 `marineford_raid_panel_frame.webp`（1672×941）、`marineford_execution_intel_row_frame.webp`（1536×512）、`marineford_current_boss_card_frame.webp`（1024×1280）與 `marineford_countdown_rescue_dice_frame.webp`（1536×512）。四張皆為 RGBA、具有 0～255 alpha；`incoming/` 只保留 `.gitkeep`，正式頁未引用收件路徑。
- 正式排版：全畫面主框置於 `.marineford` 的最底層，使用 `inset:0` 與 `object-fit:fill` 貼滿視窗；原 `.stage` 仍保持 `inset:90px 18px 18px` 及 `minmax(230px, 280px) minmax(420px, 1fr) minmax(190px, 270px)` 三欄配置，沒有縮小中央處刑舞台、改成捲動頁或新增額外操作列。標題、右上倒數／救援骰、左側最多四份處刑情報與右側目前 Boss 均改用新圖框；正式文字、Boss 圖、按鈕及資料依素材可視內框置中。1024 寬度仍沿用同一個全螢幕三欄舞台，不隱藏左右資訊欄。
- 動畫與功能保留：中央仍使用原 `execution_platform.webp`、`execution_guard_crossed_swords.png`、`execution_cut_video/**` 與 `props/haki/conqueror_intro.mp4`；舉刀、斬落、霸王色、守衛裂開、角色救出／處刑、成功／失敗動畫及原圖層順序全部保留。`executionZone`、`executionSlots`、`helperLineup`、`bossLineup`、`remainingTurnsText`、`rescueDiceBtn` 與原事件入口均未改名；正式四人快照可顯示 1 張自己的情報卡、3 張其他玩家情報卡、目前 Boss、最短處刑倒數與救援骰數量。
- 快取：`MARINEFORD_PAGE_VERSION` 與正式 `board_game.js` script query 同步更新為 `20260723-marineford-image-ui-v1`，確保主頁載入新版 Marineford iframe 與樣式。
- 檔案：`public/board_marineford.html`、`public/board_game.html`、`public/js/board_game.js`、`public/images/board/marineford_ui/*.webp`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check public/js/board_game.js` 通過；`board_marineford.html` inline script 以 `vm.Script` 編譯、CSS 以 `css-tree` 解析均通過，`board_game.html` CSS 亦解析通過。jsdom 獨立模式確認新主框、原全螢幕 `.stage`、處刑台與既有守衛／斬落／霸王色素材都存在，沒有 runtime exception；正式 `board=1` 四人快照確認左側共 4 張處刑情報卡、3 個其他玩家切換入口、右側黃猿 Boss、最短 `19 回合`、`救援骰 x2` 與中央處刑角色均正常，沒有 runtime exception。固定入口、正式主頁、版本化 Marineford 頁、版本化主腳本、四張新圖與原處刑／動畫素材均回應 HTTP 200；`git diff --check` 通過（僅顯示專案既有 `public/start.html`、`server/db.js`、`server/index.js` 行尾轉換警告，沒有 whitespace error）。Codex Chrome 初始化仍回報 `Cannot redefine property: process`，依 Chrome 驗證規範未改用其他瀏覽器自動化冒充，實際 1440×900／1024×768 Chrome 畫面待外掛恢復或使用者刷新正式頁提供截圖後補驗。
- 風險：本次只替換頂上戰爭正式主畫面的外框與排版；不修改正式台詞、名稱、數值、Boss 順序、40 回合倒數規則、救援骰效果、點擊目前敵人接續流程、處刑 slot、CPU、多人觀看方、回合、戰鬥、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。規則未變，因此 `docs/GAME_RULES.md` 不需更新。

#### 正式頂上戰爭 V2 圖框精確對齊

- 日期：2026-07-23。
- 問題：初版仍沿用舊三欄清單的 padding 與卡片原比例，導致左側「處刑台詳情」落進第一列、四張資料卡未吻合主底圖四個金框；右側 4:5 Boss 卡只顯示在大框上半部，Boss 人物使用 `contain` 也留下過多空隙；右上倒數／救援骰則沒有完全依 1536×512 圖片的三個實際內框置中。
- 修正：依 1672×941 主框內框像素換算百分比，左側資訊區固定為視窗 `left:5.2% / top:10.65% / width:18.15% / height:68.65%`，標題與自己／其他三位玩家依四個金框分別定位；1536×512 資料列內的左盾牌孔新增該 slot 的既有角色 portrait，玩家、角色、處刑倒數與「換隊長」各自對齊圖片原有中框、下框及右框。右側 Boss 卡固定為 `left:76.05% / top:21.5% / width:18.65% / height:62%`，縱向填滿主底圖，人物孔改用 `object-fit:cover`，標題、姓名、職能與底部接續提示依 1024×1280 圖框實際位置分開定位。右上倒數框改為 `left:76.05% / top:10.85% / width:18.65% / height:9.65%`，標題、回合與救援骰分別置入左上、左下與右側內框；圖片式卡片 hover 不再位移，避免游標經過時離開金框。
- 保留：中央 `.stage` 仍維持原 `inset:90px 18px 18px`、原三欄計算與全螢幕無卷軸；處刑台、牢籠、守衛、舉刀、斬落、霸王色、救援／處刑及成功／失敗動畫未修改。原 slot 切換、換隊長、Boss 點擊接續、倒數、救援骰、CPU、多人觀看方與 `BOARD_GAME_STATE` 同步均沿用既有流程。
- 快取：`MARINEFORD_PAGE_VERSION` 與正式 `board_game.js` script query 更新為 `20260723-marineford-image-ui-v2`。
- 檔案：`public/board_marineford.html`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`board_marineford.html` inline script 編譯及 CSS 解析通過；正式 `board=1` 四人快照顯示 4 張資料卡、4 張角色 portrait、3 個其他玩家切換按鈕、黃猿、`19 回合` 與 `救援骰 x2`，沒有 runtime exception。依定位公式檢查，1440×900 的四列範圍約為 y=224～344、357～464、473～584、593～714，1024×768 約為 y=191～294、304～395、402～497、505～609，均對應主框四個金框且維持單頁。Codex Chrome 連線仍在初始化時回報 `Cannot redefine property: process`，未使用其他瀏覽器自動化冒充 Chrome 實機畫面；須由使用者刷新正式流程確認後再做最後像素微調。
- 風險：本次只校正圖片、文字與既有角色 portrait 的顯示位置；沒有改台詞、名稱、數值、素材用途、字串 id、40 回合規則、救援骰效果、事件、CPU、戰鬥、回合、存檔欄位、localStorage key、Socket.IO event 或同步快照格式。未新增素材或改檔案職責，`docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 頂上戰爭 V2 對齊撤回

- 日期：2026-07-23。
- 原因：實際回報顯示 V2 更加混亂，且中央處刑台不再置中。確認原因是 V2 將 `helperLineup` 與 `bossLineup` 改成 `position:fixed`，使兩個原本占用 `.stage` 第一、第三欄的 grid item 離開排版流，中央 `executionZone` 因此被自動配置到錯誤欄位。
- 處理：完整撤回 V2 的固定定位、左側 portrait、新文字座標、Boss 卡放大／`cover` 與倒數框重定位，恢復上一版正常參與三欄 grid 的左右面板，讓中央處刑台回到原第二欄。使用者要求必須先實際開啟正式畫面再繼續，因此在 Chrome 畫面可被檢查前不再做新的座標調整。
- 快取：`MARINEFORD_PAGE_VERSION` 與正式 `board_game.js` script query 更新為 `20260723-marineford-image-ui-rollback-v3`，避免瀏覽器繼續沿用已撤回的 V2 iframe。
- Chrome 檢查：確認 Chrome 150 正在執行、Codex Chrome Extension 已安裝且啟用、本機 native host manifest 與 registry 路徑正確；依故障排除流程開啟同一個 Default profile 新視窗並重試，瀏覽器控制仍在初始化時回報 `Cannot redefine property: process`，目前無法取得正式畫面。未改用其他瀏覽器自動化冒充 Chrome。
- 風險：本次只撤回尚未確認的 V2 視覺排版，不修改動畫、規則、按鈕、CPU、回合、戰鬥、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。原始接圖前還原點仍保留在 `.codex-runtime/restore-points/marineford-ui-before-new-images-20260723-v1/`。

#### 頂上戰爭 V4 正式畫面對齊

- 日期：2026-07-23。
- 實際畫面確認：依使用者同意改用本機 Chrome 150 的模擬正式狀態，載入 `board_marineford.html?board=1` 與四人 `BOARD` view；狀態包含魯夫／索隆／羅／大和四座處刑台、31／28／24／19 回合、黃猿與救援骰 x2。先以 1440×900、再以 1024×768 擷取完整視窗，確認原回退版問題為左側資料列未依主底圖四個橫框分配、右側 Boss 卡只占長框上半部；中央處刑台、囚犯角色與兩名守衛本身的位置正確。
- 安全排版：`helperLineup` 與 `bossLineup` 仍是 `.stage` 第一、第三欄的原 grid item，沒有再套用會使中央舞台錯欄的 fixed／absolute parent；只將其內部 `.intel-panel`、Boss 圖卡、標題與接續提示依全螢幕主框定位。中央 `executionZone`、`.platform-img`、`executionSlots` 及原三欄尺寸未修改。
- 左側情報：四張 `marineford_execution_intel_row_frame.webp` 依主框四個橫列等距配置；每列左盾牌孔加入該 slot 原有 portrait，玩家、角色名、剩餘處刑回合與「換隊長」分別置中於素材的上／中／下／右框，hover 不再造成卡片偏移。正式四人畫面顯示 4 張資料卡與 4 張角色圖，並實點第二列確認中央處刑角色可由魯夫切換成索隆；換隊長按鈕亦可開啟原選擇視窗。
- 右側 Boss：`marineford_current_boss_card_frame.webp` 依素材透明外距放大後覆合主底圖長框，Boss 圖改為 `object-fit:cover` 填滿人物孔；「目前敵人」、黃猿名稱、職能與底部接續提示分別置中，卡片 hover 不再位移。右上倒數／救援骰沿用已確認正常的三格配置。
- 保留：處刑台、囚犯圖、守衛交叉刀、舉刀、斬落、霸王色、守衛裂開、角色救出／處刑與成功／失敗動畫的 DOM、素材、尺寸、圖層及事件均未修改；原 Boss 點擊接續、處刑台切換、換隊長、倒數、救援骰、CPU、觀看方與 `BOARD_GAME_STATE` 流程不變。
- 快取：`MARINEFORD_PAGE_VERSION` 與正式 `board_game.js` query 同步更新為 `20260723-marineford-image-ui-aligned-v4`。
- 檔案：`public/board_marineford.html`、`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check public/js/board_game.js` 通過；`board_marineford.html` inline script 及 `board_marineford.html`／`board_game.html` CSS 解析通過；四張 Marineford 新 UI 圖、處刑台、守衛與霸王色素材均存在；固定入口、正式主頁、版本化 Marineford 頁與版本化主腳本均 HTTP 200。Chrome 模擬正式四人狀態在 1440×900 與 1024×768 皆顯示 4 張資料卡、4 張角色圖、黃猿、19 回合與救援骰 x2，`html`／`body` 均為 `overflow:hidden`，無捲軸；桌機與平板截圖已逐張目視確認文字、人物與圖框吻合，中央舞台保持原位置。`git diff --check` 通過，僅有專案既有 `public/start.html`、`server/db.js`、`server/index.js` 行尾轉換警告，沒有 whitespace error。
- 風險：本次只修頂上戰爭正式頁的圖片、文字與既有角色 portrait 排版，不改台詞、名稱、數值、素材用途、字串 id、40 回合規則、救援骰效果、事件、CPU、戰鬥、回合、存檔欄位、localStorage key、Socket.IO event 或同步快照格式；未新增素材或改檔案職責，因此 `docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 頂上戰爭 V5 正式抽籤圖片式介面

- 日期：2026-07-23。
- 素材驗收：使用者直接放入 `public/images/board/marineford_ui/` 的四張 WebP 已依檔名對應用途，尺寸分別為 `marineford_lottery_panel_frame.webp` 1536×1024、`marineford_lottery_player_info_frame.webp` 1024×512、`marineford_player_lottery_reel_frame.webp` 1536×512、`marineford_lottery_result_character_frame.webp` 1024×1280；Pillow 檢查皆為 RGBA、alpha extrema 0～255，並逐張目視確認沒有正式文字或角色，可直接由程式疊入內容。
- 正式範圍：只改 `public/board_marineford.html` 的 `openLotteryPrompt()`、`runLottery()` 與 `openDrawResultModal()` 視覺。推進城全滅路線的「處刑台抽籤」與下一步「白鬍子支援抽籤」共用 3:2 冰火海軍本部主框，既有 `openModal()` 新增可選 class 並在每次開啟時重設，確保規則、賀爾蒙、開戰與其他尚未改版視窗不會沿用抽籤樣式。
- 準備階段：1～4 位玩家仍顯示原玩家名、隊伍池／處刑台、40 回合或支援不重複提示；四人時以 2×2 的 `marineford_lottery_player_info_frame.webp` 配置，說明、標題與「先等等／開始抽籤」均依主框內框置中。
- 抽籤階段：保留原 22 張 token、每位玩家不同 target index、2600ms `lottery-track` 位移與命中標記；`marineford_player_lottery_reel_frame.webp` 依玩家數配置為單列、雙列或 2×2，角色卡在透明卡帶視窗內滑動，素材本身以雙層疊法讓永久中央金框與左右指針保持在角色卡上方。沒有修改候選池、亂數或結果。
- 結果階段：1～4 張 `marineford_lottery_result_character_frame.webp` 依人數等寬排列，現有角色圖以 `cover` 填滿人物孔，玩家名、正式角色名、階級與「上處刑台／暫時支援」文字分別置入圖框；正式 `board=1` 仍保留「返回地圖」，獨立模式仍可用原關閉按鈕。
- 快取：`MARINEFORD_PAGE_VERSION` 與正式 `board_game.js` query 同步更新為 `20260723-marineford-lottery-image-ui-v5`。
- 檔案：`public/board_marineford.html`、`public/js/board_game.js`、`public/board_game.html`、`public/images/board/marineford_ui/marineford_lottery_panel_frame.webp`、`marineford_lottery_player_info_frame.webp`、`marineford_player_lottery_reel_frame.webp`、`marineford_lottery_result_character_frame.webp`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- Chrome 正式流程驗證：以 Chrome 150 載入 `board_marineford.html?board=1` 四人快照，桌機 1440×900 實點目前敵人、繼續設定與開始抽籤，確認準備畫面 4 張資料框、轉動中 4 個 reel／88 個 token／4 個 `is-running` track，以及結果畫面 4 張角色卡均正常；桌機逐張目視確認中央金框／雙指針壓在角色卡上方、文字與圖片置中且 modal／body 無捲軸。平板 1024×768 實測白鬍子支援準備畫面能顯示 4 位玩家且開始按鈕可用，結果畫面 4 張角色卡與底部按鈕均完整顯示；另關閉抽籤後開啟賀爾蒙注射，modal class 已重設為原 `modal`，確認其他舊介面未被抽籤樣式污染。
- 技術驗證：`node --check public/js/board_game.js`、`board_marineford.html` inline script 編譯與 CSS 解析通過；四張新圖及正式頁素材路徑存在，固定入口、正式主頁、版本化 Marineford 頁、版本化主腳本與四張新圖均 HTTP 200；`git diff --check` 通過時僅顯示專案既有行尾轉換警告，沒有 whitespace error。
- 風險：本次不修改正式台詞、卡池、候選名單、亂數、抽籤結果、角色／道具 id、Boss、40 回合倒數、救援骰、CPU、觀看方、戰鬥、存檔欄位、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`；規則未變，因此 `docs/GAME_RULES.md` 不需更新。

#### 頂上戰爭 V6 抽籤尺寸、文字與按鈕重排

- 日期：2026-07-23。
- 原因：V5 雖已套入四張新圖，但四人內容仍偏密，桌機外框只使用 1180px，轉盤／結果人物偏小；標題實際 grid item 只依文字內容縮寬而落在左側，結果頁「關閉」按鈕又以標題框為 containing block 使用超大 top 百分比，視覺與維護都不穩定。使用者要求圖片、每段文字與按鈕都必須在各自圖片內框置中。
- 主框與內容放大：抽籤 modal 改用 `min(1360px, 100vw - 12px, (100vh - 12px) × 1.5)`，並讓抽籤 backdrop 只保留 6px 安全邊，1440×900 實際框為 1332×888、1024×768 為 1012×674.66；畫面仍維持 3:2 且 `overflow:hidden`。準備資料文字與底部按鈕同步加大，四人 2×2 資料框仍完整落在主框中央。
- 逐框置中：標題 h2 改為填滿標題安全區後以 grid 水平／垂直置中；說明、玩家名、隊伍池／處刑台、倒數、轉盤玩家名、三段抽選狀態、結果玩家名、角色名、階級狀態均保留獨立 absolute 內框並提高最低字級。Chrome geometry 檢查桌機結果頁標題中心與視窗中心一致，四張 owner／角色名／meta 皆為 `text-align:center`。
- 轉盤與結果：四人轉盤區由 76.4%×53.5% 擴為 81%×57%，卡帶、玩家名與抽選狀態同步放大；結果區由 74%×53% 擴為 86%×57%，四張直式卡最大寬 280px 並在各 grid column 置中，人物孔因此大幅放大但仍以 `cover` 完整填框。
- 按鈕：抽籤專用 `openModal()` 會把標題內的關閉按鈕移成 modal 直屬元素；結果頁以 `left:26.4% / top:86.5% / width:22.2% / height:9.5%` 直接對齊左下圖框，正式「返回地圖」沿用右下圖框。桌機實測兩按鈕皆約 294×84，平板約 224×64，文字水平／垂直置中；準備頁「先等等／開始抽籤」使用相同兩框。非抽籤視窗再次開啟時會移除 `lottery-mode`，實測賀爾蒙注射恢復原 `modal`／`modal-back show`。
- 快取：`MARINEFORD_PAGE_VERSION` 與正式 `board_game.js` query 更新為 `20260723-marineford-lottery-layout-v6`。
- 檔案：`public/board_marineford.html`、`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 畫面驗證：Chrome 150 正式 `board=1` 四人狀態在 1440×900 重新實點處刑台抽籤，確認準備畫面、4 個轉動卡帶與結果畫面均接近滿版且沒有卷軸；結果頁四張人物圖、玩家名、角色名、階級狀態及左右按鈕逐一目視確認在圖框中央。1024×768 結果頁完整顯示，標題中心 511.99px 對應視窗中心 512px，左右按鈕 y／高度一致且沒有超出主框。
- 風險：本次只重排既有 V5 圖片式抽籤的尺寸、文字與按鈕，不改正式文字、角色圖來源、候選池、亂數、動畫時間、抽籤結果、角色／道具 id、CPU、觀看方、戰鬥、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`；未新增素材或改檔案職責，`docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 頂上戰爭 V7 抽籤主框、安全底色與文字溢出修正

- 日期：2026-07-23。
- 問題：實際回報指出 V6 將轉盤區擴到 81%、結果區擴到 86%，超過主框真正約 72% 的中央安全區，左右卡片會壓到冰／火石柱；四張新圖中央皆有透明區，既有 Marineford 舞台仍會從抽籤主框後方透出；轉盤底部長句雖在整列內，但沒有各自限制於左／中／右小格。
- 主框底色：`.modal-back.lottery-mode` 改為完全不透明 `#010408`，抽籤框外不再看見正式頁背景；`.lottery-modal::before` 只在主框中央 `left:13.7% / top:23.2% / width:72.6% / height:59.8%` 增加深海軍藍漸層實底與內陰影，四張內容圖的透明孔顯示同一深藍底，不再穿透至處刑台、角色或 Boss。
- 安全區：準備資料 grid、四個轉盤與結果 grid 統一收回 `left:14% / width:72%`。1440×900 轉盤實際 x=240.47～1199.50、結果卡 x=240.47～1199.50，均落在中央實底與主框內緣；1024×768 結果卡 x=147.67～876.30、準備卡 x=147.67～876.30，同樣沒有碰到左右石柱。
- 文字：準備頁玩家名、隊伍池、倒數與按鈕；轉盤玩家名、左／中／右三段狀態；結果頁標題、說明、玩家名、角色名、階級狀態與按鈕都各自檢查 `scrollWidth <= clientWidth`、`scrollHeight <= clientHeight`。底部三段轉盤文字新增每格獨立 grid 置中、`min-width:0`、換行與 overflow 限制，結果 meta 亦允許在原框內換行。
- 快取：`MARINEFORD_PAGE_VERSION` 與正式 `board_game.js` query 更新為 `20260723-marineford-lottery-shell-fit-v7`。
- 檔案：`public/board_marineford.html`、`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 畫面驗證：Chrome 150 正式 `board=1` 四人流程在 1440×900 實測準備、轉動中與結果三階段，中央皆為不透明深海軍藍，四張內容圖沒有超出主框；1024×768 重新檢查準備與結果，所有文字 overflow 清單均為空、主框與底部按鈕完整顯示，頁面無卷軸。
- 風險：本次只調整抽籤視窗的遮罩、中央底色、安全區與文字 overflow，不改素材檔、正式文字、候選池、亂數、動畫時間、抽籤結果、CPU、觀看方、回合、戰鬥、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`；沒有新增素材或改檔案職責，`docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 頂上戰爭 V8 抽籤提示與底部按鈕整理

- 日期：2026-07-23。
- 顯示調整：處刑台抽籤準備頁的四個玩家資料框不再重複顯示「處刑倒數 40 回合」，保留原圖片底框作為留白；白鬍子支援抽籤的「支援角色不會與其他玩家重複」維持不變。這只是準備頁文字精簡，實際處刑台仍使用原 40 回合倒數。
- 按鈕：抽籤準備頁「先等等／開始抽籤」與結果頁「關閉／返回地圖」統一使用 `clamp(16px, 1.5vw, 22px)`、粗體及單行置中；桌機 1440×900 實際字級為 21.6px、按鈕約 294×84，平板 1024×768 為 16px、按鈕約 224×64。
- 快取：`MARINEFORD_PAGE_VERSION` 與正式 `board_game.js` query 更新為 `20260723-marineford-lottery-buttons-v8`。
- 檔案：`public/board_marineford.html`、`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 畫面驗證：Chrome 150 正式 `board=1` 四人流程在 1440×900 擷取抽籤前、四個卡帶轉動中與四張結果卡三個狀態；抽籤前四個倒數文字皆為空，四個底部按鈕文字依各自圖框置中，結果卡與文字均未超出主框。1024×768 結果頁再次確認無捲軸、無文字 overflow，按鈕與四張角色卡完整顯示。
- 技術驗證：`node --check public/js/board_game.js`、`board_marineford.html` inline script 編譯與 CSS 解析、正式頁 HTTP 200、素材路徑與 `git diff --check` 均通過。
- 風險：本次沒有改候選池、亂數、動畫時間、抽籤結果、40 回合規則、CPU、觀看方、回合、戰鬥、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`；未新增素材或改檔案職責，因此 `docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 頂上戰爭 V9 轉盤加高與按鈕四向置中

- 日期：2026-07-23。
- 轉盤：四人抽籤的 `marineford_player_lottery_reel_frame.webp` 顯示比例由 3:1 改為 2.35:1，向上下增加約 28% 高度；角色卡帶人物孔從桌機約 77px 提高至 98px，四個轉盤框仍維持 2×2 並完整落在主框中央安全區。平板 1024×768 的單框約 358×152，也維持單頁無捲軸。
- 按鈕置中：準備頁「先等等／開始抽籤」及結果頁「關閉／返回地圖」的定位由 `top:86.5%` 上移至 `top:85%`，對準主底圖藍色按鈕內框；同時清除原生 button padding，使用 `place-items:center` 與 `place-content:center`。Chrome geometry 實測桌機文字中心相對按鈕中心水平誤差不超過 0.01px、垂直誤差約 0.3px，平板兩軸誤差接近 0px。
- 快取：`MARINEFORD_PAGE_VERSION` 與正式 `board_game.js` query 更新為 `20260723-marineford-lottery-height-center-v9`。
- 檔案：`public/board_marineford.html`、`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 畫面驗證：Chrome 150 正式 `board=1` 四人流程在 1440×900 重新擷取準備、轉動中與結果畫面；四個轉盤加高後沒有相互重疊，角色卡與雙指針維持在各自圖框內，四個底部按鈕文字均落在藍色內框中央。1024×768 另實測轉動中與結果畫面，頁面尺寸等於 viewport、結果文字 overflow 清單為空。
- 風險：本次只調整轉盤框顯示比例與按鈕內容定位，不改素材檔、候選池、亂數、動畫時間、抽籤結果、40 回合規則、CPU、觀看方、回合、戰鬥、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`；未新增素材或改檔案職責，因此 `docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 頂上戰爭 V10 抽籤深藍底色框內裁切

- 日期：2026-07-23。
- 問題：抽籤中央深海軍藍實底由 `.lottery-modal::before` 繪製，而主框只放在 modal background；偽元素會顯示在 element background 上方，因此深藍底邊緣可能覆蓋主底圖的下方金框與其他不透明邊飾，看起來像底色超出圖框。
- 修正：新增 `.lottery-modal::after`，以同一張 `marineford_lottery_panel_frame.webp` 作為透明最上層框罩；中央深藍底維持在 `z-index:0`，框罩位於 `z-index:2`，資料卡、轉盤、文字與按鈕仍各自在原 `z-index:4～9`。因此深藍色只會由素材本身的透明內框透出，四周金框、說明框與冰／火石柱保持完整。
- 快取：`MARINEFORD_PAGE_VERSION` 與正式 `board_game.js` query 更新為 `20260723-marineford-lottery-bg-clip-v10`。
- 檔案：`public/board_marineford.html`、`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 畫面驗證：Chrome 150 正式 `board=1` 四人流程以 1440×900 檢查準備與轉動中畫面，主框下方整條金邊、頂部說明框及左右石柱均完整壓在深藍底上方；1024×768 準備頁同樣無外溢、無文字 overflow、無捲軸。
- 風險：本次只補主框視覺遮罩，不改素材路徑、抽籤尺寸、候選池、亂數、動畫、抽籤結果、40 回合規則、CPU、觀看方、回合、戰鬥、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`；沒有新增素材或改檔案職責，因此 `docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 頂上戰爭 V11 四人轉盤最大化

- 日期：2026-07-23。
- 尺寸：四人抽籤 `.lottery-stage` 由 `left:14% / width:72% / height:57%` 擴為 `left:12.5% / width:75% / height:58.2%`，單框比例由 2.35:1 再加高至 2.16:1；上下／左右 gap 分別縮為 1.8%／1.2%，讓四個轉盤盡量填滿中央深藍區。
- 實際幾何：1440×900 單框約 494×228、人物卡帶高約 112px，四框範圍 x=220～1220、y=239～730；1024×768 單框約 375×174，四框範圍 x=133～892、y=224～597。兩種解析度仍完整位於主框內，沒有碰到下方按鈕內容或產生頁面捲軸。
- 快取：`MARINEFORD_PAGE_VERSION` 與正式 `board_game.js` query 更新為 `20260723-marineford-lottery-max-fill-v11`。
- 檔案：`public/board_marineford.html`、`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 畫面驗證：Chrome 150 正式 `board=1` 四人抽籤在 1440×900 與 1024×768 實拍轉動中畫面；四個玩家名、卡帶、中央指針與底部三段狀態均留在各自框內，主框下方金邊、左右冰火柱及底部按鈕框完整可見。
- 風險：本次只放大轉盤顯示與縮小間距，不改素材、候選池、亂數、動畫時間、抽籤結果、40 回合規則、CPU、觀看方、回合、戰鬥、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`；未新增素材或改檔案職責，因此 `docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

### 2026-07-24

#### 頂上戰爭 V12 四人轉盤滿版排列

- 問題：V11 雖已放大單框，但兩排 grid 仍保留 1.8% 人為 gap，轉盤素材本身又含上下透明邊，實際畫面中間仍形成過大的深藍留白。
- 修正：新增四人專用 `.reel-count-4` 排版，中央區設為 `left:12% / top:25.1% / width:76% / height:56.1%`；兩個 grid row 取消上下 gap，四個 `.lottery-reel` 直接 `height:100%` 填滿各自半列，並以 stage 的 `overflow:hidden` 作為背景主框內緣硬限制。
- 實際幾何：1440×900 四人轉盤區為 x=214～1226、y=229～727，單框約 500×249；1024×768 轉盤區為 x=127～897、y=216～594，單框約 380×189。兩排 CSS box 無縫銜接，中間只留下素材原有透明邊，主框頂部說明、左右石柱、下方金邊與按鈕區均完整可見。
- 快取：`MARINEFORD_PAGE_VERSION` 與正式 `board_game.js` query 更新為 `20260724-marineford-lottery-full-grid-v12`。
- 檔案：`public/board_marineford.html`、`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 畫面驗證：Chrome 150 正式 `board=1` 四人抽籤於 1440×900 與 1024×768 實拍轉動中畫面；每框玩家名、角色卡帶、中央金框／雙指針與底部狀態均未遭裁切，頁面尺寸等於 viewport，沒有捲軸。
- 風險：本次只改四人抽籤的顯示尺寸與 grid 間距，不影響 1～3 人排版，也不改素材、候選池、亂數、動畫時間、抽籤結果、40 回合規則、CPU、觀看方、回合、戰鬥、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`；未新增素材或改檔案職責，因此 `docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 頂上戰爭 V13 單人抽籤最大化

- 問題：單人抽籤仍沿用 `left:24% / top:38% / width:52% / height:auto` 的中央小轉盤，即使四人版已滿版，單人畫面仍留下大量深藍空間。
- 修正：`.reel-count-1` 改為使用 `left:12% / top:25.1% / width:76% / height:56.1%` 的完整安全區，單一 reel 直接填滿整個 grid row，stage 以 `overflow:hidden` 限制於主框內。單人 token 改為 `clamp(92px, 9vw, 126px)`，配合放大後的中央金框；玩家名、角色名、抽選狀態與中央「抽籤中」亦提高專用字級。
- 實際幾何：1440×900 單人轉盤約 1012×498，lane 約 830×244、token 約 126×234；1024×768 轉盤約 769×378，token 約 92×175。桌機和平板的 token 都保持在中央金框與左右指針可容納範圍內。
- 快取：`MARINEFORD_PAGE_VERSION` 與正式 `board_game.js` query 更新為 `20260724-marineford-lottery-solo-max-v13`。
- 檔案：`public/board_marineford.html`、`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 畫面驗證：Chrome 150 正式 `board=1` 單人狀態在 1440×900 與 1024×768 實拍轉動中畫面；單框、玩家名、角色卡帶、中央金框／雙指針與底部三段狀態均完整顯示，主框金邊與按鈕區未被遮住，頁面無捲軸。
- 風險：本次只改單人抽籤排版與單人專用字級，不影響 2～4 人配置，也不改素材、候選池、亂數、動畫時間、抽籤結果、40 回合規則、CPU、觀看方、回合、戰鬥、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`；未新增素材或改檔案職責，因此 `docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 頂上戰爭 V14 單人角色卡限制於中央抽中框

- 問題：V13 單人外框放大後，token 寬度雖依中央框調整，但高度仍使用卡帶 lane 的 `calc(100% - 10px)`，角色卡會穿過中央金框的上下內緣。
- 修正：單人 token 改為 `flex-basis:clamp(82px, 7.6vw, 110px)`、`height:78%`、`margin:0`，單人 track 使用 `align-items:center`。此比例依 `marineford_player_lottery_reel_frame.webp` 中央抽中框的透明內孔換算，使每張角色圖連同名稱都保持在框內。
- 實際幾何：1440×900 lane 約 830×244、token 約 109×190；1024×768 lane 約 631×185、token 約 82×145。Chrome 實拍確認停在中央位置的角色卡上下左右都未穿過金框與雙指針。
- 快取：`MARINEFORD_PAGE_VERSION` 與正式 `board_game.js` query 更新為 `20260724-marineford-lottery-solo-card-fit-v14`。
- 檔案：`public/board_marineford.html`、`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 畫面驗證：Chrome 150 正式 `board=1` 單人抽籤於 1440×900 與 1024×768 實拍轉動中畫面；角色卡和名稱完整落在中央金框內，外框、底部三段狀態、主框金邊與按鈕區均完整，頁面沒有捲軸。
- 風險：本次只校正單人 token 的顯示尺寸與垂直對齊，不影響 2～4 人版面，也不改素材、候選池、亂數、動畫時間、抽籤結果、40 回合規則、CPU、觀看方、回合、戰鬥、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`；未新增素材或改檔案職責，因此 `docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 頂上戰爭 V15 抽籤與開戰流程直達

- 問題：正式 `board=1` 的抽籤結果頁固定提供「返回地圖」，玩家若誤按就會離開副本，必須重新開啟頂上戰爭才能繼續；完成支援抽籤後，原本還要先關閉結果、點一次 Boss 卡啟動救援、再點一次 Boss 卡開確認、最後再按「開始戰鬥」。
- 修正：處刑台抽籤結果右下改為「繼續抽支援」，直接接上既有 `modalAfterClose = "drawSupport"`；白鬍子支援結果右下改為「挑戰目前 Boss」，直接呼叫既有 `startBattleFromEnemy()`。兩個中途結果頁不再顯示「返回地圖」，但左下「關閉」仍可留在頂上戰爭頁查看結果。
- 開戰入口：準備完成後點目前 Boss 卡或既有戰鬥按鈕，會直接依既有順序送出 `startRaid`／`startBattle` 並進入正式戰鬥，不再多開一層確認視窗；尚未完成抽籤或處刑台設定時，Boss 卡仍只會帶到下一個必要設定步驟。
- 同步：沿用 `drawCrew`、`drawSupport`、`startRaid`、`startBattle` 四個既有 `board-marineford-command`，父頁仍由 `processMarinefordPageCommand()` 驗證目前玩家控制權並建立正式戰鬥；沒有新增或改名同步事件、快照欄位、localStorage key 或 `BOARD_GAME_STATE` 欄位。
- 快取：`MARINEFORD_PAGE_VERSION` 與正式 `board_game.js` query 更新為 `20260724-marineford-direct-flow-v15`。
- 檔案：`public/board_marineford.html`、`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check public/js/board_game.js`、`board_marineford.html`／`board_game.html` inline script 語法檢查、三個正式頁 HTTP 200、`git diff --check` 全部通過；Chrome 1440×900 處刑台結果與 1024×768 支援結果實拍無捲軸或框外溢出。正式 `board=1` 從規則、兩段抽籤到「挑戰青雉」可在同頁連續完成，第二個同源視窗可收到 `startRaid`、`startBattle`，且操作方最後命令為 `startBattle`。
- 風險：本次只縮短既有 UI 導頁與確認層，不改抽籤候選池／亂數結果、Boss 順序、處刑倒數、救援骰、戰鬥內容、失敗／勝利結算、CPU、觀看方權限、回合、存檔或規則；未新增素材或改檔案職責，因此 `docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 商店圖片式 UI 素材收件準備

- 下一目標：非戰鬥正式流程中，`openShopModal()` 目前仍是米黃色清單搭配亮藍說明列，和已完成的深海軍藍／金色圖片式 UI 差異最明顯；商店又是玩家落在 `island.kind === "shop"` 時會直接出現的高頻介面，因此優先於酒館與交易改版。
- 正式流程：`resolveLanding()` 進入商店服務後由 `openShopModal()` 顯示目前貝里、商店老闆、可捲動商品清單、商品圖、名稱、折扣後售價、懸賞鎖定條件、分類／說明及「購買／懸賞不足／貝里不足／離開商店」。按下可購買商品後由 `openShopQuantityModal()` 選擇 1～99 或可負擔上限，顯示單價、最多數量與總價，再以「確定購買／取消」返回。購買後回到同一商品與原清單 scrollTop；離開才結束島嶼服務回合。
- 多人／觀看方：目前操作方仍由 `warnBoardLanTurnLocked()` 驗證控制權；`emitSpectatorModalEvent("shop", ...)` 會把商品、選取、數量選擇與購買結果送給觀看方，觀看方共用商店內容但只有「觀看中／關閉觀看」。新版必須讓兩端共用同一圖片版型，不新增私人操作給觀看方。
- 素材規劃：建立 `public/images/board/shop_ui/incoming/`，預計收取三張去背 RGBA WebP：1672×941 商店全畫面主框、1536×300 可重複商品列框、1536×1024 購買數量確認框。既有 `images/board/shops/shopkeeper.webp`、正式商品圖與商品資料全部沿用，不重畫角色或道具。
- 本次只建立收件目錄與文件索引，尚未接入正式頁；不修改商店庫存、商品 id／名稱／價格、懸賞解鎖、折扣、購買數量、背包發放、任務紀錄、CPU、回合、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。待使用者放圖後才驗收、改名並開始正式接入。

#### 商店圖片式 UI 正式接入

- 素材驗收：使用者提供的 `shop_panel_frame.webp`、`shop_item_row_frame.webp`、`shop_quantity_confirm_frame.webp` 分別為 1672×941、1536×300、1536×1024，三張皆為四通道透明 WebP；驗收後以原正式語意檔名移至 `public/images/board/shop_ui/`，正式頁未引用 `incoming/`。
- 主商店：`openShopModal()` 新增島嶼商店標題並套用 1672×941 圖片主框；貝里、既有 `shopkeeper.webp`、商品表頭、可捲動清單、選取商品說明、商品圖、「購買／懸賞不足／貝里不足」與「離開商店」都使用主圖各自的固定百分比內框。主框圖片位於底層，內容使用獨立裁切與 `overflow`，避免文字或圖片跨過金框。
- 商品列：每個 `.shop-item-row` 依 1536×300 素材維持原比例，游標、商品縮圖、名稱、折扣後價格與鎖定狀態分成五欄水平及垂直置中；選取、hover、鎖定與可捲動列表仍沿用原資料和事件。
- 數量確認：`openShopQuantityModal()` 新增 `shop-quantity-modal`，使用 1536×1024 圖片框；既有商品圖、名稱、單價、`-`、數量、`+`、最多數量、總價、「確定購買／取消」全部對應獨立內框。數量仍限制 1～99 或可負擔上限，沒有更動金額計算。
- 觀看方：`spectatorShopModal()` 同步加入主標題與五欄商品列，繼續使用同一圖片主框；操作方仍由 `warnBoardLanTurnLocked()` 驗證，觀看方按鈕保持「觀看中／關閉觀看」，`emitSpectatorModalEvent("shop", ...)` 的資料結構未改。
- 背景與快取：`openModal()`／`closeModal()` 只新增 `shop-nautical-backdrop` 的開關，商店期間使用深海軍藍遮罩；`public/board_game.html` 的 `board_game.js` query 更新為 `20260724-shop-nautical-ui-v1`。
- 實測：Chrome 150 透過正式 `board_game.html` 的 `resolveLanding()` 進入實際 `island.kind === "shop"` 商店；1440×900 與 1024×768 的主商店、數量確認皆實拍，頁面 `scrollWidth`／`scrollHeight` 等於 viewport，標題、貝里、商品列、說明、數量及按鈕無框外溢出。另實測 `+`／`-` 更新總價、購買兩件後扣除正確貝里並返回同一商品、清單 `scrollTop = 900` 經選取與取消數量確認後仍保留，以及「離開商店」正常關閉並結束服務。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`public/images/board/shop_ui/shop_panel_frame.webp`、`public/images/board/shop_ui/shop_item_row_frame.webp`、`public/images/board/shop_ui/shop_quantity_confirm_frame.webp`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 風險：本次只更換商店與數量確認的圖片式排版，不改商店庫存、商品 id／名稱／價格、折扣、懸賞解鎖、數量上限、背包發放、任務紀錄、CPU、回合、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`；規則未變，因此 `docs/GAME_RULES.md` 不需更新。

#### 商店圖片式 UI V2 圖片框安全區校正

- 問題：主商店的老闆圖過度貼近人物窗金邊；購買數量頁的商品圖使用左側整個透明窗，會進入該素材與下方減號框交疊的區域；`－／＋` 原本只有文字水平置中，沒有明確的垂直置中容器。
- 修正：`.shop-counter` 由主框的 `left:10.6% / top:22.4% / width:19.4% / height:39.4%` 收進為 `left:11.3% / top:23.6% / width:18% / height:36.9%`，四邊保留安全距離；`.shop-quantity-thumb` 改在左圖框上半部以 46% 正方形完整顯示，結束位置高於減號框，不再遮住 `－`；兩顆數量按鈕使用 `display:grid; place-items:center`，文字在按鈕框內水平及垂直置中。
- 快取：`public/board_game.html` 的 `board_game.js` query 更新為 `20260724-shop-nautical-ui-v2`。
- 畫面驗證：Chrome 150 正式 `board_game.html` 於 1440×900 與 1024×768 重拍主商店和購買數量畫面；老闆圖四邊都在人物框內，商品圖與減號框分離，`－／＋` 中心座標落在各自按鈕 box 中心，頁面沒有捲軸或 JavaScript 錯誤。
- 風險：只調整三個圖片／按鈕顯示區，不改商品資料、購買計算、數量、折扣、懸賞、背包、回合、CPU、觀看方資料或同步規則；未新增素材或檔案職責，因此 `docs/GAME_RULES.md`、`docs/FILE_MAP.md` 不需再更新。

#### 商店圖片式 UI V3 商品圖層與老闆裁切校正

- 使用者校正：購買數量頁的商品圖不是縮小避開減號，而是要填滿左側圖片窗；圖片和減號框重疊時，應由 `－` 所在的正式圖片框蓋在商品圖前方。老闆人物則要在既有人物窗內放大並移動裁切，隱藏來源圖自帶的下方木桌。
- 商品圖層：`.shop-quantity-art`／`.shop-quantity-thumb` 改為填滿左側圖片窗，商品圖使用 `object-fit:cover`；控制列提高至 `z-index:3`，並由 `::before` 重新繪製 `shop_quantity_confirm_frame.webp` 的同一段控制列裁片，讓商品圖保持滿框而 `－／數量／＋` 的原本金框與文字仍在前景完整顯示。
- 老闆裁切：`.shopkeeper-image` 在人物安全窗內改為 `scale(1.18)`，以 `transform-origin:50% 0` 從上緣放大；人物仍由 `.shop-counter` 的 `overflow:hidden` 裁切，因此來源圖底部桌面不再露出，只保留商店主框本身的木質櫃台。
- 快取：`public/board_game.html` 的 `board_game.js` query 更新為 `20260724-shop-nautical-ui-v3`。
- 畫面驗證：Chrome 150 透過正式 `board_game.html` 的 `resolveLanding()` 進入實際商店；1440×900 與 1024×768 均確認商品圖填滿圖片窗、重疊部分位於減號框後方、`－／＋` 上下左右置中，老闆放大後仍留在人物窗內且來源桌面已被裁掉。兩種尺寸的頁面 `scrollWidth`／`scrollHeight` 均等於 viewport，沒有捲軸或 JavaScript 錯誤。
- 風險：本次只調整商品圖、數量控制列與老闆圖片的顯示圖層及裁切，不改商品資料、購買計算、數量、折扣、懸賞、背包、回合、CPU、觀看方資料或同步規則；未新增素材或檔案職責，因此 `docs/GAME_RULES.md`、`docs/FILE_MAP.md` 不需再更新。

#### 戰鬥一般骰／追加骰新版 UI 素材收件準備

- 正式入口：戰鬥頁由 `public/js/board_game.js` 的 `rollBattleActionDiceWithPassives()` 先呼叫 `rollBattleActionDice()` 產生第一顆戰鬥效果骰；若我方戰鬥型被動或 T1～T3 敵人壓迫達到 `extraBattleDiceRule()` 的門檻，再產生第二顆追加骰，最後發送含 `firstDie`／`secondDie`／`settle` 的合計事件。`public/js/board_battle.js` 的 `playDiceFx()` 依同一個 `battle.visualEvent` 顯示滾動、停骰及兩骰合計，觀看方沿用完整戰鬥快照。
- 現況：正式 `public/board_battle.html` 的一般骰與追加骰共用亮藍漸層 220px 圓角方塊；追加骰在結算前沒有獨立外觀，結算時才在下方顯示較小黃色方塊，因此不易辨認第一顆、追加骰與合計關係。
- 使用者校正：戰鬥骰維持數字顯示，不需要骰子主框，也不需要 1～6 點圖片。素材縮減為兩張中央完全空白的正方形骰底圖：深海藍／青藍寶石的一般戰鬥骰，以及暗紅／紅寶石的追加戰鬥骰。
- 素材規劃：建立 `public/images/board/battle_dice_ui/incoming/`，預計只收取 2 張去背 RGBA WebP；圖片本身不含文字、數字或骰點，正式數字仍由 `diceBonusOrb`／`diceBonusSecondOrb` DOM 疊在正中央。
- 預定呈現：一般判定顯示單顆深海藍骰底圖與中央數字；觸發追加骰時，左側固定第一顆深海藍一般骰，右側顯示暗紅追加骰並滾動中央數字，最後保留兩顆數字及合計文字。標題、角色名、觸發理由、門檻與合計都繼續由正式 DOM 顯示，不烙在圖片內。
- 本次只建立收件目錄與文件索引，尚未接入正式戰鬥頁；不修改骰點亂數、追加骰門檻、倍率、被動、敵人階級、動畫時序、戰鬥回合、CPU、觀看方、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。待使用者放圖後才驗收、改名並接入正式流程。

#### 戰鬥一般骰／追加骰空白骰圖正式接入

- 素材驗收：使用者提供的 `battle_dice_blank.webp` 與 `battle_extra_dice_blank.webp` 均為 1024×1024 RGBA WebP；四角 alpha 為 0、中央 alpha 為 255，外圍透明且中央保留完整實色數字區。驗收後移至 `public/images/board/battle_dice_ui/` 根層，正式頁未引用 `incoming/`。
- 顯示：保留 `.dice-bonus-fx` 原本 `left:50% / top:46% / 220×220` 位置與標題／說明排版，只移除原亮藍 CSS 方塊、白邊與光暈，改由 `.dice-bonus-orb` 使用深海藍金框空白骰圖。`playDiceFx()` 依原 `event.isExtraDice` 切換 `is-extra-roll`，追加骰滾動及停骰時使用暗紅紅寶石空白骰圖；既有第二顆節點也固定使用暗紅追加骰圖。
- 數字：骰點仍由 `diceBonusOrb`／`diceBonusSecondOrb` 的文字內容即時更新，不改為圖片點數。數字改用 Georgia、Times New Roman 與既有襯線 fallback，搭配淡金色、深棕／暗紅描邊、壓印陰影及 tabular lining numerals；滾動、停骰放大及顯示時間沿用原動畫。
- 快取：`BATTLE_PAGE_VERSION`、`board_battle.js` query 與正式 `board_game.js` query 更新為 `20260724-battle-dice-ui-v1`。
- 畫面驗證：Chrome 150 透過正式 `board_battle_frame_test.html` 建立正式 battle snapshot，再由 `board_battle.html` 接收一般骰與 `isExtraDice` 追加骰事件；1440×900 與 1024×768 均實拍確認一般骰為深海藍、追加骰為暗紅，數字上下左右置中且古典描邊清楚，頁面 `scrollWidth`／`scrollHeight` 等於 viewport，runtime exception 為 0。戰鬥卡、人物、HUD、操作按鈕及底部區塊位置未改。
- 檔案：`public/images/board/battle_dice_ui/battle_dice_blank.webp`、`public/images/board/battle_dice_ui/battle_extra_dice_blank.webp`、`public/board_battle.html`、`public/js/board_battle.js`、`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 風險：本次只替換戰鬥骰底圖、數字字型／顏色及依既有 `isExtraDice` 事件切換外觀，不改骰點亂數、追加骰門檻、倍率、被動、敵人階級、戰鬥狀態、CPU、觀看方、回合、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`；規則未變，因此 `docs/GAME_RULES.md` 不需更新。

#### 戰鬥骰 V2／V3 黑色 Blackletter 數字與自帶字體

- V2 參考校正：依使用者提供的黑色哥德字參考圖，骰面數字由淡金 Georgia／Times 改為近黑色 Blackletter；在深海藍與暗紅骰面上保留約 1.35px 細古金描邊、短距離深色陰影及低強度暖色反光，避免黑字融入底圖。骰子位置、尺寸、標題、說明與其他戰鬥排版未改。
- V3 字體素材：使用者提供 `BattomGlory-p7Ryy-2.otf`，驗收為 70,000 bytes、內部 family `Battom Glory`、Regular、版本 1.00，著作權欄為 `Battom Glory © (Sealoung Studio). 2020. All Rights Reserved`。保留下載原檔，複製為正式 `public/fonts/board/battom-glory.otf`。
- 正式載入：`public/board_battle.html` 新增字體 preload 與 `@font-face`，骰面數字優先使用 `Battom Glory`，再 fallback 至 `Old English Text MT`／其他哥德與襯線字。字體只套用 `.dice-bonus-orb`，不影響角色名、戰鬥標題、按鈕或其他文字。
- 發布與授權：瀏覽器要顯示相同字型，部署時必須連同 `.otf` 一起提供；目前來源資料夾沒有授權文件，字體內部亦標示 All Rights Reserved。Sealoung 官方將網站嵌入列為 Web Font License、封裝 App／Game 列為 App/Game License，因此正式公開前須確認取得對應授權，不應將個人使用版本直接公開散布。
- 快取：`BATTLE_PAGE_VERSION`、`board_battle.js` query 與正式 `board_game.js` query 更新為 `20260724-battle-dice-ui-v3`。
- 畫面驗證：Chrome 150 透過正式 battle snapshot 在 1440×900 與 1024×768 分別實拍一般骰及追加骰；兩種尺寸的 `document.fonts.check('98px "Battom Glory"')` 皆為 true，字體 HTTP 200，實際六位數文字寬度與 Georgia fallback 不同，確認不是只顯示 fallback。黑色哥德數字留在原骰面中央，細金邊在深海藍／暗紅底上清楚，文件尺寸等於 viewport，runtime exception 為 0。
- 風險：只新增一份字體靜態檔與骰面數字 font family；不改骰圖、位置、尺寸、動畫、骰點、追加骰規則、戰鬥卡、按鈕、CPU、觀看方、同步或存檔。規則未變，因此 `docs/GAME_RULES.md` 不需更新。

#### 戰鬥骰 V4 更換 Phoenix Regular 字體

- 字體驗收：使用者提供 `80975832901093da08660df3fff49f5e.otf`，檔案為 61,152 bytes，內部 family `phoenix regular`、full name `phoenixregular`、Regular、Version 1.000，著作權與設計者為 cruzine；字體 metadata 另標示 `Personal Use & Commercial Use`。下載原檔保留，SHA-256 驗證後以正式語意檔名複製為 `public/fonts/board/battle-dice-display.otf`。
- 正式載入：`public/board_battle.html` 的 preload、`@font-face` 與 `.dice-bonus-orb` font family 改讀 `Board Battle Dice`／`battle-dice-display.otf`；黑色字面、約 1.35px 古金描邊、陰影、98px 尺寸、骰子位置、骰圖、動畫與其他戰鬥排版均未調整。
- 素材整理：上一版專案內未再使用的 `public/fonts/board/battom-glory.otf` 複本移除；使用者 Downloads 中的原始 Battom Glory 字體仍保留，可依需求復原比較。
- 快取：`BATTLE_PAGE_VERSION`、`board_battle.js` query 與正式 `board_game.js` query 更新為 `20260724-battle-dice-ui-v4`。
- 畫面驗證：Chrome 正式 battle snapshot 於 1440×900 與 1024×768 分別實拍一般骰及追加骰；`document.fonts.check('98px "Board Battle Dice"')` 為 true，字體及正式頁 HTTP 200，黑色 Blackletter 數字保持在一般／追加骰中央，頁面無額外捲軸或 runtime exception。
- 風險：只替換骰面數字字體靜態檔與 font family，不改骰點亂數、追加骰門檻、倍率、被動、戰鬥狀態、CPU、觀看方、同步、存檔或規則，因此 `docs/GAME_RULES.md` 不需更新。網站或遊戲發布時必須連同此 OTF 一起部署，並由發布者保存可證明使用範圍的字體授權來源。

#### 戰鬥骰 V5 數字水平加寬 50%

- 顯示調整：一般骰與追加骰的即時數字新增 `.dice-bonus-value` 內層，使用 `scaleX(1.5)` 將 glyph 水平放大至原寬度的 1.5 倍；外層 `.dice-bonus-orb` 的骰圖、尺寸、中央定位、滾動與停骰動畫全部維持原樣，因此只會拉寬文字，不會把方形骰框一起拉扁。
- 數字更新：`public/js/board_battle.js` 新增 `setDiceOrbValue()`，原本滾動亂數、初始問號、停骰結果及雙骰結果都改為更新內層文字；數字內容、亂數與動畫時間未變。
- 快取：`BATTLE_PAGE_VERSION`、`board_battle.js` query 與正式 `board_game.js` query 更新為 `20260724-battle-dice-ui-v5`。
- 畫面驗證：Chrome 150 正式 battle snapshot 於 1440×900 與 1024×768 實拍一般骰、追加骰；內層 computed transform 為 1.5 倍水平縮放，數字仍上下左右置中且未超出骰面，頁面無新增捲軸或 runtime exception。
- 風險：只更改戰鬥骰數字的顯示寬度與 DOM 文字容器，不改骰圖、骰點、追加骰規則、戰鬥狀態、CPU、觀看方、同步、存檔或規則；沒有新增素材或檔案職責，因此 `docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 戰鬥骰 V6 換回 Battom Glory 並縮細金邊

- 字體回復：依使用者選擇，正式骰面由 Phoenix Regular 換回 `Battom Glory`；下載原檔與正式 `public/fonts/board/battom-glory.otf` 的 SHA-256 已確認一致，preload、`@font-face` 與骰面 font family 均改回 Battom Glory。
- 寬度與描邊：依使用者校正取消 V5 的水平 1.5 倍放大，恢復 Battom Glory 原始字寬；古金 `-webkit-text-stroke` 由 1.35px 縮細為 0.7px，使黑色字面占比增加。一般骰、追加骰與停骰狀態仍沿用各自原本的描邊顏色與陰影。
- 素材整理：已不再引用的 `public/fonts/board/battle-dice-display.otf` 專案複本移除，使用者 Downloads 中的 Phoenix 原檔保留。
- 快取：`BATTLE_PAGE_VERSION`、`board_battle.js` query 與正式 `board_game.js` query 更新為 `20260724-battle-dice-ui-v6`。
- 畫面驗證：Chrome 150 正式 battle snapshot 於 1440×900 與 1024×768 實拍一般骰、追加骰；`document.fonts.check('98px "Battom Glory"')` 為 true，字體 HTTP 200，原始字寬的數字仍置中且未超出骰面，頁面無新增捲軸或 runtime exception。
- 風險：只切換骰面字體檔及縮細文字描邊，不改骰圖、骰點、追加骰規則、動畫、戰鬥狀態、CPU、觀看方、同步、存檔或規則；`docs/FILE_MAP.md` 已同步恢復正式字體路徑，規則未變所以 `docs/GAME_RULES.md` 不需更新。

#### 戰鬥主動換人 UI 素材收件準備

- 正式入口：玩家在正式 `public/board_battle.html` 可行動時點擊底部「夥伴」，由 `public/js/board_battle.js` 的 `renderPartners()` 在既有左下 `infoPanel` 顯示最多六名船員。可選角色透過既有 `battleChooseSwitch`／`switch` 指令交給主頁 `queuePlayerBattleSwitch()`；換人仍算一個完整動作，本回合不再攻擊。
- 原規則：目前上場角色與 HP 0 的瀕死角色不可選；黑鬍子拘束 `captureTurns` 或最終門黑轉 `blackTurns` 大於 0 時全部鎖定。戰鬥動畫中、回合已結算、已有結果、共鬥交棒中或非本機控制方也不能送出換人。CPU、共鬥與觀看方仍沿用完整 battle snapshot 與既有控制權判斷。
- 本次範圍：只建立 `public/images/board/battle_switch_ui/incoming/` 收件目錄並規劃兩張無字 RGBA WebP：1536×512 的左下換人主框與 1536×300 的可重複船員橫卡框。正式目標維持目前資訊區與底部四顆戰鬥按鈕位置，以兩欄三列同時容納完整六名船員；不改成全螢幕，也不新增取消按鈕或快捷入口。
- 後續顯示：卡片預留角色縮圖、姓名、等級／屬性、HP、剩餘 PP 與狀態文字；目前上場、瀕死、受拘束及可換角色共用同一框，由 DOM 文字、遮色與 disabled 狀態區分，不把任何名稱、數值、台詞或按鈕字烙在圖片內。
- 本次尚未接入正式頁，不修改 `renderPartners()`、`queuePlayerBattleSwitch()`、回合、戰鬥動畫、瀕死替補、司法島連戰換人、CPU、共鬥、觀看方、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。待使用者放入兩張 WebP 後才驗收、固定命名並接入正式流程。

#### 戰鬥主動換人圖片式 UI 正式接入

- 素材驗收：使用者提供的兩張 RGBA WebP 已由 `incoming/` 驗收並固定命名為 `public/images/board/battle_switch_ui/battle_switch_panel_frame.webp`（1536×512）與 `battle_switch_crew_row_frame.webp`（1536×300）；兩張素材皆保留透明外圍與完整黑鐵、深海藍、舊金框，不從正式頁引用 `incoming/`。
- 正式顯示：`public/js/board_battle.js` 的 `renderPartners()` 改為在原左下 `infoPanel` 鋪設圖片主框，最多六名船員固定排成兩欄三列；每格把正式角色戰鬥圖放入圓形人物孔，姓名、等級／屬性、HP／PP 與狀態分別對進素材預留框位。桌機與平板都不需捲動，文字與角色圖均限制在對應內框。
- 狀態與規則：目前上場顯示「上場中」、HP 0 顯示「瀕死」、黑鬍子拘束／最終門黑轉顯示「受拘束」，其餘才顯示「切換上場」並可點擊。點擊仍送出原本 `battleChooseSwitch`／`switch` 與 `{ nextIndex }`，沒有改換人算完整動作、回合、戰鬥動畫、瀕死替補、司法島連戰、CPU、共鬥、觀看方、存檔或同步規則。
- 快取：`BATTLE_PAGE_VERSION`、正式 `board_battle.js` query 與 `board_game.js` query 統一為 `20260724-battle-switch-ui-v1`。
- 驗證：`node --check public/js/board_battle.js`、`node --check public/js/board_game.js` 通過；固定入口、正式戰鬥頁、兩支 JS 與兩張正式 WebP 均 HTTP 200。Chrome 150 以正式 battle snapshot 在 1440×900、1024×768 實拍六名船員，並實測可選角色送出 `{ type: "switch", payload: { nextIndex: 1 } }`；拘束狀態全鎖、瀕死／目前上場不可點，觀看方隱藏操作盤且不能送出命令。

#### 戰鬥操作盤統一圖片素材規劃

- 使用者指定先完成整套圖片，再一次接入正式戰鬥頁；本階段只建立 `public/images/board/battle_command_ui/incoming/` 收件目錄，不先修改右側控制盤、招式盤、道具盤或逃跑盤程式。
- 正式內容盤點：右側控制盤維持「攻擊／夥伴／道具／逃跑」四鍵；招式盤最多四個正式招式；道具盤保留可用道具清單及需要時的六名船員目標選擇；逃跑盤保留條件說明、「嘗試逃跑」與二次確認的「投降」。所有名稱、PP、數量、敘述、門檻與按鈕文字都由 DOM 顯示，不烙進圖片。
- 視覺規劃：左右資訊區沿用已完成的 `battle_switch_panel_frame.webp` 作共通主框；新圖只補齊有左側徽章孔的主指令鍵、招式／道具共用純文字選項鍵、投降用暗紅危險選項鍵及說明橫框。道具選角可沿用已完成的船員橫卡框，不另畫不同風格的人物列。
- 範圍：圖片完成前不改 `renderAttack()`、`renderItems()`、`renderEscape()`、戰鬥命令、招式效果、PP、道具效果與目標條件、逃跑門檻、投降二次確認、CPU、共鬥、觀看方、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。

#### 戰鬥操作盤統一圖片式 UI 正式接入

- 素材驗收：生圖程式已將四張 RGBA WebP 放入收件區；尺寸分別為 `battle_command_action_button_frame.webp`、`battle_command_choice_button_frame.webp`、`battle_command_danger_button_frame.webp` 的 1536×424，以及 `battle_command_notice_frame.webp` 的 1536×256。逐張確認有 alpha 通道；看圖工具顯示的藍／紅／綠邊線經原始 RGBA 取樣確認 `alpha=0`，Chrome 正式頁實拍也完全不可見。正式頁只引用 `public/images/board/battle_command_ui/` 根層副本，不引用 `incoming/`。
- 右側控制盤：`public/board_battle.html` 的原四顆 `data-mode` 按鈕保留原位置、id／mode 與點擊流程，改在共通主框內排成兩欄兩列；「拳／伴／袋／跑」與「攻擊／夥伴／道具／逃跑」分別置中在圖片徽章孔和標題區。disabled、active、hover 與觀看方隱藏仍由原狀態控制。
- 招式盤：`renderAttack()` 保留最多四招與原 `battleChooseMove`／`move` 指令，改用兩欄兩列圖片選項框；招式名稱置中在上半框，威力／效果與 PP 置中在下半框，PP 0 仍 disabled。無招式時使用同系列說明橫框。
- 道具盤：`renderItems()` 的可用道具清單改用同系列兩欄圖片框，超過四筆保留垂直捲動；需要船員目標時，沿用主動換人的人物橫卡框顯示最多六名船員、HP、技能 PP、異常與「使用／HP 已滿／已倒下」等狀態，頂部同系列橫框保留返回道具清單。原 `battleUseItem`／`item`、`itemId`、`targetIndex`、存活／瀕死／回復／異常條件未改。
- 逃跑盤：原逃跑條件文字放入說明橫框，「嘗試逃跑」使用共用深藍選項框，「投降」使用暗紅危險框；`battleTryEscape`／`escape`、逃跑門檻、司法島禁止逃跑、移動型船員條件及 `window.confirm("確定要投降嗎？隊伍會全員瀕死。")` 均保留。
- 版面與快取：左下招式／道具／逃跑與右下控制盤共用 `battle_switch_panel_frame.webp`，沒有移動戰鬥卡、HUD、骰子、動畫或整體 1440×900／1024×768 排版。`BATTLE_PAGE_VERSION`、正式 `board_battle.js` query 與 `board_game.js` query 更新為 `20260724-battle-command-ui-v1`。
- 實測：Chrome 150 正式 `board_battle.html?frameTest=1` 以 1440×900、1024×768 實拍右側四鍵、四招、五筆可捲動道具、六名道具目標及逃跑／投降，頁面無水平或垂直捲軸、無 HTTP／runtime error。實際點擊確認招式送出 `{ type: "move", payload: { moveId } }`、道具目標送出 `{ type: "item", payload: { itemId, targetIndex } }`、可逃跑狀態送出 `{ type: "escape" }`；取消投降警告不送命令，觀看方隱藏右側操作盤且移除圖片操作模式。
- 風險：本次只統一正式戰鬥操作盤的圖片、DOM 結構與排版，不改戰鬥數值、招式效果、PP、道具效果、目標條件、逃跑／投降規則、回合、CPU、共鬥、觀看方控制權、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`，因此 `docs/GAME_RULES.md` 不需更新。

#### 戰鬥操作盤 V2 向上放大至角色卡下緣

- 使用者校正：左右下操作盤維持原本 `x`、48% 寬度與 2.2% 底部距離，只把上緣向上延伸到角色卡下緣附近；不縮放、上移或改動我方／敵方角色卡、HUD、骰子與中央戰鬥區。
- 正式定位：`applyLayout()` 對仍使用 `DEFAULT_LAYOUT` 之 `y=72 / h=25.8` 的 `infoPanel`、`actionPanel`，改用「我方角色卡 `y` + 實際 clamp 卡寬 − 12px」計算上緣，並保留原底部 2.2% 間距。桌機 1440×900 實測角色卡下緣約 530px、操作盤上緣約 528px；平板 1024×768 實測角色卡下緣約 479px、操作盤上緣約 476px。若使用者曾把操作盤 `y` 或 `h` 調成非預設值，仍尊重手動版位，不強制覆蓋。
- 放大結果：桌機左右盤由約 691×232 放大為 691×352，平板由約 492×198 放大為 492×275；共通主框、右側四顆徽章按鈕、四格招式、五筆測試道具、六格換人／道具目標及逃跑／投降均依新高度完整排入，文字、人物孔與狀態牌仍在各自框內。
- 快取：`BATTLE_PAGE_VERSION`、正式 `board_battle.js` query 與 `board_game.js` query 更新為 `20260724-battle-command-ui-v2`。
- 驗證：Chrome 150 以正式 battle snapshot 在 1440×900、1024×768 實拍主控制盤、四格招式、道具清單、六格道具目標、主動換人與逃跑；兩尺寸的 `scrollWidth/scrollHeight` 都等於 viewport，無新增捲軸、HTTP 4xx/5xx 或 runtime error。實際點擊可選船員仍送出 `{ type: "switch", payload: { nextIndex: 1 } }`，取消投降仍顯示原警告且不送出投降命令。
- 風險：只更改預設左右下操作盤的顯示高度與快取版本，不改任何 battle snapshot 欄位、戰鬥數值、招式、PP、道具、逃跑、投降、回合、CPU、共鬥、觀看方、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`；規則未變，所以 `docs/GAME_RULES.md` 與素材職責未變的 `docs/FILE_MAP.md` 不需更新。

#### 戰鬥操作盤 V3 圓形徽章比例修正與圖示收件

- 使用者校正：V2 把整體操作盤向上放大後，1536×424 主指令底圖隨兩列格高非等比例拉伸，導致左側圓形徽章孔變成橢圓。四顆 `.action-button` 現在固定使用素材原始 `1536 / 424` 比例，並在各自 grid 列內垂直置中；底圖填滿同一比例的按鈕容器，因此圓孔保持正圓。
- 圖示準備：建立 `public/images/board/battle_command_ui/incoming/icons/`，接收攻擊、夥伴、道具、逃跑四張 1024×1024 透明無框圖示。正式頁目前先移除圓孔內的「拳／伴／袋／跑」字樣；使用者產圖、驗收及固定命名前不會從 `incoming/` 直接引用。
- 保留範圍：V2 放大後的左右面板位置與尺寸、右側「攻擊／夥伴／道具／逃跑」文字、四個 `data-mode`、disabled／active／hover、觀看方隱藏及所有命令流程均不變。
- 快取：`BATTLE_PAGE_VERSION`、正式 `board_battle.js` query 與 `board_game.js` query 更新為 `20260724-battle-command-ui-v3`。
- 驗證：執行 `node --check public/js/board_battle.js`、`node --check public/js/board_game.js`、HTML inline script 語法檢查、素材路徑及正式頁 HTTP 200、`git diff --check`；Chrome 桌機與平板實拍確認主指令底圖維持 1536×424 比例、圓孔無非等比例變形、文字未溢出且按鈕仍可切換原本操作盤。
- 風險：本次只修正主指令底圖顯示比例、移除臨時中文字圖示並新增尚未正式引用的圖示收件目錄；不改戰鬥規則、招式、道具、逃跑、回合、CPU、共鬥、觀看方、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`，因此 `docs/GAME_RULES.md` 不需更新。

#### 戰鬥操作盤 V4 初始空盤改用正式圖片底圖

- 問題：玩家剛進戰鬥、尚未點擊攻擊／夥伴／道具／逃跑時，`renderClosedPanel()` 會清空 `infoContent` 並移除圖片式 mode，導致左下只剩舊版半透明藍黑空方格，與右側正式圖片操作盤不一致。
- 正式修正：`renderClosedPanel()` 現在保留 `battle-command-mode`，並在左下放入只有 `battle_switch_panel_frame.webp` 的空白 `.battle-command-ui`；不放標題、說明、按鈕或臨時文字。選擇任一指令後仍由既有 `renderAttack()`、`renderPartners()`、`renderItems()`、`renderEscape()` 完整替換內容。
- 圖示方向：四張圓孔圖示的生圖規格改為 1024×1024 透明背景、平面 2D RPG 指令圖示、粗黑鐵輪廓、簡化色塊與少量賽璐璐陰影；禁止寫實材質、3D 渲染、人物細節、外框、底板與文字。仍放入既有 `battle_command_ui/incoming/icons/`，本版尚未正式引用。
- 快取：`BATTLE_PAGE_VERSION`、正式 `board_battle.js` query 與 `board_game.js` query 更新為 `20260724-battle-command-ui-v4`。
- 驗證：執行 `node --check public/js/board_battle.js`、`node --check public/js/board_game.js`、HTML inline script 語法檢查、正式頁與素材 HTTP 200、`git diff --check`；Chrome 桌機與平板以正式 battle snapshot 實拍初始空盤，確認左下顯示完整新底圖、沒有舊版空方格、頁面無捲軸，並逐一點擊四顆主指令確認內容仍能切換。
- 風險：只更換關閉狀態的左下視覺內容與快取版本，不改任何指令、招式、道具、逃跑、戰鬥數值、回合、CPU、共鬥、觀看方控制權、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`，因此 `docs/GAME_RULES.md` 與素材職責未變的 `docs/FILE_MAP.md` 不需更新。

#### 戰鬥操作盤 V5 底邊延伸與格內最大化

- 面板範圍：兩個正式控制盤的上緣仍使用 V2 的角色卡下緣定位，不移動角色卡、HUD、骰子或中央戰鬥區；預設 `infoPanel`／`actionPanel` 的底部安全距離由依舊 layout 算出的 2.2% 改為固定 0.6%，讓底圖向下延伸到接近遊戲畫面最下方但保留約 5px 的桌機安全邊。
- 內容最大化：換人 grid、招式／道具／逃跑 body 與右側主指令 grid 的左右安全區由 4.15% 放寬至 3%，兩欄水平間距由 1.25% 收窄至 0.8%；左側內容下安全區由 8.5% 收至 6%，右側主指令由 4% 收至 2.5%。各按鈕因此在素材預留格內放到更大的安全尺寸。
- 比例保護：右側四顆主指令仍固定 `1536 / 424` aspect ratio，圖片與按鈕容器同尺寸，因此左側圓孔不會再次拉成橢圓；按鈕本身保留 overflow 裁切與格內置中，不超出左右外框或中央分隔。
- 快取：`BATTLE_PAGE_VERSION`、正式 `board_battle.js` query 與 `board_game.js` query 更新為 `20260724-battle-command-ui-v5`。
- 驗證：執行 `node --check public/js/board_battle.js`、`node --check public/js/board_game.js`、HTML inline script 語法檢查、正式頁與素材 HTTP 200、`git diff --check`；Chrome 桌機與平板以正式 battle snapshot 實拍初始空盤、右側主指令及左側各內容，確認底邊安全距離、正圓徽章、文字與人物不溢出、頁面無捲軸，並逐一點擊四顆主指令。
- 風險：只更改正式預設控制盤的底部顯示範圍、內容安全區與快取版本；非預設手動 layout 仍維持使用者自訂 `y/h`。不改指令、招式、道具、逃跑、戰鬥數值、回合、CPU、共鬥、觀看方、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`，因此 `docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 戰鬥操作盤 V6 平板主指令專用最大化

- 問題：V5 的共用安全區只讓 1024×768 主指令由約 222px 放大至 229px，平板實機觀看仍不明顯；桌機已符合格位，不應為了平板再次改動桌機比例。
- 平板覆寫：新增 `max-width: 1100px` 專用規則，僅把 `.battle-action-grid` 左右安全區從 3% 收至 0.8%、欄間距從 0.8% 收至 0.35%；1024×768 每顆主指令約為 242×67，900px 寬度亦會依同規則在兩欄格內放大。
- 比例與文字：四顆 `.action-button` 仍使用 `1536 / 424` aspect ratio，正圓徽章不拉伸；平板 `.action-label` 使用 16～24px 自適應字級，攻擊／夥伴／道具／逃跑均保持上下左右置中且沒有溢出。1100px 以上桌機沿用 V5，不受此覆寫影響。
- 快取：`BATTLE_PAGE_VERSION`、正式 `board_battle.js` query 與 `board_game.js` query 更新為 `20260724-battle-command-ui-v6`。
- 驗證：執行 `node --check public/js/board_battle.js`、`node --check public/js/board_game.js`、HTML inline script 語法檢查、正式頁與素材 HTTP 200、`git diff --check`；Chrome 1024×768 與 900×768 實拍四顆主指令，量測按鈕、圓孔與文字均位於主底圖內，並逐一點擊確認四個內容盤仍正常切換；1440×900 尺寸與 V5 相同。
- 風險：只新增平板寬度下的右側主指令 grid 與文字視覺覆寫，不改左側內容、桌機版、指令事件、招式、道具、逃跑、戰鬥數值、回合、CPU、共鬥、觀看方、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`，因此 `docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 戰鬥操作盤 V7 四張正式圓孔圖示接入

- 素材驗收：使用者放入四張 1024×1024 WebP，逐張確認為 sRGB、4 channels、具有 alpha；透明主體範圍分別約為攻擊 659×737、夥伴 737×616、道具 625×737、逃跑 724×737。正式根層固定命名為 `battle_command_icon_attack.webp`、`battle_command_icon_partners.webp`、`battle_command_icon_items.webp`、`battle_command_icon_escape.webp`，正式頁不引用 `incoming/`。
- 正式接入：四個既有 `data-mode` 按鈕各新增一張 `.action-symbol`；圖示安全區沿用原圓孔幾何位置 `left: 3.4% / top: 13% / width: 22.6% / height: 74%`，使用 `object-fit: contain` 與中央 object-position，讓四張不同比例的透明主體各自等比例置中。依各圖透明留白，攻擊／夥伴／道具／逃跑再分別使用 1.24／1.2／1.24／1.16 倍視覺縮放，填滿圓孔但不碰金框；只保留低強度深色 drop-shadow 增加深藍底辨識度。
- 版面保護：V6 的 1024×768 約 241×67 平板按鈕、900×768 約 212×59 按鈕、1440×900 約 322×89 桌機按鈕均不改；底框仍維持 1536×424 比例與正圓徽章，圖示不參與按鈕事件、不遮擋文字或 hover／disabled 狀態。
- 快取：`BATTLE_PAGE_VERSION`、正式 `board_battle.js` query 與 `board_game.js` query 更新為 `20260724-battle-command-ui-v7`。
- 驗證：執行 `node --check public/js/board_battle.js`、`node --check public/js/board_game.js`、HTML inline script 語法檢查、四張正式 WebP 路徑與頁面 HTTP 200、`git diff --check`；Chrome 桌機 1440×900、平板 1024×768 實拍四張圖示，確認透明主體落在圓孔內、上下左右視覺置中、文字與底框無溢出，並逐一點擊四顆按鈕確認原內容盤正常切換。
- 風險：本次只新增四張正式圖片與圓孔圖示 DOM／CSS，不改攻擊、換人、道具、逃跑、戰鬥數值、回合、CPU、共鬥、觀看方、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`，因此 `docs/GAME_RULES.md` 不需更新。

#### 戰鬥勝利／結算 V8 沿用現有圖片式 UI

- 舊版確認：正式 `renderResult()` 原本仍以 `.battle-result-title` 的藍色 CSS 漸層、純色 `.battle-result-reward` 與舊 `.choice-button` 顯示戰鬥勝利、獎勵和返回操作，與已完成的戰鬥操作盤圖片風格不一致。
- 新版版面：結算時 `actionPanel` 自動隱藏，`infoPanel.result-mode` 橫跨 `left: 2.2% / width: 96.5%` 的原兩盤區域，上緣及 0.6% 底部安全距離沿用正式控制盤。主底圖使用既有 `battle_switch_panel_frame.webp`；左側結果狀態沿用 `battle_command_notice_frame.webp`，失敗／瀕死改用暗紅 `battle_command_danger_button_frame.webp`；中央獎勵卡與右側操作按鈕沿用 `battle_command_choice_button_frame.webp`。
- 獎勵內容：單人勝利顯示一張「勝利獎勵」卡；共鬥沿用 `coopRewardDetails`，最多四名玩家依 1、2、2×2 或三張末列置中的版型顯示玩家名、貝里、懸賞金、EXP 與道具。每張獎勵卡把「貝里／懸賞金」及「EXP／道具」分成兩行並上下左右置中，文字皆由正式 snapshot 產生並限制於圖片內框，不烙進素材。
- 原流程保留：`戰鬥勝利！`、`全員瀕死`、`成功脫離戰鬥`、`夥伴瀕死，請選下一位上場`、`本輪結束` 與 `本輪處理完成` 判斷不變；返回地圖、多人換下一位、司法島中途「領取補給並換人」及單人「進入下一輪」仍送出原 `battleFinish`／`finish`。按下後依本次戰鬥／回合簽章維持兩秒 disabled 防止正式頁輪詢重畫造成連點，逾時仍可重試。
- 共用樣式保護：新版獎勵明細改用獨立 `.battle-result-reward-detail`，四皇機制與司法島下一戰換人仍使用既有 `.battle-result-box`／`.battle-result-reward-line`；兩種舊提示已回歸確認，沒有被新版結算的文字截斷規則誤套。
- 快取：`BATTLE_PAGE_VERSION`、正式 `board_battle.js` query 與 `board_game.js` query 更新為 `20260724-battle-command-ui-v8`。
- 驗證：執行 `node --check public/js/board_battle.js`、`node --check public/js/board_game.js`、HTML inline script 語法檢查、既有素材與正式頁 HTTP 200、`git diff --check`；Chrome 1440×900、1024×768 實拍單人勝利、四人共鬥勝利、失敗、逃跑、round-pause 與司法島中途勝利，檢查文字／框位與捲軸，並實測結算按鈕只送出一次原 finish 命令。
- 風險：本次只重組正式戰鬥結果 DOM、圖片與結算時的面板可見性，不改獎勵計算、敵人掉落、EXP、貝里、懸賞金、司法島階段、CPU、共鬥資料、觀看方控制權、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`，因此 `docs/GAME_RULES.md` 與未新增素材職責的 `docs/FILE_MAP.md` 不需更新。

#### 戰鬥勝利／結算 V9 結果標題與等寬放大

- 結果層級：主框上方標題不再固定重複顯示「戰鬥結果」，而是直接顯示正式判斷產生的 `戰鬥勝利！`、`全員瀕死`、`成功脫離戰鬥`、`本輪結束` 等實際結果；原左側狀態圖片框移除，結果只保留一處。
- 等寬放大：釋放出的下方空間改由獎勵區與完成操作各占 50%，兩張既有 1536×424 選項框在桌機約為 640×177、平板右側約為 469×129，保持相同比例與上下左右置中。四人共鬥仍在左半區排成 2×2；沒有獎勵的失敗、逃跑或 round-pause 則把完成按鈕置中放大。
- 獎勵物品：既有正式 `itemText`／掉落名稱仍顯示在獎勵卡第二行，不新增無資料來源的物品圖示；貝里、懸賞金、EXP 與物品字串及獎勵計算均未改。
- 快取：`BATTLE_PAGE_VERSION`、正式 `board_battle.js` query 與 `board_game.js` query 更新為 `20260724-battle-command-ui-v9`。
- 驗證：Chrome 1440×900 與 1024×768 實拍單人勝利、四人共鬥、失敗與逃跑，確認兩側等寬、無捲軸、圖片載入成功且文字沒有超出圖片內框；並重跑正式頁／JS HTTP 200、JavaScript、HTML inline script 與 `git diff --check`。
- 風險：本次只調整 V8 結算面板的資訊位置與尺寸，不改 `renderResult()` 的結果判斷、獎勵資料、finish 命令、兩秒防重送、CPU、共鬥、觀看方、存檔、Socket.IO event 或 `BOARD_GAME_STATE`，因此 `docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 戰鬥勝利／結算 V10 底緣操作與獎勵平均分配

- 操作位置：完成按鈕不再占用結算內容的右半區，改為主框下緣中央的圖片式浮動按鈕，桌機約 417×115、平板約 336×93；按鈕壓在主框下方金屬邊線上，完整留在畫面內且原 hover、disabled、兩秒防重送與 finish 指令不變。
- 單人獎勵：正式 `rewards` 拆成「貝里」「懸賞金」「EXP」「獎勵物品」四張等寬卡，平均使用主框上半部整排空間；數值與 `rewardItemText()` 仍取自同一份正式 snapshot，只改呈現方式。
- 共鬥獎勵：`coopRewardDetails` 依實際玩家數使用 1～4 欄平均分配；四人時桌機／平板皆同列四張玩家獎勵卡，每張仍保留玩家名、貝里、懸賞金、EXP 與物品。
- 快取：`BATTLE_PAGE_VERSION`、正式 `board_battle.js` query 與 `board_game.js` query 更新為 `20260724-battle-command-ui-v10`。
- 驗證：Chrome 1440×900 單人勝利與失敗、1024×768 四人共鬥實拍，確認四張獎勵框等寬、底緣按鈕置中且不被裁切、文字及圖片無溢出、無頁面捲軸；並重跑 JavaScript、HTML inline script、正式頁／JS／素材 HTTP 200 與 `git diff --check`。
- 風險：本次只改結算獎勵資料的顯示拆分與 CSS 位置，不改獎勵計算、掉落內容、司法島中途流程、多人交棒、CPU、觀看方、存檔、Socket.IO event 或 `BOARD_GAME_STATE`，因此 `docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 戰鬥勝利／結算 V11 四字操作框縮小

- 尺寸：四字完成操作（例如「返回地圖」）從 V10 的大型底緣框縮為剛好包住四字的尺寸，桌機約 222×61、平板約 210×58，仍固定在主框下緣中央並壓住金屬邊線。
- 長字保護：`領取補給並換人`、`返回地圖，換下一位` 等超過四字的正式操作會自動加上 `.is-long`，保留桌機最多 390px、平板最多 340px 的加寬框，避免司法島及多人換回合文字溢出。
- 快取：`BATTLE_PAGE_VERSION`、正式 `board_battle.js` query 與 `board_game.js` query 更新為 `20260724-battle-command-ui-v11`。
- 驗證：Chrome 1440×900 與 1024×768 實拍四字按鈕，另以 1024×768 實拍司法島長字按鈕；三者均位於下緣中央、完整顯示、無捲軸或圖片／文字溢出。JavaScript、HTML inline script、HTTP 200 與 `git diff --check` 亦重新通過。
- 風險：只依完成操作字數切換短／長圖片框寬度，不改按鈕文字、finish 指令、司法島階段、多人交棒、獎勵、CPU、同步或存檔規則。

#### 戰鬥勝利／結算 V12 獎勵框滿版與內文置中

- 框位：單人四項獎勵與四人共鬥卡仍維持一列四欄平均分配，但每張卡高度改為完整使用標題下方至底緣按鈕上方的安全區；桌機約 316×185、平板約 228×142，不再只放一條扁框而留下大面積空白。
- 文字：`.battle-result-reward-copy` 改為上下各 50% 的兩列置中區，`貝里／懸賞金／EXP／獎勵物品` 或玩家名稱置中於上半格，數值與共鬥獎勵明細置中於下半格；文字不再壓在各卡上緣金框或中間分隔線。
- 快取：`BATTLE_PAGE_VERSION`、正式 `board_battle.js` query 與 `board_game.js` query 更新為 `20260724-battle-command-ui-v12`。
- 驗證：Chrome 1440×900 單人四格、1024×768 單人四格及四人共鬥實拍，所有卡片填滿安全區、框線／標題／數值互不重疊，底緣小按鈕不受影響，圖片與文字均無溢出或頁面捲軸；JavaScript、HTML inline script、HTTP 200 與 `git diff --check` 重新通過。
- 風險：只放大結算獎勵圖片框並調整框內 CSS grid，不改獎勵字串、數值、掉落、finish、CPU、共鬥、觀看方、同步或存檔規則。

#### 正式戰鬥 HUD／進場對話圖片式 UI

- 素材驗收：使用者提供五張 RGBA WebP，固定命名為 `battle_hud_player_frame.webp`、`battle_hud_enemy_frame.webp`（1536×300）及 `battle_dialogue_player_frame.webp`、`battle_dialogue_enemy_frame.webp`、`battle_dialogue_start_frame.webp`（1536×320），正式頁只引用 `public/images/board/battle_hud_dialogue_ui/` 根層素材，不引用 `incoming/`。
- HUD：`public/board_battle.html` 的左右 `.hud-panel` 保留原定位、資料 DOM 與層級，只移除舊 CSS 藍框並在最底層鋪設我方深海藍／敵方暗紅圖片框。框圖向四周視覺放大為 103%×112%，HUD 內容使用至少水平 30px、垂直 9px 安全距離；姓名、HP、等級、屬性、攜帶物及原本疊層 Boss `X2` 都留在框內，`yonko-layered` 血條仍預留原 46px 徽章位置。
- 對話：`ensurePrebattleIntroLayer()` 的我方、敵方與戰鬥開始提示分別套用三張正式框；`ensurePhase2DialogueLayer()` 沿用敵方暗紅對話框。姓名列依圖片左上姓名牌比例使用固定 grid 高度、寬度與邊距，桌機及平板都是真正上下左右置中；台詞仍在主內容框內垂直置中。既有角色／敵人名稱、台詞、播放時間、第二階段跳過與完成回報均未修改。
- 快取：`BATTLE_PAGE_VERSION`、正式 `board_battle.js` query 與 `board_game.js` query 統一為 `20260724-battle-hud-dialogue-ui-v1`。
- 驗證：Chrome 1440×900 與 1024×768 以正式 battle snapshot 實拍 HUD、我方／敵方進場台詞與戰鬥開始框；另外以 `yonko-layered has-layer-badge` 實測 `X2` 徽章位於敵方 HUD 及放大後圖片框內，血條不與徽章重疊。`node --check`、HTML inline script、五張素材路徑、正式頁 HTTP 200 與 `git diff --check` 均通過。
- 風險：本次只更換正式戰鬥 HUD／對話圖片、DOM 圖層與置中 CSS；不改 HP 計算、疊層 Boss 規則、台詞內容、播放時序、指令、回合、CPU、共鬥、觀看方、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`，因此 `docs/GAME_RULES.md` 不需更新。

#### 正式戰鬥 HUD／進場對話 V2 去背素材替換

- 素材替換：使用者重新提供五張 Photoroom 去背版 RGBA WebP，尺寸仍為 HUD 1536×300、對話 1536×320；依原用途覆蓋 `battle_hud_player_frame.webp`、`battle_hud_enemy_frame.webp`、`battle_dialogue_player_frame.webp`、`battle_dialogue_enemy_frame.webp`、`battle_dialogue_start_frame.webp`。`incoming/unkeyed/` 內仍帶洋紅底的來源檔不接正式頁。
- 快取：五個正式圖片引用加入 `20260724-battle-hud-dialogue-ui-v2` query；`BATTLE_PAGE_VERSION`、`board_battle.js` query 與 `board_game.js` query 同步升為 V2，確保已開過 V1 的瀏覽器不沿用舊圖片快取。
- 版面：沿用 V1 已確認的 HUD 103%×112% 視覺框、水平 30px／垂直 9px 安全距離、對話姓名牌 grid 尺寸及台詞置中；沒有改角色卡、血條、疊層 `X2`、台詞或指令盤位置。
- 驗證：重新執行兩支 JS、HTML inline script、五張 WebP 規格與路徑、正式頁 HTTP 200、桌機 1440×900、平板 1024×768 及 `git diff --check`；正式頁五張圖片均由 V2 URL 載入，未引用洋紅底來源檔。
- 風險：純素材替換與快取更新，不改 HP、`X2`、戰鬥數值、台詞內容、動畫時序、回合、CPU、共鬥、觀看方、存檔、Socket.IO event 或 `BOARD_GAME_STATE`，所以 `docs/GAME_RULES.md` 與素材職責未變的 `docs/FILE_MAP.md` 不需更新。

#### 戰鬥道具清單重繪後捲動位置保持

- 問題：`refresh()` 每次接收正式 battle snapshot 都會再次呼叫 `renderPanel()`／`renderItems()`，而道具清單會重建 `.battle-command-scroll`；原 `panelScrollTops` 與輔助函式只查找 `.partner-scroll`，因此玩家向下捲動後會在下一次重繪回到 `scrollTop = 0`。
- 修正：`panelScrollTops` 新增 `items`，`rememberPanelScroll()`／`restorePanelScroll()` 支援指定 selector；`renderItems()` 重建前保存 `.battle-command-scroll`，道具按鈕及事件重新綁定後恢復同一 `scrollTop` 並持續監聽後續捲動。進入道具目標頁不會清除先前位置，返回清單仍可回到原處。
- 快取：`BATTLE_PAGE_VERSION`、正式 `board_battle.js` query 與 `board_game.js` query 更新為 `20260724-battle-item-scroll-v1`。
- 驗證：以 12 筆測試道具在 Chrome 1440×900 與 1024×768 實際捲到底部，再送入正式 `board-battle-update` 快照觸發完整重繪；桌機 `scrollTop` 由 218 重繪後仍為 218，平板由 274 重繪後仍為 274，兩尺寸均無頁面捲軸。另完成兩支 JS、HTML inline script、正式頁 HTTP 200 與 `git diff --check`。
- 風險：只保存本機戰鬥道具清單的視覺捲動位置，不寫入 battle snapshot 或 `BOARD_GAME_STATE`，不改道具資料、數量、效果、目標條件、回合、CPU、共鬥、觀看方、localStorage key 或 Socket.IO event，因此 `docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

### 2026-07-25

#### 正式醫院船員圓形底框比例修正

- 問題：醫院六張船員卡使用 1024×1024 的 `hospital_crew_status_card_frame.webp`，但 `.hospital-crew-card-frame` 原本固定為 `width: 140% / height: 104% / object-fit: fill`，使素材上方的圓形人物框被水平拉成橢圓；角色圖容器只指定百分比高度，也沒有明確的寬度基準。
- 修正：船員卡底圖改為以卡片高度 `104%` 顯示、寬度自動、`aspect-ratio: 1 / 1` 並使用 `object-fit: contain`；角色圖容器改為卡寬 `36.5%`、高度自動與 `aspect-ratio: 1 / 1`。六張卡的外框圓環、深藍人物底及角色裁切都保持正圓，姓名、HP、PP、狀態與六格位置沿用原 DOM。
- 快取：正式 `board_game.js` query 更新為 `20260725-hospital-portrait-circle-v1`；戰鬥 iframe 的 `BATTLE_PAGE_VERSION` 未變。
- 驗證：Chrome 1440×900 實測六張卡底圖 196.69×196.69、角色圖 80.11×80.11；1024×768 實測底圖 139.69×139.69、角色圖 56.89×56.89，兩者寬高比皆為 1。兩種尺寸均無文字超出船員卡、頁面水平／垂直捲軸或卡片重疊；另完成 `board_game.js`、HTML inline script、正式頁 HTTP 200 與 `git diff --check`。
- 風險：純醫院 CSS 顯示比例修正，不改 `openHospitalModal()`、船員資料、恢復費用、HP／PP 效果、能力階級清除、回合、CPU、觀看方、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`，因此 `docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 島嶼停留／繼續航行圖片式 UI 素材規劃

- 正式入口：`continueMove()` 在玩家移動途中抵達一般島嶼且仍有剩餘步數時，會呼叫 `openIslandDecision(player, stepsRemaining)`；目前舊版 modal 顯示島名、剩餘步數、`island.brief`、`island.hint`，並提供「繼續航行」與「留在島上」兩個強制選項。
- 排除流程：顛倒山改走五航線選擇；未擊敗敵人島、具有敵人的四皇島及伊姆入口會立即進入各自事件或戰鬥，不使用此選擇介面。海格遭遇、醫院／商店等實際島嶼功能介面也不在本次重做範圍。
- 原規則：選擇「繼續航行」後，無航線時才結算落點、單一路線直接續行、多路線開啟地圖航線選擇；選擇「留在島上」會清除剩餘移動與航線選擇後呼叫 `resolveLanding(player)`。`islandDecision` 仍是移動鎖與 LAN 完整狀態的一部分，本次不得改欄位、按鈕事件或控制權。
- 素材規劃：建立 `public/images/board/island_decision_ui/incoming/`，預計接收 1672×941 透明主框，以及兩張 1536×424 透明按鈕框。島嶼縮圖沿用正式 `getIslandImageUrl()`／`ISLAND_IMAGE_MAP`，島名、步數與說明全部由 DOM 動態顯示，素材不得烙字、數字、島圖或按鈕文字。
- 當時狀態：此階段只完成正式流程確認、提示詞與素材收件目錄；後續已依下節完成素材驗收、固定命名與正式接入。

#### 正式島嶼停留／繼續航行圖片式 UI

- 素材驗收：使用者提供 1672×941 主框及兩張 1536×424 按鈕框，三張皆為 sRGB、4 channels、具有 alpha 的 WebP；固定命名為 `island_decision_panel_frame.webp`、`island_decision_continue_button_frame.webp`、`island_decision_stay_button_frame.webp`，正式頁不引用 `incoming/`。
- 正式版面：`openIslandDecision()` 改用 `.island-decision-nautical-modal` 16:9 主畫面。島嶼圖沿用 `getIslandImageUrl()`／`ISLAND_IMAGE_MAP`，放在主框下層的 1:1 正圓窗口並使用海洋藍 fallback；主框、島名、剩餘步數、`island.brief`、`island.hint` 與兩顆獨立圖片按鈕依素材內框分層定位。標題、說明及按鈕文字均使用對稱安全區與上下左右置中，較長的「世界經濟新聞任務牆」及任務提示亦未溢出。
- 原流程保留：modal 使用 `force-choice`，框外點擊不能略過。`continueSailingBtn` 仍呼叫 `continueFromIslandDecision()`，依零／單一／多條航線分別落點結算、直接續行或建立 `routePrompt`；`stayOnIslandBtn` 仍清除剩餘移動後呼叫 `resolveLanding(player)`。`islandDecision` 結構、移動鎖、回合、CPU、觀看方、LAN 載入保留及 `BOARD_GAME_STATE` 均未改。
- 快取：正式 `board_game.js` query 更新為 `20260725-island-decision-ui-v1`，三張新素材 URL 使用相同版本 query。
- 實測：Chrome 150 以正式 `continueMove()` 從航線最後一格抵達醫院島及任務島，1440×900 主框為 1408×792、1024×768 主框為 992×558；島圖容器兩尺寸分別為 378.75×378.75、266.84×266.84，均維持 1:1。兩顆按鈕的文字中心與按鈕中心誤差小於 0.02px，頁面 `scrollWidth/scrollHeight` 等於 viewport。
- 按鈕驗證：點「留在島上」後 `islandDecision`／`pendingMove` 清空並開啟原醫院 UI；點「繼續航行」後保留剩餘步數、清除 `islandDecision` 並建立含正式 `routeIds` 的 `routePrompt`。點擊主框外仍維持 `force-choice` 與原 decision。
- 風險：本次只替換正式島嶼中途停留選擇的圖片、DOM 與 CSS，不改島嶼用途、敵人／四皇／伊姆立即互動排除、顛倒山分流、航線計算、落點事件、存檔、localStorage key、Socket.IO event 或同步欄位；規則未變，因此 `docs/GAME_RULES.md` 不需更新。

#### 正式醫院六名船員卡凹槽對位 V2

- 問題：圓形底框 V1 雖讓 1024×1024 船員卡與角色圖保持正圓，但 `.hospital-crew-grid` 仍使用 `left:39.65% / right:11.55% / top:26.4% / bottom:24.2%` 與過小欄距，六個 grid 儲存格比 `hospital_panel_frame.webp` 預先畫好的三欄兩列凹槽更寬、更高；六張卡因此各自壓到凹槽邊線，看起來整組跑出框。
- 修正：依 1672×941 主底圖的六個凹槽重設 grid 為 `left:41.15% / right:16.35% / top:30.5% / bottom:30.55%`，欄列間距改為 `6.8% 6.65%`。六張正方形卡框、角色圓圖、姓名、HP、PP 與狀態仍使用原 DOM 與百分比，但現在每張都以各自凹槽中央為基準，不再跨過相鄰格或主框線。
- 快取：正式 `board_game.js` query 更新為 `20260725-hospital-crew-grid-v2`；圖片素材內容與路徑未變。
- 驗證：Chrome 150 正式流程以六名船員抵達醫院並選擇「留在島上」。1440×900 的六格 grid 為 593.64×306.20、單格約 171.56×142.69；1024×768 的 grid 為 421.61×217.47、單格約 121.84×101.34。兩尺寸六張卡皆完整落在主底圖六個凹槽內，角色圓圖保持 1:1，頁面 `scrollWidth/scrollHeight` 等於 viewport。
- 風險：純醫院 grid 定位與快取版本修正，不改 `hospitalUiMarkup()`、恢復價格、HP／PP 效果、能力階級清除、回合、CPU、觀看方、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`；沒有新增或更換素材，`docs/FILE_MAP.md` 與 `docs/GAME_RULES.md` 不需更新。

#### 共鬥後臨時功能島進島／擲骰圖片式 UI

- 正式入口：敵人島被共鬥擊退並暫時轉為商店、醫院、酒館或任務島後，參與玩家留在該島；輪到該玩家的回合時，`rollDice()`、`inspectCurrentTile()` 或回合開始排程會透過 `openPendingIslandServiceChoice()` 強制顯示「進島使用功能／擲骰子出發」二選一。
- 新版版面：舊版藍色 modal 改為沿用已完成的 `island_decision_panel_frame.webp`、`island_decision_stay_button_frame.webp` 與 `island_decision_continue_button_frame.webp`。左側依 `getIslandImageUrl()` 顯示臨時商店／醫院／酒館／任務島縮圖，右側顯示原敵人島名、目前功能與剩餘回合；標題、說明、提示及兩顆按鈕文字皆依圖片內框上下左右置中。
- 原流程保留：「進入」仍先清除 `pendingIslandServiceChoice`，再呼叫既有 `enterIslandService(action)`；「擲骰子出發」仍清除待選狀態後呼叫既有 `rollDice()`。`force-choice`、LAN 控制權、`resolutionLock`、`post-battle-island-choice`／`enter`／`roll` 推送名稱、臨時功能島期限及完整 `BOARD_GAME_STATE` 結構均未更動。
- 快取：正式 `board_game.js` query 更新為 `20260725-post-battle-island-choice-ui-v1`；沿用圖片 URL 與素材內容未變。
- 實測：Chrome 150 由正式「查看目前格子」按鈕開啟臨時醫院島選擇。1440×900 主框為 1408×792、1024×768 主框為 992×558，島圖視窗分別為 378.75×378.75、266.84×266.84，頁面 `scrollWidth/scrollHeight` 均等於 viewport。點主框外不能關閉；點「進入醫院」會清除待選狀態並開啟既有正式醫院頁；預設 1 步後點「擲骰子出發」會清除待選狀態、得到 `lastRoll = 1` 並建立正式多路線 `routePrompt`。
- 風險：只替換該既有二選一畫面的 DOM 與圖片呈現，不改共鬥勝敗、臨時功能島抽選／期限、商店／醫院／酒館／任務功能、擲骰／移動、回合、CPU、觀看方、存檔、localStorage key、Socket.IO event 或同步欄位；規則未變，且沒有新增素材，因此 `docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 酒館招募圖片式 UI 素材規劃

- 正式入口：玩家落在酒館島或進入臨時酒館服務時，由 `openTavernModal()` 顯示候選船員、瑪姬、持有貝里、目前隊伍、選中角色資料、抽中率、招待次數及費用；「重點招待／招募一次／離開酒館」為既有三項操作。招募後由 `openRecruitResultModal()` 顯示收下／放棄；隊伍已滿時改為六名現有船員替換選擇。
- 保留功能：現有 `tavern_bg.webp`、`tavern_keeper_backdrop.webp` 與瑪姬 normal／half／closed／wink 四張眨眼影格全部保留。候選池、S～E 級、權重、每次招募 2500 貝里、最多 5 次重點招待、各級招待費、隊伍最低等同步、六人上限、放棄、替換、原船員攜帶物歸還、角色回招募池、CPU、觀看方及完整 `BOARD_GAME_STATE` 流程均不修改。
- 素材規劃：建立 `public/images/board/tavern_ui/incoming/`，接收 1672×941 酒館招募主框、1536×360 候選船員橫列框、1672×941 招募結果／滿隊替換共用主框及 1024×640 現有船員替換卡框，共四張透明 WebP。主框只畫深海藍、深木色、舊金、青綠寶石與少量暖琥珀酒館裝飾，不烙文字、人物、角色圖、數字、按鈕字或完整酒館背景。
- 共用素材：底部主要／次要操作框預計沿用既有正式航海圖片按鈕，不另外生成；候選與替換卡的角色圖、姓名、能力、HP／PP、機率、招待次數與狀態皆由 DOM 即時顯示。素材完成、驗收、固定命名並移出 `incoming/` 前，不修改或引用正式 `openTavernModal()`／`openRecruitResultModal()`。

#### 正式酒館招募圖片式 UI

- 備份：正式接入前已將 `public/board_game.html`、`public/js/board_game.js`、相關文件及原 `public/images/board/tavern_recruit/` 完整複製到 `.codex-runtime/revert-snapshots/20260725-tavern-before-nautical-ui-v1/`，並保存 `old-tavern-1440x900.png`；該目錄只供本次回復，不是正式來源。
- 素材驗收：使用者提供的四張素材皆為 WebP、RGBA 且具有透明外區；固定命名為 `tavern_recruit_panel_frame.webp`、`tavern_candidate_row_frame.webp`、`tavern_recruit_result_panel_frame.webp`、`tavern_replacement_card_frame.webp`，正式頁只引用 `public/images/board/tavern_ui/` 根層，不引用 `incoming/`。
- 正式主畫面：`openTavernModal()` 改用 1672×941 深海藍、深木與舊金酒館主框。保留瑪姬與原四張眨眼影格；候選名單改為可捲動橫列圖片卡，角色圖、階級、姓名、屬性、職能、抽中率與招待次數都放入素材對應內框，切換候選或重點招待後會保留原清單捲動位置。選中角色詳情、四項能力、招待費、招募費、持有貝里及「重點招待／招募一次／離開酒館」三項操作均上下左右置中於既有圖框。
- 招募結果與滿員替換：`openRecruitResultModal()` 改用共用 1672×941 結果主框；一般結果顯示新角色圖、階級、職能、屬性、抽中率、等級、能力及被動，仍提供「收下夥伴／放棄」。隊伍六人已滿時，同一右側內容區改用六張 1024×640 替換卡排列為三欄兩列，顯示現有角色、HP、PP、階級、職能與屬性，點卡仍執行原指定替換流程。
- 觀看方：酒館候選與招募結果觀看介面沿用同一組圖片版型；候選卡保持唯讀，原 `spectatorCardData()` 欄位不改，只在既有酒館觀看 detail 內補上每位候選的機率與招待次數文字。
- 操作實測：Chrome 150 的 1440×900 與 1024×768 正式頁均完成候選切換、重點招待、抽取、收下、放棄與六人滿員指定替換。重點招待由 50,000 降至 47,500 貝里且加成由 0/5 變為 1/5；收下後隊伍由 0 人增為 1 人，放棄不增加隊伍，滿員替換指定第 4 名後只有該位置換成新角色。兩尺寸主框分別為 1396.8×786.1 與 992×558.3，頁面無水平／垂直捲軸，替換六卡的 `scrollWidth/scrollHeight` 皆等於自身可視尺寸。
- 快取與風險：正式 `board_game.js` query 更新為 `20260725-tavern-nautical-ui-v1`。本次只替換酒館 DOM、CSS 與觀看 detail 顯示文字，不改候選池、S～E 級、抽取權重、價格、招待上限、最低等同步、六人上限、原船員攜帶物歸還、角色回招募池、CPU、回合、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 欄位，因此 `docs/GAME_RULES.md` 不需更新。

#### 酒館候選資訊與被動對位 V2

- 候選橫列：縮小屬性徽章的最小寬度、內距與字級，並在屬性與職能之間加入固定比例間距；桌機選中列的屬性徽章與職能文字間距為 9.33px，平板為 6.42px，不再重疊。
- 右側詳情：屬性、職能與等級拆成同一列的三個獨立欄位，以 grid 水平排列。桌機三項垂直中心差約 1.11px，平板三項中心完全一致；屬性徽章沿用候選列的小尺寸，不再把職能文字擠出框。
- 被動：移除右下「每次按招募才現場抽選」酒館規則文字，將原規則列空間併入被動框；被動區高度由 6.55% 增至 10.85%，取消兩行截斷並改為完整置中顯示。
- 驗證：Chrome 150 實測 1440×900 與 1024×768；兩尺寸被動文字的 `scrollWidth/scrollHeight` 均等於可視尺寸，頁面無水平／垂直捲軸或新增錯誤。`board_game.js` query 與酒館素材 query 更新為 `20260725-tavern-nautical-ui-v2`。
- 風險：只調整酒館資訊文字的 DOM 分欄、CSS 尺寸與快取版本，不改抽取權重、價格、招待、招募、收下、放棄、替換、CPU、觀看方資料結構、存檔或 `BOARD_GAME_STATE`，因此 `docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 酒館被動名稱與效果詳情 V3

- 正式資料來源：酒館右下被動區與一般招募結果不再只顯示 `card.passive` 名稱，改為同時顯示既有被動名稱及 `characterPassiveEffectText(card)` 的正式效果文字；沒有改寫角色資料或自行新增效果說明。
- 字級與版面：主酒館被動名稱桌機約 12.96px、效果約 10.8px，平板分別為 10px 與約 8.7px；招募結果亦以名稱／效果兩列呈現。被動框仍沿用 V2 擴大的完整右下區域，名稱使用古金色、效果使用淺色，兩者上下左右置中。
- 完整顯示驗證：Chrome 150 逐一切換目前酒館的 38 名候選，所有角色都有正式效果文字；桌機 1440×900 與平板 1024×768 均無 `scrollWidth`／`scrollHeight` 超出可視範圍、頁面捲軸或執行錯誤。一般招募結果也確認被動名稱與效果同時顯示。
- 快取與風險：正式 `board_game.js` query 與酒館素材 query 更新為 `20260725-tavern-nautical-ui-v3`。本次只顯示程式原本已使用於船員詳情的被動效果文字，不改被動效果、角色資料、戰鬥計算、招募流程、CPU、觀看方資料結構、存檔或 `BOARD_GAME_STATE`，因此 `docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 酒館被動欄放大與重新排版 V4

- 主畫面：右下被動框減少原本由百分比內距造成的左右空白，改為固定 18px 水平內距；「被動」標籤固定在 17% 左欄，被動名稱與正式效果說明在右欄上下排列並整組置中。桌機實測標籤約 13.68px、名稱約 15.12px、效果約 12.67px，效果可用寬度由約 233px 增至約 284px。
- 平板：新增 `max-width:1100px` 的酒館被動專用排版，1024×768 使用 12px 名稱、10px 效果及 12px 行高；不縮小整體酒館主框，長效果文字仍完整留在右下內框。
- 招募結果：被動名稱與效果同步放大並重新設定固定間距，仍使用同一正式效果資料來源。
- 驗證：Chrome 150 在 1440×900 與 1024×768 逐一切換 38 名候選；所有被動名稱、效果與被動 copy 容器的 `scrollWidth/scrollHeight` 均未超出可視尺寸，頁面無水平／垂直捲軸或執行錯誤。
- 快取與風險：正式 `board_game.js` query 與酒館素材 query 更新為 `20260725-tavern-nautical-ui-v4`。只調整文字尺寸、內距、行高及版位，不改任何被動或酒館規則，因此 `docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 任務島任務牆圖片式 UI 素材規劃

- 正式入口：玩家落在正式任務島或進入臨時任務島服務時，由 `enterIslandService()` 的 `kind: 'mission'` 分支呼叫 `openMissionBoardModal()`。現有介面一次顯示四個可選任務、最高可見階級、持有貝里、目前懸賞金、摩根斯與介紹文字，並保留「刷新 300 B／接取任務／共同接取／個人或共同領獎／離開任務島」等依狀態出現的既有操作。
- 功能保留：正式 `morgans_open.webp`／`morgans_blink.webp` 眨眼動畫及既有 S～E 階級素材沿用，不重畫。任務候選、刷新次數與費用、階級、類型、特殊標記、條件、四類獎勵、個人／共同任務、CPU、觀看方、LAN 及完整 `BOARD_GAME_STATE` 流程都不得更動。
- 素材規劃：建立 `public/images/board/mission_board_ui/incoming/`，接收 1672×941 全畫面主框、1536×864 可重複任務卡框，以及兩張 1536×424 主要／次要操作按鈕框，共四張透明 WebP。提示詞集中保存在 `public/images/board/mission_board_ui/mission_board_image_prompts.md`；所有動態文字、數字、階級章、人物與獎勵內容均由正式 DOM 疊放，素材不得烙字。
- 當前狀態：此階段只建立素材提示與收件目錄，沒有修改 `public/board_game.html`、`public/js/board_game.js` 或正式任務流程；素材完成、驗收、固定命名並移出 `incoming/` 前，正式頁不得引用新目錄。
- 驗證：確認提示詞檔與收件說明存在，並執行 `git diff --check`。本階段未改程式與規則，因此不需更新 `docs/PROJECT_OVERVIEW.md` 或 `docs/GAME_RULES.md`。

#### 正式任務島任務牆圖片式 UI

- 素材驗收：使用者提供的主框為 1672×941、任務卡為 1536×864、主要／次要按鈕各為 1536×424；四張皆為 WebP 且具有透明 Alpha。固定命名為 `mission_board_panel_frame.webp`、`mission_board_mission_card_frame.webp`、`mission_board_primary_button_frame.webp`、`mission_board_secondary_button_frame.webp`，移到 `public/images/board/mission_board_ui/` 根層後才由正式頁引用。
- 正式版面：`openMissionBoardModal()` 改用 1672×941 深海藍、深木與舊金主框。左側沿用 `morgans_open.webp`／`morgans_blink.webp` 及原眨眼動畫；中央四張任務卡保持 16:9，不拉伸或壓扁，任務名稱、類型、特殊標記、條件與四項摘要均依卡框定位。右側新增沿用任務日誌的 S～E 圓形階級章，條件與貝里、EXP、懸賞、物品完整值各自置中於素材格。主框透明留白以海洋藍漸層承接，不使用黑底。
- 動態操作：最高階級、目前懸賞、持有貝里、刷新、接取、共同接取、個人／共同領獎及離開按鈕仍依原狀態動態出現；主要／次要按鈕使用獨立圖片並保持原比例。刷新、接取與離開事件仍呼叫原 `refreshMissionBoard()`、`acceptMission()`／共同任務函式及 `finishIslandServiceTurn()`；觀看方任務卡與詳情沿用同一版型且維持唯讀。
- 實測：Chrome 150 從正式 `resolveLanding()` 抵達隨地圖生成的 `kind: 'mission'` 任務島。1440×900 主框為 1408×792.41，1024×768 主框為 992×558.28；四張任務卡兩尺寸皆維持 1.778 比例，五張 S～E 圓章實測寬高比皆為 1。兩尺寸頁面 `scrollWidth/scrollHeight` 均等於 viewport，圖片全數載入且沒有正式素材 404。
- 操作驗證：實際切換第二張任務後右側標題同步更新；點刷新後貝里由 67,050 降為 66,750、`refreshed` 成為 `true` 且按鈕停用；點接取後 `activeMissions` 由 0 增為 1、按鈕改顯示「已接取」；點離開後 modal 關閉並回到「擲骰前進」。正式頁與四張新素材 HTTP 200，另執行 JS、HTML inline script、素材存在及 `git diff --check`。
- 快取與風險：正式 `board_game.js` query 與四張新素材 query 更新為 `20260725-mission-board-nautical-ui-v1`。本次只替換任務牆 DOM 圖片層、圓章來源與 CSS 排版，不改任務 id、候選池、刷新費用、接取／共同任務上限、進度、獎勵、回合、CPU、觀看方 payload、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 欄位；規則未變，因此 `docs/GAME_RULES.md` 不需更新。

#### 任務牆 V2 無多餘格子與清單分級強化規劃

- 問題確認：V1 主底圖中央已畫四個固定任務槽，正式頁又疊上四張獨立任務卡，形成雙層框；底部預畫四個按鈕格，但實際操作會依任務狀態顯示 1～4 顆，因而留下空格；右側詳情與中央狀態帶也有未對應正式資料的圓孔、緞帶與裝飾凹槽。
- V2 策略：保留兩張操作按鈕、摩根斯動畫與任務日誌 S～E 圓形階級章，重畫 1672×941 主底圖及 1536×864 任務卡。中央任務區改成無分隔的連續舞台，底部改成無固定按鈕槽的連續操作區；右側詳情只保留普通尺寸階級圓孔、一條動態資訊帶、一個條件框及剛好四個獎勵格，不把右側圓章當主要視覺焦點。
- 清單分級：V2 任務卡的分級圓孔改為卡片高度 30%～33%、寬度 17%～19%，維持嚴格 1:1 並以高對比舊金雙環強化縮小後辨識度；正式頁仍疊既有 S～E 圓章，不修改任務 grade。
- 摩根斯窗口：主底圖透明人物孔要求精準 2:3、貼齊內金框且不得有第二層內縮留白；後續正式接入會讓 `morgans_open.webp`／`morgans_blink.webp` 使用 `object-fit: cover` 完全鋪滿窗口。
- 素材收件：建立 `public/images/board/mission_board_ui/incoming_v2/`，預定驗收後固定命名為 `mission_board_panel_frame_v2.webp`、`mission_board_mission_card_frame_v2.webp`。完整提示詞保存在 `public/images/board/mission_board_ui/mission_board_v2_image_prompt.md`，並以「中央不得有四格、底部不得有按鈕格、清單分級章不得過小、摩根斯窗口不得留空」作為強制負面限制。
- 當前狀態：本階段只新增提示詞、收件目錄與文件，沒有替換 V1 素材，也沒有修改 `public/board_game.html`、`public/js/board_game.js`、正式任務規則或同步。V2 完成、驗收並實際對位前，正式頁維持可回復的 V1。
- 驗證：確認 V2 提示詞與收件說明存在並執行 `git diff --check`；本階段沒有規則或正式功能變動，因此不更新 `docs/PROJECT_OVERVIEW.md` 與 `docs/GAME_RULES.md`。

#### 正式任務牆 V2 清單分級與摩根斯滿框

- 素材驗收：使用者提供的 `mission_board_panel_frame_v2.webp` 為 1672×941、`mission_board_mission_card_frame_v2.webp` 為 1536×864；兩張皆為 WebP 且具有透明 Alpha。素材已從 `incoming_v2/` 移至 `public/images/board/mission_board_ui/` 根層，正式頁不引用收件資料夾；V1 主框與任務卡保留供回復。
- 正式排版：主框中央改為無預畫四格的連續舞台，底部改為無預畫按鈕格的連續操作區，消除正式 DOM 卡片／按鈕疊上後的雙框與空格。四張任務卡使用 V2 卡框維持 16:9，清單右上分級圓章放大至卡高約 33.8%，實測仍為嚴格 1:1；右側詳情圓章維持原層級。
- 摩根斯與文字對位：開眼／眨眼圖都以 `object-fit: cover` 完整填滿人物窗，桌機實測兩張圖均為 256.95×404.13 且位置完全重合。修正介紹區百分比內距造成的窄欄斷字，以及操作按鈕百分比內距造成的一字一行；桌機與平板兩顆按鈕文字中心誤差均小於 0.7px。右側物品獎勵允許在小格內換行，不再被裁切。
- 正式流程實測：Chrome 150 從正式 `board_game.html` 的 `resolveLanding()` 進入隨地圖生成的任務島。1440×900 主框為 1408×792.41、任務卡約 296.70×166.89；1024×768 主框為 992×558.28、任務卡約 210.60×118.40。兩尺寸清單分級章分別約 56×56 與 40×40，均明顯顯示；頁面 `scrollWidth/scrollHeight` 均等於 viewport。
- 操作驗證：切換第二張卡後右側任務名稱同步更新；刷新後貝里由 67,050 降為 66,750 且刷新按鈕停用；接取後 `activeMissions` 由 0 增為 1；離開後 modal 關閉、`resolutionLock` 解除並回到「擲骰前進」。正式入口、遊戲頁與 V2 素材皆為 HTTP 200。
- 快取與風險：正式 `board_game.js` 與任務牆素材 query 更新為 `20260725-mission-board-nautical-ui-v2`。本次只替換兩張 UI 圖與 CSS 對位，不改任務 id、字串、候選、刷新費用、接取／共同任務、進度、獎勵、CPU、觀看方 payload、回合、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`，因此 `docs/GAME_RULES.md` 不需更新。

#### 任務牆 V3 階級圓章與長道具名稱對位

- 清單階級章：依 V2 任務卡右上圓孔重新量測，`.grade-mark` 由 `right: 8.5% / top: 10.5% / width: 19%` 改為 `right: 7.7% / top: 11.3% / width: 21%`。圓章不再偏上，圖像可見圓面貼合素材內圈；桌機一般卡為 62.30×62.30、平板為 44.20×44.20，維持正圓。
- 詳情階級章：`.detail-grade-mark` 由 `left: 37.5% / top: 19.5% / width: 25%` 改為 `left: 31.9% / top: 19.1% / width: 36%`，桌機為 126.72×126.72、平板為 89.27×89.27，中心分別落在右側圓框 `1191.31, 362.06` 與 `844.05, 322.04`，放大後仍未壓到外金框。
- 道具獎勵：右側第四格的完整道具名稱改用 `overflow-wrap: anywhere`、`word-break: break-all` 與受限高度的置中 flex；字級依 viewport 自動縮放。以最長案例「S級 夢幻廚房與醫療聯艙 ×1」實測，1440×900 與 1024×768 均能在第四格內換行，沒有水平溢出或越過金框。
- 驗證：Chrome 150 正式 `board_game.html` 於 1440×900、1024×768 重新開啟任務島；兩尺寸頁面的 `scrollWidth/scrollHeight` 均等於 viewport，清單與詳情圓章皆為 1:1，長道具名稱容器的 `scrollWidth` 等於 `clientWidth`。另確認正式入口、遊戲頁、JS 與 V2 素材 HTTP 200，JS／HTML inline script 語法與 `git diff --check` 通過。
- 快取與風險：正式 `board_game.js` 與任務牆素材 query 更新為 `20260725-mission-board-nautical-ui-v3`。本次只調整任務牆 CSS 對位與快取版本，不改任務資料、道具名稱、獎勵、接取、刷新、回合、CPU、觀看方 payload、存檔或 `BOARD_GAME_STATE`，因此 `docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。

#### 120 話正式主線任務與共同任務移除

- 資料：`public/js/board_missions.js` 新增 `BOARD_MAIN_MISSIONS`，共 12 章、120 話，依序涵蓋開局、顛倒山、島嶼功能、船員養成、水之七島、司法島、推進城、頂上戰爭、高階整備、四皇、艾爾巴夫／神之騎士團、伊姆與最終結局。每話都有固定順序、S～E 階級、條件、goal、貝里、EXP 與選配道具；120 個 id 與 order 均唯一。主線賞金在資料建立時將設計表原值除以 3 後四捨五入，例如 1,000 萬變為 3,333,333、10 億變為 333,333,333。
- 玩家狀態：`public/js/board_game.js` 新增每玩家 `mainMission`，包含版本、目前話數、進度、完成狀態、已領取 id 與事件統計。主線不占 6 件一般個人任務上限、不可放棄；真人達成後從任務日誌手動領取才解鎖下一話，CPU 達成後自動領取。主線貝里、賞金、EXP 與道具走專用領獎函式；主線賞金直接使用精確值，不套一般 `addBounty()` 的最低 1,000 萬增幅，主線 EXP 亦使用表列值。司法島、麥哲倫、頂上戰爭、四皇拓本及結局原獎勵均保留，不被主線取代或重複發放關鍵物。
- 事件接線：沿用既有 `recordMissionEvent()` 收集航海、海格、島嶼、商店、酒館、醫院、道具、修行、戰鬥、司法島、Marineford、四皇及結局事件，另補船長指令、擲骰、背包、船員名冊、學招／進化、顛倒山選路、船隻資訊、水之七島改造／離開、推進城樓層／逃出、司法島開戰、頂上戰爭抽人／開始／救援骰與四皇開戰入口。狀態型 goal 會直接核對目前船員數、懸賞、已探索島、船體孔位／改造、推進城、頂上戰爭、Road Poneglyph、四皇及最終篇旗標，讓舊局在對應話數解鎖時能安全回補。
- 正式日誌：`openMissionJournalModal()` 左側第一列固定顯示目前主線，其後才列一般個人任務；右側顯示第幾話、章節、條件、主線進度、固定獎勵與領取按鈕。主線列以舊金細框和「主線 n/120／主線可領」區分；完成全部 120 話後顯示「主線全破」。沿用既有 `mission_journal_ui` WebP，不新增素材；`board_missions.js` 與 `board_game.js` query 更新為 `20260725-main-story-v1`。
- 共同任務：新局不再建立 `sharedMissions`，正式任務牆不顯示共同接取／共同領獎，任務日誌也不列共同任務；`recordMissionEvent()` 不再推進共同任務。為避免破壞舊存檔，舊快照內既有 `sharedMissions` 原資料不刪除、不重設，只在正式流程中忽略。
- 存檔與同步：`mainMission` 位於玩家完整狀態內，會自然進入手動存檔、讀檔與 `BOARD_GAME_STATE`。舊存檔沒有欄位時會從 `main_001` 建立；已有主線存檔會依 `claimedMissionIds` 恢復目前話數。正式雙視窗房間 `B2738` 實測：主視窗建立 `main_001` 完成快照後兩端版本同步到 2；領取第一話後兩端同步到版本 3，皆為 `main_002`、賞金 3,333,333、貝里 3,300。
- 功能驗證：資料 VM 檢查得到 120 筆、120 個唯一 id、120 個唯一 order、0 筆缺欄；第一話實際領取後精確增加 3,333,333 賞金並解鎖第二話，第七話實際取得 `小塊帶骨肉 ×1`。舊存檔移除 `mainMission` 後正式 `loadManualGame()` 可載入並建立第一話；刻意保留的舊 `sharedMissions` 仍留在快照但日誌沒有共同任務列。
- 畫面驗證：Chrome 正式 `board_game.html` 於 1440×900 與 1024×768 開啟主線日誌；兩尺寸都完整顯示主線列、章節、條件、進度、獎勵、領獎與不可放棄按鈕，文字與按鈕沒有 scroll overflow，頁面沒有水平／垂直捲軸或 JavaScript page error。1024×768 主框約 983.03×553.23。
- 其他驗證：8787 原服務已在運行，沒有開第二個 server。`board_start.html`、`board_game.html`、兩支正式 JS 與任務日誌主框皆 HTTP 200；`node --check public/js/board_missions.js`、`node --check public/js/board_game.js`、HTML inline script 檢查、8 張任務日誌素材存在檢查及 `git diff --check` 通過。`git diff --check` 只顯示工作區原有 `public/start.html`、`server/db.js`、`server/index.js` 的 LF／CRLF 警告，沒有本次 whitespace error。
- 文件：同步更新 `docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md` 與本紀錄。未修改 server、Socket.IO event 名稱、localStorage key、一般任務 id／數值、舊卡牌遊戲或任何備份來源。

#### 戰鬥逃跑成功誤送推進城修正

- 原因：普通敵島與海格戰會由 `normalizeCoopBattleState()` 建立共鬥 runtime，即使當下只有一名參戰者。逃跑成功後該 runtime 先標記為 `escaped`，舊版 `resolveCoopSingleBattleAction()`／`resolveCoopPlannedBattleActions()` 隨後因 `coopBattleLivingParticipants()` 已為空而把整場改判成 `lose`；玩家在結算時因此被 `sendPlayerToImpelDown()` 誤送推進城。
- 修正：新增 `coopBattleEscapedParticipants()` 與 `coopBattleAllParticipantsEscaped()`。共鬥已無在場參與者時，只有「所有參與者均成功逃離」才結算為 `escape`，真正戰敗仍維持 `lose`；成功逃跑不再被後續空戰場判斷覆蓋。
- 掉頭：`finishBattle()` 的 `escape` 分支在共鬥時會逐一處理所有 `escaped` 玩家。敵島逃離者留在原島，透過既有 `markForcedReturnRoute()` 記錄來時 route／方向，下一次航行只能原路返回；不設定 `impelDown.active`。海格戰仍只結束遭遇，不新增敵島 route 狀態。
- 快取：正式 `board_game.js` query 更新為 `20260725-battle-escape-return-v1`。沒有新增 `gameState` 欄位、localStorage key、Socket.IO event 或素材；`forcedReturnRoute` 與 `BOARD_GAME_STATE` 仍沿用既有格式，因此 `docs/FILE_MAP.md` 不需更新。
- 正式按鈕實測：Chrome 150 在普通敵島戰由正式 `board_battle.html` 依序點「逃跑／嘗試逃跑」，固定骰出 6。逃跑結果保持 `escape`，戰鬥紀錄依序出現「成功脫離本場共鬥／所有共鬥玩家都已成功撤離戰鬥」；按「返回地圖」後 `battleState` 清除、`impelDown.active === false`、玩家仍位於原敵島，`forcedReturnRoute` 指向 `route-island-3-island-4`、方向 `west`。
- 多人與畫面驗證：正式入口建立兩人房 `B9002`，1440×900 操作方與 1024×768 觀看方同步收到 `result: "escape"`；完成回合交棒後兩端皆為 `battleState: null`、`impelDown.active: false`，且收到相同 `forcedReturnRoute`。兩尺寸頁面 `scrollWidth/scrollHeight` 均等於 viewport。

#### 全破後血統因子／拉夫德魯研究所企劃草案

- 安全基準：正式討論前已將目前完整專案備份到 `D:\Codex_Project_Backups\20260725-before-lineage-factor-full`，約 25.45 GB；第二輪 Robocopy 差異補齊為 0 failed、0 mismatch，D 槽資料只供大型改版失敗時恢復，不作為正式來源。
- 企劃文件：新增 `docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`，保存約克全破後複製人事件、完整血統因子機率掉落、拉夫德魯研究所製造／收藏／六人交換、永久角色實例、同名角色收藏但不得同時上船、Lv.1 培育、S／SS／SSS 實際成長但一般徽章只顯示 S、原角色突破、CPU 與多人同步的已定案方向。
- 階段規劃：將正式工作拆為角色唯一實例與舊存檔遷移、研究所資料核心、舊敵人掉落接線、全螢幕稀有掉落 UI、約克劇情與研究所入口、收藏交換 UI、培育與個體差異、舊敵人玩家模板、終局成長／原角色突破、CPU、終局敵人池、全圖鑑及完整驗證；所有需要圖片的 UI 仍必須先提供提示詞與 `incoming/`，取得並驗收 WebP 後才接正式頁。
- 目前狀態：僅建立討論企劃並更新文件地圖，沒有修改 `public/`、`server/`、角色／敵人／任務資料、存檔、localStorage、Socket.IO event 或 `BOARD_GAME_STATE`。企劃明確標記為「討論中，尚未授權實作」，後續討論會持續修訂同一份文件，待使用者要求檢查並確認後才進入第一階段。
- 文件：新增 `docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`，同步更新 `docs/FILE_MAP.md` 與本紀錄；尚無正式架構或規則變動，因此不更新 `docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`。

#### 全破後血統因子企劃修訂 V2：抽取器、小遊戲與醫院島研究所

- 抽取流程：依使用者新構想，將「戰後直接機率掉落完整血統因子」修訂為「擊敗敵人後，玩家決定是否使用自己持有的抽取器、選擇抽取器類型，再以小遊戲提高最終抽取成功率」；成功才取得一份完整血統因子，仍必須到研究所製造 Lv.1 角色。
- 小遊戲首選：企劃加入三階段「血統螺旋鎖定」方向，依序鎖定外圈掃描環、重合內外血統節點、在收縮脈衝進入安全環時封存。三段以 Perfect／Good／Miss 提供額外成功率，仍保留敵人強度與抽取器差異，正式倍率尚未定案。
- 抽取器方向：先規劃標準、精密、力／技／速共鳴、能力者與皇級類型；失敗是否消耗、放在一般背包或研究裝備庫、取得方式、持有上限、保底與是否存在必定成功型仍列為待討論。
- 研究所位置：取消「拉夫德魯變成研究所」；拉夫德魯保留原最終之島與結局功能，完成結局後改由正式醫院島轉為研究所島。為避免破壞舊存檔，企劃優先保留醫院島 id／kind，再依玩家全破資格切換名稱、圖片與服務；免費醫療整備及臨時醫院是否一併轉換仍待確認。
- 當前狀態：只修訂 `docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md` 與 `docs/FILE_MAP.md`，沒有修改正式程式、醫院 UI、敵人結算、物品、存檔、localStorage、Socket.IO event 或 `BOARD_GAME_STATE`；繼續維持「討論中，尚未授權實作」。

#### 全破後血統因子企劃修訂 V3：消耗與醫院服務定案、小遊戲具體化

- 抽取器消耗：使用者確認抽取失敗仍會消耗抽取器。企劃明定玩家在選擇畫面取消不消耗；確認開始抽取時即消耗一個，最終成功或失敗都不返還，後續重整與同步防重複需以此時點為準。
- 研究所醫療：正式醫院島在合格玩家的全破後流程中轉為研究所島時，保留原本免費全隊恢復，作為研究所內的「醫療整備」服務。
- 臨時醫院：敵人島暫時轉成的醫院維持純醫院，只保留原醫療功能，不開放船員收藏／交換、培育、突破、血統因子或圖鑑等研究所功能。
- 小遊戲說明：三階段血統螺旋鎖定仍是待確認候選，重新寫成玩家實際可見的三次單鍵時機操作：旋轉指針進入青色區、左右鎖定標記在中央重合、收縮能量環與固定金環重合。每段先顯示當下操作提示，預計 6～10 秒完成，不使用拼圖或精細拖曳。
- 當前狀態：本次只修訂 `docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md` 與本討論紀錄；沒有修改正式遊戲程式、規則資料、素材、存檔或同步狀態，且尚未取得小遊戲定案與正式實作授權。

#### 全破後血統因子企劃修訂 V4：小遊戲方向確認與抽取器來源建議

- 小遊戲定案範圍：使用者同意三階段血統螺旋鎖定方向；正式操作維持掃描定位、樣本穩定、封存完成三次單鍵時機判定。Perfect／Good／Miss 加成、速度與目標區大小仍待後續平衡。
- 圖片方向：正式抽取 UI 需使用專用圖片，不以純 CSS 圓圈與文字作為完成品。企劃先列出全螢幕研究艙主框、抽取器選擇盤、各型抽取器透明圖、三組可由程式驅動的操作圖層與成功／失敗結果面板；正式製作仍須先提供完整提示詞、建立 `incoming/`，收到使用者 WebP 後再接正式頁。
- 現有系統檢查：正式遊戲已有依懸賞開放商品的商店、E～S 個人任務、木／銅／銀／金／寶石海上寶箱及敵人獨立掉落池；共同任務已移除。抽取器來源應利用現有入口，但另行限制在玩家自己的全破解鎖後。
- 取得建議：採「研究所穩定供應＋研究委託＋高階寶箱驚喜」三條來源。莉莉絲在首次解鎖時提供教學補給；標準型可在研究所用貝里穩定補充；精密與屬性／能力者型依研究進度、個人研究委託及金／寶石箱取得；皇級不在一般商店無限販售，改由可重複累積的終局研究資源製作。
- 研究點數候選：建議全破玩家在解鎖後擊敗正式敵人即可取得個人血統研究點數，沒有抽取或抽取失敗仍會累積，避免耗盡抽取器後停擺。研究點數用於較高階抽取器，標準型仍可用貝里購買；CPU 使用自己的點數與庫存。名稱、發放量、價格、解鎖表及是否採用仍待使用者確認。
- 當前狀態：只修訂討論企劃與修改紀錄，沒有新增素材目錄，也沒有修改正式遊戲程式、道具資料、任務資料、寶箱池、存檔、localStorage、Socket.IO event 或 `BOARD_GAME_STATE`。

#### 全破後血統因子企劃修訂 V5：新島嶼初步構想

- 正式地圖現況：目前主島群是 7×7，拉夫德魯從北側五格／南側五格共十個外圍候選位置選一格現身。企劃建議利用未占用的北／南外圍海域加入全破後節點，不擴大地圖畫布、不縮小現有全螢幕比例，也不改顛倒山五航線、四皇、艾爾巴夫或拉夫德魯既有接線。
- 第一版配置建議：八座新島，採四座作品舞台、三座可擴充功能島及一座約克終局島。候選包含梅爾維尤、Gran Tesoro、End Point、艾利吉亞、複製人訓練島、四皇殘黨海域、異變因子禁區及約克移動研究島；名稱、數量與是否合併成輪替海域尚未定案。
- 必要用途：訓練島負責讓研究所新製造的 Lv.1 角色追趕終局隊伍；作品島承接電影版 Boss；四皇殘黨與異變因子島使用可持續擴充的輪替敵人池；約克研究島承接後日談主線及最高階戰鬥。
- 重複挑戰：新島不能直接沿用一般敵島被全房間清空後轉成功能島的唯一共享狀態。建議島嶼外觀與世界事件共享，但敵人挑戰、首次獎勵、抽取與刷新紀錄以玩家個人保存，確保其他玩家與 CPU 都有自己的取得機會。
- 多人候選：第一位玩家完成結局後可以讓新島外觀在全房顯形；尚未全破者只看到鎖定島影且選路時不提供新島航線，完成自己結局後才開放研究、抽取與戰鬥。此方案仍待使用者確認。
- 當前狀態：只將新島構想加入 `docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md` 與本討論紀錄，沒有修改正式地圖模板、節點、路線、素材、敵人、存檔或同步狀態。

#### 全破後血統因子企劃修訂 V6：外圍十島數量確認

- 數量：使用者指定外圍島嶼包含拉夫德魯共十座，因此配置改為「既有拉夫德魯一座＋全破後新增九座」。拉夫德魯仍依目前正式規則先從北五／南五候選位置選一格，約克事件再把九座新島配置到其餘九格。
- 地圖比例：十個外圍位置全部使用，但仍不擴大地圖畫布、不縮小 7×7 主島群，也不改顛倒山、四皇、艾爾巴夫或拉夫德魯既有功能。
- 第九座建議：將上一版示意圖的外圍安全空位改為「德爾塔島／海賊萬博會」，承接道格拉斯・巴雷特、《Stampede》敵人與大型亂戰；九座新增島正式名稱仍可在後續討論調整。
- 當前狀態：只修訂企劃數量與候選名單，沒有修改正式地圖、素材、路線、敵人、存檔或同步資料。

#### 全破後血統因子企劃修訂 V7：外圍十四島更正

- 數量更正：使用者立即將外圍配置更正為包含拉夫德魯共十四座，因此正式企劃改為「拉夫德魯一座＋全破後新增十三座」；V6 的十島數量不再採用。
- 排列方式：建議由 7×7 主島群最上排七個節點各往北接一座、最下排七個節點各往南接一座，形成北七／南七。這仍可維持目前全圖畫布及比例，但正式實作必須把拉夫德魯候選位置由北五／南五擴充為北七／南七，並檢查四個角落位置的桌機與平板安全區。
- 新增候選：在原九座候選之外加入祭典島、機關城／機械島、傑爾馬王國及蛋頭島遺址，形成七座作品舞台、兩座科學相關島、三座可擴充功能島及一座約克終局島；十三座名稱與功能仍可繼續調整。
- 示意圖：先前標示八座新島、拉夫德魯與一個空位的十位置圖片已過時，只保留討論參考，不得作為正式十四島座標來源。
- 當前狀態：只修訂企劃與修改紀錄，沒有修改正式地圖候選位置、節點、路線、素材、敵人、存檔或同步資料。

#### 全破後血統因子企劃修訂 V8：十四島改為右側四島直排

- 配置調整：依使用者想法，十四島不再採北七／南七。保留目前拉夫德魯北五／南五共十個正式候選位置，其中一格為拉夫德魯、其餘九格放九座新島；剩餘四座新島改放在地圖最右側海域直向排列。
- 右側島嶼：暫定由上至下配置祭典島、機關城／機械島、傑爾馬王國及蛋頭島遺址，各自使用獨立短海路接回 7×7 主島群右側節點。
- 相容性優點：這個方案不需要把拉夫德魯候選位置從十格擴為十四格，可保留目前 `finalIslandLocationCandidates` 的北五／南五隨機規則；正式實作只新增右側四個後日談節點與路線。
- 畫面風險：目前全圖右側仍有海域空間，但節點必須固定在現有畫布內，並實測 1440×900、1024×768 的島圖、航線、點擊範圍及工具列是否裁切；不能為了容納新島縮小使用者現有全螢幕地圖。
- 當前狀態：只修訂企劃配置，沒有修改正式地圖、拉夫德魯候選、素材、路線、存檔或同步資料。

#### 全破後血統因子企劃修訂 V9：包含拉夫德魯共二十三島

- 數量擴充：使用者依右側直排構想，將最終配置擴充為包含拉夫德魯共二十三座，即「拉夫德魯一座＋全破後新增二十二座」；V7／V8 的十四島配置不再採用。
- 空間分配：北五／南五沿用十個既有拉夫德魯外圍候選位置，其中一格為拉夫德魯、九格為新島；最右側另外直排十三座新島，總數為二十三。
- 右側航線：十三座右側島不各自用十三條橫線接回主島群，建議只設上、中、下三個主入口，其餘沿右側縱向航線互相串聯，減少線條重疊並形成獨立後日談群島。
- 名單狀態：目前已有十三座新島候選名稱，尚缺九座。企劃保留九個空白職責，不在未討論前憑空補名；後續再依電影版 Boss、四皇勢力、特殊型態、研究功能與約克主線分配。
- 示意圖：十四島右側四島直排圖片已被本次二十三島配置取代，只保留討論歷程，不得作為正式座標來源。
- 畫面風險：單一右側直排十三節點的垂直間距與點擊範圍必須以 1440×900、1024×768 實測；若完全直線導致島圖或點擊區重疊，只能在最右側窄幅範圍內微幅左右交錯，不能縮小整張地圖。
- 當前狀態：只修訂討論企劃，沒有修改正式地圖、拉夫德魯候選、素材、路線、存檔或同步資料。

#### 全破後血統因子企劃修訂 V10：上八／下八／右七與四皇延伸

- 配置更正：使用者指定二十三座必須改為上排八座、下排八座、右側直列七座；拉夫德魯包含在二十三座內，因此仍是拉夫德魯一座＋新島二十二座。V9 的北五／南五／右十三只保留討論歷程，不再作為目前配置。
- 上下排：七座分別對應 7×7 主島群七欄，最右側各再設一座銜接右側縱向群島；拉夫德魯正式候選日後需從現有北五／南五重新設計為上八／下八。
- 四皇延伸：目前四皇據點固定在四角 `island-1`、`island-7`、`island-43`、`island-49`。全破後要從四座四皇島各自向外接到上排／下排的新島，使四皇島成為終局外環航線的入口之一；四皇島戰鬥、Road Poneglyph、首通獎勵與既有狀態均不因此改動。
- 右側航線：七座右側島接在上排及下排最右轉接島之間，形成連續直列；中段可再接回主地圖右緣一次，避免七座各自拉橫線。
- 畫面風險：上、下各八座加上右側七座必須在不縮小正式全螢幕地圖的前提下檢查島圖尺寸、航線、工具列、玩家 HUD 與點擊範圍；桌機 1440×900 及平板 1024×768 都需實拍確認。
- 當前狀態：只修訂企劃與位置示意，沒有修改正式地圖、拉夫德魯候選、四皇節點、素材、存檔或同步資料。

#### 全破後血統因子企劃修訂 V11：新島航線固定五個海格

- 規格確認：每兩座直接相連的島之間固定為五個可停留海格，沿用正式地圖目前 `buildFixedSixTileRoute()`／`buildFixedFiveTileRoute()` 實際都產生五個中間 tile 的島際航線規格。
- 適用範圍：四皇島向外延伸、上排與下排、右側七島、最右轉接島及中段接回主地圖的航線都使用五格；五格按每一段相鄰島際航線分別計算，不把整條外環誤算成合計五格。
- 當前狀態：只記錄企劃規格，沒有新增正式 route、sea tile、地圖節點、存檔欄位或同步資料。

#### 全破後血統因子企劃修訂 V12：正式地圖純視覺位置預覽指令

- 日期：2026-07-25。
- 範圍：`public/board_game.html` 與 `public/js/board_game.js` 新增全破後島群的本機純視覺預覽。瀏覽器主控台輸入 `showPostgameIslands()` 會自動切到全圖，顯示上排 8、下排 8、右側 7，共 23 座（F 為拉夫德魯、其餘 1～22 為新島）；四個四皇據點以紅色圈線向外延伸，每兩座直接相連的島之間顯示 5 個海格。右側七島串起上下兩個最右轉接島，中段另以一段航線接回 `island-28`。
- 清除：輸入 `hidePostgameIslands()` 或按畫面內「關閉位置預覽」會移除全部預覽 DOM，並恢復開啟預覽前的鏡頭位置、縮放及自動跟隨狀態。
- 安全界線：預覽只建立 `.postgame-*` DOM 與本機鏡頭狀態，不加入 `boardData.islands`、`routesBetweenIslands` 或 `seaTiles`，也不修改回合、移動、CPU、四皇、拉夫德魯候選、存檔、localStorage、server save、Socket.IO event 或 `BOARD_GAME_STATE`。因此 `docs/GAME_RULES.md` 與 `docs/FILE_MAP.md` 不需更新。
- 快取：正式 `board_game.js` query 更新為 `20260725-postgame-island-layout-preview-v1`。
- 驗證：`node --check public/js/board_game.js`、正式頁與兩張沿用島圖 HTTP 200、`git diff --check`。Chrome 正式 `board_game.html` 以 1440×900 與 1024×768 執行指令，兩種尺寸都顯示 23 座、37 段航線、185 個海格及 4 個四皇延伸標記；所有預覽島均位於 viewport 內。執行顯示、正式 `renderAll()` 重繪及清除前後，序列化 `gameState` 完全相同，瀏覽器沒有 page error 或失敗資源。

#### 全破後血統因子企劃修訂 V13：右側七島逐島接回主地圖

- 日期：2026-07-25。
- 問題：V12 依先前少量入口構想，只讓右側中間島以五格航線接回 `island-28`；右側其他六島雖有縱向五格航線，卻沒有各自通往主地圖右緣的橫向海格，與上、下兩排逐島向外延伸的配置不一致。
- 修正：右側七座的 Y 座標改與正式右緣 `island-7`、`island-14`、`island-21`、`island-28`、`island-35`、`island-42`、`island-49` 對齊；七座各自新增一段五海格橫向航線接回對應節點，原本右側縱向串聯及上／下最右轉接島仍保留。右上與右下四皇據點的橫向延伸也使用紅色四皇航線。
- 安全界線：仍只修改純視覺預覽 DOM，不新增正式 island、route、sea tile、遊戲狀態、存檔欄位或同步事件。
- 快取：正式 `board_game.js` query 更新為 `20260725-postgame-island-layout-preview-v2`。
- 驗證：執行 `node --check public/js/board_game.js`、HTML inline script 檢查、正式頁／JS／沿用島圖 HTTP 200、素材存在、`git diff --check` 與尾端空白檢查。Chrome 正式 `board_game.html` 在 1440×900、1024×768 重新執行 `showPostgameIslands()`，兩種尺寸均顯示 23 座島、43 段航線及 215 個海格；右側七座全部與對應右緣節點橫向相連，所有預覽島位於 viewport 內，序列化 `gameState` 前後相同，重新載入後沒有 page error 或失敗資源。

#### 全破後血統因子企劃修訂 V14：二十二座新島 Boss 候選池

- 日期：2026-07-25。
- 正式資料盤點：目前一般敵島已有東海／樂園敵人、克洛克達爾、艾尼路、莫利亞、多佛朗明哥等；特殊流程已有司法島 CP9、推進城、海軍本部、四皇、神之騎士團與伊姆。新島不得原封不動重播同一敵人資料，只能另行設計終局型態或約克複製體。
- 作品舞台：新增島候選補齊死亡盡頭競速海域、阿斯卡島、發條島、王冠島與黃金島，連同既有七座電影舞台形成十二座電影島；傑爾馬、蛋頭遺址及複製人訓練島補滿上／下外圈十五座新島，另一格仍是拉夫德魯。
- 最右七島：草案改為四皇殘黨海域、異變因子禁區、約克移動研究島、鬼島殘骸、萬國殘黨領海、蜂巢島與十字公會懸賞港；每座的主要 Boss／幹部池已記入 `docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`，但尚未逐島獲得使用者確認。
- 特殊界線：Tot Musica、莉莉・康乃馨等舞台型／非一般人物 Boss 是否能以血統因子培育仍待定；紅髮海賊團、傳說人物及正式友方角色若成為敵人，必須明確是約克複製體或試煉資料。玩家卡、進化型態與敵方 profile 不得直接共用可變實例或數值包。
- 當前狀態：只更新討論企劃與修改紀錄，沒有新增正式島、敵人 profile、招式、素材、遊戲狀態、存檔欄位或同步事件。

#### 全破後血統因子企劃修訂 V15：Boss 名單縮減與第二版補位

- 日期：2026-07-25。
- 使用者保留：金獅子史基、吉爾德・泰佐洛、Z／捷風、Tot Musica、道格拉斯・巴雷特、薩卡／七星劍、文斯莫克・伽治、覺醒羅布・路基、KING、夏洛特・卡塔庫栗及洛克斯・D・吉貝克共十一名；V14 第一版其餘人選全部撤下。
- 洛克斯順序：洛克斯固定為第 22 名最終 Boss。必須先擊敗其他二十一名，才播放約克劇情並解鎖；不能提前加入任何一般或隨機敵池。
- 第二版補位：提出艾德華・衛布爾、阿巴羅・皮薩羅、薩坦聖、賈林古聖、邦迪・瓦爾德、帕特里克・雷德菲爾德、艾薩克、阿迪歐・蘇艾爾特，以及本遊戲原創的蒼龍・雷牙、深海皇・利維坦、合成王・亞當十一名候選。此十一名仍待使用者逐一確認。
- 當前狀態：只更新討論企劃與修改紀錄，沒有新增正式敵人、島嶼功能、招式、數值、素材、存檔欄位或同步事件。

#### 全破後血統因子企劃修訂 V16：保留雷德菲爾德並禁止本專案原創 Boss

- 日期：2026-07-25。
- 名單決議：第二版十一名補位只保留帕特里克・雷德菲爾德，其餘十名全部撤下；目前連同先前名單共保留十二名，仍缺十名。
- 來源限制：後續 Boss 只能採原作、動畫、電影、TV 特別篇或官方遊戲已存在的角色／正式型態，不得由本專案自行創作角色。V15 的三名本專案原創候選永久撤回，除非使用者日後主動改變決定。
- 第三版補位：提出 QUEEN、JACK、斯慕吉、克力架、綠牛、覺醒卡古、覺醒多佛朗明哥、毒之巨兵麥哲倫、雙能力黑鬍子及雷神艾尼路十名候選，仍待使用者逐一確認。
- 相容界線：多佛朗明哥、麥哲倫、黑鬍子與艾尼路已有正式基礎敵人資料；若特殊型態獲採用，必須新增獨立型態與平衡資料，不能覆蓋或改名舊 profile。
- 當前狀態：只更新討論企劃與修改紀錄，沒有新增正式敵人、招式、數值、素材、存檔欄位或同步事件。

#### 全破後血統因子企劃修訂 V17：保留洛基與綠牛

- 日期：2026-07-26。
- 名單決議：第三版十名補位只保留綠牛／荒牧，另由使用者加入洛基；QUEEN、JACK、斯慕吉、克力架、覺醒卡古、覺醒多佛朗明哥、毒之巨兵麥哲倫、雙能力黑鬍子及雷神艾尼路全部撤下。
- 目前數量：連同先前保留名單共十四名，仍缺八名；洛克斯繼續固定為其他二十一名全數擊敗、約克劇情播放後才解鎖的第 22 名。
- 第四版補位：提出夏姆洛克聖、軍子、納斯壽郎聖、沃丘利聖、全盛卡普、全盛戰國、全盛白鬍子及 Scopper Gaban／賈巴八名官方既有角色／時期候選，仍待使用者逐一確認。
- 原創限制：持續禁止本專案自行創作 Boss；歷史強者即使作為約克複製體，也必須沿用官方既有角色與正式時期外觀，不創造新的姓名或不存在的原創人物。
- 當前狀態：只更新討論企劃與修改紀錄，沒有新增正式敵人、招式、數值、素材、存檔欄位或同步事件。

#### 全破後血統因子企劃修訂 V18：第四版全撤與電影相關第五版

- 日期：2026-07-26。
- 名單決議：第四版的夏姆洛克聖、軍子、納斯壽郎聖、沃丘利聖、全盛卡普、全盛戰國、全盛白鬍子及賈巴八名全部不採用；目前保留十四名，仍缺八名。
- 電影盤點：使用者已保留史基、泰佐洛、Z、Tot Musica、巴雷特及薩卡，並已撤掉多名早期電影主敵，因此剩餘純劇場版主 Boss 數量有限，不能把普通幹部誤稱為同等級強敵。
- 第五版候選：提出電影原創姆休魯、莉莉・康乃馨，《FILM GOLD》前導特別篇的 Mad Treasure、《Adventure of Nebulandia》的孔明，以及電影幹部艾茵、賓茲、戴斯、芭卡拉。前四名可作獨立主 Boss，後四名依原作定位屬幹部／副 Boss。
- 特殊生命體：莉莉・康乃馨若獲採用，其抽取、培育與上船方式必須和 Tot Musica 一起確認，不能直接套一般人類血統因子規格。
- 當前狀態：只更新討論企劃與修改紀錄，沒有新增正式敵人、招式、數值、素材、存檔欄位或同步事件。

#### 全破後血統因子企劃修訂 V19：十三名前置 Boss 與洛克斯隱藏點

- 日期：2026-07-26。
- 名單暫停補位：第五版的姆休魯、莉莉・康乃馨、Mad Treasure、孔明、艾茵、賓茲、戴斯及芭卡拉全部不採用。目前先保留十三名前置 Boss 加洛克斯共十四名，不為了填滿二十二座新島硬把較弱角色升格成獨立 Boss。
- 最終解鎖：玩家必須先各自擊敗金獅子史基、吉爾德・泰佐洛、Z／捷風、Tot Musica、道格拉斯・巴雷特、薩卡／七星劍、文斯莫克・伽治、覺醒羅布・路基、KING、夏洛特・卡塔庫栗、帕特里克・雷德菲爾德、洛基及綠牛／荒牧十三名，才觸發約克後續劇情。
- 洛克斯顯現：完成十三名擊敗條件後，右側島嶼海域才從隱藏候選位置隨機顯現一個洛克斯節點。該點在解鎖前完全不可見，不占用前十三名的已顯示節點，也不加入任何一般或隨機 Boss 池。
- 待確認：右側隱藏候選座標、接線目標、顯現動畫及多人房間中由誰觸發、哪些觀看方可見，必須在正式實作前配合 `BOARD_GAME_STATE` 與個人擊敗進度設計；目前二十三座純視覺位置預覽暫不改成正式第二十四座。
- 當前狀態：只更新 `docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md` 與本討論紀錄，沒有修改正式地圖、敵人、節點、路線、素材、遊戲狀態、存檔欄位或同步事件。

#### 全破後血統因子企劃修訂 V20：拉夫德魯後先顯示上七／下七

- 日期：2026-07-26。
- 顯現順序更正：拉夫德魯劇情完整結束後，第一階段只在正式 7×7 主島群正上方補七座、正下方補七座，共十四座新島；拉夫德魯本身不計入這十四座。
- 舊案撤回：V10～V13 的上八／下八／右七共二十三座配置不再是目前定案。第一階段沒有額外的上下轉接島，也不預先顯示右側七島。
- 最終島：十三名前置 Boss 全數擊敗後，右側原本空白海域才從候選位置中隨機浮現唯一的洛克斯節點；洛克斯點不占用上七／下七的十四座位置。
- 航線原則：上下各七座分別對齊 7×7 的七欄，四個四皇島仍向外接到對應新島；每段相鄰島際航線維持五個可停留海格，不縮小目前全螢幕地圖。
- 預覽狀態：目前 `showPostgameIslands()` 仍是上八／下八／右七的舊位置草圖，本輪沒有修改正式頁或預覽程式，後續不可用該畫面宣稱已完成新配置。
- 當前狀態：只更新 `docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md` 與本討論紀錄，沒有修改正式地圖、敵人、節點、路線、素材、遊戲狀態、存檔欄位或同步事件。

#### 全破後血統因子企劃修訂 V21：酒館島轉為滿等角色競技場

- 日期：2026-07-26。
- 設施轉換：玩家完成自己的拉夫德魯劇情後，原本的正式酒館島對該玩家改為競技場；未完成自己結局的玩家仍需保留原酒館功能，不能因房內其他玩家先全破而失去正式流程入口。
- 對手池：競技場可選目前全部正式我方角色作為決鬥對手，不限玩家已擁有角色。對手一律使用遊戲目前正式等級上限出戰，但必須由角色模板建立獨立戰鬥快照，不得引用或覆寫玩家實際船員、研究所收藏或其養成資料。
- 抽取流程：打贏競技場對手後，勝利玩家再決定是否使用以及使用哪一種血統因子抽取器；確認開始後沿用既定消耗、三階段小遊戲與成功／失敗規則。滿等只適用於競技場對手，抽取成功後在研究所製造的角色仍從 Lv.1 開始。
- CPU／多人：CPU 全破後也要能挑戰競技場並依資源決定抽取；真人玩家的競技場選擇與抽取結果仍是個人進度。島圖按觀看者切換或全房顯示的方式尚待同步設計。
- 待確認：決鬥是一對一或隊伍對單人、同角色重複挑戰限制、入場費／冷卻，以及進化與特殊型態是否分開列入對手池。
- 當前狀態：只更新 `docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md` 與本討論紀錄，沒有修改正式酒館、戰鬥、角色資料、島嶼、素材、遊戲狀態、存檔欄位或同步事件。

#### 全破後血統因子企劃修訂 V22：任一玩家通關即全房世界轉換

- 日期：2026-07-26。
- 解鎖規則更正：不再要求每位玩家各自完成拉夫德魯。房間中只要任一位玩家完成拉夫德魯正式劇情，整個房間立即進入全破後世界，其他真人玩家與 CPU 同步取得全破後地圖、設施、研究與抽取入口。
- 全房變更：上方七座與下方七座新島同時顯現；所有正式醫院島改為研究所島並保留免費醫療；所有正式酒館島改為競技場。未親自通關者不再保留個人版本的舊酒館或舊醫院。
- 個人資料界線：世界地圖、設施與功能解鎖為全房共用；抽取器、血統因子、研究點數、收藏、培育角色、抽取結果及獎勵紀錄仍屬每位玩家與 CPU 個人資料，不能因共用解鎖而互相共用或覆蓋。
- 同步要求：正式實作需使用可持久化的房間世界解鎖狀態，納入存檔及 `BOARD_GAME_STATE` 完整快照；重整、讀檔、主機轉移、重新連線與後加入觀看方都要套用同一狀態，且只能觸發一次約克世界轉換。
- 待確認：十三名前置 Boss 的擊敗紀錄要全房合計，或由同一位玩家完成十三名後再讓洛克斯節點對全房顯現。
- 當前狀態：只更新 `docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md` 與本討論紀錄，沒有修改正式地圖、醫院、酒館、戰鬥、角色資料、素材、遊戲狀態、存檔欄位或同步事件。

#### 全破後血統因子企劃修訂 V23：十三張可交易約克線索

- 日期：2026-07-26。
- 取得規則：十三名前置 Boss 各對應一張固定且不同的線索紙條。全房世界解鎖後，每位玩家首次擊敗對應 Boss 時取得自己的唯一紙條；同種重複紙條不能代替缺少種類，交易出去後也不能靠重打同一 Boss 無限再生。
- 合作方式：線索紙條是可交易的個人關鍵道具。玩家可以分頭攻略不同 Boss，再把十三種紙條集中交易給同一位玩家；正式歷史本文拓本目前由 `TRADE_NON_TRADABLE_ITEM_IDS` 禁止交易，因此線索紙條只沿用拓本的收集／計數／啟動／全房顯現方式，交易能力是刻意新增的差異。
- 啟動條件：同一位玩家必須在背包中實際持有十三種不同線索，才出現「追蹤約克」入口；曾取得但已交易出去的不計。啟動後紙條沿用拓本概念保留、不消耗，世界顯現狀態只能觸發一次。
- 顯現結果：集滿者從關鍵道具背包啟動排列／解讀演出後，右側海域隨機顯現約克藏身點並接續洛克斯最終節點；節點與劇情對整個房間同步，其他玩家不需要另外再集滿十三張。
- 個人與同步：線索持有、交易及每名 Boss 的首次取得紀錄是個人資料；約克／洛克斯節點是否已顯現是房間共用狀態，必須進入存檔與 `BOARD_GAME_STATE` 快照。
- 待確認：共鬥勝利時紙條只發給主戰者，或所有尚未取得該線索的合格參戰者各自取得一張。
- 當前狀態：只更新 `docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md` 與本討論紀錄，沒有修改正式 Boss、道具、交易、背包、地圖、素材、遊戲狀態、存檔欄位或同步事件。

#### 全破後血統因子企劃修訂 V24：競技場、線索、隨機島與終局養成第一版數值

- 日期：2026-07-26。
- 競技場定案：玩家從上船六人選兩名出戰，對抗一名 Lv.99、最高進化／覺醒、最高難度配置的既有我方角色；基礎與進化型態不拆成不同對手。每次開戰雙方滿 HP、滿 PP、解除異常，競技場傷勢不帶出場；戰鬥道具可用且正常消耗，允許逃跑；同角色可無限重複挑戰。成功抽取後仍只取得未進化、Lv.1 的基礎角色。
- 線索規則覆寫 V23：每次擊敗十三名前置 Boss，所有實際參戰者各取得一張對應線索；每位玩家、每種線索均可不限次重複取得與交易。十三種不同線索仍須集中到同一位玩家的實際背包中才能啟動，重複同種不能代替缺少種類。
- 島嶼隨機：十三名前置 Boss 每局隨機分配到十三座 Boss 島並保存／同步，不因重整重抽。線索啟動後，從加入上七／下七後形成的最右側九座縱向島中隨機選一座作為延伸起點，向右接五個海格並顯示約克／洛克斯島。
- 數量待確認：上七＋下七本身已是十四座；若約克島再由最右側九座之一向右延伸，便是額外第十五座。使用者同時稱約克為第十四座，兩者無法同時成立，故正式節點與座標暫不修改。
- 洛克斯：首次擊敗後可無限重複挑戰，每次勝利都重新提供血統因子抽取選擇；約克劇情內容留待後續製作。
- 抽取數值草案：敵人 E／D、C／B、A、S、SS、SSS 基礎率暫設 55／40／28／18／10／5%；標準、精密、相符共鳴、相符能力者、皇級加成暫設 0／12／18／22／50%。Perfect／Good／Miss 每段暫設 +7／+3／+0%，最高階敵人最終封頂 75%，因此皇級加三次 Perfect 對 SSS／洛克斯為 75%。
- 抽取器經濟草案：標準 600 B、精密 1,500 B、力／技／速共鳴各 2,400 B、能力者 3,200 B；皇級不直售，研究等級 4 後以 10,000 B＋120 研究點數重複製作。另提議同角色連續失敗五次後第六次保證成功，等待使用者確認。
- 個體與重複草案：新個體一項能力 +5%、另一項 +2%、一項 -2%，其餘不變；舊角色固定六項各 +1% 均衡型。重複因子可選擇製造另一名 Lv.1 個體、作 SS／SSS 材料或解析研究點數，不允許角色融合無限疊能力。
- 突破草案：SS 建議要求 Lv.99、最高型態、被動記憶 Lv.3、修行總和 90、同角色因子 x1、20,000 B、研究點數 200；SSS 建議再要求六項修行全 30、本人擊敗洛克斯、同角色因子 x2、完美血統核心 x1、50,000 B、研究點數 500。兩階各建議六項能力 +8%，只完成一次。真正 SS／SSS 只在研究所顯示，其他 UI 統一顯示 S。
- 防洗資源建議：因競技場可無限重戰，建議不發普通貝里、懸賞金或 EXP，只發少量研究點數並提供抽取資格，等待使用者確認。
- 當前狀態：只更新 `docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md` 與本討論紀錄，沒有修改正式競技場、Boss、角色、數值、道具、交易、地圖、素材、遊戲狀態、存檔欄位或同步事件。

#### 全破後血統因子企劃修訂 V25：拉夫德魯占用上七／下七其中一格

- 日期：2026-07-26。
- 數量釐清：上排七格＋下排七格合計十四個外圍位置，其中一格本來就是拉夫德魯，不是十四座全新島。任一玩家完成拉夫德魯劇情後，只需要在剩餘十三格補入十三座前置 Boss 島。
- 第十四座新增島：十三種線索集中並啟動後，從最右側縱向九座島中隨機選一座作為延伸起點，向右接五個海格並顯示約克／洛克斯島。它是本系統第十四座新增島。
- 最終計數：本系統新增島共十四座，即十三座前置 Boss 島＋一座約克／洛克斯島；若連原本的拉夫德魯一起計算，最終外圍可見島嶼是十五座。V24 所列十四／十五座矛盾已解除。
- 當前狀態：只更正 `docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md` 與本討論紀錄，沒有修改正式地圖、拉夫德魯、Boss、路線、素材、遊戲狀態、存檔欄位或同步事件。

#### 全破後血統因子企劃修訂 V26：取消抽取保底並定案 Boss 離島重戰

- 日期：2026-07-26。
- 取消保底：V24 提議的同角色連續失敗五次、第六次必定成功不採用。每次抽取依敵人階級、抽取器與三段小遊戲獨立判定，不保存連敗次數、不提高下次機率，也沒有 100% 抽取器；皇級對最高階敵人的正常單次上限維持 75%。
- 其餘方案確認：V24 的抽取器價格／來源／成功率、Perfect／Good／Miss 加成、個體傾向、舊角色均衡型、重複因子三種用途、SS／SSS 突破門檻，以及真正 SS／SSS 只在研究所顯示均獲使用者接受，列為第一版正式企劃基準。
- 競技場獎勵：因可無限重戰，不發普通貝里、懸賞金或 EXP，只發少量研究點數並提供抽取資格；精確研究點數留待平衡測試。
- Boss 重戰：十三座前置 Boss 島與約克／洛克斯島都必須先離島，之後再次抵達才可重新挑戰；站在原島不能立即連按重戰，也不另設回合數冷卻。
- 航線自由：Boss 島不會鎖定玩家抵達時的回頭路，也不封鎖其他相連航線。玩家可原路離開，不會因尚未挑戰、逃跑、戰敗或剛獲勝而被困在島上；一名玩家的擊敗狀態也不鎖住其他玩家的挑戰入口。
- 當前狀態：只更新 `docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md` 與本討論紀錄，沒有修改正式抽取機率、競技場、Boss、島嶼路線、遊戲狀態、存檔欄位或同步事件。

#### 全破後血統因子企劃修訂 V27：抽取器、競技場獎勵、線索牌與島嶼情報

- 日期：2026-07-26。
- 文件：`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 抽取器持有：各式血統因子抽取器放入玩家背包的「重要物品」分類，不另建研究裝備庫；每一種類最多持有 99 個，開始正式抽取後仍正常消耗。
- 競技場獎勵：依對手實際強度給 10／15／25 點血統研究點數，不發普通貝里、懸賞金或 EXP；研究所外不顯示 SS／SSS 隱藏階級。
- 洛克斯核心：每次擊敗固定取得「完美血統核心」1 個；必須離島後重新登島才能再次挑戰並重複取得。
- Boss 島情報：十三座島採固定中立島名，Boss 每局仍隨機分配；玩家首次走過／抵達並確認後，地圖情報永久記住該島本局 Boss，未探索前不得提前顯示。
- 約克線索：正式名稱為「約克的線索 1～13」，視覺採 A、2～10、J、Q、K 的十三張連續撲克牌；牌面不增加額外牌型規則，交易沿用一般正式交易介面。
- 延後項目：約克終局劇情與獎勵暫留後續；抽取、小遊戲、結果、研究所、交換、培育、圖鑑、競技場、新島與線索牌 UI 仍須逐批提供完整提示詞、建立 `incoming/` 並取得正式 WebP 後才能接入。
- 本輪只修訂企劃文件，未修改正式程式、資料 id、存檔欄位、localStorage、Socket.IO event、`BOARD_GAME_STATE` 或素材。

#### 全破後血統因子企劃修訂 V28：十三座 Boss 島統一為異變島

- 日期：2026-07-26。
- 文件：`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 島嶼統一：十三座前置 Boss 島不再各自命名或使用不同地貌主題，統一顯示為「異變島 01～13」，共用同一套地圖縮圖與島內背景素材。
- 探索記憶：Boss 每局仍隨機分配；玩家首次走過／抵達並確認後，對應異變島才永久顯示本局 Boss，未探索前維持未知。
- 最終島例外：約克／洛克斯最終島仍是線索啟動後才出現的特殊島，不與十三座異變島共用名稱與正式主視覺；正式名稱留待約克終局劇情一併確認。
- 本輪只修訂企劃文件，未修改正式地圖、Boss 分配、素材、遊戲狀態、存檔欄位或同步事件。

#### 全破後血統因子企劃修訂 V29：前置 Boss 島正式命名

- 日期：2026-07-26。
- 文件：`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 正式名稱：V28 的暫名「異變島」由使用者改為「無風帶孤島」；十三座節點統一顯示為「無風帶孤島 01～13」。
- 素材與情報規則不變：十三座島共用同一套地圖縮圖、島內背景與 UI；Boss 每局隨機分配，玩家探索後才永久顯示該島本局 Boss。
- 約克／洛克斯最終島仍是獨立特殊島，名稱與主視覺留待終局劇情確認。
- 本輪只修訂企劃文件，未修改正式地圖、Boss 分配、素材、遊戲狀態、存檔欄位或同步事件。

#### 全破後血統因子企劃修訂 V30：蛋頭島、交易權限與洛克斯獎勵

- 日期：2026-07-26。
- 文件：`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 最終島：第十四座新增島正式定名為「蛋頭島」；劇情設定為約克把整座蛋頭島移走並藏在無風帶深處，集齊十三種線索後才抽選延伸位置並顯現。
- 交易權限：約克線索牌與各式抽取器可沿用正式一般交易流程；完整血統因子不可交易，研究所角色實例也不能在玩家之間交換或交易。
- 洛克斯重複獎勵：每次勝利的每位實際參戰者各取得完美血統核心 1 個、研究點數 25 點及一次個人抽取機會。
- 洛克斯首次獎勵：每位玩家首次實際參與並擊敗洛克斯時，另外取得一款專屬外觀框；正式名稱與圖案留待終局素材階段確認。
- 競技場分級：使用者同意由正式角色資料整理 10／15／25 點三檔清單後再確認，不依角色印象直接指定。
- 競技場盤點結果：`public/js/board_cards.js` 正式基礎目錄目前共有 51 名角色。第一版草案採 T1＝25 點、T2／T3＝15 點、T4／T5／T6＝10 點，最高進化仍用於實戰但不拆成獨立對手或另一份獎勵；完整名單已寫入企劃書，等待使用者確認。
- 延後項目：約克終局劇情與蛋頭島顯現演出後續再談；所有新版 UI 仍須逐批提供提示詞、建立 `incoming/` 並取得 WebP。
- 本輪只修訂企劃文件並進行正式角色資料的唯讀盤點，未修改程式、角色資料、地圖、素材、存檔欄位或同步事件。

#### 全破後血統因子企劃修訂 V31：競技場分級與洛克斯框正式確認

- 日期：2026-07-26。
- 文件：`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 競技場正式分級：使用者確認採用 T1＝25 點、T2／T3＝15 點、T4／T5／T6＝10 點；目前 51 名正式角色依既有 `tier` 自動歸類，最高進化不拆成另一名對手或另一份獎勵。
- 洛克斯外觀框：沿用既有成就外觀框解鎖規則；每位玩家第一次實際參戰並擊敗洛克斯時永久解鎖一次，之後重複擊敗不再發放或累加。
- 待後續素材：外觀框正式名稱、圖案與圖層素材仍在終局 UI 階段先提供提示詞、建立 `incoming/` 並取得 WebP。
- 本輪只修訂企劃文件，未修改競技場、外觀框資料、解鎖判斷、角色、戰鬥、存檔欄位或同步事件。

#### 全破後血統因子企劃修訂 V32：鎖定正式製作順序

- 日期：2026-07-26。
- 文件：`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 使用者確認正式製作必須按照企劃階段順序完成。企劃新增強制閘門：第 0～13 階段不得跳階、倒序或提前接入後段功能。
- 每次只處理一個階段；完成該階段的資料相容、正式流程、多人同步、CPU、桌機／平板、文件與對應驗證並回報使用者確認後，才能進入下一階段。
- 需要圖片的階段仍必須先給完整提示詞並建立專用 `incoming/`，收到並檢查正式 WebP 後才接入；前階段若有存檔、同步或驗證問題，必須原地修正，不得留到後段。
- 本輪只修訂企劃文件，未開始第 1 階段，也未修改正式程式、資料、素材、存檔欄位或同步事件。

#### 全破後血統因子企劃修訂 V33：無風帶消失與約克逃亡主線骨架

- 日期：2026-07-26。
- 文件：`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 世界變化：任一玩家完成拉夫德魯正式劇情後，原結局造成的世界變化使無風帶消失，原本被隔絕、難以觀測與通航的十三座孤島及新海路才顯露；島嶼不是結局後憑空生成。
- 約克伏筆：約克早已掌握進出無風帶的方法，也早在世界變化前把利用血統因子製成的十三名複製人 Boss 分散部署到孤島。
- 約克逃亡：世界政府陷入混亂時，約克趁機脫離控制、返回蛋頭島並啟動整座島的移動裝置，把蛋頭島移入原無風帶深處藏匿。
- 緊急對策：莉莉絲／我方貝加龐克把所有正式醫院島改建為研究所島，以複製人技術對抗約克並保留免費醫療整備；敵島臨時轉成的醫院仍維持純醫院，遵守先前定案。
- 正式流程：拉夫德魯結局完成 → 無風帶消失與十三島顯露 → 約克與蛋頭島逃亡揭露 → 研究所／競技場／抽取系統全房解鎖 → 攻略十三 Boss、收集交易線索 → 集齊後定位蛋頭島並接洛克斯終局。
- 待後續：具體逐句台詞、蛋頭島顯現演出與首次擊敗洛克斯後的結局仍於對應階段由使用者確認；本輪未修改正式劇情、地圖、程式、素材、存檔或同步事件。

#### 全破後血統因子企劃修訂 V34：改為依玩家遊戲進度製作

- 日期：2026-07-26。
- 文件：`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 使用者要求正式製作順序以玩家實際遊戲進度為主，不先交付玩家看不到的角色資料底層。企劃已重排第 1～13 階段，V32 的「不得跳階」原則不變，但階段內容由 V34 新順序取代。
- 新前三階段：第 1 階段先做拉夫德魯後無風帶消失、十三座孤島與航線顯現；第 2 階段接約克逃亡、莉莉絲緊急通訊與正式醫院島轉研究所；第 3 階段再做正式酒館島轉競技場。
- 必要底層不省略：全房世界狀態、舊存檔與 `BOARD_GAME_STATE` 放入第 1 階段；永久角色實例 id、舊角色補齊與研究所收藏格式放入第 2 階段。它們只作為當階段正式功能的必要工作，不再先形成獨立的第一交付階段。
- 後續順序：抽取器取得與交易 → 戰後抽取及三階段小遊戲 → 研究所培育與交換 → 舊敵人玩家模板 → S／SS／SSS → 十三島 Boss 與線索 → 蛋頭島／洛克斯 → CPU 全整合 → 圖鑑 → 完整驗證。
- 本輪只重排企劃文件，未開始第 1 階段，未修改正式地圖、劇情、醫院、酒館、程式、素材、存檔或同步事件。

#### 血統因子三階段抽取小遊戲獨立示範 V35

- 日期：2026-07-26。
- 檔案：`public/board_lineage_extraction_demo.html`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 新增獨立可玩示範頁，提供掃描定位、樣本穩定、封存完成三次單鍵／單次觸控判定；支援滑鼠、觸控、Space 與 Enter，完成後依 Perfect `+7%`、Good `+3%`、Miss `+0%` 計算小遊戲加成並隨機判定抽取成功或失敗。
- 難度手感：E／D 到 SSS／洛克斯逐級縮短三階段循環時間並縮窄 Perfect／Good 判定；SSS／洛克斯循環約為 1.48～1.62 秒，E／D 約為 4.1～4.6 秒。敵人基礎率、抽取器加成與階級上限沿用企劃第一版數值，皇級抽取器對 SSS／洛克斯三次 Perfect 仍封頂 75%。
- 狀態隔離：此頁不載入正式遊戲 JS，不讀寫 `localStorage`、正式存檔、`BOARD_GAME_STATE` 或 Socket.IO；沒有新增快捷入口，也不代表第 5 階段已接入正式戰後流程。
- 排版：桌機 1440×900 與平板 1024×768 均維持單畫面、無水平或垂直溢出；低高度版壓縮右側資料卡，但保留中央操作區大小。
- 驗證：HTML inline script 語法檢查通過；`http://127.0.0.1:8787/board_lineage_extraction_demo.html` HTTP 200；Chrome 實玩三階段可從開始、三次判定走到結果並重新開始；SSS／洛克斯＋皇級顯示基礎 5%、抽取器 +50%、上限 75%；瀏覽器 console 無錯誤；`git diff --check` 通過。

#### 血統因子戰後抽取 UI 圖片規格與收件區 V36

- 日期：2026-07-26。
- 檔案：`public/images/board/lineage_extraction_ui/lineage_extraction_image_prompt.md`、`public/images/board/lineage_extraction_ui/incoming/README.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 正式位置確認：未來抽取流程會接在 `public/board_battle.html` 的戰鬥勝利結算後、返回地圖前，以全螢幕覆蓋層依序顯示是否抽取／抽取器選擇、三階段小遊戲與成功／失敗結果；不插入攻擊指令途中，也不改動既有戰場與角色卡排版。
- 圖片規格：建立 18 張 WebP 的完整提示詞與收件清單，包含抽取器選擇主框、小遊戲主框、共用抽取器卡、七種抽取器圖示、中央抽取艙、掃描指針、樣本穩定軌道／標記、封存雙環及成功／失敗結果框。按鈕框預定沿用既有戰鬥操作 UI，不重複生成。
- 風格：延續正式新版深海藍、舊金、深木、繩索、海浪與青綠寶石，融合航海王世界的貝加龐克奇想研究機械；所有文字、角色、數值與成績由 DOM 動態顯示，圖片禁止烙字、黑色矩形底、黃色孔位背光、多餘格子及固定按鈕槽。
- 當前狀態：只建立提示詞與 `incoming/` 收件目錄，尚未接入正式戰鬥流程，未修改敵人、戰鬥結算、抽取數值、道具、存檔、`BOARD_GAME_STATE` 或 Socket.IO。
- 驗證：提示詞與收件清單檔案存在；`git diff --check` 通過。

#### 血統因子圖片式抽取示範 V37

- 日期：2026-07-26。
- 檔案：`public/board_lineage_extraction_demo.html`、`public/images/board/lineage_extraction_ui/`、`public/images/board/lineage_extraction_ui/incoming/README.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 素材驗收：收件區 18 張 `-Photoroom.webp` 均符合提示詞規定尺寸並具有透明 Alpha；移除來源尾碼、固定為提示詞清單中的正式候選檔名後移到 `lineage_extraction_ui/` 根層。`incoming/` 目前清空並保留作後續修正版收件區。
- 示範改版：獨立頁改為三個圖片式全螢幕畫面，依序提供七種抽取器選擇、三階段掃描定位／樣本穩定／封存完成，以及抽取成功／失敗結果。角色、敵人階級、數量、成功率、操作結果與按鈕仍由 DOM 動態置中顯示；按鈕框沿用既有戰鬥操作素材。
- 操作與難度：保留滑鼠、觸控、Space、Enter 操作和 E／D 至 SSS／洛克斯的速度／判定區差異；結果仍依企劃第一版基礎率、抽取器加成、三次成績加成與階級上限判定。
- 狀態隔離：示範頁不讀寫正式存檔、`localStorage`、`BOARD_GAME_STATE` 或 Socket.IO，沒有新增正式入口，也沒有接入戰鬥勝利結算。
- 畫面驗證：Chrome 桌機 1440×900 與平板 1024×768 已實際檢查選擇、小遊戲三階段、成功及失敗畫面；所有畫面維持單頁無捲軸，圖片無載入失敗，文字與按鈕在框內置中，瀏覽器 console 無錯誤。
- 程式驗證：HTML inline script 語法檢查通過；`http://127.0.0.1:8787/board_lineage_extraction_demo.html` HTTP 200；素材路徑存在；`git diff --check` 通過。
- 掃描判定可讀性修正：第一階段圓盤改為分離的亮金內圈 `PERFECT` 區與青藍外圈 `GOOD` 區，增加目標中心菱形、隨機位置的 `PERFECT` 標籤、下方色彩圖例及操作提示；判定角度、成功率與難度數值未改動。
- 穩定判定可讀性修正：第二階段軌道中央增加依敵人難度同步縮放的亮金 `PERFECT` 區與青藍 `GOOD` 區、中央標籤及雙鎖針圖例，明確提示左右鎖針必須同時進入中央亮金區；原本鎖針速度與判定數值未改動。
- 三階段判定畫面第二次調整：依使用者回饋將第一階段恢復為原本單一青金弧形判定區；第二階段移除 `PERFECT` 標籤、雙色圖例、兩側菱形、青藍外區及過高光柱，只保留軌道中央的簡潔金色 `PERFECT` 區。
- 封存判定重做：第三階段明確區分固定金色環與縮放青藍環，青藍環的視覺重合尺寸校正為 `1.045`，實際 Perfect／Good 判定也改以同一尺寸為中心；環下方只保留「太小／太大／接近・GOOD／完全重合・PERFECT」即時提示，使畫面看到的重合時機與程式判定一致。此調整仍只存在獨立示範頁，未修改正式戰鬥或企劃成功率。

#### 血統因子三階段判定元件 V2 生圖規格 V38

- 日期：2026-07-26。
- 檔案：`public/images/board/lineage_extraction_ui/lineage_extraction_minigame_v2_prompt.md`、`public/images/board/lineage_extraction_ui/incoming_v2/README.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 改版原因：使用者確認 CSS 弧帶、鎖定區與即時提示仍不符合正式新版 UI 的美感與直覺性，因此停止繼續用 CSS 裝飾堆疊，改由專用透明圖片承擔三階段判定視覺。
- 素材範圍：規劃剛好 5 張 WebP，包括可旋轉的青金掃描目標弧、含單一中央金色接口的水平鎖定軌道、可鏡像的單邊鎖針，以及幾何完全一致的固定金環與縮放青藍環。既有全畫面主框、抽取艙、敵人圖、按鈕與結果頁不重畫。
- 直覺原則：第一階段以中央金色缺口／左右青藍翼區分 Perfect 與 Good；第二階段以兩支金色插銷咬合唯一中央接口表達鎖定；第三階段的兩張圓環強制共用 1536×1536 畫布、正中心、1240 px 外徑、1050 px 內徑與四個定位節點，確保重合時機一眼可辨。
- 當前狀態：只建立完整提示詞與 `incoming_v2/` 收件區，尚未收到圖片，也未再修改示範頁、正式戰鬥、判定數值、存檔、`BOARD_GAME_STATE` 或 Socket.IO。

#### 血統因子三階段 V2 圖片元件接入示範 V39

- 日期：2026-07-26。
- 檔案：`public/board_lineage_extraction_demo.html`、`public/images/board/lineage_extraction_ui/`、`public/images/board/lineage_extraction_ui/incoming_v2/README.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 素材驗收：5 張 `-Photoroom.webp` 均符合指定像素尺寸並具有透明 Alpha；移除來源尾碼後固定命名、移到 `lineage_extraction_ui/` 根層，`incoming_v2/` 已清空並保留作後續修正版收件區。
- 第一階段：移除 CSS conic-gradient 判定弧，改用可繞中央圓心旋轉的 `lineage_scan_target_arc_v2.webp`；既有掃描指針、隨機目標角度、Perfect／Good 判定與速度規則不變。
- 第二階段：移除 CSS 中央判定膠囊，改用含單一金色接口的 `lineage_lock_target_track_v2.webp` 與可鏡像的 `lineage_lock_marker_v2.webp`。依鎖針透明畫布內尖端位置校正運動終點，左右尖端在接近值 1 時正好相接於中央接口；判定公式不變。
- 第三階段：改用 `lineage_seal_fixed_ring_v2.webp` 與 `lineage_seal_pulse_ring_v2.webp`。來源透明輪廓約有 3.2% 尺寸差、固定環與活動環圓心各自偏離約 20 px，因此以非動畫校正層分別平移並把活動環預先放大 1.032 倍；動畫層 `scale(1)` 現在對應畫面完全重合與判定中心。
- 畫面簡化：移除第三階段 CSS 狀態膠囊及第一／第二階段臨時光圈，只保留圖片本身、上方一句操作提示與判定後既有 Perfect／Good／Miss 回饋。
- 驗證：HTML inline script 語法檢查通過；5 張正式候選素材路徑存在；`http://127.0.0.1:8787/board_lineage_extraction_demo.html` HTTP 200；Chrome 桌機 1440×900 實測三階段圖層、鎖針相接與雙環重合，平板 1024×768 單頁無捲軸；圖片無載入失敗、console 無錯誤；`git diff --check` 通過。
- 狀態隔離：本輪仍只修改獨立示範頁與素材文件，未接入正式戰鬥、未修改抽取成功率、存檔、`BOARD_GAME_STATE` 或 Socket.IO。

#### 血統因子階級難度與掃描弧同步修正 V40

- 日期：2026-07-26。
- 檔案：`public/board_lineage_extraction_demo.html`、`docs/DEV_WORKFLOW.md`。
- 問題：V39 的 V2 掃描目標弧固定顯示約 68 度，但仍沿用 E／D 至 SSS 各自 34～12.5 度的 Good 半寬，造成高階畫面看似命中大片弧帶、實際卻只接受中央小範圍；同時原循環時間差距不夠直觀。
- 視覺同步：新增不參與圖形繪製的旋轉外層，圖片本體依 `difficulty.scanGood / ED.scanGood` 沿目標弧切線方向縮放。E／D 保持原圖 100%，C／B、A、S、SS、SSS 依序約為 85%、71%、59%、47%、37%；旋轉、縮放分層後不會改變目標圓心或指針旋轉軸。
- 判定說明：整段可見青金弧代表 Good，中央羅盤尖代表 Perfect；原 `scanGood`／`scanPerfect` 數值比例與圖片縮放比例一致，因此畫面可見寬度會跟實際命中範圍同步變窄。
- 速度分級：三階段循環時間重新拉開。E／D 約 4.8～5.2 秒，C／B 約 3.9～4.2 秒，A 約 3.1～3.3 秒，S 約 2.3～2.5 秒，SS 約 1.65～1.8 秒，SSS／洛克斯約 1.1～1.22 秒；階級越高同時具備更窄目標與更快移動。
- 狀態隔離：只調整獨立示範的操作手感與提示文字，未接入正式戰鬥，也未改正式抽取成功率、存檔、`BOARD_GAME_STATE` 或 Socket.IO。
- 驗證：Chrome 桌機 1440×900 已分別固定 E／D 與 SSS 目標角度實測，掃描弧縮放為 100% 與約 36.8%，並逐級確認六檔速度標示與縮放值；平板 1024×768 維持單頁無捲軸，圖片無載入失敗、網路回應與 console 無錯誤。

#### 血統因子正式戰後接點與 OSU 式第一階段規格 V41

- 日期：2026-07-26。
- 檔案：`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 正式接點核對：現行 `board_game.js` 在敵人 HP 歸零時先把 `battle.result` 設為 `win`，`board_battle.js` 仍能從同一份戰鬥快照顯示敵人角色框；玩家送出完成指令、進入 `finishBattle()` 後才發獎、更新島嶼擊敗狀態並由 `finalizeBattleAndAdvanceTurn()` 清除 `state.battleState`。因此抽取應插在勝利成立後、原結算與清除快照前。
- 正式流程定案：只有玩家持有可用抽取器時才顯示是否提取；沒有抽取器或選擇不提取時沿用原結算與敵人退場。確認抽取器後不離開正式戰鬥頁，三階段操作直接覆蓋在原敵人角色圖片安全範圍內；成功／失敗後才回到原結算。
- 第一階段改案：舊版單次旋轉指針不再是正式規格，改為 OSU 式固定命中圈＋向內縮小的接近圈。E／D、C／B、A、S、SS、SSS／洛克斯依序提供 8、9、10、12、14、15 個連續位置目標，階級越高同時增加目標數、提高收縮速度並縮小判定窗。
- 成功率相容：第一階段各目標先依 Perfect／Good／Miss 計分，再彙整成第一階段的一個結果；後兩階段仍各一個結果，確保原三階段最高 `+21%` 與階級成功率上限不被多目標數量放大。
- 素材方向：正式頁不再需要全螢幕抽取艙背景；下一批只需補 OSU 式固定命中圈與幾何同心接近圈，目標編號、連擊、進度及判定文字由 DOM 顯示。V2 青金掃描弧只保留於舊示範，不接正式第一階段。
- 本輪只修訂企劃文件，沒有修改正式戰鬥、示範頁、素材、存檔、`BOARD_GAME_STATE` 或 Socket.IO。

#### 血統因子戰鬥頁內 OSU 式第一階段示範 V42

- 日期：2026-07-26。
- 檔案：`public/board_lineage_extraction_battle_demo.html`、`public/images/board/lineage_extraction_ui/lineage_osu_target_prompt.md`、`public/images/board/lineage_extraction_ui/incoming_osu/README.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 新示範頁：另建戰鬥頁構圖的隔離示範，不破壞或覆蓋舊三階段頁。畫面保留正式雙方 HUD、角色卡與底部資訊盤，敵人以 0 HP／擊破狀態保留；玩家持有抽取器時才顯示是否提取，沒有抽取器或選擇不要時模擬原獎勵與敵人淡出。
- 第一階段：確認抽取器後，連續目標只生成在敵人角色圖片安全範圍內；目前目標有金色固定圈、由外向內縮小的青藍接近圈、置中編號，以及下一目標的低透明預告。桌機必須用滑鼠位置點擊、平板使用觸控，不提供 Space／Enter 代打。
- 難度：E／D、C／B、A、S、SS、SSS／洛克斯分別為 8、9、10、12、14、15 個目標；單點縮圈時間依序為 1.35、1.18、1.04、0.90、0.78、0.68 秒，目標尺寸與 Perfect／Good 時間窗也逐級縮小。平板 SSS 實際目標仍約 45 px，保留可觸控下限。
- 階段評價：每點 Perfect／Good／Miss 分別計 2／1／0 分，85% 以上彙整為第一階段 Perfect、50% 以上為 Good，其餘為 Miss；8～15 點仍只產生一個第一階段結果。
- 素材提示：建立兩張 1024×1024 透明 WebP 的完整提示詞與 `incoming_osu/` 收件區，固定命中圈與接近圈要求同一 x=512／y=512 圓心、880 px 基準外徑及 100% 精準重合。收件前示範暫用既有固定金環／縮放青環，不把臨時素材當正式 OSU 元件。
- 桌機驗證：Chrome 1440×900 實測詢問、七種抽取器選擇、S 級 12 點連續操作、Perfect／Good／Miss 記分與 96% 彙整 Perfect 結果；頁面無捲軸、圖片無缺漏、console 與網路回應無錯誤。
- 平板驗證：Chrome 1024×768 實測 SSS／洛克斯 15 點畫面，敵人角色框、目標、讀數與底部盤面均在單頁內；無捲軸、圖片無缺漏、console 與網路回應無錯誤。
- 分支驗證：關閉「持有抽取器」後不顯示是否提取選擇；照原流程結算會顯示既有獎勵示意並讓敵人角色卡淡出。
- 狀態隔離：本輪沒有修改正式 `board_battle.html`、`board_battle.js`、`board_game.js`、存檔、`BOARD_GAME_STATE` 或 Socket.IO。

#### 血統因子戰鬥頁內三階段全螢幕示範 V43

- 日期：2026-07-26。
- 檔案：`public/board_lineage_extraction_battle_demo.html`、`public/images/board/lineage_extraction_ui/lineage_extraction_minigame_bg_v1.webp`、`public/images/board/lineage_extraction_ui/lineage_extraction_minigame_bg_prompt.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 背景素材：使用 OpenAI 內建 ImageGen 生成近黑深海研究艙背景，轉成 1672×941 WebP；畫面左右保留安靜暗區，避免干擾左側抽取器與右側敵人角色框。完整提示詞已保存於素材目錄。
- 全螢幕構圖：確認抽取器後隱藏原戰鬥 HUD、我方角色卡、底部盤與示範控制列；左側顯示所選抽取器、名稱與階級，右側放大並保留被擊破敵人的正式角色框。三階段都只在這個畫面內進行，不返回地圖或切換頁面。
- 第一階段：先顯示不計時的「點擊開始」目標，玩家點下後才生成第一個縮圈；E／D 至 SSS 仍使用 8～15 個目標。累積 3 次 Miss 時只提前結束第一階段，記為 Miss 後繼續第二階段。
- 第二階段：沿用 V2 左右鎖針與中央接口圖片，進入階段後先停在待機畫面；玩家點擊「開始第二階段」才移動，點擊敵人框完成一次樣本穩定判定。
- 第三階段：沿用已校正的固定金環與青藍活動環，進入階段後同樣先等待點擊；活動環啟動後在與金環重合時點擊敵人框，完成封存判定。
- 結算：三段各保留一個 Perfect／Good／Miss，仍依 Perfect `+7%`、Good `+3%`、Miss `+0%` 合計，三段全 Perfect 顯示 `+21%`。隔離示範不執行正式成功率抽選、不消耗道具、不發放血統因子。
- 桌機驗證：Chrome 1440×900 實測第一階段開始閘門不會自行倒數，S 級 12 點全 Perfect 後可依序完成第二、第三階段，三段全 Perfect 結算為 `+21%`；另實測第一階段 3 Miss 會提前進第二階段。頁面維持 1440×900、無捲軸，圖片無缺漏，console 與網路回應無錯誤。
- 平板驗證：Chrome 1024×768 實測三個待機畫面、第一階段 3 Miss 分支、第二與第三階段判定及最終結算；左側抽取器與右側敵人框不重疊，結算按鈕完整顯示，頁面無水平或垂直捲軸。
- 程式驗證：HTML inline script 語法檢查通過；`http://127.0.0.1:8787/board_lineage_extraction_battle_demo.html` HTTP 200；新增背景與既有判定素材路徑存在；`git diff --check` 通過。
- 狀態隔離：本輪仍未修改正式 `board_battle.html`、`board_battle.js`、`board_game.js`、正式成功率、存檔、`BOARD_GAME_STATE` 或 Socket.IO。

#### 血統因子最終發射與成功／失敗演出 V44

- 日期：2026-07-26。
- 檔案：`public/board_lineage_extraction_battle_demo.html`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 發射器構圖：沿用既有 `lineage_extractor_card_frame.webp` 與七種抽取器圖片，不新增素材。三階段完成後，左側抽取器本體轉成橫向能量艙，框內展開金屬針管導軌與朝右針尖，明確指向右側敵人。
- 動態對位：演出開始時依抽取器框右端與敵人 portrait 胸口的即時 `getBoundingClientRect()` 計算光束長度及旋轉角度；視窗尺寸變更時重新定位，因此桌機與平板不共用寫死角度。
- 4.6 秒流程：先展開導軌並蓄能，約 0.9 秒發射青藍採樣光束；命中後依本次結果分成血統樣本沿光束回收，或光束變色、命中環與樣本崩解；最後才顯示「血統因子提取成功／失敗」。不使用把敵人關進球體或容器後反覆搖晃的演出。
- 成功率：隔離示範重新使用企劃既定的 E／D 至 SSS 基礎率 `55/40/28/18/10/5%`、上限 `95/95/95/90/85/75%`、抽取器加成與三階段 Perfect `+7%`／Good `+3%`／Miss `+0%`。例如 S 級、精密抽取器、三段全 Perfect 為 `18 + 12 + 21 = 51%`。
- 結算：原本只顯示三階段評價的結算改為顯示提取成功／失敗、三段評價與最終成功率；成功提示取得一份完整血統因子，失敗提示抽取器仍消耗。示範頁提供「重播成功演出／重播失敗演出」供比較，但不實際扣道具或發放因子。
- 桌機驗證：Chrome 1440×900 實跑 S 級三段全 Perfect，確認發射器展開、光束從左框針尖命中赤犬胸口、成功樣本回收、失敗崩解及兩種結算；頁面無捲軸、圖片無缺漏，console 與網路回應無錯誤。
- 平板驗證：Chrome 1024×768 實測同一成功演出；抽取器框、光束、敵人框與胸口命中環均在單頁內，光束重新計算角度後仍正確連接，結算按鈕完整可見且無捲軸。
- 程式驗證：HTML inline script `node --check`、正式頁 HTTP 200、引用素材存在、尾端空白掃描與 `git diff --check` 均通過。
- 狀態隔離：本輪沒有修改正式 `board_battle.html`、`board_battle.js`、`board_game.js`、存檔、`BOARD_GAME_STATE` 或 Socket.IO。

#### 血統因子八秒旋轉校準與三次封存脈衝 V45

- 日期：2026-07-26。
- 檔案：`public/board_lineage_extraction_battle_demo.html`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 起手演出：V44 一開始直接展開針管的流程改為抽取器先進入左框圓形校準槽，於約 1.4 秒內旋轉兩圈以上並充能；旋轉停止後才橫向鎖上導軌，避免道具一開始就已經是靜止發射姿勢。
- 等待設計：光束命中敵人胸口後不立即抽選結果，封存環會壓縮／回彈三次，下方三顆菱形燈依序亮起。成功時第三次穩定後樣本沿光束返回抽取器；失敗時封存環破裂、敵人 portrait 向外震開並讓樣本逸散，提供類似捕捉遊戲的等待張力但不使用球體或搖晃。
- 八秒節奏：旋轉校準 1.4 秒、導軌鎖定 0.8 秒、發射至封存環建立 0.9 秒、三次脈衝 2.7 秒、樣本回收／掙脫 1.1 秒、結果停留 1.1 秒，總計約 8 秒。
- 驗證：Chrome 1440×900 實跑正式三階段後進入新版演出，成功與失敗分支從 `spin-up` 開始到最終結算分別為 8031／8038 ms；旋轉、導軌、光束、三顆菱形燈、成功回收與失敗掙脫均可見。Chrome 1024×768 另實測八秒成功演出，封存環與三顆菱形燈完整留在敵人框內；兩種尺寸皆無捲軸、缺圖、console 或網路錯誤。HTML inline script `node --check` 通過。
- 狀態隔離：只改隔離示範與企劃文件，不修改正式戰鬥、成功率數值、抽取器消耗、血統因子發放、存檔、`BOARD_GAME_STATE` 或 Socket.IO。

#### 標準／速度抽取器與發射底框 V2 生圖規格 V46

- 日期：2026-07-26。
- 檔案：`public/images/board/lineage_extraction_ui/lineage_launcher_assets_v2_prompt.md`、`public/images/board/lineage_extraction_ui/incoming_launcher_v2/README.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 素材判斷：現有標準抽取器已具備採樣槍概念但朝左，速度共鳴抽取器是朝左的魚雷／推進器；兩者無法與右側敵人及共同槍口直接對齊。精密、力量、技巧、能力者與皇級本批依使用者要求不重畫，全螢幕暗色研究所背景也保留。
- 兩張抽取器規格：建立 1024×1024 透明 WebP 提示詞，統一 `x=512, y=512` 旋轉軸、中央 840 px 安全圓、水平朝右方向與 `x=890, y=512` 採樣槍口。標準型保留木握把、繩索、電話蟲與青藍 DNA 管；速度型改成緊湊渦輪採樣器，不再是完整魚雷或載具。
- 發射底框規格：建立 1536×864 透明 WebP 提示詞，左側校準槽中心固定 `x=350, y=432`、內徑 500 px，水平導軌中心固定 `y=432`，右側唯一發射口中心固定 `x=1460, y=432`；移除舊框三個無用途矩形格，不烙入抽取器、光束或文字。
- 收件流程：建立 `incoming_launcher_v2/`，只接收三張已去背 WebP；來源檔名可保留生成器尾碼，驗收尺寸、透明 Alpha、方向與座標後再統一命名並接入隔離示範。
- 驗證：完整提示詞、收件 README 與文件路徑存在；尾端空白掃描及 `git diff --check` 通過。本輪未收到圖片，未修改示範頁、正式戰鬥、成功率、存檔、`BOARD_GAME_STATE` 或 Socket.IO。

#### 標準／速度抽取器與發射底框 V2 接入示範 V47

- 日期：2026-07-27。
- 檔案：`public/board_lineage_extraction_battle_demo.html`、`public/images/board/lineage_extraction_ui/`、`public/images/board/lineage_extraction_ui/incoming_launcher_v2/README.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 素材驗收：三張來源 WebP 分別為 1024×1024、1024×1024、1536×864，均具有透明 Alpha；移除 `-Photoroom` 尾碼後固定命名為 `lineage_extractor_standard_launcher_v2.webp`、`lineage_extractor_resonance_speed_launcher_v2.webp`、`lineage_extractor_launcher_frame_v2.webp` 並移到素材根層。`incoming_launcher_v2/` 目前只保留 README。
- 底框接入：隔離戰鬥示範改用新版左圓右軌底框；底框本身已有唯一圓形校準槽、發射軌道及右端發射口，因此停用原本以 CSS 疊出的第二條導軌，避免雙框、雙軌與多餘箭頭。
- 固定旋轉：抽取器本體全程限制在圓槽裁切區，不沿軌道平移。新版標準／速度素材原始尖端朝右，起始顯示為 `-90deg` 朝上，停留充能後只順時針轉到 `0deg`，正好 90 度再發射；其餘五種直立素材保留並使用 `0deg → 90deg` 的同方向動作。
- 軸心校正：新增固定圓槽、旋轉層與圖像層三層結構。標準抽取器的圖形在透明 1024 畫布內偏上，因此只對該素材加入 12% 圖形位移，使朝上與朝右都繞圓槽中心旋轉，轉完後槍口與底圖導軌中心對齊；速度型素材本身置中，不套用位移。
- 演出相容：既有約八秒節奏、三次封存脈衝、成功回收、失敗崩解與重播功能不變；光束仍依畫面尺寸即時計算，但起點改由新版底框右端發射口對位敵人角色框。
- 畫面驗證：Chrome 1440×900 實際跑完三階段並檢查標準抽取器朝上、順時針 90 度朝右、軌道鎖定及光束發射；Chrome 1024×768 實測速度型相同兩個姿勢，頁面 `scrollWidth/scrollHeight` 等於 1024×768，無捲軸、缺圖或 console 錯誤。
- 程式驗證：HTML inline script `node --check` 通過；示範頁與三張素材皆由 8787 回應 HTTP 200；素材路徑存在；`git diff --check` 通過。
- 狀態隔離：本輪未修改正式 `board_battle.html`、`board_battle.js`、`board_game.js`、抽取成功率、正式道具、存檔、`BOARD_GAME_STATE` 或 Socket.IO。

#### 抽取光束改由抽取器尖端發射 V48

- 日期：2026-07-27。
- 檔案：`public/board_lineage_extraction_battle_demo.html`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 問題：V47 的光束起點位於新版底框最右側發射口，視覺上像由底圖軌道自行發射，而不是圓槽內的抽取器發射。
- 修正：底框軌道只保留機械導向用途；光束起點改由圓槽實際顯示區的右側 91%、垂直中央動態計算，對應朝右抽取器的採樣尖端。光束拆成視覺連續的兩段：第一段從尖端水平貼著底圖軌道抵達右端發射口，第二段才由發射口依敵人位置轉向命中點；沒有軌道自行發光、斜線穿框或第二條假導軌。
- 響應式：起點改用 `.extractor-showcase-bay` 的即時 `getBoundingClientRect()`，不寫死桌機像素；視窗尺寸改變時仍與敵人命中點一起重新定位。
- 驗證：HTML inline script `node --check`、示範頁 HTTP 200、Chrome 1440×900 與 1024×768 發射畫面、console、頁面溢出及 `git diff --check` 均通過。
- 狀態隔離：只修改隔離示範與文件；正式戰鬥、抽取成功率、道具、存檔、`BOARD_GAME_STATE` 及 Socket.IO 均未改動。

#### 七種抽取器發射光配色 V49

- 日期：2026-07-27。
- 檔案：`public/board_lineage_extraction_battle_demo.html`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 配色來源：逐張檢查七種抽取器素材，不只依名稱推測。標準使用青綠、精密使用銀白冰青、力量使用赤紅、技巧使用晶藍、速度使用青藍帶洋紅、能力者使用紫羅蘭、皇級使用緋紅帶金色核心。
- 動態套用：每個抽取器資料項目增加核心色、主光色、收束色與外暈 RGB；選定抽取器時寫入發射效果層的 CSS 變數。水平軌道段、轉向敵人的第二段、命中封存環、三顆穩定燈及成功回收樣本同步使用相同色系。
- 結果辨識：正常發射與成功回收保留抽取器專屬色；失敗分支仍強制改成既有紅色光束崩解及紅色破裂環，不會因抽取器顏色掩蓋失敗訊號。
- 驗證：HTML inline script `node --check`、示範頁 HTTP 200、Chrome 1440×900 七種 CSS 配色值與分段路徑、1024×768 速度型發射畫面、console、頁面溢出及 `git diff --check` 均通過。
- 狀態隔離：只修改隔離示範與文件；未改正式戰鬥、抽取器數值、成功率、道具、存檔、`BOARD_GAME_STATE` 或 Socket.IO。

#### 發射軌道局部挖空與後方光束 V50

- 日期：2026-07-27。
- 檔案：`public/board_lineage_extraction_battle_demo.html`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 範圍確認：只挖空上下金屬軌道之間的深藍內槽；左側圓形校準槽、主面板深色背景、外框、金屬支架、右端發射口及下方文字框全部保留。中央細青線仍固定顯示。
- 素材安全：曾以內建圖片編修嘗試局部去背，但輸出改變原比例、金屬細節或把棋盤格烙入 RGB，均未接入專案。最終保留原始 `lineage_extractor_launcher_frame_v2.webp`，以非破壞式雙軸 Alpha 遮罩只讓軌道內槽在示範畫面透明，避免覆蓋使用者原圖。
- 圖層順序：軌道內的第一段光束移入 `.extractor-showcase`，層級依序為後方光束 `z=-2`、底框圖片 `z=-1`、中央細線 `z=1`、抽取器圓槽 `z=2`。光束只能從透明內槽透出，上下金屬軌道、支架及細線保持在光束前方。
- 路徑銜接：軌道段仍從抽取器尖端水平抵達右端發射口；框外第二段沿用敵人位置即時計算。1440×900 交界差為 0 px，1024×768 約為 0.01 px，視覺連續且不斜穿金框。
- 驗證：Chrome 1440×900 已檢查待機挖空、中央細線、抽取器轉向、軌道後方發光及轉向敵人的完整畫面；1024×768 同樣無接縫、捲軸、缺圖或 console 錯誤。HTML inline script `node --check`、示範頁 HTTP 200、尾端空白與 `git diff --check` 均通過。
- 狀態隔離：只修改隔離示範與文件；正式戰鬥、原始底框素材、抽取成功率、道具、存檔、`BOARD_GAME_STATE` 及 Socket.IO 均未改動。

#### 發射口圖層與光束亮度修正 V51

- 日期：2026-07-27。
- 檔案：`public/board_lineage_extraction_battle_demo.html`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 發射口遮擋：V50 的框外光束起點仍位於底框右緣內側 2.5%，導致一小段框外光壓在發射口圖片上。軌道後方光束現在延伸至底框圖片最右外緣，框外光束從外緣才開始轉向敵人；底框範圍內的光全部維持在圖片下方。
- 亮度：`extractionBeamFire` 的中段與完成亮度均改為 100%，軌道段與框外段亮起後全程不再自動變暗；只有失敗分支進入既有紅色崩解動畫時才會收束消失。
- 驗證：Chrome 1440×900 與 1024×768 均檢查發射口沒有被光束蓋住、兩段交界對齊、軌道光及框外光維持全亮，頁面無捲軸或 console 錯誤；HTML inline script `node --check`、HTTP 200、尾端空白與 `git diff --check` 均通過。
- 狀態隔離：只修改隔離示範與文件；正式戰鬥、原始底框素材、抽取成功率、道具、存檔、`BOARD_GAME_STATE` 及 Socket.IO 均未改動。

#### 軌道金屬前景覆蓋修正 V52

- 日期：2026-07-27。
- 檔案：`public/board_lineage_extraction_battle_demo.html`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 原因：V50 的長方形軌道挖空雖讓光束位於主底框下方，但也會把透明區內的吊扣、發射口左緣與其他金屬零件一併挖掉；V51 的框外光束另有外發光向左溢回底框的可能，因此仍會產生光束壓過金屬的錯覺。
- 修正：在軌道挖空區加上同一張正式底框的前景金屬覆蓋層，使用 `screen` 混合保留暗槽內光束，同時把原圖的金屬扣件與中央細線重新壓回光束上方；最終判定期間再把整個抽取器底框提高到框外光束特效之上，阻止框外光暈回滲到發射口。圖層順序固定為框內光束、挖空主底框、軌道金屬前景／細線、抽取器。
- 驗證：Chrome 1440×900 與 1024×768 實際重播成功發射演出，確認框內光束只由深藍軌道槽透出，金屬扣件、上下軌與發射口保持在光束前方；兩段光束維持全亮，頁面無捲軸或 console 錯誤。HTML inline script `node --check`、素材存在、HTTP 200、尾端空白與 `git diff --check` 均通過。
- 狀態隔離：只修改隔離示範與文件；不修改原始 WebP、正式戰鬥頁、抽取成功率、道具、存檔、`BOARD_GAME_STATE` 或 Socket.IO。

#### 真透明發射底框素材替換 V53

- 日期：2026-07-27。
- 檔案：`public/images/board/lineage_extraction_ui/lineage_extractor_launcher_frame_v2.webp`（使用者替換）、`public/board_lineage_extraction_battle_demo.html`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 素材驗收：新版底框為 1672×941 RGBA WebP，Alpha 範圍 0～255；透明像素 471,459、半透明像素 29,002、實心像素 1,072,891。軌道檢查區內已有 37,666 個全透明像素，深藍軌道槽已真正挖空，同時保留上下金屬軌、吊扣、發射口與中央青線。
- 程式清理：移除為舊版未去背素材加入的雙軸 CSS Alpha 遮罩、重複底框 `screen` 前景層及 CSS 假青線；正式候選底框現在只載入一次，框內光束固定在原圖下方並直接透過素材 Alpha 顯示。最終判定期間底框仍高於框外光束特效，避免框外光暈回滲。
- 驗證：Chrome 1440×900 與 1024×768 實際重播成功發射演出，確認光束只穿過透明軌道槽，原圖金屬構件與中央青線完整位於光束上方；兩段光束維持全亮，頁面無捲軸、缺圖或 console 錯誤。HTML inline script `node --check`、素材路徑、HTTP 200、尾端空白與 `git diff --check` 均通過。
- 狀態隔離：只替換隔離示範使用的候選底框素材並清理其顯示層；不修改正式戰鬥頁、抽取成功率、道具、存檔、`BOARD_GAME_STATE` 或 Socket.IO。

#### 軌道光束加粗與七連彈巢素材收件準備 V54

- 日期：2026-07-27。
- 檔案：`public/board_lineage_extraction_battle_demo.html`、`public/images/board/lineage_extraction_ui/extractor_cylinder/incoming/LINEAGE_EXTRACTOR_CYLINDER_PROMPT.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 光束：只把發射底框圖片下方的水平軌道光束高度由共用 34% 覆寫為 52%，讓透明槽內的光更寬；框外轉向敵人的光束粗細、顏色、100% 保留亮度及發射路徑不變。
- 流程定案：戰鬥結算區只保留「進行提取／不要提取」兩個決定。選擇進行後才切換全螢幕提取層；七種抽取器預計改為左側圓槽內的七連左輪彈巢，玩家可點擊孔位或左右轉動，把選定抽取器轉到發射底框右側既有青色寶石指針，再確認開始三階段小遊戲。抽取器名稱、加成、持有數量、消耗與成功率規則不變。
- 素材規格：建立 `extractor_cylinder/incoming/` 收件區及完整提示詞。候選圖為 1536×1536 RGBA 真透明正圓彈巢，包含七個同尺寸等距空孔與中央航海機械軸心；不把抽取器、文字、箭頭或選取光畫死，七種既有抽取器會由程式動態放入孔位。
- 接入狀態：示範頁先預留隱藏的彈巢結構與響應式版位，但目前仍沿用既有抽取器清單，避免在正式候選 WebP 收件前把臨時 CSS 圓盤當成定稿。收到並驗收素材後才會完成旋轉、孔位命中、確認／返回與桌機／平板排版。
- 驗證：HTML inline script `node --check`、示範頁 HTTP 200、現行詢問／清單／開始操作、素材提示詞存在、尾端空白與 `git diff --check` 均通過。
- 狀態隔離：本階段只調整隔離示範的框內光束、預留未啟用的彈巢結構並新增收件說明；不修改正式戰鬥頁、抽取器數值、道具、存檔、`BOARD_GAME_STATE` 或 Socket.IO。

#### 巨型後置七連彈巢構圖修正 V55

- 日期：2026-07-27。
- 檔案：`public/board_lineage_extraction_battle_demo.html`、`public/images/board/lineage_extraction_ui/extractor_cylinder/incoming/LINEAGE_EXTRACTOR_CYLINDER_PROMPT.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 使用者標註確認：彈巢不是完整顯示在發射底框大圓內的小選單。正式結構是完整正圓七連彈巢放在底框後方，遊戲中放大至約畫面高度 125%～145%，圓心偏到畫面左側外面；約一半圓盤被遊戲舞台裁掉，只有最右側孔位會對準底框左側大圓視窗。
- 圖層與操作：現有發射底框保持前景，左側大圓的深色內底需挖成透明 Alpha，只保留金屬圓框；巨型彈巢在後方以滑鼠滾輪每次旋轉 `360 / 7`，平板使用上下滑動與輔助切換按鈕。其他孔位會移到畫面上方、下方或左側外面，不會同時擠在圓框內。
- 填入規則：七格是顯示排列，不複製實際庫存。只有一種可用抽取器時七格相同；兩種時交叉排列；三種以上依既有抽取器順序循環填滿。轉到右側視窗並確認後才決定本次消耗哪一種抽取器。
- 素材提示詞：維持 1536×1536 RGBA 真透明、完整正圓與七個等距空孔，新增「素材不可先裁半圓／小選單」及巨型後置執行方式。抽取器圖片、文字、固定指針與選中光不畫入素材，由程式動態處理。
- 草稿清理：移除 V54 尚未啟用、但構圖錯誤的前景小型 CSS 彈巢與隱藏 HTML；在正式巨型彈巢 WebP 收件前，示範仍使用原抽取器清單，避免錯誤草稿進入操作流程。V54 已完成的框內水平光束 52% 加粗保留。
- 驗證：HTML inline script `node --check`、示範頁 HTTP 200、錯誤草稿 selector／wheel／readout／controls 均不存在、提示詞與收件目錄存在、尾端空白及 `git diff --check` 均通過。
- 狀態隔離：只修正隔離示範的未啟用草稿與候選素材規格；正式戰鬥頁、抽取器規則／數值、道具庫存、存檔、`BOARD_GAME_STATE` 與 Socket.IO 均未修改。

#### 巨型後置七連彈巢正式候選接入 V56

- 日期：2026-07-27。
- 檔案：`public/board_lineage_extraction_battle_demo.html`、`public/images/board/lineage_extraction_ui/lineage_extractor_cylinder_7_slot.webp`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 素材收件：驗收使用者放入收件區的 `lineage_extractor_cylinder_7_slot.webp`，尺寸為 1536×1536、RGBA、Alpha 範圍 0～255、檔案 502,140 bytes；完整正圓、七個等距孔位、中央航海軸心及透明外圍均符合規格。完成後移到 `lineage_extraction_ui` 固定路徑，`incoming/` 只保留提示詞。
- 選擇流程：戰鬥結果仍只顯示「進行提取／不要提取」。選擇進行後才切換全螢幕七連彈巢選擇層，不再顯示舊抽取器直列清單；可返回戰鬥詢問，或確認目前圓槽內的抽取器並開始既有第一階段。
- 圖層與對位：完整彈巢位在發射底框後方，依舞台高度放大至 130%，圓心移到左側畫面外；超出舞台的約半個圓盤由舞台裁掉，舞台內未被前景底框遮住的圓盤仍會顯示。底框左側大圓以非破壞式 CSS 遮罩挖除深色內底，讓目前對準的孔位透過金屬圓框顯示，原本真正透明的水平軌道也保留；彈巢尺寸與圓心依舞台及底框即時尺寸計算，桌機與平板不寫死像素座標。
- 填入與操作：彈巢固定七格，只有一種可用抽取器時七格相同，兩種時交叉循環，三種以上依可用種類循環填滿；示範中的 `stock: 3` 僅供七格選擇畫面驗證，不代表正式庫存已接入。滑鼠滾輪、左右方向鍵或平板上下滑動會每次旋轉 `360 / 7`，孔位內抽取器同步反向旋轉保持直立。
- 驗證：Chrome 1440×900 已確認戰鬥詢問只剩兩個決定、彈巢七孔、前後圖層、完整七種循環、確認後進入第一階段及無捲軸／缺圖／console 錯誤；1024×768 已確認上下滑動切換、圓槽對位、返回詢問及無溢出。HTML inline script `node --check`、素材路徑、示範頁／素材 HTTP 200、尾端空白與 `git diff --check` 均通過。
- 狀態隔離：只接入隔離示範及候選素材；正式 `board_battle.html`／`board_battle.js`、抽取器正式庫存與消耗、血統因子發放、存檔、`BOARD_GAME_STATE` 及 Socket.IO 均未修改。

#### 七孔抽取器朝向、青邊與正式敵人卡校正 V57

- 日期：2026-07-27。
- 檔案：`public/board_lineage_extraction_battle_demo.html`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 青邊原因：逐張檢查七種抽取器 WebP 的 Alpha 邊界後，確認精密、力量、技巧、能力者、皇級及兩張新版橫向發射器的透明畫布最外緣都有不同程度的低 Alpha 像素；旋轉與放大後會像淡青色邊緣或孔位偏移。示範依各圖真正不透明內容的安全邊界加入個別 `clip-path: inset(...)`，只裁顯示層，不修改使用者素材。
- 待機朝向：彈巢孔位改為「圓盤旋轉層／反向保持直立層／素材固定朝向層」三層。所有抽取器在圓盤旋轉時保持直立；原本橫向的標準與速度型額外固定旋轉 `-90deg`，採樣尖端先朝上，並依內容邊界放大與置中。其餘五種維持直向 `0deg`。
- 文字對位：發射底框下方的名稱、成功率及持有數量由 `left: 65.5%; width: 46%` 改為 `left: 72%; width: 37%`，整組移至右側文字框，不再壓住圓槽內抽取器。
- 正式敵人卡：移除抽取模式原本桌機 `left: 62.5%; top: 14%; width: 30%; height: 72%` 與平板 `59% / 14% / 36% / 72%` 的放大覆寫。示範現在直接使用正式 `DEFAULT_LAYOUT.enemyCard` 的 `left: 67.8%; top: 18.2%`，並比照正式 `applyLayout()` 使用 `clamp(348px, calc(26vw + 38px), 376px)` 正方形卡；第一階段讀取列同步縮成單行，避免恢復正式卡尺寸後換行重疊。
- 外觀框接入約束：本次未修改正式戰鬥，但已記錄正式接入時必須沿用現有 `#enemyCard`，不得重建抽取專用角色卡；`syncEnemyCosmeticFrame()` 依 `cosmeticFrameId`／`activeCosmeticFrameId`／`enemyCosmeticFrameId` 建立的 `.cosmetic-frame-layer` 必須在詢問、三階段及八秒結果演出全程保留。
- 驗證：Chrome 1440×900 已逐格旋轉七種抽取器，確認標準／速度尖端朝上、其餘五種直立、選中孔位置中、文字不遮圖；敵人卡實測為 `x 976.31 / y 163.80 / 376×376`，第一階段讀取列單行完整。1024×768 已確認上下滑動切換、敵人卡為 `x 694.27 / y 139.77 / 348×348`、無頁面捲軸、缺圖或 console 錯誤。
- 狀態隔離：只修改隔離示範顯示與企劃文件；未修改正式 `board_battle.html`／`board_battle.js`、素材檔、抽取規則、庫存、存檔、`BOARD_GAME_STATE` 或 Socket.IO。

#### 七色孔位背光與雙擊鎖定 V58

- 日期：2026-07-27。
- 檔案：`public/board_lineage_extraction_battle_demo.html`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 專屬背光：七個孔位由各自抽取器 `beam[3]` 的 RGB 動態產生徑向背光與外暈，不再共用固定青色。標準 `73 232 221`、精密 `142 242 250`、力量 `255 72 68`、技巧 `76 218 244`、速度 `79 226 238`、能力者 `190 87 255`、皇級 `246 54 91`；選中抽取器的 `drop-shadow` 同步使用同一色值。
- 說明位置：選擇階段的長句說明由底框左側區域移到右側空白帶；1440×900 使用 `left: 41.5%; width: 25%`，1024×768 使用 `left: 43%; width: 23%`，底端均為 `5.8%`。桌機說明左緣與底框右緣同為 `597.59 px`，平板說明位於底框下方右側，不再蓋住底框或彈巢。
- 鎖定流程：確認按鈕預設停用。桌機只接受前景圓框範圍內的 `dblclick`；平板記錄兩次 420ms 內、位置相差不超過 30px 的輕觸，並排除滑動與長按。鎖定後加入 `cylinder-locked`，確認按鈕才啟用；再次雙擊／雙點解除。
- 鎖定視覺：鎖定後彈巢主圖降至 `opacity: 0.34`，未選抽取器降至 `0.24`，兩者仍完整保留；選中抽取器維持 `opacity: 1`、提高專屬色背光及飽和度。鎖定期間滾輪、方向鍵與上下滑動均不能換掉選擇，解除後才恢復旋轉。
- 驗證：Chrome 1440×900 已確認七種背光 RGB、初始確認停用、圓框外雙擊不鎖定、圓框內雙擊鎖定、滾輪鎖定、再次雙擊解除、解除後旋轉及鎖定後確認進入第一階段；鎖定畫面彈巢與六顆未選抽取器均只淡化不消失。1024×768 已確認雙點鎖定、鎖定後上下滑動不換項、說明位置、無捲軸、缺圖或 console 錯誤。
- 狀態隔離：只修改隔離示範與企劃文件；未接入正式戰鬥、正式抽取器庫存／消耗、存檔、`BOARD_GAME_STATE` 或 Socket.IO。

#### 七連彈巢即時停輪與單點確認 V59

- 日期：2026-07-27。
- 檔案：`public/board_lineage_extraction_battle_demo.html`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 單點流程：移除彈巢下方的確認／返回按鈕與雙擊判定。桌機單擊、平板單點前景圓框後，當下抽取器立即鎖定並於 360ms 後自動進入第一階段；這段時間再次點擊可取消。第一個計時目標尚未出現的待機畫面仍可點左側圓框返回選擇，目標正式開始後不接受換彈。
- 即時停輪：彈巢旋轉途中點擊時，以 `getComputedStyle()` 取得當下旋轉矩陣，換算最接近圓框中央的七分之一圈孔位，再用 170ms 吸附並鎖定；不採用先前動畫的預定終點。快速旋轉後由玩家自行決定停輪時機，能形成左輪式的隨機選彈感。
- 高速旋轉：滑鼠滾輪累積小幅 trackpad 輸入，大幅滾動依每 85 delta 約跨一格、最高十格；平板垂直滑動依距離與速度換算 1～10 格。跨格越多，動畫時間會增加至最高 1070ms，但角速度也提高，保留旋轉途中點擊攔停的操作窗口。方向鍵仍一次一格。
- 持續顯示：選定後只移除選擇互動狀態，`extractor-cylinder-visible` 與鎖定彈巢會保留在第一、第二、第三階段及八秒最終判定；鎖定時彈巢主圖亮度提高至 `opacity: 0.6`，未選抽取器提高至 `0.5`，只淡化、不消失。
- 文字排版：抽取器名稱與成功率／持有數量改成同一橫列置中，加入響應式最小高度，避免平板文字上下被裁；選擇階段不再產生任何底部操作按鈕。
- 桌機驗證：Chrome 1440×900 以大幅滾輪預定轉至「力量共鳴」，旋轉中於角度約 49.39° 點擊後實際鎖定當下圓框內的「精密抽取器」，證明沒有等待預定終點；360ms 後自動進入第一階段，彈巢保持顯示，待機時可點圓框返回，啟動第一個目標後再點不會換彈。頁面為 1440×900、無捲軸、無底部按鈕、console 無錯誤。
- 平板驗證：Chrome 1024×768 模擬 530px／70ms 快速上滑，彈巢一次跨多格；旋轉途中角度約 -6.67° 單點後鎖定當下孔位「力量共鳴」，而非預定終點「速度共鳴」。第一階段前再點可返回選擇；頁面為 1024×768、無捲軸、彈巢未消失、console 無錯誤。
- 程式驗證：HTML inline script `node --check`、示範頁 HTTP 200、彈巢與七種抽取器素材路徑、尾端空白及 `git diff --check` 均通過。
- 狀態隔離：只修改隔離示範與企劃文件；尚未接入正式 `board_battle.html`／`board_battle.js`，未改抽取器正式庫存／消耗、血統因子發放、存檔、`BOARD_GAME_STATE` 或 Socket.IO。

#### 七連彈巢逐幀慣性減速 V60

- 日期：2026-07-27。
- 檔案：`public/board_lineage_extraction_battle_demo.html`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 旋轉模型：V59 依格數設定一次 CSS 終點的轉動，改為 `requestAnimationFrame` 逐幀更新彈巢角度。滾輪與觸控滑動會加入有方向的速度衝量，連續操作可累積至上限；每幀依經過時間套用指數摩擦，速度由快到慢自然衰減，低於門檻後才以 300ms 吸附至最近的七分之一圈孔位。
- 操作手感：單次慢滾仍可控制鄰近孔位；大幅滾輪及快速上滑會先高速連轉約兩圈，再於約 2.8 秒內逐步減速。旋轉期間孔位抽取器持續反向補償保持朝上，圓框內名稱、成功率及持有數量會隨當下孔位即時更新。
- 即時攔停：V59 的單點停輪規則保留。點擊前先讀取正在慣性旋轉的實際矩陣角度，再停止動畫、吸附並鎖定當下孔位；不會跳到尚未到達的慣性終點。鎖定後仍於 360ms 進入第一階段，第一個目標開始前仍可返回選擇。
- 效能：只有目前對準孔位改變時才重繪抽取器名稱、圖片及發射配色；每幀只更新彈巢旋轉、七顆抽取器反向角度與選取 class，避免高速旋轉時反覆重設圖片。
- 桌機驗證：Chrome 1440×900 以 `deltaY: 680` 大幅滾輪測得每 100ms 旋轉量由約 96°、67°、55°逐步降為 17°、8°、2°、1°，約 2.8 秒後吸附停止；減速途中約 620ms 點擊，立即由旋轉中的「力量共鳴」停輪並鎖定相同孔位，隨後正常進入第一階段。
- 平板驗證：Chrome 1024×768 模擬 530px／70ms 快速上滑，每 100ms 旋轉量由約 119°、114°逐步降為 80°、44°、2°、1°後停止；頁面維持 1024×768、無水平或垂直捲軸，console 無錯誤。
- 程式驗證：HTML inline script `node --check`、示範頁 HTTP 200、素材路徑、尾端空白及 `git diff --check` 均通過。
- 狀態隔離：只修改隔離示範與企劃文件；正式戰鬥頁、抽取器正式消耗、血統因子發放、存檔、`BOARD_GAME_STATE` 與 Socket.IO 均未改動。

#### 第一階段狀態格與抽取器文字槽校正 V61

- 日期：2026-07-27。
- 檔案：`public/board_lineage_extraction_battle_demo.html`、`docs/DEV_WORKFLOW.md`。
- 待機文字：第一階段開始點出現時，移除「點擊敵人框內的啟動點後才開始計時；第一個目標出現前，點左側圓框可返回抽取器選擇。」整句畫面說明；開始點的「點擊開始」本身保留，返回抽取器選擇的操作規則不變。
- 三格位置：`目標／COMBO／MISS` 狀態列由左側 `left: 7.5%; width: 31%` 移至桌機 `left: 41.5%; width: 25%`；平板由 `left: 5%; width: 37%` 移至 `left: 43%; width: 23%`。三格固定在彈巢與發射底框右側、敵人卡左側的空白區，不再遮住巨型彈巢或抽取器框。
- 文字槽對位：依 1672×941 發射底框素材的實際下方長框，把名稱與資料列由 `left: 72%; bottom: 16.4%; width: 48%` 改成 `left: 65.5%; top: 70.8%; width: 49.5%; height: 7.2%`。文字實際落在底框水平 40.7%～90.2%、垂直 70.8%～78% 範圍，抽取器名稱與階級／階段說明維持同列置中。
- 桌機驗證：Chrome 1440×900 第一階段待機畫面實測文字槽為 `x 281.90～545.63 / y 428.17～449.73`，內容無水平或垂直裁切；狀態列為 `x 597.59～957.59`，右側距敵人卡 18.72px。頁面無捲軸，console 無錯誤。
- 平板驗證：Chrome 1024×768 第一階段待機畫面實測文字槽同樣位於素材 40.8%～90.2%／70.8%～78%，內容無裁切；狀態列為 `x 440.31～675.83`，右側距敵人卡 18.44px。頁面無捲軸，console 無錯誤。
- 程式驗證：HTML inline script `node --check`、示範頁與素材 HTTP 200、尾端空白及 `git diff --check` 均通過。
- 狀態隔離：只修改隔離示範排版與開場文字；未修改正式戰鬥頁、小遊戲判定、抽取器數值／消耗、存檔、`BOARD_GAME_STATE` 或 Socket.IO。

#### 三階段操作說明統一置於狀態格下方 V62

- 日期：2026-07-27。
- 檔案：`public/board_lineage_extraction_battle_demo.html`、`docs/DEV_WORKFLOW.md`。
- 排版統一：一般 `.minigame-stage-instruction` 由左側 `left: 5%; width: 36%` 改成桌機 `left: 41.5%; width: 25%`，與 V61 的三格狀態列完全共用左右邊界；第一階段進行中、第二階段待機／進行中、第三階段待機／進行中的操作說明都會排在三格正下方。
- 平板覆寫：清除 media query 末端仍把說明送回 `left: 3.5%; width: 40%` 的舊規則，統一使用 `left: 43%; width: 23%`。選擇抽取器階段原本已在同一區域的慣性操作說明不變。
- 桌機驗證：Chrome 1440×900 第一階段進行中，狀態列與說明皆為 `x 597.59～957.59`，左右差為 0；說明頂端位於狀態列下方 16.22px。頁面無捲軸，console 無錯誤。
- 平板驗證：Chrome 1024×768 第一階段進行中，狀態列與說明皆為 `x 440.31～675.83`，左右差為 0；說明頂端位於狀態列下方 20.20px。頁面無捲軸，console 無錯誤。
- 程式驗證：HTML inline script `node --check`、示範頁 HTTP 200、尾端空白與 `git diff --check` 均通過。
- 狀態隔離：只修改隔離示範的說明文字版位；正式戰鬥頁、小遊戲流程與判定、抽取器數值／消耗、存檔、`BOARD_GAME_STATE` 及 Socket.IO 均未改動。

#### 發射轉向殘影與抽取器專屬充能色 V63

- 日期：2026-07-27。
- 檔案：`public/board_lineage_extraction_battle_demo.html`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 殘影原因：最終判定開始時，圓框內同時存在彈巢選中孔位的直立抽取器，以及負責 90° 旋轉發射的 `.extractor-showcase-device`。平常兩層完全重疊，旋轉時下層仍維持直立，因而形成未轉向殘影。
- 圖層修正：只在 `.outcome-sequence` 最終判定期間，把選中孔位的 `.extractor-cylinder-device-upright` 立即設為 `opacity: 0` 且停用淡出 transition；負責旋轉與發射的前景本體維持顯示。巨型彈巢、孔位背光及其餘六顆抽取器全部保留，不會把整個彈巢隱藏。
- 專屬充能色：抽取器本體的待機外暈、轉向完成外暈及 `extractorCharge` 760ms 呼吸閃光，全部由固定青色改讀既有 `--beam-glow-rgb`。標準、精密、力量、技巧、速度、能力者、皇級的 90° 轉向閃光會與各自孔位背光及發射光束同色。
- 桌機驗證：Chrome 1440×900 使用力量共鳴於 90° 旋轉中段檢查，彈巢選中孔位 opacity 為 0、transition 為 0s，其餘六顆仍顯示；充能 filter 實際為紅色 `rgba(255, 72, 68, 0.718)`，旋轉矩陣顯示本體正在轉向，無直立殘影。頁面無捲軸，console 無錯誤。
- 平板驗證：Chrome 1024×768 使用精密抽取器檢查，選中孔位 opacity 為 0、其餘六顆仍顯示；充能 filter 實際為冰青色 `rgba(142, 242, 250, 0.733)`。頁面維持 1024×768、無捲軸，console 無錯誤。
- 程式驗證：HTML inline script `node --check`、示範頁與素材 HTTP 200、尾端空白及 `git diff --check` 均通過。
- 狀態隔離：只修改隔離示範的最終演出顯示層與專屬色；正式戰鬥頁、抽取器數值／消耗、成功率、存檔、`BOARD_GAME_STATE` 及 Socket.IO 均未改動。

#### 新聊天室全破後系統完整交接文件 V64

- 日期：2026-07-27。
- 檔案：`docs/NEXT_CHAT_HANDOFF_20260727.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 交接目的：建立可整段貼到新 Codex 聊天室的正式交接提示詞，避免新聊天室只看到血統小遊戲畫面就跳過原 Board 遊戲、多人快照、正式戰鬥結算與強制企劃順序。
- 必讀與紀錄：新文件要求依序完整閱讀 `AGENTS.md`、`PROJECT_OVERVIEW.md`、`GAME_RULES.md`、`FILE_MAP.md`、`DEV_WORKFLOW.md`、`POSTGAME_LINEAGE_RESEARCH_PLAN.md` 與交接文件本身；特別指定 2026-07-16～07-21 正式 UI 紀錄、約第 1390 行後的 UI 紀錄，以及 V54～V63。也明確要求後續每次改檔都更新 `DEV_WORKFLOW`，並依架構／規則／檔案職責同步其他文件。
- 內容範圍：整理正式入口、最多四人完整快照同步、戰鬥 iframe 與主遊戲責任邊界、使用者固定用詞、全破後故事、十三名 Boss、研究所、競技場、抽取器數值、成功率、角色實例、S～SSS、CPU／共鬥／觀看方、V63 示範行為與候選素材。
- 正式接入邊界：再次記錄血統系統目前只有企劃與隔離示範，正式物品、世界解鎖、研究資料與消耗／發放狀態尚不存在；示範 `stock: 3` 不得接入正式頁。新聊天室必須先完成第 1～4 階段，正式戰後抽取仍留在第 5 階段。
- 下一步：新聊天室第一輪只讀追蹤拉夫德魯正式完成出口、全房解鎖與地圖配置，30 行內回報並等待使用者確認；需要圖片時仍先提供完整提示詞與建立 `incoming/`，不得直接生成假正式資料。
- 驗證：交接檔、`FILE_MAP` 對應條目及 `DEV_WORKFLOW` 紀錄存在；文件尾端換行、尾端空白與 `git diff --check` 通過。本輪只新增／更新文件，未修改正式程式、素材、存檔、`BOARD_GAME_STATE` 或 Socket.IO。

#### 血統抽取示範手機完整縮放 V65

- 日期：2026-07-27。
- 檔案：`public/board_lineage_extraction_battle_demo.html`、`docs/DEV_WORKFLOW.md`。
- 問題原因：示範頁的戰鬥舞台固定最小 `1024×576`；手機 Safari 的可視區小於最小尺寸時，先前只會裁掉超出畫面的桌機舞台，導致玩家只能看到中間一段。
- 手機完整縮放：新增 `viewport-fitted` 舞台模式。當 `visualViewport` 或視窗小於 `1024×576` 時，仍保留原本 1024×576 內部排版，再依目前可視區寬高取較小比例等比縮放、上下左右置中；Safari 網址列收合、旋轉與可視區捲動時會重新計算。桌機 1440×900 與平板 1024×768 不套用縮放，維持原排版。
- 座標校正：`positionExtractorCylinder()` 與 `positionExtractionFx()` 改用縮放後 DOM rect 換算回舞台內部座標，避免彈巢直徑、發射軌道及敵人命中點被舞台 transform 再縮放一次。圓框點擊仍使用畫面實際座標，不影響手機觸控。
- 手機排版：手機縮放模式的敵人卡改靠舞台右緣完整顯示，不再裁掉紅框；第一階段三格狀態列寬度收至 21%，與敵人卡保留間距。角色圖大小與原正式戰鬥比例、抽取器素材及七連彈巢比例均未改動。
- 手機驗證：Chromium 手機觸控模擬 844×390，舞台實際顯示為 693.33×390、四邊均在可視區內、頁面 scroll size 為 844×390；進入抽取器選擇後七連彈巢維持原巨型比例，敵人紅框完整顯示。觸控點擊圓框可鎖定並於 360ms 後進入第一階段；狀態列與敵人卡間距 7.06px，console 無錯誤。直向 390×844 亦完整顯示 390×219.37 舞台且無捲軸。
- 桌機／平板回歸：1440×900 與 1024×768 均未加入 `viewport-fitted`，舞台仍分別為完整 1440×900、1024×768，頁面無水平或垂直捲軸。
- 程式驗證：HTML inline script 語法、示範頁 HTTP 200、尾端空白與 `git diff --check` 通過。
- 狀態隔離：只修改隔離示範的響應式顯示與畫面座標換算；未接入正式戰鬥、未修改抽取器數值／消耗、成功率、存檔、`BOARD_GAME_STATE` 或 Socket.IO。

#### 全破後世界第 1 階段：無風帶消失與十三座孤島正式接入 V66

- 日期：2026-07-27。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`public/images/board/islands/postgame_calm_belt_island.webp`、`public/images/board/final_island/endings/backgrounds/postgame_world_calm_belt_before.webp`、`postgame_world_calm_belt_breaking.webp`、`postgame_world_calm_belt_revealed.webp`、`public/images/board/final_island/incoming/POSTGAME_BOSS_ISLAND_PROMPTS.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 共用世界狀態：新增 `postgameWorld` schema／layout 第 1 版，保存全房 `unlocked`、解鎖玩家／結局／回合／時間、穩定 `layoutSeed`、十三 Boss `bossOrder` 與 `islandAssignments`。任一玩家在 `finishFinalIslandEnding()` 完成拉夫德魯結局後只解鎖一次；狀態直接隨既有手動存檔及 `BOARD_GAME_STATE` 完整快照同步，沒有新增 localStorage key、Socket.IO event 名稱或 server 欄位。
- 舊存檔：`normalizeLoadedGameState()` 先整理 `finalEndingRecords`／`finalEndingCleared`／`finalEndingLast`；已有結局紀錄但沒有 `postgameWorld` 的舊存檔會以原遊戲 seed 穩定補建，並自動補開最終島。未完成結局的新局與舊存檔保持鎖定。`ensurePostgameWorldLayout()` 可重複呼叫，會保留同一 Boss 配置及既有新航線海格事件種類，不重複生成島或 route。
- 正式地圖：上方 `island-1～7` 與下方 `island-43～49` 各向外對齊一個位置，共十四格；本局拉夫德魯占原候選格，其餘依位置生成 `calm-belt-island-01～13`。新增十三條主地圖向外航線及上下排十二條相鄰航線，共 25 段 `postgameRoute`；每段由 `buildDisplayRouteTiles()` 固定建立 5 個正式海格，共 125 格。拉夫德魯原 route 保留 5 格，四個四皇角落自然向外延伸，所有節點可使用既有分岔、移動、海格與回頭路流程。
- 世界演出：結局首次解鎖發出既有 `boardUiEvent` 中的新 `postgame-world-unlock` type，同一份完整快照先帶到其他 client，再由三張 16:9 背景依「消失前／崩解／顯現」播放約 10.8 秒。演出結束後自動切到全圖，十三島、航線與海格依序亮起；可本機略過動畫，但不改共享回合結算時機。桌機、手機及 `prefers-reduced-motion` 均有對應版面。
- 個人探索：十三座島未探索時一律顯示共用 `postgame_calm_belt_island.webp`，Boss 配置雖在全房快照中共享，但 UI 依每位玩家既有 `discoveredIslands` 決定是否揭露。第一次登島會記錄 Boss 名稱；之後只在該玩家海圖切到 Boss 專屬島圖，其他玩家仍保持未知。十三張專屬圖目前尚未收件，正式路徑與 fallback 已預留，完整提示詞與固定檔名存於 `POSTGAME_BOSS_ISLAND_PROMPTS.md`。
- 階段邊界：目前孤島落點只完成偵查與個人情報揭露，真人確認、CPU 記錄後結束本回合；沒有提前接入第 2 階段研究所、第 3 階段競技場、第 5 階段抽取或第 9 階段 Boss 戰／線索。`showPostgameIslands()` 的二十三島舊案仍只保留為歷史視覺草圖，不作正式配置來源。
- 快取：`public/board_game.html` 的正式 `board_game.js` query 更新為 `20260727-postgame-world-stage1-v1`。
- 程式與素材驗證：8787 原服務已在運行，沒有啟動第二個 server；`node --check public/js/board_game.js` 通過，正式頁回傳 HTTP 200，四張新正式 WebP 路徑存在。固定 seed 測得 13 座孤島、25 段新 route、125 個新海格、每 route 皆 5 格、13 個不重複 Boss，連續重建兩次後配置與海格事件完全一致；模擬舊結局存檔可補回相同數量，未通關新局維持 0 座。
- 畫面驗證：Chrome 1440×900 實拍三段演出與全圖，十三島、外向／相鄰航線、拉夫德魯與主 7×7 地圖均可見；390×844 手機量測 `scrollWidth === innerWidth === 390`，標題與略過按鈕皆在可視區。正式地圖完成全圖縮放後無新增 overflow。
- 多人驗證：兩個獨立 Chrome context 以不同 `userId`／`clientId` 建立並加入同一房間後開局；房主解鎖時觀看端收到 version 2 完整快照，雙方皆為 13 島、25 route 且 `islandAssignments` 完全相同。房主把第一座島加入自己的 `discoveredIslands` 後再次推送，房主看到綠牛專屬路徑，另一玩家仍看到共用未知島圖，確認共享配置與個人揭露沒有混用。

#### 十三名 Boss 專屬島圖原作參考提示詞 V67

- 日期：2026-07-27。
- 檔案：`public/images/board/final_island/incoming/POSTGAME_BOSS_ISLAND_PROMPTS.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 提示詞：十三組提示詞由「共用段落＋個別描述」改為每組可獨立整段貼入生圖工具的完整版本，全部固定 1024×1024、高角度三分之四鳥瞰、手繪動畫海賊 RPG 島圖、148×108 縮圖辨識度與完整不裁切規格。
- 場景原型：史基／Merveille、泰佐洛／Gran Tesoro、Z／Piriodo、Tot Musica／Elegia、巴雷特／Delta Island、薩卡／Asuka Island、伽治／Germa Kingdom、覺醒路基／Egghead、King／Onigashima、卡塔庫栗／Whole Cake Island＋Mirro-World、雷德菲爾德／約定之島＋Trans Town、洛基／Elbaph 冥界與寶樹亞當、綠牛／重新長滿植物的 Udon。對沒有正式個人島的角色明確註明採用最相關據點或戰場延伸，不把延伸設計誤寫成原作個人島。
- 參考連結：每組可複製引用區塊新增 `Visual reference links`，直接附上對應場景的 One Piece Wiki 圖庫／資料頁；泰佐洛另附 Gran Tesoro 空拍圖頁、Z 另附 Piriodo 電影畫面、雷德菲爾德另附 Nintendo 遊戲頁。使用者把整個引用區塊貼給支援讀取網址的生圖工具時，參考連結會與文字規格一起送出。
- 背景規格：依使用者工作流統一要求完整不透明海面與天空背景，不要求生成透明圖、去背圖、白底商品圖或棋盤格；仍在四周保留清楚空間，方便使用者後續自行去背。
- 驗證：以腳本檢查文件共有 13 個固定 WebP 檔名、13 段 `Visual reference links`、13 段可直接複製的英文提示詞，所有提示詞皆包含 1024×1024、不透明背景、無人物／文字／Logo／浮水印與不裁切要求；`git diff --check` 通過。
- 風險：本輪只修改提示詞與文件索引，未新增或移動實際圖片，未修改正式程式、存檔、`BOARD_GAME_STATE` 或 Socket.IO；十三張專屬圖收件前仍由共用未知島圖 fallback。

#### 十三名 Boss 專屬島圖正式歸檔 V68

- 日期：2026-07-27。
- 檔案：`public/images/board/islands/postgame_boss_shiki_island.webp`、`postgame_boss_gild_tesoro_island.webp`、`postgame_boss_zephyr_island.webp`、`postgame_boss_tot_musica_island.webp`、`postgame_boss_douglas_bullet_island.webp`、`postgame_boss_saga_island.webp`、`postgame_boss_vinsmoke_judge_island.webp`、`postgame_boss_rob_lucci_awakened_island.webp`、`postgame_boss_king_island.webp`、`postgame_boss_charlotte_katakuri_island.webp`、`postgame_boss_patrick_redfield_island.webp`、`postgame_boss_loki_island.webp`、`postgame_boss_aramaki_island.webp`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 素材歸檔：使用者提供的十三張 `-Photoroom.webp` 去背版全部為 1024×1024 RGBA WebP，已逐張複製到 `public/images/board/islands/` 並移除檔名中的 `-Photoroom`，符合既有 `POSTGAME_BOSS_POOL` 預留的正式路徑。沒有修改 Boss key、名稱或圖片路徑設定。
- 原圖保留：`public/images/board/final_island/incoming/` 內十三張完整背景原圖與十三張 `-Photoroom` 去背來源全部保留，沒有覆蓋、刪除或搬走；正式頁仍不直接引用收件區。
- 視覺檢查：逐組並排檢查完整背景原圖與去背版；所有 Boss 主地標、外輪廓及配色均可辨認。部分去背版保留靠岸海水，延續現有未知島圖的透明島嶼做法；以深色海洋底模擬正式 148×108 節點後，十三張均可辨識，無整張透明、錯圖或不可見成品。
- 檔案驗證：十三張正式圖均為 1024×1024、具有有效 0～255 alpha、固定檔名與 `board_game.js` 十三條 `islandImage` 路徑一一對應；正式檔與各自 `-Photoroom` 來源雜湊一致。啟動 `npm start` 後確認 `board_game.html` 與十三張 `/images/board/islands/postgame_boss_*_island.webp` 均回應 HTTP 200／`image/webp`；既有共用 `postgame_calm_belt_island.webp` fallback 保留，`git diff --check` 通過。
- 風險：本輪只新增正式圖片並更新文件，未修改程式、存檔、`BOARD_GAME_STATE`、localStorage key 或 Socket.IO；Zephyr 的火山煙柱以及少數島圖的岸邊海水接近畫布邊緣，但 148×108 contain 縮放未裁切主地標，若日後需要更寬安全邊界可從保留的來源圖重新去背。

#### CPU 主線任務不回溯 V69

- 日期：2026-07-28。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 原因：CPU 完成目前主線後，舊流程會立即用整局累積統計刷新下一話，並允許同一次事件最多連續領取 8 話；長局可能在一次結算內觸發大量主線獎勵、紀錄與重繪。
- 規則：CPU 每次事件最多自動領取一話。解鎖下一話時，把該條件當下的絕對值保存為選配 `mainMission.goalBaseline`，之後只以「目前絕對值－啟用基準」計算新進度；真人仍依原規則使用累積統計與現況回溯。
- 相容性：`mainMission` schema 由版本 1 升為 2，保留原 id、`claimedMissionIds` 與 `stats`。舊 CPU 快照沒有 `goalBaseline` 時允許目前話數依原規則結算一次，領取後的新話數才建立基準；舊真人快照完全沿用原判定。沒有新增 localStorage key、Socket.IO event 或 server 欄位，完整 `BOARD_GAME_STATE` 與手動存讀檔仍直接攜帶 `mainMission`。
- 快取：`public/board_game.html` 的正式 `board_game.js` query 更新為 `20260728-cpu-main-mission-no-backfill-v1`。
- 驗證：`node --check public/js/board_game.js` 與 `git diff --check` 通過。隔離 Chrome 情境以版本 1 CPU 主線與大量舊統計呼叫原本的 8 話領取入口，實際只領 1 話；下一話保持 0 並記下基準，無關事件不補進度，啟用後的新骰子事件可正常完成 1 話並進入下一話。相同舊統計套到真人時仍可回溯完成。版本 2 快照存讀後保留基準 7；移除基準並降成版本 1 的舊快照也可成功讀取、升為版本 2 且保留目前話數。另以正式海域二選一 modal 驗證 CPU 能從重複的 4 個操作節點去重並選中金錢卡，既有海域選擇處理未受影響。原 8787 服務正在使用，因此另以 `PORT=8788 npm start` 啟動同專案，`/health` 與 `/board_game.html?cpu4=1` 均回應 HTTP 200，HTML 已帶新 query；驗證後已停止臨時 8788 process，原 8787 房間未重啟。

#### 全破後航線海格統一一般樣式 V70

- 日期：2026-07-28。
- 檔案：`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 原因：正式新世界 route 會替海格加上 `postgame-route-tile`，原 inline CSS 又把這個 class 永久覆寫成 20×20、2px 金邊、6px 圓角與青綠發光，和主地圖一般 16×16 海格明顯不同。
- 修正：移除 `.sea-tile.postgame-route-tile` 的永久尺寸與配色覆寫。`postgame-route-tile` class、`postgameTileReveal` 首次顯現動畫、postgame route 線條與生成資料全部保留；動畫結束後只繼承共用 `.sea-tile` 樣式。
- 邊界：沒有修改 13 座島、25 段 route、125 個海格的數量、id、座標、zone、事件種類、移動、存檔、`BOARD_GAME_STATE` 或 Socket.IO。
- 快取：`public/board_game.html` 的正式 `board_game.js` query 更新為 `20260728-postgame-sea-tile-style-v1`。
- 驗證：隔離 Chrome 解鎖新世界後仍生成 13 島、25 route、125 個 postgame 海格；桌機與 390×844 手機 viewport 中，一般與 postgame 海格的 computed style 均為 16×16、1px 邊框、4px 圓角、相同藍色漸層與陰影，完整比較結果一致，手機頁面無額外水平溢出，首次顯現動畫規則仍存在。`node --check public/js/board_game.js` 與 `git diff --check` 通過；另以 `PORT=8788 npm start` 啟動同專案，`/health`、`/board_game.html?cpu4=1` 均回應 HTTP 200，HTML 已帶新 query，驗證後已停止臨時服務。

#### 全破後航線底線與孤島光環統一 V71

- 日期：2026-07-28。
- 檔案：`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 原因：海格本身於 V70 統一後，`postgame-route-edge` 仍永久套用 12px 黃綠漸層、2px 深色外框與發光，和一般 10px 淡藍航線不同；`postgame-island` 的島圖容器也以 `::after` 永久畫出 3px 金色不規則環與光暈。金環是 CSS 疊層，不在共用未知孤島圖片內。
- 修正：移除上述兩段永久專用樣式。postgame 航線底線現在繼承共用 `.board-edge`；未知孤島不再產生金色環形偽元素。`postgame-route-edge`、`postgame-island` class 與 `postgameRouteReveal`、`postgameIslandReveal` 首次顯現動畫全部保留。
- 邊界：沒有修改 13 座島、25 段 route、125 個海格、島圖、Boss 洗牌、登島揭露、事件、座標、移動、存檔、`BOARD_GAME_STATE` 或 Socket.IO。
- 快取：`public/board_game.html` 的正式 `board_game.js` query 更新為 `20260728-postgame-route-island-style-v2`。
- 驗證：隔離 Chrome 解鎖新世界後，桌機 1440×900 與手機 390×844 均生成 13 個 postgame 島節點與 150 段 postgame edge；一般與 postgame edge 的 computed style 完全一致，均為 10px、相同淡藍漸層／陰影與 `.9` opacity。未知孤島 `::after` 為 `content:none`、`border-width:0`、`box-shadow:none`；航線與島嶼首次顯現動畫規則仍存在，兩種 viewport 均無頁面水平溢出。`node --check public/js/board_game.js` 與 `git diff --check` 通過；另以 `PORT=8788 npm start` 啟動同專案，`/health`、`/board_game.html?cpu4=1` 均回應 HTTP 200，HTML 已帶 v2 query，驗證後已停止臨時服務。

#### 全破後世界第 2 階段：約克後續與研究所正式接入 V72

- 日期：2026-07-28。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`public/images/board/islands/research_lab_island.webp`、`public/images/board/research_lab_ui/postgame_york_escape_deployment.webp`、`postgame_egghead_relocation.webp`、`postgame_lilith_emergency_broadcast.webp`、`postgame_research_lab_activation.webp`、`research_lab_panel_frame.webp`、`research_lab_character_card_frame.webp`、`research_lab_primary_button_frame.webp`、`research_lab_secondary_button_frame.webp`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 素材歸檔：四張 1680×945 RGB 劇情背景與四張 RGBA UI 框由 `research_lab_ui/incoming/` 複製到正式目錄；研究所島 1024×1024 RGBA 去背圖由 `final_island/incoming/research_lab_island-Photoroom.webp` 複製為 `images/board/islands/research_lab_island.webp`。收件圖、原始來源及去背原檔全部保留，正式頁不引用 `incoming/`。透明素材已在深色中性底合成檢查，隱藏 RGB 色塊均位於 alpha 0 區域，瀏覽器顯示無紅／灰／藍方塊。
- 七段世界演出：既有 `postgame-world-unlock` event 不改名，總時長延伸為約 25.8 秒，依序播放無風帶消失前、崩解、十三島顯現、約克早期部署、蛋頭島移動、莉莉絲緊急通訊與研究所啟動。新通關在同一次全房演出完成；已有第 1 階段 `postgameWorld.unlocked` 的舊存檔以 `researchStoryPlayed` 補播一次，不消耗當前回合。七張 1680×945 WebP 均可完整載入，也可本機略過。
- 設施分流：`postgameWorld.researchLabsActive` 開啟後，只有原始 `island.kind === "hospital"` 的正式醫院在 `getEffectiveIslandKind()` 轉成 `research_lab`，因此保留 island id、座標、route 與存檔相容。敵人島暫時服務只接受原 `shop`／`hospital`／`tavern` 三種，臨時醫院仍使用舊醫院圖與舊醫療 modal，不會被誤判為研究所。醫療傳送道具會把正式研究所視為可用醫療設施。
- 永久角色實例：新增 `RESEARCH_LAB_SCHEMA_VERSION = 1`。每玩家 `researchLab` 保存 `nextInstanceSequence` 與完整角色物件的 `collection`；既有船員或收藏若缺 `instanceId`，會以玩家、角色模板 id 與序號產生穩定不重複 id。`card.id` 不改名，現有招式、修行、被動、進化、攜帶物、外觀框、主動換人與戰鬥流程仍以原模板 id 運作。
- 收藏與登船：研究所第一版正式 UI 包含免費全隊醫療、船上六人格與可捲動研究收藏。存入／取回以 `splice`／`push` 移動同一角色物件，不 clone 或重建；船上至少保留一人、最多六人，同一 `card.id` 不得同時重複登船。收藏角色不進入正式船員陣列，因此不參與戰鬥、替補或玩家物品交易。操作方可切頁、醫療、存入／取回與離開，觀看方收到既有 `spectator-modal` 唯讀 payload；CPU 需要恢復時自動醫療，狀態良好時自動離開。
- 存檔與同步驗證：新格式先把娜美存入收藏，建立手動存檔 payload、破壞本機狀態後讀回，`card.id`、`instanceId`、等級與收藏位置完全相同；模擬刪除 `researchLab` 與全部 `instanceId` 的舊快照後讀檔，安全補成 schema 1 與兩個不重複 id。兩個獨立 Chrome context 建立／加入測試房 `B2115` 並開始遊戲；房主送出研究所解鎖及兩名角色完整快照後，觀看端收到 version 2，`researchLabsActive`、正式醫院 base kind、位置、兩個 instance id、next sequence 與收藏完全一致。房主開啟研究所時，觀看端顯示三個禁用頁籤與「關閉觀看」唯讀畫面。
- 功能驗證：正式醫院的有效 kind 為 `research_lab`，同一測試中的敵人島臨時醫院仍為 `hospital`。角色存入／取回前後保持同一 JavaScript 物件與 `instanceId`；重複 `card.id` 登船會被拒絕且仍留在收藏。CPU 低 HP 進入研究所後由 1／118 自動恢復至 118／118，再正常關閉 modal。1440×900 桌機研究所畫面無 overflow，390×844 直向手機以 358×201.47 完整等比顯示且 `scrollWidth === clientWidth`。正式連線頁 `/board_game.html?room=B8675&online=1` 回應 HTTP 200，載入新 query、debug 入口與所有正式資源；應用程式頁面錯誤與正式素材 HTTP 錯誤皆為空，只保留專案既有、與本功能無關的根目錄 `favicon.ico` 404。
- 快取與程式驗證：`public/board_game.html` 的正式 query 更新為 `20260728-postgame-research-lab-stage2-v1`；`node --check public/js/board_game.js` 通過，原 8787 服務以 `npm start` 啟動後頁面可開。沒有新增 localStorage key、Socket.IO event 名稱或 server 欄位。

#### 研究所島移除方格與圖像置中 V73

- 日期：2026-07-28。
- 檔案：`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 原因：研究所使用新增的有效島種 `research_lab`，但先前沒有加入圖片島節點的透明背景 selector，因此仍繼承 `.island-node` 的半透明漸層方格、邊框、陰影與背景模糊。研究所島圖又是 1024×1024 正方形素材，圖片寬度撐到 148px 時會高於 108px 圖框；原本從圖框頂部排列，使島圖中心比節點中心向下約 15.3px。
- 修正：把 `.island-node.kind-research_lab` 加入 158×134 圖片島尺寸及透明背景兩組共用 selector；研究所島圖改以 `top:50%`／`left:50%` 絕對定位，配合 `translate(-50%, calc(-50% + 4px))` 依正式圖框做視覺中心校正。只改研究所島，其他島種與共用地圖資料不變。
- 驗證：隔離 Chrome 解鎖研究所後，桌機 1440×900 與手機 390×844 的節點 computed style 均為 `background-image:none`、透明 border、`box-shadow:none`；島圖中心相對節點中心的 X／Y 差皆為 0／0，手機頁面無水平 overflow。正式頁 HTTP 200，新 query 為 `20260728-research-lab-map-center-v2`。
- 邊界：未修改研究所圖檔、島 id、位置、航線、服務規則、角色收藏、存檔、`BOARD_GAME_STATE`、localStorage key 或 Socket.IO。

#### 研究所圖片比例與標準抽取器補給 V74

- 日期：2026-07-28。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`public/js/board_items.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 圖片原因與修正：研究所角色卡框是 1024×1024，但原本醫療頁六欄與登船／收藏三欄格線直接把 `.research-lab-card-frame` 設為 `object-fit:fill`，造成明顯直向或橫向拉伸；醫療島圖的外框也因欄寬與列高不同而呈橢圓。角色卡、卡框、人物圓圖及醫療島圖全部改回 1:1，依實際素材的圓形人物窗與三段文字／操作槽重新對位；主面板 1672×941 與按鈕 3:1 原始比例保持不變。
- 科研補給：研究所左側新增「科研補給」頁，永久販售正式道具 `lineage_extractor_standard`「標準血統因子抽取器」。單價 600 B、既有重要道具背包最多堆疊 99 個；購買會扣除玩家貝里、記錄 `obtain_item`／`shop_buy`／`island_service`、推送既有完整遊戲快照，並留在補給頁顯示最新貝里與持有量。此道具不加入一般 `item_shop`、海格事件池或敵人掉落池。
- 驗證：`node --check public/js/board_items.js` 與 `node --check public/js/board_game.js` 通過。Chrome 1440×900 實測醫療島圖 202.9×202.9、六張醫療卡各 133.4×133.4、登船卡各 187.6×187.6；角色圖、姓名及按鈕均落在正式框槽內。補給頁以 3,000 B 購買後變為 2,400 B，持有量由 0 變 1；手機 390×844 的島圖、角色卡與抽取器圖仍保持 1:1，頁面無水平或垂直 overflow。正式 query 為 `board_items.js?v=20260728-research-lab-supply-v1` 與 `board_game.js?v=20260728-research-lab-supply-v3`。
- 邊界：本次只正式接入標準抽取器的資料、購買與既有背包保存；戰後抽取詢問、三階段小遊戲、正式消耗與血統因子發放仍屬下一階段。未新增 `gameState` 欄位、localStorage key 或 Socket.IO event，也未改島 id、路線、免費醫療或角色收藏規則。

#### 研究所三框對位與複製人培育入口 V75

- 日期：2026-07-28。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 對位原因：`research_lab_panel_frame.webp` 左側只有三個固定大框，先前卻把免費醫療、科研補給、登船名單與研究收藏四個按鈕平均塞入較短區域；上方標題容器延伸到右側機械裝飾，狀態說明也擠在同一木牌，底部按鈕的右緣則超過真正長框。這些問題不能只靠縮字修正。
- 三層導覽：左側固定改為「免費醫療／血統研究／角色管理」三個主入口，逐一對準三個素材框。血統研究在主內容框內提供「科研補給／複製人培育」次分頁；角色管理提供「登船名單／研究收藏」次分頁。上方木牌只放英文標籤與研究所名稱；狀態訊息移入底部長框左側，3:1 主要／次要按鈕收在同一長框右側。
- 培育入口：新增「複製人培育」可見頁與「選擇因子後製造」停用按鈕。頁面明示抽取成功的完整血統因子會在此生成 Lv.1、基礎型態的永久角色實例；目前正式戰後抽取與個人因子庫存尚未接入，因此數量固定顯示 0 並保持安全空狀態，不新增假因子、假角色或提前消耗。
- 驗證：Chrome 1440×900 的三個主框按鈕分別為 274.5×149，標題、936.3×474.7 主內容與 943.4×74.5 底部長框都位於正式主框內；五個頁面逐一檢查標題、主按鈕、次分頁、說明、角色卡文字、狀態與底部按鈕，`scrollWidth/Height` 均未超過各自容器。1024×768 五頁同樣沒有文字或頁面 overflow；390×844 及 844×390 的複製人培育頁完整等比顯示，頁面尺寸等於 viewport。正式 `board_game.js` query 為 `20260728-research-lab-layout-cultivation-v4`。
- 邊界：未新增或改名 `gameState`／`researchLab` 欄位、localStorage key、Socket.IO event、完整血統因子庫存、角色生成判定或 CPU 培育。正式抽取成功發放與研究所消耗生成仍依強制順序在第 5～6 階段接入。

#### 複製人培育艙素材提示詞與收件區 V76

- 日期：2026-07-28。
- 檔案：`public/images/board/research_lab_ui/cultivation/incoming/RESEARCH_LAB_CLONE_CULTIVATION_CHAMBER_PROMPT.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 素材判斷：既有研究所主框、角色框及按鈕框可繼續沿用；複製人培育頁只缺一張能在中央動態疊入角色的正式培育艙主圖，不需要重畫整張研究所背景或操作框。
- 提示詞規格：1536×1536 正方形，深海軍藍、舊黃銅與青綠能量的海賊研究所風格；培育艙完整置中並保留角色疊圖安全區，禁止文字、人物、抽取器、背景場景、棋盤格與金色圓形光環。生成版保留純色背景，由使用者自行去背。
- 邊界：本次只新增素材提示詞、收件資料夾與文件索引；未讓正式頁引用不存在的圖片，也未新增血統因子庫存、消耗、角色生成、存檔或同步狀態。

#### 複製人培育艙正式素材接入 V77

- 日期：2026-07-28。
- 檔案：`public/images/board/research_lab_ui/cultivation/incoming/research_lab_clone_cultivation_chamber_draft.webp`、`public/images/board/research_lab_ui/cultivation/research_lab_clone_cultivation_chamber.webp`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 素材驗收：收件圖為 1536×1536 RGBA WebP，透明像素約 26.23%、完全不透明像素約 72.26%、半透明像素約 1.51%；沒有文字或人物，中央玻璃培育艙保留角色疊圖安全區。原始收件圖保留，另複製並固定命名為 `research_lab_clone_cultivation_chamber.webp`。
- 正式接入：`RESEARCH_LAB_UI_ASSETS` 新增培育艙路徑；複製人培育空狀態頁以正式圖片取代 CSS 圓形 DNA 佔位圖。圖片容器固定 1:1、使用 `object-fit:contain`，不產生額外圓框、假 DNA 線或金色光環。
- 驗證：`node --check public/js/board_game.js` 通過；正式 8787 頁面回應 HTTP 200 並載入 `20260728-research-lab-cultivation-art-v5`。隔離 Chrome 1440×900 實測圖片自然尺寸 1536×1536、顯示尺寸 285.83×285.83；390×844 顯示 72.17×72.17。兩種 viewport 的頁面與研究所主框 X／Y overflow 都是 0，圖片、說明與底部操作框沒有重疊。
- 邊界：只接入視覺素材；完整血統因子庫存、消耗、個體傾向、角色生成、CPU 培育、存檔 schema 與同步欄位仍未提前新增。

#### 複製人培育頁視覺比例與生成演出規格 V78

- 日期：2026-07-28。
- 檔案：`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 畫面調整：複製人培育頁左側圖區由 34% 擴大為 42%，欄距由 5% 收為 3%，培育艙上限由 35dvh 提升為 42dvh；英文標籤、主標題、說明與狀態字的最大尺寸分別縮為 10／24／12／11px，使正式培育艙成為主要視覺並保留右側文字閱讀區。
- 後續演出定案：完整血統因子圖投入後逐漸溶解，只保留對應抽取器色光；角色從腳底開始，以像吹泡泡般逐漸放大的圓形遮罩向頭部顯影；遮罩抵達頭部時以泡泡破裂閃光切換成完整角色圖。正式永久實例只在破裂節點完成後提交一次，避免重整或同步重送造成重複生成。
- 素材邊界：上述演出可沿用因子圖、抽取器色票與角色正式圖，以 CSS mask、粒子與光暈完成，目前不需要新增圖片，也不提前接入因子消耗或角色生成。
- 快取：`public/board_game.html` 的正式 `board_game.js` query 更新為 `20260728-research-lab-cultivation-scale-v6`。
- 驗證：隔離 Chrome 1440×900 實測培育艙由 285.83×285.83 放大為 364.89×364.89；390×844 由 72.17×72.17 放大為 92.16×92.16。兩種 viewport 的頁面、研究所主框、右側文案與每個文字元素 X／Y overflow 都是 0，培育艙維持正方形且未與文案或底部操作框重疊。

#### 全破後世界第 3 階段：正式酒館轉競技場 V79

- 日期：2026-07-28。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`public/images/board/islands/arena_island.webp`、`public/images/board/arena_ui/arena_selection_panel_frame.webp`、`public/images/board/arena_ui/incoming/arena_selection_panel_generated.png`、`public/images/board/arena_ui/incoming/ARENA_SELECTION_PANEL_PROMPT.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 素材產出與歸檔：使用內建 ImageGen 依 1672×941 固定版位直接生成無文字、無角色的競技場選擇／出戰主框，原始 RGB PNG 保留在 `arena_ui/incoming/`，另轉為品質 95 的正式 RGB WebP；完整最終提示詞一併保存。既有 `final_island/incoming/arena_island-Photoroom.webp` 的 1024×1024 RGBA 競技場島圖複製到正式 `images/board/islands/arena_island.webp`，來源與去背原檔不刪除。
- 設施分流：`postgameWorld.researchLabsActive` 開啟後，只有原始 `island.kind === "tavern"` 的六座正式酒館在 `getEffectiveIslandKind()` 轉成 `arena`，保留原 island id、名稱資料、位置與 route；顯示名稱只在 UI 把酒館／酒吧／酒場替換為競技場。敵人島暫時轉成的酒館仍由 `islandState.currentKind` 顯示為 `tavern`，不使用競技場圖或流程。
- 選擇與出戰：競技場從 `CHARACTER_CARDS` 動態建立目前 51 名正式角色清單，每名對手固定 Lv.99、套用最高正式進化／覺醒型態、滿 HP／PP、獨立敵方快照；介面右側四欄可捲動選一名對手，下方六格剛好選兩名出戰船員。戰鬥沿用正式 battle page，不新增第二套戰鬥引擎；`getTeamEffects()`、`livingCrewIndices()` 在 `isArenaBattle` 時只計入兩名選中船員，因此主動換人與瀕死替補不會叫出其餘四人。
- 狀態隔離與續戰：入場前保存全隊 `currentHp`、招式 PP、能力階段、異常狀態及 `activeCrewIndex`，選中兩名以滿 HP／PP、無升降與無異常開戰；勝利、戰敗或逃跑後完整回復入場快照，戰敗不送推進城，已消耗戰鬥道具仍照原規則扣除。多人局每輪 `round-pause` 時保留競技場 pending battle 與同一回復快照，下次輪到該玩家由 `resumeArenaBattle()` 續戰，正式離場才回復。
- 獎勵與相容：勝利依基礎 `tier` 自動給 T1＝25、T2／T3＝15、T4／T5／T6＝10 點個人研究點數，不執行一般貝里、懸賞金或 EXP 獎勵；逃跑或戰敗不給點數。`researchLab` schema 由 1 升為 2，新增 `researchPoints` 並對舊快照缺值安全補 0；沒有新增或改名 localStorage key、Socket.IO event 或 server 欄位。競技場狀態、入場回復快照與研究點數直接包含在手動存檔及既有 `BOARD_GAME_STATE` 完整快照。
- CPU 與觀看：CPU 有至少兩名船員時依本局 seed、玩家、回合與島 id 穩定選一名對手並派前兩名出戰；不足兩名時正常結束設施回合。操作方開啟競技場會透過既有 `spectator-modal` 發送 51 名對手、船員選擇與研究點數，觀看方顯示全部禁用的唯讀主框及「關閉觀看」，不能代替操作方選人或開戰。
- 畫面驗證：1440×900 的正式主框實測 1408×792.41，51 名對手、6 名船員、1 名對手與 2 名船員預選完整，主框與頁面 X／Y overflow 都是 0；390×844 直向手機以 358×201.47 等比顯示，兩個按鈕各 55.14×14.14，頁面與 modal 均無水平／垂直 overflow。正式競技場島自然尺寸 1024×1024，地圖節點 `background-image:none`、無 box shadow，島圖中心相對節點中心 X／Y 差為 0／0；六座正式酒館均顯示為 `arena`，臨時酒館仍是 `tavern`。
- 規則驗證：以兩名入場前 HP 1／2、首招 PP 0／1、上場索引 3 的船員挑戰 T1 魯夫；入場變為滿 HP 118／118、PP 25／25、對手 Lv.99 五檔圖與 374／374 HP。模擬勝利後 HP、PP、上場索引全部回到原值，研究點由 11 增至 36，貝里、懸賞與六名角色 EXP 完全不變。CPU 可自動建立競技場 battle；`round-pause` 產生可續戰 pending snapshot，續戰後模擬戰敗能回復三名原始 HP、不進推進城且不給點數。舊 schema 1 快照正規化為 schema 2／0 點；活動中的競技場手動存檔 payload 保留 `isArenaBattle`、兩名索引與回復快照。
- 多人驗證：兩個獨立 Chrome context 建立／加入測試房 `B9836` 並開始遊戲。房主打開 88 點的競技場選擇畫面後，觀看端收到 version 2，完整快照中的個人研究點數為 88，唯讀畫面顯示 51 名對手、6 名船員、全部選擇按鈕禁用及關閉觀看按鈕。
- 程式與服務驗證：`node --check public/js/board_game.js` 通過；原 8787 `npm start` 服務的 `/board_game.html?cpu4=1`、競技場島及主框均 HTTP 200，HTML 載入 `20260728-arena-selection-v1`。正式素材／程式沒有頁面錯誤，只保留專案既有且與本功能無關的根目錄 favicon 404。第 3 階段不提前接入勝利後血統抽取；抽取器管理與戰後抽取仍依第 4～5 階段順序處理。

#### 競技場字體框位與島嶼圖複查 V80

- 日期：2026-07-28。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 字體校正：實測發現左下規則框的百分比 padding 會以 1672×941 主框寬度計算，使 285.8px 面板左右各吃掉約 105px，完整最高型態名稱、研究點數與規則內文因此只剩約 75px 寬。內距改為 3.2%／2.5% 的主框縮放值後，桌機內容寬度提高到約 215px；標題行高改為 1.2，避免中文字形上下緣被 `overflow:hidden` 裁到。右側緊湊對手卡改顯示基礎角色姓名，選中後仍在左下詳情顯示完整最高型態名稱。
- 島嶼複查：全破後六座正式酒館都正確顯示為競技場。正式圖自然尺寸 1024×1024，`object-fit:contain`，實際顯示維持 1:1；圖中心相對節點中心 X／Y 差 0／0。節點 `background-image:none`、透明 border、`box-shadow:none`，`::after` 為 `content:none`、0px border 且無 shadow，因此沒有方格底或專用金色圓環；保留的只有所有圖片島共用淡藍海面 radial glow。
- 快取與驗證：正式 query 更新為 `20260728-arena-selection-v2`；重新檢查 1440×900 主框六個區塊均無 X／Y overflow，標題、完整選中對手、點數及規則均落在對應框內。`node --check public/js/board_game.js` 通過，8787 頁面與兩張正式圖片仍 HTTP 200。

#### 競技場選中對手圖與六名船員槽位校正 V81

- 日期：2026-07-28。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 左上展示：移除固定 `arena_island.webp`，改用目前 `selectedOpponent.image`／`fallbackImage` 即時顯示點選對手的 Lv.99 最高型態正式角色圖；圖片使用 `object-fit:contain`、底部對齊，角色完整名稱及「Lv.99 最高型態」說明放在同一原生框下緣。點選右側另一名對手會隨原本重繪流程同步更新左上角色圖、左下完整詳情及研究點數。
- 船員槽位：下方 `.arena-crew` 左右內距由主框寬度 2.1% 改為 0.6%，六欄 gap 由 1.7% 改為 1.2%；程式卡片移除額外 border、圓角與一般背景，只保留角色內容、選中能量底與順序徽章。1440×900 實測清單為 x 424.3、寬 678.7，每格 106.3×115.4，六格 x 位置依序為 424.3／538.8／653.2／767.7／882.2／996.6，與主框原生六個金框對齊。
- 圖片驗證：左上魯夫最高型態圖自然尺寸 1086×1448，顯示 200.1×179.2 且未拉伸；六張船員角色圖、姓名與 1／2 選中順序都位於各自金框。頁面無 JavaScript 錯誤，`node --check public/js/board_game.js` 通過。
- 快取：正式 query 更新為 `20260728-arena-selection-v3`。

#### 競技場左上角色圖滿框 V82

- 日期：2026-07-28。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/DEV_WORKFLOW.md`。
- 修正：左下詳情框已顯示完整最高型態名稱、研究點數與戰鬥規則，左上不再重複名稱或「Lv.99 最高型態」文字；展示框 DOM 只保留目前選中對手圖片。圖片由 `object-fit:contain` 改為 `object-fit:cover`，寬高均為 100%，`object-position:center 18%` 優先保留臉部與上半身並鋪滿整格。
- 驗證：1440×900 實測左上框 263.28×229.8，角色圖顯示尺寸完全相同，框內只有一個圖片子元素，X／Y overflow 都是 0；1086×1448 的五檔魯夫圖鋪滿後臉部、頭髮與上半身位於安全區。`node --check public/js/board_game.js` 通過，無頁面錯誤。
- 快取：正式 query 更新為 `20260728-arena-selection-v4`。

#### 全破後世界第 4 階段：七種抽取器取得、背包與交易 V83

- 日期：2026-07-28。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`public/js/board_items.js`、`public/js/board_missions.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 正式道具：補齊精密、力量共鳴、技巧共鳴、速度共鳴、能力者與皇級六種資料，連同既有標準型共七種；沿用 `lineage_extraction_ui` 內七張 1024×1024 正式透明圖。每種都是可消耗的重要道具、各自 `maxStack:99`、明確 `tradable:true`，保留既定成功率與適用目標參數；未加入一般商店或敵人一般掉落池。
- 研究等級與補發：`researchLab` schema 由 2 升為 3，新增只升不降的 `researchLevel` 與 `starterExtractorGranted`。Lv.1～4 門檻採 0／40／120／300 點；舊 schema 1／2 以現有研究點推導等級。世界解鎖後每位真人與 CPU 各補標準型 1 個且只補一次；皇級製作扣點不會使已解鎖等級下降。
- 補給與來源：研究所科研補給改為七格貨架，Lv.1 標準 600 B、Lv.2 精密 1,500 B、Lv.3 三種共鳴各 2,400 B／能力者 3,200 B、Lv.4 皇級 10,000 B＋120 點。`board_missions.js` 新增五件全破後個人研究委託，任務島四個候選在玩家已解鎖對應任務階級時至少保留一件；金／寶石寶箱分別有 18%／28% 機率額外抽取較高階型號。全破後正式勝利依 E／D、C／B、A、S、SS、SSS 發放 2／4／7／10／15／25 點，同場同玩家只結算一次；競技場保留原 25／15／10 點。
- 背包與交易安全：七種抽取器直接顯示在既有「重要道具」分類。正式取得函式會依 `maxStack` 截斷至 99；玩家交易允許明確標記的抽取器突破原本重要道具不可交易限制，但在扣除賣方物品前先檢查收取方最終數量。超過 99 時整筆拒絕，雙方數量與貝里不變；雙向報價亦先驗證最終數量。
- CPU、觀看與同步：CPU 進研究所先醫療，再依等級與資金補到標準 3、精密 2、三種共鳴／能力者／皇級各 1，完成後離場。觀看方的研究所唯讀 payload 改帶七種數量、永久研究等級、貝里與研究點數。所有欄位仍包含於現有手動存檔和完整 `BOARD_GAME_STATE`，未新增 localStorage key、Socket.IO event、server 欄位或修改既有 item id。
- 畫面驗證：Chrome 1440×900 實測七張圖自然尺寸均為 1024×1024、七卡與七按鈕全部位於研究所主框內，頁面 scrollWidth／Height 等於 viewport；844×390 橫向手機主框為 672.16×378.28，七卡同樣全在框內且頁面無 X／Y overflow。重要道具背包實際列出七種抽取器；研究 Lv.1 時只有標準型按鈕啟用，其餘正確顯示 Lv.2／3／4 門檻。
- 規則驗證：精密與皇級各取得 1 個後，貝里由 100,000 降至 88,500；皇級另正確扣除 120 點。98 個精密一次取得 5 個只補到 99；收取方已有 99 個時交易被拒且賣方仍有 2、收取方仍為 99，降到 98 後交易成功成為 99。schema 2／300 點遷移為 schema 3／Lv.4，之後點數降到 180 仍保持 Lv.4。八次高懸賞全破任務島抽選都含一件研究委託；同一 T1 戰鬥研究點只發一次 10 點。CPU 實測補到 3／2／1／1／1／1／1 後扣至 24,800 B、380 點並繼續航行。
- 程式與服務驗證：`node --check public/js/board_game.js`、`node --check public/js/board_items.js`、`node --check public/js/board_missions.js` 通過；`http://127.0.0.1:8787/board_game.html?cpu4=1` 回傳 200。正式 query 統一為 `20260728-extractor-economy-v1`。第 5 階段的戰後詢問、正式消耗、三階段小遊戲、完整血統因子與培育角色仍未提前接入。

#### 研究所七種抽取器圖片式商品卡底框 V84

- 日期：2026-07-28。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`public/images/board/lineage_extraction_ui/product_cards/lineage_extractor_card_standard.webp`、`lineage_extractor_card_precision.webp`、`lineage_extractor_card_resonance_power.webp`、`lineage_extractor_card_resonance_skill.webp`、`lineage_extractor_card_resonance_speed.webp`、`lineage_extractor_card_ability.webp`、`lineage_extractor_card_emperor.webp`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 素材產出：依使用者澄清，這批不是抽取器本體後方的研究艙場景，而是取代研究所補給 CSS 方格的完整商品卡底框。使用內建 ImageGen 產出七張同版型 4:3 原始圖，再轉為品質 88 的 1448×1086 RGB WebP；左側固定為抽取器圓槽、右側為資料框、底部為操作槽。標準、精密、力量、技巧、速度、能力者與皇級分別使用青綠、冰青、赤紅、晶藍、青藍帶洋紅、紫羅蘭、緋紅帶金配色，底圖不烙入抽取器、文字、價格或按鈕標籤。
- 正式接入：七種 `RESEARCH_LAB_EXTRACTOR_DEFS` 各自記錄固定商品卡路徑；補給 DOM 新增純裝飾底框圖，原本透明抽取器、名稱、成功率加成、價格／持有量與 HTML 操作按鈕依素材三個安全槽絕對定位疊入。移除商品格原有 border、圓角、漸層背景與內陰影，鎖定狀態、購買／製作事件、價格、研究等級與庫存規則保持不變。
- 畫面驗證：Chrome 1440×900 正式頁實測七張底框全部完成載入，natural size 均為 1448×1086；七張抽取器、右側文案及底部按鈕皆位於對應原生框內。844×390 橫向手機實測每張卡約 95.15×73.73，七張卡的文案與按鈕 bounding box 全部落在卡片內，研究所主框與頁面無 X／Y overflow。驗證截圖為 `_codex_artifacts/research-extractor-card-art-desktop.png` 與 `_codex_artifacts/research-extractor-card-art-mobile.png`。
- 程式與服務驗證：`node --check public/js/board_game.js` 通過；既有 `npm start` 服務的 `http://127.0.0.1:8787/board_game.html` 回應 HTTP 200，正式 query 更新為 `20260728-extractor-card-art-v1`。本次只改補給頁視覺與靜態素材，未改 item id、價格、成功率、研究點、庫存、交易、CPU、存檔、`BOARD_GAME_STATE`、localStorage key 或 Socket.IO event。

#### 全破後世界第 5 階段：正式戰後血統因子抽取 V85

- 日期：2026-07-28。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`public/board_battle.html`、`public/js/board_battle.js`、`public/css/board_lineage_extraction.css`、`public/js/board_lineage_extraction.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/NEXT_CHAT_HANDOFF_20260728.md`、`docs/DEV_WORKFLOW.md`。
- 正式狀態權威：`board_game.js` 新增每場勝利唯一抽取 scope、每位實際參戰者 entry、開始／完成／放棄命令、CPU 自動抽取及原結算門檻。只有 `postgameWorld.researchLabsActive` 後的新勝利建立機會；戰敗、逃跑、黑轉我方前哨戰不建立，也不追溯舊討伐。沒有抽取器時自動標記 unavailable；共鬥每位實際參戰者各用自己的庫存與結果，觀看方不可控制。
- 庫存與因子：確認抽取器後立即正式扣除 1 個，成功或失敗均不返還；同一 attempt 重複開始或完成不會再次扣除／發放。`researchLab` schema 由 3 升為 4，新增 `nextFactorSequence` 與 `completeFactors`；成功只加入一份含敵人、階級、來源戰鬥、抽取器與判定資料的完整血統因子，不直接生成角色，也不進一般交易。資料沿用手動存檔和現有 `BOARD_GAME_STATE` 完整快照，沒有新增 localStorage key、Socket.IO event 或 server 欄位。
- 機率與小遊戲：ED／CB／A／S／SS／SSS 基礎率為 55／40／28／18／10／5%，上限為 95／95／95／90／85／75%。第一階段依級別產生 8／9／10／12／14／15 個縮圈目標，累積 3 次 Miss 提早結束；第二、三階段沿用左右鎖針與封存雙環。三段各結算一次 Perfect／Good／Miss，分別加 7／3／0%，最高加 21%，沒有保底。
- 半圓七連彈巢：依使用者指定重新實際打開 `board_lineage_extraction_battle_demo.html` 比對，正式版改用同一定位公式與圖層。完整正圓彈巢及七個抽取器孔位一起旋轉，直徑約舞台高度 130%、圓心移到畫面左外側，舞台只露右半圓；發射底框遮住圓盤，只有目前孔位從左側圓孔顯示。滾輪、方向鍵及上下拖曳都可操作，標準／速度型的旋轉、裁切與七種專屬光色沿用示範設定。
- 原戰鬥頁整合：抽取層保留既有 `#enemyCard`、敵人 portrait、HUD 與外觀框，不重建敵方卡。詢問、彈巢、三階段與約八秒成功／失敗演出由新增的 `board_lineage_extraction.js`／`.css` 負責；抽取頁不能自行扣道具或發因子。`board_battle.js` 收到 iframe 通知時會優先重讀主遊戲最新 battle view，修正較舊快照在玩家剛打開彈巢時把畫面切回詢問頁的競態。
- 研究所手機字體：七張圖片式商品卡的文案 flex 間距與標題下內距微調；844×390 實測七個名稱的 `clientHeight`／`scrollHeight` 都是 15／15，不再上下裁字。
- 程式驗證：`node --check public/js/board_game.js`、`public/js/board_battle.js`、`public/js/board_lineage_extraction.js` 均通過；正式頁與新增 CSS／JS HTTP 200。正式 query 更新為 `20260728-formal-lineage-v5`。
- 畫面驗證：Chromium 1440×900 實拍詢問、半圓彈巢、第一階段待機與結果演出；七個孔位／圖片全數載入，敵人卡仍是原 DOM。1024×768 頁面 X／Y overflow 為 0；844×390 保留正式 900×576 戰鬥舞台縮放且沒有新增垂直 overflow。
- 規則驗證：鎖定皇級後數量 3→2，重複開始回傳 false 且維持 2；三次 Perfect 後因子 0→1，重複完成回傳 false 且仍為 1，手動存檔 payload 同為 1。放棄不扣抽取器、無抽取器可直接結算、CPU 會結束於成功／失敗、共鬥一人 offered／一人 unavailable 時會等待前者完成。原戰鬥結算測得貝里 3000→5940 且 battle 正常關閉。
- 多人驗證：以獨立 8791 測試服務建立兩個 Socket.IO client，`BOARD_GAME_STATE` ack 成功；完整因子 id、抽取 success 與 scope 在接收端完整保留。全程瀏覽器 console 例外 0。
- 階段邊界：第 5 階段只完成完整血統因子取得與保存；研究所把因子投入培育艙、泡泡顯影、正式消耗與 Lv.1 永久角色生成仍屬第 6 階段，未提前接入。

#### 正式戰鬥血統抽取 V65 對照提示詞 V86

- 日期：2026-07-28。
- 檔案：`docs/FORMAL_LINEAGE_BATTLE_PARITY_PROMPT_20260728.md`、`docs/NEXT_CHAT_HANDOFF_20260728.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 目的：建立可整段貼給新聊天室的正式戰鬥抽取完整對照提示詞，避免把 V85「規則與狀態已正式接入」誤解成不必再讀 V65 示範，或直接跳到第 6 階段。
- 現況辨識：正式 V85 已完成 `board_game.js` 權威狀態、抽取器即時消耗、成功率、完整因子、CPU、共鬥、iframe 命令橋接與原結算門檻，不應從零重寫；但只讀對照發現正式 `beginMinigame()` 會經 `hideSections()` 隱藏彈巢，而正式 `playOutcome()` 使用簡化的抽取器／單條光束層，仍需實際畫面檢查是否完整符合示範頁持續顯示彈巢、發射底框、透明軌道與八秒演出。
- 提示詞內容：要求完整閱讀 `board_lineage_extraction_battle_demo.html`、V54～V65、V83～V85，以及正式 `board_game.js`／`board_battle.js`／`board_lineage_extraction.js`／CSS；列出狀態權威、七連彈巢、逐幀慣性、單點即時停輪、三階段、安全區、專屬顏色、90° 殘影、手機縮放、CPU／觀看／共鬥／重整／重送與雙視窗驗證清單。
- 安全邊界：明確禁止把示範 `stock: 3`、假敵人、假成功率、重播／重試入口接入正式狀態；正式抽取器只讀玩家重要道具，成功率與完整因子仍只能由 `board_game.js` 權威結算。示範頁本輪保持固定參考，不要求修改。
- 交接更新：`NEXT_CHAT_HANDOFF_20260728.md` 新增對照提示詞為必讀文件，並把下一步調整為「先完成並由使用者確認正式戰鬥抽取視覺／操作稽核，再進第 6 階段」，不否定 V85 已完成的正式資料與規則。
- 驗證：新提示詞、交接文件與 `FILE_MAP` 索引存在；必要函式、V65／V85、手機尺寸、正式 item id、文件更新及驗證關鍵字均可搜尋；尾端空白與 `git diff --check` 通過。本輪只修改文件，沒有變更正式程式、素材、存檔、`BOARD_GAME_STATE`、localStorage 或 Socket.IO。

#### 正式戰鬥血統抽取完整重作與敵人顯示修正 V87

- 日期：2026-07-28。
- 檔案：`public/board_battle.html`、`public/board_game.html`、`public/js/board_game.js`、`public/js/board_lineage_extraction.js`、`public/css/board_lineage_extraction.css`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 敵人顯示：根因是正式戰鬥在 HP 歸零後保留 `.portrait-ko` 的 `cardKnockoutFade`，動畫終點會把整張敵人卡變透明。抽取模式現在強制取消該動畫與透明／位移／濾鏡，沿用原本 `#enemyCard`、角色圖、HUD 及外觀框並提高必要圖層；詢問、選擇、三階段與結算全程都能看到敵人。
- 示範流程對齊：抽取層改用 V65 同款研究艙背景、左側約舞台高度 130% 的七孔巨型彈巢、發射底框與抽取器素材。轉輪以 `requestAnimationFrame` 實際經過時間計算慣性，點擊孔位會立即停止並吸附最近孔位；短暫鎖定預覽期間可再次點擊取消，正式開始後才由主遊戲消耗抽取器。
- 三階段：第一階段會預先產生保持安全距離的目標，顯示目前編號與下一點半透明預覽，累積 3 次 Miss 提早結束；第二、第三階段都有獨立開始按鈕，鎖針與封存雙環會持續循環到玩家點擊，不會只跑一圈就自動判 Miss。修正第三階段正式流程曾引用未定義局部變數的問題，完整實玩能依序進入三階段並回傳三次判定。
- 八秒結算：抽取器先充能、順時針轉 90 度鎖定並後座，再顯示底框內軌道光束與框外命中光束；敵人卡上依序播放命中環與三次封存脈衝。成功時樣本沿光束回收且敵人被封存，失敗時光束與命中環轉紅崩解、敵人掙脫；成功／失敗的正式結果仍完全由 `board_game.js` 已保存的權威判定決定。
- 版面：正式抽取舞台固定為 1024×576，依 `visualViewport` 在桌機、平板、橫向及直向手機等比置中縮放；844×390 實拍中敵人卡、HUD、底框、光束與彈巢均位於舞台可視範圍，頁面新增 overflow 為 0。快取版本統一更新為 `20260728-formal-lineage-v9`。
- 畫面與流程驗證：Chrome 1440×900 實玩第一階段至正式成功，敵人卡 computed opacity／visibility 為 `1`／`visible` 且 `animation:none`；另強制測試失敗結果，確認紅色光束崩解、命中環與敵人掙脫均播放。成功測試確認框內／框外光束 opacity 皆為 1，測試階段三個封存指示依序鎖定，瀏覽器 console 例外為 0。1024×768 與 844×390 正式截圖均完成。
- 規則與同步回歸：皇級抽取器 3→2，重複開始不再扣除；三次 Perfect 後完整因子 0→1，重複完成不再發放，手動存檔仍為 1。放棄、無庫存、CPU、自動結束、共鬥等待及原戰鬥結算均通過；兩個 Socket.IO client 的完整因子 id、結果與 scope 完整一致，`BOARD_GAME_STATE` ack 成功。
- 程式與服務驗證：`node --check public/js/board_lineage_extraction.js`、`public/js/board_battle.js`、`public/js/board_game.js` 通過；完整 `.codex-runtime/lineage_formal_cdp_test.js` 回歸通過且 `consoleErrors: []`。另以 `PORT=8798 npm start` 啟動獨立服務，`/board_battle.html` 回傳 HTTP 200 且包含 V9 query；本機未設 `DATABASE_URL` 時只保留既有資料庫初始化略過警告，不影響靜態頁與 Board 測試。測試完成後已停止該 8798 Node 程序。
- 邊界：本輪沒有修改 item id、成功率、因子資料結構、localStorage key、Socket.IO event 或 server；沒有把示範頁假庫存、假敵人、重播／重試入口接入正式狀態，也沒有提前進行第 6 階段的複製人生成。

#### 正式戰鬥血統抽取示範頁版面完整對齊 V88

- 日期：2026-07-29。
- 檔案：`public/board_battle.html`、`public/board_game.html`、`public/js/board_game.js`、`public/js/board_lineage_extraction.js`、`public/css/board_lineage_extraction.css`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 詢問／結果場景：修正 V87 一出現詢問就提前切成全黑抽取背景、隱藏我方卡並顯示通用青色 CSS 面板的問題。正式詢問現在與 `board_lineage_extraction_battle_demo.html` 相同，保留原戰鬥背景、雙方 HUD、雙方原角色卡及敵人外觀框；下方左側用既有 `battle_switch_panel_frame.webp` 顯示戰鬥紀錄，右側用同框顯示「是否進行血統因子提取？」及既有圖片式選擇／危險按鈕。只有按下「進行提取」才切換研究艙背景並隱藏雙方 HUD 與我方卡。正式成功／失敗與共鬥等待也回到原戰鬥背景的雙面板，不再使用通用圓角面板。
- 彈巢與三階段：移除正式版額外生成在七個孔位後方的 CSS 圓形光暈，保留彈巢圖片本身與抽取器專屬色的選中陰影。全螢幕標題位置／大小改為示範頁的上方置中比例。第一階段敵人互動層改為 portrait 內 `2.5% 3% 15%` 安全區並裁切溢出，啟動圈恢復 34%，固定金環不再錯縮為 55%；目標數字、接近圈與下一點預覽沿用示範尺寸。下方三格改為目標／COMBO／MISS 即時狀態；第二階段顯示 II／III、上一段與本段判定，第三階段顯示 III／III 及三段結果。
- 鎖針／雙環／判定：第二階段軌道寬 146%、左右鎖針寬 31%，由 -4%／104% 向中央咬合；第三階段固定環與脈衝環各佔敵人互動層 92%，與示範頁相同。`PERFECT／GOOD／MISS` 改為大寫並只在敵人 portrait 中央短暫顯示，不再以最大 70px 的文字飄在整個戰鬥舞台右側。
- 正式權威邊界：保留 `board_game.js` 的 scope、正式庫存扣除、成功率上限、完整因子冪等發放、CPU、共鬥、觀看權限、手動存檔與 `BOARD_GAME_STATE`；本輪只修改顯示層與前端輸入統計，不新增或改名狀態欄位、item id、localStorage key、Socket.IO event 或 server 欄位，也沒有接入示範頁假庫存、假敵人、重播／重試入口。
- 畫面驗證：Chrome 正式頁 1440×900 逐段實玩並截查詢問、彈巢、第一階段啟動、第二階段、框中央 MISS、第三階段及正式結果。詢問頁雙方卡／HUD與下方兩框完整；七孔無額外圓形光暈；第一階段圈在敵人卡內，第二／三階段滿框但未超出；結果頁返回原戰鬥背景。1024×768 與 844×390 實拍仍完整等比顯示，桌機／平板／手機頁面新增 overflow 均為 0。
- 規則與同步回歸：正式 QA 再次確認皇級抽取器只扣一次、重複開始回傳 false、完整因子只發一次、重複完成不增加、放棄不扣、無庫存可結算、CPU 可完成、共鬥會等待未決參戰者，原戰鬥結算可關閉；兩個 Socket.IO client 的 factor id、success 與 scope 一致，`BOARD_GAME_STATE` ack 成功，瀏覽器 `consoleErrors: []`。
- 程式與服務驗證：`node --check public/js/board_lineage_extraction.js`、`public/js/board_battle.js`、`public/js/board_game.js` 通過；HTML inline script 語法檢查、三張既有面板／按鈕素材路徑、正式頁 HTTP 200 與 `git diff --check` 通過。快取版本統一更新為 `20260729-formal-lineage-v10`。

#### 正式戰鬥血統抽取光束圖層與結果續行修正 V89

- 日期：2026-07-29。
- 檔案：`public/board_battle.html`、`public/board_game.html`、`public/js/board_game.js`、`public/js/board_lineage_extraction.js`、`public/css/board_lineage_extraction.css`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 彈巢光圈：移除確認圓槽按鈕殘留的 `box-shadow`，並維持七個孔位 `::before` 不產生內容；選擇抽取器時只留下正式彈巢／發射底框素材及抽取器本體，不再額外疊一圈 CSS 光環。
- 光束圖層：原框外光束位於抽取根層內，而敵人卡的正式 `z-index` 更高，導致採樣光束被角色圖壓到後方。演出開始後會把同一個框外光束節點暫時移到 `#battleStage`、以 `z-index:110` 顯示在 `#enemyCard` 的 `z-index:100` 上方，並把所選抽取器的三段光束色直接套到光束節點；關閉或切換結果時再放回抽取結果容器，不重建敵人卡或外觀框。
- 結果續行：成功／失敗判定在約 5.8 秒時顯示「查看提取成功結果／查看提取失敗結果」，玩家可立即前進；若不點擊仍保留原八秒自動進入結果頁。雙面板結果頁固定提供「繼續戰鬥結算」，點擊後關閉抽取層並恢復原 `.action-panel`，避免失敗演出後沒有按鈕而卡住。
- 正式流程驗證：Chrome 1440×900 以正式 `board_game.html` → `board_battle.html` iframe 分別跑成功與失敗。失敗測得框外光束父層為 `battleStage`、光束／敵人卡圖層為 110／100、光束 opacity 1 且實際跨入敵人角色框；判定後「查看提取失敗結果」可用，結果頁「繼續戰鬥結算」可關閉抽取層並恢復戰鬥操作面板。成功測得完整因子 0→1、「查看提取成功結果」及同一續行按鈕均可用。兩條分支瀏覽器腳本例外皆為 0。
- 正式邊界：本輪只修顯示圖層與結果操作入口，沒有修改抽取率、抽取器消耗、完整因子發放、CPU、共鬥、觀看權限、存檔資料、`BOARD_GAME_STATE`、localStorage key、Socket.IO event 或 server。正式快取版本統一更新為 `20260729-formal-lineage-v11`。

#### 正式戰鬥血統抽取封存呼吸環與原結算銜接 V90

- 日期：2026-07-29。
- 檔案：`public/board_battle.html`、`public/board_game.html`、`public/js/board_game.js`、`public/js/board_battle.js`、`public/js/board_lineage_extraction.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 封存呼吸環：正式 CSS 原本已有與示範頁相同的 `lineage-containment-test` 2.7 秒三段縮放呼吸及三個封存指示，但命中環與指示從抽取根層移入 `#enemyPortraitWrap` 後失去 `--lineage-beam-*`／`--lineage-glow-rgb` 繼承，動畫有執行但邊框、陰影與指示色宣告失效。`applyTheme()` 現在把所選抽取器顏色直接套到框外光束、命中環與封存指示，因此雷射命中後能在敵人角色圖上清楚看見三次呼吸脈衝。
- 原結算銜接：抽取結果的「繼續戰鬥結算」先前只執行 `closeRoot()`，沒有改變 `board_battle.js` 的 `currentMode`，實際遊玩可能只關閉抽取層而沒有可操作的原戰鬥結果。抽取控制器新增純 UI `dismiss` callback；正式戰鬥頁收到後設定 `currentMode = "result"` 並重讀最新 view，立即顯示既有「戰鬥勝利／獎勵／返回地圖」面板。原 `battleFinish()`、獎勵與回地圖規則未改。
- 正式畫面驗證：Chrome 1440×900 的皇級成功演出中，命中環位於 `enemyPortraitWrap`，取得皇級 `246 54 91` 色彩，border／三層 glow 均有效；動畫名稱為 `lineage-containment-test`，相隔 420ms 的 transform 由約 0.87 倍變為 1.03 倍，三個封存指示可見。成功按「繼續戰鬥結算」後顯示原「戰鬥勝利！」與「返回地圖」，點擊後 battle 關閉、overlay 關閉並回到 `phase=main`。
- 成功／失敗與平板驗證：正式失敗分支同樣由「血統因子提取失敗」接回「戰鬥勝利！」及「返回地圖」，不再卡住；瀏覽器腳本例外 0。1024×768 的原結算「返回地圖」按鈕完整位於 viewport，頁面 X／Y overflow 皆為 0，點擊後 battle 正常關閉。
- 正式邊界：本輪沒有修改抽取率、抽取器扣除、因子發放、戰鬥獎勵、CPU、共鬥、觀看權限、存檔、`BOARD_GAME_STATE`、localStorage key、Socket.IO event 或 server。正式快取版本統一更新為 `20260729-formal-lineage-v12`。

#### 正式戰鬥血統抽取結果按鈕裁切修正 V91

- 日期：2026-07-29。
- 檔案：`public/board_battle.html`、`public/board_game.html`、`public/js/board_game.js`、`public/css/board_lineage_extraction.css`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 根因：成功／失敗雙面板的右框已建立「繼續戰鬥結算」，但右框同時顯示面板標題及第二個大型「提取成功／提取失敗」，再加四格判定、結果說明與按鈕後超過固定高度；父層 `.lineage-battle-panel` 使用 `overflow:hidden`，因此按鈕落到框外並被裁掉，畫面看起來完全無法操作。
- 修正：結果版保留原生框上方「血統因子提取成功／失敗」標題，隱藏框內重複大標題；四項判定格縮短上下內距、標籤與結果值使用緊湊行高，結果說明同步收窄行高，讓「繼續戰鬥結算」完整落在右下框內。抽取率、結果、因子與原結算事件沒有改動。
- 失敗流程實測：Chrome 1280×600 正式頁使用標準抽取器強制得到成功率 35%、判定 97 的失敗結果。「繼續戰鬥結算」按鈕 top／bottom 為 539.61／575.61，右側面板 top／bottom 為 432／586.80，按鈕完整位於框內且可見；頁面 X／Y overflow 為 0，瀏覽器腳本例外為 0。
- 返回地圖實測：點擊續行後抽取根層關閉，原戰鬥「戰鬥勝利！」獎勵面板與可操作的「返回地圖」出現；按鈕為 197.63×54.55、`visibility:visible`、`opacity:1` 且未停用。再點擊後 `battleState` 清空、戰鬥 overlay 移除 `open`，地圖重新顯示。
- 程式與服務：CSS parser、`node --check public/js/board_lineage_extraction.js`、`public/js/board_battle.js`、`public/js/board_game.js` 及 `git diff --check` 通過；既有 8787 與獨立 `PORT=8798 npm start` 的正式戰鬥頁都回傳 HTTP 200 並載入 V13，測試後已停止 8798 服務。
- 快取與邊界：正式版本統一更新為 `20260729-formal-lineage-v13`。本輪沒有修改 item id、抽取器消耗、成功率、完整因子發放、戰鬥獎勵、CPU、共鬥、觀看權限、存檔、`BOARD_GAME_STATE`、localStorage key、Socket.IO event 或 server，也沒有提前接入第 6 階段培育。

#### 全破後世界第 6 階段：研究所培育與永久個體 V92

- 日期：2026-07-29。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 永久資料：`researchLab` schema 由 4 升為 5。既有船員與研究收藏角色安全補為「均衡型」，HP／攻擊／防禦／戰術／意志／速度各 `+1%`；新培育個體以因子 id 與永久 `instanceId` 固定產生一項主能力 `+5%`、副能力 `+2%`、弱能力 `-2%`，其餘為 0。血統傾向在進化修正後、修行固定加值前套用，建立後永久保存，讀檔、存取、升級與同步都不重抽。
- 培育提交：戰後因子新增並遷移 `sourceCardId`，解析順序為正式來源 id、`arena_` key、角色 id 及唯一精確姓名。只有能解析到現有 `CHARACTER_CARDS` 的因子可培育；尚無玩家模板的敵人明確顯示第 7 階段開放，因子不會被消耗。培育先播放 4.3 秒演出，泡泡破裂節點才呼叫一次正式提交；提交會再次確認因子存在、建立不重複實例 id、移除一份因子並把 Lv.1 基礎型態角色放入收藏。重複提交回傳「已不存在或已使用」，不會建立第二個角色。
- 圖片式介面：不新增素材，沿用正式研究所主框、1536×1536 培育艙、角色卡框、主要／次要按鈕框、抽取結果角色圖、玩家正式角色圖與 `lineage_extractor_card_frame.webp`。因子圖投入中央培育艙後溶解，只留下七種抽取器各自色光；角色以由腳底向上擴大的圓形遮罩顯影，外圈像泡泡膨脹並於頭部破裂。因子名稱、階級、屬性、抽取器及可用狀態都位於圖片原生安全框。
- 收藏與登船：培育完成預設存入研究收藏；船上少於六名且沒有相同 `card.id` 時可立即安排登船，否則保留收藏並說明原因。同名可以重複培育與收藏，但不得同時登船。收藏每頁固定六名，提供取得順序／名稱／等級排序、同名篩選、完整六項能力與傾向詳情、同名永久個體比較；存入與取回仍移動同一物件，保留全部養成資料。
- CPU、觀看與同步：CPU 每次進研究所會先正式培育一份相容因子，符合限制時安排登船，否則保存收藏；之後仍執行既有醫療及補給。觀看方 payload 會帶目前因子、選取項、培育結果、收藏分頁與詳情狀態，但所有操作停用。正式提交後沿用 `scheduleBoardLanStatePush()` 推送完整快照，未新增 localStorage key、Socket.IO event 或 server 欄位。
- 畫面驗證：隔離 Chrome 1440×900 實拍因子選擇、因子投入、能量溶解、圓泡顯影、結果、收藏六格分頁及角色詳情；角色圖、因子圖、標題、四列因子文案、能力列、同名比較及圖片按鈕均位於正式框內。1024×768 平板主框為 992×558.28，844×390 手機橫向主框為 672.16×378.28，頁面沒有新增水平或垂直 overflow；唯一量測到的文字內部行高差不造成可視裁切。
- 規則驗證：力量共鳴型魯夫因子 1→0，正式生成 `level=1`、`totalExp=0`、`formId=base`、`lineageGrowthStage=S` 及固定傾向；同一因子再次提交被拒。隊伍有空位時角色由收藏移回船上，同名第二個體取回被「同一角色不能同時重複登船」拒絕且收藏數不變。舊角色遷移後六項 modifier 都是 `0.01`；未支援因子的主按鈕停用且原因文字正確。CPU 因子 1→0、生成 Lv.1 索隆並在空隊伍自動登船。
- 存檔與多人驗證：手動存檔 payload 可完整 JSON 序列化，保存 schema 5、永久實例、Lv.1、基礎型態、成長階段與六項傾向。獨立 `PORT=8799 npm start` 服務以兩個 Socket.IO client 建立房間並推送 `research-lab-cultivation`；server ack `{ok:true, version:1}`，接收端完整取得相同 schema、因子數、`instanceId`、等級、傾向與成長階段，測試後已停止 8799 Node 程序。
- 程式與服務：`node --check public/js/board_game.js` 通過；六張正式研究所／培育／因子框素材均存在，既有 8787 與獨立 8799 的 `board_game.html` 都回傳 HTTP 200。正式快取版本更新為 `20260729-research-cultivation-v1`。
- 既有回歸腳本：`node scripts/board_game_smoke.js` 在 60 秒內沒有產生錯誤輸出但未自行結束，因此本輪記為逾時、沒有列入通過項目；逾時後已停止該 smoke Node 程序，41731 與 8799 均未留下測試 listener。
- 階段邊界：第 6 階段沒有為一般敵人假造玩家卡，也沒有接入 S→SS／SSS 突破、十三島 Boss、線索或圖鑑。下一階段是第 7 階段，逐批建立現有敵人的玩家培育模板。

#### 研究物品背包可見性修正 V93

- 日期：2026-07-29。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 抽取器顯示：背包不再只依通用正式物品迴圈混排研究耗材；七種抽取器改由固定 `RESEARCH_LAB_EXTRACTOR_DEFS` 順序建立重要道具列，持有數大於 0 時排在重要道具最前方，顯示正式抽取器圖、型號、階級、說明與實際剩餘數量。通用迴圈會略過同一批 id，避免重複列出；抽取器用完為 0 時仍依背包既有規則不顯示空庫存。
- 完整因子顯示：`researchLab.completeFactors` 依敵人身分彙整為重要道具唯讀列，使用該因子的正式敵人／角色圖，顯示姓名、總數、階級、培育可用狀態、來源抽取器及「不可在背包消耗或交易」。背包只建立 view model，不把因子複製進 `inventory.items`，研究所培育仍消耗原本唯一的 factor id，因子交易規則維持禁止。
- 手機文字：完整因子預覽新增專屬短文案及小尺寸排版；844×390 橫向實測完整姓名與兩行說明可見，角色圖自然尺寸 1086×1448，兩張抽取器圖自然尺寸 1024×1024，頁面 scrollWidth／Height 等於 viewport。桌機 1440×900 三列、左側大圖與文字亦全部在 1269×846 正式背包框內。
- 規則與相容性：沒有新增或改名 `gameState`／`researchLab`／`inventory` 欄位，`researchLab` 保持 schema 5；沒有修改 item id、99 上限、交易、抽取器消耗、因子培育、localStorage key、Socket.IO event 或 server 欄位。正式 query 更新為 `20260729-lineage-backpack-v1`。

#### 完整血統因子背包框收件區 V94

- 日期：2026-07-29。
- 檔案：`public/images/board/backpack_ui/incoming/README.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 建立 `backpack_ui/incoming/` 專用收件區，等待使用者放入 `lineage_factor_backpack_portrait_frame.png`。規格固定為 1024×1024、外圍透明、中央角色頭像圓孔透明且不預先合成人物或文字。
- 本輪只建立素材收件位置與文件索引；尚未修改正式頁、遊戲規則、背包 DOM、存檔或同步。素材驗收後才會轉成正式 WebP、移到上一層並接入角色頭像後層、純黑圓外背景與固定 1:1 道具尺寸。

#### 完整血統因子背包頭像封存框 V95

- 日期：2026-07-29。
- 檔案：`public/images/board/backpack_ui/incoming/lineage_factor_backpack_portrait_frame.webp`、`public/images/board/backpack_ui/lineage_factor_backpack_portrait_frame.webp`、`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 素材驗收：收件圖為 1254×1254、四通道 RGBA WebP；外角與中央點 Alpha 都是 0，金屬框點 Alpha 為 255，約 55.82% 像素完全透明。檔案保留在 `incoming/`，並以相同 SHA-256 內容複製到上一層正式路徑；正式頁只引用上一層。
- 圖示組成：完整因子 backpack view 新增固定前景框與角色圖欄位，但不寫入存檔。渲染時以純黑 1:1 容器為底，中央 54.8%×56% 圓孔裁切角色圖，角色以 `object-fit:cover`、16% 垂直焦點及 1.55 倍縮放顯示頭部與少量肩膀；1254×1254 機械圖框位於最上層。清單小圖和左側預覽共用同一 markup，不再直接顯示整張角色圖。
- 尺寸驗證：Chrome 1440×900 中抽取器與完整因子清單圖示均為 71.11×71.11；完整因子左側預覽及框圖均為 197.59×197.59。844×390 手機中兩種清單圖示均為 30.81×30.81，左側預覽以專屬 square 規則固定為 84.02×84.02；頁面 scrollWidth／Height 等於 viewport，角色、框、姓名及說明全部可見。
- 黑底與圖層驗證：截取左側完整因子元素後，左上角與圓外取樣皆為 RGBA `0,0,0,255`，中心角色取樣不是黑色，框頂取樣為不透明金屬色；角色圖 natural size 1086×1448、框圖 natural size 1254×1254，兩張都完成載入。
- 相容性：本輪只新增正式靜態素材與背包 view 欄位，沒有新增或改名 `gameState`、`researchLab`、factor 或 inventory 欄位；schema 保持 5，抽取器庫存、因子培育、交易、手動存檔、`BOARD_GAME_STATE`、localStorage key、Socket.IO event 及 server 均未修改。正式 query 更新為 `20260729-lineage-factor-frame-v1`。

#### 全破後世界第 7 階段：既有敵人玩家培育模板 V96

- 日期：2026-07-29。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 正式名單：從一般敵人池、推進城、海軍本部、四皇、伊姆、艾爾巴夫神之騎士團及司法島資料彙整出 51 種可抽取正式敵人。青雉、巴其、克洛克達爾、Mr.1、Mr.2、Mr.3 共 6 種沿用既有玩家角色模板；其餘 45 種建立獨立 `lineage_*` 培育模板，不加入開局選角、酒館或競技場抽選池。
- 玩家化規則：45 種新模板依敵人定位分配戰鬥型、偵查型、移動型或輔助型，套用玩家成長曲線、玩家尺度能力與招式威力；沿用正式敵人招式名稱、屬性、命中與狀態效果，但移除 `yonkoMove`、`finalGateMove`、`bossPhase`、`phaseState` 等敵方階段機制，不能把 Boss 推薦戰力、二階段或特殊戰場狀態帶入玩家隊伍。沒有正式進化資料的模板只保留基礎型態。
- 圖片與被動：51 種模板全部沿用各自正式敵人戰鬥立繪，沒有生成風格不同的新圖；四種職能各自取得可實際運作的玩家被動。角色圖來源會優先使用卡片明確保存的 `battlePortraits`，因此 `lineage_*` id 不會誤找不存在的同名圖片資料夾。
- 舊因子相容：培育解析同時支援 factor 的 `sourceCardId`、敵人 key、敵人姓名、既有玩家角色 id 與 `rob_lucci`／`lucci` 別名。舊存檔只有 key 或只有姓名的 51 種完整因子皆可找到正式模板；仍無正式模板的未知因子會保留而不消耗。
- 養成與流程：培育角色可正常加入收藏、登船、升級、修行、裝備攜帶物、換招、進戰鬥及手動存讀檔。同步修正攜帶物裝備函式中未宣告 `def` 的既有錯誤；同名角色仍可重複收藏但不能同時登船，CPU 會消耗一份相容因子並依隊伍限制安排登船。
- 全名單規則驗證：51／51 模板均可由 Lv.1 培育成功，因子各只扣一份、收藏各新增一名，皆有六項能力與至少三個可用招式；序列化結果未出現敵方專用的 `yonkoMove`、`finalGateMove`、`bossPhase`、`phaseState`、`recommendedPower` 或 `enemyCombatant`。51 種 key-only 與 51 種 name-only 舊因子全部解析成功，未知因子維持不可培育。
- 養成與戰鬥驗證：凱多培育後可登船、使用攻擊飲料、裝備光粉、累積 500000 EXP 升至 Lv.73，經 JSON 存讀檔後仍保留 4 招、修行攻擊 3、攜帶物、血統傾向及正式立繪；正式戰鬥可用凱多四招開戰並切換至赤犬，回合持續正常。CPU 培育及同名凱多不能同時登船的收藏限制亦通過。
- 圖文驗證：Chrome 1440×900 與 844×390 的研究所培育、投入、結果及角色顯影皆使用正式圖片式框面；逐一切換 51 種姓名未發現文字溢出或圖片破損。51／51 普通立繪 URL 回傳 HTTP 200；桌機與手機頁面沒有新增 overflow，僅培育能量光暈依設計超出自身無文字節點。完整 4.3 秒培育演出以麒麟格姆實跑，角色圖、名稱、等級與泡泡破裂結果均位於正式框內。
- 存檔與多人驗證：手動 payload 可完整序列化及正規化。獨立 `PORT=8806 npm start` 服務以兩個 Socket.IO 瀏覽器 client 推送帶有 Lv.73 凱多、永久 `instanceId`、四招、修行、攜帶物、傾向與敵人立繪的 `research-lab-cultivation` 快照；server ack `{ok:true, version:1}`，接收端角色物件逐字一致，測試後已停止 8806 Node 程序。
- 程式與服務：`node --check public/js/board_game.js` 通過；既有 8787 與獨立 8806 的 `board_game.html` 回傳 HTTP 200，獨立服務載入 `20260729-lineage-enemy-templates-v1`。本輪沒有新增或改名 `gameState`／`researchLab` 欄位、localStorage key、Socket.IO event、server 欄位或敵人／道具字串 id。
- 階段邊界：第 7 階段完成現有正式敵人的玩家培育模板，但不提前製作十三島新 Boss、線索、圖鑑或 S→SS→SSS 原作血統突破。下一階段是第 8 階段，處理培育個體突破與重複完整因子的用途。

#### 競技場兩人出戰名單鎖定修正 V97

- 日期：2026-07-29。
- 檔案：`public/board_game.html`、`public/board_battle.html`、`public/js/board_game.js`、`public/js/board_battle.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 根因：競技場建立 battle 時已把選定兩人的原始船員索引保存到 `battle.arenaCrewIndices`，瀕死判斷使用的 `livingCrewIndices()` 也會篩選這份名單；但 `getBattleView()` 仍把完整六人 `player.crew` 傳給正式戰鬥頁，而主動換人與替補提交只檢查角色存在、存活及非目前上場，造成未入選四人仍顯示並可被指令換上場。
- 名單邊界：新增共用競技場出戰索引判斷與 battle crew entries。競技場 battle view 的船員、替補候選、內嵌換人頁、戰鬥道具目標與全隊治療都只使用入場前選定兩人；職能被動與存活名單沿用同一 helper。一般戰鬥沒有 `arenaCrewIndices` 限制，仍使用完整船員陣容。
- 原始索引：`serializeBattleCrewCard()` 新增只供 view 使用的原始 `index`；正式 `board_battle.js` 的換人與指定道具目標按鈕會優先把這個索引送回主遊戲。即使選中的是六人陣列中的第 2 與第 5 名，畫面只排兩張卡，送出的仍是 1 與 4，不會因畫面重新排列而誤換到第 1、2 名。
- 規則層防護：`queuePlayerBattleSwitch()`、`chooseBattleReplacement()`、指定戰鬥道具目標及實際套用換人動作都會再次檢查選定名單；未入選索引回傳 false、不建立 action，也不改變上場船員。舊 pending 競技場戰鬥只要已有 `arenaCrewIndices` 就套用相同限制，沒有新增或改名任何存檔欄位。
- 規則實測：以六名船員建立競技場並指定原始索引 `[1,4]`。battle view 只傳 `[1,4]`、替補候選只傳 `[4]`；嘗試主動換入未選的索引 2 回傳 false、active index 與 action 均不變，換入索引 4 成功。模擬索引 1 瀕死後，未選索引 2 的替補回傳 false，索引 4 替補成功。暫時切回一般戰鬥 view 時仍傳完整 `[0,1,2,3,4,5]`。
- 畫面實測：Chrome 1440×900 正式 iframe 的「夥伴」頁只出現原始索引 1、4 兩張圖片式船員卡，索引 1 標示上場中、索引 4 可切換，文件寬高等於 viewport；844×390 手機橫向實拍同樣只顯示兩人且兩張角色圖、名稱、HP／PP 與按鈕均位於既有圖片框內。從正式 iframe 點擊索引 4 後，主遊戲 active index 實際變為 4；瀏覽器腳本例外為 0。
- 程式、快取與同步邊界：`node --check public/js/board_game.js`、`public/js/board_battle.js` 通過。正式主頁、戰鬥 iframe HTML 與兩支腳本 query 統一為 `20260729-arena-roster-lock-v1`；既有 `battle.arenaCrewIndices` 隨完整 `BOARD_GAME_STATE` 快照同步，沒有修改 localStorage key、Socket.IO event、server、競技場獎勵、入場／離場回復或兩人選擇規則。

#### 全破後世界第 8 階段：S／SS／SSS 血統突破 V98

- 日期：2026-07-29。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`public/js/board_items.js`、`public/images/board/research_lab_ui/breakthrough/perfect_lineage_core.webp`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 正式規則：重複完整因子現在可培育另一個體、作同角色突破材料，或經二次確認解析為 ED／CB／A／S／SS／SSS 對應 10／20／30／40／70／120 點。S→SS 驗證 Lv.99、最高進化型態、被動記憶 Lv.3、修行總和 90，消耗同角色因子 1、20,000 B、200 點；SS→SSS 另要求六項修行各 30、已討伐洛克斯，消耗同角色因子 2、完美血統核心 1、50,000 B、500 點。兩段各以前一階基礎乘以 1.08，SSS 封頂。
- 保留邊界：突破仍使用同一 `instanceId`，不重建、降級或轉生；等級、總 EXP、修行、招式、被動記憶、進化型態、血統傾向、外觀框、攜帶物、培育來源及取得時間逐欄比對皆一致。研究所顯示真實 S／SS／SSS，一般 UI 仍沿用原角色 tier。CPU 到研究所先尋找可完成突破的角色，沒有才進行原自動培育。
- 圖片式介面：研究所角色詳情使用既有正式角色卡、主／次按鈕圖片框，新增逐項需求、缺少／完成狀態及不可逆消耗確認；培育因子頁使用同一圖片按鈕提供解析與二次確認。桌機 1440×900 與手機橫向 844×390 實拍中，研究所主框完整落在 viewport；角色圖、核心圖、條件、解析及確認文字均在原生框內，沒有新增頁面 overflow。因子頭像 `<img>` 改為 block，清除 5px baseline 假 overflow。
- 新素材：使用內建 ImageGen 的 `stylized-concept` 模式生成單一「完美血統核心」，原始 PNG 位於 `C:\Users\王曜瑋\.codex\generated_images\019fa333-31ef-7e32-b226-023fffa4c411\call_V3rhqMursJKTs7GH1hWRCz6P.png`；驗收後以 Sharp 機械轉為 1024×1024、RGB、207,648 bytes 的正式 WebP。提示詞指定暗黑海洋海賊 RPG 重要道具、單一透明切面晶核、內部青紅雙螺旋能量、古銅鋼製拘束環、正中央約占 78%、均勻深黑海軍藍背景、無字無人物無卡框。正式圖同時用於 SSS 需求與重要道具背包；清單／預覽沿用既有 71／198 px 規格。
- 規則實測：S→SS 七項需求全部成立後只扣 1 因子、20,000 B、200 點；SS→SSS 九項需求全部成立後只扣 2 因子、1 核心、50,000 B、500 點。無進化資料的亞爾麗塔以基礎型態通過；有正式進化資料的庫山保持基礎型態時正確顯示「基礎型態／10號船長庫山」並拒絕。SSS 重複提交回傳最高階段錯誤。六項純基礎能力測得每段皆在四捨五入誤差內約 +8%；CPU 自動完成 S→SS 後素材與點數同步扣除。
- 因子與背包實測：六種解析依序得到 `[10,20,30,40,70,120]`，合計 290，因子剩 0；再次提交同 id 被拒絕。完美血統核心以 `重要道具・SSS` 顯示，1024×1024 natural size、預覽 198×198、清單 71×71，無破圖；因子背包說明同步標示培育／突破／解析三種用途。
- 存檔與多人：手動 payload JSON 與 `normalizeLoadedGameState()` 往返後保留 SS、完整因子及核心庫存。8787 服務建立 `S8V98` 雙人房，主端以 `research-lab-breakthrough` 推送完整 `BOARD_GAME_STATE`，server ack `{ok:true, version:1}`；接收端收到相同 SS 階段、核心數與因子數。未新增或改名 `gameState`／`researchLab` 欄位、localStorage key、Socket.IO event 或 server 欄位。
- 程式與服務：`node --check public/js/board_game.js`、`node --check public/js/board_items.js`、`git diff --check` 通過；`npm start` 啟動 8787，`board_game.html` 與核心 WebP 均回傳 HTTP 200，頁面載入例外 0。既有 `node scripts/board_game_smoke.js` 在 124 秒工具上限內沒有輸出並被 timeout 終止，故不列為通過；本輪改以 Chrome 規則、畫面、存檔及雙端 Socket.IO 實測覆蓋。正式 query 為 `20260729-lineage-breakthrough-v1`。
- 階段邊界：完美血統核心的道具資料與消耗已完成，但正式取得仍依企劃留到第 10 階段洛克斯勝利；本輪不提前新增洛克斯、十三島 Boss 或線索牌。下一階段為第 9 階段。

#### 血統培育角色正式資料與我方養成對齊修正 V99

- 日期：2026-07-29。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 類別與被動根因：V96 的 45 種 `lineage_*` 模板以手寫表逐名分配戰鬥型／偵查型／移動型／輔助型，並依職能登錄通用角色被動；這些不是正式敵人 profile 資料，會讓培育角色無依據地改變船員職能組成。現已刪除整張手寫表及通用被動產生器。獨立模板只顯示正式敵人的 `role` 身分／能力者類別，司法島少數內部英文代碼只做固定中文化，`passive` 顯示「無」且不註冊戰鬥被動。
- 船員被動邊界：`getTeamEffects()` 仍只遍歷實際 `player.crew`，競技場再由 `arenaCrewIndices` 限定入選兩人；`researchLab.collection`、完整因子、敵人 profile 及未登船角色不會參與。45 種獨立模板不偽造四職能，所以不會平白增加四職能人數；6 種沿用既有玩家模板者保留原正式職能與角色被動。
- 玩家養成：45 種獨立模板繼續共用正式玩家等級、EXP、修行、血統傾向、被動記憶、攜帶物、換人、收藏、存讀檔、S／SS／SSS 與戰鬥流程。因獨立模板不再具四職能，被動記憶改依原 profile 的正式力／技／速屬性套用既有對應能力加值，記憶 Lv.1～3 不會變成空效果。沒有正式玩家進化資料者仍以基礎型態為最高型態，不把 Boss 第二階段假作進化。
- 升級學招：V96 將前四招全設為 Lv.1，導致多數角色升級沒有新招可學。現在只取現有正式敵人招式並固定依 `[1,1,15,30,45,60,75,85,95]` 解鎖；未滿四招由 `gainCardExp()` 自動學會，第五招起沿用 `pendingMoveLearnQueue` 的圖片式四招替換。沒有新增招式名稱或效果。舊高等級血統角色的 late-move backfill 版本升為 2，從 Lv.15 起補檢，不需重培育或重置。
- 全名單規則實測：51 種來源仍為 45 種獨立模板＋6 種既有玩家模板。45／45 的顯示類別都等於正式 role 中文顯示，沒有自創角色被動或被動效果；每名 Lv.1 都有兩招，45／45 至少有一招升級後可學。赤犬由 Lv.1 累積 500000 EXP 到 Lv.73，自動學會「岩漿壓制」「流星火山」並保留四招；伊姆同樣學會第三、四招，第五招「Domi Reversi・黑轉支配」在 Lv.45 正確進入替換佇列。模板序列化未出現 `yonkoMove`、`finalGateMove`、`bossPhase`、`phaseState`、`recommendedPower` 或 `enemyCombatant`。
- 記憶與職能實測：赤犬被動記憶 Lv.3 依力屬性得到 HP+9、攻擊+6。只把正式玩家模板放在研究收藏時，四職能計數全為 0；把獨立赤犬放上船仍不偽造四職能；把既有玩家模板庫山放上船則正常得到戰鬥型 1。這證明收藏與敵人資料不參與，而正式我方船員資料仍照原規則運作。
- 圖文實測：Chrome 1440×900 與 844×390 橫向實際培育赤犬並開啟研究收藏詳情；正式敵人圖、名稱、`岩漿果實能力者`、六項能力、S→SS 條件及按鈕均落在圖片原生框內，圖片載入失敗 0，頁面 overflow 0。桌機主框 1408×792，手機主框約 672×378；手機未量到文字溢出，桌機標題只有既有 5 px 行高差、無可視裁切。
- 相容性與快取：沒有新增或改名 `gameState`、`researchLab`、角色實例、localStorage key、Socket.IO event 或 server 欄位；舊 `lineage_*` card id、factor id、招式 id、`instanceId` 與完整快照格式保持不變。`node --check public/js/board_game.js`、頁面載入及 HTTP 200 通過；正式 query 更新為 `20260729-lineage-player-parity-v1`。

#### 血統培育角色四職能澄清修正 V100

- 日期：2026-07-29。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 使用者澄清：上一輪把「敵人不要自創類型」錯解為培育角色也不應取得船員職能；正確意思是不要創造四職能以外的新船員類別。敵人 profile 維持原資料，但完整因子培育出的永久玩家卡必須與其他我方角色相同，固定屬於戰鬥型、偵查型、移動型或輔助型。
- 45 名分配：獨立 `lineage_*` 模板固定為戰鬥型 16、偵查型 12、移動型 10、輔助型 7；連同 6 名既有玩家模板後，51 名合計戰鬥型 19、偵查型 13、移動型 11、輔助型 8。類型同步時會覆蓋舊存檔中 V99 暫存的身分文字，不改 card id、instanceId、招式或其他養成資料。
- 玩家功能：獨立模板重新使用 `recruitStatsForTierRole()` 的職能 Lv.1 能力與個人移動值；被動記憶自然沿用四職能加值。角色專屬 `passive` 仍為「無」，沒有恢復 V96 的自創名稱或通用角色被動；升級學招、四招替換、修行、攜帶物、收藏、戰鬥與 S／SS／SSS 規則保持 V99 修正。
- 被動邊界實測：研究收藏同時放入四職能角色時，戰鬥／偵查／移動／輔助計數皆為 0；四名分別登船後計數為 1／1／1／1；競技場只選偵查與輔助兩人時只計 0／1／0／1。另以完整因子培育赤犬做上下船循環：收藏時戰鬥型為 0，安排登船立即變 1，送回收藏立即回到 0。這證明職能被動會依目前實際上船名單即時重算，競技場再看入選兩人，不讀收藏或敵人 profile。
- 養成回歸：舊 `lineage_akainu` 卡若保存 `岩漿果實能力者`，同步後會變成戰鬥型；四職能的被動記憶 Lv.3 分別得到既有戰鬥 HP+9／攻擊+6、偵查戰術+6／速度+3、移動速度+6／攻擊+3、輔助意志+6／防禦+3。赤犬累積 500000 EXP 仍升到 Lv.73 並學會「岩漿壓制」「流星火山」。
- 程式與快取：51／51 角色稽核全部落在四職能內，沒有第五種或身分文字殘留；`node --check public/js/board_game.js` 與正式頁載入通過。沒有新增或改名存檔／同步欄位，正式 query 更新為 `20260729-lineage-four-roles-v2`。

#### 血統培育角色依實際表現重分職能 V101

- 日期：2026-07-29。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 根因與標準：V100 為了讓四職能都有一定人數，把技屬性、能力複雜或戰術型角色過度歸入偵查，造成黑鬍子等正面戰鬥角色的職能不符合表現。現改為不按屬性或人數平均：直接輸出／正面決戰歸戰鬥；只有明確感知／情報表現歸偵查；高速位移／運輸歸移動；控制／弱化／防禦／指揮／召喚歸輔助。
- 重分結果：45 種獨立模板為戰鬥型 25、偵查型 1、移動型 8、輔助型 11；連同 6 種沿用既有玩家模板後，51 名合計戰鬥型 28、偵查型 2、移動型 9、輔助型 12。黑鬍子、大媽、紅髮香克斯、多佛朗明哥、伊姆、麥哲倫等正面主戰者改為戰鬥型；艾尼路因心綱與全國級感知保留偵查型；布魯諾因空氣門改為移動型；凱薩、弗克西、莫利亞、麒麟格姆、索瑪茲、卡莉法等控制／弱化／防禦角色歸輔助型。
- 存檔與被動：沒有新增或改名 `gameState`、`researchLab`、角色實例、localStorage key、Socket.IO event 或 server 欄位。舊 `lineage_*` 卡會由既有 `syncCrewCardProgress()` 依 card id 套回新版職能；實測舊偵查型黑鬍子同步後變為戰鬥型。完整因子培育黑鬍子在收藏時戰鬥型計數為 0，安排登船立即變 1，送回收藏立即回到 0；競技場只選艾尼路與凱薩時只計偵查 1、輔助 1。
- 驗證：51／51 模板皆落在四職能且人數為 28／2／9／12，黑鬍子模板為戰鬥型、Lv.1 仍保留「暗水」「闇穴」，其餘招式 Lv.15／30 解鎖規則未變。Chrome 1440×900 與 390×844 開啟黑鬍子研究所詳情，角色圖、名稱、`戰鬥型`、能力值、突破條件與按鈕均在框內，可見破圖 0、頁面寬度溢出 0、頁面例外 0；動態研究所資源重測 HTTP 4xx 0。`node --check public/js/board_game.js`、`git diff --check` 通過；`npm start` 使用獨立 8813 測試埠啟動，正式頁 HTTP 200 且載入 query `20260729-lineage-performance-roles-v3`。

#### 競技場完成體、SSS 抽取與培育重置 V102

- 日期：2026-07-29。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 對手完成度：競技場不再只有 Lv.99 與最高型態。51 名對手快照建立前會把六項修行全部設為 30／30、戰鬥記憶設為 Lv.3、血統階段設為 SSS，再依既有能力公式套用最高正式進化／覺醒型態；獨立敵方快照不修改玩家自己的同名永久角色。選擇清單與規則框明示 Lv.99、滿修行、記憶 Lv.3、SSS 完成體。
- 戰後抽取：競技場敵方快照明確保存原始 `sourceCardId` 與 `extractionRank: "SSS"`。勝利後沿用正式抽取器選擇、三階段操作、消耗與成功／失敗流程；成功因子的 enemy key 保留 `arena_*`，`sourceCardId` 指回原玩家模板，使研究所能解析到正確基礎角色。能力者判定改走既有 `isDevilFruitCharacter()`，不再因角色卡沒有顯式布林值而把魯夫等能力者判成非能力者。
- 培育邊界：競技場完成體的 Lv.99、滿修行、記憶 Lv.3、SSS 與最高型態只供敵方戰鬥。所有完整因子培育都明確寫入 Lv.1、總 EXP 0、六項修行 0、戰鬥記憶 0、S 階、基礎型態、未解鎖進化，避免來源模板或未來資料帶入完成度；血統傾向仍照正式培育規則生成。
- 規則實測：51／51 競技場 profile 均為 Lv.99、六項 30、記憶 3、SSS、SSS 抽取階級，無缺漏；其中 25 名正確採用非 base 的最高正式型態。五檔魯夫樣本能力為 HP 625、攻擊 428、防禦 327、戰術 328、意志 321、速度 260，招式為黎明手槍／白色彈跳／巨人化／黎明火箭。
- 抽取與培育實測：擊敗五檔魯夫後取得 SSS 抽取 view，enemy key 為 `arena_luffy`、`sourceCardId` 為 `luffy`、能力者判定為 true；皇級抽取器加三段 Perfect 的正式成功率為 75%，成功因子可解析回 `luffy`。結算給既有 25 研究點後，以該因子培育出蒙其·D·魯夫：Lv.1、總 EXP 0、base、進化階段 0、已解鎖型態空陣列、六項修行全 0、記憶 0、S 階。
- 圖文與服務：Chrome 1440×900 與 390×844 開啟 1672×941 競技場選擇框，完成體說明、選中對手、51 名清單與兩名船員都在圖片框內；桌機與手機 body 寬度無溢出、可見破圖 0。`node --check public/js/board_game.js` 與 `git diff --check` 通過；`npm start` 使用獨立 8814 測試埠啟動，正式頁 HTTP 200 並載入 query `20260729-arena-sss-extraction-v5`，驗證後已關閉測試服務。

#### 全破後世界第 9 階段：十三島 Boss、約克線索與新版洛基／Tot Musica V103

- 日期：2026-07-29。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`public/js/board_items.js`、`public/images/board/battle/enemies/postgame_*/`、`public/images/board/postgame_clue_ui/`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 正式 Boss：十三座既有孤島依原 `postgameWorld.bossOrder`／`islandAssignments` 穩定洗牌，正式接入史基、泰佐洛、捷風、Tot Musica、巴雷特、薩卡、伽治、覺醒路基、KING、卡塔庫栗、雷德菲爾德、洛基與荒牧。十三名均為 Lv.99、SSS 抽取資料，各有四招、開場能力、作品定位及六狀態戰鬥圖；沒有加入雜兵、自創角色或第五種玩家職能。
- 登島與共鬥：真人登島使用既有航海圖片式遭遇框顯示 Boss、等級、SSS、屬性、定位、HP、被動、線索及重戰規則，可挑戰或留島；CPU 直接挑戰。同島共鬥、交棒、私人抽取與實際參戰者判定沿用正式 battle snapshot，沒有新增 Socket.IO event。
- 線索循環：`board_items.js` 新增穩定 id 的 `york_clue_01_shiki` 至 `york_clue_13_aramaki`，名稱固定「約克的線索 1～13」。每次勝利的所有實際參戰者各加一張、可重複堆疊、可交易、最低交易價 1,300 B、不可在背包使用。Boss 島回復原 profile 與完整 HP、不轉臨時服務；結算後沒有立即重戰入口，須先離島再重新登島。
- 圖片式道具：ImageGen 產生共用金屬線索牌框，正式背包清單、左側預覽與重要道具取得演出動態疊入 Boss 專屬島圖及 A、2～10、J、Q、K。背包同時顯示目前持有種類與總張數；桌機與手機均改為可讀的圖片式縱向排版，沒有另外用一般網頁方格代替正式圖。
- 血統培育：十三名 Boss profile 全部加入正式抽取來源與玩家培育模板。職能依表現固定為戰鬥型 7、偵查型 2、移動型 1、輔助型 3；登船後才由 `player.crew` 重算船上被動。培育結果固定 Lv.1、總 EXP 0、六項修行 0、記憶 0、S 階、基礎未進化型態；覺醒路基以既有別名回到基礎路基模板。四招依 Lv.1、1、15、30 解鎖。
- 新版角色圖：洛基沿用既有粉紅辮髮、蒙眼、角盔、紫毛披風、鎖鏈與巨大鐵雷設計，重畫成雷霆／冰霜艾爾巴夫 Boss；Tot Musica 依使用者提供的三張參考重畫為三首、鋼琴鍵翼臂、金色鬃毛、綠色熔解軀體與骷髏音符的第三樂章巨獸。兩張皆為 1024×1536，原始 PNG 分別保存在 `postgame_loki/incoming/imagegen_source_v2.png` 與 `postgame_tot_musica/incoming/imagegen_source_v2.png`，並轉為六張正式 WebP；其他十一名同系列 ImageGen 原始圖也保留在各自 `incoming/`。
- 規則驗證：13／13 島 state 都有 Lv.99、SSS 抽取、四招與正式模板；無抽取器時 SSS 抽取 entry 正確為 unavailable，有皇級抽取器時為 offered，基礎率 5%、皇級加成 50%。以完整因子實際培育洛基與覺醒路基，結果分別為洛基與基礎羅布・路基，兩者都是 Lv.1、EXP 0、base、進化階段 0、無已解鎖型態、六項修行 0、記憶 0、S 階，且只解鎖兩個 Lv.1 招式。
- 獎勵與相容性驗證：模擬 Tot Musica 勝利後，`york_clue_04_tot_musica` 由 0 變 1；島嶼恢復完整 HP、`isDefeated=false`、不產生臨時服務。手動存檔 payload 仍可完整序列化且保存同一張線索；沒有新增或改名 `gameState`、`researchLab`、localStorage key、Socket.IO event 或 server 欄位。
- 圖文驗證：13 個 Boss 目錄共 78 張必要狀態 WebP，缺檔 0。Tot Musica 桌機 1440×900 遭遇框載入 1024×1536 新圖，洛基手機 390×844 遭遇框同樣載入 1024×1536 新圖；兩畫面量測文字與圖片 overflow 皆 0。背包桌機／手機、線索取得演出亦完成實拍，Boss 島圖、牌框、A～K 與文字均在正式框內。
- 程式與服務：`node --check public/js/board_items.js`、`public/js/board_game.js` 通過；另以獨立 `PORT=8815 npm start` 啟動正式 server，`board_game.html`、兩支新版 query 腳本、洛基與 Tot Musica WebP 均回傳 HTTP 200，驗證後已停止 8815 listener。測試環境未設定 `DATABASE_URL`，因此只出現既有的 DB 功能停用警告，靜態 Board 頁與本輪流程可正常執行。正式 query 更新為 `20260729-postgame-boss-clue-v1`，下一階段固定停在第 10 階段，未提前建立蛋頭島、約克終局或洛克斯。

#### 競技場勝利血統因子抽取續行修正 V104

- 日期：2026-07-29。
- 檔案：`public/board_game.html`、`public/board_battle.html`、`public/js/board_game.js`、`public/js/board_lineage_extraction.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 根因：競技場勝利原本會建立 SSS 抽取 entry，但沒有剩餘抽取器時 entry 立即變成 terminal `unavailable`；前端控制器對所有 terminal 狀態直接關閉抽取層，因此玩家看起來像完全沒有取得抽取流程。抽取建立又只依全域 `postgameWorld.researchLabsActive`，舊 pending battle 或多人快照旗標時序異常時，也可能讓已明確標成競技場的勝利沒有抽取 view。
- 修正：競技場 battle 自身的 `isArenaBattle`／`islandKind === "arena"` 即可通過抽取來源判定；一般戰鬥仍須研究所正式解鎖。`unavailable` 改為使用原戰鬥背景、角色卡及下方圖片式雙面板，顯示「沒有可用的血統因子抽取器」、原因、下次取得方式與「繼續競技場結算」，玩家確認後才切回原勝利結果。沒有新增素材或網頁方格。
- 正式流程實測：用實際 `battleChooseMove()` 一擊將 Lv.99 SSS 新世界娜美從 1 HP 打到 0，battle view 變為 `win`、抽取 entry 為 `offered`、`canFinish=false`，正式 iframe 顯示「是否進行血統因子提取？」。放棄後抽取器庫存保持 1 且開放原結算；返回地圖後 battle 清除、pending 清除、既有競技場研究點數由 0 增為 10。
- 四分支實測：皇級抽取器加三次 Perfect 得到 75% 成功率，判定 10 成功並建立 `lineage-factor-1350359-0001`；標準型加三次 Miss 得到 5%，判定 38 失敗且不建立因子；兩種情況抽取器都只扣 1 並顯示「繼續戰鬥結算」。無抽取器時即使模擬舊快照把研究所旗標設為 false，entry 仍為 `unavailable`，正式畫面會等待玩家按「繼續競技場結算」，不再靜默略過。
- 圖文驗證：Chrome 1440×900 正式 iframe 中無抽取器標題、兩行原因與按鈕都位於右下原生圖片框，action copy 的 `scrollHeight === clientHeight`（157）且 `scrollWidth === clientWidth`（628）。390×844 手機 viewport 的 1024×576 戰鬥舞台依既有規則完整等比縮放，document 寬度等於 viewport，沒有水平 overflow。
- 相容性與快取：沒有新增或改名 `gameState`、`battleState`、`researchLab`、inventory 欄位、localStorage key、Socket.IO event 或 server 欄位；抽取器消耗、成功率、完整因子、競技場獎勵及兩人出戰規則不變。正式主頁、battle iframe 與抽取控制器 query 統一為 `20260729-arena-lineage-extraction-v1`。
- 程式與服務：`node --check public/js/board_game.js`、`public/js/board_lineage_extraction.js`、`public/js/board_battle.js` 及目標檔案 `git diff --check` 通過。另以 `PORT=8816 npm start` 啟動正式 server，`board_game.html` 回傳 HTTP 200、內容含新版 query，驗證後已停止 8816 listener；既有 8787 測試服務未中斷。

#### 無抽取器共用戰鬥文字修正 V105

- 日期：2026-07-29。
- 檔案：`public/board_game.html`、`public/board_battle.html`、`public/js/board_game.js`、`public/js/board_lineage_extraction.js`、`docs/DEV_WORKFLOW.md`。
- 修正：無抽取器結果頁不再把所有戰鬥寫成競技場；提示統一改為「戰鬥勝利後」、「下次戰鬥勝利時」與「繼續戰鬥結算」，適用一般敵島、海格遭遇、四皇、司法島、推進城、頂上戰爭、艾爾帕布、伊姆、十三島 Boss 與競技場。
- 相容性：只調整顯示文字與前端快取版本，沒有更動抽取資格、成功率、道具消耗、完整因子、原戰鬥獎勵、`gameState`、`battleState`、localStorage key、Socket.IO event 或 server 欄位。
- 驗證：正式頁建立一般敵島「皮卡勝利、研究所已解鎖、重要道具背包無抽取器」情境，entry 為 `unavailable`；桌機 1440×900 與手機 390×844 均顯示三處新版通用文字，舊競技場限定文字為 0。「繼續戰鬥結算」按鈕可關閉抽取層並回到仍為 `win` 的原結算；桌機文字框 `scrollWidth === clientWidth`、`scrollHeight === clientHeight`，手機 document 寬度等於 viewport，無水平溢出。正式頁與 battle iframe 使用 `20260729-lineage-unavailable-copy-v2`，動態資源 HTTP 4xx 為 0、頁面例外為 0；三支相關 JS 的 `node --check` 與目標檔案 `git diff --check` 通過。

#### 研究所培育四職能顯示校正 V106

- 日期：2026-07-29。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/DEV_WORKFLOW.md`。
- 根因：研究所培育結果與收藏卡把 `lineageTendency.name` 當成主狀態，因此顯示均衡型、堅韌型、強攻型等六項能力傾向，看起來像另外一套角色類型，蓋過角色真正的四職能。
- 修正：研究所 view 依既有 `card.roleType` 產生純顯示欄位 `roleName`，內部戰鬥型／偵查型／移動型／輔助型分別顯示為攻擊型／偵查型／速度型／輔助型。培育完成、登船與收藏卡、角色詳情及同名比較全部改用四職能；原血統百分比只以「個體能力修正」顯示。
- 相容性：沒有改名或遷移 `roleType`、`lineageTendency`、`gameState`、`researchLab`、localStorage key、Socket.IO event 或 server 欄位；四職能隊伍效果、角色分類、傾向能力計算、存檔與多人同步內容不變。
- 驗證：正式頁把赤犬／囚服巴奇／亞爾麗塔／凱薩分別設為戰鬥／偵查／移動／輔助，並刻意寫入堅韌型／強攻型／均衡型／戰術型傾向；研究收藏卡只顯示攻擊型／偵查型／速度型／輔助型，四種培育完成頁及赤犬角色詳情同樣只以四職能作主類型，舊傾向名稱可見數為 0。個體能力修正仍正確顯示 HP／攻擊等百分比；64／64 正式敵人培育模板與 51／51 競技場來源角色的內部職能都只落在既有四類。Chrome 1440×900 詳情框 `scrollWidth === clientWidth`、`scrollHeight === clientHeight`；390×844 document 寬度等於 viewport，破圖 0、動態 HTTP 4xx 0、頁面例外 0。`node --check public/js/board_game.js` 與目標檔案 `git diff --check` 通過。

#### CPU 司法島自動進關修正 V107

- 日期：2026-07-29。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/DEV_WORKFLOW.md`。
- 根因：`resolveLanding()` 抵達司法島後不分真人／CPU 都呼叫 `openJudicialRaidModal()`；CPU 因此停在只綁定 DOM click 的「發起討伐／加入討伐」頁，必須依賴開發觀察器稍後代按，正式 CPU 回合本身沒有直接進關。
- 修正：司法島 modal 完成失效 raid 清理後先判斷 CPU。有存活船員時，未啟動或已通關直接呼叫既有 `startJudicialRaid()`，進行中呼叫既有 `joinJudicialRaid()`；沒有存活船員則記錄原因並結束回合，避免產生無法操作的 modal。真人仍走原圖片式選擇頁。
- 相容性：沿用既有司法島 `judicialRaid`、participant、共享 HP、battle snapshot、任務事件與多人交棒，沒有新增或改名 `gameState`、localStorage key、Socket.IO event 或 server 欄位。
- 驗證：正式 `resolveLanding()` 實測三種 CPU 落點。全新司法島立即建立斯潘達姆第 1 戰、raid active 且 CPU participant active，沒有司法島 modal；進行中的司法島立即加入並建立目前階段 battle；已有 2 次通關紀錄的司法島保留 `clearCount=2` 與 `lastClearedAtRound=8`，清空舊 phase keys 後從斯潘達姆第 1 戰重開。相同落點改為真人時不建立 battle，仍顯示「發起討伐」按鈕。正式 query `20260729-cpu-judicial-auto-enter-v1`、主頁與腳本 HTTP 200、動態 HTTP 4xx 0、頁面例外 0；`node --check public/js/board_game.js` 與目標檔案 `git diff --check` 通過。

#### 血統因子抽取操作難度 S 封頂與示範同步 V108

- 日期：2026-07-29。
- 檔案：`public/board_game.html`、`public/board_battle.html`、`public/board_lineage_extraction_battle_demo.html`、`public/js/board_game.js`、`public/js/board_lineage_extraction.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 難度邊界：SS／SSS 敵人與完整因子的階級不變，基礎成功率／上限仍為 10／85% 與 5／75%；只把三階段玩家操作封頂為 S。正式版與示範頁的 SS／SSS 現在都使用 12 個目標、900ms 單點、22.5% 目標大小、Perfect 0.06／Good 0.17、2300ms 鎖針及 2400ms 雙環。
- 示範對齊：正式版三段輸入由放開才觸發的 `click` 改為示範頁按下即取樣的 `pointerdown`；第一階段補回 30ms 結束緩衝、190ms 目標間隔與中央開始點後 180ms 預備，第一段到第二段使用 920ms，後續轉場使用 900ms。示範頁選 SS／SSS 時明示「S（操作上限）」，仍用所選階級計算 HP、基礎成功率及上限。
- 相容性：未修改抽取器加成／消耗、三段 7／3／0% 加成、正式隨機判定、完整因子內容、培育／突破、`gameState`、`battleState`、localStorage key、Socket.IO event 或 server 欄位。正式快取 query 更新為 `20260729-lineage-minigame-s-cap-v1`。
- 驗證：`node --check` 通過 `board_lineage_extraction.js`、`board_game.js`、`board_battle.js`；自動抽取兩頁 `DIFFICULTIES` 後確認正式版與示範頁的 S／SS／SSS 共 11 項操作參數全部一致，示範頁成功率仍為 S 18／90、SS 10／85、SSS 5／75。以獨立 `PORT=8817 npm start` 啟動正式服務，正式戰鬥頁與示範頁 HTTP 200、新版控制器及 query 正確載入。Chrome 1440×900 選 SSS 後顯示 12 點及「S（操作上限）」且破圖／例外為 0；844×390 手機橫向標題完整落在圖片框內、文件無水平 overflow、破圖／例外為 0。

#### 約克線索撲克牌框 V2 V109

- 日期：2026-07-29。
- 檔案：`public/board_game.html`、`public/js/board_game.js`、`public/js/board_items.js`、`public/images/board/postgame_clue_ui/york_clue_playing_card_frame_v2.webp`、`public/images/board/postgame_clue_ui/incoming/york_clue_playing_card_frame_v2_imagegen_source.png`、`public/images/board/postgame_clue_ui/incoming/YORK_CLUE_PLAYING_CARD_FRAME_V2_PROMPT.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 素材：使用內建 ImageGen 的 `precise-object-edit` 流程，以舊 `york_clue_card_frame.webp` 作編輯目標與風格參考，將正方形機械面板重構為正方形畫布中的完整直式 2:3 撲克牌。新版保留深海藍、古銅、青色研究電路與航海羅盤，加入米白紙牌邊、圓角、上下鏡像牌面及兩個空白角標；移除舊底部中央大圓章。原始 1254×1254 RGB PNG 完整保留，正式以 Sharp 轉為同尺寸、RGB、200,090 bytes 的 WebP；舊框不覆蓋也不刪除。
- 動態疊圖：中央 Boss 島圖改入新版直式窗安全區；牌值由原底部中央單一圓章改為左上與右下兩份，右下旋轉 180 度，並各自以 CSS 加上青色菱形。RGB 圖左右的純黑安全區再依實際牌身用 `clip-path` 隱藏，因此取得演出只露完整圓角直式牌，不會看成黑色正方形。A、2～10、J、Q、K、十三張 item id、島圖、數量、交易規則及取得來源均未改。
- 快取與相容性：`board_items.js` 的十三種線索正式圖片及 `board_game.js` fallback／取得演出統一改用 V2；主頁兩支 query 更新為 `20260729-york-clue-playing-card-v2`。沒有新增或改名 `gameState`、inventory、道具 id、localStorage key、Socket.IO event 或 server 欄位。
- 驗證：`node --check public/js/board_items.js`、`node --check public/js/board_game.js` 通過。以獨立 `PORT=8818 npm start` 啟動正式服務，`board_game.html` 與新版 WebP 回傳 HTTP 200，新版 `board_game.js` query 正確載入，乾淨頁面 HTTP 4xx／request failure／console error 均為 0；13／13 正式線索 item 的 `image` 都指向 V2。Chrome 1440×900 以正式 debug queue 顯示 K 取得演出，並在實際航海背包顯示 10：預覽 185.74×185.74、清單 71.11×71.11，島圖、四個角標及菱形都在牌框安全區，modal／document 無 overflow、破圖 0。初次 844×390 正式取得演出量到 350px 容器頂端為 −55.86px，故補上線索牌專用橫向雙欄；修正後牌為 225.73×225.73、說明框 496.60×148.03，兩者皆完整位於 viewport 且文字框 overflow 為 0。手機正式背包再量得預覽 84.02×84.02、清單 30.81×30.81，島圖與雙角標全在框內、modal／document 無 overflow、破圖／HTTP 4xx／例外為 0。

#### 全破後世界第 10 階段：蛋頭島、洛克斯與神之谷霸王框 V110

- 日期：2026-07-29。
- 檔案：`public/board_game.html`、`public/board_battle.html`、`public/js/board_game.js`、`public/js/board_battle.js`、`public/js/board_cosmetic_frame_preview.js`、`public/images/board/islands/postgame_egghead_island.webp`、`public/images/board/battle/enemies/postgame_rocks/`、`public/images/board/battle/cosmetic_frames/rocks_conqueror/`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 十三線索追蹤：同一玩家持有十三種約克線索時，重要道具背包新增圖片式「約克追蹤座標」；確認頁明示 13/13、線索不消耗、全房共用及固定五海格。啟動後 `postgameWorld` schema／layout version 2 保存解鎖者、名稱、回合、時間、演出與右側九個候選錨點之一；地圖最小寬度擴為 5692px，新增一座 `postgame-egghead-island` 及唯一 `route-postgame-egghead`。CPU 會在自動回合解碼，不停在真人按鈕頁。
- 洛克斯終戰：`postgame_rocks` 固定 Lv.99、SSS 抽取階級、攻擊型、力屬性、非能力者，具「日蝕／霸王色纏繞／世界之王的野心／神之谷崩裂」四招與開場能力。真人使用圖片式遭遇頁，CPU 直接開戰；同島共鬥、實際參戰者、私人抽取、觀看方限制及原戰鬥 iframe 全部沿用既有流程。每位實際參戰者每次勝利各得完美血統核心 1、研究點數 25 及洛克斯因子抽取；第一次另解鎖並自動裝備 `rocksConqueror`「神之谷霸王框」。島 state 回滿且 `isDefeated=false`，必須先離島再登島。
- 新版洛克斯：依使用者最新四張彩色參考與兩張漫畫參考重新生成六張 2:3 立繪，固定尖長鼻、白青炸髮、黑尖鬍、金耳環、黑毛披風、毛邊金釘腰封、黑褲長靴及金柄綠握日蝕刀。六張原始 PNG 保存在 `postgame_rocks/incoming/`，正式 WebP 均為 1024×1536；提示詞保存在 `ROCKS_BATTLE_PORTRAITS_PROMPT.md`。
- 霸王框素材：ImageGen 產生黑毛皮、金釘腰封、蛋頭島科技角件與黑紅霸王色閃電的正方形框，色鍵處理後以 1254×1254 RGBA `frame.webp` 正式引用，中央角色窗透明。原始 PNG 與 `ROCKS_CONQUEROR_FRAME_PROMPT.md` 保存在 `incoming/`。正式疊入魯夫角色圖實拍時，肖像窗、四角裝飾及透明區均正確，沒有洋紅殘底。
- 桌機與手機：Chrome 1440×900 的追蹤背包、確認頁、蛋頭島地圖節點、洛克斯遭遇框及正式戰鬥 iframe 均無 document／modal 寬度溢出；洛克斯圖以原生 1024×1536 載入。390×844 手機的背包、確認頁與遭遇頁主框寬 358px，overflow 皆為 0；蛋頭島圖為 1024×1024，洛克斯圖為 1024×1536，文字均落在圖片框內。
- 戰鬥與獎勵實測：正式 iframe 載入 `postgame_rocks`、`isRocksBattle=true`、六張狀態圖及霸王框均 HTTP 200。勝利後建立 SSS 抽取 view，基礎率 5%、標準抽取器可選；放棄不消耗抽取器。結算後研究點數 0→25、完美血統核心 0→1、討伐紀錄新增洛克斯、框永久持有並自動裝備，蛋頭島 HP 重置且戰鬥可正常清除回地圖。
- 存讀檔與同步：用正式 `createManualSavePayload()`／`loadManualGame()` 刪除後重載，`eggheadUnlocked`、同一錨點、唯一蛋頭島、唯一五格航路、十三線索、霸王框與核心均完整恢復。另以正式大廳建立 B3484、第二瀏覽器加入、雙方準備並開始；主機啟動追蹤後兩個視窗都得到同一 `anchor=island-35`、13 座 Boss 島、1 座蛋頭島、5 格航路及 5692px 地圖寬，HTTP 4xx 與頁面例外皆為 0。
- 程式與服務：既有 8787 正式服務的 `board_game.html`、`board_battle.html`、新版腳本與所有新 WebP 均可開啟。`node --check public/js/board_game.js`、`public/js/board_battle.js`、`public/js/board_cosmetic_frame_preview.js` 通過；正式 query 更新為 `20260729-postgame-egghead-rocks-v1`。

#### 十三島 Boss 六狀態戰鬥圖分批補完與暫停交接 V113

- 日期：2026-07-30。
- 檔案：`public/images/board/battle/enemies/postgame_shiki/`、`postgame_gild_tesoro/`、`postgame_zephyr/`、`postgame_tot_musica/`、`postgame_douglas_bullet/`、`postgame_saga/`、`postgame_vinsmoke_judge/`、`postgame_rob_lucci_awakened/`、`docs/POSTGAME_BOSS_BATTLE_PORTRAIT_PROGRESS.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 根因：第 9 階段曾建立十三名 Boss 的六個固定檔名，但上述十三名中只有 `normal.webp` 是各自獨立成品，其餘狀態多為同圖複本；「78 張必要檔存在」只能證明不缺檔，不能證明六態真的不同。本輪依使用者要求參考既有完成敵人圖的規格與狀態語意，逐張生成真正的新姿勢與新表情。
- 已完成：史基、泰佐洛、捷風、Tot Musica、巴雷特、薩卡、伽治、覺醒路基共 8 名，各自保留原 `normal.webp`，並補完 `angry`、`hit`、`morale`、`weak`、`dizzy` 五張獨立圖。正式 40 張新 WebP 全為 1024×1536；選用原始 PNG 以 `{state}_imagegen_v2.png` 保存在各自 `incoming/`。加上原本已完成的洛克斯，目前共有 9 名 Boss 的六態雜湊皆不同。
- 人工修正：Tot Musica 首批憤怒／虛弱誤生成四顆頭，已淘汰並以「中央一頭＋左右各一頭、總共三頭；左右各一鍵盤翼臂」硬限制重畫。覺醒路基首批士氣圖出現雙尾疑慮，已淘汰並重畫成只有一條明確連接下背、向畫面右側彎曲的尾巴。正式目錄只採用修正版。
- 暫停位置：依使用者指示，完成正在生成的覺醒路基後停止生圖。KING／燼、卡塔庫栗、萊德菲爾德、洛基與荒牧 5 名尚未生成，雖有六個固定檔名但各目錄 `UniqueHashes=1`，仍是 `normal.webp` 複本占位。下次必須從 KING／燼開始，順序與完整規格記於 `docs/POSTGAME_BOSS_BATTLE_PORTRAIT_PROGRESS.md`。
- 邊界：本輪沒有修改任何 Boss key、角色／道具／任務 id、正式圖片路徑字串、戰鬥規則、`gameState`、localStorage key、Socket.IO event 或 server 欄位；正式頁會直接沿用既有六狀態路徑讀到替換後圖片。
- 驗證：8 個本輪完成目錄均為 `Files=6`、`UniqueHashes=6`，`postgame_rocks` 同樣為 6／6；5 個待續作目錄均為 `Files=6`、`UniqueHashes=1`。本輪完成目錄的 40 張新狀態 WebP 均為 1024×1536，40 張選用原始 PNG 均存在。視覺逐張檢查人物辨識特徵、武器、肢體數量、背景與 angry／hit／morale／weak／dizzy 狀態語意；沒有以換色或濾鏡冒充新狀態。另以臨時 `PORT=8820 npm start` 啟動正式服務，`board_battle.html` 與 8 名完成組共 48 張六狀態 WebP 全部回應 HTTP 200／`image/webp`，驗證後已停止 8820 listener。

#### 十三島 Boss 六狀態戰鬥圖全數補完 V114

- 日期：2026-07-30。
- 檔案：`public/images/board/battle/enemies/postgame_king/`、`postgame_charlotte_katakuri/`、`postgame_patrick_redfield/`、`postgame_loki/`、`postgame_aramaki/`、`docs/POSTGAME_BOSS_BATTLE_PORTRAIT_PROGRESS.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 完成內容：依 V113 固定順序補完 KING／燼、卡塔庫栗、雷德菲爾德、洛基與荒牧。每名保留既有 `normal.webp`，新增真正不同姿勢與表情的 `angry`、`hit`、`morale`、`weak`、`dizzy` 五張正式圖；本輪 25 張 WebP 與十三名合計 65 張新狀態 WebP 全為 1024×1536，65 張選用原始 PNG 均以 `{state}_imagegen_v2.png` 保存在各自 `incoming/`。
- 人物驗收：KING 固定白髮、左臉紋樣、雙黑翼、一把紅柄劍與背火；卡塔庫栗固定毛皮圍巾、粉紅年糕武裝手臂與單一三叉戟；雷德菲爾德固定羽飾寬帽、酒紅長衣、白皺領與單一蝙蝠傘杖；洛基固定粉紅辮髮、遮眼布、雙角盔、兩臂與單一冰雷巨鎚；荒牧固定黑綠髮、墨鏡、白外套、胸前刺青與兩臂木質化人形。卡塔庫栗首批暈眩圖因重複三叉戟頭淘汰並單獨重畫，正式目錄只採用單一三叉戟修正版。
- 最終狀態：十三島 Boss 共 13 個正式目錄、78 張六狀態 WebP，逐目錄均為 `Files=6`、`UniqueHashes=6`、`webp 1024x1536`；不再有 `UniqueHashes=1` 的 normal 複本占位。`postgame_rocks` 另維持 `Files=6`、`UniqueHashes=6`、`webp 1024x1536`。
- 邊界：本輪只替換圖片並同步文件，沒有修改 Boss key、角色／道具／任務 id、正式圖片路徑字串、戰鬥規則、`gameState`、localStorage key、Socket.IO event 或 server 欄位；正式頁沿用既有六狀態路徑直接讀取新圖。
- 驗證：逐張目視檢查人物一致性、肢體、武器、狀態語意與裁切；靜態腳本確認十三名全部六張不同雜湊、正確格式與尺寸，且每名五張選用原始 PNG 存在。另以臨時 `PORT=8820 npm start` 啟動正式服務，`board_battle.html` 回應 HTTP 200，13 名共 78 張 WebP 全部回應 HTTP 200／`image/webp`；驗證後停止已確認的 Node listener，`RemainingListeners=0`。

#### 八名十三島 Boss 原作參考圖重畫 V115

- 日期：2026-07-31。
- 檔案：`public/images/board/battle/enemies/postgame_shiki/`、`postgame_gild_tesoro/`、`postgame_douglas_bullet/`、`postgame_saga/`、`postgame_rob_lucci_awakened/`、`postgame_charlotte_katakuri/`、`postgame_patrick_redfield/`、`postgame_aramaki/`、`docs/POSTGAME_BOSS_BATTLE_PORTRAIT_PROGRESS.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 根因：V113／V114 雖已補齊獨立六狀態，但使用者指出部分人物與原作外型差距過大，並在上述 8 個 Boss 目錄放入角色參考圖。本輪先逐張查看參考圖，再以各角色已核准的新版 `normal`、使用者參考圖與既有戰鬥圖規格共同生成，不沿用錯誤人物特徵。
- 人物校正：史基改為禿頂殘破船舵、金鬃披風、橘紅和服及雙劍義肢；泰佐洛改為深綠髮、頭頂紫金眼鏡、星耳飾、桃紅西裝及白領；巴雷特改為金髮耳罩、淡金毛披風、白線黑軍裝與肩鏈；薩卡改為銀色短髮、酒紅袍、臂環、腰帶、珠鏈、單一七星劍與空劍鞘；覺醒路基固定黃豹、白胸腹與白褲、黑焰雲及單尾；卡塔庫栗固定洋紅短髮、嘴角縫線、條紋毛巾、紋身、黑衣、粉白護膝及單一三叉戟；雷德菲爾德固定瘦高蒼白、淡紫白髮與雙辮、紅眼尖耳、紅色大領結、藍玫瑰、菱格披風與單一傘杖，不戴帽或白皺領；荒牧固定青綠亂髮、圓墨鏡、香菸、披肩大將外套、四條胸紋、花紋黑褲、人類雙腿及單一腰刀，木化只作用於原本兩臂。
- 圖片與來源：8 名各自重畫 `normal`、`angry`、`hit`、`hit_player`、`morale`、`weak`、`dizzy` 共 7 張，合計 56 張正式 1024×1536 WebP。選用 ImageGen 原始 PNG 以 `{state}_reference_redraw_v3.png` 保存在各自 `incoming/`；V2 舊版及使用者參考圖均保留。正式頁仍只引用原本穩定檔名。
- 人工驗收：56 張逐張檢查臉型、髮型、服裝、武器數量、肢體與狀態語意。所有卡塔庫栗圖都只有一把三叉戟；所有雷德菲爾德圖都只有一把傘杖且沒有帽子；所有覺醒路基圖都只有一條尾巴；所有荒牧圖都保留兩手、兩條人類腿及一把刀。兩張受擊圖保持不同姿勢，沒有以同圖複製或濾鏡代替。
- 靜態驗證：8 個重畫目錄全部 `Files=7`、`UniqueHashes=7`、`v3_sources=7`；十三名原六狀態整體回歸仍為 78／78 張、每名 `UniqueHashes=6`、全部 `webp 1024x1536`，未重畫的捷風、Tot Musica、伽治、KING、洛基沒有受到影響。
- 服務驗證：以臨時 `PORT=8820 npm start` 啟動正式服務，`board_battle.html` 回應 HTTP 200，8 名共 56 張七狀態 WebP 全部回應 HTTP 200／`image/webp`；驗證後確認 listener 為本輪 `node server/index.js` 再停止，`RemainingListeners=0`。
- 邊界：本輪只替換圖片並同步文件，沒有修改 Boss key、角色／道具／任務 id、正式圖片路徑字串、戰鬥／抽取／培育規則、`gameState`、localStorage key、Socket.IO event 或 server 欄位。

#### 十三島 Boss 七狀態大半身戰鬥圖統一 V116

- 日期：2026-07-31。
- 檔案：十三個 `public/images/board/battle/enemies/postgame_*/` Boss 目錄、各自 `incoming/`、`docs/POSTGAME_BOSS_BATTLE_PORTRAIT_PROGRESS.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 根因：V113～V115 已補齊獨立狀態與人物參考，但十三島 Boss 圖多數仍接近完整站姿，人物頭胸明顯小於赤犬等已完成敵人圖；膝蓋、鞋、長武器與大面積下半身占去戰鬥卡視窗，未符合使用者指定的半身構圖。
- 構圖統一：以既有赤犬及其他完成敵人圖作比例參考，十三名的 `normal`、`angry`、`hit`、`hit_player`、`morale`、`weak`、`dizzy` 全部重新生成為真正的大半身肖像。頭部貼近上緣、肩膀／披風撐滿左右，人物臉與胸腰占畫面約 75～90%，最下方固定在腰帶或上臀截斷；不再顯示大腿、膝蓋、鞋或完整站姿。武器與能力只作前景或背景敘事，不得把人物縮小。
- 人物與狀態：保留 V115 已校正的人物辨識、服裝、武器與肢體限制；捷風、Tot Musica、伽治、KING、洛基也一併重畫為同一大半身規格。七張保持各自狀態語意與獨立構圖，`hit` 是敵方站位受擊，`hit_player` 是血統培育角色站在玩家側時使用的反方向受擊圖，不以同圖複製、主動攻擊姿勢或濾鏡代替。
- 圖片與來源：十三名共 91 張正式圖全部為 1024×1536 WebP；選用的 ImageGen 原始 PNG 以 `incoming/{state}_halfbody_v4.png` 保存，V2、V3 舊來源與使用者參考圖都未刪除。正式檔名與既有引用路徑不變。
- 人工驗收：逐名建立七狀態聯絡表檢查頭腰裁切、人物比例、表情、肢體與武器數量；另建立十三名 `normal` 及 `hit_player` 總覽確認整組比例與受擊方向一致。Tot Musica 維持三頭與兩鍵盤翼臂，覺醒路基維持單尾，KING 維持雙翼一劍，卡塔庫栗維持單一三叉戟，雷德菲爾德維持雙辮、無帽與單一傘杖，洛基維持蒙眼、雙角與單一巨槌，荒牧木化只沿原本兩臂。卡塔庫栗、雷德菲爾德、洛基、荒牧首批 `hit_player` 因誤成主動攻擊而淘汰，正式檔使用「衝擊由畫面右側打入、人物向左後方震退」的修正版。
- 靜態與服務驗證：十三個目錄逐一為 `formal=7`、`UniqueHashes=7`、`incoming_v4=7`，總計 91／91 張均為 1024×1536 WebP。以臨時 `PORT=8820 npm start` 啟動正式服務，`board_game.html`、`board_battle.html` 及 91 張正式圖片全部回應 HTTP 200，圖片 Content-Type 為 `image/webp`；確認 listener 是本輪 `node server/index.js` 後停止，`RemainingListeners=0`。
- 邊界：本輪只替換十三名 Boss 圖片並同步文件，沒有修改 Boss key、角色／道具／任務 id、圖片路徑字串、戰鬥／抽取／培育規則、`gameState`、localStorage key、Socket.IO event 或 server 欄位。

#### 卡塔庫栗玩家側受擊反邊與洛克斯參考圖大半身重畫 V117

- 日期：2026-07-31。
- 檔案：`public/images/board/battle/enemies/postgame_charlotte_katakuri/hit_player.webp`、`postgame_charlotte_katakuri/incoming/hit_player_halfbody_v5.png`、`public/images/board/battle/enemies/postgame_rocks/`、`postgame_rocks/incoming/ROCKS_BATTLE_PORTRAITS_PROMPT.md`、`docs/POSTGAME_BOSS_BATTLE_PORTRAIT_PROGRESS.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 卡塔庫栗：使用者指定 `hit_player` 要改到目前反邊；因此以 Sharp 對已核准的 V4 原始 PNG 作精確水平反轉，不重新生成，不改人物、毛領、刺青、三叉戟、撞擊內容或尺寸。V4 保留，反邊來源另存 `hit_player_halfbody_v5.png`，正式 `hit_player.webp` 仍為 1024×1536。
- 洛克斯參考：逐張查看目錄新增的 `images (4).jfif`、`b8bb65be1881884c3793f2b8a22b2b8c (1).jfif`、`images (5).jfif` 與 `42bd8956fa1a47a48b38b9063092a166.webp`，以半身、臉部、全身裝備與彎刀／氣氛四種用途共同約束人物，不再沿用舊提示詞的全身到靴子構圖。
- 洛克斯重畫：七張正式圖固定白冰藍後掠爆髮、中央深色髮束、長尖鼻、角色左眼跨眼傷疤、細黑鬍與尖鬍、雙金耳環、裸胸傷痕、巨大黑毛披風、毛邊金釘腰封、黑金腕環及單一金護手彎刀。全圖為頭肩撐滿、腰封截斷的大半身，不顯示大腿、膝蓋、小腿或長靴；`hit` 與 `hit_player` 使用左右相反的受擊方向。
- 圖片與來源：洛克斯 `normal`、`angry`、`hit`、`hit_player`、`morale`、`weak`、`dizzy` 共 7 張正式 WebP 均為 1024×1536、七張雜湊不同；選用 ImageGen PNG 保存為 `incoming/{state}_reference_halfbody_v2.png`。舊六張來源與新增參考圖不刪除；提示詞文件同步改成七張大半身規格。
- 驗證：逐張聯絡表確認洛克斯七張人物、武器數量、腰部裁切、狀態與受擊方向；靜態腳本確認 `states=7`、`UniqueHashes=7`、`sources_v2=7`，卡塔庫栗正式反邊圖與 V5 原始 PNG 均為 1024×1536。以臨時 `PORT=8820 npm start` 啟動正式服務，`board_game.html`、`board_battle.html`、卡塔庫栗 `hit_player.webp` 及洛克斯七張 WebP 全部 HTTP 200／`image/webp`；驗證後停止本輪 Node listener，`RemainingListeners=0`，文件無尾端空白且 `git diff --check` 通過。

#### 洛克斯七狀態、手部與參考武器修正版 V118

- 日期：2026-07-31。
- 檔案：`public/images/board/battle/enemies/postgame_rocks/normal.webp`、`angry.webp`、`hit.webp`、`hit_player.webp`、`morale.webp`、`weak.webp`、`dizzy.webp`、`postgame_rocks/incoming/{state}_state_clear_weapon_v3.png`、`postgame_rocks/incoming/weapon_reference_zoom_v3.png`、`postgame_rocks/incoming/ROCKS_BATTLE_PORTRAITS_PROMPT.md`、`docs/POSTGAME_BOSS_BATTLE_PORTRAIT_PROGRESS.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 根因：使用者指出 V117 的狀態姿勢不夠明顯，虛弱圖的交疊手臂容易被看成多出一隻手；後續再要求武器依目錄參考圖重畫。逐張檢查後確認舊 `weak` 仍帶戰意笑容、`dizzy` 只靠螺旋眼區分，舊武器也誤成過度華麗的大型十字護手彎刀。
- 七態重畫：`normal` 改為閉嘴冷笑低位持刀；`angry` 為舉刀怒吼與前伸拳；`hit` 為左入金白衝擊、`hit_player` 為右入藍白反向衝擊；`morale` 為挺胸拳壓胸口與日蝕光環；`weak` 明顯駝背喘息並只以雙手上下交疊握同一刀柄；`dizzy` 為螺旋眼、一手扶額、一手垂刀及三顆星。七張逐圖確認只有兩臂、兩手與一把刀。
- 參考武器：由 `images (5).jfif` 裁出並放大武器設計為 `weapon_reference_zoom_v3.png`，統一使用細長銀灰單刃、深色刀背、平順上彎刀尖、小型黃銅 D 形護手與護弓、短深紫握柄及圓形黃銅刀首；移除 V117 的巨大華麗十字護手與寬黑刀身。
- 圖片與相容性：七張選用原始 PNG 保存為 `{state}_state_clear_weapon_v3.png`，正式 WebP 均轉為 1024×1536、品質 92；高窄原圖以暗化模糊背景延伸左右，不裁掉扶額手、星環或雙手同柄。正式穩定檔名、敵人 key、戰鬥狀態切換、受擊方向、能力、獎勵、抽取、`gameState`、localStorage key、Socket.IO event 與 server 欄位均未修改。
- 驗證：七張聯絡表與 `weak`／`dizzy` 原圖逐張確認狀態、左右受擊方向、武器結構及兩臂兩手；靜態腳本確認 `Files=7`、`UniqueHashes=7`、`sources_v3=7`，正式圖全為 WebP 1024×1536。`git diff --check` 通過。另以臨時 `PORT=8820 npm start` 啟動正式服務，`board_game.html`、`board_battle.html` 與七張洛克斯 WebP 全部回應 HTTP 200，圖片 content-type 均為 `image/webp`；驗證後停止已確認的 launcher 與 Node listener，`RemainingListeners=0`。
- 邊界：本輪只修改圖片與素材規格文件，沒有修改角色／道具 id、Boss key、戰鬥方向判斷、能力、獎勵、抽取、培育、`gameState`、localStorage key、Socket.IO event 或 server 欄位。

#### 全破後世界第 11 階段 CPU 完整行為 V119

- 日期：2026-07-31。
- 範圍：完成第 11 階段 CPU 全破後整合。CPU 可從十三島 Boss 與洛克斯圖片式遭遇頁直接開戰；競技場改為優先選擇尚未擁有角色並依強度／屬性選兩名船員；抽取器依階級、預期三段成績、成功率目標與成本選擇；研究所會比較船上隊伍與研究收藏，在隊伍明顯提升時交換角色。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 規則與相容性：隊伍維持六人上限與同模板唯一；被換下角色以同一物件及原 `instanceId` 放入研究收藏，等級、EXP、修行、招式、記憶、型態、外觀框、攜帶物及血統傾向不重生、不刪除。培育角色維持 Lv.1、零 EXP、零修行、記憶 0、S 階、基礎型態。沒有新增或改名 `gameState`、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 欄位。
- 程式驗證：`node --check public/js/board_game.js` 通過。正式 CPU 抽取測試確認標準抽取器 1→0、三段成績寫入、失敗後 `allResolved=true`；CPU 競技場建立兩名限定名單，對手 profile 為 Lv.99、六項修行 30、記憶 3、SSS；CPU 培育索隆確認 Lv.1、總 EXP 0、六項修行 0、S 階、因子只消耗一次。
- 永久角色與存讀檔驗證：用六人滿隊加研究收藏執行交換，船員數保持 6、同模板重複 0、候選原 instance 登船、換下角色原 instance 進收藏；存檔、覆寫畫面狀態再讀檔後，換下角色的 instance、測試養成標記與收藏位置全部恢復，所有舊 instance 缺失數為 0。
- CPU 流程驗證：乾淨 `cpu4=1` 開局自動完成三輪選角後連跑 60 秒，正常由羅格鎮航行、顛倒山選路、處理海格二選一、敵島戰鬥、勝利結算與酒館招募；回合由 1 推進至 6，戰鬥已清除、`pendingMove=false`、`resolutionLock=false`、CPU `lastError` 空白、船員無同模板重複。洛克斯圖片式遭遇頁另實測由 CPU 自動點擊挑戰並建立 `postgame_egghead` battle。
- UI 與素材驗證：Chrome 1440×900 及 390×844 實際開啟競技場、研究所角色管理與洛克斯遭遇頁；三頁圖片均能解碼，破圖 0，文字可見 overflow 0，按鈕與角色圖留在圖片框內。此階段沒有新增圖片，沿用已核准的圖片式主框與角色／敵人素材。
- 服務與多人：以 `PORT=8820 npm start` 啟動正式靜態頁；`board_game.html` 及 `board_game.js?v=20260731-cpu-postgame-stage11-v1` 正常載入。另以兩個獨立瀏覽器 context 建立線上房 `B9654`、加入、準備及開始，雙方進入相同 `board_game.html?room=B9654&online=1`；房主推進到 `setup-draft` 後，兩窗 seed、六段 draft sequence 及 `BOARD_GAME_STATE` version 2 完全相同，雙方 Socket connected、`lastError` 空白。唯一 404 是瀏覽器自動請求且專案原本未提供的 `/favicon.ico`，不影響遊戲。未改 server；第 13 階段仍需執行四人、觀看方及全破後狀態的完整多人回歸。

#### 全破後世界第 12 階段全圖鑑 V120

- 日期：2026-07-31。
- 範圍：把船團資訊內原本的圖片式「討伐紀錄」升級為正式「全圖鑑」。目錄由 51 名競技場玩家角色、51 種既有正式敵人模板、十三島 Boss、洛克斯及重疊角色依玩家模板 `card.id` 合併，最終為 109 種；同角色多個永久實例只收錄一種，另外統計船上與研究收藏的實際持有數。
- 檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 狀態與舊存檔：`defeatedEnemies` 保持原欄位與敵人 key，向下相容增加 `sourceCardId`、`encounterCount`、首次／最後遇見時間與最後遇見地點；舊討伐 `count` 會安全視為至少同次數遭遇，遇見但未勝利可保存 `count: 0`，所有依討伐解鎖麥哲倫、神之騎士團及洛克斯的判斷都明確要求 `count > 0`。研究所 schema 由 5 升到 6，新增去重後的 `codexFactorCardIds` 與 `codexCultivatedCardIds`；現有完整因子及既有培育角色會自動回補歷史，因子被培育、解析或突破消耗後不會清除曾取得紀錄。沒有新增 localStorage key 或 Socket.IO event。
- 戰鬥接線：一般敵島、四皇、推進城、Marineford、司法島、艾爾巴夫／伊姆、競技場、十三島 Boss 與洛克斯共用 `createBattleState()` 開戰時記錄遭遇；海格使用自己的 battle state 建立點補記。舊 pending 戰鬥由 `normalizeBattleState()` 以每玩家一次的 battle 內 id 防重補記；勝利仍沿用 `recordDefeatedEnemy()`，不改原獎勵與抽取結算。
- 圖片式 UI：沿用 `public/images/board/defeated_codex_ui/` 1672×941 主框、共用橫列框、正式角色／敵人 portrait 及既有 S～E 圓章，沒有新增圖片或用 CSS 方格取代圖片。頂部三個既有圖片框顯示遇見、擊敗、因子／培育四項進度；左側顯示角色、來源地點與持有／研究狀態，中間顯示已持有彩圖或可辨識暗色剪影，右側顯示四階段紀錄、現有因子、持有數、來源與最後遇見地點。主頁 query 更新為 `20260731-full-codex-stage12-v1`。
- 資料與效能驗證：乾淨狀態建立 109 種圖鑑；測試資料確認 2 次遭遇、1 種擊敗、2 種因子、1 種培育與同角色 2 個永久實例正確分欄。schema 5 mock 存檔可遷移到 schema 6，既有討伐 3 次回補遭遇 3 次，現有因子及既有培育角色自動加入歷史。手動存檔、清空畫面狀態再讀檔後，遇見／擊敗／因子／培育／持有五項完全恢復。測試快照實際新增 467 bytes（0.1111%）；把 109 種兩份歷史 id 全填滿的最壞估算新增 3,642 bytes（0.887%）；圖鑑彙整連跑 50 次平均約 1.098 ms。
- 圖片與版面驗證：109 種角色主圖加主框、橫列框及六張階級章共 117 條唯一圖片路徑全部 HTTP 200 且為 image content type。Chrome 1440×900、1024×768、844×390 與 390×844 實際開啟全圖鑑並選取已持有、因子已取得但未持有、只擊敗、只遇見及完全未遇見角色；圖片未拉伸，文字留在既有框內，頁面水平 overflow 為 0，平板來源／地點文字沒有超出框。直向手機維持專案既有 16:9 縮放，橫向手機為建議操作方向。
- 多人驗證：兩個獨立瀏覽器 context 透過正式 `board_start.html` 建立線上房 `B7763`、第二人加入、雙方準備並開始；房主寫入白鬍子遇見與完整因子歷史後推送既有完整 `BOARD_GAME_STATE`，另一視窗收到 version 2，圖鑑顯示 `1/109` 遇見、`1` 種因子、最後遇見「競技場島」，Socket 均 connected 且未新增 server event。
- 靜態與服務驗證：`node --check public/js/board_game.js`、`git diff --check` 通過；以臨時 `PORT=8820 npm start` 啟動正式服務，`board_game.html` 與 `board_game.js?v=20260731-full-codex-stage12-v1` 均 HTTP 200，驗證後停止本輪 Node listener，`RemainingListeners=0`。另在既有 8787 服務以 Chrome 乾淨載入，沒有 page error 或 4xx。第 12 階段沒有生圖需求，因為現有全圖鑑主框、橫列框、角色圖與階級章已完整覆蓋版面；下一步為第 13 階段全流程驗證與文件收尾。

#### 全破後世界第 13 階段完整驗證與文件收尾 V121

- 日期：2026-07-31。
- 範圍：完成第 0～12 階段功能的全流程回歸、跨尺寸圖片／文字檢查與文件結案。本階段沒有發現需要修改的正式程式或新增圖片；只更新 `docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 靜態與 HTTP：17 份 Board／server JavaScript 全部通過 `node --check`；18 份 `public/board*.html` 共 14 段 inline script 通過語法檢查。34 份 Board HTML／JS／CSS 的 628 個字面素材引用缺檔 0；由正式頁展開的 646 個頁面／素材請求全部 HTTP 200。`git diff --check` 通過；正式 query 維持 `20260731-full-codex-stage12-v1`。
- 舊存檔與手動存讀刪：缺少 `postgameWorld` 但已有結局紀錄的舊狀態會補建解鎖世界；研究所 schema 2 可升到 6；重複／缺失角色 `instanceId`、因子與培育圖鑑歷史、研究等級及舊討伐遭遇次數均安全補齊。獨立房 `STG13LOCAL` 實測本機加 server 存檔、覆寫狀態後讀回及刪除；刪除後房號專屬存檔確實移除，跨房 `RECOVERED` 後備仍依原設計保留。
- 戰鬥與抽取：一般敵人、海格、司法島、推進城、Marineford、四皇、艾爾巴夫、伊姆、競技場、十三島、洛克斯與共鬥共 12 類正式來源均建立個人 `offered` 抽取狀態及穩定 `bgmScopeId`。全破前、黑轉回合、敗戰不誤開；成功與失敗三階段均可完成且只結算一次。另以正式敵島戰鬥實測失敗結果、四項判定與「繼續戰鬥結算」；按下後回原勝利面板，再由原「返回地圖」清除戰鬥，確認過去提取失敗後疑似卡住的流程已暢通。
- 服務島與競技場限制：12 座正式醫院／酒館在全破前維持醫院／酒館，全破後切換研究所／競技場並使用正確島圖；敵人島暫時轉成的醫院／酒館不誤轉。免費醫療實測可完整恢復三名受傷船員的 HP、PP 與能力階段。競技場只選索引 1、4 後，畫面、換人、道具目標、瀕死替補與隊伍職能均只使用該兩人，未選索引 0 無法換上場。
- 四人、CPU 與觀看方：透過正式大廳建立房 `B2012`，由 `Stage13Host`、`Stage13Guest` 與 CPU A／B 組成四人局，完成準備、開始與同一快照載入。兩名 CPU 都實際擲骰、移動、經羅格鎮與顛倒山選路、處理海格選擇並完成回合；回合橫幅的延後套用結束後兩個真人視窗收斂到相同 version 31、回合與位置。非當前觀看方嘗試擲骰不改位置或版本；研究所顯示唯讀，僅能看角色詳情。另把 CPU 放到司法島，實測會自動點擊進關並建立 Spandam `isJudicialRaid` 戰鬥，不再卡在選擇頁。
- 圖片與版面：研究所醫療、七型抽取器補給、完整因子培育、競技場、109 種全圖鑑及重要道具背包在 1440×900、1024×768、844×390、390×844 實際開啟。主框均留在 viewport，圖片未拉伸、破圖 0、可見文字越框 0；全圖鑑將 221 張 lazy image 強制載入後仍全部解碼。背包抽取器與完整因子的純黑圓孔外框、頭肩裁切及一致道具尺寸正常。手機直向沿用專案既有 16:9 整體縮放，橫向仍是建議操作方向。
- 服務啟動與邊界：最終以臨時 `PORT=8822 npm start` 啟動，`board_game.html` 與 `board_game.js?v=20260731-full-codex-stage12-v1` 均 HTTP 200；停止本輪 launcher 與已確認的 Node listener 後 `RemainingListeners=0`。測試環境未設定 `DATABASE_URL`，因此 server 依既有設計回報 DB-backed 功能停用，但靜態 Board 頁與本機房間服務正常。瀏覽器唯一 404 是專案原本未提供的 `/favicon.ico`，不影響遊戲。本階段沒有修改角色／道具／任務／地圖 id、圖片或音訊路徑、`gameState`、localStorage key、Socket.IO event、server 欄位或 `BOARD_GAME_STATE` 套用流程。

#### 十三島 Boss 專屬戰鬥正式接入 V122

- 日期：2026-08-01。
- 需求：依逐名確認的構想把史基、泰佐洛、捷風、Tot Musica、巴雷特、薩卡、伽治、覺醒路基、KING、卡塔庫栗、雷德菲爾德、洛基與荒牧的特殊玩法接入正式主遊戲；需要的圖由 Codex 生成，完成後檢查圖片與文字版位。
- 程式：`public/js/board_game.js` 新增 13 組 `postgameBossMechanic` 初始化、舊 pending battle 正規化、每輪／行動／命中／傷害／倒下掛點、CPU 目標策略與正式戰鬥 view。真人可指定複製兵、Ragnir、森林根系；泰佐洛三層黃金免費強制換人；Tot Musica 開戰分隊並逐世界選擇行動。專屬狀態保存在既有 battle state，沒有新增 `gameState`、localStorage key、Socket.IO event 或 server 欄位。
- 巴雷特：開戰時讀取六名登船船員的實際 `battleCarryItem` 填入頭、胸、左右手、左右腳六孔；孔位存在期間原持有人效果停用，巴雷特套用正式攜帶物的屬性、命中、增傷、減傷、反傷、回復、異常、一次性保命、道具鎖與連續招式等戰鬥效果。玩家命中時依第一顆骰破壞對應孔位；尚未消耗的護盾／次數／儲存傷害及觸發狀態返還持有人。地圖、掉落、金錢、逃跑等非戰鬥效果維持不適用。
- 戰鬥 UI：`public/board_battle.html`、`public/js/board_battle.js` 新增頂部圖片式機制主框、Boss 島圖、動態標題／提示／數值、六孔、六式、血祭、浮空、熱量、冰雲、森林、隊伍生命與目標按鈕；另新增泰佐洛免費指定換人及 Tot Musica 圖片式雙世界分隊／雙行動操作。桌機 1600×900 與手機橫向 900×600 都保留完整主框。
- 圖片：ImageGen 生成 `public/images/board/battle/postgame_mechanics/postgame_boss_mechanic_panel_v1.png`，以及薩卡 `fused_normal.webp`、捷風 `black_arm_normal.webp`、Tot Musica `movement_1_normal.webp`／`movement_2_normal.webp`、巴雷特 `fusion_normal.webp`、洛基 `dragon_normal.webp`；第三樂章由既有 Tot Musica 正式圖保存為 `movement_3_normal.webp`。巴雷特正式圖為 1:1 大半身，六個黑色金框孔位都在安全範圍。完整提示詞、原始 PNG 與正式路徑記於 `docs/POSTGAME_BOSS_IMAGE_PROMPTS_20260801.txt`。
- 規則文件：把 `docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt` 由 7 名討論紀錄補齊為 13 名正式接入基準，並同步更新 `docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`。
- 自動驗證：`node --check public/js/board_game.js`、`node --check public/js/board_battle.js` 通過。`scripts/postgame_boss_mechanics_qa.js` 使用 Codex bundled Playwright 在正式 8787 頁面建立 13 場戰鬥；13 個主框全部留在 viewport，桌機文字越框 0、破圖 0，手機主框越界 0、文字越框 0、破圖 0，7 張階段圖均 HTTP 200。
- 行為驗證：13/13 通過。史基浮空 3 經高骰命中降到 1；泰佐洛累積三層後可免費指定換人；捷風三甲全破切黑腕；Tot Musica 分成 3＋3；巴雷特骰 1 破壞 1 號孔；薩卡血祭 75 切融合；伽治人牆普通阻擋／高骰完整貫穿；路基六式全亮預告六王銃；King 熄火承受完整 100；卡塔庫栗改招高骰使冷靜降到 1；雷德菲爾德骰 6 吸全隊 6%；洛基三雲雷擊為 145%、剩 1 雲且凍結；荒牧四片森林復活為最大 HP 40%。最終 `errors=[]`、`failures=[]`。
- 視覺人工檢查：檢查 `postgame_bullet_mechanic_desktop.png`，確認六孔完整、角色為大半身且沒有多肢；檢查 `postgame_tot_setup_desktop.png`，確認六張角色圖放大填滿圖片卡、標題與確認按鈕留在框內；檢查 `postgame_redfield_mechanic_mobile.png`，確認手機橫向主框與六名生命顯示沒有超界。
- 服務驗證：以 `PORT=8824 npm start` 啟動正式 server，`board_game.html`、`board_battle.html`、`js/board_game.js` 與圖片式機制主框都回應 HTTP 200；驗證後停止本輪 Node listener，`RemainingListeners=0`。測試環境未設定 `DATABASE_URL`，DB-backed 功能依原設計停用，不影響 Board 靜態頁與本機戰鬥。
- 快取版本：`board_game.html` 與 `board_battle.html` 的正式 script query 同步更新為 `20260801-postgame-boss-mechanics-v1`，避免既有 7/30、7/31 瀏覽器快取遮蔽新機制。

#### Boss 掉落攜帶物定案記錄與正式圖 V123

- 日期：2026-08-01。
- 範圍：記錄使用者目前確認的史基、泰佐洛、捷風、Tot Musica、巴雷特、薩卡、伽治、覺醒路基、KING、卡塔庫栗、雷德菲爾德、洛基、綠牛與洛克斯共 14 件掉落攜帶物名稱與效果；建立 `public/images/board/items/postgame_boss_relics/` 並生成同規格正式道具圖。伽治依中途回饋先由已展開盔甲改為未啟動的金黑 `66` 封存罐，再改成香吉士「隱形黑」未啟動的黑色 `3` 號封存罐；兩張淘汰稿都只留在 `incoming/`。
- 檔案：`docs/POSTGAME_BOSS_RELICS.md`、`public/images/board/items/postgame_boss_relics/*.webp`、`public/images/board/items/postgame_boss_relics/incoming/*.png`、`public/images/board/items/postgame_boss_relics/POSTGAME_BOSS_RELIC_IMAGE_PROMPTS.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 視覺基準：沿用 `public/images/board/items/life_orb.webp` 等正式攜帶物的黑底、高對比、置中單物件風格；武器／戰鬥服優先參考現有 Boss 正式圖及原作輪廓，原作沒有對應實體物件者只依能力延伸。圖片不放角色、手、網頁格子、UI 外框或水印。
- 驗證：14 張正式圖均為 1254×1254、RGB、真 WebP、不透明黑底，有損壓縮後四角 RGB 各通道仍為 0～1；總覽人工檢查六孔裝甲正好六孔、土龍三叉、綠牛三顆小種子、洛克斯 D 形護手彎刀與伽治黑色 `3` 號隱形黑封存罐。所有正式檔可由 Pillow 解碼，來源 PNG 與正式 WebP 一一對應。
- 服務驗證：以獨立 `PORT=8826 npm start` 啟動正式 server，`board_game.html` 與 14 張正式 WebP 共 15 條請求全部 HTTP 200，圖片回應均為 `image/webp`；驗證後停止本輪 listener，`RemainingListeners=0`。環境未設定 `DATABASE_URL`，DB-backed 功能依既有設計停用，不影響靜態 Board 頁與素材服務。
- 邊界：本階段沒有修改 `public/js/board_game.js`、`public/js/board_battle.js`、道具 id、掉落率、勝利結算、背包資料、`gameState`、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`；14 件道具目前只有定案記錄與素材，尚未接入遊戲。

#### 約克十三張線索 V2・正式流程隔離預覽 V124

- 日期：2026-08-02。
- 範圍：依「先讀碼與回報入口 → ImageGen 生圖 → 獨立正式流程預覽 → 多尺寸實測 → 使用者確認後才接正式頁」順序完成前四項；本階段刻意不修改 `public/board_game.html`、`public/js/board_game.js`、`public/js/board_items.js`、洛克斯正式結算、CPU、存檔或同步。
- 修改前檢查：確認現況仍由 `postgameClueCollectionSummary()`／`canActivateYorkTracking()`／`activateYorkTrackingFromBackpack()`／`completeYorkTrackingActivation()` 直接完成全房蛋頭島追蹤；CPU 直接呼叫完成函式。洛克斯勝利獎勵由實際 `rewardRecipients` 進入 `grantRocksVictoryRewards()`，`rocksRewardedPlayerIds` 與戰鬥獎勵快取負責防重；手動存檔與多人仍走完整 `BOARD_GAME_STATE`。因此正式接入時，個人解碼器狀態必須留在玩家，世界顯現仍留在 `postgameWorld`，日蝕必須逐參戰者獨立判定且寫入既有結果快取。
- ImageGen：建立 `public/images/board/postgame_clue_puzzle_ui/incoming/`，生成 T1／T2／T3 同輪廓約克座標解碼器、16:9 背景、十三槽主框、簡單／普通／困難同構難度框、鎖定／解鎖、主要／次要按鈕與成功結果框共 13 組來源。洋紅遮罩以 imagegen skill 的 `remove_chroma_key.py` 去背；確認檔為指定尺寸真 WebP，透明元件均為 RGBA 且 alpha 範圍 0～255，背景為 1920×1080 RGB。完整提示詞存於同目錄 `YORK_CLUE_PUZZLE_UI_IMAGEGEN_PROMPTS.md`；正式頁尚未引用 `incoming/`。
- 產生器：新增 `public/js/board_york_clue_puzzle.js`。題目由 layoutSeed、player id、difficulty、`york-coordinate-v2` 組合成穩定識別，同局同玩家同難度重開一致；三難度答案以固定置換保證互異。每牌一條線索、兩端各一條 `at` 固定座標，其他牌直接連到錨點，最大深度 1；簡單／普通／困難固定為直接 9／5／2、關係 4／8／11，弱方向線索為 0。解題器節點上限 120,000。
- 預覽頁：新增 `public/board_york_clue_puzzle_formal_demo.html`，實際使用本輪圖片與純產生器，完成三難度選擇、個人階級狀態、十三牌雙點／拖曳交換、各格鎖定、只洗未鎖定、全部解鎖、重設、無局部提示的通用錯誤、成功結果與第一次成功才揭露蛋頭島。頁面不提供答案按鈕或測試捷徑，不讀寫 localStorage、快照或 Socket.IO。
- 驗證工具：新增 `scripts/york_clue_puzzle_qa.js` 與 `scripts/york_clue_puzzle_demo_capture.js`。前者以 1,000 組局種 × 3 難度共 3,000 題驗證穩定重產、唯一解、審計答案、三難度互異、兩錨點、弱方向上限、深度與線索比例，結果 `ok=true`，最大求解節點 14。後者透過 bundled Playwright 操作雙點交換、鎖位後洗牌、重設解鎖、錯誤提示及從 UI 完成正解，並輸出 1440×900、1024×768、390×844、844×390 與成功結果頁截圖。
- 服務與文件：確認 8787 未被占用後執行 `npm start`，server 成功監聽；環境沒有 `DATABASE_URL`，依原設計只停用 DB-backed 功能，靜態預覽正常。同步更新 `docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/POSTGAME_BOSS_RELICS.md` 與本紀錄。下一步只在使用者確認畫面後，才把素材移出 `incoming/` 並接入正式背包、玩家狀態、洛克斯個人掉落、CPU 與同步／存檔。

#### 約克十三張線索 V2・上下放牌操作修正 V125

- 日期：2026-08-02。
- 使用者回饋：卡牌應先放在下方，再由玩家放入上方 13 格；1～13 號卡牌必須與遊戲正式道具牌一致。
- 預覽修改：只更新 `public/board_york_clue_puzzle_formal_demo.html` 與 `scripts/york_clue_puzzle_demo_capture.js`。上方改為 13 個初始空格；下方分區顯示全部未放置卡牌。支援點下方牌再點上方格、拖曳放入、上方牌互換、點上方牌再點下方牌替換、拖回下方、填入後鎖定、全部解鎖、只洗下方卡牌與清空重設。未放滿送出只顯示通用空格提示，放滿但錯誤仍不提供局部答案。
- 正式道具牌一致性：直接沿用 `images/board/postgame_clue_ui/york_clue_playing_card_frame_v2.webp`，並照 `public/board_game.html`／`itemIconMarkup()` 的正式比例疊入 Boss 島圖、A～K 左上／右下倒轉牌值與青色菱形；牌外另標示「線索 1～13」，沒有另畫替代卡面。
- 驗證：Playwright 重新跑 1440×900、1024×768、390×844、844×390；每個畫面都是 13 個上方格、13 張下方牌、13 條線索，整頁寬度等於 viewport，錯誤與 4xx 為 0。自動操作實測下方點牌放入上方、連續放五張、鎖定後洗下方不移動上方、重設清空並回復下方初始順序、空格提示、逐張填入唯一解及成功結果，`ok=true`。正式 Board、道具、掉落、CPU、存檔與同步仍未修改。

#### 約克十三張線索 V2・大卡牌底框重畫 V126

- 日期：2026-08-02。
- 使用者回饋：原底框把卡牌壓得太小，無法快速辨識牌號；上方 13 個目標格不需要顯示數字。
- ImageGen：以首版主框為風格參考，使用內建 ImageGen 重畫 1920×1080 底框。左側線索欄縮為窄直欄，上方保留一排 13 個明顯加高卡槽，下方改為兩條大型開放式牌架，分別容納 7 張與 6 張直式卡，底部仍為四個操作按鈕。主框本身沒有文字、數字、卡牌或人物。來源固定為 `york_clue_puzzle_main_frame_v2_source.png`。
- 去背與素材：依實際洋紅背景取樣 `#ea0cea`，使用 imagegen skill 的 `remove_chroma_key.py`、soft matte 40／95 與 despill 產生 `york_clue_puzzle_main_frame_v2_alpha.png`，再輸出 1920×1080 RGBA lossless `york_clue_puzzle_main_frame_v2_preview.webp`；Alpha 範圍為 0～255，沒有 alpha 大於 30 的殘留洋紅像素。完整提示詞已追加到 `YORK_CLUE_PUZZLE_UI_IMAGEGEN_PROMPTS.md`。
- 預覽接線：隔離頁改用 V2 主框，重新對齊左側線索、狀態列、上方卡槽、下方 7＋6 牌架及四顆按鈕；移除上方格子的所有可見數字，僅保留無障礙 `aria-label`。卡牌仍完整沿用正式道具牌框、Boss 島圖、A～K 角標及青色菱形，桌機最大卡寬提升至 96px；手機在隱藏圖片底框後仍由 CSS 補上清楚空格邊界。
- 驗證：Playwright 重新通過 1440×900、1024×768、390×844、844×390 五種畫面；各尺寸均為 13 個上方格、13 張下方牌、13 條線索，documentWidth 等於 viewport，console／4xx 錯誤為 0。操作覆蓋下方放入上方、連放五張、鎖位後洗牌、重設、空格錯誤、填入唯一解與成功結果，`ok=true`。正式 Board、道具、掉落、CPU、存檔與同步仍未修改，等待使用者確認後才接入。

#### 約克十三張線索 V2・等比例卡槽與單一待放區 V127

- 日期：2026-08-02。
- 使用者回饋：正式道具牌和上方放牌格的長寬不一致；下方待放區不需要拆成兩框；部分狀態、線索及按鈕文字超出容器。
- ImageGen：先以 V2 為 edit target 產生 V3，完整移除兩個下方框及中央分隔條，合併成一個大型連續待放區；再以 V3 為 edit target 產生 V4，只把上方 13 格縮短約 28～30%，固定為約 0.69 寬高比。V4 保留左側線索、上方狀態、單一待放區、四個按鈕與既有深海黃銅風格。正式預覽引用 `york_clue_puzzle_main_frame_v4_preview.webp`。
- 素材處理：V4 source 為 1672×941 PNG；依實際色鍵 `#de13d6` 使用 imagegen skill 去背 helper、soft matte 40／95 與 despill，產生版本化 Alpha PNG 及 RGBA WebP，未覆蓋 V2／V3 歷史候選。完整兩次 edit prompt 已追加到 `YORK_CLUE_PUZZLE_UI_IMAGEGEN_PROMPTS.md`。
- 版面與操作：HTML 改為單一 `cardBank`／`cardBankDrop`，13 張牌不再切片為 7＋6 或綁兩組事件；桌機下方一列呈現，窄螢幕在同一容器內自動換行。上方已放牌與下方待放牌共用 `min(6.6vw, 11.73vh)` 的平方透明畫布，配合正式牌框實際可見範圍後恰好貼合 V4 槽框；手機兩處同為 82px 畫布。點選、拖放、收回、交換、鎖定、洗牌與重設行為不變。
- 文字修正：線索欄標題、摘要與每條線索縮小間距並允許安全斷行；狀態副文改為可換行，唯一解／嘗試徽章縮成「唯一解」「0 次」並以 `aria-label` 保留完整語意；卡牌標籤、提示與四顆按鈕補齊行高、斷行或 ellipsis 邊界。QA 新增指定文字元素的 `scrollWidth／scrollHeight` 實測。
- 驗證：Playwright 於 1440×900、1024×768、390×844、844×390 五種畫面確認 13 槽、13 牌、13 線索、documentWidth 等於 viewport，所有受測文字元素 `textOverflow=[]`，console／4xx 錯誤為 0；完整放牌、鎖位洗牌、重設、錯誤提示與唯一解成功流程仍為 `ok=true`。正式 Board、道具、掉落、CPU、存檔與同步仍未修改。

#### 約克十三張線索 V2・放牌槽像素對位 V128

- 日期：2026-08-02。
- 根因：V4 圖片肉眼近似 13 格，但 Alpha 水平掃描實際找到 14 個獨立透明槽；HTML 固定產生 13 個格，因此任何平均 grid 都無法和底圖逐格重合。另因正式卡牌透明平方畫布比 grid column 寬，瀏覽器對溢出 grid item 採靠左放置，造成整張牌中心再向右偏約半個超出寬度。
- ImageGen 與素材檢查：先嘗試 `6 + 1 + 6` 重排的 V5，Alpha 掃描只得 12 格，未接入頁面；再回到 V4，只移除最右第 14 格且保留前 13 格座標，產生 V6。以 `#d814cd`、soft matte 40／95 與 despill 去背後，V6 在 y=210／230／250／275／295 五條掃描線都穩定偵測 13 格；中心 X 為 468、551.5、634.5、717.5、800.5、883、966、1049、1132.5、1216、1299、1383、1467px，沒有殘留第 14 格。
- CSS 對位：預覽改用 `york_clue_puzzle_main_frame_v6_preview.webp`；桌機 sequence grid 固定 `left:25.5%`、`top:20.42%`、`width:64.75%`、`height:12.3%`、13 等欄無 gap／padding，直接對應上述槽中心。已放牌另設 `left:50%`、`top:50%`、`translate:-50% -50%`，不再依瀏覽器的超寬 grid item 對齊策略。
- 自動驗證：`scripts/york_clue_puzzle_demo_capture.js` 新增底圖 13 組實測中心與 DOM 卡牌中心差值檢查；1440×900 連放前五張後最大水平誤差由 12.152px 降為 0.496px，最大垂直誤差 0.007px，低於 1.5px 門檻。五種尺寸仍是 13 槽／13 牌／13 線索、`textOverflow=[]`、documentWidth 等於 viewport、console／4xx 0，完整互動結果 `ok=true`。正式 Board、道具、CPU、存檔與同步仍未修改。

#### 約克十三張線索 V2・正式主遊戲接入 V129

- 日期：2026-08-02。
- 範圍與檔案：更新 `public/board_game.html`、`public/js/board_game.js`、`public/js/board_items.js`、`public/js/board_york_clue_puzzle.js`、`public/board_york_clue_puzzle_formal_demo.html`；新增 `scripts/york_clue_puzzle_formal_integration_qa.js`，並擴充 `scripts/york_clue_puzzle_qa.js`、`scripts/york_clue_puzzle_demo_capture.js`。同步更新 `docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/POSTGAME_BOSS_RELICS.md` 與本紀錄。
- 正式素材：把使用者確認的 V6 主框、背景、三階解碼器、三難度框、鎖定／解鎖、主要／次要按鈕與結果框升為 `public/images/board/postgame_clue_puzzle_ui/` 下 13 個固定正式 WebP；背景為 1920×1080 RGB，其餘均為 RGBA 且 alpha 範圍 0～255。正式執行頁不引用 `incoming/`，原始圖、歷史候選與 QA 截圖仍保留在收件區。
- 背包與權威驗證：同一玩家持有十三種線索後，可由重要道具背包開啟全螢幕同源 iframe，選簡單／普通／困難並完成十三牌排位。子頁以隨機 channel 回傳答案，父頁用相同 `layoutSeed + playerId + difficulty + york-coordinate-v2` 重建題目再驗證；只有目前本機控制的行動玩家可操作，觀看方不能代開。失敗不降階、不消耗線索，第一次可任選難度，之後只能挑戰更高階，三階不可重複。
- 個人與共用狀態：新增 `players[].yorkDecoderTier`，並登錄 `york_coordinate_decoder_t1`、`york_coordinate_decoder_t2`、`york_coordinate_decoder_t3` 三件不可消耗／交易／販售／裝備、最高只保留一件的關鍵道具。舊存檔的重複、多階或舊欄位會正規化成最高階一件。第一位成功者只揭露一次全房 `postgameWorld.eggheadUnlocked`；其他玩家在世界已揭露後仍可自行升階。CPU 集滿十三種時不開 UI，只自動取得一次二階且不自動三階。完整狀態沿用既有手動存檔與 `BOARD_GAME_STATE` 快照。
- Boss 攜帶物與日蝕：14 件 Boss 攜帶物均建立正式 S 階 item id、圖片及效果參數，並排除於一般戰鬥隨機掉落池；前十三件沒有自行設定尚未確認的掉落率。洛克斯的名刀「日蝕」依每位實際參戰者自己的解碼器階級採 0%／10%／20%／30% 獨立判定，觀看方無判定，同場以既有 `rocksRewardedPlayerIds` 防止重送與重抽，重複戰鬥可再掉落，且不可交易；原核心、25 研究點、私人抽取與外觀框流程不變。日蝕戰鬥掛點已實作每回合第一次骰 5～6 的直接攻擊增傷 25%、無視 20% 防禦，以及每場首次發動使敵方攻擊、特攻各 -1。
- 純邏輯驗證：六支修改／新增 JS 均通過 `node --check`；`node scripts/york_clue_puzzle_qa.js 1000` 驗證 1,000 組種子 × 3 難度共 3,000 題，穩定重產、三難度答案互異、唯一解、答案審計、錨點、深度與日蝕嚴格小於掉落邊界全部通過，最大求解節點 14。
- UI 驗證：bundled Playwright 於 1440×900、1024×768、390×844、844×390 操作三難度選擇、放牌、交換、鎖位洗牌、重設、錯誤與成功頁；所有畫面皆為 13 槽／13 牌／13 線索、`textOverflow=[]`、documentWidth 等於 viewport、console／4xx 0。1440×900 前五張實測最大中心誤差維持水平 0.496px、垂直 0.007px。
- 正式整合驗證：`scripts/york_clue_puzzle_formal_integration_qa.js` 由正式 `board_game.html` 完成 UI 一階，再覆蓋 T1→T2→T3、T1→T3、困難先解、三階禁止重解、錯誤答案、CPU 二階、0%／10%／20%／30% 命中與未命中邊界、同戰防重、重戰再掉、不可交易、日蝕同回合只觸發一次／次回合可再觸發／首次降攻特攻、手動存讀刪、舊異常存檔只留三階，以及真實房間雙視窗快照收斂與觀看方不能開啟解碼；結果 `ok=true`。
- 服務與路徑：沿用當時已在 8787 埠執行的正式 server，未啟動第二份程序；`board_game.html`、排牌頁、三支腳本及 13 個正式素材共 18 個 URL 全部 HTTP 200。兩個 HTML 的 inline script 可編譯，正式執行檔未發現任何 `postgame_clue_puzzle_ui/incoming` 引用。

#### Boss 攜帶物掉落率與路基／日蝕效果調整 V130

- 日期：2026-08-02。
- 使用者定案：史基至綠牛的前十三名 Boss 專屬攜帶物皆為固定 10%；洛克斯的名刀「日蝕」為基礎 10%，約克座標解碼器一階／二階／三階各增加 10%，最終為 20%／30%／40%。覺醒黑焰羽衣改為速度、最大生命各 +30%；名刀「日蝕」改為最多三顆戰鬥骰，不再保留舊版增傷、無視防禦與降攻／特攻效果。
- 掉落結算：新增十三個 Boss key 至正式攜帶物 id 的固定映射。對應 Boss 勝利時，每位實際參戰者各自做 10% 嚴格小於判定；觀看方不判定，`battle.postgameRelicRewardedPlayerIds` 防止同場重送或重抽，重複挑戰以新 battle 再判定。成功道具進既有攜帶物背包、沿用重要道具揭露與任務事件，所有 Boss 攜帶物仍不可交易且不進一般隨機掉落池。
- 效果掛點：黑焰羽衣的最大生命由 `cardMaxHp()` 套用 1.3 倍，速度由 `currentBattleStat()` 套用 1.3 倍；裝備、更換與卸下時按原 HP 比例換算，避免滿血角色裝上後變成表面受傷。日蝕只在戰鬥型被動已成功骰出第二顆時判定第三顆：原第一顆追加門檻為 6／5／4 時，第二顆需 5／3／1 以上；成功後第三顆與前兩顆相加，傷害預估上限同步由 12 擴至 18。
- 戰鬥頁 UI：追加骰事件加入 `extraDiceOrdinal`、`secondDie`、`thirdDie`。第三顆擲骰中、落點及總和畫面分別明示「日蝕・第三顆戰鬥骰」、第二顆觸發門檻與三顆算式，不再誤顯示成兩顆相加。`board_game.html`、`board_battle.html` 及約克排牌頁的相關 script query 已更新為 `20260802-boss-relic-drop-v2`，避免舊快取遮蔽。
- 修改檔案：`public/js/board_items.js`、`public/js/board_york_clue_puzzle.js`、`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`public/board_york_clue_puzzle_formal_demo.html`、`scripts/york_clue_puzzle_qa.js`、`scripts/york_clue_puzzle_formal_integration_qa.js`、`docs/POSTGAME_BOSS_RELICS.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：四支正式 JS 與兩支 QA 腳本通過 `node --check`；`node scripts/york_clue_puzzle_qa.js 1000` 通過 1,000 組種子 × 3 難度及 10%／20%／30%／40% 嚴格邊界。以 `PORT=8831 npm start` 啟動正式 server，環境未設定 `DATABASE_URL`，靜態 Board 頁正常。bundled Playwright 正式整合測試覆蓋十三件 10% 映射、命中／未中、同場防重、洛克斯四階邊界、重戰再掉、不可交易、黑焰羽衣 30% 生命／速度、日蝕 5／3／1 門檻、第三顆戰鬥頁標題／觸發文案／三骰算式、手動存讀刪與 Socket.IO 雙視窗快照收斂，結果 `ok=true`。

#### 約克線索示範頁敘述正式化 V131

- 日期：2026-08-02。
- 使用者回饋與原因：使用者指定 `public/board_york_clue_puzzle_demo.html` 的敘述方式。檢查發現正式 V2 雖然沿用部分句型，題目結構卻把其餘牌都直接連到兩個固定端點，因此容易反覆出現跨越大量牌的「從某號往左／右多格」；原示範頁則以附近已定位牌逐步建立關係，再混入相鄰、左右、間隔、端點與奇偶位置，閱讀較自然。
- 正式修改：`public/js/board_york_clue_puzzle.js` 升為 `york-coordinate-v3-demo-relations`。每題先建立最大距離四格的鄰近關係樹，再逐條嘗試弱化並以回溯解題器確認仍為唯一解；簡單／普通／困難的弱化上限為 4／8／13，最低牌間關係數為 4／7／9。保留原三難度、同局同玩家穩定重開、難度間不同答案、解碼器升階、CPU 二階、蛋頭島顯現與所有掉落率。`public/board_game.html` 與 `public/board_york_clue_puzzle_formal_demo.html` query 更新為 `20260802-york-demo-relations-v3`；`scripts/york_clue_puzzle_qa.js` 改驗鄰近距離、廣義線索與各難度最低關係數。
- 修改檔案：`public/js/board_york_clue_puzzle.js`、`public/board_york_clue_puzzle_formal_demo.html`、`public/board_game.html`、`scripts/york_clue_puzzle_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。
- 純邏輯驗證：`node --check public/js/board_york_clue_puzzle.js` 與 `node --check scripts/york_clue_puzzle_qa.js` 通過；`node scripts/york_clue_puzzle_qa.js 1000` 驗證 1,000 組局種 × 3 難度共 3,000 題，穩定重產、三難度互異、唯一解、最遠關係不超過四格、最低關係數及日蝕 10%／20%／30%／40% 邊界全部通過。簡單／普通／困難觀測最大求解節點分別為 23／167／5,316；現行房間種子建立三難度約耗時 17／49／78ms。
- 正式與畫面驗證：沿用 8787 正式 server 執行 `scripts/york_clue_puzzle_formal_integration_qa.js`，完整 UI、升階、錯誤答案、CPU、十三 Boss／洛克斯掉落、路基／日蝕效果、存讀刪與多人收斂結果 `ok=true`。`scripts/york_clue_puzzle_demo_capture.js` 於 1440×900、1024×768、390×844、844×390 重跑三難度及完整互動，13 槽／13 牌／13 線索、documentWidth、文字 overflow、console／4xx 均通過；卡槽中心最大誤差仍為水平 0.496px、垂直 0.007px。最後重新執行 `npm start`，8787 正常監聽；`board_game.html` 與正式排牌頁均回傳 HTTP 200，且兩頁實際載入 `20260802-york-demo-relations-v3`。未設定 `DATABASE_URL` 時只出現既有 DB 功能停用警告，不影響靜態 Board 頁。

#### 約克解碼成功頁圖文對位修正 V132

- 日期：2026-08-02。
- 使用者回饋：正式成功頁右側三列文字沒有落在結果底圖資訊框，第一列被中央圓盤遮住；解碼器亦偏左上，返回按鈕另疊一張圖片並偏到右側，沒有使用底圖中央既有按鈕框。
- 修正：`public/board_york_clue_puzzle_formal_demo.html` 以 1672×941 素材座標重設解碼器圓盤與三個資料框。右側依底圖由上到下固定為個人升級、世界座標、名刀掉落率；縮小一階名稱字級以維持單行。返回按鈕移入底圖中央框並移除桌機版重複背景圖。980px 以下保留單欄結果頁，補齊三列桌機定位的寬高重設；390px 直向限制為扣除 overlay padding 後的可用寬度，844×390 橫向則允許結果層垂直捲動。
- QA 擴充：`scripts/york_clue_puzzle_demo_capture.js` 新增成功頁素材座標審計、使用者截圖同級的 1912×895 桌機畫面及手機直／橫向完成流程。1440×900 實測解碼器中心誤差為 0.60／0.57 素材像素，三個資料框中心最大誤差為 1.29／0.64，返回框為 7.51／0.32，全部低於 15 像素門檻；1912×895 結果 stage 為 1050×590.625，所有受測文字 `textOverflow=[]`。390×844 結果 stage 為 354×590 且無水平超出；844×390 結果 stage 為 680×590、overlay scrollHeight 626 且可垂直捲動。完整三難度、放牌、交換、鎖位、錯誤與成功流程結果 `ok=true`；正式整合 QA 另重跑升階、CPU、十三 Boss／洛克斯掉落、存讀檔與雙視窗同步，結果同為 `ok=true`。
- 修改檔案：`public/board_york_clue_puzzle_formal_demo.html`、`scripts/york_clue_puzzle_demo_capture.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。沒有修改題目答案、難度、解碼器階級、蛋頭島、Boss 掉落、`gameState`、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。

#### 約克相鄰線索用詞統一 V133

- 日期：2026-08-02。
- 使用者定案：「旁邊」與「緊鄰」在題目中代表相同規則，不應混用兩種詞。正式共用產生器與原始示範頁均統一使用「緊鄰」；無方向線索固定為「我和 X 號牌緊鄰，但線索沒有說左右」，有方向線索固定為「我緊鄰在 X 號牌的左／右側」。移除「就在我旁邊」與「是我的左／右鄰」，但保留原亂數消耗順序，因此同一 V3 種子的答案、線索類型及其他敘述不變。
- 修改檔案：`public/js/board_york_clue_puzzle.js`、`public/board_york_clue_puzzle_demo.html`、`public/board_york_clue_puzzle_formal_demo.html`、`public/board_game.html`、`docs/GAME_RULES.md`、`docs/DEV_WORKFLOW.md`。兩個正式引用 query 更新為 `20260802-york-adjacent-term-v4`；沒有修改解題規則、難度、唯一解、獎勵、存檔或多人同步。
- 驗證：兩支共用／QA JS 通過 `node --check`；100 組種子 × 3 難度共 300 題的穩定重產、唯一解、難度互異、鄰近關係及日蝕掉落邊界結果 `ok=true`。正式產生器與原示範頁搜尋不到「旁邊」、「我的左鄰」或「我的右鄰」；8787 的主遊戲及正式解碼頁均回傳 HTTP 200 且載入新版 query。

#### 約克普通難度座標錨點修正 V134

- 日期：2026-08-02。
- 實玩診斷：直接以只讀 `BOARD_STATE_REQUEST` 檢查使用者房間 B9406；目前玩家伊多（id `726246`）正在解普通題，穩定 layoutSeed 為 `B6330-1781511822483-1xy2kac-1n67ahh-postgame-world-v1`。題目雖有唯一解，但唯一座標被弱化為「偶數格」，其餘全部是關係鏈；使用者確認此難度應歸類為困難。該題唯一答案由左至右為 `3、7、11、6、4、10、2、9、12、13、5、8、1`。
- 分級修正：`public/js/board_york_clue_puzzle.js` 的簡單、普通新增 `minimumAnchors: 1`，不再弱化根座標；困難維持可用端點或奇偶位置取代座標。`validatePuzzle()` 與正式 QA 同步檢查最低錨點數。相同 V3 layoutSeed 的答案不變；B9406 普通題只把第 7 號由「偶數格」改為「我是整列由左數第 2 張」。
- 敘述修正：相差兩格以上的精確方向一律改成「我在 X 號牌左／右邊，中間隔 N 張牌」，不再出現容易把牌數與格數混淆的「往左／右數 N 格」。保留原亂數消耗，因此其他同種題目的答案與線索結構不因文字統一而漂移。原始示範頁同步套用座標錨點與距離用詞規則。
- 修改檔案：`public/js/board_york_clue_puzzle.js`、`public/board_york_clue_puzzle_demo.html`、`public/board_york_clue_puzzle_formal_demo.html`、`public/board_game.html`、`scripts/york_clue_puzzle_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。兩個正式引用 query 更新為 `20260802-york-readable-anchor-v5`。
- 純邏輯驗證：`node --check` 通過共用產生器與 QA；1,000 組種子 × 3 難度共 3,000 題的穩定重產、唯一解、難度互異、鄰近距離、最低關係數、最低錨點數、統一用詞及日蝕邊界全部 `ok=true`。簡單與普通 1,000 題的 `anchorCounts` 均固定為 `[1]`；困難為 `[0,1]`。普通最大求解節點由原 167 降至 33，困難仍可達 5,316。
- UI 與正式整合：Playwright 重跑 1440×900、1024×768、390×844、844×390 的三難度、完整放牌與成功結果，13 槽／13 牌／13 線索、文字 overflow、水平寬度、結果框位及手機捲動全部 `ok=true`。正式整合 QA 另重跑升階、錯誤答案、CPU 二階、十三 Boss／洛克斯掉落、路基／日蝕效果、手動存讀刪與雙視窗同步，結果 `ok=true`。

#### 移動蛋頭島雙段顯現演出 V135

- 日期：2026-08-02。
- 使用者需求：蛋頭島首次出現不應只在全螢幕圖片切換後突然刷新地圖，應像最終之島一樣有能看見實際航路與島嶼誕生的特殊動畫。
- 全螢幕段：`playPostgameEggheadRevealCinematic()` 沿用已核准的約克部署、移動蛋頭島與洛克斯正式圖片，新增十三張正式撲克牌框繞行三階約克座標解碼器、13／13 鎖定、雷達線與座標完成閃光；之後才切換蛋頭島與洛克斯畫面。沒有新增圖片，也沒有以 CSS 方格取代正式牌框、解碼器、背景或角色素材。
- 地圖段：`renderMap()` 只為 `route-postgame-egghead` 的六段連線、五個海格與 `postgame-egghead-island` 加入穩定識別 class；全螢幕段結束後依本局 `eggheadAnchorIslandId` 自動對準真實起點與蛋頭島，依序畫出連線、點亮海格、顯示座標光束與雷達、讓島圖掃描成形，最後以正式洛克斯圖顯示終戰警示。其他十三島與既有拉夫德魯後航線不會跟著重播。
- 操作與相容性：全螢幕段及地圖段皆保留「略過動畫」。正常播放期間維持既有 `resolutionLock`，地圖演出結束或略過後解除；390×844 直向手機可暫時低於一般地圖手動縮放下限，以同時顯示起點、五格航路與終點，演出完成後自動回到一般縮放下限並聚焦蛋頭島。`postgameWorld` schema、`eggheadUnlocked`、錨點選擇、route／island id、存檔欄位、localStorage key、Socket.IO event 與 `BOARD_GAME_STATE` 均未修改。
- 修改檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`；主頁 query 更新為 `20260802-egghead-reveal-cinematic-v1`。QA 輔助腳本與截圖放在 `.codex-runtime/`，不屬正式執行路徑。
- 驗證：`node --check public/js/board_game.js` 通過；既有 8787 `npm start` 服務的 `board_game.html` 回應 HTTP 200。Chrome 實際以 1440×900 及 390×844 跑完整兩段演出：十三張牌全部在 viewport、水平／垂直 document overflow 均為 0；正式地圖各找到 6 段連線、5 個海格、1 座蛋頭島、1 個地圖特效層與 1 個 HUD。手機終點雷達、島圖、洛克斯警示及兩行說明均留在畫面內；演出結束後全螢幕層、HUD、地圖特效皆為 0，`resolutionLock=false`，頁面例外與正式素材 4xx 為 0。

#### CPU 進入戰鬥傷害預覽卡死修正 V136

- 日期：2026-08-03。
- 根因：`computeMoveDamage()` 與 `computeComboHitDamages()` 各殘留一行舊版名刀「日蝕」增傷程式，兩處都直接讀取未宣告的 `eclipseEffect`。CPU 進戰鬥後會先呼叫 `getBattleView()` 評分所有招式，普通攻擊與連擊傷害預覽因此拋出 `ReferenceError`，CPU 自動流程在選招前中斷；玩家戰鬥頁建立招式預覽時也可能遇到同一錯誤。
- 修正：移除兩處無效的舊版日蝕增傷引用；名刀「日蝕」仍完全依 V130 定案，只保留第二顆骰符合 5／3／1 門檻後追加第三顆戰鬥骰。`public/board_game.html` 的正式主程式 query 更新為 `20260803-cpu-battle-preview-fix-v1`，避免瀏覽器沿用舊快取。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/DEV_WORKFLOW.md`。沒有修改角色／道具 id、傷害公式的其他部分、日蝕正式效果、`gameState`、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。
- 驗證：`node --check public/js/board_game.js` 通過，正式執行檔已無 `eclipseEffect` 引用。bundled Playwright 跑完整 `scripts/postgame_boss_mechanics_qa.js`，13 名新 Boss 的戰鬥 view、普通／連擊預覽、機制 UI、正式圖片及桌機／手機版皆完成，結果 `errors=[]`、`failures=[]`。另以 1920×1080 背景 Chrome 建立 CPU 對巴雷特的正式戰鬥：進場時 `canRun=true`、`canAct=true`，四個招式及普通／連擊傷害範圍正常；CPU 隨後自行選擇「橡膠機關槍」，敵方完成擲骰並開始傷害結算，戰鬥紀錄由 5 筆推進至 10 筆，`cpuAuto.lastError` 與頁面例外均為空。

#### 名刀「日蝕」第三骰・去背交接來源圖 V137

- 日期：2026-08-03。
- 使用者定案：第三顆骰必須沿用原正式追加骰的紅金框規格，框內為可疊黑色數字的金色骰面；霸王色霸氣與骰框畫在同一張來源圖，由使用者自行去背後再交回接線。不要武器圖案，也不拆成骰框與獨立特效兩張。
- ImageGen：以 `public/images/board/battle_dice_ui/battle_extra_dice_blank.webp` 的比例、框厚、紅色雕花、古金繩飾與四角寶石為基準；最終版保留核准紅金框與金色中央，外圍依動畫中霸王色碰撞的視覺語言改為粗黑核心、鮮紅／微洋紅邊光、不規則分叉、白熱尖端與破碎壓迫弧，不使用均勻放射太陽紋。
- 圖片交接：來源圖為 `public/images/board/battle_dice_ui/incoming/battle_eclipse_third_dice_haki_combined_source_v1.png`；使用者去背後交回 `public/images/board/battle_dice_ui/incoming/battle_eclipse_third_dice_haki_combined_source_v1-Photoroom.webp`。正式素材已複製為 `public/images/board/battle_dice_ui/battle_eclipse_third_dice.webp`（1254×1254 RGBA WebP，透明區、半透明霸氣邊緣與四角留白正常，外圍特效未遭裁切）。未核准候選集中保留於 `public/images/board/battle_dice_ui/incoming/rejected_20260803/`，不會被正式頁面載入。
- 正式接線：`public/board_battle.html` 新增第三骰專屬 DOM 外觀、定格閃光／舞台震動與三骰合計排列；`public/js/board_battle.js` 依 `extraDiceOrdinal=3` 套用日蝕骰，定格時只觸發一次爆發，總結事件則分別填入第一、第二、第三顆點數。另修正第三骰事件本來同時帶有 `firstDie`／`secondDie` 而被誤當成總結事件、導致第三顆實際點數遭前兩顆合計覆蓋的顯示問題。正式戰鬥腳本快取版本更新為 `20260803-eclipse-third-die-art-v1`。
- 圖文對位（當時版本）：桌機 1600×900 曾把三骰總結做成同列顯示；此呈現已由 V163 依使用者定案取消，正式版改為三顆依序在同一中心取代，最後只顯示文字算式。
- 修改檔案：`public/images/board/battle_dice_ui/battle_eclipse_third_dice.webp`、`public/images/board/battle_dice_ui/incoming/` 交接／候選素材、`public/board_battle.html`、`public/js/board_battle.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。沒有修改第三骰資格與門檻、角色／道具 id、傷害公式、`gameState`、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。
- 驗證：`node --check public/js/board_battle.js` 與 `node --check public/js/board_game.js` 通過；背景 Chrome 實播第三骰事件時實際定格點數為 4、`eclipse-impact` 與既有舞台震動只在定格加入，頁面例外為空。三骰總結事件實播為 6／5／4＝15，三張圖與三個數字皆在可視區內。完整 `scripts/postgame_boss_mechanics_qa.js` 亦再次通過 13 名新 Boss 桌機／手機、機制面板與圖片檢查，結果 `errors=[]`、`failures=[]`。

#### 十三島 Boss 專屬狀態圖示、巴雷特融合與登島掉落預覽 V138

- 日期：2026-08-03。
- 使用者需求：移除十三島 Boss 戰鬥中常駐的大型機制 UI，改成每位 Boss 各自的專屬狀態圖示，點擊才顯示資料；巴雷特開局融合後要把我方六名船員的攜帶物圖吸入六孔並逐件發動效果；Boss 登島介紹須顯示專屬攜帶物、掉落率及可點擊效果說明。
- 正式戰鬥 UI：`public/js/board_battle.js` 把 Boss 專屬機制改成敵方 HUD 狀態圖示入口，平時不渲染常駐資料框；點擊圖示後才顯示目前數值、階段、六孔、節點與正式目標按鈕，圖示、關閉按鈕或 Escape 可收起。`public/board_battle.html` 將舊共用框縮成右上詳細資料浮層，補上手機寬度規則；390×844 實測六個巴雷特孔位全部可見。
- 巴雷特：`public/js/board_game.js` 在六孔建立後排入既有 `openingPassiveVisualQueue` 的 `postgame-bullet-fusion` 事件，攜帶物快照增加船員 portrait、正式效果說明與 effect kind。戰鬥頁以六張臨時船員卡呈現來源，道具圖逐件飛入對應孔位，再顯示名稱與效果。戴彭的九尾幻面另套紫紅提示、舞台震動及狀態訊息；敵方攻擊屬性計算亦正式接入 `force_advantage_attribute`，會克制目前我方上場船員，孔位破壞後失效。
- 登島預覽：`renderEncounterNauticalPanel()` 增加圖片式 `rewardPreview`；十三島 `openPostgameBossModal()` 依既有 `POSTGAME_BOSS_RELIC_ITEM_BY_KEY` 顯示正式攜帶物圖、名稱與固定 10%，點擊後切換為 `board_items.js` 的正式效果。實際瀏覽器登島時抓到並修正一次錯把映射寫成不存在 `POSTGAME_BOSS_RELIC_ITEM_IDS` 的錯誤，避免開戰前情報頁直接中斷。
- ImageGen：使用統一古銅金／黑鋼／青色寶石的海賊 RPG 狀態徽章規格，為史基至綠牛生成 13 張無文字、無人物全身的專屬圖。巴雷特正好六孔、路基正好六節點、洛基正好三朵冰雲；原始 1254×1254 PNG 經瀏覽器高品質縮放成正式 512×512 WebP，總體積約 1.1 MB。正式檔與生成規格位於 `public/images/board/battle/postgame_mechanic_icons/`，本目錄不保留約 35 MB 的原始 PNG。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`public/js/board_battle.js`、`public/board_battle.html`、`scripts/postgame_boss_mechanics_qa.js`、`public/images/board/battle/postgame_mechanic_icons/*.webp`、同目錄提示詞記錄、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式 script query 更新為 `20260803-postgame-boss-icons-v2`。
- 規則與同步邊界：沒有修改 Boss／道具 id、十三件 10% 掉落判定、傷害公式的其他部分、`gameState` 欄位、localStorage key、Socket.IO event、server 欄位或 `BOARD_GAME_STATE` 套用流程。新增內容只存在既有 battle state 機制 view 與開場視覺事件佇列，CPU 不需要操作新圖示。
- 靜態與服務驗證：`node --check public/js/board_game.js`、`node --check public/js/board_battle.js` 通過。正式 8787 listener 已由 PID 9860 執行；另以 `PORT=8840 npm start` 啟動獨立驗證服務，`board_game.html`、`board_battle.html`、新版 `board_game.js` 與巴雷特 WebP 均 HTTP 200，圖片回應為 `image/webp`，驗證後停止 8840 listener。未設定 `DATABASE_URL` 時依既有設計只停用 DB-backed 功能，不影響 Board 靜態頁與本機遊戲。
- 行為與圖片驗證：背景 Chrome 逐一套入 13 種機制 view，全部只有一枚 HUD 圖示、預設詳細框關閉、正式 WebP 解碼為 512×512 且無 runtime error。巴雷特正式建立六孔時確認九尾幻面 `effectKind=force_advantage_attribute`、六件道具與 5600ms 融合事件完整排入；動畫中六張船員卡、六件飛行道具、六孔填入與逐件效果正常。桌機 1600×900 的詳細框、六孔與文字沒有 overflow；手機 390×844 六孔全數顯示。
- 登島版面驗證：以獨立離線 Chrome 解鎖十三島並實際呼叫 `resolveLanding()`，洛基情報頁顯示「鐵雷 Ragnir／掉落率 10%」，點擊後顯示完整冰雲效果；正式道具圖為 1254×1254 且可解碼。1600×900 與 390×844 的主框、道具按鈕、效果文字皆無水平或垂直 overflow。另逐一檢查十三件映射，13/13 道具資料、名稱、效果與圖片均存在並成功解碼；唯一 404 為專案既有 `/favicon.ico`。
- 完整自動回歸：更新 `scripts/postgame_boss_mechanics_qa.js`，先驗證面板預設隱藏，再點擊每名 Boss 的專屬狀態圖示後檢查內容。以 Codex bundled Playwright 重跑 13 場正式戰鬥；13/13 圖示皆為 512×512、面板在 viewport、文字越框 0、破圖 0，史基至綠牛的 13 組既有行為與 7 張階段圖全部通過，桌機及手機結果為 `errors=[]`、`failures=[]`。

#### 十三島 Boss 機制解說與登島情報版面 V139

- 日期：2026-08-03。
- 使用者回饋：Boss 狀態圖示點開後的解釋不清楚；每名 Boss 的特殊機制也應在登島介紹欄先說明，新增文字不能重疊或遮住原掉落資訊與按鈕。
- 單一文案來源：`public/js/board_game.js` 的 13 組 `POSTGAME_BOSS_MECHANIC_META` 補齊正式 `rule` 與 `counter`。史基浮空、泰佐洛黃金化、捷風過熱破甲、雙世界同步、巴雷特六孔、七星劍血祭、複製兵人牆、六式節點、背火、未來視、全隊吸血、冰雲與森林復活均按現有正式判定撰寫；戰鬥 view 與登島頁共用，不另建立第二份容易漂移的說明。
- 戰鬥展開框：`public/board_battle.html`／`public/js/board_battle.js` 將原本只有一句副標題的浮層擴成「機制說明」、「玩家反制」、「目前狀態」三個有色標籤區塊。即時數值、六孔、船員生命、六式節點與可指定目標仍保留；詳細框放大並重新配置圖示、內文、狀態與目標底部空間，桌機與窄版均允許內容換行而不互相壓住。
- 登島介紹：`renderEncounterNauticalPanel()` 新增可選 `mechanicPreview`，十三島 `openPostgameBossModal()` 直接帶入同一份機制名稱、觸發規則與反制。資訊區桌機採左右雙欄，窄版改為單欄可捲動；勝利線索／抽取／離島再戰濃縮到右側，原攜帶物圖、10% 與點擊效果保留在獨立掉落欄。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`public/js/board_battle.js`、`public/board_battle.html`、`scripts/postgame_boss_mechanics_qa.js`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式主頁與戰鬥頁 query 更新為 `20260803-postgame-boss-guide-v3`。
- 相容邊界：沒有修改 Boss／道具 id、掉落率、戰鬥判定、傷害、battle state、`gameState` schema、localStorage key、Socket.IO event、server 欄位或 `BOARD_GAME_STATE` 同步流程；本次只有共用說明資料與顯示版面。
- 驗證：`node --check public/js/board_game.js`、`node --check public/js/board_battle.js` 與 `node --check scripts/postgame_boss_mechanics_qa.js` 通過。以 Codex bundled Playwright 對正式 8787 頁面逐一打開 13 座登島情報及 13 場戰鬥；每名 Boss 的機制／反制文字都存在，登島訊息、掉落欄、按鈕重疊 0，戰鬥詳細框文字越框 0、破圖 0、桌機與 900×600 窄版均在 viewport；既有 13 組規則行為與 7 張階段圖亦全數通過，最終 `errors=[]`、`failures=[]`。另以 `PORT=8840 npm start` 啟動獨立驗證服務，兩個正式 HTML 與兩支新版 JS 均 HTTP 200；確認後停止臨時服務，8840 已釋放。

#### 薩卡血祭值說明白話化 V140

- 日期：2026-08-03。
- 使用者回饋：薩卡的登島／戰鬥機制說明看不懂，原文沒有先交代血祭值如何從我方失血換算。
- 修正：`POSTGAME_BOSS_MECHANIC_META.postgame_saga` 改為直接顯示「我方每實際損失最大 HP 1%，血祭值 +1」，並明示流血跳傷也會增加；25／50／75 階段分別使直接攻擊增傷 15%／30%／50%，75 時融合。反制改為護盾擋傷、使攻擊落空、解除流血，並明說治療只能補 HP、不能降低已累積血祭值。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`public/board_battle.html`、`docs/GAME_RULES.md`、`docs/DEV_WORKFLOW.md`。正式 query 更新為 `20260803-postgame-boss-guide-v4`；沒有修改血祭值公式、增傷、融合判定、Boss id、battle state、存檔或多人同步。
- 驗證：`node --check public/js/board_game.js` 通過；完整十三島 Playwright 回歸再次通過。薩卡的登島規則與反制文字完整存在，`messageDetailOverlap=false`、`detailActionsOverlap=false`、`clippedText=[]`；戰鬥展開框 `textOverflow=[]`、圖片正常，原血祭值 75 融合行為仍通過，總結果 `errors=[]`、`failures=[]`。

#### 薩卡七星劍完全融合動畫 V141

- 日期：2026-08-04。
- 使用者回饋：血祭值到 75 後只切換薩卡圖片與數值，沒有轉換動畫，玩家無法看出「七星劍與薩卡融合」已發生。
- 權威事件：`public/js/board_game.js` 在 `postgameBossMechanicGainSagaBlood()` 首次跨過 75 時，將 `postgame-saga-fusion` 事件排入既有 `openingPassiveVisualQueue`。事件帶入融合前战鬥圖、最終形態圖、正式七星劍道具圖、三階段文案與 6200ms 時長；直接攻擊觸發時在當次攻擊演出後立即播放，流血跳傷觸發則沿用原回合開始排程。
- 正式戰鬥演出：`public/board_battle.html` 與 `public/js/board_battle.js` 新增紅月／綠色妖氣全屏層。演出先顯示「血祭值 75／75／七星劍吸滿鮮血」，再讓實際 `saga_seven_star_sword.webp` 飛入薩卡身體並縮小消失，最後以衝擊波切換 `fused_normal.webp`，明示「完全融合・最終形態／直接攻擊傷害 +50%」。窄畫面的演出層固定貼齊視窗，不再被戰鬥舞台 1024px 最小寬度拉出畫面。
- 素材與邊界：重用 `images/board/battle/enemies/postgame_saga/normal.webp`、`fused_normal.webp` 及 `images/board/items/postgame_boss_relics/saga_seven_star_sword.webp`，沒有產生新圖或改動素材目錄。沒有改 Boss／道具 id、血祭公式、增傷、battle state，也沒有新增 `gameState` schema、localStorage key、Socket.IO event、server 欄位或 `BOARD_GAME_STATE` 套用邏輯。正式主頁與戰鬥頁 query 更新為 `20260804-saga-fusion-animation-v2`。
- 自動驗證：`node --check public/js/board_game.js`、`node --check public/js/board_battle.js` 及 `node --check scripts/postgame_boss_mechanics_qa.js` 通過。`postgame_boss_mechanics_qa.js` 新增真正融合事件驗證，在 1600×900 與 900×600 觸發血祭 75／75；兩種畫面的七星劍吸收階段透明度均為 1、最終形態均顯現、三張圖均解碼，文字溢出 0、畫面越界 0、`errors=[]`、`failures=[]`，原 13 組 Boss 行為亦全數通過。另以 `PORT=8840 npm start` 啟動獨立驗證服務，兩個正式 HTML、兩支 JS、薩卡融合前／後圖與七星劍圖均 HTTP 200；確認後停止臨時服務，8840 已釋放。

#### 共鬥玩家戰鬥視角切換 V142

- 日期：2026-08-04。
- 使用者定案：共鬥切換入口放在玩家 HUD 右側下緣；點某位參戰者後，仍留在同一個正式戰鬥頁，但畫面改接該玩家的戰鬥狀態，方便查看上場角色、HP、狀態與攜帶物。
- 畫面：`public/board_battle.html` 新增圖片式下掛分頁、玩家頭像、目前角色小圖、1／N 計數及展開清單。真正操作方以金色脈動框標示；清單顯示操作中、觀看中、自己、待命、倒下或撤離。分頁位置橫跨使用者指定的玩家 HUD 右側下緣，選單向下展開，不占用原狀態列。
- 行為：`public/js/board_battle.js` 只在本頁記憶體保存 `selectedCoopViewPlayerId`；每次刷新向主頁要求指定參戰者 view。`public/js/board_game.js` 的 `getBattleView({ coopViewPlayerId })` 會暫時套用該參戰者 runtime 建立畫面，並保留真正 `battle.playerId`／目前操作玩家。觀看非操作方時 `canControl=false`、右側指令盤隱藏並顯示「目前由誰操作」；點回目前操作方後仍須通過原 LAN 身分判斷。
- 素材：使用 Codex 內建 ImageGen，參考正式 `battle_hud_player_frame.webp` 與 `battle_command_choice_button_frame.webp`，生成深藍黑鋼、古金細框、青色寶石與下掛缺口的透明分頁。正式檔為 `public/images/board/battle_coop_ui/coop_view_switch_tab_frame.webp`（1024×210 RGBA）；來源、去背中繼與完整提示詞保存在同目錄及 `incoming/`，執行期只引用正式 WebP。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`public/images/board/battle_coop_ui/**`、`scripts/coop_battle_view_switch_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式 query 為 `20260804-coop-view-switch-v1`。
- 同步邊界：沒有新增或改名 `gameState`／`battleState` 欄位、localStorage key、Socket.IO event 或 server 欄位；視角切換不送指令、不算換人或回合，也不變更真正操作玩家。明確要求指定參戰者 view 時，建立 view 過程中暫時套用的玩家 active index 會在返回前還原。
- 驗證：`node --check` 通過 `board_game.js`、`board_battle.js` 與新 QA。`scripts/coop_battle_view_switch_qa.js` 於三人共鬥實測 1600×900／900×600：三名頭像與角色圖正常、操作方金框正確、點隊友後 HUD 切為其角色且 `canControl=false`、右側指令盤鎖定、點回操作方恢復、`battle.playerId` 讀取前後一致，文字溢出／破圖／頁面例外／4xx 均為空。另重跑 `scripts/postgame_boss_mechanics_qa.js`，13 名 Boss 登島、圖示、七張階段圖、機制行為及薩卡融合全部 `errors=[]`、`failures=[]`。最後以 `PORT=8840 npm start` 啟動獨立正式服務，兩個 HTML、兩支 JS 與新 WebP 均 HTTP 200；確認後停止服務並驗證 8840 已釋放。

#### 共鬥視角交棒自動跟隨與分頁避讓 V143

- 日期：2026-08-04。
- 使用者修正：共鬥分頁與 HUD／中央屬性圖示有些重疊；而且手動觀看其他隊友不能阻止正常交棒，輪到誰出手時所有參戰者都必須自動切到那名玩家的畫面。只有輪到自己且本機身分持有控制權才能操作。
- 分頁避讓：正式分頁縮為 HUD 右下緣的緊湊頭像標籤，向左收進攜帶物資訊與中央屬性圖示之間的安全空隙；保留展開後完整的三至四人姓名、玩家頭像、上場角色小圖與狀態。1600×900／900×600 均實測不與 `#playerHudMeta .pill` 或 `#attributeMatchupChip` 相交。
- 自動跟隨：`board_battle.js` 記住上一位 `coopInfo.currentPlayerId`；偵測正式交棒後立即覆蓋手動觀看選擇、關閉展開清單，並重新取得新操作玩家的 runtime view。手動查看隊友仍可在同一位操作玩家的行動期間使用。分頁只在 `coopInfo.participants` 中存在 `isLocalViewer` 時顯示，非參戰觀看者不顯示。
- 控制權：畫面跟到新操作玩家不代表取得操作權；`getBattleView()` 仍同時要求 viewed player 等於真正 command player，並通過原 `canBoardLanControlPlayerIdentity()`，否則 `canControl=false`、指令盤鎖定。本次不修改共鬥交棒、回合、`battle.playerId`、`gameState`、localStorage key、Socket.IO event、server 欄位或完整快照格式。
- 修改檔案：`public/board_battle.html`、`public/js/board_battle.js`、`public/js/board_game.js`、`public/board_game.html`、`scripts/coop_battle_view_switch_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式 query 更新為 `20260804-coop-view-auto-follow-v2`。
- 驗證：三人共鬥 QA 先手動觀看第二名玩家，再把真正 command player 交棒給第三名；畫面、HUD、選取 id 與 command id 均自動變成第三名，選單自動關閉，之後交回第一名亦正常。桌機與 900×600 的 HUD 資訊重疊、中央屬性圖示重疊、文字溢出、破圖、頁面例外與 4xx 全為空，`battle.playerId` 在純觀看讀取前後保持一致；另切成未參戰的第四名觀看者時，分頁確認自動隱藏。最後以 `PORT=8840 npm start` 啟動獨立服務，兩個正式 HTML 與兩支新版 JS 均 HTTP 200，驗證後停止服務並釋放埠。

#### 共鬥跨玩家道具、兩回合待救援與個人戰績 V144

- 日期：2026-08-04。
- 使用者定案：技能只能作用於自己的船員；共鬥玩家可消耗自己的完整行動與自己的戰鬥道具，支援另一名參戰者。單體補血、解異常、技能次數回復與復活可指定任一共鬥玩家的船員；全隊治療先指定一名玩家，只治療該玩家的整隊。
- 待救援：一名參戰者全隊瀕死時不再立即送進推進城，而是進入 `待救援：2回合`。次數只在該名倒下玩家自己的待救援回合選擇等待時扣除；可在自己的待救援回合消耗復活道具自救，其他玩家也可在自己的行動中消耗復活道具救援。第二次自己的回合仍未復活時，只有該玩家永久退出本場共鬥；其他存活者繼續。若全場都倒下且任何待救援者都沒有可自救的復活道具，立即判敗。
- 回合與同步：沿用既有 `battle.coop.runtimes`、完整 battle snapshot 與 `BOARD_GAME_STATE`，runtime 增加 transient `awaitingRescue`／`rescueTurnsRemaining`；共鬥交棒會把待救援者排入正常玩家順序，round-pause 會替待救援者保留 `pendingBattle`，地圖全滅檢查不會把仍在有效待救援中的玩家提早送走。CPU 會優先用自己的復活道具自救，否則結束本次待救援回合。
- 戰鬥 UI：`board_battle.html`／`board_battle.js` 增加圖片式待救援面板、自救目標、等待按鈕、共鬥道具玩家／船員分組選擇與全隊治療玩家選擇；共鬥頭像會顯示剩餘待救援回合。一般共鬥與司法島結果都用同一種玩家卡列出傷害、承傷、治療、行動、道具、救援與個人獎勵；一般共鬥敵方 HUD 亦顯示參戰與待救援人數。
- 血統抽取等待：完成、失敗或無抽取器後，若仍有共鬥玩家尚未結束抽取，按鈕改為「查看共鬥等待狀態」，並用現有抽取器圖片框逐一顯示玩家頭像、等待／抽取中／成功／失敗／放棄狀態；所有人完成後才恢復原結算按鈕。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`public/js/board_lineage_extraction.js`、`public/css/board_lineage_extraction.css`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式 query 更新為 `20260804-coop-rescue-support-v1`；未新增 localStorage key、Socket.IO event 或 server 欄位。
- 驗證：三支 JS 均通過 `node --check`。正式 8787 服務已在執行，`board_battle.html` HTTP 200 且載入新版 query；另執行 `npm start` 時正確回報 8787 已被現有服務占用。背景 Chrome 正式邏輯測試中，玩家一消耗自己的「奇蹟帶骨肉」救回玩家二，玩家二 HP 0→51、待救援 2→0，玩家一庫存 -1，貢獻為治療 51／道具 1／救援 1；兩次等待則實測 2→1→0，第二次後該 runtime `defeated=true` 而存活玩家仍可繼續。1920×1080 待救援、1180×820 共鬥道具與結算、1180×820 血統抽取等待均無頁面例外、水平溢出或卡片文字裁切。

#### 共鬥戰鬥頁窄版置中與文字對齊 V145

- 日期：2026-08-05。
- 修正範圍：共鬥「全隊」道具目標的畫面文字與無障礙標籤都移除重複的玩家名稱；待救援道具主標允許換行並將「立即復活」說明獨立放入副標區，縮短待救援提示，避免桌機、平板及手機裁字。
- 窄版畫布：`public/board_battle.html` 增加 `battle-viewport` 外層，`public/js/board_battle.js` 以 1024×576 邏輯畫布依 `visualViewport` 等比例縮放、水平與垂直置中。手機橫向可完整看見上下 HUD、待救援與結果面板；平板直向顯示完整置中的戰鬥畫布；600px 以下手機直向使用既有圖片框顯示「請將裝置橫向」，不再只露左側或把整頁縮成不可讀尺寸。
- 血統等待：正式抽取控制器偵測戰鬥頁的新 viewport 後不再重複縮放舞台；平板直向等待名單改為兩欄、固定框內高度與內部捲動，四名參戰者仍可完整查看，返回按鈕不被卡片壓住。
- 修改檔案：`public/board_battle.html`、`public/js/board_battle.js`、`public/js/board_lineage_extraction.js`、`public/css/board_lineage_extraction.css`、`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式 query 更新為 `20260805-coop-responsive-fix-v1`。
- 同步邊界：只改戰鬥 iframe 的前端縮放、排版與顯示字串；沒有新增或改名 `gameState`／`battleState` 欄位、localStorage key、Socket.IO event、server 欄位或 `BOARD_GAME_STATE` 套用流程。
- 驗證：`node --check` 通過 `board_game.js`、`board_battle.js`、`board_lineage_extraction.js`。以獨立 8840 正式服務檢查桌機 1920×1080、平板橫向 1180×820、平板直向 820×1180、手機橫向 932×430、手機直向 430×932，共 20 組待救援、四人道具目標、四人戰績與四人血統等待畫面；圖片破損、圖文越框、頁面例外與水平溢出均為 0。最後再針對平板橫／直待救援、手機橫向待救援及平板直向血統等待複查，四組 `issues=[]`。

#### 十三座 Boss 島不鎖來路 V146

- 日期：2026-08-05。
- 使用者定案：一般島嶼維持「有其他出口時不能立刻走回來路」；十三座無風帶 Boss 島不鎖來路，讓玩家打完或暫不挑戰後可以原路離島，再重新登島刷 Boss。
- 實作：`getAvailableRoutes()` 在套用 `entryDirection` 的一般來路排除前，先判斷目前是否為 `postgame_boss` 島；Boss 島直接保留全部硬性可通行航線，仍會遵守最終島解鎖、顛倒山、唯一分支及強制撤退等既有硬限制。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。主頁 query 更新為 `20260805-postgame-boss-return-route-v1`。
- 同步邊界：沒有新增或改名 `gameState`／玩家／航線欄位、localStorage key、Socket.IO event 或 server 欄位；只改現有地圖資料的可選航線計算，CPU 與真人共用同一結果。
- 驗證：`node --check public/js/board_game.js` 通過。以獨立 8840 正式服務和 bundled Playwright 建立拉夫德魯後地圖，逐一對 13 座 Boss 島的每條相連航線模擬由該方向登島；13 座全部保留來路，且一般島 `island-1` 的既有來路排除仍成立，頁面例外為 0。

#### 無風帶開啟後四皇島不鎖來路 V147

- 日期：2026-08-05。
- 使用者定案：十三座無風帶 Boss 島開啟後，四座四皇島也不鎖剛才走來的航線；開啟前仍沿用一般島嶼的回頭路限制。
- 實作：`getAvailableRoutes()` 的來路保留條件擴充為 `postgame_boss`，或 `postgameWorld.unlocked` 已成立且目前島種為 `yonko`。最終島解鎖、顛倒山、唯一分支及強制撤退等硬限制維持原判斷順序。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。主頁 query 更新為 `20260805-postgame-boss-yonko-return-route-v2`。
- 同步邊界：沒有新增或改名狀態欄位、localStorage key、Socket.IO event、server 欄位或航線資料；只依既有 `postgameWorld.unlocked` 決定可選航線。
- 驗證：`node --check public/js/board_game.js` 通過。獨立 8840 正式服務與 bundled Playwright 實測解鎖前仍有四皇島套用一般來路限制；解鎖後 4 座四皇島的所有相連航線都保留來路，13 座無風帶 Boss 島仍全部保留來路，普通島仍能排除剛才進島的航線，頁面例外為 0。

#### 多人戰鬥結算五列專用卡 V148

- 日期：2026-08-05。
- 使用者回饋：多人戰鬥結算的玩家名稱與四列戰績，和原本背景底圖的表格分區不一致；需要判斷重新排版或製作新圖。
- 判斷與素材：原結算誤用 `battle_command_choice_button_frame.webp`，該圖是超寬兩區戰鬥指令按鈕，無法對應五組內容，因此使用 Codex 內建 ImageGen，參考原黑鋼／古金／深海藍／青色寶石材質，生成正面、無文字、第一列名稱加四列內容的專用五列表格。洋紅色鍵來源保存於 `public/images/board/battle_result_ui/incoming/`，經 `remove_chroma_key.py --edge-contract 1 --force` 轉為 1536×1024 RGBA WebP；完整提示詞記在 `BATTLE_RESULT_PLAYER_CARD_PROMPT.md`。
- 顯示接入：`battleResultRewardEntries()` 只把一般共鬥與司法島參戰者標記為 performance card；`renderResult()` 對這些卡使用新底圖與 `is-performance`。CSS 依底圖內框切成五個等高 grid rows，名稱及四筆正式 battle view 文字逐列置中、禁止換行並在極端長字串時於格內省略。非共鬥單人獎勵仍使用原四張指令按鈕底圖。
- 修改檔案：`public/js/board_battle.js`、`public/board_battle.html`、`public/js/board_game.js`、`public/board_game.html`、`public/images/board/battle_result_ui/**`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式主頁與戰鬥頁 query 更新為 `20260805-battle-result-card-table-v1`。
- 同步邊界：沒有修改傷害、獎勵、抽取、回合、`gameState`／`battleState` 欄位、localStorage key、Socket.IO event、server 欄位或 `BOARD_GAME_STATE`；本次只更換多人結算的前端底圖與文字定位。
- 驗證：`node --check public/js/board_game.js` 與 `node --check public/js/board_battle.js` 通過。以獨立 8841 正式服務和 bundled Playwright 建立四人共鬥勝利，使用長玩家名稱、六位數傷害、八位數懸賞與長道具名稱檢查 1600×900、1180×820、932×430；四張卡都載入新 WebP，五列等高置中，文字／圖片越框、破圖、頁面例外均為 0。另確認 WebP 為 1536×1024 RGBA，沒有殘留可見洋紅色鍵像素。

#### 十三名 Boss 專屬敵框與 CPU 四皇框修正 V149

- 日期：2026-08-05。
- 使用者需求：參考已完成的四皇外觀框，為十三名無風帶 Boss 設計符合角色特徵的正式敵方框；同時檢查觀看 CPU 挑戰四皇時四皇沒有套框的問題。
- 四皇修正：既有四套四皇素材與 `COSMETIC_FRAME_CONFIGS` 都正常，實際缺口是 `board_game.js` 的 `ENEMY_COSMETIC_FRAME_BY_KEY` 沒有 `yonko_blackbeard`、`yonko_shanks`、`yonko_bigmom`、`yonko_kaido`。補上四組 key 與中文名 fallback 後，`getBattleView()` 對真人、CPU 與觀看方都送出同一個敵框 ID。
- Boss 素材：使用 Codex 內建 ImageGen，以四皇 `frame.webp` 作風格／構圖參考，生成史基至綠牛十三張正面方形框；每張只在邊緣放入浮空劍氣、黃金賭場、黑腕機械、魔王樂譜、六孔合體、七星劍、傑爾馬科技、覺醒黑焰、露娜利亞火翼、糯糯未來視、赤色伯爵、冰雷巨人或森森根蔓等特徵，中央保留半身圖。原始色鍵 PNG 保存於各 `incoming/`，正式 1254×1254 RGBA WebP 經 `remove_chroma_key.py` 柔邊、去色溢處理；完整提示詞與工具模式保存於 `POSTGAME_BOSS_FRAME_PROMPTS.md`。
- 正式接入：`board_game.js` 新增十三組 Boss key／中文名到 frame ID 映射；`board_battle.js` 新增十三個單層敵框設定，統一置中 113% 並隱藏普通紅框。沒有新增 `gameState`／`battleState` 欄位、localStorage key、Socket.IO event、server 欄位或玩家解鎖項目；正式 query 更新為 `20260805-postgame-boss-enemy-frames-v1`。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`public/images/board/battle/enemy_frames/postgame_*/**`、`public/images/board/battle/enemy_frames/POSTGAME_BOSS_FRAME_PROMPTS.md`、`scripts/boss_enemy_frames_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check` 通過 `board_game.js`、`board_battle.js` 與 `boss_enemy_frames_qa.js`。以獨立 8841 正式服務和 bundled Playwright 逐一開啟十三名 Boss；每場 expected／prepared／實際圖層 frame ID 一致、各一層、破圖 0、名稱越框 0，半身圖均以 `cover` 載入。四名四皇逐一把戰鬥玩家標記為 CPU 後，黑鬍子、紅髮、大媽、凱多各載入正確四層框，破圖與名稱越框均為 0。1600×900 與 932×430 卡塔庫栗窄版均通過，最終 `errors=[]`；十三框聯覽與 CPU 凱多完整畫面另存於本次 QA 輸出目錄。檢查完成後已停止臨時服務並釋放 8841。

#### 敵方凱多框中央雷雲遮擋修正 V150

- 日期：2026-08-05。
- 使用者回饋：CPU 凱多正式戰鬥畫面中央紫黑配件太深，遮住凱多的臉與上半身；既有四皇凱多框曾依使用者提供的參數核准，不能直接改壞玩家獎勵框。
- 實作：保留 `yonkoKaido` 玩家外觀框原始四層參數，新增僅供敵方凱多使用的 `enemyYonkoKaido`。狼牙棒、龍鱗裂痕與外框完全沿用原位置，只將覆蓋中央的 `aura.webp` 從 opacity 1／strength 2 改為 opacity 0.2／strength 0.65；主遊戲敵人 key 與中文名 fallback 改送敵方專用 ID，玩家首勝解鎖與裝備 ID 仍是 `yonkoKaido`。
- 回歸保護：`scripts/boss_enemy_frames_qa.js` 記錄每一層實際 opacity／blend，並要求 CPU 凱多 aura 不透明度不得高於 25%，避免日後再次把中央特效恢復成全濃度。
- 修改檔案：`public/js/board_battle.js`、`public/js/board_game.js`、`public/board_battle.html`、`public/board_game.html`、`scripts/boss_enemy_frames_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式 query 更新為 `20260805-kaido-enemy-frame-clear-center-v1`。
- 同步邊界：只調整 battle view 既有 `cosmeticFrameId` 的顯示值與戰鬥頁圖層參數；沒有新增或改名 `gameState`／`battleState` 欄位、localStorage key、Socket.IO event、server 欄位，也不改 Boss 數值、回合、掉落或玩家外觀框解鎖。
- 驗證：`node --check` 通過 `board_game.js`、`board_battle.js` 與 `boss_enemy_frames_qa.js`。以獨立 8841 正式服務和 bundled Playwright 重跑十三名 Boss、CPU 四皇與 932×430；凱多 expected／prepared／實際 ID 均為 `enemyYonkoKaido`、四層完整、破圖 0、名稱越框 0、aura opacity 0.2，整體 `errors=[]`。CPU 凱多 1600×900 完整畫面確認臉、胸腹與角均可清楚辨識。

#### 巴雷特取消全身六孔人物圖 V151

- 日期：2026-08-05。
- 使用者定案：巴雷特不要再使用全身洞孔融合圖，正式戰鬥人物主卡改回一般巴雷特戰鬥圖；六孔吸收規則與狀態 UI 保留。
- 實作：移除建立六孔時將 `normal`／`idle`／`morale` 改成 `fusion_normal.webp` 的覆寫。`applyPostgameBossMechanicPortrait()` 對巴雷特固定回填 `postgame_douglas_bullet/normal.webp` 與一般 morale，除了新戰鬥外，也會修正已保存舊融合路徑的戰鬥快照。開場六件道具飛入、逐件效果、專屬六孔圖示、展開資料與骰點破甲均未修改。
- 回歸保護：`scripts/postgame_boss_mechanics_qa.js` 現在同時檢查正式敵卡實際圖片 URL、正規化後 portrait 與破壞一號孔位行為，禁止 `fusion_normal.webp` 再次成為巴雷特主卡；另輸出詳細框收起後的完整一般半身圖畫面。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/postgame_boss_mechanics_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/DEV_WORKFLOW.md`。正式 query 更新為 `20260805-bullet-normal-battle-portrait-v1`。
- 同步邊界：沒有新增或改名 `gameState`／`battleState` 欄位、localStorage key、Socket.IO event 或 server 欄位；只使用既有 `battlePortraits` 欄位回填正式一般圖，不改六孔狀態、攜帶物效果、回合、傷害或掉落。
- 驗證：`node --check` 通過 `board_game.js`、`board_battle.js` 與 `postgame_boss_mechanics_qa.js`。以獨立 8841 正式服務和 bundled Playwright 重跑十三名 Boss 的登島介紹、正式戰鬥 UI、機制行為及 900×600；巴雷特正式敵卡與正規化 portrait 均為 `postgame_douglas_bullet/normal.webp`、`fusion_normal` 未出現在人物主卡，六孔骰 1 破壞仍通過，總結果 `errors=[]`、`failures=[]`。

#### 巴雷特兔耳殘骸超級融合徽章與六孔明細 V152

- 日期：2026-08-05。
- 使用者參考：使用者補充《Stampede》超級融合截圖，並確認輪廓應接近兩根直立兔耳、帶有《夏日大作戰》巨大魔王般的壓迫感；敵方人物主卡仍維持 V151 的一般巴雷特半身圖。
- 圖片：使用 Codex 內建 ImageGen，以前一版生成圖加四張電影截圖進行 `precise-object-edit`，將超級融合改成黑色艦船／建築殘骸巨人、兩根長直平行兔耳狀頭角、堡壘面孔、兩顆紅眼與兩臂。底圖不畫六孔、骰子或道具，改由執行期 UI 疊入，避免破壞狀態與固定圖片衝突。原始 PNG 存入 `postgame_mechanic_icons/incoming/`，正式輸出為 512×512 `postgame_douglas_bullet_super_fusion_v2.webp`，完整提示詞記於同目錄 markdown。
- 顯示：巴雷特狀態圖示擴為 44px，底圖使用新版超級融合，動態顯示六件攜帶物縮圖、骰點 1～6 與已破壞叉號。點擊後使用較大的圖片式共用框，以兩欄六張卡顯示骰點、頭部／胸部／左右手／左右腳、道具圖片、名稱、效果及「接管中／已破壞・效果已歸還／空孔位」；破壞卡使用紅色條紋、灰階道具與大叉號。900×600 窄版仍留在可視區，600px 以下則單欄框內捲動。
- 測試工具：`scripts/postgame_boss_mechanics_qa.js` 在巴雷特回歸時固定準備六名船員與六件不同攜帶物，將第三孔標為已破壞，檢查新圖 URL、六個小孔、六張明細、骰點順序、部位名稱、圖片、效果及破壞／接管狀態；另輸出桌機、窄版與一般人物主卡截圖。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/postgame_boss_mechanics_qa.js`、`public/images/board/battle/postgame_mechanic_icons/**`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式 query 更新為 `20260805-bullet-slot-details-super-fusion-v2`。
- 同步邊界：沒有新增或改名 `gameState`／`battleState` 欄位、localStorage key、Socket.IO event、server 欄位或完整快照格式；只讀取既有 `postgameBossMechanic.slots` 並更新戰鬥頁呈現，攜帶物接管、破壞、歸還、回合、傷害與掉落規則未改。
- 驗證：`node --check` 通過 `board_game.js`、`board_battle.js` 與 QA 腳本；`git diff --check` 通過。以獨立 8841 正式服務重跑 13 座登島情報、13 場戰鬥 UI／行為、薩卡融合與 900×600；巴雷特新版圖為 512×512、六件道具圖片完整、骰 1～6／六部位順序正確、第三孔明確顯示已破壞，其餘顯示接管中，桌機與窄版皆無文字溢出、破圖或面板越界，總結果 `errors=[]`、`failures=[]`。

#### 巴雷特重複攜帶物完整接管與極限傷害 V153

- 日期：2026-08-05。
- 使用者需求：修正巴雷特吸收六名船員攜帶物後的效果，允許六名船員裝備重複道具，並實際找出與截圖驗證最大單次傷害。
- 規則修正：六孔改為每孔獨立執行同名道具；重複數值效果逐件相乘，機率與一次性效果逐孔判定。補齊衝擊貝／排擊貝、海樓石子彈、炎貝只處理第一件的缺口；小型護盾改用分孔 HP 池；劇毒黑泥改回回合治療；黑焰羽衣正確疊加最大 HP；十四件 Boss 掉落道具的黃金、熱量、裝甲、血量、致命保護、背火、反擊、吸血、冰雲、種子與第三顆骰路徑均沿用正式效果。單孔破壞會保留並返還該孔剩餘資源，不影響其他同名孔位。
- UI：`board_game.js` 將各孔目前護盾、熱量、黃金、背火、冰雲、種子、大型子彈號裝甲人數與七星劍目前增傷送入 view；`board_battle.js` 接在「接管中」後顯示。正式主頁與戰鬥頁 query 更新為 `20260805-bullet-repeat-items-max-damage-v1`。
- 極限配裝：新增 `scripts/bullet_absorbed_items_qa.js`，同一 Lv.99 羅傑目標、`Ultimate Faust`、骰 6 下比較八種六件同名配裝。六件 Battle Smasher 全過熱以約 ×7.5295 增傷及 73.7856% 合併破防造成 3283，為本測試可重現條件峰值；六個瞄準鏡六次暴擊全中造成 3554，為機率 `0.1^6 = 0.000001` 的絕對理論峰值；六把三冰雲 Ragnir 造成 2900；六顆生命燃燒寶珠首擊造成 1506。正式截圖輸出為 `bullet_stable_max_damage.png` 與 `bullet_absolute_max_damage.png`，兩張都同時顯示傷害與六孔資料。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/bullet_absorbed_items_qa.js`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 同步邊界：未新增或改名 `gameState`／`battleState` 欄位、localStorage key、Socket.IO event 或 server 欄位；沿用既有 `postgameBossMechanic.slots[].triggered` 物件保存分孔狀態，舊快照正規化時自動補空物件與動態資源。
- 驗證：`node --check` 通過 `board_game.js`、`board_battle.js` 與新 QA。新 QA 的八組重複增傷倍率、六份黑泥治療、六個小型護盾池、六件黑焰最大 HP、六顆海樓石子彈及六份 Ragnir 獨立狀態全部通過；兩張 1600×900 截圖均為六槽、破圖 0、文字溢出 0。另重跑 `scripts/postgame_boss_mechanics_qa.js`，13 座登島、13 場戰鬥、七張階段圖、13 組行為與 900×600 全部通過，最終 `errors=[]`、`failures=[]`。使用 `PORT=8842 npm start` 確認正式啟動成功後停止臨時服務並釋放埠；8841 驗證服務上的兩個 HTML 與兩支新版 JS 均為 HTTP 200。

#### 伽治傑爾馬 66 複製兵圖片人牆 V154

- 日期：2026-08-05。
- 使用者需求：伽治的三名複製兵不能只靠狀態數字或網頁格子表示，需要依提供的傑爾馬 66 士兵動畫參考圖製作真正擋在伽治前方的人牆。
- 圖片：使用 Codex 內建 ImageGen 生成一名交叉雙臂防守的量產複製兵，固定白色全罩頭盔、黑色圓形護目鏡／耳機、黃色圍巾、白色護肩、深藍制服、橘色 66、金色圓扣、白手套／靴與背槍。原始 1023×1537 洋紅色 PNG 保存在 `public/images/board/battle/postgame_mechanic_effects/judge_clone_guard/incoming/`；經 `remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 10 --opaque-threshold 110 --edge-contract 1 --despill` 輸出同尺寸 RGBA `judge_clone_guard.webp`，完整提示詞另存同目錄 markdown。
- 正式呈現：`board_battle.html` 在伽治敵方 portrait 內新增透明人牆層；`board_battle.js` 只讀既有 view 的 `state.clones`，依 3／2／1 排成三種置中防線。首次開戰與每三次行動補兵會由下方部署；人牆被指定消滅或高骰貫穿時，前一隊形的一名士兵會閃光、後退並破碎消失；0 名後整層隱藏。正式 query 更新為 `20260805-judge-clone-guard-v1`。
- 規則與同步邊界：沒有修改 `board_game.js` 的複製兵阻擋、30% 傷害穿透、高骰完整貫穿、生產進度、CPU 目標或戰鬥紀錄；也沒有新增或改名 `gameState`／`battleState` 欄位、localStorage key、Socket.IO event、server 欄位或 `BOARD_GAME_STATE` 套用流程。
- 修改檔案：`public/board_battle.html`、`public/js/board_battle.js`、`public/images/board/battle/postgame_mechanic_effects/judge_clone_guard/**`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check public/js/board_battle.js` 與指定檔案的 `git diff --check` 通過；透明圖為 1023×1537 RGBA，四角 alpha 均為 0。bundled Playwright 在正式 8787 頁面依序切換 3／2／1／0 名，數量、圖片解碼、框內邊界、啟用／隱藏 class 與一名破壞中的士兵均符合預期，`errors=[]`、`failures=[]`；1600×900 與 932×430 截圖確認三名士兵完整留在伽治敵卡及專屬外框內，沒有拉伸、越框或遮住戰鬥指令文字。另以 `PORT=8843 npm start` 啟動正式服務，戰鬥頁、JS 與新 WebP 均為 HTTP 200；驗證後停止測試 node 行程並確認 8843 已釋放。

#### 新世界香吉士隱形黑戰鬥服變身 V155

- 日期：2026-08-05。
- 使用者需求：新世界香吉士裝備伽治掉落的傑爾馬66戰鬥服後，進入正式戰鬥要播放變身；七張戰鬥圖、技能、被動與數值都要改成隱形黑，未裝備時不得影響原角色。
- 圖片：依使用者提供的隱形黑動畫參考，使用 Codex 內建 ImageGen 生成 normal／angry／hit／hit_enemy／morale／weak／dizzy 七個獨立狀態，固定黑色面罩、紅圍巾、黑金戰鬥服、白手套、紅裏黑披風與 `3` 號腰帶；正式輸出為 `public/images/board/battle/portraits/evolutions/sanji_stealth_black/` 下七張 1024×1536 RGB WebP。
- 正式規則：只有 `sanji_evolution_2` 且仍攜帶 `judge_germa66_battle_suit` 的船員會在新戰鬥進場或首次換上場時變身；五項數值乘數為攻擊 1.20、防禦 1.30、戰術 1.10、意志 1.25、速度 1.35，速度較高時傷害 +15%。專屬光學迷彩會讓下一次敵方直接攻擊必定落空，進場及兩招隱形技能可啟動；預設四招與已學的海步行／魔神風腳投影成隱形黑版，PP 寫回原招式。戰鬥服一般持有者每場首次致命直接傷害完全擋下、防禦與速度各 +1 的效果也已接入玩家傷害管線。
- 畫面：新增五秒全畫面戰鬥服變身層，先顯示原新世界香吉士與封存罐，再以環形掃描切換專屬 normal 圖；結束後玩家 HUD、外觀框內人物、狀態圖示與招式頁都使用同一 battle view。移除會蓋住變身標題的額外狀態橫幅，桌機及手機橫向均保持原戰鬥構圖。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/js/board_items.js`、`public/board_game.html`、`public/board_battle.html`、`public/images/board/battle/portraits/evolutions/sanji_stealth_black/**`、`docs/POSTGAME_BOSS_RELICS.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式 query 更新為 `20260805-sanji-raid-suit-v4`。
- 同步邊界：沒有新增或改名 `gameState`、localStorage key、Socket.IO event 或 server 欄位；條件形態暫存在既有 `battleState` 完整快照內，沿用 `BOARD_GAME_STATE` 廣播。存檔中的角色 id、form id、攜帶物 id 與招式 id 均不改名，卸下戰鬥服後新戰鬥自然回到原新世界形態。
- 驗證：`node --check` 通過兩支 JS；正式 8787 頁面以 Lv.99 新世界香吉士實際裝備戰鬥服開戰，確認 battle view 名稱、七圖路徑、被動、五項倍率、四個預設招式與光學迷彩說明。實際敵方直接攻擊被迷彩攔下且不扣 HP；首次致命直接傷害由戰鬥服完全擋下並得到防禦／速度各 +1。1920×1080 與 932×430 的變身演出標題、人物與說明均在 viewport 內，沒有額外提示重疊；新七圖皆可解碼，未裝戰鬥服的對照場維持原名稱、圖片、數值與招式。

#### 隱形黑迷彩圖、綠牛死後再生與瀕死圖時序 V156

- 日期：2026-08-08。
- 使用者需求：將新增的隱形黑光學迷彩圖改為正式檔名並接入；綠牛的種子再生必須先被打死才回血；修正攻擊招式尚未完整演完就提前閃現瀕死圖的問題。
- 圖片與隱形狀態：確認使用者新檔與同組圖皆為 1086×1448 RGB WebP，將 `d10a7573-ad97-4a52-a753-367adf9816cc.webp` 改名為 `stealth.webp`。`SANJI_RAID_SUIT_PORTRAITS` 新增 stealth；當 `stealthReady=true` 時 battle view 的 normal／idle 指向 stealth，迷彩被敵方直接攻擊消耗後回到 normal，兩招隱形技能重開後再切回 stealth；戰鬥服變身演出的完成圖也使用 stealth。
- 綠牛順序：玩家直接攻擊使荒牧 HP 歸零時先保留 HP 0，並等待全部單段／連擊演出完成；之後發出 `postgame-aramaki-down` 顯示倒下圖，再消耗全部森林、回復「森林數 × 最大 HP 10%」，以 `postgame-aramaki-revive` 播放種子發芽治療。火焰招式清森林的正式結算會先於復活片數確定，其他 Boss 的致命防護管線不改。
- 瀕死圖時序：`board_battle.js` 的 normal 圖不再因快照 HP 0 自動降級成受擊／瀕死圖；攻擊事件仍在真實命中時顯示 hit，只有正式 `knockout` 或綠牛的 down 事件會啟動 dizzy。這保留原來的淡出與替補管線，不影響五檔尼卡覺醒等特殊瀕死分支。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`public/images/board/battle/portraits/evolutions/sanji_stealth_black/stealth.webp`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/POSTGAME_BOSS_RELICS.md`、`docs/DEV_WORKFLOW.md`。正式 query 更新為 `20260808-stealth-aramaki-ko-timing-v1`。
- 同步邊界：沒有改名角色、Boss、攜帶物或招式 id，也沒有新增 localStorage key、Socket.IO event 或 server 欄位。短暫 `postgameBossMechanic.revivePending` 只存在現有 `battleState` 完整快照內，死亡後及發芽後都透過既有戰鬥視圖與 `BOARD_GAME_STATE` 流程展現。
- 驗證：`node --check public/js/board_game.js` 與 `node --check public/js/board_battle.js` 通過。正式 8787 頁面的 1600×900 綠牛致命局實測為 `attack(HP 0, revived=false)`→`postgame-aramaki-down(HP 0)`→`postgame-aramaki-revive(HP 197/986, revived=true)`，倒下與發芽截圖無破圖或卡死。932×430 一般史基致命局於 attack 事件取樣 57 次，`dizzyDuringAttack=0`，正式 knockout 後才顯示 dizzy。隱形黑實測 stealth→normal→stealth 狀態路徑正確，圖片 natural size 1086×1448。另重跑 `scripts/postgame_boss_mechanics_qa.js`，13 座登島、13 場戰鬥、機制行為及 900×600 畫面均通過，結果 `errors=[]`、`failures=[]`。

#### 最終之島通關後黎明紀錄殿 V157

- 日期：2026-08-08。
- 使用者需求：最終之島完整劇情跑完後，再次回島不能又自動播放同一段劇情；通關後的島嶼需要有實際功能。
- 分流規則：`resolveLanding()` 在既有拓本與伊姆條件後，額外使用每玩家的 `finalEndingCleared`／`finalEndingRecords[player.id]` 判斷。只有該玩家尚未親自通關時才進入完整結局；已通關玩家改開「拉夫德魯・黎明紀錄殿」。其他尚未通關的真人不受全房 `postgameWorld.unlocked` 影響，仍能播放自己的首次結局。已有個人 record 但舊存檔缺少布林旗標時會回補為已通關。
- 功能：紀錄殿沿用正式最終之島 1254×1254 圖與既有圖片式航海框，顯示完成結局、通關回合、十三種 Boss 線索／總張數、約克解碼器階段及蛋頭島定位狀態。免費「黎明宴會」沿用正式全隊整備服務，恢復所有船員 HP／PP、清除能力階段並結束回合；離開按鈕不整備。兩者都不重複發結局、任務或世界解鎖獎勵。CPU 重訪會自動宴會並離島，不開真人選擇 modal。
- 同步與存檔：沒有新增或改名 `gameState`／`player` 欄位、localStorage key、Socket.IO event 或 server 欄位。紀錄殿只讀既有完整快照資料；宴會修改既有船員 HP／PP／能力階段並沿用 `endTurn()` 與 `BOARD_GAME_STATE` 推送。正式主頁 query 更新為 `20260808-final-island-revisit-v1`。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check public/js/board_game.js` 通過，正式 8787 頁面與新版 JS 皆為 HTTP 200。bundled Playwright 驗證個人 record-only 舊存檔重訪會進紀錄殿且無結局動畫；個人首次登島仍進完整 cinematic；宴會完整恢復六名船員 HP／PP 並將能力階段歸零；CPU 自動整備後不留 modal。1600×900 與 932×430 的圖片、兩按鈕及所有文字都在 viewport／框內，圖片 natural size 1254×1254，破圖與文字 overflow 為 0，頁面錯誤為 0。截圖為 `_codex_artifacts/qa_20260808_final_island_revisit_desktop.png` 與 `_codex_artifacts/qa_20260808_final_island_revisit_phone.png`。

#### 拉夫德魯無風帶航路盤與延遲抵達 V158

- 日期：2026-08-08。
- 使用者定案：拉夫德魯通關後要能前往十三座 Boss 島，但不能永久增加地圖捷徑；曾經拿過的 Boss 線索牌要成為永久座標，包含交易取得，交易離手後仍保留。選島消耗當前回合，下一個個人回合才抵達；再次使用前必須回到拉夫德魯。蛋頭島／洛克斯維持原十三線索解碼航路。
- UI：黎明紀錄殿新增「無風帶航路盤」。全螢幕介面沿用正式三階十三槽解碼器、十三張約克線索牌、Boss 半身圖、專屬島圖、船圖與掉落攜帶物圖；十三張牌環繞中央航路盤，已解鎖牌可選、未解鎖牌以暗色剪影顯示。右側詳情列出 Boss、島嶼、屬性／定位、實體線索現有張數、專屬掉落與完整效果。出航與抵達各有全畫面船隻／線索／羅盤動畫，沒有以新網頁方格代替正式素材。
- 永久解鎖：`addInventoryItem()` 在任何 Boss 線索進入玩家背包時登錄 `unlockedPostgameBossClueItemIds`，所以 Boss 掉落、交易與測試給予共用同一入口。正規化會去重、排除非正式線索 id，並替舊存檔從目前背包既有線索補登；失去實體牌不反向刪除永久座標。
- 回合流程：確認目標後建立 `pendingPostgameBossVoyage`，以 `departing`／`awaiting_turn`／`arriving` 三階段保存 Boss key、島 id、線索 id 與出航回合。出航動畫後呼叫既有 `endTurn()`；只有輪到同一玩家且 round 已增加時才抵達。抵達先更新玩家位置、播放動畫、清除 pending，再呼叫既有 `handleIslandArrival()`／`resolveLanding()`，因此登島揭露、Boss 情報、共鬥、挑戰與 CPU 行為不另開旁路；讀檔停在出航中也能恢復並正常交棒。
- CPU：只在已解鎖且本局有正式配置的 Boss 中選擇。先給「未持有該 Boss 專屬攜帶物」最高優先，再依目前船員屬性適性評分；全部專屬掉落都已有時才用適性決定。完全沒有已解鎖指針時沿用 V157 的免費宴會 fallback。
- 同步與相容：新增欄位只存在既有玩家物件並跟隨完整 `BOARD_GAME_STATE`、手動存讀檔及玩家正規化；沒有新增 localStorage key、Socket.IO event 或 server 欄位，也沒有改名線索、Boss、孤島、道具或既有 route id。航路盤不建立永久 route，第二次快速航行仍要求玩家實際回到拉夫德魯。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式主頁 query 更新為 `20260808-final-boss-voyage-v1`。
- 驗證：`node --check public/js/board_game.js` 通過；`npm start` 以獨立 8844 服務啟動，正式主頁回應 HTTP 200。舊存檔背包線索可回補永久座標，把實體數量移除後指針仍保持解鎖；pending 經正規化後保留。單人實測出航時仍在拉夫德魯且本回合交棒，round +1 的下一個人回合才抵達薩卡島，動畫結束後 pending 清除並顯示既有 Boss 登島框。另以兩個不同 userId／clientId 的真實 Chrome 頁面加入同一 Socket.IO 房間：房主出航後 current player 正確交給第二位玩家，房主仍停在 `final-island`、第二位仍停在 `island-1`；第二位玩家結束自己的回合後 round 7→8，房主才移到本局史基所在的 `calm-belt-island-06`，第二位位置不變、pending 清除、`lastError` 為空。CPU 在其餘十二件專屬掉落已持有、只缺七星劍時正確選擇薩卡並抵達開戰。1600×900 與 932×430 實測十三牌、Boss／島／掉落詳情、說明與按鈕均無破圖、越界或重疊；手機最大卡片底緣 384.27px、按鈕頂緣 396px。截圖為 `_codex_artifacts/qa_20260808_final_boss_voyage_compass_desktop.png`、`_codex_artifacts/qa_20260808_final_boss_voyage_compass_phone_final.png` 與 `_codex_artifacts/qa_20260808_final_boss_voyage_departure.png`。

#### 物攻／特攻招式與防禦／特防標示 V159

- 日期：2026-08-08。
- 使用者定案：特攻招式名稱前加 `(特)`；會增加或降低防禦的招式必須清楚說明改的是「防禦」或「特防」。索隆、香吉士等不能因大招而一律歸同類，須依實際招式表現分類。
- 實作：`board_cards.js` 新增共用傷害類別解析，依穩定 move id／正式名稱將傷害招式解析為 `physical`／`special`，非傷害招式為 `status`。`board_game.js` 的傷害公式、連擊、選擇眼鏡／講究頭帶、突擊背心、巴雷特吸收效果、角色被動與 CPU 配招全部改讀同一分類；戰鬥 view 增加衍生 `damageClass`／`displayName`，但不寫入遊戲存檔。`board_battle.js` 與船員詳情／學招介面顯示 `(特)`、物攻／特攻及特攻／特防能力名稱。
- 防禦文字：能力階級顯示改為 `def=防禦`、`sdef=特防`、`satk=特攻`。招式效果會從 `selfStages`、`enemyStages` 與各種命中／高骰階段自動產生明確名稱；舊「戰術／意志」機械用語在招式效果顯示時正規化為「特攻／特防」。
- 修改檔案：`public/js/board_cards.js`、`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式 query 更新為 `20260808-special-damage-class-v1`。
- 同步邊界：沒有改名角色、招式、道具或敵人 id，沒有修改舊 move category、localStorage key、Socket.IO event、server 欄位、`gameState`／`battleState` 持久欄位或 `BOARD_GAME_STATE` 格式。舊存檔招式依既有 id／名稱即時計算分類。
- 驗證：`node --check` 通過 `board_cards.js`、`board_game.js`、`board_battle.js`。bundled Playwright 確認鬼斬為 `physical→atk/def`、龍捲風為 `special→satk/sdef` 且顯示 `(特) 龍捲風`；防禦、特防、雙防測試分別輸出「自身防禦+1」、「自身特防+1」、「自身防禦+1、特防+1」。掃描基礎角色、進化型態與血統培育模板共 919 招、245 個特攻實例及 166 個含防禦階級變化的招式，缺少 `(特)`／防禦／特防標示的項目為 0。1600×900 與 932×430 戰鬥指令均無文字裁切或水平溢出，頁面錯誤為 0；獨立 8848 正式服務的 `board_game.html` 回應 HTTP 200。

#### 血統培育四招起手與升級新招 V160

- 日期：2026-08-09。
- 使用者定案：血統因子培育完成的角色不能只有兩招再把原四招拆成升級解鎖；必須像一般船員一樣，完成培育即有四招，之後升級仍有新的招式可以領悟。
- 技能資料：59 種獨立 `lineage_*` 玩家模板由原正式敵人招式與培育後延伸招式組成固定 8 招；前四招 Lv.1 解鎖，後四招依 Lv.15／25／35／45 解鎖。攻擊、偵查、移動、輔助四職能的後期招式分別使用輸出／破防、先制／速度、看破／控制及弱化／護盾等既有正式效果欄位，最後傷害招明確保存 `damageClass=special` 並顯示 `(特)`。敵方 profile 與 Boss 戰鬥招式未改。
- 舊存檔：`syncUnlockedMoveIds()` 會依新版模板替舊 Lv.1 培育角色安全補滿四招；`LATE_MOVE_BACKFILL_VERSION` 由 2 升為 3，已達後期解鎖等級的船上角色會把缺少招式送入既有 `pendingMoveLearnQueue`，研究收藏角色登船時也會執行同一補檢。未新增研究所或玩家欄位，既有 id、localStorage key、Socket.IO event 與完整 `BOARD_GAME_STATE` 格式不變。
- 相容模板：青雉、巴其、克洛克達爾、Mr.1、Mr.2、Mr.3 六種沿用既有玩家模板，不覆寫其進化招式；六者皆四招起手且至少有一招後續可學。另補記「白鳥阿拉貝斯克」為正式特攻招式，保持學招與戰鬥頁 `(特)` 標示一致。
- 修改檔案：`public/js/board_game.js`、`public/js/board_cards.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。正式 query 更新為 `20260809-lineage-eight-moves-v1`。
- 驗證：`node --check` 通過 `board_game.js` 與 `board_cards.js`。正式 8787 頁面掃描 65 種培育來源：59 種獨立模板均為 8 招、初始 4 招、後期 4 招、解鎖表固定 `1/1/1/1/15/25/35/45`；6 種沿用模板亦均為四招起手且有後續招式。以 65 份臨時完整因子逐一實際呼叫正式培育，再升至滿等，培育失敗、初始招式錯誤、待學數量錯誤與特攻標示錯誤皆為 0，頁面例外為 0。

#### 終局 Boss 血統培育數據與招式威力 V161

- 日期：2026-08-09。
- 使用者需求：十三座 Boss／洛克斯的血統培育角色雖為終局來源，實際六項數據與傷害仍像普通 T1，必須讓 Lv.1 起步的規則保留但能感受到終局血統強度。
- 數據：新增只辨識十三名 `POSTGAME_BOSS_PROFILES` 與洛克斯來源的玩家卡能力層。十三名在等級、進化及 S～SSS 階段計算後將六項能力乘以 1.15；洛克斯乘以 1.25；個體傾向百分比與修行固定值仍於其後計算。普通敵人、原船員、競技場對手與敵方 Boss profile 完全不變。
- 招式：十三名 Boss 的玩家版傷害招改用 `65／82／102／128`，洛克斯使用 `70／90／115／140`。若角色只有兩至三個傷害招，索引會平均拉開，使最後一個傷害招仍使用最高值；狀態技、PP、效果、解鎖等級與既有 move id 不變。
- 存檔相容：新培育卡保存可選的 `cultivatedFromEnemyKey`，使覺醒路基回到共用基礎路基模板後仍可辨識 Boss 來源。既有獨立 `lineage_postgame_*`／洛克斯角色可直接由原穩定 card id 推回來源；同步角色資料時會套用新數據、招式並把增加的最大 HP 補入目前 HP，之後不會重複補血。欄位隨既有完整 `BOARD_GAME_STATE` 與手動存檔傳遞，沒有新增 localStorage key、Socket.IO event 或 server 欄位。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/POSTGAME_LINEAGE_RESEARCH_PLAN.md`、`docs/DEV_WORKFLOW.md`。正式 query 更新為 `20260809-lineage-endgame-power-v1`。
- 驗證：`node --check public/js/board_game.js` 通過。bundled Playwright 在正式 8787 頁面逐一用完整因子培育十三名 Boss 與洛克斯共 14 名，來源 key、因子只消耗一次、研究收藏只新增一次、JSON 往返後數據／招式一致、舊獨立 id 回補及最高威力全部通過，`failures=[]`、頁面例外 0。普通赤犬對照仍為原 T1 數據與 `55／70／88／110` 曲線。Lv.99、滿修行、記憶 3、SSS 的固定防守者傷害對照：普通赤犬最高招骰 3／6 為 131／176，巴雷特為 169／228，洛克斯為 198／267。另以 `PORT=8791 npm start` 啟動正式服務後停止測試行程；現有 8787 正式頁面及新版 JS 回應正常。

#### 名刀「日蝕」雙攻與第三骰高點倍率 V162

- 日期：2026-08-09。
- 使用者定案：名刀「日蝕」本身先提高雙攻 20%，第三顆骰不能在總點數 12 後全部使用同一倍率。
- 數值：正式道具效果新增攻擊與特攻各 ×1.20；玩家只有在目前上場角色實際裝備日蝕且未被巴雷特吸收時套用。巴雷特六孔吸收到日蝕時沿用既有完整接管規則，該有效孔位也會使巴雷特的攻擊與特攻各 ×1.20；孔位被破壞後停止該孔效果。
- 骰子：玩家攻擊／特攻的 1～11 點總戰鬥骰維持原倍率；12 點為 ×2.05，13～18 點改為每點 +×0.15，依序為 ×2.20／×2.35／×2.50／×2.65／×2.80／×2.95。第一顆與第二／第三顆的原觸發門檻、敵方一般追加骰保護曲線、屬性、被動、護盾與最終傷害軟上限均未改。
- 顯示：背包、船員攜帶物與 Boss 掉落情報共用的正式道具說明已同步標示雙攻與 12～18 點倍率；主頁的 `board_items.js`／`board_game.js` query 更新為 `20260809-eclipse-dual-attack-dice-v1`。
- 修改檔案：`public/js/board_items.js`、`public/js/board_game.js`、`public/board_game.html`、`docs/POSTGAME_BOSS_RELICS.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 同步邊界：沒有新增或改名道具、角色、Boss、招式、`gameState`／`battleState` 欄位、localStorage key、Socket.IO event 或 server 欄位；既有 `rocks_eclipse_sword` 與完整 `BOARD_GAME_STATE` 快照可直接沿用。
- 驗證：`node --check public/js/board_items.js`、`node --check public/js/board_game.js` 與指定檔案 `git diff --check` 通過。正式 8787 頁以 bundled Playwright 建立日蝕裝備對照戰：攻擊 218→262、特攻 198→238，均等於未裝備數值 ×1.20 後四捨五入；第三骰門檻仍為 5／3／1，12～18 點實際倍率依序為 2.05／2.20／2.35／2.50／2.65／2.80／2.95。另讓巴雷特吸收六把日蝕，六孔全部有效時攻擊 451→1347、特攻 288→860，均符合 ×1.20 六次相乘後四捨五入；六孔破壞後恢復原數值。頁面例外與 console error 皆為 0。

#### 名刀「日蝕」追加骰置中與三骰結算 V163

- 日期：2026-08-09。
- 使用者回報：第三顆追加骰偏離原骰位置，而且三顆骰面已超過 12 時，結算文字仍顯示舊的 12。
- 定位修正：日蝕第三骰原為 350px，但沿用 220px 容器左上角排版，實測中心向右、向下各偏 65px；現改為以 `left/top: 50%` 與獨立 `translate` 固定中心，骰面縮放及霸王色震動不再改變置中。三骰同列時也修正第三骰通用 `translateX` 規則覆蓋專用規則的問題。
- 結算修正：戰鬥頁新增只讀的三骰重算，總結事件若帶第一／第二／第三顆骰面，會以實際骰面相加覆寫舊 `settle` 與總點數文字；第一、第二、第三顆仍依序在同一位置取代顯示，最後只以 cut-in 顯示 `A + B + C = 總點數` 與倍率，不同時排出三顆骰。主遊戲原本回傳三骰總和與 12～18 倍率的正式傷害管線不變。
- 修改檔案：`public/board_battle.html`、`public/js/board_battle.js`、`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式主頁與戰鬥頁 query 更新為 `20260809-eclipse-dice-result-v3`。
- 同步邊界：沒有新增或改名 `gameState`／`battleState` 欄位、道具／角色／招式 id、localStorage key、Socket.IO event 或 server 欄位；只校正既有 visual event 的顯示結果，權威傷害仍使用 `board_game.js` 已計算的三骰總和。
- 驗證：`node --check public/js/board_battle.js` 與 `public/js/board_game.js` 通過。正式 8787 頁面的日蝕第三骰中心與原骰容器中心差為 `0px / 0px`；注入帶有舊 `settle=12` 但骰面 `6／5／4` 的回歸事件後，結算文字重算為 `6 + 5 + 4 = 15`，骰子層維持關閉，沒有同時顯示三顆。桌機與手機窄版頁面例外及 console error 為 0。

#### 凱多第二條血切換第二型態戰鬥圖 V164

- 日期：2026-08-09。
- 使用者回報：凱多上層血條被打穿、第二條血已啟用，但敵方人物仍持續顯示第一型態戰鬥圖。
- 原因：`activateYonkoSecondHpBar()` 正確寫入既有 `yonkoState.kaido.phase2` 與最後一條滿血，建立戰鬥時保存的 `enemyCombatant.battlePortraits` 卻沒有跟著更新，因此 `getBattleView()` 與戰鬥 iframe 一直收到 `yonko_kaido/` 第一型態路徑。
- 修正：新增只處理凱多的 `syncYonkoPhaseBattlePortraits()`。切相當下立即把七狀態圖改為 `yonko_kaido_phase2/`；`getBattleView()` 與 `getBattleVisualSnapshot()` 也依既有 `phase2` 再同步，讓舊 pending 戰鬥、手動讀檔及多人完整快照即使保存了第一型態路徑，也會在送出畫面前修復。未新增狀態欄位，四皇 HP、龍鱗、覺醒、傷害封頂、對話、獎勵、localStorage key、Socket.IO event 與 `BOARD_GAME_STATE` 格式不變。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`public/board_battle.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式主頁、battle iframe 與戰鬥頁 query 更新為 `20260809-kaido-phase2-portrait-v1`。
- 驗證：`node --check` 通過 `board_game.js` 與 `board_battle.js`。正式 8787 頁面把凱多設在半血門檻上方 1 HP，以正式玩家招式打穿上層血條後，`phase2=true`、最後一條為 493/493，第二階段對話實際顯示 `yonko_kaido_phase2/angry.webp`；battle view 的 normal／angry／hit／hit_player／morale／weak／dizzy 七條路徑全部切換，七張皆正常解碼為 1086×1448。另模擬舊快照 `phase2=true` 但 portraits 仍為第一型態，呼叫 view 後自動修正為第二型態 normal，七張載入成功、HTTP 失敗與頁面例外皆為 0。1600×900 與 932×430 正式戰鬥頁都實際載入第二型態圖，窄版沒有水平／垂直頁面 overflow；截圖為 `_codex_artifacts/qa_20260809_kaido_phase2_desktop.png`、`_codex_artifacts/qa_20260809_kaido_phase2_phone.png`。

#### 隱形黑延後至可行動回合變身 V165

- 日期：2026-08-09。
- 使用者修正：新世界香吉士裝備戰鬥服後，換人動作本身若已消耗一回合，不能在換上的當下變身；必須像九尾幻面一樣，等到該角色真正能戰鬥、可以選擇指令的回合才啟動。
- 原因：建立／讀取戰鬥會直接呼叫變身，`createBattleSwitchVisualEvent()` 也會在任何換人或瀕死替補時立刻把該船員標成 `transformed`，沒有區分換人後能否於同輪繼續操作。
- 修正：移除建立戰鬥、戰鬥正規化與換人視覺事件的直接變身。正式觸發只保留在 `startBattleRound()` 與 `continueBattleRoundStartAfterPrompt()`：新戰鬥的第一個可行動回合會變身；一般換人／瀕死替補先使用新世界香吉士原圖，下一個可行動回合才播放五秒演出；回合開始的免費強制換人則於提示完成並恢復操作時進入同一排程。隱形黑的圖片、招式、被動、數值、光學迷彩及戰鬥服致命傷效果均未改。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`public/board_battle.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式主頁、battle iframe 與戰鬥頁 query 更新為 `20260809-sanji-raid-suit-action-turn-v1`。
- 同步邊界：沒有新增或改名角色、形態、攜帶物、招式、`gameState`／`battleState` 欄位、localStorage key、Socket.IO event 或 server 欄位；沿用既有 `sanjiRaidSuitState` 與完整 `BOARD_GAME_STATE` 快照。
- 驗證：`node --check public/js/board_game.js` 與 `node --check public/js/board_battle.js` 通過；另以 `PORT=8797 npm start` 啟動獨立正式服務，`board_game.html` 回應 HTTP 200 後停止測試行程。正式 8787 頁以魯夫上場、新世界香吉士攜帶戰鬥服在後排的實戰回歸：第 1 輪換上時視覺事件為 `switch`、`transformed=false`、名稱與圖片仍為新世界香吉士原版；雙方行動結束並以既有 pending 快照恢復第 2 輪後，事件才變為 `sanji-raid-suit-transform`、名稱切至隱形黑、圖片切至 `sanji_stealth_black/stealth.webp`。932×430 正式戰鬥頁另確認變身播放期間 `canAct=false`、播放結束才恢復操作，標題、人物與說明都在可視範圍，頁面 scroll width／height 等於 viewport；截圖為 `_codex_artifacts/qa_20260809_sanji_raid_suit_action_turn_phone.png`。過程頁面例外與 console error 均為 0。

#### Tot Musica 第一骰奇偶同步與選招顯示 V166

- 日期：2026-08-09。
- 使用者回報與規則修正：打 Tot Musica 時選招內容完全看不到；雙世界傷害改為看兩邊第一顆骰，必須同為單數或同為雙數才能造成傷害。
- 原因：雙世界行動網格沒有定位與圖層值，實際 12 個按鈕雖已建立，卻被 `battle-command-panel-frame` 的不透明圖片底框蓋在後方；只有本來有較高 `z-index` 的標題與確認按鈕仍可見。低高度畫面把網格提升後，固定 30px 確認按鈕又會覆蓋最下排中央選項。
- 修正：把 `.postgame-dual-world-grid` 固定在圖片框內的前景圖層，限制上下左右範圍；高度 520px 以下另提高底部保留空間、縮小世界頭像／間距／按鈕 padding。正式傷害先要求兩邊直接攻擊命中，再比較各自 `rollBattleActionDiceWithPassives()` 回傳總點數前捕捉的第一骰；同奇偶才合併傷害，奇偶不同則由次元屏障歸零。狀態 view、狀態圖示與戰鬥紀錄保存／顯示兩邊第一骰、奇偶及結果，追加骰不改第一骰判定。
- 修改檔案：`public/board_battle.html`、`public/js/board_battle.js`、`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/DEV_WORKFLOW.md`。正式主頁、battle iframe 與戰鬥頁 query 更新為 `20260809-tot-musica-parity-ui-v1`。
- 同步邊界：只在既有 `battle.postgameBossMechanic` 增加最近一次兩邊第一骰與判定結果，跟隨原完整 `BOARD_GAME_STATE`／pending battle 快照；沒有新增頂層 `gameState`／`battleState` 欄位、角色／招式／道具 id、localStorage key、Socket.IO event 或 server 欄位。
- 驗證：`node --check public/js/board_game.js` 與 `node --check public/js/board_battle.js` 通過。以 `PORT=8798 npm start` 開啟正式頁；1600×900 與 932×430 均建立 12 個招式／換人按鈕，逐一以 `elementFromPoint()` 確認可點，手機版最後一列底部 394.94px、確認按鈕頂部 401.89px，無重疊，頁面 scroll 尺寸等於 viewport。純函式驗證 1／3、2／6 通過，1／2、4／5、0／2 不通過。正式實戰讓現實世界持有日蝕，兩邊第一骰皆為 5；追加後總點數分別為 15 與 10，仍依第一骰同為單數正確造成 64 傷害，Boss HP 986→922，狀態為 `success`。頁面例外為 0；截圖為 `_codex_artifacts/qa_20260809_tot_musica_parity_ui_desktop.png`、`_codex_artifacts/qa_20260809_tot_musica_parity_ui_phone.png`。

#### 大熊肉球果實 Boss 島轉送 V167

- 日期：2026-08-10。
- 使用者需求：最終之島通關後的 Boss 島快速移動改由抵達拉夫德魯的大熊使用肉球果實；先完成可玩的轉送版本，之後可再依新劇情調整台詞。
- 畫面：黎明紀錄殿改用正式大熊透明人物圖，入口顯示「請大熊轉送」；十三牌頁改名為「大熊的肉球航路」。依使用者附圖移除古代圓盤，十三張撲克牌改為 Cover Flow：中央牌放大、左右牌各向內傾斜並帶鏡面倒影，可用左右按鈕、鍵盤方向鍵、滾輪與觸控滑動循環。出發演出顯示大熊伸掌、線索座標、玩家船與粉金色肉球壓力衝擊，台詞為「旅行的話，想去哪裡？」；抵達演出不顯示大熊本人，只讓肉球氣泡、船與動態 Boss 島圖在目的地上空重合並破裂。
- 規則：保留 V158 的永久線索座標與延遲抵達。選島後建立既有 `pendingPostgameBossVoyage`，`departing` 動畫後進入 `awaiting_turn` 並呼叫原 `endTurn()`；下一個個人回合才進入 `arriving`，移動到正式配置的孤島，動畫後清除 pending 並呼叫原 `handleIslandArrival()`／`resolveLanding()`。CPU、觀看方、共鬥、Boss 戰、蛋頭島與洛克斯流程不變。
- 素材：新增 `public/images/board/final_island/kuma_paw_transfer/paw_pressure_burst.webp`，原始 PNG 與完整 ImageGen 提示詞保存在同目錄；大熊沿用 `public/images/board/story/speakers/kuma_memory_smile.webp`。正式頁只指向已歸檔素材，不使用 `.codex/generated_images` 或 incoming 路徑。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`public/images/board/final_island/kuma_paw_transfer/*`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式主頁 query 更新為 `20260810-kuma-paw-coverflow-v1`。
- 同步邊界：未新增或改名 `gameState`、玩家、地圖、Boss、道具、路線或 UI event 欄位；保留 `unlockedPostgameBossClueItemIds`、`pendingPostgameBossVoyage`、`final-boss-voyage`、localStorage key、Socket.IO event 與 server 快照格式。
- 驗證：`node --check public/js/board_game.js` 通過，獨立 `PORT=8799` 的 `board_game.html` HTTP 200。1600×900 與 932×430 均沒有古代圓盤，顯示九張可視 Cover Flow 牌、兩個完整方向鍵與可用確認鈕；第 1 張向左循環至第 13 張，再按右鍵／鍵盤右鍵可回第 1 張。手機的舞台、兩箭頭與確認鈕全部在 viewport 內。出發六組圖片與抵達的肉球／船／島圖均載入，404 為 0。手動走完狀態後，出發為 `departing`，動畫結束進入 `awaiting_turn` 並讓 round 1→2；抵達為 `arriving`，完成後 pending 清空、`resolutionLock=false`，位置為正式 Boss 島並開啟既有 SSS Boss 登島頁。截圖為 `_codex_artifacts/qa_20260810_kuma_coverflow_desktop.png`、`qa_20260810_kuma_coverflow_phone.png`、`qa_20260810_kuma_departure_desktop.png`、`qa_20260810_kuma_arrival_desktop.png`、`qa_20260810_kuma_departure_phone.png`。

#### 大熊肉球地圖飛行與鏡頭追蹤 V168

- 日期：2026-08-11。
- 使用者需求：大熊轉送不能只在全螢幕演出中帶過，必須像海上列車一樣實際出現在世界地圖；視覺需參考動畫中大熊把目標拍飛、以熊掌形壓力氣泡保護長距離飛行、抵達留下熊掌衝擊的節奏。
- 流程：出發保留短版大熊伸掌演出，結束後建立 `kuma-paw-map-layer`。原船 token 隱藏，玩家船圖疊在側向熊掌壓力氣泡中央，沿貝茲曲線飛往海圖上緣，逐幀呼叫既有 `panToBoardPoint()` 跟拍；`awaiting_turn` 期間依 `pendingPostgameBossVoyage` 繼續隱藏原船。下一個個人回合由海圖上緣建立第二段曲線，飛入真正 Boss 島，落點播放正面熊掌衝擊後清理視覺層、恢復原船並接回 `handleIslandArrival()`／`resolveLanding()`。
- 素材：ImageGen 新增 `paw_flight_bubble_source.png`，依正式 `paw_pressure_burst.webp` 的粉金色與品質生成 1536×1024 側向氣泡；再以內建 `remove_chroma_key.py` 對純黑背景作柔邊透明輸出為 `paw_flight_bubble.webp`。完整提示詞與正式檔案說明更新於同目錄 `PROMPT.md`，正式頁不引用生成暫存路徑。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`public/images/board/final_island/kuma_paw_transfer/paw_flight_bubble.webp`、`paw_flight_bubble_source.png`、`PROMPT.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式主頁 query 更新為 `20260810-kuma-paw-map-flight-v1`。
- 同步邊界：沒有新增或改名持久 `gameState`／玩家欄位、地圖節點、路線、Boss、道具、localStorage key、Socket.IO event 或 server 欄位；繼續使用既有 `pendingPostgameBossVoyage` 與 `final-boss-voyage` 完整快照事件。`state.kumaPawAnimation` 只保存目前頁面的暫時動畫 player/event/phase，不會進入存檔。
- 驗證：`node --check public/js/board_game.js` 通過；既有 8799 正式服務的 `board_game.html` 與兩張肉球 WebP 回應 HTTP 200。Chrome／bundled Playwright 以 1600×900 與 932×430 實際從拉夫德魯選第一張線索、播放伸掌、地圖飛出、單人換回合、地圖飛入與 Boss 登島：兩段 token 座標均持續改變，原船在 pending 時隱藏，抵達後 `pending=null`、`mapLayers=0`、船 token class 恢復為 `ship-token current`，Boss 島位置正確；人物、氣泡與船無黑底／破圖，頁面水平／垂直 overflow 均為 0。桌機實測截圖保存在 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/qa_kuma_map_20260810/`。

#### 大熊次回合完整飛行、配色與落地撞擊坑 V169

- 日期：2026-08-11。
- 使用者修正：肉球特效必須依動畫畫面改色，落地也要依撞擊坑參考圖重畫；選完目的地當下不要有任何動畫，等同一玩家下個個人回合才從最終之島飛往目的地，而且動畫不能太快。
- 流程：`startFinalIslandBossVoyage()` 選島後直接寫入既有 `awaiting_turn`、保持玩家位置與船 token 在拉夫德魯、同步完整快照並呼叫原 `endTurn()`；不再送出 departure visual event。下次個人回合才進入 `arriving`，地圖動畫由拉夫德魯起點沿一條完整貝茲曲線到 Boss 島，真人總演出 8 秒、地圖飛行約 6.5 秒，鏡頭全程跟拍；落地坑在氣泡消失後保留主要可見區間再淡出。舊存檔的 `departing` 只安全轉成等待，不補播舊動畫。
- 素材：依使用者動畫截圖以 ImageGen 重畫 `paw_flight_bubble_source.png` 與 `paw_landing_impact_source.png`，再用內建 `remove_chroma_key.py` 對洋紅鍵柔邊去背成 RGBA WebP。飛行圖為淡冰藍壓力外殼、黃綠核心與四個淡藍肉球；落地圖為碗狀撞擊坑、放射裂槽、副坑、碎石與白色煙塵，均不含人物／字幕。正式頁不再引用粉金 `paw_pressure_burst.webp`。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`public/images/board/final_island/kuma_paw_transfer/paw_flight_bubble.webp`、`paw_flight_bubble_source.png`、`paw_landing_impact.webp`、`paw_landing_impact_source.png`、`PROMPT.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式 query 更新為 `20260811-kuma-paw-flight-landing-v2`。
- 同步邊界：未新增或改名持久欄位、地圖節點、路線、Boss、道具、localStorage key、Socket.IO event 或 server 欄位；沿用 `pendingPostgameBossVoyage`、`final-boss-voyage` 與 `BOARD_GAME_STATE` 完整快照，`state.kumaPawAnimation` 仍只存在目前頁面。
- 驗證：`node --check public/js/board_game.js` 通過，正式 8787 頁與兩張新 WebP 均回應 HTTP 200；兩張正式 WebP 均為 RGBA、四角 alpha 0。Chrome／bundled Playwright 以 1600×900 與 932×430 各走一次雙玩家流程：選島 350ms 後 `phase=awaiting_turn`、位置仍為 `final-island`、目前玩家已交棒、全螢幕與地圖動畫層皆為 0、船 token 可見且座標未變；下次個人回合的飛行 token 起點與原船只差 0.67／0.78px，2.8 秒後已移動 2739.58／763.23px。落地撞擊坑在氣泡消失後 opacity 均為 1，完成後 `pending=null`、地圖動畫層 0、船 token 恢復、位置為正式 Boss 島；兩種 viewport 的頁面 scroll 尺寸等於 viewport，新素材請求沒有 HTTP 錯誤。截圖保存在 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/qa_kuma_v2_20260811/`。

#### Tot Musica 雙世界全螢幕同步攻擊 V170

- 日期：2026-08-11。
- 使用者需求：現實世界與歌世界都選完招式後，改用全螢幕右上至左下斜切演出；兩邊同時顯示出戰角色、第一顆骰與招式，Tot Musica 固定在中央。兩邊第一骰同為單數或同為雙數才可造成傷害。
- 流程：Tot Musica 專用行動仍依原順序計算兩邊招式、命中、追加骰、傷害與效果，但該流程抑制舊的逐邊骰子動畫，改送出一次既有 `battle.visualEvent` 中的 `tot-musica-dual-sync` 暫時事件。戰鬥頁同步滾動兩顆第一骰，結算時顯示各自第一骰、奇偶與含追加骰的總點數；成功播放中央 Boss 受擊，奇偶不同或任一邊未直接命中則顯示次元屏障。
- 畫面：現實／歌世界使用兩張 1672×941 RGB WebP 完整背景，再由 CSS 的互補三角形精準裁切，斜線固定穿過右上角、中心與左下角，不依賴生成圖內建斜線。兩名角色與 Tot Musica 均保留正式戰鬥主框；大型外擴光環／左右裝飾不搬入同步舞台，避免遮住骰子、名稱與判定文字。
- 素材：新增 `public/images/board/battle/tot_musica_dual/tot_musica_real_world_background.webp`、`tot_musica_song_world_background.webp`；ImageGen 原始 PNG 與未採用的合成斜切稿保存在同層 `incoming/`，正式頁不引用 `incoming/`。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`public/images/board/battle/tot_musica_dual/`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式主頁、battle iframe 與戰鬥頁 query 更新為 `20260811-tot-musica-dual-cutin-v4`。
- 同步邊界：沒有新增持久 `gameState`／`battleState` 欄位、角色／招式／Boss／道具 id、localStorage key、Socket.IO event 或 server 欄位；`tot-musica-dual-sync` 只存在既有完整戰鬥快照的 `visualEvent`，傷害與奇偶判定仍由主遊戲權威流程完成。
- 驗證：`node --check public/js/board_game.js` 與 `node --check public/js/board_battle.js` 通過。Chrome／bundled Playwright 以 1920×1080、1366×768、932×430 實測成功，同時另測桌機奇偶不同與未形成雙直接攻擊；五種畫面均顯示完整斜線、兩邊第一骰、中央 Boss、原戰鬥主框與單列結果文字，沒有頁面例外。正式頁與兩張背景資源另以 HTTP 200 檢查。

#### Tot Musica 原戰鬥框、垂直雙世界與左右選招 V171

- 日期：2026-08-11。
- 使用者修正：雙世界舞台不採用難以精準對齊的斜切，改為垂直對半；角色圖、角色框與 Boss 框必須跟原戰鬥完全相同，保留正常攻擊／受擊動畫；Tot Musica 血量提高三倍。技能與換人選擇也必須剛好分佈在畫面下方左右兩半。
- 戰鬥演出：同步舞台改成現實世界左 50%、歌世界右 50% 與中央直線。兩名船員及 Tot Musica 直接使用正式 `.combat-card`、`.card-inner`、`.portrait-wrap.has-portrait`、`.battle-portrait` DOM；角色外觀框沿用 `applyCosmeticFrame()`，五檔尼卡沿用日光／左右雲煙／尼卡主框四層，Boss 沿用正式敵方框。現實世界與歌世界攻擊分別套用既有玩家／敵方方向的 `portrait-attack`，同步成功時 Tot Musica 套用既有 `portrait-hit`。
- 選招畫面：`infoPanel` 在 Tot Musica 已分隊且可行動時才套用專用全寬下方模式；現實世界與歌世界各佔一半並各自使用 `battle_switch_panel_frame.webp`，每半都可顯示四招與兩名換人選項。中央確認鈕移到兩張底框上方，不覆蓋任何選項；離開該模式即移除專用 class，不影響一般招式、道具、換人與結果面板。
- 規則：`postgame_tot_musica.maxHp` 由 1720 調整為 5160，三個樂章、同奇偶與雙直接命中判定均不變。沿用原 `postgameBossMechanic`、`battle.visualEvent`、完整 `BOARD_GAME_STATE` 快照與命令橋接，沒有新增持久欄位、id、localStorage key、Socket.IO event 或 server 欄位。
- 修改檔案：`public/board_battle.html`、`public/js/board_battle.js`、`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式主頁、battle iframe 與戰鬥頁 query 為 `20260811-tot-musica-original-cards-v2`。
- 驗證：`node --check public/js/board_battle.js` 與 `node --check public/js/board_game.js` 通過；8787 正式 `npm start` 頁面回應 HTTP 200。Chrome／bundled Playwright 以 1920×1080、1366×768、932×430 實測選招：兩張底框各精準佔一半、共 12 個技能／換人按鈕、按鈕 overflow 0、viewport miss 0、確認鈕與兩邊 action grid 重疊皆為 false。同步演出另測桌機攻擊、桌機受擊及手機受擊，三張 portrait 均為 `object-fit: cover`，外觀框層數為 4／4／1，攻擊時存在 `portrait-attack`、成功時存在 `portrait-hit`，HTTP／page errors 為空。截圖與 `metrics.json` 保存在 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/qa_tot_musica_v171/`。

#### Tot Musica 左右皆為我方船員 V172

- 日期：2026-08-11。
- 使用者修正：雙世界畫面左右兩邊都必須是我方角色；歌世界船員不能因為站在右邊就被當成敵方。Tot Musica 才是中央唯一敵方。
- 畫面：Tot Musica 可行動的選招階段新增雙世界主畫面預覽。左側使用現實世界目前船員的 `combat-card player`、右側使用歌世界目前船員的 `combat-card player`，兩邊標題與下方圖片面板均明寫「我方」並顯示各自 HP；中央 Tot Musica 保留 `combat-card enemy` 與敵方 HP 標籤。選招期間隱藏原屬性相剋小盤，避免和中央敵方標籤重疊；離開選招模式會移除暫時 preview class，不影響一般戰鬥。
- 動畫：歌世界右側船員仍需向中央 Boss 攻擊，因此新增 `totMusicaRightAllyCardAttack`／`totMusicaRightAllyPortraitAttack`；方向由右往中，但 DOM、CSS class 與狀態全部維持我方語意，不再引用 `enemyCardAttackShake`／`enemyPortraitAttack`。
- 同步與相容性：只新增戰鬥頁暫時顯示 class 與 DOM 標籤，未改 Tot Musica 分隊、技能、換人、奇偶、傷害、HP、戰鬥 state、角色／Boss id、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE` 完整快照格式。正式 query 更新為 `20260811-tot-musica-player-sides-v4`。
- 驗證：`node --check public/js/board_battle.js` 與 `node --check public/js/board_game.js` 通過。Chrome／bundled Playwright 以 1920×1080、1366×768、932×430 實測，兩張 actor card class 均含 `combat-card player` 且 opacity 1，中央 card class 含 `combat-card enemy`；左右標籤為「我方・現實世界」／「我方・歌世界」，中央為「敵方・Tot Musica・HP 5160/5160」。桌機、平板及手機左右卡均位於下方面板上方，12 個按鈕 overflow 0、viewport miss 0、確認鈕不重疊 action grid；HTTP／page errors 為空。最終截圖與 `metrics.json` 位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/qa_tot_musica_v172_final/`。

#### Tot Musica 雙骰融合、向上衝擊波與延後登場 V173

- 日期：2026-08-11。
- 使用者修正：選招階段不能先看到 Tot Musica；確認後不得短暫切回一般戰鬥畫面。兩顆第一骰必須同時滾動並往中央碰撞；同步失敗時雙骰碎裂，同步成功時只有骰子融合，兩名我方船員各自從左右攻向中央但不互相重疊或融合。
- 正式順序：雙骰 1.5 秒同時滾動、1.84 秒開始向中央碰撞；2.56 秒依奇偶與直接命中分流。失敗顯示碎片與同步失敗結果，Boss 全程不登場；成功顯示「雙骰融合」核心，兩張我方正式戰鬥卡停在中央兩側共同出招，3.36 秒後角色、名稱、選招圖片面板與按鈕向下退場，只留衝擊波往上飛行完整 3 秒。6.46 秒後 Tot Musica 含原正式敵方框由上往下登場，7.44 秒切受擊圖、套用原 `portrait-hit` 並顯示傷害。
- 防閃回：確認按鈕立即鎖定兩邊所有操作並保留雙世界預覽；`tot-musica-dual-sync` 事件抵達後沿用同一個 overlay，動畫期間 `renderPanel()` 不重建一般面板。成功總演出 9.8 秒、失敗 5.2 秒，結束後才恢復正式戰鬥介面。
- 血量相容：Tot Musica 正式最大 HP 仍為 5160。舊存檔若保留舊滿血 1720／5160，載入十三島與首次開戰前會修正為 5160／5160；其他已實際受傷的血量依舊最大 HP 比例換算，不任意回滿。
- 修改檔案：`public/board_battle.html`、`public/js/board_battle.js`、`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。沿用既有 `shockwave_ring.webp`，未新增素材 id、持久 state、localStorage key、Socket.IO event 或 server 欄位；正式 query 更新為 `20260811-tot-musica-sync-wave-v5`。
- 驗證：`node --check public/js/board_battle.js`、`node --check public/js/board_game.js` 與 `git diff --check` 通過。Chrome／bundled Playwright 以 1920×1080、1366×768、932×430 驗證選招、碰撞、融合、衝擊波、Boss 受擊與失敗碎裂；選招 Boss 為 `display:none`／`visibility:hidden`／opacity 0，12 個選項 overflow 0、viewport miss 0。成功融合時兩張我方卡矩形不相交、中央文字為「雙骰融合」、Boss 仍隱藏；衝擊波階段選招 panel opacity 0 且 Boss 仍隱藏，最後 Boss 才 visible 並套用 `portrait-hit`。頁面例外與 HTTP 錯誤均為空；正式 HP 相容測試確認 1720／5160 變為 5160／5160，舊最大值 1720、現有 860 則按比例變為 2580／5160。最終截圖與 `metrics.json` 位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/qa_tot_musica_v173_final3/`。

#### Tot Musica 全程雙隊戰鬥、完整骰鏈與原版 HUD V174

- 日期：2026-08-11。
- 使用者修正：此戰從分隊後到結算都維持專用雙隊舞台，不得切回一般單人畫面；左右都要顯示我方船員 HP，兩邊各自擲完第一、第二、第三顆追加骰。敵方回合由 Tot Musica 往下同時攻擊兩名目前上場船員，任一隊倒下則從該隊自動換上存活船員。
- 畫面與文案：分隊時先隱藏 Boss，確認後在同一舞台顯示中央 Tot Musica；玩家合擊向上、Boss 攻擊向下。頂部左／中／右三條血量直接沿用一般戰鬥的 `battle_hud_player_frame.webp`／`battle_hud_enemy_frame.webp`、`.hud-name`、`.hp-track`、`.hp-fill` 與 `.hud-meta .pill`，只保留名字和 HP。分隊與行動標題縮成「左隊／右隊」，不再重複顯示現實世界、歌世界等說明。
- 權威規則：`board_game.js` 收集兩邊完整 `diceRolls` 後才建立 `tot-musica-dual-sync`；畫面仍只以第一顆骰判定奇偶，追加骰只影響各招總點數與傷害。Boss 雙擊由主遊戲分別套用兩名船員的防禦、攜帶物、被動復活與 HP，再以既有 visual event 傳給戰鬥頁，沒有由 UI 重算傷害。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/tot_musica_full_dual_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。未新增持久 `gameState` 欄位、角色／招式／道具 id、localStorage key、Socket.IO event 或 server 欄位；正式 query 為 `20260811-tot-musica-full-dual-battle-v7`。
- 驗證：`node --check public/js/board_game.js`、`public/js/board_battle.js`、`scripts/tot_musica_full_dual_qa.js` 通過。專用 QA 以 1600×900、1024×576、932×430 各走完整流程；三種 viewport 均確認分隊前 Boss 隱藏、分隊後一般卡隱藏、左右與 Boss HP 存在、兩邊各顯示三顆追加骰、Boss 向下雙擊並將兩人 HP 分別由 5000 降為 4399／2597，`errors=[]`、`failures=[]`。截圖位於 `qa_tot_musica_v174_full_dual`、`qa_tot_musica_v174_tablet`、`qa_tot_musica_v174_phone`。

#### Tot Musica 六格拖曳編隊與三秒後 Boss 登場 V175

- 日期：2026-08-11。
- 使用者修正：分隊畫面中央直接顯示左三格／右三格空白區與先發、替補順位，六名船員須由下方拖入任意格；玩家選招時不得顯示怪物。兩邊全部骰完後，第一骰不同步就碰撞碎裂；同步時只融合骰子，兩名角色往中央攻擊後與所有操作 UI 一起下沉，只留衝擊波往上三秒，Tot Musica 含原敵方框再由上方落下受擊。
- 實作：`confirmTotMusicaTeams()` 接受左右兩組有序索引，驗證六名存活船員恰好各出現一次並以第一格作為先發。戰鬥頁建立六個可拖曳順位格與六張船員卡，拖曳會交換原格內容；觸控裝置可先點船員再點目標格。選招階段移除 `enemy-present`，Boss 主卡與敵方 HUD 同時隱藏；同步成功事件滿三秒才加入 `boss-revealed`／`enemy-present` 並播放 `boss-dropping`，失敗流程從不顯示 Boss。
- 視覺：保留原左右背景、角色戰鬥卡、Boss 正式框與 HUD 圖框。衝擊波沿用既有 `shockwave_ring.webp`，修正為畫面正中央、降低過曝白光並保留藍金輪廓；不同步結果文字在碎裂期間可讀。沒有新增圖片、角色／招式／道具 id、持久頂層 state、localStorage key、Socket.IO event 或 server 欄位。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/tot_musica_full_dual_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式 query 為 `20260811-tot-musica-empty-slots-sequence-v9`。
- 驗證：專用 QA 以 1600×900、1024×576、932×430 完整走過六空格、六人編排、選招、奇偶失敗碎裂、雙方三骰、向上衝擊波、延後 Boss 落下、受擊與向下雙擊。桌機實際使用拖曳，平板與手機實際使用點選放置；三種 viewport 均為 `errors=[]`、`failures=[]`。初始六格全空、六張船員圖載入，排完六格圖亦全數載入且確認鈕才啟用；權威順位為左隊 `[0,3,2]`、右隊 `[1,4,5]`。選招與衝擊波期間 Boss 隱藏，三秒後 Boss 可見，敵方雙擊後兩名船員 HP 均由 5000 降為 4399。截圖位於 `qa_tot_musica_v175_empty_slots_desktop_final`、`qa_tot_musica_v175_empty_slots_tablet_pass`、`qa_tot_musica_v175_empty_slots_phone_pass`。

#### Tot Musica 單格骰鏈、圖片攻擊與上下鏡頭 V176

- 日期：2026-08-12。
- 使用者修正：追加骰不能排開擠壓兩張角色圖；擲骰與結果停留時間必須和一般戰鬥一致。玩家與敵方攻擊都要有三秒飛行時間，鏡頭需呈現 Boss 位於高處、兩名船員位於低處；上下攻擊特效改用正式圖片，不再只以網頁漸層光束表示。
- 骰子：左右兩隊與 Boss 各保留一個固定骰位，第一、第二、第三顆在同一格依序取代。每顆沿用一般戰鬥 `1450ms` 滾動、`78ms` 換面與 `480ms` 結果停留，單顆完整週期 `1930ms`；左右骰位移到角色框與中央分隔線之間，技能盤從開始擲骰即收下，避免遮住判定文字。奇偶、追加骰門檻、總點數與正式傷害規則不變。
- 攻擊與鏡頭：ImageGen 產生藍白金雙流向上合擊與紅紫黑音樂魔力向下攻擊兩張純色鍵 PNG，使用內建 `remove_chroma_key.py` 柔邊去背成正式透明 WebP。玩家同步成功後角色／HUD／操作盤退場，向上圖和背景升鏡完整播放三秒，Boss 才帶原框落下受擊；敵方先顯示完整骰鏈，再讓 Boss 退向畫面上緣、背景向下追鏡、兩道向下圖分別飛向左右船員，三秒到點後才切受擊圖、更新 HP。
- 素材：新增 `public/images/board/battle/tot_musica_dual/tot_musica_sync_wave_up.webp`、`tot_musica_boss_wave_down.webp`、`ATTACK_VFX_PROMPT.md`；生成來源與透明候選稿保存在同層 `incoming/`，正式頁不引用 `incoming/`。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/tot_musica_full_dual_qa.js`、`public/images/board/battle/tot_musica_dual/*`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式 query 更新為 `20260812-tot-musica-camera-wave-art-v10`。
- 同步邊界：沒有新增或改名持久 `gameState`／`battleState` 欄位、角色／招式／Boss／道具 id、localStorage key、Socket.IO event 或 server 欄位。仍由 `board_game.js` 權威計算骰鏈、奇偶、命中與傷害，只延長既有 `visualEvent.duration` 配合畫面演出。
- 驗證：`node --check` 通過 `public/js/board_game.js`、`public/js/board_battle.js` 與 `scripts/tot_musica_full_dual_qa.js`；8787 正式 `board_game.html` 回應 HTTP 200。專用 QA 以 1600×900、1024×576、932×430 各完整走過六格編隊、選招、失敗碎裂、三骰、向上圖片／升鏡、Boss 落下、受擊、敵方三骰、向下圖片／降鏡與雙人受擊，三種 viewport 均為 `errors=[]`、`failures=[]`。三骰實測約 5.97～6.00 秒，左右可見骰均為 1、與角色框相交均為 false；上下正式 WebP 全數載入且各存在 3000ms 圖片動畫，兩半背景分別套用 `totMusicaCameraRise`／`totMusicaCameraDescend`。截圖位於 `tmp/tot-musica-camera-wave-qa/desktop-final`、`tablet`、`phone`。

#### Tot Musica 垂直敵我反向鏡頭 V177

- 日期：2026-08-12。
- 使用者修正：Tot Musica 攻擊前必須先由我方位置把鏡頭往上拉，抵達高處才看見她出手，之後攻擊與鏡頭再往下打回兩名船員；不能讓 Boss 直接出現在我方中央。我方攻擊採完全相反的由下往上順序。
- 實作：敵方回合新增 2.1 秒升鏡段，期間 Boss 與敵方 HUD 隱藏、兩名船員向下退出；抵達高處才顯示 Tot Musica 原框、HP 與單格骰鏈。Boss 出手後移出上緣，兩道正式紅紫攻擊圖向左右下方飛行三秒，背景同步下降並讓兩名船員由下方回到畫面，最後才切受擊圖與 HP。玩家同步成功則保留相反流程：船員共同出招、操作 UI 下沉、正式藍白金衝擊圖與背景向上三秒，抵達高處才顯示 Boss 受擊。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/tot_musica_full_dual_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。未新增圖片、持久 state、角色／招式／Boss／道具 id、localStorage key、Socket.IO event 或 server 欄位；正式 query 更新為 `20260812-tot-musica-vertical-camera-v11`。一般戰鬥與 CPU 自動行動程式未在本輪修改。
- 驗證：`node --check` 通過 `public/js/board_game.js`、`public/js/board_battle.js` 與 `scripts/tot_musica_full_dual_qa.js`。專用 QA 以 1600×900、1024×576、932×430 各走完整編隊、選招、不同步碎裂、我方骰鏈、向上升鏡、Boss 高處受擊、敵方升鏡、Boss 高處骰鏈、三秒向下降鏡及兩名船員受擊；三種 viewport 均為 `errors=[]`、`failures=[]`。Boss 高處 top ratio 約 0.03～0.05、bottom ratio 約 0.29～0.39；敵方升鏡期間 Boss 隱藏，正式背景動畫為 `totMusicaCameraClimbToBoss`，向下追鏡為 `totMusicaCameraDescend`，兩名船員 HP 均由 5000 降為 4399。截圖位於 `tmp/tot-musica-vertical-camera-qa/desktop-final`、`tablet-final`、`phone-final`。

#### 最終之島黎明宴會不消耗回合 V178

- 日期：2026-08-12。
- 使用者定案：已通關玩家在黎明紀錄殿舉辦黎明宴會只負責免費全隊整備，不消耗目前回合。
- 實作：真人按下宴會後仍沿用 `applyFinalIslandDawnBanquet()` 恢復全員 HP、PP 與能力階段，但不再呼叫 `finishIslandServiceTurn()`；畫面重新停留在黎明紀錄殿，可接著開啟大熊肉球航路。整備服務重算衍生數值後會再依重算後最大 HP 對齊一次，避免首次宴會殘留 1 HP 缺口。只有確認轉送或按下「離開紀錄殿」才會結束目前停靠流程。全隊已完全整備時再次點擊只顯示最佳狀態，不會重複送出任務服務事件，避免免費操作反覆累積任務進度。CPU 沒有可用 Boss 指針時仍在自動整備後離島，避免自動回合反覆開啟紀錄殿。
- 文案與快取：宴會按鈕及機制說明明示「不耗回合」；`public/board_game.html` 主程式 query 更新為 `20260812-final-island-banquet-free-v1`。沒有新增或改名 state 欄位、id、localStorage key、Socket.IO event 或 server 欄位，HP／PP 及能力階段仍透過既有完整 `BOARD_GAME_STATE` 同步。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check public/js/board_game.js` 通過，8787 正式主頁與新版 JS 均回應 HTTP 200。Chrome／bundled Playwright 以 1600×900 與 932×430 實際把兩名船員設為低 HP、零 PP 及非零能力階段後點擊宴會；兩種 viewport 均完整恢復，round 與 `currentPlayerIndex` 保持不變，紀錄殿、宴會及大熊轉送按鈕仍存在。手機三個按鈕均在 viewport 且文字 overflow 為 0，頁面例外為 0；測試圖位於 `tmp/final-island-banquet-free-qa-desktop.png` 與 `tmp/final-island-banquet-free-qa-phone.png`。

#### Tot Musica 延後現身、專用舞台連續與滿血時序 V179

- 日期：2026-08-12。
- 使用者修正：Tot Musica 不可在鏡頭上移前出現，特殊戰鬥過程不可閃回舊的一般戰鬥場景，Boss 開場血條必須是滿的。
- 實作：`syncTotMusicaPersistentStage()` 在等待敵方事件時只保留左右雙世界背景與我方位置，不再預先套用 `enemy-present`；只要仍是 Tot Musica battle，專用 `tot-musica-battle-mode` 會一路維持到結算，其他暫時 visual event 也不會清掉專用舞台。玩家同步成功時以 `startSnapshot.enemy` 顯示攻擊前血量，Boss 在高處以滿血狀態現身 1.5 秒，衝擊命中才切換 `targetCombatant` 的受傷後血量與受擊圖。新的 Tot Musica 挑戰在 `startBattle()` 建立前固定回滿 5160／5160；同一 `pendingBattle` 的續戰不重置。
- 修改檔案：`public/js/board_battle.js`、`public/js/board_game.js`、`public/board_battle.html`、`public/board_game.html`、`scripts/tot_musica_full_dual_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式主頁、battle iframe 與戰鬥頁 query 更新為 `20260812-tot-musica-hidden-reveal-v12`；沒有新增圖片、持久 state、角色／招式／Boss／道具 id、localStorage key、Socket.IO event 或 server 欄位，一般戰鬥流程未修改。
- 驗證：`node --check` 通過 `public/js/board_game.js`、`public/js/board_battle.js` 與 `scripts/tot_musica_full_dual_qa.js`，8787 正式主頁回應 HTTP 200。專用 QA 不再把 Boss 改成測試 HP，先故意把島嶼狀態設為 37% 再經正式 `startBattle()`；1600×900、1280×800、932×430 三種 viewport 均在開戰取得 5160／5160。每輪約 1664～1701 個 16ms 連續取樣中，一般戰鬥卡露出、專用舞台消失與 Boss 提前現身全部為 0；Boss 現身時為 5160／5160、命中後為 5024／5160，三輪皆 `errors=[]`、`failures=[]`。截圖位於 `tmp/tot-musica-hidden-reveal-v12-desktop`、`-tablet`、`-phone`。

#### Tot Musica 單一面板依序指令與控制技顯示修正 V180

- 日期：2026-08-12。
- 使用者修正：雙世界回合不可再把左右兩隊指令同時攤開。須沿用一般戰鬥的同一組「攻擊／夥伴／道具／逃跑」面板，先選左隊完整行動，再在完全相同的位置切換成右隊；兩隊都選完才送出。Tot Musica 的零威力控制招式不可假裝成向下直接攻擊並顯示 0 傷害。
- 實作：戰鬥頁以左隊、右隊兩階段重用原 `actionPanel` 與原資訊面板；標題只切換目前隊伍與船員，面板座標、尺寸、四個按鈕及圖框不變。攻擊與同隊換人改為暫存該世界行動；戰鬥道具可指定該世界隊員，逃跑也可作為該世界完整行動。左隊送出後原位切右隊，右隊送出後才呼叫既有 `battleTotDualAction`。任一隊換人、使用道具、逃跑失敗或使用非直接招式都不參與本輪同步；逃跑成功則直接結束戰鬥。
- 0 傷害原因與修正：`歌之魔王` 是 `control`／power 0，原權威計算正確不扣 HP，但舊 visual event 一律走 `enemy-striking`，因而錯誤演成向下攻擊並顯示合計 0 傷害。事件新增暫時的 `dealsDamage` 顯示旗標；直接攻擊維持向下圖與受擊動畫，控制技改為雙世界狀態場、顯示「效果命中／不造成直接傷害」，不播放向下攻擊圖、不切受擊圖、不寫 0 傷害。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/tot_musica_full_dual_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式 query 更新為 `20260812-tot-musica-sequential-command-v13`。沒有新增圖片、持久 state、角色／招式／Boss／道具 id、localStorage key、Socket.IO event 或 server 欄位；一般戰鬥行動入口未改。
- 驗證：`node --check` 通過三個修改的 JS；正式 8787 主頁 HTTP 200。專用 QA 以 1600×900、1280×800、932×430 完整走過編隊、同一指令面板左→右選招、追加骰、同步攻擊、敵方直接攻擊與控制招式，三種 viewport 均 `errors=[]`、`failures=[]`。三種尺寸的左右隊面板 `left/top/width/height` 完全相同，皆有四個指令；實測左隊同隊三名夥伴、至少一個戰鬥道具及逃跑／投降入口正常呈現。直接攻擊各造成 601 傷害；`歌之魔王` 的向下攻擊圖數量為 0、兩隊文字皆為「效果命中」、結果不含 0 傷害。截圖位於 `tmp/tot-musica-sequential-v13-desktop-final`、`-tablet`、`-phone`。

#### Tot Musica 左右獨立指令與完整 HUD V181

- 日期：2026-08-12。
- 使用者修正：V180 的單一依序面板不符合操作需求。左右兩位船員必須各有自己的四鍵面板，點擊後只在自己的半邊顯示下一層；兩邊可分別選擇，全部選定後才共同判定。上方須保留一般戰鬥會顯示的攜帶物與狀態等資訊；下方不要再寫左隊／右隊，也不要重複頭像。
- 實作：`public/js/board_battle.js` 改以 `totMusicaWorldModes`／`totMusicaWorldItemIds` 保存兩側暫時選擇，分別渲染攻擊、同隊夥伴、戰鬥道具／同隊目標、逃跑／投降；已選的一側保留結果與重新選擇按鈕，另一側繼續操作。`public/board_battle.html` 使用既有一般戰鬥指令底框與圖示建立左右各自的四鍵網格；下一層受自己的 `.postgame-world-column` 限制，不跨到另一半。下方標題只留角色名與選擇階段，移除隊別字樣及頭像。
- HUD：左右頂端原戰鬥 HUD 圖框加寬並顯示角色名、Lv、力／技／速屬性、HP、攜帶物與狀態圖示。攜帶物與狀態圖示沿用既有 popover，可點擊查看效果、結果及回合數；隱形黑型態徽章亦沿用原規則。沒有新增圖片，正式頁只重用 `battle_hud_player_frame.webp`、`battle_command_action_button_frame.webp` 與既有四枚指令圖。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/tot_musica_full_dual_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式 query 更新為 `20260812-tot-musica-dual-side-hud-v16`。沿用既有 battle snapshot、角色／招式／道具 id、localStorage key、Socket.IO event 與一般戰鬥入口；沒有新增持久 state 或 server 欄位。
- 驗證：`node --check` 通過 `public/js/board_game.js`、`public/js/board_battle.js` 與 `scripts/tot_musica_full_dual_qa.js`。Chrome／bundled Playwright 以 1600×900、1280×800、932×430 完整走過編隊、雙面板四類入口、左側子選單、左右選定、追加骰、同步攻擊、敵方直接攻擊及控制技；三種 viewport 均 `errors=[]`、`failures=[]`。兩側初始各有四個指令；左側打開四招時仍完全位於左半框，右側四鍵維持可用；夥伴選項各限同隊兩人，道具與逃跑／投降入口可用。雙 HUD 實測攜帶物文字及狀態圖示存在且可渲染；直接攻擊各造成 601 傷害，控制技不顯示假 0 傷害。截圖位於 `tmp/tot-musica-dual-side-hud-v16-desktop`、`-tablet`、`-phone`。

#### Tot Musica 完整 Boss 圖、順暢命中與攜帶物說明 V182

- 日期：2026-08-12。
- 使用者修正：點擊雙世界 HUD 攜帶物必須顯示完整敘述；我方衝擊波飛上去後不應停住等待 Boss；Tot Musica 要放大，但整張立繪與原敵方框不可被裁掉。
- 實作：攜帶物 popover 改用獨立 380px 大框，明列「目前狀態」與「完整效果」，並在專用 HUD 明確恢復按鈕／狀態圖示的 pointer events。Tot Musica 的 1024×1536 正式圖由原本接近橫向的 350×360 `cover` 小卡，改成最大 430px 寬、2:3 大直式敵方卡與 `contain`；窄版上限 300px，三種尺寸都保持完整原圖與外觀框。向上衝擊波放在 Boss 後方，開始後 2.3 秒讓 Boss 以攻擊前 HP 落位，3 秒抵達即切受擊圖及受傷後 HP，移除舊版落位後再等 1.5 秒的空檔。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/tot_musica_full_dual_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式 query 更新為 `20260812-tot-musica-impact-boss-carry-v17`；沒有新增圖片、持久 state、角色／招式／Boss／道具 id、localStorage key、Socket.IO event 或 server 欄位，一般戰鬥流程未修改。
- 驗證：`node --check` 通過 `public/js/board_game.js`、`public/js/board_battle.js` 與 `scripts/tot_musica_full_dual_qa.js`；正式 8787 戰鬥頁 HTTP 200。Chrome／bundled Playwright 以 1600×900、1280×800、932×430 完整走過編隊、攜帶物點擊、不同步碎裂、雙面板四類入口、追加骰、同步向上攻擊、Boss 高處受擊、敵方直接攻擊及控制技，三種 viewport 均 `errors=[]`、`failures=[]`。攜帶物框皆含正式道具名、目前狀態與完整效果且未超出 viewport；Boss 的 portrait natural ratio 為 2:3、`object-fit=contain`、clipped=false，實測約佔畫面高 70%～76%；事件取樣顯示現身約在衝擊波開始後 2.28 秒、命中約在 2.99 秒，現身 HP 5160／5160、命中後 5024／5160。截圖位於 `tmp/tot-musica-impact-boss-carry-v17-desktop-2`、`-tablet`、`-phone`。

#### Tot Musica 恢復原大型正方形 Boss 框 V183

- 日期：2026-08-12。
- 使用者修正：Boss 必須使用原本一般戰鬥的正方形比例，不採 V182 的 2:3 直式卡，並要在不超框的前提下盡量放大以保留 Boss 壓迫感。
- 實作：Tot Musica 敵方主卡恢復 `aspect-ratio: 1 / 1`；桌機尺寸以 42vw／72vh 約束且最高 640px，窄版在 1024×576 邏輯戰鬥舞台固定 450px，再隨整個舞台等比縮放，避免 `vh` 在手機被二次縮小。正式敵方框素材本身為 1254×1254 正方形，現在不再被拉成直式；框內 1024×1536 立繪仍使用 `object-fit: contain`，因此完整顯示且不裁切。衝擊波時序、攜帶物說明、滿血與受擊切換不變。
- 修改檔案：`public/board_battle.html`、`public/js/board_game.js`、`public/board_game.html`、`scripts/tot_musica_full_dual_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式 query 更新為 `20260812-tot-musica-large-square-boss-v19`；沒有修改戰鬥規則、傷害、狀態、持久 state 或多人同步格式。
- 驗證：`node --check` 通過 `public/js/board_battle.js`、`public/js/board_game.js` 與專用 QA。1600×900、1280×800、932×430 三種 viewport 完整流程均為 `errors=[]`、`failures=[]`；Boss 框寬高比皆為 1.000、clipped=false、立繪 `object-fit=contain`。實際框高度約為桌機 71%、平板 67%、手機 78%，現身與命中 HP 仍為 5160／5160 → 5024／5160。截圖位於 `tmp/tot-musica-large-square-boss-v19-desktop`、`-tablet-final`、`-phone-final`。

#### Tot Musica 分流直擊、可疊加加成與 Boss 預覽 V184

- 日期：2026-08-12。
- 規則：現實／歌世界都有直接攻擊骰時，同奇偶維持完整同步；不同奇偶改為兩道直線攻擊並保留 5% 基礎傷害。兩招同屬性 +50%、第一骰同點 +50%、同為特攻或同為普通攻擊 +20%，三項相加，完整同步最高 ×2.20。第一骰同點必然會同步，因此分流實際最高只會疊同屬性與同攻擊類別，為 5% ×1.70＝8.5%。沒有兩枚直接攻擊骰時仍為零傷害。
- UI／動畫：不同奇偶的骰子仍碰撞碎裂，但兩位角色接著各自出招；正式紅、藍直線透明 WebP 各沿自己的半邊向上飛三秒，鏡頭升到高處後 Boss 以原 1:1 框現身並切受擊圖與 HP。選招畫面中央新增 Tot Musica 圖示；點擊後隱藏兩位角色並顯示高處 Boss 原框、HP 及狀態圖示，再點一次或 Esc 返回，不送出行動。
- 素材：使用 ImageGen 依既有紅／藍螺旋素材生成 `tot_musica_unsynced_red_up.webp` 與 `tot_musica_unsynced_blue_up.webp`。第一版藍稿有色帶殘影，未採用；第二版單張重生後完成鍵色去背與 alpha／尺寸檢查。來源、透明候選與提示詞保存在 `public/images/board/battle/tot_musica_dual/incoming/` 與 `ATTACK_VFX_PROMPT.md`，正式頁只引用上層固定檔名。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/tot_musica_full_dual_qa.js`、`public/images/board/battle/tot_musica_dual/*`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式 query 更新為 `20260812-tot-musica-split-bonus-preview-v22`；未新增或改名持久 `gameState`／`battleState` 欄位、角色／招式／Boss／道具 id、localStorage key、Socket.IO event 或 server 欄位。
- 驗證：`node --check` 通過 `public/js/board_game.js`、`public/js/board_battle.js` 與 `scripts/tot_musica_full_dual_qa.js`；`npm start` 後正式 8787 流程可開啟。Chrome／bundled Playwright 以 1600×900、1024×576、932×430 各完整走過編隊、中央 Boss 預覽開關、不同奇偶骰碎裂、兩道直線分流升鏡／命中、左右指令、三骰同步合流、Boss 受擊、敵方升鏡與向下攻擊；三種 viewport 均為 `errors=[]`、`failures=[]`。加成矩陣實測無加成 ×1.00、同屬性 ×1.50、同點 ×1.50、同攻擊類別 ×1.20、同步全疊 ×2.20；分流基礎率 5%、可成立的最高疊加率 8.5%。Boss 預覽三種尺寸均顯示 5160／5160、正方形比例 1.000 且未超出 viewport；分流兩圖均載入並有獨立三秒動畫。截圖位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/qa_tot_musica_split_bonus_preview_v22/`。

#### Tot Musica 獨立 Boss 觀察、HUD 避讓與同步演出 V185

- 日期：2026-08-12。
- 使用者修正：升到 Boss 高處時不可殘留我方操作 UI；預覽要有明確「返回我方」；Boss 血條與敵方骰子都不能遮住 Boss；同步成功的呈現需要重新整理。
- 實作：中央魔王圖示開啟 `tot-musica-boss-view`，戰鬥頁隱藏 `infoPanel`／`actionPanel`、左右角色、HUD、骰子與分隔線，只顯示 Boss 原正方形框、框外上方 HUD，以及右下角「返回我方」按鈕。Boss 正式高處位置由 6.5% 下移到 14%；Boss HUD 維持頂端框外，敵方骰位移到左側，手機邏輯尺寸也使用相同避讓。同步成功的新 `tot_musica_sync_wave_up_v2.webp` 由內建 ImageGen 生成鍵色稿並去背，單張圖完整呈現紅藍雙流從下方交纏、中央同步爆發、上方合成單一能量長槍；舊螺旋圖保留但 V185 不再同時顯示。
- 修改檔案：`public/board_battle.html`、`public/js/board_battle.js`、`public/board_game.html`、`scripts/tot_musica_full_dual_qa.js`、`public/images/board/battle/tot_musica_dual/tot_musica_sync_wave_up_v2.webp`、`public/images/board/battle/tot_musica_dual/incoming/tot_musica_sync_wave_up_v2_*`、`public/images/board/battle/tot_musica_dual/ATTACK_VFX_PROMPT.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式 query 更新為 `20260812-tot-musica-boss-view-sync-v23`；未修改權威傷害、一般戰鬥、持久 state、id、localStorage key、Socket.IO event 或 server 格式。
- 驗證：`node --check public/js/board_battle.js` 通過；Chrome／bundled Playwright 以 1600×900、1024×576、932×430 各走過完整編隊、Boss 預覽、不同步分流、雙骰鏈、同步升鏡、Boss 受擊、敵方升鏡、Boss 骰鏈、降鏡與雙人受擊，三種 viewport 均為 `errors=[]`、`failures=[]`。預覽實測操作面板隱藏、返回按鈕可見、Boss HUD 在框外上方、骰位不與 Boss 相交；新同步圖載入且只存在單一合流動畫。截圖位於 `qa_tot_musica_boss_view_sync_v24/desktop-long-bg`、`tablet-pass`、`phone-pass`。

#### Tot Musica 連續垂直長背景 V186

- 日期：2026-08-12。
- 使用者修正：雙世界戰背景需改為超長垂直場景，讓由我方往 Boss、以及 Boss 往我方的上下鏡頭真正經過一段有距離的戰場；背景不得內建人物、血條、骰子或操作 UI。
- 素材：使用 imagegen skill，以既有藍色現實世界與紅色歌之世界背景作風格參考，生成 1024×1536 RGB 長背景。底層是左右雙圓形玩家平台，中層是紅藍能量、漂浮廢墟與樂譜構成的垂直通道，頂層是管風琴與圓形高台組成的魔王領域。原 PNG 保存在 `public/images/board/battle/tot_musica_dual/incoming/tot_musica_vertical_world_background_source_v1.png`；正式 RGB WebP 為 `tot_musica_vertical_world_background.webp`，正式頁不引用 `incoming/`。
- 實作：左右 `tot-musica-dual-pane` 仍各自裁切 50%，但共同引用同一長背景並以三倍舞台高度顯示。平時定位底層；`totMusicaCameraRise`／`totMusicaCameraClimbToBoss` 在三秒內移動 66.6667% 到頂層；`totMusicaCameraDescend` 反向回到底層；Boss 預覽直接定位頂層。窄螢幕 Boss 框調為 400px 並保留 HUD 間距。未改傷害、骰子、戰鬥 state、角色／招式／道具 id、localStorage key、Socket.IO event 或一般戰鬥流程。正式 query 更新為 `20260812-tot-musica-boss-view-sync-v24`。
- 驗證：正式背景解碼為 1024×1536 RGB WebP。專用 QA 以 1600×900、1024×576、932×430 各完整走過上述全流程，三種 viewport 均為 `errors=[]`、`failures=[]`；玩家選招停在底層雙平台，Boss 預覽與 Boss 骰鏈位於頂層管風琴平台，上下攻擊期間相同 `::before` 分別執行 `totMusicaCameraRise`／`totMusicaCameraDescend`，沒有露出舊一般戰鬥卡面。截圖同上。

#### Tot Musica 第二回合與擊倒畫面連續性 V187

- 日期：2026-08-12。
- 問題：第二回合擊倒 Tot Musica、HP 歸零並進入勝利結算時，通用左右單挑 HUD／角色卡會重新套用一般戰鬥位置；原 QA 只驗證第一回合回到選招，沒有實際送出第二次行動與擊倒 Boss。
- 實作：專用舞台顯示期間以 `display`、`visibility`、`opacity`、動畫與 transition 五層鎖定通用 HUD／角色卡，不讓通用受擊／擊倒動畫覆寫；勝負成立後加入 `battle-result-stage`，保留頂層長背景、原正方形 Boss 框與 HP 0 HUD，同時正常渲染既有勝利結算資料。Boss 觀察按鈕移除圓形魔王圖，改為中央小型 `↑ 查看 Boss`；高處返回改為底部中央 `↓ 返回我方`。
- 修改檔案：`public/board_battle.html`、`public/js/board_battle.js`、`public/board_game.html`、`scripts/tot_musica_full_dual_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式 query 更新為 `20260812-tot-musica-result-continuity-v25`；未改一般戰鬥執行、權威傷害、持久 state、id、localStorage key、Socket.IO event 或 server 格式。
- 驗證：`node --check` 通過兩個正式 JS 與 QA 腳本；8787 正式頁 HTTP 200。專用 Chrome／bundled Playwright 在 1600×900 與 932×430 都完整走過分隊、第一回合我方／敵方動畫、第二回合重新選招及直接擊倒；兩種尺寸均 `errors=[]`、`failures=[]`。第二回合兩側各重置為四個指令、殘留已選卡為 0；從送出第二次行動到 HP 0 結算共取樣 646／619 幀，通用卡可見與專用舞台缺失皆為 0 幀。結算時 Boss 為 `HP 0 / 5160`、專用 Boss 框可見，桌機與手機截圖為 `tmp/tot-musica-full-dual-qa/12-second-round-victory-result.png`、`tmp/tot-musica-full-dual-qa-phone/12-second-round-victory-result.png`。

#### Tot Musica 碰撞受擊與專用擊倒退場 V188

- 日期：2026-08-12。
- 問題：V187 只保證擊倒時不會回到舊的一般敵人位置；專用舞台在 HP 歸零後仍會重新載入一般 Boss 圖，而且通用 `knockout` 事件作用的是已隱藏的 `enemyCard`，玩家看不到真正的擊倒動作。Boss 高處現身也較像原地淡入，沒有明確與向上衝擊波迎面交會。
- 實作：我方合流／分流衝擊仍完整向上飛三秒，Tot Musica 改由高處向下壓到交會點；只有 `wave-impact` 成立的瞬間才切 `hit.webp`、更新 HP 與播放震動。致死時延後切換 `dizzy.webp`，依序播放失衡、向下墜出畫面及擊倒完成，之後才顯示既有勝利結算；勝利畫面保留頂層長背景且 Boss 不會以 HP 0 站立圖重新出現。Boss HUD 在下降落位期間先隱藏，抵達後再顯示，避免窄螢幕交疊。
- 修改檔案：`public/board_battle.html`、`public/js/board_battle.js`、`public/board_game.html`、`scripts/tot_musica_full_dual_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式 query 更新為 `20260812-tot-musica-knockout-flow-v26`；沿用現有 `hit.webp`、`dizzy.webp`，沒有新增圖片、持久 state、角色／招式／Boss／道具 id、localStorage key、Socket.IO event 或 server 欄位，一般戰鬥流程未修改。
- 驗證：`node --check` 通過 `public/js/board_battle.js`、`public/js/board_game.js` 與 QA 腳本，8787 正式主頁 HTTP 200。專用 Chrome／bundled Playwright 在 1600×900 與 932×430 均完整走到第二回合擊倒，兩種尺寸 `errors=[]`、`failures=[]`；逐幀順序為 `wave-impact` → 約 420ms 後 `boss-knockout-stagger` → 約 625ms 後 `boss-knockout-fall` → 約 1006ms 後 `boss-knockout-complete`，命中取到 `hit.webp`、失衡取到 `dizzy.webp`，通用卡露出與專用舞台缺失皆為 0 幀。桌機與手機勝利結算截圖位於 `tmp/tot-musica-knockout-v26-desktop/12-second-round-victory-result.png`、`tmp/tot-musica-knockout-v26-phone-final/12-second-round-victory-result.png`。

#### Tot Musica 第一骰判定、戰後抽取與返回地圖 V189

- 日期：2026-08-13。
- 問題：追加骰共用單一骰位後，畫面停在最後一顆追加骰，玩家無法確認實際採用的第一骰奇偶；Tot Musica 全螢幕層又蓋住勝利後的血統抽取決定。抽取尚未處理時既有結算會正確鎖住返回，但因決定框不可見，看起來像戰鬥卡死。按下返回後，Boss 線索的重要道具揭露也可能藏在 battle iframe 後方，使 `endTurn()` 等待揭露結束而無法清理戰鬥。
- 修正：雙世界骰鏈播放完畢後會把左右單格骰面恢復成各自第一骰，再以這兩個可見數字重新防呆計算奇偶；即使舊 visual event 帶錯 `synchronized`，不同奇偶仍只能碎裂、同奇偶才融合。血統抽取 root 提升到 Tot Musica 專用層上方，保留頂層長背景與敵人卡，但隱藏其下方原勝利面板，完整顯示「進行提取／不要提取」。抽取完成或放棄後才恢復返回地圖；若 Boss 線索或其他重要掉落正等待揭露，返回會先關閉 battle iframe，讓玩家在地圖頁看見並關閉揭露，再沿用既有 `endTurn()` 清除戰鬥。
- 修改檔案：`public/js/board_battle.js`、`public/css/board_lineage_extraction.css`、`public/js/board_game.js`、`public/board_battle.html`、`public/board_game.html`、`scripts/tot_musica_full_dual_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式 query 更新為 `20260813-tot-musica-parity-lineage-v30`；沒有新增圖片、持久 state、角色／招式／Boss／道具 id、localStorage key、Socket.IO event 或 server 欄位。
- 驗證：`node --check` 通過三支修改的 JS，既有 8787 正式主頁 HTTP 200。Chrome／bundled Playwright 在 1600×900 與 932×430 皆完整跑過編隊、錯誤舊同步旗標的 6／5 第一骰防呆、三骰完整同步、HP 時序、第二回合擊倒、血統抽取詢問、放棄抽取、返回地圖、約克線索揭露與戰鬥清除；兩種 viewport 均 `errors=[]`、`failures=[]`。Boss 現身時固定 5160／5160，衝擊命中才切 4861／5160；擊倒後顯示「進行提取／不要提取」，敵卡在 viewport 內且不壓住下方框，文字無 overflow；放棄後顯示「返回地圖」，返回時 battle overlay 已關閉、揭露可見，關閉後 `battleState=null`。結果圖與報告位於 `tmp/tot-musica-v30-final-desktop-3` 與 `tmp/tot-musica-v30-final-phone-5`。

#### 新聊天室完整交接文件 V190

- 日期：2026-08-13。
- 範圍：新增 `docs/NEXT_CHAT_HANDOFF_20260813.md`，把全破後第 0～13 階段、血統抽取／培育、十三 Boss／攜帶物、約克解碼、共鬥、大熊傳送與 Tot Musica V189 最新流程整理成可整段交給下一聊天室的提示詞；明定新聊天室先讀文件、只讀回報並等待確認後才修改。
- 交接基準：最新正式版本為 `20260813-tot-musica-parity-lineage-v30`；V189 的第一骰奇偶、5160 HP 時序、第二回合擊倒、血統抽取、重要道具揭露與返回地圖完整 QA 均保留。2026-07-27／07-28 交接文件改列歷史版，不得再用其中第 5／6 階段敘述覆蓋目前進度。
- 修改檔案：`docs/NEXT_CHAT_HANDOFF_20260813.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。本輪只修改文件，未修改程式、資料、素材、id、localStorage key、Socket.IO event、持久 state 或正式版本字串。
- 驗證：確認新交接文件存在且可由 UTF-8 完整讀取；`FILE_MAP.md` 已把 2026-08-13 列為最新交接，兩份舊檔明確標示為歷史。V189 完整 QA 時正式主頁為 HTTP 200；交接完成時 8787 已未啟動，本輪為文件整理，未另行重啟服務。

#### 全戰鬥傷害跳字與 Tot Musica 可讀節奏 V191

- 日期：2026-08-13。
- 使用者需求：Tot Musica 目前一輪太快、還沒看清楚就結束；所有戰鬥在真正受擊時都要像楓之谷跳出傷害數字，暴擊與普通數字須明顯不同。
- 通用跳字：`board_battle.html` 將原本只能顯示一筆的 `#damagePop` 改為非同步容器；`board_battle.js` 每次命中都建立自己的 `.damage-number` 子節點並以受擊卡中心為錨點。此段 V191 初版曾替暴擊附文字，已由 V323 移除並改為透明生成圖；普通、MISS、回復與連續攻擊獨立節點規則不變。
- 暴擊權威：`board_game.js` 只在既有狙擊瞄準鏡／巴雷特吸收瞄準鏡等已真正觸發暴擊的正式分支寫入短暫 visual metadata，通用攻擊與 Tot Musica 事件再把 `critical`／`criticalCount` 傳給 iframe。沒有新增暴擊骰、沒有重算或改傷害倍率，也沒有新增持久 state、localStorage key、Socket.IO event 或 server 欄位。
- Tot Musica 節奏：每骰改為 1800ms 滾動、800ms 停留、90ms 換面；第一骰碰撞前停 700ms，碰撞 1100ms，融合停留 1300ms，垂直鏡頭 2900ms，上下衝擊 4200ms，Boss 在發射後約 3100ms／命中前約 1100ms 落位。一輪玩家／敵方攻擊最低約 13800／14000ms，追加骰每顆再加 2600ms。玩家命中在 Boss 上方跳合計傷害，Boss 命中則在兩名船員位置各跳一次；結果說明縮成「奇偶同步 ×倍率」、「奇偶不同・分流 N%」或「招式名・兩界各 N 傷害」，並限制於原框內。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_battle.html`、`public/board_game.html`、`scripts/bullet_absorbed_items_qa.js`、`scripts/tot_musica_full_dual_qa.js`、`scripts/battle_damage_numbers_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/NEXT_CHAT_HANDOFF_20260813.md`、`docs/DEV_WORKFLOW.md`。正式 query 更新為 `20260813-battle-damage-numbers-v31`；沒有新增圖片或改動既有資料 id、戰鬥順序、傷害公式與完整快照格式。
- 驗證：`node --check` 通過兩支正式 JS 與三支相關 QA 腳本，8787 正式主頁回 HTTP 200。定向傷害 QA 在 1600×900 驗證普通 123、暴擊 456（含「暴擊」且字級更大）、三連擊 31／42／53 及 MISS 均為獨立節點，932×430 也無 viewport overflow；`errors=[]`、`failures=[]`。Tot Musica 完整 QA 走過分隊、左右選招、骰鏈、4.2 秒向上命中、敵方向下雙人受擊、第二回合擊倒、血統抽取、放棄與返回地圖，第一次因舊 3 秒門檻失敗後已按新時序更新，重跑為 `errors=[]`、`failures=[]`。舊 `bullet_absorbed_items_qa.js` 全批次在 180 秒與 420 秒兩次皆逾時且未輸出失敗，故本輪新增較小的定向 QA 驗證跳字；舊批次仍需另行維護，未被當成通過。傷害跳字截圖位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/battle_damage_numbers_20260813/`，Tot Musica 截圖與報告位於 `tmp/tot-musica-full-dual-qa/`。

#### 伽治複製兵反向逐段攔截 V192

- 日期：2026-08-13。
- 使用者需求：複製兵圖片需反向，不可平時擋住文斯莫克・伽治；只有我方攻擊時才出來擋傷害。若我方使用連擊，每一下都能打掉一名複製兵。
- 權威規則：`applyPostgameBossDamageRules()` 對玩家命中改為逐段走訪 `hitDamages`。每個仍存活的複製兵把一段正傷害改為 0 並消耗一名；兵用完後剩餘段維持原傷害。因此三兵面對 `[100,110,120,130]` 會得到 `[0,0,0,130]`。指定 `judge_clone` 也逐段清兵，但整招仍不傷伽治。原本低骰整招穿透 30%、高骰完整貫穿並只扣一兵的規則移除；每三次伽治行動補一名、上限三名不變。
- 顯示：權威傷害管線把每段是否被擋寫入短暫 `judgeCloneBlocks` visual metadata；不新增持久 state。戰鬥頁待機時不建立士兵 DOM、`judgeCloneGuardLayer` 完全隱藏，伽治原圖與框完整可見。被擋段開始時才建立一名 `scaleX(-1)` 反向士兵，由右側衝入真正命中點，承受既有命中特效、顯示藍白「擋下」並破碎退場；沒有被擋的剩餘段才讓伽治播放受擊圖及正式傷害跳字。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_battle.html`、`public/board_game.html`、`scripts/postgame_boss_mechanics_qa.js`、`scripts/judge_clone_intercept_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/FILE_MAP.md`、`docs/NEXT_CHAT_HANDOFF_20260813.md`、`docs/DEV_WORKFLOW.md`。正式 query 為 `20260813-judge-clone-intercept-v32`；沒有新增圖片、角色／招式／Boss／道具 id、localStorage key、Socket.IO event、server 欄位或持久快照欄位。
- 驗證：`node --check` 通過兩支正式 JS 與兩支相關 QA。專用 Chrome／bundled Playwright 驗證待機圖層 `hidden=true`、士兵節點 0、伽治正常圖可見；權威四段結果 `[0,0,0,130]`、逐段旗標 `[true,true,true,false]`、剩餘兵 0，指定三段對兩兵為全 0 且只標前兩段；零兵 `[80,90]` 原樣命中。正式 iframe 實拍三名反向士兵逐段衝出，依序跳三次「擋下」與一次 `-130`，清理後攔截節點 0。932×430 橫向手機士兵與伽治都在 viewport、反向成立、頁面無 overflow；兩輪均 `errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/judge_clone_intercept_20260813_v2/`。被複製兵擋住的段數即使原攻擊為暴擊也只顯示「擋下」，不疊加暴擊標籤；未被擋住的後續段數仍依原規則顯示暴擊。

#### 伽治複製兵正面護衛顯示 V193

- 日期：2026-08-13。
- 使用者修正：中文「擋下」視覺不合適；平時不要遮住伽治，但攻擊攔截期間可以讓士兵真正擋在伽治圖前。
- 顯示：攔截士兵由原 0.74 放大至 1.04，單兵容器同步加大，仍維持 `scaleX(-1)`；只有正式 `judgeCloneBlocks` 為真時出現並覆蓋伽治正面。攔截跳字改為較緊湊的英文 `GUARD`，中文保留在 aria-label，暴擊被攔截時仍不疊加暴擊標籤。
- 修改檔案：`public/board_battle.html`、`public/js/board_battle.js`、`public/board_game.html`、`scripts/judge_clone_intercept_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/FILE_MAP.md`、`docs/NEXT_CHAT_HANDOFF_20260813.md`、`docs/DEV_WORKFLOW.md`。正式 query 更新為 `20260813-judge-clone-guard-v33`；沒有新增圖片、持久 state、localStorage key、Socket.IO event 或規則數值。
- 驗證：定向正式頁 QA 通過桌機與 932×430；待機士兵節點 0、伽治可見，四段連擊仍為 `[0,0,0,130]`，三次攔截均反向且文字皆為 `GUARD`，桌機攔截士兵與伽治圖重疊約 68%，窄畫面士兵仍完整在 viewport、無水平 overflow；`errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/judge_clone_guard_20260813_v33c/`。

#### 伽治複製兵完整入框 V194

- 日期：2026-08-13。
- 使用者回報：V193 的攔截兵因放大超出 `portrait-wrap`，實際頭部／腳部會被裁掉。
- 修正：士兵改為 `78% × 88%`、下緣 `3%`、攔截峰值 1.04；窄畫面另用 `76% × 86%`、下緣 `4%`。仍正面覆蓋伽治，但整張透明素材始終留在敵方圖框內。
- QA：新增每一段攔截的 `fullyContained` 邊界判斷；三次均為 true，與伽治重疊約 51%，932×430 也在 viewport 且無 overflow，`errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/judge_clone_contain_20260813_v34/`。
- 修改檔案：`public/board_battle.html`、`public/js/board_battle.js`、`public/board_game.html`、`scripts/judge_clone_intercept_qa.js`、相關專案文件；正式 query 更新為 `20260813-judge-clone-contain-v34`，規則、數值與同步格式不變。

#### 伽治整隊攔截與隱形黑主卡換圖時序 V195

- 日期：2026-08-13。
- 使用者需求：伽治目前有幾名複製兵，就應一次衝出幾名排成護衛線，受到連擊後才逐隻飛走；新世界香吉士裝備傑爾馬66戰鬥服時，進場先顯示原圖，完整變身後才換隱形黑圖。
- 伽治顯示：戰鬥頁在攻擊事件開始時依 `judgeCloneCountBefore` 一次建立全部攔截兵，440ms 內由右側排成三兵或兩兵護衛線；真正接觸各段時再依 `judgeCloneBlocks` 將對應士兵切成 720ms 打飛動畫。隊形改為三兵 30%／50%／70% 與 0.72／0.82／0.72 倍、兩兵 32%／68% 與 0.78 倍，完整保留頭、腳與武器。正式 `[0,0,0,130]`、生產進度與同步 metadata 未改。
- 香吉士顯示：新增只作用於 battle view 的 pending 判斷。`sanjiRaidSuitState` 仍在可行動回合建立，招式／數值權威不變；只要對應變身事件仍在 `openingPassiveVisualQueue` 或為目前 `visualEvent`，序列化主卡、短暫快照、Tot Musica 角色視圖及通用戰鬥人物圖都維持新世界原名稱／圖片。事件清除後下一次 `notifyBattleWindow()` 才改送隱形黑名稱與 `stealth.webp`。未新增持久 state。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/judge_clone_intercept_qa.js`、`scripts/sanji_raid_suit_display_timing_qa.js` 與相關專案文件；正式 query 與 `BATTLE_PAGE_VERSION` 統一為 `20260813-guard-squad-sanji-timing-v35`。沒有新增圖片、角色／招式／Boss／道具 id、localStorage key、Socket.IO event、server 欄位或完整快照欄位。
- 驗證：`node --check` 通過兩支正式 JS 與兩支定向 QA。8787 正式主頁 HTTP 200。伽治 QA 在 1600×900 驗證三名士兵同時存在、全數反向且完整入框、整隊與伽治重疊總面積約 78%，再照 hit index 0／1／2 逐隻飛走；權威傷害 `[0,0,0,130]`、`GUARD` 三次與最後 `-130` 正確，清理後節點 0。932×430 兩兵同時出場仍在 viewport 且無 overflow；`errors=[]`、`failures=[]`。香吉士 QA 驗證正式邏輯已 transformed 且事件已排入時，battle view 與 DOM 仍為「新世界香吉士」及 `sanji_evolution_2/normal.webp`；動畫中相同，事件結束才同步切到「新世界香吉士・隱形黑」與 `sanji_stealth_black/stealth.webp`。932×430 圖片在 viewport 且無 overflow；`errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/judge_clone_squad_20260813_v35b/` 與 `.../sanji_raid_suit_timing_20260813_v35b/`。

#### 一般戰鬥單一動畫與受擊時序 V196

- 日期：2026-08-13。
- 使用者回報：觀看 CPU 的羅傑戰鬥時，進場像先攻擊一次、擲骰後又攻擊一次；其他戰鬥也常在攻擊尚未接觸前先切出受擊或瀕死圖。
- 根因與修正：羅傑的開場被動會降低敵方攻擊／防禦，戰鬥頁原用 `angry` 出招圖表現該 debuff；改為 `morale` 狀態發動圖，效果與數值不變。正式 iframe 開啟時，`playBattleActionAnimation()` 原本仍完整等待舊 modal 動畫後才送出正式 attack visual event；現在立即返回，正式畫面只跑 iframe 的準備、骰子、接觸與傷害時間線。`startHp`／`startSnapshot` 的既有顯示覆寫繼續把受擊圖與 HP 更新鎖在真正接觸點。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/battle_impact_order_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/NEXT_CHAT_HANDOFF_20260813.md`、`docs/DEV_WORKFLOW.md`。正式 query 與 `BATTLE_PAGE_VERSION` 統一為 `20260813-battle-impact-order-v36`；沒有修改傷害公式、CPU 選招、回合數、角色／招式／道具 id、持久 state、localStorage key、Socket.IO event 或 server 欄位。
- 驗證：`node --check` 通過兩支正式 JS 與新定向 QA；8787 的 `board_game.html` 與 V196 `board_battle.html` 均 HTTP 200。Chrome／bundled Playwright 實測羅傑開場被動為 `roger/morale.webp`、沒有 `portrait-attack`；攻擊接觸前為 `roger/normal.webp`、顯示 HP 100%、沒有受擊 class，接觸後才切 `roger/hit.webp` 並降到約 20%。932×430 無 overflow，`errors=[]`、`failures=[]`。既有傷害跳字 QA 再驗證普通 123、暴擊 456、三段 31／42／53、MISS 與手機版，亦為 `errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/battle_impact_order_20260813_v36/` 與 `.../battle_damage_numbers_20260813/`。

#### CPU 開場對話恢復與一般戰鬥時序 V197

- 日期：2026-08-13。
- 使用者回報：觀看 CPU 戰鬥時，原有的雙方開場對話完全看不到。
- 根因與修正：CPU 與開發者自動觀察共用 `devObserverBattleStep()`；舊程式遇到未完成 `prebattleIntro` 就直接呼叫 `battleMarkPrebattleIntroDone()`，因此 iframe 尚未播放便被標記完成。現在 CPU 只回報「等待戰鬥開場對話播放」，由 iframe 依序播出我方／敵方台詞並送回原有 `intro-done` 後才開始選招。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/battle_prebattle_intro_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/NEXT_CHAT_HANDOFF_20260813.md`、`docs/DEV_WORKFLOW.md`。正式 query 與 `BATTLE_PAGE_VERSION` 為 `20260813-battle-dialogue-impact-order-v37`；沒有修改台詞資料、CPU 戰術、角色／招式／道具 id、傷害／回合規則、持久 state、localStorage key、Socket.IO event 或 server 格式。
- 驗證：新增正式 iframe／CPU 定向 QA，桌機與 932×430 都確認 `phase-hero`、`phase-enemy` 依序可見；CPU 在 intro 未完成期間持續回報「等待戰鬥開場對話播放」且沒有 `playerAction`，收到 `intro-done` 後才建立招式行動，手機無 overflow，`errors=[]`。V196 單一攻擊／接觸後受擊 QA 再驗證 morale、接觸前正常圖與 100% HP、接觸後 hit 圖與約 20% HP，`failures=[]`；傷害跳字 QA 的普通 123、暴擊 456、三段 31／42／53、MISS 與手機版亦全數通過。8787 正式主頁與 V197 戰鬥頁均 HTTP 200。證據與 JSON 報告位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/battle_prebattle_intro_20260813_v37/`、`.../battle_prebattle_intro_20260813_v37_phone/`、`.../battle_impact_order_20260813_v36/` 與 `.../battle_damage_numbers_20260813/`。

#### 開場被動純演出攻擊 V198

- 日期：2026-08-13。
- 使用者釐清：開場被動可以有出手／攻擊畫面，但不能因此直接命中敵方並扣血；正式傷害仍須等之後選招與擲骰。
- 修正：`queueOpeningPassiveVisual()` 建立的 `passive-opening` 事件明記 `cosmeticOnly: true`、`damage: 0`、`hitDamages: []`。`playOpeningPassiveFx()` 對敵方 debuff 恢復使用發動者 `attack`／`angry` 姿勢，但處理器只播放出手、cut-in 與能力下降特效，沒有接觸、受擊、跳字或 HP 更新路徑。正式 iframe 仍跳過舊 modal 重複行動動畫。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/battle_opening_passive_hp_qa.js`、`scripts/battle_impact_order_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/NEXT_CHAT_HANDOFF_20260813.md`、`docs/DEV_WORKFLOW.md`。正式 query 與 `BATTLE_PAGE_VERSION` 為 `20260813-opening-passive-cosmetic-attack-v38`；沒有新增持久欄位，也沒有修改被動數值、傷害公式、CPU 戰術、回合、角色／招式／道具 id、localStorage key、Socket.IO event 或 server 格式。
- 驗證：`node --check` 通過正式 JS 與定向 QA，8787 主頁 HTTP 200。正式 CPU／羅傑對捷風逐幀實戰中，開場被動顯示 `roger/angry.webp`，敵方權威與 iframe HP 全程維持 986／986，沒有敵方受擊圖或傷害節點；之後羅傑選「神避」、骰 4，正式 attack 事件才降至 890／986。獨立接觸時序 QA 亦確認被動出手時 enemy HP 986→986、無 hit class／跳字；正式攻擊接觸前我方 HP 100% 且正常圖，接觸後才切 hit 圖與約 20% HP。932×430 無 overflow，傷害跳字普通／暴擊／三段／MISS 回歸全通過，`errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/battle_opening_passive_hp_20260813_v38/`、`.../battle_impact_order_20260813_v38/` 與 `.../battle_damage_numbers_20260813/`。

#### 血統抽取敵方卡恢復 V199

- 日期：2026-08-13。
- 使用者回報：擊倒文斯莫克・伽治後進入血統因子抽取，看不到伽治；並要求確認是否只有伽治或全部抽取來源都有相同問題。
- 根因與修正：問題不是伽治專屬。通用 KO 動畫會把敵方卡加入 `portrait-ko`、啟用隱藏標記並留下退場計時器；抽取控制器雖保留原 `#enemyCard`，但沒有取消這些擊倒狀態，因此任何抽取來源都可能在較慢 callback 執行後消失。`refreshLineageExtraction()` 現在會先依正式 `scopeKey` 停止敵方 portrait／KO／fade／announce 計時器，清除隱藏標記與 attack／hit／KO class，恢復 `normal` 圖，再刷新抽取 UI。伽治複製兵護衛 timer、節點與 class 同時清空；CSS 另在抽取模式強制敵卡與 portrait 可見，防止舊 callback 再次淡出。
- 修改檔案：`public/js/board_battle.js`、`public/css/board_lineage_extraction.css`、`public/board_battle.html`、`public/board_game.html`、`public/js/board_game.js`、`scripts/lineage_extraction_enemy_visibility_qa.js` 與相關專案文件。正式 query 與 `BATTLE_PAGE_VERSION` 為 `20260813-lineage-enemy-restore-v39`；沒有修改抽取資格／機率、抽取器扣除、因子發放、傷害、CPU 戰術、回合、角色／敵人 id、持久 state、localStorage key、Socket.IO event 或 server 格式。
- 驗證：`node --check` 與 `git diff --check` 通過；8787 的正式主頁、戰鬥頁及伽治 normal portrait 均 HTTP 200。Chrome 定向 QA 完成十三名新 Boss 13／13 與正式可抽取圖鑑 109／109 的敵卡／圖片可見性；伽治在 1600×900 與 932×430 都顯示原正式圖，複製兵層隱藏且數量 0、無 viewport overflow，`errors=[]`、`failures=[]`。證據與報告位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/lineage_extraction_all_20260813_v39/`。

#### 抽取器選擇頁敵方卡層級 V200

- 日期：2026-08-13。
- 使用者釐清：缺少伽治的不是擊倒後「是否進行提取」詢問頁，而是按下進行後的「選擇血統因子抽取器」七連彈巢頁；該頁右側整片空白。
- 根因與修正：研究艙全螢幕 `.lineage-extraction-root` 建立 z-index 140 的背景堆疊，原敵方卡雖為 `display:grid`、圖片已解碼且 opacity 1，z-index 仍只有 100，因此整張被背景蓋住。只在 `.lineage-extraction-operation` 將 `#enemyCard` 提升至 160，讓原人物圖、外觀框與其內的三階段目標層位於研究艙背景上方；詢問／結果頁、抽取器與正式規則不變。
- QA 修正：`scripts/lineage_extraction_enemy_visibility_qa.js` 現會實際點擊 `[data-lineage-proceed]`、等待 `is-cylinder-selection`，再用卡片中心的 `elementFromPoint()` 確認最上層元素屬於敵卡，避免只檢查 CSS／圖片載入而假通過。
- 修改檔案：`public/css/board_lineage_extraction.css`、`public/js/board_game.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/lineage_extraction_enemy_visibility_qa.js` 與相關文件。正式 query 與 `BATTLE_PAGE_VERSION` 為 `20260813-lineage-operation-enemy-layer-v40`；沒有修改抽取資格／機率、抽取器扣除、因子發放、角色／敵人 id、傷害、回合、持久 state、localStorage key、Socket.IO event 或 server 格式。
- 驗證：伽治定向 QA 在 1600×900 與 932×430 都真正進入抽取器選擇頁；敵卡 z-index 160、研究艙 140，`enemyIsTopLayer=true`，正式 1024×1536 portrait 完整解碼，複製兵層隱藏且數量 0、無 viewport overflow，`errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/lineage_extraction_judge_picker_20260813_v40/`。

#### 蛋頭島原地圖斜向五格航路 V201

- 日期：2026-08-13。
- 使用者回報：蛋頭島顯現後，所有原有島嶼在查看全圖時看起來一起往左移；要求恢復原位置，蛋頭島航路可改為斜線但仍須固定五格。
- 根因：蛋頭島解鎖分支把 `boardData.mapTemplate.widthPx` 最少擴為 5692px；既有島嶼的 `pxX` 雖未更動，但 `viewWholeMap()` 依擴寬後的完整尺寸置中，因此整張既有島群相對 viewport 被推向左側。
- 修正：`ensurePostgameWorldLayout()` 一開始即以目前 `ACTIVE_MAP_LAYOUT` 的正式尺寸重設 map template；正式 override 為 5120×3976，故載入已保存 5692px 的舊快照也會恢復。蛋頭島 x 固定夾在右側 138px 安全邊界內，y 依候選起點位於地圖上／下半部選擇有足夠空間的方向斜移 620px；邏輯格同步使用 `col + 6`、`row ± 6`，繼續由既有 `buildFixedFiveTileRoute()` 產生五個不同海格。九個候選、島／路線 id、`postgameWorld` schema、錨點存檔與完整 `BOARD_GAME_STATE` 不變。
- QA：新增 `scripts/egghead_map_position_qa.js`，逐一測試上方外島、右欄七島與下方外島九種錨點；每次先注入舊 5692px 寬度再重建。結果九案皆回到 5120×3976，65 座既有島嶼的 `col`／`row`／`pxX`／`pxY` 變更數為 0，route tiles／unique tiles／sea tiles 均為 5，終點皆在 138px 安全邊界內且 x、y 同時改變。1600×900 與 932×430 正式地圖均得到 5 個海格、6 段連線、圖片解碼正常、document overflow false、`errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/egghead_map_position_20260813_v41/`。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`scripts/egghead_map_position_qa.js` 與相關專案文件。正式主頁 query 更新為 `20260813-egghead-diagonal-base-map-v41`；`BATTLE_PAGE_VERSION`／戰鬥 iframe 仍為 V200 v40。沒有新增圖片、持久 state、localStorage key、Socket.IO event 或 server 格式。

#### 血統抽取終局光束層級 V202

- 日期：2026-08-13。
- 使用者回報：文斯莫克・伽治進行血統因子抽取時，完成三階段後看不到抽取器射出的光束。
- 根因與修正：V200 把操作模式敵卡提升到 160，研究艙背景為 140；`playOutcome()` 會把 `.lineage-target-beam` 直接移到 `#battleStage`，但其原層級仍為 110，所以光束雖正常進入 `is-firing` 並播放 `lineage-beam-fire`，卻被背景與人物卡蓋住。新增只命中 `#battleStage` 直屬終局光束的層級 170，不改小遊戲光束、正式抽取計算或結果。
- 修改檔案：`public/css/board_lineage_extraction.css`、`public/js/board_game.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/lineage_extraction_enemy_visibility_qa.js` 與相關文件。正式 query 與 `BATTLE_PAGE_VERSION` 為 `20260813-lineage-outcome-beam-layer-v42`；未修改抽取資格／機率、抽取器扣除、因子發放、角色／敵人 id、傷害、回合、持久 state、localStorage key、Socket.IO event 或 server 格式。
- 驗證：`node --check` 通過，8787 正式主頁 HTTP 200。定向 QA 由伽治的「進行提取」實際進入抽取器選擇、開始小遊戲並提交三次 Perfect，等待終局光束射出後檢查：1600×900 為 686×65px、932×430 為 300×67px，兩者皆為光束 170／敵卡 160／研究艙 140、opacity 1、動畫 `lineage-beam-fire`、無 overflow，`errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/lineage_outcome_beam_20260813_v42/`。

#### 覺醒羅布・路基隨機六式 V203

- 日期：2026-08-13。
- 使用者確認的新規則：保留剃、鐵塊、紙繪、月步、指槍、嵐腳，但改成路基每次行動前隨機使用一個尚未使用的六式；各式使本回合對應能力提高 80%，六式全部使用後再施放高攻擊且必中的六王銃。六式名稱需以水墨字出現後消失，正式六張圖由使用者自行生成、去背並轉 WebP。
- 權威規則：新增六式定義表；剃／鐵塊／紙繪／月步／指槍／嵐腳分別對應速度／防禦／閃避／特防／攻擊／特攻 ×1.8。`chooseEnemyAction()` 只在非六王銃時抽取尚未使用的一式，並以 round idempotency 避免同回合的共鬥或重算重抽；六式全用後下一次固定 `postgame_lucci_ultimate_rokuogan`，威力 480、必中、無視 50% 防禦，施放後重置，保留後排 3% 非致命震傷。舊節點回血、高骰／控制拆節點全部移除。
- 顯示：正式戰鬥 view 會傳送六式 id、能力、已使用、目前生效、剩餘數及六王銃待發；iframe 新增約 2.5 秒的水墨掃痕、巨大繁體字與「能力提高 80%」淡出演出。詳細狀態框用不同樣式標記本回合六式。正式頁尚未引用未確認圖，文字水墨為安全備援。
- 素材與提示：建立 `public/images/board/battle/postgame_mechanics/lucci_six_powers/incoming/README.md`，約定 `soru.webp`、`tekkai.webp`、`kamie.webp`、`geppo.webp`、`shigan.webp`、`rankyaku.webp`；使用者完成去背後先放 `incoming/`，確認再正式歸檔與接入。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`public/js/board_battle.js`、`public/board_battle.html`、`scripts/postgame_boss_mechanics_qa.js`、`scripts/lucci_six_powers_qa.js`、六式素材 README 與相關專案文件。正式 query 與 `BATTLE_PAGE_VERSION` 為 `20260813-lucci-random-six-powers-v43`；未改敵人／招式 id、localStorage key、Socket.IO event、server 格式或一般戰鬥規則。
- 驗證：`node --check` 通過。定向瀏覽器 QA 實際抽出六式為 6／6 不重複；五個直接數值由 100 變 180，紙繪使 100 命中率變 56，六王銃固定為 480／無視 0.5／`chance:100`／`guaranteed:true`，施放後節點 6→0。1600×900 與 932×430 的水墨文字／加成皆可見、置中、無 viewport 或 document overflow，`errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/lucci_six_powers_20260813_v43/`。既有十三 Boss 全套 QA 已啟動但因逐頁流程超過本輪 180 秒工具上限而被外部終止，未取得完整報告；本輪以更新過的路基定向 QA 作正式驗證。

#### 覺醒羅布・路基六式正式水墨圖 V204

- 日期：2026-08-14。
- 素材：將使用者放入 `incoming/` 的六張去背 WebP 逐字辨識後正式歸檔為 `soru.webp`、`tekkai.webp`、`kamie.webp`、`geppo.webp`、`shigan.webp`、`rankyaku.webp`；人工複核時發現紙繪與嵐腳初始檔名互換並已更正。六張均為 1254×1254，正式頁只讀父目錄，不引用 `incoming/`。
- 顯示：六式定義表新增正式圖片路徑，行動前 visual event 送出選中六式的圖片；iframe 圖片載入成功後隱藏 HTML 大字，載入失敗才保留文字備援。因戰鬥背景與字體同為深色，圖片模式改用不規則淡米白水墨暈染提亮，不增加矩形底框；圖片放大但仍以 `contain` 維持正方形比例。
- 修改檔案：六張正式 WebP、`public/js/board_game.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/lucci_six_powers_qa.js` 與相關專案文件。正式 query 與 `BATTLE_PAGE_VERSION` 為 `20260814-lucci-six-power-art-v44`；未修改六式／招式／Boss id、數值規則、battle state schema、localStorage key、Socket.IO event、server 格式或一般戰鬥。
- 驗證：`node --check public/js/board_game.js`、`node --check public/js/board_battle.js`、`node --check scripts/lucci_six_powers_qa.js` 通過；`PORT=8794 npm start` 可啟動正式 server，`board_battle.html` HTTP 200，驗證後 listener 為 0。定向 QA 逐張解碼六張正式圖並檢查透明邊緣，全部為 1254×1254；同時再次通過六式 6／6、不重複、100→180、紙繪 100→56、六王銃 480／必中／無視 0.5／6→0。1600×900 與 932×430 的圖片、加成文字、機制框皆在 viewport，無 document overflow，`errors=[]`、`failures=[]`；人工檢查紙繪與指槍截圖確認字圖一致、置中、未擋住上下狀態列。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/lucci_six_powers_20260814_v44/`。

#### 覺醒羅布・路基六王銃素材收件區

- 日期：2026-08-14。
- 依使用者要求建立六王銃專用暫存目錄 `public/images/board/battle/postgame_mechanics/lucci_rokuogan/incoming/`，預定接收 `rokuogan_cast.webp` 發動圖與 `rokuogan_impact.webp` 命中圖。
- 本次只建立素材收件規格並更新檔案地圖；正式頁尚未引用圖片，未修改戰鬥規則、傷害、回合、持久 state、localStorage key、Socket.IO event 或 server 格式。
- 驗證：確認 README 與兩筆文件紀錄存在；待使用者放圖後再檢查尺寸、透明邊緣、構圖與桌機／手機呈現。

#### 覺醒羅布・路基行動前六式與六王銃必殺演出 V205／V206

- 日期：2026-08-14。
- 時點修正：六式改由 `postgameBossMechanicRoundStart()` 在玩家尚未操作前抽取；`chooseEnemyAction()` 不再抽式，只在六式已滿且 `rokuoganPending` 時於真正輪到路基攻擊才選擇 `postgame_lucci_ultimate_rokuogan`。抽式 visual event 維持 buff，抽取前後玩家 HP 必須相同；第六式只標記待發。
- 正式素材：使用者提供的 `rokuogan_cast.webp` 與 `rokuogan_impact.webp` 均為 1254×1254，已由 `incoming/` 移至 `public/images/board/battle/postgame_mechanics/lucci_rokuogan/`。發動圖為完整深黑背景 RGB，保留原黑焰與紅色閃電作全螢幕過場；命中圖為透明 RGBA，透明像素約 32%。
- 顯示：只有正式六王銃 attack visual event 帶 `specialFx: "lucci-rokuogan"`。戰場與頁面留白先全黑，發動圖由 0.76 倍慢慢浮現，再回縮 0.92、前衝 1.36、回到 1.06；之後透明衝擊波爆向我方。接觸時才呼叫受擊圖、逐段畫面 HP、傷害數字與震動，不提前顯示瀕死；一般戰鬥沿用既有 `playImpactFx()`。
- 修改檔案：兩張正式 WebP、`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/lucci_six_powers_qa.js` 與相關專案文件。正式 query 與 `BATTLE_PAGE_VERSION` 為 `20260814-lucci-rokuogan-art-v46`；未修改六王銃威力／必中／無視防禦、招式／Boss id、battle state schema、localStorage key、Socket.IO event、server 格式或一般戰鬥傷害管線。
- 驗證：`node --check` 通過。定向 QA 驗證六式 6／6 不重複、六次抽式前後 HP 不變、前五次敵方招式不是六王銃、第六次才為六王銃、480／必中／無視 0.5 與施放後 6→0；兩張必殺圖均解碼為 1254×1254 且正式來源不含 `incoming/`。1600×900／932×430 均通過全黑蓄力、0.92→1.36 前衝關鍵影格、衝擊命中、完整 `-321` 傷害數字與無 document overflow，`errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/lucci_six_powers_20260814_v46/`。

#### 覺醒羅布・路基六王銃語音與全黑靜音 V207

- 日期：2026-08-14。
- 使用者提供兩段 MP3：`lucci_rokuogan_call.mp3` 為路基喊六王銃，`lucci_rokuogan_hit.mp3` 為命中語音。先收入 `incoming/`，以 AudioContext 確認可解碼、長度／取樣率／前後空白／峰值正常後，移至 `public/audio/board_game/sfx/postgame_boss/lucci_rokuogan/` 正式歸檔；正式頁不引用 `incoming/`。
- 顯示與音效：正式 attack visual event 只對六王銃加入 `voiceSfx`／`hitVoiceSfx`。黑幕開始前立即鎖定並 0ms 淡出共用 BGM，停止現有一般施放／命中／狀態音效並在演出期間封鎖延遲音效；喊招語音在路基浮現時播放，命中語音與原命中衝擊音只在 3300ms 接觸點播放。演出清除或頁面離開時解除鎖定，原本有播放的 BGM 以 520ms 淡入。缺檔、解碼或 autoplay 失敗只略過語音，不阻塞戰鬥。
- 修改檔案：兩段正式 MP3、音效收件 README、`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/lucci_six_powers_qa.js`、`scripts/inspect_lucci_rokuogan_audio.js` 與相關專案文件。正式 query 與 `BATTLE_PAGE_VERSION` 為 `20260814-lucci-rokuogan-audio-v48`；沒有修改六式／六王銃數值、招式／Boss id、傷害、回合、battle state schema、localStorage key、Socket.IO event、server 格式或一般戰鬥管線。
- 音檔驗證：喊招 1.959 秒、命中 1.384 秒，兩者皆 48 kHz 雙聲道；開頭空白 0.009／0.003 秒、峰值 0.2907／0.2787、RMS 0.0463／0.0628，無爆音且正式 URL HTTP 200。
- 回歸：`node --check` 通過。正式兩段 MP3、六張六式圖與兩張必殺圖均由瀏覽器載入；1600×900／932×430 皆驗證黑幕時 `effectAudioSilenced=true`、BGM `lock→fadeOut(0)`、喊招在 cast、命中語音在 impact，結束為 `unlock→fadeIn(520)`，並保留六式 6／6、抽式零傷害、六王銃 480／必中／無視 0.5、接觸傷害數字與無 overflow，`errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/lucci_six_powers_20260814_v48/`。

#### 十三島 Boss 與洛克斯專屬戰鬥背景 V208

- 日期：2026-08-14。
- 參考與素材：依電影、動畫、遊戲及原作場景資料，生成史基至綠牛十三名 Boss 與洛克斯共十四張環境專用背景；正式輸出統一為 1920×1080 RGB WebP，中央保留雙方角色卡空間，沒有角色、文字、UI 或浮水印。PNG 原圖保存在 `postgame_boss_backgrounds/incoming/`，正式頁只引用父目錄 WebP。
- 接入：`BATTLE_BACKGROUND_BY_ENEMY_KEY` 新增十四個既有 `postgame_*` key；Tot Musica 只在通用戰鬥底層使用艾蕾吉亞背景，既有雙世界長背景與特殊鏡頭不變。未修改 Boss id、戰鬥數值、回合、掉落、血統抽取、battle state schema、localStorage key、Socket.IO event 或 server 格式。
- 修改檔案：`public/board_battle.html`、`public/js/board_battle.js`、`public/board_game.html`、`public/js/board_game.js`、十四張正式背景及十四張 PNG 原圖、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式戰鬥載入版本為 `20260814-postgame-boss-backgrounds-v49`。
- 驗證：十四張正式 WebP 全為 1920×1080 RGB 且 SHA-256 皆不重複；`node --check public/js/board_battle.js`、`node --check public/js/board_game.js`、`git diff --check` 通過，`npm start` 於獨立 8798 port 回傳 HTTP 200。Chrome 實際建立十三島戰鬥並另測洛克斯，逐張確認 `battleStage` 取得正確敵人 key、CSS 背景、HTTP 200 與 1920×1080 natural size，結果 14/14、`failures=[]`、`errors=[]`；另輸出十四張 1600×900 桌機戰鬥截圖與卡塔庫栗 932×430 橫向手機截圖，角色卡、HUD、指令與背景無裁字、重疊或破圖。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/postgame_boss_backgrounds_20260814_v49/`。

#### 魔人歐斯取代洛基、影子彩券與參考圖重畫 V209

- 日期：2026-08-14。
- 世界配置：十三座無風帶 Boss 的第 12 位由洛基改為魔人歐斯，約克第 12 張線索、島嶼、Boss 情報、專屬框、背景、機制圖示、血統抽取與掉落一併改接既有穩定 key `postgame_oars`。舊存檔若仍保存第 12 位洛基，載入正規化時會遷移成歐斯；玩家已取得的 Ragnir 不回收。洛基改為最終門檻後可在艾爾巴夫重複挑戰的王子試煉，不發約克線索，勝利仍有 10% Ragnir 與 SSS 血統抽取資格。
- 歐斯規則：固定 HP 55,555，速度、命中與閃避很低，四個直接攻擊威力很高。每位玩家行動前先選一張影子彩券，正式骰鏈全部擲完後才判定；可預測第一骰大小／點數、第二／第三骰是否出現與點數、或最終總點數。依正式機率給倍率並上限 15 袋，猜錯不扣鹽；換人、道具與逃跑使當票作廢。共鬥共享鹽袋，累積 15 袋後立即中止敵方反擊並可施放巨型鹽彈，一擊淨化歐斯後接既有勝利、掉落與血統抽取流程。CPU 只依可見機率選票，不偷看骰子。
- 掉落：新增「魔人歐斯的巨人腰帶」，固定 10% 掉落；最大 HP ×1.5、直接攻擊傷害 +20%、速度 ×0.7。
- 圖像：依使用者提供的三張動畫設定圖重新生成歐斯七種正式戰鬥狀態，保留紅色縫合屍身、極圓巨腹、骷髏鼻、雙象牙角、黃褐長髮、胸口外露肋骨、藍腰帶與腰間三顆骷髏。七張統一 1024×1536 RGB WebP，使用半身／大腿以上 2:3 戰鬥構圖；正式頁只引用 `public/images/board/battle/enemies/postgame_oars/`，生成稿與版面候選保留在 `incoming/postgame_oars/`。
- 修改檔案：`public/js/board_game.js`、`public/js/board_items.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/oars_lottery_qa.js`、歐斯七張正式戰鬥圖與相關專案文件。正式戰鬥載入版本為 `20260814-oars-lottery-v51`；沒有改名既有 localStorage key、Socket.IO event 或 server 快照格式。
- 驗證：`node --check` 通過；`npm start` 的正式 8787 頁面 HTTP 200。Chrome 定向 QA 在 1920×1080 與 932×430 驗證歐斯 55,555／55,555、27 個依當前骰鏈建立的票種、下注鎖定、15 袋鹽立即淨化、HP 歸零、勝利與血統抽取等待；兩種 viewport 都無橫向 overflow、頁面錯誤或失敗。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/oars_lottery_20260814/`。

#### 魔人歐斯七態規格與雙方向受擊修正 V210

- 日期：2026-08-14。
- 原因：V209 圖片由較小構圖以模糊背景補成 2:3，框內四周會出現羽化殘影；舊 `hit_player.webp` 又誤畫成歐斯主動向鏡頭出拳，不符合敵人相反方向受擊命名規則。
- 修正：以使用者三張動畫參考和既有正式 Boss 圖重新生成七張 1024×1536 RGB WebP。背景改為完整 Thriller Bark 夜景直接畫滿四邊，禁止模糊補邊、鏡像、羽化、輪廓光與幽靈影像；七態統一低角度、頭部至腰間三顆骷髏的畫面比例。
- 受擊：`hit.webp` 由 viewer-left 入射，歐斯向 viewer-right 後仰；`hit_player.webp` 由 viewer-right 入射，歐斯向 viewer-left 後仰。兩張皆為明確受擊反應，雙手放低，不再出拳或施法。
- 修改檔案：`public/images/board/battle/enemies/postgame_oars/` 七張正式 WebP、三張 legacy fallback、`public/images/board/incoming/postgame_oars/` V3 生成稿／預覽，以及本文件、`docs/FILE_MAP.md`、`docs/BATTLE_OPPOSITE_HIT_GENERATION_PROGRESS.md`。未修改歐斯數值、彩券、掉落、血統、戰鬥選圖程式或同步格式。
- 驗證：七張正式圖皆為 1024×1536 sRGB 三色版 WebP；桌機 1920×1080 與手機橫向 932×430 重新建立正式歐斯戰鬥，人物、背景與專屬框無模糊補邊殘影、拉伸或裁頭。歐斯 55,555 HP、27 種彩券、15 袋鹽淨化、勝利與血統抽取回歸仍通過，兩種 viewport 都無橫向 overflow，`errors=[]`。

#### 魔人歐斯先天低能力與多項鹽袋下注 V211

- 日期：2026-08-14。
- 基礎能力：移除歐斯開場的命中／閃避／速度 -3。速度固定為 18；四招依資料直接使用 48%／42%／38%／32% 命中，歐斯專屬最低命中下限為 25%；先天閃避低以我方命中 +16 個百分點計算，不生成 debuff 圖示。舊進行中快照若仍帶三項 -3，V2 正規化只在首次遷移時清除舊開場值。
- 鹽袋下注：新戰鬥開場共享 3 包；每個不同選項押 1 包，同回合可勾選多項後一次確認，猜錯失去該項押注，猜中依倍率回收。第 3、6、9……回合各補 1 包；鹽袋耗盡時不阻塞玩家行動。換人、道具或逃跑未產生正式骰鏈時退回該次押注。15 包淨化、勝利、掉落與血統抽取不變。
- 同步與相容：沿用既有 `oars-prediction` 指令名稱，但 payload 可帶 `optionIds`；正式 battle snapshot 新增陣列型下注資料並相容舊 `lockedPrediction`。沒有新增 localStorage key、Socket.IO event 或 server 權威規則。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/oars_lottery_qa.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式載入版本為 `20260814-oars-salt-betting-v52`。
- 驗證：`node --check` 三支 JS 通過，正式 8787 頁面 HTTP 200。Chrome 定向 QA 在 1920×1080 與 932×430 都驗證：歐斯 55,555／55,555、速度 18、三項舊開場降級為 0、四招首招實際命中 48%、我方 80% 招式因低閃避成為 96%；開場 3 包，分押「大」與「第一骰 6」後剩 1 包，以第一骰 5 結算為一中一失並回到 3 包，第 3 回合補到 4 包；0 包時不產生阻塞提示。15 包淨化、HP 歸零、勝利與血統抽取仍通過；多選在自動刷新後不會消失，桌機／手機無橫向 overflow、重疊、頁面錯誤。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/oars_salt_betting_20260814_v52/`。

#### 隱形黑速度增傷取最高值 V212

- 日期：2026-08-14。
- 平衡修正：隱形黑被動的「速度高於敵人時傷害 +15%」新增 `max-faster-bonus` 疊加規則；招式本身若另有同條件 +25%／+30%，正式傷害只採較高者，不再計算 `1.15 × 1.25` 或 `1.15 × 1.30`。沒有同條件增傷的招式仍取得完整被動 +15%。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式主頁快取版本為 `20260814-sanji-max-faster-bonus-v53`；未修改屬性剋制、角色／招式 id、招式威力、骰子規則、battle state schema、localStorage key、Socket.IO event 或 server 格式。
- 驗證：`node --check public/js/board_game.js` 通過；`npm start` 以 8803 port 啟動，正式 `board_game.html` HTTP 200。Chrome 定向傷害比較確認魔神風腳在速度較高時只為 `1.30`、沒有招式速度增傷時仍為 `1.15`、地獄回憶仍為 `1.15`，`errors=[]`、`failures=[]`。既有 `sanji_raid_suit_display_timing_qa.js` 於 1600×900 與 932×430 再次通過原型態→變身演出→隱形黑換圖時序，手機無 overflow；證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/sanji_raid_suit_max_bonus_20260814_v212/`。

#### 戰鬥招式只顯示威力 V213

- 日期：2026-08-14。
- 顯示修正：正式 iframe 與主頁備援戰鬥選單的傷害招式由「傷害 最低-最高」改為「威力 N」；零威力的強化、治療、護盾與控制招式維持效果技／效果內容。`damageRange` 仍作為非顯示的既有內部資料，避免改動 CPU 選招與測試工具。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式主頁快取版本為 `20260814-battle-move-power-label-v54`；未修改招式威力、傷害公式、屬性剋制、骰子、角色／招式 id、battle state schema、localStorage key、Socket.IO event 或 server 格式。
- 驗證：`node --check public/js/board_game.js`、`git diff --check` 通過；`npm start` 以 8804 port 啟動，正式 `board_game.html` HTTP 200 且載入 v54。Chrome 正式 iframe 驗證傷害招 `damageText` 為「威力 45／42／60」、零威力護盾技為「效果技」，內部 `damageRange` 仍保留；1600×900 與 932×430 都沒有顯示最低／最高傷害、按鈕越框或 document overflow，`errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/battle_move_power_labels_20260814_v213/`。

#### 圖片式彈窗長清單卷軸穩定 V214

- 日期：2026-08-14。
- 根因：背包、任務簿、攜帶物、訓練素材、外觀框、競技場與酒館等畫面在選取／裝備後會以 `openModal()` 重建同一彈窗，原可捲動 DOM 被替換後瀏覽器會回到 `scrollTop = 0`；部分清單另使用 mandatory／proximity scroll snap，觸控放開時會再次自動吸附，使下方項目看似無法點選。
- 修正：共用彈窗入口以去除行為 class 後的彈窗類型作識別，只在同類畫面重建前擷取實際可捲動元素，以 id／`data-scroll-key`／穩定 class 與同類序號對應；內容替換後立即及連續兩個 animation frame 恢復位置，資料變短時只限制到新底部。不同類彈窗不共用位置，`closeModal()` 會取消未完成的恢復。八組互動長清單的 CSS scroll snap 改為 `none`。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式主頁快取版本為 `20260814-modal-scroll-stability-v55`；未修改資料 id、道具／任務／角色／戰鬥規則、game state schema、localStorage key、Socket.IO event 或 server 格式。
- 驗證：`node --check public/js/board_game.js` 與 `git diff --check` 通過；`PORT=8805 npm start` 的 `/health` 與正式主頁 HTTP 200。Chrome 1600×900／932×430 分別驗證 15 筆背包同類重開 725→725／346→346、16 筆任務簿點選下方項目 958→958／545→545、203 筆攜帶物在下方實際裝備且資料少一筆後 9496→9496／5182→5182；三種清單 computed `scrollSnapType` 都是 `none`，頁面錯誤皆為空。人工檢查桌機與手機橫向攜帶物畫面，圖片、文字、按鈕皆在原框內，卷軸停在中後段。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/modal_scroll_stability_20260814_v214/`。

#### 魔人歐斯同選項多包鹽袋下注 V215

- 日期：2026-08-14。
- 規則：每個歐斯預測選項改為可自行投入 0～現有鹽袋數；可把全部鹽袋押在同一項，也可分配到多項。猜中回收量為「該項押注包數 × 標示倍率」，猜錯失去該項全部押注；換人、道具或逃跑沒有正式骰鏈時按實際包數完整退回。15 包上限、每 3 回合補 1 包與巨型鹽彈不變。
- UI：每個選項新增減號、目前包數與加號；底部即時顯示選中項目數、總下注及確認後餘額，總數用完時只停用加號。狀態圖示會列出每項實際押注包數。CPU 仍只讀公開機率，但可把多包分配到同一選項。
- 同步與相容：沿用既有 `oars-prediction` 指令，新增 `bets: [{ optionId, stake }]` payload；舊 `optionIds` 與 V2 battle snapshot 仍可讀取，重複選項會合併包數。沒有新增 localStorage key、Socket.IO event 或 server 權威規則。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/oars_lottery_qa.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式載入版本為 `20260814-oars-variable-stake-v56`。
- 驗證：三支 JS `node --check` 通過；`PORT=8806 npm start` 的正式頁 HTTP 200。Chrome 1920×1080／932×430 都以「第一骰為大」押 2 包、「第一骰 6 點」押 1 包，確認後 3→0；正式以第一骰 5 結算為一中一失，×2 選項按 2 包回收 4 包，第三回合再補到 5 包。兩種 viewport 都無橫向 overflow、文字重疊或頁面錯誤；55,555 HP、15 包淨化、勝利與血統抽取仍通過。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/oars_variable_stake_20260814_v56/`。

#### 隱形黑取消額外攻擊與特攻 V216

- 日期：2026-08-14。
- 平衡修正：傑爾馬66戰鬥服已經會替換為較高威力的隱形黑招式，因此移除隱形黑被動原本的攻擊 ×1.20 與特攻 ×1.10，避免能力值與招式威力雙重放大。保留防禦 ×1.30、特防 ×1.25、速度 ×1.35、速度較高增傷取最高值、光學迷彩、一次致命傷完全抵擋及完整變身演出。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`scripts/sanji_raid_suit_display_timing_qa.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式主頁快取版本為 `20260814-sanji-raid-suit-offense-balance-v57`；未修改招式威力、屬性剋制、骰子、角色／道具／招式 id、battle state schema、localStorage key、Socket.IO event 或 server 格式。
- 驗證：`node --check` 通過；`PORT=8807 npm start` 正式頁 HTTP 200。Chrome 實戰同一名新世界香吉士變身前後為攻擊 99→99、特攻 78→78、防禦 77→100、特防 79→99、速度 133→163；確認攻擊與特攻不再增加，而防禦與機動特色仍生效。原型態→五秒變身→隱形黑圖的時序、1600×900 與 932×430 圖片範圍、手機 overflow 均通過，`errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/sanji_raid_suit_offense_balance_20260814_v216/`。

#### 隱形黑光學迷彩只在 MISS 時換圖 V217

- 日期：2026-08-14。
- 顯示修正：隱形黑變身完成後、迷彩待命與重新準備迷彩時，主戰鬥卡一律使用 `normal.webp`。只有敵方直接攻擊被 `battleMoveHits()` 的光學迷彩判定擋下時，該次 attack visual event 才帶非持久 `raidSuitStealth` 標記，戰鬥頁在 MISS 接觸點短暫切換 `stealth.webp`，演出後恢復 normal。Tot Musica 雙世界敵方攻擊的個別目標結果也沿用同一標記與換圖規則。
- 規則與同步：光學迷彩仍只擋下一次敵方直接攻擊，消耗後 `stealthReady=false`；未修改命中、HP、招式、能力、道具 id、battle state schema、localStorage key、Socket.IO event 或 server 狀態。變身演出完成圖同步改為 normal。正式主頁與 battle iframe query 為 `20260814-sanji-stealth-miss-portrait-v58`。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/sanji_raid_suit_display_timing_qa.js`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/POSTGAME_BOSS_RELICS.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：三支 JS `node --check` 通過；既有正式 `npm start` 服務的 `board_game.html` HTTP 200。Chrome 1600×900 實戰確認五秒變身前／中仍為新世界香吉士原圖，完成後為 `sanji_stealth_black/normal.webp`；伽治以電磁裂踢攻擊時事件為 `miss=true`、`raidSuitStealth=true`，HP 108→108、迷彩消耗，MISS 當下 DOM 為 `stealth.webp`，隨後恢復 normal。932×430 圖片在 viewport、無 overflow，`errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/sanji_stealth_miss_portrait_20260814_v217/`。

#### 艾爾巴夫洛基改為高強度標準戰鬥 V218

- 日期：2026-08-15。
- 規則修正：洛基維持從十三座無風帶 Boss 移到艾爾巴夫王子試煉的配置；十三島第 12 位仍是魔人歐斯。艾爾巴夫洛基不再進入 `postgameBossMechanic` 管線，移除敵人端冰雲生成／消耗、可攻擊 Ragnir 目標、35% 雷神覺醒與龍人階段，戰鬥頁不再顯示洛基專屬狀態圖示或詳細框。Ragnir 作為玩家掉落攜帶物的冰雲效果保持不變。
- 強度：洛基仍為 Lv.99／SSS，敵人種子調整為 HP 2300、攻擊 108、防禦 104、特攻 82、特防 100、速度 84，開場攻擊／防禦／特防／速度各 +1；鐵雷與巨人族王拳原始威力調為 310／342。既有 Lv.99 平衡器會限制招式威力與換算能力，艾爾巴夫試煉另在平衡後保證至少 1800 HP，因此比一般 986 HP 的十三島敵人更耐打，但仍使用標準傷害公式。
- 相容：舊艾爾巴夫 pending battle 若帶 `postgameBossMechanic`、三朵冰雲、`dragon=true` 或 `dragon_normal.webp`，`normalizeBattleState()` 會清空機制、取消 `isPostgameBoss` 並恢復正式 `normal.webp`。不新增或改名 `gameState`／battle snapshot 欄位、localStorage key、Socket.IO event 或 server 欄位；10% Ragnir、SSS 血統抽取、專屬背景與敵框保持不變。
- UI 與素材：情報頁明示「標準戰鬥規則」，移除機制預覽區；洛基全程使用既有巨人王子七態半身圖。`dragon_normal.webp` 與舊冰雲圖示只保留歷史來源，正式頁不引用。主頁與 battle iframe query 更新為 `20260815-loki-standard-trial-v60`。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/postgame_boss_mechanics_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/POSTGAME_BOSS_IMAGE_PROMPTS_20260801.txt`、`docs/DEV_WORKFLOW.md`。
- 驗證：三支 JS `node --check` 與指定檔案 `git diff --check` 通過，正式 `npm start` 的 `board_game.html` 回應 HTTP 200。Chrome 1600×900 新戰確認 HP 1800、`isPostgameBoss=false`、機制物件／view 均為 `null`、專屬圖示 0、正式半身圖可解碼；注入舊三雲／龍人 pending battle 再續戰後仍為機制 `null` 與 `normal.webp`。932×430 敵卡在 viewport、無 document overflow，沒有頁面錯誤。十三島快速回歸確認 `count=13`、含歐斯、不含洛基且 13 個敵人 key 與機制 key 全部一致；完整長動畫批次在 300 秒工具上限前只完成登島截圖，因此不宣稱該批次最終通過。畫面證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/loki_standard_trial_20260815_v60/`。

#### 金獅子史基漂浮群島攻城戰 V219

- 日期：2026-08-15。
- 規則替換：移除史基舊 `floatValue`、墜地跳過行動、浮空值回升與預告式強制島嶼墜落。新機制固定建立獸王島、岩獅島、空中艦隊三座可攻擊目標，每回合結束輪替仍存活島嶼；島嶼耐久為正式 Boss 最大 HP 的 24%、最低 220。玩家可攻島或直接打史基，CPU 會優先攻擊當前島嶼。
- 傷害與階段：攻島承受完整傷害並讓 25% 貫穿史基；連擊中途破島後的剩餘段數完整打中本體。獸王島使史基直接傷害 +15%，岩獅島把本體直攻降為 35%，空中艦隊命中後波及後排最大 HP 3%；其他島護航時本體直攻保留 50%。破島不跳過史基行動，只給下一次本體直攻 +50% 破綻。三島全毀後移除護航，史基攻擊／特攻／速度 ×1.25、閃避額外下降 12 個百分點，改用四個直接攻擊並啟用島嶼墜落。
- UI 與素材：以 Codex 內建 ImageGen 生成獸王島、岩獅島、空中艦隊與三張對應崩解版，共六張 1254×1254 RGBA WebP；正式頁只引用 `shiki_archipelago/` 根目錄 WebP，PNG 來源移入 `incoming/`。戰鬥卡右下顯示可點選的當前島圖、耐久與效果，破島切換崩解圖向下墜落；原專屬狀態圖示改顯示已破島數，詳細框列出三島圖片、HP、效果與島嶼／本體目標。完整提示詞保存於 `docs/SHIKI_ARCHIPELAGO_IMAGE_PROMPTS_20260815.md`。
- 相容與同步：新狀態只放在既有 `battleState.postgameBossMechanic`，仍由完整 `BOARD_GAME_STATE` 快照同步；沒有新增 localStorage key、Socket.IO event、server 欄位或改名 Boss／招式／島嶼／掉落 id。舊進行中史基戰鬥若含浮空值欄位，正規化時會移除舊欄位並補建三島。正式主頁與 battle iframe query 更新為 `20260815-shiki-archipelago-v61`。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`public/images/board/battle/postgame_mechanics/shiki_archipelago/**`、`scripts/shiki_archipelago_qa.js`、`docs/SHIKI_ARCHIPELAGO_IMAGE_PROMPTS_20260815.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check` 通過 `board_game.js`、`board_battle.js` 與專屬 QA；`PORT=8810 npm start` 的正式 `board_game.html` 回應 HTTP 200。Chrome 定向 QA 驗證三島數量／輪替、CPU 攻島、本體 50%／岩獅 35% 減傷、獸王 +15%、攻島 25% 貫穿、連擊溢出、破島 +50% 破綻、艦隊後排損血、三島全毀決戰、四招切換、憤怒圖及舊浮空值快照遷移，結果 `errors=[]`、`failures=[]`。1600×900 與 932×430 的島圖均為 1254×1254、在敵卡範圍內、破圖 0，三島詳細框沒有文字 overflow；一般攻擊命中時序回歸 `battle_impact_order_qa.js` 也為 `errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/shiki_archipelago_20260815_v61/`。

#### 金獅子史基三島同場與完整墜落 V220

- 日期：2026-08-15。
- 規則修正：獸王島、岩獅島、空中艦隊改為開戰時三座同時存在，玩家可分別選擇 `shiki_island_beast`、`shiki_island_lion`、`shiki_island_fleet` 或史基本體；不再逐回合輪替。三座效果各自維持到對應島被擊破，仍有任一島時本體直攻保留 50%，岩獅島存活時保留 35%；CPU 依岩獅→獸王→艦隊順序選擇目標。既有 legacy `shiki_active_island` 仍作為進行中舊指令的安全別名。
- 耐久與相容：每座島耐久由史基當場最大 HP 的 24%／最低 220 提高為 60%／最低 900。`archipelagoVersion` 提升至 2；舊進行中戰鬥依原本剩餘 HP 百分比換算到新耐久，已毀島維持已毀，不新增 localStorage key、Socket.IO event、server 欄位或獨立持久化資料。
- UI：三座正式島圖同時沿敵方角色框左緣縱向排列，大部分可跨出框線但仍留在可視範圍；各島有自己的名稱、900/900 耐久、效果與點選光暈。破島只讓對應島切換崩解圖，以 1600ms 動畫一路向下移動 120vh、完全離開畫面並移除，其餘島不跳位。為避免定時 HUD 重畫造成島嶼按鈕難以點擊，戰鬥頁只在島嶼狀態或選取真正變化時重建這一區。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/shiki_archipelago_qa.js`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/GAME_RULES.md`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式主頁與 battle iframe query 為 `20260815-shiki-three-islands-v62`。
- 驗證：`node --check` 通過三支 JS。`PORT=8811 npm start` 正常啟動，正式 `board_game.html` 回應 HTTP 200 並載入 v62。Chrome 定向 QA 驗證三個島嶼目標與 900 HP、三島同時生效、岩獅存活 35%／擊破後 50%、獸王 +15%、艦隊只在存活時波及後排、25% 貫穿、連擊溢出、破綻、三島全毀決戰、舊浮空快照遷移；1600×900／932×430 都是三島同時載入、向左跨出敵框但不超出 viewport、無文件 overflow、文字與詳細框無超框，破島使用正式崩解圖且動畫後 DOM 完全移除，`errors=[]`、`failures=[]`。一般戰鬥 `battle_impact_order_qa.js` 回歸亦為 `errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/shiki_archipelago_20260815_v62/`。

#### 金獅子史基三島錯位與外框遮擋修正 V221

- 日期：2026-08-15。
- UI 修正：`shikiArchipelagoStage` 從敵方角色圖片內層移到敵方戰鬥卡的獨立直屬上層，固定層級 50，高於史基專屬外觀框層級 12；三座島改以三列網格及獨立水平錯位排列，彼此不再疊住。島群緊貼 Boss 圖框左側，能完整超出框外但仍留在 viewport；畫面上的島名／HP 縮為單行，完整機制文字仍保留在點擊狀態圖示後的詳細框。
- 相容：只調整戰鬥頁 DOM、CSS、顯示檢查與快取 query；沒有改動史基三島 HP、效果、目標、傷害、CPU 策略、破島動畫、battle state、localStorage key、Socket.IO event 或 server 欄位。正式主頁與 battle iframe query 更新為 `20260815-shiki-frame-clear-v63`。
- 修改檔案：`public/board_battle.html`、`public/board_game.html`、`public/js/board_game.js`、`scripts/shiki_archipelago_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check` 通過 `board_game.js`、`board_battle.js` 與專屬 QA；`PORT=8812 npm start` 正常啟動，正式 `board_game.html` 回應 HTTP 200 並載入 v63。Chrome 1600×900／932×430 定向 QA 確認三島 DOM 框不重疊、島群直屬 `enemyCard`、層級 50 高於外觀框 12、緊貼敵框左緣、沒有 viewport／document overflow、圖片皆為 1254×1254 且破圖 0；選島、破島崩解、完全向下消失、三島數值與舊快照遷移全數通過，`errors=[]`、`failures=[]`。一般戰鬥 `battle_impact_order_qa.js` 回歸亦為 `errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/shiki_archipelago_20260815_v63/`。

#### 大熊轉送船向與落地掌印船圖修正 V222

- 日期：2026-08-15。
- 顯示修正：大熊肉球地圖轉送仍讓外層氣泡依貝茲曲線方向旋轉，但每幀同步把相反角度寫入船圖，因此船身世界角度固定為正向，不會在向左上或大角度路段上下顛倒。抵達 Boss 島時，碗狀肉球掌印新增同一玩家船圖並精確置中；飛行氣泡中的舊船在 `arrived` 當下隱藏，落地演出只顯示一艘船，最後再銜接既有地圖船 token。
- 相容：沿用玩家當前 `shipSkin` 圖片、`pendingPostgameBossVoyage`、`final-boss-voyage`、`state.kumaPawAnimation` 與完整 `BOARD_GAME_STATE`；沒有新增或改名持久欄位、localStorage key、Socket.IO event、地圖節點、Boss 或道具 id。正式主頁與 battle iframe query 更新為 `20260815-kuma-upright-landing-ship-v64`。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/kuma_paw_ship_orientation_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check` 通過正式 JS 與專屬 QA；`PORT=8813 npm start` 正常啟動。Chrome 1600×900 實測飛行路段角度達 -116.335° 時，船圖補償為 +116.335°，合成後世界角度約 0°；1600×900 與 932×430 抵達時掌印／船圖中心差皆小於 0.001px、可見船數固定 1、船圖 861×942、破圖 0，`errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/kuma_paw_ship_20260815_v64/`。

#### 平板／手機固定桌機比例 V223

- 日期：2026-08-15。
- 顯示修正：觸控平板／手機載入 `board_game.html` 時，先轉入新的 `board_fixed_viewport.html`；外框以黑色背景承載固定 1600×900 同源遊戲 iframe，再依目前可視寬高取較小倍率等比例縮放與置中。所有地圖、HUD、彈窗、劇情與動態加入 body 的圖層因此都保持電腦版比例，不再由各自的窄版 media query 造成不同重排。桌機不轉址，戰鬥頁既有 1024×576 fitter 不變；`layout=responsive` 可停用、`layout=desktop` 可強制固定模式。
- 導航與相容：外框把房號、`online`、其他 query 與 hash 原樣傳給內頁，只追加非持久 `desktop_frame=1` 防止遞迴；內頁「返回等待室」會導向最上層視窗。沒有新增或改名 `gameState`、battle snapshot、localStorage key、Socket.IO event、server 欄位、地圖節點或資料 id。正式主頁與 battle iframe query 更新為 `20260815-fixed-desktop-ratio-v65`。
- 修改檔案：`public/board_fixed_viewport.html`、`public/board_game.html`、`public/js/board_game.js`、`public/board_battle.html`、`scripts/board_fixed_viewport_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check` 通過 `board_game.js`、`board_battle.js` 與專屬 QA；`PORT=8814 npm start` 正常啟動。Chrome 桌機 1600×900 確認不轉址；觸控平板 1024×768 的可視遊戲框為 1024×576、上下各 96px 黑邊，橫向手機 932×430 為 764.445×430、左右各約 83.78px 黑邊，直向手機 390×844 為 390×219.375 並垂直置中。三種觸控畫面的內部 viewport 都為 1600×900，房號／連線參數／hash 完整、縮放後真實點擊成功，`errors=[]`、`failures=[]`。證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/board_fixed_viewport_20260815_v65/`。

#### 所有正式遊戲頁面精確沿用 1920×900 電腦比例 V224

- 日期：2026-08-15。V223 的 1600×900 固定畫布已依使用者回報由本版取代。
- 顯示修正：`board_fixed_viewport.html` 的邏輯畫布改為使用者現有電腦畫面的 1920×900。觸控平板／手機只縮放整張畫布並保留黑邊，內部主地圖、圖片式彈窗、正式 battle iframe、推進城、頂上戰爭、水之七島與約克解碼全部取得 1920×900 viewport，因此不會再各自進入窄版 media query；桌機仍直接使用原頁面。
- 戰鬥按鈕：Chrome 正式建立一般戰鬥，電腦與平板的攻擊／夥伴／道具／逃跑按鈕均為相同座標、429.688～429.703×118.609px、字級 27px；點擊攻擊後四個招式按鈕也逐項相同，為 429.688～429.703×128.25～128.266px、字級 15px。兩端的 battle viewport 都是 1920×900，`max-width:1100px=false`、`max-height:620px=false`、`battle-viewport-fitted=false`。
- 相容：只修改固定外框尺寸、正式快取 query 與 QA；沒有修改地圖、戰鬥規則、按鈕功能、damage、game state／battle snapshot、localStorage key、Socket.IO event、server 欄位或資料 id。正式主頁與 battle iframe query 為 `20260815-exact-desktop-pages-v66`。
- 修改檔案：`public/board_fixed_viewport.html`、`public/js/board_game.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/board_fixed_viewport_qa.js`、`scripts/board_desktop_page_parity_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check` 通過兩支正式 JS 與兩支 QA；`PORT=8815 npm start` 正常啟動。1024×768 平板框為 1024×480、上下各 144px 黑邊；932×430 橫向手機框為 917.334×430、左右各約 7.33px 黑邊；390×844 直向手機框為 390×182.813 並垂直置中。三者內部皆為 1920×900、房號／連線參數／hash／真實點擊正常。戰鬥主指令與招式選擇的電腦／平板幾何比對完全一致；推進城、頂上戰爭、水之七島與約克解碼亦皆為 1920×900 且所有 1180／1120／980px 窄版查詢為 false。兩支報告皆為 `errors=[]`、`failures=[]`，證據位於 `board_fixed_viewport_20260815_v66/` 與 `board_desktop_page_parity_20260815_v66/`。

#### 金獅子漂浮群島連擊轉火與本體防護 V225

- 日期：2026-08-15。
- 規則：史基尚有任一漂浮島時，直接攻擊本體只保留 5% 傷害；岩獅島存活時只保留 2%。攻島仍吃完整傷害並有 25% 貫穿。連擊逐段記錄目標；某段擊破目前島嶼後，下一段依獸王島→岩獅島→空中艦隊的循環順序轉向下一座存活島，三島於同次連擊全毀後才讓剩餘段數直接命中史基。
- 顯示：只讓敵方 `combat-card` 容許漂浮島超框，史基本人的 `card-inner` 與 `portrait-wrap` 恢復裁切，人物不再跑出框。三島卡常駐顯示完整量化效果；點島會顯示 HP、效果、貫穿與連擊規則；Boss 詳細框加高並把三島改成三列可讀說明。連擊視覺事件新增逐段島嶼目標、逐段破島及攻擊前島群快照，使打擊與傷害數字跟著正確島嶼，破島各自向下崩落。
- 相容：沿用既有 `postgameBossMechanic.islands`、目標 id、完整 `BOARD_GAME_STATE` 快照與 battle iframe 指令，不新增頂層狀態、localStorage key、Socket.IO event 或 server 欄位。正式主頁與 battle iframe query 為 `20260815-shiki-archipelago-combo-v67`。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`public/board_battle.html`、`public/js/board_battle.js`、`scripts/shiki_archipelago_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check` 通過正式 JS 與 QA；`PORT=8815 npm start` 正常。規則實測本體 100 傷害在岩獅島存活時為 2、岩獅島擊破後為 5，破綻 150 傷害在群島護航下為 8；四段各 100 的連擊對三座各 60 HP 島嶼會依序命中獸王／岩獅／艦隊，Boss 傷害為 `[55,55,55,100]`，逐段破島旗標為 `[true,true,true,false]`。1920×900 與 932×430 皆確認史基本人框 `overflow:hidden`、敵卡 `overflow:visible`、三段島嶼效果可見、圖片完整、無頁面溢出；報告 `errors=[]`、`failures=[]` 位於 `shiki_archipelago_20260815_v67/`。

#### 推進城中央監獄門覆蓋外框 V226

- 日期：2026-08-15。
- 問題與修正：`impel_down_captive_cage_overlay.webp` 為 1024×1280，alpha 可見範圍只有 `(58,32)～(966,1248)`；100% 尺寸時可見鐵門只填滿中央內孔。依使用者確認改為讓門體覆蓋外框，正式 `.impel-image-ui .cage-overlay` 使用寬 137%、高 118.2% 並維持中心對齊，可見金屬邊緣剛好壓住中央外框。
- 相容：只調整推進城副本的監獄門覆蓋圖，不改隊長人物大小、牢籠解鎖淡出、樓層、事件、招募、指令、戰鬥、CPU、觀看方、回合、存檔、localStorage key、Socket.IO event 或 `BOARD_GAME_STATE`。推進城 iframe query 為 `20260815-impel-gate-cover-frame-v13`，主頁 query 為 `20260815-impel-gate-cover-frame-v69`。
- 修改檔案：`public/board_impel_down.html`、`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。`docs/GAME_RULES.md` 不需更新，因規則未變。
- 驗證：`node --check public/js/board_game.js`、正式頁 HTTP 200 與 `git diff --check` 通過。Chrome 1920×900 中央內孔為 297.438×380.688px，門圖元素放大為 407.484×449.969px；扣除透明邊界後可見門體約 361.3×427.5px，對齊並覆蓋外框且未碰左右相鄰介面。932×430 直接窄畫面亦無頁面 overflow、破圖或 runtime error；證據為 `impel_gate_cover_frame_v226.png` 與 `impel_gate_cover_frame_v226_phone_direct.png`。

#### 移動蛋頭島登島對話劇情 V227

- 日期：2026-08-15。
- 呈現：`openPostgameRocksModal` 在非續戰狀態先播放 `POSTGAME_EGGHEAD_ROCKS_STORY`，沿用既有 `startFinalEndingCinematicSession`、角色頭像、返回／繼續、自動、速度與略過操作。劇情分為抵達移動蛋頭島、約克公開最後部署、洛克斯甦醒三幕，最後銜接原有洛克斯情報面板。
- 相容：續戰以既有 `pendingBattle.islandId` 判斷並略過劇情；CPU 仍由 `resolveLanding` 原路徑直接開戰。沒有新增或改名 `gameState` 欄位、localStorage key、Socket.IO event、地圖節點、路線、Boss、道具或素材 id，也沒有更動蛋頭島解碼與解鎖條件。正式 query 為 `20260815-egghead-dialogue-story-v70`。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`scripts/egghead_dialogue_story_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。`docs/GAME_RULES.md` 不需更新，因遊戲規則未變。
- 驗證：`node --check` 通過正式 JS 與專屬 QA，`PORT=8817 npm start` 正常啟動。Chrome 1920×900 逐幕驗證娜美、約克、洛克斯角色圖，三個對話框固定為 1828×270px、全部位於 viewport 內，圖片載入成功、無 document overflow、runtime error 或 HTTP 錯誤；最後正確關閉劇情並顯示「蛋頭島終戰・洛克斯」情報面板。另逐句等待轉場與人物圖穩定後輸出完整 13 張對話截圖，報告 `errors=[]`、`failures=[]`，證據位於 `egghead_dialogue_story_20260815_all_13/`。

#### 拉夫德魯結局後新世界逐句對話 V228

- 日期：2026-08-16。
- 呈現：完成最終之島結局後，原本固定時間切換大標題的「無風帶消失→十三座孤島→約克部署→蛋頭島移動→研究所啟動」改為 `POSTGAME_WORLD_UNLOCK_STORY` 五幕、21 句全螢幕對話。沿用正式結局播放器的角色頭像、返回／繼續、自動、速度與跳過；既有無風帶、世界海圖、移動蛋頭島及研究設施場景圖直接作背景，沒有新增或替換正式圖片。
- 回合與同步：世界解鎖、十三島／路線建立、研究所啟用及 `postgame-world-unlock` 完整快照時點不變。取消舊 25.8 秒固定結束回合計時；只有事件指定的當前回合控制者在看完最後一句或按跳過後才解除 `resolutionLock` 並 `endTurn()`，其他 client 不會重複推進。舊存檔的研究所後續補播不帶交棒旗標，只播放劇情並返回地圖。沒有新增 `gameState` 欄位、localStorage key、Socket.IO event、地圖節點、路線、Boss 或道具 id。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`scripts/postgame_world_unlock_dialogue_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式 query 為 `20260816-postgame-world-dialogue-v71`。
- 驗證：`node --check` 通過正式 JS 與專屬 QA；`PORT=8818 npm start` 正常啟動，正式頁 HTTP 200。Chrome 1920×900 逐句輸出 21 張截圖，所有非旁白句皆有可解碼頭像，對話框／人物圖全在 viewport、無 document overflow；最後關閉 modal、`resolutionLock=false`、單人 round 3→4，地圖含 13 座 `calm-belt-island-*` 與 25 條既有 `route-postgame-*`。1180×820 平板首末幕亦無超框；報告 `errors=[]`、`failures=[]`，證據位於 `postgame_world_unlock_dialogue_20260816_v71_final/`。

#### 約克遠端得意獨白 V229

- 日期：2026-08-16。
- 劇情修正：約克不在拉夫德魯現場，因此第三幕改以旁白明示鏡頭位於「遠在蛋頭島的密室」，約克連續獨白並因計畫如預期展開而沾沾自喜；第四幕也只保留約克操作蛋頭島、取笑「那些人」與切斷訊號，不再讓魯夫、娜美、莉莉絲或佛朗基直接回應約克。第五幕仍由莉莉絲的獨立緊急通訊銜接研究所啟動。
- 相容：只修改 `POSTGAME_WORLD_UNLOCK_STORY` 台詞與正式 query，沒有新增圖片，也沒有改 21 句總數、回合交棒、世界解鎖、十三島、路線、研究所、完整快照、`gameState` 欄位、localStorage key 或 Socket.IO event。正式 query 為 `20260816-york-smug-monologue-v72`。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`；沿用 `scripts/postgame_world_unlock_dialogue_qa.js` 做完整回歸。
- 驗證：`node --check public/js/board_game.js`、`node --check scripts/postgame_world_unlock_dialogue_qa.js`、正式頁 HTTP 200 與 `git diff --check` 通過。Chrome 1920×900 重新逐句輸出 21 張截圖，約克獨白與遠方場景全部在框內；1180×820 平板首末幕無超框。完成後 `resolutionLock=false`、單人 round 3→4，地圖仍含 13 座孤島與 25 條路線；報告 `errors=[]`、`failures=[]`，證據位於 `postgame_world_unlock_dialogue_20260816_v72_york_smug/`。

#### 約克聖地逃亡與莉莉絲情報來源 V230

- 日期：2026-08-16。
- 劇情修正：五幕第一幕改從約克趁聖地戰亂逃走開始；她由盤古城地下運輸通道離開，帶走包含十三座秘密據點座標、培育資料與遠端權限的控制核心，搭預藏逃生艇返回蛋頭島。第二幕才接拉夫德魯真相解除無風帶封鎖，第三幕明示約克回到蛋頭島後插入控制核心並啟動十三座據點。
- 情報因果：第五幕先由旁白說明十三座培育槽啟動後向蛋頭島回傳確認碼，其中一段被莉莉絲保留的研究接收器截獲；莉莉絲讀到十三份完整血統因子培育紀錄後，才確認每座島正在製造複製人。喬巴再確認這是資料證據而非猜測，佛朗基才依資料反向改造醫院設備。
- 相容：沿用既有 `mary_geoise_revolution_battle.webp`、正式人物圖及研究設施背景，沒有生成新圖。只修改 `POSTGAME_WORLD_CINEMATIC_ASSETS`、`POSTGAME_WORLD_UNLOCK_STORY`、QA 內容斷言與正式 query；21 句總數、世界解鎖、十三島、25 條路線、研究所狀態、回合交棒、完整快照、localStorage key 與 Socket.IO event 均未變。正式 query 為 `20260816-york-holy-land-escape-v73`。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`scripts/postgame_world_unlock_dialogue_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check` 通過正式 JS 與專屬 QA，`PORT=8820 npm start` 正常啟動，正式頁 HTTP 200。Chrome 1920×900 重新逐句輸出 21 張截圖，新增斷言確認第 1 句同時包含聖地與約克、莉莉絲前一幕存在接收器截獲說明、莉莉絲本人明確引用培育紀錄；所有圖片、人物與文字皆在 viewport，1180×820 平板首末幕無超框。完成後 `resolutionLock=false`、單人 round 3→4，地圖仍含 13 座孤島與 25 條路線；報告 `errors=[]`、`failures=[]`，證據位於 `postgame_world_unlock_dialogue_20260816_v73_york_escape/`。

#### CPU 共鬥後進島選擇與強制視窗防卡 V231

- 日期：2026-08-16。
- 問題與修正：共鬥擊敗普通敵人島後，非最後結算者會保留 `pendingIslandServiceChoice`，輪到時進入「進島／擲骰出發」強制選擇。原流程只有真人按鈕監聽，CPU 會讓 `resolutionLock` 永久停在「進島或出發」。現在真人按鈕與 CPU 都走 `resolvePendingIslandServiceChoice()`；CPU 依實際需求進醫院、酒館或商店，沒有需求／資源時直接擲骰出發。
- 防呆：只允許 `turnStep` 對應「進島或出發」的鎖被此流程恢復；重整或 LAN 快照帶回該鎖時可重新開啟真人視窗，玩家已離島、功能已失效或島嶼不符時會清掉過期待選與自己的鎖，不會解除移動、戰鬥、交易或劇情鎖。掃描其餘強制視窗時另補上 CPU 對艾爾巴夫洛基王子試煉「挑戰／離開」按鈕的處理。
- 同步與相容：保留既有 `pendingIslandServiceChoice` 內容、`post-battle-island-choice`／`enter`／`roll` 推送名稱、完整 `BOARD_GAME_STATE`、localStorage key、Socket.IO event、島嶼與資料 id；沒有新增持久欄位。正式 `board_game.js` query 為 `20260816-cpu-post-coop-choice-v74`。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`scripts/cpu_post_coop_island_choice_qa.js`、`docs/DEV_WORKFLOW.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`。
- 驗證：`node --check` 通過正式 JS 與專屬 QA；`npm start` 正常在 8787 提供靜態頁。Chrome 實測受傷 CPU 進醫院、健康 CPU 擲骰、可招募 CPU 進酒館、沒錢 CPU 略過商店、線上房主代跑 CPU、重整後真人選擇恢復、已離島過期鎖清理，以及洛基王子試煉自動開戰；全部 `errors=[]`、`failures=[]`。

#### 戰鬥進場對話完成訊號防卡 V232

- 日期：2026-08-16。
- 根因與修正：開場對話由 battle iframe 播放，正式主頁等候 `intro-done` 才開放選招；若 iframe 已把同一段對話記為完成，但完成指令剛好在重載或同步切換時遺失，iframe 不會重播、主頁又仍為 `done=false`，真人與 CPU 都會永久停在「等待開場對話」。戰鬥頁現在遇到本機已完成但主頁未完成的同一 `id/key` 會限速重送確認；共鬥確認改用既有 battle 操作權，不再誤用一般地圖回合鎖。
- 保險：主頁以同一開場對話 `id/key` 排定一次性逾時檢查；正常六秒對話仍完整播放，只有完成回報超過預期時間仍未抵達時才自動解除該對話鎖並銜接既有開場被動。戰鬥結束、切換戰鬥或正常確認後會清除計時器，不解除其他戰鬥動畫、選招、結算、交易或劇情鎖。
- 相容：沒有新增 `gameState`／`battleState` 欄位、localStorage key、Socket.IO event 或 server 欄位；沿用既有 `prebattleIntro`、`board-battle-command`、完整 `BOARD_GAME_STATE` 與 battle iframe。正式主頁 query 為 `20260816-battle-entry-recovery-v75`，battle iframe 為 `20260816-battle-entry-recovery-v68`。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`scripts/battle_entry_recovery_qa.js`、`docs/DEV_WORKFLOW.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`。
- 驗證：正式 JS 與專屬 QA `node --check` 通過，`npm start` 正常在 8787 提供頁面。Chrome 定向重現「iframe 已完成、主頁回復未完成」後可在 5 秒內重新確認並解鎖；刻意阻斷完成指令時主頁逾時保險仍能恢復；海格遭遇的 3.45 秒襲來演出後可正常進場與選招。一般 CPU 會等完整開場對話後出招、開場被動不改 HP、攻擊受擊時序與 1920×900 畫面均通過；報告皆為 `errors=[]`、`failures=[]`、無 document overflow，證據位於 `battle_entry_recovery_20260816_v75/`、`battle_prebattle_intro_20260816_v75/`、`battle_opening_passive_20260816_v75/` 與 `battle_impact_order_20260816_v75_retry/`。

#### 電腦、平板與手機同時進遊戲同步防卡 V233

- 日期：2026-08-16。
- 根因：房主按開始後，等待室 socket 會因換到 `board_game.html` 短暫斷線；若平板／手機先載完，server 會立刻把房主交給先上線者，而且所有裝置都能在 `gamePayload` 尚未建立時各送一份不同 seed 的初始快照。初始快照抵達時，client 又仍保持 `awaitingInitialState=true`，開場流程可能被略過並讓各裝置先建立不同的選角畫面。
- 修正：遊戲開始後保留原房主 8 秒換頁重連寬限，重連即取消轉移；只有 server 認定的房主能建立第一份 `BOARD_GAME_STATE`。其他裝置維持等待並每 0.9 秒重試要求狀態，期間顯示明確同步提示；若房主確實離線超過寬限，server 才轉交在線玩家並要求新房主建立狀態。收到第一份快照前先解除 client 的等待旗標，再進入既有開場劇情／選角，避免同一快照在不同裝置走出不同 UI。
- 身分與相容：沿用既有 `userId`、`clientId`、`BOARD_JOIN_GAME`、`BOARD_GAME_STATE`、`BOARD_STATE_REQUEST` 與完整快照；只在 `BOARD_JOIN_GAME` ack 增加非持久 `canSeedState`，沒有新增 `gameState` 欄位、localStorage key 或更名事件。正式主頁 query 為 `20260816-board-lan-multi-entry-v76`。
- 修改檔案：`server/index.js`、`public/js/board_game.js`、`public/board_game.html`、`scripts/board_lan_multi_entry_qa.js`、`docs/DEV_WORKFLOW.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`。
- 驗證：`node --check` 通過 server、正式主遊戲與專屬 QA；`npm start` 正常在 8787 提供頁面。三個獨立瀏覽器身分以電腦 1600×900、平板 1024×768、手機 932×430 同房實測，另故意延遲房主 3.5 秒：平板與手機在 version 0 保持等待且無權建立快照，房主抵達後三端取得同一 seed、三個正確 `clientId`、各自唯一 `isMe`、原房主不變、開場一致。跳過劇情進入選角後，首位若為手機玩家，只有手機出現可操作轉盤，電腦與平板均無操作按鈕；深色高對比等待面板在平板與手機橫向均完整置中，`errors=[]`、`failures=[]`。證據位於 `board_lan_multi_entry_20260816_v76_final_contrast/`。

#### 玩家交易只在同格停靠觸發 V234

- 日期：2026-08-16。
- 規則：玩家逐格航行時即使經過另一名真人所在海格，也不暫停、不開交易提示；只有本次移動剩餘步數為 0，且最後停靠位置與可交易真人位於同一路線、同一海格時才詢問是否交易。CPU、島嶼與戰鬥中玩家仍不能參與交易。
- 流程與相容：保留既有 `pendingMove`、`tradePrompt`、`activeTrade`、`BOARD_GAME_STATE` 與交易 Socket 權限；只在既有海格交易入口檢查 `stepsRemaining`，沒有新增存檔欄位或事件。交易略過按鈕改為「進行停靠結算」，正式主頁 query 為 `20260816-player-trade-landing-v77`。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`scripts/player_trade_landing_only_qa.js`、`docs/DEV_WORKFLOW.md`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`。
- 驗證：`node --check` 通過正式主遊戲與專屬 QA；`npm start` 正常在 8787 提供頁面。Chrome 定向測試「剩餘 2 格經過同格玩家」不產生 prompt、不建立 resolution lock 且移動狀態與步數不變；剩餘 0 格但不同格不觸發；剩餘 0 格且同格才建立 `sea_tile_landing` prompt、停止移動並顯示停靠交易說明。另以電腦、平板、手機三個獨立身分重跑進房、唯一初始快照與選角控制權，仍為單一 seed 且只有當事裝置可操作。兩份報告皆為 `errors=[]`、`failures=[]`，證據位於 `player_trade_landing_only_20260816_v77/` 與 `board_lan_multi_entry_20260816_v77_trade/`。

#### 玩家交易圖片式介面 V235

- 日期：2026-08-16。
- 圖片：使用 Codex 內建 ImageGen，參考既有背包與存讀檔的深海藍／胡桃木／古金／繩索／青色寶石風格，新增 `public/images/board/trade_ui/trade_prompt_frame_v1.png`（1672×941）與 `trade_exchange_frame_v1.png`（1536×1024）。前者供同格交易詢問與不能交易提示共用；後者內建左右玩家報價區、右側訊息區、頂部標題與底部操作區。原始生成檔保存於 `incoming/`，完整提示詞保存為 `TRADE_UI_IMAGEGEN_PROMPTS.md`；正式頁不引用 `incoming/`。
- UI：正式雙方報價保留兩名玩家、各自頭像、物品格、放入貝里、報價價值、確認按鈕、右側雙方確認狀態與取消交易；物品格沿用既有水之七島正方形圖片框，選物列與按鈕沿用正式背包／遭遇圖片框。提示與主畫面都以固定比例縮放，不再於平板改成單欄網頁方格。文字、玩家與道具仍由 HTML 疊入，圖片中沒有寫死文字。
- 相容：只修改交易 markup class、標題與 CSS 圖片定位；沒有修改 `tradePrompt`、`activeTrade`、報價驗證、最低底價、道具／貝里轉移、雙方確認、`BOARD_GAME_STATE`、localStorage key、Socket.IO event 或 server 欄位。正式主頁 query 為 `20260816-player-trade-image-ui-v78`。
- 修改檔案：`public/board_game.html`、`public/js/board_game.js`、`public/images/board/trade_ui/**`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。`docs/GAME_RULES.md` 不需更新，因交易規則未變。
- 驗證：`node --check public/js/board_game.js` 通過；`npm start` 正常在 8787 提供正式頁。Chrome 1920×1080 與 1024×768 實測，交易詢問、雙方主框、兩名玩家、八格報價區、貝里欄、確認／取消與右側訊息均在圖框內；主框與左右玩家面板皆無水平或垂直 overflow，所有按鈕位於 viewport。不能交易提示可正常開啟與關閉。畫面證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/trade_ui_20260816/`。

#### 玩家交易透明框與頭像校正 V236

- 日期：2026-08-16。
- 圖片：接收玩家完成去背與 WebP 轉檔的兩張交易框，整理為正式 `trade_prompt_frame_v2.webp`（1672×941）與 `trade_exchange_frame_v2.webp`（1536×1024）；兩檔皆為 sRGB 四通道透明 WebP。玩家原始檔歸檔至 `public/images/board/trade_ui/incoming/*_v2_source.webp`，正式頁只引用 V2 根目錄檔案。
- 頭像：左右頭像容器由會隨欄寬拉成橢圓的區塊改為固定 1:1 正圓，角色圖以圓形 `cover` 裁切；再直接量測底圖圓框中心為左 `(362,257)`、右 `(842,257)`，左右使用獨立水平定位並把角色圖縮至約 111px 內徑。名稱、確認狀態與貝里保留在圓槽下方，不再讓角色圖或文字壓到外框。
- 相容：沒有修改交易建立、同格判定、報價、道具／貝里轉移、雙方確認、完整 `BOARD_GAME_STATE`、localStorage key、Socket.IO event 或 server 欄位。正式主頁 query 為 `20260816-player-trade-avatar-calibrated-v80`。
- 修改檔案：`public/board_game.html`、`public/images/board/trade_ui/**`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。`docs/GAME_RULES.md` 不需更新，因規則未變。
- 驗證：正式頁 HTTP 200；Chrome 1920×1080 量測左頭像中心換算為 `(362.0,257.0)`、右頭像中心換算為約 `(842.1,257.0)`，與底圖圓框中心一致；1024×768 維持同一比例，主框無水平或垂直 overflow。不能交易提示載入 V2 透明框。證據為 `trade_exchange_desktop_v3_final.png`、`trade_exchange_tablet_v3_final.png`。

#### 玩家交易右下輸入列融合 V237

- 日期：2026-08-16。
- UI：交易右下文字欄移除現代青色粗框與整塊網頁底色，改為透明深藍漸層、低亮古金邊與輕微青色內光，直接利用 `trade_exchange_frame_v2.webp` 已畫好的長槽。右側英文 `ENTER` 改成「發送」，並套用既有 `encounter_action_button_frame.webp` 古金圖片框，貼合底圖右下小槽。
- 相容：只修改 CSS 與顯示文字；文字欄仍維持既有唯讀交易狀態用途，沒有新增留言資料、存檔欄位、同步事件或交易規則。正式主頁 query 為 `20260816-player-trade-chat-style-v81`。
- 修改檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。`docs/GAME_RULES.md` 不需更新。
- 驗證：Chrome 1920×1080 實測文字槽為 249.8×57.0、按鈕為 99.1×57.0，完整落在右下底圖欄位，沒有水平或垂直 overflow；證據為 `trade_exchange_chat_v4.png`。

#### 玩家交易右側欄位貼框 V238

- 日期：2026-08-16。
- UI：右下列由交易右側區域 10% 提高至 13%，減少外圍 padding、將按鈕欄加寬至 31.5%；桌機文字槽約 246×89、按鈕約 114×89，能貼近底圖長框與小框。文字槽底色由約 48%／68% 不透明降至 16%／30%，讓底圖紋理清楚透出。
- 文字：右上交易紀錄縮小一級，左右安全邊界增加，限制 `width/max-width:100%` 並使用 `overflow-wrap:anywhere`；長系統句與玩家名稱都只能在右側金框內換行。
- 相容：只修改 CSS；沒有新增聊天功能、狀態欄位、同步事件或交易規則。正式主頁 query 為 `20260816-player-trade-chat-fit-v82`。
- 修改檔案：`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。`docs/GAME_RULES.md` 不需更新。
- 驗證：Chrome 1920×1080 與 1024×768 實測，右上四筆文字的 `scrollWidth === clientWidth`，右下輸入與按鈕皆位於主框且沒有任何 modal overflow；證據為 `trade_exchange_chat_v5_desktop.png`、`trade_exchange_chat_v5_tablet.png`。

#### 玩家交易道具格貼框 V239

- 日期：2026-08-16。
- 問題與修正：交易報價原本固定保留四排 grid 軌道，即使一般畫面只有 8 格，格子也只佔前兩排而顯得偏小、偏上。現在依 8／12／16 格寫入 2／3／4 排，8 格採兩排 4 格正方形；12／16 格則維持動態擴充並自動縮放。第一次放大後中央羅盤會覆蓋左右最內側格子，因此再為左格組的右側與右格組的左側各保留 16% 安全區。
- 版面：格子使用 1:1 比例填入左右報價底圖的可用區域，各自往外側收並完整避開中央羅盤；下方貝里輸入、報價價值及確認交易按鈕亦不受影響。沒有修改道具選擇、報價內容、交易驗證、完整 `BOARD_GAME_STATE`、localStorage key 或 Socket.IO event。正式主頁 query 為 `20260816-player-trade-slot-compass-clear-v84`。
- 修改檔案：`public/board_game.html`、`public/js/board_game.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。`docs/GAME_RULES.md` 不需更新，因交易規則未變。
- 驗證：Chrome 1920×1080 實測每格約 74.4×74.4，左側最內格右緣約 x=690、右側最內格左緣約 x=882，中央羅盤沒有覆蓋；1024×768 平板每格約 48×48，仍維持相同安全區。主框、格子與下方控制列皆無水平或垂直 overflow。證據為 `trade_exchange_slots_v7_desktop.png`、`trade_exchange_slots_v7_tablet.png`。

#### 地圖常駐 HUD 圖片式介面 V240

- 日期：2026-08-16。
- 圖片：使用 Codex 內建 ImageGen，參考正式交易框與戰鬥玩家 HUD，新增 `public/images/board/map_hud_ui/map_turn_status_frame_v1.webp`（1822×583、RGBA）。左側為透明圓形玩家頭像槽，右側為深海藍文字區；原始綠幕圖與透明處理稿保留於 `incoming/`，完整提示詞記錄於 `MAP_HUD_IMAGEGEN_PROMPTS.md`，正式頁不引用收件區。
- UI：左上 `mapTurnBanner` 與中央 `turnTransitionBanner` 共用新圖框；右上 `focusPlayerBtn`、`viewWholeMapBtn`、`saveGameBtn`、`loadGameBtn` 改用既有遭遇行動按鈕圖，`cpuSpeedControl` 與 `missionCompleteToast` 使用既有戰鬥通知框。所有原 id、文字資料、事件入口及 `renderMapTurnBanner()`／`showTurnTransitionBanner()`／`showMissionCompleteToast()` 行為保持不變。
- 響應：1920×1080、1024×768 與 932×430 的左／右 HUD 沒有重疊；完整 CPU 工具列寬度分別為 641.41、461.81、461.81px。390×844 直向版把 220px 狀態框放在上方、工具列以相同比例縮至 287.71px 並下移至 y=84，兩區無重疊且 document 無水平溢出。
- 相容：只修改 `public/board_game.html` 樣式與圖片引用，沒有修改回合、移動、CPU 決策、任務完成、存讀檔、`BOARD_GAME_STATE`、localStorage key、Socket.IO event、資料 id 或 server 欄位。正式主頁 query 為 `20260816-map-hud-image-ui-v85`。`docs/GAME_RULES.md` 不需更新，因遊戲規則未變。
- 修改檔案：`public/board_game.html`、`public/images/board/map_hud_ui/**`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`npm start` 正常在 8787 提供正式頁；Chrome 桌機、平板、手機橫向與直向均無 runtime error、document overflow 或 HUD 重疊。玩家頭像維持 1:1 圓形裁切，文字在底圖安全區內；任務提示停留後可讀，換回合框完整顯示。畫面證據位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/map_hud_ui_20260816/`。

#### 地圖 HUD 頭像圓槽精確校正 V241

- 日期：2026-08-16。
- 問題與修正：V240 頭像以目測位置放在 `top:16%`，實際會偏上並壓入金框。以正式 1822×583 RGBA 素材的 alpha 區域量測，圓槽透明內孔為 x=153～534、y=119～510，中心 `(343.5,314.5)`；左上狀態框與中央換回合框現在共同使用 `left:8.4%`、`top:21.3%`、`width:20.9%`，頭像完整落在安全內徑並與底圖圓心重合。
- 相容：只修改兩個頭像容器的 CSS 百分比與正式 query；沒有修改頭像來源、玩家資料、回合、動畫、多人快照或 Socket 流程。正式主頁 query 為 `20260816-map-hud-avatar-align-v86`。`docs/GAME_RULES.md` 不需更新。
- 修改檔案：`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`npm start` 正常在 8787 提供正式頁，`node --check public/js/board_game.js`、HTTP 200 與 `git diff --check` 通過。Chrome 將 820px 換回合框獨立量測，頭像實際中心與素材圓槽中心的差值為 x=-0.031px、y=+0.024px；四邊皆留在金框內，無裁切、空隙或拉伸。近圖證據為 `map_hud_avatar_aligned_v86_closeup.png`。

#### 地圖行動通知圖片式介面 V242

- 日期：2026-08-16。
- UI：`board-action-hud` 原本以 CSS 畫出青色／紅色／金色／紫色／綠色漸層圓角框，現在改用既有 `public/images/board/battle_command_ui/battle_command_notice_frame.webp`（1472×232、RGBA）作正式底圖；單字符號、標題與副標題改為絕對定位疊在圖片安全區，外框光暈依事件主題保留青、紅、金、紫、綠與靛色差異。
- 流程：沿用 `ensureBoardActionHud()`、`showBoardUiHud()`、原 `theme-*`、符號、標題、副標題與 900ms 以上停留時間；沒有改觀看方同步、敵人襲來、寶箱、登島、最終島事件或 `shared.showToast()`。
- 響應：1920×1080 為 620×97.7px、y=86；1024×768 與 932×430 直接窄畫面下移到 y=138；390×844 直向為 374×58.94px、y=116。四種尺寸都不碰左上玩家框、右上工具列，文字 `scrollWidth/scrollHeight` 均未超過內容區，document 無水平溢出。
- 相容：只修改 `public/board_game.html` 樣式與正式 query，沒有修改回合、擲骰、移動、事件結算、任務、CPU、`BOARD_GAME_STATE`、localStorage key、Socket.IO event 或資料 id。正式主頁 query 為 `20260816-action-notice-image-ui-v87`。`docs/GAME_RULES.md` 不需更新。
- 修改檔案：`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`npm start` 正常在 8787 提供正式頁；Chrome 四尺寸皆為 `errors=0`，通知框與文字無重疊、裁切或 overflow。觀看／戰鬥／寶箱／最終島四種主題截圖位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/action_notice_ui_20260816/action_notice_themes_v87_desktop.png`。

#### 地圖行動通知物件圖示 V243

- 日期：2026-08-16。
- 圖片：使用 Codex 內建 ImageGen，新增觀看望遠鏡、戰鬥交叉刀、寶箱、酒館酒桶、任務卷軸、醫療／研究瓶、島嶼羅盤與最終之島石碑共八張 512×512 RGBA WebP。正式素材位於 `public/images/board/map_hud_ui/action_icons/`；綠幕／洋紅幕原圖及去背檢查稿保留於 `incoming/`，提示詞與後製規格記錄於 `ACTION_NOTICE_ICON_PROMPTS.md`。
- UI：`ensureBoardActionHud()` 的左側槽改放圖片，`showBoardUiHud()` 依原有 `theme` 與 `symbol` 選擇對應圖示；「看、危、店、酒、任、醫、研、島、終」等單字符號不再寫入畫面。標題、副標題、主題光色、停留時間與 `shared.showToast()` 保持原行為。
- 響應：八張圖在 620px 通知框內統一使用約 62.61×64.47px 安全區；1920×1080、1024×768、932×430 與 390×844 的文字均沒有 overflow，通知框不碰左上玩家框或右上工具列，document 無水平溢出。
- 相容：沒有修改事件觸發、回合、擲骰、移動、島嶼結算、任務、CPU、`BOARD_GAME_STATE`、localStorage key、Socket.IO event 或資料 id。正式主頁 query 為 `20260816-action-notice-icons-v88`。`docs/GAME_RULES.md` 不需更新。
- 修改檔案：`public/board_game.html`、`public/js/board_game.js`、`public/images/board/map_hud_ui/action_icons/**`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`npm start` 正常在 8787 提供正式頁；`node --check public/js/board_game.js`、相關頁面／八張圖 HTTP 200 與 `git diff --check` 通過。Chrome 實測八圖 `naturalWidth=512`、圖示與文字皆在框內；四種 viewport 均無通知重疊或 overflow。證據為 `action_notice_icons_v88_desktop.png`，透明圖總覽為 `action_icon_contact_sheet_v88.png`。

#### 重要道具／Boss 掉落圖片式揭露 V244

- 日期：2026-08-17。
- 圖片：使用 Codex 內建 ImageGen，依正式地圖 HUD、背包與交易框的深藍、胡桃木、古銅金、青綠寶石、繩索、船燈與羅盤材質，新增 `public/images/board/item_reveal_ui/important_item_reveal_panel_frame.webp`（1672×941、RGBA）。上方是大型道具展示窗，下方是單一完整文字牌，右下保留收下提示圓槽；綠幕來源與去背稿保留於 `incoming/`，完整提示詞記錄於 `ITEM_REVEAL_UI_IMAGEGEN_PROMPT.md`，正式頁不引用收件區。
- UI：`itemRevealHud` 改為固定 16:9 圖片框；一般重要道具、Boss 專屬攜帶物與約克線索牌沿用既有動態圖片／組牌資料置入上方窗口，標題、名稱與效果文字仍由 HTML 疊在下方安全區。右下提示改用既有寶箱圖示；`queueImportantItemReveal()`、揭露佇列、點擊收下、背包入帳與等待鎖都沒有改動。
- 響應：桌機 1440×900 為 1416×796.9px，平板 1024×768 為 1000×562.8px，手機橫向 932×430 為 746.3×420px，手機直向 390×844 為 366×206px；四種尺寸都維持同一比例。一般道具、線索牌、文字牌與寶箱圖示均在底圖安全區內，document 無水平 overflow。
- 相容：沒有修改掉落率、道具 id、背包數量、回合、戰鬥結算、CPU、`BOARD_GAME_STATE`、localStorage key、Socket.IO event 或 server 欄位。正式主頁 query 為 `20260817-item-reveal-image-ui-v89`。`docs/GAME_RULES.md` 不需更新，因遊戲規則未變。
- 修改檔案：`public/board_game.html`、`public/images/board/item_reveal_ui/**`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`npm start` 正常在 8787 提供正式頁；Chrome 實測 `pierced_flag` 與 `york_clue_01_shiki`，圖片皆完整載入，揭露後點擊可關閉。五種畫面案例均無 page runtime error、文字框 overflow 或 document overflow；截圖位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/item_reveal_ui_20260817/`。

#### 四寶箱洗牌圖片式舞台 V245

- 日期：2026-08-17。
- 圖片：使用 Codex 內建 ImageGen，新增 `public/images/board/sea_chest_ui/sea_chest_shuffle_panel_frame.webp`（1672×941、RGBA）與 `sea_chest_mystery_back.webp`（1254×1254、RGBA）。主框包含四個等寬寶箱凹槽、四個小標題牌、提示牌與操作槽；翻面後四箱統一換成深藍黑木、古銅金與青色封印的神秘寶箱，不暴露木／銅／銀／金／寶石階級。原始色幕圖與透明處理稿保留在 `incoming/`，提示詞記錄於 `SEA_CHEST_UI_IMAGEGEN_PROMPTS.md`，正式頁不引用收件區。
- UI／動畫：`openSeaTreasureChestDraft()` 保留原先四個預抽候選，先顯示真實箱型；確認後依原 `finalIndex` 翻面並以 FLIP 位移讓四箱實際交叉洗牌，移動期間隱藏小標籤，停位後再顯示「寶箱 1～4」供選擇。開獎沿用 V244 的圖片框，以大型寶箱圖、動態名稱、說明、結果與右下確認圖示呈現。
- 響應：桌機 1440×900 為 1416×796.9px，平板 1024×768 為 1000×562.8px，手機橫向 932×430 為 746.3×420px，手機直向 390×844 為 366×206px；四種尺寸維持同一 16:9 桌機比例與四欄排列，窄畫面只保留黑邊，不改成兩欄或另一套介面。
- 相容：沒有修改寶箱候選權重、獎勵池、木箱陷阱、穩定亂數、選擇結果、回合、CPU、任務、`BOARD_GAME_STATE`、localStorage key、Socket.IO event 或資料 id。正式主頁 query 為 `20260817-sea-chest-image-ui-v90`。`docs/GAME_RULES.md` 不需更新，因規則未變。
- 修改檔案：`public/board_game.html`、`public/js/board_game.js`、`public/images/board/sea_chest_ui/**`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check public/js/board_game.js` 通過，`npm start` 正常在 8787 提供正式頁與兩張新 WebP。Chrome 實際播放揭露、翻面、交叉洗牌、可選狀態與開獎；桌機、平板、手機橫向及直向的四箱、文字與按鈕皆在圖片安全區內，沒有拉伸、裁切或 document overflow。截圖位於 `C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/sea_chest_ui_20260817/`。

#### 四寶箱四輪交叉洗牌 V246

- 日期：2026-08-17。
- 洗牌：原本只有一次從揭露位置直達最終位置，現在翻面後依序執行四輪不同排列；每輪以左右穿插、上下弧線、旋轉、縮放及四箱錯開起步呈現，最後一輪才落到穩定亂數決定的正式位置。完整演出約 4.55 秒，洗牌期間隱藏四個小標籤，停位後才恢復「寶箱 1～4」。偏好減少動態效果時仍保留快速停位流程。
- 排列：四箱最終位置改從 4 箱共 9 種無固定點排列中以原 seeded RNG 選取，因此每個寶箱都一定離開揭露時的原格；每個原格對其餘三個目的格仍維持等數量候選。寶箱種類抽取、候選權重、木箱陷阱、獎勵內容及點選結果都沒有改變。
- 相容：沿用既有 `choice.slotId`、`finalIndex`、點選事件、回合、CPU、任務、`BOARD_GAME_STATE`、localStorage key 與 Socket.IO event；沒有新增存檔欄位。正式主頁 query 為 `20260817-sea-chest-multi-shuffle-v91`。`docs/GAME_RULES.md` 不需更新。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check public/js/board_game.js` 通過。Chrome 對 12 組不同 `slotId` 建立正式四箱，12／12 都是四箱全換位，共取得 6 種不同排列；實播可依序看到第 1～4 輪、四箱同時移動與最後可選狀態，沒有 page error。畫面證據為 `sea_chest_v91_pass1_desktop.png`、`sea_chest_v91_pass2_desktop.png` 與 `sea_chest_v91_ready_desktop.png`。

#### 海格遭遇情報防偷看 V247

- 日期：2026-08-17。
- 原因：地圖渲染雖只會為目前偵查範圍內的遭遇格加上敵影標記，但 `inspectSeaTile()` 舊版只檢查瞭望塔 Lv2，沒有再次核對範圍；玩家因此可逐格點擊整張地圖，以「有資料／未知」差異找出所有遭遇格，並提前看到確切敵人。
- 修正：海格情報改以 `getScoutEncounterTileIds(viewer).has(tile.id)` 作唯一揭露條件。範圍外無論真實事件都顯示未知海格；範圍內的遭遇格只顯示未辨識敵影、停靠後進戰鬥，不呼叫 `pickSeaEncounterEnemy()`，也不顯示姓名、階級、等級、屬性、類型或 HP。瞭望塔 Lv2 的原有效果保留，但改為船隻真正停靠並觸發遭遇後，在開戰前介面辨識敵人。
- 相容：沒有修改海格事件生成、遭遇敵人池、實際戰鬥、偵查型範圍、地圖節點 id、存檔欄位、`BOARD_GAME_STATE`、localStorage key 或 Socket.IO event。水之七島的瞭望塔說明同步改成實際遭遇時生效；正式主頁 query 為 `20260817-sea-tile-scout-privacy-v92`。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`public/board_water_seven.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：Chrome 定向測試確認範圍外的真實遭遇格仍為未知；合法偵查範圍內只顯示敵影且沒有 `Lv.`、階級或 HP；實際停靠時瞭望塔 Lv2 會顯示完整敵人資料，Lv0 則維持「敵影未辨識」。1600×900 與 932×430 兩種 viewport 的節點情報框都完整位於畫面內、沒有內容 overflow、page error 或精確敵資外洩；證據位於 `sea_tile_privacy_20260817/`。

#### 偵查台黑色遭遇格與點擊辨識 V248

- 日期：2026-08-17。
- 規則：只有地圖查看者的船隻偵查台至少 Lv1 時，才會把目前相連航路或所在航路的遭遇海格標成黑色；黑格本身只顯示通用敵影，必須點擊後才會在節點情報框看到敵人姓名與圖像。未升級玩家看不到黑格，逐格點擊仍只會得到未知海格資訊。
- 一致性：海格敵人的穩定亂數由遊戲種子、敵影刷新週期、海格 id 與玩家 id 組成，確保同一輪內點擊預覽與真正停靠選到同一名敵人；若敵人屆時在其他戰場，仍沿用既有敵人保留與替換規則。Lv2 實際停靠前的完整敵人基本資訊及 Lv3 敵人島情報保持不變。
- 相容：沒有新增存檔欄位、localStorage key、Socket.IO event 或資料 id；仍使用完整 `BOARD_GAME_STATE` 內既有的船隻升級、海格類型與敵影刷新週期。正式主頁 query 為 `20260817-watchtower-black-encounter-v93`。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`public/board_water_seven.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check public/js/board_game.js`、正式主頁與水之七島 HTTP 200 通過。Chrome 定向測試以 3 名偵查型但偵查台 Lv0 驗證黑格 0 個、所有海格 title 皆空且點擊只顯示未知海格；同一玩家升到 Lv1 後，所在島的相連航路正確標出 5 個黑格，黑格本身只顯示通用「敵」，點擊後才顯示敵人姓名與正式戰鬥圖。相同黑格重複點擊兩次皆為同一名敵人。1600×900、1024×768 與 932×430 都沒有 page error、圖片載入失敗、可見文字重疊、modal／document overflow；畫面證據位於 `sea_tile_watchtower_20260817/`。

#### 偵查被動／偵查台雙重情報修正 V249

- 日期：2026-08-17。
- 規則修正：黑色遭遇格重新由偵查型被動第 2 階負責標示；偵查台 Lv1 只負責讓玩家點擊已出現的黑格後辨識敵人。沒有開啟偵查第 2 階時，即使偵查台升到 Lv3，也看不到黑格，點擊普通海格只能看到未知海域；有偵查第 2 階但沒有偵查台時，黑格只顯示未辨識敵影；兩者都有才顯示敵人姓名與正式戰鬥圖。
- 相容：保留瞭望台在至少 1 名偵查型時使有效人數 +1 的既有規則，因此 1 名偵查型加偵查台 Lv1 可達到第 2 階；0 名偵查型仍為 0。沒有新增存檔欄位、localStorage key、Socket.IO event 或資料 id；海格敵人的穩定預覽亂數與實際停靠保留。正式主頁 query 為 `20260817-scout-watchtower-gated-reveal-v94`。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`public/board_water_seven.html`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：Chrome 三組定向案例全部通過：0 名偵查型＋偵查台 Lv3 為 0 個黑格且普通海格保持未知；2 名偵查型＋偵查台 Lv0 顯示 5 個黑格但點擊只見未辨識敵影；2 名偵查型＋偵查台 Lv1 顯示 5 個黑格，點擊後顯示敵人姓名與已載入的正式戰鬥圖。1600×900、1024×768、932×430 都沒有 page error、可見文字 overflow、文件 overflow、圖片失敗或框外裁切；證據位於 `sea_tile_watchtower_20260817/`。

#### 最終之島後開放逝去角色招募 V250

- 日期：2026-08-17。
- 規則：艾斯、柯拉松、光月御田與哥爾·D·羅傑在全房完成最終之島結局前，不會出現在開局選角或一般酒館招募池；任一玩家完成結局並開啟終局世界後，未被任何玩家持有的四人才進入一般酒館候選。本專案的二周目即同一份遊戲完成最終之島後的終局世界，不要求重開房間。
- 例外：頂上戰爭救援沒有改動。首周目成功救出的艾斯視為存活，仍可依原處刑台／救援／登船流程加入；若艾斯已在任一玩家船上，終局酒館不會再出現第二個艾斯。舊存檔已持有四人時不移除角色；研究所與血統因子仍沿用原本終局世界開放條件。
- 相容：只新增固定角色 id 集合與一般招募池判定，沿用既有 `finalEndingCleared`、`finalEndingRecords`、`postgameWorld.unlocked` 及完整 `BOARD_GAME_STATE`。沒有新增或改名存檔欄位、localStorage key、Socket.IO event、角色 id 或 Marineford 狀態。正式主頁 query 為 `20260817-postgame-legacy-recruits-v95`。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`scripts/postgame_legacy_recruits_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check` 通過正式主程式與專屬 QA，`npm start` 正常在 8787 提供正式頁。Chrome 正式頁定向測試確認通關前四人全數不在一般招募池；終局世界開啟後四人全數出現；艾斯已由頂上戰爭加入時不會再出現第二個；舊存檔已持有柯拉松仍保留；終局舊存檔若缺少羅傑候選，正規化後會安全回補。測試結果 `errors=[]`、`failures=[]`。

#### 吉爾德・泰佐洛黃金支配戰線 V251

- 日期：2026-08-18。
- 規則：泰佐洛第一階段改為每名船員獨立的 -3～+3 七格戰線。敵方黃金攻擊命中向 +3 推 1、黃金束縛推 2；玩家直接攻擊命中向 -3 推 1，第一骰 5～6 或換用與上次不同的招式推 2。-3 重置並給下一次直攻 +50%；+2 使速度只剩 80% 且敵方命中再 +15%；+3 完全黃金化。
- 回合：若泰佐洛先攻把已選招、尚未出手的船員推到 +3，原指令立即取消；本輪結束後、下一輪開始前由玩家免費選替補，CPU 自行選擇。替補不會補打上一輪，雕像退到後排後歸零；沒有替補時使用一次性跳過後解除，避免永久卡死。
- 階段：半血後保留生命並切換 Golden Tesoro 專用正方形戰鬥圖、第二階段招式、共用戰線與兩層外殼。外殼 2／1 層時傷害保留 40%／70%；每次把戰線推到 -3 破 1 層，兩層全破後切本人憤怒圖與第三階段招式。Golden Tesoro 把戰線推到 +3 時，下一次固定施放必中「黃金神之怒」。
- 視覺：淘汰會把角色背景一起染黃的原角色複製層，正式改用 `half_body_gold_doll.webp` 透明實心半身黃金偶。第一層封住可見軀幹、第二層延伸肩頸、第三層顯示完整金面；黃金偶以固定中心與半身比例限制在玩家角色框內容區，保留原 HUD、招式與敵方卡。
- 相容：沿用既有 `postgameBossMechanic` 快照與完整 `BOARD_GAME_STATE`；機制版本 2 會把舊 `goldByCrew` 安全轉為 -3～+3 `controlByCrew`。沒有新增 localStorage key、Socket.IO event 或另一套傷害權威。主頁／戰鬥頁 query 分別更新為 `20260818-tesoro-gold-front-v118`／`20260818-tesoro-gold-front-v72`。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`public/images/board/battle/enemies/postgame_gild_tesoro_golden/`、`public/images/board/battle/postgame_mechanics/tesoro_gold_shell/half_body_gold_doll.webp`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check public/js/board_game.js` 與 `node --check public/js/board_battle.js` 通過；既有 8787 server 回傳正式戰鬥頁與黃金偶 HTTP 200。Chrome 定向流程確認泰佐洛先攻可取消已選招、免費替補不補打上一輪，Golden Tesoro 第二階段圖片／面板載入。黃金偶於 1600×900、1024×768、932×430 都維持中心對齊、透明背景與角色框裁切，沒有遮住 HUD／招式區；視覺證據位於 `tesoro_rework_20260818/`。`npm start` 另啟時因既有 server 已占用 8787 回報 `EADDRINUSE`，本輪直接沿用該正式 server 驗證。

#### 戰鬥角色圖屬性列與泰佐洛效果隔離 V252

- 日期：2026-08-18。
- 原因：`setPlayerAttributeDisplay()` 與 `renderCards()` 曾把原本隱藏的 `#playerCardTier.card-tier` 改成可見的 `pill attribute-pill`，造成所有一般戰鬥角色圖上方多出一條屬性列。
- 修正：角色圖的 `#playerCardTier` 固定還原為隱藏的 `card-tier`；屬性仍只顯示在原本左上 HUD 資訊列。泰佐洛半身黃金偶另以 `postgameBossMechanic.key === "postgame_gild_tesoro"` 且第一階段為必要條件，其他一般戰鬥與特殊 Boss 會直接設為 `hidden`。
- 相容：只修正戰鬥頁顯示與專用效果作用域；沒有修改任何攻擊、傷害、招式、屬性相剋、回合、CPU、Boss 規則、快照、localStorage key 或 Socket.IO event。主頁與戰鬥頁共用 query `20260818-tesoro-scope-card-tier-v73`。
- 修改檔案：`public/js/board_battle.js`、`public/board_battle.html`、`public/js/board_game.js`、`scripts/battle_attribute_tesoro_scope_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check public/js/board_battle.js`、`node --check public/js/board_game.js`、`npm start` 與正式戰鬥頁 HTTP 200 通過。Chrome 於 1600×900、932×430 分別載入非泰佐洛 Boss 與泰佐洛：四種畫面皆確認角色圖屬性列 `display:none`、HUD 屬性文字仍存在；非泰佐洛的黃金偶 `display:none`，泰佐洛第一階段 2 層黃金偶正常顯示。QA 結果 `ok=true`、`errors=[]`，截圖位於 `tesoro_rework_20260818/normal_battle_no_attribute_bar_*` 與 `tesoro_scoped_no_attribute_bar_*`。

#### 泰佐洛黃金偶與角色圖完全同步 V253

- 日期：2026-08-18。
- 修正：不再讓原角色圖與黃金偶各自播放同名動畫。兩者現在同屬 `#playerPortraitMotionLayer`；泰佐洛黃金化時只移動這個共同容器，攻擊、受擊與連擊期間兩張圖維持固定相對位置，真正作為一張合成角色圖同步前進。
- 作用域：共同容器在一般戰鬥維持原角色圖的 100% 尺寸與位置；只有 `tesoro-gold-active` 加攻擊／受擊狀態才啟動容器動畫。其他一般戰鬥、特殊 Boss、敵方角色圖與戰鬥結算不使用該動畫；沒有修改攻擊、傷害、招式、回合、CPU 或快照。
- 修改檔案：`public/board_battle.html`、`public/js/board_battle.js`、`public/js/board_game.js`、`scripts/battle_attribute_tesoro_scope_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。主頁與戰鬥頁 query 更新為 `20260818-tesoro-gold-motion-sync-v75`。
- 驗證：Chrome 1600×900、932×430 定向檢查確認一般戰鬥角色圖仍完整置中且黃金層 `hidden`；泰佐洛黃金化時原角色圖與黃金偶的 `offsetParent` 都是同一個 `playerPortraitMotionLayer`，子圖本身不再各播動畫，攻擊由共同容器執行 `tesoroPortraitGroupAttack`、受擊由共同容器執行 `portraitHit`。QA 結果 `ok=true`、`failures=[]`、`errors=[]`，動作中截圖為 `tesoro_rework_20260818/tesoro_gold_follows_attack_desktop.png` 與 `tesoro_gold_follows_attack_phone_landscape.png`。

#### 泰佐洛三段金流河與當回合替補 V254

- 日期：2026-08-18。
- 規則：第一階段不再使用可雙向拉扯的 -3～+3 個人戰線。每名船員改為獨立 0～3 段金流；泰佐洛成功命中的非增益／治療招式每次固定增加一段，玩家攻擊不會反推。第三次命中立即建立既有 `replacement` 狀態，在同一回合讓玩家選仍存活的替補；尚未執行的原指令取消，替補本回合不補打、下回合才正常行動。原角色退到後排時 `goldByCrew`／`controlByCrew` 同步歸零。沒有其他存活船員時保留既有一次跳過後解鎖的防卡退路。
- 視覺：移除需要配合不同角色頭身位置的半身黃金偶與共同動作容器。`#tesoroGoldCoating` 改為固定在 `#playerPortraitWrap` 的金色液面，依 1／3、2／3、3／3 從圖框底部升至全滿；角色攻擊／受擊時仍只移動原人物圖，金流留在圖框不偏移。機制詳細框同步顯示六名船員頭像、段數與三枚進度點。
- 階段與相容：Golden Tesoro 第二階段仍使用全隊共用 -3～+3 戰線、兩層外殼及黃金神之怒；第三階段不變。`POSTGAME_TESORO_MECHANIC_VERSION` 升為 3，舊欄位就地正規化為 0～3 段，沒有新增 localStorage key、Socket.IO event 或第二套同步狀態。一般戰鬥、其他 Boss、傷害與回合權威未修改。正式主頁／戰鬥頁 query 為 `20260818-tesoro-gold-river-v119`／`v76`。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`public/board_battle.html`、`public/js/board_battle.js`、`scripts/battle_attribute_tesoro_scope_qa.js`、`scripts/postgame_boss_mechanics_qa.js`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check` 通過三個修改的 JS。Chrome 1600×900 與 932×430 定向 QA 結果 `ok=true`、`failures=[]`、`errors=[]`：一般戰鬥金流保持隱藏；三段液面實測高度約 35%／67%／103%；增益招式與玩家攻擊都不誤加金流；第一、第二、第三次敵方命中依序得到 1、2、3 段，第三次建立替補；選擇第 2 名船員後舊角色兩個相容欄位歸零，`waitingResume=true` 且新角色不在本回合補打。三階段截圖為 `tesoro_rework_20260818/tesoro_gold_river_level_{1,2,3}_desktop.png`，手機橫向亦有同名證據。

#### 澤法炸藥岩爆炸五幕彩漫預覽（待確認）

- 日期：2026-08-20。
- 素材：以 Codex 內建 ImageGen 逐張生成五張 1672×941 彩色漫畫候選，依序為倒數歸零、澤法迎向引爆、終結點崩壞、海床連鎖反應與新世界陷落；圖中沒有烙入文字，正式字幕預定由 HTML 疊入。
- 預覽：新增獨立 `public/board_zephyr_explosion_story_preview.html`，一次只顯示一幕，支援點擊左右區域與方向鍵逐幕切換；此頁只供素材確認，不是正式戰鬥流程。
- 作用域：五張 PNG 僅保存於 `public/images/board/story/postgame_zephyr_explosion/incoming/`；尚未修改 `board_game.js`、`board_battle.js`、澤法倒數、戰鬥按鈕、快照或任何其他 Boss。確認後才轉正式 WebP 並接入澤法炸藥岩倒數歸零的戰敗分支，正式頁不得引用 `incoming/`。
- 修改檔案：`public/board_zephyr_explosion_story_preview.html`、`public/images/board/story/postgame_zephyr_explosion/`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。`docs/GAME_RULES.md` 不需更新，因本輪沒有改規則。
- 驗證：五張來源 PNG 尺寸皆為 1672×941 並完成 SHA-256；現有 8787 服務回傳預覽頁 HTTP 200。Chrome 1600×900 與 932×430 逐幕檢查五張圖片自然尺寸、標題順序、單一進度點、頁面／字幕範圍與 console／HTTP 錯誤，兩種 viewport 均為 `valid=true`、`errors=[]`。`npm start` 已執行，但既有正式服務占用 8787，第二個程序依預期回報 `EADDRINUSE`，本輪沿用既有服務驗證。

#### 澤法爆炸五幕劇情與全員瀕死結算 V287

- 日期：2026-08-20。
- 規則：最後終結點倒數歸零後先播放五幕彩漫，播放期間保持船員原 HP；第五幕完成才把目前玩家全部船員設為 0 HP、加入既有 `knockedOutCrew`，並沿用 `battle.result="lose"` 的「全員瀕死」結果。玩家按原本「返回地圖」後，仍由一般敗北流程送進推進城及執行既有入獄整備。
- 視覺：五張核准 PNG 以 quality 88 轉為同尺寸 1672×941 WebP；正式 battle iframe 依序顯示倒數歸零、引爆、終結點崩壞、海床連鎖反應與新世界陷落。畫面自動逐幕前進，也可點擊或按右方向鍵；沒有新增按鈕，原攻擊、夥伴、道具、逃跑 2×2 排版不變。
- 同步：主遊戲建立 `postgame-zephyr-explosion-story` visual event 並等待控制玩家的完成命令；逾時會安全接續。若播放中重整、原本的本機等待器已消失，重新載入同一事件的完成命令會直接補做全員瀕死結算，避免 battle snapshot 卡在劇情末尾。沒有新增 gameState 欄位、localStorage key 或 Socket.IO event。
- 作用域：只修改 `postgame_zephyr` 倒數歸零分支；澤法 2000 HP、4 次倒數、3 點解除、半血黑腕、左側場上炸藥岩、CPU 解除策略及其他十二 Boss 均未改。正式頁不引用 `incoming/`。
- 修改檔案：`public/js/board_game.js`、`public/js/board_battle.js`、`public/board_game.html`、`public/board_battle.html`、`public/images/board/story/postgame_zephyr_explosion/`、`scripts/postgame_zephyr_end_point_qa.js`、`docs/POSTGAME_BOSS_CONFIRMED_MECHANICS.txt`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式主頁／戰鬥頁 query 為 `20260820-zephyr-explosion-story-wipeout-v134`／`v87`。
- 驗證：`node --check` 通過主遊戲、戰鬥頁與澤法 QA 三個 JS；正式主頁、戰鬥頁及五張 WebP 全數 HTTP 200。澤法定向 QA 於 1600×900、932×430 逐幕確認 5 張圖皆為 1672×941、字幕／頁面無 overflow、播放期間 active crew HP 保持 118 且 `battle.result` 為空，完成後六名船員 HP 全為 0、`knockedOutCrew` 六名、結果顯示「全員瀕死」；按返回後 battle 清除、推進城 active 且依原規則恢復船員。重整後無等待器的完成路徑亦成功補做六人瀕死。十三 Boss 機制回歸 `errors=[]`、`failures=[]`。`npm start` 因既有 8787 正式服務運行而回報 `EADDRINUSE`，本輪沿用該服務完成驗證。

#### 二周目玩家切磋準備室互動提案 V337

- 日期：2026-08-27。
- 範圍：新增隔離的 `public/board_spar_selection_demo.html`，呈現雙方各六名船員、任意角色詳情、各自秘密選三人、個別鎖定及雙方鎖定後同時揭曉。角色詳情只顯示角色資料、能力、特性與招式，DOM 與文字均不輸出攜帶物資訊。
- 視覺：使用 Codex 內建 ImageGen 生成原創 16:9 海戰準備室框；正式候選 WebP 位於 `public/images/board/spar_ui/spar_selection_panel_frame_v1.webp`，PNG 原圖保留於 `incoming/`，完整提示詞寫在同目錄 `spar_selection_panel_frame_v1.prompt.md`。人物圖沿用現有角色戰鬥圖，沒有重製角色素材。
- 邊界：本輪是可操作的 UI／流程提案頁，不讀寫正式 `gameState`、`battleState`、localStorage 或 Socket.IO，也未把 PK 接進正式地圖。現有正式戰鬥核心仍是玩家對 CPU 的不對稱結構；在雙方攜帶物能公平套用前，不使用它冒充玩家對戰。
- 修改檔案：`public/board_spar_selection_demo.html`、`public/images/board/spar_ui/`、`scripts/spar_selection_demo_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check scripts/spar_selection_demo_qa.js` 通過；Playwright 於 1600×900 與 1024×768 實際操作 6+6 卡片、開啟詳情、確認不含攜帶物文字、左右各選三人、分別鎖定與同時揭曉，兩種尺寸均 `errors=[]`、`failures=[]` 且頁面無水平／垂直 overflow。`npm start` 已執行，因 8787 已有正式服務而回報 `EADDRINUSE`，本輪沿用該服務完成瀏覽器驗證。

#### 二周目切磋角色卡與詳情框 V338

- 日期：2026-08-27。
- 視覺：切磋準備室的十二張角色圖不再使用普通描邊矩形，改為既有航海角色卡框：獨立肖像窗、力／速／技菱形徽章、情報六角鍵、出戰順位、選入標籤、木牌姓名及階級／定位／等級槽。左側以青綠光、右側以紅光區分，雙方揭曉後未入選角色轉暗，入選角色保留陣營光與循環掃光。
- 詳情：點角色卡 `i` 會打開既有航海木框詳情底圖；左側放大角色圖與屬性盾牌，右側顯示角色名稱、六項能力、特性及招式，底部紅木按鈕返回。詳情仍不建立、不讀取也不顯示攜帶物欄位。
- 素材：重用 `public/images/board/draft_recruitment/draft_character_card_frame.webp` 與 `draft_character_detail_frame.webp`，沒有生成或覆蓋角色圖，也沒有新增正式狀態欄位。
- 修改檔案：`public/board_spar_selection_demo.html`、`scripts/spar_selection_demo_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：Playwright 於 1600×900、1024×768 重新完成 6+6 顯示、詳情開關、左右各選三人、雙鎖揭曉與截圖；新增詳情內容不得壓到返回鈕的幾何檢查，結果 `errors=[]`、`failures=[]`，頁面無 overflow。示範頁與兩張重用框圖 HTTP 均為 200。`npm start` 已執行，既有 8787 服務占用連接埠而回報 `EADDRINUSE`，瀏覽器驗證沿用該服務完成。

#### 二周目切磋角色卡鏤空覆蓋框 V339

- 日期：2026-08-27。
- 修正：淘汰把角色縮在不透明卡底上的作法；新 `spar_character_card_overlay_frame_v1.webp` 以真正 Alpha 鏤空大型人物窗及框外區域，角色圖片鋪滿底層，航海金屬／木質邊框直接疊在人物上層。只有姓名木牌與下方資訊列保留不透明底，確保文字可讀。
- 素材：使用 Codex 內建 ImageGen 參照原航海卡框製作 1086×1448 RGBA PNG，再轉成同尺寸 RGBA WebP；來源保留於 `public/images/board/spar_ui/incoming/spar_character_card_overlay_frame_v1_source.png`，完整成功提示詞保存於 `spar_character_card_overlay_frame_v1.prompt.md`。未修改任何角色圖片。
- 失敗防線：第一張候選把透明棋盤格直接畫入 RGB，已檢查為 `hasAlpha=false`，沒有複製進專案或接入頁面；第二張才是 `hasAlpha=true` 的正式來源。
- 修改檔案：`public/board_spar_selection_demo.html`、`public/images/board/spar_ui/`、`scripts/spar_selection_demo_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：正式 WebP 為 1086×1448、四通道且含 Alpha；Playwright 另以 Canvas 逐尺寸檢查人物窗中心 Alpha=0、框外 Alpha=0、姓名木牌 Alpha≥200。1600×900、1024×768 的 6+6 卡片、詳情、秘密選三人、鎖定／揭曉、內容邊界與頁面 overflow 回歸皆為 `errors=[]`、`failures=[]`；示範頁與正式鏤空 WebP HTTP 均為 200。`npm start` 已執行，因既有 8787 服務占用連接埠而回報 `EADDRINUSE`，瀏覽器驗證沿用該服務完成。

#### 二周目切磋角色框與名稱對位 V340

- 日期：2026-08-27。
- 修正：角色卡原本沿用 grid 的狹長格比例，1086×1448 的 3:4 鏤空框被 `object-fit:fill` 橫向壓縮，姓名與資訊列也使用舊卡片比例。現改為每張卡固定 `aspect-ratio:3/4`、框圖 `object-fit:contain`；左右角色區各擴為 36%，兩排卡片以自然高度置中，不再拉伸素材。
- 對位：姓名依框圖木牌實際像素落在卡高 67.8%～75.0%，中心 71.4%；階級／定位／等級列落在 83.3%～90.5%，中心 86.9%。移除與姓名木牌重疊的「已選入陣容」文字，只保留順位徽章與陣營發光表示入選。
- 修改檔案：`public/board_spar_selection_demo.html`、`scripts/spar_selection_demo_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：先在服務停止時得到一次 `ERR_CONNECTION_REFUSED`，重新以 `npm start` 啟動 8787 靜態服務後重跑；Playwright 在 1600×900、1024×768 新增卡片寬高比 0.75、框四邊與卡片誤差 ≤1px、姓名中心 0.714、資訊中心 0.869 的幾何斷言。完整互動、Alpha、詳情與 overflow 回歸為 `errors=[]`、`failures=[]`。

#### 二周目切磋角色圖內孔裁切 V341

- 日期：2026-08-27。
- 修正：角色圖雖位於鏤空框下方，但上一版裁切窗仍接近整張卡，寬髮、角與肩部可能從左右金屬直條外側露出。現依正式框內孔量測把人物窗固定為左／右 17.3%、上 10.2%、下緣 65.9%，並以 `overflow:hidden` 強制裁切；掃光效果使用相同上下界。
- 作用域：只調整 `public/board_spar_selection_demo.html` 的人物圖可視範圍，不修改角色圖、鏤空框檔案、姓名／資訊對位、秘密選擇或詳情內容。
- 修改檔案：`public/board_spar_selection_demo.html`、`scripts/spar_selection_demo_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：Playwright 在 1600×900、1024×768 新增人物窗左右 0.173／0.827、上 0.102、下 0.659 與 `overflow:hidden` 的幾何斷言；6+6 卡片、框／名稱、Alpha、詳情、秘密選擇與頁面 overflow 回歸為 `errors=[]`、`failures=[]`。

#### 二周目切磋屬性盾牌與鏤空詳情框 V342

- 日期：2026-08-27。
- 小卡：移除卡片上方獨立的力／速／技菱形徽章與左上 `i` 情報鍵，屬性文字直接置入既有鏤空框左上盾牌孔。對方角色的整張卡片現在都是詳情入口；己方未鎖定時仍以整卡選人，鎖定後才改為查看詳情，沒有增加額外按鈕或改動排版寬度。
- 詳情：新增 `spar_character_detail_overlay_frame_v1.webp`，以 1536×1024 海賊木框覆蓋角色圖和 HTML 欄位；框外、左側人物窗、右側名稱、六個能力欄及招式資訊窗皆是實際 Alpha=0，只有木框、金屬飾件與暗紅返回鈕實底保留。能力欄改為與圖框一致的兩欄三列，人物圖在框後裁切，不修改任何角色圖片。
- 素材：使用 Codex 內建 ImageGen 參照 `draft_character_detail_frame.webp` 重製。首輪候選把白灰棋盤格畫入 RGB；第二輪去掉棋盤格但輸出黑色留空，最後由該生成圖的純黑留空區建立真 Alpha。ImageGen 原始檔、透明校正 PNG、正式 WebP 與完整提示詞分別保存在 `public/images/board/spar_ui/incoming/`、`public/images/board/spar_ui/`；既有原框未覆寫。
- 修改檔案：`public/board_spar_selection_demo.html`、`public/images/board/spar_ui/`、`scripts/spar_selection_demo_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：Playwright 在 1600×900、1024×768 實際確認 6+6 卡片、12 個盾牌內屬性、舊徽章與情報鍵數量皆為 0、點對方整卡可開詳情；Canvas 驗證 1536×1024 詳情 WebP 的框外、人物窗、名稱窗、能力孔與資訊窗 Alpha=0，頂框與按鈕 Alpha≥200。小卡裁切、框／名稱對位、詳情不洩漏攜帶物、左右秘密選三人、雙鎖揭曉與頁面 overflow 回歸結果為 `errors=[]`、`failures=[]`；現有 8787 `npm start` 服務持續運行並供本輪瀏覽器驗證使用。

#### 二周目切磋全欄位中心對位 V343

- 日期：2026-08-27。
- 量測：直接讀取 `spar_character_card_overlay_frame_v1.webp` 與 `spar_character_detail_overlay_frame_v1.webp` 的 Alpha 通道，找出各 Alpha=0 連通開孔的像素邊界與中心。小卡盾牌中心為約 `(23.7%, 15.8%)`、順位圓孔中心約 `(77.4%, 15.6%)`；詳情人物窗、名稱窗、六個能力孔及資訊窗也分別使用其實測中心，不再沿用估算百分比。
- 修正：小卡人物／框／姓名／資料列維持共同水平中心，階級、定位、等級改為等寬三欄各自置中；屬性與順位依盾牌／圓孔完整寬高定位。詳情人物圖縮放到左側真開孔範圍，左上屬性、左下姓名、右上名稱、六項能力、資訊區及返回文字逐一置中；能力文字改為標籤與數值組合置中，資訊區使用 `box-sizing:border-box` 避免 padding 撐出框外。
- 修改檔案：`public/board_spar_selection_demo.html`、`scripts/spar_selection_demo_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：Playwright 在 1600×900、1024×768 新增小卡框／人物／姓名／資料列共同水平中心、盾牌中心，以及詳情視窗中心與各開孔實測中心的座標斷言。兩種尺寸完整操作 6+6 卡片、點對方看詳情、秘密選三人、雙鎖揭曉、Alpha、攜帶物保密、內容不重疊與頁面 overflow，結果均為 `errors=[]`、`failures=[]`；並人工檢查三張桌機／平板截圖。`npm start` 已在本輪啟動，靜態服務監聽 8787；未設定 `DATABASE_URL` 的既有資料庫警告不影響本隔離頁。

#### 二周目切磋詳情屬性盾牌置中放大 V344

- 日期：2026-08-27。
- 修正：V343 的詳情屬性字沿用透明孔估算位置，未對準左上實體盾牌。現裁切 1536×1024 詳情框左上盾牌重新量測，把屬性容器中心改為約 `(9.65%, 16.4%)`，並加入 `line-height:1`、`text-align:center`；響應式字級由 12～22px 放大為 18～32px。
- 作用域：只調整詳情彈窗的力／速／技位置與字級，不改小卡屬性、人物、名稱、能力、招式、選人或鎖定流程。
- 修改檔案：`public/board_spar_selection_demo.html`、`scripts/spar_selection_demo_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：Playwright 在 1600×900、1024×768 更新詳情盾牌中心座標斷言，完整互動回歸仍為 `errors=[]`、`failures=[]`；人工檢查桌機／平板詳情截圖，放大後單字保持在金框內且視覺置中。

#### 二周目切磋詳情屬性內盾面二次校正 V345

- 日期：2026-08-27。
- 原因：V344 仍以包含金色裝飾的盾牌外型中心對位，文字實際落在深色盾面時仍偏右、偏下。重新由正式 WebP 對盾面種子做受金框封閉的暗色連通區量測，得到內面邊界約 `x=99～179、y=108～211`、中心約 `(9.05%, 15.58%)`。
- 修正：屬性盒水平中心改為 `9.075%`，垂直中心先扣除中文字形約 3px 的下沉後設為 `15.29%`；保留 18～32px 字級、固定行高與置中排版。只修改詳情屬性位置及相應 QA／文件。
- 修改檔案：`public/board_spar_selection_demo.html`、`scripts/spar_selection_demo_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：重新輸出桌機盾牌 4 倍裁圖人工檢查，字形中心落在深色盾面中心；Playwright 於 1600×900、1024×768 另外逐一開啟魯夫「力」、香吉士「速」、艾斯「技」詳情，完整回歸結果為 `errors=[]`、`failures=[]`。

#### 二周目同格玩家正式 PK V346

- 日期：2026-08-27。
- 範圍：把已確認的切磋準備室接入正式二周目地圖。只有目前回合真人可向同海格、至少三名船員的另一名真人發邀請；對方接受後雙方秘密選三名並各自鎖定，雙鎖才開始三對三。入口放在原船長指令底列及既有同格停靠提示，沒有增加戰鬥第五顆按鈕。
- 戰鬥：新增獨立 `isSparBattle` 對稱 runtime，三名入選角色滿 HP、滿 PP、零能力階級與異常狀態。每輪兩邊各自提交一個行動，兩邊到齊才依優先度與有效速度結算；招式、暴擊、多段、玩家被動、攻擊方／承傷方攜帶物、回合末效果、手動換人、倒下替補與交棒旗都沿用正式玩家規則。對手攜帶物在準備室與 HUD 隱藏，但效果照常生效。
- 隔離與同步：PK runtime 不寫回主線船員 HP、PP、出戰位置或攜帶物，勝敗不發放貝里／經驗、不觸發瀕死或監獄流程。手動存檔排除 `activeSpar`／`isSparBattle`；LAN 使用原 `BOARD_GAME_STATE` 完整快照保存進行中 PK，server 允許兩名參戰者送出更新並拒絕非參戰者。沒有新增 localStorage key、Socket.IO event 或角色／道具字串 id。
- UI：`board_spar_selection_demo.html?formal=1` 改由父頁送入即時名單並回傳選角／鎖定；獨立預覽模式仍保留。船長指令有可切磋對象時，底列使用五等欄，避免第五項換行壓縮面板。正式主頁 query 更新為 `20260827-formal-spar-pk-v346`。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`public/board_spar_selection_demo.html`、`server/index.js`、`scripts/spar_formal_battle_qa.js`、`scripts/spar_lan_sync_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。
- 驗證：`node --check` 通過 `public/js/board_game.js`、`server/index.js`、`scripts/spar_formal_battle_qa.js`、`scripts/spar_lan_sync_qa.js`。`spar_selection_demo_qa.js` 於 1600×900、1024×768 維持 `errors=[]`、`failures=[]`；`spar_formal_battle_qa.js` 驗證五欄船指令無 overflow、6+6 選角、滿狀態三對三、雙方裝備狀態、雙方行動、傷害／PP runtime 變化、替補及主線資料完全不變，結果 `failures=[]`；`spar_lan_sync_qa.js` 以三個瀏覽器 context 驗證邀請、接受、非當前回合參戰者行動版本 `1→2→3`，第三名更新回覆 `not_your_turn`，結果 `failures=[]`。一般戰鬥 `battle_parity_dice_relay_flag_qa.js` 與 `battle_critical_system_qa.js` 分別為 `failures=[]`、45/45 通過。額外重跑 `battle_entry_recovery_qa.js` 時，立即遺失確認的第一段仍記錄 `canAct=false`，其 watchdog 與海上戰鬥入口後續皆恢復 `canAct=true`；此項未在 PK 範圍改動。8787 `npm start` 服務持續運行並供正式頁與 Socket.IO 驗證使用。

#### 二周目 PK 保留原玩家輪序 V347

- 日期：2026-08-27。
- 規則修正：正式 PK 不再從 A 回合連續打到勝負。每逢輪到參戰者，只由該回合玩家先選招、對手再回應，兩個指令結算一輪後立即換原順序下一位。A→B→C→D 中 A 挑戰 C，流程固定為 A 選／C 選／結算→B 普通回合→C 選／A 選／結算→D 普通回合；技能實際出手先後仍依原行動優先度與有效速度，不因選招順序改寫。
- 狀態生命週期：一輪結束後把雙方 runtime 存入 `activeSpar.battleSnapshot`，清除全域 `battleState` 與 PK overlay，再走原 `endTurn()`。非參戰者的回合不受 `activeSpar` 鎖定，可正常擲骰、移動、抽事件、戰鬥與使用原介面；輪到下一名參戰者時才恢復 snapshot、開始下一個 PK 輪次並再次鎖住該回合。
- 戰鬥邊界：三對三 HP、PP、能力狀態、裝備狀態與替補結果跨參戰者回合保留；主線船員資料仍完全隔離。倒下／交棒需要替補時先完成替補再離開該輪；分出勝負時由本回合參戰者確認結果，再清除切磋並照原順序換人。
- 修改檔案：`public/js/board_game.js`、`public/board_game.html`、`scripts/spar_formal_battle_qa.js`、`scripts/spar_lan_sync_qa.js`、`docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`、`docs/DEV_WORKFLOW.md`。正式主頁 query 更新為 `20260827-spar-turn-order-v347`。
- 驗證：`node --check` 通過主程式與兩支 PK QA。`spar_formal_battle_qa.js` 以四名玩家實際完成 A→C 第一輪、確認 `battleState=null`／戰況已暫存／目前玩家=B／B 未被鎖，再完成 B→C 換手、恢復第二輪、C 先選／A 回應、替補與結算後目前玩家=D；兩輪皆保持主線 HP、PP、出戰位置與攜帶物不變，`errors=[]`、`failures=[]`。`spar_lan_sync_qa.js` 以三個瀏覽器 context 驗證同步版本 `1→2→3→4→5→6`，涵蓋 A/C 結算後換 B、B 普通換到 C、C 恢復 PK 與非參戰者改寫遭 `not_your_turn` 拒絕，結果 `failures=[]`。另重跑準備室 1600×900／1024×768、同格交易停靠及一般暴擊戰鬥回歸，分別為 `failures=[]`、`failures=[]`、45/45 通過。


