# 水之七島船隻深度表面（2026-09-24）

正式來源：`D:/Codex_Release_Worktrees/board-battle-depth-20260923`，基線 `4f4170331f0e323786f93dd8d7535e868985dc6d` / `package-44cba2090f7b33a2`。使用者授權改善船隻 3D、保持原有功能與介面並部署。

## 呈現與資料來源

- `scripts/build_water_seven_ship_depth.py` 以本機 CPU ONNX Runtime 對六艘船、36 張原始去背視角推論相對深度。原船圖 bytes 不變，沒有生成替代船圖。
- 模型：[Depth Anything V2 Small ONNX](https://huggingface.co/onnx-community/depth-anything-v2-small)，固定 revision `4472b7362082ad9968fee890ca0f1e5aca36b93d`，SHA256 `afb6a5c28f3b6bf1618c6e43f02073ef9dfdc70e937502d51603e57b0a1df10c`，Apache-2.0。模型位於 `D:/Codex_Tools/water-seven-depth-v1`，不發送給玩家。
- `public/js/board_water_seven_depth_data.json` 保存原圖 SHA、尺寸、量化高度網格與模型出處。這是數字幾何資料。
- `public/js/board_water_seven_depth.js` 使用 WebGL 淺浮雕網格、依深度法線的柔和打光與限幅指標視差。這是保留原六視角的深度表面，並非任意旋轉的完整 360 度模型。

## 保護原有功能

- Canvas 沿用 shipFocusLayer 的 contain 尺寸與既有鏡頭，依 camera zoom／DPR 提高解析度；沒有新增控制項、阻擋事件或更動校準座標。
- 既有升級、孔位、連線、F4 校準、頁籤與狀態仍由原 inline 程式处理；轉視角／校準期間使用原圖，載入失敗或 WebGL 不可用也回退原圖。
- 觸控與 reduced-motion 使用靜態打光；閒置停止繪圖、離頁釋放資源，GPU context loss 回復原圖並支援恢復。
- `board_water_seven.html` 只增加呈現腳本；`board_game.js` 僅更新 WATER_SEVEN_PAGE_VERSION，`board_game.html` 僅更新 query。沒有改遊戲規則、Socket.IO、存檔、裝備費用或物品資料。
- 程式允許清單加兩個檔案，成為 53 程式＋6,310 原媒體；`build_water_seven_ship_release.js` 固定上述基線，只允許三個既有入口／版本程式與兩個新呈現程式。套件保留 6,361 舊路徑，共 6,363 檔。Card／Chess／v2 與 ranks 未提交差異保留。

## 驗證

- `water_seven_ship_function_qa.js` 在既有 npm start 18943 的正式主頁 iframe 比對舊／新版：升級甲板、開第一孔、裝上／卸下補帆帆布、離開重進與 iframe 重載均通過。貝里 100000→87500、木板 100→92、等級／孔位／道具結果完全相同，頁面錯誤 0。
- `water_seven_ship_depth_qa.js` 比對六船五個升級視角及裝備／開孔頁，涵蓋桌機與 932x430、36 個原圖 SHA、指標不改布局、F4、GPU context loss／restore、觸控／reduced-motion、無 WebGL／深度檔遺失備援。最終執行結果與發布結果記在 DEV_WORKFLOW。
- 證據：`D:/Codex_QA/water-seven-ship-depth-20260924`。以上為隔離瀏覽器自動測試，不接觸使用者存檔，也不代表實體手機驗收。
- LATTICE 本階段沒有 callable API；沿用已知正式 project_id，沒有假稱寫入持久任務、圖譜或驗收。

正式端補強：普通 img 的跨站 CDN 快取可能缺少 CORS header。3D renderer 改以 cache=reload 的 CORS fetch 取得 texture bytes，再用短期 Blob URL 解碼並回收；首次公開 3D smoke 曾安全回退原圖，不列為成功，最終發布驗收見 DEV_WORKFLOW。
