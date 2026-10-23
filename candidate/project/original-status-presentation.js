'use strict';
// Generated presentation helpers; no gameplay mutation.
function openingPassiveEffectKind(event = {}) {
    const moveType = String(event.moveType || "").toLowerCase();
    const text = `${event.effectText || ""}${event.detail || ""}`;
    if (moveType === "debuff" || moveType === "control" || /^敵方/.test(text)) return "debuff";
    if (/攻擊/.test(text)) return "attack";
    if (/防禦|護盾|減傷/.test(text)) return "defense";
    if (/速度|命中|閃避/.test(text)) return "speed";
    if (/回復|治療/.test(text)) return "heal";
    return "speed";
  }
function effectKind(effectFx = {}) {
    const kind = String(effectFx.kind || "").toLowerCase();
    if (kind === "heal") return "heal";
    if (kind === "attack" || kind === "atk") return "attack";
    if (kind === "defense" || kind === "def" || kind === "shield") return kind === "shield" ? "shield" : "defense";
    if (kind === "speed" || kind === "spd") return "speed";
    if (kind === "debuff" || kind === "status" || kind === "control") return "debuff";
    return "speed";
  }
function effectColor(kind) {
    if (kind === "heal") return "78, 231, 145";
    if (kind === "attack") return "255, 87, 80";
    if (kind === "defense" || kind === "shield") return "84, 171, 255";
    if (kind === "speed") return "255, 218, 73";
    if (kind === "debuff") return "169, 104, 255";
    return "255, 218, 73";
  }
function eventActorSide(event = {}) {
    return event.side === "enemy" ? "enemy" : event.side === "player" ? "player" : "";
  }
function oppositeSide(side) {
    return side === "player" ? "enemy" : side === "enemy" ? "player" : "";
  }
const STATUS_PARTICLE_TUNING = {
    duration: 700,
    distance: 206,
    strength: 1,
    spread: 2.2,
    blur: 3,
    glow: 5,
    particleSpeed: 0.5,
    particleCount: 56,
    particleSize: 2.4,
  };
