// cpu.js
const { applyAction, _util, COUNTS } = require("./engine.js");
const { tail } = _util;

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

// cpu.js（接續上面）

// 這個表只是一個「基礎喜好」，之後你可以慢慢調
const BASE_CARD_SCORE = {
  0:  8,  // 薩波：洗牌重抽，偏中立，後期稍微好用
  1: 16,  // 騙人布：命中可以直接殺人（如果你之後有幫他寫猜數字 AI，可以調更高）
  2: 10,  // 羅賓：偵查，偏資訊型
  3: 12,  // 香吉士：補牌/強化
  4: 20,  // 喬巴：保護 / 閃避，生存超重要，給高一點
  5: 22,  // 索隆：棄掉別人手牌，很狠
  6: 15,  // 羅：交換
  7: 18,  // 娜美：麻痺，控制很強
  8: 19,  // 魯夫：決鬥，能直接殺
  9: 13,  // 漢考克：魅惑/控制
 10: 18,  // 凱多：大招（你這邊可以自己依規則調）
 11: 14,  // 基德：棄牌堆操作
 12: 17,  // 奎因：硬幣麻痺
 13: 16,  // 基拉：解除狀態
 14: 20,  // 大媽：保護/閃避 + 金幣
 15: 14,  // 卡塔庫栗：堆疊順序
 16: 18,  // 青雉：凍結
 17: 18,  // 黑鬍子：多功能控制
 18: 16,  // 紅髮：紅髮 HOT 相關
 19: 16,  // 羅傑：預測
};

function cardBaseScore(cardId){
  return BASE_CARD_SCORE[cardId] ?? 10;
}

// 專門負責「抽完牌後，決定打 hand 還是 drawn」
function pickCpuCardSmart(st, meIdx){
  const me = st.players[meIdx];
  const a = me.hand;
  const b = me.tempDraw;

  const options = [
    { which: 'hand',  playId: a, keepId: b },
    { which: 'drawn', playId: b, keepId: a },
  ];

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
    const has68 = [a,b].some(x => x === 6 || x === 8);
    if (!wasFrozen && has7 && has68 && playId !== 7) {
      return -99999;
    }

    // 先給一個「單純看自己手牌」的基礎分
    let s = 0;

    // 1) 卡片固有強度
    s += cardBaseScore(playId) * 5;

    // 2) 尾數大小（比牌價值）
    s += tail(playId) * 4;

    // 3) 局面相關調整
    const aliveCount = st.players.filter(p => p.alive).length;
    const deckLeft   = st.deck?.length ?? 99;

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

    // 4) 目前手牌留著的價值（保留更好的那張）
    if (opt.keepId != null){
      s += tail(opt.keepId) * 2;             // 留大尾數的牌比較好
      s += cardBaseScore(opt.keepId) * 1.5;  // 留功能卡也不錯
    }

    // 5) 避免打會卡死的牌（之後還沒寫 CPU 目標/猜數字邏輯時，可以暫時拉低）
    //    例如還沒做 PICK_TARGET AI 前，你可以在這裡對 1,2,5,6,7,13 等扣一點分，
    //    等你把「選目標 AI」也做好，再把這個扣分拿掉。
    const needTarget = new Set([1,2,5,6,7,9,13,16,17,19]);
    if (needTarget.has(playId)){
      s -= 5; // 之後可以調成 0 或改加分
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

// CPU 選「攻擊/偵查目標」
//   目前會看：
//   - 活著的玩家
//   - 盡量避開保護 / 閃避（如果有 avoidProtected / avoidDodging）
//   - 偷窺真實手牌，挑「尾數大、功能分高」的目標（所以會超強）
function pickCpuTargetSmart(st, meIdx, opts = {}){
  const me = st.players[meIdx];
  if (!me) return null;

  let enemies = st.players
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => i !== meIdx && p && p.alive);

  if (!enemies.length) return null;

  // 可選：盡量避免打到保護/閃避
  if (opts.avoidProtected) {
    const f = enemies.filter(({ p }) => !p.protected);
    if (f.length) enemies = f;
  }
  if (opts.avoidDodging) {
    const f = enemies.filter(({ p }) => !p.dodging);
    if (f.length) enemies = f;
  }

  let bestIdx = enemies[0].i;
  let bestScore = -Infinity;

  for (const { p, i } of enemies) {
    const cardId = p.hand;
    let s = 0;

    if (typeof cardId === 'number') {
      // 功能越狠越想處理
      s += cardBaseScore(cardId) * 3;
      // 尾數越大，比牌越兇
      s += tail(cardId) * 2;
    }

    if (p.protected) s -= 5;
    if (p.dodging)   s -= 5;

    bestIdx = (s > bestScore) ? (bestScore = s, i) : bestIdx;
  }

  return bestIdx;
}

// CPU 猜「騙人布」的尾數：
// - 只用公開資訊 + 自己的牌：COUNTS / 棄牌堆 / 自己手牌 & 暫抽
// - 參考 usoppHistory：同一局、同一個 target 已經猜錯的數字不再猜
// - 在剩下可以猜的 [0,2,3,4,5,6,7,8,9] 裡，挑「剩餘尾數張數最多」的那個
function pickCpuDigitSmart(st, meIdx, targetIdx){
  const me = st.players[meIdx];

  // 不能猜 1，規則限制
  const guessable = [0,2,3,4,5,6,7,8,9];

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


// 原本的：依牌局評分（你現有的邏輯）
function cardBaseScore(cardId){
  return BASE_CARD_SCORE[cardId] ?? 10;
}


module.exports = {
  scoreStateForMe,
  pickCpuCardSmart,
  pickCpuTargetSmart,
  pickCpuDigitSmart,
};

