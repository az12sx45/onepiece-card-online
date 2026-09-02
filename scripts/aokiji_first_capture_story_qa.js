const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || path.join(os.tmpdir(), "one_piece_board_aokiji_first_capture_story_qa");
const FORMAL_PAGE = "board_game.html?skipOpeningStory=1&aokiji_first_capture_story_qa=1";

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function addFailure(failures, condition, message, detail) {
  if (condition) return;
  failures.push(detail === undefined ? message : `${message}: ${JSON.stringify(detail)}`);
}

function attachErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`${label}:console:${message.text()}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !/favicon\.ico(?:\?|$)/.test(response.url())) {
      errors.push(`${label}:http:${response.status()}:${response.url()}`);
    }
  });
}

function storyBeats(definition) {
  return (definition?.chapters || []).flatMap((chapter) => (
    (chapter?.beats || []).map((beat) => ({
      scene: String(chapter?.scene || ""),
      speaker: normalizeText(beat?.speaker || "旁白"),
      text: normalizeText(beat?.text),
      speakerImage: String(beat?.speakerImage || ""),
    }))
  ));
}

async function createQaPage(browser, label, viewport, errors) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  await context.addInitScript(({ runLabel }) => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem("op_board_user_id", `aokiji-qa-${runLabel}`);
      localStorage.setItem("op_board_client_id", `aokiji-qa-client-${runLabel}`);
      localStorage.setItem("op_board_player_name", `青雉QA-${runLabel}`);
      localStorage.setItem("onepiece-board-story-playback-v1", JSON.stringify({ auto: false, speed: 3 }));
    } catch (_error) {
      // about:blank does not expose storage; the script runs again for the formal page origin.
    }
  }, { runLabel: `${label}-${Date.now()}` });
  const page = await context.newPage();
  attachErrors(page, errors, label);
  await page.goto(`${ROOT_URL}/${FORMAL_PAGE}&run=${encodeURIComponent(label)}-${Date.now()}`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForFunction(() => (
    window.__BOARD_GAME_DEBUG__?.aokijiCaptureQa
    && Array.isArray(window.BoardCards?.cards)
    && window.BoardCards.cards.length >= 12
  ), null, { timeout: 30000 });
  return { context, page };
}

async function prepareCase(page, label, options = {}) {
  return page.evaluate(({ runLabel, coins, bounty }) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const player = game.players?.[0];
    if (!player) throw new Error("正式遊戲狀態沒有第一位玩家");
    const sources = window.BoardCards.cards.filter((card) => (
      card?.baseStats?.hp && Array.isArray(card?.moveSet) && card.moveSet.length
    ));
    if (sources.length < 12) throw new Error(`可用測試角色不足：${sources.length}`);

    const makeCrew = (offset) => Array.from({ length: 6 }, (_, index) => {
      const card = debug.cloneFreshDraftRecruit(sources[(offset + index) % sources.length]);
      card.currentHp = Math.max(1, Number(card.baseStats?.hp || card.maxHp || card.currentHp || 1));
      card.battleCarryItem = null;
      (card.moveSet || []).forEach((move) => {
        move.currentPP = Math.max(0, Number(move.pp || 0));
      });
      return card;
    });

    const resetPlayer = (target, name, crew, seen) => {
      target.name = name;
      target.isCPU = false;
      target.isCpu = false;
      target.cpu = false;
      target.coins = Math.max(0, Number(coins || 0));
      target.bounty = Math.max(0, Number(bounty || 0));
      target.crew = crew;
      target.activeCrewIndex = 0;
      target.pendingBattle = null;
      target.routeChoice = null;
      target.items = [];
      target.activeMapBuffs = [];
      target.impelDown = {
        ...(target.impelDown && typeof target.impelDown === "object" && !Array.isArray(target.impelDown)
          ? target.impelDown
          : {}),
        active: false,
        status: "",
        aokijiFirstCaptureStorySeen: seen,
      };
      target.marinefordHold = {
        ...(target.marinefordHold && typeof target.marinefordHold === "object" && !Array.isArray(target.marinefordHold)
          ? target.marinefordHold
          : {}),
        active: false,
      };
      target.location = { kind: "island", islandId: "loguetown", entryDirection: null };
      debug.recalcPlayerDerivedStats(target);
    };

    const originalPlayerId = String(player.id || player.userId || `aokiji-qa-${runLabel}`);
    player.id = originalPlayerId;
    if (!player.userId) player.userId = originalPlayerId;
    resetPlayer(player, `青雉QA-${runLabel}`, makeCrew(0), false);

    const observer = JSON.parse(JSON.stringify(player));
    observer.id = `${originalPlayerId}-observer-${runLabel}`;
    observer.userId = observer.id;
    observer.clientId = `${observer.id}-client`;
    resetPlayer(observer, `觀戰者-${runLabel}`, makeCrew(6), true);

    game.players = [player, observer];
    game.phase = "main";
    game.currentPlayerIndex = 0;
    game.turnIndex = 0;
    game.round = 9;
    game.turnStep = "擲骰前進";
    game.pendingAokijiCaptureStory = null;
    game.pendingMove = null;
    game.movementAnimating = false;
    game.diceRolling = false;
    game.routePrompt = null;
    game.tradePrompt = null;
    game.activeTrade = null;
    game.coopBattlePrompt = null;
    game.islandDecision = null;
    game.resolutionLock = false;
    game.battleExitLock = false;
    state.battleState = null;
    state.battleWindow = null;
    debug.closeModal();
    debug.renderAll();
    debug.closeModal();
    return {
      playerId: String(player.id),
      observerId: String(observer.id),
      crewIds: player.crew.map((card) => card.id),
    };
  }, {
    runLabel: label,
    coins: options.coins ?? 321,
    bounty: options.bounty ?? 4560000,
  });
}

async function depleteCrew(page) {
  await page.evaluate(() => {
    const player = window.__BOARD_GAME_DEBUG__.getCurrentPlayer();
    (player?.crew || []).forEach((card) => {
      card.currentHp = 0;
      (card.moveSet || []).forEach((move) => {
        move.currentPP = 0;
      });
    });
  });
}

async function playerSnapshot(page, playerIndex = 0) {
  return page.evaluate((index) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const player = game.players[index];
    const crew = (player?.crew || []).map((card) => ({
      id: card.id,
      hp: Number(card.currentHp || 0),
      maxHp: Math.max(1, Number(card.baseStats?.hp || card.maxHp || card.hp || 1)),
      moves: (card.moveSet || []).map((move) => ({
        id: move.id,
        pp: Number(move.currentPP || 0),
        maxPp: Math.max(0, Number(move.pp || 0)),
      })),
    }));
    return {
      playerId: String(player?.id || player?.userId || ""),
      currentPlayerId: String(debug.getCurrentPlayer()?.id || debug.getCurrentPlayer()?.userId || ""),
      currentPlayerIndex: Number(game.currentPlayerIndex || 0),
      coins: Number(player?.coins || 0),
      bounty: Number(player?.bounty || 0),
      seen: Boolean(player?.impelDown?.aokijiFirstCaptureStorySeen),
      inImpelDown: Boolean(player?.impelDown?.active),
      impelDownStatus: String(player?.impelDown?.status || ""),
      pending: debug.aokijiCaptureQa.pending(),
      resolutionLock: Boolean(game.resolutionLock),
      battleExitLock: Boolean(game.battleExitLock),
      turnStep: String(game.turnStep || ""),
      battleActive: Boolean(state.battleState),
      crew,
      crewFull: crew.length > 0 && crew.every((card) => (
        card.hp === card.maxHp
        && card.moves.every((move) => move.pp === move.maxPp)
      )),
    };
  }, playerIndex);
}

async function waitForStoryReady(page) {
  await page.waitForFunction(() => {
    const screen = document.querySelector(".final-ending-screen");
    const button = document.getElementById("finalEndingNextBtn");
    const portrait = document.querySelector(".final-ending-speaker-portrait img");
    return screen
      && button
      && !button.disabled
      && (!portrait || (portrait.complete && portrait.naturalWidth > 0));
  }, null, { timeout: 15000 });
  await page.waitForTimeout(80);
}

async function inspectStoryBeat(page) {
  return page.evaluate(() => {
    const visible = (node) => {
      if (!node) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity || 1) > 0
        && rect.width > 1
        && rect.height > 1;
    };
    const screen = document.querySelector(".final-ending-screen");
    const dialogue = document.querySelector(".final-ending-dialogue");
    const portrait = document.querySelector(".final-ending-speaker-portrait img");
    const dialogueRect = dialogue?.getBoundingClientRect();
    const screenRect = screen?.getBoundingClientRect();
    const portraitRect = portrait?.getBoundingClientRect();
    const battleHudSelectors = [
      "#battlePageOverlay.open",
      ".board-modal.battle-modal-shell",
      ".battle-duel",
      ".battle-arena",
    ];
    const battleHudVisible = battleHudSelectors.some((selector) => (
      Array.from(document.querySelectorAll(selector)).some(visible)
    ));
    return {
      scene: Array.from(screen?.classList || []).find((name) => name.startsWith("scene-aokiji-capture")) || "",
      speaker: (document.querySelector(".final-ending-speaker")?.textContent || "旁白").replace(/\s+/g, " ").trim(),
      text: (document.querySelector(".final-ending-lines")?.textContent || "").replace(/\s+/g, " ").trim(),
      portrait: portrait?.getAttribute("src") || "",
      portraitUrl: portrait?.currentSrc || portrait?.src || "",
      background: screen?.style.getPropertyValue("--ending-bg") || "",
      portraitReady: portrait ? portrait.complete && portrait.naturalWidth > 0 : false,
      portraitInsideViewport: !portraitRect || (
        portraitRect.left >= -1
        && portraitRect.top >= -1
        && portraitRect.right <= innerWidth + 1
        && portraitRect.bottom <= innerHeight + 1
      ),
      dialogueInsideViewport: Boolean(dialogueRect)
        && dialogueRect.left >= -1
        && dialogueRect.top >= -1
        && dialogueRect.right <= innerWidth + 1
        && dialogueRect.bottom <= innerHeight + 1,
      screenCoversViewport: Boolean(screenRect)
        && screenRect.left >= -1
        && screenRect.top >= -1
        && screenRect.right <= innerWidth + 1
        && screenRect.bottom <= innerHeight + 1,
      documentOverflow: document.documentElement.scrollWidth > innerWidth + 2
        || document.documentElement.scrollHeight > innerHeight + 2,
      dialogueOverflow: Boolean(dialogue)
        && (dialogue.scrollWidth > dialogue.clientWidth + 2 || dialogue.scrollHeight > dialogue.clientHeight + 3),
      battleHudVisible,
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
}

async function playStoryDefinition(page, definition, label, failures, options = {}) {
  const expected = storyBeats(definition);
  const rendered = [];
  addFailure(failures, expected.length > 0, `${label}: 劇情定義沒有幕次`);
  for (let index = 0; index < expected.length; index += 1) {
    await waitForStoryReady(page);
    const actual = await inspectStoryBeat(page);
    const target = expected[index];
    rendered.push(actual);
    const expectedSceneClass = target.scene.startsWith("scene-") ? target.scene : `scene-${target.scene}`;
    addFailure(failures, actual.scene === expectedSceneClass, `${label}: 第 ${index + 1} 幕場景錯誤`, { expected: expectedSceneClass, actual: actual.scene });
    addFailure(failures, actual.speaker === target.speaker, `${label}: 第 ${index + 1} 幕說話者錯誤`, { expected: target.speaker, actual: actual.speaker });
    addFailure(failures, actual.text === target.text, `${label}: 第 ${index + 1} 幕台詞錯誤`, { expected: target.text, actual: actual.text });
    addFailure(failures, actual.portraitReady, `${label}: 第 ${index + 1} 幕立繪未載入`, actual);
    addFailure(failures, actual.portraitInsideViewport, `${label}: 第 ${index + 1} 幕立繪超出視窗，可能裁到手臂`, actual);
    addFailure(
      failures,
      /images\/board\/story\/aokiji_capture\/source\//.test(actual.portrait.replace(/\\/g, "/"))
        && !/images\/board\/battle\//.test(actual.portrait.replace(/\\/g, "/")),
      `${label}: 第 ${index + 1} 幕用了戰鬥圖或非劇情立繪`,
      actual.portrait
    );
    addFailure(failures, actual.dialogueInsideViewport && actual.screenCoversViewport, `${label}: 第 ${index + 1} 幕超出視窗`, actual);
    addFailure(failures, !actual.documentOverflow && !actual.dialogueOverflow, `${label}: 第 ${index + 1} 幕發生 overflow`, actual);
    addFailure(failures, !actual.battleHudVisible, `${label}: 第 ${index + 1} 幕仍顯示戰鬥 HUD`, actual);
    addFailure(
      failures,
      actual.background.includes("aokiji_capture_bicycle_sea_story_v1.webp"),
      `${label}: 第 ${index + 1} 幕沒有使用青雉自行車冰路海面背景`,
      actual.background
    );
    if (options.screenshotPrefix && (index === 0 || index === expected.length - 1)) {
      const file = `${options.screenshotPrefix}-beat-${String(index + 1).padStart(2, "0")}.png`;
      await page.screenshot({ path: path.join(OUTPUT_DIR, file), animations: "disabled" });
    }
    await page.locator("#finalEndingNextBtn").click();
  }
  return rendered;
}

async function inspectChoice(page) {
  await page.waitForSelector(".final-ending-screen.scene-aokiji-capture-choice", { state: "visible", timeout: 15000 });
  await page.waitForFunction(() => (
    document.getElementById("aokijiCaptureFightBtn")
    && document.getElementById("aokijiCaptureLeaveBtn")
    && !document.getElementById("aokijiCaptureFightBtn").disabled
    && !document.getElementById("aokijiCaptureLeaveBtn").disabled
  ), null, { timeout: 10000 });
  return page.evaluate(() => {
    const screen = document.querySelector(".final-ending-screen.scene-aokiji-capture-choice");
    const dialogue = screen?.querySelector(".final-ending-dialogue");
    const choice = dialogue?.querySelector(".final-ending-inline-choices");
    const modal = screen?.closest(".board-modal") || screen;
    const buttons = Array.from(choice?.querySelectorAll("button[data-final-ending-choice]") || []);
    const portrait = screen?.querySelector(".final-ending-speaker-portrait img");
    const choiceRect = choice?.getBoundingClientRect();
    const modalRect = modal?.getBoundingClientRect();
    const dialogueRect = dialogue?.getBoundingClientRect();
    const within = (rect) => Boolean(rect)
      && rect.left >= -1
      && rect.top >= -1
      && rect.right <= innerWidth + 1
      && rect.bottom <= innerHeight + 1;
    const battleOverlay = document.getElementById("battlePageOverlay");
    const battleOverlayVisible = Boolean(battleOverlay?.classList.contains("open"))
      && getComputedStyle(battleOverlay).display !== "none";
    return {
      buttonCount: buttons.length,
      buttons: buttons.map((button) => ({
        id: button.id,
        text: button.textContent.replace(/\s+/g, " ").trim(),
        disabled: button.disabled,
        insideViewport: within(button.getBoundingClientRect()),
      })),
      portrait: portrait?.getAttribute("src") || "",
      portraitReady: Boolean(portrait?.complete && portrait.naturalWidth > 0),
      background: screen?.style.getPropertyValue("--ending-bg") || "",
      screenClass: screen?.className || "",
      fullscreen: Boolean(modal?.classList.contains("final-ending-fullscreen-modal")),
      choiceInsideStoryDialogue: Boolean(dialogue?.contains(choice)),
      choiceInsideViewport: within(choiceRect),
      modalInsideViewport: within(modalRect) && within(dialogueRect),
      documentOverflow: document.documentElement.scrollWidth > innerWidth + 2
        || document.documentElement.scrollHeight > innerHeight + 2,
      choiceOverflow: Boolean(dialogue)
        && (dialogue.scrollWidth > dialogue.clientWidth + 2 || dialogue.scrollHeight > dialogue.clientHeight + 3),
      battleHudVisible: battleOverlayVisible,
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
}

function assertChoice(choice, label, failures) {
  const ids = choice.buttons.map((button) => button.id).sort();
  addFailure(failures, choice.buttonCount === 2, `${label}: 選擇不是恰好兩顆按鈕`, choice);
  addFailure(
    failures,
    JSON.stringify(ids) === JSON.stringify(["aokijiCaptureFightBtn", "aokijiCaptureLeaveBtn"].sort()),
    `${label}: 選擇按鈕 ID 不符`,
    ids
  );
  addFailure(failures, choice.buttons.every((button) => !button.disabled), `${label}: 控制玩家的選擇按鈕被鎖定`, choice.buttons);
  addFailure(failures, choice.buttons.every((button) => button.insideViewport), `${label}: 選擇按鈕超出視窗`, choice.buttons);
  addFailure(
    failures,
    choice.buttons.every((button) => !/[逃跑離開]|快走/.test(button.text)),
    `${label}: 對話選項仍使用逃跑／離開語意`,
    choice.buttons
  );
  addFailure(
    failures,
    /images\/board\/story\/aokiji_capture\/source\//.test(choice.portrait.replace(/\\/g, "/"))
      && !/images\/board\/battle\//.test(choice.portrait.replace(/\\/g, "/")),
    `${label}: 選擇介面用了戰鬥圖或非劇情立繪`,
    choice.portrait
  );
  addFailure(failures, choice.portraitReady, `${label}: 選擇介面立繪未載入`, choice);
  addFailure(
    failures,
    choice.fullscreen
      && choice.choiceInsideStoryDialogue
      && choice.screenClass.includes("final-ending-cinematic")
      && choice.background.includes("aokiji_capture_bicycle_sea_story_v1.webp"),
    `${label}: 選項沒有留在同一個全螢幕劇情背景與對話框`,
    choice
  );
  addFailure(failures, choice.choiceInsideViewport && choice.modalInsideViewport, `${label}: 選擇介面超出視窗`, choice);
  addFailure(failures, !choice.documentOverflow && !choice.choiceOverflow, `${label}: 選擇介面發生 overflow`, choice);
  addFailure(failures, !choice.battleHudVisible, `${label}: 選擇介面仍顯示戰鬥 HUD`, choice);
}

async function clickChoiceAndPlayResponse(page, choice, definition, label, failures, screenshotPrefix) {
  const buttonId = choice === "fight" ? "aokijiCaptureFightBtn" : "aokijiCaptureLeaveBtn";
  await page.locator(`#${buttonId}`).click();
  await page.evaluate(() => window.__BOARD_GAME_DEBUG__.aokijiCaptureQa.present());
  return playStoryDefinition(page, definition, label, failures, { screenshotPrefix });
}

