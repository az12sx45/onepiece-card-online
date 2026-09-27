# Backend independent follow-up review — 2026-09-27

Candidate: C:/Codex_Candidates/launcher-character-life-1.2.0. Formal D tree untouched.

## Fixed findings

1. Expired reservations and jobs invalidated by moved furniture were counted by the legacy API until the next Life GET. `legacyWorkGuard` now normalizes ownership/current placement and filters expiry/context itself; caller supplies the same authoritative transaction clock.
2. Object prototype properties could pass command/directive name lookup. Commands now require a string and an own allowlist property; persisted directives and directive.set likewise accept own keys only.
3. Production server time was captured before profile-lock acquisition. Life and legacy companion requests now sample production time after acquiring the lock; explicit test clocks remain injectable. This avoids using a queued request's previous UTC date for limits.
4. Automatic placement on a character purchase could overflow the safe room revision. It now rejects and rolls back, preserving wallet and ownership.

## Verification

- launcher_life_server_qa.js: 160 checks PASS. Original 104 assertions retained; added malformed inherited commands, expired reservation legacy start, moved station legacy start, duplicate command debit/receipt, revision conflict, purchase/payout in both serialized orderings, old/new legacy claim in both orderings, duplicate purchase/arrival, ninth/tenth purchase preserving positions, overflow rollback, six offline rewards once, injected ledger failure rollback and retry, reciprocal-friend projection with no write or private fields.
- launcher_profile_shop_qa.js: PASS.
- launcher_character_economy_qa.js: PASS, including cross-day reservation and spendable reward.
- profile_shop_ownership_sql_qa.js: PASS.
- launcher_life_content_qa.js: PASS, 383868 assertions / 183 events / all 1024 owned subsets.
- git diff --check on four owned files: PASS (existing LF/CRLF normalization warning only).

Evidence: backend-review-qa.json contains every named check. Changes are limited to server/launcher-life.js, server/launcher-life-store.js, server/launcher-profile-shop.js, scripts/launcher_life_server_qa.js.

## Actual test environment and limits

The host reports postgresql-x64-18 running, but pg_isready at 127.0.0.1:5432 returned no response. No controlled PostgreSQL fixture or DB connector was available. No credentials/configurations were read and no database installed. Tests used the already installed PGlite package at D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite.

Concurrent service invocations are explicitly serialized by a fixture mutex around the single PGlite session; both admission orderings were exercised. This proves service transaction ordering, rollback, and idempotency behavior in that fixture, not real PostgreSQL multi-session row-lock behavior, deployment, UI rendering, or human play. Source review confirms every Life/shop/legacy wallet write takes the player_profiles row lock first. Production network and real PG contention remain unverified. The server cannot prove that a client rendered a clip; activity facts are ownership/context/time/cap validated and cannot mint coins.
