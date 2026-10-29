# Card field presentation — 2026-10-29

Desktop priority, original web game. Original launcher/lobby and authoritative rules, network event names, state schema and privacy remain unchanged.

- Viewer-authorized scouting cards appear simultaneously, with fixed owner labels and readable numbers. No carousel. Law comparison presents the viewer retained card and the authorized target card together while preserving the original Cancel/Swap handlers.
- Coin toss animates from the clicked control to the current scene floor and retains the original server-supplied heads/tails result. It never replaces the scene with the default board.
- Stable two-plane scene background, decoded before crossfade, with generation guards against stale loads. Re-selecting the current venue does not toggle the world off. Venue entry animates scenery only and waits before accepting the next presentation batch.
- Deck and discard physical surfaces share a 43-degree perspective; labels and counts remain upright. Small dark plaques behind the lower-left venue/treasure information.
- GPT generated a new original default harbor floor: android/web/art/card-venue-default-v2.webp. Existing fifteen themed backgrounds retained. No external game art or code copied.

## Editable sources and output

Shared source root: C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html.
Modules: android/web/card-phone-fx.js/css, card-phone-piles.js, card-phone-library.js/css, card-phone-coin.js, card-phone-flow.js, card-phone-cinema.css, card-hud-combat.css, card-hand-dock.css; android/mobile-sources.mjs includes version-2 venue assets. android/card-field-stage-qa.mjs tests the actual original HTML and viewer-visible engine output.
Production root: D:/Codex_Release_Worktrees/card-native-server-adapter-20261029. Generated public/js/card-desktop-table.js and public/css/card-desktop-table.css; public/game.html cache token and enhanced Law preview handoff. Source-only diff and exact pre-edit module copies retained under D:/Codex_QA/card-field-stage-20261029/source-before and source-changes.patch.

## Verification and release boundary

QA evidence: D:/Codex_QA/card-field-stage-20261029. Desktop 1024x600/1366x768 and phone 640x316/844x390 isolated Chromium tests cover simultaneous ownership, full card bounds, reachable original Law controls, recipient privacy, transparent coin scene, both original coin results, discard access and loser-only duel disclosure. Screenshots are visually inspected; browser emulation is not physical Android/iOS acceptance.
Real npm-start server and two isolated Socket.IO browser clients check join/start, authoritative draw, queued state while reading, refresh recovery and hidden other hands. scripts/card_flow_sync_qa.mjs now resolves its own repository instead of an outdated fixed checkout. Existing dependencies supplied through child-process NODE_PATH; no dependency installation or production account use.
Publishing uses reviewed three-file Card program delta only; scripts/publish_card_program_blobs.js expected prior live Card release updated to package-aa58109271022136. Other games/media and launcher remain preserved. Until a public readback receipt exists this is a candidate, not a completed release. Mobile packages are not published by this desktop update.

## References

Presentation direction: fixed field and in-field card actions, informed by official Yu-Gi-Oh Master Duel and Duel Links pages. https://www.konami.com/yugioh/masterduel/us/en/ ; https://www.konami.com/yugioh/duel_links/en/guide/ .
Reviewed open source: https://github.com/boardgameio/boardgame.io (MIT state/network framework), https://github.com/db0/godot-card-game-framework (AGPL-3.0 Godot framework). Neither is a drop-in replacement for the current original web game; no code imported.

LATTICE APIs are unavailable in the current tool catalog. Existing project fc1f1991-a190-4cd1-8933-947297d0ebbe and Card task e4368cf0177acd6ead577d369a181d11b6d4ff30c66fb681fe4ff60e8b5b663e retained as historical context; no new persistence or graph success claimed.

Full Law flow correction: original web target selection sent a one-shot PICK_TARGET and ended the turn before the comparison decision. It now requests the already-supported preview:true server contract, pins the same target and retains original Swap/Cancel actions. Duplicate textual ROOM・SCAN peek is omitted only from animation presentation when the same private law_view is present. Original events and server engine remain unchanged. android/card-field-law-qa.mjs verifies real original target clicks, retained/target faces, original Swap action and authoritative completion at 844x390/1366x768. Fixture skips enhancement video to focus on handoff. Existing server contract suite validates preview/cancel/privacy/serialization and 40 legacy play cases (53 checks). The header surface yields to Law comparison, removing the orphaned dark rectangle.

Visual follow-up: suppress only original empty src hand slots so a pending Law decision shows the retained card without a broken empty draw frame. Final targeted Law QA includes both empty-slot hiding and retained-hand visibility.
