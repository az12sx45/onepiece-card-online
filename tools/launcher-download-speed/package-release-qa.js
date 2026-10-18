'use strict';

// The 1.2.24 core must include the entire signed 1.2.23/r62 overlay. The old
// manifest stays byte-identical so existing 1.2.23 installations can keep it.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const OLD_CONTENT_SHA = '265693bacb11f03690e72c9a142576c65ccc4cacb93c162a3bc99e6c15e49535';
const OLD_CONTENT_FILES = 320;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const slash = value => value.replaceAll('\\', '/');
const media = value => /^(?:images|audio|videos)\//.test(value);
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));

function options(argv) {
  const result = { root: path.resolve(__dirname, '../..'), prepare: false };
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    if (key === '--prepare-filters') result.prepare = true;
    else {
      assert(['--repo-root', '--win-unpacked', '--report'].includes(key), `Unknown option: ${key}`);
      const value = argv[++index];
      assert(value && !value.startsWith('--'), `Missing value: ${key}`);
      result[{ '--repo-root': 'root', '--win-unpacked': 'unpacked', '--report': 'report' }[key]] = path.resolve(value);
    }
  }
  assert(!(result.prepare && result.unpacked), 'Prepare filters before building, without --win-unpacked.');
  if (result.report) assert(!fs.existsSync(result.report), 'Retain an existing report; use a new report path.');
  return result;
}

