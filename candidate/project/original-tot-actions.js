'use strict';
// Original two-world command rules. Native adapter owns drawing, timers and confirmation.
exports.create=function({refs,callBattleAction,showStatus,confirm,syncStage,setTimeout,clearTimeout}){
let latestView=null;
const window={confirm};
const syncTotMusicaPersistentStage=view=>syncStage(view);
function renderPanel(view){if(!totMusicaDualAwaitingEvent&&!totMusicaDualAnimationActive)renderTotMusicaDualAction(view,view.battle.postgameBossMechanic);}
const PLACEHOLDER_BATTLE_PORTRAIT = "images/board/battle/portraits/placeholder/normal.webp";
let currentMode = null;
let selectedBattleItemId = "";
let totMusicaSelectionSignature = "";
let totMusicaSelections = { real: null, song: null };
let totMusicaSelectionWorld = "real";
let totMusicaWorldModes = { real: null, song: null };
let totMusicaWorldItemIds = { real: "", song: "" };
let totMusicaDualAwaitingEvent = false;
let totMusicaDualAnimationActive = false;
let totMusicaDualAwaitTimer = null;
function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
function postgameCrewPortrait(card = {}) {
    const portraits = card.battlePortraits || {};
    return portraits.normal || portraits.idle || portraits.morale || portraits.attack || card.portrait || PLACEHOLDER_BATTLE_PORTRAIT;
  }
function moveTypeLabel(type) {
    return {
      attack: "攻擊",
      buff: "強化",
      debuff: "弱化",
      heal: "治療",
      shield: "護盾",
      control: "控制",
      special: "特殊",
    }[type] || type || "技能";
  }
function effectTextLines(effectText = "") {
    return String(effectText || "無追加效果")
      .split(/\s*\/\s*|\s*；\s*/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
function moveEffectSummary(effectText = "") {
    const lines = effectTextLines(effectText);
    const useful = lines.filter((line) => !/^基礎攻擊/.test(line) && line !== "無追加效果");
    const raidSuitStealth = useful.find((line) => /光學迷彩/.test(line));
    if (raidSuitStealth) {
      return [raidSuitStealth, ...useful.filter((line) => line !== raidSuitStealth).slice(0, 1)].join(" / ");
    }
    if (useful.length) return useful.slice(0, 2).join(" / ");
    return lines[0] || "無追加效果";
  }
function moveDetailLines(move) {
    const typeLabel = move.damageClass === "special"
      ? "特攻"
      : move.damageClass === "physical"
        ? "物攻"
        : moveTypeLabel(move.type || move.category);
    const ppText = `PP ${move.currentPP}/${move.pp}`;
    const priorityText = move.priority ? `先制 ${Number(move.priority) > 0 ? "+" : ""}${move.priority}` : "";
    const rawDamageText = String(move.damageText || "").trim();
    const hasDamageText = rawDamageText && rawDamageText !== "效果技";
    const effectSummary = moveEffectSummary(move.effectText);
    const primaryDetail = hasDamageText
      ? rawDamageText
      : move.power
        ? `威力 ${move.power}`
        : `效果：${effectSummary}`;
    const accuracyText = Number(move.accuracy ?? 100) !== 100 ? `命中 ${move.accuracy}%` : "";
    const effectLine = hasDamageText && effectSummary && effectSummary !== "無追加效果" && !/^基礎攻擊/.test(effectSummary)
      ? effectSummary
      : "";
    const firstLine = [typeLabel, ppText, priorityText].filter(Boolean).join(" ・ ");
    const secondLine = [primaryDetail, accuracyText].filter(Boolean).join(" ・ ");
    const compactLine = [primaryDetail, ppText, effectLine, accuracyText, priorityText].filter(Boolean).join(" ・ ");
    return { typeLabel, ppText, priorityText, primaryDetail, accuracyText, firstLine, secondLine, compactLine, effectLine, fullEffectText: effectTextLines(move.effectText).join(" / ") };
  }
function battleItemRequiresCrewTarget(item = {}, view = latestView) {
    if (item.targetMode === "battle_side") return true;
    if (["living_ally", "downed_ally"].includes(item.targetMode || "")) return true;
    return item.targetMode === "party" && Array.isArray(view?.battle?.coopItemTargets) && view.battle.coopItemTargets.length > 1;
  }
function cardMissingHp(card = {}) {
    return Number(card.currentHp || 0) > 0 && Number(card.currentHp || 0) < Math.max(1, Number(card.maxHp || 1));
  }
function cardMissingPp(card = {}) {
    return (card.moves || []).some((move) => Number(move.pp || 0) > 0 && Number(move.currentPP ?? move.pp ?? 0) < Number(move.pp || 0));
  }
function cardHasStatuses(card = {}, statuses = []) {
    const bag = card.statuses || {};
    const keys = Array.isArray(statuses) ? statuses.filter(Boolean) : [];
    if (!keys.length) return Object.values(bag).some((turns) => Number(turns || 0) > 0);
    return keys.some((key) => Number(bag[key] || 0) > 0);
  }
function canTargetBattleItem(item = {}, card = {}) {
    const hp = Number(card.currentHp || 0);
    const kind = item.effectKind || "";
    if (item.targetMode === "downed_ally") return hp <= 0;
    if (hp <= 0) return false;
    if (kind === "heal_hp" || kind === "heal_hp_percent") return cardMissingHp(card);
    if (kind === "heal_percent_and_cure_status") return cardMissingHp(card) || cardHasStatuses(card, item.statuses);
    if (kind === "cure_status") return cardHasStatuses(card, item.statuses);
    if (kind === "cure_all_status") return cardHasStatuses(card);
    if (kind === "restore_skill_use") return cardMissingPp(card);
    return true;
  }
function totMusicaSequentialSelectionContext(view = latestView, requestedWorld = "") {
    const mechanic = view?.battle?.postgameBossMechanic;
    if (mechanic?.key !== "postgame_tot_musica" || !mechanic.state?.assigned || !view?.battle?.canAct || view?.battle?.result || view?.battle?.canFinish) return null;
    const state = mechanic.state;
    const world = requestedWorld === "song" ? "song" : "real";
    const activeIndex = Number(world === "real" ? state.realActiveIndex : state.songActiveIndex);
    const crew = state.coopPlayerWorlds
      ? (world === "real" ? state.realCrew || [] : state.songCrew || [])
      : state.crew || [];
    const card = crew.find((entry) => Number(entry.index) === activeIndex) || {};
    const canSelect = !state.coopPlayerWorlds || state.selectionWorld === world;
    const playerId = String(world === "real" ? state.realPlayerId || "" : state.songPlayerId || "");
    const playerName = world === "real" ? state.realPlayerName || "" : state.songPlayerName || "";
    const battleItems = state.coopPlayerWorlds
      ? (world === "real" ? state.realBattleItems || [] : state.songBattleItems || [])
      : view?.player?.battleItems || [];
    return { mechanic, state, world, activeIndex, card, crew, canSelect, playerId, playerName, battleItems };
  }
function submitTotMusicaSequentialSelections() {
    if (!totMusicaSelections.real || !totMusicaSelections.song || totMusicaDualAwaitingEvent || totMusicaDualAnimationActive) return;
    totMusicaDualAwaitingEvent = true;
    refs.infoContent?.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    refs.actionPanel?.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    if (totMusicaDualAwaitTimer) clearTimeout(totMusicaDualAwaitTimer);
    totMusicaDualAwaitTimer = setTimeout(() => {
      if (!totMusicaDualAwaitingEvent || totMusicaDualAnimationActive) return;
      totMusicaDualAwaitingEvent = false;
      totMusicaDualAwaitTimer = null;
      totMusicaSelections = { real: null, song: null };
      totMusicaSelectionWorld = "real";
      showStatus("雙世界行動等待逾時，已恢復行動選擇。請再試一次。");
      renderPanel(latestView);
    }, 15000);
    callBattleAction("battleTotDualAction", "tot-dual-action", { realAction: totMusicaSelections.real, songAction: totMusicaSelections.song });
    showStatus("兩位船員的行動已送出，開始同步判定。");
  }
function selectTotMusicaSequentialAction(action, requestedWorld = "") {
    const inferredWorld = requestedWorld === "song" ? "song" : requestedWorld === "real" ? "real" : "";
    const context = inferredWorld ? totMusicaSequentialSelectionContext(latestView, inferredWorld) : null;
    if (!context || !context.canSelect || !action || totMusicaDualAwaitingEvent || totMusicaDualAnimationActive) return false;
    if (context.state.coopPlayerWorlds) {
      const sent = callBattleAction("battleTotWorldAction", "tot-world-action", { world: context.world, action });
      if (sent === false) return false;
      showStatus(`${context.playerName || context.card.name || "目前玩家"}的行動已送出，等待另一個世界。`);
      return true;
    }
    totMusicaSelectionWorld = context.world;
    totMusicaSelections[context.world] = action;
    totMusicaWorldModes[context.world] = null;
    totMusicaWorldItemIds[context.world] = "";
    showStatus(`${context.card.name || "目前船員"}的行動已選。`);
    if (totMusicaSelections.real && totMusicaSelections.song) submitTotMusicaSequentialSelections();
    else renderPanel(latestView);
    return true;
  }
function totMusicaActionLabel(action = {}, state = {}) {
    if (action.type === "switch") return `換上 ${(state.crew || []).find((card) => Number(card.index) === Number(action.nextIndex))?.name || "夥伴"}`;
    if (action.type === "item") return (latestView?.player?.battleItems || []).find((item) => item.id === action.itemId)?.name || "使用道具";
    if (action.type === "escape") return "嘗試逃跑";
    if (action.type === "wait") return "沒有可用招式，待機";
    const move = (state.crew || []).flatMap((card) => card.moves || []).find((entry) => entry.id === action.moveId);
    return move?.displayName || move?.name || "使用招式";
  }
function totMusicaWorldCommandButtons(world) {
    const choices = [
      ["attack", "attack", "攻擊"],
      ["partners", "partners", "夥伴"],
      ["items", "items", "道具"],
      ["escape", "escape", "逃跑"],
    ];
    return `<div class="tot-musica-world-command-grid">${choices.map(([mode, icon, label]) => `
      <button class="tot-musica-world-command" type="button" data-tot-world-mode="${mode}" data-tot-world="${world}">
        <img class="tot-musica-world-command-frame" src="images/board/battle_command_ui/battle_command_action_button_frame.webp" alt="" aria-hidden="true">
        <img class="tot-musica-world-command-icon" src="images/board/battle_command_ui/battle_command_icon_${icon}.webp" alt="" aria-hidden="true">
        <span>${label}</span>
      </button>`).join("")}</div>`;
  }
function totMusicaWorldModeContent(view, context) {
    const { world, state, activeIndex, card } = context;
    if (!context.canSelect) {
      const waitingName = context.playerName || (world === "real" ? "現實世界玩家" : "歌世界玩家");
      const selected = world === "real" ? state.realActionSelected : state.songActionSelected;
      return `<div class="tot-musica-world-selected"><strong>${selected ? "行動已選" : `等待 ${escapeHtml(waitingName)} 選擇`}</strong><small>${selected ? "等待另一個世界完成選擇" : "由所屬玩家操作自己的船員隊伍"}</small></div>`;
    }
    const mode = totMusicaWorldModes[world];
    const indices = world === "real" ? state.realIndices || [] : state.songIndices || [];
    const back = `<button class="tot-musica-world-back" type="button" data-tot-world-back="${world}">返回四項指令</button>`;
    if (!mode) return totMusicaWorldCommandButtons(world);
    if (mode === "attack") {
      if (!(card.moves || []).some((move) => Number(move.currentPP ?? move.pp ?? 0) > 0)) {
        return `<div class="tot-musica-world-mode-head"><b>沒有可用招式</b>${back}</div><div class="tot-musica-world-option-grid"><button class="postgame-world-action" type="button" data-tot-world-action="wait" data-tot-world="${world}"><strong>待機一回合</strong><small>本世界不形成同步攻擊，魔王照常行動。</small></button></div>`;
      }
      return `<div class="tot-musica-world-mode-head"><b>選擇招式</b>${back}</div><div class="tot-musica-world-option-grid">${(card.moves || []).slice(0, 4).map((move) => {
        const detail = moveDetailLines(move);
        return `<button class="postgame-world-action" type="button" data-tot-world-action="move" data-tot-world="${world}" data-tot-value="${escapeHtml(move.id)}" ${Number(move.currentPP || 0) <= 0 ? "disabled" : ""}><strong>${escapeHtml(move.displayName || move.name)}</strong><small>${escapeHtml(detail.compactLine)}・PP ${escapeHtml(move.currentPP)}</small></button>`;
      }).join("")}</div>`;
    }
    if (mode === "partners") {
      const choices = (context.crew || []).filter((entry) => indices.includes(Number(entry.index)) && Number(entry.index) !== activeIndex);
      return `<div class="tot-musica-world-mode-head"><b>選擇同隊夥伴</b>${back}</div><div class="tot-musica-world-option-grid crew">${choices.map((entry) => `
        <button class="postgame-world-action tot-musica-world-crew-choice" type="button" data-tot-world-action="switch" data-tot-world="${world}" data-tot-value="${entry.index}" ${Number(entry.currentHp || 0) <= 0 ? "disabled" : ""}>
          <img src="${escapeHtml(postgameCrewPortrait(entry))}" alt="${escapeHtml(entry.name)}"><span><strong>${escapeHtml(entry.name)}</strong><small>HP ${escapeHtml(entry.currentHp)}/${escapeHtml(entry.maxHp)}</small></span>
        </button>`).join("") || `<span class="tot-musica-world-empty">沒有可換上的同隊夥伴</span>`}</div>`;
    }
    if (mode === "items") {
      const items = context.battleItems || [];
      const itemId = totMusicaWorldItemIds[world];
      const selected = items.find((item) => item.id === itemId) || null;
      if (selected?.targetMode === "battle_side") {
        const parityLabel = selected.id === "odd_dice" ? "單數" : "雙數";
        return `<div class="tot-musica-world-mode-head"><b>${escapeHtml(selected.name)}・選擇陣營</b>${back}</div><div class="tot-musica-world-option-grid">
          <button class="postgame-world-action" type="button" data-tot-world-item-side="${world}" data-item-id="${escapeHtml(selected.id)}" data-target-side="player"><strong>使用在我方</strong><small>接下來 2 次第一顆戰鬥骰只會出現${parityLabel}</small></button>
          <button class="postgame-world-action" type="button" data-tot-world-item-side="${world}" data-item-id="${escapeHtml(selected.id)}" data-target-side="enemy"><strong>使用在敵方</strong><small>接下來 2 次第一顆戰鬥骰只會出現${parityLabel}</small></button>
        </div>`;
      }
      if (selected && battleItemRequiresCrewTarget(selected, view)) {
        const targets = (context.crew || []).filter((entry) => indices.includes(Number(entry.index)));
        return `<div class="tot-musica-world-mode-head"><b>${escapeHtml(selected.name)}・選擇目標</b>${back}</div><div class="tot-musica-world-option-grid crew">${targets.map((entry) => {
          const canTarget = canTargetBattleItem(selected, entry);
          return `<button class="postgame-world-action tot-musica-world-crew-choice" type="button" data-tot-world-item-target="${world}" data-item-id="${escapeHtml(selected.id)}" data-target-index="${entry.index}" ${canTarget ? "" : "disabled"}><img src="${escapeHtml(postgameCrewPortrait(entry))}" alt="${escapeHtml(entry.name)}"><span><strong>${escapeHtml(entry.name)}</strong><small>HP ${escapeHtml(entry.currentHp)}/${escapeHtml(entry.maxHp)}</small></span></button>`;
        }).join("")}</div>`;
      }
      return `<div class="tot-musica-world-mode-head"><b>選擇戰鬥道具</b>${back}</div><div class="tot-musica-world-option-grid">${items.map((item) => `
        <button class="postgame-world-action" type="button" data-tot-world-item="${world}" data-item-id="${escapeHtml(item.id)}" ${Number(item.count || 0) <= 0 ? "disabled" : ""}><strong>${escapeHtml(item.name)} x${escapeHtml(item.count)}</strong><small>${escapeHtml(item.desc)}</small></button>`).join("") || `<span class="tot-musica-world-empty">目前沒有可用戰鬥道具</span>`}</div>`;
    }
    const escapeThreshold = Number(state.coopPlayerWorlds
      ? (world === "real" ? state.realEscapeThreshold || 0 : state.songEscapeThreshold || 0)
      : view?.battle?.escapeThreshold || 0);
    return `<div class="tot-musica-world-mode-head"><b>撤退選項</b>${back}</div><div class="tot-musica-world-option-grid escape"><button class="postgame-world-action" type="button" data-tot-world-action="escape" data-tot-world="${world}" ${escapeThreshold <= 0 ? "disabled" : ""}><strong>嘗試逃跑</strong><small>${escapeThreshold > 0 ? `需要擲出 ${escapeThreshold}+；失敗會消耗這位船員的行動` : "目前不能逃跑"}</small></button><button class="postgame-world-action danger" type="button" data-tot-world-surrender><strong>投降</strong><small>全隊瀕死並結束戰鬥</small></button></div>`;
  }
function bindTotMusicaWorldPanelActions(view) {
    refs.infoContent.querySelectorAll("[data-tot-world-mode]").forEach((button) => button.addEventListener("click", () => {
      const world = button.dataset.totWorld;
      totMusicaWorldModes[world] = button.dataset.totWorldMode;
      totMusicaWorldItemIds[world] = "";
      renderTotMusicaDualAction(view, view.battle.postgameBossMechanic);
    }));
    refs.infoContent.querySelectorAll("[data-tot-world-back]").forEach((button) => button.addEventListener("click", () => {
      const world = button.dataset.totWorldBack;
      totMusicaWorldModes[world] = null;
      totMusicaWorldItemIds[world] = "";
      renderTotMusicaDualAction(view, view.battle.postgameBossMechanic);
    }));
    refs.infoContent.querySelectorAll("[data-tot-world-action]").forEach((button) => button.addEventListener("click", () => {
      const type = button.dataset.totWorldAction;
      const action = type === "move" ? { type, moveId: button.dataset.totValue } : type === "switch" ? { type, nextIndex: Number(button.dataset.totValue) } : { type: type === "wait" ? "wait" : "escape" };
      selectTotMusicaSequentialAction(action, button.dataset.totWorld);
    }));
    refs.infoContent.querySelectorAll("[data-tot-world-item]").forEach((button) => button.addEventListener("click", () => {
      const world = button.dataset.totWorldItem;
      const context = totMusicaSequentialSelectionContext(view, world);
      const item = (context?.battleItems || []).find((entry) => entry.id === button.dataset.itemId);
      if (!context || !item) return;
      if (battleItemRequiresCrewTarget(item, view)) {
        totMusicaWorldItemIds[world] = item.id;
        renderTotMusicaDualAction(view, view.battle.postgameBossMechanic);
      } else selectTotMusicaSequentialAction({ type: "item", itemId: item.id, targetIndex: null, targetPlayerId: context.playerId || view.player.id }, world);
    }));
    refs.infoContent.querySelectorAll("[data-tot-world-item-target]").forEach((button) => button.addEventListener("click", () => {
      const context = totMusicaSequentialSelectionContext(view, button.dataset.totWorldItemTarget);
      selectTotMusicaSequentialAction({ type: "item", itemId: button.dataset.itemId, targetIndex: Number(button.dataset.targetIndex), targetPlayerId: context?.playerId || view.player.id }, button.dataset.totWorldItemTarget);
    }));
    refs.infoContent.querySelectorAll("[data-tot-world-item-side]").forEach((button) => button.addEventListener("click", () => {
      const world = button.dataset.totWorldItemSide;
      const context = totMusicaSequentialSelectionContext(view, world);
      selectTotMusicaSequentialAction({
        type: "item",
        itemId: button.dataset.itemId,
        targetIndex: null,
        targetPlayerId: context?.playerId || view.player.id,
        targetSide: button.dataset.targetSide,
      }, world);
    }));
    refs.infoContent.querySelectorAll("[data-tot-world-change]").forEach((button) => button.addEventListener("click", () => {
      const world = button.dataset.totWorldChange;
      totMusicaSelections[world] = null;
      totMusicaWorldModes[world] = null;
      renderTotMusicaDualAction(view, view.battle.postgameBossMechanic);
    }));
    refs.infoContent.querySelectorAll("[data-tot-world-surrender]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!window.confirm("確定要投降嗎？隊伍會全員瀕死。")) return;
        callBattleAction("battleSurrender", "surrender");
      });
    });
  }
