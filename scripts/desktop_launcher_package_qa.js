'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DESKTOP_ROOT = path.join(ROOT, 'desktop');
const PUBLIC_ROOT = path.join(ROOT, 'public');
const PACKAGE_PATH = path.join(DESKTOP_ROOT, 'package.json');
const PACKAGE_LOCK_PATH = path.join(DESKTOP_ROOT, 'package-lock.json');

const MAX_LAUNCHER_ASSET_BYTES = 64 * 1024 * 1024;
const MAX_CATALOG_BYTES = 8 * 1024 * 1024;
const MAX_ASAR_BYTES = 32 * 1024 * 1024;
const MAX_INSTALLER_BYTES = 256 * 1024 * 1024;

const APP_FILES = [
  'main.js',
  'preload.js',
  'game-preload.js',
  'game-session-policy.js',
  'auth-service.js',
  'asset-store.js',
  'launcher.html',
  'launcher.css',
  'launcher.js',
  'assets/one_piece_tabletop_launcher_icon_v1.ico',
  'package.json'
];

const EXTRA_RESOURCES = [
  {
    from: '../public/images/game_launcher',
    to: 'launcher-assets/images/game_launcher',
    filter: [
      'launcher_tabletop_series_logo_v1.png',
      'launcher_card_cover_perspective_v2.png',
      'launcher_board_cover_logo_perspective_v5.png',
      'launcher_chess_cover_logo_perspective_v5.png'
    ]
  },
  {
    from: '../public/images/desktop_launcher',
    to: 'launcher-assets/images/desktop_launcher',
    filter: ['desktop_launcher_cabin_bg_v1.png']
  },
  {
    from: '../public/images/board/avatars',
    to: 'launcher-assets/images/board/avatars',
    filter: ['*.webp']
  },
  {
    from: '../public/videos/game_launcher',
    to: 'launcher-assets/videos/game_launcher',
    filter: ['card_sanji_duel_preview_v2.mp4', 'board_battle_preview_v2.mp4']
  },
  {
    from: '../public/desktop',
    to: 'catalog',
    filter: ['catalog-v1.json', 'manifests/*.json']
  },
  {
    from: 'assets/one_piece_tabletop_launcher_icon_v1.ico',
    to: 'launcher-icon.ico'
  }
];

const ICON_PATH = path.join(DESKTOP_ROOT, 'assets', 'one_piece_tabletop_launcher_icon_v1.ico');
const SIDEBAR_PATH = path.join(DESKTOP_ROOT, 'assets', 'one_piece_tabletop_installer_sidebar_v1.bmp');
const HEADER_PATH = path.join(DESKTOP_ROOT, 'assets', 'one_piece_tabletop_installer_header_v1.bmp');

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function parseArguments(argv) {
  const options = { winUnpacked: null, installer: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      console.log('Usage: node scripts/desktop_launcher_package_qa.js [--win-unpacked PATH] [--installer PATH]');
      process.exit(0);
    }
    const match = /^(--win-unpacked|--installer)=(.+)$/.exec(argument);
    if (match) {
      options[match[1] === '--win-unpacked' ? 'winUnpacked' : 'installer'] = path.resolve(match[2]);
      continue;
    }
    if (argument === '--win-unpacked' || argument === '--installer') {
      index += 1;
      assert(index < argv.length && !argv[index].startsWith('--'), `${argument} requires a path.`);
      options[argument === '--win-unpacked' ? 'winUnpacked' : 'installer'] = path.resolve(argv[index]);
      continue;
    }
    fail(`Unknown argument: ${argument}`);
  }
  return options;
}

function readJson(filePath, label) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    fail(`${label} is missing or unreadable: ${error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${label} is invalid JSON: ${error.message}`);
  }
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right, 'en'));
}

