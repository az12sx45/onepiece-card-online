# Card Depth V1 — 全套 80 卡分層

## 2026-09-07 發布前驗收完成，待部署

- 全部 80 卡輪廓審查與重建完成；最後 normal/4、11、12、16、17 使用已鎖定模組重建，enh/12 衣服缺口與 enh/18 領口背景均經修前／修後二審接受。
- 240 個最終 WebP 共 13,632,032 bytes；原圖 80/80 SHA 不變，固定文字／框像素誤差全部 0。C 主來源與 D 隔離樹新素材 240/240 SHA 相同。
- 完整清單及每個檔案 SHA：`docs/CARD_DEPTH_V1_ASSETS.json`（LF 版 SHA-256 `88d1f47444cfc6bedbdfce27648947530909f1f8323d4ff8842ce699092969db`）。產生器同時校驗目前 alpha 修補配方，避免混入舊輪廓；SAM-only 模型使用明確名稱，不假設所有模型報告都有 name 欄位。
- 最終重建後重新執行 browser-final：2,262 checks、80 組、320 真實 HTTP、0 page errors 全數 PASS。單元 4,901 項亦 PASS；C／D JS、CSS 一致，game.html 相對正式基準只有兩處版本 query 差異。
- 真雙帳號 candidate 兩輪 PASS：第一輪 hand／drawn 各一次與技能目標／禁選數字；第二輪 6 次出牌，包含基德取回棄牌後再次選牌、交換手牌、香吉士 PK，直至自然結束一局。兩輪都驗證單次 PLAY_CARD、手牌隱私與對手同步、兩個出牌分層接點；page errors 0，console 有既有媒體 404 各 4 筆，不宣稱全站無錯誤。
- 本輪沒有自然遇到「二選一的卡片禁選」，仍由 browser fixture／單元覆蓋；不把技能的禁選數字當作卡片禁選。候選程式／景深素材由本機提供，帳號／房間／規則／Socket 使用真正式站；既有圖片、音訊、影片以相同素材本機回應以免重複消耗正式流量。
- 第一輪歷史 Killer 失敗確認為 QA 的 9 秒等待短於原強化影片。僅修 QA：讀影片 currentTime／duration，有界等原 overlay 自然關閉，不 skip／seek／移除影片；一般控件仍 9 秒。自測 23 項 PASS。後兩場自然未再遇到 Killer，不宣稱已重演該真人情境。
- 尚未 commit／push／部署。本段取代下方「重建／二審中」的當時快照；更新後 SW 與正式 243 檔雜湊結果仍待部署後補記。
- 可重跑發布驗收：`node scripts/card_depth_assets_live_qa.js <完整程式commit>` 比對三個程式檔與全部 240 素材；`card_depth_sw_qa.js --phase postdeploy --release-commit <commit> --playwright <路徑>` 延續既有 V3 SW profile，不清除它再冒充升級。

## 2026-09-07 最終重建／二審中，尚未發布

使用者要求全部卡片，並同意在本機下載免費 BiRefNet 批次處理。範圍為一般、強化、豪華、豪華強化各 20 張（0–19），不含牌背。80 張原圖均為 1242×1863、2:3；已建立原始 SHA-256 清單與全套版面 contact sheets。原圖不覆寫、不重新畫人物或文字。

### 製作與渲染契約

- 獨立環境 `D:/Codex_Tools/card-depth-birefnet-v1`。BiRefNet-general-lite CPU ONNX 只在製作端執行，模型不放入網站或啟動器下載包。上游來源、授權及 checksum 見 `tools/card-depth/`。
- `public/card-depth/v1/{normal|enh|lux|lux-enh}/{0..19}/`：background.webp 為局部補洞背景，subject.webp 為原畫透明人物；foreground.webp 僅為固定框／文字保護 alpha mask，前端套在已載入原卡圖上，不重新下載另一張文字彩圖。
- 每卡有獨立 artwork 視窗、數字保護區。強化凱多 10 的直存橫向構圖另處理；豪華卡內探金飾固定不晃動。BiRefNet 遮罩另需逐卡目視檢查，不能把全卡去背當作人物拆層。
- OpenCV Telea 補洞填補人物微位移後露出的窄區，不新增人物或更改原印刷文字。人物限制在框內，背景與文字保持固定。
- 四個既有 Card Finish 接點與 8°／12° 傾斜沿用，不更改出牌、強化時序、凍結、禁選、Socket、資料庫或 Board。
- 只在桌機有效 hover 時按需載入該卡三份素材；素材未齊全、錯誤、切卡、離開、禁選、觸控、減少動態時退回原卡。一次只一張活動卡，不在玩家端推論模型或全套預載。

### 正式發布邊界

- 正式 main 基準：`01d6c760468e45f11e5ab56d034372af26c17583`；程式部署仍為 V3 `ff72fbfb`。
- 限定發布樹：`D:/Codex_Release_Worktrees/card-holo-v458-release`。C 主來源另有未發布修改，禁止整份覆蓋 HTML 或一併提交。
- 回復分支已建立：`codex/rollback-before-card-depth-v1` → `01d6c760468e45f11e5ab56d034372af26c17583`。
- 發布樹 public/images 是 junction，不在其中寫新圖。新 public/card-depth/v1 為普通目錄；完整套件預期 240 個新 WebP，以最終清單與 hash 為準。
- 新 URL 由 Render 靜態路由提供，瀏覽器 SW 首次成功取得後快取；桌面程式可由網路讀取，但尚未列入既有離線媒體包。本輪不改 launcher 安裝包或 R2，不宣稱全套離線。

