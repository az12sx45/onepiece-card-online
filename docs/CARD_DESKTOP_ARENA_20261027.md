
## 2026-10-27 爭霸戰桌機共用牌桌與跨平台發布候選
使用者明確要求電腦版也採用手機牌桌。public/game.html 僅加入桌機 presentation JS/CSS；原 engine/cpu/server、Socket.IO、存檔與卡牌規則未修改。桌機共用 Card 七個 presentation 模組及 interact runtime，沿用 GPT 生成圖片。1024×600、1366×768、1920×1080 專用比例；原頭像選人、護盾/閃避規則、出牌者→場中央→效果完成→棄牌、看牌與交換、寶箱餘額保留。桌機選單不含原生專用導航。Android/iPhone UA 與 native bridge guard 避免重複裝載。
來源：android-tabletop-landscape/android/build-card-desktop.mjs、web/card-desktop-layout.css；輸出 public/js/card-desktop-table.js、public/css/card-desktop-table.css。config/desktop-program-packages-v1.json 僅 Card 新增此兩檔；scripts/build_card_program_update.js 從 committed bytes 建立 Card-only release，保留全部既有媒體、Board/Chess catalog，允許且僅允許兩個新 program 路徑。
驗證：桌機原引擎 portrait 67、stage 90、原生共存 4 項通過，零 pageerror；圖片從正式程式配合同源本機既有媒體讀取。npm start 七入口 HTTP200，正式樹無 node_modules，僅子程序 NODE_PATH 指向既有依賴；測試結束關閉自身 server。未做真人跨裝置/真機驗收。證據 D:/Codex_QA/card-desktop-arena-20261027。
LATTICE runtime/task API未出現在本階段工具清單；未聲稱持久任務或圖譜成功。沿用已知 project/task 身分，發布收據另記。
