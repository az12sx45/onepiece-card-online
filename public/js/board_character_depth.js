/* Model and alpha character layers for Board screens. No game data or source URLs are changed. */
(() => {
  "use strict";

  const entry = (surface, image = null, light = Boolean(image)) => ({ surface, image, light });
  // Keep this list explicit: broad img or portrait-path selectors also catch frames, items and islands.
  const PAGE_REGISTRY = {
    "board_start.html": [
      entry("#playerAvatar"),
      entry(".avatar-choice", "img"),
      entry(".seat-avatar"),
      entry(".lobby-chat-avatar", "img"),
      entry(".game-mini-avatar", "img"),
      entry(".campaign-member-chip", "img", false),
      entry("#boardDockMeAva"),
      entry(".fd-ava", "img", false),
    ],
    "board_game.html": [
      entry(".map-turn-avatar", "img"),
      entry(".turn-transition-avatar", "img"),
      entry(".current-ava", "img"),
      entry(".mini-ava", "img"),
      entry(".crew-manage-avatar", "img"),
      entry(".crew-detail-character-stage", ":scope > img"),
      entry(".cosmetic-frame-preview-portrait", "img"),
      entry(".training-character-stage", ":scope > img"),
      entry(".cpu-strategy-avatar", "img"),
      entry(".captain-selection-portrait-stage", "img"),
      entry(".captain-selection-row-portrait", "img"),
      entry(".draft-order-player-head", "img", false),
      entry(".draft-crew-slot", ":scope > img.portrait", false),
      entry(".setup-draft-top-player", ":scope > img", false),
      entry(".draft-character-card", ".draft-card-portrait", false),
      entry(".draft-detail-portrait"),
      entry(".encounter-portrait-stage", "img"),
      entry(".move-learn-portrait-stage", "img"),
      entry(".defeated-codex-row-art", "img"),
      entry(".defeated-codex-detail-art", "img"),
      entry(".hospital-crew-portrait", "img"),
      entry(".research-lab-card-portrait", "img"),
      entry(".research-lab-factor-portrait", "img"),
      entry(".research-lab-detail-portrait"),
      entry(".research-lab-compare-row", ":scope > img", false),
      entry(".research-lab-cultivation-bubble", "img"),
      entry(".research-lab-cultivation-factor"),
      entry(".tavern-card-art", "img"),
      entry(".tavern-result-art", "img"),
      entry(".tavern-detail-hero", "img"),
      entry(".tavern-replacement-art", "img"),
      entry(".tavern-keeper-stage", "img"),
      entry(".shopkeeper-image"),
      entry(".arena-card-art", "img"),
      entry(".arena-opponent-art", "img"),
      entry(".impel-prisoner-portrait", "img"),
      entry(".impel-cage", ".impel-captain", false),
      entry(".impel-recruit-detail-portrait", "img"),
      entry(".impel-prisoner-replacement-portrait", "img"),
      entry(".impel-entry-rescue-portrait", "img"),
      entry(".coop-join-portrait", "img"),
      entry(".judicial-raid-phase-portrait", "img"),
      entry(".judicial-raid-participant-avatar", "img"),
      entry(".final-robin-portrait", "img"),
      entry(".final-ending-speaker-portrait", "img"),
      entry(".final-ending-robin"),
      entry(".aokiji-capture-choice__portrait", "img"),
      entry(".final-boss-compass-boss"),
      entry(".yonko-raid-portrait", "img"),
      entry(".setup-draft-avatar"),
      entry(".setup-draft-now-avatar"),
      entry(".maple-trade-character", "img"),
      entry(".evolution-character-img"),
      entry(".battle-portrait-stage", ".battle-character-img", false),
      entry(".map-node-visual.portrait", ":scope > img", false),
      entry(".postgame-egghead-boss-signal", ":scope > img", false),
      entry(".postgame-egghead-cinematic-rocks"),
      entry(".fd-ava", "img", false),
      entry("img.lineage-factor-portrait"),
    ],
    "board_battle.html": [
      entry(".portrait-wrap", ".battle-portrait"),
      entry(".coop-ally-frame", ".coop-ally-portrait", false),
      entry(".battle-switch-portrait", "img"),
      entry(".coop-view-trigger-avatar", "img"),
      entry(".coop-view-person-avatar", ":scope > img", false),
      entry(".coop-view-active-portrait", "img"),
      entry(".postgame-mechanic-mini-crew", "img", false),
      entry(".bullet-fusion-crew-card", ".bullet-fusion-crew-portrait", false),
      entry(".tot-musica-team-slot", "img", false),
      entry(".tot-musica-roster-card", "img", false),
      entry(".tot-musica-world-crew-choice", "img", false),
      entry(".sanji-raid-suit-portrait"),
      entry(".saga-fusion-portrait"),
      entry(".black-turn-cast-portrait"),
      entry(".black-turn-enemy-portrait"),
      entry(".judge-clone-guard", null, false),
    ],
    "board_marineford.html": [
      entry(".fighter-img", "img"),
      entry(".slot-img", "img"),
      entry(".intel-portrait", "img"),
      entry(".select-card", "img", false),
      entry(".lottery-token", "img"),
      entry(".result-card", "img", false),
      entry(".hormone-img > img", null, false),
    ],
    "board_impel_down.html": [
      entry("#captainImg"),
      entry(".prisoner-portrait", "img"),
      entry(".recruit-detail-portrait", "img"),
      entry(".recruit-rail-token", ":scope > img:not(.recruit-rail-token-frame)", false),
      entry(".recruit-rail-token-portrait", "img"),
      entry(".recruit-rail-result-portrait", "img"),
      entry(".recruit-chip", ":scope > img", false),
    ],
    "board_water_seven.html": [
      entry(".portrait-stage", "img"),
    ],
    "board_spar_selection_demo.html": [
      entry(".portrait-window", ".crew-portrait"),
      entry(".detail-panel", ".detail-portrait", false),
    ],
  };

  const page = location.pathname.split("/").pop().toLowerCase();
  if (page !== "board_battle.html") return;
  const registry = PAGE_REGISTRY[page];
  if (!registry) return;

  const allSurfaces = registry.map((item) => item.surface).join(",");
  const decorated = new WeakMap();
  const allStates = new Set();
  const animatedStates = new Set();
  let animatedFrame = 0;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const maskSupported = Boolean(window.CSS && CSS.supports &&
    (CSS.supports("mask-image", 'url("mask.webp")') ||
      CSS.supports("-webkit-mask-image", 'url("mask.webp")')));
  const depthRoot = "images/board-depth/v1/";
  let manifestPromise = null;
  const depthQueue = [];
  let activeDepthLoads = 0;
  const alphaSources = new Map();
  /* BEGIN GENERATED BOARD ALPHA SOURCES: build_board_alpha_inventory.py */
  const knownTransparentSources = new Set([
    "images/board/attribute_icons/force.webp",
    "images/board/attribute_icons/neutral.webp",
    "images/board/attribute_icons/speed.webp",
    "images/board/attribute_icons/technique.webp",
    "images/board/avatars/1.png",
    "images/board/avatars/1.webp",
    "images/board/avatars/10.png",
    "images/board/avatars/10.webp",
    "images/board/avatars/11.png",
    "images/board/avatars/11.webp",
    "images/board/avatars/12.png",
    "images/board/avatars/12.webp",
    "images/board/avatars/13.png",
    "images/board/avatars/13.webp",
    "images/board/avatars/14.png",
    "images/board/avatars/14.webp",
    "images/board/avatars/15.png",
    "images/board/avatars/15.webp",
    "images/board/avatars/16.png",
    "images/board/avatars/16.webp",
    "images/board/avatars/17.png",
    "images/board/avatars/17.webp",
    "images/board/avatars/18.png",
    "images/board/avatars/18.webp",
    "images/board/avatars/19.png",
    "images/board/avatars/19.webp",
    "images/board/avatars/2.png",
    "images/board/avatars/2.webp",
    "images/board/avatars/20.png",
    "images/board/avatars/20.webp",
    "images/board/avatars/21.png",
    "images/board/avatars/21.webp",
    "images/board/avatars/22.png",
    "images/board/avatars/22.webp",
    "images/board/avatars/23.png",
    "images/board/avatars/23.webp",
    "images/board/avatars/24.png",
    "images/board/avatars/24.webp",
    "images/board/avatars/25.png",
    "images/board/avatars/25.webp",
    "images/board/avatars/26.png",
    "images/board/avatars/26.webp",
    "images/board/avatars/27.png",
    "images/board/avatars/27.webp",
    "images/board/avatars/28.png",
    "images/board/avatars/28.webp",
    "images/board/avatars/29.png",
    "images/board/avatars/29.webp",
    "images/board/avatars/3.png",
    "images/board/avatars/3.webp",
    "images/board/avatars/30.png",
    "images/board/avatars/30.webp",
    "images/board/avatars/31.webp",
    "images/board/avatars/32.webp",
    "images/board/avatars/33.webp",
    "images/board/avatars/34.webp",
    "images/board/avatars/35.webp",
    "images/board/avatars/36.webp",
    "images/board/avatars/37.webp",
    "images/board/avatars/38.webp",
    "images/board/avatars/39.webp",
    "images/board/avatars/4.png",
    "images/board/avatars/4.webp",
    "images/board/avatars/40.webp",
    "images/board/avatars/41.webp",
    "images/board/avatars/42.webp",
    "images/board/avatars/43.webp",
    "images/board/avatars/44.webp",
    "images/board/avatars/45.webp",
    "images/board/avatars/46.webp",
    "images/board/avatars/47.webp",
    "images/board/avatars/48.webp",
    "images/board/avatars/49.webp",
    "images/board/avatars/5.png",
    "images/board/avatars/5.webp",
    "images/board/avatars/50.webp",
    "images/board/avatars/6.png",
    "images/board/avatars/6.webp",
    "images/board/avatars/7.png",
    "images/board/avatars/7.webp",
    "images/board/avatars/8.png",
    "images/board/avatars/8.webp",
    "images/board/avatars/9.png",
    "images/board/avatars/9.webp",
    "images/board/avatars/cpu1.webp",
    "images/board/avatars/cpu2.webp",
    "images/board/avatars/cpu3.webp",
    "images/board/backpack_target_ui/backpack_target_panel_frame.webp",
    "images/board/backpack_ui/backpack_category_tab_frame.webp",
    "images/board/backpack_ui/backpack_item_slot_frame.webp",
    "images/board/backpack_ui/backpack_panel_frame.webp",
    "images/board/backpack_ui/backpack_primary_button_frame.webp",
    "images/board/backpack_ui/lineage_factor_backpack_portrait_frame.webp",
    "images/board/battle/black_turn/demon_card_frame.webp",
    "images/board/battle/black_turn/demon_eye_glow.webp",
    "images/board/battle/black_turn/demon_horns_shadow.webp",
    "images/board/battle/black_turn/demon_inner_aura.webp",
    "images/board/battle/black_turn/demon_nameplate.webp",
    "images/board/battle/black_turn/demon_wing_left_shadow.webp",
    "images/board/battle/black_turn/demon_wing_right_shadow.webp",
    "images/board/battle/black_turn/demon_wings_shadow.webp",
    "images/board/battle/cosmetic_frames/brook_soul_king/aura.webp",
    "images/board/battle/cosmetic_frames/brook_soul_king/frame.webp",
    "images/board/battle/cosmetic_frames/brook_soul_king/left_part.webp",
    "images/board/battle/cosmetic_frames/brook_soul_king/right_part.webp",
    "images/board/battle/cosmetic_frames/buggy_yonko/aura.webp",
    "images/board/battle/cosmetic_frames/buggy_yonko/frame.webp",
    "images/board/battle/cosmetic_frames/buggy_yonko/left_part.webp",
    "images/board/battle/cosmetic_frames/buggy_yonko/right_part.webp",
    "images/board/battle/cosmetic_frames/carrot_moon_lion/frame.webp",
    "images/board/battle/cosmetic_frames/carrot_moon_lion/left_fur_lightning.webp",
    "images/board/battle/cosmetic_frames/carrot_moon_lion/right_moon_claw.webp",
    "images/board/battle/cosmetic_frames/chopper_new_world/aura.webp",
    "images/board/battle/cosmetic_frames/chopper_new_world/frame.webp",
    "images/board/battle/cosmetic_frames/chopper_new_world/left_part.webp",
    "images/board/battle/cosmetic_frames/chopper_new_world/right_part.webp",
    "images/board/battle/cosmetic_frames/crocodile_new_world/aura.webp",
    "images/board/battle/cosmetic_frames/crocodile_new_world/frame.webp",
    "images/board/battle/cosmetic_frames/crocodile_new_world/left_part.webp",
    "images/board/battle/cosmetic_frames/crocodile_new_world/right_part.webp",
    "images/board/battle/cosmetic_frames/final_imu/aura.webp",
    "images/board/battle/cosmetic_frames/final_imu/frame.webp",
    "images/board/battle/cosmetic_frames/final_imu/left_part.webp",
    "images/board/battle/cosmetic_frames/final_imu/right_part.webp",
    "images/board/battle/cosmetic_frames/franky_shogun/aura.webp",
    "images/board/battle/cosmetic_frames/franky_shogun/frame.webp",
    "images/board/battle/cosmetic_frames/franky_shogun/left_part.webp",
    "images/board/battle/cosmetic_frames/franky_shogun/right_part.webp",
    "images/board/battle/cosmetic_frames/golden_den_den/aura.webp",
    "images/board/battle/cosmetic_frames/golden_den_den/frame.webp",
    "images/board/battle/cosmetic_frames/impel_down_magellan/aura.webp",
    "images/board/battle/cosmetic_frames/impel_down_magellan/frame.webp",
    "images/board/battle/cosmetic_frames/impel_down_magellan/left_part.webp",
    "images/board/battle/cosmetic_frames/impel_down_magellan/right_part.webp",
    "images/board/battle/cosmetic_frames/kid_new_world/aura.webp",
    "images/board/battle/cosmetic_frames/kid_new_world/frame.webp",
    "images/board/battle/cosmetic_frames/kid_new_world/left_part.webp",
    "images/board/battle/cosmetic_frames/kid_new_world/right_part.webp",
    "images/board/battle/cosmetic_frames/koby_colonel/aura.webp",
    "images/board/battle/cosmetic_frames/koby_colonel/frame.webp",
    "images/board/battle/cosmetic_frames/koby_colonel/left_part.webp",
    "images/board/battle/cosmetic_frames/koby_colonel/right_part.webp",
    "images/board/battle/cosmetic_frames/kuzan_tenth_captain/aura.webp",
    "images/board/battle/cosmetic_frames/kuzan_tenth_captain/frame.webp",
    "images/board/battle/cosmetic_frames/kuzan_tenth_captain/left_part.webp",
    "images/board/battle/cosmetic_frames/kuzan_tenth_captain/right_part.webp",
    "images/board/battle/cosmetic_frames/law_new_world/frame.webp",
    "images/board/battle/cosmetic_frames/law_new_world/room_aura.webp",
    "images/board/battle/cosmetic_frames/luffy_gear_fourth/aura.webp",
    "images/board/battle/cosmetic_frames/luffy_gear_fourth/frame.webp",
    "images/board/battle/cosmetic_frames/luffy_gear_fourth/left_part.webp",
    "images/board/battle/cosmetic_frames/luffy_gear_fourth/right_part.webp",
    "images/board/battle/cosmetic_frames/luffy_gear_second/aura.webp",
    "images/board/battle/cosmetic_frames/luffy_gear_second/frame.webp",
    "images/board/battle/cosmetic_frames/luffy_gear_second/left_part.webp",
    "images/board/battle/cosmetic_frames/luffy_gear_second/right_part.webp",
    "images/board/battle/cosmetic_frames/mihawk_new_world/aura.webp",
    "images/board/battle/cosmetic_frames/mihawk_new_world/frame.webp",
    "images/board/battle/cosmetic_frames/mihawk_new_world/left_part.webp",
    "images/board/battle/cosmetic_frames/mihawk_new_world/right_part.webp",
    "images/board/battle/cosmetic_frames/nami_new_world/aura.webp",
    "images/board/battle/cosmetic_frames/nami_new_world/frame.webp",
    "images/board/battle/cosmetic_frames/nami_new_world/thunder_right.webp",
    "images/board/battle/cosmetic_frames/nami_new_world/zeus_cloud_left.webp",
    "images/board/battle/cosmetic_frames/rayleigh_young/aura.webp",
    "images/board/battle/cosmetic_frames/rayleigh_young/frame.webp",
    "images/board/battle/cosmetic_frames/rayleigh_young/left_part.webp",
    "images/board/battle/cosmetic_frames/rayleigh_young/right_part.webp",
    "images/board/battle/cosmetic_frames/robin_new_world/aura.webp",
    "images/board/battle/cosmetic_frames/robin_new_world/frame.webp",
    "images/board/battle/cosmetic_frames/robin_new_world/left_part.webp",
    "images/board/battle/cosmetic_frames/robin_new_world/right_part.webp",
    "images/board/battle/cosmetic_frames/rocks_conqueror/frame.webp",
    "images/board/battle/cosmetic_frames/roger_young/aura.webp",
    "images/board/battle/cosmetic_frames/roger_young/frame.webp",
    "images/board/battle/cosmetic_frames/roger_young/left_part.webp",
    "images/board/battle/cosmetic_frames/roger_young/right_part.webp",
    "images/board/battle/cosmetic_frames/sanji_new_world/aura.webp",
    "images/board/battle/cosmetic_frames/sanji_new_world/frame.webp",
    "images/board/battle/cosmetic_frames/sanji_new_world/left_flame_kick.webp",
    "images/board/battle/cosmetic_frames/sanji_new_world/right_flame_kick.webp",
    "images/board/battle/cosmetic_frames/smoker_new_world/aura.webp",
    "images/board/battle/cosmetic_frames/smoker_new_world/frame.webp",
    "images/board/battle/cosmetic_frames/smoker_new_world/left_part.webp",
    "images/board/battle/cosmetic_frames/smoker_new_world/right_part.webp",
    "images/board/battle/cosmetic_frames/sogeking/aura.webp",
    "images/board/battle/cosmetic_frames/sogeking/frame.webp",
    "images/board/battle/cosmetic_frames/sogeking/mask_top.webp",
    "images/board/battle/cosmetic_frames/three_d_two_y/aura.webp",
    "images/board/battle/cosmetic_frames/three_d_two_y/frame.webp",
    "images/board/battle/cosmetic_frames/three_d_two_y/left_ribbon.webp",
    "images/board/battle/cosmetic_frames/three_d_two_y/right_ribbon.webp",
    "images/board/battle/cosmetic_frames/usopp_new_world/aura.webp",
    "images/board/battle/cosmetic_frames/usopp_new_world/frame.webp",
    "images/board/battle/cosmetic_frames/usopp_new_world/left_part.webp",
    "images/board/battle/cosmetic_frames/usopp_new_world/right_part.webp",
    "images/board/battle/cosmetic_frames/whitebeard_newgate/aura.webp",
    "images/board/battle/cosmetic_frames/whitebeard_newgate/frame.webp",
    "images/board/battle/cosmetic_frames/whitebeard_newgate/left_part.webp",
    "images/board/battle/cosmetic_frames/whitebeard_newgate/right_part.webp",
    "images/board/battle/cosmetic_frames/yonko_all_clear/aura.webp",
    "images/board/battle/cosmetic_frames/yonko_all_clear/frame.webp",
    "images/board/battle/cosmetic_frames/yonko_all_clear/left_part.webp",
    "images/board/battle/cosmetic_frames/yonko_all_clear/right_part.webp",
    "images/board/battle/cosmetic_frames/yonko_bigmom/aura.webp",
    "images/board/battle/cosmetic_frames/yonko_bigmom/frame.webp",
    "images/board/battle/cosmetic_frames/yonko_bigmom/left_part.webp",
    "images/board/battle/cosmetic_frames/yonko_bigmom/right_part.webp",
    "images/board/battle/cosmetic_frames/yonko_blackbeard/aura.webp",
    "images/board/battle/cosmetic_frames/yonko_blackbeard/frame.webp",
    "images/board/battle/cosmetic_frames/yonko_blackbeard/left_part.webp",
    "images/board/battle/cosmetic_frames/yonko_blackbeard/right_part.webp",
    "images/board/battle/cosmetic_frames/yonko_kaido/aura.webp",
    "images/board/battle/cosmetic_frames/yonko_kaido/frame.webp",
    "images/board/battle/cosmetic_frames/yonko_kaido/left_part.webp",
    "images/board/battle/cosmetic_frames/yonko_kaido/right_part.webp",
    "images/board/battle/cosmetic_frames/yonko_shanks/aura.webp",
    "images/board/battle/cosmetic_frames/yonko_shanks/frame.webp",
    "images/board/battle/cosmetic_frames/yonko_shanks/left_part.webp",
    "images/board/battle/cosmetic_frames/yonko_shanks/right_part.webp",
    "images/board/battle/cosmetic_frames/zoro_enies_lobby/aura.webp",
    "images/board/battle/cosmetic_frames/zoro_enies_lobby/frame.webp",
    "images/board/battle/cosmetic_frames/zoro_enies_lobby/left_part.webp",
    "images/board/battle/cosmetic_frames/zoro_enies_lobby/right_part.webp",
    "images/board/battle/cosmetic_frames/zoro_new_world/aura.webp",
    "images/board/battle/cosmetic_frames/zoro_new_world/frame.webp",
    "images/board/battle/cosmetic_frames/zoro_new_world/left_part.webp",
    "images/board/battle/cosmetic_frames/zoro_new_world/right_part.webp",
    "images/board/battle/effects/critical_hit/critical_hit_burst_v1.webp",
    "images/board/battle/effects/critical_hit/critical_strike_cutlass_icon_v1.webp",
    "images/board/battle/effects/hit/blunt_crack.webp",
    "images/board/battle/effects/hit/bullet_hit.webp",
    "images/board/battle/effects/hit/bullet_sparks.webp",
    "images/board/battle/effects/hit/burn_mark.webp",
    "images/board/battle/effects/hit/dark_impact.webp",
    "images/board/battle/effects/hit/explosion_burst.webp",
    "images/board/battle/effects/hit/fire_impact.webp",
    "images/board/battle/effects/hit/ice_impact.webp",
    "images/board/battle/effects/hit/kick_mark.webp",
    "images/board/battle/effects/hit/kick_mark_heavy.webp",
    "images/board/battle/effects/hit/lightning_hit.webp",
    "images/board/battle/effects/hit/pierce_mark.webp",
    "images/board/battle/effects/hit/poison_splash.webp",
    "images/board/battle/effects/hit/punch_combo.webp",
    "images/board/battle/effects/hit/punch_mark.webp",
    "images/board/battle/effects/hit/punch_mark_heavy.webp",
    "images/board/battle/effects/hit/shockwave_ring.webp",
    "images/board/battle/effects/hit/slash_cross.webp",
    "images/board/battle/effects/hit/slash_multi.webp",
    "images/board/battle/effects/hit/slash_single.webp",
    "images/board/battle/effects/hit/water_splash.webp",
    "images/board/battle/effects/hit/wind_slash.webp",
    "images/board/battle/enemy_frames/enemy_akainu/aura.webp",
    "images/board/battle/enemy_frames/enemy_akainu/frame.webp",
    "images/board/battle/enemy_frames/enemy_akainu/left_part.webp",
    "images/board/battle/enemy_frames/enemy_akainu/right_part.webp",
    "images/board/battle/enemy_frames/enemy_aokiji/aura.webp",
    "images/board/battle/enemy_frames/enemy_aokiji/frame.webp",
    "images/board/battle/enemy_frames/enemy_aokiji/left_part.webp",
    "images/board/battle/enemy_frames/enemy_aokiji/right_part.webp",
    "images/board/battle/enemy_frames/enemy_doflamingo/aura.webp",
    "images/board/battle/enemy_frames/enemy_doflamingo/frame.webp",
    "images/board/battle/enemy_frames/enemy_doflamingo/left_part.webp",
    "images/board/battle/enemy_frames/enemy_doflamingo/right_part.webp",
    "images/board/battle/enemy_frames/enemy_enel/aura.webp",
    "images/board/battle/enemy_frames/enemy_enel/frame.webp",
    "images/board/battle/enemy_frames/enemy_enel/left_part.webp",
    "images/board/battle/enemy_frames/enemy_enel/right_part.webp",
    "images/board/battle/enemy_frames/enemy_gecko_moria/aura.webp",
    "images/board/battle/enemy_frames/enemy_gecko_moria/frame.webp",
    "images/board/battle/enemy_frames/enemy_gecko_moria/left_part.webp",
    "images/board/battle/enemy_frames/enemy_gecko_moria/right_part.webp",
    "images/board/battle/enemy_frames/enemy_kaku/aura.webp",
    "images/board/battle/enemy_frames/enemy_kaku/frame.webp",
    "images/board/battle/enemy_frames/enemy_kaku/left_part.webp",
    "images/board/battle/enemy_frames/enemy_kaku/right_part.webp",
    "images/board/battle/enemy_frames/enemy_killingham/aura.webp",
    "images/board/battle/enemy_frames/enemy_killingham/frame.webp",
    "images/board/battle/enemy_frames/enemy_killingham/left_part.webp",
    "images/board/battle/enemy_frames/enemy_killingham/right_part.webp",
    "images/board/battle/enemy_frames/enemy_kizaru/aura.webp",
    "images/board/battle/enemy_frames/enemy_kizaru/frame.webp",
    "images/board/battle/enemy_frames/enemy_kizaru/left_part.webp",
    "images/board/battle/enemy_frames/enemy_kizaru/right_part.webp",
    "images/board/battle/enemy_frames/enemy_lucci/aura.webp",
    "images/board/battle/enemy_frames/enemy_lucci/frame.webp",
    "images/board/battle/enemy_frames/enemy_lucci/left_part.webp",
    "images/board/battle/enemy_frames/enemy_lucci/right_part.webp",
    "images/board/battle/enemy_frames/enemy_sengoku/aura.webp",
    "images/board/battle/enemy_frames/enemy_sengoku/frame.webp",
    "images/board/battle/enemy_frames/enemy_sengoku/left_part.webp",
    "images/board/battle/enemy_frames/enemy_sengoku/right_part.webp",
    "images/board/battle/enemy_frames/enemy_sommers/aura.webp",
    "images/board/battle/enemy_frames/enemy_sommers/frame.webp",
    "images/board/battle/enemy_frames/enemy_sommers/left_part.webp",
    "images/board/battle/enemy_frames/enemy_sommers/right_part.webp",
    "images/board/battle/enemy_frames/postgame_aramaki/frame.webp",
    "images/board/battle/enemy_frames/postgame_charlotte_katakuri/frame.webp",
    "images/board/battle/enemy_frames/postgame_douglas_bullet/frame.webp",
    "images/board/battle/enemy_frames/postgame_gild_tesoro/frame.webp",
    "images/board/battle/enemy_frames/postgame_king/frame.webp",
    "images/board/battle/enemy_frames/postgame_loki/frame.webp",
    "images/board/battle/enemy_frames/postgame_oars/frame.webp",
    "images/board/battle/enemy_frames/postgame_patrick_redfield/frame.webp",
    "images/board/battle/enemy_frames/postgame_rob_lucci_awakened/frame.webp",
    "images/board/battle/enemy_frames/postgame_saga/frame.webp",
    "images/board/battle/enemy_frames/postgame_shiki/frame.webp",
    "images/board/battle/enemy_frames/postgame_tot_musica/frame.webp",
    "images/board/battle/enemy_frames/postgame_vinsmoke_judge/frame.webp",
    "images/board/battle/enemy_frames/postgame_zephyr/frame.webp",
    "images/board/battle/move-fx/v1/air_shockwave.webp",
    "images/board/battle/move-fx/v1/armament_fist.webp",
    "images/board/battle/move-fx/v1/blade_barrage.webp",
    "images/board/battle/move-fx/v1/blade_cross.webp",
    "images/board/battle/move-fx/v1/blade_single.webp",
    "images/board/battle/move-fx/v1/blue_fire.webp",
    "images/board/battle/move-fx/v1/blue_fire_kick.webp",
    "images/board/battle/move-fx/v1/bomb_burst.webp",
    "images/board/battle/move-fx/v1/bubble_swarm.webp",
    "images/board/battle/move-fx/v1/bullet_shot.webp",
    "images/board/battle/move-fx/v1/cannon_blast.webp",
    "images/board/battle/move-fx/v1/chain_whip.webp",
    "images/board/battle/move-fx/v1/cursed_blade.webp",
    "images/board/battle/move-fx/v1/dark_vortex.webp",
    "images/board/battle/move-fx/v1/delay_beam.webp",
    "images/board/battle/move-fx/v1/demon_music.webp",
    "images/board/battle/move-fx/v1/diamond_impact.webp",
    "images/board/battle/move-fx/v1/door_portal.webp",
    "images/board/battle/move-fx/v1/dragon_claw.webp",
    "images/board/battle/move-fx/v1/electric_kick.webp",
    "images/board/battle/move-fx/v1/finger_pierce.webp",
    "images/board/battle/move-fx/v1/fire_bird.webp",
    "images/board/battle/move-fx/v1/fire_blade.webp",
    "images/board/battle/move-fx/v1/fire_dragon.webp",
    "images/board/battle/move-fx/v1/fire_fist.webp",
    "images/board/battle/move-fx/v1/fire_kick.webp",
    "images/board/battle/move-fx/v1/fire_orb.webp",
    "images/board/battle/move-fx/v1/fire_stream.webp",
    "images/board/battle/move-fx/v1/flower_limbs.webp",
    "images/board/battle/move-fx/v1/focus_sight.webp",
    "images/board/battle/move-fx/v1/forest_roots.webp",
    "images/board/battle/move-fx/v1/gamma_blade.webp",
    "images/board/battle/move-fx/v1/ghost_burst.webp",
    "images/board/battle/move-fx/v1/gold_beam.webp",
    "images/board/battle/move-fx/v1/gold_bind.webp",
    "images/board/battle/move-fx/v1/gold_fist.webp",
    "images/board/battle/move-fx/v1/gravity_field.webp",
    "images/board/battle/move-fx/v1/gravity_meteor.webp",
    "images/board/battle/move-fx/v1/guard_shield.webp",
    "images/board/battle/move-fx/v1/haki_burst.webp",
    "images/board/battle/move-fx/v1/heal_dandelion.webp",
    "images/board/battle/move-fx/v1/heal_glow.webp",
    "images/board/battle/move-fx/v1/heavy_slam.webp",
    "images/board/battle/move-fx/v1/horn_charge.webp",
    "images/board/battle/move-fx/v1/ice_blade.webp",
    "images/board/battle/move-fx/v1/ice_domain.webp",
    "images/board/battle/move-fx/v1/ice_spikes.webp",
    "images/board/battle/move-fx/v1/jaw_bite.webp",
    "images/board/battle/move-fx/v1/kick_sweep.webp",
    "images/board/battle/move-fx/v1/laser_ray.webp",
    "images/board/battle/move-fx/v1/light_blade.webp",
    "images/board/battle/move-fx/v1/light_kick.webp",
    "images/board/battle/move-fx/v1/lightning_bolt.webp",
    "images/board/battle/move-fx/v1/lightning_claw.webp",
    "images/board/battle/move-fx/v1/love_arrow.webp",
    "images/board/battle/move-fx/v1/magma_fist.webp",
    "images/board/battle/move-fx/v1/magma_meteor.webp",
    "images/board/battle/move-fx/v1/magnetic_railgun.webp",
    "images/board/battle/move-fx/v1/metal_arm.webp",
    "images/board/battle/move-fx/v1/mochi_fist.webp",
    "images/board/battle/move-fx/v1/mochi_spear.webp",
    "images/board/battle/move-fx/v1/paw_wave.webp",
    "images/board/battle/move-fx/v1/petal_blade.webp",
    "images/board/battle/move-fx/v1/petrify_heart.webp",
    "images/board/battle/move-fx/v1/plant_spear.webp",
    "images/board/battle/move-fx/v1/plant_wolf.webp",
    "images/board/battle/move-fx/v1/poison_cloud.webp",
    "images/board/battle/move-fx/v1/poison_dragon.webp",
    "images/board/battle/move-fx/v1/power_aura.webp",
    "images/board/battle/move-fx/v1/punch_impact.webp",
    "images/board/battle/move-fx/v1/purple_enma.webp",
    "images/board/battle/move-fx/v1/quake_crack.webp",
    "images/board/battle/move-fx/v1/red_haki_slash.webp",
    "images/board/battle/move-fx/v1/room_cut.webp",
    "images/board/battle/move-fx/v1/rubber_barrage.webp",
    "images/board/battle/move-fx/v1/rubber_bazooka.webp",
    "images/board/battle/move-fx/v1/rubber_giant.webp",
    "images/board/battle/move-fx/v1/rubber_nika.webp",
    "images/board/battle/move-fx/v1/rubber_pistol.webp",
    "images/board/battle/move-fx/v1/sand_blade.webp",
    "images/board/battle/move-fx/v1/sand_erosion.webp",
    "images/board/battle/move-fx/v1/sand_vortex.webp",
    "images/board/battle/move-fx/v1/shadow_claw.webp",
    "images/board/battle/move-fx/v1/silence_field.webp",
    "images/board/battle/move-fx/v1/smoke_bind.webp",
    "images/board/battle/move-fx/v1/smoke_fist.webp",
    "images/board/battle/move-fx/v1/song_wave.webp",
    "images/board/battle/move-fx/v1/speed_dash.webp",
    "images/board/battle/move-fx/v1/spring_coil.webp",
    "images/board/battle/move-fx/v1/stone_crush.webp",
    "images/board/battle/move-fx/v1/storm_cloud.webp",
    "images/board/battle/move-fx/v1/string_cage.webp",
    "images/board/battle/move-fx/v1/string_slash.webp",
    "images/board/battle/move-fx/v1/sword_thrust.webp",
    "images/board/battle/move-fx/v1/thorn_cage.webp",
    "images/board/battle/move-fx/v1/vampire_swarm.webp",
    "images/board/battle/move-fx/v1/water_fist.webp",
    "images/board/battle/move-fx/v1/water_wave.webp",
    "images/board/battle/move-fx/v1/wax_cage.webp",
    "images/board/battle/move-fx/v1/wax_weapon.webp",
    "images/board/battle/move-fx/v1/weaken_mist.webp",
    "images/board/battle/move-fx/v1/wind_blade.webp",
    "images/board/battle/nika_frame/nika_card_frame.webp",
    "images/board/battle/nika_frame/nika_cloud_crown.webp",
    "images/board/battle/nika_frame/nika_cloud_left.webp",
    "images/board/battle/nika_frame/nika_cloud_right.webp",
    "images/board/battle/nika_frame/nika_nameplate.webp",
    "images/board/battle/nika_frame/nika_sun_glow.webp",
    "images/board/battle/portraits/placeholder/normal.png",
    "images/board/battle/portraits/placeholder/normal.webp",
    "images/board/battle/postgame_mechanic_effects/judge_clone_guard/judge_clone_guard.webp",
    "images/board/battle/postgame_mechanics/lucci_rokuogan/rokuogan_impact.webp",
    "images/board/battle/postgame_mechanics/lucci_six_powers/geppo.webp",
    "images/board/battle/postgame_mechanics/lucci_six_powers/kamie.webp",
    "images/board/battle/postgame_mechanics/lucci_six_powers/rankyaku.webp",
    "images/board/battle/postgame_mechanics/lucci_six_powers/shigan.webp",
    "images/board/battle/postgame_mechanics/lucci_six_powers/soru.webp",
    "images/board/battle/postgame_mechanics/lucci_six_powers/tekkai.webp",
    "images/board/battle/postgame_mechanics/oars/oars_salt_purification.webp",
    "images/board/battle/postgame_mechanics/postgame_zephyr/dyna_stone_cylinder_v2.webp",
    "images/board/battle/postgame_mechanics/postgame_zephyr/dyna_stone_v1.webp",
    "images/board/battle/postgame_mechanics/shiki_archipelago/beast.webp",
    "images/board/battle/postgame_mechanics/shiki_archipelago/beast_broken.webp",
    "images/board/battle/postgame_mechanics/shiki_archipelago/fleet.webp",
    "images/board/battle/postgame_mechanics/shiki_archipelago/fleet_broken.webp",
    "images/board/battle/postgame_mechanics/shiki_archipelago/lion.webp",
    "images/board/battle/postgame_mechanics/shiki_archipelago/lion_broken.webp",
    "images/board/battle/postgame_mechanics/tesoro_gold_shell/gold_river_fill_v1.webp",
    "images/board/battle/postgame_mechanics/tesoro_gold_shell/half_body_gold_doll.webp",
    "images/board/battle/postgame_mechanics/tesoro_gold_shell/half_body_gold_texture.webp",
    "images/board/battle/status_icons/accuracy_down.webp",
    "images/board/battle/status_icons/accuracy_up.webp",
    "images/board/battle/status_icons/atk_down.webp",
    "images/board/battle/status_icons/atk_up.webp",
    "images/board/battle/status_icons/bind.webp",
    "images/board/battle/status_icons/bleed.webp",
    "images/board/battle/status_icons/burn.webp",
    "images/board/battle/status_icons/damage_up.webp",
    "images/board/battle/status_icons/def_down.webp",
    "images/board/battle/status_icons/def_up.webp",
    "images/board/battle/status_icons/evasion_down.webp",
    "images/board/battle/status_icons/evasion_up.webp",
    "images/board/battle/status_icons/first.webp",
    "images/board/battle/status_icons/freeze.webp",
    "images/board/battle/status_icons/heal.webp",
    "images/board/battle/status_icons/paralyze.webp",
    "images/board/battle/status_icons/poison.webp",
    "images/board/battle/status_icons/reflect.webp",
    "images/board/battle/status_icons/shield.webp",
    "images/board/battle/status_icons/spd_down.webp",
    "images/board/battle/status_icons/spd_up.webp",
    "images/board/battle/tot_musica_dual/tot_musica_boss_wave_down.webp",
    "images/board/battle/tot_musica_dual/tot_musica_sync_spiral_blue.webp",
    "images/board/battle/tot_musica_dual/tot_musica_sync_spiral_red.webp",
    "images/board/battle/tot_musica_dual/tot_musica_sync_wave_up.webp",
    "images/board/battle/tot_musica_dual/tot_musica_sync_wave_up_v2.webp",
    "images/board/battle/tot_musica_dual/tot_musica_unsynced_blue_up.webp",
    "images/board/battle/tot_musica_dual/tot_musica_unsynced_red_up.webp",
    "images/board/battle_command_ui/battle_command_action_button_frame.webp",
    "images/board/battle_command_ui/battle_command_choice_button_frame.webp",
    "images/board/battle_command_ui/battle_command_danger_button_frame.webp",
    "images/board/battle_command_ui/battle_command_icon_attack.webp",
    "images/board/battle_command_ui/battle_command_icon_escape.webp",
    "images/board/battle_command_ui/battle_command_icon_items.webp",
    "images/board/battle_command_ui/battle_command_icon_partners.webp",
    "images/board/battle_command_ui/battle_command_notice_frame.webp",
    "images/board/battle_coop_ui/coop_view_switch_tab_frame.webp",
    "images/board/battle_dice_ui/battle_dice_blank.webp",
    "images/board/battle_dice_ui/battle_eclipse_third_dice.webp",
    "images/board/battle_dice_ui/battle_extra_dice_blank.webp",
    "images/board/battle_hud_dialogue_ui/battle_dialogue_enemy_frame.webp",
    "images/board/battle_hud_dialogue_ui/battle_dialogue_player_frame.webp",
    "images/board/battle_hud_dialogue_ui/battle_dialogue_start_frame.webp",
    "images/board/battle_hud_dialogue_ui/battle_hud_enemy_frame.webp",
    "images/board/battle_hud_dialogue_ui/battle_hud_player_frame.webp",
    "images/board/battle_result_ui/battle_result_player_card_frame.webp",
    "images/board/battle_switch_ui/battle_switch_crew_row_frame.webp",
    "images/board/battle_switch_ui/battle_switch_panel_frame.webp",
    "images/board/captain_selection_ui/captain_selection_panel_frame.webp",
    "images/board/captain_selection_ui/captain_selection_row_frame.webp",
    "images/board/carry_item_ui/carry_item_panel_frame.webp",
    "images/board/cosmetic_frame_ui/cosmetic_frame_panel_frame.webp",
    "images/board/cpu_strategy_ui/cpu_strategy_panel_frame.webp",
    "images/board/cpu_strategy_ui/cpu_strategy_row_frame.webp",
    "images/board/crew_ui/crew_captain_emblem.webp",
    "images/board/crew_ui/crew_detail_panel_frame.webp",
    "images/board/crew_ui/crew_info_section_frame.webp",
    "images/board/crew_ui/crew_member_row_frame.webp",
    "images/board/crew_ui/crew_roster_panel_frame.webp",
    "images/board/cursors/board_cursor_nami_chart_pen_default_v1.png",
    "images/board/cursors/board_cursor_nami_chart_pen_pointer_v1.png",
    "images/board/cursors/board_cursor_nami_chart_pen_pressed_v1.png",
    "images/board/cursors/board_cursor_nami_quill_default_v2.png",
    "images/board/cursors/board_cursor_nami_quill_default_v3.png",
    "images/board/cursors/board_cursor_nami_quill_pointer_v2.png",
    "images/board/cursors/board_cursor_nami_quill_pointer_v3.png",
    "images/board/cursors/board_cursor_nami_quill_pressed_v2.png",
    "images/board/cursors/board_cursor_nami_quill_pressed_v3.png",
    "images/board/decorations/reefs/reef_01.webp",
    "images/board/decorations/reefs/reef_02.webp",
    "images/board/decorations/reefs/reef_03.webp",
    "images/board/decorations/reefs/reef_04.webp",
    "images/board/decorations/reefs/reef_05.webp",
    "images/board/decorations/sea_beasts/sea_beast_01.webp",
    "images/board/decorations/sea_beasts/sea_beast_02.webp",
    "images/board/decorations/sea_beasts/sea_beast_03.webp",
    "images/board/decorations/sea_beasts/sea_beast_04.webp",
    "images/board/decorations/sea_beasts/sea_beast_05.webp",
    "images/board/decorations/sea_beasts/sea_beast_06.webp",
    "images/board/decorations/sea_beasts/sea_beast_07.webp",
    "images/board/defeated_codex_ui/defeated_codex_panel_frame.webp",
    "images/board/defeated_codex_ui/defeated_codex_panel_frame_cutout.webp",
    "images/board/defeated_codex_ui/defeated_enemy_row_frame.webp",
    "images/board/dice_ui/dice_face_1.webp",
    "images/board/dice_ui/dice_face_2.webp",
    "images/board/dice_ui/dice_face_3.webp",
    "images/board/dice_ui/dice_face_4.webp",
    "images/board/dice_ui/dice_face_5.webp",
    "images/board/dice_ui/dice_face_6.webp",
    "images/board/dice_ui/dice_face_7.webp",
    "images/board/dice_ui/dice_face_8.webp",
    "images/board/dice_ui/dice_face_9.webp",
    "images/board/dice_ui/dice_stage_frame.webp",
    "images/board/draft_recruitment/draft_boarding_stamp.webp",
    "images/board/draft_recruitment/draft_character_card_frame.webp",
    "images/board/draft_recruitment/draft_character_detail_frame.webp",
    "images/board/draft_recruitment/draft_crew_slots_frame.webp",
    "images/board/draft_recruitment/draft_decor_left.webp",
    "images/board/draft_recruitment/draft_decor_right.webp",
    "images/board/draft_recruitment/draft_destiny_pointer.webp",
    "images/board/draft_recruitment/draft_destiny_wheel.webp",
    "images/board/draft_recruitment/draft_destiny_wheel_pedestal.webp",
    "images/board/draft_recruitment/draft_order_compass_board.webp",
    "images/board/draft_recruitment/draft_recruit_board_frame.webp",
    "images/board/draft_recruitment/draft_title_banner.webp",
    "images/board/encounter_ui/encounter_action_button_frame.webp",
    "images/board/encounter_ui/encounter_panel_frame.webp",
    "images/board/evolution/materials/three_d2y_luffy_mourning_newspaper.webp",
    "images/board/evolution/materials/world_government_pierced_flag.webp",
    "images/board/evolution_ui/evolution_portrait_frame_awakened_v1.webp",
    "images/board/evolution_ui/evolution_portrait_frame_awakened_v2.webp",
    "images/board/evolution_ui/evolution_portrait_frame_v1.webp",
    "images/board/final_island/endings/lore/d_clan_joyboy_sigil.webp",
    "images/board/final_island/endings/overlays/all_blue_fish_sphere.webp",
    "images/board/final_island/endings/overlays/ancient_sea_chart_scroll.webp",
    "images/board/final_island/endings/overlays/ancient_toast_cup.webp",
    "images/board/final_island/endings/overlays/ancient_weapon_symbols.webp",
    "images/board/final_island/endings/overlays/banquet_cup_row.webp",
    "images/board/final_island/endings/overlays/banquet_lantern_chandelier.webp",
    "images/board/final_island/endings/overlays/binks_sake_barrel.webp",
    "images/board/final_island/endings/overlays/binks_sake_melody_ribbon.webp",
    "images/board/final_island/endings/overlays/dawn_sunburst_overlay.webp",
    "images/board/final_island/endings/overlays/four_seas_coordinate_bloom.webp",
    "images/board/final_island/endings/overlays/joyboy_drum.webp",
    "images/board/final_island/endings/overlays/joyboy_golden_silhouette.webp",
    "images/board/final_island/endings/overlays/joyboy_message_stone.webp",
    "images/board/final_island/endings/overlays/one_piece_dawn_cup.webp",
    "images/board/final_island/endings/overlays/one_piece_golden_sake_barrel.webp",
    "images/board/final_island/endings/overlays/one_piece_treasure_chest.webp",
    "images/board/final_island/endings/overlays/red_coordinate_cross.webp",
    "images/board/final_island/endings/overlays/red_line_crack_core.webp",
    "images/board/final_island/endings/overlays/red_poneglyph_memory_shards.webp",
    "images/board/final_island/endings/overlays/roger_crew_memory_silhouette.webp",
    "images/board/final_island/endings/overlays/smiling_gold_coins.webp",
    "images/board/final_island/endings/overlays/void_century_people_silhouette.webp",
    "images/board/final_island/endings/overlays/world_lantern_constellation.webp",
    "images/board/final_island/final_gate_black_mist_01.png",
    "images/board/final_island/final_gate_black_mist_02.png",
    "images/board/final_island/final_gate_black_mist_03.png",
    "images/board/final_island/final_gate_haki_lightning_01.png",
    "images/board/final_island/final_gate_haki_lightning_02.png",
    "images/board/final_island/final_gate_haki_lightning_03.png",
    "images/board/final_island/final_gate_map_imu.png",
    "images/board/final_island/final_gate_map_portal.png",
    "images/board/final_island/final_gate_shadow_pillars.png",
    "images/board/final_island/final_imu_portal.png",
    "images/board/final_island/final_imu_shadow_pillars.png",
    "images/board/final_island/final_imu_silhouette.png",
    "images/board/final_island/kuma_paw_transfer/paw_flight_bubble.webp",
    "images/board/final_island/kuma_paw_transfer/paw_landing_impact.webp",
    "images/board/final_island/road_poneglyph_copy_east_cutout.webp",
    "images/board/final_island/road_poneglyph_copy_north_cutout.webp",
    "images/board/final_island/road_poneglyph_copy_south_cutout.webp",
    "images/board/final_island/road_poneglyph_copy_west_cutout.webp",
    "images/board/final_island/road_poneglyph_stone_east.webp",
    "images/board/final_island/road_poneglyph_stone_north.webp",
    "images/board/final_island/road_poneglyph_stone_south.webp",
    "images/board/final_island/road_poneglyph_stone_west.webp",
    "images/board/final_island/robin_reading_cutout.webp",
    "images/board/fixed_step_ui/fixed_step_panel_frame.webp",
    "images/board/fleet_info_ui/fleet_info_panel_frame.webp",
    "images/board/fleet_info_ui/fleet_role_stage_row_frame.webp",
    "images/board/game/sea_cards/backs/medicine_back.webp",
    "images/board/game/sea_cards/backs/money_back.webp",
    "images/board/game/sea_cards/backs/treasure_back.webp",
    "images/board/game/sea_cards/backs/weather_back.webp",
    "images/board/game/sea_chests/chest_back_shadow.webp",
    "images/board/game/sea_chests/chest_copper.webp",
    "images/board/game/sea_chests/chest_gem.webp",
    "images/board/game/sea_chests/chest_gold.webp",
    "images/board/game/sea_chests/chest_silver.webp",
    "images/board/game/sea_chests/chest_wood.webp",
    "images/board/healing_quantity_ui/healing_item_quantity_frame.webp",
    "images/board/hospital_ui/hospital_crew_status_card_frame.webp",
    "images/board/hospital_ui/hospital_panel_frame.webp",
    "images/board/hospital_ui/hospital_primary_button_frame.webp",
    "images/board/hospital_ui/hospital_secondary_button_frame.webp",
    "images/board/impel_down_ui/event_icons/hidden.webp",
    "images/board/impel_down_ui/event_icons/ivankov.webp",
    "images/board/impel_down_ui/event_icons/key.webp",
    "images/board/impel_down_ui/event_icons/magellan.webp",
    "images/board/impel_down_ui/event_icons/patrol.webp",
    "images/board/impel_down_ui/event_icons/unknown.webp",
    "images/board/impel_down_ui/impel_down_action_command_frame.webp",
    "images/board/impel_down_ui/impel_down_captive_cage_overlay.webp",
    "images/board/impel_down_ui/impel_down_dice_event_reveal_frame.webp",
    "images/board/impel_down_ui/impel_down_dungeon_panel_frame.webp",
    "images/board/impel_down_ui/impel_down_dungeon_panel_frame_v3.webp",
    "images/board/impel_down_ui/impel_down_entry_rescue_panel_frame.webp",
    "images/board/impel_down_ui/impel_down_event_result_hidden.webp",
    "images/board/impel_down_ui/impel_down_event_result_ivankov.webp",
    "images/board/impel_down_ui/impel_down_event_result_key.webp",
    "images/board/impel_down_ui/impel_down_event_result_magellan.webp",
    "images/board/impel_down_ui/impel_down_event_result_patrol.webp",
    "images/board/impel_down_ui/impel_down_event_roulette_row_frame.webp",
    "images/board/impel_down_ui/impel_down_floor_row_frame.webp",
    "images/board/impel_down_ui/impel_down_hidden_prisoner_pool_panel_frame.webp",
    "images/board/impel_down_ui/impel_down_prisoner_candidate_card_frame.webp",
    "images/board/impel_down_ui/impel_down_prisoner_draw_roulette_panel_frame.webp",
    "images/board/impel_down_ui/impel_down_prisoner_draw_roulette_panel_frame_v3.webp",
    "images/board/impel_down_ui/impel_down_prisoner_recruit_result_panel_frame.webp",
    "images/board/impel_down_ui/impel_down_prisoner_replacement_card_frame.webp",
    "images/board/impel_down_ui/impel_down_rescue_player_row_frame.webp",
    "images/board/impel_down_ui/impel_down_state_escaped.webp",
    "images/board/impel_down_ui/impel_down_state_move_choice.webp",
    "images/board/impel_down_ui/impel_down_state_move_escape_choice.webp",
    "images/board/impel_down_ui/impel_down_state_wait_event.webp",
    "images/board/island_decision_ui/island_decision_continue_button_frame.webp",
    "images/board/island_decision_ui/island_decision_panel_frame.webp",
    "images/board/island_decision_ui/island_decision_stay_button_frame.webp",
    "images/board/islands/arena_island.webp",
    "images/board/islands/elbaph_island.webp",
    "images/board/islands/enemy_island.webp",
    "images/board/islands/hospital_island.webp",
    "images/board/islands/impel_down_island.webp",
    "images/board/islands/judicial_island.webp",
    "images/board/islands/laugh_tale_island.webp",
    "images/board/islands/loguetown_island.webp",
    "images/board/islands/marineford_island.webp",
    "images/board/islands/mission_island.webp",
    "images/board/islands/postgame_boss_aramaki_island.webp",
    "images/board/islands/postgame_boss_charlotte_katakuri_island.webp",
    "images/board/islands/postgame_boss_douglas_bullet_island.webp",
    "images/board/islands/postgame_boss_gild_tesoro_island.webp",
    "images/board/islands/postgame_boss_king_island.webp",
    "images/board/islands/postgame_boss_loki_island.webp",
    "images/board/islands/postgame_boss_oars_island.webp",
    "images/board/islands/postgame_boss_patrick_redfield_island.webp",
    "images/board/islands/postgame_boss_rob_lucci_awakened_island.webp",
    "images/board/islands/postgame_boss_saga_island.webp",
    "images/board/islands/postgame_boss_shiki_island.webp",
    "images/board/islands/postgame_boss_tot_musica_island.webp",
    "images/board/islands/postgame_boss_vinsmoke_judge_island.webp",
    "images/board/islands/postgame_boss_zephyr_island.webp",
    "images/board/islands/postgame_calm_belt_island.webp",
    "images/board/islands/postgame_egghead_island.webp",
    "images/board/islands/research_lab_island.webp",
    "images/board/islands/shop_island.webp",
    "images/board/islands/tavern_island.webp",
    "images/board/islands/unknown_island.webp",
    "images/board/islands/water_seven_island.webp",
    "images/board/islands/yonko_bigmom_island.webp",
    "images/board/islands/yonko_blackbeard_island.webp",
    "images/board/islands/yonko_kaido_island.webp",
    "images/board/islands/yonko_shanks_island.webp",
    "images/board/islands/yonko_whitebeard_island.webp",
    "images/board/item_reveal_ui/important_item_reveal_panel_frame.webp",
    "images/board/items/backpack_closed_ui.webp",
    "images/board/items/backpack_open_ui.webp",
    "images/board/items/devon_kyubi_mask.webp",
    "images/board/items/new_world_newspaper_3d2y.webp",
    "images/board/items/pierced_flag.webp",
    "images/board/items/postgame_boss_relics/enma.webp",
    "images/board/items/postgame_boss_relics/judge_germa66_battle_suit.webp",
    "images/board/items/postgame_boss_relics/saga_seven_star_sword.webp",
    "images/board/judicial_raid_ui/judicial_raid_panel_frame.webp",
    "images/board/judicial_raid_ui/judicial_raid_participant_frame.webp",
    "images/board/judicial_raid_ui/judicial_raid_phase_frame.webp",
    "images/board/judicial_raid_ui/reward_icons/attack.webp",
    "images/board/judicial_raid_ui/reward_icons/burst.webp",
    "images/board/judicial_raid_ui/reward_icons/defense.webp",
    "images/board/judicial_raid_ui/reward_icons/heal.webp",
    "images/board/judicial_raid_ui/reward_icons/pp.webp",
    "images/board/judicial_raid_ui/reward_icons/revive.webp",
    "images/board/judicial_raid_ui/reward_icons/shield.webp",
    "images/board/judicial_raid_ui/reward_icons/speed.webp",
    "images/board/judicial_raid_ui/reward_icons/unknown.webp",
    "images/board/lineage_extraction_ui/incoming_osu/lineage_osu_approach_circle-Photoroom.webp",
    "images/board/lineage_extraction_ui/incoming_osu/lineage_osu_hit_circle-Photoroom.webp",
    "images/board/lineage_extraction_ui/lineage_extraction_chamber_frame.webp",
    "images/board/lineage_extraction_ui/lineage_extraction_failure_panel_frame.webp",
    "images/board/lineage_extraction_ui/lineage_extraction_game_panel_frame.webp",
    "images/board/lineage_extraction_ui/lineage_extraction_success_panel_frame.webp",
    "images/board/lineage_extraction_ui/lineage_extractor_ability.webp",
    "images/board/lineage_extraction_ui/lineage_extractor_card_frame.webp",
    "images/board/lineage_extraction_ui/lineage_extractor_cylinder_7_slot.webp",
    "images/board/lineage_extraction_ui/lineage_extractor_emperor.webp",
    "images/board/lineage_extraction_ui/lineage_extractor_launcher_frame_v2.webp",
    "images/board/lineage_extraction_ui/lineage_extractor_precision.webp",
    "images/board/lineage_extraction_ui/lineage_extractor_resonance_power.webp",
    "images/board/lineage_extraction_ui/lineage_extractor_resonance_skill.webp",
    "images/board/lineage_extraction_ui/lineage_extractor_resonance_speed.webp",
    "images/board/lineage_extraction_ui/lineage_extractor_resonance_speed_launcher_v2.webp",
    "images/board/lineage_extraction_ui/lineage_extractor_selection_panel_frame.webp",
    "images/board/lineage_extraction_ui/lineage_extractor_standard.webp",
    "images/board/lineage_extraction_ui/lineage_extractor_standard_launcher_v2.webp",
    "images/board/lineage_extraction_ui/lineage_lock_marker.webp",
    "images/board/lineage_extraction_ui/lineage_lock_marker_v2.webp",
    "images/board/lineage_extraction_ui/lineage_lock_target_track_v2.webp",
    "images/board/lineage_extraction_ui/lineage_lock_track.webp",
    "images/board/lineage_extraction_ui/lineage_scan_pointer.webp",
    "images/board/lineage_extraction_ui/lineage_scan_target_arc_v2.webp",
    "images/board/lineage_extraction_ui/lineage_seal_fixed_ring.webp",
    "images/board/lineage_extraction_ui/lineage_seal_fixed_ring_v2.webp",
    "images/board/lineage_extraction_ui/lineage_seal_pulse_ring.webp",
    "images/board/lineage_extraction_ui/lineage_seal_pulse_ring_v2.webp",
    "images/board/map_hud_ui/action_icons/action_notice_icon_battle.webp",
    "images/board/map_hud_ui/action_icons/action_notice_icon_final.webp",
    "images/board/map_hud_ui/action_icons/action_notice_icon_island.webp",
    "images/board/map_hud_ui/action_icons/action_notice_icon_mission.webp",
    "images/board/map_hud_ui/action_icons/action_notice_icon_spectate.webp",
    "images/board/map_hud_ui/action_icons/action_notice_icon_support.webp",
    "images/board/map_hud_ui/action_icons/action_notice_icon_tavern.webp",
    "images/board/map_hud_ui/action_icons/action_notice_icon_treasure.webp",
    "images/board/map_hud_ui/map_turn_status_frame_v1.webp",
    "images/board/map_info_ui/inversion_mountain_overview_frame.webp",
    "images/board/map_info_ui/map_node_info_panel_frame.webp",
    "images/board/marineford/props/execution_cut_video/conqueror_guard_halves/execution_guard_top_left.png",
    "images/board/marineford/props/execution_cut_video/conqueror_guard_halves/execution_guard_top_right.png",
    "images/board/marineford/props/execution_cut_video/marine_execution_raise_then_cut_snap_footlock_24fps.webp",
    "images/board/marineford/props/execution_cut_video/transparent_frames_24fps_raise_then_cut_snap_footlock/marine_execution_raise_cut_footlock24_122.png",
    "images/board/marineford/props/execution_guard_crossed_swords.png",
    "images/board/marineford/props/execution_platform.webp",
    "images/board/marineford/props/ivankov_hormone.webp",
    "images/board/marineford_ui/marineford_countdown_rescue_dice_frame.webp",
    "images/board/marineford_ui/marineford_current_boss_card_frame.webp",
    "images/board/marineford_ui/marineford_execution_intel_row_frame.webp",
    "images/board/marineford_ui/marineford_lottery_panel_frame.webp",
    "images/board/marineford_ui/marineford_lottery_player_info_frame.webp",
    "images/board/marineford_ui/marineford_lottery_result_character_frame.webp",
    "images/board/marineford_ui/marineford_player_lottery_reel_frame.webp",
    "images/board/marineford_ui/marineford_raid_panel_frame.webp",
    "images/board/mission_board_ui/mission_board_mission_card_frame.webp",
    "images/board/mission_board_ui/mission_board_mission_card_frame_v2.webp",
    "images/board/mission_board_ui/mission_board_panel_frame.webp",
    "images/board/mission_board_ui/mission_board_panel_frame_v2.webp",
    "images/board/mission_board_ui/mission_board_primary_button_frame.webp",
    "images/board/mission_board_ui/mission_board_secondary_button_frame.webp",
    "images/board/mission_island/mission_board_frame.webp",
    "images/board/mission_island/morgans_blink.webp",
    "images/board/mission_island/morgans_open.webp",
    "images/board/mission_island/rank_a.webp",
    "images/board/mission_island/rank_b.webp",
    "images/board/mission_island/rank_c.webp",
    "images/board/mission_island/rank_d.webp",
    "images/board/mission_island/rank_e.webp",
    "images/board/mission_island/rank_s.webp",
    "images/board/mission_journal_ui/mission_journal_panel_frame.webp",
    "images/board/mission_journal_ui/mission_journal_row_frame.webp",
    "images/board/mission_journal_ui/mission_rank_a.webp",
    "images/board/mission_journal_ui/mission_rank_b.webp",
    "images/board/mission_journal_ui/mission_rank_c.webp",
    "images/board/mission_journal_ui/mission_rank_d.webp",
    "images/board/mission_journal_ui/mission_rank_e.webp",
    "images/board/mission_journal_ui/mission_rank_s.webp",
    "images/board/mobile/avatars/1.webp",
    "images/board/mobile/avatars/10.webp",
    "images/board/mobile/avatars/11.webp",
    "images/board/mobile/avatars/12.webp",
    "images/board/mobile/avatars/13.webp",
    "images/board/mobile/avatars/14.webp",
    "images/board/mobile/avatars/15.webp",
    "images/board/mobile/avatars/16.webp",
    "images/board/mobile/avatars/17.webp",
    "images/board/mobile/avatars/18.webp",
    "images/board/mobile/avatars/19.webp",
    "images/board/mobile/avatars/2.webp",
    "images/board/mobile/avatars/20.webp",
    "images/board/mobile/avatars/21.webp",
    "images/board/mobile/avatars/22.webp",
    "images/board/mobile/avatars/23.webp",
    "images/board/mobile/avatars/24.webp",
    "images/board/mobile/avatars/25.webp",
    "images/board/mobile/avatars/26.webp",
    "images/board/mobile/avatars/27.webp",
    "images/board/mobile/avatars/28.webp",
    "images/board/mobile/avatars/29.webp",
    "images/board/mobile/avatars/3.webp",
    "images/board/mobile/avatars/30.webp",
    "images/board/mobile/avatars/31.webp",
    "images/board/mobile/avatars/32.webp",
    "images/board/mobile/avatars/33.webp",
    "images/board/mobile/avatars/34.webp",
    "images/board/mobile/avatars/35.webp",
    "images/board/mobile/avatars/36.webp",
    "images/board/mobile/avatars/37.webp",
    "images/board/mobile/avatars/38.webp",
    "images/board/mobile/avatars/39.webp",
    "images/board/mobile/avatars/4.webp",
    "images/board/mobile/avatars/40.webp",
    "images/board/mobile/avatars/41.webp",
    "images/board/mobile/avatars/42.webp",
    "images/board/mobile/avatars/43.webp",
    "images/board/mobile/avatars/44.webp",
    "images/board/mobile/avatars/45.webp",
    "images/board/mobile/avatars/46.webp",
    "images/board/mobile/avatars/47.webp",
    "images/board/mobile/avatars/48.webp",
    "images/board/mobile/avatars/49.webp",
    "images/board/mobile/avatars/5.webp",
    "images/board/mobile/avatars/50.webp",
    "images/board/mobile/avatars/6.webp",
    "images/board/mobile/avatars/7.webp",
    "images/board/mobile/avatars/8.webp",
    "images/board/mobile/avatars/9.webp",
    "images/board/mobile/decorations/reefs/reef_01.webp",
    "images/board/mobile/decorations/reefs/reef_02.webp",
    "images/board/mobile/decorations/reefs/reef_03.webp",
    "images/board/mobile/decorations/reefs/reef_04.webp",
    "images/board/mobile/decorations/reefs/reef_05.webp",
    "images/board/mobile/decorations/sea_beasts/sea_beast_01.webp",
    "images/board/mobile/decorations/sea_beasts/sea_beast_02.webp",
    "images/board/mobile/decorations/sea_beasts/sea_beast_03.webp",
    "images/board/mobile/decorations/sea_beasts/sea_beast_04.webp",
    "images/board/mobile/decorations/sea_beasts/sea_beast_05.webp",
    "images/board/mobile/decorations/sea_beasts/sea_beast_06.webp",
    "images/board/mobile/decorations/sea_beasts/sea_beast_07.webp",
    "images/board/mobile/islands/arena_island.webp",
    "images/board/mobile/islands/elbaph_island.webp",
    "images/board/mobile/islands/enemy_island.webp",
    "images/board/mobile/islands/hospital_island.webp",
    "images/board/mobile/islands/impel_down_island.webp",
    "images/board/mobile/islands/judicial_island.webp",
    "images/board/mobile/islands/laugh_tale_island.webp",
    "images/board/mobile/islands/loguetown_island.webp",
    "images/board/mobile/islands/marineford_island.webp",
    "images/board/mobile/islands/mission_island.webp",
    "images/board/mobile/islands/postgame_boss_aramaki_island.webp",
    "images/board/mobile/islands/postgame_boss_charlotte_katakuri_island.webp",
    "images/board/mobile/islands/postgame_boss_douglas_bullet_island.webp",
    "images/board/mobile/islands/postgame_boss_gild_tesoro_island.webp",
    "images/board/mobile/islands/postgame_boss_king_island.webp",
    "images/board/mobile/islands/postgame_boss_loki_island.webp",
    "images/board/mobile/islands/postgame_boss_oars_island.webp",
    "images/board/mobile/islands/postgame_boss_patrick_redfield_island.webp",
    "images/board/mobile/islands/postgame_boss_rob_lucci_awakened_island.webp",
    "images/board/mobile/islands/postgame_boss_saga_island.webp",
    "images/board/mobile/islands/postgame_boss_shiki_island.webp",
    "images/board/mobile/islands/postgame_boss_tot_musica_island.webp",
    "images/board/mobile/islands/postgame_boss_vinsmoke_judge_island.webp",
    "images/board/mobile/islands/postgame_boss_zephyr_island.webp",
    "images/board/mobile/islands/postgame_calm_belt_island.webp",
    "images/board/mobile/islands/postgame_egghead_island.webp",
    "images/board/mobile/islands/research_lab_island.webp",
    "images/board/mobile/islands/shop_island.webp",
    "images/board/mobile/islands/tavern_island.webp",
    "images/board/mobile/islands/unknown_island.webp",
    "images/board/mobile/islands/water_seven_island.webp",
    "images/board/mobile/islands/yonko_bigmom_island.webp",
    "images/board/mobile/islands/yonko_blackbeard_island.webp",
    "images/board/mobile/islands/yonko_kaido_island.webp",
    "images/board/mobile/islands/yonko_shanks_island.webp",
    "images/board/mobile/islands/yonko_whitebeard_island.webp",
    "images/board/mobile/ships/ship_01.webp",
    "images/board/mobile/ships/ship_02.webp",
    "images/board/mobile/ships/ship_03.webp",
    "images/board/mobile/ships/ship_04.webp",
    "images/board/mobile/ships/ship_05.webp",
    "images/board/mobile/ships/ship_06.webp",
    "images/board/move_learn_ui/move_learn_panel_frame.webp",
    "images/board/move_learn_ui/move_type_icons/buff.webp",
    "images/board/move_learn_ui/move_type_icons/control.webp",
    "images/board/move_learn_ui/move_type_icons/debuff.webp",
    "images/board/move_learn_ui/move_type_icons/heal.webp",
    "images/board/move_learn_ui/move_type_icons/physical_attack.webp",
    "images/board/move_learn_ui/move_type_icons/shield.webp",
    "images/board/move_learn_ui/move_type_icons/special_attack.webp",
    "images/board/move_learn_ui/move_type_icons/status.webp",
    "images/board/postgame_clue_puzzle_ui/york_clue_puzzle_main_frame.webp",
    "images/board/postgame_clue_puzzle_ui/york_coordinate_decoder_t1.webp",
    "images/board/postgame_clue_puzzle_ui/york_coordinate_decoder_t2.webp",
    "images/board/postgame_clue_puzzle_ui/york_coordinate_decoder_t3.webp",
    "images/board/postgame_clue_puzzle_ui/york_decoder_result_frame.webp",
    "images/board/postgame_clue_puzzle_ui/york_difficulty_easy_frame.webp",
    "images/board/postgame_clue_puzzle_ui/york_difficulty_hard_frame.webp",
    "images/board/postgame_clue_puzzle_ui/york_difficulty_normal_frame.webp",
    "images/board/postgame_clue_puzzle_ui/york_primary_button_frame.webp",
    "images/board/postgame_clue_puzzle_ui/york_secondary_button_frame.webp",
    "images/board/postgame_clue_puzzle_ui/york_slot_lock_button.webp",
    "images/board/postgame_clue_puzzle_ui/york_slot_unlock_button.webp",
    "images/board/research_lab_ui/cultivation/research_lab_clone_cultivation_chamber.webp",
    "images/board/research_lab_ui/research_lab_character_card_frame.webp",
    "images/board/research_lab_ui/research_lab_panel_frame.webp",
    "images/board/research_lab_ui/research_lab_primary_button_frame.webp",
    "images/board/research_lab_ui/research_lab_secondary_button_frame.webp",
    "images/board/save_load_ui/save_load_danger_button_frame.webp",
    "images/board/save_load_ui/save_load_panel_frame.webp",
    "images/board/save_load_ui/save_load_primary_button_frame.webp",
    "images/board/save_load_ui/save_load_secondary_button_frame.webp",
    "images/board/save_load_ui/save_record_card_frame.webp",
    "images/board/sea_chest_ui/sea_chest_mystery_back.webp",
    "images/board/sea_chest_ui/sea_chest_shuffle_panel_frame.webp",
    "images/board/sea_event_ui/sea_event_card_medicine.webp",
    "images/board/sea_event_ui/sea_event_card_money.webp",
    "images/board/sea_event_ui/sea_event_card_treasure.webp",
    "images/board/sea_event_ui/sea_event_card_unknown.webp",
    "images/board/sea_event_ui/sea_event_card_weather.webp",
    "images/board/sea_event_ui/sea_event_choice_panel_frame.webp",
    "images/board/sea_event_ui/sea_event_result_panel_frame.webp",
    "images/board/sea_train_ticket_ui/sea_train_destination_card_frame.webp",
    "images/board/sea_train_ticket_ui/sea_train_ticket_panel_frame.webp",
    "images/board/ship_command/ship_command_icon_backpack.webp",
    "images/board/ship_command/ship_command_icon_crew.webp",
    "images/board/ship_command/ship_command_icon_fleet.webp",
    "images/board/ship_command/ship_command_icon_mission.webp",
    "images/board/ship_command/ship_command_icon_roll.webp",
    "images/board/ship_command/ship_command_icon_ship_info.webp",
    "images/board/ship_command/ship_command_icon_skill.webp",
    "images/board/ship_command/ship_command_panel_frame.webp",
    "images/board/ship_command/ship_command_primary_button_frame.webp",
    "images/board/ship_info_ui/ship_info_item_row_frame.webp",
    "images/board/ship_info_ui/ship_info_panel_frame.webp",
    "images/board/ship_info_ui/ship_info_slot_row_frame.webp",
    "images/board/ship_info_ui/ship_info_upgrade_row_frame.webp",
    "images/board/ship_info_ui/upgrade_icons/kitchen.webp",
    "images/board/ship_info_ui/upgrade_icons/rudder.webp",
    "images/board/ship_info_ui/upgrade_icons/sail.webp",
    "images/board/ship_info_ui/upgrade_icons/training.webp",
    "images/board/ship_info_ui/upgrade_icons/watchtower.webp",
    "images/board/ships/sea_train/sea_train_01.webp",
    "images/board/ships/sea_train/sea_train_02.webp",
    "images/board/ships/sea_train/sea_train_03.webp",
    "images/board/ships/sea_train/sea_train_04.webp",
    "images/board/ships/ship_01.webp",
    "images/board/ships/ship_02.webp",
    "images/board/ships/ship_03.webp",
    "images/board/ships/ship_04.webp",
    "images/board/ships/ship_05.webp",
    "images/board/ships/ship_06.webp",
    "images/board/shop_ui/shop_item_row_frame.webp",
    "images/board/shop_ui/shop_panel_frame.webp",
    "images/board/shop_ui/shop_quantity_confirm_frame.webp",
    "images/board/spar_ui/spar_character_card_overlay_frame_v1.webp",
    "images/board/spar_ui/spar_character_detail_overlay_frame_v1.webp",
    "images/board/story/aokiji_capture/source/aokiji_capture_lazy_v3.webp",
    "images/board/story/aokiji_capture/source/aokiji_capture_mercy_v3.webp",
    "images/board/story/aokiji_capture/source/aokiji_capture_serious_v3.webp",
    "images/board/story/opening/opening_role_battle.webp",
    "images/board/story/opening/opening_role_mobility.webp",
    "images/board/story/opening/opening_role_scout.webp",
    "images/board/story/opening/opening_role_support.webp",
    "images/board/story/opening/roger_execution_calm.webp",
    "images/board/story/opening/roger_execution_smile.webp",
    "images/board/story/speakers/beckman_smoke_calm.webp",
    "images/board/story/speakers/bigmom_rage.webp",
    "images/board/story/speakers/bigmom_soul_pressure.webp",
    "images/board/story/speakers/bigmom_tea_party.webp",
    "images/board/story/speakers/blackbeard_dark_pressure.webp",
    "images/board/story/speakers/blackbeard_grin.webp",
    "images/board/story/speakers/blackbeard_quake_rage.webp",
    "images/board/story/speakers/bonney_resolve.webp",
    "images/board/story/speakers/brogy_angry.webp",
    "images/board/story/speakers/brogy_laugh.webp",
    "images/board/story/speakers/brook_banquet.webp",
    "images/board/story/speakers/brook_cry_laugh.webp",
    "images/board/story/speakers/brook_violin.webp",
    "images/board/story/speakers/chopper_determined.webp",
    "images/board/story/speakers/chopper_happy.webp",
    "images/board/story/speakers/chopper_worried.webp",
    "images/board/story/speakers/dorry_angry.webp",
    "images/board/story/speakers/dorry_laugh.webp",
    "images/board/story/speakers/dragon_counterattack.webp",
    "images/board/story/speakers/franky_cry.webp",
    "images/board/story/speakers/franky_engineer.webp",
    "images/board/story/speakers/franky_proud.webp",
    "images/board/story/speakers/garling_crumbling.webp",
    "images/board/story/speakers/giant_child_cry.webp",
    "images/board/story/speakers/giant_child_smile.webp",
    "images/board/story/speakers/gorosei_ju_peter_crumbling.webp",
    "images/board/story/speakers/gorosei_mars_authority.webp",
    "images/board/story/speakers/gorosei_mars_crumbling.webp",
    "images/board/story/speakers/gorosei_nusjuro_cold_judgement.webp",
    "images/board/story/speakers/gorosei_nusjuro_crumbling.webp",
    "images/board/story/speakers/gorosei_warcury_contempt.webp",
    "images/board/story/speakers/gorosei_warcury_crumbling.webp",
    "images/board/story/speakers/imu_silhouette_calm.webp",
    "images/board/story/speakers/imu_silhouette_threat.webp",
    "images/board/story/speakers/jinbe_angry_guard.webp",
    "images/board/story/speakers/jinbe_resolve.webp",
    "images/board/story/speakers/jinbe_smile.webp",
    "images/board/story/speakers/jinbe_solemn.webp",
    "images/board/story/speakers/joyboy_message_apology.webp",
    "images/board/story/speakers/joyboy_message_dawn.webp",
    "images/board/story/speakers/joyboy_message_laugh.webp",
    "images/board/story/speakers/kaido_beast_form.webp",
    "images/board/story/speakers/kaido_human_grin.webp",
    "images/board/story/speakers/kaido_rage.webp",
    "images/board/story/speakers/kashi_laugh.webp",
    "images/board/story/speakers/kashi_shout.webp",
    "images/board/story/speakers/killingham_cold.webp",
    "images/board/story/speakers/killingham_retreat.webp",
    "images/board/story/speakers/koala_urgent_stop.webp",
    "images/board/story/speakers/koala_worried.webp",
    "images/board/story/speakers/kuma_memory_smile.webp",
    "images/board/story/speakers/lilith_explain.webp",
    "images/board/story/speakers/loki_rage.webp",
    "images/board/story/speakers/loki_serious.webp",
    "images/board/story/speakers/loki_smirk.webp",
    "images/board/story/speakers/lucky_roux_laugh_meat.webp",
    "images/board/story/speakers/lucky_roux_teasing_laugh.webp",
    "images/board/story/speakers/luffy_angry_ace.webp",
    "images/board/story/speakers/luffy_laugh.webp",
    "images/board/story/speakers/luffy_promise_serious.webp",
    "images/board/story/speakers/luffy_reunion_laugh.webp",
    "images/board/story/speakers/luffy_serious.webp",
    "images/board/story/speakers/luffy_smile.webp",
    "images/board/story/speakers/momonosuke_command.webp",
    "images/board/story/speakers/momonosuke_dragon_command.webp",
    "images/board/story/speakers/momonosuke_dragon_dawn.webp",
    "images/board/story/speakers/momonosuke_resolve.webp",
    "images/board/story/speakers/nami_angry_warning.webp",
    "images/board/story/speakers/nami_banquet_confused.webp",
    "images/board/story/speakers/nami_chart.webp",
    "images/board/story/speakers/nami_shocked.webp",
    "images/board/story/speakers/nami_smile.webp",
    "images/board/story/speakers/napoleon_homie.webp",
    "images/board/story/speakers/oden_carving.webp",
    "images/board/story/speakers/oden_laugh.webp",
    "images/board/story/speakers/oimo_happy.webp",
    "images/board/story/speakers/oimo_shout.webp",
    "images/board/story/speakers/prometheus_homie.webp",
    "images/board/story/speakers/robin_poneglyph_focus.webp",
    "images/board/story/speakers/robin_reading.webp",
    "images/board/story/speakers/robin_reveal.webp",
    "images/board/story/speakers/robin_smile.webp",
    "images/board/story/speakers/robin_sorrow.webp",
    "images/board/story/speakers/roger_memory_laugh.webp",
    "images/board/story/speakers/roger_memory_serious.webp",
    "images/board/story/speakers/sabo_command.webp",
    "images/board/story/speakers/sabo_discovery_shock.webp",
    "images/board/story/speakers/sanji_cook.webp",
    "images/board/story/speakers/sanji_cry_smile.webp",
    "images/board/story/speakers/sanji_serious.webp",
    "images/board/story/speakers/sanji_smoke_observe.webp",
    "images/board/story/speakers/shanks_calm.webp",
    "images/board/story/speakers/shanks_griffon_draw.webp",
    "images/board/story/speakers/shanks_pressure.webp",
    "images/board/story/speakers/shanks_reunion_smile.webp",
    "images/board/story/speakers/shanks_serious_calm.webp",
    "images/board/story/speakers/shanks_smile.webp",
    "images/board/story/speakers/shirahoshi_cry_smile.webp",
    "images/board/story/speakers/shirahoshi_prayer.webp",
    "images/board/story/speakers/shirahoshi_resolve.webp",
    "images/board/story/speakers/sommers_cold.webp",
    "images/board/story/speakers/sommers_shocked.webp",
    "images/board/story/speakers/usopp_brave.webp",
    "images/board/story/speakers/usopp_brave_sniper.webp",
    "images/board/story/speakers/usopp_panic.webp",
    "images/board/story/speakers/usopp_story.webp",
    "images/board/story/speakers/usopp_yasopp_conflicted.webp",
    "images/board/story/speakers/vegapunk_broadcast.webp",
    "images/board/story/speakers/vivi_lili_truth.webp",
    "images/board/story/speakers/vivi_royal_resolve.webp",
    "images/board/story/speakers/vivi_smile.webp",
    "images/board/story/speakers/yasopp_father_smile.webp",
    "images/board/story/speakers/yasopp_serious_test.webp",
    "images/board/story/speakers/york_explain.webp",
    "images/board/story/speakers/zeus_homie.webp",
    "images/board/story/speakers/zoro_banquet.webp",
    "images/board/story/speakers/zoro_calm.webp",
    "images/board/story/speakers/zoro_ready_calm.webp",
    "images/board/story/speakers/zoro_smirk.webp",
    "images/board/story/speakers/zunesha_voice.webp",
    "images/board/tavern_recruit/characters/blink_closed.webp",
    "images/board/tavern_recruit/characters/blink_half.webp",
    "images/board/tavern_recruit/characters/blink_wink.webp",
    "images/board/tavern_recruit/characters/tavern_owner_makino.webp",
    "images/board/tavern_recruit/effects/recruit_stamp_success.webp",
    "images/board/tavern_recruit/ui/recruit_notice_board.webp",
    "images/board/tavern_recruit/ui/wanted_paper_blank.webp",
    "images/board/tavern_ui/tavern_candidate_row_frame.webp",
    "images/board/tavern_ui/tavern_recruit_panel_frame.webp",
    "images/board/tavern_ui/tavern_recruit_result_panel_frame.webp",
    "images/board/tavern_ui/tavern_replacement_card_frame.webp",
    "images/board/trade_ui/trade_exchange_frame_v2.webp",
    "images/board/trade_ui/trade_prompt_frame_v2.webp",
    "images/board/training_ui/stat_icons/atk.webp",
    "images/board/training_ui/stat_icons/def.webp",
    "images/board/training_ui/stat_icons/hp.webp",
    "images/board/training_ui/stat_icons/satk.webp",
    "images/board/training_ui/stat_icons/sdef.webp",
    "images/board/training_ui/stat_icons/spd.webp",
    "images/board/training_ui/training_detail_panel_frame.webp",
    "images/board/training_ui/training_item_quantity_frame.webp",
    "images/board/training_ui/training_material_rules_frame.webp",
    "images/board/training_ui/training_stat_row_frame.webp",
    "images/board/ui/battle_status/battle_weapons_clash_02.webp",
    "images/board/ui/battle_status/battle_weapons_open_01.webp",
    "images/board/ui/battle_status/battle_weapons_reset_03.webp",
    "images/board/water_seven/paulie.webp",
    "images/board/water_seven/paulie_bust_01.webp",
    "images/board/water_seven/paulie_bust_02.webp",
    "images/board/water_seven/paulie_bust_03.webp",
    "images/board/water_seven/paulie_bust_04.webp",
    "images/board/water_seven/paulie_idle_01.webp",
    "images/board/water_seven/paulie_idle_02.webp",
    "images/board/water_seven/paulie_idle_03.webp",
    "images/board/water_seven/paulie_idle_04.webp",
    "images/board/water_seven/ship_01_angle_01_cutout.webp",
    "images/board/water_seven/ship_01_angle_02_cutout.webp",
    "images/board/water_seven/ship_01_angle_03_cutout.webp",
    "images/board/water_seven/ship_01_angle_05_cutout.webp",
    "images/board/water_seven/ship_01_angle_06_cutout.webp",
    "images/board/water_seven/ship_01_angle_08_cutout.webp",
    "images/board/water_seven/ship_02_angle_01_cutout.webp",
    "images/board/water_seven/ship_02_angle_02_cutout.webp",
    "images/board/water_seven/ship_02_angle_04_cutout.webp",
    "images/board/water_seven/ship_02_angle_06_cutout.webp",
    "images/board/water_seven/ship_02_angle_07_cutout.webp",
    "images/board/water_seven/ship_02_angle_09_cutout.webp",
    "images/board/water_seven/ship_03_deck_cutout.webp",
    "images/board/water_seven/ship_03_default_cutout.webp",
    "images/board/water_seven/ship_03_kitchen_cutout.webp",
    "images/board/water_seven/ship_03_rudder_cutout.webp",
    "images/board/water_seven/ship_03_sail_cutout.webp",
    "images/board/water_seven/ship_03_watchtower_cutout.webp",
    "images/board/water_seven/ship_04_angle_01_cutout.webp",
    "images/board/water_seven/ship_04_angle_02_cutout.webp",
    "images/board/water_seven/ship_04_angle_03_cutout.webp",
    "images/board/water_seven/ship_04_angle_04_cutout.webp",
    "images/board/water_seven/ship_04_angle_05_cutout.webp",
    "images/board/water_seven/ship_04_angle_06_cutout.webp",
    "images/board/water_seven/ship_05_angle_01_cutout.webp",
    "images/board/water_seven/ship_05_angle_02_cutout.webp",
    "images/board/water_seven/ship_05_angle_03_cutout.webp",
    "images/board/water_seven/ship_05_angle_04_cutout.webp",
    "images/board/water_seven/ship_05_angle_05_cutout.webp",
    "images/board/water_seven/ship_05_angle_06_cutout.webp",
    "images/board/water_seven/ship_06_angle_01_cutout.webp",
    "images/board/water_seven/ship_06_angle_02_cutout.webp",
    "images/board/water_seven/ship_06_angle_03_cutout.webp",
    "images/board/water_seven/ship_06_angle_04_cutout.webp",
    "images/board/water_seven/ship_06_angle_08_cutout.webp",
    "images/board/water_seven/ship_06_angle_10_cutout.webp",
    "images/board/water_seven_ui/water_seven_ship_equipment_slot_frame.webp",
    "images/board/water_seven_ui/water_seven_ship_part_marker_frame.webp",
    "images/board/water_seven_ui/water_seven_shipyard_upgrade_panel_frame.webp",
    "images/board/water_seven_ui/water_seven_slot_unlock_progress_row_frame.webp",
    "images/board/water_seven_ui/water_seven_upgrade_effect_row_frame.webp",
  ]);
  /* END GENERATED BOARD ALPHA SOURCES */
  const busyCombat = ".combat-card.portrait-attack, .combat-card.portrait-hit, " +
    ".combat-card.portrait-switch-in, .combat-card.portrait-ko, " +
    ".combat-card.yonko-phase-transform, .combat-card.nika-awakening-standby, " +
    ".combat-card.nika-awakening-heartbeat, .combat-card.black-turn-donor, " +
    ".combat-card.black-turn-receiver, .battle-fighter.attack, .battle-fighter.hit";
  let active = null;
  let queuedPointer = null;
  let pointerFrame = 0;
  let visibilityObserver = null;

  let planarFallbacks = {};
  function loadManifest() {
    if (!manifestPromise) {
      manifestPromise = fetch(new URL(depthRoot + "manifest.json", document.baseURI))
        .then((response) => {
          if (!response.ok) throw new Error("Board depth manifest unavailable");
          return response.json();
        })
        .then((data) => {
          if (data?.schema !== 1 || !data.assets || Array.isArray(data.assets) || typeof data.assets !== "object") return null;
          planarFallbacks = data.fallbacks || {};
          return data.assets;
        })
        .catch(() => null);
    }
    return manifestPromise;
  }

  function runDepthQueue() {
    while (activeDepthLoads < 2 && depthQueue.length) {
      const task = depthQueue.shift();
      activeDepthLoads += 1;
      Promise.resolve().then(task.run).then(task.resolve, task.reject).finally(() => {
        activeDepthLoads -= 1;
        runDepthQueue();
      });
    }
  }

  function enqueueDepthLoad(run) {
    return new Promise((resolve, reject) => {
      depthQueue.push({ run, resolve, reject });
      runDepthQueue();
    });
  }

  function imageSourceKey(image) {
    if (image.getAttribute("srcset")) return null;
    const source = image.getAttribute("src");
    if (!source) return null;
    try {
      const url = new URL(source, document.baseURI);
      if (!/^https?:$/.test(url.protocol) || url.origin !== location.origin) return null;
      if (image.currentSrc && new URL(image.currentSrc, document.baseURI).href !== url.href) return null;
      return decodeURIComponent(url.pathname).replace(/^\/+/, "");
    } catch (_) {
      return null;
    }
  }

  function sourceStamp(image) {
    return [image.getAttribute("src") || "", image.currentSrc || "",
      image.getAttribute("srcset") || "", image.getAttribute("sizes") || ""].join("\n");
  }

  function assetUrl(path) {
    if (typeof path !== "string" || !path.startsWith(depthRoot) ||
        !/^[a-zA-Z0-9_./-]+$/.test(path) || path.includes("..")) return null;
    const url = new URL(path, document.baseURI);
    return url.origin === location.origin ? url.href : null;
  }

  function decodeImage(url) {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    return image.decode().then(() => image);
  }

  function releaseDepth(state) {
    if (active === state.surface) reset(state.surface);
    state.generation += 1;
    state.pendingStamp = null;
    animatedStates.delete(state);
    if (!animatedStates.size && animatedFrame) {
      cancelAnimationFrame(animatedFrame);
      animatedFrame = 0;
    }
    if (state.resizeObserver) {
      state.resizeObserver.disconnect();
      state.resizeObserver = null;
    }
    state.combatObserver?.disconnect();
    state.combatObserver = null;
    state.depth?.layer?.remove();
    state.depth?.backplate?.remove();
    state.depth?.host?.classList.remove("board-character-depth-model-container");
    if (state.depth?.ownsHostPosition) state.depth.host.classList.remove("board-character-depth-model-host");
    state.depth = null;
    state.surface.removeAttribute("data-board-depth-ready");
    state.surface.classList.remove("board-character-depth-motion-static");
    state.image.classList.remove("board-character-depth-model-image",
      "board-character-depth-model-positioned", "board-character-depth-alpha-image",
      "board-character-depth-alpha-inline");
    state.image.style.removeProperty("--board-character-depth-mask-url");
    state.image.style.removeProperty("--board-character-depth-mask-fit");
    state.image.style.removeProperty("--board-character-depth-mask-position");
  }

  function modelGeometry(state) {
    const { surface, image } = state;
    const host = surface === image ? image.parentElement : surface;
    if (!host || host === document.body || !host.isConnected ||
        image.offsetWidth < 8 || image.offsetHeight < 8) return null;
    const hostIsStatic = getComputedStyle(host).position === "static";
    const pureHost = Array.from(host.children).every((child) =>
      child === image || child.classList.contains("board-character-depth-light"));
    if ((hostIsStatic && !pureHost) ||
        (!hostIsStatic && image.offsetParent !== host)) return null;
    const imageStyle = getComputedStyle(image);
    const imageZ = imageStyle.zIndex === "auto" ? null : Number(imageStyle.zIndex);
    if ((imageZ !== null && (!Number.isInteger(imageZ) || imageZ < 0)) ||
        imageStyle.display === "none" || imageStyle.visibility !== "visible") return null;
    return {
      host, imageZ, ownsHostPosition: hostIsStatic,
      ownsImagePosition: imageStyle.position === "static",
      fit: imageStyle.objectFit, position: imageStyle.objectPosition
    };
  }

  function motionSnapshot(image) {
    const style = getComputedStyle(image);
    return {
      transform: style.transform === "none" ? "none" : style.transform,
      transformOrigin: style.transformOrigin,
      translate: style.translate,
      filter: style.filter,
      animation: style.animation,
      animationName: style.animationName,
      display: style.display
    };
  }

  function syncLayerBaseTransform(state, snapshot) {
    if (!state.depth) return;
    const style = snapshot || motionSnapshot(state.image);
    const layerStyle = state.depth.layer.style;
    if (layerStyle.transform !== style.transform) layerStyle.transform = style.transform;
    if (layerStyle.transformOrigin !== style.transformOrigin) layerStyle.transformOrigin = style.transformOrigin;
    if (layerStyle.translate !== style.translate) layerStyle.translate = style.translate;
    if (state.depth.backplate) {
      const backplateStyle = state.depth.backplate.style;
      if (backplateStyle.transform !== style.transform) backplateStyle.transform = style.transform;
      if (backplateStyle.transformOrigin !== style.transformOrigin) backplateStyle.transformOrigin = style.transformOrigin;
      if (backplateStyle.translate !== style.translate) backplateStyle.translate = style.translate;
    }
    if (state.depth.subject && state.depth.subject.style.filter !== style.filter) {
      state.depth.subject.style.filter = style.filter;
    }
  }

  function flushAnimatedModels() {
    animatedFrame = 0;
    // Read every computed transform before changing any layer style. Interleaved
    // read/write cycles forced a style recalculation for each visible portrait.
    const updates = [];
    for (const state of animatedStates) {
      if (!state.depth || state.depth.kind !== "model" || !state.inViewport ||
          document.hidden || !state.image.isConnected || state.image.closest(busyCombat)) {
        animatedStates.delete(state);
        continue;
      }
      const snapshot = motionSnapshot(state.image);
      if (snapshot.animationName === "none" || snapshot.display === "none") {
        animatedStates.delete(state);
        continue;
      }
      // CSS animations may still be pending on the attachment frame. As soon
      // as the original gains a document-timeline startTime, transfer it and
      // leave this fallback loop instead of polling for the entire idle.
      if (syncCompositorIdle(state, snapshot)) {
        animatedStates.delete(state);
        continue;
      }
      updates.push([state, snapshot]);
    }
    for (const [state, snapshot] of updates) syncLayerBaseTransform(state, snapshot);
    if (animatedStates.size) animatedFrame = requestAnimationFrame(flushAnimatedModels);
  }

  function syncCompositorIdle(state, snapshot) {
    // The two existing combat idles animate only the independent `translate`
    // property. Reuse their CSS keyframes and document-timeline start time so
    // the original image and both model layers stay pixel aligned without a
    // main-thread computed-style read on every frame.
    if (typeof CSSAnimation !== "function" ||
        (snapshot.animationName !== "portraitIdle" && snapshot.animationName !== "battleIdle")) return false;
    const source = state.image.getAnimations().find(animation =>
      animation instanceof CSSAnimation && animation.animationName === snapshot.animationName &&
      animation.startTime !== null);
    if (!source) return false;
    for (const target of [state.depth.layer, state.depth.backplate]) {
      if (!target) continue;
      if (target.style.animation !== snapshot.animation) target.style.animation = snapshot.animation;
      const copy = target.getAnimations().find(animation =>
        animation instanceof CSSAnimation && animation.animationName === snapshot.animationName);
      if (!copy) return false;
      if (copy.playbackRate !== source.playbackRate) copy.updatePlaybackRate(source.playbackRate);
      if (copy.startTime !== source.startTime) copy.startTime = source.startTime;
      if (source.playState === "paused" && copy.playState !== "paused") copy.pause();
      else if (source.playState === "running" && copy.playState === "paused") copy.play();
    }
    return true;
  }

  function startAnimatedModelSync(state) {
    if (!state.depth || state.depth.kind !== "model" || !state.inViewport ||
        document.hidden || !state.image.isConnected || state.image.closest(busyCombat)) return;
    const snapshot = motionSnapshot(state.image);
    if (snapshot.animationName === "none" || snapshot.display === "none") return;
    syncLayerBaseTransform(state, snapshot);
    if (syncCompositorIdle(state, snapshot)) {
      animatedStates.delete(state);
      if (!animatedStates.size && animatedFrame) {
        cancelAnimationFrame(animatedFrame);
        animatedFrame = 0;
      }
      return;
    }
    animatedStates.add(state);
    if (!animatedFrame) animatedFrame = requestAnimationFrame(flushAnimatedModels);
  }

  function setLayerGeometry(state) {
    if (!state.depth) return;
    const { image, layer } = { image: state.image, layer: state.depth.layer };
    if (!image.isConnected || image.offsetParent !== state.depth.host) {
      releaseDepth(state);
      return;
    }
    layer.style.left = image.offsetLeft + "px";
    layer.style.top = image.offsetTop + "px";
    layer.style.width = image.offsetWidth + "px";
    layer.style.height = image.offsetHeight + "px";
    if (state.depth.backplate) {
      state.depth.backplate.style.left = layer.style.left;
      state.depth.backplate.style.top = layer.style.top;
      state.depth.backplate.style.width = layer.style.width;
      state.depth.backplate.style.height = layer.style.height;
    }
    // Card's 900px camera is for a ~230px face. Preserve its relative depth
    // when an existing Board portrait viewport is much larger.
    layer.style.setProperty("--board-character-depth-face-perspective",
      Math.max(900, image.offsetWidth * 4).toFixed(0) + "px");
    syncLayerBaseTransform(state);
  }

  function attachDepth(state, entry, background, mask, subject, urls, stamp) {
    if (state.generation !== entry.generation || sourceStamp(state.image) !== stamp ||
        !state.inViewport || !state.image.isConnected || document.hidden) return;
    const geometry = modelGeometry(state);
    if (!geometry) return;
    const image = state.image;
    const layer = document.createElement("span");
    layer.className = "board-character-depth-model-layer";
    layer.setAttribute("aria-hidden", "true");
    const backplate = document.createElement("span");
    backplate.className = "board-character-depth-model-backplate";
    backplate.setAttribute("aria-hidden", "true");
    const face = document.createElement("span");
    face.className = "board-character-depth-model-face";
    if (geometry.ownsHostPosition) geometry.host.classList.add("board-character-depth-model-host");
    if (geometry.ownsImagePosition) image.classList.add("board-character-depth-model-positioned");
    if (image.offsetParent !== geometry.host) {
      geometry.host.classList.remove("board-character-depth-model-host");
      image.classList.remove("board-character-depth-model-positioned");
      return;
    }
    if (geometry.imageZ !== null && !geometry.host.matches(".battle-portrait-stage")) {
      layer.style.zIndex = String(Math.max(0, geometry.imageZ - 1));
      backplate.style.zIndex = String(Math.max(0, geometry.imageZ - 2));
    }
    background.className = "board-character-depth-model-background";
    background.alt = "";
    background.draggable = false;
    background.style.objectFit = geometry.fit;
    background.style.objectPosition = geometry.position;
    subject.className = "board-character-depth-model-subject";
    subject.alt = "";
    subject.draggable = false;
    subject.style.objectFit = geometry.fit;
    subject.style.objectPosition = geometry.position;
    subject.style.setProperty("--board-character-depth-mask-url", 'url("' + urls.mask + '")');
    subject.style.setProperty("--board-character-depth-mask-fit",
      geometry.fit === "cover" || geometry.fit === "contain" ? geometry.fit : "100% 100%");
    subject.style.setProperty("--board-character-depth-mask-position", geometry.position);
    backplate.appendChild(background);
    face.appendChild(subject);
    layer.appendChild(face);
    geometry.host.classList.add("board-character-depth-model-container");
    geometry.host.insertBefore(backplate, geometry.host.firstChild);
    geometry.host.insertBefore(layer, backplate.nextSibling);
    state.depth = { layer, backplate, face, host: geometry.host, entry: entry.asset, subject,
      ownsHostPosition: geometry.ownsHostPosition, kind: "model" };
    if (entry.asset.motionSafe === false) {
      state.surface.classList.add("board-character-depth-motion-static");
      layer.classList.add("board-character-depth-motion-static");
      reset(state.surface);
    }
    setLayerGeometry(state);
    image.classList.add("board-character-depth-model-image");
    state.surface.setAttribute("data-board-depth-ready", "");
    if (typeof ResizeObserver === "function") {
      state.resizeObserver = new ResizeObserver(() => setLayerGeometry(state));
      state.resizeObserver.observe(image);
      state.resizeObserver.observe(geometry.host);
    }
    const combatHost = image.closest(".combat-card, .battle-fighter");
    if (combatHost) {
      state.combatObserver = new MutationObserver(() => {
        syncLayerBaseTransform(state);
        startAnimatedModelSync(state);
      });
      state.combatObserver.observe(combatHost, { attributes: true, attributeFilter: ["class", "style"] });
    }
    startAnimatedModelSync(state);
  }

  function imageHasAlpha(image, key) {
    // The launcher redirects old images to R2; its original img is not
    // CORS-enabled and canvas inspection may be tainted after that redirect.
    if (knownTransparentSources.has(key)) return true;
    if (alphaSources.has(key)) return alphaSources.get(key);
    let transparent = false;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0, 32, 32);
      const bytes = context.getImageData(0, 0, 32, 32).data;
      for (let index = 3; index < bytes.length; index += 4) {
        if (bytes[index] < 248) {
          transparent = true;
          break;
        }
      }
    } catch (_) {
      // Cross-origin or unsupported canvas: keep the unmodified original.
    }
    alphaSources.set(key, transparent);
    return transparent;
  }

  function attachAlphaDepth(state, key, stamp, generation) {
    const image = state.image;
    if (state.generation !== generation || sourceStamp(image) !== stamp ||
        !state.inViewport || !image.isConnected || document.hidden ||
        !imageHasAlpha(image, key)) return;
    const geometry = modelGeometry(state);
    if (!geometry) {
      // Direct avatars in complex static containers can retain their layout.
      if (getComputedStyle(image).filter !== "none") return;
      image.classList.add("board-character-depth-alpha-inline");
      state.depth = { layer: null, host: image.parentElement,
        entry: { sourceKey: key, edgeTouch: {} }, kind: "alpha-inline" };
      state.surface.setAttribute("data-board-depth-ready", "alpha");
      return;
    }
    const layer = document.createElement("span");
    layer.className = "board-character-depth-alpha-layer";
    layer.setAttribute("aria-hidden", "true");
    if (geometry.ownsHostPosition) geometry.host.classList.add("board-character-depth-model-host");
    if (geometry.ownsImagePosition) image.classList.add("board-character-depth-model-positioned");
    if (image.offsetParent !== geometry.host) {
      geometry.host.classList.remove("board-character-depth-model-host");
      image.classList.remove("board-character-depth-model-positioned");
      return;
    }
    if (geometry.imageZ !== null && !geometry.host.matches(".battle-portrait-stage")) {
      layer.style.zIndex = String(Math.max(0, geometry.imageZ - 1));
    }
    const shadow = document.createElement("img");
    shadow.className = "board-character-depth-alpha-shadow";
    shadow.alt = "";
    shadow.draggable = false;
    shadow.setAttribute("aria-hidden", "true");
    shadow.style.objectFit = geometry.fit;
    shadow.style.objectPosition = geometry.position;
    shadow.src = image.currentSrc || image.src;
    layer.appendChild(shadow);
    geometry.host.insertBefore(layer, geometry.host.firstChild);
    state.depth = { layer, host: geometry.host, entry: { sourceKey: key, edgeTouch: {} },
      ownsHostPosition: geometry.ownsHostPosition, kind: "alpha" };
    setLayerGeometry(state);
    image.classList.add("board-character-depth-alpha-image");
    state.surface.setAttribute("data-board-depth-ready", "alpha");
    if (typeof ResizeObserver === "function") {
      state.resizeObserver = new ResizeObserver(() => setLayerGeometry(state));
      state.resizeObserver.observe(image);
      state.resizeObserver.observe(geometry.host);
    }
    const combatHost = image.closest(".combat-card, .battle-fighter");
    if (combatHost) {
      state.combatObserver = new MutationObserver(() => syncLayerBaseTransform(state));
      state.combatObserver.observe(combatHost, { attributes: true, attributeFilter: ["class", "style"] });
    }
  }

  function maybeDepth(state) {
    const image = state.image;
    if (document.hidden || !state.inViewport || !image.isConnected ||
        image.hidden || image.classList.contains("is-empty") ||
        !image.complete || !image.naturalWidth || !image.naturalHeight ||
        !image.getClientRects().length) return;
    const key = imageSourceKey(image);
    if (!key || state.failedSources.has(key)) return;
    const stamp = sourceStamp(image);
    if (state.depth?.entry?.sourceKey === key || state.pendingStamp === stamp) return;
    const generation = state.generation;
    state.pendingStamp = stamp;
    loadManifest().then((assets) => {
      if (state.generation !== generation || sourceStamp(image) !== stamp) return;
      if (planarFallbacks[key]?.mode === "planar" && state.inViewport && image.isConnected) {
        // A rejected mask never reaches the renderer. Preserve the complete original.
        state.depth = { layer: null, host: image.parentElement,
          entry: { sourceKey: key, edgeTouch: {} }, kind: "planar" };
        state.surface.setAttribute("data-board-depth-ready", "planar");
        return;
      }
      const asset = assets?.[key];
      if (!maskSupported || !asset || asset.visualReview !== "approved" ||
          !Array.isArray(asset.size) || asset.size[0] !== image.naturalWidth ||
          asset.size[1] !== image.naturalHeight) {
        attachAlphaDepth(state, key, stamp, generation);
        return;
      }
      const backgroundUrl = assetUrl(asset.background);
      const maskUrl = assetUrl(asset.mask);
      if (!backgroundUrl || !maskUrl) return;
      return enqueueDepthLoad(async () => {
        const [background, mask, subject] = await Promise.all([
          decodeImage(backgroundUrl), decodeImage(maskUrl),
          decodeImage(image.currentSrc || image.src)
        ]);
        if (background.naturalWidth !== asset.size[0] ||
            background.naturalHeight !== asset.size[1] ||
            mask.naturalWidth !== asset.size[0] ||
            mask.naturalHeight !== asset.size[1] ||
            subject.naturalWidth !== asset.size[0] ||
            subject.naturalHeight !== asset.size[1]) throw new Error("Board depth dimensions mismatch");
        return { background, mask, subject };
      }).then((decoded) => {
        if (!decoded) return;
        attachDepth(state, { asset: { ...asset, sourceKey: key }, generation },
          decoded.background, decoded.mask, decoded.subject, { mask: maskUrl }, stamp);
      }).catch(() => {
        state.failedSources.add(key);
      });
    }).finally(() => {
      if (state.pendingStamp === stamp) state.pendingStamp = null;
    });
  }

  function imageFor(surface, spec) {
    const image = spec.image
      ? Array.from(surface.querySelectorAll(spec.image)).find((candidate) =>
        !candidate.closest(".board-character-depth-alpha-layer, .board-character-depth-model-layer"))
      : surface;
    return image instanceof HTMLImageElement ? image : null;
  }

  function cleanupState(state) {
    state.disposed = true;
    releaseDepth(state);
    state.sourceObserver?.disconnect();
    state.resizeObserver?.disconnect();
    state.image.removeEventListener("load", state.onImageLoad);
    state.image.removeEventListener("error", state.onImageLoad);
    state.image.classList.remove("board-character-depth-image");
    visibilityObserver?.unobserve(state.surface);
    allStates.delete(state);
    decorated.delete(state.surface);
    if (active === state.surface) reset(active);
  }

  function decorate(surface) {
    if (!(surface instanceof Element)) return;
    const spec = registry.find((item) => surface.matches(item.surface));
    if (!spec) return;
    const image = imageFor(surface, spec);
    if (!image) {
      const previous = decorated.get(surface);
      if (previous) cleanupState(previous);
      return;
    }

    const previous = decorated.get(surface);
    if (previous?.image === image &&
        (!previous.overlayExpected || previous.light?.parentElement === surface)) return;
    if (previous) cleanupState(previous);
    surface.classList.add("board-character-depth-surface");
    surface.dataset.boardCharacterDepth = "";
    image.classList.add("board-character-depth-image");
    if (surface === image && surface.parentElement && surface.parentElement !== document.body) {
      surface.parentElement.classList.add("board-character-depth-projection");
    }

    // A light child is safe only in an already positioned art viewport.
    const overlayExpected = spec.light && surface !== image && getComputedStyle(surface).position !== "static";
    let light = null;
    if (overlayExpected) {
      light = Array.from(surface.children).find((child) => child.classList.contains("board-character-depth-light"));
      if (!light) {
        light = document.createElement("span");
        light.className = "board-character-depth-light";
        light.setAttribute("aria-hidden", "true");
        surface.appendChild(light);
      }
    }
    const state = {
      surface, image, light, overlayExpected, generation: 0, pendingStamp: null,
      stamp: sourceStamp(image), depth: null, resizeObserver: null,
      inViewport: !visibilityObserver, failedSources: new Set(), disposed: false,
      sourceObserver: null, onImageLoad: null
    };
    state.onImageLoad = () => {
      if (state.disposed) return;
      const stamp = sourceStamp(image);
      if (stamp !== state.stamp || image.classList.contains("is-empty")) releaseDepth(state);
      state.stamp = stamp;
      if (state.depth?.layer) syncLayerBaseTransform(state);
      maybeDepth(state);
    };
    state.sourceObserver = new MutationObserver(state.onImageLoad);
    state.sourceObserver.observe(image, {
      attributes: true, attributeFilter: ["src", "srcset", "sizes", "class", "hidden", "style"]
    });
    image.addEventListener("load", state.onImageLoad);
    image.addEventListener("error", state.onImageLoad);
    decorated.set(surface, state);
    allStates.add(state);
    visibilityObserver?.observe(surface);
    if (state.inViewport) maybeDepth(state);
  }

  function decorateTree(root) {
    if (!(root instanceof Element)) return;
    if (root.matches(allSurfaces)) decorate(root);
    root.querySelectorAll(allSurfaces).forEach(decorate);
  }

  function cleanupTree(root) {
    if (!(root instanceof Element)) return;
    if (decorated.has(root)) cleanupState(decorated.get(root));
    root.querySelectorAll(allSurfaces).forEach((node) => {
      const state = decorated.get(node);
      if (state) cleanupState(state);
    });
  }

  function reset(surface) {
    if (!surface) return;
    surface.style.removeProperty("--board-character-depth-axis");
    surface.style.removeProperty("--board-character-depth-angle");
    surface.style.removeProperty("--board-character-depth-pitch");
    surface.style.removeProperty("--board-character-depth-yaw");
    surface.style.removeProperty("--board-character-depth-light-x");
    surface.style.removeProperty("--board-character-depth-light-y");
    surface.style.removeProperty("--board-character-depth-light-opacity");
    const target = decorated.get(surface)?.depth?.layer || decorated.get(surface)?.image;
    target?.style.removeProperty("--board-character-depth-bg-x");
    target?.style.removeProperty("--board-character-depth-bg-y");
    target?.style.removeProperty("--board-character-depth-subject-x");
    target?.style.removeProperty("--board-character-depth-subject-y");
    if (target !== surface) {
      target?.style.removeProperty("--board-character-depth-axis");
      target?.style.removeProperty("--board-character-depth-angle");
      target?.style.removeProperty("--board-character-depth-pitch");
      target?.style.removeProperty("--board-character-depth-yaw");
    }
    if (active === surface) active = null;
  }

  function pointerAllowed(event) {
    return event.pointerType === "mouse" && finePointer.matches && !reducedMotion.matches;
  }

  function updatePointer(event) {
    pointerFrame = 0;
    let surface = event.target instanceof Element
      ? event.target.closest("[data-board-character-depth]")
      : null;
    // Judge's visible clone is pointer-transparent and sits over the already
    // decorated enemy portrait. Prefer the clone only within its live bounds;
    // this changes visual selection, not the browser's hit target or game input.
    if (page === "board_battle.html") {
      let topClone = null;
      let topZ = -Infinity;
      for (const candidate of allStates) {
        if (!candidate.image.isConnected || !candidate.inViewport ||
            !candidate.surface.matches(".judge-clone-guard") ||
            candidate.depth?.kind !== "alpha") continue;
        const layer = candidate.image.closest(".judge-clone-guard-layer");
        if (!layer || layer.hidden || getComputedStyle(layer).display === "none") continue;
        const style = getComputedStyle(candidate.image);
        if (style.pointerEvents !== "none" || style.visibility === "hidden") continue;
        const bounds = candidate.image.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) continue;
        const z = Number.parseInt(style.zIndex, 10) || 0;
        if (z >= topZ) { topClone = candidate.surface; topZ = z; }
      }
      if (topClone) surface = topClone;
    }
    if (!surface) {
      // Dialogue portraits sometimes have pointer-events:none; use their own bounds.
      for (const candidate of allStates) {
        if (!candidate.depth || candidate.depth.kind !== "alpha" ||
            !candidate.inViewport || getComputedStyle(candidate.image).pointerEvents !== "none") continue;
        const bounds = candidate.image.getBoundingClientRect();
        if (event.clientX >= bounds.left && event.clientX <= bounds.right &&
            event.clientY >= bounds.top && event.clientY <= bounds.bottom) {
          surface = candidate.surface;
          break;
        }
      }
    }
    const state = surface ? decorated.get(surface) : null;
    const image = state?.image;
    if (!surface || !image || !state.depth || state.depth.entry.motionSafe === false ||
        !pointerAllowed(event) || !image.isConnected ||
        image.hidden || image.classList.contains("is-empty") ||
        !image.getAttribute("src") || image.closest(busyCombat)) {
      reset(active);
      return;
    }
    if (active !== surface) reset(active);
    active = surface;
    const rect = surface.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    const dx = (x - .5) * 2;
    const dy = (y - .5) * 2;
    const distance = Math.hypot(dx, dy);
    const angle = (Math.min(rect.width, rect.height) < 180 ? 8 : 12) *
      Math.sin(Math.min(distance, 1) * Math.PI / 2);
    const axisX = distance ? -dy / distance : 0;
    const axisY = distance ? dx / distance : 1;
    const pitch = distance ? -dy * angle / distance : 0;
    const yaw = distance ? dx * angle / distance : 0;
    surface.style.setProperty("--board-character-depth-axis", `${axisX.toFixed(3)} ${axisY.toFixed(3)} 0`);
    surface.style.setProperty("--board-character-depth-angle", `${angle.toFixed(2)}deg`);
    surface.style.setProperty("--board-character-depth-light-x", `${(24 + 52 * x).toFixed(1)}%`);
    surface.style.setProperty("--board-character-depth-light-y", `${(18 + 64 * y).toFixed(1)}%`);
    surface.style.setProperty("--board-character-depth-light-opacity", ".28");
    const target = state.depth.layer || state.image;
    if (state.depth.kind === "model") {
      target.style.setProperty("--board-character-depth-axis", `${axisX.toFixed(3)} ${axisY.toFixed(3)} 0`);
      target.style.setProperty("--board-character-depth-angle", `${angle.toFixed(2)}deg`);
      target.style.setProperty("--board-character-depth-pitch", `${pitch.toFixed(2)}deg`);
      target.style.setProperty("--board-character-depth-yaw", `${yaw.toFixed(2)}deg`);
      // Match Card finish: the inpainted background stays fixed while the
      // model-cut subject moves within the original clipped portrait frame.
      target.style.setProperty("--board-character-depth-subject-x",
        (dx * rect.width * .008).toFixed(2) + "px");
      target.style.setProperty("--board-character-depth-subject-y",
        (dy * rect.width * .0048).toFixed(2) + "px");
    } else {
      const shift = Math.min(rect.width, rect.height) * .008;
      target.style.setProperty("--board-character-depth-bg-x", (-dx * shift).toFixed(2) + "px");
      target.style.setProperty("--board-character-depth-bg-y", (-dy * shift).toFixed(2) + "px");
    }
  }

  function init() {
    if (typeof IntersectionObserver === "function") {
      visibilityObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const state = decorated.get(entry.target);
          if (!state || state.disposed) continue;
          state.inViewport = entry.isIntersecting;
          if (state.inViewport) maybeDepth(state);
          else releaseDepth(state);
        }
      }, { rootMargin: "100px" });
    }
    decorateTree(document.body);
    const pending = new Set();
    let pendingFrame = 0;
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.target instanceof Element && record.target.matches(allSurfaces)) pending.add(record.target);
        for (const node of record.addedNodes) {
          if (node instanceof Element &&
              !node.classList.contains("board-character-depth-light") &&
              !node.classList.contains("board-character-depth-alpha-layer") &&
              !node.classList.contains("board-character-depth-model-layer")) pending.add(node);
        }
        for (const node of record.removedNodes) {
          if (node instanceof Element) cleanupTree(node);
        }
      }
      if (pendingFrame) return;
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = 0;
        for (const node of pending) if (node.isConnected) decorateTree(node);
        pending.clear();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("pointermove", (event) => {
      queuedPointer = event;
      if (!pointerFrame) {
        pointerFrame = requestAnimationFrame(() => {
          const latest = queuedPointer;
          queuedPointer = null;
          if (latest) updatePointer(latest);
        });
      }
    }, { passive: true });
    document.addEventListener("pointerout", (event) => {
      if (active && event.target instanceof Node && active.contains(event.target) &&
          !(event.relatedTarget instanceof Node && active.contains(event.relatedTarget))) reset(active);
    }, { passive: true });
    window.addEventListener("blur", () => reset(active));
    window.addEventListener("scroll", () => reset(active), { passive: true });
    const onMediaChange = () => {
      reset(active);
      for (const state of allStates) {
        releaseDepth(state);
        maybeDepth(state);
      }
    };
    finePointer.addEventListener?.("change", onMediaChange);
    reducedMotion.addEventListener?.("change", onMediaChange);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        reset(active);
        for (const state of allStates) releaseDepth(state);
      } else {
        for (const state of allStates) maybeDepth(state);
      }
    });
    window.addEventListener("resize", () => {
      for (const state of allStates) if (state.depth && !state.resizeObserver) setLayerGeometry(state);
    }, { passive: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();

/* Battle frame: fixed dimensions: stationary bevel, Card-directional light. */
(() => {
  'use strict';
  if (location.pathname.split('/').pop().toLowerCase() !== 'board_battle.html') return;
  const selector = '.combat-card:has(.battle-portrait[src])';
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const busy = '.portrait-attack, .portrait-hit, .portrait-switch-in, .portrait-ko, ' +
    '.yonko-phase-transform, .nika-awakening-standby, .nika-awakening-heartbeat, ' +
    '.black-turn-donor, .black-turn-receiver';
  let active = null, frame = 0, queued = null;
  const reset = host => {
    if (!host) return;
    host.classList.remove('board-frame-inset-engaged');
    host.style.setProperty('--board-inset-light-x', '50%');
    host.style.setProperty('--board-inset-light-y', '32%');
    host.style.setProperty('--board-inset-light-strength', '.5');
  };
  const attach = root => {
    if (!(root instanceof Element || root instanceof Document)) return;
    const cards = [];
    if (root instanceof Element && root.matches(selector)) cards.push(root);
    root.querySelectorAll(selector).forEach(card => cards.push(card));
    for (const card of cards) {
      if (card.classList.contains('board-frame-inset-host')) continue;
      card.classList.add('board-frame-inset-host');
      for (const cls of ['board-frame-inset-edge', 'board-frame-inset-rail']) {
        const span = document.createElement('span');
        span.className = cls;
        span.setAttribute('aria-hidden', 'true');
        card.appendChild(span);
      }
    }
  };
  const update = () => {
    frame = 0;
    if (!queued || reduced.matches) return;
    const {host, x, y} = queued;
    queued = null;
    if (!host.isConnected || host.matches(busy)) return;
    host.style.setProperty('--board-inset-light-x', `${(24 + 52 * x).toFixed(1)}%`);
    host.style.setProperty('--board-inset-light-y', `${(18 + 64 * y).toFixed(1)}%`);
    host.style.setProperty('--board-inset-light-strength', '1');
    host.classList.add('board-frame-inset-engaged');
  };
  const start = () => {
    attach(document);
    document.addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse' || !fine.matches || reduced.matches) return;
      const host = event.target instanceof Element ? event.target.closest('.board-frame-inset-host') : null;
      if (host !== active) { reset(active); active = host; }
      if (!host || host.matches(busy)) return;
      const surface = host.querySelector('[data-board-character-depth]') || host;
      const rect = surface.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      queued = {host,
        x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),
        y:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))};
      if (!frame) frame = requestAnimationFrame(update);
    }, {passive:true});
    document.addEventListener('pointerout', event => {
      if (active && event.target instanceof Node && active.contains(event.target) &&
          !(event.relatedTarget instanceof Node && active.contains(event.relatedTarget))) {
        reset(active);active=null;
      }
    }, {passive:true});
    document.addEventListener('pointercancel',()=>{reset(active);active=null},{passive:true});
    window.addEventListener('blur',()=>{reset(active);active=null});
    const pending = new Set();let scan=0;
    new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'attributes') {pending.add(record.target.parentElement || document.body);continue;}
        for (const node of record.addedNodes) {
          if (node instanceof Element && !node.classList.contains('board-frame-inset-edge') &&
              !node.classList.contains('board-frame-inset-rail')) pending.add(node);
        }
      }
      if (!pending.size || scan) return;
      scan=requestAnimationFrame(()=>{scan=0;for(const root of pending)attach(root);pending.clear()});
    }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
