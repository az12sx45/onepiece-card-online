(function () {
  const configs = {
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
        aura: { asset: "images/board/battle/cosmetic_frames/zoro_new_world/aura.webp", x: 50, y: 38.5, w: 148, h: 132.5, opacity: 1, strength: 2.3, z: 13, blend: "normal" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/zoro_new_world/left_part.webp", x: 157.5, y: 45, w: 124, h: 114, opacity: 1, strength: 1.5, z: 11, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/zoro_new_world/right_part.webp", x: -60, y: 45, w: 124, h: 114, opacity: 1, strength: 1.8, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/zoro_new_world/frame.webp", x: 50, y: 50, w: 132, h: 122, flipY: true, opacity: 1, strength: 1, z: 12, blend: "normal" },
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
        aura: { asset: "images/board/battle/cosmetic_frames/impel_down_magellan/aura.webp", x: 50, y: 50, w: 97, h: 112, opacity: 0.55, strength: 1, z: 6, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/impel_down_magellan/left_part.webp", x: 146, y: 50, w: 126, h: 132, opacity: 1, strength: 0.95, z: 11, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/impel_down_magellan/right_part.webp", x: -51, y: 52, w: 126, h: 132, opacity: 1, strength: 1, z: 13, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/impel_down_magellan/frame.webp", x: 50, y: 50, w: 105, h: 108.5, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    yonkoBlackbeard: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/yonko_blackbeard/aura.webp", x: 50, y: 50, w: 102.5, h: 128, opacity: 1, strength: 1.4, z: 7, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/yonko_blackbeard/left_part.webp", x: 160.5, y: 52, w: 126, h: 134, opacity: 1, strength: 1, z: 8, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/yonko_blackbeard/right_part.webp", x: -57, y: 52, w: 126, h: 134, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/yonko_blackbeard/frame.webp", x: 50, y: 50, w: 113, h: 111, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    yonkoBigMom: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/yonko_bigmom/aura.webp", x: 50, y: 50, w: 126, h: 118, opacity: 0.2, strength: 0.65, z: 8, blend: "normal" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/yonko_bigmom/left_part.webp", x: 25, y: 52, w: 124, h: 132, opacity: 1, strength: 1, z: 10, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/yonko_bigmom/right_part.webp", x: 125, y: 53.5, w: 126, h: 124.5, flipX: true, opacity: 1, strength: 1, z: 4, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/yonko_bigmom/frame.webp", x: 50, y: 48.5, w: 105.5, h: 106, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    yonkoKaido: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/yonko_kaido/aura.webp", x: 50, y: 50, w: 130, h: 124, opacity: 1, strength: 2, z: 6, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/yonko_kaido/left_part.webp", x: 163.5, y: 63, w: 126, h: 136, opacity: 1, strength: 1, z: 10, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/yonko_kaido/right_part.webp", x: 34, y: 52, w: 128, h: 136, rotate: -32, flipX: true, opacity: 1, strength: 1, z: 9, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/yonko_kaido/frame.webp", x: 50, y: 50, w: 110.5, h: 116.5, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    yonkoShanks: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/yonko_shanks/aura.webp", x: 50, y: 45, w: 97, h: 108.5, opacity: 1, strength: 2.5, z: 10, blend: "multiply" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/yonko_shanks/left_part.webp", x: 40, y: 52, w: 124, h: 136, opacity: 1, strength: 1, z: 13, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/yonko_shanks/right_part.webp", x: 147.5, y: 56.5, w: 100, h: 127, flipX: true, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/yonko_shanks/frame.webp", x: 50, y: 50, w: 113, h: 112.5, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    luffyGearFourth: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/luffy_gear_fourth/aura.webp", x: 50, y: 50, w: 118, h: 116, opacity: 0.5, strength: 1.45, z: 8, blend: "normal" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/luffy_gear_fourth/left_part.webp", x: 151.5, y: 52, w: 124, h: 132, opacity: 1, strength: 1, z: 11, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/luffy_gear_fourth/right_part.webp", x: -48.5, y: 52, w: 124, h: 132, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/luffy_gear_fourth/frame.webp", x: 50, y: 50, w: 140, h: 132.5, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    usoppNewWorld: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/usopp_new_world/aura.webp", x: 50, y: 50, w: 118, h: 95, opacity: 0.72, strength: 1, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/usopp_new_world/left_part.webp", x: 160.5, y: 52, w: 124, h: 132, opacity: 1, strength: 1, z: 11, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/usopp_new_world/right_part.webp", x: -51, y: 52, w: 124, h: 132.5, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/usopp_new_world/frame.webp", x: 50, y: 50, w: 126.5, h: 127, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    chopperNewWorld: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/chopper_new_world/aura.webp", x: 50, y: 50, w: 116, h: 112, opacity: 0.76, strength: 1, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/chopper_new_world/left_part.webp", x: 154.5, y: 52, w: 120, h: 128, opacity: 1, strength: 1, z: 11, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/chopper_new_world/right_part.webp", x: -57, y: 52, w: 120, h: 128, opacity: 0, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/chopper_new_world/frame.webp", x: 50, y: 49.5, w: 124, h: 130, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    robinNewWorld: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/robin_new_world/aura.webp", x: 50, y: 50, w: 118, h: 114, opacity: 0.72, strength: 1, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/robin_new_world/left_part.webp", x: 157.5, y: 59.5, w: 124, h: 132, rotate: 23, opacity: 1, strength: 1, z: 11, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/robin_new_world/right_part.webp", x: -42.5, y: 47.5, w: 124, h: 132, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/robin_new_world/frame.webp", x: 50, y: 50, w: 133.5, h: 130, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    brookSoulKing: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/brook_soul_king/aura.webp", x: 50, y: 50, w: 122, h: 116, opacity: 0.78, strength: 1, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/brook_soul_king/left_part.webp", x: 93, y: 50.5, w: 124, h: 132, flipX: true, opacity: 1, strength: 1, z: 11, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/brook_soul_king/right_part.webp", x: -51, y: 52, w: 124, h: 132, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/brook_soul_king/frame.webp", x: 50, y: 50, w: 124, h: 119, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    frankyShogun: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/franky_shogun/aura.webp", x: 50, y: 50, w: 120, h: 116, opacity: 0.78, strength: 1, z: 8, blend: "screen" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/franky_shogun/left_part.webp", x: 90, y: 52, w: 124, h: 132, flipX: true, opacity: 1, strength: 1, z: 14, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/franky_shogun/right_part.webp", x: -19, y: 39, w: 124, h: 132, flipX: true, opacity: 1, strength: 1, z: 14, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/franky_shogun/frame.webp", x: 50, y: 50, w: 124, h: 122, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    yonkoAllClear: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/yonko_all_clear/aura.webp", x: 50, y: 50, w: 94.5, h: 95, opacity: 0.65, strength: 1.1, z: 8, blend: "normal" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/yonko_all_clear/left_part.webp", x: 148.5, y: 52, w: 124, h: 132, opacity: 1, strength: 1, z: 11, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/yonko_all_clear/right_part.webp", x: -39.5, y: 52, w: 124, h: 132, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/yonko_all_clear/frame.webp", x: 50, y: 50, w: 113, h: 116.5, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    finalImu: {
      layers: {
        aura: { asset: "images/board/battle/cosmetic_frames/final_imu/aura.webp", x: 50, y: 42, w: 100, h: 118, opacity: 0.5, strength: 1, z: 8, blend: "normal" },
        leftPart: { asset: "images/board/battle/cosmetic_frames/final_imu/left_part.webp", x: 134, y: 56.5, w: 70.5, h: 95, opacity: 1, strength: 1, z: 11, blend: "normal" },
        rightPart: { asset: "images/board/battle/cosmetic_frames/final_imu/right_part.webp", x: -34.5, y: 59, w: 73, h: 84.5, opacity: 1, strength: 1, z: 11, blend: "normal" },
        frame: { asset: "images/board/battle/cosmetic_frames/final_imu/frame.webp", x: 50, y: 38, w: 116, h: 135, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
    rocksConqueror: {
      layers: {
        frame: { asset: "images/board/battle/cosmetic_frames/rocks_conqueror/frame.webp", x: 50, y: 50, w: 121, h: 121, opacity: 1, strength: 1, z: 12, blend: "normal" },
      },
    },
  };

  window.BoardCosmeticFramePreviewConfigs = configs;
})();
