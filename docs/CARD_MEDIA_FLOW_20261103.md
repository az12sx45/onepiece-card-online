<!-- CARD_MEDIA_FLOW_FINAL_RELEASE_HEADER -->
# 最新發布｜2026-11-03 爭霸戰影片與卡牌演出

**RELEASED**。正式Card程式包 package-1c838d6bf03ea7a3；最終Render Live與更新情報提交 69deed56b2206057d41f1b5bb2217cef6ee4172a。三份程式與CAS完整SHA、限定程式快取重啟0下載、Android/iOS v063 API通道與最後公開連續性均已核對。

收據：[CARD_MEDIA_FLOW_RELEASE_20261103.json](CARD_MEDIA_FLOW_RELEASE_20261103.json)。協調收據：D:\Codex_Project_Coordination\tabletop-series\handoffs\20261103-card-media-flow-release.json。原生包與媒體未重包；實體手機、原生App真正重新啟動、完整遊戲快取及正式帳號DB未宣稱驗收。

## 原開發與交接紀錄（全文保留）

# 爭霸戰手機強化影片、結果斜圖與還牌比例 — 2026-11-03

狀態：READY_FOR_INTEGRATION。正式發布由啟動器聊天室處理；本文件不代表公開／真機驗收。

## 需求與來源

使用者指出手機強化演出先全白才載入影片、兩張手牌出現多餘外框、斜圖應等選擇或硬幣結果確定、看完別人手牌後的卡背返回動畫會變形。

正式來源 D:/Codex_Release_Worktrees/card-native-server-adapter-20261029，分支 codex/card-native-server-adapter-20261029。接手HEAD0689b9d71e901c538ba075d3e2a09db1413cad86；其後其他聊天室正常接續提交，交接盤點HEAD為1ef8a2d9f15decaa30fe33a7810d6b8afe56e191；已確認本輪修改前Card HTML／JS／engine與0689相同，未reset或覆寫其他聊天室。最近已發布Card基線package-da2d1f412f0db8a8，實際新發布仍由發布者重新核對。

共用presentation根目錄 C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html/android。AGENTS、DEV_WORKFLOW、FILE_MAP、GAME_RULES與Marineford JS/CSS/QA等接手時已有dirty；本輪只修改Card，不包含那些草稿。

## 強化影片

舊流程為 await summon → rise1900ms → white700ms → 才設定影片src/load/play。preload=auto在尚無src時不能提早取得影片；角色圖片的ArtReady也不會載入MP4。

新prepareEnhFxFor／window.__prepareCardEnhVideo在公開已打出卡的enh_fx或演出起始就要求同一影片，不掃20支、不讀其他玩家手牌。等videoWidth/Height、readyState≥3及至少min(2秒,片長)緩衝（或readyState4）後才允許白光；ready的同一video直接play，不重設src或load。原影片位元組與URL未改。

Summon v5先升起角色，尚未ready則保持角色並顯示「準備強化演出…」，不先全白。載入／錯誤有15秒上限；失敗繼續招式流程，不送遊戲／離房／CPU指令。保留原播放逾時、防停滯、靜音fallback與背景清理。

exact v063已有matchPolishVersion1，會跳過同guard的線上改碼；這點已用真MP4抓到。新card-enhancement-ready使用獨立enhancementVideoOrderVersion2接管電影一次，處理enh_fx後才將其他事件交回舊wrapper；後續原legacy replay只consume，不播第二遍。即使warm Promise已resolve(true)，直接api.cancelEnhancements也會讓owner generation失效，並保留當批consumed供舊事件略過。JOIN／斷線／hidden才清整批。已保存修前晚播trace。

primeIOSMediaOnce的首次與200ms遲到callback都不會pause正在準備／播放的同一影片。所有取消會detach媒體listener/poll/timer，過期回呼不操作下一支。

## 結果斜圖

新card-result-cutins以原本所有現行flow都await的presentPileBatch作相容接點；既有影片、硬幣、效果、牌堆及私人閱讀真正完成後才播斜圖，沒有重裝舊flow或跳過reading gate。早期card_skill_intent僅供公共同步與分類，不再先播「請選誰／請擲幣」。

結果只取後端公開status、zoro.cardId、duel與本次新增官方公共log。大媽普通硬幣正面護盾／反面閃避，強化版點名後pay/die；尚需另一個決策的大媽demand、Law preview不提早播。索隆顯示實際對象與0–19號牌。其餘20牌普通／強化分類以真engine/decorator140案例核對；不從私人peek/order/hand推算公共結果。現行Card使用硬幣，未新增骰子或規則。

## 手中卡與還牌

原flyCard以來源box寬高分別算sx/sy，偵察圖片box與頭像anchor比例不同，返回卡背起點最大非等比誤差84.38%。新card-return-hand只對peek-return將起終點fit到原中心、以已解碼卡背自然比例（fallback2:3）交回原flyCard；所有動畫時點等比，src仍是原back，取消／hidden／borrow release／onFinish照原流程。

新CSS清除手牌button／held／card-finish-face的額外border與多層shadow，不移除卡面本身、升牌選取、內側鍵盤提示、frozen／disabled或原點按。沒有新增圖片、影片、存檔欄位、socket事件或引擎改動。

## 重建與檔案

正式產品僅public/game.html、public/js/card-desktop-table.js、public/css/card-desktop-table.css；server/engine.js與index.js未改。本輪新增獨立共享card-enhancement-ready.js、card-result-cutins.js、card-return-hand.js/.css，修改card-enhancement-summon.js/.css及兩個module builder/registry。結果模組註冊為最後一個JS。