exports.prepare=function(event){
    const side=eventActorSide(event)||'player',moveType=String(event.moveType||'').toLowerCase(),passive=event.type==='passive-opening';
    const effect=event.effectFx||{},negative=['debuff','control'].includes(moveType);
    const target=effect.targetSide||(['enemy','player'].includes(event.targetSide)?event.targetSide:(negative?oppositeSide(side):side));
    const down=passive?(target!==side||negative):(effect.direction==='down'||effectKind(effect)==='debuff');
    const kind=passive?openingPassiveEffectKind(event):(event.type==='heal'?'heal':effectKind(effect));
    return {side,target,kind,direction:down?'down':'up',color:effectColor(kind).split(',').map(x=>Number(x)/255),tuning:STATUS_PARTICLE_TUNING,
      title:passive?((event.actorName?event.actorName+'：':'')+(event.passiveName||event.title||'開場被動')):(event.moveName||event.title||(event.type==='heal'?'治療發動！':'戰鬥行動！')),
      label:passive?(event.effectText||event.detail||(down?'能力下降':'能力提升')):(effect.label||(down?'能力下降':'能力提升')),
      pose:passive?(down?'attack':'morale'):(negative?'dizzy':'morale'),poseSide:!passive&&negative?target:side,
      delay:passive?420:0,duration:passive?Math.max(1400,Number(event.duration||1850)):Math.max(900,Number(event.duration||1250))};
};
exports.createIcons=function(onUpdate){
    let latestView=null;
    const statusIconDelays={player:null,enemy:null},lastRenderedStatusCombatants={player:null,enemy:null};
    function renderHud(){if(latestView)onUpdate(snapshot());}
    function cloneStatusCombatant(combatant = {}) {
    if (!combatant) return null;
    return JSON.parse(JSON.stringify({
      statuses: combatant.statuses || {},
      effectDetails: Array.isArray(combatant.effectDetails) ? combatant.effectDetails : [],
      effectDice: combatant.effectDice || 0,
    }));
  }
function sideCombatantFromView(view, side) {
    if (!view) return null;
    return side === "player" ? view.activeCard : side === "enemy" ? view.enemy : null;
  }
function statusIconDelayKind(event = {}) {
    if (event.type === "passive-opening") return openingPassiveEffectKind(event);
    if (!event.effectFx) return "";
    return effectKind(event.effectFx);
  }
function statusIconDelayTargets(event = {}) {
    if (!event) return [];
    const kind = statusIconDelayKind(event);
    if (!["attack", "defense", "shield", "speed", "debuff"].includes(kind)) return [];
    const side = eventActorSide(event);
    const moveType = String(event.moveType || "").toLowerCase();
    const effectTarget = event.effectFx?.targetSide;
    const explicitTarget = event.targetSide === "player" || event.targetSide === "enemy" ? event.targetSide : "";
    let targetSide = effectTarget === "player" || effectTarget === "enemy" ? effectTarget : explicitTarget;
    if (!targetSide) {
      if (event.type === "passive-opening") targetSide = moveType === "debuff" || moveType === "control" ? oppositeSide(side) : side;
      else if (moveType === "debuff" || moveType === "control") targetSide = oppositeSide(side);
      else targetSide = side;
    }
    return targetSide === "player" || targetSide === "enemy" ? [targetSide] : [];
  }
function releaseStatusIconDelay(side, eventId = "") {
    const lock = statusIconDelays[side];
    if (!lock || (eventId && lock.eventId !== eventId)) return;
    lock.released = true;
    clearTimeout(lock.timer);
    lock.timer = null;
    renderHud(latestView);
  }
function clearStatusIconDelays() {
    ["player", "enemy"].forEach((side) => {
      clearTimeout(statusIconDelays[side]?.timer);
      statusIconDelays[side] = null;
      lastRenderedStatusCombatants[side] = null;
    });
  }
function statusIconFallbackDelay(event = {}) {
    if (event.type === "attack") return Math.max(900, Number(event.duration || 1850) - 420);
    if (event.type === "passive-opening") return 940;
    return 720;
  }
function prepareStatusIconDelays(view) {
    const event = view?.battle?.visualEvent || null;
    const eventId = event?.id || "";
    if (!eventId) {
      ["player", "enemy"].forEach((side) => {
        if (statusIconDelays[side] && !statusIconDelays[side].released) releaseStatusIconDelay(side, statusIconDelays[side].eventId);
        if (statusIconDelays[side]?.released) {
          clearTimeout(statusIconDelays[side].timer);
          statusIconDelays[side] = null;
        }
      });
      return;
    }
    const targets = statusIconDelayTargets(event);
    ["player", "enemy"].forEach((side) => {
      if (!targets.includes(side)) {
        if (statusIconDelays[side]?.eventId !== eventId) {
          clearTimeout(statusIconDelays[side]?.timer);
          statusIconDelays[side] = null;
        }
        return;
      }
      if (statusIconDelays[side]?.eventId === eventId) return;
      clearTimeout(statusIconDelays[side]?.timer);
      const startSnapshot = event.startSnapshot?.[side] || event.startCombatant;
      const snapshot = cloneStatusCombatant(startSnapshot || lastRenderedStatusCombatants[side] || sideCombatantFromView(view, side));
      statusIconDelays[side] = {
        eventId,
        released: false,
        snapshot,
        timer: setTimeout(() => releaseStatusIconDelay(side, eventId), statusIconFallbackDelay(event)),
      };
    });
  }
function openingPassiveHoldTexts(view, side) {
    const battle = view?.battle;
    if (!battle?.openingPassiveVisualPending || battle?.visualEvent?.type === "passive-opening") return [];
    const queue = Array.isArray(battle.openingPassiveVisualQueue) ? battle.openingPassiveVisualQueue : [];
    return queue
      .filter((event) => (event.targetSide === "enemy" || event.targetSide === "player") && event.targetSide === side)
      .map((event) => event.effectText || "")
      .filter(Boolean);
  }
function passiveEffectTokens(text = "") {
    return String(text || "")
      .split(/[，、,]/)
      .map((part) => part.replace(/^(敵方|我方|自身)/, "").replace(/\s+/g, "").trim())
      .filter(Boolean);
  }
function filterOpeningPassiveHoldIcons(combatant = {}, holdTexts = []) {
    const tokens = holdTexts.flatMap(passiveEffectTokens);
    if (!tokens.length || !Array.isArray(combatant?.effectDetails)) return combatant;
    return {
      ...combatant,
      effectDetails: combatant.effectDetails.filter((detail) => {
        const hay = `${detail.label || ""}${detail.badge || ""}`.replace(/\s+/g, "");
        return !tokens.some((token) => hay.includes(token));
      }),
    };
  }
function statusIconCombatantForRender(side, combatant = {}, view = latestView) {
    const lock = statusIconDelays[side];
    if (lock && !lock.released) return lock.snapshot || combatant;
    const holdTexts = openingPassiveHoldTexts(view, side);
    if (holdTexts.length) return filterOpeningPassiveHoldIcons(combatant, holdTexts);
    return combatant;
  }
function rememberRenderedStatusCombatant(side, combatant = {}) {
    if (!["player", "enemy"].includes(side)) return;
    lastRenderedStatusCombatants[side] = cloneStatusCombatant(combatant);
  }
    function snapshot(){
        const copy={...latestView};
        for(const [side,field] of [['player','activeCard'],['enemy','enemy']]){
            const actor=latestView[field];if(!actor)continue;
            const icons=statusIconCombatantForRender(side,actor,latestView);
            copy[field]={...actor,effectDetails:icons.effectDetails||[],statuses:icons.statuses||{},effectDice:icons.effectDice||0};
            rememberRenderedStatusCombatant(side,icons);
        }
        return copy;
    }
    return {update(view){latestView=view;prepareStatusIconDelays(view);return snapshot();},release:releaseStatusIconDelay,dispose(){clearStatusIconDelays();latestView=null;}};
};
