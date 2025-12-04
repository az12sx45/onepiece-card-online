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

function isEnhancedNowCpu(st, cardId) {
  const card = cardById(cardId);
  if (!card || !card.venue) return false;
  if (!Array.isArray(st.venues)) return false;
  return st.venues.some(v => v && v.name === card.venue);
}


// === 雙卡出牌偏好表（由 Excel 匯入）===
// index 0~19  = 一般 0~19
// index 20~39 = 強化 0~19
// 之後你可以把 cpu_play_matrix.xlsx 轉成 JSON，覆蓋掉 PAIR_MATRIX
const PAIR_MATRIX = [
  //  0: N0
  [null, 50, 50, 100, 0, 50, 50, 100, 100, 100, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  //  1: N1
  [null, 100, 50, 100, 0, 50, 50, 100, 100, 100, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  //  2: N2
  [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  //  3: N3
  [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  //  4: N4
  [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
  //  5: N5
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  //  6: N6
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  //  7: N7
  [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
  //  8: N8
  [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
  //  9: N9
  [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
  // 10: N10
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 11: N11
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 12: N12
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 13: N13
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 14: N14
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 15: N15
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 16: N16
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 17: N17
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 18: N18
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 19: N19
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 20: E0
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 21: E1
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 22: E2
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 23: E3
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 24: E4
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 25: E5
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 26: E6
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 27: E7
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 28: E8
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 29: E9
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 30: E10
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 31: E11
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 32: E12
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 33: E13
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 34: E14
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 35: E15
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 36: E16
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 37: E17
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 38: E18
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  // 39: E19
  [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
];


// 將「卡片 + 是否強化」轉成 0~39 的 index
function encodeCardStateIndex(st, cardId) {
  if (cardId == null) return null;
  const enhanced = isEnhancedNowCpu(st, cardId);
  return cardId + (enhanced ? 20 : 0);
}

// 讀出「手上是 (playId, keepId)」時，選擇打出 playId 的機率（0~100）
// - 沒填的格子（undefined / null）一律當作 50% 看待
function getPairMatrixProb(st, playId, keepId) {
  const i = encodeCardStateIndex(st, playId);
  const j = encodeCardStateIndex(st, keepId);
  if (i == null || j == null) return 50;

  const row = PAIR_MATRIX[i];
  if (!row) return 50;

  const v = row[j];
  if (typeof v === "number" && !Number.isNaN(v)) {
    // 保險一下 clamp 到 0~100
    return Math.max(0, Math.min(100, v));
  }
  return 50;
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
  9: 2,  // 漢考克：魅惑/控制
 10: 18,  // 凱多：大招（你這邊可以自己依規則調）
 11: 14,  // 基德：棄牌堆操作
 12: 17,  // 奎因：硬幣麻痺
 13: 16,  // 基拉：解除狀態
 14: 20,  // 大媽：保護/閃避 + 金幣
 15: 14,  // 卡塔庫栗：堆疊順序
 16: 18,  // 青雉：凍結
 17: 18,  // 黑鬍子：多功能控制
 18: 16,  // 紅髮：紅髮 HOT 相關
 19: 3,  // 羅傑：預測
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

