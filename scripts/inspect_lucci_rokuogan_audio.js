const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const page = await browser.newPage();
  await page.goto(`${ROOT_URL}/board_battle.html`, { waitUntil: "domcontentloaded" });
  const results = await page.evaluate(async (names) => {
    const context = new AudioContext();
    const output = [];
    for (const name of names) {
      const url = `audio/board_game/sfx/postgame_boss/lucci_rokuogan/${name}`;
      const response = await fetch(url, { cache: "no-store" });
      const bytes = await response.arrayBuffer();
      const decoded = await context.decodeAudioData(bytes.slice(0));
      let peak = 0;
      let sumSquares = 0;
      let sampleCount = 0;
      let firstAudible = decoded.length;
      let lastAudible = 0;
      const threshold = 0.012;
      for (let channelIndex = 0; channelIndex < decoded.numberOfChannels; channelIndex += 1) {
        const samples = decoded.getChannelData(channelIndex);
        for (let index = 0; index < samples.length; index += 1) {
          const absolute = Math.abs(samples[index]);
          peak = Math.max(peak, absolute);
          sumSquares += samples[index] * samples[index];
          sampleCount += 1;
          if (absolute >= threshold) {
            firstAudible = Math.min(firstAudible, index);
            lastAudible = Math.max(lastAudible, index);
          }
        }
      }
      output.push({
        name,
        httpStatus: response.status,
        byteLength: bytes.byteLength,
        durationSeconds: Number(decoded.duration.toFixed(3)),
        sampleRate: decoded.sampleRate,
        channels: decoded.numberOfChannels,
        peak: Number(peak.toFixed(4)),
        rms: Number(Math.sqrt(sumSquares / Math.max(1, sampleCount)).toFixed(4)),
        leadingSilenceSeconds: Number((firstAudible / decoded.sampleRate).toFixed(3)),
        trailingSilenceSeconds: Number(Math.max(0, decoded.duration - lastAudible / decoded.sampleRate).toFixed(3)),
      });
    }
    await context.close();
    return output;
  }, ["lucci_rokuogan_call.mp3", "lucci_rokuogan_hit.mp3"]);
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
