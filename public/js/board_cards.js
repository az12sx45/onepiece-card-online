(function () {
  // Damage class is intentionally independent from the legacy move category.
  // Existing saves keep their original ids/categories; the shared resolver below
  // classifies them by stable id/name so physical and special stats stay compatible.
  const SPECIAL_DAMAGE_MOVE_NAMES = new Set([
    // Base crew.
    "龍捲風", "小雷雲", "ROOM斬擊", "心脈切割", "俘虜之箭", "虜之矢",
    "電擊爪", "電氣衝刺", "Electro", "火拳", "炎戒", "神火不知火", "火柱", "大炎戒炎帝", "火槍",
    "火拳繼承", "火焰龍王", "革命龍炎", "冰爪", "無侍冰牙", "白蛇駆", "建御雷", "冰諸斬",
    "火藥星", "擊水", "唐草瓦正拳", "奧義武賴貫", "槍波", "寒氣斬", "風來砲", "佛朗基火箭砲",
    "桃源白瀧", "桃源十拳", "傳說武士斬", "桃源斬", "覆霸斬", "冥王一閃", "銀河衝擊",
    "白拳", "白蛇", "冰塊拳", "冰矛", "冰刀", "冰河時代", "冰封世界",
    "重力刀", "隕石牽引", "地裂重壓", "天墜隕星", "重力刀・猛虎", "隕石",
    "屏障撞擊", "屏障封鎖", "白馬斷空", "火柳一閃", "火焰切裂", "焰裂斬", "狐火流奧義", "狐火流", "赤鞘炎斬",
    "死亡媚眼", "緊張荷爾蒙", "熊掌衝擊", "壓力砲", "熊之衝擊", "陰愈傷彈", "壓力炮連射",
    "風刃", "暴風", "天候支配", "革命風暴", "音速斬", "鎌斬", "旋風斬", "幽靈撞擊", "迷你幽靈炸彈",
    "震動拳", "海震", "空震", "島割", "世界最強一擊", "花劍圓舞", "赤鞘槍陣", "青炎踢", "鳳凰印",
    "巴其小炸彈", "特製馬奇彈", "滅裂斬", "沙漠寶刀", "侵蝕輪迴", "沙漠向日葵", "沙漠金剛寶刀",
    "我是最強", "Tot Musica", "神避", "王者交鋒", "霸纏",

    // Evolution forms.
    "阿修羅 壹霧銀", "飛龍火焰", "雷光槍天候", "雷電天候・強化", "雷雨天候",
    "惡魔風腳・羊肉SHOT", "惡魔風腳・串燒踢", "畫龍點睛SHOT",
    "火鳥星", "必殺・阿特拉斯彗星", "火藥星連彈", "風來砲・強化", "清新火焰", "風來噴射",
    "波蘭舞曲・冰斬", "月電亂爪", "彗星兔", "Sulong", "猿神槍",
    "黑繩大龍卷", "一大三千大千世界", "阿修羅拔劍・亡者戲",
    "突風劍", "雷雲棒", "雷霆天候", "宙斯雷雲",
    "熟燒・燒烤SHOT", "燒鐵鍋光譜", "地獄回憶", "魔神風腳",
    "綠星・竹林槍", "綠星・狼草", "必殺・蓑蟲星", "綠星・衝擊狼",
    "ROOM", "Counter Shock", "Gamma Knife", "Puncture Wille", "White Launcher", "White Snake", "Damned Punk",
    "Mini Hollow", "Toku Hollow", "誠實衝擊", "震震果實", "大海震", "空震破碎",
    "冰軍刀", "冰時刻膠囊", "冰塊兩棘矛", "十號船長冰封", "世界第一斬擊", "斬艦一閃",
    "神避・霸纏", "最後神避", "特製巴其玉", "華麗大砲", "鑽石邊刃", "滅裂雛菊斬", "白鳥阿拉貝斯克",
    "Desert Spada", "地乾", "新月形沙丘",

    // Enemy and lineage moves.
    "冥狗", "大噴火", "流星火山", "火焰雜耍", "瓦斯噴射", "瓦斯爆破", "五色線", "神誅殺",
    "雷擊", "雷迎", "霸王色・空白王座", "黑炎", "影子爪擊", "巨影集合地",
    "黑夢霧刃", "夢魘墜落", "荊棘處刑", "港口封鎖", "水流拳", "鐵塊狼彈", "嵐腳周斷", "黃金泡沫",
    "光速踢", "天叢雲劍", "八尺瓊勾玉", "MH5毒彈", "海流正拳", "嵐腳", "六王槍",
    "毒龍", "毒之巨兵", "鼻屎炸彈", "爆炸拳", "全身爆破", "岩石拳", "地裂衝擊", "巨石壓殺",
    "禁憎森森", "養分吸收", "鳴鏑", "黃金神火", "火龍皇", "御守火龍皇", "鐵雷「Ragnir」",
    "蝙蝠果實・吸血鬼", "霸王色纏繞", "神之谷崩裂", "妖氣侵蝕", "七星劍・滿月",
    "斬波", "獅子・千切谷", "Tot Musica・咆哮", "樂譜衝擊", "魔王之翼",
    "電磁裂踢", "Blaster", "電磁軸擊", "Smash Buster", "大佛衝擊", "佛之衝擊波", "霸氣掌擊",
    "普羅米修斯", "宙斯雷擊", "靈魂咆哮", "暗水", "黑暗解放", "震裂海嘯", "熱息", "霸王色震懾",
  ]);

  const SPECIAL_DAMAGE_MOVE_IDS = new Set([
    // Only Mihawk's generic renamed slash is special; other moves named 斬擊 stay physical.
    "custom_mp3l85c1_world_slash",
  ]);

  function moveDamageClassFor(input = {}) {
    const category = String(input.category || input.type || "").toLowerCase();
    const power = Number(input.power || 0);
    if (!["attack", "special"].includes(category) || power <= 0) return "status";
    const explicit = String(input.damageClass || input.damageKind || "").toLowerCase();
    if (explicit === "physical" || explicit === "special") return explicit;
    if (SPECIAL_DAMAGE_MOVE_IDS.has(String(input.id || ""))) return "special";
    if (SPECIAL_DAMAGE_MOVE_NAMES.has(String(input.name || "").trim())) return "special";
    return "physical";
  }

  function isSpecialDamageMove(input = {}) {
    return moveDamageClassFor(input) === "special";
  }

  function moveDisplayName(input = {}) {
    const name = String(input.name || "未知招式");
    if (!isSpecialDamageMove(input) || /^\(特\)\s*/.test(name)) return name;
    return `(特) ${name}`;
  }

  window.BoardMoveDamageClass = {
    moveDamageClassFor,
    isSpecialDamageMove,
    moveDisplayName,
  };

  const ROLE_MOVE_MOD = {
    "戰鬥型": 0,
    "偵查型": 1,
    "移動型": 2,
    "輔助型": 1,
  };

  const ROLE_PASSIVE = {
    "戰鬥型": "戰鬥型被動",
    "偵查型": "偵查型被動",
    "移動型": "移動型被動",
    "輔助型": "輔助型被動",
  };
  const PLACEHOLDER_BATTLE_PORTRAIT = "images/board/battle/portraits/placeholder/normal.webp";

  const TIER_STATS = {
    T6: { hp: 62, atk: 44, def: 42, satk: 42, sdef: 42, spd: 44 },
    T5: { hp: 70, atk: 52, def: 50, satk: 50, sdef: 50, spd: 52 },
    T4: { hp: 78, atk: 60, def: 58, satk: 58, sdef: 58, spd: 60 },
    T3: { hp: 88, atk: 68, def: 64, satk: 64, sdef: 64, spd: 66 },
    T2: { hp: 98, atk: 76, def: 72, satk: 72, sdef: 72, spd: 74 },
    T1: { hp: 110, atk: 86, def: 80, satk: 80, sdef: 80, spd: 82 },
  };

  const ROLE_STAT_MOD = {
    "戰鬥型": { hp: 8, atk: 10, def: 6, satk: -4, sdef: 2, spd: 2 },
    "偵查型": { hp: -4, atk: -2, def: -2, satk: 8, sdef: 4, spd: 8 },
    "移動型": { hp: -2, atk: 4, def: -2, satk: 0, sdef: 0, spd: 12 },
    "輔助型": { hp: 2, atk: -4, def: 4, satk: 4, sdef: 8, spd: 2 },
  };

  function growthForTier(tier) {
    const table = {
      T6: { hp: 6, atk: 4, def: 4, satk: 4, sdef: 4, spd: 5 },
      T5: { hp: 7, atk: 5, def: 4, satk: 5, sdef: 4, spd: 5 },
      T4: { hp: 8, atk: 6, def: 5, satk: 6, sdef: 5, spd: 5 },
      T3: { hp: 10, atk: 7, def: 6, satk: 7, sdef: 6, spd: 6 },
      T2: { hp: 11, atk: 8, def: 7, satk: 8, sdef: 7, spd: 6 },
      T1: { hp: 12, atk: 9, def: 8, satk: 9, sdef: 8, spd: 7 },
    };
    return table[tier] || table.T4;
  }

  function makeStats(tier, roleType) {
    const base = TIER_STATS[tier] || TIER_STATS.T4;
    const mod = ROLE_STAT_MOD[roleType] || ROLE_STAT_MOD["戰鬥型"];
    return {
      hp: base.hp + mod.hp,
      atk: base.atk + mod.atk,
      def: base.def + mod.def,
      satk: base.satk + mod.satk,
      sdef: base.sdef + mod.sdef,
      spd: base.spd + mod.spd,
    };
  }

  function normalizeUnlockLevel(level) {
    const value = Number(level || 1);
    if (!Number.isFinite(value)) return 1;
    return Math.max(1, Math.min(99, Math.floor(value)));
  }

  function move(input) {
    const category = input.type || input.category || "attack";
    const defaults = {
      unlockLevel: 1,
      type: category,
      category,
      pp: 10,
      power: 0,
      accuracy: category === "attack" ? 100 : null,
      target: category === "heal" || category === "buff" || category === "shield" ? "self" : "enemy",
      attribute: input.attribute || "無",
      kind: category === "attack" ? "physical" : "status",
      priority: 0,
      effectText: "",
      effects: {},
    };
    const merged = { ...defaults, ...input, type: category, category };
    return { ...merged, unlockLevel: normalizeUnlockLevel(merged.unlockLevel) };
  }

  function battlePortraitsFor(characterId) {
    return {
      normal: `images/board/battle/portraits/${characterId}/normal.webp`,
      angry: `images/board/battle/portraits/${characterId}/angry.webp`,
      hit: `images/board/battle/portraits/${characterId}/hit.webp`,
      hitPlayerSide: `images/board/battle/portraits/${characterId}/hit.webp`,
      hitEnemySide: `images/board/battle/portraits/${characterId}/hit_enemy.webp`,
      morale: `images/board/battle/portraits/${characterId}/morale.webp`,
      weak: `images/board/battle/portraits/${characterId}/weak.webp`,
      dizzy: `images/board/battle/portraits/${characterId}/dizzy.webp`,
      idle: PLACEHOLDER_BATTLE_PORTRAIT,
      fallback: PLACEHOLDER_BATTLE_PORTRAIT,
      placeholder: PLACEHOLDER_BATTLE_PORTRAIT,
      attack: `images/board/battle/portraits/${characterId}/angry.webp`,
    };
  }

  function evolutionBattlePortraitsFor(formId) {
    return {
      normal: `images/board/battle/portraits/evolutions/${formId}/normal.webp`,
      angry: `images/board/battle/portraits/evolutions/${formId}/angry.webp`,
      hit: `images/board/battle/portraits/evolutions/${formId}/hit.webp`,
      hitPlayerSide: `images/board/battle/portraits/evolutions/${formId}/hit.webp`,
      hitEnemySide: `images/board/battle/portraits/evolutions/${formId}/hit_enemy.webp`,
      morale: `images/board/battle/portraits/evolutions/${formId}/morale.webp`,
      weak: `images/board/battle/portraits/evolutions/${formId}/weak.webp`,
      dizzy: `images/board/battle/portraits/evolutions/${formId}/dizzy.webp`,
      idle: PLACEHOLDER_BATTLE_PORTRAIT,
      fallback: PLACEHOLDER_BATTLE_PORTRAIT,
      placeholder: PLACEHOLDER_BATTLE_PORTRAIT,
      attack: `images/board/battle/portraits/evolutions/${formId}/angry.webp`,
    };
  }

  const PORTRAIT_FOLDER_PATH_RENAMES = [
    ["images/board/battle/portraits/evolutions/custom_mp3l6s8w_evolution_1/", "images/board/battle/portraits/evolutions/uta_evolution_1/"],
    ["images/board/battle/portraits/evolutions/custom_mp3l85c1_evolution_1/", "images/board/battle/portraits/evolutions/mihawk_evolution_1/"],
    ["images/board/battle/portraits/evolutions/custom_mp3la6fr_evolution_1/", "images/board/battle/portraits/evolutions/roger_evolution_1/"],
    ["images/board/battle/portraits/custom_mp3l6s8w/", "images/board/battle/portraits/uta/"],
    ["images/board/battle/portraits/custom_mp3l85c1/", "images/board/battle/portraits/mihawk/"],
    ["images/board/battle/portraits/custom_mp3la6fr/", "images/board/battle/portraits/roger/"],
  ];

  function normalizePortraitFolderPaths(portraits) {
    if (!portraits || typeof portraits !== "object" || Array.isArray(portraits)) return portraits;
    const normalized = { ...portraits };
    Object.keys(normalized).forEach((key) => {
      if (typeof normalized[key] !== "string") return;
      normalized[key] = PORTRAIT_FOLDER_PATH_RENAMES.reduce(
        (path, [from, to]) => path.split(from).join(to),
        normalized[key],
      );
    });
    return normalized;
  }

  function card(def) {
    const baseStats = def.baseStats || makeStats(def.tier, def.roleType);
    const moveSet = (def.moveSet || []).map((entry) => entry?.category && entry?.id ? entry : move(entry));
    return {
      id: def.id,
      name: def.name,
      tier: def.tier,
      roleType: def.roleType,
      attribute: def.attribute,
      move: Number.isFinite(def.move) ? def.move : (ROLE_MOVE_MOD[def.roleType] || 0),
      passive: def.passive || ROLE_PASSIVE[def.roleType] || "",
      statProfile: def.statProfile || "standard",
      criticalRateBase: Number.isFinite(Number(def.criticalRateBase)) ? Math.max(0, Number(def.criticalRateBase)) : null,
      criticalStyle: String(def.criticalStyle || "").trim(),
      battlePortraits: normalizePortraitFolderPaths(def.battlePortraits || battlePortraitsFor(def.id)),
      baseStats,
      growthRate: def.growthRate || growthForTier(def.tier),
      moveSet,
      learnset: def.learnset || moveSet.map((entry) => entry.id),
      hp: baseStats.hp,
      atk: baseStats.atk,
      def: baseStats.def,
      satk: baseStats.satk,
      sdef: baseStats.sdef,
      spd: baseStats.spd,
    };
  }

  function moves(characterId, attribute, list) {
    return list.map(([id, name, unlockLevel, type, pp, power, effectText, effects = {}, extra = {}]) =>
      move({ id: `${characterId}_${id}`, name, unlockLevel, type, pp, power, effectText, effects, attribute, ...extra })
    );
  }

  function formMoves(attribute, list) {
    return list.map(([id, name, unlockLevel, type, pp, power, effectText, effects = {}, extra = {}]) =>
      move({ id, name, unlockLevel, type, pp, power, effectText, effects, attribute, ...extra })
    );
  }

  const cards = [
    card({ id: "luffy", name: "蒙其·D·魯夫", tier: "T1", roleType: "戰鬥型", attribute: "力", passive: "橡膠戰魂", battlePortraits: battlePortraitsFor("luffy"), moveSet: moves("luffy", "力", [
      ["pistol", "橡膠手槍", 1, "attack", 25, 45, "基礎攻擊"],
      ["gatling", "橡膠機關槍", 1, "attack", 20, 42, "骰子點數決定連擊段數", { multiHit: 1, comboAtkRatio: 0.06 }],
      ["bazooka", "橡膠火箭砲", 1, "attack", 20, 60, "骰到5以上追加10傷害", { bonusOnHighDice: 10 }],
      ["balloon", "橡膠氣球", 1, "shield", 10, 0, "本回合受到傷害-35%", { shieldRatio: 0.35 }],
      ["whip", "橡膠鞭", 15, "attack", 15, 68, "命中後敵方速度-1", { enemyStagesOnHit: { spd: -1 } }],
      ["stamp", "橡膠戰斧", 25, "attack", 10, 82, "骰到5以上敵方防禦-1", { enemyStagesOnHighDice: { def: -1 } }],
      ["storm", "橡膠暴風雨", 35, "special", 7, 90, "骰子點數決定連擊段數，使用後自身速度-1", { multiHit: 1, comboAtkRatio: 0.08, selfStagesAfterUse: { spd: -1 } }],
      ["spear", "橡膠長矛", 45, "attack", 5, 105, "骰到5以上傷害+25%", { amplifyOnHighDice: 0.25 } ],
    ]) }),
    card({ id: "zoro", name: "索隆", tier: "T1", roleType: "戰鬥型", attribute: "力", passive: "三刀流猛攻", battlePortraits: battlePortraitsFor("zoro"), moveSet: moves("zoro", "力", [
      ["onigiri", "鬼斬", 1, "attack", 25, 50, "基礎攻擊"],
      ["tora", "虎狩", 1, "attack", 20, 60, "無視10%防禦", { antiShieldBonus: 0.1 }],
      ["stance", "三刀流架勢", 1, "buff", 10, 0, "自身攻擊+1", { selfStages: { atk: 1 } }],
      ["guard", "鐵壁格擋", 1, "shield", 10, 0, "本回合減傷30%", { shieldRatio: 0.3 }],
      ["twister", "龍捲風", 15, "attack", 15, 70, "命中後敵方速度-1", { enemyStagesOnHit: { spd: -1 } }],
      ["shishi", "獅子歌歌", 25, "attack", 10, 85, "無視10%防禦", { antiShieldBonus: 0.1 }],
      ["pound36", "三十六煩惱鳳", 35, "attack", 8, 92, "骰到5以上追加20傷害", { bonusOnHighDice: 20 }],
      ["pound108", "百八煩惱鳳", 45, "special", 5, 108, "骰到5以上敵方防禦-1", { enemyStagesOnHighDice: { def: -1 } }],
    ]) }),
    card({ id: "nami", name: "娜美", tier: "T6", roleType: "偵查型", attribute: "技", passive: "天候直覺", moveSet: moves("nami", "技", [
      ["staff", "天候棒打擊", 1, "attack", 25, 35, "基礎攻擊"],
      ["mist", "迷霧天候", 1, "debuff", 15, 0, "敵方命中-1", { enemyStages: { accuracy: -1 } }],
      ["illusion", "幻象天候", 1, "debuff", 15, 0, "敵方閃避-1、命中-1", { enemyStages: { evasion: -1, accuracy: -1 } }],
      ["cloud", "小雷雲", 1, "attack", 20, 50, "骰到6麻痺1回合", { statusOnSix: { paralyze: 1 } }],
      ["current", "海流預測", 15, "buff", 10, 0, "自身速度+1、閃避+1", { selfStages: { spd: 1, evasion: 1 } }],
      ["cyclone", "龍捲風天候", 25, "control", 8, 0, "敵方速度-2", { enemyStages: { spd: -2 } }],
      ["thunderbolt", "雷電天候", 35, "attack", 8, 78, "骰到5以上追加20傷害", { bonusOnHighDice: 20 }],
      ["tempo", "天候棒連攜", 45, "special", 5, 92, "命中後敵方命中-1、速度-1", { enemyStagesOnHit: { accuracy: -1, spd: -1 } }],
    ]) }),
    card({ id: "sanji", name: "香吉士", tier: "T2", roleType: "移動型", attribute: "速", passive: "黑足疾行", moveSet: moves("sanji", "速", [
      ["kick", "首肉踢擊", 1, "attack", 25, 50, "基礎攻擊"],
      ["mutton", "粗碎踢", 1, "attack", 20, 60, "骰到5以上敵方防禦-1", { enemyStagesOnHighDice: { def: -1 } }],
      ["party", "宴會桌旋風踢", 1, "buff", 10, 0, "自身速度+1、閃避+1", { selfStages: { spd: 1, evasion: 1 } }],
      ["guard", "騎士道守護", 1, "shield", 10, 0, "本回合減傷25%", { shieldRatio: 0.25 }],
      ["concasse", "串燒踢", 15, "attack", 15, 75, "骰到5以上敵方速度-1", { enemyStagesOnHighDice: { spd: -1 } }],
      ["combo", "連續踢擊", 25, "attack", 10, 35, "骰子點數決定連擊段數", { multiHit: 1, comboAtkRatio: 0.065 }],
      ["shot", "羊肉SHOT", 35, "attack", 8, 92, "骰到5以上先制+1", { priorityOnHighDice: 1 }],
      ["anti", "反禮儀踢擊套餐", 45, "special", 5, 108, "命中後敵方防禦-1", { enemyStagesOnHit: { def: -1 } }],
    ]) }),
    card({ id: "law", name: "托拉法爾加·羅", tier: "T2", roleType: "輔助型", attribute: "技", passive: "手術果實", moveSet: moves("law", "技", [
      ["room", "ROOM斬擊", 1, "attack", 25, 45, "基礎攻擊"],
      ["shambles", "屠宰場", 1, "control", 15, 0, "敵方速度-1", { enemyStages: { spd: -1 } }],
      ["anesthesia", "麻醉切割", 1, "debuff", 15, 0, "敵方防禦-1", { enemyStages: { def: -1 } }],
      ["surgery", "緊急手術", 1, "heal", 10, 0, "回復自身30%HP", { healRatio: 0.3 }],
      ["shot", "注射SHOT", 15, "attack", 15, 70, "無視10%防禦", { antiShieldBonus: 0.1 }],
      ["heart", "心臟奪取", 25, "control", 8, 0, "敵方下回合攻擊-2", { enemyStages: { atk: -2 } }],
      ["gamma", "心脈切割", 35, "attack", 6, 95, "對高血量敵人傷害+20%", { highHpDamageBonus: 0.2 }],
      ["awake", "ROOM斬斷", 45, "special", 4, 110, "無視護盾與20%防禦", { antiShieldBonus: 0.2, pierceShield: true }],
    ]) }),
    card({ id: "robin", name: "妮可·羅賓", tier: "T5", roleType: "偵查型", attribute: "技", passive: "花花洞察", moveSet: moves("robin", "技", [
      ["palm", "花花掌擊", 1, "attack", 25, 40, "基礎攻擊"],
      ["lock", "關節封鎖", 1, "debuff", 15, 0, "敵方攻擊-1", { enemyStages: { atk: -1 } }],
      ["bind", "弱點束縛", 1, "debuff", 15, 0, "敵方防禦-1", { enemyStages: { def: -1 } }],
      ["bloom", "百花繚亂", 1, "attack", 20, 55, "命中後敵方速度-1", { enemyStagesOnHit: { spd: -1 } }],
      ["clutch", "三十輪花鉤爪", 15, "attack", 15, 68, "骰到5以上敵方防禦-1", { enemyStagesOnHighDice: { def: -1 } }],
      ["umbrella", "花傘防禦", 25, "shield", 10, 0, "本回合減傷35%", { shieldRatio: 0.35 }],
      ["delphinium", "金盞花滑行", 35, "control", 8, 0, "敵方無法強化1回合", { blockEnemyBuff: 1 }],
      ["seis", "六輪花摔擊", 45, "special", 5, 92, "敵方攻擊、防禦、速度各-1", { enemyStagesOnHit: { atk: -1, def: -1, spd: -1 } }],
    ]) }),
    card({ id: "hancock", name: "波雅·漢考克", tier: "T2", roleType: "戰鬥型", attribute: "速", passive: "女帝威壓", moveSet: moves("hancock", "速", [
      ["kick", "芳香腳", 1, "attack", 25, 50, "基礎攻擊"],
      ["mero", "甜甜甘風", 1, "control", 15, 0, "敵方命中-1", { enemyStages: { accuracy: -1 } }],
      ["queen", "女帝威壓", 1, "debuff", 10, 0, "敵方攻擊-1", { enemyStages: { atk: -1 } }],
      ["stone", "石化閃避", 1, "shield", 10, 0, "本回合減傷30%", { shieldRatio: 0.3 }],
      ["arrow", "俘虜之箭", 15, "attack", 15, 70, "骰到6石化1回合", { statusOnSix: { petrify: 1 } }],
      ["snake", "蛇姬踢擊", 25, "attack", 10, 85, "對男性敵人傷害+10%", { conditionalDamageBonus: 0.1 }],
      ["warlord", "王下七武海壓制", 35, "debuff", 8, 0, "敵方防禦-2", { enemyStages: { def: -2 } }],
      ["perfume", "芳香極踢", 45, "attack", 5, 110, "骰到5以上無視護盾", { pierceShieldOnHighDice: true }],
    ]) }),
    card({ id: "carrot", name: "凱洛特", tier: "T3", roleType: "移動型", attribute: "速", passive: "月兔疾馳", moveSet: moves("carrot", "速", [
      ["claw", "爪擊", 1, "attack", 25, 45, "基礎攻擊"],
      ["electro", "電擊爪", 1, "attack", 20, 55, "骰到6麻痺", { statusOnSix: { paralyze: 1 } }],
      ["jump", "兔躍", 1, "buff", 15, 0, "自身速度+1、閃避+1", { selfStages: { spd: 1, evasion: 1 } }],
      ["moonwalk", "月步閃避", 1, "shield", 10, 0, "本回合減傷25%", { shieldRatio: 0.25 }],
      ["dash", "電氣衝刺", 15, "attack", 15, 70, "先制+1", {}, { priority: 1 }],
      ["assault", "瞬間突襲", 25, "attack", 10, 80, "若速度高於敵方，傷害+15%", { strongerIfFaster: 0.15 }],
      ["sulong", "電氣加速", 35, "buff", 6, 0, "攻擊+2、速度+2，3回合後防禦-1", { selfStages: { atk: 2, spd: 2 }, selfStagesAfterUse: { def: -1 } }],
      ["fang", "電氣雷爪", 45, "special", 5, 105, "先制+1並有機率麻痺", { statusOnSix: { paralyze: 1 } }, { priority: 1 }],
    ]) }),
    card({ id: "ace", name: "波特卡斯·D·艾斯", tier: "T1", roleType: "戰鬥型", attribute: "技", passive: "火焰猛攻", moveSet: moves("ace", "技", [
      ["fist", "火拳", 1, "attack", 25, 55, "基礎攻擊"],
      ["net", "炎上網", 1, "control", 15, 0, "敵方速度-1", { enemyStages: { spd: -1 } }],
      ["guard", "火焰護身", 1, "shield", 10, 0, "本回合減傷25%，反彈少量傷害", { shieldRatio: 0.25, reflectRatio: 0.1 }],
      ["haze", "陽炎", 1, "debuff", 15, 0, "敵方命中-1", { enemyStages: { accuracy: -1 } }],
      ["ring", "炎戒", 15, "attack", 15, 75, "有機率灼傷", { statusOnSix: { burn: 1 } }],
      ["firefly", "神火不知火", 25, "attack", 10, 85, "骰到5以上追加15傷害，骰到6灼傷", { statusOnSix: { burn: 1 }, bonusOnHighDice: 15 }],
      ["pillar", "火柱", 35, "attack", 8, 100, "對群體敵人效果佳"],
      ["entei", "大炎戒炎帝", 45, "special", 5, 125, "使用後自身速度-1", { selfStagesAfterUse: { spd: -1 } }],
    ]) }),
    card({ id: "sabo", name: "薩波", tier: "T1", roleType: "偵查型", attribute: "技", passive: "革命偵察", moveSet: moves("sabo", "技", [
      ["claw", "龍爪拳", 1, "attack", 25, 50, "基礎攻擊"],
      ["break", "弱點識破", 1, "debuff", 15, 0, "敵方防禦-1", { enemyStages: { def: -1 } }],
      ["stance", "龍爪架勢", 1, "buff", 10, 0, "自身攻擊+1、命中+1", { selfStages: { atk: 1, accuracy: 1 } }],
      ["hook", "龍鉤爪", 1, "attack", 20, 60, "骰到5以上敵方攻擊-1", { enemyStagesOnHighDice: { atk: -1 } }],
      ["inherit", "火拳繼承", 15, "attack", 15, 75, "有機率灼傷", { statusOnSix: { burn: 1 } }],
      ["breath", "龍之吐息", 25, "debuff", 10, 0, "敵方防禦-2", { enemyStages: { def: -2 } }],
      ["dragonfire", "炎龍突擊", 35, "attack", 8, 95, "對防禦下降敵人傷害+20%", { strongerVsDebuffed: 0.2 }],
      ["revo", "革命龍炎", 45, "special", 5, 115, "命中後敵方攻擊、防禦-1", { enemyStagesOnHit: { atk: -1, def: -1 } }],
    ]) }),
    card({ id: "yamato", name: "大和", tier: "T2", roleType: "戰鬥型", attribute: "力", passive: "大口真神", moveSet: moves("yamato", "力", [
      ["bagua", "雷鳴八卦", 1, "attack", 25, 55, "基礎攻擊"],
      ["fang", "冰牙守護", 1, "shield", 10, 0, "本回合減傷35%", { shieldRatio: 0.35 }],
      ["wolf", "大口真神", 1, "buff", 10, 0, "攻擊+1、防禦+1", { selfStages: { atk: 1, def: 1 } }],
      ["claw", "冰爪", 1, "attack", 20, 60, "有機率冰凍", { statusOnSix: { freeze: 1 } }],
      ["mukoku", "無侍冰牙", 15, "attack", 15, 80, "骰到5以上敵方速度-1", { enemyStagesOnHighDice: { spd: -1 } }],
      ["mirror", "鏡山", 25, "shield", 8, 0, "本回合減傷50%", { shieldRatio: 0.5 }],
      ["hakujya", "白蛇駆", 35, "attack", 8, 100, "對四皇傷害+15%", { bossDamageBonus: 0.15 }],
      ["ikazuchi", "建御雷", 45, "special", 5, 120, "攻擊後自身防禦+1", { selfStagesAfterUse: { def: 1 } }],
    ]) }),
    card({ id: "corazon", name: "柯拉松", tier: "T6", roleType: "偵查型", attribute: "技", passive: "無聲掩護", moveSet: moves("corazon", "技", [
      ["shot", "手槍射擊", 1, "attack", 25, 35, "基礎攻擊"],
      ["silent", "靜音空間", 1, "control", 15, 0, "敵方技能效果成功率下降", { enemyStages: { accuracy: -1 } }],
      ["jam", "寂靜干擾", 1, "debuff", 15, 0, "敵方命中-1、速度-1", { enemyStages: { accuracy: -1, spd: -1 } }],
      ["cover", "掩護撤退", 1, "shield", 10, 0, "本回合減傷25%", { shieldRatio: 0.25 }],
      ["assault", "無聲突襲", 15, "attack", 15, 55, "先制+1", {}, { priority: 1 }],
      ["heart", "保護之心", 25, "heal", 10, 0, "回復隊伍最低血量角色20%HP", { healLowestAllyRatio: 0.2 }],
      ["seal", "消音封鎖", 35, "control", 8, 0, "敵方1回合不能使用強化技", { blockEnemyBuff: 1 }],
      ["sacrifice", "犧牲守護", 45, "special", 5, 0, "本回合全隊減傷50%，自身扣少量HP", { teamShieldRatio: 0.5, selfHpCostRatio: 0.1 }],
    ]) }),
    card({ id: "usopp", name: "騙人布", tier: "T4", roleType: "移動型", attribute: "速", passive: "狙擊逃脫", moveSet: moves("usopp", "速", [
      ["lead", "鉛星", 1, "attack", 25, 35, "基礎攻擊"],
      ["smoke", "煙霧星", 1, "debuff", 15, 0, "敵方命中-1", { enemyStages: { accuracy: -1 } }],
      ["route", "逃跑路線", 1, "buff", 10, 0, "自身速度+1", { selfStages: { spd: 1 } }],
      ["bluff", "謊言威嚇", 1, "control", 15, 0, "敵方攻擊-1", { enemyStages: { atk: -1 } }],
      ["gunpowder", "火藥星", 15, "attack", 15, 60, "有機率灼傷", { statusOnSix: { burn: 1 } }],
      ["caltrop", "撒菱地獄", 25, "control", 10, 0, "敵方速度-1、閃避-1", { enemyStages: { spd: -1, evasion: -1 } }],
      ["impact", "衝擊貝", 35, "attack", 8, 85, "使用後自身防禦-1", { selfStagesAfterUse: { def: -1 } }],
      ["hammer", "烏索普黃金鐵鎚", 45, "special", 5, 95, "敵方攻擊-2", { enemyStagesOnHit: { atk: -2 } }],
    ]) }),
    card({ id: "chopper", name: "多尼多尼·喬巴", tier: "T5", roleType: "輔助型", attribute: "技", passive: "船醫支援", moveSet: moves("chopper", "技", [
      ["tackle", "撞擊", 1, "attack", 25, 35, "基礎攻擊"],
      ["kit", "急救包", 1, "heal", 15, 0, "回復自身25%HP", { healRatio: 0.25 }],
      ["guard", "防守強化", 1, "buff", 10, 0, "防禦+2", { selfStages: { def: 2 } }],
      ["rumble", "藍波球診斷", 1, "special", 10, 0, "解除自身異常", { cleanseSelf: true }],
      ["heavy", "重量強化", 15, "attack", 15, 65, "骰到5以上攻擊+1", { selfStagesOnHighDice: { atk: 1 } }],
      ["scope", "診斷弱點", 25, "debuff", 10, 0, "敵方防禦-1、命中-1", { enemyStages: { def: -1, accuracy: -1 } }],
      ["horn", "角強化", 35, "attack", 8, 82, "骰到5以上敵方防禦-1", { enemyStagesOnHighDice: { def: -1 } }],
      ["guardpoint", "毛皮強化", 45, "shield", 5, 0, "本回合減傷50%", { shieldRatio: 0.5 }],
    ]) }),
    card({ id: "jinbe", name: "吉貝爾", tier: "T4", roleType: "偵查型", attribute: "力", passive: "海俠洞察", moveSet: moves("jinbe", "力", [
      ["karate", "魚人空手道", 1, "attack", 25, 45, "基礎攻擊"],
      ["water", "擊水", 1, "attack", 20, 55, "骰到5以上敵方速度-1", { enemyStagesOnHighDice: { spd: -1 } }],
      ["waterheart", "水心", 1, "shield", 10, 0, "本回合減傷30%", { shieldRatio: 0.3 }],
      ["seiken", "唐草瓦正拳", 1, "attack", 20, 60, "骰到5以上敵方防禦-1", { enemyStagesOnHighDice: { def: -1 } }],
      ["throw", "海流一本背負", 15, "control", 10, 0, "敵方速度-2", { enemyStages: { spd: -2 } }],
      ["same", "鮫瓦正拳", 25, "attack", 10, 85, "對力量型敵人傷害+10%", { bonusVsAttribute: "力", amplifyVsAttribute: 0.1 }],
      ["guardian", "海俠守護", 35, "shield", 8, 0, "本回合全隊減傷25%", { teamShieldRatio: 0.25 }],
      ["burai", "奧義武賴貫", 45, "special", 5, 105, "無視敵方15%防禦", { antiShieldBonus: 0.15 }],
    ]) }),
    card({ id: "brook", name: "布魯克", tier: "T4", roleType: "偵查型", attribute: "速", passive: "黃泉感知", moveSet: moves("brook", "速", [
      ["song", "鼻歌三丁", 1, "attack", 25, 45, "基礎攻擊"],
      ["cold", "靈魂寒氣", 1, "debuff", 15, 0, "敵方攻擊-1、速度-1", { enemyStages: { atk: -1, spd: -1 } }],
      ["sleep", "催眠音律", 1, "control", 15, 0, "機率睡眠1回合", { statusOnSix: { sleep: 1 } }],
      ["frost", "寒氣斬", 1, "attack", 20, 60, "敵方攻擊-1", { enemyStagesOnHit: { atk: -1 } }],
      ["soul", "催眠曲輪舞", 15, "buff", 10, 0, "閃避+2", { selfStages: { evasion: 2 } }],
      ["yellow", "鼻歌三丁", 25, "attack", 10, 80, "機率冰凍", { statusOnSix: { freeze: 1 } }],
      ["music", "靈魂樂章", 35, "control", 8, 0, "敵方速度-2、命中-1", { enemyStages: { spd: -2, accuracy: -1 } }],
      ["king", "靈魂王斬擊", 45, "special", 5, 100, "對控制中的敵人傷害+25%", { strongerVsDebuffed: 0.25 }],
    ]) }),
    card({ id: "franky", name: "佛朗基", tier: "T4", roleType: "移動型", attribute: "力", passive: "鋼鐵推進", moveSet: moves("franky", "力", [
      ["punch", "強拳", 1, "attack", 25, 45, "基礎攻擊"],
      ["cola", "可樂衝刺", 1, "buff", 10, 0, "速度+1", { selfStages: { spd: 1 } }],
      ["body", "鐵體防壁", 1, "shield", 10, 0, "本回合減傷35%", { shieldRatio: 0.35 }],
      ["coup", "風來砲", 1, "attack", 20, 60, "骰到5以上追加10傷害", { bonusOnHighDice: 10 }],
      ["rocket", "佛朗基火箭砲", 15, "attack", 15, 75, "敵方防禦-1", { enemyStagesOnHit: { def: -1 } }],
      ["arm", "將軍左腕", 25, "attack", 10, 85, "骰到5以上敵方速度-1", { enemyStagesOnHighDice: { spd: -1 } }],
      ["shogun", "鋼鐵將軍", 35, "buff", 8, 0, "防禦+2、攻擊+1", { selfStages: { def: 2, atk: 1 } }],
      ["laser", "風來砲", 45, "special", 5, 105, "無視20%防禦", { antiShieldBonus: 0.2 }],
    ]) }),
    card({ id: "oden", name: "光月御田", tier: "T2", roleType: "戰鬥型", attribute: "力", passive: "武士豪氣", moveSet: moves("oden", "力", [
      ["dual", "雙刀斬", 1, "attack", 25, 55, "基礎攻擊"],
      ["spirit", "武士氣魄", 1, "buff", 10, 0, "攻擊+1", { selfStages: { atk: 1 } }],
      ["ryuo", "流櫻防禦", 1, "shield", 10, 0, "本回合減傷30%", { shieldRatio: 0.3 }],
      ["break", "破鎧斬", 1, "attack", 20, 65, "敵方防禦-1", { enemyStagesOnHit: { def: -1 } }],
      ["togen1", "桃源白瀧", 15, "attack", 15, 80, "骰到5以上追加15傷害", { bonusOnHighDice: 15 }],
      ["style", "御田二刀流", 25, "buff", 8, 0, "攻擊+2、速度+1", { selfStages: { atk: 2, spd: 1 } }],
      ["togen2", "桃源十拳", 35, "attack", 8, 105, "對四皇與Boss傷害+15%", { bossDamageBonus: 0.15 }],
      ["legend", "傳說武士斬", 45, "special", 5, 125, "無視護盾", { pierceShield: true }],
    ]) }),
    card({ id: "rayleigh", name: "西爾巴茲·雷利", tier: "T1", roleType: "戰鬥型", attribute: "技", passive: "冥王壓場", moveSet: moves("rayleigh", "技", [
      ["slash", "覆霸斬", 1, "attack", 25, 55, "基礎攻擊"],
      ["future", "冥王預判", 1, "buff", 10, 0, "閃避+1、命中+1", { selfStages: { evasion: 1, accuracy: 1 } }],
      ["arm", "冥王防禦", 1, "shield", 10, 0, "本回合減傷35%", { shieldRatio: 0.35 }],
      ["haki", "冥王壓制", 1, "debuff", 15, 0, "敵方攻擊-1", { enemyStages: { atk: -1 } }],
      ["thrust", "老兵突刺", 15, "attack", 15, 80, "骰到5以上先制+1", { priorityOnHighDice: 1 }],
      ["guide", "冥王指導", 25, "buff", 8, 0, "攻擊+1、防禦+1、速度+1", { selfStages: { atk: 1, def: 1, spd: 1 } }],
      ["supreme", "霸王色震懾", 35, "control", 6, 0, "敵方1回合無法強化", { blockEnemyBuff: 1 }],
      ["flash", "冥王一閃", 45, "special", 5, 120, "必中，無視閃避提升", { pierceShield: true }, { accuracy: 999 }],
    ]) }),
    card({ id: "garp", name: "蒙其·D·卡普", tier: "T2", roleType: "戰鬥型", attribute: "力", passive: "英雄鐵拳", moveSet: moves("garp", "力", [
      ["lovefist", "愛之鐵拳", 1, "attack", 25, 55, "基礎攻擊"],
      ["hero", "海軍英雄", 1, "buff", 10, 0, "攻擊+1、防禦+1", { selfStages: { atk: 1, def: 1 } }],
      ["guard", "鐵拳防禦", 1, "shield", 10, 0, "本回合減傷35%", { shieldRatio: 0.35 }],
      ["justice", "正義威壓", 1, "debuff", 15, 0, "敵方攻擊-1", { enemyStages: { atk: -1 } }],
      ["meteor", "拳骨流星", 15, "attack", 15, 80, "骰到5以上敵方防禦-1", { enemyStagesOnHighDice: { def: -1 } }],
      ["arm", "鐵拳蓄勢", 25, "buff", 8, 0, "攻擊+2", { selfStages: { atk: 2 } }],
      ["impact", "拳骨衝擊", 35, "attack", 8, 105, "無視15%防禦", { antiShieldBonus: 0.15 }],
      ["galaxy", "銀河衝擊", 45, "special", 5, 125, "使用後自身速度-1", { selfStagesAfterUse: { spd: -1 } }],
    ]) }),
    card({ id: "vivi", name: "薇薇", tier: "T6", roleType: "移動型", attribute: "速", passive: "王女步調", moveSet: moves("vivi", "速", [
      ["peacock", "孔雀鎖鏈", 1, "attack", 25, 35, "基礎攻擊"],
      ["cheer", "王女鼓舞", 1, "buff", 15, 0, "自身速度+1", { selfStages: { spd: 1 } }],
      ["peace", "和平交涉", 1, "debuff", 15, 0, "敵方攻擊-1", { enemyStages: { atk: -1 } }],
      ["escape", "快速撤離", 1, "shield", 10, 0, "本回合減傷25%", { shieldRatio: 0.25 }],
      ["order", "王女號令", 15, "buff", 10, 0, "自身速度+1、閃避+1", { selfStages: { spd: 1, evasion: 1 } }],
      ["support", "王國支援", 25, "heal", 8, 0, "回復隊伍最低血量角色20%HP", { healLowestAllyRatio: 0.2 }],
      ["combo", "孔雀連環", 35, "attack", 10, 65, "骰子點數決定連擊段數", { multiHit: 1, comboAtkRatio: 0.06 }],
      ["will", "阿拉巴斯坦意志", 45, "special", 5, 0, "全隊回復10%HP並解除一個異常", { healTeamRatio: 0.1, cleanseTeam: true }],
    ]) }),
    card({ id: "koby", name: "克比", tier: "T5", roleType: "偵查型", attribute: "速", passive: "海軍觀測", moveSet: moves("koby", "速", [
      ["punch", "直拳", 1, "attack", 25, 40, "基礎攻擊"],
      ["analyze", "冷靜分析", 1, "debuff", 15, 0, "敵方命中-1", { enemyStages: { accuracy: -1 } }],
      ["stance", "正義架勢", 1, "buff", 10, 0, "自身防禦+1、速度+1", { selfStages: { def: 1, spd: 1 } }],
      ["soru", "剃步閃避", 1, "buff", 10, 0, "速度+1、閃避+1", { selfStages: { spd: 1, evasion: 1 } }],
      ["rokushiki", "海軍六式訓練", 15, "buff", 8, 0, "攻擊+1、防禦+1", { selfStages: { atk: 1, def: 1 } }],
      ["precise", "精準打擊", 25, "attack", 15, 70, "必中", {}, { accuracy: 999 }],
      ["haki", "海軍觀測", 35, "special", 6, 0, "閃避+2，敵方命中-1", { selfStages: { evasion: 2 }, enemyStages: { accuracy: -1 } }],
      ["justice", "正義突拳", 45, "attack", 5, 95, "對攻擊下降敵人傷害+25%", { strongerVsDebuffed: 0.25 }],
    ]) }),
    card({ id: "smoker", name: "斯摩格", tier: "T5", roleType: "戰鬥型", attribute: "技", passive: "白煙制壓", moveSet: moves("smoker", "技", [
      ["jitte", "十手打擊", 1, "attack", 25, 45, "基礎攻擊"],
      ["bind", "白煙拘束", 1, "control", 15, 0, "敵方速度-1", { enemyStages: { spd: -1 } }],
      ["body", "煙霧護體", 1, "shield", 10, 0, "本回合減傷30%", { shieldRatio: 0.3 }],
      ["white", "白拳", 1, "attack", 20, 60, "骰到5以上敵方命中-1", { enemyStagesOnHighDice: { accuracy: -1 } }],
      ["snake", "白蛇", 15, "attack", 15, 70, "先制+1", {}, { priority: 1 }],
      ["stone", "海樓石十手", 25, "attack", 10, 85, "對能力者敵人傷害+15%", { bossDamageBonus: 0.15 }],
      ["storm", "白色疾風", 35, "control", 8, 0, "敵方速度-2", { enemyStages: { spd: -2 } }],
      ["press", "煙霧制壓", 45, "special", 5, 100, "敵方命中-1、速度-1", { enemyStagesOnHit: { accuracy: -1, spd: -1 } }],
    ]) }),
    card({ id: "tashigi", name: "達斯琪", tier: "T6", roleType: "移動型", attribute: "技", passive: "居合快步", moveSet: moves("tashigi", "技", [
      ["blade", "名刀斬", 1, "attack", 25, 35, "基礎攻擊"],
      ["pace", "快步追擊", 1, "buff", 15, 0, "速度+1", { selfStages: { spd: 1 } }],
      ["read", "看破", 1, "shield", 10, 0, "本回合減傷25%", { shieldRatio: 0.25 }],
      ["justice", "正義壓制", 1, "debuff", 15, 0, "敵方攻擊-1", { enemyStages: { atk: -1 } }],
      ["iaido", "居合斬", 15, "attack", 15, 60, "先制+1", {}, { priority: 1 }],
      ["identify", "名刀識破", 25, "special", 10, 0, "敵方防禦-1、命中-1", { enemyStages: { def: -1, accuracy: -1 } }],
      ["combo", "連續斬擊", 35, "attack", 10, 35, "骰子點數決定連擊段數", { multiHit: 1, comboAtkRatio: 0.075 }],
      ["flash", "正義一閃", 45, "attack", 5, 90, "骰到5以上無視護盾", { pierceShieldOnHighDice: true }],
    ]) }),
    card({ id: "kuzan", name: "庫山", tier: "T2", roleType: "戰鬥型", attribute: "速", passive: "冰結戰場", moveSet: moves("kuzan", "速", [
      ["fist", "冰塊拳", 1, "attack", 25, 55, "基礎攻擊"],
      ["age1", "冰河時代小型", 1, "control", 15, 0, "敵方速度-1", { enemyStages: { spd: -1 } }],
      ["wall", "冰壁", 1, "shield", 10, 0, "本回合減傷35%", { shieldRatio: 0.35 }],
      ["spear", "冰矛", 1, "attack", 20, 65, "有機率冰凍", { statusOnSix: { freeze: 1 } }],
      ["blade", "冰刀", 15, "attack", 15, 80, "骰到5以上敵方防禦-1", { enemyStagesOnHighDice: { def: -1 } }],
      ["zero", "絕對零度氣場", 25, "debuff", 8, 0, "敵方速度-2", { enemyStages: { spd: -2 } }],
      ["age2", "冰河時代", 35, "special", 6, 95, "命中後敵方下回合速度-2", { enemyStagesOnHit: { spd: -2 } }],
      ["world", "冰封世界", 45, "attack", 5, 120, "骰到6冰凍，Boss改為速度-2", { statusOnSix: { freeze: 1 }, bossStageOnHit: { spd: -2 } }],
    ]) }),
    card({ id: "fujitora", name: "藤虎", tier: "T2", roleType: "戰鬥型", attribute: "技", passive: "重力壓制", moveSet: moves("fujitora", "技", [
      ["blade", "重力刀", 1, "attack", 25, 55, "基礎攻擊"],
      ["press", "重壓", 1, "debuff", 15, 0, "敵方速度-1", { enemyStages: { spd: -1 } }],
      ["sense", "重力感知", 1, "buff", 10, 0, "命中+1、閃避+1", { selfStages: { accuracy: 1, evasion: 1 } }],
      ["barrier", "重力防壁", 1, "shield", 10, 0, "本回合減傷35%", { shieldRatio: 0.35 }],
      ["meteor", "隕石牽引", 15, "attack", 15, 80, "命中較低但威力高", {}, { accuracy: 90 }],
      ["bind", "重力束縛", 25, "control", 8, 0, "敵方1回合不能先制", { blockEnemyPriority: 1 }],
      ["quake", "地裂重壓", 35, "attack", 8, 100, "敵方防禦-1", { enemyStagesOnHit: { def: -1 } }],
      ["fall", "天墜隕星", 45, "special", 5, 125, "使用後自身速度-1", { selfStagesAfterUse: { spd: -1 } }],
    ]) }),
    card({ id: "bartolomeo", name: "巴托洛米奧", tier: "T5", roleType: "輔助型", attribute: "速", passive: "屏障支援", moveSet: moves("bartolomeo", "速", [
      ["punch", "拳擊", 1, "attack", 25, 35, "基礎攻擊"],
      ["barrier", "屏障防禦", 1, "shield", 15, 0, "本回合減傷50%", { shieldRatio: 0.5 }],
      ["taunt", "挑釁", 1, "control", 15, 0, "敵方攻擊-1", { enemyStages: { atk: -1 } }],
      ["fan", "粉絲應援", 1, "heal", 10, 0, "回復自身20%HP", { healRatio: 0.2 }],
      ["crash", "屏障撞擊", 15, "attack", 15, 60, "自身有護盾時傷害+20%", { strongerIfShielded: 0.2 }],
      ["reflect", "反射屏障", 25, "shield", 8, 0, "本回合減傷35%，並反彈少量傷害", { shieldRatio: 0.35, reflectRatio: 0.12 }],
      ["team", "全隊屏障", 35, "shield", 6, 0, "本回合全隊減傷35%", { teamShieldRatio: 0.35 }],
      ["absolute", "絕對屏障", 45, "special", 4, 0, "完全抵擋一次傷害", { negateNextHit: true }],
    ]) }),
    card({ id: "cavendish", name: "卡文迪許", tier: "T5", roleType: "移動型", attribute: "速", passive: "白馬疾影", moveSet: moves("cavendish", "速", [
      ["rose", "玫瑰突刺", 1, "attack", 25, 40, "基礎攻擊"],
      ["step", "華麗步伐", 1, "buff", 15, 0, "速度+1、閃避+1", { selfStages: { spd: 1, evasion: 1 } }],
      ["charm", "挑釁魅惑", 1, "debuff", 15, 0, "敵方命中-1", { enemyStages: { accuracy: -1 } }],
      ["guard", "快劍防守", 1, "shield", 10, 0, "本回合減傷25%", { shieldRatio: 0.25 }],
      ["hakuba", "白馬疾影", 15, "buff", 8, 0, "速度+2、攻擊+1", { selfStages: { spd: 2, atk: 1 } }],
      ["slash", "高速斬", 25, "attack", 15, 75, "先制+1", {}, { priority: 1 }],
      ["sleepwalk", "夢遊亂舞", 35, "attack", 8, 95, "命中較低，傷害高", {}, { accuracy: 90 }],
      ["sky", "白馬斷空", 45, "special", 5, 105, "若速度高於敵方，傷害+20%", { strongerIfFaster: 0.2 }],
    ]) }),
    card({ id: "kinemon", name: "錦衛門", tier: "T4", roleType: "戰鬥型", attribute: "力", passive: "赤鞘炎斬", moveSet: moves("kinemon", "力", [
      ["foxfire", "火柳一閃", 1, "attack", 25, 45, "基礎攻擊"],
      ["guard", "武士格擋", 1, "shield", 10, 0, "本回合減傷30%", { shieldRatio: 0.3 }],
      ["flame", "火焰切裂", 1, "attack", 20, 60, "有機率灼傷", { statusOnSix: { burn: 1 } }],
      ["command", "戰術指揮", 1, "buff", 10, 0, "攻擊+1", { selfStages: { atk: 1 } }],
      ["blaze", "焰裂斬", 15, "attack", 15, 75, "對灼傷敵人傷害+20%", { strongerVsStatus: { burn: 0.2 } }],
      ["disguise", "變裝奇策", 25, "special", 8, 0, "敵方命中-1、自身閃避+1", { enemyStages: { accuracy: -1 }, selfStages: { evasion: 1 } }],
      ["scabbard", "赤鞘意志", 35, "buff", 6, 0, "攻擊+2、防禦+1", { selfStages: { atk: 2, def: 1 } }],
      ["oryu", "狐火流奧義", 45, "special", 5, 100, "解除敵方強化後造成傷害", { dispelEnemyBuffs: true }],
    ]) }),
    card({ id: "ivankov", name: "安布里歐·伊娃科夫", tier: "T3", roleType: "輔助型", attribute: "技", passive: "荷爾蒙支援", moveSet: moves("ivankov", "技", [
      ["face", "顏面衝擊", 1, "attack", 25, 45, "基礎攻擊"],
      ["heal", "治癒荷爾蒙", 1, "heal", 15, 0, "回復自身30%HP", { healRatio: 0.3 }],
      ["boost", "亢奮荷爾蒙", 1, "buff", 10, 0, "攻擊+1、速度+1", { selfStages: { atk: 1, spd: 1 } }],
      ["def", "防禦荷爾蒙", 1, "shield", 10, 0, "本回合減傷30%", { shieldRatio: 0.3 }],
      ["wink", "死亡媚眼", 15, "attack", 15, 75, "骰到5以上敵方命中-1", { enemyStagesOnHighDice: { accuracy: -1 } }],
      ["miracle", "奇蹟治療", 25, "heal", 8, 0, "回復隊伍最低HP角色35%", { healLowestAllyRatio: 0.35 }],
      ["over", "荷爾蒙暴走", 35, "buff", 6, 0, "攻擊+2、速度+2，下回合防禦-1", { selfStages: { atk: 2, spd: 2 }, selfStagesAfterUse: { def: -1 } }],
      ["queen", "人妖王奇蹟", 45, "special", 4, 0, "全隊回復20%HP並解除異常", { healTeamRatio: 0.2, cleanseTeam: true }],
    ]) }),
    card({ id: "kuma", name: "巴索羅繆·熊", tier: "T3", roleType: "移動型", attribute: "力", passive: "瞬移壓制", moveSet: moves("kuma", "力", [
      ["pad", "熊掌衝擊", 1, "attack", 25, 50, "基礎攻擊"],
      ["repel", "彈開傷害", 1, "shield", 10, 0, "本回合減傷35%", { shieldRatio: 0.35 }],
      ["teleport", "瞬間移動", 1, "buff", 10, 0, "速度+2", { selfStages: { spd: 2 } }],
      ["cannon", "壓力砲", 1, "attack", 20, 65, "骰到5以上敵方速度-1", { enemyStagesOnHighDice: { spd: -1 } }],
      ["fly", "拍飛", 15, "control", 10, 0, "敵方下回合不能先制", { blockEnemyPriority: 1 }],
      ["transfer", "衝擊轉移", 25, "control", 8, 0, "敵方下回合攻擊-1、速度-1", { enemyStages: { atk: -1, spd: -1 } }],
      ["expel", "傷害排出", 35, "heal", 6, 0, "回復自身35%HP並解除一個異常", { healRatio: 0.35, cleanseSelf: true }],
      ["ursus", "熊之衝擊", 45, "special", 5, 110, "無視護盾", { pierceShield: true }],
    ]) }),
    card({ id: "dragon", name: "蒙其·D·龍", tier: "T1", roleType: "移動型", attribute: "速", passive: "革命風暴", moveSet: moves("dragon", "速", [
      ["blade", "風刃", 1, "attack", 25, 60, "基礎攻擊"],
      ["dash", "疾風步", 1, "buff", 10, 0, "速度+2", { selfStages: { spd: 2 } }],
      ["bind", "風壓束縛", 1, "control", 15, 0, "敵方速度-1", { enemyStages: { spd: -1 } }],
      ["wall", "風牆", 1, "shield", 10, 0, "本回合減傷35%", { shieldRatio: 0.35 }],
      ["storm", "暴風壓制", 15, "special", 10, 75, "造成傷害，敵方速度-2", { enemyStages: { spd: -2 } }],
      ["tornado", "龍捲突襲", 25, "attack", 10, 105, "先制+1；若速度高於敵方，傷害+15%", { strongerIfFaster: 0.15 }, { priority: 1 }],
      ["weather", "天候支配", 35, "special", 6, 90, "造成傷害，敵方命中-1、速度-1、攻擊-1", { enemyStages: { accuracy: -1, spd: -1, atk: -1 } }],
      ["revo", "革命風暴", 45, "special", 5, 135, "先制+1，若速度高於敵方傷害+25%；命中後自身速度+1", { selfStagesAfterUse: { spd: 1 }, strongerIfFaster: 0.25 }, { priority: 1 }],
    ]) }),
    card({ id: "kid", name: "尤斯塔斯·基德", tier: "T2", roleType: "戰鬥型", attribute: "力", passive: "磁力破壞", moveSet: moves("kid", "力", [
      ["metal", "金屬拳", 1, "attack", 25, 55, "基礎攻擊"],
      ["magnet", "磁力吸附", 1, "debuff", 15, 0, "敵方防禦-1", { enemyStages: { def: -1 } }],
      ["iron", "鐵壁金屬", 1, "shield", 10, 0, "本回合減傷35%", { shieldRatio: 0.35 }],
      ["boost", "磁力增幅", 1, "buff", 10, 0, "攻擊+1", { selfStages: { atk: 1 } }],
      ["break", "破壞拳", 15, "attack", 15, 80, "對護盾敵人傷害+20%", { strongerIfShieldedTarget: 0.2 }],
      ["arm", "金屬巨臂", 25, "attack", 10, 95, "命中較低但威力高", {}, { accuracy: 90 }],
      ["demon", "磁力武裝", 35, "buff", 6, 0, "攻擊+2、防禦+1", { selfStages: { atk: 2, def: 1 } }],
      ["railgun", "磁力重砲", 45, "special", 5, 125, "無視20%防禦", { antiShieldBonus: 0.2 }],
    ]) }),
    card({ id: "killer", name: "基拉", tier: "T3", roleType: "戰鬥型", attribute: "速", passive: "殺戮旋律", moveSet: moves("killer", "速", [
      ["spin", "旋刃斬", 1, "attack", 25, 50, "基礎攻擊"],
      ["rhythm", "殺戮節奏", 1, "buff", 10, 0, "攻擊+1、速度+1", { selfStages: { atk: 1, spd: 1 } }],
      ["guard", "迴旋防禦", 1, "shield", 10, 0, "本回合減傷25%", { shieldRatio: 0.25 }],
      ["break", "破甲刃", 1, "attack", 20, 60, "敵方防禦-1", { enemyStagesOnHit: { def: -1 } }],
      ["sonic", "音速斬", 15, "attack", 15, 75, "先制+1", {}, { priority: 1 }],
      ["combo", "鐮刃連擊", 25, "attack", 10, 35, "骰子點數決定連擊段數", { multiHit: 1, comboAtkRatio: 0.065 }],
      ["speed", "殺戮高速", 35, "buff", 6, 0, "速度+2、攻擊+1", { selfStages: { spd: 2, atk: 1 } }],
      ["dance", "斬首輪舞", 45, "special", 5, 105, "若速度高於敵方，傷害+25%", { strongerIfFaster: 0.25 }],
    ]) }),
    card({ id: "perona", name: "佩羅娜", tier: "T6", roleType: "偵查型", attribute: "技", passive: "幽靈騷擾", moveSet: moves("perona", "技", [
      ["ghost", "幽靈撞擊", 1, "attack", 25, 40, "基礎攻擊"],
      ["negative", "消極幽靈", 1, "debuff", 15, 0, "敵方攻擊-1", { enemyStages: { atk: -1 } }],
      ["curse", "消極詛咒", 1, "debuff", 15, 0, "敵方攻擊-1、命中-1", { enemyStages: { atk: -1, accuracy: -1 } }],
      ["guard", "幽靈防護", 1, "shield", 10, 0, "本回合減傷25%", { shieldRatio: 0.25 }],
      ["mini", "迷你幽靈炸彈", 15, "attack", 15, 65, "骰到5以上敵方命中-1", { enemyStagesOnHighDice: { accuracy: -1 } }],
      ["chain", "消極連鎖", 25, "control", 8, 0, "敵方攻擊-2", { enemyStages: { atk: -2 } }],
      ["spirit", "靈體脫離", 35, "buff", 6, 0, "閃避+2", { selfStages: { evasion: 2 } }],
      ["bomb", "特大幽靈炸彈", 45, "special", 5, 95, "敵方攻擊、速度-1", { enemyStagesOnHit: { atk: -1, spd: -1 } }],
    ]) }),
    card({ id: "mansherry", name: "曼雪莉", tier: "T6", roleType: "輔助型", attribute: "技", passive: "小人治癒", moveSet: moves("mansherry", "技", [
      ["wand", "小杖敲擊", 1, "attack", 25, 30, "基礎攻擊"],
      ["tear", "治癒之淚", 1, "heal", 15, 0, "回復自身30%HP", { healRatio: 0.3 }],
      ["bless", "小人族祝福", 1, "buff", 10, 0, "防禦+2", { selfStages: { def: 2 } }],
      ["bandage", "快速包紮", 1, "heal", 10, 0, "回復隊伍最低HP角色20%", { healLowestAllyRatio: 0.2 }],
      ["detox", "解毒治療", 15, "heal", 10, 0, "解除一個異常並回復10%HP", { healLowestAllyRatio: 0.1, cleanseTeam: true }],
      ["all", "全隊恢復", 25, "heal", 8, 0, "全隊回復15%HP", { healTeamRatio: 0.15 }],
      ["life", "生命奇蹟", 35, "special", 5, 0, "復活一名倒下隊員20%HP", { reviveLowestAllyRatio: 0.2 }],
      ["princess", "公主治癒", 45, "special", 4, 0, "全隊回復25%HP並解除異常", { healTeamRatio: 0.25, cleanseTeam: true }],
    ]) }),
    card({ id: "whitebeard", name: "白鬍子", tier: "T1", roleType: "戰鬥型", attribute: "力", passive: "世界最強男人", moveSet: moves("whitebeard", "力", [
      ["bisento", "薙刀橫掃", 1, "attack", 25, 60, "基礎攻擊"],
      ["quakefist", "震動拳", 1, "attack", 20, 72, "命中後敵方防禦-1", { enemyStagesOnHit: { def: -1 } }],
      ["quakewall", "震動防壁", 1, "shield", 10, 0, "本回合減傷35%，反彈少量傷害", { shieldRatio: 0.35, reflectRatio: 0.08 }],
      ["pressure", "霸氣壓迫", 1, "debuff", 12, 0, "敵方攻擊、防禦-1", { enemyStages: { atk: -1, def: -1 } }],
      ["seaquake", "海震", 15, "special", 12, 92, "骰到5以上敵方速度-1", { enemyStagesOnHighDice: { spd: -1 } }],
      ["airquake", "空震", 25, "special", 10, 108, "骰到5以上無視護盾", { pierceShieldOnHighDice: true }],
      ["split", "島割", 35, "attack", 7, 128, "對強敵傷害+15%", { bossDamageBonus: 0.15 }],
      ["strongest", "世界最強一擊", 45, "special", 5, 152, "對強敵傷害+20%，使用後速度-1", { bossDamageBonus: 0.2, selfStagesAfterUse: { spd: -1 } }],
    ]) }),
    card({ id: "jozu", name: "鑽石喬茲", tier: "T1", roleType: "戰鬥型", attribute: "力", passive: "鑽石身軀", moveSet: moves("jozu", "力", [
      ["punch", "鑽石重拳", 1, "attack", 25, 58, "基礎攻擊"],
      ["guard", "鑽石防禦", 1, "shield", 12, 0, "本回合減傷45%", { shieldRatio: 0.45 }],
      ["charge", "鑽石衝撞", 1, "attack", 18, 72, "骰到5以上敵方防禦-1", { enemyStagesOnHighDice: { def: -1 } }],
      ["wall", "隊長護衛", 1, "shield", 8, 0, "本回合全隊減傷25%", { teamShieldRatio: 0.25 }],
      ["brilliant", "閃耀衝撞", 15, "attack", 14, 88, "命中後自身防禦+1", { selfStagesOnHighDice: { def: 1 } }],
      ["intercept", "鑽石攔截", 25, "shield", 8, 0, "本回合減傷55%，反彈少量傷害", { shieldRatio: 0.55, reflectRatio: 0.1 }],
      ["breaker", "鑽石破陣", 35, "attack", 7, 118, "無視15%防禦", { ignoreDefenseRatio: 0.15 }],
      ["punk", "Brilliant Punk", 45, "special", 5, 138, "骰到5以上無視護盾", { pierceShieldOnHighDice: true }],
    ]) }),
    card({ id: "vista", name: "花劍比斯塔", tier: "T2", roleType: "戰鬥型", attribute: "速", passive: "花劍連斬", moveSet: moves("vista", "速", [
      ["slash", "雙劍斬", 1, "attack", 25, 54, "基礎攻擊"],
      ["petal", "花瓣劍路", 1, "buff", 12, 0, "自身命中+1、閃避+1", { selfStages: { accuracy: 1, evasion: 1 } }],
      ["guard", "雙劍格擋", 1, "shield", 10, 0, "本回合減傷30%", { shieldRatio: 0.3 }],
      ["feint", "花劍佯攻", 1, "debuff", 14, 0, "敵方防禦、命中-1", { enemyStages: { def: -1, accuracy: -1 } }],
      ["rose", "薔薇連斬", 15, "attack", 14, 40, "骰子點數決定連擊段數", { multiHit: 1, comboAtkRatio: 0.06 }],
      ["duel", "劍豪對峙", 25, "buff", 8, 0, "自身攻擊+1、速度+1", { selfStages: { atk: 1, spd: 1 } }],
      ["bloom", "花劍亂舞", 35, "attack", 7, 108, "對能力下降敵人傷害+20%", { strongerVsDebuffed: 0.2 }],
      ["finale", "花劍終幕", 45, "special", 5, 128, "命中後敵方防禦、閃避-1", { enemyStagesOnHit: { def: -1, evasion: -1 } }],
    ]) }),
    card({ id: "izo", name: "以藏", tier: "T2", roleType: "偵查型", attribute: "速", passive: "雙槍看破", moveSet: moves("izo", "速", [
      ["shot", "雙槍射擊", 1, "attack", 25, 50, "基礎攻擊"],
      ["mark", "槍口標記", 1, "debuff", 15, 0, "敵方防禦-1", { enemyStages: { def: -1 } }],
      ["smoke", "煙幕步伐", 1, "buff", 12, 0, "自身速度+1、閃避+1", { selfStages: { spd: 1, evasion: 1 } }],
      ["cover", "掩護射擊", 1, "shield", 10, 0, "本回合減傷25%", { shieldRatio: 0.25 }],
      ["rapid", "連續射擊", 15, "attack", 14, 38, "骰子點數決定連擊段數", { multiHit: 1, comboAtkRatio: 0.055 }],
      ["pierce", "破甲彈", 25, "special", 10, 92, "命中後敵方防禦-1", { enemyStagesOnHit: { def: -1 } }],
      ["command", "隊長狙擊令", 35, "debuff", 7, 0, "敵方攻擊、命中-1", { enemyStages: { atk: -1, accuracy: -1 } }],
      ["resolve", "赤鞘槍陣", 45, "special", 5, 118, "對能力下降敵人傷害+25%", { strongerVsDebuffed: 0.25 }],
    ]) }),
    card({ id: "little_oars_jr", name: "小奧茲 Jr.", tier: "T2", roleType: "戰鬥型", attribute: "力", passive: "魔人族巨軀", statProfile: "giant", baseStats: { hp: 132, atk: 86, def: 80, satk: 58, sdef: 68, spd: 50 }, moveSet: moves("little_oars_jr", "力", [
      ["club", "巨人棍擊", 1, "attack", 25, 62, "基礎攻擊"],
      ["stride", "巨步推進", 1, "buff", 10, 0, "自身攻擊+1、速度+1", { selfStages: { atk: 1, spd: 1 } }],
      ["body", "魔人身軀", 1, "shield", 12, 0, "本回合減傷40%", { shieldRatio: 0.4 }],
      ["roar", "救援怒吼", 1, "debuff", 12, 0, "敵方攻擊-1、速度-1", { enemyStages: { atk: -1, spd: -1 } }],
      ["sweep", "巨腕橫掃", 15, "attack", 14, 86, "骰到5以上敵方速度-1", { enemyStagesOnHighDice: { spd: -1 } }],
      ["wallbreak", "破牆衝鋒", 25, "attack", 10, 108, "骰到5以上無視護盾", { pierceShieldOnHighDice: true }],
      ["protect", "巨人護隊", 35, "shield", 7, 0, "本回合全隊減傷35%", { teamShieldRatio: 0.35 }],
      ["acepath", "為艾斯開路", 45, "special", 5, 142, "對強敵傷害+20%，使用後速度-1", { bossDamageBonus: 0.2, selfStagesAfterUse: { spd: -1 } }],
    ]) }),
    card({ id: "squard", name: "大渦蜘蛛・史庫亞德", tier: "T3", roleType: "偵查型", attribute: "技", passive: "悔悟突刺", moveSet: moves("squard", "技", [
      ["slash", "長刀斬擊", 1, "attack", 25, 46, "基礎攻擊"],
      ["probe", "破綻試探", 1, "debuff", 15, 0, "敵方防禦-1、命中-1", { enemyStages: { def: -1, accuracy: -1 } }],
      ["fleet", "同盟號令", 1, "buff", 10, 0, "自身攻擊+1、速度+1", { selfStages: { atk: 1, spd: 1 } }],
      ["parry", "大渦格擋", 1, "shield", 10, 0, "本回合減傷30%", { shieldRatio: 0.3 }],
      ["thrust", "背水突刺", 15, "attack", 14, 78, "對能力下降敵人傷害+20%", { strongerVsDebuffed: 0.2 }],
      ["betray", "疑心斬", 25, "debuff", 9, 0, "敵方攻擊、防禦-1", { enemyStages: { atk: -1, def: -1 } }],
      ["atonement", "悔悟反攻", 35, "attack", 7, 102, "對能力下降敵人傷害+25%", { strongerVsDebuffed: 0.25 }],
      ["spider", "大渦蜘蛛斬", 45, "special", 5, 122, "命中後敵方防禦、速度-1", { enemyStagesOnHit: { def: -1, spd: -1 } }],
    ]) }),
    card({ id: "marco", name: "馬可", tier: "T1", roleType: "輔助型", attribute: "技", passive: "不死鳥再生", moveSet: moves("marco", "技", [
      ["claw", "鳳凰爪擊", 1, "attack", 25, 45, "基礎攻擊"],
      ["flame", "再生火焰", 1, "heal", 15, 0, "回復自身30%HP", { healRatio: 0.3 }],
      ["blue", "藍焰守護", 1, "shield", 10, 0, "本回合減傷35%", { shieldRatio: 0.35 }],
      ["flight", "鳳凰飛行", 1, "buff", 10, 0, "速度+1、閃避+1", { selfStages: { spd: 1, evasion: 1 } }],
      ["kick", "青炎踢", 15, "attack", 15, 75, "骰到6回復自身10%HP", { healSelfOnSixRatio: 0.1 }],
      ["team", "隊伍再生", 25, "heal", 8, 0, "全隊回復15%HP", { healTeamRatio: 0.15 }],
      ["rebirth", "不死鳥再燃", 35, "special", 6, 0, "3回合內每回合回復自身10%HP", { regenSelfRatio: 0.1 }],
      ["seal", "鳳凰印", 45, "special", 5, 105, "傷害後回復全隊10%HP", { healTeamRatioAfterHit: 0.1 }],
    ]) }),
    card({ id: "prison_buggy", name: "囚服巴奇", tier: "T4", roleType: "偵查型", attribute: "技", passive: "越獄小丑", battlePortraits: battlePortraitsFor("prison_buggy"), moveSet: moves("prison_buggy", "技", [
      ["chop_fist", "四分五裂拳", 1, "attack", 20, 44, "基礎攻擊"],
      ["bomb", "巴其小炸彈", 1, "attack", 12, 64, "骰到5以上追加15傷害", { bonusOnHighDice: 15 }],
      ["escape", "小丑逃脫術", 1, "buff", 10, 0, "自身速度+1、閃避+1", { selfStages: { spd: 1, evasion: 1 } }],
      ["muggy_ball", "特製馬奇彈", 1, "special", 6, 84, "骰到5以上傷害+25%", { amplifyOnHighDice: 0.25 }],
      ["party_trick", "小丑奇襲", 15, "attack", 12, 72, "先制+1", { priority: 1 }, { priority: 1 }],
      ["flashy_feint", "華麗誘敵", 25, "debuff", 8, 0, "敵方命中-1、速度-1", { enemyStages: { accuracy: -1, spd: -1 } }],
      ["split_counter", "四分五裂反擊", 35, "shield", 6, 0, "本回合減傷35%，反彈少量傷害", { shieldRatio: 0.35, reflectRatio: 0.08 }],
      ["flashy_cannon", "華麗大砲", 45, "special", 4, 108, "骰到5以上追加35%傷害", { amplifyOnHighDice: 0.35 }],
    ]) }),
    card({ id: "prison_mr3", name: "囚服Mr.3", tier: "T4", roleType: "輔助型", attribute: "技", passive: "蠟燭支援", battlePortraits: battlePortraitsFor("prison_mr3"), moveSet: moves("prison_mr3", "技", [
      ["candle_wall", "蠟燭壁", 1, "shield", 10, 0, "本回合減傷35%", { shieldRatio: 0.35 }],
      ["candle_lock", "蠟燭拘束", 1, "control", 10, 0, "敵方速度-1", { enemyStages: { spd: -1 } }],
      ["candle_spear", "蠟燭長槍", 1, "attack", 16, 58, "命中後敵方防禦-1", { enemyStagesOnHit: { def: -1 } }],
      ["candle_champion", "蠟燭冠軍拳", 1, "special", 6, 82, "攻擊前獲得短暫減傷", { shieldRatioBeforeAttack: 0.2 }],
      ["candle_armor", "蠟燭鎧甲", 15, "buff", 8, 0, "自身防禦+2", { selfStages: { def: 2 } }],
      ["candle_bind", "蠟燭封鎖陣", 25, "control", 7, 0, "敵方速度-2", { enemyStages: { spd: -2 } }],
      ["giant_candle", "特大蠟燭槌", 35, "attack", 6, 92, "命中後敵方攻擊-1", { enemyStagesOnHit: { atk: -1 } }],
      ["candle_service_set", "蠟燭服務套餐", 45, "special", 4, 104, "敵方防禦-1，並短暫減傷", { enemyStagesOnHit: { def: -1 }, shieldRatioBeforeAttack: 0.25 }],
    ]) }),
    card({ id: "prison_mr2_bon_clay", name: "囚服Mr.2", tier: "T3", roleType: "移動型", attribute: "速", passive: "友情支援", battlePortraits: battlePortraitsFor("prison_mr2_bon_clay"), moveSet: moves("prison_mr2_bon_clay", "速", [
      ["okama_kick", "人妖拳法踢擊", 1, "attack", 18, 68, "先制+1", { priority: 1 }, { priority: 1 }],
      ["mane_mane", "模仿迷惑", 1, "debuff", 10, 0, "敵方命中-1、攻擊-1", { enemyStages: { accuracy: -1, atk: -1 } }],
      ["friendship", "友情鼓舞", 1, "buff", 8, 0, "自身攻擊+1、速度+1", { selfStages: { atk: 1, spd: 1 } }],
      ["swan_arabesque", "爆擊天鵝舞", 1, "special", 6, 96, "骰到5以上追加30%傷害", { amplifyOnHighDice: 0.3 }],
      ["clone_guard", "模仿護身", 15, "shield", 8, 0, "本回合減傷35%，閃避+1", { shieldRatio: 0.35, selfStages: { evasion: 1 } }],
      ["friend_dash", "友情衝刺", 25, "buff", 7, 0, "自身速度+2", { selfStages: { spd: 2 } }],
      ["okama_rush", "人妖連踢", 35, "attack", 6, 42, "骰子點數決定連擊段數", { multiHit: 1, comboAtkRatio: 0.065 }],
      ["final_ballet", "友情芭蕾終幕", 45, "special", 4, 118, "低血量時傷害+25%", { amplifyWhenLowHp: 0.25 }],
    ]) }),
    card({ id: "prison_mr1_daz_bones", name: "囚服Mr.1", tier: "T2", roleType: "戰鬥型", attribute: "力", passive: "鋼刃身軀", battlePortraits: battlePortraitsFor("prison_mr1_daz_bones"), moveSet: moves("prison_mr1_daz_bones", "力", [
      ["sparkling_daisy", "微塵斬", 1, "attack", 14, 84, "無視10%防禦", { ignoreDefenseRatio: 0.1 }],
      ["steel_body", "鋼刃身軀", 1, "shield", 8, 0, "本回合減傷40%，反彈少量傷害", { shieldRatio: 0.4, reflectRatio: 0.08 }],
      ["atomic_spurt", "發泡雛菊斬", 1, "attack", 8, 104, "骰到5以上流血2回合", { statusOnHighDice: { bleed: 2 } }],
      ["spiral_hollow", "滅裂斬", 1, "special", 5, 118, "無視15%防禦", { ignoreDefenseRatio: 0.15 }],
      ["blade_stance", "鋼刃架勢", 15, "buff", 8, 0, "自身攻擊+1、防禦+1", { selfStages: { atk: 1, def: 1 } }],
      ["slice_wave", "斬波", 25, "attack", 7, 98, "命中後敵方防禦-1", { enemyStagesOnHit: { def: -1 } }],
      ["diamond_edge", "鑽石邊刃", 35, "shield", 6, 0, "本回合減傷50%", { shieldRatio: 0.5 }],
      ["atomic_final", "滅裂雛菊斬", 45, "special", 4, 132, "骰到5以上流血3回合", { statusOnHighDice: { bleed: 3 } }],
    ]) }),
    card({ id: "prison_crocodile", name: "囚服克洛克達爾", tier: "T1", roleType: "戰鬥型", attribute: "技", passive: "沙漠野心", battlePortraits: battlePortraitsFor("prison_crocodile"), moveSet: moves("prison_crocodile", "技", [
      ["desert_spada", "沙漠寶刀", 1, "attack", 12, 100, "命中後敵方防禦-1", { enemyStagesOnHit: { def: -1 } }],
      ["sables", "沙嵐", 1, "debuff", 8, 0, "敵方命中-1、速度-1", { enemyStages: { accuracy: -1, spd: -1 } }],
      ["ground_secco", "侵蝕輪迴", 1, "special", 5, 126, "對能力下降敵人傷害+15%", { strongerVsDebuffed: 0.15 }],
      ["desert_girasole", "沙漠向日葵", 1, "special", 4, 146, "對能力下降敵人傷害+25%", { strongerVsDebuffed: 0.25 }],
      ["desert_la_spada", "沙漠金剛寶刀", 15, "attack", 8, 116, "無視15%防禦", { ignoreDefenseRatio: 0.15 }],
      ["sandstorm_command", "沙嵐號令", 25, "debuff", 7, 0, "敵方防禦-2、命中-1", { enemyStages: { def: -2, accuracy: -1 } }],
      ["dry_bind", "乾裂束縛", 35, "control", 6, 0, "骰到5以上恐懼1回合", { statusOnHighDice: { fear: 1 } }],
      ["ground_death", "侵蝕輪迴終幕", 45, "special", 3, 168, "對能力下降敵人傷害+35%", { strongerVsDebuffed: 0.35 }],
    ]) }),
    card({ id: "custom_mp3l6s8w", name: "烏塔", tier: "T3", roleType: "輔助型", attribute: "速", passive: "歌歌果實", statProfile: "custom", baseStats: { hp: 100, atk: 68, def: 74, satk: 88, sdef: 88, spd: 84 }, battlePortraits: battlePortraitsFor("uta"), moveSet: moves("custom_mp3l6s8w", "速", [
      ["new_genesis", "新時代", 1, "buff", 10, 0, "全隊回復8%HP，自身戰術+1", { healTeamRatio: 0.08, selfStages: { satk: 1 } }],
      ["uta_world", "歌歌世界", 1, "control", 10, 0, "敵方命中-1、速度-1", { enemyStages: { accuracy: -1, spd: -1 } }],
      ["im_invincible", "我是最強", 1, "special", 8, 84, "對能力下降敵人傷害+20%", { strongerVsDebuffed: 0.2 }],
      ["backlight", "逆光", 1, "debuff", 10, 0, "敵方攻擊、防禦-1", { enemyStages: { atk: -1, def: -1 } }],
      ["where_the_wind_blows", "風之去向", 15, "heal", 8, 0, "全隊回復15%HP", { healTeamRatio: 0.15 }],
      ["song_shield", "歌聲護幕", 25, "shield", 7, 0, "本回合全隊減傷30%", { teamShieldRatio: 0.3 }],
      ["fleeting_lullaby", "短暫搖籃曲", 35, "control", 6, 0, "敵方速度-2，骰到6睡眠1回合", { enemyStages: { spd: -2 }, statusOnSix: { sleep: 1 } }],
      ["tot_musica", "Tot Musica", 45, "special", 4, 132, "對受控或能力下降敵人傷害+25%", { strongerVsDebuffed: 0.25, strongerVsControlled: 0.25 }],
    ]) }),
    card({ id: "custom_mp3l85c1", name: "鷹眼", tier: "T1", roleType: "戰鬥型", attribute: "速", passive: "世界最強劍士", statProfile: "custom", baseStats: { hp: 118, atk: 102, def: 88, satk: 72, sdef: 84, spd: 98 }, battlePortraits: battlePortraitsFor("mihawk"), moveSet: moves("custom_mp3l85c1", "速", [
      ["black_blade_yoru", "黑刀・夜", 1, "attack", 18, 76, "基礎攻擊，無視10%防禦", { ignoreDefenseRatio: 0.1 }],
      ["keen_eye", "鷹眼看破", 1, "debuff", 10, 0, "敵方防禦、閃避-1", { enemyStages: { def: -1, evasion: -1 } }],
      ["small_blade", "小刀制敵", 1, "attack", 14, 66, "先制+1；命中後敵方命中-1", { enemyStagesOnHit: { accuracy: -1 } }, { priority: 1 }],
      ["world_slash", "世界第一斬擊", 1, "special", 8, 112, "骰到5以上無視護盾", { pierceShieldOnHighDice: true }],
      ["ship_cutter", "斬艦一閃", 15, "attack", 10, 96, "命中後敵方防禦-1", { enemyStagesOnHit: { def: -1 } }],
      ["cross_cut", "十字斬", 25, "attack", 8, 52, "骰子點數決定連擊段數", { multiHit: 1, comboAtkRatio: 0.07 }],
      ["duelist_pressure", "劍豪威壓", 35, "debuff", 6, 0, "敵方攻擊、防禦、命中-1", { enemyStages: { atk: -1, def: -1, accuracy: -1 } }],
      ["yoru_final", "夜・終斬", 45, "special", 4, 148, "對強敵傷害+20%，無視15%防禦", { bossDamageBonus: 0.2, ignoreDefenseRatio: 0.15 }],
    ]) }),
    card({ id: "custom_mp3la6fr", name: "哥爾·D·羅傑", tier: "T1", roleType: "戰鬥型", attribute: "力", passive: "海賊王的霸王色", statProfile: "custom", baseStats: { hp: 124, atk: 110, def: 90, satk: 76, sdef: 86, spd: 92 }, battlePortraits: battlePortraitsFor("roger"), moveSet: moves("custom_mp3la6fr", "力", [
      ["divine_departure", "神避", 1, "attack", 16, 92, "先制+1；骰到5以上追加25%傷害", { amplifyOnHighDice: 0.25 }, { priority: 1 }],
      ["conqueror_pressure", "霸王色威壓", 1, "debuff", 10, 0, "敵方攻擊、防禦-1", { enemyStages: { atk: -1, def: -1 } }],
      ["pirate_king_slash", "海賊王斬擊", 1, "attack", 14, 86, "命中後敵方防禦-1", { enemyStagesOnHit: { def: -1 } }],
      ["captain_command", "船長號令", 1, "buff", 8, 0, "自身攻擊+1、速度+1，下回合先手", { selfStages: { atk: 1, spd: 1 }, guaranteedFirstNextTurn: true }],
      ["grand_line_rush", "大海賊連斬", 15, "attack", 8, 54, "骰子點數決定連擊段數", { multiHit: 1, comboAtkRatio: 0.075 }],
      ["king_aura", "海賊王氣魄", 25, "buff", 6, 0, "自身攻擊+2、意志+1", { selfStages: { atk: 2, sdef: 1 } }],
      ["clash_of_kings", "王者交鋒", 35, "special", 5, 138, "對強敵傷害+20%，命中後敵方攻擊-1", { bossDamageBonus: 0.2, enemyStagesOnHit: { atk: -1 } }],
      ["final_departure", "神避・終擊", 45, "special", 3, 170, "對強敵傷害+25%，骰到5以上無視護盾", { bossDamageBonus: 0.25, pierceShieldOnHighDice: true }],
    ]) }),
  ];

  // Every formal character has an identity-led critical profile. These are the
  // level-1 rates before level, evolution, equipment, or move bonuses.
  const CHARACTER_CRITICAL_PROFILES = Object.freeze({
    luffy: { baseRate: .08, style: "野性直覺・亂戰猛攻" },
    zoro: { baseRate: .15, style: "三刀流・要害斬擊" },
    nami: { baseRate: .10, style: "天候觀測・弱點計算" },
    sanji: { baseRate: .12, style: "黑足・精準踢擊" },
    law: { baseRate: .15, style: "手術果實・精密切割" },
    robin: { baseRate: .11, style: "關節鎖定・弱點捕捉" },
    hancock: { baseRate: .12, style: "女帝體術・高速命中" },
    carrot: { baseRate: .12, style: "月兔本能・高速突襲" },
    ace: { baseRate: .08, style: "火焰果實・廣域爆發" },
    sabo: { baseRate: .13, style: "龍爪拳・破綻捕捉" },
    yamato: { baseRate: .08, style: "霸王重擊・力量壓制" },
    corazon: { baseRate: .14, style: "無聲潛行・奇襲射擊" },
    usopp: { baseRate: .18, style: "狙擊手・超遠距弱點" },
    chopper: { baseRate: .04, style: "船醫・支援變形" },
    jinbe: { baseRate: .09, style: "魚人空手道・精準發勁" },
    brook: { baseRate: .14, style: "迅捷劍術・居合突刺" },
    franky: { baseRate: .06, style: "重火器・範圍轟炸" },
    oden: { baseRate: .15, style: "御田二刀流・霸王斬擊" },
    rayleigh: { baseRate: .17, style: "冥王・見聞色捕捉" },
    garp: { baseRate: .06, style: "英雄鐵拳・純力量壓制" },
    vivi: { baseRate: .08, style: "孔雀鎖鏈・靈巧牽制" },
    koby: { baseRate: .12, style: "見聞色・精準突進" },
    smoker: { baseRate: .06, style: "白煙果實・範圍制壓" },
    tashigi: { baseRate: .14, style: "居合・要害斬擊" },
    kuzan: { baseRate: .07, style: "冰凍果實・大範圍控制" },
    fujitora: { baseRate: .14, style: "見聞色劍術・重力鎖定" },
    bartolomeo: { baseRate: .03, style: "屏障果實・防守核心" },
    cavendish: { baseRate: .16, style: "白馬・無意識殺意" },
    kinemon: { baseRate: .13, style: "狐火流・武士斬擊" },
    ivankov: { baseRate: .04, style: "荷爾蒙果實・支援戰術" },
    kuma: { baseRate: .08, style: "肉球果實・座標彈擊" },
    dragon: { baseRate: .12, style: "革命家・風暴洞察" },
    kid: { baseRate: .07, style: "磁力果實・大範圍破壞" },
    killer: { baseRate: .16, style: "殺戮武人・高速要害" },
    perona: { baseRate: .07, style: "幽靈果實・精神干擾" },
    mansherry: { baseRate: .03, style: "治癒果實・純支援" },
    whitebeard: { baseRate: .07, style: "震震果實・毀滅範圍" },
    jozu: { baseRate: .04, style: "鑽石身軀・坦克衝撞" },
    vista: { baseRate: .15, style: "花劍・精妙劍技" },
    izo: { baseRate: .17, style: "雙槍・武士狙擊" },
    little_oars_jr: { baseRate: .02, style: "魔人巨軀・鈍重橫掃" },
    squard: { baseRate: .11, style: "長劍・背刺突襲" },
    marco: { baseRate: .08, style: "不死鳥・持久近戰" },
    prison_buggy: { baseRate: .10, style: "強運小丑・意外命中" },
    prison_mr3: { baseRate: .04, style: "蠟燭果實・控制支援" },
    prison_mr2_bon_clay: { baseRate: .10, style: "人妖拳法・連續踢擊" },
    prison_mr1_daz_bones: { baseRate: .14, style: "快斬果實・全身刃" },
    prison_crocodile: { baseRate: .11, style: "沙沙果實・陰險奇襲" },
    custom_mp3l6s8w: { baseRate: .05, style: "歌歌果實・全域控制" },
    custom_mp3l85c1: { baseRate: .18, style: "世界第一劍豪・必中要害" },
    custom_mp3la6fr: { baseRate: .16, style: "海賊王・霸王色斬擊" },
  });

  const CHARACTER_CRITICAL_ROLE_FALLBACK = Object.freeze({
    "戰鬥型": { baseRate: .06, style: "戰鬥直覺" },
    "偵查型": { baseRate: .07, style: "弱點觀察" },
    "移動型": { baseRate: .06, style: "高速突襲" },
    "輔助型": { baseRate: .04, style: "支援戰術" },
  });

  function applyCharacterCriticalProfiles() {
    cards.forEach((entry) => {
      const profile = CHARACTER_CRITICAL_PROFILES[entry.id];
      const fallback = CHARACTER_CRITICAL_ROLE_FALLBACK[entry.roleType] || { baseRate: .05, style: "戰鬥直覺" };
      const customBase = Number(entry.criticalRateBase);
      const hasCustomBase = entry.criticalRateBase !== null && entry.criticalRateBase !== undefined && entry.criticalRateBase !== "" && Number.isFinite(customBase) && customBase >= 0;
      entry.criticalRateBase = profile
        ? profile.baseRate
        : hasCustomBase
          ? customBase
          : fallback.baseRate;
      entry.criticalStyle = profile?.style || entry.criticalStyle || fallback.style;
    });
  }

  const CHARACTER_EDITOR_STORAGE_KEY = "opCharacterEditorPatch";
  const EDITOR_RANK_TO_TIER = { S: "T1", A: "T2", B: "T3", C: "T4", D: "T5", E: "T6" };
  const ENIES_LOBBY_EVOLUTION_FORM_IDS = new Set([
    "luffy_gear_second",
    "zoro_santoryu_plus",
    "nami_clima_tact_plus",
    "sanji_diable_jambe",
    "chopper_rumble_ball_plus",
    "usopp_sogeking",
    "robin_cien_fleur",
    "franky_weapon_left",
    "brook_yomi_swordsman",
  ]);

  function safeJsonClone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_error) {
      return value;
    }
  }

  function readCharacterEditorPatch() {
    try {
      if (typeof window === "undefined" || !window.localStorage) return null;
      const raw = window.localStorage.getItem(CHARACTER_EDITOR_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && parsed.enabled !== false ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  function normalizeEditorTier(value) {
    const text = String(value || "").trim().toUpperCase();
    if (EDITOR_RANK_TO_TIER[text]) return EDITOR_RANK_TO_TIER[text];
    if (/^T[1-6]$/.test(text)) return text;
    return "T4";
  }

  function isEditorPlaceholderMoveName(value) {
    const text = String(value || "").trim();
    return /^新技能\d*$/.test(text) || /^進化招式\d*$/.test(text) || /^自訂招式\d*$/.test(text);
  }

  function shouldUseCatalogDesign(rawMoves, catalogMoves) {
    if (!Array.isArray(catalogMoves) || !catalogMoves.length) return false;
    if (!Array.isArray(rawMoves) || !rawMoves.length) return true;
    return rawMoves.every((entry) => isEditorPlaceholderMoveName(entry?.name));
  }

  function shouldUseCatalogEvolutionDesign(rawMoves, formId, catalogMoves) {
    if (shouldUseCatalogDesign(rawMoves, catalogMoves)) return true;
    if (!Array.isArray(catalogMoves) || !catalogMoves.length || !Array.isArray(rawMoves) || !rawMoves.length) return false;
    return rawMoves.every((entry) => String(entry?.id || "").startsWith(`${formId}_move_`));
  }

  function normalizeEditorMove(entry, characterId, attribute, index) {
    const raw = entry && typeof entry === "object" ? entry : {};
    const category = raw.category || raw.type || "attack";
    return move({
      ...safeJsonClone(raw),
      id: raw.id || `${characterId}_custom_${index + 1}`,
      name: raw.name || `自訂招式${index + 1}`,
      type: category,
      category,
      attribute: raw.attribute || attribute || "無",
      effects: raw.effects && typeof raw.effects === "object" && !Array.isArray(raw.effects) ? safeJsonClone(raw.effects) : {},
    });
  }

  function normalizeEditorCard(raw, catalogCard = null) {
    if (!raw || typeof raw !== "object" || raw.enabled === false) return null;
    const id = String(raw.id || "").trim();
    if (!id) return null;
    const useCatalogDesign = shouldUseCatalogDesign(raw.moveSet, catalogCard?.moveSet);
    const source = useCatalogDesign ? catalogCard : null;
    const tier = normalizeEditorTier(raw.tier || raw.rank || source?.tier);
    const roleType = raw.roleType || raw.typeRole || source?.roleType || "戰鬥型";
    const attribute = raw.attribute || source?.attribute || "力";
    const sourceMoves = useCatalogDesign ? source.moveSet : raw.moveSet;
    const rawPassive = String(raw.passive || "").trim();
    const moveSet = Array.isArray(sourceMoves)
      ? sourceMoves.map((entry, index) => normalizeEditorMove(entry, id, attribute, index))
      : [];
    const normalized = card({
      ...safeJsonClone(raw),
      id,
      name: String(raw.name || source?.name || id).trim(),
      tier,
      roleType,
      attribute,
      passive: (!rawPassive || rawPassive === "自訂被動") && source?.passive ? source.passive : (rawPassive || ROLE_PASSIVE[roleType] || ""),
      statProfile: source?.statProfile || raw.statProfile || (raw.baseStats ? "custom" : "standard"),
      baseStats: source?.baseStats || raw.baseStats,
      growthRate: source?.growthRate || raw.growthRate,
      moveSet,
      battlePortraits: normalizePortraitFolderPaths(raw.battlePortraits || source?.battlePortraits),
    });
    normalized.editorCustom = true;
    return normalized;
  }

  function applyCharacterEditorCardOverrides() {
    const patch = readCharacterEditorPatch();
    if (!patch || !Array.isArray(patch.cards)) return;
    const removed = new Set((patch.disabledCardIds || []).map((id) => String(id)));
    for (let index = cards.length - 1; index >= 0; index -= 1) {
      if (removed.has(cards[index]?.id)) cards.splice(index, 1);
    }
    patch.cards.forEach((raw) => {
      const catalogCard = cards.find((entry) => entry.id === String(raw?.id || "").trim());
      const nextCard = normalizeEditorCard(raw, catalogCard);
      if (!nextCard) return;
      const existingIndex = cards.findIndex((entry) => entry.id === nextCard.id);
      if (existingIndex >= 0) cards.splice(existingIndex, 1, nextCard);
      else cards.push(nextCard);
    });
  }

  applyCharacterEditorCardOverrides();
  applyCharacterCriticalProfiles();

  const byId = Object.fromEntries(cards.map((entry) => [entry.id, entry]));
  const byTier = cards.reduce((acc, entry) => {
    acc[entry.tier] = acc[entry.tier] || [];
    acc[entry.tier].push(entry);
    return acc;
  }, {});

  const evolutionForms = {
    luffy_gear_second: {
      id: "luffy_gear_second",
      characterId: "luffy",
      name: "二檔魯夫",
      displayName: "二檔魯夫",
      stage: 1,
      requiredLevel: 20,
      materialCost: [{ itemId: "pierced_flag", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("luffy_gear_second"),
      summary: "速度與攻擊提升，解鎖高速 JET 系招式。",
      statMultiplier: { hp: 1.08, atk: 1.16, def: 1.04, satk: 1.08, sdef: 1.04, spd: 1.14 },
      passiveText: "二檔加速：戰鬥能力提升，但不改變角色基礎數值。",
      moveSet: formMoves("力", [
        ["luffy_jet_pistol", "JET手槍", 1, "attack", 10, 98, "先制+1；若速度高於敵人傷害+10%", { strongerIfFaster: 0.1 }, { priority: 1 }],
        ["luffy_jet_whip", "JET鞭", 1, "attack", 10, 86, "先制+1；命中後敵方速度-1", { enemyStagesOnHit: { spd: -1 } }, { priority: 1 }],
        ["luffy_jet_bazooka", "JET火箭砲", 1, "attack", 8, 108, "骰到5以上追加20傷害；若速度高於敵人傷害+10%", { bonusOnHighDice: 20, strongerIfFaster: 0.1 }],
        ["luffy_jet_gatling", "JET機關槍", 1, "attack", 7, 48, "骰子點數決定連擊段數", { multiHit: 1, comboAtkRatio: 0.075 }],
        ["luffy_gigant_pistol", "巨人槍", 28, "special", 6, 116, "威力高，使用後自身速度-1", { selfStagesAfterUse: { spd: -1 } }],
        ["luffy_gigant_bazooka", "巨人火箭砲", 36, "special", 4, 132, "骰到5以上無視護盾；使用後自身速度-1", { pierceShieldOnHighDice: true, selfStagesAfterUse: { spd: -1 } }],
      ]),
      defaultMoveIds: ["luffy_jet_pistol", "luffy_jet_whip", "luffy_jet_bazooka", "luffy_jet_gatling"],
      nextEvolutionHint: "第二次進化預留：時間跳躍後形態。",
    },
    zoro_santoryu_plus: {
      id: "zoro_santoryu_plus",
      characterId: "zoro",
      name: "司法島索隆",
      displayName: "司法島索隆",
      stage: 1,
      requiredLevel: 20,
      materialCost: [{ itemId: "pierced_flag", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("zoro_santoryu_plus"),
      summary: "阿修羅前置修行。攻擊與防禦提升，斬擊更容易破防。",
      statMultiplier: { hp: 1.06, atk: 1.14, def: 1.08, satk: 1.02, sdef: 1.05, spd: 1.04 },
      passiveText: "三刀流強化：攻防提升，為阿修羅形態鋪路。",
      moveSet: formMoves("力", [
        ["zoro_enbima_onigiri", "艷美魔夜不眠鬼斬", 1, "attack", 10, 90, "命中後敵方防禦-1", { enemyStagesOnHit: { def: -1 } }],
        ["zoro_rashomon", "羅生門", 1, "attack", 8, 100, "無視15%防禦", { ignoreDefenseRatio: 0.15 }],
        ["zoro_pound108_evolved", "百八煩惱鳳", 1, "attack", 8, 104, "骰到5以上追加20傷害", { bonusOnHighDice: 20 }],
        ["zoro_ashura_ichibugin", "阿修羅 壹霧銀", 1, "special", 6, 125, "無視護盾與15%防禦；使用後自身速度-1", { pierceShield: true, ignoreDefenseRatio: 0.15, selfStagesAfterUse: { spd: -1 } }],
        ["zoro_hiryu_kaen", "飛龍火焰", 30, "attack", 6, 112, "骰到6灼傷；對能力下降敵人傷害+15%", { statusOnSix: { burn: 2 }, strongerVsDebuffed: 0.15 }],
        ["zoro_yasha_garasu", "夜叉鴉", 38, "special", 5, 56, "骰子點數決定連擊段數；命中後敵方防禦-1", { multiHit: 1, comboAtkRatio: 0.065, enemyStagesOnHit: { def: -1 } }],
      ]),
      defaultMoveIds: ["zoro_enbima_onigiri", "zoro_rashomon", "zoro_pound108_evolved", "zoro_ashura_ichibugin"],
      nextEvolutionHint: "第二次進化預留：時間跳躍後阿修羅完成形態。",
    },
    nami_clima_tact_plus: {
      id: "nami_clima_tact_plus",
      characterId: "nami",
      name: "司法島娜美",
      displayName: "司法島娜美",
      stage: 1,
      requiredLevel: 20,
      materialCost: [{ itemId: "pierced_flag", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("nami_clima_tact_plus"),
      summary: "天候棒輸出與干擾能力提升，強化雷電與氣泡系招式。",
      statMultiplier: { hp: 1.04, atk: 1.04, def: 1.04, satk: 1.16, sdef: 1.08, spd: 1.08 },
      passiveText: "天候棒強化：天候攻擊與控場能力提升。",
      moveSet: formMoves("技", [
        ["nami_mirage_tempo_fata_morgana", "幻象天候・海市蜃樓", 1, "debuff", 12, 0, "敵方命中-1、閃避-1", { enemyStages: { accuracy: -1, evasion: -1 } }],
        ["nami_cool_charge", "冷氣泡", 1, "control", 12, 0, "敵方速度-1；骰到6冰凍", { enemyStages: { spd: -1 }, statusOnSix: { freeze: 1 } }],
        ["nami_thunder_lance_tempo", "雷光槍天候", 1, "special", 8, 96, "骰到6麻痺；命中後敵方命中-1", { statusOnSix: { paralyze: 2 }, enemyStagesOnHit: { accuracy: -1 } }],
        ["nami_thunderbolt_tempo_plus", "雷電天候・強化", 1, "attack", 8, 102, "骰到5以上追加20傷害；骰到6麻痺", { bonusOnHighDice: 20, statusOnSix: { paralyze: 2 } }],
        ["nami_cyclone_tempo_plus", "龍捲風天候・強化", 28, "control", 8, 0, "敵方速度-2、命中-1", { enemyStages: { spd: -2, accuracy: -1 } }],
        ["nami_black_cloud_tempo", "雷雨天候", 36, "special", 5, 116, "命中後敵方命中-1、速度-1；骰到6麻痺", { enemyStagesOnHit: { accuracy: -1, spd: -1 }, statusOnSix: { paralyze: 2 } }],
      ]),
      defaultMoveIds: ["nami_mirage_tempo_fata_morgana", "nami_cool_charge", "nami_thunder_lance_tempo", "nami_thunderbolt_tempo_plus"],
      nextEvolutionHint: "第二次進化預留：時間跳躍後魔法天候棒。",
    },
    sanji_diable_jambe: {
      id: "sanji_diable_jambe",
      characterId: "sanji",
      name: "司法島香吉士",
      displayName: "司法島香吉士",
      stage: 1,
      requiredLevel: 20,
      materialCost: [{ itemId: "pierced_flag", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("sanji_diable_jambe"),
      summary: "速度與踢擊威力提升，攻擊附帶灼熱壓制。",
      statMultiplier: { hp: 1.05, atk: 1.12, def: 1.04, satk: 1.08, sdef: 1.04, spd: 1.16 },
      passiveText: "惡魔風腳：高速踢擊強化，以先手、破防與速度壓制打出節奏。",
      moveSet: formMoves("速", [
        ["sanji_black_leg_step", "黑足步法", 1, "buff", 10, 0, "自身速度+2、閃避+1；下回合先手", { selfStages: { spd: 2, evasion: 1 }, guaranteedFirstNextTurn: true }],
        ["sanji_diable_shot", "首肉SHOT", 1, "attack", 10, 94, "先制+1；速度高於敵人時傷害+10%", { strongerIfFaster: 0.1 }, { priority: 1 }],
        ["sanji_diable_mouton", "羊肉SHOT", 1, "attack", 9, 104, "命中後敵方防禦-1；骰到6灼傷", { enemyStagesOnHit: { def: -1 }, statusOnSix: { burn: 2 } }],
        ["sanji_diable_concasse", "串燒踢", 1, "attack", 9, 92, "命中後敵方速度-1；骰到5以上傷害+20%", { enemyStagesOnHit: { spd: -1 }, amplifyOnHighDice: 0.2 }],
        ["sanji_diable_premier_hachis", "一級絞肉", 30, "attack", 7, 46, "骰子點數決定連踢段數；骰到5以上敵方防禦-1", { multiHit: 1, comboAtkRatio: 0.068, enemyStagesOnHighDice: { def: -1 } }],
        ["sanji_flambage_shot", "畫龍點睛SHOT", 36, "attack", 6, 118, "骰到5以上無視護盾；速度高於敵人時傷害+15%", { pierceShieldOnHighDice: true, strongerIfFaster: 0.15 }],
        ["sanji_diable_anti_manner", "反禮儀踢擊套餐", 44, "attack", 5, 132, "命中後敵方防禦-1；骰到6灼傷", { enemyStagesOnHit: { def: -1 }, statusOnSix: { burn: 2 } }],
      ]),
      defaultMoveIds: ["sanji_black_leg_step", "sanji_diable_shot", "sanji_diable_mouton", "sanji_diable_concasse"],
      nextEvolutionHint: "第二次進化預留：時間跳躍後空中步行與地獄回憶路線。",
    },
    chopper_rumble_ball_plus: {
      id: "chopper_rumble_ball_plus",
      characterId: "chopper",
      name: "人獸形喬巴",
      displayName: "人獸形喬巴",
      stage: 1,
      requiredLevel: 20,
      materialCost: [{ itemId: "pierced_flag", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("chopper_rumble_ball_plus"),
      summary: "藍波球形態控制更穩，耐久與攻擊同步提升。",
      statMultiplier: { hp: 1.1, atk: 1.08, def: 1.12, satk: 1.08, sdef: 1.1, spd: 1.04 },
      passiveText: "藍波球強化：形態穩定度提升，攻守更平均。",
      moveSet: formMoves("速", [
        ["chopper_scope_diagnosis", "診斷・弱點看破", 1, "debuff", 12, 0, "敵方防禦-1、命中-1", { enemyStages: { def: -1, accuracy: -1 } }],
        ["chopper_arm_point_roseo", "腕力強化・刻蹄櫻", 1, "attack", 10, 90, "骰到5以上攻擊+1", { selfStagesOnHighDice: { atk: 1 } }],
        ["chopper_horn_point_roseo", "角強化・角砲", 1, "attack", 9, 100, "骰到5以上敵方防禦-1", { enemyStagesOnHighDice: { def: -1 } }],
        ["chopper_guard_point_plus", "毛皮強化・守護點", 1, "shield", 7, 0, "本回合減傷55%", { shieldRatio: 0.55 }],
        ["chopper_rumble_impact", "藍波球 重量衝擊", 28, "attack", 8, 92, "骰到5以上追加15傷害並自身防禦+1", { bonusOnHighDice: 15, selfStagesOnHighDice: { def: 1 } }],
        ["chopper_monster_point", "怪物強化", 38, "special", 4, 135, "高風險爆發；使用後自身防禦-1、速度-1", { selfStagesAfterUse: { def: -1, spd: -1 } }],
      ]),
      defaultMoveIds: ["chopper_scope_diagnosis", "chopper_arm_point_roseo", "chopper_horn_point_roseo", "chopper_guard_point_plus"],
      nextEvolutionHint: "第二次進化預留：時間跳躍後藍波球控制完成形態。",
    },
    usopp_sogeking: {
      id: "usopp_sogeking",
      characterId: "usopp",
      name: "狙擊王",
      displayName: "狙擊王",
      stage: 1,
      requiredLevel: 20,
      materialCost: [{ itemId: "pierced_flag", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("usopp_sogeking"),
      summary: "狙擊能力大幅提升，遠程火力與速度更穩定。",
      statMultiplier: { hp: 1.05, atk: 1.08, def: 1.03, satk: 1.14, sdef: 1.06, spd: 1.1 },
      passiveText: "狙擊王：射擊節奏穩定，火力更集中。",
      moveSet: formMoves("技", [
        ["usopp_kabuto_lead_star", "兜・鉛星", 1, "attack", 14, 75, "命中較穩定", {}, { accuracy: 105 }],
        ["usopp_firebird_star", "火鳥星", 1, "attack", 8, 95, "骰到5以上追加20傷害；骰到6灼傷", { bonusOnHighDice: 20, statusOnSix: { burn: 2 } }, { accuracy: 105 }],
        ["usopp_smoke_star_plus", "煙星・掩護射擊", 1, "debuff", 12, 0, "敵方命中-1、速度-1", { enemyStages: { accuracy: -1, spd: -1 } }],
        ["usopp_salt_star", "鹽星", 1, "control", 10, 0, "敵方攻擊-1；命中-1", { enemyStages: { atk: -1, accuracy: -1 } }],
        ["usopp_atlas_comet", "必殺・阿特拉斯彗星", 30, "special", 6, 112, "骰到5以上追加20傷害；命中後敵方防禦-1", { bonusOnHighDice: 20, enemyStagesOnHit: { def: -1 } }, { accuracy: 95 }],
        ["usopp_flame_star_barrage", "火藥星連彈", 38, "attack", 6, 48, "骰子點數決定連擊段數；骰到6灼傷", { multiHit: 1, comboAtkRatio: 0.065, statusOnSix: { burn: 2 } }, { accuracy: 95 }],
      ]),
      defaultMoveIds: ["usopp_kabuto_lead_star", "usopp_firebird_star", "usopp_smoke_star_plus", "usopp_salt_star"],
      nextEvolutionHint: "第二次進化預留：時間跳躍後植物星與新武器路線。",
    },
    robin_cien_fleur: {
      id: "robin_cien_fleur",
      characterId: "robin",
      name: "新世界羅賓",
      displayName: "新世界羅賓",
      stage: 1,
      requiredLevel: 20,
      materialCost: [{ itemId: "new_world_newspaper_3d2y", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("robin_cien_fleur"),
      summary: "花花果實的束縛與破防能力提升，擅長把敵人拉進不利節奏。",
      statMultiplier: { hp: 1.05, atk: 1.04, def: 1.06, satk: 1.14, sdef: 1.1, spd: 1.08 },
      passiveText: "百花繚亂強化：控場與能力下降效果更穩定，適合削弱強敵。",
      moveSet: formMoves("技", [
        ["robin_cien_fleur_clutch", "百花繚亂・大飛燕草", 1, "attack", 9, 94, "命中後敵方防禦-1、速度-1", { enemyStagesOnHit: { def: -1, spd: -1 } }],
        ["robin_cien_fleur_wing", "百花繚亂・翼", 1, "shield", 8, 0, "本回合減傷40%，自身速度+1", { shieldRatio: 0.4, selfStages: { spd: 1 } }],
        ["robin_cien_fleur_spider_net", "百花繚亂・蜘蛛之花", 1, "control", 10, 0, "敵方速度-2、命中-1", { enemyStages: { spd: -2, accuracy: -1 } }],
        ["robin_ochoenta_fleur_cuatro_mano", "八十輪花・四本樹", 1, "attack", 8, 102, "命中後敵方攻擊-1；對能力下降敵人傷害+15%", { enemyStagesOnHit: { atk: -1 }, strongerVsDebuffed: 0.15 }],
        ["robin_cien_fleur_big_tree", "百花繚亂・大樹", 30, "special", 6, 118, "命中後敵方攻擊、防禦各-1", { enemyStagesOnHit: { atk: -1, def: -1 } }],
        ["robin_cien_fleur_grab", "百花繚亂・萬花束縛", 38, "control", 5, 0, "敵方速度-2、閃避-1，並封鎖強化", { enemyStages: { spd: -2, evasion: -1 }, blockEnemyBuff: 1 }],
      ]),
      defaultMoveIds: ["robin_cien_fleur_clutch", "robin_cien_fleur_wing", "robin_cien_fleur_spider_net", "robin_ochoenta_fleur_cuatro_mano"],
      nextEvolutionHint: "第二次進化預留：時間跳躍後巨人花與惡魔形態路線。",
    },
    franky_weapon_left: {
      id: "franky_weapon_left",
      characterId: "franky",
      name: "佛朗基將軍",
      displayName: "佛朗基將軍",
      stage: 1,
      requiredLevel: 20,
      materialCost: [{ itemId: "new_world_newspaper_3d2y", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("franky_weapon_left"),
      summary: "改造人兵器火力提升，兼具重拳、砲擊與短連打。",
      statMultiplier: { hp: 1.1, atk: 1.12, def: 1.12, satk: 1.06, sdef: 1.06, spd: 1.03 },
      passiveText: "改造人火力強化：輸出與防禦提升，速度成長較少。",
      moveSet: formMoves("力", [
        ["franky_strong_right_plus", "強壯右手・強化", 1, "attack", 10, 96, "命中後敵方防禦-1", { enemyStagesOnHit: { def: -1 } }],
        ["franky_weapons_left", "兵器左手", 1, "attack", 9, 100, "骰到5以上追加20傷害", { bonusOnHighDice: 20 }],
        ["franky_coup_de_vent_plus", "風來砲・強化", 1, "special", 8, 112, "骰到5以上敵方速度-1；無視10%防禦", { enemyStagesOnHighDice: { spd: -1 }, ignoreDefenseRatio: 0.1 }],
        ["franky_franky_boxing", "佛朗基拳擊", 1, "attack", 7, 46, "骰子點數決定連擊段數", { multiHit: 1, comboAtkRatio: 0.07 }],
        ["franky_fresh_fire", "清新火焰", 30, "attack", 7, 105, "骰到6灼傷；對灼傷敵人傷害+15%", { statusOnSix: { burn: 2 }, strongerVsStatus: { burn: 0.15 } }],
        ["franky_ultimate_hammer", "終極鐵鎚", 38, "special", 5, 128, "威力高；使用後自身速度-1", { selfStagesAfterUse: { spd: -1 } }],
      ]),
      defaultMoveIds: ["franky_strong_right_plus", "franky_weapons_left", "franky_coup_de_vent_plus", "franky_franky_boxing"],
      nextEvolutionHint: "第二次進化預留：時間跳躍後佛朗基將軍與雷射兵器路線。",
    },
    brook_yomi_swordsman: {
      id: "brook_yomi_swordsman",
      characterId: "brook",
      name: "靈魂之王布魯克",
      displayName: "靈魂之王布魯克",
      stage: 1,
      requiredLevel: 20,
      materialCost: [{ itemId: "new_world_newspaper_3d2y", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("brook_yomi_swordsman"),
      summary: "黃泉冷氣與劍術融合，擅長先制、降速與冰凍牽制。",
      statMultiplier: { hp: 1.04, atk: 1.1, def: 1.04, satk: 1.1, sdef: 1.08, spd: 1.14 },
      passiveText: "黃泉劍士：速度提升，利用冷氣和音樂干擾敵人。",
      moveSet: formMoves("速", [
        ["brook_hanauta_sanchou_yahazu_giri", "鼻歌三丁・箭尾斬", 1, "attack", 10, 92, "先制+1；命中後敵方速度-1", { enemyStagesOnHit: { spd: -1 } }, { priority: 1 }],
        ["brook_soul_solid_prelude", "鼻歌三丁・序曲", 1, "attack", 9, 96, "骰到6冰凍；命中後敵方攻擊-1", { statusOnSix: { freeze: 1 }, enemyStagesOnHit: { atk: -1 } }],
        ["brook_lullaby_parry", "催眠曲・防守", 1, "control", 10, 0, "敵方命中-1、速度-1；骰到6束縛", { enemyStages: { accuracy: -1, spd: -1 }, statusOnSix: { bind: 1 } }],
        ["brook_aubade_coup_droit", "黎明歌・突刺", 1, "attack", 8, 104, "若速度高於敵人傷害+15%", { strongerIfFaster: 0.15 }],
        ["brook_polonaise_frost", "波蘭舞曲・冰斬", 30, "special", 6, 116, "骰到5以上敵方速度-1；骰到6冰凍", { enemyStagesOnHighDice: { spd: -1 }, statusOnSix: { freeze: 1 } }],
        ["brook_ectoplasm_soul", "鎮魂曲・黃泉壓迫", 38, "special", 5, 0, "敵方攻擊-2、命中-1，並封鎖強化", { enemyStages: { atk: -2, accuracy: -1 }, blockEnemyBuff: 1 }],
      ]),
      defaultMoveIds: ["brook_hanauta_sanchou_yahazu_giri", "brook_soul_solid_prelude", "brook_lullaby_parry", "brook_aubade_coup_droit"],
      nextEvolutionHint: "第二次進化預留：時間跳躍後靈魂之王路線。",
    },
    carrot_moon_lion: {
      id: "carrot_moon_lion",
      characterId: "carrot",
      name: "凱洛特月獅型態",
      displayName: "凱洛特月獅型態",
      stage: 1,
      requiredLevel: 40,
      materialCost: [{ itemId: "new_world_newspaper_3d2y", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("carrot_moon_lion"),
      summary: "月獅型態讓速度、爆發與電氣壓制大幅提升，擅長先手連擊。",
      statMultiplier: { hp: 1.12, atk: 1.2, def: 1.08, satk: 1.1, sdef: 1.08, spd: 1.3 },
      passiveText: "月獅型態：速度大幅提升，先手、閃避與麻痺壓制更強。",
      moveSet: formMoves("速", [
        ["carrot_moon_flash", "月獅閃爪", 1, "attack", 8, 132, "先制+1；速度高於敵人時傷害+20%", { strongerIfFaster: 0.2 }, { priority: 1 }],
        ["carrot_electro_luna", "月電亂爪", 1, "attack", 7, 56, "骰子點數決定連擊段數；骰到5以上麻痺", { multiHit: 1, comboAtkRatio: 0.075, statusOnHighDice: { paralyze: 1 } }],
        ["carrot_sulong_instinct", "月獅本能", 1, "buff", 6, 0, "自身攻擊+1、速度+2、閃避+1，下回合先手", { selfStages: { atk: 1, spd: 2, evasion: 1 }, guaranteedFirstNextTurn: true }],
        ["carrot_lunar_pounce", "月夜突襲", 1, "special", 5, 152, "命中後敵方防禦、速度-1；對強敵傷害+15%", { enemyStagesOnHit: { def: -1, spd: -1 }, bossDamageBonus: 0.15 }],
        ["carrot_fullmoon_roar", "滿月咆哮", 50, "debuff", 5, 0, "敵方命中、速度、閃避-1", { enemyStages: { accuracy: -1, spd: -1, evasion: -1 } }],
        ["carrot_sulong_final_claw", "月獅終爪", 60, "special", 3, 176, "先制+1；骰到5以上無視護盾", { pierceShieldOnHighDice: true }, { priority: 1 }],
      ]),
      defaultMoveIds: ["carrot_moon_flash", "carrot_electro_luna", "carrot_sulong_instinct", "carrot_lunar_pounce"],
    },
    luffy_evolution_2: {
      id: "luffy_evolution_2",
      characterId: "luffy",
      name: "四檔",
      displayName: "蒙其·D·魯夫（四檔）",
      stage: 2,
      requiredLevel: 40,
      materialCost: [{ itemId: "new_world_newspaper_3d2y", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("luffy_evolution_2"),
      summary: "新世界篇章形態。爆發、先手與破盾能力大幅提升。",
      statMultiplier: { hp: 1.18, atk: 1.3, def: 1.12, satk: 1.1, sdef: 1.08, spd: 1.18 },
      passiveText: "四檔：攻擊與速度大幅提升，重擊招式使用後會略降速度。",
      moveSet: formMoves("力", [
        ["luffy_g4_kong_gun", "猿王槍", 1, "attack", 8, 140, "骰到5以上無視護盾；使用後速度-1", { pierceShieldOnHighDice: true, selfStagesAfterUse: { spd: -1 } }],
        ["luffy_g4_rhino_schneider", "犀牛榴彈砲", 1, "attack", 7, 128, "先制+1；命中後敵方防禦-1", { enemyStagesOnHit: { def: -1 } }, { priority: 1 }],
        ["luffy_g4_python", "大蛇砲", 1, "attack", 7, 58, "骰子點數決定連擊段數；速度高於敵人時傷害+15%", { multiHit: 1, comboAtkRatio: 0.075, strongerIfFaster: 0.15 }],
        ["luffy_g4_elastic_guard", "坦克人", 1, "shield", 6, 0, "本回合減傷55%，反彈少量傷害", { shieldRatio: 0.55, reflectRatio: 0.1 }],
        ["luffy_g4_leo_bazooka", "獅子火箭砲", 50, "special", 5, 158, "骰到5以上傷害+25%；使用後速度-1", { amplifyOnHighDice: 0.25, selfStagesAfterUse: { spd: -1 } }],
        ["luffy_g4_king_kong_gun", "大猿王槍", 60, "special", 3, 190, "對強敵傷害+25%，無視20%防禦；使用後防禦-1", { bossDamageBonus: 0.25, ignoreDefenseRatio: 0.2, selfStagesAfterUse: { def: -1 } }],
      ]),
      defaultMoveIds: ["luffy_g4_kong_gun", "luffy_g4_rhino_schneider", "luffy_g4_python", "luffy_g4_elastic_guard"],
    },
    luffy_gear_fifth: {
      id: "luffy_gear_fifth",
      characterId: "luffy",
      name: "五檔・尼卡",
      displayName: "蒙其·D·魯夫（五檔・尼卡）",
      stage: 3,
      requiredLevel: 51,
      materialCost: [],
      consumeMaterials: false,
      specialAwakening: true,
      battlePortraits: evolutionBattlePortraitsFor("luffy_gear_fifth"),
      summary: "特殊覺醒：四檔魯夫 Lv.51 以上，對 S 級以上敵人瀕死時自動進化、復活並續戰。",
      statMultiplier: { hp: 1.28, atk: 1.42, def: 1.18, satk: 1.16, sdef: 1.18, spd: 1.34 },
      passiveText: "解放之鼓：此形態只能在強敵戰被打倒時覺醒。覺醒後復活並繼續戰鬥。",
      moveSet: formMoves("力", [
        ["luffy_g5_dawn_pistol", "黎明手槍", 1, "attack", 9, 168, "先制+1；骰到5以上傷害+25%", { amplifyOnHighDice: 0.25 }, { priority: 1 }],
        ["luffy_g5_booming_white", "白色彈跳", 1, "buff", 7, 0, "自身速度+2、防禦+1，回復最大 HP 10%", { selfStages: { spd: 2, def: 1 }, healRatio: 0.1 }],
        ["luffy_g5_gigant", "巨人化", 1, "attack", 6, 150, "命中後敵方攻擊-1；自身防禦+1", { enemyStagesOnHit: { atk: -1 }, selfStagesAfterUse: { def: 1 } }],
        ["luffy_g5_dawn_rocket", "黎明火箭", 1, "attack", 7, 62, "骰子點數決定連擊段數；速度高於敵人傷害+20%", { multiHit: 1, comboAtkRatio: 0.085, strongerIfFaster: 0.2 }],
        ["luffy_g5_bajrang_gun", "猿神槍", 58, "special", 3, 230, "對強敵傷害+30%，無視25%防禦；使用後速度-1", { bossDamageBonus: 0.3, ignoreDefenseRatio: 0.25, selfStagesAfterUse: { spd: -1 } }],
        ["luffy_g5_laughing_drum", "解放之鼓", 64, "buff", 4, 0, "全隊回復最大 HP 8%；自身攻擊、速度+1", { healTeamRatio: 0.08, selfStages: { atk: 1, spd: 1 } }],
      ]),
      defaultMoveIds: ["luffy_g5_dawn_pistol", "luffy_g5_booming_white", "luffy_g5_gigant", "luffy_g5_dawn_rocket"],
    },
    zoro_evolution_2: {
      id: "zoro_evolution_2",
      characterId: "zoro",
      name: "新世界索隆",
      displayName: "新世界索隆",
      stage: 2,
      requiredLevel: 40,
      materialCost: [{ itemId: "new_world_newspaper_3d2y", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("zoro_evolution_2"),
      summary: "新世界篇章形態。斬擊威力與破防能力提升，穩定壓制強敵。",
      statMultiplier: { hp: 1.16, atk: 1.28, def: 1.16, satk: 1.04, sdef: 1.1, spd: 1.1 },
      passiveText: "新世界三刀流：攻防提升，對防禦下降敵人斬擊更重。",
      moveSet: formMoves("技", [
        ["zoro_rengoku_onigiri", "煉獄鬼斬", 1, "attack", 8, 132, "命中後敵方防禦-1", { enemyStagesOnHit: { def: -1 } }],
        ["zoro_kokujou_o_tatsumaki", "黑繩大龍卷", 1, "attack", 7, 118, "骰到5以上敵方速度-1；對能力下降敵人傷害+15%", { enemyStagesOnHighDice: { spd: -1 }, strongerVsDebuffed: 0.15 }],
        ["zoro_shi_shishi_sonson", "死・獅子歌歌", 1, "special", 6, 148, "無視20%防禦", { ignoreDefenseRatio: 0.2 }],
        ["zoro_ichidai_sanzen_daisen_sekai", "一大三千大千世界", 1, "special", 5, 166, "對強敵傷害+20%；骰到5以上無視護盾", { bossDamageBonus: 0.2, pierceShieldOnHighDice: true }],
        ["zoro_rokudo_no_tsuji", "六道之辻", 50, "attack", 6, 62, "骰子點數決定連擊段數；命中後敵方防禦-1", { multiHit: 1, comboAtkRatio: 0.075, enemyStagesOnHit: { def: -1 } }],
        ["zoro_ashura_bakkei", "阿修羅拔劍・亡者戲", 60, "special", 3, 188, "對強敵傷害+25%，無視護盾與15%防禦", { bossDamageBonus: 0.25, pierceShield: true, ignoreDefenseRatio: 0.15 }],
      ]),
      defaultMoveIds: ["zoro_rengoku_onigiri", "zoro_kokujou_o_tatsumaki", "zoro_shi_shishi_sonson", "zoro_ichidai_sanzen_daisen_sekai"],
    },
    zoro_zorojuro: {
      id: "zoro_zorojuro",
      characterId: "zoro",
      name: "索隆十郎",
      displayName: "索隆十郎",
      stage: 3,
      requiredLevel: 40,
      materialCost: [{ itemId: "enma", quantity: 1 }],
      consumeMaterials: false,
      specialAwakening: true,
      battlePortraits: evolutionBattlePortraitsFor("zoro_zorojuro"),
      summary: "特殊進化：新世界索隆攜帶閻魔實際參戰並贏得一場非切磋戰鬥後，永久進化為索隆十郎。",
      statMultiplier: { hp: 1.22, atk: 1.43, def: 1.2, satk: 1.08, sdef: 1.16, spd: 1.18 },
      passiveText: "閻魔霸氣：駕馭會強行抽取霸氣的閻魔，斬擊、破防與暴擊能力大幅提升。",
      moveSet: formMoves("技", [
        ["zoro_enma_rengoku_onigiri", "閻魔・煉獄鬼斬", 1, "attack", 8, 154, "12%暴擊；命中後敵方防禦-1", { critRateBonus: 0.12, enemyStagesOnHit: { def: -1 } }, { damageClass: "physical" }],
        ["zoro_enma_hiryu_kaen", "閻魔・飛龍火焰", 1, "attack", 6, 168, "15%暴擊；無視20%防禦，骰到5以上灼傷", { critRateBonus: 0.15, ignoreDefenseRatio: 0.2, statusOnHighDice: { burn: 2 } }, { damageClass: "physical" }],
        ["zoro_king_of_hell_santoryu", "閻王三刀流", 1, "attack", 6, 72, "8%暴擊；骰子點數決定連擊段數，命中後敵方防禦-1", { critRateBonus: 0.08, multiHit: 1, comboAtkRatio: 0.085, enemyStagesOnHit: { def: -1 } }, { damageClass: "physical" }],
        ["zoro_103_mercies_dragon_damnation", "一百三情飛龍侍極", 1, "special", 3, 210, "15%暴擊；對強敵傷害+25%、無視25%防禦與護盾，使用後失去最大 HP 6%", { critRateBonus: 0.15, bossDamageBonus: 0.25, ignoreDefenseRatio: 0.25, pierceShield: true, selfHpCostRatio: 0.06 }, { damageClass: "physical" }],
      ]),
      defaultMoveIds: ["zoro_enma_rengoku_onigiri", "zoro_enma_hiryu_kaen", "zoro_king_of_hell_santoryu", "zoro_103_mercies_dragon_damnation"],
    },
    nami_evolution_2: {
      id: "nami_evolution_2",
      characterId: "nami",
      name: "新世界娜美",
      displayName: "新世界娜美",
      stage: 2,
      requiredLevel: 40,
      materialCost: [{ itemId: "new_world_newspaper_3d2y", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("nami_evolution_2"),
      summary: "新世界篇章形態。魔法天候棒讓干擾、雷電與全隊支援更穩。",
      statMultiplier: { hp: 1.1, atk: 1.06, def: 1.08, satk: 1.28, sdef: 1.16, spd: 1.16 },
      passiveText: "魔法天候棒：雷電傷害與控場命中提升。",
      moveSet: formMoves("技", [
        ["nami_sorcery_clima_tact", "魔法天候棒", 1, "buff", 8, 0, "自身戰術+2、速度+1", { selfStages: { satk: 2, spd: 1 } }],
        ["nami_gust_sword", "突風劍", 1, "attack", 8, 112, "先制+1；命中後敵方速度-1", { enemyStagesOnHit: { spd: -1 } }, { priority: 1 }],
        ["nami_thunder_cloud_rod", "雷雲棒", 1, "special", 6, 126, "骰到6麻痺；對能力下降敵人傷害+15%", { statusOnSix: { paralyze: 2 }, strongerVsDebuffed: 0.15 }],
        ["nami_thunder_breed_tempo", "雷霆天候", 1, "special", 5, 144, "命中後敵方命中-1、速度-1；骰到6麻痺", { enemyStagesOnHit: { accuracy: -1, spd: -1 }, statusOnSix: { paralyze: 2 } }],
        ["nami_weather_egg", "天候蛋", 50, "control", 5, 0, "敵方防禦、速度、命中-1", { enemyStages: { def: -1, spd: -1, accuracy: -1 } }],
        ["nami_zeus_thunderbolt", "宙斯雷雲", 60, "special", 3, 168, "對強敵傷害+20%，骰到5以上麻痺", { bossDamageBonus: 0.2, statusOnHighDice: { paralyze: 2 } }],
      ]),
      defaultMoveIds: ["nami_sorcery_clima_tact", "nami_gust_sword", "nami_thunder_cloud_rod", "nami_thunder_breed_tempo"],
    },
    sanji_evolution_2: {
      id: "sanji_evolution_2",
      characterId: "sanji",
      name: "新世界香吉士",
      displayName: "新世界香吉士",
      stage: 2,
      requiredLevel: 40,
      materialCost: [{ itemId: "new_world_newspaper_3d2y", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("sanji_evolution_2"),
      summary: "新世界篇章形態。空中步行與高溫踢擊讓先手、速度與爆發更強。",
      statMultiplier: { hp: 1.12, atk: 1.24, def: 1.1, satk: 1.08, sdef: 1.1, spd: 1.28 },
      passiveText: "新世界黑足：速度大幅提升，速度高於敵人時傷害更高。",
      moveSet: formMoves("速", [
        ["sanji_sky_walk", "空中步行", 1, "buff", 8, 0, "自身速度+2、閃避+1，下回合先手", { selfStages: { spd: 2, evasion: 1 }, guaranteedFirstNextTurn: true }],
        ["sanji_bien_cuit_grill_shot", "熟燒・燒烤SHOT", 1, "attack", 8, 128, "先制+1；骰到6灼傷", { statusOnSix: { burn: 2 } }, { priority: 1 }],
        ["sanji_poele_a_frire_spectrum", "燒鐵鍋光譜", 1, "attack", 6, 58, "骰子點數決定連擊段數；命中後敵方防禦-1", { multiHit: 1, comboAtkRatio: 0.075, enemyStagesOnHit: { def: -1 } }],
        ["sanji_hell_memories", "地獄回憶", 1, "special", 5, 156, "對強敵傷害+20%，骰到5以上灼傷", { bossDamageBonus: 0.2, statusOnHighDice: { burn: 2 } }],
        ["sanji_blue_walk", "海步行", 50, "buff", 5, 0, "速度+2、攻擊+1，解除自身速度下降", { selfStages: { spd: 2, atk: 1 }, cleanseSelfStatDown: ["spd"] }],
        ["sanji_mouton_shot_nw", "羊肉SHOT・新世界", 60, "special", 3, 176, "先制+1；速度高於敵人時傷害+25%", { strongerIfFaster: 0.25 }, { priority: 1 }],
      ]),
      defaultMoveIds: ["sanji_sky_walk", "sanji_bien_cuit_grill_shot", "sanji_poele_a_frire_spectrum", "sanji_hell_memories"],
    },
    usopp_evolution_2: {
      id: "usopp_evolution_2",
      characterId: "usopp",
      name: "新世界騙人布",
      displayName: "新世界騙人布",
      stage: 2,
      requiredLevel: 40,
      materialCost: [{ itemId: "new_world_newspaper_3d2y", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("usopp_evolution_2"),
      summary: "新世界篇章形態。黑兜與植物星讓狙擊、控場與生存能力更穩。",
      statMultiplier: { hp: 1.1, atk: 1.12, def: 1.08, satk: 1.28, sdef: 1.1, spd: 1.2 },
      passiveText: "新世界狙擊手：特殊輸出與命中干擾提升，對能力下降敵人傷害更高。",
      moveSet: formMoves("技", [
        ["usopp_nw_kuro_kabuto", "黑兜狙擊", 1, "attack", 8, 118, "命中較穩定；命中後敵方命中-1", { enemyStagesOnHit: { accuracy: -1 } }, { accuracy: 110 }],
        ["usopp_nw_green_star_devils", "綠星・惡魔", 1, "control", 8, 0, "敵方速度-2、閃避-1", { enemyStages: { spd: -2, evasion: -1 } }],
        ["usopp_nw_bamboo_javelin", "綠星・竹林槍", 1, "special", 6, 134, "對能力下降敵人傷害+20%；骰到5以上束縛", { strongerVsDebuffed: 0.2, statusOnHighDice: { bind: 1 } }],
        ["usopp_nw_observation_shot", "見聞色狙擊", 1, "buff", 6, 0, "自身命中+2、速度+1，下回合先手", { selfStages: { accuracy: 2, spd: 1 }, guaranteedFirstNextTurn: true }],
        ["usopp_nw_pop_green_wolf", "綠星・狼草", 50, "attack", 6, 62, "骰子點數決定連擊段數；骰到6恐懼", { multiHit: 1, comboAtkRatio: 0.07, statusOnSix: { fear: 1 } }],
        ["usopp_nw_special_bagworm", "必殺・蓑蟲星", 60, "special", 3, 166, "命中後敵方防禦、命中-1；對強敵傷害+15%", { enemyStagesOnHit: { def: -1, accuracy: -1 }, bossDamageBonus: 0.15 }],
      ]),
      defaultMoveIds: ["usopp_nw_kuro_kabuto", "usopp_nw_green_star_devils", "usopp_nw_bamboo_javelin", "usopp_nw_observation_shot"],
    },
    chopper_evolution_2: {
      id: "chopper_evolution_2",
      characterId: "chopper",
      name: "新世界喬巴",
      displayName: "新世界喬巴",
      stage: 2,
      requiredLevel: 40,
      materialCost: [{ itemId: "new_world_newspaper_3d2y", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("chopper_evolution_2"),
      summary: "新世界篇章形態。藍波球控制完成，兼具診斷、治療與怪物強化爆發。",
      statMultiplier: { hp: 1.18, atk: 1.14, def: 1.16, satk: 1.14, sdef: 1.16, spd: 1.1 },
      passiveText: "新世界船醫：耐久與支援能力提升，怪物強化更穩定。",
      moveSet: formMoves("技", [
        ["chopper_nw_heavy_gong", "重量強化・重拳", 1, "attack", 8, 140, "骰到5以上自身攻擊+1；命中後敵方防禦-1", { selfStagesOnHighDice: { atk: 1 }, enemyStagesOnHit: { def: -1 } }],
        ["chopper_nw_guard_point", "毛皮強化・防禦點", 1, "shield", 7, 0, "本回合減傷60%，自身防禦+1", { shieldRatio: 0.6, selfStages: { def: 1 } }],
        ["chopper_nw_scope_cure", "診斷治療", 1, "heal", 8, 0, "回復隊伍最低血量角色28%HP並解除異常", { healLowestAllyRatio: 0.28, cleanseTeam: true }],
        ["chopper_nw_kung_fu_point", "柔力強化・連打", 1, "attack", 7, 54, "骰子點數決定連擊段數；骰到5以上敵方攻擊-1", { multiHit: 1, comboAtkRatio: 0.068, enemyStagesOnHighDice: { atk: -1 } }],
        ["chopper_nw_monster_control", "怪物強化・掌控", 50, "special", 5, 152, "高威力；使用後自身防禦+1、速度-1", { selfStagesAfterUse: { def: 1, spd: -1 } }],
        ["chopper_nw_emergency_doctor", "船醫緊急處置", 60, "heal", 3, 0, "全隊回復18%HP，並解除一個異常", { healTeamRatio: 0.18, cleanseTeam: true }],
      ]),
      defaultMoveIds: ["chopper_nw_heavy_gong", "chopper_nw_guard_point", "chopper_nw_scope_cure", "chopper_nw_kung_fu_point"],
    },
    law_new_world: {
      id: "law_new_world",
      characterId: "law",
      name: "新世界 羅",
      displayName: "新世界 羅",
      stage: 1,
      requiredLevel: 40,
      materialCost: [{ itemId: "new_world_newspaper_3d2y", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("law_new_world"),
      summary: "新世界篇章形態。ROOM 操作、破防與隊伍支援能力全面提升。",
      statMultiplier: { hp: 1.14, atk: 1.16, def: 1.12, satk: 1.24, sdef: 1.14, spd: 1.16 },
      passiveText: "新世界手術師：破防、控場與緊急支援更穩定。",
      moveSet: formMoves("技", [
        ["law_nw_room_cut", "ROOM・斬斷", 1, "attack", 8, 126, "無視15%防禦；命中後敵方防禦-1", { ignoreDefenseRatio: 0.15, enemyStagesOnHit: { def: -1 } }],
        ["law_nw_shambles_command", "屠宰場・指揮轉移", 1, "control", 8, 0, "敵方速度、防禦-1", { enemyStages: { spd: -1, def: -1 } }],
        ["law_nw_counter_shock", "反射衝擊", 1, "special", 6, 136, "骰到5以上麻痺；對能力下降敵人傷害+15%", { statusOnHighDice: { paralyze: 1 }, strongerVsDebuffed: 0.15 }],
        ["law_nw_gamma_knife", "伽馬刀", 1, "special", 5, 154, "對高血量敵人傷害+25%，無視15%防禦", { highHpDamageBonus: 0.25, ignoreDefenseRatio: 0.15 }],
        ["law_nw_surgery", "新世界手術", 50, "heal", 5, 0, "回復隊伍最低血量角色28%HP並解除異常", { healLowestAllyRatio: 0.28, cleanseTeam: true }],
        ["law_nw_puncture_wille", "穿刺波動", 60, "special", 3, 176, "對強敵傷害+20%，骰到5以上無視護盾", { bossDamageBonus: 0.2, pierceShieldOnHighDice: true }],
      ]),
      defaultMoveIds: ["law_nw_room_cut", "law_nw_shambles_command", "law_nw_counter_shock", "law_nw_gamma_knife"],
    },
    smoker_new_world: {
      id: "smoker_new_world",
      characterId: "smoker",
      name: "新世界斯摩格",
      displayName: "新世界斯摩格",
      stage: 1,
      requiredLevel: 40,
      materialCost: [{ itemId: "new_world_newspaper_3d2y", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("smoker_new_world"),
      summary: "新世界篇章形態。白煙拘束、海樓石壓制與防禦能力提升。",
      statMultiplier: { hp: 1.16, atk: 1.18, def: 1.16, satk: 1.1, sdef: 1.12, spd: 1.14 },
      passiveText: "新世界白煙：壓制、拘束與防守節奏提升。",
      moveSet: formMoves("技", [
        ["smoker_nw_white_launcher", "白色發射器", 1, "attack", 8, 124, "先制+1；命中後敵方速度-1", { enemyStagesOnHit: { spd: -1 } }, { priority: 1 }],
        ["smoker_nw_smoke_bind", "白煙拘束・新世界", 1, "control", 8, 0, "敵方速度、命中-1", { enemyStages: { spd: -1, accuracy: -1 } }],
        ["smoker_nw_jitte_seastone", "海樓石十手・新世界", 1, "attack", 7, 136, "對強敵傷害+15%，命中後敵方防禦-1", { bossDamageBonus: 0.15, enemyStagesOnHit: { def: -1 } }],
        ["smoker_nw_white_guard", "白煙防壁", 1, "shield", 6, 0, "本回合減傷55%，自身防禦+1", { shieldRatio: 0.55, selfStages: { def: 1 } }],
        ["smoker_nw_white_press", "白煙制壓・新世界", 50, "special", 5, 152, "命中後敵方攻擊、防禦、速度-1", { enemyStagesOnHit: { atk: -1, def: -1, spd: -1 } }],
        ["smoker_nw_g5_justice", "G-5正義", 60, "buff", 3, 0, "自身攻擊、防禦、速度+1，下回合先手", { selfStages: { atk: 1, def: 1, spd: 1 }, guaranteedFirstNextTurn: true }],
      ]),
      defaultMoveIds: ["smoker_nw_white_launcher", "smoker_nw_smoke_bind", "smoker_nw_jitte_seastone", "smoker_nw_white_guard"],
    },
    tashigi_new_world: {
      id: "tashigi_new_world",
      characterId: "tashigi",
      name: "新世界達斯琪",
      displayName: "新世界達斯琪",
      stage: 1,
      requiredLevel: 40,
      materialCost: [{ itemId: "new_world_newspaper_3d2y", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("tashigi_new_world"),
      summary: "新世界篇章形態。居合速度、名刀看破與海軍劍術提升。",
      statMultiplier: { hp: 1.1, atk: 1.2, def: 1.1, satk: 1.08, sdef: 1.1, spd: 1.24 },
      passiveText: "新世界劍士：速度、斬擊與看破能力提升。",
      moveSet: formMoves("技", [
        ["tashigi_nw_shigure_flash", "時雨一閃", 1, "attack", 8, 112, "先制+1；命中後敵方命中-1", { enemyStagesOnHit: { accuracy: -1 } }, { priority: 1 }],
        ["tashigi_nw_soru_iaido", "剃步居合", 1, "buff", 7, 0, "自身速度+2、攻擊+1、閃避+1", { selfStages: { spd: 2, atk: 1, evasion: 1 } }],
        ["tashigi_nw_meito_discern", "名刀看破・新世界", 1, "debuff", 8, 0, "敵方防禦、閃避-1", { enemyStages: { def: -1, evasion: -1 } }],
        ["tashigi_nw_cross_cut", "十字斬・新世界", 1, "attack", 7, 128, "無視15%防禦；骰到5以上敵方防禦-1", { ignoreDefenseRatio: 0.15, enemyStagesOnHighDice: { def: -1 } }],
        ["tashigi_nw_justice_combo", "正義連斬", 50, "attack", 6, 54, "骰子點數決定連擊段數；速度高於敵人時傷害+15%", { multiHit: 1, comboAtkRatio: 0.07, strongerIfFaster: 0.15 }],
        ["tashigi_nw_seastone_slash", "海樓石斬", 60, "special", 3, 156, "對強敵傷害+15%，骰到5以上無視護盾", { bossDamageBonus: 0.15, pierceShieldOnHighDice: true }],
      ]),
      defaultMoveIds: ["tashigi_nw_shigure_flash", "tashigi_nw_soru_iaido", "tashigi_nw_meito_discern", "tashigi_nw_cross_cut"],
    },
    kid_new_world: {
      id: "kid_new_world",
      characterId: "kid",
      name: "新世界基德",
      displayName: "新世界基德",
      stage: 1,
      requiredLevel: 40,
      materialCost: [{ itemId: "new_world_newspaper_3d2y", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("kid_new_world"),
      summary: "新世界篇章形態。磁氣武裝、重壓與電磁砲爆發提升。",
      statMultiplier: { hp: 1.18, atk: 1.28, def: 1.16, satk: 1.08, sdef: 1.1, spd: 1.1 },
      passiveText: "新世界磁氣：攻擊、破防與強敵輸出提升。",
      moveSet: formMoves("力", [
        ["kid_nw_punk_rotten", "磁氣魔人", 1, "buff", 7, 0, "自身攻擊+2、防禦+1", { selfStages: { atk: 2, def: 1 } }],
        ["kid_nw_assign", "賦磁", 1, "control", 8, 0, "敵方防禦、速度-1", { enemyStages: { def: -1, spd: -1 } }],
        ["kid_nw_punk_gibson", "龐克吉布森", 1, "attack", 8, 136, "命中後敵方防禦-1；對護盾敵人傷害+20%", { enemyStagesOnHit: { def: -1 }, strongerIfShieldedTarget: 0.2 }],
        ["kid_nw_magnetic_clash", "磁氣重壓", 1, "shield", 6, 0, "本回合減傷55%，反彈少量傷害", { shieldRatio: 0.55, reflectRatio: 0.12 }],
        ["kid_nw_corna_dio", "磁氣大魔牛", 50, "special", 5, 164, "對強敵傷害+20%，命中後敵方攻擊-1", { bossDamageBonus: 0.2, enemyStagesOnHit: { atk: -1 } }],
        ["kid_nw_damned_punk", "電磁砲", 60, "special", 3, 186, "無視20%防禦；骰到5以上無視護盾", { ignoreDefenseRatio: 0.2, pierceShieldOnHighDice: true }],
      ]),
      defaultMoveIds: ["kid_nw_punk_rotten", "kid_nw_assign", "kid_nw_punk_gibson", "kid_nw_magnetic_clash"],
    },
    perona_new_world: {
      id: "perona_new_world",
      characterId: "perona",
      name: "新世界佩羅娜",
      displayName: "新世界佩羅娜",
      stage: 1,
      requiredLevel: 40,
      materialCost: [{ itemId: "new_world_newspaper_3d2y", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("perona_new_world"),
      summary: "新世界篇章形態。幽靈控場、消極削弱與特殊爆發提升。",
      statMultiplier: { hp: 1.12, atk: 1.08, def: 1.12, satk: 1.24, sdef: 1.16, spd: 1.16 },
      passiveText: "新世界幽靈公主：消極削弱與控場能力提升。",
      moveSet: formMoves("技", [
        ["perona_nw_negative_hollow", "消極幽靈・新世界", 1, "debuff", 8, 0, "敵方攻擊、防禦、速度-1", { enemyStages: { atk: -1, def: -1, spd: -1 } }],
        ["perona_nw_mini_hollow_swarm", "迷你幽靈群", 1, "attack", 8, 112, "命中後敵方命中、閃避-1", { enemyStagesOnHit: { accuracy: -1, evasion: -1 } }],
        ["perona_nw_ghost_network", "幽靈網", 1, "control", 8, 0, "敵方速度、閃避-1，並封鎖強化", { enemyStages: { spd: -1, evasion: -1 }, blockEnemyBuff: 1 }],
        ["perona_nw_astral_body", "靈體脫離・新世界", 1, "buff", 7, 0, "自身閃避+2、速度+1、戰術+1", { selfStages: { evasion: 2, spd: 1, satk: 1 } }],
        ["perona_nw_mega_hollow", "特大幽靈炸彈・新世界", 50, "special", 5, 148, "對能力下降敵人傷害+25%；骰到5以上敵方攻擊-1", { strongerVsDebuffed: 0.25, enemyStagesOnHighDice: { atk: -1 } }],
        ["perona_nw_negative_princess", "幽靈公主壓制", 60, "control", 3, 0, "敵方攻擊、戰術、命中-2", { enemyStages: { atk: -2, satk: -2, accuracy: -2 } }],
      ]),
      defaultMoveIds: ["perona_nw_negative_hollow", "perona_nw_mini_hollow_swarm", "perona_nw_ghost_network", "perona_nw_astral_body"],
    },
    rayleigh_young: {
      id: "rayleigh_young",
      characterId: "rayleigh",
      name: "年輕雷利",
      displayName: "年輕雷利",
      stage: 1,
      requiredLevel: 50,
      materialCost: [{ itemId: "prime_vivre_card", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("rayleigh_young"),
      summary: "年輕時期的冥王。霸氣、先制與破盾能力全面提升。",
      statMultiplier: { hp: 1.16, atk: 1.24, def: 1.14, satk: 1.08, sdef: 1.16, spd: 1.22 },
      passiveText: "冥王全盛：命中與閃避節奏提升，對強敵具備穩定破盾能力。",
      moveSet: formMoves("技", [
        ["rayleigh_young_haki_slash", "冥王霸氣斬", 1, "attack", 8, 138, "先制+1；骰到5以上無視護盾", { pierceShieldOnHighDice: true }, { priority: 1 }],
        ["rayleigh_young_future_read", "冥王預判・全盛", 1, "buff", 6, 0, "自身命中+1、閃避+2、速度+1", { selfStages: { accuracy: 1, evasion: 2, spd: 1 } }],
        ["rayleigh_young_conqueror", "霸王色震懾・全盛", 1, "debuff", 6, 0, "敵方攻擊、防禦、速度-1", { enemyStages: { atk: -1, def: -1, spd: -1 } }],
        ["rayleigh_young_dark_king_flash", "冥王一閃・全盛", 1, "special", 4, 168, "必中；無視20%防禦", { ignoreDefenseRatio: 0.2 }, { accuracy: 999 }],
      ]),
      defaultMoveIds: ["rayleigh_young_haki_slash", "rayleigh_young_future_read", "rayleigh_young_conqueror", "rayleigh_young_dark_king_flash"],
    },
    koby_colonel: {
      id: "koby_colonel",
      characterId: "koby",
      name: "上校克比",
      displayName: "上校克比",
      stage: 1,
      requiredLevel: 40,
      materialCost: [{ itemId: "new_world_newspaper_3d2y", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("koby_colonel"),
      summary: "上校時期的克比。六式、見聞色與高速正義突擊強化。",
      statMultiplier: { hp: 1.12, atk: 1.18, def: 1.12, satk: 1.08, sdef: 1.12, spd: 1.24 },
      passiveText: "正義成長：速度與命中提升，對被削弱敵人能打出更高輸出。",
      moveSet: formMoves("速", [
        ["koby_colonel_soru_punch", "剃步突拳", 1, "attack", 9, 118, "先制+1；命中後敵方命中-1", { enemyStagesOnHit: { accuracy: -1 } }, { priority: 1 }],
        ["koby_colonel_observation", "見聞色觀測", 1, "buff", 8, 0, "自身速度+2、閃避+1、命中+1", { selfStages: { spd: 2, evasion: 1, accuracy: 1 } }],
        ["koby_colonel_justice_guard", "正義防衛", 1, "shield", 7, 0, "本回合減傷50%，自身防禦+1", { shieldRatio: 0.5, selfStages: { def: 1 } }],
        ["koby_colonel_honesty_impact", "誠實衝擊", 1, "special", 5, 142, "對能力下降敵人傷害+25%；骰到5以上敵方防禦-1", { strongerVsDebuffed: 0.25, enemyStagesOnHighDice: { def: -1 } }],
      ]),
      defaultMoveIds: ["koby_colonel_soru_punch", "koby_colonel_observation", "koby_colonel_justice_guard", "koby_colonel_honesty_impact"],
    },
    whitebeard_evolution_1: {
      id: "whitebeard_evolution_1",
      characterId: "whitebeard",
      name: "愛德華·紐蓋特",
      displayName: "愛德華·紐蓋特",
      stage: 1,
      requiredLevel: 50,
      materialCost: [{ itemId: "prime_vivre_card", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("whitebeard_evolution_1"),
      summary: "震震果實與薙刀輸出全面強化，Boss 戰破防能力極高。",
      statMultiplier: { hp: 1.18, atk: 1.26, def: 1.16, satk: 1.12, sdef: 1.14, spd: 1.04 },
      passiveText: "震震全開：破防與強敵傷害提升。",
      moveSet: formMoves("力", [
        ["whitebeard_full_quake_fist", "震動拳・全開", 1, "attack", 8, 138, "命中後敵方防禦-1；對強敵傷害+15%", { enemyStagesOnHit: { def: -1 }, bossDamageBonus: 0.15 }],
        ["whitebeard_seaquake_surge", "海震奔流", 1, "special", 6, 148, "骰到5以上敵方速度-1，無視10%防禦", { enemyStagesOnHighDice: { spd: -1 }, ignoreDefenseRatio: 0.1 }],
        ["whitebeard_airquake_break", "空震破碎", 1, "special", 5, 164, "骰到5以上無視護盾", { pierceShieldOnHighDice: true }],
        ["whitebeard_bisento_conqueror", "薙刀霸纏", 1, "attack", 5, 172, "對強敵傷害+25%；使用後速度-1", { bossDamageBonus: 0.25, selfStagesAfterUse: { spd: -1 } }],
      ]),
      defaultMoveIds: ["whitebeard_full_quake_fist", "whitebeard_seaquake_surge", "whitebeard_airquake_break", "whitebeard_bisento_conqueror"],
    },
    kuzan_evolution_1: {
      id: "kuzan_evolution_1",
      characterId: "kuzan",
      name: "10號船長庫山",
      displayName: "10號船長庫山",
      stage: 1,
      requiredLevel: 50,
      materialCost: [{ itemId: "new_world_newspaper_3d2y", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("kuzan_evolution_1"),
      summary: "加入黑鬍子海賊團後的庫山。冰凍控場、減速與防禦能力提升。",
      statMultiplier: { hp: 1.14, atk: 1.16, def: 1.14, satk: 1.1, sdef: 1.12, spd: 1.18 },
      passiveText: "十號船長：冰冷系傷害與控場穩定度提升。",
      moveSet: formMoves("速", [
        ["kuzan_blackbeard_ice_glove", "冰塊拳", 1, "attack", 8, 132, "骰到5以上敵方速度-1；骰到6冰凍", { enemyStagesOnHighDice: { spd: -1 }, statusOnSix: { freeze: 1 } }],
        ["kuzan_blackbeard_ice_age_small", "冰河時代小型", 1, "control", 8, 0, "敵方速度-2、命中-1", { enemyStages: { spd: -2, accuracy: -1 } }],
        ["kuzan_blackbeard_ice_wall", "冰壁", 1, "shield", 6, 0, "本回合減傷55%，自身防禦+1", { shieldRatio: 0.55, selfStages: { def: 1 } }],
        ["kuzan_blackbeard_ice_spear", "冰矛", 1, "special", 6, 142, "對速度下降敵人傷害+20%；骰到6冰凍", { strongerVsDebuffed: 0.2, statusOnSix: { freeze: 1 } }],
        ["kuzan_blackbeard_partisan", "冰塊兩棘矛", 55, "special", 5, 156, "命中後敵方防禦、速度-1", { enemyStagesOnHit: { def: -1, spd: -1 } }],
        ["kuzan_blackbeard_ice_time", "冰時刻", 65, "control", 4, 0, "敵方速度-2，骰到5以上冰凍1回合", { enemyStages: { spd: -2 }, statusOnHighDice: { freeze: 1 } }],
      ]),
      defaultMoveIds: ["kuzan_blackbeard_ice_glove", "kuzan_blackbeard_ice_age_small", "kuzan_blackbeard_ice_wall", "kuzan_blackbeard_ice_spear"],
    },
    custom_mp3l85c1_evolution_1: {
      id: "custom_mp3l85c1_evolution_1",
      characterId: "custom_mp3l85c1",
      name: "新世界鷹眼",
      displayName: "新世界鷹眼",
      stage: 1,
      requiredLevel: 40,
      materialCost: [{ itemId: "new_world_newspaper_3d2y", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("mihawk_evolution_1"),
      summary: "世界最強劍士形態，斬擊破防與 Boss 戰輸出提升。",
      statMultiplier: { hp: 1.12, atk: 1.24, def: 1.12, satk: 1.04, sdef: 1.1, spd: 1.18 },
      passiveText: "黑刀・夜：斬擊威力、命中與破防提升。",
      moveSet: formMoves("速", [
        ["mihawk_yoru_true_slash", "夜・真斬", 1, "attack", 8, 136, "無視15%防禦；命中後敵方防禦-1", { ignoreDefenseRatio: 0.15, enemyStagesOnHit: { def: -1 } }],
        ["mihawk_worlds_strongest_slash", "世界最強斬擊", 1, "special", 6, 154, "骰到5以上無視護盾；對強敵傷害+15%", { pierceShieldOnHighDice: true, bossDamageBonus: 0.15 }],
        ["mihawk_duel_stance", "劍豪決鬥", 1, "buff", 6, 0, "自身攻擊+2、命中+1", { selfStages: { atk: 2, accuracy: 1 } }],
        ["mihawk_final_black_blade", "黑刀終幕", 1, "special", 3, 180, "對強敵傷害+25%，無視20%防禦", { bossDamageBonus: 0.25, ignoreDefenseRatio: 0.2 }],
      ]),
      defaultMoveIds: ["mihawk_yoru_true_slash", "mihawk_worlds_strongest_slash", "mihawk_duel_stance", "mihawk_final_black_blade"],
    },
    custom_mp3la6fr_evolution_1: {
      id: "custom_mp3la6fr_evolution_1",
      characterId: "custom_mp3la6fr",
      name: "年輕羅傑",
      displayName: "年輕羅傑",
      stage: 1,
      requiredLevel: 50,
      materialCost: [{ itemId: "prime_vivre_card", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("roger_evolution_1"),
      summary: "海賊王形態。霸王色壓制與神避爆發達到最高峰。",
      statMultiplier: { hp: 1.18, atk: 1.28, def: 1.16, satk: 1.08, sdef: 1.14, spd: 1.16 },
      passiveText: "海賊王：上場壓制敵人，對強敵輸出提升。",
      moveSet: formMoves("力", [
        ["roger_true_divine_departure", "神避・霸纏", 1, "attack", 8, 148, "先制+1；骰到5以上無視護盾", { pierceShieldOnHighDice: true }, { priority: 1 }],
        ["roger_conqueror_burst", "霸王色爆發", 1, "debuff", 6, 0, "敵方攻擊、防禦、速度-1", { enemyStages: { atk: -1, def: -1, spd: -1 } }],
        ["roger_pirate_king_command", "海賊王號令", 1, "buff", 6, 0, "自身攻擊+2、速度+1，下回合先手", { selfStages: { atk: 2, spd: 1 }, guaranteedFirstNextTurn: true }],
        ["roger_final_divine_departure", "最後神避", 1, "special", 3, 198, "對強敵傷害+30%，無視20%防禦", { bossDamageBonus: 0.3, ignoreDefenseRatio: 0.2 }],
      ]),
      defaultMoveIds: ["roger_true_divine_departure", "roger_conqueror_burst", "roger_pirate_king_command", "roger_final_divine_departure"],
    },
    prison_buggy_escape_alliance: {
      id: "prison_buggy_escape_alliance",
      characterId: "prison_buggy",
      name: "四皇巴奇",
      displayName: "四皇巴奇",
      stage: 1,
      requiredLevel: 20,
      materialCost: [{ itemId: "new_world_newspaper_3d2y", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("prison_buggy_escape_alliance"),
      summary: "越獄後的小丑生存術，速度與干擾能力提升。",
      statMultiplier: { hp: 1.08, atk: 1.08, def: 1.05, satk: 1.12, sdef: 1.06, spd: 1.14 },
      passiveText: "越獄同盟：命中干擾與逃脫節奏更穩。",
      moveSet: formMoves("技", [
        ["prison_buggy_split_counter", "四分五裂反擊", 1, "attack", 10, 82, "命中後敵方命中-1", { enemyStagesOnHit: { accuracy: -1 } }],
        ["prison_buggy_muggy_ball", "特製巴其玉", 1, "special", 8, 96, "骰到5以上追加20傷害", { bonusOnHighDice: 20 }],
        ["prison_buggy_escape_smoke", "小丑煙幕逃脫", 1, "buff", 8, 0, "自身速度+2、閃避+1", { selfStages: { spd: 2, evasion: 1 } }],
        ["prison_buggy_clown_combo", "小丑連段", 1, "attack", 7, 44, "骰子點數決定連擊段數", { multiHit: 1, comboAtkRatio: 0.06 }],
      ]),
      defaultMoveIds: ["prison_buggy_split_counter", "prison_buggy_muggy_ball", "prison_buggy_escape_smoke", "prison_buggy_clown_combo"],
      nextEvolutionHint: "第二次進化預留。",
    },
    prison_mr3_candle_strategist: {
      id: "prison_mr3_candle_strategist",
      characterId: "prison_mr3",
      name: "新世界Mr.3",
      displayName: "新世界Mr.3",
      stage: 1,
      requiredLevel: 20,
      materialCost: [{ itemId: "new_world_newspaper_3d2y", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("prison_mr3_candle_strategist"),
      summary: "強化蠟燭防禦與束縛能力，適合保護隊伍。",
      statMultiplier: { hp: 1.1, atk: 1.03, def: 1.12, satk: 1.12, sdef: 1.12, spd: 1.04 },
      passiveText: "蠟燭參謀：減傷與控場穩定度提高。",
      moveSet: formMoves("技", [
        ["prison_mr3_candle_champion", "蠟燭冠軍", 1, "shield", 8, 0, "本回合減傷50%，自身防禦+1", { shieldRatio: 0.5, selfStages: { def: 1 } }],
        ["prison_mr3_candle_lock_plus", "蠟燭束縛・強化", 1, "control", 10, 0, "敵方速度-2、命中-1", { enemyStages: { spd: -2, accuracy: -1 } }],
        ["prison_mr3_candle_harpoon", "蠟燭長槍亂刺", 1, "attack", 8, 90, "命中後敵方防禦-1", { enemyStagesOnHit: { def: -1 } }],
        ["prison_mr3_candle_service_set", "蠟燭服務套裝", 1, "buff", 8, 0, "自身防禦+1、意志+1", { selfStages: { def: 1, sdef: 1 } }],
      ]),
      defaultMoveIds: ["prison_mr3_candle_champion", "prison_mr3_candle_lock_plus", "prison_mr3_candle_harpoon", "prison_mr3_candle_service_set"],
      nextEvolutionHint: "第二次進化預留。",
    },
    prison_mr1_steel_blade: {
      id: "prison_mr1_steel_blade",
      characterId: "prison_mr1_daz_bones",
      name: "新世界Mr.1",
      displayName: "新世界Mr.1",
      stage: 1,
      requiredLevel: 20,
      materialCost: [{ itemId: "new_world_newspaper_3d2y", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("prison_mr1_steel_blade"),
      summary: "攻防同步提升，斬擊破防能力更強。",
      statMultiplier: { hp: 1.12, atk: 1.16, def: 1.14, satk: 1.04, sdef: 1.1, spd: 1.04 },
      passiveText: "新世界Mr.1：高防禦與破防斬擊。",
      moveSet: formMoves("力", [
        ["prison_mr1_sparkling_daisy_plus", "微塵斬・強化", 1, "attack", 9, 112, "無視15%防禦", { ignoreDefenseRatio: 0.15 }],
        ["prison_mr1_spiral_hollow", "發泡雛菊斬・旋", 1, "attack", 7, 58, "骰子點數決定連擊段數；骰到5以上流血2回合", { multiHit: 1, comboAtkRatio: 0.065, statusOnHighDice: "bleed", duration: 2 }],
        ["prison_mr1_steel_guard", "鋼刃防壁", 1, "shield", 7, 0, "本回合減傷50%，反彈少量傷害", { shieldRatio: 0.5, reflectRatio: 0.1 }],
        ["prison_mr1_atomic_edge", "斬人刀刃", 1, "special", 5, 128, "命中後敵方防禦-1；無視10%防禦", { enemyStagesOnHit: { def: -1 }, ignoreDefenseRatio: 0.1 }],
      ]),
      defaultMoveIds: ["prison_mr1_sparkling_daisy_plus", "prison_mr1_spiral_hollow", "prison_mr1_steel_guard", "prison_mr1_atomic_edge"],
      nextEvolutionHint: "第二次進化預留。",
    },
    prison_crocodile_desert_alliance: {
      id: "prison_crocodile_desert_alliance",
      characterId: "prison_crocodile",
      name: "新世界克洛克達爾",
      displayName: "新世界克洛克達爾",
      stage: 1,
      requiredLevel: 20,
      materialCost: [{ itemId: "new_world_newspaper_3d2y", quantity: 1 }],
      consumeMaterials: true,
      battlePortraits: evolutionBattlePortraitsFor("prison_crocodile_desert_alliance"),
      summary: "沙沙果實壓制力提升，擅長削弱與高威力特殊攻擊。",
      statMultiplier: { hp: 1.1, atk: 1.1, def: 1.08, satk: 1.18, sdef: 1.12, spd: 1.08 },
      passiveText: "沙漠同盟：特殊輸出與降防壓制提升。",
      moveSet: formMoves("技", [
        ["prison_crocodile_desert_spada", "沙漠寶刀・改", 1, "special", 8, 116, "命中後敵方防禦-1、速度-1", { enemyStagesOnHit: { def: -1, spd: -1 } }],
        ["prison_crocodile_sables_pressure", "沙嵐壓迫", 1, "debuff", 9, 0, "敵方命中-1、速度-2", { enemyStages: { accuracy: -1, spd: -2 } }],
        ["prison_crocodile_ground_secco", "侵蝕輪迴・地乾", 1, "special", 5, 156, "對能力下降敵人傷害+20%", { strongerVsDebuffed: 0.2 }],
        ["prison_crocodile_desert_la_spada", "沙漠金剛寶刀", 1, "attack", 6, 124, "無視10%防禦；骰到6流血2回合", { ignoreDefenseRatio: 0.1, statusOnSix: { bleed: 2 } }],
      ]),
      defaultMoveIds: ["prison_crocodile_desert_spada", "prison_crocodile_sables_pressure", "prison_crocodile_ground_secco", "prison_crocodile_desert_la_spada"],
      nextEvolutionHint: "第二次進化預留。",
    },
  };

  function normalizeEditorMaterialCosts(raw) {
    if (Array.isArray(raw?.materialCost)) {
      return raw.materialCost
        .map((cost) => ({
          itemId: String(cost?.itemId || "").trim(),
          quantity: Math.max(1, Math.round(Number(cost?.quantity || 1))),
        }))
        .filter((cost) => cost.itemId);
    }
    const itemId = String(raw?.evolutionItemId || raw?.itemId || "").trim();
    if (!itemId) return [];
    return [{ itemId, quantity: Math.max(1, Math.round(Number(raw?.evolutionItemQty || raw?.quantity || 1))) }];
  }

  function canonicalEvolutionMaterialCost(formId, raw, catalogForm) {
    if (catalogForm?.materialCost) return safeJsonClone(catalogForm.materialCost);
    const editorCosts = normalizeEditorMaterialCosts(raw);
    if (editorCosts.length) return editorCosts;
    if (!ENIES_LOBBY_EVOLUTION_FORM_IDS.has(formId)) {
      return [{ itemId: "new_world_newspaper_3d2y", quantity: 1 }];
    }
    return [];
  }

  function canonicalEvolutionConsumesMaterials(formId, raw, catalogForm) {
    if (!ENIES_LOBBY_EVOLUTION_FORM_IDS.has(formId)) return true;
    return catalogForm ? catalogForm.consumeMaterials !== false : raw.consumeMaterials !== false;
  }

  function normalizeEditorEvolutionForm(raw, catalogForm = null) {
    if (!raw || typeof raw !== "object" || raw.enabled === false) return null;
    const id = String(raw.id || "").trim();
    const characterId = String(raw.characterId || "").trim();
    if (!id || !characterId) return null;
    const useCatalogDesign = shouldUseCatalogEvolutionDesign(raw.moveSet, id, catalogForm?.moveSet);
    const source = useCatalogDesign ? catalogForm : null;
    const attribute = raw.attribute || cards.find((entry) => entry.id === characterId)?.attribute || "無";
    const sourceMoves = useCatalogDesign ? source.moveSet : raw.moveSet;
    const moveSet = Array.isArray(sourceMoves)
      ? formMoves(attribute, sourceMoves.map((entry, index) => {
        const extra = {};
        ["accuracy", "priority", "target", "kind"].forEach((key) => {
          if (entry?.[key] != null && entry[key] !== "") extra[key] = entry[key];
        });
        return [
          entry.id || `${id}_custom_${index + 1}`,
          entry.name || `進化招式${index + 1}`,
          entry.unlockLevel || 1,
          entry.category || entry.type || "attack",
          entry.pp || 10,
          entry.power || 0,
          entry.effectText || "",
          entry.effects && typeof entry.effects === "object" && !Array.isArray(entry.effects) ? safeJsonClone(entry.effects) : {},
          extra,
        ];
      }))
      : [];
    const normalized = {
      ...safeJsonClone(raw),
      id,
      characterId,
      name: source?.name || raw.name || "進化形態",
      displayName: source?.displayName || raw.displayName || raw.name || "進化形態",
      stage: Math.max(1, Math.round(Number(source?.stage || raw.stage || 1))),
      requiredLevel: Math.max(1, Math.round(Number(source?.requiredLevel || raw.requiredLevel || 20))),
      materialCost: canonicalEvolutionMaterialCost(id, raw, catalogForm),
      consumeMaterials: canonicalEvolutionConsumesMaterials(id, raw, catalogForm),
      battlePortraits: normalizePortraitFolderPaths(raw.battlePortraits || source?.battlePortraits || evolutionBattlePortraitsFor(id)),
      statMultiplier: source?.statMultiplier ? safeJsonClone(source.statMultiplier) : raw.statMultiplier && typeof raw.statMultiplier === "object" ? safeJsonClone(raw.statMultiplier) : {},
      statBonus: source?.statBonus ? safeJsonClone(source.statBonus) : raw.statBonus && typeof raw.statBonus === "object" ? safeJsonClone(raw.statBonus) : {},
      passiveText: source?.passiveText || raw.passiveText || "",
      summary: source?.summary || raw.summary || "",
      moveSet,
      defaultMoveIds: source?.defaultMoveIds ? source.defaultMoveIds.slice() : Array.isArray(raw.defaultMoveIds) ? raw.defaultMoveIds.slice() : moveSet.slice(0, 4).map((entry) => entry.id),
    };
    normalized.editorCustom = true;
    return normalized;
  }

  function applyCharacterEditorEvolutionOverrides() {
    const patch = readCharacterEditorPatch();
    if (!patch) return;
    (patch.disabledEvolutionFormIds || []).forEach((id) => {
      delete evolutionForms[String(id)];
    });
    Object.values(patch.evolutionForms || {}).forEach((raw) => {
      const catalogForm = evolutionForms[String(raw?.id || "").trim()];
      const form = normalizeEditorEvolutionForm(raw, catalogForm);
      if (form) evolutionForms[form.id] = form;
    });
  }

  applyCharacterEditorEvolutionOverrides();

  const MOVE_NAME_REDESIGNS = {
    chopper_tackle: "刻蹄",
    brook_yellow: "鼻歌三丁・矢筈斬",
    franky_punch: "強壯右手",
    franky_laser: "佛朗基雷射",
    koby_punch: "直拳",
    tashigi_blade: "時雨斬",
    bartolomeo_punch: "拳擊",
    prison_mr3_candle_wall: "蠟燭壁",
    zoro_pound108_evolved: "二剛力斬",
    carrot_assault: "Electro",
    corazon_assault: "Calm",
    vivi_order: "孔雀斷木機",
    dragon_tornado: "龍捲風",
    little_oars_jr_protect: "古代巨人族",
    squard_fleet: "大渦蜘蛛",
    custom_mp3la6fr_captain_command: "海賊王",
    sanji_diable_mouton: "惡魔風腳・羊肉SHOT",
    sanji_diable_concasse: "惡魔風腳・串燒踢",
    sanji_diable_anti_manner: "惡魔風腳・反禮儀踢擊套餐",
    kuzan_blackbeard_ice_glove: "冰軍刀",
    kuzan_blackbeard_ice_age_small: "冰塊暴雉嘴",
    kuzan_blackbeard_ice_wall: "冰球",
    kuzan_blackbeard_ice_spear: "冰時刻膠囊",
    prison_buggy_split_counter: { prison_buggy_escape_alliance: "四分五裂炮" },
    prison_crocodile_desert_la_spada: { prison_crocodile_desert_alliance: "新月形沙丘" },
    sanji_guard: "接待",
    hancock_warlord: "槍吻",
    ace_guard: "鏡火炎",
    sabo_dragonfire: "火焰龍王",
    yamato_fang: "鏡山",
    yamato_mirror: "鳴鏑",
    corazon_sacrifice: "凪",
    chopper_guard: "毛皮強化",
    jinbe_guardian: "梅花皮",
    oden_spirit: "槍擬鬼",
    rayleigh_haki: "霸王色",
    vivi_support: "孔雀一連",
    tashigi_justice: "海軍劍術",
    cavendish_guard: "美劍・圓舞",
    dragon_storm: "暴風",
    mansherry_princess: "治癒蒲公英",
    jozu_breaker: "Kira Kira no Mi",
    vista_finale: "花劍圓舞",
    marco_blue: "不死薊",
    prison_mr2_bon_clay_clone_guard: "模仿",
    prison_mr2_bon_clay_final_ballet: "白鳥阿拉貝斯克",
    custom_mp3la6fr_king_aura: "霸王色",
    custom_mp3la6fr_final_departure: "霸纏",
    brook_lullaby_parry: "催眠曲・輪舞",
    sanji_mouton_shot_nw: "魔神風腳",
    chopper_guard_point_plus: "守護點",
    carrot_lunar_pounce: "彗星兔",
    carrot_sulong_final_claw: "Sulong",
    chopper_nw_guard_point: "Guard Point",
    chopper_nw_scope_cure: "Scope",
    chopper_nw_kung_fu_point: "柔力強化",
    chopper_nw_monster_control: "Monster Point",
    chopper_nw_emergency_doctor: "診斷",
    law_nw_room_cut: "ROOM",
    law_nw_shambles_command: "Shambles",
    law_nw_counter_shock: "Counter Shock",
    law_nw_gamma_knife: "Gamma Knife",
    law_nw_surgery: "K-ROOM",
    law_nw_puncture_wille: "Puncture Wille",
    smoker_nw_white_launcher: "White Launcher",
    smoker_nw_smoke_bind: "White Out",
    smoker_stone: "七尺十手",
    smoker_nw_jitte_seastone: "海樓石十手",
    smoker_nw_white_guard: "White Blow",
    smoker_nw_white_press: "White Snake",
    smoker_nw_g5_justice: "Moku Moku no Mi",
    tashigi_nw_meito_discern: "名刀看破",
    tashigi_nw_cross_cut: "十字斬",
    kid_nw_punk_rotten: "Punk Rotten",
    kid_nw_assign: "Assign",
    kid_nw_punk_gibson: "Punk Gibson",
    kid_nw_magnetic_clash: "Punk Clash",
    kid_nw_corna_dio: "Punk Corna Dio",
    kid_nw_damned_punk: "Damned Punk",
    perona_nw_negative_hollow: "Negative Hollow",
    perona_nw_mini_hollow_swarm: "Mini Hollow",
    perona_nw_ghost_network: "Ghost Rap",
    perona_nw_astral_body: "Astral Projection",
    perona_nw_mega_hollow: "Toku Hollow",
    perona_nw_negative_princess: "Horo Horo no Mi",
    rayleigh_young_haki_slash: "武裝色霸氣",
    rayleigh_young_future_read: "見聞色霸氣",
    rayleigh_young_conqueror: "霸王色霸氣",
    rayleigh_young_dark_king_flash: "武裝色硬化",
    whitebeard_full_quake_fist: "震震果實",
    whitebeard_seaquake_surge: "大海震",
    whitebeard_airquake_break: "空震破碎",
    whitebeard_bisento_conqueror: "叢雲切",
    custom_mp3l85c1_black_blade_yoru: "黑刀斬擊",
    custom_mp3l85c1_keen_eye: "見聞色",
    custom_mp3l85c1_world_slash: "斬擊",
    custom_mp3l85c1_ship_cutter: "斬艦",
    mihawk_yoru_true_slash: "黑刀・夜",
    mihawk_worlds_strongest_slash: "世界第一斬擊",
    mihawk_duel_stance: "鷹眼看破",
    mihawk_final_black_blade: "斬艦一閃",
    roger_conqueror_burst: "霸王色霸氣",
    roger_pirate_king_command: "霸王色纏繞",
    prison_crocodile_desert_spada: { prison_crocodile_desert_alliance: "Desert Spada" },
    prison_crocodile_sables_pressure: "重量型沙嵐",
    prison_crocodile_ground_secco: { prison_crocodile_desert_alliance: "地乾" },
  };

  function applyMoveNameRedesigns() {
    const applyToMoveSet = (moveSet, ownerId) => {
      (moveSet || []).forEach((entry) => {
        const redesign = MOVE_NAME_REDESIGNS[entry?.id];
        const nextName = typeof redesign === "string" ? redesign : redesign?.[ownerId];
        if (nextName) entry.name = nextName;
      });
    };
    cards.forEach((entry) => applyToMoveSet(entry.moveSet, entry.id));
    Object.values(evolutionForms).forEach((form) => applyToMoveSet(form.moveSet, form.id));
  }

  function normalizeEvolutionFormMoveUnlockLevels() {
    Object.values(evolutionForms).forEach((form) => {
      const requiredLevel = Math.max(1, Math.floor(Number(form.requiredLevel || 1)));
      if (form.id === "luffy_gear_fifth") {
        const directIds = new Set(Array.isArray(form.defaultMoveIds) ? form.defaultMoveIds : []);
        (form.moveSet || []).forEach((entry) => {
          if (directIds.has(entry?.id)) entry.unlockLevel = requiredLevel;
        });
        return;
      }
      const nextCap = nextEvolutionLevelForMoveOwner(form, { isEvolution: true });
      const capLevel = nextCap ? Math.max(requiredLevel, Number(nextCap || requiredLevel) - 1) : 100;
      const baseMoveIds = new Set((cards.find((entry) => entry.id === form.characterId)?.moveSet || [])
        .filter((entry) => Math.max(1, Math.floor(Number(entry.unlockLevel || 1))) <= requiredLevel)
        .map((entry) => entry.id));
      const preferredIds = Array.isArray(form.defaultMoveIds) && form.defaultMoveIds.length
        ? form.defaultMoveIds
        : (form.moveSet || []).slice(0, 4).map((entry) => entry.id);
      let uniqueMoveIndex = 0;
      preferredIds.forEach((id, index) => {
        const moveEntry = (form.moveSet || []).find((entry) => entry.id === id);
        if (!moveEntry) return;
        const currentLevel = Math.max(1, Math.floor(Number(moveEntry.unlockLevel || 1)));
        if (currentLevel > requiredLevel) return;
        if (baseMoveIds.has(id)) return;
        moveEntry.unlockLevel = Math.min(capLevel, requiredLevel + uniqueMoveIndex * 5);
        uniqueMoveIndex += 1;
      });
    });
  }

  function nextAvailableMoveUnlockLevel(targetLevel, usedLevels, minLevel = 1, maxLevel = 100) {
    const min = Math.max(1, Math.floor(Number(minLevel || 1)));
    const max = Math.max(min, Math.floor(Number(maxLevel || 100)));
    const desired = Math.max(min, Math.min(max, Math.floor(Number(targetLevel || min))));
    for (let level = desired; level <= max; level += 1) {
      if (!usedLevels.has(level)) return level;
    }
    for (let level = Math.max(min, desired - 1); level >= min; level -= 1) {
      if (!usedLevels.has(level)) return level;
    }
    return max;
  }

  function normalizeDuplicateMoveUnlockLevelsForOwner(owner, options = {}) {
    const moveSet = Array.isArray(owner?.moveSet) ? owner.moveSet : [];
    if (!moveSet.length) return;
    const isEvolution = Boolean(options.isEvolution);
    const isGearFifth = owner?.id === "luffy_gear_fifth";
    const requiredLevel = isEvolution ? Math.max(1, Math.floor(Number(owner.requiredLevel || 1))) : 1;
    const nextCap = nextEvolutionLevelForMoveOwner(owner, { isEvolution });
    const capLevel = nextCap ? Math.max(requiredLevel, Number(nextCap || requiredLevel) - 1) : 100;
    const directIds = isGearFifth
      ? new Set(Array.isArray(owner.defaultMoveIds) ? owner.defaultMoveIds : [])
      : new Set();
    const inheritedBaseMoveIds = isEvolution
      ? new Set((cards.find((entry) => entry.id === owner.characterId)?.moveSet || [])
        .filter((entry) => normalizeUnlockLevel(entry?.unlockLevel) <= requiredLevel)
        .map((entry) => entry.id))
      : new Set();
    const usedLevels = new Set();
    moveSet.forEach((entry) => {
      if (!entry?.id) return;
      let unlockLevel = normalizeUnlockLevel(entry.unlockLevel);
      if (!isEvolution && unlockLevel <= 1) {
        entry.unlockLevel = 1;
        return;
      }
      if (inheritedBaseMoveIds.has(entry.id)) {
        entry.unlockLevel = Math.min(unlockLevel, requiredLevel);
        return;
      }
      if (directIds.has(entry.id)) {
        entry.unlockLevel = requiredLevel;
        return;
      }
      const minLevel = isGearFifth ? requiredLevel + 1 : (isEvolution ? requiredLevel : 2);
      unlockLevel = Math.max(minLevel, unlockLevel);
      const nextLevel = nextAvailableMoveUnlockLevel(unlockLevel, usedLevels, minLevel, capLevel);
      entry.unlockLevel = nextLevel;
      usedLevels.add(nextLevel);
    });
  }

  function normalizeDuplicateMoveUnlockLevels() {
    cards.forEach((entry) => normalizeDuplicateMoveUnlockLevelsForOwner(entry));
    Object.values(evolutionForms).forEach((form) => normalizeDuplicateMoveUnlockLevelsForOwner(form, { isEvolution: true }));
  }

  function removeDuplicateLateMoveNamesByCharacterChain() {
    cards.forEach((baseCard) => {
      const chain = [
        baseCard,
        ...Object.values(evolutionForms)
          .filter((form) => form.characterId === baseCard.id)
          .sort((a, b) => Number(a.stage || 0) - Number(b.stage || 0)),
      ];
      const usedNames = new Set();
      chain.forEach((owner) => {
        const keptMoves = [];
        (owner.moveSet || []).forEach((entry) => {
          const name = String(entry?.name || "").trim();
          if (name && usedNames.has(name) && String(entry?.id || "").includes("_late_")) return;
          keptMoves.push(entry);
          if (name) usedNames.add(name);
        });
        owner.moveSet = keptMoves;
        owner.learnset = keptMoves.map((entry) => entry.id);
        if (Array.isArray(owner.defaultMoveIds)) {
          const validIds = new Set(keptMoves.map((entry) => entry.id));
          owner.defaultMoveIds = owner.defaultMoveIds.filter((id) => validIds.has(id));
        }
      });
    });
  }

  function evolutionFormsForCharacterId(characterId) {
    return Object.values(evolutionForms)
      .filter((form) => form.characterId === characterId)
      .sort((a, b) =>
        Number(a.stage || 1) - Number(b.stage || 1)
        || Number(a.requiredLevel || 1) - Number(b.requiredLevel || 1)
        || String(a.id || "").localeCompare(String(b.id || ""))
      );
  }

  function nextEvolutionFormAfterStage(characterId, stage) {
    const currentStage = Number(stage || 0);
    return evolutionFormsForCharacterId(characterId)
      .find((form) => Number(form.stage || 1) > currentStage) || null;
  }

  function nextEvolutionLevelForMoveOwner(owner, options = {}) {
    const isEvolution = Boolean(options.isEvolution);
    const characterId = isEvolution ? owner.characterId : owner.id;
    if (!characterId) return null;
    const currentStage = isEvolution ? Number(owner.stage || 1) : 0;
    const nextForm = nextEvolutionFormAfterStage(characterId, currentStage);
    if (!nextForm) return null;
    return Math.max(1, Math.floor(Number(nextForm.requiredLevel || 1)));
  }

  function restrictMoveSetToEvolutionLevel(owner, options = {}) {
    const capLevel = nextEvolutionLevelForMoveOwner(owner, options);
    if (!capLevel) return;
    const originalMoveSet = Array.isArray(owner.moveSet) ? owner.moveSet : [];
    owner.moveSet = originalMoveSet.filter((entry) => normalizeUnlockLevel(entry?.unlockLevel) <= capLevel);
    const validIds = new Set(owner.moveSet.map((entry) => entry.id));
    if (Array.isArray(owner.defaultMoveIds)) {
      owner.defaultMoveIds = owner.defaultMoveIds.filter((id) => validIds.has(id));
      if (!owner.defaultMoveIds.length) owner.defaultMoveIds = owner.moveSet.slice(0, 4).map((entry) => entry.id);
    }
    owner.learnset = owner.moveSet.map((entry) => entry.id);
    owner.moveLearnCapLevel = capLevel;
  }

  function applyEvolutionMoveLevelCaps() {
    cards.forEach((entry) => restrictMoveSetToEvolutionLevel(entry));
    Object.values(evolutionForms).forEach((form) => restrictMoveSetToEvolutionLevel(form, { isEvolution: true }));
  }

  const LATE_MOVE_LEVELS = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95];

  function lateMoveBlueprints(roleType) {
    const battle = [
      ["break", "破陣一式", "attack", 8, 118, "命中後敵方防禦-1", { enemyStagesOnHit: { def: -1 } }],
      ["focus", "決戰架勢", "buff", 6, 0, "自身攻擊+1、速度+1", { selfStages: { atk: 1, spd: 1 } }],
      ["rush", "亂舞連擊", "attack", 6, 54, "骰子點數決定連擊段數", { multiHit: 1, comboAtkRatio: 0.072 }],
      ["pierce", "破盾重擊", "special", 5, 132, "骰到5以上無視護盾", { pierceShieldOnHighDice: true }],
      ["burst", "鬥志爆發", "attack", 5, 142, "骰到5以上傷害+25%", { amplifyOnHighDice: 0.25 }],
      ["guard", "鐵壁反擊", "shield", 5, 0, "本回合減傷45%，反彈少量傷害", { shieldRatio: 0.45, reflectRatio: 0.08 }],
      ["hunt", "弱點追擊", "special", 4, 152, "對能力下降敵人傷害+25%", { strongerVsDebuffed: 0.25 }],
      ["rend", "穿甲終擊", "attack", 4, 160, "無視15%防禦", { ignoreDefenseRatio: 0.15 }],
      ["charge", "終局蓄勢", "buff", 3, 0, "下次攻擊傷害+35%，下回合先手", { nextHitBoost: 0.35, guaranteedFirstNextTurn: true }],
      ["final", "決戰終擊", "special", 3, 180, "對強敵傷害+20%，使用後速度-1", { bossDamageBonus: 0.2, selfStagesAfterUse: { spd: -1 } }],
    ];
    const scout = [
      ["mark", "破綻標記", "control", 8, 0, "敵方速度-1、命中-1", { enemyStages: { spd: -1, accuracy: -1 } }],
      ["signal", "精準打點", "special", 7, 112, "骰到6麻痺1回合", { statusOnSix: { paralyze: 1 } }],
      ["read", "戰局讀取", "debuff", 7, 0, "敵方防禦-1、閃避-1", { enemyStages: { def: -1, evasion: -1 } }],
      ["probe", "弱點追射", "attack", 6, 126, "命中後敵方命中-1", { enemyStagesOnHit: { accuracy: -1 } }],
      ["setup", "觀測節奏", "buff", 5, 0, "自身戰術+1、速度+1、閃避+1", { selfStages: { satk: 1, spd: 1, evasion: 1 } }],
      ["seal", "封鎖佈局", "control", 5, 0, "敵方速度-2，並封鎖強化", { enemyStages: { spd: -2 }, blockEnemyBuff: 1 }],
      ["expose", "破防解析", "special", 4, 142, "對能力下降敵人傷害+25%", { strongerVsDebuffed: 0.25 }],
      ["suppress", "戰術壓制", "debuff", 4, 0, "敵方攻擊、戰術各-1", { enemyStages: { atk: -1, satk: -1 } }],
      ["snipe", "精密終擊", "special", 3, 158, "命中後敵方防禦、意志各-1", { enemyStagesOnHit: { def: -1, sdef: -1 } }],
      ["checkmate", "將死佈局", "special", 3, 170, "對能力下降敵人傷害+30%，骰到5以上束縛", { strongerVsDebuffed: 0.3, statusOnHighDice: { bind: 1 } }],
    ];
    const mobile = [
      ["step", "極速步法", "buff", 7, 0, "自身速度+2、閃避+1", { selfStages: { spd: 2, evasion: 1 } }],
      ["first", "先手突擊", "attack", 7, 118, "先制+1；速度高於敵人時傷害+10%", { strongerIfFaster: 0.1 }, { priority: 1 }],
      ["chain", "高速連段", "attack", 6, 50, "骰子點數決定連擊段數", { multiHit: 1, comboAtkRatio: 0.07 }],
      ["evade", "殘影防守", "shield", 5, 0, "本回合減傷40%，自身速度+1", { shieldRatio: 0.4, selfStages: { spd: 1 } }],
      ["flash", "閃擊破防", "special", 5, 138, "速度高於敵人時傷害+18%", { strongerIfFaster: 0.18 }],
      ["slow", "斷步牽制", "control", 4, 0, "敵方速度-2、閃避-1", { enemyStages: { spd: -2, evasion: -1 } }],
      ["pierce", "穿梭破盾", "attack", 4, 150, "先制+1；骰到5以上無視護盾", { pierceShieldOnHighDice: true }, { priority: 1 }],
      ["tempo", "瞬身蓄勢", "buff", 3, 0, "下次攻擊傷害+25%，下回合先手", { nextHitBoost: 0.25, guaranteedFirstNextTurn: true }],
      ["overrun", "疾風終擊", "attack", 3, 158, "速度高於敵人時傷害+22%", { strongerIfFaster: 0.22 }],
      ["limit", "疾速終擊", "special", 3, 176, "先制+1；速度高於敵人時傷害+25%", { strongerIfFaster: 0.25 }, { priority: 1 }],
    ];
    const support = [
      ["aid", "緊急支援", "heal", 7, 0, "回復隊伍最低血量角色25%HP", { healLowestAllyRatio: 0.25 }],
      ["barrier", "堅守陣線", "shield", 6, 0, "本回合減傷50%", { shieldRatio: 0.5 }],
      ["soften", "削弱要害", "debuff", 6, 0, "敵方攻擊、防禦各-1", { enemyStages: { atk: -1, def: -1 } }],
      ["drain", "反擊治療", "attack", 5, 116, "造成傷害後回復自身20%傷害量", { drainRatio: 0.2 }],
      ["team", "全隊整備", "heal", 5, 0, "全隊回復18%HP", { healTeamRatio: 0.18 }],
      ["resolve", "守護意志", "buff", 4, 0, "自身防禦+1、意志+2", { selfStages: { def: 1, sdef: 2 } }],
      ["strike", "支援反攻", "special", 4, 130, "傷害後回復全隊8%HP", { healTeamRatioAfterHit: 0.08 }],
      ["lock", "封鎖支援", "control", 3, 0, "敵方命中-1，並封鎖強化", { enemyStages: { accuracy: -1 }, blockEnemyBuff: 1 }],
      ["revive", "戰線急救", "heal", 3, 0, "復活一名倒下隊員25%HP", { reviveLowestAllyRatio: 0.25 }],
      ["miracle", "全力支援", "special", 2, 0, "全隊回復25%HP，復活一名倒下隊員20%HP", { healTeamRatio: 0.25, reviveLowestAllyRatio: 0.2 }],
    ];
    if (roleType === "偵查型") return scout;
    if (roleType === "移動型") return mobile;
    if (roleType === "輔助型") return support;
    return battle;
  }

  function lateMoveRootName(source, isEvolution) {
    if (isEvolution) return source.name || source.displayName || "進化";
    return source.passive || source.name || "船員";
  }

  const BLOCKED_LATE_MOVE_NAME_PARTS = [
    "熟練", "進階", "高階", "終式", "終擊", "終幕", "終曲", "終射", "終斬", "終爪",
    "壓制", "支援", "護身", "反擊", "破陣", "終局", "氣魄", "守勢", "突擊",
    "連打", "守護", "防守", "護隊", "迷宮", "女王", "公主", "手術師", "戰場",
    "新世界", "魔人破陣", "同盟終擊", "海軍白煙", "金屬臂", "解析", "突襲",
    "磁氣風暴", "沙嵐號令", "乾裂束縛", "重量型沙嵐", "改", "號令",
    "全盛", "全開", "亂打", "亂斬", "連擊", "連閃", "疾走", "指揮轉移",
    "手術刀亂舞", "心臟震擊", "白煙防壁", "磁氣重壓", "龐克粉碎",
    "幽靈網", "靈體迴避", "王者連斬", "神避連擊", "大海賊震擊",
    "黑刀亂斬", "魔人重擊", "花劍決斬", "防禦點", "診斷治療",
    "掌控", "船醫緊急處置", "突進",
  ];

  function isBlockedLateMoveName(name) {
    const text = String(name || "").trim();
    if (!text) return true;
    return BLOCKED_LATE_MOVE_NAME_PARTS.some((part) => text.includes(part));
  }

  const REAL_LATE_MOVE_NAMES = {
    luffy: ["橡膠鐘", "橡膠槌", "橡膠鐮刀", "橡膠風車", "橡膠煙火", "橡膠花火黃金牡丹", "橡膠火山", "橡膠攻城砲", "橡膠連接槌", "橡膠暴風雨"],
    zoro: ["燒鬼斬", "牛針", "蟹獲り", "二剛力斬", "鴉魔狩り", "艷美魔夜不眠鬼斬", "羅生門", "百八煩惱鳳", "阿修羅壹霧銀", "飛龍火焰"],
    nami: ["熱氣泡", "冷氣泡", "電氣泡", "雷電天候", "龍捲風天候", "霧天候", "幻象妖精", "雷光槍天候", "風速計", "雷雨天候"],
    sanji: ["肩肉踢擊", "背肉踢擊", "鞍下肉踢擊", "胸肉踢擊", "腿肉踢擊", "粗碎", "宴會桌旋風踢", "串燒踢", "羊肉SHOT", "反禮儀踢擊套餐"],
    law: ["ROOM", "屠宰場", "心臟奪取", "切斷", "掃描", "移植", "反射", "心脈切割", "注射SHOT", "ROOM斬斷"],
    robin: ["二輪花", "六輪花", "三十輪花", "百花繚亂", "三十輪花鉤爪", "金盞花滑行", "八十輪花", "四本樹", "大飛燕草", "蜘蛛之花"],
    hancock: ["甜甜甘風", "芳香腳", "俘虜之箭", "槍吻", "蛇姬踢擊", "石化閃避", "王下七武海壓制", "芳香極踢", "女帝威壓", "虜之矢"],
    carrot: ["爪擊", "電擊爪", "兔躍", "月步閃避", "電氣衝刺", "瞬間突襲", "電氣加速", "電氣雷爪", "電氣突襲", "電氣亂擊"],
    carrot_moon_lion: ["彗星兔", "Sulong", "Electro"],
    ace: ["火拳", "炎上網", "火焰護身", "陽炎", "炎戒", "神火不知火", "火柱", "火槍", "螢火火達摩", "大炎戒炎帝"],
    whitebeard: ["薙刀橫掃", "震動拳", "震動防壁", "霸氣壓迫", "海震", "空震", "島割", "震動破陣", "世界最強一擊", "大海賊的終擊"],
    jozu: ["鑽石重拳", "鑽石防禦", "鑽石衝撞", "隊長護衛", "閃耀衝撞", "鑽石攔截", "鑽石破陣", "Brilliant Punk", "鑽石反擊", "鑽石終擊"],
    vista: ["雙劍斬", "花瓣劍路", "雙劍格擋", "花劍佯攻", "薔薇連斬", "劍豪對峙", "花劍亂舞", "花劍終幕", "花劍圓舞", "花劍決斬"],
    izo: ["雙槍射擊", "槍口標記", "煙幕步伐", "掩護射擊", "連續射擊", "破甲彈", "隊長狙擊令", "赤鞘槍陣", "雙槍壓制", "以藏終射"],
    sabo: ["龍爪拳", "弱點識破", "龍爪架勢", "龍鉤爪", "火拳繼承", "龍之吐息", "炎龍突擊", "革命龍炎", "龍爪壓制", "龍爪連擊"],
    yamato: ["雷鳴八卦", "冰牙守護", "大口真神", "冰爪", "無侍冰牙", "鏡山", "白蛇駆", "建御雷", "鳴鏑", "冰諸斬"],
    corazon: ["手槍射擊", "靜音空間", "寂靜干擾", "掩護撤退", "無聲突襲", "保護之心", "消音封鎖", "犧牲守護", "凪", "消音壁"],
    usopp: ["鉛星", "煙霧星", "逃跑路線", "謊言威嚇", "火藥星", "撒菱地獄", "衝擊貝", "烏索普黃金鐵鎚", "火鳥星", "阿特拉斯彗星"],
    chopper: ["腕力強化", "重量強化", "毛皮強化", "角強化", "腳力強化", "頭腦強化", "診斷", "刻蹄櫻", "刻蹄十字架", "怪物強化"],
    jinbe: ["魚人空手", "五千枚瓦正拳", "七千枚瓦回旋踢", "唐草瓦正拳", "鮫瓦正拳", "海流一本背負", "擊水", "槍波", "魚人柔術", "海俠洞察"],
    brook: ["鼻歌三丁", "鼻歌三丁・矢筈斬", "鎮魂歌", "催眠曲輪舞", "黎明歌・突刺", "酒樽舞曲", "前奏曲・破兵", "革命舞曲", "夜明歌", "鎮魂曲・黃泉壓迫"],
    franky: ["強壯右手", "兵器左手", "佛朗基拳擊", "風來砲", "清新火焰", "星盾", "終極鐵鎚", "風來噴射", "佛朗基三角折刀", "強壯鎚"],
    oden: ["桃源十拳", "桃源白瀧", "槍擬鬼", "侍斬", "雙刀流", "武士豪氣", "御田二刀流", "桃源斬", "白瀧斬", "赤鞘斬"],
    rayleigh: ["冥王預判", "冥王防禦", "冥王壓制", "冥王斬擊", "冥王踢擊", "冥王反擊", "冥王疾步", "冥王突刺", "冥王守勢", "冥王一閃"],
    garp: ["拳骨", "愛之拳", "拳骨隕石", "拳骨流星群", "鐵拳蓄勢", "英雄鐵拳", "海軍拳擊", "拳骨連打", "拳骨壓制", "拳骨終擊"],
    vivi: ["孔雀斷木機", "孔雀一連", "魅惑香水舞", "王國支援", "全隊恢復", "生命奇蹟", "公主治癒", "王女步調", "孔雀返擊", "孔雀舞"],
    koby: ["海軍觀測", "剃步", "海軍拳", "觀測閃避", "正義衝撞", "海軍防守", "克比突擊", "克比連打", "克比守護", "海軍壓制"],
    smoker: ["白拳", "白蛇", "白蔓", "白煙發射器", "白色疾風", "煙霧捕縛", "白煙制壓", "煙霧護身", "白煙突擊", "白色衝擊"],
    tashigi: ["時雨斬", "居合", "居合快步", "海軍劍術", "斬擊架勢", "剃步斬", "十字斬", "時雨突刺", "斬波", "居合連斬"],
    kuzan: ["冰河時代", "冰軍刀", "冰塊暴雉嘴", "冰塊兩棘矛", "冰球", "冰時刻", "冰時刻膠囊", "冰結戰場", "冰壁", "冰之護身"],
    fujitora: ["重力刀", "重力刀・猛虎", "地獄旅", "重力壓制", "重力感知", "隕石", "重力反擊", "重力護身", "重力突進", "重力終擊"],
    bartolomeo: ["屏障球", "屏障Crash", "屏障牛", "屏障護身", "屏障支援", "屏障反擊", "屏障突擊", "屏障封鎖", "屏障堡壘", "屏障壓制"],
    cavendish: ["美劍・青鳥", "美劍・斬星屑王子", "白馬疾影", "白馬突擊", "美劍突刺", "金翅鳥", "白馬連斬", "美劍守勢", "白馬終擊", "美劍圓舞"],
    kinemon: ["狐火流", "狐火流・焰裂", "火柳一閃", "錦衛門斬", "赤鞘炎斬", "火焰防守", "狐火突刺", "火焰反擊", "狐火連斬", "焰裂終擊"],
    ivankov: ["死亡媚眼", "銀河媚眼", "地獄媚眼", "顏面成長荷爾蒙", "治癒荷爾蒙", "亢奮荷爾蒙", "緊張荷爾蒙", "夢打擊處理拳", "Rolling Esthétique", "荷爾蒙支援"],
    kuma: ["壓力炮", "熊掌衝擊", "陰愈傷彈", "拍飛", "瞬移壓制", "熊掌護身", "壓力炮連射", "熊掌反擊", "熊掌突進", "旅行的話想去哪裡"],
    dragon: ["突風", "暴風", "龍捲風"],
    kid: ["反射", "磁力吸引", "磁力反彈", "磁力武裝", "磁力重砲", "磁力破壞", "金屬臂", "金屬拳", "磁力束縛", "磁力衝擊"],
    killer: ["斬首爪", "殺戮旋律", "迴轉斬", "鎌斬", "旋風斬", "殺戮突刺", "鐮刃連斬", "殺戮節奏", "鐮刃終擊", "殺戮圓舞"],
    perona: ["消極幽靈", "迷你幽靈", "特大幽靈神風炸彈", "幽靈分身", "幽靈騷擾", "消極壓制", "迷你幽靈連彈", "幽靈護身", "幽靈封鎖", "特大幽靈炸彈"],
    mansherry: ["治癒蒲公英", "獻血蒲公英", "小人治癒", "小人支援", "治癒之淚", "急救蒲公英", "回復蒲公英", "小人守護", "治癒支援", "小人族奇蹟"],
    little_oars_jr: ["巨人棍擊", "巨步推進", "魔人身軀", "救援怒吼", "巨腕橫掃", "破牆衝鋒", "巨人護隊", "為艾斯開路", "魔人重擊", "魔人破陣"],
    squard: ["長刀斬擊", "破綻試探", "同盟號令", "大渦格擋", "背水突刺", "疑心斬", "悔悟反攻", "大渦蜘蛛斬", "悔悟突擊", "同盟終擊"],
    marco: ["鳳凰爪擊", "再生火焰", "藍焰守護", "鳳凰飛行", "青炎踢", "隊伍再生", "不死鳥再燃", "鳳凰印", "不死薊", "鳳凰守護"],
    custom_mp3l6s8w: ["新時代", "歌歌世界", "我是最強", "逆光", "風之去向", "歌聲護幕", "短暫搖籃曲", "Tot Musica", "世界的延續", "烏塔終幕"],
    custom_mp3l85c1: ["黑刀・夜", "鷹眼看破", "小刀制敵", "世界第一斬擊", "斬艦一閃", "十字斬", "劍豪威壓", "夜・終斬", "黑刀一閃", "世界最強斬擊"],
    custom_mp3la6fr: ["神避", "霸王色威壓", "海賊王斬擊", "船長號令", "大海賊連斬", "海賊王氣魄", "王者交鋒", "神避・終擊", "奧羅・傑克森號令", "海賊王終擊"],
    luffy_gear_second: ["JET手槍", "JET鞭", "JET火箭砲", "JET機關槍", "JET戰斧", "JET子彈", "JET槌", "巨人槍", "巨人鞭", "巨人火箭砲"],
    luffy_evolution_2: ["猿王槍", "犀牛榴彈砲", "大蛇砲", "坦克人", "獅子火箭砲", "大猿王槍", "雙重猿王槍", "蛇人追擊", "彈跳人猛攻", "四檔終擊"],
    luffy_gear_fifth: ["黎明手槍", "白色彈跳", "巨人化", "黎明火箭", "猿神槍", "解放之鼓", "橡膠白星槍", "尼卡笑擊", "黎明鞭", "五檔終擊"],
    zoro_santoryu_plus: ["艷美魔夜不眠鬼斬", "羅生門", "百八煩惱鳳", "阿修羅壹霧銀", "飛龍火焰", "夜叉鴉", "二剛力斬", "牛針", "蟹獲り", "鴉魔狩り"],
    zoro_evolution_2: ["煉獄鬼斬", "黑繩大龍卷", "死・獅子歌歌", "一大三千大千世界", "六道之辻", "阿修羅拔劍・亡者戲", "三刀流奧義", "千八十煩惱鳳", "極虎狩", "新世界終斬"],
    zoro_zorojuro: ["閻魔・煉獄鬼斬", "閻魔・飛龍火焰", "閻王三刀流", "一百三情飛龍侍極", "狐火流・焰裂", "黑繩大龍卷・閻魔", "三刀流奧義・煉獄", "阿修羅・拔劍亡者戲", "霸王色斬擊", "閻王三刀龍・終焰"],
    nami_clima_tact_plus: ["幻象天候・海市蜃樓", "冷氣泡", "雷光槍天候", "雷電天候・強化", "龍捲風天候・強化", "雷雨天候", "熱氣泡", "電氣泡", "霧天候", "幻象妖精"],
    nami_evolution_2: ["魔法天候棒", "突風劍", "雷雲棒", "雷霆天候", "天候蛋", "宙斯雷雲", "黑雲天候", "天候預報", "雷雲陷阱", "新世界雷擊"],
    sanji_diable_jambe: ["惡魔風腳", "首肉SHOT", "羊肉SHOT", "串燒踢", "一級絞肉", "畫龍點睛SHOT", "反禮儀踢擊套餐", "宴會桌旋風踢", "粗碎", "接待"],
    sanji_evolution_2: ["空中步行", "熟燒・燒烤SHOT", "燒鐵鍋光譜", "地獄回憶", "海步行", "羊肉SHOT・新世界", "流星踢", "宴會桌旋風踢・新世界", "畫龍點睛SHOT", "新世界黑足"],
    whitebeard_evolution_1: ["震動拳", "海震", "空震", "薙刀橫掃", "島割"],
    kuzan_evolution_1: ["冰塊拳", "冰河時代小型", "冰壁", "冰矛", "冰塊兩棘矛", "冰時刻", "冰結戰場", "冰河時代", "絕對零度氣場", "十號船長冰封"],
    custom_mp3l6s8w_evolution_1: ["新時代・共鳴", "歌歌世界・束縛", "逆光・壓制", "Tot Musica・終幕", "風之去向・治癒", "歌聲護幕・全開", "搖籃曲封鎖", "歌姬終幕", "新時代合唱", "烏塔世界終曲"],
    custom_mp3l85c1_evolution_1: ["黑刀・夜", "世界第一斬擊", "鷹眼看破", "小刀制敵", "斬艦一閃"],
    custom_mp3la6fr_evolution_1: ["神避", "霸王色霸氣", "最後神避"],
    chopper_rumble_ball_plus: ["診斷・弱點看破", "腕力強化・刻蹄櫻", "角強化・角砲", "毛皮強化・守護點", "藍波球 重量衝擊", "怪物強化", "刻蹄十字架", "刻蹄菱形", "頭腦強化", "腳力強化"],
    chopper_evolution_2: ["重量強化・重拳", "毛皮強化・防禦點", "診斷治療", "柔力強化・連打", "怪物強化・掌控", "船醫緊急處置", "刻蹄櫻吹雪", "角強化・突進", "頭腦強化・解析", "新世界船醫"],
    law_new_world: ["ROOM", "Shambles", "Counter Shock", "Gamma Knife", "K-ROOM", "Puncture Wille", "R-ROOM", "Shock Wille"],
    smoker_new_world: ["White Launcher", "White Out", "White Blow", "White Snake", "海樓石十手"],
    tashigi_new_world: ["時雨一閃", "剃步居合", "名刀看破・新世界", "十字斬・新世界", "正義連斬", "海樓石斬", "時雨連斬", "海軍劍術・改", "名刀守護", "新世界劍士"],
    kid_new_world: ["Punk Rotten", "Assign", "Punk Gibson", "Punk Clash", "Punk Corna Dio", "Damned Punk", "Punk Pistols"],
    perona_new_world: ["Negative Hollow", "Mini Hollow", "Ghost Rap", "Toku Hollow", "Astral Projection"],
    usopp_sogeking: ["兜・鉛星", "火鳥星", "煙星・掩護射擊", "鹽星", "阿特拉斯彗星", "火藥星連彈", "手裏劍流星群", "烏索普黃金鐵鎚", "衝擊貝", "鉛星"],
    usopp_evolution_2: ["黑兜狙擊", "綠星・惡魔", "綠星・竹林槍", "見聞色狙擊", "綠星・狼草", "必殺・蓑蟲星", "綠星・骷髏爆裂草", "綠星・衝擊狼", "狙擊支援", "新世界狙擊終擊"],
    robin_cien_fleur: ["百花繚亂・大飛燕草", "百花繚亂・翼", "百花繚亂・蜘蛛之花", "八十輪花・四本樹", "百花繚亂・大樹", "百花繚亂・萬花束縛", "三十輪花鉤爪", "金盞花滑行", "六輪花摔擊", "百花繚亂"],
    franky_weapon_left: ["強壯右手・強化", "兵器左手", "風來砲・強化", "佛朗基拳擊", "清新火焰", "終極鐵鎚", "星盾", "風來噴射", "佛朗基三角折刀", "強壯鎚"],
    brook_yomi_swordsman: ["鼻歌三丁・箭尾斬", "鼻歌三丁・序曲", "催眠曲・防守", "黎明歌・突刺", "波蘭舞曲・冰斬", "鎮魂曲・黃泉壓迫", "酒樽舞曲", "前奏曲・破兵", "革命舞曲", "夜明歌"],
    rayleigh_young: ["霸王色霸氣", "武裝色霸氣", "見聞色霸氣"],
    koby_colonel: ["剃", "見聞色霸氣", "誠實衝擊"],
    prison_buggy: ["四分五裂拳", "巴其小炸彈", "小丑逃脫術", "特製馬奇彈", "小丑奇襲", "華麗誘敵", "四分五裂反擊", "華麗大砲", "四分五裂炮", "巴其玉"],
    prison_mr3: ["蠟燭壁", "蠟燭拘束", "蠟燭長槍", "蠟燭冠軍拳", "蠟燭鎧甲", "蠟燭封鎖陣", "特大蠟燭槌", "蠟燭服務套餐", "蠟燭冠軍", "蠟燭人偶"],
    prison_mr2_bon_clay: ["人妖拳法踢擊", "模仿迷惑", "友情鼓舞", "爆擊天鵝舞", "模仿護身", "友情衝刺", "人妖連踢", "友情芭蕾終幕", "白鳥阿拉貝斯克", "人妖之道踢擊"],
    prison_mr1_daz_bones: ["微塵斬", "鋼刃身軀", "發泡雛菊斬", "滅裂斬", "鋼刃架勢", "斬波", "鑽石邊刃", "滅裂雛菊斬", "斬人刀刃", "微塵斬速力"],
    prison_crocodile: ["沙漠寶刀", "沙嵐", "侵蝕輪迴", "沙漠向日葵", "沙漠金剛寶刀", "沙嵐號令", "乾裂束縛", "侵蝕輪迴終幕", "重量型沙嵐", "乾裂"],
  };

  function realLateMoveNamesFor(source, options = {}) {
    const key = options.isEvolution ? source.id : (source.id || options.characterId);
    const characterKey = options.characterId || source.characterId || source.id;
    const names = REAL_LATE_MOVE_NAMES[key] || REAL_LATE_MOVE_NAMES[characterKey] || [];
    return names.map((name) => String(name || "").trim()).filter((name) => name && !isBlockedLateMoveName(name));
  }

  function scaledLateMoveBlueprint(blueprint, isEvolution) {
    const [slug, suffix, type, pp, power, effectText, effects = {}, extra = {}] = blueprint;
    return [
      slug,
      suffix,
      type,
      Math.max(2, Number(pp || 1) - (isEvolution ? 1 : 0)),
      Number(power || 0) > 0 ? Number(power || 0) + (isEvolution ? 14 : 0) : 0,
      `${isEvolution ? "進化招式；" : ""}${effectText}`,
      { ...effects },
      { ...extra },
    ];
  }

  function lateGameMovesFor(source, options = {}) {
    const isEvolution = Boolean(options.isEvolution);
    const characterId = options.characterId || source.id || source.characterId || "crew";
    const roleType = options.roleType || source.roleType || cards.find((entry) => entry.id === characterId)?.roleType || "戰鬥型";
    const attribute = options.attribute || source.attribute || source.moveSet?.[0]?.attribute || cards.find((entry) => entry.id === characterId)?.attribute || "無";
    const idPrefix = isEvolution ? source.id : characterId;
    const realNames = realLateMoveNamesFor(source, options);
    const usedNames = new Set((source.moveSet || []).map((entry) => String(entry?.name || "").trim()).filter(Boolean));
    let realNameIndex = 0;
    return lateMoveBlueprints(roleType).map((blueprint, index) => {
      const [slug, suffix, type, pp, power, effectText, effects, extra] = scaledLateMoveBlueprint(blueprint, isEvolution);
      while (realNameIndex < realNames.length && usedNames.has(realNames[realNameIndex])) realNameIndex += 1;
      const name = realNames[realNameIndex];
      realNameIndex += 1;
      if (!name) return null;
      usedNames.add(name);
      return move({
        id: `${idPrefix}_late_${slug}`,
        name,
        unlockLevel: LATE_MOVE_LEVELS[index],
        type,
        pp,
        power,
        effectText,
        effects,
        attribute,
        ...extra,
      });
    }).filter(Boolean);
  }

  function appendUniqueMoves(target, movesToAdd) {
    target.moveSet = Array.isArray(target.moveSet) ? target.moveSet : [];
    const existingIds = new Set((target.moveSet || []).map((entry) => entry.id));
    movesToAdd.forEach((entry) => {
      if (!entry?.id || existingIds.has(entry.id)) return;
      target.moveSet.push(entry);
      existingIds.add(entry.id);
    });
    target.learnset = (target.moveSet || []).map((entry) => entry.id);
  }

  applyMoveNameRedesigns();
  normalizeEvolutionFormMoveUnlockLevels();
  applyEvolutionMoveLevelCaps();
  cards.forEach((entry) => {
    if (nextEvolutionLevelForMoveOwner(entry)) return;
    appendUniqueMoves(entry, lateGameMovesFor(entry));
  });
  Object.values(evolutionForms).forEach((form) => {
    if (nextEvolutionLevelForMoveOwner(form, { isEvolution: true })) return;
    const baseCard = cards.find((entry) => entry.id === form.characterId);
    appendUniqueMoves(form, lateGameMovesFor(form, {
      isEvolution: true,
      characterId: form.characterId,
      roleType: baseCard?.roleType,
      attribute: form.moveSet?.[0]?.attribute || baseCard?.attribute,
    }));
  });
  applyEvolutionMoveLevelCaps();
  removeDuplicateLateMoveNamesByCharacterChain();
  normalizeDuplicateMoveUnlockLevels();

  // Critical metadata stays on moves instead of adding extra command buttons.
  // The battle resolver combines these bonuses with the actor's own rate and equipment.
  const CRITICAL_PLUS_20_MOVE_NAMES = new Set([
    "獅子歌歌", "冥王一閃", "精準打擊", "居合斬", "玫瑰突刺", "白馬斷空",
    "斬首爪", "破甲彈", "必殺・阿特拉斯彗星", "黑兜狙擊", "見聞色狙擊",
    "Gamma Knife", "Puncture Wille", "羅生門", "飛龍火焰", "死・獅子歌歌",
    "斬艦一閃", "神避・霸纏", "最後神避", "時雨一閃", "微塵斬",
  ]);
  const CRITICAL_PLUS_10_MOVE_NAMES = new Set([
    "鬼斬", "虎狩", "注射SHOT", "手槍射擊", "鉛星", "火藥星", "覆霸斬",
    "老兵突刺", "時雨斬", "高速斬", "音速斬", "雙槍射擊", "連續射擊",
    "背水突刺", "黑刀斬擊", "小刀制敵", "斬艦", "神避", "海賊王斬擊",
    "艷美魔夜不眠鬼斬", "阿修羅 壹霧銀", "鼻歌三丁・箭尾斬", "黎明歌・突刺",
    "兜・鉛星", "火鳥星", "綠星・竹林槍", "必殺・蓑蟲星", "時雨一閃",
    "海樓石斬", "武裝色霸氣", "武裝色硬化", "誠實衝擊", "黑刀・夜",
    "世界第一斬擊", "Desert Spada", "滅裂斬", "鑽石邊刃",
  ]);

  function applyMoveCriticalMetadata(moveEntry) {
    if (!moveEntry || moveDamageClassFor(moveEntry) === "status") return;
    const effects = { ...(moveEntry.effects || {}) };
    if (effects.cannotCritical || effects.guaranteedCritical || Number(effects.critRateBonus || 0) > 0) {
      moveEntry.effects = effects;
      return;
    }
    const name = String(moveEntry.name || "").trim();
    if (CRITICAL_PLUS_20_MOVE_NAMES.has(name)) effects.critRateBonus = .2;
    else if (CRITICAL_PLUS_10_MOVE_NAMES.has(name)) effects.critRateBonus = .1;
    moveEntry.effects = effects;
  }

  cards.forEach((entry) => (entry.moveSet || []).forEach(applyMoveCriticalMetadata));
  Object.values(evolutionForms).forEach((form) => (form.moveSet || []).forEach(applyMoveCriticalMetadata));

  window.BoardCards = {
    cards,
    byId,
    byTier,
    evolutionForms,
    moveDamageClassFor,
    isSpecialDamageMove,
    moveDisplayName,
    criticalProfiles: CHARACTER_CRITICAL_PROFILES,
  };
})();
