# Directional room rig builds

This tool renders GPT bitmap parts into transparent atlases. It does not generate character pixels, mirror a direction, infer visual approval, or deploy a build. Existing eight-frame cut-sheet tools remain historical; they do not produce the current contract.

## Dependencies and commands

Use Node.js with Playwright and Python with Pillow. `suggest-rig.py` additionally needs NumPy and OpenCV. Set `BOARD_QA_PLAYWRIGHT` to a Playwright module path when it is not installed in the project or desktop dependencies. `BOARD_QA_CHROME` may name a browser executable. `LAUNCHER_ROOM_PYTHON` may name a Python executable. Bundled Codex runtimes are discovered using the current user's local application folder; no account path is hardcoded.

```powershell
node tools/launcher-room/build-room-art.js --plan D:/Codex_QA/selected-rigs.json
node tools/launcher-room/validate-rig-manifest.js
node tools/launcher-room/validate-rig-manifest.js . --reviewed
node scripts/desktop_launcher_package_qa.js
```

After the exact final pixels have been viewed, copy `rig-selection.json`, add the actual reviewer/notes/evidence and set the reviewed entries' status. `node tools/launcher-room/record-rig-review.js --plan reviewed-selection.json` records that explicit review without re-rendering unchanged pixels. It rejects changed source/spec/renderer bindings and incomplete candidates. It does not perform or infer a visual review.

The builder accepts `--root DIRECTORY` for an isolated candidate, `--require-complete` for all 80 atlases, and `--require-reviewed` for explicit review evidence. `--reuse-bakes` re-encodes preserved raw PNGs only when source/spec, rig engine, baker and report hashes still match; changed inputs are rendered again. A normal partial run produces `PARTIAL_CANDIDATE`; the formal validator and packaging QA reject incomplete asset sets. `validate-rig-manifest.js ROOT --partial` is an explicitly scoped candidate diagnostic, never a release gate. Packaged/installer QA additionally requires every direction's review.

## Selected plan

```json
{
  "schema": "one-piece-room-rig-plan/1",
  "version": "1.1.13",
  "entries": [{
    "character": "luffy",
    "direction": "east",
    "spec": "rig-pilot/luffy-east-12.rig.json",
    "source": "rig-kits/luffy/east-01.png",
    "receipt": "rig-kits/luffy/east-01-provenance.json",
    "review": { "status": "pending", "notes": "Assembly needs actual-size review." }
  }]
}
```

Paths resolve relative to the plan. Each spec must reference the exact selected source PNG. A rig may have multiple source sheets, such as a corrected torso. Add `sources: {"sheet":{"source":"...","receipt":"..."},"torsoSheet":{"source":"...","receipt":"..."}}`; part `image` chooses the sheet. If an extra source is omitted from the plan, its exact `spec.images` path and adjacent generation receipt are used. All sources and receipts are copied and hashed. A receipt that points to a prompt text file is normalized to embed the full prompt while retaining its original JSON and hash.

`review.status='reviewed'` additionally requires a named `reviewer`, `notes`, actual `evidence` file paths, `specSha256`, `sourceHashes` by image name (or `sourceSha256` for a single sheet), `assetHashes` for both motion and acting output, and `rendererSha256` / `bakerSha256` matching the selected inputs and current rig engine / baker. Evidence is copied and hashed. Changing a spec, source, renderer or encoded atlas invalidates the old review. The tool never promotes pending entries. The generated `tools/launcher-room/rig-selection.json` contains portable paths and bound hashes for every imported direction, ready for explicit final review and a reproducible rebuild.

## Output and provenance

- `motion-source-png/<key>-<direction>[-<imageKey>].png`: unchanged GPT sources, copied with hash verification.
- `rig-specs/<key>-<direction>.json`: once-calibrated rectangles, clip polygons, roots, joints and actions; source path made portable.
- `motion-receipts/`: original generation receipt plus source/spec/plan hashes and review record.
- `motion-reviews/`: explicit visual evidence, if supplied.
- `rig-build/<key>-<direction>/`: transparent PNG atlases, dark QA contact sheets, and source-hashed full pose reports.
- `public/images/launcher_room/{motion_v2,acting_v2}/<key>/<direction>.webp`: lossless production candidates.
- `public/images/launcher_room/portrait_v2/<key>.webp`: exact 256×256 south idle frame crops for the companion panel; historical portrait art stays untouched.
- `docs/LAUNCHER_ROOM_MOTION_ART_20260926.json`: source/spec/renderer/report/output hashes, all frame bounds, gait and review state.
- `desktop/launcher-room-motion-data.js`: exact per-direction stride and speed from the selected rig specs.

