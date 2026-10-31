# Card status-row starter and mobile artwork readiness — 2026-11-01

## Changes and boundaries
Only Card match presentation. Launcher, lobby, native entry routes, Board, Chess, IDs, save schema, server events and rules are unchanged.

The existing engine-derived next-starter marker is now a GPT-drawn straw-hat/pennant icon positioned within the status strip, with no text badge above the HUD. It reserves space beside existing statuses and opens a touch/keyboard explanation. The original HUD owns the marker's normal turn order and normal Roger override; an eliminated Roger can remain next starter. Enhanced Roger's prediction rule is not involved. The icon stays outside the status container in the DOM because installed v059 HUDs replace that container; moving it into that container would create a repeated observer/rebuild loop.

Public played-card projection and selected-target diagonal portraits now decode their artwork before starting the visible animation clock. Old projection used a 2.5-second decode race and silently skipped on slow load; old cut-in started its timer before decode. Regression: forcing 3.5-second Image.decode delay skips the projection on baseline e86800315, while the updated code renders projection and cut-in. This is an isolated browser reproduction of a failure path, not a verified root cause from the user's device logs.

Readiness keeps only four decoded public images, displays a delayed preparation hint, uses the already-public played-card image as fallback, and bounds each decode to 12 seconds. Disconnect, JOINED and hidden document cancel pending decoding; a cancelled request cannot resurrect an effect. Usopp portrait and reaction atlas also prepare before their timeline. No opponent hidden hand is consulted. Original projection -> white -> full movie -> recall -> selection -> selected-target cut-in/outcome order remains.

## Files
Formal delivery: public/game.html (installed-client compatibility), public/js/card-desktop-table.js, public/css/card-desktop-table.css; scripts/publish_card_program_blobs.js expected release baseline.
Editable mobile: android/web/card-art-ready.js, card-next-starter.js/css, art/card-next-starter-v2.webp; card-anime-skills.js, card-enhancement-summon.js, card-match-polish.js, card-hud-combat.js; android/mobile-sources.mjs and build-card-desktop.mjs. Tests: android/card-mobile-effects-qa.mjs, updated version assertions in card-summon-qa.mjs and card-status-interactions-qa.mjs.

## Validation
- Android installed v059 script/CSS with Android UA, iOS installed v059 with iPhone UA and CSS appended at document end, and desktop: 11 checks each PASS in Chromium. Forced 3.5-second cold decode, stationary projection/movie/choice/cut-in lifecycle, six seats plus six statuses, starter detail does not emit ACTION, eliminated Roger marker, disconnect cleanup, no page errors.
- Baseline slow-decode test intentionally fails because projection never appears; retained as regression evidence, not a current failure.
- Installed iOS bundle at 640x320: 14 reaction checks PASS (draw/targets, two coin faces, Usopp dodge/guard, duel privacy/cleanup).
- All 20 enhanced cards: 196 checks PASS using the original engine and installed Android bundle. Controlled movie events verify projection anchoring, no choice before movie/recall, and private acquisition-only charging.
- Six-seat Socket.IO integration: 16 checks PASS (desktop plus exact Android/iOS bundles and three CPUs), including six paralysis skips, private reading, CPU duel, next-round/venue barriers, zero page errors. First concurrent browser run ended before room setup completed with C: near full and no completion receipt; only the completed rerun using D: temporary storage counts as evidence.
- Required npm start / two browser windows: 8 checks PASS, including create/join/start, gated state delivery, refresh restores same seat, private hands hidden.
- Final straw-hat icon: desktop and both installed mobile bundle layouts retested after art replacement, including all six status icons and eliminated Roger.
- Physical Android/iPhone devices were not operated. iOS injection is simulated in Chromium, not native WKWebView verification.
- LATTICE tools are absent in this session. No new task, persistence, graph or acceptance claimed.

## Art provenance
Built-in image_gen, transparent_background=true. Final original: C:/Users/王曜瑋/.codex/generated_images/01a13564-f60c-71b1-8178-336039a1904c/exec-d0766783-893f-4ee1-b740-d5db6664ecd7.png.
Final project asset: C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html/android/web/art/card-next-starter-v2.webp. Generated alpha preserved during 256px WebP conversion; embedded in common CSS with no new media path. User rejected the earlier generic compass; it is not used. A skull-flag generation failed; final design uses the recognizable red-band straw hat and a small sailing flag.

Final prompt:
A single small transparent game status icon: a warm golden woven straw hat with a broad brim and vivid red ribbon, leaning beside a short gold pole carrying a small triangular crimson sailing pennant pointing right. The STRAW HAT is the large dominant shape, the flag is small and secondary; only these two objects, no skulls or bones. Cheerful pirate adventure anime visual language, crisp expressive hand ink outlines, clean two-tone cel shading, bright warm colors. Icon means this pirate captain goes first next round. Extremely readable at tiny 24 pixel size, simplified bold silhouette, not realistic, not 3D. Centered square composition, modest empty margin. Fully transparent background, no frame, no plaque, no compass, no wheel, no text, no numbers, no landscape, no gradients or haze around the icon.


Published and publicly verified 2026-11-01: package-1372e8179169b0a2; source 39b5781e168958439a3863ad5e60061cb83d7f55; release bb0927f724ea8752002182997dbfd0fb20c35398. 39 public byte/runtime/CAS checks PASS, all 31 programs match. Public six-seat browser room (desktop, exact v059 Android/iOS bundles and three CPU) passes 17 checks, no page errors. Existing native apps load the online Card update; no APK/IPA rebuild, launcher or lobby changes. Final next-starter art is straw hat/pennant v2. No physical-device claim. Evidence: CARD_MOBILE_EFFECTS_RELEASE_20261101.json. Temporary screenshot deletion was blocked by automatic policy review; 27 files / 15,118,793 bytes retained, zero deleted.
