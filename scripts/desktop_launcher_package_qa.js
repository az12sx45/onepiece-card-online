'use strict';

const crypto = require('node:crypto');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DESKTOP_ROOT = path.join(ROOT, 'desktop');
const PUBLIC_ROOT = path.join(ROOT, 'public');
const PACKAGE_PATH = path.join(DESKTOP_ROOT, 'package.json');
const PACKAGE_LOCK_PATH = path.join(DESKTOP_ROOT, 'package-lock.json');
const RADIAL_PRESENTATION = require('../tools/launcher-room/expansion-v128/validate_release');
const HISTORICAL_V128_COMMIT = '0aa99bac64f748b0322f248280546078f1523b06';
const HISTORICAL_V128_STATUS = 'tools/launcher-room/loading-v129/historical-status.json';
const HISTORICAL_V128_STATUS_SHA256 = '34cb7074700ea4171bffa7ba6c4e5e0ec1798ad67b1c7a726b672d4fe873ff8e';
const HISTORICAL_V128_REVIEW_SHA256 = '52296787a94ee50223fc75e725642055761aacde820aef3d915064aac9bbdd0e';
const ROOM_HD_REVIEW = require('../tools/launcher-room/presentation-v124/validate_hd');
const ROOM_RESERVED_REVIEW = require('../tools/launcher-room/presentation-v125/validate_reserved');
const ACE_V2_MANIFEST = require('../tools/launcher-room/ace-lean-v1212/manifest.json');

const MAX_LAUNCHER_ASSET_BYTES = 128 * 1024 * 1024;
// 1.1.16 retains the 80 reviewed 1.1.15 atlases and 10 portraits. Keep the existing media
// budget intact and account for this separately hash-verified resource set.
const MAX_ROOM_MOTION_ASSET_BYTES = 20 * 1024 * 1024;
const MAX_ROOM_LIFE_FURNITURE_BYTES = 1 * 1024 * 1024;
const MAX_ROOM_LIFE_HD_ASSET_BYTES = 16 * 1024 * 1024;
// The 32 new, individually reviewed expansion assets have a 4 MiB allowance.
// Existing media keeps its 128 MiB limit and the combined 160 MiB cap stays fixed.
const MAX_ROOM_EXPANSION_ASSET_BYTES = 4 * 1024 * 1024;
const MAX_LOCKED_CREW_CANDIDATE_BYTES = 4 * 1024 * 1024;
// The installer needs the current game manifests; historical manifests remain
// in the source and in existing installs' caches.
const MAX_CATALOG_BYTES = 5 * 1024 * 1024;
const MAX_ASAR_BYTES = 32 * 1024 * 1024;
const MAX_INSTALLER_BYTES = 256 * 1024 * 1024;
const RETAINED_ROLLOUT_MANIFESTS = Object.freeze({
  'chess-package-cdab9e869c05f12d.json': '9eeda0136c2781bb29196f67ac97350a94dba0fa826b3af4f117b4f69cd49043',
  'board-package-68ec6b205918f818.json': '80c4c8135e9bea62bffef7936326289b31e2d6b2062bb4864c83ae4df6f0365b',
  'board-package-0f7755bca2f64ff4.json': '9ddb9b90c4e7ddbf3183cc25de503ecade57a0924c5125d079d4f3b473bf1149',
  'card-assets-197d7c0144fe523a.json': '1c33fb0ea2d42ed11b868c861de9286af356f1717d5a81724cda285d3536c443',
  'board-assets-ecd41e5ae3bcf045.json': '97908b785417c4944971d1d2d5b3cd3708778f2f894a2f028394fa29b450ad3f'
});
const STABLE_GAME_MANIFESTS = Object.freeze({
  card: Object.freeze({
    manifestPath: 'desktop/manifests/card-assets-440918e609684317.json',
    manifestSha256: '46bc6d59f66c6ec5c26e2d7291c5b1ec65f466f6c2a70560c6a39ba11faed263'
  }),
  board: Object.freeze({
    manifestPath: 'desktop/manifests/board-assets-eb95373ee6ab1aa3.json',
    manifestSha256: 'c1d6736b6687d1146397607607c9e9fe63f93acf2f83aa5fe5fc68cd34f32c82'
  })
});

const APP_FILES = [
  'main.js',
  'preload.js',
  'game-preload.js',
  'game-session-policy.js',
  'game-cursor-policy.js',
  'runtime-asset-cache.js',
  'program-runtime.js',
  'launcher-update-service.js',
  'auth-service.js',
  'social-service.js',
  'launcher-social.js',
  'launcher-social.css',
  'launcher-profile-shop.js',
  'launcher-profile-shop.css',
  'launcher-reserved-crew.js',
  'launcher-life-data.js',
  'launcher-life-actions.js',
  'launcher-life.js',
  'launcher-room-minigames.js',
  'launcher-room-minigames.css',
  'launcher-life-room.js',
  'launcher-room.js',
  'launcher-room-ambience.js',
  'launcher-room-ambience.css',
  'launcher-room-aquarium.js',
  'launcher-room-aquarium.css',
  'launcher-room-dialogue.js',
  'launcher-room-motion-data.js',
  'launcher-room-motion.js',
  'launcher-room.css',
  'launcher-announcements.js',
  'launcher-announcements.css',
  'launcher-updates-ui.js',
  'launcher-account-ui.js',
  'asset-store.js',
  'launcher.html',
  'launcher.css',
  'launcher.js',
  'assets/one_piece_tabletop_launcher_icon_v1.ico',
  'package.json'
];

const ROOM_DEPTH_FURNITURE = ['bookshelf', 'helm', 'kitchen-table', 'map-table', 'medicine-cabinet', 'piano', 'swords-rack', 'tangerine-tree', 'tool-bench', 'treasure-chest'];
const ROOM_DEPTH_CHARACTERS = ['luffy', 'zoro', 'nami', 'usopp', 'sanji', 'chopper', 'robin', 'franky', 'brook', 'jinbe'];
const ROOM_MOTION_ASSETS = ROOM_DEPTH_CHARACTERS.flatMap(key =>
  ['motion', 'acting'].flatMap(kind => ['east', 'west', 'north', 'south'].map(direction => `${kind}_v3/${key}/${direction}.webp`)));
