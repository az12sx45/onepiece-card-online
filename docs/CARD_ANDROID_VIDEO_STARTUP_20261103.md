# 爭霸戰影片播放啟動、首畫面與場地介紹 — 2026-11-03

狀態：READY_FOR_INTEGRATION。三項需求完成，最終來源已凍結並有下方測試收據；正式發布交給啟動器聊天室。未把瀏覽器測試當實體手機驗收。

使用者在package-1c838d6bf03ea7a3發布後回報Android「白光後停在準備影片，然後略過」。正式來源D:/Codex_Release_Worktrees/card-native-server-adapter-20261029，branch codex/card-native-server-adapter-20261029，接手HEAD674751fa8c6734a95b8de897605ac0a4f20dee10。原有AGENTS與DEV／FILE／GAME_RULES／PROJECT_OVERVIEW草稿、舊Card預覽、eda manifest與MF field-v1保留不納入。LATTICE API未提供，沒有新任務／圖譜寫入宣稱。

## 已核對事實

- 公開20支影片302→CAS200 video/mp4，大小符合manifest；1／10／13起始及尾段共6個Range206與片段SHA符合原檔，沒有觀察到缺檔／MIME／Range服務故障。D:/Codex_QA/card-android-video-network-20261103/transport.json。
- 20支原MP4皆H.264 Main／Level4.0、AAC、1920×1080，metadata moov均在尾端。原媒體未重編、未重新上傳。尾端metadata或行動網路預載限制是排查線索，不宣稱已證實為本次根因。
- 從正式PO-v063.apk dex確認真正MainActivity.webView()呼叫setMediaPlaybackRequiresUserGesture(false)，PoNativeLauncherActivity沿用它；不能只憑舊gradle版本26判定實機設定。證據D:/Codex_QA/card-android-playback-20261103/v063-media-settings-dex.json。
- exact retained Android v063、原EMIT/STATE、真MP4與原ACK／選人／猜號流程，一般網路與CDP cellular＋每次4200ms延遲各13PASS；桌機Chrome未重現自然失敗，不能當Android WebView真機驗收。

## 已重現缺口與修正

playEnhFxFor原程式只在有聲play() Promise rejection後重試靜音。如果Promise一直pending而沒有playing／播放進度，就完全不進catch；8秒watchdog最後清除影片並略過。

新scripts/card_enhancement_startup_qa.mjs只注入第一次有聲play()永久pending，其餘媒體方法原生，原MP4在readyState4／1920×1080／3.206秒buffer時已準備完成。startup-baseline精確重現白光→有聲attempt→沒有重試／playing→8091ms清除影片，零頁面例外，恢復播放斷言如預期失敗。這是與使用者症狀一致的程式缺口，並非已取得實機play Promise內部trace。

影片修正位於public/game.html：1200ms沒有playing／進度時，以同一video做一次靜音重試，先pause中止卡住的舊請求，不重設src／load／decoded frame／buffer。每次播放attempt序號與原current cleanup身分雙重保護，舊Promise遲到resolve／reject不能重播、清除或影響下一張卡。原立即reject的靜音fallback也使用同一helper；原8秒啟動／10秒停滯上限與取消、背景、ACK、後續招式流程保留。正常播放不多呼叫play。影片修正不改Summon／結果斜圖、engine、server/index、APK／IPA、帳號或安全設定；後續入場需求另更新generated JS，CSS目前原樣。

## 驗證收據（最終結果後補）

D:/Codex_QA/card-android-playback-20261103/startup-baseline/report.json與baseline-evidence.json保留失敗；fix-late-reject及fix-late-resolve各13PASS，涵蓋同影片靜音恢復、完整ended、舊Promise遲到、原ACK與選人。取消／下一張／雙pending／正常播放與既有readiness回歸待最終收據。

已連接V2105，安裝v063／WebView156.0.8078.47，原App／登入與遊戲資料保留；透過原啟動器建立3CPU測試房78J7U8觀察已發布舊版，沒有安裝／清資料／改安全設定。實機觀察不冒充本輪修正版播放成功，後續以確實捕獲的影片／畫面與版本證據為準。


## 同輪追加：舊畫面閃出與 iOS 介紹被跳過

