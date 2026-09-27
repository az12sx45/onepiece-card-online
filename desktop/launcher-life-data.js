/* Shared authored life content. Numerical preferences are game tuning, not canon rankings.
 * Canon/coverage audit: LIFE_SYSTEM_AUDIT.md and launcher-life-audit/content-audit.md.
 * Actions are complete-figure time sequences; existing static acting poses do not satisfy them. */
(function(root, factory) {
  'use strict';
  const dialogue = typeof module === 'object' && module.exports
    ? require('./launcher-room-dialogue.js') : root.OnePieceRoomDialogue;
  const reserved = typeof module === 'object' && module.exports ? require('./launcher-reserved-crew.js') : root.OnePieceReservedCrew;
  const api = factory(dialogue, reserved);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.OnePieceLifeData = api;
})(typeof globalThis === 'object' ? globalThis : this, function(dialogue, reserved) {
  'use strict';
  const data = {
  "schema": "one-piece-launcher-life-data/1",
  "version": 1,
  "characterKeys": [
    "luffy",
    "zoro",
    "nami",
    "usopp",
    "sanji",
    "chopper",
    "robin",
    "franky",
    "brook",
    "jinbe"
  ],
  "stateKeys": [
    "Idle",
    "Wander",
    "Work",
    "Eat",
    "Rest",
    "Sleep",
    "Train",
    "Socialize",
    "UseFurniture",
    "SpecialAction",
    "EventParticipant"
  ],
  "needDefaults": {
    "energy": 75,
    "hunger": 30,
    "mood": 65,
    "social": 60,
    "workMotivation": 65
  },
  "needBounds": {
    "energy": [
      15,
      100
    ],
    "hunger": [
      0,
      90
    ],
    "mood": [
      25,
      100
    ],
    "social": [
      15,
      100
    ],
    "workMotivation": [
      15,
      100
    ]
  },
  "characters": {
    "luffy": {
      "key": "luffy",
      "itemId": "room-character-luffy",
      "name": "魯夫",
      "traits": [
        "curious",
        "big_appetite",
        "crew_trust",
        "impulsive"
      ],
      "weights": {
        "Idle": 5,
        "Wander": 14,
        "Work": 6,
        "Eat": 18,
        "Rest": 8,
        "Sleep": 10,
        "Train": 13,
        "Socialize": 18,
        "UseFurniture": 5,
        "SpecialAction": 3
      },
      "initialNeeds": {
        "energy": 75,
        "hunger": 30,
        "mood": 65,
        "social": 60,
        "workMotivation": 65
      },
      "needRates": {
        "energy": 0.11,
        "hunger": 0.24,
        "social": 0.0625,
        "workMotivation": 0.102
      },
      "needRateUnit": "per_active_minute",
      "efficiency": {
        "kitchen": 0.4,
        "navigation": 0.55,
        "training": 1.25,
        "workshop": 0.7,
        "medical": 0.55,
        "library": 0.5,
        "helm": 0.6,
        "deck": 1.1,
        "music": 0.75
      },
      "workEfficiency": {
        "kitchen": 0.4,
        "navigation": 0.55,
        "training": 1.25,
        "workshop": 0.7,
        "medical": 0.55,
        "library": 0.5,
        "helm": 0.6,
        "deck": 1.1,
        "music": 0.75
      },
      "schedule": {
        "night": {
          "weights": {
            "Socialize": 1.25,
            "Sleep": 0.8
          }
        },
        "morning": {
          "weights": {
            "Eat": 1.3
          }
        }
      },
      "clips": {
        "Work": "work",
        "Eat": "eat",
        "Rest": "rest",
        "Sleep": "sleep",
        "Train": "train",
        "UseFurniture": "work"
      },
      "voiceGuide": "先掃視，再對有趣的方向有動作；大吃不取代船長的信任。",
      "canonicalSource": "https://one-piece.com/character/luffy/index.html"
    },
    "zoro": {
      "key": "zoro",
      "itemId": "room-character-zoro",
      "name": "索隆",
      "traits": [
        "disciplined",
        "terse",
        "loyal",
        "direction_uncertain"
      ],
      "weights": {
        "Idle": 5,
        "Wander": 7,
        "Work": 8,
        "Eat": 8,
        "Rest": 9,
        "Sleep": 20,
        "Train": 30,
        "Socialize": 6,
        "UseFurniture": 5,
        "SpecialAction": 2
      },
      "initialNeeds": {
        "energy": 75,
        "hunger": 30,
        "mood": 65,
        "social": 60,
        "workMotivation": 65
      },
      "needRates": {
        "energy": 0.105,
        "hunger": 0.165,
        "social": 0.035,
        "workMotivation": 0.132
      },
      "needRateUnit": "per_active_minute",
      "efficiency": {
        "kitchen": 0.65,
        "navigation": 0.45,
        "training": 1.5,
        "workshop": 0.9,
        "medical": 0.65,
        "library": 0.6,
        "helm": 0.6,
        "deck": 1.15,
        "music": 0.7
      },
      "workEfficiency": {
        "kitchen": 0.65,
        "navigation": 0.45,
        "training": 1.5,
        "workshop": 0.9,
        "medical": 0.65,
        "library": 0.6,
        "helm": 0.6,
        "deck": 1.15,
        "music": 0.7
      },
      "schedule": {
        "day": {
          "weights": {
            "Train": 1.35,
            "Sleep": 1.3
          }
        },
        "night": {
          "weights": {
            "Train": 1.4
          }
        }
      },
      "clips": {
        "Work": "work",
        "Eat": "eat",
        "Rest": "rest",
        "Sleep": "sleep",
        "Train": "train",
        "UseFurniture": "work"
      },
      "voiceGuide": "練習與守望優先；迷路只造成一次可恢復繞路，不破導航。",
      "canonicalSource": "https://one-piece.com/character/zoro/index.html"
    },
    "nami": {
      "key": "nami",
      "itemId": "room-character-nami",
      "name": "娜美",
      "traits": [
        "weather_reader",
        "planner",
        "cost_aware",
        "low_chaos_tolerance"
      ],
      "weights": {
        "Idle": 5,
        "Wander": 7,
        "Work": 22,
        "Eat": 8,
        "Rest": 10,
        "Sleep": 10,
        "Train": 5,
        "Socialize": 12,
        "UseFurniture": 18,
        "SpecialAction": 3
      },
      "initialNeeds": {
        "energy": 75,
        "hunger": 30,
        "mood": 65,
        "social": 60,
        "workMotivation": 65
      },
      "needRates": {
        "energy": 0.095,
        "hunger": 0.15,
        "social": 0.0425,
        "workMotivation": 0.132
      },
      "needRateUnit": "per_active_minute",
      "efficiency": {
        "kitchen": 0.85,
        "navigation": 1.5,
        "training": 0.8,
        "workshop": 0.9,
        "medical": 0.9,
        "library": 1.15,
        "helm": 1.1,
        "deck": 1.0,
        "music": 0.85
      },
      "workEfficiency": {
        "kitchen": 0.85,
        "navigation": 1.5,
        "training": 0.8,
        "workshop": 0.9,
        "medical": 0.9,
        "library": 1.15,
        "helm": 1.1,
        "deck": 1.0,
        "music": 0.85
      },
      "schedule": {
        "morning": {
          "weights": {
            "Work": 1.25
          }
        },
        "evening": {
          "weights": {
            "UseFurniture": 1.2
          }
        }
      },
      "clips": {
        "Work": "work",
        "Eat": "eat",
        "Rest": "rest",
        "Sleep": "sleep",
        "Train": "train",
        "UseFurniture": "read"
      },
      "voiceGuide": "從天候、海圖到橘子樹；不是每次都談錢。",
      "canonicalSource": "https://one-piece.com/character/nami/index.html"
    },
    "usopp": {
      "key": "usopp",
      "itemId": "room-character-usopp",
      "name": "騙人布",
      "traits": [
        "inventive",
        "storyteller",
        "cautious",
        "brave_when_needed"
      ],
      "weights": {
        "Idle": 5,
        "Wander": 10,
        "Work": 18,
        "Eat": 9,
        "Rest": 10,
        "Sleep": 10,
        "Train": 13,
        "Socialize": 15,
        "UseFurniture": 8,
        "SpecialAction": 2
      },
      "initialNeeds": {
        "energy": 75,
        "hunger": 30,
        "mood": 65,
        "social": 60,
        "workMotivation": 65
      },
      "needRates": {
        "energy": 0.1,
        "hunger": 0.165,
        "social": 0.06,
        "workMotivation": 0.12
      },
      "needRateUnit": "per_active_minute",
      "efficiency": {
        "kitchen": 0.85,
        "navigation": 1.0,
        "training": 1.1,
        "workshop": 1.35,
        "medical": 0.9,
        "library": 1.05,
        "helm": 0.85,
        "deck": 1.1,
        "music": 1.0
      },
      "workEfficiency": {
        "kitchen": 0.85,
        "navigation": 1.0,
        "training": 1.1,
        "workshop": 1.35,
        "medical": 0.9,
        "library": 1.05,
        "helm": 0.85,
        "deck": 1.1,
        "music": 1.0
      },
      "schedule": {
        "day": {
          "weights": {
            "Work": 1.2
          }
        },
        "evening": {
          "weights": {
            "Socialize": 1.3
          }
        }
      },
      "clips": {
        "Work": "work",
        "Eat": "eat",
        "Rest": "rest",
        "Sleep": "sleep",
        "Train": "train",
        "UseFurniture": "work"
      },
      "voiceGuide": "真手藝有可見成果；吹牛只是少量社交分支。",
      "canonicalSource": "https://one-piece.com/character/usopp/index.html"
    },
    "sanji": {
      "key": "sanji",
      "itemId": "room-character-sanji",
      "name": "香吉士",
      "traits": [
        "chef",
        "food_respect",
        "service",
        "hands_for_cooking"
      ],
      "weights": {
        "Idle": 4,
        "Wander": 6,
        "Work": 30,
        "Eat": 10,
        "Rest": 8,
        "Sleep": 9,
        "Train": 11,
        "Socialize": 11,
        "UseFurniture": 9,
        "SpecialAction": 2
      },
      "initialNeeds": {
        "energy": 75,
        "hunger": 30,
        "mood": 65,
        "social": 60,
        "workMotivation": 65
      },
      "needRates": {
        "energy": 0.105,
        "hunger": 0.15,
        "social": 0.0525,
        "workMotivation": 0.138
      },
      "needRateUnit": "per_active_minute",
      "efficiency": {
        "kitchen": 1.5,
        "navigation": 1.0,
        "training": 1.2,
        "workshop": 0.85,
        "medical": 1.0,
        "library": 0.9,
        "helm": 0.85,
        "deck": 1.1,
        "music": 1.0
      },
      "workEfficiency": {
        "kitchen": 1.5,
        "navigation": 1.0,
        "training": 1.2,
        "workshop": 0.85,
        "medical": 1.0,
        "library": 0.9,
        "helm": 0.85,
        "deck": 1.1,
        "music": 1.0
      },
      "schedule": {
        "morning": {
          "weights": {
            "Work": 1.3
          }
        },
        "evening": {
          "weights": {
            "Work": 1.25
          }
        }
      },
      "clips": {
        "Work": "work",
        "Eat": "eat",
        "Rest": "rest",
        "Sleep": "sleep",
        "Train": "train",
        "UseFurniture": "work"
      },
      "voiceGuide": "做飯、整理与照顧；熱情不能取消廚師能力。",
      "canonicalSource": "https://one-piece.com/character/sanji/index.html"
    },
    "chopper": {
      "key": "chopper",
      "itemId": "room-character-chopper",
      "name": "喬巴",
      "traits": [
        "doctor",
        "curious",
        "sincere",
        "praise_shy"
      ],
      "weights": {
        "Idle": 5,
        "Wander": 8,
        "Work": 22,
        "Eat": 9,
        "Rest": 10,
        "Sleep": 11,
        "Train": 9,
        "Socialize": 14,
        "UseFurniture": 10,
        "SpecialAction": 2
      },
      "initialNeeds": {
        "energy": 75,
        "hunger": 30,
        "mood": 65,
        "social": 60,
        "workMotivation": 65
      },
      "needRates": {
        "energy": 0.1,
        "hunger": 0.1575,
        "social": 0.06,
        "workMotivation": 0.126
      },
      "needRateUnit": "per_active_minute",
      "efficiency": {
        "kitchen": 0.9,
        "navigation": 0.85,
        "training": 0.9,
        "workshop": 0.75,
        "medical": 1.5,
        "library": 1.3,
        "helm": 0.7,
        "deck": 0.85,
        "music": 0.9
      },
      "workEfficiency": {
        "kitchen": 0.9,
        "navigation": 0.85,
        "training": 0.9,
        "workshop": 0.75,
        "medical": 1.5,
        "library": 1.3,
        "helm": 0.7,
        "deck": 0.85,
        "music": 0.9
      },
      "schedule": {
        "day": {
          "weights": {
            "UseFurniture": 1.2
          }
        },
        "evening": {
          "weights": {
            "Socialize": 1.15
          }
        }
      },
      "clips": {
        "Work": "work",
        "Eat": "eat",
        "Rest": "rest",
        "Sleep": "sleep",
        "Train": "train",
        "UseFurniture": "read"
      },
      "voiceGuide": "能做醫療判斷；不能當寵物或所有時候都只吃糖。",
      "canonicalSource": "https://one-piece.com/character/chopper/index.html"
    },
    "robin": {
      "key": "robin",
      "itemId": "room-character-robin",
      "name": "羅賓",
      "traits": [
        "scholar",
        "observant",
        "quiet_humor",
        "history_care"
      ],
      "weights": {
        "Idle": 7,
        "Wander": 7,
        "Work": 22,
        "Eat": 7,
        "Rest": 11,
        "Sleep": 12,
        "Train": 6,
        "Socialize": 9,
        "UseFurniture": 17,
        "SpecialAction": 2
      },
      "initialNeeds": {
        "energy": 75,
        "hunger": 30,
        "mood": 65,
        "social": 60,
        "workMotivation": 65
      },
      "needRates": {
        "energy": 0.09,
        "hunger": 0.135,
        "social": 0.0375,
        "workMotivation": 0.132
      },
      "needRateUnit": "per_active_minute",
      "efficiency": {
        "kitchen": 1.0,
        "navigation": 1.15,
        "training": 0.9,
        "workshop": 0.95,
        "medical": 1.0,
        "library": 1.5,
        "helm": 1.0,
        "deck": 1.0,
        "music": 0.95
      },
      "workEfficiency": {
        "kitchen": 1.0,
        "navigation": 1.15,
        "training": 0.9,
        "workshop": 0.95,
        "medical": 1.0,
        "library": 1.5,
        "helm": 1.0,
        "deck": 1.0,
        "music": 0.95
      },
      "schedule": {
        "night": {
          "weights": {
            "UseFurniture": 1.4,
            "Work": 1.25
          }
        }
      },
      "clips": {
        "Work": "work",
        "Eat": "eat",
        "Rest": "rest",
        "Sleep": "sleep",
        "Train": "train",
        "UseFurniture": "read"
      },
      "voiceGuide": "記錄、閱讀與觀察；不把所有話變鬼故事。",
      "canonicalSource": "https://one-piece.com/character/robin/index.html"
    },
    "franky": {
      "key": "franky",
      "itemId": "room-character-franky",
      "name": "佛朗基",
      "traits": [
        "shipwright",
        "showmanship",
        "sentimental",
        "craft_pride"
      ],
      "weights": {
        "Idle": 4,
        "Wander": 8,
        "Work": 30,
        "Eat": 9,
        "Rest": 8,
        "Sleep": 9,
        "Train": 10,
        "Socialize": 10,
        "UseFurniture": 9,
        "SpecialAction": 3
      },
      "initialNeeds": {
        "energy": 75,
        "hunger": 30,
        "mood": 65,
        "social": 60,
        "workMotivation": 65
      },
      "needRates": {
        "energy": 0.105,
        "hunger": 0.1725,
        "social": 0.05,
        "workMotivation": 0.138
      },
      "needRateUnit": "per_active_minute",
      "efficiency": {
        "kitchen": 0.8,
        "navigation": 1.0,
        "training": 1.15,
        "workshop": 1.5,
        "medical": 0.85,
        "library": 1.0,
        "helm": 1.2,
        "deck": 1.25,
        "music": 1.1
      },
      "workEfficiency": {
        "kitchen": 0.8,
        "navigation": 1.0,
        "training": 1.15,
        "workshop": 1.5,
        "medical": 0.85,
        "library": 1.0,
        "helm": 1.2,
        "deck": 1.25,
        "music": 1.1
      },
      "schedule": {
        "day": {
          "weights": {
            "Work": 1.35
          }
        },
        "evening": {
          "weights": {
            "UseFurniture": 1.2
          }
        }
      },
      "clips": {
        "Work": "work",
        "Eat": "eat",
        "Rest": "rest",
        "Sleep": "sleep",
        "Train": "train",
        "UseFurniture": "work"
      },
      "voiceGuide": "工具成果、船的回饋與浪漫並存；不每次加炮。",
      "canonicalSource": "https://one-piece.com/character/franky/index.html"
    },
    "brook": {
      "key": "brook",
      "itemId": "room-character-brook",
      "name": "布魯克",
      "traits": [
        "musician",
        "polite",
        "playful",
        "cherishes_company"
      ],
      "weights": {
        "Idle": 6,
        "Wander": 7,
        "Work": 16,
        "Eat": 8,
        "Rest": 11,
        "Sleep": 10,
        "Train": 7,
        "Socialize": 19,
        "UseFurniture": 13,
        "SpecialAction": 3
      },
      "initialNeeds": {
        "energy": 75,
        "hunger": 30,
        "mood": 65,
        "social": 60,
        "workMotivation": 65
      },
      "needRates": {
        "energy": 0.09,
        "hunger": 0.135,
        "social": 0.06,
        "workMotivation": 0.12
      },
      "needRateUnit": "per_active_minute",
      "efficiency": {
        "kitchen": 0.85,
        "navigation": 0.95,
        "training": 1.15,
        "workshop": 0.9,
        "medical": 0.8,
        "library": 1.15,
        "helm": 0.9,
        "deck": 0.95,
        "music": 1.5
      },
      "workEfficiency": {
        "kitchen": 0.85,
        "navigation": 0.95,
        "training": 1.15,
        "workshop": 0.9,
        "medical": 0.8,
        "library": 1.15,
        "helm": 0.9,
        "deck": 0.95,
        "music": 1.5
      },
      "schedule": {
        "evening": {
          "weights": {
            "Socialize": 1.3,
            "UseFurniture": 1.3
          }
        },
        "night": {
          "weights": {
            "UseFurniture": 1.2
          }
        }
      },
      "clips": {
        "Work": "work",
        "Eat": "eat",
        "Rest": "rest",
        "Sleep": "sleep",
        "Train": "train",
        "UseFurniture": "work"
      },
      "voiceGuide": "音樂與日常陪伴；骨頭笑話不超同角色台詞池20%。",
      "canonicalSource": "https://one-piece.com/character/brook/index.html"
    },
    "jinbe": {
      "key": "jinbe",
      "itemId": "room-character-jinbe",
      "name": "甚平",
      "traits": [
        "helmsman",
        "steadfast",
        "measured",
        "crew_duty"
      ],
      "weights": {
        "Idle": 6,
        "Wander": 8,
        "Work": 22,
        "Eat": 8,
        "Rest": 11,
        "Sleep": 12,
        "Train": 14,
        "Socialize": 9,
        "UseFurniture": 8,
        "SpecialAction": 2
      },
      "initialNeeds": {
        "energy": 75,
        "hunger": 30,
        "mood": 65,
        "social": 60,
        "workMotivation": 65
      },
      "needRates": {
        "energy": 0.09,
        "hunger": 0.15,
        "social": 0.045,
        "workMotivation": 0.132
      },
      "needRateUnit": "per_active_minute",
      "efficiency": {
        "kitchen": 1.0,
        "navigation": 1.3,
        "training": 1.35,
        "workshop": 1.1,
        "medical": 0.95,
        "library": 1.1,
        "helm": 1.5,
        "deck": 1.2,
        "music": 1.05
      },
      "workEfficiency": {
        "kitchen": 1.0,
        "navigation": 1.3,
        "training": 1.35,
        "workshop": 1.1,
        "medical": 0.95,
        "library": 1.1,
        "helm": 1.5,
        "deck": 1.2,
        "music": 1.05
      },
      "schedule": {
        "morning": {
          "weights": {
            "Train": 1.2
          }
        },
        "night": {
          "weights": {
            "Work": 1.25,
            "Sleep": 0.85
          }
        }
      },
      "clips": {
        "Work": "work",
        "Eat": "eat",
        "Rest": "rest",
        "Sleep": "sleep",
        "Train": "train",
        "UseFurniture": "work"
      },
      "voiceGuide": "沉穩操舵與分工；不是每句人生說教。",
      "canonicalSource": "https://one-piece.com/character/Jinbe/index.html"
    }
  },
  "relationships": {
    "luffy:zoro": {
      "familiarity": 95,
      "friendship": 93,
      "rivalry": 25,
      "respect": 96,
      "voiceGuide": "不用反覆確認的信任。魯夫先行動，索隆嫌他吵卻會跟上；索隆認真時，魯夫不打斷也不說教。",
      "seedIsGameTuning": true
    },
    "luffy:nami": {
      "familiarity": 93,
      "friendship": 89,
      "rivalry": 12,
      "respect": 93,
      "voiceGuide": "航線交給娜美、冒險衝動留給魯夫。娜美的火氣來自收拾爛攤子，信任不需要變成順從的小孩。",
      "seedIsGameTuning": true
    },
    "luffy:usopp": {
      "familiarity": 95,
      "friendship": 94,
      "rivalry": 25,
      "respect": 84,
      "voiceGuide": "兩個玩伴能把小玩意講成大冒險。魯夫真心驚嘆，騙人布順勢吹大；需要手藝時則信得毫不猶豫。",
      "seedIsGameTuning": true
    },
    "luffy:sanji": {
      "familiarity": 91,
      "friendship": 90,
      "rivalry": 15,
      "respect": 93,
      "voiceGuide": "魯夫用吃光表達認可，香吉士用罵聲守住廚房；廚師知道餓肚子的分量，船長也不懷疑他的本事。",
      "seedIsGameTuning": true
    },
    "chopper:luffy": {
      "familiarity": 92,
      "friendship": 93,
      "rivalry": 10,
      "respect": 89,
      "voiceGuide": "一起對稀奇事興奮，卻不抹掉船醫的地位；喬巴能對船長發脾氣，魯夫相信他而非把他當寵物。",
      "seedIsGameTuning": true
    },
    "luffy:robin": {
      "familiarity": 86,
      "friendship": 86,
      "rivalry": 5,
      "respect": 90,
      "voiceGuide": "羅賓不把魯夫的奇想都糾正成常識；魯夫不懂考古卻在乎她想看什麼，兩人的信任可以很短。",
      "seedIsGameTuning": true
    },
    "franky:luffy": {
      "familiarity": 88,
      "friendship": 91,
      "rivalry": 18,
      "respect": 90,
      "voiceGuide": "船長的毫無保留驚嘆正中船匠的浪漫。佛朗基可以陪著胡鬧，但碰到船就有自己的堅持。",
      "seedIsGameTuning": true
    },
    "brook:luffy": {
      "familiarity": 87,
      "friendship": 90,
      "rivalry": 8,
      "respect": 87,
      "voiceGuide": "魯夫對音樂與骷髏都坦率好奇；布魯克可以接荒唐話，日常的邀請比反覆感傷更能呈現珍惜。",
      "seedIsGameTuning": true
    },
    "jinbe:luffy": {
      "familiarity": 82,
      "friendship": 89,
      "rivalry": 5,
      "respect": 95,
      "voiceGuide": "魯夫把甚平當能一起玩的可靠夥伴，甚平尊重船長又能拉住危險；不要全寫成父親訓小孩。",
      "seedIsGameTuning": true
    },
    "nami:zoro": {
      "familiarity": 89,
      "friendship": 79,
      "rivalry": 22,
      "respect": 84,
      "voiceGuide": "娜美直接使喚，索隆嘴上嫌麻煩卻做得快；方向笑點有上限，也保留航海士與戰鬥員各司其職。",
      "seedIsGameTuning": true
    },
    "usopp:zoro": {
      "familiarity": 88,
      "friendship": 83,
      "rivalry": 18,
      "respect": 84,
      "voiceGuide": "索隆不配合浮誇演說，也不否定真正的技術；騙人布怕他莽撞，必要時敢大聲阻止。",
      "seedIsGameTuning": true
    },
    "sanji:zoro": {
      "familiarity": 94,
      "friendship": 82,
      "rivalry": 85,
      "respect": 92,
      "voiceGuide": "互嗆、競爭、默契並存。照顧藏在實物與行動裡，不互相溫柔稱讚，也不是認真憎恨。",
      "seedIsGameTuning": true
    },
    "chopper:zoro": {
      "familiarity": 90,
      "friendship": 90,
      "rivalry": 8,
      "respect": 92,
      "voiceGuide": "寡言的劍士會給喬巴依靠；船醫遇到逞強立刻嚴厲。索隆承認醫囑但不是每次都乖得毫無摩擦。",
      "seedIsGameTuning": true
    },
    "robin:zoro": {
      "familiarity": 82,
      "friendship": 79,
      "rivalry": 7,
      "respect": 87,
      "voiceGuide": "兩人容得下安靜，羅賓的輕描淡寫與索隆的直線反應形成反差；不把默契硬寫成曖昧。",
      "seedIsGameTuning": true
    },
    "franky:zoro": {
      "familiarity": 81,
      "friendship": 81,
      "rivalry": 17,
      "respect": 88,
      "voiceGuide": "索隆只談用途，佛朗基堅持用途之外也要帥。戰士的重量與船匠的地板形成具體衝突。",
      "seedIsGameTuning": true
    },
    "brook:zoro": {
      "familiarity": 82,
      "friendship": 82,
      "rivalry": 32,
      "respect": 91,
      "voiceGuide": "尊重彼此劍術，說話節奏卻相反。布魯克用禮貌包住玩笑，索隆只留下必要的肯定。",
      "seedIsGameTuning": true
    },
    "jinbe:zoro": {
      "familiarity": 77,
      "friendship": 81,
      "rivalry": 23,
      "respect": 92,
      "voiceGuide": "兩人以實際判斷交換信任；甚平有經驗但不擺師父架子，索隆會觀察技術也敢坦白要求。",
      "seedIsGameTuning": true
    },
    "nami:usopp": {
      "familiarity": 92,
      "friendship": 88,
      "rivalry": 20,
      "respect": 90,
      "voiceGuide": "會一起怕，也能一起想辦法。娜美看穿吹牛卻真心依賴騙人布的發明，兩人都不是只會躲的背景。",
      "seedIsGameTuning": true
    },
    "nami:sanji": {
      "familiarity": 91,
      "friendship": 85,
      "rivalry": 13,
      "respect": 90,
      "voiceGuide": "香吉士見娜美會明顯變軟、變熱情；娜美懂得差遣也會真心道謝，不把她寫成只懂佔便宜。",
      "seedIsGameTuning": true
    },
    "chopper:nami": {
      "familiarity": 91,
      "friendship": 90,
      "rivalry": 5,
      "respect": 91,
      "voiceGuide": "娜美會護著喬巴，也會被醫生訓；喬巴不是拿甜食就能打發的小寵物，而是能作決定的夥伴。",
      "seedIsGameTuning": true
    },
    "nami:robin": {
      "familiarity": 91,
      "friendship": 91,
      "rivalry": 5,
      "respect": 94,
      "voiceGuide": "兩個女性夥伴有自己的興趣與鬆弛日常。娜美能吐槽羅賓的陰暗想像，羅賓會逗她而非總當老師。",
      "seedIsGameTuning": true
    },
    "franky:nami": {
      "familiarity": 85,
      "friendship": 82,
      "rivalry": 18,
      "respect": 92,
      "voiceGuide": "實用、預算對上船匠的浪漫，不是永遠否決。娜美看見維修成果，佛朗基能接受具體限制。",
      "seedIsGameTuning": true
    },
    "brook:nami": {
      "familiarity": 84,
      "friendship": 81,
      "rivalry": 10,
      "respect": 85,
      "voiceGuide": "娜美直截了當劃界線，布魯克禮貌接住而不糾纏；音樂能改變日常氣氛，並非只剩失禮笑話。",
      "seedIsGameTuning": true
    },
    "jinbe:nami": {
      "familiarity": 79,
      "friendship": 84,
      "rivalry": 5,
      "respect": 96,
      "voiceGuide": "航海士判讀，掌舵手落實，兩人也會彼此修正與肯定；專業交接用明確訊號，不泛講人生道理。",
      "seedIsGameTuning": true
    },
    "sanji:usopp": {
      "familiarity": 88,
      "friendship": 85,
      "rivalry": 15,
      "respect": 87,
      "voiceGuide": "香吉士能拆穿空話，卻尊重騙人布真正做得到的事；關心藏在端飯和留面子，非訓話式鼓勵。",
      "seedIsGameTuning": true
    },
    "chopper:usopp": {
      "familiarity": 94,
      "friendship": 94,
      "rivalry": 10,
      "respect": 84,
      "voiceGuide": "崇拜會把騙人布的牛越吹越大，醫學卻是喬巴的主場；保留玩伴關係，不讓其中一人永遠是傻瓜。",
      "seedIsGameTuning": true
    },
    "robin:usopp": {
      "familiarity": 84,
      "friendship": 84,
      "rivalry": 7,
      "respect": 90,
      "voiceGuide": "騙人布的虛張聲勢遇上羅賓平靜補刀；她也看得見細工和想像力，不能每場都只把他嚇哭。",
      "seedIsGameTuning": true
    },
    "franky:usopp": {
      "familiarity": 91,
      "friendship": 91,
      "rivalry": 34,
      "respect": 94,
      "voiceGuide": "共同熱愛手藝但尺度不同。佛朗基有船匠權威，仍讓騙人布保留自己的發明、判斷與成就感。",
      "seedIsGameTuning": true
    },
    "brook:usopp": {
      "familiarity": 86,
      "friendship": 87,
      "rivalry": 18,
      "respect": 84,
      "voiceGuide": "吹牛的敘事與配樂能彼此抬轎，也能當場穿幫。騙人布怕骷髏氣氛，布魯克自己也怕可怕的事。",
      "seedIsGameTuning": true
    },
    "jinbe:usopp": {
      "familiarity": 76,
      "friendship": 81,
      "rivalry": 7,
      "respect": 91,
      "voiceGuide": "甚平有時把誇口當真，使騙人布得自己找台階；真正遇到害怕時，給他可做的事而非抽象打氣。",
      "seedIsGameTuning": true
    },
    "chopper:sanji": {
      "familiarity": 90,
      "friendship": 90,
      "rivalry": 5,
      "respect": 93,
      "voiceGuide": "廚師和醫師一起照料全船，也管彼此逞強。甜食笑點之外保留喬巴的專業，不拿他當寵物餵。",
      "seedIsGameTuning": true
    },
    "robin:sanji": {
      "familiarity": 89,
      "friendship": 85,
      "rivalry": 4,
      "respect": 91,
      "voiceGuide": "香吉士熱情獻殷勤，羅賓平靜接話偶爾故意偏題；她的回應是同伴信任，不暗示已成戀人。",
      "seedIsGameTuning": true
    },
    "franky:sanji": {
      "familiarity": 85,
      "friendship": 83,
      "rivalry": 23,
      "respect": 90,
      "voiceGuide": "兩個職人都挑剔手感和成品，能嫌對方亂來也肯互相配合；佛朗基的可樂不取代所有食物。",
      "seedIsGameTuning": true
    },
    "brook:sanji": {
      "familiarity": 85,
      "friendship": 85,
      "rivalry": 13,
      "respect": 86,
      "voiceGuide": "廚師和音樂家一起把宴會做起來；香吉士直接吐槽，布魯克用禮貌和小笑話接回，不每句提骨頭。",
      "seedIsGameTuning": true
    },
    "jinbe:sanji": {
      "familiarity": 79,
      "friendship": 84,
      "rivalry": 10,
      "respect": 93,
      "voiceGuide": "兩個習慣先照顧旁人的人互相拉到餐桌前；平實、有笑意，不連續敬語推辭或泛談責任。",
      "seedIsGameTuning": true
    },
    "chopper:robin": {
      "familiarity": 92,
      "friendship": 93,
      "rivalry": 3,
      "respect": 94,
      "voiceGuide": "羅賓喜歡喬巴的小心思但尊重醫師判斷；喬巴主動關心她。冷幽默會收住，不把他一直嚇著。",
      "seedIsGameTuning": true
    },
    "chopper:franky": {
      "familiarity": 87,
      "friendship": 88,
      "rivalry": 10,
      "respect": 89,
      "voiceGuide": "喬巴對機械是真心崇拜，也會用醫師眼光發問；佛朗基享受觀眾，卻願意為小醫生解決具體麻煩。",
      "seedIsGameTuning": true
    },
    "brook:chopper": {
      "familiarity": 85,
      "friendship": 87,
      "rivalry": 5,
      "respect": 86,
      "voiceGuide": "醫生認真看待骷髏的特殊身體，音樂家不嘲弄那份認真；玩笑與安靜陪伴都能成立。",
      "seedIsGameTuning": true
    },
    "chopper:jinbe": {
      "familiarity": 79,
      "friendship": 85,
      "rivalry": 4,
      "respect": 91,
      "voiceGuide": "甚平把喬巴當醫師，喬巴對陌生身體求知而不亂下結論；體型不同不等於大人哄小孩。",
      "seedIsGameTuning": true
    },
    "franky:robin": {
      "familiarity": 88,
      "friendship": 88,
      "rivalry": 8,
      "respect": 94,
      "voiceGuide": "考古學家在意物件留下的痕跡，船匠在意如何留得住。語氣冷暖相反但平等，不捏造官方戀情。",
      "seedIsGameTuning": true
    },
    "brook:robin": {
      "familiarity": 86,
      "friendship": 86,
      "rivalry": 5,
      "respect": 90,
      "voiceGuide": "能談舊歌與記錄，也能接住荒誕的黑色幽默；相處不用每場揭開悲劇或互相療癒。",
      "seedIsGameTuning": true
    },
    "jinbe:robin": {
      "familiarity": 78,
      "friendship": 83,
      "rivalry": 4,
      "respect": 92,
      "voiceGuide": "學者的記錄與掌舵手的親身經驗相互補足；兩人都有幽默，不把每句話寫成沉重人生格言。",
      "seedIsGameTuning": true
    },
    "brook:franky": {
      "familiarity": 86,
      "friendship": 87,
      "rivalry": 20,
      "respect": 90,
      "voiceGuide": "船匠替音樂家造能用的東西，音樂家替船匠的張揚配拍；也尊重老物件，不固定成大聲與小聲之爭。",
      "seedIsGameTuning": true
    },
    "franky:jinbe": {
      "familiarity": 79,
      "friendship": 85,
      "rivalry": 10,
      "respect": 95,
      "voiceGuide": "造船的人與操船的人能聽懂同一個細節。佛朗基驕傲，甚平給準確回饋，尊重不靠長篇致詞。",
      "seedIsGameTuning": true
    },
    "brook:jinbe": {
      "familiarity": 77,
      "friendship": 83,
      "rivalry": 4,
      "respect": 90,
      "voiceGuide": "兩個閱歷深的夥伴也能輕鬆開玩笑、聽歌喝茶；避免每場都用孤獨或人生大道理收尾。",
      "seedIsGameTuning": true
    }
  },
  "directives": {
    "free_day": {
      "id": "free_day",
      "label": "自由日",
      "weights": {
        "Work": 0.65,
        "Wander": 1.2,
        "Socialize": 1.35,
        "UseFurniture": 1.2
      },
      "stationWeights": {},
      "availableInAllPhases": true
    },
    "training_day": {
      "id": "training_day",
      "label": "訓練日",
      "weights": {
        "Train": 1.75,
        "Eat": 1.15,
        "Rest": 1.15
      },
      "stationWeights": {},
      "availableInAllPhases": true
    },
    "work_day": {
      "id": "work_day",
      "label": "工作日",
      "weights": {
        "Work": 1.65,
        "Rest": 1.1
      },
      "stationWeights": {},
      "availableInAllPhases": true
    },
    "feast": {
      "id": "feast",
      "label": "宴會日",
      "weights": {
        "Eat": 1.5,
        "Socialize": 1.45,
        "UseFurniture": 1.2
      },
      "stationWeights": {},
      "availableInAllPhases": true
    },
    "maintenance": {
      "id": "maintenance",
      "label": "整備日",
      "weights": {
        "Work": 1.35
      },
      "stationWeights": {
        "workshop": 1.6,
        "deck": 1.3
      },
      "availableInAllPhases": true
    },
    "research": {
      "id": "research",
      "label": "研究日",
      "weights": {
        "Work": 1.2
      },
      "stationWeights": {
        "library": 1.6,
        "navigation": 1.4
      },
      "availableInAllPhases": true
    }
  },
  "defaultDirective": "free_day",
  "schedules": {
    "morning": {
      "hours": [
        6,
        11
      ],
      "weights": {
        "Eat": 1.35,
        "Work": 1.15,
        "Train": 1.05,
        "Sleep": 0.45,
        "Socialize": 0.9
      },
      "hardLock": false
    },
    "day": {
      "hours": [
        11,
        17
      ],
      "weights": {
        "Work": 1.3,
        "Train": 1.25,
        "UseFurniture": 1.1,
        "Sleep": 0.4
      },
      "hardLock": false
    },
    "evening": {
      "hours": [
        17,
        22
      ],
      "weights": {
        "Eat": 1.3,
        "Socialize": 1.45,
        "UseFurniture": 1.2,
        "Work": 0.75
      },
      "hardLock": false
    },
    "night": {
      "hours": [
        22,
        6
      ],
      "weights": {
        "Sleep": 2.2,
        "Rest": 1.5,
        "Work": 0.6,
        "Train": 0.45,
        "Socialize": 0.75
      },
      "hardLock": false
    }
  },
  "policies": {
    "ownership": "every required participant is owned AND presently placed; optional participants never spawn or impersonate absent actors",
    "maxPresentCharacters": 10,
    "maxMemoriesPerCharacter": 16,
    "memoryTtlMs": 21600000,
    "maxRecentEvents": 32,
    "maxForegroundEvents": 1,
    "foregroundGapMs": 180000,
    "rareEventIntervalMs": [
      360000,
      600000
    ],
    "pairCooldownMs": 720000,
    "maxOfflineHours": 8,
    "timePhaseIsHardGate": false,
    "minTimeWeight": 0.25,
    "needsAreSoft": true,
    "lowNeedPermanentPenalty": false,
    "firstArrivalOncePerOwnedItem": true,
    "currencyAuthority": "server existing launcher coin wallet; client animations never mint coins",
    "eventCurrencyReward": 0,
    "relationshipValuesAreGameTuning": true
  },
  "officialSources": [
    {
      "key": "luffy",
      "url": "https://one-piece.com/character/luffy/index.html"
    },
    {
      "key": "zoro",
      "url": "https://one-piece.com/character/zoro/index.html"
    },
    {
      "key": "nami",
      "url": "https://one-piece.com/character/nami/index.html"
    },
    {
      "key": "usopp",
      "url": "https://one-piece.com/character/usopp/index.html"
    },
    {
      "key": "sanji",
      "url": "https://one-piece.com/character/sanji/index.html"
    },
    {
      "key": "chopper",
      "url": "https://one-piece.com/character/chopper/index.html"
    },
    {
      "key": "robin",
      "url": "https://one-piece.com/character/robin/index.html"
    },
    {
      "key": "franky",
      "url": "https://one-piece.com/character/franky/index.html"
    },
    {
      "key": "brook",
      "url": "https://one-piece.com/character/brook/index.html"
    },
    {
      "key": "jinbe",
      "url": "https://one-piece.com/character/Jinbe/index.html"
    },
    {
      "key": "sanji_hands",
      "url": "https://one-piece.com/news/o20210302_12195/index.html"
    },
    {
      "key": "robin_cute",
      "url": "https://one-piece.com/news/o20210206_12101/index.html"
    },
    {
      "key": "nami_jinbe_helm",
      "url": "https://one-piece.com/anime/o4847/index.html"
    },
    {
      "key": "franky_jinbe_helm",
      "url": "https://one-piece.com/anime/o5807/index.html"
    }
  ]
};
  // Supported content is installed ahead of release. Scheduling still requires the server roster.
  data.characterKeys.push(...(reserved?.RESERVED_KEYS || []));
  Object.assign(data.characters, reserved?.characters || {});
  Object.assign(data.relationships, reserved?.relationships || {});
  const allDirections = ['south','east','north','west'];
  const stage = (id,label,clip='work',cycles=2) => ({id,label,clip,cycles,durationMs:cycles*1200,stationary:true,requiresCompleteBodySequence:true});
  const station = (type,label,furnitureKeys,taskLabel,extra={}) => ({
    type,label,furnitureKeys,actions:['work'],taskLabel,
    freeFloor:false,occupancy:1,requiresReachableSlot:true,
    compatibleCharacters:data.characterKeys.slice(),
    stages:[stage('prepare','檢查與分類', 'work',1),stage('operate',taskLabel,'work',3),stage('finish','清點並收妥','work',1)],
    ...extra
  });
  data.stations = {
    kitchen:station('kitchen','備餐區',['kitchen-table','galley-stove'],'整理餐具與備用品',{
      specialistActions:{sanji:'cook'},specialistRequirements:{sanji:{furnitureKeys:['galley-stove']}},
      forbiddenClaimsWithoutSpecialist:['炒菜','點火','烤箱','冰箱取物'],
      capabilityNote:'餐桌只做備品整理。cook 僅於真正持有且擺出的 galley-stove 及正確接觸點啟用。'
    }),
    navigation:station('navigation','航海資料區',['map-table'],'整理航海資料',{specialistActions:{nami:'read'}}),
    training:station('training','訓練區',['swords-rack'],'檢查與收整練習用品',{freeFloor:true,actions:['work','train']}),
    workshop:station('workshop','工作間',['tool-bench'],'分類與擦拭工具',{specialistActions:{usopp:'craft',franky:'craft'}}),
    medical:station('medical','醫療用品區',['medicine-cabinet'],'清點密封醫療用品',{
      specialistActions:{chopper:'medicine'},capabilityNote:'一般角色做密封用品清點；喬巴專長循環檢查密封小藥瓶與標記，不虛構病患或用藥。'
    }),
    library:station('library','圖書區',['bookshelf'],'整理與核對書冊',{specialistActions:{robin:'read',chopper:'read'}}),
    helm:station('helm','舵輪區',['helm'],'清點操舵備用品',{
      specialistActions:{jinbe:'helm'},capabilityNote:'通用 work 是備用品整理；甚平 helm 必須獨立完整動作及輪緣接觸才能使用。'
    }),
    deck:station('deck','甲板',['treasure-chest','tangerine-tree'],'整理隨身備用品',{freeFloor:true,
      capabilityNote:'免費地面工作使用動作圖內的小工具包；不生出玩家未購買的家具。橘子樹旁不做採摘或澆水假動作。'
    }),
    music:station('music','音樂區',['piano'],'整理樂譜與保養用品',{specialistActions:{brook:'music'},
      capabilityNote:'music 僅布魯克的真演奏循環；其餘角色做整理工作，不假裝都能演奏。'
    })
  };
  data.actionCoverage = {
    policy:'Only decoded, QA-approved complete-body time sequences satisfy a clip requirement; no still-pose substitutes.',
    clips:{
      work:{directions:allDirections,frames:4,actors:data.characterKeys,tools:'同一角色完整動作內的小工具包／布／小物；不必依靠不存在的桌子',semantic:'拿取、檢視、擦拭、放回；不是站著換表情'},
      read:{directions:allDirections,frames:4,actors:['nami','usopp','chopper','robin','franky','jinbe'],tools:'完整圖內手持書或折起航海冊',semantic:'拿穩、視線下移、實際翻頁、讀下一頁'},
      eat:{directions:['south'],frames:4,actors:data.characterKeys,semantic:'端好食物、拿取、小口進食、放回'},
      rest:{directions:['south'],frames:4,actors:data.characterKeys,semantic:'完整人物放鬆肩膀、坐定、舒展、回穩'},
      sleep:{directions:['south'],frames:4,actors:data.characterKeys,semantic:'完整人物低頭／蜷睡及輕微呼吸；不拉開頭身'},
      train:{directions:['south'],frames:4,actors:data.characterKeys,semantic:'保持各自戰鬥習慣的低幅完整重心循環；香吉士不出拳'},
      cook:{directions:allDirections,frames:4,actors:['sanji'],requiresFurniture:['galley-stove'],requiresFurnitureCapability:'cooktop'},
      music:{directions:allDirections,frames:4,actors:['brook'],requiresFurniture:['piano']},
      craft:{directions:allDirections,frames:4,actors:['usopp','franky'],requiresFurniture:['tool-bench'],semantic:'完整人物穩住小工件、轉動工具、回程、檢查；不得拆手臂貼工具'},
      medicine:{directions:allDirections,frames:4,actors:['chopper'],requiresFurniture:['medicine-cabinet'],semantic:'持穩密封小藥瓶、核對標記、以短筆作小記號、收回；不開瓶、不服藥、沒有假病患'},
      helm:{directions:allDirections,frames:4,actors:['jinbe'],requiresFurniture:['helm'],semantic:'完整人物兩手在真輪緣操作、回穩；輪與手必須對齊'}
    },
    freeNeeds:['eat','rest','sleep','train'],
    appearance:'沿用已接受的十人服裝、頭身比例、五官、方向、腳部錨點；不重設人物。',
    unsupportedUntilSeparateArt:['追逐跑步','澆水或摘果','遞接手持物','醫療診療','操作會變形的工件'],
    releaseGate:'coverage entries are requirements, never assertions that files are imported or approved'
  };
  const say=(actor,line,pose='idle',mood='focused')=>({kind:'speak',actor,line,pose,mood,durationMs:Math.max(2600,Math.min(4800,1200+line.length*75))});
  const act=(actor,clip,durationMs=3600,extra={})=>({kind:'act',actor,clip,durationMs,...(['eat','rest','sleep','train'].includes(clip)?{direction:'south'}:{}),...extra});
  const branch=(ifCharacters,yes,no=[])=>({kind:'branch',ifCharacters,then:yes,else:no});
  const event=(id,title,kind,requiredCharacters,requiredFurniture,steps,extra={})=>({
    id:'life-'+id,title,kind,source:'life-authored-v1',requiredCharacters,optionalCharacters:[],requiredFurniture,
    location:requiredFurniture.length?{type:'station',stationType:Object.values(data.stations).find(s=>s.furnitureKeys.includes(requiredFurniture[0]))?.type}:{type:'floor'},priority:kind==='solo'?18:kind==='chain'?45:35,
    cooldownMs:kind==='chain'?2700000:1800000,pairCooldownMs:720000,
    availablePhases:['morning','day','evening','night'],requiredParticipantPolicy:'owned_and_present_and_available',
    optionalParticipantPolicy:'owned_and_present_and_available_and_reachable_otherwise_authored_fallback',
    maxDurationMs:120000,steps,relationshipDelta:{familiarity:.4,friendship:.25,rivalry:0,respect:.2},
    memory:{type:id,strength:.5,ttlMs:21600000,maxEntries:16},currencyReward:0,...extra
  });
  const authoredEvents = [
    event('solo-luffy','先把事情做完','solo',['luffy'],[],[
      say('luffy','這幾樣放好就行？好，交給我！','talk_happy','happy'),act('luffy','work'),
      say('luffy','好了！下次要去哪裡玩？','talk_happy','happy')
    ],{tone:'eager',location:{type:'floor',stationType:'deck'}}),
    event('solo-zoro','練習也要收尾','solo',['zoro'],[],[
      say('zoro','再一輪。這次把呼吸穩住。'),act('zoro','train',4800),
      act('zoro','rest',3400),say('zoro','嗯。剛才那下順了。')
    ],{tone:'discipline',location:{type:'floor',stationType:'training'}}),
    event('solo-nami','記錄真正有用的事','solo',['nami'],['map-table'],[
      act('nami','read',4400),say('nami','昨天這時候還是南風。得把變化記清楚。'),
      act('nami','work'),say('nami','整理好，下次才找得到。')
    ],{tone:'craft',location:{type:'station',stationType:'navigation'}}),
    event('solo-usopp','小工具也有自己的位置','solo',['usopp'],['tool-bench'],[
      act('usopp','work',4400),say('usopp','這個放常用的那一邊……嗯，比剛才順手。'),
      act('usopp','work'),say('usopp','這可是高手的準備工作！不是在偷懶喔。','talk_happy','happy')
    ],{tone:'craft',location:{type:'station',stationType:'workshop'}}),
    event('solo-sanji','開飯之前的準備','solo',['sanji'],['kitchen-table'],[
      say('sanji','用過的和乾淨的分開，這點不能省。'),act('sanji','work',4400),
      say('sanji','好，等等就不會手忙腳亂了。')
    ],{tone:'care',location:{type:'station',stationType:'kitchen'}}),
    event('solo-chopper','用得到的時候不能少','solo',['chopper'],['medicine-cabinet'],[
      act('chopper','work',4400),say('chopper','份量沒錯。外包裝也要再檢查一次。'),
      act('chopper','work'),say('chopper','好了。備齊才放心！','talk_happy','happy')
    ],{tone:'professional',location:{type:'station',stationType:'medical'}}),
    event('solo-robin','再讀一次才看見','solo',['robin'],['bookshelf'],[
      act('robin','read',5200),say('robin','原來這個詞在前一頁也出現過。'),
      act('robin','read'),say('robin','慢慢讀，也有慢慢讀的樂趣呢。','talk_happy','happy')
    ],{tone:'quiet',location:{type:'station',stationType:'library'}}),
    event('solo-franky','整備也是造船的一部分','solo',['franky'],['tool-bench'],[
      say('franky','好工具要保養。下次出力，就靠你們啦。'),act('franky','work',4800),
      say('franky','收工！這才像個工作間！','talk_happy','happy')
    ],{tone:'craft',location:{type:'station',stationType:'workshop'}}),
    event('solo-brook','沒有觀眾也珍惜的練習','solo',['brook'],['piano'],[
      say('brook','這一小段，今天再慢一點吧。'),act('brook','music',5200,{station:'piano'}),
      say('brook','嗯，這樣呼吸就順了。……啊，是曲子的呼吸。','talk_happy','happy')
    ],{tone:'music',location:{type:'station',stationType:'music'}}),
    event('solo-jinbe','看懂才接得穩','solo',['jinbe'],[],[
      act('jinbe','read',4400),say('jinbe','知道接下來的路，做事就能穩些。'),
      act('jinbe','rest'),say('jinbe','休息一會兒，再繼續吧。')
    ],{tone:'quiet',location:{type:'floor',stationType:'deck'}}),

    event('pair-luffy-zoro','不用催的下一輪','pair',['luffy','zoro'],[],[
      say('luffy','索隆！一起來一輪！','talk_happy','happy'),say('zoro','行。站穩，別只顧著往前衝。'),
      act('luffy','train',4000),act('zoro','train',4000),
      say('luffy','哈哈！再來！','talk_happy','happy'),say('zoro','……至少先喘口氣。')
    ],{tone:'companionship',relationshipDelta:{familiarity:.4,friendship:.3,rivalry:.3,respect:.4}}),
    event('pair-luffy-usopp','真工夫先上場','pair',['luffy','usopp'],['tool-bench'],[
      say('usopp','這些要分清楚。傳說中的整理術——'),say('luffy','喔！要怎麼分？','surprised','surprised'),
      act('usopp','work'),say('usopp','先看大小，再看用處。這個可不能混在一起。'),
      say('luffy','懂了！','talk_happy','happy'),act('luffy','work'),say('usopp','欸，你真的有聽進去耶。','talk_happy','happy')
    ],{tone:'craft'}),
    event('pair-zoro-sanji','誰也沒說要幫忙','pair',['zoro','sanji'],[],[
      say('sanji','喂，做完就收好，別留給下一個人。'),say('zoro','正要收。你倒是別擋路。'),
      act('zoro','work'),act('sanji','work'),say('sanji','……這邊好了。'),say('zoro','我這邊也是。')
    ],{tone:'dry_warmth',relationshipDelta:{familiarity:.4,friendship:.3,rivalry:.4,respect:.5}}),
    event('pair-nami-jinbe','把航路說清楚','pair',['nami','jinbe'],['map-table'],[
      act('nami','read'),say('nami','風向在這裡變了。照原來的速度走會偏。'),
      act('jinbe','read'),say('jinbe','明白。先留轉向的餘地，再看水流。'),
      say('nami','對！這樣我就不用一直喊了。','talk_happy','happy'),say('jinbe','該提醒的時候還請直說，老夫聽著。')
    ],{tone:'professional',relationshipDelta:{familiarity:.4,friendship:.2,rivalry:0,respect:.5}}),
    event('pair-nami-robin','一起安靜一下','pair',['nami','robin'],[],[
      act('nami','rest'),say('nami','今天總算有一會兒能坐下來。'),
      act('robin','rest'),say('robin','那這一會兒，就留給我們自己吧。','talk_happy','happy'),
      say('nami','嗯。先不管下一件事。','talk_happy','happy'),say('robin','很好呢。')
    ],{tone:'quiet_warmth'}),
    event('pair-usopp-franky','高手都在準備','pair',['usopp','franky'],['tool-bench'],[
      act('usopp','work'),say('usopp','這幾個常用的我放一起。找的時候省一半工夫！'),
      say('franky','喔，細活還是你有一套！'),act('franky','work'),
      say('usopp','當然！……你這邊也分得挺仔細嘛。','talk_happy','happy'),say('franky','哈哈！互相學一手！','talk_happy','happy')
    ],{tone:'craft',relationshipDelta:{familiarity:.4,friendship:.3,rivalry:.25,respect:.5}}),
    event('pair-sanji-chopper','船醫也得休息','pair',['sanji','chopper'],[],[
      say('chopper','我還想再確認一遍……'),say('sanji','剛才已經確認過了吧。先休息，腦袋才清楚。'),
      act('chopper','rest'),say('chopper','那你也坐下！你忙得更久！'),
      act('sanji','rest'),say('sanji','遵命，船醫。','talk_happy','happy')
    ],{tone:'care'}),
    event('pair-chopper-robin','自己找到的答案','pair',['chopper','robin'],['bookshelf'],[
      act('chopper','read'),say('chopper','同一個詞，這裡和上一頁的用法不一樣耶。'),
      act('robin','read'),say('robin','你看得很仔細。一起讀前後那兩句？'),
      act('chopper','read'),say('chopper','啊，懂了！不是寫錯，是意思不同！','talk_happy','happy'),
      say('robin','嗯，是你自己發現的。','talk_happy','happy')
    ],{tone:'learning',relationshipDelta:{familiarity:.4,friendship:.3,rivalry:0,respect:.5}}),
    event('pair-robin-franky','留給以後的人','pair',['robin','franky'],['bookshelf'],[
      act('robin','read'),say('robin','這份記錄很仔細。連失敗的地方也留下了。'),
      say('franky','那才有用！下次修的時候，就少繞一圈。'),act('franky','read'),
      say('robin','留下來，原來也是一種照顧呢。','talk_happy','happy'),say('franky','是啊。讓接手的人安心，這很重要。')
    ],{tone:'craft_warmth'}),
    event('pair-brook-jinbe','慢一點的節拍','pair',['brook','jinbe'],['piano'],[
      say('brook','今天想試一段慢的，您願意聽嗎？'),say('jinbe','當然。老夫正好歇一歇。'),
      act('jinbe','rest'),act('brook','music',5200,{station:'piano'}),
      say('jinbe','不急著往下走，反而更聽得清。'),say('brook','能有人這樣聽，我很高興。','talk_happy','happy')
    ],{tone:'quiet_warmth'}),
    event('pair-zoro-chopper','自己也說過的規矩','pair',['zoro','chopper'],[],[
      act('zoro','train',4200),say('chopper','到這裡先休息。你剛才自己說一輪就好！'),
      say('zoro','……記得倒清楚。'),act('zoro','rest'),
      say('chopper','當然！身體可不是想換就能換的！'),say('zoro','知道了。坐一會兒。')
    ],{tone:'care'}),
    event('pair-sanji-robin','把時間留給自己','pair',['sanji','robin'],[],[
      act('robin','read'),say('sanji','羅賓小姐，需要安靜一點嗎？'),say('robin','不用，你也坐一會兒吧。'),
      act('sanji','rest'),say('sanji','那就恭敬不如從命。','talk_happy','happy'),
      say('robin','今天也辛苦了。','talk_happy','happy')
    ],{tone:'quiet_warmth'}),

    event('triple-luffy-usopp-chopper','比誇口還有用的地方','triple',['luffy','usopp','chopper'],[],[
      say('usopp','仔細看，高手動手前，準備一點都不馬虎！'),act('usopp','work'),
      say('chopper','分得好清楚！這樣就不會拿錯了！','talk_happy','happy'),say('luffy','那我也來！','talk_happy','happy'),
      act('luffy','work'),say('usopp','慢點！這次不用搶第一！'),
      say('chopper','做對比做快重要！'),say('luffy','喔！那再看一遍！','talk_happy','happy')
    ],{tone:'playful_craft'}),
    event('triple-nami-jinbe-franky','把各自知道的接起來','triple',['nami','jinbe','franky'],['map-table'],[
      act('nami','read'),say('nami','這一段風會變，得先留點餘裕。'),say('jinbe','我會看著水流，不急著轉。'),
      act('franky','read'),say('franky','需要船配合的地方就說！我把狀況記下來。'),
      say('nami','嗯，有你們兩個就說得快多了。','talk_happy','happy'),say('jinbe','各自看見的湊在一起，才完整。')
    ],{tone:'professional'}),
    event('triple-sanji-chopper-luffy','吃完再出發','triple',['sanji','chopper','luffy'],[],[
      say('luffy','吃完還有嗎？','talk_happy','happy'),say('sanji','嘴裡那口先吃完再問！'),
      act('luffy','eat',4600),say('chopper','吃太快會不舒服啦！'),
      say('luffy','喔。這次慢一點。'),act('luffy','eat',4600),say('sanji','對。好好吃，就沒人跟你搶。')
    ],{tone:'care_comedy'}),
    event('triple-robin-usopp-franky','能被看懂的說明','triple',['robin','usopp','franky'],['bookshelf'],[
      act('robin','read'),say('robin','這份說明，沒做過的人也能看懂嗎？'),
      act('usopp','read'),say('usopp','這裡要加一句。先鬆開，再往外拉。'),
      say('franky','沒錯！我們知道，不代表下一個人知道。'),
      say('robin','那就從第一次讀的人開始想吧。'),say('usopp','嘿，這種細節就交給我。','talk_happy','happy')
    ],{tone:'learning'}),
    event('triple-brook-nami-jinbe','沒有行程的幾分鐘','triple',['brook','nami','jinbe'],['piano'],[
      say('nami','這幾分鐘，我決定什麼都不安排。'),say('brook','那麼，來一小段不趕時間的。'),
      act('nami','rest'),act('jinbe','rest'),act('brook','music',5400,{station:'piano'}),
      say('jinbe','不錯。忙完有這麼一段，格外舒服。'),say('nami','嗯。這段時間就算用對地方了。','talk_happy','happy')
    ],{tone:'quiet'}),
    event('triple-zoro-sanji-chopper','兩個都算數','triple',['zoro','sanji','chopper'],[],[
      say('chopper','現在開始休息！兩個都一樣！'),say('zoro','我又沒說不休息。'),
      say('sanji','誰跟他比了。'),act('zoro','rest'),act('sanji','rest'),
      say('chopper','很好！這樣才對！','talk_happy','happy'),say('zoro','……你聲音才該小一點。'),
      say('sanji','這句倒是。')
    ],{tone:'dry_care'}),

    event('chain-luffy-break','休息一下的提議','chain',['luffy'],[],[
      say('luffy','肚子餓了！先吃一口！','talk_happy','happy'),act('luffy','eat',4400),
      branch(['sanji'],[
        say('sanji','別急，先把這口吃完。'),say('luffy','好吃嘛！','talk_happy','happy'),act('luffy','eat',4400)
      ],[say('luffy','嗯……慢一點吃，也很好吃耶。','talk_happy','happy')]),
      branch(['nami'],[
        say('nami','吃完要把自己這邊整理好喔。'),say('luffy','知道啦！'),act('luffy','work'),
        say('nami','好。這次有做到。','talk_happy','happy')
      ],[act('luffy','work'),say('luffy','好！收好了！','talk_happy','happy')])
    ],{optionalCharacters:['sanji','nami'],tone:'playful_care'}),
    event('chain-usopp-organize','整理術的後半段','chain',['usopp'],[],[
      say('usopp','先把常用的排在一起。嗯，這邊好。'),act('usopp','work'),
      branch(['franky'],[
        say('franky','不錯嘛！光是順手，就能省下不少工夫。'),say('usopp','那當然！這可是認真想過的！','talk_happy','happy')
      ],[say('usopp','先自己試一輪，看看拿起來順不順。'),act('usopp','work')]),
      branch(['chopper'],[
        say('chopper','真的耶，一看就知道要拿哪個！','talk_happy','happy'),say('usopp','嘿嘿，這才是高手的本事。','talk_happy','happy')
      ],[say('usopp','好！下次的自己會感謝我的。','talk_happy','happy')])
    ],{optionalCharacters:['franky','chopper'],tone:'craft'}),
    event('chain-nami-notes','從一行記錄開始','chain',['nami'],[],[
      act('nami','read',4400),say('nami','這句寫得太急了。得重新確認一下。'),
      branch(['robin'],[
        say('robin','不妨連前一頁一起看？'),act('nami','read'),say('nami','啊，接起來就清楚了。謝謝。','talk_happy','happy')
      ],[act('nami','read'),say('nami','前面有記過。找到了。')]),
      branch(['jinbe'],[
        say('jinbe','需要再核對時，只管叫老夫。'),say('nami','好。有人一起確認會安心多了。','talk_happy','happy')
      ],[say('nami','好，下一次就不用從頭找了。')])
    ],{optionalCharacters:['robin','jinbe'],tone:'learning'}),
    event('chain-brook-small-tune','一小段也值得聽','chain',['brook'],['piano'],[
      say('brook','今天先練這一小段。'),act('brook','music',5400,{station:'piano'}),
      branch(['luffy'],[
        say('luffy','再來！剛剛那段我喜歡！','talk_happy','happy'),say('brook','好，那就再來一次。','talk_happy','happy'),act('brook','music',4800,{station:'piano'})
      ],[say('brook','再慢一點，讓尾音留久一些。'),act('brook','music',4200,{station:'piano'})]),
      branch(['jinbe'],[say('jinbe','老夫就坐在這裡，慢慢聽。'),act('jinbe','rest')]),
      branch(['nami'],[
        say('nami','這一段很舒服。音量就這樣，剛剛好。'),say('brook','遵命，娜美小姐。','talk_happy','happy')
      ],[say('brook','嗯，今天的練習到這裡。')])
    ],{optionalCharacters:['luffy','jinbe','nami'],tone:'music',location:{type:'station',stationType:'music'}})
  ];

  const lines = values => values.map(value=>typeof value==='string'?{line:value,mood:'focused',pose:'idle'}:{...value});
  const happy=line=>({line,mood:'happy',pose:'talk_happy'});
  const profileLines=(talk,repeated,call,gift,train,welcome)=>({talk:lines(talk),repeated:lines(repeated),repeatClick:lines(repeated),call:lines(call),gift:lines(gift),train:lines(train),welcome:lines(welcome)});
  data.playerLines = {
    luffy:profileLines(
      [happy('你來啦！今天想做什麼？'),'喂，你有沒有聽過哪裡有有趣的東西？',happy('忙完就一起玩吧！'),'你會這個？好厲害！教我！'],
      ['聽到了聽到了！你要說什麼？',happy('哈哈！一直叫我幹嘛啦！'),'等一下，我先把這件做完！'],
      [happy('喔！來了！'),'好！要去哪裡？','有好玩的嗎？我來！'],
      [happy('給我的？謝啦！'),'喔！這個我要好好看看！',happy('下次有好東西，我也分你！')],
      [happy('來吧！先試一輪！'),'站穩喔！我準備好了！','失敗就再來一次嘛！'],
      [happy('我來啦！這裡看起來很好玩！'),'好！先看看有什麼！',happy('以後也一起冒險吧！')]),
    zoro:profileLines(
      ['嗯？有事就說。','今天的練習還沒結束。你呢？','不用急，先站穩。','有要幫忙的就直說。'],
      ['……我聽得到。','同一句不用說三遍。','說重點。聽完我還要練。'],
      ['知道了。在哪？','等這一下做完。','行，帶路。'],
      ['給我？謝了。','用得上，我收著。','費心了。'],
      ['先把重心穩住。','別只顧著快。再來。','今天比昨天多一點就行。'],
      ['到了。這裡能練吧。','地方不錯。先熟悉一下。','有事再叫我。']),
    nami:profileLines(
      ['來得正好。你覺得這樣安排順不順？','先把重要的做好，等一下就輕鬆了。',happy('今天還算順利，繼續保持。'),'有新消息？說來聽聽。'],
      ['我聽見了，先讓我把這句看完。','等一下，一件一件來。','一直叫也不會比較快喔。'],
      ['好，我過去。先說是什麼事。','知道了，給我一下。','如果要商量事情，我有空。'],
      [happy('這個是特別挑的？謝謝。'),'不錯，很實用嘛。',happy('好，我收下了。這份心意有收到。')],
      ['今天先練平衡。腳步穩了再加快。','別勉強，做到標準比較重要。','呼吸順好，再來一次。'],
      [happy('這裡不錯嘛。先看看動線。'),'東西各歸各位，住起來才舒服。','好，我來幫忙把日子安排順一點。']),
    usopp:profileLines(
      [happy('你來得正好！我剛想到一個好點子！'),'這個地方再調一點就更順手了。','聽好了，這可是我親自想出來的！','要試新的？先讓我看看有沒有危險喔。'],
      ['喂喂！我又不會突然消失！','大高手也是要集中精神的！','有在聽啦！別嚇我！'],
      ['來了來了！不是什麼可怕的事吧？','讓我收好這個就過去。',happy('找我就對了！說吧！')],
      [happy('喔！這個我有好多點子可以用！'),'特地給我的？嘿嘿，謝啦。',happy('我會好好留著的！')],
      ['先練穩。高手也是這樣開始的！','我今天可是有認真練的！','別急著加難度，剛才那一下再試一次。'],
      [happy('偉大的騙人布船長——咳，我來啦！'),'好，先熟悉地方！那邊應該不危險吧？',happy('這裡可以做好多有趣的東西！')]),
    sanji:profileLines(
      ['有好好吃飯嗎？忙也不能省掉這一餐。','今天想吃什麼？先說來聽聽。','不用急，準備做好就不會亂。','休息一下也行。事情總得一件件來。'],
      ['聽到了。別在我忙的時候一直戳。','有話一次說完，我在聽。','先等一下，收尾不能馬虎。'],
      ['來了，什麼事？','等我把手邊收好。','需要幫忙就直接說。'],
      ['謝了，這個我會珍惜。','有心了。下次也讓我招待你。','挑得不錯嘛。'],
      ['先站穩。力量可不是只靠抬腿高。','別踢太急，把落腳的位置看清楚。','再一輪，呼吸不要亂。'],
      ['打擾了。先看看備餐的地方。','大家吃得好，這裡才像個家。','有需要就叫我。']),
    chopper:profileLines(
      ['今天有沒有好好休息？','有不舒服的地方，要早點說喔。',happy('我剛學到一個新知識！你要聽嗎？'),'這個我還想再查清楚一點。'],
      ['我聽見了啦！是有哪裡不舒服嗎？','慢慢說，我會認真聽的。','不是很急的話，讓我先記完這一行！'],
      ['來了！先告訴我是什麼情況。',happy('好，我過去！'),'等一下，我把東西收好。'],
      [happy('才、才不會因為這樣就高興呢！'),'謝謝……我會好好用的！',happy('你還記得我喜歡這個啊！')],
      ['一起伸展吧！不能突然用太大力。','做完要休息喔，我會記著的！','慢慢來。姿勢穩了就很好！'],
      [happy('我來了！有需要幫忙的就叫我！'),'先看看用品放在哪裡……嗯！',happy('能和大家一起生活，真好！')]),
    robin:profileLines(
      ['今天發現什麼有趣的事了嗎？','不急，我在聽。',happy('這樣平靜的時間，我也很喜歡。'),'再看一次，有時會發現剛才漏掉的細節。'],
      ['嗯，我一直都在這裡。','這麼急，是有什麼新發現嗎？',happy('不用擔心，我聽到了。')],
      ['好，等我記住這一頁。','我過去看看。','是要一起商量嗎？'],
      [happy('謝謝。選這個一定花了心思吧。'),'這份心意，我收到了。','很有意思，我會好好保存。'],
      ['先從舒展開始吧。','慢一點，比勉強自己有用。','這樣呼吸就順了。再一次？'],
      [happy('打擾了。這裡很舒服呢。'),'有適合閱讀的角落嗎？我想看看。','以後請多關照。']),
    franky:profileLines(
      [happy('喔！今天有什麼想做的？'),'哪裡用起來不順，直接告訴我。','好東西不只要漂亮，還得耐用！',happy('做好一件事的感覺，真不錯啊！')],
      ['哈哈，老兄，我有在聽！','等這個收好，馬上！','不用叫那麼多次，我又不是壞掉了！'],
      [happy('包在我身上！先說是哪裡。'),'來啦！','這就過去，留個位置！'],
      [happy('喔——有眼光！謝啦！'),'這份心意真夠意思！',happy('好！我可要好好收著！')],
      ['把重心壓穩，別只擺架勢！','今天也來扎實的一輪！','做完記得放鬆，保養也算訓練！'],
      [happy('我來啦！真是個不錯的地方！'),'哪裡要整備就找我！',happy('以後一起把這裡弄得更棒吧！')]),
    brook:profileLines(
      ['今天想聽熱鬧一點，還是安靜一點的呢？','有人一起度過普通的一天，也是很好的事。',happy('您來了，我正好歇一會兒。'),'不用趕，我有時間聽。'],
      ['喔，我有聽到。您是怕我睡著嗎？','不必這麼急，我還在這裡。',happy('呵呵，今天您很有精神呢。')],
      ['好的，這就過去。','容我把這一小段收尾。','您有什麼吩咐？'],
      ['謝謝您，我很高興。',happy('這份心意，比掌聲還暖呢。'),'我會好好珍惜的。'],
      ['先讓步子輕一些。慢慢來。','有節奏地呼吸，再走一輪。','練得穩，才走得從容。'],
      ['打擾了，今後請多關照。',happy('能在這裡歇腳，真令人高興。'),'若想聽點音樂，隨時告訴我。']),
    jinbe:profileLines(
      ['今天過得如何？','有不明白的事，一起想就是。','手邊這件做好，再接下一件。',happy('能安安穩穩坐一會兒，也不錯。')],
      ['老夫聽著，慢慢說。','不用著急。先把意思說清楚。','嗯，剛才那件事我記住了。'],
      ['好，這就過去。','知道了。請帶路。','需要人手，直說便是。'],
      ['承你的心意，謝謝。','這份禮物，老夫收下了。','讓你費心了。我會珍惜。'],
      ['先穩住腳下，再帶動上身。','不求急，求每一下都做得清楚。','呼吸順了，力量才用得穩。'],
      ['打擾了，往後還請多關照。','有老夫能幫上的地方，儘管說。',happy('這裡讓人很安心。')])
  };

  Object.assign(data.playerLines, reserved?.interactionLines || {});
  authoredEvents.push(...JSON.parse(JSON.stringify(reserved?.events || [])));
  const normalizeKey = value => String(value || '').replace(/^room-character-/,'');
  const keySet = values => new Set(Array.from(values || []).map(normalizeKey));
  function resolveEventSteps(event,participants) {
    const active=keySet(participants),out=[];
    function visit(steps) {
      for(const step of steps || []) {
        if(!(step.requiredCharacters || []).every(key=>active.has(normalizeKey(key))))continue;
        if(step.kind==='branch') visit((step.ifCharacters || []).every(key=>active.has(key))?step.then:step.else);
        else if(active.has(normalizeKey(step.actor || step.speaker)))out.push({...step});
      }
    }
    visit(event.steps);
    return out;
  }
  function requiredActionsFor(event,participants=event.requiredCharacters) {
    const unique=new Map();
    for(const step of resolveEventSteps(event,participants)) if(step.kind==='act') {
      const item={actor:step.actor,clip:step.clip,direction:step.direction || 'south',furnitureKey:step.station || null};
      unique.set([item.actor,item.clip,item.direction,item.furnitureKey].join(':'),item);
    }
    return [...unique.values()];
  }
  function isEventEligible(event,context={}) {
    if(!event || !Array.isArray(event.requiredCharacters) || !event.requiredCharacters.length)return false;
    const owned=keySet(context.ownedCharacters || context.ownedItemIds),present=keySet(context.presentCharacters || context.presentItemIds);
    if(!event.requiredCharacters.every(key=>owned.has(key)&&present.has(key)))return false;
    const furniture=new Set(Array.from(context.availableFurnitureKeys || []).map(key=>String(key).replace(/^room-furniture-/,'')));
    if(!event.requiredFurniture.every(key=>furniture.has(key)))return false;
    const participants=selectEventParticipants(event,context);
    if(typeof context.isAvailable==='function' && !event.requiredCharacters.every(context.isAvailable))return false;
    const requirements=requiredActionsFor(event,participants);
    return !requirements.length || (typeof context.hasAction==='function' && requirements.every(req=>context.hasAction(req.actor,req.clip,req.direction,req.furnitureKey)));
  }
  function selectEventParticipants(event,context={}) {
    const owned=keySet(context.ownedCharacters || context.ownedItemIds),present=keySet(context.presentCharacters || context.presentItemIds);
    const available=key=>owned.has(key)&&present.has(key)&&(typeof context.isAvailable!=='function'||context.isAvailable(key));
    if(!event.requiredCharacters.every(available))return [];
    const participants=event.requiredCharacters.slice();
    for(const key of event.optionalCharacters || []) {
      if(!available(key))continue;
      const next=[...participants,key],requirements=requiredActionsFor(event,next);
      if(requirements.length && (typeof context.hasAction!=='function'||!requirements.every(req=>context.hasAction(req.actor,req.clip,req.direction,req.furnitureKey))))continue;
      participants.push(key);
    }
    return participants;
  }
  // The old pair API keeps OR furniture tags. Life imports conservatively require all
  // tagged furniture, and preserve original IDs so its cooldowns cannot be bypassed.
  const legacyEvents = Object.values(dialogue?.SCENES || {}).flat().map(scene=>({
    id:scene.id,title:scene.topic,kind:'pair',source:'room-dialogue',legacyImported:true,
    requiredCharacters:scene.pair.slice(),optionalCharacters:[],requiredFurniture:scene.tags.slice(),
    location:scene.tags.length?{type:'station',stationType:Object.values(data.stations).find(s=>s.furnitureKeys.includes(scene.tags[0]))?.type}:{type:'floor'},priority:8,cooldownMs:Math.max(900000,scene.cooldownMs),pairCooldownMs:720000,
    availablePhases:['morning','day','evening','night'],requiredParticipantPolicy:'owned_and_present_and_available',
    steps:scene.turns.map(turn=>({kind:'speak',actor:turn.speaker,line:turn.line,mood:turn.mood,pose:turn.pose,durationMs:turn.durationMs,listener:turn.listener})),
    requiredActions:[],relationshipDelta:{familiarity:.3,friendship:.2,rivalry:0,respect:.1},
    memory:{type:scene.id,strength:.35,ttlMs:21600000,maxEntries:16},currencyReward:0
  }));
  for(const event of authoredEvents) {
    event.requiredActions=requiredActionsFor(event,event.requiredCharacters);
    event.optionalActionCoverage=Object.fromEntries(event.optionalCharacters.map(key=>[key,requiredActionsFor(event,[...event.requiredCharacters,key])]));
  }
  data.authoredEvents=authoredEvents;
  data.legacyEvents=legacyEvents;
  data.events=[...authoredEvents,...legacyEvents];
  data.eventById=Object.fromEntries(data.events.map(event=>[event.id,event]));
  data.resolveEventSteps=resolveEventSteps;
  data.requiredActionsFor=requiredActionsFor;
  data.selectEventParticipants=selectEventParticipants;
  data.isEventEligible=isEventEligible;
  data.relationshipKey=(a,b)=>[normalizeKey(a),normalizeKey(b)].sort().join(':');
  data.stationForFurniture=key=>Object.values(data.stations).find(station=>station.furnitureKeys.includes(String(key).replace(/^room-furniture-/,''))) || null;
  function deepFreeze(value) {
    if(value && typeof value==='object' && !Object.isFrozen(value)) {Object.freeze(value);Object.values(value).forEach(deepFreeze);}
    return value;
  }
  return deepFreeze(data);
});
