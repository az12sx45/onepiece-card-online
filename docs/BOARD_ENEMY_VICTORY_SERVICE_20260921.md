# 敵人島勝利後進島修復（2026-09-21）

正式來源為 `D:\Codex_Release_Worktrees\board-voyage-records-v1`，發布基準 `55810f4f9`／Board `package-2fc489ad68999481`。依使用者要求修復並部署：打倒普通敵人島的當回合玩家直接進入臨時商店、醫院或酒館，不能選擇擲骰；其他共鬥玩家等自己的回合完成戰後結算，再選擇進島或擲骰。

## 原因與修改

`finishBattle()` 原先在清除戰鬥後同步呼叫 `enterIslandService()`，但 `closeBattlePageOverlay()` 的關閉動畫仍持續 260ms。連線操作權會在這段時間被 `remoteBoardPlaybackBusy()` 阻擋，因此進島失敗；當事人又沒有待恢復標記，關閉動畫完成後只剩擲骰。

- 保留既有觀看播放／操作權檢查；在既有 `player.pendingIslandServiceChoice` 增加可選的 `requiredEntry: true`，僅標記當回合勝利者。
- 關閉戰鬥動畫、讀檔、連線恢復及重要道具／其他視窗關閉後，重新檢查控制權並直接開啟島內服務。必要進島期間禁用擲骰，程式擲骰入口亦會攔截。
- 必要進島狀態保留至島內服務結束；服務完成清除標記，沿原本流程交棒，避免刷新跳過服務。
- 其他共鬥者沿用沒有 `requiredEntry` 的舊標記，僅在自己回合提供「進島／擲骰」；舊存檔缺少新可選欄位仍保持原行為。離島或島嶼服務失效時沿用清理機制。
- `public/board_game.html` 更新 `board_game.js` 載入版本。未改角色、傷害、掉落、島嶼服務期限、資料 id、Socket.IO event 或存檔 key。

## 驗證與發布

本機使用 `PORT=18922 npm start` 與既有 `board_move_fx_qa_isolation.js`，資料讀寫導向 `D:\Codex_QA\board-enemy-service-20260921\server-data`，停用資料庫。正式資料與既有 rank 修改先記錄 SHA256，完成後比對。

已完成本機 Chrome 真 Socket.IO 兩人／三人房驗證：建立、加入、開始後，以正式 `startBattle()` 啟動戰鬥，再提供受控勝利 fixture 走完整結算。當回合玩家立即進島／擲骰被攔、必要進島標記同步、島內 F5 恢復操作、離開交棒、其他共鬥者延後結算後選進島或擲骰均通過，零 JavaScript 錯誤。桌機、平板及手機寬度保存截圖並檢視。

- `board_enemy_service_state_qa.js`：89 項正式函數 VM 檢查，包括關閉動畫 259/260ms 邊界、三種服務、CPU、舊標記、存檔 JSON、失效清理、重要道具 idle、交棒及本人觀看事件恢復。
- `lan_refresh_flow_qa.js`：兩個 Chrome context 真建房／加入／开始／交棒／F5／待續戰鬥同步通過，零錯誤。
- `board_reconnect_client_qa.js`：重新連線與拒絕舊快照通過；首次命令缺少其專用 `BOARD_QA_BASE_URL` 而連到未開的 8787，補正為 18922 後通過。
- 原 remote playback 13、battle spectator 41、state wire 611 項通過。舊 CPU post-coop QA 的虛構 `CPUQA` 房沒有建立連線，online case 3 項失敗，不能計為 LAN 驗收；其他 CPU／舊標記情境由新狀態 QA 與本次真房間測試確認。
- 新 `build_board_program_update.js` 的隔離打包工具檢查 8/8 通過；從現有 v3 保留全部 4,040 媒體，包含本日 589 招式素材，只更新既有 39 程式中的修改檔案，候選與正式 metadata 分開核對。

修前對照、補充案例及公開部署正在執行；完整結果於完成後補記。所有瀏覽器案例為自動化受控戰鬥胜利 fixture，不代表遠端真人完整遊玩或實體手機驗收。
