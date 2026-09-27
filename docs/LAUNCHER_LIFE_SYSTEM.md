# 角色生活基地 1.2.1

## Authority and compatibility

The launcher extends the existing profile, shop, room and four-direction whole-body walker. Board/Card/Chess gameplay state and Socket.IO game contracts are unchanged. Formal source is `D:\Codex_Release_Worktrees\board-voyage-records-v1`; implementation/QA is isolated in `C:\Codex_Candidates\launcher-character-life-1.2.0` until exact reviewed changes are selectively delivered.

Ownership remains `launcherOwnedV1.items` in the server profile. Only owned **and placed** characters appear, work or enter events. Room capacity is ten with `capacityVersion:2`; older eight-character clients cannot silently truncate a larger room. Character IDs and furniture IDs are unchanged. New furniture `room-furniture-galley-stove` costs 80 existing shop coins and is never granted for free.

## Modules

| Module | Responsibility |
| --- | --- |
| `desktop/launcher-life-data.js` | Ten personalities, nine work areas, 45 pair relationships, directives, schedules, original and existing event definitions, player lines and action requirements |
| `desktop/launcher-life.js` | Eleven life states, weighted decisions, bounded memories, tasks, exclusive interaction points, dialogue/event cooldowns, arrival queues and presentation lifecycle |
| `desktop/launcher-life-room.js` | Existing BFS/geometry/whole-body rendering adapter, server command queue, owner epoch checks, compact controls and visibility/editor resume |
| `desktop/launcher-life-actions.js` | Explicit supported actor/action combinations; decode and dimension gate before an authored loop can start |
| `server/launcher-life.js` | Canonical state, ownership, bounded offline aggregation and station validity |
| `server/launcher-life-store.js` | Profile-first row locks, command idempotency, wallet receipts, work, gifts, activity results, arrivals and visitor projection |

## Simulation and performance

The 11 states are Idle, Wander, Work, Eat, Rest, Sleep, Train, Socialize, UseFurniture, SpecialAction and EventParticipant. Existing distance-driven walking remains intact. Life decisions run on a slower cadence than drawing. Work has a real route, reserved destination, whole-body turn, visual docking, decoded preparation/operation/finish loops, brief breaks, server result and undocking back to autonomous activity. Static expressions do not satisfy work animation requirements.

Energy, hunger, mood, social satisfaction and work motivation are gentle preferences with bounded values; neglect never kills a character or removes purchases. Local time changes weights for morning/day/evening/night without making content permanently unavailable to a player. Six directives adjust the day's priorities. Memories are capped at 16 per actor and decay rather than growing indefinitely.

Only one foreground event runs at a time. Shared policy controls spacing, pair cooldown and rare event intervals; each event also keeps its own longer cooldown and recent-line history. Required participants must be owned, present, available and reachable. Optional participants use authored branches; absent characters are never instantiated. Station events and paid work compete for the same reservation. Other actors continue their own activities.

## Work and economy

Nine areas cover kitchen, navigation, training, workshop, medical supplies, library, helm, deck and music. All characters can perform suitable general tasks with different efficiency. Specialists use separately authored cooking, page-turning, repairs, medical inventory, steering and piano loops at the corresponding placed furniture. A dining table cannot act as a stove. Free floor work/training uses visible handheld supplies or training movements, without inventing furniture.

The existing wallet cap is 500. A completed paid job earns 10 coins; daily limits are shared with the older companion workflow (six starts/claims total, two starts per character). The base duration is five minutes adjusted by server-owned efficiency. Gifts cost five coins and have server cooldowns/limits. The client never submits balances, raw need changes, reward amounts or affinity deltas. A unique job ledger and request ID/payload hash prevent duplicate payouts and duplicate gift charges.

`LAUNCHER_LIFE_GET` and `LAUNCHER_LIFE_COMMAND` use the existing authenticated bridge. Commands include `work.reserve/activate/complete/cancel`, `directive.set`, `character.interact`, `event.record`, `activity.record`, `arrival.ack` and `checkpoint`. The server validates ownership, placement, station identity, revisions, cooldowns and timing. Offline processing is one bounded aggregate (maximum eight hours), not a background AI loop. Only already activated work can settle offline; reservations do not generate money.

## Purchases, friends and UI

A character purchase deducts the normal shop wallet, records ownership, safely appends the actor to the room and queues a persistent arrival in one transaction. Existing purchases are treated as already arrived. New actors are hidden until their entry walk starts, walk from a reachable room edge, greet and acknowledge their arrival once. Reloading after acknowledgement does not replay it.

The existing small companion card retains Talk and affinity, and adds Work, Call, Gift, Train and Status. Repeated clicks use personality-specific responses with cooldown. Call walks toward a reachable front area; gift uses the eating loop; training uses its real sequence. Editing or hiding the room suspends presentation and releases leases; returning preserves position and rebinds tasks. Late responses from another account or viewed owner cannot update the current room or wallet.

Friends retain profile cards, game records, collections, BGM and guestbook visits. Life projection exposes only public ownership/presence/needs/directive information. Visitors may observe autonomous presentation but cannot spend coins, assign work, claim rewards or aggregate the owner's offline state.

## Art and verification

