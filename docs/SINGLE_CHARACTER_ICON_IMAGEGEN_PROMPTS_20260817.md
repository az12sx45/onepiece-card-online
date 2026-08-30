# 單字代用圖示 ImageGen 提示詞（2026-08-17）

## 共通規格

- 模式：全新產圖；風格參考正式無外框招式圖示 `public/images/board/move_learn_ui/move_type_icons/`。
- 畫風：深色海洋、古金海賊 RPG、清楚的中央剪影、金屬與能量光效；縮到 24～64px 仍能立即辨認。
- 禁止：任何中文字、英文字母、數字、外框、圓環、徽章底盤、卡片、牌匾、角飾、青色寶石與水印。
- 構圖：每格只放一個獨立圖示，置中、四周安全留白一致，不互相碰觸或跨格。
- 原始圖保存在各正式目錄的 `incoming/`；`scripts/prepare_single_character_replacement_icons.js` 會切格、移除與畫布邊緣相連的中性色底，再依有效 Alpha 圖案裁切、保留安全留白並光學置中於 256×256 透明畫布，輸出 lossless Alpha WebP。正式頁不得引用 `incoming/`。

## 1. 六項修行能力圖示

參考圖：`public/images/board/move_learn_ui/move_type_icons/physical_attack.webp`

```text
Create one square 3 columns by 2 rows sprite sheet containing exactly six isolated, centered, frameless pirate fantasy RPG stat icons. Match the established One Piece board-game UI icons: rich painted metal, crisp readable silhouettes, luminous energy, dark-ocean and antique-gold color language, high contrast at small size. Row 1 left to right: HP as a vivid crimson heart with a small life pulse; Attack as a crossed cutlass and clenched fist with red-orange impact energy; Defense as a heavy steel shield with blue impact sparks. Row 2 left to right: Special Attack as a purple-blue arcane blast orb; Special Defense as a blue-violet ward shield resisting magic; Speed as a turquoise winged boot with wind streaks. Every cell contains only its own symbol. No text, no letters, no numbers, no borders, no circles, no plaques, no card frames, no black bases, no decorative gemstones, no watermark. Keep consistent scale and safe margins for later square cropping.
```

原圖：`public/images/board/training_ui/stat_icons/incoming/training_stat_icons_sprite_imagegen_source_v1.png`

正式輸出：`hp.webp`、`atk.webp`、`def.webp`、`satk.webp`、`sdef.webp`、`spd.webp`

## 2. 五項船隻永久升級圖示

```text
Create one square 3 columns by 2 rows sprite sheet for a nautical pirate RPG interface, with exactly five finished frameless icons and the sixth cell empty. Use richly painted brass, weathered wood, teal sea energy and strong readable silhouettes, matching the existing formal move-type icons. Row 1 left to right: a billowing reinforced sail, a wooden-and-brass ship rudder, a tall crow's-nest watchtower with a spyglass. Row 2 left to right: a compact ship galley kitchen with steaming pot and flame, a rugged deck training station with practice dummy and crossed training weapons, final cell completely empty. No text, letters, numbers, frames, circles, plaques, black bases, gemstones or watermark. One centered isolated object per cell, consistent size and generous transparent-safe margins.
```

原圖：`public/images/board/ship_info_ui/upgrade_icons/incoming/ship_upgrade_icons_sprite_imagegen_source_v1.png`

正式輸出：`sail.webp`、`rudder.webp`、`watchtower.webp`、`kitchen.webp`、`training.webp`

## 3. 司法島突破補給圖示

```text
Create one square 3 by 3 sprite sheet containing exactly nine frameless reward icons for a dramatic pirate RPG raid roulette. Antique-gold metallic rendering, dark navy shadows, cyan and red energy accents, crisp silhouettes readable at tiny size. Row 1: healing as a red heart with green restorative glow; PP recovery as a blue energy flask with bright liquid; attack boost as a red-orange clenched fist with impact burst. Row 2: defense boost as a steel shield; speed boost as a turquoise winged boot with wind; barrier as a luminous cyan protective dome. Row 3: revival as a golden phoenix feather with green life spark; burst as a fiery red-gold explosion; unknown reward as a closed mysterious treasure chest with cyan glow. No text, letters, numbers, frames, rings, plaques, card backgrounds, black bases, gemstones or watermark. Exactly one centered isolated symbol in each equal cell, no overlap across cells.
```

原圖：`public/images/board/judicial_raid_ui/reward_icons/incoming/judicial_reward_icons_sprite_imagegen_source_v1.png`

正式輸出：`heal.webp`、`pp.webp`、`attack.webp`、`defense.webp`、`speed.webp`、`shield.webp`、`revive.webp`、`burst.webp`、`unknown.webp`

## 4. 推進城事件圖示

```text
Create one square 3 columns by 2 rows sprite sheet for a dark prison pirate RPG, with exactly five finished frameless event icons and the sixth cell empty. Match the formal board-game icon style: painted metal, dark navy shadows, antique gold, poisonous violet, cyan highlights, readable silhouettes. Row 1 left to right: prison patrol as crossed guard spears with a watchful red eye; prison key as a heavy antique golden jail key; Magellan encounter as a horned purple poison skull with dripping venom. Row 2 left to right: Ivankov rescue as a dramatic pink-purple stage spotlight and liberation star; hidden prisoner as a shadowed prisoner silhouette behind broken chains; final cell completely empty. No character names, no text, no letters, no numbers, no frames, circles, plaques, black bases, decorative gemstones or watermark. One isolated centered symbol per cell with uniform scale and safe margins.
```

原圖：`public/images/board/impel_down_ui/event_icons/incoming/impel_event_icons_sprite_imagegen_source_v1.png`

正式輸出：`patrol.webp`、`key.webp`、`magellan.webp`、`ivankov.webp`、`hidden.webp`；`unknown.webp` 共用司法島神秘寶箱圖示。

## 5. 力／速／技／無屬性圖示

```text
Create one square 2 by 2 sprite sheet containing exactly four frameless combat attribute icons for a high-end pirate RPG. Match the established formal move-type icon family, with crisp painted silhouettes and energetic lighting. Top left Force: a powerful crimson clenched fist with orange impact lightning. Top right Speed: a turquoise winged boot with sharp wind trails. Bottom left Technique: a luminous blue-gold compass and precision blade motif, elegant and tactical. Bottom right Neutral: a balanced antique-gold compass rose with soft white-cyan glow and no elemental bias. No text, no Chinese characters, no letters, no numbers, no borders, no rings used as UI frames, no plaques, no black bases, no gemstones or watermark. Center one isolated symbol in each equal cell, consistent visual weight and safe margins.
```

原圖：`public/images/board/attribute_icons/incoming/attribute_icons_sprite_imagegen_source_v1.png`

正式輸出：`force.webp`、`speed.webp`、`technique.webp`、`neutral.webp`

## 接入補充

- 船團概要與全圖鑑摘要直接重用既有正式圖片，不再另生相似素材：懸賞任務、歷史本文、貝里、船員圖鑑、已遇見、已擊敗及因子／培育。
- 地圖主航路關口、黑色遭遇格、未知島嶼、推進城／司法島／醫院圖片備援、黃金票與指定步數券備援也改用正式圖片。
- 骰面數字、S～E 階級、Lv、回合數、線索撲克牌牌面及未解鎖圖鑑 `????` 是實際資料，不屬於單字代用圖示，必須保留。
