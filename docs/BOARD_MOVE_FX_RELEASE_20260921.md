# 航海錄招式素材發布 — 2026-09-21

## 發布範圍

正式來源 `D:\Codex_Release_Worktrees\board-voyage-records-v1`，基準 `d32c2e7cb408c10abf6c06ce4f3bdf3fc3687014`。接續已完成的本機招式素材實作，使用者已明確要求接入並部署。新圖集 102 組／816 格、音效 487 段，涵蓋 1,471 個招式 ID 與 18 個同 ID 變體；內容與來源見 [素材實作紀錄](BOARD_MOVE_FX_20260921.md)。

原本本機候選 `package-9cf4796087a91b1a`，4,079 檔／1,375,205,531 bytes。新增 589 媒體及 2 支核心 JS，修改既有 4 份 Board 程式。Card／Chess package、舊 catalog-v2、既有 rank 圖與 server/data 均保留。

正式 source commit `61d1e3c6d` 中 `board_game.html` 與 `js/board_game.js` 保留既有混合 CRLF，比 LF 候選共多 91,098 bytes；兩者轉換換行後與凍結候選完全一致，其餘 37 程式與 589 媒體一致。因此提升工具從真實 Git HEAD bytes 重算 package，不改寫程式來配合候選雜湊。預計增量下載 595 個新 hash／95,959,185 bytes（約 96 MB）。

## 發布流程與狀態

已部署並完成公開驗收。正式 release commit `7a454cb60ef1b1aed48f8353647222648ac5cbc9`，package `package-2fc489ad68999481`，4,079 檔／1,375,296,629 bytes，manifest SHA256 `db91ea269215c338bc69582a3e793d57b63f0ecec0c9f05aa93c932e5d90595e`。2026-09-21 13:38:49（Asia/Taipei）正式 runtime 回報新版，隨後公開完整性與瀏覽器驗收通過。

遊戲入口：`https://onepiece-card-online.onrender.com/board_start.html`。獨立試播／試聽：`https://onepiece-card-online.onrender.com/board_move_fx_preview.html`。網頁重新整理；桌面版下載約 96 MB 的航海錄更新後重開。此為遊戲內容更新，不要求重裝啟動器。

- `build_board_move_fx_release_candidate.js` 將正式 working tree 的指定資料凍結到外部 `work/release-candidate`；本次重建得到相同 release ID。
- 新增 `promote_board_move_fx_release.js --candidate <絕對 work/release-candidate 路徑> [--promote]`：檢查 39 個程式與 589 媒體的 Git HEAD bytes／SHA、基準及未變更記錄；程式只允許與已驗證候選的 CRLF/LF 差異，媒體必須逐 byte 相同。以已提交實際 bytes 建立正式 catalog／manifest 後提升到 public。未加 `--promote` 時只核對。
- 舊 `build_desktop_program_catalog.js` 從 v2 素材基準生成，不能包含新媒體；新增發布前防漏檢查，在發現目前 v3 的媒體會消失時停止，避免後續發布悄悄刪掉這批素材。
- 提交來源後先驗證候選、執行 R2 dry-run 與既有 DPAPI publisher 上傳；公開 GET 核對所有新增／修改 blob 後才推送 main 觸發 Render。
- 最後檢查三遊戲 runtime identity、catalog／manifest、39 個 Board 程式、新增媒體及瀏覽器試播。正式存檔不參與 fixture。

## 保留與驗收界線

本次工作前已保存 24 個 server/data 檔案、兩個既有 rank 修改與 catalog-v2 的 SHA256 基準，驗收時再比對。未更改傷害、PP、回合、帳號或存檔流程。瀏覽器自動化與隔離雙頁檢查不代表遠端真人、實體手機或人耳聽感驗收。

## 本次重新執行的驗證

- 播放器 38、整合 13、觀戰 VM 41、視覺傳輸 58、remote playback 13、state-wire 611、真 Socket.IO 13 組均通過。
- Chrome 素材整合 100/100，102 圖集與 487 OGG 全部解碼，21 次實際音效 play promise 全部接受，零 page error。
- 原完整雙瀏覽器觀戰腳本有兩項失敗，沒有列為全過：15ms 輪詢未觀察到同步 render 的開始段，使骰子可見時長低估（原部署基準亦可重現）；另 fixture 在 terminal v16 尚未 ack 前送 map，map ack 實際仍為 v15。僅在本次 work fixture 加入 terminal ack 等待及只讀原計時器追蹤後，保留原 FIFO、overlay、readonly 與時長斷言，完整流程通過。骰子實際 1824/1825ms、攻擊 2083/2073ms，零錯誤。未修改 production 同步或計時邏輯。
- 通用打包防漏 9 項隔離檢查通過；對提升後的真實 metadata 亦確認會阻止丟失 589 媒體，catalog bytes 不變。
- R2 dry-run 核對全部 4,079 logical files／3,762 unique blobs，來源 bytes／SHA 完整通過。實際下載只需新增 595 blobs／95,959,185 bytes。
- R2 完整公開 GET：595/595，95,959,185 bytes，逐檔 size／SHA 通過。初次完整清單上傳遇到 socket/DNS 中斷；續傳使用既有 `publishRecord` 的 Git HEAD bytes、遠端 metadata 校驗及 `IfNoneMatch: *`，僅縮小到已驗證的新 595 hashes，最後 52 個失敗項單獨補傳成功。沒有覆寫不符 metadata 的 blob。
- 正式站 `board_spectator_release_verify.js`：43 checks 通過，包括三遊戲 identity、catalog／manifest、39 Board 程式及舊 RECOVERED 端點 410；Card／Chess package 保持。
- Render 原路徑新媒體完整 GET：589/589，90,280,955 bytes，逐檔 size／SHA 通過，零失敗。
- 正式網址 Chrome smoke：64/64，8 個播放情境、15 次真點擊音效 play promise 接受、29 JS／媒體請求成功、零錯誤；1440×900、932×430 無水平溢出，保存 6 張截圖並檢視火拳／治療。固定招式 1,471 ID；runtime 額外有 `__basic_strike`、`domi_reversi` 兩個備援条目，共 1,473 profiles。
- 發布後保護比對：24 個 server/data 檔案、兩個既有 rank 修改及 catalog-v2，共 27 檔 path／size／SHA 完全不變。
- 本機正式工作樹具有 Git checkout CRLF，不能拿其 raw bytes 的 runtime identity 作 Linux 部署驗收；正式套件逐項使用 Git HEAD bytes，最終仍須由 Render 公開端核對。

本次原始驗證證據位於 `C:\Users\王曜瑋\Documents\Codex\2026-09-21\new-chat-3\work\qa-agent\`；`QA_SUMMARY.md` 詳列原腳本失敗與修正 fixture 的歸因。

公開讀回證據在同一任務 `work/release/r2-full.json`、`live-verify.json`、`origin-media-full.json`；正式瀏覽器證據 `work/live-smoke/public/report.json`。使用者交付摘要在任務 `outputs`。收尾僅更新文件，以 `[skip render]` 提交，避免重新啟動已驗收服務。
