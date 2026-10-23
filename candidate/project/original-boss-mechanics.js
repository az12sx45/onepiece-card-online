'use strict';
// Original display-only helpers. Gameplay stays in original-core.
const PLACEHOLDER_BATTLE_PORTRAIT = "images/board/battle/portraits/placeholder/normal.webp";
const JUDGE_CLONE_GUARD_ASSET = "images/board/battle/postgame_mechanic_effects/judge_clone_guard/judge_clone_guard.webp";
function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
function postgameMechanicBadge(mechanic) {
    const state = mechanic?.state || {};
    switch (mechanic?.key) {
      case "postgame_shiki": return state.finalDuel ? "決" : `${(state.islands || []).filter((island) => island.destroyed).length}/3`;
      case "postgame_gild_tesoro": return String(Math.max(0, ...(state.crew || []).map((card) => Number(card.gold || 0))));
      case "postgame_zephyr": return state.detonated ? "爆" : state.dynaRockDisarmed ? "解" : String(state.countdown ?? 0);
      case "postgame_tot_musica": return String(state.movement ?? 1);
      case "postgame_douglas_bullet": return String((state.slots || []).filter((slot) => slot.itemId && !slot.destroyed).length);
      case "postgame_saga": return String(state.blood ?? 0);
      case "postgame_vinsmoke_judge": return String(state.clones ?? 0);
      case "postgame_rob_lucci_awakened": return String((state.powers || []).filter((power) => power.active).length);
      case "postgame_king": return state.flameOn ? "燃" : "熄";
      case "postgame_charlotte_katakuri": return state.forecastRolling ? "…" : String(state.forecastDie || state.defenseDie || 0);
      case "postgame_patrick_redfield": return `${state.lastDrainPercent || 0}%`;
      case "postgame_oars": return String(state.saltBags ?? 0);
      case "postgame_aramaki": return String(state.groves ?? 0);
      default: return "";
    }
  }
function postgamePips(value, max, options = {}) {
    const active = Math.max(0, Math.min(Number(max || 0), Number(value || 0)));
    return `<span class="postgame-mechanic-pips">${Array.from({ length: Math.max(0, Number(max || 0)) }, (_, index) => `<i class="postgame-mechanic-pip ${index < active ? "active" : ""} ${options.danger && index < active ? "danger" : ""}">${escapeHtml(options.labels?.[index] || index + 1)}</i>`).join("")}</span>`;
  }
function postgameBulletSlotsHtml(state = {}) {
    const partLabels = {
      "頭": "頭部裝甲",
      "胸": "胸部裝甲",
      "左手": "左手裝甲",
      "右手": "右手裝甲",
      "左腳": "左腳裝甲",
      "右腳": "右腳裝甲",
    };
    return `<span class="postgame-mechanic-slots">${(state.slots || []).slice(0, 6).map((slot) => {
      const hasItem = !!slot.itemId;
      const destroyed = !!slot.destroyed;
      const itemName = hasItem ? slot.itemName || "未命名攜帶物" : "未裝備";
      const summary = hasItem ? slot.itemSummary || "沒有登錄效果。" : "此孔位沒有攜帶物效果。";
      const status = destroyed
        ? `已破壞・效果已歸還${slot.runtimeStatus ? `・${slot.runtimeStatus}` : ""}`
        : hasItem ? (slot.runtimeStatus ? `接管中・${slot.runtimeStatus}` : "接管中") : "空孔位";
      const part = partLabels[slot.label] || `${slot.label || "未知部位"}${String(slot.label || "").endsWith("裝甲") ? "" : "裝甲"}`;
      return `<button type="button" class="postgame-mechanic-slot ${destroyed ? "is-broken" : hasItem ? "is-active" : "is-empty"}" data-bullet-slot data-item-name="${escapeHtml(itemName)}" data-item-summary="${escapeHtml(summary)}" data-item-status="${escapeHtml(status)}" title="${escapeHtml(`骰 ${slot.number}・${part}：${itemName}｜${status}｜${summary}`)}">
        <span class="bullet-slot-head">
          <b class="bullet-slot-die">骰 ${escapeHtml(slot.number || "?")}</b>
          <em class="bullet-slot-part">${escapeHtml(part)}</em>
          <i class="bullet-slot-status">${escapeHtml(status)}</i>
        </span>
        <span class="bullet-slot-body">
          <span class="bullet-slot-image">${slot.itemImage ? `<img src="${escapeHtml(slot.itemImage)}" alt="${escapeHtml(itemName)}">` : "∅"}</span>
          <span class="bullet-slot-copy">
            <strong>${escapeHtml(itemName)}</strong>
            <small>${escapeHtml(summary)}</small>
          </span>
        </span>
      </button>`;
    }).join("")}</span>`;
  }
