'use strict';
// Original renderer labels/reward formatting, extracted without HTML or rule changes.
function formatRewardAmount(value) {
    const amount = Math.max(0, Math.round(Number(value || 0)));
    return amount.toLocaleString("zh-TW");
  }
function rewardItemText(rewards) {
    const grantedItems = Array.isArray(rewards?.grantedItems)
      ? rewards.grantedItems.map(String).filter(Boolean)
      : [];
    if (grantedItems.length) return grantedItems.join("、");
    return rewards?.itemText || rewards?.battleCarryDropLabel || rewards?.battleCarryDropName || rewards?.item || "無道具";
  }
function battleResultRewardEntries(view) {
    if (view?.battle?.result !== "win") return [];
    const coopDetails = Array.isArray(view.battle.coopRewardDetails) ? view.battle.coopRewardDetails : [];
    const coopPerformance = Array.isArray(view.battle.coopInfo?.participants) ? view.battle.coopInfo.participants : [];
    if (coopDetails.length) {
      return coopDetails.slice(0, 4).map((entry) => {
        const performance = coopPerformance.find((candidate) => String(candidate.id) === String(entry.playerId)) || {};
        return {
          name: entry.playerName || "玩家",
          isPerformance: true,
          lines: [
            `傷害 ${formatRewardAmount(performance.damageDone)} ・ 承傷 ${formatRewardAmount(performance.damageTaken)} ・ 治療 ${formatRewardAmount(performance.healingDone)}`,
            `行動 ${formatRewardAmount(performance.turnsActed)} ・ 道具 ${formatRewardAmount(performance.itemsUsed)} ・ 救援 ${formatRewardAmount(performance.rescuesDone)}`,
            `貝里 +${formatRewardAmount(entry.coins)} ・ 懸賞金 +${entry.bountyText || formatRewardAmount(entry.bounty)}`,
            `EXP +${formatRewardAmount(entry.exp)} ・ ${entry.itemText || "無道具"}`,
          ],
        };
      });
    }
    const raidParticipants = Array.isArray(view.battle.raidInfo?.participants) ? view.battle.raidInfo.participants : [];
    if (raidParticipants.length) {
      return raidParticipants.slice(0, 4).map((entry) => ({
        name: entry.name || "玩家",
        isPerformance: true,
        lines: [
          `傷害 ${formatRewardAmount(entry.damageDone)} ・ 承傷 ${formatRewardAmount(entry.damageTaken)} ・ 治療 ${formatRewardAmount(entry.healingDone)}`,
          `行動 ${formatRewardAmount(entry.turnsActed)} ・ 道具 ${formatRewardAmount(entry.itemsUsed)} ・ 救援 ${formatRewardAmount(entry.rescuesDone)}`,
          `貝里 +${formatRewardAmount(entry.rewardPreview?.coins)} ・ 懸賞金 +${formatRewardAmount(entry.rewardPreview?.bounty)}`,
          `EXP +${formatRewardAmount(entry.rewardPreview?.exp)}`,
        ],
      }));
    }
    const rewards = view.battle.rewards;
    if (!rewards) return [];
    return [
      { name: "貝里", lines: [`+${formatRewardAmount(rewards.coins)}`] },
      { name: "懸賞金", lines: [`+${rewards.bountyText || formatRewardAmount(rewards.bounty)}`] },
      { name: "EXP", lines: [`+${formatRewardAmount(rewards.exp)}`] },
      { name: "獎勵物品", lines: [rewardItemText(rewards)] },
    ];
  }
function battleFinishSignature(view) {
    return [
      view?.player?.id || "",
      view?.battle?.islandId || "",
      view?.battle?.islandKind || "",
      view?.enemy?.key || view?.enemy?.name || "",
      view?.battle?.result || "",
      view?.battle?.round || "",
      view?.battle?.raidInfo?.phaseIndex ?? "",
    ].join("|");
  }
exports.prepare=function(view){if(!view?.battle)return null;
const raidInfo = view?.battle?.raidInfo || null;
const isRaidPhaseWin = !!raidInfo && view.battle.result === "win" && Number(raidInfo.phaseIndex || 0) + 1 < Number(raidInfo.phaseTotal || 6);
const isRoundPause = view.battle.result === "round-pause";
const isDeferredCoopResult = !!view.battle.deferredCoopResult;
const roundPauseReturnsToMap = isRoundPause && view.battle.roundPauseReturnsToMap !== false;
const finishLabel = isRoundPause
      ? (roundPauseReturnsToMap ? "返回地圖，換下一位" : "進入下一輪")
      : isDeferredCoopResult
        ? "回到地圖，繼續本回合"
      : isRaidPhaseWin
        ? "領取補給並換人"
        : "返回地圖";
const resultText = view.battle.result === "win"
      ? "戰鬥勝利！"
      : view.battle.result === "lose"
        ? "全員瀕死"
        : view.battle.result === "escape"
          ? "成功脫離戰鬥"
          : view.battle.result === "replacement"
          ? "夥伴瀕死，請選下一位上場"
          : isRoundPause
            ? "本輪結束"
            : "本輪處理完成";
const rewardEntries = battleResultRewardEntries(view);
const isDangerResult = ["lose", "replacement"].includes(view.battle.result);
const actionFrame = isDangerResult
      ? "images/board/battle_command_ui/battle_command_danger_button_frame.webp"
      : "images/board/battle_command_ui/battle_command_choice_button_frame.webp";
return {resultText,finishLabel,rewardEntries,isDangerResult,actionFrame,signature:battleFinishSignature(view)};};
