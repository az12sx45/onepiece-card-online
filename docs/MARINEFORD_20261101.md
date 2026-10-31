# 頂上戰爭篇獨立遊戲

2026-11-01。Authority: card-native-server-adapter-20261029. New game id `marineford`, independent MF_* protocol and engine. Original Card/Board/Chess state and catalogs remain unchanged. LATTICE tools unavailable this session; no task persistence or repository graph claim.

## Rules and source

User materials: D:/onepiece偉大航道爭奪戰/頂上戰爭篇, final DOCX and 29 printed cards. Originals untouched, per-file source SHA in MARINEFORD_ASSET_SOURCES_20261101.json. Official reference https://cdn.svc.asmodee.net/production-zman/uploads/2024/09/Infinity-Gauntlet-Rulebook.pdf and https://www.gokids.com.tw/product/detail1039.

2–6 seats, one Navy, other pirates; Navy starts then clockwise, Navy keeps two cards and pirates one. Faction HP follows the user's table. Navy rank 4 grants THREE morale as printed, not the original Marvel quantity. Morale defaults OPTIONAL according to the user's document; pending preference has not been answered. Six Justice cards collected in hand and played count together, resolved on Navy's turn only after the current effect completes; this follows official collection semantics where the user's text says collect six, rather than adding an all-six-played restriction. Equal combat keeps both private cards. Defeated Justice/Sengoku: replacement draw before recycling. Navy reviews the faceup pirate cards before replenishing the empty pirate deck.

## Implementation

- server/marineford-engine.js: clone-on-action validation, private views, explicit pending choices, chained jobs, CPU using only visible information.
- server/marineford-rooms.js: existing SOCIAL_AUTH identity, authoritative commands and revision checks, room/create/join/ready/CPU/start/action/reconnect. All connected viewers acknowledge presentation before any following human/CPU action. A 45-second lost-client recovery sends the authoritative view; manual read/selection remains an explicit pending choice.
- public/marineford/index.html, marineford.js, marineford.css, cards.json, art/: full-screen desktop/landscape UI, public piles/library, private reads, battle slot order, morale choices, generated field/button/cover. No speculative Card projection module injected into the new game.
- Desktop main/renderer, Android MainActivity/mobile-bridge, iOS ios_host.gd/po_ios_web_game.h add an independent online entry. Fourth game does not enter catalog-v3 because already-installed clients validate exactly three keys. Existing three entries remain unchanged.
- Media uses independent desktop/marineford-media-v1.json and SHA-addressed immutable public objects; scripts/marineford_media.js validates committed source before upload.

## Validation and limits

marineford_engine_qa.js: 1,500 seeded CPU matches, 2–6 seats, 29-card conservation, each printed effect, hidden hand boundaries, health, illegal actions, Justice victory, last pirate draw, and draw-before-recycle pass. This is not a balance or player acceptance claim.

marineford_browser_qa.cjs: six isolated real Socket.IO browser clients, injected QA identities only; full match, private views, invalid turn rejection, slow viewer gate, actual touch clicks for ten pending choices, and visible read confirmation on 740x360. WebKit opens lobby/table with decoded card art. No production credentials or physical iPhone claim. Reports under D:/Codex_QA/card-sniper-menu-20261101/marineford.

## Released clients and real checks

Windows 1.2.30, Android v060 and unsigned iOS v060 update channels are published and exact public pointers/artifact hashes read back in MARINEFORD_RELEASE_CHANNELS_20261101.json. Windows packaged launcher shows four entries, no broken art, and selecting Marineford gives the correct launch action. Android v060 installed with adb install -r; existing account retained and app data not cleared. Physical V2105 tested new entry, authenticated room creation, adding CPU, choosing Navy, CPU actions, draw/play, ally choice, blind hand selection, private read confirmation and subsequent CPU turn. Existing saves were not individually loaded for gameplay acceptance.

Android APK 477442003 bytes; SHA f4f44fbcec4d17f09baed30345a32ef285115486e72c7b452cc43c1628bac5a6. v059 delta 42141943 bytes, 91.1734 percent less download. Production updater plus explicit JVM Android stand-ins passed 20 real HTTPS checks, zero full APK requests; reconstructed signed APK verified. This does not claim a physical on-device updater test.

iOS GitHub source ec09dc87c4b50303d266ffee9ae950fb2598b579 / run 41243640177 succeeded on the existing free public macOS runner and conservative artifact-cap guard. IPA 433391435 bytes; SHA 3999b5d4b13ae4f254894bc5cf692e40f855106209678aea49bc4c45ff79e73b. Verified 1536 bundled launcher files; 1533 existing launcher files unchanged, only launcher.js/mobile-bridge.js changed and one new cover added. Native Board/Card source and raw runtime retained. Owner iloader signing/install and physical iPhone acceptance remain required; no Apple credentials used in cloud.

Physical Android revealed slow first-use images could momentarily leave an empty hand and private-read card bottoms could be clipped by the footer. Fixed explicit card dimensions, owner-only loading labels, and read/review flex layout within the actual remaining height. The final 49-check browser suite passes cold-card placeholders, full image fit, ten actual choices, six-client whole match, slow-viewer gate and WebKit. These final game-only UI files use the online route; no further APK/IPA rebuild is required. Final public-byte receipt is refreshed after rollout.

Original Card fixes independently published as package-6bc0eec0e075b17d; retained Board/Chess catalog identities verified. Existing Card npm-start two-window regression passes eight checks. Evidence root D:/Codex_QA/marineford-launcher-20261101.

2026-11-01: Added host-only confirmed close of a Marineford match (no winner/reward), clearing timers and returning all viewers to the lobby, so a test or interrupted match does not trap players. Guest rejection, confirmation before mutation, all-six-client closure and stale-health cleanup covered. Original game protocols unchanged.

Final public rollout verified at 10/31/2026 22:10:10: 42 public program/media checks against ba2bdd408dd91258b6ce34be1b765e808439a3ba pass, including cold-hand placeholder, full read/review image fit and confirmed host close. No further client binary rebuild required. Exact delivery scope in MARINEFORD_DELIVERY_20261101.json.
