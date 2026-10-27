# 爭霸戰公開互動結果 — 2026-10-28

使用者要求：選擇/猜測的數字、交換雙方、護盾與閃避需要明顯呈現。

## 實作
- 共用 presentation 顯示大數字、雙方名稱與猜中/猜錯，交換顯示雙向卡背飛行及雙方名稱；公開結果停留 3.6 秒。
- 新 GPT 透明圖製作護盾/閃避獲得及觸發動畫。公開狀態常駐頭像旁，DOM 更新後重算位置；防禦擋下與猜錯分開表達。
- server/engine.js 僅新增 card_guess/card_defense 公開 EMIT，資料限來源、目標、選擇尾數或公開防禦種類。原有狀態、規則、勝負與事件順序不變，不公開手牌。
- Android/iOS 共用 android/web/card-phone-fx.js/.css；桌機由 android/build-card-desktop.mjs 生成 public/js/card-desktop-table.js 與 public/css/card-desktop-table.css。既有 Socket.IO 事件、儲存格式不變。

## 驗證
- scripts/card_action_presentation_qa.js：對已發布 4e985dd20 原引擎進行 256 次操作對照，狀態與原事件完全相同；新增 86 筆公開結果，無手牌欄位。
- android/card-action-clarity-qa.mjs：手機 640×316/844×390、桌機 1024×600/1366×768，各 52 項；字、圖、停留時間、事件合併、遮蔽資訊與 STATE 不重播通過。
- 既有 FX 314、頭像選人 67、原生與桌機共存 4 項通過，零 pageerror。
- scripts/card_action_sync_qa.mjs：真正 npm start 與兩個 Chromium 獨立視窗建立/加入房間、雙方準備、開始、當前玩家抽牌廣播、重整恢復座位與回合、他人手牌遮蔽，共 7 項通過。測試資料庫停用，未碰正式帳號，不等於 Android/iPhone 真機多人驗收。
- 證據及實際 HTML 錄影：D:/Codex_QA/card-action-clarity-20261027。發布需以後續公開讀回收據為準。

## 素材
儲存在手機原始碼 android/web/art/card-status-guard.webp、card-status-dodge.webp；透明 GPT 圖以保留 alpha 的一般縮圖輸出 320px WebP。CSS 只負責排版與動態，不繪製替代圖示。

Shield prompt: A single ornate pirate fantasy card-game protection shield UI sprite, polished antique gold rim and luminous turquoise crystal shield, bold recognizable silhouette, front view, readable at 40px, hand-painted premium collectible card-game art, no square frame, no letters or numbers, centered with 12% transparent padding. Transparent background, no scene. Match a dark ocean naval tabletop interface. This will animate above a circular player portrait when a shield blocks a skill.

Dodge prompt: A single pirate fantasy card-game evasion status UI sprite: luminous cyan sweeping feather-shaped wind arc with three ghostly afterimages, dynamic motion sweep to the right, antique gold highlights, bold readable silhouette at 40px, hand-painted premium collectible card-game art, no square frame, no text, no numerals, centered with 12% transparent padding. Transparent background, no scene. Match a dark ocean naval tabletop interface. This will animate above a circular player portrait when evasion avoids a skill.

LATTICE API 本階段未提供，未宣稱任務/圖譜寫入成功；沿用既有 Card task e4368cf0177acd6ead577d369a181d11b6d4ff30c66fb681fe4ff60e8b5b663e / project fc1f1991-a190-4cd1-8933-947297d0ebbe。
