# Godot native Card desktop preparation

## Current scope confirmed by the owner

Keep the original Electron launcher design, account/login, downloads/updates and other game entries. The original Card start.html, room list, create/join/ready flows also stay unchanged. Only the actual match after room start switches to Godot; exiting restores the original lobby. Preserve original gameplay, media and data contracts. This corrected scope passed isolated native/server and Electron handoff tests and is being packaged as1.2.28; 1.2.27 opens the native lobby and does not yet meet it. This is not a migration of the launcher itself.

Windows 1.2.26 and Android native57 public release evidence is `D:/Codex_QA/card-native-online-release-20261029/release-complete.json`. The historical preparation limitations below were superseded where that receipt supplies actual evidence.

The owner then reported that Card Start appeared unresponsive. The actual installed game process had a hidden main window. `windowsHide=true` was appropriate for background helpers but wrong for this interactive Godot GUI. A/B using the same installed player PCK reproduced hidden on 1.2.26 and visible with the one-setting fix; the packaged 1.2.27 runner also passed. The currently open owner window was restored without changing installed files or account/save data. Original launcher UI files and game PCK are unchanged. Windows 1.2.27 public pointer and download page readback passed; evidence: `D:/Codex_QA/card-launch-fix-20261029`.

## Historical preparation snapshot (superseded by the receipts above)

## 2026-10-29 desktop native follow-up

The user explicitly includes the desktop launcher in the native Card migration. This work remains unpublished; phone connection was deferred by the user, so no additional phone prompt or device-test claim was made.

Formal launcher root rechecked: D:/Codex_Release_Worktrees/launcher-flick-reward-r12, branch codex/launcher-aquarium-management-r13, HEAD dca6367e9c95a9c86151f509d1fc00c0c0f44c4c. Existing dirty files retained. LATTICE APIs remain absent; no fabricated task or graph update.

- desktop/native-card-bridge.js: loopback-only per-process random-token RPC; credentials remain in memory, never command arguments/files. Reject browser Origin/Fetch-Site, invalid token, unknown methods, oversized body, traversals and stale account. Read original account/preferences and verified Card-only media via AssetStore.resolveAsset. A native refresh can acknowledge only the existing account/secret, not replace launcher credentials.
- desktop/native-card-runner.js: verify trusted installed bundle inventory, every file size/SHA, entry paths, absence of unlisted files and symlink escapes before launch. Production requires releaseAllowed; internal bundles only allowed in non-packaged explicit internal mode. Auth bridge lifetime is tied to child process, account logout and launcher exit. Missing installed native bundle leaves original web route; invalid bundle produces an error rather than executing it.
- desktop/main.js/package.json: source route, process close/logout/quit hooks, tray restoration and module packaging entries connected. No native runtime bundle was installed into the live launcher and no public installer/overlay was changed.
- runtime native_desktop_session.gd/native_desktop_assets.gd and Windows-only fallback in native_android_account.gd: bounded no-redirect HTTPRequest using the private launcher bridge. Card audio/video use the original verified blob cache. Android plugin and iOS overlay remain their platform adapters.
- scripts/native_card_bridge_qa.cjs + native-card-desktop-bridge-qa.gd: 17 checks; actual Godot native RPC, same-account refresh, replacement rejection, original movie 0 decoded from a SHA-named blob through the desktop bridge; session revocation; no credential in captured output. This is isolated fake-account testing, not the user's account or production launcher UI.
- scripts/native_card_runner_qa.cjs: 9 checks; absent/unapproved bundle, duplicate/path traversal/tampered/unlisted files rejected, failed spawn cleanup. Not a Windows exported-game test.
- Re-ran actual Godot GPU renderer at 1280x720/844x390 after adapter changes. QA evidence remains separate from desktop account/UI acceptance.

Remaining gates: Windows GodotJS template-release DLL/exported runtime bundle and verified installer packaging; complete native launch from the real Electron UI and account lifecycle; remaining full result-page parity; coordinated server deployment; Android/iPhone device tests and iOS Mac compilation. Current addon directory contains a Windows editor DLL only; do not call the editor-based QA execution a finished Windows export. Current latest internal Android v056-r3 predates this Windows adapter follow-up. Do not change its sealed generation or its receipt. No new APK/IPA or public release was created in this follow-up.

The previous cleanup rejection still applies to the listed old outputs. No deletion or move was retried. This follow-up retained bounded JSON evidence, a small original-movie cache fixture and runner validation fixture; no extra screen recording was created.
