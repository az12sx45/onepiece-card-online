"""Import intact authored characters into static pose atlases; never assemble anatomy."""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
from pathlib import Path
import re
import shutil

import cv2
import numpy as np
from PIL import Image

CHARACTERS = ['luffy', 'zoro', 'nami', 'usopp', 'sanji', 'chopper', 'robin', 'franky', 'brook', 'jinbe']
DIRECTIONS = ['east', 'west', 'north', 'south']
POSES = ['idle', 'talk_happy', 'talk_annoyed', 'surprised', 'focused_use', 'sit', 'wave', 'listen']
SHAPE = {'cell': 128, 'columns': 8, 'rows': 1, 'root': [64, 112], 'standingMaxHeight': 100, 'maxWidth': 112}
MANIFEST = 'docs/LAUNCHER_ROOM_FULLBODY_ART_20260927.json'
BASE = 'tools/launcher-room/fullbody-v3'
HEX = re.compile(r'^[0-9a-f]{64}$')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))


def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def local(root, name):
    require(isinstance(name, str) and name and '\\' not in name, f'Expected relative POSIX path: {name!r}')
    value = (Path(root) / name).resolve()
    require(not Path(name).is_absolute() and value.is_relative_to(Path(root).resolve()), f'Path escapes root: {name}')
    return value


def checked_file(root, record, label):
    require(isinstance(record, dict) and HEX.fullmatch(str(record.get('sha256', ''))), f'Missing SHA-256: {label}')
    path = local(root, record.get('path'))
    require(path.is_file(), f'Missing file: {label}: {path}')
    require(digest(path) == record['sha256'], f'SHA-256 mismatch: {label}')
    return path


def validate_plan(plan, root, allow_fixture=False):
    require(plan.get('schema') == 'one-piece-room-fullbody-selection/1', 'Unsupported selection schema')
    require(plan.get('shape', SHAPE) == SHAPE, 'Static fullbody shape must be 8 x 1, 128px, root64,112')
    sources = plan.get('sources')
    require(isinstance(sources, dict) and sources, 'At least one source is required')
    for source_id, source in sources.items():
        require(re.fullmatch(r'[a-z0-9][a-z0-9_-]{0,79}', source_id), f'Invalid source id: {source_id}')
        require(source.get('generator') == 'gpt-image' or (allow_fixture and source.get('generator') == 'synthetic-fixture'), f'Unsupported generator: {source_id}')
        image = checked_file(root, source.get('image'), f'{source_id}.image')
        require(image.suffix.lower() == '.png', f'Preserve original PNG source: {source_id}')
        prompt = checked_file(root, source.get('prompt'), f'{source_id}.prompt').read_text(encoding='utf-8-sig')
        require(len(prompt.strip()) >= 12 and not (prompt.strip().endswith('.txt') and '\n' not in prompt), f'Prompt must contain actual generation instructions: {source_id}')
        for index, extra in enumerate(source.get('ancestry', [])):
            checked_file(root, extra, f'{source_id}.ancestry[{index}]')
        receipt = read_json(checked_file(root, source.get('receipt'), f'{source_id}.receipt'))
        require(isinstance(receipt, dict) and bool(receipt), f'Generation receipt must be a nonempty JSON object: {source_id}')
    frames = plan.get('frames')
    require(isinstance(frames, list) and frames, 'No frame selections')
    seen = set()
    groups = {}
    for frame in frames:
        key, direction, pose = (frame.get(name) for name in ['key', 'direction', 'pose'])
        require(key in CHARACTERS and direction in DIRECTIONS and pose in POSES, f'Unknown canonical frame: {key}/{direction}/{pose}')
        identity = (key, direction, pose)
        require(identity not in seen, f'Duplicate frame: {identity}')
        seen.add(identity)
        require(frame.get('source') in sources, f'Unknown source: {identity}')
        region = frame.get('region')
        require(isinstance(region, list) and len(region) == 4 and all(type(x) is int for x in region) and min(region[:2]) >= 0 and min(region[2:]) > 0, f'Invalid complete-character region: {identity}')
        unit = frame.get('sourceUnitScale', 1)
        require(isinstance(unit, (int, float)) and math.isfinite(unit) and 0 < unit <= 10, f'Invalid sourceUnitScale: {identity}')
        if unit != 1:
            require(isinstance(frame.get('sourceUnitScaleReason'), str) and len(frame['sourceUnitScaleReason'].strip()) >= 12, f'Explain whole-source resolution calibration: {identity}')
        require(not any(field in frame for field in ['parts', 'head', 'limbs', 'rig', 'walk', 'bones', 'flip', 'mirror']), f'Anatomy assembly/mirroring/walk fields are not supported: {identity}')
        groups.setdefault((key, direction), []).append(frame)
    require(set(frame['source'] for frame in frames) == set(sources), 'Unused source provenance is not allowed')
    for identity, group in groups.items():
        require(sorted(f['pose'] for f in group) == sorted(POSES), f'Every imported direction needs exactly eight complete poses: {identity}')
        group.sort(key=lambda frame: POSES.index(frame['pose']))
    return groups


