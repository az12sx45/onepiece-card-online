# Evolution Portrait Frame ImageGen Prompt

## 正式使用狀態 V364

- 正式進化 HUD 目前只引用 `public/images/board/evolution_ui/evolution_portrait_frame_v1.webp`，用途是替原本的進化前／後角色動畫加上同一張外框。
- `evolution_portrait_frame_awakened_v1.webp` 與 `evolution_portrait_frame_awakened_v2.webp` 保留作為版本紀錄，但正式頁不引用，也沒有兩階段框切換。
- 原角色與進化後角色的黑白反相閃爍、材料定位與消失時序皆使用原動畫；框不增加旋轉能量印、光柱或菱形展開。
- 角色圖在與框完全相同的響應式矩形內播放，並依框內緣裁切溢出；框素材本身未修改或覆蓋。

## 用途

本素材是 Board 正式進化 HUD 的共用角色圖透明外框，不綁定索隆十郎或單一進化材料。角色圖與材料圖由程式另外疊合，生成圖本身不得包含角色、武器、文字或背景底板。

## 生成方式

- 工具：Codex 內建 ImageGen。
- use case：`ui-mockup`。
- 生成來源：`C:/Users/王曜瑋/.codex/generated_images/01a0185f-258e-73f0-817a-35e162778d0d/exec-eb2a170a-4d3d-4692-bd55-b746fe7dde09.png`
- 來源 PNG：1086×1448 RGBA，SHA-256 `5D5135FFB2EB1305C534E7372CCB8C4C7AE79EF9D39E8D34D66F42C021565B96`。
- 正式 WebP：`public/images/board/evolution_ui/evolution_portrait_frame_v1.webp`，1086×1448 RGBA，SHA-256 `A0A342DA9AF6C5D527F58E3E675623197ACEC208C663AAA618BB61F7A84355A0`。

## 最終 Prompt

```text
Use case: ui-mockup
Asset type: production-ready transparent raster overlay for a vertical character-evolution portrait in a dark ocean pirate RPG game
Primary request: create ONE ornate portrait UI frame only, with a genuinely transparent empty center so any character image can be displayed underneath it
Composition/framing: strict vertical 3:4 canvas; frame follows the outer perimeter; symmetrical; narrow rails so the clear center occupies at least 82% of the width and 86% of the height; reinforced clipped corners; small centered crest at top and bottom; keep all ornamentation at the edges
Style/medium: polished 2D anime game UI asset, forged black iron, aged gold trim, subtle wave engravings and compass-like geometry, a few restrained cyan and violet energy inlays; premium evolution/awakening presentation; crisp readable silhouette at both desktop and tablet sizes
Lighting/mood: dramatic but clean, soft metallic highlights, restrained glow around the outside only
Text: none
Constraints: actual alpha transparency in the entire center opening and outside the frame; frame only; no character; no weapon; no item; no panel background; no scene; no title plate; no letters, numbers, symbols, logos, watermark, checkerboard, white background, black background, or drop-shadow filling the transparent center; do not make a collage or mockup screenshot
```

## 驗收

- 正式檔保留 Alpha；中央像素為 RGBA `0,0,0,0`。
- 素材與 34 組正式進化 normal portrait 尺寸完全相同。
- 原始生成 PNG 留在 Codex 生成目錄，沒有覆蓋任何既有角色圖或進化素材。

## 覺醒第二階段框 V361

- 用途：與上述沉睡框幾何完全相同、只在進化能量達峰後出現的第二階段框。
- 工具：Codex 內建 ImageGen，`precise-object-edit`。
- 幾何／Alpha 權威：`public/images/board/evolution_ui/evolution_portrait_frame_v1.webp`。
- 採用的 RGB 生成來源：`C:/Users/王曜瑋/.codex/generated_images/01a0185f-258e-73f0-817a-35e162778d0d/exec-66b944ae-e9e6-485c-bdc9-18e4614fdb52.png`，SHA-256 `23C6D2828A9B461E8DBFED6BF39E34503367E8ACF0A6E77E2BA42B80182C8793`。
- 生成來源為 1085×1449 RGB，並把透明區誤畫成棋盤格，不能直接當正式素材；因此只採用其覺醒金屬與能量設計，縮放至 1086×1448 後精確套回沉睡框的原始 Alpha 遮罩。正式檔與沉睡框的 Alpha 差異像素為 0，沒有以黑底、白底或棋盤格模擬透明。
- 正式 WebP：`public/images/board/evolution_ui/evolution_portrait_frame_awakened_v1.webp`，1086×1448 RGBA，SHA-256 `922BA61818383C6A6908F933A3780FF6145D01C1FB7E9B0FF47D5FC9857779E4`。

### 覺醒框最終 Prompt

