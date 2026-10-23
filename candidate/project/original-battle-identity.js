'use strict';
// Exact original renderer battle-session identity, not a new save/game field.
function prebattleIntroKeyPart(value, fallback = "x") {
    const text = String(value ?? "").trim() || String(fallback || "x");
    return text.replace(/[^\w\u3400-\u9fff.-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 96) || String(fallback || "x");
  }
function prebattleIntroRuntimeKey(view) {
    const intro = view?.battle?.prebattleIntro;
    const explicitKey = String(intro?.key || view?.battle?.prebattleIntroKey || "").trim();
    if (explicitKey) return explicitKey;
    const battle = view?.battle || {};
    return [
      battle.coopView?.currentPlayerId || view?.player?.id || battle.playerId || "player",
      battle.islandId || battle.islandKind || "battle",
      battle.islandKind || "battle",
      view?.enemy?.key || view?.enemy?.id || view?.enemy?.name || intro?.enemyKey || intro?.enemyName || "enemy",
      view?.activeCard?.id || view?.activeCard?.key || intro?.heroKey || intro?.heroName || "hero",
    ].map((part) => prebattleIntroKeyPart(part)).join(":");
  }
function battleIdentityKey(view) {
    if (!view?.battle) return "";
    return [
      view.battle.coopView?.currentPlayerId || view.player?.id || "",
      view.battle.islandId || "",
      view.battle.islandKind || "",
      view.enemy?.key || view.enemy?.name || "",
      view.battle.raidInfo?.phaseIndex ?? "",
      view.battle.raidInfo?.phaseTotal ?? "",
      prebattleIntroRuntimeKey(view),
    ].join("|");
  }
exports.key=battleIdentityKey;
