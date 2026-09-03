'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  DESKTOP_WEB_CACHE_STORAGES,
  resetDesktopGameWebCache,
  shouldBlockServiceWorkerRequest
} = require('../desktop/game-session-policy');

const ROOT = path.resolve(__dirname, '..');
const REMOTE_ORIGIN = 'https://onepiece-card-online.onrender.com';

function sourceText(relativePath) {
  return fs.readFileSync(path.join(ROOT, ...relativePath.split('/')), 'utf8');
}

function functionSection(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `Cannot locate ${startMarker} implementation section.`);
  return text.slice(start, end);
}

async function main() {
  assert.deepEqual(
    [...DESKTOP_WEB_CACHE_STORAGES],
    ['serviceworkers', 'cachestorage'],
    'Desktop cleanup must target only Service Worker state and CacheStorage.'
  );
  assert.equal(Object.isFrozen(DESKTOP_WEB_CACHE_STORAGES), true, 'Desktop cleanup storage allowlist must be immutable.');

  const clearCalls = [];
  const fakeSession = {
    async clearStorageData(options) {
      clearCalls.push(options);
    }
  };
  await resetDesktopGameWebCache(fakeSession, `${REMOTE_ORIGIN}/start.html?desktop=1`);
  await resetDesktopGameWebCache(fakeSession, REMOTE_ORIGIN);
  assert.deepEqual(clearCalls, [
    { origin: REMOTE_ORIGIN, storages: ['serviceworkers', 'cachestorage'] },
    { origin: REMOTE_ORIGIN, storages: ['serviceworkers', 'cachestorage'] }
  ], 'Every desktop launch preparation must clear the two isolated web caches for the hosted origin.');
  assert.ok(clearCalls.every((call) => !call.storages.includes('localstorage') && !call.storages.includes('cookies')), 'Desktop cleanup must preserve login bootstrap storage and cookies.');
  await assert.rejects(() => resetDesktopGameWebCache({}, REMOTE_ORIGIN), /valid Electron game session/);
  await assert.rejects(() => resetDesktopGameWebCache(fakeSession, 'not a URL'), /valid remote game origin/);

  const blocked = [
    `${REMOTE_ORIGIN}/sw.js`,
    `${REMOTE_ORIGIN}/sw.js?desktop-cache-bust=1`,
    `${REMOTE_ORIGIN}:443/sw.js`
  ];
  for (const url of blocked) {
    assert.equal(shouldBlockServiceWorkerRequest({ url }, REMOTE_ORIGIN), true, `Desktop session must block hosted Service Worker request: ${url}`);
  }
  const allowed = [
    `${REMOTE_ORIGIN}/images/cover.jpg`,
    `${REMOTE_ORIGIN}/nested/sw.js`,
    `${REMOTE_ORIGIN}/SW.js`,
    'https://example.com/sw.js',
    'data:text/javascript,sw.js',
    'not a URL'
  ];
  for (const url of allowed) {
    assert.equal(shouldBlockServiceWorkerRequest({ url }, REMOTE_ORIGIN), false, `Unrelated request must not be classified as the hosted root Service Worker: ${url}`);
  }
  assert.equal(shouldBlockServiceWorkerRequest(null, REMOTE_ORIGIN), false);

  const mainSource = sourceText('desktop/main.js');
  const prepareSection = functionSection(mainSource, 'async function prepareGameSession(gameId)', 'async function chooseDefaultCacheRoot()');
  const launchSection = functionSection(mainSource, 'async function launchGame(gameId)', 'async function closeGameWindows()');
  const resetIndex = prepareSection.indexOf('await resetDesktopGameWebCache(targetSession, REMOTE_ORIGIN);');
  const cachedReturnIndex = prepareSection.indexOf('if (gameSessions.has(gameId))');
  const requestHookIndex = prepareSection.indexOf('targetSession.webRequest.onBeforeRequest(');
  assert.ok(resetIndex >= 0, 'Game session preparation does not clear prior Service Worker/CacheStorage state.');
  assert.ok(cachedReturnIndex > resetIndex, 'Cache cleanup must happen before returning a previously prepared persistent session.');
  assert.ok(requestHookIndex > resetIndex, 'Cache cleanup must finish before request interception and navigation can begin.');
  assert.match(prepareSection, /`\$\{REMOTE_ORIGIN\}\/sw\.js\*`/, 'Game request filter does not include the hosted root sw.js.');
  assert.match(
    prepareSection,
    /if \(shouldBlockServiceWorkerRequest\(details, REMOTE_ORIGIN\)\) return callback\(\{ cancel: true \}\);/,
    'Hosted sw.js request is not synchronously cancelled by the desktop game session.'
  );
  assert.ok(
    launchSection.indexOf('await prepareGameSession(gameId);') < launchSection.indexOf('await window.loadURL('),
    'Desktop game session must be cleaned and hardened before hosted navigation starts.'
  );
  const cardPartition = /card: \{[^\n]+partition: '([^']+)'/.exec(mainSource)?.[1];
  const boardPartition = /board: \{[^\n]+partition: '([^']+)'/.exec(mainSource)?.[1];
  assert.ok(cardPartition && boardPartition, 'Card and Board desktop session partitions are required.');
  assert.notEqual(cardPartition, boardPartition, 'Card and Board must use separate Electron session partitions.');

  const hostedStart = sourceText('public/start.html');
  const hostedWorker = sourceText('public/sw.js');
  assert.match(hostedStart, /navigator\.serviceWorker\s*\n?\s*\.register\("\.\/sw\.js"\)/, 'Hosted card game no longer has its normal Service Worker registration; isolation belongs in Electron only.');
  assert.match(hostedWorker, /caches\.(?:open|keys|match)\s*\(/, 'Hosted sw.js no longer contains its normal CacheStorage behavior; this QA expects hosted behavior to remain independent.');

  console.log(
    'DESKTOP_SERVICE_WORKER_ISOLATION_QA=PASS ' +
    'games=card,board clear=serviceworkers,cachestorage swRequest=cancel hostedSource=unchanged-by-design'
  );
}

main().catch((error) => {
  console.error(`DESKTOP_SERVICE_WORKER_ISOLATION_QA=FAIL ${error.stack || error}`);
  process.exitCode = 1;
});