Life adds 128 four-frame 512×128 atlases (512 whole-body drawings) plus five stove images. Frame cells are 128×128 with a shared `(64,112)` ground root. All new drawings use the built-in GPT image tool; source, prompts, accepted/rejected versions, crop plans and receipts are retained in `tools/launcher-room/life-v1`. Packing crops complete figures with uniform scale; it does not construct limbs, separate heads, mirror asymmetric faces or deform anatomy.

The existing 1.1.15 walking/acting and 1.1.16 room/background proof remains immutable. A separate 1.2.0 manifest binds new art, source ancestry, actual room screenshots and normalized runtime SHA. Historical source checks are not rewritten to appear current. Package QA checks both retained assets and the complete new set, plus protocol decoding and the installed runtime.

Local test tools distinguish PGlite SQL fixtures, virtual-clock controller tests and real Chromium rendering with a simulated server. These do not constitute human play, a real-account purchase or production PostgreSQL multi-session testing. Deployment acceptance additionally requires signed public manifest and full installer SHA readback; build success alone is insufficient.

LATTICE APIs were unavailable in this session. The formal project identity was read from its existing project configuration; this work does not claim a new persisted task, graph analysis or database acceptance in LATTICE.

## Initial 1.2.0 artifact and evidence

- Version: `1.2.0`, Windows x64 installer, `244419451` bytes.
- Installer SHA-256: `453cb33058897c5661ec2f5b8ab5e565866e9a0ed134a61a9d280f10cbcbba6b`.
- Immutable installer: https://game-assets.rihdi.tw/desktop/launcher/releases/1.2.0/ONE-PIECE-Tabletop-Launcher-1.2.0-x64.exe
- Package source gate and byte-for-byte ASAR application/resource comparison passed: 252 ASAR entries, 569 launcher resources. Actual Electron44.1.1 decoded 468 tested media, zero failures; audio playback also passed.
- Independent public HEAD200, Range206 and complete GET200 passed; downloaded file length, streaming SHA and reopened disk SHA match the local artifact.
- Updated legacy room editor/ownership regression:78 pass. Existing profile/shop Chromium regression:97 pass. These use actual art and isolated fixture accounts.
- Actual Electron/preload to isolated IPC/AuthService/Socket.IO bridge:90 pass, including all ten Life command types, ten-character saving, four stove rotations and purchase. Socket.IO event gate:135 pass. `npm start` on isolated31931 served `/board_start.html` and `/download` with HTTP200, then stopped. No DATABASE_URL was set. The bridge-only run is not the separate full-game renderer test; that historical attempt stopped on missing sparse-checkout vendor files and is not counted as passed.
- Release and formal synchronization records are retained under `C:/Codex_Candidates/launcher-life-qa-1.2.0/delivery`; runtime/contact/content evidence is additionally committed under `tools/launcher-room/life-v1/review-evidence`.
- At this artifact-recording step, the signed manifest is prepared and the installer is public; canonical Render activation and formal source synchronization still require their separate readback reports. Later deployment evidence is recorded below when verified.

## Daily directive correction in 1.2.1

Final UI inspection found that changing the daily directive called `renderUi()` before reading the select value; rendering restored the acknowledged old value. The handler now captures the selected value first. The external IPC payload remains `directiveId`, while the internal controller uses `directive`. All six actual selector choices, acknowledgement, refresh persistence and friend read-only behavior passed19 checks. The earlier browser fixture's invalid `free` directive was also corrected to `free_day`.

Because the 1.2.0 installer was already uploaded to an immutable URL, this correction is shipped as 1.2.1. The 128-atlas art generation remains1.2.0 with an updated review binding for the single corrected UI handler. Its separate formal runtime variant records only the already-present Board allowlist difference in `server/desktop-distribution.js`, with exact source/patch/readback hashes; no arbitrary variant is permitted. Actual artifact and deployment readback are recorded below after completion.

1.2.1 artifact:244419418bytes, SHA-256 `39b0ec460157384c57e542292c3efa103e9b0f937c6a3352a6ce27ba05a9ca71`. Package/ASAR byte comparison and actual Electron468 media checks passed. Immutable public installer HEAD200/Range206/fullGET200 and independent disk SHA match. URL: https://game-assets.rihdi.tw/desktop/launcher/releases/1.2.1/ONE-PIECE-Tabletop-Launcher-1.2.1-x64.exe . The source variant validator passed21 positive/negative isolated cases. Canonical1.2.0 was observed at2026-09-27T04:35:24.161129+00:00; the corrected1.2.1 canonical release is separately awaited and must not be inferred from the previous deployment.

## Verified 1.2.1 deployment

已完成1.2.1部署：main `2c3bc409e9ee264df7ac46f789da6c770933c0c7`，公開canonical清單於 `2026-09-27T04:45:20.341208+00:00` 回傳1.2.1，與提交逐byte一致且Ed25519驗簽通過。安裝檔244419418bytes、SHA256 `39b0ec460157384c57e542292c3efa103e9b0f937c6a3352a6ce27ba05a9ca71`，公開完整下載重算一致。正式D先同步1.2.0共700檔，再安全套用1.2.1共31檔；後者保護10897個既有檔案，所有原素材與不相關遊戲變更保留。證據：`C:/Codex_Candidates/launcher-life-qa-1.2.0/delivery-1.2.1/DELIVERY.json`。驗證含真Electron468素材、19方針UI檢查及公開發行／下載頁／Socket檢查；無真帳號購買或PostgreSQL多session驗收。
