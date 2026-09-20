"use strict";

// Read-only checks of the release catalog, immutable downloads and live runtime.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const ROOT = path.resolve(__dirname, "..");
const OUTPUT = process.env.BOARD_QA_OUTPUT || "D:/Codex_QA/board-spectator-playback-20260919/release";
const ORIGIN = "https://onepiece-card-online.onrender.com";
const BASELINE = process.env.BOARD_QA_BASELINE || "dc7d77d527f9f64c842946322e410e1c4e088c59";
const mode = process.argv.includes("--r2") ? "r2" : "live";
const digest = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "public/desktop/catalog-v3.json")));
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "config/desktop-program-packages-v1.json")));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "public", catalog.games.board.manifestPath)));
const report = { mode, startedAt:new Date().toISOString(), expectedPackage:catalog.games.board, responses:[], checks:[], transferredBodyBytes:0 };
async function get(url, expectedStatus = 200){
  const response = await fetch(url, { signal:AbortSignal.timeout(45000), headers:{ "Cache-Control":"no-cache" } });
  const bytes = Buffer.from(await response.arrayBuffer());
  const item = { url, status:response.status, size:bytes.length, sha256:digest(bytes), cacheControl:response.headers.get("cache-control"), contentType:response.headers.get("content-type") };
  report.responses.push(item); report.transferredBodyBytes += bytes.length;
  assert.equal(response.status, expectedStatus, `${url} status`);
  return { bytes, item };
}
async function main(){
  fs.mkdirSync(OUTPUT, { recursive:true });
  if(mode === "r2"){
    const baseline = JSON.parse(execFileSync("git", ["show", `${BASELINE}:public/desktop/catalog-v3.json`], { cwd:ROOT, encoding:"utf8", windowsHide:true }));
    const old = JSON.parse(execFileSync("git", ["show", `${BASELINE}:public/${baseline.games.board.manifestPath}`], { cwd:ROOT, encoding:"utf8", maxBuffer:16*1024*1024, windowsHide:true }));
    const known = new Set(old.assets.map(asset => asset.sha256));
    const changed = manifest.assets.filter(asset => !known.has(asset.sha256));
    assert(changed.length > 0, "Expected updated Board program blobs");
    for(const asset of changed){
      const { item } = await get(`${catalog.assetBlobBaseUrl}/${asset.sha256.slice(0,2)}/${asset.sha256}`);
      assert.equal(item.size, asset.size, `${asset.path} size`);
      assert.equal(item.sha256, asset.sha256, `${asset.path} digest`);
      report.checks.push({ path:asset.path, ok:true });
    }
    for(const id of ["card", "chess"]) assert.deepEqual(catalog.games[id], baseline.games[id], `${id} package unchanged`);
  }else{
    assert.equal(JSON.parse((await get(`${ORIGIN}/health`)).bytes).ok, true);
    for(const [id, record] of Object.entries(catalog.games)){
      const { bytes, item } = await get(`${ORIGIN}/api/desktop-runtime-package/${id}`);
      const identity = JSON.parse(bytes);
      assert.equal(identity.ok, true);
      for(const key of ["releaseId", "manifestSha256", "entryPath"]) assert.equal(identity[key], record[key], `${id} ${key}`);
      assert.equal(item.cacheControl, "no-store");
      report.checks.push({ identity, ok:true });
    }
    for(const relative of ["desktop/catalog-v3.json", ...Object.values(catalog.games).map(record => record.manifestPath)]){
      const { item } = await get(`${ORIGIN}/${relative}`);
      const expected = fs.readFileSync(path.join(ROOT, "public", relative));
      assert.equal(item.sha256, digest(expected), relative);
    }
    const assets = new Map(manifest.assets.map(asset => [asset.path, asset]));
    const queue = [...config.games.board.programFiles];
    async function worker(){
      while(queue.length){
        const relative = queue.shift();
        const { item } = await get(`${ORIGIN}/${relative}`);
        assert.equal(item.size, assets.get(relative).size, relative);
        assert.equal(item.sha256, assets.get(relative).sha256, relative);
        if(assets.get(relative).kind === "document") assert.match(item.contentType, /^text\/html/);
        report.checks.push({ path:relative, ok:true });
      }
    }
    await Promise.all([worker(), worker(), worker()]);
    const legacy = await get(`${ORIGIN}/api/board-save/RECOVERED`, 410);
    assert.equal(JSON.parse(legacy.bytes).ok, false);
    report.checks.push({ legacyEndpointClosed:true, ok:true });
  }
  report.ok = true;
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUTPUT, `${mode}-verify.json`), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ok:true, mode, checks:report.checks.length, transferredBodyBytes:report.transferredBodyBytes, expectedPackage:report.expectedPackage, finishedAt:report.finishedAt }));
}
main().catch(error => {
  report.ok = false; report.error = error.stack;
  fs.mkdirSync(OUTPUT, { recursive:true });
  fs.writeFileSync(path.join(OUTPUT, `${mode}-failure-${Date.now()}.json`), JSON.stringify(report, null, 2) + "\n");
  console.error(error); process.exitCode = 1;
});
