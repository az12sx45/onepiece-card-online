"""Crop current south idle pixels into companion portraits without changing historical art."""
import argparse, hashlib, json
from pathlib import Path
from PIL import Image, ImageChops


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    root = args.root.resolve()
    manifest_path = root/'docs/LAUNCHER_ROOM_MOTION_ART_20260926.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf8'))
    portraits = []
    for item in manifest['items']:
        if item['kind'] != 'acting' or item['direction'] != 'south':
            continue
        source = root/item['sourceRenderPng']
        if digest(source) != item['sourceRenderSha256'] or digest(root/item['asset']) != item['assetSha256']:
            raise ValueError(f"Source atlas digest differs: {item['key']}")
        sheet = Image.open(source).convert('RGBA')
        if sheet.size != (2048, 1024):
            raise ValueError('South acting atlas must be 2048 x 1024')
        portrait = sheet.crop((0, 0, 256, 256))
        asset = f"public/images/launcher_room/portrait_v2/{item['key']}.webp"
        destination = root/asset
        destination.parent.mkdir(parents=True, exist_ok=True)
        portrait.save(destination, 'WEBP', lossless=True, method=6, exact=True)
        check = Image.open(destination).convert('RGBA')
        if any(channel.getbbox() for channel in ImageChops.difference(portrait, check).split()):
            raise ValueError('Portrait differs from the selected south idle frame')
        portraits.append(dict(key=item['key'], asset=asset, assetPixels=[256, 256], assetBytes=destination.stat().st_size,
                              assetSha256=digest(destination), sourceAtlas=item['asset'], sourceAtlasSha256=item['assetSha256'],
                              sourceRenderPng=item['sourceRenderPng'], sourceRenderSha256=item['sourceRenderSha256'],
                              sourceFrame=0, sourceRect=[0, 0, 256, 256], losslessPixelMatch=True, visualAcceptance=False))
    manifest['portraits'] = sorted(portraits, key=lambda item: item['key'])
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    print(json.dumps(dict(portraits=len(portraits), scope='Exact south idle bitmap crops', visualAcceptance=False)))


if __name__ == '__main__':
    main()
