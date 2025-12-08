// cpu.js
const { applyAction, _util, COUNTS } = require("./engine.js");
const { tail, cardById } = _util;


// === 尾數分布：根據 COUNTS 把每種尾數總共有幾張 ===
const TOTAL_TAIL_COUNTS = (() => {
  const arr = Array(10).fill(0); // 0~9
  for (const [idStr, cnt] of Object.entries(COUNTS)) {
    const id = Number(idStr);
    const t = tail(id);
    if (t >= 0 && t < 10) {
      arr[t] += cnt;
    }
  }
  return arr;
})();

// === 最終決鬥用的「點數」（跟 showdown 的 showVal 一樣） ===
function finalValue(id) {
  return (id < 10) ? id : (Math.floor(id / 10) + (id % 10));
}

// 根據 COUNTS 算每個「final 點數」一開始有幾張牌
const TOTAL_FINALVAL_COUNTS = (() => {
  const maxVal = 20; // 理論上只會到 10，多留一點空間沒關係
  const arr = Array(maxVal).fill(0);
  for (const [idStr, cnt] of Object.entries(COUNTS)) {
    const id = Number(idStr);
    const v = finalValue(id);
    if (v >= 0 && v < maxVal) {
      arr[v] += cnt;
    }
  }
  return arr;
})();

// 深拷貝 state，避免影響真實對局
function cloneState(st){
  return JSON.parse(JSON.stringify(st));
}

// 給某個玩家看的「局面好壞」
function scoreStateForMe(st, meIdx){
  const me = st.players[meIdx];
  if (!me) return -99999;

  // 已經死了 → 爛到爆
  if (!me.alive) return -100000;

  // 1) 生存分：活著本身就是好事
  let s = 0;
  s += 1000; // 活著加一大筆

  // 2) 場上剩幾個人（人越少越好）
  const aliveCount = st.players.filter(p => p.alive).length;
  s += (10 - aliveCount) * 30;   // 剩 2~3 人會變得特別香

  // 3) 我手上的牌（手牌尾數大、功能強的加分）
  if (typeof me.hand === 'number'){
    const t = tail(me.hand);
    s += t * 8; // 尾數大，比牌比較強
  }

  // 4) 保護/閃避狀態
  if (me.protected) s += 120;
  if (me.dodging)  s += 100;

  // 5) 金幣（因為之後會換賞金 / 稱號）
  s += (me.gold || 0) * 25;

  // 6) 特殊狀態（凍結、冰鬼）
  if (me.frozen)      s -= 80;
  if (me.iceInfected) s -= 60;

  // 7) 對別人的壓制：活著的對手越多越扣分
  st.players.forEach((p,i)=>{
    if (i === meIdx) return;
    if (!p.alive) {
      s += 80;  // 殺掉一個人蠻爽
    } else {
      // 對手還活著，基本扣分
      s -= 20;
      // 對手有保護/閃避 → 更難殺，扣多一點
      if (p.protected) s -= 25;
      if (p.dodging)  s -= 20;
    }
  });

  return s;
}

// 判斷這張牌「現在」有沒有在自己的強化場地上
function isEnhancedNowCpu(st, cardId) {
  const card = cardById(cardId);
  if (!card || !card.venue) return false;
  if (!Array.isArray(st.venues)) return false;
  return st.venues.some(v => v && v.name === card.venue);
}

// === 雙卡出牌偏好表（由你「2 選 1」點選紀錄產生）===

