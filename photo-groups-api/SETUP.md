# 婚禮祝福 API v2

此服務僅供 `photo-groups-2026` 婚禮分支使用，與遊戲 main、遊戲 PostgreSQL 完全分開。v2 沒有記憶體資料庫後備模式：Render 必須連上 D1，資料庫失敗回傳 503，不能顯示「已送出」。

2026-11-22 部署時實際發現 sharp 0.34.5 的上游解碼器安全公告，已依 [sharp 官方公告](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w) 更新並鎖定 0.35.5（Node 至少 20.9.0），重新產生 lock；針對此 API 的 `npm audit` 已回報 0 個弱點。sql.js 1.13.0 不在這次弱點清單，保留原版本。解碼與持久化測試須使用更新後的套件重跑，Render 亦須部署含此 lock 的版本。

## 目前正式狀態（2026-11-22 台北時間）

婚禮靜態站版本 `7442db78a160d5c556cb5647fa3949633ee8079b` 與 API 版本 `ee5ccbd00525172034c706c6da79422304cf5ee8` 已在原網址 Live；兩版的 API 程式與 migration 完全一致。API `/health` 實際回傳 `version:2`、`persistent:true`、`storage:"d1"`、`playback:true`。已設定受限 D1 長期權杖與獨立 ADMIN_TOKEN，兩個婚禮服務均維持免費，沒有開通 R2 或新增付費方案。

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
4. 在可信終端以相同私密環境執行 `npm ci`、`npm run migrate:d1`。遷移只會建立尚不存在的表與索引，會讀回三張表核驗。或只在首次受控部署設定 `D1_AUTO_MIGRATE=true`，確認成功後關閉。
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
{"author":"賓客署名","message":"新婚快樂 💕","style":1,"group":1,"avatar":"data:image/jpeg;base64,...","idempotencyKey":"UUID-or-stable-random-key","consent":true}
```

`author/message/style/group` 保留原 API 相容，也接受 `guest_name/blessing_text/style_id/group_number`。照片可空白；有照片必須 `consent:true`。署名 1～20、祝福 1～30 個 Unicode grapheme。手機與 Node 都以 NFC + `Intl.Segmenter` 計數，家庭 Emoji、膚色與結合字不拆開。資料庫對可信服務計算的 `blessing_grapheme_count` 加上 1～30 的 CHECK，並限制文字最多 300 Unicode codepoint，防止超長結合字濫用；SQL 不假裝自行實作 ICU grapheme 分割。

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
