# 草帽十人酒館邀請與分歧演出

## 範圍與來源

正式工作樹為 `D:/Codex_Release_Worktrees/board-voyage-records-v1`。發布整合沿用 managed `tavern-recruit-animation`，先 fast-forward 至 `6dc1fcf32c13225e108b32767251c20098eefed4`，保留既有 rank 圖未提交修改與已發布 launcher 1.2.7。既有 Board 基準為 `package-b5eaebdecfaee7d6`。不覆寫兩棵工作樹原本不同的主程式內容，只同步本次明確區塊。

魯夫台詞固定「你真有趣，要不要加入我們？」。十位草帽夥伴以獨立的 cosmetic crypto RNG 隨機出場，不消耗原招募抽選的亂數；同一次招募的邀請、加入、拒絕與旁觀者使用同一 host ID。角色資料在 `public/js/board_tavern_crew.js`，每人三句原創台詞、三種表情素材與動作配置，不使用官方逐字長篇台詞。

## 流程與安全

原扣款與抽選時點不變：先扣一次 2500 並固定抽中角色，再播放邀請、階級門光、剪影及角色揭曉。人類玩家在演出中選加入／不加入，分別播放出場角色的接受／婉拒反應；實際加入、移出候選池、替換與結束回合仍呼叫原本的結算函式一次。滿隊只先回既有六人替換介面，確定替換誰後才播接受反應。

初始「跳過動畫」只返回原結果，不選擇；已選接受／拒絕後跳過，則完成已選擇的動作一次。減少動態或圖檔失敗會直接走仍有效的原處理，不吞掉選擇。延後執行前核對同一 gameState、玩家物件、round、phase、行動玩家、modal 與本機控制權；換局、失權、modal 移除則取消。鎖定綁在同一次結果，不跟著 overlay 重建而重設。

CPU 初始演出後回到原本按鈕策略，不等人類 overlay 選項；滿隊保留原評分差額 180 的替換政策。測試抓到結果名稱／階級仍查舊 selector，已兼容新 `.tavern-result-name`、grade 與職能欄位，避免滿隊評分讀不到新角色而一律拒絕。旁觀只讀既有 `spectator-modal/tavern-result` detail 的 host/outcome，沒有選擇或完成 callback。未新增 localStorage key、持久 gameState 欄位或 Socket.IO event 名稱。

邀請開始前以 WeakMap 綁定當次結果的有效性檢查，載圖、邀請、等待選擇與反應期間皆每 100ms 確認；失去控制權但 modal 仍存在時也撤除演出，不留失效畫面攔住輸入。這些只屬本機暫態 UI，不寫入快照或存檔。

## 角色檢查

不依表情檔名盲選：佛朗基 `cry` 圖實際為雙讚，作接受；`proud` 圖實際落淚，作婉拒。娜美舊 story 圖缺刺青，改用同時期服裝與左臂刺青的參考，另做三張邀請／接受／拒絕圖；喬巴補齊雙角、布魯克邀請與接受各補齊琴端；香吉士補自然歡迎表情，原圖全部保留。共八張新圖集中 `images/board/tavern_recruit/crew_v2/`，提示詞、原生透明 PNG 與 WebP SHA 由獨立 art JSON 記錄。既有半身圖在呈現層底緣輕微淡出，全身圖不遮住腳部，不改原始素材。

個性依官方角色資料核對，台詞為本次原創：