`build-room-art.js` runs the rig stage followed by `build-rig-portraits.py`. The rig stage may also be run alone during calibration; formal packaging additionally requires all ten current portraits. Raw 256px cells are preserved with their reports. Production cells are resized to 128px with Lanczos, then negligible alpha values <=2 and hidden RGB are removed. A lossless RGBA decode comparison verifies the encoded WebP against these resized pixels. Portraits retain the selected raw 256px south idle pixels. Raw sources are never modified. Empty or clipped frames fail the export. Every renderer hash is checked against the current build tools, so changing the rig engine requires re-baking.

## Art and rig contract

Each direction is independently drawn. A twelve-cell source contains four matching head expressions (quiet, happy, annoyed, surprise), headless torso, near/far full arms, near/far continuous hip-to-ankle legs, near/far feet, and an optional accessory. Heads share an authored skull scale/root; the body parent controls direction. No separately rotating head or mirrored sheet is supported.

`one-piece-room-rig/1` specifies source rectangles/optional cut polygons and a one-time scalar calibration per piece. Static pieces use `sourceRoot`, `targetRoot`, `scale`. Limbs use three source `joints`, target `hip`/shoulder and canonical `length`. Missing hidden anatomy requires a new GPT part; the renderer cannot paint gaps. Cuff/skin seams can be cropped inside an authored overlap. `accessory.layer='back'` draws before the body; default `front` draws after torso/head and before the near arm.

Side walking uses two-bone IK with a fixed support-foot world target. The swing foot has a low eased arc. North/south use longitudinal mesh projection and keep knee X on the hip-to-ankle line instead of introducing sideways knee bending. Each direction requires visual inspection; the depth mode's zero IK error is not evidence of realistic gait. `restPose` supplies stationary leg triples and shoulder-relative neutral hands. Each action has expression, limb targets and small `animation` hand deltas/body breath; breathing is capped at 0.5 stage pixels. An action may set `nearArm.layer='back'` when a north-facing hand reaches in front of the character and must be occluded by the torso; the default near arm remains in the foreground.

East/west walk: 32 phases in 8 columns × 4 rows, 128px cells, 1024×512. North/south walk: five vertically stacked 32-phase cycles for ground slopes `[-0.52,-0.26,0,0.26,0.52]`, 8 columns × 20 rows, 1024×2560. This changes only the authored leg/foot projection; the head, torso and arm motion stay identical. Runtime chooses the nearest slope from its floor column. Four-neighbor depth routes keep the column constant; changing columns requires a planted direction turn, so variants do not switch during a straight depth stride. There remain exactly 80 asset paths, 32 phases per cycle, and four actor directions.

Actions: eight groups of four beats in 8 columns × 4 rows, 1024×512; ordered idle, talk_happy, talk_annoyed, surprised, focused_use, sit, wave, listen. The four beats are 0, 0.5, 1, 0.5, normally three distinct images. Published atlases use root `[64,112]`; preserved raw 256px renders use `[128,224]` and twice the width/height. The manifest separates `output` from `renderOutput` and records each raw render SHA plus packed and raw frame bounds. Stride/speed use front-row stage pixels at a 96px character canvas, not atlas pixels. Depth scale must affect image size, speed and stride together.

## Acceptance limits

Current candidate status (2026-09-27): all 80 published atlases and ten portraits pass source/provenance validation. Controller checks passed 16/16, the synthetic-motion browser integration passed 72/72 with actual crew dialogue, the isolated portable pipeline passed eight integrity checks, and source package QA passed. Root inspected all ten final contact sheets with four-direction temporal samples and all eight poses. Continuous real-room playback and furniture checks remain separate pending review; targeted hand calibration must rebind changed atlas hashes. A prepared review plan remains pending until the final explicit reviewer decision. No deployment acceptance follows from these source gates.

Code, controller, provenance, hash and image-format checks do not certify natural walking, character likeness, clothing era, relationships or user acceptance. Review actual room playback in all directions, turns, start/stop, dialogue and furniture interactions at normal speed and half speed. Depth routes must be reviewed at edges and between the five exact bake slopes. Stage-coordinate foot-contact measurements derived from actual root/frame state are distinct from pixel tracking or human visual acceptance.

Methods are informed by [Spine two-bone IK](https://esotericsoftware.com/spine-ik-constraints) and [runtime-offset foot-contact checks](https://esotericsoftware.com/spine-ghosting#Offset). This is a custom Canvas build-time renderer, not the Spine runtime.
