# Card hand dock and duel presentation — 2026-10-28

Shared desktop/mobile UI. Original rules, state/save fields, Socket.IO events and play confirmation remain unchanged.

- Own cards rest below the viewport as a compact fan. Mouse hover lifts the fan; touch first tap only lifts, next tap opens the original inspection and confirmation. Keyboard focus/Enter and Escape remain available. Outside touch, identity/card/turn changes and disconnect refold the fan.
- Bottom full-width panel removed. Existing generated chest, venues, own avatar and log button remain in compact corner groups. The turn/menu strip sits below the roster in the center, clear of both card piles.
- Opponent portrait-to-panel gaps and panel text padding increased. Existing GPT-generated frames and original card artwork are reused without new CSS-painted artwork.
- Duel narration introduces the participants before entry. Two backs travel from the public portraits, clash, then the known winner is named. Only the original public duel_log losing face turns over; the winning card remains a back even when its face is known to the local viewer. Ties show two backs and do not reveal a face. Loser's revealed card travels toward discard; winner's back returns to its portrait.
- Played center card is positioned below the opponent HUD so the taller padded roster is not covered.

## Source and evidence
- Mobile authority: android/web/card-hand-dock.js/.css, android/web/card-phone-fx.js, android/web/card-phone-cinema.css, android/mobile-sources.mjs, android/build-card-desktop.mjs, android/prepare-web.mjs.
- Desktop: generated public/js/card-desktop-table.js, public/css/card-desktop-table.css and game.html query revision.
- QA: android/card-hand-duel-qa.mjs; mouse/touch fan fold/expand, no accidental ACTION, original confirmation reachable, frame padding, wait-turn hand, center-card HUD separation, original duel + duel_log delivery for left/right loss, own win and tie. Existing cinema suites cover discard/privacy, confirmation, narration, Law and fullscreen enhancement playback. npm start checks seven original routes.
- Review: D:/Codex_QA/card-hand-duel-20261028/review.html. Reports record exact pass counts. Physical Android/iPhone/Electron acceptance is not claimed.
- LATTICE API unavailable in this session; existing project/task identity retained as context, with no claim of persisted task updates or graph refresh.

Validation completed: hand/duel suites 58 desktop + 58 mobile checks (1024x600/1366x768 and 640x316/844x390); existing cinema suites 102 desktop + 102 mobile checks, no page errors; final added center-stage geometry also verified below opponent HUD. npm start seven routes PASS. Engine/server byte-equivalent to published aa09ba353 after newline normalization. Real devices not tested.
