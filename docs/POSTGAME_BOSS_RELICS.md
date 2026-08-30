# 全破後 Boss 攜帶物正式資料與洛克斯掉落規格（2026-08-02）

## 狀態

- 14 件 Boss 攜帶物均已在 `public/js/board_items.js` 建立正式 S 階持有型道具資料、效果參數、名稱與圖片映射；完整 id 為 `held_postgame_boss_relic_` 加上下表圖片檔名去除 `.webp`。它們不會被自動加入一般戰鬥隨機掉落池。
- 2026-08-01 已完成 14 張正式黑底 1:1 WebP 道具圖，2026-08-02 已由正式資料引用。史基至綠牛的前十三名 Boss 每次勝利會對每位實際參戰者各自進行固定 10% 專屬攜帶物判定；觀看方不判定，同場同玩家不重送或重抽，重複挑戰可再判定，且全部不可交易。
- 名刀「日蝕」的基礎掉落率為 10%；個人約克座標解碼器一階／二階／三階各再增加 10%，因此最終為 10%／20%／30%／40%。洛克斯每次勝利仍按每位實際參戰者自己的階級獨立判定，且不改動完美血統核心、25 研究點數、私人血統抽取、首次外觀框或離島重戰。
- 覺醒黑焰羽衣的正式效果改為速度與最大生命各 +30%，裝備或卸下時會依原生命比例換算目前 HP。名刀「日蝕」使裝備者攻擊與特攻各 +20%；只有戰鬥型被動已成功追加第二顆骰子時，才依第一顆追加門檻 6／5／4，要求第二顆骰到 5／3／1 以上並追加第三顆。三顆相加後，12 點為 ×2.05，13～18 點每點增加 ×0.15，依序為 ×2.20／×2.35／×2.50／×2.65／×2.80／×2.95。
- 伽治掉落的戰鬥服正式圖依最新指定使用香吉士「隱形黑」尚未啟動的黑色 `3` 號封存罐；已展開戰鬥服與金色 `66` 封存罐只保留在 `incoming/` 作來源紀錄。
- 2026-08-24 巴雷特掉落物保留相容 id `bullet_large_bullet_armor`，但正式名稱／效果改為「巴雷特的武器庫」；舊大型子彈號裝甲圖留存，正式頁改用新的武器庫圖。巴雷特戰吸收此物時只取得空外殼，內裝兩件不給 Boss 效果，並在原持有人端連最大 HP 等能力一併封存至該孔被破壞後才恢復生效。
- 2026-08-26 補齊櫻十・木枯、黃金戒、Battle Smasher、魔王樂譜、七星劍、KING 佩刀、土龍、傘劍、Ragnir 與生命種子十件的玩家端正式效果；單獨攜帶與裝入巴雷特武器庫均生效並各自保存 runtime。專項 QA 36／36、全量兵裝效果處理 93／93。
- 2026-08-26 暴擊 V322 再讓櫻十・木枯增加 5% 暴擊、赤色伯爵的傘劍增加 0.1 暴擊傷害倍率；格里芬之劍另增加 0.2 倍率。三者皆使用通用兵裝 context，單件、武器庫內裝與巴雷特吸收孔位均生效，最終暴擊傷害倍率上限 ×2。
- 2026-08-26 V324 將暴擊限定為目前位於我方的角色：巴雷特吸收櫻十・木枯、格里芬之劍、赤色伯爵的傘劍或其他暴擊兵裝時仍可保留其非暴擊效果，但不會取得暴擊率／暴擊傷害；孔位破壞並歸還玩家後，原本的暴擊效果才恢復。原敵方角色被招募到我方後亦依自己的 profile 正常暴擊。

## 名稱與效果