// Current package filters use positive exact paths or a single-segment '*'.
// Reject more expressive filters instead of guessing what electron-builder does.
function matches(value, pattern) {
  assert(typeof pattern === 'string' && !/[!{}?\[\]]/.test(pattern) && !pattern.includes('**'),
    `Unsupported package filter: ${pattern}`);
  const escaped = pattern.split('*').map(part => part.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')).join('[^/]*');
  return new RegExp('^' + escaped + '$').test(value);
}

function resourceCandidates(pkg, source, destination) {
  return pkg.build.extraResources.filter(item => {
    if (typeof item !== 'object' || typeof item.from !== 'string' || typeof item.to !== 'string') return false;
    const from = slash(item.from).replace(/\/$/, '');
    const to = slash(item.to).replace(/\/$/, '');
    if (!source.startsWith(from + '/') || !destination.startsWith(to + '/')) return false;
    const relativeSource = source.slice(from.length + 1);
    const relativeDestination = destination.slice(to.length + 1);
    return relativeSource === relativeDestination && Array.isArray(item.filter)
      && item.filter.some(pattern => matches(relativeSource, pattern));
  });
}

function loadAsar(root) {
  for (const name of [path.join(root, 'desktop/node_modules/@electron/asar'), '@electron/asar']) {
    try { return require(name); }
    catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw new Error('Set child-process NODE_PATH to the existing desktop build dependencies to inspect app.asar.');
}

function main(argv = process.argv.slice(2)) {
  const opts = options(argv);
  const root = opts.root;
  const packageFile = path.join(root, 'desktop/package.json');
  const pkg = readJson(packageFile);
  const contentFile = path.join(root, 'public/desktop/launcher-content-v1.json');
  const contentBytes = fs.readFileSync(contentFile);
  assert.equal(hash(contentBytes), OLD_CONTENT_SHA, 'The old-core content channel must remain byte-identical.');
  const content = JSON.parse(contentBytes);
  assert.equal(content.coreVersion, '1.2.23');
  assert.equal(content.revision, 62);
  assert.equal(content.files.length, OLD_CONTENT_FILES);
  require(path.join(root, 'desktop/launcher-content-overlay')).validateManifest(content, '1.2.23');

  // Verify source bytes and the production signature before allowing a package edit.
  for (const file of content.files) {
    const source = path.join(root, media(file.path) ? 'public' : 'desktop', file.path);
    const bytes = fs.readFileSync(source);
    assert.equal(bytes.length, file.bytes, `Source size: ${file.path}`);
    assert.equal(hash(bytes), file.sha256, `Source SHA: ${file.path}`);
    if (!media(file.path)) assert(pkg.build.files.includes(file.path), `Renderer is excluded: ${file.path}`);
  }

  const catalog = readJson(path.join(root, 'public/desktop/catalog-v3.json'));
  assert.deepEqual(Object.keys(catalog.games).sort(), ['board', 'card', 'chess']);
  const catalogResource = pkg.build.extraResources.find(item => item.from === '../public/desktop' && item.to === 'catalog');
  assert(catalogResource && Array.isArray(catalogResource.filter), 'Missing explicit catalog resource filter.');
  const missingMedia = content.files.filter(file => media(file.path)
    && resourceCandidates(pkg, '../public/' + file.path, 'launcher-assets/' + file.path).length === 0).map(file => file.path);
  const missingManifests = Object.values(catalog.games).map(game => game.manifestPath.replace(/^desktop\//, ''))
    .filter(relative => !catalogResource.filter.some(pattern => matches(relative, pattern)));

  if (opts.prepare) {
    // Exact missing paths only; no recursive resource wildcard and no version edit.
    if (missingMedia.length) pkg.build.extraResources.push({ from: '../public', to: 'launcher-assets', filter: missingMedia });
    catalogResource.filter.push(...missingManifests);
    if (missingMedia.length || missingManifests.length) fs.writeFileSync(packageFile, JSON.stringify(pkg, null, 2) + '\n');
  } else {
    assert.equal(missingMedia.length, 0, `Unbundled r62 media: ${missingMedia.join(', ')}`);
    assert.equal(missingManifests.length, 0, `Missing current fallback manifests: ${missingManifests.join(', ')}`);
  }

  const resources = opts.unpacked && path.join(opts.unpacked, 'resources');
  const resourceRoot = resources ? path.join(resources, 'launcher-assets') : path.join(root, 'public');
  const mainSource = fs.readFileSync(path.join(root, 'desktop/main.js'), 'utf8');
  const resolverSource = mainSource.match(/function resolveLauncherResource\(requestUrl\) \{[\s\S]*?\r?\n\}/)?.[0];
  assert(resolverSource, 'The actual launcher resource resolver is missing.');
  const resolver = vm.runInNewContext('(' + resolverSource + ')', {
    URL, path, LAUNCHER_SCHEME: 'opui', launcherResourceRoot: () => resourceRoot
  });
  const denied = [
    'opui://launcher/images/board/avatars/223.webp',
    'opui://launcher/images/launcher_guestbook/notes/unknown.webp',
    'opui://launcher/images/launcher_room/fish_master/unknown.webp',
    'opui://launcher/images/launcher_profile/unknown.webp',
    'opui://launcher/%2E%2E/private.json',
    'https://launcher/images/board/avatars/100.webp'
  ];
  for (const url of denied) assert.equal(resolver(url), null, `Unreviewed resource was admitted: ${url}`);
  const asar = resources && loadAsar(root);
  const asarFile = resources && path.join(resources, 'app.asar');
  const report = {
    status: 'PASS', checkedAt: new Date().toISOString(), version: pkg.version,
    scope: resources ? 'Prepared source and actual app.asar / resources bytes' : 'Prepared source and exact package allowlists; no installer claim',
    oldCoreContent: { coreVersion: content.coreVersion, revision: content.revision, sha256: hash(contentBytes), files: content.files.length, signatureVerified: true, preserved: true },
    additions: { media: opts.prepare ? missingMedia : [], fallbackManifests: opts.prepare ? missingManifests : [] },
    overlayFiles: [], applicationFiles: [], games: {}, resolverMediaFiles: 0,
    negativeResolverChecks: denied.length, physicalDeviceVerified: false
  };
  for (const file of content.files) {
    const isMedia = media(file.path);
    if (isMedia) {
      assert.equal(resourceCandidates(pkg, '../public/' + file.path, 'launcher-assets/' + file.path).length, 1,
        `Resource must map exactly once: ${file.path}`);
      assert.equal(resolver('opui://launcher/' + file.path), path.resolve(resourceRoot, file.path),
        `Bundled content is unreachable without the old-core overlay: ${file.path}`);
      report.resolverMediaFiles++;
    }
    if (resources) {
      const bytes = isMedia ? fs.readFileSync(path.join(resources, 'launcher-assets', file.path)) : asar.extractFile(asarFile, file.path);
      assert.equal(bytes.length, file.bytes, `Packaged size: ${file.path}`);
      assert.equal(hash(bytes), file.sha256, `Packaged SHA: ${file.path}`);
    }
    report.overlayFiles.push({ path: file.path, bytes: file.bytes, sha256: file.sha256, packaged: Boolean(resources) });
  }
  if (resources) {
    for (const relative of pkg.build.files) {
      assert(typeof relative === 'string' && !relative.includes('*') && !relative.includes('..'), 'Use exact application file paths.');
      const source = fs.readFileSync(path.join(root, 'desktop', relative));
      const bytes = asar.extractFile(asarFile, relative);
      if (relative === 'package.json') {
        // electron-builder removes build-only package fields in app.asar.
        const packed = JSON.parse(bytes);
        for (const key of ['name', 'version', 'main', 'dependencies']) assert.deepEqual(packed[key], pkg[key], `Packaged metadata differs: ${key}`);
      } else assert(bytes.equals(source), `Application differs from reviewed source: ${relative}`);
      report.applicationFiles.push({ path: relative, bytes: bytes.length, sha256: hash(bytes) });
    }
    const packedCatalog = fs.readFileSync(path.join(resources, 'catalog/catalog-v3.json'));
    assert(packedCatalog.equals(fs.readFileSync(path.join(root, 'public/desktop/catalog-v3.json'))), 'Packaged catalog differs.');
  }
  for (const [game, value] of Object.entries(catalog.games)) {
    const relative = value.manifestPath.replace(/^desktop\//, '');
    const source = fs.readFileSync(path.join(root, 'public', value.manifestPath));
    assert.equal(hash(source), value.manifestSha256, `Current ${game} manifest identity`);
    assert(catalogResource.filter.some(pattern => matches(relative, pattern)), `Current ${game} fallback is excluded.`);
    if (resources) assert(fs.readFileSync(path.join(resources, 'catalog', relative)).equals(source), `Packaged ${game} manifest differs.`);
    report.games[game] = { releaseId: value.releaseId, manifestPath: value.manifestPath, sha256: value.manifestSha256, packaged: Boolean(resources) };
  }
  if (opts.report) fs.writeFileSync(opts.report, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, version: report.version, overlayFiles: report.overlayFiles.length,
    applicationFiles: report.applicationFiles.length, games: Object.keys(report.games), packaged: Boolean(resources),
    mediaAdditions: missingMedia.length, manifestAdditions: missingManifests.length,
    resolverMediaFiles: report.resolverMediaFiles, negativeResolverChecks: denied.length, report: opts.report || null }));
  return report;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack); process.exitCode = 1; }
}
module.exports = { main, matches, resourceCandidates, OLD_CONTENT_SHA };
