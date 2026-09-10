# 啟動器好友、玩家取名與更新提醒（1.1.7）

## 範圍與來源

正式來源 `D:\Codex_Release_Worktrees\board-state-wire-v1`，branch `codex/launcher-social-v1`，以已發布 `48cd79c9` 為基線。維持 Board CPU 停靠修正與省流量版；不改三款遊戲規則、動畫、state schema、帳號 id、既有 Socket.IO event 或素材。此文件先記錄本機驗證；正式 commit、下載連結與公開驗證在發布完成後補記。

## 玩家名稱

使用者確認 #43 出現在霸海戰棋好友／聊天。唯讀正式 `PROFILE_PUBLIC_GET(43)` 確認該新帳號 `name`、`avatar` 為空；AUTH_REGISTER 原本建立空白 profile，舊啟動器跳過取名，自己的畫面借用登入帳號，而好友顯示數字代稱。

- 1.1.7 新註冊與既有空白名稱帳號，都先開取名 dialog；未完成前不能啟動遊戲，Escape 不跳過，可選擇登出稍後設定。
- 只呼叫既有 PROFILE_UPDATE 的 `{name}` patch，沿用全服不分大小寫唯一、去頭尾／重複空白、最多 16 字規則。保留 avatar、stats、金幣、好友、存檔與其他 profile 欄位。伺服器成功後通知好友刷新。
- 登入 username 不再當作公開暱稱。未完成取名者暫顯示 `玩家 43（尚未取名）` 形式；PROFILE_GET 仍保留真實空白 name，讓舊遊戲的取名流程能辨識。公開／好友名稱不寫回資料庫。
- Chess 已開啟聊天的名稱／頭像／狀態跟隨好友刷新，訊息以 id 去重；只改 social component 與兩個入口 query。

## 啟動器社交與更新

左側好友／邀請／搜尋、右側單一聊天窗，使用既有深海金色／青綠 UI。支援送出／接受／婉拒邀請、確認移除好友、60 秒備援刷新、即時私訊、80 則歷史合併、未讀徽章與斷線狀態；登出清除本機記憶體中的聊天。輸入法組字時 Enter 不送出，Shift+Enter 換行；訊息最多 400 字，逾時不自動重送。

透過主程序 SocialService 與受限 preload IPC 沿用正式 Socket.IO；renderer 不取得 secret、不開放任意 event 或網路。SOCIAL_AUTH／PRESENCE_SET 使用相同 deviceId，不會把自己另一個遊戲視窗踢下線。好友狀態區分三款遊戲與啟動器；server 在一般 game/start 比對前保留 board/chess 模式，遊戲視窗切換／關閉也更新 presence。

啟動時、每 5 分鐘與視窗重新取得焦點（至少間隔 60 秒）檢查 catalog／簽署 launcher manifest。已安裝遊戲的新版本與 launcher 新版會彈出提醒；只在啟動器有焦點且無其他 dialog 時呈現。每個版本在本次啟動只提醒一次，可稍後處理，不自動安裝、不打斷遊戲。前往更新開啟下載管理或設定。

## 本機驗證

- `scripts/launcher_social_qa_server.js` 是隔離 DB fixture，使用真 server handlers，不建立正式測試帳號或對真人傳訊。
- `scripts/launcher_social_electron_qa.js` 以真 AuthService／SocialService／preload 與多個 Electron 視窗完成 30 checks：新註冊及既有未取名帳號、名稱衝突、保留金幣、兩端名稱同步、好友申請／接受、私訊／歷史／未讀去重、四類活動、改名後原聊天標題、非好友與非法 action 拒絕、登出清除、遊戲／啟動器更新提醒及暫緩。1440、1024、390 寬度無水平 overflow；截圖已檢查。隱藏測試視窗以 fixture 模擬 focus，並非真人桌面通知驗收。
- `scripts/chess_social_identity_qa.js` 使用正式 Chess social 與 shell 元件確認未取名代稱 → 取名後原視窗標題更新、航海錄活動及重複 DM id 去重。
- Chess 真 server protocol QA 通過房間、加入、準備、開始、同步走棋、重連、CPU、觀戰及非法步拒絕。原邀請 UI layer／query QA、launcher 簽章／下載／安裝更新 QA 與 source package QA 通過。
- `PORT=18895 npm start` 成功；無 DATABASE_URL，DB 功能用上述隔離 fixture 另測。QA 證據在 `D:\Codex_QA\launcher-social-20260910`（成功 `report.json`、`chess-identity-report.json`、截圖；早期 failure.json 為測試 harness 的依賴與可序列化返回值問題，不是最終結果）。

## 發布與回復

需發布新 launcher installer 1.1.7、簽署更新 manifest、Chess 新程式 package 和 server；Card／Board package 保持原值。新 installer／CAS 使用新的 immutable URL，不覆寫舊檔。安裝器來源是此正式樹的白名單檔案；獨立 D 槽 build input 僅作可核對的打包輸入，並非另一個遊戲開發來源。

回復以 scoped revert 程式、匹配 Chess catalog 與 launcher release manifest；已安裝者不會自動降版。已保存的玩家名稱與好友／聊天資料保留，不回復真人資料庫或刪除 immutable artifacts。

## 發行產物與補充驗證

- 程式 commit：`87cb3ace`。NSIS x64 installer `ONE-PIECE-Tabletop-Launcher-1.1.7-x64.exe`，152,891,899 bytes，SHA-256 `11b4a6448ef09a5fab231eafb1146b51d4160ba07e29641205a14f7e24b4570d`；在 `D:\OnePieceDesktopBuilds\release-1.1.7`。使用既有 Ed25519 key 簽署更新清單。
- Chess package `package-d37cd9a585600687`，manifest SHA `4cf972d317269a6b7804ed5554bb9c428018ba4d421fc046666d7953392b335e`；只新增兩份入口 HTML 與 social JS，合計 68,476 bytes。Card `package-ca025698d8851a35`、Board `package-40947c7bd7fe4b29` 沿用。
- R2 1,396 unique blobs：uploaded=3／skipped=1393，三份新檔公開 GET size／SHA 通過；HTML 仍用 binary／no-transform。完整遊戲 manifest／Git HEAD／引用／deterministic QA 通過。
- 白名單 source／win-unpacked／installer QA 通過：ASAR 241 entries，launcher 77 resources／39,771,289 bytes／catalog 11 files。歷史 Board／Chess program manifests 依 exact SHA 保留；調整原先只允許初次發行的 QA 清單。
- 真 packaged executable smoke `ok=true`、launcher-ready、0 broken images；隔離 userData／cache，未讀寫玩家既有安裝。安裝流程首次缺少 build-only NSIS header／sidebar，補齊正式原圖後成功，沒有改動 runtime 圖片。
- Board 真雙瀏覽器建房／加入／開始／交棒／刷新／待續戰鬥恢復通過：12 招募、guest 3 delta／0 recoveries、0 errors。證據 `board-lan-report.log`；只改社交和 presence，BOARD_GAME_STATE 維持原協定。

## 使用者更新方式

既有 1.1.6 可在「帳號 → 啟動器設定 → 檢查更新 → 下載更新 → 安裝並重新啟動」更新至 1.1.7。沿用既有簽章／SHA 驗證及 NSIS `--updated /S --force-run` 背景更新，不用另開瀏覽器下載或走手動安裝精靈；保留安裝位置、設定和遊戲素材。啟動器本體仍使用完整安裝更新包（約 153 MB），不是宣稱二進位增量 patch；三款遊戲繼續使用 SHA 增量下載。1.1.7 的自動檢查與彈窗是這次新增，舊版先從原設定頁檢查即可。