- [魯夫](https://one-piece.com/character/luffy/index.html)：直率好奇，歡迎冒險，拒絕不記仇。
- [索隆](https://one-piece.com/character/zoro/index.html)：寡言可靠，職能為戰鬥員，不擅稱正式副船長。
- [娜美](https://one-piece.com/character/nami/index.html)：精明航海士，不用額外收費笑話改變招募規則。
- [騙人布](https://one-piece.com/character/usopp/index.html)：吹牛與努力勇敢並存，不只拿懦弱取笑。
- [香吉士](https://one-piece.com/character/sanji/index.html)：以料理照顧夥伴，不對未知性別玩家強制調情。
- [喬巴](https://one-piece.com/character/chopper/index.html)：天真而認真的船醫，不當寵物。
- [羅賓](https://one-piece.com/character/robin/index.html)：冷靜知性，有從容的幽默，不恐嚇拒絕者。
- [佛朗基](https://one-piece.com/character/franky/index.html)：豪爽重情的船匠，誇張表情與台詞互相對應。
- [布魯克](https://one-piece.com/character/brook/index.html)：禮貌、音樂與笑聲，不使用內褲梗。
- [甚平](https://one-piece.com/character/Jinbe/index.html)：穩重仁義，尊重各自航向，不硬套大笑。

## 驗證狀態

本次尚在本機驗證，沒有把候選當作已部署。`scripts/board_tavern_invitation_qa.js` 最新完整回歸 163 項通過、0 瀏覽器執行錯誤：正式招募 handler、十人各兩種分歧、只扣一次 2500、加入／拒絕／六人替換、重複點擊、初始與反應取消、CPU 三種策略、reduced-motion、缺素材／缺 helper fallback、旁觀只讀與三種畫面尺寸。刻意缺圖測試的 HTTP 404 不當成正常素材載入證據。該輪 CSS 為底缘淡出前版本，後續獨立視覺測試使用最新 CSS。

`board_state_wire_integration_qa.js` 13 項通過：四個真實本機 Socket.IO client 的建立／加入／開始、完整與差異快照、控制權交接、過期／未授權拒收、重新連線及缺基線恢復。Builder 13 項邊界與角色資料／crypto RNG 8 項檢查另保存證據。以上是隔離自動化，不是實體手機、真人遊玩或跨網路多人驗收。

root 已逐張查看十張三階段 contact sheet，包含重畫後的布魯克接受圖；也核對甚平三階段桌機與 390x844／932x430 的魯夫邀請、結果及拒絕畫面，文字與選項分離。角色時期、服裝、可見傷疤／刺青方向、動作與原創台詞相互對照，不宣稱官方原畫或逐像素 model-sheet 認證。

最新 CSS 獨立視覺驗證：390x844、932x430 全十人各三階段共 60 個畫面通過；320x568 額外六個重點畫面通過。曾抓到小手機羅賓髮絲擦到跳過按鈕，僅將短直向 host frame 改為 top 10%／height 49%，重驗六例碰撞清零。root 另實看新淡出效果、喬巴／甚平直向、羅賓／騙人布橫向及修後羅賓／布魯克最小手機畫面。66 畫面採角色實際透明輪廓而非 img 元素框檢查，無台詞／跳過遮擋、截頭與文字溢出，0 page/runtime HTTP 錯誤；原始結果與最終 CSS SHA 見 `BOARD_TAVERN_CREW_RESPONSIVE_ART_QA_20260928.json`。

`board_tavern_invitation_sync_qa.js` 44 項通過、0 瀏覽器錯誤：兩個獨立 browser context 經真 Socket.IO 建房／加入／開始，在三個隔離房間分別接受、拒絕、滿隊替換；host、台詞、階級、反應相同，旁觀方無決策按鈕且跳過不改主方 state；扣款一次、crew/pool 正確、既有 state transport 一致，旁觀重整恢復結果與身份。QA-only 固定抽選及初始場景不列為隨機機率統計。初稿測試對動畫要求毫秒鎖步、企圖同房越權重設回合、過早比較拒絕後版本 4/5 的三種 fixture 問題已修正；未為讓測試通過更改正式同步規則。

另以本次 `npm start` 開啟 localhost:18929，health、board_start、board_game、crew JS 與 CSS 皆 HTTP 200；DATABASE_URL 空白，預期 DB 功能停用，未接正式資料庫。原測試服務 18928 保留。公開部署仍須等新包 identity 與逐檔雜湊核驗，不能以這些本機結果代替。

LATTICE API 目前未列在可呼叫工具清單；前一階段官方 Status 曾回報 `CUSTOMER_DEPENDENCY_FILE_SET_CHANGED`，本次未聲稱新 task、圖譜或資料庫記錄成功。既有接入 project/task 只作續接線索，未冒充本次完成紀錄。
