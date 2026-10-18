# 2026-10-19 Windows 核心下載加速版的封裝邊界

正式來源是 `D:\Codex_Release_Worktrees\launcher-flick-reward-r12`，核心版本由 1.2.23 升至 1.2.24。核心下載器的修改不能經 renderer 內容覆蓋通道交付，須建置新的 Windows x64 NSIS 安裝檔。

既有 `public/desktop/launcher-content-v1.json` 保持 1.2.23 / revision 62，SHA-256 `265693bacb11f03690e72c9a142576c65ccc4cacb93c162a3bc99e6c15e49535`。它含 320 份檔案、57,715,464 bytes。新核心直接內建全部 320 份已簽署內容；既有 1.2.23 客戶端仍可使用原內容通道。不能直接把原內容清單改成 1.2.24，因為 runtime 會核對核心版本。

封裝調整限於 `desktop/package.json`：保留原 resource allowlist，新增一組 `../public` → `launcher-assets`，只列出原封裝缺少的 138 個 r62 媒體路徑，不使用遞迴 wildcard。另在 catalog filter 追加目前 Card、Board、Chess 的三份 package manifest，原八筆 filter 保留。

新增 `tools/launcher-download-speed/package-release-qa.js`。它先核對固定 r62 清單 SHA、Ed25519 簽章及全部來源 bytes / SHA，再檢查每份檔案恰好映射一次、三款現行 manifest 的 SHA。`--prepare-filters` 只依此固定證據補上缺少的 exact paths，沒有版本或發布動作。來源預備檢查通過仍不等於安裝檔或公開發布完成。

`desktop/main.js` 亦須保存既有內容的可讀取性：原 resolver 對 r62 的 298 個媒體路徑拒絕存取，其中 160 個是 63–222 號頭像；舊版由已驗證的 active overlay 回應，因此不曾走到該 resolver。新核心增加這 298 個 exact paths 的本機 allowlist，既有 regex 與路徑安全檢查保留。新版 QA 逐一執行真正 resolver，驗證全部 305 個 r62 媒體路徑可達，另拒絕 223 號頭像、未知 profile／guestbook／fish 路徑、越界路徑與其他協定。

```powershell
node tools/launcher-download-speed/package-release-qa.js --prepare-filters --report <新的準備報告完整路徑>
node tools/launcher-download-speed/package-release-qa.js --report <新的來源報告完整路徑>
node tools/launcher-download-speed/package-release-qa.js --win-unpacked <win-unpacked完整路徑> --report <新的封裝報告完整路徑>
```

封裝檢查透過既有 `@electron/asar` 讀取所有應用程式來源、320 份保留內容及 catalog resources，逐 byte / SHA 核對。建置主程序可把既有 desktop dependencies 設為目前子程序的 `NODE_PATH`，無須複製依賴。electron-builder 會移除 app.asar 中 package.json 的建置欄位，所以該檔改核對 name、version、main、dependencies，其他 application files 仍逐 byte 相同。

同步更新 `scripts/desktop_launcher_package_qa.js`：版本 1.2.24；1.2.23 的歷史釣魚公告仍要求原 1.2.23；原封裝 exact allowlist 與美術驗證保留，新 138 份 expected paths 由固定且簽署的 r62 清單獨立推導。所有 305 份簽署 r62 媒體使用獨立精確位元組預算，包含原 avatar wildcard 已選到的新頭像；和歷史獨立美術預算重疊的檔案只計一次，其餘原媒體預算保持 128 MiB。來源、實際 ASAR 與完整 launcher-assets 檔案集合仍分別驗證。

舊 QA 原本鎖定核心 1.2.23 的早期釣魚圖，現行 r62 已替換相同路徑的釣竿 atlas、金鯨及南瓜章魚，部分頭像也已更新。本次沒有改圖；改用既有、簽署且固定 SHA 的 r62 bytes 驗證這些現行檔案，其他原美術來源與歷史證據檢查保留。v5 釣竿斷言同步反映現行 CSS atlas 呈現，v4 仍使用原竿。

`desktop/launcher-content-overlay.js` 的網路清單讀取增加跨核心相容處理：先檢查 coreVersion 為有效 SemVer 字串，再完整驗證清單結構、檔案資料與可信 Ed25519 簽章；有效但不適用於目前核心的清單回傳無更新，不下載 blob、不回報下載進度。改核心版本、缺簽章、損壞簽章或清單資料皆仍拒絕。本機 slots 的讀取仍嚴格要求目前核心版本。如此可保留舊 1.2.23 發布指標，又不使 1.2.24 在背景誤報小型更新失敗。

`scripts/desktop_launcher_content_overlay_qa.js` 增加真正 stage／load 的跨核心測試：有效舊清單無下載／無進度、不啟用舊 slots；被竄改、缺簽章、非法 baseUrl、七種錯誤版本型態或格式仍拒絕，且不發出 blob 請求。同核心的原有簽章、原子切換、回滾、損壞修復及逾時測試保留。

Windows r2 建置候選遭發布前檢查阻擋，未上傳或發布：把既有 dependencies 以 junction 接至 candidate 時，electron-builder 的 dependency collector 遺漏 engine.io-client 等傳遞依賴。實際 Electron 44.1.1 的 Node require 重現 `MODULE_NOT_FOUND: engine.io-client`；320 份 renderer／素材完整並不等於啟動成功。r2 產物保留為失敗證據。

