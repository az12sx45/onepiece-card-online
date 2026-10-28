

## 2026-10-28 Card duel finishers and outcome gate
Shared presentation adds 20 GPT-generated transparent special-move sprites, selected from a cosmetic shuffle bag without reading winning/hidden cards. Only the public duel_log loser face can be revealed at impact. Actual card texture is masked, split, shattered, melted or displaced; fragments move away before outcome text. silent_discard is no longer a preview narration. Guess/effect result notices wait until the complete transaction animation and pile travel finish. Rules and server packet formats remain unchanged.
DRAW retains the original pending request guard and sends once immediately; the original draw movie is bypassed. A pending card flight waits for the actual hand layout instead of being consumed before its target becomes visible. Active turn is highlighted in the public HUD.
Source modules: android/web/card-duel-finishers.js/.css, card-turn-draw.js, card-phone-fx.js, card-phone-flow.js, card-phone-flight.js, mobile-sources.mjs, build-card-desktop.mjs. Desktop delivery: public/js/card-desktop-table.js, public/css/card-desktop-table.css, public/game.html. GPT prompt provenance: android/web/art/card-finishers-v1-prompts.json.
Validation records are stored under D:/Codex_QA/card-finishers-20261028. Browser checks and packaging are separate from real Android/iPhone acceptance. Release receipt will record published bytes.

Validation: 32 phone and 32 desktop real-engine presentation checks; 62 all-finisher, secret-card, tie and disconnect checks; 32 existing pile/coin sequence checks; 8 real npm-start / two-browser Socket.IO checks passed. Physical devices were not operated in this run. Engine SHA-256 remains E50D2B5E4406CD9DE8EF38FFA681921E6C7AE36225C5ABA8BC96969FA98D69D1.
