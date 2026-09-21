"use strict";

// Isolated browser fixtures exercise real trusted input and real MP3 decoding.
// No room, game state, server data, or account is loaded by this check.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.BOARD_PLAYWRIGHT_PATH || "C:/Users/王曜瑋/AppData/Local/OpenAI/Codex/runtimes/cua_node/df473e5367fa2b42/bin/node_modules/playwright");
const root = path.resolve(__dirname, "..");
const out = process.env.BOARD_QA_OUTPUT || "D:/Codex_QA/board-audio-20260921/ui";
const results = [];
const errors = [];
const check = (name, value) => { assert.ok(value, name); results.push({ name, passed: true }); };
const fixture = '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/board_audio_ui.css"></head><body style="margin:16px;background:#071c2a;color:white;font-family:system-ui"><div data-board-audio-controls></div><main><button id="tap">查看航線</button><button id="disabled" disabled>無法使用</button><button id="ariaDisabled" aria-disabled="true">未準備</button><span aria-disabled="true"><button id="nestedDisabled">不能出航</button></span><div inert><button id="inert">封鎖操作</button></div><button id="silent" data-board-sfx="off">靜音測試</button><button id="confirm" data-board-sfx="confirm">確認出航</button><button id="outside">其他操作</button></main><script src="/board_audio_ui.js"></script></body></html>';