修復使用新的 `D:/Codex_QA/download-speed-release-20261019/windows-r3-source/desktop` 實體建置輸入。從已可用的 1.2.23 ASAR（SHA-256 `6832f60b233429f1c9642d68da6300a91cc6e94464c58b14451f02d28c934a78`）抽取完整 production dependency closure，172 檔／2,401,515 bytes 逐檔核對，再安裝到新輸入的實體目錄。既有 baseline 與保留的 vendor dependencies 未修改。原 candidate 的 owned junction 因自動審查拒絕移除而保留，後續建置不使用它。

新增 `tools/launcher-download-speed/dependency-release-qa.js`：將新 ASAR 的完整 production dependency 檔案集合、每檔 bytes／SHA、套件版本及 dependencies 對照上述固定 baseline，缺檔、變更、多檔都失敗。建置 r3 仍須通過此驗證及實際 Electron smoke，才能交付。

```powershell
node tools/launcher-download-speed/dependency-release-qa.js --candidate-asar <新win-unpacked/resources/app.asar完整路徑> --report <新的依賴比對報告完整路徑>
```

發布前實際 r3 封裝驗證已完成：172 份 production dependencies 和固定 baseline 完全相同，無缺漏／變更／額外檔；320 份保留內容、44 份 application files、305 個媒體 resolver 路徑通過；legacy source／win-unpacked／完整 NSIS 驗證通過。Launcher resources 為 1,110 檔／220,805,418 bytes，扣除各獨立預算後原媒體為 130,995,625 bytes，低於原 128 MiB。Metadata 為精確 11 份，保留部分 3,608,535 bytes，三份現行 manifest 為另列的 2,357,452 bytes。

初次 GUI SMOKE 遇到測試程式本身的等待問題：main 1696 行會等待所有 `document.images.decode()`，其中 179 張位於隱藏頭像選單、`loading=lazy`，瀏覽器尚不需要載入它們。CDP 已確認當時正式頁面 `readyState=complete`、`stage=app`、三個遊戲及 IPC API 可用，所有可見圖片都正常，不能把這個逾時當作啟動器無法啟動。

新增純測試工具 `tools/launcher-download-speed/packaged-smoke-qa.js`。它只接受新的 QA 根目錄，自己啟動封裝 EXE 並指定 SMOKE、獨立 userData／cache，再透過該測試程序的 CDP 把 lazy 圖片改成 eager；沒有改 renderer 邏輯、跳過原斷言或修改任何 app.asar／EXE。原 build 內的 SMOKE 隨後自行完成，exit 0、`launcher-ready`、`ok=true`；708 個 profile／媒體讀取及音訊播放通過，221 個 DOM 圖片全部載入且尺寸有效。EXE 和 ASAR 前後 SHA 不變。兩次未完成的原始逾時報告仍保留。

```powershell
node tools/launcher-download-speed/packaged-smoke-qa.js --exe <win-unpacked內的EXE完整路徑> --qa-root <新的獨立QA根目錄>
```

實際結果在 `D:/Codex_QA/download-speed-release-20261019/windows-r3-packaged-smoke-final/`：`original-smoke-report.json` 是未修改的 built smoke 原始輸出，`wrapper-report.json` 含介入前頁面、180 張 eager 設定、221 張圖片完成狀態及 binary 前後 SHA；`launcher.png` 已目視檢查，遊戲庫與三款封面、標題及操作區正常。這是隔離 preview 的封裝驗證，不宣稱真人帳號、多人實玩或玩家端下載速度驗收。

目前三款 fallback package manifest：

| 遊戲 | Manifest | SHA-256 |
| --- | --- | --- |
| Card | `card-package-a7d368a6e3feae01.json` | `5ec74d1890d06c58e1086ef6df646b247c3926a5a82a059d4abba4bcd0903bcd` |
| Board | `board-package-83b5cb65d174761d.json` | `554dab56bf1300aa9ee49110883235d8b2a156d2393594ef96321cbc05c695d6` |
| Chess | `chess-package-ee4627881596bdad.json` | `a456de14211bac9ab767ae2a7a56525cadb7a85516d3fb32f86ca1f6f4058ce5` |

三份現行 manifest 的獨立封裝預算固定為 234,104、1,676,463、446,885 bytes，共 2,357,452 bytes，並逐一核對上述 SHA；保留的舊 catalog／manifest 仍使用原 5 MiB 預算。實際封裝仍要求精確 11 份 metadata，無任意放寬或刪除舊清單。

來源受 Git CRLF checkout 影響時不能把不同 bytes 當成已驗證 r62。此次候選有 11 份 renderer 僅有換行差異，已從正式來源逐 byte / SHA 核對後保留正式 bytes；正式原稿未被改寫。

實際發布仍使用既有 `publish-saved-launcher.ps1` 上傳 EXE 與 blockmap，`sign-launcher-release.ps1` 產生 Ed25519 候選。DPAPI 憑證保持在正式 wrapper 內，不讀出或複製憑證內容。公開 manifest / 下載頁、完整 EXE SHA、Range 206、舊版真實 updater、三款 runtime identity 及遊戲 catalog 保留情況須另行回讀；本文件不宣稱已完成這些發布驗收。


## 公開驗證結果

2026-10-19 發布驗收已完成：Windows 1.2.24 EXE／blockmap 不可覆寫上傳、完整公開 GET／SHA、Ed25519 清單、真實舊版 updater 61 次 Range 206 及完整還原通過；Render de00ef0 已 Live。公開下載頁 10 例、三款 catalog／manifest／runtime identity 與舊 r62 保留情況均通過。詳細數據、簽章與限制以 DOWNLOAD_SPEED_RELEASE_20261019.json 為準，前面的待驗證文字保留作為發布前門檻紀錄。
