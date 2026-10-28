# Card HUD combat presentation — 2026-10-28

The public defeated card displays a large independent number at impact. No winning/private card identity is read or inferred. The original forbidden guess digit 1, ten number controls, actions, state and save contracts are unchanged.

The number picker uses five evenly spaced columns with 44px minimum targets. Private card viewing has a separate prominent return button and keeps the hand/piles visible. Played cards fly from their owner's position, remain upright briefly, settle into tabletop perspective, then trigger their effect; only after resolution do they fly to discard.

The active player's avatar/name block grows slightly together. A GPT-generated Green Star projectile connects attacker and target; missed guesses and dodge defenses move the target HUD with afterimages, while shields visibly intercept the attack. Reactions are canceled on reset/disconnect. Result narration remains deferred until the visual sequence completes.

Source: android/web/card-hud-combat.js/css, card-duel-finishers.js, card-phone-fx.js/css, card-phone-stage.js/css, card-phone-cinema.css, card-hand-dock.css, card-phone-piles.js; bundling in mobile-sources.mjs and build-card-desktop.mjs. GPT prompt/provenance: android/web/art/card-usopp-green-star-v1-prompt.json. Formal desktop generated outputs: public/js/card-desktop-table.js and public/css/card-desktop-table.css.

QA: android/card-hud-combat-qa.mjs tests original handlers, readable public loser numbers 0/19, visibility, reactions, disconnect cleanup and phase ordering at 640x316, 844x390, 1024x600, 1366x768. Also run original-engine action sequencing and two-browser server synchronization. Evidence is under D:/Codex_QA/card-hud-combat-20261028. Automated browser checks are not physical Android/iPhone acceptance.

Original engine SHA256: E50D2B5E4406CD9DE8EF38FFA681921E6C7AE36225C5ABA8BC96969FA98D69D1. LATTICE tools unavailable in this session; no persistent task/graph success claimed. Existing Card task e4368cf0177acd6ead577d369a181d11b6d4ff30c66fb681fe4ff60e8b5b663e retained as context.
