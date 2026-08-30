# 戰鬥相反方向受擊圖生成進度

更新日期：2026-08-14

本文件追蹤 One Piece Board 正式戰鬥角色的相反方向受擊素材。加入魔人歐斯後共 150 張圖片已全部完成；角色資料提供 `hitPlayerSide`／`hitEnemySide`，`board_game.js` 的既有戰鬥演出與 `board_battle.js` 的獨立戰鬥頁都依本場實際站位選擇受擊圖，不以角色原始來源陣營硬判。

## 掃描與命名規格

- 合格來源須在同一資料夾內具有非空的 `normal.webp`、`angry.webp`、`hit.webp`、`morale.webp`、`weak.webp`、`dizzy.webp` 六張圖。
- 玩家與玩家進化的新圖名為 `hit_enemy.webp`：衝擊由 viewer-left 進入，打中畫面左側臉頰，頭部朝 viewer-right 反應。
- 敵人的新圖名為 `hit_player.webp`：衝擊由 viewer-right 進入，打中畫面右側臉頰，頭部朝 viewer-left 反應。
- 產圖時以原 `hit.webp` 為主要編輯底圖，另以五格接觸表同時提供其餘五張正式狀態圖，避免把角色整張鏡像而翻錯文字、刺青、疤痕、配件、武器或背景。
- 產圖先放入 `public/images/board/battle/opposite_hit_incoming/` 對應相對路徑，逐張並排檢查後才移入正式角色資料夾；正式戰鬥不引用收件區，只引用角色／進化資料夾內的 `hit_enemy.webp` 與敵人資料夾內的 `hit_player.webp`。

## 進度摘要

| 分類 | 合格來源 | 已驗證 | 待生成／驗證 |
| --- | ---: | ---: | ---: |
| 玩家 | 51 | 51 | 0 |
| 玩家進化 | 32 | 32 | 0 |
| 敵人 | 67 | 67 | 0 |
| **合計** | **150** | **150** | **0** |

狀態定義：`verified` 表示已生成、轉為真正 WebP、尺寸與原 `hit.webp` 一致，且已完成人工方向／角色細節比對；`pending` 表示尚未生成或尚未驗證。

## 完整項目表

以下路徑皆相對於 `public/images/board/battle/`。

