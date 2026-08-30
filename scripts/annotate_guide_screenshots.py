from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RAW_DIR = ROOT / "artifacts" / "one_piece_board_complete_guide_v1" / "qa" / "complete_run" / "screenshots" / "raw"
DEFAULT_OUT_DIR = ROOT / "artifacts" / "one_piece_board_complete_guide_v1" / "qa" / "complete_run" / "screenshots" / "annotated"
FONT_REGULAR = Path("C:/Windows/Fonts/msjh.ttc")
FONT_BOLD = Path("C:/Windows/Fonts/msjhbd.ttc")


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    path = FONT_BOLD if bold and FONT_BOLD.exists() else FONT_REGULAR
    if path.exists():
        return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def fit_text(draw: ImageDraw.ImageDraw, text: str, max_width: int, start_size: int, bold: bool = False):
    size = start_size
    while size >= 18:
        selected = font(size, bold)
        box = draw.textbbox((0, 0), text, font=selected)
        if box[2] - box[0] <= max_width:
            return selected
        size -= 1
    return font(18, bold)


def badge(draw: ImageDraw.ImageDraw, xy: tuple[int, int], number: int, color=(255, 202, 64)):
    x, y = xy
    radius = 24
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(4, 18, 29, 235), outline=color, width=4)
    label = str(number)
    selected = font(27, True)
    box = draw.textbbox((0, 0), label, font=selected)
    draw.text((x - (box[2] - box[0]) / 2, y - (box[3] - box[1]) / 2 - 2), label, font=selected, fill=(255, 255, 255))


def focus(draw: ImageDraw.ImageDraw, rect: tuple[int, int, int, int], number: int, color=(255, 202, 64)):
    draw.rounded_rectangle(rect, radius=14, outline=color, width=5)
    badge(draw, (rect[0] + 18, rect[1] + 18), number, color)


def classify(name: str):
    if "2真人2CPU等待室" in name:
        return (
            "四人房確認：2 名真人＋2 名 CPU",
            [((345, 170, 1265, 485), 1), ((350, 835, 1040, 895), 2)],
            "① 四個席位與 CPU 標籤都要正確　② 房主開始前確認真人已準備、CPU 已加入",
        )
    if "四人主地圖" in name or "四人輪替完成" in name:
        return (
            "地圖回合判讀",
            [((15, 20, 460, 160), 1), ((420, 395, 565, 535), 2), ((950, 15, 1570, 75), 3)],
            "① 左上顯示目前可操作玩家　② 船隻重疊時看名稱／呼吸光　③ CPU 倍速只縮短等待，不改結果",
        )
    if "四拓本啟動" in name:
        return (
            "四份路標歷史本文：啟動最終航路",
            [((250, 110, 1350, 750), 1), ((1370, 20, 1570, 90), 2)],
            "① 集滿東西南北四份拓本後由背包啟動　② 劇情可跳過，但不會跳過正式解鎖",
        )
    if "最終之島航路現身" in name or "十三孤島地圖" in name or "蛋頭島現身" in name:
        return (
            "世界地圖解鎖重點",
            [((120, 80, 1480, 810), 1), ((950, 15, 1575, 75), 2)],
            "① 確認新島嶼與航路已出現在同一張地圖　② 解鎖後仍依原玩家順序交棒",
        )
    if "最終之島結局" in name:
        return (
            "一周目結局播放",
            [((25, 50, 1575, 820), 1), ((1320, 15, 1575, 90), 2)],
            "① 結局劇情跑完才正式進入二周目　② 可調速度或跳過；跳過仍會完成解鎖與交棒",
        )
    if "觀戰玩家重整" in name:
        return (
            "觀戰端重整恢復",
            [((55, 15, 1545, 875), 1)],
            "① 重整後仍要回到同一名 Boss、同一場戰鬥；觀看方不能取得操作權",
        )
    if "Tot_Musica" in name:
        return (
            "Tot Musica 雙世界編隊",
            [((160, 175, 785, 635), 1), ((810, 175, 1430, 635), 2), ((180, 675, 1430, 835), 3)],
            "① 左隊代表現實世界　② 右隊代表歌世界　③ 六名船員分成兩隊，兩邊第一格都是先發",
        )
    if any(token in name for token in ("四皇", "伊姆", "二周目Boss", "洛基王子", "洛克斯終戰")):
        return (
            "Boss 戰鬥畫面三個必看區",
            [((55, 12, 742, 145), 1), ((785, 95, 1565, 370), 2), ((820, 565, 1565, 880), 3)],
            "① 先看我方 HP／屬性／攜帶物　② 點機制圖示確認規則與計數器　③ 仍使用攻擊、夥伴、道具、逃跑四指令",
        )
    return (
        "實測畫面",
        [((25, 25, 1575, 875), 1)],
        "① 依畫面提示完成目前階段；若仍有獎勵揭示，等「點擊繼續」出現後再交棒",
    )


def annotate(source: Path, target: Path):
    original = Image.open(source).convert("RGBA")
    width, height = original.size
    scale_x = width / 1600
    scale_y = height / 900
    footer_height = max(92, int(height * 0.105))
    canvas = Image.new("RGBA", (width, height + footer_height), (3, 14, 24, 255))
    canvas.alpha_composite(original, (0, 0))
    draw = ImageDraw.Draw(canvas, "RGBA")
    title, boxes, caption = classify(source.stem)

    for rect, number in boxes:
        scaled = tuple(int(value * (scale_x if idx % 2 == 0 else scale_y)) for idx, value in enumerate(rect))
        focus(draw, scaled, number)

    title_font = fit_text(draw, title, int(width * 0.58), max(25, int(width * 0.02)), True)
    title_box = draw.textbbox((0, 0), title, font=title_font)
    title_w = title_box[2] - title_box[0]
    title_h = title_box[3] - title_box[1]
    title_left = max(18, int(width * 0.018))
    title_top = max(14, int(height * 0.016))
    draw.rounded_rectangle(
        (title_left - 10, title_top - 8, title_left + title_w + 18, title_top + title_h + 14),
        radius=12,
        fill=(3, 17, 29, 228),
        outline=(255, 202, 64, 245),
        width=3,
    )
    draw.text((title_left, title_top), title, font=title_font, fill=(255, 248, 221, 255))

    footer_top = height
    draw.rectangle((0, footer_top, width, height + footer_height), fill=(3, 17, 29, 255))
    draw.rectangle((0, footer_top, width, footer_top + 5), fill=(255, 202, 64, 255))
    caption_font = fit_text(draw, caption, width - 64, max(22, int(width * 0.017)), False)
    caption_box = draw.textbbox((0, 0), caption, font=caption_font)
    caption_h = caption_box[3] - caption_box[1]
    draw.text((32, footer_top + (footer_height - caption_h) / 2 - 3), caption, font=caption_font, fill=(232, 244, 248, 255))

    target.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(target, quality=94, optimize=True)


def main():
    raw_dir = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_RAW_DIR
    out_dir = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else DEFAULT_OUT_DIR
    if not raw_dir.exists():
        raise SystemExit(f"Missing screenshot directory: {raw_dir}")
    out_dir.mkdir(parents=True, exist_ok=True)
    sources = sorted(raw_dir.glob("*.png"))
    for source in sources:
        annotate(source, out_dir / source.name)
    print(f"annotated={len(sources)} output={out_dir}")


if __name__ == "__main__":
    main()
