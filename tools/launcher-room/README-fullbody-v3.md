# Complete character art import (1.1.15)

## Static interaction poses and portraits

`import_fullbody_v3.py` imports complete GPT character images into `acting_v3`. Each direction has exactly eight poses in this order: idle, talk_happy, talk_annoyed, surprised, focused_use, sit, wave, listen. The atlas is 1024×128 (8×1 cells), with root `(64,112)`. A south-idle complete-body portrait is rendered directly from the original source at 256×256, root `(128,224)`, into `portrait_v3`.

The selection schema is `one-piece-room-fullbody-selection/1`. Sources contain `generator: "gpt-image"` and image/prompt/receipt references, each with a relative POSIX `path` and exact `sha256`. Optional `ancestry` preserves original generations, prompts, receipts and whole-figure repacking selections. `frames` contain `key`, `direction`, `pose`, `source` and a complete-character region `[x,y,width,height]` in source pixels. The ten canonical keys are fixed in the importer.

Each region selects one connected body above alpha 128. A reviewed absolute `componentSeed` can disambiguate a region containing another complete figure. A two-pixel neighborhood retains authored antialias pixels; distant alpha noise is removed. Opaque body contact with a region edge is rejected. Antialias-only contact with the original PNG edge is retained and explicitly reported; cutting antialias within the image is rejected. Output alpha must clear every 128px cell edge.

All eight poses share one direction scale, with standing opaque height at most 100 and width at most 112. The whole image is uniformly scaled and translated; no head/limb assembly, mirroring or mesh deformation is performed. A `sourceAnchor` can explicitly identify the whole-figure axis/contact point. A separate-resolution replacement can use `sourceUnitScale`, accompanied by a written `sourceUnitScaleReason`; this calibrates the complete source image before the shared direction scale. It must never be used to independently resize body parts.

An optional `outputScale` (greater than zero, at most one) must be identical for every pose in a direction and include `outputScaleReason`. It uniformly reduces the complete direction atlas to align standing and walking body height across directions. This also prevents raised hands from making the idle body smaller than its walking counterpart. The value is retained in the selection and frame reports and participates in pixel reconstruction; it never rescales anatomy separately.

```powershell
python tools/launcher-room/import_fullbody_v3.py --plan SELECTION.json --source-root SOURCE_ROOT --output NEW_EMPTY_STAGING_DIRECTORY
python tools/launcher-room/validate_fullbody_v3.py --root STAGING_DIRECTORY --require-complete
node tools/launcher-room/validate-fullbody-manifest.js --root STAGING_DIRECTORY
python tools/launcher-room/test_fullbody_v3.py
```

The importer validates all figures before writing. An existing nonempty output directory is rejected. A staged bundle contains original source/prompt/receipt bytes, ancestry, original and resolved selections, raw PNG atlases/portraits, reports, lossless WebP outputs, and `docs/LAUNCHER_ROOM_FULLBODY_ART_20260927.json`. Preserve raw-SHA-bound text using Git `-text` attributes under `tools/launcher-room/fullbody-v3/**`.

The Python validator reconstructs every pose and portrait from the copied original sources, compares decoded RGBA pixels, checks exact hashes and validates the source selection. The JS packaging gate exports `validate(root, {requireComplete:true})`, checks every file hash and lossless WebP dimensions, and returns the manifest plus a compact summary. Both keep `walkProvided:false` and `visualAccepted:false`: this static contract does not create a walking animation or replace visual review. A complete bundle requires 40 atlases, 320 complete poses and ten south-idle portraits. Synthetic test sources are explicitly marked and rejected by production validation.

## Walking: three authored poses, four playback beats

`import_walk_v3.py` uses the separate selection schema `one-piece-room-walk-selection/3`. Its source records have the same `generator`, image/prompt/receipt and optional ancestry SHA references. Each character/direction has exactly three complete authored figures named `contact-a`, `neutral`, `contact-c`. Frame records contain `key`, `direction`, `pose`, `source`, region `[x,y,width,height]`, and optional whole-figure `sourceAnchor`, `sourceUnitScale` and `sourceUnitScaleReason`.

