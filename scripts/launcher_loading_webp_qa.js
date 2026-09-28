'use strict';

// Compare the reviewed launcher PNG sources with their lossless WebP package
// variants in the same Chromium renderer. No account or production writes.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const reportPath = process.env.LAUNCHER_LOADING_QA_OUT || 'D:/Codex_QA/launcher-load-1.2.9-assets';
const review = JSON.parse(fs.readFileSync(path.join(root, 'docs/LAUNCHER_LOADING_ART_20260928.json'), 'utf8'));
const runtime = path.join(process.env.LOCALAPPDATA || '', 'OpenAI/Codex/runtimes/cua_node');
const playwright = process.env.BOARD_QA_PLAYWRIGHT || (fs.existsSync(runtime) && fs.readdirSync(runtime)
  .map(name => path.join(runtime, name, 'bin/node_modules/playwright'))
  .find(candidate => fs.existsSync(path.join(candidate, 'package.json')))) || 'playwright';
const { chromium } = require(playwright);
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function main() {
  assert.equal(review.schema, 'launcher-loading-art-review/1');
  assert.equal(review.version, '1.2.9');
  assert.equal(review.assets.length, 20);
  fs.mkdirSync(reportPath, { recursive: true });
  for (const item of review.assets) {
    assert.equal(item.decodedRgbaEqualsPng, true);
    for (const [file, digest] of [[item.source, item.pngSha256], [item.webp, item.webpSha256]]) {
      assert.match(file, /^public\/images\/(?:game_launcher|desktop_launcher)\/[a-z0-9._-]+\.(?:png|webp)$/);
      assert.equal(sha256(fs.readFileSync(path.join(root, file))), digest, `Asset changed: ${file}`);
    }
  }
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.BOARD_QA_CHROME || 'C:/Users/王曜瑋/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 });
    const failures = [];
    page.on('pageerror', error => failures.push(String(error)));
    await page.route('opui://**', route => {
      const relative = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, '');
      const file = path.resolve(root, 'public', relative);
      if (!file.startsWith(path.join(root, 'public') + path.sep) || !fs.existsSync(file)) {
        failures.push(`Missing ${relative}`);
        return route.fulfill({ status: 404, body: 'Missing asset' });
      }
      return route.fulfill({ path: file });
    });
    const images = review.assets.map((item, index) => ({ index, png: item.source.slice('public/'.length), webp: item.webp.slice('public/'.length), width: item.width, height: item.height }));
    const html = '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#122538}main{display:grid;grid-template-columns:repeat(5,200px);gap:16px;padding:16px}figure{margin:0;width:200px;height:196px;background:#204153;display:flex;align-items:center;justify-content:center}img{display:block;max-width:188px;max-height:184px;object-fit:contain}</style><main></main>';
    await page.setContent(html);
    const captures = [];
    for (const format of ['png', 'webp']) {
      const decoded = await page.evaluate(async ({ images, format }) => {
        const container = document.querySelector('main');
        container.replaceChildren();
        return Promise.all(images.map(async item => {
          const figure = document.createElement('figure');
          const img = document.createElement('img');
          figure.append(img); container.append(figure);
          img.src = `opui://launcher/${item[format]}`;
          await img.decode();
          return { index: item.index, width: img.naturalWidth, height: img.naturalHeight };
        }));
      }, { images, format });
      assert.deepEqual(decoded, images.map(item => ({ index: item.index, width: item.width, height: item.height })));
      const file = path.join(reportPath, `launcher-art-${format}.png`);
      const bytes = await page.screenshot({ path: file, fullPage: true });
      captures.push({ format, file, sha256: sha256(bytes), bytes: bytes.length });
    }
    assert.deepEqual(failures, []);
    // Chromium blends and rescales PNG/WebP through different decode paths at
    // transparent edges. Compare the rendered pixels quantitatively, while
    // the source artwork above is checked for exact decoded RGBA equality.
    const comparison = await page.evaluate(async sources => {
      const read = async base64 => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, canvas.width, canvas.height);
      };
      const a = await read(sources[0]); const b = await read(sources[1]);
      if (a.width !== b.width || a.height !== b.height) throw new Error('Screenshot dimensions differ');
      let changed = 0; let overTen = 0; let maximum = 0; let sum = 0;
      for (let index = 0; index < a.data.length; index += 4) {
        const delta = Math.max(...[0, 1, 2, 3].map(channel => Math.abs(a.data[index + channel] - b.data[index + channel])));
        if (delta) changed++;
        if (delta > 10) overTen++;
        maximum = Math.max(maximum, delta); sum += delta;
      }
      const pixels = a.width * a.height;
      return { pixels, changed, overTen, maximum, meanMaximumChannelDelta: sum / pixels };
    }, captures.map(capture => fs.readFileSync(capture.file).toString('base64')));
    assert.ok(comparison.maximum <= 50, `Rendered pixel delta exceeds review bound: ${comparison.maximum}`);
    assert.ok(comparison.overTen / comparison.pixels <= 0.01,
      `Over 1% of pixels have a visible channel delta: ${comparison.overTen}/${comparison.pixels}`);
    assert.ok(comparison.meanMaximumChannelDelta <= 0.5,
      `Rendered mean channel delta exceeds review bound: ${comparison.meanMaximumChannelDelta}`);
    const result = { schema: 'launcher-loading-webp-qa/1', status: 'PASS', assets: images.length,
      sourceBytes: review.originalBytes, webpBytes: review.webpBytes, decodedSourcePixelsIdentical: true,
      browserRenderedComparison: comparison, captures, failures, humanAcceptance: false };
    fs.writeFileSync(path.join(reportPath, 'report.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ status: result.status, assets: result.assets,
      savedBytes: result.sourceBytes - result.webpBytes, browserRenderedComparison: comparison }));
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
