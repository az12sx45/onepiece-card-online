# 航海錄招式素材發布 — 2026-09-21

## 發布範圍

正式來源 `D:\Codex_Release_Worktrees\board-voyage-records-v1`，基準 `d32c2e7cb408c10abf6c06ce4f3bdf3fc3687014`。接續已完成的本機招式素材實作，使用者已明確要求接入並部署。新圖集 102 組／816 格、音效 487 段，涵蓋 1,471 個招式 ID 與 18 個同 ID 變體；內容與來源見 [素材實作紀錄](BOARD_MOVE_FX_20260921.md)。

Board 候選 `package-9cf4796087a91b1a`，4,079 檔／1,375,205,531 bytes。新增 589 媒體及 2 支核心 JS，修改既有 4 份 Board 程式。Card／Chess package、舊 catalog-v2、既有 rank 圖與 server/data 均保留。

## 發布流程與狀態

目前為發布準備階段；只有正式站動態版本、程式與媒體公開讀回核對完成後，才標示上線。

- `build_board_move_fx_release_candidate.js` 將正式 working tree 的指定資料凍結到外部 `work/release-candidate`；本次重建得到相同 release ID。
- 新增 `promote_board_move_fx_release.js --candidate <絕對 work/release-candidate 路徑> [--promote]`：檢查 39 個程式與 589 媒體的 Git HEAD bytes／SHA、基準及未變更記錄；只有全部一致才能將候選 catalog／manifest 提升到 public。未加 `--promote` 時只核對。
- 舊 `build_desktop_program_catalog.js` 從 v2 素材基準生成，不能包含新媒體；新增發布前防漏檢查，在發現目前 v3 的媒體會消失時停止，避免後續發布悄悄刪掉這批素材。
- 提交來源後先驗證候選、執行 R2 dry-run 與既有 DPAPI publisher 上傳；公開 GET 核對所有新增／修改 blob 後才推送 main 觸發 Render。
- 最後檢查三遊戲 runtime identity、catalog／manifest、39 個 Board 程式、新增媒體及瀏覽器試播。正式存檔不參與 fixture。

## 保留與驗收界線

本次工作前已保存 24 個 server/data 檔案、兩個既有 rank 修改與 catalog-v2 的 SHA256 基準，驗收時再比對。未更改傷害、PP、回合、帳號或存檔流程。瀏覽器自動化與隔離雙頁檢查不代表遠端真人、實體手機或人耳聽感驗收。