function instruments() {
  window.__audio = { contexts: 0, starts: [], unlocks: 0, bgm: { enabled: false, volume: 0.34 } };
  const NativeContext = window.AudioContext;
  window.AudioContext = class extends NativeContext {
    constructor(...args) { super(...args); window.__audio.contexts += 1; }
    createBufferSource() {
      const source = super.createBufferSource();
      const start = source.start.bind(source);
      source.start = (...args) => {
        let peak = 0;
        for (let channel = 0; channel < source.buffer.numberOfChannels; channel += 1) {
          for (const sample of source.buffer.getChannelData(channel)) peak = Math.max(peak, Math.abs(sample));
        }
        window.__audio.starts.push({ peak, duration: source.buffer.duration });
        start(...args);
      };
      return source;
    }
  };
  window.Audio = function () { throw new Error("UI SFX must not allocate HTML Audio"); };
  window.BgmManager = {
    unlock() { window.__audio.unlocks += 1; },
    status() { return { ...window.__audio.bgm }; },
    setEnabled(enabled) { window.__audio.bgm.enabled = enabled; localStorage.setItem("board_bgm_enabled", enabled ? "1" : "0"); },
    setVolume(volume) { window.__audio.bgm.volume = volume; localStorage.setItem("board_bgm_volume", String(volume)); },
  };
}

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BOARD_CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe" });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(instruments);
    const assetRequests = new Map();
    await context.route("http://board-audio.test/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === "/" || pathname === "/owner") return route.fulfill({ contentType: "text/html", body: fixture });
      if (pathname === "/wrapper") return route.fulfill({ contentType: "text/html", body: '<!doctype html><iframe src="/owner" style="width:800px;height:600px"></iframe>' });
      const known = { "/board_audio_ui.js": "public/js/board_audio_ui.js", "/board_audio_ui.css": "public/css/board_audio_ui.css" };
      let file = known[pathname];
      if (/^\/audio\/board_game\/sfx\/game01\/game01\/[a-z0-9]+\.mp3$/.test(pathname)) {
        file = `public${pathname}`;
        assetRequests.set(pathname, (assetRequests.get(pathname) || 0) + 1);
      }
      if (!file) return route.fulfill({ status: 404, body: "Unknown fixture" });
      return route.fulfill({ contentType: file.endsWith(".mp3") ? "audio/mpeg" : file.endsWith(".css") ? "text/css" : "application/javascript", body: fs.readFileSync(path.join(root, file)) });
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://board-audio.test/");
    const starts = () => page.evaluate(() => window.__audio.starts.length);
    check("one controls mount", await page.locator(".board-audio").count() === 1);
    check("no audio context before gesture", await page.evaluate(() => __audio.contexts === 0));
    await page.evaluate(() => document.querySelector("#tap").click());
    check("synthetic CPU click is silent", await starts() === 0);
    check("synthetic click does not unlock", await page.evaluate(() => __audio.unlocks === 0));
    await page.click("#tap");
    check("trusted pointer click starts exactly one cue", await starts() === 1);
    check("one AudioContext", await page.evaluate(() => __audio.contexts === 1));
    check("gesture unlocks BGM without unmuting", await page.evaluate(() => __audio.unlocks > 0 && __audio.bgm.enabled === false));
    await page.waitForFunction(() => BoardAudio.status().loadedAssets === 8);
    check("eight existing MP3s decoded", await page.evaluate(() => BoardAudio.status().loadedAssets === 8));
    check("each audio fetched only once", assetRequests.size === 8 && [...assetRequests.values()].every((count) => count === 1));
    await page.waitForTimeout(100);
    await page.click("#tap");
    check("decoded button sound replaces fallback", await page.evaluate(() => __audio.starts.at(-1).duration > 0.20 && __audio.starts.at(-1).duration < 0.4));
    await page.waitForTimeout(110);
    let count = await starts();
    await page.locator("#tap").focus();
    await page.keyboard.press("Enter");
    check("keyboard Enter starts exactly one cue", await starts() === count + 1);
    await page.waitForTimeout(110);
    count = await starts();
    await page.keyboard.down("Enter");
    await page.waitForTimeout(110);
    await page.keyboard.down("Enter");
    await page.waitForTimeout(110);
    await page.keyboard.down("Enter");
    await page.keyboard.up("Enter");
    check("held Enter repeat does not spam", await starts() === count + 1);
    await page.waitForTimeout(110);
    count = await starts();
    await page.keyboard.press("Space");
    check("keyboard Space starts exactly one cue", await starts() === count + 1);
    for (const selector of ["#disabled", "#ariaDisabled", "#nestedDisabled", "#inert", "#silent"]) {
      await page.waitForTimeout(100);
      count = await starts();
      const rect = await page.locator(selector).boundingBox();
      await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
      check(`${selector} is silent`, await starts() === count);
    }
    await page.evaluate(() => { BoardAudio.installDocument(document); BoardAudio.installDocument(document); });
    await page.waitForTimeout(100);
    count = await starts();
    await page.click("#tap");
    check("repeated install has no duplicate handlers", await starts() === count + 1);

    await page.click(".board-audio__trigger");
    check("sound settings accessible dialog opens", await page.locator('[role="dialog"]').isVisible());
    check("settings initial focus", await page.evaluate(() => document.activeElement.classList.contains("board-audio__bgm-enabled")));
    await page.locator(".board-audio__bgm-enabled").check();
    check("BGM checkbox delegates explicit unmute", await page.evaluate(() => __audio.bgm.enabled && localStorage.getItem("board_bgm_enabled") === "1"));
    await page.locator(".board-audio__bgm-enabled").uncheck();
    await page.locator(".board-audio__sfx-enabled").uncheck();
    check("SFX mute persists independently", await page.evaluate(() => !BoardAudio.status().enabled && localStorage.getItem("board_sfx_enabled") === "0" && __audio.bgm.enabled === false));
    check("SFX mute stops active voices", await page.evaluate(() => BoardAudio.status().activeVoices === 0));
    count = await starts();
    await page.click(".board-audio__sample");
    check("preview respects SFX mute", await starts() === count);
    await page.locator(".board-audio__sfx-enabled").check();
    await page.locator(".board-audio__sfx-volume").fill("37");
    await page.locator(".board-audio__bgm-volume").fill("21");
    check("separate volume preferences", await page.evaluate(() => BoardAudio.status().volume === 0.37 && __audio.bgm.volume === 0.21 && localStorage.getItem("board_sfx_volume") === "0.37"));
    await page.keyboard.press("Escape");
    check("Escape closes and restores focus", await page.evaluate(() => document.querySelector(".board-audio__panel").hidden && document.activeElement.classList.contains("board-audio__trigger")));
    await page.click(".board-audio__trigger");
    await page.mouse.click(1000, 700);
    check("outside click closes settings", await page.locator(".board-audio__panel").isHidden());
    await page.evaluate(() => BoardAudio.mountControls());
    check("mount API is idempotent", await page.locator(".board-audio").count() === 1);

    await page.evaluate(() => { const frame = document.createElement("iframe"); frame.id = "battleFixture"; frame.srcdoc = '<button id="frameButton">選擇角色</button><script src="http://board-audio.test/board_audio_ui.js"><\/script>'; document.body.append(frame); });
    const frame = page.frameLocator("#battleFixture");
    await frame.locator("#frameButton").waitFor();
    await page.waitForFunction(() => document.querySelector("#battleFixture").contentWindow.BoardAudio === BoardAudio);
    check("iframe proxies exact parent mixer", await page.evaluate(() => document.querySelector("#battleFixture").contentWindow.BoardAudio === BoardAudio));
    check("iframe has no duplicated controls", await frame.locator(".board-audio").count() === 0);
    await page.waitForTimeout(110);
    count = await starts();
    await frame.locator("#frameButton").click();
    check("trusted iframe click plays in parent exactly once", await starts() === count + 1);
    check("iframe creates no context", await page.evaluate(() => document.querySelector("#battleFixture").contentWindow.__audio.contexts === 0));
    await page.waitForTimeout(100);
    await page.evaluate(() => { BoardAudio.playCue("reward"); document.querySelector("#battleFixture").remove(); });
    check("iframe unload leaves parent sound playing", await page.evaluate(() => BoardAudio.status().activeVoices > 0));

    await page.evaluate(() => BoardAudio.setVolume(1));
    let bounded = true;
    for (const kind of ["reward", "heal", "victory", "danger", "defeat", "draw"]) {
      await page.waitForTimeout(90);
      await page.evaluate((cue) => BoardAudio.playCue(cue), kind);
      bounded &&= await page.evaluate(() => BoardAudio.status().activeVoices <= 4);
    }
    check("simultaneous voices remain bounded at four", bounded);
    check("every source normalized below peak 0.651", await page.evaluate(() => __audio.starts.every((entry) => entry.peak <= 0.651 && entry.peak > 0)));
    check("four voices cannot clip at maximum gain", 4 * 0.651 * 0.32 < 1);
    await page.waitForTimeout(100);
    count = await starts();
    await page.evaluate(() => { for (let i = 0; i < 100; i += 1) BoardAudio.playCue("tap"); });
    check("burst call throttling", await starts() <= count + 1);
    check("unknown cue safely rejected", await page.evaluate(() => BoardAudio.playCue("missing") === false));
    await page.evaluate(() => { BoardAudio.setEnabled(false); BoardAudio.setVolume(NaN); });
    check("invalid volume remains finite", await page.evaluate(() => Number.isFinite(BoardAudio.status().volume)));
    await page.reload();
    check("SFX mute persists after reload", await page.evaluate(() => BoardAudio.status().enabled === false));

    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 932, height: 430 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(viewport);
      await page.click(".board-audio__trigger");
      await page.waitForTimeout(220);
      check(`settings visible after motion ${viewport.width}x${viewport.height}`, await page.locator(".board-audio__panel").evaluate((panel) => !panel.hidden && Number(getComputedStyle(panel).opacity) > 0.99));
      const rect = await page.locator(".board-audio__panel").boundingBox();
      check(`settings fits ${viewport.width}x${viewport.height}`, rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= viewport.width + 1 && rect.y + rect.height <= viewport.height + 1);
      await page.screenshot({ path: path.join(out, `settings-${viewport.width}x${viewport.height}.png`) });
      await page.keyboard.press("Escape");
    }

    const wrapperPage = await context.newPage();
    await wrapperPage.goto("http://board-audio.test/wrapper");
    await wrapperPage.frameLocator("iframe").locator(".board-audio__trigger").waitFor();
    check("viewport wrapper child owns controls when ancestor has no mixer", await wrapperPage.frameLocator("iframe").locator(".board-audio").count() === 1);
    await wrapperPage.close();

    const missingPage = await context.newPage();
    missingPage.on("pageerror", (error) => errors.push(error.message));
    await missingPage.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
    await missingPage.goto("http://board-audio.test/");
    await missingPage.click("#tap");
    check("missing Web Audio fails gracefully", await missingPage.evaluate(() => BoardAudio.status().available === false && BoardAudio.playCue("confirm") === false));
    await missingPage.close();

    const blockedPage = await context.newPage();
    blockedPage.on("pageerror", (error) => errors.push(error.message));
    await blockedPage.addInitScript(() => { localStorage.setItem("board_sfx_enabled", "1"); });
    await blockedPage.route("**/audio/**", (route) => route.fulfill({ status: 503, body: "Audio unavailable" }));
    await blockedPage.goto("http://board-audio.test/");
    await blockedPage.click("#tap");
    await blockedPage.waitForTimeout(200);
    check("failed asset requests retain immediate fallback", await blockedPage.evaluate(() => __audio.starts.length === 1 && BoardAudio.status().cachedCues === 1 && BoardAudio.status().loadedAssets === 0));
    await blockedPage.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
    check("owner pagehide stops voices and relocks", await blockedPage.evaluate(() => BoardAudio.status().activeVoices === 0 && BoardAudio.status().unlocked === false));
    await blockedPage.close();
    check("no browser exceptions", errors.length === 0);
    await context.close();
  } finally { await browser.close(); }
  const report = { passed: results.length, failed: 0, errors, checks: results, testedAt: new Date().toISOString(), evidence: "Isolated Chromium fixtures: trusted UI input, existing MP3 decode, responsive controls, parent/iframe ownership. No human listening or physical-device claim." };
  fs.writeFileSync(path.join(out, "board-audio-ui-report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ passed: report.passed, failed: 0, output: out }));
}

main().catch((error) => { fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, "board-audio-ui-failure.json"), JSON.stringify({ message: error.message, stack: error.stack, checks: results, errors }, null, 2)); console.error(error); process.exitCode = 1; });