| 分類 | 資料夾 | 原始圖 | 新圖片 | 輸出尺寸 | 狀態 | 檢查備註 |
| --- | --- | --- | --- | --- | --- | --- |
| 玩家 | `portraits/ace/` | `portraits/ace/hit.webp` | `portraits/ace/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；ASCE 刺青、配件與背景已比對 |
| 玩家 | `portraits/bartolomeo/` | `portraits/bartolomeo/hit.webp` | `portraits/bartolomeo/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；臉／胸刺青、服裝與武器已比對 |
| 玩家 | `portraits/brook/` | `portraits/brook/hit.webp` | `portraits/brook/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；骷髏特徵、禮帽與手杖已比對 |
| 玩家 | `portraits/carrot/` | `portraits/carrot/hit.webp` | `portraits/carrot/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；耳朵、披風、手套與服裝已比對 |
| 玩家 | `portraits/cavendish/` | `portraits/cavendish/hit.webp` | `portraits/cavendish/hit_enemy.webp` | 1086×1448 | `verified` | 已重生；帽帶方向與配劍側已比對 |
| 玩家 | `portraits/chopper/` | `portraits/chopper/hit.webp` | `portraits/chopper/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；帽上 X、鹿角束帶與蹄已比對 |
| 玩家 | `portraits/corazon/` | `portraits/corazon/hit.webp` | `portraits/corazon/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；眼妝、香菸、愛心上衣與兜帽已比對 |
| 玩家 | `portraits/dragon/` | `portraits/dragon/hit.webp` | `portraits/dragon/hit_enemy.webp` | 1086×1448 | `verified` | 已重生；viewer-left 臉部刺青保留，披風已比對 |
| 玩家 | `portraits/franky/` | `portraits/franky/hit.webp` | `portraits/franky/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/fujitora/` | `portraits/fujitora/hit.webp` | `portraits/fujitora/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/garp/` | `portraits/garp/hit.webp` | `portraits/garp/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/hancock/` | `portraits/hancock/hit.webp` | `portraits/hancock/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/ivankov/` | `portraits/ivankov/hit.webp` | `portraits/ivankov/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/izo/` | `portraits/izo/hit.webp` | `portraits/izo/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/jinbe/` | `portraits/jinbe/hit.webp` | `portraits/jinbe/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/jozu/` | `portraits/jozu/hit.webp` | `portraits/jozu/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/kid/` | `portraits/kid/hit.webp` | `portraits/kid/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/killer/` | `portraits/killer/hit.webp` | `portraits/killer/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/kinemon/` | `portraits/kinemon/hit.webp` | `portraits/kinemon/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/koby/` | `portraits/koby/hit.webp` | `portraits/koby/hit_enemy.webp` | 1086×1449 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/kuma/` | `portraits/kuma/hit.webp` | `portraits/kuma/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/kuzan/` | `portraits/kuzan/hit.webp` | `portraits/kuzan/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/law/` | `portraits/law/hit.webp` | `portraits/law/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/little_oars_jr/` | `portraits/little_oars_jr/hit.webp` | `portraits/little_oars_jr/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/luffy/` | `portraits/luffy/hit.webp` | `portraits/luffy/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/mansherry/` | `portraits/mansherry/hit.webp` | `portraits/mansherry/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/marco/` | `portraits/marco/hit.webp` | `portraits/marco/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/mihawk/` | `portraits/mihawk/hit.webp` | `portraits/mihawk/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/nami/` | `portraits/nami/hit.webp` | `portraits/nami/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/oden/` | `portraits/oden/hit.webp` | `portraits/oden/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/perona/` | `portraits/perona/hit.webp` | `portraits/perona/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/prison_buggy/` | `portraits/prison_buggy/hit.webp` | `portraits/prison_buggy/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/prison_crocodile/` | `portraits/prison_crocodile/hit.webp` | `portraits/prison_crocodile/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/prison_mr1_daz_bones/` | `portraits/prison_mr1_daz_bones/hit.webp` | `portraits/prison_mr1_daz_bones/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/prison_mr2_bon_clay/` | `portraits/prison_mr2_bon_clay/hit.webp` | `portraits/prison_mr2_bon_clay/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/prison_mr3/` | `portraits/prison_mr3/hit.webp` | `portraits/prison_mr3/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/rayleigh/` | `portraits/rayleigh/hit.webp` | `portraits/rayleigh/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/robin/` | `portraits/robin/hit.webp` | `portraits/robin/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/roger/` | `portraits/roger/hit.webp` | `portraits/roger/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/sabo/` | `portraits/sabo/hit.webp` | `portraits/sabo/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/sanji/` | `portraits/sanji/hit.webp` | `portraits/sanji/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/smoker/` | `portraits/smoker/hit.webp` | `portraits/smoker/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/squard/` | `portraits/squard/hit.webp` | `portraits/squard/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/tashigi/` | `portraits/tashigi/hit.webp` | `portraits/tashigi/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/usopp/` | `portraits/usopp/hit.webp` | `portraits/usopp/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/uta/` | `portraits/uta/hit.webp` | `portraits/uta/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/vista/` | `portraits/vista/hit.webp` | `portraits/vista/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/vivi/` | `portraits/vivi/hit.webp` | `portraits/vivi/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/whitebeard/` | `portraits/whitebeard/hit.webp` | `portraits/whitebeard/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/yamato/` | `portraits/yamato/hit.webp` | `portraits/yamato/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家 | `portraits/zoro/` | `portraits/zoro/hit.webp` | `portraits/zoro/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/brook_yomi_swordsman/` | `portraits/evolutions/brook_yomi_swordsman/hit.webp` | `portraits/evolutions/brook_yomi_swordsman/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/carrot_moon_lion/` | `portraits/evolutions/carrot_moon_lion/hit.webp` | `portraits/evolutions/carrot_moon_lion/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/chopper_evolution_2/` | `portraits/evolutions/chopper_evolution_2/hit.webp` | `portraits/evolutions/chopper_evolution_2/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/chopper_rumble_ball_plus/` | `portraits/evolutions/chopper_rumble_ball_plus/hit.webp` | `portraits/evolutions/chopper_rumble_ball_plus/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/franky_weapon_left/` | `portraits/evolutions/franky_weapon_left/hit.webp` | `portraits/evolutions/franky_weapon_left/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/kid_new_world/` | `portraits/evolutions/kid_new_world/hit.webp` | `portraits/evolutions/kid_new_world/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/koby_colonel/` | `portraits/evolutions/koby_colonel/hit.webp` | `portraits/evolutions/koby_colonel/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/kuzan_evolution_1/` | `portraits/evolutions/kuzan_evolution_1/hit.webp` | `portraits/evolutions/kuzan_evolution_1/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/law_new_world/` | `portraits/evolutions/law_new_world/hit.webp` | `portraits/evolutions/law_new_world/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/luffy_evolution_2/` | `portraits/evolutions/luffy_evolution_2/hit.webp` | `portraits/evolutions/luffy_evolution_2/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/luffy_gear_fifth/` | `portraits/evolutions/luffy_gear_fifth/hit.webp` | `portraits/evolutions/luffy_gear_fifth/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/luffy_gear_second/` | `portraits/evolutions/luffy_gear_second/hit.webp` | `portraits/evolutions/luffy_gear_second/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/mihawk_evolution_1/` | `portraits/evolutions/mihawk_evolution_1/hit.webp` | `portraits/evolutions/mihawk_evolution_1/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/nami_clima_tact_plus/` | `portraits/evolutions/nami_clima_tact_plus/hit.webp` | `portraits/evolutions/nami_clima_tact_plus/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/nami_evolution_2/` | `portraits/evolutions/nami_evolution_2/hit.webp` | `portraits/evolutions/nami_evolution_2/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/perona_new_world/` | `portraits/evolutions/perona_new_world/hit.webp` | `portraits/evolutions/perona_new_world/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/prison_buggy_escape_alliance/` | `portraits/evolutions/prison_buggy_escape_alliance/hit.webp` | `portraits/evolutions/prison_buggy_escape_alliance/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/prison_crocodile_desert_alliance/` | `portraits/evolutions/prison_crocodile_desert_alliance/hit.webp` | `portraits/evolutions/prison_crocodile_desert_alliance/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/prison_mr1_steel_blade/` | `portraits/evolutions/prison_mr1_steel_blade/hit.webp` | `portraits/evolutions/prison_mr1_steel_blade/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/prison_mr3_candle_strategist/` | `portraits/evolutions/prison_mr3_candle_strategist/hit.webp` | `portraits/evolutions/prison_mr3_candle_strategist/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/rayleigh_young/` | `portraits/evolutions/rayleigh_young/hit.webp` | `portraits/evolutions/rayleigh_young/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/robin_cien_fleur/` | `portraits/evolutions/robin_cien_fleur/hit.webp` | `portraits/evolutions/robin_cien_fleur/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/roger_evolution_1/` | `portraits/evolutions/roger_evolution_1/hit.webp` | `portraits/evolutions/roger_evolution_1/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/sanji_diable_jambe/` | `portraits/evolutions/sanji_diable_jambe/hit.webp` | `portraits/evolutions/sanji_diable_jambe/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/sanji_evolution_2/` | `portraits/evolutions/sanji_evolution_2/hit.webp` | `portraits/evolutions/sanji_evolution_2/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/smoker_new_world/` | `portraits/evolutions/smoker_new_world/hit.webp` | `portraits/evolutions/smoker_new_world/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/tashigi_new_world/` | `portraits/evolutions/tashigi_new_world/hit.webp` | `portraits/evolutions/tashigi_new_world/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/usopp_evolution_2/` | `portraits/evolutions/usopp_evolution_2/hit.webp` | `portraits/evolutions/usopp_evolution_2/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/usopp_sogeking/` | `portraits/evolutions/usopp_sogeking/hit.webp` | `portraits/evolutions/usopp_sogeking/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/whitebeard_evolution_1/` | `portraits/evolutions/whitebeard_evolution_1/hit.webp` | `portraits/evolutions/whitebeard_evolution_1/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/zoro_evolution_2/` | `portraits/evolutions/zoro_evolution_2/hit.webp` | `portraits/evolutions/zoro_evolution_2/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 玩家進化 | `portraits/evolutions/zoro_santoryu_plus/` | `portraits/evolutions/zoro_santoryu_plus/hit.webp` | `portraits/evolutions/zoro_santoryu_plus/hit_enemy.webp` | 1086×1448 | `verified` | viewer-left 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/akainu/` | `enemies/akainu/hit.webp` | `enemies/akainu/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/alvida/` | `enemies/alvida/hit.webp` | `enemies/alvida/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/aokiji/` | `enemies/aokiji/hit.webp` | `enemies/aokiji/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/arlong/` | `enemies/arlong/hit.webp` | `enemies/arlong/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/axe_hand_morgan/` | `enemies/axe_hand_morgan/hit.webp` | `enemies/axe_hand_morgan/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/bellamy/` | `enemies/bellamy/hit.webp` | `enemies/bellamy/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/blueno/` | `enemies/blueno/hit.webp` | `enemies/blueno/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/buggy/` | `enemies/buggy/hit.webp` | `enemies/buggy/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/cabaji/` | `enemies/cabaji/hit.webp` | `enemies/cabaji/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/caesar_clown/` | `enemies/caesar_clown/hit.webp` | `enemies/caesar_clown/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/crocodile/` | `enemies/crocodile/hit.webp` | `enemies/crocodile/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/doflamingo/` | `enemies/doflamingo/hit.webp` | `enemies/doflamingo/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/enel/` | `enemies/enel/hit.webp` | `enemies/enel/hit_player.webp` | 1085×1449 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/final_imu/` | `enemies/final_imu/hit.webp` | `enemies/final_imu/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/foxy/` | `enemies/foxy/hit.webp` | `enemies/foxy/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/gecko_moria/` | `enemies/gecko_moria/hit.webp` | `enemies/gecko_moria/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/gin/` | `enemies/gin/hit.webp` | `enemies/gin/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/god_knight_killingham/` | `enemies/god_knight_killingham/hit.webp` | `enemies/god_knight_killingham/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/god_knight_sommers/` | `enemies/god_knight_sommers/hit.webp` | `enemies/god_knight_sommers/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/hatchan/` | `enemies/hatchan/hit.webp` | `enemies/hatchan/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/hody_jones/` | `enemies/hody_jones/hit.webp` | `enemies/hody_jones/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/impel_l1_sadie/` | `enemies/impel_l1_sadie/hit.webp` | `enemies/impel_l1_sadie/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/impel_l2_minochihuahua/` | `enemies/impel_l2_minochihuahua/hit.webp` | `enemies/impel_l2_minochihuahua/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/impel_l3_minokoala/` | `enemies/impel_l3_minokoala/hit.webp` | `enemies/impel_l3_minokoala/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/impel_l4_minotaur/` | `enemies/impel_l4_minotaur/hit.webp` | `enemies/impel_l4_minotaur/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/impel_l5_minorhino/` | `enemies/impel_l5_minorhino/hit.webp` | `enemies/impel_l5_minorhino/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/impel_l6_hannyabal/` | `enemies/impel_l6_hannyabal/hit.webp` | `enemies/impel_l6_hannyabal/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/jabra/` | `enemies/jabra/hit.webp` | `enemies/jabra/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/kaku/` | `enemies/kaku/hit.webp` | `enemies/kaku/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/kalifa/` | `enemies/kalifa/hit.webp` | `enemies/kalifa/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/kizaru/` | `enemies/kizaru/hit.webp` | `enemies/kizaru/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/krieg/` | `enemies/krieg/hit.webp` | `enemies/krieg/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/kuro/` | `enemies/kuro/hit.webp` | `enemies/kuro/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/kuroobi/` | `enemies/kuroobi/hit.webp` | `enemies/kuroobi/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/magellan/` | `enemies/magellan/hit.webp` | `enemies/magellan/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/miss_valentine/` | `enemies/miss_valentine/hit.webp` | `enemies/miss_valentine/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/mohji/` | `enemies/mohji/hit.webp` | `enemies/mohji/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/mr1_daz_bones/` | `enemies/mr1_daz_bones/hit.webp` | `enemies/mr1_daz_bones/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/mr2_bon_clay/` | `enemies/mr2_bon_clay/hit.webp` | `enemies/mr2_bon_clay/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/mr3/` | `enemies/mr3/hit.webp` | `enemies/mr3/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/mr5/` | `enemies/mr5/hit.webp` | `enemies/mr5/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/pica/` | `enemies/pica/hit.webp` | `enemies/pica/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/postgame_aramaki/` | `enemies/postgame_aramaki/hit.webp` | `enemies/postgame_aramaki/hit_player.webp` | 1024×1536 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/postgame_charlotte_katakuri/` | `enemies/postgame_charlotte_katakuri/hit.webp` | `enemies/postgame_charlotte_katakuri/hit_player.webp` | 1024×1536 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/postgame_douglas_bullet/` | `enemies/postgame_douglas_bullet/hit.webp` | `enemies/postgame_douglas_bullet/hit_player.webp` | 1024×1536 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/postgame_gild_tesoro/` | `enemies/postgame_gild_tesoro/hit.webp` | `enemies/postgame_gild_tesoro/hit_player.webp` | 1024×1536 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/postgame_king/` | `enemies/postgame_king/hit.webp` | `enemies/postgame_king/hit_player.webp` | 1024×1536 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/postgame_loki/` | `enemies/postgame_loki/hit.webp` | `enemies/postgame_loki/hit_player.webp` | 1024×1536 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/postgame_oars/` | `enemies/postgame_oars/hit.webp` | `enemies/postgame_oars/hit_player.webp` | 1024×1536 | `verified` | `hit.webp` 由 viewer-left 衝擊並向 viewer-right 後仰；`hit_player.webp` 由 viewer-right 衝擊並向 viewer-left 後仰；兩張都不是歐斯出拳圖 |
| 敵人 | `enemies/postgame_patrick_redfield/` | `enemies/postgame_patrick_redfield/hit.webp` | `enemies/postgame_patrick_redfield/hit_player.webp` | 1024×1536 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/postgame_rob_lucci_awakened/` | `enemies/postgame_rob_lucci_awakened/hit.webp` | `enemies/postgame_rob_lucci_awakened/hit_player.webp` | 1024×1536 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/postgame_rocks/` | `enemies/postgame_rocks/hit.webp` | `enemies/postgame_rocks/hit_player.webp` | 1024×1536 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/postgame_saga/` | `enemies/postgame_saga/hit.webp` | `enemies/postgame_saga/hit_player.webp` | 1024×1536 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/postgame_shiki/` | `enemies/postgame_shiki/hit.webp` | `enemies/postgame_shiki/hit_player.webp` | 1024×1536 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/postgame_tot_musica/` | `enemies/postgame_tot_musica/hit.webp` | `enemies/postgame_tot_musica/hit_player.webp` | 1024×1536 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/postgame_vinsmoke_judge/` | `enemies/postgame_vinsmoke_judge/hit.webp` | `enemies/postgame_vinsmoke_judge/hit_player.webp` | 1024×1536 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/postgame_zephyr/` | `enemies/postgame_zephyr/hit.webp` | `enemies/postgame_zephyr/hit_player.webp` | 1024×1536 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/rob_lucci/` | `enemies/rob_lucci/hit.webp` | `enemies/rob_lucci/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/sengoku/` | `enemies/sengoku/hit.webp` | `enemies/sengoku/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/sentomaru/` | `enemies/sentomaru/hit.webp` | `enemies/sentomaru/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/spandam/` | `enemies/spandam/hit.webp` | `enemies/spandam/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/wapol/` | `enemies/wapol/hit.webp` | `enemies/wapol/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/yonko_bigmom/` | `enemies/yonko_bigmom/hit.webp` | `enemies/yonko_bigmom/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/yonko_blackbeard/` | `enemies/yonko_blackbeard/hit.webp` | `enemies/yonko_blackbeard/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/yonko_kaido/` | `enemies/yonko_kaido/hit.webp` | `enemies/yonko_kaido/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/yonko_kaido_phase2/` | `enemies/yonko_kaido_phase2/hit.webp` | `enemies/yonko_kaido_phase2/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |
| 敵人 | `enemies/yonko_shanks/` | `enemies/yonko_shanks/hit.webp` | `enemies/yonko_shanks/hit_player.webp` | 1086×1448 | `verified` | viewer-right 衝擊；方向、角色身份與固定細節已比對 |

