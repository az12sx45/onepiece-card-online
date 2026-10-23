'use strict';
// Generated original text and dice display helpers.
exports.prepare=function(event,latestView){
function isAttackLikeMoveType(moveType = "") {
    return ["attack", "special", "combo", "battle"].includes(String(moveType || "").toLowerCase());
  }
function diceThemeForEvent(event = {}) {
    const moveType = String(event.moveType || "").toLowerCase();
    const theme = String(event.theme || "").toLowerCase();
    if (["heal", "buff", "shield", "support"].includes(moveType) || theme === "heal") return "heal";
    if (["debuff", "control", "status"].includes(moveType) || theme === "debuff") return "debuff";
    if (["escape", "move", "speed"].includes(moveType) || theme === "move") return "speed";
    if (isAttackLikeMoveType(moveType) || ["battle", "combo", "attack"].includes(theme)) return "attack";
    return "skill";
  }
function diceRollingText(theme) {
    if (theme === "heal") return "支援判定中...";
    if (theme === "debuff") return "妨害判定中...";
    if (theme === "speed") return "脫離判定中...";
    if (theme === "attack") return "攻擊判定中...";
    return "效果判定中...";
  }
function diceSettledText(theme) {
    if (theme === "heal") return "支援效果確認...";
    if (theme === "debuff") return "妨害效果確認...";
    if (theme === "speed") return "行動結果確認...";
    if (theme === "attack") return "看清楚點數後計算傷害...";
    return "看清楚點數後計算效果...";
  }
function diceSideLabel(event = {}) {
    const label = String(event.sideLabel || "").trim();
    if (!label || /^(我方|敵方)$/.test(label)) return "";
    return label.replace(/^(我方|敵方)\s*/, "");
  }
function diceActorName(event = {}) {
    const explicitName = String(event.actorName || "").trim();
    if (explicitName) return explicitName;
    const title = String(event.title || "");
    const titleName = title.match(/^(.+?)(?:\s+使用|\s+嘗試| 的|：)/)?.[1]?.trim();
    if (titleName && !/^(我方|敵方|戰鬥型被動|追加戰鬥骰)$/.test(titleName)) return titleName;
    if (event.side === "player") return latestView?.activeCard?.name || latestView?.player?.name || "";
    if (event.side === "enemy") return latestView?.enemy?.name || "敵人";
    return "";
  }
function diceActorPrefix(event = {}) {
    const sideLabel = diceSideLabel(event);
    const actorName = diceActorName(event);
    if (sideLabel && actorName) return `${sideLabel} ${actorName}`;
    return actorName || sideLabel;
  }
function diceRollingTitle(event = {}) {
    const prefix = diceActorPrefix(event);
    const title = String(event.title || "骰子加成");
    if (Number(event.extraDiceOrdinal || 0) === 3) return prefix ? `${prefix}：日蝕・第三顆戰鬥骰` : "日蝕・第三顆戰鬥骰";
    if (event.isExtraDice) return prefix ? `${prefix}：追加戰鬥骰` : title;
    const actorName = diceActorName(event);
    if (prefix && actorName && !title.includes(actorName)) return `${prefix}：${title}`;
    const sideLabel = diceSideLabel(event);
    return sideLabel ? `${sideLabel}：${title}` : title;
  }
function diceRollingSubtitle(event = {}, theme) {
    if (event.isExtraDice) {
      const reason = String(event.extraDiceReason || "追加骰").trim();
      const threshold = event.triggerThreshold || "?";
      if (Number(event.extraDiceOrdinal || 0) === 3) {
        return `${reason}觸發：第二顆 ${event.secondDie || "?"} 達到 ${threshold}+，正在骰第三顆。`;
      }
      const firstDie = event.firstDie || "?";
      return `${reason}觸發：第一顆 ${firstDie} 達到 ${threshold}+，正在骰第二顆。`;
    }
    const rawSubtitle = String(event.subtitle || "");
    return rawSubtitle && !rawSubtitle.includes("決定招式最終效果")
      ? rawSubtitle
      : diceRollingText(theme);
  }
function resolvedDiceTotal(event = {}) {
    const first = Math.max(0, Number(event.firstDie || 0));
    const second = Math.max(0, Number(event.secondDie || 0));
    const third = Math.max(0, Number(event.thirdDie || 0));
    if (first && second && (third || event.type === "bonus")) return first + second + third;
    return Math.max(0, Number(event.settle || 0));
  }
function resolvedDiceEvent(event = {}) {
    const total = resolvedDiceTotal(event);
    if (!total) return event;
    const bonusText = String(event.bonusText || "");
    const staleSettle = Math.max(0, Number(event.settle || 0));
    const correctedBonusText = bonusText.match(/總點數\s*\d+/)
      ? bonusText.replace(/總點數\s*\d+/, `總點數 ${total}`)
      : staleSettle && staleSettle !== total
        ? bonusText.replace(/\d+/, String(total))
        : bonusText;
    return {
      ...event,
      settle: total,
      bonusText: correctedBonusText,
    };
  }
function resolvedDiceSummary(event = {}) {
    const displayEvent = resolvedDiceEvent(event);
    const faces = [displayEvent.firstDie, displayEvent.secondDie, displayEvent.thirdDie]
      .map((value) => Math.max(0, Number(value || 0)))
      .filter(Boolean);
    if (faces.length < 2) return displayEvent.bonusText || displayEvent.title || "加成確認";
    const total = resolvedDiceTotal(displayEvent);
    const effectText = String(displayEvent.bonusText || "")
      .replace(/^總點數\s*\d+\s*[，,]?\s*/, "")
      .trim();
    return `${faces.join(" + ")} = ${total}${effectText ? `，${effectText}` : ""}`;
  }
function diceSettledTitleForEvent(event = {}) {
    const prefix = diceActorPrefix(event);
    const settle = resolvedDiceTotal(event) || "?";
    if (Number(event.extraDiceOrdinal || 0) === 3 && event.isExtraDice) {
      return prefix ? `${prefix}：第三顆骰出 ${settle}` : `第三顆骰出 ${settle}`;
    }
    if (event.firstDie && event.secondDie && event.thirdDie) {
      return prefix
        ? `${prefix}：${event.firstDie} + ${event.secondDie} + ${event.thirdDie} = ${settle}`
        : `${event.firstDie} + ${event.secondDie} + ${event.thirdDie} = ${settle}`;
    }
    if (event.firstDie && event.secondDie) {
      return prefix ? `${prefix}：${event.firstDie} + ${event.secondDie} = ${settle}` : `${event.firstDie} + ${event.secondDie} = ${settle}`;
    }
    if (event.isExtraDice) return prefix ? `${prefix}：追加骰出 ${settle}` : `追加骰出 ${settle}`;
    return prefix ? `${prefix}：骰出 ${settle}` : `骰出 ${settle}`;
  }
function diceSettledSubtitleForEvent(event = {}, theme) {
    const displayEvent = resolvedDiceEvent(event);
    if (Number(event.extraDiceOrdinal || 0) === 3 && event.isExtraDice) {
      const reason = String(event.extraDiceReason || "名刀『日蝕』").trim();
      return `${reason}：第二顆 ${event.secondDie || "?"} + 第三顆 ${event.settle || "?"}，接著三顆合計倍率。`;
    }
    if (event.firstDie && event.secondDie && event.thirdDie) {
      const reason = event.extraDiceReason ? `${event.extraDiceReason}，` : "";
      return `${reason}${displayEvent.bonusText || "三顆相加計算倍率"}`;
    }
    if (event.firstDie && event.secondDie) {
      const reason = event.extraDiceReason ? `${event.extraDiceReason}，` : "";
      return `${reason}${displayEvent.bonusText || "兩顆相加計算倍率"}`;
    }
    if (event.isExtraDice) {
      const reason = String(event.extraDiceReason || "追加骰").trim();
      return `${reason}：第一顆 ${event.firstDie || "?"} + 第二顆 ${event.settle || "?"}，接著合計倍率。`;
    }
    return event.bonusText || diceSettledText(theme);
  }
event=resolvedDiceEvent(event);const theme=diceThemeForEvent(event);return {event,theme,rollingTitle:diceRollingTitle(event),rollingSubtitle:diceRollingSubtitle(event,theme),settledTitle:diceSettledTitleForEvent(event),settledSubtitle:diceSettledSubtitleForEvent(event,theme),summary:resolvedDiceSummary(event)};
};
