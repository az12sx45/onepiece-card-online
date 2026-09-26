"""Independently read staged files and reconstruct every whole-character static pose."""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image

from import_fullbody_v3 import (BASE, CHARACTERS, DIRECTIONS, MANIFEST, POSES, SHAPE, checked_file,
                               digest, direction_frames, extract_frame, local, pixel_bounds,
                               read_json, render_one, require, validate_plan)


def verify(root, require_complete=False, allow_fixture=False):
    root = Path(root).resolve()
    manifest = read_json(local(root, MANIFEST))
    require(manifest.get('version') == '1.1.14', 'Wrong release version')
    require(manifest.get('schema') == 'one-piece-room-fullbody-art/3', 'Wrong manifest schema')
    require(manifest.get('shape') == SHAPE and manifest.get('poseOrder') == POSES, 'Static atlas contract changed')
    require(manifest.get('canonicalCharactersOnly') is True and manifest.get('anatomyReassembled') is False, 'Canonical whole-body contract changed')
    require(manifest.get('walkProvided') is False, 'A static pose bundle cannot claim to provide walking')
    require(manifest.get('visualAccepted') is False and manifest.get('requiresManualVisualReview') is True, 'Structural validation must not impersonate visual acceptance')
    require(not manifest.get('fixtureSources') or allow_fixture, 'Synthetic fixtures cannot pass a production validation')
    original = read_json(checked_file(root, manifest['originalSelection'], 'original selection'))
    resolved = read_json(checked_file(root, manifest['resolvedSelection'], 'resolved selection'))
    require(original['frames'] == resolved['frames'], 'Resolved plan changed reviewed frame selections')
    require(set(original['sources']) == set(resolved['sources']) == set(manifest['sources']), 'Source identity changed')
    for key, source in manifest['sources'].items():
        original_source, resolved_source = original['sources'][key], resolved['sources'][key]
        require(source['generator'] == original_source['generator'] == resolved_source['generator'], 'Source generator changed')
        for kind in ['image', 'prompt', 'receipt']:
            path = checked_file(root, source[kind], f'{key}.{kind}')
            require(source[kind]['sha256'] == original_source[kind]['sha256'] == resolved_source[kind]['sha256'], 'Copied provenance bytes changed')
            require(source[kind]['path'] == resolved_source[kind]['path'] and path.stat().st_size == source[kind]['bytes'], 'Resolved provenance location/length mismatch')
        require(source['promptText'] == local(root, source['prompt']['path']).read_text(encoding='utf-8-sig'), 'Embedded prompt text differs')
        require(source['ancestry'] == resolved_source.get('ancestry', []), 'Ancestry list differs')
        require([a['sha256'] for a in source['ancestry']] == [a['sha256'] for a in original_source.get('ancestry', [])], 'Original generation-chain hashes changed')
        for index, extra in enumerate(source['ancestry']):
            checked_file(root, extra, f'{key}.ancestry[{index}]')
    groups = validate_plan(resolved, root, allow_fixture)
    expected = {(key, direction) for key in CHARACTERS for direction in DIRECTIONS}
    actual = {(item['key'], item['direction']) for item in manifest['items']}
    require(len(actual) == len(manifest['items']) and actual == set(groups), 'Duplicate/missing atlas identity')
    if require_complete:
        require(actual == expected, f'Complete art requires 40 direction atlases; found {len(actual)}')
    images = {key: Image.open(checked_file(root, source['image'], key)).convert('RGBA') for key, source in manifest['sources'].items()}
    for key, image in images.items():
        require(list(image.size) == manifest['sources'][key]['dimensions'], 'Source dimensions changed')
    rebuilt = {}
    for item in manifest['items']:
        key, direction = item['key'], item['direction']
        require(item['kind'] == 'static-poses' and item['asset'] == f'public/images/launcher_room/acting_v3/{key}/{direction}.webp', 'Unexpected asset identity')
        require(item['assetPixels'] == [1024, 128], 'Wrong 8x1 atlas dimensions')
        require(digest(local(root, item['asset'])) == item['assetSha256'], 'Atlas SHA changed')
        require(local(root, item['asset']).stat().st_size == item['assetBytes'], 'Atlas length changed')
        require(digest(local(root, item['rawRender'])) == item['rawRenderSha256'], 'Raw whole-body atlas SHA changed')
        require(digest(local(root, item['report'])) == item['reportSha256'], 'Import report SHA changed')
        atlas, frames, scale = direction_frames(groups[(key, direction)], images)
        decoded = Image.open(local(root, item['asset'])).convert('RGBA')
        raw = Image.open(local(root, item['rawRender'])).convert('RGBA')
        require(decoded.size == atlas.size == raw.size == (1024, 128), 'Atlas dimensions differ')
        require(decoded.tobytes() == raw.tobytes() == atlas.tobytes(), f'Reconstructed complete figures differ: {key}/{direction}')
        report = read_json(local(root, item['report']))
        require(item['frames'] == report['frames'] == frames, 'Reported source geometry or pixels changed')
        require(item['uniformDirectionScale'] == report['uniformDirectionScale'] == scale, 'Per-direction scale changed')
        require(item['sourceIds'] == sorted({f['source'] for f in frames}), 'Frame source dependencies differ')
        require(item['sourceHashes'] == {source_id: manifest['sources'][source_id]['image']['sha256'] for source_id in item['sourceIds']}, 'Atlas source hashes differ')
        require([f['pose'] for f in frames] == POSES, 'Pose order changed')
        rebuilt[(key, direction)] = scale
    expected_portraits = {key for key, direction in actual if direction == 'south'}
    portraits = manifest.get('portraits', [])
    require(len(portraits) == len(expected_portraits) and {p['key'] for p in portraits} == expected_portraits, 'Missing/duplicate south-idle portrait')
    for item in portraits:
        key = item['key']
        require(item['asset'] == f'public/images/launcher_room/portrait_v3/{key}.webp', 'Unexpected portrait path')
        require(item['direction'] == 'south' and item['pose'] == 'idle' and item['wholeBody'] is True, 'Portrait must be the complete south idle figure')
        require(item['assetPixels'] == [256, 256] and item['root'] == [128, 224], 'Portrait geometry changed')
        require(digest(local(root, item['asset'])) == item['assetSha256'] and local(root, item['asset']).stat().st_size == item['assetBytes'], 'Portrait asset changed')
        require(digest(local(root, item['rawRender'])) == item['rawRenderSha256'], 'Raw portrait changed')
        frame = groups[(key, 'south')][0]
        require(item['source'] == frame['source'], 'Portrait source differs from south idle')
        scale = rebuilt[(key, 'south')]
        image, transform = render_one(extract_frame(frame, images[frame['source']]), scale, 256)
        decoded = Image.open(local(root, item['asset'])).convert('RGBA')
        raw = Image.open(local(root, item['rawRender'])).convert('RGBA')
        require(image.size == decoded.size == raw.size == (256, 256) and image.tobytes() == decoded.tobytes() == raw.tobytes(), 'Portrait reconstruction differs')
        require(item['uniformDirectionScale'] == scale and item['inverseWholeImageTransform'] == transform and item['bounds'] == pixel_bounds(image), 'Portrait transform changed')
        require(item['rgbaSha256'] == hashlib.sha256(image.tobytes()).hexdigest(), 'Portrait RGBA changed')
    return {'ok': True, 'atlases': len(actual), 'frames': len(actual) * 8, 'portraits': len(portraits),
            'sources': len(images), 'requireComplete': require_complete, 'fixtureSources': manifest['fixtureSources'],
            'walkProvided': False, 'visualAccepted': False, 'reconstructedEveryFrame': True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', required=True)
    parser.add_argument('--require-complete', action='store_true')
    parser.add_argument('--allow-fixture-sources', action='store_true')
    parser.add_argument('--out')
    args = parser.parse_args()
    result = verify(args.root, args.require_complete, args.allow_fixture_sources)
    if args.out:
        Path(args.out).write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result))


if __name__ == '__main__':
    main()