function renderTotMusicaDualAction(view, mechanic) {
    refs.actionPanel?.classList.add("is-hidden");
    refs.infoPanel?.classList.add("tot-musica-dual-action-mode", "battle-command-mode");
    refs.infoPanel?.classList.remove("is-hidden", "result-mode", "battle-switch-mode");
    const state = mechanic.state || {};
    const signature = `${view?.battle?.round || view?.battle?.roundIndex || 0}:${state.realPlayerId || "solo"}:${state.realActiveIndex}:${state.songPlayerId || "solo"}:${state.songActiveIndex}:${state.selectionWorld || "both"}`;
    if (signature !== totMusicaSelectionSignature) {
      totMusicaSelectionSignature = signature;
      totMusicaSelections = { real: null, song: null };
      totMusicaSelectionWorld = "real";
      totMusicaWorldModes = { real: null, song: null };
      totMusicaWorldItemIds = { real: "", song: "" };
      selectedBattleItemId = "";
      currentMode = null;
    }
    const real = totMusicaSequentialSelectionContext(view, "real");
    const song = totMusicaSequentialSelectionContext(view, "song");
    if (!real || !song) return;
    syncTotMusicaPersistentStage(view);
    refs.infoTitle.textContent = "";
    const column = (context) => {
      const world = context.world;
      const stateSelected = state.coopPlayerWorlds && (world === "real" ? state.realActionSelected : state.songActionSelected);
      const selected = state.coopPlayerWorlds ? (stateSelected ? { type: "queued" } : null) : totMusicaSelections[world];
      const content = selected
        ? `<div class="tot-musica-world-selected"><strong>${state.coopPlayerWorlds ? "行動已選" : `已選：${escapeHtml(totMusicaActionLabel(selected, state))}`}</strong><small>等待另一個世界完成選擇</small>${state.coopPlayerWorlds ? "" : `<button type="button" data-tot-world-change="${world}">重新選擇</button>`}</div>`
        : totMusicaWorldModeContent(view, context);
      const ownerLabel = state.coopPlayerWorlds && context.playerName ? `${context.playerName}・` : "";
      return `<section class="postgame-world-column ${world === "song" ? "song" : ""}" aria-label="${escapeHtml(context.card.name || "目前船員")}行動面板"><img class="postgame-world-panel-frame" src="images/board/battle_switch_ui/battle_switch_panel_frame.webp" alt="" aria-hidden="true"><header class="postgame-world-heading"><span>${escapeHtml(ownerLabel + (context.card.name || "目前船員"))}<small>${selected ? "行動已選" : context.canSelect ? (totMusicaWorldModes[world] ? "正在選擇細項" : "選擇本回合行動") : "等待所屬玩家"}</small></span></header><div class="postgame-world-actions">${content}</div></section>`;
    };
    refs.infoContent.innerHTML = `<section class="battle-command-ui postgame-dual-command-ui" aria-label="兩位船員分別選擇行動"><div class="postgame-dual-world-grid">${column(real)}${column(song)}</div></section>`;
    bindTotMusicaWorldPanelActions(view);
  }
return {
 render(view){latestView=view;renderPanel(view);},
 context(world){return totMusicaSequentialSelectionContext(latestView,world);},
 awaiting:()=>totMusicaDualAwaitingEvent,
 presentation(active){if(active){if(totMusicaDualAwaitTimer)clearTimeout(totMusicaDualAwaitTimer);totMusicaDualAwaitTimer=null;totMusicaDualAwaitingEvent=false;}totMusicaDualAnimationActive=active;},
 dispose(){if(totMusicaDualAwaitTimer)clearTimeout(totMusicaDualAwaitTimer);totMusicaDualAwaitTimer=null;totMusicaDualAwaitingEvent=false;totMusicaDualAnimationActive=false;totMusicaSelectionSignature='';latestView=null;}
};
};
