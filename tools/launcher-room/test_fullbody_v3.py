"""Behavioral importer fixtures. These synthetic shapes are never production character art."""
import copy
import json
from pathlib import Path
import tempfile
import unittest

from PIL import Image, ImageDraw

from import_fullbody_v3 import (MANIFEST, POSES, digest, extract_frame, import_bundle, read_json,
                               validate_plan, write_json)
from validate_fullbody_v3 import verify


class WholeFigureImportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='fullbody-v3-fixture-')
        self.root = Path(self.temp.name)
        source = Image.new('RGBA', (1000, 230))
        draw = ImageDraw.Draw(source)
        self.regions = []
        for index in range(8):
            x, y = (index % 4) * 250, (index // 4) * 115
            draw.ellipse((x + 83, y + 14, x + 111, y + 43), fill=(250, 180, 70, 255))
            draw.rectangle((x + 89, y + 36, x + 105, y + 90), fill=(20 + index * 20, 80, 170, 255))
            draw.rectangle((x + 88, y + 54, x + 89, y + 75), fill=(30, 80, 170, 70))
            draw.point((x + 40, y + 50), fill=(255, 10, 10, 40))
            self.regions.append([x + 20, y + 3, 170, 100])
        source.save(self.root / 'source.png')
        (self.root / 'prompt.txt').write_text('Synthetic importer validation fixture only; not a generated character.', encoding='utf-8')
        write_json(self.root / 'receipt.json', {'tool': 'synthetic-fixture', 'productionArt': False})
        refs = {kind: {'path': name, 'sha256': digest(self.root / name)} for kind, name in [('image', 'source.png'), ('prompt', 'prompt.txt'), ('receipt', 'receipt.json')]}
        self.plan = {'schema': 'one-piece-room-fullbody-selection/1', 'sources': {'fixture': {'generator': 'synthetic-fixture', **refs}},
                     'frames': [{'key': 'luffy', 'direction': direction, 'pose': pose, 'source': 'fixture', 'region': self.regions[index]}
                                for direction in ['east', 'west', 'north', 'south'] for index, pose in enumerate(POSES)]}
        self.plan_path = self.root / 'plan.json'
        write_json(self.plan_path, self.plan)

    def tearDown(self):
        self.temp.cleanup()

    def build(self):
        output = self.root / 'bundle'
        import_bundle(self.plan_path, self.root, output, True)
        return output

    def test_all_pose_and_portrait_pixels_reconstruct(self):
        report = verify(self.build(), allow_fixture=True)
        self.assertEqual((report['atlases'], report['frames'], report['portraits']), (4, 32, 1))
        self.assertTrue(report['reconstructedEveryFrame'])
        self.assertFalse(report['walkProvided'])

    def test_fixture_cannot_pass_production_gate(self):
        with self.assertRaisesRegex(ValueError, 'Synthetic fixtures'):
            verify(self.build())

    def test_missing_characters_fail_complete_gate(self):
        with self.assertRaisesRegex(ValueError, 'requires 40'):
            verify(self.build(), require_complete=True, allow_fixture=True)

    def test_antialias_preserved_and_remote_speck_removed(self):
        item = self.plan['frames'][0]
        extracted = extract_frame(item, Image.open(self.root / 'source.png'))
        self.assertEqual(extracted['removedDistantAlphaPixels'], 1)
        self.assertIn(70, set(extracted['image'].getchannel('A').tobytes()))

    def test_original_canvas_antialias_is_retained_and_reported(self):
        image = Image.new('RGBA', (60, 100)); draw = ImageDraw.Draw(image)
        draw.rectangle((2, 10, 22, 90), fill=(40, 80, 150, 255))
        draw.rectangle((0, 30, 1, 60), fill=(40, 80, 150, 70))
        frame = {**self.plan['frames'][0], 'region': [0, 0, 60, 100]}
        extracted = extract_frame(frame, image)
        self.assertEqual(extracted['sourceAaTouchesImageBoundary'], [True, False, False, False])
        self.assertIn(70, set(extracted['image'].getchannel('A').tobytes()))

    def test_independent_resolution_replacement_keeps_common_direction_scale(self):
        Image.open(self.root / 'source.png').resize((2000, 460), Image.Resampling.NEAREST).save(self.root / 'replacement.png')
        replacement = copy.deepcopy(self.plan['sources']['fixture'])
        replacement['image'] = {'path': 'replacement.png', 'sha256': digest(self.root / 'replacement.png')}
        self.plan['sources']['replacement'] = replacement
        frame = self.plan['frames'][3]
        frame.update(source='replacement', region=[n * 2 for n in frame['region']], sourceUnitScale=.5,
                     sourceUnitScaleReason='Independent replacement fixture uses twice the authored source resolution.')
        write_json(self.plan_path, self.plan)
        output = self.build(); verify(output, allow_fixture=True)
        east = next(item for item in read_json(output / MANIFEST)['items'] if item['direction'] == 'east')
        self.assertEqual(len(east['sourceIds']), 2)
        self.assertEqual(len({frame['uniformDirectionScale'] for frame in east['frames']}), 1)
        self.assertEqual(east['frames'][3]['wholeImageScale'], east['uniformDirectionScale'] * .5)

    def test_source_clip_is_rejected_before_write(self):
        self.plan['frames'][0]['region'] = [89, 36, 17, 55]
        write_json(self.plan_path, self.plan)
        with self.assertRaisesRegex(ValueError, 'clips'):
            import_bundle(self.plan_path, self.root, self.root / 'bad', True)
        self.assertFalse((self.root / 'bad').exists())

    def test_common_output_scale_reconstructs_and_rejects_pose_specific_scaling(self):
        for frame in self.plan['frames']:
            frame.update(outputScale=.8, outputScaleReason='Keep the complete standing and walking figures at the same authored body height.')
        write_json(self.plan_path, self.plan)
        output = self.build()
        verify(output, allow_fixture=True)
        manifest = read_json(output / MANIFEST)
        self.assertTrue(all(frame['outputScale'] == .8 for item in manifest['items'] for frame in item['frames']))
        self.plan['frames'][0]['outputScale'] = .7
        write_json(self.plan_path, self.plan)
        with self.assertRaisesRegex(ValueError, 'same whole-atlas'):
            import_bundle(self.plan_path, self.root, self.root / 'inconsistent', True)

    def test_ambiguous_multiple_characters_require_seed(self):
        frame = copy.deepcopy(self.plan['frames'][0]); frame['region'] = [20, 3, 460, 100]
        with self.assertRaisesRegex(ValueError, 'Ambiguous'):
            extract_frame(frame, Image.open(self.root / 'source.png'))
        frame['componentSeed'] = [96, 25]
        self.assertGreater(extract_frame(frame, Image.open(self.root / 'source.png'))['opaquePixels'], 64)

    def test_corrupt_source_sha_is_rejected(self):
        (self.root / 'prompt.txt').write_text('Changed source prompt after review', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'SHA-256 mismatch'):
            import_bundle(self.plan_path, self.root, self.root / 'bad', True)

    def test_existing_directory_is_never_overwritten(self):
        output = self.build()
        sentinel = output / 'user-original.txt'; sentinel.write_text('keep', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'never overwritten'):
            import_bundle(self.plan_path, self.root, output, True)
        self.assertEqual(sentinel.read_text(), 'keep')

    def test_missing_pose_and_mirror_field_rejected(self):
        incomplete = copy.deepcopy(self.plan); incomplete['frames'].pop()
        with self.assertRaisesRegex(ValueError, 'eight'):
            validate_plan(incomplete, self.root, True)
        self.plan['frames'][0]['mirror'] = True
        with self.assertRaisesRegex(ValueError, 'assembly/mirroring'):
            validate_plan(self.plan, self.root, True)

    def test_modified_atlas_and_false_walk_claim_rejected(self):
        output = self.build(); manifest = read_json(output / MANIFEST)
        asset = output / manifest['items'][0]['asset']; original = asset.read_bytes(); asset.write_bytes(original + b'tampered')
        with self.assertRaisesRegex(ValueError, 'Atlas SHA'):
            verify(output, allow_fixture=True)
        asset.write_bytes(original); manifest['walkProvided'] = True; write_json(output / MANIFEST, manifest)
        with self.assertRaisesRegex(ValueError, 'cannot claim'):
            verify(output, allow_fixture=True)

    def test_region_reselection_is_detected(self):
        output = self.build(); manifest = read_json(output / MANIFEST)
        resolved_file = output / manifest['resolvedSelection']['path']; resolved = read_json(resolved_file)
        resolved['frames'][0]['region'] = self.regions[1]
        write_json(resolved_file, resolved); manifest['resolvedSelection']['sha256'] = digest(resolved_file)
        write_json(output / MANIFEST, manifest)
        with self.assertRaisesRegex(ValueError, 'changed reviewed frame selections'):
            verify(output, allow_fixture=True)


if __name__ == '__main__':
    unittest.main(verbosity=2)
