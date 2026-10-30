# Card match HUD and status details — 2026-10-30

This is a local original-web-match review candidate; not published and not a new APK/iOS package. Supersedes the six-player rail arrangement in CARD_SIX_SEAT_HUD_20261030.md: total players includes self, so a six-player table has at most five opponents at the top and self at the bottom-right. All ranks still derive from the original startSeat and player index, including self. DOM/server indices are never reordered.

## Implemented
- One generated navy/gold plate combines original live #chestLbl and #venues. Desktop width360px maximum; mobile minimum220px. Existing venue-card background switching and full venue library remain.
- Integrated player plate v2 has a taller status band. Circular portraits and rank medallions use normalized art coordinates; actual active player is emphasized on either rail or self plate.
- GPT One Piece-inspired manga atlas replaces emoji in the player plate: barrier, speed afterimage, icy fist, lightning, ice-oni, disconnected snail. The initial jeweled/realistic atlas was rejected by the user and is NOT referenced by runtime.
- Status buttons open the existing reading sheet with precise server-rule explanation. They do not target a player or emit a game action, including while target selection is open. Ice infection and armed ice check are distinguished.
- Full original player details remain available. Shared stage no longer clones the self UI over the new module. Target routing continues through original IDs.
- Held-hand empty flex space no longer intercepts resource-panel taps; only visible card art receives pointer events. Existing hover/inspect behavior remains.

## Source
Shared: android/web/card-seat-hud.js/css, card-phone-stage.js, card-phone-targets.js, card-phone-library.css, card-hand-dock.css; android/mobile-sources.mjs.
Art: android/web/art/card-seat-hud-v2.webp, card-match-resources-v1.webp, card-status-manga-v2.webp.
Formal generated output: public/js/card-desktop-table.js and public/css/card-desktop-table.css, built by shared android/build-card-desktop.mjs.
QA: android/card-match-hud-qa.mjs and existing android/card-field-law-qa.mjs; formal scripts/card_flow_sync_qa.mjs.
No launcher/lobby/server engine/rules/save schema changes.

## Verified rule text
server/engine.js:505–506 generic protection/dodge guard;1059 protection expiry on draw;1080–1083 paralysis skip;1088–1091 infected-to-armed;1121–1126 frozen legal-play requirement/clear;1181–1188 odd elimination/even clear. Explicit bypass/removal skills remain exceptions, not new behavior.

## Assets and generation
Built-in image_gen mode, not API CLI. Format-only PNG->WebP conversion (quality94, method6) preserves dimensions. Runtime files copied into the shared workspace. Original generated files and exact prompts are recorded in D:/Codex_QA/card-match-hud-20261030/art-provenance.json.
Manga atlas final source: exec-4d999026-7892-4842-bb69-59286b17343f.png, opaque navy backing to retain black ink at tiny sizes. Resource frame: exec-a39933f6-10c8-47a7-a970-d9f3de84f302.png. Player frame: exec-59b8289b-e2de-4eb8-bf97-02ec7ea3cd92.png.
Reference: official Bartolomeo character page https://one-piece.com/character/bartolomeo/index.html; icon concepts are custom presentation choices, not changes to card rules.

## Verification boundary
Evidence root: D:/Codex_QA/card-match-hud-20261030. Isolated original HTML/server-engine visible-state fixtures at1366x768,1024x600,844x390,640x316. Tests cover5+1 ranks, framing, status art/alignment, actual status/venue clicks, original balance update, state details with no action, self-target ID and2/4-player states. Real npm-start two-browser sync and original Law preview/swap regression separately recorded. Final verification-receipt.json is the pass/count/hash authority. Browser emulation is not physical-device acceptance.
LATTICE runtime/task tools remain absent from live catalog; historical project fc1f1991-a190-4cd1-8933-947297d0ebbe and Card task e4368cf0177acd6ead577d369a181d11b6d4ff30c66fb681fe4ff60e8b5b663e retained as context only. No new persistence/graph claim.

## Open-source effect options reviewed, not installed
1. Anime.js (MIT): https://github.com/juliangarnier/anime and timeline https://animejs.com/documentation/timeline/ . Best near-term fit for existing DOM/WAAPI card movement, shuffle and ordered reveal/impact/discard choreography. This is an integration assessment, not a benchmark or automatic solution to synchronization.
2. PixiJS (MIT) plus matching PixiJS Filters (MIT): https://github.com/pixijs/pixijs and https://github.com/pixijs/filters . Useful as a transparent effect canvas over the current game for card-hit particles, shields, shockwaves, ice fragments and localized motion blur. Filters6 targets Pixi8. Official ParticleContainer has an experimental-interface notice: https://pixijs.com/8.x/guides/components/scene-objects/particle-container . Pin compatible versions and measure mobile fill-rate, cap particle count, release textures.
3. EffekseerForWeb (MIT): https://github.com/effekseer/EffekseerForWeb . Browser JS/WASM runtime with WebGL/WebGPU backends for editor-authored skill effects. Old https://github.com/effekseer/EffekseerForWebGL directs new development there. Appropriate for a later limited special-move prototype; extra WASM/resources and device validation needed. Do not assume desktop effect presets fit mobile.
4. Not first choice: @pixi/particle-emitter README still discusses older Pixi major versions and editor config migration; do not pair blindly with current Pixi8. https://github.com/pixijs-userland/particle-emitter
Recommendation: preserve current rules/event queue, first improve its sequence with Anime.js only if it reduces maintenance; add one Pixi effect canvas for high-value skill impacts, using generated art. No libraries downloaded, no dependency manifests modified, no performance claim without a device measurement.

2026-10-30 final candidate verification: desktop62 + phone62 + real local sync8 + original Law16 =148 checks passed. Final screenshots visually reviewed, source hashes and scope recorded in card-match-hud-20261030/verification-receipt.json. Status inspection is clickable without game actions, including own/targeting/offline/infected states; original held-card touch inspection retained. No online or physical-device release claim.
