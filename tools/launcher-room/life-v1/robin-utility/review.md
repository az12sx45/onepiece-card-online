# Robin / Chopper Life 動作交件

## 結果

原圖與 128px 對照檢視完成。Chopper 16 段（utility 4 + work 4 + read 4 + medicine 4），Robin 12 段（utility 4 + work 4 + read 4），共 28 個 512×128 RGBA WebP，112 格完整人物。尚待整合者驗收真實房間中的播放、家具接觸點與狀態切換；不以這份靜態檢視冒稱部署或真人遊玩通過。

## 選圖與退件

- 全部用內建 GPT imagegen，11 次生成均保存原圖及實際 prompt/receipt。
- Robin 原 utility 的 rest 第三格把腿換邊，拒用該列，以 rest-fix-source.png 的四個完整坐姿替代。
- Robin 原 utility 的 train 身體偏短；第一次補圖 train-fix-rejected-source.png 又變成成人長身，整張拒用。最終 train-correct-source.png 固定約三頭身，四格低幅肩胸伸展、雙腳同位置。
- Chopper 原 work/read 的 east 把左鹿角修補環畫到近側，拒用該列。east-fix-source.png 第一列用於 work、第二列用於 read；可見右角無修補環，西向可見左角仍保留。
- utility 的 eat/rest/sleep/train 只產 south。操作器須切為 south，不能把它假當側面或背面。

## 實際檢視

- Robin 的齊瀏海、狹長藍眼、鼻樑、黑衣及藍白领口/裙邊保留；Chopper 保留早期粉帽、白 X、藍鼻、棕角、棕紅褲、藍背包與分蹄。
- 頭與身體同向；north 完整背面無臉。沒有拆頭、拼肢、變形骨架或水平鏡像。
- work 是托盤和布的往返動作；read 可見頁角抬起、翻過、放平；medicine 是密封小瓶與短筆核對標記，沒有把桌櫃烘進人物，沒有假病患。
- rest/sleep 使用低幅呼吸，不能解讀為激烈動作。各段四格像素不同；work/read/medicine 的動作差異在原圖與 128px 可見。
- 每段四格採同一整人物比例，站立高度對齊已接受 idle 的約 98px。每格只平移整個人物至腳底/坐地基準。睡姿自然降低，沒有放大橫躺身體塞满格子。
- 已檢查全部 28×4 格無截頭、截角、截腳。Robin rest 的非均分欄間隙已按真實空隙選取，避免下一人的靴尖混入第三格。

## 可重建與來源

每個 group 有 prompt.txt、receipt.json、source.png、source-alpha.png、plan.json、plan-import.json。補圖有對應命名的 prompt、source、receipt；被淘汰來源保留但未選入 plan。

pack_review.py 只作透明背景雜點清理、完整人物裁切、同組等比縮放與圖集編碼：清除 alpha<16 和小於 32 原圖像素的獨立不透明雜點，保留大圖形及兩像素反鋸齒邊。未改 RGB 畫作，未組裝人體。train-reference.json 記錄參考整人裁切的來源與框。

兩人的 contact-128.png 對照舊 idle 與各段四格；motion-review.gif 為檢視用動畫。atlas-review.json 保存最終圖集 SHA 與每格外框。最終 source/contact 驗收與 runtime 驗收分開記錄。
