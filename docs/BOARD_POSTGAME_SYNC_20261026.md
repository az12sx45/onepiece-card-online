# Postgame crossplay repair — 2026-10-26

Scope: Board only; original IDs, saves, Socket.IO events and gameplay rules stay intact.

`public/js/board_game.js` caches matches in the immutable map-layout geometry lookup instead of scanning all sea tiles for every step of every LAN snapshot. This does not cache mutable islands, HP, inventory or rewards. The map package is fixed for each game instance; cache growth is bounded.

Live LAN spar snapshots preserve the resolver's animation flag. The prior normalizer cleared it even for an in-progress remote round, exposing replacement/action controls too early. Initial reconnect recovery and non-spar normalization keep their previous behavior. Spar views with a running round deny input until the original resolver publishes completion.

Native generation applies the same two spar corrections through `godot-pilot/tools/source-fix-spar-live-lan.cjs`; original captured source and comparison fixtures remain unchanged. Desktop/native corrected declarations are compared after parsing, and the geometry lookup is checked against original results for 3,892 route/step cases.

Evidence directory: `D:/Codex_QA/native-postgame-fix-20261026`. Two-browser create/join/start/turn/reload/return tests passed using a local database-disabled server and explicit post-draft/postgame fixture. Natural campaign completion and physical Android/iPhone acceptance are separate and are not claimed. Earlier failed harness runs remain available.

Crossplay regressions with a desktop browser host, two Windows Godot clients and one CPU passed the 26-check attack/knockout/replacement/round-handoff/surrender/map-return case and the 25-check low-HP final-knockout/map-return case. Setup uses explicit draft and HP fixtures; actual attack, replacement and finish controls execute the original game. No physical-device or natural full-playthrough claim. Original voyage crews remain unchanged after spar. Component postgame, extraction and research cases passed against the sealed native product; original ending unlock was rechecked (36 checks).

Scoped package `package-1bd4a907624b682f` changes only `js/board_game.js`, retaining all 6,586 other Board entries and unchanged card/chess records. All 109 program blobs across three games match Git HEAD. The older all-game v2 generator/QA reject the already-published v3 media expansion; neither was passed or relaxed. Scoped preparation uses the current verified public v3 baseline, preserving its media trees.

Publication results are recorded in `D:/Codex_QA/native-postgame-fix-20261026/public-release-verification.json`; only `ok:true` confirms the public runtime/catalog/CAS readback. Android v040 uses the same native product, with a 1,591,512-byte v039 delta; iOS v042 CI/build-resource checks passed but requires owner signing. No schema, event or server changes.

LATTICE tools were not present in the available tool inventory. The existing Board task/project pointers were retained; no live task write or Graphify success is claimed.