def extract_frame(frame, source_image, aa_radius=2):
    """Keep a single complete opaque component and nearby authored antialias pixels."""
    x, y, width, height = frame['region']
    require(x + width <= source_image.width and y + height <= source_image.height, f'Region exceeds source: {frame}')
    data = np.array(source_image.crop((x, y, x + width, y + height)).convert('RGBA'))
    alpha = data[:, :, 3]
    count, labels, stats, _ = cv2.connectedComponentsWithStats((alpha > 128).astype('uint8'), connectivity=8)
    ids = list(range(1, count))
    require(ids, f'Empty/transparent region: {frame["key"]}/{frame["direction"]}/{frame["pose"]}')
    if 'componentSeed' in frame:
        seed = frame['componentSeed']
        require(isinstance(seed, list) and len(seed) == 2 and all(type(n) is int for n in seed), 'Seed must be an absolute source pixel')
        sx, sy = seed[0] - x, seed[1] - y
        require(0 <= sx < width and 0 <= sy < height, 'Component seed is outside region')
        component = int(labels[sy, sx])
        require(component != 0, 'Component seed must lie on opaque character pixels')
    else:
        component = max(ids, key=lambda index: int(stats[index, cv2.CC_STAT_AREA]))
        significant = [index for index in ids if stats[index, cv2.CC_STAT_AREA] >= max(64, stats[component, cv2.CC_STAT_AREA] * .15)]
        require(len(significant) == 1, 'Ambiguous region contains multiple characters/large disconnected pieces; narrow region or provide a reviewed componentSeed')
    bx, by, bw, bh, area = map(int, stats[component])
    require(area >= 64, 'Selected opaque body is too small')
    require(bx > 0 and by > 0 and bx + bw < width and by + bh < height, 'Source region clips the selected opaque character; use a full region')
    core = (labels == component).astype('uint8')
    axis = np.arange(-aa_radius, aa_radius + 1)
    kernel = ((axis[:, None] ** 2 + axis[None, :] ** 2) <= aa_radius ** 2).astype('uint8')
    keep = cv2.dilate(core, kernel)
    removed = int(np.count_nonzero((alpha > 0) & (keep == 0)))
    data[keep == 0] = 0
    cleaned = Image.fromarray(data)
    bounds = cleaned.getchannel('A').getbbox()
    require(bounds is not None, 'Selected character vanished')
    aa_edges = [bounds[0] == 0, bounds[1] == 0, bounds[2] == width, bounds[3] == height]
    image_edges = [x == 0, y == 0, x + width == source_image.width, y + height == source_image.height]
    require(all(not touches or image_edge for touches, image_edge in zip(aa_edges, image_edges)), 'Region cuts retained antialias edge inside the source; enlarge region')
    # Root follows the whole character head axis and the opaque ground-contact row.
    # A reviewer may supply a source anchor for an asymmetric pose, still moving the whole figure only.
    head = np.where(core[by:by + max(1, round(bh * .35)), bx:bx + bw])[1]
    anchor = frame.get('sourceAnchor', [x + bx + float(head.mean()), y + by + bh])
    require(isinstance(anchor, list) and len(anchor) == 2 and all(isinstance(v, (int, float)) and math.isfinite(v) for v in anchor), 'Invalid whole-character sourceAnchor')
    require(x <= anchor[0] <= x + width and y <= anchor[1] <= y + height, 'Anchor is outside source region')
    crop = cleaned.crop(bounds)
    crop_origin = [x + bounds[0], y + bounds[1]]
    return {
        'image': crop,
        'sourceAnchor': anchor,
        'localAnchor': [anchor[0] - crop_origin[0], anchor[1] - crop_origin[1]],
        'sourceAlphaBounds': [x + bounds[0], y + bounds[1], x + bounds[2], y + bounds[3]],
        'opaqueBounds': [x + bx, y + by, bw, bh],
        'opaquePixels': area,
        'removedDistantAlphaPixels': removed,
        'sourceUnitScale': frame.get('sourceUnitScale', 1),
        'sourceOpaqueClearance': [bx, by, width - bx - bw, height - by - bh],
        'edgeAaRadius': aa_radius,
        'sourceAaTouchesImageBoundary': aa_edges,
    }


