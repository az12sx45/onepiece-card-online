// engine.js — One Piece《情書》規則引擎（純函式 / 無 UI）
// 目的：可在 Node.js（或雲端 Function）中運行，前端僅送出意圖，
// 引擎回傳新的 state 與需要給前端的「私訊 / 日誌」事件。
// ---------------------------------------------------------------
// 導出 API：
//   createInitialState(playerCount)
//   applyAction(state, action)  // 純函式，不觸 DOM
//   getVisibleState(state, viewerId)
//   isRoundEnded(state)
//   nextRound(state)
//
// 事件模型（協議）：
//   action: {
//     type: 'JOIN_ROOM' | 'START_ROUND' | 'DRAW' | 'PLAY_CARD' |
//            'PICK_TARGET' | 'PICK_DIGIT' |
//            'LUFFY_SECOND' | 'LUFFY_BOOST_COMMIT' |
//            'QUEEN_COIN' | 'BIGMOM_COIN' |
//            'ORDER_COMMIT' | 'MULTIPICK_COMMIT' |
//            'CLOSE_FINAL_RANK' | 'BIGMOM_CHOICE',
//     roomId: string,
//     playerId: number,       // 誰提出意圖
//     payload?: any           // 其他參數（target、digit、order...）
//   }
//
// applyAction 回傳：{ state, emits }
//   emits: 陣列（伺服器可依此轉交給所有人或單一玩家）
//     - { to: 'all',   type:'log', text:string }
//     - { to: number,  type:'peek', lines:string[] }   // 僅該玩家可見
//     - { to: number,  type:'toast', cardId:number }   // 前端可做飛牌動畫
//     - { to: 'all',   type:'duel_log', loserId:number, cardId:number } // 決鬥特效
//     - { to: number,  type:'coin_fx' } // 全畫面 coin.mp4 只播給這個人
//
// ---------------------------------------------------------------
// 資料定義
const CARDS = [
  { id:0,  name:"薩波", venue:"德雷斯羅薩鬥技場" },
  { id:1,  name:"騙人布", venue:"艾尼艾斯大廳" },
  { id:2,  name:"羅賓", venue:"阿拉巴斯坦" },
  { id:3,  name:"香吉士", venue:"巴拉蒂" },
  { id:4,  name:"喬巴", venue:"佐烏" },
  { id:5,  name:"索隆", venue:"和之國" },
  { id:6,  name:"羅",   venue:"龐克哈薩德" },
  { id:7,  name:"娜美", venue:"維薩利亞" },
  { id:8,  name:"魯夫", venue:"魚人島" },
  { id:9,  name:"女帝漢考克", venue:"九蛇島" },
  { id:10, name:"凱多", venue:"鬼島" },
  { id:11, name:"基德", venue:"夏波帝諸島" },
  { id:12, name:"奎因", venue:"鬼島" },
  { id:13, name:"基拉", venue:"夏波帝諸島" },
  { id:14, name:"大媽", venue:"萬國" },
  { id:15, name:"卡塔庫栗", venue:"萬國" },
  { id:16, name:"庫山（青雉）", venue:"蜂巢島" },
  { id:17, name:"黑鬍子", venue:"蜂巢島" },
  { id:18, name:"紅髮香克斯", venue:"奧羅傑克森號" },
  { id:19, name:"哥爾羅傑", venue:"奧羅傑克森號" },
];
const COUNTS = {0:1,1:5,2:2,3:2,4:2,5:2,6:1,7:1,8:1,9:1,10:1,11:1,12:1,13:1,14:1,15:1,16:1,17:1,18:1,19:1};
const VENUE_POOL = [...new Set(CARDS.map(c=>c.venue))].map(name=>({name}));

// ---------------------------------------------------------------
// 小工具
const tail = (id)=> ((id%10)+10)%10;
const isHighTail = (id)=> tail(id) >= 7;
const cardById = (id)=> CARDS.find(c=>c.id===id);
const cardLabel = (id) => (id!=null && cardById(id))
  ? `${cardById(id).id}｜${cardById(id).name}`
  : '（無牌）';

// 卡 → 場地名稱 對照（請與前端 CARD_VENUE 一致）
const CARD_VENUE = {
  0:"德雷斯羅薩鬥技場", 1:"艾尼艾斯大廳", 2:"阿拉巴斯坦", 3:"巴拉蒂", 4:"佐烏",
  5:"和之國", 6:"龐克哈薩德", 7:"維薩利亞", 8:"魚人島", 9:"九蛇島",
  10:"鬼島", 11:"夏波帝諸島", 12:"鬼島", 13:"夏波帝諸島",
  14:"萬國", 15:"萬國", 16:"蜂巢島", 17:"蜂巢島", 18:"奧羅傑克森號", 19:"奧羅傑克森號"
};

function isEnhancedNow(st, cardId){
  const vn = CARD_VENUE[cardId];
  if (!vn || !Array.isArray(st.venues)) return false;
  return !!st.venues.find(v => v && (v.name === vn));
}
// 統一推送強化影片事件（避免每張卡重覆寫）
// ★ 凱多（10）：只有同時握有「大媽(14)」且在強化場地時才廣播影片
function pushEnhFxIfAny(emits, st, cardId){
  if (!isEnhancedNow(st, cardId)) return;

  // 凱多特殊條件：必須與大媽同握才算成功發動
  if (cardId === 10) {
    const me = st.players?.[st.turnIndex];
    const hasBigMomInHandNow = (me && me.hand === 14);
    if (!hasBigMomInHandNow) return; // 不廣播，前端就不會播放強化影片
  }

  emits.push({ to: "all", type: "enh_fx", cardId });
 }

// ======== 統計：資料容器與工具 ========
function ensureStats(st){
  if (!st.stats) st.stats = {};
  if (!Array.isArray(st.players)) return st.stats;
  for (let i=0;i<st.players.length;i++){
    if (!st.stats[i]) {
      st.stats[i] = {
        coinScore: 0,   // 金幣分
        atkScore: 0,    // 攻擊分
        defScore: 0,    // 防禦分
        hitScore: 0,    // 命中分
        intelScore: 0,  // 偵查分
        survivalTurns: 0, // 生存：輪到自己的次數
        reachedFinal: false,
        wonFinal: false
      };
    }
  }
  return st.stats;
}
function addStat(st, pid, key, n){ ensureStats(st); if (st.stats[pid]) st.stats[pid][key] = (st.stats[pid][key]||0) + (n||0); }
function setFlag(st, pid, key, v){ ensureStats(st); if (st.stats[pid]) st.stats[pid][key] = !!v; }

// —— 攻擊分：決鬥勝利加分（依規則，取尾數差，含加乘）
function scoreDuelAttack(st, byIdx, myCardId, oppCardId, opt={}){
  const t = (x)=> (typeof x==='number') ? (Math.abs(x)%10) : 0;
  let base = Math.max(0, t(myCardId) - t(oppCardId));
  if (opt.sanjiBoost) base += 1;
  if (opt.ignoreDefOrDodge) base *= 2;
  if (opt.multiElimCount && opt.multiElimCount > 1) base *= opt.multiElimCount;
  addStat(st, byIdx, 'atkScore', base);
}
// —— 防禦分：以防擋下對方的「攻擊牌尾數」
function scoreDefense(st, defenderId, attackerCardId){
  const t = (Math.abs(attackerCardId||0))%10;
  addStat(st, defenderId, 'defScore', t);
}
// —— 防禦分（反殺）：決鬥中防守方贏時，按點數相扣加到防禦分
function scoreDefenseReversal(st, defenderId, defenderCardId, attackerCardId, opt={}){
  const t = (x)=> (typeof x==='number') ? (Math.abs(x)%10) : 0;
  let base = Math.max(0, t(defenderCardId) - t(attackerCardId));
  if (opt.sanjiBoost) base += 1;                 // 例如香吉士強化決鬥的 +1
  if (opt.ignoreDefOrDodge) base *= 2;           // 例如凱多/基拉強化無視防禦
  if (opt.multiElimCount && opt.multiElimCount>1) base *= opt.multiElimCount; // （保留通用性）
  addStat(st, defenderId, 'defScore', base);
}
// —— 命中分（騙人布 / 索隆 / 羅傑）
function scoreUsoppHit(st, usoppId, targetCardId, streak=1){
  const t = (Math.abs(targetCardId||0))%10;
  addStat(st, usoppId, 'hitScore', t * Math.max(1, streak));
}
function scoreZoroElim(st, zoroId, victimCardId){
  const t = (Math.abs(victimCardId||0))%10;
  addStat(st, zoroId, 'hitScore', t * 2);
}
function scoreRogerPredict(st, rogerId, coinsWon){
  addStat(st, rogerId, 'hitScore', Math.max(0, coinsWon||0) * 5);
}
// —— 偵查分（羅賓/羅/黑鬍子/卡塔庫栗）
function scorePeek(st, seerId, seenCardId){
  const t = (Math.abs(seenCardId||0))%10;
  addStat(st, seerId, 'intelScore', t);
}

function pname(st, idx){
  const p = st.players?.[idx];
  const nick = p?.client?.displayName || p?.displayName || '';
  return `P${(idx!=null? idx+1 : '?')}${nick? `（${nick}）`: ''}`;
}

const shuffle = (a0)=>{ const a=a0.slice(); for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } return a; };
const buildDeck = ()=>{ const d=[]; for(const [id,cnt] of Object.entries(COUNTS)){ for(let i=0;i<cnt;i++) d.push(Number(id)); } return shuffle(d); };
const buildVenues = (pc)=> shuffle(VENUE_POOL).slice(0, Math.ceil(pc/2));
const nextAliveIdx = (from, ps)=>{ for(let s=1;s<=ps.length;s++){ const i=(from+s)%ps.length; if(ps[i]?.alive) return i; } return from; };

// ---------------------------------------------------------------
// 決鬥日誌小工具
function guessLoserCardId(st, loserId){
  const p = st.players?.[loserId];
  if (!p) return null;
  if (typeof p.lastPlayed === 'number') return p.lastPlayed;
  if (typeof p.hand === 'number') return p.hand;
  if (Array.isArray(st.discard)){
    for (let i=st.discard.length-1; i>=0; i--){
      const d = st.discard[i];
      if (d && typeof d === 'object' && typeof d.id === 'number' && d.by === loserId) return d.id; // 保留舊格式相容
      if (typeof d === 'number') return d;
      if (d && typeof d === 'object' && typeof d.id === 'number') return d.id; // 新增：相容 teach 物件
    }
  }
  return null;
}

function pushDuelLog(emits, st, challengerId, loserId){
  const cardId = guessLoserCardId(st, loserId);
  const challenger = st.players[challengerId];
  const loser = st.players[loserId];
  const challengerName = challenger?.client?.displayName || challenger?.displayName || `P${challengerId+1}`;
  const loserName = loser?.client?.displayName || loser?.displayName || `P${loserId+1}`;
  const line = `決鬥：${challengerName} vs ${loserName} → ${loserName} 的卡 ${cardId} 被擊敗`;
  emits.push({ to:"all", type:"log", text: line });
  emits.push({ to:"all", type:"duel_log", loserId, cardId });
}

// ---------------------------------------------------------------
// 狀態建模
function initialPlayers(n){
  return Array.from({length:n},(_,i)=>({
    id:i, displayName:`P${i+1}`, avatar:(i%8)+1,
    alive:true, protected:false, dodging:false, frozen:false,
    hand:null, tempDraw:null, gold:0, skipNext:false,
    iceInfected:false, iceArmed:false
  }));
}

function baseState(playerCount){
  const players = initialPlayers(playerCount);
  const deck = buildDeck();
  players.forEach(p=>{ p.hand = deck.pop() ?? null; }); // 開局每人 1 張
  const venues = buildVenues(playerCount);
  return {
    players, deck, discard:[], venues,
    roundNo: 1, startSeat:0, turnIndex:0, turnStep:'draw',
    nextRoundStart:null, rogerPred:null, shanksBonusUid:null,
    saboSilence:false, saboSilenceOn:false, saboSilenceOwner:null,
    iceWindowOn:false, iceWindowOwner:null,
    pending:null, lastElimBy:null,
    HOT:14, _hotNotified:false,
    chestTotal: playerCount*5, chestLeft: playerCount*5,
    roundKills:Array(playerCount).fill(0),
    turnKills:Array(playerCount).fill(0),
    currentTurnOwner:0,
    meta: { coveredByTeach: [] }, // 仍保留，但不再使用
    stats: {}, // ★ 統計容器
    log:[
      `第 1 局開始。起始玩家：P1`,
      `本局強化場地：${venues.map(v=>v.name).join('、')}（${venues.length} 張）`
    ]
  };
}

function clone(o){ return JSON.parse(JSON.stringify(o)); }

function pushLog(st, text, emits){
  st.log.push(text);
  emits.push({ to:'all', type:'log', text });
}

function checkHot(st){
  if(st._hotNotified) return;
  if((st.deck?.length ?? 999) <= st.HOT){
    st._hotNotified = true;
    st.log.push(`⚠ 戰局進入白熱化：牌堆剩 ${st.HOT} 張（紅髮可啟動）`);
  }
}

function effectGuard(st, idx, {ignoreProtect=false, ignoreDodge=false}={}){
  const t = st.players[idx];
  if(!t?.alive) return {blocked:true, reason:'dead'};
  if(!ignoreProtect && t.protected) return {blocked:true, reason:'protected'};
  if(!ignoreDodge && t.dodging){ t.dodging=false; return {blocked:true, reason:'dodged'}; }
  return {blocked:false};
}

// ★★★ 修改：doEliminate 支援 emits，並在丟手牌/暫抽時發出 silent_discard
function doEliminate(st, victimIdx, reason, byIdx = st.turnIndex, emits){
  const p = st.players[victimIdx];
  if(!p.alive) return;

  const silents = [];
  if(p.tempDraw != null){ st.discard.push(p.tempDraw); silents.push(p.tempDraw); p.tempDraw = null; }
  if(p.hand     != null){ st.discard.push(p.hand);     silents.push(p.hand);     p.hand     = null; }
  if (emits && silents.length){
    emits.push({ to:'all', type:'silent_discard', by:victimIdx, cards: silents });
  }

  p.alive=false; p.protected=false; p.dodging=false; p.frozen=false;
  p.iceInfected=false; p.iceArmed=false;
  if(st.iceWindowOn && st.iceWindowOwner === victimIdx){
    st.iceWindowOn=false; st.iceWindowOwner=null;
  }
  if(byIdx!==victimIdx){
    st.roundKills[byIdx] = (st.roundKills[byIdx]||0)+1;
    if(byIdx===st.currentTurnOwner){
      st.turnKills[byIdx] = (st.turnKills[byIdx]||0)+1;
    }
  }
  st.lastElimBy = byIdx;
  st.log.push(`P${p.id+1} 出局（${reason}）`);
}

