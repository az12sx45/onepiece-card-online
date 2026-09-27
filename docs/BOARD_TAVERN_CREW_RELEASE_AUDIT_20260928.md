# Tavern Crew Release Audit - 2026-09-28

## Public Deployment

Release commit `5ce0b822f39a98950c6f9c696cd8ad9778bf33b2` reached the public Board runtime at 2026-09-27T21:40:54.511Z. The actual public HTTP verifier passed 60/60 checks at 21:43:06.068Z; all 13 changed blob paths passed full GET, size, SHA, CORS and immutable-cache checks. Public launcher 1.2.8 release metadata and download HTML match the same commit byte-for-byte. Complete evidence is `BOARD_TAVERN_CREW_RELEASE_QA_20260928.json`. The gates below retain their original local/candidate scope and do not claim real-account, physical-device or human play acceptance.

## Executed Guards

- Evidence: `D:/Codex_QA/board-tavern-crew-20260928/release-guards-qa.json`.
- Report SHA-256: `623a40775447f6f46a50fb28e91dc2a44408dee0669b487072f6540087bd6ad8`.
- Executed 2026-09-27 20:50:16-17 UTC against HEAD `6dc1fcf32c13225e108b32767251c20098eefed4` and the working v2 source. The full JSON contains per-check results and exact source hashes.
- PASS: 13 builder boundary checks plus 8 isolated VM crew checks, total 21. Builder syntax also passed. Tested source bytes and HEAD stayed stable throughout execution.
- Builder scope: baseline package/manifest identity, retained 6,313 media, 55 baseline programs, four changed programs, nine added paths, 6,377 final logical files, sorted exact allowlists, safe external candidate location, invalid date rejection and fail-closed rejection of uncommitted crew input.
- VM scope: ten unique hosts, all thirty frozen phase records, fixed Luffy invitation, crypto host coverage, rejection sampling upper bound, unknown-host fallback, no-crypto fallback without `Math.random`, and existence of every referenced sprite.
- These are source and VM guards, not a complete candidate build or browser, Socket.IO, Electron, physical-device, production or human acceptance test.

Tested source SHA-256:

| File | SHA-256 |
| --- | --- |
| `scripts/build_board_tavern_crew_release.js` | `64fb74eb4af80610ea0a68dd4e8257b0f3f8e168084bf1c1294868339a273ee8` |
| `public/js/board_tavern_crew.js` | `201cb7c440213099eaf9480254f2f98eba525481eeb0b597bd19cfa8515e6aa0` |
| `config/desktop-program-packages-v1.json` | `a74ad528524a9613f591d8a245547aac6048740c3102da620bd4738fb7fcbd16` |

## Executed Announcement Gate

- PASS: 35 checks, executed 2026-09-27 21:09:08-18 UTC. Evidence: `docs/BOARD_TAVERN_CREW_ANNOUNCEMENT_QA_20260928.json`, also retained externally at `D:/Codex_QA/board-tavern-crew-20260928/announcement-gate.json`.
- Report SHA-256: `c44401b9d8c95487e49613d9c8963733f919e984a8d0d1c7a16c33549f134416`.
- Final package: `package-1c453fcf83416d97`; manifest SHA-256: `f83c26dfb1d9e2bc74b864ebfd6afb67b939e73ed6ac6790462af098134f141e`; 6,377 logical files / 1,534,234,666 bytes.
- Shipping announcement revision 4 contains five entries. The exact new Board notice is `board-tavern-crew-20260928-1c453fcf83416d97`; all four baseline published notices and card/chess package records remain unchanged.
- Runtime verification scope: **official verifier over exact immutable candidate bytes, not actual HTTP**. All 56 program files match both manifest digests and committed blobs at source `c815941cdbb9307c4f3b6041ea2baadb365adc43`. Candidate catalog/manifest and the exact committed configuration were copied into an external fixture. The original `server/index.js` verifier body performed its real filesystem, schema, identity, size and SHA checks without altered thresholds.
- The local working-tree HTTP endpoint returned 503 because 51 pre-existing program files use CRLF while the immutable candidate uses committed LF. No such working-tree files were changed. The failed run is preserved at `D:/Codex_QA/board-tavern-crew-20260928/announcement-gate-http503.json`, SHA-256 `4732f804855f04118c1748129a452c4f05950accf4f03f3728af7a4710abbeec`. This gate does not claim that local HTTP passed; public HTTP deployment acceptance is separate.

