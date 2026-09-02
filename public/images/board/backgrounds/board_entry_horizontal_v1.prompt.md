# 新世界航海錄入口橫向背景 V1

- 日期：2026-09-02
- 工具：Codex 內建 ImageGen
- 參考圖：使用者提供的 `Codex 圖像 2026年9月2日 上午12_03_07.png`
- 正式檔：`board_entry_horizontal_v1.webp`（1672×941，WebP quality 92）
- 原始生成稿：`incoming/board_entry_horizontal_v1_imagegen.png`（1672×941 PNG）

## Prompt

```text
Use case: precise-object-edit
Asset type: 16:9 fullscreen title-screen background for a pirate board-adventure game
Primary request: Recompose the supplied portrait illustration into a true wide landscape scene; do not stretch it and do not merely crop it. Extend and redraw the scene naturally for a 16:9 horizontal canvas.
Input image: the supplied image is the sole edit target and identity/composition reference.
Scene/backdrop: bright blue sea and sky, island-route board map across the water, ornate navy-and-antique-gold frame following all four outer edges.
Subject: preserve exactly the same four recognizable characters and their appearances: green-haired swordsman on the left, smiling straw-hat captain reaching a large white die toward the viewer near center-left, blond suited cook in the upper center-right, orange-haired navigator holding a map and compass on the right. Preserve the red-and-white lion figurehead ship and the sea-route islands.
Style/medium: polished colorful Japanese adventure-anime key art matching the reference, crisp game-cover finish.
Composition/framing: true 16:9 landscape. Spread the four characters across the upper and middle area so every face, torso, arm, hand, sword, compass, and map remains inside the gold frame; no cropped limbs. Keep the die prominent in the foreground. Place the ship and route map across the lower middle. Leave a readable darker-ocean band in the lower quarter for a separate game logo overlay without covering faces.
Lighting/mood: sunny, energetic, inviting first-voyage feeling.
Constraints: preserve the character count and identities; retain the ornate border on all four edges; coherent anatomy and hands; no text, no logo, no title, no UI, no watermark, no additional characters, no collage, no split panels, no black bars.
```

## 接入規則

- 只用於 `board_start.html` 的 press／auth／boot 入口階段，不替換登入後 Board 主頁的 `--board-bg`。
- 遊戲標誌與「點擊繼續」仍由 HTML 疊加，避免把文字烘焙進背景圖。
- 正式頁不引用 `incoming/` 原稿。
