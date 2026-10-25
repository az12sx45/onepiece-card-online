# Postgame crossplay repair — 2026-10-26

Scope: Board only; original IDs, saves, Socket.IO events and gameplay rules stay intact.

`public/js/board_game.js` caches matches in the immutable map-layout geometry lookup instead of scanning all sea tiles for every step of every LAN snapshot. This does not cache mutable islands, HP, inventory or rewards. The map package is fixed for each game instance; cache growth is bounded.

Live LAN spar snapshots preserve the resolver's animation flag. The prior normalizer cleared it even for an in-progress remote round, exposing replacement/action controls too early. Initial reconnect recovery and non-spar normalization keep their previous behavior. Spar views with a running round deny input until the original resolver publishes completion.

Native generation applies the same two spar corrections through `godot-pilot/tools/source-fix-spar-live-lan.cjs`; original captured source and comparison fixtures remain unchanged. Desktop/native corrected declarations are compared after parsing, and the geometry lookup is checked against original results for 3,892 route/step cases.

Evidence directory: `D:/Codex_QA/native-postgame-fix-20261026`. Two-browser create/join/start/turn/reload/return tests passed using a local database-disabled server and explicit post-draft/postgame fixture. Natural campaign completion and physical Android/iPhone acceptance are separate and are not claimed. Earlier failed harness runs remain available.

Publication and full crossplay regression results are pending final receipts. Do not treat this document's presence or a successful package build as a released/tested result.

LATTICE tools were not present in the available tool inventory. The existing Board task/project pointers were retained; no live task write or Graphify success is claimed.
