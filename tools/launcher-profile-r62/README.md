# Profile and guestbook r62 renderer release

Authority: `D:\Codex_Release_Worktrees\launcher-flick-reward-r12`.
Baseline: `ad9011407eb7c6ec33b2f9dd3e593e47ef16f4b6`, signed launcher revision 61, core 1.2.23.
Output: `D:\Codex_QA\launcher-profile-r62\release`.

This is a renderer-only delta. The builder carries all 319 r61 entries and changes only the three named renderer files plus the new r62 announcement image. All committed game program files and every existing `public/desktop` metadata file except `launcher-content-v1.json` must remain byte-identical. Existing Git checkout CRLF/LF differences in program/config working copies are allowed only when normalized text is identical and are explicitly recorded; those files are not repackaged or uploaded. No game package, installer or catalog is rebuilt.

## Ordered commands

Run from the authority root. Complete the source/UI review, update documentation and commit the reviewed source (including these tools, the announcement config and image) before step 2. Keep unrelated working changes out of staging. These tools do not commit or push anything.

1. Read back the live baseline before deployment:

   `node tools/launcher-profile-r62/probe-baseline.js`

2. After committing the reviewed source, build from committed bytes:

   `node tools/launcher-profile-r62/build-release.js`

3. Sign with the existing DPAPI signer:

   `& tools/desktop-r2-publisher/sign-launcher-content.ps1 -InputPath D:/Codex_QA/launcher-profile-r62/release/unsigned-r62.json -OutputPath D:/Codex_QA/launcher-profile-r62/release/signed-r62.json`

4. Validate all source bytes and record the manifest hash, then upload immutable content:

   `& tools/launcher-profile-r62/publish.ps1`

   `& tools/launcher-profile-r62/publish.ps1 -Live`

5. Before promoting public metadata, verify public immutable blobs, stage the candidate delta, and exercise actual core routes:

   `node tools/launcher-profile-r62/verify-public.js blobs`

   `node tools/launcher-profile-r62/verify-delta.js candidate`

   `node tools/launcher-profile-r62/verify-launcher-protocol.js`

6. Root agent inspects reports, copies `signed-r62.json` to `public/desktop/launcher-content-v1.json`, stages only that metadata file, commits and pushes the authorized release. Do not alter game catalogs or package manifests. No promotion is performed by these helpers.

7. Wait for exact public signed manifest, then verify full public release and actual cache:

   `node tools/launcher-profile-r62/verify-public.js wait`

   `node tools/launcher-profile-r62/verify-public.js all`

   `node tools/launcher-profile-r62/verify-delta.js actual`

8. Root agent writes final documentation receipt from the reports. A docs-only `[skip render]` commit can record readback without rebuilding.

## Verification boundaries

- The `candidate` target is fixed to the existing verified cache at `D:\Codex_QA\launcher-fishing-r45\candidate`; its manifest endpoint is the locally signed candidate. Blob bytes still come from the real immutable host.
- The `actual` target is fixed to `%APPDATA%\onepiece-tabletop-desktop`; its manifest and blobs use public endpoints. Path, reparse and exact signed identity checks run before staging. Manifest slots are backed up by content hash. Existing 319 r61 blobs are read back before and after; nothing is deleted or downgraded.
- If a cache has already updated automatically, report r62 readback and zero extra download honestly. Do not claim observation of the earlier download. Both paths verify all 320 entries and a second update fetching zero blob bytes.
- Core route verification executes the actual `installLauncherProtocol` / `verifiedOverlayResponse` functions in an isolated VM against the signed candidate. It checks GET/HEAD exact changed bytes and zero bundled/network fallback; it is not physical Electron-window acceptance.
- Public checks verify exact manifest bytes, changed immutable blobs, all 330 catalog records, unchanged three-game catalog/manifest/runtime identities. They do not mutate real accounts or wallets and do not claim a Render dashboard Live badge.
- The tools never print publisher credentials. `publish.ps1 -Live` requires a matching successful dry-run manifest hash and restores the process environment afterward.
- Root owns project documentation updates and source staging. LATTICE APIs were unavailable in this session; no persistent task or graph acceptance is asserted.
