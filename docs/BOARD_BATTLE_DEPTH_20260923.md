# 戰鬥頁角色與框立體效果（2026-09-23）

使用者要求先發布實際戰鬥頁，保持原尺寸。以正式發布 c9922e2f19191f4fa8e0f3fc91a9a92cefb5d3c3 建立獨立分支 codex/board-battle-depth-20260923，避免帶入原工作樹的其他未完成變更。

- 僅 board_battle.html 載入角色深度程式及樣式；其他頁面延後。
- 1,072 張不透明戰鬥圖使用 BiRefNet 遮罩與修補背景，其中 87 張使用經既有獨立視覺檢查的修正圖。原圖保持不變。模型與 subject 中間檔不進玩家包。
- 克洛 angry/hit/hit_player/morale/weak 與紅伯爵 angry/morale 共 7 張遮罩未通過檢查，明確排除其模型圖層；使用完整原圖傾斜，不宣稱模型分層完成。
- 透明角色圖沿用 alpha。Judge 分身保持既有鏡像與點擊事件。指標光線方向沿用 Card 效果；戰鬥動作優先，低動態偏好與觸控保留靜態呈現。
- 主戰鬥框使用固定邊界內的浮雕、暗邊及指標光，不旋轉整張卡，不改外框寬高。裝飾層 pointer-events:none。
- applyCosmeticFrame 在配置未變時保留原圖層，避免每 1.2 秒重建造成閃動。
- 不修改規則、傷害、回合、存檔格式、BOARD_GAME_STATE 或 Socket.IO 契約。

來源與檢查：D:/Codex_QA/board-battle-depth-20260923/scoped-selection.json 記錄完整來源 SHA 與排除項目；原產物及獨立審查保留在本機 board-depth-trial-qa。King angry 另納入本次實際頁面 QA。自動初始化戰鬥屬本機自動檢查，不代表真人或實體手機驗收。

scripts/build_board_battle_depth_release.js 固定基線、限定兩項既有程式變更及兩項新程式，保留原 4,166 個媒體記錄、Card/Chess、v2 與來源樹。完整 1,079 張清單必須等於模型項目加 7 張原圖備援；被拒絕遮罩不得進入包。Electron 僅增加精確 manifest JSON 路由。

發布需在 Git 來源凍結後建立並驗證候選、上傳內容定址 R2、核對公開 SHA、提升目錄，再驗證公開 runtime releaseId。LATTICE 工具目前未提供，故本次不聲稱持久任務或圖譜已寫入。

本機驗證：npm start 可服務頁面（未設定資料庫，未接觸玩家資料）；Node 語法檢查通過；1440×900 與 844×390 實際初始化戰鬥共 20 個來源場景、60 個指標姿勢通過，瀏覽器錯誤 0，原圖與卡框 layout 尺寸維持，浮點投影誤差低於 0.001 px。King angry 實際戰鬥截圖已檢視、可辨識且未見破裂；7 個備援不建立模型圖層。

部署驗收修正：runtime 嚴格驗證所有 data 檔也必須列在 programFiles；已補列 images/board-depth/v1/manifest.json，總數為 51（50 個程式＋1 個圖層目錄）。包內檔案 bytes、releaseId、manifest SHA 皆不變。加入實際 runtime endpoint 驗證防止再漏列。

正式發布已驗證（2026-09-23T15:35:14.344Z）：package-59115d76bca49c75；manifest SHA d4008360d0d6c3cba695a66c4c7915f47ad9b2c102f053bd3f3cebbf15f6a834。2,141 個公開 blob 的完整 GET/SHA/CORS 通過；版本接口、55 項發布檢查、142 項發送路徑檢查通過。1440×900 / 844×390 實際初始化戰鬥 20 個來源場景、60 個指標姿勢及兩次攻擊到可返回地圖完成，瀏覽器錯誤 0。以上為自動 QA，非真人或實體手機驗收。7 張完整原圖備援與其他頁面延後範圍不變。LATTICE 未提供工具，不聲稱已寫入任務驗收。

2026-09-24 更新：上述「不旋轉整張卡」已由使用者要求取代。完整 combat-card 現在連外框一起傾斜（Card 相同 12 度映射／900px 透視），布局尺寸保留，內部圖像不二次旋轉。驗證見 DEV_WORKFLOW 2026-09-24。
