(function () {
  "use strict";

  const ITEM_CATEGORY_LABELS = {
    navigation: "航海道具",
    battle: "戰鬥道具",
    ship: "船隻道具",
    held: "角色攜帶物",
    key: "重要道具",
  };

  const LEGACY_ITEM_CATEGORY_MAP = {
    exploration: "navigation",
    recovery: "battle",
    training: "key",
    shell: "held",
    battleCarry: "held",
    carry: "held",
  };

  function normalizeGameItemCategory(category) {
    const key = String(category || "").trim();
    return LEGACY_ITEM_CATEGORY_MAP[key] || (ITEM_CATEGORY_LABELS[key] ? key : "key");
  }

  function obtain(commonPool = false, devilFruitExtraPool = false, shops = [], seaEvents = []) {
    return { shops, seaEvents, enemyDrop: { commonPool, devilFruitExtraPool } };
  }

  const GAME_ITEMS = {};

  function defineItem(config) {
    const category = normalizeGameItemCategory(config.category);
    GAME_ITEMS[config.id] = {
      id: config.id,
      name: config.name,
      category,
      subType: config.subType || "",
      rarity: config.rarity || "C",
      internalTier: config.internalTier || `${category}_${(config.rarity || "C").toLowerCase()}`,
      stackable: config.stackable ?? category !== "held",
      sellable: config.sellable ?? category !== "key",
      usableInBattle: config.usableInBattle ?? category === "battle",
      usableOnMap: config.usableOnMap ?? category === "navigation",
      equippable: config.equippable ?? category === "held",
      description: config.description || config.uiSummary || "",
      uiSummary: config.uiSummary || config.description || "",
      image: config.image || `images/board/items/${config.id}.webp`,
      important: Boolean(config.important),
      tradable: config.tradable,
      maxStack: Number.isFinite(Number(config.maxStack)) ? Math.max(1, Math.round(Number(config.maxStack))) : 0,
      tradeMinPrice: Number.isFinite(Number(config.tradeMinPrice)) ? Math.max(0, Math.round(Number(config.tradeMinPrice))) : 0,
      revealTitle: config.revealTitle || "",
      revealLine: config.revealLine || "",
      useTiming: config.useTiming || [],
      targetType: config.targetType || "none",
      consumeOnUse: config.consumeOnUse ?? category !== "held",
      effect: config.effect || { kind: "todo" },
      obtain: config.obtain || obtain(false, false),
      logText: config.logText || {},
      balanceNote: config.balanceNote || "",
      price: config.price || 0,
      battleState: config.battleState || (
        category === "held"
          ? { triggered: false, usedThisBattle: false, storedDamage: 0, lockedSkillId: null, stackCount: 0, disabledThisBattle: false }
          : null
      ),
    };
  }

  function nav(id, name, rarity, internalTier, uiSummary, effect, options = {}) {
    defineItem({
      id, name, category: "navigation", rarity, internalTier, uiSummary,
      description: options.description || uiSummary,
      useTiming: options.useTiming || ["before_move"],
      targetType: options.targetType || "map",
      effect,
      obtain: options.obtain,
      logText: options.logText,
      balanceNote: options.balanceNote,
      price: options.price,
      image: options.image,
      important: options.important,
      tradable: options.tradable,
      maxStack: options.maxStack,
      tradeMinPrice: options.tradeMinPrice,
      revealTitle: options.revealTitle,
      revealLine: options.revealLine,
    });
  }

  function battle(id, name, rarity, internalTier, uiSummary, effect, options = {}) {
    defineItem({
      id, name, category: "battle", rarity, internalTier, uiSummary,
      description: options.description || uiSummary,
      useTiming: options.useTiming || ["battle_turn"],
      targetType: options.targetType || "self",
      consumeOnUse: true,
      effect,
      obtain: options.obtain,
      logText: options.logText,
      balanceNote: options.balanceNote,
      price: options.price,
      usableOnMap: options.usableOnMap ?? false,
      usableInBattle: options.usableInBattle ?? true,
      image: options.image,
      important: options.important,
      tradable: options.tradable,
      maxStack: options.maxStack,
      tradeMinPrice: options.tradeMinPrice,
      revealTitle: options.revealTitle,
      revealLine: options.revealLine,
    });
  }

  function held(id, name, rarity, internalTier, uiSummary, effect, options = {}) {
    defineItem({
      id, name, category: "held", rarity, internalTier, uiSummary,
      subType: options.subType || "",
      description: options.description || uiSummary,
      useTiming: options.useTiming || ["battle_start"],
      targetType: options.targetType || "self",
      consumeOnUse: false,
      effect,
      obtain: options.obtain,
      logText: options.logText,
      balanceNote: options.balanceNote,
      price: options.price,
      stackable: options.stackable ?? false,
      battleState: options.battleState,
      image: options.image,
      important: options.important,
      tradable: options.tradable,
      maxStack: options.maxStack,
      tradeMinPrice: options.tradeMinPrice,
      revealTitle: options.revealTitle,
      revealLine: options.revealLine,
    });
  }

  function key(id, name, rarity, internalTier, uiSummary, effect, options = {}) {
    defineItem({
      id, name, category: "key", rarity, internalTier, uiSummary,
      description: options.description || uiSummary,
      useTiming: options.useTiming || ["training"],
      targetType: options.targetType || "none",
      consumeOnUse: options.consumeOnUse ?? false,
      effect,
      obtain: options.obtain,
      logText: options.logText,
      balanceNote: options.balanceNote,
      price: options.price,
      sellable: false,
      usableInBattle: false,
      usableOnMap: false,
      equippable: false,
      image: options.image,
      important: options.important,
      tradable: options.tradable,
      maxStack: options.maxStack,
      tradeMinPrice: options.tradeMinPrice,
      revealTitle: options.revealTitle,
      revealLine: options.revealLine,
    });
  }

  function ship(id, name, rarity, internalTier, uiSummary, effect, options = {}) {
    defineItem({
      id, name, category: "ship", rarity, internalTier, uiSummary,
      subType: options.subType || "",
      description: options.description || uiSummary,
      useTiming: options.useTiming || ["passive"],
      targetType: options.targetType || "ship",
      consumeOnUse: false,
      effect,
      obtain: options.obtain,
      logText: options.logText,
      balanceNote: options.balanceNote,
      price: options.price,
      stackable: options.stackable ?? false,
      sellable: options.sellable ?? rarity !== "S",
      usableInBattle: false,
      usableOnMap: false,
      equippable: false,
      image: options.image,
      important: options.important,
      revealTitle: options.revealTitle,
      revealLine: options.revealLine,
    });
  }

  nav("smoke_repel", "海賊驅敵煙霧", "C", "nav_common_1", "接下來 3 格降低遭遇。", { kind: "avoid_random_encounter", steps: 3, strength: "low" }, { obtain: obtain(true, false, ["item_shop"], ["basic_supply_pool"]), price: 220, logText: { use: "玩家使用了海賊驅敵煙霧，航線暫時安靜下來。" } });
  nav("smoke_repel_plus", "偉大航道驅敵煙霧", "B", "nav_uncommon_1", "接下來 5 格降低遭遇。", { kind: "avoid_random_encounter", steps: 5, strength: "medium" }, { obtain: obtain(true, false, ["item_shop"], ["advanced_supply_pool"]), price: 480, logText: { use: "玩家使用了偉大航道驅敵煙霧，敵影被濃煙甩在後方。" } });
  nav("seastone_repel", "海樓石鎮獸彈", "A", "nav_rare_1", "接下來 7 格大幅降低遭遇。", { kind: "avoid_random_encounter", steps: 7, strength: "high" }, { obtain: obtain(false, true, ["item_shop"], ["elite_supply_pool"]), price: 1100, logText: { use: "海樓石鎮獸彈釋放壓制氣息，弱小敵人不敢靠近。" } });
  nav("sea_beast_lure", "海王類誘餌肉", "C", "nav_common_2", "接下來 5 格提高遭遇卡機率，遭遇戰勝利貝里 +20%。", { kind: "increase_encounter_with_reward", steps: 5, encounterBonus: 0.25, coinBonusOnWin: 0.2, exclusiveWithOtherLures: true }, { obtain: obtain(true, false, ["item_shop"], ["basic_supply_pool"]), price: 300, logText: { use: "海王類誘餌肉的味道吸引了敵影。" } });
  nav("rare_beast_lure", "珍寶香料肉", "B", "nav_uncommon_2", "接下來 5 格提高寶藏卡機率。", { kind: "increase_event_pool", steps: 5, pool: "treasure", bonus: 0.25, exclusiveWithOtherLures: true }, { obtain: obtain(false, true, ["item_shop"], ["treasure_pool"]), price: 650, logText: { use: "珍寶香料肉的氣味引來漂流寶箱與遺物線索。" } });
  nav("yonko_lure", "強敵挑釁旗", "A", "nav_rare_2", "接下來 5 格提高遭遇卡機率，遭遇戰勝利道具掉落率 +10%。", { kind: "increase_danger_event_and_drop", steps: 5, encounterBonus: 0.35, rareDropBonus: 0.1, exclusiveWithOtherLures: true }, { obtain: obtain(false, true, [], ["elite_supply_pool"]), price: 720, logText: { use: "玩家升起強敵挑釁旗，附近的敵影開始聚集。" } });
  nav("stealth_cloak", "潛航黑斗篷", "B", "nav_uncommon_3", "本回合避開主動攔截。", { kind: "prevent_forced_random_encounter", turns: 1, maxConsecutiveUses: 2 }, { obtain: obtain(false, false, ["item_shop"], ["advanced_supply_pool"]), price: 600, logText: { use: "玩家披上潛航黑斗篷，悄悄穿過航線。" } });
  nav("sound_shell", "轟音貝", "C", "nav_common_3", "嚇退過弱敵人。", { kind: "scare_low_level_enemy", requiredLevelGap: 5, blockIfDevilFruitUser: true }, { useTiming: ["after_encounter_before_battle"], obtain: obtain(true, false, ["item_shop"], ["sky_pool"]), price: 260, logText: { use: "轟音貝爆出巨響，敵人慌張逃離。" } });
  nav("honey_lure", "補給蜜糖", "C", "nav_common_4", "接下來 5 格提高藥物卡機率。", { kind: "increase_event_pool", steps: 5, pool: "medicine", bonus: 0.2, exclusiveWithOtherLures: true }, { useTiming: ["before_move", "before_island_event"], obtain: obtain(false, false, ["item_shop"], ["heal_pool"]), price: 240, logText: { use: "補給蜜糖的甜味讓附近更容易出現藥物補給。" } });
  nav("meat_lure", "海賊烤肉誘餌", "C", "nav_common_5", "接下來 5 格提高遭遇卡機率，遭遇戰勝利 EXP +10%。", { kind: "increase_battle_event_with_exp", steps: 5, battleEventBonus: 0.2, expBonusOnWin: 0.1, exclusiveWithOtherLures: true }, { obtain: obtain(true, false, ["item_shop"], ["basic_supply_pool"]), price: 300, logText: { use: "烤肉香味引來了想搶食物的敵人。" } });
  nav("seafood_lure", "海流誘餌", "C", "nav_common_6", "接下來 5 格提高天氣卡機率。", { kind: "increase_event_pool", steps: 5, pool: "weather", bonus: 0.2, exclusiveWithOtherLures: true }, { obtain: obtain(false, false, [], []), price: 130, logText: { use: "海流誘餌讓風向和浪勢變得活躍。" } });
  nav("mineral_lure", "岩鹽礦石餌", "B", "nav_uncommon_4", "接下來 5 格提高寶藏卡機率。", { kind: "increase_event_pool", steps: 5, pool: "treasure", bonus: 0.2, exclusiveWithOtherLures: true }, { useTiming: ["before_move", "before_island_event"], obtain: obtain(false, false, [], []), price: 280, logText: { use: "岩鹽礦石餌引來漂流寶箱與遺物線索。" } });
  nav("medical_ship_ticket", "醫療船呼叫券", "B", "nav_uncommon_5", "返回最近醫院島。", { kind: "teleport_to_nearest_hospital_and_heal_party", consumeOnUse: true, blockedInRestrictedArea: true }, { useTiming: ["after_move", "before_island_event"], obtain: obtain(false, false, ["item_shop"], ["heal_pool"]), price: 1200, logText: { use: "玩家呼叫醫療船，暫時撤離到安全地點。" } });
  nav("fixed_step", "指定步數券", "C", "nav_legacy_1", "指定本回合 1~6 步數。", { kind: "fixed_step" }, { obtain: obtain(false, false, ["item_shop"], ["basic_supply_pool"]), price: 3800 });
  nav("pointer", "航海指針", "C", "nav_legacy_2", "選路時多看一條路線資訊。", { kind: "route_insight" }, { obtain: obtain(false, false, ["item_shop"], ["basic_supply_pool"]), price: 450 });

  ship("ship_patch_canvas", "補帆帆布", "C", "ship_common_1", "移動骰擲出 1 時，本次移動 +1，每 4 回合最多觸發 1 次。", { kind: "ship_equipment", trigger: "low_roll_fix", triggerRoll: 1, moveBonus: 1, cooldownTurns: 4 }, { obtain: obtain(true, false, ["item_shop"], ["basic_supply_pool"]), price: 1200, balanceNote: "小幅減少低骰挫折。" });
  ship("ship_ration_barrel", "乾糧木桶", "C", "ship_common_2", "每場戰鬥勝利後，HP 最低的存活夥伴回復最大 HP 3%。", { kind: "ship_equipment", battleWinLowestHeal: 0.03 }, { obtain: obtain(true, false, ["item_shop"], ["heal_pool", "basic_supply_pool"]), price: 1350, balanceNote: "低量續航，不取代藥物。" });
  ship("ship_escape_ladder", "甲板繩梯", "C", "ship_common_3", "一般戰鬥與敵島撤退更容易成功，Boss 戰無效。", { kind: "ship_equipment", escapeThresholdBonus: 1, minimumEscapeThreshold: 6, bossDisabled: true }, { obtain: obtain(true, false, ["item_shop"], ["basic_supply_pool", "treasure_pool"]), price: 1200, balanceNote: "給逃跑流入門。" });
  ship("ship_tailwind_sail", "順風三角帆", "B", "ship_uncommon_1", "每 5 回合 1 次，擲骰後自動補 +1 移動。", { kind: "ship_equipment", trigger: "tailwind_step", moveBonus: 1, cooldownTurns: 5 }, { obtain: obtain(false, false, ["item_shop"], ["advanced_supply_pool"]), price: 2400, balanceNote: "控步數但冷卻長。" });
  ship("ship_observer_spyglass", "觀測員望遠鏡台", "B", "ship_uncommon_2", "海格二選一時，額外顯示 1 張卡的次類型。", { kind: "ship_equipment", seaChoiceTypeReveal: 1 }, { obtain: obtain(false, false, ["item_shop"], ["advanced_supply_pool", "treasure_pool"]), price: 2500, balanceNote: "比 C 級更準，但仍不是完全揭曉。" });
  ship("ship_reinforced_bottom_plate", "船底加固鐵板", "B", "ship_uncommon_3", "海格固定 HP 損傷 -15%，戰鬥第一回合第一次受傷 -5%。", { kind: "ship_equipment", seaHpDamageReduction: 0.15, firstBattleDamageReduction: 0.05 }, { obtain: obtain(false, false, ["item_shop"], ["advanced_supply_pool"]), price: 2600, balanceNote: "泛用防禦但數值小。" });
  ship("ship_stove_upgrade", "廚房火爐改良件", "B", "ship_uncommon_4", "戰鬥勝利後全隊回復最大 HP 2%；若有人低於 30%，最低 HP 夥伴額外回 3%。", { kind: "ship_equipment", battleWinTeamHeal: 0.02, lowHpThreshold: 0.3, battleWinLowHpExtraHeal: 0.03 }, { obtain: obtain(false, false, ["item_shop"], ["heal_pool", "advanced_supply_pool"]), price: 2800, balanceNote: "長線續航，不是戰中回血。" });
  ship("ship_cola_aux_engine", "可樂輔助引擎", "A", "ship_rare_1", "每 6 回合自動啟動 1 次爆發航行，擲骰後移動 +2。", { kind: "ship_equipment", trigger: "cola_burst", moveBonus: 2, cooldownTurns: 6, avoidDirectFinal: true }, { obtain: obtain(false, true, ["item_shop"], ["elite_supply_pool"]), price: 4800, balanceNote: "強移動，但有長冷卻。" });
  ship("ship_coup_de_burst_port", "風來砲改造口", "A", "ship_rare_2", "一般戰鬥逃跑更容易成功；成功逃跑後下次移動 +2。", { kind: "ship_equipment", escapeThresholdBonus: 2, escapeMoveBonus: 2, bossDisabled: true }, { obtain: obtain(false, true, ["item_shop"], ["elite_supply_pool"]), price: 5000, balanceNote: "逃跑流核心，不適合硬推副本。" });
  ship("ship_bird_nest_tower", "瞭望鳥巢高台", "A", "ship_rare_3", "海格二選一時，標示未知卡是否可能觸發戰鬥。", { kind: "ship_equipment", seaChoiceBattleRisk: true }, { obtain: obtain(false, true, ["item_shop"], ["elite_supply_pool", "treasure_pool"]), price: 5200, balanceNote: "改變探索風險判斷。" });
  ship("ship_adam_sub_keel", "寶樹亞當副龍骨", "A", "ship_rare_4", "每場戰鬥開始，全隊獲得最大 HP 5% 護盾；Boss 戰為 3%。", { kind: "ship_equipment", battleStartShield: 0.05, bossBattleStartShield: 0.03, exclusiveWith: ["ship_adam_main_keel"] }, { obtain: obtain(false, true, ["item_shop"], ["elite_supply_pool"]), price: 5600, balanceNote: "穩定但不是高輸出。" });
  ship("ship_dream_medical_galley", "夢幻廚房與醫療聯艙", "S", "ship_secret_1", "戰鬥勝利後全隊回復最大 HP 4%；每場最多 1 名瀕死夥伴以 1 HP 回隊伍。", { kind: "ship_equipment", battleWinTeamHeal: 0.04, battleWinReviveOneHp: true }, { obtain: obtain(false, true, ["item_shop"], ["rare_pool"]), price: 9800, sellable: false, balanceNote: "長線副本強，但不戰中復活。" });

  ship("ship_plank", "船材木板", "C", "ship_material_common_1", "水之七島船隻開孔與低階改造素材。", { kind: "ship_material", materialTier: "common" }, { subType: "material", stackable: true, obtain: obtain(true, false, ["item_shop"], ["basic_supply_pool", "treasure_pool"]), price: 300 });
  ship("ship_toolbox", "船匠工具箱", "B", "ship_material_uncommon_1", "水之七島船隻開孔與中階改造素材。", { kind: "ship_material", materialTier: "uncommon" }, { subType: "material", stackable: true, obtain: obtain(false, false, ["item_shop"], ["advanced_supply_pool", "treasure_pool"]), price: 900 });
  ship("ship_coating_resin", "鍍膜樹脂", "A", "ship_material_rare_1", "高階船殼、潛航與耐候改造素材。", { kind: "ship_material", materialTier: "rare" }, { subType: "material", stackable: true, obtain: obtain(false, true, ["item_shop"], ["elite_supply_pool", "treasure_pool"]), price: 2400 });
  ship("ship_adam_wood", "寶樹亞當木片", "S", "ship_material_secret_1", "傳說級龍骨與船體改造素材。", { kind: "ship_material", materialTier: "secret" }, { subType: "material", stackable: true, sellable: false, obtain: obtain(false, true, ["item_shop"], ["rare_pool"]), price: 6000 });

  battle("smoke_shell", "煙霧貝", "C", "battle_common_1", "脫離一般戰鬥。", { kind: "escape_battle", successRate: 1, blockedIfNoEscape: true }, { targetType: "none", obtain: obtain(true, false, ["item_shop"], ["sky_pool"]), price: 500, logText: { use: "煙霧貝噴出濃煙，隊伍趁亂脫離戰鬥。" } });
  battle("sticky_bomb", "黏雲彈", "C", "battle_common_2", "降低敵人速度。", { kind: "apply_stat_stage", target: "enemy", stat: "speed", stage: -1, turns: 3, uniqueDebuffKey: "sticky_cloud" }, { targetType: "enemy", obtain: obtain(true, false, ["item_shop"], ["weather_pool"]), price: 260, logText: { use: "黏雲彈纏住敵人，使其動作變慢。" } });
  battle("mud_bomb", "沼泥彈", "C", "battle_common_3", "降低敵人命中。", { kind: "apply_accuracy_modifier", target: "enemy", accuracyMultiplier: 0.9, turns: 2, uniqueDebuffKey: "mud_blind" }, { targetType: "enemy", obtain: obtain(true, false, ["item_shop"], ["weather_pool"]), price: 260, logText: { use: "沼泥彈糊住敵人的視線。" } });
  battle("ice_bomb", "冰霜貝彈", "B", "battle_uncommon_1", "降速，低機率冰凍。", { kind: "apply_speed_multiplier_and_status_chance", target: "enemy", speedMultiplier: 0.8, turns: 3, statusChance: { status: "freeze", chance: 0.12, ignoreStatusChanceBonus: true } }, { targetType: "enemy", obtain: obtain(false, true, ["item_shop"], ["weather_pool"]), price: 600 });
  battle("blue_heal_flute", "清夢海螺笛", "C", "battle_common_4", "解除睡眠。", { kind: "cure_status", statuses: ["sleep", "drowsy"] }, { obtain: obtain(true, false, ["item_shop", "item_shop"], ["heal_pool"]), price: 90 });
  battle("yellow_clear_flute", "破幻海螺笛", "C", "battle_common_5", "解除混亂。", { kind: "cure_status", statuses: ["confuse"] }, { obtain: obtain(true, false, ["item_shop", "item_shop"], ["heal_pool"]), price: 90 });
  battle("red_morale_flute", "鼓舞戰歌笛", "C", "battle_common_6", "解除魅惑 / 恐懼。", { kind: "cure_status", statuses: ["charm", "fear"] }, { obtain: obtain(true, false, ["item_shop", "item_shop"], ["heal_pool"]), price: 90 });
  battle("antidote_herb", "磁鼓島解毒草", "C", "battle_common_7", "解除中毒。", { kind: "cure_status", statuses: ["poison"] }, { obtain: obtain(true, false, ["item_shop", "item_shop"], ["heal_pool"]), price: 80 });
  battle("burn_ointment", "船醫燒傷藥膏", "C", "battle_common_8", "解除灼傷。", { kind: "cure_status", statuses: ["burn"] }, { obtain: obtain(true, false, ["item_shop", "item_shop"], ["heal_pool"]), price: 80 });
  battle("thaw_drink", "磁鼓島熱湯", "C", "battle_common_9", "解除冰凍。", { kind: "cure_status", statuses: ["freeze"] }, { obtain: obtain(true, false, ["item_shop", "item_shop"], ["heal_pool"]), price: 80 });
  battle("paralyze_oil", "活絡藥油", "C", "battle_common_10", "解除麻痺。", { kind: "cure_status", statuses: ["paralyze"] }, { obtain: obtain(true, false, ["item_shop", "item_shop"], ["heal_pool"]), price: 80 });
  battle("all_cure_medicine", "船醫萬能藥", "B", "battle_uncommon_2", "解除所有異常。", { kind: "cure_all_status", excludeLockedStoryStatus: true }, { obtain: obtain(false, true, ["item_shop", "item_shop"], ["heal_pool"]), price: 520, logText: { use: "船醫萬能藥清除了所有異常狀態。" } });
  battle("small_meat", "小塊帶骨肉", "C", "battle_common_11", "回復 60 HP。", { kind: "heal_hp", amount: 60 }, { useTiming: ["battle_turn", "before_move", "after_move", "before_island_event"], usableOnMap: true, obtain: obtain(true, false, ["item_shop", "item_shop"], ["heal_pool"]), price: 180 });
  battle("large_meat", "豪快帶骨肉", "B", "battle_uncommon_3", "回復 150 HP。", { kind: "heal_hp", amount: 150 }, { useTiming: ["battle_turn", "before_move", "after_move", "before_island_event"], usableOnMap: true, obtain: obtain(true, false, ["item_shop", "item_shop"], ["heal_pool"]), price: 520 });
  battle("emergency_med_kit", "船醫緊急醫療包", "B", "battle_uncommon_heal_2", "回復 35% 最大 HP，並解除中毒 / 灼傷 / 麻痺。", { kind: "heal_percent_and_cure_status", percent: 0.35, statuses: ["poison", "burn", "paralyze"] }, { useTiming: ["battle_turn", "before_move", "after_move", "before_island_event"], usableOnMap: true, obtain: obtain(true, false, ["item_shop"], ["heal_pool"]), price: 800 });
  battle("pirate_bento", "海賊盛宴便當", "A", "battle_rare_1", "回復 70% 最大 HP。", { kind: "heal_hp_percent", percent: 0.7 }, { useTiming: ["battle_turn", "before_move", "after_move", "before_island_event"], usableOnMap: true, obtain: obtain(false, true, ["item_shop"], ["heal_pool"]), price: 1200 });
  battle("super_meat", "特大帶骨肉", "A", "battle_rare_heal_2", "回復 220 HP。", { kind: "heal_hp", amount: 220 }, { useTiming: ["battle_turn", "before_move", "after_move", "before_island_event"], usableOnMap: true, obtain: obtain(false, true, ["item_shop"], ["heal_pool"]), price: 950 });
  battle("party_meat_platter", "草帽團肉拼盤", "A", "battle_rare_heal_3", "全隊回復 35% 最大 HP。", { kind: "heal_party_percent_battle", percent: 0.35 }, { useTiming: ["battle_turn", "before_move", "after_move", "before_island_event"], usableOnMap: true, targetType: "party", obtain: obtain(false, true, ["item_shop"], ["heal_pool"]), price: 1500 });
  battle("rum_secret", "特調朗姆補給酒", "B", "battle_uncommon_4", "恢復技能使用次數。", { kind: "restore_skill_use", amount: 1, cannotExceedMax: true }, { obtain: obtain(true, false, ["item_shop"], ["advanced_supply_pool"]), price: 680 });
  battle("navigator_supply", "航海士急救箱", "A", "battle_rare_2", "全隊回復 50% 最大 HP。", { kind: "heal_party_percent_outside_battle", percent: 0.5 }, { useTiming: ["battle_turn", "before_move", "after_move", "before_island_event"], usableInBattle: true, usableOnMap: true, targetType: "party", obtain: obtain(false, true, ["item_shop", "item_shop"], ["heal_pool"]), price: 1900 });
  battle("miracle_bone", "奇蹟帶骨肉", "S", "battle_secret_1", "復活 1 名角色並回復 50% 最大 HP。", { kind: "revive", hpPercent: 0.5, maxUsesPerBattle: 1 }, { useTiming: ["battle_turn", "before_move", "after_move", "before_island_event"], usableOnMap: true, targetType: "ally", obtain: obtain(false, true, [], ["rare_pool"]), price: 0 });
  battle("full_party_feast", "全隊宴會餐盒", "S", "battle_secret_heal_2", "全隊回復 60% 最大 HP。", { kind: "heal_party_percent_battle", percent: 0.6, maxUsesPerBattle: 1 }, { useTiming: ["battle_turn", "before_move", "after_move", "before_island_event"], usableOnMap: true, targetType: "party", obtain: obtain(false, true, [], ["rare_pool"]), price: 0 });
  battle("heal_2", "小補給", "C", "battle_legacy_0", "恢復船團與夥伴 25 HP。", { kind: "heal_hp", amount: 25 }, { useTiming: ["battle_turn", "before_move", "after_move", "before_island_event"], usableInBattle: true, usableOnMap: true, obtain: obtain(false, false, ["item_shop"], ["basic_supply_pool"]), price: 120 });
  battle("battle_food", "戰鬥糧食", "C", "battle_legacy_1", "回復目前夥伴 40% 最大 HP。", { kind: "heal_hp_percent", percent: 0.4 }, { useTiming: ["battle_turn", "before_move", "after_move", "before_island_event"], usableOnMap: true, obtain: obtain(false, false, ["item_shop"], ["basic_supply_pool"]), price: 650 });
  battle("guard_charm", "防具 / 守護護符", "C", "battle_legacy_2", "本回合受到傷害 -35%。", { kind: "temporary_shield", shieldRatio: 0.35 }, { obtain: obtain(false, false, ["item_shop"], ["basic_supply_pool"]), price: 600 });
  battle("odd_dice", "單數骰子", "B", "battle_uncommon_parity_1", "選擇我方或敵方；接下來 2 次行動的第一顆戰鬥骰只會出現單數。", { kind: "force_first_die_parity", parity: "odd", turns: 2 }, { targetType: "battle_side", obtain: obtain(false, false, ["item_shop"], ["advanced_supply_pool"]), price: 4800, logText: { use: "單數骰子的金光纏住骰面。" } });
  battle("even_dice", "雙數骰子", "B", "battle_uncommon_parity_2", "選擇我方或敵方；接下來 2 次行動的第一顆戰鬥骰只會出現雙數。", { kind: "force_first_die_parity", parity: "even", turns: 2 }, { targetType: "battle_side", obtain: obtain(false, false, ["item_shop"], ["advanced_supply_pool"]), price: 4800, logText: { use: "雙數骰子的藍光鎖定骰面。" } });

  held("bright_powder", "閃光貝粉", "B", "held_uncommon_1", "降低敵人命中。", { kind: "incoming_accuracy_down", value: 0.05 }, { obtain: obtain(true, false, ["item_shop"], ["weather_pool"]), price: 1600 });
  held("quick_claw", "疾風鉤爪", "A", "held_rare_1", "15% 機率先制行動；5% 暴擊。", { kind: "quick_action_chance", chance: 0.15, oncePerTurn: true, critRateBonus: 0.05 }, { obtain: obtain(false, true, ["item_shop"], ["elite_supply_pool"]), price: 3600 });
  held("king_badge", "船長威嚴徽章", "A", "held_rare_2", "攻擊時機率畏縮。", { kind: "flinch_on_damage", chance: 0.1, sameTargetLimitPerTurn: 1 }, { obtain: obtain(false, true, ["item_shop"], ["treasure_pool"]), price: 3800 });
  held("treasure_coin", "寶藏幸運金幣", "B", "held_uncommon_2", "出戰後金幣 +50%。", { kind: "battle_coin_bonus_if_participated", bonus: 0.5, partyStackRule: "highest_only" }, { obtain: obtain(true, false, ["item_shop"], ["treasure_pool"]), price: 2800 });
  held("cleanse_tag", "避敵航海符", "B", "held_uncommon_3", "降低低階遭遇。", { kind: "leader_reduce_random_encounter", strength: "low" }, { obtain: obtain(false, false, ["item_shop"], ["basic_supply_pool"]), price: 1500 });
  held("smoke_ball", "逃脫煙霧球", "C", "held_common_1", "一般戰鬥必定逃跑。", { kind: "guaranteed_escape_once", oncePerBattle: true, blockedIfNoEscape: true }, { obtain: obtain(true, false, ["item_shop"], ["basic_supply_pool"]), price: 1000 });
  held("focus_band", "不屈頭巾", "A", "held_rare_3", "機率撐住致命傷。", { kind: "survive_fatal_chance", chance: 0.2, hpLeft: 1, maxTriggersPerTurn: 1 }, { obtain: obtain(false, true, ["item_shop"], ["rare_pool"]), price: 4500 });
  held("focus_sash", "不倒披帶", "S", "held_secret_1", "滿血時撐住一次致命傷。", { kind: "survive_fatal_once_if_full_hp", hpLeft: 1, oncePerBattle: true }, { obtain: obtain(false, true, [], ["rare_pool"]), price: 0 });
  held("lucky_egg", "幸運海鷗蛋", "A", "held_rare_4", "經驗 +30%。", { kind: "exp_bonus_self", bonus: 0.3 }, { obtain: obtain(false, false, ["item_shop"], ["rare_pool"]), price: 4800 });
  held("scope_lens", "狙擊瞄準鏡", "B", "held_uncommon_4", "10% 暴擊。", { kind: "crit_rate_bonus", value: 0.1 }, { obtain: obtain(true, false, ["item_shop"], ["treasure_pool"]), price: 2200 });
  held("leftovers_meat", "剩下的帶骨肉", "A", "held_rare_5", "每回合回復最大 HP 8%。", { kind: "heal_each_turn", percent: 0.08, timing: "turn_end" }, { obtain: obtain(false, false, ["item_shop"], ["heal_pool"]), price: 5200 });
  held("shell_bell", "回音貝鈴", "A", "held_rare_6", "攻擊後回復造成傷害 15% 的 HP。", { kind: "heal_by_direct_damage_dealt", percent: 0.15 }, { obtain: obtain(false, false, ["item_shop"], ["sky_pool"]), price: 5200 });
  held("white_herb", "淨化香草", "B", "held_uncommon_5", "解除一次能力下降。", { kind: "clear_stat_down_once", oncePerBattle: true }, { obtain: obtain(false, false, ["item_shop"], ["heal_pool"]), price: 1800 });
  held("mental_herb", "清心香草", "B", "held_uncommon_6", "解除一次控制。", { kind: "clear_control_status_once", statuses: ["confuse", "charm", "fear", "silence"], oncePerBattle: true }, { obtain: obtain(false, false, ["item_shop"], ["heal_pool"]), price: 1800 });
  held("power_herb", "爆發香草", "A", "held_rare_7", "每場第一次攻擊更快且威力小幅提升。", { kind: "skip_charge_once", oncePerBattle: true, fallbackDamageBonus: 0.15 }, { obtain: obtain(false, false, ["item_shop"], ["training_pool"]), price: 3800 });
  held("choice_band", "武裝頭巾", "A", "held_rare_8", "物理傷害提高，但鎖招。", { kind: "choice_lock_physical_damage", damageBonus: 0.25, lockFirstAttackSkill: true }, { obtain: obtain(false, false, ["item_shop"], ["treasure_pool"]), price: 4200 });
  held("choice_glasses", "戰術墨鏡", "A", "held_rare_9", "技能傷害提高，但鎖招。", { kind: "choice_lock_special_damage", damageBonus: 0.25, lockFirstAttackSkill: true, ignoreSupportSkill: true }, { obtain: obtain(false, false, ["item_shop"], ["treasure_pool"]), price: 4200 });
  held("choice_scarf", "疾風圍巾", "A", "held_rare_10", "速度提高，但鎖招。", { kind: "choice_lock_speed_bonus", speedBonus: 0.25, lockFirstAttackSkill: true }, { obtain: obtain(false, false, ["item_shop"], ["treasure_pool"]), price: 4200 });
  held("life_orb", "生命燃燒寶珠", "S", "held_secret_2", "大幅增傷，但攻擊會自傷。", { kind: "damage_bonus_with_self_damage", damageBonus: 0.3, selfDamageMaxHpPercent: 0.08, directDamageOnly: true }, { obtain: obtain(false, true, [], ["rare_pool"]), price: 0 });
  held("toxic_orb", "劇毒海珠", "A", "held_rare_11", "開場使自己中毒。", { kind: "self_status_on_battle_start", status: "poison" }, { obtain: obtain(false, true, ["item_shop"], ["elite_supply_pool"]), price: 3000 });
  held("flame_orb", "炎熱海珠", "A", "held_rare_12", "開場使自己灼傷。", { kind: "self_status_on_battle_start", status: "burn" }, { obtain: obtain(false, true, ["item_shop"], ["elite_supply_pool"]), price: 3000 });
  held("metronome", "戰鼓節拍器", "B", "held_uncommon_7", "連續同招逐漸增傷。", { kind: "same_skill_damage_stack", stackBonus: 0.1, maxBonus: 0.4, resetOnSkillChange: true }, { obtain: obtain(true, false, ["item_shop"], ["advanced_supply_pool"]), price: 2200 });
  held("iron_ball", "海樓鐵球", "B", "held_uncommon_8", "速度 -25%，受到直接攻擊傷害 -12%。", { kind: "speed_down_damage_reduction", speedMultiplier: 0.75, reduction: 0.12 }, { obtain: obtain(false, false, ["item_shop"], ["training_pool"]), price: 1600 });
  held("lagging_tail", "沉重船錨尾", "B", "held_uncommon_9", "後手行動，威力提高。", { kind: "move_late_damage_bonus", damageBonus: 0.15, priorityModifier: "late", allowPrioritySkillOverride: true }, { obtain: obtain(false, false, ["item_shop"], ["training_pool"]), price: 1600 });
  held("black_sludge", "劇毒黑泥", "A", "held_rare_13", "每回合回復最大 HP 6%。", { kind: "heal_each_turn", percent: 0.06, timing: "turn_end" }, { obtain: obtain(false, true, ["item_shop"], ["elite_supply_pool"]), price: 4200 });
  held("rocky_helmet", "反擊釘盔", "A", "held_rare_14", "被近戰攻擊時反傷。", { kind: "reflect_damage_on_melee_hit", attackerMaxHpPercent: 0.08, oncePerSkill: true }, { obtain: obtain(false, false, ["item_shop"], ["treasure_pool"]), price: 4000 });
  held("air_balloon_shell", "浮空雲貝", "B", "held_uncommon_10", "每場第一次受擊傷害 -35%。", { kind: "reduce_first_hit_damage", reduction: 0.35, oncePerBattle: true }, { obtain: obtain(false, false, ["item_shop"], ["sky_pool"]), price: 2300 });
  held("red_card", "海軍通緝令", "A", "held_rare_15", "被打後讓敵方速度與命中下降一次。", { kind: "force_attacker_switch_once", oncePerBattle: true, noConsumeTriggerIfInvalid: true }, { obtain: obtain(false, true, ["item_shop"], ["treasure_pool"]), price: 3800 });
  held("eject_button", "緊急撤退鈕", "B", "held_uncommon_11", "受傷後自動換人。", { kind: "switch_out_after_hit_once", oncePerBattle: true, noTriggerIfNoBench: true }, { obtain: obtain(false, false, ["item_shop"], ["advanced_supply_pool"]), price: 2000 });
  held("relay_pirate_flag", "交棒海賊旗", "A", "held_rare_18", "持有者完成行動後，於本回合結束時退場並選擇一名存活船員上場。", { kind: "switch_out_after_action", timing: "round_end", noTriggerIfNoBench: true }, { obtain: obtain(false, false, ["item_shop"], ["treasure_pool"]), price: 4000, balanceNote: "必須由持有者實際完成行動；手動換人、瀕死或已被其他效果換下時不觸發。" });
  held("escape_pack", "緊急避難包", "B", "held_uncommon_12", "能力下降時自動換人。", { kind: "switch_out_when_stat_down_once", oncePerBattle: true, noTriggerIfNoBench: true }, { obtain: obtain(false, false, ["item_shop"], ["advanced_supply_pool"]), price: 2000 });
  held("heavy_duty_boots", "防陷厚底靴", "B", "held_uncommon_13", "防止偏航與地形類負面事件。", { kind: "immune_terrain_hazards", hazards: ["random_teleport", "spikes", "burning_floor", "poison_swamp", "ice_slip"] }, { obtain: obtain(false, false, ["item_shop"], ["training_pool"]), price: 1800 });
  held("utility_umbrella", "航海萬能傘", "B", "held_uncommon_14", "防止海格天氣負面事件。", { kind: "immune_negative_weather_effects" }, { obtain: obtain(false, false, ["item_shop"], ["weather_pool"]), price: 1800 });
  held("weakness_policy", "逆境反擊契約", "S", "held_secret_3", "被克制攻擊後大幅反擊。", { kind: "boost_when_hit_by_weakness", oncePerBattle: true, statStages: { atk: 2, satk: 2 } }, { obtain: obtain(false, true, [], ["rare_pool"]), price: 0 });
  held("blunder_policy", "失手加速契約", "A", "held_rare_16", "未命中後速度提升。", { kind: "boost_speed_when_miss", oncePerBattle: true, speedStage: 2, triggerOnlyAccuracyMiss: true }, { obtain: obtain(false, false, ["item_shop"], ["treasure_pool"]), price: 3600 });
  held("assault_vest", "突擊防彈背心", "A", "held_rare_17", "特防提高，不能用輔助技。", { kind: "sdef_bonus_block_support_skills", sdefMultiplier: 1.4, blockSkillType: "support" }, { obtain: obtain(false, false, ["item_shop"], ["treasure_pool"]), price: 4400 });

  held("devon_kyubi_mask", "戴彭的九尾幻面", "S", "held_yonko_counter_1", "攻擊屬性永遠轉為克制目前敵人的屬性；並干擾預判類效果。", { kind: "force_advantage_attribute", targetYonko: "yonko_shanks", forceAdvantageAttribute: true, hitChanceBonus: 1 }, { obtain: obtain(false, false, [], []), price: 0, sellable: false, important: true });
  held("griffon_sword", "格里芬之劍", "S", "held_yonko_counter_2", "暴擊傷害倍率 +0.2；命中時撕開防禦，對凱多可額外破壞龍鱗。", { kind: "yonko_counter_griffon", targetYonko: "yonko_kaido", defenseStage: -1, breakScale: 1, breakScaleOnAdvantage: 1, criticalDamageBonus: 0.2 }, { obtain: obtain(false, false, [], []), price: 0, sellable: false, important: true });
  held("fearless_heart", "無畏之心", "S", "held_yonko_counter_3", "攻擊命中追加敵人最大 HP 5% 固定傷害；對大媽有 80% 抵抗靈魂拷問。", { kind: "yonko_counter_fearless", targetYonko: "yonko_bigmom", maxHpDamagePerHit: 0.05, soulTortureResistChance: 0.8 }, { obtain: obtain(false, false, [], []), price: 0, sellable: false, important: true });
  held("sun_pirates_badge", "太陽海賊團的徽章", "S", "held_yonko_counter_4", "有機率抵抗束縛、麻痺、速度或命中下降；對黑鬍子可照破暗穴與削弱震波。", { kind: "yonko_counter_sun_badge", targetYonko: "yonko_blackbeard", statusResistChance: 0.35, darkCaptureBlocks: 2, backlineQuakeReduction: 0.5, frontQuakeReduction: 0.3 }, { obtain: obtain(false, false, [], []), price: 0, sellable: false, important: true });

  held("impact_shell", "衝擊貝", "A", "shell_rare_1", "受傷後儲存 30% 傷害反擊。", { kind: "store_damage_counter", storeRate: 0.3, maxStoredHits: 1, releaseOnNextDirectAttack: true, clearAfterRelease: true, directDamageOnly: true, selfDamageRate: 0 }, { subType: "shell", obtain: obtain(false, false, ["item_shop"], ["sky_pool"]), price: 3800 });
  held("reject_shell", "排擊貝", "S", "shell_secret_1", "高風險反擊貝。", { kind: "store_damage_counter", storeRate: 0.7, maxStoredHits: 1, releaseOnNextDirectAttack: true, clearAfterRelease: true, directDamageOnly: true, selfDamageMaxHpPercentAfterRelease: 0.15 }, { subType: "shell", obtain: obtain(false, true, [], ["rare_pool"]), price: 0 });
  held("wind_shell", "疾風貝", "B", "shell_uncommon_1", "速度 +15%。", { kind: "temporary_speed_multiplier", multiplier: 1.15 }, { subType: "shell", obtain: obtain(false, false, ["item_shop"], ["sky_pool"]), price: 2000 });
  held("cloud_shell", "護雲貝", "B", "shell_uncommon_2", "第一次受擊減傷。", { kind: "reduce_first_hit_damage", reduction: 0.3, oncePerBattle: true }, { subType: "shell", obtain: obtain(false, false, ["item_shop"], ["sky_pool"]), price: 2100 });
  held("flame_shell", "炎熱貝", "A", "shell_rare_2", "火焰技能傷害 +15%，並有機率灼傷。", { kind: "skill_tag_damage_bonus_and_status_chance", skillTag: "fire", damageBonus: 0.15, statusChance: { status: "burn", chance: 0.1 } }, { subType: "shell", obtain: obtain(false, true, ["item_shop"], ["sky_pool"]), price: 3900 });
  held("thunder_shell", "雷鳴貝", "A", "shell_rare_3", "雷電技能傷害 +15%，並有機率麻痺。", { kind: "skill_tag_damage_bonus_and_status_chance", skillTag: "thunder", damageBonus: 0.15, statusChance: { status: "paralyze", chance: 0.1 } }, { subType: "shell", obtain: obtain(false, true, ["item_shop"], ["sky_pool"]), price: 3900 });
  held("tone_shell", "音擊貝", "B", "shell_uncommon_3", "聲音技能傷害 +20%，首次使用提升特攻。", { kind: "sound_skill_bonus_and_satk_once", skillTag: "sound", damageBonus: 0.2, satkStage: 1, satkBoostOncePerBattle: true }, { subType: "shell", obtain: obtain(false, false, ["item_shop"], ["sky_pool"]), price: 2400 });
  held("vision_shell", "映像反擊貝", "A", "shell_rare_4", "記錄一次技能並反擊。", { kind: "record_first_single_target_skill_then_counter", counterPowerRate: 0.5, oncePerBattle: true, ignoreAoe: true, ignoreDot: true, allowSimplifiedCounterDamage: true }, { subType: "shell", obtain: obtain(false, false, ["item_shop"], ["sky_pool"]), price: 4200 });
  held("light_shell", "照明貝", "C", "shell_common_1", "每場自動解除一次麻痺 / 冰凍 / 束縛。", { kind: "clear_control_status_once", statuses: ["paralyze", "freeze", "bind"], oncePerBattle: true }, { subType: "shell", obtain: obtain(false, false, ["item_shop", "item_shop"], ["sky_pool"]), price: 1200 });
  held("heal_shell", "治癒雲貝", "A", "shell_rare_5", "低於 40% HP 時自動回復 35%。", { kind: "auto_heal_when_low_hp", threshold: 0.4, healPercent: 0.35, oncePerBattle: true }, { subType: "shell", obtain: obtain(false, false, ["item_shop"], ["heal_pool"]), price: 4800 });

  [
    {
      id: "shiki_oto_kogarashi",
      name: "櫻十・木枯",
      summary: "速度、物理攻擊各 +20%，並有 5% 暴擊；每場第一次受到直接攻擊時，整次招式傷害降低 40%。",
      effect: { kind: "postgame_shiki_oto_kogarashi", speedMultiplier: 1.2, atkMultiplier: 1.2, firstDirectDamageReduction: 0.4, critRateBonus: 0.05, oncePerBattle: true },
    },
    {
      id: "tesoro_gran_tesoro_gold_rings",
      name: "Gran Tesoro 黃金戒",
      summary: "直接攻擊成功造成傷害時累積黃金；三層時使敵人束縛一回合，防禦、特防各 -1 並持續整場。每場一次；參戰獲勝時貝里 +200%。",
      effect: { kind: "postgame_tesoro_gold_rings", requiredStacks: 3, bindTurns: 1, enemyStages: { def: -1, sdef: -1 }, battleCoinBonus: 2, oncePerBattle: true },
    },
    {
      id: "zephyr_battle_smasher",
      name: "Battle Smasher",
      summary: "命中累積熱量；三點後下一次直接攻擊傷害 +40%、無視 20% 防禦。攻擊無論命中或落空都消耗爆發並反噬最大 HP 30%，最低保留 1 HP。",
      effect: { kind: "postgame_zephyr_battle_smasher", requiredHeat: 3, damageBonus: 0.4, ignoreDefenseRatio: 0.2, recoilMaxHp: 0.3, consumeOnMiss: true, recoilCannotKo: true },
    },
    {
      id: "tot_musica_demon_score",
      name: "魔王樂譜",
      summary: "連續攻擊技能同一次行動中，各段依序獲得 +1%、+2%、+4%、+8% 並持續翻倍，不設上限。",
      effect: { kind: "postgame_tot_musica_demon_score", firstHitBonus: 0.01, progression: "double_each_hit", uncapped: true },
    },
    {
      id: "bullet_large_bullet_armor",
      name: "巴雷特的武器庫",
      summary: "可從背包裝入兩件不同的其他攜帶物，兩件效果與各自的觸發狀態同時生效；同一種不能重複裝入，卸下武器庫時內裝物會一併回到背包。",
      effect: { kind: "postgame_bullet_arsenal", slotCount: 2 },
      image: "images/board/items/postgame_boss_relics/bullet_arsenal.webp",
    },
    {
      id: "saga_seven_star_sword",
      name: "七星劍",
      summary: "每損失最大 HP 5%，直接攻擊傷害 +4%，接近瀕死時最高 +76%。",
      effect: { kind: "postgame_saga_seven_star_sword", lostHpStep: 0.05, damageBonusPerStep: 0.04, maxDamageBonus: 0.76 },
    },
    {
      id: "judge_germa66_battle_suit",
      name: "傑爾馬66戰鬥服",
      summary: "每場第一次受到致命傷害時，該次傷害降低 100%，防禦、速度各 +1。新世界香吉士裝備時，進入戰鬥會變身為隱形黑並替換戰鬥圖、招式、被動與戰鬥數值。",
      effect: { kind: "postgame_judge_germa66_suit", fatalDamageReduction: 1, selfStages: { def: 1, spd: 1 }, oncePerBattle: true },
    },
    {
      id: "lucci_awakened_black_flame_hagoromo",
      name: "覺醒黑焰羽衣",
      summary: "速度與最大生命各 +30%。",
      effect: { kind: "postgame_lucci_black_flame", speedMultiplier: 1.3, maxHpMultiplier: 1.3 },
    },
    {
      id: "king_sword",
      name: "KING 的佩刀",
      summary: "背火時減傷 25%；受直接攻擊後熄火，速度 +25%、下一次直接攻擊傷害 +25%，完成直接攻擊後重新點燃。",
      effect: { kind: "postgame_king_sword", flameDamageReduction: 0.25, unlitSpeedMultiplier: 1.25, nextDirectDamageBonus: 0.25 },
    },
    {
      id: "enma",
      name: "閻魔",
      summary: "物攻 +15%、8% 暴擊、暴擊傷害倍率 +0.15。新世界索隆攜帶後實際參戰並贏得一場非切磋戰鬥，會永久特殊進化為索隆十郎；閻魔不會被消耗。",
      effect: { kind: "zoro_enma", atkMultiplier: 1.15, critRateBonus: 0.08, criticalDamageBonus: 0.15 },
    },
    {
      id: "katakuri_mogura",
      name: "三叉戟「土龍」",
      summary: "特攻 +30%；敵人連續兩次行動使用相同直接攻擊時，第二次必定落空並受到最大 HP 40% 反擊。每場一次。",
      effect: { kind: "postgame_katakuri_mogura", satkMultiplier: 1.3, counterMaxHpRatio: 0.4, requireConsecutiveActions: true, oncePerBattle: true },
    },
    {
      id: "redfield_umbrella_sword",
      name: "赤色伯爵的傘劍",
      summary: "暴擊傷害倍率 +0.1；每次直接攻擊整招結算後，回復實際傷害量的 20%，滿血時溢出回復轉為護盾，最多最大 HP 15%。",
      effect: { kind: "postgame_redfield_umbrella_sword", drainRatio: 0.2, maxOverflowShieldRatio: 0.15, criticalDamageBonus: 0.1, settlePerMove: true },
    },
    {
      id: "loki_ragnir",
      name: "鐵雷「Ragnir」",
      summary: "特攻 +20%；直接傷害產生冰雲，骰 5～6 時每朵增傷 15%。第三朵生成時立即凍結敵人一回合，並清空冰雲。",
      effect: { kind: "postgame_loki_ragnir", satkMultiplier: 1.2, highDiceMinimum: 5, damageBonusPerCloud: 0.15, freezeClouds: 3, freezeTurns: 1, freezeOnThirdCloud: true, clearCloudsAfterFreeze: true },
    },
    {
      id: "oars_giant_belt",
      name: "魔人歐斯的巨人腰帶",
      summary: "最大生命 +50%、直接攻擊傷害 +20%，但速度 -30%。",
      effect: { kind: "postgame_oars_giant_belt", maxHpMultiplier: 1.5, directDamageBonus: 0.2, speedMultiplier: 0.7 },
    },
    {
      id: "green_bull_life_seed",
      name: "森森生命種子",
      summary: "低於 70% HP 時每回合回復 3% 並累積種子；致命傷時每顆種子復活 12%，最多三顆，每場只能復活一次。",
      effect: { kind: "postgame_green_bull_life_seed", hpThreshold: 0.7, healPerTurn: 0.03, revivePerSeed: 0.12, maxSeeds: 3, oncePerBattle: true },
    },
    {
      id: "rocks_eclipse_sword",
      name: "名刀『日蝕』",
      summary: "攻擊與特攻 +20%；戰鬥型被動成功追加第二顆骰子後，依原門檻 6／5／4，使第二顆骰到 5／3／1 以上時再追加第三顆骰子。三骰總點數 12 為 ×2.05，之後每點 +×0.15，18 點為 ×2.95。",
      effect: { kind: "postgame_rocks_eclipse", atkMultiplier: 1.2, satkMultiplier: 1.2, enableThirdBattleDie: true, thirdDieThresholdByFirstThreshold: { 6: 5, 5: 3, 4: 1 } },
    },
  ].forEach((relic) => {
    held(
      relic.id,
      relic.name,
      "S",
      `held_postgame_boss_relic_${relic.id}`,
      relic.summary,
      relic.effect,
      {
        image: relic.image || `images/board/items/postgame_boss_relics/${relic.id}.webp`,
        important: true,
        tradable: false,
        obtain: obtain(false, false),
        balanceNote: relic.id === "rocks_eclipse_sword"
          ? "洛克斯勝利依每位實際參戰者自己的約克解碼器階級，以 10%／20%／30%／40% 最終機率獨立判定；可重複持有。"
          : relic.id === "enma"
            ? "擊敗 KING 時，每位實際參戰者各以固定 10% 機率額外獨立判定；不取代 KING 的佩刀，可重複持有。"
          : "擊敗對應 Boss 時，每位實際參戰者各以固定 10% 機率獨立判定；可重複持有。",
      }
    );
  });

  key("hp_drink", "生命藍波飲", "B", "key_train_uncommon_1", "生命修行材料。", { kind: "training_material", trainingType: "hp" }, { obtain: obtain(true, false, ["item_shop"], ["training_pool"]), price: 800 });
  key("atk_drink", "怪力藍波飲", "B", "key_train_uncommon_2", "力量修行材料。", { kind: "training_material", trainingType: "atk" }, { obtain: obtain(true, false, ["item_shop"], ["training_pool"]), price: 800 });
  key("def_drink", "鐵壁藍波飲", "B", "key_train_uncommon_3", "防禦修行材料。", { kind: "training_material", trainingType: "def" }, { obtain: obtain(false, false, ["item_shop"], ["training_pool"]), price: 800 });
  key("satk_drink", "戰術藍波飲", "B", "key_train_uncommon_4", "戰術修行材料。", { kind: "training_material", trainingType: "satk" }, { obtain: obtain(false, false, ["item_shop"], ["training_pool"]), price: 800 });
  key("sdef_drink", "霸氣意志飲", "B", "key_train_uncommon_5", "意志修行材料。", { kind: "training_material", trainingType: "sdef" }, { obtain: obtain(false, false, ["item_shop"], ["training_pool"]), price: 800 });
  key("spd_drink", "剃步強化飲", "B", "key_train_uncommon_6", "速度修行材料。", { kind: "training_material", trainingType: "spd" }, { obtain: obtain(false, false, ["item_shop"], ["training_pool"]), price: 800 });
  ["hp", "atk", "def", "satk", "sdef", "spd"].forEach((type, index) => {
    const names = ["生命鳥羽", "怪力鳥羽", "鐵壁鳥羽", "戰術鳥羽", "霸氣鳥羽", "疾風鳥羽"];
    key(`${type}_feather`, names[index], "C", `key_train_common_${index + 1}`, `${names[index]}：小型修行材料。`, { kind: "training_material_small", trainingType: type }, { obtain: obtain(true, false, ["item_shop"], ["training_pool"]), price: 240 });
  });
  key("skill_scroll", "招式修行卷", "B", "key_skill_uncommon_1", "技能修行材料。", { kind: "skill_training_material", level: "normal" }, { obtain: obtain(false, false, ["item_shop"], ["training_pool"]), price: 1200 });
  key("ultimate_scroll", "奧義修行卷", "A", "key_skill_rare_1", "奧義修行材料。", { kind: "skill_training_material", level: "ultimate" }, { obtain: obtain(false, true, [], ["rare_pool"]), price: 0 });
  key("passive_capsule", "戰鬥記憶貝", "A", "key_passive_rare_1", "強化角色戰鬥記憶。", { kind: "switch_unlocked_passive" }, { obtain: obtain(false, true, ["item_shop"], ["rare_pool"]), price: 5000 });
  key("reset_mochi", "重修糯米糰", "A", "key_reset_rare_1", "重置修行配置。", { kind: "reset_training_build", refundRate: 0.6 }, { obtain: obtain(false, false, ["item_shop"], ["training_pool"]), price: 2500 });
  key("training_dust", "修行細沙", "C", "key_train_common_7", "低階修行材料。", { kind: "training_tier_material", tier: "low" }, { obtain: obtain(true, false, ["item_shop"], ["training_pool"]), price: 200 });
  key("training_gravel", "修行砂礫", "B", "key_train_uncommon_7", "中階修行材料。", { kind: "training_tier_material", tier: "mid" }, { obtain: obtain(true, false, ["item_shop"], ["training_pool"]), price: 600 });
  key("training_pebble", "修行石塊", "A", "key_train_rare_1", "高階修行材料。", { kind: "training_tier_material", tier: "high" }, { obtain: obtain(false, false, ["item_shop"], ["elite_supply_pool"]), price: 2000 });
  key("training_rock", "修行巨岩", "S", "key_train_secret_1", "最高階修行材料。", { kind: "training_tier_material", tier: "secret" }, { obtain: obtain(false, true, [], ["rare_pool"]), price: 0 });
  key("road_poneglyph", "歷史本文拓本", "S", "key_story_1", "舊版最終之島線索，會依玩家紀錄顯示為東西南北拓本。", { kind: "story_unlock_material", target: "final_island" }, { consumeOnUse: false });
  key("dawn_paw_route_pass", "黎明航路生命卡", "S", "key_story_dawn_route", "完成最終結局的永久航海證明。持有後可從拉夫德魯的黎明紀錄殿反覆請大熊轉送至已記錄的 Boss 島，不會消耗。", { kind: "final_island_paw_route_pass", target: "postgame_boss_islands" }, { consumeOnUse: false, important: true, tradable: false, image: "images/board/items/road_poneglyph.webp" });
  key("road_poneglyph_east", "東之歷史本文拓本", "S", "key_story_east", "最終之島線索之一。", { kind: "story_unlock_material", target: "final_island", direction: "east" }, { consumeOnUse: false });
  key("road_poneglyph_west", "西之歷史本文拓本", "S", "key_story_west", "最終之島線索之一。", { kind: "story_unlock_material", target: "final_island", direction: "west" }, { consumeOnUse: false });
  key("road_poneglyph_south", "南之歷史本文拓本", "S", "key_story_south", "最終之島線索之一。", { kind: "story_unlock_material", target: "final_island", direction: "south" }, { consumeOnUse: false });
  key("road_poneglyph_north", "北之歷史本文拓本", "S", "key_story_north", "最終之島線索之一。", { kind: "story_unlock_material", target: "final_island", direction: "north" }, { consumeOnUse: false });
  [
    ["01", "金獅子史基", "postgame_shiki"],
    ["02", "吉爾德・泰佐洛", "postgame_gild_tesoro"],
    ["03", "澤法", "postgame_zephyr"],
    ["04", "Tot Musica", "postgame_tot_musica"],
    ["05", "道格拉斯・巴雷特", "postgame_douglas_bullet"],
    ["06", "薩卡／七星劍", "postgame_saga"],
    ["07", "文斯莫克・伽治", "postgame_vinsmoke_judge"],
    ["08", "覺醒羅布・路基", "postgame_rob_lucci_awakened"],
    ["09", "KING", "postgame_king"],
    ["10", "夏洛特・卡塔庫栗", "postgame_charlotte_katakuri"],
    ["11", "帕特里克・雷德菲爾德", "postgame_patrick_redfield"],
    ["12", "魔人歐斯", "postgame_oars"],
    ["13", "綠牛／荒牧", "postgame_aramaki"],
  ].forEach(([number, bossName, bossKey]) => {
    key(
      `york_clue_${number}_${bossKey.replace(/^postgame_/, "")}`,
      `約克的線索 ${Number(number)}`,
      "S",
      `key_postgame_york_clue_${number}`,
      `擊敗 ${bossName} 的實際參戰證明。十三種線索可由玩家交易；同一玩家集齊全部種類後才能追蹤約克。`,
      { kind: "postgame_york_clue", clueNumber: Number(number), bossKey },
      {
        consumeOnUse: false,
        image: "images/board/postgame_clue_ui/york_clue_playing_card_frame_v2.webp",
        important: true,
        tradable: true,
        tradeMinPrice: 1300,
        revealTitle: `約克的線索 ${Number(number)}`,
        revealLine: `${bossName} 的據點資料已封存；這張線索可以交易且能重複取得。`,
        balanceNote: "十三座無風帶孤島 Boss 每次勝利發給所有實際參戰者；不設持有上限。",
      }
    );
  });
  [
    ["york_coordinate_decoder_t1", "約克座標解碼器・一階", 1, 20],
    ["york_coordinate_decoder_t2", "約克座標解碼器・二階", 2, 30],
    ["york_coordinate_decoder_t3", "約克座標解碼器・三階", 3, 40],
  ].forEach(([id, name, tier, eclipseDropRate]) => {
    key(
      id,
      name,
      "S",
      `key_postgame_york_decoder_t${tier}`,
      `約克十三張線索的個人解碼成果；洛克斯專屬名刀『日蝕』最終掉落率 ${eclipseDropRate}%。`,
      { kind: "postgame_york_coordinate_decoder", tier, eclipseDropRate: eclipseDropRate / 100 },
      {
        consumeOnUse: false,
        image: `images/board/postgame_clue_puzzle_ui/${id}.webp`,
        important: true,
        tradable: false,
        maxStack: 1,
        revealTitle: "約克座標解碼完成",
        revealLine: `個人解碼器已升至${["一", "二", "三"][tier - 1]}階；十三張線索沒有消耗。`,
        balanceNote: "不可交易、出售或裝備；玩家只保留已完成的最高階。",
      }
    );
  });
  key("sea_train_golden_ticket", "海上列車黃金票", "S", "key_judicial_secret_1", "可固定前往水之七島，也能在島上標記終點；之後召喚海上列車移動到目的地並直接進入。", { kind: "sea_train_golden_ticket" }, { consumeOnUse: false });
  key("judicial_clear_chest", "司法島通關寶箱", "S", "key_judicial_clear_chest", "打開後從被打穿的旗幟、海上列車黃金票、海樓石手銬、梅利號的救援中選 1 個。", { kind: "judicial_clear_chest" }, { consumeOnUse: true });
  key("pierced_flag", "被打穿的旗幟", "A", "key_evolution_1", "草帽團進化用的重要物品，進化時會消耗。", { kind: "crew_evolution_material", crew: "straw_hat" }, {
    consumeOnUse: true,
    image: "images/board/items/pierced_flag.webp",
    important: true,
    revealTitle: "重要道具",
    revealLine: "世界政府的旗幟被打穿，宣戰的意志留下了力量。",
  });
  key("new_world_newspaper_3d2y", "3D2Y 的報紙", "S", "key_marineford_story_1", "新世界篇章進化用的重要報紙，進化時會消耗。", { kind: "new_world_evolution_material" }, {
    consumeOnUse: true,
    image: "images/board/items/new_world_newspaper_3d2y.webp",
    important: true,
    revealTitle: "重要道具",
    revealLine: "默哀的照片傳回大海，兩年後再會的暗號留了下來。",
  });
  key("prime_vivre_card", "舊時代的記憶", "S", "key_prime_era_evolution_1", "S級任務「舊時代殘響」獎勵。舊時代強者返老或全盛期進化用，進化時會消耗。", { kind: "prime_era_evolution_material" }, {
    consumeOnUse: true,
    image: "images/board/items/prime_vivre_card.webp",
    important: true,
    revealTitle: "重要道具",
    revealLine: "舊時代的記憶甦醒，巔峰時期的氣魄回到眼前。",
  });

  key(
    "lineage_extractor_standard",
    "標準血統因子抽取器",
    "B",
    "key_lineage_extractor_standard",
    "全破後血統研究使用的基礎採樣耗材；正式提取開始後會消耗 1 個。",
    { kind: "lineage_factor_extractor", extractorType: "standard", successRateBonus: 0 },
    {
      consumeOnUse: true,
      useTiming: ["after_enemy_defeat"],
      image: "images/board/lineage_extraction_ui/lineage_extractor_standard.webp",
      important: true,
      tradable: true,
      maxStack: 99,
      tradeMinPrice: 300,
      price: 600,
      balanceNote: "世界解鎖後由研究所永久販售；不加入一般商店與隨機掉落池。",
    }
  );

  key(
    "lineage_extractor_precision",
    "精密血統因子抽取器",
    "A",
    "key_lineage_extractor_precision",
    "精密校準採樣耗材，正式提取成功率 +12%；確認開始後消耗 1 個。",
    { kind: "lineage_factor_extractor", extractorType: "precision", successRateBonus: 12 },
    {
      consumeOnUse: true,
      useTiming: ["after_enemy_defeat"],
      image: "images/board/lineage_extraction_ui/lineage_extractor_precision.webp",
      important: true,
      tradable: true,
      maxStack: 99,
      tradeMinPrice: 750,
      price: 1500,
      balanceNote: "研究等級 2 後由研究所永久販售，也可從研究委託與高階寶箱取得。",
    }
  );

  [
    ["power", "力量共鳴血統因子抽取器", "力", "lineage_extractor_resonance_power.webp"],
    ["skill", "技巧共鳴血統因子抽取器", "技", "lineage_extractor_resonance_skill.webp"],
    ["speed", "速度共鳴血統因子抽取器", "速", "lineage_extractor_resonance_speed.webp"],
  ].forEach(([extractorType, name, attribute, file]) => {
    key(
      `lineage_extractor_resonance_${extractorType}`,
      name,
      "A",
      `key_lineage_extractor_resonance_${extractorType}`,
      `與「${attribute}」屬性目標共鳴時成功率 +18%，屬性不符時 +4%；確認開始後消耗 1 個。`,
      {
        kind: "lineage_factor_extractor",
        extractorType: `resonance_${extractorType}`,
        matchingAttribute: attribute,
        matchingSuccessRateBonus: 18,
        mismatchSuccessRateBonus: 4,
      },
      {
        consumeOnUse: true,
        useTiming: ["after_enemy_defeat"],
        image: `images/board/lineage_extraction_ui/${file}`,
        important: true,
        tradable: true,
        maxStack: 99,
        tradeMinPrice: 1200,
        price: 2400,
        balanceNote: "研究等級 3 後由研究所永久販售，也可從研究委託與高階寶箱取得。",
      }
    );
  });

  key(
    "lineage_extractor_ability",
    "能力者血統因子抽取器",
    "A",
    "key_lineage_extractor_ability",
    "對惡魔果實能力者成功率 +22%，非能力者 +5%；確認開始後消耗 1 個。",
    {
      kind: "lineage_factor_extractor",
      extractorType: "ability",
      devilFruitSuccessRateBonus: 22,
      nonDevilFruitSuccessRateBonus: 5,
    },
    {
      consumeOnUse: true,
      useTiming: ["after_enemy_defeat"],
      image: "images/board/lineage_extraction_ui/lineage_extractor_ability.webp",
      important: true,
      tradable: true,
      maxStack: 99,
      tradeMinPrice: 1600,
      price: 3200,
      balanceNote: "研究等級 3 後由研究所永久販售，也可從研究委託與寶石寶箱取得。",
    }
  );

  key(
    "lineage_extractor_emperor",
    "皇級血統因子抽取器",
    "S",
    "key_lineage_extractor_emperor",
    "最高階血統採樣耗材，正式提取成功率 +50%；確認開始後消耗 1 個。",
    { kind: "lineage_factor_extractor", extractorType: "emperor", successRateBonus: 50 },
    {
      consumeOnUse: true,
      useTiming: ["after_enemy_defeat"],
      image: "images/board/lineage_extraction_ui/lineage_extractor_emperor.webp",
      important: true,
      tradable: true,
      maxStack: 99,
      tradeMinPrice: 5000,
      price: 10000,
      balanceNote: "研究等級 4 後以 10,000 B 與 120 研究點數重複製作；不直接販售。",
    }
  );

  key(
    "perfect_lineage_core",
    "完美血統核心",
    "SSS",
    "key_perfect_lineage_core",
    "角色由 SS 突破至 SSS 的最終培育素材；研究所確認突破時消耗 1 個。",
    { kind: "lineage_breakthrough_core" },
    {
      consumeOnUse: true,
      useTiming: ["research_breakthrough"],
      image: "images/board/research_lab_ui/breakthrough/perfect_lineage_core.webp",
      important: true,
      tradable: false,
      maxStack: 99,
      balanceNote: "第 10 階段洛克斯戰正式獎勵；不加入一般商店、交易與隨機掉落池。",
      revealTitle: "完美血統核心",
      revealLine: "結晶內的雙螺旋能量穩定共鳴，足以完成最後一次血統突破。",
    }
  );

  const ITEM_SHOP_POOL = Array.from(new Set([
    "heal_2", "smoke_repel", "sea_beast_lure", "sound_shell", "honey_lure", "meat_lure", "seafood_lure", "smoke_shell", "sticky_bomb", "mud_bomb", "antidote_herb", "burn_ointment", "paralyze_oil", "small_meat", "smoke_ball", "light_shell", "hp_feather", "atk_feather", "def_feather", "satk_feather", "sdef_feather", "spd_feather", "training_dust", "fixed_step", "pointer", "battle_food", "guard_charm",
    "smoke_repel_plus", "rare_beast_lure", "stealth_cloak", "mineral_lure", "ice_bomb", "all_cure_medicine", "large_meat", "emergency_med_kit", "rum_secret", "odd_dice", "even_dice", "bright_powder", "treasure_coin", "cleanse_tag", "scope_lens", "white_herb", "mental_herb", "metronome", "iron_ball", "lagging_tail", "air_balloon_shell", "eject_button", "escape_pack", "heavy_duty_boots", "utility_umbrella", "hp_drink", "atk_drink", "def_drink", "satk_drink", "sdef_drink", "spd_drink", "skill_scroll", "training_gravel",
    "seastone_repel", "pirate_bento", "super_meat", "party_meat_platter", "navigator_supply", "quick_claw", "king_badge", "focus_band", "lucky_egg", "leftovers_meat", "shell_bell", "power_herb", "choice_band", "choice_glasses", "choice_scarf", "toxic_orb", "flame_orb", "black_sludge", "rocky_helmet", "red_card", "relay_pirate_flag", "blunder_policy", "assault_vest", "passive_capsule", "reset_mochi", "training_pebble",
    "ship_patch_canvas", "ship_ration_barrel", "ship_escape_ladder", "ship_tailwind_sail", "ship_observer_spyglass", "ship_reinforced_bottom_plate", "ship_stove_upgrade", "ship_cola_aux_engine", "ship_coup_de_burst_port", "ship_bird_nest_tower", "ship_adam_sub_keel", "ship_dream_medical_galley", "ship_plank", "ship_toolbox", "ship_coating_resin", "ship_adam_wood",
    "blue_heal_flute", "yellow_clear_flute", "red_morale_flute", "thaw_drink", "medical_ship_ticket",
    "wind_shell", "cloud_shell", "tone_shell", "impact_shell", "flame_shell", "thunder_shell", "vision_shell", "heal_shell",
  ]));

  const ITEM_SHOPS = {
    item_shop: ITEM_SHOP_POOL,
  };

  Object.values(GAME_ITEMS).forEach((item) => {
    if (Array.isArray(item.obtain?.shops) && item.obtain.shops.length > 0) {
      item.obtain.shops = ["item_shop"];
    }
  });

  const BASIC_SUPPLY_POOL = ["smoke_repel", "sea_beast_lure", "small_meat", "battle_food", "training_dust", "hp_feather", "atk_feather", "def_feather", "ship_patch_canvas", "ship_ration_barrel", "ship_escape_ladder", "ship_plank"];
  const ADVANCED_SUPPLY_POOL = ["smoke_repel_plus", "rare_beast_lure", "large_meat", "emergency_med_kit", "rum_secret", "odd_dice", "even_dice", "training_gravel", "treasure_coin", "scope_lens", "ship_tailwind_sail", "ship_observer_spyglass", "ship_reinforced_bottom_plate", "ship_stove_upgrade", "ship_toolbox"];
  const ELITE_SUPPLY_POOL = ["seastone_repel", "yonko_lure", "pirate_bento", "super_meat", "party_meat_platter", "focus_band", "life_orb", "weakness_policy", "training_pebble", "ship_cola_aux_engine", "ship_coup_de_burst_port", "ship_bird_nest_tower", "ship_adam_sub_keel", "ship_coating_resin"];
  const ITEM_EVENT_POOLS = {
    basic_supply_pool: BASIC_SUPPLY_POOL,
    advanced_supply_pool: ADVANCED_SUPPLY_POOL,
    elite_supply_pool: ELITE_SUPPLY_POOL,
    safe_sea_pool: BASIC_SUPPLY_POOL,
    mid_sea_pool: ADVANCED_SUPPLY_POOL,
    danger_sea_pool: ELITE_SUPPLY_POOL,
    weather_pool: ["smoke_shell", "sticky_bomb", "mud_bomb", "ice_bomb", "utility_umbrella", "bright_powder"],
    treasure_pool: ["treasure_coin", "scope_lens", "rare_beast_lure", "training_gravel", "quick_claw", "king_badge", "relay_pirate_flag", "ship_escape_ladder", "ship_observer_spyglass", "ship_bird_nest_tower", "ship_plank", "ship_toolbox", "ship_coating_resin"],
    heal_pool: ["small_meat", "large_meat", "battle_food", "emergency_med_kit", "pirate_bento", "super_meat", "party_meat_platter", "antidote_herb", "burn_ointment", "paralyze_oil", "all_cure_medicine", "navigator_supply", "medical_ship_ticket", "leftovers_meat", "heal_shell", "ship_ration_barrel", "ship_stove_upgrade"],
    training_pool: ["hp_feather", "atk_feather", "def_feather", "satk_feather", "sdef_feather", "spd_feather", "hp_drink", "atk_drink", "def_drink", "satk_drink", "sdef_drink", "spd_drink", "skill_scroll", "training_dust", "training_gravel", "training_pebble"],
    sky_pool: ["smoke_shell", "sound_shell", "wind_shell", "cloud_shell", "tone_shell", "vision_shell", "impact_shell", "reject_shell"],
    ship_material_pool: ["ship_plank", "ship_toolbox", "ship_coating_resin", "ship_adam_wood"],
    rare_pool: ["miracle_bone", "full_party_feast", "focus_sash", "life_orb", "weakness_policy", "reject_shell", "passive_capsule", "ultimate_scroll", "training_rock", "ship_dream_medical_galley", "ship_adam_wood"],
  };

  const ITEM_DROP_POOLS = {
    common_enemy_drop_pool: ["small_meat", "large_meat", "emergency_med_kit", "antidote_herb", "burn_ointment", "paralyze_oil", "smoke_repel", "sea_beast_lure", "hp_feather", "atk_feather", "def_feather", "satk_feather", "sdef_feather", "spd_feather", "training_dust", "smoke_shell", "sticky_bomb", "mud_bomb", "ship_patch_canvas", "ship_ration_barrel", "ship_escape_ladder", "ship_plank", "ship_toolbox"],
    devil_fruit_user_extra_drop_pool: ["seastone_repel", "rare_beast_lure", "yonko_lure", "ice_bomb", "all_cure_medicine", "pirate_bento", "super_meat", "party_meat_platter", "full_party_feast", "life_orb", "weakness_policy", "reject_shell", "passive_capsule", "ultimate_scroll", "training_rock", "impact_shell", "flame_shell", "thunder_shell", "ship_reinforced_bottom_plate", "ship_cola_aux_engine", "ship_coup_de_burst_port", "ship_adam_sub_keel", "ship_dream_medical_galley", "ship_coating_resin", "ship_adam_wood"],
  };

  const ITEM_DROP_RATES = {
    common_enemy_drop_pool: {
      C: { T5: 0.16, T4: 0.18, T3: 0.20, T2: 0.22, T1: 0.24 },
      B: { T5: 0.06, T4: 0.075, T3: 0.09, T2: 0.105, T1: 0.12 },
      A: { T5: 0.018, T4: 0.023, T3: 0.028, T2: 0.034, T1: 0.04 },
      S: { T5: 0, T4: 0, T3: 0, T2: 0, T1: 0 },
    },
    devil_fruit_user_extra_drop_pool: {
      B: { T5: 0.10, T4: 0.12, T3: 0.14, T2: 0.16, T1: 0.18 },
      A: { T5: 0.04, T4: 0.052, T3: 0.064, T2: 0.078, T1: 0.09 },
      S: { T5: 0.01, T4: 0.013, T3: 0.016, T2: 0.02, T1: 0.025 },
    },
  };

  window.ITEM_CATEGORY_LABELS = ITEM_CATEGORY_LABELS;
  window.LEGACY_ITEM_CATEGORY_MAP = LEGACY_ITEM_CATEGORY_MAP;
  window.normalizeGameItemCategory = normalizeGameItemCategory;
  window.GAME_ITEMS = GAME_ITEMS;
  window.ITEM_SHOPS = ITEM_SHOPS;
  window.ITEM_EVENT_POOLS = ITEM_EVENT_POOLS;
  window.ITEM_DROP_POOLS = ITEM_DROP_POOLS;
  window.ITEM_DROP_RATES = ITEM_DROP_RATES;
})();
