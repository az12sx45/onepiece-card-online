'use strict';
// Exact original source; only the browser's Audio transport is supplied natively.
exports.install=function(window){
const globalThis=window,module=undefined;
(function (global) {
  const DEFAULT_COOLDOWN_MS = 90000;

  // Browser playback trims the measured silent head/tail without changing the source MP3 files.
  // gainDb keeps the 56 soundtrack cues close to the same perceived loudness.
  const BGM_PLAYBACK_TUNING = Object.freeze({
    gold_uunan: [0.25, 105.98, 2.13],
    hungry_luffy: [0, 199.35, 6],
    erudrago_appears: [0.65, 105.95, 0.78],
    oden_store: [1.55, 174.5, 4.52],
    golden_island_shore: [1.65, 98.65, 3.04],
    usopp_danger: [0.7, 195.65, 4.03],
    explosion_sonic_wave: [1.65, 113.65, 0.5],
    uunan_stone: [1.3, 126.55, 6],
    gold_and_oden: [2.5, 156.6, 6],
    fury: [1.35, 210.4, 2.71],
    gomugomu_vs_goegoe: [2, 190.95, -1.8],
    gomugomu_bazooka: [1.9, 251.35, -1.44],
    message_from_uunan: [1.7, 185.25, 6],
    pirate_king_departure: [4.55, 101.55, 5.24],
    becoming_pirate_king: [2.95, 134.99, 0.16],
    reliable_friend: [0, 213.15, 1.76],
    to_the_grand_line: [1.35, 233.65, 1],
    duel: [2.05, 217.6, 1.37],
    party: [2.15, 164.6, 1.68],
    more_and_more: [1.85, 33.15, -1.28],
    village_harbor: [2.3, 144.3, 2.09],
    luffy: [1.45, 292.3, 0],
    zoro: [2.5, 303.6, 0.27],
    nami: [2.8, 212.65, 5.09],
    sanji: [1.95, 149.75, 0.11],
    sanji_great_blues: [2.25, 368.45, 2.41],
    pirate: [2.7, 221.7, 0.79],
    difficult: [2.2, 208.95, -0.57],
    escape: [1.85, 220.4, -0.73],
    overtaken: [2.85, 199.15, -0.37],
    angry: [2.35, 133.3, -1.77],
    cant_escape_fight: [1.8, 193.7, -2.03],
    fight_continues: [1.15, 166.35, 0.62],
    hawks_wing: [2.55, 224.1, 0.49],
    to_the_ocean: [3.15, 159.55, -1.18],
    luffys_pace: [3.4, 250.3, -1.9],
    sanjis_feast: [1.65, 247, -2.13],
    food_fight: [0, 102.99, -2.42],
    merry_farewell: [0, 211.95, -3.49],
    storms_stars: [2.2, 366.25, -0.88],
    mother_sea: [2.7, 246.8, 1.15],
    stealth_night_shadow: [2.7, 217.98, -0.75],
    landing_at_town: [3.05, 423.45, -1.16],
    desperate_situation: [2.3, 271.45, -1.82],
    one_hour_evacuation: [2.45, 138.99, -1.63],
    cant_lose: [0, 212.99, -3.83],
    spirit_of_zoro: [0, 139.98, -4],
    we_did_it: [0, 143.8, 0.2],
    after_eating_grand_line: [2.15, 144.9, -1.24],
    chopper: [2.6, 231.75, 2.05],
    grand_line_cold_island: [6.1, 231.4, 1.63],
    grand_line_hot_island: [1.4, 200.55, 1.55],
    miss_allsunday: [2.45, 146.4, 0.51],
    umi_no_namamono: [1.75, 482.85, 0.38],
    shinkenshoubu: [2.1, 238.5, -2.68],
    mezase_one_piece: [1.95, 314.55, -0.39],
  });

  function entry(data) {
    const tuning = BGM_PLAYBACK_TUNING[data.id] || [0, 0, 0];
    return Object.freeze({
      avoidOveruse: false,
      cooldownMs: DEFAULT_COOLDOWN_MS,
      loop: true,
      characterTags: [],
      environmentTags: [],
      cueInSec: tuning[0],
      cueOutSec: tuning[1],
      gainDb: tuning[2],
      ...data,
      sceneTags: Object.freeze(data.sceneTags || []),
      moodTags: Object.freeze(data.moodTags || []),
      phase: Object.freeze(data.phase || []),
      characterTags: Object.freeze(data.characterTags || []),
      environmentTags: Object.freeze(data.environmentTags || []),
    });
  }

  const BGM_METADATA = Object.freeze([
    entry({
      id: "gold_uunan",
      filename: "01 - The great pirate of Gold Uunan.mp3",
      title: "The great pirate of Gold Uunan",
      sourceContext: "黃金大海賊烏南、傳說、寶藏、大海賊故事。",
      sceneTags: ["legend", "treasure", "gold", "ancient_pirate", "story", "mystery"],
      moodTags: ["epic", "mysterious", "historic"],
      intensity: 3,
      priority: 72,
      phase: ["story", "event"],
      environmentTags: ["treasure", "mystery"],
    }),
    entry({
      id: "hungry_luffy",
      filename: "02 - Hungry Luffy.mp3",
      title: "Hungry Luffy",
      sourceContext: "魯夫肚子餓、食物、日常搞笑。",
      sceneTags: ["food", "comedy", "daily"],
      moodTags: ["funny", "light", "playful"],
      intensity: 1,
      priority: 42,
      phase: ["event", "story"],
      characterTags: ["luffy"],
      environmentTags: ["food"],
    }),
    entry({
      id: "erudrago_appears",
      filename: "03 - EruDrago Appears.mp3",
      title: "EruDrago Appears",
      sourceContext: "反派艾爾德拉哥登場、敵人壓迫。",
      sceneTags: ["villain", "boss_appear", "threat", "danger"],
      moodTags: ["dark", "dangerous", "tense"],
      intensity: 4,
      priority: 82,
      phase: ["battle_intro", "danger", "story"],
      environmentTags: ["boss"],
    }),
    entry({
      id: "oden_store",
      filename: "04 - The world's number one Oden store.mp3",
      title: "The world's number one Oden store",
      sourceContext: "關東煮店、商店、食物、溫暖日常。",
      sceneTags: ["shop", "food", "town", "npc", "daily"],
      moodTags: ["warm", "casual", "friendly"],
      intensity: 1,
      priority: 75,
      phase: ["shop", "town", "event"],
      environmentTags: ["food", "village"],
    }),
    entry({
      id: "golden_island_shore",
      filename: "05 - On the shore!Golden Island.mp3",
      title: "On the shore! Golden Island",
      sourceContext: "登上黃金島、新島嶼發現、冒險地點揭曉。",
      sceneTags: ["landing", "island", "discovery", "treasure"],
      moodTags: ["fresh", "adventurous", "expectant"],
      intensity: 2,
      priority: 66,
      phase: ["map", "event", "story"],
      environmentTags: ["treasure", "harbor"],
    }),
    entry({
      id: "usopp_danger",
      filename: "06 - Usopp! It's dangerous!.mp3",
      title: "Usopp! It's dangerous!",
      sourceContext: "烏索普慌張、危險但偏搞笑。",
      sceneTags: ["danger", "trap", "comedy", "surprise"],
      moodTags: ["panic", "funny", "nervous"],
      intensity: 2,
      priority: 56,
      phase: ["event", "danger"],
      characterTags: ["usopp"],
    }),
    entry({
      id: "explosion_sonic_wave",
      filename: "07 - Explosion! Sonic Wave!.mp3",
      title: "Explosion! Sonic Wave!",
      sourceContext: "音波攻擊、爆炸、技能衝擊。",
      sceneTags: ["explosion", "attack", "impact", "skill", "sonic"],
      moodTags: ["impactful", "chaotic", "aggressive"],
      intensity: 4,
      priority: 74,
      phase: ["battle_intro", "battle_climax", "event"],
    }),
    entry({
      id: "uunan_stone",
      filename: "08 - Uunan and the Stone.mp3",
      title: "Uunan and the Stone",
      sourceContext: "烏南與石藏/岩藏、回憶、故事線索。",
      sceneTags: ["memory", "stone", "clue", "old_story", "treasure"],
      moodTags: ["nostalgic", "calm", "serious"],
      intensity: 2,
      priority: 52,
      phase: ["story", "event"],
      environmentTags: ["treasure", "mystery"],
    }),
    entry({
      id: "gold_and_oden",
      filename: "09 - Gold and Oden.mp3",
      title: "Gold and Oden",
      sourceContext: "黃金與日常人情、寶藏真正意義。",
      sceneTags: ["gold", "food", "memory", "warm_story"],
      moodTags: ["warm", "sentimental", "gentle"],
      intensity: 2,
      priority: 50,
      phase: ["story", "event"],
      environmentTags: ["food", "treasure"],
    }),
    entry({
      id: "fury",
      filename: "10 - Fury!.mp3",
      title: "Fury!",
      sourceContext: "憤怒爆發、衝突升級。",
      sceneTags: ["anger", "conflict", "rage", "pre_battle"],
      moodTags: ["angry", "tense", "aggressive"],
      intensity: 4,
      priority: 78,
      phase: ["danger", "battle_intro", "story"],
    }),
    entry({
      id: "gomugomu_vs_goegoe",
      filename: "11 - GomuGomu Vs Goegoe.mp3",
      title: "GomuGomu Vs Goegoe",
      sourceContext: "魯夫能力戰、橡膠對聲音能力。",
      sceneTags: ["ability_battle", "duel", "skill_clash"],
      moodTags: ["action", "intense", "heroic"],
      intensity: 4,
      priority: 84,
      phase: ["battle_loop", "battle_climax"],
      characterTags: ["luffy"],
      environmentTags: ["duel"],
    }),
    entry({
      id: "gomugomu_bazooka",
      filename: "12 - GomuGomu Bazooka!.mp3",
      title: "GomuGomu Bazooka!",
      sourceContext: "魯夫大招、終結攻擊。",
      sceneTags: ["finisher", "special_attack", "climax"],
      moodTags: ["heroic", "explosive", "decisive"],
      intensity: 5,
      priority: 88,
      phase: ["battle_climax"],
      characterTags: ["luffy"],
    }),
    entry({
      id: "message_from_uunan",
      filename: "13 - Message from Uunam.mp3",
      title: "Message from Uunam",
      sourceContext: "烏南留下訊息、真相揭露、意志傳承。",
      sceneTags: ["message", "legacy", "truth", "story_reveal"],
      moodTags: ["sentimental", "serious", "reflective"],
      intensity: 2,
      priority: 58,
      phase: ["story"],
    }),
    entry({
      id: "pirate_king_departure",
      filename: "14 - Departure of the King of Pirates.mp3",
      title: "Departure of the King of Pirates",
      sourceContext: "朝海賊王出航、冒險開始。",
      sceneTags: ["departure", "pirate_king", "journey_start", "adventure"],
      moodTags: ["hopeful", "epic", "adventurous"],
      intensity: 3,
      priority: 78,
      phase: ["menu", "story", "map"],
      environmentTags: ["ocean"],
    }),
    entry({
      id: "becoming_pirate_king",
      filename: "15 - I'm becoming the King Of Pirates!.mp3",
      title: "I'm becoming the King Of Pirates!",
      sourceContext: "魯夫宣言、成為海賊王的目標。",
      sceneTags: ["dream", "pirate_king", "main_theme", "determination"],
      moodTags: ["heroic", "hopeful", "energetic"],
      intensity: 3,
      priority: 82,
      phase: ["menu", "story"],
      characterTags: ["luffy"],
    }),
    entry({
      id: "reliable_friend",
      filename: "16 - A Reliable Friend.mp3",
      title: "A Reliable Friend",
      sourceContext: "可靠夥伴、友情、同伴支援。",
      sceneTags: ["friendship", "ally", "support", "crew"],
      moodTags: ["warm", "reliable", "emotional"],
      intensity: 2,
      priority: 55,
      phase: ["story", "event"],
    }),
    entry({
      id: "to_the_grand_line",
      filename: "17 - TO THE GRAND LINE.mp3",
      title: "TO THE GRAND LINE",
      sourceContext: "前往偉大航道、壯闊冒險。",
      sceneTags: ["grand_line", "ocean", "adventure", "journey", "map"],
      moodTags: ["epic", "open", "adventurous"],
      intensity: 3,
      priority: 90,
      phase: ["map", "menu"],
      environmentTags: ["ocean"],
    }),
    entry({
      id: "duel",
      filename: "18 - Duel!.mp3",
      title: "Duel!",
      sourceContext: "正式決鬥、對峙、單挑。",
      sceneTags: ["duel", "battle", "one_vs_one", "combat"],
      moodTags: ["tense", "competitive", "focused"],
      intensity: 3,
      priority: 76,
      phase: ["battle_intro", "battle_loop"],
      environmentTags: ["duel"],
    }),
    entry({
      id: "party",
      filename: "19 - We did it! Party!.mp3",
      title: "We did it! Party!",
      sourceContext: "勝利後宴會、慶祝。",
      sceneTags: ["victory", "party", "celebration", "feast"],
      moodTags: ["happy", "festive", "relaxed"],
      intensity: 2,
      priority: 82,
      phase: ["victory"],
      environmentTags: ["food"],
    }),
    entry({
      id: "more_and_more",
      filename: "20 - More and yet more.mp3",
      title: "More and yet more",
      sourceContext: "冒險仍繼續、短過場。",
      sceneTags: ["transition", "adventure_continue", "next_step"],
      moodTags: ["light", "moving_forward"],
      intensity: 1,
      priority: 40,
      phase: ["event", "story"],
      loop: false,
      avoidOveruse: true,
    }),
    entry({
      id: "village_harbor",
      filename: "21 - Village Harbor.mp3",
      title: "Village Harbor",
      sourceContext: "村莊港口、平和城鎮日常。",
      sceneTags: ["village", "harbor", "town", "peaceful"],
      moodTags: ["calm", "safe", "daily"],
      intensity: 1,
      priority: 78,
      phase: ["town", "map"],
      environmentTags: ["harbor", "village"],
    }),
    entry({
      id: "luffy",
      filename: "22 - Luffy.mp3",
      title: "Luffy",
      sourceContext: "魯夫角色主題。",
      sceneTags: ["character_theme", "adventure", "optimism"],
      moodTags: ["free", "energetic", "cheerful"],
      intensity: 2,
      priority: 55,
      phase: ["story", "event"],
      characterTags: ["luffy"],
    }),
    entry({
      id: "zoro",
      filename: "23 - Zoro.mp3",
      title: "Zoro",
      sourceContext: "索隆角色主題、劍士氣場。",
      sceneTags: ["swordman", "character_theme", "cool"],
      moodTags: ["serious", "stoic", "strong"],
      intensity: 2,
      priority: 56,
      phase: ["story", "event", "battle_intro"],
      characterTags: ["zoro"],
    }),
    entry({
      id: "nami",
      filename: "24 - Nami.mp3",
      title: "Nami",
      sourceContext: "娜美角色主題、航海與機智。",
      sceneTags: ["navigator", "clever", "money", "weather"],
      moodTags: ["clever", "playful", "light"],
      intensity: 2,
      priority: 54,
      phase: ["story", "event"],
      characterTags: ["nami"],
      environmentTags: ["ocean"],
    }),
    entry({
      id: "sanji",
      filename: "25 - Sanji.mp3",
      title: "Sanji",
      sourceContext: "香吉士角色主題、紳士與料理。",
      sceneTags: ["cooking", "gentleman", "character_theme"],
      moodTags: ["cool", "romantic", "elegant"],
      intensity: 2,
      priority: 54,
      phase: ["story", "event"],
      characterTags: ["sanji"],
      environmentTags: ["food"],
    }),
    entry({
      id: "sanji_great_blues",
      filename: "26 - Sanji the Great Blues.mp3",
      title: "Sanji the Great Blues",
      sourceContext: "香吉士夢想 All Blue、料理與浪漫。",
      sceneTags: ["all_blue", "dream", "romance", "cooking"],
      moodTags: ["romantic", "dreamy", "warm"],
      intensity: 2,
      priority: 52,
      phase: ["story", "event"],
      characterTags: ["sanji"],
      environmentTags: ["food", "ocean"],
    }),
    entry({
      id: "pirate",
      filename: "27 - Pirate.mp3",
      title: "Pirate",
      sourceContext: "一般海賊、海賊世界日常。",
      sceneTags: ["pirate", "crew", "sea", "wanted", "npc"],
      moodTags: ["adventurous", "rough", "pirate"],
      intensity: 2,
      priority: 48,
      phase: ["map", "event"],
      environmentTags: ["ocean"],
    }),
    entry({
      id: "difficult",
      filename: "28 - Difficult.mp3",
      title: "Difficult",
      sourceContext: "困難、難題、局勢複雜。",
      sceneTags: ["difficult", "puzzle", "dilemma", "trouble"],
      moodTags: ["uncertain", "tense", "thoughtful"],
      intensity: 2,
      priority: 55,
      phase: ["event", "danger"],
      environmentTags: ["mystery"],
    }),
    entry({
      id: "escape",
      filename: "29 - Escape.mp3",
      title: "Escape",
      sourceContext: "逃跑、撤退、追逐。",
      sceneTags: ["escape", "chase", "retreat", "urgent"],
      moodTags: ["fast", "anxious", "tense"],
      intensity: 4,
      priority: 80,
      phase: ["escape", "danger"],
    }),
    entry({
      id: "overtaken",
      filename: "30 - Overtaken.mp3",
      title: "Overtaken",
      sourceContext: "經典壓迫與反擊曲，適合草帽團認真反擊、氣勢翻轉。",
      sceneTags: ["counterattack", "climax", "serious", "heroic", "pressure"],
      moodTags: ["epic", "intense", "powerful"],
      intensity: 5,
      priority: 95,
      phase: ["battle_climax"],
      environmentTags: ["boss", "duel"],
      avoidOveruse: true,
      cooldownMs: 300000,
    }),
    entry({
      id: "angry",
      filename: "31 - Angry.mp3",
      title: "Angry",
      sourceContext: "生氣、衝突升高。",
      sceneTags: ["anger", "conflict", "argument", "pre_battle"],
      moodTags: ["angry", "tense"],
      intensity: 3,
      priority: 65,
      phase: ["danger", "story", "battle_intro"],
    }),
    entry({
      id: "cant_escape_fight",
      filename: "32 - Can't escape, Fight!.mp3",
      title: "Can't escape, Fight!",
      sourceContext: "不能逃避、必須戰鬥。",
      sceneTags: ["forced_battle", "no_escape", "serious_fight"],
      moodTags: ["urgent", "determined", "tense"],
      intensity: 4,
      priority: 84,
      phase: ["battle_intro", "battle_loop"],
    }),
    entry({
      id: "fight_continues",
      filename: "33 - The fight continues.mp3",
      title: "The fight continues",
      sourceContext: "戰鬥持續、雙方拉鋸。",
      sceneTags: ["battle_loop", "endurance", "ongoing_fight"],
      moodTags: ["tense", "steady", "action"],
      intensity: 3,
      priority: 80,
      phase: ["battle_loop"],
    }),
    entry({
      id: "hawks_wing",
      filename: "34 - Piece of a hawk's wing.mp3",
      title: "Piece of a hawk's wing",
      sourceContext: "自由、飛翔、希望、角色內心。",
      sceneTags: ["freedom", "flying", "hope", "character_story"],
      moodTags: ["hopeful", "light", "emotional"],
      intensity: 2,
      priority: 50,
      phase: ["story", "event"],
    }),
    entry({
      id: "to_the_ocean",
      filename: "35 - To The Ocean.mp3",
      title: "To The Ocean",
      sourceContext: "出海、航行、海面旅程。",
      sceneTags: ["ocean", "sailing", "journey", "map"],
      moodTags: ["open", "calm", "adventurous"],
      intensity: 2,
      priority: 82,
      phase: ["map"],
      environmentTags: ["ocean"],
    }),
    entry({
      id: "luffys_pace",
      filename: "36 - Luffy's Pace.mp3",
      title: "Luffy's Pace",
      sourceContext: "魯夫自己的節奏、我行我素、日常搞笑。",
      sceneTags: ["comedy", "daily", "carefree"],
      moodTags: ["playful", "funny", "relaxed"],
      intensity: 1,
      priority: 43,
      phase: ["event", "story"],
      characterTags: ["luffy"],
    }),
    entry({
      id: "sanjis_feast",
      filename: "37 - Sanji's Feast.mp3",
      title: "Sanji's Feast",
      sourceContext: "香吉士盛宴、料理、吃飯。",
      sceneTags: ["food", "feast", "cooking", "recovery"],
      moodTags: ["warm", "festive", "satisfying"],
      intensity: 2,
      priority: 70,
      phase: ["event", "town", "shop"],
      characterTags: ["sanji"],
      environmentTags: ["food"],
    }),
    entry({
      id: "food_fight",
      filename: "38 - Food Fight.mp3",
      title: "Food Fight",
      sourceContext: "食物爭奪、吃飯混亂、搞笑衝突。",
      sceneTags: ["food", "comedy", "chaos"],
      moodTags: ["funny", "chaotic", "fast"],
      intensity: 2,
      priority: 48,
      phase: ["event"],
      characterTags: ["luffy"],
      environmentTags: ["food"],
    }),
    entry({
      id: "merry_farewell",
      filename: "39 - Caravel Farewell - Onward Going Merry!.mp3",
      title: "Caravel Farewell - Onward Going Merry!",
      sourceContext: "船、離別、啟程、Going Merry 意象。",
      sceneTags: ["ship", "farewell", "departure", "memory"],
      moodTags: ["sentimental", "hopeful", "gentle"],
      intensity: 2,
      priority: 58,
      phase: ["story"],
      environmentTags: ["ocean"],
    }),
    entry({
      id: "storms_stars",
      filename: "40 - If There Are Storms There Are Stars Too.mp3",
      title: "If There Are Storms There Are Stars Too",
      sourceContext: "風暴後仍有星星，苦難後希望。",
      sceneTags: ["storm", "hope", "recovery", "emotional"],
      moodTags: ["healing", "hopeful", "bittersweet"],
      intensity: 2,
      priority: 52,
      phase: ["story", "event"],
    }),
    entry({
      id: "mother_sea",
      filename: "41 - Mother Sea.mp3",
      title: "Mother Sea",
      sourceContext: "母なる海，海洋、包容、回憶、療癒。",
      sceneTags: ["sea", "mother_sea", "memory", "healing", "emotional"],
      moodTags: ["gentle", "sad", "calm"],
      intensity: 2,
      priority: 55,
      phase: ["story", "event"],
      environmentTags: ["ocean"],
    }),
    entry({
      id: "stealth_night_shadow",
      filename: "42 - Stealthy Night Shadow.mp3",
      title: "Stealthy Night Shadow",
      sourceContext: "夜晚黑影逼近、潛入、未知威脅。",
      sceneTags: ["stealth", "mystery", "shadow", "danger"],
      moodTags: ["mysterious", "tense", "dark"],
      intensity: 3,
      priority: 72,
      phase: ["danger", "event", "story"],
      environmentTags: ["night", "mystery"],
    }),
    entry({
      id: "landing_at_town",
      filename: "43 - Landing at Town.mp3",
      title: "Landing at Town",
      sourceContext: "登陸城鎮、新地點探索。",
      sceneTags: ["landing", "town", "exploration", "island"],
      moodTags: ["fresh", "calm", "curious"],
      intensity: 2,
      priority: 78,
      phase: ["town", "map", "event"],
      environmentTags: ["harbor", "village"],
    }),
    entry({
      id: "desperate_situation",
      filename: "44 - Desperate Situation.mp3",
      title: "Desperate Situation",
      sourceContext: "絕體絕命、危機、崩盤。",
      sceneTags: ["desperate", "crisis", "low_hp", "danger", "boss_pressure"],
      moodTags: ["urgent", "hopeless", "intense"],
      intensity: 5,
      priority: 88,
      phase: ["danger", "battle_climax"],
      environmentTags: ["boss"],
    }),
    entry({
      id: "one_hour_evacuation",
      filename: "45 - One Hour Evacuation.mp3",
      title: "One Hour Evacuation",
      sourceContext: "限時撤離、倒數、緊急危機。",
      sceneTags: ["evacuation", "countdown", "escape", "urgent"],
      moodTags: ["fast", "anxious", "dangerous"],
      intensity: 4,
      priority: 84,
      phase: ["escape", "danger"],
    }),
    entry({
      id: "cant_lose",
      filename: "46 - I Can't Lose!.mp3",
      title: "I Can't Lose!",
      sourceContext: "不能輸、最後堅持、逆轉前兆。",
      sceneTags: ["determination", "comeback", "low_hp", "hero"],
      moodTags: ["heroic", "intense", "hopeful"],
      intensity: 5,
      priority: 90,
      phase: ["battle_climax"],
    }),
    entry({
      id: "spirit_of_zoro",
      filename: "47 - Spirit of Zoro.mp3",
      title: "Spirit of Zoro",
      sourceContext: "索隆精神、劍士意志、重傷不倒。",
      sceneTags: ["swordman", "spirit", "endurance"],
      moodTags: ["stoic", "heroic", "serious"],
      intensity: 4,
      priority: 74,
      phase: ["story", "battle_climax"],
      characterTags: ["zoro"],
    }),
    entry({
      id: "we_did_it",
      filename: "48 - We Did it!.mp3",
      title: "We Did it!",
      sourceContext: "成功、勝利、危機解除。",
      sceneTags: ["victory", "success", "clear"],
      moodTags: ["happy", "relieved"],
      intensity: 2,
      priority: 82,
      phase: ["victory"],
    }),
    entry({
      id: "after_eating_grand_line",
      filename: "49 - After Eating, Grand Line!.mp3",
      title: "After Eating, Grand Line!",
      sourceContext: "吃飽後再出發、休息結束。",
      sceneTags: ["food", "rest", "journey_continue", "grand_line"],
      moodTags: ["light", "cheerful", "moving_forward"],
      intensity: 1,
      priority: 45,
      phase: ["event", "map"],
      environmentTags: ["food", "ocean"],
    }),
    entry({
      id: "chopper",
      filename: "50 - Tony-Tony Chopper.mp3",
      title: "Tony-Tony Chopper",
      sourceContext: "喬巴角色主題、治療、可愛。",
      sceneTags: ["doctor", "healing", "cute"],
      moodTags: ["cute", "warm", "healing"],
      intensity: 1,
      priority: 76,
      phase: ["event", "story", "town"],
      characterTags: ["chopper"],
    }),
    entry({
      id: "grand_line_cold_island",
      filename: "51 - Grand Line Island (Cold).mp3",
      title: "Grand Line Island (Cold)",
      sourceContext: "偉大航道寒冷島嶼、冬島、雪地。",
      sceneTags: ["snow", "winter_island", "grand_line", "environment"],
      moodTags: ["cold", "strange", "isolated"],
      intensity: 2,
      priority: 74,
      phase: ["map", "town", "event"],
      environmentTags: ["cold"],
    }),
    entry({
      id: "grand_line_hot_island",
      filename: "52 - Grand Line Island (Hot).mp3",
      title: "Grand Line Island (Hot)",
      sourceContext: "偉大航道炎熱島嶼、沙漠、火山。",
      sceneTags: ["desert", "volcano", "summer_island", "grand_line", "environment"],
      moodTags: ["hot", "exotic", "tense"],
      intensity: 2,
      priority: 74,
      phase: ["map", "town", "event"],
      environmentTags: ["hot"],
    }),
    entry({
      id: "miss_allsunday",
      filename: "53 - Miss Allsunday.mp3",
      title: "Miss Allsunday",
      sourceContext: "Miss All Sunday / 羅賓早期身分、神秘情報、古代文字。",
      sceneTags: ["mystery", "intelligence", "ancient_text", "secret"],
      moodTags: ["elegant", "mysterious", "dangerous"],
      intensity: 3,
      priority: 72,
      phase: ["story", "event"],
      characterTags: ["robin"],
      environmentTags: ["mystery"],
    }),
    entry({
      id: "umi_no_namamono",
      filename: "54 - Umi no Namamono.mp3",
      title: "Umi no Namamono",
      sourceContext: "海中生物、海獸、海王類。",
      sceneTags: ["sea_creature", "sea_monster", "ocean_danger", "monster"],
      moodTags: ["strange", "dangerous", "mysterious"],
      intensity: 3,
      priority: 75,
      phase: ["event", "danger", "battle_intro"],
      environmentTags: ["ocean"],
    }),
    entry({
      id: "shinkenshoubu",
      filename: "55 - Shinkenshoubu!.mp3",
      title: "Shinkenshoubu!",
      sourceContext: "真劍勝負、認真決戰。",
      sceneTags: ["serious_battle", "duel", "boss", "decisive_fight"],
      moodTags: ["serious", "focused", "intense"],
      intensity: 4,
      priority: 82,
      phase: ["battle_intro", "battle_loop"],
      environmentTags: ["boss", "duel"],
    }),
    entry({
      id: "mezase_one_piece",
      filename: "56 - Mezase One Piece!.mp3",
      title: "Mezase One Piece!",
      sourceContext: "目標 One Piece、夢想、旅程總結。",
      sceneTags: ["one_piece", "dream", "final_goal", "ending", "adventure"],
      moodTags: ["hopeful", "epic", "conclusive"],
      intensity: 4,
      priority: 86,
      phase: ["menu", "story", "victory"],
    }),
  ]);

  global.BGM_METADATA = BGM_METADATA;
  global.BGM_PHASES = Object.freeze([
    "menu",
    "map",
    "town",
    "shop",
    "event",
    "battle_intro",
    "battle_loop",
    "battle_climax",
    "victory",
    "story",
    "danger",
    "escape",
  ]);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { BGM_METADATA: global.BGM_METADATA, BGM_PHASES: global.BGM_PHASES };
  }
})(typeof window !== "undefined" ? window : globalThis);

