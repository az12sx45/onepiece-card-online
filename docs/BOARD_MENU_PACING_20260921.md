# 航海選單與攻擊特效可讀性（2026-09-21）

正式來源 `D:\Codex_Release_Worktrees\board-voyage-records-v1`，基線 `dc40b7989973a9c06e21a995317f5126bf97f40e`／Board `package-0f54c185d7d65dcb`。依使用者要求收合右上操作、放慢攻擊特效並部署。

## 修改

- `public/board_game.html`、`public/js/board_game.js`：右上工具改為預設收合的 48px 三橫線按鈕。展開後保留回到玩家、全圖、快速航行、CPU 倍速／指令、存檔及我的航海錄。支援外部點擊／Escape 收合、鍵盤焦點、手機捲動、safe-area 與完整尺寸觸控按鈕。選單開關僅為 DOM 狀態。
- `public/js/board_move_fx.js`、`public/js/board_battle.js`：命中圖集原先被剩餘影格／FPS 再縮短至約 200–250ms，改為遵守原受擊窗口，單擊 700ms、連擊每下 420ms。人物姿勢、接觸時間、音效及傷害結算時點維持原值。
- `board_game.js` 切磋演出採一般戰鬥 duration，攻擊後等待 duration+420ms，取消 4200ms 截斷上限，含後置狀態特效。十二連擊最後圖片在 8270ms 結束，等待 9110ms 後才交棒／關閉畫面。
- 兩個 Board HTML 更新 JS query。未新增遊戲狀態欄位、存檔 key、角色／招式 ID 或 Socket.IO event；既有 rank 圖片修改保留。

## 本輪驗證

使用 `PORT=18923 npm start` 與 `board_move_fx_qa_isolation.js`，測試資料導向 `D:\Codex_QA\board-menu-pacing-20260921\server-data`，資料庫停用。起初缺少 express/chess.js；改用現成 D 槽 launcher 依賴後啟動成功，沒有安裝或修改 node_modules。

- 選單 Chrome 32 項通過：1440×900、932×430、390×844、320×568，開關不改 gameState，CPU 控制、紀錄視窗、鍵盤與重整預設收合。已檢視桌機／手機截圖。
- 快速航行 20 項通過：原擲骰、首次／重複寶箱節奏、偏好保留，QA 改為先展開選單。
- FX 播放器 40、整合 15、觀看佇列 41、分段傳輸 58；真 Chrome 素材與演出 116 項通過、0 errors。包含單擊／連擊像素持續時間及觀看者完整播放，原傷害順序仍於接觸後才改 HP。
- 原 `battle_impact_order_qa.js` 的獨立 popup 與正式 iframe 競爭通知；QA 改成等待完整 battle view 並明確刷新 popup 後重跑通過，未改正式通知流程。
- `lan_refresh_flow_qa.js`：兩個 Chrome context 真 Socket.IO 建房、加入、開始、交棒、F5 及雙頁待續戰鬥恢復，errors/failures 空；`board_reconnect_client_qa.js` 保留進度／金幣、單次重連快照、拒絕舊資料皆通過。
- 切磋實際程式與虛擬時鐘 10/10：1／2／6／7／12 擊各含有無後置效果，最後圖片與 HP finalize 都早於主控／觀看端等待結束。既有 spar_formal_battle_qa.js／spar_lan_sync_qa.js 亦通過，兩輪行動、中間其他玩家回合、結束清理、LAN 版本 1→6 與拒絕旁觀者改寫皆正常。

修改工具為 `scripts/board_move_fx_qa.js`、`board_move_fx_integration_qa.js`、`board_move_fx_browser_qa.js`、`battle_impact_order_qa.js`、`board_quick_voyage_qa.js`。完整證據置於 `D:\Codex_QA\board-menu-pacing-20260921`。瀏覽器為自動化受控案例，不代表遠端真人或實體手機測試。

## 發布狀態

待本輪回歸完成後，從已提交 source 使用 `build_board_program_update.js` 產生候選、保留全部 4,040 媒體與 39 程式；僅發布本輪變動的五份 Board 程式。R2／Render 與公開 SHA 驗收完成前不標記已部署。