```text
Use case: precise-object-edit
Asset type: awakened second-stage transparent character-evolution portrait frame
Input image: the supplied transparent PNG is the edit target and exact geometry/alpha-mask authority
Primary request: make the SAME frame look clearly evolved and awakened: brighter layered radiant gold armor, stronger cyan-violet energy flowing through the rails, upgraded radiant multi-ring top compass crest, more powerful crowned bottom crest, restrained crystalline corner flares and broken-light fragments outside the rails
Critical alpha requirement: PRESERVE THE INPUT ALPHA MASK. Every fully transparent input pixel in the center opening and outside the frame must remain fully transparent (alpha 0) in the output. Do not depict, visualize, paint, or simulate transparency. No checkerboard pattern. Output an actual RGBA transparent PNG.
Geometry invariants: exact 1086x1448 canvas; exact vertical 3:4 proportions; same outer footprint, inner opening, symmetry, corner positions, rail alignment, and portrait-safe clear center; ornamentation may become brighter and more powerful but must not intrude farther into the center opening than the input
Style: premium polished 2D anime pirate RPG UI, triumphant final awakening, gold-white core light with cyan and violet accents
Text: none
Avoid: any character, weapon, item, scene, panel, title plate, letters, numbers, logo, watermark, black/white/checkerboard background, filled center, crop, mirror, rotation, or canvas-size change
```

### 覺醒框驗收

- 正式檔為 1086×1448 四通道 WebP，中央與外圍維持真正透明。
- 覺醒框和沉睡框的 Alpha 遮罩逐像素完全相同，角色安全開口與外框定位不變。
- 舊框、角色圖與其他進化材料均未被覆蓋或重畫。

## 覺醒第二階段框 V362 克制版

- 工具：Codex 內建 ImageGen，`precise-object-edit`。
- Image 1：V361 過度華麗覺醒框，作為修改目標。
- Image 2：V359 沉睡框，作為黑鐵／古金材質、幾何與克制程度參考。
- 生成來源：`C:/Users/王曜瑋/.codex/generated_images/01a0185f-258e-73f0-817a-35e162778d0d/exec-2f37eb73-afa2-40f7-aa9f-88812a7e1782.png`，1086×1448 RGB，SHA-256 `D882137F9553F2BC62B8F314D26DD89F485A6FD71BAAC1FD7E02EB3D3BFEE214`。
- 正式 WebP：`public/images/board/evolution_ui/evolution_portrait_frame_awakened_v2.webp`，1086×1448 RGBA，SHA-256 `23A7207C342DC2A24E93A6672DE65349B53F97B201FD8B0C8A1A5692140F234A`。
- 生成來源沒有 Alpha；正式檔精確套回沉睡框的 Alpha 遮罩，Alpha 差異像素 0。V359 沉睡框與 V361 覺醒框均保留，沒有覆蓋。

### 克制版最終 Prompt

```text
Use case: precise-object-edit
Asset type: restrained second-stage transparent character-evolution portrait frame for a dark ocean pirate RPG
Input images: Image 1 is the edit target/current overly ornate awakened frame; Image 2 is the original dormant frame and the visual restraint, geometry, and material reference.
Primary request: redesign Image 1 into a clearly evolved but restrained version halfway between the two inputs. Keep the dominant structure as dark forged iron and aged bronze-gold like Image 2. Only brighten the thin gold trim, the central top compass, the small side crystals, and a few narrow cyan-violet energy veins. The evolution should read through refined upgraded metalwork and controlled energy, not through overall brightness.
Required reductions: remove the white-hot full-frame glow, crown-like bottom ornament impression, oversized radiant halo, external crystalline bursts, floating fragments, starbursts, and thick flames covering the rails. Reduce cyan-violet energy coverage and intensity by about 70% from Image 1. Keep highlights below the character portrait's likely focal brightness.
Critical alpha requirement: preserve the same true transparent center opening and transparent outside area. No checkerboard or simulated transparency.
Geometry invariants: exact vertical portrait proportions; same outer footprint, inner opening, symmetry, corner positions, rail alignment, and portrait-safe center as Image 2. Do not add ornamentation farther into the center opening.
Style: polished premium 2D anime pirate RPG UI, dignified awakening, dark iron and antique gold with subtle cyan-violet veins; readable on tablet without looking legendary or divine.
Text: none.
Avoid: any character, weapon, item, scene, panel, title plate, letters, numbers, logo, watermark, black/white/checkerboard background, filled center, crop, mirror, rotation, excessive bloom, full-gold frame, celestial crown, or explosive effects.
```

### 克制版驗收

- 正式檔為 1086×1448 四通道 WebP，中央像素 Alpha 為 0。
- 與沉睡框的 Alpha 遮罩逐像素完全相同；角色開口、外框定位與響應式尺寸均不變。
- 完成畫面的角色亮度高於外框，外框只以金邊與局部能量辨識進化。
