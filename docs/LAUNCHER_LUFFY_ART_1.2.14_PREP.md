# Launcher 1.2.14 魯夫專屬圖集與發行紀錄

## 2026-09-30 完成狀態

17 張 GPT 原畫所製 WebP 已獨立加入新版目錄並由 `tools/launcher-room/luffy-v1214/manifest.json` 綁定 SHA；`LUFFY_ART_ENABLED=true`，四向動作、生活、肖像與商店接線完成。附圖公告為 `public/images/launcher_announcements/launcher-proportions-1.2.14.webp`，announcement revision 13。圖集結構驗證 17/17、81 幀；128px 接觸圖及公告圖經 Codex 目視審核，未取得真人試玩驗收。來源與封裝版 Electron 各通過 697 項素材請求、GET／Range、版本和 BGM 測試。安裝檔 265,807,827 bytes，SHA-256 `11e700d97042cef4a1328f4cf0dbbb9cc350be8d23f4f71a342e8cf9e38d62b5`；完整公開下載比對通過。左右走路跨步仍與舊版相同，沒有列為本次改善。

隔離製圖與目視證據在 `D:\Codex_QA\launcher-proportion-1.2.14`，封裝、來源／封裝版測試與公開安裝檔驗證在 `D:\Codex_QA\launcher-proportion-1.2.14-release`。本節記錄截至公開安裝檔驗證；公開更新清單和下載頁生效狀態須另外核對。

## 早期接線規劃（保留當時狀態）

2026-09-29 狀態：程式候選，未產生、驗收或封裝新圖；公開版本仍為 1.2.13。本文件中的 1.2.14 是目標版本，不是發行宣告。

## 目前接線

單一發行開關 `desktop/launcher-room-motion.js` 的 `LUFFY_ART_ENABLED` 預設為 `false`，由同一模組供走路、互動、生活、房間肖像、商店及小遊戲讀取。關閉時全部直接讀取既有 `motion_v4`／`acting_v4`／`life_hd_v2`／`portrait_v3`，不發出任何新版本缺圖請求。未來通過發行閘門後才改為 `true`，且只對 `luffy` 優先讀取下列 17 個新路徑；其他角色保留既有路徑。啟用後若單張新圖載入、解碼或幾何檢查失敗，按同一方向／動作回退舊圖。不改角色 ID、存檔、帳號、商店、Socket.IO 或三款遊戲規則。

| 種類 | 新路徑 | 數量 | 既有回退 |
| --- | --- | ---: | --- |
| 步態 | `public/images/launcher_room/motion_v5/luffy/{east,west,north,south}.webp` | 4 | `motion_v4/luffy/` 同方向 |
| 互動 | `public/images/launcher_room/acting_v5/luffy/{east,west,north,south}.webp` | 4 | `acting_v4/luffy/` 同方向 |
| 生活 | `public/images/launcher_room/life_hd_v3/luffy/work-{east,west,north,south}.webp` 與 `{eat,rest,sleep,train}-south.webp` | 8 | `life_hd_v2/luffy/` 同動作方向 |
| 縮圖 | `public/images/launcher_room/portrait_v4/luffy.webp` | 1 | `portrait_v3/luffy.webp` |

`desktop/main.js` 僅允許上述新路徑；`scripts/desktop_launcher_package_qa.js` 檢查這 17 個路徑可解析，並拒絕新版本其他角色或未知動作。開關關閉時，QA 要求版本仍為 1.2.13 且封裝清單沒有新圖；開關開啟時，QA 要求版本與 lock 同為 1.2.14、`tools/launcher-room/luffy-v1214/manifest.json` 對 17 張圖記錄 `launcher-luffy-art/1`、`visualAccepted: true`、逐張 path/bytes/sha256，並要求實體檔案雜湊與 `extraResources` 清單一致。單獨放行協定路徑只證明路徑安全，不證明檔案存在或圖像合格。`desktop/package.json` 的 `extraResources` 仍只列已發行圖，版本仍是 1.2.13；`public/desktop/launcher-release-v1.json`、`config/launcher-announcements-v1.json` 與簽章均未修改。

## 封裝與發行閘門

1. 取得 17 個實際製作且逐張審核通過的 WebP，以及可追溯的原圖、尺寸、透明邊緣、四向身份與逐幀動作證據；填入上述 17 筆 manifest，逐張目視審核並記錄審核者與證據。此處是素材 QA，須分別標示 AI／自動 QA、真人試玩與使用者批准；不能把前者當成後兩者。不得把舊圖複製或放大後冒充新素材；目前 EAST/WEST gait 與彩邊仍須完成審核。
2. 核對 `motion_v5` 每張 1536×384（4 格，各 384）、`acting_v5` 每張 2048×256（8 格，各 256）、`life_hd_v3` 每張 1024×256（4 格，各 256）、`portrait_v4` 256×256；核對 alpha 與 UI 取景。維持既有 root 與動作順序。
3. 將全部 17 張的相對路徑加入 `desktop/package.json` 的 `extraResources` filter，同步更新 `desktop/main.js` 封裝協定 smoke 清單與封裝 QA 的精確資源清單及 SHA 驗證。把 package/lock 升到 1.2.14，再將唯一的 `LUFFY_ART_ENABLED` 改成 `true`；此三項必須一起通過封裝 QA。測試 source 和封裝後 `opui://` GET、解碼、fallback、桌機／窄版房間、商店、夥伴面板及小遊戲。
4. 素材、封裝與瀏覽器 QA 均通過後，才建立版本化安裝檔與完整 SHA／簽章證據。公告須綁定實際已發布的 release ID 且保留歷史公告。正式上傳、公開 manifest 切換及下載驗證各自記錄，不以本機程式測試代替。

目前可執行 `node scripts/launcher_luffy_art_switch_qa.js` 驗證正式來源關閉時只請求舊圖，並在隔離 VM 中模擬開啟後的候選成功與失敗回退；測試使用合成 Image，不能作為 17 張美術或安裝檔驗收。

## 2026-09-30 公開部署讀回

發行提交 `25f822e3ca87de53425e0e1ae57fc932bb7de91f` 已推至 `main`。1.2.14 安裝檔以不可變版本路徑上傳 R2；公開網址完整下載得到 265,807,827 bytes，SHA-256 `11e700d97042cef4a1328f4cf0dbbb9cc350be8d23f4f71a342e8cf9e38d62b5`，與封裝收據完全一致。公開更新清單於 2026-09-30 01:10 UTC 切換到 1.2.14；676 bytes、SHA-256 `48d762cb02fd4f26aebc67dfb237f6b91c7eab09a994da8fdecc415a708b1ea2`，與 Git 提交及 Ed25519 簽署候選逐 byte 相同，啟動器驗簽通過。公開下載頁 HTTP 200、版本文字、安裝檔連結及頁面來源核對通過。

正式 `D:\Codex_Release_Worktrees\board-voyage-records-v1` 僅同步 33 個指定檔案並加入三段文件；原有其他修改保留，正式樹的啟動器 package QA 再次通過。更新公告在隔離 PGlite 測試中於 1.2.13 隱藏、1.2.14 顯示，附圖 SHA、公告發布紀錄及已讀保存通過。完整來源、封裝、R2 與公開讀回證據在 `D:\Codex_QA\launcher-proportion-1.2.14-release`。上述是自動化與 Codex 目視驗證；未作真人遊玩、真帳號公告閱讀或實體手機驗收。側向走路跨步仍需改善。