const ROOM_PORTRAIT_ASSETS = ROOM_DEPTH_CHARACTERS.map(key => `portrait_v3/${key}.webp`);
const ROOM_HD_ASSETS = ROOM_HD_REVIEW.ASSETS.map(asset => asset.replace(/^public\/images\/launcher_room\//, ''));
const ROOM_RESERVED_ASSETS = ROOM_RESERVED_REVIEW.ASSETS.map(asset => asset.replace(/^public\/images\/launcher_room\//, ''));
const ACE_V2_ASSETS = ROOM_RESERVED_ASSETS.filter(asset => asset.startsWith('reserved_v1/ace/'))
  .map(asset => asset.replace(/^reserved_v1\//, 'reserved_v2/'));
const ROOM_NEW_V127_ASSETS = [...RADIAL_PRESENTATION.MINIGAME_ASSETS, ...RADIAL_PRESENTATION.ROBIN_ASSETS]
  .map(asset => asset.replace(/^public\/images\/launcher_room\//, ''));
const ROOM_NEW_V128_ASSETS = RADIAL_PRESENTATION.EXPANSION_ASSETS
  .map(asset => asset.replace(/^public\/images\/launcher_room\//, ''));
const ROOM_LIFE_HD_ASSETS = require('../desktop/launcher-life-actions').hdAssets().map(asset => `life_hd_v2/${asset}`);
const LUFFY_NEW_ASSETS = [
  ...['motion_v5', 'acting_v5'].flatMap(kind => ['east', 'west', 'north', 'south'].map(direction => `${kind}/luffy/${direction}.webp`)),
  ...['east', 'west', 'north', 'south'].map(direction => `life_hd_v3/luffy/work-${direction}.webp`),
  ...['eat', 'rest', 'sleep', 'train'].map(action => `life_hd_v3/luffy/${action}-south.webp`),
  'portrait_v4/luffy.webp'
];
const LUFFY_NEW_ASSET_SET = new Set(LUFFY_NEW_ASSETS);
const ROOM_NEW_V1215_ASSETS = [
  ...['crew-cabin', 'sunny-deck', 'sunny-kitchen', 'sunny-library', 'sunny-workshop', 'sunny-aquarium']
    .map(key => `scenes/${key}-cutout-v3.webp`),
  ...['dawn', 'day', 'dusk', 'night', 'storm'].map(key => `sea/ocean-${key}.webp`),
  'minigames_v1/fishing-sea.webp',
  'minigames_v1/repair-workbench-v2.webp',
  'minigames_v1/navigation-chart-v2.webp',
  'minigames_v1/cooking-galley-v2.webp',
  'minigames_v1/supply-deck-v2.webp',
  ...['balloon-catfish', 'glistening-saury', 'panda-shark', 'smile-jellyfish']
    .map(key => `fish_v1/${key}.webp`),
  ...['aquarium-tank', 'crew-tea-table', 'fishing-gear-rack', 'galley-icebox']
    .map(key => `furniture/${key}.webp`),
  ...['aquarium-tank', 'crew-tea-table', 'fishing-gear-rack', 'galley-icebox']
    .flatMap(key => [0, 1, 2, 3].map(rotation => `furniture_views/${key}/${rotation}.webp`)),
  ...['vivi', 'shanks', 'mihawk', 'perona', 'marco', 'buggy', 'carrot', 'yamato', 'bonclay', 'koala']
    .map(key => `reserved_v3_previews/${key}.webp`)
];
const ROOM_NEW_V1215_SET = new Set(ROOM_NEW_V1215_ASSETS);
const FISHING_V1216_ART = Object.freeze([
  Object.freeze({ asset: 'fishing_v2/rod.webp', bytes: 126596, sha256: '733e28744a97641d18a921e4cd56041e73ba3e26c7572d16e69d9c8ef564f5c6' }),
  Object.freeze({ asset: 'fishing_v2/bobber.webp', bytes: 148358, sha256: 'a029398765ed3b50be8aab69e1b75e8524bc25c8bbdeeb7744fccf1edfd94613' }),
  Object.freeze({ asset: 'fishing_v2/splash.webp', bytes: 352022, sha256: 'ea43144ffce6155e05609b779bd4668fc440e6c4c08dbcd78a3f2018426c2902' })
]);
const FISHING_V1216_ART_SET = new Set(FISHING_V1216_ART.map(item => item.asset));
const FISHING_V1216_ANNOUNCEMENT = Object.freeze({
  asset: 'launcher-fishing-play-1.2.16.webp', bytes: 367478,
  sha256: '333d6282f1f5da6c0121882133c8725555dd255b632ca5b9ccc579da46616b74'
});
const ROOM_LOCKED_V1215_PREVIEW_KEYS = ['vivi', 'shanks', 'mihawk', 'perona', 'marco', 'buggy', 'carrot', 'yamato', 'bonclay', 'koala'];
const ROOM_LOCKED_V1215_VIVI_ASSETS = [
  'reserved_v3/vivi/portrait.webp',
  ...['walk', 'acting'].flatMap(kind => ['east', 'west', 'north', 'south'].map(direction => `reserved_v3/vivi/${kind}/${direction}.webp`)),
  ...['east', 'west', 'north', 'south'].map(direction => `reserved_v3/vivi/life/work-${direction}.webp`),
  ...['eat', 'rest', 'sleep', 'train'].map(action => `reserved_v3/vivi/life/${action}-south.webp`)
];
const ROOM_LOCKED_V1215_VIVI_SET = new Set(ROOM_LOCKED_V1215_VIVI_ASSETS);
const ROOM_LIFE_FURNITURE = ['furniture/galley-stove.webp', ...[0,1,2,3].map(rotation => `furniture_views/galley-stove/${rotation}.webp`)];
const ROOM_DEPTH_ACTION_OVERRIDES = new Set([
  ...['luffy', 'zoro', 'nami', 'usopp', 'sanji', 'chopper', 'robin', 'brook'].map(key => `${key}/walk2`),
  'franky/talk_annoyed', 'jinbe/sit'
]);
const ROOM_ACTION_POSES = ['idle', 'walk1', 'walk2', 'talk_happy', 'talk_annoyed', 'surprised', 'focused_use', 'sit', 'wave'];
const ZORO_OVERLAY_PATH = path.join(ROOT, 'docs', 'LAUNCHER_ROOM_ZORO_ART_OVERLAY_20260925.json');
const ZORO_HISTORICAL_MANIFEST_SHA256 = Object.freeze({
  'LAUNCHER_ROOM_ART_20260925.json': 'c81ad058510d5b1f12a17bb5288e4f3325f8aae2def49c35854550bc89832570',
  'LAUNCHER_ROOM_EXPANSION_ART_20260925.json': '708b7f046595191f425cde21900737e661103c283090942006515f109db3baab',
  'LAUNCHER_ROOM_DEPTH_ART_20260925.json': 'da9fd1fbe377d8fafdfb0be2118961cec65445da22bb7d47739aef35fb749ee1'
});
const ZORO_ACTION_SOURCE = 'tools/launcher-room/action-source-png/zoro.png';
const ZORO_CHIBI_SOURCE = 'tools/launcher-room/source-png/zoro.png';
const ZORO_CHIBI_ASSET = 'public/images/launcher_room/chibi/zoro.webp';
const ZORO_ACTION_ASSETS = ROOM_ACTION_POSES.map(pose => `public/images/launcher_room/action_frames/zoro/${pose}.webp`);
const ZORO_WALK2_ASSET = 'public/images/launcher_room/action_frames/zoro/walk2.webp';
const ROOM_DEPTH_ASSETS = [
  ...ROOM_DEPTH_FURNITURE.flatMap(key => [0, 1, 2, 3].map(rotation => `furniture_views/${key}/${rotation}.webp`)),
  ...ROOM_DEPTH_CHARACTERS.flatMap(key => ROOM_ACTION_POSES.map(pose => `action_frames/${key}/${pose}.webp`))
];

const EXTRA_RESOURCES = [
  {
    from: '../public/images/game_launcher',
    to: 'launcher-assets/images/game_launcher',
    filter: [
      'launcher_tabletop_series_logo_v1.webp',
      'launcher_gallery_background_v2.webp',
      'launcher_card_cover_perspective_v2.webp',
      'launcher_card_box_frame_cutout_v1.webp',
      'launcher_card_lid_front_panel_v1.webp',
      'launcher_card_box_shell_fixed_v1.webp',
      'launcher_board_cover_logo_perspective_v5.webp',
      'launcher_board_box_frame_cutout_v1.webp',
      'launcher_board_lid_front_panel_v1.webp',
      'launcher_board_box_shell_fixed_v1.webp',
      'launcher_chess_cover_logo_perspective_v5.webp',
      'launcher_chess_box_frame_cutout_v1.webp',
      'launcher_chess_lid_front_panel_v1.webp',
      'launcher_chess_box_shell_fixed_v1.webp'
    ]
  },
  {
    from: '../public/images/desktop_launcher',
    to: 'launcher-assets/images/desktop_launcher',
    filter: [
      'desktop_launcher_cabin_bg_v1.webp',
      'launcher_box_core_frame_01_v1.webp',
      'launcher_box_center_light_01_v3.webp',
      'launcher_box_center_light_02_v3.webp',
      'launcher_box_center_light_03_v3.webp',
      'launcher_box_center_light_04_v3.webp',
      'launcher_cursor_logpose_default_v1.png',
      'launcher_cursor_logpose_pointer_v1.png',
      'launcher_cursor_logpose_pressed_v1.png'
    ]
  },
  {
    from: '../public/images/board/avatars',
    to: 'launcher-assets/images/board/avatars',
    filter: ['*.webp']
  },
  {
    from: '../public/images/walls',
    to: 'launcher-assets/images/walls',
    filter: ['*.webp']
  },
  {
    from: '../public/images/flags',
    to: 'launcher-assets/images/flags',
    filter: ['*.webp']
  },
  {
    from: '../public/images/profile_decor',
    to: 'launcher-assets/images/profile_decor',
    filter: [
      'bg-luffy.webp', 'bg-zoro.webp', 'bg-nami.webp',
      'frame-luffy.webp', 'frame-zoro.webp',
      'sticker-luffy.webp', 'sticker-zoro.webp', 'sticker-nami.webp',
      'sticker-chopper.webp', 'sticker-ace.webp', 'sticker-robin.webp'
    ]
  },
  {
    from: '../public/images/launcher_announcements',
    to: 'launcher-assets/images/launcher_announcements',
    filter: ['launcher-life-1.2.13.webp', 'launcher-proportions-1.2.14.webp', 'launcher-life-fishing-1.2.15.webp', FISHING_V1216_ANNOUNCEMENT.asset]
  },
  {
    from: '../public/images/launcher_room',
    to: 'launcher-assets/images/launcher_room',
    filter: [
      'scenes/sunny-deck-v2.webp', 'scenes/sunny-kitchen-v2.webp', 'scenes/sunny-library-v2.webp',
      'furniture/helm.webp', 'furniture/map-table.webp', 'furniture/treasure-chest.webp',
      'furniture/tangerine-tree.webp', 'furniture/swords-rack.webp', 'furniture/kitchen-table.webp',
      'furniture/bookshelf.webp', 'furniture/medicine-cabinet.webp', 'furniture/piano.webp',
      'furniture/tool-bench.webp',
      'chibi/luffy.webp', 'chibi/zoro.webp', 'chibi/nami.webp', 'chibi/chopper.webp',
      'chibi/sanji.webp', 'chibi/robin.webp',
      'chibi/usopp.webp', 'chibi/franky.webp', 'chibi/brook.webp', 'chibi/jinbe.webp',
      'emotions/luffy-happy.webp',
      'emotions/luffy-surprised.webp',
      'emotions/luffy-focused.webp',
      'emotions/luffy-annoyed.webp',
      'emotions/zoro-happy.webp',
      'emotions/zoro-surprised.webp',
      'emotions/zoro-focused.webp',
      'emotions/zoro-annoyed.webp',
      'emotions/nami-happy.webp',
      'emotions/nami-surprised.webp',
      'emotions/nami-focused.webp',
      'emotions/nami-annoyed.webp',
      'emotions/chopper-happy.webp',
      'emotions/chopper-surprised.webp',
      'emotions/chopper-focused.webp',
      'emotions/chopper-annoyed.webp',
      'emotions/sanji-happy.webp',
      'emotions/sanji-surprised.webp',
      'emotions/sanji-focused.webp',
      'emotions/sanji-annoyed.webp',
      'emotions/robin-happy.webp',
      'emotions/robin-surprised.webp',
      'emotions/robin-focused.webp',
      'emotions/robin-annoyed.webp',
      'emotions/usopp-happy.webp',
      'emotions/usopp-surprised.webp',
      'emotions/usopp-focused.webp',
      'emotions/usopp-annoyed.webp',
      'emotions/franky-happy.webp',
      'emotions/franky-surprised.webp',
      'emotions/franky-focused.webp',
      'emotions/franky-annoyed.webp',
      'emotions/brook-happy.webp',
      'emotions/brook-surprised.webp',
      'emotions/brook-focused.webp',
      'emotions/brook-annoyed.webp',
      'emotions/jinbe-happy.webp',
      'emotions/jinbe-surprised.webp',
      'emotions/jinbe-focused.webp',
      'emotions/jinbe-annoyed.webp',
      'frames/straw-hat.webp', 'frames/ship-wheel.webp',
      ...ROOM_DEPTH_ASSETS,
      ...ROOM_PORTRAIT_ASSETS,
      ...ROOM_HD_ASSETS,
      ...ROOM_LIFE_FURNITURE,
      ...ROOM_LIFE_HD_ASSETS,
      ...ROOM_RESERVED_ASSETS,
      ...ACE_V2_ASSETS,
      ...ROOM_NEW_V127_ASSETS,
      ...ROOM_NEW_V128_ASSETS,
      ...LUFFY_NEW_ASSETS,
      ...ROOM_NEW_V1215_ASSETS.flatMap(asset => asset === 'minigames_v1/fishing-sea.webp'
        ? [asset, ...FISHING_V1216_ART.map(item => item.asset)] : [asset]),
      ...ROOM_LOCKED_V1215_VIVI_ASSETS
    ]
  },
  {
    from: '../public/audio/profile_bgm',
    to: 'launcher-assets/audio/profile_bgm',
    filter: ['harbor.ogg', 'night-watch.ogg', 'voyage.ogg']
  },
  {
    from: '../public/audio/bgm',
    to: 'launcher-assets/audio/bgm',
    filter: Array.from({ length: 20 }, (_, index) => `track${String(index + 1).padStart(2, '0')}.mp3`)
  },
  {
    from: '../public/videos/game_launcher',
    to: 'launcher-assets/videos/game_launcher',
    filter: ['card_sanji_duel_preview_v2.mp4', 'board_battle_preview_v2.mp4']
  },
  {
    from: '../public/desktop',
    to: 'catalog',
    filter: [
      'catalog-v2.json',
      'catalog-v3.json',
      'manifests/card-assets-440918e609684317.json',
      'manifests/board-assets-eb95373ee6ab1aa3.json',
      'manifests/chess-assets-4a14ed8c714c0b60.json',
      'manifests/card-package-ca251af687e50daf.json',
      'manifests/board-package-e98ef3f16bf6e6e4.json',
      'manifests/chess-package-d37cd9a585600687.json'
    ]
  },
  {
    from: 'assets/one_piece_tabletop_launcher_icon_v1.ico',
    to: 'launcher-icon.ico'
  },
  {
    from: '../public/css',
    to: 'cursor-policy/css',
    filter: ['board-cursor-nami-v3.css', 'card-cursor-buggy-v3.css']
  },
  {
    from: '../public/js/game_cursor_feedback_v1.js',
    to: 'cursor-policy/js/game_cursor_feedback_v1.js'
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

function validateCursorPng(filePath, label) {
  const bytes = fs.readFileSync(filePath);
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert(bytes.length >= 33 && bytes.subarray(0, 8).equals(pngSignature), `${label} is not a PNG.`);
  assert(bytes.toString('ascii', 12, 16) === 'IHDR', `${label} has no PNG IHDR.`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colourType = bytes[25];
  assert(width === 40 && height === 40, `${label} must be 40x40.`);
  assert(bitDepth === 8 && colourType === 6, `${label} must be 8-bit RGBA with real transparency.`);
  assert(bytes.length <= 64 * 1024, `${label} is unexpectedly large for a cursor.`);
  return `${width}x${height}x${bitDepth}-rgba`;
}

function validateZoroArtOverlay(roomManifest, roomDepth, roomWalk) {
  for (const [name, historicalSha256] of Object.entries(ZORO_HISTORICAL_MANIFEST_SHA256)) {
    assert(sha256File(path.join(ROOT, 'docs', name)) === historicalSha256,
      `Immutable room art manifest changed: ${name}`);
  }
  const chibi = roomManifest.items.filter(item => item.asset === ZORO_CHIBI_ASSET);
  const action = roomDepth.items.filter(item => ZORO_ACTION_ASSETS.includes(item.asset));
  assert(chibi.length === 1 && action.length === ROOM_ACTION_POSES.length,
    'Historical Zoro chibi/action item count changed.');
  assert(chibi[0].sourcePng === ZORO_CHIBI_SOURCE, 'Historical Zoro chibi source path changed.');
  assertExactJson(sorted(action.map(item => item.asset)), sorted(ZORO_ACTION_ASSETS), 'Historical Zoro action asset set');
  const actionSourceRows = action.filter(item => item.asset !== ZORO_WALK2_ASSET);
  assert(actionSourceRows.every(item => item.sourcePng === ZORO_ACTION_SOURCE &&
    item.sourceSha256 === actionSourceRows[0].sourceSha256),
  'Historical Zoro action source path or digest changed.');

  const currentSourceSha = new Map([
    [ZORO_ACTION_SOURCE, sha256File(path.join(ROOT, ...ZORO_ACTION_SOURCE.split('/')))],
    [ZORO_CHIBI_SOURCE, sha256File(path.join(ROOT, ...ZORO_CHIBI_SOURCE.split('/')))]
  ]);
  const historicalSourceSha = new Map([
    [ZORO_ACTION_SOURCE, actionSourceRows[0].sourceSha256],
    [ZORO_CHIBI_SOURCE, chibi[0].sourceSha256]
  ]);
  const changedSourcePaths = sorted([...currentSourceSha.keys()].filter(source =>
    currentSourceSha.get(source) !== historicalSourceSha.get(source)));
  const historicalAssets = [chibi[0], ...action];
  const changedAssetPaths = sorted(historicalAssets.filter(item =>
    sha256File(path.join(ROOT, ...item.asset.split('/'))) !== item.assetSha256).map(item => item.asset));

  const actionManifest = readJson(path.join(ROOT, 'tools', 'launcher-room', 'action-source-png', 'action-manifest.json'),
    'Zoro action frame manifest');
  const activeZoro = actionManifest.characters?.filter(item => item.character === 'zoro') || [];
  assert(activeZoro.length === 1 && activeZoro[0].source === ZORO_ACTION_SOURCE &&
    activeZoro[0].sourceSha256 === currentSourceSha.get(ZORO_ACTION_SOURCE),
  'Active Zoro atlas/source digest differs from action manifest.');
  const activeFrames = activeZoro[0].frames;
  assert(Array.isArray(activeFrames) && activeFrames.length === ROOM_ACTION_POSES.length,
    'Active Zoro action frame count differs.');
  assertExactJson(sorted(activeFrames.map(frame => frame.path)), sorted(ZORO_ACTION_ASSETS),
    'Active Zoro action frame set');
  const activeFrameByAsset = new Map(activeFrames.map(frame => [frame.path, frame]));
  for (const [index, pose] of ROOM_ACTION_POSES.entries()) {
    const asset = ZORO_ACTION_ASSETS[index];
    const frame = activeFrameByAsset.get(asset);
    const file = path.join(ROOT, ...asset.split('/'));
    assert(frame.pose === pose && frame.sourcePng === ZORO_ACTION_SOURCE &&
      frame.sourceSha256 === currentSourceSha.get(ZORO_ACTION_SOURCE) &&
      frame.sha256 === sha256File(file) && frame.bytes === fs.statSync(file).size,
    `Active Zoro action frame differs from action manifest: ${pose}`);
  }

  const zoroWalk = roomWalk.items.filter(item => item.key === 'zoro');
  assert(zoroWalk.length === 1 && zoroWalk[0].asset === ZORO_WALK2_ASSET,
    'Grounded walk manifest lacks exactly one Zoro frame.');

  const overlayExists = fs.existsSync(ZORO_OVERLAY_PATH);
  const overlay = overlayExists
    ? readJson(ZORO_OVERLAY_PATH, '1.1.12 Zoro art overlay')
    : { schema: 1, version: '1.1.12', character: 'zoro', status: 'candidate',
      historicalManifestSha256: ZORO_HISTORICAL_MANIFEST_SHA256, sources: [], assets: [] };
  assertExactJson(sorted(Object.keys(overlay)), sorted([
    'schema', 'version', 'character', 'status', 'historicalManifestSha256', 'sources', 'assets'
  ]), 'Zoro overlay keys');
  assert(overlay.schema === 1 && overlay.version === '1.1.12' && overlay.character === 'zoro' &&
    ['candidate', 'verified'].includes(overlay.status), 'Zoro overlay identity or status is invalid.');
  assertExactJson(overlay.historicalManifestSha256, ZORO_HISTORICAL_MANIFEST_SHA256,
    'Zoro overlay historical manifest digests');
  assert(Array.isArray(overlay.sources) && Array.isArray(overlay.assets),
    'Zoro overlay must contain source and asset arrays.');

  if (overlay.status === 'candidate') {
    assert(overlay.sources.length === 0 && overlay.assets.length === 0,
      'Candidate Zoro overlay cannot assert unverified art.');
    assert(changedSourcePaths.length === 0 && changedAssetPaths.every(asset => asset === ZORO_WALK2_ASSET),
      'Zoro art changed before a verified overlay was produced.');
    return { status: 'candidate', sources: new Set(), assets: new Set() };
  }

  assertExactJson(changedSourcePaths, sorted([ZORO_ACTION_SOURCE, ZORO_CHIBI_SOURCE]),
    'Verified Zoro source changes');
  assert(changedAssetPaths.includes(ZORO_CHIBI_ASSET) &&
    changedAssetPaths.some(asset => ZORO_ACTION_ASSETS.includes(asset)),
  'Verified Zoro overlay requires changed chibi and action art.');
  assert(zoroWalk[0].sourcePng === ZORO_ACTION_SOURCE &&
    zoroWalk[0].sourceSha256 === currentSourceSha.get(ZORO_ACTION_SOURCE),
  'Grounded Zoro walk source must be the corrected atlas.');
  const expectedSources = changedSourcePaths.map(source => ({
    path: source,
    sha256: currentSourceSha.get(source),
    bytes: fs.statSync(path.join(ROOT, ...source.split('/'))).size
  }));
  const expectedAssets = changedAssetPaths.map(asset => {
    const file = path.join(ROOT, ...asset.split('/'));
    const sourcePng = asset === ZORO_CHIBI_ASSET ? ZORO_CHIBI_SOURCE
      : activeFrameByAsset.get(asset).sourcePng;
    return { path: asset, sha256: sha256File(file), bytes: fs.statSync(file).size,
      sourcePng, sourceSha256: currentSourceSha.get(sourcePng) };
  });
  assertExactJson(overlay.sources, expectedSources, 'Zoro overlay changed source set and digests');
  assertExactJson(overlay.assets, expectedAssets, 'Zoro overlay changed asset set and digests');
  const walkOverride = expectedAssets.find(item => item.path === ZORO_WALK2_ASSET);
  assert(walkOverride && walkOverride.sha256 === zoroWalk[0].assetSha256 &&
    walkOverride.bytes === zoroWalk[0].assetBytes,
  'Zoro walk overlay differs from grounded walk manifest.');
  return { status: 'verified', sources: new Set(changedSourcePaths), assets: new Set(changedAssetPaths) };
}

function validateSourcePackage() {
  const packageJson = readJson(PACKAGE_PATH, 'desktop/package.json');
  const packageLock = readJson(PACKAGE_LOCK_PATH, 'desktop/package-lock.json');
  const luffyArtEnabled = require('../desktop/launcher-room-motion.js').LUFFY_ART_ENABLED === true;
  assert(luffyArtEnabled && packageJson.version === '1.2.16',
    'Luffy art gate must remain enabled in launcher 1.2.16.');
  assert(packageLock.version === packageJson.version && packageLock.packages?.['']?.version === packageJson.version, 'package-lock launcher version differs from package.json.');
  const announcementConfig = readJson(path.join(ROOT, 'config/launcher-announcements-v1.json'), 'launcher announcements');
  require('../server/launcher-announcements').validateConfig(announcementConfig);
  const loadingAnnouncement = announcementConfig.announcements.find(item => item.id === 'launcher-1.2.9-loading-optimization');
  assert(loadingAnnouncement?.status === 'published' && loadingAnnouncement.scope === 'launcher' &&
    loadingAnnouncement.version === '1.2.9' &&
    loadingAnnouncement.requiredRelease?.kind === 'launcher' &&
    loadingAnnouncement.requiredRelease?.version === '1.2.9',
  'Launcher 1.2.9 announcement must be gated to this release.');
  const roomFixAnnouncement = announcementConfig.announcements.find(item => item.id === 'launcher-1.2.10-shop-and-room-visuals');
  assert(roomFixAnnouncement?.status === 'published' && roomFixAnnouncement.scope === 'launcher' &&
    roomFixAnnouncement.version === '1.2.10' &&
    roomFixAnnouncement.requiredRelease?.kind === 'launcher' &&
    roomFixAnnouncement.requiredRelease?.version === '1.2.10',
  'Historical launcher 1.2.10 announcement changed.');
  const sceneMusicAnnouncement = announcementConfig.announcements.find(item => item.id === 'launcher-1.2.11-room-scenes-and-music');
  assert(sceneMusicAnnouncement?.status === 'published' && sceneMusicAnnouncement.scope === 'launcher' &&
    sceneMusicAnnouncement.version === '1.2.11' &&
    sceneMusicAnnouncement.requiredRelease?.kind === 'launcher' &&
    sceneMusicAnnouncement.requiredRelease?.version === '1.2.11',
  'Historical launcher 1.2.11 scene and music announcement changed.');
  const roomWeatherAnnouncement = announcementConfig.announcements.find(item => item.id === 'launcher-1.2.12-room-weather-and-arrangement');
  assert(roomWeatherAnnouncement?.status === 'published' && roomWeatherAnnouncement.scope === 'launcher' &&
    roomWeatherAnnouncement.version === '1.2.12' &&
    roomWeatherAnnouncement.requiredRelease?.kind === 'launcher' &&
    roomWeatherAnnouncement.requiredRelease?.version === '1.2.12',
  'Historical launcher 1.2.12 room weather announcement changed.');
  const crewLifeAnnouncement = announcementConfig.announcements.find(item => item.id === 'launcher-1.2.13-character-life-and-dialogue');
  assert(crewLifeAnnouncement?.status === 'published' && crewLifeAnnouncement.scope === 'launcher' &&
    crewLifeAnnouncement.version === '1.2.13' &&
    crewLifeAnnouncement.requiredRelease?.kind === 'launcher' &&
    crewLifeAnnouncement.requiredRelease?.version === '1.2.13',
  'Historical launcher 1.2.13 character life announcement changed.');
  const proportionAnnouncement = announcementConfig.announcements.find(item => item.id === 'launcher-1.2.14-luffy-proportions');
  assert(proportionAnnouncement?.status === 'published' && proportionAnnouncement.scope === 'launcher' &&
    proportionAnnouncement.version === '1.2.14' &&
    proportionAnnouncement.requiredRelease?.kind === 'launcher' &&
    proportionAnnouncement.requiredRelease?.version === '1.2.14' &&
    proportionAnnouncement.image?.asset === 'images/launcher_announcements/launcher-proportions-1.2.14.webp',
  'Launcher 1.2.14 proportion announcement must be illustrated and gated to this release.');
  const fishingAnnouncement = announcementConfig.announcements.find(item => item.id === 'launcher-1.2.15-fishing-and-living-seas');
  assert(fishingAnnouncement?.status === 'published' && fishingAnnouncement.scope === 'launcher' &&
    fishingAnnouncement.version === '1.2.15' &&
    fishingAnnouncement.requiredRelease?.kind === 'launcher' &&
    fishingAnnouncement.requiredRelease?.version === '1.2.15' &&
    fishingAnnouncement.image?.asset === 'images/launcher_announcements/launcher-life-fishing-1.2.15.webp',
  'Historical launcher 1.2.15 fishing announcement must remain illustrated and release gated.');
  const fishingPlayAnnouncement = announcementConfig.announcements.find(item => item.id === 'launcher-1.2.16-fishing-play-and-unlimited-challenges');
  assert(fishingPlayAnnouncement?.status === 'published' && fishingPlayAnnouncement.scope === 'launcher' &&
    fishingPlayAnnouncement.version === packageJson.version &&
    fishingPlayAnnouncement.requiredRelease?.kind === 'launcher' &&
    fishingPlayAnnouncement.requiredRelease?.version === packageJson.version &&
    fishingPlayAnnouncement.image?.asset === `images/launcher_announcements/${FISHING_V1216_ANNOUNCEMENT.asset}`,
  'Launcher 1.2.16 fishing and unlimited challenges announcement must be illustrated and release gated.');
  assert(packageJson.main === 'main.js', 'desktop/package.json must use main.js as the entrypoint.');
  assert(packageJson.build?.asar === true, 'Desktop app must be packed into ASAR.');
  assert(packageJson.build?.appId === 'com.onepiece.tabletop.desktop', 'Desktop appId changed unexpectedly.');
  assert(packageJson.build?.productName === 'ONE PIECE TABLETOP SERIES 啟動器', 'Desktop product name changed unexpectedly.');
  assertExactJson(packageJson.build?.files, APP_FILES, 'build.files');
  assertExactJson(packageJson.build?.extraResources, EXTRA_RESOURCES, 'build.extraResources');
  assertExactJson(packageJson.dependencies, { 'socket.io-client': '4.8.1' }, 'Runtime dependencies');
  assert(packageLock.packages?.['']?.dependencies?.['socket.io-client'] === '4.8.1', 'package-lock does not pin the approved socket.io-client dependency.');
  assert(packageLock.packages?.['node_modules/socket.io-client']?.version === '4.8.1', 'package-lock resolved socket.io-client to an unexpected version.');

  // Exercise the real resolver so packed-but-unreachable scenery cannot pass.
  const resolverSource = fs.readFileSync(path.join(DESKTOP_ROOT, 'main.js'), 'utf8')
    .match(/function resolveLauncherResource\(requestUrl\) \{[\s\S]*?\r?\n\}/)?.[0];
  assert(resolverSource, 'Launcher resource resolver was not found.');
  const resolveScene = require('node:vm').runInNewContext(`(${resolverSource})`, {
    URL, path, LAUNCHER_SCHEME: 'opui', launcherResourceRoot: () => path.join(ROOT, 'public')
  });
  for (const key of ['crew-cabin', 'sunny-deck', 'sunny-kitchen', 'sunny-library']) {
    const relative = `images/launcher_room/scenes/${key}-v2.webp`;
    assert(resolveScene(`opui://launcher/${relative}`) === path.resolve(ROOT, 'public', relative), `Room scene is blocked by the packaged protocol: ${key}`);
  }
  for (const asset of ROOM_HD_REVIEW.ASSETS) {
    const relative = asset.replace(/^public\//, '');
    assert(resolveScene(`opui://launcher/${relative}`) === path.resolve(ROOT, asset), `HD room atlas is blocked by the packaged protocol: ${relative}`);
  }
  for (const asset of ROOM_RESERVED_REVIEW.ASSETS) {
    const relative = asset.replace(/^public\//, '');
    assert(resolveScene(`opui://launcher/${relative}`) === path.resolve(ROOT, asset), `Reserved atlas blocked by packaged protocol: ${relative}`);
  }
  for (const item of ACE_V2_MANIFEST.items) {
    const relative = item.path.replace(/^public\//, '');
    assert(resolveScene(`opui://launcher/${relative}`) === path.resolve(ROOT, item.path), `Ace v2 atlas blocked by packaged protocol: ${relative}`);
  }
  for (const asset of [...RADIAL_PRESENTATION.ROBIN_ASSETS, ...RADIAL_PRESENTATION.MINIGAME_ASSETS, ...RADIAL_PRESENTATION.EXPANSION_ASSETS]) {
    const relative = asset.replace(/^public\//, '');
    assert(resolveScene(`opui://launcher/${relative}`) === path.resolve(ROOT, asset), `New reviewed room art blocked by packaged protocol: ${relative}`);
  }
  for (const relative of ['robin_v2/walk/diagonal.webp','robin_v2/life/sleep-east.webp','minigames_v1/unknown.webp']) {
    assert(resolveScene(`opui://launcher/images/launcher_room/${relative}`) === null, `Unreviewed 1.2.7 resource admitted: ${relative}`);
  }
  for (const relative of ['scenes/sunny-unknown.webp','furniture/supply-rack-extra.webp','furniture_views/repair-cart/4.webp','furniture_views/log-pose-desk/unknown.webp']) {
    assert(resolveScene(`opui://launcher/images/launcher_room/${relative}`) === null, `Unreviewed 1.2.8 resource admitted: ${relative}`);
  }
  for (const relative of ['reserved_v1/unknown/portrait.webp', 'reserved_v1/ace/walk/diagonal.webp', 'reserved_v1/law/life/cook-south.webp', 'reserved_v1/hancock/life/sleep-east.webp', 'reserved_v2/sabo/portrait.webp', 'reserved_v2/ace/walk/diagonal.webp']) {
    assert(resolveScene(`opui://launcher/images/launcher_room/${relative}`) === null, `Unknown reserved path admitted: ${relative}`);
  }
  for (const relative of LUFFY_NEW_ASSETS) {
    const pathPart = `images/launcher_room/${relative}`;
    assert(resolveScene(`opui://launcher/${pathPart}`) === path.resolve(ROOT, 'public', pathPart), `Luffy candidate path is blocked by the packaged protocol: ${relative}`);
  }
  for (const relative of ROOM_NEW_V1215_ASSETS) {
    const pathPart = `images/launcher_room/${relative}`;
    assert(resolveScene(`opui://launcher/${pathPart}`) === path.resolve(ROOT, 'public', pathPart), `1.2.15 room art is blocked by packaged protocol: ${relative}`);
  }
  assertExactJson(sorted(fs.readdirSync(path.join(PUBLIC_ROOT, 'images/launcher_room/fishing_v2'))),
    sorted(FISHING_V1216_ART.map(item => path.basename(item.asset))), 'Launcher 1.2.16 fishing art source set');
  for (const item of FISHING_V1216_ART) {
    const pathPart = `images/launcher_room/${item.asset}`;
    const source = path.join(PUBLIC_ROOT, pathPart);
    assert(fs.statSync(source).size === item.bytes && sha256File(source) === item.sha256,
      `Launcher 1.2.16 fishing art differs from reviewed GPT output: ${item.asset}`);
    assert(resolveScene(`opui://launcher/${pathPart}`) === source,
      `Launcher 1.2.16 fishing art is blocked by packaged protocol: ${item.asset}`);
  }
  assert(resolveScene('opui://launcher/images/launcher_room/fishing_v2/unknown.webp') === null,
    'Unknown Launcher 1.2.16 fishing art was admitted by packaged protocol.');
  const v1215Art = readJson(path.join(ROOT, 'tools/launcher-room/release-v1215/manifest.json'), 'Launcher 1.2.15 art manifest');
  assert(v1215Art.schema === 'launcher-life-fishing-art/1' && v1215Art.release === '1.2.15' &&
    v1215Art.itemCount === ROOM_NEW_V1215_ASSETS.length && Array.isArray(v1215Art.items),
  'Launcher 1.2.15 art manifest identity or count differs.');
  assertExactJson(sorted(v1215Art.items.map(item => item.path)),
    sorted(ROOM_NEW_V1215_ASSETS.map(asset => `public/images/launcher_room/${asset}`)),
    'Launcher 1.2.15 reviewed art asset set');
  for (const item of [...v1215Art.items, v1215Art.announcement]) {
    assert(/^public\/images\/(?:launcher_room|launcher_announcements)\/[a-z0-9._/-]+\.webp$/.test(item.path) &&
      Number.isSafeInteger(item.bytes) && item.bytes > 0 && /^[a-f0-9]{64}$/.test(item.sha256) &&
      Array.isArray(item.dimensions) && item.dimensions.length === 2 && item.dimensions.every(value => Number.isInteger(value) && value > 0),
    `Invalid Launcher 1.2.15 art manifest entry: ${item.path}`);
    const file = path.join(ROOT, ...item.path.split('/'));
    assert(fs.statSync(file).size === item.bytes && sha256File(file) === item.sha256,
      `Launcher 1.2.15 art bytes or digest differ: ${item.path}`);
  }
  assert(v1215Art.announcement.path === 'public/images/launcher_announcements/launcher-life-fishing-1.2.15.webp',
    'Launcher 1.2.15 announcement image differs from reviewed asset.');
  const previewRosterPath = path.join(ROOT, 'tools/launcher-room/reserved-v3/roster.json');
  const previewRoster = readJson(previewRosterPath, '1.2.15 locked preview roster');
  const previewManifest = readJson(path.join(ROOT, 'tools/launcher-room/reserved-v3/preview-manifest.json'), '1.2.15 locked preview manifest');
  assert(previewRoster.schema === 'one-piece-launcher-future-crew/1' && previewRoster.notReleaseAuthority === true &&
    previewRoster.characterCount === 10 && previewManifest.schema === 'one-piece-locked-crew-previews/1' &&
    previewManifest.characterCount === 10 && previewManifest.rosterSha256 === sha256File(previewRosterPath),
  'Ten locked preview roster identity or source hash differs.');
  assertExactJson(sorted(Object.keys(previewRoster.characters)), sorted(ROOM_LOCKED_V1215_PREVIEW_KEYS), 'Ten locked roster keys');
  assertExactJson(sorted(Object.keys(previewManifest.previews)), sorted(ROOM_LOCKED_V1215_PREVIEW_KEYS), 'Ten locked preview keys');
  for (const key of ROOM_LOCKED_V1215_PREVIEW_KEYS) {
    const character = previewRoster.characters[key];
    const item = previewManifest.previews[key];
    const relative = `public/images/launcher_room/reserved_v3_previews/${key}.webp`;
    assert(character.locked === true && character.runtimeEligible === false && character.availableForPurchase === false &&
      item.path === relative && item.releaseStatus === 'locked-art-preview-only' && item.runtimeAnimationComplete === false,
    `Locked candidate was marked playable or has an invalid preview path: ${key}`);
    assert(fs.statSync(path.join(ROOT, ...relative.split('/'))).size === item.bytes &&
      sha256File(path.join(ROOT, ...relative.split('/'))) === item.sha256,
    `Locked candidate preview bytes or digest differ: ${key}`);
  }
  const viviCandidate = readJson(path.join(ROOT, 'tools/launcher-room/reserved-v3/manifests/vivi.json'), '1.2.15 Vivi locked art candidate');
  assert(viviCandidate.character === 'vivi' && viviCandidate.runtimeEligible === false &&
    viviCandidate.availableForPurchase === false && viviCandidate.releasePolicy === 'locked-art-candidate',
  'Vivi candidate must remain locked.');
  assertExactJson(sorted(viviCandidate.items.map(item => item.asset.replace(/^public\/images\/launcher_room\//, ''))),
    sorted(ROOM_LOCKED_V1215_VIVI_ASSETS), 'Vivi candidate atlas set');
  for (const item of viviCandidate.items) {
    const source = path.join(ROOT, ...item.asset.split('/'));
    assert(fs.statSync(source).size === item.bytes && sha256File(source) === item.sha256,
      `Vivi candidate atlas differs from reviewed source: ${item.asset}`);
    assert(resolveScene(`opui://launcher/${item.asset.replace(/^public\//, '')}`) === source,
      `Vivi locked candidate is blocked by packaged protocol: ${item.asset}`);
  }
  assert(resolveScene('opui://launcher/images/launcher_room/reserved_v3_previews/unknown.webp') === null,
    'Unknown locked candidate preview was admitted by packaged protocol.');
  assert(resolveScene('opui://launcher/images/launcher_announcements/launcher-life-fishing-1.2.15.webp') ===
    path.resolve(ROOT, 'public/images/launcher_announcements/launcher-life-fishing-1.2.15.webp'),
  '1.2.15 announcement art is blocked by packaged protocol.');
  const fishingPlayArtPath = path.join(PUBLIC_ROOT, 'images/launcher_announcements', FISHING_V1216_ANNOUNCEMENT.asset);
  assert(fs.statSync(fishingPlayArtPath).size === FISHING_V1216_ANNOUNCEMENT.bytes &&
    sha256File(fishingPlayArtPath) === FISHING_V1216_ANNOUNCEMENT.sha256,
  'Launcher 1.2.16 illustrated announcement differs from reviewed art.');
  assert(resolveScene(`opui://launcher/images/launcher_announcements/${FISHING_V1216_ANNOUNCEMENT.asset}`) === fishingPlayArtPath,
    'Launcher 1.2.16 announcement art is blocked by packaged protocol.');
  for (const relative of ['motion_v4/unknown/east.webp', 'acting_v4/luffy/unknown.webp', 'motion_v5/zoro/east.webp', 'life_hd_v3/zoro/work-east.webp', 'portrait_v4/zoro.webp']) {
    assert(resolveScene(`opui://launcher/images/launcher_room/${relative}`) === null, `Unreviewed HD room atlas was admitted: ${relative}`);
  }
  for (const url of ['opui://launcher/images/launcher_room/scenes/unknown-v2.webp',
    'opui://launcher/images/launcher_room/scenes/crew-cabin-v3.webp',
    'opui://other/images/launcher_room/scenes/crew-cabin-v2.webp']) {
    assert(resolveScene(url) === null, `Unexpected room resource was admitted: ${url}`);
  }

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
  const cursorDefault = validateCursorPng(path.join(PUBLIC_ROOT, 'images', 'desktop_launcher', 'launcher_cursor_logpose_default_v1.png'), 'Default Log Pose launcher cursor');
  const cursorPointer = validateCursorPng(path.join(PUBLIC_ROOT, 'images', 'desktop_launcher', 'launcher_cursor_logpose_pointer_v1.png'), 'Pointer Log Pose launcher cursor');
  const cursorPressed = validateCursorPng(path.join(PUBLIC_ROOT, 'images', 'desktop_launcher', 'launcher_cursor_logpose_pressed_v1.png'), 'Pressed Log Pose launcher cursor');

  for (const [directory, resourceTo, manifestName, outputPrefix] of [
    [path.join(PUBLIC_ROOT, 'images', 'profile_decor'), 'launcher-assets/images/profile_decor', 'LAUNCHER_PROFILE_ART_20260924.json', 'public/images/profile_decor/'],
    [path.join(PUBLIC_ROOT, 'audio', 'profile_bgm'), 'launcher-assets/audio/profile_bgm', 'LAUNCHER_PROFILE_BGM_20260924.json', 'public/audio/profile_bgm/']
  ]) {
    const resource = EXTRA_RESOURCES.find((entry) => entry.to === resourceTo);
    assertExactJson(sorted(fs.readdirSync(directory)), sorted(resource.filter), `${resourceTo} source file set`);
    const manifest = readJson(path.join(ROOT, 'docs', manifestName), manifestName);
    assert(Array.isArray(manifest.items) && manifest.items.length === resource.filter.length, `${manifestName} item count differs from the package.`);
    for (const item of manifest.items) {
      assert(typeof item.output === 'string' && item.output.startsWith(outputPrefix), `${manifestName} contains a path outside ${outputPrefix}.`);
      assert(resource.filter.includes(path.basename(item.output)), `${manifestName} references an unapproved file.`);
      assert(sha256File(path.join(ROOT, ...item.output.split('/'))) === item.outputSha256 ||
        sha256File(path.join(ROOT, ...item.output.split('/'))) === item.sha256, `${manifestName} digest differs: ${item.output}`);
    }
  }
  const artManifest = readJson(path.join(ROOT, 'docs', 'LAUNCHER_PROFILE_ART_20260924.json'), 'launcher profile source art manifest');
  assert(artManifest.sourceDirectory === 'tools/launcher-profile/source-png', 'Profile art source directory changed.');
  const artSourceRoot = path.join(ROOT, ...artManifest.sourceDirectory.split('/'));
  assertExactJson(sorted(fs.readdirSync(artSourceRoot)), sorted(artManifest.items.map((item) => item.sourceFile)), 'GPT source PNG file set');
  for (const item of artManifest.items) {
    assert(/^exec-[a-f0-9-]+\.png$/.test(item.sourceFile), `Profile art source file name is unsafe: ${item.sourceFile}`);
    assert(sha256File(path.join(artSourceRoot, item.sourceFile)) === item.sourceSha256, `GPT source PNG digest differs: ${item.sourceFile}`);
  }
  const avatarManifest = readJson(path.join(ROOT, 'docs', 'LAUNCHER_AVATARS_20260925.json'), 'launcher avatar manifest');
  assert(Array.isArray(avatarManifest.items) && avatarManifest.items.length === 12, 'New avatar manifest must contain 12 characters.');
  assertExactJson(sorted(avatarManifest.items.map((item) => String(item.avatarId))),
    sorted(Array.from({ length: 12 }, (_, index) => String(index + 51))), 'New avatar IDs');
  for (const item of avatarManifest.items) {
    assert(item.sourcePng.startsWith('tools/launcher-profile/avatar-source-png/'), `Avatar PNG source path is unsafe: ${item.sourcePng}`);
    assert(item.asset === `public/images/board/avatars/${item.avatarId}.webp`, `Avatar output path differs: ${item.avatarId}`);
    assert(sha256File(path.join(ROOT, ...item.sourcePng.split('/'))) === item.sourceSha256, `Avatar PNG digest differs: ${item.avatarId}`);
    assert(sha256File(path.join(ROOT, ...item.asset.split('/'))) === item.assetSha256, `Avatar WebP digest differs: ${item.avatarId}`);
  }
  const roomManifest = readJson(path.join(ROOT, 'docs', 'LAUNCHER_ROOM_ART_20260925.json'), 'launcher room art manifest');
  const roomResource = EXTRA_RESOURCES.find(resource => resource.to === 'launcher-assets/images/launcher_room');
  if (luffyArtEnabled) {
    const manifest = readJson(path.join(ROOT, 'tools/launcher-room/luffy-v1214/manifest.json'), 'Luffy 1.2.14 art manifest');
    assert(manifest.schema === 'launcher-luffy-art/1' && manifest.visualAccepted === true &&
      Array.isArray(manifest.items) && manifest.items.length === 17,
    'Luffy art gate requires 17 reviewed atlas entries.');
    assertExactJson(sorted(manifest.items.map(item => item.path.replace(/^public\/images\/launcher_room\//, ''))),
      sorted(LUFFY_NEW_ASSETS), 'Luffy reviewed art asset set');
    assertExactJson(sorted(roomResource.filter.filter(asset => LUFFY_NEW_ASSET_SET.has(asset))),
      sorted(LUFFY_NEW_ASSETS), 'Luffy packaged art asset set');
    for (const item of manifest.items) {
      assert(/^public\/images\/launcher_room\/(?:motion_v5\/luffy\/(?:east|west|north|south)|acting_v5\/luffy\/(?:east|west|north|south)|life_hd_v3\/luffy\/(?:work-(?:east|west|north|south)|(?:eat|rest|sleep|train)-south)|portrait_v4\/luffy)\.webp$/.test(item.path),
        `Unsafe Luffy art path: ${item.path}`);
      const asset = path.join(ROOT, ...item.path.split('/'));
      assert(Number.isSafeInteger(item.bytes) && item.bytes > 0 && /^[a-f0-9]{64}$/.test(item.sha256) &&
        fs.statSync(asset).size === item.bytes && sha256File(asset) === item.sha256,
      `Luffy art digest differs: ${item.path}`);
    }
  } else {
    assert(roomResource.filter.every(asset => !LUFFY_NEW_ASSET_SET.has(asset)),
      'Disabled Luffy art must not enter the 1.2.13 package.');
  }
  assert(roomManifest.version === '1.1.9' && roomManifest.canonicalCharactersOnly === true,
    'Room art manifest is not the approved canonical-character release.');
  const roomExpansion = readJson(path.join(ROOT, 'docs', 'LAUNCHER_ROOM_EXPANSION_ART_20260925.json'), 'launcher room expansion art manifest');
  assert(roomExpansion.version === '1.1.10' && roomExpansion.canonicalCharactersOnly === true,
    'Room expansion manifest must identify the canonical release.');
  const roomDepth = readJson(path.join(ROOT, 'docs', 'LAUNCHER_ROOM_DEPTH_ART_20260925.json'), 'launcher room depth/action art manifest');
  const roomWalk = readJson(path.join(ROOT, 'docs', 'LAUNCHER_ROOM_WALK_ART_20260925.json'), 'launcher grounded walk art manifest');
  const roomBody = readJson(path.join(ROOT, 'docs', 'LAUNCHER_ROOM_FULLBODY_ART_20260927.json'), 'complete character pose manifest');
  const roomGait = readJson(path.join(ROOT, 'docs', 'LAUNCHER_ROOM_WALK_V3_20260927.json'), 'complete character walking manifest');
  const roomScale = readJson(path.join(ROOT, 'docs', 'LAUNCHER_ROOM_SCALE_ART_20260927.json'), 'room scale background manifest');
  assert(roomScale.version === '1.1.16' && roomScale.generator === 'OpenAI built-in image_gen' && roomScale.items?.length === 4,
    'Room scale manifest must cover four GPT room-specific background plates.');
  assertExactJson(sorted(roomScale.items.map(item => item.key)), sorted(['crew-cabin', 'sunny-deck', 'sunny-kitchen', 'sunny-library']), 'Room scale background key set');
  for (const item of roomScale.items) {
    assert(item.asset === `public/images/launcher_room/scenes/${item.key}-v2.webp`, `Unexpected room-specific scene: ${item.key}`);
    assertExactJson(item.assetPixels, [1600, 900], `Room scale scene dimensions: ${item.key}`);
    for (const [field, hashField, suffix] of [['sourcePng', 'sourceSha256', 'source.png'], ['prompt', 'promptSha256', 'prompt.txt'], ['receipt', 'receiptSha256', 'receipt.json']]) {
      assert(item[field] === `tools/launcher-room/scene-v2/${item.key}/${suffix}`, `Room scene source identity differs: ${item.key}/${field}`);
      assert(sha256File(path.join(ROOT, item[field])) === item[hashField], `Room scene source digest differs: ${item.key}/${field}`);
    }
    const scenePath = path.join(ROOT, item.asset);
    assert(fs.statSync(scenePath).size === item.assetBytes && sha256File(scenePath) === item.assetSha256, `Room scene output differs: ${item.key}`);
  }
  assert(roomScale.visualReviewStatus === 'PASS_WITH_NOTES' && Array.isArray(roomScale.dependencies), 'Room scale visual review is required.');
  const scaleReviewPath = 'tools/launcher-room/scene-v2/final-visual-review.json';
  assert(roomScale.dependencies.some(item => item.path === scaleReviewPath), 'Missing hash-bound room scale visual review.');
  for (const item of [...roomScale.dependencies, ...roomScale.preserved]) {
    assert(typeof item.path === 'string' && !item.path.includes('..') && !path.isAbsolute(item.path), 'Unsafe room scale dependency.');
    assert(sha256File(path.join(ROOT, item.path)) === item.sha256, `Room scale dependency changed: ${item.path}`);
  }
  const scaleReview = readJson(path.join(ROOT, scaleReviewPath), 'room scale visual review');
  assert(scaleReview.status === 'PASS_WITH_NOTES' && scaleReview.blockingIssues.length === 0, 'Room scale visual review has unresolved issues.');
  assert(scaleReview.runtimeHashNormalization === 'CRLF to LF only; all other bytes remain significant', 'Unexpected room review hash normalization.');
  // The complete 1.2.8 gate was rerun against its immutable release commit.
  // Current 1.2.9 sources are checked below; they must not be passed to the
  // historical gate as though they were the original reviewed release.
  assert(sha256File(path.join(ROOT, HISTORICAL_V128_STATUS)) === HISTORICAL_V128_STATUS_SHA256,
    'Historical 1.2.8 acceptance receipt changed.');
  const historicalV128 = readJson(path.join(ROOT, HISTORICAL_V128_STATUS), 'historical 1.2.8 acceptance');
  assert(historicalV128.schema === 'launcher-historical-v128-status/1' &&
    historicalV128.sourceCommit === HISTORICAL_V128_COMMIT && historicalV128.validated === true &&
    historicalV128.humanAcceptance === false && historicalV128.reviewSha256 === HISTORICAL_V128_REVIEW_SHA256,
  'Historical 1.2.8 acceptance is invalid.');
  assert(sha256File(path.join(ROOT, RADIAL_PRESENTATION.REVIEW_PATH)) === HISTORICAL_V128_REVIEW_SHA256,
    'Historical 1.2.8 release review changed.');
  const presentationStatus = historicalV128.status;
  const lifeStatus = presentationStatus.life;
  for (const [file, digest] of Object.entries(scaleReview.runtime)) {
    const reviewedBytes = childProcess.execFileSync('git', ['cat-file', 'blob', `${HISTORICAL_V128_COMMIT}:${file}`],
      { cwd: ROOT, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }).toString('utf8').replace(/\r\n/g, '\n');
    // All historical art reviews remain immutable. The presentation gate has
    // validated their original runtime and binds this release's current UI.
    assert(crypto.createHash('sha256').update(reviewedBytes).digest('hex') === (presentationStatus.review.runtime[file] || digest), `Room runtime differs from reviewed source: ${file}`);
  }
  const roomMotion = { items: [...roomBody.items, ...roomGait.items], portraits: roomBody.portraits };
  assert(roomBody.version === '1.1.15' && roomGait.version === '1.1.15' &&
    roomBody.canonicalCharactersOnly === true && roomGait.canonicalCharactersOnly === true &&
    roomMotion.items.length === ROOM_MOTION_ASSETS.length,
  'Full-body manifests must cover all eighty canonical walking and acting direction atlases.');
  assertExactJson(sorted(roomMotion.items.map(item => item.asset.replace(/^public\/images\/launcher_room\//, ''))),
    sorted(ROOM_MOTION_ASSETS), 'Room motion atlas set');
  const roomMotionStatus = require('../tools/launcher-room/validate-fullbody-release').validate(ROOT);
  assert(roomWalk.version === '1.1.12' && roomWalk.canonicalCharactersOnly === true &&
    Array.isArray(roomWalk.items) && roomWalk.items.length === 8,
  'Grounded walk manifest must cover eight canonical GPT poses.');
  const groundedWalkKeys = sorted(['luffy', 'zoro', 'nami', 'usopp', 'sanji', 'chopper', 'robin', 'brook']);
  assertExactJson(sorted(roomWalk.items.map(item => item.key)), groundedWalkKeys, 'Grounded walk character set');
  const groundedWalkByAsset = new Map();
  for (const item of roomWalk.items) {
    assert(item.asset === `public/images/launcher_room/action_frames/${item.key}/walk2.webp`, `Unexpected grounded walk path: ${item.asset}`);
    assert([`tools/launcher-room/action-source-png/${item.key}.png`,
      `tools/launcher-room/action-source-png/${item.key}-walk2-grounded.png`].includes(item.sourcePng),
    `Unexpected grounded walk source: ${item.sourcePng}`);
    assert(Array.isArray(item.sourceRegion) && item.sourceRegion.length === 4 &&
      item.sourceRegion.every(Number.isInteger), `Invalid grounded walk crop: ${item.key}`);
    assertExactJson(item.assetPixels, [256, 256], `Grounded walk dimensions: ${item.key}`);
    const sourcePath = path.join(ROOT, ...item.sourcePng.split('/'));
    const assetPath = path.join(ROOT, ...item.asset.split('/'));
    assert(sha256File(sourcePath) === item.sourceSha256, `GPT grounded walk source differs: ${item.key}`);
    assert(fs.statSync(assetPath).size === item.assetBytes && sha256File(assetPath) === item.assetSha256,
      `Grounded walk frame differs: ${item.key}`);
    groundedWalkByAsset.set(item.asset, item);
  }
  assert(roomDepth.version === '1.1.11' && roomDepth.canonicalCharactersOnly === true,
    'Room depth/action manifest must identify the canonical release.');
  assert(Array.isArray(roomManifest.items) && roomManifest.items.length === 21 &&
    Array.isArray(roomExpansion.items) && roomExpansion.items.length === 44 &&
    Array.isArray(roomDepth.items) && roomDepth.items.length === ROOM_DEPTH_ASSETS.length,
    'Room art manifests must cover original, expansion, and 1.1.11 assets.');
  assertExactJson(sorted(roomDepth.items.map(item => item.asset.replace(/^public\/images\/launcher_room\//, ''))),
    sorted(ROOM_DEPTH_ASSETS), 'Room depth/action art asset set');
  const packagedLifeHistory = lifeStatus.manifest.items.filter(item =>
    ROOM_LIFE_FURNITURE.includes(item.asset.replace(/^public\/images\/launcher_room\//, '')));
  assert(packagedLifeHistory.length === ROOM_LIFE_FURNITURE.length, 'Historical stove resources are incomplete.');
  // v3 movement atlases remain in source for historical review, but the live
  // renderer uses v4/v5 and omits v3 from the update installer.
  assertExactJson(sorted([...roomManifest.items, ...roomExpansion.items, ...roomDepth.items, ...roomMotion.items, ...roomMotion.portraits, ...roomScale.items, ...packagedLifeHistory, ...presentationStatus.hd.manifest.items, ...presentationStatus.reserved.manifest.items, ...presentationStatus.newArt.manifest.items, ...ACE_V2_MANIFEST.items.map(item => ({asset: item.path}))].map(item => item.asset.replace(/^public\/images\/launcher_room\//, '')).filter(asset => !ROOM_MOTION_ASSETS.includes(asset) && !['scenes/sunny-deck.webp', 'scenes/sunny-kitchen.webp', 'scenes/sunny-library.webp', 'scenes/crew-cabin-v2.webp'].includes(asset))),
    sorted(roomResource.filter.filter(asset => !asset.startsWith('life_hd_v2/') && !LUFFY_NEW_ASSET_SET.has(asset) && !ROOM_NEW_V1215_SET.has(asset) && !FISHING_V1216_ART_SET.has(asset) && !ROOM_LOCKED_V1215_VIVI_SET.has(asset))), 'Historical room art manifest output set');
  assert(ACE_V2_MANIFEST.schema === 'launcher-ace-lean-art/1' && ACE_V2_MANIFEST.visualAccepted === true &&
    ACE_V2_MANIFEST.humanAcceptance === false && ACE_V2_MANIFEST.atlasCount === 17 &&
    ACE_V2_MANIFEST.frameCount === 81 && ACE_V2_MANIFEST.totalRuntimeBytes <= 4 * 1024 * 1024,
    'Ace v2 art manifest identity/size is invalid.');
  assertExactJson(sorted(ACE_V2_MANIFEST.items.map(item => item.path.replace(/^public\/images\/launcher_room\//, ''))),
    sorted(ACE_V2_ASSETS), 'Ace v2 reviewed asset set');
  for (const item of ACE_V2_MANIFEST.items) {
    assert(item.frames.length === (item.path.includes('/acting/') ? 8 : item.path.includes('/walk/') || item.path.includes('/life/') ? 4 : 1),
      `Ace v2 frame count mismatch: ${item.path}`);
    const asset = path.join(ROOT, ...item.path.split('/'));
    assert(fs.statSync(asset).size === item.bytes && sha256File(asset) === item.sha256,
      `Ace v2 art digest differs: ${item.path}`);
  }
  for (const item of ACE_V2_MANIFEST.sourceSheets) {
    const original = path.join(ROOT, ...item.path.split('/'));
    assert(fs.statSync(original).size === item.bytes && sha256File(original) === item.sha256,
      `Ace v2 GPT source digest differs: ${item.path}`);
  }
  const aceContact = path.join(ROOT, ...ACE_V2_MANIFEST.contact.path.split('/'));
  assert(fs.statSync(aceContact).size === ACE_V2_MANIFEST.contact.bytes &&
    sha256File(aceContact) === ACE_V2_MANIFEST.contact.sha256,
    'Ace v2 81-frame contact digest differs.');
  const lifeHd = readJson(path.join(ROOT, 'tools/launcher-room/life-hd-v2/manifest.json'), 'life HD source manifest');
  assert(lifeHd.schema === 'launcher-life-hd-art/1' && lifeHd.release === '1.2.10' &&
    lifeHd.count === 116 && lifeHd.newAtlasCellPixels === 256 && lifeHd.sourceAtlasCellPixels === 128 &&
    Array.isArray(lifeHd.assets) && lifeHd.assets.length === 116, 'Life HD manifest identity is invalid.');
  assertExactJson(sorted(lifeHd.assets.map(item => item.asset.replace(/^public\/images\/launcher_room\//, ''))),
    sorted(ROOM_LIFE_HD_ASSETS), 'Life HD manifest output set');
  for (const item of lifeHd.assets) {
    assert(/^public\/images\/launcher_room\/life_hd_v2\/[a-z]+\/[a-z]+-(?:east|west|north|south)\.webp$/.test(item.asset), `Unsafe life HD asset path: ${item.asset}`);
    assert(/^tools\/launcher-room\/life-v1\/[a-z-]+\/(?:proportion-repair\/)?(?:source(?:-alpha(?:-clean)?)?|east-fix-source-alpha)\.png$/.test(item.source), `Unsafe life HD source path: ${item.source}`);
    assert(/^tools\/launcher-room\/life-v1\/[a-z-]+\/plan\.json$/.test(item.plan), `Unsafe life HD plan path: ${item.plan}`);
    assert(item.scaleFromSource > 0 && item.scaleFromSource < 1 &&
      JSON.stringify(item.assetPixels) === '[1024,256]' && JSON.stringify(item.groundRoot) === '[128,224]',
      `Life HD cell geometry is invalid: ${item.asset}`);
    const assetPath = path.join(ROOT, ...item.asset.split('/'));
    assert(fs.statSync(assetPath).size === item.assetBytes && sha256File(assetPath) === item.assetSha256,
      `Life HD asset digest differs: ${item.asset}`);
    assert(sha256File(path.join(ROOT, ...item.source.split('/'))) === item.sourceSha256 &&
      sha256File(path.join(ROOT, ...item.plan.split('/'))) === item.planSha256,
      `Life HD original source digest differs: ${item.asset}`);
  }
  const zoroOverlay = validateZoroArtOverlay(roomManifest, roomDepth, roomWalk);
  const roomSourceRoot = path.join(ROOT, 'tools', 'launcher-room', 'source-png');
  for (const item of [...roomManifest.items, ...roomExpansion.items]) {
    assert(/^tools\/launcher-room\/source-png\/[a-z0-9-]+\.png$/.test(item.sourcePng), `Room source path is unsafe: ${item.sourcePng}`);
    assert(/^public\/images\/launcher_room\/(?:scenes|furniture|chibi|frames|emotions)\/[a-z0-9-]+\.webp$/.test(item.asset), `Room asset path is unsafe: ${item.asset}`);
    const source = path.join(ROOT, ...item.sourcePng.split('/'));
    const asset = path.join(ROOT, ...item.asset.split('/'));
    if (!zoroOverlay.sources.has(item.sourcePng)) {
      assert(sha256File(source) === item.sourceSha256, `GPT room source digest differs: ${item.sourcePng}`);
    }
    if (!zoroOverlay.assets.has(item.asset)) {
      assert(fs.statSync(asset).size === item.assetBytes && sha256File(asset) === item.assetSha256,
        `Packaged room art digest differs: ${item.asset}`);
    }
  }
  for (const item of roomDepth.items) {
    const assetRelative = item.asset.replace(/^public\/images\/launcher_room\//, '');
    const furniture = /^furniture_views\/([a-z0-9-]+)\/[0-3]\.webp$/.exec(assetRelative);
    const action = /^action_frames\/([a-z0-9-]+)\/([a-z0-9_]+)\.webp$/.exec(assetRelative);
    assert(furniture || action, `Room depth/action asset path is unsafe: ${item.asset}`);
    if (furniture) assert(ROOM_DEPTH_FURNITURE.includes(furniture[1]), `Unknown room furniture: ${item.asset}`);
    if (action) assert(ROOM_DEPTH_CHARACTERS.includes(action[1]) && ROOM_ACTION_POSES.includes(action[2]), `Unknown room action pose: ${item.asset}`);
    const sourceName = furniture ? furniture[1]
      : ROOM_DEPTH_ACTION_OVERRIDES.has(`${action[1]}/${action[2]}`) ? `${action[1]}-${action[2]}` : action[1];
    const sourcePng = `tools/launcher-room/${furniture ? 'furniture-source-png' : 'action-source-png'}/${sourceName}.png`;
    assert(item.sourcePng === sourcePng, `Room depth/action source does not match its asset: ${item.asset}`);
    const source = path.join(ROOT, ...sourcePng.split('/'));
    const asset = path.join(ROOT, ...item.asset.split('/'));
    if (!zoroOverlay.sources.has(sourcePng)) {
      assert(sha256File(source) === item.sourceSha256, `GPT room depth/action source digest differs: ${sourcePng}`);
    }
    if (!groundedWalkByAsset.has(item.asset) && !zoroOverlay.assets.has(item.asset)) {
      assert(fs.statSync(asset).size === item.assetBytes && sha256File(asset) === item.assetSha256,
        `Packaged room depth/action art digest differs: ${item.asset}`);
    }
  }
  const opManifest = readJson(path.join(ROOT, 'docs', 'LAUNCHER_OP_BGM_20260925.json'), 'launcher OP music manifest');
  const opResource = EXTRA_RESOURCES.find((resource) => resource.to === 'launcher-assets/audio/bgm');
  assert(Array.isArray(opManifest.items) && opManifest.items.length === 20, 'OP music manifest must contain 20 tracks.');
  assertExactJson(sorted(fs.readdirSync(path.join(PUBLIC_ROOT, 'audio', 'bgm'))), sorted(opResource.filter), 'OP music source set');
  for (const item of opManifest.items) {
    assert(item.asset === `public/audio/bgm/track${String(item.track).padStart(2, '0')}.mp3`, `OP music path differs: ${item.track}`);
    const filePath = path.join(ROOT, ...item.asset.split('/'));
    assert(fs.statSync(filePath).size === item.bytes && sha256File(filePath) === item.sha256, `OP music digest differs: ${item.track}`);
  }

  const catalogPath = path.join(PUBLIC_ROOT, 'desktop', 'catalog-v2.json');
  const catalog = readJson(catalogPath, 'public desktop catalog');
  assert(catalog.schema === 2 && catalog.games && typeof catalog.games === 'object', 'Desktop catalog has an unsupported schema.');
  const referencedManifests = [];
  for (const gameId of ['card', 'board', 'chess']) {
    const game = catalog.games[gameId];
    assert(game && typeof game === 'object', `Desktop catalog is missing ${gameId}.`);
    assert(new RegExp(`^desktop/manifests/${gameId}-assets-[a-f0-9]{16}\\.json$`).test(game.manifestPath), `${gameId} catalog manifest path is not immutable.`);
    const manifestPath = path.join(PUBLIC_ROOT, ...game.manifestPath.split('/'));
    assert(fs.statSync(manifestPath, { throwIfNoEntry: false })?.isFile(), `${gameId} manifest is missing: ${game.manifestPath}`);
    assert(sha256File(manifestPath) === game.manifestSha256, `${gameId} manifest digest differs from the catalog.`);
    referencedManifests.push(relativePosix(path.join(PUBLIC_ROOT, 'desktop', 'manifests'), manifestPath));
  }
  const catalogV3Path = path.join(PUBLIC_ROOT, 'desktop', 'catalog-v3.json');
  const catalogV3 = readJson(catalogV3Path, 'public desktop program catalog');
  assert(catalogV3.schema === 3 && catalogV3.games && typeof catalogV3.games === 'object', 'Desktop program catalog has an unsupported schema.');
  const referencedProgramManifests = [];
  for (const gameId of ['card', 'board', 'chess']) {
    const game = catalogV3.games[gameId];
    assert(game && typeof game === 'object', `Desktop program catalog is missing ${gameId}.`);
    assert(new RegExp(`^desktop/manifests/${gameId}-package-[a-f0-9]{16}\\.json$`).test(game.manifestPath), `${gameId} program manifest path is not immutable.`);
    assert(typeof game.entryPath === 'string' && game.entryPath.endsWith('.html'), `${gameId} program entryPath is invalid.`);
    const manifestPath = path.join(PUBLIC_ROOT, ...game.manifestPath.split('/'));
    assert(fs.statSync(manifestPath, { throwIfNoEntry: false })?.isFile(), `${gameId} program manifest is missing: ${game.manifestPath}`);
    assert(sha256File(manifestPath) === game.manifestSha256, `${gameId} program manifest digest differs from catalog-v3.`);
    const manifest = readJson(manifestPath, `${gameId} desktop program manifest`);
    assert(manifest.schema === 3 && manifest.gameId === gameId, `${gameId} program manifest schema is invalid.`);
    assert(manifest.releaseId === game.releaseId && manifest.entryPath === game.entryPath, `${gameId} program identity differs from catalog-v3.`);
    referencedProgramManifests.push(relativePosix(path.join(PUBLIC_ROOT, 'desktop', 'manifests'), manifestPath));
  }
  for (const [gameId, expected] of Object.entries(STABLE_GAME_MANIFESTS)) {
    assert(catalog.games[gameId].manifestPath === expected.manifestPath, `${gameId} manifest path changed during the Chess release.`);
    assert(catalog.games[gameId].manifestSha256 === expected.manifestSha256, `${gameId} immutable manifest bytes changed during the Chess release.`);
  }
  const manifestDirectory = path.join(PUBLIC_ROOT, 'desktop', 'manifests');
  const actualManifests = sorted(listFilesRecursive(manifestDirectory).map((filePath) => relativePosix(manifestDirectory, filePath)));
  const requiredManifests = new Set([...referencedManifests, ...referencedProgramManifests, ...Object.keys(RETAINED_ROLLOUT_MANIFESTS)]);
  for (const fileName of requiredManifests) assert(actualManifests.includes(fileName), `Required rollout manifest is missing: ${fileName}`);
  for (const fileName of actualManifests) {
    assert(requiredManifests.has(fileName) || /^(?:card|board|chess)-package-[a-f0-9]{16}\.json$/.test(fileName), `Unapproved manifest name: ${fileName}`);
  }
  for (const [fileName, expectedSha256] of Object.entries(RETAINED_ROLLOUT_MANIFESTS)) {
    const retainedPath = path.join(manifestDirectory, fileName);
    assert(sha256File(retainedPath) === expectedSha256, `Retained rollout manifest changed: ${fileName}`);
  }

  const forbiddenText = JSON.stringify({ files: packageJson.build.files, extraResources: packageJson.build.extraResources }).toLowerCase();
  for (const forbidden of ['../public/images/**', '../public/audio/**', '../public/videos/**', '../public/fonts']) {
    assert(!forbiddenText.includes(forbidden), `Full game asset tree is forbidden in launcher packaging: ${forbidden}`);
  }

  return { packageJson, iconSizes, sidebar, header, cursorDefault, cursorPointer, cursorPressed,
    catalog, catalogV3, roomMotionStatus, presentationStatus, zoroOverlayStatus: zoroOverlay.status };
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
  for (const fileName of EXTRA_RESOURCES[1].filter) {
    add(path.join(PUBLIC_ROOT, 'images', 'desktop_launcher', fileName), `images/desktop_launcher/${fileName}`);
  }
  const avatarRoot = path.join(PUBLIC_ROOT, 'images', 'board', 'avatars');
  for (const entry of fs.readdirSync(avatarRoot, { withFileTypes: true })) {
    if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.webp') {
      add(path.join(avatarRoot, entry.name), `images/board/avatars/${entry.name}`);
    }
  }
  for (const [kind, maximum] of [['walls', 8], ['flags', 15]]) {
    const resourceRoot = path.join(PUBLIC_ROOT, 'images', kind);
    const actual = sorted(fs.readdirSync(resourceRoot).filter((fileName) => fileName.endsWith('.webp')));
    const required = sorted(Array.from({ length: maximum }, (_, index) => `${index + 1}.webp`));
    assertExactJson(actual, required, `${kind} launcher artwork set`);
    for (const fileName of required) add(path.join(resourceRoot, fileName), `images/${kind}/${fileName}`);
  }
  for (const [resourceTo, publicPath] of [
    ['launcher-assets/images/profile_decor', path.join(PUBLIC_ROOT, 'images', 'profile_decor')],
    ['launcher-assets/images/launcher_announcements', path.join(PUBLIC_ROOT, 'images', 'launcher_announcements')],
    ['launcher-assets/images/launcher_room', path.join(PUBLIC_ROOT, 'images', 'launcher_room')],
    ['launcher-assets/audio/profile_bgm', path.join(PUBLIC_ROOT, 'audio', 'profile_bgm')],
    ['launcher-assets/audio/bgm', path.join(PUBLIC_ROOT, 'audio', 'bgm')]
  ]) {
    const resource = EXTRA_RESOURCES.find((entry) => entry.to === resourceTo);
    const packagedPrefix = resourceTo.replace(/^launcher-assets\//, '');
    for (const fileName of resource.filter) add(path.join(publicPath, fileName), `${packagedPrefix}/${fileName}`);
  }
  const videoResource = EXTRA_RESOURCES.find((resource) => resource.to === 'launcher-assets/videos/game_launcher');
  for (const fileName of videoResource.filter) {
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

function validateAsar(asarPath, packageJson) {
  const asar = loadAsarApi();
  const entries = asar.listPackage(asarPath).map((entry) => entry.replace(/^[/\\]+/, '').replaceAll('\\', '/'));
  const applicationEntries = sorted(entries.filter((entry) => entry && entry !== 'node_modules' && !entry.startsWith('node_modules/')));
  const expectedEntries = sorted(['assets', ...APP_FILES]);
  assertExactJson(applicationEntries, expectedEntries, 'app.asar application file set');
  assert(entries.includes('node_modules/socket.io-client/package.json'), 'app.asar is missing socket.io-client.');
  for (const entry of APP_FILES.filter(name => name !== 'package.json')) {
    assert(asar.extractFile(asarPath, entry).equals(fs.readFileSync(path.join(DESKTOP_ROOT, entry))),
      `Packaged application source differs: ${entry}`);
  }
  const packedPackage = JSON.parse(asar.extractFile(asarPath, 'package.json').toString('utf8'));
  assert(packedPackage.version === packageJson.version && packedPackage.main === 'main.js', 'Packed application metadata differs.');
  for (const entry of entries) {
    const lower = entry.toLowerCase();
    assert(!lower.startsWith('public/'), `app.asar contains the public game tree: ${entry}`);
    assert(!/(^|\/)(audio|videos|fonts)(\/|$)/.test(lower), `app.asar contains a full media tree: ${entry}`);
    assert(!/\.(mp3|mp4|webm|wav|ogg|webp|png|jpe?g)$/i.test(entry), `app.asar contains unexpected media: ${entry}`);
  }
  return entries.length;
}

function validateLauncherMediaBudgets(launcherBytes, roomMotionBytes, lifeBytes, lifeHdBytes, expansionMedia, lockedCrewBytes) {
  assert(expansionMedia.length === 32 && new Set(expansionMedia.map(item => item.asset)).size === 32, 'Expansion media budget requires exactly 32 unique assets.');
  assertExactJson(sorted(expansionMedia.map(item => item.asset)), sorted(ROOM_NEW_V128_ASSETS), 'Expansion media budget asset set');
  assert(expansionMedia.every(item => Number.isSafeInteger(item.bytes) && item.bytes > 0), 'Expansion media sizes must come from actual packaged files.');
  const expansionBytes = expansionMedia.reduce((sum, item) => sum + item.bytes, 0);
  assert(expansionBytes <= MAX_ROOM_EXPANSION_ASSET_BYTES, 'Reviewed expansion media exceeds its separate 4 MiB budget.');
  assert(Number.isSafeInteger(lockedCrewBytes) && lockedCrewBytes > 0 && lockedCrewBytes <= MAX_LOCKED_CREW_CANDIDATE_BYTES,
    'Locked Vivi candidate exceeds its separate 4 MiB budget.');
  const launcherBaseBytes = launcherBytes - roomMotionBytes - lifeBytes - lifeHdBytes - expansionBytes - lockedCrewBytes;
  assert(launcherBaseBytes >= 0, 'Launcher media classifications cannot exceed the actual total.');
  assert(roomMotionBytes <= MAX_ROOM_MOTION_ASSET_BYTES, `Room motion and portraits exceed ${MAX_ROOM_MOTION_ASSET_BYTES} bytes.`);
  assert(lifeBytes <= MAX_ROOM_LIFE_FURNITURE_BYTES, 'Room life furniture exceeds its separate 1 MiB budget.');
  assert(lifeHdBytes <= MAX_ROOM_LIFE_HD_ASSET_BYTES, 'Reviewed HD life media exceeds its separate 16 MiB budget.');
  assert(launcherBaseBytes <= MAX_LAUNCHER_ASSET_BYTES, `Existing launcher media exceeds ${MAX_LAUNCHER_ASSET_BYTES} bytes.`);
  assert(launcherBytes <= MAX_LAUNCHER_ASSET_BYTES + MAX_ROOM_MOTION_ASSET_BYTES + MAX_ROOM_LIFE_FURNITURE_BYTES + MAX_ROOM_LIFE_HD_ASSET_BYTES + MAX_LOCKED_CREW_CANDIDATE_BYTES,
    'Combined launcher media budget exceeded.');
  return { launcherBaseBytes, expansionBytes };
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
  const asarEntries = validateAsar(asarPath, source.packageJson);

  const cursorPolicyRoot = path.join(resourcesRoot, 'cursor-policy');
  const cursorPolicyFiles = ['css/board-cursor-nami-v3.css', 'css/card-cursor-buggy-v3.css', 'js/game_cursor_feedback_v1.js'];
  assertExactJson(sorted(listFilesRecursive(cursorPolicyRoot).map((filePath) => relativePosix(cursorPolicyRoot, filePath))), sorted(cursorPolicyFiles), 'cursor policy file set');
  for (const relativeName of cursorPolicyFiles) {
    assert(sha256File(path.join(cursorPolicyRoot, relativeName)) === sha256File(path.join(PUBLIC_ROOT, relativeName)), `Packaged cursor policy differs: ${relativeName}`);
  }

  const expectedAssets = collectExpectedLauncherAssets();
  const launcherAssetRoot = path.join(resourcesRoot, 'launcher-assets');
  const actualAssetFiles = listFilesRecursive(launcherAssetRoot);
  const actualAssetNames = sorted(actualAssetFiles.map((filePath) => relativePosix(launcherAssetRoot, filePath)));
  assertExactJson(actualAssetNames, sorted(expectedAssets.keys()), 'win-unpacked launcher asset set');
  const launcherBytes = sumFileBytes(actualAssetFiles);
  const roomMotionFiles = [...ROOM_PORTRAIT_ASSETS, ...ROOM_HD_ASSETS]
    .map(asset => path.join(launcherAssetRoot, 'images', 'launcher_room', ...asset.split('/')));
  assert(roomMotionFiles.length === 90 && new Set(roomMotionFiles).size === 90, 'Room media budget must cover eighty HD atlases and ten portraits.');
  const roomMotionBytes = sumFileBytes(roomMotionFiles);
  const lifeFiles = ROOM_LIFE_FURNITURE.map(asset => path.join(launcherAssetRoot, 'images', 'launcher_room', ...asset.split('/')));
  assert(lifeFiles.length === 5 && new Set(lifeFiles).size === 5, 'Room life furniture must contain five stove assets.');
  const lifeBytes = sumFileBytes(lifeFiles);
  const lifeHdFiles = ROOM_LIFE_HD_ASSETS.map(asset => path.join(launcherAssetRoot, 'images', 'launcher_room', ...asset.split('/')));
  assert(lifeHdFiles.length === 116 && new Set(lifeHdFiles).size === 116, 'HD life media must contain 116 reviewed loops.');
  const lifeHdBytes = sumFileBytes(lifeHdFiles);
  const expansionMedia = ROOM_NEW_V128_ASSETS.map(asset => ({ asset, bytes: fs.statSync(path.join(launcherAssetRoot, 'images', 'launcher_room', ...asset.split('/'))).size }));
  const lockedCrewBytes = sumFileBytes(ROOM_LOCKED_V1215_VIVI_ASSETS.map(asset =>
    path.join(launcherAssetRoot, 'images', 'launcher_room', ...asset.split('/'))));
  const { launcherBaseBytes, expansionBytes } = validateLauncherMediaBudgets(launcherBytes, roomMotionBytes, lifeBytes, lifeHdBytes, expansionMedia, lockedCrewBytes);
  for (const [packagedName, sourcePath] of expectedAssets) {
    const packagedPath = path.join(launcherAssetRoot, ...packagedName.split('/'));
    assert(sha256File(packagedPath) === sha256File(sourcePath), `Packaged launcher resource differs from source: ${packagedName}`);
  }
  for (const item of FISHING_V1216_ART) {
    const packagedPath = path.join(launcherAssetRoot, 'images', 'launcher_room', ...item.asset.split('/'));
    assert(fs.statSync(packagedPath).size === item.bytes && sha256File(packagedPath) === item.sha256,
      `Packaged Launcher 1.2.16 fishing art differs from reviewed output: ${item.asset}`);
  }
  const packagedFishingAnnouncement = path.join(launcherAssetRoot, 'images', 'launcher_announcements', FISHING_V1216_ANNOUNCEMENT.asset);
  assert(fs.statSync(packagedFishingAnnouncement).size === FISHING_V1216_ANNOUNCEMENT.bytes &&
    sha256File(packagedFishingAnnouncement) === FISHING_V1216_ANNOUNCEMENT.sha256,
  'Packaged Launcher 1.2.16 announcement differs from reviewed art.');

  const catalogRoot = path.join(resourcesRoot, 'catalog');
  const catalogFiles = listFilesRecursive(catalogRoot);
  const sourceCatalogRoot = path.join(PUBLIC_ROOT, 'desktop');
  const expectedCatalogNames = sorted([
    'catalog-v2.json',
    'catalog-v3.json',
    ...['card', 'board', 'chess'].map((gameId) => source.catalog.games[gameId].manifestPath.replace(/^desktop\//, '')),
    ...['card', 'board', 'chess'].map((gameId) => source.catalogV3.games[gameId].manifestPath.replace(/^desktop\//, ''))
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

  return { asarEntries, launcherFiles: actualAssetFiles.length, launcherBytes, launcherBaseBytes, expansionBytes, roomMotionBytes, catalogFiles: catalogFiles.length, catalogBytes };
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
  if (options.winUnpacked || options.installer) {
    assert(source.roomMotionStatus.complete && source.roomMotionStatus.allSelectedArtReviewed,
      'Release package requires all eighty complete-body atlases and explicit visual review evidence for every direction.');
    assert(source.zoroOverlayStatus === 'verified',
      'Release package requires a verified Zoro art overlay; candidate art cannot be shipped.');
    assert(source.presentationStatus.complete && source.presentationStatus.review.releaseVersion === '1.2.8',
      'Release package requires preserved historical proof plus current room and work expansion review.');
  }
  const parts = [
    'DESKTOP_LAUNCHER_PACKAGE_QA=PASS',
    `iconSizes=${source.iconSizes}`,
    `sidebar=${source.sidebar}`,
    `header=${source.header}`,
    `cursors=${source.cursorDefault},${source.cursorPointer},${source.cursorPressed}`,
    'runtimeDeps=1',
    'games=card,board,chess',
    `roomMotionAssets=${source.roomMotionStatus.assets}`,
    `roomPortraits=${source.roomMotionStatus.portraits}`,
    `roomArtReviewed=${source.roomMotionStatus.allSelectedArtReviewed}`,
    `presentationVersion=${source.presentationStatus.review.releaseVersion}`,
    `presentationScenarios=${source.presentationStatus.scenarios}`,
    `radialIcons=${source.presentationStatus.icons.count}`,
    `radialIconMode=${source.presentationStatus.icons.mode}`,
    `radialFunctionalChecks=${source.presentationStatus.functionalChecks}`,
    `interactionChecks=${source.presentationStatus.interactionChecks}`,
    `roomHdAssets=${source.presentationStatus.hd.assets}`,
    `reservedAssets=${source.presentationStatus.reserved.assets}`,
    `serverReleaseChecks=${source.presentationStatus.serverChecks}`,
    `aceReleaseChecks=${source.presentationStatus.aceChecks}`,
    `actualAnnouncementVisualChecks=${source.presentationStatus.productionVisualChecks}`,
    `activeCharacters=${source.presentationStatus.activeCharacters}`,
    `profileBgmServerChecks=${source.presentationStatus.bgmServerChecks}`,
    `profileBgmClientChecks=${source.presentationStatus.bgmClientChecks}`,
    `minigameServerChecks=${source.presentationStatus.serverChecks}`,
    `minigameBrowserChecks=${source.presentationStatus.functionalChecks}`,
    `robinBrowserChecks=${source.presentationStatus.robinChecks}`,
    `newRoomAssets=${source.presentationStatus.newAssets}`,
    `expansionCatalogChecks=${source.presentationStatus.catalogChecks}`,
    `expansionRoomChecks=${source.presentationStatus.roomChecks}`,
    `reservedArtBrowserChecks=${source.presentationStatus.artBrowser.checks}`,
    `reservedArtCaptures=${source.presentationStatus.artBrowser.captures}`,
    `lifeHistoricalRuntime=${source.presentationStatus.historicalBaseline}`,
    `zoroArt=${source.zoroOverlayStatus}`
  ];
  if (options.winUnpacked) {
    const packaged = validateWinUnpacked(options.winUnpacked, source);
    parts.push(`asarEntries=${packaged.asarEntries}`, `launcherFiles=${packaged.launcherFiles}`, `launcherBytes=${packaged.launcherBytes}`, `launcherBaseBytes=${packaged.launcherBaseBytes}`, `expansionBytes=${packaged.expansionBytes}`, `roomMotionBytes=${packaged.roomMotionBytes}`, `catalogFiles=${packaged.catalogFiles}`);
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
