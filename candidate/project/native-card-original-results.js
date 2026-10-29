'use strict';
// Generated unchanged pure formulas from formal game.html/result.html. Do not edit.
// game SHA256 3996061bc9f655abfd9df4d97d5c4a952a1a36a7d6233bb826fd2b2f92240eb9
// result SHA256 d1f8de150fe8e7d1abf9037d01b8151600b48ebe41d16db99450d204ed58733a
function clamp(n, a, b){ n = Number(n); if(!Number.isFinite(n)) n = a; return Math.max(a, Math.min(b, n)); }
function normTier(t){
  const n = Number(t);
  if(!Number.isFinite(n)) return 1;
  return clamp(Math.round(n), 1, 6);
}
function round(n){ return Math.round(Number(n) || 0); }
function fmtSigned(n){
  const x = Number(n)||0;
  return (x>0?'+':'') + String(x);
}
function fmtSigned(n){
  const x = Number(n)||0;
  return (x>0?'+':'') + String(x);
}
function ensureRank(rank){
  const base = { tier:0, rp:0, dropShield:0, placement:{ games:0, score:0 }, updatedAt:0 };
  const r = (rank && typeof rank === 'object') ? { ...base, ...rank } : { ...base };

  r.tier = clamp(round(r.tier), 0, 7);
  r.rp = Number(r.rp) || 0;
  r.dropShield = (Number(r.dropShield) === 1) ? 1 : 0;

  if (r.tier === 0){
    if (!r.placement || typeof r.placement !== 'object') r.placement = { games: 0, score: 0 };
    r.placement.games = clamp(round(r.placement.games), 0, 3);
    r.placement.score = Number(r.placement.score) || 0;
  }else{
    delete r.placement;
  }

  r.updatedAt = Number(r.updatedAt) || 0;
  return r;
}
function M_of_P(P){
  const map = { 2:1.00, 3:1.10, 4:1.22, 5:1.35, 6:1.50 };
  return map[P] || 1.00;
}
function applyPlacement(rank, P, myCoins, totalCoins){
  const r = ensureRank(rank);
  if (r.tier !== 0) return r;

  const safeTotal = totalCoins > 0 ? totalCoins : 1;
  const share = myCoins / safeTotal;
  const expected = 1 / P;
  const perf = share - expected;

  r.placement = r.placement || { games: 0, score: 0 };
  r.placement.games = clamp((r.placement.games||0) + 1, 0, 3);
  r.placement.score = (Number(r.placement.score)||0) + perf;

  if (r.placement.games >= 3){
    const S = r.placement.score;

    let decidedTier = 1;
    let startRp = 0;

    if (S <= -0.12) { decidedTier = 1; startRp = 0; }
    else if (S <= 0.04) { decidedTier = 2; startRp = 25; }
    else if (S <= 0.16) { decidedTier = 3; startRp = 40; }
    else { decidedTier = 4; startRp = 50; }

    r.tier = decidedTier;
    r.rp = startRp;
    r.dropShield = 0;
    delete r.placement;
  }

  r.updatedAt = Date.now();
  return r;
}
function applyRankedDelta(rank, P, myCoins, totalCoins){
  const r0 = ensureRank(rank);
  if (r0.tier <= 0) return r0;

  const tier = r0.tier;
  const safeTotal = totalCoins > 0 ? totalCoins : 1;
  const share = myCoins / safeTotal;
  const expected = 1 / P;
  const diff = share - expected;

  const K0 = 190;
  const baseDelta = round(K0 * diff);

  const M = M_of_P(P);
  const baseDelta2 = round(baseDelta * M);

  const G = { 1:1.35, 2:1.25, 3:1.15, 4:1.00, 5:0.90, 6:0.80, 7:0.70 };
  const L = { 1:0.75, 2:0.85, 3:0.95, 4:1.00, 5:1.10, 6:1.20, 7:1.30 };

  let dRP = 0;
  if (baseDelta2 > 0) dRP = round(baseDelta2 * (G[tier] ?? 1));
  else dRP = round(baseDelta2 * (L[tier] ?? 1));

  const capTier = { 1:55, 2:50, 3:45, 4:40, 5:36, 6:32, 7:28 };
  const cap = round((capTier[tier] ?? 40) * M);
  dRP = clamp(dRP, -cap, +cap);

  const r = { ...r0 };
  r.rp = (Number(r.rp)||0) + dRP;

  // 方案1：贏一場重置保護
  if (dRP > 0) r.dropShield = 0;

  // 升級（tier 1~6）
  while (r.tier < 7 && r.rp >= 100){
    r.tier += 1;
    r.rp -= 100;
    r.dropShield = 0;
  }

  // 降級規則
  if (r.tier <= 3){
    r.rp = Math.max(0, r.rp);
  }else{
    if (r.rp < 0){
      if (r.dropShield === 0){
        r.rp = 0;
        r.dropShield = 1;
      }else{
        r.tier -= 1;
        r.rp = 25;
        r.dropShield = 0;
      }
    }
  }

  r.updatedAt = Date.now();
  return r;
}
function captureRankUiMeta(before, after){
  const b = ensureRank(before);
  const a = ensureRank(after);

  if(b.tier === 0 || a.tier === 0){
    const bg = b.placement?.games ?? 0;
    const ag = a.placement?.games ?? 0;
    const ds = Number(a.placement?.score||0) - Number(b.placement?.score||0);
    const txt = (ag>bg) ? `第 ${ag} 場` : '';
    const perfTxt = (ds !== 0) ? `（${fmtSigned(ds.toFixed(3))}）` : '';
    return { deltaText: txt ? (txt + perfTxt) : '', deltaSign: (ds>0?1:(ds<0?-1:0)) };
  }

  const d = (Number(a.rp)||0) - (Number(b.rp)||0);
  if(a.tier > b.tier) return { deltaText:`↑ 升級！`, deltaSign: +1 };
  if(a.tier < b.tier) return { deltaText:`↓ 降級`, deltaSign: -1 };

  if(d === 0) return { deltaText:'', deltaSign:0 };
  return { deltaText:`${fmtSigned(d)} RP`, deltaSign:(d>0?1:-1) };
}
function defaultClient(){
  return {
    version: 2,
    player: { name:'', avatar:'' },
    totals: { games:0, wins:0, coins:0 },
    recent: [],                 // [{matchKey, ts, place, coinsGain, unlocked:[]}]
    deluxeUnlocked: [],         // [cardNo,...]
    titles: { owned: [], equipped:'', equippedTier: 1 }, // owned: [{label,tier}]
    bountyPosters: [],          // [{key, ts, title, name, bounty, avatar}]
    _appliedMatchKeys: [],      // [matchKey,...] 防止重複累加

    // ✅ 段位系統（新增）
    rank: {
      tier: 0,              // 0=未定位；1~7=正式段位
      rp: 0,                // tier1~6: 0~99；tier7: 0~∞
      dropShield: 0,        // 0=未使用負分保護；1=已使用
      placement: {          // 只有 tier=0 時使用
        games: 0,           // 0~3
        score: 0            // Σ(perf)
      },
      updatedAt: 0
    }
  };
}
function normTier(t){
  const n = Number(t);
  if(!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(6, Math.round(n)));
}
function normalizeOwnedTitles(arr){
  const out = [];
  const list = Array.isArray(arr) ? arr : [];
  for(const it of list){
    let label = '';
    let tier = 1;
    if(typeof it === 'string'){
      label = String(it).trim();
      tier = 1;
    }else if(it && typeof it === 'object'){
      label = String(it.label ?? it.text ?? '').trim();
      tier = normTier(it.tier ?? it.level ?? 1);
    }
    if(!label) continue;
    const hit = out.find(x => x.label === label);
    if(hit) hit.tier = Math.max(hit.tier, tier);
    else out.push({ label, tier });
  }
  return out;
}
function upsertOwnedTitle(owned, label, tier){
  const L = String(label||'').trim();
  if(!L) return normalizeOwnedTitles(owned);
  const t = normTier(tier || 1);
  const arr = normalizeOwnedTitles(owned);
  const hit = arr.find(x => x.label === L);
  if(hit) hit.tier = Math.max(hit.tier, t);
  else arr.push({ label: L, tier: t });
  return arr;
}
function computeBountyFromScore(score, playerCount){
  const s = score || {};
  const coins = +s.coinScore || 0;
  const atk   = +s.atkScore   || 0;
  const hit   = +s.hitScore   || 0;
  const def   = +s.defScore   || 0;
  const intel = +s.intelScore || 0;
  const surv  = +s.survivalScore || 0;

  const N = playerCount || 4;
  const factor = 6 / N;

  return (
    coins * 200000000 * factor +
    (atk + hit) * 10000000 * factor +
    (def + intel + surv) * 5000000 * factor
  );
}
function decideTierByBounty(bounty){
  if (bounty <   1000000000) return 1; // <10 億
  if (bounty <   3000000000) return 2; // 10–30 億
  if (bounty <   4000000000) return 3; // 30–40 億
  if (bounty <   5000000000) return 4; // 40–50 億
  if (bounty <   6000000000) return 5; // 50–60 億
  return 6;                             // 60 億以上
}
function pickMainMetricKey(row){
  const keys = ['atkScore','hitScore','defScore','intelScore','survivalScore'];
  let bestKey = keys[0];
  let bestVal = -Infinity;
  for(const k of keys){
    const v = Number(row[k]||0);
    if (v > bestVal){
      bestVal = v;
      bestKey = k;
    }
  }
  return bestKey;
}
function getTitleInfoForRow(row, playerCount){
  const score = {
    coinScore: row.coinScore,
    atkScore: row.atkScore,
    defScore: row.defScore,
    hitScore: row.hitScore,
    intelScore: row.intelScore,
    survivalScore: row.survivalScore
  };
  const bounty = computeBountyFromScore(score, playerCount);
  const tier = decideTierByBounty(bounty);
  const mainKey = pickMainMetricKey(row);
  const tableByKey = TITLE_TABLE[mainKey] || {};
  const label = tableByKey[tier] || '';
  const metricName = METRIC_NAME_MAP[mainKey] || '';

  return {
    bounty,
    tier,
    mainKey,
    metricName,
    label
  };
}
const TITLE_TABLE = {
  atkScore: {
    1:'  斬斷鋼鐵的力量  ',
    2:'  流櫻見習生  ',
    3:'  霸王色纏繞者  ',
    4:'  鐵拳  ',
    5:'  世界最強的男人  ',
    6:'  世界最強生物  '
  },
  hitScore: {
    1:'  騙人布橡皮筋  ',
    2:'  狙擊手  ',
    3:'  狙擊王  ',
    4:'  神的制裁  ',
    5:'  超音速狙擊手  ',
    6:'  我能打中螞蟻的眉心  '
  },
  defScore: {
    1:'  六式 鐵塊  ',
    2:'  武裝色初學者  ',
    3:'  鋼鐵氣球  ',
    4:'  鑽石喬茲  ',
    5:'  露娜利亞族  ',
    6:'  屏障果實能力者  '
  },
  intelScore: {
    1:'  航海士見習生  ',
    2:'  監視電話蟲  ',
    3:'  見聞色高手  ',
    4:'  CP9 情報官  ',
    5:'  CP0 諜報員  ',
    6:'  世界經濟新聞報社社長  '
  },
  survivalScore: {
    1:'  騙人布的生存之道  ',
    2:'  奇蹟 Boy  ',
    3:'  巨人族  ',
    4:'  不死鳥馬可  ',
    5:'  古代種的韌性  ',
    6:'  不死神之騎士團  '
  }
};
const METRIC_NAME_MAP = {
  atkScore: '攻擊',
  hitScore: '命中',
  defScore: '防禦',
  intelScore: '偵查',
  survivalScore: '生存'
};
const RANK_TIER_NAME = {
  0:'新人定位賽',
  1:'新人船員',
  2:'副船長',
  3:'船長',
  4:'超新星',
  5:'王下七武海',
  6:'四皇',
  7:'海賊王者'
};
module.exports={clamp,round,fmtSigned,ensureRank,M_of_P,applyPlacement,applyRankedDelta,captureRankUiMeta,defaultClient,normTier,normalizeOwnedTitles,upsertOwnedTitle,computeBountyFromScore,decideTierByBounty,pickMainMetricKey,getTitleInfoForRow,RANK_TIER_NAME};
