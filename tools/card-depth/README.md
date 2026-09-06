# Card depth 的本機 BiRefNet CPU 工具

此工具用官方 rembg 轉出的 BiRefNet-general-lite ONNX 分割既有卡圖。輸入唯讀；不重畫人物、不修改原卡、不上傳圖像、不部署。分割結果是待目視檢查的 prototype，數字、文字、卡框也可能被模型誤認成前景。

## 本機環境

- Python 基底：`C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`，本輪 Python 3.12.14。
- 獨立 venv：`D:/Codex_Tools/card-depth-birefnet-v1/venv`。
- 執行檔：`D:/Codex_Tools/card-depth-birefnet-v1/venv/Scripts/python.exe`。
- 模型：`D:/Codex_Tools/card-depth-birefnet-v1/models/birefnet-general-lite.onnx`。
- 套件固定版本見同目錄 `requirements-cpu.txt`；只安裝 CPU onnxruntime、Pillow、numpy、opencv-python-headless 及必要相依套件。沒有安裝 torch、rembg 或 CUDA，沒有修改遊戲的 `node_modules`。
- ONNX 固定使用 `CPUExecutionProvider`、4 個 intra-op 執行緒、1 個 inter-op 執行緒及 sequential execution。不要平行啟動多個模型程序。

模型、venv、pip cache 不應加入 Git 或 public。工具本身不下載模型；下載及來源核對已在本機完成。程式每次開始推論前會檢查官方 MD5。

## 上游來源與授權

