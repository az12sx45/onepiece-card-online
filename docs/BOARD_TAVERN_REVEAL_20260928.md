# 酒館招募動畫 2026-09-28

## 實作

正式來源：D:/Codex_Release_Worktrees/board-voyage-records-v1。發布整合基準為線上 main 92a11b3c5c1c8e21eea5ab84917dd5c8c5e8d441，於 managed tavern-recruit-animation 工作樹驗證。

只有酒館實際抽選傳入 tavernReveal UI 標記。原结果先建立，再由只讀呈現模組播放約 6.9 秒：魯夫台詞「你願不願意加入我們？」、階級光、開門剪影、角色揭曉。剪影直接使用原結果的角色圖，不另抽選、不改人物 id。三張 GPT 原畫的來源及完整 prompts 見 BOARD_TAVERN_CINEMATIC_ART_20260928.json。

沿用配色：S #ffe27a、A #dca4ff、B #9fc4ff、C #9fdaa9、D #cad2db、E #d7b786。演出暫停原決策輸入，按鈕原 disabled 狀態於結束／跳過／關閉還原。Escape 可跳過；reduced-motion 直接顯示原結果；3 秒素材逾時或載入失敗會恢复操作。既有 BoardAudio draw/reward 音效遵守原音量／靜音設定。沒有新增合成魯夫語音。

已有背景的角色圖片使用 `images/board-depth/v1/manifest.json` 內已審核、尺寸一致的 alpha 遮罩；原本透明的人物沿用透明輪廓。遮罩只影響本次動畫，不改原圖、深度模組或原結果。未取得安全輪廓時回到原結果，不顯示黑色方塊。

## 驗證與發布

本機 `npm start` 運行在 18928，使用隔離工作樹及鎖定相依套件；無 DATABASE_URL，沒有連正式資料庫。本機候選素材使用原有 OP_DESKTOP_ONLY=0 開發設定；公開 desktop gate 保持原設定。

`board_state_wire_integration_qa.js` 本次通過 13 項：四個真實 Socket.IO 用戶建立／加入／開始、回合控制交接、完整／差異快照、拒絕過期及未授權推送、遺失基線恢復、重新連線與混合新舊客戶端。這是同機隔離自動化，非遠端或真人遊玩驗收。

招募 `board_tavern_reveal_qa.js` 50 項通過，0 瀏覽器錯誤：四階段與六級顏色、跳過／快捷鍵／減少動態效果、素材失敗還原、取消清理、真實招募只扣款一次及收下／放棄／六人替換。alpha 輪廓測試的透明比例 0.62646，魯夫退場 opacity 為 0。桌機 1440x900、手機直向 390x844、橫向 932x430 截圖另做目視覆核。最初擋住新素材的本機舊 manifest 路由已用既有開發設定排除；最初的魯夫動畫 fill-mode 與不透明背景問題已修正，不將那一輪列為視覺通過。

`board_tavern_reveal_sync_qa.js` 本次 13/13 通過、0 錯誤：兩個隔離 Chromium context 經真實本機 Socket.IO 建房／加入／開始，正規化測試初始狀態與 QA-only 固定亂數後按正式招募按鈕；雙方看到同一娜美 E 級及 #d7b786，20000→17500 只扣 2500，觀看方跳過不改招募，操作方收下後只加入一名角色、移出候選池並交棒，正常 state ACK 版本 5；觀看方重整保持隊伍、錢包、候選池、回合與身份。未把固定亂數測試宣稱為機率統計驗收。

角色來源稽核：51 個基礎角色及 33 個進化型態的 84 張正常肖像全部有既有 approved mask，source SHA256 與尺寸、遮罩尺寸及非平凡 alpha 均相符；共同 idle fallback 原圖為透明。無缺失或不安全的不透明輪廓。

證據：D:/Codex_QA/board-tavern-reveal-20260928/result.json、sync/result.json 與同目錄截圖；選取的原始 JSON 另保存為本文件旁的 BOARD_TAVERN_REVEAL_BROWSER_QA_20260928.json、BOARD_TAVERN_REVEAL_SYNC_QA_20260928.json。本次為自動化、隔離本機驗證，非真人、實體手機或跨網路多人驗收。

發布進行中，尚待 R2 bytes/SHA/CORS 及公開 runtime identity 驗證。

LATTICE runtime/task API 不在本階段工具清單，官方 Status 回傳 BLOCKED / CUSTOMER_DEPENDENCY_FILE_SET_CHANGED。未登記新 task、未修改資料庫、未宣稱圖譜成功。舊正式工作樹的未提交修改完整保留。
