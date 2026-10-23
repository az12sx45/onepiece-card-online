'use strict';
require('./native-number-locale').install();
exports.create=function(host){
 const {window,document,localStorage,URLSearchParams,performance,navigator}=host;
 const setTimeout=window.setTimeout,clearTimeout=window.clearTimeout,requestAnimationFrame=window.requestAnimationFrame;
 if(new URLSearchParams(window.location.search).get('board')!=='1')throw Error('Native Water Seven requires a real board snapshot');
 if(!localStorage.getItem('onepiece-board-water-seven-snapshot-v1'))throw Error('Native Water Seven snapshot unavailable');

    const WATER_SEVEN_SNAPSHOT_KEY = "onepiece-board-water-seven-snapshot-v1";

    const materials = {
      plank: "船材木板",
      toolbox: "船匠工具箱",
      resin: "鍍膜樹脂",
      adam: "寶樹亞當木片"
    };

    const formalGearCatalog = [
      {
        id: "ship_patch_canvas",
        name: "補帆帆布",
        rank: "C",
        kind: "航海",
        effect: "移動骰擲出 1 時，本次移動 +1，每 4 回合最多觸發 1 次。",
        desc: "小幅減少低骰挫折。"
      },
      {
        id: "ship_ration_barrel",
        name: "乾糧木桶",
        rank: "C",
        kind: "補給",
        effect: "每場戰鬥勝利後，HP 最低的存活夥伴回復最大 HP 3%。",
        desc: "低量續航，不取代藥物。"
      },
      {
        id: "ship_escape_ladder",
        name: "甲板繩梯",
        rank: "C",
        kind: "特殊",
        effect: "一般戰鬥與敵島撤退更容易成功，Boss 戰無效。",
        desc: "給逃跑流入門。"
      },
      {
        id: "ship_tailwind_sail",
        name: "順風三角帆",
        rank: "B",
        kind: "航海",
        effect: "每 5 回合 1 次，擲骰後自動補 +1 移動。",
        desc: "控步數但冷卻長。"
      },
      {
        id: "ship_observer_spyglass",
        name: "觀測員望遠鏡台",
        rank: "B",
        kind: "偵查",
        effect: "海格二選一時，額外顯示 1 張卡的次類型。",
        desc: "比 C 級更準，但仍不是完全揭曉。"
      },
      {
        id: "ship_reinforced_bottom_plate",
        name: "船底加固鐵板",
        rank: "B",
        kind: "防禦",
        effect: "海格固定 HP 損傷 -15%，戰鬥第一回合第一次受傷 -5%。",
        desc: "泛用防禦但數值小。"
      },
      {
        id: "ship_stove_upgrade",
        name: "廚房火爐改良件",
        rank: "B",
        kind: "補給",
        effect: "戰鬥勝利後全隊回復最大 HP 2%；若有人低於 30%，最低 HP 夥伴額外回 3%。",
        desc: "長線續航，不是戰中回血。"
      },
      {
        id: "ship_cola_aux_engine",
        name: "可樂輔助引擎",
        rank: "A",
        kind: "航海",
        effect: "每 6 回合自動啟動 1 次爆發航行，擲骰後移動 +2。",
        desc: "強移動，但有長冷卻。"
      },
      {
        id: "ship_coup_de_burst_port",
        name: "風來砲改造口",
        rank: "A",
        kind: "特殊",
        effect: "一般戰鬥逃跑更容易成功；成功逃跑後下次移動 +2。",
        desc: "逃跑流核心，不適合硬推副本。"
      },
      {
        id: "ship_bird_nest_tower",
        name: "瞭望鳥巢高台",
        rank: "A",
        kind: "偵查",
        effect: "海格二選一時，標示未知卡是否可能觸發戰鬥。",
        desc: "改變探索風險判斷。"
      },
      {
        id: "ship_adam_sub_keel",
        name: "寶樹亞當副龍骨",
        rank: "A",
        kind: "防禦",
        effect: "每場戰鬥開始，全隊獲得最大 HP 5% 護盾；Boss 戰為 3%。",
        desc: "穩定但不是高輸出。"
      },
      {
        id: "ship_dream_medical_galley",
        name: "夢幻廚房與醫療聯艙",
        rank: "S",
        kind: "補給",
        effect: "戰鬥勝利後全隊回復最大 HP 4%；每場最多 1 名瀕死夥伴以 1 HP 回隊伍。",
        desc: "長線副本強，但不戰中復活。"
      }
    ];

    const boardShipGearCatalog = Object.values(window.GAME_ITEMS || {})
      .filter((item) => item?.category === "ship" && item?.effect?.kind === "ship_equipment")
      .map((item) => ({
        id: item.id,
        name: item.name,
        rank: item.rarity || "C",
        kind: item.subType === "material" ? "素材" : "船隻裝備",
        effect: item.uiSummary || item.effectText || item.description || "",
        desc: item.balanceNote || item.uiSummary || "",
        image: item.image || `images/board/items/${item.id}.webp`
      }));

    if (boardShipGearCatalog.length) {
      formalGearCatalog.splice(0, formalGearCatalog.length, ...boardShipGearCatalog);
    }

    function normalizeDemoShipId(value) {
      const match = String(value || "").match(/ship[_-]?0?([1-6])/i);
      return match ? `ship_${String(Number(match[1])).padStart(2, "0")}` : "";
    }

    const demoParams = new URLSearchParams(window.location.search);
    const requestedShipId = normalizeDemoShipId(demoParams.get("ship"));
    const lockShipSelection = demoParams.get("lockShip") === "1";
    const boardLinkedMode = demoParams.get("board") === "1";
    if (lockShipSelection) document.body.classList.add("ship-locked");

    let currentShipId = requestedShipId || "ship_01";

    function readWaterSevenSnapshot() {
      try {
        const raw = localStorage.getItem(WATER_SEVEN_SNAPSHOT_KEY);
        if (!raw) return null;
        const payload = JSON.parse(raw);
        return payload?.view || payload || null;
      } catch (_error) {
        return null;
      }
    }

    function normalizeGearEntry(item) {
      const id = String(item.id || "").trim();
      return {
        id,
        name: item.name || "未知道具",
        rank: item.rank || item.rarity || "C",
        kind: item.kind || "船隻裝備",
        effect: item.effect || item.description || "",
        desc: item.desc || item.uiSummary || item.effect || "",
        image: item.image || (id ? `images/board/items/${id}.webp` : ""),
        count: Math.max(0, Math.round(Number(item.count || 0)))
      };
    }

    function clampLevel(value, max = 3) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.max(0, Math.min(max, Math.round(parsed))) : 0;
    }

    function clampSlotCount(value, fallback = 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.max(0, Math.min(4, Math.round(parsed))) : fallback;
    }

    const upgradeFocus = {
      sail: "sail",
      rudder: "rudder",
      watchtower: "watchtower",
      kitchen: "kitchen",
      training: "deck"
    };

    const ship01Images = {
      angle01: "images/board/water_seven/ship_01_angle_01_cutout.webp",
      angle02: "images/board/water_seven/ship_01_angle_02_cutout.webp",
      angle03: "images/board/water_seven/ship_01_angle_03_cutout.webp",
      angle05: "images/board/water_seven/ship_01_angle_05_cutout.webp",
      angle06: "images/board/water_seven/ship_01_angle_06_cutout.webp",
      angle08: "images/board/water_seven/ship_01_angle_08_cutout.webp"
    };

    const ship03Images = {
      default: "images/board/water_seven/ship_03_default_cutout.webp",
      sail: "images/board/water_seven/ship_03_sail_cutout.webp",
      watchtower: "images/board/water_seven/ship_03_watchtower_cutout.webp",
      deck: "images/board/water_seven/ship_03_deck_cutout.webp",
      kitchen: "images/board/water_seven/ship_03_kitchen_cutout.webp",
      rudder: "images/board/water_seven/ship_03_rudder_cutout.webp"
    };

    const ship02Images = {
      angle01: "images/board/water_seven/ship_02_angle_01_cutout.webp",
      angle02: "images/board/water_seven/ship_02_angle_02_cutout.webp",
      angle04: "images/board/water_seven/ship_02_angle_04_cutout.webp",
      angle06: "images/board/water_seven/ship_02_angle_06_cutout.webp",
      angle07: "images/board/water_seven/ship_02_angle_07_cutout.webp",
      angle09: "images/board/water_seven/ship_02_angle_09_cutout.webp"
    };

    const ship06Images = {
      angle01: "images/board/water_seven/ship_06_angle_01_cutout.webp",
      angle02: "images/board/water_seven/ship_06_angle_02_cutout.webp",
      angle03: "images/board/water_seven/ship_06_angle_03_cutout.webp",
      angle04: "images/board/water_seven/ship_06_angle_04_cutout.webp",
      angle08: "images/board/water_seven/ship_06_angle_08_cutout.webp",
      angle10: "images/board/water_seven/ship_06_angle_10_cutout.webp"
    };

    const ship04Images = {
      angle01: "images/board/water_seven/ship_04_angle_01_cutout.webp",
      angle02: "images/board/water_seven/ship_04_angle_02_cutout.webp",
      angle03: "images/board/water_seven/ship_04_angle_03_cutout.webp",
      angle04: "images/board/water_seven/ship_04_angle_04_cutout.webp",
      angle05: "images/board/water_seven/ship_04_angle_05_cutout.webp",
      angle06: "images/board/water_seven/ship_04_angle_06_cutout.webp"
    };

    const ship05Images = {
      angle01: "images/board/water_seven/ship_05_angle_01_cutout.webp",
      angle02: "images/board/water_seven/ship_05_angle_02_cutout.webp",
      angle03: "images/board/water_seven/ship_05_angle_03_cutout.webp",
      angle04: "images/board/water_seven/ship_05_angle_04_cutout.webp",
      angle05: "images/board/water_seven/ship_05_angle_05_cutout.webp",
      angle06: "images/board/water_seven/ship_05_angle_06_cutout.webp"
    };

    const defaultShipCamera = {
      default: { x: "0px", y: "0px", scale: "1", tilt: "0deg", focusX: "50%", focusY: "46%" },
      sail: { x: "-12px", y: "54px", scale: "1.3", tilt: "-0.4deg", focusX: "53%", focusY: "32%" },
      rudder: { x: "0px", y: "-18px", scale: "1.42", tilt: "0.4deg", focusX: "50%", focusY: "70%" },
      watchtower: { x: "-8px", y: "122px", scale: "1.62", tilt: "-0.6deg", focusX: "50%", focusY: "13%" },
      deck: { x: "0px", y: "-16px", scale: "1.16", tilt: "0deg", focusX: "49%", focusY: "52%" },
      kitchen: { x: "-18px", y: "-20px", scale: "1.38", tilt: "0.2deg", focusX: "35%", focusY: "58%" }
    };

    const shipConfigs = {
      ship_01: {
        name: "千陽號",
        image: ship01Images.angle08,
        turnFrames: [
          ship01Images.angle08,
          ship01Images.angle01,
          ship01Images.angle03,
          ship01Images.angle05,
          ship01Images.angle02,
          ship01Images.angle06
        ],
        focusImages: {
          default: ship01Images.angle08,
          sail: ship01Images.angle01,
          watchtower: ship01Images.angle03,
          deck: ship01Images.angle05,
          kitchen: ship01Images.angle02,
          rudder: ship01Images.angle06
        },
        slotImage: ship01Images.angle02,
        slotTune: {
          size: 112,
          anchors: [
            { x: 3.6, y: 30, targetX: 47.8, targetY: 68.1 },
            { x: 96.8, y: 30.5, targetX: 56.7, targetY: 51.8 },
            { x: 3.1, y: 76.3, targetX: 31.3, targetY: 82.9 },
            { x: 97.1, y: 75.3, targetX: 82, targetY: 74.4 }
          ]
        },
        markerLayer: { centerX: 50, centerY: 46, widthPct: 86, maxWidth: 780, aspectW: 4, aspectH: 3 },
        anchors: {
          sail: { x: 49, y: 34 },
          watchtower: { x: 49, y: 13 },
          training: { x: 43, y: 54 },
          kitchen: { x: 77, y: 58 },
          rudder: { x: 93, y: 61 }
        },
        anchorSets: {
          default: {
            sail: { x: 49, y: 34 },
            watchtower: { x: 49, y: 13 },
            training: { x: 43, y: 54 },
            kitchen: { x: 77, y: 58 },
            rudder: { x: 93, y: 61 }
          },
          sail: {
            sail: { x: 49.4, y: 33.1 },
            watchtower: { x: 49.5, y: 13.9 },
            training: { x: 42.3, y: 65 },
            kitchen: { x: 67.8, y: 57.9 },
            rudder: { x: 86.3, y: 69.3 }
          },
          watchtower: {
            sail: { x: 49, y: 34 },
            watchtower: { x: 51.8, y: 12.9 },
            training: { x: 43, y: 55 },
            kitchen: { x: 77, y: 58 },
            rudder: { x: 91, y: 61 }
          },
          deck: {
            sail: { x: 59.4, y: 49.5 },
            watchtower: { x: 24.9, y: 49.5 },
            training: { x: 44.1, y: 49.3 },
            kitchen: { x: 77.4, y: 48.9 },
            rudder: { x: 96, y: 49.9 }
          },
          kitchen: {
            sail: { x: 48, y: 36 },
            watchtower: { x: 50, y: 12 },
            training: { x: 60.5, y: 63.8 },
            kitchen: { x: 35.3, y: 66.4 },
            rudder: { x: 22.7, y: 85.3 }
          },
          rudder: {
            sail: { x: 50, y: 32 },
            watchtower: { x: 50, y: 10 },
            training: { x: 50, y: 59.6 },
            kitchen: { x: 53, y: 54 },
            rudder: { x: 50, y: 76 }
          }
        },
        camera: defaultShipCamera
      },
      ship_03: {
        name: "九蛇船",
        image: ship03Images.default,
        turnFrames: [
          ship03Images.default,
          ship03Images.sail,
          ship03Images.watchtower,
          ship03Images.deck,
          ship03Images.kitchen,
          ship03Images.rudder
        ],
        focusImages: {
          default: ship03Images.default,
          sail: ship03Images.watchtower,
          watchtower: ship03Images.watchtower,
          deck: ship03Images.deck,
          kitchen: ship03Images.kitchen,
          rudder: ship03Images.rudder
        },
        slotImage: ship03Images.watchtower,
        slotTune: {
          size: 112,
          anchors: [
            { x: 5.4, y: 30.7, targetX: 18.5, targetY: 29.4 },
            { x: 96.1, y: 31.5, targetX: 58.1, targetY: 44 },
            { x: 5.4, y: 74.4, targetX: 24.7, targetY: 81.4 },
            { x: 95.9, y: 74.4, targetX: 60, targetY: 72.4 }
          ]
        },
        markerLayer: { centerX: 50, centerY: 46, widthPct: 88, maxWidth: 780, aspectW: 4, aspectH: 3 },
        anchors: {
          sail: { x: 54, y: 34 },
          watchtower: { x: 50, y: 14 },
          training: { x: 43, y: 57 },
          kitchen: { x: 46, y: 66 },
          rudder: { x: 18, y: 67 }
        },
        anchorSets: {
          default: {
            sail: { x: 54, y: 34 },
            watchtower: { x: 50, y: 14 },
            training: { x: 43, y: 57 },
            kitchen: { x: 46, y: 66 },
            rudder: { x: 18, y: 67 }
          },
          sail: {
            sail: { x: 55.8, y: 48.4 },
            watchtower: { x: 51, y: 15 },
            training: { x: 38.7, y: 60.4 },
            kitchen: { x: 35.9, y: 74.8 },
            rudder: { x: 16, y: 70 }
          },
          watchtower: {
            sail: { x: 53, y: 34 },
            watchtower: { x: 52.3, y: 13.4 },
            training: { x: 42, y: 58 },
            kitchen: { x: 47, y: 66 },
            rudder: { x: 17, y: 68 }
          },
          deck: {
            sail: { x: 55.8, y: 58.1 },
            watchtower: { x: 48.1, y: 45.5 },
            training: { x: 40.8, y: 48 },
            kitchen: { x: 44.1, y: 63.7 },
            rudder: { x: 20.7, y: 69 }
          },
          kitchen: {
            sail: { x: 54, y: 35 },
            watchtower: { x: 50, y: 14 },
            training: { x: 33.3, y: 57 },
            kitchen: { x: 34.5, y: 74.6 },
            rudder: { x: 14.6, y: 83.7 }
          },
          rudder: {
            sail: { x: 52, y: 34 },
            watchtower: { x: 52, y: 14 },
            training: { x: 42, y: 57 },
            kitchen: { x: 54, y: 62 },
            rudder: { x: 47.6, y: 90 }
          }
        },
        camera: defaultShipCamera
      },
      ship_02: {
        name: "白鯨號",
        image: ship02Images.angle07,
        turnFrames: [
          ship02Images.angle07,
          ship02Images.angle01,
          ship02Images.angle04,
          ship02Images.angle09,
          ship02Images.angle06,
          ship02Images.angle02
        ],
        focusImages: {
          default: ship02Images.angle07,
          sail: ship02Images.angle01,
          watchtower: ship02Images.angle04,
          deck: ship02Images.angle09,
          kitchen: ship02Images.angle06,
          rudder: ship02Images.angle02
        },
        slotImage: ship02Images.angle01,
        slotTune: {
          size: 112,
          anchors: [
            { x: 7.7, y: 32.1, targetX: 27.2, targetY: 51 },
            { x: 94.8, y: 30.9, targetX: 52.6, targetY: 51.6 },
            { x: 3.8, y: 74.6, targetX: 34.7, targetY: 82.6 },
            { x: 96.4, y: 74.4, targetX: 58.7, targetY: 80 }
          ]
        },
        markerLayer: { centerX: 50, centerY: 46, widthPct: 88, maxWidth: 780, aspectW: 4, aspectH: 3 },
        anchors: {
          sail: { x: 51, y: 35 },
          watchtower: { x: 53, y: 11 },
          training: { x: 50, y: 61 },
          kitchen: { x: 51, y: 69 },
          rudder: { x: 88, y: 61 }
        },
        anchorSets: {
          default: {
            sail: { x: 51, y: 35 },
            watchtower: { x: 53, y: 11 },
            training: { x: 50, y: 61 },
            kitchen: { x: 51, y: 69 },
            rudder: { x: 88, y: 61 }
          },
          sail: {
            sail: { x: 54.6, y: 37 },
            watchtower: { x: 50, y: 10 },
            training: { x: 47, y: 58 },
            kitchen: { x: 47, y: 66 },
            rudder: { x: 13, y: 61 }
          },
          watchtower: {
            sail: { x: 50, y: 42 },
            watchtower: { x: 50, y: 10.1 },
            training: { x: 50, y: 58 },
            kitchen: { x: 50, y: 68 },
            rudder: { x: 50, y: 78 }
          },
          deck: {
            sail: { x: 58, y: 50.2 },
            watchtower: { x: 38.7, y: 49.1 },
            training: { x: 48, y: 51 },
            kitchen: { x: 48.1, y: 70.6 },
            rudder: { x: 12.1, y: 64.4 }
          },
          kitchen: {
            sail: { x: 51, y: 35 },
            watchtower: { x: 49, y: 16 },
            training: { x: 52, y: 59 },
            kitchen: { x: 60, y: 73.6 },
            rudder: { x: 88, y: 59 }
          },
          rudder: {
            sail: { x: 48, y: 40 },
            watchtower: { x: 53, y: 18 },
            training: { x: 51, y: 58 },
            kitchen: { x: 54, y: 66 },
            rudder: { x: 88.4, y: 75.3 }
          }
        },
        camera: defaultShipCamera
      },
      ship_04: {
        name: "潛水艇",
        image: ship04Images.angle05,
        turnFrames: [
          ship04Images.angle05,
          ship04Images.angle06,
          ship04Images.angle03,
          ship04Images.angle02,
          ship04Images.angle04,
          ship04Images.angle01
        ],
        focusImages: {
          default: ship04Images.angle05,
          sail: ship04Images.angle04,
          watchtower: ship04Images.angle04,
          deck: ship04Images.angle01,
          kitchen: ship04Images.angle04,
          rudder: ship04Images.angle03
        },
        slotImage: ship04Images.angle05,
        slotTune: {
          size: 112,
          anchors: [
            { x: 3, y: 33.2, targetX: 31.6, targetY: 40.5 },
            { x: 100, y: 31.2, targetX: 63.1, targetY: 34.4 },
            { x: 0, y: 77.4, targetX: 31, targetY: 61.6 },
            { x: 100, y: 75.9, targetX: 51.2, targetY: 75.4 }
          ]
        },
        markerLayer: { centerX: 50, centerY: 45.5, widthPct: 80.5, maxWidth: 780, aspectW: 4, aspectH: 3 },
        anchors: {
          sail: { x: 50, y: 42 },
          watchtower: { x: 51, y: 22 },
          training: { x: 50, y: 56 },
          kitchen: { x: 44.4, y: 61.9 },
          rudder: { x: 84, y: 52 }
        },
        anchorSets: {
          default: {
            sail: { x: 50, y: 42 },
            watchtower: { x: 51, y: 22 },
            training: { x: 50, y: 56 },
            kitchen: { x: 44.4, y: 61.9 },
            rudder: { x: 84, y: 52 }
          },
          sail: {
            sail: { x: 39.1, y: 26.1 },
            watchtower: { x: 59.9, y: 27.4 },
            training: { x: 50, y: 58 },
            kitchen: { x: 50, y: 67 },
            rudder: { x: 50, y: 80 }
          },
          watchtower: {
            sail: { x: 49, y: 42 },
            watchtower: { x: 60.1, y: 27.3 },
            training: { x: 49, y: 58 },
            kitchen: { x: 51, y: 65 },
            rudder: { x: 85, y: 59 }
          },
          deck: {
            sail: { x: 57.8, y: 48.4 },
            watchtower: { x: 56, y: 18 },
            training: { x: 66.4, y: 50 },
            kitchen: { x: 43.5, y: 49.2 },
            rudder: { x: 76.7, y: 49.5 }
          },
          kitchen: {
            sail: { x: 38.5, y: 23.1 },
            watchtower: { x: 63, y: 28 },
            training: { x: 33.1, y: 61.1 },
            kitchen: { x: 54.6, y: 40.6 },
            rudder: { x: 23.1, y: 71.3 }
          },
          rudder: {
            sail: { x: 48, y: 42 },
            watchtower: { x: 52, y: 23 },
            training: { x: 52, y: 58 },
            kitchen: { x: 58, y: 62 },
            rudder: { x: 75.8, y: 61.6 }
          }
        },
        camera: defaultShipCamera
      },
      ship_06: {
        name: "梅利號",
        image: ship06Images.angle10,
        turnFrames: [
          ship06Images.angle10,
          ship06Images.angle03,
          ship06Images.angle02,
          ship06Images.angle08,
          ship06Images.angle04,
          ship06Images.angle01
        ],
        focusImages: {
          default: ship06Images.angle10,
          sail: ship06Images.angle03,
          watchtower: ship06Images.angle02,
          deck: ship06Images.angle08,
          kitchen: ship06Images.angle04,
          rudder: ship06Images.angle04
        },
        slotImage: ship06Images.angle04,
        slotTune: {
          size: 112,
          anchors: [
            { x: 6.1, y: 32.6, targetX: 50.3, targetY: 38.5 },
            { x: 94.5, y: 31.7, targetX: 79.8, targetY: 50.7 },
            { x: 3.7, y: 76.1, targetX: 40, targetY: 64 },
            { x: 95.7, y: 75.2, targetX: 78.7, targetY: 71 }
          ]
        },
        markerLayer: { centerX: 50, centerY: 46, widthPct: 88, maxWidth: 780, aspectW: 4, aspectH: 3 },
        anchors: {
          sail: { x: 52, y: 36 },
          watchtower: { x: 52, y: 11 },
          training: { x: 56, y: 56 },
          kitchen: { x: 64, y: 61 },
          rudder: { x: 87, y: 62 }
        },
        anchorSets: {
          default: {
            sail: { x: 52, y: 36 },
            watchtower: { x: 52, y: 11 },
            training: { x: 56, y: 56 },
            kitchen: { x: 64, y: 61 },
            rudder: { x: 87, y: 62 }
          },
          sail: {
            sail: { x: 50.1, y: 26.8 },
            watchtower: { x: 50, y: 12 },
            training: { x: 50, y: 60 },
            kitchen: { x: 50, y: 66 },
            rudder: { x: 50, y: 78 }
          },
          watchtower: {
            sail: { x: 51, y: 35 },
            watchtower: { x: 43.3, y: 14.3 },
            training: { x: 50, y: 56 },
            kitchen: { x: 57, y: 61 },
            rudder: { x: 86, y: 62 }
          },
          deck: {
            sail: { x: 50, y: 37 },
            watchtower: { x: 53, y: 11 },
            training: { x: 37.7, y: 51.3 },
            kitchen: { x: 61.8, y: 51.3 },
            rudder: { x: 81.2, y: 52.3 }
          },
          kitchen: {
            sail: { x: 51, y: 38 },
            watchtower: { x: 50, y: 11 },
            training: { x: 58, y: 57 },
            kitchen: { x: 48.5, y: 65.2 },
            rudder: { x: 17, y: 62 }
          },
          rudder: {
            sail: { x: 50, y: 38 },
            watchtower: { x: 50, y: 10 },
            training: { x: 66.5, y: 65.7 },
            kitchen: { x: 49.5, y: 56.4 },
            rudder: { x: 31, y: 90.8 }
          }
        },
        camera: defaultShipCamera
      },
      ship_05: {
        name: "卡普軍艦",
        image: ship05Images.angle05,
        turnFrames: [
          ship05Images.angle05,
          ship05Images.angle06,
          ship05Images.angle01,
          ship05Images.angle02,
          ship05Images.angle04,
          ship05Images.angle03
        ],
        focusImages: {
          default: ship05Images.angle05,
          sail: ship05Images.angle01,
          watchtower: ship05Images.angle04,
          deck: ship05Images.angle02,
          kitchen: ship05Images.angle01,
          rudder: ship05Images.angle05
        },
        slotImage: ship05Images.angle05,
        slotTune: {
          size: 112,
          anchors: [
            { x: 0.2, y: 38, targetX: 26.6, targetY: 40.9 },
            { x: 99.8, y: 38.4, targetX: 77.8, targetY: 30.7 },
            { x: 0, y: 70, targetX: 44.4, targetY: 77.9 },
            { x: 100, y: 70.4, targetX: 61, targetY: 64 }
          ]
        },
        markerLayer: { centerX: 50, centerY: 46, widthPct: 72, maxWidth: 660, aspectW: 4, aspectH: 5 },
        anchors: {
          sail: { x: 49, y: 38 },
          watchtower: { x: 51, y: 14 },
          training: { x: 49, y: 59 },
          kitchen: { x: 45, y: 66 },
          rudder: { x: 78, y: 68 }
        },
        anchorSets: {
          default: {
            sail: { x: 49, y: 38 },
            watchtower: { x: 51, y: 14 },
            training: { x: 49, y: 59 },
            kitchen: { x: 45, y: 66 },
            rudder: { x: 78, y: 68 }
          },
          sail: {
            sail: { x: 58, y: 43 },
            watchtower: { x: 50, y: 12 },
            training: { x: 49.4, y: 70.9 },
            kitchen: { x: 50, y: 68 },
            rudder: { x: 50, y: 80 }
          },
          watchtower: {
            sail: { x: 50, y: 39 },
            watchtower: { x: 50.3, y: 14.9 },
            training: { x: 50, y: 59 },
            kitchen: { x: 50, y: 68 },
            rudder: { x: 50, y: 82 }
          },
          deck: {
            sail: { x: 51, y: 35 },
            watchtower: { x: 55, y: 12 },
            training: { x: 49.4, y: 75 },
            kitchen: { x: 53.2, y: 57.4 },
            rudder: { x: 51.4, y: 42.8 }
          },
          kitchen: {
            sail: { x: 47, y: 36 },
            watchtower: { x: 47, y: 13 },
            training: { x: 27.6, y: 68 },
            kitchen: { x: 42.5, y: 67.3 },
            rudder: { x: 80.8, y: 82.3 }
          },
          rudder: {
            sail: { x: 52, y: 37 },
            watchtower: { x: 54, y: 13 },
            training: { x: 24.9, y: 64.6 },
            kitchen: { x: 56.9, y: 65.1 },
            rudder: { x: 89.3, y: 80.2 }
          }
        },
        camera: defaultShipCamera
      }
    };

    const calloutAnchors = {
      sail: { x: 27, y: 18 },
      watchtower: { x: 72, y: 18 },
      training: { x: 28, y: 53 },
      kitchen: { x: 39, y: 76 },
      rudder: { x: 66, y: 74 }
    };

    const shipTuneFocusOrder = ["default", "sail", "watchtower", "deck", "kitchen", "rudder"];

    const shipTuneFocusLabels = {
      default: "總覽",
      sail: "桅杆",
      watchtower: "偵查台",
      deck: "甲板",
      kitchen: "廚房",
      rudder: "船尾"
    };

    const upgrades = [
      {
        id: "sail",
        name: "桅杆",
        level: 0,
        max: 3,
        tag: "先手戰鬥",
        desc: "讓隊伍開場更容易搶先手，第一回合打出更穩的先制節奏。",
        effects: [
          "Lv1：每場戰鬥開始時，全隊速度 +5%，持續 1 回合。",
          "Lv2：全隊速度 +5%，持續 2 回合。",
          "Lv3：戰鬥第 1 回合若我方先手行動，該角色造成傷害 +6%。"
        ],
        costs: [
          { berries: 8000, plank: 5, toolbox: 1 },
          { berries: 18000, plank: 9, toolbox: 2 },
          { berries: 36000, plank: 14, toolbox: 4, adam: 2 }
        ]
      },
      {
        id: "rudder",
        name: "船尾",
        level: 0,
        max: 3,
        tag: "防守 / 換人 / 撤退",
        desc: "提高換人、防守與撤退容錯，讓普通戰鬥有更穩的保命路線。",
        effects: [
          "Lv1：每場戰鬥第一次受到攻擊時，該次傷害 -8%。",
          "Lv2：換人時，換上場角色受到的下一次傷害 -10%。",
          "Lv3：戰鬥逃跑骰 +1。"
        ],
        costs: [
          { berries: 9000, plank: 4, toolbox: 2 },
          { berries: 20000, plank: 8, toolbox: 3 },
          { berries: 42000, plank: 12, toolbox: 5, adam: 2 }
        ]
      },
      {
        id: "watchtower",
        name: "偵查台",
        level: 0,
        max: 3,
        tag: "偵查型支援 / 敵影辨識",
        desc: "強化偵查型角色；偵查被動先標出黑色遭遇海格後，偵查台才能在點擊黑格時辨識敵人。",
        effects: [
          "Lv1：偵查第 2 階已標出的黑色遭遇格可在點擊後辨識敵人；若隊伍中至少有 1 名偵查型角色，被動人數判定另 +1，最多視為 3 名。",
          "Lv2：實際觸發海上遭遇時，開戰前顯示敵人基本資訊。",
          "Lv3：點敵人島顯示敵人基本資訊。"
        ],
        notes: [
          "Lv1 判定：0 名偵查型仍為 0；1 名視為 2；2 名視為 3；3 名以上最高仍視為 3。",
          "沒有開啟偵查第 2 階時，即使偵查台已升級也看不到黑格，逐格點擊普通海格不會辨識敵人；Lv2 後船隻真正停上遭遇格時，開戰前再顯示階級、等級、屬性、類型與剩餘 HP。",
          "Lv3 後：點敵人島顯示敵人名稱、階級、等級、屬性、類型與剩餘 HP。",
          "即使 Lv3，也不顯示敵人完整技能列表、下一回合行動、AI 行動邏輯、掉落物完整機率與隱藏被動。"
        ],
        costs: [
          { berries: 10000, plank: 4, toolbox: 2 },
          { berries: 22000, plank: 8, toolbox: 3 },
          { berries: 45000, plank: 12, toolbox: 4, adam: 1 }
        ]
      },
      {
        id: "kitchen",
        name: "廚房",
        level: 0,
        max: 3,
        tag: "戰後續航 / 技能次數",
        desc: "提供戰後回血與少量 PP 續航，適合長副本、連戰和缺醫院的路線。",
        effects: [
          "Lv1：戰鬥勝利後，HP 最低角色回復 5% 最大 HP。",
          "Lv2：戰鬥勝利後，出戰角色隨機 1 個已消耗技能 PP 回復 1。",
          "Lv3：若戰鬥勝利時全隊平均 HP 低於 50%，全隊回復最大 HP 5%。"
        ],
        costs: [
          { berries: 7000, plank: 3, toolbox: 1 },
          { berries: 16000, plank: 6, toolbox: 2, resin: 1 },
          { berries: 34000, plank: 10, toolbox: 4, adam: 1, resin: 2 }
        ]
      },
      {
        id: "training",
        name: "甲板",
        level: 0,
        max: 3,
        tag: "經驗 / 修行",
        desc: "提升戰鬥 EXP、低等角色追趕與任務 EXP 成長。",
        effects: [
          "Lv1：戰鬥勝利 EXP +6%。",
          "Lv2：低於隊伍平均等級的角色，額外 EXP +8%。",
          "Lv3：任務 EXP +10%，並保留 Lv1、Lv2 效果。"
        ],
        costs: [
          { berries: 12000, plank: 5, toolbox: 2 },
          { berries: 26000, plank: 9, toolbox: 3, adam: 1 },
          { berries: 52000, plank: 15, toolbox: 5, adam: 3, resin: 2 }
        ]
      }
    ];

    let gear = formalGearCatalog.map(normalizeGearEntry);

    let slotCosts = [
      { berries: 6000, plank: 3 },
      { berries: 10000, plank: 5, toolbox: 1 },
      { berries: 16000, toolbox: 3, plank: 8, adam: 1 },
      { berries: 40000, toolbox: 5, plank: 12, adam: 3, resin: 2 }
    ];

    const state = {
      berries: 58000,
      slotsUnlocked: boardLinkedMode ? 0 : 2,
      materials: {
        plank: 18,
        toolbox: 6,
        resin: 2,
        adam: 4
      },
      gearInventory: Object.fromEntries(formalGearCatalog.map((item) => [item.id, boardLinkedMode ? 0 : 1])),
      boardLinked: boardLinkedMode,
      playerId: "",
      equipped: [null, null, null, null],
      tab: "upgrades",
      selectedUpgrade: "training",
      selectedGear: formalGearCatalog[0].id,
      selectedSlot: 0
    };

    function applyFormalSnapshot(view = readWaterSevenSnapshot()) {
      if (!view || typeof view !== "object") return false;
      if (view.shipId && shipConfigs[view.shipId]) {
        currentShipId = view.shipId;
        currentShipFrameImage = shipConfigs[currentShipId]?.image || currentShipFrameImage;
        currentShipTargetImage = shipConfigs[currentShipId]?.image || currentShipTargetImage;
      }
      state.berries = Math.max(0, Math.round(Number(view.berries ?? state.berries)));
      state.playerId = view.playerId || state.playerId || "";
      state.slotsUnlocked = clampSlotCount(view.slotsUnlocked, state.boardLinked ? 0 : state.slotsUnlocked);
      const upgradeLevels = view.upgradeLevels && typeof view.upgradeLevels === "object" ? view.upgradeLevels : {};
      upgrades.forEach((upgrade) => {
        upgrade.level = state.boardLinked ? clampLevel(upgradeLevels[upgrade.id], upgrade.max) : clampLevel(upgrade.level, upgrade.max);
      });
      const equippedFromRecord = Array.isArray(view.equippedShipGear) ? view.equippedShipGear : [];
      state.equipped = [0, 1, 2, 3].map((index) => {
        const id = String(equippedFromRecord[index] || "").trim();
        return id || null;
      });
      state.materials = {
        ...state.materials,
        ...(view.materials || {})
      };
      applyBoardCosts(view);
      const formalGear = Array.isArray(view.shipEquipment) && view.shipEquipment.length
        ? view.shipEquipment.map(normalizeGearEntry)
        : formalGearCatalog.map(normalizeGearEntry);
      state.gearInventory = Object.fromEntries(formalGear.map((item) => [item.id, Math.max(0, Number(item.count || 0))]));
      const equippedSet = new Set(state.equipped.filter(Boolean));
      gear = state.boardLinked
        ? formalGear.filter((item) => Number(item.count || 0) > 0 || equippedSet.has(item.id))
        : formalGear;
      if (state.selectedGear && !gear.some((item) => item.id === state.selectedGear)) state.selectedGear = "";
      if (!state.selectedGear && gear.length) state.selectedGear = gear[0].id;
      return true;
    }

    function normalizeCostEntry(cost) {
      const source = cost && typeof cost === "object" && !Array.isArray(cost) ? cost : {};
      return Object.fromEntries(["berries", ...Object.keys(materials)].map((key) => {
        const value = Number(source[key] || 0);
        return [key, Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0];
      }).filter(([, value]) => value > 0));
    }

    function applyBoardCosts(view) {
      if (!state.boardLinked || !view || typeof view !== "object") return;
      const upgradeCosts = view.upgradeCosts && typeof view.upgradeCosts === "object" ? view.upgradeCosts : null;
      if (upgradeCosts) {
        upgrades.forEach((upgrade) => {
          const costs = Array.isArray(upgradeCosts[upgrade.id]) ? upgradeCosts[upgrade.id] : null;
          if (!costs) return;
          upgrade.costs = Array.from({ length: upgrade.max }, (_, index) => (
            costs[index] ? normalizeCostEntry(costs[index]) : upgrade.costs[index]
          ));
        });
      }
      if (Array.isArray(view.slotCosts)) {
        slotCosts = Array.from({ length: 4 }, (_, index) => (
          view.slotCosts[index] ? normalizeCostEntry(view.slotCosts[index]) : slotCosts[index]
        ));
      }
    }

    const defaultSlotTune = {
      size: 78,
      anchors: [
        { x: 15, y: 18, targetX: 40, targetY: 45 },
        { x: 85, y: 18, targetX: 61, targetY: 45 },
        { x: 15, y: 82, targetX: 40, targetY: 64 },
        { x: 85, y: 82, targetX: 61, targetY: 64 }
      ]
    };

    function cloneSlotTune(tune = defaultSlotTune) {
      return {
        size: Number(tune.size) || defaultSlotTune.size,
        anchors: (tune.anchors || defaultSlotTune.anchors).map((anchor) => ({ ...anchor }))
      };
    }

    Object.values(shipConfigs).forEach((config) => {
      config.slotTune = cloneSlotTune(config.slotTune);
    });

    let shipTuneEnabled = false;
    let draggingShipAnchor = null;
    let draggingShipSlot = null;
    let currentShipFocus = "default";
    let shipTunePreviewFocus = null;
    let currentShipFrameImage = shipConfigs[currentShipId].image;
    let currentShipTargetImage = shipConfigs[currentShipId].image;
    let shipTurnToken = 0;

    applyFormalSnapshot();

    const $ = (selector) => document.querySelector(selector);

    const formatBerries = (value) => `${value.toLocaleString("zh-TW")} B`;

    function costText(cost) {
      if (!cost) return "已完成";
      const parts = [`${formatBerries(cost.berries || 0)}`];
      Object.keys(materials).forEach((key) => {
        if (cost[key]) parts.push(`${materials[key]} x${cost[key]}`);
      });
      return parts.join("　");
    }

    function costPartsMarkup(cost) {
      if (!cost) return "<span>不需費用</span>";
      const parts = [`<span>${formatBerries(cost.berries || 0)}</span>`];
      Object.keys(materials).forEach((key) => {
        if (cost[key]) parts.push(`<span>${materials[key]} x${cost[key]}</span>`);
      });
      return parts.join("");
    }

    function canAfford(cost) {
      if (!cost) return true;
      if (state.berries < (cost.berries || 0)) return false;
      return Object.keys(materials).every((key) => (state.materials[key] || 0) >= (cost[key] || 0));
    }

    function spend(cost) {
      state.berries -= cost.berries || 0;
      Object.keys(materials).forEach((key) => {
        state.materials[key] = (state.materials[key] || 0) - (cost[key] || 0);
      });
    }

    function showToast(message) {
      const toast = $("#toast");
      toast.textContent = message;
      toast.classList.add("show");
      clearTimeout(showToast.timer);
      showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
    }

    function sendWaterSevenCommand(type, payload = {}) {
      if (!state.boardLinked) return false;
      const target = window.parent && window.parent !== window ? window.parent : null;
      if (!target) {
        showToast("找不到主遊戲視窗，無法寫入。");
        return true;
      }
      target.postMessage({
        type: "water-seven-command",
        command: {
          type,
          playerId: state.playerId,
          ...payload
        }
      }, "*");
      showToast("正在寫入主遊戲...");
      return true;
    }

    function equippedGearIds() {
      return state.equipped.filter(Boolean);
    }

    function findGear(id) {
      return gear.find((item) => item.id === id);
    }

    function ownedGearCount(id) {
      return Math.max(0, Math.round(Number(state.gearInventory?.[id] || 0)));
    }

    function gearSocketMarkup(item) {
      if (item && item.image) {
        return `<img src="${item.image}" alt="${item.name}">`;
      }
      if (item) return `<span class="slot-placeholder equipped" aria-hidden="true"></span>`;
      return `<span class="slot-placeholder" aria-hidden="true"></span>`;
    }

    function gearThumbMarkup(item) {
      if (item && item.image) {
        return `<span class="gear-thumb"><img src="${item.image}" alt="${item.name}" onerror="this.remove();this.parentElement.classList.add('fallback');"><img class="gear-fallback-icon" src="images/board/ship_info_ui/upgrade_icons/sail.webp" alt=""></span>`;
      }
      return `<span class="gear-thumb fallback"><img class="gear-fallback-icon" src="images/board/ship_info_ui/upgrade_icons/sail.webp" alt=""></span>`;
    }

    function shipEquipmentSlotFrameMarkup() {
      return `<img class="slot-frame" src="images/board/water_seven_ui/water_seven_ship_equipment_slot_frame.webp" alt="" aria-hidden="true">`;
    }

    function findUpgrade(id) {
      return upgrades.find((item) => item.id === id);
    }

    function renderTop() {
      $("#berries").textContent = formatBerries(state.berries);
      $("#slotCount").textContent = `${state.slotsUnlocked} / 4`;
      const config = getShipConfig();
      const nameDisplay = $("#shipNameDisplay");
      if (nameDisplay) nameDisplay.textContent = config.name || currentShipId;
      document.querySelectorAll("[data-ship-select]").forEach((button) => {
        button.classList.toggle("active", button.dataset.shipSelect === currentShipId);
        button.disabled = lockShipSelection && button.dataset.shipSelect !== currentShipId;
      });
    }

    function renderSlots() {
      const board = $("#slotBoard");
      board.innerHTML = "";
      const slotTune = currentSlotTune();
      board.style.setProperty("--slot-size", `${slotTune.size}px`);
      const lineLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      lineLayer.setAttribute("class", "slot-lines");
      lineLayer.setAttribute("viewBox", "0 0 100 100");
      lineLayer.setAttribute("aria-hidden", "true");
      slotTune.anchors.forEach((anchor, index) => {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", String(anchor.x));
        line.setAttribute("y1", String(anchor.y));
        line.setAttribute("x2", String(anchor.targetX));
        line.setAttribute("y2", String(anchor.targetY));
        lineLayer.appendChild(line);
        const end = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        end.classList.add("slot-line-point");
        end.dataset.slotTune = "target";
        end.dataset.slotIndex = String(index);
        end.setAttribute("cx", String(anchor.targetX));
        end.setAttribute("cy", String(anchor.targetY));
        end.setAttribute("r", "1.35");
        lineLayer.appendChild(end);
      });
      board.appendChild(lineLayer);
      for (let index = 0; index < 4; index += 1) {
        const unlocked = index < state.slotsUnlocked;
        const item = state.equipped[index] ? findGear(state.equipped[index]) : null;
        const anchor = slotTune.anchors[index] || slotTune.anchors[0];
        const slot = document.createElement("button");
        slot.type = "button";
        slot.className = `slot${unlocked ? "" : " locked"}${item ? " equipped" : ""}`;
        slot.dataset.slotTune = "socket";
        slot.dataset.slotIndex = String(index);
        slot.style.setProperty("--socket-x", `${anchor.x}%`);
        slot.style.setProperty("--socket-y", `${anchor.y}%`);
        if (!unlocked) {
          slot.dataset.openSlot = String(index);
          slot.title = `孔位 ${index + 1}：未開放`;
          slot.setAttribute("aria-label", `孔位 ${index + 1} 未開放，前往開孔`);
          slot.innerHTML = `
            <span class="slot-socket locked">
              ${shipEquipmentSlotFrameMarkup()}
              <span class="slot-item"><span class="slot-lock" aria-hidden="true"></span></span>
            </span>
          `;
        } else if (item) {
          slot.dataset.unequip = String(index);
          slot.title = `孔位 ${index + 1}：${item.name}`;
          slot.setAttribute("aria-label", `孔位 ${index + 1} 已裝備 ${item.name}，點擊卸下`);
          slot.innerHTML = `
            <span class="slot-socket equipped">
              ${shipEquipmentSlotFrameMarkup()}
              <span class="slot-item">${gearSocketMarkup(item)}</span>
            </span>
          `;
        } else {
          slot.dataset.tabJump = "gear";
          slot.title = `孔位 ${index + 1}：空孔位`;
          slot.setAttribute("aria-label", `孔位 ${index + 1} 空孔位，選擇裝備`);
          slot.innerHTML = `
            <span class="slot-socket">
              ${shipEquipmentSlotFrameMarkup()}
              <span class="slot-item">${gearSocketMarkup(null)}</span>
            </span>
          `;
        }
        board.appendChild(slot);
      }
    }

    function renderUpgradeMap() {
      const map = $("#upgradeMap");
      map.innerHTML = "";
      upgrades.forEach((upgrade) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = [
          "ship-callout",
          `pin-${upgrade.id}`,
          state.selectedUpgrade === upgrade.id ? "selected" : "",
          upgrade.level >= upgrade.max ? "complete" : ""
        ].filter(Boolean).join(" ");
        button.dataset.selectUpgrade = upgrade.id;
        button.innerHTML = `
          <img class="ship-callout-frame" src="images/board/water_seven_ui/water_seven_ship_part_marker_frame.webp" alt="" aria-hidden="true">
          <span class="callout-glyph" title="${upgrade.name}"><img src="images/board/ship_info_ui/upgrade_icons/${upgrade.id}.webp" alt="${upgrade.name}"></span>
          <span class="callout-copy">
            <strong>${upgrade.name}</strong>
            <span class="callout-tag">${upgrade.tag}</span>
          </span>
          <span class="callout-level"><span>Lv</span><strong>${upgrade.level} / ${upgrade.max}</strong></span>
        `;
        map.appendChild(button);
      });
    }

    function setLineAnchor(group, point) {
      if (!group || !point) return;
      const line = group.querySelector("line");
      const halo = group.querySelector(".halo");
      const pin = group.querySelector(".pin");
      if (line) {
        if (point.start) {
          line.setAttribute("x1", point.start.x.toFixed(2));
          line.setAttribute("y1", point.start.y.toFixed(2));
        }
        line.setAttribute("x2", point.x.toFixed(2));
        line.setAttribute("y2", point.y.toFixed(2));
      }
      [halo, pin].forEach((circle) => {
        if (!circle) return;
        circle.setAttribute("cx", point.x.toFixed(2));
        circle.setAttribute("cy", point.y.toFixed(2));
      });
    }

    function getShipConfig() {
      return shipConfigs[currentShipId] || shipConfigs.ship_01;
    }

    function setShip(id) {
      if (lockShipSelection && id !== currentShipId) return;
      if (!shipConfigs[id] || id === currentShipId) return;
      currentShipId = id;
      currentShipFocus = "default";
      shipTunePreviewFocus = shipTuneEnabled ? "default" : null;
      currentShipFrameImage = shipConfigs[id].image;
      currentShipTargetImage = shipConfigs[id].image;
      shipTurnToken += 1;
      const img = $("#shipImg");
      if (img) img.src = getShipConfig().image;
      render();
      showToast(`已切換成 ${getShipConfig().name || id}`);
    }

    function anchorsForFocus(config, focus = currentShipFocus) {
      return (config.anchorSets && (config.anchorSets[focus] || config.anchorSets.default)) || config.anchors || {};
    }

    function focusImageForConfig(config, focus) {
      return (config.focusImages && config.focusImages[focus]) || config.image;
    }

    function slotImageForConfig(config) {
      return config.slotImage || focusImageForConfig(config, "default");
    }

    function dockImageForConfig(config, focus) {
      if (state.tab !== "upgrades") return slotImageForConfig(config);
      return focusImageForConfig(config, focus);
    }

    function activeShipTuneFocus(focus = currentShipFocus) {
      return shipTuneEnabled && shipTunePreviewFocus ? shipTunePreviewFocus : focus;
    }

    function isSlotTuneMode() {
      return shipTuneEnabled && state.tab !== "upgrades";
    }

    function isShipPointTuneMode() {
      return shipTuneEnabled && state.tab === "upgrades";
    }

    function currentSlotTune() {
      const config = getShipConfig();
      if (!config.slotTune) config.slotTune = cloneSlotTune();
      return config.slotTune;
    }

    function syncTuneModeClasses() {
      const stage = $("#shipStage");
      const panel = $("#shipTunePanel");
      const slotMode = isSlotTuneMode();
      document.body.classList.toggle("ship-tune-open", shipTuneEnabled);
      if (stage) {
        stage.classList.toggle("tuning", shipTuneEnabled);
        stage.classList.toggle("slot-tuning", slotMode);
      }
      if (panel) {
        panel.classList.toggle("is-open", shipTuneEnabled);
        panel.classList.toggle("slot-tuning", slotMode);
      }
      const title = $("#shipTuneTitle");
      if (title) {
        title.textContent = slotMode ? "F4 孔位校準：拖曳孔位與連線端點" : "F4 校準模式：拖曳船上的點位";
      }
    }

    function shipImageOptions(config) {
      const images = [
        config.image,
        ...(config.turnFrames || []),
        ...Object.values(config.focusImages || {})
      ];
      const seen = new Set();
      return images.filter((src) => {
        if (!src || seen.has(src)) return false;
        seen.add(src);
        return true;
      });
    }

    function shipImageFile(src) {
      return String(src || "").split("/").pop() || "";
    }

    function shipImageLabel(src) {
      return shipImageFile(src)
        .replace(/_cutout\.webp$/i, "")
        .replace(/\.(webp|png)$/i, "")
        .replace(/^ship_\d+_/, "")
        .replace(/_/g, " ");
    }

    function shipTuneFocusesForConfig(config) {
      return shipTuneFocusOrder.filter((id) => {
        const anchors = anchorsForFocus(config, id);
        return anchors && Object.keys(anchors).length;
      });
    }

    function applyShipConfig(config, focus = currentShipFocus) {
      const img = $("#shipImg");
      const layer = $("#shipFocusLayer");
      if (img && !img.getAttribute("src")) img.src = config.image;
      if (layer && config.markerLayer) {
        layer.style.left = `${config.markerLayer.centerX}%`;
        layer.style.top = `${config.markerLayer.centerY}%`;
        layer.style.width = `${config.markerLayer.widthPct}%`;
        layer.style.aspectRatio = `${config.markerLayer.aspectW} / ${config.markerLayer.aspectH}`;
      }
      Object.entries(anchorsForFocus(config, focus)).forEach(([id, point]) => {
        const marker = document.querySelector(`.ship-marker[data-anchor="${id}"]`);
        if (!marker) return;
        marker.style.setProperty("--marker-x", `${point.x}%`);
        marker.style.setProperty("--marker-y", `${point.y}%`);
      });
      refreshShipTuneOutput();
      syncShipLayerControls();
    }

    function formatShipTuneLine(shipId, config, focus) {
      const layer = config.markerLayer || {};
      const parts = Object.entries(anchorsForFocus(config, focus)).map(([id, point]) => {
        return `${id}=${point.x.toFixed(1)}%,${point.y.toFixed(1)}%`;
      });
      const image = shipImageFile(focusImageForConfig(config, focus));
      return `SHIP_TUNE ${shipId} focus=${focus} image=${image} layer=${(layer.centerX || 50).toFixed(1)}%,${(layer.centerY || 46).toFixed(1)}%,${(layer.widthPct || 88).toFixed(1)}% ${parts.join(" ")}`;
    }

    function formatSlotTuneLine(shipId, config) {
      const tune = config.slotTune || cloneSlotTune();
      const parts = tune.anchors.map((anchor, index) => {
        return `slot${index + 1}=${anchor.x.toFixed(1)}%,${anchor.y.toFixed(1)}%->${anchor.targetX.toFixed(1)}%,${anchor.targetY.toFixed(1)}%`;
      });
      return `SLOT_TUNE ${shipId} size=${tune.size.toFixed(1)} ${parts.join(" ")}`;
    }

    function renderShipTuneImagePicker(focus = activeShipTuneFocus()) {
      const list = $("#shipTuneImageList");
      const label = $("#shipTuneImageLabel");
      if (!list || !label) return;
      if (isSlotTuneMode()) {
        label.textContent = "孔位校準";
        list.innerHTML = "";
        return;
      }
      const config = getShipConfig();
      const currentImage = focusImageForConfig(config, focus);
      label.textContent = `${config.name || currentShipId} / ${shipTuneFocusLabels[focus] || focus} / ${shipImageLabel(currentImage)}`;
      list.innerHTML = "";
      shipImageOptions(config).forEach((src) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.shipTuneImage = src;
        button.textContent = shipImageLabel(src);
        button.classList.toggle("active", src === currentImage);
        list.appendChild(button);
      });
    }

    function setShipTuneImage(src) {
      const config = getShipConfig();
      const focus = activeShipTuneFocus();
      if (!src || !shipImageOptions(config).includes(src)) return;
      config.focusImages = config.focusImages || {};
      config.focusImages[focus] = src;
      if (focus === "default") config.image = src;
      if (focus === currentShipFocus) {
        currentShipTargetImage = src;
      }
      renderShipFocus();
      refreshShipTuneOutput(focus);
      showToast(`${config.name || currentShipId} ${shipTuneFocusLabels[focus] || focus} 已改用 ${shipImageLabel(src)}`);
    }

    function refreshShipTuneOutput(focus = currentShipFocus) {
      const output = $("#shipTuneOutput");
      if (!output) return;
      if (isSlotTuneMode()) {
        const slotLines = Object.entries(shipConfigs)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([shipId, config]) => formatSlotTuneLine(shipId, config));
        output.value = slotLines.join("\n");
        const summary = $("#shipTuneSummary");
        if (summary) summary.textContent = `目前調整：${currentShipId} 孔位，已輸出 ${slotLines.length} 艘船孔位資料`;
        refreshShipTuneFocusButtons(focus);
        renderShipTuneImagePicker(focus);
        syncSlotTuneControls();
        return;
      }
      const available = Object.entries(shipConfigs).sort(([a], [b]) => a.localeCompare(b)).flatMap(([shipId, config]) => {
        return shipTuneFocusesForConfig(config).map((id) => formatShipTuneLine(shipId, config, id));
      });
      output.value = available.join("\n");
      const summary = $("#shipTuneSummary");
      if (summary) summary.textContent = `目前調整：${currentShipId} focus=${focus}，已輸出 ${available.length} 組全船隻座標與船圖`;
      refreshShipTuneFocusButtons(focus);
      renderShipTuneImagePicker(focus);
      syncSlotTuneControls();
    }

    function refreshShipTuneFocusButtons(focus = currentShipFocus) {
      document.querySelectorAll("[data-ship-tune-focus]").forEach((button) => {
        button.classList.toggle("active", button.dataset.shipTuneFocus === focus);
      });
    }

    function syncShipLayerControls() {
      const config = getShipConfig();
      const layer = config.markerLayer;
      if (!layer) return;
      const controls = [
        ["shipLayerX", "shipLayerXValue", layer.centerX],
        ["shipLayerY", "shipLayerYValue", layer.centerY],
        ["shipLayerW", "shipLayerWValue", layer.widthPct]
      ];
      controls.forEach(([inputId, valueId, value]) => {
        const input = document.getElementById(inputId);
        const valueEl = document.getElementById(valueId);
        if (input && document.activeElement !== input) input.value = value;
        if (valueEl) valueEl.textContent = `${Number(value).toFixed(1)}%`;
      });
    }

    function syncSlotTuneControls() {
      const input = document.getElementById("slotSocketSize");
      const valueEl = document.getElementById("slotSocketSizeValue");
      const tune = currentSlotTune();
      if (input && document.activeElement !== input) input.value = tune.size;
      if (valueEl) valueEl.textContent = `${tune.size.toFixed(0)}px`;
    }

    function pointFromElement(stageRect, element, fallback) {
      if (!element || !stageRect.width || !stageRect.height) return fallback;
      const rect = element.getBoundingClientRect();
      if (!rect.width && !rect.height) return fallback;
      return {
        x: ((rect.left + rect.width / 2 - stageRect.left) / stageRect.width) * 100,
        y: ((rect.top + rect.height / 2 - stageRect.top) / stageRect.height) * 100
      };
    }

    function fallbackMarkerPoint(marker) {
      if (!marker) return { x: 50, y: 50 };
      const config = getShipConfig();
      const layerConfig = config.markerLayer || { centerX: 50, centerY: 46, widthPct: 88, aspectW: 14, aspectH: 9 };
      const layerCenter = { x: layerConfig.centerX, y: layerConfig.centerY };
      const layerWidthPct = layerConfig.widthPct;
      const layerHeightPct = layerWidthPct * layerConfig.aspectH / layerConfig.aspectW;
      const markerX = Number.parseFloat(marker.style.getPropertyValue("--marker-x")) || 50;
      const markerY = Number.parseFloat(marker.style.getPropertyValue("--marker-y")) || 50;
      return {
        x: layerCenter.x - layerWidthPct / 2 + layerWidthPct * markerX / 100,
        y: layerCenter.y - layerHeightPct / 2 + layerHeightPct * markerY / 100
      };
    }

    function updateUpgradeLineAnchors(selectedUpgrade) {
      const stage = $("#shipStage");
      if (!stage) return null;
      const stageRect = stage.getBoundingClientRect();
      let selectedPoint = null;
      Object.keys(calloutAnchors).forEach((id) => {
        const callout = stage.querySelector(`.pin-${id}`);
        const marker = stage.querySelector(`.ship-marker[data-anchor="${id}"]`);
        const start = pointFromElement(stageRect, callout, calloutAnchors[id]);
        const markerFallback = fallbackMarkerPoint(marker);
        const end = pointFromElement(stageRect, marker, markerFallback);
        const point = { ...end, start };
        setLineAnchor(stage.querySelector(`.link-${id}`), point);
        if (id === selectedUpgrade) selectedPoint = point;
      });
      return selectedPoint;
    }

    function syncUpgradeLineAnchors(selectedUpgrade, duration = 760) {
      const stage = $("#shipStage");
      const start = performance.now();
      const tick = () => {
        const point = updateUpgradeLineAnchors(selectedUpgrade);
        if (stage && point) {
          stage.style.setProperty("--focus-x", `${point.x.toFixed(2)}%`);
          stage.style.setProperty("--focus-y", `${point.y.toFixed(2)}%`);
        }
        if (performance.now() - start < duration) {
          window.requestAnimationFrame(tick);
        }
      };
      tick();
    }

    function toggleShipTune() {
      shipTuneEnabled = !shipTuneEnabled;
      shipTunePreviewFocus = shipTuneEnabled ? currentShipFocus : null;
      syncTuneModeClasses();
      applyShipConfig(getShipConfig());
      renderSlots();
      refreshShipTuneOutput();
      renderShipFocus();
      showToast(shipTuneEnabled ? (isSlotTuneMode() ? "孔位校準已開啟，只調孔位與線端點。" : "船身點位校準已開啟。") : "校準已關閉。");
    }

    function updateShipLayerControl(control, value) {
      const config = getShipConfig();
      if (!config.markerLayer) return;
      config.markerLayer[control] = Number(value);
      applyShipConfig(config);
      refreshShipTuneOutput();
      updateUpgradeLineAnchors(state.selectedUpgrade);
      renderShipFocus();
    }

    function updateSlotSize(value) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return;
      const tune = currentSlotTune();
      tune.size = Math.max(44, Math.min(112, parsed));
      renderSlots();
      refreshShipTuneOutput();
    }

    function slotPointFromEvent(event) {
      const board = $("#slotBoard");
      if (!board) return null;
      const rect = board.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      return {
        x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
        y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
      };
    }

    function updateDraggedShipSlot(event) {
      if (!draggingShipSlot) return;
      const anchor = currentSlotTune().anchors[draggingShipSlot.index];
      const point = slotPointFromEvent(event);
      if (!anchor || !point) return;
      if (draggingShipSlot.kind === "target") {
        anchor.targetX = point.x;
        anchor.targetY = point.y;
      } else {
        anchor.x = point.x;
        anchor.y = point.y;
      }
      renderSlots();
      refreshShipTuneOutput();
    }

    function updateDraggedShipAnchor(event) {
      if (!draggingShipAnchor) return;
      const layer = $("#shipFocusLayer");
      const config = getShipConfig();
      const anchors = anchorsForFocus(config);
      if (!layer || !anchors[draggingShipAnchor]) return;
      const rect = layer.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
      anchors[draggingShipAnchor] = { x, y };
      const marker = document.querySelector(`.ship-marker[data-anchor="${draggingShipAnchor}"]`);
      if (marker) {
        marker.style.setProperty("--marker-x", `${x}%`);
        marker.style.setProperty("--marker-y", `${y}%`);
      }
      refreshShipTuneOutput();
      updateUpgradeLineAnchors(state.selectedUpgrade);
    }

    function parseScale(value) {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    }

    function px(value) {
      return `${Math.round(value)}px`;
    }

    function selectedUpgradeForFocus(focus) {
      if (!isShipPointTuneMode()) return state.selectedUpgrade;
      return {
        sail: "sail",
        watchtower: "watchtower",
        deck: "training",
        kitchen: "kitchen",
        rudder: "rudder"
      }[focus] || state.selectedUpgrade;
    }

    function centeredCameraForFocus(config, focus, camera, selectedUpgrade) {
      if (focus === "default") return camera;
      const layer = $("#shipFocusLayer");
      const stage = $("#shipStage");
      const anchorId = selectedUpgrade;
      const point = anchorsForFocus(config, focus)[anchorId];
      if (!layer || !stage || !point) return camera;

      const scale = parseScale(camera.scale);
      const layerRect = layer.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const layerWidth = layer.offsetWidth || layerRect.width / scale || 1;
      const layerHeight = layer.offsetHeight || layerRect.height / scale || 1;
      const targetOffsetX = (point.x - 50) / 100 * layerWidth * scale;
      const targetOffsetY = (point.y - 50) / 100 * layerHeight * scale;

      // Keep a little room for callouts: center the selected ship part slightly above the visual midpoint.
      const displayOffsetY = stageRect.height * 0.02;
      return {
        ...camera,
        x: px(-targetOffsetX),
        y: px(-targetOffsetY - displayOffsetY),
        focusX: "50%",
        focusY: "48%"
      };
    }

    function imageMatches(src, target) {
      return Boolean(src && target && src.endsWith(target));
    }

    function buildShipTurnSequence(config, targetImage) {
      const frames = config.turnFrames || [config.image];
      const startIndex = frames.findIndex((src) => src === currentShipFrameImage);
      const targetIndex = frames.findIndex((src) => src === targetImage);
      if (targetIndex < 0) {
        const start = startIndex >= 0 ? startIndex : 0;
        const preview = [1, 2, 3].map((step) => frames[(start + step) % frames.length]);
        return [...preview, targetImage].filter(Boolean);
      }
      if (startIndex < 0 || startIndex === targetIndex) return [targetImage];
      const forward = [];
      for (let index = startIndex; index !== targetIndex; index = (index + 1) % frames.length) {
        forward.push(frames[(index + 1) % frames.length]);
      }
      const backward = [];
      for (let index = startIndex; index !== targetIndex; index = (index - 1 + frames.length) % frames.length) {
        backward.push(frames[(index - 1 + frames.length) % frames.length]);
      }
      return forward.length <= backward.length ? forward : backward;
    }

    function finishShipTurn(stage) {
      stage.classList.remove("is-turning");
      updateUpgradeLineAnchors(state.selectedUpgrade);
      syncUpgradeLineAnchors(state.selectedUpgrade, 320);
    }

    function animateShipToImage(img, stage, config, targetImage) {
      const currentSrc = img.getAttribute("src") || "";
      if (currentShipTargetImage === targetImage && imageMatches(currentSrc, targetImage) && !stage.classList.contains("is-turning")) {
        return;
      }
      currentShipTargetImage = targetImage;
      const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (shipTuneEnabled || reducedMotion) {
        img.src = targetImage;
        currentShipFrameImage = targetImage;
        finishShipTurn(stage);
        return;
      }
      shipTurnToken += 1;
      const token = shipTurnToken;
      const sequence = buildShipTurnSequence(config, targetImage);
      const frames = sequence.length ? sequence : [targetImage];
      stage.classList.add("is-turning");
      frames.forEach((src, index) => {
        window.setTimeout(() => {
          if (token !== shipTurnToken) return;
          img.src = src;
          currentShipFrameImage = src;
          if (index === frames.length - 1) {
            window.setTimeout(() => {
              if (token === shipTurnToken) finishShipTurn(stage);
            }, 150);
          }
        }, index * 92);
      });
    }

    function renderShipFocus() {
      const img = $("#shipImg");
      const stage = $("#shipStage");
      if (!img || !stage) return;
      const config = getShipConfig();
      const normalFocus = state.tab === "upgrades" ? (upgradeFocus[state.selectedUpgrade] || "default") : "default";
      const focus = isShipPointTuneMode() && shipTunePreviewFocus ? shipTunePreviewFocus : normalFocus;
      const selectedUpgrade = selectedUpgradeForFocus(focus);
      currentShipFocus = focus;
      applyShipConfig(config, focus);
      const baseCamera = (config.camera && config.camera[focus]) || defaultShipCamera[focus] || defaultShipCamera.default;
      const camera = centeredCameraForFocus(config, focus, baseCamera, selectedUpgrade);
      stage.dataset.focus = focus;
      stage.dataset.selectedUpgrade = (state.tab === "upgrades" || isShipPointTuneMode()) ? selectedUpgrade : "none";
      stage.style.setProperty("--ship-pan-x", camera.x);
      stage.style.setProperty("--ship-pan-y", camera.y);
      stage.style.setProperty("--ship-scale", camera.scale);
      stage.style.setProperty("--ship-tilt", camera.tilt);
      animateShipToImage(img, stage, config, dockImageForConfig(config, focus));
      const selectedPoint = updateUpgradeLineAnchors(selectedUpgrade);
      syncUpgradeLineAnchors(selectedUpgrade);
      stage.style.setProperty("--focus-x", selectedPoint ? `${selectedPoint.x.toFixed(2)}%` : camera.focusX);
      stage.style.setProperty("--focus-y", selectedPoint ? `${selectedPoint.y.toFixed(2)}%` : camera.focusY);
    }

    function renderMaterials() {
      const wrap = $("#materials");
      wrap.innerHTML = "";
      const resources = [
        { name: "貝里", value: formatBerries(state.berries) },
        ...Object.entries(materials).map(([key, name]) => ({
          name,
          value: state.materials[key] || 0
        }))
      ];
      resources.forEach(({ name, value }) => {
        const mat = document.createElement("div");
        mat.className = "mat";
        mat.innerHTML = `<span>${name}</span><strong>${value}</strong>`;
        wrap.appendChild(mat);
      });
    }

    function renderBonuses() {
      const bonuses = [];
      upgrades.forEach((upgrade) => {
        for (let i = 0; i < upgrade.level; i += 1) {
          bonuses.push(upgrade.effects[i]);
        }
      });
      state.equipped.forEach((id) => {
        const item = findGear(id);
        if (item) bonuses.push(`${item.name}：${item.effect}`);
      });
      $("#bonusCount").textContent = `${bonuses.length} 項`;
      const wrap = $("#bonusList");
      wrap.innerHTML = "";
      bonuses.slice(0, 6).forEach((text) => {
        const div = document.createElement("div");
        div.className = "bonus";
        div.textContent = text;
        wrap.appendChild(div);
      });
      if (!bonuses.length) {
        const div = document.createElement("div");
        div.className = "bonus";
        div.textContent = "尚未有船隻效果";
        wrap.appendChild(div);
      }
    }

    function renderTabs() {
      document.querySelectorAll(".tab").forEach((button) => {
        button.classList.toggle("active", button.dataset.tab === state.tab);
      });
      $("#dockPanel").dataset.mode = state.tab;
      const screen = document.querySelector(".screen");
      if (screen) screen.dataset.mode = state.tab;
    }

    function upgradeCard(upgrade) {
      const nextCost = upgrade.level >= upgrade.max ? null : upgrade.costs[upgrade.level];
      const card = document.createElement("article");
      card.className = `list-card${state.selectedUpgrade === upgrade.id ? " selected" : ""}`;
      card.dataset.selectUpgrade = upgrade.id;
      card.innerHTML = `
        <div class="card-head">
          <strong>${upgrade.name}</strong>
          <span class="badge">Lv ${upgrade.level} / ${upgrade.max}</span>
        </div>
        <p>${upgrade.desc}</p>
        <div class="cost-line">
          <span class="cost-pill">${upgrade.tag}</span>
          <span class="cost-pill">${upgrade.level >= upgrade.max ? "已滿級" : costText(nextCost)}</span>
        </div>
      `;
      return card;
    }

    function gearCard(item) {
      const equippedIndex = state.equipped.indexOf(item.id);
      const ownedCount = ownedGearCount(item.id);
      const stateLabel = equippedIndex >= 0 ? `本頁孔位 ${equippedIndex + 1}` : ownedCount > 0 ? "可裝備" : "未持有";
      const card = document.createElement("article");
      card.className = `list-card gear-card${state.selectedGear === item.id ? " selected" : ""}`;
      card.dataset.selectGear = item.id;
      card.innerHTML = `
        <img class="gear-list-frame" src="images/board/water_seven_ui/water_seven_upgrade_effect_row_frame.webp" alt="" aria-hidden="true">
        ${gearThumbMarkup(item)}
        <div class="gear-card-content">
          <div class="card-head">
            <strong>${item.name}</strong>
            <span class="gear-card-kind">${item.kind}</span>
          </div>
          <p>${item.effect}</p>
        </div>
        <div class="gear-card-status">
          <strong class="${item.rank === "S" ? "rank-s" : item.rank === "A" ? "rank-a" : ""}">${item.rank}級</strong>
          <span>持有 ${ownedCount}</span>
          <span>${stateLabel}</span>
        </div>
      `;
      return card;
    }

    function slotOpenCard(index) {
      const unlocked = index < state.slotsUnlocked;
      const isNext = !unlocked && index === state.slotsUnlocked;
      const cost = slotCosts[index];
      const description = unlocked ? "這個孔位已經能裝備船隻道具。" : "開孔後可裝備更多船隻道具，效果套用全隊。";
      const card = document.createElement("article");
      card.className = `slot-progress-card${unlocked ? " is-open" : isNext ? " is-next" : " is-future"}`;
      card.setAttribute("aria-label", `船隻孔位 ${index + 1}，${unlocked ? "已開啟" : "施工"}。${description}${unlocked ? "不需費用" : costText(cost)}`);
      card.innerHTML = `
        <img class="slot-progress-row-frame" src="images/board/water_seven_ui/water_seven_slot_unlock_progress_row_frame.webp" alt="" aria-hidden="true">
        <div class="slot-progress-port" aria-hidden="true">
          <img class="slot-progress-port-frame" src="images/board/water_seven_ui/water_seven_ship_equipment_slot_frame.webp" alt="">
          <span class="slot-progress-port-copy"><strong>${index + 1}</strong><span>孔位</span></span>
        </div>
        <div class="slot-progress-copy">
          <div class="slot-progress-heading">
            <strong>船隻孔位 ${index + 1}</strong>
          </div>
          <div class="slot-progress-cost">${unlocked ? "<span>不需費用</span>" : costPartsMarkup(cost)}</div>
        </div>
        <div class="slot-progress-action-zone">
          <span class="slot-progress-state">${unlocked ? "已開啟" : "施工"}</span>
          <button class="slot-progress-action" type="button" data-open-now="${index}" ${unlocked || !isNext ? "disabled" : ""}>
            <img src="images/board/encounter_ui/encounter_action_button_frame.webp" alt="" aria-hidden="true">
            <span>${unlocked ? "已完成" : "開孔"}</span>
          </button>
        </div>
      `;
      return card;
    }

    function renderWorkList() {
      const list = $("#workList");
      list.innerHTML = "";
      list.classList.toggle("upgrade-list", state.tab === "upgrades");
      if (state.tab === "gear") {
        if (!gear.length) {
          const empty = document.createElement("div");
          empty.className = "empty-note";
          empty.textContent = "目前背包沒有船隻裝備。海格遭遇、寶箱、任務或水之七島商店可取得。";
          list.appendChild(empty);
        } else {
          gear.forEach((item) => list.appendChild(gearCard(item)));
          requestAnimationFrame(() => {
            const selectedCard = list.querySelector(".gear-card.selected");
            if (selectedCard) selectedCard.scrollIntoView({ block: "nearest", inline: "nearest" });
          });
        }
      }
      if (state.tab === "slots") {
        for (let index = 0; index < 4; index += 1) {
          list.appendChild(slotOpenCard(index));
        }
      }
    }

    function renderDetail() {
      const detail = $("#workDetail");
      if (state.tab === "upgrades") {
        const upgrade = findUpgrade(state.selectedUpgrade) || upgrades[0];
        const nextCost = upgrade.level >= upgrade.max ? null : upgrade.costs[upgrade.level];
        detail.innerHTML = `
          <div class="upgrade-detail-heading">
            <h3>${upgrade.name}</h3>
            <span>Lv ${upgrade.level} / ${upgrade.max}</span>
          </div>
          <p class="upgrade-detail-desc">${upgrade.desc}</p>
          <ul class="detail-lines upgrade-effect-list">
            ${upgrade.effects.map((effect, index) => {
              const level = index + 1;
              const active = level <= upgrade.level;
              const next = !active && level === upgrade.level + 1;
              const status = active ? "已啟用" : next ? "下一級" : "未解鎖";
              return `
                <li class="upgrade-effect-row${active ? " is-active" : ""}${next ? " is-next" : ""}">
                  <img class="upgrade-effect-frame" src="images/board/water_seven_ui/water_seven_upgrade_effect_row_frame.webp" alt="" aria-hidden="true">
                  <span class="upgrade-effect-level">Lv ${level}</span>
                  <span class="upgrade-effect-copy">${effect}</span>
                  <span class="upgrade-effect-state">${status}</span>
                </li>
              `;
            }).join("")}
          </ul>
          <div class="upgrade-cost-summary">
            <span>${upgrade.level >= upgrade.max ? "永久升級已完成" : "下一級所需資源"}</span>
            <strong>${upgrade.level >= upgrade.max ? "無需更多材料" : costText(nextCost)}</strong>
          </div>
          <button class="primary-btn" type="button" data-upgrade="${upgrade.id}" ${upgrade.level >= upgrade.max ? "disabled" : ""}>
            <img src="images/board/encounter_ui/encounter_action_button_frame.webp" alt="" aria-hidden="true">
            <span>${upgrade.level >= upgrade.max ? "已滿級" : `升級：${costText(nextCost)}`}</span>
          </button>
        `;
      }
      if (state.tab === "gear") {
        const item = findGear(state.selectedGear) || gear[0];
        if (!item) {
          detail.innerHTML = `
            <h3>船隻裝備</h3>
            <ul class="detail-lines">
              <li>目前沒有可展示的船隻裝備。</li>
              <li>海格遭遇戰、任務與寶箱有機會取得船材或船隻道具。</li>
            </ul>
          `;
          return;
        }
        const equippedIndex = state.equipped.indexOf(item.id);
        const emptyIndex = state.equipped.findIndex((id, index) => !id && index < state.slotsUnlocked);
        const ownedCount = ownedGearCount(item.id);
        detail.innerHTML = `
          <div class="detail-gear-head">
            ${gearThumbMarkup(item)}
            <div class="gear-detail-title">
              <h3>${item.name}</h3>
              <span>${item.rank}級船隻裝備</span>
            </div>
          </div>
          <div class="gear-detail-meta">
            <span>類型：${item.kind}</span>
            <span>持有：${ownedCount}</span>
          </div>
          <p class="gear-detail-effect"><strong>效果：</strong>${item.effect}</p>
          <p class="gear-detail-desc">${item.desc}</p>
          <button class="primary-btn" type="button" data-equip="${item.id}" ${ownedCount <= 0 && equippedIndex < 0 ? "disabled" : ""}>
            <img src="images/board/encounter_ui/encounter_action_button_frame.webp" alt="" aria-hidden="true">
            <span>${ownedCount <= 0 ? "未持有" : equippedIndex >= 0 ? "卸下裝備" : emptyIndex >= 0 ? `裝到孔位 ${emptyIndex + 1}` : "沒有空孔位"}</span>
          </button>
        `;
      }
      if (state.tab === "slots") {
        const nextIndex = state.slotsUnlocked;
        const cost = slotCosts[nextIndex];
        detail.innerHTML = `
          <h3>船隻開孔</h3>
          <ul class="detail-lines">
            <li>船隻裝備是新種類道具，效果會套用全隊。</li>
            <li>目前 ${state.slotsUnlocked} 個孔位，最高 4 個。</li>
            <li>${cost ? `下一孔費用：${costText(cost)}` : "所有孔位已開啟。"}</li>
          </ul>
          <button class="primary-btn" type="button" data-open-next ${!cost ? "disabled" : ""}>
            <img src="images/board/encounter_ui/encounter_action_button_frame.webp" alt="" aria-hidden="true">
            <span>${cost ? "開啟下一孔" : "已全部開啟"}</span>
          </button>
        `;
      }
    }

    function setTab(tab) {
      state.tab = tab;
      if (tab === "upgrades" && !state.selectedUpgrade) state.selectedUpgrade = upgrades[0].id;
      if (tab === "gear" && !state.selectedGear && gear[0]) state.selectedGear = gear[0].id;
      if (shipTuneEnabled) {
        shipTunePreviewFocus = tab === "upgrades" ? currentShipFocus : null;
        syncTuneModeClasses();
      }
      render();
    }

    function upgradeShip(id) {
      if (sendWaterSevenCommand("upgrade", { upgradeId: id })) return;
      const upgrade = findUpgrade(id);
      if (!upgrade || upgrade.level >= upgrade.max) return;
      const cost = upgrade.costs[upgrade.level];
      if (!canAfford(cost)) {
        showToast("材料或貝里不足，先去任務牆或海格事件收船材。");
        return;
      }
      spend(cost);
      upgrade.level += 1;
      showToast(`${upgrade.name} 升到 Lv${upgrade.level}`);
      render();
    }

    function equipGear(id) {
      if (sendWaterSevenCommand("equip-gear", { itemId: id })) return;
      const equippedIndex = state.equipped.indexOf(id);
      if (equippedIndex >= 0) {
        state.equipped[equippedIndex] = null;
        showToast("已卸下船隻裝備。");
        render();
        return;
      }
      if (ownedGearCount(id) <= 0) {
        showToast("背包沒有這件船隻裝備。");
        return;
      }
      const emptyIndex = state.equipped.findIndex((item, index) => !item && index < state.slotsUnlocked);
      if (emptyIndex < 0) {
        showToast("沒有空孔位，先在水之七島開孔。");
        return;
      }
      state.equipped[emptyIndex] = id;
      showToast(`已裝備到孔位 ${emptyIndex + 1}`);
      render();
    }

    function unequipSlot(index) {
      if (sendWaterSevenCommand("unequip-slot", { slotIndex: index })) return;
      state.equipped[index] = null;
      showToast("已卸下船隻裝備。");
      render();
    }

    function openSlot(index) {
      if (sendWaterSevenCommand("open-slot", { slotIndex: index })) return;
      if (index < state.slotsUnlocked) return;
      if (index !== state.slotsUnlocked) {
        showToast("孔位要依序開啟。");
        return;
      }
      const cost = slotCosts[index];
      if (!canAfford(cost)) {
        showToast("開孔材料不足。");
        return;
      }
      spend(cost);
      state.slotsUnlocked += 1;
      showToast(`船隻孔位 ${index + 1} 已開啟`);
      render();
    }

    function render() {
      if (window.TabletopPhoneRenderLifecycle?.begin(document.querySelector(".screen"), "water-seven", [state, currentShipId, currentShipFrameImage, currentShipTargetImage, upgrades, gear]) === false) return;
      renderTop();
      renderTabs();
      renderSlots();
      renderUpgradeMap();
      renderShipFocus();
      renderMaterials();
      renderBonuses();
      renderWorkList();
      renderDetail();
    }

    document.addEventListener("click", (event) => {
      const target = event.target.closest("button, [data-select-upgrade], [data-select-gear]");
      if (!target) return;
      if (target.id === "waterSevenExitBtn") {
        const parentWindow = window.parent && window.parent !== window ? window.parent : null;
        if (state.boardLinked && parentWindow) {
          parentWindow.postMessage({ type: "water-seven-close" }, "*");
        } else {
          showToast("正式遊戲中會由此離開水之七島。");
        }
        return;
      }
      if (target.id === "copyShipTune") {
        const value = $("#shipTuneOutput")?.value || "";
        if (navigator.clipboard && value) {
          navigator.clipboard.writeText(value).catch(() => {});
        }
        showToast(isSlotTuneMode() ? "孔位校準資料已複製。" : "全船隻座標與船圖已複製。");
        return;
      }
      if (shipTuneEnabled && target.dataset.slotTune) return;
      if (target.dataset.shipSelect) {
        setShip(target.dataset.shipSelect);
        return;
      }
      if (target.dataset.shipTuneImage) {
        setShipTuneImage(target.dataset.shipTuneImage);
        return;
      }
      if (target.dataset.shipTuneFocus) {
        shipTunePreviewFocus = target.dataset.shipTuneFocus;
        renderShipFocus();
        refreshShipTuneOutput(shipTunePreviewFocus);
        return;
      }
      if (target.dataset.tab) setTab(target.dataset.tab);
      if (target.dataset.tabJump) setTab(target.dataset.tabJump);
      if (target.dataset.selectUpgrade) {
        state.selectedUpgrade = target.dataset.selectUpgrade;
        render();
      }
      if (target.dataset.selectGear) {
        state.selectedGear = target.dataset.selectGear;
        render();
      }
      if (target.dataset.upgrade) upgradeShip(target.dataset.upgrade);
      if (target.dataset.equip) equipGear(target.dataset.equip);
      if (target.dataset.unequip) unequipSlot(Number(target.dataset.unequip));
      if (target.dataset.openSlot) setTab("slots");
      if (target.dataset.openNow) openSlot(Number(target.dataset.openNow));
      if (target.hasAttribute("data-open-next")) openSlot(state.slotsUnlocked);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "F4") {
        event.preventDefault();
        toggleShipTune();
      }
    });

    document.addEventListener("pointerdown", (event) => {
      const slotTuneTarget = event.target.closest("[data-slot-tune]");
      if (isSlotTuneMode() && slotTuneTarget) {
        draggingShipSlot = {
          index: Number(slotTuneTarget.dataset.slotIndex),
          kind: slotTuneTarget.dataset.slotTune
        };
        updateDraggedShipSlot(event);
        event.preventDefault();
        return;
      }
      const marker = event.target.closest(".ship-marker");
      if (!isShipPointTuneMode() || !marker) return;
      draggingShipAnchor = marker.dataset.anchor;
      updateDraggedShipAnchor(event);
      event.preventDefault();
    });

    document.addEventListener("pointermove", (event) => {
      if (draggingShipSlot) {
        updateDraggedShipSlot(event);
        event.preventDefault();
        return;
      }
      if (!draggingShipAnchor) return;
      updateDraggedShipAnchor(event);
      event.preventDefault();
    });

    document.addEventListener("pointerup", () => {
      draggingShipAnchor = null;
      draggingShipSlot = null;
    });

    document.addEventListener("input", (event) => {
      const input = event.target.closest("[data-ship-layer-control]");
      if (input) {
        updateShipLayerControl(input.dataset.shipLayerControl, input.value);
        return;
      }
      const slotSizeInput = event.target.closest("[data-slot-size-control]");
      if (slotSizeInput) updateSlotSize(slotSizeInput.value);
    });

    $("#paulieImg").addEventListener("error", () => {
      $("#paulieImg").hidden = true;
      $("#paulieFallback").hidden = false;
    });

    window.addEventListener("resize", () => {
      renderShipFocus();
    });

    window.addEventListener("message", (event) => {
      if (event?.data?.type === "board-water-seven-command-result") {
        if (event.data.message) showToast(event.data.message);
        if (event.data.view && applyFormalSnapshot(event.data.view)) render();
        return;
      }
      if (event?.data?.type !== "board-water-seven-update") return;
      if (applyFormalSnapshot()) render();
    });

    window.addEventListener("storage", (event) => {
      if (event.key !== WATER_SEVEN_SNAPSHOT_KEY) return;
      if (applyFormalSnapshot()) render();
    });

    
 const api={state,functions:{normalizeDemoShipId,readWaterSevenSnapshot,normalizeGearEntry,clampLevel,clampSlotCount,applyFormalSnapshot,normalizeCostEntry,applyBoardCosts,cloneSlotTune,costText,costPartsMarkup,canAfford,spend,showToast,sendWaterSevenCommand,equippedGearIds,findGear,ownedGearCount,gearSocketMarkup,gearThumbMarkup,shipEquipmentSlotFrameMarkup,findUpgrade,renderTop,renderSlots,renderUpgradeMap,setLineAnchor,getShipConfig,setShip,anchorsForFocus,focusImageForConfig,slotImageForConfig,dockImageForConfig,activeShipTuneFocus,isSlotTuneMode,isShipPointTuneMode,currentSlotTune,syncTuneModeClasses,shipImageOptions,shipImageFile,shipImageLabel,shipTuneFocusesForConfig,applyShipConfig,formatShipTuneLine,formatSlotTuneLine,renderShipTuneImagePicker,setShipTuneImage,refreshShipTuneOutput,refreshShipTuneFocusButtons,syncShipLayerControls,syncSlotTuneControls,pointFromElement,fallbackMarkerPoint,updateUpgradeLineAnchors,syncUpgradeLineAnchors,toggleShipTune,updateShipLayerControl,updateSlotSize,slotPointFromEvent,updateDraggedShipSlot,updateDraggedShipAnchor,parseScale,px,selectedUpgradeForFocus,centeredCameraForFocus,imageMatches,buildShipTurnSequence,finishShipTurn,animateShipToImage,renderShipFocus,renderMaterials,renderBonuses,renderTabs,upgradeCard,gearCard,slotOpenCard,renderWorkList,renderDetail,setTab,upgradeShip,equipGear,unequipSlot,openSlot,render},get upgrades(){return upgrades;},get gear(){return gear;},get shipId(){return currentShipId;},get shipConfig(){return getShipConfig();},get focus(){return currentShipFocus;},get frameImage(){return currentShipFrameImage;},get targetImage(){return currentShipTargetImage;},start(){render();}};
 if(host.bindGeometry){const bindings=host.bindGeometry(api);for(const key of Object.keys(bindings))if(!['renderShipFocus','syncUpgradeLineAnchors'].includes(key))throw Error('Unreviewed Water Seven presentation binding '+key);if(bindings.renderShipFocus)renderShipFocus=bindings.renderShipFocus;if(bindings.syncUpgradeLineAnchors)syncUpgradeLineAnchors=bindings.syncUpgradeLineAnchors;}
 return api;
};