## 不合格來源（略過）

| 分類 | 資料夾 | 原因 | 狀態 |
| --- | --- | --- | --- |
| 玩家 | `portraits/placeholder/` | 只有非空 `normal.webp`；缺少 `angry.webp`、`hit.webp`、`morale.webp`、`weak.webp`、`dizzy.webp` | `skipped` |
| 玩家進化 | `portraits/evolutions/uta_evolution_1/` | 六張狀態檔均為空檔，不能作正式參考 | `skipped` |
| 敵人 | `enemies/lucci/` | 六張狀態檔均為空檔，不能作正式參考；正式非空路徑為 `enemies/rob_lucci/` | `skipped` |

## 批次紀錄

### 2026-07-30：全部完成

- 已完成 149 張正式相反方向受擊圖：玩家 51 張、玩家進化 32 張、敵人 66 張；待生成／驗證為 0。
- 玩家與進化使用 `hit_enemy.webp`（viewer-left 入射、頭部向 viewer-right 反應）；敵人使用 `hit_player.webp`（viewer-right 入射、頭部向 viewer-left 反應）。
- 每張候選先進 `opposite_hit_incoming/`，以來源 `hit.webp` 與五狀態接觸表逐張比對後才移入正式資料夾；最終 incoming 檔案數為 0。
- 需要重生或局部修正後才驗收的代表項目包含：`cavendish`、`dragon`、`fujitora`、`izo`、`law`、`prison_buggy`、`sanji`、`vivi`、兩個 Sanji 進化、`akainu`、`alvida`、`arlong`、`axe_hand_morgan`、`blueno`、`final_imu`、`hody_jones`、`impel_l1_sadie`、`mr2_bon_clay`、`postgame_shiki`、`sengoku`、`spandam`、`yonko_blackbeard`、`yonko_shanks`；未通過稿未移入正式資料夾。
- 最終機器驗證重新依六張非空狀態檔掃描：149 張輸出全部可解碼為 RGB WebP，且尺寸與各自來源 `hit.webp` 完全一致；缺檔、格式、色彩模式、尺寸與解碼錯誤均為 0。
- 略過來源維持 3 組：`portraits/placeholder/`、`portraits/evolutions/uta_evolution_1/`、`enemies/lucci/`；原因見上方不合格來源表。
- 圖片生成階段沒有修改戰鬥邏輯；其後已由下方正式接入紀錄完成站位選圖。

