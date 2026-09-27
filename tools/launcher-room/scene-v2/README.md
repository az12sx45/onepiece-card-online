# Room scenery and furniture scale — 1.1.16

The four room-only backgrounds were generated with OpenAI's built-in `image_gen` tool. Each folder preserves the exact selected PNG, full prompt, and generation receipt. The runtime WebP is a resize/encoding of that PNG; no painted parts or replacement characters were synthesized locally. Run `python tools/launcher-room/scene-v2/import-scenes.py` from the repository to reproduce the conversion with Pillow 12.2.0.

## Composition

- Runtime stage: 960 × 540; exported backgrounds: 1600 × 900.
- Keep the existing 16 × 8 floor and saved room coordinates: far edge `(164,267)`–`(796,267)`; near edge `(28,515)`–`(932,515)`.
- Elevated cutaway camera, open front, empty walking floor. Small door, windows and fixtures live beyond the far seam. No close-up foreground table or low ocean horizon.
- Generated scenery is checked against the guide and actual actors. Approximate far/near seam error is limited to 30 stage pixels and rear door outer height to 95; these are visual measurements, not segmentation or an exact perspective guarantee.
- Preserve accepted 1.1.15 actor artwork and display sizes. A front-row Luffy is about 74 stage pixels tall; farther actors use the existing depth scale.

## Fixed furniture rendering

Each existing 384 × 384 directional drawing stays whole in a square. Its ground root `(192,372)` is pinned to the saved grid anchor. The front-row square sides are: helm 78; map table 72; chest 56; tangerine tree 104; sword rack 84; kitchen table 80.25; bookshelf 90; medicine cabinet 86; piano 80.25; tool bench 76 stage pixels. Furniture shares the character depth factor. Rotation does not change world size or footprint definitions.

The table and piano retain their accepted hand-contact size, with a small dock offset correction for the newly exact ground root. Furniture IDs, floor cells, save data, shop pricing and character interactions are unchanged. Old shared launcher/profile scenery remains available for earlier clients.

## Provenance and verification

`docs/LAUNCHER_ROOM_SCALE_ART_20260927.json` binds source PNGs, prompts, receipts, exports, geometry references and review evidence by SHA-256. The two existing 1.1.15 character manifests and old shared background files are bound as preserved inputs. Automated geometry/browser tests and manual screenshot inspection are reported separately; neither claims physical-device or human-play acceptance.