(function (global) {
  const PHASE_ALIASES = Object.freeze({
    battle: ["battle_intro", "battle_loop"],
    battle_start: ["battle_intro"],
    battle_normal: ["battle_loop"],
    climax: ["battle_climax"],
    island: ["map", "event"],
    sea: ["map"],
    harbor: ["town", "map"],
    store: ["shop"],
    hospital: ["town", "event"],
    tavern: ["town", "event"],
  });

  function list(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
    return String(value).split(/[,\s]+/).map((item) => item.trim()).filter(Boolean);
  }

  function unique(items) {
    return [...new Set(items.filter(Boolean))];
  }

  function lowerTags(items) {
    return unique(list(items).map((item) => item.toLowerCase()));
  }

  function expandPhases(context) {
    const phases = lowerTags(context.phase);
    if (!phases.length && context.battlePhase) {
      phases.push(`battle_${String(context.battlePhase).toLowerCase()}`);
    }
    if (!phases.length) phases.push("map");
    const expanded = [];
    phases.forEach((phase) => {
      expanded.push(phase);
      if (PHASE_ALIASES[phase]) expanded.push(...PHASE_ALIASES[phase]);
    });
    if (context.battlePhase === "climax") expanded.push("battle_climax");
    return unique(expanded);
  }

  function phaseMatches(meta, phases) {
    const metaPhases = lowerTags(meta.phase);
    return phases.some((phase) => metaPhases.includes(phase));
  }

  function desiredIntensity(context) {
    const phase = String(context.phase || "");
    const battlePhase = String(context.battlePhase || "");
    let desired = 2;
    if (phase.includes("battle")) desired = 3;
    if (phase === "danger" || context.dangerLevel >= 3) desired = Math.max(desired, 3);
    if (context.isForcedBattle || context.isBoss || context.dangerLevel >= 4) desired = Math.max(desired, 4);
    if (battlePhase === "climax" || context.dangerLevel >= 5 && !String(context.phase || "").includes("battle_intro")) desired = 5;
    if (phase === "shop" || phase === "town") desired = Math.min(desired, 2);
    if (phase === "victory") desired = Math.min(Math.max(desired, 2), 4);
    return Math.max(1, Math.min(5, desired));
  }

  function isCounterattackContext(context, eventTags) {
    return Boolean(
      context.isCounterattack ||
      context.playerIsCounterattacking ||
      context.counterattack ||
      context.momentum === "counterattack" ||
      eventTags.includes("counterattack") ||
      eventTags.includes("comeback")
    );
  }

  function buildTagProfile(context) {
    const eventTags = lowerTags(context.eventTags);
    const tags = [
      ...lowerTags(context.sceneType),
      ...lowerTags(context.locationType),
      ...lowerTags(context.islandType),
      ...lowerTags(context.enemyType),
      ...lowerTags(context.environment),
      ...eventTags,
    ];
    const moodTags = lowerTags(context.storyMood);

    const battlePhase = String(context.battlePhase || "").toLowerCase();
    if (battlePhase) tags.push(battlePhase, `battle_${battlePhase}`);
    if (context.isBoss) tags.push("boss", "boss_appear", "boss_pressure", "threat", "danger");
    if (context.isDuel) tags.push("duel", "one_vs_one", "serious_battle");
    if (context.isForcedBattle) tags.push("forced_battle", "no_escape", "serious_fight");
    if (Number(context.dangerLevel || 0) >= 3) tags.push("danger", "threat", "trouble");
    if (Number(context.dangerLevel || 0) >= 4) tags.push("crisis", "urgent", "dangerous");
    if (Number(context.playerHpRate) < 0.3 && battlePhase === "climax") {
      tags.push("low_hp", "desperate", "comeback", "determination");
      moodTags.push("intense", "hopeful");
    }
    if (Number(context.enemyHpRate) < 0.35 && isCounterattackContext(context, eventTags)) {
      tags.push("counterattack", "heroic", "climax", "decisive_fight");
      moodTags.push("heroic", "powerful");
    }

    return {
      sceneTags: unique(tags.map((item) => String(item).toLowerCase())),
      moodTags: unique(moodTags.map((item) => String(item).toLowerCase())),
      characterTags: lowerTags(context.character),
      environmentTags: lowerTags(context.environment),
    };
  }

  function cooldownAllows(meta, context, now) {
    if (!meta.avoidOveruse) return true;
    const playedAtById = context.playedAtById || context.playHistory || {};
    const lastPlayedAt = Number(playedAtById[meta.id] || 0);
    return !lastPlayedAt || now - lastPlayedAt >= Number(meta.cooldownMs || 0);
  }

  function scoreOne(meta, context, phases, profile, now) {
    const metaScene = lowerTags(meta.sceneTags);
    const metaMood = lowerTags(meta.moodTags);
    const metaCharacters = lowerTags(meta.characterTags);
    const metaEnv = lowerTags(meta.environmentTags);
    const matchedTags = [];
    const scoreParts = [];
    let score = 0;
    const metaId = String(meta.id || "").toLowerCase();
    const preferredIds = lowerTags(context.preferredBgmIds);
    const preferredIndex = preferredIds.indexOf(metaId);

    if (preferredIndex >= 0) {
      const value = Math.max(70, 220 - preferredIndex * 65);
      score += value;
      scoreParts.push(`場景指定第 ${preferredIndex + 1} 順位 +${value}`);
    }

    const phaseMatchCount = phases.filter((phase) => lowerTags(meta.phase).includes(phase)).length;
    if (phaseMatchCount) {
      score += 35 + Math.min(12, (phaseMatchCount - 1) * 4);
      scoreParts.push(`階段符合 +${35 + Math.min(12, (phaseMatchCount - 1) * 4)}`);
    }

    const sceneMatches = profile.sceneTags.filter((tag) => metaScene.includes(tag));
    if (sceneMatches.length) {
      const value = sceneMatches.length * 8;
      score += value;
      matchedTags.push(...sceneMatches);
      scoreParts.push(`場景標籤 ${sceneMatches.join(", ")} +${value}`);
    }

    const moodMatches = profile.moodTags.filter((tag) => metaMood.includes(tag) || metaScene.includes(tag));
    if (moodMatches.length) {
      const value = moodMatches.length * 6;
      score += value;
      matchedTags.push(...moodMatches);
      scoreParts.push(`情緒標籤 ${moodMatches.join(", ")} +${value}`);
    }

    const characterMatches = profile.characterTags.filter((tag) => metaCharacters.includes(tag) || metaScene.includes(tag));
    if (characterMatches.length) {
      const value = Math.min(16, characterMatches.length * 12);
      score += value;
      matchedTags.push(...characterMatches);
      scoreParts.push(`角色符合 ${characterMatches.join(", ")} +${value}`);
    }

    const envMatches = profile.environmentTags.filter((tag) => metaEnv.includes(tag) || metaScene.includes(tag));
    if (envMatches.length) {
      const value = envMatches.length * 9;
      score += value;
      matchedTags.push(...envMatches);
      scoreParts.push(`環境符合 ${envMatches.join(", ")} +${value}`);
    }

    const targetIntensity = desiredIntensity(context);
    const intensityValue = Math.max(-8, 8 - Math.abs(Number(meta.intensity || 1) - targetIntensity) * 3);
    score += intensityValue;
    scoreParts.push(`強度貼近 ${targetIntensity}：${intensityValue >= 0 ? "+" : ""}${intensityValue}`);

    const priorityValue = Number(meta.priority || 50) / 10;
    score += priorityValue;
    scoreParts.push(`優先級 +${priorityValue.toFixed(1)}`);

    const lastPlayedBgmId = String(context.lastPlayedBgmId || "").toLowerCase();
    if (lastPlayedBgmId && metaId === lastPlayedBgmId) {
      score += 22;
      scoreParts.push("目前曲目可延續 +22");
    }
    const recentlyPlayedIds = lowerTags(context.recentlyPlayedIds);
    if (recentlyPlayedIds.includes(metaId) && metaId !== lastPlayedBgmId) {
      const penalty = meta.avoidOveruse ? -30 : -14;
      score += penalty;
      scoreParts.push(`最近播過 ${penalty}`);
    }
    if (meta.avoidOveruse) {
      score -= 6;
      scoreParts.push("避免過度使用 -6");
    }
    if (!cooldownAllows(meta, context, now)) {
      score = -Infinity;
      scoreParts.push("冷卻中，排除");
    }

    return {
      meta,
      score,
      matchedTags: unique(matchedTags),
      reasonParts: scoreParts,
    };
  }

  function chooseBgm(context = {}) {
    const metadata = context.metadata || global.BGM_METADATA || [];
    const now = Number(context.now || Date.now());
    const phases = expandPhases(context);
    const preferredIds = lowerTags(context.preferredBgmIds);
    const lastPlayedBgmId = String(context.lastPlayedBgmId || "").toLowerCase();
    const allowIntensityFive = Boolean(context.battlePhase === "climax" || phases.includes("battle_climax") || context.allowIntensityFive);
    const profile = buildTagProfile(context);

    let candidates = metadata.filter((meta) => phaseMatches(meta, phases));
    if (!candidates.length) candidates = metadata.slice();
    preferredIds.forEach((id) => {
      const preferred = metadata.find((meta) => String(meta.id || "").toLowerCase() === id);
      if (preferred && !candidates.includes(preferred)) candidates.push(preferred);
    });
    candidates = candidates.filter((meta) => allowIntensityFive || preferredIds.includes(String(meta.id || "").toLowerCase()) || Number(meta.intensity || 1) < 5);
    if (context.forceRetune && lastPlayedBgmId) {
      const alternatives = candidates.filter((meta) => String(meta.id || "").toLowerCase() !== lastPlayedBgmId);
      if (alternatives.length) candidates = alternatives;
    }

    const scored = candidates.map((meta) => scoreOne(meta, context, phases, profile, now));
    const viable = scored.filter((item) => Number.isFinite(item.score));
    const pool = viable.length ? viable : scored;
    pool.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if ((b.meta.priority || 0) !== (a.meta.priority || 0)) return (b.meta.priority || 0) - (a.meta.priority || 0);
      return String(a.meta.id).localeCompare(String(b.meta.id));
    });

    const best = pool[0];
    if (!best) return null;
    const reason = best.reasonParts.join("；");
    return {
      id: best.meta.id,
      filename: best.meta.filename,
      title: best.meta.title,
      reason,
      matchedTags: best.matchedTags,
      intensity: best.meta.intensity,
      shouldLoop: Boolean(best.meta.loop),
      cueInSec: Math.max(0, Number(best.meta.cueInSec || 0)),
      cueOutSec: Math.max(0, Number(best.meta.cueOutSec || 0)),
      gainDb: Number(best.meta.gainDb || 0),
      sourceContext: best.meta.sourceContext,
      score: Math.round(best.score * 100) / 100,
    };
  }

  global.chooseBgm = chooseBgm;
  global.BgmChooser = Object.freeze({
    chooseBgm,
    buildTagProfile,
    desiredIntensity,
    expandPhases,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = global.BgmChooser;
  }
})(typeof window !== "undefined" ? window : globalThis);

