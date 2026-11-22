# 婚禮祝福 API v2

此服務僅供 `photo-groups-2026` 婚禮分支使用，與遊戲 main、遊戲 PostgreSQL 完全分開。v2 沒有記憶體資料庫後備模式：Render 必須連上 D1，資料庫失敗回傳 503，不能顯示「已送出」。

2026-11-22 部署時實際發現 sharp 0.34.5 的上游解碼器安全公告，已依 [sharp 官方公告](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w) 更新並鎖定 0.35.5（Node 至少 20.9.0），重新產生 lock；針對此 API 的 `npm audit` 已回報 0 個弱點。sql.js 1.13.0 不在這次弱點清單，保留原版本。解碼與持久化測試須使用更新後的套件重跑，Render 亦須部署含此 lock 的版本。

## 目前正式狀態（2026-11-22 台北時間）

婚禮靜態站版本 `f49c05e626bf24ca5f72a6016a25d3b80f46697f` 與 API 版本 `5755b731afee9fac450eeff6cc8512573e833a0d` 已在原網址 Live；兩版的 API 可執行程式與 migration 完全一致。靜態部署 `dep-dc158nrl550s73df6hqg` 於台北10:34:07完成，API `dep-dc150f2jnfac73fnfl00` 於10:26:36完成。API `/health` 已實際讀回 `version:2`、`persistent:true`、`storage:"d1"`、`avatar_gender:true`。已設定受限 D1 長期權杖與獨立 ADMIN_TOKEN，兩個婚禮服務均維持Free，沒有開通 R2 或升級付費方案。現在提供自然比例相框、自選圓形裁切及男／女空輪廓，實際驗收結果按下方各次紀錄區分。

已在正式網址以 5 筆明確標記的系統祝福驗證 SSE 排隊、單人翻頁與五個進度截圖；另以 WebKit 手機模擬完成自拍圖片→API→D1→SSE→電視。管理介面授權與隱藏、CSV／含頭像 JSON 匯出通過；共 6 筆系統測試紀錄已隱藏，沒有刪除資料。2026-11-22 02:20:02 執行 Render Restart service，02:20:56 重新讀回全部 6 筆與 480×480 JPEG 頭像，維持隱藏。正式公開頁目前沒有系統測試留言。

第二次正式驗收於台北 03:11 完成：正式靜態檔逐一比對 Git 相同、1920×1080 整本書與 QR 解碼、真正控制台送出暫停／下一頁／上一頁／重播／繼續均通過；換頁同步輪替原照，依字數自動播放，保存翻頁 0/25/50/75/100% 畫面。另用一位現有公開署名與原雜湊映射核對，省略姓氏的正式手機查詢成功；這不是逐人名單驗收。過程沒有新增或修改祝福，公開既有 id 7/8/9 皆保留，測試結束恢復自動播放。

