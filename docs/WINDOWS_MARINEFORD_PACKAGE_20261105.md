# Windows Marineford independent package

The 1.2.33 core uses the existing AssetStore installer, receipt, integrity repair,
uninstaller, HTTPS program runtime and media cache for Marineford. It reads the
separate schema-1 `/desktop/marineford-release-v1.json` reference. The schema-3
catalog stays limited to card, board and chess; Marineford is merged only into
the in-memory view after its reference and manifest have been validated.

`desktop/marineford-release.js` is shared with the server package publisher.
It fixes the entry to `marineford/index.html`, the CAS origin to
`https://game-assets.rihdi.tw/desktop/blobs/sha256`, and the six mandatory program
paths. AssetStore checks the manifest SHA, totals, allowed paths and downgrade
rules before adopting a reference. A cached reference or installed receipt can
restore the validated identity when metadata is unavailable.

The former media-only receipt is retained until the full package has installed.
Its CAS blobs are reused and protected during migration; a failure keeps the
previous receipt. Installed Marineford supports the same repair and removal
flows as the original three games, including shared-blob protection. Download,
repair and removal are rejected while its game window is open or launching.

An update keeps the installed receipt until every new blob has passed SHA
verification. A failed or interrupted B download therefore retains playable A.
The existing shell exposes its normal "啟動現有版本" action beside the B update.
Marineford requests the runtime proof with A's installed `releaseId` and
`manifestSha256`; the server must explicitly approve that exact current or
compatible previous identity. An unlisted identity, wrong SHA or unavailable
proof still blocks launch. Previous-version authorization never changes the
latest reference or permits an installation downgrade. A later B retry uses
the same core and fetches only changed hashes.

Launching retains the official HTTPS URL. Only an exact server runtime proof
enables the installed program; a missing or mismatched proof rejects launch and
requests a metadata refresh. Approved program and media requests use verified
CAS bytes. Account, API and Socket.IO traffic retain the network route.

Marineford static requests fail locally if the installed route or blob is
unavailable. Both HTTPS programme/media handling and opcache media redirects
recheck installed integrity through AssetStore, then return a local error and
repair state for corruption. Unknown new programme/media paths do not fall back
to Render. The original three games retain their existing fallback policy.
Marineford's game frame also rejects cross-origin HTTP(S), including hashed R2
blob URLs. Native updater requests use their separate download session; the
official-origin API/auth/Socket.IO paths and external navigation keep their
existing policies.

The shared policy fixes programme paths to the six files above. Media may be
added within `marineford/art`, `marineford/audio`, `marineford/video` or
`marineford/videos`, and `marineford/fonts`, with matching kind, extension and
MIME. The existing avatar 1–222 and launcher cover v1/v2 WebP paths are also
allowed. Each asset is limited to 32 MiB; the combined non-image audio, video
and font budget is 64 MiB. These new media rows use the same installer and local
runtime without another core change.

## Validation

`node scripts/desktop_marineford_local_media_qa.js` covers cold/warm installation,
one-file delta, interrupted update, missing and same-size corruption, migration,
proof authorization, active-game guards and uninstall sharing. The original
AssetStore, program-runtime and runtime-asset-cache suites are also required.

`node scripts/desktop_marineford_media_qa.js` uses generated tiny WAV, MP4, WebM
and WOFF fixtures. It verifies full SHA, MIME, HEAD and Range reads; fixed paths,
namespace and size budgets; unknown JS, missing and corrupted local failure;
and separate API/Socket.IO network traffic. Current production Marineford uses
images, generated WebAudio and system fonts. These tiny files exercise
forward-compatible file-media handling.

The isolated Electron harness and reports are in
`D:/Codex_QA/marineford-game-package-windows-20261105`. Its real 375-row fixture is
pinned to server source `2439d54ae04d3e1641bfc836bc7ef9c39391c7c2`, release
`package-31f58689df2388e0`, manifest SHA
`daa7ae76d2eb150ecd127a603bd2e7f402133f2d47ccef23d9b819f8d8417182`.
It verifies every installed blob and actual launcher-to-game HTTPS entry, using
controlled metadata/proof, account and Socket.IO fixtures. These tests establish
local client behavior; public activation and physical-player acceptance are
separate release evidence.

The retained-version actual Electron scenario additionally exercises the normal
existing-version button after SHA-failed and interrupted B updates, an exact
one-blob game-only B upgrade with unchanged core/app path, zero static Render
fallback, post-install same-size image damage and missing programme data, and
normal UI repair of exactly two blobs. See
`electron-retained-game-only-upgrade-compat6.json` in the same QA directory.
This final run uses the actual server compatibility handler at the isolated
19759 fixture, with published A and CSS-only B
`package-17e7105b7f5b5c55` / manifest SHA
`f8fde2190c34db8bb38500637310082261c65704f27e4b1010e70b8d1972f8f6`.
It also confirms the game frame rejects a cross-origin extensionless R2 blob
request without a network fallback.

Installer artifacts and provenance are staged under the dedicated
`C:/Codex_BuildCache/marineford-windows-package-1.2.33-20261105` directory. The
build reuses only resources whose bytes match committed source, keeps the
existing app identity and update-signing key, and does not activate a channel.
