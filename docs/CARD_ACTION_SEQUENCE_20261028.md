# Card action completion sequencing — 2026-10-28

Source authority: D:/Codex_Release_Worktrees/board-multiplayer-authority-20261025. Shared presentation authored in the Android landscape worktree and bundled by android/build-card-desktop.mjs. Engine, IDs, save fields and Socket.IO packets remain unchanged.

## Changes

- Queue each EMIT/STATE batch. Preview center entry, effect-specific motion, private reading, coin, and pile movement before replaying original result handlers and applying visible state. Server computes outcomes normally; UI defers their display.
- Center-stage acknowledgement uses the received transaction, not growth of discard length. Kid's draw removes one discard so the old length test could never finish.
- Normal Kid enters center, shuffles discard backs, then waits for a direct pile click. One original PLAY_CARD action performs the original server random draw excluding Kid. Double taps are consumed; empty eligible pool, turn changes and disconnect reset remain authoritative.
- Sabo returns affected players' card backs, shuffles, then deals. Protected/dodging players are excluded from the visual by the original public defense events and state. No opponent hand values are read.
- Self hand transfers, forced discards, swaps and duel entry start at the actual hand instead of the self avatar. Loser-only public duel disclosure is retained; state/log elimination waits for all preceding motion.
- Queen/Big Mom use a clickable GPT coin face. Server-owned result settles after the spinning throw; no client-side RNG or probability changes.

## Files and verification

Shared modules: card-phone-flow, card-phone-stage, card-phone-fx, card-phone-flight, card-phone-coin, card-pile-actions, card-phone-library.css; mobile-sources and desktop bundler; generated public/js/card-desktop-table.js and public/css/card-desktop-table.css; game.html cache revision.

Targeted QA: android/card-action-sequence-qa.mjs. Regression: android/card-flow-library-qa.mjs. Actual local server/two-browser room checks: scripts/card_flow_sync_qa.mjs. Final results and publication identities are recorded separately after successful execution. Browser emulation is not physical-device or real-account acceptance.

Verified browser QA: {"phone": 32, "desktop": 32, "edge": 7, "regression-phone": 46, "regression-desktop": 46, "realLocalTwoBrowser": 8}; no page errors. Original server/engine.js SHA256 E50D2B5E4406CD9DE8EF38FFA681921E6C7AE36225C5ABA8BC96969FA98D69D1 matches both authority and mobile source. These checks do not claim physical-device acceptance.

Final visual review: 6 additional phone/desktop checks passed. Kid discard count and draw instruction share one label; the ordinary pile label is restored after selection/cancellation. Coin has no rectangular backdrop or panel.
