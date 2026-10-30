# Card stable presentation release — 2026-10-31

User requests publication of completed changes and pauses the experimental enhanced perimeter/video projection. Publish stationary landed cards and foreground-hand stacking, and bring existing public character cut-ins to Android/iOS. Original launcher/lobby/account/rules/Board/Chess remain unchanged. Existing enhanced movie playback remains; none of android/preview, projection art or playOriginalEnhancementVideo hook is included in release bundles.

Desktop source: public/game.html cache token 20261031-card-stable1; public/js/card-desktop-table.js and public/css/card-desktop-table.css generated from shared android/web modules. Card stage anchors its landing rectangle and remains behind hand at resolve; modal-specific relocation/size overrides removed. card-anime-skills now uses the shared cardPhone scope so the same existing cut-ins work on mobile. Mobile source lists add the existing module and embed its existing GPT art without quality reduction.

Validation before desktop candidate: prepared Android bundle all-card suite 252 checks pass with no page errors; desktop presentation regression 30 checks pass. Earlier focused all20 card landing tests, layered-hand paint tests and original Law flow checks passed. Further package/readback/delta/cloud validation is recorded separately in the final publication receipt. These are browser/packaging checks, not physical-device or production-account acceptance.

Release tooling: scripts/build_card_program_update.js is the existing scoped Board builder adapted to Card identity, preserving all media and other catalog entries, requiring committed exact inputs and candidate verification before promotion. scripts/publish_card_program_blobs.js expects the verified public baseline package-3df07c30b9c7bcee and uploads only the three reviewed program blobs. No reset/stash/clean, credential export, unrelated game rebuild or global setting change.

Mobile target v059 retains original web Card entry and native Board. Android baseline game resources must be exact retained product bytes; all other launcher files are compared against public v058. iOS uses the existing public macos-26 unsigned pipeline with free-capacity guard, then the established unsigned IPA channel. Owner signing/install remains separate. LATTICE tools are unavailable; no live task persistence or graph claim.

Status: candidate preparation. A Git push alone is not publication proof. Final public runtime, manifest, program/blob hashes and mobile release-pointer readback will be appended after actual success.
