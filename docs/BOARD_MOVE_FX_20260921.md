# 航海錄招式圖像與音效 — 2026-09-21

## 完成範圍與目前狀態

後續發布已於 2026-09-21 完成，正式 package `package-2fc489ad68999481`；公開驗收、更新方式與版本見 [發布紀錄](BOARD_MOVE_FX_RELEASE_20260921.md)。下方「未提交／尚未發布」描述素材製作完成時的歷史狀態，原始來源與候選證據保留。

正式來源為 `D:\Codex_Release_Worktrees\board-voyage-records-v1`，開工 HEAD `d32c2e7cb408c10abf6c06ce4f3bdf3fc3687014`。本次已接入本機遊戲及獨立試播頁，未提交、未推送、未更新公開桌面 catalog、未發布到線上。原先已修改的 `public/images/ranks/r5.PNG`、`r6.PNG` 不屬於本次範圍。

從正式資料與實際招式生成函式盤點 1,504 筆角色／形態／階段來源，包含 1,471 個固定招式 ID；另處理 18 個同 ID 的裝備／階段變體、134 個已知普通攻擊／掙扎別名及黑轉動態招式名稱。來源包含 51 個基礎角色、33 個進化型、5 個囚犯角色、60 個血統型態和敵方／Boss／階段招式。映射表未漏配。

保留現有角色立繪，依招式內容逐一配對 102 組共用圖集，調整演出類型和大小；並非每個招式都重新繪製獨立人物姿勢。火拳、橡膠拳、雙掌火箭砲、刀斬、火踢、青炎鳳凰、藍焰踢、指槍、龍爪、電磁踢、鑽石拳、咬擊、ROOM、門、遲緩光線、火鳥與各種輔助效果分開配對。

## 圖像與聲音來源

- 102 組圖集，共 816 影格；每張為 2048×1024、4×2 格、帶 alpha 的 lossless WebP。總量 85,494,888 bytes。
- 全部新圖使用內建 GPT imagegen 生成。依效果顏色使用平坦青色／洋紅／綠色背景，之後在本機以 NumPy 色鍵分離、邊緣去色及 alpha 混合去背；不是線上去背服務。初期 rembg 試驗未作為最終去背流程。
- `scripts/process_board_move_fx_atlas.py` 只做本機去背、縮放與圖集排版，不繪製攻擊內容。每格保留 32 px 透明間隔，避免播放抽樣吃到隔壁影格。
- 原 GPT 圖留在 `.codex/generated_images`，選定原圖、完整提示詞與本機處理紀錄留在本次工作目錄；`BOARD_MOVE_FX_PROVENANCE_V1.json` 記錄原圖位置、完整 prompt、原圖與輸出 SHA256、影格資訊和去背方法。原圖 SHA 與安裝版 SHA 已逐一核對。
- 487 個 OGG，共 4,786,067 bytes；使用專案既有小森平音效裁切、調整音高、混音與淡入淡出。原始聲音未改。音效是遊戲內衍生混音，不是新錄音或獨立音效素材庫。
- 起手與命中音分離；870 個攻擊招式與 601 個輔助招式依性質設定。音效長度約 0.30–1.12 秒，解碼後無削波；數學／瀏覽器播放檢查不等於人耳聽感驗收。
- 音效來源與配方見 `BOARD_MOVE_SFX_PROVENANCE_V1_FINAL.json`、`BOARD_MOVE_SFX_PROVENANCE_V1_VARIANTS_FINAL.json`；487 個目前引用檔以外的 10 個本次舊版衍生檔已移至工作目錄保留。

## 遊戲接線

`board_move_fx.js` 僅使用 Canvas `drawImage` 播放 GPT 圖像，不用 CSS 畫新增的攻擊形狀、光暈或粒子。Canvas 加入原戰鬥特效圖層；傷害數字保持在圖片上方。程式不計算傷害、不推進回合、不寫遊戲狀態。

`board_game.js` 在既有準備、骰子、攻擊、輔助、切磋與 Tot Musica 視覺資料補上穩定 moveId；名稱／既有類別用於選擇同 ID 變體。`board_battle.js` 在原接觸時間播放影格與音效，支援方向翻轉、投射／斬擊、逐下連擊、補血和護盾；落空不產生命中圖像與命中音。

