const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/kuma_paw_ship_20260815_v64";

function captureErrors(page, errors) {
  page.on("pageerror", (error) => errors.push(`pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(`console:${message.text()}`);
  });
}

async function prepare(page) {
  return page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const runtime = debug.getState();
    const player = runtime.gameState.players[0];
    if (!runtime.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "kuma-paw-ship-qa" });
    debug.ensurePostgameWorldLayout(runtime.gameState);
    const assignment = runtime.gameState.postgameWorld.islandAssignments[0];
    if (!assignment) throw new Error("postgame destination missing");
    player.location = { kind: "island", islandId: "final-island" };
    player.pendingPostgameBossVoyage = null;
    debug.renderAll();
    document.querySelectorAll(".board-modal-backdrop, .board-modal").forEach((element) => element.remove());
    return {
      playerId: player.id,
      playerName: player.name,
      islandId: assignment.islandId,
      shipImage: "images/board/ships/ship_01.webp",
    };
  });
}

async function play(page, detail, id) {
  await page.evaluate(({ detail: voyageDetail, eventId }) => {
    window.__BOARD_GAME_DEBUG__.kumaPawVoyageQa.play({
      id: eventId,
      playerId: voyageDetail.playerId,
      playerName: voyageDetail.playerName,
      duration: 1900,
      detail: { ...voyageDetail, phase: "arrival", mapDuration: 1900 },
    });
  }, { detail, eventId: id });
  await page.waitForFunction(() => document.querySelector(".kuma-paw-map-layer.moving .kuma-paw-map-token"));
}

async function inspectFlight(page) {
  return page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const probe = document.createElement("div");
    probe.className = "kuma-paw-map-token";
    probe.innerHTML = '<img class="kuma-paw-map-ship" alt="">';
    document.body.appendChild(probe);
    debug.kumaPawVoyageQa.pose(probe, { x: 100, y: 100 }, 137);
    const counter = Number.parseFloat(probe.style.getPropertyValue("--kuma-paw-map-ship-upright")) || 0;
    probe.remove();

    const token = document.querySelector(".kuma-paw-map-token");
    const ship = token?.querySelector(".kuma-paw-map-ship");
    const angleMatch = token?.style.transform.match(/rotate\((-?[\d.]+)deg\)/);
    const tokenAngle = Number(angleMatch?.[1] || 0);
    const shipCounter = Number.parseFloat(token?.style.getPropertyValue("--kuma-paw-map-ship-upright")) || 0;
    const normalizedWorldAngle = ((tokenAngle + shipCounter + 180) % 360 + 360) % 360 - 180;
    return {
      probeCounter: counter,
      tokenAngle,
      shipCounter,
      normalizedWorldAngle,
      shipSrc: ship?.currentSrc || ship?.src || "",
      shipNaturalSize: [ship?.naturalWidth || 0, ship?.naturalHeight || 0],
      shipOpacity: Number.parseFloat(getComputedStyle(ship).opacity),
    };
  });
}

async function inspectArrival(page) {
  await page.waitForFunction(() => document.querySelector(".kuma-paw-map-layer.arrived"), null, { timeout: 4000 });
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const layer = document.querySelector(".kuma-paw-map-layer.arrived");
    const burst = layer?.querySelector(".kuma-paw-map-burst.landing");
    const ship = layer?.querySelector(".kuma-paw-map-landing-ship");
    const burstRect = burst?.getBoundingClientRect();
    const shipRect = ship?.getBoundingClientRect();
    const visibleShipCount = Array.from(layer?.querySelectorAll(".kuma-paw-map-ship, .kuma-paw-map-landing-ship") || [])
      .filter((image) => Number.parseFloat(getComputedStyle(image).opacity) > 0.05).length;
    const centerDelta = burstRect && shipRect ? {
      x: Math.abs((burstRect.left + burstRect.width / 2) - (shipRect.left + shipRect.width / 2)),
      y: Math.abs((burstRect.top + burstRect.height / 2) - (shipRect.top + shipRect.height / 2)),
    } : { x: 999, y: 999 };
    return {
      exists: !!ship,
      src: ship?.currentSrc || ship?.src || "",
      naturalSize: [ship?.naturalWidth || 0, ship?.naturalHeight || 0],
      opacity: ship ? Number.parseFloat(getComputedStyle(ship).opacity) : 0,
      centerDelta,
      animationName: ship ? getComputedStyle(ship).animationName : "",
      visibleShipCount,
      brokenImages: Array.from(layer?.querySelectorAll("img") || []).filter((image) => image.complete && !image.naturalWidth).map((image) => image.src),
    };
  });
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  const failures = [];
  captureErrors(page, errors);
  await page.goto(`${ROOT_URL}/board_game.html?kuma_paw_ship_qa=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.kumaPawVoyageQa && document.getElementById("boardGameMap"), null, { timeout: 20000 });

  const desktopDetail = await prepare(page);
  await play(page, desktopDetail, `kuma-paw-desktop-${Date.now()}`);
  await page.waitForTimeout(650);
  const desktopFlight = await inspectFlight(page);
  await page.screenshot({ path: path.join(OUTPUT_DIR, "kuma_paw_flight_desktop.png") });
  const desktopArrival = await inspectArrival(page);
  await page.screenshot({ path: path.join(OUTPUT_DIR, "kuma_paw_arrival_desktop.png") });
  await page.waitForFunction(() => !document.querySelector(".kuma-paw-map-layer"), null, { timeout: 3000 });

  await page.setViewportSize({ width: 932, height: 430 });
  const mobileDetail = await prepare(page);
  await play(page, mobileDetail, `kuma-paw-mobile-${Date.now()}`);
  const mobileArrival = await inspectArrival(page);
  await page.screenshot({ path: path.join(OUTPUT_DIR, "kuma_paw_arrival_932x430.png") });

  if (desktopFlight.probeCounter !== -137 || Math.abs(desktopFlight.normalizedWorldAngle) > 0.01 || !desktopFlight.shipNaturalSize.every(Boolean) || desktopFlight.shipOpacity <= 0) failures.push("flight ship upright compensation mismatch");
  if (!desktopArrival.exists || !desktopArrival.naturalSize.every(Boolean) || desktopArrival.opacity <= 0 || desktopArrival.centerDelta.x > 1 || desktopArrival.centerDelta.y > 1 || desktopArrival.animationName !== "kumaPawMapLandingShip" || desktopArrival.visibleShipCount !== 1 || desktopArrival.brokenImages.length) failures.push("desktop landing ship or palm centering mismatch");
  if (!mobileArrival.exists || !mobileArrival.naturalSize.every(Boolean) || mobileArrival.opacity <= 0 || mobileArrival.centerDelta.x > 1 || mobileArrival.centerDelta.y > 1 || mobileArrival.animationName !== "kumaPawMapLandingShip" || mobileArrival.visibleShipCount !== 1 || mobileArrival.brokenImages.length) failures.push("mobile landing ship or palm centering mismatch");

  const report = { desktopFlight, desktopArrival, mobileArrival, errors, failures, outputDir: OUTPUT_DIR };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (errors.length || failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
