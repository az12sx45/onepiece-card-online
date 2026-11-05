'use strict';

// Installer clicks are intercepted before any payload bytes download.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT);
const base = (process.argv[2] || 'http://127.0.0.1:18938').replace(/\/$/, '');
const out = process.argv[3];
const cdn = 'https://game-assets.rihdi.tw';
const windowsArtifact = version => `ONE-PIECE-Tabletop-Launcher-${version}-x64.exe`;
const gameTitles = ['新世界航海錄', '偉大航道爭霸戰', '霸海戰棋', '馬林福特之戰'];
const platforms = [
  {
    id: 'windows', link: '#download-link', info: '#release-info',
    channel: base + '/desktop/launcher-release-v1.json',
    artifact: `${cdn}/desktop/launcher/releases/1.2.33/${windowsArtifact('1.2.33')}`,
    version: '1.2.33', stale: '1.2.32', future: '1.2.34'
  },
  {
    id: 'android', link: '#android-download-link', info: '#android-release-info',
    channel: cdn + '/android/native/launcher-release-v1.json',
    artifact: cdn + '/android/releases/67/PIRATE-ODYSSEY-v067-7f81a035aa68.apk',
    version: 67, stale: 66, future: 68
  },
  {
    id: 'ios', link: '#ios-download-link', info: '#ios-release-info',
    channel: cdn + '/ios/native/launcher-release-v1.json',
    artifact: cdn + '/ios/releases/66/PIRATE-ODYSSEY-v066-8912dd8370ba-UNSIGNED.ipa',
    version: 66, stale: 65, future: 67
  }
];
const desktopUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36';
const androidUA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36';
const macUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
const cases = [
  { name: 'Windows homepage', width: 1366, height: 900, ua: desktopUA, platform: 'Win32', expected: 'windows-card', path: '/' },
  { name: 'Windows intermediate', width: 980, height: 768, ua: desktopUA, platform: 'Win32', expected: 'windows-card' },
  { name: 'Android portrait', width: 390, height: 844, ua: androidUA, platform: 'Linux armv8l', expected: 'android-card' },
  { name: 'Android landscape', width: 844, height: 390, ua: androidUA, platform: 'Linux armv8l', expected: 'android-card' },
  { name: 'iPhone', width: 320, height: 740, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1', platform: 'iPhone', expected: 'ios-card' },
  { name: 'iPad desktop UA', width: 1024, height: 768, ua: macUA, platform: 'MacIntel', touch: 5, expected: 'ios-card' },
  { name: 'macOS', width: 1440, height: 900, ua: macUA, platform: 'MacIntel', expected: null }
];
const modes = ['offline', 'future', 'stale', 'invalid-identity', 'invalid-sha', 'invalid-bytes', 'invalid-origin',
  'invalid-version-url', 'invalid-extension', 'no-js'];

function channelFixture(platform, stable, mode) {
  const fixture = structuredClone(stable);
  const version = mode === 'stale' ? platform.stale : platform.future;
  fixture.artifact.sha256 = 'a'.repeat(64);
  if (platform.id === 'windows') {
    fixture.version = version;
    fixture.artifact.fileName = windowsArtifact(version);
    fixture.artifact.url = `${cdn}/desktop/launcher/releases/${version}/${fixture.artifact.fileName}`;
  } else {
    const short = String(version).padStart(3, '0');
    fixture.version = `0.1.0-native-v${short}`;
    fixture.versionCode = version;
    const extension = platform.id === 'android' ? '.apk' : '-UNSIGNED.ipa';
    fixture.artifact.url = `${cdn}/${platform.id}/releases/${version}/PIRATE-ODYSSEY-v${short}${extension}`;
  }
  if (mode === 'invalid-identity') {
    if (platform.id === 'windows') fixture.arch = 'arm64';
    else if (platform.id === 'android') fixture.package = 'invalid.apk.package';
    else fixture.bundleIdentifier = 'invalid.ipa.bundle';
  } else if (mode === 'invalid-sha') {
    fixture.artifact.sha256 = 'g'.repeat(64);
  } else if (mode === 'invalid-bytes') {
    fixture.artifact.bytes = 0;
  } else if (mode === 'invalid-origin') {
    fixture.artifact.url = fixture.artifact.url.replace(cdn, 'https://example.com');
  } else if (mode === 'invalid-version-url') {
    fixture.artifact.url = fixture.artifact.url.replace('/' + platform.future + '/',
      platform.id === 'windows' ? '/1.2.99/' : '/99/');
  } else if (mode === 'invalid-extension') {
    fixture.artifact.url = fixture.artifact.url.replace(/\.[a-z]+$/i, '.zip');
  }
  return fixture;
}

async function currentReleases() {
  return Object.fromEntries(await Promise.all(platforms.map(async platform => {
    const response = await fetch(platform.channel, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    assert.equal(response.status, 200, platform.channel);
    const release = await response.json();
    assert.equal(release[platform.id === 'windows' ? 'version' : 'versionCode'], platform.version);
    assert.equal(release.artifact.url, platform.artifact);
    assert.match(release.artifact.sha256, /^[a-f0-9]{64}$/);
    return [platform.id, release];
  })));
}

async function run(browser, stable, config) {
  const context = await browser.newContext({ viewport: { width: config.width, height: config.height },
    userAgent: config.ua, javaScriptEnabled: config.mode !== 'no-js', serviceWorkers: 'block' });
  try {
    await context.addInitScript(({ platform, touch }) => {
      Object.defineProperty(navigator, 'platform', { get: () => platform });
      Object.defineProperty(navigator, 'userAgentData', { get: () => undefined });
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => touch || 0 });
    }, config);
    const requests = [];
    const responses = new Map();
    const errors = [];
    const clicks = [];
    let allowClick = false;
    await context.route('**/*', route => {
      const url = route.request().url();
      if (/\.(apk|exe|ipa)(?:\?|$)/i.test(url)) {
        if (!allowClick) errors.push('Automatic installer download: ' + url);
        clicks.push(url);
        return route.fulfill({ status: 204, body: '' });
      }
      requests.push(url);
      const platform = platforms.find(entry => entry.channel === url);
      if (platform && config.mode === 'offline') return route.abort();
      if (platform && config.mode && config.mode !== 'no-js') {
        return route.fulfill({ json: channelFixture(platform, stable[platform.id], config.mode),
          headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => responses.set(response.url(), response.status()));
    const response = await page.goto(base + (config.path || '/download'), { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    const state = await page.evaluate(selectors => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      recommended: document.querySelector('.recommended')?.id || null,
      first: document.querySelector('.downloads > section')?.id,
      note: document.querySelector('#device-note').textContent,
      gamesTitle: document.querySelector('#games-title').textContent,
      games: [...document.querySelectorAll('.game-grid .game h3')].map(element => element.textContent),
      platforms: Object.fromEntries(selectors.map(({ id, link, info }) => {
        const anchor = document.querySelector(link);
        return [id, { href: anchor.href, height: anchor.getBoundingClientRect().height,
          release: document.querySelector(info).textContent }];
      }))
    }), platforms);
    assert(!state.overflow, config.name + ' overflow');
    assert.equal(state.gamesTitle, '桌遊系列 · 四款遊戲');
    assert.deepEqual(state.games, gameTitles, config.name + ' four official game titles');
    assert.equal(state.recommended, config.mode === 'no-js' ? null : config.expected);
    if (['android-card', 'ios-card'].includes(config.expected) && config.mode !== 'no-js') {
      assert.equal(state.first, config.expected);
    }
    if (config.expected === null) assert.match(state.note, /目前沒有 macOS 版/);
    assert(!requests.includes(cdn + '/android/launcher-release-v1.json'), 'Legacy trial channel was queried');
    for (const platform of platforms) {
      const current = state.platforms[platform.id];
      const future = config.mode === 'future';
      assert(current.height >= 44, config.name + ' ' + platform.id + ' touch target');
      assert.equal(requests.includes(platform.channel), config.mode !== 'no-js', platform.channel);
      if (!config.mode) assert.equal(responses.get(platform.channel), 200, platform.channel);
      assert.equal(current.href, future ? channelFixture(platform, stable[platform.id], 'future').artifact.url : platform.artifact,
        config.name + ' ' + platform.id + ' installer');
      const expected = String(future ? platform.future : platform.version);
      assert(current.release.includes(platform.id === 'windows' ? expected : 'v' + expected.padStart(3, '0')),
        config.name + ' ' + platform.id + ' release label: ' + current.release);
    }
    assert.match(state.platforms.ios.release, /需自行簽署/);
    assert.deepEqual(clicks, []);
    allowClick = true;
    for (const platform of platforms) await page.locator(platform.link).click();
    assert.deepEqual(clicks, platforms.map(({ id }) => state.platforms[id].href));
    assert.deepEqual(errors, []);
    if (out && ['Windows homepage', 'Android portrait', 'iPhone'].includes(config.name)) {
      await page.screenshot({ path: out.replace(/\.json$/, '-' + config.name.split(' ')[0] + '.png'), fullPage: true });
    }
    return { name: config.name, state, requests, clicks, errors, ok: true };
  } finally {
    await context.close();
  }
}

(async () => {
  const stable = await currentReleases();
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const results = [];
    for (const config of [...cases, ...modes.map(mode => ({ ...cases[2], name: mode, mode }))]) {
      results.push(await run(browser, stable, config));
    }
    if (out) fs.writeFileSync(out, JSON.stringify({ base, ok: true, cases: results }, null, 2) + '\n');
    console.log(JSON.stringify({ ok: true, base, cases: results.length, out }));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