function postgameBulletMiniSocketsHtml(mechanic) {
    if (mechanic?.key !== "postgame_douglas_bullet") return "";
    return `<span class="boss-mechanic-mini-sockets">${(mechanic.state?.slots || []).slice(0, 6).map((slot) => `
      <span class="boss-mechanic-mini-socket ${slot.destroyed ? "is-broken" : !slot.itemId ? "is-empty" : "is-active"}" title="${escapeHtml(`骰 ${slot.number}・${slot.label}：${slot.itemName || "未裝備"}${slot.destroyed ? "（已破壞）" : slot.itemId ? "（接管中）" : "（空孔位）"}`)}">
        ${slot.itemImage ? `<img src="${escapeHtml(slot.itemImage)}" alt="">` : ""}
        <small aria-hidden="true">${escapeHtml(slot.number || "")}</small>
        ${slot.destroyed ? `<b aria-hidden="true">×</b>` : ""}
      </span>
    `).join("")}</span>`;
  }
function postgameMechanicStateHtml(mechanic) {
    const state = mechanic?.state || {};
    switch (mechanic?.key) {
      case "postgame_shiki":
        return state.finalDuel
          ? `<strong>金獅子決戰</strong><span>三島全毀・島嶼減傷解除</span><span>史基雙攻與速度提升，閃避下降</span>`
          : `<span class="shiki-island-list">${(state.islands || []).map((island) => {
            const hpRate = Math.max(0, Math.min(100, Math.round(Number(island.currentHp || 0) / Math.max(1, Number(island.maxHp || 1)) * 100)));
            const image = island.destroyed ? island.brokenImage : island.image;
            return `<span class="shiki-island-card ${island.active ? "is-active" : ""} ${island.destroyed ? "is-destroyed" : ""}" title="${escapeHtml(island.effect || "")}">
              <img src="${escapeHtml(image || "")}" alt="${escapeHtml(island.name || "漂浮島")}">
              <strong>${escapeHtml(island.name || "漂浮島")}${island.active ? "・護航中" : island.destroyed ? "・已墜落" : ""}</strong>
              <span class="shiki-island-mini-hp"><i style="--shiki-mini-hp:${hpRate}%"></i></span>
              <small>${escapeHtml(island.destroyed ? "效果解除" : island.effect || "")}</small>
            </span>`;
          }).join("")}</span>${state.exposedActions ? `<strong>破綻：下次直攻史基 +50%</strong>` : ""}`;
      case "postgame_gild_tesoro": {
        const crewState = `<span class="tesoro-control-crew">${(state.crew || []).map((card) => {
          const gold = Math.max(0, Math.min(3, Number(card.gold || 0)));
          return `<span class="tesoro-control-card ${card.active ? "is-active" : ""}" title="${escapeHtml(`${card.name}・金流淹沒 ${gold}/3`)}"><span class="postgame-mechanic-mini-crew"><img src="${escapeHtml(card.portrait || PLACEHOLDER_BATTLE_PORTRAIT)}" alt="${escapeHtml(card.name)}"><b>${gold}/3</b></span><span class="tesoro-control-copy"><strong>${escapeHtml(card.name)}</strong>${postgamePips(gold, 3, { danger: gold >= 3 })}</span></span>`;
        }).join("")}</span>`;
        const phaseCopy = Number(state.phase || 1) === 2
          ? `<strong>第二階段・Golden Tesoro</strong><span>金流仍按每名船員各自累積；巨體防禦使受到的傷害只保留 ${Math.max(0, Number(state.goldenDamageRetainedPercent || 40))}%。</span>`
          : `<strong>第一階段・金流河</strong>`;
        return `${phaseCopy}${crewState}<span>存活時每次被泰佐洛命中增加一段；三段全滿改用一般純文字替補清單，退到後排後清空。致死命中改走一般倒下流程。</span>`;
      }
      case "postgame_zephyr":
        return `<span class="zephyr-end-point-operation">
          <span class="zephyr-end-point-card is-destroyed"><img src="${escapeHtml(state.dynaStoneImage || "")}" alt=""><strong>終結點Ⅰ</strong><small>已爆破</small></span>
          <span class="zephyr-end-point-card is-destroyed"><img src="${escapeHtml(state.dynaStoneImage || "")}" alt=""><strong>終結點Ⅱ</strong><small>已爆破</small></span>
          <span class="zephyr-end-point-card ${state.detonated ? "is-destroyed" : state.dynaRockDisarmed ? "is-safe" : "is-active"}"><img src="${escapeHtml(state.dynaStoneImage || "")}" alt=""><strong>終結點Ⅲ</strong><small>${escapeHtml(state.detonated ? "連鎖崩壞" : state.dynaRockDisarmed ? "炸藥岩已解除" : `倒數 ${state.countdown}/${state.countdownTotal}`)}</small></span>
        </span>
        <span class="zephyr-end-point-progress"><strong>${state.detonated ? "爆破計畫完成" : state.dynaRockDisarmed ? "最後終結點保住了" : `解除進度 ${state.disarmProgress}/${state.disarmTarget}`}</strong>${postgamePips(state.disarmProgress, state.disarmTarget, { danger: !state.dynaRockDisarmed })}<span>${state.lastDisarmRoll ? `上次骰 ${state.lastDisarmRoll}・推進 ${state.lastDisarmGain}` : "點擊澤法左側的炸藥岩，放棄本次攻擊並進行解除"}</span></span>
        <span>${state.phase === 2 ? `黑腕決戰・教官會看破同一角色連續重複的招式${state.dynaRockDisarmed ? "" : "；炸藥岩倒數仍繼續"}` : "Battle Smasher 階段・半血後轉為黑腕決戰"}</span>`;
      case "postgame_tot_musica":
        return `<strong>第 ${state.movement || 1} 樂章</strong><span>${state.assigned ? `現實 ${state.realIndices?.length || 0} 人／歌世界 ${state.songIndices?.length || 0} 人` : "等待雙世界分隊"}</span><span>${state.lastRealFirstDie && state.lastSongFirstDie ? `第一骰 ${state.lastRealFirstDie}（${state.lastRealFirstDie % 2 ? "單" : "雙"}）／${state.lastSongFirstDie}（${state.lastSongFirstDie % 2 ? "單" : "雙"}）` : state.lastSync === "pending" ? "同奇偶完整同步；不同奇偶保留 5%" : "等待下一次奇偶判定"}</span><span>${state.lastSync === "success" ? "奇偶同步成功" : state.lastSync === "parity_mismatch" ? "奇偶不同・分流直擊 5%" : state.lastSync === "no_attack_roll" ? "至少一邊沒有直接攻擊骰" : "同屬性 +50%／同點 +50%／同攻擊類別 +20%"}</span>`;
      case "postgame_douglas_bullet":
        return postgameBulletSlotsHtml(state);
      case "postgame_saga":
        return `<strong>血祭 ${state.blood || 0}/75</strong>${postgamePips(state.blood >= 75 ? 3 : state.blood >= 50 ? 2 : state.blood >= 25 ? 1 : 0, 3, { labels: ["25", "50", "75"], danger: true })}<span>${state.fused ? "七星劍完全融合" : "流血也會供養七星劍"}</span>`;
      case "postgame_vinsmoke_judge":
        return `<strong>複製兵 ${state.clones || 0}/3</strong>${postgamePips(state.clones, 3)}<span>生產 ${state.production || 0}/${state.productionMax || 3}</span>`;
      case "postgame_rob_lucci_awakened":
        return `<span class="postgame-mechanic-pips">${(state.powers || []).map((power) => `<i class="postgame-mechanic-pip lucci ${power.used ? "active" : ""} ${power.current ? "current" : ""} ${state.rokuoganPending ? "danger" : ""}" title="${escapeHtml(`${power.name}・${power.statLabel || "能力"}提高 80%${power.current ? "（本次行動生效）" : power.used ? "（已使用）" : "（尚未使用）"}`)}">${escapeHtml(power.name)}</i>`).join("")}</span><strong>${state.rokuoganPending ? "必中六王銃待發" : state.activePower ? `本次：${escapeHtml(state.activePower)}・${escapeHtml(state.activePowerEffect)}` : "等待抽取六式"}</strong><span>${state.rokuoganPending ? "六王銃後重新洗入六式" : `已用 ${state.usedCount || 0}/6・剩餘 ${state.remainingCount ?? 6} 式`}</span>`;
      case "postgame_king":
        return `<strong>${state.flameOn ? "背火點燃" : "背火熄滅"}</strong>${postgamePips(state.flameOn ? 1 : 0, 1, { danger: state.flameOn })}<span>${state.vulnerable ? "現在是輸出窗口" : "火焰覆體・傷害大幅削弱"}</span>`;
      case "postgame_charlotte_katakuri":
        return `<strong>${state.forecastRolling ? "預知骰擲骰中" : state.forecastDie ? `預知骰 ${state.forecastDie}` : "預知未來"}</strong>${state.forecastDie ? postgamePips(state.forecastDie, 6, { danger: state.forecastDie >= 5 }) : ""}<span>${state.defenseRolling ? "正在擲防禦骰" : state.choicePending ? "選擇正面出招或防禦" : state.choiceMode === "defend" ? `防禦骰 ${state.defenseDie}・減傷 ${state.defenseReductionPercent}%` : state.choiceMode === "move" ? `一般行動可用・出招第一骰需達 ${state.forecastDie}` : "每次行動前重新預知"}</span>${state.lastPlayerFirstDie ? `<span>${state.lastOutcome === "predicted" ? "招式被預見失效" : state.lastOutcome === "breakthrough" ? "第一骰突破未來視" : ""}・第一骰 ${state.lastPlayerFirstDie}</span>` : ""}`;
      case "postgame_patrick_redfield":
        return `<span class="postgame-mechanic-crew">${(state.crew || []).map((card) => `<span class="postgame-mechanic-mini-crew" title="${escapeHtml(`${card.name} HP ${card.currentHp}/${card.maxHp}`)}"><img src="${escapeHtml(card.portrait || PLACEHOLDER_BATTLE_PORTRAIT)}" alt="${escapeHtml(card.name)}"></span>`).join("")}</span><span>上次吸收 ${state.lastDrainPercent || 0}%／${state.lastDrainTotal || 0} HP</span>`;
      case "postgame_oars": {
        const result = state.lastResult;
        const lockedStake = (state.lockedPredictions || []).reduce((sum, bet) => sum + Math.max(0, Number(bet.stake ?? 1)), 0);
        const resultText = result?.voided
          ? `上次下注取消，已退回 ${result.refunded || result.stake || 0} 包`
          : result
            ? `上次 ${result.wonCount || 0} 項命中、${result.lostCount || 0} 項落空，回收 ${result.gained || 0} 包`
            : state.lockedPredictions?.length
              ? `已押 ${lockedStake} 包／${state.lockedPredictions.length} 項：${state.lockedPredictions.map((bet) => `${bet.label} ${Math.max(0, Number(bet.stake ?? 1))} 包`).join("、")}`
              : `等待下注・再 ${state.nextPeriodicSaltIn || 3} 回合補 1 包`;
        return `<strong>鹽袋 ${state.saltBags || 0}/${state.saltTarget || 15}</strong>${postgamePips(state.saltBags, state.saltTarget || 15)}<span>${escapeHtml(resultText)}</span>`;
      }
      case "postgame_aramaki":
        return `<strong>森林 ${state.groves || 0}/4</strong>${postgamePips(state.groves, 4)}<span>${state.revived ? "種子再生已使用" : state.fireproof ? "防火林保護中" : "火焰可多清一片"}</span>`;
      default:
        return "";
    }
  }
