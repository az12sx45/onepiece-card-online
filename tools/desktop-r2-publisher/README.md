# Desktop R2 publisher

This tool supports both the legacy media-only `public/desktop/catalog-v2.json`
and the program-inclusive `public/desktop/catalog-v3.json`. It verifies every
source byte against its declared size and SHA-256, then deduplicates uploads by
content hash. The large Chess media tree remains outside Git and must be
supplied through the reviewed release package's `public/assets` directory.

The default command is a local-only dry run. It performs no network requests:

New `document` blobs are uploaded as `application/octet-stream` with
`public, max-age=31536000, immutable, no-transform`. They are byte-addressed
downloads; the launcher uses the unchanged manifest MIME (for example
`text/html`) when serving verified content locally. Existing documents may
retain the exact legacy MIME/immutable-cache profile. Neither profile permits
overwriting an existing key, and mixed or unknown metadata is rejected. This
policy does not repair already cached HTML transforms: a new Board release
uses new document hashes and verifies every public GET before switching its
catalog. Other asset kinds retain their original upload metadata.

```powershell
node tools/desktop-r2-publisher/publish.js
```

The command above intentionally keeps the legacy v2 flow as its default. Build
and verify the three v3 package manifests after all game-program changes have
been committed:

```powershell
node scripts/build_desktop_program_catalog.js
node scripts/desktop_program_catalog_qa.js
```

Then run a local-only v3 publish verification. For v3, every repository-backed
file is read from Git `HEAD`, never from a dirty working tree:

```powershell
node tools/desktop-r2-publisher/publish.js --catalog-version 3 `
  --chess-source "D:\航海王西洋棋\GRAND-LINE-BATTLE-多人發布版-v1\public\assets"
```

To verify or publish only Chess media, pass its exact reviewed source root:

```powershell
node tools/desktop-r2-publisher/publish.js --catalog-version 3 --game chess `
  --chess-source "D:\航海王西洋棋\GRAND-LINE-BATTLE-多人發布版-v1\public\assets"
```

For a real upload, install this tool's isolated dependency and provide R2
credentials only through the current process environment:

```powershell
Set-Location tools/desktop-r2-publisher
npm install
$env:R2_ACCOUNT_ID = "..."
$env:R2_BUCKET = "..."
$env:R2_ACCESS_KEY_ID = "..."
$env:R2_SECRET_ACCESS_KEY = "..."
node publish.js --live --catalog-version 3 `
  --chess-source "D:\航海王西洋棋\GRAND-LINE-BATTLE-多人發布版-v1\public\assets"
```

Credentials are never written by the publisher. Live mode only sends
`HeadObject` and conditional `PutObject` requests. It never deletes an object,
and it refuses to overwrite an existing object whose size, MIME type, cache
policy, or `sha256` metadata differs.

On the publishing Windows computer, credentials can instead be captured from
the clipboard and protected with the current user's Windows DPAPI key:

```powershell
.\save-r2-credential.ps1 -Field AccessKeyId
.\save-r2-credential.ps1 -Field SecretAccessKey
.\publish-saved-r2.ps1 -CatalogVersion 3 `
  -ChessSource "D:\航海王西洋棋\GRAND-LINE-BATTLE-多人發布版-v1\public\assets"
```

The encrypted document lives outside the repository under the current user's
Local AppData folder. Plaintext credentials are cleared from the process and
clipboard, are never committed, and can only be decrypted by the same Windows
user on the same computer.

Published object keys use this immutable layout:

```text
desktop/blobs/sha256/<first-two-hex>/<64-character-sha256>
```

The v3 package/publisher fixture checks are independent and make no network
requests:

```powershell
node scripts/desktop_program_catalog_qa.js
node scripts/desktop_r2_program_publish_qa.js
```

## Launcher installer releases

`publish-launcher-artifact.js` publishes one reviewed Windows launcher installer
without changing `public/desktop/launcher-release-v1.json`. The installer must:

- be an explicit absolute path to a regular, non-link `.exe` file;
- contain valid `MZ` and `PE` signatures;
- use a valid semantic version and the canonical file name
  `ONE-PIECE-Tabletop-Launcher-<version>-x64.exe`;
- have a byte count from 1 through JavaScript's maximum safe integer
  (`9007199254740991`); there is no fixed 256 MiB release ceiling. The
  publisher currently reads the full installer into a Node.js `Buffer` before
  upload, so actual file size is limited by available process memory and the
  runtime's `Buffer` limit. Live publishing requires the exact reviewed
  SHA-256 and byte count. Verify larger installers on the publishing host.

First run a local-only dry run. It never initializes the R2 client and prints the
exact `artifact` object that can later be placed in the launcher release manifest:

```powershell
npm run launcher:dry-run -- --file "D:\OnePieceDesktopBuilds\ONE-PIECE-Tabletop-Launcher-1.1.3-x64.exe" --version 1.1.3 --json
```