async function triggerWipeout(page) {
  return page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const player = debug.getCurrentPlayer();
    const triggered = debug.aokijiCaptureQa.triggerWipeout(player, "QA 全隊瀕死");
    debug.aokijiCaptureQa.present();
    return { triggered, pending: debug.aokijiCaptureQa.pending() };
  });
}

async function triggerBerryShortage(page, amount = 999) {
  return page.evaluate((loss) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const player = debug.getCurrentPlayer();
    const result = debug.aokijiCaptureQa.triggerBerryShortage(player, loss, "QA 罰款");
    debug.renderAll();
    debug.aokijiCaptureQa.present();
    return { result, pending: debug.aokijiCaptureQa.pending() };
  }, amount);
}

async function stageBattleLossStory(page) {
  return page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const player = debug.getCurrentPlayer();
    const result = debug.aokijiCaptureQa.requestCapture(player, "QA 原戰鬥失敗", {
      source: "battle_loss",
      resumeMode: "end_turn",
    });
    debug.renderAll();
    debug.aokijiCaptureQa.present();
    return { result, pending: debug.aokijiCaptureQa.pending() };
  });
}

async function waitForChoice(page) {
  await page.waitForSelector(".final-ending-screen.scene-aokiji-capture-choice .final-ending-inline-choices", { state: "visible", timeout: 15000 });
}

