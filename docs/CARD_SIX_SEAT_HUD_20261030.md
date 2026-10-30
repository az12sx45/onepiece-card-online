# Card six-player HUD review — 2026-10-30

Presentation candidate for the restored original web Card match. Launcher, lobby, server rules, action IDs and private-face visibility are unchanged. This iteration has not been published or packaged for Android/iOS.

## Design and source
Six player plates share one ordered rail, including self. Visual order begins at the authoritative round startSeat and follows increasing player index with wrapping; original DOM/server indices remain unchanged. Number medallions show round order. Current actor scales 1.09 with gold emphasis; defeated seats remain in position. Circular portraits, name, coins and status icons occupy a single GPT-generated plate. Original player-detail rows remain accessible.
Shared source: android/web/card-seat-hud.js/css; android/web/art/card-seat-hud-v1.webp. Original avatar wrapper skips the integrated plate to avoid applying a second ring.
android/mobile-sources.mjs and android/build-card-desktop.mjs register and embed the shared art/module; desktop output is public/js/card-desktop-table.js and public/css/card-desktop-table.css in the formal release tree.
card-phone-fx.js skips the preliminary mini-card for the private scouting recipient; card-phone-controls.js expands the existing hand in place; card-phone-flow.js suppresses duplicate private text-card presentation when the authorized face event already contains it, preserving blocked/empty feedback.
card-phone-coin.js uses a bottom-right launch origin; card-phone-library.css caps the coin at 110px desktop and 18dvh phone, retaining the original server outcome and current venue. No random result or authoritative mutation is introduced.

## GPT asset provenance
Mode: built-in image_gen tool, true RGBA output, format-only Pillow conversion to WebP (quality94, method6, no repaint or compositing).
Original: C:/Users/王曜瑋/.codex/generated_images/01a13564-f60c-71b1-8178-336039a1904c/exec-cd85565d-f7f5-4ef9-b336-295e564fb9af.png
Runtime asset: C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html/android/web/art/card-seat-hud-v1.webp
Prompt brief: single production-ready compact integrated pirate player plaque, landscape1.85:1 transparent; antique gold/rope navy leather; portrait socket center22%x38%, diameter57%height; right55% clear name/gold; bottom25% clear status; small rank medallion no letters/numbers; orthographic no perspective, no external shadows, no logos/characters; six across mobile/desktop. Live names/ranks remain text for legibility.

## Verification
Evidence: D:/Codex_QA/card-six-seat-hud-20261030.
android/card-six-seat-qa.mjs uses formal original game.html/server engine and viewer-visible fixture state, with isolated Chromium at1366x768,1024x600,844x390,640x316. Desktop/phone reports each passed33 checks for six visible plates, stable turn order, no overlap, circle proportions, current-player emphasis, all five status icons, target ID routing, one draw flight, one scouting reveal and smaller bottom-right coin with authoritative result. Media is stubbed; this is browser emulation, not physical devices.
Original enhanced Law preview/swap regression passed16 checks. Real npm start plus two isolated guest browser clients passed8 checks: join, start, draw, presentation wait, refresh and hidden other hands. The final desktop/phone runs also pass2/4-player fixed aspect, defeated-slot retention and original-detail checks. An earlier640px four-player aspect failure is retained under geometry-phone; the final33-check phone report supersedes it.
Before copies: source-before/. New review PNGs retained for requested visual comparison; no broad cleanup performed.

## Persistent tooling
LATTICE APIs are absent from the live tool catalog. Historical project fc1f1991-a190-4cd1-8933-947297d0ebbe /Card task e4368cf0177acd6ead577d369a181d11b6d4ff30c66fb681fe4ff60e8b5b663e are context only. No task persistence, graph refresh or LATTICE acceptance is claimed.