Review and retain the reported `artifact.sha256` and `artifact.bytes`. A live run
requires both values, so choosing a different or modified installer fails before
any network request. The DPAPI wrapper loads the already saved bucket credentials
only into the child process environment:

```powershell
.\publish-saved-launcher.ps1 `
  -FilePath "D:\OnePieceDesktopBuilds\ONE-PIECE-Tabletop-Launcher-1.1.3-x64.exe" `
  -Version 1.1.3 `
  -ExpectedSha256 "<64-character SHA-256 from dry run>" `
  -ExpectedBytes <byte count from dry run> `
  -Json
```

Launcher releases use this immutable key layout and public URL:

```text
desktop/launcher/releases/<version>/<filename>
https://game-assets.rihdi.tw/desktop/launcher/releases/<version>/<filename>
```

For launchers that support block reuse, publish electron-builder's matching
`<filename>.blockmap` beside the EXE. The blockmap publisher first checks the
reviewed EXE bytes/SHA, gzip format, block count, and block-size sum. Both
objects remain immutable; a blockmap never replaces the signed full-installer
SHA as the update trust root. Dry run and live publishing use the same exact
paths and reviewed values:

```powershell
node tools/desktop-r2-publisher/publish-launcher-blockmap.js `
  --installer "D:\review\ONE-PIECE-Tabletop-Launcher-1.2.23-x64.exe" `
  --blockmap "D:\review\ONE-PIECE-Tabletop-Launcher-1.2.23-x64.exe.blockmap" `
  --version 1.2.23 --json

.\tools\desktop-r2-publisher\publish-saved-launcher.ps1 `
  -FilePath "D:\review\ONE-PIECE-Tabletop-Launcher-1.2.23-x64.exe" `
  -Version 1.2.23 -ExpectedSha256 "<reviewed EXE SHA-256>" `
  -ExpectedBytes <reviewed EXE bytes> `
  -BlockmapPath "D:\review\ONE-PIECE-Tabletop-Launcher-1.2.23-x64.exe.blockmap" `
  -ExpectedBlockmapSha256 "<reviewed blockmap SHA-256>" `
  -ExpectedBlockmapBytes <reviewed blockmap bytes> -Json
```

Live mode performs `HeadObject`, then a conditional `PutObject` with
`IfNoneMatch: *`, followed by another `HeadObject`. It stores `sha256` and
`version` object metadata plus `Cache-Control: public, max-age=31536000,
immutable`. An exact existing object is skipped. Any size, SHA-256, version,
content-type, or cache-policy difference aborts; there is no delete or overwrite
path.

Run the independent publisher checks with:

```powershell
npm run test:launcher
```

## Offline launcher manifest signing

Launcher release manifests use an independent Ed25519 signature. The signing
private key is not stored in this repository or uploaded to R2. Initialize it
once on the offline Windows publishing account:

```powershell
node tools/desktop-r2-publisher/initialize-launcher-signing-key.js --json
```

The command creates (or safely reports) this current-user DPAPI document:

```text
%LOCALAPPDATA%\ONEPIECE-Tabletop\publisher\launcher-signing-key.json
```

It prints only the public SPKI key, its derived `keyId`, and the store path. The
private PKCS8 bytes are protected directly with Windows `ProtectedData` using
`CurrentUser` scope and stored as canonical base64 ciphertext. The command never
prints the private key and refuses to overwrite an existing store. The
`keyId` format is `launcher-ed25519-` followed by the first 32 hexadecimal
characters of the SHA-256 fingerprint of the public SPKI DER bytes. Add the
reported `keyId` and public SPKI base64 to the launcher's reviewed production
trusted-key table; never copy `privateKeyPkcs8Protected` into the repository.

Do not delete or regenerate this production key after distributing a launcher
that trusts it. DPAPI is tied to this Windows user profile; copying only the
encrypted JSON to another computer or a fresh Windows account is not a usable
key backup. Preserve the publishing account/profile with an appropriate
offline Windows backup. A planned rotation must first ship a launcher that
trusts both the old and new public keys, using a manifest signed by the old key.

Prepare an unsigned release JSON with exactly these fields, then sign it:

```json
{
  "schema": 1,
  "channel": "stable",
  "platform": "win32",
  "arch": "x64",
  "version": "1.1.3",
  "publishedAt": "2026-09-06T00:00:00.000Z",
  "artifact": {
    "fileName": "ONE-PIECE-Tabletop-Launcher-1.1.3-x64.exe",
    "bytes": 123456,
    "sha256": "<64 lower-case hexadecimal characters>",
    "url": "https://game-assets.rihdi.tw/desktop/launcher/releases/1.1.3/ONE-PIECE-Tabletop-Launcher-1.1.3-x64.exe"
  }
}
```

```powershell
.\tools\desktop-r2-publisher\sign-launcher-release.ps1 `
  -InputPath "D:\review\launcher-release-v1.unsigned.json" `
  -Json
```