// ====== ★ awardRound 替換版（含統計與 final 打包）======
function awardRound(st, winner, tieBonus=0){
  ensureStats(st);
  const by = winner.id;
  const bonusKills = st.turnKills[by] || 0;
  const base  = 1;
  let gain = base + bonusKills + tieBonus;
  if(st.chestLeft<=0){
    st.log.push('寶箱已空，無法再拿金幣。');
    return;
  }
  if(gain > st.chestLeft) gain = st.chestLeft;
  winner.gold += gain;
  st.chestLeft -= gain;
  addStat(st, by, 'coinScore', gain); // ★ 金幣分
  st.log.push(`★ 本局勝者：P${winner.id+1} +${gain} 金幣（保底1 + 擊倒 ${bonusKills}${tieBonus>0?` + 平手加成 ${tieBonus}`:''}）→ 寶箱剩 ${st.chestLeft}`);

  if(st.rogerPred && st.rogerPred.pick!=null && st.rogerPred.by!=null && st.rogerPred.pick===winner.id){
    const r = st.players[st.rogerPred.by];
    if(st.chestLeft>0){
      const g2 = Math.min(gain, st.chestLeft);
      r.gold += g2;
      st.chestLeft -= g2;
      addStat(st, r.id, 'coinScore', g2);     // ★ 金幣分（羅傑得到的）
      scoreRogerPredict(st, r.id, g2);        // ★ 命中分（*5）
      st.log.push(`☆ 羅傑預測成功：P${r.id+1} 也獲得 ${g2}`);
    } else {
      st.log.push('☆ 羅傑預測成功：但寶箱已空');
    }
  }

// === 寶箱被拿空：打包賽季結算 ===
if (st.chestLeft === 0) {
  // 確保有統計容器（你前面應該已加過 ensureStats(st)）
  ensureStats(st);

  // 1) 蒐集每位玩家的統計分數，產出 scoreboard
  const board = {};
  for (let i = 0; i < st.players.length; i++) {
    const s = st.stats[i] || {};
    const survivalScore =
      (s.survivalTurns || 0) * (s.reachedFinal ? 2 : 1) * (s.wonFinal ? 2 : 1);

    board[i] = {
      coinScore: s.coinScore || 0,   // 金幣分（累計獲得金幣數）
      atkScore: s.atkScore || 0,     // 攻擊分
      defScore: s.defScore || 0,     // 防禦分（保護/閃避成功）
      hitScore: s.hitScore || 0,     // 命中分（指向/擊中成效）
      intelScore: s.intelScore || 0, // 情報分（偷看/探測等）
      survivalScore                  // 生存分（回合數與是否到/贏最終）
    };
  }

 // 2) 帶出玩家的 meta（名字、pid、頭像），供結果頁顯示
const playersMeta = {};
st.players.forEach((p, i) => {
  playersMeta[i] = {
    id: i,
    name:
      p.client?.displayName ??
      p.displayName ??
      p.name ??
      p.nick ??
      `P${i + 1}`,
   pid: (p.pid != null ? p.pid : (p.client?.pid ?? i)),
    avatar: (p.avatar != null ? p.avatar : (p.client?.avatar ?? null)),
  };
});

  // 3) 金幣排名（只宣告一次，避免 const rank 重複）
  const rank = [...st.players]
    .map(p => ({ id: p.id, gold: p.gold || 0 }))
    .sort((a, b) => b.gold - a.gold);

  // 如需保留快取可寫：st._finalRank = rank;

  // 4) 打包 final 物件（result.html 會用這包渲染）
  st.final = {
    seasonNo: st.seasonNo || 1,
    ranking: rank.map(r => ({
      id: r.id,
      name: (playersMeta[r.id] && playersMeta[r.id].name) || `P${r.id + 1}`,
      coins: r.gold,
      pid: playersMeta[r.id] ? playersMeta[r.id].pid : null,
      avatar: playersMeta[r.id] ? playersMeta[r.id].avatar : null
    })),
    playersMeta,
    scoreboard: board
  };

  // 5) 結束本回合的回合狀態（保險）
  st.turnStep = 'ended';
  // 若你這裡原本有 endOrNext(st) 或其他收尾，依原本邏輯保留。
}

}

function showdown(st){
  const showVal = (id)=> (id<10 ? id : Math.floor(id/10) + (id%10));
  const isCore09 = (id)=> id>=0 && id<=9;
  const alive = st.players.filter(p=>p.alive);
  alive.forEach(p => setFlag(st, p.id, 'reachedFinal', true)); // ★ 活到最終
  let tieBonus = 0;
  let loopGuard = 0;

  const computeBest = ()=>{
    let bestVal = -Infinity, bestPri = -1, cands = [];
    alive.forEach(p=>{
      const id = (p.hand ?? 0);
      let val = showVal(id);
      if(st.shanksBonusUid!=null && p.id===st.shanksBonusUid){
        val = val + 1;
      }
      const pri = isCore09(id) ? 1 : 0;
      if(val>bestVal){
        bestVal = val; bestPri = pri; cands = [p];
      } else if(val===bestVal){
        if(pri>bestPri){
          bestPri = pri; cands = [p];
        } else if(pri===bestPri){
          cands.push(p);
        }
      }
    });
    return { cands, bestVal, bestPri };
  };

  st.log.push('★ 比牌（新制）開始：存活者公開手牌');
  while(true){
    loopGuard++; if(loopGuard>50){
      st.log.push('※ 防呆：比牌循環過多，強制中止');
      break;
    }

    const {cands, bestVal, bestPri} = computeBest();
    if(cands.length===1){
      const w=cands[0];
      const wId = w.hand;
      const wVal = showVal(wId) + ((st.shanksBonusUid!=null && w.id===st.shanksBonusUid)?1:0);
      st.log.push(`★ 比牌結果：P${w.id+1} 最高 → 值 ${wVal}${isCore09(wId)?'（0–9 方）':''}${tieBonus>0?`（累積平手 +${tieBonus}）`:''}`);
      setFlag(st, w.id, 'wonFinal', true); // ★ 贏下最終
      awardRound(st, w, tieBonus);
      st.turnStep='ended';
      st.shanksBonusUid = null;
      break;
    }

    st.log.push(`★ 比牌平手（同最高值${bestVal}${bestPri===1?'，且皆為 0–9 方':''}）。將所有牌洗回，存活者各抽 1 → 重比。`);
    tieBonus += 1;

    const pool = [];
    pool.push(...st.deck);
    pool.push(...st.discard);
    st.deck=[];

    st.players.forEach(p=>{
      if(p.hand!=null){ pool.push(p.hand); p.hand=null; }
      if(p.tempDraw!=null){ pool.push(p.tempDraw); p.tempDraw=null; }
    });

    const newDeck = shuffle(pool);
    st.deck = newDeck;
    alive.forEach(p=>{
      p.hand = st.deck.pop() ?? null;
    });
    st.log.push('已洗回所有牌並重新抽 1 張。');
  }
}

function endOrNext(st){
  checkHot(st);

  const nextIdx = nextAliveIdx(st.turnIndex, st.players);

  if(st.iceWindowOn && st.iceWindowOwner === nextIdx){
    st.iceWindowOn=false; st.iceWindowOwner=null;
  }
  if(st.saboSilenceOn && st.saboSilenceOwner === nextIdx){
    st.saboSilenceOn=false; st.saboSilenceOwner=null;
  }

  const alive = st.players.filter(p=>p.alive);
  if(alive.length===1){
    const w=alive[0];
    st.log.push(`★ 本局結束：僅 P${w.id+1} 存活`);
    awardRound(st, w);
    st.turnStep='ended';
    return;
  }

  if(st.deck.length===0){
    showdown(st);
    return;
  }

  st.turnIndex = nextIdx;
  st.turnStep='draw';
  st.log.push(`→ 輪到 P${st.turnIndex+1}`);
}

// ---------------------------------------------------------------
// 導出：建立初始局面（允許動態玩家人數）
function createInitialState(playerCount=1){
  // playerCount 改為 1 → 不預塞 4 人
  const st = baseState(Math.max(1, playerCount || 1));

  // 為了與動態等待室相容，先清空所有玩家 client
  st.players.forEach(p => {
    p.client = null;
    p.displayName = `P${p.id + 1}`;
    p.avatar = (p.id % 8) + 1;
  });

  if(st.deck.length <= st.HOT){
    st._hotNotified = true;
    st.log.push(`⚠ 戰局進入白熱化：牌堆剩 ${st.deck.length}（紅髮可啟動）`);
  }
  return st;
}


// ---------------------------------------------------------------
// 導出：資訊遮蔽（③ 調整這段）
function getVisibleState(state, viewerId){
  const vis = clone(state);

  // 遮蔽他人手牌/暫抽
  vis.players.forEach((p)=>{
    if(p.id !== viewerId){
      if(p.hand!=null) p.hand = null;
      if(p.tempDraw!=null) p.tempDraw = null;
    }
  });

  // 黑鬍子覆蓋：只允許覆蓋者本人看到真實 id；他人看到卡背
  if (Array.isArray(vis.discard)) {
    vis.discard = vis.discard.map((card) => {
      if (card && typeof card === 'object' && card.coverBy === 'teach') {
        return (viewerId !== card.owner) ? { back: true } : card.id; // 回傳數字以保相容
      }
      return card;
    });
  }

  return vis;
}

// ---------------------------------------------------------------
// 導出：回合是否結束
function isRoundEnded(state){
  if(state.turnStep==='ended') return true;
  if(state.players.filter(p=>p.alive).length<=1) return true;
  return false;
}

// ---------------------------------------------------------------
// 導出：依規則開下一局（保留跨局統計）
function nextRound(state){
  const st = clone(state);
  const playerCount = st.players.length;

  // 重建玩家陣列，保留 gold / client / displayName / avatar
  const players = initialPlayers(playerCount);
  for (let i = 0; i < playerCount; i++) {
    const oldP = st.players[i];
    const p = players[i];

    p.gold = oldP.gold || 0;

    if (oldP.client) p.client = clone(oldP.client);
    if (oldP.displayName) p.displayName = oldP.displayName;
    if (oldP.avatar != null) p.avatar = oldP.avatar;
    if (!p.avatar && oldP.client?.avatar != null) p.avatar = oldP.client.avatar;
  }

  // 發新牌
  const deck = buildDeck();
  players.forEach(p => {
    p.hand = deck.pop() ?? null;
  });

  // 場地重抽
  const venues = buildVenues(playerCount);

  // 起始座位：nextRoundStart 優先，否則上一局 +1
  const startSeat = (st.nextRoundStart != null)
    ? st.nextRoundStart
    : (st.startSeat + 1) % playerCount;

  return {
    players, deck, discard: [], venues,
    roundNo: st.roundNo + 1,
    startSeat, turnIndex: startSeat, turnStep: 'draw',
    nextRoundStart: null, rogerPred: null, shanksBonusUid: null,

    saboSilence: false, saboSilenceOn: false, saboSilenceOwner: null,
    iceWindowOn: false,  iceWindowOwner: null,

    pending: null, lastElimBy: null,

    HOT: 14, _hotNotified: false,

    chestTotal: st.chestTotal,
    chestLeft:  st.chestLeft,

    roundKills: Array(playerCount).fill(0),
    turnKills:  Array(playerCount).fill(0),
    currentTurnOwner: startSeat,

    meta: { coveredByTeach: [] }, // 保留清空，但不再使用
    stats: st.stats || {}, // ★ 跨局累計
    log: [
      `第 ${st.roundNo + 1} 局開始。起始玩家：P${startSeat + 1}`,
      `本局強化場地：${venues.map(v => v.name).join('、')}（${venues.length} 張）`,
      `寶箱剩餘金幣：${st.chestLeft} / ${st.chestTotal}`
    ]
  };
}

