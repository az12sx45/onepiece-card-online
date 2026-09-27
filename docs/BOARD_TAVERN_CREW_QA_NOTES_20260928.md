# Tavern Crew QA, 2026-09-28

All results below are automated local Chromium checks against the isolated managed checkout on http://127.0.0.1:18928. They are not human-play, physical-device, remote-network, or deployment acceptance.

## Final Results

- `BOARD_TAVERN_CREW_BROWSER_QA_20260928.json`: 163 passed checks, zero browser runtime errors. All ten hosts and both reactions, original paid draws, accept/decline/full-team replacement, once-only settlement, skip and keyboard controls, initial/reaction invalidation, CPU policies, missing-image/helper fallback, reduced motion, spectator non-authority, and 1440x900 / 390x844 / 932x430 controls were covered. Two HTTP 404 entries are the deliberately missing reaction image test.
- `BOARD_TAVERN_CREW_SYNC_QA_20260928.json`: 44 passed checks, zero browser runtime errors, `ok: true`. Accept, decline, and replacement used three independent real local Socket.IO rooms (B3265, B3207, B1307), each with two isolated browser contexts. Actor/spectator host and reaction match; spectators have no decision authority; final crew, pool, coins, turn and refreshed identity match through existing acknowledged transports.
- `BOARD_TAVERN_CREW_WIRE_QA_20260928.json`: separate 13-check existing state-wire integration regression, four local Socket.IO clients, full/delta transport, authority handoff and recovery.
- `BOARD_TAVERN_CREW_SUPPLEMENT_QA_20260928.json`: 9 passed checks, zero browser runtime errors, `ok: true`. All six rarity tokens and computed light colors match. Nami uses the approved existing portrait mask. A 128x128 image/mask probe using the computed CSS filter has 56.146% transparent pixels; the silhouette's visible sampled pixels are 100% black, and the revealed portrait's visible sampled pixels are 100% non-black. Matching browser screenshots are retained.

The 163-check run and its screenshots precede the final bottom-edge CSS fade. That run's three viewport choice screenshots were visually reviewed: image, grade/name and buttons are separate and all controls fit. The later responsive-art review is the visual evidence for the final fade. The wire and supplement runs loaded the later CSS.

## Fixture Corrections

The CPU test initially found a real pre-existing selector mismatch: the observer still searched the old result-card name/tier markup. Production selectors were repaired, and the final run passed the available-slot, stronger-full-crew rejection and weaker-full-crew replacement policies without changing their score threshold.

Three sync-fixture corrections were not production failures:

1. Initial stages need not be frame-locked because the existing remote playback queue delays spectators. Shared host, art, line, grade and color are compared; actual accept/decline phases must still match.
2. A single-room fixture attempted to reset the original actor after settlement advanced the turn. The server correctly returned `not_your_turn`. Each scenario now starts a fresh real room without bypassing authority.
3. Unchanged crew length on decline was an insufficient completion predicate. The owner had acknowledged state version 5 while the spectator was still on version 4 with one queued playback event. The final fixture waits for owner acknowledgement and spectator application of the committed version with the playback queue drained.

Raw local evidence is under `D:\Codex_QA\board-tavern-crew-20260928`. The initial CPU failure is retained as `first-pass-cpu-selector-failure.json`; the sync timing evidence and correction log are retained under `sync\decline-predicate-before-state-application.json` and `sync\fixture-revisions.md`.

## Scripts

- `scripts/board_tavern_invitation_qa.js` is the new v2 browser fixture. `BOARD_QA_SUPPLEMENT_ONLY=1` runs only the rarity/mask checks; `BOARD_QA_ART_ONLY=1` runs the host matrix only. `BOARD_QA_OUTPUT` isolates evidence directories.
- `scripts/board_tavern_invitation_sync_qa.js` is the new v2 Socket.IO fixture.
- Original v1 QA scripts are unchanged. Test-only hooks are injected into intercepted local responses, not added to the production debug API. The standalone fixtures refuse non-loopback URLs.
