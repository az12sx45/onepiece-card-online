# 航海錄場景配樂與操作音效（2026-09-21）

依使用者要求補齊各場合 BGM、按鈕音效並部署。正式來源 `D:/Codex_Release_Worktrees/board-voyage-records-v1`，基線 `a5cf3d328195537cc062460e4d1dde91dc17b654`／`package-b3342dbd8b206231`。保留先前海格插畫與未提交的 rank、V1 圖片。

## 實作範圍

- `board_start.html`／`js/board_start.js`：大廳載入既有音樂管理器，使用啟航配樂；第一次真人操作後播放，尊重已有靜音設定。
- `js/bgm_manager.js`：公開既有 unlock 給內嵌頁手勢使用；在手勢呼叫鏈內啟動靜音候選播放，等 metadata 與播放成功才定位 cue／淡入；同曲被暫停後可恢復。原本新曲失敗保留舊曲、最新請求、交叉淡化、cue loop、巢狀影片 focus 皆保留。另追蹤淡出舊曲，讓靜音、音量及影片 focus 同時生效；保持原淡出期限，停止／取消載入的音軌不會因遲到回呼復活。
- `js/board_game.js`：音樂優先序為戰鬥→正在顯示且非關閉中的副本／切磋／解謎→地圖。推進城樓層／警報與頂上戰爭進度更新不再誤回地圖曲；補水之七島、切磋選角、約克解謎與任務板配樂。商店、酒館、醫院、研究等停留 650ms 即開始柔和轉場，快速離開會取消過期請求。
- 海格抽選、寶箱、獎勵、治療、危險依實際展示資料選曲並播放短提示；操作方／觀看方沿用原事件 ID 去重，不新增網路事件。戰敗／全倒與逃走有獨立結果音樂，換人、回合暫停與救援等待仍保留戰鬥曲。
- 新增 `js/board_audio_ui.js`／`css/board_audio_ui.css`：全頁事件代理，真人按鈕／連結、鍵盤確認可發聲，disabled／inert／CPU 合成 click 不發聲；同源 iframe 共用父頁音訊，固定視角容器自身沒有音訊時由 Board 子頁持有播放器。
- 「聲音」面板分開控制背景音樂與**操作音效**。沿用 `board_bgm_enabled`／`board_bgm_volume`，新增裝置偏好 `board_sfx_enabled`／`board_sfx_volume`；沒有存入遊戲狀態或改名舊 key。戰鬥招式、角色語音及有聲影片沿用既有聲道，面板沒有冒稱它們受操作音效滑桿控制。
- 八個既有短 MP3 於首次手勢後快取解碼；每段 peak 正規化為 0.65，master 最大 0.32，最多四聲部，理論加總 peak <0.84。快取未就緒或音檔失敗時，以短木質／音槌／鐘聲合成備援立即回饋，操作不等待載入；不改玩法 RNG。
- 正式接入八頁：大廳、主遊戲、戰鬥、推進城、頂上戰爭、水之七島、切磋選角、約克謎題。音效 JS／CSS 納入桌面白名單，共 43 程式；既有 4,112 媒體保留。
- `board_audio_preview.html`／`js/board_audio_preview.js`：22 場景與 10 種提示音的獨立音樂室，可直接試聽；不連房間或寫入航海進度。

## 曲庫與場景

重用正式專案 56 首具名航海王 OST 與原音效，不另下載、覆寫或生成音樂檔。既有 20 首主題曲也保持。1,090 份 Board 音檔皆已在基線 manifest，大小／SHA 完整符合；76 首 BGM 與 83 個 game01 音效完整解碼、沒有全靜音。此為訊號／解碼檢查，不代表主觀聽感或實體手機聆聽測試。