### 2026-07-30：正式戰鬥接入

- `board_cards.js` 的 51 名玩家與 32 種進化型態新增 `hitPlayerSide = hit.webp`、`hitEnemySide = hit_enemy.webp`；競技場最高型態快照會完整保留兩個欄位。
- `board_game.js` 的敵人 portrait 映射新增 `hitPlayerSide = hit_player.webp`、`hitEnemySide = hit.webp`；敵人血統因子培育成我方永久角色後會完整保留兩個欄位，主遊戲既有戰鬥演出也會依 `side` 取方向圖。
- `board_battle.js` 只在正式 `hit` 狀態依當前 `side` 選擇方向圖；玩家側取 `hitPlayerSide`、敵方側取 `hitEnemySide`。舊快照沒有新欄位時仍依序回退 `hit`、`hurt`、`normal`、`idle`。
- 其他 `normal`、`angry`、`morale`、`weak`、`dizzy` 圖、能力數值、招式、回合、CPU、觀看方、存檔及 `BOARD_GAME_STATE` 均未改。

### 2026-08-14：魔人歐斯補入與受擊方向修正

- 歐斯七態重畫為完整 1024×1536 RGB WebP，背景直接畫滿四邊，不再用模糊放大、羽化或鏡像背景補邊。
- `hit.webp` 是歐斯位於敵方右側時承受 viewer-left 入射；`hit_player.webp` 是歐斯培育成我方、位於左側時承受 viewer-right 入射。兩張皆以頭部與上身向相反方向震開表現受擊，沒有出拳、施法或主動攻擊姿勢。
- 正式七態維持同一個低角度、頭部到腰間三顆骷髏的構圖比例；桌機與手機實際框內顯示無模糊殘影、裁頭或 viewport overflow。
