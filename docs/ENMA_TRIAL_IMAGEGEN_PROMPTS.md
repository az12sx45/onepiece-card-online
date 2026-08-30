# 閻魔試煉戰鬥開場 ImageGen 紀錄

## 生成方式與參考角色

- 模式：Codex 內建 ImageGen，逐張生成獨立 raster 畫面；沒有製作拼貼、sprite sheet 或覆蓋既有素材。
- 主要動作／服裝／霸氣效果參考：`C:/Users/王曜瑋/Downloads/2d54aeb821554923b49001a41236cfd5.jpeg`。
- 閻魔刀身參考：`C:/Users/王曜瑋/Downloads/Enma_Infobox.webp`。
- 新世界索隆身分輔助參考：`public/images/board/battle/portraits/evolutions/zoro_evolution_2/normal.webp`。
- 固定邊界：角色全程是赤膊、綠色腹卷、腰掛三刀的新世界索隆；不得出現索隆十郎的和服／羽織／髮髻，不得出現羅格鎮刀店、三代鬼徹、買刀或賭手臂試刀情節。場景固定為和之國岩岸黃昏，16:9 彩色漫畫動畫感，畫面內不生成文字、Logo 或 UI。

## 六幕最終 prompt set

1. `frame_01`：新世界索隆在和之國岩岸黃昏首次拔出閻魔，右臂健康且肌肉正常，神情沉著，紫鞘金色護手與三刀配置清楚，準備說「來測試這把新刀如何」。
2. `frame_02`：延續相同鏡位、人物與服裝，閻魔開始猛烈抽取武裝色霸氣；右手到肩膀被黑紫霸氣覆蓋但仍維持原本肌肉量，紫色能量由手臂流向刀身。
3. `frame_03`：延續相同構圖，霸氣抽取達到最強；握刀的右臂明顯乾縮成細瘦黑紫手臂，其他身體比例保持正常，索隆忍住痛楚但不放手。
4. `frame_04`：索隆以意志強行把外洩霸氣拉回身體；黑紫能量逆流，右臂由乾縮狀態恢復到一半，畫面以集中線與紫金閃光表現反轉。
5. `frame_05`：右臂完全恢復原本肌肉與膚色，索隆已壓制閻魔，刀身保留受控的紫黑霸氣，站姿穩定、神情自信。
6. `frame_06`：同一位新世界索隆將已馴服的閻魔扛在肩上，右臂完全健康，露出帶挑戰意味的自信表情，構圖預留底部對話安全區，準備說勝戰宣言。

每一幕都使用同一組負面限制：`no Zorojuro, no kimono, no haori, no topknot, no Loguetown, no sword shop, no Sandai Kitetsu, no gambling arm scene, no extra arms, no extra swords, no text, no logo, no UI`。

## 生成來源與正式輸出

| 幕 | ImageGen 來源 PNG | 正式 WebP | 尺寸 | SHA-256 |
| --- | --- | --- | --- | --- |
| 01 | `C:/Users/王曜瑋/.codex/generated_images/01a0185f-258e-73f0-817a-35e162778d0d/exec-599fa4d9-1e28-4a80-8f78-d00856396d0f.png` | `public/images/board/battle/cinematics/enma_trial_v1/frame_01.webp` | 1672×941 | `01E2E2B478D6FCF353937AE8C6ADAC645354B3CF76539EBD272D3FDB3F7163F0` |
| 02 | `C:/Users/王曜瑋/.codex/generated_images/01a0185f-258e-73f0-817a-35e162778d0d/exec-c24f371a-64bf-4c72-9e80-bbe4a9e3c270.png` | `public/images/board/battle/cinematics/enma_trial_v1/frame_02.webp` | 1672×941 | `1D6B058D59AAF7B181FB473F96D1399F8EBF0BF8A588C3670D6E0B06ED12C87C` |
| 03 | `C:/Users/王曜瑋/.codex/generated_images/01a0185f-258e-73f0-817a-35e162778d0d/exec-df1d41f7-ec76-4037-b979-5fbf4d14eb9d.png` | `public/images/board/battle/cinematics/enma_trial_v1/frame_03.webp` | 1672×941 | `67E4A3CA68411EC75B96BC6FD66C25D15237E8B3D974839CB5B02D4ED899881B` |
| 04 | `C:/Users/王曜瑋/.codex/generated_images/01a0185f-258e-73f0-817a-35e162778d0d/exec-1325a005-7408-46a7-80a1-fedbbee3b60f.png` | `public/images/board/battle/cinematics/enma_trial_v1/frame_04.webp` | 1672×941 | `BC0A76A5EB1C77803279BAC4D528C3EC38A5E091501A28AB1F27AE2A2F31B58B` |
| 05 | `C:/Users/王曜瑋/.codex/generated_images/01a0185f-258e-73f0-817a-35e162778d0d/exec-d49960b9-007f-41e1-ab21-95dc85302d8b.png` | `public/images/board/battle/cinematics/enma_trial_v1/frame_05.webp` | 1672×941 | `F9BF330656AD0591DD06F4C60DA7726F3B82823E4C5C74C80F488ECF972913A4` |
| 06 | `C:/Users/王曜瑋/.codex/generated_images/01a0185f-258e-73f0-817a-35e162778d0d/exec-e8555088-8da5-4e59-8699-0d894bd9f2ea.png` | `public/images/board/battle/cinematics/enma_trial_v1/frame_06.webp` | 1672×941 | `098AAAB63685DAAEA45FE3EB6170F29B22B828B9DEEA98D34335F8974D2A78E5` |

先前生成、穿深綠和服／羽織的候選圖被判定不符合新世界索隆造型，沒有接入專案正式素材，也沒有覆蓋上述六張定稿。