```powershell
python tools/launcher-room/import_walk_v3.py --plan WALK_SELECTION.json --source-root SOURCE_ROOT --output NEW_EMPTY_WALK_STAGING_DIRECTORY
# A partial character set is for local previews only:
python tools/launcher-room/import_walk_v3.py --allow-partial --plan CHARACTER_SELECTION.json --source-root SOURCE_ROOT --output NEW_EMPTY_PREVIEW_DIRECTORY
```

The production importer requires all ten canonical characters in east/west/north/south. Each `motion_v3/<key>/<direction>.webp` is 512×128: four 128px cells, root `(64,112)`, ordered `contact-a, neutral, contact-c, neutral`. The fourth cell exactly reuses the neutral whole figure. Forty walking atlases therefore contain 120 authored whole-body poses and 160 playback frames. The shared extraction and direction-scale rules above also apply to walking. No in-between limb drawings, skeleton interpolation, body-part warping or horizontal mirroring are created.

The walk staging bundle contains `tools/launcher-room/walk-v3/` original sources, prompts, receipts, ancestry, original/resolved selections, raw PNG renders and reports, plus `docs/LAUNCHER_ROOM_WALK_V3_20260927.json` with schema `one-piece-room-walk-art/3`. Existing nonempty output directories are refused. Review successful staging output before copying the exact selected bundle into the candidate; a failed import is not publishable output. `--allow-partial` sets `partial:true` and cannot pass the complete release gate.

`acting_v3` remains eight **single static poses** per direction. Those eight columns are different interaction types, not an eight-frame or four-beat action animation. Runtime walking plays the four authored beats; speaking/listening or other interactions select the appropriate complete static pose.

## Combined release gate and rendered review

The source package QA calls `require('../tools/launcher-room/validate-fullbody-release').validate(ROOT)`. To validate the candidate tree directly:

```powershell
node tools/launcher-room/validate-fullbody-release.js
# To validate a combined staging tree from the repository directory:
node -e "console.log(JSON.stringify(require('./tools/launcher-room/validate-fullbody-release').validate(process.argv[1])))" COMPLETE_BUNDLE_ROOT
```

The combined gate runs the complete static validator, requires 40 static atlases, 40 non-partial four-beat walking atlases, and ten whole-body portraits, and checks exact manifest/source/prompt/receipt/ancestry/selection/output/report bytes. It verifies the walking cell dimensions, pose order and per-frame no-clipping/no-assembly/no-mirroring fields. The raw 80 atlas PNGs and ten portrait PNGs remain required provenance; do not omit them from a source checkout or synchronization bundle.

`tools/launcher-room/fullbody-v3/review.json` must have `scope:"rendered-asset-inspection"`, `status:"REVIEWED"`, all ten characters marked `inspected:true`, SHA bindings to both exact art manifests, and at least one real rendered evidence entry with repository-relative `path` and `sha256`. Evidence files must exist and match those hashes. Replacing a selected manifest invalidates its review. The importers and structural validators never set visual acceptance automatically; the combined gate reports `humanAcceptance:false`. A passing local gate does not claim public deployment or player acceptance.

## Exact bytes on Windows

Both art manifests and every file under `tools/launcher-room/fullbody-v3/**` and `tools/launcher-room/walk-v3/**` have Git `-text` attributes. This protects source prompts, receipts, selections, reports, reviews and evidence from CRLF conversion because their raw bytes are SHA-bound. The separate importer/validator helper source files are not currently SHA-bound by these manifests; ordinary Git EOL handling of those helper files does not invalidate provenance hashes. If a future manifest binds helper bytes, add exact `-text` rules before hashing them. Keep original generated PNG bytes and their ancestry even when whole figures are selected from a later corrected source.

These import tools write art bundles only. Runtime integration, saved game data, shop rules, package entrypoints and release publication are handled separately.