By default the signed candidate is written outside the repository under
`%LOCALAPPDATA%\ONEPIECE-Tabletop\publisher\candidates`. The signer will not
overwrite an existing candidate, its input, or the formal
`public/desktop/launcher-release-v1.json`. Review and verify the candidate before
promoting it separately.

The signed manifest adds only:

```json
"signature": {
  "algorithm": "Ed25519",
  "keyId": "launcher-ed25519-<32 hex characters>",
  "value": "<base64 Ed25519 signature>"
}
```

The canonical UTF-8 payload is compact JSON with this exact property order:
`schema`, `channel`, `platform`, `arch`, `version`, `publishedAt`, then
`artifact.fileName`, `artifact.bytes`, `artifact.sha256`, and `artifact.url`.
There is no trailing newline in the signed payload. The helper is exported for
runtime/QA parity and can also show the exact canonical bytes:

```powershell
node tools/desktop-r2-publisher/launcher-manifest-signature.js canonical `
  --input "D:\review\launcher-release-v1.unsigned.json"
```

Verify a candidate using only the trusted public key:

```powershell
node tools/desktop-r2-publisher/launcher-manifest-signature.js verify `
  --input "$env:LOCALAPPDATA\ONEPIECE-Tabletop\publisher\candidates\launcher-release-v1-1.1.3.signed-candidate.json" `
  --public-key-spki-base64 "<public SPKI base64 from initialize>" `
  --key-id "<reported keyId>"
```

Run the self-contained signature regression check. It uses only an ephemeral
Ed25519 key and temporary candidate files; on Windows it also verifies a direct
CurrentUser DPAPI protect/unprotect round trip without reading or changing the
production key store:

```powershell
node tools/desktop-r2-publisher/launcher-manifest-signature-qa.js
```

## Sparse launcher content updates

The content channel updates only the launcher renderer and approved
`images/`, `audio/`, and `videos/` resources. New media paths may be added
from `public/` as long as they pass the runtime path allowlist. It cannot replace Electron main,
preload, native dependencies, game packages, or the installer. A content
manifest is an **overlay**: list only paths that differ from the installed
core package. Every revision must list **all** paths whose overlays remain
active; omitted paths fall back to the installed package. The core version must
match `desktop/package.json`, and the revision must increase within that core.

Build an unsigned candidate with explicit packaged renderer paths or new public
media paths. `--include` may be
repeated; no file is selected implicitly. To carry forward an earlier overlay,
give its signed manifest with `--carry-from`. This verifies its signature and
retains its paths while allowing new `--include` paths. Review the complete
result before signing, especially when a path should intentionally return to
the bundled version.

```powershell
node tools/desktop-r2-publisher/launcher-content-manifest.js build `
  --repo-root "D:\Codex_Release_Worktrees\launcher-fishing-visual-1.2.20" `
  --core-version 1.2.23 --revision 1 `
  --include launcher-room-minigames.css `
  --output "D:\review\launcher-content-1.2.23-r1.unsigned.json"

# Later revision: add --carry-from "D:\review\launcher-content-1.2.23-r1.signed.json"
.\tools\desktop-r2-publisher\sign-launcher-content.ps1 `
  -InputPath "D:\review\launcher-content-1.2.23-r1.unsigned.json" `
  -OutputPath "D:\review\launcher-content-1.2.23-r1.signed.json"
```

The signer uses the existing Windows CurrentUser DPAPI Ed25519 key and writes
only a new candidate file; it never writes the public manifest directly. The
canonical signed payload contains `schema`, `channel`, `platform`, `arch`,
`coreVersion`, `revision`, `publishedAt`, `baseUrl`, then sorted
`files[{path,bytes,sha256}]`. The signature is separate. The runtime verifies
the same payload and rejects a different core version or an older revision.

Inspect every signed path against the current source files without network
access, then publish only missing immutable SHA blobs. The dry run returns the
exact signed manifest SHA-256 required by the live command. Existing blobs
with matching immutable metadata are reused; conflicting objects abort.

```powershell
node tools/desktop-r2-publisher/publish-launcher-content.js `
  --repo-root "D:\Codex_Release_Worktrees\launcher-fishing-visual-1.2.20" `
  --manifest "D:\review\launcher-content-1.2.23-r1.signed.json" --json

.\tools\desktop-r2-publisher\publish-saved-content.ps1 `
  -ManifestPath "D:\review\launcher-content-1.2.23-r1.signed.json" `
  -ExpectedManifestSha256 "<64-character SHA-256 from dry run>"
```

Blob keys are `desktop/launcher/content/blobs/sha256/<sha256>`. Check public
HEAD, full GET, size, and SHA-256 for each newly uploaded blob before promoting
the signed candidate to `public/desktop/launcher-content-v1.json`. That
manifest is served by Render; R2 holds only immutable content bytes. This
workflow does not invoke the Windows installer. Run the cross-module fixture
check with `node scripts/desktop_r2_launcher_content_qa.js`.