BiRefNet 模型專案為 [ZhengPeng7/BiRefNet](https://github.com/ZhengPeng7/BiRefNet)，其專案授權為 MIT。ONNX 檔案由 [danielgatis/rembg 的 model release](https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-bb_swin_v1_tiny-epoch_232.onnx) 提供；下載 URL 與 MD5 取自作者的 [general-lite session](https://github.com/danielgatis/rembg/blob/main/rembg/sessions/birefnet_general_lite.py)。BiRefNet 原專案與 rembg 轉檔來源分開記錄，不將轉檔檔案說成此工具自行訓練。

前處理遵循 rembg `BaseSession.normalize`：RGB、LANCZOS 1024×1024、以實際 RGB 最大值正規化，再使用 ImageNet mean/std，輸出 float32 NCHW。後處理遵循 `BiRefNetSessionGeneral.predict`：取第一個輸出的 channel 0、sigmoid、min/max 正規化、uint8 灰階、LANCZOS 回原裁切尺寸。本工具只另加常數輸出／非有限值保護。來源連結與兩份完整 MIT 授權在 `THIRD_PARTY_NOTICES.txt`；原卡圖權利不因工具授權而改變。

2026-09-07 下載驗證：

| 項目 | 值 |
| --- | --- |
| 大小 | 224,005,088 bytes |
| 官方 MD5 | `4fab47adc4ff364be1713e97b7e66334` |
| 本機 SHA-256 | `5600024376f572a557870a5eb0afb1e5961636bef4e1e22132025467d0f03333` |
| 模型輸入 | `input_image`, float32, `1×3×1024×1024` |

## CLI

以下 PowerShell 命令從專案根目錄執行。`--crop` 是原圖的 `[left, top, right, bottom]` 比例，不是像素。

```powershell
& 'D:/Codex_Tools/card-depth-birefnet-v1/venv/Scripts/python.exe' `
  'tools/card-depth/birefnet_infer.py' `
  --input 'public/images/cards/3.webp' `
  --id normal3-crop2 `
  --crop '0.075,0.055,0.95,0.635' `
  --output-dir 'artifacts/card-depth-v1/pilot/normal3-new-run'
```

可用 `--model '<absolute-path>'` 改模型位置，但仍只接受同一份官方 general-lite 模型。輸出檔名已存在時會拒絕覆寫；重跑請使用新 id 或新輸出目錄。

批次 JSON 為陣列，每筆含 `id`、`input`、`crop`，可加 `notes`。`input` 相對於 JSON 所在資料夾解析。

```json
[
  {
    "id": "normal3-crop1",
    "input": "../../../public/images/cards/3.webp",
    "crop": [0.075, 0.055, 0.95, 0.635]
  }
]
```

```powershell
& 'D:/Codex_Tools/card-depth-birefnet-v1/venv/Scripts/python.exe' `
  'tools/card-depth/birefnet_infer.py' `
  --batch 'artifacts/card-depth-v1/pilot/jobs-initial.json' `
  --output-dir 'artifacts/card-depth-v1/pilot/new-batch'
```

每張輸出 `*-crop.png`、`*-mask.png`、`*-foreground.png`、`*-checker.png`、`*-qa.png`、`*-report.json`。除 crop 和 QA 拼版外，遮罩、透明人物、棋盤格預覽保持原卡完整尺寸，方便後續對齊。報告包含裁切比例／像素、原圖與產物 SHA-256、模型與套件版本、載入／推論時間。批次完全完成後才產生 `batch-*-report.json`；沒有批次報告不可宣稱整批成功。

## 小工具自測

```powershell
& 'D:/Codex_Tools/card-depth-birefnet-v1/venv/Scripts/python.exe' `
  'tools/card-depth/birefnet_infer.py' --self-test
```

自測不建立 ONNX session、不載入模型、不寫檔。檢查裁切驗證、實際最大值正規化、黑圖數值、NCHW／float32、sigmoid/min-max、遮罩縮放、退化輸出保護、棋盤格與輸入像素不變。

2026-09-07 收尾執行結果：`BIREFNET_TOOL_SELF_TEST=PASS (24 checks; no model load; no file writes)`；`--help` 可正常列出參數；venv 的 `python -m pip check` 為 `No broken requirements found.`。

## 本次原始 pilot 的證據範圍

原始五卡清單為 normal3、normal8、enh3、enh8、lux3；`pilot/raw-initial/` 收尾時只存在 normal3 的完整六檔，原 batch 程序已消失，其餘四卡未產出，也沒有完整批次報告。此處只記錄完成 1/5；後續主流程的 prototype／80 卡處理另有證據，不混算為此批結果。沒有為補足此紀錄再啟動模型。

normal3 原圖為 1242×1863，裁切像素 `[93,102,1180,1183]`（1087×1081）；session 載入 7.5573 秒，單張推論 19.4736 秒。原圖 SHA-256 為 `dc7e6367baf66e487ba8b958f97d8e624d7f0b7ea8422196ab8b6aebcf705c40`；遮罩 SHA-256 為 `ba9ff329884d6854f04523c7c464de6032b1e55fefb51732a6c3aca9d8898504`。

目視結果：人物大部、服裝、頭髮與部分火焰保留，但畫面右側手部漏切，左上數字圈有殘留；此結果不合格，不能直接當正式人物層。下方文字已藉 crop 排除。只改矩形 crop 不能同時完整保留人物／火焰並排除附近數字；是否改善尚未以第二次 crop 推論驗證。後續應用固定區域保護與明列修補配方，仍需逐張目視驗收。

## General 大模型評估：不採用於本批卡圖

2026-09-07 在使用者核准後，只下載同系列 BiRefNet-general，當時未下載 SAM。`general_pilot.py` 導入既有 `build_card_layers.infer` 和 `card_recipes.RECIPES`，不修改共用 pipeline；只寫 authoring artifacts。此工具另設 Windows Below Normal priority，CPU 4/1 threads，單一 session、串行處理。預設只選 `enh/4`。

| 項目 | 值 |
| --- | --- |
| 本機模型 | `D:/Codex_Tools/card-depth-birefnet-v1/models/birefnet-general.onnx` |
| rembg 轉檔 | [BiRefNet-general-epoch_244.onnx](https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-epoch_244.onnx) |
| 大小 | 972,666,916 bytes |
| 官方 MD5 | `7a35a0141cbbc80de11d9c9a28f52697` |
| 本機 SHA-256 | `58f621f00f5d756097615970a88a791584600dcf7c45b18a0a6267535a1ebd3c` |
| 授權 | BiRefNet／rembg MIT；原模型 [model card](https://huggingface.co/ZhengPeng7/BiRefNet/raw/main/README.md) 明列 MIT，完整 notices 見同目錄檔案 |

原執行命令如下；此為已完成實驗的重現紀錄，不建議再跑。原本候選 enh/2、enh/4、enh/8、enh/15，因記憶體風險收斂到 enh/4 一張；其餘三張未執行。

```powershell
& 'D:/Codex_Tools/card-depth-birefnet-v1/venv/Scripts/python.exe' `
  'tools/card-depth/general_pilot.py' --only 'enh/4'
```

結果在 `artifacts/card-depth-v1/general-pilot/`：enh/4 原圖 1242×1863，crop `[93,93,1176,1062]`，rotation 0。與 lite 基線使用同一原圖／推論配方。模型載入 13.1507 秒；精確推論秒數尚未刷入磁碟即中止，所以報告保留 `inference_seconds: null`，不可把估計值當量測值。依 watchdog phase samples 約為 20 秒。

RAM watchdog 每秒取樣，working set 超過 8 GiB 或可用實體／commit 低於 2 GiB 即退出。此次在 export 階段達到 working set 峰值 8,740,458,496 bytes（8.14 GiB），private bytes 最大 10,215,899,136 bytes；最低可用實體記憶體 4,051,542,016 bytes。這是單次程序實測，沒有同時載第二個 general session。原始紀錄為 `memory-enh-4-1788714551238688300.json`；另一份較早的 `memory-enh-4.json` 是尚未載模型即發生 ctypes 參數錯誤的嘗試，不能混當推論數據。

有效產物是 `enh-4-mask.png` 與 `enh-4-actualcutout.png`。原 `enh-4-window-cutout.png` 在儲存途中被中止，已確認截斷，保留作失敗證據、不可使用。之後未載模型，只從有效遮罩恢復 `enh-4-recovered-window-cutout.png`、小尺寸 `enh-4-comparison.jpg` 和 `enh-4-report.json`。恢復命令如下；同名產物已存在會拒絕覆寫。

```powershell
& 'D:/Codex_Tools/card-depth-birefnet-v1/venv/Scripts/python.exe' `
  'tools/card-depth/general_pilot.py' --only 'enh/4' --review-existing `
  --memory-report 'artifacts/card-depth-v1/general-pilot/memory-enh-4-1788714551238688300.json' `
  --recorded-load-seconds 13.1507
```

目視使用已合到棋盤格的 JPEG，不用可能顯示隱藏 RGB 的透明 PNG 判斷。General 把整塊橙色畫窗、數字圈、卡框與人物全部切為前景；window/badge 保護後仍是大片矩形底色，不是人物輪廓。雖然 lite 漏掉喬巴軀幹與手臂，general 也不是可用改善。報告標為 `rejected-whole-art-window-selected-not-character-contour`、`approved_for_layers: false`；不得因有 mask/report 就納入正式人物層。本輪停止此路線，後續針對原圖輪廓的 alpha 修補由主流程負責。

General 遮罩 SHA-256：`022c7d62316e46442754279e6886087593a2cad40abe24da320008f97ad52649`；原圖 SHA-256：`618c3a0bb29f111a87d00c7ca794d455ce763fcf5673b0c992e096e18644fecb`。原卡未修改、model/venv 未加入 Git 或 public，未執行部署。

## SAM ViT-B quant：後續核准的單卡局部修補 pilot

General 停止後，在本次核准的免費本機製作流程中追加 SAM 局部修補評估。SAM 模型授權是 **Apache-2.0，不是 MIT**；[Meta 官方模型授權](https://github.com/facebookresearch/segment-anything#license) 已核對，完整授權保留於 `SAM_APACHE_2_0.txt`。ONNX 量化轉檔取自 [rembg 官方 session 與 checksum 表](https://github.com/danielgatis/rembg/blob/main/rembg/sessions/sam.py)，其 API／前處理來源仍適用 rembg MIT notices。這些都是製作機工具，不改網站架構、不隨網站傳送模型、不上傳卡圖。

模型位於 `D:/Codex_Tools/card-depth-sam-v1/models`，沿用既有 CPU venv，不安裝新依賴。兩檔下載於 2026-09-07 驗證：

| 檔案 | bytes | 官方 MD5 |
| --- | --- | --- |
| `sam_vit_b_01ec64.encoder.quant.onnx` | 108,836,115 | `26fc0e01d2fa34ed2d3f91259118482d` |
| `sam_vit_b_01ec64.decoder.quant.onnx` | 8,755,366 | `45391530307d1aee79b2a1507769e6c7` |

Encoder SHA-256：`181301ce3500a86c38450b56e2b71dab8008a13b1812a0d6cc812f22651e143a`；decoder SHA-256：`b11465135b7c93a1fd65141a4e2a96f1ddf2e3dab09b5eeab640bdf5f10aadbe`。精確下載 URL 見 notices 或 pilot report。

`sam_refine.py` 原始 pilot 只處理 `enh/4`，CPU 2 個 intra-op／1 個 inter-op threads、OpenCV 1 thread、Below Normal priority、關閉 CPU memory arena 和 memory pattern。先執行 encoder、釋放 session，再載入 decoder；只保留 embedding。每 0.5 秒量測 RAM，working set 超過 4 GiB 或可用實體／commit 低於 2 GiB 即退出。不可與其他模型程序並行。

```powershell
& 'D:/Codex_Tools/card-depth-birefnet-v1/venv/Scripts/python.exe' `
  'tools/card-depth/sam_refine.py' --self-test

& 'D:/Codex_Tools/card-depth-birefnet-v1/venv/Scripts/python.exe' `
  'tools/card-depth/sam_refine.py'
```

`--self-test` 不載模型、不寫檔；實跑結果 `SAM_REFINE_SELF_TEST=PASS (8 checks; no model load; no file writes)`。第二條是已完成的單卡執行紀錄，現有輸出會拒絕覆寫，重跑須另指定 `--out`，不要因此自行扩大批次。

前處理依 rembg 的 SAM API：原卡 RGB，以比例 affine 放入 684×1024 畫布，float32 HWC；點／框套用相同 transform。這與 BiRefNet 的 ImageNet NCHW 正規化不同。Decoder 的 logits 以 >0 轉遮罩、inverse affine 還原原卡尺寸。程式使用 OpenCV `INTER_LINEAR` 取代 rembg 現行 scipy affine，並沒有安裝 scipy/rembg/torch。

enh/4 的人工正點 `[650,570]`、`[640,930]`、`[275,710]`、`[1030,985]`，負點 `[250,260]`、`[1100,640]`，人物框 `[185,205,1080,1110]`。候選選擇優先符合正負點，其次點命中／模型 IoU／框外比例；不盲目 union 候選。**本下載 decoder 實際只輸出 1 個候選**，不能宣稱此次比較了多個候選。它命中 4/4 正點，但仍命中 1/2 負點，prompt constraints 不通過。

`artifacts/card-depth-v1/sam-pilot/` 有原尺寸 `enh-4-mask.png`、候選遮罩、414×621 灰底 `enh-4-cutout.jpg`、提示點預覽、來源／模型／計時 `enh-4-report.json` 與 RAM `enh-4-memory.json`。原圖 SHA-256 未變；遮罩 SHA-256 為 `4d198c07f3fb3e903d017a827a39c711eff4cc592a17ffb376f1ec5ff11cfa18`。

此輪總時間 21.982 秒；encoder 載入 2.0516 秒／推論 17.8336 秒，decoder 載入 0.6937 秒／推論 0.462 秒。Working set 峰值 3,367,145,472 bytes（3.14 GiB），private 最大 3,371,143,168 bytes；encoder 釋放後 working set 約 117 MB，程序正常結束。

目視結論：人物的帽、臉、鹿角、軀幹與兩臂比 lite/general 完整，但仍有帽／臉／下巴內洞、漂浮花瓣與徽章碎片，需局部 alpha 清理。狀態為 `improved-body-contour-but-requires-local-cleanup`，`approved_for_layers: false`。此工具沒有跑其他卡，也沒有將此未驗收遮罩直接放到 public。

## SAM 單張 job 與 embedding 快取（後續擴充）

工具現已接受 `--job`，每次恰好一張，不提供自動 80 卡 batch。未給 job 時仍使用 enh/4 原始 pilot；有 job 時必須明列新的獨立 `--out`，輸出資料夾有任何內容即拒絕覆寫。Key 限定既有 4×20 張卡；source 必須符合目前 `card_recipes.py` 的該卡來源，可用 `images/...` 或 `public/images/...`。

JSON 格式範例（所有點位與框均以**旋轉前完整原圖**為座標基準）：

```json
{
  "key": "enh/4",
  "source": "images/cards/enh/4.webp",
  "coordinate_space": "pixels",
  "positive": [[650, 570], [640, 930], [275, 710], [1030, 985]],
  "negative": [[250, 260], [1100, 640]],
  "box": [185, 205, 1080, 1110],
  "crop": {"coordinate_space": "normalized", "box": [0.08, 0.06, 0.94, 0.60]},
  "rotation": 0
}
```

`coordinate_space` 必須明列 `pixels` 或 `normalized`（亦接受 `original-pixels`／`original-normalized`）。Normalized `[x,y]` 乘原圖 `[width,height]`；點必須在原圖內，不可用 1.0 當最末像素。Box 為 `[left,top,right,bottom]`。`crop` 可省略表示完整原圖；若使用陣列則沿用 job 的座標單位，若使用物件可另指定單位。Crop 四邊最後四捨五入成像素，右／下為 exclusive 邊界。所有正負點都必須落在 crop 內，越界會拒絕，不會默默丟棄；人物框會交集到 crop，有截斷會記在報告。

`rotation` 只接受 0、90、180、270，為 PIL 的逆時針角度。處理順序：裁切原圖 → 旋轉 → SAM affine／點變換 → 反向 affine → 反旋轉 → 貼回完整原圖遮罩。Report 分別記錄 `job/geometry`（真正的 SAM 輸入）與 `recipe`（供 builder 核對來源與佈局的參照），不把兩者混為同一套推論配方。

```powershell
& 'D:/Codex_Tools/card-depth-birefnet-v1/venv/Scripts/python.exe' `
  'tools/card-depth/sam_refine.py' `
  --job 'tools/card-depth/jobs/enh-5.json' `
  --out 'artifacts/card-depth-v1/sam-refinement/enh-5'
```

Embedding 預設存於 `D:/Codex_Tools/card-depth-sam-v1/embeddings/<sha256>.npz`，不進 Git/public。Cache identity 包含原圖 SHA-256、原圖尺寸、crop 像素、rotation、encoder SHA-256、前處理版本與輸入尺寸；不含點位，故同畫面只調正負點／框可重用。NPZ 以 `allow_pickle=False` 讀取，檢查完整 identity、float32 `[1,256,64,64]`、有限值與 embedding 本身的 SHA-256。寫入使用獨立 partial 檔再 rename，既有不符的快取不會被自動蓋掉。

```powershell
# 改過點位、但保留 source/crop/rotation 的 job，可只解碼到另一個新目錄。
& 'D:/Codex_Tools/card-depth-birefnet-v1/venv/Scripts/python.exe' `
  'tools/card-depth/sam_refine.py' `
  --job 'tools/card-depth/jobs/enh-5-adjusted.json' `
  --out 'artifacts/card-depth-v1/sam-refinement/enh-5-adjusted' `
  --decode-only
```

上述 adjusted job 是語法示例，工具不自動建立它。`--decode-only` 在精確快取不存在時直接拒絕，絕不偷偷跑 encoder；可用 `--cache-dir` 指定另一個非 public 目錄。原始 enh/4 pilot 在快取功能之前執行，沒有留 embedding，因此不能直接重新 decode，也未為補快取而重跑。

擴充版無模型自測已通過 31 項，包括原圖／normalized 單位、crop／點越界、四種旋轉回貼、候選選擇、快取 identity 變更／NPZ round-trip、decode-only 缺檔不呼叫 encoder。實際 CLI 的 cache-miss 防護亦已驗證；截至這項驗證，尚未執行新的 cache-hit decoder 推論。

後續另依主流程提供的 `jobs/enh-{5,8,10,11}.json` 串行執行四張，每張各一個新 Python 程序，完成 4/4。輸出在 `artifacts/card-depth-v1/sam-refinement/<stem>/`，每張有 request、report、memory、候選／選定 mask、cutout JPEG、提示點 JPEG；四份 embedding 已寫入 D: cache，原卡 SHA 均驗證未改。

| 卡 | 總秒數 | RAM peak bytes | 提示點條件 | 灰底目視 |
| --- | --- | --- | --- | --- |
| enh/5 | 9.8941 | 3,373,338,624 | 正8/8、負0/3 | 大量衣服及軀幹連結透明；點通過也不代表合格 |
| enh/8 | 9.6015 | 3,373,871,104 | 正6/6、負1/5 | 人物／四拳較完整，但徽章與橙色特效殘留 |
| enh/10 | 9.8132 | 3,374,481,408 | 正6/6、負2/4 | 仍包含漫畫畫窗、交擊字、火焰，非人物分離 |
| enh/11 | 9.4488 | 3,370,672,128 | 正6/7、負0/3 | 頭、手、毛披風輪廓較完整；少量碎屑，待核對漏點 |

這四張均只有一個模型輸出候選，報告維持 `visual_review: pending` 與 `approved_for_layers: false`，由主流程依真正原圖輪廓決定是否合併／局部修補；沒有自動採用、沒有擴大成 80 卡。推論程序均正常結束，沒有觸發 4 GiB 上限。

收尾再次執行 31 項自測通過；四份真實 NPZ 亦已用正式 `load_embedding` 重新開啟，逐份驗證 identity、shape／dtype、內部 embedding SHA 與 report 的檔案 SHA，結果 `SAM_CACHE_QA=PASS (4 real NPZ caches; no model session; no file writes)`。這是純讀取快取檢查，不是另一次模型推論。

### 後續狀態補記：6 份 SAM jobs（2026-09-07）

上方四張表格保留當輪紀錄。主流程後續另外使用相同工具執行 `jobs/lux-enh-5.json`、`jobs/lux-enh-7.json`，現在 job 階段共有 6 份單卡報告，不含較早的 enh/4 原始 pilot，也不是全 80 卡模型批次。本次只讀取已完成報告整理總覽，沒有重新推論或改寫歷史結果。

| Job key | report 總秒數 | Working set peak bytes |
| --- | ---: | ---: |
| enh/5 | 9.8941 | 3,373,338,624 |
| enh/8 | 9.6015 | 3,373,871,104 |
| enh/10 | 9.8132 | 3,374,481,408 |
| enh/11 | 9.4488 | 3,370,672,128 |
| lux-enh/5 | 12.4187 | 3,370,635,264 |
| lux-enh/7 | 12.7389 | 3,371,995,136 |

六份原始 `artifacts/card-depth-v1/sam-refinement/<stem>/<stem>-report.json` 都保留執行當下的 `visual_review: pending`／`approved_for_layers: false`，不事後把原始模型輸出標成直接合格。主流程後續的 SAM＋Lite 混合、人工 alpha 修補與逐卡二審是分開的製作步驟，最終採用與發布狀態以 `docs/CARD_DEPTH_V1_RELEASE.md` 及對應 review 紀錄為準。模型、embedding 與 venv 均在 D: 製作工具目錄，不進 public 或 Git。

## 人工 alpha 輪廓修補（2026-09-07）

`mask_corrections_enh.py` 獨立匯出 enh/7、13、17；`mask_corrections_lux_enh_b.py` 獨立匯出 lux-enh/12、15、17、18。每張使用 `CORRECTIONS[key].include/exclude` normalized polygons，座標基準是原始 1242×1863 圖；僅揭露或隱藏既有 RGB，不重畫、不變更原圖、沒有再跑模型。現有 builder 的框、數字與文字保護仍優先生效；模組不自行改共用 registry 或發布 public。

局部預覽重現（2 個 OpenCV threads、讀取已存在的 raw mask，不載 ONNX）：

```powershell
& 'D:/Codex_Tools/card-depth-birefnet-v1/venv/Scripts/python.exe' `
  'artifacts/card-depth-v1/enh-corrections/preview_enh_corrections.py'
& 'D:/Codex_Tools/card-depth-birefnet-v1/venv/Scripts/python.exe' `
  'artifacts/card-depth-v1/lux-enh-b-corrections/preview_lux_enh_b_corrections.py'
```

兩個 script 只覆寫各自 review 目錄中的衍生預覽，不寫原卡/public。它們在本身程序暫時替換目標 key 的 in-memory correction、完成後復原，不修改共用程式。輸出原圖／修前／修後灰底三欄 `*-cutout-review.jpg`、中立／左右位移 `*-motion-review.jpg`、透明人物 PNG 與 `preview-report.json`；不以透明 PNG 隱藏 RGB 的顯示結果作為合格判斷。

七張均已作者目視原圖及 before/after/motion，原圖 SHA-256 保持不變，固定區像素最大差異 0。基拉已包含金髮、握刀拳與下身；卡塔克利白圍巾小洞經原尺寸細節比較確認不是毛束空隙並補齊，紅色氣場留背景。主流程於 2026-09-07 二審接受全部七張，作者檔案已鎖定待 final rebuild。詳細輪廓邊界與驗證記於兩個 review 目錄的 `REVIEW.md`，不可將作者／二審通過等同發布／瀏覽器驗收。主流程統一整合、更新專案修改紀錄並執行最終 runtime QA。
