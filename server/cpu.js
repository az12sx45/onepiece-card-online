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

// =============================
// 保守型 CPU AI：大局觀強化參數
// =============================
// 取向：保守（優先保命 / 資訊 / 控場），除非能高機率淘汰對手
const AI_STYLE = {
  // 若某行動「淘汰機率」達到這個門檻，就願意積極出手
  killProbGo: 0.70,
  // 若淘汰目標是領先者，可稍微降低門檻
  killProbGoVsLeader: 0.60,
  // Usopp 猜尾數：命中率太低就不要賭
  guessMinHitProb: 0.35,
  // 領先者判定：金幣差距達到多少算領先
  leaderGoldDelta: 2,
};

function getLeaderIdx(st){
  let bestIdx = null;
  let bestGold = -Infinity;
  const players = st.players || [];
  for(let i=0;i<players.length;i++){
    const p = players[i];
    if(!p?.alive) continue;
    const g = Number(p.gold||0);
    if(g > bestGold){ bestGold = g; bestIdx = i; }
  }
  return bestIdx;
}

function threatScore(st, meIdx, idx){
  const players = st.players || [];
  const p = players[idx];
  if(!p?.alive || idx === meIdx) return -Infinity;

  let s = 0;
  const g = Number(p.gold||0);
  s += g * 10;

  // 難殺程度（保護/閃避）
  if(p.protected) s += 6;
  if(p.dodging)  s += 4;

  // 被控場 → 威脅下降
  if(p.frozen)      s -= 4;
  if(p.iceInfected) s -= 3;

  // 已知尾數（資訊）
  const mem = Array.isArray(st.aiMemory) ? st.aiMemory[meIdx] : null;
  if(mem?.knownHands && typeof mem.knownHands[idx] === 'number'){
    s += tail(mem.knownHands[idx]) * 1.5;
  }

  return s;
}

// 淘汰價值：越該殺的人值越高（領先者/高威脅者優先）
function elimValue(st, meIdx, idx){
  const leader = getLeaderIdx(st);
  let v = 1;

  const ts = threatScore(st, meIdx, idx);
  if(Number.isFinite(ts)) v += Math.max(0, ts) * 0.15;

  if(idx === leader) v += 2.0;
  return v;
}

// 模擬：在 cloneState 上套用 action
function simApply(st, action){
  return applyAction(st, action).state;
}

// 判斷目前 pending 是否輪到我輸入（target / digit）
function myPendingNeed(st, meIdx){
  const p = st.pending;
  if(!p) return null;

  // Usopp：先 target 再 digit；target 存在 p.extra.target
  if(p.action === 'usopp'){
    const t = p?.extra?.target;
    if(typeof t !== 'number') return { kind: 'target' };
    return { kind: 'digit', targetIdx: t };
  }

  // 通用：若 pending 已經指向我，且還沒有 target（很多牌都是先選 target）
  if(p.action && p.playerId === meIdx){
    // 大多數 target 會放 p.target 或 p.extra.target
    const t1 = p.target;
    const t2 = p?.extra?.target;
    if(typeof t1 !== 'number' && typeof t2 !== 'number'){
      // 排除少數多段互動，不在這裡自動模擬，避免卡死
      if(p.action === 'kata-order' || p.action === 'teach-multipick' || p.action === 'queen') return null;
      return { kind: 'target' };
    }
  }

  return null;
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

  // === 保守型：用「小深度模擬」做最終裁決（大局觀：看其他玩家狀態） ===
  // 只有當模擬的局面分差夠明顯時，才覆蓋 heuristic，避免效能/隨機波動
  function simulateWhich(which){
    let sim = cloneState(st);
    sim = simApply(sim, { type:'PLAY_CARD', playerId: meIdx, payload:{ which } });

    // 若打完牌還需要我選 target / digit，就用目前 CPU 決策解完
    for(let guard=0; guard<6; guard++){
      const need = myPendingNeed(sim, meIdx);
      if(!need) break;

      if(need.kind === 'target'){
        const t = pickCpuTargetSmart(sim, meIdx, { avoidProtected:false, avoidDodging:false });
        sim = simApply(sim, { type:'PICK_TARGET', playerId: meIdx, payload:{ target: t } });
        continue;
      }

      if(need.kind === 'digit'){
        const d = pickCpuDigitSmart(sim, meIdx, need.targetIdx);
        sim = simApply(sim, { type:'PICK_DIGIT', playerId: meIdx, payload:{ digit: d } });
        continue;
      }

      break;
    }

    return scoreStateForMe(sim, meIdx);
  }

  // 模擬只在兩個選項都可行時進行
  if (bestScore > -90000) {
    const simHand  = simulateWhich('hand');
    const simDrawn = simulateWhich('drawn');

    // 分差門檻：越保守越不容易被模擬翻盤
    if (Math.abs(simHand - simDrawn) >= 40) {
      if (simHand >= simDrawn) {
        best = options[0];
        bestScore = simHand;
      } else {
        best = options[1];
        bestScore = simDrawn;
      }
    }
  }

  // 如果兩個都違反規則被打到 -99999，就隨便回一個讓引擎自己擋
  if (bestScore <= -90000) return 'drawn';

  return best.which; // 'hand' 或 'drawn'
}


