# 爭霸戰選牌／騙人布猜號介面與索隆卡號播報 — 2026-11-03

狀態：READY_FOR_INTEGRATION，本機驗證完成。發布由啟動器聊天室整合，不能把本文件或編譯結果當作公開／真機驗收。

## 需求與來源

使用者要求重新製作選擇出牌的框與按鈕、猜狙擊號碼的框與數字按鈕；新狙擊外觀採騙人布招式風格，圖片不過度拉伸。索隆斬擊結果直接顯示砍掉的幾號卡。

正式根目錄 D:/Codex_Release_Worktrees/card-native-server-adapter-20261029，分支 codex/card-native-server-adapter-20261029，接手基底 983a32b91dba8ccfa1ad39a9150f995bb501eeb2。前一輪正式 Card package-3987dc38668831bc 與船長面板／收藏保留。AGENTS.md、DEV_WORKFLOW.md、FILE_MAP.md 接手時已有未提交內容，僅追加本輪紀錄。

共用 presentation 根目錄 C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html/android。只處理 Card 原 Web 對局，保留啟動器／大廳／帳號／其他遊戲／原生 Board。

## 實作

- 新 card-picker-panels.js/.css 裝飾既有選牌 inspector 與真正 showDigits 數字節點；沒有重建原按鈕、改 disabled 或新增出牌／猜號 socket handler。
- 選牌使用全新 navy／金邊海賊框；重新排列卡圖、文字、上一張／下一張與「確認出牌」，按鈕是程式原生表面，沒有把舊圖片壓扁當新按鈕。卡圖 object-fit:contain，文字可捲動。
- 狙擊框採彈弓木架、護目鏡、Pop Green 藤蔓與準星。數字0–9排列五欄兩列，保留1號禁止、原回呼防重送與目標／忙碌 gate；Tab／Enter／Space使用原生按鈕。沒有新增猜號捷徑或更改規則。
- 兩框來源／容器比例固定1942:809、background-size:contain；數字圖由1254正方形等比縮成256正方形，按鈕亦為正方形並contain。清除本範圍舊 border-image stretch 與100%100%背景，原卡面仍按原比例呈現。
- 新圖卡共三張：card-play-picker-frame-v1.webp、card-usopp-picker-frame-v1.webp、card-usopp-number-v1.webp。built-in image_gen.imagegen 原始PNG與完整提示見 CARD_PICKER_ART_20261103.json；原圖保留，框只做格式轉換，數字只做正方形等比縮圖。
- server/engine.js 的既有公開 zoro_discard 只新增 optional cardId:thrown；不改結算／存檔。事件原本緊鄰公開斬棄流程，新增欄位直接提供真正砍牌號碼，避免從未公開手牌或相鄰 Teach 靜默事件推測。
- card-phone-fx.js 在既有斬擊完成後的結果文字顯示「砍掉 X 號卡」。新 card-zoro-result.js 與同內容線上相容段支援已裝舊原生 bundle。僅接受公開 zoro_discard 的整數0–19，缺欄位／無效資料維持中性，不把卡號放進技能 intro。

新部件在 game.html 透過 CARD_PICKER_PANELS_BEGIN/END 與 CARD_ZORO_RESULT_BEGIN/END 提供已裝 v063 的線上相容層；桌機產物與新原生包共用同一來源。mobile-sources.mjs／build-card-desktop.mjs 只註冊兩個 Card 模組與三個 Card 美術。沒有重包 APK／IPA。

## 建置

```powershell
node scripts/build_card_picker_panels.mjs 'C:\Users\王曜瑋\.codex\worktrees\android-tabletop-landscape\2026-04-20-1-2-start-html-game-html'
node 'C:\Users\王曜瑋\.codex\worktrees\android-tabletop-landscape\2026-04-20-1-2-start-html-game-html\android\build-card-desktop.mjs' 'D:\Codex_Release_Worktrees\card-native-server-adapter-20261029'
```