使用者追加「剛進去會先看到舊遊戲畫面，希望不要看到」，及「iOS進入等待很久，進去直接開始，來不及看場地介紹」。這些與Android影片報告延續同一輪交付，不另競相發布。

- 新scripts/card_match_entry_client.js同步到CARD_MATCH_ENTRY marker，head在正式?room入場先建立data-card-boot=loading，首畫面用單一不透明準備畫面覆蓋，保留原尺寸計算。等現代module身分、第一份實際套用玩家狀態／完整席位／新版自方船長、關鍵CSS／背景與初始頭像解碼，再兩個rAF才揭開並送card:interface-ready。本輪不新增圖片或影片；失效房保留原alertdialog，載入失敗有原頁重試／返回大廳，從不逾時放出舊桌面；無room舊加入流程保留。
- 已重現舊場地client在server gate因CPU接手而release時，會在boot loading、完全無使用者輸入下呼叫舊按鈕onclick並寫入seen。iOS v058更在SHOW就寫seen；新shared card-venue-ready.js（正式scripts/card_venue_ready_client.js鏡像）只把實際本地明確按「我看完了」視為閱讀完成，解碼後且真正可見900ms才可按。不以server release／CPU排除代表自己看過，不在boot／背景自動ACK。保留原VENUE_READY伺服器閘門與所有其他已確認歷史，只移除本頁當前未讀的legacy seen寫入。
- 第一份STATE早於JOINED／DOMContentLoaded，或場地尚未能顯示時，不先阻塞state套用；新介面完成後再開本地閱讀，不與boot互等。讀取確認遺失時，重連後可明確再次確認，不自動重送；server已確認的仍維持等待其他玩家。舊900ms timer提早一個frame打開按鈕時即刻重新禁用到真正可讀時點。
- 新venue source註冊在最後result-cutins前，shared card-phone-piles.js加上boot／visibility保護；mobile-sources.mjs與build-card-desktop.mjs同步來源。build_card_media_flow.mjs同步venue、entry與既有marker並用20261103-entry-startup1 query；既有影片／棄牌／結果動作維持原版。

最終QA在D:/Codex_QA/card-match-entry-20261103、card-venue-entry-20261103、card-android-playback-20261103，待最終來源凍結後彙整。早期QA過度假設「隱藏loader必須不存在」與「原生同步head300ms內必達gate」，以及漏按私人閱讀／等待舊round DOM的fixture失敗均保留，不列最終通過；來源在不同子項修正期間變動的integrity失敗亦不列整輪PASS。

實機舊版觀察已透過原生「結束遊戲」結束暫時測試畫面，原App與登入保留。觀察收據D:/Codex_QA/card-android-video-device-20261103/observation.json：未捕獲可判定的強化影片失敗或修正版成功，不能拿一般CPU畫面或瀏覽器故障注入冒充真機驗收。

來源凍結階段收據（尚待重複CSS比對）：目前HTML2019821 bytes／SHA16529cb342b0d61ab49af2a2590c661b65b8ac1851aea2c2220a9f8d24103ba1，JS338178 bytes／SHAd6a94e654c97e83964e89695f50e33519f6c4716221c6cd4e52ad5a7b2b6b397。venue final-all-platforms 211 PASS；entry final-cold-all-r4 51 PASS屬稍早observer clamp前來源，入場bootstrap本身未改；video combined-source-r2 37 PASS屬目前來源。舊combined-source-final雖74項行為通過但最後source-integrity因同時修venue clamp失敗，已保留不列整輪成功，後續以fresh r2為準。


## 最終手機樣式傳輸

不能只刪掉desktop CSS：其中包含iOS v058缺少的角色斜圖CSS、兩代iOS缺少的投影原圖變數及下一局旗幟。新scripts/build_card_native_styles.mjs從原共享CSS取必要規則，所有selector加[data-card-bundled-styles="1"]，保留原keyframes／宣告，產生public/css/card-native-online.css（18,778 bytes）。檔尾唯一生成器sentinel --card-native-style-ready:1，避免Chrome在CSS HTTP503仍給sheet空物件而誤揭開；boot同時要求selected sheet與sentinel成功。

