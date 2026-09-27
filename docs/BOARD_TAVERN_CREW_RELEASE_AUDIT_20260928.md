# Tavern Crew Release Audit - 2026-09-28

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

## Prepared Announcement Gate

The current package and announcement are not yet approved by this audit. A new release ID and its exact Board announcement must exist before executing the prepared gate.

- Runner: `D:/Codex_QA/board-tavern-crew-20260928/announcement-gate.js`.
- PGlite dependency verified as loadable: `D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite`. `BOARD_QA_PGLITE` can override that module path only; no connection string or credentials are used.
- Use the actual `server/launcher-announcements.js` schema and service API, actual `validateAppendOnly` from presentation-v126 against all four notes at baseline `6dc1fcf32`, and current `validateNotes` from presentation-v127 to retain launcher 1.2.7 truthfully.
- The older `scripts/launcher_announcements_server_qa.js` assumes precisely two 1.2.6 shipping notices. Likewise v126's full `validateAnnouncements` assumes current-launcher BGM and Ace notes. Neither is a valid whole-catalog gate for the current 1.2.7-plus-Board configuration. Do not alter historical tests to manufacture a pass.
- The prepared runner requires exactly one append-only Board note, revision increment, final package ID in `version` and `requiredRelease`, and the internal Board CTA. It checks the catalog manifest digest and unchanged card/chess records.
- It requests only the localhost runtime verification endpoint. The candidate must already be promoted locally and served from this managed checkout; this is not a public deployment claim.
- In-memory PGlite tests use two synthetic profiles. They exercise authentication, pre-release hiding, invalid manifest proof, no premature witness, exact publication binding, public field projection, per-account/idempotent reads, historical witness behavior, and the actual extracted GET/READ Socket.IO handler bodies. No production DB module or credentials are loaded.

Run only after the final package ID is supplied, replacing `package-<final-id>`:

```powershell
node D:\Codex_QA\board-tavern-crew-20260928\announcement-gate.js --root 'C:\Users\王曜瑋\.codex\worktrees\tavern-recruit-animation\2026-04-20-1-2-start-html-game-html' --release package-<final-id> --report D:\Codex_QA\board-tavern-crew-20260928\announcement-gate.json --runtime-url http://localhost:18928/api/desktop-runtime-package/board
```

Only syntax/dependency readiness is being prepared at this stage. No new announcement gate PASS, publication witness or deployed version is claimed before that command completes successfully.
