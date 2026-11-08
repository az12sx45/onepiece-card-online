# Development record

## 2026-11-09 新世界航海錄 Android／iOS 功能與版面

- 以正式 Windows `package-7294865db78a1df4` 為功能對照，以既有 iOS v070 測試宿主 `d4ab5f3a` 為隔離來源。從正式 Android v070 APK 與 iOS v069 IPA 讀回的原始遊戲核心逐位元組相同。候選包含既有的司法島續戰補丁，保留已準備好的單檔司法島寶箱修正供獨立交付。
- 司法島選獎與背包先開啟控制，圖片用既有快取逐步填入。畫面依寬度與高度排列，短畫面可以捲到所有選項，窄直式背包將清單與內容分開排列。領獎和舊檔進場沿用下段的處理。
- 一般戰鬥使用電腦版的暈眩到倒下順序。活躍角色改變或復活會清理舊的暈眩狀態。角色外框接回原有裝備與敵人投影，沿用原素材與座標；選單支援窄直式與短橫式。
- 地圖工具與回合資訊先呈現文字並允許操作。背景音樂和操作音效使用原有設定值、獨立開關與音量。圖鑑沿用原有插畫目錄、本人實際遇見的解鎖及帳號收藏同步。離線可查看本機收藏，雲端更新時保留目前分類及選圖。素材指南只有已發現並可定位的普通素材來源提供地圖定位，特殊進化仍只顯示大概區域。
- 本次屬 Board 程式差異，沒有加入新媒體或改動帳號、存檔及多人協定的結構。驗證、檔案雜湊、剩餘差異及正式發布門檻見啟動器交接。資料在 `D:/Codex_QA/board-mobile-parity-20261109/`。目前實機與既有 App 內更新待驗；正式發布由啟動器負責。

## 2026-11-09 司法島寶箱與讀檔進場

- `candidate/project/original-core.js` 先關閉司法島選獎，再播放重要道具提示。領獎提示結束後才返回背包，且只在原玩家、原回合仍有效而未開其他畫面時返回。出貨版 Godot 的背包會攔截繪於其上的提示觸控，兩個全畫面控制不再同時開啟。
- 領獎圖片缺少或在 1.8 秒內未準備好時，以文字通知代替動畫並解除領獎等待。旗幟仍發放一次，獎勵規則、存檔與多人協定維持原有行為。
- 既有航海錄與明確跳過開場的入口不再阻塞等待 11 張約 3.47 MB 的開場圖。新航程仍使用原開場預載。iOS 進場由原生 Godot 執行，部分圖檔由現有 CDN 與本機快取供應。
- 以 v070 `d4ab5f3a` 為隔離基底。Board 程式白名單只有 `original-core.js`。已核對實際 v069 與原 v070 的原生觸控面板相同，並用 Godot Viewport 重現遮擋。核心、觸控及既有 CPU 回合回歸證據存於 `D:/Codex_QA/board-ios-judicial-chest-20261109/`。真機、發布與實際圖片耗時待驗。

## 2026-11-08 新世界航海錄 CPU 回合續行

- 共用核心 `candidate/project/original-core.js` 讓 CPU 酒館使用原有費用與招募判定直接完成。過期進島提示會更新控制、CPU 領獎不被重要道具視窗攔住、戰鬥離場防止重複結算、司法島已領獎的舊存檔接回換人或通關。回合切換的演出失敗也會交接。
- 原生酒館、商店、醫院、研究所、委託牆和任務日誌的 GDScript 在圖片缺少或逾時時保留可操作控制；關閉或換畫面會讓舊載入失效。以 iOS v068 `c8666eb4` 隔離，七個改動程式的前版 bytes 與正式 Android v069 APK 全部相同。發布者需重算原生輸入封印。
- 用 v066 IPA 的實際核心產生相容存檔，再由正式 v068 核心載入，進化指南與後續實際升等共 8 項通過；玩家真實存檔未取用。暫未確認該手機當時顯示的版本。無新增媒體、存檔欄位或多人事件。定向證據在 `D:/Codex_QA/board-native-cpu-turn-recovery-20261108/`。 實際 Core 39 項、Godot 酒館 9 項、其他服務 20 項通過，尚無實體手機測試。