管理：開啟 [control.html](https://tantan-lily-photo-groups-2026.onrender.com/control.html)，輸入 Render 婚禮 API → Environment → ADMIN_TOKEN 的既有值。可暫停／繼續、前後頁、重播、公開／隱藏／軟刪除留言、匯出 CSV 與完整 JSON。金鑰僅保留在當前分頁記憶體；重新整理須再登入。電視 [tv.html](https://tantan-lily-photo-groups-2026.onrender.com/tv.html) 沒有可見控制鈕，雙擊書本或 F11 全螢幕。每頁停留 6 秒＋祝福 grapheme 字數×0.3 秒、最多 15 秒，翻頁 1.1 秒；每次完成翻頁輪替原五張新人照片。會場開始前先開啟電視頁，讓免費 API 完成閒置喚醒並持續接收。

仍待實體 iPhone 相機／相簿與現場電視確認；Playwright WebKit 模擬不等於真機驗收。原先 10 款 AI PNG 不在此分支或提供的本機素材目錄，需使用者重新提供才能接入；目前沿用十種 CSS 樣式及新增 SVG 花卉。原 15 組查詢映射與五張新人照片逐字保留；因原始明文邀請名單不在 repo，沒有重新統計或宣稱逐人核對 80 筆／169 人。

以下登入與設定流程供日後維護參考；沿用已建立的婚禮資料庫，勿重複建立。單元測試的選擇性 D1 REST 項目因本機程序未配置正式 token 而跳過；上列真正 D1 驗收使用正式部署 API，兩者分開記錄。

## 儲存與免費額度

正式架構為原 Render Node API → Cloudflare D1 REST API。祝福文字、審核狀態、唯一送出識別碼與 SSE 事件序號永久寫入 D1；480×480、最多 150 KB 的 JPEG 頭像以 base64 放在獨立 `avatars` 表，避免開通 R2 訂閱。169 張頭像即使每張達上限，加上 base64 約 34 MB。所有公開清單只取文字及頭像路徑，不將圖片塞進每次 SSE。

官方目前的 Workers Free D1 額度為每日讀取 500 萬列、寫入 10 萬列；單資料庫 500 MB、帳戶共 5 GB。免費方案超額會拒絕查詢，應留在 Free，勿啟用付費升級。R2 雖有免費用量，但啟用需完成訂閱 checkout，這個版本不需要它。

- [D1 價格](https://developers.cloudflare.com/d1/platform/pricing/)
- [D1 限制](https://developers.cloudflare.com/d1/platform/limits/)
- [D1 REST query（支援帶參數的 batch）](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/)
- [R2 啟用要求](https://developers.cloudflare.com/r2/get-started/)

## Cloudflare 登入與正式啟用

2026-11-22 原登入曾過期；使用者後續完成僅限 `account:read`、`user:read`、`d1:write` 的 Wrangler OAuth 登入。已確認帳戶原本沒有 D1 資料庫，建立專用 `renjun-hengru-wedding-2026`（APAC），並在真正遠端 D1 成功套用此版本 migration（9 個 SQL 操作、3 張業務資料表、約 53 KB）。這不代表 Render 已取得永久 API token 或完成手機／電視的正式連線驗收；那仍須以實際 `/health`、送出與重啟讀回結果為準。

截至台北時間 2026-11-22 01:52:48，遠端讀回已確認 3 張資料表、4 個應用索引、2 個事件觸發器；`PRAGMA foreign_key_check` 無異常，三張業務表均為 0 筆。帳戶 ID 為 `31616eafa5f0b75688a72a31ce037cd7`；資料庫 ID 為 `e11044f8-2a73-47c0-9cd9-fa7d7927eeb3`。這些是資源識別碼，不是憑證。後續使用既有資料庫，不要重建或建立第二個同用途資料庫。

1. 使用者登入 [Cloudflare Dashboard](https://dash.cloudflare.com/)，確認使用 Workers Free；在 Storage & databases → D1 開啟上述既有婚禮資料庫，不要重複建立。不要使用遊戲的任何資料庫。
2. 取得該帳戶的 Account ID、該 D1 的 Database ID。在 API Tokens 建立自訂 token，權限為 Account → D1 → Edit（API 名稱 D1 Write），範圍只選婚禮所在帳戶。Token 只交給 Render 私密環境變數，不貼入 GitHub、網頁或聊天。
3. 在既有婚禮 Render API 服務設定 `.env.example` 所列變數：`STORAGE_MODE=d1`、`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_DATABASE_ID`、`CLOUDFLARE_API_TOKEN`、`PUBLIC_API_URL`、`ALLOWED_ORIGINS`、隨機且至少 24 字元的 `ADMIN_TOKEN`。管理 token 不可與 Cloudflare token 相同。
4. 在可信終端以相同私密環境執行 `npm ci`、`npm run migrate:d1`。遷移依序套用尚未存在的表／索引，並探測後新增相容的 `avatar_gender` 欄位；讀回五張業務表與欄位核驗，可重跑。或只在首次受控部署設定 `D1_AUTO_MIGRATE=true`，確認成功後關閉。
5. 婚禮 API 的 Render Root Directory 設為 `photo-groups-api`，Build Command 使用 `npm ci`，Start Command 使用 `node server.js`，Node 至少 20.9.0。這讓婚禮服務只建置及部署 API 子目錄，避免打包遊戲內容。只有維護舊的儲存庫根目錄設定時，才使用 `npm ci --prefix photo-groups-api` 與 `node photo-groups-api/server.js` 這組替代命令，兩種設定不可混用。
6. 部署後讀 `/health`，必須為 HTTP 200、`version:2`、`persistent:true`、`storage:"d1"`。再完成一筆有授權的測試祝福，重啟服務後讀回同一 id，才能宣稱正式 D1 持久化驗收通過。
7. `RUN_D1_INTEGRATION=1 npm test` 會啟用真正 D1 schema 讀回測試。未設定時明確 SKIP，不能將本機 SQLite 或 REST 格式測試稱作雲端 D1 驗收。

也可在互動終端執行 `npx wrangler@4 login` 登入後用 Wrangler 管理 D1；只有登入不會將 OAuth 憑證自動提供給 Render，正式服務仍須設定受限的 API token。官方步驟：[建立 token 與資料庫](https://developers.cloudflare.com/d1/tutorials/import-to-d1-with-rest-api/)。

## 本機持久化測試

在此目錄執行 `npm ci`、`npm test`。手動啟動時設定以下當前程序環境，不修改系統環境：

```powershell
$env:STORAGE_MODE='sqlite-local'
$env:SQLITE_PATH='C:\your-workspace\work\wedding-dev.sqlite'
$env:ALLOWED_ORIGINS='http://127.0.0.1:8080'
$env:PUBLIC_API_URL='http://127.0.0.1:10000'
# 另以安全方式設定本機 ADMIN_TOKEN（至少 24 字元）
npm start
```

SQLite 檔案在每次交易成功時原子寫入；此模式在 `RENDER` 或 `NODE_ENV=production` 環境會拒絕啟動，避免 Render 暫存磁碟被誤認為永久儲存。

## 手機與電視 API

`POST /api/wishes` 接受：

```json
{"author":"賓客署名","message":"新婚快樂 💕","style":1,"group":1,"avatar":"data:image/jpeg;base64,...","avatar_gender":"female","idempotencyKey":"UUID-or-stable-random-key","consent":true}
```

`author/message/style/group` 保留原 API 欄位，也接受 `guest_name/blessing_text/style_id/group_number`。新賓客送出必須明確提供 `avatar_gender:"male"` 或 `"female"`，即使有自拍也一樣；缺漏、空值或 `unspecified` 都回400，不寫入祝福、照片或事件。既有紀錄不改寫，管理員匯回舊備份仍可保留 `unspecified`。手機已移除風格選單，新送出固定 `style:1`；舊紀錄的style保留。照片可空白；有照片必須 `consent:true`。署名 1～20、祝福 1～30 個 Unicode grapheme。手機與 Node 都以 NFC + `Intl.Segmenter` 計數，家庭 Emoji、膚色與結合字不拆開。資料庫對可信服務計算的 `blessing_grapheme_count` 加上 1～30 的 CHECK，並限制文字最多 300 Unicode codepoint，防止超長結合字濫用；SQL 不假裝自行實作 ICU grapheme 分割。

伺服器驗證 JPEG、大小、解碼及像素範圍，再用 sharp 根據 EXIF 旋轉、等比例 cover 裁切 480×480、壓縮並移除 EXIF。原始照片不保存。每個唯一識別碼只建立一筆完整紀錄；相同內容重試回 200 + `duplicate:true`，同一識別碼換內容回 409。舊客戶端未提供 key 仍相容，但只有新版穩定 key 才具備跨重整重試去重保證。

`GET /api/wishes?after=<wishId>&limit=200` 回 `{wishes,latest,cursor,hasMore,persistent,storage}`，按 id 遞增，只含 approved。`hasMore` 時以最後一筆 id 繼續讀取。`latest` 是最大 wish id，`cursor` 是獨立的事件 seq，兩者不可混用。首次完整快照使用第一頁取得的 cursor 訂閱 SSE，後續按 wish id 去重，完整快照也用於移除已隱藏的紀錄。

`GET /api/stream?cursor=<eventSeq>` 或 `Last-Event-ID` 可恢復事件。`ready` data 為 `{latest,cursor,persistent:true}`；`wish` data 是單筆公開祝福；`reset` data 為 `{reason:"moderation",id,status,cursor}`，收到後重新讀取完整 approved 快照。每個 SSE 的 `id:` 都是耐久事件 seq。舊 `?after=<wishId>` 仍會轉成事件位置。每 3 秒從 D1 追讀新增事件，因此跨服務重啟不依賴記憶體佇列；傳送期間的重連重播由電視按 wish id 去重。

單筆回傳保留 `id/author/message/style/group/at`，另有 `guest_name/blessing_text/group_number/style_id/created_at/avatar_path/moderation_status`。公開 `GET /api/avatars/<wishId>` 只提供 approved 照片，隱藏後即禁止公開讀取。未啟用預審時，送出即 approved；`MODERATION_REQUIRED=true` 可改為 pending，需管理員核准才展示。

## 管理、刪除與匯出

以下全部需要 `Authorization: Bearer <ADMIN_TOKEN>`；token 不應放在網址查詢、localStorage、Git 或公開腳本。

| 路徑 | 功能 |
| --- | --- |
| `GET /api/admin/wishes?after=0&limit=200` | 所有審核狀態，分頁格式同公開清單 |
| `GET /api/admin/avatars/<wishId>` | 管理員檢查 pending/hidden 頭像 |
| `PATCH /api/admin/wishes/<wishId>` | JSON `{moderation_status:"approved"或"hidden"或"pending"或"deleted"}` |
| `GET /api/admin/export.csv` | 全部祝福文字、頭像路徑、時間與狀態，UTF-8 BOM，CSV 公式字元轉義 |
| `GET /api/admin/export.json` | 包含所有壓縮頭像及 submission_key 的完整應用層備份 |
| `POST /api/admin/import` | `{wishes:[...備份紀錄]}`，以 submission_key 去重，保留原時間與狀態 |

刪除為 soft delete，避免誤刪永久資料；管理員可重新 approved 復原。照片及文字不因審核而物理刪除。請在活動後依新人及賓客授權決定保留期限。

每次請求上限 240 KB。含頭像的 JSON 匯回請拆成「一筆祝福／一個請求」；純文字最多 200 筆／批。匯出沒有刪除或修改來源資料。

## 備份

D1 Free 的 Time Travel 自動保留最近 7 天，無須手動開通；這不能代替婚禮紀念冊的長期副本。婚禮前、活動結束後下載 CSV + 完整 JSON 到新人保管的位置。也可用 `npm run backup:d1 -- C:\private-backups\wedding.json` 備份三張資料表；此檔包含頭像與個資，勿加入 Git。該 CLI 原始表備份用於人工災難復原，網站 `/api/admin/import` 使用的格式是 `/api/admin/export.json`。

[D1 Time Travel 官方說明](https://developers.cloudflare.com/d1/reference/time-travel/)。還原 Time Travel 會覆寫資料庫，不屬於日常匯出操作，執行前須另行確認。


## 第二次畫面與控制調整（2026-11-22）

新控制頁為 `/control.html`，電視 `/tv.html` 移除可見播放／管理鈕，完整展示書本；原五張新人合照每次翻頁完成輪替，閱讀停留為6秒＋每個Unicode grapheme 0.3秒，最多15秒，紙葉翻動仍1.1秒。電視本機雙擊或F11全螢幕；跨裝置指令無法替另一個瀏覽器提供全螢幕使用者手勢。控制台沿用原ADMIN_TOKEN，沒有新增帳號或金鑰。

部署前必須先套用 `migrations/0002_playback_control.sql`。本次真正D1已成功套用並讀回；既有祝福與頭像筆數不變。`GET /api/playback` 初次回傳paused、latest、nextCursor且不重播歷史命令；之後使用 `?after=<nextCursor>&limit=100`，有hasMore時繼續讀。每個TV約2秒輪詢，使用nextCursor而不是自行猜序號；暫停狀態耐久保存、60秒以前的前後頁命令不補播。`POST /api/admin/playback` 必須Bearer原管理金鑰，JSON為action（pause/resume/next/prev/replay）及穩定requestId；相同key重試不重複新增指令。

`name-lookup.js` 支援輸入名字查詢既有姓名雜湊，不附帶明文邀請名單；相同名字多身分時請補姓氏。原PAYLOAD與五張PIC完全保留。非漢字或未列入官方公開資料的特殊多字姓若無既有映射，仍應輸入完整姓名。

暫停操作會讓當次紙葉先完整落頁，再停住自動播放；暫停時仍可用前後頁手動閱讀。部署時可使用已驗收API版本搭配後續純展示程式更新，實際服務提交另以各自部署紀錄為準。

## 第三次電視畫面調整（2026-11-22）

電視以常見16:9畫面為基準，書頁基底改1600×860，縮放按完整封面、緞帶及立起紙葉的範圍計算，減少螢幕四周空隙。新人照片為520×390的4:3區域、object-fit:cover，移除相框、膠帶、白色padding與旋轉；五張原圖未重畫、未修改，逐張用object-position保留人臉，不能將裁切誤稱為拉伸。

紙張背面改印完整新人左頁（包含照片、姓名與同一個正式QR），取代原本只有R&H裝飾字的紙面。向前翻時背面已是下一張合照，底下右頁已印好下一位祝福；落頁前先提交相同的新合照，再移除紙葉。向後翻時背面保留當前合照、底下準備上一張，讓兩個方向都接續完整畫面。反面移除重複DOM id、圖片解碼後才起翻，紙頁正反文字保持正常方向。原本依字數停留、獨立控制台與資料庫均沿用。

本次正式驗收初期，婚禮API曾GET逾時；獨立Chromium直接導航回503「Render - Application loading」，不是成功讀回祝福。已用原服務的Restart service重啟，等待期間另直接D1唯讀核對9筆祝福、3張頭像、外鍵無異常；原id1～6為使用者既有軟刪狀態、7～9公開，完全保留。台北09:41:06重新GET `/health` 與 `/api/wishes` 均200、storage:d1／persistent:true、公開id7/8/9讀回。曾啟動相同API程式的備援部署 `dep-dc14ebou01pc738o4fog`，但舊服務先恢復，因此09:41:55取消仍在建置的備援，API正式版本維持ee5ccbd；沒有未完成的API部署。此事件與失敗報告保留，不能用靜態站Live取代真正API驗收。

現場應提早開啟電視，確認祝福已載入後保持開啟；Free服務本次有較長啟動等待。沒有升級付費方案。官方限制參考：[Render Free啟動與閒置說明](https://render.com/docs/free#spinning-down-on-idle)。

第三次正式Playwright驗收於台北09:45完成11/11通過：靜態三檔逐位元對應542ab39；1280/1920/2560/3840四種16:9完整書本、正反翻起紙葉無越界，最小封面寬占93.98%（1080p約95.1%），雙向五階段截圖、無框cover、完整新人反面、五照片輪替及QR解碼正常。原公開id7/8/9前後一致，24次瀏覽器請求全GET、0寫入。實體電視與現場掃描仍須現場確認。

圖片核驗區分原始檔與CDN傳輸：Git/PIC五張原bytes完全一致；正式HTTP有cf-polished:ok與正確orig_size，會自動重壓縮。將原檔與HTTP回應同方向解碼為sRGB RGB後，PSNR40.57～45.08dB、MAE0.82～1.35，尺寸一致；不宣稱HTTP位元組或像素完全相同。第二輪嚴格HTTP hash比對失敗報告保留；改用原檔SHA加上明確CDN標頭／解碼品質核對，沒有修改產品圖片來湊測試。官方背景：[Cloudflare Polish](https://developers.cloudflare.com/images/polish/)。

## 第四次相框、預設輪廓與圓形取景（2026-11-22）

依使用者澄清保留原本的相框／膠帶／柔影。相框按照片自然比例：橫式上圖下文，直式照片與姓名／QR左右排，圖片元素本身維持自然比例，沒有框內補空帶，也不裁掉合照內容。完整新人頁仍先印到紙葉背面，保留大書本與雙向3D翻頁。

手機鼓勵留下今天漂亮／帥氣的照片，以及祝福或一句簡短經文（仍1～30 graphemes）。相機／相簿選圖後先修方向，進入圓形取景：拖曳位置、滑桿縮放、重設／取消／確認。僅確認後產生480×480 JPEG並清除舊公開同意；圈內取景對應手機預覽及TV圓形頭像。縮小後最長邊1600的來源只留記憶體；重新整理後如需選取已裁範圍之外的部分，須重新選原照片。

新增選填 `avatar_gender`（male/female/unspecified），表示預設輪廓選擇，不依名字推測、不在TV另外顯示性別。未上傳照片才用男／女無五官頭肩輪廓；未選維持中性花卉。有自拍時優先用確認後照片，移除後回到所選輪廓。新版 `/health` 回 `avatar_gender:true`，手機選男／女時先確認能力，避免舊API忽略選項。欄位包含於API/SSE/CSV/JSON備份與還原；未指定保留v2 canonical hash，舊UUID重試相容。

正式部署順序為：先schema probe再套 `0003_avatar_gender.sql`，讀回非破壞ADD COLUMN與既有資料 → API Live／health能力 → 靜態站。`store.migrate()`／`npm run migrate:d1` 已改為探測欄位，存在且相容便跳過0003；不要把所有SQL直接串接重跑。此次真正D1已套用並核對9祝福／3頭像／21事件／原播放資料保持、外鍵正常、舊列預設unspecified。沒有重建表、沒有復原原soft-deleted紀錄。

本機API整套13 PASS、1明示D1 REST token項目SKIP；真正D1遷移使用官方Wrangler另列證。UI整合15項通過，含五張自然比例框、30張雙向階段圖、WebKit圓形拖曳／縮放／取消／EXIF、三種預設、真local SQLite API+SSE→TV、同UUID失去回應再送只有一筆、CSV/JSON與重啟，以及兩項能力／編碼鎖定防護。這不是實體iPhone驗收，正式部署與Live檢查另列。

新版API `5755b731afee9fac450eeff6cc8512573e833a0d`／`dep-dc150f2jnfac73fnfl00` 於台北10:26:36 Live；10:27:39純GET確認health的avatar_gender:true／storage:d1／persistent:true，以及公開id7/8/9（舊紀錄均unspecified）。本輪沒有新增正式測試留言。

翻頁照片解碼加入8秒期限與一致fallback：新圖失敗時，紙葉背面及落頁都保留實際已載的同一張照片，晚圖不會突然覆蓋；完全沒有可用圖時先不翻，保留待播放順序。定向4/4通過（3秒延遲、HTTP失敗重試、10.5秒晚到、無圖恢復），未重跑無關測試；首次測試器誤等load而被hold圖片阻塞的失敗記錄保留。

第四輪正式靜態 `f49c05e626bf24ca5f72a6016a25d3b80f46697f`／`dep-dc158nrl550s73df6hqg` 於台北10:34:07 Live。10:35:33完成正式唯讀7/7：16靜態檔／SVG與Git相同、五原照、三種16:9雙向30階段與完整背頁、真公開署名對原PAYLOAD查組別、WebKit三預設與拖曳縮放／確認／移除均通過。19張正式截圖保留；公開7/8/9及共用播放狀態前後一致，61次GET、0 POST、0瀏覽器錯誤。正式這輪沒有新增測試留言；完整手機送出→API/SQLite/SSE→TV寫入、重送與重啟驗證使用前述獨立本機環境，不能冒稱本輪已做正式POST或實體iPhone驗收。

## 第五次填寫表單調整（2026-11-22）

移除無法改變書本版面的十款風格選單，手機預覽及一般新送出固定婚禮樣式1。性別改為男／女必填，初始為「請選擇性別」，不預選；即使有自拍，未選也不能送出。沒有自拍時沿用對應的空輪廓頭像。自拍裁切、公開展示同意與30字限制保留。

手機要求 `/health` 的 `avatar_gender_required:true` 才允許送出。API在確認原UUID收據之後、任何新紀錄寫入之前驗證必填；舊unspecified紀錄及原UUID相同內容重試、管理員舊備份匯回保持相容，無須遷移或改寫D1。未指定／unspecified的新賓客請求回400及 `error_code:"GENDER_REQUIRED"`。

未確認的舊草稿只因新規則改變風格或性別時，沿用原UUID先送新的有效內容；若409代表原UUID已有舊內容，再用原payload確認舊收據，不另建第二筆。已確認的舊收據也以相同內容的舊風格／性別簽章核對，並明示上次已收到；不把新選擇假稱已寫回舊紀錄。性別必填先於所有收據捷徑。

本機整合10／10通過；後端以 `node --test test/*.test.js` 完整17項為16 PASS、0 FAIL、1 SKIP（未提供直接D1 REST整合憑證）。另有同UUID查詢後競爭寫入的實際注入測試，回409且只保留贏家一筆。初次後端HTTP連線失敗原始TAP保留，3項定向診斷重跑通過但底層原因未再現；fixture明確使用Connection:close後完成上述整套驗證。不能把本機驗證稱為正式POST或實體iPhone驗收。

第五輪API第一次部署 `dep-dc1650qfngtc73ensmg0` 的checkout與Live雖對應fef22cd，正式Node及獨立無快取Chromium仍只回舊能力，故不列為功能上線。一次Dashboard重啟有真實事件與成功toast，但後續GET仍缺必填旗標；其後出現埠偵測逾時，根因未確認，沒有據此猜測或改寫D1。保留上述失敗證據後，清除建置快取重新部署同一提交 `fef22cdcb84ebfb09b16d553dca826542cbadff3`，`dep-dc16d2jl550s73dio2d0` 於台北12:00:41 Live，12:00:58真GET讀回 `avatar_gender_required:true`、`persistent:true`、`storage:d1`、latest10／cursor22才繼續發布手機頁。本輪沒有新增正式測試留言；期間觀測到的id10保留，不歸因於本輪GET驗證。

靜態 `dep-dc16i0ec6qcc73cnrlk0` 同提交於台北12:02:41 Live，12:03:56正式唯讀5／5通過：六個HTML／JS／CSS／SVG與提交一致，真公開署名查組、風格DOM移除、性別空值必填（含已裁自拍）、男女輪廓預覽正常。11次Node GET與9次瀏覽器GET，0 POST、0 JS錯誤；公開id7/8/9/10及共用播放狀態前後一致。遊戲main及其Render部署仍為cf296d0／dep-dc00b40u01pc73b83jt0。實際寫入與拒絕規則的完整測試使用上述獨立本機資料庫，未宣稱本輪做過正式POST或實體iPhone相機驗收。

## 第六次簡化祝福顯示（2026-11-22）

依使用者要求移除手機「電視上的祝福預覽」及署名／祝福欄位的示範句，保留輸入標籤與30字計數。自拍本身的確認預覽、圓形裁切、性別必填及公開展示同意維持。電視祝福紙面只顯示頭像、署名與祝福，不再生成組別標記；翻動中的紙面也沿用同一產生方式。左頁QR及拍照組別查詢仍提供原功能。資料送出、保存與管理保留group欄位，不改名單或歷史紀錄。

本輪只有靜態顯示調整，沿用已驗證的fef22cd API／D1，不需要重啟API、遷移資料庫或新增資源。本機定向5／5通過，含原15組／五照雜湊、空性別阻擋（含已裁自拍）、30／31字、真本機送出與SSE保留group、雙向翻頁前／中／落頁無組別及左頁真QR；沒有正式請求或瀏覽器錯誤。

靜態提交 `7193ef82308b941244a106254488fd1fad1b1b21`／`dep-dc186bhksfps7385ai8g` 於台北13:55:02 Live。13:56:01正式唯讀5／5通過：七靜態檔與提交一致、原15組與五照不變、真姓名查組、無祝福預覽／示範句、性別必填與自拍確認、電視雙向紙面不含組別標記且姓名／祝福／左QR保留。12次Node GET＋23次瀏覽器GET、0 POST；公開id7/8/9/10及共用播放狀態前後一致，API／遊戲部署均未變更。當輪完整寫入驗證限獨立本機資料庫，不宣稱正式POST或實體iPhone硬體驗收。

## 第七次送出等待與感謝畫面修正（2026-11-22）

使用者回報按送出像卡住。當前正式GET於台北14:18:38～14:19:27花49.334秒才回200；等待期間有新API instance在14:19:20啟動、14:19:23以D1模式開始監聽HTTP，第二次健康GET只需412ms。舊手機health限35秒，且先禁用表單、再health、再核對本機收據、才保存草稿並POST；提示在按鈕下方的畫面外。原版隔離重現確認health無回應／body停住約35秒，已成功收據仍額外等待health，POST回覆丟失約62.6秒才由WebKit結束，均有可見性及等待問題，未假稱無限await。Free閒置喚醒與現象相符，事件未直接記載idle，不把推論當成原始POST結果或刪改資料的依據。

手機改為先核對已確認收據、保存當次payload及原UUID，再等服務；背景health最多75秒、成功能力快取2分鐘。每次送出共用90秒總期限，包含回應body及舊收據核對；階段與等候秒數出現在按鈕及上方提示，可按「停止等待」。已開始POST後逾時／停止只標示結果尚未確認，保留原編號供重試，不宣稱取消了伺服器寫入。本機儲存失敗保留記憶體與可用的草稿編號；不保證瀏覽器禁止所有儲存時仍可跨重整恢復。

查詢成功文字改為「你的拍照組別」。永久儲存成功或核對已確認收據後，才顯示「祝福已送出」及謝謝祝福與陪伴的婚禮風格畫面，按「完成」關閉；待審／舊收據使用相應文案。未確認、逾時、取消或錯誤不顯示成功。原名單、照片、性別必填、裁切、30字及無預覽／無示範句保留。此輪不改API執行程式／D1，不升級付費資源。

未知結果僅更正性別／舊風格時仍沿原UUID，最多保留四個同內容的歷史payload候選，409後在原期限內核對；收據A只清相同編號草稿，不清未確認的B。背景health若遇502／503／504啟動HTML，在原75秒內每3秒重試GET，不重設期限、不自動POST、不外露JSON解析錯誤。

本機核心10／10通過（JS8612085a），最後僅修改health暫時錯誤分支後，最終JS8ab1d254的health定向4／4及獨立感謝畫面3／3通過；報告明列兩版差異，不假稱核心10在後版全重跑。含49秒後成功、90秒body／候選共用期限、取消約24ms解鎖、真本機SQLite同編號不增列、離線已確認收據0額外GET／POST、瀏覽器儲存失敗備援、A→B→A候選與A收據不清B草稿、503啟動／75秒截止，以及native／fallback成功畫面、審核及舊收據文案。原測試器署名過長、時計起點錯誤與中止的舊版104秒案例均保留，不算產品失敗或通過。完整寫入測試限隔離本機，沒有以正式祝福冊灌測試資料。

靜態提交 `fe3c55f308b8a96228cc48d2d6ca77f74b066f09`／`dep-dc18qo56e07s73cm4fdg` 於台北14:37:17 Live；14:38:37正式唯讀5／5通過，13次Node GET＋8次瀏覽器GET、0 POST／錯誤／封鎖。手機先自行連接API再做Node檢查；本輪是快速回應，不假稱重演冷啟。部署檔與指定提交一致，真姓名查組及新文案、必填與30字保留。成功感謝卡以fresh private context的runtime-only已確認收據fixture回放，不是Live新增祝福；真完整送出已在前述本機SQLite驗證。公開id7/8/9/10與共用播放狀態前後一致，API與遊戲main／部署都保持。首輪正式QA漏了變更性別後重勾同意，原失敗保留，修正測試步驟後通過，產品沒有放寬公開展示授權。

## 第八次電子祝福書匯出（2026-11-22）

三個既有網址保持：客人 `/`、電視 `/tv.html`、控制 `/control.html`。控制台登入原管理金鑰後，可另製作PDF電子祝福書及完全離線HTML翻頁書；原CSV與完整JSON備份保留。每次重新讀取管理員祝福分頁，只收錄當次快照的approved紀錄，依送出時間／id排序，最多四個並行授權GET補齊自拍；沒有自拍時套用既有性別預設頭像。圖片及八個素材（六個既有書頁素材與新製封面／封底）內嵌，任何應有照片下載失敗便明確失敗，不悄悄丟掉頭像。DTO只包含書名、日期、署名、祝福、圖片等必要資料，不包含管理金鑰、submission_key、client_hash、組別或非公開留言。

PDF使用本機vendored pdf-lib 1.17.1（MIT授權與SHA附vendor README），不呼叫外部PDF服務或CDN。每頁1200×1600高解析繪製後嵌入180×240mm PDF，封面、每人一頁及最後一頁感謝封底，中文與Emoji以瀏覽器原生字型繪入，逐頁釋放canvas並回報進度。這是影像頁PDF，文字不能選取搜尋；完整可編輯文字與照片另保存JSON。平板可用PDF閱讀器，HTML則適用可執行JavaScript的完整瀏覽器，不把iPad「檔案」預覽當作互動瀏覽器驗收。

HTML為單一自含檔案，內嵌資料／CSS／JS及所有圖片，CSP禁止網路連線與表單，資料白名單及JSON跳脫後以textContent建立頁面。新製兩張3:4奶油白／玫瑰粉／香檳金花卉封面底圖，文字與真新人照片另疊，封底保留感謝與收錄總數，背景保持原始比例。花卉書頁支援手動3D正反面翻頁、上一／下一、跳頁、鍵盤、觸控與全螢幕；直式改單頁，尊重減少動態偏好。製作中可取消；登出會中止並阻擋晚回應，Blob下載連結保留供Safari等瀏覽器再次按下載，下次製作或鎖定時清除。不改API、資料庫、手機、電視或遊戲執行程式，沒有新付費資源。
本機驗證分版本記錄：加入封面前完成PDF生成／30筆負載／取消3項、控制與離線閱讀8項、未改來源與雙向中途邊界3項、PDF晚回應取消／登出1項，共15個component；不把它們冒稱為最終封面版全套重跑。新增藝術封面後另以相同最終程式SHA完成4個定向component：真控制台下載HTML／PDF、兩PNG原bytes內嵌、4則公開祝福產生6頁PDF並strict解析／Poppler渲染、Chrome及Windows WebKit離線首末頁／自然相框／導覽與雙向25／50／75%翻頁邊界。Root已目視PDF與HTML首末，合照不變形、不遮臉，謝詞不截斷。初版Chromium大CSS變數無法承載約2.8MB圖片URI，已改真圖片節點與翻前解碼；保留初敗及跨瀏覽器診斷，沒有重壓或拉伸原PNG。

Windows Playwright WebKit對複雜family ZWJ Emoji的字形有不完整或相鄰文字重疊限制，原字串仍完整保留；Chromium HTML與影像PDF顯示完整，平板建議使用PDF。沒有實體iPad／iPhone或Apple Books的硬體驗收，也沒有拿正式祝福灌入測試資料。

另以同最終HTML SHA做受控解碼定向1項：封底圖片刻意延後500ms以上時保留最後賓客、尚不啟動動畫；解碼放行後依950ms設定翻至完整封底（觀測961ms）。封面版本因此另有5個必要component證據，與前15項分開記錄。