// ---------------------------------------------------------------
// 主純函式 applyAction
function applyAction(state, action){
  const st = clone(state);
  const emits = [];
  const me = st.players[action.playerId];
  if(!me){ return { state: st, emits }; }

  const type = action.type;

  // ===== 房間 & 流程控制 =====
  if(type==='START_ROUND'){
    if(st.roundNo===1 && st.log.length<=2){
      return { state: st, emits };
    }
    if(st.turnStep!=='ended') return { state: st, emits };
    const ns = nextRound(st);
    return { state: ns, emits };
  }

  if(type==='CLOSE_FINAL_RANK'){
    if(st._finalRank){ delete st._finalRank; }
    return { state: st, emits };
  }

  // ===== 抽牌階段 =====
  if(type==='DRAW'){
    if(st.turnStep!=='draw' || st.turnIndex!==action.playerId) return { state: st, emits };

    // 回合開始的前置
    st.saboSilence=false;
    me.protected=false;
    st.turnKills = Array(st.players.length).fill(0);
    st.currentTurnOwner = st.turnIndex;

    if(!me.alive){
      st.turnIndex = nextAliveIdx(st.turnIndex, st.players);
      pushLog(st, `P${me.id+1} 已出局 → P${st.turnIndex+1}`, emits);
      return { state: st, emits };
    }

    if(st.iceWindowOn && st.turnIndex === st.iceWindowOwner){
      st.iceWindowOn=false;
      st.iceWindowOwner=null;
      pushLog(st, '冰鬼：標記視窗已結束（回到施放者）', emits);
    }
    if(st.saboSilenceOn && st.turnIndex === st.saboSilenceOwner){
      st.saboSilenceOn=false;
      st.saboSilenceOwner=null;
      pushLog(st, '薩波靜默：視窗已結束（回到/經過施放者）', emits);
    }

    if(me.skipNext){
      me.skipNext=false;
      pushLog(st, `P${me.id+1} 跳過回合（麻痺解除）`, emits);
      st.turnIndex = nextAliveIdx(st.turnIndex, st.players);
      return { state: st, emits };
    }

    if(me.iceInfected){
      me.iceInfected=false;
      me.iceArmed=true;
      pushLog(st, '冰鬼：標記生效，本回合受檢查', emits);
    }

    addStat(st, st.turnIndex, 'survivalTurns', 1); // ★ 生存分：輪到自己 +1
    me.tempDraw = st.deck.pop() ?? null;
    checkHot(st);
    st.turnStep='choose';
    pushLog(st, `P${me.id+1} 抽到一張牌`, emits);
    return { state: st, emits };
  }

  // ===== 出牌 =====
  if(type==='PLAY_CARD'){
    if(st.turnStep!=='choose' || st.turnIndex!==action.playerId) return { state: st, emits };

    // 🧊 奎因：硬幣判定期間，不允許再出牌，避免卡死
    if (st.pending && st.pending.action === 'queen') {
      emits.push({
        to: action.playerId,
        type: 'toast',
        text: '奎因：硬幣判定中，請等大家擲完硬幣'
      });
      return { state: st, emits };
    }

    const which = action.payload?.which; // 'hand' | 'drawn'
    const a = me.hand, b = me.tempDraw;
    const playId = (which==='hand')? a : b;
    const keepId = (which==='hand')? b : a;
    if(playId==null) return { state: st, emits };

    // 凍結只能打剛抽
    const wasFrozen = me.frozen;
    if(wasFrozen && which!=='drawn'){
      pushLog(st, '※ 凍結：只能打剛抽的牌', emits);
      return { state: st, emits };
    }
    me.frozen=false;

    // 7+6/8 rule
    const has7 = (a===7 || b===7);
    const has68 = (a===6 || b===6) || (a===8 || b===8);
    if(!wasFrozen && has7 && has68 && playId!==7){
      pushLog(st, '※ 規則：同握 7 與 (6/8) 必須打 7', emits);
      return { state: st, emits };
    }

    emits.push({ to: action.playerId, type:'toast', cardId: playId });
    me.hand = keepId;
    me.tempDraw = null;
    st.discard.push(playId);
    pushLog(st, `${pname(st, st.turnIndex)} 打出 ${cardLabel(playId)}`, emits);

    // 若此卡在當前場地為強化版 → 廣播強化影片
    pushEnhFxIfAny(emits, st, playId);

    // 冰鬼標記
    if(st.iceWindowOn && st.turnIndex !== st.iceWindowOwner){
      if((playId % 2) === 1){
        me.iceInfected = true;
        pushLog(st, '冰鬼：你打出奇數 → 已被「標記」', emits);
      }
    }

    const card = cardById(playId);
    const venueActive = st.venues.some(v=>v.name===card.venue);

    // 薩波靜默
    if(st.saboSilenceOn && isHighTail(playId)){
      pushLog(st, `【靜默】薩波：尾數≥7 不結算 → ${card.name}` , emits);
      endOrNext(st);
      return { state: st, emits };
    }
    if(st.saboSilence && playId>=7){
      pushLog(st, `【靜默】本回合 7+ 效果無效：${card.name}`, emits);
      endOrNext(st);
      return { state: st, emits };
    }

    // 冰鬼檢查
    if(me.iceArmed){
      if((playId % 2) === 1){
        doEliminate(st, st.turnIndex, '冰鬼：下一回合仍出奇數 → 死亡', st.turnIndex, emits);
        endOrNext(st);
        return { state: st, emits };
      } else {
        me.iceArmed=false;
        pushLog(st, '冰鬼：本回合出偶數 → 解除', emits);
      }
    }

    // === 卡牌結算 ===
    switch(playId){
case 0: { // 薩波
  const affected=[];
  st.players.forEach(p=>{
    if(!p.alive) return;
    if(p.protected) return;
    if(p.dodging){ p.dodging=false; return; }
    affected.push(p);
  });
  affected.forEach(p=>{
    if(p.hand!=null) st.deck.push(p.hand);
    p.hand=null;
  });
  st.deck = shuffle(st.deck);
  affected.forEach(p=>{
    p.hand = st.deck.pop() ?? null;
  });
  if(venueActive){
    pushEnhFxIfAny(emits, st, 0);
    st.saboSilenceOn=true;
    st.saboSilenceOwner=st.turnIndex;
    pushLog(st, '薩波（強化）：靜默啟動（直到回到/經過你）。尾數≥7 打出/被棄出不結算。', emits);
  }
  pushLog(st, `薩波：影響 ${affected.length} 人（保護/閃避免疫不算）`, emits);
  endOrNext(st);
  return { state: st, emits };
}
      case 1: { // 騙人布
        st.pending = { action:'usopp', extra:{ chain:venueActive, target:null } };
        return { state: st, emits };
      }
      case 2: { // 羅賓
        if(venueActive){
          const lines=[];
          st.players.forEach((pp,i)=>{
            if(!pp.alive) return;
            const th = pp.hand;

            if(pp.protected){
              lines.push(`P${i+1}：保護中`);
              return;
            }
            if(pp.dodging){
              pp.dodging=false;
              lines.push(`P${i+1}：閃避觸發（無法查看）`);
              return;
            }

            const label = cardLabel(pp.hand);
            if (i !== st.turnIndex && th != null) {
              scorePeek(st, action.playerId, th); // ★ 偵查分
              emits.push({ to: action.playerId, type:'robin_view', casterId: st.turnIndex, targetId: i, cardId: th });
            }

            if(i===st.turnIndex){
              lines.push(`你自己：${label}`);
            }else{
              lines.push(`P${i+1}：${label}`);
            }
          });
          emits.push({ to: action.playerId, type:'peek', lines });
          endOrNext(st);
          return { state: st, emits };
        } else {
          st.pending = { action:'robin' };
          return { state: st, emits };
        }
      }
      case 3: { // 香吉士
        st.pending = { action:'sanji', extra:{ keep: keepId, boost: venueActive } };
        return { state: st, emits };
      }
      case 4: { // 喬巴
        if(venueActive){
          me.dodging=true;
          pushLog(st, '喬巴（強化）：獲得閃避', emits);
        } else {
          me.protected=true;
          pushLog(st, '喬巴：獲得保護', emits);
        }
        endOrNext(st);
        return { state: st, emits };
      }
      case 5: { // 索隆
        st.pending = { action:'zoro' };
        return { state: st, emits };
      }
      case 6: { // 羅
        st.pending = { action:'law', extra:{ keep: keepId, boost: venueActive } };
        return { state: st, emits };
      }
      case 7: { // 娜美
        if(venueActive){
          st.pending = { action:'nami' };
          return { state: st, emits };
        }
        endOrNext(st);
        return { state: st, emits };
      }
      case 8: { // 魯夫
        if (venueActive) {
          st.pending = { action: 'luffy-boost', extra: { keep: keepId } };
          emits.push({ to: action.playerId, type: 'luffy_boost_prompt' });
          return { state: st, emits };
        } else {
          st.pending = { action:'luffy', extra:{ keep: keepId, firstDone:false } };
          return { state: st, emits };
        }
      }
      case 9: { // 女帝
        if(venueActive){
          me.protected=true;
          pushLog(st, '女帝（九蛇島）：獲得保護', emits);
        } else {
          doEliminate(st, st.turnIndex, '女帝自我了斷', st.turnIndex, emits);
        }
        endOrNext(st);
        return { state: st, emits };
      }
      case 10: { // 凱多
        const hasBigMom = (me.hand===14 || keepId===14);
        if(venueActive){
          if(hasBigMom){
            // ★ 群體攻擊分：尾數加權總和 *2（無視防禦/閃避）再 * 同時數量
            const victims = [];
            for(let i=0;i<st.players.length;i++){
              if(i!==st.turnIndex && st.players[i].alive){
                victims.push(i);
              }
            }
            if (victims.length){
              let sumTail = 0;
              victims.forEach(i => { sumTail += (tail(st.players[i].hand)||0); });
              const total = (sumTail * 2) * victims.length;
              addStat(st, st.turnIndex, 'atkScore', total);
            }
            victims.forEach(i=>{
              doEliminate(st,i,'霸海：清場', st.turnIndex, emits);
            });
            endOrNext(st);
            return { state: st, emits };
          } else {
            pushLog(st, '凱多（鬼島）：未與大媽同握，本回合無效果', emits);
            endOrNext(st);
            return { state: st, emits };
          }
        } else {
          st.pending = { action:'kaido', extra:{ keep: keepId } };
          return { state: st, emits };
        }
      }
      case 11: { // 基德
        if(venueActive){
          const allAlive = st.players.map((_,i)=>i).filter(i=>st.players[i].alive);
          const passIdxs = allAlive.filter(i => !st.players[i].protected && !st.players[i].dodging);
          const dodgedIdxs = allAlive.filter(i => st.players[i].dodging);
          dodgedIdxs.forEach(i => { st.players[i].dodging = false; });

          if (passIdxs.length >= 2) {
            const hands = passIdxs.map(i => st.players[i].hand);
            for (let k = 0; k < passIdxs.length; k++) {
              const to = passIdxs[(k + passIdxs.length - 1) % passIdxs.length];
              st.players[to].hand = hands[k];
            }
          }

          const skipped = allAlive.length - passIdxs.length;
          const dodgeUsed = dodgedIdxs.length;
          pushLog(st, `基德（強化）：已逆時針傳遞（略過 ${skipped} 人：保護/閃避，消耗閃避 ${dodgeUsed}）`, emits);

          endOrNext(st);
          return { state: st, emits };
        } else {
          if(st.discard.length===0){
            pushLog(st, '基德：棄牌堆為空，技能失效', emits);
            endOrNext(st);
            return { state: st, emits };
          }
          const pool = st.discard
            .map((x,idx)=>({ id: (typeof x==='number'? x : x?.id), idx }))
            .filter(x=>x.id!==11); // 相容 teach 物件
          if(pool.length===0){
            pushLog(st, '基德：棄牌堆只有基德，技能失效', emits);
            endOrNext(st);
            return { state: st, emits };
          }
          const pick = pool[Math.floor(Math.random()*pool.length)];
          me.tempDraw = pick.id;
          st.discard.splice(pick.idx,1);
          pushLog(st, '基德：棄牌堆洗牌抽 1（排除基德），請再打一次', emits);
          st.turnStep='choose';
          return { state: st, emits };
        }
      }
      case 12: { // 奎因
        if(venueActive){
          st.iceWindowOn = true;
          st.iceWindowOwner = st.turnIndex;
          pushLog(st, '奎因（強化）：冰鬼啟動—直到回到你前，其他玩家在自己回合打出奇數將被標記', emits);
          endOrNext(st);
          return { state: st, emits };
        } else {
          st.pending = { action:'queen', target: nextAliveIdx(st.turnIndex, st.players), start: st.turnIndex };
          return { state: st, emits };
        }
      }
      case 13: { // 基拉
        st.pending = { action:'killer', extra:{ keep: keepId, boost: venueActive } };
        return { state: st, emits };
      }
      case 14: { // 大媽
        if(venueActive){
          st.pending = { action:'bigmom', target:null, extra:{ boost:true } };
          return { state: st, emits };
        } else {
          st.pending = { action:'bigmom-coin' };
          return { state: st, emits };
        }
      }
      case 15: { // 卡塔庫栗
        if(venueActive){
          const aliveCount = st.players.filter(p=>p.alive).length;
          const n = Math.max(1, Math.ceil(aliveCount/2));
          const topTopFirst = st.deck.slice(-n).reverse();
          st.pending = { action:'kata-order', n, cards: topTopFirst };
          return { state: st, emits };
        } else {
          const top3 = st.deck.slice(-3).reverse();
          const lines = top3.map(x=>cardLabel(x));
          top3.forEach(c=> scorePeek(st, action.playerId, c)); // ★ 偵查分
          emits.push({ to: action.playerId, type:'peek', lines: [ '你查看頂 3（由上到下）：', ...lines ] });
          emits.push({ to: action.playerId, type:'kata_peek', cards: top3 });
          endOrNext(st);
          return { state: st, emits };
        }
      }case 16: { // 青雉
  if (venueActive) {
    let affected = 0, skippedProtect = 0, dodged = 0;

    st.players.forEach((p, i) => {
      if (!p.alive || i === st.turnIndex) return;

      if (p.protected) { // 保護免疫
        skippedProtect++;
        return;
      }
      if (p.dodging) {   // 閃避抵消並消耗閃避
        p.dodging = false;
        dodged++;
        return;
      }

      p.frozen = true;   // 其餘玩家被凍結
      affected++;
    });

    pushLog(st, `青雉（強化）：全場凍結（不含自己；保護免疫×${skippedProtect}；閃避抵消×${dodged}；凍結×${affected}）`, emits);
    endOrNext(st);
    return { state: st, emits };
  } else {
    st.pending = { action: 'aokiji' };
    return { state: st, emits };
  }
}

      case 17: { // 黑鬍子
        if(venueActive){
          const aliveCount = st.players.filter(p=>p.alive).length;
          const n = Math.max(1, Math.ceil(aliveCount/2));
          const labels = st.deck.slice(-n).reverse();
          st.pending = { action:'teach-multipick', n, cards: labels };
          return { state: st, emits }; // 等 MULTIPICK_COMMIT
        } else {
          const top1 = st.deck.pop();
          if(top1!=null){
            // ① 改為推物件，直接在棄牌上帶覆蓋資訊（不再寫 meta.coveredByTeach）
            st.discard.push({ id: top1, coverBy: 'teach', owner: st.turnIndex });

            emits.push({ to:'all', type:'silent_discard', by: st.turnIndex, cards:[top1] });
            const line = cardLabel(top1);
            scorePeek(st, action.playerId, top1); // ★ 偵查分
            emits.push({ to: action.playerId, type:'peek', lines:[`你覆蓋頂 1（最上）：${line}`] });
            pushLog(st, '黑鬍子：已覆蓋頂 1（出牌者可見）', emits);
            emits.push({ to: action.playerId, type:'teach_cover', cards:[top1] });
          }
          checkHot(st);
          endOrNext(st);
          return { state: st, emits };
        }
      }
      case 18: { // 紅髮
  const hot = st.HOT;
  const venueActive = st.venues.some(v => v.name === '奧羅傑克森號');

  if (st.deck.length <= hot) {
    if (venueActive) {
      // ★ 只有在奧羅傑克森號場地且成功觸發時播放強化影片
      pushEnhFxIfAny(emits, st, 18);
    }

    st.shanksBonusUid = venueActive ? st.turnIndex : null;
    pushLog(st, `紅髮：牌堆 ≤ ${hot} → 直接比牌${venueActive ? '（你算完 +1）' : ''}`, emits);
    showdown(st);
    return { state: st, emits };
  }

  pushLog(st, `紅髮：目前牌堆 ${st.deck.length}，尚未 ≤ ${hot}`, emits);
  endOrNext(st);
  return { state: st, emits };
}

      case 19: { // 羅傑
        if(st.venues.some(v=>v.name==='奧羅傑克森號')){
          st.pending = { action:'roger' };
          return { state: st, emits };
        } else {
          doEliminate(st, st.turnIndex, '羅傑：為下一局起始', st.turnIndex, emits);
          st.nextRoundStart = st.turnIndex;
          endOrNext(st);
          return { state: st, emits };
        }
      }
    }
  }

  // ===== 二段互動類事件 =====
  if(type==='PICK_TARGET'){
    const p = st.pending;
    if(!p) return { state: st, emits };
    const idx = action.payload?.target;
    if(typeof idx !== 'number') return { state: st, emits };
    const meIdx = st.turnIndex;

    if(p.action==='usopp'){
      st.pending = { ...p, extra:{ ...p.extra, target: idx } };
      return { state: st, emits };
    }

    if(p.action==='robin'){
      const g = effectGuard(st, idx, {});
      if(!g.blocked){
        const th = st.players[idx].hand;
        const line = (th != null) ? `你偷看了 ${pname(st, idx)}：${cardLabel(th)}` : `你偷看了 ${pname(st, idx)}：（無牌）`;
        emits.push({ to: action.playerId, type:'peek', lines:[line] });
        if (th != null) scorePeek(st, action.playerId, th); // ★ 偵查分
        emits.push({ to: action.playerId, type:'robin_view', casterId: st.turnIndex, targetId: idx, cardId: th });
        pushLog(st, `羅賓：查看了 ${pname(st, idx)}`, emits);
      } else {
        scoreDefense(st, idx, 2); // 羅賓2看牌被擋 → 防禦+2
      }
      st.pending=null;
      endOrNext(st);
      return { state: st, emits };
    }

    if(p.action==='sanji'){
      const g = effectGuard(st, idx, {});
      if(!g.blocked){
        pushLog(st, `香吉士：向 ${pname(st, idx)} 發起比拚`, emits);
        const base=tail(p.extra.keep);
        const my = p.extra.boost ? (base===9?10:base+1) : base;
        const opp=tail(st.players[idx].hand);
        if(my>opp){
          scoreDuelAttack(st, meIdx, p.extra.keep, st.players[idx].hand, { sanjiBoost: !!p.extra.boost }); // ★
          doEliminate(st, idx, '惡魔風腳', meIdx, emits);
          pushDuelLog(emits, st, meIdx, idx);
        } else if(my<opp){
          scoreDefenseReversal(st, idx, st.players[idx].hand, p.extra.keep, { sanjiBoost: !!p.extra.boost });
          doEliminate(st, st.turnIndex, '惡魔風腳反噬', meIdx, emits);
          pushDuelLog(emits, st, meIdx, meIdx);
        } else {
          pushLog(st,'平手',emits);
        }
      } else {
        // ★ 防禦分：對手擋下攻擊
        scoreDefense(st, idx, p.extra.keep);
      }
      st.pending=null;
      endOrNext(st);
      return { state: st, emits };
    }

if(p.action==='zoro'){
  const g = effectGuard(st, idx, {});
  if(!g.blocked){
    const t = st.players[idx];
    const thrown = t.hand;
    st.discard.push(thrown);
    if (thrown != null) {
      emits.push({ to:'all', type:'silent_discard', by: idx, cards:[thrown] });
    }
    t.hand=null;

    if (thrown === 9 || thrown === 19) {
      if (st.saboSilenceOn && isHighTail(thrown)) {
        pushLog(st,'【靜默】薩波：丟出尾數≥7 → 該牌效果不發動',emits);
      } else {
        if (thrown === 19) {
          // 羅傑：若有「奧羅傑克森號」→ 免死並可發動強化（預測）
          const hasOro = st.venues.some(v=>v.name==='奧羅傑克森號');
          if (hasOro) {
            // 免死：補 1 張（不加保護）
            t.hand = st.deck.pop() ?? null;
            checkHot(st);
            pushLog(st, `索隆：丟出羅傑但有奧羅傑克森號 → ${pname(st, t.id)} 補 1 張，且可進行預測`, emits);

            // 開啟羅傑強化的預測互動（由被丟牌者來選）
            st.pending = { action:'roger', caster: idx };
            emits.push({ to: idx, type:'toast', text:'羅傑（奧羅傑克森號）：請預測本局勝者' });

            // 不 endOrNext，等預測選完
            return { state: st, emits };
          } else {
            // 無奧羅傑克森號 → 依舊淘汰，並指定下一局起始
            scoreZoroElim(st, st.turnIndex, thrown);
            doEliminate(st, idx, '索隆：丟出 19 → 淘汰', st.turnIndex, emits);
            st.nextRoundStart = idx;
            pushLog(st, `羅傑：無場地被丟出 → 下局起始為 ${pname(st, idx)}`, emits);
          }
        } else {
          // 丟 9（女帝）
          const hasKuja = st.venues.some(v=>v.name==='九蛇島');
          if (hasKuja) {
            t.protected = true;
            t.hand = st.deck.pop() ?? null;
            checkHot(st);
            pushLog(st, `索隆：丟出女帝但有九蛇島 → ${pname(st, t.id)} 獲得保護並補 1 張`, emits);
          } else {
            scoreZoroElim(st, st.turnIndex, thrown);
            doEliminate(st, idx, '索隆：丟出 9 → 淘汰', st.turnIndex, emits);
          }
        }
      }
    } else {
      // 非 9/19
      if (st.venues.some(v=>v.name==='和之國')) {
        if ((thrown % 2) === 0) {
          scoreZoroElim(st, st.turnIndex, thrown);
          doEliminate(st, idx, '阿修羅：偶數→淘汰', st.turnIndex, emits);
        } else {
          t.hand = st.deck.pop() ?? null;
          checkHot(st);
          pushLog(st, '阿修羅：奇數→抽 1', emits);
        }
      } else {
        t.hand = st.deck.pop() ?? null;
        checkHot(st);
        pushLog(st, `索隆：${pname(st, t.id)} 棄牌重抽`, emits);
      }
    }
  } else {
    scoreDefense(st, idx, 5); // 索隆5棄牌被擋 → 防禦+5
  }
  st.pending = null;
  endOrNext(st);
  return { state: st, emits };
}


    if(p.action==='law'){
      if(p.extra.boost){
        const gView = effectGuard(st, idx, {});
        if(!gView.blocked){
          const th = st.players[idx].hand;
          if (th != null) scorePeek(st, action.playerId, th); // ★ 偵查分
          emits.push({ to: action.playerId, type:'peek', lines:[`ROOM・SCAN：${pname(st, idx)} → ${cardLabel(th)}`] });
          emits.push({ to: action.playerId, type:'law_view', casterId: st.turnIndex, targetId: idx, cardId: th });
        } else {
          scoreDefense(st, idx, 6); // 羅6查看/交換被擋 → 防禦+6
          pushLog(st, `羅（強化）：對 ${pname(st, idx)} 的查看被保護/閃避抵銷`, emits);
          st.pending = null;
          endOrNext(st);
          return { state: st, emits };
        }

        if(action.payload?.swap===true){
          const gSwap = effectGuard(st, idx, {});
          if(!gSwap.blocked){
            const t = st.players[idx];
            const tmp = t.hand;
            t.hand = me.hand;
            me.hand = tmp;
            pushLog(st,'羅（強化）：完成交換',emits);
          } else {
            scoreDefense(st, idx, 6); // 羅6交換被擋 → 防禦+6
            pushLog(st, `羅（強化）：對 ${pname(st, idx)} 的交換被保護/閃避抵銷`, emits);
          }
          st.pending = null;
          endOrNext(st);
          return { state: st, emits };
        }

        return { state: st, emits };
      } else {
        const gSwap = effectGuard(st, idx, {});
        if(!gSwap.blocked){
          const t = st.players[idx];
          const tmp = t.hand;
          t.hand = me.hand;
          me.hand = tmp;
          pushLog(st,'羅：完成交換',emits);
        } else {
          scoreDefense(st, idx, 6); // 羅6交換被擋 → 防禦+6
          pushLog(st, `羅：對 ${pname(st, idx)} 的交換被保護/閃避抵銷`, emits);
        }
        st.pending=null;
        endOrNext(st);
        return { state: st, emits };
      }
    }

    if(p.action==='nami'){
      const g = effectGuard(st, idx, {});
      if(!g.blocked){
        st.players[idx].skipNext=true;
        pushLog(st, `雷霆：${pname(st, idx)} 下回合跳過`, emits);
      } else {
        scoreDefense(st, idx, 7); // 娜美7被擋 → 防禦+7
      }
      st.pending=null;
      endOrNext(st);
      return { state: st, emits };
    }

    if(p.action==='luffy'){
      const g = effectGuard(st, idx, {});
      if(!g.blocked){
        pushLog(st, `魯夫：向 ${pname(st, idx)} 發起決鬥`, emits);
        const my=tail(p.extra.keep);
        const opp=tail(st.players[idx].hand);
        if(my>opp){
          scoreDuelAttack(st, st.turnIndex, p.extra.keep, st.players[idx].hand, {}); // ★
          doEliminate(st, idx, '魯夫擊倒', meIdx, emits);
          pushDuelLog(emits, st, meIdx, idx);
        } else if(my<opp){
          scoreDefenseReversal(st, idx, st.players[idx].hand, p.extra.keep, {});
          doEliminate(st, st.turnIndex, '魯夫失敗', meIdx, emits);
          pushDuelLog(emits, st, meIdx, meIdx);
        } else {
          pushLog(st,'平手',emits);
        }
      } else {
        scoreDefense(st, idx, p.extra.keep); // ★ 被擋
      }
      if(!st.players[st.turnIndex].alive){
        st.pending=null;
        endOrNext(st);
        return { state: st, emits };
      }
      if(!p.extra.firstDone){
        p.extra.firstDone=true;
        st.pending=p;
        return { state: st, emits };
      }
      st.pending=null;
      endOrNext(st);
      return { state: st, emits };
    }

    if(p.action==='kaido'){
      const g = effectGuard(st, idx, {ignoreProtect:true, ignoreDodge:true});
      if(!g.blocked){
        pushLog(st, `凱多：對 ${pname(st, idx)} 使出雷鳴八卦（無視防禦/閃避）`, emits);
        const my=tail(st.players[st.turnIndex].hand);
        const opp=tail(st.players[idx].hand);
        if(my>opp){
          scoreDuelAttack(st, meIdx, st.players[st.turnIndex].hand, st.players[idx].hand, { ignoreDefOrDodge: true }); // ★
          doEliminate(st, idx, '雷鳴八卦', meIdx, emits);
          pushDuelLog(emits, st, meIdx, idx);
        } else if(my<opp){
          scoreDefenseReversal(st, idx, st.players[idx].hand, st.players[st.turnIndex].hand, { ignoreDefOrDodge:true });
          doEliminate(st, st.turnIndex, '被反殺', meIdx, emits);
          pushDuelLog(emits, st, meIdx, meIdx);
        } else {
          pushLog(st,'平手',emits);
        }
      }
      st.pending=null;
      endOrNext(st);
      return { state: st, emits };
    }

    if(p.action==='killer'){
      st.players[idx].protected = false;
      st.players[idx].dodging   = false;
      pushLog(st, `基拉：解除 ${pname(st, idx)} 的保護/閃避`, emits);

      if (p.extra.boost) {
        if (action.payload?.duel === true) {
          pushLog(st, `基拉：向 ${pname(st, idx)} 發起決鬥`, emits);
          const my  = tail(p.extra.keep);
          const opp = tail(st.players[idx].hand);

          if (my > opp) {
            scoreDuelAttack(st, meIdx, p.extra.keep, st.players[idx].hand, { ignoreDefOrDodge: true }); // ★
            doEliminate(st, idx, '基拉擊倒', meIdx, emits);
            pushDuelLog(emits, st, meIdx, idx);
          } else if (my < opp) {
            scoreDefenseReversal(st, idx, st.players[idx].hand, p.extra.keep, { ignoreDefOrDodge:true });
            doEliminate(st, st.turnIndex, '決鬥失敗', meIdx, emits);
            pushDuelLog(emits, st, meIdx, meIdx);
          } else {
            pushLog(st,'平手',emits);
          }

          st.pending = null;
          endOrNext(st);
          return { state: st, emits };
        }
        return { state: st, emits }; // 等前端選擇
      }

      st.pending = null;
      endOrNext(st);
      return { state: st, emits };
    }

    if(p.action==='aokiji'){
      const g = effectGuard(st, idx, {});
      if(!g.blocked){
        st.players[idx].frozen=true;
        pushLog(st, `青雉：${pname(st, idx)} 凍結`, emits);
      } else {
        scoreDefense(st, idx, 16); // 青雉16被擋 → 防禦+6
      }
      st.pending=null;
      endOrNext(st);
      return { state: st, emits };
    }

   if(p.action==='roger'){
     // ★ 改：若是「被索隆丟出」觸發，by 應該是 p.caster（羅傑持有者），
     // 若是自己「打出羅傑」，則沒有 caster → 退回 st.turnIndex
     const by = (p && p.caster != null) ? p.caster : st.turnIndex;
 
     st.rogerPred = { by, pick: idx };
     pushLog(st, `羅傑：已預測 ${pname(st, idx)}`, emits);
     st.pending=null;
     endOrNext(st);
     return { state: st, emits };
    }


    // 大媽強化：先選目標 → 交給目標決定要不要花金幣
    if (p && p.action === 'bigmom' && p.extra && p.extra.boost) {
      const casterId = action.playerId;
      const targ = st.players[idx];
      if (!Number.isInteger(idx) || !targ || !targ.alive || idx === casterId) {
        emits.push({ to: casterId, type:'toast', text:'目標不合法' });
        return { state: st, emits };
      }

      const g = effectGuard(st, idx, {});
      if (g.blocked) {
        scoreDefense(st, idx, 14); // 大媽14強化被擋 → 防禦+4
        pushLog(st, `大媽（萬國強化）：對 ${pname(st, idx)} 的效果被保護/閃避抵銷`, emits);
        st.pending = null;
        endOrNext(st);
        return { state: st, emits };
      }

      st.pending = { action: 'bigmom-pay', caster: casterId, target: idx };
      emits.push({ to: idx, type:'toast', text:'大媽（萬國）：選擇交出 1 金幣，或直接淘汰' });
      return { state: st, emits };
    }
  }

  if(type==='PICK_DIGIT'){
    const p = st.pending;
    if(!p) return { state: st, emits };
    const d = action.payload?.digit;
    if(typeof d !== 'number') return { state: st, emits };

    if(p.action==='usopp'){
      if(d===1){
        pushLog(st,'騙人布：不能猜 1',emits);
        st.pending=null;
        endOrNext(st);
        return { state: st, emits };
      }
      const tgt = p.extra.target;
      const g = effectGuard(st, tgt, {});
      if(!g.blocked){
        const th = st.players[tgt].hand;
        if(th!=null && tail(th)===d){
          // ★ 命中分：強化狀態下用連擊數（streak）
          const streak = Math.max(1, (p.extra.streak||1));
          scoreUsoppHit(st, st.turnIndex, th, streak);
          doEliminate(st, tgt, `被猜中尾數 ${d}`, st.turnIndex, emits);

          if(p.extra.chain){
            const any = st.players.some((pp,i)=> i!==st.turnIndex && pp.alive);
            if(!any){
              st.pending=null;
              endOrNext(st);
              return { state: st, emits };
            }
            st.pending = { action:'usopp', extra:{ chain:true, target:null, streak: streak+1 } }; // ★ 連擊+1
            return { state: st, emits };
          }
        } else {
          pushLog(st,'猜錯了',emits);
          emits.push({ to:'all', type:'usopp_miss', casterId: st.turnIndex, targetId: tgt, digit: d });
        }
      }
      else {
        scoreDefense(st, tgt, 1); // 騙人布1被擋 → 防禦+1
      }
      st.pending=null;
      endOrNext(st);
      return { state: st, emits };
    }
  }

  if(type==='LUFFY_SECOND'){
    const p = st.pending;
    if(!p || p.action!=='luffy') return { state: st, emits };

    const idx = action.payload?.target;
    if(typeof idx !== 'number'){
      st.pending=null;
      endOrNext(st);
      return { state: st, emits };
    }
    if(idx===-1){
      st.pending=null;
      endOrNext(st);
      return { state: st, emits };
    }

    const g = effectGuard(st, idx, {});
    if(!g.blocked){
      pushLog(st, `魯夫：向 ${pname(st, idx)} 發起第二次決鬥`, emits);
      const my=tail(p.extra.keep);
      const opp=tail(st.players[idx].hand);
      if(my>opp){
        scoreDuelAttack(st, st.turnIndex, p.extra.keep, st.players[idx].hand, {}); // ★
        doEliminate(st, idx, '魯夫擊倒', st.turnIndex, emits);
        pushDuelLog(emits, st, st.turnIndex, idx);
      } else if(my<opp){
        scoreDefenseReversal(st, idx, st.players[idx].hand, p.extra.keep, {});
        doEliminate(st, st.turnIndex, '魯夫失敗', st.turnIndex, emits);
        pushDuelLog(emits, st, st.turnIndex, st.turnIndex);
      } else {
        pushLog(st,'平手',emits);
      }
    } else {
      scoreDefense(st, idx, p.extra.keep); // ★ 被擋
    }
    st.pending=null;
    endOrNext(st);
    return { state: st, emits };
  }

  // ===== 奎因擲幣 =====
  if (type === 'QUEEN_COIN') {
    const p = st.pending;
    if (!p || p.action !== 'queen') return { state: st, emits };

    const tgt = p.target;
    if (action.playerId !== tgt) {
      emits.push({ to: action.playerId, type: 'toast', text: '不是你要擲硬幣' });
      return { state: st, emits };
    }

    const g = effectGuard(st, tgt, {});
    if (g.blocked) {
      scoreDefense(st, tgt, 12); // 奎因12被擋 → 防禦+2
      if (st.players[tgt].dodging) st.players[tgt].dodging = false;
      pushLog(st, `奎因：${pname(st, tgt)} 有保護/閃避 → 不擲、不傳遞；效果結束`, emits);
      st.pending = null;
      endOrNext(st);
      return { state: st, emits };
    }

    emits.push({ to: action.playerId, type: 'coin_fx' });
    const face = (Math.random() < 0.5) ? 'H' : 'T';
    pushLog(st, `奎因：${pname(st, tgt)} 擲到 ${face === 'H' ? '正面' : '反面'}`, emits);

    if (face === 'H') {
      st.pending = null;
      endOrNext(st);
      return { state: st, emits };
    }

    st.players[tgt].skipNext = true;
    pushLog(st, `奎因：${pname(st, tgt)} 本回合將跳過（不能抽牌）`, emits);

    const next = nextAliveIdx(tgt, st.players);
    if (next === p.start) {
      st.pending = null;
      endOrNext(st);
      return { state: st, emits };
    }

    st.pending = { action: 'queen', start: p.start, target: next };
    emits.push({ to: next, type: 'toast', text: '奎因：請擲硬幣判定' });
    return { state: st, emits };
  }

  // ===== 大媽擲幣 =====
  if(type==='BIGMOM_COIN'){
    const p = st.pending;
    if(!p || p.action!=='bigmom-coin') return { state: st, emits };

    if (action.playerId !== st.turnIndex) {
      emits.push({ to: action.playerId, type:'toast', text:'不是你要擲硬幣' });
      return { state: st, emits };
    }

    const g = effectGuard(st, st.turnIndex, {});
    if (g.blocked) {
      scoreDefense(st, st.turnIndex, 14); // 大媽14擲幣被擋 → 防禦+4
      if (st.players[st.turnIndex].dodging){ st.players[st.turnIndex].dodging = false; }
      pushLog(st, `大媽：已被保護/閃避覆蓋 → 不擲硬幣，效果結束`, emits);
      st.pending=null;
      endOrNext(st);
      return { state: st, emits };
    }

    emits.push({ to: action.playerId, type:'coin_fx' });
    const face = (Math.random() < 0.5) ? 'H' : 'T';
    if(face==='H'){
      me.protected=true;
      pushLog(st,'大媽：擲到正面 → 獲得保護',emits);
    } else {
      me.dodging=true;
      pushLog(st,'大媽：擲到反面 → 獲得閃避',emits);
    }

    st.pending=null;
    endOrNext(st);
    return { state: st, emits };
  }

  // ===== 大媽強化：被點名者的最終選擇 =====
  if (type === 'BIGMOM_CHOICE') {
    const p = st.pending;
    if (!p || p.action !== 'bigmom-pay') return { state: st, emits };

    const casterId = p.caster;
    const targetId = p.target;

    if (action.playerId !== targetId) {
      emits.push({ to: action.playerId, type:'toast', text:'不是你的選擇' });
      return { state: st, emits };
    }

    const caster = st.players[casterId];
    const targ   = st.players[targetId];

    let choice = action.payload?.choice === 'pay' ? 'pay' : 'die';
    const tgGold = targ.gold || 0;
    if (choice === 'pay' && tgGold <= 0) choice = 'die';

    if (choice === 'pay') {
      targ.gold = Math.max(0, tgGold - 1);
      caster.gold = (caster.gold || 0) + 1;
      pushLog(st, `大媽：${pname(st, targetId)} 支付 1 金幣給 ${pname(st, casterId)}`, emits);
    } else {
      doEliminate(st, targetId, '大媽：拒繳金幣', casterId, emits);
    }

    st.pending = null;
    endOrNext(st);
    return { state: st, emits };
  }

  if(type==='ORDER_COMMIT'){
    const p = st.pending;
    if(!p || p.action!=='kata-order') return { state: st, emits };

    const order = action.payload?.order;
    if(!Array.isArray(order)) return { state: st, emits };

    const n = p.n;
    const finalSeg = order.slice(0, n).reverse();
    st.deck.splice(st.deck.length - n, n, ...finalSeg);
    pushLog(st,'卡塔庫栗：已依你指定順序（上=最上）放回頂部',emits);

    emits.push({ to: action.playerId, type:'kata_order_done', order });

    st.pending=null;
    endOrNext(st);
    return { state: st, emits };
  }

  if(type==='MULTIPICK_COMMIT'){
    const p = st.pending;
    if(!p || p.action!=='teach-multipick') return { state: st, emits };

    const pickedIndices = action.payload?.pickedIndices;
    if(!Array.isArray(pickedIndices)) return { state: st, emits };

    const n = p.n;
    const topNow = st.deck.splice(st.deck.length - n, n); // 自底到頂
    const pickedOrig = new Set(pickedIndices.map(j => (n - 1 - j))); // UI上→內部

    const toDiscard = [];
    const toBack = [];
    topNow.forEach((id,i)=>{
      (pickedOrig.has(i)?toDiscard:toBack).push(id);
    });

    // ② 改為直接把覆蓋資訊寫入棄牌堆物件（不再寫 meta.coveredByTeach）
    const casterId = st.turnIndex;
    st.discard.push(...toDiscard.map(id => ({ id, coverBy: 'teach', owner: casterId })));

    if (toDiscard.length){
      emits.push({ to:'all', type:'silent_discard', by: casterId, cards: toDiscard }); // 靜默
      emits.push({ to: casterId, type:'teach_cover', cards: toDiscard });               // 私訊
    }

    st.deck.push(...toBack);
    pushLog(st, `黑鬍子強化：覆蓋 ${toDiscard.length} 張（出牌者可見）`, emits);

    st.pending=null;
    endOrNext(st);
    return { state: st, emits };
  }

  if (type === 'PICK_CANCEL') {
    const p = st.pending;
    if (p && p.action === 'law' && p.extra?.boost) {
      st.pending = null;
      endOrNext(st);
      return { state: st, emits };
    }
    if (p && p.action === 'killer' && p.extra?.boost) {
      st.pending = null;
      endOrNext(st);
      return { state: st, emits };
    }
  }

  return { state: st, emits };
}

