# Card turn marker and Usopp sniper presentation — 2026-10-30

Scope: original Card match only, launcher and lobby unchanged. Includes the preceding six-seat/match-HUD candidate. No server engine/rule/save/action changes.

- Next-round starter: engine.nextRound uses nextRoundStart if set, otherwise (startSeat+1)%count. Normal Roger eliminates the holder and sets that holder as next-round starter. Enhanced Roger with Oro Jackson predicts this round winner; prediction reward uses existing engine logic and does not select a starting player. Eliminated holder retains the flag. No UI guess based on current turn or rogerPred.
- Current opponent plaque grows to1.22 and lowers18px; own plaque grows1.14 around bottom-right with4px downward offset. Rank order/IDs unchanged. Explicit current-action caption remains.
- GPT transparent six-cell atlas: botanical reticle, seed, impact burst, dodge swoosh, starting pennant, fragments. Hit shows burst/shake; miss shows passing shot and afterimages; shield/dodge labels remain distinct. Outcome badge only appears1450ms after effect begins. Existing complete transaction presentation queue retained; no early hidden face reveal.
- Shared files: android/web/card-seat-hud.js/css, card-hud-combat.js/css, card-phone-fx.js, android/mobile-sources.mjs, android/web/art/card-sniper-atlas-v2.webp. QA android/card-turn-sniper-qa.mjs. Desktop output generated with android/build-card-desktop.mjs.
- Artwork: built-in image_gen, source exec-249cf86e-ae25-41ce-9260-064e9fd3c945.png. Format-only WebP quality94 method6. Prompt/provenance in card-turn-sniper-20261030/art-provenance.json.
- Evidence: D:/Codex_QA/card-turn-sniper-20261030. Browser emulation and local server checks; not physical-device acceptance. Publication status is recorded separately after public readback. Shared phone sources updated but a desktop program release alone does not replace the Android/iOS embedded presentation.
- LATTICE APIs absent. No persisted task, graph, or formal LATTICE acceptance claim.
- Cleanup: hash-verified duplicate installer temporary copies identified; attempted deletion rejected by automatic review (blocked by policy), no files deleted and zero bytes reclaimed. Original/release backups untouched.
