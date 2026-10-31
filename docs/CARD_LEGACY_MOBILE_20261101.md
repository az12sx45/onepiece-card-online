# Card Android download integrity and legacy iOS presentation — 2026-11-01

## Observed failures
Android V2105 device attached by the owner, installed versionCode 59 / 0.1.59-card-animation. Card resume immediately fails. Download Manager displays: 素材回應超過指定範圍. Device /data has about 118 GiB available; no storage clearing, account/save access or reinstall performed.

Public CAS audit: 881 distinct Card objects returned no persistent missing asset. One transient image fetch succeeded on retry. Three document HEAD responses omit content-length, which is legal by itself; GET bytes reveal the actual failure. result.html expected 133788 / received 134551 bytes, shop.html 83099 / 83481, tutorial.html 229940 / 230274. All three digests fail and contain injected /cdn-cgi/.../rocket-loader.min.js. Android correctly refuses changed bytes. Prior release checks covered new CAS objects only and missed these retained legacy document objects.

iOS symptom reported: original video only, no projection or diagonal cut-in. Archived v058 native bundle (iOS Git commit 3755054) has no presentCardSkillBatch call in its installed flow. Current v059 WebKit presentation test passes, but exact v058 Chromium regression never shows projection. Initial v058 WebKit run crashed while navigating and is not a successful reproduction. After compatibility fix, exact v058 WebKit passes 11 checks including projection, movie/selection/cut-in sequencing, fallback and cancellation. Physical iPhone version has not been read; do not assert the owner's installed version from this regression alone.

## Narrow changes
- Reserve Card's online flow before native DOMContentLoaded mounting, then mount one current shared queue. Installed v058/v059 old queues see the reservation and skip; generated current desktop flow or online module owns it once. Existing action, private-read, outcome, venue and all-viewer barriers remain.
- public/game.html embeds the same shared card-phone-flow.js; presentationFlowVersion=2 is observable for QA. No native launcher/lobby/entry change or rule/state/protocol change.
- result.html/shop.html/tutorial.html retain original bytes and receive a non-executable transport-revision comment. This creates new immutable CAS keys; existing publisher already emits document downloads as application/octet-stream with no-transform. Old objects are not overwritten, CDN security is not disabled, and no size/hash verification is weakened.
- Scoped publisher reviews six known program paths against package-1372e8179169b0a2. The stylesheet remains unchanged; five program files actually change. Board/Chess manifests and 1054 media entries remain exact.
- Files: public/game.html, js/card-desktop-table.js, result.html, shop.html, tutorial.html; scripts/publish_card_program_blobs.js; shared android/web/card-phone-flow.js; android/card-mobile-effects-qa.mjs real-WebKit option; scripts/card_group_ready_browser_qa.mjs configurable exact iOS bundle.

## Verification
- Existing iOS v058 engine fixture: baseline projection failure; fixed WebKit 26.5 passes all 11 checks. Uses Windows WebKit, not a physical iPhone.
- Existing v059 iOS bundle: isolated current fixture passes 11 checks. A first concurrent run timed out during initialization; no page errors were recorded, and the isolated rerun passed without code changes. That failed run remains in QA evidence and is not counted as passing.
- Actual npm start and two Chromium windows: 8 checks pass, including join/start/state gating, refresh identity, private hands.
- Legacy iOS/Android/desktop six-seat group test and public/native download proof appended after completion.
- LATTICE APIs unavailable; games.json consulted, no task/graph persistence claimed.

## Retention
QA root D:/Codex_QA/card-native-update-diagnosis-20261101. Browser engine downloaded from Playwright's official CDN into this D: QA root. No broad cache cleanup or credentials exported. Temporary phone screenshots overwrite one task file; game source, signed packages and player data are preserved.


Six-seat regression: 16 checks PASS with desktop, exact Android v059 JS and archived iOS v058 JS plus three CPUs. For this state/barrier suite only, data-URI artwork in shared/native CSS is replaced with none to avoid exhausting this workstation; layout CSS and all game/client/server logic are unchanged. This is not artwork-rendering proof: full-art v058 WebKit and v059 Chromium runs separately passed above. The first full-art three-client run stalled during third-client initialization and was terminated, not counted as passing.