def render_one(extracted, direction_scale, cell=128):
    ratio = cell / 128
    scale = direction_scale * extracted['sourceUnitScale'] * ratio
    ax, ay = extracted['localAnchor']
    transform = [1 / scale, 0, ax - 64 * ratio / scale, 0, 1 / scale, ay - 112 * ratio / scale]
    result = extracted['image'].transform((cell, cell), Image.Transform.AFFINE, transform, resample=Image.Resampling.BICUBIC)
    rgba = np.array(result)
    rgba[rgba[:, :, 3] == 0] = 0
    return Image.fromarray(rgba), transform


def pixel_bounds(image, opaque=False):
    alpha = np.array(image)[:, :, 3]
    ys, xs = np.where(alpha > (128 if opaque else 0))
    return [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1] if len(xs) else None


def direction_frames(group, images):
    output_scales = {frame.get('outputScale', 1) for frame in group}
    require(len(output_scales) == 1, 'Every pose in a direction must use the same whole-atlas outputScale')
    output_scale = output_scales.pop()
    require(isinstance(output_scale, (int, float)) and math.isfinite(output_scale) and 0 < output_scale <= 1, 'outputScale may only uniformly reduce the complete direction group')
    if output_scale != 1:
        require(all(isinstance(frame.get('outputScaleReason'), str) and len(frame['outputScaleReason'].strip()) >= 12 for frame in group), 'Explain common standing/walking size calibration')
    extracted = [extract_frame(frame, images[frame['source']]) for frame in group]
    height = max(value['opaqueBounds'][3] * value['sourceUnitScale'] for frame, value in zip(group, extracted) if frame['pose'] != 'sit')
    width = max(value['opaqueBounds'][2] * value['sourceUnitScale'] for value in extracted)
    scale = min(100 / height, 112 / width)
    for value in extracted:
        ax, ay = value['localAnchor']
        unit = value['sourceUnitScale']
        for space, extent in [(62, ax), (62, value['image'].width - ax), (110, ay), (14, value['image'].height - ay)]:
            if extent > 0:
                scale = min(scale, space / (extent * unit))
    scale *= output_scale
    for _ in range(6):
        rendered = [render_one(value, scale) for value in extracted]
        shrink = 1
        for frame, (image, _) in zip(group, rendered):
            box = pixel_bounds(image, True)
            require(box is not None, 'Empty normalized frame')
            shrink = min(shrink, 112 / (box[2] - box[0]))
            if frame['pose'] != 'sit':
                shrink = min(shrink, 100 / (box[3] - box[1]))
        if shrink >= 1:
            break
        scale *= shrink * .999
    atlas = Image.new('RGBA', (1024, 128))
    records = []
    for index, (frame, value, (image, transform)) in enumerate(zip(group, extracted, rendered)):
        bounds = pixel_bounds(image)
        opaque = pixel_bounds(image, True)
        require(bounds and bounds[0] > 0 and bounds[1] > 0 and bounds[2] < 128 and bounds[3] < 128, f'Output alpha clipping: {frame["pose"]}')
        require(opaque[2] - opaque[0] <= 112 and (frame['pose'] == 'sit' or opaque[3] - opaque[1] <= 100), 'Final dimensions exceed contract')
        atlas.paste(image, (index * 128, 0))
        records.append({
            **{name: copy.deepcopy(frame[name]) for name in ['key', 'direction', 'pose', 'source', 'region']},
            'index': index, 'bounds': bounds, 'opaqueBoundsAtOutput': opaque,
            **{name: value[name] for name in ['sourceAnchor', 'localAnchor', 'sourceAlphaBounds', 'opaqueBounds', 'opaquePixels', 'removedDistantAlphaPixels', 'sourceUnitScale', 'sourceOpaqueClearance', 'edgeAaRadius', 'sourceAaTouchesImageBoundary']},
            'uniformDirectionScale': scale,
            'outputScale': output_scale,
            'wholeImageScale': scale * value['sourceUnitScale'],
            'inverseWholeImageTransform': transform,
            'rgbaSha256': hashlib.sha256(image.tobytes()).hexdigest(),
            'anatomyReassembled': False, 'mirrored': False, 'clipped': False,
        })
    return atlas, records, scale