只在既有已注入手機bundle flag===true且官方Android/iOS UA marker時，parser時就選小nativeCSS，根本不建立53MBdesktopCSS請求；普通UA及桌機保留原CSS。新CSS僅宣告按需圖片URL；19張anime、20張summon、下一局旗幟與Usopp，共41張原WebP（11,594,668 bytes）複製到public/images/card-presentation/正式傳輸路徑。逐張與原desktop CSS的data URI及canonical共享原檔SHA／長度一致，沒有新圖、改圖或降畫質；不在進場預抓41張。現有原生包與原53MB桌機CSS均不改。

完整來源／發布白名單：docs/CARD_NATIVE_STYLES_20261103.json。新增1個program及41個media，發布者應以package-1c838d6bf03ea7a3為基線釘來源；舊1054媒體、其他program、其他遊戲維持。

## 最終收據

- entry final-style-r2/report.json：103 PASS、0 errors。桌機、Android v063、iOS v063/v058實際?room冷啟動、STATE先JOINED、首畫面新UI、零手機desktopCSS請求、小CSS精確bytes/SHA/sentinel、普通UA guard，以及桌機/Android真CSS503不放舊畫面、重試與返回通過。D:/Codex_QA/card-match-entry-20261103。
- video native-style-video-final/report.json：37 PASS、0 errors，最終head/nativeCSS下Android/iOS recovery+normal真MP4、完整EMIT/STATE、原ACK及後續選人；native-style-video-resource-bind/report.json另27 PASS確認實際小CSS與raw hero圖回應SHA、真playing→ended、不下載53MB。D:/Codex_QA/card-android-playback-20261103。
- venue final-all-platforms/report.json：211 PASS、0 errors，四平台6類explicit-read／boot／hidden／CPU放行／早到STATE／遺失ACK與重連。綁定稍早HTML16529/JSd6a94；之後只加手機CSS選擇與成功sentinel，canonical venue client與此報告SHA完全一致。D:/Codex_QA/card-venue-entry-20261103。
- native-style-sentinel-handoff-summary.json記錄41原圖等價、獨立AST selector guard與原宣告／keyframes等價、三平台6視圖比較、生成sentinel明確分離。無效的首次同分支比較已排除；有效r2每階段都核對baseline有desktop sheet、替代分支沒有。
- npm start真Socket.IO雙視窗sync-combined-final.json 8 PASS：建立/加入/開始、閱讀時延後狀態、抽牌同步、重整原席位與回合、他人手牌隱藏。本機DATABASE_URL空白，不列帳號DB驗收。
- 原95項針對startup pending/cancel/late promise/雙pending/正常的故障注入、原54項readiness回歸保留其較早來源範圍；最後影片37+資源27綁定本輪payload，不冒稱所有舊報告都重跑最新bytes。

最終raw runtime：game.html 2,020,374 bytes／ed043eabb8536b5daf8d6bd215d7c7a18b47c871e75d6c090f59a393d185df1e；card-desktop-table.js 338,178 bytes／d6a94e654c97e83964e89695f50e33519f6c4716221c6cd4e52ad5a7b2b6b397；card-native-online.css 18,778 bytes／2c3dc0e4506f798209be369541785dd3812b61660fcc1bdffd9f8224ce0c5ba7。原desktop CSS01a7ff90…、engine/index無本輪diff。完整runtime／41媒體／7維護腳本／4共享來源inventory與精確tracked patch（61,020 bytes）位於D:/Codex_QA/card-entry-video-20261103。

語法、限定runtime/scoped scripts的git diff --check、native style builder --check通過。最後QA完成後不再改產品；公佈版本／下載通道／原生重開與更新情報由啟動器依既有直接發布授權讀回。新CSS需加入正式program清單及新41media的manifest/CAS，不能沿用只准舊3program零media的舊發布腳本。

正式交接已送達啟動器thread01a15034-5637-7ed3-87c3-d500c621a5ab（send_message_to_thread成功）；收據D:/Codex_QA/card-entry-video-20261103/handoff-delivery.json。這只代表交接，正式新package／公告以發布者後續公開讀回為準。


本波發布前追加已完成：結果斜圖結束後才顯示取得防禦的頭像動畫／徽章，後續擋招／交幣死亡／連續麻痺不重播。最終runtime SHA與delta QA已另列CARD_RESULT_STATUS_20261103.md及最新artifact-inventory；本文件原三項QA保留原來源綁定，不改稱本次完整重跑。