(function (global) {
  let parentManager = null;
  try {
    parentManager = global.parent && global.parent !== global ? global.parent.BgmManager : null;
  } catch (_error) {
    parentManager = null;
  }
  if (parentManager) {
    global.BgmManager = parentManager;
    return;
  }

  const DEFAULT_BASE_PATH = "audio/board_game/bgm_new/";
  const DEFAULT_FADE_MS = 2800;
  const DEFAULT_MIN_HOLD_MS = 45000;
  const BATTLE_MIN_HOLD_MS = 90000;
  const CLIMAX_MIN_HOLD_MS = 45000;
  const AUDIO_READY_TIMEOUT_MS = 12000;
  const HISTORY_LIMIT = 8;

  function storageGet(key, fallback) {
    try {
      const value = global.localStorage?.getItem(key);
      return value == null ? fallback : value;
    } catch (_error) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      global.localStorage?.setItem(key, value);
    } catch (_error) {
      // Audio preferences are optional.
    }
  }

  const state = {
    basePath: DEFAULT_BASE_PATH,
    enabled: storageGet("board_bgm_enabled", "1") !== "0",
    unlocked: false,
    volume: Math.max(0, Math.min(1, Number(storageGet("board_bgm_volume", "0.34")))),
    currentAudio: null,
    currentChoice: null,
    currentContextKey: "",
    currentScopeKey: "",
    currentPhaseGroup: "",
    currentStartedAt: 0,
    pendingContext: null,
    desiredRequest: null,
    queuedRequest: null,
    requestSerial: 0,
    transitionTimer: null,
    transitionTimerKey: "",
    transitionTimerDueAt: 0,
    holdTimer: null,
    inFlightAudio: null,
    inFlightRequest: null,
    recentlyPlayedIds: [],
    playedAtById: {},
    climaxSwitchedScopes: {},
    switchLocks: new Set(),
    audioFocus: new Map(),
    audioFocusSerial: 0,
    outgoingAudios: new Map(),
  };

  const audioFadeTokens = new WeakMap();
  const audioLoopCleanups = new WeakMap();
  const cancelledAudios = new WeakSet();

  function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, Number(value || 0)));
  }

  function nowMs() {
    return Date.now();
  }

  function frameNow() {
    return global.performance?.now?.() ?? nowMs();
  }

  function nextFrame(callback) {
    if (typeof global.requestAnimationFrame === "function") return global.requestAnimationFrame(callback);
    return global.setTimeout(() => callback(frameNow()), 16);
  }

  function encodeFilePath(filename) {
    return String(filename || "").split("/").map((part) => encodeURIComponent(part)).join("/");
  }

  function srcFor(filename) {
    return `${state.basePath}${encodeFilePath(filename)}`;
  }

  function contextKey(context = {}) {
    return JSON.stringify({
      phase: context.phase || "",
      sceneType: context.sceneType || "",
      locationType: context.locationType || "",
      islandType: context.islandType || "",
      enemyType: context.enemyType || "",
      isBoss: Boolean(context.isBoss),
      isForcedBattle: Boolean(context.isForcedBattle),
      isDuel: Boolean(context.isDuel),
      battlePhase: context.battlePhase || "",
      dangerLevel: Number(context.dangerLevel || 0),
      environment: context.environment || "",
      eventTags: context.eventTags || [],
      storyMood: context.storyMood || "",
      musicScope: context.musicScope || "",
      preferredBgmIds: context.preferredBgmIds || [],
    });
  }

  function phaseGroup(context = {}) {
    const phase = String(context.phase || "");
    if (phase.startsWith("battle_")) return "battle";
    if (phase === "danger" || phase === "escape") return "danger";
    return phase || String(context.sceneType || "map");
  }

  function stableScopeKey(context = {}) {
    if (context.musicScope) return String(context.musicScope);
    const group = phaseGroup(context);
    if (group === "battle") {
      return `battle:${context.battleId || context.locationId || context.islandId || context.enemyType || "current"}`;
    }
    if (group === "map") return `map:${context.locationType || ""}:${context.environment || ""}`;
    return `${group}:${context.locationType || ""}:${context.islandType || ""}:${context.environment || ""}`;
  }

  function isClimaxContext(context = {}) {
    return context.phase === "battle_climax" || context.battlePhase === "climax";
  }

  function minHoldMs(context = {}, options = {}) {
    if (options.minHoldMs != null) return Math.max(0, Number(options.minHoldMs));
    if (context.minBgmHoldMs != null) return Math.max(0, Number(context.minBgmHoldMs));
    if (phaseGroup(context) === "battle") return BATTLE_MIN_HOLD_MS;
    return DEFAULT_MIN_HOLD_MS;
  }

  function normalizedOptions(options = {}) {
    const legacyImmediate = options.force === true;
    return {
      ...options,
      transition: options.transition || (legacyImmediate ? "immediate" : "defer"),
      transitionDelayMs: Math.max(0, Number(options.transitionDelayMs ?? options.deferMs ?? 0)),
      fadeMs: Math.max(0, Number(options.fadeMs ?? DEFAULT_FADE_MS)),
      restart: Boolean(options.restart),
      forceRetune: Boolean(options.forceRetune),
      ignoreLock: Boolean(options.ignoreLock),
    };
  }

  function makeRequest(context = {}, options = {}) {
    const normalized = normalizedOptions(options);
    return {
      serial: ++state.requestSerial,
      context: { ...context },
      options: normalized,
      key: contextKey(context),
      scopeKey: stableScopeKey(context),
      phaseGroup: phaseGroup(context),
      requestedAt: nowMs(),
    };
  }

  function sameRequestScene(a, b) {
    return Boolean(a && b && a.key === b.key && a.scopeKey === b.scopeKey);
  }

  function activeFocusRatio() {
    let ratio = 1;
    state.audioFocus.forEach((entry) => {
      ratio = Math.min(ratio, clamp(entry.volumeRatio, 0, 1));
    });
    return ratio;
  }

  function gainRatio(choice = state.currentChoice) {
    return Math.pow(10, Number(choice?.gainDb || 0) / 20);
  }

  function targetVolume(choice = state.currentChoice) {
    return clamp(state.volume * gainRatio(choice) * activeFocusRatio());
  }

  function makeAudio(choice) {
    const AudioClass = global.Audio || (typeof Audio !== "undefined" ? Audio : null);
    if (!AudioClass) throw new Error("Audio API unavailable");
    const audio = new AudioClass();
    audio.preload = "auto";
    audio.loop = false;
    audio.volume = 0;
    audio.src = srcFor(choice.filename);
    return audio;
  }

  function rememberPlayed(id, now = nowMs()) {
    state.playedAtById[id] = now;
    state.recentlyPlayedIds = [id, ...state.recentlyPlayedIds.filter((item) => item !== id)].slice(0, HISTORY_LIMIT);
  }

  function fadeAudio(audio, requestedVolume, durationMs = DEFAULT_FADE_MS) {
    if (!audio) return Promise.resolve(false);
    const token = Number(audioFadeTokens.get(audio) || 0) + 1;
    audioFadeTokens.set(audio, token);
    const from = clamp(audio.volume);
    const to = clamp(requestedVolume);
    const duration = Math.max(0, Number(durationMs || 0));
    if (!duration) {
      try { audio.volume = to; } catch (_error) {}
      return Promise.resolve(true);
    }
    const start = frameNow();
    return new Promise((resolve) => {
      const tick = (time) => {
        if (audioFadeTokens.get(audio) !== token) {
          resolve(false);
          return;
        }
        const progress = Math.min(1, (time - start) / duration);
        try { audio.volume = clamp(from + (to - from) * progress); } catch (_error) {}
        if (progress < 1) nextFrame(tick);
        else resolve(true);
      };
      nextFrame(tick);
    });
  }

  function stopAudio(audio, clearSource = true) {
    if (!audio) return;
    cancelledAudios.add(audio);
    state.outgoingAudios.delete(audio);
    audioFadeTokens.set(audio, Number(audioFadeTokens.get(audio) || 0) + 1);
    const cleanupLoop = audioLoopCleanups.get(audio);
    if (cleanupLoop) cleanupLoop();
    audioLoopCleanups.delete(audio);
    try { audio.pause(); } catch (_error) {}
    if (!clearSource) return;
    try { audio.removeAttribute("src"); } catch (_error) {}
    try { audio.load(); } catch (_error) {}
  }

  function outgoingLevel(entry, time = frameNow()) {
    const progress = entry.levelDuration ? Math.min(1, Math.max(0, (time - entry.levelStartedAt) / entry.levelDuration)) : 1;
    return entry.levelFrom + (entry.levelTo - entry.levelFrom) * progress;
  }

  function updateOutgoingVolume(audio, entry, time = frameNow()) {
    const remaining = Math.max(0, 1 - (time - entry.startedAt) / entry.duration);
    try { audio.volume = clamp(outgoingLevel(entry, time) * entry.initialRatio * remaining); } catch (_error) {}
  }

  function retireAudio(audio, choice, durationMs) {
    if (!audio) return;
    const duration = Math.max(0, Number(durationMs || 0));
    const level = targetVolume(choice);
    if (!duration || !level || !audio.volume) {
      stopAudio(audio);
      return;
    }
    // A retiring cue must never loop or be revived by a canceled fade-in.
    audioFadeTokens.set(audio, Number(audioFadeTokens.get(audio) || 0) + 1);
    audioLoopCleanups.get(audio)?.();
    audioLoopCleanups.delete(audio);
    const time = frameNow();
    const entry = {
      choice, duration, startedAt: time, deadline: time + duration,
      initialRatio: Math.min(1, clamp(audio.volume) / level),
      levelFrom: level, levelTo: level, levelStartedAt: time, levelDuration: 0,
      stopping: false,
    };
    state.outgoingAudios.set(audio, entry);
    const tick = (now) => {
      if (state.outgoingAudios.get(audio) !== entry || entry.stopping) return;
      if (now >= entry.deadline) { stopAudio(audio); return; }
      updateOutgoingVolume(audio, entry, now);
      nextFrame(tick);
    };
    nextFrame(tick);
  }

  function retargetOutgoingAudios(durationMs) {
    const time = frameNow();
    state.outgoingAudios.forEach((entry, audio) => {
      if (entry.stopping) return;
      entry.levelFrom = outgoingLevel(entry, time);
      entry.levelTo = targetVolume(entry.choice);
      entry.levelStartedAt = time;
      entry.levelDuration = Math.max(0, Number(durationMs || 0));
      updateOutgoingVolume(audio, entry, time);
    });
  }

  function stopOutgoingAudios(durationMs = 0) {
    const time = frameNow();
    state.outgoingAudios.forEach((entry, audio) => {
      entry.stopping = true;
      entry.stopDeadline = Math.min(entry.deadline, entry.stopDeadline ?? Infinity, time + Math.max(0, Number(durationMs || 0)));
      void fadeAudio(audio, 0, Math.max(0, entry.stopDeadline - time)).then((finished) => {
        if (finished && state.outgoingAudios.get(audio) === entry) stopAudio(audio);
      });
    });
  }

  function installCueLoop(audio, choice) {
    const cueIn = Math.max(0, Number(choice?.cueInSec || 0));
    const cueOut = Math.max(0, Number(choice?.cueOutSec || 0));
    const shouldLoop = choice?.shouldLoop !== false;
    if (!shouldLoop && !cueOut) return;
    let restarting = false;
    let active = true;
    const restartAtCue = async (smooth = true) => {
      if (!shouldLoop || restarting || !active) return;
      restarting = true;
      if (smooth) {
        const faded = await fadeAudio(audio, 0, 480);
        if (!faded || !active) {
          restarting = false;
          return;
        }
      }
      try { audio.currentTime = cueIn; } catch (_error) {}
      const playResult = audio.play?.();
      if (playResult?.catch) {
        try { await playResult; } catch (_error) {}
      }
      if (active) await fadeAudio(audio, targetVolume(choice), smooth ? 620 : 260);
      restarting = false;
    };
    const onTimeUpdate = () => {
      const fadeStart = Math.max(cueIn + 0.25, cueOut - 0.72);
      if (cueOut > cueIn && Number(audio.currentTime || 0) >= fadeStart) void restartAtCue(true);
    };
    const onEnded = () => void restartAtCue(false);
    audio.addEventListener?.("timeupdate", onTimeUpdate);
    audio.addEventListener?.("ended", onEnded);
    audioLoopCleanups.set(audio, () => {
      active = false;
      audio.removeEventListener?.("timeupdate", onTimeUpdate);
      audio.removeEventListener?.("ended", onEnded);
    });
  }

  function waitForMetadata(audio) {
    if (Number(audio.readyState || 0) >= 1) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let finished = false;
      const finish = (error) => {
        if (finished) return;
        finished = true;
        global.clearTimeout(timeoutId);
        audio.removeEventListener?.("loadedmetadata", onReady);
        audio.removeEventListener?.("canplay", onReady);
        audio.removeEventListener?.("error", onError);
        if (error) reject(error);
        else resolve();
      };
      const onReady = () => finish();
      const onError = () => finish(new Error("BGM audio load failed"));
      const timeoutId = global.setTimeout(() => finish(new Error("BGM audio load timeout")), AUDIO_READY_TIMEOUT_MS);
      audio.addEventListener?.("loadedmetadata", onReady);
      audio.addEventListener?.("canplay", onReady);
      audio.addEventListener?.("error", onError);
      try { audio.load?.(); } catch (_error) {}
    });
  }

  function seekToCue(audio, choice) {
    const cueIn = Math.max(0, Number(choice?.cueInSec || 0));
    if (!cueIn) return;
    const duration = Number(audio.duration || 0);
    if (Number.isFinite(duration) && duration > 0 && cueIn >= duration) return;
    try { audio.currentTime = cueIn; } catch (_error) {}
  }

  function clearTransitionTimer() {
    if (state.transitionTimer != null) global.clearTimeout(state.transitionTimer);
    state.transitionTimer = null;
    state.transitionTimerKey = "";
    state.transitionTimerDueAt = 0;
  }

  function clearHoldTimer() {
    if (state.holdTimer != null) global.clearTimeout(state.holdTimer);
    state.holdTimer = null;
  }

  function choiceForRequest(request) {
    const choose = global.chooseBgm;
    if (typeof choose !== "function") return null;
    return choose({
      ...request.context,
      forceRetune: Boolean(request.options.forceRetune || request.context.forceRetune),
      lastPlayedBgmId: state.currentChoice?.id || request.context.lastPlayedBgmId || "",
      recentlyPlayedIds: state.recentlyPlayedIds,
      playedAtById: state.playedAtById,
    });
  }

  function requestIsCurrent(request) {
    return Boolean(state.desiredRequest && (state.desiredRequest.serial === request.serial || sameRequestScene(state.desiredRequest, request)));
  }

  function commitRequestContext(request, choice, startedAt = state.currentStartedAt) {
    const activeRequest = sameRequestScene(state.desiredRequest, request) ? state.desiredRequest : request;
    state.currentChoice = choice;
    state.currentContextKey = activeRequest.key;
    state.currentScopeKey = activeRequest.scopeKey;
    state.currentPhaseGroup = activeRequest.phaseGroup;
    state.currentStartedAt = startedAt;
    if (activeRequest.phaseGroup === "battle" && isClimaxContext(activeRequest.context)) {
      state.climaxSwitchedScopes[activeRequest.scopeKey] = nowMs();
    }
    if (sameRequestScene(state.queuedRequest, activeRequest)) state.queuedRequest = null;
    if (sameRequestScene(state.pendingContext, activeRequest)) state.pendingContext = null;
  }

  async function performTransition(choice, request) {
    if (!choice || !request) return null;
    if (state.currentChoice?.id === choice.id && state.currentAudio && !request.options.restart) {
      commitRequestContext(request, state.currentChoice);
      if (state.currentAudio.paused && state.enabled && state.unlocked) {
        try { await state.currentAudio.play(); } catch (_error) { state.unlocked = false; state.pendingContext = request; }
      }
      void fadeAudio(state.currentAudio, targetVolume(state.currentChoice), request.options.fadeMs);
      return state.currentChoice;
    }

    if (state.inFlightAudio && state.inFlightRequest && !sameRequestScene(state.inFlightRequest, request)) {
      stopAudio(state.inFlightAudio);
      state.inFlightAudio = null;
      state.inFlightRequest = null;
    }

    let nextAudio;
    try {
      nextAudio = makeAudio(choice);
    } catch (_error) {
      return state.currentChoice;
    }
    state.inFlightAudio = nextAudio;
    state.inFlightRequest = request;

    try {
      // Start playback in the gesture call stack; waiting for metadata first
      // loses activation on mobile browsers. The candidate stays silent until
      // its cue is ready and the current request has been checked below.
      const ready = waitForMetadata(nextAudio);
      const playing = nextAudio.play();
      await Promise.all([ready, playing]);
      seekToCue(nextAudio, choice);
      installCueLoop(nextAudio, choice);
    } catch (_error) {
      const wasCancelled = cancelledAudios.has(nextAudio);
      if (state.inFlightAudio === nextAudio) {
        state.inFlightAudio = null;
        state.inFlightRequest = null;
      }
      stopAudio(nextAudio);
      if (!wasCancelled && requestIsCurrent(request)) {
        state.unlocked = false;
        state.pendingContext = state.desiredRequest || request;
      }
      return state.currentChoice;
    }

    if (cancelledAudios.has(nextAudio) || !requestIsCurrent(request) || !state.enabled || state.switchLocks.size && !request.options.ignoreLock) {
      if (requestIsCurrent(request) && state.switchLocks.size && !request.options.ignoreLock) {
        state.queuedRequest = state.desiredRequest || request;
      }
      stopAudio(nextAudio);
      if (state.inFlightAudio === nextAudio) {
        state.inFlightAudio = null;
        state.inFlightRequest = null;
      }
      return state.currentChoice;
    }

    const oldAudio = state.currentAudio;
    const oldChoice = state.currentChoice;
    state.currentAudio = nextAudio;
    state.inFlightAudio = null;
    state.inFlightRequest = null;
    commitRequestContext(request, choice, nowMs());
    rememberPlayed(choice.id);

    const fadeMs = request.options.fadeMs;
    void fadeAudio(nextAudio, targetVolume(choice), fadeMs);
    if (oldAudio && oldAudio !== nextAudio) {
      retireAudio(oldAudio, oldChoice, fadeMs);
    }
    return choice;
  }

  function holdWaitMs(request, now = nowMs()) {
    if (!state.currentChoice || request.options.forceRetune || request.context.forceRetune) return 0;
    if (request.options.transition === "immediate") return 0;
    if (request.scopeKey !== state.currentScopeKey) return 0;
    const elapsed = now - Number(state.currentStartedAt || 0);
    const sameBattleScope = request.phaseGroup === "battle" && state.currentPhaseGroup === "battle";
    if (sameBattleScope) {
      if (!isClimaxContext(request.context) || state.climaxSwitchedScopes[request.scopeKey]) return -1;
      return Math.max(0, CLIMAX_MIN_HOLD_MS - elapsed);
    }
    return Math.max(0, minHoldMs(request.context, request.options) - elapsed);
  }

  function processRequest(request) {
    if (!request || !requestIsCurrent(request)) return state.currentChoice;
    if (state.switchLocks.size && !request.options.ignoreLock) {
      state.queuedRequest = request;
      return state.currentChoice;
    }
    if (!state.enabled || !state.unlocked) {
      state.pendingContext = request;
      return choiceForRequest(request) || state.currentChoice;
    }
    if (state.inFlightRequest && sameRequestScene(state.inFlightRequest, request)) {
      return choiceForRequest(request) || state.currentChoice;
    }

    const waitMs = holdWaitMs(request);
    if (waitMs !== 0) {
      state.queuedRequest = request;
      clearHoldTimer();
      if (waitMs > 0) {
        state.holdTimer = global.setTimeout(() => {
          state.holdTimer = null;
          const latest = state.queuedRequest || state.desiredRequest;
          if (latest && requestIsCurrent(latest)) processRequest(latest);
        }, waitMs + 20);
      }
      return state.currentChoice;
    }

    clearHoldTimer();
    const choice = choiceForRequest(request);
    if (!choice) return state.currentChoice;
    if (state.currentChoice?.id === choice.id && state.currentAudio && !request.options.restart) {
      void performTransition(choice, request);
      return state.currentChoice;
    }
    void performTransition(choice, request);
    return choice;
  }

  function scheduleDelayedRequest(request) {
    const delayMs = request.options.transitionDelayMs;
    if (!state.currentChoice || !delayMs || request.options.transition === "immediate") return processRequest(request);
    state.queuedRequest = request;
    const timerKey = `${request.key}|${request.scopeKey}`;
    if (state.transitionTimer != null && state.transitionTimerKey === timerKey) return state.currentChoice;
    clearTransitionTimer();
    state.transitionTimerKey = timerKey;
    state.transitionTimerDueAt = nowMs() + delayMs;
    state.transitionTimer = global.setTimeout(() => {
      state.transitionTimer = null;
      state.transitionTimerKey = "";
      state.transitionTimerDueAt = 0;
      const latest = state.queuedRequest || state.desiredRequest;
      if (latest && requestIsCurrent(latest)) processRequest(latest);
    }, delayMs);
    return state.currentChoice;
  }

  function chooseAndPlay(context = {}, options = {}) {
    const request = makeRequest(context, options);
    state.desiredRequest = request;
    if (request.options.transition === "inherit" && state.currentChoice) {
      clearTransitionTimer();
      clearHoldTimer();
      state.queuedRequest = null;
      return state.currentChoice;
    }
    if (state.transitionTimer != null && state.transitionTimerKey !== `${request.key}|${request.scopeKey}`) clearTransitionTimer();
    if (state.switchLocks.size && !request.options.ignoreLock) {
      state.queuedRequest = request;
      return state.currentChoice || choiceForRequest(request);
    }
    if (!state.enabled || !state.unlocked) {
      state.pendingContext = request;
      return state.currentChoice || choiceForRequest(request);
    }
    return scheduleDelayedRequest(request);
  }

  function flushLatestRequest() {
    if (!state.enabled || !state.unlocked || state.switchLocks.size) return;
    const request = state.queuedRequest || state.pendingContext || (!state.currentAudio ? state.desiredRequest : null);
    if (!request) return;
    state.pendingContext = null;
    state.queuedRequest = null;
    processRequest(request);
  }

  function unlock() {
    if (state.unlocked && !state.pendingContext && !state.queuedRequest) return;
    state.unlocked = true;
    flushLatestRequest();
  }

  ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
    global.addEventListener?.(eventName, unlock, { capture: true });
  });

  async function crossfade(choice, options = {}) {
    if (!choice) return null;
    const request = state.desiredRequest || makeRequest({ phase: "manual", musicScope: `manual:${choice.id}` }, { ...options, transition: "immediate" });
    if (!state.desiredRequest) state.desiredRequest = request;
    request.options = normalizedOptions({ ...request.options, ...options, transition: "immediate" });
    return performTransition(choice, request);
  }

  async function fadeOut(durationMs = DEFAULT_FADE_MS) {
    stopOutgoingAudios(durationMs);
    const audio = state.currentAudio;
    if (!audio) return;
    await fadeAudio(audio, 0, durationMs);
    if (state.currentAudio === audio) {
      try { audio.pause(); } catch (_error) {}
    }
  }

  async function fadeIn(durationMs = DEFAULT_FADE_MS) {
    const audio = state.currentAudio;
    if (!audio) return;
    try {
      await audio.play();
      await fadeAudio(audio, targetVolume(state.currentChoice), durationMs);
    } catch (_error) {
      state.unlocked = false;
      state.pendingContext = state.desiredRequest;
    }
  }

  function stop(options = {}) {
    clearTransitionTimer();
    clearHoldTimer();
    if (state.inFlightAudio) stopAudio(state.inFlightAudio);
    state.inFlightAudio = null;
    state.inFlightRequest = null;
    const audio = state.currentAudio;
    const choice = state.currentChoice;
    state.currentAudio = null;
    state.currentChoice = null;
    state.currentContextKey = "";
    state.currentScopeKey = "";
    state.currentPhaseGroup = "";
    state.currentStartedAt = 0;
    if (!options.preserveRequest) {
      state.desiredRequest = null;
      state.queuedRequest = null;
      state.pendingContext = null;
    }
    const fadeMs = Number(options.fadeMs ?? 500);
    if (audio) retireAudio(audio, choice, fadeMs);
    stopOutgoingAudios(fadeMs);
  }

  function setEnabled(enabled) {
    state.enabled = Boolean(enabled);
    storageSet("board_bgm_enabled", state.enabled ? "1" : "0");
    if (!state.enabled) {
      if (state.desiredRequest) state.pendingContext = state.desiredRequest;
      stop({ fadeMs: 500, preserveRequest: true });
    }
    else unlock();
  }

  function setVolume(value) {
    state.volume = clamp(value);
    storageSet("board_bgm_volume", String(state.volume));
    if (state.currentAudio) void fadeAudio(state.currentAudio, targetVolume(state.currentChoice), 180);
    retargetOutgoingAudios(180);
  }

  function releaseSwitchLock(key) {
    state.switchLocks.delete(key);
    if (!state.switchLocks.size) flushLatestRequest();
  }

  function acquireAudioFocus(reason = "media", options = {}) {
    const id = ++state.audioFocusSerial;
    const key = `audio-focus:${id}:${String(reason || "media")}`;
    const entry = {
      key,
      volumeRatio: clamp(options.volumeRatio ?? 0.1),
      fadeOutMs: Math.max(0, Number(options.fadeOutMs ?? 350)),
      fadeInMs: Math.max(0, Number(options.fadeInMs ?? 650)),
    };
    state.audioFocus.set(id, entry);
    state.switchLocks.add(key);
    if (state.currentAudio) void fadeAudio(state.currentAudio, targetVolume(state.currentChoice), entry.fadeOutMs);
    retargetOutgoingAudios(entry.fadeOutMs);
    let released = false;
    return Object.freeze({
      id,
      release() {
        if (released) return;
        released = true;
        state.audioFocus.delete(id);
        state.switchLocks.delete(key);
        if (state.currentAudio) void fadeAudio(state.currentAudio, targetVolume(state.currentChoice), entry.fadeInMs);
        retargetOutgoingAudios(entry.fadeInMs);
        if (!state.switchLocks.size) flushLatestRequest();
      },
    });
  }

  global.BgmManager = Object.freeze({
    unlock,
    chooseAndPlay,
    playForContext: chooseAndPlay,
    crossfade,
    fadeOut,
    fadeIn,
    stop,
    setEnabled,
    setVolume,
    acquireAudioFocus,
    setBasePath(basePath) {
      state.basePath = String(basePath || DEFAULT_BASE_PATH);
    },
    lockAutoSwitch(reason = "lock") {
      const key = String(reason || "lock");
      state.switchLocks.add(key);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        releaseSwitchLock(key);
      };
    },
    unlockAutoSwitch(reason = "lock") {
      releaseSwitchLock(String(reason || "lock"));
    },
    status() {
      return {
        enabled: state.enabled,
        unlocked: state.unlocked,
        volume: state.volume,
        currentChoice: state.currentChoice,
        playing: Boolean(state.currentAudio && !state.currentAudio.paused),
        currentTime: Number(state.currentAudio?.currentTime || 0),
        currentContextKey: state.currentContextKey,
        currentScopeKey: state.currentScopeKey,
        currentPhaseGroup: state.currentPhaseGroup,
        currentStartedAt: state.currentStartedAt,
        pendingContextKey: state.pendingContext?.key || "",
        desiredContextKey: state.desiredRequest?.key || "",
        switchLocks: [...state.switchLocks],
        audioFocusCount: state.audioFocus.size,
        recentlyPlayedIds: state.recentlyPlayedIds.slice(),
        playedAtById: { ...state.playedAtById },
      };
    },
  });

  global.boardBgmContext = (context, options) => global.BgmManager.chooseAndPlay(context, options);
  global.boardBgmStop = () => global.BgmManager.stop({ fadeMs: 800 });
  global.boardBgmMute = () => global.BgmManager.setEnabled(false);
  global.boardBgmUnmute = () => global.BgmManager.setEnabled(true);
})(typeof window !== "undefined" ? window : globalThis);

return window.BgmManager;
};
