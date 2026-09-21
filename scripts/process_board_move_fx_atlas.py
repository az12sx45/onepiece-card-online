"""Local chroma background removal for GPT painted VFX; never generates artwork."""
import argparse, hashlib, json
from pathlib import Path
import numpy as np
from PIL import Image

def process(src, dest, key='cyan'):
    original = Image.open(src).convert('RGBA')
    pixels = np.asarray(original, dtype=np.float32) / 255.0
    rgb, original_alpha = pixels[:, :, :3], pixels[:, :, 3]
    key_rgb = {'cyan': (0, 1, 1), 'magenta': (1, 0, 1), 'green': (0, 1, 0)}[key]
    if key == 'cyan':
        screen = np.minimum(rgb[:, :, 1], rgb[:, :, 2]) - rgb[:, :, 0]
    elif key == 'magenta':
        screen = np.minimum(rgb[:, :, 0], rgb[:, :, 2]) - rgb[:, :, 1]
    else:
        screen = rgb[:, :, 1] - np.maximum(rgb[:, :, 0], rgb[:, :, 2])
    # Remove pure backdrop and mixed edge pixels, then unmix screen spill.
    alpha = np.clip(1 - np.maximum(screen, 0), 0, 1)
    alpha[alpha < 0.08] = 0
    foreground = (rgb - (1 - alpha[:, :, None]) * np.array(key_rgb)) / np.maximum(alpha[:, :, None], 0.001)
    rgba = np.dstack((np.clip(foreground, 0, 1), alpha * original_alpha))
    rgba[rgba[:, :, 3] == 0] = 0
    cleaned = Image.fromarray(np.uint8(np.clip(rgba * 255, 0, 255)), 'RGBA')
    atlas = Image.new('RGBA', (2048, 1024))
    stats = []
    width, height = cleaned.size
    for i in range(8):
        x, y = i % 4, i // 4
        crop = cleaned.crop((round(x * width / 4), round(y * height / 2), round((x+1) * width / 4), round((y+1) * height / 2)))
        crop = crop.resize((448, 448), Image.Resampling.LANCZOS)
        atlas.paste(crop, (x*512+32, y*512+32))
        a = np.asarray(crop.getchannel('A'))
        stats.append({'frame':i, 'opaquePixels':int((a>240).sum()), 'visiblePixels':int((a>8).sum()), 'sha256':hashlib.sha256(crop.tobytes()).hexdigest()})
    dest.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(dest, 'WEBP', lossless=True, method=6)
    preview = Image.new('RGB', atlas.size, '#14202b')
    preview.paste(atlas, mask=atlas.getchannel('A'))
    preview.save(dest.with_suffix('.preview.jpg'), quality=90)
    report = {'source':str(src.resolve()), 'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(), 'sourceSize':original.size, 'output':str(dest.resolve()), 'outputSha256':hashlib.sha256(dest.read_bytes()).hexdigest(), 'backgroundRemoval':'local numpy chroma unmix', 'key':key, 'frames':stats, 'size':atlas.size, 'bytes':dest.stat().st_size}
    dest.with_suffix('.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf8')
    return report

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('input', type=Path)
    p.add_argument('output', type=Path)
    p.add_argument('--key', choices=['cyan','magenta','green'], default='cyan')
    args=p.parse_args()
    print(json.dumps(process(args.input,args.output,args.key), ensure_ascii=False))