| 場景 | 代表曲目 ID |
| --- | --- |
| 大廳／航海／島嶼 | `becoming_pirate_king`／`to_the_ocean`／`landing_at_town` |
| 冷熱島 | `grand_line_cold_island`／`grand_line_hot_island` |
| 商店／酒館／醫院 | `oden_store`／`sanjis_feast`／`chopper` |
| 研究／約克／水之七島 | `miss_allsunday`／`uunan_stone`／`village_harbor` |
| 海格寶藏／危險 | `gold_uunan`／`difficult` |
| 推進城／警報 | `stealth_night_shadow`／`one_hour_evacuation` |
| 普通戰／切磋／Boss | `fight_continues`／`duel`／`shinkenshoubu` |
| 頂上戰爭／最終戰 | `cant_escape_fight`／`cant_lose` |
| 勝利／失敗／劇情 | `we_did_it`／`mother_sea`／`reliable_friend` |

操作音效取自既有 `audio/board_game/sfx/game01/game01/` 的 button01a／button02a／button03a／button04a、select03、coin01、powerup01、powerdown02。原資料夾 `read me.txt` 保留作者小森平的素材說明。

## 驗證與發布

隔離 `PORT=18925 npm start`，使用既有 `board_move_fx_qa_isolation.js` 與 `D:/Codex_QA/board-audio-20260921/isolated-data`；沒有操作正式資料庫或存檔。證據均放在 `D:/Codex_QA/board-audio-20260921/`。

- `scripts/board_audio_ui_qa.js`：54/54，真 Chromium 手勢、8 MP3 解碼、靜音保存、父子共用、節流、錯誤備援與四尺寸設定面板。
- `scripts/board_audio_scene_qa.js`：126/126，場景路由、24 海格、短場景取消、同事件去重、實際 chooser／manager 轉場。去重記錄限最近 256 筆；戰鬥獎勵按事件 ID 區分，本機酒館招募結果與觀看方皆播一次獎勵音效。
- `scripts/board_bgm_continuity_qa.js`：既有連貫性與新增四組音轨生命週期回歸通過，涵蓋切歌靜音、舊曲音量／focus、快速選曲／stop、延遲載入取消。
- `scripts/board_audio_browser_qa.js`：本機 94/94，JavaScript 錯誤 0；22 首實際 MP3 播放進度前進、10 種音效每次單一 source 且輸出波形非零。同曲不重播、快速切換保留最後請求、404 時保留舊曲；八頁、桌機／手機直式／橫式、popover／Escape／焦點及實際 fixed wrapper 父子音訊共用通過。另修正既有選單的通用按鈕事件自動收起聲音設定；10 張截圖留存並目視抽查。
- `scripts/lan_refresh_flow_qa.js`：隔離雙頁 LAN 建房／加入／開局、訪客重整、交棒／戰鬥回歸通過，errors／failures 空。
- 真 Chrome 最後追加切歌靜音專項 4/4：先確認新舊 MP3 同時播放，立即暫停後 650ms 全部停止或無聲，恢復只播新曲；證據 `browser-transition/board-audio-browser-report.json`。原 94 項報告保留。
- `scripts/build_board_audio_release.js`／`scripts/board_audio_release_builder_qa.js`：固定基線，凍結 Git HEAD 的 43 程式與兩個 web-only 音樂室檔案；僅准兩個新增程式及本次 11 個既有程式變更，保留所有媒體／Card／Chess／v2；只在 explicit promote 寫正式 metadata。隔離 fixture 最終 41/41，涵蓋來源污染、候選竄改、清單限制及 no-write inspect。

來源提交 `b1a2e5705259bded123fc1ff11050cb8f9706f9a`。候選已依提交內容凍結、驗證及提升為 Board `package-866f9d61a53eca35`，manifest SHA256 `e87d3e98fe27610f25d292fb3e595b6bfa8cefd44dff13d60c9e8bc644d67b75`；4,155 檔、1,397,169,339 bytes，13 個程式變更，沒有新增／修改媒體。兩個 web-only 音樂室檔案同樣凍結與 SHA 核對。Card／Chess、v2 及所有舊媒體保持。

R2、正式 HTTP 與部署後保護檔驗證待實際發布完成後補記；發布前 27 份保護檔 size／SHA 全部相符。
