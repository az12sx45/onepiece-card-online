'use strict';

// Build only the exact 1.1.12 Zoro replacements; historical manifests stay immutable.
// `node tools/launcher-room/build_zoro_art_overlay.js --dry-run` never writes.
// A plain invocation writes a verified overlay only after both corrected source
// PNGs and their rendered art have changed and every other historical asset
// still matches its original SHA (or the separately verified grounded walk set).

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT = path.join(ROOT, 'docs', 'LAUNCHER_ROOM_ZORO_ART_OVERLAY_20260925.json');
const HISTORICAL = Object.freeze({
  'LAUNCHER_ROOM_ART_20260925.json': 'c81ad058510d5b1f12a17bb5288e4f3325f8aae2def49c35854550bc89832570',
  'LAUNCHER_ROOM_EXPANSION_ART_20260925.json': '708b7f046595191f425cde21900737e661103c283090942006515f109db3baab',
  'LAUNCHER_ROOM_DEPTH_ART_20260925.json': 'da9fd1fbe377d8fafdfb0be2118961cec65445da22bb7d47739aef35fb749ee1'
});
const POSES = ['idle', 'walk1', 'walk2', 'talk_happy', 'talk_annoyed', 'surprised', 'focused_use', 'sit', 'wave'];
const ACTION_SOURCE = 'tools/launcher-room/action-source-png/zoro.png';
const CHIBI_SOURCE = 'tools/launcher-room/source-png/zoro.png';
const CHIBI_ASSET = 'public/images/launcher_room/chibi/zoro.webp';
const ACTION_ASSETS = POSES.map(pose => `public/images/launcher_room/action_frames/zoro/${pose}.webp`);
const WALK2_ASSET = 'public/images/launcher_room/action_frames/zoro/walk2.webp';
const ALLOWED_SOURCES = new Set([ACTION_SOURCE, CHIBI_SOURCE]);
const ALLOWED_ASSETS = new Set([CHIBI_ASSET, ...ACTION_ASSETS]);

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function absolute(relative) {
  check(typeof relative === 'string' && !relative.startsWith('/') &&
    !relative.includes('\\') && !relative.split('/').includes('..'), `Unsafe path: ${relative}`);
  const result = path.resolve(ROOT, ...relative.split('/'));
  check(result.startsWith(ROOT + path.sep), `Path escapes project: ${relative}`);
  return result;
}

function sha256(relative) {
  return crypto.createHash('sha256').update(fs.readFileSync(absolute(relative))).digest('hex');
}

function bytes(relative) {
  return fs.statSync(absolute(relative)).size;
}

function readJson(relative) {
  return JSON.parse(fs.readFileSync(absolute(relative), 'utf8'));
}

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b, 'en'));
}

function same(actual, expected, label) {
  check(JSON.stringify(actual) === JSON.stringify(expected), `${label} differs.`);
}