// ---------------------------------------------------------------
module.exports = {
  CARDS, COUNTS,
  createInitialState,
  applyAction,
  getVisibleState,
  isRoundEnded,
  nextRound,
  _util: { tail, isHighTail, cardById, buildDeck, buildVenues, shuffle }
};// engine.js — One Piece《情書》規則引擎（純函式 / 無 UI）
// 目的：可在 Node.js（或雲端 Function）中運行，前端僅送出意圖，
// 引擎回傳新的 state 與需要給前端的「私訊 / 日誌」事件。
// ---------------------------------------------------------------
// 導出 API：
//   createInitialState(playerCount)
//   applyAction(state, action)  // 純函式，不觸 DOM
//   getVisibleState(state, viewerId)
//   isRoundEnded(state)
//   nextRound(state)
//
// 事件模型（協議）：
//   action: {
//     type: 'JOIN_ROOM' | 'START_ROUND' | 'DRAW' | 'PLAY_CARD' |
//            'PICK_TARGET' | 'PICK_DIGIT' |
//            'LUFFY_SECOND' | 'LUFFY_BOOST_COMMIT' |
//            'QUEEN_COIN' | 'BIGMOM_COIN' |
//            'ORDER_COMMIT' | 'MULTIPICK_COMMIT' |
//            'CLOSE_FINAL_RANK' | 'BIGMOM_CHOICE',
//     roomId: string,
//     playerId: number,       // 誰提出意圖
//     payload?: any           // 其他參數（target、digit、order...）
//   }
//
// applyAction 回傳：{ state, emits }
//   emits: 陣列（伺服器可依此轉交給所有人或單一玩家）
//     - { to: 'all',   type:'log', text:string }
//     - { to: number,  type:'peek', lines:string[] }   // 僅該玩家可見
//     - { to: number,  type:'toast', cardId:number }   // 前端可做飛牌動畫
//     - { to: 'all',   type:'duel_log', loserId:number, cardId:number } // 決鬥特效
//     - { to: number,  type:'coin_fx' } // 全畫面 coin.mp4 只播給這個人
//
// ---------------------------------------------------------------
// 資料定義
const CARDS = [
  { id:0,  name:"薩波", venue:"德雷斯羅薩鬥技場" },
  { id:1,  name:"騙人布", venue:"艾尼艾斯大廳" },
  { id:2,  name:"羅賓", venue:"阿拉巴斯坦" },
  { id:3,  name:"香吉士", venue:"巴拉蒂" },
  { id:4,  name:"喬巴", venue:"佐烏" },
  { id:5,  name:"索隆", venue:"和之國" },
  { id:6,  name:"羅",   venue:"龐克哈薩德" },
  { id:7,  name:"娜美", venue:"維薩利亞" },
  { id:8,  name:"魯夫", venue:"魚人島" },
  { id:9,  name:"女帝漢考克", venue:"九蛇島" },
  { id:10, name:"凱多", venue:"鬼島" },
  { id:11, name:"基德", venue:"夏波帝諸島" },
  { id:12, name:"奎因", venue:"鬼島" },
  { id:13, name:"基拉", venue:"夏波帝諸島" },
  { id:14, name:"大媽", venue:"萬國" },
  { id:15, name:"卡塔庫栗", venue:"萬國" },
  { id:16, name:"庫山（青雉）", venue:"蜂巢島" },
  { id:17, name:"黑鬍子", venue:"蜂巢島" },
  { id:18, name:"紅髮香克斯", venue:"奧羅傑克森號" },
  { id:19, name:"哥爾羅傑", venue:"奧羅傑克森號" },
];
const COUNTS = {0:1,1:5,2:2,3:2,4:2,5:2,6:1,7:1,8:1,9:1,10:1,11:1,12:1,13:1,14:1,15:1,16:1,17:1,18:1,19:1};
const VENUE_POOL = [...new Set(CARDS.map(c=>c.venue))].map(name=>({name}));

