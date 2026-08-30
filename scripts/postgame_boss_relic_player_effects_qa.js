const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || path.resolve(__dirname, "..", "docs", "qa", "postgame_boss_relic_player_effects");

function captureErrors(page, errors) {
  page.on("pageerror", (error) => errors.push(`pageerror:${error.stack || error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(`console:${message.text()}`);
  });
}

(async () => {
  const errors = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  captureErrors(page, errors);
  await page.goto(`${ROOT_URL}/board_game.html?postgame_boss_relic_player_effects_qa=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.postgameRelicQa && window.BoardCards, null, { timeout: 30000 });

  const result = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const qa = debug.postgameRelicQa;
    const arsenalQa = debug.bulletArsenalQa;
    const rootState = debug.getState();
    const player = rootState.gameState.players[0];
    const source = window.BoardCards.cards.find((card) => card.id === "zoro") || window.BoardCards.cards[0];
    const checks = [];
    const check = (mode, itemId, name, pass, actual, expected) => checks.push({ mode, itemId, name, pass: !!pass, actual, expected });
    const approx = (actual, expected, tolerance = 0.02) => Math.abs(Number(actual) - Number(expected)) <= tolerance;
    const emptyStages = () => ({ atk: 0, def: 0, satk: 0, sdef: 0, spd: 0, accuracy: 0, evasion: 0 });
    const emptyStageTurns = () => ({ atk: 0, def: 0, satk: 0, sdef: 0, spd: 0, accuracy: 0, evasion: 0 });
    const emptyStatuses = () => ({ poison: 0, burn: 0, paralyze: 0, freeze: 0, bind: 0, sleep: 0, confusion: 0, bleed: 0 });
    const emptyRoundEffects = () => ({ shieldRatio: 0, nextShieldRatio: 0, damageTakenUp: 0, nextHitBoost: 0, guaranteedFirst: false, nextGuaranteedFirst: false, flinch: false });
    const directPhysical = { id: "qa_direct_physical", name: "測試斬擊", category: "attack", type: "attack", power: 140, accuracy: 100, currentPP: 99, effects: {} };
    const directSpecial = { id: "qa_direct_special", name: "測試能量", category: "special", type: "special", power: 140, accuracy: 100, currentPP: 99, effects: {} };
    const supportMove = { id: "qa_support", name: "測試強化", category: "buff", type: "buff", power: 0, accuracy: 100, currentPP: 99, effects: { selfStages: { atk: 1 } } };
    const comboMove = { id: "qa_combo", name: "八段連擊", category: "attack", type: "attack", power: 100, accuracy: 100, currentPP: 99, effects: { multiHit: 8 } };

    const makeBattle = () => ({
      islandId: "qa-relic-player-effects",
      islandKind: "enemy",
      playerId: player.id,
      activeCrewIndex: 0,
      participatedCrewIndices: [0],
      roundIndex: 1,
      result: "",
      log: [],
      carryItemStates: {},
      heldItemStates: {},
      playerStages: emptyStages(),
      playerStageTurns: emptyStageTurns(),
      playerStatuses: emptyStatuses(),
      playerCrewStatuses: {},
      playerStatusActiveKey: "",
      playerRoundEffects: emptyRoundEffects(),
      playerAction: { type: "move", moveId: directPhysical.id },
      enemyAction: { type: "move", moveId: directPhysical.id },
      playerPerformedAction: false,
      enemyPerformedAction: false,
      enemyCombatant: {
        id: "qa_enemy",
        key: "qa_enemy",
        name: "遺物測試敵人",
        tier: "T1",
        rank: "S",
        level: 99,
        role: "測試對手",
        attribute: "技",
        isDevilFruitUser: true,
        maxHp: 10000,
        currentHp: 10000,
        atk: 100,
        def: 100,
        satk: 100,
        sdef: 100,
        spd: 80,
        baseStats: { hp: 10000, atk: 100, def: 100, satk: 100, sdef: 100, spd: 80 },
        stages: emptyStages(),
        stageTurns: emptyStageTurns(),
        statuses: emptyStatuses(),
        roundEffects: emptyRoundEffects(),
        moveSet: [directPhysical, directSpecial, supportMove],
      },
    });

    const equip = (itemId, mode) => {
      const card = debug.cloneCard({ ...source, level: 99, totalExp: Number.MAX_SAFE_INTEGER });
      card.battleCarryItem = mode === "arsenal"
        ? arsenalQa.normalize({ id: arsenalQa.itemId, arsenalItems: [{ id: itemId }, null] })
        : arsenalQa.normalize({ id: itemId });
      player.crew = [card];
      player.activeCrewIndex = 0;
      const battle = makeBattle();
      rootState.battleState = battle;
      card.currentHp = arsenalQa.maxHp(card);
      const ctx = arsenalQa.contexts(player, battle)[0];
      return { card, battle, ctx };
    };

    const baseStats = () => {
      const card = debug.cloneCard({ ...source, level: 99, totalExp: Number.MAX_SAFE_INTEGER });
      card.battleCarryItem = null;
      player.crew = [card];
      player.activeCrewIndex = 0;
      const battle = makeBattle();
      rootState.battleState = battle;
      card.currentHp = arsenalQa.maxHp(card);
      return {
        atk: qa.currentStat("player", "atk", player, battle),
        satk: qa.currentStat("player", "satk", player, battle),
        spd: qa.currentStat("player", "spd", player, battle),
      };
    };

    for (const mode of ["standalone", "arsenal"]) {
      const base = baseStats();

      {
        const { card, battle, ctx } = equip("shiki_oto_kogarashi", mode);
        const atkRatio = qa.currentStat("player", "atk", player, battle) / base.atk;
        const speedRatio = qa.currentStat("player", "spd", player, battle) / base.spd;
        const first = qa.applyDefense("player", 1000, player, battle, {});
        const second = qa.applyDefense("player", 1000, player, battle, {});
        check(mode, ctx.item.id, "速度與物攻 +20%", approx(atkRatio, 1.2, .03) && approx(speedRatio, 1.2, .03), { atkRatio, speedRatio }, 1.2);
        check(mode, ctx.item.id, "整招首次減傷 40% 且每場一次", first === 600 && second === 1000 && ctx.state.shikiFirstGuardUsed, { first, second, state: ctx.state }, { first: 600, second: 1000 });
        card.currentHp = arsenalQa.maxHp(card);
      }

      {
        const { battle, ctx } = equip("tesoro_gran_tesoro_gold_rings", mode);
        for (let i = 0; i < 3; i += 1) qa.afterDirectAction("player", directPhysical, true, 100, 4, player, battle);
        const reward = qa.rewardBonuses(player, { coins: 100, bounty: 0, exp: 0 }, battle, { silent: true });
        check(mode, ctx.item.id, "三層束縛與雙防整場 -1", ctx.state.goldRingsTriggered && ctx.state.goldStacks === 3 && battle.enemyCombatant.statuses.bind > 0 && battle.enemyCombatant.stages.def === -1 && battle.enemyCombatant.stages.sdef === -1, { state: ctx.state, statuses: battle.enemyCombatant.statuses, stages: battle.enemyCombatant.stages }, "3層／束縛／防禦特防-1");
        check(mode, ctx.item.id, "參戰勝利貝里 +200%", reward.coins === 300, reward.coins, 300);
      }

      {
        const { card, battle, ctx } = equip("zephyr_battle_smasher", mode);
        for (let i = 0; i < 3; i += 1) qa.afterDirectAction("player", directPhysical, true, 100, 4, player, battle);
        const raw = qa.damageModifiers(1000, directPhysical, 4, player, battle, card, {});
        const ignore = qa.ignoreDefenseRatio(directPhysical, player, battle);
        const beforeHp = card.currentHp;
        qa.afterDirectAction("player", directPhysical, false, 0, 4, player, battle);
        const expectedHp = Math.max(1, beforeHp - Math.round(arsenalQa.maxHp(card) * .3));
        check(mode, ctx.item.id, "三次命中後過熱爆發 +40%／無視20%", raw === 1400 && approx(ignore, .2, .001), { raw, ignore }, { damage: 1400, ignore: .2 });
        check(mode, ctx.item.id, "落空消耗爆發且反噬不致死", !ctx.state.battleSmasherReady && ctx.state.battleSmasherHeat === 0 && card.currentHp === expectedHp && card.currentHp >= 1, { hp: card.currentHp, state: ctx.state }, { hp: expectedHp, ready: false, heat: 0 });
      }

      {
        const { battle, ctx } = equip("tot_musica_demon_score", mode);
        const hits = qa.comboProgression(Array(8).fill(100), "player", comboMove, player, battle);
        check(mode, ctx.item.id, "八段依 1/2/4/8% 持續翻倍且無上限", hits.join(",") === "101,102,104,108,116,132,164,228", hits, [101, 102, 104, 108, 116, 132, 164, 228]);
      }

      {
        const { card, battle, ctx } = equip("saga_seven_star_sword", mode);
        const maxHp = arsenalQa.maxHp(card);
        card.currentHp = Math.floor(maxHp * .94);
        const oneStep = qa.damageModifiers(1000, directPhysical, 4, player, battle, card, {});
        card.currentHp = Math.max(1, Math.floor(maxHp * .01));
        const nearKo = qa.damageModifiers(1000, directPhysical, 4, player, battle, card, {});
        check(mode, ctx.item.id, "每失去5%增傷4%，瀕死最高 +76%", oneStep === 1040 && nearKo === 1760, { oneStep, nearKo, maxHp }, { oneStep: 1040, nearKo: 1760 });
      }

      {
        const { card, battle, ctx } = equip("king_sword", mode);
        const guarded = qa.applyDefense("player", 1000, player, battle, {});
        const speedRatio = qa.currentStat("player", "spd", player, battle) / base.spd;
        const boosted = qa.damageModifiers(1000, directPhysical, 4, player, battle, card, {});
        qa.afterDirectAction("player", directPhysical, false, 0, 4, player, battle);
        check(mode, ctx.item.id, "背火減傷後熄火並提升速度／攻擊", guarded === 750 && approx(speedRatio, 1.25, .03) && boosted === 1250, { guarded, speedRatio, boosted }, { guarded: 750, speedRatio: 1.25, boosted: 1250 });
        check(mode, ctx.item.id, "直接攻擊落空後也重新背火", ctx.state.kingFlameOn === true, ctx.state.kingFlameOn, true);
      }

      {
        const { battle, ctx } = equip("katakuri_mogura", mode);
        const satkRatio = qa.currentStat("player", "satk", player, battle) / base.satk;
        const startHp = battle.enemyCombatant.currentHp;
        qa.prepareMogura(directPhysical, player, battle);
        const first = qa.moveHits("enemy", directPhysical, player, battle);
        qa.prepareMogura(supportMove, player, battle);
        qa.prepareMogura(directPhysical, player, battle);
        const afterSupport = qa.moveHits("enemy", directPhysical, player, battle);
        qa.prepareMogura(directPhysical, player, battle);
        const repeated = qa.moveHits("enemy", directPhysical, player, battle);
        check(mode, ctx.item.id, "特攻 +30%", approx(satkRatio, 1.3, .03), satkRatio, 1.3);
        check(mode, ctx.item.id, "只反制連續兩次行動的相同直接招式", first.hit && afterSupport.hit && !repeated.hit && repeated.moguraCounter && ctx.state.moguraTriggered && battle.enemyCombatant.currentHp === startHp - 4000, { first, afterSupport, repeated, enemyHp: battle.enemyCombatant.currentHp }, { enemyHp: startHp - 4000 });
      }

      {
        const { card, battle, ctx } = equip("redfield_umbrella_sword", mode);
        const maxHp = arsenalQa.maxHp(card);
        card.currentHp = Math.max(1, maxHp - 500);
        const beforeHeal = card.currentHp;
        qa.afterDirectAction("player", directPhysical, true, 1000, 4, player, battle);
        const healed = card.currentHp;
        card.currentHp = maxHp;
        qa.afterDirectAction("player", directPhysical, true, 1000, 4, player, battle);
        const shield = ctx.state.redfieldOverflowShield;
        const remaining = qa.applyDefense("player", shield + 10, player, battle, {});
        const expectedHeal = Math.min(maxHp, beforeHeal + 200);
        check(mode, ctx.item.id, "整招實傷20%吸血", healed === expectedHeal, { beforeHeal, healed, maxHp }, expectedHeal);
        check(mode, ctx.item.id, "溢出護盾上限15%並優先承傷", shield === Math.round(maxHp * .15) && remaining === 10 && ctx.state.redfieldOverflowShield === 0, { shield, remaining, state: ctx.state }, { shield: Math.round(maxHp * .15), remaining: 10 });
      }

      {
        const { card, battle, ctx } = equip("loki_ragnir", mode);
        const satkRatio = qa.currentStat("player", "satk", player, battle) / base.satk;
        qa.afterDirectAction("player", directSpecial, true, 100, 4, player, battle);
        qa.afterDirectAction("player", directSpecial, true, 100, 4, player, battle);
        const highDie = qa.damageModifiers(1000, directSpecial, 5, player, battle, card, {});
        qa.afterDirectAction("player", directSpecial, true, 100, 5, player, battle);
        check(mode, ctx.item.id, "特攻 +20%／兩朵冰雲高骰 +30%", approx(satkRatio, 1.2, .03) && highDie === 1300, { satkRatio, highDie }, { satkRatio: 1.2, highDie: 1300 });
        check(mode, ctx.item.id, "第三朵立即凍結一回合並清空", battle.enemyCombatant.statuses.freeze > 0 && ctx.state.ragnirClouds === 0, { freeze: battle.enemyCombatant.statuses.freeze, clouds: ctx.state.ragnirClouds }, { freeze: 1, clouds: 0 });
      }

      {
        const { card, battle, ctx } = equip("green_bull_life_seed", mode);
        const maxHp = arsenalQa.maxHp(card);
        card.currentHp = Math.max(1, Math.floor(maxHp * .5));
        qa.roundEnd(player, battle);
        qa.roundEnd(player, battle);
        qa.roundEnd(player, battle);
        const seeds = ctx.state.greenBullSeeds;
        card.currentHp = 0;
        const revived = qa.tryRevive(player, battle, card);
        const reviveHp = card.currentHp;
        card.currentHp = 0;
        const second = qa.tryRevive(player, battle, card);
        check(mode, ctx.item.id, "低於70%每回合回3%並累積三顆", seeds === 3, { seeds, hpAfterRounds: reviveHp }, 3);
        check(mode, ctx.item.id, "三顆復活36%且每場一次", revived && !second && ctx.state.greenBullReviveUsed && reviveHp === Math.round(maxHp * .36), { revived, second, reviveHp, state: ctx.state }, { revived: true, second: false, reviveHp: Math.round(maxHp * .36) });
      }
    }

    rootState.battleState = null;
    return { checks, failures: checks.filter((entry) => !entry.pass) };
  });

  await browser.close();
  result.errors = errors;
  result.failures.push(...errors.map((error) => ({ mode: "browser", itemId: "", name: error, pass: false })));
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, "postgame_boss_relic_player_effects_result.json"), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ checks: result.checks.length, failures: result.failures.length, errors: result.errors }, null, 2)}\n`);
  if (result.failures.length) process.exitCode = 1;
})().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
