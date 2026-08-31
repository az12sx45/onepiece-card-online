"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE_URL = process.env.BOARD_SOCIAL_QA_URL || "http://127.0.0.1:8797";
const OUTPUT_DIR = path.join(__dirname, "..", ".codex", "qa", "board_home_social_v394");
const CHROME_PATH = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

function installAccount(context, account) {
  return context.addInitScript((profile) => {
    localStorage.setItem("op_user_id", String(profile.userId));
    localStorage.setItem("op_secret", profile.secret);
    localStorage.setItem("opSecret", profile.secret);
    localStorage.setItem("op_name", profile.name);
    localStorage.setItem("op_player_name", profile.name);
    localStorage.setItem("op_avatar", String(profile.avatar));
    localStorage.setItem("op_player_avatar", String(profile.avatar));
    localStorage.setItem("op_device_id", profile.deviceId);
    localStorage.setItem("op_fdock_collapsed", "1");
  }, account);
}

async function waitForSocial(page) {
  await page.waitForFunction(() => window.BoardShared?.getState?.().socialReady === true, null, { timeout: 15000 });
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const desktop = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const tablet = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  await installAccount(desktop, {
    userId: 91001,
    secret: "qa-board-secret-a",
    name: "航海測試甲",
    avatar: 8,
    deviceId: "qa-board-device-a",
  });
  await installAccount(tablet, {
    userId: 91002,
    secret: "qa-board-secret-b",
    name: "航海測試乙",
    avatar: 5,
    deviceId: "qa-board-device-b",
  });

  const desktopPage = await desktop.newPage();
  const tabletPage = await tablet.newPage();
  const errors = [];
  for (const [label, page] of [["desktop", desktopPage], ["tablet", tabletPage]]) {
    page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes("Failed to load resource")) {
        errors.push(`${label}:console:${message.text()}`);
      }
    });
    page.on("response", (response) => {
      if (response.status() >= 400 && !response.url().endsWith("/favicon.ico")) {
        errors.push(`${label}:http:${response.status()}:${response.url()}`);
      }
    });
  }

  await Promise.all([
    desktopPage.goto(`${BASE_URL}/board_start.html`, { waitUntil: "networkidle" }),
    tabletPage.goto(`${BASE_URL}/board_start.html`, { waitUntil: "networkidle" }),
  ]);
  await Promise.all([waitForSocial(desktopPage), waitForSocial(tabletPage)]);

  assert.strictEqual(await desktopPage.locator('[data-view="home"]').isVisible(), true, "desktop should start at home menu");
  assert.strictEqual(await desktopPage.locator('.home-menu-btn').count(), 4, "home menu should expose four choices");
  assert.strictEqual(await desktopPage.locator('[data-view="campaigns"]').isVisible(), false, "campaign records must not be expanded on first load");
  assert.strictEqual(await desktopPage.locator('[data-view="modeSelect"]').isVisible(), false, "room choices must not replace the home menu");
  await desktopPage.screenshot({ path: path.join(OUTPUT_DIR, "desktop-home.png"), fullPage: true });

  await desktopPage.click("#openSocialBtn");
  await desktopPage.waitForSelector('[data-view="social"].active');
  await desktopPage.waitForSelector('#boardFriendDock:not(.collapsed)');
  await desktopPage.waitForSelector('#boardFriendList >> text=航海測試乙');
  await desktopPage.waitForSelector('#boardFriendList >> text=航海測試丙');
  assert.strictEqual(await desktopPage.locator('#socialFriendCount').textContent(), "1");
  assert.strictEqual(await desktopPage.locator('#socialOnlineCount').textContent(), "1");
  assert.strictEqual(await desktopPage.locator('#socialRequestCount').textContent(), "1");

  const incomingRow = desktopPage.locator('#boardFriendList .fd-item.req').filter({ hasText: "航海測試丙" });
  await incomingRow.locator('[data-action="accept"]').click();
  await desktopPage.waitForFunction(() => window.BoardShared.getState().friends.length === 2);
  await desktopPage.waitForSelector('#boardFriendList .fd-item:not(.req) >> text=航海測試丙');

  const friendBRow = desktopPage.locator('#boardFriendList .fd-item:not(.req)').filter({ hasText: "航海測試乙" });
  await friendBRow.click();
  const desktopChat = desktopPage.locator('.fd-chatwin').filter({ hasText: "航海測試乙" });
  await desktopChat.locator('input').fill("大富翁正式私訊測試");
  await desktopChat.locator('.fd-send').click();
  await desktopChat.locator('.fd-msg.me').filter({ hasText: "大富翁正式私訊測試" }).waitFor();
  await tabletPage.locator('.fd-chatwin.minimized').waitFor({ timeout: 10000 });
  assert.ok((await tabletPage.locator('.fd-chatwin').textContent()).includes("大富翁正式私訊測試"), "receiver should get DM_NEW immediately");

  await desktopPage.click("#backFromSocialBtn");
  await desktopPage.click("#openBoardFlowBtn");
  await desktopPage.click("#createBoardRoomBtn");
  await desktopPage.waitForSelector('[data-view="lobby"].active');
  const roomCode = String(await desktopPage.locator('#boardLobbyRoomCode').textContent()).trim();
  assert.match(roomCode, /^B[0-9A-Z]+$/);

  await desktopPage.evaluate(() => window.BoardShared.openFriends());
  const lobbyFriendRow = desktopPage.locator('#boardFriendList .fd-item:not(.req)').filter({ hasText: "航海測試乙" });
  await lobbyFriendRow.locator('.fd-morebtn').click();
  await lobbyFriendRow.locator('.fd-menu button').filter({ hasText: "邀請加入房間" }).click();
  await tabletPage.locator('#boardInviteBack').waitFor({ state: "visible", timeout: 10000 });
  assert.ok((await tabletPage.locator('#boardInviteMeta').textContent()).includes(roomCode));
  await tabletPage.click('#boardInviteAccept');
  await tabletPage.waitForURL(new RegExp(`board_start\\.html\\?view=lobby&room=${roomCode}`), { timeout: 15000 });
  await tabletPage.waitForSelector('[data-view="lobby"].active');
  await tabletPage.waitForFunction((expectedRoom) => {
    const state = window.__BOARD_START_DEBUG__?.getState?.();
    return state?.lobby?.roomCode === expectedRoom && state.lobby.players.length === 2;
  }, roomCode, { timeout: 15000 });
  await desktopPage.waitForFunction(() => window.__BOARD_START_DEBUG__?.getState?.().lobby?.players?.length === 2, null, { timeout: 15000 });
  await tabletPage.screenshot({ path: path.join(OUTPUT_DIR, "tablet-two-player-lobby.png"), fullPage: true });

  assert.deepStrictEqual(errors, [], `browser errors: ${errors.join(" | ")}`);
  const result = {
    ok: true,
    roomCode,
    homeChoices: 4,
    friendAccepted: true,
    dmDelivered: true,
    boardInviteAccepted: true,
    lobbyPlayers: 2,
    viewports: ["1600x900", "1024x768"],
    errors,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, "result.json"), JSON.stringify(result, null, 2));
  console.log(`BOARD_HOME_SOCIAL_QA=${JSON.stringify(result)}`);
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