| Boss | 道具名稱 | 目前確認效果 | 正式圖片 |
| --- | --- | --- | --- |
| 史基 | 櫻十・木枯 | 速度、物攻各 +20%，暴擊 +5%；每場第一次受到直接攻擊時，整個多段招式傷害降低 40%，換人不重置。 | `public/images/board/items/postgame_boss_relics/shiki_oto_kogarashi.webp` |
| 泰佐洛 | Gran Tesoro 黃金戒 | 每個造成傷害的直接招式累積一層；三層時束縛一回合，防禦、特防各 -1 並持續整場。每場一次；戰勝基礎貝里額外 +200%。 | `public/images/board/items/postgame_boss_relics/tesoro_gran_tesoro_gold_rings.webp` |
| 澤法 | Battle Smasher | 三次直接命中完成過熱；下一次直接攻擊傷害 +40%、無視 20% 防禦，命中或落空均消耗，發動後反噬最大 HP 30% 但最低留 1。 | `public/images/board/items/postgame_boss_relics/zephyr_battle_smasher.webp` |
| Tot Musica | 魔王樂譜 | 多段招式同一次行動依第 1 下 +1%、第 2 下 +2%、第 3 下 +4% 持續翻倍且無上限；新招式重算，單段不加成。 | `public/images/board/items/postgame_boss_relics/tot_musica_demon_score.webp` |
| 巴雷特 | 巴雷特的武器庫 | 占用 1 個角色攜帶物欄，可從背包固定裝入 2 件不同的其他攜帶物；兩件效果與各自觸發狀態同時生效，同一種不能重複裝入。卸下、替換武器庫或持有者離隊時，內裝物全部回到背包；不可巢狀裝入另一個武器庫。 | `public/images/board/items/postgame_boss_relics/bullet_arsenal.webp` |
| 薩卡 | 七星劍 | 每完整損失最大 HP 5%，直接攻擊傷害 +4%；接近瀕死時最多 19 階、+76%。 | `public/images/board/items/postgame_boss_relics/saga_seven_star_sword.webp` |
| 伽治 | 傑爾馬66戰鬥服 | 每場第一次受到致命傷害時，該次傷害降低 100%，防禦、速度各 +1。新世界香吉士裝備時，進入戰鬥會變身為「隱形黑」：替換七張基本狀態戰鬥圖、被動、招式與戰鬥數值，並啟動可閃避下一次敵方直接攻擊的光學迷彩；平時顯示一般隱形黑圖，只有迷彩實際使敵方攻擊 MISS 時才短暫顯示第八張 `stealth.webp` 隱形圖。正式道具圖使用尚未啟動的「隱形黑」3 號封存罐。 | `public/images/board/items/postgame_boss_relics/judge_germa66_battle_suit.webp` |
| 覺醒路基 | 覺醒黑焰羽衣 | 速度與最大生命各 +30%。 | `public/images/board/items/postgame_boss_relics/lucci_awakened_black_flame_hagoromo.webp` |
| KING | KING 的佩刀 | 開場背火，直接傷害 -25%，被直接命中後熄火；熄火時速度與下一次直接攻擊各 +25%，完成直接攻擊後才復燃。 | `public/images/board/items/postgame_boss_relics/king_sword.webp` |
| 卡塔庫栗 | 三叉戟「土龍」 | 特攻 +30%；敵人連續兩次行動使用同一直接招式時，第二次必定落空並受到最大 HP 40% 反擊。非直接行動會中斷，每場一次。 | `public/images/board/items/postgame_boss_relics/katakuri_mogura.webp` |
| 雷德菲爾德 | 赤色伯爵的傘劍 | 暴擊傷害倍率 +0.1；整個直接招式結算後回復實際總傷害 20% 一次，溢補轉為優先承傷護盾，最多最大 HP 15%。 | `public/images/board/items/postgame_boss_relics/redfield_umbrella_sword.webp` |
| 洛基 | 鐵雷「Ragnir」 | 特攻 +20%；直接傷害產生冰雲，骰 5～6 時每朵增傷 15%；第三朵生成時立即凍結一回合並清空冰雲。 | `public/images/board/items/postgame_boss_relics/loki_ragnir.webp` |
| 綠牛 | 森森生命種子 | 低於 70% HP 時回合末回復 3% 並累積種子；致命傷依 1／2／3 顆復活 12%／24%／36%，一次消耗全部，每場復活一次。 | `public/images/board/items/postgame_boss_relics/green_bull_life_seed.webp` |
| 洛克斯 | 名刀「日蝕」 | 攻擊與特攻各 +20%。戰鬥型被動追加第二顆骰子後：原門檻 6 時第二顆需 5+、原門檻 5 時需 3+、原門檻 4 時需 1+，成功便追加第三顆骰子；總點數 12 為 ×2.05，之後每點 +×0.15，18 點為 ×2.95。 | `public/images/board/items/postgame_boss_relics/rocks_eclipse_sword.webp` |

## 素材規格

- 正式圖皆為 1254×1254、RGB、真 WebP、黑色不透明背景；有損 WebP 壓縮後四角 RGB 各通道維持 0～1，視覺為純黑且沒有透明層。
- 構圖為單一物件或同組裝備置中，四周保留安全邊距；不放 UI 外框、角色、手、水印或非原物件文字。
- 原始 PNG 與被替換版本保存在 `public/images/board/items/postgame_boss_relics/incoming/`。
- 完整 ImageGen 提示詞記錄於 `public/images/board/items/postgame_boss_relics/POSTGAME_BOSS_RELIC_IMAGE_PROMPTS.md`。