```powershell
node scripts/build_card_media_flow.mjs 'C:\Users\王曜瑋\.codex\worktrees\android-tabletop-landscape\2026-04-20-1-2-start-html-game-html'
node 'C:\Users\王曜瑋\.codex\worktrees\android-tabletop-landscape\2026-04-20-1-2-start-html-game-html\android\build-card-desktop.mjs' 'D:\Codex_Release_Worktrees\card-native-server-adapter-20261029'
```

CARD_MEDIA_FLOW、CARD_RESULT_CUTINS marker與現有inline Summon均由build_card_media_flow.mjs同步共享來源；補上結果marker同步後重建HTML的SHA完全不變。舊native v063與桌機均需game.html，不能只發布generated JS。無新增外部runtime媒體、無重包APK／IPA。

## 證據與限制

- card_enhancement_ready_qa.mjs：slow-final/report.json 29 PASS，exact retained Android／iOS v063搭配目前HTML，本機原5.106秒MP4、真Range206及每次4200ms延遲、原生load/play/pause，不加autoplay-policy旗標。request→white為12942／13576ms；white時readyState3且2.885秒緩衝／readyState4；white→playing706／784ms；兩者各一次white／native load／ended。faults-final/report.json 28 PASS，含HTTP404、15秒無回應、遲到source／prime、ready已true整批取消＋legacy replay、原server ACK釋放後實際PICK_TARGET／PICK_DIGIT。零頁面例外且整輪產品SHA不變。
- card-result-cutins-20261103：retained Android／iOS各399PASS；current生成desktop五組時序＋warm probe392PASS。含140真引擎案例、大媽兩面、索隆0/17、奎因逐傳、demand/pay、私人閱讀、取消／背景快轉／斷線重連。不同版本的warm失敗／混版記錄保留，不列最終通過。
- card-return-hand-20261103：retained Android／iOS四尺寸88PASS；真正生成桌機不另注入module的整合20PASS。四尺寸×五時點皆等比誤差0%，卡背／私有／取消與兩張手牌原操作保留。最初baseline精確重現變形。

- 本輪npm start真實Socket.IO雙視窗8 PASS：sync-final.json核對建立／加入／開始、閱讀時延後新狀態、同步抽牌、重整原席位與回合恢復、他人手牌隱藏。本機DATABASE_URL空白，不列帳號DB驗收。
- 三份runtime及四份新JS腳本語法檢查、限定三份runtime的git diff --check通過。

QA位於D:/Codex_QA/card-enhancement-ready-20261103、card-result-cutins-20261103、card-return-hand-20261103；精確3份runtime patch（49652 bytes）及11份產品／共享來源SHA清單位於D:/Codex_QA/card-media-flow-20261103/formal-scoped.patch與artifact-inventory.json。報告只代表瀏覽器／本機測試，沒有實體Android／iPhone、正式帳號或實機速度驗收。原MP4保留，未下載／重編大型影片，未關閉安全控制。LATTICE API未提供，沒有假造任務／圖譜持久寫入。


## 最終交接檔案

- public/game.html：2005372 bytes，SHA256 681a19ccf1661cf166990e674b347f83320e0bcdfefab8162d959167af581b89。
- public/js/card-desktop-table.js：326083 bytes，SHA256 dcd0ac12fd621bb4fb0c655503ae298cdd457f44119160a497de3a119f77a971。
- public/css/card-desktop-table.css：52985418 bytes，SHA256 01a7ff90b2b749a9b01bb471289fab5ea26e6b10ee4944dd28dbb8d6d7b0af1f。

原server/engine.js、server/index.js無本輪diff；原31程式／媒體inventory與發布catalog須由發布者以最新基線再核對，不可整包採用其他dirty檔案。結果與還牌的早期失敗／混版報告保留；最終測試見上列明確路徑，不把baseline重現或舊版fixture錯誤列為本版通過。LATTICE未提供可呼叫API，沒有新task_ref、graph或持久寫入宣稱。

交接前再次核對HEAD為db60e9ea1855ca92cda867d58e97255085da526f（其他聊天室正常接續提交）。3份Card runtime與原盤點SHA相同，針對最新HEAD的完整3檔diff仍與49652 bytes scoped patch逐字相同；8份共享來源及4份維護腳本均符合inventory。共享6份JS／builder亦通過node --check。

最終來源綁定：D:/Codex_QA/card-return-hand-20261103/integrated-final/report.json 108 PASS、零錯誤，integrated:true，未額外注入module/CSS；目前generated桌機1366×768與exact retained Android/iOS各844×390、640×320共五尺寸，五動畫時點皆非等比誤差0，原卡背／私人牌保護／取消／hidden／兩張手牌原點按／提示／frozen均通過。report起始HTML、JS、CSS、engine SHA與交接檔案一致；原QA沒有內建結尾重雜湊斷言，發布者另做來源穩定核對。各最終報告路徑／檢查數／SHA彙整在D:/Codex_QA/card-media-flow-20261103/verification-summary.json。

交接送達：mcp__codex_app__send_message_to_thread成功回傳啟動器threadId 01a15034-5637-7ed3-87c3-d500c621a5ab；工具收據D:/Codex_QA/card-media-flow-20261103/handoff-delivery.json。這表示已送交，不表示已公開發布。