def import_bundle(plan_path, source_root, output, allow_fixture=False):
    plan_path, source_root, output = Path(plan_path).resolve(), Path(source_root).resolve(), Path(output).resolve()
    require(not output.exists() or not any(output.iterdir()), 'Output must be a new/empty staging directory; existing files are never overwritten')
    plan = read_json(plan_path)
    groups = validate_plan(plan, source_root, allow_fixture)
    images = {key: Image.open(checked_file(source_root, source['image'], key)).convert('RGBA') for key, source in plan['sources'].items()}
    # Extract/validate all poses before any staged output is written.
    prepared = {identity: direction_frames(group, images) for identity, group in groups.items()}
    output.mkdir(parents=True, exist_ok=True)
    resolved = copy.deepcopy(plan)
    sources = {}
    for source_id, source in plan['sources'].items():
        entry = {'id': source_id, 'generator': source['generator'], 'dimensions': list(images[source_id].size)}
        for kind, filename in [('image', 'image.png'), ('prompt', 'prompt.txt'), ('receipt', 'receipt.json')]:
            rel = f'{BASE}/sources/{source_id}/{filename}'
            target = local(output, rel)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(checked_file(source_root, source[kind], f'{source_id}.{kind}'), target)
            entry[kind] = {'path': rel, 'sha256': digest(target), 'bytes': target.stat().st_size}
            resolved['sources'][source_id][kind] = {'path': rel, 'sha256': entry[kind]['sha256']}
        entry['ancestry'] = []
        resolved['sources'][source_id]['ancestry'] = []
        for index, extra in enumerate(source.get('ancestry', [])):
            origin = checked_file(source_root, extra, f'{source_id}.ancestry[{index}]')
            rel = f'{BASE}/sources/{source_id}/ancestry/{index:02d}-{origin.name}'
            target = local(output, rel); target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(origin, target)
            copied = {'path': rel, 'sha256': digest(target), 'role': extra.get('role', 'generation-provenance')}
            entry['ancestry'].append(copied); resolved['sources'][source_id]['ancestry'].append(copied)
        entry['promptText'] = local(output, entry['prompt']['path']).read_text(encoding='utf-8-sig')
        sources[source_id] = entry
    original_path = local(output, f'{BASE}/original-selection.json')
    original_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(plan_path, original_path)
    resolved_path = local(output, f'{BASE}/resolved-selection.json')
    write_json(resolved_path, resolved)
    items = []
    for (key, direction), (atlas, frames, scale) in sorted(prepared.items()):
        asset = f'public/images/launcher_room/acting_v3/{key}/{direction}.webp'
        raw = f'{BASE}/renders/{key}-{direction}.png'
        report_path = f'{BASE}/reports/{key}-{direction}.json'
        local(output, asset).parent.mkdir(parents=True, exist_ok=True)
        local(output, raw).parent.mkdir(parents=True, exist_ok=True)
        atlas.save(local(output, raw))
        atlas.save(local(output, asset), format='WEBP', lossless=True, exact=True, method=6)
        report = {'schema': 'one-piece-room-fullbody-import-report/1', 'key': key, 'direction': direction, 'shape': SHAPE,
                  'method': 'whole-character component with nearby source alpha; uniform whole-image scale and translation',
                  'uniformDirectionScale': scale, 'frames': frames, 'visualAccepted': False}
        write_json(local(output, report_path), report)
        items.append({'key': key, 'direction': direction, 'kind': 'static-poses', 'asset': asset,
                      'assetSha256': digest(local(output, asset)), 'assetBytes': local(output, asset).stat().st_size,
                      'assetPixels': [1024, 128], 'rawRender': raw, 'rawRenderSha256': digest(local(output, raw)),
                      'report': report_path, 'reportSha256': digest(local(output, report_path)),
                      'uniformDirectionScale': scale, 'frames': frames, 'sourceIds': sorted({f['source'] for f in frames}),
                      'sourceHashes': {source_id: sources[source_id]['image']['sha256'] for source_id in sorted({f['source'] for f in frames})}})
    portraits = []
    for (key, direction), (_, _, scale) in sorted(prepared.items()):
        if direction != 'south':
            continue
        frame = groups[(key, direction)][0]
        portrait, transform = render_one(extract_frame(frame, images[frame['source']]), scale, 256)
        bounds = pixel_bounds(portrait)
        require(bounds and min(bounds[:2]) > 0 and max(bounds[2:]) < 256, f'Portrait alpha clipping: {key}')
        asset = f'public/images/launcher_room/portrait_v3/{key}.webp'
        raw = f'{BASE}/portraits/{key}.png'
        for rel in [asset, raw]:
            local(output, rel).parent.mkdir(parents=True, exist_ok=True)
        portrait.save(local(output, raw))
        portrait.save(local(output, asset), format='WEBP', lossless=True, exact=True, method=6)
        portraits.append({'key': key, 'direction': 'south', 'pose': 'idle', 'wholeBody': True,
                          'asset': asset, 'assetPixels': [256, 256], 'root': [128, 224],
                          'assetSha256': digest(local(output, asset)), 'assetBytes': local(output, asset).stat().st_size,
                          'rawRender': raw, 'rawRenderSha256': digest(local(output, raw)),
                          'source': frame['source'], 'uniformDirectionScale': scale,
                          'inverseWholeImageTransform': transform, 'bounds': bounds,
                          'rgbaSha256': hashlib.sha256(portrait.tobytes()).hexdigest()})
    manifest = {'schema': 'one-piece-room-fullbody-art/3', 'version': '1.1.15', 'canonicalCharactersOnly': True, 'shape': SHAPE,
                'poseOrder': POSES, 'walkProvided': False, 'anatomyReassembled': False,
                'visualAccepted': False, 'requiresManualVisualReview': True,
                'fixtureSources': any(source['generator'] == 'synthetic-fixture' for source in sources.values()),
                'originalSelection': {'path': f'{BASE}/original-selection.json', 'sha256': digest(original_path)},
                'resolvedSelection': {'path': f'{BASE}/resolved-selection.json', 'sha256': digest(resolved_path)},
                'sources': sources, 'items': items, 'portraits': portraits}
    write_json(local(output, MANIFEST), manifest)
    return {'ok': True, 'output': str(output), 'manifest': MANIFEST, 'atlases': len(items), 'frames': len(items) * 8, 'portraits': len(portraits),
            'walkProvided': False, 'visualAccepted': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', required=True)
    parser.add_argument('--source-root', required=True)
    parser.add_argument('--output', required=True, help='A new/empty staging directory; never overwrites existing assets')
    parser.add_argument('--allow-fixture-sources', action='store_true', help='QA only; output remains marked as fixture material')
    args = parser.parse_args()
    print(json.dumps(import_bundle(args.plan, args.source_root, args.output, args.allow_fixture_sources), ensure_ascii=False))


if __name__ == '__main__':
    main()