function judgeCloneFormation(count) {
    if (count >= 3) return [
      { x: 30, scale: 0.72, z: 1, delay: -220 },
      { x: 50, scale: 0.82, z: 3, delay: -510 },
      { x: 70, scale: 0.72, z: 2, delay: -830 },
    ];
    if (count === 2) return [
      { x: 32, scale: 0.78, z: 2, delay: -280 },
      { x: 68, scale: 0.78, z: 3, delay: -670 },
    ];
    if (count === 1) return [{ x: 50, scale: 1.02, z: 3, delay: -430 }];
    return [];
  }
function judgeCloneSpriteHtml(slot, className = "") {
    return `<img class="judge-clone-guard${className ? ` ${className}` : ""}" src="${JUDGE_CLONE_GUARD_ASSET}" alt="" aria-hidden="true" draggable="false" style="--judge-clone-x:${slot.x}%;--judge-clone-scale:${slot.scale};--judge-clone-z:${slot.z};--judge-clone-delay:${slot.delay}ms">`;
  }
exports.badge=postgameMechanicBadge;exports.html=postgameMechanicStateHtml;exports.miniSockets=postgameBulletMiniSocketsHtml;exports.formation=judgeCloneFormation;exports.cloneHtml=judgeCloneSpriteHtml;exports.cloneAsset=JUDGE_CLONE_GUARD_ASSET;