- Runner: `D:/Codex_QA/board-tavern-crew-20260928/announcement-gate.js`.
- PGlite dependency verified as loadable: `D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite`. `BOARD_QA_PGLITE` can override that module path only; no connection string or credentials are used.
- Use the actual `server/launcher-announcements.js` schema and service API, actual `validateAppendOnly` from presentation-v126 against all four notes at baseline `6dc1fcf32`, and current `validateNotes` from presentation-v127 to retain launcher 1.2.7 truthfully.
- The older `scripts/launcher_announcements_server_qa.js` assumes precisely two 1.2.6 shipping notices. Likewise v126's full `validateAnnouncements` assumes current-launcher BGM and Ace notes. Neither is a valid whole-catalog gate for the current 1.2.7-plus-Board configuration. Do not alter historical tests to manufacture a pass.
- The runner requires exactly one append-only Board note, revision increment, final package ID in `version` and `requiredRelease`, and the internal Board CTA. It checks the catalog manifest digest and unchanged card/chess records.
- The explicit `--candidate` mode executes the official verifier in a VM with its real `fs.promises` and only the filesystem roots redirected to the external exact-byte fixture. It never imports the server startup or DB connection module. The prior HTTP attempt is retained, not silently replaced or reclassified.
- In-memory PGlite tests use two synthetic profiles. They exercise authentication, pre-release hiding, invalid manifest proof, no premature witness, exact publication binding, public field projection, per-account/idempotent reads, historical witness behavior, and the actual extracted GET/READ Socket.IO handler bodies. No production DB module or credentials are loaded.

Executed command:

```powershell
node D:\Codex_QA\board-tavern-crew-20260928\announcement-gate.js --root 'C:\Users\王曜瑋\.codex\worktrees\tavern-recruit-animation\2026-04-20-1-2-start-html-game-html' --release package-1c453fcf83416d97 --report D:\Codex_QA\board-tavern-crew-20260928\announcement-gate.json --candidate D:\Codex_QA\board-tavern-crew-20260928\candidate
```

Publication scenarios use a controlled verifier for prior/unavailable/invalid proof, and the unmodified official verifier's actual result for the matching candidate. Publication/read witnesses exist only inside the in-memory synthetic fixture. No production database, real account, credentials, public announcement request or deployed-runtime acceptance was used or claimed.

## Concurrent Launcher Merge Gate

- PASS: 40 checks against merged worktree and remote baseline `0aa99bac64f748b0322f248280546078f1523b06`. The earlier 35-check report above is preserved unchanged as historical evidence.
- Evidence: `docs/BOARD_TAVERN_CREW_MERGED_ANNOUNCEMENT_QA_20260928.json`, retained externally at `D:/Codex_QA/board-tavern-crew-20260928/merged-announcement-gate.json`. SHA-256: `91a2791b4e97fa94a4e56538af142681973c7858c56afe0cf8dc83fb7dc178bc`.
- Final shipping announcement configuration is revision 5 / six notices: all five remote published notices remain unchanged, with precisely one additional Board notice for `package-1c453fcf83416d97`.
- Current launcher remains 1.2.8. The merged Git index bytes for `desktop/package.json`, `desktop/package-lock.json`, `public/desktop/launcher-release-v1.json` and `public/desktop-download.html` exactly match remote baseline. Working contents match too; CRLF-only checkout differences in three files are explicitly bound in the report. The signed launcher release metadata bytes are unchanged.
- The current 1.2.8 announcement is retained exactly. Historical v1.2.7 notices are protected by actual append-only validation, not incorrectly retested as current-version notices with the old v127 validator.
- Board candidate source remains `c815941cdbb9307c4f3b6041ea2baadb365adc43` and its original builder baseline remains `6dc1fcf32c13225e108b32767251c20098eefed4`. The package/manifest identity is unchanged. All 56 candidate program blobs and the unmodified official runtime verifier passed again, followed by the same isolated PGlite publication/read and extracted handler gates.
- Runtime scope remains exact immutable candidate verification, **not local HTTP**. Earlier HTTP 503 evidence remains retained. This merge gate does not claim public deployment or real-account acceptance.

```powershell
node D:\Codex_QA\board-tavern-crew-20260928\merged-announcement-gate.js --root 'C:\Users\王曜瑋\.codex\worktrees\tavern-recruit-animation\2026-04-20-1-2-start-html-game-html' --release package-1c453fcf83416d97 --report D:\Codex_QA\board-tavern-crew-20260928\merged-announcement-gate.json --candidate D:\Codex_QA\board-tavern-crew-20260928\candidate
```
