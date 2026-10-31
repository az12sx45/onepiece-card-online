# Card status and interaction fixes — 2026-11-01

## Scope
Only Card match runtime and its server action loop. Launcher, lobby, Board, Chess, native binaries, IDs and save schema are unchanged.

- Paralysis: server loop uses the original DRAW turn-start branch automatically only for an alive, skipped current player in draw phase without pending choice. Venue and presentation barriers still apply. All normal human draws remain manual; idle takeover remains 90 seconds.
- Usopp: valid alive opponent with protection/dodge resolves existing effectGuard immediately at PICK_TARGET, once, with the original defense score. Protection takes precedence; no digit, guess history or hidden card is emitted. Unprotected targets still guess normally, including enhanced chains.
- Coin: remove flattening filter from the preserve-3d parent. Settle on one authoritative face (skull heads / compass tails), using the existing public server log, never client randomness. Toss stays in the current field.
- Sniper: replace sprite atlas with GPT generated v3, edge-mask the overlays, start sideways evasion at 300 ms and reach it at 780 ms, before the 1450 ms impact; cleanup cancels transient motion while retaining the normal active-turn layout.
- Cues: original player target buttons remain authoritative; portraits get stronger labels and glow, pile gets a readable draw prompt. No new action path or automatic ordinary draw.
- Duel: charge before finisher, brief impact pause, arena-only shake and existing impact art. Winning hand remains secret; only public loser card/number appears on impact. Existing outcome/turn barriers remain.

## Files
Formal: server/engine.js, server/index.js, public/game.html, generated js/card-desktop-table.js and css/card-desktop-table.css; targeted engine, six-viewer and browser QA scripts.
Editable mobile source: android/web/card-phone-coin.js, card-hud-combat.js/css, card-duel-finishers.js, new card-action-cues.js/css and art/card-sniper-atlas-v3.webp; android/build-card-desktop.mjs, mobile-sources.mjs, card-status-interactions-qa.mjs.
The inline compatibility block upgrades installed v059 Android/iOS bundles. Version guards prevent double mount.

## Validation
- 168 real engine and extracted actual server-loop checks: guarded targets, invalid targets, six sequential skipped humans/CPUs, both readiness gates, stale timers, no draw or hidden hand exposure.
- 211 original skill-intent checks; 4,338 assertions across 140 normal/enhanced/guarded scenarios and all six viewers.
- 20 idle timeout checks; 17 presentation, 17 venue and 17 group sequence checks.
- Desktop 1366x768, exact installed Android bundle 844x390 and iOS bundle 640x320 in Chromium: 14 checks each, zero page errors. Coin faces distinct; evasion before projectile; no leftover sprite or motion; guard skips digit picker; duel reveals only defeated card and completes.
- Initial integration testing caught a new cue observer repeatedly writing an unchanged hidden attribute, rescheduling the 60 ms presentation pump before it could run. Fixed with idempotent cue writes. Real npm-start / two-window Socket.IO regression now passes all eight checks: join, start, gated draw, synchronized state, same-seat refresh and private-hand boundary. Dedicated six-seat suite results appended after completion.
- Physical-device acceptance is not claimed.
- LATTICE status/task tools are not exposed in this session. games.json was consulted; no new task/persistence/graph success claimed.

## Art provenance
Built-in image_gen, transparent_background=true. Generated seed atlas and a cleanup edit, then format conversion preserving alpha to android/web/art/card-sniper-atlas-v3.webp. CSS edge mask suppresses remaining diffuse sprite boundaries. Prompt: three-by-two pirate-anime atlas with vine reticle, green seed bullet, leaf impact, cyan sidestep swoosh, gold clash spark and leaf fragments; isolated transparent sprites with no frames, words or panels. Cleanup prompt removes diffuse haze while preserving the six shapes/positions. Original generated files remain in .codex/generated_images/01a13564-f60c-71b1-8178-336039a1904c (exec-b0fbc332… and exec-d527270e…). No source photo, additional game asset or paid external service used.

## Six-seat integration result
PASS: 16 assertions, three independent Chromium clients using desktop and exact v059 Android/iOS bundles plus three CPUs. All six mandatory paralysis skips complete without drawing. Slow readers still block CPU/action advancement; private reveal, CPU duel, next round and venue-ready complete without page errors. See CARD_STATUS_GROUP_QA_20261101.json.

## Six-seat compact layout
Additional current-source check: exact installed Android bundle at 640x320; five opponent targets, draw prompt and target banner fit; unchanged cue hidden state causes zero observer writes during an idle 500 ms window. All five checks pass. Evidence: CARD_STATUS_SIX_SEAT_QA_20261101.json.

## Final art edit prompt (built-in image_gen)
Edit this VFX atlas: preserve the six shapes, positions, 3x2 layout, outlines and colors, but REMOVE ALL diffuse glow, colored haze, green/gray/brown backgrounds, shadows, background lighting and gradients between the six sprites. All blank space INCLUDING the open center of the top-left vine ring MUST be 100% TRANSPARENT (alpha=0). Only keep actual inked leaves, actual seed and thin speed streaks, sharp white/yellow impact rays, actual cyan wind streaks, actual yellow spark, actual separate leaves. Crisp isolated hard-edged cel animation assets on TRANSPARENT background. No ambient bloom. No rectangular or circular filled area behind any sprite.

Saved final asset: C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html/android/web/art/card-sniper-atlas-v3.webp. Generated alpha preserved during WebP conversion; runtime mask softens remaining haze at cell boundaries. The image generator did not completely remove all diffuse glow; no claim of perfect isolated alpha is made.
