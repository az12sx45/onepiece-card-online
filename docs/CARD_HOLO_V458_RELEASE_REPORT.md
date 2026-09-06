# Card V458 發布候選紀錄

2026-09-06：**尚未上傳、未 commit／push、未觸發 Render；正式站未更新。**

## 來源與回復點
已完整閱讀 CARD_HOLO_V458_DEPLOY_HANDOFF.md，五份來源 SHA-256 均符合交接。正式遠端 https://github.com/az12sx45/onepiece-card-online.git 的 origin/main 經本次 fetch 確認為 `14d089027b8af8ee80e64f18b88a02dca20b0fb2`。正式網址 https://onepiece-card-online.onrender.com/game.html 。

候選位於 `D:/Codex_Release_Worktrees/card-holo-v458-release`，分支 `codex/card-holo-v458-release`。回復分支 `codex/rollback-before-card-holo-v458` 指向上述正式版本；不能用原 C 槽 before HTML 回復正式站。隔離樹採 sparse checkout，大型素材僅以 junction 讀取既有素材，不複製整套卡圖。

## 候選公開清單（均尚未發布）
- public/game.html：34 行新增、10 行移除，只合併四接點、dex class、兩新引用。保留正式 cursor v4、本機 Tailwind 與其他更新；inline JavaScript 和正式前版相同。
- public/css/card-holo-v1.css
- public/js/card_holo_v1.js
- public/third_party/pokemon-cards-css/NOTICE.md
- public/third_party/pokemon-cards-css/LICENSE.txt

比較頁、QA、artifacts、素材 junction、套件、server、DB、啟動器與其他既有修改均不在發布清單。

## 本次驗收
- PORT=8849 npm start 啟動成功。本機無 DATABASE_URL，只驗靜態頁。首跑因伺服器尚未啟動而連線拒絕，啟動後重新跑兩項 QA 通過。
- 合併版 card_holo_qa.js：38 項 PASS、0 page errors。
- 合併版 card_holo_choice_qa.js：82 項 PASS、0 page errors；before 基準改用正式前版。仍為 renderer fixture／mock Socket，不是正式多人證據。
- 390×844 圖鑑與 1440×1000 強化二選一截圖已目視檢查，卡圖比例完整。
- 兩個已授權帳號真實登入正式站；測試房 DAB5K4 的 0 CPU 雙人加入、準備、開局、抽牌及 STATE 接收完成。正式系統無私人房存取控制，此為隨機碼低暴露測試房。
- 候選真實連線 QA 僅在臨時瀏覽器攔截 game.html／新 CSS／新 JS 三份回應，後端／引擎／Socket 為正式環境，無 mock Socket 或注入牌堆。
- 手牌點擊曾等待逾時且測試 session 重設；未確認成功出牌、技能目標、對手出牌同步或真實禁選，原因尚未定位。不得宣稱已完成、已修好或只是工具問題。
- 影音請求被抑制以減少流量，不算完整影音演出驗收。密碼沒有寫入檔案或報告，測試瀏覽器阻止 op_last_password 儲存；測試房已用其自身 ROOM_FINISHED／LEAVE_ROOM 結束、瀏覽器關閉，未讀寫 Board 進度。
- 尚無上線資源、正式出牌／禁選、發布後舊 SW 更新或實體手機驗收。其他本機補充報告見 artifacts/card-holo-release-v458，不能算正式上線證據。

## 暫停原因
補充 predeploy resource／SW QA 已通過 51 項：本機四接點、四資源 HTTP 200／型別／內容，代表卡圖比例 2:3 且與正式素材相同；正式 HTML 仍為零接點、新四資源仍 404，確認未發布。受控 Chrome profile 已由真 op-card-v7.5 控制並快取舊 game.html；237 個快取項中 228 個媒體預載以 QA 零位元 stub 限制下載，因此不能視為完整離線媒體驗證。報告為隔離樹 artifacts/card-holo-release-v458/predeploy-state.json；相關測試 context 已關閉，上線後舊 SW 驗收仍未執行。

GPL-3.0-only 改作已保留作者、來源與 LICENSE；但整合到既有 Card 前端後，相關程式授權範圍仍需擁有者確認。合併作品與真正獨立集合的要求不同，附上 LICENSE／NOTICE 不會自動解決整合範圍。這是待確認風險，不是認定整個 repo 或後端必須改成 GPL 的法律結論。

參考：https://www.gnu.org/licenses/gpl-faq.html#MereAggregation 。

未擅自改整款遊戲授權，亦未擅自換成不同實作。下一步需使用者決定：先確認／補齊相关程式 GPL 發布授權，或另行授權獨立重做特效，再補完驗收與發布。

目前未上線，無需回滾。未來若發布後需回復，針對實際發布 commit 作 scoped revert，保留其他後續更新，不 reset main 或整份覆寫 game.html。