// CPU 選「攻擊 / 偵查目標」
// 這裡會依照不同卡牌（看 st.pending.action / extra.boost）做專用的目標優先順序
function pickCpuTargetSmart(st, meIdx, opts = {}) {
  const players = st.players || [];
  const me = players[meIdx];
  if (!me || !me.alive) return null;

  // 目前場上還活著的其他玩家
  const enemies = players
    .map((p, idx) => ({ p, idx }))
    .filter(x => x.p && x.p.alive && x.idx !== meIdx);

  if (!enemies.length) return null;

  const pending = st.pending || null;
  const act = pending && pending.action ? pending.action : null;
  const isBoost = !!(pending && pending.extra && pending.extra.boost);

  // === 保守型：大局觀（領先者/威脅） ===
  const leaderIdx = getLeaderIdx(st);

  // 用於 usopp：估計命中率（基於 knownHands / hints）
  function estimateUsoppHitProb(targetIdx){
    const mem = Array.isArray(st.aiMemory) ? st.aiMemory[meIdx] : null;
    if(mem?.knownHands && typeof mem.knownHands[targetIdx] === 'number') return 1.0;
    if(Array.isArray(st.usoppHints) && Array.isArray(st.usoppHints[targetIdx]) && st.usoppHints[targetIdx].length){
      const k = st.usoppHints[targetIdx].length;
      return 1 / Math.max(1, k);
    }
    // 沒資訊：保守，不喜歡硬賭
    return 0.15;
  }

  // 用於決鬥：粗估我贏對方的機率（已知→精準；未知→用尾數大小近似）
  function estimateDuelWinProb(targetIdx, myKeepId){
    const myT = tail(myKeepId);
    const mem = Array.isArray(st.aiMemory) ? st.aiMemory[meIdx] : null;
    if(mem?.knownHands && typeof mem.knownHands[targetIdx] === 'number') {
      const oppT = tail(mem.knownHands[targetIdx]);
      if(myT > oppT) return 1.0;
      if(myT === oppT) return 0.5;
      return 0.0;
    }
    // 未知：尾數越大越可能贏（粗估，用來排序足夠）
    return Math.min(0.95, Math.max(0.05, (myT + 1) / 10));
  }

  // 呼叫方原本帶進來的選項
  const avoidProtectedRaw = !!opts.avoidProtected;
  const avoidDodgingRaw = !!opts.avoidDodging;

  // 0,1,2 特例：就算呼叫時有設定 avoidDodging，也要允許打正在閃避的人
  const ignoreDodgeForBreak =
    act === 'sabo' ||  // 0
    act === 'usopp' || // 1
    act === 'nami';    // 2

  const avoidProtected = avoidProtectedRaw;
  const avoidDodging = ignoreDodgeForBreak ? false : avoidDodgingRaw;

  // 先依照 avoidProtected / avoidDodging 過濾一輪
  let candidates = enemies.filter(x => {
    const p = x.p;
    if (avoidProtected && p.protected) return false;
    if (avoidDodging && p.dodging) return false;
    return true;
  });

  // ⭐ 關鍵修正：
  // 如果因為「全員都有保護 / 閃避」導致一個候選都沒有，
  // 就退一步：改用所有活著的敵人當候選，寧可被擋掉，也不要讓 AI 卡死。
  if (!candidates.length) {
    candidates = enemies.slice();
  }

  const shieldedIdx = candidates.filter(x => x.p.protected).map(x => x.idx);
  const dodgingIdx  = candidates.filter(x => x.p.dodging).map(x => x.idx);

  // 小工具：算牌尾數（0~9）
  const cardTail = (id) => {
    if (typeof id !== 'number') return null;
    return ((id % 10) + 10) % 10;
  };

  // 小工具：從一組候選裡挑「金幣最多的」，同金幣就隨機其一
  function pickRichest(subsetIdxList) {
    let list = candidates;
    if (Array.isArray(subsetIdxList) && subsetIdxList.length) {
      const set = new Set(subsetIdxList);
      const filtered = candidates.filter(x => set.has(x.idx));
      if (filtered.length) list = filtered;
    }

    let bestGold = -Infinity;
    let best = [];
    for (const x of list) {
      const g = typeof x.p.gold === 'number' ? x.p.gold : 0;
      if (g > bestGold) {
        bestGold = g;
        best = [x.idx];
      } else if (g === bestGold) {
        best.push(x.idx);
      }
    }
    const choice = best[Math.floor(Math.random() * best.length)];
    return choice;
  }

  // 小工具：取出對「某一個目標」目前掌握的尾數資訊
  function getTailInfo(targetIdx) {
    const mem = Array.isArray(st.aiMemory) ? st.aiMemory[meIdx] : null;
    let est = null;
    let fromKnown = false;

    // 1) 如果 AI 記憶裡已經知道這個人的牌 → 直接用那張牌的尾數
    if (mem && mem.knownHands && typeof mem.knownHands[targetIdx] === 'number') {
      est = cardTail(mem.knownHands[targetIdx]);
      fromKnown = true;
    } else if (
      Array.isArray(st.usoppHints) &&
      Array.isArray(st.usoppHints[targetIdx]) &&
      st.usoppHints[targetIdx].length
    ) {
      // 2) Usopp 提示：這個人可能的尾數集合（例如 [1, 9]）
      const arr = st.usoppHints[targetIdx];
      const sum = arr.reduce((a, b) => a + b, 0);
      est = sum / arr.length; // 用平均當作「推測尾數」
    }

    return {
      hasInfo: typeof est === 'number' && !Number.isNaN(est),
      estTail: est,   // 可能是 0~9，也可能是浮點數（平均）
      sure: fromKnown // true 表示「手牌完全確定」
    };
  }

  const myTail = typeof me.hand === 'number' ? cardTail(me.hand) : null;

  // ------------------------------------------------------------------
  // A. 0,1,2：優先打「正在閃避」的玩家，用來拆閃避狀態
  // ------------------------------------------------------------------
  if (act === 'sabo' || act === 'usopp' || act === 'nami') {
    if (dodgingIdx.length) {
      // 有人在閃避 → 只在這些人裡面挑「金幣最多」的
      return pickRichest(dodgingIdx);
    }
    // 沒人閃避 → 之後走通用規則（或其他卡的特例）
  }

  // ------------------------------------------------------------------
  // B. 13 一般 + 13 強化（killer）：優先打有防禦的玩家
  // ------------------------------------------------------------------
  if (act === 'killer') {
    if (shieldedIdx.length) {
      // 有人在 protected → 只在有防禦的人裡挑最優先的（這裡先用金幣）
      return pickRichest(shieldedIdx);
    }
    // 沒人有防禦 → 若是強化版還會走「決鬥優先」那段
  }


  // ------------------------------------------------------------------
  // C. 決鬥類：3, 8, 10, 13 強化
  //    保守型：優先「高勝率」且「淘汰價值高」的目標
  // ------------------------------------------------------------------
  const isDuelCard =
    act === 'sanji' || // 3
    act === 'luffy' || // 8
    act === 'kaido' || // 10
    (act === 'killer' && isBoost); // 13 強化才會決鬥

  if (isDuelCard) {
    const myKeepId = pending?.extra?.keep;

    // 若引擎沒有帶 keep（理論上不太會），就退回原本「找尾數小」邏輯
    if (typeof myKeepId !== 'number') {
      let bestIdx = null;
      let bestScore = Infinity;

      for (const { idx } of candidates) {
        const info = getTailInfo(idx);
        if (!info.hasInfo) continue;

        let score = info.estTail;
        if (info.sure) score -= 0.3;
        if (myTail != null && info.estTail >= myTail) score += 2;

        if (score < bestScore) {
          bestScore = score;
          bestIdx = idx;
        }
      }
      if (bestIdx != null) return bestIdx;

    } else {
      // 期望收益：P(win) * elimValue
      let bestIdx = null;
      let bestU = -Infinity;
      let bestWinP = 0;

      for (const { idx } of candidates) {
        const winP = estimateDuelWinProb(idx, myKeepId);
        const u = winP * elimValue(st, meIdx, idx);
        if (u > bestU) {
          bestU = u;
          bestIdx = idx;
          bestWinP = winP;
        }
      }

      if (bestIdx != null) {
        // 保守：若勝率很低，寧可挑「最容易贏的」，而不是硬鎖某個高價值目標
        const leaderGate = (bestIdx === leaderIdx) ? AI_STYLE.killProbGoVsLeader : AI_STYLE.killProbGo;
        if (bestWinP >= leaderGate) {
          return bestIdx;
        }

        // fallback：純看勝率最大
        let winBest = null;
        let winBestP = -Infinity;
        for (const { idx } of candidates) {
          const winP = estimateDuelWinProb(idx, myKeepId);
          if (winP > winBestP) { winBestP = winP; winBest = idx; }
        }
        if (winBest != null) return winBest;
      }
    }
    // 沒資訊 → 之後走通用規則
  }


  // ------------------------------------------------------------------
  // D. 1（usopp）：保守型 → 選「期望淘汰收益」最高的目標
  //    Expected = P(hit) * elimValue
  //    命中率太低時，不硬鎖領先者（避免亂賭）
  // ------------------------------------------------------------------
  if (act === 'usopp') {
    let bestIdx = candidates[0].idx;
    let bestU = -Infinity;
    let bestHitP = 0;

    for (const { idx } of candidates) {
      const hitP = estimateUsoppHitProb(idx);
      const u = hitP * elimValue(st, meIdx, idx);
      if (u > bestU) {
        bestU = u;
        bestIdx = idx;
        bestHitP = hitP;
      }
    }

    // 保守：若最佳命中率仍低於門檻，就改挑「最好猜的」而非單純高價值
    if (bestHitP < AI_STYLE.guessMinHitProb) {
      let easiestIdx = bestIdx;
      let easiestP = -Infinity;
      for (const { idx } of candidates) {
        const p = estimateUsoppHitProb(idx);
        if (p > easiestP) { easiestP = p; easiestIdx = idx; }
      }
      return easiestIdx;
    }

    return bestIdx;
  }

  // ------------------------------------------------------------------
  // E. 5,6：優先打「已經確認尾數是 9」的人
  // ------------------------------------------------------------------
  if (act === 'zoro' || act === 'law') {
    const mem = Array.isArray(st.aiMemory) ? st.aiMemory[meIdx] : null;
    const candWithNine = [];

    for (const { idx } of candidates) {
      let sureNine = false;

      if (mem && mem.knownHands && typeof mem.knownHands[idx] === 'number') {
        if (cardTail(mem.knownHands[idx]) === 9) sureNine = true;
      } else if (
        Array.isArray(st.usoppHints) &&
        Array.isArray(st.usoppHints[idx]) &&
        st.usoppHints[idx].length === 1 &&
        st.usoppHints[idx][0] === 9
      ) {
        // 提示結果只剩 [9]，等同「確定尾數是 9」
        sureNine = true;
      }

      if (sureNine) candWithNine.push(idx);
    }

    if (candWithNine.length) {
      return pickRichest(candWithNine);
    }
    // 沒有尾數 9 的明確目標 → 繼續看 5 強化那段（偶數），再不行就回通用規則
  }

  // ------------------------------------------------------------------
  // F. 5 強化：優先攻擊「確定尾數為偶數」的人
  // ------------------------------------------------------------------
  if (act === 'zoro' && isBoost) {
    const mem = Array.isArray(st.aiMemory) ? st.aiMemory[meIdx] : null;
    const evenTargets = [];

    for (const { idx } of candidates) {
      let sureEven = false;

      if (mem && mem.knownHands && typeof mem.knownHands[idx] === 'number') {
        if ((cardTail(mem.knownHands[idx]) % 2) === 0) sureEven = true;
      } else if (
        Array.isArray(st.usoppHints) &&
        Array.isArray(st.usoppHints[idx]) &&
        st.usoppHints[idx].length === 1 &&
        (st.usoppHints[idx][0] % 2) === 0
      ) {
        // 提示只剩 [0] / [2] / [4] / [6] / [8]
        sureEven = true;
      }

      if (sureEven) evenTargets.push(idx);
    }

    if (evenTargets.length) {
      return pickRichest(evenTargets);
    }
    // 找不到「確定偶數」的人 → 之後走通用規則
  }

  // ------------------------------------------------------------------
  // G. 通用規則：金幣最多優先，同金幣隨機
  // ------------------------------------------------------------------
  return pickRichest(null);
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


  // ③ 把 remaining 當作先驗，算出「在 candidates 條件下」的後驗分布
  const probs = {};
  let sum = 0;
  for (const d of candidates) {
    const w = remaining[d];
    if (w > 0) {
      probs[d] = w;
      sum += w;
    } else {
      probs[d] = 0;
    }
  }

  // 全部為 0（理論上很少）：退回隨機猜一個候選
  if (sum <= 0) {
    const idx = Math.floor(Math.random() * candidates.length);
    return candidates[idx];
  }

  for (const d of candidates) {
    probs[d] = probs[d] / sum;
  }

  // ④ 保守型選擇：最大化 Expected = P(d) * elimValue(target)
  //    但若最高命中率 < guessMinHitProb，就只選「純命中率最高」避免亂賭
  let maxP = -1;
  for (const d of candidates) {
    if (probs[d] > maxP) maxP = probs[d];
  }

  const evTarget = elimValue(st, meIdx, targetIdx);

  let bestDigits = [];
  let bestScore = -Infinity;

  for (const d of candidates) {
    const p = probs[d];
    const score = (maxP < AI_STYLE.guessMinHitProb)
      ? p
      : (p * evTarget);

    if (score > bestScore) {
      bestScore = score;
      bestDigits = [d];
    } else if (score === bestScore) {
      bestDigits.push(d);
    }
  }

  const pool = bestDigits.length ? bestDigits : candidates;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];

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


