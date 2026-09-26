/* Whole-character v3 motion contract; stride and speed use front-row stage pixels. */
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
        "east": 24,
        "north": 12,
        "south": 12,
        "west": 24
      },
      "speed": {
        "east": 26,
        "north": 13,
        "south": 13,
        "west": 26
      },
      "root": [
        64,
        112
      ],
      "standingFrame": 1
    },
    "chopper": {
      "stride": {
        "east": 20,
        "north": 10,
        "south": 10,
        "west": 20
      },
      "speed": {
        "east": 26,
        "north": 13,
        "south": 13,
        "west": 26
      },
      "root": [
        64,
        112
      ],
      "standingFrame": 1
    },
    "franky": {
      "stride": {
        "east": 24,
        "north": 12,
        "south": 12,
        "west": 24
      },
      "speed": {
        "east": 26,
        "north": 13,
        "south": 13,
        "west": 26
      },
      "root": [
        64,
        112
      ],
      "standingFrame": 1
    },
    "jinbe": {
      "stride": {
        "east": 24,
        "north": 12,
        "south": 12,
        "west": 24
      },
      "speed": {
        "east": 26,
        "north": 13,
        "south": 13,
        "west": 26
      },
      "root": [
        64,
        112
      ],
      "standingFrame": 1
    },
    "luffy": {
      "stride": {
        "east": 24,
        "north": 12,
        "south": 12,
        "west": 24
      },
      "speed": {
        "east": 26,
        "north": 13,
        "south": 13,
        "west": 26
      },
      "root": [
        64,
        112
      ],
      "standingFrame": 1
    },
    "nami": {
      "stride": {
        "east": 24,
        "north": 12,
        "south": 12,
        "west": 24
      },
      "speed": {
        "east": 26,
        "north": 13,
        "south": 13,
        "west": 26
      },
      "root": [
        64,
        112
      ],
      "standingFrame": 1
    },
    "robin": {
      "stride": {
        "east": 24,
        "north": 12,
        "south": 12,
        "west": 24
      },
      "speed": {
        "east": 26,
        "north": 13,
        "south": 13,
        "west": 26
      },
      "root": [
        64,
        112
      ],
      "standingFrame": 1
    },
    "sanji": {
      "stride": {
        "east": 24,
        "north": 12,
        "south": 12,
        "west": 24
      },
      "speed": {
        "east": 26,
        "north": 13,
        "south": 13,
        "west": 26
      },
      "root": [
        64,
        112
      ],
      "standingFrame": 1
    },
    "usopp": {
      "stride": {
        "east": 24,
        "north": 12,
        "south": 12,
        "west": 24
      },
      "speed": {
        "east": 26,
        "north": 13,
        "south": 13,
        "west": 26
      },
      "root": [
        64,
        112
      ],
      "standingFrame": 1
    },
    "zoro": {
      "stride": {
        "east": 24,
        "north": 12,
        "south": 12,
        "west": 24
      },
      "speed": {
        "east": 26,
        "north": 13,
        "south": 13,
        "west": 26
      },
      "root": [
        64,
        112
      ],
      "standingFrame": 1
    }
  }
};if(typeof module==='object'&&module.exports)module.exports=data;else root.OnePieceRoomMotionManifest=data;})(typeof globalThis==='object'?globalThis:this);