async function waitForStoryCompletion(page, expectedCurrentPlayerIndex) {
  await page.waitForFunction((targetIndex) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    return !debug.aokijiCaptureQa.pending()
      && !document.querySelector(".final-ending-screen")
      && Number(state.gameState.currentPlayerIndex || 0) === targetIndex;
  }, expectedCurrentPlayerIndex, { timeout: 15000 });
  await page.waitForTimeout(120);
}

async function definitionContract(page, failures, label) {
  const definitions = await page.evaluate(() => window.__BOARD_GAME_DEBUG__.aokijiCaptureQa.definitions());
  const storyDefinitions = [definitions.intro, definitions.choice, definitions.leave, definitions.fight];
  const paths = storyDefinitions
    .flatMap((definition) => (definition?.chapters || []))
    .flatMap((chapter) => chapter?.beats || [])
    .map((beat) => String(beat?.speakerImage || ""));
  const backgrounds = storyDefinitions
    .flatMap((definition) => (definition?.chapters || []))
    .map((chapter) => String(chapter?.bg || ""));
  addFailure(failures, paths.length === 7, `${label}: 青雉劇情立繪引用數量錯誤`, paths);
  paths.forEach((portrait, index) => {
    const normalized = portrait.replace(/\\/g, "/");
    addFailure(
      failures,
      /images\/board\/story\/aokiji_capture\/source\//.test(normalized)
        && !/images\/board\/battle\//.test(normalized),
      `${label}: 定義中的第 ${index + 1} 張立繪不是獨立劇情圖`,
      portrait
    );
  });
  addFailure(
    failures,
    backgrounds.length === 5 && backgrounds.every((background) => background.endsWith("aokiji_capture_bicycle_sea_story_v1.webp")),
    `${label}: 青雉劇情沒有全程使用自行車冰路海面背景`,
    backgrounds
  );
  addFailure(
    failures,
    Array.isArray(definitions.choices)
      && definitions.choices.length === 2
      && definitions.choices.every((choice) => !/[逃跑離開]|快走/.test(String(choice?.label || ""))),
    `${label}: 青雉劇情對話選項文案不符`,
    definitions.choices
  );
  return definitions;
}

