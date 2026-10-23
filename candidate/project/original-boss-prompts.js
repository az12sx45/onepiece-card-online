'use strict';
// Exact original prompt controller. Native controls supply drawing and input.
exports.create=function({refs,callBattleAction,showStatus}){
const window={};
// Native ScrollContainer retains its position across unchanged source models.
const rememberPanelScroll=()=>{},restorePanelScroll=()=>{};
const renderClosedPanel=()=>{refs.infoContent.innerHTML='';};
const PLACEHOLDER_BATTLE_PORTRAIT = "images/board/battle/portraits/placeholder/normal.webp";
let currentMode = null;
let oarsPendingBetKey = "";
const oarsPendingBetStakes = new Map();
let totMusicaTeamSlots = { real: [], song: [] };
let totMusicaTeamPickedIndex = null;
let totMusicaTeamSelectionSignature = "";
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
function renderPostgameBossPrompt(view, mechanic) {
    currentMode = null;
    refs.actionPanel?.classList.add("is-hidden");
    refs.infoPanel?.classList.remove("is-hidden", "result-mode", "battle-switch-mode");
    refs.infoPanel?.classList.add("battle-command-mode");
    refs.infoTitle.textContent = "";
    const prompt = mechanic?.prompt;
    if (prompt?.type === "katakuri_future_sight") {
      const waiting = prompt.forecastRolling || prompt.defenseRolling || !prompt.canChoose;
      refs.infoContent.innerHTML = `
        <section class="battle-command-ui" aria-label="卡塔庫栗預知未來">
          <img class="battle-command-panel-frame" src="images/board/battle_switch_ui/battle_switch_panel_frame.webp" alt="" aria-hidden="true">
          <header class="battle-command-heading">
            <strong>${escapeHtml(prompt.title || "預知未來")}</strong>
            <span>${escapeHtml(prompt.message || "先看預知骰，再決定行動。")}</span>
          </header>
          <div class="battle-command-body">
            <div class="battle-command-empty">
              <img class="battle-command-notice-frame" src="images/board/battle_command_ui/battle_command_notice_frame.webp" alt="" aria-hidden="true">
              <span class="battle-command-notice-copy">
                <strong class="battle-command-notice-name">${prompt.forecastDie ? `卡塔庫栗預知骰：${escapeHtml(prompt.forecastDie)}` : "未來視判定中"}</strong>
                <span class="battle-command-notice-meta">${prompt.defenseRolling ? "防禦骰正在翻滾……" : prompt.forecastRolling ? "不論速度，卡塔庫栗都會先完成預知。" : "相同或更高可突破未來視；低於預知骰則整招失效。"}</span>
              </span>
            </div>
          </div>
          ${waiting ? "" : `<div class="battle-command-body battle-command-grid">
            <button class="battle-command-choice" type="button" data-katakuri-choice="move">
              <img class="battle-command-choice-frame" src="images/board/battle_command_ui/battle_command_choice_button_frame.webp" alt="" aria-hidden="true">
              <span class="battle-command-choice-copy"><strong class="battle-command-choice-name">正面出招</strong><span class="battle-command-choice-meta">回到一般指令；攻擊時才比較第一骰，PP 照常消耗。</span></span>
            </button>
            <button class="battle-command-choice" type="button" data-katakuri-choice="defend">
              <img class="battle-command-choice-frame" src="images/board/battle_command_ui/battle_command_choice_button_frame.webp" alt="" aria-hidden="true">
              <span class="battle-command-choice-copy"><strong class="battle-command-choice-name">防禦</strong><span class="battle-command-choice-meta">放棄本次出招；擲一骰，點數 ×15% 減少直接攻擊傷害。</span></span>
            </button>
          </div>`}
        </section>`;
      refs.infoContent.querySelectorAll("[data-katakuri-choice]").forEach((button) => {
        button.addEventListener("click", () => {
          const choice = button.dataset.katakuriChoice;
          currentMode = choice === "move" ? "attack" : null;
          const accepted = callBattleAction("battleKatakuriChoice", "katakuri-choice", { choice });
          if (accepted === false) {
            currentMode = null;
            return;
          }
          refs.infoContent.querySelectorAll("[data-katakuri-choice]").forEach((entry) => { entry.disabled = true; });
          showStatus(choice === "move" ? "已選擇正面出招；可攻擊、換夥伴、使用道具或逃跑。" : "已放棄行動，正在擲防禦骰。");
        });
      });
      return;
    }
    if (prompt?.type === "oars_lottery") {
      refs.infoPanel?.classList.add("oars-lottery-panel-mode");
      const promptKey = String(prompt.actionKey || `${view?.battle?.roundIndex || 0}:${view?.player?.id || "player"}`);
      if (oarsPendingBetKey !== promptKey) {
        oarsPendingBetKey = promptKey;
        oarsPendingBetStakes.clear();
      }
      const selectedBets = oarsPendingBetStakes;
      const availableSaltBags = Math.max(0, Math.floor(Number(prompt.availableSaltBags || 0)));
      const grouped = (prompt.options || []).reduce((result, option) => {
        const group = option.group || "其他";
        (result[group] ||= []).push(option);
        return result;
      }, {});
      refs.infoContent.innerHTML = `
        <section class="battle-command-ui oars-lottery-ui" aria-label="歐斯鹽袋下注">
          <img class="battle-command-panel-frame" src="images/board/battle_switch_ui/battle_switch_panel_frame.webp" alt="" aria-hidden="true">
          <header class="battle-command-heading"><strong>${escapeHtml(prompt.title)}</strong><span>${escapeHtml(prompt.message)}</span></header>
          <div class="oars-lottery-scroll">
            ${Object.entries(grouped).map(([group, options]) => `<section class="oars-lottery-group"><h3>${escapeHtml(group)}</h3><div class="oars-lottery-grid">${options.map((option) => `<article class="oars-lottery-choice" data-oars-prediction="${escapeHtml(option.id)}"><span>${escapeHtml(option.label)}</span><strong>×${Number(option.payout || 0)}</strong><small>每包命中回收 ×${Number(option.payout || 0)}・命中率 ${Math.max(.1, Number(option.probability || 0) * 100).toFixed(Number(option.probability || 0) < .1 ? 1 : 0)}%${option.detail ? `・${escapeHtml(option.detail)}` : ""}</small><div class="oars-stake-stepper"><button type="button" data-oars-stake-minus aria-label="減少${escapeHtml(option.label)}的鹽袋" ${view.battle.animating ? "disabled" : ""}>−</button><output data-oars-stake-count aria-live="polite">0 包</output><button type="button" data-oars-stake-plus aria-label="增加${escapeHtml(option.label)}的鹽袋" ${view.battle.animating ? "disabled" : ""}>＋</button></div></article>`).join("")}</div></section>`).join("")}
          </div>
          <footer class="oars-betting-footer"><span data-oars-bet-summary>尚未下注・共有 ${availableSaltBags} 包可分配</span><button type="button" data-oars-confirm-bets disabled>確認下注</button></footer>
        </section>`;
      const choiceCards = [...refs.infoContent.querySelectorAll("[data-oars-prediction]")];
      const confirmButton = refs.infoContent.querySelector("[data-oars-confirm-bets]");
      const summary = refs.infoContent.querySelector("[data-oars-bet-summary]");
      const totalSelectedStake = () => [...selectedBets.values()].reduce((sum, stake) => sum + Math.max(0, Number(stake || 0)), 0);
      const refreshBetSelection = () => {
        const totalStake = totalSelectedStake();
        choiceCards.forEach((card) => {
          const optionId = card.dataset.oarsPrediction;
          const stake = Math.max(0, Number(selectedBets.get(optionId) || 0));
          card.classList.toggle("selected", stake > 0);
          card.classList.toggle("at-limit", totalStake >= availableSaltBags && stake === 0);
          card.querySelector("[data-oars-stake-count]").textContent = `${stake} 包`;
          card.querySelector("[data-oars-stake-minus]").disabled = view.battle.animating || stake <= 0;
          card.querySelector("[data-oars-stake-plus]").disabled = view.battle.animating || totalStake >= availableSaltBags;
        });
        confirmButton.disabled = totalStake === 0 || view.battle.animating;
        summary.textContent = totalStake
          ? `已選 ${selectedBets.size} 項・共押 ${totalStake} 包・確認後剩 ${Math.max(0, availableSaltBags - totalStake)} 包`
          : `尚未下注・共有 ${availableSaltBags} 包可分配`;
      };
      choiceCards.forEach((card) => {
        const optionId = card.dataset.oarsPrediction;
        card.querySelector("[data-oars-stake-minus]")?.addEventListener("click", () => {
          const nextStake = Math.max(0, Number(selectedBets.get(optionId) || 0) - 1);
          if (nextStake > 0) selectedBets.set(optionId, nextStake);
          else selectedBets.delete(optionId);
          refreshBetSelection();
        });
        card.querySelector("[data-oars-stake-plus]")?.addEventListener("click", () => {
          if (totalSelectedStake() >= availableSaltBags) showStatus(`目前只有 ${availableSaltBags} 包鹽袋可下注。`);
          else selectedBets.set(optionId, Number(selectedBets.get(optionId) || 0) + 1);
          refreshBetSelection();
        });
      });
      confirmButton?.addEventListener("click", () => {
        const bets = [...selectedBets.entries()].filter(([, stake]) => stake > 0).map(([optionId, stake]) => ({ optionId, stake }));
        const stakeTotal = bets.reduce((sum, bet) => sum + bet.stake, 0);
        if (!bets.length || stakeTotal > availableSaltBags) return;
        const accepted = callBattleAction("battleOarsPrediction", "oars-prediction", { bets });
        if (accepted !== false) {
          refs.infoContent.querySelectorAll("[data-oars-stake-minus], [data-oars-stake-plus]").forEach((entry) => { entry.disabled = true; });
          confirmButton.disabled = true;
          oarsPendingBetStakes.clear();
          showStatus(`已投入 ${stakeTotal} 包鹽袋；現在選擇本回合戰鬥指令。`);
        }
      });
      refreshBetSelection();
      return;
    }
    if (prompt?.type === "oars_purification") {
      refs.infoPanel?.classList.add("oars-lottery-panel-mode", "oars-purification-panel-mode");
      refs.infoContent.innerHTML = `
        <section class="battle-command-ui oars-purification-ui" aria-label="巨型鹽彈完成">
          <img class="battle-command-panel-frame" src="images/board/battle_switch_ui/battle_switch_panel_frame.webp" alt="" aria-hidden="true">
          <header class="battle-command-heading"><strong>${escapeHtml(prompt.title)}</strong><span>${escapeHtml(prompt.message)}</span></header>
          <button type="button" class="oars-purification-action" data-oars-purify>
            <img src="images/board/battle/postgame_mechanics/oars/oars_salt_purification.webp" alt="巨型鹽彈・影子解放">
            <span><strong>巨型鹽彈・影子解放</strong><small>消耗 15 袋巨型鹽，無視生命、防禦、命中與閃避，一擊淨化魔人歐斯。</small></span>
          </button>
        </section>`;
      refs.infoContent.querySelector("[data-oars-purify]")?.addEventListener("click", (event) => {
        event.currentTarget.disabled = true;
        callBattleAction("battleOarsPurify", "oars-purify", {});
        showStatus("巨型鹽彈已發射，正在解放歐斯體內的影子。");
      });
      return;
    }
    if (prompt?.type === "tot_team_setup") {
      refs.infoPanel?.classList.add("tot-musica-team-setup-panel-mode");
      const state = mechanic.state || {};
      const crew = state.crew || [];
      const signature = `${view?.battle?.enemy?.key || mechanic.key}:${crew.map((card) => card.index).join(",")}`;
      if (signature !== totMusicaTeamSelectionSignature) {
        totMusicaTeamSelectionSignature = signature;
        totMusicaTeamPickedIndex = null;
        totMusicaTeamSlots = {
          real: [null, null, null],
          song: [null, null, null],
        };
      }
      const assignCrewToSlot = (crewIndex, world, slotIndex) => {
        const index = Number(crewIndex);
        const targetSlot = Math.max(0, Math.min(2, Number(slotIndex)));
        if (!Number.isInteger(index) || !["real", "song"].includes(world)) return;
        const sourceWorld = ["real", "song"].find((key) => totMusicaTeamSlots[key].includes(index));
        const sourceSlot = sourceWorld ? totMusicaTeamSlots[sourceWorld].indexOf(index) : -1;
        if (sourceWorld === world && sourceSlot === targetSlot) return;
        const displaced = totMusicaTeamSlots[world][targetSlot];
        totMusicaTeamSlots[world][targetSlot] = index;
        if (sourceWorld && sourceSlot >= 0) totMusicaTeamSlots[sourceWorld][sourceSlot] = Number.isInteger(displaced) ? displaced : null;
        totMusicaTeamPickedIndex = null;
      };
      const renderSetup = () => {
        const livingCrew = crew.filter((card) => Number(card.currentHp || 0) > 0).slice(0, 6);
        const realIndices = totMusicaTeamSlots.real.filter(Number.isInteger);
        const songIndices = totMusicaTeamSlots.song.filter(Number.isInteger);
        const assigned = [...realIndices, ...songIndices];
        const valid = realIndices.length > 0
          && songIndices.length > 0
          && Number.isInteger(totMusicaTeamSlots.real[0])
          && Number.isInteger(totMusicaTeamSlots.song[0])
          && assigned.length === livingCrew.length
          && new Set(assigned).size === livingCrew.length
          && Math.abs(realIndices.length - songIndices.length) <= 1;
        const placementOf = (index) => {
          for (const world of ["real", "song"]) {
            const position = totMusicaTeamSlots[world].indexOf(Number(index));
            if (position >= 0) return `${world === "real" ? "左" : "右"}${position + 1}`;
          }
          return "未編排";
        };
        const renderTeamSlots = (world, label) => `
          <section class="tot-musica-team-lane ${world}">
            <header><strong>${label}</strong><span>①先發　②③替補</span></header>
            <div class="tot-musica-team-slot-row">
              ${totMusicaTeamSlots[world].map((crewIndex, slotIndex) => {
                const card = Number.isInteger(crewIndex)
                  ? crew.find((entry) => Number(entry.index) === crewIndex)
                  : null;
                return `<button class="tot-musica-team-slot ${card ? "filled" : "empty"} ${totMusicaTeamPickedIndex === Number(crewIndex) ? "picked" : ""}" type="button" data-tot-team-slot data-tot-team-world="${world}" data-tot-team-position="${slotIndex}" ${card ? `draggable="true" data-tot-crew-index="${card.index}"` : ""}>
                  <span class="tot-musica-team-order">${slotIndex + 1}${slotIndex === 0 ? "・先發" : ""}</span>
                  ${card ? `<img src="${escapeHtml(postgameCrewPortrait(card))}" alt="${escapeHtml(card.name)}"><strong>${escapeHtml(card.name)}</strong><small>HP ${Math.max(0, Number(card.currentHp || 0))}/${Math.max(1, Number(card.maxHp || 1))}</small>` : `<span class="tot-musica-team-empty-copy">拖到這裡</span>`}
                </button>`;
              }).join("")}
            </div>
          </section>`;
        refs.infoContent.innerHTML = `
          <section class="battle-command-ui tot-musica-team-setup-ui" aria-label="Tot Musica 兩隊順位編排">
            <img class="battle-command-panel-frame" src="images/board/battle_switch_ui/battle_switch_panel_frame.webp" alt="" aria-hidden="true">
            <header class="battle-command-heading"><strong>編排兩隊順位</strong><span>拖曳船員；第一格是先發</span></header>
            <div class="tot-musica-team-board">
              ${renderTeamSlots("real", "左隊")}
              ${renderTeamSlots("song", "右隊")}
            </div>
            <div class="tot-musica-team-roster" aria-label="可拖曳船員">
              ${livingCrew.map((card) => `<button class="tot-musica-roster-card ${totMusicaTeamPickedIndex === Number(card.index) ? "picked" : ""}" type="button" draggable="true" data-tot-crew-index="${card.index}"><img src="${escapeHtml(postgameCrewPortrait(card))}" alt="${escapeHtml(card.name)}"><span><strong>${escapeHtml(card.name)}</strong><small>${placementOf(card.index)}</small></span></button>`).join("")}
            </div>
            <button class="postgame-dual-confirm" type="button" data-tot-team-confirm ${valid ? "" : "disabled"}>確認出戰順序</button>
          </section>`;
        refs.infoContent.querySelectorAll("[data-tot-crew-index]").forEach((button) => {
          button.addEventListener("dragstart", (event) => {
            const index = Number(button.dataset.totCrewIndex);
            event.dataTransfer?.setData("text/plain", String(index));
            if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
          });
          button.addEventListener("click", () => {
            totMusicaTeamPickedIndex = Number(button.dataset.totCrewIndex);
            renderSetup();
          });
        });
        refs.infoContent.querySelectorAll("[data-tot-team-slot]").forEach((slot) => {
          slot.addEventListener("dragover", (event) => {
            event.preventDefault();
            slot.classList.add("drag-over");
          });
          slot.addEventListener("dragleave", () => slot.classList.remove("drag-over"));
          slot.addEventListener("drop", (event) => {
            event.preventDefault();
            const index = Number(event.dataTransfer?.getData("text/plain"));
            assignCrewToSlot(index, slot.dataset.totTeamWorld, Number(slot.dataset.totTeamPosition));
            renderSetup();
          });
          slot.addEventListener("click", () => {
            if (Number.isInteger(totMusicaTeamPickedIndex)) {
              assignCrewToSlot(totMusicaTeamPickedIndex, slot.dataset.totTeamWorld, Number(slot.dataset.totTeamPosition));
              renderSetup();
              return;
            }
            const index = Number(slot.dataset.totCrewIndex);
            if (Number.isInteger(index)) {
              totMusicaTeamPickedIndex = index;
              renderSetup();
            }
          });
        });
        refs.infoContent.querySelector("[data-tot-team-confirm]")?.addEventListener("click", () => {
          callBattleAction("battleTotTeamSetup", "tot-team-setup", {
            realIndices: totMusicaTeamSlots.real.filter(Number.isInteger),
            songIndices: totMusicaTeamSlots.song.filter(Number.isInteger),
          });
          showStatus("分隊已送出。");
        });
      };
      renderSetup();
    }
  }
function renderJudicialSwitchPrompt(view) {
    if (window.TabletopPhoneBattleRender && !window.TabletopPhoneBattleRender.begin(refs.infoContent, "renderJudicialSwitchPrompt", [view, actionDisabled(view), viewerCanControlBattle(view)])) return;
    refs.infoPanel?.classList.remove("is-hidden");
    refs.infoTitle.textContent = "";
    const prompt = view?.battle?.judicialSwitchPrompt || {};
    const candidates = (prompt.candidates || []).filter((card) => card.currentHp > 0);
    if (!candidates.length) {
      refs.infoContent.innerHTML = `<div class="empty-state">沒有可上場的夥伴，無法進入下一戰。</div>`;
      return;
    }
    rememberPanelScroll("judicialSwitch");
    refs.infoContent.innerHTML = `
      <div class="battle-result-box judicial-switch-box">
        <div class="battle-result-title">下一戰：${escapeHtml(prompt.nextEnemyName || "下一名敵人")}</div>
        <div class="battle-result-reward-line">選擇要派上場的夥伴。可以維持目前角色，也可以換成場下隊友。</div>
      </div>
      <div class="partner-scroll"><div class="partner-grid">
        ${candidates.map((card) => `
          <button class="choice-button" type="button" data-judicial-switch-index="${escapeHtml(card.index)}">
            <div class="choice-name">${escapeHtml(card.name)}${card.index === prompt.currentIndex ? "・目前上場" : ""}</div>
            <div class="choice-meta">Lv.${escapeHtml(card.level || 1)} ・ ${escapeHtml(card.attribute || "")}</div>
            <div class="choice-meta">HP ${escapeHtml(card.currentHp)}/${escapeHtml(card.maxHp)} ・ 剩餘 PP ${escapeHtml(card.totalPP)}</div>
          </button>
        `).join("")}
      </div></div>
    `;
    refs.infoContent.querySelectorAll("[data-judicial-switch-index]").forEach((button) => {
      button.addEventListener("click", () => {
        callBattleAction("battleJudicialNextSwitch", "judicial-next-switch", { nextIndex: Number(button.dataset.judicialSwitchIndex) });
        currentMode = null;
        renderClosedPanel();
        showStatus("已選擇下一戰上場角色。");
      });
    });
    restorePanelScroll("judicialSwitch");
  }
return {render(view){if(view.battle.judicialSwitchPrompt)renderJudicialSwitchPrompt(view);else renderPostgameBossPrompt(view,view.battle.postgameBossMechanic);},mode:()=>currentMode};
};