## 2026-11-07 新世界航海錄進化素材取得指南

- `candidate/project/original-core.js` 提供和電腦版相同的所需素材與來源。`native-crew-markup.js` 將指南資料送給 `native_crew_modal.gd`，以可捲動的列呈現。點素材可展開地點、關卡、條件與領取方式；特殊進化僅顯示區域。指南不觸發遊戲操作，沒有修改規則、獎勵、存檔或多人協定，未新增媒體。
- 以已發布 iOS v067 的來源 `edb92e84` 建立隔離樹。三個原始程式檔均與已發布 Android v068 APK 內容一致。iOS v067 PCK 中兩個 JS 逐位元相同，GDScript 走既有匯出轉換。
- Node 的原始船員詳情至原生投影 6/6，Godot 4.7.2 原生控制測試 11/11，涵蓋 740×360 與 500×280 指標點擊、展開、換行、捲動和保留特殊進化探索提示。證據在 `D:/Codex_QA/board-material-source-mobile-20261107/`。實體手機、正式帳號及新版封裝待整合驗證。

## 2026-11-07 新世界航海錄：Android／iOS 船員升等提示

- 以正式 iOS v066 的 `1786e1595` 為隔離來源。四個要替換的既有 Godot 程式檔均與正式 Android v067 APK 內容逐位元相同；各平台啟動器、宿主與素材載入維持各自既有版本。
- `candidate/project/original-core.js` 從既有發放經驗和接受的即時狀態取出實際升等結果。`native-game-runtime.js` 把短暫通知送給 `native_app_stage.gd` 的 `native_crew_level_up_hud.gd`，並從 `original-board-audio.js` 播放與電腦版同一段四音。用既有船員肖像，先顯示金色箭頭，圖片載妥才更新；每張 2.4 秒、同批依序顯示，出戰船員優先。不佔用戰鬥演出佇列，也不攔觸控。
- 僅通知本機玩家真正跨級的船員；不因新招募、重複狀態、初次恢復、重連或讀檔播放。未新增可呼叫的測試發獎入口，沒有修改經驗值、獎勵、存檔或多人協定。沒有新增媒體檔。
- Node 與實際 GodotJS 4.7.2 的隔離 host 各 23/23，涵蓋原始 `finishBattle()`、主線領獎、多人接受快照及讀檔競態。Godot HUD 在 headless／Windows OpenGL 各 22/22，含多張依序、過期肖像、觸控穿透與低高度；場景檢查／啟動成功。音效比對 7/7（同 PCM、尊重原音量及靜音）。證據在 `D:/Codex_QA/board-mobile-level-up-20261107/`。未用手機或正式帳號遊玩；正式打包、版號和更新通道由啟動器聊天室整合。此工作階段沒有 LATTICE API，未寫入持久任務或圖譜。

2026-10-23: Owner authorized public independent iOS branch. Added sealed v038 platform candidate and SHA-pinned, public-standard-runner Mac CI. Windows preparation: 22 checks and 12 media checks passed; Apple SDK compilation and device testing pending. No production updater or gameplay rules changed.

First Mac run 39917269336: setup passed, native compile stopped because godot-cpp requires api_version. Added exact 4.7 API selection and a RefCounted-only binding profile; errors now print bounded diagnostics. Rebuild pending.

Second run 39917775324: API generation passed; minimized profile omitted OS used by upstream print_string.cpp. Include OS in bridge bindings; rebuild pending.

Third run 39918233260: dependency compilation passed; Clang rejected Objective-C __block variables captured by C++ lambdas. Replaced with synchronous by-reference C++ captures in display, player start and player state; rebuild pending.

