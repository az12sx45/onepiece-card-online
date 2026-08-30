(function () {
  const config = {
    schemaVersion: 1,
    version: "2026-08-29-v1",
    unlockCondition: "game.postgameWorld.unlocked === true",
    postgameOnlyKeys: ["final_imu", "god_knight_killingham", "god_knight_sommers"],
    activeRegionId: "route_a",
    assignments: {
      north_yonko: ["enel", "sentomaru", "doflamingo", "final_imu"],
      route_a: ["alvida", "axe_hand_morgan", "buggy", "mohji"],
      route_a_east: ["buggy", "mohji", "cabaji", "kuro"],
      route_b_west: ["buggy", "cabaji", "kuro", "alvida"],
      route_b: ["kuro", "krieg", "gin", "arlong"],
      route_b_east: ["krieg", "gin", "arlong", "kuroobi"],
      route_c_west: ["arlong", "kuroobi", "hatchan", "krieg"],
      route_c: ["mr5", "miss_valentine", "mr3", "wapol"],
      route_c_east: ["mr5", "miss_valentine", "mr3", "mr2_bon_clay"],
      route_d_west: ["mr3", "mr2_bon_clay", "mr1_daz_bones", "wapol"],
      route_d: ["bellamy", "foxy", "mr2_bon_clay", "mr1_daz_bones"],
      route_d_east: ["bellamy", "foxy", "mr1_daz_bones", "hody_jones"],
      route_e_west: ["bellamy", "foxy", "hody_jones", "caesar_clown"],
      route_e: ["hody_jones", "caesar_clown", "crocodile", "enel"],
      route_e_east: ["caesar_clown", "crocodile", "enel", "gecko_moria"],
      route_f_west: ["caesar_clown", "crocodile", "enel", "gecko_moria"],
      route_f: ["crocodile", "enel", "gecko_moria", "sentomaru"],
      route_f_east: ["gecko_moria", "sentomaru", "doflamingo", "pica"],
      route_g_west: ["sentomaru", "doflamingo", "pica", "god_knight_killingham"],
      route_g: ["crocodile", "enel", "gecko_moria", "doflamingo", "pica"],
      south_yonko: ["crocodile", "gecko_moria", "doflamingo", "pica", "god_knight_sommers"],
    },
    notes: {
      north_yonko: "高危險海域，以自然系、海軍與世界政府勢力為主；伊姆只在二周目加入。",
      route_a: "東海起步區，集中最早期且強度最低的對手。",
      route_a_east: "東海海賊向 B 航線過渡，補入克洛與卡巴吉。",
      route_b_west: "延續東海前段敵人，讓 A、B 交界可定向刷小丑與黑貓勢力。",
      route_b: "東海中後段，以黑貓、克利克與阿龍勢力為主。",
      route_b_east: "由東海強敵過渡到魚人勢力。",
      route_c_west: "阿龍海賊團集中區，保留少量克利克勢力。",
      route_c: "偉大航路前段，以巴洛克華克與磁鼓王國對手為主。",
      route_c_east: "巴洛克華克中階幹部開始集中出現。",
      route_d_west: "巴洛克華克中後段，Mr.1 與 Mr.2 的主要刷怪帶。",
      route_d: "偉大航路中段，混合加雅、長環島與巴洛克華克強敵。",
      route_d_east: "從樂園中段過渡到魚人島與較強對手。",
      route_e_west: "中階特殊能力者集中區，開始出現新世界實驗勢力。",
      route_e: "魚人島至新世界前段，開始混入 A 級強敵。",
      route_e_east: "七武海與自然系敵人開始成為主要威脅。",
      route_f_west: "新世界前段高危險區，以自然系與七武海為主。",
      route_f: "A 級敵人的穩定出沒帶，適合中後期定向刷怪。",
      route_f_east: "世界政府與多佛朗明哥勢力交界。",
      route_g_west: "最右側高階入口；麒麟格姆只在二周目加入。",
      route_g: "一般航線最高強度區，集中現有 A 級強敵。",
      south_yonko: "南側最高危險海域，以七武海級敵人為主；索瑪茲只在二周目加入。",
    },
  };

  Object.values(config.assignments).forEach(Object.freeze);
  Object.freeze(config.assignments);
  Object.freeze(config.notes);
  Object.freeze(config.postgameOnlyKeys);
  window.BoardEnemySpawnRegions = Object.freeze(config);
})();
