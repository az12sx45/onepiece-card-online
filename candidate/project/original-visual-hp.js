'use strict';
// Generated original displayed HP calculation; no state mutation.
exports.prepare=function(view){let visualHpOverride=null,completedImpactEventId='';
function attackHitDamages(event = {}) {
    if (Array.isArray(event.hitDamages) && event.hitDamages.length) {
      return event.hitDamages.map((damage) => Math.max(0, Math.round(Number(damage || 0))));
    }
    return [Math.max(0, Math.round(Number(event.damage || 0)))];
  }
function attackTargetSide(event = {}) {
    const explicit = String(event.targetSide || "").trim();
    if (explicit === "player" || explicit === "enemy") return explicit;
    return event.side === "enemy" ? "player" : "enemy";
  }
function attackDamageTotal(event = {}) {
    return attackHitDamages(event).reduce((sum, damage) => sum + damage, 0);
  }
function visualEventCombatantForSide(event = {}, side = "") {
    if (!event) return null;
    if (event.type === "switch") {
      const switchSide = event.side === "enemy" ? "enemy" : "player";
      if (side !== switchSide) return null;
      const source = event.actorCombatant || event.toCombatant || event.finalSnapshot?.[side];
      return source && typeof source === "object" && !Array.isArray(source) ? source : null;
    }
    if (event.finalSnapshot?.[side]) {
      const source = event.finalSnapshot[side];
      return source && typeof source === "object" && !Array.isArray(source) ? source : null;
    }
    if (event.type !== "attack") return null;
    const targetSide = attackTargetSide(event);
    const actorSide = event.side === "enemy" ? "enemy" : event.side === "player" ? "player" : "";
    let source = null;
    if (side === targetSide) {
      source = event.targetCombatant || event.targetSnapshot || event.target;
    } else if (side === actorSide) {
      source = event.actorCombatant || event.actorSnapshot || event.actor;
    }
    return source && typeof source === "object" && !Array.isArray(source) ? source : null;
  }
function ensureVisualHpOverride(view) {
    const event = view?.battle?.visualEvent;
    if (!event || event.type !== "attack" || event.miss || completedImpactEventId === event.id) {
      return null;
    }
    if (visualHpOverride?.eventId === event.id) return visualHpOverride;
    const active = view?.activeCard || {};
    const enemy = view?.enemy || {};
    const eventActive = visualEventCombatantForSide(event, "player") || {};
    const eventEnemy = visualEventCombatantForSide(event, "enemy") || {};
    const activeVisual = { ...active, ...eventActive };
    const enemyVisual = { ...enemy, ...eventEnemy };
    const targetSide = attackTargetSide(event);
    const totalDamage = attackDamageTotal(event);
    visualHpOverride = {
      eventId: event.id,
      targetSide,
      playerHp: Number(event.startHp?.player ?? activeVisual.currentHp ?? 0),
      enemyHp: Number(event.startHp?.enemy ?? enemyVisual.currentHp ?? 0),
      finalPlayerHp: Number(activeVisual.currentHp || 0),
      finalEnemyHp: Number(enemyVisual.currentHp || 0),
      playerMaxHp: Math.max(1, Number(activeVisual.maxHp || 1)),
      enemyMaxHp: Math.max(1, Number(enemyVisual.maxHp || 1)),
    };
    if (Number.isFinite(Number(event.finalHp?.player))) {
      visualHpOverride.finalPlayerHp = Math.max(0, Number(event.finalHp.player));
    }
    if (Number.isFinite(Number(event.finalHp?.enemy))) {
      visualHpOverride.finalEnemyHp = Math.max(0, Number(event.finalHp.enemy));
    }
    if (targetSide === "player" && !event.startHp) {
      visualHpOverride.playerHp = Math.min(visualHpOverride.playerMaxHp, visualHpOverride.finalPlayerHp + totalDamage);
    } else if (targetSide === "enemy" && !event.startHp) {
      visualHpOverride.enemyHp = Math.min(visualHpOverride.enemyMaxHp, visualHpOverride.finalEnemyHp + totalDamage);
    }
    return visualHpOverride;
  }
return ensureVisualHpOverride(view);
};
