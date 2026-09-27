# Board Tavern Crew Release Plan - 2026-09-28

## Audited Baseline

- Formal authority remains `D:\Codex_Release_Worktrees\board-voyage-records-v1`; do not overwrite its unrelated local work from another checkout.
- Reused managed checkout: `C:\Users\王曜瑋\.codex\worktrees\tavern-recruit-animation\2026-04-20-1-2-start-html-game-html`.
- Latest main observed by `git ls-remote` was `6dc1fcf32c13225e108b32767251c20098eefed4`. It follows the first tavern release and preserves that release while adding launcher 1.2.7. The root agent fast-forwarded the managed checkout to it.
- Existing dirty `public/images/ranks/r5.PNG` and `r6.PNG` are out of scope. The builder preserves their live manifest records and does not ingest dirty media bytes.
- Public Board runtime was `package-b5eaebdecfaee7d6`, manifest SHA-256 `0502fba41c3e97236d1ec832d7e1b36e58e3e323ba877f8211dc424c6bac4b82`, 6,368 logical files, 55 programs and 6,313 media records.
- The live runtime endpoint is `https://onepiece-card-online.onrender.com/api/desktop-runtime-package/board`. Recheck immediately before a later deployment; this document is not a permanent claim about production.

## Reviewed Release Boundary

`scripts/build_board_tavern_crew_release.js` is a separate scoped v2 builder. The historical v1 builder remains unchanged.

- Add program `js/board_tavern_crew.js` to the existing Board allowlist only.
- Change existing programs `board_game.html`, `css/board_tavern_reveal.css`, `js/board_game.js`, and `js/board_tavern_reveal.js`.
- Add eight WebP files under `images/board/tavern_recruit/crew_v2/`: `nami_invite.webp`, `nami_accept.webp`, `nami_decline.webp`, `chopper_invite.webp`, `chopper_accept.webp`, `brook_invite.webp`, `brook_accept.webp`, and `sanji_accept.webp`. The eighth image replaces use of an existing, edge-clipped Brook acceptance portrait without changing that original asset. This list is provisional until art review is complete; any added path requires an explicit reviewed builder update.
- Preserve all 6,313 existing media records byte-for-byte at manifest level, including the first tavern trilogy and all reused story speaker images. Reusing an asset is not permission to alter its source.
- Expected candidate inventory with the current allowlist: 6,377 logical files, 56 programs and 6,321 media records. Count logical paths even when multiple paths share a CAS hash.
- Preserve card and chess configuration, catalog entries and manifests; all legacy v2 metadata; old immutable v3 manifests; launcher 1.2.7 release metadata, runtime, art and announcements.
- Program collection uses committed HEAD bytes, not dirty worktree files. Every listed source must match HEAD. Changed public paths since the baseline must exactly equal the four changed programs, one added program and eight new media paths.
- Candidate output must be outside all Git checkouts and contain no symlinks. Verification recomputes every expected byte and rejects extra or missing files, changed source HEAD, modified protected metadata or altered source.
- Promotion changes only the new immutable Board manifest and `public/desktop/catalog-v3.json`; it never uploads, pushes, changes branches or publishes announcements.

## Sequence And Gates

1. Complete feature, visual, reduced-motion, input/lifecycle and real local two-browser Socket.IO QA. Preserve original draw, price, result, pool and settlement authority. Joining must not be announced before a full-team replacement is actually confirmed.
2. Commit only the reviewed source/config/assets and documentation. Reconfirm latest remote main and live package; do not force-push across a concurrent release.
3. Build a fresh external candidate: `node scripts/build_board_tavern_crew_release.js --output D:\Codex_QA\board-tavern-crew-20260928\candidate`.
4. Verify without promotion: `node scripts/build_board_tavern_crew_release.js --candidate D:\Codex_QA\board-tavern-crew-20260928\candidate`.
5. Once approved, use the same command with `--promote`. Candidate source HEAD must still match exactly. A later source commit requires a fresh candidate.
6. Append a new Board announcement using the final package ID. At baseline announcement revision 3 contains four published entries; preserve every existing entry semantically unchanged, increment revision, use `scope: board`, and gate `requiredRelease` on the exact new release ID. Do not revise the historical Luffy-only notice.
7. Validate actual `server/launcher-announcements.js` schema and API filtering plus append-only comparison against this baseline. Launcher v1.2.7's historical validator is evidence for that historical release, not a substitute for current Board/API verification.
8. Complete catalog/publisher dry-run, authorized immutable CAS upload, release commit/push and public runtime polling through the existing official pipeline. This planning work performs none of these actions.
9. Public verification must compare exact runtime package/manifest identity and GET/hash/CORS for every changed logical path, including reused hashes. Use an Electron user agent for desktop-gated program paths. Tested local Chromium is not real Electron, physical-device or remote-network acceptance.

## Current Builder Validation

Executed `node --check scripts/build_board_tavern_crew_release.js`: PASS.

Executed 13 read-only assertions before the eighth-image addition: exact baseline release and manifest SHA; 6,368/55/6,313 counts; eight added paths absent from the old package; four changed programs already allowed; seven media and one added program with twelve unique scoped paths; sorted allowlists; expected 6,376 inventory; rejection of relative, in-checkout and ancestor candidate directories; invalid date rejection; rejection of the current uncommitted crew candidate. All 13 passed. The revised eight-image allowlist is checked separately below; this earlier count is historical evidence, not the final inventory.

After adding `brook_accept.webp`, reran syntax and the same 13 guards with the final counts: eight media, one new program, thirteen changed/added public paths, 6,377 total package files. All passed. All nine added paths are absent from the baseline package. The complete candidate remains pending committed source.

These are builder boundary checks, not a complete release build. Source implementation and art are still in progress; no candidate was built or promoted, no announcement was added, and no upload, commit or push was performed by this audit.
