# Card visual handoff — 2026-10-28

Private reveals page one complete card at a time, with previous/next, swipe, count and an explicit return action. Law SCAN reserves separate card, title, information and button regions. Turn/played-card labels yield to the reveal rather than overlapping it.

Transient animations borrow complete source surfaces, including frames and shadows. Reference-counted leases restore the original presentation after landing, cancellation, disconnect or visibility loss. Inspecting one local card leaves the other card visible. Public scouting moves only card backs from the target hand and back; private faces remain recipient-gated. Shuffles temporarily replace the whole static pile, without stacked CSS shadows. Sabo collects the retained temporary draw when the original hand is the played card. No authoritative card, rule, event, identity or save schema changes.

Sources: android/web/card-phone-flight.js/css, card-pile-actions.js, card-phone-stage.js, card-phone-controls.js, card-phone-fx.js, card-phone-library.css, card-phone-cinema.css, card-hud-combat.css. Generated desktop outputs: public/js/card-desktop-table.js and public/css/card-desktop-table.css. Existing GPT artwork reused; no new generated asset.

QA: android/card-visual-handoff-qa.mjs exercises original engine/handlers at 640x316, 844x390, 1024x600 and 1366x768. Coverage includes complete private cards, recipient isolation, Law controls, inspection ownership, scan return, Sabo/Kid piles, disconnect and overlapping leases. Regression suites cover action sequencing, library/view completion, duel secrecy and two-browser server sync. Final results are in CARD_VISUAL_HANDOFF_RELEASE_20261028.json; until that receipt exists, release verification remains pending. Browser emulation is not physical Android/iPhone acceptance.

Rules engine SHA256 remains e50d2b5e4406cd9de8ef38ffa681921e6c7ae36225c5aba8bc96969fa98d69d1. LATTICE APIs were unavailable; no task persistence or graph acceptance claimed. Existing Card task e4368cf0177acd6ead577d369a181d11b6d4ff30c66fb681fe4ff60e8b5b663e retained as context.
