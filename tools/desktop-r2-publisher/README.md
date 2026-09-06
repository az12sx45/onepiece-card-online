# Desktop R2 publisher

This tool reads the formal `public/desktop/catalog-v2.json` plus the Card,
Board, and Chess manifests, verifies every source byte against its declared
size and SHA-256, and deduplicates uploads by content hash. The large Chess
media tree remains outside Git and must be supplied through the reviewed
release package's `public/assets` directory.

The default command is a local-only dry run. It performs no network requests:

```powershell
node tools/desktop-r2-publisher/publish.js
```

To verify or publish only Chess media, pass its exact reviewed source root:

```powershell
node tools/desktop-r2-publisher/publish.js --game chess --chess-source "D:\航海王西洋棋\GRAND-LINE-BATTLE-多人發布版-v1\public\assets"
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
node publish.js --live --chess-source "D:\航海王西洋棋\GRAND-LINE-BATTLE-多人發布版-v1\public\assets"
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
.\publish-saved-r2.ps1
```

The encrypted document lives outside the repository under the current user's
Local AppData folder. Plaintext credentials are cleared from the process and
clipboard, are never committed, and can only be decrypted by the same Windows
user on the same computer.

Published object keys use this immutable layout:

```text
desktop/blobs/sha256/<first-two-hex>/<64-character-sha256>
```

## Launcher installer releases

`publish-launcher-artifact.js` publishes one reviewed Windows launcher installer
without changing `public/desktop/launcher-release-v1.json`. The installer must:

- be an explicit absolute path to a regular, non-link `.exe` file;
- contain valid `MZ` and `PE` signatures;
- use a valid semantic version and the canonical file name
  `ONE-PIECE-Tabletop-Launcher-<version>-x64.exe`;
- be at most 256 MiB, matching the launcher's update download limit.

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