async function runWipeoutLeaveViewport(browser, label, viewport, errors, failures) {
  const { context, page } = await createQaPage(browser, label, viewport, errors);
  try {
    const prepared = await prepareCase(page, label);
    const definitions = await definitionContract(page, failures, label);
    await depleteCrew(page);
    const triggered = await triggerWipeout(page);
    const staged = await playerSnapshot(page);
    addFailure(failures, triggered.triggered === true, `${label}: wipeout 沒有被正式入口接住`, triggered);
    addFailure(failures, staged.crewFull, `${label}: 首次 wipeout 沒有補滿全隊 HP/PP`, staged.crew);
    addFailure(failures, Boolean(staged.pending), `${label}: 首次 wipeout 沒有 pending 劇情`, staged);
    addFailure(failures, staged.pending?.source === "map_wipeout", `${label}: wipeout pending source 錯誤`, staged.pending);
    addFailure(failures, staged.pending?.resumeMode === "continue_turn", `${label}: wipeout resumeMode 錯誤`, staged.pending);
    addFailure(failures, staged.seen && !staged.inImpelDown && staged.resolutionLock, `${label}: 首次 wipeout 攔截狀態錯誤`, staged);

    const intro = await playStoryDefinition(page, definitions.intro, `${label}:intro`, failures, {
      screenshotPrefix: `${label}-intro`,
    });
    await waitForChoice(page);
    const choice = await inspectChoice(page);
    assertChoice(choice, `${label}:choice`, failures);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${label}-choice.png`), animations: "disabled" });
    const leaveResponse = await clickChoiceAndPlayResponse(
      page,
      "leave",
      definitions.leave,
      `${label}:leave-response`,
      failures,
      `${label}-leave`
    );
    await waitForStoryCompletion(page, 0);
    const released = await playerSnapshot(page);
    addFailure(failures, !released.inImpelDown, `${label}: 接受放行後仍進入推進城`, released);
    addFailure(failures, !released.pending && !released.resolutionLock, `${label}: 接受放行後 pending/鎖定未清除`, released);
    addFailure(failures, released.turnStep === "擲骰前進", `${label}: map wipeout 放行後沒有續留本回合`, released);
    addFailure(failures, released.currentPlayerId === prepared.playerId, `${label}: map wipeout 放行後錯誤換人`, released);

    await depleteCrew(page);
    const secondTrigger = await triggerWipeout(page);
    await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__.getCurrentPlayer()?.impelDown?.active === true, null, { timeout: 10000 });
    const second = await playerSnapshot(page);
    const storyVisibleAfterSecond = await page.evaluate(() => Boolean(document.querySelector(".final-ending-screen")));
    addFailure(failures, secondTrigger.triggered === true, `${label}: 第二次 wipeout 沒有完成處理`, secondTrigger);
    addFailure(failures, !second.pending && second.inImpelDown, `${label}: 第二次不是直接進推進城`, second);
    addFailure(failures, second.crewFull, `${label}: 第二次入推進城沒有補滿 HP/PP`, second.crew);
    addFailure(failures, !storyVisibleAfterSecond, `${label}: 第二次入推進城仍重播青雉劇情`);

    return {
      label,
      viewport,
      prepared,
      staged,
      intro,
      choice,
      leaveResponse,
      released,
      second,
      storyVisibleAfterSecond,
    };
  } finally {
    await context.close();
  }
}

async function runBerryShortage(browser, errors, failures) {
  const label = "berry-shortage";
  const viewport = { width: 1600, height: 900 };
  const { context, page } = await createQaPage(browser, label, viewport, errors);
  try {
    const prepared = await prepareCase(page, label, { coins: 25 });
    const definitions = await definitionContract(page, failures, label);
    await depleteCrew(page);
    const trigger = await triggerBerryShortage(page, 999);
    const staged = await playerSnapshot(page);
    addFailure(failures, trigger.result?.aokijiCaptureStoryPending === true, `${label}: 貝里不足沒有回報 pending`, trigger);
    addFailure(failures, staged.coins === 0, `${label}: 貝里不足後沒有歸零`, staged);
    addFailure(failures, staged.crewFull, `${label}: 貝里不足攔截後沒有補滿 HP/PP`, staged.crew);
    addFailure(failures, staged.pending?.source === "berry_penalty", `${label}: pending source 錯誤`, staged.pending);
    addFailure(failures, staged.pending?.resumeMode === "end_turn", `${label}: pending resumeMode 不是 end_turn`, staged.pending);
    addFailure(failures, !staged.inImpelDown, `${label}: 首次罰款不足不應立即入推進城`, staged);

    await playStoryDefinition(page, definitions.intro, `${label}:intro`, failures);
    await waitForChoice(page);
    const choice = await inspectChoice(page);
    assertChoice(choice, `${label}:choice`, failures);
    await clickChoiceAndPlayResponse(page, "leave", definitions.leave, `${label}:leave-response`, failures);
    await waitForStoryCompletion(page, 1);
    const released = await playerSnapshot(page);
    addFailure(failures, released.coins === 0 && !released.inImpelDown, `${label}: 放行後貝里/推進城狀態錯誤`, released);
    addFailure(failures, released.currentPlayerId === prepared.observerId, `${label}: end_turn 沒有交給下一位玩家`, released);
    addFailure(failures, released.turnStep === "擲骰前進", `${label}: end_turn 後回合步驟錯誤`, released);
    return { label, viewport, prepared, trigger, staged, choice, released };
  } finally {
    await context.close();
  }
}

async function enterAokijiBattle(page, label, definitions, failures) {
  const staged = await stageBattleLossStory(page);
  addFailure(failures, staged.result?.intercepted === true, `${label}: 原戰敗沒有攔截成首次劇情`, staged);
  await playStoryDefinition(page, definitions.intro, `${label}:intro`, failures);
  await waitForChoice(page);
  const choice = await inspectChoice(page);
  assertChoice(choice, `${label}:choice`, failures);
  await clickChoiceAndPlayResponse(page, "fight", definitions.fight, `${label}:fight-response`, failures);
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__.getState().battleState?.isAokijiCaptureStoryBattle === true, null, { timeout: 15000 });
  const battle = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const active = debug.getState().battleState;
    const enemy = active?.enemyCombatant || {};
    return {
      isAokijiCaptureStoryBattle: Boolean(active?.isAokijiCaptureStoryBattle),
      isStoryTrialBattle: Boolean(active?.isStoryTrialBattle),
      storyId: String(active?.storyId || ""),
      enemyKey: String(enemy.key || active?.enemyKey || ""),
      level: Number(enemy.level || 0),
      maxHp: Number(enemy.maxHp || 0),
      currentHp: Number(enemy.currentHp || 0),
      atk: Number(enemy.atk || 0),
      def: Number(enemy.def || 0),
      satk: Number(enemy.satk || 0),
      sdef: Number(enemy.sdef || 0),
      spd: Number(enemy.spd || 0),
      expectedProfile: debug.aokijiCaptureQa.battleProfile(),
      noEscape: Boolean(active?.noEscape),
      isNoEscape: Boolean(active?.isNoEscape),
      noCoop: Boolean(active?.noCoop),
      noRewards: Boolean(active?.noRewards),
      noDrops: Boolean(active?.noDrops),
      noLineageExtraction: Boolean(active?.noLineageExtraction),
      escapeThreshold: Number(active?.escapeThreshold || 0),
      pending: window.__BOARD_GAME_DEBUG__.aokijiCaptureQa.pending(),
    };
  });
  addFailure(failures, battle.isAokijiCaptureStoryBattle && battle.isStoryTrialBattle, `${label}: 青雉戰鬥種類旗標錯誤`, battle);
  addFailure(failures, battle.enemyKey === "aokiji", `${label}: 敵人不是正式青雉 key`, battle);
  addFailure(failures, battle.level === 99, `${label}: 青雉試探戰不是最高等級 Lv.99`, battle);
  addFailure(
    failures,
    ["maxHp", "atk", "def", "satk", "sdef", "spd"].every((key) => battle[key] === Number(battle.expectedProfile?.[key] || 0))
      && battle.currentHp === battle.maxHp
      && battle.maxHp > 720
      && battle.atk > 45
      && battle.def > 42
      && battle.satk > 52
      && battle.sdef > 44
      && battle.spd > 38,
    `${label}: 青雉試探戰沒有套用完整 Lv.99 強化能力`,
    battle
  );
  addFailure(failures, battle.noEscape && battle.isNoEscape && battle.escapeThreshold === 0, `${label}: 青雉試探戰仍允許逃跑`, battle);
  addFailure(failures, battle.noCoop, `${label}: 青雉試探戰仍允許共鬥`, battle);
  addFailure(failures, battle.noRewards && battle.noDrops && battle.noLineageExtraction, `${label}: 青雉試探戰獎勵封鎖旗標不完整`, battle);
  addFailure(failures, battle.pending?.phase === "battle" && battle.pending?.choice === "fight", `${label}: 青雉戰鬥 pending 狀態錯誤`, battle);
  return { staged, choice, battle };
}

async function rewardSnapshot(page) {
  return page.evaluate(() => {
    const player = window.__BOARD_GAME_DEBUG__.getState().gameState.players[0];
    return {
      coins: Number(player?.coins || 0),
      bounty: Number(player?.bounty || 0),
      items: JSON.parse(JSON.stringify(player?.items || [])),
      inventory: JSON.parse(JSON.stringify(player?.inventory || [])),
      researchPoints: Number(player?.researchPoints || 0),
      lineageFactors: JSON.parse(JSON.stringify(player?.lineageFactors || [])),
      crewProgress: (player?.crew || []).map((card) => ({
        id: card.id,
        level: Number(card.level || 0),
        exp: Number(card.exp || 0),
      })),
    };
  });
}

async function forceBattleResult(page, result) {
  await page.evaluate(async (forcedResult) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const battle = debug.getState().battleState;
    if (!battle?.isAokijiCaptureStoryBattle) throw new Error("找不到青雉首次攔截戰鬥");
    if (forcedResult === "lose") {
      const player = debug.getState().gameState.players[0];
      (player?.crew || []).forEach((card) => {
        card.currentHp = 0;
        (card.moveSet || []).forEach((move) => {
          move.currentPP = 0;
        });
      });
    }
    battle.result = forcedResult;
    battle.roundResolved = true;
    battle.animating = false;
    battle.waitingResume = false;
    battle.needsReplacement = false;
    await debug.battleFinish();
  }, result);
}

async function runFightWin(browser, errors, failures) {
  const label = "fight-win";
  const viewport = { width: 1600, height: 900 };
  const { context, page } = await createQaPage(browser, label, viewport, errors);
  try {
    const prepared = await prepareCase(page, label);
    const definitions = await definitionContract(page, failures, label);
    const entered = await enterAokijiBattle(page, label, definitions, failures);
    const beforeRewards = await rewardSnapshot(page);
    await forceBattleResult(page, "win");
    await waitForStoryCompletion(page, 1);
    const afterRewards = await rewardSnapshot(page);
    const finished = await playerSnapshot(page);
    addFailure(failures, JSON.stringify(afterRewards) === JSON.stringify(beforeRewards), `${label}: 勝利後取得了不該有的獎勵`, { beforeRewards, afterRewards });
    addFailure(failures, !finished.inImpelDown && !finished.pending && !finished.battleActive, `${label}: 強制勝利後狀態未清乾淨`, finished);
    addFailure(failures, finished.currentPlayerId === prepared.observerId, `${label}: 強制勝利後沒有 end_turn`, finished);
    return { label, viewport, prepared, entered, beforeRewards, afterRewards, finished, forcedResult: "win" };
  } finally {
    await context.close();
  }
}

async function runFightLose(browser, errors, failures) {
  const label = "fight-lose";
  const viewport = { width: 1600, height: 900 };
  const { context, page } = await createQaPage(browser, label, viewport, errors);
  try {
    const prepared = await prepareCase(page, label);
    const definitions = await definitionContract(page, failures, label);
    const entered = await enterAokijiBattle(page, label, definitions, failures);
    await forceBattleResult(page, "lose");
    await page.waitForFunction(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      return !debug.aokijiCaptureQa.pending()
        && !state.battleState
        && Boolean(state.gameState.players[0]?.impelDown?.active)
        && Number(state.gameState.currentPlayerIndex || 0) === 1;
    }, null, { timeout: 15000 });
    const finished = await playerSnapshot(page);
    addFailure(failures, finished.inImpelDown && finished.crewFull, `${label}: 強制敗北沒有入推進城並補滿 HP/PP`, finished);
    addFailure(failures, !finished.pending && !finished.battleActive, `${label}: 強制敗北後 pending/戰鬥未清除`, finished);
    addFailure(failures, finished.currentPlayerId === prepared.observerId, `${label}: 強制敗北後沒有 end_turn`, finished);
    return { label, viewport, prepared, entered, finished, forcedResult: "lose" };
  } finally {
    await context.close();
  }
}

async function runRecordedCase(report, name, callback) {
  const startedAt = new Date().toISOString();
  try {
    const result = await callback();
    report.verification.browserRuntime.cases.push({ name, completed: true, startedAt, result });
  } catch (error) {
    const failure = `${name}: runtime 未完成: ${error.stack || error.message}`;
    report.failures.push(failure);
    report.verification.browserRuntime.cases.push({
      name,
      completed: false,
      startedAt,
      error: error.stack || error.message,
    });
  }
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const report = {
    title: "青雉首次攔截劇情正式頁 QA",
    outputDir: OUTPUT_DIR,
    formalPage: `${ROOT_URL}/${FORMAL_PAGE}`,
    storageIsolation: "每個情境使用全新 Playwright BrowserContext、空 localStorage，且未帶 online=1；不讀寫玩家正式瀏覽器存檔。",
    verification: {
      staticSyntax: {
        attemptedByRuntimeScript: false,
        note: "此欄不宣稱語法通過；請另跑 node --check scripts/aokiji_first_capture_story_qa.js。",
      },
      browserRuntime: {
        attempted: true,
        completed: false,
        browserExecutable: CHROME_PATH,
        cases: [],
      },
    },
    errors: [],
    failures: [],
    ok: false,
  };
  let browser = null;
  try {
    browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
    await runRecordedCase(report, "wipeout-leave-desktop-1600x900", () => runWipeoutLeaveViewport(
      browser,
      "desktop-1600x900",
      { width: 1600, height: 900 },
      report.errors,
      report.failures
    ));
    await runRecordedCase(report, "wipeout-leave-phone-932x430", () => runWipeoutLeaveViewport(
      browser,
      "phone-932x430",
      { width: 932, height: 430 },
      report.errors,
      report.failures
    ));
    await runRecordedCase(report, "berry-shortage-end-turn", () => runBerryShortage(browser, report.errors, report.failures));
    await runRecordedCase(report, "fight-forced-win", () => runFightWin(browser, report.errors, report.failures));
    await runRecordedCase(report, "fight-forced-lose", () => runFightLose(browser, report.errors, report.failures));
  } catch (error) {
    report.failures.push(`browser runtime 啟動失敗: ${error.stack || error.message}`);
  } finally {
    if (browser) await browser.close();
  }

  report.failures.push(...report.errors);
  report.verification.browserRuntime.completed = report.verification.browserRuntime.cases.length === 5
    && report.verification.browserRuntime.cases.every((entry) => entry.completed);
  report.ok = report.verification.browserRuntime.completed && report.failures.length === 0;
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