準備／骰子階段預載當前招式，快取上限預設 24 張；沒有整包預載 102 張。素材冷載入／失敗時保留舊演出，不延後傷害或事後補播。新圖已準備好時抑制同一次招式的通用舊攻擊粒子；六王槍專屬演出與特殊被動效果保留。

傷害、PP、屬性、命中率、回合、獎勵、存檔欄位、localStorage key、Socket.IO 事件名不變。未修改 Card／Chess 程式或素材。

## 驗證

| 項目 | 本次結果 |
| --- | --- |
| 圖集完整性／透明度／8 格各異／原圖與輸出 SHA | 102 組、816 格，零失敗 |
| 全角色逐招引用與變體 | 1,471 ID／18 變體／零缺檔 |
| 播放器／整合／既有觀戰／傳輸回歸 | 38／13／41／58 通過 |
| Chrome 真瀏覽器 fixture | 100/100，零 page error |
| Chrome 全素材解碼 | 102 圖集＋487 OGG，無空白／靜音／削波 |
| Chrome 實際音效播放 | 11 情境，21 次 play promise 全接受 |
| 原受擊順序回歸 | 接觸前血條與受擊狀態不提前改變，接觸後正確；零錯誤 |
| 同 ID 變體獨立審查 | 18×準備／骰子／命中，共 54 次查詢正確 |
| 桌機／手機視窗 | 1440×900、932×430、390×844；無水平溢出，直式保留既有轉橫向提示 |
| 正式 server/data | 24 個檔案 path／size／SHA256 零差異 |

測試情境包含單擊、連擊、落空、防禦攔截、輔助、裝備變體、史基同名不同階段、重送相同快照、慢載入與圖層關係。已逐組檢視素材總覽與影格，重新生成明顯切邊、跨格殘影、錯誤鞋型等圖集。這些是本機隔離 fixture／程式／瀏覽器測試；不是遠端真人連線、實體手機或人耳聽感驗收。

真瀏覽器完整證據 `BOARD_MOVE_FX_BROWSER_QA_V1.json`；圖片與原音來源另見上述 provenance。隔離 npm start 使用 PORT 18921，`board_move_fx_qa_isolation.js` 將 server/data 讀寫導向本次 work 目錄並移除 DATABASE_URL，沒有開啟正式帳號或房間。

## 本機試播與重建

`http://127.0.0.1:18921/board_move_fx_preview.html` 可搜尋角色／招式、切換我方／敵方、一般／連續／落空、試聽及逐格查看。該頁不連帳號、存檔或正式戰鬥規則。

`scripts/data/board_move_fx_v1.json` 是固定逐招對照表；修改後執行 `node scripts/build_board_move_fx_catalog.js --check-assets` 重建遊戲目錄。去背 QA 使用 `qa_board_move_fx_assets.py --work <本次work/gpt-fx> --output <QA目錄>`。音效依 `build_board_move_sfx.py` 與 `scripts/data/board_move_sfx*_v1.json` 重建。

## 尚未發布

`config/desktop-program-packages-v1.json` 已增加兩支核心 JS，Board 程式白名單為 39 份；試播頁不加入玩家完整包。另提供只輸出非 public 候選目錄的 `build_board_move_fx_release_candidate.js`，凍結新增 589 筆媒體及候選 Board 套件，讓下一次發布可核對完整素材。候選檔不代表已上傳或已供玩家下載。

本次工具輸出的候選為 `package-9cf4796087a91b1a`，共 4,079 檔，新增 591 路徑（2 JS＋589 媒體），實質修改 4 個既有 Board 程式；其餘程式依 Git 換行規則比對後保留基準位元組。39 份候選程式與 589 份媒體均核對 SHA，重建結果穩定。Card／Chess 記錄及原公開 metadata 保持；`BOARD_MOVE_FX_RELEASE_INPUTS_V1.json` 留有來源 raw SHA、候選 SHA、基準 HEAD、未提交標記和完整範圍。換行正規化的候選 bytes 留在本次 `work/release-candidate/program-bytes/`，不能將 working tree raw bytes 混當 Git HEAD 發布。

正式發布仍須在授權提交後核對 Git HEAD 位元組、把全部新媒體合併進 Board v3 manifest，再走既有 R2 CAS 上傳與公開 GET／SHA／版本讀回；保留 Card／Chess 與原 rank 圖記錄。不應重建整個 v2 素材基線或把 589 個媒體塞入有 500 筆上限的程式白名單。