// ---------------------------------------------------------------
// 小工具
const tail = (id)=> ((id%10)+10)%10;
const isHighTail = (id)=> tail(id) >= 7;
const cardById = (id)=> CARDS.find(c=>c.id===id);
const cardLabel = (id) => (id!=null && cardById(id))
  ? `${cardById(id).id}｜${cardById(id).name}`
  : '（無牌）';

// 卡 → 場地名稱 對照（請與前端 CARD_VENUE 一致）
const CARD_VENUE = {
  0:"德雷斯羅薩鬥技場", 1:"艾尼艾斯大廳", 2:"阿拉巴斯坦", 3:"巴拉蒂", 4:"佐烏",
  5:"和之國", 6:"龐克哈薩德", 7:"維薩利亞", 8:"魚人島", 9:"九蛇島",
  10:"鬼島", 11:"夏波帝諸島", 12:"鬼島", 13:"夏波帝諸島",
  14:"萬國", 15:"萬國", 16:"蜂巢島", 17:"蜂巢島", 18:"奧羅傑克森號", 19:"奧羅傑克森號"
};

function isEnhancedNow(st, cardId){
  const vn = CARD_VENUE[cardId];
  if (!vn || !Array.isArray(st.venues)) return false;
  return !!st.venues.find(v => v && (v.name === vn));
}
// 統一推送強化影片事件（避免每張卡重覆寫）
// ★ 凱多（10）：只有同時握有「大媽(14)」且在強化場地時才廣播影片
function pushEnhFxIfAny(emits, st, cardId){
  if (!isEnhancedNow(st, cardId)) return;

  // 凱多特殊條件：必須與大媽同握才算成功發動
  if (cardId === 10) {
    const me = st.players?.[st.turnIndex];
    const hasBigMomInHandNow = (me && me.hand === 14);
    if (!hasBigMomInHandNow) return; // 不廣播，前端就不會播放強化影片
  }

  emits.push({ to: "all", type: "enh_fx", cardId });
 }

// ======== 統計：資料容器與工具 ========
function ensureStats(st){
  if (!st.stats) st.stats = {};
  if (!Array.isArray(st.players)) return st.stats;
  for (let i=0;i<st.players.length;i++){
    if (!st.stats[i]) {
      st.stats[i] = {
        coinScore: 0,   // 金幣分
        atkScore: 0,    // 攻擊分
        defScore: 0,    // 防禦分
        hitScore: 0,    // 命中分
        intelScore: 0,  // 偵查分
        survivalTurns: 0, // 生存：輪到自己的次數
        reachedFinal: false,
        wonFinal: false
      };
    }
  }
  return st.stats;
}
function addStat(st, pid, key, n){ ensureStats(st); if (st.stats[pid]) st.stats[pid][key] = (st.stats[pid][key]||0) + (n||0); }
function setFlag(st, pid, key, v){ ensureStats(st); if (st.stats[pid]) st.stats[pid][key] = !!v; }

// —— 攻擊分：決鬥勝利加分（依規則，取尾數差，含加乘）
function scoreDuelAttack(st, byIdx, myCardId, oppCardId, opt={}){
  const t = (x)=> (typeof x==='number') ? (Math.abs(x)%10) : 0;
  let base = Math.max(0, t(myCardId) - t(oppCardId));
  if (opt.sanjiBoost) base += 1;
  if (opt.ignoreDefOrDodge) base *= 2;
  if (opt.multiElimCount && opt.multiElimCount > 1) base *= opt.multiElimCount;
  addStat(st, byIdx, 'atkScore', base);
}
// —— 防禦分：以防擋下對方的「攻擊牌尾數」
function scoreDefense(st, defenderId, attackerCardId){
  const t = (Math.abs(attackerCardId||0))%10;
  addStat(st, defenderId, 'defScore', t);
}
// —— 防禦分（反殺）：決鬥中防守方贏時，按點數相扣加到防禦分
function scoreDefenseReversal(st, defenderId, defenderCardId, attackerCardId, opt={}){
  const t = (x)=> (typeof x==='number') ? (Math.abs(x)%10) : 0;
  let base = Math.max(0, t(defenderCardId) - t(attackerCardId));
  if (opt.sanjiBoost) base += 1;                 // 例如香吉士強化決鬥的 +1
  if (opt.ignoreDefOrDodge) base *= 2;           // 例如凱多/基拉強化無視防禦
  if (opt.multiElimCount && opt.multiElimCount>1) base *= opt.multiElimCount; // （保留通用性）
  addStat(st, defenderId, 'defScore', base);
}
// —— 命中分（騙人布 / 索隆 / 羅傑）
function scoreUsoppHit(st, usoppId, targetCardId, streak=1){
  const t = (Math.abs(targetCardId||0))%10;
  addStat(st, usoppId, 'hitScore', t * Math.max(1, streak));
}
function scoreZoroElim(st, zoroId, victimCardId){
  const t = (Math.abs(victimCardId||0))%10;
  addStat(st, zoroId, 'hitScore', t * 2);
}
function scoreRogerPredict(st, rogerId, coinsWon){
  addStat(st, rogerId, 'hitScore', Math.max(0, coinsWon||0) * 5);
}
// —— 偵查分（羅賓/羅/黑鬍子/卡塔庫栗）
function scorePeek(st, seerId, seenCardId){
  const t = (Math.abs(seenCardId||0))%10;
  addStat(st, seerId, 'intelScore', t);
}

function pname(st, idx){
  const p = st.players?.[idx];
  const nick = p?.client?.displayName || p?.displayName || '';
  return `P${(idx!=null? idx+1 : '?')}${nick? `（${nick}）`: ''}`;
}

const shuffle = (a0)=>{ const a=a0.slice(); for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } return a; };
const buildDeck = ()=>{ const d=[]; for(const [id,cnt] of Object.entries(COUNTS)){ for(let i=0;i<cnt;i++) d.push(Number(id)); } return shuffle(d); };
const buildVenues = (pc)=> shuffle(VENUE_POOL).slice(0, Math.ceil(pc/2));
const nextAliveIdx = (from, ps)=>{ for(let s=1;s<=ps.length;s++){ const i=(from+s)%ps.length; if(ps[i]?.alive) return i; } return from; };

// ---------------------------------------------------------------
// 決鬥日誌小工具
function guessLoserCardId(st, loserId){
  const p = st.players?.[loserId];
  if (!p) return null;
  if (typeof p.lastPlayed === 'number') return p.lastPlayed;
  if (typeof p.hand === 'number') return p.hand;
  if (Array.isArray(st.discard)){
    for (let i=st.discard.length-1; i>=0; i--){
      const d = st.discard[i];
      if (d && typeof d === 'object' && typeof d.id === 'number' && d.by === loserId) return d.id; // 保留舊格式相容
      if (typeof d === 'number') return d;
      if (d && typeof d === 'object' && typeof d.id === 'number') return d.id; // 新增：相容 teach 物件
    }
  }
  return null;
}

function pushDuelLog(emits, st, challengerId, loserId){
  const cardId = guessLoserCardId(st, loserId);
  const challenger = st.players[challengerId];
  const loser = st.players[loserId];
  const challengerName = challenger?.client?.displayName || challenger?.displayName || `P${challengerId+1}`;
  const loserName = loser?.client?.displayName || loser?.displayName || `P${loserId+1}`;
  const line = `決鬥：${challengerName} vs ${loserName} → ${loserName} 的卡 ${cardId} 被擊敗`;
  emits.push({ to:"all", type:"log", text: line });
  emits.push({ to:"all", type:"duel_log", loserId, cardId });
}

// ---------------------------------------------------------------
// 狀態建模
function initialPlayers(n){
  return Array.from({length:n},(_,i)=>({
    id:i, displayName:`P${i+1}`, avatar:(i%8)+1,
    alive:true, protected:false, dodging:false, frozen:false,
    hand:null, tempDraw:null, gold:0, skipNext:false,
    iceInfected:false, iceArmed:false
  }));
}

function baseState(playerCount){
  const players = initialPlayers(playerCount);
  const deck = buildDeck();
  players.forEach(p=>{ p.hand = deck.pop() ?? null; }); // 開局每人 1 張
  const venues = buildVenues(playerCount);
  return {
    players, deck, discard:[], venues,
    roundNo: 1, startSeat:0, turnIndex:0, turnStep:'draw',
    nextRoundStart:null, rogerPred:null, shanksBonusUid:null,
    saboSilence:false, saboSilenceOn:false, saboSilenceOwner:null,
    iceWindowOn:false, iceWindowOwner:null,
    pending:null, lastElimBy:null,
    HOT:14, _hotNotified:false,
    chestTotal: playerCount*5, chestLeft: playerCount*5,
    roundKills:Array(playerCount).fill(0),
    turnKills:Array(playerCount).fill(0),
    currentTurnOwner:0,
    meta: { coveredByTeach: [] }, // 仍保留，但不再使用
    stats: {}, // ★ 統計容器
    log:[
      `第 1 局開始。起始玩家：P1`,
      `本局強化場地：${venues.map(v=>v.name).join('、')}（${venues.length} 張）`
    ]
  };
}

function clone(o){ return JSON.parse(JSON.stringify(o)); }

function pushLog(st, text, emits){
  st.log.push(text);
  emits.push({ to:'all', type:'log', text });
}

function checkHot(st){
  if(st._hotNotified) return;
  if((st.deck?.length ?? 999) <= st.HOT){
    st._hotNotified = true;
    st.log.push(`⚠ 戰局進入白熱化：牌堆剩 ${st.HOT} 張（紅髮可啟動）`);
  }
}

function effectGuard(st, idx, {ignoreProtect=false, ignoreDodge=false}={}){
  const t = st.players[idx];
  if(!t?.alive) return {blocked:true, reason:'dead'};
  if(!ignoreProtect && t.protected) return {blocked:true, reason:'protected'};
  if(!ignoreDodge && t.dodging){ t.dodging=false; return {blocked:true, reason:'dodged'}; }
  return {blocked:false};
}

// ★★★ 修改：doEliminate 支援 emits，並在丟手牌/暫抽時發出 silent_discard
function doEliminate(st, victimIdx, reason, byIdx = st.turnIndex, emits){
  const p = st.players[victimIdx];
  if(!p.alive) return;

  const silents = [];
  if(p.tempDraw != null){ st.discard.push(p.tempDraw); silents.push(p.tempDraw); p.tempDraw = null; }
  if(p.hand     != null){ st.discard.push(p.hand);     silents.push(p.hand);     p.hand     = null; }
  if (emits && silents.length){
    emits.push({ to:'all', type:'silent_discard', by:victimIdx, cards: silents });
  }

  p.alive=false; p.protected=false; p.dodging=false; p.frozen=false;
  p.iceInfected=false; p.iceArmed=false;
  if(st.iceWindowOn && st.iceWindowOwner === victimIdx){
    st.iceWindowOn=false; st.iceWindowOwner=null;
  }
  if(byIdx!==victimIdx){
    st.roundKills[byIdx] = (st.roundKills[byIdx]||0)+1;
    if(byIdx===st.currentTurnOwner){
      st.turnKills[byIdx] = (st.turnKills[byIdx]||0)+1;
    }
  }
  st.lastElimBy = byIdx;
  st.log.push(`P${p.id+1} 出局（${reason}）`);
}

