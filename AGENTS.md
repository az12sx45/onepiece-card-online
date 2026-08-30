# AGENTS.md

## 專案定位

本專案目前維護重點是 One Piece 主題的大富翁 / Board 遊戲：玩家從大廳進入地圖，透過擲骰移動、收集角色與道具、完成任務、副本、四皇據點與最終戰。

## 工作原則

- 先讀現有程式再改，不要憑記憶補規則。
- 本文件只要求照顧大富翁 / Board 遊戲；舊卡牌遊戲檔案除非需求明確提到，否則不要動。
- 保持既有資料 id、localStorage key、Socket.IO event 名稱穩定。
- 小改動小範圍處理，不做順手重構。
- 每次 Codex 修改程式、資料、素材目錄或工具後，都要同步更新專案文件；至少在 `docs/DEV_WORKFLOW.md` 的修改紀錄寫下日期、範圍、檔案與驗證，並依內容更新 `docs/PROJECT_OVERVIEW.md`、`docs/GAME_RULES.md`、`docs/FILE_MAP.md`。

## 不准亂改

- 不要修改 `node_modules/`、`tmp/`、`backups/`、`_codex_backups/`、`_restore_backup_*/` 內的檔案。
- 不要把備份檔或複製檔當作目前主流程。
- 不要任意改角色、道具、任務、地圖節點、素材路徑的字串 id。
- 不要在沒有驗證存檔相容性的情況下新增或改名 `gameState` 欄位。

## 多人同步注意事項

- Board 多人同步是前端產生完整遊戲快照，server 只快取、驗證基本控制權並廣播。
- 影響回合、移動、戰鬥、交易、合作戰、讀存檔、玩家身份的改動，都要檢查 `BOARD_GAME_STATE` 推送與套用流程。
- 修改同步前先確認 `userId`、`clientId`、目前行動玩家、版本號與本機控制權判斷。

## UI 風格注意事項

- 風格是深色海洋 / 海賊 RPG / 桌遊介面，常用金色、青綠、卡片式面板、角色頭像、徽章與地圖節點。
- CSS 大多在 HTML inline style 或 JS 注入樣式中，改 UI 前先找實際頁面的樣式來源。
- 手機版、modal 疊層、文字溢出、素材比例都要檢查。

## 修改前必查檔案

- 大廳與同步：`public/board_start.html`、`public/js/board_start.js`、`public/js/board_shared.js`、`server/index.js`
- 主遊戲：`public/board_game.html`、`public/js/board_game.js`
- 資料：`public/js/board_cards.js`、`public/js/board_items.js`、`public/js/board_missions.js`
- 地圖：`public/js/board_map_layout_override.js`、`public/js/board_map_align.js`
- 戰鬥與副本：`public/board_battle.html`、`public/js/board_battle.js`、`public/board_impel_down.html`、`public/js/board_impel_down.js`

## 完成後測試要求

- 專案沒有 `npm test` script；若只改文件，可確認檔案存在即可。
- 改程式時至少跑 `npm start`，確認頁面能開。
- 影響同步時，用兩個瀏覽器視窗測試建立房間、加入、開始、回合推送、重整後狀態恢復。
- 影響遊戲規則時，測試擲骰移動、落點事件、戰鬥、存檔 / 讀檔。
- 影響 UI 時，檢查桌機與手機寬度。
- 完成回報前確認修改紀錄已寫入文件；若只改文件，回報已更新哪些文件即可。
