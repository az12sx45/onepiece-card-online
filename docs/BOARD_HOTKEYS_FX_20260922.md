# 攻擊圖片與鍵盤快捷鍵（2026-09-22）

使用者要求先完成第二點（攻擊圖放大、稍長停留）及第三點（自訂鍵盤快捷鍵）並部署，再檢查第一點偶發卡頓。正式來源為 D:/Codex_Release_Worktrees/board-voyage-records-v1，基線6c706729955b0e8efe1159f45c2285a78a347670。原有ranks/r5.PNG、r6.PNG與未追蹤sea_event_reveal/v1保留，不提交。

## 操作

航海選單新增「快捷鍵設定」。預設Space擲骰／繼續行動、B背包、Q任務、C船員、F船團、V船隻資訊、G插畫圖鑑、Home回到目前玩家、M全圖、四方向鍵選擇航線、R主航線、K設定。清單再次按下收起，其他清單鍵直接切換；同方向多條航線時明確列出選項，以Tab／Enter選擇。

設定可錄製單鍵或Shift／Alt組合、清除、還原；重複鍵需明確選擇改綁。使用op_board_hotkeys_v1:<userId>保存此電腦上的帳號偏好，不新增gameState欄位或Socket事件。輸入框、中文組字、長按重複、瀏覽器保留鍵不觸發遊戲；既有必選事件、戰鬥、擲骰／移動中、他人與CPU回合不能透過快捷鍵繞過控制。實際動作呼叫原函式。

## 變動檔案

- public/js/board_hotkeys.js、public/css/board_hotkeys.css：獨立按鍵設定與處理UI。
- public/js/board_game.js、public/board_game.html：既有行為的快捷鍵接入、設定入口與依賴。
- public/js/board_move_fx.js、public/js/board_battle.js、public/board_battle.html：攻擊圖片寬高放大30%；每招最後一次命中增加240ms停留，普通700→940ms，三連擊420/420/420→420/420/660ms，避免前段圖遮住後段發射。命中間隔、HP、施放音效與KO仍由原流程決定。board_game.js同步更新戰鬥iframe版本。
- config/desktop-program-packages-v1.json：新增兩支桌面程式白名單；專用builder保留4166媒體不動。

## 驗證與發布

隔離npm start使用18931及D:/Codex_QA/hotkeys-fx-20260922/server-data，DB停用；不使用正式存檔或帳號做QA。圖鑑及上一版資料保持相容。第一點效能檢查在第二／三點正式部署成功後才開始。

主遊戲真Chrome鍵盤整合39項通過（game-special-final/report.json），涵蓋清單開關／切換、桌機／手機及真正固定比例iframe、四方向及special主航線原選路函式、同向多路明確選擇、擲骰、必選事件與輸入／CPU／其他玩家限制。另有本機雙Chrome視窗LAN建房／加入／開始／回合與重整恢復回歸通過（lan-refresh-report.json，errors/failures均空）。這些是隔離自動化，並非實體裝置、真人四人局或真Electron遊玩。

快捷鍵設定真Chrome 44/44通過（settings-final/report.json），涵蓋改鍵、Shift／Alt、衝突確認／取消、清除／重設、重載保存、A／B帳號／登出／guest隔離、延遲storage、中文輸入與按鍵保護、Escape及聚焦按鈕不雙觸發，四尺寸截圖已檢視。Canvas尺寸／時序、發布builder與公開部署證據完成後補記。原失敗QA報告保留；初次伺服器程序被環境中斷、開場故事fixture未跳過、同向多路fixture不足皆已修正QA前提，不繞過正式遊戲的事件鎖。

專用發布builder隔離Git fixture 41/41通過（release-builder-qa/hotkeys-release-qa-xYL0o8/report.json）；限定五支既有程式變動、兩支新程式，保留4166媒體，共4214路徑。候選竄改、HEAD漂移、舊metadata變更皆拒絕；原未提交ranks／sea v1保留，fixture promote成功，正式發版另有公開檢查。獨立審查確認特殊主航線也已由R鍵涵蓋。

攻擊實際Canvas前後比較162/162通過（attack/readability-report.json），五種桌機／橫屏／縮放舞台／連擊／觀戰情境均390×390→507×507，普通命中700→940ms、末段連擊420→660ms，前段不延長；JS errors空。保留首次報告的單一baseline RAF容差失敗（同時執行另一QA造成52.5ms抖動），合理RAF容差重跑通過。既有KO真Chrome回歸38/38通過（attack/ko-regression/battle-order-report.json），純FX40/40、音效／接觸23/23亦通過。圖像、HP、音效及倒地時序各自驗證，沒有調整傷害或提早音效。發布前29份保護檔全部一致（protected-prepackage.json）。