// ====== ★ awardRound 替換版（含統計與 final 打包）======
function awardRound(st, winner, tieBonus=0){
  ensureStats(st);
  const by = winner.id;
  const bonusKills = st.turnKills[by] || 0;
  const base  = 1;
  let gain = base + bonusKills + tieBonus;
  if(st.chestLeft<=0){
    st.log.push('寶箱已空，無法再拿金幣。');
    return;
  }
  if(gain > st.chestLeft) gain = st.chestLeft;
  winner.gold += gain;
  st.chestLeft -= gain;
  addStat(st, by, 'coinScore', gain); // ★ 金幣分
  st.log.push(`★ 本局勝者：P${winner.id+1} +${gain} 金幣（保底1 + 擊倒 ${bonusKills}${tieBonus>0?` + 平手加成 ${tieBonus}`:''}）→ 寶箱剩 ${st.chestLeft}`);

  if(st.rogerPred && st.rogerPred.pick!=null && st.rogerPred.by!=null && st.rogerPred.pick===winner.id){
    const r = st.players[st.rogerPred.by];
    if(st.chestLeft>0){
      const g2 = Math.min(gain, st.chestLeft);
      r.gold += g2;
      st.chestLeft -= g2;
      addStat(st, r.id, 'coinScore', g2);     // ★ 金幣分（羅傑得到的）
      scoreRogerPredict(st, r.id, g2);        // ★ 命中分（*5）
      st.log.push(`☆ 羅傑預測成功：P${r.id+1} 也獲得 ${g2}`);
    } else {
      st.log.push('☆ 羅傑預測成功：但寶箱已空');
    }
  }

// === 寶箱被拿空：打包賽季結算 ===
if (st.chestLeft === 0) {
  // 確保有統計容器（你前面應該已加過 ensureStats(st)）
  ensureStats(st);

  // 1) 蒐集每位玩家的統計分數，產出 scoreboard
  const board = {};
  for (let i = 0; i < st.players.length; i++) {
    const s = st.stats[i] || {};
    const survivalScore =
      (s.survivalTurns || 0) * (s.reachedFinal ? 2 : 1) * (s.wonFinal ? 2 : 1);

    board[i] = {
      coinScore: s.coinScore || 0,   // 金幣分（累計獲得金幣數）
      atkScore: s.atkScore || 0,     // 攻擊分
      defScore: s.defScore || 0,     // 防禦分（保護/閃避成功）
      hitScore: s.hitScore || 0,     // 命中分（指向/擊中成效）
      intelScore: s.intelScore || 0, // 情報分（偷看/探測等）
      survivalScore                  // 生存分（回合數與是否到/贏最終）
    };
  }

 // 2) 帶出玩家的 meta（名字、pid、頭像），供結果頁顯示
const playersMeta = {};
st.players.forEach((p, i) => {
  playersMeta[i] = {
    id: i,
    name:
      p.client?.displayName ??
      p.displayName ??
      p.name ??
      p.nick ??
      `P${i + 1}`,
   pid: (p.pid != null ? p.pid : (p.client?.pid ?? i)),
    avatar: (p.avatar != null ? p.avatar : (p.client?.avatar ?? null)),
  };
});

  // 3) 金幣排名（只宣告一次，避免 const rank 重複）
  const rank = [...st.players]
    .map(p => ({ id: p.id, gold: p.gold || 0 }))
    .sort((a, b) => b.gold - a.gold);

  // 如需保留快取可寫：st._finalRank = rank;

  // 4) 打包 final 物件（result.html 會用這包渲染）
  st.final = {
    seasonNo: st.seasonNo || 1,
    ranking: rank.map(r => ({
      id: r.id,
      name: (playersMeta[r.id] && playersMeta[r.id].name) || `P${r.id + 1}`,
      coins: r.gold,
      pid: playersMeta[r.id] ? playersMeta[r.id].pid : null,
      avatar: playersMeta[r.id] ? playersMeta[r.id].avatar : null
    })),
    playersMeta,
    scoreboard: board
  };

  // 5) 結束本回合的回合狀態（保險）
  st.turnStep = 'ended';
  // 若你這裡原本有 endOrNext(st) 或其他收尾，依原本邏輯保留。
}

}

function showdown(st){
  const showVal = (id)=> (id<10 ? id : Math.floor(id/10) + (id%10));
  const isCore09 = (id)=> id>=0 && id<=9;
  const alive = st.players.filter(p=>p.alive);
  alive.forEach(p => setFlag(st, p.id, 'reachedFinal', true)); // ★ 活到最終
  let tieBonus = 0;
  let loopGuard = 0;

  const computeBest = ()=>{
    let bestVal = -Infinity, bestPri = -1, cands = [];
    alive.forEach(p=>{
      const id = (p.hand ?? 0);
      let val = showVal(id);
      if(st.shanksBonusUid!=null && p.id===st.shanksBonusUid){
        val = val + 1;
      }
      const pri = isCore09(id) ? 1 : 0;
      if(val>bestVal){
        bestVal = val; bestPri = pri; cands = [p];
      } else if(val===bestVal){
        if(pri>bestPri){
          bestPri = pri; cands = [p];
        } else if(pri===bestPri){
          cands.push(p);
        }
      }
    });
    return { cands, bestVal, bestPri };
  };

  st.log.push('★ 比牌（新制）開始：存活者公開手牌');
  while(true){
    loopGuard++; if(loopGuard>50){
      st.log.push('※ 防呆：比牌循環過多，強制中止');
      break;
    }

    const {cands, bestVal, bestPri} = computeBest();
    if(cands.length===1){
      const w=cands[0];
      const wId = w.hand;
      const wVal = showVal(wId) + ((st.shanksBonusUid!=null && w.id===st.shanksBonusUid)?1:0);
      st.log.push(`★ 比牌結果：P${w.id+1} 最高 → 值 ${wVal}${isCore09(wId)?'（0–9 方）':''}${tieBonus>0?`（累積平手 +${tieBonus}）`:''}`);
      setFlag(st, w.id, 'wonFinal', true); // ★ 贏下最終
      awardRound(st, w, tieBonus);
      st.turnStep='ended';
      st.shanksBonusUid = null;
      break;
    }

    st.log.push(`★ 比牌平手（同最高值${bestVal}${bestPri===1?'，且皆為 0–9 方':''}）。將所有牌洗回，存活者各抽 1 → 重比。`);
    tieBonus += 1;

    const pool = [];
    pool.push(...st.deck);
    pool.push(...st.discard);
    st.deck=[];

    st.players.forEach(p=>{
      if(p.hand!=null){ pool.push(p.hand); p.hand=null; }
      if(p.tempDraw!=null){ pool.push(p.tempDraw); p.tempDraw=null; }
    });

    const newDeck = shuffle(pool);
    st.deck = newDeck;
    alive.forEach(p=>{
      p.hand = st.deck.pop() ?? null;
    });
    st.log.push('已洗回所有牌並重新抽 1 張。');
  }
}

function endOrNext(st){
  checkHot(st);

  const nextIdx = nextAliveIdx(st.turnIndex, st.players);

  if(st.iceWindowOn && st.iceWindowOwner === nextIdx){
    st.iceWindowOn=false; st.iceWindowOwner=null;
  }
  if(st.saboSilenceOn && st.saboSilenceOwner === nextIdx){
    st.saboSilenceOn=false; st.saboSilenceOwner=null;
  }

  const alive = st.players.filter(p=>p.alive);
  if(alive.length===1){
    const w=alive[0];
    st.log.push(`★ 本局結束：僅 P${w.id+1} 存活`);
    awardRound(st, w);
    st.turnStep='ended';
    return;
  }

  if(st.deck.length===0){
    showdown(st);
    return;
  }

  st.turnIndex = nextIdx;
  st.turnStep='draw';
  st.log.push(`→ 輪到 P${st.turnIndex+1}`);
}

// ---------------------------------------------------------------
// 導出：建立初始局面（允許動態玩家人數）
function createInitialState(playerCount=1){
  // playerCount 改為 1 → 不預塞 4 人
  const st = baseState(Math.max(1, playerCount || 1));

  // 為了與動態等待室相容，先清空所有玩家 client
  st.players.forEach(p => {
    p.client = null;
    p.displayName = `P${p.id + 1}`;
    p.avatar = (p.id % 8) + 1;
  });

  if(st.deck.length <= st.HOT){
    st._hotNotified = true;
    st.log.push(`⚠ 戰局進入白熱化：牌堆剩 ${st.deck.length}（紅髮可啟動）`);
  }
  return st;
}


// ---------------------------------------------------------------
// 導出：資訊遮蔽（③ 調整這段）
function getVisibleState(state, viewerId){
  const vis = clone(state);

  // 遮蔽他人手牌/暫抽
  vis.players.forEach((p)=>{
    if(p.id !== viewerId){
      if(p.hand!=null) p.hand = null;
      if(p.tempDraw!=null) p.tempDraw = null;
    }
  });

  // 黑鬍子覆蓋：只允許覆蓋者本人看到真實 id；他人看到卡背
  if (Array.isArray(vis.discard)) {
    vis.discard = vis.discard.map((card) => {
      if (card && typeof card === 'object' && card.coverBy === 'teach') {
        return (viewerId !== card.owner) ? { back: true } : card.id; // 回傳數字以保相容
      }
      return card;
    });
  }

  return vis;
}

// ---------------------------------------------------------------
// 導出：回合是否結束
function isRoundEnded(state){
  if(state.turnStep==='ended') return true;
  if(state.players.filter(p=>p.alive).length<=1) return true;
  return false;
}

// ---------------------------------------------------------------
// 導出：依規則開下一局（保留跨局統計）
function nextRound(state){
  const st = clone(state);
  const playerCount = st.players.length;

  // 重建玩家陣列，保留 gold / client / displayName / avatar
  const players = initialPlayers(playerCount);
  for (let i = 0; i < playerCount; i++) {
    const oldP = st.players[i];
    const p = players[i];

    p.gold = oldP.gold || 0;

    if (oldP.client) p.client = clone(oldP.client);
    if (oldP.displayName) p.displayName = oldP.displayName;
    if (oldP.avatar != null) p.avatar = oldP.avatar;
    if (!p.avatar && oldP.client?.avatar != null) p.avatar = oldP.client.avatar;
  }

  // 發新牌
  const deck = buildDeck();
  players.forEach(p => {
    p.hand = deck.pop() ?? null;
  });

  // 場地重抽
  const venues = buildVenues(playerCount);

  // 起始座位：nextRoundStart 優先，否則上一局 +1
  const startSeat = (st.nextRoundStart != null)
    ? st.nextRoundStart
    : (st.startSeat + 1) % playerCount;

  return {
    players, deck, discard: [], venues,
    roundNo: st.roundNo + 1,
    startSeat, turnIndex: startSeat, turnStep: 'draw',
    nextRoundStart: null, rogerPred: null, shanksBonusUid: null,

    saboSilence: false, saboSilenceOn: false, saboSilenceOwner: null,
    iceWindowOn: false,  iceWindowOwner: null,

    pending: null, lastElimBy: null,

    HOT: 14, _hotNotified: false,

    chestTotal: st.chestTotal,
    chestLeft:  st.chestLeft,

    roundKills: Array(playerCount).fill(0),
    turnKills:  Array(playerCount).fill(0),
    currentTurnOwner: startSeat,

    meta: { coveredByTeach: [] }, // 保留清空，但不再使用
    stats: st.stats || {}, // ★ 跨局累計
    log: [
      `第 ${st.roundNo + 1} 局開始。起始玩家：P${startSeat + 1}`,
      `本局強化場地：${venues.map(v => v.name).join('、')}（${venues.length} 張）`,
      `寶箱剩餘金幣：${st.chestLeft} / ${st.chestTotal}`
    ]
  };
}

