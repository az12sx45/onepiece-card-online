'use strict';
// Exact original persistent-stage state transitions. Native drawing is supplied separately.
exports.create=function({refs,setWorld,setBoss,clearTimeout,setTimeout,setInterval,clearInterval,showStatus,hooks={},visualRandom}){
let latestView=null;
const setTotMusicaWorldStage=setWorld,setTotMusicaBossStage=setBoss;
// The browser presentation had its own realm. Its rolling faces must not
// consume the native game's random stream.
const Math=Object.create(globalThis.Math);Math.random=()=>{if(!visualRandom)throw Error('Tot cinematic visual RNG required');return visualRandom();};
const invoke=(name,...args)=>{if(typeof hooks[name]!=='function')throw Error('Unbound original Tot cinematic hook '+name);return hooks[name](...args);};
const clearDamageNumbers=()=>invoke('clearDamageNumbers'),moveFxRuntime=()=>invoke('moveFxRuntime'),playStageShake=()=>invoke('playStageShake'),playCastEffectSound=value=>invoke('playCastEffectSound',value),playHitEffectSound=value=>invoke('playHitEffectSound',value),moveFxSound=(...args)=>invoke('moveFxSound',...args),restartAnimation=(...args)=>invoke('restartAnimation',...args),spawnBattleDamageNumber=value=>invoke('spawnBattleDamageNumber',value),renderPanel=view=>invoke('renderPanel',view);
const PLACEHOLDER_BATTLE_PORTRAIT = "images/board/battle/portraits/placeholder/normal.webp";
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
let totMusicaBossPreviewOpen = false;
let totMusicaDualAwaitingEvent = false;
let totMusicaDualAnimationActive = false;
let totMusicaDualAwaitTimer = null;
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
function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
function carryItemHudPills(carryItem) {
    if (!carryItem?.id) return `<span class="pill">攜帶物：無</span>`;
    const subItems = Array.isArray(carryItem.subItems) ? carryItem.subItems : [];
    const subItemsPayload = subItems.length ? encodeURIComponent(JSON.stringify(subItems)) : "";
    return `
      <button class="pill carry-pill${subItems.length ? " carry-arsenal-pill" : ""}" type="button" data-carry-popover data-carry-name="${escapeHtml(carryItem.name || "攜帶物")}" data-carry-status="${escapeHtml(carryItem.status || "戰鬥中生效")}" data-carry-summary="${escapeHtml(carryItem.summary || "沒有登錄效果。")}" ${subItemsPayload ? `data-carry-sub-items="${escapeHtml(subItemsPayload)}"` : ""}>攜帶物：${escapeHtml(carryItem.name || "無")}</button>
    `;
  }
function normalizeCosmeticFrameId(value = "") {
    const raw = String(value || "").trim();
    if (raw === "nikaFrame" || COSMETIC_FRAME_CONFIGS[raw]) return raw;
    const key = raw.replace(/[\s_-]+/g, "").toLowerCase();
    if (!key) return "";
    return COSMETIC_FRAME_ALIAS[key] || "";
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
function setTotMusicaHpUi(textNode, fillNode, currentHp, maxHp) {
    const max = Math.max(1, Number(maxHp || 1));
    const current = Math.max(0, Math.min(max, Number(currentHp || 0)));
    if (textNode) textNode.textContent = `HP ${Math.round(current)} / ${Math.round(max)}`;
    if (fillNode) fillNode.style.width = `${Math.max(0, Math.min(100, current / max * 100))}%`;
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
    [real, song].forEach((world) => {
      if (world.moveId) void moveFxRuntime()?.warm(world);
    });

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
      [[real, refs.totMusicaRealFrame], [song, refs.totMusicaSongFrame]].forEach(([world, frame]) => {
        if (!world.direct) {
          playCastEffectSound(moveFxSound(world, "cast", world.castSfx));
          if (world.moveId) moveFxRuntime()?.play(world, { actorSide: "player", targetSide: "player", anchorElement: frame });
        }
      });
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
        [real, song].forEach((world) => {
          if (world.direct) playCastEffectSound(moveFxSound(world, "cast", world.castSfx));
        });
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
        [real, song].forEach((world) => {
          if (!world.direct || !world.hit) return;
          moveFxRuntime()?.play(world, { actorSide: "player", targetSide: "enemy", anchorElement: refs.totMusicaBossFrame });
          playHitEffectSound(moveFxSound(world, "hit", world.hitSfx));
        });
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
      playCastEffectSound(moveFxSound(event, "cast", event.castSfx));
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
      [[real, refs.totMusicaRealFrame], [song, refs.totMusicaSongFrame]].forEach(([world, frame]) => {
        if (dealsDamage ? world.hit || world.fatalGuard : world.affected) {
          moveFxRuntime()?.play(event, { actorSide: "enemy", targetSide: "player", anchorElement: frame });
        }
      });
      if (dealsDamage && (real.hit || song.hit || real.fatalGuard || song.fatalGuard)) playHitEffectSound(moveFxSound(event, "hit", event.hitSfx));
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
return {sync(view){latestView=view;syncTotMusicaPersistentStage(view);},toggle(){toggleTotMusicaBossPreview();},presentation(active,awaiting=false){totMusicaDualAnimationActive=active;totMusicaDualAwaitingEvent=awaiting;},play(event){if(event.type==='tot-musica-dual-sync')playTotMusicaDualSyncFx(event);else if(event.type==='tot-musica-enemy-dual-strike')playTotMusicaEnemyDualStrikeFx(event);else throw Error('Unknown Tot cinematic '+event.type);},clear:clearTotMusicaDualSyncFx,animationActive:()=>totMusicaDualAnimationActive,portrait:totMusicaDualPortrait,carry:carryItemHudPills,frame(id){return COSMETIC_FRAME_CONFIGS[normalizeCosmeticFrameId(id)]||null;}};
};
