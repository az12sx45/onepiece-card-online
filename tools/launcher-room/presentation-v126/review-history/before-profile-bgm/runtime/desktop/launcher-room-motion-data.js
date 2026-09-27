/* Whole-character v3 motion contract; stride and speed use front-row stage pixels before body display scale. */
(function(root){'use strict';const data={
  "schema": "one-piece-room-motion/3",
  "shape": {
    "walk": {
      "columns": 4,
      "rows": 1,
      "frames": 4,
      "cell": 128,
      "root": [
        64,
        112
      ],
      "sequence": [
        "contactA",
        "neutral",
        "contactC",
        "neutral"
      ]
    },
    "actions": {
      "columns": 8,
      "rows": 1,
      "frames": 8,
      "actionCount": 8,
      "beatsPerAction": 1,
      "cell": 128,
      "root": [
        64,
        112
      ]
    }
  },
  "characters": {
    "brook": {
      "stride": {
        "east": 40,
        "west": 40,
        "north": 12,
        "south": 12
      },
      "speed": {
        "east": 32,
        "west": 32,
        "north": 9.6,
        "south": 9.6
      },
      "root": [
        64,
        112
      ],
      "standingFrame": 1,
      "displayScale": 1.1
    },
    "chopper": {
      "stride": {
        "east": 28,
        "west": 28,
        "north": 10,
        "south": 10
      },
      "speed": {
        "east": 25.4545,
        "west": 25.4545,
        "north": 9.0909,
        "south": 9.0909
      },
      "root": [
        64,
        112
      ],
      "standingFrame": 1,
      "displayScale": 0.72
    },
    "franky": {
      "stride": {
        "east": 40,
        "west": 40,
        "north": 12,
        "south": 12
      },
      "speed": {
        "east": 32,
        "west": 32,
        "north": 9.6,
        "south": 9.6
      },
      "root": [
        64,
        112
      ],
      "standingFrame": 1,
      "displayScale": 1.32
    },
    "jinbe": {
      "stride": {
        "east": 24,
        "west": 24,
        "north": 12,
        "south": 12
      },
      "speed": {
        "east": 18.1818,
        "west": 18.1818,
        "north": 9.0909,
        "south": 9.0909
      },
      "root": [
        64,
        112
      ],
      "standingFrame": 1,
      "displayScale": 1.14
    },
    "luffy": {
      "stride": {
        "east": 60,
        "west": 60,
        "north": 12,
        "south": 12
      },
      "speed": {
        "east": 51.7241,
        "west": 51.7241,
        "north": 10.3448,
        "south": 10.3448
      },
      "root": [
        64,
        112
      ],
      "standingFrame": 1,
      "displayScale": 1
    },
    "nami": {
      "stride": {
        "east": 55,
        "west": 55,
        "north": 12,
        "south": 12
      },
      "speed": {
        "east": 47.4138,
        "west": 47.4138,
        "north": 10.3448,
        "south": 10.3448
      },
      "root": [
        64,
        112
      ],
      "standingFrame": 1,
      "displayScale": 1
    },
    "robin": {
      "stride": {
        "east": 46,
        "west": 46,
        "north": 12,
        "south": 12
      },
      "speed": {
        "east": 38.3333,
        "west": 38.3333,
        "north": 10,
        "south": 10
      },
      "root": [
        64,
        112
      ],
      "standingFrame": 1,
      "displayScale": 1.03
    },
    "sanji": {
      "stride": {
        "east": 50,
        "west": 50,
        "north": 12,
        "south": 12
      },
      "speed": {
        "east": 43.1034,
        "west": 43.1034,
        "north": 10.3448,
        "south": 10.3448
      },
      "root": [
        64,
        112
      ],
      "standingFrame": 1,
      "displayScale": 1
    },
    "usopp": {
      "stride": {
        "east": 48,
        "west": 48,
        "north": 12,
        "south": 12
      },
      "speed": {
        "east": 41.3793,
        "west": 41.3793,
        "north": 10.3448,
        "south": 10.3448
      },
      "root": [
        64,
        112
      ],
      "standingFrame": 1,
      "displayScale": 1
    },
    "zoro": {
      "stride": {
        "east": 48,
        "west": 48,
        "north": 12,
        "south": 12
      },
      "speed": {
        "east": 41.3793,
        "west": 41.3793,
        "north": 10.3448,
        "south": 10.3448
      },
      "root": [
        64,
        112
      ],
      "standingFrame": 1,
      "displayScale": 1
    }
  }
};
if(typeof module==='object'&&module.exports)module.exports=data;else root.OnePieceRoomMotionManifest=data;
}(typeof globalThis!=='undefined'?globalThis:this));
