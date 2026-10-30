# Card anime skills — desktop published release, 2026-10-30

Resumed at user request. Final validation, preview and desktop public release completed. Launcher and lobby remain unchanged.

## Source and changes
- Formal desktop tree D:/Codex_Release_Worktrees/card-native-server-adapter-20261029, branch codex/card-native-server-adapter-20261029, HEAD 5505a7502aefcc2b370cbda65f0a317472681325. Preserve existing dirty changes.
- Shared editing tree C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html.
- New android/web/card-anime-skills.js and .css. Desktop-only module registered in android/build-card-desktop.mjs; not in mobile-sources. All 19 other card IDs (0,2..19) get a public-play-log driven character cut-in; Usopp retains existing target/digit cut-in. Skill titles read original CARD_TEXT base/enhTitle.
- card-phone-flow.js awaits optional intro after played card lands and before effects/commit. Includes busy/cancellation and suppresses duplicate play_fx for that intro. No rule/server/hidden-hand/network schema changes.
- New 19 GPT portraits android/web/art/card-anime-skill-{id}-v1.webp, total 4,008,842 bytes. Original resolution retained, WebP format conversion only. Exact prompts and generated source paths in card-anime-skills-v1-prompts.json. All 19 source portraits visually inspected. Existing GPT effect textures reused via CSS computed variable; no duplicate effect asset embeds.
- Built-in image_gen used, no external API key or CLI. Official character research: https://one-piece.com/character/ ; https://one-piece.com/character/killer/index.html ; https://one-piece.com/character/Queen/index.html . Animation tone is TV anime/cel close-ups.
- Desktop generated output public/js/card-desktop-table.js 263681 bytes and public/css/card-desktop-table.css 41680963 bytes. Launcher/lobby unchanged. game.html cache token advanced to 20261030-anime-skills1.

## Final validation and evidence
- Final rerun after cosmetic corrections: 252 checks PASS, zero page errors. All 19 original-engine public normal plays; all 19 enhanced titles; text fitting, full-resolution art, serialized state, input lock, silent/private exclusions and cancellation. Enhanced-title fixtures do not certify every original enhanced movie.
- Desktop regression 30 PASS; mobile optional-API regression 60 PASS; original Law preview/swap integration 16 PASS; action sequence 32 PASS (Kid discard/shuffle, Sabo return/shuffle/deal, duel and coin, disconnect); new full handoff 16 PASS (Robin read/close, Sanji duel/retained hand/loser reveal, normal Roger self-out/next starter, enhanced Roger prediction). Total final reruns: 406 checks.
- Earlier actual local npm start with two Socket.IO browser guests: 8 checks PASS; sync.json. This evidence is local, not production accounts or physical devices. No installed-launcher or mobile-package acceptance claim.
- QA: C:/Codex_QA/card-all-anime-skills-20261030. Reports and editable source hashes: CARD_ANIME_SKILLS_SOURCE_RECEIPT_20261030.json. New harness android/card-anime-handoff-qa.mjs; action sequence QA root corrected to the verified formal tree.
- Final all 19 screenshot contact sheet inspected, with Zoro/Law/Roger individually inspected at full size. No text clipping observed. Repeating effect motifs reduced to one (two for slash/scythe), unrelated Shanks/Roger ring removed.
- Review: C:/Codex_QA/card-all-anime-skills-20261030/review.html and all-card-intros.webm. Video is a reset-per-card intro montage, not a full continuous match.
- LATTICE runtime/task APIs absent from available catalog. Historical card task e4368cf0177acd6ead577d369a181d11b6d4ff30c66fb681fe4ff60e8b5b663e / project fc1f1991-a190-4cd1-8933-947297d0ebbe retained from local games.json. No live persistence/graph success claim.

## Publication boundary
- Formal desktop program release only: game.html, css/card-desktop-table.css, js/card-desktop-table.js. Existing media records, start.html, launcher, server rules, Board and Chess stay identical to baseline.
- Existing scoped publisher expected baseline updated from stale package-e5993ea96ed10518 to verified public package-7daa8b67809be979. It rejects other catalog/media/program changes and reads back uploaded SHA-256 bytes.
- Build from committed source, promote reviewed external candidate, upload immutable blobs, then publish catalog by normal Git push. Public runtime/catalog/manifest/blob readback is required before claiming release.
- Mobile module registration/Android/iOS packaging not included. Mobile regression only validates compatibility of the shared optional flow hook.

## Public release verified
- package-3df07c30b9c7bcee; source bc413bcc9f26b401bf288d276d6dc795ec502661; release commit b8e914904e13c48ae9c086bb1a9ae7ecc77ad5dd.
- Public readback 2026-10-30T12:09:58.824Z: catalog identities, Card/Board/Chess manifests and runtime API, all31 Card program bytes, three updated CAS hashes/sizes and game-origin CORS, new HTML cache token match. Details: CARD_ANIME_SKILLS_RELEASE_20261030.json.
- Uploaded3 immutable blobs,42,171,604 bytes. Retained1,054 existing media records and all non-reviewed program records.
- The publisher dependency was absent; installed the existing pinned package-lock in C:/Codex_QA/card-anime-publisher-deps-20261030 with npm ci --ignore-scripts, supplied only through child-process NODE_PATH. No global environment/dependency edits.
- Documentation-only receipt commit uses [skip render] to avoid another service deploy, per https://render.com/docs/deploys#skipping-an-auto-deploy .
