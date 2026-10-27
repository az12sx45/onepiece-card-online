# Card table cinema and inspection — 2026-10-28

Scope: shared desktop and mobile presentation. Rules, engine, state schema, saves, private-event recipients and original action callbacks remain unchanged.

## Changes
- Discard entry resolves clicks captured by the original drag container; pile label and keyboard also open inspection. Covered cards remain backs.
- Next round and CPU skip use original controls below the play area, away from the upper-right menu.
- Inspection and private reveal place cards directly on the table. Compact artwork-backed effect text wraps or scrolls inside its own region; navigation and confirm stay reachable. Original Law swap/cancel callbacks remain in use.
- Public action narration precedes animation (2.2–3.8 seconds reading; 1.8 seconds effects, 3 seconds duel). Fullscreen enhanced video also waits for narration. Separate generated slashes, lightning and ice; two-way card exchange, scan, shield break and dodge. Only the publicly supplied losing duel card is revealed.
- Original live Card STATE does not contain phase. Entry/flight/venue presentation now accepts that actual shape, rather than requiring the artificial phase=playing fixture. Center card exits only after effects/private flights complete.
- Disconnect, backgrounding, round changes and video takeover cancel old scheduled effects.

## Files
Mobile authority: android/web/card-phone-{table,piles,stage,flight,fx}.js, card-phone-fx.css, card-phone-cinema.css, art/card-fx-{slash,lightning,ice}.webp; android/mobile-sources.mjs, build-card-desktop.mjs, prepare-web.mjs, card-cinema-qa.mjs. Native Android/iOS wrappers consume the same versioned presentation.
Live desktop authority: public/js/card-desktop-table.js and public/css/card-desktop-table.css generated from those modules; public/game.html asset query revision; existing scoped publisher baseline updated. scripts/card_action_sync_qa.mjs records isolated client diagnostic state and uses stable test identities.

## Verification
- card-cinema-qa: desktop 102 checks (1024x600,1366x768), mobile 102 checks (640x316,844x390). Real pointer capture/tap discard entry, covered privacy, card navigation, long text and confirmation bounds, named narration before visual nodes, distinct effects, private reveal routing, actual no-phase STATE entry→resolve→discard, public-loser-only duel, Law controls and fullscreen video cleanup. No page errors.
- Existing target suites: 67 desktop + 67 mobile checks, original actions and shield/dodge behavior.
- npm start: seven entry routes return HTML 200; isolated Socket.IO two-window test: seven checks for join/start/draw/reload/private hands.
- Unseeded guest test exposed duplicate initial joins in the pre-existing direct game URL bootstrap. Retest used stable isolated identities, matching signed-in clients' persistent identity contract; original failure retained in QA evidence. No claim of guest-bootstrap repair or production-account/physical-device acceptance.
- Local review: D:/Codex_QA/card-cinema-20261028/review.html. Publication requires separate public hash readback; source/build pass alone is not deployment.

## GPT image generation prompts
Transparent sprites created with GPT image generation; normal export resized to 384px WebP with alpha. Existing generated panels/rings are reused for framing, not CSS-drawn replacement art.

### card-fx-slash.webp
A single transparent 2D anime pirate card game VFX sprite: three intersecting curved luminous emerald sword slashes with white hot cutting edges and tiny gold sparks, powerful sweeping diagonal composition, isolated luminous energy strokes only, no sword handle, no person, no text, no frame, no background. Premium hand painted fantasy game effects, highly legible at 180 pixels, centered with generous transparent margin.

### card-fx-lightning.webp
A single transparent 2D anime pirate card game VFX sprite: branching golden yellow lightning strike descending from a small violet storm puff, dynamic jagged luminous electric forks, isolated magical electricity only, no people, no text, no frame, no scene. Premium hand painted fantasy game effects, legible at 180 pixels, centered with generous transparent margin.

### card-fx-ice.webp
A single transparent 2D anime pirate card game VFX sprite: radial cluster of translucent cyan ice crystals and frosty shards, opening around a transparent center so a circular player avatar can remain visible, strong pale blue crystalline silhouette, no person, no text, no square frame, no background. Premium hand painted fantasy game effects, legible at 180 pixels, generous transparent margins.
