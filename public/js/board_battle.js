(function () {
  const document = window.document;
  if (!document) return;

  const BATTLE_SNAPSHOT_KEY = "onepiece-board-battle-snapshot-v1";
  const BATTLE_COMMAND_KEY = "onepiece-board-battle-command-v1";
  const BATTLE_LAYOUT_DRAFT_KEY = "onepiece-board-battle-layout-draft-v2";
  const PREBATTLE_INTRO_DONE_STORAGE_KEY = "onepiece-board-prebattle-intro-done-v3";
  const PREBATTLE_INTRO_DONE_LIMIT = 80;
  const PREBATTLE_INTRO_KEY_DONE_TTL_MS = 120000;
  const DEFAULT_BATTLE_BACKGROUND = "images/board/battle/battle_bg_demo.png";
  const BATTLE_BACKGROUND_BY_ENEMY_KEY = {
    buggy: "images/board/battle/buggy_circus_bg.webp",
    mohji: "images/board/battle/buggy_circus_bg.webp",
    cabaji: "images/board/battle/buggy_circus_bg.webp",
    axe_hand_morgan: "images/board/battle/marine_base_bg.webp",
    krieg: "images/board/battle/baratie_bg.webp",
    gin: "images/board/battle/baratie_bg.webp",
    kuro: "images/board/battle/kuro_mansion_bg.webp",
    alvida: "images/board/battle/alvida_ship_bg.webp",
    arlong: "images/board/battle/arlong_park_bg.webp",
    kuroobi: "images/board/battle/arlong_park_bg.webp",
    hatchan: "images/board/battle/arlong_park_bg.webp",
    mr5: "images/board/battle/alabasta_bg.webp",
    miss_valentine: "images/board/battle/alabasta_bg.webp",
    mr3: "images/board/battle/alabasta_bg.webp",
    mr2_bon_clay: "images/board/battle/alabasta_bg.webp",
    mr1_daz_bones: "images/board/battle/alabasta_bg.webp",
    crocodile: "images/board/battle/alabasta_bg.webp",
    enel: "images/board/battle/skypiea_ruins_bg.webp",
    gecko_moria: "images/board/battle/thriller_bark_bg.webp",
    doflamingo: "images/board/battle/dressrosa_bg.webp",
    pica: "images/board/battle/dressrosa_bg.webp",
    bellamy: "images/board/battle/dressrosa_bg.webp",
    caesar_clown: "images/board/battle/punk_hazard_bg.webp",
    hody_jones: "images/board/battle/fishman_island_bg.webp",
    foxy: "images/board/battle/davy_back_bg.webp",
    impel_l1_sadie: "images/board/battle/impel_down_bg.webp",
    impel_l2_minochihuahua: "images/board/battle/impel_down_bg.webp",
    impel_l3_minokoala: "images/board/battle/impel_down_bg.webp",
    impel_l4_minotaur: "images/board/battle/impel_down_bg.webp",
    impel_l5_minorhino: "images/board/battle/impel_down_bg.webp",
    impel_l6_hannyabal: "images/board/battle/impel_down_bg.webp",
    magellan: "images/board/battle/impel_down_bg.webp",
    aokiji: "images/board/marineford/backgrounds/marineford_stage_bg.webp",
    kizaru: "images/board/marineford/backgrounds/marineford_stage_bg.webp",
    akainu: "images/board/marineford/backgrounds/marineford_stage_bg.webp",
    sengoku: "images/board/marineford/backgrounds/marineford_stage_bg.webp",
    spandam: "images/board/battle/enies_lobby_final_bg.webp",
    blueno: "images/board/battle/enies_lobby_final_bg.webp",
    kalifa: "images/board/battle/enies_lobby_final_bg.webp",
    jabra: "images/board/battle/enies_lobby_final_bg.webp",
    kaku: "images/board/battle/enies_lobby_final_bg.webp",
    lucci: "images/board/battle/enies_lobby_final_bg.webp",
    rob_lucci: "images/board/battle/enies_lobby_final_bg.webp",
    postgame_shiki: "images/board/battle/postgame_boss_backgrounds/postgame_shiki_bg.webp",
    postgame_gild_tesoro: "images/board/battle/postgame_boss_backgrounds/postgame_gild_tesoro_bg.webp",
    postgame_zephyr: "images/board/battle/postgame_boss_backgrounds/postgame_zephyr_bg.webp",
    postgame_tot_musica: "images/board/battle/postgame_boss_backgrounds/postgame_tot_musica_bg.webp",
    postgame_douglas_bullet: "images/board/battle/postgame_boss_backgrounds/postgame_douglas_bullet_bg.webp",
    postgame_saga: "images/board/battle/postgame_boss_backgrounds/postgame_saga_bg.webp",
    postgame_vinsmoke_judge: "images/board/battle/postgame_boss_backgrounds/postgame_vinsmoke_judge_bg.webp",
    postgame_rob_lucci_awakened: "images/board/battle/postgame_boss_backgrounds/postgame_rob_lucci_awakened_bg.webp",
    postgame_king: "images/board/battle/postgame_boss_backgrounds/postgame_king_bg.webp",
    postgame_charlotte_katakuri: "images/board/battle/postgame_boss_backgrounds/postgame_charlotte_katakuri_bg.webp",
    postgame_patrick_redfield: "images/board/battle/postgame_boss_backgrounds/postgame_patrick_redfield_bg.webp",
    postgame_loki: "images/board/battle/postgame_boss_backgrounds/postgame_loki_bg.webp",
    postgame_oars: "images/board/battle/postgame_boss_backgrounds/postgame_oars_bg.webp",
    postgame_aramaki: "images/board/battle/postgame_boss_backgrounds/postgame_aramaki_bg.webp",
    postgame_rocks: "images/board/battle/postgame_boss_backgrounds/postgame_rocks_bg.webp",
  };
  const BATTLE_BACKGROUND_BY_ENEMY_NAME = {
    "巴其": "images/board/battle/buggy_circus_bg.webp",
    "摩奇": "images/board/battle/buggy_circus_bg.webp",
    "卡巴吉": "images/board/battle/buggy_circus_bg.webp",
    "斧手摩根": "images/board/battle/marine_base_bg.webp",
    "克利克": "images/board/battle/baratie_bg.webp",
    "阿金": "images/board/battle/baratie_bg.webp",
    "克洛": "images/board/battle/kuro_mansion_bg.webp",
    "亞爾麗塔": "images/board/battle/alvida_ship_bg.webp",
    "阿龍": "images/board/battle/arlong_park_bg.webp",
    "克羅歐比": "images/board/battle/arlong_park_bg.webp",
    "小八": "images/board/battle/arlong_park_bg.webp",
    "mr.5": "images/board/battle/alabasta_bg.webp",
    "miss valentine": "images/board/battle/alabasta_bg.webp",
    "mr.3": "images/board/battle/alabasta_bg.webp",
    "mr.2": "images/board/battle/alabasta_bg.webp",
    "mr.1": "images/board/battle/alabasta_bg.webp",
    "克洛克達爾": "images/board/battle/alabasta_bg.webp",
    "艾尼路": "images/board/battle/skypiea_ruins_bg.webp",
    "月光莫利亞": "images/board/battle/thriller_bark_bg.webp",
    "多佛朗明哥": "images/board/battle/dressrosa_bg.webp",
    "皮卡": "images/board/battle/dressrosa_bg.webp",
    "貝拉密": "images/board/battle/dressrosa_bg.webp",
    "凱薩·庫朗": "images/board/battle/punk_hazard_bg.webp",
    "凱薩・庫朗": "images/board/battle/punk_hazard_bg.webp",
    "霍迪·瓊斯": "images/board/battle/fishman_island_bg.webp",
    "霍迪・瓊斯": "images/board/battle/fishman_island_bg.webp",
    "銀狐弗克西": "images/board/battle/davy_back_bg.webp",
    "小莎蒂": "images/board/battle/impel_down_bg.webp",
    "米諾吉娃娃": "images/board/battle/impel_down_bg.webp",
    "米諾無尾熊": "images/board/battle/impel_down_bg.webp",
    "米諾陶爾": "images/board/battle/impel_down_bg.webp",
    "米諾犀牛": "images/board/battle/impel_down_bg.webp",
    "般若拔": "images/board/battle/impel_down_bg.webp",
    "麥哲倫": "images/board/battle/impel_down_bg.webp",
    "青雉": "images/board/marineford/backgrounds/marineford_stage_bg.webp",
    "黃猿": "images/board/marineford/backgrounds/marineford_stage_bg.webp",
    "赤犬": "images/board/marineford/backgrounds/marineford_stage_bg.webp",
    "戰國": "images/board/marineford/backgrounds/marineford_stage_bg.webp",
    "戰國元帥": "images/board/marineford/backgrounds/marineford_stage_bg.webp",
    "斯潘達姆": "images/board/battle/enies_lobby_final_bg.webp",
    "布魯諾": "images/board/battle/enies_lobby_final_bg.webp",
    "卡莉法": "images/board/battle/enies_lobby_final_bg.webp",
    "加布拉": "images/board/battle/enies_lobby_final_bg.webp",
    "卡古": "images/board/battle/enies_lobby_final_bg.webp",
    "羅布・路基": "images/board/battle/enies_lobby_final_bg.webp",
    "羅布·路基": "images/board/battle/enies_lobby_final_bg.webp",
    "羅布路基": "images/board/battle/enies_lobby_final_bg.webp",
  };
  const DEFAULT_LAYOUT = {
    playerHud: { x: 4.2, y: 2.4, w: 43, h: 12.4 },
    enemyHud: { x: 52.8, y: 2.4, w: 43, h: 12.4 },
    playerCard: { x: 6.2, y: 18.2, w: 26, h: 51.8 },
    enemyCard: { x: 67.8, y: 18.2, w: 26, h: 51.8 },
    infoPanel: { x: 2.2, y: 72, w: 48, h: 25.8 },
    actionPanel: { x: 50.7, y: 72, w: 48, h: 25.8 },
  };
  const DEFAULT_CONTROL_PANEL_BOTTOM_GAP = 0.6;
  const DEFAULT_PORTRAIT_LAYOUT = {
    player: { x: 0, y: -2, scale: 1 },
    enemy: { x: 0, y: 0, scale: 1 },
  };
  const DEFAULT_UI_TUNING = {
    fontScale: 0.7,
    panelRadius: 18,
    panelBorder: 2,
    hudPadY: 5,
    hudPadX: 22,
    hudGap: 0,
    hudNameSize: 26,
    hudMetaSize: 14,
    hpHeight: 4,
    cardPadding: 0,
    infoPadY: 8,
    infoPadX: 9,
    choiceGap: 7,
    choiceMinHeight: 40,
    choicePadding: 7,
    choiceNameSize: 36,
    choiceMetaSize: 15,
    logSize: 15,
    actionGap: 6,
    actionPadding: 16,
    actionButtonPadY: 10,
    actionButtonPadX: 18,
    actionIconSize: 52,
    actionLabelSize: 28,
    statusSize: 16,
    cutinSize: 36,
    statusIconSize: 32,
    statusIconGap: 7,
    playerStatusIconsX: 80.5,
    playerStatusIconsY: 74.5,
    enemyStatusIconsX: 80,
    enemyStatusIconsY: 74.5,
  };
  const COSMETIC_FRAME_CONFIGS = {
    threeDTwoY: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/three_d_two_y/aura.webp", x: 50, y: 50, w: 86.5, h: 79, opacity: 0.75, strength: 1, z: 13, blend: "normal" },
        leftRibbon: { asset: "images/board/battle/cosmetic_frames/three_d_two_y/left_ribbon.webp", x: 25, y: 51, w: 78, h: 126, opacity: 1, strength: 2.5, z: 11, blend: "normal" },
        rightRibbon: { asset: "images/board/battle/cosmetic_frames/three_d_two_y/right_ribbon.webp", x: 72.5, y: 59.5, w: 72, h: 126, opacity: 1, strength: 1, z: 14, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/three_d_two_y/frame.webp", x: 50, y: 50, w: 121, h: 125, opacity: 1, strength: 1, z: 10, blend: "normal" },
      },
    },
    goldenDenDen: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/golden_den_den/aura.webp", x: 50, y: 50, w: 185.5, h: 170, opacity: 0.82, strength: 1.1, z: 20, blend: "screen" },
        frame: { asset: "images/board/battle/cosmetic_frames/golden_den_den/frame.webp", x: 50, y: 50, w: 116, h: 127, opacity: 1, strength: 1, z: 5, blend: "normal" },
      },
    },
    zoroNewWorld: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/zoro_new_world/aura.webp", x: 50, y: 38.5, w: 148, h: 132.5, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 2.3, z: 13, blend: "normal" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/zoro_new_world/left_part.webp", x: 157.5, y: 45, w: 124, h: 114, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1.5, z: 11, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/zoro_new_world/right_part.webp", x: -60, y: 45, w: 124, h: 114, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1.8, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/zoro_new_world/frame.webp", x: 50, y: 50, w: 132, h: 122, rotate: 0, flipX: false, flipY: true, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    sanjiNewWorld: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/sanji_new_world/aura.webp", x: 50, y: 50, w: 102.5, h: 106, opacity: 0.72, strength: 1, z: 13, blend: "screen" },
        leftFlameKick: { asset: "images/board/battle/cosmetic_frames/sanji_new_world/left_flame_kick.webp", x: 31, y: 24.5, w: 122, h: 122, opacity: 1, strength: 1, z: 6, blend: "normal" },
        rightFlameKick: { asset: "images/board/battle/cosmetic_frames/sanji_new_world/right_flame_kick.webp", x: 75, y: 56.5, w: 122, h: 122, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/sanji_new_world/frame.webp", x: 50, y: 50, w: 119.5, h: 121.5, opacity: 1, strength: 1, z: 13, blend: "normal" },
      },
    },
    namiNewWorld: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/nami_new_world/aura.webp", x: 50, y: 50, w: 97, h: 108.5, opacity: 0.82, strength: 1, z: 13, blend: "screen" },
        zeusCloudLeft: { asset: "images/board/battle/cosmetic_frames/nami_new_world/zeus_cloud_left.webp", x: 31, y: 45, w: 124, h: 124, opacity: 1, strength: 1, z: 13, blend: "normal" },
        thunderRight: { asset: "images/board/battle/cosmetic_frames/nami_new_world/thunder_right.webp", x: 66.5, y: 53.5, w: 124, h: 124, opacity: 1, strength: 1, z: 13, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/nami_new_world/frame.webp", x: 50, y: 50, w: 118.5, h: 118, opacity: 1, strength: 1, z: 13, blend: "normal" },
      },
    },
    sogeking: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/sogeking/aura.webp", x: 50, y: 50, w: 124, h: 106, opacity: 0.85, strength: 1, z: 16, blend: "screen" },
        frame: { asset: "images/board/battle/cosmetic_frames/sogeking/frame.webp", x: 50, y: 50, w: 145.5, h: 143.5, opacity: 1, strength: 1, z: 7, blend: "normal" },
        maskTop: { asset: "images/board/battle/cosmetic_frames/sogeking/mask_top.webp", x: 50, y: 7, w: 97, h: 82, opacity: 1, strength: 1, z: 8, blend: "normal" },
      },
    },
    lawNewWorld: {
      layers: {
        roomAura: { asset: "images/board/battle/cosmetic_frames/law_new_world/room_aura.webp", x: 50, y: 50, w: 91.5, h: 87, opacity: 1, strength: 1, z: 17, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/law_new_world/frame.webp", x: 50, y: 47, w: 131, h: 131, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    carrotMoonLion: {
      layers: {
        leftFurLightning: { asset: "images/board/battle/cosmetic_frames/carrot_moon_lion/left_fur_lightning.webp", x: 28, y: 53.5, w: 122, h: 122, opacity: 1, strength: 1, z: 14, blend: "normal" },
        rightMoonClaw: { asset: "images/board/battle/cosmetic_frames/carrot_moon_lion/right_moon_claw.webp", x: 90, y: 27.5, w: 122, h: 122, opacity: 1, strength: 1, z: 10, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/carrot_moon_lion/frame.webp", x: 50, y: 50, w: 130, h: 130, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    impelDownMagellan: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/impel_down_magellan/aura.webp", x: 50, y: 50, w: 97, h: 112, rotate: 0, flipX: false, flipY: false, opacity: 0.55, strength: 1, z: 6, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/impel_down_magellan/left_part.webp", x: 146, y: 50, w: 126, h: 132, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 0.95, z: 11, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/impel_down_magellan/right_part.webp", x: -51, y: 52, w: 126, h: 132, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 13, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/impel_down_magellan/frame.webp", x: 50, y: 50, w: 105, h: 108.5, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    yonkoBlackbeard: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/yonko_blackbeard/aura.webp", x: 50, y: 50, w: 102.5, h: 128, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1.4, z: 7, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/yonko_blackbeard/left_part.webp", x: 160.5, y: 52, w: 126, h: 134, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 8, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/yonko_blackbeard/right_part.webp", x: -57, y: 52, w: 126, h: 134, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/yonko_blackbeard/frame.webp", x: 50, y: 50, w: 113, h: 111, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    yonkoBigMom: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/yonko_bigmom/aura.webp", x: 50, y: 50, w: 126, h: 118, rotate: 0, flipX: false, flipY: false, opacity: 0.2, strength: 0.65, z: 8, blend: "normal" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/yonko_bigmom/left_part.webp", x: 25, y: 52, w: 124, h: 132, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 10, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/yonko_bigmom/right_part.webp", x: 125, y: 53.5, w: 126, h: 124.5, rotate: 0, flipX: true, flipY: false, opacity: 1, strength: 1, z: 4, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/yonko_bigmom/frame.webp", x: 50, y: 48.5, w: 105.5, h: 106, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    yonkoKaido: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/yonko_kaido/aura.webp", x: 50, y: 50, w: 130, h: 124, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 2, z: 6, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/yonko_kaido/left_part.webp", x: 163.5, y: 63, w: 126, h: 136, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 10, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/yonko_kaido/right_part.webp", x: 34, y: 52, w: 128, h: 136, rotate: -32, flipX: true, flipY: false, opacity: 1, strength: 1, z: 9, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/yonko_kaido/frame.webp", x: 50, y: 50, w: 110.5, h: 116.5, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    enemyYonkoKaido: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/yonko_kaido/aura.webp", x: 50, y: 50, w: 130, h: 124, rotate: 0, flipX: false, flipY: false, opacity: 0.2, strength: 0.65, z: 6, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/yonko_kaido/left_part.webp", x: 163.5, y: 63, w: 126, h: 136, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 10, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/yonko_kaido/right_part.webp", x: 34, y: 52, w: 128, h: 136, rotate: -32, flipX: true, flipY: false, opacity: 1, strength: 1, z: 9, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/yonko_kaido/frame.webp", x: 50, y: 50, w: 110.5, h: 116.5, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    yonkoShanks: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/yonko_shanks/aura.webp", x: 50, y: 45, w: 97, h: 108.5, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 2.5, z: 10, blend: "multiply" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/yonko_shanks/left_part.webp", x: 40, y: 52, w: 124, h: 136, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 13, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/yonko_shanks/right_part.webp", x: 147.5, y: 56.5, w: 100, h: 127, rotate: 0, flipX: true, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/yonko_shanks/frame.webp", x: 50, y: 50, w: 113, h: 112.5, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    luffyGearFourth: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/luffy_gear_fourth/aura.webp", x: 50, y: 50, w: 118, h: 116, rotate: 0, flipX: false, flipY: false, opacity: 0.5, strength: 1.45, z: 8, blend: "normal" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/luffy_gear_fourth/left_part.webp", x: 151.5, y: 52, w: 124, h: 132, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/luffy_gear_fourth/right_part.webp", x: -48.5, y: 52, w: 124, h: 132, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/luffy_gear_fourth/frame.webp", x: 50, y: 50, w: 140, h: 132.5, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    usoppNewWorld: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/usopp_new_world/aura.webp", x: 50, y: 50, w: 118, h: 95, rotate: 0, flipX: false, flipY: false, opacity: 0.72, strength: 1, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/usopp_new_world/left_part.webp", x: 160.5, y: 52, w: 124, h: 132, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/usopp_new_world/right_part.webp", x: -51, y: 52, w: 124, h: 132.5, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/usopp_new_world/frame.webp", x: 50, y: 50, w: 126.5, h: 127, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    chopperNewWorld: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/chopper_new_world/aura.webp", x: 50, y: 50, w: 116, h: 112, rotate: 0, flipX: false, flipY: false, opacity: 0.76, strength: 1, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/chopper_new_world/left_part.webp", x: 154.5, y: 52, w: 120, h: 128, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/chopper_new_world/right_part.webp", x: -57, y: 52, w: 120, h: 128, rotate: 0, flipX: false, flipY: false, opacity: 0, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/chopper_new_world/frame.webp", x: 50, y: 49.5, w: 124, h: 130, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    robinNewWorld: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/robin_new_world/aura.webp", x: 50, y: 50, w: 118, h: 114, rotate: 0, flipX: false, flipY: false, opacity: 0.72, strength: 1, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/robin_new_world/left_part.webp", x: 157.5, y: 59.5, w: 124, h: 132, rotate: 23, flipX: false, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/robin_new_world/right_part.webp", x: -42.5, y: 47.5, w: 124, h: 132, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/robin_new_world/frame.webp", x: 50, y: 50, w: 133.5, h: 130, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    brookSoulKing: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/brook_soul_king/aura.webp", x: 50, y: 50, w: 122, h: 116, rotate: 0, flipX: false, flipY: false, opacity: 0.78, strength: 1, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/brook_soul_king/left_part.webp", x: 93, y: 50.5, w: 124, h: 132, rotate: 0, flipX: true, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/brook_soul_king/right_part.webp", x: -51, y: 52, w: 124, h: 132, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/brook_soul_king/frame.webp", x: 50, y: 50, w: 124, h: 119, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    frankyShogun: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/franky_shogun/aura.webp", x: 50, y: 50, w: 120, h: 116, rotate: 0, flipX: false, flipY: false, opacity: 0.78, strength: 1, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/franky_shogun/left_part.webp", x: 90, y: 52, w: 124, h: 132, rotate: 0, flipX: true, flipY: false, opacity: 1, strength: 1, z: 14, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/franky_shogun/right_part.webp", x: -19, y: 39, w: 124, h: 132, rotate: 0, flipX: true, flipY: false, opacity: 1, strength: 1, z: 14, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/franky_shogun/frame.webp", x: 50, y: 50, w: 124, h: 122, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    yonkoAllClear: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/yonko_all_clear/aura.webp", x: 50, y: 50, w: 94.5, h: 95, rotate: 0, flipX: false, flipY: false, opacity: 0.65, strength: 1.1, z: 8, blend: "normal" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/yonko_all_clear/left_part.webp", x: 148.5, y: 52, w: 124, h: 132, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/yonko_all_clear/right_part.webp", x: -39.5, y: 52, w: 124, h: 132, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/yonko_all_clear/frame.webp", x: 50, y: 50, w: 113, h: 116.5, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    finalImu: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/final_imu/aura.webp", x: 50, y: 42, w: 100, h: 118, rotate: 0, flipX: false, flipY: false, opacity: 0.5, strength: 1, z: 8, blend: "normal" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/final_imu/left_part.webp", x: 134, y: 56.5, w: 70.5, h: 95, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/final_imu/right_part.webp", x: -34.5, y: 59, w: 73, h: 84.5, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/final_imu/frame.webp", x: 50, y: 38, w: 116, h: 135, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    rocksConqueror: {
      layers: {
        frame: { asset: "images/board/battle/cosmetic_frames/rocks_conqueror/frame.webp", x: 50, y: 50, w: 121, h: 121, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    luffyGearSecond: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/luffy_gear_second/aura.webp", x: 50, y: 50, w: 120, h: 116, rotate: 0, flipX: false, flipY: false, opacity: 0.72, strength: 1, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/luffy_gear_second/left_part.webp", x: 87, y: 71, w: 97, h: 132, rotate: -79, flipX: false, flipY: true, opacity: 1, strength: 1, z: 14, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/luffy_gear_second/right_part.webp", x: -24.5, y: 50.5, w: 124, h: 132, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 15, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/luffy_gear_second/frame.webp", x: 50, y: 50, w: 132, h: 132.5, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    zoroEniesLobby: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/zoro_enies_lobby/aura.webp", x: 50, y: 50, w: 120, h: 116, rotate: 0, flipX: false, flipY: false, opacity: 0.72, strength: 1, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/zoro_enies_lobby/left_part.webp", x: -54, y: 47.5, w: 124, h: 132, rotate: -8, flipX: true, flipY: false, opacity: 1, strength: 1, z: 13, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/zoro_enies_lobby/right_part.webp", x: 162.5, y: 52, w: 124, h: 132, rotate: 0, flipX: true, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/zoro_enies_lobby/frame.webp", x: 50, y: 50, w: 121, h: 122, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    smokerNewWorld: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/smoker_new_world/aura.webp", x: 50, y: 50, w: 120, h: 116, rotate: 0, flipX: false, flipY: false, opacity: 0.72, strength: 1, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/smoker_new_world/left_part.webp", x: -27.5, y: 42, w: 124, h: 132, rotate: 9, flipX: true, flipY: false, opacity: 1, strength: 1, z: 14, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/smoker_new_world/right_part.webp", x: 143, y: 47.5, w: 124, h: 154, rotate: 0, flipX: true, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/smoker_new_world/frame.webp", x: 50, y: 50, w: 124, h: 124, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    kidNewWorld: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/kid_new_world/aura.webp", x: 50, y: 50, w: 120, h: 116, rotate: 0, flipX: false, flipY: false, opacity: 0.72, strength: 1, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/kid_new_world/left_part.webp", x: 28, y: 52, w: 124, h: 132, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 13, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/kid_new_world/right_part.webp", x: 146, y: 52, w: 124, h: 132, rotate: 0, flipX: true, flipY: false, opacity: 1, strength: 1, z: 13, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/kid_new_world/frame.webp", x: 50, y: 50, w: 124, h: 127, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    kobyColonel: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/koby_colonel/aura.webp", x: 50, y: 50, w: 120, h: 116, rotate: 0, flipX: false, flipY: false, opacity: 0.72, strength: 1, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/koby_colonel/left_part.webp", x: 78, y: 62.5, w: 124, h: 132, rotate: 0, flipX: true, flipY: false, opacity: 0.85, strength: 1, z: 13, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/koby_colonel/right_part.webp", x: -42.5, y: 53.5, w: 124, h: 132, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 15, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/koby_colonel/frame.webp", x: 50, y: 50, w: 118, h: 118, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    kuzanTenthCaptain: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/kuzan_tenth_captain/aura.webp", x: 50, y: 50, w: 120, h: 116, rotate: 0, flipX: false, flipY: false, opacity: 0.72, strength: 1, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/kuzan_tenth_captain/left_part.webp", x: 161, y: 51, w: 124, h: 132, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/kuzan_tenth_captain/right_part.webp", x: -42, y: 52, w: 91.5, h: 103, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/kuzan_tenth_captain/frame.webp", x: 50, y: 50, w: 124.5, h: 127.5, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    rayleighYoung: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/rayleigh_young/aura.webp", x: 50, y: 50, w: 120, h: 116, rotate: 0, flipX: false, flipY: false, opacity: 0.72, strength: 1, z: 8, blend: "normal" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/rayleigh_young/left_part.webp", x: 13.5, y: 42, w: 99.5, h: 90, rotate: 128, flipX: true, flipY: false, opacity: 1, strength: 1, z: 15, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/rayleigh_young/right_part.webp", x: 72.5, y: 52, w: 124, h: 132, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 17, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/rayleigh_young/frame.webp", x: 50, y: 50, w: 112.5, h: 115, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    whitebeardNewgate: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/whitebeard_newgate/aura.webp", x: 50, y: 50, w: 120, h: 116, rotate: 0, flipX: false, flipY: false, opacity: 0.72, strength: 1, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/whitebeard_newgate/left_part.webp", x: -13, y: 62.5, w: 119, h: 127, rotate: -47, flipX: true, flipY: false, opacity: 1, strength: 1, z: 13, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/whitebeard_newgate/right_part.webp", x: 158.5, y: 42.5, w: 124, h: 132, rotate: 0, flipX: true, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/whitebeard_newgate/frame.webp", x: 50, y: 50, w: 133.5, h: 128, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    mihawkNewWorld: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/mihawk_new_world/aura.webp", x: 50, y: 50, w: 120, h: 116, rotate: 0, flipX: false, flipY: false, opacity: 0.72, strength: 1, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/mihawk_new_world/left_part.webp", x: -37, y: 65, w: 124, h: 132, rotate: -36, flipX: true, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/mihawk_new_world/right_part.webp", x: 69.5, y: 50.5, w: 124, h: 132, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 17, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/mihawk_new_world/frame.webp", x: 50, y: 50, w: 115, h: 114.5, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    rogerYoung: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/roger_young/aura.webp", x: 50, y: 50, w: 120, h: 116, rotate: 0, flipX: false, flipY: false, opacity: 0.72, strength: 1, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/roger_young/left_part.webp", x: -59, y: 43.5, w: 125, h: 132, rotate: 0, flipX: true, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/roger_young/right_part.webp", x: 72.5, y: 52, w: 124, h: 132, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 14, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/roger_young/frame.webp", x: 50, y: 50, w: 126, h: 123.5, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    buggyYonko: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/buggy_yonko/aura.webp", x: 50, y: 50, w: 120, h: 116, rotate: 0, flipX: false, flipY: false, opacity: 0.72, strength: 1, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/buggy_yonko/left_part.webp", x: 162, y: 49.5, w: 124, h: 124, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/buggy_yonko/right_part.webp", x: -61.5, y: 52, w: 124, h: 121, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/buggy_yonko/frame.webp", x: 50, y: 50, w: 106, h: 112.5, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    crocodileNewWorld: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/crocodile_new_world/aura.webp", x: 50, y: 50, w: 120, h: 116, rotate: 0, flipX: false, flipY: false, opacity: 0.72, strength: 1, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/crocodile_new_world/left_part.webp", x: 154.5, y: 52, w: 108.5, h: 108, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/crocodile_new_world/right_part.webp", x: 16.5, y: 45, w: 81, h: 116.5, rotate: 0, flipX: true, flipY: false, opacity: 1, strength: 1, z: 14, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/crocodile_new_world/frame.webp", x: 50, y: 50, w: 107.5, h: 110, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    enemyLucci: {
      showBaseFrame: true,
      layers: {
        aura: { asset: "images/board/battle/enemy_frames/enemy_lucci/aura.webp", x: 50, y: 38, w: 128, h: 122, rotate: 0, flipX: false, flipY: false, opacity: 0.78, strength: 1.15, z: 15, blend: "screen" },
        leftPart: { asset: "images/board/battle/enemy_frames/enemy_lucci/left_part.webp", x: 128, y: 56.5, w: 124, h: 132, rotate: 31, flipX: false, flipY: false, opacity: 1, strength: 1, z: 13, blend: "normal" },
        rightPart: { asset: "images/board/battle/enemy_frames/enemy_lucci/right_part.webp", x: -54, y: 52, w: 124, h: 132, rotate: -4, flipX: true, flipY: false, opacity: 1, strength: 1, z: 16, blend: "normal" },
        frame: { asset: "images/board/battle/enemy_frames/enemy_lucci/frame.webp", x: 50, y: 50, w: 109, h: 110.5, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    enemyKaku: {
      showBaseFrame: true,
      layers: {
        aura: { asset: "images/board/battle/enemy_frames/enemy_kaku/aura.webp", x: 50, y: 36, w: 128, h: 122, rotate: 0, flipX: false, flipY: false, opacity: 0.78, strength: 1.1, z: 12, blend: "screen" },
        leftPart: { asset: "images/board/battle/enemy_frames/enemy_kaku/left_part.webp", x: -60, y: 52, w: 124, h: 132, rotate: 0, flipX: true, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        rightPart: { asset: "images/board/battle/enemy_frames/enemy_kaku/right_part.webp", x: 81, y: 52, w: 124, h: 119, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 15, blend: "normal" },
        frame: { asset: "images/board/battle/enemy_frames/enemy_kaku/frame.webp", x: 50, y: 50, w: 116, h: 116.5, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    enemyDoflamingo: {
      showBaseFrame: false,
      layers: {
        aura: { asset: "images/board/battle/enemy_frames/enemy_doflamingo/aura.webp", x: 50, y: 50, w: 128, h: 122, rotate: 0, flipX: false, flipY: false, opacity: 0.74, strength: 1.1, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/enemy_frames/enemy_doflamingo/left_part.webp", x: 158.5, y: 52, w: 124, h: 132, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        rightPart: { asset: "images/board/battle/enemy_frames/enemy_doflamingo/right_part.webp", x: -54, y: 48, w: 124, h: 132, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
        frame: { asset: "images/board/battle/enemy_frames/enemy_doflamingo/frame.webp", x: 50, y: 50, w: 117, h: 119.5, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    enemyEnel: {
      showBaseFrame: false,
      layers: {
        aura: { asset: "images/board/battle/enemy_frames/enemy_enel/aura.webp", x: 51.5, y: 50.5, w: 158.5, h: 148.5, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 2, blend: "normal" },
        leftPart: { asset: "images/board/battle/enemy_frames/enemy_enel/left_part.webp", x: 57.5, y: 51, w: 126, h: 132, rotate: 0, flipX: true, flipY: false, opacity: 1, strength: 1, z: 15, blend: "normal" },
        rightPart: { asset: "images/board/battle/enemy_frames/enemy_enel/right_part.webp", x: 29, y: 52.5, w: 126, h: 132, rotate: -7, flipX: true, flipY: false, opacity: 1, strength: 1, z: 13, blend: "normal" },
        frame: { asset: "images/board/battle/enemy_frames/enemy_enel/frame.webp", x: 50, y: 50, w: 115.5, h: 116, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    enemyGeckoMoria: {
      showBaseFrame: false,
      layers: {
        aura: { asset: "images/board/battle/enemy_frames/enemy_gecko_moria/aura.webp", x: 50, y: 50, w: 128, h: 122, rotate: 0, flipX: false, flipY: false, opacity: 0.78, strength: 1.12, z: 11, blend: "screen" },
        leftPart: { asset: "images/board/battle/enemy_frames/enemy_gecko_moria/left_part.webp", x: 128, y: 52, w: 110.5, h: 111, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 9, blend: "normal" },
        rightPart: { asset: "images/board/battle/enemy_frames/enemy_gecko_moria/right_part.webp", x: 17, y: 52, w: 124, h: 132, rotate: 0, flipX: true, flipY: false, opacity: 1, strength: 1, z: 13, blend: "normal" },
        frame: { asset: "images/board/battle/enemy_frames/enemy_gecko_moria/frame.webp", x: 50, y: 50, w: 109.5, h: 113.5, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    enemySengoku: {
      showBaseFrame: false,
      layers: {
        aura: { asset: "images/board/battle/enemy_frames/enemy_sengoku/aura.webp", x: 50, y: 47.5, w: 164, h: 146, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 0.85, z: 8, blend: "normal" },
        leftPart: { asset: "images/board/battle/enemy_frames/enemy_sengoku/left_part.webp", x: -57.5, y: 52, w: 124, h: 132, rotate: 0, flipX: true, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        rightPart: { asset: "images/board/battle/enemy_frames/enemy_sengoku/right_part.webp", x: 155, y: 52, w: 124, h: 132, rotate: 0, flipX: true, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/enemy_frames/enemy_sengoku/frame.webp", x: 50, y: 50, w: 103, h: 109.5, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    enemyAkainu: {
      showBaseFrame: false,
      layers: {
        aura: { asset: "images/board/battle/enemy_frames/enemy_akainu/aura.webp", x: 50, y: 50, w: 130, h: 124, rotate: 0, flipX: false, flipY: false, opacity: 0.78, strength: 1.15, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/enemy_frames/enemy_akainu/left_part.webp", x: -48.5, y: 59, w: 124, h: 132, rotate: 0, flipX: true, flipY: false, opacity: 1, strength: 1, z: 13, blend: "normal" },
        rightPart: { asset: "images/board/battle/enemy_frames/enemy_akainu/right_part.webp", x: 125, y: 52, w: 124, h: 132, rotate: 0, flipX: true, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/enemy_frames/enemy_akainu/frame.webp", x: 50, y: 50, w: 129, h: 126.5, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    enemyKizaru: {
      showBaseFrame: false,
      layers: {
        aura: { asset: "images/board/battle/enemy_frames/enemy_kizaru/aura.webp", x: 50, y: 50, w: 130, h: 124, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1.15, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/enemy_frames/enemy_kizaru/left_part.webp", x: 90, y: 52, w: 124, h: 132, rotate: -82, flipX: false, flipY: false, opacity: 1, strength: 1, z: 15, blend: "normal" },
        rightPart: { asset: "images/board/battle/enemy_frames/enemy_kizaru/right_part.webp", x: -36.5, y: 52, w: 124, h: 132, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 3, blend: "normal" },
        frame: { asset: "images/board/battle/enemy_frames/enemy_kizaru/frame.webp", x: 50, y: 50, w: 120, h: 124, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    enemyAokiji: {
      showBaseFrame: false,
      layers: {
        aura: { asset: "images/board/battle/enemy_frames/enemy_aokiji/aura.webp", x: 50, y: 50, w: 130, h: 124, rotate: 0, flipX: false, flipY: false, opacity: 0.3, strength: 1.1, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/enemy_frames/enemy_aokiji/left_part.webp", x: -52.5, y: 49.5, w: 118, h: 116.5, rotate: 0, flipX: true, flipY: false, opacity: 1, strength: 1, z: 13, blend: "normal" },
        rightPart: { asset: "images/board/battle/enemy_frames/enemy_aokiji/right_part.webp", x: 153.5, y: 49, w: 113.5, h: 113.5, rotate: 0, flipX: true, flipY: false, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/enemy_frames/enemy_aokiji/frame.webp", x: 50, y: 50, w: 107.5, h: 105.5, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    enemySommers: {
      showBaseFrame: false,
      layers: {
        aura: { asset: "images/board/battle/enemy_frames/enemy_sommers/aura.webp", x: 50, y: 50, w: 124, h: 122, rotate: 0, flipX: false, flipY: false, opacity: 0.72, strength: 1.1, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/enemy_frames/enemy_sommers/left_part.webp", x: 66.5, y: 47, w: 124, h: 132, rotate: -6, flipX: true, flipY: false, opacity: 1, strength: 1, z: 13, blend: "normal" },
        rightPart: { asset: "images/board/battle/enemy_frames/enemy_sommers/right_part.webp", x: -44.5, y: 49, w: 124, h: 122, rotate: 6, flipX: false, flipY: false, opacity: 1, strength: 1, z: 13, blend: "normal" },
        frame: { asset: "images/board/battle/enemy_frames/enemy_sommers/frame.webp", x: 50, y: 50, w: 128, h: 127, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    enemyKillingham: {
      showBaseFrame: false,
      layers: {
        aura: { asset: "images/board/battle/enemy_frames/enemy_killingham/aura.webp", x: 50, y: 50, w: 130, h: 124, rotate: 0, flipX: false, flipY: false, opacity: 0.76, strength: 1.08, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/enemy_frames/enemy_killingham/left_part.webp", x: -41.5, y: 53.5, w: 102.5, h: 126, rotate: -172, flipX: false, flipY: true, opacity: 1, strength: 1, z: 12, blend: "normal" },
        rightPart: { asset: "images/board/battle/enemy_frames/enemy_killingham/right_part.webp", x: 122.5, y: 52, w: 124, h: 132, rotate: -180, flipX: false, flipY: true, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/enemy_frames/enemy_killingham/frame.webp", x: 50, y: 50, w: 115.5, h: 119.5, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    postgameShiki: {
      showBaseFrame: false,
      layers: {
        frame: { asset: "images/board/battle/enemy_frames/postgame_shiki/frame.webp", x: 50, y: 50, w: 113, h: 113, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    postgameGildTesoro: {
      showBaseFrame: false,
      layers: {
        frame: { asset: "images/board/battle/enemy_frames/postgame_gild_tesoro/frame.webp", x: 50, y: 50, w: 113, h: 113, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    postgameZephyr: {
      showBaseFrame: false,
      layers: {
        frame: { asset: "images/board/battle/enemy_frames/postgame_zephyr/frame.webp", x: 50, y: 50, w: 113, h: 113, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    postgameTotMusica: {
      showBaseFrame: false,
      layers: {
        frame: { asset: "images/board/battle/enemy_frames/postgame_tot_musica/frame.webp", x: 50, y: 50, w: 113, h: 113, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    postgameDouglasBullet: {
      showBaseFrame: false,
      layers: {
        frame: { asset: "images/board/battle/enemy_frames/postgame_douglas_bullet/frame.webp", x: 50, y: 50, w: 113, h: 113, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    postgameSaga: {
      showBaseFrame: false,
      layers: {
        frame: { asset: "images/board/battle/enemy_frames/postgame_saga/frame.webp", x: 50, y: 50, w: 113, h: 113, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    postgameVinsmokeJudge: {
      showBaseFrame: false,
      layers: {
        frame: { asset: "images/board/battle/enemy_frames/postgame_vinsmoke_judge/frame.webp", x: 50, y: 50, w: 113, h: 113, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    postgameRobLucciAwakened: {
      showBaseFrame: false,
      layers: {
        frame: { asset: "images/board/battle/enemy_frames/postgame_rob_lucci_awakened/frame.webp", x: 50, y: 50, w: 113, h: 113, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    postgameKing: {
      showBaseFrame: false,
      layers: {
        frame: { asset: "images/board/battle/enemy_frames/postgame_king/frame.webp", x: 50, y: 50, w: 113, h: 113, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    postgameCharlotteKatakuri: {
      showBaseFrame: false,
      layers: {
        frame: { asset: "images/board/battle/enemy_frames/postgame_charlotte_katakuri/frame.webp", x: 50, y: 50, w: 113, h: 113, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    postgamePatrickRedfield: {
      showBaseFrame: false,
      layers: {
        frame: { asset: "images/board/battle/enemy_frames/postgame_patrick_redfield/frame.webp", x: 50, y: 50, w: 113, h: 113, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    postgameLoki: {
      showBaseFrame: false,
      layers: {
        frame: { asset: "images/board/battle/enemy_frames/postgame_loki/frame.webp", x: 50, y: 50, w: 113, h: 113, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    postgameOars: {
      showBaseFrame: false,
      layers: {
        frame: { asset: "images/board/battle/enemy_frames/postgame_oars/frame.webp", x: 50, y: 50, w: 113, h: 113, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    postgameAramaki: {
      showBaseFrame: false,
      layers: {
        frame: { asset: "images/board/battle/enemy_frames/postgame_aramaki/frame.webp", x: 50, y: 50, w: 113, h: 113, rotate: 0, flipX: false, flipY: false, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
  };
  const COSMETIC_FRAME_ALIAS = {
    goldendenden: "goldenDenDen",
    goldendenmushi: "goldenDenDen",
    golden: "goldenDenDen",
    threedtwoy: "threeDTwoY",
    threed2y: "threeDTwoY",
    "3d2y": "threeDTwoY",
    nikaframe: "nikaFrame",
    nika: "nikaFrame",
    luffygearfifth: "nikaFrame",
    gearfifth: "nikaFrame",
    luffygearfourth: "luffyGearFourth",
    gearfourth: "luffyGearFourth",
    luffygearsecond: "luffyGearSecond",
    gearsecond: "luffyGearSecond",
    zoroenieslobby: "zoroEniesLobby",
    enieslobbyzoro: "zoroEniesLobby",
    smokersnewworld: "smokerNewWorld",
    smokernewworld: "smokerNewWorld",
    kidnewworld: "kidNewWorld",
    kobycolonel: "kobyColonel",
    kuzantenthcaptain: "kuzanTenthCaptain",
    rayleighyoung: "rayleighYoung",
    whitebeardnewgate: "whitebeardNewgate",
    mihawknewworld: "mihawkNewWorld",
    rogeryoung: "rogerYoung",
    buggyyonko: "buggyYonko",
    crocodilenewworld: "crocodileNewWorld",
    zoronewworld: "zoroNewWorld",
    zoro: "zoroNewWorld",
    sanjinewworld: "sanjiNewWorld",
    sanji: "sanjiNewWorld",
    naminewworld: "namiNewWorld",
    nami: "namiNewWorld",
    sogeking: "sogeking",
    usoppsogeking: "sogeking",
    usoppnewworld: "usoppNewWorld",
    choppernewworld: "chopperNewWorld",
    robinnewworld: "robinNewWorld",
    brooksoulking: "brookSoulKing",
    frankyshogun: "frankyShogun",
    yonkoallclear: "yonkoAllClear",
    finalimu: "finalImu",
    emptythrone: "finalImu",
    rocksconqueror: "rocksConqueror",
    godvalleyconqueror: "rocksConqueror",
    rocks: "rocksConqueror",
    lawnewworld: "lawNewWorld",
    law: "lawNewWorld",
    carrotmoonlion: "carrotMoonLion",
    carrot: "carrotMoonLion",
    enemylucci: "enemyLucci",
    enemyroblucci: "enemyLucci",
    roblucci: "enemyLucci",
    lucci: "enemyLucci",
    enemykaku: "enemyKaku",
    kaku: "enemyKaku",
    enemydoflamingo: "enemyDoflamingo",
    doflamingo: "enemyDoflamingo",
    enemyenel: "enemyEnel",
    enel: "enemyEnel",
    enemygeckomoria: "enemyGeckoMoria",
    geckomoria: "enemyGeckoMoria",
    moria: "enemyGeckoMoria",
    enemysengoku: "enemySengoku",
    sengoku: "enemySengoku",
    enemyakainu: "enemyAkainu",
    akainu: "enemyAkainu",
    enemykizaru: "enemyKizaru",
    kizaru: "enemyKizaru",
    enemyaokiji: "enemyAokiji",
    aokiji: "enemyAokiji",
    enemysommers: "enemySommers",
    godsommers: "enemySommers",
    godknightsommers: "enemySommers",
    sommers: "enemySommers",
    enemykillingham: "enemyKillingham",
    godkillingham: "enemyKillingham",
    godknightkillingham: "enemyKillingham",
    killingham: "enemyKillingham",
    postgameshiki: "postgameShiki",
    postgamegildtesoro: "postgameGildTesoro",
    postgamezephyr: "postgameZephyr",
    postgametotmusica: "postgameTotMusica",
    postgamedouglasbullet: "postgameDouglasBullet",
    postgamesaga: "postgameSaga",
    postgamevinsmokejudge: "postgameVinsmokeJudge",
    postgameroblucciawakened: "postgameRobLucciAwakened",
    postgameking: "postgameKing",
    postgamecharlottekatakuri: "postgameCharlotteKatakuri",
    postgamepatrickredfield: "postgamePatrickRedfield",
    postgameloki: "postgameLoki",
    postgamearamaki: "postgameAramaki",
  };
  const UI_TUNING_FIELDS = [
    ["fontScale", "整體字體倍率", "", 0.5, 1.8, 0.05],
    ["panelRadius", "面板圓角", "px", 0, 36, 1],
    ["panelBorder", "面板邊框", "px", 0, 6, 0.5],
    ["hudPadY", "血條框上下距", "px", 0, 40, 1],
    ["hudPadX", "血條框左右距", "px", 0, 60, 1],
    ["hudGap", "血條框間距", "px", 0, 30, 1],
    ["hudNameSize", "名字字級", "px", 10, 52, 1],
    ["hudMetaSize", "狀態字級", "px", 8, 30, 1],
    ["hpHeight", "血條高度", "px", 4, 34, 1],
    ["cardPadding", "角色卡內距", "px", 0, 36, 1],
    ["infoPadY", "資訊框上下距", "px", 0, 50, 1],
    ["infoPadX", "資訊框左右距", "px", 0, 60, 1],
    ["choiceGap", "選項間距", "px", 0, 32, 1],
    ["choiceMinHeight", "選項高度", "px", 40, 180, 1],
    ["choicePadding", "選項內距", "px", 0, 34, 1],
    ["choiceNameSize", "選項標題字級", "px", 10, 36, 1],
    ["choiceMetaSize", "選項說明字級", "px", 8, 26, 1],
    ["logSize", "戰鬥紀錄字級", "px", 8, 28, 1],
    ["actionGap", "按鈕間距", "px", 0, 40, 1],
    ["actionPadding", "按鈕區內距", "px", 0, 40, 1],
    ["actionButtonPadY", "按鈕上下距", "px", 0, 32, 1],
    ["actionButtonPadX", "按鈕左右距", "px", 0, 48, 1],
    ["actionIconSize", "按鈕圖字級", "px", 14, 82, 1],
    ["actionLabelSize", "按鈕文字字級", "px", 10, 46, 1],
    ["statusSize", "提示文字字級", "px", 8, 32, 1],
    ["cutinSize", "招式特寫字級", "px", 12, 64, 1],
    ["statusIconSize", "狀態圖示大小", "px", 12, 64, 1],
    ["statusIconGap", "狀態圖示間距", "px", 0, 24, 1],
    ["playerStatusIconsX", "我方狀態圖示 X", "%", -20, 120, 0.5],
    ["playerStatusIconsY", "我方狀態圖示 Y", "%", -20, 120, 0.5],
    ["enemyStatusIconsX", "敵方狀態圖示 X", "%", -20, 120, 0.5],
    ["enemyStatusIconsY", "敵方狀態圖示 Y", "%", -20, 120, 0.5],
  ];
  const UI_TUNING_CSS_VARS = {
    fontScale: ["--battle-font-scale", ""],
    panelRadius: ["--battle-panel-radius", "px"],
    panelBorder: ["--battle-panel-border", "px"],
    hudPadY: ["--battle-hud-pad-y", "px"],
    hudPadX: ["--battle-hud-pad-x", "px"],
    hudGap: ["--battle-hud-gap", "px"],
    hudNameSize: ["--battle-hud-name-size", "px"],
    hudMetaSize: ["--battle-hud-meta-size", "px"],
    hpHeight: ["--battle-hp-height", "px"],
    cardPadding: ["--battle-card-padding", "px"],
    infoPadY: ["--battle-info-pad-y", "px"],
    infoPadX: ["--battle-info-pad-x", "px"],
    choiceGap: ["--battle-choice-gap", "px"],
    choiceMinHeight: ["--battle-choice-min-height", "px"],
    choicePadding: ["--battle-choice-pad", "px"],
    choiceNameSize: ["--battle-choice-name-size", "px"],
    choiceMetaSize: ["--battle-choice-meta-size", "px"],
    logSize: ["--battle-log-size", "px"],
    actionGap: ["--battle-action-gap", "px"],
    actionPadding: ["--battle-action-pad", "px"],
    actionButtonPadY: ["--battle-action-button-pad-y", "px"],
    actionButtonPadX: ["--battle-action-button-pad-x", "px"],
    actionIconSize: ["--battle-action-icon-size", "px"],
    actionLabelSize: ["--battle-action-label-size", "px"],
    statusSize: ["--battle-status-size", "px"],
    cutinSize: ["--battle-cutin-size", "px"],
    statusIconSize: ["--battle-status-icon-size", "px"],
    statusIconGap: ["--battle-status-icon-gap", "px"],
    playerStatusIconsX: ["--battle-player-status-icons-x", "%"],
    playerStatusIconsY: ["--battle-player-status-icons-y", "%"],
    enemyStatusIconsX: ["--battle-enemy-status-icons-x", "%"],
    enemyStatusIconsY: ["--battle-enemy-status-icons-y", "%"],
  };
  const STATUS_ICON_INFO = {
    poison: { label: "中毒", file: "poison.webp" },
    burn: { label: "灼傷", file: "burn.webp" },
    bleed: { label: "流血", file: "bleed.webp" },
    freeze: { label: "冰凍", file: "freeze.webp" },
    paralyze: { label: "麻痺", file: "paralyze.webp" },
    bind: { label: "束縛", file: "bind.webp" },
  };
  const ATTRIBUTE_ADVANTAGE = {
    "力": "技",
    "技": "速",
    "速": "力",
  };
  const KYUBI_MASK_ATTRIBUTES = ["力", "速", "技"];
  const HIT_EFFECT_BASE_PATH = "images/board/battle/effects/hit/";
  const HIT_EFFECT_FILES = [
    "blunt_crack.webp",
    "bullet_hit.webp",
    "bullet_sparks.webp",
    "burn_mark.webp",
    "dark_impact.webp",
    "explosion_burst.webp",
    "fire_impact.webp",
    "ice_impact.webp",
    "kick_mark.webp",
    "kick_mark_heavy.webp",
    "lightning_hit.webp",
    "pierce_mark.webp",
    "poison_splash.webp",
    "punch_combo.webp",
    "punch_mark.webp",
    "punch_mark_heavy.webp",
    "shockwave_ring.webp",
    "slash_cross.webp",
    "slash_multi.webp",
    "slash_single.webp",
    "water_splash.webp",
    "wind_slash.webp",
  ];
  const HIT_EFFECT_FILE_SET = new Set(HIT_EFFECT_FILES);
  const POSTGAME_ZEPHYR_EXPLOSION_STORY_SCENES = Object.freeze([
    Object.freeze({
      image: "images/board/story/postgame_zephyr_explosion/scene_01_countdown_v1.webp",
      kicker: "第一幕",
      title: "倒數歸零",
      line: "最後一顆炸藥岩迸出裂痕——已經沒有回頭路。",
      alt: "發出紫紅強光並開始龜裂的炸藥岩",
      hold: 2400,
    }),
    Object.freeze({
      image: "images/board/story/postgame_zephyr_explosion/scene_02_detonation_v1.webp",
      kicker: "第二幕",
      title: "引爆",
      line: "白色爆光吞沒終結點；澤法站在衝擊之前，沒有退後。",
      alt: "澤法背對玩家迎向炸藥岩爆炸",
      hold: 2500,
      flash: true,
    }),
    Object.freeze({
      image: "images/board/story/postgame_zephyr_explosion/scene_03_endpoint_collapse_v1.webp",
      kicker: "第三幕",
      title: "終結點崩壞",
      line: "島嶼從中央裂開，爆風與岩漿一同撕碎海面。",
      alt: "由空中看見終結點島嶼被爆炸撕裂",
      hold: 2700,
      flash: true,
    }),
    Object.freeze({
      image: "images/board/story/postgame_zephyr_explosion/scene_04_seabed_chain_v1.webp",
      kicker: "第四幕",
      title: "連鎖反應",
      line: "能量沿海床奔走；沉睡的火山，一座接一座甦醒。",
      alt: "海床裂縫引發多座海底火山的連鎖反應",
      hold: 2600,
    }),
    Object.freeze({
      image: "images/board/story/postgame_zephyr_explosion/scene_05_new_world_catastrophe_v1.webp",
      kicker: "終幕",
      title: "新世界陷落",
      line: "最後終結點毀滅——澤法完成了他的計畫。",
      alt: "小船面對新世界各地火山爆發的災變",
      hold: 3000,
    }),
  ]);

  const refs = {
    viewport: document.getElementById("battleViewport"),
    stage: document.getElementById("battleStage"),
    status: document.getElementById("statusMessage"),
    statusPopover: document.getElementById("statusPopover"),
    matchupChip: document.getElementById("attributeMatchupChip"),
    matchupCurrent: document.getElementById("attributeMatchupCurrent"),
    playerHudName: document.getElementById("playerHudName"),
    playerHudMeta: document.getElementById("playerHudMeta"),
    playerStatusIcons: document.getElementById("playerStatusIcons"),
    playerHpFill: document.getElementById("playerHpFill"),
    coopViewSwitch: document.getElementById("coopViewSwitch"),
    coopViewTrigger: document.getElementById("coopViewTrigger"),
    coopViewTriggerAvatar: document.getElementById("coopViewTriggerAvatar"),
    coopViewTriggerMode: document.getElementById("coopViewTriggerMode"),
    coopViewTriggerName: document.getElementById("coopViewTriggerName"),
    coopViewTriggerCount: document.getElementById("coopViewTriggerCount"),
    coopViewMenu: document.getElementById("coopViewMenu"),
    coopViewPersonList: document.getElementById("coopViewPersonList"),
    enemyHudName: document.getElementById("enemyHudName"),
    enemyHudMeta: document.getElementById("enemyHudMeta"),
    enemyStatusIcons: document.getElementById("enemyStatusIcons"),
    enemyHpTrack: document.getElementById("enemyHpTrack"),
    enemyHpFill: document.getElementById("enemyHpFill"),
    enemyPhaseHpBars: document.getElementById("enemyPhaseHpBars"),
    postgameMechanicPanel: document.getElementById("postgameBossMechanicPanel"),
    postgameMechanicFrame: document.getElementById("postgameBossMechanicFrame"),
    postgameMechanicIsland: document.getElementById("postgameBossMechanicIsland"),
    postgameMechanicTitle: document.getElementById("postgameBossMechanicTitle"),
    postgameMechanicRule: document.getElementById("postgameBossMechanicRule"),
    postgameMechanicCounter: document.getElementById("postgameBossMechanicCounter"),
    postgameMechanicState: document.getElementById("postgameBossMechanicState"),
    postgameBossTargets: document.getElementById("postgameBossTargets"),
    postgameMechanicClose: document.getElementById("postgameBossMechanicClose"),
    playerCard: document.getElementById("playerCard"),
    enemyCard: document.getElementById("enemyCard"),
    zephyrDynaStoneTarget: document.getElementById("zephyrDynaStoneTarget"),
    zephyrDynaStoneTargetImage: document.getElementById("zephyrDynaStoneTargetImage"),
    zephyrDynaStoneTargetState: document.getElementById("zephyrDynaStoneTargetState"),
    zephyrExplosionStory: document.getElementById("zephyrExplosionStory"),
    zephyrExplosionStoryImage: document.getElementById("zephyrExplosionStoryImage"),
    zephyrExplosionStoryKicker: document.getElementById("zephyrExplosionStoryKicker"),
    zephyrExplosionStoryTitle: document.getElementById("zephyrExplosionStoryTitle"),
    zephyrExplosionStoryLine: document.getElementById("zephyrExplosionStoryLine"),
    zephyrExplosionStoryProgress: document.getElementById("zephyrExplosionStoryProgress"),
    zephyrExplosionStoryHint: document.getElementById("zephyrExplosionStoryHint"),
    playerCardTier: document.getElementById("playerCardTier"),
    playerCardName: document.getElementById("playerCardName"),
    enemyCardTier: document.getElementById("enemyCardTier"),
    enemyCardName: document.getElementById("enemyCardName"),
    playerPortrait: document.getElementById("playerPortrait"),
    enemyPortrait: document.getElementById("enemyPortrait"),
    playerPortraitWrap: document.getElementById("playerPortraitWrap"),
    tesoroGoldCoating: document.getElementById("tesoroGoldCoating"),
    enemyPortraitWrap: document.getElementById("enemyPortraitWrap"),
    kingFlameStateAura: document.getElementById("kingFlameStateAura"),
    kingFlameStatePlate: document.getElementById("kingFlameStatePlate"),
    kingFlameStateTitle: document.getElementById("kingFlameStateTitle"),
    kingFlameStateDetail: document.getElementById("kingFlameStateDetail"),
    kingFlameTransition: document.getElementById("kingFlameTransition"),
    kingFlameTransitionTitle: document.getElementById("kingFlameTransitionTitle"),
    kingFlameTransitionDetail: document.getElementById("kingFlameTransitionDetail"),
    kingFlameGuardFx: document.getElementById("kingFlameGuardFx"),
    shikiArchipelagoStage: document.getElementById("shikiArchipelagoStage"),
    judgeCloneGuardLayer: document.getElementById("judgeCloneGuardLayer"),
    coopAllyStack: document.getElementById("coopAllyStack"),
    lucciSixPowerFx: document.getElementById("lucciSixPowerFx"),
    lucciSixPowerImage: document.getElementById("lucciSixPowerImage"),
    lucciSixPowerName: document.getElementById("lucciSixPowerName"),
    lucciSixPowerEffect: document.getElementById("lucciSixPowerEffect"),
    lucciRokuoganFx: document.getElementById("lucciRokuoganFx"),
    lucciRokuoganCast: document.getElementById("lucciRokuoganCast"),
    lucciRokuoganImpact: document.getElementById("lucciRokuoganImpact"),
    speedlinesFx: document.getElementById("speedlinesFx"),
    cutInFx: document.getElementById("cutInFx"),
    diceBonusFx: document.getElementById("diceBonusFx"),
    diceBonusTitle: document.getElementById("diceBonusTitle"),
    diceBonusOrb: document.getElementById("diceBonusOrb"),
    diceBonusSecondOrb: document.getElementById("diceBonusSecondOrb"),
    diceBonusThirdOrb: document.getElementById("diceBonusThirdOrb"),
    diceBonusSubtitle: document.getElementById("diceBonusSubtitle"),
    katakuriFutureSightCinematic: document.getElementById("katakuriFutureSightCinematic"),
    katakuriFutureSightVideo: document.getElementById("katakuriFutureSightVideo"),
    katakuriFutureSightTitle: document.getElementById("katakuriFutureSightTitle"),
    totMusicaDualFx: document.getElementById("totMusicaDualFx"),
    totMusicaRealSideLabel: document.getElementById("totMusicaRealSideLabel"),
    totMusicaRealName: document.getElementById("totMusicaRealName"),
    totMusicaRealMove: document.getElementById("totMusicaRealMove"),
    totMusicaRealFrame: document.getElementById("totMusicaRealFrame"),
    totMusicaRealPortrait: document.getElementById("totMusicaRealPortrait"),
    totMusicaRealHudName: document.getElementById("totMusicaRealHudName"),
    totMusicaRealLevel: document.getElementById("totMusicaRealLevel"),
    totMusicaRealAttribute: document.getElementById("totMusicaRealAttribute"),
    totMusicaRealHpText: document.getElementById("totMusicaRealHpText"),
    totMusicaRealHpFill: document.getElementById("totMusicaRealHpFill"),
    totMusicaRealCarry: document.getElementById("totMusicaRealCarry"),
    totMusicaRealStatusIcons: document.getElementById("totMusicaRealStatusIcons"),
    totMusicaRealDiceCluster: document.getElementById("totMusicaRealDiceCluster"),
    totMusicaRealDiceRow: document.getElementById("totMusicaRealDiceRow"),
    totMusicaRealDie: document.getElementById("totMusicaRealDie"),
    totMusicaRealDie2: document.getElementById("totMusicaRealDie2"),
    totMusicaRealDie3: document.getElementById("totMusicaRealDie3"),
    totMusicaRealParity: document.getElementById("totMusicaRealParity"),
    totMusicaRealTotal: document.getElementById("totMusicaRealTotal"),
    totMusicaSongSideLabel: document.getElementById("totMusicaSongSideLabel"),
    totMusicaSongName: document.getElementById("totMusicaSongName"),
    totMusicaSongMove: document.getElementById("totMusicaSongMove"),
    totMusicaSongFrame: document.getElementById("totMusicaSongFrame"),
    totMusicaSongPortrait: document.getElementById("totMusicaSongPortrait"),
    totMusicaSongHudName: document.getElementById("totMusicaSongHudName"),
    totMusicaSongLevel: document.getElementById("totMusicaSongLevel"),
    totMusicaSongAttribute: document.getElementById("totMusicaSongAttribute"),
    totMusicaSongHpText: document.getElementById("totMusicaSongHpText"),
    totMusicaSongHpFill: document.getElementById("totMusicaSongHpFill"),
    totMusicaSongCarry: document.getElementById("totMusicaSongCarry"),
    totMusicaSongStatusIcons: document.getElementById("totMusicaSongStatusIcons"),
    totMusicaSongDiceCluster: document.getElementById("totMusicaSongDiceCluster"),
    totMusicaSongDiceRow: document.getElementById("totMusicaSongDiceRow"),
    totMusicaSongDie: document.getElementById("totMusicaSongDie"),
    totMusicaSongDie2: document.getElementById("totMusicaSongDie2"),
    totMusicaSongDie3: document.getElementById("totMusicaSongDie3"),
    totMusicaSongParity: document.getElementById("totMusicaSongParity"),
    totMusicaSongTotal: document.getElementById("totMusicaSongTotal"),
    totMusicaCollisionLeftFace: document.getElementById("totMusicaCollisionLeftFace"),
    totMusicaCollisionRightFace: document.getElementById("totMusicaCollisionRightFace"),
    totMusicaSyncCoreValue: document.getElementById("totMusicaSyncCoreValue"),
    totMusicaEnemyLabel: document.getElementById("totMusicaEnemyLabel"),
    totMusicaBossFrame: document.getElementById("totMusicaBossFrame"),
    totMusicaBossPortrait: document.getElementById("totMusicaBossPortrait"),
    totMusicaBossHudName: document.getElementById("totMusicaBossHudName"),
    totMusicaBossHpText: document.getElementById("totMusicaBossHpText"),
    totMusicaBossHpFill: document.getElementById("totMusicaBossHpFill"),
    totMusicaBossStatusIcons: document.getElementById("totMusicaBossStatusIcons"),
    totMusicaBossPreviewToggle: document.getElementById("totMusicaBossPreviewToggle"),
    totMusicaBossPreviewBack: document.getElementById("totMusicaBossPreviewBack"),
    totMusicaBossDiceCluster: document.getElementById("totMusicaBossDiceCluster"),
    totMusicaBossDie: document.getElementById("totMusicaBossDie"),
    totMusicaBossDiceLabel: document.getElementById("totMusicaBossDiceLabel"),
    totMusicaBossDiceTotal: document.getElementById("totMusicaBossDiceTotal"),
    totMusicaDualResult: document.getElementById("totMusicaDualResult"),
    kyubiMaskFx: document.getElementById("kyubiMaskFx"),
    kyubiMaskItem: document.getElementById("kyubiMaskItem"),
    kyubiMaskText: document.getElementById("kyubiMaskText"),
    sanjiRaidSuitFx: document.getElementById("sanjiRaidSuitFx"),
    sanjiRaidSuitKicker: document.getElementById("sanjiRaidSuitKicker"),
    sanjiRaidSuitTitle: document.getElementById("sanjiRaidSuitTitle"),
    sanjiRaidSuitBefore: document.getElementById("sanjiRaidSuitBefore"),
    sanjiRaidSuitFinal: document.getElementById("sanjiRaidSuitFinal"),
    sanjiRaidSuitItem: document.getElementById("sanjiRaidSuitItem"),
    sanjiRaidSuitName: document.getElementById("sanjiRaidSuitName"),
    sanjiRaidSuitEffect: document.getElementById("sanjiRaidSuitEffect"),
    bulletFusionFx: document.getElementById("bulletFusionFx"),
    bulletFusionTitle: document.getElementById("bulletFusionTitle"),
    bulletFusionTarget: document.getElementById("bulletFusionTarget"),
    bulletFusionTargetIcon: document.getElementById("bulletFusionTargetIcon"),
    bulletFusionTargetSockets: document.getElementById("bulletFusionTargetSockets"),
    bulletFusionCrewRail: document.getElementById("bulletFusionCrewRail"),
    bulletFusionEffectBanner: document.getElementById("bulletFusionEffectBanner"),
    sagaFusionFx: document.getElementById("sagaFusionFx"),
    sagaFusionStage: document.getElementById("sagaFusionStage"),
    sagaFusionTitle: document.getElementById("sagaFusionTitle"),
    sagaFusionBefore: document.getElementById("sagaFusionBefore"),
    sagaFusionFinal: document.getElementById("sagaFusionFinal"),
    sagaFusionSword: document.getElementById("sagaFusionSword"),
    sagaFusionResult: document.getElementById("sagaFusionResult"),
    sagaFusionEffect: document.getElementById("sagaFusionEffect"),
    blackTurnCastFx: document.getElementById("blackTurnCastFx"),
    blackTurnCastCard: document.getElementById("blackTurnCastCard"),
    blackTurnCastPortrait: document.getElementById("blackTurnCastPortrait"),
    blackTurnDemonCastName: document.getElementById("blackTurnDemonCastName"),
    blackTurnEnemyCard: document.getElementById("blackTurnEnemyCard"),
    blackTurnEnemyPortrait: document.getElementById("blackTurnEnemyPortrait"),
    blackTurnCastText: document.getElementById("blackTurnCastText"),
    enemyDemonName: document.getElementById("enemyDemonName"),
    impactFx: document.getElementById("impactFx"),
    damagePop: document.getElementById("damagePop"),
    raidPhaseFx: document.getElementById("raidPhaseFx"),
    raidClearText: document.getElementById("raidClearText"),
    raidDefeatedName: document.getElementById("raidDefeatedName"),
    raidRewardWheel: document.getElementById("raidRewardWheel"),
    raidRewardIcon: document.getElementById("raidRewardIcon"),
    raidRewardLabel: document.getElementById("raidRewardLabel"),
    raidRewardDescription: document.getElementById("raidRewardDescription"),
    raidNextEnemyName: document.getElementById("raidNextEnemyName"),
    infoPanel: document.querySelector("[data-layout-id='infoPanel']"),
    actionPanel: document.querySelector("[data-layout-id='actionPanel']"),
    actionHeadingTitle: document.querySelector("[data-layout-id='actionPanel'] .battle-action-heading strong"),
    actionHeadingSubtitle: document.querySelector("[data-layout-id='actionPanel'] .battle-action-heading span"),
    infoTitle: document.getElementById("infoTitle"),
    infoContent: document.getElementById("infoContent"),
  };

  const portraitState = {
    player: "normal",
    enemy: "normal",
  };
  const portraitTimers = {
    player: null,
    enemy: null,
  };
  const KNOCKOUT_FADE_DELAY_MS = 1250;
  const KNOCKOUT_REPEAT_FADE_DELAY_MS = 900;
  const KNOCKOUT_FADE_DURATION_MS = 1050;
  const KNOCKOUT_ANNOUNCE_AFTER_FADE_BUFFER_MS = 120;
  const REPLACEMENT_PANEL_KO_BUFFER_MS = 360;
  const knockoutTimers = {
    player: null,
    enemy: null,
  };
  let playerKnockoutPanelReadyAt = 0;
  let replacementPanelGateKey = "";
  let replacementPanelAutoKoKey = "";
  let replacementPanelTimer = null;
  let nikaAwakeningHeartbeatTimer = null;
  const knockoutVisualStarted = {
    player: false,
    enemy: false,
  };
  const knockoutHiddenCombatantKeys = {
    player: "",
    enemy: "",
  };
  const PLACEHOLDER_BATTLE_PORTRAIT = "images/board/battle/portraits/placeholder/normal.webp";
  const JUDGE_CLONE_GUARD_ASSET = "images/board/battle/postgame_mechanic_effects/judge_clone_guard/judge_clone_guard.webp";
  const missingPortraitSrc = new Set();

  let currentMode = null;
  let selectedBattleItemId = "";
  let latestView = null;
  let activeZephyrExplosionStoryEventId = "";
  let zephyrExplosionStoryIndex = 0;
  let zephyrExplosionStoryChanging = false;
  let zephyrExplosionStoryFinished = false;
  let zephyrExplosionStoryTimer = null;
  let selectedPostgameTargetId = "boss";
  let oarsPendingBetKey = "";
  const oarsPendingBetStakes = new Map();
  let postgameMechanicDetailOpen = false;
  let postgameMechanicDetailKey = "";
  let lastShikiArchipelagoEventSerial = 0;
  const shikiArchipelagoBreakTimers = new Map();
  let shikiArchipelagoRenderKey = "";
  const shikiArchipelagoBreakingIslandIds = new Set();
  let totMusicaSelectionSignature = "";
  let totMusicaSelections = { real: null, song: null };
  let totMusicaSelectionWorld = "real";
  let totMusicaWorldModes = { real: null, song: null };
  let totMusicaWorldItemIds = { real: "", song: "" };
  let totMusicaDualAwaitingEvent = false;
  let totMusicaDualAnimationActive = false;
  let totMusicaDualAwaitTimer = null;
  let totMusicaBossPreviewOpen = false;
  let totMusicaTeamSlots = { real: [], song: [] };
  let totMusicaTeamPickedIndex = null;
  let totMusicaTeamSelectionSignature = "";
  let pendingBattleFinishSignature = "";
  let pendingBattleFinishUntil = 0;
  let lastYonkoPhaseKey = "";
  let lastYonkoPhase2 = false;
  let yonkoPhaseFxTimer = null;
  let lastCoopActorId = "";
  let coopActorForwardTimer = null;
  let selectedCoopViewPlayerId = "";
  let coopViewMenuOpen = false;
  let coopViewBattleScope = "";
  let lastCoopCommandPlayerId = "";
  let activeLineageExtractionScopeKey = "";
  let activePrebattleIntroId = "";
  let activePrebattleIntroKey = "";
  let lastCompletedPrebattleIntroAckKey = "";
  let lastCompletedPrebattleIntroAckAt = 0;
  let prebattleIntroActive = false;
  let prebattleIntroTimers = [];
  let phase2DialogueActive = false;
  let phase2DialogueTimers = [];
  const storedPrebattleIntroTokens = readStoredPrebattleIntroIds();
  const completedPrebattleIntroIds = new Set(storedPrebattleIntroTokens.filter((token) => !storedPrebattleIntroTokenKey(token)));
  const completedPrebattleIntroKeys = new Set(
    storedPrebattleIntroTokens
      .map((token) => storedPrebattleIntroTokenKey(token))
      .filter(Boolean)
  );
  const panelScrollTops = {
    partners: 0,
    replacement: 0,
    items: 0,
  };
  let processedLogLength = null;
  let lastVisualEventId = "";
  let activeKatakuriFutureSightEventId = "";
  let katakuriFutureSightTimer = null;
  let katakuriFutureSightLoadedHandler = null;
  let lastBattleIdentity = "";
  let lastRenderedKingFlameOn = null;
  let kingFlameTransitionTimer = null;
  let kingFlameGuardTimer = null;
  let raidFxTimers = [];
  let impactFxTimers = [];
  let kyubiMaskFxTimers = [];
  let kyubiMaskAttrInterval = null;
  let activeKyubiMaskEventId = "";
  let sanjiRaidSuitFxTimers = [];
  let bulletFusionFxTimers = [];
  let bulletFusionFlightAnimations = [];
  let sagaFusionFxTimers = [];
  let oarsPurificationFxTimers = [];
  let lucciSixPowerFxTimers = [];
  let lucciRokuoganFxTimers = [];
  const lucciRokuoganVoiceAudio = { call: null, hit: null };
  let lucciRokuoganEffectAudioSilenced = false;
  let lucciRokuoganBgmHold = null;
  const LUCCI_ROKUOGAN_CINEMATIC_MS = 5200;
  const LUCCI_ROKUOGAN_TARGET_REVEAL_MS = 600;
  const LUCCI_ROKUOGAN_IMPACT_AT_MS = LUCCI_ROKUOGAN_CINEMATIC_MS + LUCCI_ROKUOGAN_TARGET_REVEAL_MS;
  const LUCCI_ROKUOGAN_HIT_POSE_MS = 1600;
  const LUCCI_ROKUOGAN_TOTAL_MS = 7600;
  let blackTurnFxTimers = [];
  let totMusicaDualFxTimers = [];
  let totMusicaDualDiceIntervals = [];
  const TOT_MUSICA_DICE_ROLL_MS = 1800;
  const TOT_MUSICA_DICE_HOLD_MS = 800;
  const TOT_MUSICA_DICE_CYCLE_MS = TOT_MUSICA_DICE_ROLL_MS + TOT_MUSICA_DICE_HOLD_MS;
  const TOT_MUSICA_DICE_TICK_MS = 90;
  const TOT_MUSICA_FIRST_DICE_HOLD_MS = 700;
  const TOT_MUSICA_DICE_COLLISION_MS = 1100;
  const TOT_MUSICA_FUSION_HOLD_MS = 1300;
  const TOT_MUSICA_VERTICAL_CAMERA_MS = 2900;
  const TOT_MUSICA_ATTACK_TRAVEL_MS = 4200;
  const TOT_MUSICA_BOSS_REVEAL_HOLD_MS = 1100;
  let lastJudgeCloneCount = null;
  let judgeCloneGuardTimer = null;
  let visualHpOverride = null;
  let completedImpactEventId = "";
  const statusIconDelays = {
    player: null,
    enemy: null,
  };
  const lastRenderedStatusCombatants = {
    player: null,
    enemy: null,
  };
  const lastCombatantKeys = {
    player: "",
    enemy: "",
  };
  let diceFxTimer = null;
  let diceFxInterval = null;
  let currentLayout = JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
  let currentPortraitLayout = JSON.parse(JSON.stringify(DEFAULT_PORTRAIT_LAYOUT));
  let currentUiTuning = JSON.parse(JSON.stringify(DEFAULT_UI_TUNING));
  let tuningPanel = null;
  let selectedLayoutId = "playerCard";

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readStoredPrebattleIntroIds() {
    try {
      const raw = sessionStorage.getItem(PREBATTLE_INTRO_DONE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.map((id) => String(id || "").trim()).filter(Boolean).slice(-PREBATTLE_INTRO_DONE_LIMIT)
        : [];
    } catch (_error) {
      return [];
    }
  }

  function storedPrebattleIntroTokenKey(token) {
    const text = String(token || "");
    if (!text.startsWith("key:")) return "";
    const timestampMatch = text.match(/^key:(\d+):(.*)$/);
    if (timestampMatch) {
      const createdAt = Number(timestampMatch[1] || 0);
      if (!createdAt || Date.now() - createdAt > PREBATTLE_INTRO_KEY_DONE_TTL_MS) return "";
      return timestampMatch[2] || "";
    }
    return text.slice(4);
  }

  function writeStoredPrebattleIntroTokens() {
    const now = Date.now();
    const keyTokens = Array.from(completedPrebattleIntroKeys).filter(Boolean).map((key) => `key:${now}:${key}`);
    const keptIds = [...Array.from(completedPrebattleIntroIds).filter(Boolean), ...keyTokens].slice(-PREBATTLE_INTRO_DONE_LIMIT);
    const keptKeyTokenSet = new Set(keptIds.map((token) => storedPrebattleIntroTokenKey(token)).filter(Boolean));
    const keptRawIdSet = new Set(keptIds.filter((token) => !storedPrebattleIntroTokenKey(token)));
    if (keptRawIdSet.size !== completedPrebattleIntroIds.size) {
      completedPrebattleIntroIds.clear();
      keptRawIdSet.forEach((keptId) => completedPrebattleIntroIds.add(keptId));
    }
    if (keptKeyTokenSet.size !== completedPrebattleIntroKeys.size) {
      completedPrebattleIntroKeys.clear();
      keptKeyTokenSet.forEach((token) => completedPrebattleIntroKeys.add(token));
    }
    try {
      sessionStorage.setItem(PREBATTLE_INTRO_DONE_STORAGE_KEY, JSON.stringify(keptIds));
    } catch (_error) {
      // Storage may be unavailable in private or embedded contexts; the in-memory set still prevents repeats.
    }
  }

  function rememberCompletedPrebattleIntroId(introId) {
    const id = String(introId || "").trim();
    if (!id) return;
    completedPrebattleIntroIds.add(id);
    writeStoredPrebattleIntroTokens();
  }

  function prebattleIntroKeyPart(value, fallback = "x") {
    const text = String(value ?? "").trim() || String(fallback || "x");
    return text.replace(/[^\w\u3400-\u9fff.-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 96) || String(fallback || "x");
  }

  function prebattleIntroRuntimeKey(view) {
    const intro = view?.battle?.prebattleIntro;
    const explicitKey = String(intro?.key || view?.battle?.prebattleIntroKey || "").trim();
    if (explicitKey) return explicitKey;
    const battle = view?.battle || {};
    return [
      battle.coopView?.currentPlayerId || view?.player?.id || battle.playerId || "player",
      battle.islandId || battle.islandKind || "battle",
      battle.islandKind || "battle",
      view?.enemy?.key || view?.enemy?.id || view?.enemy?.name || intro?.enemyKey || intro?.enemyName || "enemy",
      view?.activeCard?.id || view?.activeCard?.key || intro?.heroKey || intro?.heroName || "hero",
    ].map((part) => prebattleIntroKeyPart(part)).join(":");
  }

  function rememberCompletedPrebattleIntro(introId, view, introKey = "") {
    rememberCompletedPrebattleIntroId(introId);
    const key = String(introKey || prebattleIntroRuntimeKey(view) || "").trim();
    if (key) completedPrebattleIntroKeys.add(key);
    writeStoredPrebattleIntroTokens();
  }

  function mergeWithDefaults(defaults, value) {
    return { ...clone(defaults), ...(value || {}) };
  }

  function applyLayout() {
    const saved = readTuningDraft();
    currentLayout = mergeWithDefaults(DEFAULT_LAYOUT, saved?.layout);
    if (Number(currentLayout.enemyHud?.y) < 0) {
      currentLayout.enemyHud.y = DEFAULT_LAYOUT.enemyHud.y;
    }
    currentPortraitLayout = mergeWithDefaults(DEFAULT_PORTRAIT_LAYOUT, saved?.portraits);
    currentUiTuning = mergeWithDefaults(DEFAULT_UI_TUNING, saved?.ui);
    Object.entries(currentLayout).forEach(([key, item]) => {
      const element = document.querySelector(`[data-layout-id="${key}"]`);
      if (!element) return;
      element.style.left = `${item.x}%`;
      if (key === "playerCard" || key === "enemyCard") {
        element.style.top = `${item.y}%`;
        element.style.removeProperty("bottom");
        element.style.width = `clamp(348px, calc(${item.w}vw + 38px), 376px)`;
        element.style.height = "auto";
        element.style.aspectRatio = "1 / 1";
      } else {
        const defaultItem = DEFAULT_LAYOUT[key];
        const followsCharacterBottom = ["infoPanel", "actionPanel"].includes(key)
          && Number(item.y) === Number(defaultItem?.y)
          && Number(item.h) === Number(defaultItem?.h);
        if (followsCharacterBottom) {
          const playerCardLayout = currentLayout.playerCard || DEFAULT_LAYOUT.playerCard;
          element.style.top = `calc(${Number(playerCardLayout.y || 0)}% + clamp(348px, calc(${Number(playerCardLayout.w || 0)}vw + 38px), 376px) - 12px)`;
          element.style.bottom = `${DEFAULT_CONTROL_PANEL_BOTTOM_GAP}%`;
          element.style.height = "auto";
        } else {
          element.style.top = `${item.y}%`;
          element.style.removeProperty("bottom");
          element.style.height = `${item.h}%`;
        }
        element.style.width = `${item.w}%`;
        element.style.removeProperty("aspect-ratio");
      }
    });
    applyPortraitLayout();
    applyUiTuning();
  }

  function fitBattleViewport() {
    if (!refs.viewport || !refs.stage) return;
    const viewport = window.visualViewport;
    const viewportWidth = Math.max(1, viewport?.width || window.innerWidth);
    const viewportHeight = Math.max(1, viewport?.height || window.innerHeight);
    const shouldFit = viewportWidth < 1024 || viewportHeight < 576;
    const phonePortrait = viewportWidth <= 600 && viewportHeight > viewportWidth;
    const tabletPortrait = viewportWidth > 600 && viewportHeight > viewportWidth;
    refs.viewport.classList.toggle("battle-viewport-fitted", shouldFit);
    document.body.classList.toggle("battle-phone-portrait", phonePortrait);
    document.body.classList.toggle("battle-tablet-portrait", tabletPortrait);

    refs.stage.classList.remove("lineage-viewport-fitted");
    refs.stage.style.removeProperty("--lineage-stage-scale");
    refs.stage.style.removeProperty("--lineage-stage-left");
    refs.stage.style.removeProperty("--lineage-stage-top");

    if (!shouldFit) {
      refs.viewport.style.removeProperty("--battle-viewport-scale");
      refs.viewport.style.removeProperty("--battle-viewport-left");
      refs.viewport.style.removeProperty("--battle-viewport-top");
      return;
    }
    const scale = Math.min(viewportWidth / 1024, viewportHeight / 576);
    refs.viewport.style.setProperty("--battle-viewport-scale", scale.toFixed(6));
    refs.viewport.style.setProperty("--battle-viewport-left", `${(viewport?.offsetLeft || 0) + viewportWidth / 2}px`);
    refs.viewport.style.setProperty("--battle-viewport-top", `${(viewport?.offsetTop || 0) + viewportHeight / 2}px`);
  }

  function readTuningDraft() {
    try {
      const raw = localStorage.getItem(BATTLE_LAYOUT_DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  function writeTuningDraft() {
    const payload = {
      layout: currentLayout,
      portraits: currentPortraitLayout,
      ui: currentUiTuning,
    };
    localStorage.setItem(BATTLE_LAYOUT_DRAFT_KEY, JSON.stringify(payload, null, 2));
    return payload;
  }

  function applyPortraitLayout() {
    [
      ["player", refs.playerPortraitWrap],
      ["enemy", refs.enemyPortraitWrap],
    ].forEach(([side, wrap]) => {
      if (!wrap) return;
      const item = currentPortraitLayout[side] || DEFAULT_PORTRAIT_LAYOUT[side];
      wrap.style.setProperty("--portrait-x", `${item.x}%`);
      wrap.style.setProperty("--portrait-y", `${item.y}%`);
      wrap.style.setProperty("--portrait-scale", String(item.scale));
    });
  }

  function applyUiTuning() {
    if (!refs.stage) return;
    Object.entries(UI_TUNING_CSS_VARS).forEach(([key, [name, unit]]) => {
      const value = currentUiTuning[key] ?? DEFAULT_UI_TUNING[key];
      refs.stage.style.setProperty(name, `${value}${unit}`);
    });
  }

  function showStatus(message) {
    refs.status.textContent = message;
    refs.status.classList.add("show");
    clearTimeout(showStatus.timer);
    showStatus.timer = setTimeout(() => refs.status.classList.remove("show"), 2300);
  }

  function hideStatusPopover() {
    if (!refs.statusPopover) return;
    refs.statusPopover.classList.remove("open");
    refs.statusPopover.classList.remove("carry-popover");
    refs.statusPopover.classList.remove("carry-arsenal-popover");
    refs.statusPopover.onclick = null;
    refs.statusPopover.setAttribute("aria-hidden", "true");
  }

  function positionStatusPopover(trigger) {
    if (!refs.statusPopover || !trigger) return;
    const rect = trigger.getBoundingClientRect();
    const popRect = refs.statusPopover.getBoundingClientRect();
    const left = clamp(rect.left + rect.width / 2 - popRect.width / 2, 12, window.innerWidth - popRect.width - 12);
    const above = rect.top - popRect.height - 10;
    const top = above >= 12 ? above : Math.min(window.innerHeight - popRect.height - 12, rect.bottom + 10);
    refs.statusPopover.style.left = `${left}px`;
    refs.statusPopover.style.top = `${Math.max(12, top)}px`;
  }

  function selectCarryArsenalItem(trigger, button, item, index) {
    if (!refs.statusPopover || !button || !item) return;
    refs.statusPopover.querySelectorAll("[data-carry-arsenal-choice]").forEach((entry) => {
      const selected = entry === button;
      entry.classList.toggle("is-selected", selected);
      entry.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    const detail = refs.statusPopover.querySelector("[data-carry-arsenal-detail]");
    if (detail) {
      detail.classList.remove("is-empty");
      detail.innerHTML = `
        <div class="carry-arsenal-detail-title">兵裝 ${escapeHtml(index + 1)}・${escapeHtml(item.name || "攜帶物")}</div>
        <div class="carry-arsenal-detail-status">目前狀態：${escapeHtml(item.status || "戰鬥中生效")}</div>
        <div class="carry-arsenal-detail-effect">完整效果：${escapeHtml(item.summary || "沒有登錄效果。")}</div>
      `;
    }
    positionStatusPopover(trigger);
  }

  function showStatusPopover(trigger, detail) {
    if (!refs.statusPopover || !trigger) return;
    const turns = Number(detail.turns || 0);
    const durationText = String(detail.durationText || "").trim();
    const isCarryItem = detail.kind === "carry";
    const carrySubItems = isCarryItem && Array.isArray(detail.subItems) ? detail.subItems.filter((item) => item?.id) : [];
    const hasCarrySubItems = carrySubItems.length > 0;
    refs.statusPopover.classList.toggle("carry-popover", isCarryItem);
    refs.statusPopover.classList.toggle("carry-arsenal-popover", hasCarrySubItems);
    refs.statusPopover.innerHTML = `
      <div class="status-popover-title">${escapeHtml(detail.label || "效果")}</div>
      <div class="status-popover-turns">${isCarryItem ? `目前狀態：${escapeHtml(detail.result || "戰鬥中生效")}` : (durationText || (turns > 0 ? `剩餘 ${escapeHtml(turns)} 回合` : "即時效果 / 本次效果"))}</div>
      ${isCarryItem ? "" : `<div class="status-popover-desc">套用結果：${escapeHtml(detail.result || detail.label || "效果")}</div>`}
      <div class="status-popover-desc${isCarryItem ? " status-popover-effect" : ""}">${isCarryItem ? "完整效果：" : ""}${escapeHtml(detail.description || "沒有額外說明。")}</div>
      ${hasCarrySubItems ? `
        <div class="carry-arsenal-picker-title">武器庫兵裝・選擇一件查看</div>
        <div class="carry-arsenal-picker">
          ${carrySubItems.map((item, index) => `
            <button type="button" class="carry-arsenal-choice" data-carry-arsenal-choice="${escapeHtml(index)}" aria-pressed="false">
              <span>兵裝 ${escapeHtml(index + 1)}</span>
              <strong>${escapeHtml(item.name || "攜帶物")}</strong>
            </button>
          `).join("")}
        </div>
        <div class="carry-arsenal-detail is-empty" data-carry-arsenal-detail>點選上方兵裝查看目前狀態與完整效果。</div>
      ` : ""}
    `;
    refs.statusPopover.classList.add("open");
    refs.statusPopover.setAttribute("aria-hidden", "false");
    refs.statusPopover.onclick = hasCarrySubItems ? (event) => event.stopPropagation() : null;
    refs.statusPopover.querySelectorAll("[data-carry-arsenal-choice]").forEach((button, index) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        selectCarryArsenalItem(trigger, button, carrySubItems[index], index);
      });
    });
    positionStatusPopover(trigger);
  }

  function simpleEffectTitle(label = "", icon = "") {
    const text = String(label || "");
    const iconText = String(icon || "");
    const loweredIcon = iconText.toLowerCase();
    const persistentStatuses = ["poison", "burn", "bleed", "freeze", "paralyze", "bind"];
    if (/護盾|減傷|防壁|格擋/.test(text) || loweredIcon === "shield") return "傷害降低";
    if (/反彈|反制/.test(text) || loweredIcon === "reflect") return "反擊效果";
    if (/治療|回復/.test(text) || loweredIcon === "heal") return "生命回復";
    if (/先制/.test(text) || loweredIcon === "first") return "行動順序上升";
    if (/中毒|灼傷|流血|冰凍|麻痺|束縛/.test(text) || persistentStatuses.includes(loweredIcon)) return text || "特殊狀態";
    if (/蓄力|傷害加成|下一次攻擊|本次攻擊|追加.*傷害|高骰.*傷害/.test(text)) return "傷害上升";
    if (/易傷/.test(text) || loweredIcon === "damage_up") return "受傷上升";
    if (/封鎖/.test(text)) return "行動下降";
    const statName = text.match(/(攻擊|防禦|特攻|特防|戰術|意志|速度|命中|閃避|骰面)/)?.[1] || "";
    if (statName && (/[+＋↑]/.test(text) || /提升|強化/.test(text))) return `${statName}上升`;
    if (statName && (/[-－↓]/.test(text) || /下降|降低/.test(text))) return `${statName}下降`;
    const statFromIcon = iconText.match(/^(atk|def|satk|sdef|spd|accuracy|evasion)_(up|down)$/);
    if (statFromIcon) {
      const statLabel = {
        atk: "攻擊",
        def: "防禦",
        satk: "特攻",
        sdef: "特防",
        spd: "速度",
        accuracy: "命中",
        evasion: "閃避",
      }[statFromIcon[1]];
      return `${statLabel}${statFromIcon[2] === "up" ? "上升" : "下降"}`;
    }
    if (/[+＋↑]/.test(text) || /提升|強化/.test(text)) return "能力上升";
    if (/[-－↓]/.test(text) || /下降|降低/.test(text)) return "能力下降";
    return text || "效果";
  }

  function simpleEffectDescription(detail = {}, icon = "") {
    const label = String(detail.label || "效果");
    const description = String(detail.description || "").trim();
    const loweredIcon = String(icon || detail.icon || "").toLowerCase();
    const persistentStatuses = ["poison", "burn", "bleed", "freeze", "paralyze", "bind"];
    if (/護盾|減傷|防壁|格擋/.test(label) || loweredIcon === "shield") return `${label}，本回合受到的傷害降低。`;
    if (/反彈/.test(label) || loweredIcon === "reflect") return `${label}，被攻擊時會反制或反彈傷害。`;
    if (/反制/.test(label)) return `${label}，被攻擊時會讓對手受到反制效果。`;
    if (/治療|回復/.test(label) || loweredIcon === "heal") return `${label}，回復生命值。`;
    if (/先制/.test(label) || loweredIcon === "first") return `${label}，行動順序暫時提前。`;
    if (/中毒|灼傷|流血|冰凍|麻痺|束縛/.test(label) || persistentStatuses.includes(loweredIcon)) {
      return description ? description.split(/[。.!！]/)[0] + "。" : `${label}狀態。`;
    }
    if (/蓄力|傷害加成|下一次攻擊|本次攻擊|追加.*傷害|高骰.*傷害/.test(label)) return `${label}，下一次或本次攻擊傷害提高。`;
    if (/易傷/.test(label) || loweredIcon === "damage_up") return `${label}，受到的傷害暫時增加。`;
    if (/封鎖/.test(label)) return `${label}，限制可使用的行動。`;
    const statName = label.match(/(攻擊|防禦|特攻|特防|戰術|意志|速度|命中|閃避|骰面)/)?.[1] || "";
    if (statName && description) return description.split(/[。.!！]/)[0] + "。";
    if (statName && (/[+＋↑]/.test(label) || /提升|強化/.test(label))) return `${label}，${statName}提高，持續到換下或瀕死。`;
    if (statName && (/[-－↓]/.test(label) || /下降|降低/.test(label))) return `${label}，${statName}降低，持續到換下或瀕死。`;
    if (/[+＋↑]/.test(label) || /提升|強化/.test(label)) return description ? description.split(/[。.!！]/)[0] + "。" : `${label}，能力提高，持續到換下或瀕死。`;
    if (/[-－↓]/.test(label) || /下降|降低/.test(label)) return description ? description.split(/[。.!！]/)[0] + "。" : `${label}，能力降低，持續到換下或瀕死。`;
    if (description) return description.split(/[。.!！]/)[0] + "。";
    return `${label}。`;
  }

  function fallbackStatusIconData(icon = "", label = "") {
    const key = String(icon || "").toLowerCase();
    const known = ["bleed", "damage_up", "poison", "burn", "freeze", "paralyze", "bind", "shield", "reflect", "heal", "first"]
      .find((status) => key.includes(status));
    return known
      ? `images/board/battle/status_icons/${known}.webp`
      : "images/board/move_learn_ui/move_type_icons/status.webp";
  }

  function tuningPayloadText() {
    return JSON.stringify({
      layout: currentLayout,
      portraits: currentPortraitLayout,
      ui: currentUiTuning,
    }, null, 2);
  }

  function refreshTuningPanel() {
    if (!tuningPanel) return;
    const selected = currentLayout[selectedLayoutId] || currentLayout.playerCard;
    tuningPanel.querySelector("[data-tune-select]").value = selectedLayoutId;
    ["x", "y", "w", "h"].forEach((key) => {
      tuningPanel.querySelector(`[data-tune-layout="${key}"]`).value = selected[key];
    });
    ["player", "enemy"].forEach((side) => {
      const item = currentPortraitLayout[side];
      tuningPanel.querySelector(`[data-tune-portrait="${side}-x"]`).value = item.x;
      tuningPanel.querySelector(`[data-tune-portrait="${side}-y"]`).value = item.y;
      tuningPanel.querySelector(`[data-tune-portrait="${side}-scale"]`).value = item.scale;
    });
    UI_TUNING_FIELDS.forEach(([key]) => {
      const input = tuningPanel.querySelector(`[data-tune-ui="${key}"]`);
      if (input) input.value = currentUiTuning[key] ?? DEFAULT_UI_TUNING[key];
    });
    tuningPanel.querySelector("[data-tune-output]").value = tuningPayloadText();
    document.querySelectorAll("[data-layout-id]").forEach((element) => {
      element.classList.toggle("is-selected", element.dataset.layoutId === selectedLayoutId);
    });
  }

  function updateSelectedLayout(key, value) {
    const item = currentLayout[selectedLayoutId];
    if (!item) return;
    item[key] = Number(value);
    writeTuningDraft();
    applyLayout();
    refreshTuningPanel();
  }

  function updatePortrait(side, key, value) {
    const item = currentPortraitLayout[side];
    if (!item) return;
    item[key] = Number(value);
    writeTuningDraft();
    applyPortraitLayout();
    refreshTuningPanel();
  }

  function updateUiTuning(key, value) {
    if (!(key in DEFAULT_UI_TUNING)) return;
    currentUiTuning[key] = Number(value);
    writeTuningDraft();
    applyUiTuning();
    refreshTuningPanel();
  }

  function createTuningPanel() {
    if (tuningPanel) return tuningPanel;
    tuningPanel = document.createElement("aside");
    tuningPanel.className = "tuning-panel";
    tuningPanel.innerHTML = `
      <h2>戰鬥頁微調</h2>
      <div class="tuning-help">按 Ctrl+E 開關。先選框調 x/y/w/h；角色圖用 X/Y/Scale 調整；下方可以改字體、內距、間距和按鈕大小。調好按「複製 JSON」貼給我，我再幫你固定進預設值。</div>
      <label>外框
        <select data-tune-select>
          ${Object.keys(DEFAULT_LAYOUT).map((key) => `<option value="${key}">${key}</option>`).join("")}
        </select>
      </label>
      <div class="tuning-grid">
        ${["x", "y", "w", "h"].map((key) => `
          <label>${key.toUpperCase()} %
            <input type="number" step="0.1" data-tune-layout="${key}">
          </label>
        `).join("")}
      </div>
      <h2>我方圖片</h2>
      <div class="tuning-grid">
        <label>X %<input type="number" step="0.5" data-tune-portrait="player-x"></label>
        <label>Y %<input type="number" step="0.5" data-tune-portrait="player-y"></label>
        <label>Scale<input type="number" step="0.01" min="0.1" data-tune-portrait="player-scale"></label>
      </div>
      <h2>敵方圖片</h2>
      <div class="tuning-grid">
        <label>X %<input type="number" step="0.5" data-tune-portrait="enemy-x"></label>
        <label>Y %<input type="number" step="0.5" data-tune-portrait="enemy-y"></label>
        <label>Scale<input type="number" step="0.01" min="0.1" data-tune-portrait="enemy-scale"></label>
      </div>
      <h2>UI 大小 / 字體</h2>
      <div class="tuning-grid">
        ${UI_TUNING_FIELDS.map(([key, label, unit, min, max, step]) => `
          <label>${label}${unit ? ` (${unit})` : ""}
            <input type="number" min="${min}" max="${max}" step="${step}" data-tune-ui="${key}">
          </label>
        `).join("")}
      </div>
      <button type="button" data-tune-copy>複製 JSON</button>
      <button type="button" data-tune-reset>重置暫存</button>
      <textarea data-tune-output readonly></textarea>
    `;
    document.body.appendChild(tuningPanel);
    tuningPanel.querySelector("[data-tune-select]").addEventListener("change", (event) => {
      selectedLayoutId = event.target.value;
      refreshTuningPanel();
    });
    tuningPanel.querySelectorAll("[data-tune-layout]").forEach((input) => {
      input.addEventListener("input", () => updateSelectedLayout(input.dataset.tuneLayout, input.value));
    });
    tuningPanel.querySelectorAll("[data-tune-portrait]").forEach((input) => {
      input.addEventListener("input", () => {
        const [side, key] = input.dataset.tunePortrait.split("-");
        updatePortrait(side, key, input.value);
      });
    });
    tuningPanel.querySelectorAll("[data-tune-ui]").forEach((input) => {
      input.addEventListener("input", () => updateUiTuning(input.dataset.tuneUi, input.value));
    });
    tuningPanel.querySelector("[data-tune-copy]").addEventListener("click", async () => {
      const text = tuningPayloadText();
      tuningPanel.querySelector("[data-tune-output]").value = text;
      try {
        await navigator.clipboard.writeText(text);
        showStatus("已複製戰鬥頁 UI JSON。");
      } catch (_error) {
        showStatus("無法自動複製，請手動選取下方 JSON。");
      }
    });
    tuningPanel.querySelector("[data-tune-reset]").addEventListener("click", () => {
      localStorage.removeItem(BATTLE_LAYOUT_DRAFT_KEY);
      currentLayout = clone(DEFAULT_LAYOUT);
      currentPortraitLayout = clone(DEFAULT_PORTRAIT_LAYOUT);
      currentUiTuning = clone(DEFAULT_UI_TUNING);
      applyLayout();
      refreshTuningPanel();
    });
    document.querySelectorAll("[data-layout-id]").forEach((element) => {
      element.addEventListener("click", (event) => {
        if (!refs.stage.classList.contains("editing")) return;
        event.preventDefault();
        event.stopPropagation();
        selectedLayoutId = element.dataset.layoutId;
        refreshTuningPanel();
      });
    });
    refreshTuningPanel();
    return tuningPanel;
  }

  function toggleTuningPanel() {
    const panel = createTuningPanel();
    const open = !panel.classList.contains("open");
    panel.classList.toggle("open", open);
    refs.stage.classList.toggle("editing", open);
    refreshTuningPanel();
  }

  function controller() {
    try {
      if (window.opener?.__BOARD_GAME_DEBUG__) return window.opener.__BOARD_GAME_DEBUG__;
      if (window.parent && window.parent !== window && window.parent.__BOARD_GAME_DEBUG__) {
        return window.parent.__BOARD_GAME_DEBUG__;
      }
      return null;
    } catch (_error) {
      return null;
    }
  }

  function readSnapshotView() {
    try {
      const raw = localStorage.getItem(BATTLE_SNAPSHOT_KEY);
      if (!raw) return null;
      return JSON.parse(raw)?.view || null;
    } catch (_error) {
      return null;
    }
  }

  function sendBattleCommand(type, payload = {}) {
    const command = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      payload,
      createdAt: Date.now(),
    };
    try {
      const targetOrigin = window.location.protocol === "file:" ? "*" : window.location.origin;
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "board-battle-command", command }, targetOrigin);
      }
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: "board-battle-command", command }, targetOrigin);
      }
    } catch (_error) {
      // localStorage below is the fallback path.
    }
    try {
      localStorage.setItem(BATTLE_COMMAND_KEY, JSON.stringify(command));
    } catch (_error) {
      showStatus("無法送出戰鬥指令，請回主遊戲確認瀏覽器權限。");
    }
  }

  function viewerCanControlBattle(view = latestView) {
    return !!view?.battle?.canControl;
  }

  function viewerBattleLockMessage(view = latestView) {
    return view?.battle?.viewerLockedReason || `現在是 ${view?.player?.name || "目前玩家"} 的戰鬥，請觀看對方操作。`;
  }

  function canSendBattleCommand(view = latestView) {
    return !!view?.battle && viewerCanControlBattle(view);
  }

  function callBattleAction(methodName, commandType, payload = {}) {
    if (!canSendBattleCommand(latestView)) {
      showStatus(viewerBattleLockMessage(latestView));
      return false;
    }
    const api = controller();
    if (api?.[methodName]) {
      const result = api[methodName](...Object.values(payload));
      if (result !== false) {
        window.requestAnimationFrame(() => refresh());
        window.setTimeout(() => refresh(), 80);
      }
      return result;
    }
    sendBattleCommand(commandType, payload);
    return true;
  }

  function prebattleIntroCompletedLocally(view) {
    const intro = view?.battle?.prebattleIntro;
    const introId = String(intro?.id || "").trim();
    const introKey = prebattleIntroRuntimeKey(view);
    return Boolean(
      (introId && completedPrebattleIntroIds.has(introId))
      || (introKey && completedPrebattleIntroKeys.has(introKey))
    );
  }

  function acknowledgeLocallyCompletedPrebattleIntro(view) {
    const intro = view?.battle?.prebattleIntro;
    if (!intro || intro.done || !prebattleIntroCompletedLocally(view) || !viewerCanControlBattle(view)) return false;
    const introId = String(intro.id || "").trim();
    const introKey = prebattleIntroRuntimeKey(view);
    const ackKey = `${introId}|${introKey}`;
    const now = Date.now();
    if (ackKey === lastCompletedPrebattleIntroAckKey && now - lastCompletedPrebattleIntroAckAt < 1200) return false;
    lastCompletedPrebattleIntroAckKey = ackKey;
    lastCompletedPrebattleIntroAckAt = now;
    return callBattleAction("battleMarkPrebattleIntroDone", "intro-done", { introId, introKey }) !== false;
  }

  function prebattleIntroPending(view) {
    const intro = view?.battle?.prebattleIntro;
    return !!intro && !intro.done && !prebattleIntroCompletedLocally(view) && !view?.battle?.result;
  }

  function clearPrebattleIntroTimers() {
    prebattleIntroTimers.forEach((timer) => clearTimeout(timer));
    prebattleIntroTimers = [];
  }

  function schedulePrebattleIntro(callback, delay) {
    const timer = setTimeout(callback, delay);
    prebattleIntroTimers.push(timer);
    return timer;
  }

  function ensurePrebattleIntroLayer() {
    let layer = document.getElementById("prebattleDialogue");
    if (layer) return layer;
    layer = document.createElement("section");
    layer.id = "prebattleDialogue";
    layer.className = "prebattle-dialogue";
    layer.setAttribute("aria-live", "polite");
    layer.innerHTML = `
      <div class="enma-trial-cinematic" data-enma-trial-cinematic aria-label="閻魔試煉">
        <img class="enma-trial-frame" data-enma-trial-frame="a" alt="">
        <img class="enma-trial-frame" data-enma-trial-frame="b" alt="">
        <div class="enma-trial-shade" aria-hidden="true"></div>
        <div class="enma-trial-flash" aria-hidden="true"></div>
        <article class="prebattle-quote player enma-trial-dialogue" data-enma-trial-dialogue hidden>
          <img class="prebattle-quote-frame" src="images/board/battle_hud_dialogue_ui/battle_dialogue_player_frame.webp?v=20260724-battle-hud-dialogue-ui-v2" alt="" aria-hidden="true">
          <div class="prebattle-speaker" data-enma-trial-speaker></div>
          <div class="prebattle-text" data-enma-trial-text></div>
        </article>
        <div class="enma-trial-progress" data-enma-trial-progress aria-hidden="true"></div>
      </div>
      <article class="prebattle-quote player">
        <img class="prebattle-quote-frame" src="images/board/battle_hud_dialogue_ui/battle_dialogue_player_frame.webp?v=20260724-battle-hud-dialogue-ui-v2" alt="" aria-hidden="true">
        <div class="prebattle-speaker" data-prebattle-hero-name></div>
        <div class="prebattle-text" data-prebattle-hero-text></div>
      </article>
      <div class="prebattle-vs">VS</div>
      <article class="prebattle-quote enemy">
        <img class="prebattle-quote-frame" src="images/board/battle_hud_dialogue_ui/battle_dialogue_enemy_frame.webp?v=20260724-battle-hud-dialogue-ui-v2" alt="" aria-hidden="true">
        <div class="prebattle-speaker" data-prebattle-enemy-name></div>
        <div class="prebattle-text" data-prebattle-enemy-text></div>
      </article>
      <div class="prebattle-kicker">
        <img class="prebattle-kicker-frame" src="images/board/battle_hud_dialogue_ui/battle_dialogue_start_frame.webp?v=20260724-battle-hud-dialogue-ui-v2" alt="" aria-hidden="true">
        <span class="prebattle-kicker-text">戰鬥開始</span>
      </div>
    `;
    refs.stage?.appendChild(layer);
    return layer;
  }

  function setPrebattlePortraits(active) {
    ["player", "enemy"].forEach((side) => {
      clearTimeout(portraitTimers[side]);
      setPortraitState(side, active ? "attack" : "normal");
      if (active) restartPortraitMotion(side, "attack");
    });
  }

  function resetEnmaTrialLayer(layer = document.getElementById("prebattleDialogue")) {
    refs.stage?.classList.remove("enma-trial-cinematic-active");
    if (!layer) return;
    delete layer.dataset.enmaState;
    delete layer.dataset.enmaFrameIndex;
    delete layer.dataset.enmaFrameSrc;
    layer.querySelectorAll("[data-enma-trial-frame]").forEach((image) => image.classList.remove("is-active"));
    const dialogue = layer.querySelector("[data-enma-trial-dialogue]");
    if (dialogue) dialogue.hidden = true;
    const progress = layer.querySelector("[data-enma-trial-progress]");
    if (progress) progress.replaceChildren();
  }

  function preloadEnmaTrialFrames(frames) {
    frames.forEach((frame) => {
      const src = String(frame?.src || "").trim();
      if (!src) return;
      const image = new Image();
      image.src = src;
    });
  }

  function showEnmaTrialFrame(layer, frame, index, count) {
    const images = [...layer.querySelectorAll("[data-enma-trial-frame]")];
    if (!images.length) return;
    const nextSlot = Number(layer.dataset.enmaFrameIndex || -1) % 2 === 0 ? 1 : 0;
    const nextImage = images[nextSlot] || images[0];
    const previousImage = images.find((image) => image.classList.contains("is-active"));
    nextImage.src = String(frame?.src || "");
    nextImage.alt = `${frame?.speaker || "新世界索隆"}・閻魔試煉第 ${index + 1} 幕`;
    nextImage.classList.remove("is-active");
    void nextImage.offsetWidth;
    if (previousImage && previousImage !== nextImage) previousImage.classList.remove("is-active");
    nextImage.classList.add("is-active");
    layer.dataset.enmaState = String(frame?.state || "scene");
    layer.dataset.enmaFrameIndex = String(index);
    layer.dataset.enmaFrameSrc = String(frame?.src || "");

    const dialogue = layer.querySelector("[data-enma-trial-dialogue]");
    const speaker = layer.querySelector("[data-enma-trial-speaker]");
    const text = layer.querySelector("[data-enma-trial-text]");
    const line = String(frame?.text || "").trim();
    if (speaker) speaker.textContent = String(frame?.speaker || "新世界索隆");
    if (text) text.textContent = line;
    if (dialogue) {
      dialogue.hidden = !line;
      if (line) {
        dialogue.style.animation = "none";
        void dialogue.offsetWidth;
        dialogue.style.animation = "";
      }
    }

    const progress = layer.querySelector("[data-enma-trial-progress]");
    if (progress) {
      progress.replaceChildren(...Array.from({ length: count }, (_entry, dotIndex) => {
        const dot = document.createElement("span");
        dot.className = `enma-trial-progress-dot${dotIndex === index ? " is-active" : ""}`;
        return dot;
      }));
    }
  }

  function playEnmaTrialPrebattleIntro(view, intro, introKey) {
    const frames = Array.isArray(intro?.cinematic?.frames)
      ? intro.cinematic.frames.filter((frame) => String(frame?.src || "").trim())
      : [];
    if (!frames.length) return false;
    clearPrebattleIntroTimers();
    prebattleIntroActive = true;
    activePrebattleIntroId = intro.id || "";
    activePrebattleIntroKey = introKey;
    setPrebattlePortraits(false);
    const layer = ensurePrebattleIntroLayer();
    resetEnmaTrialLayer(layer);
    refs.stage?.classList.add("enma-trial-cinematic-active");
    preloadEnmaTrialFrames(frames);
    layer.className = "prebattle-dialogue is-open enma-trial phase-wait";
    const initialDelay = Math.max(1000, Number(intro.showAfter || 0) - Date.now());
    let elapsed = initialDelay;
    frames.forEach((frame, index) => {
      schedulePrebattleIntro(() => showEnmaTrialFrame(layer, frame, index, frames.length), elapsed);
      elapsed += Math.max(650, Math.min(5000, Number(frame.durationMs || 1200)));
    });
    schedulePrebattleIntro(() => finishPrebattleIntro(intro.id, introKey), elapsed);
    return true;
  }

  function finishPrebattleIntro(introId, introKey = "") {
    const layer = ensurePrebattleIntroLayer();
    layer.classList.add("is-closing");
    schedulePrebattleIntro(() => {
      layer.className = "prebattle-dialogue";
      resetEnmaTrialLayer(layer);
      prebattleIntroActive = false;
      activePrebattleIntroId = "";
      activePrebattleIntroKey = "";
      setPrebattlePortraits(false);
      rememberCompletedPrebattleIntro(introId, latestView, introKey);
      const latestKey = prebattleIntroRuntimeKey(latestView);
      if (latestView?.battle?.prebattleIntro && (latestView.battle.prebattleIntro.id === introId || (introKey && latestKey === introKey))) {
        latestView.battle.prebattleIntro.done = true;
      }
      renderPanel(latestView);
      callBattleAction("battleMarkPrebattleIntroDone", "intro-done", { introId, introKey });
    }, 320);
  }

  function playPrebattleIntro(view) {
    const intro = view?.battle?.prebattleIntro;
    if (!intro || intro.done) return;
    const introKey = prebattleIntroRuntimeKey(view);
    if (prebattleIntroActive && (activePrebattleIntroId === intro.id || (introKey && activePrebattleIntroKey === introKey))) {
      if (!activePrebattleIntroId && intro.id) activePrebattleIntroId = intro.id;
      if (!activePrebattleIntroKey && introKey) activePrebattleIntroKey = introKey;
      return;
    }
    if (intro?.cinematic?.kind === "enma_trial" && playEnmaTrialPrebattleIntro(view, intro, introKey)) return;
    clearPrebattleIntroTimers();
    prebattleIntroActive = true;
    activePrebattleIntroId = intro.id || "";
    activePrebattleIntroKey = introKey;
    setPrebattlePortraits(true);
    const layer = ensurePrebattleIntroLayer();
    layer.querySelector("[data-prebattle-hero-name]").textContent = intro.heroName || view?.activeCard?.name || "夥伴";
    layer.querySelector("[data-prebattle-hero-text]").textContent = intro.heroText || "上吧。";
    layer.querySelector("[data-prebattle-enemy-name]").textContent = intro.enemyName || view?.enemy?.name || "敵人";
    layer.querySelector("[data-prebattle-enemy-text]").textContent = intro.enemyText || "放馬過來。";
    const initialDelay = Math.max(1000, Number(intro.showAfter || 0) - Date.now());
    layer.className = "prebattle-dialogue is-open phase-wait";
    const firstPhase = intro.firstSpeaker === "enemy" ? "enemy" : "hero";
    const secondPhase = firstPhase === "enemy" ? "hero" : "enemy";
    schedulePrebattleIntro(() => { layer.className = `prebattle-dialogue is-open phase-${firstPhase}`; }, initialDelay);
    schedulePrebattleIntro(() => { layer.className = `prebattle-dialogue is-open phase-${secondPhase}`; }, initialDelay + 3000);
    schedulePrebattleIntro(() => finishPrebattleIntro(intro.id, introKey), initialDelay + 6000);
  }

  function syncPrebattleIntro(view) {
    const intro = view?.battle?.prebattleIntro;
    const introKey = prebattleIntroRuntimeKey(view);
    if (intro?.done) rememberCompletedPrebattleIntro(intro.id, view, introKey);
    else acknowledgeLocallyCompletedPrebattleIntro(view);
    if (prebattleIntroActive && activePrebattleIntroKey && introKey === activePrebattleIntroKey && !intro?.done && !view?.battle?.result) return;
    if (prebattleIntroPending(view)) {
      playPrebattleIntro(view);
      return;
    }
    if (prebattleIntroActive && activePrebattleIntroId && intro?.id === activePrebattleIntroId && !intro?.done && !view?.battle?.result) return;
    if (!prebattleIntroActive) return;
    clearPrebattleIntroTimers();
    const layer = ensurePrebattleIntroLayer();
    layer.className = "prebattle-dialogue";
    resetEnmaTrialLayer(layer);
    prebattleIntroActive = false;
    activePrebattleIntroId = "";
    activePrebattleIntroKey = "";
    setPrebattlePortraits(false);
  }

  function clearPhase2DialogueTimers() {
    phase2DialogueTimers.forEach((timer) => clearTimeout(timer));
    phase2DialogueTimers = [];
  }

  function schedulePhase2Dialogue(callback, delay) {
    const timer = setTimeout(callback, delay);
    phase2DialogueTimers.push(timer);
    return timer;
  }

  function ensurePhase2DialogueLayer() {
    let layer = document.getElementById("phase2Dialogue");
    if (layer) return layer;
    layer = document.createElement("section");
    layer.id = "phase2Dialogue";
    layer.className = "prebattle-dialogue phase2-dialogue";
    layer.setAttribute("aria-live", "polite");
    layer.innerHTML = `
      <button type="button" class="prebattle-skip-btn" data-phase2-skip>跳過</button>
      <article class="prebattle-quote enemy">
        <img class="prebattle-quote-frame" src="images/board/battle_hud_dialogue_ui/battle_dialogue_enemy_frame.webp?v=20260724-battle-hud-dialogue-ui-v2" alt="" aria-hidden="true">
        <div class="prebattle-speaker" data-phase2-speaker></div>
        <div class="prebattle-text" data-phase2-line></div>
      </article>
    `;
    layer.querySelector("[data-phase2-skip]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      clearPhase2DialogueTimers();
      clearTimeout(portraitTimers.enemy);
      setPortraitState("enemy", "normal");
      layer.className = "prebattle-dialogue phase2-dialogue";
      phase2DialogueActive = false;
      renderPanel(latestView);
    });
    refs.stage?.appendChild(layer);
    return layer;
  }

  function playPhase2DialogueFx(event = {}, view = latestView) {
    clearPhase2DialogueTimers();
    const duration = Math.max(1800, Number(event.duration || 3000));
    const layer = ensurePhase2DialogueLayer();
    layer.querySelector("[data-phase2-speaker]").textContent = event.speaker || view?.enemy?.name || "敵人";
    layer.querySelector("[data-phase2-line]").textContent = event.line || "接下來才是真正的戰鬥。";
    layer.className = "prebattle-dialogue phase2-dialogue is-open phase-enemy";
    phase2DialogueActive = true;
    clearInactiveActionPose("enemy");
    playPortraitAction("enemy", "angry", duration);
    playCutIn(event.title || "第二階段");
    schedulePhase2Dialogue(() => {
      layer.classList.add("is-closing");
    }, Math.max(900, duration - 360));
    schedulePhase2Dialogue(() => {
      layer.className = "prebattle-dialogue phase2-dialogue";
      phase2DialogueActive = false;
      renderPanel(latestView);
    }, duration);
  }

  function hpPercent(current, max) {
    return `${clamp((Number(current) / Math.max(1, Number(max))) * 100, 0, 100)}%`;
  }

  function phaseHpBarsForDisplay(view, enemy) {
    const phaseBars = view?.enemy?.phaseHpBars;
    if (!phaseBars) return null;
    const activePhase = Number(phaseBars.activePhase || 1);
    const totalMaxHp = Math.max(1, Number(phaseBars.totalMaxHp || enemy?.maxHp || 1));
    const breakHp = Math.max(1, Number(phaseBars.breakHp || Math.floor(totalMaxHp / 2) || 1));
    const topLayerMaxHp = Math.max(1, totalMaxHp - breakHp);
    const finalLayerMaxHp = Math.max(1, breakHp);
    const totalCurrentHp = clamp(Number(enemy?.currentHp ?? phaseBars.totalCurrentHp ?? 0), 0, totalMaxHp);
    const layerMaxHp = activePhase === 2 ? finalLayerMaxHp : topLayerMaxHp;
    const layerCurrentHp = activePhase === 2
      ? clamp(totalCurrentHp, 0, finalLayerMaxHp)
      : clamp(totalCurrentHp - breakHp, 0, topLayerMaxHp);
    return {
      ...phaseBars,
      activePhase,
      label: activePhase === 2 ? "最後一條" : "上層血條",
      badge: phaseBars.badge || (activePhase === 2 ? "" : "X2"),
      totalCurrentHp,
      totalMaxHp,
      breakHp,
      layerCurrentHp,
      layerMaxHp,
      layerPercent: clamp((layerCurrentHp / Math.max(1, layerMaxHp)) * 100, 0, 100),
    };
  }

  function combatantHpTextForDisplay(combatant, phaseBars = null) {
    if (phaseBars) {
      return `${Math.max(0, Math.round(Number(phaseBars.layerCurrentHp || 0)))}/${Math.max(1, Math.round(Number(phaseBars.layerMaxHp || 1)))}`;
    }
    return `${Math.max(0, Math.round(Number(combatant?.currentHp || 0)))}/${Math.max(1, Math.round(Number(combatant?.maxHp || 1)))}`;
  }

  function renderEnemyPhaseHpBars(view, enemy) {
    const phaseBars = phaseHpBarsForDisplay(view, enemy);
    if (!refs.enemyPhaseHpBars || !refs.enemyHpTrack) {
      if (refs.enemyHpFill) refs.enemyHpFill.style.width = hpPercent(enemy?.currentHp ?? 1, enemy?.maxHp ?? 1);
      return;
    }
    if (!phaseBars) {
      refs.enemyHpTrack.hidden = false;
      refs.enemyPhaseHpBars.hidden = true;
      refs.enemyPhaseHpBars.innerHTML = "";
      delete refs.enemyHpTrack.dataset.layerBadge;
      refs.enemyHpTrack.classList.remove("yonko-layered", "yonko-phase-1", "yonko-phase-2", "has-layer-badge");
      if (refs.enemyHpFill) refs.enemyHpFill.style.width = hpPercent(enemy?.currentHp ?? 1, enemy?.maxHp ?? 1);
      return;
    }
    refs.enemyHpTrack.hidden = false;
    refs.enemyPhaseHpBars.hidden = true;
    refs.enemyPhaseHpBars.innerHTML = "";
    delete refs.enemyHpTrack.dataset.layerBadge;
    refs.enemyHpTrack.classList.add("yonko-layered");
    refs.enemyHpTrack.classList.toggle("yonko-phase-1", Number(phaseBars.activePhase || 1) === 1);
    refs.enemyHpTrack.classList.toggle("yonko-phase-2", Number(phaseBars.activePhase || 1) === 2);
    refs.enemyHpTrack.classList.toggle("has-layer-badge", !!phaseBars.badge);
    if (phaseBars.badge) refs.enemyHpTrack.dataset.layerBadge = phaseBars.badge;
    if (refs.enemyHpFill) refs.enemyHpFill.style.width = `${clamp(Number(phaseBars.layerPercent || 0), 0, 100)}%`;
  }

  function battleBackgroundLookupKey(value) {
    return String(value || "").trim().toLowerCase();
  }

  function battleBackgroundForEnemy(enemy) {
    const key = battleBackgroundLookupKey(enemy?.key || enemy?.id);
    const name = battleBackgroundLookupKey(enemy?.name);
    return BATTLE_BACKGROUND_BY_ENEMY_KEY[key]
      || BATTLE_BACKGROUND_BY_ENEMY_NAME[name]
      || DEFAULT_BATTLE_BACKGROUND;
  }

  function applyBattleBackground(view) {
    if (!refs.stage) return;
    const url = battleBackgroundForEnemy(view?.enemy);
    if (refs.stage.dataset.battleBgUrl === url) return;
    refs.stage.dataset.battleBgUrl = url;
    refs.stage.style.setProperty("--battle-bg-url", `url("${url}")`);
  }

  function attackHitDamages(event = {}) {
    if (Array.isArray(event.hitDamages) && event.hitDamages.length) {
      return event.hitDamages.map((damage) => Math.max(0, Math.round(Number(damage || 0))));
    }
    return [Math.max(0, Math.round(Number(event.damage || 0)))];
  }

  function attackTargetSide(event = {}) {
    const explicit = String(event.targetSide || "").trim();
    if (explicit === "player" || explicit === "enemy") return explicit;
    return event.side === "enemy" ? "player" : "enemy";
  }

  function attackDamageTotal(event = {}) {
    return attackHitDamages(event).reduce((sum, damage) => sum + damage, 0);
  }

  function eventCriticalAtHit(event = {}, hitIndex = 0) {
    if (Array.isArray(event.criticalHitIndexes)) {
      return event.criticalHitIndexes.map((index) => Number(index)).includes(Number(hitIndex));
    }
    return !!event.critical;
  }

  function isAttackLikeMoveType(moveType = "") {
    return ["attack", "special", "combo", "battle"].includes(String(moveType || "").toLowerCase());
  }

  function visualEventCombatantForSide(event = {}, side = "") {
    if (!event) return null;
    if (event.type === "switch") {
      const switchSide = event.side === "enemy" ? "enemy" : "player";
      if (side !== switchSide) return null;
      const source = event.actorCombatant || event.toCombatant || event.finalSnapshot?.[side];
      return source && typeof source === "object" && !Array.isArray(source) ? source : null;
    }
    if (event.finalSnapshot?.[side]) {
      const source = event.finalSnapshot[side];
      return source && typeof source === "object" && !Array.isArray(source) ? source : null;
    }
    if (event.type !== "attack") return null;
    const targetSide = attackTargetSide(event);
    const actorSide = event.side === "enemy" ? "enemy" : event.side === "player" ? "player" : "";
    let source = null;
    if (side === targetSide) {
      source = event.targetCombatant || event.targetSnapshot || event.target;
    } else if (side === actorSide) {
      source = event.actorCombatant || event.actorSnapshot || event.actor;
    }
    return source && typeof source === "object" && !Array.isArray(source) ? source : null;
  }

  function ensureVisualHpOverride(view) {
    const event = view?.battle?.visualEvent;
    if (!event || event.type !== "attack" || event.miss || completedImpactEventId === event.id) {
      return null;
    }
    if (visualHpOverride?.eventId === event.id) return visualHpOverride;
    const active = view?.activeCard || {};
    const enemy = view?.enemy || {};
    const eventActive = visualEventCombatantForSide(event, "player") || {};
    const eventEnemy = visualEventCombatantForSide(event, "enemy") || {};
    const activeVisual = { ...active, ...eventActive };
    const enemyVisual = { ...enemy, ...eventEnemy };
    const targetSide = attackTargetSide(event);
    const totalDamage = attackDamageTotal(event);
    visualHpOverride = {
      eventId: event.id,
      targetSide,
      playerHp: Number(event.startHp?.player ?? activeVisual.currentHp ?? 0),
      enemyHp: Number(event.startHp?.enemy ?? enemyVisual.currentHp ?? 0),
      finalPlayerHp: Number(activeVisual.currentHp || 0),
      finalEnemyHp: Number(enemyVisual.currentHp || 0),
      playerMaxHp: Math.max(1, Number(activeVisual.maxHp || 1)),
      enemyMaxHp: Math.max(1, Number(enemyVisual.maxHp || 1)),
    };
    if (Number.isFinite(Number(event.finalHp?.player))) {
      visualHpOverride.finalPlayerHp = Math.max(0, Number(event.finalHp.player));
    }
    if (Number.isFinite(Number(event.finalHp?.enemy))) {
      visualHpOverride.finalEnemyHp = Math.max(0, Number(event.finalHp.enemy));
    }
    if (targetSide === "player" && !event.startHp) {
      visualHpOverride.playerHp = Math.min(visualHpOverride.playerMaxHp, visualHpOverride.finalPlayerHp + totalDamage);
    } else if (targetSide === "enemy" && !event.startHp) {
      visualHpOverride.enemyHp = Math.min(visualHpOverride.enemyMaxHp, visualHpOverride.finalEnemyHp + totalDamage);
    }
    return visualHpOverride;
  }

  function currentVisualHpOverride() {
    const event = latestView?.battle?.visualEvent;
    if (!event || visualHpOverride?.eventId !== event.id || completedImpactEventId === event.id) return null;
    return visualHpOverride;
  }

  function cloneStatusCombatant(combatant = {}) {
    if (!combatant) return null;
    return JSON.parse(JSON.stringify({
      statuses: combatant.statuses || {},
      effectDetails: Array.isArray(combatant.effectDetails) ? combatant.effectDetails : [],
      effectDice: combatant.effectDice || 0,
    }));
  }

  function sideCombatantFromView(view, side) {
    if (!view) return null;
    return side === "player" ? view.activeCard : side === "enemy" ? view.enemy : null;
  }

  function statusIconDelayKind(event = {}) {
    if (event.type === "passive-opening") return openingPassiveEffectKind(event);
    if (!event.effectFx) return "";
    return effectKind(event.effectFx);
  }

  function statusIconDelayTargets(event = {}) {
    if (!event) return [];
    const kind = statusIconDelayKind(event);
    if (!["attack", "defense", "shield", "speed", "debuff"].includes(kind)) return [];
    const side = eventActorSide(event);
    const moveType = String(event.moveType || "").toLowerCase();
    const effectTarget = event.effectFx?.targetSide;
    const explicitTarget = event.targetSide === "player" || event.targetSide === "enemy" ? event.targetSide : "";
    let targetSide = effectTarget === "player" || effectTarget === "enemy" ? effectTarget : explicitTarget;
    if (!targetSide) {
      if (event.type === "passive-opening") targetSide = moveType === "debuff" || moveType === "control" ? oppositeSide(side) : side;
      else if (moveType === "debuff" || moveType === "control") targetSide = oppositeSide(side);
      else targetSide = side;
    }
    return targetSide === "player" || targetSide === "enemy" ? [targetSide] : [];
  }

  function releaseStatusIconDelay(side, eventId = "") {
    const lock = statusIconDelays[side];
    if (!lock || (eventId && lock.eventId !== eventId)) return;
    lock.released = true;
    clearTimeout(lock.timer);
    lock.timer = null;
    renderHud(latestView);
  }

  function clearStatusIconDelays() {
    ["player", "enemy"].forEach((side) => {
      clearTimeout(statusIconDelays[side]?.timer);
      statusIconDelays[side] = null;
      lastRenderedStatusCombatants[side] = null;
    });
  }

  function statusIconFallbackDelay(event = {}) {
    if (event.type === "attack") return Math.max(900, Number(event.duration || 1850) - 420);
    if (event.type === "passive-opening") return 940;
    return 720;
  }

  function prepareStatusIconDelays(view) {
    const event = view?.battle?.visualEvent || null;
    const eventId = event?.id || "";
    if (!eventId) {
      ["player", "enemy"].forEach((side) => {
        if (statusIconDelays[side] && !statusIconDelays[side].released) releaseStatusIconDelay(side, statusIconDelays[side].eventId);
        if (statusIconDelays[side]?.released) {
          clearTimeout(statusIconDelays[side].timer);
          statusIconDelays[side] = null;
        }
      });
      return;
    }
    const targets = statusIconDelayTargets(event);
    ["player", "enemy"].forEach((side) => {
      if (!targets.includes(side)) {
        if (statusIconDelays[side]?.eventId !== eventId) {
          clearTimeout(statusIconDelays[side]?.timer);
          statusIconDelays[side] = null;
        }
        return;
      }
      if (statusIconDelays[side]?.eventId === eventId) return;
      clearTimeout(statusIconDelays[side]?.timer);
      const startSnapshot = event.startSnapshot?.[side] || event.startCombatant;
      const snapshot = cloneStatusCombatant(startSnapshot || lastRenderedStatusCombatants[side] || sideCombatantFromView(view, side));
      statusIconDelays[side] = {
        eventId,
        released: false,
        snapshot,
        timer: setTimeout(() => releaseStatusIconDelay(side, eventId), statusIconFallbackDelay(event)),
      };
    });
  }

  function openingPassiveHoldTexts(view, side) {
    const battle = view?.battle;
    if (!battle?.openingPassiveVisualPending || battle?.visualEvent?.type === "passive-opening") return [];
    const queue = Array.isArray(battle.openingPassiveVisualQueue) ? battle.openingPassiveVisualQueue : [];
    return queue
      .filter((event) => (event.targetSide === "enemy" || event.targetSide === "player") && event.targetSide === side)
      .map((event) => event.effectText || "")
      .filter(Boolean);
  }

  function passiveEffectTokens(text = "") {
    return String(text || "")
      .split(/[，、,]/)
      .map((part) => part.replace(/^(敵方|我方|自身)/, "").replace(/\s+/g, "").trim())
      .filter(Boolean);
  }

  function filterOpeningPassiveHoldIcons(combatant = {}, holdTexts = []) {
    const tokens = holdTexts.flatMap(passiveEffectTokens);
    if (!tokens.length || !Array.isArray(combatant?.effectDetails)) return combatant;
    return {
      ...combatant,
      effectDetails: combatant.effectDetails.filter((detail) => {
        const hay = `${detail.label || ""}${detail.badge || ""}`.replace(/\s+/g, "");
        return !tokens.some((token) => hay.includes(token));
      }),
    };
  }

  function statusIconCombatantForRender(side, combatant = {}, view = latestView) {
    const lock = statusIconDelays[side];
    if (lock && !lock.released) return lock.snapshot || combatant;
    const holdTexts = openingPassiveHoldTexts(view, side);
    if (holdTexts.length) return filterOpeningPassiveHoldIcons(combatant, holdTexts);
    return combatant;
  }

  function rememberRenderedStatusCombatant(side, combatant = {}) {
    if (!["player", "enemy"].includes(side)) return;
    lastRenderedStatusCombatants[side] = cloneStatusCombatant(combatant);
  }

  function displayedCombatant(side, source = {}) {
    const event = latestView?.battle?.visualEvent;
    const eventCombatant = visualEventCombatantForSide(event, side);
    const base = eventCombatant ? { ...source, ...eventCombatant } : source;
    const override = currentVisualHpOverride();
    if (!override) return base;
    if (side === "player") return { ...base, currentHp: override.playerHp };
    if (side === "enemy") return { ...base, currentHp: override.enemyHp };
    return base;
  }

  function isNikaFrameCombatant(combatant = {}) {
    const tokens = [
      combatant.id,
      combatant.key,
      combatant.cardId,
      combatant.characterId,
      combatant.formId,
      combatant.formKey,
      combatant.evolutionId,
      combatant.evolutionKey,
      combatant.baseId,
      combatant.name,
      combatant.displayName,
      combatant.formName,
    ];
    if (combatant.form && typeof combatant.form === "object") {
      tokens.push(combatant.form.id, combatant.form.key, combatant.form.name, combatant.form.displayName);
    }
    if (combatant.evolution && typeof combatant.evolution === "object") {
      tokens.push(combatant.evolution.id, combatant.evolution.key, combatant.evolution.name, combatant.evolution.displayName);
    }
    const haystack = tokens
      .filter((token) => token != null && token !== "")
      .map((token) => String(token))
      .join("|")
      .replace(/\s+/g, "");
    return haystack.includes("luffy_gear_fifth") || haystack.includes("五檔") || haystack.includes("尼卡");
  }

  function normalizeCosmeticFrameId(value = "") {
    const raw = String(value || "").trim();
    if (raw === "nikaFrame" || COSMETIC_FRAME_CONFIGS[raw]) return raw;
    const key = raw.replace(/[\s_-]+/g, "").toLowerCase();
    if (!key) return "";
    return COSMETIC_FRAME_ALIAS[key] || "";
  }

  function syncNikaFrame(combatant = null) {
    const frameId = normalizeCosmeticFrameId(combatant?.cosmeticFrameId || combatant?.activeCosmeticFrameId || "");
    refs.playerCard?.classList.toggle("nika-frame-active", frameId === "nikaFrame" && isNikaFrameCombatant(combatant || {}));
  }

  function clearCosmeticFrame(card) {
    if (!card) return;
    card.querySelectorAll(".cosmetic-frame-layer").forEach((layer) => layer.remove());
    Array.from(card.classList)
      .filter((className) => className.startsWith("cosmetic-frame-"))
      .forEach((className) => card.classList.remove(className));
  }

  function applyCosmeticFrame(card, frameId) {
    if (!card) return;
    clearCosmeticFrame(card);
    if (!frameId || frameId === "nikaFrame") return;
    const frame = COSMETIC_FRAME_CONFIGS[frameId];
    if (!frame) return;
    const anchor = card.querySelector(".card-inner");
    Object.entries(frame.layers || {}).forEach(([layerId, layer]) => {
      if (!layer?.asset) return;
      const img = document.createElement("img");
      img.className = "cosmetic-frame-layer";
      img.dataset.frameId = frameId;
      img.dataset.layerId = layerId;
      img.src = layer.asset;
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      img.loading = "lazy";
      img.decoding = "async";
      img.style.left = `${Number(layer.x || 50)}%`;
      img.style.top = `${Number(layer.y || 50)}%`;
      img.style.width = `${Number(layer.w || 100)}%`;
      img.style.height = `${Number(layer.h || 100)}%`;
      img.style.opacity = String(layer.opacity ?? 1);
      img.style.zIndex = String(Number(layer.z || 1));
      img.style.mixBlendMode = layer.blend || "normal";
      img.style.setProperty("--cosmetic-strength", Number(layer.strength || 1));
      img.style.setProperty("--cosmetic-rotate", `${Number(layer.rotate || 0)}deg`);
      img.style.setProperty("--cosmetic-flip-x", layer.flipX ? -1 : 1);
      img.style.setProperty("--cosmetic-flip-y", layer.flipY ? -1 : 1);
      card.insertBefore(img, anchor || null);
    });
    card.classList.add("cosmetic-frame-active");
    card.classList.toggle("cosmetic-frame-hide-base", frame.showBaseFrame === false);
  }

  function syncCosmeticFrame(combatant = null) {
    const frameId = normalizeCosmeticFrameId(combatant?.cosmeticFrameId || combatant?.activeCosmeticFrameId || "");
    applyCosmeticFrame(refs.playerCard, frameId);
  }

  function syncEnemyCosmeticFrame(combatant = null) {
    const frameId = normalizeCosmeticFrameId(combatant?.cosmeticFrameId || combatant?.activeCosmeticFrameId || combatant?.enemyCosmeticFrameId || "");
    applyCosmeticFrame(refs.enemyCard, frameId);
  }

  function isBlackTurnDemonEnemy(combatant = {}) {
    const key = String(combatant.key || combatant.id || "").trim();
    const name = String(combatant.name || combatant.displayName || "").replace(/\s+/g, "");
    const role = String(combatant.role || "").replace(/\s+/g, "");
    return key === "final_imu"
      || key.startsWith("final_black_turn_")
      || name.includes("黑轉支配")
      || role.includes("空白王座支配者")
      || role.includes("被伊姆支配");
  }

  function isImuEnemy(combatant = {}) {
    const key = String(combatant.key || combatant.id || "").trim();
    const role = String(combatant.role || "").replace(/\s+/g, "");
    return key === "final_imu" || role.includes("空白王座支配者");
  }

  function syncBlackTurnDemonFrame(combatant = null) {
    const active = isBlackTurnDemonEnemy(combatant || {});
    const imuActive = active && isImuEnemy(combatant || {});
    refs.enemyCard?.classList.toggle("black-turn-demon-active", active);
    refs.enemyCard?.classList.toggle("black-turn-imu-active", imuActive);
    if (refs.enemyDemonName) {
      refs.enemyDemonName.textContent = active ? (combatant?.name || "黑轉支配") : "";
    }
  }

  function renderStatusIcons(container, combatant = {}, side = "") {
    if (!container) return;
    const diceFace = side === "player"
      ? Number(combatant?.effectDice || latestView?.battle?.playerDiceRoll || 0)
      : side === "enemy"
        ? Number(combatant?.effectDice || latestView?.battle?.enemyDiceRoll || 0)
        : 0;
    const details = Array.isArray(combatant?.effectDetails) ? combatant.effectDetails : [];
    const entries = details.length
      ? details
          .filter((detail) => detail?.iconUrl || STATUS_ICON_INFO[detail?.icon])
          .map((detail) => {
            const fallback = STATUS_ICON_INFO[detail.icon] || {};
            return {
              label: detail.label || fallback.label || detail.icon || "效果",
              title: simpleEffectTitle(detail.label || fallback.label || detail.icon || "效果", detail.icon),
              turns: Number(detail.turns || 0),
              badge: detail.badge || "",
              durationText: detail.durationText || "",
              icon: detail.icon || "",
              iconUrl: detail.iconUrl || `images/board/battle/status_icons/${fallback.file}`,
              type: detail.type || fallback.type || "",
              result: detail.label || fallback.label || detail.icon || "效果",
              description: simpleEffectDescription(detail, detail.icon),
            };
          })
      : Object.entries(combatant?.statuses || {})
          .filter(([key, turns]) => STATUS_ICON_INFO[key] && Number(turns || 0) > 0)
          .map(([key, turns]) => {
            const info = STATUS_ICON_INFO[key];
            return {
              label: info.label || key,
              title: info.label || key,
              turns: Number(turns || 0),
              badge: Number(turns || 0) > 0 ? String(Number(turns || 0)) : "",
              durationText: Number(turns || 0) > 0 ? `剩餘 ${Number(turns || 0)} 回合` : "",
              icon: key,
              iconUrl: `images/board/battle/status_icons/${info.file}`,
              type: info.type || "",
              result: `${info.label || key}${Number(turns || 0) > 0 ? ` ${Number(turns || 0)}回合` : ""}`,
              description: `${info.label || key}狀態。`,
            };
          });
    container.innerHTML = entries.map((entry) => {
      const badgeText = String(entry.badge || (entry.turns > 0 ? entry.turns : "") || "");
      const label = badgeText ? `${entry.label}${badgeText}` : entry.label;
      const badgeClass = String(badgeText).startsWith("-") || entry.type === "debuff" || entry.type === "control"
        ? "is-debuff"
        : String(badgeText).startsWith("+") || entry.type === "buff"
          ? "is-buff"
          : "";
      return `
        <button class="status-icon" type="button" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" data-effect-label="${escapeHtml(entry.title || entry.label)}" data-effect-result="${escapeHtml(entry.result || entry.label)}" data-effect-turns="${escapeHtml(entry.turns)}" data-effect-duration="${escapeHtml(entry.durationText || "")}" data-effect-dice="${escapeHtml(diceFace)}" data-effect-description="${escapeHtml(entry.description)}">
          <img src="${escapeHtml(entry.iconUrl)}" alt="" data-fallback-src="${escapeHtml(fallbackStatusIconData(entry.icon, entry.label))}">
          ${badgeText ? `<span class="status-icon-turns ${badgeClass}">${escapeHtml(badgeText)}</span>` : ""}
        </button>
      `;
    }).join("");
    container.querySelectorAll(".status-icon img").forEach((img) => {
      img.addEventListener("error", () => {
        const fallback = img.dataset.fallbackSrc;
        if (fallback && img.src !== fallback) img.src = fallback;
      }, { once: true });
    });
    container.querySelectorAll(".status-icon").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        showStatusPopover(button, {
          label: button.dataset.effectLabel,
          result: button.dataset.effectResult,
          turns: Number(button.dataset.effectTurns || 0),
          durationText: button.dataset.effectDuration || "",
          description: button.dataset.effectDescription,
        });
      });
    });
  }

  function postgameMechanicBadge(mechanic) {
    const state = mechanic?.state || {};
    switch (mechanic?.key) {
      case "postgame_shiki": return state.finalDuel ? "決" : `${(state.islands || []).filter((island) => island.destroyed).length}/3`;
      case "postgame_gild_tesoro": return String(Math.max(0, ...(state.crew || []).map((card) => Number(card.gold || 0))));
      case "postgame_zephyr": return state.detonated ? "爆" : state.dynaRockDisarmed ? "解" : String(state.countdown ?? 0);
      case "postgame_tot_musica": return String(state.movement ?? 1);
      case "postgame_douglas_bullet": return String((state.slots || []).filter((slot) => slot.itemId && !slot.destroyed).length);
      case "postgame_saga": return String(state.blood ?? 0);
      case "postgame_vinsmoke_judge": return String(state.clones ?? 0);
      case "postgame_rob_lucci_awakened": return String((state.powers || []).filter((power) => power.active).length);
      case "postgame_king": return state.flameOn ? "燃" : "熄";
      case "postgame_charlotte_katakuri": return state.forecastRolling ? "…" : String(state.forecastDie || state.defenseDie || 0);
      case "postgame_patrick_redfield": return `${state.lastDrainPercent || 0}%`;
      case "postgame_oars": return String(state.saltBags ?? 0);
      case "postgame_aramaki": return String(state.groves ?? 0);
      default: return "";
    }
  }

  function postgameBulletMiniSocketsHtml(mechanic) {
    if (mechanic?.key !== "postgame_douglas_bullet") return "";
    return `<span class="boss-mechanic-mini-sockets">${(mechanic.state?.slots || []).slice(0, 6).map((slot) => `
      <span class="boss-mechanic-mini-socket ${slot.destroyed ? "is-broken" : !slot.itemId ? "is-empty" : "is-active"}" title="${escapeHtml(`骰 ${slot.number}・${slot.label}：${slot.itemName || "未裝備"}${slot.destroyed ? "（已破壞）" : slot.itemId ? "（接管中）" : "（空孔位）"}`)}">
        ${slot.itemImage ? `<img src="${escapeHtml(slot.itemImage)}" alt="">` : ""}
        <small aria-hidden="true">${escapeHtml(slot.number || "")}</small>
        ${slot.destroyed ? `<b aria-hidden="true">×</b>` : ""}
      </span>
    `).join("")}</span>`;
  }

  function renderPostgameMechanicStatusIcon(view) {
    const mechanic = view?.battle?.postgameBossMechanic;
    if (!refs.enemyStatusIcons || !mechanic?.active) {
      postgameMechanicDetailOpen = false;
      postgameMechanicDetailKey = "";
      return;
    }
    if (postgameMechanicDetailKey && postgameMechanicDetailKey !== mechanic.key) postgameMechanicDetailOpen = false;
    postgameMechanicDetailKey = mechanic.key || "";
    const badge = postgameMechanicBadge(mechanic);
    const button = document.createElement("button");
    button.type = "button";
    const kingFlameClass = mechanic.key === "postgame_king"
      ? (mechanic.state?.flameOn ? " is-king-flame-on" : " is-king-flame-off")
      : "";
    button.className = `status-icon boss-mechanic-status-icon${mechanic.key === "postgame_douglas_bullet" ? " is-bullet" : ""}${kingFlameClass}${postgameMechanicDetailOpen ? " is-open" : ""}`;
    button.title = mechanic.key === "postgame_douglas_bullet"
      ? `${mechanic.title || "六孔裝甲"}（點擊查看骰點、道具效果與破壞狀態）`
      : `${mechanic.title || "Boss 特殊機制"}（點擊查看）`;
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-expanded", postgameMechanicDetailOpen ? "true" : "false");
    button.innerHTML = `
      <img src="${escapeHtml(mechanic.iconUrl || mechanic.islandImage || "")}" alt="">
      ${postgameBulletMiniSocketsHtml(mechanic)}
      ${badge ? `<span class="status-icon-turns is-debuff">${escapeHtml(badge)}</span>` : ""}
    `;
    button.querySelector("img")?.addEventListener("error", (event) => {
      event.currentTarget.src = fallbackStatusIconData("", mechanic.title || "Boss");
    }, { once: true });
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      hideStatusPopover();
      postgameMechanicDetailOpen = !postgameMechanicDetailOpen;
      renderHud(latestView);
      renderPostgameMechanic(latestView);
    });
    refs.enemyStatusIcons.appendChild(button);
  }

  function carryItemHudPills(carryItem) {
    if (!carryItem?.id) return `<span class="pill">攜帶物：無</span>`;
    const subItems = Array.isArray(carryItem.subItems) ? carryItem.subItems : [];
    const subItemsPayload = subItems.length ? encodeURIComponent(JSON.stringify(subItems)) : "";
    return `
      <button class="pill carry-pill${subItems.length ? " carry-arsenal-pill" : ""}" type="button" data-carry-popover data-carry-name="${escapeHtml(carryItem.name || "攜帶物")}" data-carry-status="${escapeHtml(carryItem.status || "戰鬥中生效")}" data-carry-summary="${escapeHtml(carryItem.summary || "沒有登錄效果。")}" ${subItemsPayload ? `data-carry-sub-items="${escapeHtml(subItemsPayload)}"` : ""}>攜帶物：${escapeHtml(carryItem.name || "無")}</button>
    `;
  }

  function attributeClassName(attribute) {
    if (attribute === "力") return "attr-force";
    if (attribute === "速") return "attr-speed";
    if (attribute === "技") return "attr-tech";
    return "attr-neutral";
  }

  function setAttributeLabel(element, attribute) {
    if (!element) return;
    const label = attribute || "無";
    element.textContent = label;
    element.title = label;
    element.setAttribute("aria-label", label);
    element.className = `pill attribute-pill ${attributeClassName(label)}`;
  }

  function attributePill(attribute) {
    const label = attribute || "無";
    return `<span class="pill attribute-pill ${attributeClassName(label)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${escapeHtml(label)}</span>`;
  }

  function attributeModifier(attacker, defender) {
    if (!ATTRIBUTE_ADVANTAGE[attacker] || !ATTRIBUTE_ADVANTAGE[defender] || attacker === defender) return 1;
    return ATTRIBUTE_ADVANTAGE[attacker] === defender ? 2 : 0.5;
  }

  function formatMultiplier(value) {
    const number = Number(value || 1);
    return Number.isInteger(number) ? `${number}` : String(number);
  }

  function battleAttributeMatchup(view) {
    const provided = view?.attributeMatchup || {};
    const playerAttribute = provided.playerAttribute || view?.activeCard?.attribute || "無";
    const enemyAttribute = provided.enemyAttribute || view?.enemy?.attribute || "無";
    const playerAttackMultiplier = Number(provided.playerAttackMultiplier ?? attributeModifier(playerAttribute, enemyAttribute));
    const enemyAttackMultiplier = Number(provided.enemyAttackMultiplier ?? attributeModifier(enemyAttribute, playerAttribute));
    return {
      playerAttribute,
      enemyAttribute,
      playerAttackMultiplier,
      enemyAttackMultiplier,
    };
  }

  function renderAttributeMatchup(view) {
    if (!refs.matchupChip || !refs.matchupCurrent) return;
    if (!view?.activeCard || !view?.enemy) {
      refs.matchupCurrent.textContent = "相剋";
      refs.matchupChip.title = "力克技，技克速，速克力";
      return;
    }
    const matchup = battleAttributeMatchup(view);
    refs.matchupCurrent.textContent = `x${formatMultiplier(matchup.playerAttackMultiplier)}`;
    refs.matchupChip.title = `我方 ${matchup.playerAttribute} → 敵方 ${matchup.enemyAttribute}：x${formatMultiplier(matchup.playerAttackMultiplier)}\n敵方 ${matchup.enemyAttribute} → 我方 ${matchup.playerAttribute}：x${formatMultiplier(matchup.enemyAttackMultiplier)}`;
  }

  function playerDisplayAttribute(view) {
    return view?.attributeMatchup?.playerAttribute || view?.activeCard?.attribute || "無";
  }

  function flashAttributeElement(element) {
    if (!element) return;
    element.classList.remove("kyubi-attribute-flash");
    void element.offsetWidth;
    element.classList.add("kyubi-attribute-flash");
  }

  function setPlayerAttributeDisplay(attribute, view = latestView) {
    const playerAttribute = attribute || "無";
    const enemyAttribute = view?.attributeMatchup?.enemyAttribute || view?.enemy?.attribute || "無";
    const playerMultiplier = attributeModifier(playerAttribute, enemyAttribute);
    const enemyMultiplier = attributeModifier(enemyAttribute, playerAttribute);
    const pill = refs.playerHudMeta?.querySelector(".attribute-pill");
    if (pill) {
      setAttributeLabel(pill, playerAttribute);
      flashAttributeElement(pill);
    }
    if (refs.matchupCurrent) refs.matchupCurrent.textContent = `x${formatMultiplier(playerMultiplier)}`;
    if (refs.matchupChip) {
      refs.matchupChip.title = `我方 ${playerAttribute} → 敵方 ${enemyAttribute}：x${formatMultiplier(playerMultiplier)}\n敵方 ${enemyAttribute} → 我方 ${playerAttribute}：x${formatMultiplier(enemyMultiplier)}`;
    }
  }

  function showAttributeMatchupDetail(event) {
    if (!latestView || !refs.matchupChip) return;
    const matchup = battleAttributeMatchup(latestView);
    showStatusPopover(refs.matchupChip, {
      label: "屬性相剋表",
      result: `我方 ${matchup.playerAttribute} → 敵方 ${matchup.enemyAttribute}：x${formatMultiplier(matchup.playerAttackMultiplier)}；敵方 ${matchup.enemyAttribute} → 我方 ${matchup.playerAttribute}：x${formatMultiplier(matchup.enemyAttackMultiplier)}`,
      turns: 0,
      description: "力克技 x2；技克速 x2；速克力 x2。被克制時 x0.5，同屬性 x1。",
    });
    event?.stopPropagation?.();
  }

  function bindCarryItemHudPills(container) {
    container?.querySelectorAll("[data-carry-popover]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        let subItems = [];
        if (button.dataset.carrySubItems) {
          try {
            const parsed = JSON.parse(decodeURIComponent(button.dataset.carrySubItems));
            if (Array.isArray(parsed)) subItems = parsed;
          } catch (error) {
            console.warn("[battle] unable to read arsenal HUD items", error);
          }
        }
        showStatusPopover(button, {
          kind: "carry",
          label: `攜帶物：${button.dataset.carryName || "攜帶物"}`,
          result: button.dataset.carryStatus || "戰鬥中生效",
          turns: 0,
          description: button.dataset.carrySummary || "沒有登錄效果。",
          subItems,
        });
      });
    });
  }

  function moveTypeLabel(type) {
    return {
      attack: "攻擊",
      buff: "強化",
      debuff: "弱化",
      heal: "治療",
      shield: "護盾",
      control: "控制",
      special: "特殊",
    }[type] || type || "技能";
  }

  function criticalRateText(rate) {
    const percent = Math.round(Math.max(0, Number(rate || 0) * 100) * 10) / 10;
    return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
  }

  function criticalMultiplierText(multiplier) {
    const value = Math.round(Math.max(1, Number(multiplier || 1.5)) * 100) / 100;
    return Number.isInteger(value) ? value.toFixed(0) : String(value);
  }

  function effectTextLines(effectText = "") {
    return String(effectText || "無追加效果")
      .split(/\s*\/\s*|\s*；\s*/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function moveEffectSummary(effectText = "") {
    const lines = effectTextLines(effectText);
    const useful = lines.filter((line) => !/^基礎攻擊/.test(line) && line !== "無追加效果");
    const raidSuitStealth = useful.find((line) => /光學迷彩/.test(line));
    if (raidSuitStealth) {
      return [raidSuitStealth, ...useful.filter((line) => line !== raidSuitStealth).slice(0, 1)].join(" / ");
    }
    if (useful.length) return useful.slice(0, 2).join(" / ");
    return lines[0] || "無追加效果";
  }

  function moveDetailLines(move) {
    const typeLabel = move.damageClass === "special"
      ? "特攻"
      : move.damageClass === "physical"
        ? "物攻"
        : moveTypeLabel(move.type || move.category);
    const ppText = `PP ${move.currentPP}/${move.pp}`;
    const priorityText = move.priority ? `先制 ${Number(move.priority) > 0 ? "+" : ""}${move.priority}` : "";
    const rawDamageText = String(move.damageText || "").trim();
    const hasDamageText = rawDamageText && rawDamageText !== "效果技";
    const effectSummary = moveEffectSummary(move.effectText);
    const primaryDetail = hasDamageText
      ? rawDamageText
      : move.power
        ? `威力 ${move.power}`
        : `效果：${effectSummary}`;
    const accuracyText = Number(move.accuracy ?? 100) !== 100 ? `命中 ${move.accuracy}%` : "";
    const effectLine = hasDamageText && effectSummary && effectSummary !== "無追加效果" && !/^基礎攻擊/.test(effectSummary)
      ? effectSummary
      : "";
    const firstLine = [typeLabel, ppText, priorityText].filter(Boolean).join(" ・ ");
    const secondLine = [primaryDetail, accuracyText].filter(Boolean).join(" ・ ");
    const compactLine = [primaryDetail, ppText, effectLine, accuracyText, priorityText].filter(Boolean).join(" ・ ");
    return { typeLabel, ppText, priorityText, primaryDetail, accuracyText, firstLine, secondLine, compactLine, effectLine, fullEffectText: effectTextLines(move.effectText).join(" / ") };
  }

  function renderMoveEffectLines(effectText = "") {
    const lines = effectTextLines(effectText);
    const visibleLines = lines.slice(0, 2);
    return `<div class="move-effect-list" title="${escapeHtml(lines.join(" / "))}">
      ${visibleLines.map((line) => `<div class="move-effect-line">${escapeHtml(line)}</div>`).join("")}
      ${lines.length > visibleLines.length ? `<div class="move-effect-line more">另有 ${escapeHtml(lines.length - visibleLines.length)} 項：${escapeHtml(lines.slice(visibleLines.length).join(" / "))}</div>` : ""}
    </div>`;
  }

  function getPortraitSet(side) {
    const source = displayedCombatant(side, side === "player" ? latestView?.activeCard : latestView?.enemy);
    return source?.battlePortraits || {};
  }

  function portraitUrl(side, state) {
    const portraits = getPortraitSet(side);
    const directionalHitKey = side === "player" ? "hitPlayerSide" : "hitEnemySide";
    const fallbackMap = {
      normal: ["normal", "idle"],
      stealth: ["stealth", "normal", "idle"],
      angry: ["angry", "attack", "morale", "normal", "idle"],
      attack: ["angry", "attack", "morale", "normal", "idle"],
      hit: [directionalHitKey, "hit", "hurt", "normal", "idle"],
      morale: ["morale", "normal", "idle"],
      weak: ["weak", "hit", "hurt", "normal", "idle"],
      dizzy: ["dizzy", "hit", "hurt", "normal", "idle"],
      placeholder: ["placeholder", "fallback", "idle"],
    };
    const keys = fallbackMap[state] || fallbackMap.normal;
    const foundKey = keys.find((key) => portraits[key]);
    return foundKey ? portraits[foundKey] : PLACEHOLDER_BATTLE_PORTRAIT;
  }

  function effectivePortraitState(side, requestedState) {
    if (requestedState !== "normal") return requestedState;
    const source = displayedCombatant(side, side === "player" ? latestView?.activeCard : latestView?.enemy);
    const currentHp = Number(source?.currentHp ?? 1);
    const maxHp = Math.max(1, Number(source?.maxHp ?? 1));
    if (currentHp <= 0) return knockoutVisualStarted[side] ? "dizzy" : "normal";
    if ((currentHp / maxHp) <= 0.25) return "weak";
    return "normal";
  }

  function shouldKeepPlayerPortraitOnKnockout(view = latestView) {
    return Boolean(view?.battle?.luffyGearFifthAwakeningPending || view?.battle?.keepPlayerPortraitOnKnockout);
  }

  function setImageSafe(img, wrap, src, fallbackSrc = "") {
    img.onerror = null;
    const fallback = fallbackSrc && fallbackSrc !== src
      ? fallbackSrc
      : (src !== PLACEHOLDER_BATTLE_PORTRAIT ? PLACEHOLDER_BATTLE_PORTRAIT : "");
    if (!src || missingPortraitSrc.has(src)) {
      if (fallback && !missingPortraitSrc.has(fallback)) {
        setImageSafe(img, wrap, fallback);
      } else {
        img.removeAttribute("src");
        img.classList.add("is-empty");
        wrap.classList.remove("has-portrait");
      }
      return;
    }
    img.onerror = () => {
      missingPortraitSrc.add(src);
      if (fallback && !missingPortraitSrc.has(fallback)) {
        setImageSafe(img, wrap, fallback);
      } else {
        img.removeAttribute("src");
        img.classList.add("is-empty");
        wrap.classList.remove("has-portrait");
      }
    };
    img.src = src;
    img.classList.remove("is-empty");
    wrap.classList.add("has-portrait");
  }

  function combatantVisualKey(side, view) {
    const source = displayedCombatant(side, side === "player" ? view?.activeCard : view?.enemy);
    if (!source) return "";
    const identity = source.id || source.key || source.name || side;
    const maxHp = Number(source.maxHp ?? source.baseStats?.hp ?? 0);
    const index = side === "player" ? view?.battle?.activeCrewIndex ?? "" : "";
    return [identity, index, maxHp].join("|");
  }

  function currentCombatantHp(side) {
    const source = displayedCombatant(side, side === "player" ? latestView?.activeCard : latestView?.enemy);
    return Number(source?.currentHp ?? 1);
  }

  function markKnockoutPortraitHidden(side) {
    if (!["player", "enemy"].includes(side)) return;
    knockoutHiddenCombatantKeys[side] = combatantVisualKey(side, latestView);
  }

  function clearKnockoutPortraitHidden(side) {
    if (!["player", "enemy"].includes(side)) return;
    knockoutHiddenCombatantKeys[side] = "";
  }

  function knockoutPortraitShouldStayHidden(side) {
    if (!["player", "enemy"].includes(side)) return false;
    if (side === "player" && shouldKeepPlayerPortraitOnKnockout()) return false;
    const hiddenKey = knockoutHiddenCombatantKeys[side];
    if (!hiddenKey) return false;
    const currentKey = combatantVisualKey(side, latestView);
    if (!currentKey || currentKey !== hiddenKey || currentCombatantHp(side) > 0) {
      clearKnockoutPortraitHidden(side);
      return false;
    }
    return true;
  }

  function resetPortraitVisual(side) {
    if (!["player", "enemy"].includes(side)) return;
    const card = side === "player" ? refs.playerCard : refs.enemyCard;
    const img = side === "player" ? refs.playerPortrait : refs.enemyPortrait;
    clearTimeout(portraitTimers[side]);
    clearTimeout(knockoutTimers[side]);
    clearTimeout(knockoutTimers[`${side}Fade`]);
    clearTimeout(knockoutTimers[`${side}Announce`]);
    knockoutVisualStarted[side] = false;
    portraitState[side] = "normal";
    if (side === "player") {
      clearTimeout(nikaAwakeningHeartbeatTimer);
      nikaAwakeningHeartbeatTimer = null;
    }
    clearKnockoutPortraitHidden(side);
    card?.classList.remove("portrait-attack", "portrait-hit", "portrait-ko", "nika-awakening-standby", "nika-awakening-heartbeat");
    img?.classList.remove("is-empty");
  }

  function syncPlayerAwakeningStandby(view = latestView) {
    const keepPortrait = shouldKeepPlayerPortraitOnKnockout(view);
    refs.stage?.classList.toggle("nika-awakening-standby", keepPortrait);
    refs.playerCard?.classList.toggle("nika-awakening-standby", keepPortrait);
    if (!keepPortrait) {
      refs.playerCard?.classList.remove("nika-awakening-heartbeat");
      clearTimeout(nikaAwakeningHeartbeatTimer);
      nikaAwakeningHeartbeatTimer = null;
      return;
    }
    clearTimeout(portraitTimers.player);
    clearTimeout(knockoutTimers.player);
    clearTimeout(knockoutTimers.playerFade);
    clearTimeout(knockoutTimers.playerAnnounce);
    knockoutVisualStarted.player = true;
    refs.playerCard?.classList.remove("portrait-attack", "portrait-ko");
    refs.playerCard?.classList.add("portrait-hit");
    const normalSrc = portraitUrl("player", "normal");
    const standbySrc = portraitUrl("player", "dizzy") || portraitUrl("player", "hit") || normalSrc;
    setImageSafe(refs.playerPortrait, refs.playerPortraitWrap, standbySrc, normalSrc);
  }

  function playNikaAwakeningHeartbeat() {
    syncPlayerAwakeningStandby();
    const card = refs.playerCard;
    if (!card) return;
    clearTimeout(nikaAwakeningHeartbeatTimer);
    card.classList.remove("nika-awakening-heartbeat");
    void card.offsetWidth;
    card.classList.add("nika-awakening-heartbeat");
    nikaAwakeningHeartbeatTimer = setTimeout(() => {
      card.classList.remove("nika-awakening-heartbeat");
      nikaAwakeningHeartbeatTimer = null;
    }, 920);
  }

  function resetChangedCombatants(view) {
    ["player", "enemy"].forEach((side) => {
      const nextKey = combatantVisualKey(side, view);
      if (!nextKey) {
        lastCombatantKeys[side] = "";
        return;
      }
      if (nextKey !== lastCombatantKeys[side]) {
        lastCombatantKeys[side] = nextKey;
        resetPortraitVisual(side);
      }
    });
  }

  function yonkoPhaseFrameState(view) {
    const status = view?.battle?.yonkoStatus || null;
    const finalGateStatus = view?.battle?.finalGateStatus || null;
    const key = String(status?.key || finalGateStatus?.key || view?.enemy?.key || "");
    const isYonkoBattle = key.startsWith("yonko_") || view?.battle?.islandKind === "yonko";
    const isFinalGateBattle = !view?.battle?.isRegionalSpawnEncounter
      && (key === "final_imu" || view?.battle?.islandKind === "final_gate");
    return {
      key: isYonkoBattle || isFinalGateBattle ? key : "",
      phase2: Boolean((isYonkoBattle && status?.phase2) || (isFinalGateBattle && finalGateStatus?.phase2)),
    };
  }

  function triggerYonkoPhaseFrameFx() {
    if (!refs.enemyCard) return;
    refs.stage?.classList.remove("yonko-phase-transform");
    refs.enemyCard.classList.remove("yonko-phase-transform");
    void refs.enemyCard.offsetWidth;
    refs.stage?.classList.add("yonko-phase-transform");
    refs.enemyCard.classList.add("yonko-phase-transform");
    clearTimeout(yonkoPhaseFxTimer);
    yonkoPhaseFxTimer = setTimeout(() => {
      refs.stage?.classList.remove("yonko-phase-transform");
      refs.enemyCard?.classList.remove("yonko-phase-transform");
    }, 900);
  }

  function syncYonkoPhaseFrame(view) {
    const next = yonkoPhaseFrameState(view);
    const hasYonko = Boolean(next.key);
    refs.stage?.classList.toggle("yonko-phase-two", Boolean(hasYonko && next.phase2));
    refs.enemyCard?.classList.toggle("yonko-phase-two", Boolean(hasYonko && next.phase2));
    const sameYonko = hasYonko && next.key === lastYonkoPhaseKey;
    if (sameYonko && !lastYonkoPhase2 && next.phase2) triggerYonkoPhaseFrameFx();
    if (!hasYonko) {
      refs.stage?.classList.remove("yonko-phase-transform");
      refs.enemyCard?.classList.remove("yonko-phase-transform");
      clearTimeout(yonkoPhaseFxTimer);
    }
    lastYonkoPhaseKey = next.key;
    lastYonkoPhase2 = next.phase2;
  }

  function setPortraitState(side, state) {
    if (!["player", "enemy"].includes(side)) return;
    const allowedStates = ["normal", "stealth", "attack", "angry", "hit", "morale", "weak", "dizzy"];
    const requestedState = allowedStates.includes(state) ? state : "normal";
    const finalState = effectivePortraitState(side, requestedState);
    portraitState[side] = requestedState;
    const card = side === "player" ? refs.playerCard : refs.enemyCard;
    const img = side === "player" ? refs.playerPortrait : refs.enemyPortrait;
    const wrap = side === "player" ? refs.playerPortraitWrap : refs.enemyPortraitWrap;
    if (knockoutPortraitShouldStayHidden(side)) {
      clearTimeout(portraitTimers[side]);
      card.classList.remove("portrait-attack", "portrait-hit");
      card.classList.add("portrait-ko");
      return;
    }
    const normalSrc = portraitUrl(side, "normal");
    const src = portraitUrl(side, finalState) || normalSrc;
    if (finalState !== "weak" && finalState !== "dizzy" && finalState !== "hit") {
      clearTimeout(knockoutTimers[side]);
      clearKnockoutPortraitHidden(side);
      card.classList.remove("portrait-ko");
    }
    card.classList.toggle("portrait-attack", finalState === "attack");
    card.classList.toggle("portrait-hit", finalState === "hit" || finalState === "weak" || finalState === "dizzy");
    setImageSafe(img, wrap, src, normalSrc);
  }

  function restartPortraitMotion(side, state) {
    const card = side === "player" ? refs.playerCard : refs.enemyCard;
    if (!card) return;
    if (state === "attack") restartAnimation(card, "portrait-attack");
    if (state === "hit" || state === "weak" || state === "dizzy") restartAnimation(card, "portrait-hit");
  }

  function playPortraitAction(side, state, duration = 520) {
    clearTimeout(portraitTimers[side]);
    setPortraitState(side, state);
    restartPortraitMotion(side, state);
    portraitTimers[side] = setTimeout(() => setPortraitState(side, "normal"), duration);
  }

  function playRaidSuitStealthMiss(duration = 980) {
    const side = "player";
    const stealthSrc = portraitUrl(side, "stealth");
    const normalSrc = portraitUrl(side, "normal");
    if (!stealthSrc || stealthSrc === normalSrc) return;
    clearTimeout(portraitTimers[side]);
    refs.playerCard?.classList.remove("portrait-attack", "portrait-hit");
    setPortraitState(side, "stealth");
    portraitTimers[side] = setTimeout(() => setPortraitState(side, "normal"), Math.max(520, Number(duration || 0)));
  }

  function eventActorSide(event = {}) {
    return event.side === "enemy" ? "enemy" : event.side === "player" ? "player" : "";
  }

  function oppositeSide(side) {
    return side === "player" ? "enemy" : side === "enemy" ? "player" : "";
  }

  function clearInactiveActionPose(actorSide) {
    const inactiveSide = oppositeSide(actorSide);
    if (!inactiveSide) return;
    clearTimeout(portraitTimers[inactiveSide]);
    setPortraitState(inactiveSide, "normal");
  }

  function showKnockoutPose(side, label = "", announce = false) {
    if (!["player", "enemy"].includes(side)) return;
    clearTimeout(portraitTimers[side]);
    knockoutVisualStarted[side] = true;
    setPortraitState(side, "dizzy");
    if (announce && label) playCutIn(`${label} ${side === "player" ? "瀕死" : "倒下"}！`);
  }

  function playKnockoutAction(side, label = "") {
    if (!["player", "enemy"].includes(side)) return;
    const card = side === "player" ? refs.playerCard : refs.enemyCard;
    const alreadyShowingKnockout = knockoutVisualStarted[side];
    const fadeDelay = alreadyShowingKnockout ? KNOCKOUT_REPEAT_FADE_DELAY_MS : KNOCKOUT_FADE_DELAY_MS;
    clearTimeout(portraitTimers[side]);
    clearTimeout(knockoutTimers[side]);
    clearTimeout(knockoutTimers[`${side}Fade`]);
    clearTimeout(knockoutTimers[`${side}Announce`]);
    card.classList.remove("portrait-ko");
    if (side === "player" && shouldKeepPlayerPortraitOnKnockout()) {
      knockoutVisualStarted.player = true;
      card.classList.remove("portrait-attack");
      card.classList.add("portrait-hit", "nika-awakening-standby");
      syncPlayerAwakeningStandby();
      if (label) playCutIn(`${label} 瀕死！`);
      return;
    }
    if (alreadyShowingKnockout) {
      showKnockoutPose(side, label, false);
    } else {
      knockoutVisualStarted[side] = false;
      setPortraitState(side, "hit");
      knockoutTimers[side] = setTimeout(() => showKnockoutPose(side, label, false), 260);
    }
    if (side === "player") {
      playerKnockoutPanelReadyAt = Math.max(
        playerKnockoutPanelReadyAt,
        Date.now() + fadeDelay + KNOCKOUT_FADE_DURATION_MS + REPLACEMENT_PANEL_KO_BUFFER_MS
      );
    }
    knockoutTimers[`${side}Fade`] = setTimeout(() => {
      card.classList.remove("portrait-attack", "portrait-hit", "portrait-ko");
      void card.offsetWidth;
      card.classList.add("portrait-ko");
      markKnockoutPortraitHidden(side);
    }, fadeDelay);
    if (label) {
      knockoutTimers[`${side}Announce`] = setTimeout(() => {
        playCutIn(`${label} ${side === "player" ? "瀕死" : "倒下"}！`);
      }, fadeDelay + KNOCKOUT_FADE_DURATION_MS + KNOCKOUT_ANNOUNCE_AFTER_FADE_BUFFER_MS);
    }
  }

  function restartAnimation(element, className) {
    if (!element) return;
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
  }

  function playStageShake() {
    restartAnimation(refs.stage, "screen-shake");
  }

  function clearDamageNumbers() {
    if (refs.damagePop) refs.damagePop.replaceChildren();
  }

  function battleDamageAnchorPoint(anchorElement, targetSide = "enemy", hitIndex = 0) {
    const stageRect = refs.stage?.getBoundingClientRect?.();
    const anchorRect = anchorElement?.getBoundingClientRect?.();
    const stageWidth = Math.max(1, Number(stageRect?.width || window.innerWidth || 1));
    const stageHeight = Math.max(1, Number(stageRect?.height || window.innerHeight || 1));
    const fallbackX = (targetSide === "enemy" ? 0.74 : 0.26) * stageWidth;
    const fallbackY = (targetSide === "enemy" ? 0.36 : 0.42) * stageHeight;
    const validAnchor = anchorRect && anchorRect.width > 1 && anchorRect.height > 1 && stageRect;
    const baseX = validAnchor ? anchorRect.left - stageRect.left + anchorRect.width * 0.5 : fallbackX;
    const baseY = validAnchor ? anchorRect.top - stageRect.top + anchorRect.height * 0.38 : fallbackY;
    const lanes = [-34, 34, -62, 62, -14, 14];
    const lane = lanes[Math.max(0, Number(hitIndex || 0)) % lanes.length] || 0;
    const row = Math.floor(Math.max(0, Number(hitIndex || 0)) / lanes.length);
    return {
      x: Math.max(24, Math.min(stageWidth - 24, baseX + lane)),
      y: Math.max(42, Math.min(stageHeight - 42, baseY + row * 18)),
    };
  }

  function spawnBattleDamageNumber({ amount = 0, critical = false, miss = false, heal = false, blocked = false, blockedLabel = "GUARD", blockedAriaLabel = "攻擊被擋下", targetSide = "enemy", anchorElement = null, hitIndex = 0 } = {}) {
    if (!refs.damagePop) return null;
    const value = Math.max(0, Math.round(Number(amount || 0)));
    const isMiss = !blocked && (!!miss || (!heal && value <= 0));
    const point = battleDamageAnchorPoint(anchorElement, targetSide, hitIndex);
    const node = document.createElement("div");
    const kind = blocked ? "blocked" : isMiss ? "miss" : heal ? "heal" : critical ? "critical" : "normal";
    node.className = `damage-number ${kind}`;
    node.dataset.damageKind = kind;
    node.dataset.damageValue = String(value);
    node.style.left = `${point.x}px`;
    node.style.top = `${point.y}px`;
    node.style.setProperty("--damage-tilt", `${[-4, 3, -2, 5, -3, 2][Math.max(0, Number(hitIndex || 0)) % 6]}deg`);
    const valueNode = document.createElement("span");
    valueNode.className = "damage-number-value";
    valueNode.textContent = blocked ? blockedLabel : isMiss ? "MISS" : `${heal ? "+" : "-"}${value.toLocaleString("en-US")}`;
    if (kind === "critical") {
      const criticalLabel = document.createElement("span");
      criticalLabel.className = "damage-critical-label";
      criticalLabel.textContent = "爆擊";
      criticalLabel.setAttribute("aria-hidden", "true");
      node.appendChild(criticalLabel);
    }
    node.appendChild(valueNode);
    node.setAttribute("role", "status");
    node.setAttribute("aria-label", blocked ? blockedAriaLabel : isMiss ? "攻擊落空" : `${critical ? "暴擊，" : ""}${heal ? "回復" : "受到"}${value}點${heal ? "生命" : "傷害"}`);
    refs.damagePop.appendChild(node);
    void node.offsetWidth;
    node.classList.add("show");
    const lifetime = blocked ? 620 : critical && !isMiss ? 1650 : 1550;
    setTimeout(() => node.remove(), lifetime + 180);
    return node;
  }

  function clearJudgeCloneInterceptors() {
    const layer = refs.judgeCloneGuardLayer;
    if (!layer) return;
    layer.querySelectorAll(".judge-clone-intercept").forEach((node) => node.remove());
    layer.classList.remove("is-intercepting-hit");
    layer.hidden = true;
  }

  function deployJudgeCloneInterceptors(count = 0) {
    const layer = refs.judgeCloneGuardLayer;
    const total = Math.max(0, Math.min(3, Math.floor(Number(count || 0))));
    if (!layer || !total) return [];
    clearJudgeCloneInterceptors();
    const wrappers = judgeCloneFormation(total).map((slot, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "judge-clone-intercept is-waiting";
      wrapper.dataset.guardIndex = String(index);
      wrapper.innerHTML = judgeCloneSpriteHtml({ ...slot, delay: index * 45 }, "is-deploying");
      layer.appendChild(wrapper);
      return wrapper;
    });
    layer.hidden = false;
    layer.classList.add("is-intercepting-hit");
    return wrappers;
  }

  function hitJudgeCloneInterceptor(wrapper, hitIndex = 0) {
    if (!wrapper) return null;
    const layer = refs.judgeCloneGuardLayer;
    const image = wrapper.querySelector(".judge-clone-guard");
    wrapper.classList.remove("is-waiting");
    wrapper.dataset.hitIndex = String(hitIndex);
    image?.classList.remove("is-deploying");
    if (image) void image.offsetWidth;
    image?.classList.add("is-breaking");
    window.setTimeout(() => {
      wrapper.remove();
      if (!layer.querySelector(".judge-clone-intercept")) layer.classList.remove("is-intercepting-hit");
      if (!layer.querySelector(".judge-clone-intercept")) layer.hidden = true;
    }, 720);
    return wrapper;
  }

  function clearImpactFxTimers(clearHp = true) {
    impactFxTimers.forEach((timer) => clearTimeout(timer));
    impactFxTimers = [];
    clearDamageNumbers();
    refs.stage?.classList.remove("combo-sequence");
    clearAllPortraitEffectFx();
    clearJudgeCloneInterceptors();
    setImpactEffect("");
    if (clearHp && visualHpOverride) visualHpOverride = null;
  }

  function clearKyubiMaskFx() {
    kyubiMaskFxTimers.forEach((timer) => clearTimeout(timer));
    kyubiMaskFxTimers = [];
    if (kyubiMaskAttrInterval) clearInterval(kyubiMaskAttrInterval);
    kyubiMaskAttrInterval = null;
    activeKyubiMaskEventId = "";
    refs.kyubiMaskFx?.classList.remove("show", "cycling", "settled");
  }

  function clearSanjiRaidSuitFx() {
    sanjiRaidSuitFxTimers.forEach((timer) => clearTimeout(timer));
    sanjiRaidSuitFxTimers = [];
    refs.sanjiRaidSuitFx?.classList.remove("show");
  }

  function clearLucciSixPowerFx() {
    lucciSixPowerFxTimers.forEach((timer) => clearTimeout(timer));
    lucciSixPowerFxTimers = [];
    refs.lucciSixPowerFx?.classList.remove("show", "has-image");
    if (refs.lucciSixPowerImage) {
      refs.lucciSixPowerImage.removeAttribute("src");
      refs.lucciSixPowerImage.alt = "";
    }
  }

  function playLucciSixPowerFx(event) {
    if (!event || !refs.lucciSixPowerFx) return;
    clearLucciSixPowerFx();
    const powerName = String(event.powerName || "六式");
    if (refs.lucciSixPowerName) refs.lucciSixPowerName.textContent = powerName;
    if (refs.lucciSixPowerEffect) refs.lucciSixPowerEffect.textContent = event.effectText || `${event.statLabel || "能力"}提高 80%`;
    if (refs.lucciSixPowerImage && event.image) {
      refs.lucciSixPowerImage.src = event.image;
      refs.lucciSixPowerImage.alt = powerName;
      refs.lucciSixPowerImage.addEventListener("load", () => refs.lucciSixPowerFx?.classList.add("has-image"), { once: true });
      refs.lucciSixPowerImage.addEventListener("error", () => refs.lucciSixPowerFx?.classList.remove("has-image"), { once: true });
    }
    void refs.lucciSixPowerFx.offsetWidth;
    refs.lucciSixPowerFx.classList.add("show");
    lucciSixPowerFxTimers.push(setTimeout(playStageShake, 520));
    lucciSixPowerFxTimers.push(setTimeout(() => clearLucciSixPowerFx(), Math.max(2300, Number(event.duration || 2500))));
  }

  function battleHostBgmManager() {
    const candidates = [];
    try {
      if (window.parent && window.parent !== window) candidates.push(window.parent);
    } catch (_error) {}
    try {
      if (window.opener && !window.opener.closed) candidates.push(window.opener);
    } catch (_error) {}
    candidates.push(window);
    for (const candidate of candidates) {
      try {
        if (candidate?.BgmManager) return candidate.BgmManager;
      } catch (_error) {
        // Cross-origin or closing windows cannot provide the shared BGM manager.
      }
    }
    return null;
  }

  function pauseAudioEntries(entries) {
    (Array.isArray(entries) ? entries : []).forEach((audio) => {
      if (!audio) return;
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (_error) {
        // A stale optional SFX instance must not interrupt the special animation.
      }
    });
  }

  function silenceBattleEffectAudioForLucciRokuogan() {
    lucciRokuoganEffectAudioSilenced = true;
    Object.values(statusEffectAudioPools).forEach((pool) => pauseAudioEntries(pool));
    Object.values(castEffectAudioPools).forEach((pool) => pauseAudioEntries(pool));
    Object.values(hitEffectAudioPools).forEach((pool) => pauseAudioEntries(pool));
    if (refs.lucciRokuoganFx) refs.lucciRokuoganFx.dataset.effectAudioSilenced = "true";
  }

  function holdBgmForLucciRokuogan() {
    const manager = battleHostBgmManager();
    if (!manager) return null;
    let previousStatus = {};
    try {
      previousStatus = typeof manager.status === "function" ? manager.status() : {};
    } catch (_error) {}
    const shouldResume = previousStatus.enabled !== false && !!previousStatus.currentChoice;
    let unlockAutoSwitch = null;
    try {
      unlockAutoSwitch = manager.lockAutoSwitch?.("lucci-rokuogan");
      const fadePromise = manager.fadeOut?.(0);
      if (fadePromise?.catch) fadePromise.catch(() => {});
    } catch (_error) {
      // Missing or blocked BGM controls fall back to the visual and voice channels.
    }
    let restored = false;
    return {
      restore() {
        if (restored) return;
        restored = true;
        try {
          unlockAutoSwitch?.();
        } catch (_error) {}
        let latestStatus = {};
        try {
          latestStatus = typeof manager.status === "function" ? manager.status() : {};
        } catch (_error) {}
        if (!shouldResume || latestStatus.enabled === false) return;
        try {
          const fadePromise = manager.fadeIn?.(520);
          if (fadePromise?.catch) fadePromise.catch(() => {});
        } catch (_error) {
          // BGM restoration is optional and must not block the next battle action.
        }
      },
    };
  }

  function hideLucciRokuoganCinematicLayer() {
    refs.lucciRokuoganFx?.classList.remove("show", "impacting", "connected");
    document.documentElement.classList.remove("lucci-rokuogan-active");
  }

  function clearLucciRokuoganFx() {
    lucciRokuoganFxTimers.forEach((timer) => clearTimeout(timer));
    lucciRokuoganFxTimers = [];
    hideLucciRokuoganCinematicLayer();
    Object.keys(lucciRokuoganVoiceAudio).forEach((key) => {
      const audio = lucciRokuoganVoiceAudio[key];
      if (!audio) return;
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (_error) {
        // Optional voice cleanup must never interrupt battle progression.
      }
      lucciRokuoganVoiceAudio[key] = null;
    });
    lucciRokuoganEffectAudioSilenced = false;
    if (refs.lucciRokuoganFx) refs.lucciRokuoganFx.dataset.effectAudioSilenced = "false";
    try {
      lucciRokuoganBgmHold?.restore?.();
    } catch (_error) {
      // A closing host window must not block visual cleanup.
    }
    lucciRokuoganBgmHold = null;
    if (refs.lucciRokuoganFx) refs.lucciRokuoganFx.dataset.bgmPaused = "false";
  }

  function playLucciRokuoganVoice(src, key = "call") {
    const source = String(src || "").trim();
    if (!source) return null;
    const slot = key === "hit" ? "hit" : "call";
    if (refs.lucciRokuoganFx) {
      refs.lucciRokuoganFx.dataset.lastVoiceKey = slot;
      refs.lucciRokuoganFx.dataset.lastVoiceSrc = source;
      refs.lucciRokuoganFx.dataset.lastVoiceAt = String(performance.now());
    }
    try {
      const previous = lucciRokuoganVoiceAudio[slot];
      if (previous) {
        previous.pause();
        previous.currentTime = 0;
      }
      const audio = new Audio(source);
      audio.preload = "auto";
      audio.volume = slot === "hit" ? 0.9 : 0.96;
      lucciRokuoganVoiceAudio[slot] = audio;
      audio.addEventListener?.("error", () => {
        if (lucciRokuoganVoiceAudio[slot] === audio) lucciRokuoganVoiceAudio[slot] = null;
      }, { once: true });
      const playPromise = audio.play();
      if (playPromise?.catch) playPromise.catch(() => {});
      return audio;
    } catch (_error) {
      // Missing, undecodable, or autoplay-blocked optional voices fall back to the visual only.
      return null;
    }
  }

  function playLucciRokuoganFx(event) {
    if (!event || !refs.lucciRokuoganFx) return false;
    clearLucciRokuoganFx();
    const targetSide = attackTargetSide(event);
    const targetCard = targetSide === "enemy" ? refs.enemyCard : refs.playerCard;
    const hitDamages = attackHitDamages(event);
    const totalDamage = attackDamageTotal(event);
    const connected = !event.miss && totalDamage > 0;
    const duration = Math.max(LUCCI_ROKUOGAN_TOTAL_MS, Number(event.duration || LUCCI_ROKUOGAN_TOTAL_MS));
    silenceBattleEffectAudioForLucciRokuogan();
    lucciRokuoganBgmHold = holdBgmForLucciRokuogan();
    refs.lucciRokuoganFx.dataset.bgmPaused = lucciRokuoganBgmHold ? "true" : "unavailable";
    refs.lucciRokuoganFx.classList.toggle("connected", connected);
    document.documentElement.classList.add("lucci-rokuogan-active");
    void refs.lucciRokuoganFx.offsetWidth;
    refs.lucciRokuoganFx.classList.add("show");
    playCutIn(event.moveName || "覺醒・六王銃");
    playLucciRokuoganVoice(event.voiceSfx, "call");
    playPortraitAction("enemy", "attack", 1800);
    lucciRokuoganFxTimers.push(setTimeout(() => {
      refs.lucciRokuoganFx?.classList.add("impacting");
      playStageShake();
    }, 2850));
    lucciRokuoganFxTimers.push(setTimeout(() => {
      hideLucciRokuoganCinematicLayer();
      clearTimeout(portraitTimers[targetSide]);
      setPortraitState(targetSide, "normal");
    }, LUCCI_ROKUOGAN_CINEMATIC_MS));
    lucciRokuoganFxTimers.push(setTimeout(() => {
      if (connected) {
        playLucciRokuoganVoice(event.hitVoiceSfx, "hit");
        playPortraitAction(targetSide, "hit", LUCCI_ROKUOGAN_HIT_POSE_MS);
        hitDamages.forEach((damage, index) => {
          applyDisplayedHitDamage(targetSide, damage);
          spawnBattleDamageNumber({
            amount: damage,
            critical: eventCriticalAtHit(event, index),
            targetSide,
            anchorElement: targetCard,
            hitIndex: index,
          });
        });
        playHitEffectSound(event.hitSfx, { allowDuringRokuogan: true });
        playStageShake();
      } else {
        spawnBattleDamageNumber({ amount: 0, miss: true, targetSide, anchorElement: targetCard });
      }
    }, LUCCI_ROKUOGAN_IMPACT_AT_MS));
    if (connected && event.effectFx) {
      lucciRokuoganFxTimers.push(setTimeout(() => playStatusEffectFx(event.effectFx.targetSide || targetSide, { ...event.effectFx, eventId: event.id }), LUCCI_ROKUOGAN_IMPACT_AT_MS + 900));
    }
    lucciRokuoganFxTimers.push(setTimeout(() => finishDisplayedAttackHp(event.id), LUCCI_ROKUOGAN_IMPACT_AT_MS + LUCCI_ROKUOGAN_HIT_POSE_MS - 100));
    lucciRokuoganFxTimers.push(setTimeout(() => clearLucciRokuoganFx(), duration));
    return true;
  }

  function clearTotMusicaDualSyncFx() {
    totMusicaDualFxTimers.forEach((timer) => clearTimeout(timer));
    totMusicaDualFxTimers = [];
    totMusicaDualDiceIntervals.forEach((timer) => clearInterval(timer));
    totMusicaDualDiceIntervals = [];
    if (totMusicaDualAwaitTimer) clearTimeout(totMusicaDualAwaitTimer);
    totMusicaDualAwaitTimer = null;
    totMusicaDualAwaitingEvent = false;
    totMusicaDualAnimationActive = false;
    refs.totMusicaDualFx?.classList.remove(
      "show", "leaving", "judged", "result-success", "result-mismatch", "result-barrier", "selection-preview",
      "persistent-stage", "team-setup-stage", "enemy-present", "player-resolving", "enemy-rolling", "enemy-striking", "enemy-impact", "enemy-status-cast", "enemy-status-impact",
      "enemy-camera-rising", "enemy-camera-high", "player-camera-high", "camera-held-high", "dice-colliding", "collision-failed", "collision-fused", "actors-converge", "launch-upward", "split-upward", "boss-revealed", "wave-impact", "boss-preview-open", "battle-result-stage",
      "boss-knockout-stagger", "boss-knockout-fall", "boss-knockout-complete"
    );
    totMusicaBossPreviewOpen = false;
    refs.totMusicaBossPreviewToggle?.setAttribute("aria-expanded", "false");
    refs.stage?.classList.remove("tot-musica-selecting", "tot-musica-resolving", "tot-musica-wave-launching", "tot-musica-enemy-turn", "tot-musica-boss-view");
    setTotMusicaBossPreviewControlsHidden(false);
    refs.totMusicaRealDiceCluster?.classList.remove("settled");
    refs.totMusicaRealDiceCluster?.classList.remove("rolling");
    refs.totMusicaSongDiceCluster?.classList.remove("settled");
    refs.totMusicaSongDiceCluster?.classList.remove("rolling");
    refs.totMusicaBossDiceCluster?.classList.remove("settled", "rolling");
    [refs.totMusicaRealFrame, refs.totMusicaSongFrame, refs.totMusicaBossFrame].forEach((card) => {
      card?.classList.remove(
        "portrait-attack", "portrait-hit", "portrait-switch-in", "boss-dropping", "boss-high-reveal",
        "tot-musica-boss-knockout-stagger", "tot-musica-boss-knockout-fall"
      );
    });
    [
      refs.totMusicaRealDie, refs.totMusicaRealDie2, refs.totMusicaRealDie3,
      refs.totMusicaSongDie, refs.totMusicaSongDie2, refs.totMusicaSongDie3,
      refs.totMusicaBossDie,
    ].forEach((node, index) => {
      node?.parentElement?.classList.remove("is-visible", "is-rolling", "is-settled");
      if (index === 0 || index === 3 || index === 6) node?.parentElement?.classList.add("is-visible");
      if (node) node.textContent = "?";
    });
  }

  function totMusicaDualPortrait(source = {}, states = []) {
    const portraits = source?.battlePortraits && typeof source.battlePortraits === "object" ? source.battlePortraits : {};
    const key = states.find((state) => portraits[state]);
    return key ? portraits[key] : PLACEHOLDER_BATTLE_PORTRAIT;
  }

  function setTotMusicaDualImage(image, source, states) {
    if (!image) return;
    const src = totMusicaDualPortrait(source, states);
    image.onerror = () => {
      image.onerror = null;
      image.src = PLACEHOLDER_BATTLE_PORTRAIT;
    };
    image.src = src;
  }

  function applyTotMusicaOriginalFrame(card, frameId) {
    if (!card) return;
    clearCosmeticFrame(card);
    card.querySelectorAll(".tot-musica-dual-nika-layer").forEach((layer) => layer.remove());
    card.classList.remove("nika-frame-active");
    const normalizedId = normalizeCosmeticFrameId(frameId);
    if (normalizedId !== "nikaFrame") {
      applyCosmeticFrame(card, normalizedId);
      return;
    }
    const nikaLayers = [
      ["nika-frame-sun-glow", "images/board/battle/nika_frame/nika_sun_glow.webp"],
      ["nika-frame-cloud-left", "images/board/battle/nika_frame/nika_cloud_left.webp"],
      ["nika-frame-cloud-right", "images/board/battle/nika_frame/nika_cloud_right.webp"],
      ["nika-frame-card", "images/board/battle/nika_frame/nika_card_frame.webp"],
    ];
    const anchor = card.querySelector(".card-inner");
    nikaLayers.forEach(([className, src]) => {
      const img = document.createElement("img");
      img.className = `nika-frame-layer ${className} tot-musica-dual-nika-layer`;
      img.src = src;
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      img.decoding = "async";
      card.insertBefore(img, className === "nika-frame-card" ? null : anchor);
    });
    card.classList.add("nika-frame-active");
  }

  function setTotMusicaHpUi(textNode, fillNode, currentHp, maxHp) {
    const max = Math.max(1, Number(maxHp || 1));
    const current = Math.max(0, Math.min(max, Number(currentHp || 0)));
    if (textNode) textNode.textContent = `HP ${Math.round(current)} / ${Math.round(max)}`;
    if (fillNode) fillNode.style.width = `${Math.max(0, Math.min(100, current / max * 100))}%`;
  }

  function setTotMusicaWorldStage(source = {}, world = "real") {
    const isReal = world === "real";
    const name = isReal ? refs.totMusicaRealName : refs.totMusicaSongName;
    const move = isReal ? refs.totMusicaRealMove : refs.totMusicaSongMove;
    const portrait = isReal ? refs.totMusicaRealPortrait : refs.totMusicaSongPortrait;
    const frame = isReal ? refs.totMusicaRealFrame : refs.totMusicaSongFrame;
    if (name) name.textContent = source.actorName || source.name || (isReal ? "左隊船員" : "右隊船員");
    if (move) move.textContent = source.moveName || "";
    const hudName = isReal ? refs.totMusicaRealHudName : refs.totMusicaSongHudName;
    if (hudName) hudName.textContent = source.actorName || source.name || "船員";
    const level = isReal ? refs.totMusicaRealLevel : refs.totMusicaSongLevel;
    if (level) level.textContent = `Lv.${Math.max(1, Number(source.level || 1))}`;
    const attribute = isReal ? refs.totMusicaRealAttribute : refs.totMusicaSongAttribute;
    if (attribute) {
      const attributeLabel = source.attribute || "無";
      setAttributeLabel(attribute, attributeLabel);
    }
    const carry = isReal ? refs.totMusicaRealCarry : refs.totMusicaSongCarry;
    if (carry) {
      carry.innerHTML = `${source.raidSuitTransformed ? `<span class="pill" title="${escapeHtml(source.passiveText || "隱形黑戰鬥型態")}">隱形黑</span>` : ""}${carryItemHudPills(source.carryItem)}`;
      bindCarryItemHudPills(carry);
    }
    renderStatusIcons(isReal ? refs.totMusicaRealStatusIcons : refs.totMusicaSongStatusIcons, source, "player");
    setTotMusicaDualImage(portrait, source, ["normal", "idle", "morale", "angry", "attack"]);
    applyTotMusicaOriginalFrame(frame, source.cosmeticFrameId);
    const cardName = frame?.querySelector(".card-name");
    if (cardName) cardName.textContent = source.actorName || source.name || (isReal ? "左隊船員" : "右隊船員");
    setTotMusicaHpUi(
      isReal ? refs.totMusicaRealHpText : refs.totMusicaSongHpText,
      isReal ? refs.totMusicaRealHpFill : refs.totMusicaSongHpFill,
      source.currentHp,
      source.maxHp,
    );
  }

  function setTotMusicaBossStage(source = {}) {
    if (refs.totMusicaEnemyLabel) refs.totMusicaEnemyLabel.textContent = `敵方・${source.name || "Tot Musica"}`;
    if (refs.totMusicaBossHudName) refs.totMusicaBossHudName.textContent = source.name || "Tot Musica";
    const defeated = Number(source.currentHp ?? 1) <= 0;
    setTotMusicaDualImage(
      refs.totMusicaBossPortrait,
      source,
      defeated ? ["dizzy", "weak", "hitEnemySide", "hit", "normal"] : ["normal", "idle", "morale", "angry"]
    );
    applyTotMusicaOriginalFrame(refs.totMusicaBossFrame, source.cosmeticFrameId || "postgameTotMusica");
    const bossName = refs.totMusicaBossFrame?.querySelector(".card-name");
    if (bossName) bossName.textContent = source.name || "Tot Musica";
    setTotMusicaHpUi(refs.totMusicaBossHpText, refs.totMusicaBossHpFill, source.currentHp, source.maxHp);
    renderStatusIcons(refs.totMusicaBossStatusIcons, source, "enemy");
  }

  function setTotMusicaBossPreviewControlsHidden(hidden) {
    [refs.infoPanel, refs.actionPanel].forEach((panel) => {
      if (!panel) return;
      panel.classList.toggle("tot-musica-boss-preview-hidden", !!hidden);
      if (hidden) {
        panel.style.setProperty("display", "none", "important");
      } else {
        panel.style.removeProperty("display");
      }
    });
  }

  function syncTotMusicaPersistentStage(view = latestView) {
    const mechanic = view?.battle?.postgameBossMechanic;
    const active = mechanic?.key === "postgame_tot_musica";
    refs.stage?.classList.toggle("tot-musica-battle-mode", !!active);
    if (!active) {
      totMusicaBossPreviewOpen = false;
      refs.stage?.classList.remove("tot-musica-team-setup-mode", "tot-musica-enemy-turn", "tot-musica-boss-view");
      setTotMusicaBossPreviewControlsHidden(false);
      if (!totMusicaDualAnimationActive && !totMusicaDualAwaitingEvent) {
        refs.totMusicaDualFx?.classList.remove("show", "persistent-stage", "team-setup-stage", "selection-preview", "enemy-present");
      }
      return;
    }
    if (totMusicaDualAnimationActive || totMusicaDualAwaitingEvent) return;
    const state = mechanic.state || {};
    refs.totMusicaDualFx?.classList.remove(
      "leaving", "judged", "selection-preview", "result-success", "result-mismatch", "result-barrier",
      "player-resolving", "enemy-striking", "enemy-impact", "enemy-status-cast", "enemy-status-impact", "camera-held-high", "dice-colliding", "collision-failed", "collision-fused",
      "actors-converge", "launch-upward", "split-upward", "boss-revealed", "wave-impact", "boss-preview-open", "battle-result-stage",
      "boss-knockout-stagger", "boss-knockout-fall", "boss-knockout-complete"
    );
    refs.totMusicaDualFx?.classList.add("show", "persistent-stage");
    refs.stage?.classList.add("tot-musica-selecting");
    refs.stage?.classList.remove("tot-musica-resolving", "tot-musica-wave-launching");
    if (!state.assigned) {
      totMusicaBossPreviewOpen = false;
      refs.stage?.classList.add("tot-musica-team-setup-mode");
      refs.stage?.classList.remove("tot-musica-enemy-turn");
      refs.totMusicaDualFx?.classList.add("team-setup-stage");
      refs.totMusicaDualFx?.classList.remove("selection-preview", "enemy-present");
      return;
    }
    const crew = Array.isArray(state.crew) ? state.crew : [];
    const realCrew = state.coopPlayerWorlds && Array.isArray(state.realCrew) ? state.realCrew : crew;
    const songCrew = state.coopPlayerWorlds && Array.isArray(state.songCrew) ? state.songCrew : crew;
    const real = realCrew.find((card) => Number(card.index) === Number(state.realActiveIndex)) || {};
    const song = songCrew.find((card) => Number(card.index) === Number(state.songActiveIndex)) || {};
    setTotMusicaWorldStage(real, "real");
    setTotMusicaWorldStage(song, "song");
    refs.stage?.classList.remove("tot-musica-team-setup-mode");
    refs.totMusicaDualFx?.classList.remove("team-setup-stage");
    if (view?.battle?.result || view?.battle?.canFinish) {
      totMusicaBossPreviewOpen = false;
      refs.stage?.classList.remove("tot-musica-enemy-turn", "tot-musica-boss-view");
      setTotMusicaBossPreviewControlsHidden(false);
      setTotMusicaBossStage(view.enemy || {});
      refs.totMusicaBossPreviewToggle?.setAttribute("aria-expanded", "false");
      refs.totMusicaDualFx?.classList.add("enemy-present", "boss-revealed", "battle-result-stage");
      refs.totMusicaDualFx?.classList.remove("selection-preview", "boss-preview-open");
      if (Number(view?.enemy?.currentHp ?? 1) <= 0) {
        refs.totMusicaDualFx?.classList.add("boss-knockout-complete");
      }
      return;
    }
    if (view?.battle?.canAct) {
      refs.stage?.classList.remove("tot-musica-enemy-turn");
      refs.totMusicaDualFx?.classList.add("selection-preview");
      refs.totMusicaDualFx?.classList.remove("enemy-present");
      setTotMusicaBossStage(view.enemy || {});
      refs.totMusicaDualFx?.classList.toggle("boss-preview-open", totMusicaBossPreviewOpen);
      refs.stage?.classList.toggle("tot-musica-boss-view", totMusicaBossPreviewOpen);
      setTotMusicaBossPreviewControlsHidden(totMusicaBossPreviewOpen);
      refs.totMusicaBossPreviewToggle?.setAttribute("aria-expanded", String(totMusicaBossPreviewOpen));
      refs.totMusicaBossPreviewToggle?.setAttribute("aria-label", totMusicaBossPreviewOpen ? "關閉 Tot Musica 狀態預覽" : "查看 Tot Musica 位置與狀態");
      return;
    }
    totMusicaBossPreviewOpen = false;
    refs.stage?.classList.remove("tot-musica-boss-view");
    setTotMusicaBossPreviewControlsHidden(false);
    refs.stage?.classList.add("tot-musica-enemy-turn");
    refs.totMusicaDualFx?.classList.remove("selection-preview");
    // 敵方事件尚未送達時仍留在雙世界專用舞台，但不能預先顯示 Boss。
    // 真正的敵方動畫會先執行鏡頭上移，完成後才加入 enemy-present。
    refs.totMusicaDualFx?.classList.remove("enemy-present");
  }

  function toggleTotMusicaBossPreview(event) {
    event?.stopPropagation?.();
    const mechanic = latestView?.battle?.postgameBossMechanic;
    if (mechanic?.key !== "postgame_tot_musica" || !latestView?.battle?.canAct || totMusicaDualAnimationActive || totMusicaDualAwaitingEvent) return;
    totMusicaBossPreviewOpen = !totMusicaBossPreviewOpen;
    setTotMusicaBossStage(latestView.enemy || {});
    refs.totMusicaDualFx?.classList.toggle("boss-preview-open", totMusicaBossPreviewOpen);
    refs.stage?.classList.toggle("tot-musica-boss-view", totMusicaBossPreviewOpen);
    setTotMusicaBossPreviewControlsHidden(totMusicaBossPreviewOpen);
    refs.totMusicaBossPreviewToggle?.setAttribute("aria-expanded", String(totMusicaBossPreviewOpen));
    refs.totMusicaBossPreviewToggle?.setAttribute("aria-label", totMusicaBossPreviewOpen ? "關閉 Tot Musica 狀態預覽" : "查看 Tot Musica 位置與狀態");
    if (totMusicaBossPreviewOpen) {
      clearTimeout(showStatus.timer);
      refs.status?.classList.remove("show");
    }
  }

  function playTotMusicaActorAttack(card, image, source) {
    if (!card || !source?.direct || !source?.hit) return;
    setTotMusicaDualImage(image, source, ["attack", "angry", "morale", "normal", "idle"]);
    restartAnimation(card, "portrait-attack");
    scheduleTotMusicaDualFx(() => {
      card.classList.remove("portrait-attack");
      setTotMusicaDualImage(image, source, ["normal", "idle", "morale", "angry"]);
    }, 920);
  }

  function hideTotMusicaDualSelectionPreview() {
    if (totMusicaDualAwaitingEvent || totMusicaDualAnimationActive) return;
    if (latestView?.battle?.postgameBossMechanic?.key === "postgame_tot_musica") return;
    if (!refs.totMusicaDualFx?.classList.contains("selection-preview")) return;
    refs.totMusicaDualFx.classList.remove("show", "selection-preview");
    refs.stage?.classList.remove("tot-musica-selecting");
  }

  function showTotMusicaDualSelectionPreview(state = {}, enemy = {}) {
    if (!refs.totMusicaDualFx) return;
    const crew = Array.isArray(state.crew) ? state.crew : [];
    const real = crew.find((card) => Number(card.index) === Number(state.realActiveIndex)) || {};
    const song = crew.find((card) => Number(card.index) === Number(state.songActiveIndex)) || {};
    refs.totMusicaDualFx.classList.remove(
      "leaving", "judged", "result-success", "result-mismatch", "result-barrier", "dice-colliding",
      "collision-failed", "collision-fused", "actors-converge", "launch-upward", "boss-revealed", "wave-impact", "enemy-status-cast", "enemy-status-impact"
    );
    refs.totMusicaRealSideLabel.textContent = "我方";
    refs.totMusicaSongSideLabel.textContent = "我方";
    refs.totMusicaRealName.textContent = real.name || "左隊船員";
    refs.totMusicaSongName.textContent = song.name || "右隊船員";
    refs.totMusicaRealMove.textContent = "";
    refs.totMusicaSongMove.textContent = "";
    setTotMusicaDualImage(refs.totMusicaRealPortrait, real, ["normal", "idle", "morale", "angry"]);
    setTotMusicaDualImage(refs.totMusicaSongPortrait, song, ["normal", "idle", "morale", "angry"]);
    applyTotMusicaOriginalFrame(refs.totMusicaRealFrame, real.cosmeticFrameId);
    applyTotMusicaOriginalFrame(refs.totMusicaSongFrame, song.cosmeticFrameId);
    refs.stage?.classList.add("tot-musica-selecting");
    refs.totMusicaDualFx.classList.add("show", "selection-preview");
  }

  function scheduleTotMusicaDualFx(callback, delay) {
    const timer = setTimeout(callback, delay);
    totMusicaDualFxTimers.push(timer);
    return timer;
  }

  function totMusicaWorldDiceNodes(world) {
    if (world === "boss") return [refs.totMusicaBossDie];
    return world === "real"
      ? [refs.totMusicaRealDie, refs.totMusicaRealDie2, refs.totMusicaRealDie3]
      : [refs.totMusicaSongDie, refs.totMusicaSongDie2, refs.totMusicaSongDie3];
  }

  function totMusicaWorldDiceCluster(world) {
    if (world === "boss") return refs.totMusicaBossDiceCluster;
    return world === "real" ? refs.totMusicaRealDiceCluster : refs.totMusicaSongDiceCluster;
  }

  function prepareTotMusicaWorldDice(world, rolls = []) {
    const values = (Array.isArray(rolls) ? rolls : []).map((value) => Math.max(0, Number(value || 0))).filter((value) => value > 0).slice(0, 3);
    const nodes = totMusicaWorldDiceNodes(world);
    const cluster = totMusicaWorldDiceCluster(world);
    cluster?.classList.remove("rolling", "settled");
    nodes.forEach((node, index) => {
      const die = node?.parentElement;
      die?.classList.toggle("is-visible", index === 0);
      die?.classList.remove("is-rolling", "is-settled");
      if (node) node.textContent = "?";
    });
    return { values, nodes };
  }

  function animateTotMusicaWorldDice(world, rolls = []) {
    const prepared = prepareTotMusicaWorldDice(world, rolls);
    const node = prepared.nodes[0];
    const cluster = totMusicaWorldDiceCluster(world);
    prepared.values.forEach((value, index) => {
      const startAt = index * TOT_MUSICA_DICE_CYCLE_MS;
      scheduleTotMusicaDualFx(() => {
        cluster?.classList.add("rolling");
        cluster?.classList.remove("settled");
        node?.parentElement?.classList.remove("is-settled");
        node?.parentElement?.classList.add("is-rolling");
        if (node) node.textContent = "?";
        const interval = setInterval(() => { if (node) node.textContent = String(Math.floor(Math.random() * 6) + 1); }, TOT_MUSICA_DICE_TICK_MS);
        totMusicaDualDiceIntervals.push(interval);
        scheduleTotMusicaDualFx(() => {
          clearInterval(interval);
          const timerIndex = totMusicaDualDiceIntervals.indexOf(interval);
          if (timerIndex >= 0) totMusicaDualDiceIntervals.splice(timerIndex, 1);
          cluster?.classList.remove("rolling");
          cluster?.classList.add("settled");
          node?.parentElement?.classList.remove("is-rolling");
          node?.parentElement?.classList.add("is-settled");
          if (node) node.textContent = String(value);
        }, TOT_MUSICA_DICE_ROLL_MS);
      }, startAt);
    });
    return Math.max(1, prepared.values.length);
  }

  function playTotMusicaDualSyncFx(event = {}) {
    if (!refs.totMusicaDualFx) return;
    clearDamageNumbers();
    totMusicaDualFxTimers.forEach((timer) => clearTimeout(timer));
    totMusicaDualFxTimers = [];
    totMusicaDualDiceIntervals.forEach((timer) => clearInterval(timer));
    totMusicaDualDiceIntervals = [];
    if (totMusicaDualAwaitTimer) clearTimeout(totMusicaDualAwaitTimer);
    totMusicaDualAwaitTimer = null;
    totMusicaDualAwaitingEvent = false;
    totMusicaDualAnimationActive = true;
    const real = event.realWorld || {};
    const song = event.songWorld || {};
    const bossAfter = event.targetCombatant || event.finalSnapshot?.enemy || latestView?.enemy || {};
    const bossBefore = event.startSnapshot?.enemy || event.startCombatant || bossAfter;
    const bossDefeated = Number(bossAfter.currentHp ?? 1) <= 0 && Number(event.damage || 0) > 0;
    const realFirst = Math.max(0, Number(real.firstDiceFace || 0));
    const songFirst = Math.max(0, Number(song.firstDiceFace || 0));
    const realTotal = Math.max(0, Number(real.diceTotal || 0));
    const songTotal = Math.max(0, Number(song.diceTotal || 0));
    const realRolls = (Array.isArray(real.diceRolls) && real.diceRolls.length ? real.diceRolls : realFirst > 0 ? [realFirst] : []).slice(0, 3);
    const songRolls = (Array.isArray(song.diceRolls) && song.diceRolls.length ? song.diceRolls : songFirst > 0 ? [songFirst] : []).slice(0, 3);
    const rollCount = Math.max(1, realRolls.length, songRolls.length);
    // The visible first dice are the single source of truth for the collision.
    // Recompute here as a guard against an old/stale snapshot carrying a wrong
    // synchronized flag: same parity fuses, different parity always shatters.
    const bothAttackRolls = Boolean(
      (event.bothAttackRolls ?? event.bothDirectHits)
      && realFirst > 0
      && songFirst > 0
    );
    const parityMatched = bothAttackRolls && realFirst % 2 === songFirst % 2;
    const synchronized = bothAttackRolls && parityMatched;
    const partialStrike = bothAttackRolls && !parityMatched;
    const hasUpwardAttack = synchronized || partialStrike;
    const compactResultText = synchronized
      ? `奇偶同步 ×${Math.max(1, Number(event.synergy?.bonusMultiplier || 1)).toFixed(2)}`
      : partialStrike
        ? `奇偶不同・分流 ${Math.max(0, Number(event.finalDamageRate || .05) * 100).toFixed(0)}%`
        : "同步失敗・次元屏障";
    const minimumDuration = (hasUpwardAttack ? 13800 : 7600) + Math.max(0, rollCount - 1) * TOT_MUSICA_DICE_CYCLE_MS;
    const duration = Math.max(minimumDuration, Number(event.duration || minimumDuration));
    const rollFinishAt = rollCount * TOT_MUSICA_DICE_CYCLE_MS;
    const collideAt = rollFinishAt + TOT_MUSICA_FIRST_DICE_HOLD_MS;
    const judgeAt = collideAt + TOT_MUSICA_DICE_COLLISION_MS;

    refs.totMusicaRealSideLabel.textContent = "我方";
    refs.totMusicaSongSideLabel.textContent = "我方";
    setTotMusicaWorldStage(real, "real");
    setTotMusicaWorldStage(song, "song");
    setTotMusicaBossStage(bossBefore);
    refs.totMusicaRealParity.textContent = "判定中";
    refs.totMusicaSongParity.textContent = "判定中";
    refs.totMusicaRealTotal.textContent = "第一顆骰決定奇偶";
    refs.totMusicaSongTotal.textContent = "第一顆骰決定奇偶";
    refs.totMusicaDualResult.textContent = "雙世界第一顆骰・奇偶同步判定";
    if (refs.totMusicaCollisionLeftFace) refs.totMusicaCollisionLeftFace.textContent = "?";
    if (refs.totMusicaCollisionRightFace) refs.totMusicaCollisionRightFace.textContent = "?";
    if (refs.totMusicaSyncCoreValue) refs.totMusicaSyncCoreValue.textContent = "同步";
    refs.totMusicaDualFx.classList.remove(
      "leaving", "selection-preview", "judged", "result-success", "result-mismatch", "result-barrier", "dice-colliding",
      "team-setup-stage", "enemy-present", "boss-revealed", "enemy-rolling", "enemy-striking", "enemy-impact", "enemy-status-cast", "enemy-status-impact", "enemy-camera-rising", "enemy-camera-high", "player-camera-high", "camera-held-high", "collision-failed", "collision-fused", "actors-converge", "launch-upward", "split-upward", "wave-impact", "boss-preview-open",
      "battle-result-stage", "boss-knockout-stagger", "boss-knockout-fall", "boss-knockout-complete"
    );
    refs.totMusicaBossFrame?.classList.remove(
      "portrait-hit", "boss-dropping", "boss-high-reveal",
      "tot-musica-boss-knockout-stagger", "tot-musica-boss-knockout-fall"
    );
    refs.stage?.classList.remove("tot-musica-selecting", "tot-musica-wave-launching");
    refs.stage?.classList.add("tot-musica-battle-mode", "tot-musica-resolving");
    refs.stage?.classList.remove("tot-musica-enemy-turn");
    refs.totMusicaDualFx.classList.add("show", "persistent-stage", "player-resolving");
    animateTotMusicaWorldDice("real", realRolls);
    animateTotMusicaWorldDice("song", songRolls);

    scheduleTotMusicaDualFx(() => {
      // Additional dice share the same visual slot, but synchronization is
      // decided only by the first die. Restore both visible faces before the
      // collision so the number the player sees is the number being judged.
      if (refs.totMusicaRealDie) refs.totMusicaRealDie.textContent = realFirst > 0 ? String(realFirst) : "—";
      if (refs.totMusicaSongDie) refs.totMusicaSongDie.textContent = songFirst > 0 ? String(songFirst) : "—";
      refs.totMusicaRealDie?.parentElement?.classList.remove("is-rolling");
      refs.totMusicaSongDie?.parentElement?.classList.remove("is-rolling");
      refs.totMusicaRealDie?.parentElement?.classList.add("is-settled");
      refs.totMusicaSongDie?.parentElement?.classList.add("is-settled");
      refs.totMusicaRealParity.textContent = real.parityLabel || (realFirst > 0 ? (realFirst % 2 ? "單數" : "雙數") : "未擲骰");
      refs.totMusicaSongParity.textContent = song.parityLabel || (songFirst > 0 ? (songFirst % 2 ? "單數" : "雙數") : "未擲骰");
      refs.totMusicaRealTotal.textContent = realTotal > 0 ? `${realRolls.join("＋")}＝${realTotal}（第一顆判定奇偶）` : "未形成直接攻擊";
      refs.totMusicaSongTotal.textContent = songTotal > 0 ? `${songRolls.join("＋")}＝${songTotal}（第一顆判定奇偶）` : "未形成直接攻擊";
    }, rollFinishAt);

    scheduleTotMusicaDualFx(() => {
      if (refs.totMusicaCollisionLeftFace) refs.totMusicaCollisionLeftFace.textContent = realFirst > 0 ? String(realFirst) : "—";
      if (refs.totMusicaCollisionRightFace) refs.totMusicaCollisionRightFace.textContent = songFirst > 0 ? String(songFirst) : "—";
      refs.totMusicaDualFx?.classList.add("dice-colliding");
    }, collideAt);

    scheduleTotMusicaDualFx(() => {
      if (!synchronized) {
        refs.totMusicaDualFx?.classList.add("collision-failed", "judged", bothAttackRolls ? "result-mismatch" : "result-barrier");
        refs.totMusicaDualResult.textContent = bothAttackRolls
          ? `${compactResultText}・雙骰碎裂，兩道攻擊改為直線分流`
          : `${compactResultText}・雙骰碰撞碎裂，沒有形成攻擊`;
        playStageShake();
        return;
      }
      refs.totMusicaDualFx?.classList.add("collision-fused", "actors-converge");
      if (refs.totMusicaSyncCoreValue) refs.totMusicaSyncCoreValue.textContent = "雙骰融合";
      setTotMusicaDualImage(refs.totMusicaRealPortrait, real, ["attack", "angry", "morale", "normal", "idle"]);
      setTotMusicaDualImage(refs.totMusicaSongPortrait, song, ["attack", "angry", "morale", "normal", "idle"]);
      playStageShake();
    }, judgeAt);

    if (hasUpwardAttack) {
      const launchAt = judgeAt + TOT_MUSICA_FUSION_HOLD_MS;
      // 衝擊波完整向上飛行；Boss 在最後一段由高處往下壓，交會瞬間才切受擊、扣血與傷害跳字。
      const impactAt = launchAt + TOT_MUSICA_ATTACK_TRAVEL_MS;
      const revealAt = impactAt - TOT_MUSICA_BOSS_REVEAL_HOLD_MS;
      scheduleTotMusicaDualFx(() => {
        refs.totMusicaDualFx?.classList.add("launch-upward");
        if (partialStrike) refs.totMusicaDualFx?.classList.add("split-upward");
        refs.stage?.classList.add("tot-musica-wave-launching");
        setTotMusicaDualImage(refs.totMusicaRealPortrait, real, ["attack", "angry", "morale", "normal", "idle"]);
        setTotMusicaDualImage(refs.totMusicaSongPortrait, song, ["attack", "angry", "morale", "normal", "idle"]);
      }, launchAt);

      scheduleTotMusicaDualFx(() => {
        setTotMusicaBossStage(bossBefore);
        setTotMusicaDualImage(refs.totMusicaBossPortrait, bossBefore, ["normal", "idle", "morale", "angry"]);
        refs.totMusicaBossFrame?.classList.add("boss-high-reveal");
        refs.totMusicaDualFx?.classList.add("boss-revealed", "enemy-present", "player-camera-high");
      }, revealAt);

      scheduleTotMusicaDualFx(() => {
        refs.totMusicaDualFx?.classList.add("wave-impact", "judged", synchronized ? "result-success" : "result-mismatch");
        refs.totMusicaBossFrame?.classList.remove("boss-high-reveal");
        refs.totMusicaDualResult.textContent = `${compactResultText}・造成 ${Math.max(0, Number(event.damage || 0))} 傷害`;
        setTotMusicaDualImage(refs.totMusicaBossPortrait, bossAfter, ["hitEnemySide", "hit", "hurt", "dizzy", "normal"]);
        setTotMusicaHpUi(refs.totMusicaBossHpText, refs.totMusicaBossHpFill, bossAfter.currentHp, bossAfter.maxHp);
        restartAnimation(refs.totMusicaBossFrame, "portrait-hit");
        spawnBattleDamageNumber({
          amount: event.damage,
          critical: !!event.critical,
          miss: Number(event.damage || 0) <= 0,
          targetSide: "enemy",
          anchorElement: refs.totMusicaBossFrame,
        });
        playStageShake();
      }, impactAt);

      if (bossDefeated) {
        scheduleTotMusicaDualFx(() => {
          refs.totMusicaDualFx?.classList.add("boss-knockout-stagger");
          refs.totMusicaDualResult.textContent = `${bossAfter.name || "Tot Musica"} 被同步衝擊擊倒`;
          setTotMusicaDualImage(refs.totMusicaBossPortrait, bossAfter, ["dizzy", "weak", "hitEnemySide", "hit", "normal"]);
          refs.totMusicaBossFrame?.classList.remove("portrait-hit");
          restartAnimation(refs.totMusicaBossFrame, "tot-musica-boss-knockout-stagger");
        }, impactAt + 650);

        scheduleTotMusicaDualFx(() => {
          refs.totMusicaDualFx?.classList.remove("boss-knockout-stagger");
          refs.totMusicaDualFx?.classList.add("boss-knockout-fall");
          refs.totMusicaBossFrame?.classList.remove("tot-musica-boss-knockout-stagger");
          restartAnimation(refs.totMusicaBossFrame, "tot-musica-boss-knockout-fall");
        }, impactAt + 1650);

        scheduleTotMusicaDualFx(() => {
          refs.totMusicaDualFx?.classList.remove("boss-knockout-fall");
          refs.totMusicaDualFx?.classList.add("boss-knockout-complete");
          refs.totMusicaDualResult.textContent = `${bossAfter.name || "Tot Musica"} 擊倒・戰鬥勝利`;
        }, impactAt + 3200);
      }
    }

    scheduleTotMusicaDualFx(() => {
      if (bossDefeated) {
        totMusicaDualFxTimers = [];
        totMusicaDualDiceIntervals.forEach((timer) => clearInterval(timer));
        totMusicaDualDiceIntervals = [];
        totMusicaDualAwaitingEvent = false;
        totMusicaDualAnimationActive = false;
        refs.stage?.classList.remove("tot-musica-resolving", "tot-musica-wave-launching", "tot-musica-enemy-turn");
        refs.totMusicaDualFx?.classList.add("show", "persistent-stage", "enemy-present", "boss-revealed", "boss-knockout-complete");
        renderPanel(latestView);
        return;
      }
      if (event.holdBossForEnemy && hasUpwardAttack) {
        totMusicaDualFxTimers = [];
        totMusicaDualDiceIntervals.forEach((timer) => clearInterval(timer));
        totMusicaDualDiceIntervals = [];
        totMusicaDualAwaitingEvent = false;
        setTotMusicaDualImage(refs.totMusicaBossPortrait, bossAfter, ["normal", "idle", "morale", "angry"]);
        refs.totMusicaBossFrame?.classList.remove("portrait-hit", "boss-high-reveal");
        refs.totMusicaDualFx?.classList.remove(
          "player-resolving", "dice-colliding", "collision-failed", "collision-fused", "actors-converge",
          "launch-upward", "split-upward", "wave-impact", "judged", "result-success", "result-mismatch", "result-barrier"
        );
        refs.totMusicaDualFx?.classList.add("show", "persistent-stage", "enemy-present", "boss-revealed", "camera-held-high");
        refs.stage?.classList.remove("tot-musica-wave-launching", "tot-musica-selecting");
        refs.stage?.classList.add("tot-musica-battle-mode", "tot-musica-resolving", "tot-musica-enemy-turn");
        return;
      }
      clearTotMusicaDualSyncFx();
      syncTotMusicaPersistentStage(latestView);
      renderPanel(latestView);
    }, duration + 60);
  }

  function playTotMusicaEnemyDualStrikeFx(event = {}) {
    if (!refs.totMusicaDualFx) return;
    clearDamageNumbers();
    totMusicaDualFxTimers.forEach((timer) => clearTimeout(timer));
    totMusicaDualFxTimers = [];
    totMusicaDualDiceIntervals.forEach((timer) => clearInterval(timer));
    totMusicaDualDiceIntervals = [];
    if (totMusicaDualAwaitTimer) clearTimeout(totMusicaDualAwaitTimer);
    totMusicaDualAwaitTimer = null;
    totMusicaDualAwaitingEvent = false;
    totMusicaDualAnimationActive = true;
    const real = event.realWorld || {};
    const song = event.songWorld || {};
    const boss = event.enemy || event.actorCombatant || latestView?.enemy || {};
    const dealsDamage = event.dealsDamage !== false;
    const continueFromPlayerHigh = !!event.continueFromPlayerHigh;
    const bossRolls = (Array.isArray(event.diceRolls) && event.diceRolls.length ? event.diceRolls : event.diceFace > 0 ? [event.diceFace] : []).map((value) => Number(value || 0)).filter((value) => value > 0).slice(0, 3);
    const rollCount = Math.max(1, bossRolls.length);
    const revealAt = continueFromPlayerHigh ? 0 : TOT_MUSICA_VERTICAL_CAMERA_MS;
    const rollFinishAt = revealAt + rollCount * TOT_MUSICA_DICE_CYCLE_MS;
    const attackAt = rollFinishAt + TOT_MUSICA_FIRST_DICE_HOLD_MS;
    const impactAt = attackAt + TOT_MUSICA_ATTACK_TRAVEL_MS;
    const minimumDuration = (continueFromPlayerHigh ? 11100 : 14000) + Math.max(0, rollCount - 1) * TOT_MUSICA_DICE_CYCLE_MS;
    const duration = Math.max(minimumDuration, Number(event.duration || minimumDuration));
    setTotMusicaWorldStage({ ...real, currentHp: real.startHp ?? real.currentHp }, "real");
    setTotMusicaWorldStage({ ...song, currentHp: song.startHp ?? song.currentHp }, "song");
    setTotMusicaBossStage(boss);
    if (event.blocked) {
      const blockedDuration = Math.max(2600, Number(event.duration || (continueFromPlayerHigh ? 3400 : 5200)));
      const blockedReason = event.blockedReason || "異常狀態";
      refs.totMusicaRealMove.textContent = "本輪未受攻擊";
      refs.totMusicaSongMove.textContent = "本輪未受攻擊";
      if (refs.totMusicaBossDiceLabel) refs.totMusicaBossDiceLabel.textContent = "行動受阻";
      if (refs.totMusicaBossDiceTotal) refs.totMusicaBossDiceTotal.textContent = `${blockedReason}・無法行動`;
      refs.totMusicaDualResult.textContent = `${event.actorName || "Tot Musica"} 因${blockedReason}無法攻擊`;
      refs.totMusicaDualFx.classList.remove(
        "leaving", "selection-preview", "team-setup-stage", "player-resolving", "dice-colliding", "collision-failed",
        "collision-fused", "actors-converge", "launch-upward", "wave-impact", "result-success", "result-mismatch", "result-barrier",
        "enemy-rolling", "enemy-striking", "enemy-impact", "enemy-status-cast", "enemy-status-impact", "player-camera-high"
      );
      refs.totMusicaBossFrame?.classList.remove("portrait-attack", "portrait-hit", "boss-dropping", "boss-high-reveal");
      refs.totMusicaDualFx.classList.add("show", "persistent-stage", "boss-revealed", "enemy-present", "enemy-camera-high", "judged");
      refs.totMusicaDualFx.classList.toggle("camera-held-high", continueFromPlayerHigh);
      refs.stage?.classList.add("tot-musica-battle-mode", "tot-musica-resolving", "tot-musica-enemy-turn");
      refs.stage?.classList.remove("tot-musica-selecting", "tot-musica-wave-launching");
      setTotMusicaDualImage(refs.totMusicaBossPortrait, boss, ["dizzy", "weak", "normal", "idle", "morale"]);
      scheduleTotMusicaDualFx(() => {
        clearTotMusicaDualSyncFx();
        syncTotMusicaPersistentStage(latestView);
        renderPanel(latestView);
      }, blockedDuration + 60);
      return;
    }
    refs.totMusicaRealMove.textContent = event.moveName || "";
    refs.totMusicaSongMove.textContent = event.moveName || "";
    if (refs.totMusicaBossDiceLabel) refs.totMusicaBossDiceLabel.textContent = "敵方擲骰";
    if (refs.totMusicaBossDiceTotal) refs.totMusicaBossDiceTotal.textContent = bossRolls.length > 1 ? "追加骰依序判定" : "決定本回合威力";
    refs.totMusicaDualResult.textContent = `${event.actorName || "Tot Musica"}・${event.moveName || "雙世界攻擊"}`;
    refs.totMusicaDualFx.classList.remove(
      "leaving", "selection-preview", "team-setup-stage", "player-resolving", "dice-colliding", "collision-failed",
      "collision-fused", "actors-converge", "launch-upward", "wave-impact", "result-success", "result-mismatch", "result-barrier",
      "boss-revealed", "enemy-present", "enemy-rolling", "enemy-striking", "enemy-impact", "enemy-status-cast", "enemy-status-impact", "enemy-camera-high", "player-camera-high", "camera-held-high"
    );
    refs.totMusicaBossFrame?.classList.remove("portrait-attack", "portrait-hit", "boss-dropping", "boss-high-reveal");
    refs.totMusicaDualFx.classList.add("show", "persistent-stage");
    refs.totMusicaDualFx.classList.add(continueFromPlayerHigh ? "camera-held-high" : "enemy-camera-rising");
    refs.stage?.classList.add("tot-musica-battle-mode", "tot-musica-resolving", "tot-musica-enemy-turn");
    refs.stage?.classList.remove("tot-musica-selecting", "tot-musica-wave-launching");

    const revealBossForEnemy = () => {
      setTotMusicaDualImage(refs.totMusicaBossPortrait, boss, ["normal", "idle", "morale", "angry"]);
      refs.totMusicaBossFrame?.classList.toggle("boss-high-reveal", !continueFromPlayerHigh);
      refs.totMusicaDualFx?.classList.add("enemy-camera-high", "boss-revealed", "enemy-present", "enemy-rolling");
      animateTotMusicaWorldDice("boss", bossRolls);
    };
    if (continueFromPlayerHigh) revealBossForEnemy();
    else scheduleTotMusicaDualFx(revealBossForEnemy, revealAt);

    scheduleTotMusicaDualFx(() => {
      refs.totMusicaDualFx?.classList.remove("enemy-rolling");
      refs.totMusicaDualFx?.classList.add(dealsDamage ? "enemy-striking" : "enemy-status-cast");
      refs.totMusicaBossFrame?.classList.remove("boss-high-reveal");
      if (refs.totMusicaBossDiceTotal) refs.totMusicaBossDiceTotal.textContent = bossRolls.length ? `${bossRolls.join("＋")}＝${Math.max(0, Number(event.diceFace || 0))}` : "未擲骰";
      refs.totMusicaDualResult.textContent = `${event.actorName || "Tot Musica"}・${event.moveName || (dealsDamage ? "雙世界攻擊" : "雙世界效果")}・骰 ${event.diceFace || "—"}`;
      setTotMusicaDualImage(refs.totMusicaBossPortrait, boss, dealsDamage ? ["attack", "angry", "morale", "normal", "idle"] : ["morale", "angry", "attack", "normal", "idle"]);
      restartAnimation(refs.totMusicaBossFrame, "portrait-attack");
    }, attackAt);

    scheduleTotMusicaDualFx(() => {
      refs.totMusicaDualFx?.classList.add(dealsDamage ? "enemy-impact" : "enemy-status-impact", "judged");
      setTotMusicaDualImage(refs.totMusicaRealPortrait, real, real.fatalGuard
        ? ["morale", "normal", "idle"]
        : dealsDamage && real.hit
          ? ["hitPlayerSide", "hit", "hurt", "dizzy", "normal"]
          : real.raidSuitStealth ? ["stealth", "normal", "idle", "morale"] : ["normal", "idle", "morale"]);
      setTotMusicaDualImage(refs.totMusicaSongPortrait, song, song.fatalGuard
        ? ["morale", "normal", "idle"]
        : dealsDamage && song.hit
          ? ["hitPlayerSide", "hit", "hurt", "dizzy", "normal"]
          : song.raidSuitStealth ? ["stealth", "normal", "idle", "morale"] : ["normal", "idle", "morale"]);
      if (dealsDamage && real.hit && !real.fatalGuard) restartAnimation(refs.totMusicaRealFrame, "portrait-hit");
      if (dealsDamage && song.hit && !song.fatalGuard) restartAnimation(refs.totMusicaSongFrame, "portrait-hit");
      setTotMusicaHpUi(refs.totMusicaRealHpText, refs.totMusicaRealHpFill, real.currentHp, real.maxHp);
      setTotMusicaHpUi(refs.totMusicaSongHpText, refs.totMusicaSongHpFill, song.currentHp, song.maxHp);
      refs.totMusicaRealMove.textContent = dealsDamage ? (real.fatalGuard ? "不屈・致命傷已抵銷" : real.hit ? `受到 ${Math.max(0, Number(real.damage || 0))} 傷害` : "攻擊落空") : (real.affected ? "效果命中" : "效果未命中");
      refs.totMusicaSongMove.textContent = dealsDamage ? (song.fatalGuard ? "不屈・致命傷已抵銷" : song.hit ? `受到 ${Math.max(0, Number(song.damage || 0))} 傷害` : "攻擊落空") : (song.affected ? "效果命中" : "效果未命中");
      if (dealsDamage) {
        spawnBattleDamageNumber({
          amount: real.damage,
          critical: !!real.critical,
          miss: !real.hit && !real.fatalGuard,
          blocked: !!real.fatalGuard,
          blockedLabel: real.fatalGuardLabel || "不屈",
          blockedAriaLabel: "戰鬥服發動不屈，致命傷已抵銷",
          targetSide: "player",
          anchorElement: refs.totMusicaRealFrame,
          hitIndex: 0,
        });
        spawnBattleDamageNumber({
          amount: song.damage,
          critical: !!song.critical,
          miss: !song.hit && !song.fatalGuard,
          blocked: !!song.fatalGuard,
          blockedLabel: song.fatalGuardLabel || "不屈",
          blockedAriaLabel: "戰鬥服發動不屈，致命傷已抵銷",
          targetSide: "player",
          anchorElement: refs.totMusicaSongFrame,
          hitIndex: 1,
        });
      }
      if (dealsDamage) {
        const realDamage = Math.max(0, Number(real.damage || 0));
        const songDamage = Math.max(0, Number(song.damage || 0));
        const realSummary = real.fatalGuard ? "不屈" : real.hit ? realDamage : "MISS";
        const songSummary = song.fatalGuard ? "不屈" : song.hit ? songDamage : "MISS";
        const damageSummary = !real.fatalGuard && !song.fatalGuard && real.hit && song.hit && realDamage === songDamage
          ? `兩界各 ${realDamage}`
          : `左 ${realSummary}・右 ${songSummary}`;
        refs.totMusicaDualResult.textContent = `${event.moveName || "魔王攻擊"}・${damageSummary} 傷害`;
      } else {
        refs.totMusicaDualResult.textContent = `${event.moveName || "魔王效果"}・效果命中（無直接傷害）`;
      }
      playStageShake();
    }, impactAt);

    scheduleTotMusicaDualFx(() => {
      refs.totMusicaBossFrame?.classList.remove("portrait-attack");
      setTotMusicaDualImage(refs.totMusicaBossPortrait, boss, ["normal", "idle", "morale"]);
      setTotMusicaDualImage(refs.totMusicaRealPortrait, real, ["normal", "idle", "morale"]);
      setTotMusicaDualImage(refs.totMusicaSongPortrait, song, ["normal", "idle", "morale"]);
    }, impactAt + 1800);
    scheduleTotMusicaDualFx(() => {
      clearTotMusicaDualSyncFx();
      syncTotMusicaPersistentStage(latestView);
      renderPanel(latestView);
    }, duration + 60);
  }

  function playSanjiRaidSuitFx(event) {
    if (!event || !refs.sanjiRaidSuitFx) return;
    clearSanjiRaidSuitFx();
    if (refs.sanjiRaidSuitKicker) refs.sanjiRaidSuitKicker.textContent = "GERMA 66";
    if (refs.sanjiRaidSuitTitle) refs.sanjiRaidSuitTitle.textContent = event.title || "戰鬥服變身";
    if (refs.sanjiRaidSuitBefore && event.beforePortrait) refs.sanjiRaidSuitBefore.src = event.beforePortrait;
    if (refs.sanjiRaidSuitFinal && event.finalPortrait) refs.sanjiRaidSuitFinal.src = event.finalPortrait;
    if (refs.sanjiRaidSuitItem && event.itemImage) refs.sanjiRaidSuitItem.src = event.itemImage;
    if (refs.sanjiRaidSuitName) refs.sanjiRaidSuitName.textContent = event.finalName || "隱形黑・Stealth Black";
    if (refs.sanjiRaidSuitEffect) refs.sanjiRaidSuitEffect.textContent = event.effectText || "光學迷彩啟動・戰鬥能力全面提升";
    void refs.sanjiRaidSuitFx.offsetWidth;
    refs.sanjiRaidSuitFx.classList.add("show");
    sanjiRaidSuitFxTimers.push(setTimeout(playStageShake, 2050));
    sanjiRaidSuitFxTimers.push(setTimeout(playStageShake, 2630));
    sanjiRaidSuitFxTimers.push(setTimeout(() => {
      refs.sanjiRaidSuitFx?.classList.remove("show");
    }, Math.max(4200, Number(event.duration || 5000))));
  }

  function clearBulletFusionFx() {
    bulletFusionFxTimers.forEach((timer) => clearTimeout(timer));
    bulletFusionFxTimers = [];
    bulletFusionFlightAnimations.forEach((animation) => animation?.cancel?.());
    bulletFusionFlightAnimations = [];
    refs.bulletFusionFx?.querySelectorAll(".bullet-fusion-flight-item").forEach((node) => node.remove());
    refs.bulletFusionFx?.classList.remove("show");
    refs.bulletFusionEffectBanner?.classList.remove("show", "kyubi");
    if (refs.bulletFusionCrewRail) refs.bulletFusionCrewRail.innerHTML = "";
    if (refs.bulletFusionTargetSockets) refs.bulletFusionTargetSockets.innerHTML = "";
  }

  function scheduleBulletFusionFx(callback, delay) {
    const timer = setTimeout(callback, delay);
    bulletFusionFxTimers.push(timer);
    return timer;
  }

  function showBulletFusionEffect(slot) {
    if (!refs.bulletFusionEffectBanner || !slot?.itemId) return;
    const kyubi = slot.itemId === "devon_kyubi_mask" || slot.effectKind === "force_advantage_attribute";
    refs.bulletFusionEffectBanner.innerHTML = `
      ${slot.itemImage ? `<img src="${escapeHtml(slot.itemImage)}" alt="">` : ""}
      <span><strong>${escapeHtml(slot.itemName || "攜帶物")}</strong>　${escapeHtml(slot.itemSummary || "效果已由巴雷特接管。")}</span>
    `;
    refs.bulletFusionEffectBanner.classList.remove("show", "kyubi");
    void refs.bulletFusionEffectBanner.offsetWidth;
    refs.bulletFusionEffectBanner.classList.add("show");
    refs.bulletFusionEffectBanner.classList.toggle("kyubi", kyubi);
    if (kyubi) {
      showStatus(`${slot.itemName || "九尾幻面"}：巴雷特的攻擊屬性轉為克制目前對手。`);
      playStageShake();
    } else {
      showStatus(`${slot.itemName || "攜帶物"}的效果已由巴雷特接管。`);
    }
  }

  function playBulletFusionFx(event) {
    if (!event || !refs.bulletFusionFx) return;
    clearBulletFusionFx();
    const slots = Array.from({ length: 6 }, (_, index) => event.slots?.[index] || { number: index + 1, label: "空位" });
    const equipped = slots.filter((slot) => slot.itemId && slot.itemImage);
    if (refs.bulletFusionTitle) refs.bulletFusionTitle.textContent = event.title || "合體武裝・六孔裝甲";
    if (refs.bulletFusionTargetIcon) refs.bulletFusionTargetIcon.src = event.iconUrl || "images/board/battle/postgame_mechanic_icons/postgame_douglas_bullet.webp";
    if (refs.bulletFusionTargetSockets) {
      refs.bulletFusionTargetSockets.innerHTML = slots.map((slot, index) => `
        <span class="bullet-fusion-target-socket" data-bullet-fusion-target="${index}">
          ${slot.itemImage ? `<img src="${escapeHtml(slot.itemImage)}" alt="">` : ""}
        </span>
      `).join("");
    }
    if (refs.bulletFusionCrewRail) {
      refs.bulletFusionCrewRail.innerHTML = slots.map((slot, index) => `
        <div class="bullet-fusion-crew-card ${slot.itemId ? "" : "is-empty"}" style="--slot-index:${index}">
          ${slot.cardPortrait ? `<img class="bullet-fusion-crew-portrait" src="${escapeHtml(slot.cardPortrait)}" alt="${escapeHtml(slot.cardName || "船員")}">` : `<div class="bullet-fusion-crew-portrait"></div>`}
          <div class="bullet-fusion-crew-copy">
            <strong>${escapeHtml(slot.cardName || "空位")}</strong>
            <span>${escapeHtml(slot.itemName || "未裝備")}</span>
            ${slot.itemImage ? `<img class="bullet-fusion-source-item" data-bullet-fusion-source="${index}" src="${escapeHtml(slot.itemImage)}" alt="${escapeHtml(slot.itemName || "攜帶物")}">` : ""}
          </div>
        </div>
      `).join("");
    }
    refs.bulletFusionFx.classList.add("show");
    playCutIn(event.title || "合體武裝・六孔裝甲");
    showStatus(equipped.length ? `巴雷特開始吸收 ${equipped.length} 件攜帶物。` : "隊伍沒有裝備攜帶物，六個孔位皆為空。" );
    scheduleBulletFusionFx(() => {
      const stageRect = refs.stage?.getBoundingClientRect?.();
      if (!stageRect) return;
      equipped.forEach((slot, equippedIndex) => {
        const slotIndex = Math.max(0, Number(slot.number || 1) - 1);
        const source = refs.bulletFusionCrewRail?.querySelector(`[data-bullet-fusion-source="${slotIndex}"]`);
        const target = refs.bulletFusionTargetSockets?.querySelector(`[data-bullet-fusion-target="${slotIndex}"]`);
        const sourceRect = source?.getBoundingClientRect?.();
        const targetRect = target?.getBoundingClientRect?.();
        if (!sourceRect || !targetRect) return;
        const flight = document.createElement("img");
        flight.className = "bullet-fusion-flight-item";
        flight.src = slot.itemImage;
        flight.alt = "";
        flight.style.left = `${sourceRect.left - stageRect.left}px`;
        flight.style.top = `${sourceRect.top - stageRect.top}px`;
        refs.bulletFusionFx.appendChild(flight);
        const dx = targetRect.left + targetRect.width * .5 - sourceRect.left - sourceRect.width * .5;
        const dy = targetRect.top + targetRect.height * .5 - sourceRect.top - sourceRect.height * .5;
        const delay = equippedIndex * 210;
        const animation = flight.animate([
          { transform: "translate(0,0) scale(.78) rotate(-12deg)", opacity: 0 },
          { transform: "translate(0,0) scale(1.05) rotate(0deg)", opacity: 1, offset: .16 },
          { transform: `translate(${dx * .52}px,${dy * .35 - 54}px) scale(1.12) rotate(180deg)`, opacity: 1, offset: .58 },
          { transform: `translate(${dx}px,${dy}px) scale(.18) rotate(390deg)`, opacity: .18 },
        ], { duration: 1120, delay, easing: "cubic-bezier(.18,.82,.2,1)", fill: "forwards" });
        bulletFusionFlightAnimations.push(animation);
        scheduleBulletFusionFx(() => {
          target?.classList.add("filled");
          if (source) source.style.opacity = "0";
          playStageShake();
        }, delay + 1010);
        scheduleBulletFusionFx(() => flight.remove(), delay + 1250);
      });
    }, 980);
    equipped.forEach((slot, index) => {
      scheduleBulletFusionFx(() => showBulletFusionEffect(slot), 2450 + index * 470);
    });
    scheduleBulletFusionFx(() => {
      refs.bulletFusionEffectBanner?.classList.remove("show", "kyubi");
      refs.bulletFusionFx?.classList.remove("show");
    }, Math.max(2600, Number(event.duration || 5600)));
  }

  function clearSagaFusionFx() {
    sagaFusionFxTimers.forEach((timer) => clearTimeout(timer));
    sagaFusionFxTimers = [];
    refs.sagaFusionFx?.classList.remove("show", "absorbing", "revealed");
  }

  function clearOarsPurificationFx() {
    oarsPurificationFxTimers.forEach((timer) => clearTimeout(timer));
    oarsPurificationFxTimers = [];
    document.querySelector(".oars-purification-fx")?.remove();
  }

  function scheduleOarsPurificationFx(callback, delay) {
    const timer = setTimeout(callback, delay);
    oarsPurificationFxTimers.push(timer);
    return timer;
  }

  function playOarsPurificationFx(event) {
    if (!event || !refs.stage) return;
    clearOarsPurificationFx();
    const layer = document.createElement("div");
    layer.className = "oars-purification-fx";
    layer.innerHTML = `<div class="oars-purification-flash"></div><img src="images/board/battle/postgame_mechanics/oars/oars_salt_purification.webp" alt=""><div class="oars-purification-shadow"></div>`;
    refs.stage.appendChild(layer);
    void layer.offsetWidth;
    layer.classList.add("show");
    playCutIn(event.title || "巨型鹽彈・影子解放");
    showStatus("十五袋巨型鹽命中歐斯，影子開始脫離巨軀。", 3000);
    scheduleOarsPurificationFx(() => {
      playPortraitAction("enemy", "hit", 900);
      playStageShake();
      spawnBattleDamageNumber({ amount: Number(event.damage || 0), critical: true, targetSide: "enemy", anchorElement: refs.enemyCard });
    }, 1050);
    scheduleOarsPurificationFx(() => {
      setPortraitState("enemy", "dizzy");
      playStageShake();
    }, 2050);
    scheduleOarsPurificationFx(clearOarsPurificationFx, Math.max(3200, Number(event.duration || 3200)));
  }

  function scheduleSagaFusionFx(callback, delay) {
    const timer = setTimeout(callback, delay);
    sagaFusionFxTimers.push(timer);
    return timer;
  }

  function playSagaFusionFx(event) {
    if (!event || !refs.sagaFusionFx) return;
    clearSagaFusionFx();
    if (refs.sagaFusionBefore) refs.sagaFusionBefore.src = event.beforePortrait || "images/board/battle/enemies/postgame_saga/normal.webp";
    if (refs.sagaFusionFinal) refs.sagaFusionFinal.src = event.finalPortrait || "images/board/battle/enemies/postgame_saga/fused_normal.webp";
    if (refs.sagaFusionSword) refs.sagaFusionSword.src = event.swordImage || "images/board/items/postgame_boss_relics/saga_seven_star_sword.webp";
    if (refs.sagaFusionStage) refs.sagaFusionStage.textContent = event.title || "血祭值 75／75";
    if (refs.sagaFusionTitle) refs.sagaFusionTitle.textContent = event.stageText || "七星劍吸滿鮮血";
    if (refs.sagaFusionResult) refs.sagaFusionResult.textContent = event.resultText || "完全融合・最終形態";
    if (refs.sagaFusionEffect) refs.sagaFusionEffect.textContent = event.effectText || "直接攻擊傷害 +50%";
    void refs.sagaFusionFx.offsetWidth;
    refs.sagaFusionFx.classList.add("show");
    playCutIn(event.stageText || "七星劍吸滿鮮血");
    showStatus("血祭值到達 75，七星劍開始融入薩卡身體。", 2700);
    scheduleSagaFusionFx(() => {
      refs.sagaFusionFx?.classList.add("absorbing");
      if (refs.sagaFusionTitle) refs.sagaFusionTitle.textContent = event.fusionText || "七星劍融入薩卡身體";
      playCutIn(event.fusionText || "七星劍融入薩卡身體");
      playStageShake();
    }, 1750);
    scheduleSagaFusionFx(() => {
      refs.sagaFusionFx?.classList.add("revealed");
      if (refs.sagaFusionStage) refs.sagaFusionStage.textContent = event.resultText || "完全融合・最終形態";
      if (refs.sagaFusionTitle) refs.sagaFusionTitle.textContent = event.effectText || "直接攻擊傷害 +50%";
      playCutIn(event.resultText || "完全融合・最終形態");
      showStatus(`${event.actorName || "薩卡"}進入最終形態：${event.effectText || "直接攻擊傷害 +50%"}。`, 2700);
      playStageShake();
    }, 3300);
    scheduleSagaFusionFx(() => clearSagaFusionFx(), Math.max(4800, Number(event.duration || 6200)));
  }

  function clearBlackTurnFx() {
    blackTurnFxTimers.forEach((timer) => clearTimeout(timer));
    blackTurnFxTimers = [];
    refs.blackTurnCastFx?.classList.remove("show", "swap-front", "demonized");
    refs.playerCard?.classList.remove("black-turn-donor");
    refs.enemyCard?.classList.remove("black-turn-receiver");
    refs.stage?.classList.remove("black-turn-casting", "black-turn-front");
    refs.stage?.style.removeProperty("--black-turn-duration");
  }

  function scheduleKyubiMaskFx(callback, delay) {
    const timer = setTimeout(callback, delay);
    kyubiMaskFxTimers.push(timer);
    return timer;
  }

  function scheduleBlackTurnFx(callback, delay) {
    const timer = setTimeout(callback, delay);
    blackTurnFxTimers.push(timer);
    return timer;
  }

  function positionKyubiMaskFxTarget() {
    if (!refs.kyubiMaskFx) return;
    const stageRect = refs.stage?.getBoundingClientRect?.() || { left: 0, top: 0, width: window.innerWidth || 1280, height: window.innerHeight || 720 };
    const targetRect = refs.playerPortraitWrap?.getBoundingClientRect?.() || null;
    const startX = stageRect.width * 0.52;
    const startY = stageRect.height * 0.43;
    const targetX = targetRect ? (targetRect.left + targetRect.width * 0.5 - stageRect.left) : (stageRect.width * 0.26);
    const targetY = targetRect ? (targetRect.top + targetRect.height * 0.48 - stageRect.top) : (stageRect.height * 0.44);
    refs.kyubiMaskFx.style.setProperty("--kyubi-start-x", `${Math.round(startX)}px`);
    refs.kyubiMaskFx.style.setProperty("--kyubi-start-y", `${Math.round(startY)}px`);
    refs.kyubiMaskFx.style.setProperty("--kyubi-target-x", `${Math.round(targetX)}px`);
    refs.kyubiMaskFx.style.setProperty("--kyubi-target-y", `${Math.round(targetY)}px`);
  }

  function playKyubiMaskFx(event, view = latestView) {
    if (!event) return;
    clearKyubiMaskFx();
    activeKyubiMaskEventId = event.id || "";
    const itemName = event.itemName || "九尾幻面";
    const targetAttribute = event.targetAttribute || playerDisplayAttribute(view);
    const startAttribute = event.fromAttribute || view?.activeCard?.naturalAttribute || view?.activeCard?.attribute || "無";
    const attributes = Array.isArray(event.attributes) && event.attributes.length ? event.attributes : KYUBI_MASK_ATTRIBUTES;
    if (refs.kyubiMaskItem) {
      refs.kyubiMaskItem.src = event.itemImage || "images/board/items/devon_kyubi_mask.webp";
      refs.kyubiMaskItem.alt = itemName;
    }
    if (refs.kyubiMaskText) refs.kyubiMaskText.textContent = `${itemName}發動`;
    positionKyubiMaskFxTarget();
    setPlayerAttributeDisplay(startAttribute, view);
    refs.kyubiMaskFx?.classList.remove("show", "cycling", "settled");
    void refs.kyubiMaskFx?.offsetWidth;
    refs.kyubiMaskFx?.classList.add("show");
    playCutIn(`${itemName}發動`);
    showStatus(`${itemName}讓屬性開始幻化。`);
    playStageShake();
    scheduleKyubiMaskFx(() => {
      refs.kyubiMaskFx?.classList.add("cycling");
      let index = 0;
      setPlayerAttributeDisplay(attributes[index % attributes.length], view);
      index += 1;
      kyubiMaskAttrInterval = setInterval(() => {
        setPlayerAttributeDisplay(attributes[index % attributes.length], view);
        index += 1;
      }, 150);
    }, 1180);
    scheduleKyubiMaskFx(() => {
      if (kyubiMaskAttrInterval) clearInterval(kyubiMaskAttrInterval);
      kyubiMaskAttrInterval = null;
      refs.kyubiMaskFx?.classList.add("settled");
      setPlayerAttributeDisplay(targetAttribute, view);
      showStatus(`${itemName}：屬性幻化為 ${targetAttribute}。`);
      playStageShake();
    }, 3180);
    scheduleKyubiMaskFx(() => {
      refs.kyubiMaskFx?.classList.remove("show", "cycling", "settled");
      activeKyubiMaskEventId = "";
    }, Math.max(3400, Number(event.duration || 3300)));
  }

  function blackTurnPortraitUrl(event = {}, preferredKeys = null) {
    const combatant = event.targetCombatant || event.targetSnapshot || event.target || {};
    const portraits = combatant?.battlePortraits || {};
    const keys = Array.isArray(preferredKeys) && preferredKeys.length
      ? preferredKeys
      : ["dizzy", "hit", "hurt", "weak", "angry", "normal", "idle", "portrait"];
    const foundKey = keys.find((key) => portraits[key]);
    return (!preferredKeys && event.targetPortrait) || (foundKey ? portraits[foundKey] : "") || event.targetPortrait || PLACEHOLDER_BATTLE_PORTRAIT;
  }

  function setBlackTurnCastImage(src) {
    const img = refs.blackTurnCastPortrait;
    if (!img) return;
    const fallback = PLACEHOLDER_BATTLE_PORTRAIT;
    const nextSrc = src || fallback;
    img.onerror = null;
    img.onerror = () => {
      img.onerror = null;
      if (img.getAttribute("src") !== fallback) img.src = fallback;
    };
    img.src = nextSrc;
  }

  function setBlackTurnEnemyImage() {
    const img = refs.blackTurnEnemyPortrait;
    if (!img) return;
    const fallback = portraitUrl("enemy", "angry") || portraitUrl("enemy", "normal") || PLACEHOLDER_BATTLE_PORTRAIT;
    const currentSrc = refs.enemyPortrait?.getAttribute("src") || fallback;
    img.onerror = null;
    img.onerror = () => {
      img.onerror = null;
      if (img.getAttribute("src") !== fallback) img.src = fallback;
    };
    img.src = currentSrc || fallback;
  }

  function positionBlackTurnCastFx() {
    if (!refs.blackTurnCastFx) return;
    const stageRect = refs.stage?.getBoundingClientRect?.() || {
      left: 0,
      top: 0,
      width: window.innerWidth || 1280,
      height: window.innerHeight || 720,
    };
    const playerRect = refs.playerCard?.getBoundingClientRect?.() || refs.playerPortraitWrap?.getBoundingClientRect?.() || null;
    const enemyRect = refs.enemyCard?.getBoundingClientRect?.() || refs.enemyPortraitWrap?.getBoundingClientRect?.() || null;
    const startX = playerRect ? (playerRect.left + playerRect.width * 0.5 - stageRect.left) : stageRect.width * 0.26;
    const startY = playerRect ? (playerRect.top + playerRect.height * 0.5 - stageRect.top) : stageRect.height * 0.44;
    const endX = enemyRect ? (enemyRect.left + enemyRect.width * 0.5 - stageRect.left) : stageRect.width * 0.74;
    const endY = enemyRect ? (enemyRect.top + enemyRect.height * 0.5 - stageRect.top) : stageRect.height * 0.44;
    const cardWidth = Math.round(Math.max(160, playerRect?.width || enemyRect?.width || stageRect.width * 0.22));
    const cardHeight = Math.round(Math.max(160, playerRect?.height || enemyRect?.height || cardWidth));
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.max(1, Math.sqrt((dx * dx) + (dy * dy)));
    const unitX = dx / length;
    const unitY = dy / length;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const clearDistance = Math.max(88, Math.min(cardWidth, cardHeight) * 0.58);
    const startExitX = startX + unitX * clearDistance;
    const startExitY = startY + unitY * clearDistance;
    const endEntryX = endX - unitX * clearDistance;
    const endEntryY = endY - unitY * clearDistance;
    const moveStartAt = 12;
    const moveEndAt = 35;
    const moveProgress = (percent) => Math.max(0, Math.min(1, (percent - moveStartAt) / (moveEndAt - moveStartAt)));
    const move30 = moveProgress(30);
    const move30X = startX + dx * move30;
    const move30Y = startY + dy * move30;
    refs.blackTurnCastFx.style.setProperty("--black-turn-start-x", `${Math.round(startX)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-start-y", `${Math.round(startY)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-start-exit-x", `${Math.round(startExitX)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-start-exit-y", `${Math.round(startExitY)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-end-x", `${Math.round(endX)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-end-y", `${Math.round(endY)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-end-entry-x", `${Math.round(endEntryX)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-end-entry-y", `${Math.round(endEntryY)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-move-30-x", `${Math.round(move30X)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-move-30-y", `${Math.round(move30Y)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-line-x", `${Math.round(startX)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-line-y", `${Math.round(startY)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-line-width", `${Math.round(length)}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-line-angle", `${angle.toFixed(2)}deg`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-card-w", `${cardWidth}px`);
    refs.blackTurnCastFx.style.setProperty("--black-turn-card-h", `${cardHeight}px`);
  }

  function playBlackTurnCastFx(event, view = latestView) {
    if (!event) return;
    clearBlackTurnFx();
    const duration = Math.max(8400, Number(event.duration || 8400));
    const targetName = event.targetName || event.targetCombatant?.name || "一名夥伴";
    const title = event.title || event.moveName || "Domi Reversi・黑轉支配";
    if (refs.blackTurnCastText) refs.blackTurnCastText.textContent = `${title}：${targetName}`;
    if (refs.blackTurnDemonCastName) refs.blackTurnDemonCastName.textContent = `黑轉・${targetName}`;
    refs.blackTurnCastFx?.style.setProperty("--black-turn-duration", `${duration}ms`);
    refs.stage?.style.setProperty("--black-turn-duration", `${duration}ms`);
    setBlackTurnCastImage(blackTurnPortraitUrl(event));
    setBlackTurnEnemyImage();
    positionBlackTurnCastFx();
    refs.blackTurnCastFx?.classList.remove("show", "swap-front", "demonized");
    refs.stage?.classList.remove("black-turn-front");
    void refs.blackTurnCastFx?.offsetWidth;
    refs.stage?.classList.add("black-turn-casting");
    refs.blackTurnCastFx?.classList.add("show");
    refs.playerCard?.classList.add("black-turn-donor");
    refs.enemyCard?.classList.add("black-turn-receiver");
    showStatus(`黑霧從 ${targetName} 身後抽出影子。`);
    scheduleBlackTurnFx(() => {
      showStatus(`${targetName} 被拖到伊姆身後。`);
    }, Math.round(duration * 0.24));
    scheduleBlackTurnFx(() => {
      showStatus(`${targetName} 抵達伊姆後方，開始翻轉。`);
    }, Math.round(duration * 0.74));
    scheduleBlackTurnFx(() => {
      refs.stage?.classList.add("black-turn-front");
      refs.blackTurnCastFx?.classList.add("swap-front");
    }, Math.round(duration * 0.8));
    scheduleBlackTurnFx(() => {
      setBlackTurnCastImage(blackTurnPortraitUrl(event, ["angry", "attack", "morale", "normal", "idle", "portrait"]));
      refs.blackTurnCastFx?.classList.add("demonized");
      showStatus(`黑轉框架展開，${targetName} 被支配。`);
    }, Math.round(duration * 0.8));
    scheduleBlackTurnFx(() => {
      showStatus(`伊姆退後，${targetName} 的黑轉支配完成。`);
    }, Math.round(duration * 0.9));
    scheduleBlackTurnFx(() => {
      refs.blackTurnCastFx?.classList.remove("show", "swap-front", "demonized");
      refs.playerCard?.classList.remove("black-turn-donor");
      refs.stage?.classList.remove("black-turn-casting", "black-turn-front");
      refs.stage?.style.removeProperty("--black-turn-duration");
    }, duration + 120);
  }

  function battleIdentityKey(view) {
    if (!view?.battle) return "";
    return [
      view.battle.coopView?.currentPlayerId || view.player?.id || "",
      view.battle.islandId || "",
      view.battle.islandKind || "",
      view.enemy?.key || view.enemy?.name || "",
      view.battle.raidInfo?.phaseIndex ?? "",
      view.battle.raidInfo?.phaseTotal ?? "",
      prebattleIntroRuntimeKey(view),
    ].join("|");
  }

  function resetBattleSessionVisualState(view) {
    const nextKey = battleIdentityKey(view);
    if (!nextKey || nextKey === lastBattleIdentity) return;
    lastBattleIdentity = nextKey;
    lastVisualEventId = "";
    lastRenderedKingFlameOn = null;
    clearTimeout(kingFlameTransitionTimer);
    clearTimeout(kingFlameGuardTimer);
    kingFlameTransitionTimer = null;
    kingFlameGuardTimer = null;
    refs.kingFlameTransition?.classList.remove("is-active", "is-lit", "is-unlit");
    refs.kingFlameGuardFx?.classList.remove("is-active");
    processedLogLength = null;
    visualHpOverride = null;
    completedImpactEventId = "";
    activePrebattleIntroId = "";
    activePrebattleIntroKey = "";
    lastCompletedPrebattleIntroAckKey = "";
    lastCompletedPrebattleIntroAckAt = 0;
    prebattleIntroActive = false;
    phase2DialogueActive = false;
    clearPrebattleIntroTimers();
    clearImpactFxTimers();
    clearKatakuriFutureSightCinematic();
    clearKyubiMaskFx();
    clearBulletFusionFx();
    clearSagaFusionFx();
    clearBlackTurnFx();
    clearStatusIconDelays();
    clearPhase2DialogueTimers();
    clearTimeout(diceFxTimer);
    clearInterval(diceFxInterval);
    clearTimeout(replacementPanelTimer);
    clearTimeout(judgeCloneGuardTimer);
    shikiArchipelagoBreakTimers.forEach((timer) => clearTimeout(timer));
    shikiArchipelagoBreakTimers.clear();
    diceFxTimer = null;
    diceFxInterval = null;
    replacementPanelTimer = null;
    judgeCloneGuardTimer = null;
    shikiArchipelagoRenderKey = "";
    shikiArchipelagoBreakingIslandIds.clear();
    lastJudgeCloneCount = null;
    lastShikiArchipelagoEventSerial = 0;
    if (refs.shikiArchipelagoStage) {
      refs.shikiArchipelagoStage.hidden = true;
      refs.shikiArchipelagoStage.className = "shiki-archipelago-stage";
      refs.shikiArchipelagoStage.innerHTML = "";
    }
    refs.enemyCard?.classList.remove("has-shiki-archipelago");
    if (refs.judgeCloneGuardLayer) {
      refs.judgeCloneGuardLayer.hidden = true;
      refs.judgeCloneGuardLayer.className = "judge-clone-guard-layer";
      refs.judgeCloneGuardLayer.innerHTML = "";
    }
    replacementPanelGateKey = "";
    replacementPanelAutoKoKey = "";
    knockoutHiddenCombatantKeys.player = "";
    knockoutHiddenCombatantKeys.enemy = "";
    playerKnockoutPanelReadyAt = 0;
    refs.speedlinesFx?.classList.remove("show");
    refs.cutInFx?.classList.remove("show");
    if (refs.cutInFx) refs.cutInFx.textContent = "";
    refs.diceBonusFx?.classList.remove("active", "show", "settled", "is-extra-roll", "is-eclipse-third", "has-third-total", "eclipse-impact");
    refs.diceBonusSecondOrb?.classList.remove("show");
    refs.diceBonusThirdOrb?.classList.remove("show");
    clearDamageNumbers();
    raidFxTimers.forEach((timer) => clearTimeout(timer));
    raidFxTimers = [];
    if (playRaidPhaseRewardFx.spinTicker) {
      clearInterval(playRaidPhaseRewardFx.spinTicker);
      playRaidPhaseRewardFx.spinTicker = null;
    }
    refs.raidPhaseFx?.classList.remove("show", "settled");
  }

  function scheduleImpactFx(callback, delay) {
    const timer = setTimeout(callback, delay);
    impactFxTimers.push(timer);
    return timer;
  }

  function applyDisplayedHitDamage(targetSide, damage) {
    const override = currentVisualHpOverride();
    if (!override) return;
    const amount = Math.max(0, Math.round(Number(damage || 0)));
    if (targetSide === "player") {
      override.playerHp = Math.max(override.finalPlayerHp, Math.max(0, override.playerHp - amount));
    } else {
      override.enemyHp = Math.max(override.finalEnemyHp, Math.max(0, override.enemyHp - amount));
    }
    renderHud(latestView);
  }

  function finishDisplayedAttackHp(eventId) {
    if (visualHpOverride?.eventId === eventId) {
      visualHpOverride.playerHp = visualHpOverride.finalPlayerHp;
      visualHpOverride.enemyHp = visualHpOverride.finalEnemyHp;
    }
    completedImpactEventId = eventId || completedImpactEventId;
    renderHud(latestView);
    renderShikiArchipelago(latestView?.battle?.postgameBossMechanic);
    visualHpOverride = null;
  }

  function playCutIn(text) {
    if (!refs.cutInFx || !text) return;
    refs.cutInFx.textContent = text;
    restartAnimation(refs.cutInFx, "show");
  }

  function playSwitchInFx(event = {}) {
    const side = event.side === "enemy" ? "enemy" : "player";
    const card = side === "player" ? refs.playerCard : refs.enemyCard;
    const title = event.title || (event.toName ? `換上 ${event.toName}！` : "夥伴上場！");
    const subtitle = event.subtitle || "";
    clearInactiveActionPose(side);
    clearTimeout(portraitTimers[side]);
    card?.classList.remove("portrait-switch-in");
    void card?.offsetWidth;
    card?.classList.add("portrait-switch-in");
    playCutIn(title);
    showStatus(subtitle || title);
    portraitTimers[side] = setTimeout(() => {
      card?.classList.remove("portrait-switch-in");
      setPortraitState(side, "normal");
    }, Math.max(900, Number(event.duration || 1800)));
  }

  function openingPassiveEffectKind(event = {}) {
    const moveType = String(event.moveType || "").toLowerCase();
    const text = `${event.effectText || ""}${event.detail || ""}`;
    if (moveType === "debuff" || moveType === "control" || /^敵方/.test(text)) return "debuff";
    if (/攻擊/.test(text)) return "attack";
    if (/防禦|護盾|減傷/.test(text)) return "defense";
    if (/速度|命中|閃避/.test(text)) return "speed";
    if (/回復|治療/.test(text)) return "heal";
    return "speed";
  }

  function playOpeningPassiveFx(event = {}) {
    const side = eventActorSide(event) || "player";
    const moveType = String(event.moveType || "").toLowerCase();
    const targetSide = event.targetSide === "enemy" || event.targetSide === "player"
      ? event.targetSide
      : (moveType === "debuff" || moveType === "control" ? oppositeSide(side) : side);
    const isDebuff = targetSide !== side || moveType === "debuff" || moveType === "control";
    const effectText = event.effectText || event.detail || (isDebuff ? "能力下降" : "能力提升");
    const title = event.passiveName || event.title || "開場被動";
    const actorPrefix = event.actorName ? `${event.actorName}：` : "";
    const hold = Math.max(1400, Number(event.duration || 1850));

    clearInactiveActionPose(side);
    // Debuff passives may use an attack pose (for example Roger releasing Haki),
    // but the passive event remains cosmetic-only: no hit pose, damage number or HP change.
    playPortraitAction(side, isDebuff ? "attack" : "morale", hold);
    playCutIn(`${actorPrefix}${title}`);
    showStatus(`開場被動：${effectText}`);
    scheduleImpactFx(() => {
      playStatusEffectFx(targetSide, {
        kind: openingPassiveEffectKind(event),
        direction: isDebuff ? "down" : "up",
        label: effectText,
        eventId: event.id,
      });
    }, 420);
  }

  function playSpeedlines() {
    restartAnimation(refs.speedlinesFx, "show");
  }

  function diceThemeForEvent(event = {}) {
    const moveType = String(event.moveType || "").toLowerCase();
    const theme = String(event.theme || "").toLowerCase();
    if (["heal", "buff", "shield", "support"].includes(moveType) || theme === "heal") return "heal";
    if (["debuff", "control", "status"].includes(moveType) || theme === "debuff") return "debuff";
    if (["escape", "move", "speed"].includes(moveType) || theme === "move") return "speed";
    if (isAttackLikeMoveType(moveType) || ["battle", "combo", "attack"].includes(theme)) return "attack";
    return "skill";
  }

  function applyDiceFxTheme(event = {}) {
    const theme = diceThemeForEvent(event);
    refs.diceBonusFx?.classList.remove("theme-attack", "theme-heal", "theme-speed", "theme-debuff", "theme-skill");
    refs.diceBonusFx?.classList.add(`theme-${theme}`);
    return theme;
  }

  function diceRollingText(theme) {
    if (theme === "heal") return "支援判定中...";
    if (theme === "debuff") return "妨害判定中...";
    if (theme === "speed") return "脫離判定中...";
    if (theme === "attack") return "攻擊判定中...";
    return "效果判定中...";
  }

  function diceSettledText(theme) {
    if (theme === "heal") return "支援效果確認...";
    if (theme === "debuff") return "妨害效果確認...";
    if (theme === "speed") return "行動結果確認...";
    if (theme === "attack") return "看清楚點數後計算傷害...";
    return "看清楚點數後計算效果...";
  }

  function diceSideLabel(event = {}) {
    const label = String(event.sideLabel || "").trim();
    if (!label || /^(我方|敵方)$/.test(label)) return "";
    return label.replace(/^(我方|敵方)\s*/, "");
  }

  function diceActorName(event = {}) {
    const explicitName = String(event.actorName || "").trim();
    if (explicitName) return explicitName;
    const title = String(event.title || "");
    const titleName = title.match(/^(.+?)(?:\s+使用|\s+嘗試| 的|：)/)?.[1]?.trim();
    if (titleName && !/^(我方|敵方|戰鬥型被動|追加戰鬥骰)$/.test(titleName)) return titleName;
    if (event.side === "player") return latestView?.activeCard?.name || latestView?.player?.name || "";
    if (event.side === "enemy") return latestView?.enemy?.name || "敵人";
    return "";
  }

  function diceActorPrefix(event = {}) {
    const sideLabel = diceSideLabel(event);
    const actorName = diceActorName(event);
    if (sideLabel && actorName) return `${sideLabel} ${actorName}`;
    return actorName || sideLabel;
  }

  function diceRollingTitle(event = {}) {
    const prefix = diceActorPrefix(event);
    const title = String(event.title || "骰子加成");
    if (Number(event.extraDiceOrdinal || 0) === 3) return prefix ? `${prefix}：日蝕・第三顆戰鬥骰` : "日蝕・第三顆戰鬥骰";
    if (event.isExtraDice) return prefix ? `${prefix}：追加戰鬥骰` : title;
    const actorName = diceActorName(event);
    if (prefix && actorName && !title.includes(actorName)) return `${prefix}：${title}`;
    const sideLabel = diceSideLabel(event);
    return sideLabel ? `${sideLabel}：${title}` : title;
  }

  function diceRollingSubtitle(event = {}, theme) {
    if (event.isExtraDice) {
      const reason = String(event.extraDiceReason || "追加骰").trim();
      const threshold = event.triggerThreshold || "?";
      if (Number(event.extraDiceOrdinal || 0) === 3) {
        return `${reason}觸發：第二顆 ${event.secondDie || "?"} 達到 ${threshold}+，正在骰第三顆。`;
      }
      const firstDie = event.firstDie || "?";
      return `${reason}觸發：第一顆 ${firstDie} 達到 ${threshold}+，正在骰第二顆。`;
    }
    const rawSubtitle = String(event.subtitle || "");
    return rawSubtitle && !rawSubtitle.includes("決定招式最終效果")
      ? rawSubtitle
      : diceRollingText(theme);
  }

  function resolvedDiceTotal(event = {}) {
    const first = Math.max(0, Number(event.firstDie || 0));
    const second = Math.max(0, Number(event.secondDie || 0));
    const third = Math.max(0, Number(event.thirdDie || 0));
    if (first && second && (third || event.type === "bonus")) return first + second + third;
    return Math.max(0, Number(event.settle || 0));
  }

  function resolvedDiceEvent(event = {}) {
    const total = resolvedDiceTotal(event);
    if (!total) return event;
    const bonusText = String(event.bonusText || "");
    const staleSettle = Math.max(0, Number(event.settle || 0));
    const correctedBonusText = bonusText.match(/總點數\s*\d+/)
      ? bonusText.replace(/總點數\s*\d+/, `總點數 ${total}`)
      : staleSettle && staleSettle !== total
        ? bonusText.replace(/\d+/, String(total))
        : bonusText;
    return {
      ...event,
      settle: total,
      bonusText: correctedBonusText,
    };
  }

  function resolvedDiceSummary(event = {}) {
    const displayEvent = resolvedDiceEvent(event);
    const faces = [displayEvent.firstDie, displayEvent.secondDie, displayEvent.thirdDie]
      .map((value) => Math.max(0, Number(value || 0)))
      .filter(Boolean);
    if (faces.length < 2) return displayEvent.bonusText || displayEvent.title || "加成確認";
    const total = resolvedDiceTotal(displayEvent);
    const effectText = String(displayEvent.bonusText || "")
      .replace(/^總點數\s*\d+\s*[，,]?\s*/, "")
      .trim();
    return `${faces.join(" + ")} = ${total}${effectText ? `，${effectText}` : ""}`;
  }

  function diceSettledTitleForEvent(event = {}) {
    const prefix = diceActorPrefix(event);
    const settle = resolvedDiceTotal(event) || "?";
    if (Number(event.extraDiceOrdinal || 0) === 3 && event.isExtraDice) {
      return prefix ? `${prefix}：第三顆骰出 ${settle}` : `第三顆骰出 ${settle}`;
    }
    if (event.firstDie && event.secondDie && event.thirdDie) {
      return prefix
        ? `${prefix}：${event.firstDie} + ${event.secondDie} + ${event.thirdDie} = ${settle}`
        : `${event.firstDie} + ${event.secondDie} + ${event.thirdDie} = ${settle}`;
    }
    if (event.firstDie && event.secondDie) {
      return prefix ? `${prefix}：${event.firstDie} + ${event.secondDie} = ${settle}` : `${event.firstDie} + ${event.secondDie} = ${settle}`;
    }
    if (event.isExtraDice) return prefix ? `${prefix}：追加骰出 ${settle}` : `追加骰出 ${settle}`;
    return prefix ? `${prefix}：骰出 ${settle}` : `骰出 ${settle}`;
  }

  function diceSettledSubtitleForEvent(event = {}, theme) {
    const displayEvent = resolvedDiceEvent(event);
    if (Number(event.extraDiceOrdinal || 0) === 3 && event.isExtraDice) {
      const reason = String(event.extraDiceReason || "名刀『日蝕』").trim();
      return `${reason}：第二顆 ${event.secondDie || "?"} + 第三顆 ${event.settle || "?"}，接著三顆合計倍率。`;
    }
    if (event.firstDie && event.secondDie && event.thirdDie) {
      const reason = event.extraDiceReason ? `${event.extraDiceReason}，` : "";
      return `${reason}${displayEvent.bonusText || "三顆相加計算倍率"}`;
    }
    if (event.firstDie && event.secondDie) {
      const reason = event.extraDiceReason ? `${event.extraDiceReason}，` : "";
      return `${reason}${displayEvent.bonusText || "兩顆相加計算倍率"}`;
    }
    if (event.isExtraDice) {
      const reason = String(event.extraDiceReason || "追加骰").trim();
      return `${reason}：第一顆 ${event.firstDie || "?"} + 第二顆 ${event.settle || "?"}，接著合計倍率。`;
    }
    return event.bonusText || diceSettledText(theme);
  }

  function clearDiceTicker() {
    clearInterval(diceFxInterval);
    diceFxInterval = null;
  }

  function setDiceOrbValue(orb, value) {
    if (!orb) return;
    const valueNode = orb.querySelector(".dice-bonus-value");
    if (valueNode) {
      valueNode.textContent = String(value);
      return;
    }
    orb.textContent = String(value);
  }

  function startDiceTicker(maxFace) {
    const faceCount = Math.max(1, Number(maxFace || 6));
    diceFxInterval = setInterval(() => {
      setDiceOrbValue(refs.diceBonusOrb, Math.floor(Math.random() * faceCount) + 1);
    }, 78);
  }

  const PORTRAIT_EFFECT_CLASSES = [
    "effect-fx",
    "effect-up",
    "effect-down",
    "effect-heal",
    "effect-attack",
    "effect-defense",
    "effect-speed",
    "effect-debuff",
    "effect-shield",
  ];
  const IMPACT_EFFECT_CLASSES = ["effect-heal", "effect-attack", "effect-defense", "effect-speed", "effect-debuff", "effect-shield"];
  const HIT_IMPACT_EFFECT_CLASSES = ["has-hit-image", "is-heavy-hit", "is-combo-hit", "is-directional-slash", "from-player", "from-enemy"];
  const DIRECTIONAL_HIT_EFFECT_FILES = new Set(["slash_single.webp", "slash_multi.webp", "wind_slash.webp"]);

  function normalizedHitEffectFile(fileName = "") {
    const cleanName = String(fileName || "").split(/[\\/]/).pop();
    return HIT_EFFECT_FILE_SET.has(cleanName) ? cleanName : "";
  }

  function isDirectionalSlashHitEffect(fileName = "") {
    const cleanName = normalizedHitEffectFile(fileName);
    return cleanName && DIRECTIONAL_HIT_EFFECT_FILES.has(cleanName);
  }

  function inferHitEffectFile(event = {}, hitIndex = 0, hitCount = 1) {
    const explicit = normalizedHitEffectFile(event.hitEffect || event.hitEffectFile || event.hitEffectId);
    if (explicit) return explicit;
    const text = [
      event.moveName,
      event.moveType,
      event.effectFx?.label,
      event.effectFx?.kind,
    ].filter(Boolean).join(" ");
    const lower = text.toLowerCase();
    const has = (...tokens) => tokens.some((token) => text.includes(token) || lower.includes(String(token).toLowerCase()));
    if (hitCount > 1) {
      if (has("斬", "刀", "劍", "刃", "slash", "blade")) return "slash_multi.webp";
      if (has("踢", "腳", "shot", "kick")) return "kick_mark.webp";
      if (has("射", "彈", "星", "狙", "bullet")) return "bullet_sparks.webp";
      return "punch_combo.webp";
    }
    if (has("火", "炎", "灼", "燒", "fire", "burn")) return "fire_impact.webp";
    if (has("雷", "電", "thunder", "lightning")) return "lightning_hit.webp";
    if (has("冰", "寒", "凍", "ice", "frost")) return "ice_impact.webp";
    if (has("毒", "poison")) return "poison_splash.webp";
    if (has("水", "海流", "魚人", "water")) return "water_splash.webp";
    if (has("暗", "影", "幽靈", "靈魂", "dark", "ghost")) return "dark_impact.webp";
    if (has("風", "龍捲", "嵐腳", "疾風", "暴風", "wind", "storm")) return "wind_slash.webp";
    if (has("衝擊", "六王槍", "震波", "shockwave")) return "shockwave_ring.webp";
    if (has("爆", "炸", "砲", "炮", "雷射", "流星", "explosion")) return "explosion_burst.webp";
    if (has("斬", "刀", "劍", "刃", "居合", "slash", "blade")) return "slash_single.webp";
    if (has("踢", "腳", "SHOT", "kick")) return "kick_mark.webp";
    if (has("射擊", "子彈", "彈", "星", "狙", "bullet")) return "bullet_hit.webp";
    if (has("刺", "突刺", "指槍", "矛", "注射", "槍", "pierce", "spear")) return "pierce_mark.webp";
    if (has("鎚", "錘", "重擊", "鈍", "blunt")) return "blunt_crack.webp";
    if (has("拳", "掌", "打擊", "撞擊", "橡膠", "punch", "fist")) return "punch_mark.webp";
    return hitIndex > 0 ? "punch_combo.webp" : "punch_mark.webp";
  }

  function positionImpactFx(targetSide = "", anchorElement = null) {
    if (!refs.impactFx) return;
    const anchorRect = anchorElement?.getBoundingClientRect?.();
    const stageRect = refs.stage?.getBoundingClientRect?.();
    if (anchorRect?.width > 0 && anchorRect?.height > 0 && stageRect?.width > 0 && stageRect?.height > 0) {
      refs.impactFx.style.left = `${anchorRect.left - stageRect.left + anchorRect.width * .5}px`;
      refs.impactFx.style.top = `${anchorRect.top - stageRect.top + anchorRect.height * .38}px`;
      return;
    }
    const target = targetSide === "player" ? "player" : targetSide === "enemy" ? "enemy" : "";
    refs.impactFx.style.left = target === "enemy" ? "74%" : target === "player" ? "26%" : "50%";
    refs.impactFx.style.top = target === "enemy" ? "38%" : target === "player" ? "42%" : "48%";
  }

  function warmHitEffectImages() {
    HIT_EFFECT_FILES.forEach((fileName, index) => {
      setTimeout(() => {
        const image = new Image();
        image.src = `${HIT_EFFECT_BASE_PATH}${fileName}`;
      }, 300 + index * 55);
    });
  }

  function effectKind(effectFx = {}) {
    const kind = String(effectFx.kind || "").toLowerCase();
    if (kind === "heal") return "heal";
    if (kind === "attack" || kind === "atk") return "attack";
    if (kind === "defense" || kind === "def" || kind === "shield") return kind === "shield" ? "shield" : "defense";
    if (kind === "speed" || kind === "spd") return "speed";
    if (kind === "debuff" || kind === "status" || kind === "control") return "debuff";
    return "speed";
  }

  function effectColor(kind) {
    if (kind === "heal") return "78, 231, 145";
    if (kind === "attack") return "255, 87, 80";
    if (kind === "defense" || kind === "shield") return "84, 171, 255";
    if (kind === "speed") return "255, 218, 73";
    if (kind === "debuff") return "169, 104, 255";
    return "255, 218, 73";
  }

  function clearPortraitEffectFx(card) {
    if (!card) return;
    card.querySelectorAll(".effect-particle-layer").forEach((layer) => layer.remove());
    card.classList.remove(...PORTRAIT_EFFECT_CLASSES);
    card.style.removeProperty("--effect-color");
    card.removeAttribute("data-effect-label");
  }

  function clearAllPortraitEffectFx() {
    clearPortraitEffectFx(refs.playerCard);
    clearPortraitEffectFx(refs.enemyCard);
  }

  function setImpactEffect(kind, hitEffectFile = "") {
    refs.impactFx?.classList.remove(...IMPACT_EFFECT_CLASSES, ...HIT_IMPACT_EFFECT_CLASSES);
    refs.impactFx?.style.removeProperty("--hit-effect-url");
    refs.impactFx?.style.removeProperty("--hit-rotation");
    refs.impactFx?.style.removeProperty("--hit-scale-x");
    refs.impactFx?.style.removeProperty("--slash-start-x");
    refs.impactFx?.style.removeProperty("--slash-mid-x");
    refs.impactFx?.style.removeProperty("--slash-end-x");
    refs.impactFx?.style.removeProperty("--slash-fade-x");
    const normalizedFile = normalizedHitEffectFile(hitEffectFile);
    if (normalizedFile) {
      refs.impactFx?.classList.add("has-hit-image");
      refs.impactFx?.style.setProperty("--hit-effect-url", `url("${HIT_EFFECT_BASE_PATH}${normalizedFile}")`);
    }
    if (kind) refs.impactFx?.classList.add(`effect-${kind}`);
  }

  function setDirectionalImpactEffect(actorSide, targetSide, hitEffectFile = "") {
    if (!refs.impactFx || !isDirectionalSlashHitEffect(hitEffectFile)) return;
    const fromEnemy = actorSide === "enemy" && targetSide === "player";
    const fromPlayer = actorSide === "player" && targetSide === "enemy";
    if (!fromEnemy && !fromPlayer) return;
    refs.impactFx.classList.add("is-directional-slash", fromEnemy ? "from-enemy" : "from-player");
    refs.impactFx.style.setProperty("--hit-scale-x", fromEnemy ? "-1" : "1");
    refs.impactFx.style.setProperty("--slash-start-x", fromEnemy ? "82px" : "-82px");
    refs.impactFx.style.setProperty("--slash-mid-x", fromEnemy ? "-10px" : "10px");
    refs.impactFx.style.setProperty("--slash-end-x", fromEnemy ? "-24px" : "24px");
    refs.impactFx.style.setProperty("--slash-fade-x", fromEnemy ? "-48px" : "48px");
  }

  const STATUS_PARTICLE_TUNING = {
    duration: 700,
    distance: 206,
    strength: 1,
    spread: 2.2,
    blur: 3,
    glow: 5,
    particleSpeed: 0.5,
    particleCount: 56,
    particleSize: 2.4,
  };

  const STATUS_EFFECT_SFX = {
    up: "audio/board_game/sfx/game01/game01/powerup05.mp3",
    down: "audio/board_game/sfx/game01/game01/powerdown04.mp3",
  };
  const STATUS_EFFECT_SFX_DELAY_MS = 500;

  const statusEffectAudioPools = { up: [], down: [] };
  const castEffectAudioPools = {};
  const hitEffectAudioPools = {};

  function playStatusEffectSound(direction) {
    if (lucciRokuoganEffectAudioSilenced) return;
    const key = direction === "down" ? "down" : "up";
    const src = STATUS_EFFECT_SFX[key];
    if (!src) return;
    try {
      const pool = statusEffectAudioPools[key];
      let audio = pool.find((entry) => entry.paused || entry.ended);
      if (!audio) {
        audio = new Audio(src);
        audio.preload = "auto";
        audio.volume = 0.22;
        pool.push(audio);
        if (pool.length > 4) pool.shift();
      }
      audio.currentTime = 0;
      audio.volume = 0.22;
      const playPromise = audio.play();
      if (playPromise?.catch) playPromise.catch(() => {});
    } catch (_error) {
      // Audio is optional; browser autoplay/file restrictions should not block battle visuals.
    }
  }

  function playHitEffectSound(src, options = {}) {
    if (!src || (lucciRokuoganEffectAudioSilenced && !options.allowDuringRokuogan)) return;
    try {
      const key = String(src);
      const pool = hitEffectAudioPools[key] || (hitEffectAudioPools[key] = []);
      let audio = pool.find((entry) => entry.paused || entry.ended);
      if (!audio) {
        audio = new Audio(src);
        audio.preload = "auto";
        audio.volume = 0.16;
        pool.push(audio);
        if (pool.length > 5) pool.shift();
      }
      audio.currentTime = 0;
      audio.volume = 0.16;
      const playPromise = audio.play();
      if (playPromise?.catch) playPromise.catch(() => {});
    } catch (_error) {
      // Hit sounds are optional and should never block the animation.
    }
  }

  function playCastEffectSound(src) {
    if (!src || lucciRokuoganEffectAudioSilenced) return;
    try {
      const key = String(src);
      const pool = castEffectAudioPools[key] || (castEffectAudioPools[key] = []);
      let audio = pool.find((entry) => entry.paused || entry.ended);
      if (!audio) {
        audio = new Audio(src);
        audio.preload = "auto";
        audio.volume = 0.12;
        pool.push(audio);
        if (pool.length > 4) pool.shift();
      }
      audio.currentTime = 0;
      audio.volume = 0.12;
      const playPromise = audio.play();
      if (playPromise?.catch) playPromise.catch(() => {});
    } catch (_error) {
      // Cast sounds are optional and should never block dice animation.
    }
  }

  function renderPortraitParticles(card, direction) {
    const wrap = card?.querySelector(".portrait-wrap");
    if (!wrap) return;
    wrap.querySelectorAll(".effect-particle-layer").forEach((layer) => layer.remove());
    const layer = document.createElement("div");
    layer.className = "effect-particle-layer";
    const tuning = STATUS_PARTICLE_TUNING;
    const particleCount = tuning.particleCount;
    for (let index = 0; index < particleCount; index += 1) {
      const particle = document.createElement("i");
      particle.className = "effect-particle";
      const x = 10 + ((index * 23) % 80);
      const ySeed = (index * 17) % 42;
      const y = direction === "down" ? -18 - ySeed : 104 + ySeed;
      const size = (3.8 + (index % 5)) * tuning.particleSize;
      const delay = ((index * 97) % Math.max(360, tuning.duration * 0.72)) + Math.floor(index / 6) * 48;
      const duration = Math.max(260, (tuning.duration * (0.72 + ((index * 7) % 36) / 100)) / tuning.particleSpeed);
      const distance = Math.max(52, tuning.distance * (1.75 + ((index * 5) % 48) / 100));
      const opacity = Math.min(1, tuning.strength * (0.86 + (index % 5) * 0.05));
      particle.style.setProperty("--particle-x", `${50 + (x - 50) * tuning.spread}%`);
      particle.style.setProperty("--particle-y", `${y}%`);
      particle.style.setProperty("--particle-size", `${size}px`);
      particle.style.setProperty("--particle-delay", `${Math.round(delay)}ms`);
      particle.style.setProperty("--particle-duration", `${Math.round(duration)}ms`);
      particle.style.setProperty("--particle-distance", `${Math.round(distance)}px`);
      particle.style.setProperty("--particle-opacity", opacity.toFixed(2));
      layer.appendChild(particle);
    }
    wrap.appendChild(layer);
  }

  function playStatusEffectFx(targetSide, effectFx = {}) {
    const side = targetSide === "enemy" ? "enemy" : "player";
    const card = side === "enemy" ? refs.enemyCard : refs.playerCard;
    if (!card) return;
    const kind = effectKind(effectFx);
    const direction = effectFx.direction === "down" || kind === "debuff" ? "down" : "up";
    clearPortraitEffectFx(card);
    card.style.setProperty("--effect-color", effectColor(kind));
    card.style.setProperty("--effect-blur", `${STATUS_PARTICLE_TUNING.blur}px`);
    card.style.setProperty("--effect-glow-small", `${Math.round(10 * STATUS_PARTICLE_TUNING.glow)}px`);
    card.style.setProperty("--effect-glow-mid", `${Math.round(24 * STATUS_PARTICLE_TUNING.glow)}px`);
    card.style.setProperty("--effect-glow-big", `${Math.round(42 * STATUS_PARTICLE_TUNING.glow)}px`);
    card.dataset.effectLabel = effectFx.label || "";
    void card.offsetWidth;
    card.classList.add("effect-fx", `effect-${direction}`, `effect-${kind}`);
    renderPortraitParticles(card, direction);
    setTimeout(() => playStatusEffectSound(direction), STATUS_EFFECT_SFX_DELAY_MS);
    if (effectFx.eventId) {
      scheduleImpactFx(() => releaseStatusIconDelay(side, effectFx.eventId), 260);
    }
    scheduleImpactFx(() => clearPortraitEffectFx(card), 3000);
  }

  function clearKatakuriFutureSightCinematic() {
    clearTimeout(katakuriFutureSightTimer);
    katakuriFutureSightTimer = null;
    activeKatakuriFutureSightEventId = "";
    if (refs.katakuriFutureSightVideo) {
      if (katakuriFutureSightLoadedHandler) refs.katakuriFutureSightVideo.removeEventListener("loadedmetadata", katakuriFutureSightLoadedHandler);
      katakuriFutureSightLoadedHandler = null;
      refs.katakuriFutureSightVideo.pause();
      refs.katakuriFutureSightVideo.removeAttribute("src");
      refs.katakuriFutureSightVideo.load();
      refs.katakuriFutureSightVideo.muted = false;
    }
    if (refs.katakuriFutureSightCinematic) refs.katakuriFutureSightCinematic.hidden = true;
  }

  function playKatakuriFutureSightCinematic(event) {
    if (!event?.id || !refs.katakuriFutureSightCinematic || !refs.katakuriFutureSightVideo) return false;
    if (activeKatakuriFutureSightEventId === event.id && !refs.katakuriFutureSightCinematic.hidden) return true;
    clearKatakuriFutureSightCinematic();
    activeKatakuriFutureSightEventId = event.id;
    refs.katakuriFutureSightTitle.textContent = event.title || "預知未來";
    refs.katakuriFutureSightCinematic.hidden = false;
    const video = refs.katakuriFutureSightVideo;
    const startTime = Math.max(0, Number(event.videoStartTime || 0));
    const startVideo = () => {
      katakuriFutureSightLoadedHandler = null;
      try {
        video.currentTime = Math.min(startTime, Math.max(0, Number(video.duration || startTime + .1) - .1));
      } catch (_error) {
        // Metadata can finish a frame later; playback can still begin from the source start.
      }
      video.volume = .78;
      video.muted = false;
      const playPromise = video.play();
      if (playPromise?.catch) {
        playPromise.catch(() => {
          video.muted = true;
          video.play().catch(() => {});
        });
      }
    };
    video.src = event.videoUrl || "videos/board/postgame_bosses/katakuri/future_sight_red_eyes.mp4";
    video.load();
    if (video.readyState >= 1) startVideo();
    else {
      katakuriFutureSightLoadedHandler = startVideo;
      video.addEventListener("loadedmetadata", startVideo, { once: true });
    }
    katakuriFutureSightTimer = setTimeout(() => {
      if (activeKatakuriFutureSightEventId === event.id) clearKatakuriFutureSightCinematic();
    }, Math.max(600, Number(event.duration || 4800)));
    return true;
  }

  function playDiceFx(event) {
    event = resolvedDiceEvent(event);
    clearTimeout(diceFxTimer);
    clearDiceTicker();
    const diceTheme = applyDiceFxTheme(event);
    const isEclipseThird = Number(event.extraDiceOrdinal || 0) === 3;
    refs.diceBonusFx?.classList.toggle("is-extra-roll", !!event.isExtraDice);
    refs.diceBonusFx?.classList.toggle("is-eclipse-third", isEclipseThird);
    refs.diceBonusFx?.classList.remove("has-third-total");
    refs.diceBonusFx?.classList.remove("eclipse-impact");
    refs.diceBonusFx.style.opacity = "";
    refs.diceBonusFx.style.transform = "";
    refs.diceBonusTitle.textContent = diceRollingTitle(event);
    refs.diceBonusSubtitle.textContent = diceRollingSubtitle(event, diceTheme);
    setDiceOrbValue(refs.diceBonusOrb, "?");
    if (refs.diceBonusSecondOrb) {
      setDiceOrbValue(refs.diceBonusSecondOrb, "?");
      refs.diceBonusSecondOrb.classList.remove("show", "rolling", "settled");
    }
    if (refs.diceBonusThirdOrb) {
      setDiceOrbValue(refs.diceBonusThirdOrb, "?");
      refs.diceBonusThirdOrb.classList.remove("show", "rolling", "settled");
    }
    refs.diceBonusOrb.classList.add("rolling");
    refs.diceBonusOrb.classList.remove("settled");
    refs.diceBonusFx.classList.remove("settled");
    refs.diceBonusFx.classList.add("active");
    playCastEffectSound(event.castSfx);
    const maxFace = Number(event.maxFace || 6);
    const isResolvedTotal = event.type === "bonus" && event.firstDie && event.secondDie;
    const diceDuration = isResolvedTotal ? 90 : Math.max(1200, Number(event.duration || 1450));
    const resultHold = isResolvedTotal
      ? Math.max(720, Number(event.duration || 1800) - diceDuration)
      : 480;
    startDiceTicker(maxFace);
    diceFxTimer = setTimeout(() => {
      clearDiceTicker();
      refs.diceBonusOrb.classList.remove("rolling");
      refs.diceBonusOrb.classList.add("settled");
      refs.diceBonusFx.classList.add("settled");
      refs.diceBonusFx.style.opacity = "1";
      refs.diceBonusFx.style.transform = "translate(-50%, -50%) scale(1) rotate(0deg)";
      setDiceOrbValue(refs.diceBonusOrb, event.settle || "?");
      if (isEclipseThird) {
        refs.diceBonusFx.classList.add("eclipse-impact");
        playStageShake();
      }
      if (!isEclipseThird && event.firstDie && event.secondDie && refs.diceBonusSecondOrb) {
        setDiceOrbValue(refs.diceBonusOrb, event.firstDie);
        setDiceOrbValue(refs.diceBonusSecondOrb, event.secondDie);
        refs.diceBonusSecondOrb.classList.add("show", "settled");
        refs.diceBonusTitle.textContent = diceSettledTitleForEvent(event);
        refs.diceBonusSubtitle.textContent = diceSettledSubtitleForEvent(event, diceTheme);
      } else {
        refs.diceBonusTitle.textContent = diceSettledTitleForEvent(event);
        refs.diceBonusSubtitle.textContent = diceSettledSubtitleForEvent(event, diceTheme);
      }
      diceFxTimer = setTimeout(() => {
        refs.diceBonusFx.classList.remove("active");
        refs.diceBonusFx.classList.remove("settled");
        refs.diceBonusFx.classList.remove("is-extra-roll");
        refs.diceBonusFx.classList.remove("is-eclipse-third", "has-third-total", "eclipse-impact");
        refs.diceBonusOrb.classList.remove("settled");
        refs.diceBonusSecondOrb?.classList.remove("show", "settled");
        refs.diceBonusThirdOrb?.classList.remove("show", "settled");
        refs.diceBonusFx.style.opacity = "";
        refs.diceBonusFx.style.transform = "";
      }, resultHold);
    }, diceDuration);
  }

  function previewMovePortrait(moveType) {
    if (moveType === "attack" || moveType === "special") {
      clearTimeout(portraitTimers.player);
      setPortraitState("player", "angry");
      return;
    }
    if (moveType === "heal" || moveType === "buff" || moveType === "shield") {
      playPortraitAction("player", "morale", 1450);
      return;
    }
    if (moveType === "debuff" || moveType === "control") {
      playPortraitAction("player", "angry", 1450);
    }
  }

  function playImpactFx(event) {
    clearImpactFxTimers(event.type !== "attack");
    if (event.type === "attack" && event.specialFx === "lucci-rokuogan" && playLucciRokuoganFx(event)) return;
    const side = eventActorSide(event);
    if (!side) return;
    const defender = event.type === "attack" ? attackTargetSide(event) : oppositeSide(side);
    const moveType = event.moveType || event.type;
    const effectFx = event.effectFx || null;
    const defaultTargetSide = event.type === "attack"
      ? defender
      : (event.type === "heal" || event.amount ? side : (moveType === "debuff" || moveType === "control" ? defender : side));
    const explicitTargetSide = event.targetSide === "player" || event.targetSide === "enemy" ? event.targetSide : "";
    const targetSide = event.type === "attack" ? attackTargetSide(event) : (effectFx?.targetSide || explicitTargetSide || defaultTargetSide);
    const isEnemyTarget = targetSide === "enemy";
    playCutIn(event.moveName || event.title || (event.type === "heal" ? "治療發動！" : "戰鬥行動！"));
    if (event.type === "attack") {
      const hitDamages = Array.isArray(event.hitDamages) && event.hitDamages.length
        ? event.hitDamages.map((damage) => Math.max(0, Math.round(Number(damage || 0))))
        : [Math.max(0, Math.round(Number(event.damage || 0)))];
      const isCombo = hitDamages.length > 1;
      const judgeCloneBlocks = Array.isArray(event.judgeCloneBlocks) ? event.judgeCloneBlocks.map(Boolean) : [];
      const shikiIslandHitDamages = Array.isArray(event.shikiIslandHitDamages) ? event.shikiIslandHitDamages.map((damage) => Math.max(0, Math.round(Number(damage || 0)))) : [];
      const shikiIslandHitTargetIds = Array.isArray(event.shikiIslandHitTargetIds) ? event.shikiIslandHitTargetIds.map((id) => String(id || "")) : [];
      const shikiIslandHitDestroyed = Array.isArray(event.shikiIslandHitDestroyed) ? event.shikiIslandHitDestroyed.map(Boolean) : [];
      const guardedHitCount = judgeCloneBlocks.filter(Boolean).length;
      const judgeCloneCountBefore = Math.max(0, Math.min(3, Math.floor(Number(event.judgeCloneCountBefore ?? guardedHitCount))));
      const judgeCloneInterceptors = side === "player" && targetSide === "enemy"
        ? deployJudgeCloneInterceptors(judgeCloneCountBefore)
        : [];
      let judgeCloneHitCursor = 0;
      const hitGap = isCombo ? 660 : 0;
      const firstDelay = isCombo ? 360 : 480;
      const attackDuration = isCombo ? 520 : 900;
      const hitDuration = isCombo ? 420 : 700;
      const contactDelay = isCombo ? 230 : 340;
      refs.stage?.classList.toggle("combo-sequence", isCombo);
      if (event.kyubiMaskActive) {
        scheduleImpactFx(() => {
          const label = event.kyubiMaskLabel || "九尾幻化";
          playStatusEffectFx(side, { kind: "buff", direction: "up", label, eventId: event.id });
          showStatus(`巴雷特的${label}發動，攻擊轉為克制屬性！`);
        }, Math.max(80, firstDelay - 180));
      }
      hitDamages.forEach((damage, index) => {
        const isFinalHit = index === hitDamages.length - 1;
        const fatalGuardHit = !!event.fatalGuard && isFinalHit;
        const delay = firstDelay + index * hitGap;
        scheduleImpactFx(() => {
          playSpeedlines();
          playPortraitAction(side, "attack", attackDuration);
          scheduleImpactFx(() => {
            const cloneBlocked = side === "player" && targetSide === "enemy" && !!judgeCloneBlocks[index];
            const cloneIntercept = cloneBlocked
              ? hitJudgeCloneInterceptor(judgeCloneInterceptors[judgeCloneHitCursor++], index)
              : null;
            const shikiIslandHitDamage = Math.max(0, Number(shikiIslandHitDamages[index] || 0));
            const shikiIslandHitTargetId = shikiIslandHitTargetIds[index] || event.shikiIslandId || "";
            const didHitShikiIsland = !cloneBlocked && !event.miss && shikiIslandHitDamage > 0;
            const didDamage = !cloneBlocked && !event.miss && (damage > 0 || didHitShikiIsland);
            const didConnect = didDamage || fatalGuardHit;
            if (didDamage) {
              playPortraitAction(defender, "hit", hitDuration);
              applyDisplayedHitDamage(targetSide, damage);
            } else if (fatalGuardHit) {
              playPortraitAction(defender, "morale", hitDuration);
              playStatusEffectFx(defender, { kind: "shield", direction: "up", label: event.fatalGuardLabel || "不屈", eventId: event.id });
            } else if (!cloneBlocked && side === "enemy" && targetSide === "player" && event.raidSuitStealth) {
              playRaidSuitStealthMiss(hitDuration + 80);
            }
            if (didConnect || cloneBlocked) playStageShake();
            if (event.kingFlameGuarded && side === "player" && targetSide === "enemy" && !cloneBlocked && !event.miss) {
              playKingFlameGuardFx({ playSound: index === 0 });
            }
            if (index === 0 && event.katakuriDefenseActive && side === "enemy" && targetSide === "player" && !event.miss) {
              const defenseLabel = `防禦 -${Math.max(0, Number(event.katakuriDefensePercent || 0))}%`;
              playStatusEffectFx("player", { kind: "shield", direction: "up", label: defenseLabel, eventId: event.id });
              showStatus(`防禦骰生效，卡塔庫栗本次直接攻擊傷害減少 ${Math.max(0, Number(event.katakuriDefensePercent || 0))}%。`);
            }
            const hitEffectFile = didConnect || cloneBlocked ? inferHitEffectFile(event, index, hitDamages.length) : "";
            const impactAnchor = cloneIntercept?.querySelector(".judge-clone-guard") || (didHitShikiIsland ? shikiArchipelagoSlot(shikiIslandHitTargetId) || refs.shikiArchipelagoStage : null);
            positionImpactFx(targetSide, impactAnchor);
            setImpactEffect("", hitEffectFile);
            setDirectionalImpactEffect(side, targetSide, hitEffectFile);
            refs.impactFx?.classList.toggle("enemy", side === "enemy");
            refs.impactFx?.classList.toggle("is-combo-hit", isCombo);
            refs.impactFx?.classList.toggle("is-heavy-hit", !isCombo && damage >= 90);
            if (hitEffectFile) {
              const rotation = isCombo ? [-7, 5, -3, 8, -5, 4][index % 6] : 0;
              refs.impactFx?.style.setProperty("--hit-rotation", `${rotation}deg`);
              playHitEffectSound(event.hitSfx);
            }
            restartAnimation(refs.impactFx, "active");
            const suppressFatalGuardLeadHit = !!event.fatalGuard && !isFinalHit && damage <= 0;
            if (!suppressFatalGuardLeadHit && (!didHitShikiIsland || damage > 0 || cloneBlocked || fatalGuardHit)) {
              spawnBattleDamageNumber({
                amount: damage,
                critical: eventCriticalAtHit(event, index),
                miss: !cloneBlocked && !fatalGuardHit && (!!event.miss || damage <= 0),
                blocked: cloneBlocked || fatalGuardHit,
                blockedLabel: fatalGuardHit ? (event.fatalGuardLabel || "不屈") : "GUARD",
                blockedAriaLabel: fatalGuardHit ? "戰鬥服發動不屈，致命傷已抵銷" : "複製兵擋下攻擊",
                targetSide,
                anchorElement: cloneIntercept?.querySelector(".judge-clone-guard") || (isEnemyTarget ? refs.enemyCard : refs.playerCard),
                hitIndex: index,
              });
            }
            if (didHitShikiIsland) {
              spawnBattleDamageNumber({
                amount: shikiIslandHitDamage,
                critical: eventCriticalAtHit(event, index),
                targetSide: "enemy",
                anchorElement: shikiArchipelagoSlot(shikiIslandHitTargetId) || refs.shikiArchipelagoStage,
                hitIndex: index + 1,
              });
              if (shikiIslandHitDestroyed[index]) playShikiIslandBreakAtImpact(event, shikiIslandHitTargetId);
            }
            if (didConnect && isFinalHit && effectFx) {
              scheduleImpactFx(() => playStatusEffectFx(effectFx.targetSide || defender, { ...effectFx, eventId: event.id }), hitDuration + 1000);
            }
          }, contactDelay);
        }, delay);
      });
      if (isCombo) {
        scheduleImpactFx(() => {
          refs.stage?.classList.remove("combo-sequence");
        }, firstDelay + hitGap * hitDamages.length + 720);
      }
      scheduleImpactFx(() => finishDisplayedAttackHp(event.id), firstDelay + hitGap * Math.max(0, hitDamages.length - 1) + contactDelay + hitDuration + 220);
      scheduleImpactFx(clearJudgeCloneInterceptors, firstDelay + hitGap * Math.max(0, hitDamages.length - 1) + contactDelay + hitDuration + 560);
    } else if (event.type === "heal") {
      playPortraitAction(side, "morale", 900);
      playStatusEffectFx(effectFx?.targetSide || explicitTargetSide || side, { ...(effectFx || { kind: "heal", direction: "up", label: "治癒" }), eventId: event.id });
    } else if (moveType === "buff" || moveType === "shield") {
      playPortraitAction(side, "morale", 900);
      playStatusEffectFx(effectFx?.targetSide || explicitTargetSide || side, { ...(effectFx || { kind: moveType === "shield" ? "shield" : "speed", direction: "up", label: "能力提升" }), eventId: event.id });
    } else if (moveType === "debuff" || moveType === "control") {
      playPortraitAction(targetSide, "dizzy", 900);
      playStatusEffectFx(effectFx?.targetSide || explicitTargetSide || defender, { ...(effectFx || { kind: "debuff", direction: "down", label: "能力下降" }), eventId: event.id });
    } else {
      playPortraitAction(side, "morale", 760);
      if (effectFx) playStatusEffectFx(effectFx.targetSide || explicitTargetSide || side, { ...effectFx, eventId: event.id });
    }
    refs.impactFx.classList.toggle("enemy", side === "enemy");
    if (event.type !== "attack") {
      const impactKind = effectFx ? effectKind(effectFx) : (event.type === "heal" ? "heal" : (moveType === "debuff" || moveType === "control" ? "debuff" : (moveType === "shield" ? "shield" : "speed")));
      positionImpactFx(targetSide);
      setImpactEffect(impactKind);
      scheduleImpactFx(() => restartAnimation(refs.impactFx, "active"), 360);
    }
    if (event.type !== "attack" && event.damage) {
      scheduleImpactFx(() => spawnBattleDamageNumber({
        amount: event.damage,
        targetSide,
        anchorElement: isEnemyTarget ? refs.enemyCard : refs.playerCard,
      }), 460);
    } else if (event.type !== "attack" && event.amount) {
      scheduleImpactFx(() => spawnBattleDamageNumber({
        amount: event.amount,
        heal: true,
        targetSide,
        anchorElement: isEnemyTarget ? refs.enemyCard : refs.playerCard,
      }), 320);
    }
  }

  const RAID_REWARD_SLOT_LABELS = {
    heal: "急救",
    pp: "彈藥",
    attack: "總攻",
    defense: "鐵壁",
    speed: "突擊",
    shield: "屏障",
    revive: "救援",
    burst: "霸氣",
  };

  function raidRewardSlotLabel(entry = {}) {
    const mapped = RAID_REWARD_SLOT_LABELS[entry.id];
    if (mapped) return mapped;
    const text = String(entry.shortLabel || entry.slotLabel || entry.label || "補給").trim();
    return text.length > 4 ? text.slice(0, 4) : text;
  }

  const RAID_REWARD_ICON_KEYS = new Set(["heal", "pp", "attack", "defense", "speed", "shield", "revive", "burst", "unknown"]);

  function raidRewardIconKey(entry = {}) {
    const candidate = String(entry.iconKey || entry.id || "unknown").trim();
    return RAID_REWARD_ICON_KEYS.has(candidate) ? candidate : "unknown";
  }

  function raidRewardIconMarkup(entry = {}) {
    const label = entry.label || raidRewardSlotLabel(entry) || "司法島補給";
    return `<img src="images/board/judicial_raid_ui/reward_icons/${raidRewardIconKey(entry)}.webp" alt="${escapeHtml(label)}">`;
  }

  function setRaidRewardIcon(element, entry = {}) {
    if (!element) return;
    element.innerHTML = raidRewardIconMarkup(entry);
  }

  function playRaidPhaseRewardFx(event) {
    if (!refs.raidPhaseFx) return;
    raidFxTimers.forEach((timer) => clearTimeout(timer));
    raidFxTimers = [];
    clearInterval(playRaidPhaseRewardFx.spinTicker);
    const bonus = event.bonus || event.reward?.bonus || {};
    const bonusIndex = Number.isFinite(Number(bonus.index)) ? Number(bonus.index) : 0;
    const segments = bonus.segments || event.segments || [
      { id: "heal", label: "急救補給", iconKey: "heal" },
      { id: "pp", label: "彈藥補給", iconKey: "pp" },
      { id: "attack", label: "士氣爆發", iconKey: "attack" },
      { id: "defense", label: "鐵壁準備", iconKey: "defense" },
      { id: "speed", label: "突擊號令", iconKey: "speed" },
      { id: "shield", label: "臨時屏障", iconKey: "shield" },
      { id: "revive", label: "戰地救援", iconKey: "revive" },
      { id: "burst", label: "霸氣爆發", iconKey: "burst" },
    ];
    const targetSegment = segments[bonusIndex] || bonus || segments[0];
    const reelItems = Array.from({ length: 34 }, () => segments[Math.floor(Math.random() * segments.length)] || segments[0]);
    reelItems.push(targetSegment);
    reelItems.push(...segments.slice().sort(() => Math.random() - 0.5));
    const itemHeight = 54;
    const viewportHeight = 132;
    const targetIndex = 34;
    const slotEnd = -((targetIndex * itemHeight) - ((viewportHeight - itemHeight) / 2));
    refs.raidClearText.textContent = "突破！";
    refs.raidDefeatedName.textContent = `${event.defeatedName || "敵人"} 擊破`;
    setRaidRewardIcon(refs.raidRewardIcon, { id: "unknown", label: "補給抽選中" });
    refs.raidRewardLabel.textContent = "補給抽選中";
    refs.raidRewardDescription.textContent = "補給箱高速轉動中，停住前不會揭曉結果。";
    refs.raidNextEnemyName.textContent = event.nextEnemyName ? `下一名敵人：${event.nextEnemyName}` : "下一名敵人登場";
    refs.raidRewardWheel.innerHTML = reelItems.map((entry, index) => `
      <div class="raid-slot-item ${index === targetIndex ? "is-winning" : ""}">
        <span class="raid-slot-icon">${raidRewardIconMarkup(entry)}</span>
        <span class="raid-slot-label">${escapeHtml(raidRewardSlotLabel(entry))}</span>
      </div>
    `).join("");
    refs.raidRewardWheel.style.setProperty("--slot-end", `${slotEnd}px`);
    refs.raidRewardWheel.style.transform = "translateY(0)";
    refs.raidPhaseFx.classList.remove("show");
    refs.raidPhaseFx.classList.remove("settled");
    void refs.raidPhaseFx.offsetWidth;
    refs.raidPhaseFx.classList.add("show");
    playStageShake();
    playRaidPhaseRewardFx.spinTicker = setInterval(() => {
      const item = segments[Math.floor(Math.random() * segments.length)] || {};
      setRaidRewardIcon(refs.raidRewardIcon, item);
      refs.raidRewardLabel.textContent = raidRewardSlotLabel(item) || "抽選中";
    }, 92);
    raidFxTimers.push(setTimeout(() => {
      clearInterval(playRaidPhaseRewardFx.spinTicker);
      refs.raidPhaseFx.classList.add("settled");
      refs.raidRewardWheel.style.transform = `translateY(${slotEnd}px)`;
      setRaidRewardIcon(refs.raidRewardIcon, bonus.id ? bonus : targetSegment);
      refs.raidRewardLabel.textContent = bonus.label || "補給完成";
      refs.raidRewardDescription.textContent = bonus.appliedText
        ? `${bonus.description || "獲得突破補給。"}（${bonus.appliedText}）`
        : (bonus.description || "獲得突破補給。");
      playCutIn(bonus.label ? `補給：${bonus.label}` : "突破補給！");
      playStageShake();
    }, 4550));
    raidFxTimers.push(setTimeout(() => {
      refs.raidPhaseFx.classList.remove("show");
      refs.raidPhaseFx.classList.remove("settled");
    }, Math.max(11000, Number(event.duration || 11000))));
  }
  playRaidPhaseRewardFx.spinTicker = null;

  function clearZephyrExplosionStory() {
    window.clearTimeout(zephyrExplosionStoryTimer);
    zephyrExplosionStoryTimer = null;
    activeZephyrExplosionStoryEventId = "";
    zephyrExplosionStoryIndex = 0;
    zephyrExplosionStoryChanging = false;
    zephyrExplosionStoryFinished = false;
    if (!refs.zephyrExplosionStory) return;
    refs.zephyrExplosionStory.hidden = true;
    refs.zephyrExplosionStory.classList.remove("is-changing", "flash-on");
  }

  function finishZephyrExplosionStory() {
    if (!activeZephyrExplosionStoryEventId || zephyrExplosionStoryFinished) return false;
    window.clearTimeout(zephyrExplosionStoryTimer);
    zephyrExplosionStoryTimer = null;
    zephyrExplosionStoryFinished = true;
    if (refs.zephyrExplosionStoryHint) refs.zephyrExplosionStoryHint.textContent = "全員瀕死結算中……";
    if (!viewerCanControlBattle(latestView)) return true;
    return callBattleAction(
      "battleZephyrExplosionStoryDone",
      "zephyr-story-done",
      { eventId: activeZephyrExplosionStoryEventId }
    ) !== false;
  }

  function scheduleZephyrExplosionStoryAdvance() {
    window.clearTimeout(zephyrExplosionStoryTimer);
    const scene = POSTGAME_ZEPHYR_EXPLOSION_STORY_SCENES[zephyrExplosionStoryIndex];
    zephyrExplosionStoryTimer = window.setTimeout(
      () => advanceZephyrExplosionStory(),
      Math.max(1200, Number(scene?.hold || 2400))
    );
  }

  function paintZephyrExplosionStoryScene(nextIndex, immediate = false) {
    if (!refs.zephyrExplosionStory || zephyrExplosionStoryFinished) return false;
    const index = Math.max(0, Math.min(POSTGAME_ZEPHYR_EXPLOSION_STORY_SCENES.length - 1, Number(nextIndex || 0)));
    const scene = POSTGAME_ZEPHYR_EXPLOSION_STORY_SCENES[index];
    const commit = () => {
      zephyrExplosionStoryIndex = index;
      refs.zephyrExplosionStoryImage.src = scene.image;
      refs.zephyrExplosionStoryImage.alt = scene.alt;
      refs.zephyrExplosionStoryKicker.textContent = scene.kicker;
      refs.zephyrExplosionStoryTitle.textContent = scene.title;
      refs.zephyrExplosionStoryLine.textContent = scene.line;
      refs.zephyrExplosionStoryHint.textContent = index === POSTGAME_ZEPHYR_EXPLOSION_STORY_SCENES.length - 1
        ? "點擊畫面完成劇情"
        : "點擊畫面或按 → 繼續";
      Array.from(refs.zephyrExplosionStoryProgress.children).forEach((dot, dotIndex) => {
        dot.classList.toggle("active", dotIndex === index);
      });
      refs.zephyrExplosionStory.classList.remove("is-changing");
      if (scene.flash) {
        refs.zephyrExplosionStory.classList.remove("flash-on");
        void refs.zephyrExplosionStory.offsetWidth;
        refs.zephyrExplosionStory.classList.add("flash-on");
      }
      zephyrExplosionStoryChanging = false;
      scheduleZephyrExplosionStoryAdvance();
    };
    window.clearTimeout(zephyrExplosionStoryTimer);
    if (immediate) {
      commit();
    } else {
      zephyrExplosionStoryChanging = true;
      refs.zephyrExplosionStory.classList.add("is-changing");
      zephyrExplosionStoryTimer = window.setTimeout(commit, 280);
    }
    return true;
  }

  function advanceZephyrExplosionStory() {
    if (!activeZephyrExplosionStoryEventId || zephyrExplosionStoryChanging || zephyrExplosionStoryFinished) return false;
    if (zephyrExplosionStoryIndex >= POSTGAME_ZEPHYR_EXPLOSION_STORY_SCENES.length - 1) return finishZephyrExplosionStory();
    return paintZephyrExplosionStoryScene(zephyrExplosionStoryIndex + 1);
  }

  function playZephyrExplosionStory(event) {
    if (!event?.id || !refs.zephyrExplosionStory) return false;
    if (activeZephyrExplosionStoryEventId === event.id && !refs.zephyrExplosionStory.hidden) return true;
    clearZephyrExplosionStory();
    activeZephyrExplosionStoryEventId = event.id;
    refs.zephyrExplosionStory.hidden = false;
    refs.zephyrExplosionStoryProgress.replaceChildren(
      ...POSTGAME_ZEPHYR_EXPLOSION_STORY_SCENES.map(() => document.createElement("span"))
    );
    POSTGAME_ZEPHYR_EXPLOSION_STORY_SCENES.forEach((scene) => {
      const preload = new Image();
      preload.src = scene.image;
    });
    return paintZephyrExplosionStoryScene(0, true);
  }

  function syncZephyrExplosionStory(view) {
    const event = view?.battle?.visualEvent;
    if (event?.type === "postgame-zephyr-explosion-story") {
      playZephyrExplosionStory(event);
      return;
    }
    if (activeZephyrExplosionStoryEventId || !refs.zephyrExplosionStory?.hidden) clearZephyrExplosionStory();
  }

  function handleVisualEvent(view) {
    const event = view?.battle?.visualEvent;
    if (!event || event.id === lastVisualEventId) return;
    lastVisualEventId = event.id;
    if (event.type !== "attack") clearImpactFxTimers();
    if (event.type !== "kyubi-mask") clearKyubiMaskFx();
    if (event.type !== "sanji-raid-suit-transform") clearSanjiRaidSuitFx();
    if (event.type !== "postgame-lucci-six-power") clearLucciSixPowerFx();
    if (!(event.type === "attack" && event.specialFx === "lucci-rokuogan")) clearLucciRokuoganFx();
    if (event.type !== "postgame-bullet-fusion") clearBulletFusionFx();
    if (event.type !== "postgame-saga-fusion") clearSagaFusionFx();
    if (event.type !== "postgame-oars-purify") clearOarsPurificationFx();
    if (event.type !== "black-turn-cast") clearBlackTurnFx();
    if (event.type !== "postgame-katakuri-future-sight") clearKatakuriFutureSightCinematic();
    const isTotMusicaBattle = view?.battle?.postgameBossMechanic?.key === "postgame_tot_musica";
    if (!["tot-musica-dual-sync", "tot-musica-enemy-dual-strike"].includes(event.type) && !isTotMusicaBattle) clearTotMusicaDualSyncFx();
    if (event.type === "tot-musica-dual-sync") {
      playTotMusicaDualSyncFx(event);
      return;
    }
    if (event.type === "tot-musica-enemy-dual-strike") {
      playTotMusicaEnemyDualStrikeFx(event);
      return;
    }
    if (event.type === "postgame-zephyr-explosion-story") {
      playZephyrExplosionStory(event);
      return;
    }
    if (event.type === "postgame-katakuri-future-sight") {
      playKatakuriFutureSightCinematic(event);
      return;
    }
    if (event.type === "nika-heartbeat") {
      playNikaAwakeningHeartbeat();
      return;
    }
    if (event.type === "prepare") {
      const side = eventActorSide(event);
      const moveType = event.moveType || "attack";
      if (side) {
        clearInactiveActionPose(side);
        if (isAttackLikeMoveType(moveType)) {
          clearTimeout(portraitTimers[side]);
          setPortraitState(side, "angry");
        } else if (moveType === "heal" || moveType === "buff" || moveType === "shield") {
          playPortraitAction(side, "morale", 1800);
        } else {
          clearTimeout(portraitTimers[side]);
          setPortraitState(side, "angry");
        }
      }
      playCutIn(event.moveName || "準備行動");
    }
    if (event.type === "dice") {
      const side = eventActorSide(event);
      if (side) {
        clearInactiveActionPose(side);
        const moveType = event.moveType || "";
        const diceTheme = diceThemeForEvent(event);
        const hold = Math.max(2600, Number(event.duration || 1650) + 1250);
        if (isAttackLikeMoveType(moveType) || diceTheme === "attack") {
          clearTimeout(portraitTimers[side]);
          setPortraitState(side, "angry");
        } else if (diceTheme === "heal") {
          playPortraitAction(side, "morale", hold);
        } else if (diceTheme === "debuff") {
          playPortraitAction(side, "angry", hold);
        } else {
          playPortraitAction(side, "morale", hold);
        }
      }
      playDiceFx(event);
    }
    if (event.type === "bonus") {
      const displayEvent = resolvedDiceEvent(event);
      const side = eventActorSide(event);
      if (side && isAttackLikeMoveType(event.moveType || "")) {
        clearInactiveActionPose(side);
        clearTimeout(portraitTimers[side]);
        setPortraitState(side, "angry");
      }
      const prefix = diceActorPrefix(displayEvent);
      const summary = resolvedDiceSummary(displayEvent);
      playCutIn(prefix ? `${prefix}：${summary}` : summary);
    }
    if (event.type === "passive-opening") playOpeningPassiveFx(event);
    if (event.type === "kyubi-mask") playKyubiMaskFx(event, view);
    if (event.type === "sanji-raid-suit-transform") playSanjiRaidSuitFx(event);
    if (event.type === "postgame-lucci-six-power") playLucciSixPowerFx(event);
    if (event.type === "postgame-bullet-fusion") playBulletFusionFx(event);
    if (event.type === "postgame-saga-fusion") playSagaFusionFx(event);
    if (event.type === "postgame-oars-purify") playOarsPurificationFx(event);
    if (event.type === "black-turn-cast") playBlackTurnCastFx(event, view);
    if (event.type === "switch") playSwitchInFx(event);
    if (event.type === "phase2-dialogue") playPhase2DialogueFx(event, view);
    if (["attack", "heal", "status"].includes(event.type)) playImpactFx(event);
    if (event.type === "postgame-aramaki-down") {
      showKnockoutPose("enemy", event.targetName || "綠牛／荒牧", true);
    }
    if (event.type === "postgame-aramaki-revive") {
      clearTimeout(portraitTimers.enemy);
      clearTimeout(knockoutTimers.enemy);
      clearTimeout(knockoutTimers.enemyFade);
      clearTimeout(knockoutTimers.enemyAnnounce);
      knockoutVisualStarted.enemy = false;
      clearKnockoutPortraitHidden("enemy");
      refs.enemyCard?.classList.remove("portrait-ko", "portrait-hit");
      playImpactFx({ ...event, type: "heal" });
    }
    if (event.type === "knockout") {
      playKnockoutAction(event.side === "enemy" ? "enemy" : "player", event.targetName || event.name || "");
    }
    if (event.type === "raid-phase-reward") playRaidPhaseRewardFx(event);
  }

  function kingFlameMechanicState(view) {
    const mechanic = view?.battle?.postgameBossMechanic;
    if (!mechanic?.active || mechanic.key !== "postgame_king") return null;
    return mechanic.state || {};
  }

  function kingFlameHudPill(view) {
    const state = kingFlameMechanicState(view);
    if (!state) return "";
    const flameOn = state.flameOn !== false;
    const label = flameOn ? "背火點燃" : "背火熄滅";
    const detail = flameOn ? "火焰防護" : "輸出窗口";
    return `<span class="pill king-flame-hud-pill ${flameOn ? "is-lit" : "is-unlit"}" title="${escapeHtml(`${label}・${detail}`)}" aria-label="${escapeHtml(`${label}，${detail}`)}">${escapeHtml(label)}・${escapeHtml(detail)}</span>`;
  }

  function playKingFlameTransition(flameOn) {
    const transition = refs.kingFlameTransition;
    if (!transition) return false;
    clearTimeout(kingFlameTransitionTimer);
    transition.classList.remove("is-active", "is-lit", "is-unlit");
    if (refs.kingFlameTransitionTitle) refs.kingFlameTransitionTitle.textContent = flameOn ? "背火燃起" : "背火熄滅";
    if (refs.kingFlameTransitionDetail) refs.kingFlameTransitionDetail.textContent = flameOn ? "火焰防護展開" : "高速型態・輸出窗口";
    void transition.offsetWidth;
    transition.classList.add("is-active", flameOn ? "is-lit" : "is-unlit");
    playCastEffectSound(flameOn
      ? "audio/board_game/sfx/magic01/magic01/fire4.mp3"
      : "audio/board_game/sfx/attack01/attack01/kungfu_wind2.mp3");
    kingFlameTransitionTimer = window.setTimeout(() => {
      transition.classList.remove("is-active", "is-lit", "is-unlit");
      kingFlameTransitionTimer = null;
    }, 1320);
    return true;
  }

  function playKingFlameGuardFx(options = {}) {
    const guard = refs.kingFlameGuardFx;
    if (!guard) return false;
    clearTimeout(kingFlameGuardTimer);
    guard.classList.remove("is-active");
    void guard.offsetWidth;
    guard.classList.add("is-active");
    if (options.playSound !== false) playCastEffectSound("audio/board_game/sfx/magic01/magic01/fire1.mp3");
    kingFlameGuardTimer = window.setTimeout(() => {
      guard.classList.remove("is-active");
      kingFlameGuardTimer = null;
    }, 760);
    return true;
  }

  function renderKingFlameState(view) {
    const state = kingFlameMechanicState(view);
    const active = !!state;
    refs.enemyCard?.classList.toggle("king-flame-battle", active);
    if (!active) {
      refs.enemyCard?.classList.remove("king-flame-on", "king-flame-off");
      if (refs.kingFlameStatePlate) refs.kingFlameStatePlate.hidden = true;
      lastRenderedKingFlameOn = null;
      clearTimeout(kingFlameTransitionTimer);
      clearTimeout(kingFlameGuardTimer);
      kingFlameTransitionTimer = null;
      kingFlameGuardTimer = null;
      refs.kingFlameTransition?.classList.remove("is-active", "is-lit", "is-unlit");
      refs.kingFlameGuardFx?.classList.remove("is-active");
      return;
    }

    const flameOn = state.flameOn !== false;
    refs.enemyCard?.classList.toggle("king-flame-on", flameOn);
    refs.enemyCard?.classList.toggle("king-flame-off", !flameOn);
    if (refs.kingFlameStatePlate) {
      refs.kingFlameStatePlate.hidden = false;
      refs.kingFlameStatePlate.classList.toggle("is-lit", flameOn);
      refs.kingFlameStatePlate.classList.toggle("is-unlit", !flameOn);
      refs.kingFlameStatePlate.setAttribute("aria-label", flameOn ? "背火點燃，火焰防護" : "背火熄滅，現在是輸出窗口");
    }
    if (refs.kingFlameStateTitle) refs.kingFlameStateTitle.textContent = flameOn ? "背火點燃" : "背火熄滅";
    if (refs.kingFlameStateDetail) refs.kingFlameStateDetail.textContent = flameOn ? "火焰防護" : "輸出窗口";
    if (typeof lastRenderedKingFlameOn === "boolean" && lastRenderedKingFlameOn !== flameOn) {
      playKingFlameTransition(flameOn);
    }
    lastRenderedKingFlameOn = flameOn;
  }

  function renderHud(view) {
    ensureVisualHpOverride(view);
    prepareStatusIconDelays(view);
    const active = displayedCombatant("player", view?.activeCard);
    const enemy = displayedCombatant("enemy", view?.enemy);
    const activeStatusCombatant = statusIconCombatantForRender("player", active, view);
    const enemyStatusCombatant = statusIconCombatantForRender("enemy", enemy, view);
    const player = view?.player;
    const activeAttribute = playerDisplayAttribute(view);
    renderAttributeMatchup(view);
    refs.playerHudName.textContent = active ? active.name : "等待戰鬥資料";
    refs.playerHpFill.style.width = hpPercent(active?.currentHp ?? 1, active?.maxHp ?? 1);
    renderStatusIcons(refs.playerStatusIcons, activeStatusCombatant, "player");
    rememberRenderedStatusCombatant("player", activeStatusCombatant);
    refs.playerHudMeta.innerHTML = active ? `
      <span class="pill">Lv.${escapeHtml(active.level || 1)}</span>
      ${attributePill(activeAttribute)}
      <span class="pill">HP ${escapeHtml(active.currentHp)}/${escapeHtml(active.maxHp)}</span>
      ${active.raidSuitTransformed ? `<span class="pill" title="${escapeHtml(active.passiveText || "隱形黑戰鬥型態")}">隱形黑</span>` : ""}
      ${carryItemHudPills(active.carryItem)}
    ` : "";
    bindCarryItemHudPills(refs.playerHudMeta);
    renderCoopViewSwitch(view);

    refs.enemyHudName.textContent = enemy ? enemy.name : "敵人";
    renderEnemyPhaseHpBars(view, enemy);
    renderStatusIcons(refs.enemyStatusIcons, enemyStatusCombatant, "enemy");
    renderPostgameMechanicStatusIcon(view);
    rememberRenderedStatusCombatant("enemy", enemyStatusCombatant);
    const raidInfo = view?.battle?.raidInfo || null;
    const coopInfo = view?.battle?.coopInfo || null;
    const coopWaitingCount = (coopInfo?.participants || []).filter((entry) => entry.awaitingRescue).length;
    const phaseBars = phaseHpBarsForDisplay(view, enemy);
    refs.enemyHudMeta.innerHTML = enemy ? `
      <span class="pill">Lv.${escapeHtml(enemy.level || 1)}</span>
      ${attributePill(enemy.attribute)}
      <span class="pill">HP ${escapeHtml(combatantHpTextForDisplay(enemy, phaseBars))}</span>
      ${kingFlameHudPill(view)}
      ${raidInfo ? `
        <span class="pill">${escapeHtml(raidInfo.title || "司法島共鬥")} ${escapeHtml(Number(raidInfo.phaseIndex || 0) + 1)}/${escapeHtml(raidInfo.phaseTotal || 6)}</span>
        <span class="pill">參戰 ${escapeHtml(raidInfo.participantCount || 1)} 人</span>
        <span class="pill">共享 HP ${escapeHtml(raidInfo.enemySharedHp)}/${escapeHtml(raidInfo.enemySharedMaxHp)}</span>
      ` : coopInfo?.enabled ? `
        <span class="pill">${escapeHtml(coopInfo.title || "多人共鬥")}</span>
        <span class="pill">參戰 ${escapeHtml((coopInfo.participants || []).length)} 人</span>
        ${coopWaitingCount ? `<span class="pill">待救援 ${escapeHtml(coopWaitingCount)} 人</span>` : ""}
      ` : ""}
    ` : "";
  }

  function coopViewScopeKey(view) {
    if (!view?.battle) return "";
    return [
      view.battle.islandId || "",
      view.battle.islandKind || "",
      view.enemy?.key || view.enemy?.name || "",
      view.battle.raidInfo?.phaseIndex ?? "",
      view.battle.raidInfo?.phaseTotal ?? "",
    ].join("|");
  }

  function coopViewParticipants(view = latestView) {
    const participants = view?.battle?.coopInfo?.participants;
    return Array.isArray(participants) ? participants.filter((entry) => entry?.id) : [];
  }

  function coopViewPersonState(entry, isSelected = false) {
    if (entry?.awaitingRescue) return `待救援・剩${Math.max(0, Number(entry.rescueTurnsRemaining || 0))}回合`;
    if (entry?.defeated) return "倒下";
    if (entry?.escaped) return "撤離";
    if (entry?.isCurrentActor) return "操作中";
    if (isSelected) return "觀看中";
    if (entry?.isLocalViewer) return "自己";
    return "待命";
  }

  function closeCoopViewMenu({ render = true } = {}) {
    if (!coopViewMenuOpen) return;
    coopViewMenuOpen = false;
    if (render) renderCoopViewSwitch(latestView);
  }

  function renderCoopViewSwitch(view) {
    if (!refs.coopViewSwitch || !refs.coopViewTrigger || !refs.coopViewPersonList) return;
    const participants = coopViewParticipants(view);
    const localParticipant = participants.some((entry) => entry?.isLocalViewer);
    const enabled = !!view?.battle?.coopInfo?.enabled && participants.length > 1 && localParticipant;
    if (!enabled) {
      refs.coopViewSwitch.hidden = true;
      refs.coopViewSwitch.classList.remove("open");
      refs.coopViewMenu.hidden = true;
      refs.coopViewPersonList.innerHTML = "";
      coopViewMenuOpen = false;
      selectedCoopViewPlayerId = "";
      coopViewBattleScope = "";
      lastCoopCommandPlayerId = "";
      return;
    }

    const nextScope = coopViewScopeKey(view);
    if (nextScope !== coopViewBattleScope) {
      coopViewBattleScope = nextScope;
      selectedCoopViewPlayerId = "";
      coopViewMenuOpen = false;
    }
    const viewingPlayerId = String(view?.battle?.coopView?.viewingPlayerId || view?.player?.id || "");
    if (!participants.some((entry) => String(entry.id) === selectedCoopViewPlayerId)) {
      selectedCoopViewPlayerId = viewingPlayerId;
    }
    const selectedIndex = Math.max(0, participants.findIndex((entry) => String(entry.id) === selectedCoopViewPlayerId));
    const selected = participants[selectedIndex] || participants[0];
    const avatarUrl = selected.avatarUrl || selected.portraitUrl || "";
    refs.coopViewSwitch.hidden = false;
    refs.coopViewSwitch.classList.toggle("open", coopViewMenuOpen);
    refs.coopViewTrigger.setAttribute("aria-expanded", coopViewMenuOpen ? "true" : "false");
    refs.coopViewTrigger.setAttribute("aria-label", `切換共鬥夥伴視角，目前觀看 ${selected.name || "夥伴"}`);
    refs.coopViewTriggerAvatar.src = avatarUrl;
    refs.coopViewTriggerAvatar.alt = selected.name || "共鬥夥伴";
    refs.coopViewTriggerMode.textContent = view?.battle?.coopView?.viewOnly ? "觀看中" : "共鬥視角";
    refs.coopViewTriggerName.textContent = selected.name || "共鬥夥伴";
    refs.coopViewTriggerCount.textContent = `${selectedIndex + 1}/${participants.length}`;
    refs.coopViewMenu.hidden = !coopViewMenuOpen;
    refs.coopViewMenu.style.width = `${Math.min(470, Math.max(226, participants.length * 89 + 32))}px`;
    refs.coopViewPersonList.innerHTML = participants.map((entry) => {
      const id = String(entry.id || "");
      const isSelected = id === selectedCoopViewPlayerId;
      const classes = [
        "coop-view-person",
        isSelected ? "selected" : "",
        entry.isCurrentActor ? "active-actor" : "",
        entry.awaitingRescue ? "awaiting-rescue" : "",
        entry.defeated ? "defeated" : "",
        entry.escaped ? "escaped" : "",
      ].filter(Boolean).join(" ");
      const profileUrl = entry.avatarUrl || entry.portraitUrl || "";
      const activeUrl = entry.portraitUrl || entry.avatarUrl || "";
      const stateLabel = coopViewPersonState(entry, isSelected);
      const label = `${entry.name || "共鬥夥伴"}，${stateLabel}`;
      return `
        <button class="${classes}" type="button" role="option" aria-selected="${isSelected ? "true" : "false"}" aria-label="${escapeHtml(label)}" data-coop-view-player="${escapeHtml(id)}">
          <span class="coop-view-person-avatar">
            <img src="${escapeHtml(profileUrl)}" alt="" loading="eager" decoding="async">
            <span class="coop-view-active-portrait"><img src="${escapeHtml(activeUrl)}" alt="" loading="eager" decoding="async"></span>
          </span>
          <span class="coop-view-person-name">${escapeHtml(entry.name || "夥伴")}</span>
          <span class="coop-view-person-state">${escapeHtml(stateLabel)}</span>
        </button>
      `;
    }).join("");
  }

  function selectCoopViewPlayer(playerId) {
    const id = String(playerId || "");
    const participant = coopViewParticipants().find((entry) => String(entry.id) === id);
    if (!participant) return false;
    selectedCoopViewPlayerId = id;
    coopViewMenuOpen = false;
    currentMode = null;
    refresh();
    const viewingCurrentActor = String(latestView?.battle?.coopView?.currentPlayerId || "") === id;
    showStatus(viewingCurrentActor
      ? `已切換到 ${participant.name} 的操作視角。`
      : `正在觀看 ${participant.name} 的戰鬥狀態。`);
    return true;
  }

  function followCurrentCoopActor(view, api) {
    const commandPlayerId = String(view?.battle?.coopInfo?.currentPlayerId || "");
    if (!commandPlayerId) {
      lastCoopCommandPlayerId = "";
      return view;
    }
    const actorChanged = !!lastCoopCommandPlayerId && commandPlayerId !== lastCoopCommandPlayerId;
    lastCoopCommandPlayerId = commandPlayerId;
    if (!actorChanged) return view;
    selectedCoopViewPlayerId = commandPlayerId;
    coopViewMenuOpen = false;
    return api?.getBattleView?.({ coopViewPlayerId: commandPlayerId }) || view;
  }

  function renderCards(view) {
    ensureVisualHpOverride(view);
    const active = displayedCombatant("player", view?.activeCard);
    const enemy = displayedCombatant("enemy", view?.enemy);
    resetChangedCombatants(view);
    syncYonkoPhaseFrame(view);
    if (refs.playerCardTier) {
      refs.playerCardTier.className = "card-tier";
      refs.playerCardTier.textContent = "PLAYER";
      refs.playerCardTier.removeAttribute("title");
      refs.playerCardTier.removeAttribute("aria-label");
    }
    refs.playerCardName.textContent = active?.name || "夥伴";
    syncNikaFrame(active);
    syncCosmeticFrame(active);
    refs.enemyCardTier.textContent = enemy ? `Lv.${enemy.level || 1} ・ ${enemy.attribute || ""}` : "ENEMY";
    refs.enemyCardName.textContent = enemy?.name || "敵人";
    syncEnemyCosmeticFrame(enemy);
    renderJudgeCloneGuard(view);
    syncBlackTurnDemonFrame(enemy);
    setPortraitState("player", portraitState.player);
    setPortraitState("enemy", portraitState.enemy);
    syncTesoroGoldCoating(view);
    syncPlayerAwakeningStandby(view);
    renderCoopAllyStack(view);
    renderKingFlameState(view);
  }

  function syncTesoroGoldCoating(view) {
    const coating = refs.tesoroGoldCoating;
    if (!coating) return;
    const mechanic = view?.battle?.postgameBossMechanic;
    const tesoroBattle = mechanic?.key === "postgame_gild_tesoro" && Number(mechanic.state?.phase || 1) <= 2;
    const activeIndex = Number(view?.battle?.activeCrewIndex ?? -1);
    const activeState = tesoroBattle
      ? (mechanic.state?.crew || []).find((card) => Number(card.index) === activeIndex)
      : null;
    const level = Math.max(0, Math.min(3, Number(activeState?.gold || 0)));
    coating.hidden = !tesoroBattle || level <= 0;
    coating.dataset.level = String(level);
    coating.classList.toggle("is-active", tesoroBattle && level > 0);
    coating.setAttribute("aria-label", tesoroBattle && level > 0 ? `金流淹沒 ${level}/3` : "");
    refs.playerCard?.classList.remove("tesoro-gold-active");
    refs.playerCard?.classList.toggle("tesoro-gold-river-active", tesoroBattle && level > 0);
    refs.playerCard?.classList.toggle("tesoro-gold-bound", tesoroBattle && level >= 3);
  }

  function judgeCloneFormation(count) {
    if (count >= 3) return [
      { x: 30, scale: 0.72, z: 1, delay: -220 },
      { x: 50, scale: 0.82, z: 3, delay: -510 },
      { x: 70, scale: 0.72, z: 2, delay: -830 },
    ];
    if (count === 2) return [
      { x: 32, scale: 0.78, z: 2, delay: -280 },
      { x: 68, scale: 0.78, z: 3, delay: -670 },
    ];
    if (count === 1) return [{ x: 50, scale: 1.02, z: 3, delay: -430 }];
    return [];
  }

  function judgeCloneSpriteHtml(slot, className = "") {
    return `<img class="judge-clone-guard${className ? ` ${className}` : ""}" src="${JUDGE_CLONE_GUARD_ASSET}" alt="" aria-hidden="true" draggable="false" style="--judge-clone-x:${slot.x}%;--judge-clone-scale:${slot.scale};--judge-clone-z:${slot.z};--judge-clone-delay:${slot.delay}ms">`;
  }

  function renderJudgeCloneGuard(view) {
    const layer = refs.judgeCloneGuardLayer;
    if (!layer) return;
    const mechanic = view?.battle?.postgameBossMechanic;
    const isJudgeBattle = mechanic?.active && mechanic.key === "postgame_vinsmoke_judge";
    if (!isJudgeBattle) {
      clearTimeout(judgeCloneGuardTimer);
      judgeCloneGuardTimer = null;
      lastJudgeCloneCount = null;
      layer.hidden = true;
      layer.className = "judge-clone-guard-layer";
      layer.innerHTML = "";
      refs.enemyCard?.classList.remove("judge-clone-guard-active");
      return;
    }

    const count = Math.max(0, Math.min(3, Math.floor(Number(mechanic.state?.clones || 0))));
    refs.enemyCard?.classList.remove("judge-clone-guard-active");
    if (lastJudgeCloneCount === count) return;
    clearTimeout(judgeCloneGuardTimer);
    judgeCloneGuardTimer = null;
    if (!layer.querySelector(".judge-clone-intercept")) {
      layer.hidden = true;
      layer.className = "judge-clone-guard-layer";
      layer.innerHTML = "";
    }
    lastJudgeCloneCount = count;
  }

  function renderCoopAllyStack(view) {
    if (!refs.coopAllyStack || !refs.playerCard) return;
    const info = view?.battle?.coopInfo || null;
    const participants = Array.isArray(info?.participants) ? info.participants : [];
    const actorId = String(view?.player?.id || info?.currentPlayerId || "");
    const allies = participants
      .filter((entry) => String(entry?.id || "") !== actorId && !entry.defeated && !entry.escaped && entry.portraitUrl)
      .slice(0, 3);
    refs.playerCard.classList.toggle("has-coop-allies", allies.length > 0);
    refs.coopAllyStack.innerHTML = allies.map((entry, index) => {
      const x = -18 - index * 13;
      const y = 3 + index * 2;
      const rotate = -1.2 - index * 0.7;
      const z = Math.max(1, 5 - index);
      const name = entry.activeName || entry.name || "共鬥夥伴";
      return `
        <div class="coop-ally-frame" style="--ally-x:${x}px;--ally-y:${y}px;--ally-rotate:${rotate}deg;--ally-z:${z}">
          <img class="coop-ally-portrait" src="${escapeHtml(entry.portraitUrl)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async" onerror="this.closest('.coop-ally-frame')?.remove()">
        </div>
      `;
    }).join("");
    const actorChanged = !!lastCoopActorId && !!actorId && actorId !== lastCoopActorId && participants.length > 1;
    if (actorId) lastCoopActorId = actorId;
    if (!actorChanged) return;
    refs.playerCard.classList.remove("coop-actor-forward");
    void refs.playerCard.offsetWidth;
    refs.playerCard.classList.add("coop-actor-forward");
    window.clearTimeout(coopActorForwardTimer);
    coopActorForwardTimer = window.setTimeout(() => refs.playerCard?.classList.remove("coop-actor-forward"), 760);
  }

  function inferPortraitEventsFromLog(view) {
    const log = view?.battle?.log || [];
    if (view?.battle?.visualEvent) {
      processedLogLength = log.length;
      return;
    }
    if (processedLogLength === null) {
      processedLogLength = log.length;
      return;
    }
    if (log.length <= processedLogLength) return;
    const newEntries = log.slice(processedLogLength);
    processedLogLength = log.length;
    newEntries.forEach((entry, index) => {
      const delay = index * 240;
      const isDamage = /造成\s*\d+\s*點傷害/.test(entry);
      const isPlayerAction = entry.includes(`${view.player?.name} 使用`);
      const isEnemyAction = entry.includes("敵人 使用");
      if (isPlayerAction) {
        setTimeout(() => playPortraitAction("player", "attack", 560), delay);
        if (isDamage) setTimeout(() => playPortraitAction("enemy", "hit", 460), delay + 220);
      }
      if (isEnemyAction) {
        setTimeout(() => playPortraitAction("enemy", "attack", 560), delay);
        if (isDamage) setTimeout(() => playPortraitAction("player", "hit", 460), delay + 220);
      }
    });
  }

  function dialogueBlocksBattleControls(view = latestView) {
    return prebattleIntroPending(view) || prebattleIntroActive || phase2DialogueActive;
  }

  function actionDisabled(view) {
    return !viewerCanControlBattle(view) || dialogueBlocksBattleControls(view) || !view?.battle || !view.battle.canAct || view.battle.needsReplacement || view.battle.canFinish || view.battle.result === "round-pause";
  }

  function updateActionButtons(view) {
    const disabled = actionDisabled(view);
    const resultOpen = !!view?.battle && (!!view.battle.result || !!view.battle.canFinish);
    refs.actionPanel?.classList.toggle("is-hidden", !viewerCanControlBattle(view) || dialogueBlocksBattleControls(view) || resultOpen);
    updateTotMusicaActionHeading(view);
    document.querySelectorAll("[data-mode]").forEach((button) => {
      button.disabled = disabled;
      button.classList.toggle("active", !button.disabled && button.dataset.mode === currentMode);
    });
  }

  function renderSpectatorPanel(view) {
    refs.infoPanel?.classList.remove("battle-switch-mode");
    refs.infoPanel?.classList.remove("battle-command-mode");
    if (view?.battle?.needsReplacement && replacementNeedsKnockoutDelay(view) && !replacementPanelReady(view)) {
      renderReplacementWaiting(view);
      return;
    }
    refs.infoPanel?.classList.remove("is-hidden");
    refs.infoPanel?.classList.remove("result-mode");
    if (refs.infoTitle) refs.infoTitle.textContent = "";
    if (refs.infoContent) {
      refs.infoContent.innerHTML = `<div class="empty-state">${escapeHtml(viewerBattleLockMessage(view))}</div>`;
    }
  }

  function formatRewardAmount(value) {
    const amount = Math.max(0, Math.round(Number(value || 0)));
    return amount.toLocaleString("zh-TW");
  }

  function rewardItemText(rewards) {
    const grantedItems = Array.isArray(rewards?.grantedItems)
      ? rewards.grantedItems.map(String).filter(Boolean)
      : [];
    if (grantedItems.length) return grantedItems.join("、");
    return rewards?.itemText || rewards?.battleCarryDropLabel || rewards?.battleCarryDropName || rewards?.item || "無道具";
  }

  function battleResultRewardEntries(view) {
    if (view?.battle?.result !== "win") return [];
    const coopDetails = Array.isArray(view.battle.coopRewardDetails) ? view.battle.coopRewardDetails : [];
    const coopPerformance = Array.isArray(view.battle.coopInfo?.participants) ? view.battle.coopInfo.participants : [];
    if (coopDetails.length) {
      return coopDetails.slice(0, 4).map((entry) => {
        const performance = coopPerformance.find((candidate) => String(candidate.id) === String(entry.playerId)) || {};
        return {
          name: entry.playerName || "玩家",
          isPerformance: true,
          lines: [
            `傷害 ${formatRewardAmount(performance.damageDone)} ・ 承傷 ${formatRewardAmount(performance.damageTaken)} ・ 治療 ${formatRewardAmount(performance.healingDone)}`,
            `行動 ${formatRewardAmount(performance.turnsActed)} ・ 道具 ${formatRewardAmount(performance.itemsUsed)} ・ 救援 ${formatRewardAmount(performance.rescuesDone)}`,
            `貝里 +${formatRewardAmount(entry.coins)} ・ 懸賞金 +${entry.bountyText || formatRewardAmount(entry.bounty)}`,
            `EXP +${formatRewardAmount(entry.exp)} ・ ${entry.itemText || "無道具"}`,
          ],
        };
      });
    }
    const raidParticipants = Array.isArray(view.battle.raidInfo?.participants) ? view.battle.raidInfo.participants : [];
    if (raidParticipants.length) {
      return raidParticipants.slice(0, 4).map((entry) => ({
        name: entry.name || "玩家",
        isPerformance: true,
        lines: [
          `傷害 ${formatRewardAmount(entry.damageDone)} ・ 承傷 ${formatRewardAmount(entry.damageTaken)} ・ 治療 ${formatRewardAmount(entry.healingDone)}`,
          `行動 ${formatRewardAmount(entry.turnsActed)} ・ 道具 ${formatRewardAmount(entry.itemsUsed)} ・ 救援 ${formatRewardAmount(entry.rescuesDone)}`,
          `貝里 +${formatRewardAmount(entry.rewardPreview?.coins)} ・ 懸賞金 +${formatRewardAmount(entry.rewardPreview?.bounty)}`,
          `EXP +${formatRewardAmount(entry.rewardPreview?.exp)}`,
        ],
      }));
    }
    const rewards = view.battle.rewards;
    if (!rewards) return [];
    return [
      { name: "貝里", lines: [`+${formatRewardAmount(rewards.coins)}`] },
      { name: "懸賞金", lines: [`+${rewards.bountyText || formatRewardAmount(rewards.bounty)}`] },
      { name: "EXP", lines: [`+${formatRewardAmount(rewards.exp)}`] },
      { name: "獎勵物品", lines: [rewardItemText(rewards)] },
    ];
  }

  function battleFinishSignature(view) {
    return [
      view?.player?.id || "",
      view?.battle?.islandId || "",
      view?.battle?.islandKind || "",
      view?.enemy?.key || view?.enemy?.name || "",
      view?.battle?.result || "",
      view?.battle?.round || "",
      view?.battle?.raidInfo?.phaseIndex ?? "",
    ].join("|");
  }

  function renderResult(view) {
    refs.infoPanel?.classList.remove("is-hidden");
    refs.infoTitle.textContent = "戰鬥結果";
    if (!view) {
      refs.infoContent.innerHTML = `<div class="empty-state">沒有讀到戰鬥資料。請從主遊戲進入戰鬥，這個頁面就會自動接上。</div>`;
      return;
    }
    const raidInfo = view?.battle?.raidInfo || null;
    const isRaidPhaseWin = !!raidInfo && view.battle.result === "win" && Number(raidInfo.phaseIndex || 0) + 1 < Number(raidInfo.phaseTotal || 6);
    const isRoundPause = view.battle.result === "round-pause";
    const isDeferredCoopResult = !!view.battle.deferredCoopResult;
    const roundPauseReturnsToMap = isRoundPause && view.battle.roundPauseReturnsToMap !== false;
    const finishLabel = isRoundPause
      ? (roundPauseReturnsToMap ? "返回地圖，換下一位" : "進入下一輪")
      : isDeferredCoopResult
        ? "回到地圖，繼續本回合"
      : isRaidPhaseWin
        ? "領取補給並換人"
        : "返回地圖";
    const resultText = view.battle.result === "win"
      ? "戰鬥勝利！"
      : view.battle.result === "lose"
        ? "全員瀕死"
        : view.battle.result === "escape"
          ? "成功脫離戰鬥"
          : view.battle.result === "replacement"
          ? "夥伴瀕死，請選下一位上場"
          : isRoundPause
            ? "本輪結束"
            : "本輪處理完成";
    const rewardEntries = battleResultRewardEntries(view);
    const isDangerResult = ["lose", "replacement"].includes(view.battle.result);
    const actionFrame = isDangerResult
      ? "images/board/battle_command_ui/battle_command_danger_button_frame.webp"
      : "images/board/battle_command_ui/battle_command_choice_button_frame.webp";
    const finishSignature = battleFinishSignature(view);
    const finishPending = pendingBattleFinishSignature === finishSignature && Date.now() < pendingBattleFinishUntil;
    const rewardCards = rewardEntries.map((entry) => {
      const isPerformance = entry.isPerformance === true;
      const rewardFrame = isPerformance
        ? "images/board/battle_result_ui/battle_result_player_card_frame.webp"
        : "images/board/battle_command_ui/battle_command_choice_button_frame.webp";
      return `
      <article class="battle-result-reward-card${isPerformance ? " is-performance" : ""}">
        <img class="battle-result-reward-frame" src="${rewardFrame}" alt="" aria-hidden="true">
        <span class="battle-result-reward-copy">
          <strong class="battle-result-reward-name">${escapeHtml(entry.name)}</strong>
          <span class="battle-result-reward-detail">
            ${(entry.lines || []).map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
          </span>
        </span>
      </article>
    `;
    }).join("");
    const finishButton = view.battle.canFinish
      ? `<button class="battle-result-action${finishLabel.length > 4 ? " is-long" : ""}${isDangerResult ? " is-danger" : ""}${finishPending ? " is-disabled" : ""}" type="button" data-finish-battle${finishPending ? " disabled" : ""}>
          <img class="battle-result-action-frame" src="${actionFrame}" alt="" aria-hidden="true">
          <span class="battle-result-action-label">${escapeHtml(finishLabel)}</span>
        </button>`
      : "";
    refs.infoContent.innerHTML = `
      <section class="battle-result-ui result-${escapeHtml(view.battle.result || "complete")}" aria-label="戰鬥結果：${escapeHtml(resultText)}">
        <img class="battle-result-panel-frame" src="images/board/battle_switch_ui/battle_switch_panel_frame.webp" alt="" aria-hidden="true">
        <header class="battle-result-heading"><strong>${escapeHtml(resultText)}</strong></header>
        <div class="battle-result-body${rewardEntries.length ? "" : " no-reward"}${view.battle.canFinish ? "" : " no-action"}">
          <div class="battle-result-reward-grid count-${Math.max(1, Math.min(4, rewardEntries.length))}">
            ${rewardCards}
          </div>
        </div>
        ${finishButton}
      </section>
    `;
    refs.infoContent.querySelector("[data-finish-battle]")?.addEventListener("click", (event) => {
      const button = event.currentTarget;
      if (button?.disabled) return;
      if (button) {
        button.disabled = true;
        button.classList.add("is-disabled");
      }
      pendingBattleFinishSignature = finishSignature;
      pendingBattleFinishUntil = Date.now() + 2000;
      callBattleAction("battleFinish", "finish");
      showStatus(isRoundPause ? (roundPauseReturnsToMap ? "已送出返回地圖，準備換下一位。" : "已送出下一輪指令。") : isDeferredCoopResult ? "共鬥結算已確認，回到地圖繼續本回合。" : isRaidPhaseWin ? "準備領取補給，下一戰前可換人。" : "已送出結束戰鬥。");
    });
  }

  function postgamePips(value, max, options = {}) {
    const active = Math.max(0, Math.min(Number(max || 0), Number(value || 0)));
    return `<span class="postgame-mechanic-pips">${Array.from({ length: Math.max(0, Number(max || 0)) }, (_, index) => `<i class="postgame-mechanic-pip ${index < active ? "active" : ""} ${options.danger && index < active ? "danger" : ""}">${escapeHtml(options.labels?.[index] || index + 1)}</i>`).join("")}</span>`;
  }

  function postgameCrewPortrait(card = {}) {
    const portraits = card.battlePortraits || {};
    return portraits.normal || portraits.idle || portraits.morale || portraits.attack || card.portrait || PLACEHOLDER_BATTLE_PORTRAIT;
  }

  function postgameBulletSlotsHtml(state = {}) {
    const partLabels = {
      "頭": "頭部裝甲",
      "胸": "胸部裝甲",
      "左手": "左手裝甲",
      "右手": "右手裝甲",
      "左腳": "左腳裝甲",
      "右腳": "右腳裝甲",
    };
    return `<span class="postgame-mechanic-slots">${(state.slots || []).slice(0, 6).map((slot) => {
      const hasItem = !!slot.itemId;
      const destroyed = !!slot.destroyed;
      const itemName = hasItem ? slot.itemName || "未命名攜帶物" : "未裝備";
      const summary = hasItem ? slot.itemSummary || "沒有登錄效果。" : "此孔位沒有攜帶物效果。";
      const status = destroyed
        ? `已破壞・效果已歸還${slot.runtimeStatus ? `・${slot.runtimeStatus}` : ""}`
        : hasItem ? (slot.runtimeStatus ? `接管中・${slot.runtimeStatus}` : "接管中") : "空孔位";
      const part = partLabels[slot.label] || `${slot.label || "未知部位"}${String(slot.label || "").endsWith("裝甲") ? "" : "裝甲"}`;
      return `<button type="button" class="postgame-mechanic-slot ${destroyed ? "is-broken" : hasItem ? "is-active" : "is-empty"}" data-bullet-slot data-item-name="${escapeHtml(itemName)}" data-item-summary="${escapeHtml(summary)}" data-item-status="${escapeHtml(status)}" title="${escapeHtml(`骰 ${slot.number}・${part}：${itemName}｜${status}｜${summary}`)}">
        <span class="bullet-slot-head">
          <b class="bullet-slot-die">骰 ${escapeHtml(slot.number || "?")}</b>
          <em class="bullet-slot-part">${escapeHtml(part)}</em>
          <i class="bullet-slot-status">${escapeHtml(status)}</i>
        </span>
        <span class="bullet-slot-body">
          <span class="bullet-slot-image">${slot.itemImage ? `<img src="${escapeHtml(slot.itemImage)}" alt="${escapeHtml(itemName)}">` : "∅"}</span>
          <span class="bullet-slot-copy">
            <strong>${escapeHtml(itemName)}</strong>
            <small>${escapeHtml(summary)}</small>
          </span>
        </span>
      </button>`;
    }).join("")}</span>`;
  }

  function postgameMechanicStateHtml(mechanic) {
    const state = mechanic?.state || {};
    switch (mechanic?.key) {
      case "postgame_shiki":
        return state.finalDuel
          ? `<strong>金獅子決戰</strong><span>三島全毀・島嶼減傷解除</span><span>史基雙攻與速度提升，閃避下降</span>`
          : `<span class="shiki-island-list">${(state.islands || []).map((island) => {
            const hpRate = Math.max(0, Math.min(100, Math.round(Number(island.currentHp || 0) / Math.max(1, Number(island.maxHp || 1)) * 100)));
            const image = island.destroyed ? island.brokenImage : island.image;
            return `<span class="shiki-island-card ${island.active ? "is-active" : ""} ${island.destroyed ? "is-destroyed" : ""}" title="${escapeHtml(island.effect || "")}">
              <img src="${escapeHtml(image || "")}" alt="${escapeHtml(island.name || "漂浮島")}">
              <strong>${escapeHtml(island.name || "漂浮島")}${island.active ? "・護航中" : island.destroyed ? "・已墜落" : ""}</strong>
              <span class="shiki-island-mini-hp"><i style="--shiki-mini-hp:${hpRate}%"></i></span>
              <small>${escapeHtml(island.destroyed ? "效果解除" : island.effect || "")}</small>
            </span>`;
          }).join("")}</span>${state.exposedActions ? `<strong>破綻：下次直攻史基 +50%</strong>` : ""}`;
      case "postgame_gild_tesoro": {
        const crewState = `<span class="tesoro-control-crew">${(state.crew || []).map((card) => {
          const gold = Math.max(0, Math.min(3, Number(card.gold || 0)));
          return `<span class="tesoro-control-card ${card.active ? "is-active" : ""}" title="${escapeHtml(`${card.name}・金流淹沒 ${gold}/3`)}"><span class="postgame-mechanic-mini-crew"><img src="${escapeHtml(card.portrait || PLACEHOLDER_BATTLE_PORTRAIT)}" alt="${escapeHtml(card.name)}"><b>${gold}/3</b></span><span class="tesoro-control-copy"><strong>${escapeHtml(card.name)}</strong>${postgamePips(gold, 3, { danger: gold >= 3 })}</span></span>`;
        }).join("")}</span>`;
        const phaseCopy = Number(state.phase || 1) === 2
          ? `<strong>第二階段・Golden Tesoro</strong><span>金流仍按每名船員各自累積；巨體防禦使受到的傷害只保留 ${Math.max(0, Number(state.goldenDamageRetainedPercent || 40))}%。</span>`
          : `<strong>第一階段・金流河</strong>`;
        return `${phaseCopy}${crewState}<span>存活時每次被泰佐洛命中增加一段；三段全滿改用一般純文字替補清單，退到後排後清空。致死命中改走一般倒下流程。</span>`;
      }
      case "postgame_zephyr":
        return `<span class="zephyr-end-point-operation">
          <span class="zephyr-end-point-card is-destroyed"><img src="${escapeHtml(state.dynaStoneImage || "")}" alt=""><strong>終結點Ⅰ</strong><small>已爆破</small></span>
          <span class="zephyr-end-point-card is-destroyed"><img src="${escapeHtml(state.dynaStoneImage || "")}" alt=""><strong>終結點Ⅱ</strong><small>已爆破</small></span>
          <span class="zephyr-end-point-card ${state.detonated ? "is-destroyed" : state.dynaRockDisarmed ? "is-safe" : "is-active"}"><img src="${escapeHtml(state.dynaStoneImage || "")}" alt=""><strong>終結點Ⅲ</strong><small>${escapeHtml(state.detonated ? "連鎖崩壞" : state.dynaRockDisarmed ? "炸藥岩已解除" : `倒數 ${state.countdown}/${state.countdownTotal}`)}</small></span>
        </span>
        <span class="zephyr-end-point-progress"><strong>${state.detonated ? "爆破計畫完成" : state.dynaRockDisarmed ? "最後終結點保住了" : `解除進度 ${state.disarmProgress}/${state.disarmTarget}`}</strong>${postgamePips(state.disarmProgress, state.disarmTarget, { danger: !state.dynaRockDisarmed })}<span>${state.lastDisarmRoll ? `上次骰 ${state.lastDisarmRoll}・推進 ${state.lastDisarmGain}` : "點擊澤法左側的炸藥岩，放棄本次攻擊並進行解除"}</span></span>
        <span>${state.phase === 2 ? `黑腕決戰・教官會看破同一角色連續重複的招式${state.dynaRockDisarmed ? "" : "；炸藥岩倒數仍繼續"}` : "Battle Smasher 階段・半血後轉為黑腕決戰"}</span>`;
      case "postgame_tot_musica":
        return `<strong>第 ${state.movement || 1} 樂章</strong><span>${state.assigned ? `現實 ${state.realIndices?.length || 0} 人／歌世界 ${state.songIndices?.length || 0} 人` : "等待雙世界分隊"}</span><span>${state.lastRealFirstDie && state.lastSongFirstDie ? `第一骰 ${state.lastRealFirstDie}（${state.lastRealFirstDie % 2 ? "單" : "雙"}）／${state.lastSongFirstDie}（${state.lastSongFirstDie % 2 ? "單" : "雙"}）` : state.lastSync === "pending" ? "同奇偶完整同步；不同奇偶保留 5%" : "等待下一次奇偶判定"}</span><span>${state.lastSync === "success" ? "奇偶同步成功" : state.lastSync === "parity_mismatch" ? "奇偶不同・分流直擊 5%" : state.lastSync === "no_attack_roll" ? "至少一邊沒有直接攻擊骰" : "同屬性 +50%／同點 +50%／同攻擊類別 +20%"}</span>`;
      case "postgame_douglas_bullet":
        return postgameBulletSlotsHtml(state);
      case "postgame_saga":
        return `<strong>血祭 ${state.blood || 0}/75</strong>${postgamePips(state.blood >= 75 ? 3 : state.blood >= 50 ? 2 : state.blood >= 25 ? 1 : 0, 3, { labels: ["25", "50", "75"], danger: true })}<span>${state.fused ? "七星劍完全融合" : "流血也會供養七星劍"}</span>`;
      case "postgame_vinsmoke_judge":
        return `<strong>複製兵 ${state.clones || 0}/3</strong>${postgamePips(state.clones, 3)}<span>生產 ${state.production || 0}/${state.productionMax || 3}</span>`;
      case "postgame_rob_lucci_awakened":
        return `<span class="postgame-mechanic-pips">${(state.powers || []).map((power) => `<i class="postgame-mechanic-pip lucci ${power.used ? "active" : ""} ${power.current ? "current" : ""} ${state.rokuoganPending ? "danger" : ""}" title="${escapeHtml(`${power.name}・${power.statLabel || "能力"}提高 80%${power.current ? "（本次行動生效）" : power.used ? "（已使用）" : "（尚未使用）"}`)}">${escapeHtml(power.name)}</i>`).join("")}</span><strong>${state.rokuoganPending ? "必中六王銃待發" : state.activePower ? `本次：${escapeHtml(state.activePower)}・${escapeHtml(state.activePowerEffect)}` : "等待抽取六式"}</strong><span>${state.rokuoganPending ? "六王銃後重新洗入六式" : `已用 ${state.usedCount || 0}/6・剩餘 ${state.remainingCount ?? 6} 式`}</span>`;
      case "postgame_king":
        return `<strong>${state.flameOn ? "背火點燃" : "背火熄滅"}</strong>${postgamePips(state.flameOn ? 1 : 0, 1, { danger: state.flameOn })}<span>${state.vulnerable ? "現在是輸出窗口" : "火焰覆體・傷害大幅削弱"}</span>`;
      case "postgame_charlotte_katakuri":
        return `<strong>${state.forecastRolling ? "預知骰擲骰中" : state.forecastDie ? `預知骰 ${state.forecastDie}` : "預知未來"}</strong>${state.forecastDie ? postgamePips(state.forecastDie, 6, { danger: state.forecastDie >= 5 }) : ""}<span>${state.defenseRolling ? "正在擲防禦骰" : state.choicePending ? "選擇正面出招或防禦" : state.choiceMode === "defend" ? `防禦骰 ${state.defenseDie}・減傷 ${state.defenseReductionPercent}%` : state.choiceMode === "move" ? `一般行動可用・出招第一骰需達 ${state.forecastDie}` : "每次行動前重新預知"}</span>${state.lastPlayerFirstDie ? `<span>${state.lastOutcome === "predicted" ? "招式被預見失效" : state.lastOutcome === "breakthrough" ? "第一骰突破未來視" : ""}・第一骰 ${state.lastPlayerFirstDie}</span>` : ""}`;
      case "postgame_patrick_redfield":
        return `<span class="postgame-mechanic-crew">${(state.crew || []).map((card) => `<span class="postgame-mechanic-mini-crew" title="${escapeHtml(`${card.name} HP ${card.currentHp}/${card.maxHp}`)}"><img src="${escapeHtml(card.portrait || PLACEHOLDER_BATTLE_PORTRAIT)}" alt="${escapeHtml(card.name)}"></span>`).join("")}</span><span>上次吸收 ${state.lastDrainPercent || 0}%／${state.lastDrainTotal || 0} HP</span>`;
      case "postgame_oars": {
        const result = state.lastResult;
        const lockedStake = (state.lockedPredictions || []).reduce((sum, bet) => sum + Math.max(0, Number(bet.stake ?? 1)), 0);
        const resultText = result?.voided
          ? `上次下注取消，已退回 ${result.refunded || result.stake || 0} 包`
          : result
            ? `上次 ${result.wonCount || 0} 項命中、${result.lostCount || 0} 項落空，回收 ${result.gained || 0} 包`
            : state.lockedPredictions?.length
              ? `已押 ${lockedStake} 包／${state.lockedPredictions.length} 項：${state.lockedPredictions.map((bet) => `${bet.label} ${Math.max(0, Number(bet.stake ?? 1))} 包`).join("、")}`
              : `等待下注・再 ${state.nextPeriodicSaltIn || 3} 回合補 1 包`;
        return `<strong>鹽袋 ${state.saltBags || 0}/${state.saltTarget || 15}</strong>${postgamePips(state.saltBags, state.saltTarget || 15)}<span>${escapeHtml(resultText)}</span>`;
      }
      case "postgame_aramaki":
        return `<strong>森林 ${state.groves || 0}/4</strong>${postgamePips(state.groves, 4)}<span>${state.revived ? "種子再生已使用" : state.fireproof ? "防火林保護中" : "火焰可多清一片"}</span>`;
      default:
        return "";
    }
  }

  function shikiArchipelagoTargetId(islandId) {
    return `shiki_island_${String(islandId || "")}`;
  }

  function shikiArchipelagoSlot(islandId) {
    return Array.from(refs.shikiArchipelagoStage?.querySelectorAll("[data-shiki-island-id]") || [])
      .find((entry) => entry.dataset.shikiIslandId === String(islandId || "")) || null;
  }

  function shikiArchipelagoCardHtml(island, index, { breaking = false, pendingBreak = false } = {}) {
    const hpRate = Math.max(0, Math.min(100, Math.round(Number(island.currentHp || 0) / Math.max(1, Number(island.maxHp || 1)) * 100)));
    const targetId = shikiArchipelagoTargetId(island.id);
    const selected = selectedPostgameTargetId === targetId;
    const image = breaking ? island.brokenImage || island.image : island.image;
    const label = breaking ? `${island.name || "漂浮島"}・崩落` : `${island.name || "漂浮島"} ${island.currentHp || 0}/${island.maxHp || 1}`;
    const effect = breaking ? "完全墜出戰場・效果解除" : pendingBreak ? "攻擊命中後即將崩落" : island.effect || "";
    return `<button class="shiki-archipelago-slot${selected ? " is-selected" : ""}${breaking ? " is-breaking" : ""}${pendingBreak ? " is-pending-break" : ""}" type="button" data-shiki-island-id="${escapeHtml(island.id || "")}" data-shiki-target-id="${escapeHtml(targetId)}" style="--shiki-float-delay:${(-index * 0.72).toFixed(2)}s" title="${escapeHtml(`選為攻擊目標：${island.name || "漂浮島"}；${island.effect || ""}`)}" ${breaking ? "disabled" : ""}>
      <img class="shiki-archipelago-island" src="${escapeHtml(image || "")}" alt="${escapeHtml(label)}">
      <span class="shiki-archipelago-info">
        <strong>${escapeHtml(label)}</strong>
        <span class="shiki-archipelago-hp"><i style="--shiki-island-hp:${hpRate}%"></i></span>
        <small>${escapeHtml(effect)}</small>
      </span>
    </button>`;
  }

  function finishShikiIslandBreak(stage, islandId) {
    const id = String(islandId || "");
    const timer = shikiArchipelagoBreakTimers.get(id);
    if (timer) clearTimeout(timer);
    shikiArchipelagoBreakTimers.delete(id);
    shikiArchipelagoBreakingIslandIds.delete(id);
    shikiArchipelagoSlot(islandId)?.remove();
    if (!shikiArchipelagoBreakingIslandIds.size) {
      shikiArchipelagoRenderKey = "";
      renderShikiArchipelago(latestView?.battle?.postgameBossMechanic);
    }
    if (!stage.querySelector("[data-shiki-island-id]") && !shikiArchipelagoBreakingIslandIds.size) {
      stage.hidden = true;
      refs.enemyCard?.classList.remove("has-shiki-archipelago");
    }
  }

  function renderShikiArchipelago(mechanic) {
    const stage = refs.shikiArchipelagoStage;
    if (!stage) return;
    const state = mechanic?.active && mechanic.key === "postgame_shiki" ? mechanic.state || {} : null;
    if ([...shikiArchipelagoBreakingIslandIds].some((islandId) => shikiArchipelagoSlot(islandId)?.classList.contains("is-breaking"))) return;
    const eventSerial = Math.max(0, Number(state?.eventSerial || 0));
    const lastEvent = state?.lastEvent || null;
    const visualEvent = latestView?.battle?.visualEvent || null;
    const pendingImpactBreak = state
      && lastEvent?.type === "break"
      && eventSerial > lastShikiArchipelagoEventSerial
      && visualEvent?.type === "attack"
      && visualEvent?.shikiIslandDestroyed
      && visualEvent?.shikiIslandId === lastEvent.islandId;
    const autoPlayBreak = state
      && lastEvent?.type === "break"
      && eventSerial > lastShikiArchipelagoEventSerial
      && !pendingImpactBreak;
    if (!state) {
      shikiArchipelagoBreakTimers.forEach((timer) => clearTimeout(timer));
      shikiArchipelagoBreakTimers.clear();
      shikiArchipelagoRenderKey = "";
      shikiArchipelagoBreakingIslandIds.clear();
      stage.hidden = true;
      stage.innerHTML = "";
      refs.enemyCard?.classList.remove("has-shiki-archipelago");
      return;
    }
    const visualIslands = visualEvent?.type === "attack"
      && completedImpactEventId !== visualEvent.id
      && Array.isArray(visualEvent.shikiIslandVisualIslands)
      && visualEvent.shikiIslandVisualIslands.length
      ? visualEvent.shikiIslandVisualIslands
      : null;
    const visibleIslands = (visualIslands || state.islands || []).filter((island) => !island.destroyed || ((pendingImpactBreak || autoPlayBreak) && island.id === lastEvent?.islandId));
    if (!visibleIslands.length) {
      shikiArchipelagoRenderKey = "";
      stage.hidden = true;
      stage.innerHTML = "";
      refs.enemyCard?.classList.remove("has-shiki-archipelago");
      return;
    }
    const renderKey = JSON.stringify({
      selectedPostgameTargetId,
      eventSerial,
      pendingImpactBreak,
      autoPlayBreak,
      visualEventId: visualIslands ? visualEvent?.id || "" : "",
      islands: visibleIslands.map((island) => [island.id, island.currentHp, island.maxHp, island.destroyed]),
    });
    if (renderKey === shikiArchipelagoRenderKey) return;
    shikiArchipelagoRenderKey = renderKey;
    stage.className = "shiki-archipelago-stage";
    stage.innerHTML = visibleIslands.map((island, index) => shikiArchipelagoCardHtml(island, index, {
      breaking: autoPlayBreak && island.id === lastEvent?.islandId,
      pendingBreak: pendingImpactBreak && island.id === lastEvent?.islandId,
    })).join("");
    stage.hidden = false;
    refs.enemyCard?.classList.add("has-shiki-archipelago");
    if (autoPlayBreak) {
      lastShikiArchipelagoEventSerial = eventSerial;
      const breakingId = String(lastEvent.islandId || "");
      shikiArchipelagoBreakingIslandIds.add(breakingId);
      const timer = setTimeout(() => finishShikiIslandBreak(stage, breakingId), 1620);
      shikiArchipelagoBreakTimers.set(breakingId, timer);
    } else if (!pendingImpactBreak && eventSerial > lastShikiArchipelagoEventSerial) {
      lastShikiArchipelagoEventSerial = eventSerial;
    }
  }

  function playShikiIslandBreakAtImpact(event, islandId = event?.shikiIslandId) {
    const stage = refs.shikiArchipelagoStage;
    const mechanic = latestView?.battle?.postgameBossMechanic;
    const state = mechanic?.key === "postgame_shiki" ? mechanic.state || {} : {};
    const requestedId = String(islandId || "");
    const breakEntry = (event?.shikiIslandBreaks || []).find((entry) => String(entry?.islandId || "") === requestedId) || null;
    const island = (event?.shikiIslandVisualIslands || state.islands || []).find((entry) => entry.id === requestedId);
    const slot = shikiArchipelagoSlot(requestedId);
    if (!stage || !event?.shikiIslandDestroyed || !requestedId || !slot || !island) return;
    if (shikiArchipelagoBreakingIslandIds.has(requestedId)) return;
    lastShikiArchipelagoEventSerial = Math.max(lastShikiArchipelagoEventSerial, Number(state.eventSerial || 0));
    stage.hidden = false;
    refs.enemyCard?.classList.add("has-shiki-archipelago");
    slot.classList.remove("is-pending-break", "is-selected");
    slot.classList.add("is-breaking");
    shikiArchipelagoBreakingIslandIds.add(requestedId);
    slot.disabled = true;
    const image = slot.querySelector(".shiki-archipelago-island");
    const label = slot.querySelector(".shiki-archipelago-info strong");
    const effect = slot.querySelector(".shiki-archipelago-info small");
    if (image) {
      image.src = breakEntry?.brokenImage || island.brokenImage || island.image || "";
      image.alt = `${breakEntry?.islandName || island.name || "漂浮島"}崩落`;
    }
    if (label) label.textContent = `${breakEntry?.islandName || island.name || "漂浮島"}・崩落`;
    if (effect) effect.textContent = "完全墜出戰場・效果解除";
    const timer = setTimeout(() => finishShikiIslandBreak(stage, requestedId), 1620);
    shikiArchipelagoBreakTimers.set(requestedId, timer);
  }

  function renderZephyrDynaStoneTarget(view) {
    const target = refs.zephyrDynaStoneTarget;
    const mechanic = view?.battle?.postgameBossMechanic;
    const state = mechanic?.state || {};
    const visible = mechanic?.active
      && mechanic.key === "postgame_zephyr"
      && !!state.countdownActive
      && !state.dynaRockDisarmed
      && !state.detonated;
    refs.enemyCard?.classList.toggle("has-zephyr-dyna-target", visible);
    if (!target) return;
    target.hidden = !visible;
    target.onclick = null;
    if (!visible) {
      target.disabled = true;
      target.removeAttribute("aria-busy");
      return;
    }
    const progress = Math.max(0, Number(state.disarmProgress || 0));
    const progressTarget = Math.max(1, Number(state.disarmTarget || 3));
    const countdown = Math.max(0, Number(state.countdown || 0));
    const canChoose = !!state.canDisarm && !actionDisabled(view);
    target.disabled = !canChoose;
    target.removeAttribute("aria-busy");
    if (refs.zephyrDynaStoneTargetImage) {
      refs.zephyrDynaStoneTargetImage.src = state.dynaStoneImage || "images/board/battle/postgame_mechanics/postgame_zephyr/dyna_stone_cylinder_v2.webp";
    }
    if (refs.zephyrDynaStoneTargetState) {
      refs.zephyrDynaStoneTargetState.textContent = `進度 ${progress}/${progressTarget}・倒數 ${countdown}`;
    }
    target.setAttribute("aria-label", `解除炸藥岩，進度 ${progress}/${progressTarget}，倒數 ${countdown}`);
    target.title = canChoose ? "放棄本次攻擊，嘗試解除炸藥岩" : "等待本輪可行動時解除炸藥岩";
    target.onclick = (event) => {
      event.stopPropagation();
      if (target.disabled || actionDisabled(latestView)) return;
      const accepted = callBattleAction("battleZephyrDisarm", "zephyr-disarm", {});
      if (accepted === false) {
        showStatus("目前無法處理炸藥岩，請等待本輪行動完成。");
        return;
      }
      target.disabled = true;
      target.setAttribute("aria-busy", "true");
      currentMode = null;
      renderClosedPanel();
      showStatus("正在解除炸藥岩；也可選擇攻擊指令直接迎戰澤法。");
    };
  }

  function renderPostgameMechanic(view) {
    const mechanic = view?.battle?.postgameBossMechanic;
    renderZephyrDynaStoneTarget(view);
    if (!refs.postgameMechanicPanel) return;
    refs.postgameMechanicPanel.classList.toggle("is-bullet", mechanic?.active && mechanic.key === "postgame_douglas_bullet");
    refs.postgameMechanicPanel.classList.toggle("is-shiki", mechanic?.active && mechanic.key === "postgame_shiki");
    refs.postgameMechanicPanel.classList.toggle("is-tesoro", mechanic?.active && mechanic.key === "postgame_gild_tesoro");
    refs.postgameMechanicPanel.classList.toggle("is-zephyr", mechanic?.active && mechanic.key === "postgame_zephyr");
    if (!mechanic?.active) {
      refs.postgameMechanicPanel.hidden = true;
      refs.postgameBossTargets.innerHTML = "";
      selectedPostgameTargetId = "boss";
      postgameMechanicDetailOpen = false;
      postgameMechanicDetailKey = "";
      renderShikiArchipelago(null);
      return;
    }
    refs.postgameMechanicPanel.hidden = !postgameMechanicDetailOpen;
    refs.postgameMechanicFrame.src = mechanic.panelImage || "images/board/battle/postgame_mechanics/postgame_boss_mechanic_panel_v1.png";
    refs.postgameMechanicIsland.src = mechanic.iconUrl || mechanic.islandImage || "";
    refs.postgameMechanicIsland.alt = mechanic.title || "Boss 特殊機制";
    refs.postgameMechanicTitle.textContent = mechanic.title || "Boss 特殊機制";
    refs.postgameMechanicRule.textContent = mechanic.rule || mechanic.subtitle || "進入戰鬥後依目前狀態調整行動。";
    refs.postgameMechanicCounter.textContent = mechanic.counter || "留意目前狀態與危險提示，選擇可中斷機制的行動。";
    refs.postgameMechanicState.innerHTML = postgameMechanicStateHtml(mechanic);
    const targets = Array.isArray(mechanic.targets) ? mechanic.targets : [];
    if (!targets.some((target) => target.id === selectedPostgameTargetId)) selectedPostgameTargetId = "boss";
    refs.postgameBossTargets.innerHTML = targets.length > 1
      ? targets.map((target) => `<button class="postgame-boss-target ${target.id === selectedPostgameTargetId ? "active" : ""}" type="button" data-postgame-target="${escapeHtml(target.id)}" title="${escapeHtml(target.description || target.label)}">${escapeHtml(target.label)}</button>`).join("")
      : "";
    refs.postgameBossTargets.querySelectorAll("[data-postgame-target]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedPostgameTargetId = button.dataset.postgameTarget || "boss";
        renderPostgameMechanic(latestView);
        showStatus(`攻擊目標：${button.textContent.trim()}`);
      });
    });
    refs.postgameMechanicState.querySelectorAll("[data-bullet-slot]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        showStatusPopover(button, {
          label: `六孔裝甲：${button.dataset.itemName || "未裝備"}`,
          result: button.dataset.itemStatus || "孔位狀態",
          durationText: "點擊 Boss 徽章可隨時回看",
          description: button.dataset.itemSummary || "沒有攜帶物效果。",
        });
      });
    });
    renderShikiArchipelago(mechanic);
  }

  function renderAttack(view) {
    refs.infoPanel?.classList.remove("is-hidden");
    refs.infoTitle.textContent = "";
    const moves = (view?.activeCard?.moves || []).slice(0, 4);
    if (!moves.length) {
      refs.infoContent.innerHTML = `
        <section class="battle-command-ui" aria-label="招式">
          <img class="battle-command-panel-frame" src="images/board/battle_switch_ui/battle_switch_panel_frame.webp" alt="" aria-hidden="true">
          <header class="battle-command-heading">
            <strong>招式</strong>
            <span>選擇本回合使用的招式</span>
          </header>
          <div class="battle-command-body">
            <div class="battle-command-empty">
              <img class="battle-command-notice-frame" src="images/board/battle_command_ui/battle_command_notice_frame.webp" alt="" aria-hidden="true">
              <span class="battle-command-notice-copy">
                <span class="battle-command-notice-meta">目前沒有可用技能。</span>
              </span>
            </div>
          </div>
        </section>
      `;
      return;
    }
    const disabled = actionDisabled(view);
    refs.infoContent.innerHTML = `
      <section class="battle-command-ui" aria-label="招式">
        <img class="battle-command-panel-frame" src="images/board/battle_switch_ui/battle_switch_panel_frame.webp" alt="" aria-hidden="true">
        <header class="battle-command-heading">
          <strong>招式</strong>
          <span>選擇本回合使用的招式</span>
        </header>
        <div class="battle-command-body battle-command-grid">
          ${moves.map((move) => `
            ${(() => {
              const detail = moveDetailLines(move);
              return `
            <button class="battle-command-choice" type="button" data-move-id="${escapeHtml(move.id)}" data-move-type="${escapeHtml(move.type)}" title="${escapeHtml(detail.fullEffectText || move.effectText || "")}" ${disabled || move.currentPP <= 0 ? "disabled" : ""}>
              <img class="battle-command-choice-frame" src="images/board/battle_command_ui/battle_command_choice_button_frame.webp" alt="" aria-hidden="true">
              <span class="battle-command-choice-copy">
                <strong class="battle-command-choice-name">${escapeHtml(move.displayName || move.name)}</strong>
                <span class="battle-command-choice-meta">${escapeHtml(detail.compactLine)}</span>
              </span>
            </button>
              `;
            })()}
          `).join("")}
        </div>
      </section>
    `;
    refs.infoContent.querySelectorAll("[data-move-id]").forEach((button) => {
      button.addEventListener("click", () => {
        previewMovePortrait(button.dataset.moveType);
        if (selectTotMusicaSequentialAction({ type: "move", moveId: button.dataset.moveId })) return;
        callBattleAction("battleChooseMove", "move", { moveId: button.dataset.moveId, targetId: selectedPostgameTargetId });
        currentMode = null;
        renderClosedPanel();
        showStatus("已選擇技能，戰鬥判定中。");
      });
    });
  }

  function renderPartners(view) {
    refs.infoPanel?.classList.remove("is-hidden");
    refs.infoTitle.textContent = "";
    const crew = view?.player?.crew || [];
    if (!crew.length) {
      refs.infoContent.innerHTML = `<div class="empty-state">目前沒有可切換的夥伴。</div>`;
      return;
    }
    const disabled = actionDisabled(view);
    const switchLocked = Number(view?.battle?.yonkoStatus?.captureTurns || 0) > 0 || Number(view?.battle?.finalGateStatus?.blackTurns || 0) > 0;
    refs.infoContent.innerHTML = `
      <section class="battle-switch-ui" aria-label="選擇上場夥伴">
        <img class="battle-switch-panel-frame" src="images/board/battle_switch_ui/battle_switch_panel_frame.webp" alt="" aria-hidden="true">
        <header class="battle-switch-heading">
          <strong>換人</strong>
          <span>${switchLocked ? "目前上場角色被拘束，暫時不能換人。" : "換人等同一個完整動作，本回合將不再攻擊。"}</span>
        </header>
        <div class="battle-switch-grid">
          ${crew.map((card, index) => {
            const crewIndex = Number.isInteger(Number(card.index)) ? Number(card.index) : index;
            const cardDisabled = disabled || switchLocked || card.isActive || card.currentHp <= 0;
            const stateClass = card.isActive ? "is-active" : card.currentHp <= 0 ? "is-ko" : switchLocked ? "is-locked" : "is-ready";
            const statusText = card.isActive ? "上場中" : card.currentHp <= 0 ? "瀕死" : switchLocked ? "受拘束" : "切換上場";
            const portraits = card?.battlePortraits || {};
            const portrait = portraits.normal || portraits.idle || portraits.morale || portraits.attack || PLACEHOLDER_BATTLE_PORTRAIT;
            return `
              <button class="battle-switch-card ${stateClass}" type="button" data-switch-index="${crewIndex}" aria-label="${escapeHtml(`${card.name}，${statusText}`)}" ${cardDisabled ? "disabled" : ""}>
                <img class="battle-switch-card-frame" src="images/board/battle_switch_ui/battle_switch_crew_row_frame.webp" alt="" aria-hidden="true">
                <span class="battle-switch-portrait">
                  <img src="${escapeHtml(portrait)}" alt="${escapeHtml(card.name)}" onerror="this.onerror=null;this.src='${PLACEHOLDER_BATTLE_PORTRAIT}';">
                </span>
                <strong class="battle-switch-name">${escapeHtml(card.name)}</strong>
                <span class="battle-switch-meta primary">Lv.${escapeHtml(card.level || 1)} ・ ${escapeHtml(card.attribute || "無")}</span>
                <span class="battle-switch-meta secondary">HP ${escapeHtml(card.currentHp)}/${escapeHtml(card.maxHp)} ・ PP ${escapeHtml(card.totalPP)}</span>
                <span class="battle-switch-status">${statusText}</span>
              </button>
            `;
          }).join("")}
        </div>
      </section>
    `;
    refs.infoContent.querySelectorAll("[data-switch-index]").forEach((button) => {
      button.addEventListener("click", () => {
        if (selectTotMusicaSequentialAction({ type: "switch", nextIndex: Number(button.dataset.switchIndex) })) return;
        callBattleAction("battleChooseSwitch", "switch", { nextIndex: Number(button.dataset.switchIndex) });
        currentMode = null;
        renderClosedPanel();
        showStatus("已選擇換上夥伴。");
      });
    });
  }

  function renderYonkoPrompt(view) {
    refs.infoPanel?.classList.remove("is-hidden");
    refs.infoTitle.textContent = "";
    const prompt = view?.battle?.yonkoPrompt || {};
    const options = prompt.options || {};
    const buttons = [
      options.hp ? { choice: "hp", label: "支付 HP", desc: "目前上場角色失去最大 HP 12%，不會因此直接倒下。" } : null,
      options.pp ? { choice: "pp", label: "支付 PP", desc: "目前上場角色隨機 1 個可用技能 PP -1。" } : null,
      options.coins ? { choice: "coins", label: "支付 300 貝里", desc: "消耗 300 貝里化解本次靈魂拷問。" } : null,
      options.item ? { choice: "item", label: `支付 ${options.item.name}`, desc: "消耗 1 個低階補給或素材。" } : null,
      options.refuse ? { choice: "refuse", label: "拒絕支付", desc: "不消耗資源，但會立刻承受霍米茲追擊。" } : null,
    ].filter(Boolean);
    refs.infoContent.innerHTML = `
      <div class="battle-result-box">
        <div class="battle-result-title">${escapeHtml(prompt.title || "四皇機制")}</div>
        <div class="battle-result-reward-line">${escapeHtml(prompt.message || "請選擇處理方式。")}</div>
      </div>
      <div class="skill-scroll"><div class="skill-grid">
        ${buttons.map((button) => `
          <button class="choice-button" type="button" data-yonko-soul-choice="${escapeHtml(button.choice)}">
            <div class="choice-name">${escapeHtml(button.label)}</div>
            <div class="choice-meta">${escapeHtml(button.desc)}</div>
          </button>
        `).join("")}
      </div></div>
    `;
    refs.infoContent.querySelectorAll("[data-yonko-soul-choice]").forEach((button) => {
      button.addEventListener("click", () => {
        button.disabled = true;
        callBattleAction("battleYonkoSoulChoice", "yonkoSoulChoice", { choice: button.dataset.yonkoSoulChoice });
        showStatus("已送出靈魂拷問選擇。");
      });
    });
  }

  function renderJudicialSwitchPrompt(view) {
    refs.infoPanel?.classList.remove("is-hidden");
    refs.infoTitle.textContent = "";
    const prompt = view?.battle?.judicialSwitchPrompt || {};
    const candidates = (prompt.candidates || []).filter((card) => card.currentHp > 0);
    if (!candidates.length) {
      refs.infoContent.innerHTML = `<div class="empty-state">沒有可上場的夥伴，無法進入下一戰。</div>`;
      return;
    }
    rememberPanelScroll("judicialSwitch");
    refs.infoContent.innerHTML = `
      <div class="battle-result-box judicial-switch-box">
        <div class="battle-result-title">下一戰：${escapeHtml(prompt.nextEnemyName || "下一名敵人")}</div>
        <div class="battle-result-reward-line">選擇要派上場的夥伴。可以維持目前角色，也可以換成場下隊友。</div>
      </div>
      <div class="partner-scroll"><div class="partner-grid">
        ${candidates.map((card) => `
          <button class="choice-button" type="button" data-judicial-switch-index="${escapeHtml(card.index)}">
            <div class="choice-name">${escapeHtml(card.name)}${card.index === prompt.currentIndex ? "・目前上場" : ""}</div>
            <div class="choice-meta">Lv.${escapeHtml(card.level || 1)} ・ ${escapeHtml(card.attribute || "")}</div>
            <div class="choice-meta">HP ${escapeHtml(card.currentHp)}/${escapeHtml(card.maxHp)} ・ 剩餘 PP ${escapeHtml(card.totalPP)}</div>
          </button>
        `).join("")}
      </div></div>
    `;
    refs.infoContent.querySelectorAll("[data-judicial-switch-index]").forEach((button) => {
      button.addEventListener("click", () => {
        callBattleAction("battleJudicialNextSwitch", "judicial-next-switch", { nextIndex: Number(button.dataset.judicialSwitchIndex) });
        currentMode = null;
        renderClosedPanel();
        showStatus("已選擇下一戰上場角色。");
      });
    });
    restorePanelScroll("judicialSwitch");
  }

  function renderReplacement(view) {
    refs.infoPanel?.classList.remove("is-hidden");
    refs.infoTitle.textContent = "";
    if (!viewerCanControlBattle(view)) {
      refs.infoContent.innerHTML = `<div class="empty-state">${escapeHtml(viewerBattleLockMessage(view))}</div>`;
      return;
    }
    const candidates = (view?.battle?.replacementCandidates || []).filter((card) => card.currentHp > 0);
    const relayFlagReplacement = view?.battle?.replacementReason === "relay-pirate-flag";
    if (!candidates.length) {
      refs.infoContent.innerHTML = `<div class="empty-state">沒有可替補的夥伴，請返回地圖結算。</div>`;
      return;
    }
    rememberPanelScroll("replacement");
    refs.infoContent.innerHTML = `
      ${relayFlagReplacement ? `<div class="battle-result-box"><div class="battle-result-title">交棒海賊旗啟動</div><div class="battle-result-reward-line">目前角色已完成行動，選擇下一名船員上場準備下一回合。</div></div>` : ""}
      <div class="partner-scroll"><div class="partner-grid">
        ${candidates.map((card) => `
          <button class="choice-button" type="button" data-replacement-index="${escapeHtml(card.index)}">
            <div class="choice-name">${escapeHtml(card.name)}</div>
            <div class="choice-meta">Lv.${escapeHtml(card.level || 1)} ・ ${escapeHtml(card.attribute || "")}</div>
            <div class="choice-meta">HP ${escapeHtml(card.currentHp)}/${escapeHtml(card.maxHp)} ・ 剩餘 PP ${escapeHtml(card.totalPP)}</div>
          </button>
        `).join("")}
      </div></div>
    `;
    refs.infoContent.querySelectorAll("[data-replacement-index]").forEach((button) => {
      button.addEventListener("click", () => {
        callBattleAction("battleChooseReplacement", "replacement", { nextIndex: Number(button.dataset.replacementIndex) });
        currentMode = null;
        renderClosedPanel();
        showStatus("已選擇下一位上場夥伴。");
      });
    });
    restorePanelScroll("replacement");
  }

  function replacementPanelKnockoutKey(view) {
    const battle = view?.battle || {};
    const active = view?.activeCard || {};
    return [
      battle.playerId || view?.player?.id || "",
      battle.activeCrewIndex ?? "",
      active.id || active.key || active.name || "",
      active.currentHp ?? "",
    ].join("|");
  }

  function replacementNeedsKnockoutDelay(view) {
    if (!view?.battle?.needsReplacement) return false;
    if (shouldKeepPlayerPortraitOnKnockout(view)) return false;
    return Number(view?.activeCard?.currentHp || 0) <= 0;
  }

  function clearReplacementPanelGate() {
    clearTimeout(replacementPanelTimer);
    replacementPanelTimer = null;
    replacementPanelGateKey = "";
    replacementPanelAutoKoKey = "";
    playerKnockoutPanelReadyAt = 0;
  }

  function scheduleReplacementPanelRender(readyAt) {
    clearTimeout(replacementPanelTimer);
    const delay = Math.max(80, Math.min(2600, Number(readyAt || 0) - Date.now()));
    replacementPanelTimer = setTimeout(() => {
      replacementPanelTimer = null;
      if (!latestView?.battle?.needsReplacement) return;
      currentMode = "replacement";
      renderPanel(latestView);
    }, delay);
  }

  function replacementPanelReady(view) {
    if (!replacementNeedsKnockoutDelay(view)) {
      if (!view?.battle?.needsReplacement) clearReplacementPanelGate();
      return true;
    }
    const key = replacementPanelKnockoutKey(view);
    if (replacementPanelGateKey !== key) {
      replacementPanelGateKey = key;
      replacementPanelAutoKoKey = "";
    }
    const cardGone = refs.playerCard?.classList.contains("portrait-ko");
    if (!cardGone && replacementPanelAutoKoKey !== key && !shouldKeepPlayerPortraitOnKnockout(view)) {
      replacementPanelAutoKoKey = key;
      playKnockoutAction("player", view?.activeCard?.name || "");
    }
    const readyAt = Math.max(playerKnockoutPanelReadyAt || 0, Date.now());
    if (Date.now() >= readyAt) return true;
    scheduleReplacementPanelRender(readyAt);
    return false;
  }

  function renderReplacementWaiting(view) {
    refs.infoPanel?.classList.add("is-hidden");
    refs.actionPanel?.classList.add("is-hidden");
    refs.infoPanel?.classList.remove("result-mode");
    if (refs.infoTitle) refs.infoTitle.textContent = "";
    if (refs.infoContent) refs.infoContent.innerHTML = "";
  }

  function rememberPanelScroll(key, selector = ".partner-scroll") {
    const scroller = refs.infoContent?.querySelector(selector);
    if (!scroller || !key) return;
    panelScrollTops[key] = scroller.scrollTop;
  }

  function restorePanelScroll(key, selector = ".partner-scroll") {
    const scroller = refs.infoContent?.querySelector(selector);
    if (!scroller || !key) return;
    scroller.scrollTop = panelScrollTops[key] || 0;
    scroller.addEventListener("scroll", () => {
      panelScrollTops[key] = scroller.scrollTop;
    }, { passive: true });
  }

  function battleItemRequiresCrewTarget(item = {}, view = latestView) {
    if (item.targetMode === "battle_side") return true;
    if (["living_ally", "downed_ally"].includes(item.targetMode || "")) return true;
    return item.targetMode === "party" && Array.isArray(view?.battle?.coopItemTargets) && view.battle.coopItemTargets.length > 1;
  }

  function cardMissingHp(card = {}) {
    return Number(card.currentHp || 0) > 0 && Number(card.currentHp || 0) < Math.max(1, Number(card.maxHp || 1));
  }

  function cardMissingPp(card = {}) {
    return (card.moves || []).some((move) => Number(move.pp || 0) > 0 && Number(move.currentPP ?? move.pp ?? 0) < Number(move.pp || 0));
  }

  function cardHasStatuses(card = {}, statuses = []) {
    const bag = card.statuses || {};
    const keys = Array.isArray(statuses) ? statuses.filter(Boolean) : [];
    if (!keys.length) return Object.values(bag).some((turns) => Number(turns || 0) > 0);
    return keys.some((key) => Number(bag[key] || 0) > 0);
  }

  function canTargetBattleItem(item = {}, card = {}) {
    const hp = Number(card.currentHp || 0);
    const kind = item.effectKind || "";
    if (item.targetMode === "downed_ally") return hp <= 0;
    if (hp <= 0) return false;
    if (kind === "heal_hp" || kind === "heal_hp_percent") return cardMissingHp(card);
    if (kind === "heal_percent_and_cure_status") return cardMissingHp(card) || cardHasStatuses(card, item.statuses);
    if (kind === "cure_status") return cardHasStatuses(card, item.statuses);
    if (kind === "cure_all_status") return cardHasStatuses(card);
    if (kind === "restore_skill_use") return cardMissingPp(card);
    return true;
  }

  function battleItemTargetHint(item = {}, card = {}) {
    const kind = item.effectKind || "";
    if (item.targetMode === "downed_ally") return "需要倒下的隊友";
    if (Number(card.currentHp || 0) <= 0) return "已倒下";
    if (kind === "heal_hp" || kind === "heal_hp_percent") return "HP 已滿";
    if (kind === "heal_percent_and_cure_status") return "不需要治療";
    if (kind === "cure_status" || kind === "cure_all_status") return "沒有異常";
    if (kind === "restore_skill_use") return "技能次數已滿";
    return "";
  }

  function battleCrewPpText(card = {}) {
    const moves = card.moves || [];
    const current = moves.reduce((sum, move) => sum + Number(move.currentPP ?? move.pp ?? 0), 0);
    const max = moves.reduce((sum, move) => sum + Number(move.pp || 0), 0);
    return max > 0 ? `${current}/${max}` : String(card.totalPP || 0);
  }

  function useBattleItem(itemId, targetIndex = null, targetPlayerId = "", targetSide = "") {
    selectedBattleItemId = "";
    if (selectTotMusicaSequentialAction({ type: "item", itemId, targetIndex, targetPlayerId, targetSide })) return;
    callBattleAction("battleUseItem", "item", { itemId, targetIndex, targetPlayerId, targetSide });
    currentMode = null;
    renderClosedPanel();
    showStatus(targetSide ? `已選擇${targetSide === "enemy" ? "敵方" : "我方"}作為道具目標。` : targetIndex == null ? "已使用戰鬥道具。" : "已選擇道具目標。");
  }

  function renderItems(view) {
    rememberPanelScroll("items", ".battle-command-scroll");
    refs.infoPanel?.classList.remove("is-hidden");
    refs.infoTitle.textContent = "";
    const items = view?.player?.battleItems || [];
    if (!items.length) {
      refs.infoContent.innerHTML = `
        <section class="battle-command-ui" aria-label="戰鬥道具">
          <img class="battle-command-panel-frame" src="images/board/battle_switch_ui/battle_switch_panel_frame.webp" alt="" aria-hidden="true">
          <header class="battle-command-heading">
            <strong>戰鬥道具</strong>
            <span>選擇本回合要使用的道具</span>
          </header>
          <div class="battle-command-body">
            <div class="battle-command-empty">
              <img class="battle-command-notice-frame" src="images/board/battle_command_ui/battle_command_notice_frame.webp" alt="" aria-hidden="true">
              <span class="battle-command-notice-copy">
                <span class="battle-command-notice-meta">目前沒有可用戰鬥道具。商店的戰鬥糧食與防具會出現在這裡。</span>
              </span>
            </div>
          </div>
        </section>
      `;
      return;
    }
    const disabled = actionDisabled(view);
    const selectedItem = items.find((item) => item.id === selectedBattleItemId && battleItemRequiresCrewTarget(item)) || null;
    if (selectedBattleItemId && !selectedItem) selectedBattleItemId = "";
    if (selectedItem) {
      const coopTargets = Array.isArray(view?.battle?.coopItemTargets) && view.battle.coopItemTargets.length
        ? view.battle.coopItemTargets
        : [{ id: view?.player?.id || "", name: view?.player?.name || "自己", crew: view?.player?.crew || [] }];
      if (selectedItem.targetMode === "battle_side") {
        const parityLabel = selectedItem.id === "odd_dice" ? "單數" : "雙數";
        refs.infoContent.innerHTML = `
          <section class="battle-command-ui" aria-label="選擇奇偶骰目標">
            <img class="battle-command-panel-frame" src="images/board/battle_switch_ui/battle_switch_panel_frame.webp" alt="" aria-hidden="true">
            <header class="battle-command-heading">
              <strong>使用在我方或敵方</strong>
              <span>${escapeHtml(selectedItem.name)} x${escapeHtml(selectedItem.count)}</span>
            </header>
            <div class="battle-command-body battle-item-target-layout">
              <button class="battle-command-notice-button" type="button" data-item-target-back>
                <img class="battle-command-notice-frame" src="images/board/battle_command_ui/battle_command_notice_frame.webp" alt="" aria-hidden="true">
                <span class="battle-command-notice-copy"><strong class="battle-command-notice-name">${escapeHtml(selectedItem.name)}</strong><span class="battle-command-notice-meta">返回重新選擇道具</span></span>
              </button>
              <div class="battle-item-target-grid">
                <button class="battle-command-choice" type="button" data-item-target-side="player" ${disabled ? "disabled" : ""}>
                  <img class="battle-command-choice-frame" src="images/board/battle_command_ui/battle_command_choice_button_frame.webp" alt="" aria-hidden="true">
                  <span class="battle-command-choice-copy"><strong class="battle-command-choice-name">使用在我方</strong><span class="battle-command-choice-meta">${escapeHtml(view?.activeCard?.name || "目前船員")}接下來 2 次第一顆戰鬥骰只出現${parityLabel}</span></span>
                </button>
                <button class="battle-command-choice" type="button" data-item-target-side="enemy" ${disabled ? "disabled" : ""}>
                  <img class="battle-command-choice-frame" src="images/board/battle_command_ui/battle_command_choice_button_frame.webp" alt="" aria-hidden="true">
                  <span class="battle-command-choice-copy"><strong class="battle-command-choice-name">使用在敵方</strong><span class="battle-command-choice-meta">${escapeHtml(view?.enemy?.name || "敵人")}接下來 2 次第一顆戰鬥骰只出現${parityLabel}</span></span>
                </button>
              </div>
            </div>
          </section>`;
        refs.infoContent.querySelector("[data-item-target-back]")?.addEventListener("click", () => {
          selectedBattleItemId = "";
          renderItems(view);
        });
        refs.infoContent.querySelectorAll("[data-item-target-side]").forEach((button) => {
          button.addEventListener("click", () => useBattleItem(selectedItem.id, null, "", button.dataset.itemTargetSide || "player"));
        });
        return;
      }
      const targetCards = selectedItem.targetMode === "party"
        ? coopTargets.map((targetPlayer) => {
          const living = (targetPlayer.crew || []).filter((card) => Number(card.currentHp || 0) > 0);
          const missing = living.reduce((sum, card) => sum + Math.max(0, Number(card.maxHp || 0) - Number(card.currentHp || 0)), 0);
          const portraitCard = living[0] || targetPlayer.crew?.[0] || {};
          const portraits = portraitCard.battlePortraits || {};
          return {
            targetPlayer,
            card: portraitCard,
            crewIndex: null,
            canTarget: missing > 0,
            portrait: targetPlayer.avatarUrl || portraits.normal || portraits.idle || PLACEHOLDER_BATTLE_PORTRAIT,
            name: targetPlayer.name,
            primary: `存活 ${living.length}/${(targetPlayer.crew || []).length} ・ 可回復 ${missing} HP`,
            secondary: targetPlayer.awaitingRescue ? `待救援・剩 ${targetPlayer.rescueTurnsRemaining} 回合` : "指定後只治療這名玩家的隊伍",
          };
        })
        : coopTargets.flatMap((targetPlayer) => (targetPlayer.crew || []).map((card, index) => {
          const crewIndex = Number.isInteger(Number(card.index)) ? Number(card.index) : index;
          const canTarget = canTargetBattleItem(selectedItem, card);
          const portraits = card?.battlePortraits || {};
          return {
            targetPlayer,
            card,
            crewIndex,
            canTarget,
            portrait: portraits.normal || portraits.idle || portraits.morale || portraits.attack || PLACEHOLDER_BATTLE_PORTRAIT,
            name: card.name,
            primary: `HP ${card.currentHp}/${card.maxHp} ・ 技能 ${battleCrewPpText(card)}`,
            secondary: (card.statusLabels || []).length ? `異常 ${card.statusLabels.join("、")}` : "狀態正常",
          };
        }));
      refs.infoContent.innerHTML = `
        <section class="battle-command-ui" aria-label="選擇道具目標">
          <img class="battle-command-panel-frame" src="images/board/battle_switch_ui/battle_switch_panel_frame.webp" alt="" aria-hidden="true">
          <header class="battle-command-heading">
            <strong>道具目標</strong>
            <span>${escapeHtml(selectedItem.name)} x${escapeHtml(selectedItem.count)}</span>
          </header>
          <div class="battle-command-body battle-item-target-layout">
            <button class="battle-command-notice-button" type="button" data-item-target-back>
              <img class="battle-command-notice-frame" src="images/board/battle_command_ui/battle_command_notice_frame.webp" alt="" aria-hidden="true">
              <span class="battle-command-notice-copy">
                <strong class="battle-command-notice-name">${escapeHtml(selectedItem.name)} x${escapeHtml(selectedItem.count)}</strong>
                <span class="battle-command-notice-meta">返回重新選擇道具</span>
              </span>
            </button>
            <div class="battle-item-target-grid">
              ${targetCards.map((entry) => {
                const { targetPlayer, card, crewIndex, canTarget, portrait } = entry;
                const activeText = selectedItem.targetMode === "party" ? "" : card.isActive ? "・上場中" : "・場下";
                const targetText = canTarget ? "使用" : selectedItem.targetMode === "party" ? "全隊 HP 已滿" : battleItemTargetHint(selectedItem, card);
                const stateClass = canTarget ? "is-ready" : Number(card.currentHp || 0) <= 0 ? "is-ko" : "is-locked";
                const displayedName = selectedItem.targetMode === "party"
                  ? entry.name
                  : `${targetPlayer.name}｜${entry.name} ${activeText}`;
                const targetAriaLabel = selectedItem.targetMode === "party"
                  ? `${entry.name}，${targetText}`
                  : `${targetPlayer.name}，${entry.name}，${targetText}`;
                return `
                  <button class="battle-switch-card ${stateClass}" type="button" data-item-target-player-id="${escapeHtml(targetPlayer.id)}" ${crewIndex == null ? "" : `data-item-target-index="${crewIndex}"`} aria-label="${escapeHtml(targetAriaLabel)}" ${disabled || !canTarget ? "disabled" : ""}>
                    <img class="battle-switch-card-frame" src="images/board/battle_switch_ui/battle_switch_crew_row_frame.webp" alt="" aria-hidden="true">
                    <span class="battle-switch-portrait">
                      <img src="${escapeHtml(portrait)}" alt="${escapeHtml(entry.name)}" onerror="this.onerror=null;this.src='${PLACEHOLDER_BATTLE_PORTRAIT}';">
                    </span>
                    <strong class="battle-switch-name">${escapeHtml(displayedName)}</strong>
                    <span class="battle-switch-meta primary">${escapeHtml(entry.primary)}</span>
                    <span class="battle-switch-meta secondary">${escapeHtml(entry.secondary)}</span>
                    <span class="battle-switch-status">${escapeHtml(targetText)}</span>
                  </button>
                `;
              }).join("")}
            </div>
          </div>
        </section>
      `;
      refs.infoContent.querySelector("[data-item-target-back]")?.addEventListener("click", () => {
        selectedBattleItemId = "";
        renderItems(view);
      });
      refs.infoContent.querySelectorAll("[data-item-target-player-id]").forEach((button) => {
        button.addEventListener("click", () => {
          const targetIndex = button.dataset.itemTargetIndex == null ? null : Number(button.dataset.itemTargetIndex);
          useBattleItem(selectedItem.id, targetIndex, button.dataset.itemTargetPlayerId || "");
        });
      });
      return;
    }
    refs.infoContent.innerHTML = `
      <section class="battle-command-ui" aria-label="戰鬥道具">
        <img class="battle-command-panel-frame" src="images/board/battle_switch_ui/battle_switch_panel_frame.webp" alt="" aria-hidden="true">
        <header class="battle-command-heading">
          <strong>戰鬥道具</strong>
          <span>選擇本回合要使用的道具</span>
        </header>
        <div class="battle-command-body">
          <div class="battle-command-scroll">
            <div class="battle-command-grid">
              ${items.map((item) => `
                <button class="battle-command-choice" type="button" data-item-id="${escapeHtml(item.id)}" ${disabled || item.count <= 0 ? "disabled" : ""}>
                  <img class="battle-command-choice-frame" src="images/board/battle_command_ui/battle_command_choice_button_frame.webp" alt="" aria-hidden="true">
                  <span class="battle-command-choice-copy">
                    <strong class="battle-command-choice-name">${escapeHtml(item.name)} x${escapeHtml(item.count)}</strong>
                    <span class="battle-command-choice-meta">${escapeHtml(item.desc)}${item.targetMode === "battle_side" ? " ・ 選擇我方或敵方" : battleItemRequiresCrewTarget(item, view) ? " ・ 選擇共鬥目標" : ""}</span>
                  </span>
                </button>
              `).join("")}
            </div>
          </div>
        </div>
      </section>
    `;
    refs.infoContent.querySelectorAll("[data-item-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = items.find((entry) => entry.id === button.dataset.itemId);
        if (battleItemRequiresCrewTarget(item, view)) {
          selectedBattleItemId = item.id;
          renderItems(view);
          return;
        }
        useBattleItem(button.dataset.itemId, null);
      });
    });
    restorePanelScroll("items", ".battle-command-scroll");
  }

  function renderEscape(view) {
    refs.infoPanel?.classList.remove("is-hidden");
    refs.infoTitle.textContent = "";
    const escapeThreshold = Number(view?.battle?.escapeThreshold || 0);
    const isJudicialRaid = !!view?.battle?.raidInfo;
    const cannotEscape = escapeThreshold <= 0;
    const locked = actionDisabled(view);
    const runDisabled = locked || cannotEscape || isJudicialRaid;
    const surrenderDisabled = locked;
    const message = isJudicialRaid
      ? "司法島討伐戰無法逃跑；必要時可以投降，讓隊伍全員瀕死並退出整備。"
      : cannotEscape
        ? "隊伍裡沒有移動型夥伴，不能嘗試逃跑；仍可選擇投降。"
        : `逃跑需要擲出 ${escapeThreshold}+。若成功就脫離戰鬥，失敗會消耗本回合行動。`;
    const meta = isJudicialRaid
      ? "共鬥副本必須戰到一方倒下。"
      : cannotEscape
        ? "需要至少 1 名移動型夥伴才能開啟逃跑。"
        : "點擊後立刻進行判定。";
    refs.infoContent.innerHTML = `
      <section class="battle-command-ui" aria-label="逃跑">
        <img class="battle-command-panel-frame" src="images/board/battle_switch_ui/battle_switch_panel_frame.webp" alt="" aria-hidden="true">
        <header class="battle-command-heading">
          <strong>逃跑</strong>
          <span>選擇撤退方式</span>
        </header>
        <div class="battle-command-body battle-command-escape-layout">
          <div class="battle-command-escape-notice">
            <img class="battle-command-notice-frame" src="images/board/battle_command_ui/battle_command_notice_frame.webp" alt="" aria-hidden="true">
            <span class="battle-command-notice-copy">
              <span class="battle-command-notice-meta">${escapeHtml(message)}</span>
            </span>
          </div>
          <button class="battle-command-choice" type="button" data-run-away ${runDisabled ? "disabled" : ""}>
            <img class="battle-command-choice-frame" src="images/board/battle_command_ui/battle_command_choice_button_frame.webp" alt="" aria-hidden="true">
            <span class="battle-command-choice-copy">
              <strong class="battle-command-choice-name">嘗試逃跑</strong>
              <span class="battle-command-choice-meta">${escapeHtml(meta)}</span>
            </span>
          </button>
          <button class="battle-command-choice danger-choice" type="button" data-surrender ${surrenderDisabled ? "disabled" : ""}>
            <img class="battle-command-choice-frame" src="images/board/battle_command_ui/battle_command_danger_button_frame.webp" alt="" aria-hidden="true">
            <span class="battle-command-choice-copy">
              <strong class="battle-command-choice-name">投降</strong>
              <span class="battle-command-choice-meta">直接結束戰鬥，隊伍全員瀕死並返回整備。</span>
            </span>
          </button>
        </div>
      </section>
    `;
    refs.infoContent.querySelector("[data-run-away]")?.addEventListener("click", () => {
      if (selectTotMusicaSequentialAction({ type: "escape" })) return;
      callBattleAction("battleTryEscape", "escape");
      currentMode = null;
      renderClosedPanel();
      showStatus("正在判定是否逃跑成功。");
    });
    refs.infoContent.querySelector("[data-surrender]")?.addEventListener("click", () => {
      if (!window.confirm("確定要投降嗎？隊伍會全員瀕死。")) return;
      callBattleAction("battleSurrender", "surrender");
      currentMode = null;
      renderClosedPanel();
      showStatus("已選擇投降，正在結算。");
    });
  }

  function renderClosedPanel() {
    refs.infoPanel?.classList.remove("battle-switch-mode");
    refs.infoPanel?.classList.add("battle-command-mode");
    refs.infoPanel?.classList.remove("is-hidden");
    refs.infoPanel?.classList.remove("result-mode");
    updateActionButtons(latestView);
    if (refs.infoTitle) refs.infoTitle.textContent = "";
    if (refs.infoContent) {
      refs.infoContent.innerHTML = `
        <section class="battle-command-ui battle-command-idle" aria-label="尚未選擇戰鬥指令">
          <img class="battle-command-panel-frame" src="images/board/battle_switch_ui/battle_switch_panel_frame.webp" alt="" aria-hidden="true">
        </section>
      `;
    }
  }

  function renderPostgameBossPrompt(view, mechanic) {
    currentMode = null;
    refs.actionPanel?.classList.add("is-hidden");
    refs.infoPanel?.classList.remove("is-hidden", "result-mode", "battle-switch-mode");
    refs.infoPanel?.classList.add("battle-command-mode");
    refs.infoTitle.textContent = "";
    const prompt = mechanic?.prompt;
    if (prompt?.type === "katakuri_future_sight") {
      const waiting = prompt.forecastRolling || prompt.defenseRolling || !prompt.canChoose;
      refs.infoContent.innerHTML = `
        <section class="battle-command-ui" aria-label="卡塔庫栗預知未來">
          <img class="battle-command-panel-frame" src="images/board/battle_switch_ui/battle_switch_panel_frame.webp" alt="" aria-hidden="true">
          <header class="battle-command-heading">
            <strong>${escapeHtml(prompt.title || "預知未來")}</strong>
            <span>${escapeHtml(prompt.message || "先看預知骰，再決定行動。")}</span>
          </header>
          <div class="battle-command-body">
            <div class="battle-command-empty">
              <img class="battle-command-notice-frame" src="images/board/battle_command_ui/battle_command_notice_frame.webp" alt="" aria-hidden="true">
              <span class="battle-command-notice-copy">
                <strong class="battle-command-notice-name">${prompt.forecastDie ? `卡塔庫栗預知骰：${escapeHtml(prompt.forecastDie)}` : "未來視判定中"}</strong>
                <span class="battle-command-notice-meta">${prompt.defenseRolling ? "防禦骰正在翻滾……" : prompt.forecastRolling ? "不論速度，卡塔庫栗都會先完成預知。" : "相同或更高可突破未來視；低於預知骰則整招失效。"}</span>
              </span>
            </div>
          </div>
          ${waiting ? "" : `<div class="battle-command-body battle-command-grid">
            <button class="battle-command-choice" type="button" data-katakuri-choice="move">
              <img class="battle-command-choice-frame" src="images/board/battle_command_ui/battle_command_choice_button_frame.webp" alt="" aria-hidden="true">
              <span class="battle-command-choice-copy"><strong class="battle-command-choice-name">正面出招</strong><span class="battle-command-choice-meta">回到一般指令；攻擊時才比較第一骰，PP 照常消耗。</span></span>
            </button>
            <button class="battle-command-choice" type="button" data-katakuri-choice="defend">
              <img class="battle-command-choice-frame" src="images/board/battle_command_ui/battle_command_choice_button_frame.webp" alt="" aria-hidden="true">
              <span class="battle-command-choice-copy"><strong class="battle-command-choice-name">防禦</strong><span class="battle-command-choice-meta">放棄本次出招；擲一骰，點數 ×15% 減少直接攻擊傷害。</span></span>
            </button>
          </div>`}
        </section>`;
      refs.infoContent.querySelectorAll("[data-katakuri-choice]").forEach((button) => {
        button.addEventListener("click", () => {
          const choice = button.dataset.katakuriChoice;
          currentMode = choice === "move" ? "attack" : null;
          const accepted = callBattleAction("battleKatakuriChoice", "katakuri-choice", { choice });
          if (accepted === false) {
            currentMode = null;
            return;
          }
          refs.infoContent.querySelectorAll("[data-katakuri-choice]").forEach((entry) => { entry.disabled = true; });
          showStatus(choice === "move" ? "已選擇正面出招；可攻擊、換夥伴、使用道具或逃跑。" : "已放棄行動，正在擲防禦骰。");
        });
      });
      return;
    }
    if (prompt?.type === "oars_lottery") {
      refs.infoPanel?.classList.add("oars-lottery-panel-mode");
      const promptKey = String(prompt.actionKey || `${view?.battle?.roundIndex || 0}:${view?.player?.id || "player"}`);
      if (oarsPendingBetKey !== promptKey) {
        oarsPendingBetKey = promptKey;
        oarsPendingBetStakes.clear();
      }
      const selectedBets = oarsPendingBetStakes;
      const availableSaltBags = Math.max(0, Math.floor(Number(prompt.availableSaltBags || 0)));
      const grouped = (prompt.options || []).reduce((result, option) => {
        const group = option.group || "其他";
        (result[group] ||= []).push(option);
        return result;
      }, {});
      refs.infoContent.innerHTML = `
        <section class="battle-command-ui oars-lottery-ui" aria-label="歐斯鹽袋下注">
          <img class="battle-command-panel-frame" src="images/board/battle_switch_ui/battle_switch_panel_frame.webp" alt="" aria-hidden="true">
          <header class="battle-command-heading"><strong>${escapeHtml(prompt.title)}</strong><span>${escapeHtml(prompt.message)}</span></header>
          <div class="oars-lottery-scroll">
            ${Object.entries(grouped).map(([group, options]) => `<section class="oars-lottery-group"><h3>${escapeHtml(group)}</h3><div class="oars-lottery-grid">${options.map((option) => `<article class="oars-lottery-choice" data-oars-prediction="${escapeHtml(option.id)}"><span>${escapeHtml(option.label)}</span><strong>×${Number(option.payout || 0)}</strong><small>每包命中回收 ×${Number(option.payout || 0)}・命中率 ${Math.max(.1, Number(option.probability || 0) * 100).toFixed(Number(option.probability || 0) < .1 ? 1 : 0)}%${option.detail ? `・${escapeHtml(option.detail)}` : ""}</small><div class="oars-stake-stepper"><button type="button" data-oars-stake-minus aria-label="減少${escapeHtml(option.label)}的鹽袋" ${view.battle.animating ? "disabled" : ""}>−</button><output data-oars-stake-count aria-live="polite">0 包</output><button type="button" data-oars-stake-plus aria-label="增加${escapeHtml(option.label)}的鹽袋" ${view.battle.animating ? "disabled" : ""}>＋</button></div></article>`).join("")}</div></section>`).join("")}
          </div>
          <footer class="oars-betting-footer"><span data-oars-bet-summary>尚未下注・共有 ${availableSaltBags} 包可分配</span><button type="button" data-oars-confirm-bets disabled>確認下注</button></footer>
        </section>`;
      const choiceCards = [...refs.infoContent.querySelectorAll("[data-oars-prediction]")];
      const confirmButton = refs.infoContent.querySelector("[data-oars-confirm-bets]");
      const summary = refs.infoContent.querySelector("[data-oars-bet-summary]");
      const totalSelectedStake = () => [...selectedBets.values()].reduce((sum, stake) => sum + Math.max(0, Number(stake || 0)), 0);
      const refreshBetSelection = () => {
        const totalStake = totalSelectedStake();
        choiceCards.forEach((card) => {
          const optionId = card.dataset.oarsPrediction;
          const stake = Math.max(0, Number(selectedBets.get(optionId) || 0));
          card.classList.toggle("selected", stake > 0);
          card.classList.toggle("at-limit", totalStake >= availableSaltBags && stake === 0);
          card.querySelector("[data-oars-stake-count]").textContent = `${stake} 包`;
          card.querySelector("[data-oars-stake-minus]").disabled = view.battle.animating || stake <= 0;
          card.querySelector("[data-oars-stake-plus]").disabled = view.battle.animating || totalStake >= availableSaltBags;
        });
        confirmButton.disabled = totalStake === 0 || view.battle.animating;
        summary.textContent = totalStake
          ? `已選 ${selectedBets.size} 項・共押 ${totalStake} 包・確認後剩 ${Math.max(0, availableSaltBags - totalStake)} 包`
          : `尚未下注・共有 ${availableSaltBags} 包可分配`;
      };
      choiceCards.forEach((card) => {
        const optionId = card.dataset.oarsPrediction;
        card.querySelector("[data-oars-stake-minus]")?.addEventListener("click", () => {
          const nextStake = Math.max(0, Number(selectedBets.get(optionId) || 0) - 1);
          if (nextStake > 0) selectedBets.set(optionId, nextStake);
          else selectedBets.delete(optionId);
          refreshBetSelection();
        });
        card.querySelector("[data-oars-stake-plus]")?.addEventListener("click", () => {
          if (totalSelectedStake() >= availableSaltBags) showStatus(`目前只有 ${availableSaltBags} 包鹽袋可下注。`);
          else selectedBets.set(optionId, Number(selectedBets.get(optionId) || 0) + 1);
          refreshBetSelection();
        });
      });
      confirmButton?.addEventListener("click", () => {
        const bets = [...selectedBets.entries()].filter(([, stake]) => stake > 0).map(([optionId, stake]) => ({ optionId, stake }));
        const stakeTotal = bets.reduce((sum, bet) => sum + bet.stake, 0);
        if (!bets.length || stakeTotal > availableSaltBags) return;
        const accepted = callBattleAction("battleOarsPrediction", "oars-prediction", { bets });
        if (accepted !== false) {
          refs.infoContent.querySelectorAll("[data-oars-stake-minus], [data-oars-stake-plus]").forEach((entry) => { entry.disabled = true; });
          confirmButton.disabled = true;
          oarsPendingBetStakes.clear();
          showStatus(`已投入 ${stakeTotal} 包鹽袋；現在選擇本回合戰鬥指令。`);
        }
      });
      refreshBetSelection();
      return;
    }
    if (prompt?.type === "oars_purification") {
      refs.infoPanel?.classList.add("oars-lottery-panel-mode", "oars-purification-panel-mode");
      refs.infoContent.innerHTML = `
        <section class="battle-command-ui oars-purification-ui" aria-label="巨型鹽彈完成">
          <img class="battle-command-panel-frame" src="images/board/battle_switch_ui/battle_switch_panel_frame.webp" alt="" aria-hidden="true">
          <header class="battle-command-heading"><strong>${escapeHtml(prompt.title)}</strong><span>${escapeHtml(prompt.message)}</span></header>
          <button type="button" class="oars-purification-action" data-oars-purify>
            <img src="images/board/battle/postgame_mechanics/oars/oars_salt_purification.webp" alt="巨型鹽彈・影子解放">
            <span><strong>巨型鹽彈・影子解放</strong><small>消耗 15 袋巨型鹽，無視生命、防禦、命中與閃避，一擊淨化魔人歐斯。</small></span>
          </button>
        </section>`;
      refs.infoContent.querySelector("[data-oars-purify]")?.addEventListener("click", (event) => {
        event.currentTarget.disabled = true;
        callBattleAction("battleOarsPurify", "oars-purify", {});
        showStatus("巨型鹽彈已發射，正在解放歐斯體內的影子。");
      });
      return;
    }
    if (prompt?.type === "tot_team_setup") {
      refs.infoPanel?.classList.add("tot-musica-team-setup-panel-mode");
      const state = mechanic.state || {};
      const crew = state.crew || [];
      const signature = `${view?.battle?.enemy?.key || mechanic.key}:${crew.map((card) => card.index).join(",")}`;
      if (signature !== totMusicaTeamSelectionSignature) {
        totMusicaTeamSelectionSignature = signature;
        totMusicaTeamPickedIndex = null;
        totMusicaTeamSlots = {
          real: [null, null, null],
          song: [null, null, null],
        };
      }
      const assignCrewToSlot = (crewIndex, world, slotIndex) => {
        const index = Number(crewIndex);
        const targetSlot = Math.max(0, Math.min(2, Number(slotIndex)));
        if (!Number.isInteger(index) || !["real", "song"].includes(world)) return;
        const sourceWorld = ["real", "song"].find((key) => totMusicaTeamSlots[key].includes(index));
        const sourceSlot = sourceWorld ? totMusicaTeamSlots[sourceWorld].indexOf(index) : -1;
        if (sourceWorld === world && sourceSlot === targetSlot) return;
        const displaced = totMusicaTeamSlots[world][targetSlot];
        totMusicaTeamSlots[world][targetSlot] = index;
        if (sourceWorld && sourceSlot >= 0) totMusicaTeamSlots[sourceWorld][sourceSlot] = Number.isInteger(displaced) ? displaced : null;
        totMusicaTeamPickedIndex = null;
      };
      const renderSetup = () => {
        const livingCrew = crew.filter((card) => Number(card.currentHp || 0) > 0).slice(0, 6);
        const realIndices = totMusicaTeamSlots.real.filter(Number.isInteger);
        const songIndices = totMusicaTeamSlots.song.filter(Number.isInteger);
        const assigned = [...realIndices, ...songIndices];
        const valid = realIndices.length > 0
          && songIndices.length > 0
          && Number.isInteger(totMusicaTeamSlots.real[0])
          && Number.isInteger(totMusicaTeamSlots.song[0])
          && assigned.length === livingCrew.length
          && new Set(assigned).size === livingCrew.length
          && Math.abs(realIndices.length - songIndices.length) <= 1;
        const placementOf = (index) => {
          for (const world of ["real", "song"]) {
            const position = totMusicaTeamSlots[world].indexOf(Number(index));
            if (position >= 0) return `${world === "real" ? "左" : "右"}${position + 1}`;
          }
          return "未編排";
        };
        const renderTeamSlots = (world, label) => `
          <section class="tot-musica-team-lane ${world}">
            <header><strong>${label}</strong><span>①先發　②③替補</span></header>
            <div class="tot-musica-team-slot-row">
              ${totMusicaTeamSlots[world].map((crewIndex, slotIndex) => {
                const card = Number.isInteger(crewIndex)
                  ? crew.find((entry) => Number(entry.index) === crewIndex)
                  : null;
                return `<button class="tot-musica-team-slot ${card ? "filled" : "empty"} ${totMusicaTeamPickedIndex === Number(crewIndex) ? "picked" : ""}" type="button" data-tot-team-slot data-tot-team-world="${world}" data-tot-team-position="${slotIndex}" ${card ? `draggable="true" data-tot-crew-index="${card.index}"` : ""}>
                  <span class="tot-musica-team-order">${slotIndex + 1}${slotIndex === 0 ? "・先發" : ""}</span>
                  ${card ? `<img src="${escapeHtml(postgameCrewPortrait(card))}" alt="${escapeHtml(card.name)}"><strong>${escapeHtml(card.name)}</strong><small>HP ${Math.max(0, Number(card.currentHp || 0))}/${Math.max(1, Number(card.maxHp || 1))}</small>` : `<span class="tot-musica-team-empty-copy">拖到這裡</span>`}
                </button>`;
              }).join("")}
            </div>
          </section>`;
        refs.infoContent.innerHTML = `
          <section class="battle-command-ui tot-musica-team-setup-ui" aria-label="Tot Musica 兩隊順位編排">
            <img class="battle-command-panel-frame" src="images/board/battle_switch_ui/battle_switch_panel_frame.webp" alt="" aria-hidden="true">
            <header class="battle-command-heading"><strong>編排兩隊順位</strong><span>拖曳船員；第一格是先發</span></header>
            <div class="tot-musica-team-board">
              ${renderTeamSlots("real", "左隊")}
              ${renderTeamSlots("song", "右隊")}
            </div>
            <div class="tot-musica-team-roster" aria-label="可拖曳船員">
              ${livingCrew.map((card) => `<button class="tot-musica-roster-card ${totMusicaTeamPickedIndex === Number(card.index) ? "picked" : ""}" type="button" draggable="true" data-tot-crew-index="${card.index}"><img src="${escapeHtml(postgameCrewPortrait(card))}" alt="${escapeHtml(card.name)}"><span><strong>${escapeHtml(card.name)}</strong><small>${placementOf(card.index)}</small></span></button>`).join("")}
            </div>
            <button class="postgame-dual-confirm" type="button" data-tot-team-confirm ${valid ? "" : "disabled"}>確認出戰順序</button>
          </section>`;
        refs.infoContent.querySelectorAll("[data-tot-crew-index]").forEach((button) => {
          button.addEventListener("dragstart", (event) => {
            const index = Number(button.dataset.totCrewIndex);
            event.dataTransfer?.setData("text/plain", String(index));
            if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
          });
          button.addEventListener("click", () => {
            totMusicaTeamPickedIndex = Number(button.dataset.totCrewIndex);
            renderSetup();
          });
        });
        refs.infoContent.querySelectorAll("[data-tot-team-slot]").forEach((slot) => {
          slot.addEventListener("dragover", (event) => {
            event.preventDefault();
            slot.classList.add("drag-over");
          });
          slot.addEventListener("dragleave", () => slot.classList.remove("drag-over"));
          slot.addEventListener("drop", (event) => {
            event.preventDefault();
            const index = Number(event.dataTransfer?.getData("text/plain"));
            assignCrewToSlot(index, slot.dataset.totTeamWorld, Number(slot.dataset.totTeamPosition));
            renderSetup();
          });
          slot.addEventListener("click", () => {
            if (Number.isInteger(totMusicaTeamPickedIndex)) {
              assignCrewToSlot(totMusicaTeamPickedIndex, slot.dataset.totTeamWorld, Number(slot.dataset.totTeamPosition));
              renderSetup();
              return;
            }
            const index = Number(slot.dataset.totCrewIndex);
            if (Number.isInteger(index)) {
              totMusicaTeamPickedIndex = index;
              renderSetup();
            }
          });
        });
        refs.infoContent.querySelector("[data-tot-team-confirm]")?.addEventListener("click", () => {
          callBattleAction("battleTotTeamSetup", "tot-team-setup", {
            realIndices: totMusicaTeamSlots.real.filter(Number.isInteger),
            songIndices: totMusicaTeamSlots.song.filter(Number.isInteger),
          });
          showStatus("分隊已送出。");
        });
      };
      renderSetup();
    }
  }

  function totMusicaSequentialSelectionContext(view = latestView, requestedWorld = "") {
    const mechanic = view?.battle?.postgameBossMechanic;
    if (mechanic?.key !== "postgame_tot_musica" || !mechanic.state?.assigned || !view?.battle?.canAct || view?.battle?.result || view?.battle?.canFinish) return null;
    const state = mechanic.state;
    const world = requestedWorld === "song" ? "song" : "real";
    const activeIndex = Number(world === "real" ? state.realActiveIndex : state.songActiveIndex);
    const crew = state.coopPlayerWorlds
      ? (world === "real" ? state.realCrew || [] : state.songCrew || [])
      : state.crew || [];
    const card = crew.find((entry) => Number(entry.index) === activeIndex) || {};
    const canSelect = !state.coopPlayerWorlds || state.selectionWorld === world;
    const playerId = String(world === "real" ? state.realPlayerId || "" : state.songPlayerId || "");
    const playerName = world === "real" ? state.realPlayerName || "" : state.songPlayerName || "";
    const battleItems = state.coopPlayerWorlds
      ? (world === "real" ? state.realBattleItems || [] : state.songBattleItems || [])
      : view?.player?.battleItems || [];
    return { mechanic, state, world, activeIndex, card, crew, canSelect, playerId, playerName, battleItems };
  }

  function updateTotMusicaActionHeading(view = latestView) {
    const context = totMusicaSequentialSelectionContext(view, "real");
    if (!context) {
      if (refs.actionHeadingTitle) refs.actionHeadingTitle.textContent = "戰鬥指令";
      if (refs.actionHeadingSubtitle) refs.actionHeadingSubtitle.textContent = "選擇本回合行動";
      return;
    }
    if (refs.actionHeadingTitle) refs.actionHeadingTitle.textContent = "戰鬥指令";
    if (refs.actionHeadingSubtitle) refs.actionHeadingSubtitle.textContent = "左右兩隊分別選擇行動";
  }

  function totMusicaWorldCommandView(view, context) {
    const indices = context.world === "real" ? context.state.realIndices || [] : context.state.songIndices || [];
    const group = (context.crew || [])
      .filter((card) => indices.includes(Number(card.index)))
      .map((card) => ({ ...card, isActive: Number(card.index) === context.activeIndex }));
    return {
      ...view,
      activeCard: { ...context.card, isActive: true },
      player: {
        ...(view.player || {}),
        id: context.playerId || view?.player?.id,
        name: context.playerName || view?.player?.name,
        battleItems: context.battleItems,
        activeCrewIndex: context.activeIndex,
        crew: group,
      },
    };
  }

  function submitTotMusicaSequentialSelections() {
    if (!totMusicaSelections.real || !totMusicaSelections.song || totMusicaDualAwaitingEvent || totMusicaDualAnimationActive) return;
    totMusicaDualAwaitingEvent = true;
    refs.infoContent?.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    refs.actionPanel?.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    if (totMusicaDualAwaitTimer) clearTimeout(totMusicaDualAwaitTimer);
    totMusicaDualAwaitTimer = setTimeout(() => {
      if (!totMusicaDualAwaitingEvent || totMusicaDualAnimationActive) return;
      totMusicaDualAwaitingEvent = false;
      totMusicaDualAwaitTimer = null;
      totMusicaSelections = { real: null, song: null };
      totMusicaSelectionWorld = "real";
      showStatus("雙世界行動等待逾時，已恢復行動選擇。請再試一次。");
      renderPanel(latestView);
    }, 15000);
    callBattleAction("battleTotDualAction", "tot-dual-action", { realAction: totMusicaSelections.real, songAction: totMusicaSelections.song });
    showStatus("兩位船員的行動已送出，開始同步判定。");
  }

  function selectTotMusicaSequentialAction(action, requestedWorld = "") {
    const inferredWorld = requestedWorld === "song" ? "song" : requestedWorld === "real" ? "real" : "";
    const context = inferredWorld ? totMusicaSequentialSelectionContext(latestView, inferredWorld) : null;
    if (!context || !context.canSelect || !action || totMusicaDualAwaitingEvent || totMusicaDualAnimationActive) return false;
    if (context.state.coopPlayerWorlds) {
      const sent = callBattleAction("battleTotWorldAction", "tot-world-action", { world: context.world, action });
      if (sent === false) return false;
      showStatus(`${context.playerName || context.card.name || "目前玩家"}的行動已送出，等待另一個世界。`);
      return true;
    }
    totMusicaSelectionWorld = context.world;
    totMusicaSelections[context.world] = action;
    totMusicaWorldModes[context.world] = null;
    totMusicaWorldItemIds[context.world] = "";
    showStatus(`${context.card.name || "目前船員"}的行動已選。`);
    if (totMusicaSelections.real && totMusicaSelections.song) submitTotMusicaSequentialSelections();
    else renderPanel(latestView);
    return true;
  }

  function totMusicaActionLabel(action = {}, state = {}) {
    if (action.type === "switch") return `換上 ${(state.crew || []).find((card) => Number(card.index) === Number(action.nextIndex))?.name || "夥伴"}`;
    if (action.type === "item") return (latestView?.player?.battleItems || []).find((item) => item.id === action.itemId)?.name || "使用道具";
    if (action.type === "escape") return "嘗試逃跑";
    const move = (state.crew || []).flatMap((card) => card.moves || []).find((entry) => entry.id === action.moveId);
    return move?.displayName || move?.name || "使用招式";
  }

  function totMusicaWorldCommandButtons(world) {
    const choices = [
      ["attack", "attack", "攻擊"],
      ["partners", "partners", "夥伴"],
      ["items", "items", "道具"],
      ["escape", "escape", "逃跑"],
    ];
    return `<div class="tot-musica-world-command-grid">${choices.map(([mode, icon, label]) => `
      <button class="tot-musica-world-command" type="button" data-tot-world-mode="${mode}" data-tot-world="${world}">
        <img class="tot-musica-world-command-frame" src="images/board/battle_command_ui/battle_command_action_button_frame.webp" alt="" aria-hidden="true">
        <img class="tot-musica-world-command-icon" src="images/board/battle_command_ui/battle_command_icon_${icon}.webp" alt="" aria-hidden="true">
        <span>${label}</span>
      </button>`).join("")}</div>`;
  }

  function totMusicaWorldModeContent(view, context) {
    const { world, state, activeIndex, card } = context;
    if (!context.canSelect) {
      const waitingName = context.playerName || (world === "real" ? "現實世界玩家" : "歌世界玩家");
      const selected = world === "real" ? state.realActionSelected : state.songActionSelected;
      return `<div class="tot-musica-world-selected"><strong>${selected ? "行動已選" : `等待 ${escapeHtml(waitingName)} 選擇`}</strong><small>${selected ? "等待另一個世界完成選擇" : "由所屬玩家操作自己的船員隊伍"}</small></div>`;
    }
    const mode = totMusicaWorldModes[world];
    const indices = world === "real" ? state.realIndices || [] : state.songIndices || [];
    const back = `<button class="tot-musica-world-back" type="button" data-tot-world-back="${world}">返回四項指令</button>`;
    if (!mode) return totMusicaWorldCommandButtons(world);
    if (mode === "attack") {
      return `<div class="tot-musica-world-mode-head"><b>選擇招式</b>${back}</div><div class="tot-musica-world-option-grid">${(card.moves || []).slice(0, 4).map((move) => {
        const detail = moveDetailLines(move);
        return `<button class="postgame-world-action" type="button" data-tot-world-action="move" data-tot-world="${world}" data-tot-value="${escapeHtml(move.id)}" ${Number(move.currentPP || 0) <= 0 ? "disabled" : ""}><strong>${escapeHtml(move.displayName || move.name)}</strong><small>${escapeHtml(detail.compactLine)}・PP ${escapeHtml(move.currentPP)}</small></button>`;
      }).join("")}</div>`;
    }
    if (mode === "partners") {
      const choices = (context.crew || []).filter((entry) => indices.includes(Number(entry.index)) && Number(entry.index) !== activeIndex);
      return `<div class="tot-musica-world-mode-head"><b>選擇同隊夥伴</b>${back}</div><div class="tot-musica-world-option-grid crew">${choices.map((entry) => `
        <button class="postgame-world-action tot-musica-world-crew-choice" type="button" data-tot-world-action="switch" data-tot-world="${world}" data-tot-value="${entry.index}" ${Number(entry.currentHp || 0) <= 0 ? "disabled" : ""}>
          <img src="${escapeHtml(postgameCrewPortrait(entry))}" alt="${escapeHtml(entry.name)}"><span><strong>${escapeHtml(entry.name)}</strong><small>HP ${escapeHtml(entry.currentHp)}/${escapeHtml(entry.maxHp)}</small></span>
        </button>`).join("") || `<span class="tot-musica-world-empty">沒有可換上的同隊夥伴</span>`}</div>`;
    }
    if (mode === "items") {
      const items = context.battleItems || [];
      const itemId = totMusicaWorldItemIds[world];
      const selected = items.find((item) => item.id === itemId) || null;
      if (selected?.targetMode === "battle_side") {
        const parityLabel = selected.id === "odd_dice" ? "單數" : "雙數";
        return `<div class="tot-musica-world-mode-head"><b>${escapeHtml(selected.name)}・選擇陣營</b>${back}</div><div class="tot-musica-world-option-grid">
          <button class="postgame-world-action" type="button" data-tot-world-item-side="${world}" data-item-id="${escapeHtml(selected.id)}" data-target-side="player"><strong>使用在我方</strong><small>接下來 2 次第一顆戰鬥骰只會出現${parityLabel}</small></button>
          <button class="postgame-world-action" type="button" data-tot-world-item-side="${world}" data-item-id="${escapeHtml(selected.id)}" data-target-side="enemy"><strong>使用在敵方</strong><small>接下來 2 次第一顆戰鬥骰只會出現${parityLabel}</small></button>
        </div>`;
      }
      if (selected && battleItemRequiresCrewTarget(selected, view)) {
        const targets = (context.crew || []).filter((entry) => indices.includes(Number(entry.index)));
        return `<div class="tot-musica-world-mode-head"><b>${escapeHtml(selected.name)}・選擇目標</b>${back}</div><div class="tot-musica-world-option-grid crew">${targets.map((entry) => {
          const canTarget = canTargetBattleItem(selected, entry);
          return `<button class="postgame-world-action tot-musica-world-crew-choice" type="button" data-tot-world-item-target="${world}" data-item-id="${escapeHtml(selected.id)}" data-target-index="${entry.index}" ${canTarget ? "" : "disabled"}><img src="${escapeHtml(postgameCrewPortrait(entry))}" alt="${escapeHtml(entry.name)}"><span><strong>${escapeHtml(entry.name)}</strong><small>HP ${escapeHtml(entry.currentHp)}/${escapeHtml(entry.maxHp)}</small></span></button>`;
        }).join("")}</div>`;
      }
      return `<div class="tot-musica-world-mode-head"><b>選擇戰鬥道具</b>${back}</div><div class="tot-musica-world-option-grid">${items.map((item) => `
        <button class="postgame-world-action" type="button" data-tot-world-item="${world}" data-item-id="${escapeHtml(item.id)}" ${Number(item.count || 0) <= 0 ? "disabled" : ""}><strong>${escapeHtml(item.name)} x${escapeHtml(item.count)}</strong><small>${escapeHtml(item.desc)}</small></button>`).join("") || `<span class="tot-musica-world-empty">目前沒有可用戰鬥道具</span>`}</div>`;
    }
    const escapeThreshold = Number(state.coopPlayerWorlds
      ? (world === "real" ? state.realEscapeThreshold || 0 : state.songEscapeThreshold || 0)
      : view?.battle?.escapeThreshold || 0);
    return `<div class="tot-musica-world-mode-head"><b>撤退選項</b>${back}</div><div class="tot-musica-world-option-grid escape"><button class="postgame-world-action" type="button" data-tot-world-action="escape" data-tot-world="${world}" ${escapeThreshold <= 0 ? "disabled" : ""}><strong>嘗試逃跑</strong><small>${escapeThreshold > 0 ? `需要擲出 ${escapeThreshold}+；失敗會消耗這位船員的行動` : "目前不能逃跑"}</small></button><button class="postgame-world-action danger" type="button" data-tot-world-surrender><strong>投降</strong><small>全隊瀕死並結束戰鬥</small></button></div>`;
  }

  function bindTotMusicaWorldPanelActions(view) {
    refs.infoContent.querySelectorAll("[data-tot-world-mode]").forEach((button) => button.addEventListener("click", () => {
      const world = button.dataset.totWorld;
      totMusicaWorldModes[world] = button.dataset.totWorldMode;
      totMusicaWorldItemIds[world] = "";
      renderTotMusicaDualAction(view, view.battle.postgameBossMechanic);
    }));
    refs.infoContent.querySelectorAll("[data-tot-world-back]").forEach((button) => button.addEventListener("click", () => {
      const world = button.dataset.totWorldBack;
      totMusicaWorldModes[world] = null;
      totMusicaWorldItemIds[world] = "";
      renderTotMusicaDualAction(view, view.battle.postgameBossMechanic);
    }));
    refs.infoContent.querySelectorAll("[data-tot-world-action]").forEach((button) => button.addEventListener("click", () => {
      const type = button.dataset.totWorldAction;
      const action = type === "move" ? { type, moveId: button.dataset.totValue } : type === "switch" ? { type, nextIndex: Number(button.dataset.totValue) } : { type: "escape" };
      selectTotMusicaSequentialAction(action, button.dataset.totWorld);
    }));
    refs.infoContent.querySelectorAll("[data-tot-world-item]").forEach((button) => button.addEventListener("click", () => {
      const world = button.dataset.totWorldItem;
      const context = totMusicaSequentialSelectionContext(view, world);
      const item = (context?.battleItems || []).find((entry) => entry.id === button.dataset.itemId);
      if (!context || !item) return;
      if (battleItemRequiresCrewTarget(item, view)) {
        totMusicaWorldItemIds[world] = item.id;
        renderTotMusicaDualAction(view, view.battle.postgameBossMechanic);
      } else selectTotMusicaSequentialAction({ type: "item", itemId: item.id, targetIndex: null, targetPlayerId: context.playerId || view.player.id }, world);
    }));
    refs.infoContent.querySelectorAll("[data-tot-world-item-target]").forEach((button) => button.addEventListener("click", () => {
      const context = totMusicaSequentialSelectionContext(view, button.dataset.totWorldItemTarget);
      selectTotMusicaSequentialAction({ type: "item", itemId: button.dataset.itemId, targetIndex: Number(button.dataset.targetIndex), targetPlayerId: context?.playerId || view.player.id }, button.dataset.totWorldItemTarget);
    }));
    refs.infoContent.querySelectorAll("[data-tot-world-item-side]").forEach((button) => button.addEventListener("click", () => {
      const world = button.dataset.totWorldItemSide;
      const context = totMusicaSequentialSelectionContext(view, world);
      selectTotMusicaSequentialAction({
        type: "item",
        itemId: button.dataset.itemId,
        targetIndex: null,
        targetPlayerId: context?.playerId || view.player.id,
        targetSide: button.dataset.targetSide,
      }, world);
    }));
    refs.infoContent.querySelectorAll("[data-tot-world-change]").forEach((button) => button.addEventListener("click", () => {
      const world = button.dataset.totWorldChange;
      totMusicaSelections[world] = null;
      totMusicaWorldModes[world] = null;
      renderTotMusicaDualAction(view, view.battle.postgameBossMechanic);
    }));
    refs.infoContent.querySelectorAll("[data-tot-world-surrender]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!window.confirm("確定要投降嗎？隊伍會全員瀕死。")) return;
        callBattleAction("battleSurrender", "surrender");
      });
    });
  }

  function renderTotMusicaDualAction(view, mechanic) {
    refs.actionPanel?.classList.add("is-hidden");
    refs.infoPanel?.classList.add("tot-musica-dual-action-mode", "battle-command-mode");
    refs.infoPanel?.classList.remove("is-hidden", "result-mode", "battle-switch-mode");
    const state = mechanic.state || {};
    const signature = `${view?.battle?.round || view?.battle?.roundIndex || 0}:${state.realPlayerId || "solo"}:${state.realActiveIndex}:${state.songPlayerId || "solo"}:${state.songActiveIndex}:${state.selectionWorld || "both"}`;
    if (signature !== totMusicaSelectionSignature) {
      totMusicaSelectionSignature = signature;
      totMusicaSelections = { real: null, song: null };
      totMusicaSelectionWorld = "real";
      totMusicaWorldModes = { real: null, song: null };
      totMusicaWorldItemIds = { real: "", song: "" };
      selectedBattleItemId = "";
      currentMode = null;
    }
    const real = totMusicaSequentialSelectionContext(view, "real");
    const song = totMusicaSequentialSelectionContext(view, "song");
    if (!real || !song) return;
    syncTotMusicaPersistentStage(view);
    refs.infoTitle.textContent = "";
    const column = (context) => {
      const world = context.world;
      const stateSelected = state.coopPlayerWorlds && (world === "real" ? state.realActionSelected : state.songActionSelected);
      const selected = state.coopPlayerWorlds ? (stateSelected ? { type: "queued" } : null) : totMusicaSelections[world];
      const content = selected
        ? `<div class="tot-musica-world-selected"><strong>${state.coopPlayerWorlds ? "行動已選" : `已選：${escapeHtml(totMusicaActionLabel(selected, state))}`}</strong><small>等待另一個世界完成選擇</small>${state.coopPlayerWorlds ? "" : `<button type="button" data-tot-world-change="${world}">重新選擇</button>`}</div>`
        : totMusicaWorldModeContent(view, context);
      const ownerLabel = state.coopPlayerWorlds && context.playerName ? `${context.playerName}・` : "";
      return `<section class="postgame-world-column ${world === "song" ? "song" : ""}" aria-label="${escapeHtml(context.card.name || "目前船員")}行動面板"><img class="postgame-world-panel-frame" src="images/board/battle_switch_ui/battle_switch_panel_frame.webp" alt="" aria-hidden="true"><header class="postgame-world-heading"><span>${escapeHtml(ownerLabel + (context.card.name || "目前船員"))}<small>${selected ? "行動已選" : context.canSelect ? (totMusicaWorldModes[world] ? "正在選擇細項" : "選擇本回合行動") : "等待所屬玩家"}</small></span></header><div class="postgame-world-actions">${content}</div></section>`;
    };
    refs.infoContent.innerHTML = `<section class="battle-command-ui postgame-dual-command-ui" aria-label="兩位船員分別選擇行動"><div class="postgame-dual-world-grid">${column(real)}${column(song)}</div></section>`;
    bindTotMusicaWorldPanelActions(view);
  }

  function renderCoopRescueWait(view) {
    refs.infoPanel?.classList.remove("is-hidden");
    refs.infoTitle.textContent = "";
    const wait = view?.battle?.coopRescueWait || {};
    const reviveItems = (view?.player?.battleItems || []).filter((item) => item.effectKind === "revive" && Number(item.count || 0) > 0);
    const downedCrew = (view?.player?.crew || []).filter((card) => Number(card.currentHp || 0) <= 0);
    const rescueChoices = reviveItems.flatMap((item) => downedCrew.map((card, index) => {
      const crewIndex = Number.isInteger(Number(card.index)) ? Number(card.index) : index;
      const portraits = card?.battlePortraits || {};
      const portrait = portraits.hit || portraits.normal || portraits.idle || PLACEHOLDER_BATTLE_PORTRAIT;
      return `
        <button class="battle-switch-card is-ready" type="button" data-rescue-item-id="${escapeHtml(item.id)}" data-rescue-target-index="${crewIndex}">
          <img class="battle-switch-card-frame" src="images/board/battle_switch_ui/battle_switch_crew_row_frame.webp" alt="" aria-hidden="true">
          <span class="battle-switch-portrait"><img src="${escapeHtml(portrait)}" alt="${escapeHtml(card.name)}" onerror="this.onerror=null;this.src='${PLACEHOLDER_BATTLE_PORTRAIT}';"></span>
          <strong class="battle-switch-name">${escapeHtml(card.name)}</strong>
          <span class="battle-switch-meta primary">${escapeHtml(item.name)} x${escapeHtml(item.count)}</span>
          <span class="battle-switch-meta secondary">立即復活並繼續共鬥</span>
          <span class="battle-switch-status">自救</span>
        </button>`;
    })).join("");
    refs.infoContent.innerHTML = `
      <section class="battle-command-ui battle-rescue-wait-ui" aria-label="待救援">
        <img class="battle-command-panel-frame" src="images/board/battle_switch_ui/battle_switch_panel_frame.webp" alt="" aria-hidden="true">
        <header class="battle-command-heading">
          <strong>待救援・剩 ${escapeHtml(wait.turnsRemaining || 0)} 回合</strong>
          <span>己方回合扣除；隊友可用道具救援</span>
        </header>
        <div class="battle-command-body battle-item-target-layout">
          <div class="battle-item-target-grid">${rescueChoices || `
            <div class="battle-command-empty">
              <img class="battle-command-notice-frame" src="images/board/battle_command_ui/battle_command_notice_frame.webp" alt="" aria-hidden="true">
              <span class="battle-command-notice-copy"><strong class="battle-command-notice-name">沒有可用的復活道具</strong><span class="battle-command-notice-meta">可以等待其他共鬥玩家在自己的回合救援。</span></span>
            </div>`}
          </div>
          <button class="battle-command-notice-button" type="button" data-rescue-wait>
            <img class="battle-command-notice-frame" src="images/board/battle_command_ui/battle_command_notice_frame.webp" alt="" aria-hidden="true">
            <span class="battle-command-notice-copy"><strong class="battle-command-notice-name">等待救援</strong><span class="battle-command-notice-meta">結束本次待救援回合；剩餘次數將扣 1。</span></span>
          </button>
        </div>
      </section>`;
    refs.infoContent.querySelectorAll("[data-rescue-item-id]").forEach((button) => {
      button.addEventListener("click", () => useBattleItem(
        button.dataset.rescueItemId,
        Number(button.dataset.rescueTargetIndex),
        wait.playerId || view.player.id
      ));
    });
    refs.infoContent.querySelector("[data-rescue-wait]")?.addEventListener("click", () => {
      callBattleAction("battleWaitForRescue", "rescue-wait", {});
      showStatus("已結束本次待救援回合。");
    });
  }

  function renderPanel(view) {
    if (totMusicaDualAwaitingEvent || totMusicaDualAnimationActive) {
      refs.actionPanel?.classList.add("is-hidden");
      return;
    }
    updateActionButtons(view);
    hideTotMusicaDualSelectionPreview();
    refs.infoPanel?.classList.remove("tot-musica-dual-action-mode", "tot-musica-team-setup-panel-mode", "oars-lottery-panel-mode", "oars-purification-panel-mode");
    refs.infoPanel?.classList.toggle("battle-switch-mode", currentMode === "partners");
    refs.infoPanel?.classList.toggle("battle-command-mode", ["attack", "items", "escape"].includes(currentMode));
    refs.infoPanel?.classList.toggle("result-mode", currentMode === "result");
    if (dialogueBlocksBattleControls(view)) {
      currentMode = null;
      refs.infoPanel?.classList.add("dialogue-hidden");
      refs.infoPanel?.classList.add("is-hidden");
      if (refs.infoTitle) refs.infoTitle.textContent = "";
      if (refs.infoContent) refs.infoContent.innerHTML = "";
      return;
    }
    refs.infoPanel?.classList.remove("dialogue-hidden");
    if (!viewerCanControlBattle(view)) {
      currentMode = null;
      renderSpectatorPanel(view);
      return;
    }
    const postgameMechanic = view?.battle?.postgameBossMechanic;
    if (postgameMechanic?.prompt) {
      renderPostgameBossPrompt(view, postgameMechanic);
      return;
    }
    if (view?.battle?.yonkoPrompt) {
      renderYonkoPrompt(view);
      return;
    }
    if (view?.battle?.judicialSwitchPrompt) {
      renderJudicialSwitchPrompt(view);
      return;
    }
    if (view?.battle?.needsReplacement) {
      if (!replacementPanelReady(view)) {
        renderReplacementWaiting(view);
        return;
      }
      renderReplacement(view);
      return;
    }
    clearReplacementPanelGate();
    if (view?.battle?.coopRescueWait?.active) {
      currentMode = null;
      renderCoopRescueWait(view);
      return;
    }
    if (actionDisabled(view) && currentMode !== "result") {
      currentMode = null;
      renderClosedPanel();
      return;
    }
    if (postgameMechanic?.key === "postgame_tot_musica" && postgameMechanic.state?.assigned && view?.battle?.canAct && !view?.battle?.canFinish && !view?.battle?.result) {
      renderTotMusicaDualAction(view, postgameMechanic);
      return;
    }
    if (!currentMode) {
      renderClosedPanel();
      return;
    }
    if (currentMode === "attack") renderAttack(view);
    else if (currentMode === "partners") renderPartners(view);
    else if (currentMode === "items") renderItems(view);
    else if (currentMode === "escape") renderEscape(view);
    else renderResult(view);
  }

  function callLineageExtractionAction(methodName, commandType, args, payload) {
    const extraction = latestView?.battle?.lineageExtraction;
    if (!extraction?.canControl) {
      showStatus("這不是你的血統因子抽取操作權。");
      return false;
    }
    const api = controller();
    if (api?.[methodName]) {
      const result = api[methodName](...(Array.isArray(args) ? args : []));
      if (result === false) {
        showStatus("抽取指令未成立，請確認抽取器庫存與目前狀態。");
        return false;
      }
      window.requestAnimationFrame(() => refresh());
      window.setTimeout(() => refresh(), 90);
      return true;
    }
    sendBattleCommand(commandType, payload || {});
    return true;
  }

  function restoreLineageExtractionEnemyCard(view) {
    const extraction = view?.battle?.lineageExtraction;
    const scopeKey = String(extraction?.scopeKey || "");
    if (!scopeKey) {
      activeLineageExtractionScopeKey = "";
      return;
    }
    const firstFrameForScope = scopeKey !== activeLineageExtractionScopeKey;
    const knockoutStillApplied = refs.enemyCard?.classList.contains("portrait-ko")
      || knockoutPortraitShouldStayHidden("enemy");
    if (!firstFrameForScope && !knockoutStillApplied) return;

    activeLineageExtractionScopeKey = scopeKey;
    clearTimeout(portraitTimers.enemy);
    clearTimeout(knockoutTimers.enemy);
    clearTimeout(knockoutTimers.enemyFade);
    clearTimeout(knockoutTimers.enemyAnnounce);
    knockoutVisualStarted.enemy = false;
    clearKnockoutPortraitHidden("enemy");
    refs.enemyCard?.classList.remove("portrait-attack", "portrait-hit", "portrait-ko", "judge-clone-guard-active");
    portraitState.enemy = "normal";
    setPortraitState("enemy", "normal");

    clearTimeout(judgeCloneGuardTimer);
    judgeCloneGuardTimer = null;
    lastJudgeCloneCount = null;
    if (refs.judgeCloneGuardLayer) {
      refs.judgeCloneGuardLayer.hidden = true;
      refs.judgeCloneGuardLayer.className = "judge-clone-guard-layer";
      refs.judgeCloneGuardLayer.innerHTML = "";
    }
  }

  function refreshLineageExtraction(view) {
    restoreLineageExtractionEnemyCard(view);
    window.__BOARD_LINEAGE_EXTRACTION__?.refresh?.(view, {
      start: (extractorId, playerId) => callLineageExtractionAction(
        "battleStartLineageExtraction",
        "lineage-extraction-start",
        [extractorId, playerId],
        { extractorId, playerId }
      ),
      complete: (grades, playerId) => callLineageExtractionAction(
        "battleCompleteLineageExtraction",
        "lineage-extraction-complete",
        [grades, playerId],
        { grades, playerId }
      ),
      decline: (playerId) => callLineageExtractionAction(
        "battleDeclineLineageExtraction",
        "lineage-extraction-decline",
        [playerId],
        { playerId }
      ),
      dismiss: () => {
        currentMode = "result";
        refresh();
      },
    });
  }

  function refresh(snapshotView = null) {
    const api = controller();
    const viewOptions = selectedCoopViewPlayerId ? { coopViewPlayerId: selectedCoopViewPlayerId } : undefined;
    if (snapshotView) {
      latestView = api?.getBattleView?.(viewOptions) || snapshotView;
    } else if (api?.getBattleView) {
      latestView = api.getBattleView(viewOptions);
    } else {
      latestView = readSnapshotView();
    }
    latestView = followCurrentCoopActor(latestView, api);
    if (!latestView) {
      latestView = null;
      lastBattleIdentity = "";
      lastCoopCommandPlayerId = "";
      syncPrebattleIntro(null);
      applyBattleBackground(null);
      renderHud(null);
      renderCards(null);
      renderPostgameMechanic(null);
      syncZephyrExplosionStory(null);
      syncTotMusicaPersistentStage(null);
      currentMode = null;
      renderClosedPanel();
      refreshLineageExtraction(null);
      return;
    }
    if (!latestView.battle) {
      lastBattleIdentity = "";
      lastCoopCommandPlayerId = "";
      syncPrebattleIntro(null);
      applyBattleBackground(latestView);
      renderHud(latestView);
      renderCards(latestView);
      renderPostgameMechanic(null);
      syncZephyrExplosionStory(null);
      syncTotMusicaPersistentStage(null);
      currentMode = null;
      renderClosedPanel();
      refreshLineageExtraction(latestView);
      return;
    }
    resetBattleSessionVisualState(latestView);
    applyBattleBackground(latestView);
    renderHud(latestView);
    renderCards(latestView);
    renderPostgameMechanic(latestView);
    syncPrebattleIntro(latestView);
    syncZephyrExplosionStory(latestView);
    handleVisualEvent(latestView);
    syncTotMusicaPersistentStage(latestView);
    inferPortraitEventsFromLog(latestView);
    const battle = latestView.battle;
    if (battle.yonkoPrompt) currentMode = null;
    else if (battle.judicialSwitchPrompt) currentMode = null;
    else if (battle.needsReplacement) currentMode = "replacement";
    else if ((battle.canFinish || battle.result) && currentMode !== "result") currentMode = "result";
    renderPanel(latestView);
    refreshLineageExtraction(latestView);
  }

  function bindActions() {
    refs.matchupChip?.addEventListener("click", showAttributeMatchupDetail);
    refs.zephyrExplosionStory?.addEventListener("click", (event) => {
      event.stopPropagation();
      advanceZephyrExplosionStory();
    });
    refs.totMusicaBossPreviewToggle?.addEventListener("click", toggleTotMusicaBossPreview);
    refs.totMusicaBossPreviewBack?.addEventListener("click", toggleTotMusicaBossPreview);
    refs.coopViewTrigger?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (refs.coopViewSwitch?.hidden) return;
      coopViewMenuOpen = !coopViewMenuOpen;
      renderCoopViewSwitch(latestView);
    });
    refs.coopViewMenu?.addEventListener("click", (event) => event.stopPropagation());
    refs.coopViewPersonList?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-coop-view-player]");
      if (!button) return;
      selectCoopViewPlayer(button.dataset.coopViewPlayer);
    });
    refs.postgameMechanicClose?.addEventListener("click", (event) => {
      event.stopPropagation();
      postgameMechanicDetailOpen = false;
      renderHud(latestView);
      renderPostgameMechanic(latestView);
    });
    refs.shikiArchipelagoStage?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-shiki-target-id]");
      if (!button || button.disabled) return;
      event.stopPropagation();
      const mechanic = latestView?.battle?.postgameBossMechanic;
      const island = mechanic?.key === "postgame_shiki" && !mechanic.state?.finalDuel
        ? (mechanic.state?.islands || []).find((entry) => entry.id === button.dataset.shikiIslandId && !entry.destroyed)
        : null;
      if (!island) return;
      selectedPostgameTargetId = button.dataset.shikiTargetId || shikiArchipelagoTargetId(island.id);
      renderPostgameMechanic(latestView);
      showStatusPopover(button, {
        label: `${island.name}・攻擊目標`,
        result: `HP ${Math.max(0, Number(island.currentHp || 0))}/${Math.max(1, Number(island.maxHp || 1))}`,
        durationText: "連擊破島後，剩餘段數會自動轉攻下一座",
        description: `${island.effect || "存活期間持續支援史基。"}；攻島承受完整傷害，並有 25% 傷害貫穿史基。`,
      });
    });
    document.querySelectorAll("[data-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.disabled || actionDisabled(latestView)) return;
        currentMode = button.dataset.mode;
        if (currentMode !== "items") selectedBattleItemId = "";
        renderPanel(latestView);
      });
    });
    window.addEventListener("message", (event) => {
      if (!event.data || event.data.type !== "board-battle-update") return;
      refresh(event.data.snapshot?.view || null);
    });
    window.addEventListener("storage", (event) => {
      if (event.key !== BATTLE_SNAPSHOT_KEY) return;
      refresh();
    });
    window.addEventListener("focus", refresh);
    window.addEventListener("resize", fitBattleViewport);
    window.addEventListener("orientationchange", () => window.requestAnimationFrame(fitBattleViewport));
    window.visualViewport?.addEventListener("resize", fitBattleViewport);
    window.addEventListener("click", () => {
      hideStatusPopover();
      closeCoopViewMenu();
    });
    window.addEventListener("keydown", (event) => {
      if (activeZephyrExplosionStoryEventId && ["ArrowRight", " ", "Enter"].includes(event.key)) {
        event.preventDefault();
        advanceZephyrExplosionStory();
        return;
      }
      if (event.key === "Escape") {
        if (totMusicaBossPreviewOpen) toggleTotMusicaBossPreview(event);
        hideStatusPopover();
        closeCoopViewMenu();
        if (postgameMechanicDetailOpen) {
          postgameMechanicDetailOpen = false;
          renderHud(latestView);
          renderPostgameMechanic(latestView);
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "e") {
        event.preventDefault();
        toggleTuningPanel();
      }
    });
  }

  window.__BOARD_BATTLE_DEBUG__ = {
    diceRollingTitle,
    diceRollingSubtitle,
    diceSettledTitleForEvent,
    diceSettledSubtitleForEvent,
    resolvedDiceTotal,
    resolvedDiceEvent,
    resolvedDiceSummary,
    selectCoopViewPlayer,
    selectedCoopViewPlayerId: () => selectedCoopViewPlayerId,
    coopViewMenuOpen: () => coopViewMenuOpen,
    latestView: () => latestView,
    refresh,
    fitBattleViewport,
    playTotMusicaDualSyncFx,
    playTotMusicaEnemyDualStrikeFx,
    playRaidPhaseRewardFx,
    advanceZephyrExplosionStory,
    playKingFlameTransition,
    playKingFlameGuardFx,
    kingFlameVisualState: () => ({
      flameOn: lastRenderedKingFlameOn,
      cardClass: refs.enemyCard?.className || "",
      plateText: refs.kingFlameStatePlate?.textContent?.trim() || "",
      transitionClass: refs.kingFlameTransition?.className || "",
      guardClass: refs.kingFlameGuardFx?.className || "",
    }),
    zephyrExplosionStoryState: () => ({
      activeEventId: activeZephyrExplosionStoryEventId,
      index: zephyrExplosionStoryIndex,
      sceneCount: POSTGAME_ZEPHYR_EXPLOSION_STORY_SCENES.length,
      finished: zephyrExplosionStoryFinished,
      visible: !!refs.zephyrExplosionStory && !refs.zephyrExplosionStory.hidden,
    }),
    setTotMusicaWorldStage,
    clearTotMusicaDualSyncFx,
    lucciRokuoganAudioState: () => ({
      effectAudioSilenced: lucciRokuoganEffectAudioSilenced,
      bgmHeld: !!lucciRokuoganBgmHold,
      lastVoiceKey: refs.lucciRokuoganFx?.dataset.lastVoiceKey || "",
      lastVoiceSrc: refs.lucciRokuoganFx?.dataset.lastVoiceSrc || "",
    }),
  };

  window.addEventListener("pagehide", () => {
    clearLucciRokuoganFx();
    clearZephyrExplosionStory();
    clearKatakuriFutureSightCinematic();
  });

  applyLayout();
  fitBattleViewport();
  bindActions();
  refresh();
  warmHitEffectImages();
  setInterval(refresh, 1200);
})();
