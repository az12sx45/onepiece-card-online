const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8798";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/qa/battle_critical_profiles_items_fx_v322_20260826";

function captureErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.stack || error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`${label}:console:${message.text()}`);
    }
  });
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const logicContext = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const host = await logicContext.newPage();
  captureErrors(host, errors, "logic");
  await host.goto(`${ROOT_URL}/board_game.html?battle_critical_system_qa=1`, { waitUntil: "domcontentloaded" });
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.battleCriticalQa && window.BoardCards, null, { timeout: 30000 });

  const logic = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const criticalQa = debug.battleCriticalQa;
    const arsenalQa = debug.bulletArsenalQa;
    const rootState = debug.getState();
    const player = rootState.gameState.players[0];
    const cards = window.BoardCards.cards;
    const checks = [];
    const check = (name, pass, actual, expected) => checks.push({ name, pass: !!pass, actual, expected });
    const approx = (actual, expected, tolerance = .0001) => Math.abs(Number(actual) - Number(expected)) <= tolerance;
    const emptyStages = () => ({ atk: 0, def: 0, satk: 0, sdef: 0, spd: 0, accuracy: 0, evasion: 0 });
    const emptyStageTurns = () => ({ atk: 0, def: 0, satk: 0, sdef: 0, spd: 0, accuracy: 0, evasion: 0 });
    const emptyStatuses = () => ({ poison: 0, burn: 0, paralyze: 0, freeze: 0, bind: 0, sleep: 0, confusion: 0, bleed: 0 });
    const emptyRoundEffects = () => ({ shieldRatio: 0, nextShieldRatio: 0, damageTakenUp: 0, nextHitBoost: 0, guaranteedFirst: false, nextGuaranteedFirst: false, flinch: false });
    const copyCard = (id, level = 1, formId = "base") => {
      const source = cards.find((card) => card.id === id);
      const card = debug.cloneCard(source);
      card.level = level;
      card.formId = formId;
      card.evolutionFormId = formId;
      card.currentHp = Number(card.baseStats?.hp || card.hp || 1);
      return card;
    };
    const makeBattle = (card) => ({
      islandId: "qa-critical",
      islandKind: "enemy",
      playerId: player.id,
      activeCrewIndex: 0,
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
      playerAction: null,
      enemyAction: null,
      playerPerformedAction: false,
      enemyPerformedAction: false,
      roundResolved: false,
      waitingResume: false,
      animating: false,
      enemyCombatant: {
        id: "qa_enemy",
        key: "qa_enemy",
        name: "暴擊測試敵人",
        tier: "T1",
        rank: "S",
        level: 1,
        role: "測試對手",
        roleType: "戰鬥型",
        attribute: "技",
        maxHp: 5000,
        currentHp: 5000,
        atk: 100,
        def: 100,
        satk: 100,
        sdef: 100,
        spd: 80,
        baseStats: { hp: 5000, atk: 100, def: 100, satk: 100, sdef: 100, spd: 80 },
        stages: emptyStages(),
        stageTurns: emptyStageTurns(),
        statuses: emptyStatuses(),
        roundEffects: emptyRoundEffects(),
        moveSet: [],
      },
    });

    const zoroLv1 = copyCard("zoro", 1);
    const zoroLv40 = copyCard("zoro", 40);
    const zoroStage1 = copyCard("zoro", 40, "zoro_santoryu_plus");
    const zoroStage2 = copyCard("zoro", 40, "zoro_evolution_2");
    const namiLv1 = copyCard("nami", 1);
    const mansherryLv1 = copyCard("mansherry", 1);
    const profiledCards = cards.filter((card) => Number.isFinite(Number(card.criticalRateBase)) && String(card.criticalStyle || "").trim());
    check("51 名正式角色都有個別暴擊特性", profiledCards.length === 51 && new Set(profiledCards.map((card) => card.criticalStyle)).size === 51, { count: profiledCards.length, styles: new Set(profiledCards.map((card) => card.criticalStyle)).size }, { count: 51, styles: 51 });
    check("角色基礎暴擊依形象拉開", approx(criticalQa.baseRate(copyCard("custom_mp3l85c1", 1)), .18) && approx(criticalQa.baseRate(copyCard("usopp", 1)), .18) && approx(criticalQa.baseRate(copyCard("rayleigh", 1)), .17) && approx(criticalQa.baseRate(copyCard("little_oars_jr", 1)), .02), { mihawk: criticalQa.baseRate(copyCard("custom_mp3l85c1", 1)), usopp: criticalQa.baseRate(copyCard("usopp", 1)), rayleigh: criticalQa.baseRate(copyCard("rayleigh", 1)), littleOars: criticalQa.baseRate(copyCard("little_oars_jr", 1)) }, { mihawk: .18, usopp: .18, rayleigh: .17, littleOars: .02 });
    check("角色特性文字對應本人", criticalQa.style(zoroLv1) === "三刀流・要害斬擊" && criticalQa.style(copyCard("prison_buggy", 1)) === "強運小丑・意外命中", { zoro: criticalQa.style(zoroLv1), buggy: criticalQa.style(copyCard("prison_buggy", 1)) }, { zoro: "三刀流・要害斬擊", buggy: "強運小丑・意外命中" });
    check("索隆 Lv1 個別基礎為 15%", approx(criticalQa.characterRate(zoroLv1), .15), criticalQa.characterRate(zoroLv1), .15);
    check("Lv40 累積 +2%", approx(criticalQa.characterRate(zoroLv40), .17), criticalQa.characterRate(zoroLv40), .17);
    check("一階進化再 +2%", approx(criticalQa.characterRate(zoroStage1), .19), criticalQa.characterRate(zoroStage1), .19);
    check("二階進化改為 +4%", approx(criticalQa.characterRate(zoroStage2), .21), criticalQa.characterRate(zoroStage2), .21);
    check("娜美 Lv1 個別基礎為 10%", approx(criticalQa.characterRate(namiLv1), .10), criticalQa.characterRate(namiLv1), .10);
    check("曼雪莉純支援基礎為 3%", approx(criticalQa.characterRate(mansherryLv1), .03), criticalQa.characterRate(mansherryLv1), .03);

    const taggedMoves = [
      ...cards.flatMap((card) => card.moveSet || []),
      ...Object.values(window.BoardCards.evolutionForms || {}).flatMap((form) => form.moveSet || []),
    ].filter((move) => Number(move.effects?.critRateBonus || 0) > 0 || move.effects?.guaranteedCritical);
    const plus10 = taggedMoves.filter((move) => Number(move.effects?.critRateBonus || 0) === .1);
    const plus20 = taggedMoves.filter((move) => Number(move.effects?.critRateBonus || 0) === .2);
    check("高暴擊技能資料已套用", taggedMoves.length === 59 && plus10.length === 36 && plus20.length === 19, { total: taggedMoves.length, plus10: plus10.length, plus20: plus20.length }, { total: 59, plus10: 36, plus20: 19 });
    const highCriticalMove = taggedMoves.find((move) => Number(move.effects?.critRateBonus || 0) === .2);
    const highCriticalText = criticalQa.effectText(highCriticalMove);
    check("+20% 高暴技能顯示精簡文字", highCriticalText.includes("20%暴擊") && !highCriticalText.includes("暴擊率+") && !highCriticalText.includes("+20%"), { move: highCriticalMove?.name || "", effectText: highCriticalText }, "20%暴擊");

    const direct = { id: "qa_direct", name: "測試斬擊", type: "attack", category: "attack", power: 100, effects: {} };
    const plus20Move = { ...direct, id: "qa_plus20", name: "高暴測試", effects: { critRateBonus: .2 } };
    const guaranteedMove = { ...direct, id: "qa_guaranteed", name: "必暴測試", effects: { guaranteedCritical: true } };
    const cannotMove = { ...direct, id: "qa_cannot", name: "禁暴測試", effects: { cannotCritical: true } };
    const supportMove = { id: "qa_support", name: "測試治療", type: "heal", category: "heal", power: 0, effects: { healRatio: .2 } };

    zoroLv1.battleCarryItem = arsenalQa.normalize({ id: "scope_lens" });
    player.crew = [zoroLv1];
    player.activeCrewIndex = 0;
    let battle = makeBattle(zoroLv1);
    rootState.battleState = battle;
    check("瞄準鏡單件加到角色總暴擊率", approx(criticalQa.actorRate("player", player, battle), .25), criticalQa.actorRate("player", player, battle), .25);
    check("技能加成與裝備相加", approx(criticalQa.moveRate("player", plus20Move, player, battle), .45), criticalQa.moveRate("player", plus20Move, player, battle), .45);
    check("輔助技能不能暴擊", criticalQa.moveRate("player", supportMove, player, battle) === 0, criticalQa.moveRate("player", supportMove, player, battle), 0);
    const criticalItems = ["scope_lens", "quick_claw", "shiki_oto_kogarashi", "griffon_sword", "redfield_umbrella_sword"].map((id) => window.GAME_ITEMS[id]);
    check("五件暴擊道具資料已接上", criticalItems.every(Boolean) && approx(criticalQa.carryRateBonus(criticalItems[0].effect), .1) && approx(criticalQa.carryRateBonus(criticalItems[1].effect), .05) && approx(criticalQa.carryRateBonus(criticalItems[2].effect), .05) && approx(criticalQa.carryDamageBonus(criticalItems[3].effect), .2) && approx(criticalQa.carryDamageBonus(criticalItems[4].effect), .1), criticalItems.map((item) => ({ id: item?.id, effect: item?.effect })), "機率 10%／5%／5%，倍率 +0.2／+0.1");

    let visual = { critical: false, criticalCount: 0 };
    const oneCrit = criticalQa.resolveDamage(100, "player", direct, player, battle, visual, 0, 0);
    check("單段暴擊只乘一次 1.5", oneCrit === 150 && visual.criticalCount === 1 && visual.criticalHitIndexes.join(",") === "0", { damage: oneCrit, visual }, { damage: 150, criticalCount: 1, indexes: [0] });
    visual = { critical: false, criticalCount: 0 };
    const oneMiss = criticalQa.resolveDamage(100, "player", direct, player, battle, visual, 0, .99);
    check("未通過暴擊率時維持原傷害", oneMiss === 100 && !visual.critical, { damage: oneMiss, visual }, { damage: 100, critical: false });
    visual = { critical: false, criticalCount: 0 };
    const hits = criticalQa.resolveHits([100, 100, 100], "player", direct, player, battle, visual, [0, .99, 0]);
    check("多段逐段判定並記錄段數", hits.join(",") === "150,100,150" && visual.criticalCount === 2 && visual.criticalHitIndexes.join(",") === "0,2", { hits, visual }, { hits: [150, 100, 150], indexes: [0, 2] });
    visual = { critical: false, criticalCount: 0 };
    check("必暴欄位可越過隨機值", criticalQa.resolveDamage(100, "player", guaranteedMove, player, battle, visual, 0, .999) === 150, visual, "150");
    visual = { critical: false, criticalCount: 0 };
    check("禁暴欄位阻止暴擊", criticalQa.resolveDamage(100, "player", cannotMove, player, battle, visual, 0, 0) === 100 && !visual.critical, visual, "100／不暴擊");
    check("沒有視覺／正式結算 context 時不偷骰暴擊", criticalQa.resolveDamage(100, "player", direct, player, battle, null, 0, 0) === 100, "100", "100");

    const arsenalCard = copyCard("zoro", 1);
    arsenalCard.battleCarryItem = arsenalQa.normalize({
      id: arsenalQa.itemId,
      arsenalItems: [{ id: "scope_lens" }, { id: "choice_band" }],
    });
    player.crew = [arsenalCard];
    battle = makeBattle(arsenalCard);
    rootState.battleState = battle;
    check("武器庫內瞄準鏡同樣接入", approx(criticalQa.actorRate("player", player, battle), .25), criticalQa.actorRate("player", player, battle), .25);

    const criticalDamageCard = copyCard("zoro", 1);
    criticalDamageCard.battleCarryItem = arsenalQa.normalize({
      id: arsenalQa.itemId,
      arsenalItems: [{ id: "griffon_sword" }, { id: "redfield_umbrella_sword" }],
    });
    player.crew = [criticalDamageCard];
    battle = makeBattle(criticalDamageCard);
    rootState.battleState = battle;
    check("武器庫暴擊傷害可合併但不重複暴擊", approx(criticalQa.actorDamageMultiplier("player", player, battle), 1.8), criticalQa.actorDamageMultiplier("player", player, battle), 1.8);
    visual = { critical: false, criticalCount: 0 };
    check("暴擊傷害道具套入正式傷害", criticalQa.resolveDamage(100, "player", direct, player, battle, visual, 0, 0) === 180 && visual.criticalCount === 1, { visual, multiplier: criticalQa.actorDamageMultiplier("player", player, battle) }, "180／一次暴擊");

    const cappedPlayerCard = copyCard("zoro", 1);
    cappedPlayerCard.criticalRateBonus = .9;
    cappedPlayerCard.criticalDamageMultiplier = 3;
    player.crew = [cappedPlayerCard];
    battle = makeBattle(cappedPlayerCard);
    rootState.battleState = battle;
    check("玩家暴擊率上限 50%", approx(criticalQa.actorRate("player", player, battle), .5), criticalQa.actorRate("player", player, battle), .5);
    visual = { critical: false, criticalCount: 0 };
    check("玩家暴擊傷害倍率上限為 2 倍", approx(criticalQa.actorDamageMultiplier("player", player, battle), 2) && criticalQa.resolveDamage(100, "player", direct, player, battle, visual, 0, 0) === 200, { multiplier: criticalQa.actorDamageMultiplier("player", player, battle), visual }, "×2／200");
    battle.enemyCombatant.criticalRateBonus = .9;
    battle.enemyCombatant.criticalDamageMultiplier = 3;
    check("敵方暴擊率固定為 0", criticalQa.actorRate("enemy", player, battle) === 0 && criticalQa.moveRate("enemy", plus20Move, player, battle) === 0 && criticalQa.moveRate("enemy", guaranteedMove, player, battle) === 0, { actor: criticalQa.actorRate("enemy", player, battle), plus20: criticalQa.moveRate("enemy", plus20Move, player, battle), guaranteed: criticalQa.moveRate("enemy", guaranteedMove, player, battle) }, 0);
    visual = { critical: false, criticalCount: 0 };
    check("敵方強制低骰也不會暴擊", criticalQa.resolveDamage(100, "enemy", guaranteedMove, player, battle, visual, 0, 0) === 100 && !visual.critical && visual.criticalCount === 0, visual, "100／不暴擊");

    const recruitedEnemyCard = copyCard("prison_crocodile", 1);
    player.crew = [recruitedEnemyCard];
    player.activeCrewIndex = 0;
    battle = makeBattle(recruitedEnemyCard);
    battle.enemyCombatant = { ...recruitedEnemyCard, criticalRateBonus: .9 };
    rootState.battleState = battle;
    check("原敵方角色加入我方後恢復個人暴擊", approx(criticalQa.actorRate("player", player, battle), .11) && criticalQa.actorRate("enemy", player, battle) === 0, { playerSide: criticalQa.actorRate("player", player, battle), enemySide: criticalQa.actorRate("enemy", player, battle), cardId: recruitedEnemyCard.id }, { playerSide: .11, enemySide: 0 });

    const lineageAudit = debug.lineageCultivationTemplateAudit();
    const missingLineageCritical = lineageAudit.filter((entry) => !(Number(entry.criticalRateBase) > 0) || !String(entry.criticalStyle || "").trim());
    check("66 種正式敵人與 Boss 都有我方暴擊特性", lineageAudit.length === 66 && missingLineageCritical.length === 0 && new Set(lineageAudit.map((entry) => entry.criticalStyle)).size === 66, { count: lineageAudit.length, missing: missingLineageCritical.map((entry) => entry.enemyKey), styles: new Set(lineageAudit.map((entry) => entry.criticalStyle)).size }, { count: 66, missing: [], styles: 66 });
    const lineageRate = (enemyKey) => Number(debug.lineagePlayerCriticalProfile(enemyKey)?.baseRate || 0);
    check("敵方轉我方後依人物形象拉開", approx(lineageRate("spandam"), .03) && approx(lineageRate("lucci"), .19) && approx(lineageRate("postgame_charlotte_katakuri"), .24) && approx(lineageRate("yonko_shanks"), .25), { spandam: lineageRate("spandam"), lucci: lineageRate("lucci"), katakuri: lineageRate("postgame_charlotte_katakuri"), shanks: lineageRate("yonko_shanks") }, { spandam: .03, lucci: .19, katakuri: .24, shanks: .25 });
    check("洛克斯我方 Lv1 基礎暴擊為 30%", approx(lineageRate("postgame_rocks"), .30), lineageRate("postgame_rocks"), .30);

    player.researchLab = {
      nextInstanceSequence: 1,
      nextFactorSequence: lineageAudit.length + 1,
      researchPoints: 0,
      researchLevel: 1,
      starterExtractorGranted: true,
      codexFactorCardIds: [],
      codexCultivatedCardIds: [],
      collection: [],
      completeFactors: lineageAudit.map((entry, index) => ({
        id: `qa-critical-factor-${index + 1}`,
        enemyKey: entry.enemyKey,
        sourceCardId: "",
        enemyName: entry.enemyName,
        rank: entry.tier === "T1" ? "S" : "A",
        attribute: entry.attribute,
        isDevilFruitUser: false,
        extractorId: "lineage_extractor_standard",
        extractorName: "標準血統因子抽取器",
        portrait: entry.portrait,
        acquiredAt: new Date().toISOString(),
      })),
    };
    const cultivatedProfiles = lineageAudit.map((entry, index) => {
      const result = debug.cultivateLineageFactor(player, `qa-critical-factor-${index + 1}`);
      const expected = debug.lineagePlayerCriticalProfile(entry.enemyKey);
      return {
        enemyKey: entry.enemyKey,
        ok: !!result.ok,
        actualRate: Number(result.card?.criticalRateBase || 0),
        expectedRate: Number(expected?.baseRate || 0),
        actualStyle: String(result.card?.criticalStyle || ""),
        expectedStyle: String(expected?.style || ""),
      };
    });
    const cultivatedProfileFailures = cultivatedProfiles.filter((entry) => !entry.ok || !approx(entry.actualRate, entry.expectedRate) || entry.actualStyle !== entry.expectedStyle);
    check("66 種來源逐一正式培育都寫入正確 profile", cultivatedProfiles.length === 66 && cultivatedProfileFailures.length === 0, { count: cultivatedProfiles.length, failures: cultivatedProfileFailures }, { count: 66, failures: [] });

    player.researchLab = {
      nextInstanceSequence: 1,
      nextFactorSequence: 2,
      researchPoints: 0,
      researchLevel: 1,
      starterExtractorGranted: true,
      codexFactorCardIds: [],
      codexCultivatedCardIds: [],
      collection: [],
      completeFactors: [{
        id: "qa-rocks-factor",
        enemyKey: "postgame_rocks",
        sourceCardId: "",
        enemyName: "洛克斯・D・吉貝克",
        rank: "SSS",
        attribute: "力",
        isDevilFruitUser: false,
        extractorId: "lineage_extractor_emperor",
        extractorName: "皇級血統因子抽取器",
        portrait: "images/board/battle/enemies/postgame_rocks/normal.webp",
        acquiredAt: new Date().toISOString(),
      }],
    };
    const cultivatedRocks = debug.cultivateLineageFactor(player, "qa-rocks-factor");
    check("洛克斯血統培育卡寫入 30% 與個人特性", cultivatedRocks.ok && approx(cultivatedRocks.card?.criticalRateBase, .30) && cultivatedRocks.card?.criticalStyle === "世界之王・霸王要害", cultivatedRocks.ok ? { rate: cultivatedRocks.card.criticalRateBase, style: cultivatedRocks.card.criticalStyle, source: cultivatedRocks.card.cultivatedFromEnemyKey } : cultivatedRocks, { rate: .30, style: "世界之王・霸王要害", source: "postgame_rocks" });
    if (cultivatedRocks.ok) {
      player.crew = [cultivatedRocks.card];
      player.activeCrewIndex = 0;
      battle = makeBattle(cultivatedRocks.card);
      battle.enemyCombatant = { ...cultivatedRocks.card, criticalRateBonus: .9 };
      rootState.battleState = battle;
      check("洛克斯在我方 30%／敵方仍為 0%", approx(criticalQa.actorRate("player", player, battle), .30) && criticalQa.actorRate("enemy", player, battle) === 0, { playerSide: criticalQa.actorRate("player", player, battle), enemySide: criticalQa.actorRate("enemy", player, battle) }, { playerSide: .30, enemySide: 0 });
      cultivatedRocks.card.criticalRateBase = .01;
      cultivatedRocks.card.criticalStyle = "舊存檔值";
      player.researchLab.collection = [];
      debug.ensurePlayerResearchLabState(player);
      check("舊血統角色存檔自動回填新版 profile", approx(cultivatedRocks.card.criticalRateBase, .30) && cultivatedRocks.card.criticalStyle === "世界之王・霸王要害", { rate: cultivatedRocks.card.criticalRateBase, style: cultivatedRocks.card.criticalStyle }, { rate: .30, style: "世界之王・霸王要害" });
    } else {
      check("洛克斯在我方 30%／敵方仍為 0%", false, cultivatedRocks, { playerSide: .30, enemySide: 0 });
      check("舊血統角色存檔自動回填新版 profile", false, cultivatedRocks, { rate: .30, style: "世界之王・霸王要害" });
    }

    return {
      checks,
      passCount: checks.filter((entry) => entry.pass).length,
      failureCount: checks.filter((entry) => !entry.pass).length,
    };
  });

  const uiView = {
    player: { id: "qa-player", name: "測試玩家", crew: [], battleItems: [] },
    activeCard: {
      id: "zoro", name: "索隆", level: 40, attribute: "力", currentHp: 240, maxHp: 300,
      criticalRate: .17, criticalDamageMultiplier: 1.5, criticalStyle: "三刀流・要害斬擊", statuses: {}, effectDetails: [], carryItem: { id: "", name: "" },
      battlePortraits: { normal: "images/board/battle/portraits/zoro/normal.webp" },
      moves: [
        { id: "normal", name: "鬼斬", displayName: "鬼斬", type: "attack", damageClass: "physical", currentPP: 20, pp: 20, damageText: "傷害 30～55", effectText: "基礎攻擊", critRateBonus: 0 },
        { id: "plus", name: "虎狩", displayName: "虎狩", type: "attack", damageClass: "physical", currentPP: 15, pp: 15, damageText: "傷害 40～65", effectText: "10%暴擊", critRateBonus: .1 },
        { id: "high", name: "獅子歌歌", displayName: "獅子歌歌", type: "attack", damageClass: "physical", currentPP: 10, pp: 10, damageText: "傷害 55～80", effectText: "20%暴擊", critRateBonus: .2 },
        { id: "buff", name: "三刀流架勢", displayName: "三刀流架勢", type: "buff", damageClass: "status", currentPP: 10, pp: 10, damageText: "效果技", effectText: "自身攻擊+1", critRateBonus: 0 },
      ],
    },
    enemy: {
      key: "qa_enemy", name: "測試敵人", level: 30, attribute: "技", currentHp: 900, maxHp: 900,
      criticalRate: .07, criticalDamageMultiplier: 1.5, statuses: {}, effectDetails: [], battlePortraits: { normal: "images/board/battle/portraits/placeholder/normal.webp" },
    },
    battle: {
      islandId: "qa-critical-ui", islandKind: "enemy", roundIndex: 1, canControl: true, canAct: true,
      canFinish: false, animating: false, hasPlayerAction: false, hasEnemyAction: false, roundResolved: false,
      waitingResume: false, result: "", needsReplacement: false, postgameBossMechanic: null,
      openingPassiveVisualPending: false, openingPassiveVisualQueue: [], prebattleIntro: null,
    },
    attributeMatchup: { playerAttribute: "力", enemyAttribute: "技", playerAttackMultiplier: 2, enemyAttackMultiplier: .5 },
  };

  const uiContext = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await uiContext.addInitScript((view) => {
    localStorage.setItem("onepiece-board-battle-snapshot-v1", JSON.stringify({ view }));
  }, uiView);
  const uiPage = await uiContext.newPage();
  captureErrors(uiPage, errors, "ui");
  await uiPage.goto(`${ROOT_URL}/board_battle.html?battle_critical_system_qa=1`, { waitUntil: "domcontentloaded" });
  await uiPage.waitForSelector('[data-mode="attack"]', { timeout: 30000 });
  await uiPage.click('[data-mode="attack"]');
  await uiPage.waitForSelector(".battle-command-choice", { timeout: 10000 });
  const desktopUi = await uiPage.evaluate(() => ({
    badgeCount: document.querySelectorAll(".battle-command-choice-critical").length,
    moveDetails: [...document.querySelectorAll(".battle-command-choice")].map((node) => ({
      id: node.dataset.moveId || "",
      text: node.textContent.replace(/\s+/g, " ").trim(),
    })),
    playerMeta: document.getElementById("playerHudMeta")?.textContent?.replace(/\s+/g, " ").trim() || "",
    enemyMeta: document.getElementById("enemyHudMeta")?.textContent?.replace(/\s+/g, " ").trim() || "",
    buttonCount: document.querySelectorAll(".battle-command-choice").length,
    panelOverflowX: document.getElementById("infoContent")?.scrollWidth > document.getElementById("infoContent")?.clientWidth,
  }));
  await uiPage.screenshot({ path: path.join(OUTPUT_DIR, "critical-ui-desktop.png"), fullPage: true });
  await uiPage.setViewportSize({ width: 1024, height: 768 });
  await uiPage.waitForTimeout(250);
  const tabletUi = await uiPage.evaluate(() => ({
    badgeCount: document.querySelectorAll(".battle-command-choice-critical").length,
    descriptionsVisible: [...document.querySelectorAll(".battle-command-choice-meta")].every((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }),
    moveDetails: [...document.querySelectorAll(".battle-command-choice")].map((node) => node.textContent.replace(/\s+/g, " ").trim()),
    playerMeta: document.getElementById("playerHudMeta")?.textContent?.replace(/\s+/g, " ").trim() || "",
    documentOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
  await uiPage.screenshot({ path: path.join(OUTPUT_DIR, "critical-ui-tablet.png"), fullPage: true });
  await uiPage.setViewportSize({ width: 1600, height: 900 });
  await uiPage.evaluate((view) => {
    window.__criticalHitKinds = [];
    const pop = document.getElementById("damagePop");
    const observer = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        const candidates = [node, ...node.querySelectorAll?.(".damage-number") || []];
        candidates.filter((candidate) => candidate.matches?.(".damage-number")).forEach((candidate) => {
          window.__criticalHitKinds.push({
            kind: candidate.dataset.damageKind || "",
            value: Number(candidate.dataset.damageValue || 0),
          });
        });
      }));
    });
    observer.observe(pop, { childList: true, subtree: true });
    window.__criticalHitObserver = observer;
    const startEnemy = { ...view.enemy, currentHp: 900 };
    const finalEnemy = { ...view.enemy, currentHp: 600 };
    window.__BOARD_BATTLE_DEBUG__.refresh({
      ...view,
      enemy: finalEnemy,
      battle: {
        ...view.battle,
        animating: true,
        visualEvent: {
          id: `qa-critical-hits-${Date.now()}`,
          type: "attack",
          side: "player",
          targetSide: "enemy",
          actorName: view.activeCard.name,
          targetName: view.enemy.name,
          actorCombatant: view.activeCard,
          targetCombatant: finalEnemy,
          startCombatant: startEnemy,
          startSnapshot: { player: view.activeCard, enemy: startEnemy },
          finalSnapshot: { player: view.activeCard, enemy: finalEnemy },
          moveName: "三段暴擊測試",
          moveType: "combo",
          damage: 300,
          hitDamages: [100, 100, 100],
          critical: true,
          criticalCount: 2,
          criticalHitIndexes: [0, 2],
          startHp: { player: view.activeCard.currentHp, enemy: 900 },
          finalHp: { player: view.activeCard.currentHp, enemy: 600 },
          miss: false,
          duration: 4200,
        },
      },
    });
  }, uiView);
  await uiPage.waitForTimeout(2900);
  const criticalHitKinds = await uiPage.evaluate(() => {
    window.__criticalHitObserver?.disconnect();
    return window.__criticalHitKinds || [];
  });

  const uiChecks = [
    { name: "正式戰鬥招式維持四顆按鈕", pass: desktopUi.buttonCount === 4, actual: desktopUi.buttonCount, expected: 4 },
    { name: "戰鬥技能不產生暴擊角標", pass: desktopUi.badgeCount === 0, actual: desktopUi.badgeCount, expected: 0 },
    { name: "暴擊數字直接寫在技能說明", pass: desktopUi.moveDetails.find((entry) => entry.id === "plus")?.text.includes("10%暴擊") && desktopUi.moveDetails.find((entry) => entry.id === "high")?.text.includes("20%暴擊"), actual: desktopUi.moveDetails, expected: ["10%暴擊", "20%暴擊"] },
    { name: "玩家 HUD 不顯示暴擊率與倍率", pass: !desktopUi.playerMeta.includes("暴擊") && !desktopUi.playerMeta.includes("×1.5") && desktopUi.playerMeta.includes("HP 240/300"), actual: desktopUi.playerMeta, expected: "保留 HP／移除暴擊資訊" },
    { name: "敵方 HUD 不顯示暴擊欄", pass: !desktopUi.enemyMeta.includes("暴擊"), actual: desktopUi.enemyMeta, expected: "無暴擊欄" },
    { name: "桌機指令面板無水平溢出", pass: !desktopUi.panelOverflowX, actual: desktopUi.panelOverflowX, expected: false },
    { name: "平板只顯示技能內文、不顯示 HUD 暴擊欄或角標", pass: tabletUi.badgeCount === 0 && tabletUi.descriptionsVisible && tabletUi.moveDetails.some((text) => text.includes("20%暴擊")) && !tabletUi.playerMeta.includes("暴擊") && !tabletUi.playerMeta.includes("×1.5"), actual: tabletUi, expected: "HUD 無暴擊／角標 0／技能暴擊說明可見" },
    { name: "平板頁面無水平溢出", pass: !tabletUi.documentOverflowX, actual: tabletUi.documentOverflowX, expected: false },
    { name: "三段傷害只把第 1、3 段畫成暴擊", pass: criticalHitKinds.map((entry) => entry.kind).join(",") === "critical,normal,critical", actual: criticalHitKinds, expected: ["critical", "normal", "critical"] },
  ];
  const result = {
    generatedAt: new Date().toISOString(),
    logic,
    uiChecks,
    errors,
    passCount: logic.passCount + uiChecks.filter((entry) => entry.pass).length,
    failureCount: logic.failureCount + uiChecks.filter((entry) => !entry.pass).length + errors.length,
    outputDir: OUTPUT_DIR,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, "result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  process.exitCode = result.failureCount ? 1 : 0;
})().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
