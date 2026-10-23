'use strict';
// Generated from board_battle.js; do not edit.
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
function battleItemTargetHint(item = {}, card = {}) {
    const kind = item.effectKind || "";
    if (item.targetMode === "downed_ally") return "需要倒下的隊友";
    if (Number(card.currentHp || 0) <= 0) return "已倒下";
    if (kind === "heal_hp" || kind === "heal_hp_percent") return "HP 已滿";
    if (kind === "heal_percent_and_cure_status") return "不需要治療";
    if (kind === "cure_status" || kind === "cure_all_status") return "沒有異常";
    if (kind === "restore_skill_use") return "技能次數已滿";
    return "";
  }
function battleCrewPpText(card = {}) {
    const moves = card.moves || [];
    const current = moves.reduce((sum, move) => sum + Number(move.currentPP ?? move.pp ?? 0), 0);
    const max = moves.reduce((sum, move) => sum + Number(move.pp || 0), 0);
    return max > 0 ? `${current}/${max}` : String(card.totalPP || 0);
  }
module.exports={battleItemRequiresCrewTarget,cardMissingHp,cardMissingPp,cardHasStatuses,canTargetBattleItem,battleItemTargetHint,battleCrewPpText};
