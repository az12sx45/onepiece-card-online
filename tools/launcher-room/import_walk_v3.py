"""Bake four beats from three intact GPT drawings, with no limb rig or image mirroring."""
import argparse
import copy
from pathlib import Path
import shutil

from PIL import Image
from import_fullbody_v3 import (CHARACTERS, DIRECTIONS, checked_file, digest, direction_frames,
                               local, read_json, require, write_json)

BASE = 'tools/launcher-room/walk-v3'
MANIFEST = 'docs/LAUNCHER_ROOM_WALK_V3_20260927.json'
POSES = ['contact-a', 'neutral', 'contact-c']
ORDER = [0, 1, 2, 1]


def build(plan_path, source_root, output, partial=False):
    source_root, output = Path(source_root).resolve(), Path(output).resolve()
    require(not output.exists() or not any(output.iterdir()), 'Use a new empty output directory')
    plan = read_json(plan_path)
    require(plan['schema'] == 'one-piece-room-walk-selection/3', 'Unknown walk selection')
    sources, images, resolved = {}, {}, copy.deepcopy(plan)
    for identity, source in plan['sources'].items():
        require(source['generator'] == 'gpt-image', 'Walking requires authored GPT whole bodies')
        record = {'generator': 'gpt-image', 'ancestry': []}
        for name, filename in [('image', 'source.png'), ('prompt', 'prompt.txt'), ('receipt', 'receipt.json')]:
            origin = checked_file(source_root, source[name], f'{identity}.{name}')
            target = f'{BASE}/sources/{identity}/{filename}'
            local(output, target).parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(origin, local(output, target))
            record[name] = {'path': target, 'sha256': digest(origin), 'bytes': origin.stat().st_size}
        images[identity] = Image.open(checked_file(source_root, source['image'], identity)).convert('RGBA')
        for index, extra in enumerate(source.get('ancestry', [])):
            origin = checked_file(source_root, extra, f'{identity}.ancestry.{index}')
            target = f'{BASE}/sources/{identity}/ancestry/{index:02d}-{origin.name}'
            local(output, target).parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(origin, local(output, target))
            record['ancestry'].append({'path': target, 'sha256': digest(origin)})
        sources[identity] = record
        resolved['sources'][identity] = record
    groups = {}
    for frame in plan['frames']:
        require(frame['key'] in CHARACTERS and frame['direction'] in DIRECTIONS and frame['pose'] in POSES, 'Unknown character/direction/pose')
        require(frame['source'] in sources, 'Unknown whole-body source')
        require(not any(field in frame for field in ['parts', 'head', 'limbs', 'rig', 'bones', 'flip', 'mirror']), 'Only intact figures may be imported')
        groups.setdefault((frame['key'], frame['direction']), []).append(frame)
    if not partial:
        require(set(groups) == {(key, direction) for key in CHARACTERS for direction in DIRECTIONS}, 'Need every character and direction')
    items = []
    for (key, direction), group in sorted(groups.items()):
        require(sorted(frame['pose'] for frame in group) == sorted(POSES), 'Need exactly three unique authored poses per direction')
        group.sort(key=lambda frame: POSES.index(frame['pose']))
        original, records, scale = direction_frames(group, images)
        atlas = Image.new('RGBA', (512, 128))
        frames = []
        for beat, index in enumerate(ORDER):
            atlas.paste(original.crop((index * 128, 0, (index + 1) * 128, 128)), (beat * 128, 0))
            frames.append({**records[index], 'index': beat, 'authoredPoseIndex': index})
        asset = f'public/images/launcher_room/motion_v3/{key}/{direction}.webp'
        raw = f'{BASE}/renders/{key}-{direction}.png'
        report = f'{BASE}/reports/{key}-{direction}.json'
        for relative in [asset, raw, report]:
            local(output, relative).parent.mkdir(parents=True, exist_ok=True)
        atlas.save(local(output, raw))
        atlas.save(local(output, asset), format='WEBP', lossless=True, exact=True, method=6)
        write_json(local(output, report), {'schema': 'one-piece-room-walk-report/3', 'key': key, 'direction': direction,
                   'method': 'three authored whole bodies; contact, passing, opposite contact, passing',
                   'anatomyReassembled': False, 'mirrored': False, 'interpolatedLimbs': False,
                   'frames': frames, 'visualAccepted': False})
        items.append({'key': key, 'direction': direction, 'kind': 'walking', 'asset': asset,
                      'assetSha256': digest(local(output, asset)), 'assetBytes': local(output, asset).stat().st_size,
                      'assetPixels': [512, 128], 'rawRender': raw, 'rawRenderSha256': digest(local(output, raw)),
                      'report': report, 'reportSha256': digest(local(output, report)),
                      'uniformDirectionScale': scale, 'frames': frames})
    original_path = f'{BASE}/original-selection.json'
    resolved_path = f'{BASE}/resolved-selection.json'
    write_json(local(output, original_path), plan)
    write_json(local(output, resolved_path), resolved)
    manifest = {'schema': 'one-piece-room-walk-art/3', 'version': '1.1.15', 'canonicalCharactersOnly': True,
                'anatomyReassembled': False, 'mirrored': False, 'fixtureSources': False, 'partial': partial,
                'shape': {'columns': 4, 'rows': 1, 'cell': 128, 'frames': 4, 'root': [64, 112]},
                'poseOrder': [POSES[index] for index in ORDER], 'visualAccepted': False,
                'originalSelection': {'path': original_path, 'sha256': digest(local(output, original_path))},
                'resolvedSelection': {'path': resolved_path, 'sha256': digest(local(output, resolved_path))},
                'sources': sources, 'items': items}
    write_json(local(output, MANIFEST), manifest)
    return {'ok': True, 'atlases': len(items), 'uniqueAuthoredPoses': len(items) * 3, 'visualAccepted': False}


if __name__ == '__main__':
    import json
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', required=True)
    parser.add_argument('--source-root', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--allow-partial', action='store_true')
    args = parser.parse_args()
    print(json.dumps(build(args.plan, args.source_root, args.output, args.allow_partial)))
