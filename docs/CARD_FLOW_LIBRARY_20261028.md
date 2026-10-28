# Card flow, libraries and venue art — 2026-10-28

Desktop and landscape mobile share the same presentation. Game rules, server events, IDs, save data and authoritative random outcomes remain unchanged.

- Buffer complete EMIT/STATE transactions while narration, animation, private viewing, libraries or the opening venue introduction are active. Resume in order; stale displayed controls cannot submit actions. Window capture precedes portrait forwarding. Disconnect clears the queue; background/CPU-fast mode bypasses replay. Final-result navigation waits for presentation completion.
- Preserve original circular avatar images in a centered wrapper. GPT status art is anchored within the name frame, not on the portrait.
- Full-screen card encyclopedia includes all 20 original cards, counts, base/enhanced art and original descriptions. Discard gallery pages through every presented discard, then opens a detail; covered entries always remain card backs, even if an unexpected ID is supplied.
- Venue thumbnails fit a compact grid with no horizontal scroll. Clicking a venue toggles its corresponding new GPT-generated background. Fifteen original venue IDs/names retained.
- Original Queen/Big Mom confirmation uses a generated coin button. The toss animates the original server result from the existing public log; no client RNG or action changes.
- New art was made by built-in GPT image generation. Source prompts/provenance: CARD_FLOW_ART_PROMPTS_20261028.json. PNG-to-WebP conversion only; CSS positions/scales sprites, no CSS-painted replacement artwork.

## Source
Mobile android/web/card-phone-flow.js, card-phone-library.js/.css, card-phone-coin.js, card-phone-fx.js, card-phone-piles.js, card-phone-stage.js, card-phone-targets.js (existing forwarding preserved), art/card-venue-*-v1.webp and art/card-coin-toss-v1.webp; mobile-sources.mjs, build-card-desktop.mjs, prepare-web.mjs. Desktop generated public/js/card-desktop-table.js and public/css/card-desktop-table.css; game.html cache query/final presentation wait. iOS dependencies.json/export_presets.cfg identify Android 51 / iOS 52.

## Verification boundary
QA runs original Card HTML/engine/event handlers in isolated Chromium, plus an actual npm-start Socket.IO server with two isolated browser contexts. It is not physical Android/iPhone/Electron acceptance. Final reports and publication receipts live in D:/Codex_QA/card-flow-library-20261028 and the versioned mobile output folders.

LATTICE tools were not available in this session. No task persistence, graph completion or fabricated acceptance is claimed. Existing project/task IDs remain unchanged.

Validation: latest flow/library QA 44 phone + 44 desktop, no page errors; prior hand/duel regression 58; actual local two-client Socket.IO 8 checks; engine/server newline-normalized bytes equal published 67226b4a. No physical-device test in this turn.