### 本輪驗證狀態

- 80 張最終版正在重建；主流程另列的 19 張難卡已有 17 張二審 PASS，另 2 張仍在修正。這是本段更新時的進度快照，不代表全部最終輪廓已接受，也不填入尚未確認的正式檔案雜湊。
- 獨立人工 alpha 修補 enh/7、13、17 與 lux-enh/12、15、17、18 共 7 張已完成原圖、修前／修後灰底輪廓、左右位移與主流程二審。基拉金髮與握刀拳已接回，卡塔克利白圍巾誤切洞已核對原尺寸細節後補齊；紅色氣場、背景旁觀者及框飾仍固定。7 張原圖 SHA 均不變、固定像素最大誤差均為 0；作者修補模組已鎖定，後續僅由主流程整合重建。
- npm start 在 8849 成功，本機無 DB，不作正式登入證據。
- 前端單元 4901 項、既有桌機／手機回歸 215 項 PASS。第一次 browser 執行因本機 server 已停止而失敗，重啟 8849 後重跑通過；不可將第一次失敗藏掉。
- 原圖 80/80 與正式素材來源 SHA-256 一致。第一輪產出 68 張後因記憶體不足停止；後續串行完成剩餘 12 張。80 張初版齊全不等於美術驗收通過。
- 實際人物 cutout 審查發現漏臉、手臂及夾帶背景；固定像素誤差 0 和中性合成相似不當成分層成功。使用唯讀原圖、獨立 alpha 修補配方、SAM 局部提示遮罩補足，並檢查灰底輪廓及左右位移合成。複雜場景以前景人物／背景對手或能力場景分層，不強制所有人物同層。
- MIT BiRefNet-general 局部試驗未改善而停止，未採用其遮罩。後續 SAM ViT-B quant 為 Apache-2.0，模型均只存製作端、不進 public／安裝包；沒有新增網站套件或把圖上傳雲端。授權與 SHA 在工具 notices。
- 完整 browser round3-rerun2：2,262 checks PASS、80 組／320 個真實 HTTP 回應、page errors 0。20 次 hover 有 60 次正確三層 src 指派，實際 network 5 筆／328,086 bytes；其餘由瀏覽器記憶體快取供應。未測量或宣稱 GPU／renderer 記憶體釋放。先前兩輪失敗分別是 QA 假設每次都 network 3 筆，以及合成 dispatchEvent 繞過 disabled；改為驗證真實 src 指派及實體滑鼠，未改 runtime 掩蓋失敗。此結果不取代最終重建後 240 個檔案的逐檔雜湊與完整驗收。
- 既有 SW 基準擷取 22 項 PASS，版本 query `20260906-finish-frame-v3`、正式 controller `/sw.js`、cache `op-card-v7.5`、depth entries 0。這只證明更新前基準，不代表更新後已通過。
- 真雙人 candidate 第一輪已完成 hand 4、新抽 13 的分層與一次出牌，但 QA 在基拉目標後的對話控制項停住（CONTROL_NOT_ACTIONABLE）；保留失敗證據，尚不列多人 PASS。乾淨／既有 SW 更新與正式資源驗收仍待部署後執行。
- 獨立只讀發布審查未發現新增 runtime 阻擋問題；D 樹重跑單元 4,901、JS 語法與限定差異檢查通過。原 game.html 差異僅兩個資源版本引用，alpha mask 不作可見白圖，固定前景沿用原圖，沒有新增出牌操作事件。D 的新景深目錄是普通目錄、檢查時僅有 240 個 WebP，未包含模型或環境；工具 MIT／Apache 來源與授權全文齊備。尚未檢查最終 staged 清單或把此審查當成正式發布驗收。

### 本機證據

`artifacts/card-depth-v1/inventory/source-inventory.json` 保存原始清單。逐卡配方、原圖／素材 hash、左右比較及各輪待審狀態在 `artifacts/card-depth-v1/layers/` 等製作目錄；舊報告保留當時結果，不因後續修補改寫失敗證據。模型試驗在 `artifacts/card-depth-v1/pilot/`、`general-pilot/`、`sam-pilot/`、`sam-refinement/`，均為非公開製作與 QA 證據。

7 張獨立人工修補的完整紀錄在 `artifacts/card-depth-v1/enh-corrections/REVIEW.md`、`artifacts/card-depth-v1/lux-enh-b-corrections/REVIEW.md`，同層有來源雜湊、完整多邊形座標、修前／修後灰底及左右位移預覽。工具來源與授權保留於 `tools/card-depth/README.md`、`THIRD_PARTY_NOTICES.txt`、`SAM_APACHE_2_0.txt`；它們不替原卡藝術素材重新授權。

正式資源雜湊、完整清單、最終兩張難卡與 candidate／SW／postdeploy 結果，待主流程完成後補記。不得將目前「尚未發布」改述為已上線。
