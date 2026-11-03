# 爭霸戰選單、我方船長面板與強化棄牌 — 2026-11-03

狀態：本機候選；交接與正式發布證據另見協調目錄 handoffs。本文件不代表已發布或實體裝置驗收。

## 使用者要求與畫面

- 電腦、Android、iOS 的選單與對局日誌移至寶箱上方；同時縮小，保留原按鈕、點擊處理與資料節點。
- 移除舊左上選單保留的頭像列空間。其他玩家往上移，六人仍為上方五位對手、右下自己；原玩家 ID、順位與選人不改。
- 使用者追加要求「我方ui重設計不要沿用亂加」。第一輪沿用舊底板的畫面已作廢，報告明記 SUPERSEDED_DRAFT；最終我方採全新 imagegen 船長底板、獨立比例與座標，大頭像、名字、金幣、順位、狀態、豪華卡入口整合在同一面板，沒有追加式長條。
- 點我方面板或 Enter／空白鍵開啟「我的豪華卡」，只讀伺服器提供給該 viewer 的 state.myDeluxe；0 張、20 張、重複／非法 ID、切玩家／房間／斷線與清單更新均有處理。選目標期間仍走原按鈕路由；狀態圖示繼續開原解說。
- 強化卡進棄牌堆後，縮圖、棄牌列表與放大圖依現有 isEnhancedNow／CARD_ENH 選用強化卡圖；保留豪華圖與 Teach 隱藏卡背，沒有更改規則、引擎、存檔或事件格式。現行 venues 只在初始局／下一局建立，同局強化來源穩定。

## 真正來源與更新方式

正式 Card：D:/Codex_Release_Worktrees/card-native-server-adapter-20261029，分支 codex/card-native-server-adapter-20261029，基底 5d050d5bb99a419150f8dc66631b5e1cb1ca8452。接手時公開 Card 為 package-854bbf29a3a708f1，Android／iOS host metadata 皆 v063；這些是本輪修改前基線，不能當成新發布結果。

共用 presentation：C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html/android，既有 detached HEAD c80337268015ef47132abb70c8f7f15ccd4dd1e3，包含原本未追蹤模組與其他工作，未清除或提交。

正式程式僅 public/game.html、public/js/card-desktop-table.js、public/css/card-desktop-table.css；共用來源修改 card-menu-layout.js/.css、card-seat-hud.js/.css、card-phone-library.js、mobile-sources.mjs，新增 web/art/card-self-captain-v1.webp。自己的底板不再使用對手的 card-seat-hud-v2.webp。生成提示、原檔與透明度／格式轉換證據見 CARD_SELF_CAPTAIN_ART_20261103.json；原 PNG 保留，WebP 僅等尺寸格式轉換。

game.html 的 CARD_HUD_COLLECTION_START/END 與 CARD_DISCARD_FACE_COMPAT_BEGIN/END 是已裝原生包的線上相容層；保留原有 API／handlers，版本 guard 避免重複安裝。不能只更新桌機 bundle 就宣稱手機收到新功能。build_card_hud_collection.mjs 從共用來源抽取相容段與內嵌美術，確保與桌機／新原生包來源一致。

重建命令（不打包、不發布）：

```powershell
node scripts/build_card_hud_collection.mjs 'C:\Users\王曜瑋\.codex\worktrees\android-tabletop-landscape\2026-04-20-1-2-start-html-game-html'
node 'C:\Users\王曜瑋\.codex\worktrees\android-tabletop-landscape\2026-04-20-1-2-start-html-game-html\android\build-card-desktop.mjs' 'D:\Codex_Release_Worktrees\card-native-server-adapter-20261029'
```

## 驗證與界線

- scripts/card_hud_collection_qa.mjs：原 game.html／真實 engine 可見狀態，桌機 Chrome、與保留 APK 位元組一致的 v063 Android bundle、與保留 IPA 位元組一致的 v063 iOS bundle＋Windows WebKit；按鈕 hit test／handler singleton、幾何、收藏圖、隱私、鍵盤、狀態解說、自身目標路由與完整收藏捲動。最終獨立船長面板收據使用 final-captain 目錄，舊 final 不作本版通過證據。
- scripts/card_discard_face_qa.mjs：原 HEAD 重現退圖；新 shared mobile、desktop、retained v058 Chromium、exact v063 iOS WebKit 各 18 項通過，零 pageerror。涵蓋普通／強化／豪華、Teach owner／非 owner、列表／放大、兩 viewer 豪華資料隔離與零 ACTION。證據 D:/Codex_QA/card-hud-discard-20261103。
- scripts/card_flow_sync_qa.mjs：實際 npm start＋兩個 Chromium 視窗 8 項通過。舊 harness 直接用不存在的 room URL，會被既有 resumeOnly 規則正確拒絕；測試已改成先透過原 doJoin 建房，再保留 room URL 測重整。產品的 resumeOnly 規則未改。證據 D:/Codex_QA/card-hud-collection-20261103/sync.json。
- 正式來源沒有 node_modules，本機 npm start 的子程序 NODE_PATH 指向既有 mobile node_modules；資料庫 URL 為空、使用隔離測試身份，沒有正式帳號或玩家存檔操作。初次依賴／舊 room 建立方式失敗不列通過。
- 本輪沒有實體手機測試、APK／IPA 重包、公開發布或真實帳號驗收。原回合外手牌收合的畫面界線不列入完整手牌重排驗收；本次核對我方面板與手牌互不遮擋。

最終獨立設計第一輪在 Android 640×320 自己回合時，真實 tap 被手牌 grid 的透明空白區攔截；不是遊戲資料或豪華卡問題。保留失敗圖與 final-captain/report.json，不列為通過。修正僅讓 #myPlayZone 的空白 grid 不接受 pointer，原可見手牌 button 繼續接受 pointer；沒有提高我方面板層級覆蓋牌圖。修正後最終收據改用 final-captain-r2，並加驗手牌原檢視操作。

LATTICE API 在本次工具清單未提供。歷史 games.json 已讀，沒有新增假任務，也未宣稱任務／圖譜持久寫入。

最終候選驗證完成：獨立船長底板與命中區修正後，final-captain-r2 桌機2＋Android6尺寸共555項，final-captain-r2-ios iOS2尺寸139項，合計694項通過，零page errors；測試前後3個正式程式SHA256一致。原本失敗／作廢稿保留且不列通過。棄牌72項與npm start雙視窗8項另有收據。狀態 READY_FOR_INTEGRATION，未公開發布；交接收據另存協調目錄。
