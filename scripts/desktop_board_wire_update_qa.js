"use strict";

// Explicit, bounded release QA. The installed ASAR is read only; downloads and
// reports live in a new QA directory, never the player's cache or userData.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const Module = require("node:module");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const ASAR_PATH = "D:/ONE PIECE TABLETOP SERIES/onepiece-tabletop-desktop/resources/app.asar";
const ASAR_API = "D:/Codex_Release_Worktrees/battle-chess-launcher-v1/desktop/node_modules/@electron/asar/lib/asar.js";
const OUTPUT_ROOT = path.resolve("D:/Codex_QA/board-state-wire-release-20260910");
const NEW_RELEASE = "package-0f7755bca2f64ff4";
const OLD_RELEASE = "package-68ec6b205918f818";
const BLOB_BASE = "https://game-assets.rihdi.tw/desktop/blobs/sha256";
const ORIGIN = "https://onepiece-card-online.onrender.com";
const live = process.argv.includes("--live-download");
const fullUpgrade = process.argv.includes("--full-upgrade");
const INSTALLED_CACHE = path.resolve("D:/ONE PIECE Tabletop Games");
assert(process.argv.slice(2).every((arg) => ["--live-download", "--full-upgrade"].includes(arg)), "Unsupported QA flag");
assert(!fullUpgrade || live, "--full-upgrade requires --live-download");
const asar = require(ASAR_API);
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const canonical = (bytes) => Buffer.from(bytes.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
async function fileSha256(filePath) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function installedModule(name) {
  const bytes = asar.extractFile(ASAR_PATH, name);
  const head = execFileSync("git", ["show", `HEAD:desktop/${name}`], { cwd: ROOT, windowsHide: true, timeout: 10000 });
  assert.deepEqual(canonical(bytes), canonical(head), `${name}: installed source differs beyond line endings`);
  const loaded = new Module(path.join(ROOT, "desktop", name), module);
  loaded.filename = path.join(ROOT, "desktop", name);
  loaded.paths = Module._nodeModulePaths(path.join(ROOT, "desktop"));
  // Execute the exact installed source string, not a normalized or repaired copy.
  loaded._compile(bytes.toString("utf8"), loaded.filename);
  return {
    api: loaded.exports,
    evidence: {
      entry: name,
      installedBytes: bytes.length,
      installedRawSha256: sha256(bytes),
      releaseHeadBytes: head.length,
      releaseHeadRawSha256: sha256(head),
      rawBytesEqual: bytes.equals(head),
      canonicalSha256: sha256(canonical(bytes)),
      canonicalBytesEqual: true,
      executedSource: "Unmodified installed ASAR source; CRLF normalization used only for comparison",
    },
  };
}

async function main() {
  const asarHashBefore = sha256(await fsp.readFile(ASAR_PATH));
  const appPackage = JSON.parse(asar.extractFile(ASAR_PATH, "package.json"));
  assert.equal(appPackage.version, "1.1.6");
  const oldStore = installedModule("asset-store.js");
  const oldRuntime = installedModule("runtime-asset-cache.js");
  const { AssetStore, validateCatalog, validateManifest, blobPath } = oldStore.api;
  const catalog = validateCatalog(JSON.parse(await fsp.readFile(path.join(ROOT, "public/desktop/catalog-v3.json"), "utf8")));
  assert.equal(catalog.assetBlobBaseUrl, BLOB_BASE);
  assert.equal(catalog.games.board.releaseId, NEW_RELEASE);
  const manifestBytes = await fsp.readFile(path.join(ROOT, "public", ...catalog.games.board.manifestPath.split("/")));
  assert.equal(sha256(manifestBytes), catalog.games.board.manifestSha256);
  const manifest = validateManifest(JSON.parse(manifestBytes), "board");
  const prior = validateManifest(JSON.parse(await fsp.readFile(path.join(ROOT, `public/desktop/manifests/board-${OLD_RELEASE}.json`))), "board");
  const previousHashes = new Map(prior.assets.map((asset) => [asset.path, asset.sha256]));
  const changed = manifest.assets.filter((asset) => previousHashes.get(asset.path) !== asset.sha256);
  assert.equal(changed.length, 13);
  assert(changed.every((asset) => ["document", "script"].includes(asset.kind)), "Only the 13 changed program files may be downloaded");
  assert.equal(new Set(changed.map((asset) => asset.sha256)).size, changed.length);
  const report = {
    mode: live ? "live-download" : "prepare-only",
    fullUpgrade,
    appVersion: appPackage.version,
    asarPath: ASAR_PATH,
    asarSha256Before: asarHashBefore,
    source: [oldStore.evidence, oldRuntime.evidence],
    releaseId: manifest.releaseId,
    manifestSha256: sha256(manifestBytes),
    changedFiles: changed.map((asset) => ({ path: asset.path, size: asset.size, sha256: asset.sha256, manifestMime: asset.mime })),
    changedBytes: changed.reduce((total, asset) => total + asset.size, 0),
    requests: [],
    downloaded: [],
    claims: "Verifies old installed downloader code against public release blobs in an isolated QA cache; does not update the installed app, its receipts, player cache, login or game windows.",
  };
  if (!live) {
    report.ready = true;
    report.networkRequests = 0;
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  await fsp.mkdir(OUTPUT_ROOT, { recursive: true });
  const outputInfo = await fsp.lstat(OUTPUT_ROOT);
  assert(outputInfo.isDirectory() && !outputInfo.isSymbolicLink(), "QA output root must be a real directory");
  const runRoot = await fsp.mkdtemp(path.join(OUTPUT_ROOT, "legacy-1.1.6-update-"));
  const cacheRoot = path.join(runRoot, "cache");
  assert(path.resolve(cacheRoot).startsWith(`${OUTPUT_ROOT}${path.sep}`));
  await fsp.mkdir(cacheRoot);
  report.runRoot = runRoot;
  report.startedAt = new Date().toISOString();
  const reportPath = path.join(runRoot, "report.json");
  const allowedByHash = new Map(changed.map((asset) => [asset.sha256, asset]));
  let operation = "preflight";
  const fetchPublicBlob = async (url, options = {}) => {
    const parsed = new URL(url);
    const match = /^\/desktop\/blobs\/sha256\/([a-f0-9]{2})\/([a-f0-9]{64})$/.exec(parsed.pathname);
    assert.equal(parsed.origin, "https://game-assets.rihdi.tw", "QA forbids fallback to Render or any other host");
    assert(match && match[1] === match[2].slice(0, 2) && allowedByHash.has(match[2]), "QA may only fetch one of the 13 changed blobs");
    assert.equal(parsed.search, "");
    assert(!options.method || options.method === "GET", "Only public GET requests are allowed");
    const asset = allowedByHash.get(match[2]);
    const response = await fetch(parsed.href, { ...options, redirect: "error" });
    report.requests.push({
      operation,
      path: asset.path,
      url: parsed.href,
      requestedRange: new Headers(options.headers).get("range"),
      status: response.status,
      contentType: response.headers.get("content-type"),
      cacheControl: response.headers.get("cache-control"),
      contentRange: response.headers.get("content-range"),
      contentLength: response.headers.get("content-length"),
    });
    if (asset.kind === "document" && response.ok) {
      assert.equal(response.headers.get("content-type")?.split(";")[0], "application/octet-stream", "HTML blob must arrive as untransformed binary bytes");
      assert.match(response.headers.get("cache-control") || "", /(?:^|,)\s*no-transform\s*(?:,|$)/i);
    }
    return response;
  };
  const controller = new AbortController();
  const watchdog = setTimeout(() => controller.abort(), fullUpgrade ? 600000 : 120000);
  let sourceSnapshot = null;
  try {
    const store = new AssetStore({
      origin: ORIGIN,
      bundledCatalogRoot: path.join(ROOT, "public/desktop"),
      cacheRoot,
      fetchImpl: fetchPublicBlob,
      integrityAuditMaxFiles: 0,
      integrityAuditMaxBytes: 0,
      downloadMaxAttempts: 1,
    });
    await store.ensureCacheOwnership(cacheRoot);
    if (fullUpgrade) {
      const sourceRootReal = await fsp.realpath(INSTALLED_CACHE);
      const receiptSource = path.join(INSTALLED_CACHE, "receipts/board.json");
      const receiptBytes = await fsp.readFile(receiptSource);
      const receipt = JSON.parse(receiptBytes);
      assert.equal(receipt.releaseId, OLD_RELEASE, "Installed source changed; re-plan the upgrade fixture");
      assert.equal(receipt.manifestFile, `board-${OLD_RELEASE}.json`);
      const sourceManifestPath = path.join(INSTALLED_CACHE, "manifests/board", receipt.manifestFile);
      const sourceManifestBytes = await fsp.readFile(sourceManifestPath);
      assert.equal(sha256(sourceManifestBytes), receipt.manifestSha256);
      assert.deepEqual(validateManifest(JSON.parse(sourceManifestBytes), "board"), prior);
      const targetReceiptRoot = path.join(cacheRoot, "receipts");
      const targetManifestRoot = path.join(cacheRoot, "manifests/board");
      await fsp.mkdir(targetReceiptRoot, { recursive: true });
      await fsp.mkdir(targetManifestRoot, { recursive: true });
      await fsp.writeFile(path.join(targetReceiptRoot, "board.json"), receiptBytes, { flag: "wx" });
      await fsp.writeFile(path.join(targetManifestRoot, receipt.manifestFile), sourceManifestBytes, { flag: "wx" });
      sourceSnapshot = { receiptSource, receiptHash: sha256(receiptBytes), sourceManifestPath, manifestHash: sha256(sourceManifestBytes), files: [] };
      const currentHashes = new Set(manifest.assets.map((asset) => asset.sha256));
      const priorUnique = [...new Map(prior.assets.map((asset) => [asset.sha256, asset])).values()];
      const counts = { verifiedSourceFiles: 0, sourceBytes: 0, linkedUnchangedFiles: 0, copiedPreviousProgramFiles: 0 };
      for (const asset of priorUnique) {
        if (controller.signal.aborted) throw new Error("Upgrade fixture preparation timed out");
        const sourcePath = blobPath(INSTALLED_CACHE, asset.sha256);
        const sourceInfo = await fsp.lstat(sourcePath);
        assert(sourceInfo.isFile() && !sourceInfo.isSymbolicLink(), "Source CAS must contain regular files");
        assert((await fsp.realpath(sourcePath)).startsWith(`${sourceRootReal}${path.sep}`));
        assert.equal(sourceInfo.size, asset.size);
        assert.equal(await fileSha256(sourcePath), asset.sha256, `Installed source hash: ${asset.path}`);
        const targetPath = blobPath(cacheRoot, asset.sha256);
        await fsp.mkdir(path.dirname(targetPath), { recursive: true });
        if (currentHashes.has(asset.sha256)) {
          // AssetStore writes downloads into new .part files and renames them;
          // it never overwrites an existing CAS inode in place. Cleanup unlinks
          // only this isolated cache's paths, leaving the source link intact.
          await fsp.link(sourcePath, targetPath);
          counts.linkedUnchangedFiles += 1;
        } else {
          await fsp.copyFile(sourcePath, targetPath, fs.constants.COPYFILE_EXCL);
          counts.copiedPreviousProgramFiles += 1;
        }
        sourceSnapshot.files.push({ path: sourcePath, sha256: asset.sha256, size: sourceInfo.size, mtimeMs: sourceInfo.mtimeMs });
        counts.verifiedSourceFiles += 1;
        counts.sourceBytes += asset.size;
      }
      report.fullUpgradeFixture = { ...counts, sourceReceiptSha256: sourceSnapshot.receiptHash, sourceManifestSha256: sourceSnapshot.manifestHash };
      await store.init();
      const initial = await store.getState();
      assert.equal(initial.games.board.status, "update");
      assert.equal(initial.games.board.hasInstalled, true);
      assert.equal(initial.games.board.installedVersion, OLD_RELEASE);
      report.fullUpgradeFixture.initialState = { status: initial.games.board.status, hasInstalled: true, installedVersion: initial.games.board.installedVersion };
    }
    const rangeAsset = changed.find((asset) => asset.path === "board_lobby.html");
    assert(rangeAsset && rangeAsset.size > 200);
    const rangeUrl = `${BLOB_BASE}/${rangeAsset.sha256.slice(0, 2)}/${rangeAsset.sha256}`;
    operation = "html-full-preflight";
    const preflight = await fetchPublicBlob(rangeUrl, { headers: { "Accept-Encoding": "identity" }, signal: controller.signal });
    assert.equal(preflight.status, 200);
    const preflightBytes = Buffer.from(await preflight.arrayBuffer());
    assert.equal(preflightBytes.length, rangeAsset.size);
    assert.equal(sha256(preflightBytes), rangeAsset.sha256);
    operation = "html-range-preflight";
    const range = await fetchPublicBlob(rangeUrl, { headers: { "Accept-Encoding": "identity", Range: "bytes=100-199" }, signal: controller.signal });
    assert.equal(range.status, 206);
    assert.equal(range.headers.get("content-range"), `bytes 100-199/${rangeAsset.size}`);
    assert.deepEqual(Buffer.from(await range.arrayBuffer()), preflightBytes.subarray(100, 200));
    await fsp.mkdir(path.join(cacheRoot, "partial"), { recursive: true });
    await fsp.writeFile(path.join(cacheRoot, "partial", `${rangeAsset.sha256}.part`), preflightBytes.subarray(0, 100), { flag: "wx" });
    report.htmlRange = { path: rangeAsset.path, status: 206, start: 100, end: 199, bytesMatchFullSlice: true, resumedPrefixBytes: 100 };

    operation = "legacy-asset-store-download";
    if (fullUpgrade) {
      const started = store.installGame("board");
      assert.equal(started.ok, true);
      while (store.activeInstall) {
        if (controller.signal.aborted) store.cancelInstall("board");
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      const completed = await store.getState();
      assert.equal(completed.games.board.status, "installed", completed.games.board.lastError || completed.games.board.message);
      assert.equal(completed.games.board.installedVersion, NEW_RELEASE);
      assert.equal(store.canLaunch("board"), true);
      const finalReceipt = await store.readReceiptFromRoot(cacheRoot, "board");
      assert.equal(finalReceipt.releaseId, NEW_RELEASE);
      assert.equal(finalReceipt.manifestSha256, report.manifestSha256);
      const program = manifest.assets.filter((asset) => ["document", "style", "script", "data", "wasm"].includes(asset.kind));
      for (const asset of program) assert.equal(await fileSha256(blobPath(cacheRoot, asset.sha256)), asset.sha256);
      report.fullUpgradeResult = { status: completed.games.board.status, canLaunch: true, receiptReleaseId: finalReceipt.releaseId, receiptManifestSha256: finalReceipt.manifestSha256, programFilesHashed: program.length, programHashFailures: 0, manifestFiles: finalReceipt.manifest.assets.length };
    }
    for (const asset of changed) {
      if (!fullUpgrade) await store.downloadBlob(asset, controller.signal, () => {}, { assetBlobBaseUrl: BLOB_BASE });
      const bytes = await fsp.readFile(blobPath(cacheRoot, asset.sha256));
      assert.equal(bytes.length, asset.size, `${asset.path} byte count`);
      assert.equal(sha256(bytes), asset.sha256, `${asset.path} SHA-256`);
      report.downloaded.push({ path: asset.path, size: bytes.length, sha256: sha256(bytes), verified: true });
    }
    const resumed = report.requests.find((entry) => entry.operation === operation && entry.path === rangeAsset.path);
    assert.equal(resumed?.requestedRange, "bytes=100-");
    assert.equal(resumed?.status, 206);
    assert.equal(resumed?.contentRange, `bytes 100-${rangeAsset.size - 1}/${rangeAsset.size}`);
    report.htmlRange.legacyResumeVerified = true;

    const runtime = new oldRuntime.api.RuntimeAssetCache();
    runtime.buildGame("board", { assets: changed }, { filePathForAsset: (asset) => blobPath(cacheRoot, asset.sha256) });
    report.runtimeMime = [];
    for (const asset of changed.filter((entry) => entry.kind === "document")) {
      const response = await runtime.createResponse(new Request(`${ORIGIN}/${asset.path}`), runtime.lookupPath("board", asset.path), { allowedOrigin: ORIGIN });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "text/html");
      assert.equal(sha256(Buffer.from(await response.arrayBuffer())), asset.sha256);
      report.runtimeMime.push({ path: asset.path, contentType: "text/html", bytesVerified: true });
    }
    report.ok = true;
  } catch (error) {
    report.ok = false;
    report.error = error.stack || error.message;
    throw error;
  } finally {
    clearTimeout(watchdog);
    report.finishedAt = new Date().toISOString();
    report.asarSha256After = sha256(await fsp.readFile(ASAR_PATH));
    report.installedAsarUnchanged = report.asarSha256After === report.asarSha256Before;
    if (!report.installedAsarUnchanged) report.ok = false;
    if (sourceSnapshot) {
      const sourceReceiptUnchanged = sha256(await fsp.readFile(sourceSnapshot.receiptSource)) === sourceSnapshot.receiptHash;
      const sourceManifestUnchanged = sha256(await fsp.readFile(sourceSnapshot.sourceManifestPath)) === sourceSnapshot.manifestHash;
      let sourceBlobFailures = 0;
      for (const file of sourceSnapshot.files) {
        const info = await fsp.lstat(file.path);
        if (!info.isFile() || info.size !== file.size || info.mtimeMs !== file.mtimeMs || await fileSha256(file.path) !== file.sha256) sourceBlobFailures += 1;
      }
      report.sourceCacheUnchanged = { receipt: sourceReceiptUnchanged, manifest: sourceManifestUnchanged, checkedBlobs: sourceSnapshot.files.length, failedBlobs: sourceBlobFailures };
      if (!sourceReceiptUnchanged || !sourceManifestUnchanged || sourceBlobFailures) report.ok = false;
    }
    await fsp.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
    console.log(JSON.stringify({ ok: report.ok, reportPath, appVersion: report.appVersion, releaseId: report.releaseId, downloadedFiles: report.downloaded.length, downloadedBytes: report.downloaded.reduce((sum, asset) => sum + asset.size, 0), requests: report.requests.length, htmlRange: report.htmlRange || null, localHtmlMimeChecks: report.runtimeMime?.length || 0, fullUpgradeResult: report.fullUpgradeResult || null, sourceCacheUnchanged: report.sourceCacheUnchanged || null, installedAsarUnchanged: report.installedAsarUnchanged }, null, 2));
    assert(report.installedAsarUnchanged, "Installed ASAR changed during QA");
    if (report.sourceCacheUnchanged) {
      assert(report.sourceCacheUnchanged.receipt && report.sourceCacheUnchanged.manifest, "Installed metadata changed during QA");
      assert.equal(report.sourceCacheUnchanged.failedBlobs, 0, "Installed blob contents changed during QA");
    }
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
