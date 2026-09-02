# 青雉首次攔截劇情立繪 V2

## 正式參考

- 角色造型：`public/images/board/battle/enemies/aokiji/normal.webp`、`weak.webp`、`angry.webp`
- 劇情構圖與畫風：`public/images/board/story/speakers/shanks_calm.webp`、`shanks_griffon_draw.webp`
- 目標格式：直式 2:3、約 1024x1536、乾淨動畫線稿與賽璐璐陰影、人物占畫面約九成。

## 共用生成規格

重畫為既有正式劇情 speaker portrait 系列的青雉立繪。維持前期青雉身形、膚色、黑色捲髮、額頭綠色眼罩、深藍西裝、淡黃色領帶與白色無袖海軍長外套；使用正式劇情立繪的線條、陰影和人物比例。背景只保留便於玩家自行去背的單純色面，不加入場景、對話框、標題、Logo、浮水印或額外人物。

## 三種表情／姿勢

1. `aokiji_capture_lazy_source_v2.png`：慵懶歪站、半瞇眼打呵欠，一手抓後腦、一手插口袋。
2. `aokiji_capture_mercy_source_v2.png`：半瞇眼微笑，一手攤掌示意玩家離開、另一手插口袋。
3. `aokiji_capture_serious_source_v2.png`：站直轉為嚴肅，左手有克制的透明冰霜，準備接受挑戰。

## V2 邊界修正

三張都重新縮入 2:3 畫布，完整保留左右手臂、手肘、手腕、手掌與指尖；任何肢體不得碰到或超出左右邊界。本節保留 V2 生成與邊界修正紀錄，正式 runtime 素材改依下方 V3 接入紀錄。

## 正式去背接入 V3（2026-09-02）

- `aokiji_capture_lazy_v3.webp`：由使用者去背的慵懶姿勢，646×969 RGBA WebP。
- `aokiji_capture_mercy_v3.webp`：由使用者去背的伸手放行姿勢，1024×1536 RGBA WebP。
- `aokiji_capture_serious_v3.webp`：由使用者去背的冰手認真姿勢，1024×1536 RGBA WebP。
- 三張皆保留有效透明通道，正式劇情只引用上述 V3 名稱；不再引用舊的 `*_source_v2.png`。