## 驗證紀錄與界線

- scripts/card_picker_panels_qa.mjs：port0隔離 server、原 game.html、真 engine visible state、原處理器、exact retained Android／iOS v063；新框與token解碼／自然比例／contain、命中區、切牌／方向鍵／確認一次、凍結／過期狀態、九個合法猜號／1禁用／目標／防重送／閱讀busy gate。完整最終報告於下方追加，不能把初步 quick 當完整交付。
- 狙擊裝飾初稿有無條件 classList.add 與 class observer 形成自循環；獨立 WebKit 最小案例證實，改為 contains guard。舊quick中止與原因保留，並加驗真setTimeout執行及連續數字點擊。
- 最初stale fixture向仍開著的閱讀視窗送STATE並等idle，正確被原reading gate延後；測試改以 getVisibleState→direct render 的專用過期狀態分支驗 canPlay phaseKey，不改產品或繞過真流程。其他分支仍用原STATE。
- scripts/card_zoro_number_qa.mjs：新shared、desktop、exact iOS v063 WebKit 各45項初步通過；真engine0／普通／強化4/17/19、legacy缺欄位／非法／Teach／同名目標事件及結果晚於斬擊。engine-equivalence.json 對照基底五例，state與除新增cardId外全部emits相同。取消序列另核對後記錄最終結果。
- 實際 npm start＋兩個 Chromium 視窗8項通過（join/start/draw/閱讀延後/refresh/privacy）。NODE_PATH僅該子程序使用既有mobile node_modules，DATABASE_URL為空，沒有正式帳號。證據 card-picker-panels-20261103/sync.json。

取消錯號重現與修正：retained Android v063 用 api.openPlayers 移走rail，真實觸發原ResizeObserver→refreshAnchors→私有clearFx；取消4號斬擊後同目標缺欄位事件曾誤顯示4號。相容模組現在同步清理真正rail失效與已呈現global STATE回合／身份邊界，沒有用timeout推測，也不讓排隊中的future STATE提前清掉目前結果。cancel-final/report.json 52項通過；最終desktop與iOS各52項通過，保留修前錯號報告。

iOS640真實觸碰穿透：final-ios-trace/event-trace-1.json記錄confirm trusted touch pointerup（id0，415/243）後，同座標trusted mouse click（id1）落至下方captain而打開收藏，使正常STATE因reading gate等待。這不是fixture問題。新相容層只追蹤confirm上的同一touch小移動，攔下緊接、同座標的trusted/detail>0相容click；不要求WebKit提供相同pointerType/id，不攔原控制轉送或鍵盤detail0，下一個pointerdown立即清除。最終測試額外核對沒有誤開收藏，下一次真點頭像仍立即可開。

QA根目錄 D:/Codex_QA/card-picker-panels-20261103、D:/Codex_QA/card-zoro-number-20261103。這些是瀏覽器／本機通訊驗證，未做實體Android／iPhone或真實帳號驗收；未公開發布。LATTICE工具清單目前無API，歷史games.json已讀，未假造任務／圖譜持久寫入。

最終 READY_FOR_INTEGRATION：選牌／猜號 final-r2 桌機2＋exact Android6尺寸689項、final-ios-r2 iOS2尺寸174項，合計863項通過，零page errors，4個目前runtime／engine SHA前後與現況一致。確認後無誤開收藏、下一真手勢正常、Enter與原一次PLAY_CARD均通過。索隆最終desktop／iOS各52項共104通過；此後只補選牌confirm相容click guard，索隆與後端未再修改。npm start雙視窗8通過、舊引擎5個state／其他emits等價。最終檔案大小／SHA清單與精確4檔patch位於 D:/Codex_QA/card-picker-panels-20261103/artifact-inventory.json、formal-scoped.patch。未公開發布、未做真機驗收；交給啟動器整合。
