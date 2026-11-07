# Development record

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