function assertExactJson(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} differs from the approved small-launcher allowlist.`);
  }
}

function listFilesRecursive(rootPath) {
  const files = [];
  if (!fs.existsSync(rootPath)) return files;
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) fail(`Packaged output must not contain a symbolic link: ${absolute}`);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  };
  walk(rootPath);
  return files;
}

function relativePosix(rootPath, filePath) {
  return path.relative(rootPath, filePath).split(path.sep).join('/');
}

function sumFileBytes(filePaths) {
  return filePaths.reduce((sum, filePath) => sum + fs.statSync(filePath).size, 0);
}

function validateIco(filePath) {
  const bytes = fs.readFileSync(filePath);
  assert(bytes.length >= 22, 'Launcher ICO is truncated.');
  assert(bytes.readUInt16LE(0) === 0 && bytes.readUInt16LE(2) === 1, 'Launcher icon is not a Windows ICO.');
  const count = bytes.readUInt16LE(4);
  assert(count >= 4 && 6 + count * 16 <= bytes.length, 'Launcher ICO directory is invalid.');
  const sizes = [];
  for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 16;
    const width = bytes[offset] || 256;
    const height = bytes[offset + 1] || 256;
    const planes = bytes.readUInt16LE(offset + 4);
    const bitDepth = bytes.readUInt16LE(offset + 6);
    const imageBytes = bytes.readUInt32LE(offset + 8);
    const imageOffset = bytes.readUInt32LE(offset + 12);
    assert(width === height, `Launcher ICO entry ${index} is not square.`);
    assert((planes === 0 || planes === 1) && bitDepth >= 24, `Launcher ICO entry ${index} lacks full-colour icon data.`);
    assert(imageBytes > 0 && imageOffset + imageBytes <= bytes.length, `Launcher ICO entry ${index} points outside the file.`);
    sizes.push(width);
  }
  for (const required of [16, 32, 48, 256]) {
    assert(sizes.includes(required), `Launcher ICO is missing the ${required}x${required} layer.`);
  }
  return [...new Set(sizes)].sort((left, right) => left - right).join(',');
}

function validateBmp(filePath, expectedWidth, expectedHeight, label) {
  const bytes = fs.readFileSync(filePath);
  assert(bytes.length >= 54 && bytes.toString('ascii', 0, 2) === 'BM', `${label} is not a Windows BMP.`);
  const fileSize = bytes.readUInt32LE(2);
  const dibSize = bytes.readUInt32LE(14);
  const width = bytes.readInt32LE(18);
  const height = Math.abs(bytes.readInt32LE(22));
  const planes = bytes.readUInt16LE(26);
  const bitDepth = bytes.readUInt16LE(28);
  assert(fileSize === bytes.length, `${label} BMP header size does not match its file size.`);
  assert(dibSize >= 40 && width === expectedWidth && height === expectedHeight, `${label} must be ${expectedWidth}x${expectedHeight}.`);
  assert(planes === 1 && (bitDepth === 24 || bitDepth === 32), `${label} must use 24-bit or 32-bit colour.`);
  return `${width}x${height}x${bitDepth}`;
}

function validateSourcePackage() {
  const packageJson = readJson(PACKAGE_PATH, 'desktop/package.json');
  const packageLock = readJson(PACKAGE_LOCK_PATH, 'desktop/package-lock.json');
  assert(packageJson.main === 'main.js', 'desktop/package.json must use main.js as the entrypoint.');
  assert(packageJson.build?.asar === true, 'Desktop app must be packed into ASAR.');
  assert(packageJson.build?.appId === 'com.onepiece.tabletop.desktop', 'Desktop appId changed unexpectedly.');
  assert(packageJson.build?.productName === 'ONE PIECE TABLETOP SERIES 啟動器', 'Desktop product name changed unexpectedly.');
  assertExactJson(packageJson.build?.files, APP_FILES, 'build.files');
  assertExactJson(packageJson.build?.extraResources, EXTRA_RESOURCES, 'build.extraResources');
  assertExactJson(packageJson.dependencies, { 'socket.io-client': '4.8.1' }, 'Runtime dependencies');
  assert(packageLock.packages?.['']?.dependencies?.['socket.io-client'] === '4.8.1', 'package-lock does not pin the approved socket.io-client dependency.');
  assert(packageLock.packages?.['node_modules/socket.io-client']?.version === '4.8.1', 'package-lock resolved socket.io-client to an unexpected version.');

  for (const relativePath of APP_FILES.filter((entry) => entry !== 'package.json')) {
    const absolute = path.join(DESKTOP_ROOT, ...relativePath.split('/'));
    assert(fs.statSync(absolute, { throwIfNoEntry: false })?.isFile(), `Required launcher file is missing: desktop/${relativePath}`);
  }

  const win = packageJson.build?.win;
  const nsis = packageJson.build?.nsis;
  assert(win?.icon === 'assets/one_piece_tabletop_launcher_icon_v1.ico', 'Windows launcher icon is not the approved ICO.');
  assert(win?.artifactName === 'ONE-PIECE-Tabletop-Launcher-${version}-${arch}.${ext}', 'Installer artifact naming changed unexpectedly.');
  assert(Array.isArray(win?.target) && win.target.length === 1 && win.target[0]?.target === 'nsis' && JSON.stringify(win.target[0]?.arch) === '["x64"]', 'Windows target must remain one x64 NSIS installer.');
  assert(nsis?.oneClick === false && nsis?.allowToChangeInstallationDirectory === true, 'NSIS must remain an assisted installer with selectable destination.');
  assert(nsis?.createDesktopShortcut === true && nsis?.createStartMenuShortcut === true, 'NSIS shortcuts must remain enabled.');
  assert(nsis?.installerIcon === 'assets/one_piece_tabletop_launcher_icon_v1.ico', 'NSIS installer icon is not the approved ICO.');
  assert(nsis?.uninstallerIcon === 'assets/one_piece_tabletop_launcher_icon_v1.ico', 'NSIS uninstaller icon is not the approved ICO.');
  assert(nsis?.installerSidebar === 'assets/one_piece_tabletop_installer_sidebar_v1.bmp', 'NSIS installer sidebar art changed unexpectedly.');
  assert(nsis?.uninstallerSidebar === 'assets/one_piece_tabletop_installer_sidebar_v1.bmp', 'NSIS uninstaller sidebar art changed unexpectedly.');
  assert(nsis?.installerHeader === 'assets/one_piece_tabletop_installer_header_v1.bmp', 'NSIS installer header art changed unexpectedly.');

  const iconSizes = validateIco(ICON_PATH);
  const sidebar = validateBmp(SIDEBAR_PATH, 164, 314, 'Installer sidebar');
  const header = validateBmp(HEADER_PATH, 150, 57, 'Installer header');

  const catalogPath = path.join(PUBLIC_ROOT, 'desktop', 'catalog-v1.json');
  const catalog = readJson(catalogPath, 'public desktop catalog');
  assert(catalog.schema === 1 && catalog.games && typeof catalog.games === 'object', 'Desktop catalog has an unsupported schema.');
  assert(catalog.games.chess?.available === false, 'Chess must remain unavailable until its real package exists.');
  const referencedManifests = [];
  for (const gameId of ['card', 'board']) {
    const game = catalog.games[gameId];
    assert(game && typeof game === 'object', `Desktop catalog is missing ${gameId}.`);
    assert(new RegExp(`^desktop/manifests/${gameId}-assets-[a-f0-9]{16}\\.json$`).test(game.manifestPath), `${gameId} catalog manifest path is not immutable.`);
    const manifestPath = path.join(PUBLIC_ROOT, ...game.manifestPath.split('/'));
    assert(fs.statSync(manifestPath, { throwIfNoEntry: false })?.isFile(), `${gameId} manifest is missing: ${game.manifestPath}`);
    assert(sha256File(manifestPath) === game.manifestSha256, `${gameId} manifest digest differs from the catalog.`);
    referencedManifests.push(relativePosix(path.join(PUBLIC_ROOT, 'desktop', 'manifests'), manifestPath));
  }
  const manifestDirectory = path.join(PUBLIC_ROOT, 'desktop', 'manifests');
  const actualManifests = sorted(listFilesRecursive(manifestDirectory).map((filePath) => relativePosix(manifestDirectory, filePath)));
  assertExactJson(actualManifests, sorted(referencedManifests), 'Packaged game manifest set');

  const forbiddenText = JSON.stringify({ files: packageJson.build.files, extraResources: packageJson.build.extraResources }).toLowerCase();
  for (const forbidden of ['../public/images/**', '../public/audio', '../public/videos/**', '../public/fonts']) {
    assert(!forbiddenText.includes(forbidden), `Full game asset tree is forbidden in launcher packaging: ${forbidden}`);
  }

  return { packageJson, iconSizes, sidebar, header, catalog };
}

function collectExpectedLauncherAssets() {
  const expected = new Map();
  const add = (sourcePath, packagedPath) => {
    assert(fs.statSync(sourcePath, { throwIfNoEntry: false })?.isFile(), `Launcher resource source is missing: ${sourcePath}`);
    expected.set(packagedPath, sourcePath);
  };

  for (const fileName of EXTRA_RESOURCES[0].filter) {
    add(path.join(PUBLIC_ROOT, 'images', 'game_launcher', fileName), `images/game_launcher/${fileName}`);
  }
  add(
    path.join(PUBLIC_ROOT, 'images', 'desktop_launcher', 'desktop_launcher_cabin_bg_v1.png'),
    'images/desktop_launcher/desktop_launcher_cabin_bg_v1.png'
  );
  const avatarRoot = path.join(PUBLIC_ROOT, 'images', 'board', 'avatars');
  for (const entry of fs.readdirSync(avatarRoot, { withFileTypes: true })) {
    if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.webp') {
      add(path.join(avatarRoot, entry.name), `images/board/avatars/${entry.name}`);
    }
  }
  for (const fileName of EXTRA_RESOURCES[3].filter) {
    add(path.join(PUBLIC_ROOT, 'videos', 'game_launcher', fileName), `videos/game_launcher/${fileName}`);
  }
  return expected;
}

function loadAsarApi() {
  const candidates = [
    path.join(DESKTOP_ROOT, 'node_modules', '@electron', 'asar'),
    '@electron/asar'
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
    }
  }
  fail('Cannot inspect app.asar because @electron/asar is unavailable; run npm install in desktop first.');
}

function validateAsar(asarPath) {
  const asar = loadAsarApi();
  const entries = asar.listPackage(asarPath).map((entry) => entry.replace(/^[/\\]+/, '').replaceAll('\\', '/'));
  const applicationEntries = sorted(entries.filter((entry) => entry && entry !== 'node_modules' && !entry.startsWith('node_modules/')));
  const expectedEntries = sorted([
    'asset-store.js',
    'assets',
    'assets/one_piece_tabletop_launcher_icon_v1.ico',
    'auth-service.js',
    'game-preload.js',
    'game-session-policy.js',
    'launcher.css',
    'launcher.html',
    'launcher.js',
    'main.js',
    'package.json',
    'preload.js'
  ]);
  assertExactJson(applicationEntries, expectedEntries, 'app.asar application file set');
  assert(entries.includes('node_modules/socket.io-client/package.json'), 'app.asar is missing socket.io-client.');
  for (const entry of entries) {
    const lower = entry.toLowerCase();
    assert(!lower.startsWith('public/'), `app.asar contains the public game tree: ${entry}`);
    assert(!/(^|\/)(audio|videos|fonts)(\/|$)/.test(lower), `app.asar contains a full media tree: ${entry}`);
    assert(!/\.(mp3|mp4|webm|wav|ogg|webp|png|jpe?g)$/i.test(entry), `app.asar contains unexpected media: ${entry}`);
  }
  return entries.length;
}

function validateWinUnpacked(winUnpackedPath, source) {
  assert(fs.statSync(winUnpackedPath, { throwIfNoEntry: false })?.isDirectory(), `win-unpacked path is not a directory: ${winUnpackedPath}`);
  const resourcesRoot = path.join(winUnpackedPath, 'resources');
  const appExe = path.join(winUnpackedPath, `${source.packageJson.build.productName}.exe`);
  assert(fs.statSync(appExe, { throwIfNoEntry: false })?.isFile(), `Packaged launcher executable is missing: ${appExe}`);

  for (const forbiddenDirectory of ['images', 'audio', 'videos', 'fonts', 'public']) {
    assert(!fs.existsSync(path.join(resourcesRoot, forbiddenDirectory)), `Full game tree leaked into packaged resources/${forbiddenDirectory}.`);
  }

  const asarPath = path.join(resourcesRoot, 'app.asar');
  assert(fs.statSync(asarPath, { throwIfNoEntry: false })?.isFile(), 'win-unpacked resources/app.asar is missing.');
  const asarBytes = fs.statSync(asarPath).size;
  assert(asarBytes <= MAX_ASAR_BYTES, `app.asar is too large for the small launcher (${asarBytes} bytes).`);
  const asarEntries = validateAsar(asarPath);

  const expectedAssets = collectExpectedLauncherAssets();
  const launcherAssetRoot = path.join(resourcesRoot, 'launcher-assets');
  const actualAssetFiles = listFilesRecursive(launcherAssetRoot);
  const actualAssetNames = sorted(actualAssetFiles.map((filePath) => relativePosix(launcherAssetRoot, filePath)));
  assertExactJson(actualAssetNames, sorted(expectedAssets.keys()), 'win-unpacked launcher asset set');
  const launcherBytes = sumFileBytes(actualAssetFiles);
  assert(launcherBytes <= MAX_LAUNCHER_ASSET_BYTES, `Launcher-only media exceeds ${MAX_LAUNCHER_ASSET_BYTES} bytes.`);
  for (const [packagedName, sourcePath] of expectedAssets) {
    const packagedPath = path.join(launcherAssetRoot, ...packagedName.split('/'));
    assert(sha256File(packagedPath) === sha256File(sourcePath), `Packaged launcher resource differs from source: ${packagedName}`);
  }

  const catalogRoot = path.join(resourcesRoot, 'catalog');
  const catalogFiles = listFilesRecursive(catalogRoot);
  const sourceCatalogRoot = path.join(PUBLIC_ROOT, 'desktop');
  const expectedCatalogNames = sorted([
    'catalog-v1.json',
    ...['card', 'board'].map((gameId) => source.catalog.games[gameId].manifestPath.replace(/^desktop\//, ''))
  ]);
  const actualCatalogNames = sorted(catalogFiles.map((filePath) => relativePosix(catalogRoot, filePath)));
  assertExactJson(actualCatalogNames, expectedCatalogNames, 'win-unpacked catalog file set');
  const catalogBytes = sumFileBytes(catalogFiles);
  assert(catalogBytes <= MAX_CATALOG_BYTES, `Bundled catalog exceeds ${MAX_CATALOG_BYTES} bytes.`);
  for (const relativeName of expectedCatalogNames) {
    assert(
      sha256File(path.join(catalogRoot, ...relativeName.split('/'))) === sha256File(path.join(sourceCatalogRoot, ...relativeName.split('/'))),
      `Packaged catalog resource differs from source: ${relativeName}`
    );
  }

  const packagedIcon = path.join(resourcesRoot, 'launcher-icon.ico');
  assert(fs.statSync(packagedIcon, { throwIfNoEntry: false })?.isFile(), 'Packaged resources/launcher-icon.ico is missing.');
  assert(sha256File(packagedIcon) === sha256File(ICON_PATH), 'Packaged launcher icon differs from the approved ICO.');

  return { asarEntries, launcherFiles: actualAssetFiles.length, launcherBytes, catalogFiles: catalogFiles.length, catalogBytes };
}

function validatePortableExecutable(filePath, label) {
  const stat = fs.statSync(filePath, { throwIfNoEntry: false });
  assert(stat?.isFile(), `${label} is missing: ${filePath}`);
  assert(path.extname(filePath).toLowerCase() === '.exe', `${label} must be a Windows .exe.`);
  assert(stat.size >= 1024 * 1024, `${label} is unexpectedly small (${stat.size} bytes).`);
  assert(stat.size <= MAX_INSTALLER_BYTES, `${label} exceeds the small-launcher ceiling (${stat.size} bytes).`);
  const handle = fs.openSync(filePath, 'r');
  try {
    const dosHeader = Buffer.alloc(64);
    assert(fs.readSync(handle, dosHeader, 0, dosHeader.length, 0) === dosHeader.length, `${label} DOS header is truncated.`);
    assert(dosHeader.toString('ascii', 0, 2) === 'MZ', `${label} lacks an MZ header.`);
    const peOffset = dosHeader.readUInt32LE(0x3c);
    assert(peOffset > 0 && peOffset + 4 <= stat.size, `${label} has an invalid PE offset.`);
    const signature = Buffer.alloc(4);
    assert(fs.readSync(handle, signature, 0, 4, peOffset) === 4 && signature.equals(Buffer.from([0x50, 0x45, 0, 0])), `${label} lacks a PE signature.`);
  } finally {
    fs.closeSync(handle);
  }
  return { bytes: stat.size, sha256: sha256File(filePath) };
}

function validateInstaller(installerPath, packageJson) {
  const expectedName = packageJson.build.win.artifactName
    .replace('${version}', packageJson.version)
    .replace('${arch}', 'x64')
    .replace('${ext}', 'exe');
  assert(path.basename(installerPath) === expectedName, `Installer filename must be ${expectedName}.`);
  return validatePortableExecutable(installerPath, 'NSIS installer');
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const source = validateSourcePackage();
  const parts = [
    'DESKTOP_LAUNCHER_PACKAGE_QA=PASS',
    `iconSizes=${source.iconSizes}`,
    `sidebar=${source.sidebar}`,
    `header=${source.header}`,
    'runtimeDeps=1',
    'games=card,board',
    'chess=unavailable'
  ];
  if (options.winUnpacked) {
    const packaged = validateWinUnpacked(options.winUnpacked, source);
    parts.push(`asarEntries=${packaged.asarEntries}`, `launcherFiles=${packaged.launcherFiles}`, `launcherBytes=${packaged.launcherBytes}`, `catalogFiles=${packaged.catalogFiles}`);
  }
  if (options.installer) {
    const installer = validateInstaller(options.installer, source.packageJson);
    parts.push(`installerBytes=${installer.bytes}`, `installerSha256=${installer.sha256}`);
  }
  console.log(parts.join(' '));
}

try {
  main();
} catch (error) {
  console.error(`DESKTOP_LAUNCHER_PACKAGE_QA=FAIL ${error.stack || error.message || error}`);
  process.exitCode = 1;
}