Fourth run 39918534370: bridge source compiled, link failed on CoreMedia/CoreGraphics symbols. Link both frameworks explicitly, align deployment target with iOS 16, and name the output dylib explicitly for XCFramework packaging. Rebuild pending.

Fifth run 39918995265: native bridge, XCFramework, import and Godot iOS export passed. Xcode 16.4 could not link newer Metal/CoreAnimation symbols in the official Godot template. Use standard macos-26 (Xcode 26), check SDK >=26 before work, and verify native symbols inside Godot-converted frameworks as well as dylibs. Import/export have expected iOS-only bridge warnings on Mac plus upstream generated resource-module warnings, but no script parse errors. Device runtime remains untested.

Run 39919875803 / build commit 35816e8 succeeded on standard macos-26. Download digest matched. Local IPA reader verified 1946 PCK records, 174 original JS files, 1304 physical API files and both frameworks. Checker normalized relative PCK paths after its first diagnostic mismatch; the IPA was unchanged. Signed=false, iPhoneTested=false. Verification report and standalone reader added outside the sealed candidate; no rebuild needed.

2026-10-23 v039: iPhone v038 reported corrupt text/art and missing launcher entry. Final PCK was missing all 14 runtime raw font/UI/animation files due to import conversion. Add Keep File metadata and byte-readback gate (old IPA now rejected, real Godot export passes 14/14). Reuse 1532 existing APK launcher renderer/art files via local WKWebView with main-frame IPC, Keychain session and explicit Board launch/return; no auto-enter or logout on return. Card/Chess remain unavailable in this Board candidate. Windows51, router9, media12 and original login fixtures pass; npm start four pages HTTP200. New Mac compilation and phone acceptance pending. No Apple credentials or phone screenshots committed.

2026-10-23 v040: v039 physical phone showed white launcher. Canonicalize both bundle root and target file with shared POAssetSchemeHandler; add native failure/timeout retry. New Mac Foundation /private regression plus actual WebKit renderer/login/logo gate runs before the device build. Gameplay/art preserved; iPhone acceptance pending.


## 2026-10-25 v041 shared multiplayer recovery

Pinned verified native v039 generation b35765cf821971ae7ae1450616c6d62c07d0b6b1fdafd3a503d811a14a8e861f. Restore participant prompts after remote playback and refresh CPU command authority on lock/snapshot changes. Godot fixture touch checks and desktop + two native clients + CPU network regression passed; desktop also requires its separately tested LAN-apply button refresh. iOS v040 launcher/native adapters retained. macOS compilation and physical iPhone acceptance remain pending for v041. No paid services or Apple signing material.

## 2026-11-01 iOS v062 launcher cover asset-only update
Repacked the verified v061 unsigned IPA with exactly two payload changes: Info.plist CFBundleVersion=62 and launcher_marineford_cover_v2.webp. Every other member including native executable/frameworks is byte-identical (2857 members checked). No new cloud/native compile; no Apple credentials or signing. Updated candidate export version and hashed launcher/input manifests for future builds. Published native iOS pointer62 and full remote IPA hash verified. Owner signing via iloader still required; no new physical iPhone verification. Evidence: D:/Codex_QA/marineford-cinema-20261101/ios-verification.json and ios-published.json. Existing untracked candidate copies/caches preserved.

## 2026-11-01 v063 dimensional Marineford launcher box
Updated only three launcher presentation files and added two own-game box/interior images; native binaries unchanged. Same 1086x1448 asset drives masked lid/shell with original opening animation. Candidate manifests/version63 updated. IPA repack verified2859 entries; iOS still requires owner signing. WebKit packaged-source layout 740x320/844x390 and launch animation checked using isolated bridge; Windows WebKit has PNG color-quantization artifacts even without UI, not claimed as physical iPhone visual acceptance. Evidence D:/Codex_QA/marineford-box-20261101.
