# 婚禮祝福 API v2

此服務僅供 `photo-groups-2026` 婚禮分支使用，與遊戲 main、遊戲 PostgreSQL 完全分開。v2 沒有記憶體資料庫後備模式：Render 必須連上 D1，資料庫失敗回傳 503，不能顯示「已送出」。

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
5. API 的 Render Build Command 使用 `npm ci --prefix photo-groups-api`；Start Command 使用 `node photo-groups-api/server.js`（若 Root Directory 已為 `photo-groups-api`，分別用 `npm ci` 與 `npm start`）。Node 20 以上。
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