// ---------------------------------------------------------------
// 主純函式 applyAction
function applyAction(state, action){
  const st = clone(state);
  const emits = [];
  const me = st.players[action.playerId];
  if(!me){ return { state: st, emits }; }

  const type = action.type;

  // ===== 房間 & 流程控制 =====
  if(type==='START_ROUND'){
    if(st.roundNo===1 && st.log.length<=2){
      return { state: st, emits };
    }
    if(st.turnStep!=='ended') return { state: st, emits };
    const ns = nextRound(st);
    return { state: ns, emits };
  }

  if(type==='CLOSE_FINAL_RANK'){
    if(st._finalRank){ delete st._finalRank; }
    return { state: st, emits };
  }

  // ===== 抽牌階段 =====
  if(type==='DRAW'){
    if(st.turnStep!=='draw' || st.turnIndex!==action.playerId) return { state: st, emits };

    // 回合開始的前置
    st.saboSilence=false;
    me.protected=false;
    st.turnKills = Array(st.players.length).fill(0);
    st.currentTurnOwner = st.turnIndex;

    if(!me.alive){
      st.turnIndex = nextAliveIdx(st.turnIndex, st.players);
      pushLog(st, `P${me.id+1} 已出局 → P${st.turnIndex+1}`, emits);
      return { state: st, emits };
    }

    if(st.iceWindowOn && st.turnIndex === st.iceWindowOwner){
      st.iceWindowOn=false;
      st.iceWindowOwner=null;
      pushLog(st, '冰鬼：標記視窗已結束（回到施放者）', emits);
    }
    if(st.saboSilenceOn && st.turnIndex === st.saboSilenceOwner){
      st.saboSilenceOn=false;
      st.saboSilenceOwner=null;
      pushLog(st, '薩波靜默：視窗已結束（回到/經過施放者）', emits);
    }

    if(me.skipNext){
      me.skipNext=false;
      pushLog(st, `P${me.id+1} 跳過回合（麻痺解除）`, emits);
      st.turnIndex = nextAliveIdx(st.turnIndex, st.players);
      return { state: st, emits };
    }

    if(me.iceInfected){
      me.iceInfected=false;
      me.iceArmed=true;
      pushLog(st, '冰鬼：標記生效，本回合受檢查', emits);
    }

    addStat(st, st.turnIndex, 'survivalTurns', 1); // ★ 生存分：輪到自己 +1
    me.tempDraw = st.deck.pop() ?? null;
    checkHot(st);
    st.turnStep='choose';
    pushLog(st, `P${me.id+1} 抽到一張牌`, emits);
    return { state: st, emits };
  }

  // ===== 出牌 =====
  if(type==='PLAY_CARD'){
    if(st.turnStep!=='choose' || st.turnIndex!==action.playerId) return { state: st, emits };
    const which = action.payload?.which; // 'hand' | 'drawn'
    const a = me.hand, b = me.tempDraw;
    const playId = (which==='hand')? a : b;
    const keepId = (which==='hand')? b : a;
    if(playId==null) return { state: st, emits };

    // 凍結只能打剛抽
    const wasFrozen = me.frozen;
    if(wasFrozen && which!=='drawn'){
      pushLog(st, '※ 凍結：只能打剛抽的牌', emits);
      return { state: st, emits };
    }
    me.frozen=false;

    // 7+6/8 rule
    const has7 = (a===7 || b===7);
    const has68 = (a===6 || b===6) || (a===8 || b===8);
    if(!wasFrozen && has7 && has68 && playId!==7){
      pushLog(st, '※ 規則：同握 7 與 (6/8) 必須打 7', emits);
      return { state: st, emits };
    }

    emits.push({ to: action.playerId, type:'toast', cardId: playId });
    me.hand = keepId;
    me.tempDraw = null;
    st.discard.push(playId);
    pushLog(st, `${pname(st, st.turnIndex)} 打出 ${cardLabel(playId)}`, emits);

    // 若此卡在當前場地為強化版 → 廣播強化影片
    pushEnhFxIfAny(emits, st, playId);

    // 冰鬼標記
    if(st.iceWindowOn && st.turnIndex !== st.iceWindowOwner){
      if((playId % 2) === 1){
        me.iceInfected = true;
        pushLog(st, '冰鬼：你打出奇數 → 已被「標記」', emits);
      }
    }

    const card = cardById(playId);
    const venueActive = st.venues.some(v=>v.name===card.venue);

    // 薩波靜默
    if(st.saboSilenceOn && isHighTail(playId)){
      pushLog(st, `【靜默】薩波：尾數≥7 不結算 → ${card.name}` , emits);
      endOrNext(st);
      return { state: st, emits };
    }
    if(st.saboSilence && playId>=7){
      pushLog(st, `【靜默】本回合 7+ 效果無效：${card.name}`, emits);
      endOrNext(st);
      return { state: st, emits };
    }

    // 冰鬼檢查
    if(me.iceArmed){
      if((playId % 2) === 1){
        doEliminate(st, st.turnIndex, '冰鬼：下一回合仍出奇數 → 死亡', st.turnIndex, emits);
        endOrNext(st);
        return { state: st, emits };
      } else {
        me.iceArmed=false;
        pushLog(st, '冰鬼：本回合出偶數 → 解除', emits);
      }
    }

    // === 卡牌結算 ===
    switch(playId){
case 0: { // 薩波
  const affected=[];
  st.players.forEach(p=>{
    if(!p.alive) return;
    if(p.protected) return;
    if(p.dodging){ p.dodging=false; return; }
    affected.push(p);
  });
  affected.forEach(p=>{
    if(p.hand!=null) st.deck.push(p.hand);
    p.hand=null;
  });
  st.deck = shuffle(st.deck);
  affected.forEach(p=>{
    p.hand = st.deck.pop() ?? null;
  });
  if(venueActive){
    pushEnhFxIfAny(emits, st, 0);
    st.saboSilenceOn=true;
    st.saboSilenceOwner=st.turnIndex;
    pushLog(st, '薩波（強化）：靜默啟動（直到回到/經過你）。尾數≥7 打出/被棄出不結算。', emits);
  }
  pushLog(st, `薩波：影響 ${affected.length} 人（保護/閃避免疫不算）`, emits);
  endOrNext(st);
  return { state: st, emits };
}
      case 1: { // 騙人布
        st.pending = { action:'usopp', extra:{ chain:venueActive, target:null } };
        return { state: st, emits };
      }
      case 2: { // 羅賓
        if(venueActive){
          const lines=[];
          st.players.forEach((pp,i)=>{
            if(!pp.alive) return;
            const th = pp.hand;

            if(pp.protected){
              lines.push(`P${i+1}：保護中`);
              return;
            }
            if(pp.dodging){
              pp.dodging=false;
              lines.push(`P${i+1}：閃避觸發（無法查看）`);
              return;
            }

            const label = cardLabel(pp.hand);
            if (i !== st.turnIndex && th != null) {
              scorePeek(st, action.playerId, th); // ★ 偵查分
              emits.push({ to: action.playerId, type:'robin_view', casterId: st.turnIndex, targetId: i, cardId: th });
            }

            if(i===st.turnIndex){
              lines.push(`你自己：${label}`);
            }else{
              lines.push(`P${i+1}：${label}`);
            }
          });
          emits.push({ to: action.playerId, type:'peek', lines });
          endOrNext(st);
          return { state: st, emits };
        } else {
          st.pending = { action:'robin' };
          return { state: st, emits };
        }
      }
      case 3: { // 香吉士
        st.pending = { action:'sanji', extra:{ keep: keepId, boost: venueActive } };
        return { state: st, emits };
      }
      case 4: { // 喬巴
        if(venueActive){
          me.dodging=true;
          pushLog(st, '喬巴（強化）：獲得閃避', emits);
        } else {
          me.protected=true;
          pushLog(st, '喬巴：獲得保護', emits);
        }
        endOrNext(st);
        return { state: st, emits };
      }
      case 5: { // 索隆
        st.pending = { action:'zoro' };
        return { state: st, emits };
      }
      case 6: { // 羅
        st.pending = { action:'law', extra:{ keep: keepId, boost: venueActive } };
        return { state: st, emits };
      }
      case 7: { // 娜美
        if(venueActive){
          st.pending = { action:'nami' };
          return { state: st, emits };
        }
        endOrNext(st);
        return { state: st, emits };
      }
      case 8: { // 魯夫
        if (venueActive) {
          st.pending = { action: 'luffy-boost', extra: { keep: keepId } };
          emits.push({ to: action.playerId, type: 'luffy_boost_prompt' });
          return { state: st, emits };
        } else {
          st.pending = { action:'luffy', extra:{ keep: keepId, firstDone:false } };
          return { state: st, emits };
        }
      }
      case 9: { // 女帝
        if(venueActive){
          me.protected=true;
          pushLog(st, '女帝（九蛇島）：獲得保護', emits);
        } else {
          doEliminate(st, st.turnIndex, '女帝自我了斷', st.turnIndex, emits);
        }
        endOrNext(st);
        return { state: st, emits };
      }
      case 10: { // 凱多
        const hasBigMom = (me.hand===14 || keepId===14);
        if(venueActive){
          if(hasBigMom){
            // ★ 群體攻擊分：尾數加權總和 *2（無視防禦/閃避）再 * 同時數量
            const victims = [];
            for(let i=0;i<st.players.length;i++){
              if(i!==st.turnIndex && st.players[i].alive){
                victims.push(i);
              }
            }
            if (victims.length){
              let sumTail = 0;
              victims.forEach(i => { sumTail += (tail(st.players[i].hand)||0); });
              const total = (sumTail * 2) * victims.length;
              addStat(st, st.turnIndex, 'atkScore', total);
            }
            victims.forEach(i=>{
              doEliminate(st,i,'霸海：清場', st.turnIndex, emits);
            });
            endOrNext(st);
            return { state: st, emits };
          } else {
            pushLog(st, '凱多（鬼島）：未與大媽同握，本回合無效果', emits);
            endOrNext(st);
            return { state: st, emits };
          }
        } else {
          st.pending = { action:'kaido', extra:{ keep: keepId } };
          return { state: st, emits };
        }
      }
      case 11: { // 基德
        if(venueActive){
          const allAlive = st.players.map((_,i)=>i).filter(i=>st.players[i].alive);
          const passIdxs = allAlive.filter(i => !st.players[i].protected && !st.players[i].dodging);
          const dodgedIdxs = allAlive.filter(i => st.players[i].dodging);
          dodgedIdxs.forEach(i => { st.players[i].dodging = false; });

          if (passIdxs.length >= 2) {
            const hands = passIdxs.map(i => st.players[i].hand);
            for (let k = 0; k < passIdxs.length; k++) {
              const to = passIdxs[(k + passIdxs.length - 1) % passIdxs.length];
              st.players[to].hand = hands[k];
            }
          }

          const skipped = allAlive.length - passIdxs.length;
          const dodgeUsed = dodgedIdxs.length;
          pushLog(st, `基德（強化）：已逆時針傳遞（略過 ${skipped} 人：保護/閃避，消耗閃避 ${dodgeUsed}）`, emits);

          endOrNext(st);
          return { state: st, emits };
        } else {
          if(st.discard.length===0){
            pushLog(st, '基德：棄牌堆為空，技能失效', emits);
            endOrNext(st);
            return { state: st, emits };
          }
          const pool = st.discard
            .map((x,idx)=>({ id: (typeof x==='number'? x : x?.id), idx }))
            .filter(x=>x.id!==11); // 相容 teach 物件
          if(pool.length===0){
            pushLog(st, '基德：棄牌堆只有基德，技能失效', emits);
            endOrNext(st);
            return { state: st, emits };
          }
          const pick = pool[Math.floor(Math.random()*pool.length)];
          me.tempDraw = pick.id;
          st.discard.splice(pick.idx,1);
          pushLog(st, '基德：棄牌堆洗牌抽 1（排除基德），請再打一次', emits);
          st.turnStep='choose';
          return { state: st, emits };
        }
      }
      case 12: { // 奎因
        if(venueActive){
          st.iceWindowOn = true;
          st.iceWindowOwner = st.turnIndex;
          pushLog(st, '奎因（強化）：冰鬼啟動—直到回到你前，其他玩家在自己回合打出奇數將被標記', emits);
          endOrNext(st);
          return { state: st, emits };
        } else {
          st.pending = { action:'queen', target: nextAliveIdx(st.turnIndex, st.players), start: st.turnIndex };
          return { state: st, emits };
        }
      }
      case 13: { // 基拉
        st.pending = { action:'killer', extra:{ keep: keepId, boost: venueActive } };
        return { state: st, emits };
      }
      case 14: { // 大媽
        if(venueActive){
          st.pending = { action:'bigmom', target:null, extra:{ boost:true } };
          return { state: st, emits };
        } else {
          st.pending = { action:'bigmom-coin' };
          return { state: st, emits };
        }
      }
      case 15: { // 卡塔庫栗
        if(venueActive){
          const aliveCount = st.players.filter(p=>p.alive).length;
          const n = Math.max(1, Math.ceil(aliveCount/2));
          const topTopFirst = st.deck.slice(-n).reverse();
          st.pending = { action:'kata-order', n, cards: topTopFirst };
          return { state: st, emits };
        } else {
          const top3 = st.deck.slice(-3).reverse();
          const lines = top3.map(x=>cardLabel(x));
          top3.forEach(c=> scorePeek(st, action.playerId, c)); // ★ 偵查分
          emits.push({ to: action.playerId, type:'peek', lines: [ '你查看頂 3（由上到下）：', ...lines ] });
          emits.push({ to: action.playerId, type:'kata_peek', cards: top3 });
          endOrNext(st);
          return { state: st, emits };
        }
      }case 16: { // 青雉
  if (venueActive) {
    let affected = 0, skippedProtect = 0, dodged = 0;

    st.players.forEach((p, i) => {
      if (!p.alive || i === st.turnIndex) return;

      if (p.protected) { // 保護免疫
        skippedProtect++;
        return;
      }
      if (p.dodging) {   // 閃避抵消並消耗閃避
        p.dodging = false;
        dodged++;
        return;
      }

      p.frozen = true;   // 其餘玩家被凍結
      affected++;
    });

    pushLog(st, `青雉（強化）：全場凍結（不含自己；保護免疫×${skippedProtect}；閃避抵消×${dodged}；凍結×${affected}）`, emits);
    endOrNext(st);
    return { state: st, emits };
  } else {
    st.pending = { action: 'aokiji' };
    return { state: st, emits };
  }
}

      case 17: { // 黑鬍子
        if(venueActive){
          const aliveCount = st.players.filter(p=>p.alive).length;
          const n = Math.max(1, Math.ceil(aliveCount/2));
          const labels = st.deck.slice(-n).reverse();
          st.pending = { action:'teach-multipick', n, cards: labels };
          return { state: st, emits }; // 等 MULTIPICK_COMMIT
        } else {
          const top1 = st.deck.pop();
          if(top1!=null){
            // ① 改為推物件，直接在棄牌上帶覆蓋資訊（不再寫 meta.coveredByTeach）
            st.discard.push({ id: top1, coverBy: 'teach', owner: st.turnIndex });

            emits.push({ to:'all', type:'silent_discard', by: st.turnIndex, cards:[top1] });
            const line = cardLabel(top1);
            scorePeek(st, action.playerId, top1); // ★ 偵查分
            emits.push({ to: action.playerId, type:'peek', lines:[`你覆蓋頂 1（最上）：${line}`] });
            pushLog(st, '黑鬍子：已覆蓋頂 1（出牌者可見）', emits);
            emits.push({ to: action.playerId, type:'teach_cover', cards:[top1] });
          }
          checkHot(st);
          endOrNext(st);
          return { state: st, emits };
        }
      }
      case 18: { // 紅髮
  const hot = st.HOT;
  const venueActive = st.venues.some(v => v.name === '奧羅傑克森號');

  if (st.deck.length <= hot) {
    if (venueActive) {
      // ★ 只有在奧羅傑克森號場地且成功觸發時播放強化影片
      pushEnhFxIfAny(emits, st, 18);
    }

    st.shanksBonusUid = venueActive ? st.turnIndex : null;
    pushLog(st, `紅髮：牌堆 ≤ ${hot} → 直接比牌${venueActive ? '（你算完 +1）' : ''}`, emits);
    showdown(st);
    return { state: st, emits };
  }

  pushLog(st, `紅髮：目前牌堆 ${st.deck.length}，尚未 ≤ ${hot}`, emits);
  endOrNext(st);
  return { state: st, emits };
}

      case 19: { // 羅傑
        if(st.venues.some(v=>v.name==='奧羅傑克森號')){
          st.pending = { action:'roger' };
          return { state: st, emits };
        } else {
          doEliminate(st, st.turnIndex, '羅傑：為下一局起始', st.turnIndex, emits);
          st.nextRoundStart = st.turnIndex;
          endOrNext(st);
          return { state: st, emits };
        }
      }
    }
  }

  // ===== 二段互動類事件 =====
  if(type==='PICK_TARGET'){
    const p = st.pending;
    if(!p) return { state: st, emits };
    const idx = action.payload?.target;
    if(typeof idx !== 'number') return { state: st, emits };
    const meIdx = st.turnIndex;

    if(p.action==='usopp'){
      st.pending = { ...p, extra:{ ...p.extra, target: idx } };
      return { state: st, emits };
    }

    if(p.action==='robin'){
      const g = effectGuard(st, idx, {});
      if(!g.blocked){
        const th = st.players[idx].hand;
        const line = (th != null) ? `你偷看了 ${pname(st, idx)}：${cardLabel(th)}` : `你偷看了 ${pname(st, idx)}：（無牌）`;
        emits.push({ to: action.playerId, type:'peek', lines:[line] });
        if (th != null) scorePeek(st, action.playerId, th); // ★ 偵查分
        emits.push({ to: action.playerId, type:'robin_view', casterId: st.turnIndex, targetId: idx, cardId: th });
        pushLog(st, `羅賓：查看了 ${pname(st, idx)}`, emits);
      } else {
        scoreDefense(st, idx, 2); // 羅賓2看牌被擋 → 防禦+2
      }
      st.pending=null;
      endOrNext(st);
      return { state: st, emits };
    }

    if(p.action==='sanji'){
      const g = effectGuard(st, idx, {});
      if(!g.blocked){
        pushLog(st, `香吉士：向 ${pname(st, idx)} 發起比拚`, emits);
        const base=tail(p.extra.keep);
        const my = p.extra.boost ? (base===9?10:base+1) : base;
        const opp=tail(st.players[idx].hand);
        if(my>opp){
          scoreDuelAttack(st, meIdx, p.extra.keep, st.players[idx].hand, { sanjiBoost: !!p.extra.boost }); // ★
          doEliminate(st, idx, '惡魔風腳', meIdx, emits);
          pushDuelLog(emits, st, meIdx, idx);
        } else if(my<opp){
          scoreDefenseReversal(st, idx, st.players[idx].hand, p.extra.keep, { sanjiBoost: !!p.extra.boost });
          doEliminate(st, st.turnIndex, '惡魔風腳反噬', meIdx, emits);
          pushDuelLog(emits, st, meIdx, meIdx);
        } else {
          pushLog(st,'平手',emits);
        }
      } else {
        // ★ 防禦分：對手擋下攻擊
        scoreDefense(st, idx, p.extra.keep);
      }
      st.pending=null;
      endOrNext(st);
      return { state: st, emits };
    }

if(p.action==='zoro'){
  const g = effectGuard(st, idx, {});
  if(!g.blocked){
    const t = st.players[idx];
    const thrown = t.hand;
    st.discard.push(thrown);
    if (thrown != null) {
      emits.push({ to:'all', type:'silent_discard', by: idx, cards:[thrown] });
    }
    t.hand=null;

    if (thrown === 9 || thrown === 19) {
      if (st.saboSilenceOn && isHighTail(thrown)) {
        pushLog(st,'【靜默】薩波：丟出尾數≥7 → 該牌效果不發動',emits);
      } else {
        if (thrown === 19) {
          // 羅傑：若有「奧羅傑克森號」→ 免死並可發動強化（預測）
          const hasOro = st.venues.some(v=>v.name==='奧羅傑克森號');
          if (hasOro) {
            // 免死：補 1 張（不加保護）
            t.hand = st.deck.pop() ?? null;
            checkHot(st);
            pushLog(st, `索隆：丟出羅傑但有奧羅傑克森號 → ${pname(st, t.id)} 補 1 張，且可進行預測`, emits);

            // 開啟羅傑強化的預測互動（由被丟牌者來選）
            st.pending = { action:'roger', caster: idx };
            emits.push({ to: idx, type:'toast', text:'羅傑（奧羅傑克森號）：請預測本局勝者' });

            // 不 endOrNext，等預測選完
            return { state: st, emits };
          } else {
            // 無奧羅傑克森號 → 依舊淘汰，並指定下一局起始
            scoreZoroElim(st, st.turnIndex, thrown);
            doEliminate(st, idx, '索隆：丟出 19 → 淘汰', st.turnIndex, emits);
            st.nextRoundStart = idx;
            pushLog(st, `羅傑：無場地被丟出 → 下局起始為 ${pname(st, idx)}`, emits);
          }
        } else {
          // 丟 9（女帝）
          const hasKuja = st.venues.some(v=>v.name==='九蛇島');
          if (hasKuja) {
            t.protected = true;
            t.hand = st.deck.pop() ?? null;
            checkHot(st);
            pushLog(st, `索隆：丟出女帝但有九蛇島 → ${pname(st, t.id)} 獲得保護並補 1 張`, emits);
          } else {
            scoreZoroElim(st, st.turnIndex, thrown);
            doEliminate(st, idx, '索隆：丟出 9 → 淘汰', st.turnIndex, emits);
          }
        }
      }
    } else {
      // 非 9/19
      if (st.venues.some(v=>v.name==='和之國')) {
        if ((thrown % 2) === 0) {
          scoreZoroElim(st, st.turnIndex, thrown);
          doEliminate(st, idx, '阿修羅：偶數→淘汰', st.turnIndex, emits);
        } else {
          t.hand = st.deck.pop() ?? null;
          checkHot(st);
          pushLog(st, '阿修羅：奇數→抽 1', emits);
        }
      } else {
        t.hand = st.deck.pop() ?? null;
        checkHot(st);
        pushLog(st, `索隆：${pname(st, t.id)} 棄牌重抽`, emits);
      }
    }
  } else {
    scoreDefense(st, idx, 5); // 索隆5棄牌被擋 → 防禦+5
  }
  st.pending = null;
  endOrNext(st);
  return { state: st, emits };
}


    if(p.action==='law'){
      if(p.extra.boost){
        const gView = effectGuard(st, idx, {});
        if(!gView.blocked){
          const th = st.players[idx].hand;
          if (th != null) scorePeek(st, action.playerId, th); // ★ 偵查分
          emits.push({ to: action.playerId, type:'peek', lines:[`ROOM・SCAN：${pname(st, idx)} → ${cardLabel(th)}`] });
          emits.push({ to: action.playerId, type:'law_view', casterId: st.turnIndex, targetId: idx, cardId: th });
        } else {
          scoreDefense(st, idx, 6); // 羅6查看/交換被擋 → 防禦+6
          pushLog(st, `羅（強化）：對 ${pname(st, idx)} 的查看被保護/閃避抵銷`, emits);
          st.pending = null;
          endOrNext(st);
          return { state: st, emits };
        }

        if(action.payload?.swap===true){
          const gSwap = effectGuard(st, idx, {});
          if(!gSwap.blocked){
            const t = st.players[idx];
            const tmp = t.hand;
            t.hand = me.hand;
            me.hand = tmp;
            pushLog(st,'羅（強化）：完成交換',emits);
          } else {
            scoreDefense(st, idx, 6); // 羅6交換被擋 → 防禦+6
            pushLog(st, `羅（強化）：對 ${pname(st, idx)} 的交換被保護/閃避抵銷`, emits);
          }
          st.pending = null;
          endOrNext(st);
          return { state: st, emits };
        }

        return { state: st, emits };
      } else {
        const gSwap = effectGuard(st, idx, {});
        if(!gSwap.blocked){
          const t = st.players[idx];
          const tmp = t.hand;
          t.hand = me.hand;
          me.hand = tmp;
          pushLog(st,'羅：完成交換',emits);
        } else {
          scoreDefense(st, idx, 6); // 羅6交換被擋 → 防禦+6
          pushLog(st, `羅：對 ${pname(st, idx)} 的交換被保護/閃避抵銷`, emits);
        }
        st.pending=null;
        endOrNext(st);
        return { state: st, emits };
      }
    }

    if(p.action==='nami'){
      const g = effectGuard(st, idx, {});
      if(!g.blocked){
        st.players[idx].skipNext=true;
        pushLog(st, `雷霆：${pname(st, idx)} 下回合跳過`, emits);
      } else {
        scoreDefense(st, idx, 7); // 娜美7被擋 → 防禦+7
      }
      st.pending=null;
      endOrNext(st);
      return { state: st, emits };
    }

    if(p.action==='luffy'){
      const g = effectGuard(st, idx, {});
      if(!g.blocked){
        pushLog(st, `魯夫：向 ${pname(st, idx)} 發起決鬥`, emits);
        const my=tail(p.extra.keep);
        const opp=tail(st.players[idx].hand);
        if(my>opp){
          scoreDuelAttack(st, st.turnIndex, p.extra.keep, st.players[idx].hand, {}); // ★
          doEliminate(st, idx, '魯夫擊倒', meIdx, emits);
          pushDuelLog(emits, st, meIdx, idx);
        } else if(my<opp){
          scoreDefenseReversal(st, idx, st.players[idx].hand, p.extra.keep, {});
          doEliminate(st, st.turnIndex, '魯夫失敗', meIdx, emits);
          pushDuelLog(emits, st, meIdx, meIdx);
        } else {
          pushLog(st,'平手',emits);
        }
      } else {
        scoreDefense(st, idx, p.extra.keep); // ★ 被擋
      }
      if(!st.players[st.turnIndex].alive){
        st.pending=null;
        endOrNext(st);
        return { state: st, emits };
      }
      if(!p.extra.firstDone){
        p.extra.firstDone=true;
        st.pending=p;
        return { state: st, emits };
      }
      st.pending=null;
      endOrNext(st);
      return { state: st, emits };
    }

    if(p.action==='kaido'){
      const g = effectGuard(st, idx, {ignoreProtect:true, ignoreDodge:true});
      if(!g.blocked){
        pushLog(st, `凱多：對 ${pname(st, idx)} 使出雷鳴八卦（無視防禦/閃避）`, emits);
        const my=tail(st.players[st.turnIndex].hand);
        const opp=tail(st.players[idx].hand);
        if(my>opp){
          scoreDuelAttack(st, meIdx, st.players[st.turnIndex].hand, st.players[idx].hand, { ignoreDefOrDodge: true }); // ★
          doEliminate(st, idx, '雷鳴八卦', meIdx, emits);
          pushDuelLog(emits, st, meIdx, idx);
        } else if(my<opp){
          scoreDefenseReversal(st, idx, st.players[idx].hand, st.players[st.turnIndex].hand, { ignoreDefOrDodge:true });
          doEliminate(st, st.turnIndex, '被反殺', meIdx, emits);
          pushDuelLog(emits, st, meIdx, meIdx);
        } else {
          pushLog(st,'平手',emits);
        }
      }
      st.pending=null;
      endOrNext(st);
      return { state: st, emits };
    }

    if(p.action==='killer'){
      st.players[idx].protected = false;
      st.players[idx].dodging   = false;
      pushLog(st, `基拉：解除 ${pname(st, idx)} 的保護/閃避`, emits);

      if (p.extra.boost) {
        if (action.payload?.duel === true) {
          pushLog(st, `基拉：向 ${pname(st, idx)} 發起決鬥`, emits);
          const my  = tail(p.extra.keep);
          const opp = tail(st.players[idx].hand);

          if (my > opp) {
            scoreDuelAttack(st, meIdx, p.extra.keep, st.players[idx].hand, { ignoreDefOrDodge: true }); // ★
            doEliminate(st, idx, '基拉擊倒', meIdx, emits);
            pushDuelLog(emits, st, meIdx, idx);
          } else if (my < opp) {
            scoreDefenseReversal(st, idx, st.players[idx].hand, p.extra.keep, { ignoreDefOrDodge:true });
            doEliminate(st, st.turnIndex, '決鬥失敗', meIdx, emits);
            pushDuelLog(emits, st, meIdx, meIdx);
          } else {
            pushLog(st,'平手',emits);
          }

          st.pending = null;
          endOrNext(st);
          return { state: st, emits };
        }
        return { state: st, emits }; // 等前端選擇
      }

      st.pending = null;
      endOrNext(st);
      return { state: st, emits };
    }

    if(p.action==='aokiji'){
      const g = effectGuard(st, idx, {});
      if(!g.blocked){
        st.players[idx].frozen=true;
        pushLog(st, `青雉：${pname(st, idx)} 凍結`, emits);
      } else {
        scoreDefense(st, idx, 16); // 青雉16被擋 → 防禦+6
      }
      st.pending=null;
      endOrNext(st);
      return { state: st, emits };
    }

   if(p.action==='roger'){
     // ★ 改：若是「被索隆丟出」觸發，by 應該是 p.caster（羅傑持有者），
     // 若是自己「打出羅傑」，則沒有 caster → 退回 st.turnIndex
     const by = (p && p.caster != null) ? p.caster : st.turnIndex;
 
     st.rogerPred = { by, pick: idx };
     pushLog(st, `羅傑：已預測 ${pname(st, idx)}`, emits);
     st.pending=null;
     endOrNext(st);
     return { state: st, emits };
    }


    // 大媽強化：先選目標 → 交給目標決定要不要花金幣
    if (p && p.action === 'bigmom' && p.extra && p.extra.boost) {
      const casterId = action.playerId;
      const targ = st.players[idx];
      if (!Number.isInteger(idx) || !targ || !targ.alive || idx === casterId) {
        emits.push({ to: casterId, type:'toast', text:'目標不合法' });
        return { state: st, emits };
      }

      const g = effectGuard(st, idx, {});
      if (g.blocked) {
        scoreDefense(st, idx, 14); // 大媽14強化被擋 → 防禦+4
        pushLog(st, `大媽（萬國強化）：對 ${pname(st, idx)} 的效果被保護/閃避抵銷`, emits);
        st.pending = null;
        endOrNext(st);
        return { state: st, emits };
      }

      st.pending = { action: 'bigmom-pay', caster: casterId, target: idx };
      emits.push({ to: idx, type:'toast', text:'大媽（萬國）：選擇交出 1 金幣，或直接淘汰' });
      return { state: st, emits };
    }
  }

  if(type==='PICK_DIGIT'){
    const p = st.pending;
    if(!p) return { state: st, emits };
    const d = action.payload?.digit;
    if(typeof d !== 'number') return { state: st, emits };

    if(p.action==='usopp'){
      if(d===1){
        pushLog(st,'騙人布：不能猜 1',emits);
        st.pending=null;
        endOrNext(st);
        return { state: st, emits };
      }
      const tgt = p.extra.target;
      const g = effectGuard(st, tgt, {});
      if(!g.blocked){
        const th = st.players[tgt].hand;
        if(th!=null && tail(th)===d){
          // ★ 命中分：強化狀態下用連擊數（streak）
          const streak = Math.max(1, (p.extra.streak||1));
          scoreUsoppHit(st, st.turnIndex, th, streak);
          doEliminate(st, tgt, `被猜中尾數 ${d}`, st.turnIndex, emits);

          if(p.extra.chain){
            const any = st.players.some((pp,i)=> i!==st.turnIndex && pp.alive);
            if(!any){
              st.pending=null;
              endOrNext(st);
              return { state: st, emits };
            }
            st.pending = { action:'usopp', extra:{ chain:true, target:null, streak: streak+1 } }; // ★ 連擊+1
            return { state: st, emits };
          }
        } else {
          pushLog(st,'猜錯了',emits);
          emits.push({ to:'all', type:'usopp_miss', casterId: st.turnIndex, targetId: tgt, digit: d });
        }
      }
      else {
        scoreDefense(st, tgt, 1); // 騙人布1被擋 → 防禦+1
      }
      st.pending=null;
      endOrNext(st);
      return { state: st, emits };
    }
  }

  if(type==='LUFFY_SECOND'){
    const p = st.pending;
    if(!p || p.action!=='luffy') return { state: st, emits };

    const idx = action.payload?.target;
    if(typeof idx !== 'number'){
      st.pending=null;
      endOrNext(st);
      return { state: st, emits };
    }
    if(idx===-1){
      st.pending=null;
      endOrNext(st);
      return { state: st, emits };
    }

    const g = effectGuard(st, idx, {});
    if(!g.blocked){
      pushLog(st, `魯夫：向 ${pname(st, idx)} 發起第二次決鬥`, emits);
      const my=tail(p.extra.keep);
      const opp=tail(st.players[idx].hand);
      if(my>opp){
        scoreDuelAttack(st, st.turnIndex, p.extra.keep, st.players[idx].hand, {}); // ★
        doEliminate(st, idx, '魯夫擊倒', st.turnIndex, emits);
        pushDuelLog(emits, st, st.turnIndex, idx);
      } else if(my<opp){
        scoreDefenseReversal(st, idx, st.players[idx].hand, p.extra.keep, {});
        doEliminate(st, st.turnIndex, '魯夫失敗', st.turnIndex, emits);
        pushDuelLog(emits, st, st.turnIndex, st.turnIndex);
      } else {
        pushLog(st,'平手',emits);
      }
    } else {
      scoreDefense(st, idx, p.extra.keep); // ★ 被擋
    }
    st.pending=null;
    endOrNext(st);
    return { state: st, emits };
  }

  // ===== 奎因擲幣 =====
  if (type === 'QUEEN_COIN') {
    const p = st.pending;
    if (!p || p.action !== 'queen') return { state: st, emits };

    const tgt = p.target;
    if (action.playerId !== tgt) {
      emits.push({ to: action.playerId, type: 'toast', text: '不是你要擲硬幣' });
      return { state: st, emits };
    }

    const g = effectGuard(st, tgt, {});
    if (g.blocked) {
      scoreDefense(st, tgt, 12); // 奎因12被擋 → 防禦+2
      if (st.players[tgt].dodging) st.players[tgt].dodging = false;
      pushLog(st, `奎因：${pname(st, tgt)} 有保護/閃避 → 不擲、不傳遞；效果結束`, emits);
      st.pending = null;
      endOrNext(st);
      return { state: st, emits };
    }

    emits.push({ to: action.playerId, type: 'coin_fx' });
    const face = (Math.random() < 0.5) ? 'H' : 'T';
    pushLog(st, `奎因：${pname(st, tgt)} 擲到 ${face === 'H' ? '正面' : '反面'}`, emits);

    if (face === 'H') {
      st.pending = null;
      endOrNext(st);
      return { state: st, emits };
    }

    st.players[tgt].skipNext = true;
    pushLog(st, `奎因：${pname(st, tgt)} 本回合將跳過（不能抽牌）`, emits);

    const next = nextAliveIdx(tgt, st.players);
    if (next === p.start) {
      st.pending = null;
      endOrNext(st);
      return { state: st, emits };
    }

    st.pending = { action: 'queen', start: p.start, target: next };
    emits.push({ to: next, type: 'toast', text: '奎因：請擲硬幣判定' });
    return { state: st, emits };
  }

  // ===== 大媽擲幣 =====
  if(type==='BIGMOM_COIN'){
    const p = st.pending;
    if(!p || p.action!=='bigmom-coin') return { state: st, emits };

    if (action.playerId !== st.turnIndex) {
      emits.push({ to: action.playerId, type:'toast', text:'不是你要擲硬幣' });
      return { state: st, emits };
    }

    const g = effectGuard(st, st.turnIndex, {});
    if (g.blocked) {
      scoreDefense(st, st.turnIndex, 14); // 大媽14擲幣被擋 → 防禦+4
      if (st.players[st.turnIndex].dodging){ st.players[st.turnIndex].dodging = false; }
      pushLog(st, `大媽：已被保護/閃避覆蓋 → 不擲硬幣，效果結束`, emits);
      st.pending=null;
      endOrNext(st);
      return { state: st, emits };
    }

    emits.push({ to: action.playerId, type:'coin_fx' });
    const face = (Math.random() < 0.5) ? 'H' : 'T';
    if(face==='H'){
      me.protected=true;
      pushLog(st,'大媽：擲到正面 → 獲得保護',emits);
    } else {
      me.dodging=true;
      pushLog(st,'大媽：擲到反面 → 獲得閃避',emits);
    }

    st.pending=null;
    endOrNext(st);
    return { state: st, emits };
  }

  // ===== 大媽強化：被點名者的最終選擇 =====
  if (type === 'BIGMOM_CHOICE') {
    const p = st.pending;
    if (!p || p.action !== 'bigmom-pay') return { state: st, emits };

    const casterId = p.caster;
    const targetId = p.target;

    if (action.playerId !== targetId) {
      emits.push({ to: action.playerId, type:'toast', text:'不是你的選擇' });
      return { state: st, emits };
    }

    const caster = st.players[casterId];
    const targ   = st.players[targetId];

    let choice = action.payload?.choice === 'pay' ? 'pay' : 'die';
    const tgGold = targ.gold || 0;
    if (choice === 'pay' && tgGold <= 0) choice = 'die';

    if (choice === 'pay') {
      targ.gold = Math.max(0, tgGold - 1);
      caster.gold = (caster.gold || 0) + 1;
      pushLog(st, `大媽：${pname(st, targetId)} 支付 1 金幣給 ${pname(st, casterId)}`, emits);
    } else {
      doEliminate(st, targetId, '大媽：拒繳金幣', casterId, emits);
    }

    st.pending = null;
    endOrNext(st);
    return { state: st, emits };
  }

  if(type==='ORDER_COMMIT'){
    const p = st.pending;
    if(!p || p.action!=='kata-order') return { state: st, emits };

    const order = action.payload?.order;
    if(!Array.isArray(order)) return { state: st, emits };

    const n = p.n;
    const finalSeg = order.slice(0, n).reverse();
    st.deck.splice(st.deck.length - n, n, ...finalSeg);
    pushLog(st,'卡塔庫栗：已依你指定順序（上=最上）放回頂部',emits);

    emits.push({ to: action.playerId, type:'kata_order_done', order });

    st.pending=null;
    endOrNext(st);
    return { state: st, emits };
  }

  if(type==='MULTIPICK_COMMIT'){
    const p = st.pending;
    if(!p || p.action!=='teach-multipick') return { state: st, emits };

    const pickedIndices = action.payload?.pickedIndices;
    if(!Array.isArray(pickedIndices)) return { state: st, emits };

    const n = p.n;
    const topNow = st.deck.splice(st.deck.length - n, n); // 自底到頂
    const pickedOrig = new Set(pickedIndices.map(j => (n - 1 - j))); // UI上→內部

    const toDiscard = [];
    const toBack = [];
    topNow.forEach((id,i)=>{
      (pickedOrig.has(i)?toDiscard:toBack).push(id);
    });

    // ② 改為直接把覆蓋資訊寫入棄牌堆物件（不再寫 meta.coveredByTeach）
    const casterId = st.turnIndex;
    st.discard.push(...toDiscard.map(id => ({ id, coverBy: 'teach', owner: casterId })));

    if (toDiscard.length){
      emits.push({ to:'all', type:'silent_discard', by: casterId, cards: toDiscard }); // 靜默
      emits.push({ to: casterId, type:'teach_cover', cards: toDiscard });               // 私訊
    }

    st.deck.push(...toBack);
    pushLog(st, `黑鬍子強化：覆蓋 ${toDiscard.length} 張（出牌者可見）`, emits);

    st.pending=null;
    endOrNext(st);
    return { state: st, emits };
  }

  if (type === 'PICK_CANCEL') {
    const p = st.pending;
    if (p && p.action === 'law' && p.extra?.boost) {
      st.pending = null;
      endOrNext(st);
      return { state: st, emits };
    }
    if (p && p.action === 'killer' && p.extra?.boost) {
      st.pending = null;
      endOrNext(st);
      return { state: st, emits };
    }
  }

  return { state: st, emits };
}

// ---------------------------------------------------------------
module.exports = {
  CARDS, COUNTS,
  createInitialState,
  applyAction,
  getVisibleState,
  isRoundEnded,
  nextRound,
  _util: { tail, isHighTail, cardById, buildDeck, buildVenues, shuffle }
};
