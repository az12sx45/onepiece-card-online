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
- `lan_refresh_flow_qa.js`：兩個 Chrome context 真建房／加入／開始／交棒／F5／待續戰鬥同步通過，零錯誤。
- `board_reconnect_client_qa.js`：重新連線與拒絕舊快照通過；首次命令缺少其專用 `BOARD_QA_BASE_URL` 而連到未開的 8787，補正為 18922 後通過。
- 原 remote playback 13、battle spectator 41、state wire 611 項通過。舊 CPU post-coop QA 的虛構 `CPUQA` 房沒有建立連線，online case 3 項失敗，不能計為 LAN 驗收；其他 CPU／舊標記情境由新狀態 QA 與本次真房間測試確認。
- 新 `build_board_program_update.js` 的隔離打包工具檢查 8/8 通過；從現有 v3 保留全部 4,040 媒體，包含本日 589 招式素材，只更新既有 39 程式中的修改檔案，候選與正式 metadata 分開核對。

修前 `55810f4f9` 使用相同 Chrome／多人 fixture 已重現：單打與共鬥的當回合勝利者都停在「擲骰前進」，沒有島內服務或待恢復標記。修後完整三案例 `solo-online`、`coop-online`、`legacy-optional-cpu` 全過，`errors=[]`、`failures=[]`；額外覆蓋重要道具等待 2.5 秒後才繼續、完整存檔載入經正規化後恢復服務。

來源 commit `9b2965bb1`，release `f01b491f6`，Board `package-0f54c185d7d65dcb`（4,079 檔／1,375,298,938 bytes；manifest SHA256 `1184aca1248ce65074d3fb22b74ff2c0f03f57631e556aa028580dda872d7415`），僅 `board_game.html`、`js/board_game.js` 兩個新程式 hash，所有媒體及 Card／Chess 套件保留。

全量 R2 dry-run 核對 4,079 logical files／3,762 unique blobs 全部通過。增量上傳兩個新 immutable blobs 共 4,357,053 bytes（約 4.36 MB），2026-09-21 15:46:29 公開 GET size／SHA256 2/2 通過後推送 main 觸發 Render。發布前後 24 正式資料檔、兩個既有 rank 修改及 catalog-v2，共 27 檔 size／SHA 保持。本機隔離 QA 服務已停止。

**已部署**：2026-09-21 15:52:16（Asia/Taipei）正式 `board_spectator_release_verify.js` 完成 43 項公開檢查，包含三款遊戲 runtime identity、catalog／manifest、39 份 Board 程式的 size／SHA256、舊 RECOVERED 端點 410；Board 為 `package-0f54c185d7d65dcb`，Card／Chess 保持原套件。公開 Chrome 桌機 1600×900 與手機橫向 932×430 入口 HTTP 200、按鈕可见、無 JavaScript／HTTP 錯誤；沒有在正式站登入、建房或操作存檔。收尾文件提交使用 `[skip render]`，避免再次部署。

正式入口：`https://onepiece-card-online.onrender.com/board_start.html`。網頁重新整理；桌面版下載約 4.36 MB 的航海錄增量更新後重開，不需重裝啟動器。

證據置於 `D:\Codex_QA\board-enemy-service-20260921`：`baseline/report.json`、`fixed/report.json`、`release-candidate/release-inputs.json`、`release/r2-verify.json`、`release/live-verify.json`、`live-smoke/report.json`、`protected-after.json`。所有遊戲流程瀏覽器案例為自動化受控戰鬥勝利 fixture，不代表遠端真人完整遊玩或實體手機驗收。
