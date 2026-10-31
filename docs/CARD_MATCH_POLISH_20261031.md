# Card match clarity and combat — 2026-10-31

Scope: match presentation only; original launcher/lobby, gameplay, hidden hands, save data and protocol stay unchanged. Existing GPT-generated button/panel/impact/finisher artwork is reused; no new media assets or native binary rebuild.

Three timed card-back exchanges now precede the random finisher. Movement uses linear overall timing and deliberate contact/recoil holds, so the impact texture coincides with actual card contact. Only the public losing card is revealed at the finisher impact. Result text follows the longest fragment damage animation; entry/clashes/finisher/result/return all remain within the existing effect queue lifetime. Normal Roger/enhanced Roger rules are unchanged.

Repeated JOINED previously cleared the HUD cache without removing existing mounted plaques. Shared card-seat-hud now reuses its cache and removes stale plaques. The compatibility observer removes stale extra plaques in released v059 bundles as well, retaining one plaque per seat, five opponents above and self below-right.

The private reading confirmation now has a dedicated footer. Hand inspection uses a separate card image, readable effect copy and a fixed confirmation row; narrow landscape screens combine card navigation and the play button on that row. Primary actions reuse the existing generated button art, with 46–50 px touch height. Original handlers and eligibility checks stay authoritative.

Enhanced media now plays once before the diagonal character intro. card-match-polish wraps the existing presentation hook, waits for queued movie/narration completion, and consumes only the legacy replay for that same batch. Disconnect/rejoin/background reset invalidates outstanding prelude work. The original movie cleanup now waits for ended/error and only exits after 30 seconds without playback progress; clicking the video no longer cuts it off. Results remain behind the existing local/global readiness barriers.

Files: shared android/web/card-duel-finishers.js, card-seat-hud.js, new card-match-polish.js/css; android/build-card-desktop.mjs and android/card-match-polish-qa.mjs. Formal public/game.html embeds the shared mobile-compatible scene/controller/style and original video lifecycle change; generated public/js/card-desktop-table.js and public/css/card-desktop-table.css use the same source. scripts/publish_card_program_blobs.js baseline advances to the verified previous package-f2c9a0995503bf94.

Verification in progress: actual rendered desktop and exact installed v059 Android/iOS browser bundles; repeated JOINED, six-seat HUD, action hit targets, private reading, three exchanges, card displacement, losing-card-only reveal, actual MP4 ended before cut-in and no movie replay. npm-start two-window Socket.IO regression passed 8 checks (room/start/draw/reading/refresh/private hand). No physical-device or real-account claim. QA location C:/Codex_QA/card-match-polish-20261031. Screenshots are inspected then removed per the user's retention preference.

LATTICE tools are currently unavailable; no new persistent task or graph completion is claimed. Publication pending.