// 這個物件要貼「卡片 2 選 1」工具匯出的 pairs：
//   key 範例："0_N__5_E"
//   value 內有 a / b / shown / aPref / bPref 等欄位
const PAIR_PREF = {
  "1_E__9_E": {
      "a": "1_E",
      "b": "9_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "12_E__15_E": {
      "a": "12_E",
      "b": "15_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "10_N__7_E": {
      "a": "10_N",
      "b": "7_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "18_N__1_N": {
      "a": "18_N",
      "b": "1_N",
      "shown": 2,
      "aWins": 0,
      "bWins": 2,
      "aPref": 0,
      "bPref": 1
    },
    "13_N__17_E": {
      "a": "13_N",
      "b": "17_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "16_E__18_N": {
      "a": "16_E",
      "b": "18_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "14_N__16_E": {
      "a": "14_N",
      "b": "16_E",
      "shown": 2,
      "aWins": 2,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "16_E__7_E": {
      "a": "16_E",
      "b": "7_E",
      "shown": 2,
      "aWins": 2,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "14_E__15_N": {
      "a": "14_E",
      "b": "15_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "19_N__5_N": {
      "a": "19_N",
      "b": "5_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "14_E__2_E": {
      "a": "14_E",
      "b": "2_E",
      "shown": 2,
      "aWins": 2,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "11_N__8_N": {
      "a": "11_N",
      "b": "8_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "12_E__18_E": {
      "a": "12_E",
      "b": "18_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "0_E__18_N": {
      "a": "0_E",
      "b": "18_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "15_E__19_N": {
      "a": "15_E",
      "b": "19_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "18_N__7_E": {
      "a": "18_N",
      "b": "7_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "16_E__1_E": {
      "a": "16_E",
      "b": "1_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "15_E__16_E": {
      "a": "15_E",
      "b": "16_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "12_E__5_N": {
      "a": "12_E",
      "b": "5_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "13_N__2_E": {
      "a": "13_N",
      "b": "2_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "0_E__17_N": {
      "a": "0_E",
      "b": "17_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "14_E__9_E": {
      "a": "14_E",
      "b": "9_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "14_E__6_E": {
      "a": "14_E",
      "b": "6_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "14_N__2_E": {
      "a": "14_N",
      "b": "2_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "0_N__2_E": {
      "a": "0_N",
      "b": "2_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "15_N__18_N": {
      "a": "15_N",
      "b": "18_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "17_N__6_N": {
      "a": "17_N",
      "b": "6_N",
      "shown": 2,
      "aWins": 2,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "13_N__6_N": {
      "a": "13_N",
      "b": "6_N",
      "shown": 3,
      "aWins": 3,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "14_N__16_N": {
      "a": "14_N",
      "b": "16_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "16_E__8_E": {
      "a": "16_E",
      "b": "8_E",
      "shown": 2,
      "aWins": 2,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "13_N__15_N": {
      "a": "13_N",
      "b": "15_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "0_E__16_E": {
      "a": "0_E",
      "b": "16_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "15_N__4_E": {
      "a": "15_N",
      "b": "4_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "10_N__9_N": {
      "a": "10_N",
      "b": "9_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "0_E__11_E": {
      "a": "0_E",
      "b": "11_E",
      "shown": 2,
      "aWins": 2,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "1_N__9_E": {
      "a": "1_N",
      "b": "9_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "16_N__4_N": {
      "a": "16_N",
      "b": "4_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "13_N__9_N": {
      "a": "13_N",
      "b": "9_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "10_N__14_N": {
      "a": "10_N",
      "b": "14_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "4_N__5_E": {
      "a": "4_N",
      "b": "5_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "12_N__8_E": {
      "a": "12_N",
      "b": "8_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "10_N__7_N": {
      "a": "10_N",
      "b": "7_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "11_N__3_N": {
      "a": "11_N",
      "b": "3_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "17_E__9_E": {
      "a": "17_E",
      "b": "9_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "17_N__3_N": {
      "a": "17_N",
      "b": "3_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "4_N__8_E": {
      "a": "4_N",
      "b": "8_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "14_E__5_N": {
      "a": "14_E",
      "b": "5_N",
      "shown": 2,
      "aWins": 2,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "14_N__8_E": {
      "a": "14_N",
      "b": "8_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "11_E__9_N": {
      "a": "11_E",
      "b": "9_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "15_N__9_N": {
      "a": "15_N",
      "b": "9_N",
      "shown": 2,
      "aWins": 2,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "13_E__2_E": {
      "a": "13_E",
      "b": "2_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "5_N__9_E": {
      "a": "5_N",
      "b": "9_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "12_E__8_N": {
      "a": "12_E",
      "b": "8_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "18_N__3_N": {
      "a": "18_N",
      "b": "3_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "0_E__9_E": {
      "a": "0_E",
      "b": "9_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "19_E__8_E": {
      "a": "19_E",
      "b": "8_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "14_N__5_N": {
      "a": "14_N",
      "b": "5_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "3_N__7_E": {
      "a": "3_N",
      "b": "7_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "0_E__14_E": {
      "a": "0_E",
      "b": "14_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "15_E__18_E": {
      "a": "15_E",
      "b": "18_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "0_E__19_N": {
      "a": "0_E",
      "b": "19_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "2_N__4_N": {
      "a": "2_N",
      "b": "4_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "10_N__4_N": {
      "a": "10_N",
      "b": "4_N",
      "shown": 2,
      "aWins": 0,
      "bWins": 2,
      "aPref": 0,
      "bPref": 1
    },
    "18_E__19_E": {
      "a": "18_E",
      "b": "19_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "14_E__9_N": {
      "a": "14_E",
      "b": "9_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "1_E__4_E": {
      "a": "1_E",
      "b": "4_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "11_E__4_E": {
      "a": "11_E",
      "b": "4_E",
      "shown": 2,
      "aWins": 0,
      "bWins": 2,
      "aPref": 0,
      "bPref": 1
    },
    "11_E__1_E": {
      "a": "11_E",
      "b": "1_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "11_N__6_N": {
      "a": "11_N",
      "b": "6_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "16_E__4_N": {
      "a": "16_E",
      "b": "4_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "0_E__1_E": {
      "a": "0_E",
      "b": "1_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "15_E__7_N": {
      "a": "15_E",
      "b": "7_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "2_N__8_N": {
      "a": "2_N",
      "b": "8_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "13_E__19_N": {
      "a": "13_E",
      "b": "19_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "10_E__3_E": {
      "a": "10_E",
      "b": "3_E",
      "shown": 2,
      "aWins": 2,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "16_N__18_E": {
      "a": "16_N",
      "b": "18_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "1_E__3_N": {
      "a": "1_E",
      "b": "3_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "4_N__8_N": {
      "a": "4_N",
      "b": "8_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "1_E__9_N": {
      "a": "1_E",
      "b": "9_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "15_N__7_E": {
      "a": "15_N",
      "b": "7_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "13_E__6_N": {
      "a": "13_E",
      "b": "6_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "17_E__3_E": {
      "a": "17_E",
      "b": "3_E",
      "shown": 2,
      "aWins": 0,
      "bWins": 2,
      "aPref": 0,
      "bPref": 1
    },
    "18_N__2_N": {
      "a": "18_N",
      "b": "2_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "10_N__19_N": {
      "a": "10_N",
      "b": "19_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "14_N__5_E": {
      "a": "14_N",
      "b": "5_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "14_E__16_N": {
      "a": "14_E",
      "b": "16_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "3_E__4_N": {
      "a": "3_E",
      "b": "4_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "17_N__8_N": {
      "a": "17_N",
      "b": "8_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "17_N__1_E": {
      "a": "17_N",
      "b": "1_E",
      "shown": 2,
      "aWins": 0,
      "bWins": 2,
      "aPref": 0,
      "bPref": 1
    },
    "10_E__18_N": {
      "a": "10_E",
      "b": "18_N",
      "shown": 2,
      "aWins": 0,
      "bWins": 2,
      "aPref": 0,
      "bPref": 1
    },
    "14_E__17_E": {
      "a": "14_E",
      "b": "17_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "5_E__7_E": {
      "a": "5_E",
      "b": "7_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "11_E__13_E": {
      "a": "11_E",
      "b": "13_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "19_E__7_E": {
      "a": "19_E",
      "b": "7_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "18_E__2_E": {
      "a": "18_E",
      "b": "2_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "17_N__7_N": {
      "a": "17_N",
      "b": "7_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "19_E__2_E": {
      "a": "19_E",
      "b": "2_E",
      "shown": 2,
      "aWins": 0,
      "bWins": 2,
      "aPref": 0,
      "bPref": 1
    },
    "10_N__15_N": {
      "a": "10_N",
      "b": "15_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "12_N__14_N": {
      "a": "12_N",
      "b": "14_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "0_N__3_N": {
      "a": "0_N",
      "b": "3_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "15_N__4_N": {
      "a": "15_N",
      "b": "4_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "1_E__6_N": {
      "a": "1_E",
      "b": "6_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "14_N__6_N": {
      "a": "14_N",
      "b": "6_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "5_N__8_N": {
      "a": "5_N",
      "b": "8_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "19_N__4_N": {
      "a": "19_N",
      "b": "4_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "0_E__8_E": {
      "a": "0_E",
      "b": "8_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "15_N__19_N": {
      "a": "15_N",
      "b": "19_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "12_E__1_E": {
      "a": "12_E",
      "b": "1_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "13_E__8_E": {
      "a": "13_E",
      "b": "8_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "12_N__14_E": {
      "a": "12_N",
      "b": "14_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "10_E__13_N": {
      "a": "10_E",
      "b": "13_N",
      "shown": 2,
      "aWins": 0,
      "bWins": 2,
      "aPref": 0,
      "bPref": 1
    },
    "4_N__6_E": {
      "a": "4_N",
      "b": "6_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "15_N__2_N": {
      "a": "15_N",
      "b": "2_N",
      "shown": 2,
      "aWins": 1,
      "bWins": 1,
      "aPref": 0.5,
      "bPref": 0.5
    },
    "10_N__5_E": {
      "a": "10_N",
      "b": "5_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "13_E__16_N": {
      "a": "13_E",
      "b": "16_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "19_E__1_E": {
      "a": "19_E",
      "b": "1_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "10_E__12_E": {
      "a": "10_E",
      "b": "12_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "1_N__2_E": {
      "a": "1_N",
      "b": "2_E",
      "shown": 2,
      "aWins": 0,
      "bWins": 2,
      "aPref": 0,
      "bPref": 1
    },
    "10_N__5_N": {
      "a": "10_N",
      "b": "5_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "0_E__7_N": {
      "a": "0_E",
      "b": "7_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "12_E__14_N": {
      "a": "12_E",
      "b": "14_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "12_E__13_E": {
      "a": "12_E",
      "b": "13_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "12_N__9_E": {
      "a": "12_N",
      "b": "9_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "11_N__9_N": {
      "a": "11_N",
      "b": "9_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "0_E__2_E": {
      "a": "0_E",
      "b": "2_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "12_N__15_N": {
      "a": "12_N",
      "b": "15_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "1_E__2_E": {
      "a": "1_E",
      "b": "2_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "15_E__1_E": {
      "a": "15_E",
      "b": "1_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "19_E__8_N": {
      "a": "19_E",
      "b": "8_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "10_E__14_N": {
      "a": "10_E",
      "b": "14_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "0_N__16_E": {
      "a": "0_N",
      "b": "16_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "16_N__17_E": {
      "a": "16_N",
      "b": "17_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "17_N__19_N": {
      "a": "17_N",
      "b": "19_N",
      "shown": 2,
      "aWins": 2,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "0_E__17_E": {
      "a": "0_E",
      "b": "17_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "7_E__8_N": {
      "a": "7_E",
      "b": "8_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "18_N__3_E": {
      "a": "18_N",
      "b": "3_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "13_N__2_N": {
      "a": "13_N",
      "b": "2_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "12_E__14_E": {
      "a": "12_E",
      "b": "14_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "0_E__19_E": {
      "a": "0_E",
      "b": "19_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "10_E__14_E": {
      "a": "10_E",
      "b": "14_E",
      "shown": 2,
      "aWins": 2,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "15_E__4_E": {
      "a": "15_E",
      "b": "4_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "15_E__8_E": {
      "a": "15_E",
      "b": "8_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "17_N__4_E": {
      "a": "17_N",
      "b": "4_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "16_E__17_N": {
      "a": "16_E",
      "b": "17_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "1_N__6_E": {
      "a": "1_N",
      "b": "6_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "17_E__2_N": {
      "a": "17_E",
      "b": "2_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "12_N__4_N": {
      "a": "12_N",
      "b": "4_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "0_N__19_N": {
      "a": "0_N",
      "b": "19_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "13_N__15_E": {
      "a": "13_N",
      "b": "15_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "0_N__7_E": {
      "a": "0_N",
      "b": "7_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "12_E__17_N": {
      "a": "12_E",
      "b": "17_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "13_E__1_N": {
      "a": "13_E",
      "b": "1_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "10_N__3_N": {
      "a": "10_N",
      "b": "3_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "0_N__5_N": {
      "a": "0_N",
      "b": "5_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "15_E__9_N": {
      "a": "15_E",
      "b": "9_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "3_E__8_N": {
      "a": "3_E",
      "b": "8_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "0_E__2_N": {
      "a": "0_E",
      "b": "2_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "10_E__3_N": {
      "a": "10_E",
      "b": "3_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "18_N__5_E": {
      "a": "18_N",
      "b": "5_E",
      "shown": 2,
      "aWins": 0,
      "bWins": 2,
      "aPref": 0,
      "bPref": 1
    },
    "18_E__7_N": {
      "a": "18_E",
      "b": "7_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "16_N__2_E": {
      "a": "16_N",
      "b": "2_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "6_E__8_N": {
      "a": "6_E",
      "b": "8_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "1_N__7_N": {
      "a": "1_N",
      "b": "7_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "13_E__17_N": {
      "a": "13_E",
      "b": "17_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "4_E__5_N": {
      "a": "4_E",
      "b": "5_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "0_E__1_N": {
      "a": "0_E",
      "b": "1_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "17_E__4_E": {
      "a": "17_E",
      "b": "4_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "10_N__13_N": {
      "a": "10_N",
      "b": "13_N",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "0_E__4_E": {
      "a": "0_E",
      "b": "4_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "14_N__9_E": {
      "a": "14_N",
      "b": "9_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "19_N__3_E": {
      "a": "19_N",
      "b": "3_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "12_N__1_E": {
      "a": "12_N",
      "b": "1_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "5_E__6_N": {
      "a": "5_E",
      "b": "6_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "16_N__3_E": {
      "a": "16_N",
      "b": "3_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "0_N__1_N": {
      "a": "0_N",
      "b": "1_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "16_E__9_E": {
      "a": "16_E",
      "b": "9_E",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "17_E__9_N": {
      "a": "17_E",
      "b": "9_N",
      "shown": 1,
      "aWins": 1,
      "bWins": 0,
      "aPref": 1,
      "bPref": 0
    },
    "15_E__2_E": {
      "a": "15_E",
      "b": "2_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    },
    "13_N__1_E": {
      "a": "13_N",
      "b": "1_E",
      "shown": 1,
      "aWins": 0,
      "bWins": 1,
      "aPref": 0,
      "bPref": 1
    }
};

// 將「卡片 + 是否強化」轉成 "0_N" / "0_E" 這種 key（跟偏好 JSON 相同）
function encodeVariantKey(st, cardId) {
  if (cardId == null) return null;
  const enhanced = isEnhancedNowCpu(st, cardId);
  return `${cardId}_${enhanced ? "E" : "N"}`;
}

// 讀出「手上是 (playId, keepId)」時，選擇打出 playId 的機率（0~100）
// - 沒資料就回 50（當作沒有特別偏好）
function getPairMatrixProb(st, playId, keepId) {
  const playKey = encodeVariantKey(st, playId);
  const keepKey = encodeVariantKey(st, keepId);
  if (!playKey || !keepKey || playKey === keepKey) return 50;

  // pairKey 的格式要跟 JSON 一樣：小的在前，大的在後，中間用 "__"
  const pairKey =
    playKey < keepKey ? `${playKey}__${keepKey}` : `${keepKey}__${playKey}`;

  const ps = PAIR_PREF[pairKey];
  if (!ps || !ps.shown) {
    // 這一對你沒遇過 / 還沒選過 → 當作 50%
    return 50;
  }

  let pref;
  if (playKey === ps.a) {
    pref = ps.aPref;  // JSON 裡「在這一對裡選 a 的機率」（0~1）
  } else if (playKey === ps.b) {
    pref = ps.bPref;  // 同上，選 b 的機率
  } else {
    // 理論上不會發生，保險一下
    return 50;
  }

  if (typeof pref !== "number" || !isFinite(pref)) return 50;

  // 0~1 → 0~100，順便壓在 0~100 之內
  const v = Math.round(pref * 100);
  return Math.max(0, Math.min(100, v));
}


// cpu.js（接續上面）

// 這個表改成「依照你實際 2 選 1 點選」的大致平均偏好
const BASE_CARD_SCORE = {
  0: 16, // 薩波
  1: 17, // 騙人布
  2: 19, // 羅賓
  3: 15, // 香吉士
  4: 25, // 喬巴：一般 / 強化你幾乎都選 → 給最高
  5: 17, // 索隆
  6: 5,  // 羅：整體幾乎不選
  7: 8,  // 娜美
  8: 10, // 魯夫
  9: 6,  // 漢考克：本來就靠場地判定
 10: 15, // 凱多
 11: 19, // 基德
 12: 16, // 奎因
 13: 18, // 基拉
 14: 23, // 大媽：你超常選
 15: 17, // 卡塔庫栗
 16: 15, // 青雉
 17: 12, // 黑鬍子
 18: 10, // 紅髮
 19: 5,  // 羅傑
};


function cardBaseScore(cardId){
  return BASE_CARD_SCORE[cardId] ?? 10;
}

// 根據目前場地 & 規則，回傳這張牌「這一局實際好不好用」的分數
// 強化技能 = 同一張卡的加強版，這裡會額外加減分
function cardScoreWithVenue(st, cardId) {
  if (cardId == null) return 0;

  let score = cardBaseScore(cardId);
  const enhanced = isEnhancedNowCpu(st, cardId);

  switch (cardId) {
    case 7: // 娜美：只有強化才有麻痺
      if (enhanced) score += 8;   // 有維薩利亞 → 控制牌，變強
      else          score -= 6;   // 沒場地 → 技能很弱，拉低一點
      break;

    case 5: // 索隆：和之國可直接秒殺偶數
      if (enhanced) score += 7;
      break;

    case 6: // 羅：龐克哈薩德先看再換
      if (enhanced) score += 4;
      break;

    case 8: // 魯夫：魚人島全場大砍，非常狠
      if (enhanced) score += 8;
      break;

    case 10: // 凱多：鬼島版更兇（之後要再加大媽 combo 可再加）
      if (enhanced) score += 6;
      break;

    case 11: // 基德：夏波帝全場換牌
      if (enhanced) score += 5;
      break;

    case 12: // 奎因：鬼島冰鬼
      if (enhanced) score += 5;
      break;

    case 13: // 基拉：夏波帝可以選擇決鬥
      if (enhanced) score += 4;
      break;

    case 14: // 大媽：萬國收保護費 / 直接殺人
      if (enhanced) score += 5;
      break;

    case 15: // 卡塔庫栗：萬國看更多張、重排頂牌
      if (enhanced) score += 5;
      break;

    case 16: // 青雉：蜂巢島凍全場
      if (enhanced) score += 5;
      break;

    case 17: // 黑鬍子：蜂巢島多張控制
      if (enhanced) score += 5;
      break;

    case 18: // 紅髮：奧羅傑克森號跟 HOT / final 關聯更大
      if (enhanced) score += 3;
      break;

    case 9: { // 漢考克：九蛇島才是保護牌，其他時候是自殺
      if (!enhanced) {
        // 沒九蛇島 → 打出就是自殺，極大負分，CPU 幾乎不會選
        score -= 999;
      } else {
        // 有九蛇島 → 很好的保護牌
        score += 10;
      }
      break;
    }

    case 19: { // 羅傑：奧羅傑克森號才會變預測，不然就是自殺
      if (!enhanced) {
        score -= 999;
      } else {
        // 強化版當作「預測 / 賽季分牌」用
        score += 10;
      }
      break;
    }

    // 你之後如果想讓 0 薩波在強化場地（德雷斯羅薩）加一點分，也可以這樣加：
    // case 0:
    //   if (enhanced) score += 3;
    //   break;
  }

  return score;
}


// 專門負責「抽完牌後，決定打 hand 還是 drawn」
// st: 現在局面
// meIdx: 我是第幾號玩家
function pickCpuCardSmart(st, meIdx){
  const me = st.players[meIdx];
  const a = me.hand;
  const b = me.tempDraw;

  // 兩種可能：
  //  - 打原本手牌（hand），留下剛抽的（drawn）
  //  - 打剛抽的（drawn），留下原本手牌（hand）
  const options = [
    { which: 'hand',  playId: a, keepId: b },
    { which: 'drawn', playId: b, keepId: a },
  ];

  // ★ 需要靠「留下來那張牌」決鬥 / 比牌的卡
  //   3：香吉士（以 keepId 的尾數去比）
  //   8：魯夫（兩次決鬥 / 魚人島強化也是看 keepId 尾數）
  //   10：凱多（普通版決鬥；強化版你之後要不要再細調都可以）
  //   13：基拉強化決鬥（看 keepId 尾數）
  const duelCards = [3, 8, 10, 13];

  function scoreOption(opt){
    const { which, playId } = opt;
    if (playId == null) return -99999;

    const wasFrozen = me.frozen;

    // === 規則 1：凍結 → 強制只能打抽到的那張 ===
    if (me.frozen && which !== 'drawn') {
      return -99999;
    }

    // === 規則 2：娜美 7 + 6/8 強制打 7（在不是凍結的情況下）===
    const has7 = (a === 7 || b === 7);
    const has68 = [a, b].some(x => x === 6 || x === 8);
    if (!wasFrozen && has7 && has68 && playId !== 7) {
      return -99999;
    }

    // 先給一個「單純看自己手牌」的基礎分
    let s = 0;

    const aliveCount = st.players.filter(p => p.alive).length;
    const deckLeft   = st.deck?.length ?? 99;
    const isDuelCard = duelCards.includes(playId);

    // 1) 卡片固有強度（會看現在有沒有強化場地）
    const baseScore = cardScoreWithVenue(st, playId);
    s += baseScore * 5;


    // 2) 尾數大小（比牌價值）
    s += tail(playId) * 4;

    // 3) 局面相關調整
    //   3-1) 人越少越偏向打「終結型」卡（索隆、魯夫、騙人布…）
    const finisherSet = new Set([1,5,7,8,10,12,16,17]);
    if (aliveCount <= 3 && finisherSet.has(playId)){
      s += 40;
    }

    //   3-2) 牌堆快沒了，紅髮 / HOT / 決鬥類稍微加分
    if (deckLeft <= st.players.length * 2){
      const hotSet = new Set([8,10,18,19]);
      if (hotSet.has(playId)) s += 25;
    }

    //   3-3) 自己沒保護/閃避 → 優先打保護牌（喬巴、大媽）
    const meProt = me.protected || me.dodging;
    if (!meProt && (playId === 4 || playId === 14)){
      s += 60;
    }

    //   3-4) 如果已經有保護/閃避，那就稍微把喬巴/大媽往後一點
    if (meProt && (playId === 4 || playId === 14)){
      s -= 20;
    }

    // 4) 目前手牌「留著」的價值（保留更好的那張）
    if (opt.keepId != null){
      s += tail(opt.keepId) * 2;                     // 留大尾數的牌比較好
      s += cardScoreWithVenue(st, opt.keepId) * 1.5; // 留「在現在場地很強」的牌也不錯
    }


    // 4.5) ★ 決鬥 / 比牌牌：要確保「留下來那張」夠大
    if (isDuelCard && opt.keepId != null){
      const kt = tail(opt.keepId);

      // 尾數很大（7/8/9），拿來決鬥超香 → 大加分
      if (kt >= 7){
        // 7 → +25，8 → +50，9 → +75
        s += (kt - 6) * 25;
      }

      // 尾數很小（0/1/2），等於是把自己送去決鬥 → 強烈扣分
      if (kt <= 2){
        // 2 → -40，1 → -80，0 → -120
        s -= (3 - kt) * 40;
      }
    }

    // 4.6) ★ 同時也偏好「把大尾數決鬥牌留下來」，不要丟掉
    if (opt.keepId != null && duelCards.includes(opt.keepId)){
      const kt = tail(opt.keepId);
      if (kt >= 7){
        // 這張本身就是很好的決鬥核心牌 → 再加一點分，讓 AI 比較願意把它留著
        s += (kt - 6) * 15;
      }
    }

    // 4.7) 雙卡出牌機率表（Excel）
    //      - 只對「非決鬥牌」生效
    //      - 雙卡狀況才看（opt.keepId 不為 null）
    if (!isDuelCard && opt.keepId != null) {
      const p = getPairMatrixProb(st, playId, opt.keepId); // 0~100，沒填＝50
      const delta = p - 50;   // -50~+50
      s += delta * 2;         // 權重可以之後再調整，現在大約是「每多 10% 多 20 分」
    }

    // 4.8) 紅髮 18：牌堆已經 ≤ HOT（預設 14）時，估算直接 final 的勝率
    if (playId === 18 && opt.keepId != null) {
      const hot = st.HOT ?? 14;
      if (deckLeft <= hot) {
        const winProb = estimateShanksWinProb(st, meIdx, opt.keepId); // 0~1

        // ★★ 重點：勝率 >= 80% 就一定打出 ★★
        if (winProb >= 0.8) {
          // 給一個超大加分，保證這個選項優先
          s += 10000;
        } else {
          // 沒到 80% 時，也用勝率稍微調整一下評分
          s += Math.round(winProb * 100); // 0~100，小影響
        }
      }
    }


    // 5) 避免打會卡死的牌（之後目標 / 猜數字 AI 完整後可以調回來）
    const needTarget = new Set([1,2,5,6,7,9,13,16,17,19]);
    if (needTarget.has(playId)){
      s -= 5;
    }

    return s;
  }

  let best = options[0];
  let bestScore = scoreOption(best);
  const s2 = scoreOption(options[1]);
  if (s2 > bestScore){
    best = options[1];
    bestScore = s2;
  }

  // 如果兩個都違反規則被打到 -99999，就隨便回一個讓引擎自己擋
  if (bestScore <= -90000) return 'drawn';

  return best.which; // 'hand' 或 'drawn'
}


// CPU 選「攻擊 / 偵查目標」
// 共通規則：
//   1. 只在「活著 & 不是自己」的人裡面選
//   2. 一般情況：優先沒保護、沒閃避 → 再看金幣最多 → 同金幣隨機
//   3. 基拉 13（for: 'killer'）：改成「優先有保護或有閃避」→ 再看金幣最多 → 同金幣隨機
function pickCpuTargetSmart(st, meIdx, opts = {}){
  const me = st.players[meIdx];
  if (!me) return null;

  // 1) 所有活著的敵人
  let enemies = st.players
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => i !== meIdx && p && p.alive);

  if (!enemies.length) return null;

  let candidates = enemies;

  // 2) avoidProtected / avoidDodging 只給「非 killer 模式」用
  //    （因為基拉就是要專門去打有盾 / 有閃避的人）
  if (opts.for !== 'killer') {
    if (opts.avoidProtected) {
      const f = candidates.filter(({ p }) => !p.protected);
      if (f.length) candidates = f;
    }
    if (opts.avoidDodging) {
      const f = candidates.filter(({ p }) => !p.dodging);
      if (f.length) candidates = f;
    }
  }

  if (!candidates.length) return null;

  // 3) 基礎模式 / killer 模式，決定「優先族群」

  if (opts.for === 'killer') {
    // ★ 基拉 13：優先「有保護 or 有閃避」的人
    let shielded = candidates.filter(({ p }) => p.protected || p.dodging);
    if (shielded.length) {
      candidates = shielded;
    }
    // 如果場上沒有人有盾，就退回原本 candidates，不特別挑
  } else {
    // 一般情況：優先「沒保護 & 沒閃避」
    let unshielded = candidates.filter(({ p }) => !p.protected && !p.dodging);
    if (unshielded.length) {
      candidates = unshielded;
    }
    // 如果大家都有盾，就照 candidates 原樣（沒辦法只能硬打）
  }

  if (!candidates.length) return null;

  // 4) 在候選人裡面找「金幣最多」
  let maxGold = -Infinity;
  for (const { p } of candidates) {
    const g = typeof p.gold === 'number' ? p.gold : 0;
    if (g > maxGold) maxGold = g;
  }

  // 5) 把金幣等於 maxGold 的全部挑出來
  const richest = candidates.filter(({ p }) => {
    const g = typeof p.gold === 'number' ? p.gold : 0;
    return g === maxGold;
  });

  // 6) 如果有很多個金幣一樣多，就在這幾個裡面隨機選一個
  const pick = richest[Math.floor(Math.random() * richest.length)];
  return pick ? pick.i : null;
}



// CPU 猜「騙人布」的尾數：
// - 只用公開資訊 + 自己的牌：COUNTS / 棄牌堆 / 自己手牌 & 暫抽
// - 參考 usoppHistory：同一局、同一個 target 已經猜錯的數字不再猜
// - 在剩下可以猜的 [0,2,3,4,5,6,7,8,9] 裡，挑「剩餘尾數張數最多」的那個
function pickCpuDigitSmart(st, meIdx, targetIdx){
  const me = st.players[meIdx];

  // 不能猜 1，規則限制
  const guessable = [0,2,3,4,5,6,7,8,9];

  // 0) 若這個 AI 有自己的「看過 target 手牌」記憶，直接猜那張牌的尾數
  if (Array.isArray(st.aiMemory)) {
    const mem = st.aiMemory[meIdx];
    const knownId = mem && mem.knownHands && mem.knownHands[targetIdx];

    if (typeof knownId === 'number') {
      const t = tail(knownId);
      // 不能猜 1，如果剛好是 1，就先忽略，走原本的機率邏輯
      if (t !== 1) {
        return t;
      }
    }
  }

  // ① 找出同一局、同一個 target 已經猜過的數字（且真的判定過）
  const history = Array.isArray(st.usoppHistory)
    ? st.usoppHistory.filter(h =>
        h.roundNo === (st.roundNo || 1) &&
        h.target === targetIdx
      )
    : [];

  const tried = new Set(history.map(h => h.digit));

  // 目前尚可猜的數字（排除已經證明錯誤的）
  let candidates = guessable.filter(d => !tried.has(d));
  if (!candidates.length) {
    // 理論上不會發生，保險：全部都被猜光了就先回 2
    return 2;
  }

  // 1.5 若引擎有「針對這個 target 的可能尾數集合」，跟 candidates 做交集
  if (Array.isArray(st.usoppHints) && Array.isArray(st.usoppHints[targetIdx])) {
    const hintSet = new Set(st.usoppHints[targetIdx]);
    const filtered = candidates.filter(d => hintSet.has(d));
    // 有交集就用交集；完全沒交集就維持原本 candidates（避免出現空集合）
    if (filtered.length > 0) {
      candidates = filtered;
    }
  }

  // ② 根據牌組 + 棄牌堆 + 自己手牌，估計每個尾數「還剩幾張」
  const remaining = TOTAL_TAIL_COUNTS.slice(); // 0~9

  // 2-1) 扣掉棄牌堆裡的牌
  (st.discard || []).forEach(x => {
    const id = (typeof x === 'number')
      ? x
      : (x && typeof x.id === 'number' ? x.id : null);
    if (typeof id === 'number') {
      const t = tail(id);
      if (t >= 0 && t < 10) remaining[t]--;
    }
  });

  // 2-2) 扣掉自己已知的牌（手牌 + 暫抽）
  if (me) {
    const knownIds = [];
    if (typeof me.hand === 'number')     knownIds.push(me.hand);
    if (typeof me.tempDraw === 'number') knownIds.push(me.tempDraw);
    knownIds.forEach(id => {
      const t = tail(id);
      if (t >= 0 && t < 10) remaining[t]--;
    });
  }

  // 2-3) 保險：避免數字跑到負的，全部壓到 0
  for (let i = 0; i < 10; i++) {
    if (remaining[i] < 0) remaining[i] = 0;
  }

  // ③ 在 candidates 裡面，挑「剩餘尾數張數」最大的那個
  let bestDigit = candidates[0];
  let bestWeight = -1;

  for (const d of candidates) {
    const w = remaining[d];

    // 你如果想要「稍微偏愛大尾數」可以改成：
    // const adj = w + (d >= 7 ? 0.1 : 0);
    const adj = w;

    if (adj > bestWeight) {
      bestWeight = adj;
      bestDigit = d;
    }
  }

  // ④ 萬一每個尾數都變成 0（理論上很少發生） → 隨機從 candidates 選一個
  if (bestWeight <= 0) {
    const idx = Math.floor(Math.random() * candidates.length);
    bestDigit = candidates[idx];
  }

  return bestDigit;
}


// 給紅髮 18 用：估計「現在打出 18 直接 final」的勝率（回傳 0~1）
function estimateShanksWinProb(st, meIdx, keepId) {
  const me = st.players[meIdx];
  if (!me || !me.alive) return 0;

  // 場上還活著的敵人數
  const enemies = st.players.filter((p, i) => p && p.alive && i !== meIdx);
  const nEnemies = enemies.length;
  if (!nEnemies) return 1;

  // 在奧羅傑克森號上，紅髮開 HOT 會 +1 點
  const venueActive = Array.isArray(st.venues)
    && st.venues.some(v => v && v.name === '奧羅傑克森號');

  let myVal = finalValue(keepId);
  if (venueActive) myVal += 1;

  // 1) 估計剩下的「final 點數」分布（只扣棄牌堆 + 自己手牌）
  const remaining = TOTAL_FINALVAL_COUNTS.slice(); // 複製一份

  const sub = (id) => {
    if (typeof id !== "number") return;
    const v = finalValue(id);
    if (v >= 0 && v < remaining.length) {
      remaining[v] = Math.max(0, remaining[v] - 1);
    }
  };

  // 1-1) 扣棄牌堆
  (st.discard || []).forEach(x => {
    const id = (typeof x === "number")
      ? x
      : (x && typeof x.id === "number" ? x.id : null);
    sub(id);
  });

  // 1-2) 扣自己已知的牌（手牌 + 暫抽）
  if (me) {
    sub(me.hand);
    sub(me.tempDraw);
  }

  // 1-3) 避免變成負數
  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i] < 0) remaining[i] = 0;
  }

  const totalRem = remaining.reduce((a, b) => a + b, 0);
  if (totalRem <= 0) return 0.5; // 理論上很少發生，當作五五開

  // 2) 一個敵人的牌比我小的機率
  let less = 0;
  for (let v = 0; v < myVal; v++) {
    less += remaining[v];
  }
  const pSingle = less / totalRem;

  // 3) 假設每個敵人獨立抽（近似）：全部都被我贏過的機率
  const pAll = Math.pow(pSingle, nEnemies);
  return pAll;
}


module.exports = {
  scoreStateForMe,
  pickCpuCardSmart,
  pickCpuTargetSmart,
  pickCpuDigitSmart,
};

