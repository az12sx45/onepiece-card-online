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

Android Java compilation passes against installed SDK/Godot APIs. Windows/Android candidate packaging and iOS cloud preparation are in progress; these are not published fourth-game binaries yet. Existing Card fixes separately published as package-6bc0eec0e075b17d, source 62f39a4de9eb535796b92c2daa3ac3fd742446d8, release 361e065d73f3fe66e632292060519135b6a6ff13. Public 31 programs/CAS and retained Board/Chess identities verified in CARD_SNIPER_MENU_PUBLIC_20261101.json.
