# PIRATE ODYSSEY iOS preparation

This is an isolated platform adapter for the verified native v038 product. It is
not the older WebView iOS trial, a new game, or an accepted iPhone build.

## Current boundaries

- No paid cloud account, membership, job, upload, or signing has been started.
- QuickJS-NG v1.0.2 provides iOS arm64 device and arm64 simulator libraries.
- Android Java plugins cannot run on iOS. This candidate supplies Keychain
  session storage, a SHA-verified media cache, and AVPlayer video presentation.
- Original game controllers, IDs, saves, Socket.IO events, battle and dungeon
  rules remain from the pinned native product. Adaptations are enumerated with
  before/after hashes in preparation.json; never substitute the old pilot.
- iOS uses its own bundle ID and sandbox. It does not access the Android vault.
  The owner signs in using the existing game account on the iPhone. Passwords
  are used only for AUTH_LOGIN and are not saved; session tokens use Keychain.
- Login credentials, certificates, provisioning profiles, and Apple passwords
  must not be included in the source package, logs, or GitHub artifacts.
- Pinned images/audio/video are downloaded by SHA into the iPhone's cache.
  No APK updater, downloaded game scripts, or code hot-update is enabled on iOS.
- Safe-area layout and the AVPlayer overlay require physical iPhone review.
  macOS compilation, signing and iPhone acceptance remain separate gates.

## Windows preparation

Run tools/prepare.py with the exact verified native product directory and a new
output directory. It checks all source hashes before copying about 95 MB of
game code and existing UI resources. It downloads only the pinned media index,
not the multi-GB media catalog. It never changes the Android source generation.

## Mac build

Run the supplied tools/build_macos.py from a macOS/Xcode host after dependencies
are available. It creates an unsigned device build. A successful unsigned build
alone cannot be installed on an iPhone. Code signing or local personal-account
sideloading is a separate owner-operated step. Personal provisioning expires;
TestFlight requires paid Apple Developer Program membership.

No workflow is installed or dispatched automatically. Before using a hosted Mac,
verify actual free allowance and a zero-spend limit. Do not make private code
public to obtain free minutes. Paid service requires the owner's approval.

## Required validation before delivery

1. Verify pinned archive hashes, iOS architectures and native entry symbols.
2. Compile bridge with Xcode, export and link the exact Godot version.
3. Put exact-engine .godot/.api_dumping metadata in the physical app bundle
   before signing; the upstream loader globalizes this path outside the PCK.
4. Sign the final bundle, install and inspect iPhone logs. Test login restoration,
   downloads, safe area, video completion/cancel, audio, save/load, battle, party
   replacement, dungeon returns and cross-device room/state synchronization.
5. Do not mark these gates passed from Python/Node tests or Windows Godot alone.

## v039 launcher and raw-resource correction

The first signed v038 phone run exposed missing raw font/UI files: FileAccess and Image.load cannot read only an imported fontdata/ctex replacement. raw_resources.py marks bundled byte-loaded art as Keep File; final IPA verification checks their original bytes. prepare_launcher.py stages the existing APK launcher renderer/art under bundle-resources/launcher-web. WKWebView is restricted to local launcher navigation and its main-frame IPC; Godot starts only on explicit Board launch, and return preserves the account. Card/Chess remain visibly unavailable in this Board iOS candidate. No account secrets are part of the bundle. Windows checks do not prove WKWebView/iPhone acceptance.
