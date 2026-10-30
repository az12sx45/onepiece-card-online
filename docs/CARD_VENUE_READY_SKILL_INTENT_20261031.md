# Card venue confirmation and chosen skill declaration — 2026-10-31

Scope: original Card web route only. Launcher, lobby, Board, Chess, engine rules/save fields and all art remain unchanged. Enhanced projection experiment stays paused.

Every round creates a room-only venue confirmation barrier. Only required human players may confirm their own seat, using the current gate ID/round and socket identity. CPU actions and human engine actions wait for all confirmations. Reconnect preserves readiness. Existing disconnect grace/CPU takeover can release an absent seat; reading does not invoke idle-turn takeover. No automatic reading timeout. The panel shows ready count and waiting names. Raw STATE metadata is handled outside the presentation queue to avoid a barrier deadlock.

Skill presentation now uses a public card_skill_intent emitted only after an accepted choice. Captions name the chosen operation and target, not a generic activation at initial play. Original play_fx/enh_fx are held until that choice. Original Usopp target/digit flow remains. Law preview and exchange are separate concrete declarations, with one enhanced movie. Public intent has no hand, result or winner fields; engine state is byte-identical to undecorated execution.

Compatibility: game.html includes the venue controller and updated anime intent controller. This overrides older v059 mobile presentation through the existing online Card URL. Current signed Android v059 and unsigned iOS v059 binaries/pointers are retained, with no APK/IPA rebuild required. Desktop bundle is regenerated from shared mobile source.

Files: server/card_venue_ready.js, server/card_skill_intent.js, server/index.js; scripts/card_venue_ready_client.js and three QA scripts; public/game.html, public/js/card-desktop-table.js. Shared source android/web/card-anime-skills.js and android/card-skill-intent-qa.mjs. Scoped immutable publisher baseline updated to verified package-eb3502616db0e3d5.

Validation: 17 barrier checks; 170 original-engine normal/enhanced 20-card intent checks; 15 real npm-start/Socket.IO browser checks (three human clients + three CPU, exact v059 Android/iOS bundles, 32-second wait and reconnect); 8 existing two-browser flow regression checks; 13 frontend intent checks each on desktop/Android/iOS bundles. Total 249. Browser viewport/device emulation is not physical phone acceptance. No screenshots or videos retained. Exact embedded shared controller checked. Reports under C:/Codex_QA/card-venue-ready-20261031 and C:/Codex_QA/card-skill-intent-20261031.

Publication completed; see readback below. No LATTICE tools available in the current tool inventory, so no new task persistence or graph verification is claimed.


Publication verified 2026-10-31: package-eabb0c15e9faf3f1, source 342c9d611582247e20cd3b66843935cd00ab2feb, release 6465ff7ef8a52121e2e1ee24a4edc3dc57d6aeab. Public catalog/three game identities, all 31 Card programs, three scoped CAS objects and cache token verified. Only game.html and Card desktop JS changed in player program inventory; 1054 media entries retained. Android/iOS v059 binaries unchanged.

A production isolated guest room passed 14 further checks with desktop and exact v059 Android/iOS bundles plus three CPU seats: all-human acknowledgement, unread blocking, own-socket authentication, reconnect, simultaneous release and post-release action. No browser errors. This uses Chromium contexts and is not physical phone or real-account acceptance. Total local checks 249 plus public-room checks 14. Evidence: C:/Codex_QA/card-venue-ready-20261031/source-receipt.json, public-release-readback.json and public-room/browser.json.
