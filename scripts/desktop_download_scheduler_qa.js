'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { AssetStore } = require('../desktop/asset-store');

const tick = () => new Promise((resolve) => setImmediate(resolve));
const asset = (id, size) => ({ path: `images/scheduler/${id}.png`, size, sha256: id });
const cost = (entry) => entry.size <= 256 * 1024 ? 1 : (entry.size <= 8 * 1024 * 1024 ? 3 : 6);

function fixture(assets, { delayedAbort = false, progressReset = false } = {}) {
  const store = new AssetStore({
    origin: 'http://127.0.0.1', bundledCatalogRoot: __dirname,
    cacheRoot: path.resolve(__dirname, '..', '.scheduler-qa-unused')
  });
  const controller = new AbortController();
  const started = [];
  const pending = new Map();
  let activeSlots = 0;
  let maximumSlots = 0;
  let settled = 0;
  store.downloadBlob = (entry, signal, onProgress) => new Promise((resolve, reject) => {
    started.push(entry.path);
    activeSlots += cost(entry);
    maximumSlots = Math.max(maximumSlots, activeSlots);
    let finished = false;
    const finish = (error) => {
      if (finished) return;
      finished = true;
      signal.removeEventListener('abort', abort);
      pending.delete(entry.path);
      activeSlots -= cost(entry);
      settled += 1;
      if (error) reject(error);
      else {
        if (progressReset) { onProgress(Math.floor(entry.size / 2)); onProgress(0); }
        onProgress(entry.size);
        resolve();
      }
    };
    const abort = () => {
      const error = new DOMException('Aborted', 'AbortError');
      if (delayedAbort) setTimeout(() => finish(error), 20);
      else finish(error);
    };
    signal.addEventListener('abort', abort, { once: true });
    pending.set(entry.path, finish);
    if (signal.aborted) abort();
  });
  const runtime = { downloadedBytes: 0, completedFiles: 0, totalFiles: assets.length, totalBytes: assets.reduce((sum, entry) => sum + entry.size, 0) };
  const promise = store.downloadQueue('board', assets, 12, runtime, controller.signal);
  const outcome = promise.then(() => null, (error) => error);
  return { controller, started, pending, runtime, outcome, get activeSlots() { return activeSlots; }, get maximumSlots() { return maximumSlots; }, get settled() { return settled; } };
}

async function finishAll(test) {
  while (test.pending.size) {
    for (const finish of [...test.pending.values()]) finish();
    await tick();
  }
  assert.equal(await test.outcome, null);
  assert.ok(test.maximumSlots <= 12, 'Combined weighted concurrency must stay within 12 slots.');
  assert.equal(test.activeSlots, 0);
  assert.equal(test.runtime.completedFiles, test.runtime.totalFiles);
  assert.equal(test.runtime.downloadedBytes, test.runtime.totalBytes);
}

async function main() {
  for (const [name, bytes, expected] of [['small', 256 * 1024, 12], ['medium', 8 * 1024 * 1024, 4], ['large', 8 * 1024 * 1024 + 1, 2]]) {
    const test = fixture(Array.from({ length: 24 }, (_, index) => asset(`${name}-${index}`, bytes)));
    assert.equal(test.started.length, expected, `${name} concurrency bound`);
    await finishAll(test);
  }

  const mixedAssets = [asset('medium-a', 500_000), asset('medium-b', 500_000), asset('medium-c', 500_000), asset('waiting-large', 10_000_000), ...Array.from({ length: 8 }, (_, index) => asset(`small-${index}`, 16_000))];
  const mixed = fixture(mixedAssets);
  assert.equal(mixed.started.length, 6);
  assert.equal(mixed.started.includes(mixedAssets[3].path), false);
  assert.equal(mixed.started.includes(mixedAssets[4].path), true, 'A queued large file must not block an eligible small file.');
  await finishAll(mixed);

  const abortAssets = Array.from({ length: 40 }, (_, index) => asset(`abort-${index}`, 16_000));
  const cancellation = fixture(abortAssets, { delayedAbort: true });
  cancellation.controller.abort();
  const cancellationError = await cancellation.outcome;
  assert.equal(cancellationError?.name, 'AbortError');
  assert.equal(cancellation.started.length, 12, 'Cancellation must prevent queued files from starting.');
  assert.equal(cancellation.settled, 12, 'Cancellation must drain all active downloads before returning.');
  assert.equal(cancellation.activeSlots, 0);

  const failure = fixture(abortAssets, { delayedAbort: true });
  const expectedFailure = new Error('fixture HTTP failure');
  failure.pending.values().next().value(expectedFailure);
  assert.equal(await failure.outcome, expectedFailure, 'Preserve the first error while aborting peers.');
  assert.equal(failure.started.length, 12, 'A failed install must not start queued files.');
  assert.equal(failure.settled, 12, 'A failed install must drain active downloads before returning.');
  assert.equal(failure.activeSlots, 0);

  await finishAll(fixture([asset('resume-progress', 16_001)], { progressReset: true }));

  const store = new AssetStore({ origin: 'http://127.0.0.1', bundledCatalogRoot: __dirname, cacheRoot: path.resolve(__dirname, '..', '.scheduler-qa-unused') });
  let starts = 0;
  store.downloadBlob = async () => { starts += 1; };
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(store.downloadQueue('board', abortAssets, 12, {}, aborted.signal), { name: 'AbortError' });
  assert.equal(starts, 0, 'An already-cancelled queue must not start a download.');
  console.log('DESKTOP_DOWNLOAD_SCHEDULER_QA=PASS small12=PASS medium4=PASS large2=PASS mixedBound=PASS eligibleSmall=PASS cancelDrain=PASS errorDrain=PASS progressReset=PASS preAborted=PASS');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
