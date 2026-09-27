"""Export reserved crew as whole-figure atlases. This never enables a character.

Requires all four characters and all seven reviewed sheets per character. The
output is a NEW staging tree; neither input sources nor existing assets change.
Run --self-test into a separate empty folder for synthetic geometry probes.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import shutil

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve()
LEGACY_PATH = HERE.parent.parent / 'import_fullbody_v3.py'
spec = importlib.util.spec_from_file_location('reserved_whole_figure_extractor', LEGACY_PATH)
legacy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(legacy)
KEYS = ['ace', 'sabo', 'law', 'hancock']
DIRS = ['east', 'west', 'north', 'south']
POSES = ['idle', 'talk_happy', 'talk_annoyed', 'surprised', 'focused_use', 'sit', 'wave', 'listen']
SHEETS = {
    'master': {'grid': [2, 2], 'standing': [1, 1]},
    'walk-side': {'grid': [3, 2], 'standing': [1, 0]},
    'walk-front': {'grid': [3, 2], 'standing': [1, 0]},
    'acting-side': {'grid': [4, 4], 'standing': [0, 0]},
    'acting-front': {'grid': [4, 4], 'standing': [0, 0]},
    'work': {'grid': [4, 4], 'standing': [0, 0]},
    'utility': {'grid': [4, 4], 'standing': [0, 3]},
}
BASE = 'tools/launcher-room/reserved-v1'
ASSET_ROOT = 'public/images/launcher_room/reserved_v1'
MANIFEST = f'{BASE}/manifest.json'
PLAN_SCHEMA = 'one-piece-room-reserved-selection/1'
require, digest, local = legacy.require, legacy.digest, legacy.local
read_json, write_json, checked_file = legacy.read_json, legacy.write_json, legacy.checked_file


def ref(root: Path, name: str) -> dict:
    value = local(root, name)
    return {'path': name, 'sha256': digest(value), 'bytes': value.stat().st_size}


def no_anatomy_fields(value):
    forbidden = {'parts', 'head', 'limbs', 'rig', 'bones', 'flip', 'mirror', 'rotate', 'shear', 'stretch'}
    if isinstance(value, dict):
        require(not forbidden.intersection(value), 'Anatomy assembly, mirroring and nonuniform transforms are forbidden')
        for child in value.values():
            no_anatomy_fields(child)
    elif isinstance(value, list):
        for child in value:
            no_anatomy_fields(child)


def validate_plan(plan, root, allow_fixture=False):
    require(plan.get('schema') == PLAN_SCHEMA, 'Unsupported reserved selection schema')
    require(plan.get('releasePolicy') == 'preloaded-not-released', 'Selection cannot enable characters')
    characters = plan.get('characters')
    require(isinstance(characters, dict) and set(characters) == set(KEYS), 'All four canonical characters are required')
    sources = plan.get('sources')
    require(isinstance(sources, dict) and len(sources) == 28, 'Exactly 28 selected sources are required: four complete seven-sheet sets')
    by_character = {key: {} for key in KEYS}
    for key, config in characters.items():
        require(isinstance(config, dict), f'Invalid character config: {key}')
        scale = config.get('outputScale', 1)
        require(type(scale) in (int, float) and math.isfinite(scale) and 0 < scale <= 1, 'outputScale may only uniformly reduce an entire character')
        if scale != 1:
            require(len(str(config.get('outputScaleReason', '')).strip()) >= 12, 'Explain whole-character calibration')
    no_anatomy_fields(characters)
    for source_id, source in sources.items():
        require(isinstance(source, dict), f'Invalid source record {source_id}')
        require(legacy.re.fullmatch(r'[a-z0-9][a-z0-9_-]{0,79}', source_id), 'Invalid source id')
        key, sheet = source.get('key'), source.get('sheet')
        require(key in KEYS and sheet in SHEETS, f'Unknown character/sheet: {source_id}')
        require(sheet not in by_character[key], f'Duplicate selected sheet: {key}/{sheet}')
        require(source.get('generator') == 'gpt-image' or allow_fixture and source.get('generator') == 'synthetic-fixture', 'Only GPT originals are accepted outside synthetic fixture mode')
        image = checked_file(root, source.get('image'), source_id + '.image')
        require(image.suffix.lower() == '.png', 'Keep selected source PNGs')
        prompt = checked_file(root, source.get('prompt'), source_id + '.prompt').read_text(encoding='utf-8-sig')
        require(len(prompt.strip()) >= 12 and not (prompt.strip().endswith('.txt') and '\n' not in prompt), 'Prompt must contain actual generation instructions')
        receipt = read_json(checked_file(root, source.get('receipt'), source_id + '.receipt'))
        require(isinstance(receipt, dict) and receipt, 'Generation receipt must be a nonempty JSON object')
        evidence_hashes = {source['image']['sha256']}
        for field in ['ancestry', 'processing']:
            require(isinstance(source.get(field, []), list), f'Invalid {field}')
            for index, extra in enumerate(source.get(field, [])):
                checked_file(root, extra, f'{source_id}.{field}[{index}]')
                evidence_hashes.add(extra['sha256'])
        if receipt.get('sourceSha256'):
            require(receipt['sourceSha256'] in evidence_hashes, 'Receipt source hash must bind the selected PNG or preserved ancestry')
        if receipt.get('sourceSha256') and receipt['sourceSha256'] != source['image']['sha256']:
            require(source.get('processing'), 'Processed inputs need separately bound processing evidence')
        no_anatomy_fields(source.get('cells', {}))
        no_anatomy_fields(source.get('standingReference', {}))
        by_character[key][sheet] = source_id
    for key, sheets in by_character.items():
        require(set(sheets) == set(SHEETS), f'Incomplete character: {key}')
    return by_character


def cell_frame(source_id, source, image, col, row, direction, pose):
    cols, rows = SHEETS[source['sheet']]['grid']
    require(0 <= col < cols and 0 <= row < rows, 'Source cell is outside the declared grid')
    x, y, right, bottom = round(col * image.width / cols), round(row * image.height / rows), round((col + 1) * image.width / cols), round((row + 1) * image.height / rows)
    override = source.get('cells', {}).get(f'{row}:{col}', {})
    require(isinstance(override, dict), 'Cell override must be an object')
    require(set(override).issubset({'region', 'sourceAnchor', 'componentSeed'}), 'Cell overrides only select a complete region/anchor/component')
    frame = {'key': source['key'], 'direction': direction, 'pose': pose, 'source': source_id,
             'region': override.get('region', [x, y, right - x, bottom - y]), 'sourceCell': [col, row]}
    for field in ['sourceAnchor', 'componentSeed']:
        if field in override:
            frame[field] = override[field]
    region = frame['region']
    require(isinstance(region, list) and len(region) == 4 and all(type(n) is int for n in region) and min(region[:2]) >= 0 and min(region[2:]) > 0, 'Invalid complete-figure region')
    return frame


def extraction(frame, image):
    result = legacy.extract_frame(frame, image)
    anchor_policy = 'reviewed-source-anchor' if 'sourceAnchor' in frame else 'head-axis-ground-row'
    if frame['pose'] in ['sit', 'rest', 'sleep'] and 'sourceAnchor' not in frame:
        # A seated/lying figure stays smaller. Only translate the complete body so its
        # floor contact is centered; never enlarge it to a standing person's height.
        x, y, width, height = result['opaqueBounds']
        frame = {**frame, 'sourceAnchor': [x + width / 2, y + height]}
        result = legacy.extract_frame(frame, image)
        anchor_policy = 'whole-figure-bounds-center-ground'
    result['anchorPolicy'] = anchor_policy
    return result


def build_specs(key, selected, sources, images):
    def frame(sheet, col, row, direction, pose):
        source_id = selected[sheet]
        return cell_frame(source_id, sources[source_id], images[source_id], col, row, direction, pose)
    specs = [{'key': key, 'kind': 'portrait', 'direction': 'south', 'cell': 256, 'columns': 1,
              'asset': f'{ASSET_ROOT}/{key}/portrait.webp', 'selections': [frame('master', 1, 1, 'south', 'idle')]}]
    for direction in DIRS:
        side = direction in ['east', 'west']
        sheet, row = ('walk-side' if side else 'walk-front'), (0 if direction in ['east', 'north'] else 1)
        specs.append({'key': key, 'kind': 'walk', 'direction': direction, 'cell': 384, 'columns': 4,
                      'asset': f'{ASSET_ROOT}/{key}/walk/{direction}.webp',
                      'selections': [frame(sheet, col, row, direction, ['step-a', 'neutral', 'step-c', 'neutral'][i]) for i, col in enumerate([0, 1, 2, 1])]})
        sheet = 'acting-side' if side else 'acting-front'
        start_row = 0 if direction in ['east', 'north'] else 2
        specs.append({'key': key, 'kind': 'acting', 'direction': direction, 'cell': 256, 'columns': 8,
                      'asset': f'{ASSET_ROOT}/{key}/acting/{direction}.webp',
                      'selections': [frame(sheet, index % 4, start_row + index // 4, direction, pose) for index, pose in enumerate(POSES)]})
        specs.append({'key': key, 'kind': 'life', 'action': 'work', 'direction': direction, 'cell': 256, 'columns': 4,
                      'asset': f'{ASSET_ROOT}/{key}/life/work-{direction}.webp',
                      'selections': [frame('work', col, DIRS.index(direction), direction, 'work') for col in range(4)]})
    for row, action in enumerate(['eat', 'rest', 'sleep', 'train']):
        specs.append({'key': key, 'kind': 'life', 'action': action, 'direction': 'south', 'cell': 256, 'columns': 4,
                      'asset': f'{ASSET_ROOT}/{key}/life/{action}-south.webp',
                      'selections': [frame('utility', col, row, 'south', action) for col in range(4)]})
    return specs


def prepare(plan, root, by_character):
    images = {name: Image.open(checked_file(root, source['image'], name)).convert('RGBA') for name, source in plan['sources'].items()}
    references, source_units, scales = {}, {}, {}
    for key in KEYS:
        for sheet, source_id in by_character[key].items():
            source, image = plan['sources'][source_id], images[source_id]
            standing = source.get('standingReference', {})
            require(isinstance(standing, dict), 'standingReference must be an object')
            col, row = standing.get('cell', SHEETS[sheet]['standing'])
            require(type(col) is int and type(row) is int, 'Standing reference uses integer [col,row]')
            frame = cell_frame(source_id, source, image, col, row, 'south', 'calibration-standing')
            if 'sourceAnchor' in standing:
                frame['sourceAnchor'] = standing['sourceAnchor']
            extracted = extraction(frame, image)
            references[source_id] = {'frame': frame, 'opaqueBounds': extracted['opaqueBounds'], 'sourceAnchor': extracted['sourceAnchor'],
                                     'standingHeight': extracted['opaqueBounds'][3], 'purpose': 'One standing reference sets a shared scale for every complete figure on this source'}
        master_height = references[by_character[key]['master']]['standingHeight']
        scales[key] = 100 / master_height * plan['characters'][key].get('outputScale', 1)
        for source_id in by_character[key].values():
            source_units[source_id] = master_height / references[source_id]['standingHeight']
    prepared = []
    for key in KEYS:
        for item in build_specs(key, by_character[key], plan['sources'], images):
            cell, columns = item['cell'], item['columns']
            atlas, records = Image.new('RGBA', (cell * columns, cell)), []
            for index, frame in enumerate(item.pop('selections')):
                value = extraction(frame, images[frame['source']])
                value['sourceUnitScale'] = source_units[frame['source']]
                image, transform = legacy.render_one(value, scales[key], cell)
                bounds, opaque = legacy.pixel_bounds(image), legacy.pixel_bounds(image, True)
                require(bounds and opaque and min(bounds[:2]) > 0 and max(bounds[2:]) < cell, f'Output alpha clips {key}/{item["kind"]}/{item.get("action", item["direction"])}/{index}; review region/reference/whole-character scale')
                require(opaque[2] - opaque[0] <= math.ceil(112 * cell / 128), f'Figure exceeds safe width: {key}/{frame["pose"]}')
                atlas.paste(image, (index * cell, 0))
                records.append({**copy.deepcopy(frame), 'index': index, 'bounds': bounds, 'opaqueBoundsAtOutput': opaque,
                    **{name: value[name] for name in ['sourceAnchor', 'localAnchor', 'sourceAlphaBounds', 'opaqueBounds', 'opaquePixels', 'removedDistantAlphaPixels', 'sourceOpaqueClearance', 'edgeAaRadius', 'sourceAaTouchesImageBoundary', 'anchorPolicy']},
                    'sourceUnitScale': source_units[frame['source']], 'uniformCharacterScale': scales[key],
                    'wholeImageScale': scales[key] * source_units[frame['source']] * cell / 128,
                    'inverseWholeImageTransform': transform, 'rgbaSha256': hashlib.sha256(image.tobytes()).hexdigest(),
                    'anatomyReassembled': False, 'mirrored': False, 'clipped': False})
            prepared.append({**item, 'atlas': atlas, 'dimensions': list(atlas.size), 'frames': records,
                             'sourceIds': sorted({frame['source'] for frame in records})})
    require(len(prepared) == 68 and sum(len(i['frames']) for i in prepared) == 324, 'Internal frame coverage mismatch')
    return prepared, images, references


def make_contacts(output, items):
    contacts = []
    for key in KEYS:
        size, cols, rows = 192, 8, 11
        image = Image.new('RGB', (size * cols, size * rows), '#142e37')
        draw = ImageDraw.Draw(image)
        index = 0
        for item in (i for i in items if i['key'] == key):
            atlas = Image.open(local(output, item['asset'])).convert('RGBA')
            for frame in item['frames']:
                x, y = index % cols * size, index // cols * size
                draw.rectangle((x + 2, y + 21, x + size - 3, y + size - 3), fill='#b4c8c5')
                cell = item['cell']
                crop = atlas.crop((frame['index'] * cell, 0, (frame['index'] + 1) * cell, cell))
                crop.thumbnail((168, 168), Image.Resampling.LANCZOS)
                image.paste(crop, (x + (size - crop.width) // 2, y + 21), crop)
                draw.text((x + 5, y + 4), f'{item.get("action", item["kind"])} {item["direction"]} {frame["index"]}', fill='white')
                index += 1
        require(index == 81, 'Contact sheet must show every character frame')
        name = f'{BASE}/contacts/{key}.png'
        local(output, name).parent.mkdir(parents=True, exist_ok=True)
        image.save(local(output, name))
        contacts.append({'key': key, **ref(output, name), 'dimensions': list(image.size), 'frameCount': index})
    return contacts


def pixel_qa(output, items):
    results = []
    for item in items:
        image = Image.open(local(output, item['asset'])).convert('RGBA')
        require(list(image.size) == item['dimensions'], 'Decoded WebP size differs from atlas')
        require(image.getextrema()[3][0] == 0 and image.getextrema()[3][1] == 255, 'Output must contain transparent margin and opaque figure pixels')
        frames = []
        for frame in item['frames']:
            i, cell = frame['index'], item['cell']
            decoded = image.crop((i * cell, 0, (i + 1) * cell, cell))
            rgba_sha = hashlib.sha256(decoded.tobytes()).hexdigest()
            bounds = legacy.pixel_bounds(decoded)
            require(rgba_sha == frame['rgbaSha256'], 'Lossless WebP decoder changed RGBA pixels')
            require(bounds == frame['bounds'] and min(bounds[:2]) > 0 and max(bounds[2:]) < cell, 'Decoded cell is clipped')
            frames.append({'index': i, 'rgbaSha256': rgba_sha, 'bounds': bounds, 'clipped': False,
                           'alphaExtrema': list(decoded.getextrema()[3]), 'opaqueBounds': legacy.pixel_bounds(decoded, True)})
        if item['kind'] == 'walk':
            require(frames[1]['rgbaSha256'] == frames[3]['rgbaSha256'], 'Walk order must repeat the same complete neutral frame at slots 1 and 3')
        results.append({'asset': item['asset'], 'sha256': item['sha256'], 'dimensions': item['dimensions'], 'hasAlpha': True, 'frames': frames})
    return {'schema': 'one-piece-room-reserved-pixel-qa/1', 'ok': True, 'assetCount': len(results),
            'frameCount': sum(len(i['frames']) for i in results), 'items': results,
            'scope': 'Actual lossless WebP decode, per-cell RGBA hashes, alpha and bounds only; not art or animation acceptance', 'humanAcceptance': False}


def import_bundle(plan_path, source_root, output, allow_fixture=False):
    plan_path, source_root, output = Path(plan_path).resolve(), Path(source_root).resolve(), Path(output).resolve()
    require(not output.exists() or output.is_dir() and not any(output.iterdir()), 'Output must be a NEW/empty staging directory; no files are overwritten')
    require(not source_root.is_relative_to(output), 'Output may not contain the source root')
    plan = read_json(plan_path)
    by_character = validate_plan(plan, source_root, allow_fixture)
    # Validate and render all 324 complete figures in memory before touching staging.
    prepared, images, references = prepare(plan, source_root, by_character)
    output.mkdir(parents=True, exist_ok=True)
    sources = copy.deepcopy(plan['sources'])
    for source_id, source in sources.items():
        for field in ['image', 'prompt', 'receipt']:
            record = source[field]
            original = checked_file(source_root, record, source_id + '.' + field)
            target = local(output, record['path']); target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists(): shutil.copyfile(original, target)
            require(digest(target) == record['sha256'], 'Conflicting provenance paths')
            source[field] = ref(output, record['path'])
        for field in ['ancestry', 'processing']:
            for record in source.get(field, []):
                original = checked_file(source_root, record, source_id + '.' + field)
                target = local(output, record['path']); target.parent.mkdir(parents=True, exist_ok=True)
                if not target.exists(): shutil.copyfile(original, target)
                require(digest(target) == record['sha256'], 'Conflicting ancillary provenance')
        source['dimensions'] = list(images[source_id].size)
        source['standingCalibration'] = references[source_id]
    original_name = f'{BASE}/original-selection.json'
    shutil.copyfile(plan_path, local(output, original_name))
    resolved_name = f'{BASE}/resolved-selection.json'
    write_json(local(output, resolved_name), {**plan, 'sources': sources, 'sourceCalibration': references})
    for name, source_file in [(f'{BASE}/import_atlases.py', HERE), ('tools/launcher-room/import_fullbody_v3.py', LEGACY_PATH)]:
        target = local(output, name); target.parent.mkdir(parents=True, exist_ok=True); shutil.copyfile(source_file, target)
    items = []
    for prepared_item in prepared:
        item = {key: value for key, value in prepared_item.items() if key != 'atlas'}
        target = local(output, item['asset']); target.parent.mkdir(parents=True, exist_ok=True)
        prepared_item['atlas'].save(target, format='WEBP', lossless=True, exact=True, method=6)
        item['sha256'], item['bytes'] = digest(target), target.stat().st_size
        report_name = f'{BASE}/reports/{item["key"]}/{item.get("action", item["kind"])}-{item["direction"]}.json'
        report = {'schema': 'one-piece-room-reserved-import-report/1', 'key': item['key'], 'asset': item['asset'], 'dimensions': item['dimensions'],
                  'cell': item['cell'], 'columns': item['columns'], 'root': [item['cell'] / 2, item['cell'] * 7 / 8],
                  'frames': item['frames'], 'sourceIds': item['sourceIds'], 'visualAccepted': False, 'humanAcceptance': False}
        write_json(local(output, report_name), report)
        item['report'] = ref(output, report_name)
        items.append(item)
    qa_name = f'{BASE}/pixel-qa.json'
    write_json(local(output, qa_name), pixel_qa(output, items))
    contacts = make_contacts(output, items)
    manifest = {'schema': 'one-piece-room-reserved-art/1', 'status': 'PASS', 'version': '1.2.5',
                'canonicalCharactersOnly': True, 'releasePolicy': 'preloaded-not-released', 'exportContractFinalized': True,
                'fixtureSources': any(s['generator'] == 'synthetic-fixture' for s in sources.values()),
                'visualAccepted': False, 'humanAcceptance': False, 'requiresIndependentVisualReview': True,
                'items': items, 'sources': sources, 'contactSheets': contacts, 'pixelQa': ref(output, qa_name),
                'originalSelection': ref(output, original_name), 'resolvedSelection': ref(output, resolved_name),
                'importer': ref(output, f'{BASE}/import_atlases.py'), 'legacyExtractor': ref(output, 'tools/launcher-room/import_fullbody_v3.py'),
                'poseOrder': POSES, 'walkOrder': ['step-a', 'neutral', 'step-c', 'neutral'],
                'processingRules': {'wholeFigureOnly': True, 'anatomyReassembled': False, 'mirrored': False,
                    'sourceCalibration': 'Master standing reference sets target height; every source uses one standing reference and one shared scale for every pose',
                    'targetStandingHeightAt128': 100, 'rootAt128': [64, 112], 'edgeAaRadius': 2,
                    'alphaCleanup': 'Keep largest reviewed complete opaque component and alpha within radius2; discard distant alpha; zero fully transparent RGBA',
                    'transforms': 'One complete-image uniform scale and translation only; no per-frame size fit; sit/rest/sleep keep source proportions'}}
    write_json(local(output, MANIFEST), manifest)
    return {'ok': True, 'output': str(output), 'manifest': MANIFEST, 'assets': 68, 'frames': 324,
            'fixtureSources': manifest['fixtureSources'], 'visualAccepted': False, 'humanAcceptance': False}


def self_test(output):
    output = Path(output).resolve()
    require(not output.exists(), 'Self-test output must be a new directory')
    source_root = output / 'inputs'; source_root.mkdir(parents=True)
    plan = {'schema': PLAN_SCHEMA, 'releasePolicy': 'preloaded-not-released', 'characters': {key: {} for key in KEYS}, 'sources': {}}
    for key_index, key in enumerate(KEYS):
        for sheet, shape in SHEETS.items():
            cols, rows = shape['grid']; cell = 240
            image = Image.new('RGBA', (cols * cell, rows * cell)); draw = ImageDraw.Draw(image)
            for row in range(rows):
                for col in range(cols):
                    x, y = col * cell, row * cell
                    short = sheet == 'utility' and row in [1, 2] or sheet.startswith('acting') and row % 2 == 1 and col == 1
                    height = 90 if short else 180
                    color = (60 + key_index * 30, 120 + col * 10, 150 + row * 10, 255)
                    top, bottom = y + 210 - height, y + 210
                    draw.ellipse((x + 95, top, x + 145, top + 50), fill=color)
                    draw.rectangle((x + 96, top + 35, x + 144, bottom - 24), fill=color)
                    draw.rectangle((x + 95, bottom - 30, x + 112, bottom), fill=color)
                    draw.rectangle((x + 129, bottom - 30, x + 146, bottom), fill=color)
                    draw.point((x + 4, y + 4), fill=(255, 255, 255, 2))
            base = f'{BASE}/sources/{key}/{sheet}-fixture'
            image_path = local(source_root, base + '/source.png'); image_path.parent.mkdir(parents=True, exist_ok=True); image.save(image_path)
            local(source_root, base + '/prompt.txt').write_text('SYNTHETIC GEOMETRY FIXTURE ONLY. This is not character artwork and may never be released.', encoding='utf-8')
            write_json(local(source_root, base + '/receipt.json'), {'generator': 'synthetic-fixture', 'sourceSha256': digest(image_path), 'humanAcceptance': False})
            plan['sources'][f'{key}-{sheet}'] = {'key': key, 'sheet': sheet, 'generator': 'synthetic-fixture',
                                               **{field: ref(source_root, base + '/' + name) for field, name in [('image', 'source.png'), ('prompt', 'prompt.txt'), ('receipt', 'receipt.json')]}}
    plan_path = source_root / 'selection.json'; write_json(plan_path, plan)
    checks = []
    def rejected(name, candidate, **kwargs):
        try: validate_plan(candidate, source_root, **kwargs)
        except (ValueError, OSError): checks.append({'name': name, 'status': 'PASS'}); return
        raise AssertionError('Expected rejection: ' + name)
    rejected('synthetic-assets-refused-without-explicit-fixture-mode', plan)
    partial = copy.deepcopy(plan); partial['sources'].pop(next(iter(partial['sources'])))
    rejected('missing-source-set-refused-before-export', partial, allow_fixture=True)
    poisoned = copy.deepcopy(plan); next(iter(poisoned['sources'].values()))['cells'] = {'0:0': {'flip': True}}
    rejected('anatomy-mirroring-field-refused', poisoned, allow_fixture=True)
    changed = copy.deepcopy(plan); next(iter(changed['sources'].values()))['image']['sha256'] = '0' * 64
    rejected('changed-source-hash-refused', changed, allow_fixture=True)
    result = import_bundle(plan_path, source_root, output / 'export', True)
    manifest = read_json(output / 'export' / MANIFEST)
    require(manifest['fixtureSources'] and not manifest['visualAccepted'], 'Fixture must never claim final art')
    checks.append({'name': 'full-68-atlases-324-frames-actual-webp-decode', 'status': 'PASS'})
    work = next(i for i in manifest['items'] if i['key'] == 'ace' and i.get('action') == 'work' and i['direction'] == 'south')
    sleep = next(i for i in manifest['items'] if i['key'] == 'ace' and i.get('action') == 'sleep')
    extent = lambda frame: frame['opaqueBoundsAtOutput'][3] - frame['opaqueBoundsAtOutput'][1]
    require(extent(sleep['frames'][0]) < extent(work['frames'][0]) * .65, 'Seated/lying figures must not stretch to standing height')
    require(sum(f['removedDistantAlphaPixels'] for i in manifest['items'] for f in i['frames']) > 0, 'Distant low-alpha pixels were not removed')
    checks.extend([{'name': 'lying-height-retained-with-common-source-scale', 'status': 'PASS'}, {'name': 'distant-alpha-trim-recorded', 'status': 'PASS'}])
    before = digest(output / 'export' / MANIFEST)
    try: import_bundle(plan_path, source_root, output / 'export', True)
    except ValueError: checks.append({'name': 'existing-output-is-never-overwritten', 'status': 'PASS'})
    else: raise AssertionError('Expected existing-output refusal')
    require(digest(output / 'export' / MANIFEST) == before, 'Refused overwrite changed original export')
    report = {'schema': 'one-piece-room-reserved-importer-fixture-qa/1', 'ok': True, 'checks': checks,
              'importerSha256': digest(HERE), 'legacyExtractorSha256': digest(LEGACY_PATH), 'result': result,
              'scope': 'Synthetic geometry and actual WebP round-trip only. No real character source, artistic review or deployment acceptance.', 'humanAcceptance': False}
    write_json(output / 'IMPORTER_FIXTURE_QA.json', report)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan')
    parser.add_argument('--source-root')
    parser.add_argument('--output', required=True)
    parser.add_argument('--allow-fixture-sources', action='store_true')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        result = self_test(args.output)
    else:
        require(args.plan and args.source_root, '--plan and --source-root are required')
        result = import_bundle(args.plan, args.source_root, args.output, args.allow_fixture_sources)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