function makeOverlay() {
  const manifests = {};
  for (const [name, historicalSha] of Object.entries(HISTORICAL)) {
    const relative = `docs/${name}`;
    check(sha256(relative) === historicalSha, `Immutable historical manifest changed: ${name}`);
    manifests[name] = readJson(relative);
  }
  const chibi = manifests['LAUNCHER_ROOM_ART_20260925.json'].items.filter(item => item.asset === CHIBI_ASSET);
  const action = manifests['LAUNCHER_ROOM_DEPTH_ART_20260925.json'].items.filter(item => ACTION_ASSETS.includes(item.asset));
  check(chibi.length === 1 && action.length === POSES.length && chibi[0].sourcePng === CHIBI_SOURCE,
    'Historical Zoro art items changed.');
  same(sorted(action.map(item => item.asset)), sorted(ACTION_ASSETS), 'Historical Zoro action paths');
  const actionSourceItems = action.filter(item => item.asset !== WALK2_ASSET);
  check(actionSourceItems.every(item => item.sourcePng === ACTION_SOURCE &&
    item.sourceSha256 === actionSourceItems[0].sourceSha256), 'Historical Zoro action source differs.');
  const oldSource = new Map([
    [ACTION_SOURCE, actionSourceItems[0].sourceSha256],
    [CHIBI_SOURCE, chibi[0].sourceSha256]
  ]);
  const currentSource = new Map([...oldSource.keys()].map(source => [source, sha256(source)]));
  const changedSources = sorted([...oldSource.keys()].filter(source =>
    currentSource.get(source) !== oldSource.get(source)));
  const historicalAssets = [chibi[0], ...action];
  const changedAssets = sorted(historicalAssets.filter(item => sha256(item.asset) !== item.assetSha256)
    .map(item => item.asset));

  const actionManifest = readJson('tools/launcher-room/action-source-png/action-manifest.json');
  const activeZoro = actionManifest.characters.filter(item => item.character === 'zoro');
  check(activeZoro.length === 1 && activeZoro[0].source === ACTION_SOURCE &&
    activeZoro[0].sourceSha256 === currentSource.get(ACTION_SOURCE),
  'Current Zoro source differs from action manifest.');
  const frames = activeZoro[0].frames;
  check(Array.isArray(frames) && frames.length === POSES.length, 'Zoro action manifest has the wrong pose count.');
  same(sorted(frames.map(frame => frame.path)), sorted(ACTION_ASSETS), 'Current Zoro action paths');
  const frameByAsset = new Map(frames.map(frame => [frame.path, frame]));
  for (const [index, pose] of POSES.entries()) {
    const asset = ACTION_ASSETS[index];
    const frame = frameByAsset.get(asset);
    check(frame.pose === pose && frame.sourcePng === ACTION_SOURCE &&
      frame.sourceSha256 === currentSource.get(ACTION_SOURCE) &&
      frame.sha256 === sha256(asset) && frame.bytes === bytes(asset),
    `Current Zoro pose differs from action manifest: ${pose}`);
  }

  const roomWalk = readJson('docs/LAUNCHER_ROOM_WALK_ART_20260925.json');
  check(roomWalk.version === '1.1.12' && roomWalk.canonicalCharactersOnly === true &&
    Array.isArray(roomWalk.items) && roomWalk.items.length === 8,
  'Grounded walk manifest is not the eight-character release.');
  const walkByAsset = new Map();
  for (const item of roomWalk.items) {
    check(/^public\/images\/launcher_room\/action_frames\/(?:luffy|zoro|nami|usopp|sanji|chopper|robin|brook)\/walk2\.webp$/.test(item.asset),
      `Unapproved grounded walk path: ${item.asset}`);
    check(!walkByAsset.has(item.asset), `Duplicate grounded walk asset: ${item.asset}`);
    check(sha256(item.sourcePng) === item.sourceSha256 &&
      sha256(item.asset) === item.assetSha256 && bytes(item.asset) === item.assetBytes,
    `Grounded walk art differs from manifest: ${item.asset}`);
    walkByAsset.set(item.asset, item);
  }
  check(walkByAsset.has(WALK2_ASSET), 'Grounded walk manifest lacks Zoro.');

  const candidate = changedSources.length === 0;
  if (candidate) {
    check(changedAssets.every(asset => asset === WALK2_ASSET),
      'Zoro rendered art changed before both corrected sources were ready.');
  } else {
    same(changedSources, sorted([ACTION_SOURCE, CHIBI_SOURCE]), 'Corrected Zoro source set');
    check(changedAssets.includes(CHIBI_ASSET) && changedAssets.some(asset => ACTION_ASSETS.includes(asset)),
      'Corrected Zoro requires changed chibi and action outputs.');
    const walk = walkByAsset.get(WALK2_ASSET);
    check(walk.sourcePng === ACTION_SOURCE && walk.sourceSha256 === currentSource.get(ACTION_SOURCE),
      'Corrected Zoro walk must derive from the new action atlas.');
  }

  // Every historical entry remains locked. Only the exact changed Zoro entries
  // and already-manifested 1.1.12 grounded walk frames may differ.
  for (const manifest of Object.values(manifests)) {
    for (const item of manifest.items) {
      if (!(ALLOWED_SOURCES.has(item.sourcePng) && !candidate)) {
        check(sha256(item.sourcePng) === item.sourceSha256,
          `Unchanged historical source differs: ${item.sourcePng}`);
      }
      if (ALLOWED_ASSETS.has(item.asset) && !candidate) continue;
      const walk = walkByAsset.get(item.asset);
      if (walk) {
        check(sha256(item.asset) === walk.assetSha256 && bytes(item.asset) === walk.assetBytes,
          `Grounded walk exception differs: ${item.asset}`);
      } else {
        check(sha256(item.asset) === item.assetSha256 && bytes(item.asset) === item.assetBytes,
          `Unchanged historical asset differs: ${item.asset}`);
      }
    }
  }

  const sources = candidate ? [] : changedSources.map(source => ({
    path: source, sha256: currentSource.get(source), bytes: bytes(source)
  }));
  const assets = candidate ? [] : changedAssets.map(asset => {
    const sourcePng = asset === CHIBI_ASSET ? CHIBI_SOURCE : frameByAsset.get(asset).sourcePng;
    return { path: asset, sha256: sha256(asset), bytes: bytes(asset),
      sourcePng, sourceSha256: currentSource.get(sourcePng) };
  });
  return {
    schema: 1, version: '1.1.12', character: 'zoro',
    status: candidate ? 'candidate' : 'verified',
    historicalManifestSha256: HISTORICAL, sources, assets
  };
}

function main() {
  const args = process.argv.slice(2);
  check(args.length === 0 || (args.length === 1 && args[0] === '--dry-run'),
    'Usage: node tools/launcher-room/build_zoro_art_overlay.js [--dry-run]');
  const overlay = makeOverlay();
  const json = JSON.stringify(overlay, null, 2) + '\n';
  if (args[0] === '--dry-run' || overlay.status === 'candidate') {
    process.stdout.write(json);
    if (overlay.status === 'candidate') {
      process.stderr.write('Zoro art is still a candidate; no overlay file was written.\n');
    }
    return;
  }
  fs.writeFileSync(OUTPUT, json, { flag: 'wx' });
  process.stdout.write(`VERIFIED_ZORO_ART_OVERLAY=${OUTPUT}\n`);
}

try {
  main();
} catch (error) {
  console.error(`ZORO_ART_OVERLAY=FAIL ${error.stack || error.message || error}`);
  process.exitCode = 1;
}
