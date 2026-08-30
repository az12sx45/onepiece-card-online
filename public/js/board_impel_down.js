(function () {
  const SNAPSHOT_KEY = "onepiece-board-impel-down-snapshot-v1";
  const COMMAND_KEY = "onepiece-board-impel-down-command-v1";
  const COMMAND_RESULT_KEY = "onepiece-board-impel-down-command-result-v1";
  const EVENT_SPIN_MS = 2550;
  const EVENT_REVEAL_MS = 3000;
  const RECRUIT_SPIN_MS = 5000;
  const RECRUIT_REVEAL_MS = 3000;
  const SPIN_SETTLE_MS = 2550;
  const DICE_ROLL_MS = 1800;
  const DICE_REVEAL_MS = 3000;
  const MAX_RECRUIT_BOOST = 5;
  const RECRUIT_RAIL_COUNT = 29;
  const RECRUIT_RAIL_WIN_INDEX = 18;
  const REWARD_SLOT_TARGET_INDEX = 26;
  const PENDING_COMMAND_FLAG = "__impelPendingCommand";
  const UI_ASSETS = Object.freeze({
    floorRow: "images/board/impel_down_ui/impel_down_floor_row_frame.webp",
    eventRow: "images/board/impel_down_ui/impel_down_event_roulette_row_frame.webp",
    eventResults: Object.freeze({
      patrol: "images/board/impel_down_ui/impel_down_event_result_patrol.webp",
      key: "images/board/impel_down_ui/impel_down_event_result_key.webp",
      magellan: "images/board/impel_down_ui/impel_down_event_result_magellan.webp",
      ivankov: "images/board/impel_down_ui/impel_down_event_result_ivankov.webp",
      hidden: "images/board/impel_down_ui/impel_down_event_result_hidden.webp",
    }),
    eventIcons: Object.freeze({
      patrol: "images/board/impel_down_ui/event_icons/patrol.webp",
      key: "images/board/impel_down_ui/event_icons/key.webp",
      magellan: "images/board/impel_down_ui/event_icons/magellan.webp",
      ivankov: "images/board/impel_down_ui/event_icons/ivankov.webp",
      hidden: "images/board/impel_down_ui/event_icons/hidden.webp",
      unknown: "images/board/impel_down_ui/event_icons/unknown.webp",
    }),
    waitEvent: "images/board/impel_down_ui/impel_down_state_wait_event.webp",
    moveChoice: "images/board/impel_down_ui/impel_down_state_move_choice.webp",
    moveEscapeChoice: "images/board/impel_down_ui/impel_down_state_move_escape_choice.webp",
    escaped: "images/board/impel_down_ui/impel_down_state_escaped.webp",
    prisonerCard: "images/board/impel_down_ui/impel_down_prisoner_candidate_card_frame.webp",
    prisonerRoulette: "images/board/impel_down_ui/impel_down_prisoner_draw_roulette_panel_frame_v3.webp",
  });
  const FALLBACK_EVENTS = [
    { id: "patrol", title: "獄卒巡邏", symbol: "戰" },
    { id: "key", title: "找到鑰匙", symbol: "鑰" },
    { id: "magellan", title: "麥哲倫警戒", symbol: "毒" },
    { id: "ivankov", title: "伊娃科夫通道", symbol: "癒" },
    { id: "hidden", title: "隱藏囚犯", symbol: "囚" },
  ];

  const $ = (id) => document.getElementById(id);
  let view = null;
  let localDice = null;
  let localSpin = null;
  let pendingAction = false;
  let teamModalOpen = false;
  let diceTimer = 0;
  let deferredRenderTimer = 0;

  function boardApi() {
    try {
      if (window.__BOARD_GAME_DEBUG__) {
        return window.__BOARD_GAME_DEBUG__;
      }
      if (window.parent && window.parent !== window && window.parent.__BOARD_GAME_DEBUG__) {
        return window.parent.__BOARD_GAME_DEBUG__;
      }
      if (window.opener && !window.opener.closed && window.opener.__BOARD_GAME_DEBUG__) {
        return window.opener.__BOARD_GAME_DEBUG__;
      }
    } catch (_error) {
      return null;
    }
    return null;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatCoin(value) {
    return Number(value || 0).toLocaleString("zh-Hant-TW");
  }

  function readSnapshot() {
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (!raw) return null;
      return JSON.parse(raw)?.view || null;
    } catch (_error) {
      return null;
    }
  }

  function writeCommand(type, payload = {}) {
    const command = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      payload,
      createdAt: Date.now(),
    };
    try {
      localStorage.setItem(COMMAND_KEY, JSON.stringify(command));
    } catch (_error) {
      // The parent iframe bridge is the primary path; localStorage is only a fallback.
    }
    return command;
  }

  function apiCall(name, type, payload = {}) {
    const api = boardApi();
    try {
      if (api && typeof api[name] === "function") {
        if (name === "impelMove") return api[name](payload.direction);
        if (name === "impelSelectRecruit") return api[name](payload.prisonerId);
        if (name === "impelSwitchLeader") return api[name](payload.index);
        return api[name](payload);
      }
    } catch (error) {
      console.warn("Impel Down bridge command failed:", name, error);
    }
    return { ...writeCommand(type, payload), [PENDING_COMMAND_FLAG]: true };
  }

  function isPendingCommand(result) {
    return Boolean(result?.[PENDING_COMMAND_FLAG]);
  }

  function readCommandResult(commandId) {
    if (!commandId) return null;
    try {
      const raw = localStorage.getItem(COMMAND_RESULT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.commandId === commandId ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  function inferCommandResult(commandType) {
    const latest = requestView();
    if (commandType === "drawEvent") return latest?.event || null;
    if (commandType === "drawRecruit") {
      const id = latest?.lastRecruitId || "";
      const recruit = (latest?.recruits || []).find((entry) => entry.id === id) || null;
      return recruit ? { recruit, pool: latest?.recruits || [] } : null;
    }
    return null;
  }

  function resolveCommandResult(result, timeout = 2400) {
    if (!isPendingCommand(result)) return Promise.resolve(result);
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const finish = (entry) => {
        window.clearInterval(timer);
        pendingAction = false;
        if (entry?.view) view = entry.view;
        render();
        resolve(entry?.result ?? inferCommandResult(result.type));
      };
      pendingAction = true;
      render();
      const timer = window.setInterval(() => {
        const entry = readCommandResult(result.id);
        if (entry) {
          finish(entry);
          return;
        }
        if (Date.now() - startedAt >= timeout) {
          finish(null);
        }
      }, 40);
    });
  }

  function requestView() {
    const api = boardApi();
    let next = null;
    try {
      next = api?.getImpelDownView?.() || null;
    } catch (_error) {
      next = null;
    }
    view = next || readSnapshot() || view;
    render();
    return view;
  }

  function currentRule() {
    return view?.rule || { level: 1, rank: "E", name: "紅蓮地獄", accent: "#c8413d", glow: "rgba(200,65,61,.32)" };
  }

  function statusLabel() {
    const status = view?.status || "locked";
    if (localSpin?.type === "event") return "轉盤中";
    if (localSpin?.type === "recruit") return "招募中";
    if (localDice?.rolling) return localDice.revealed ? "骰子揭曉" : "擲骰中";
    if (status === "locked") return "關押中";
    if (status === "wait_event") return "下回合抽事件";
    if (status === "free") return "可行動";
    if (status === "event") return "事件處理";
    if (status === "move") return "選擇方向";
    if (status === "recruit") return "招募中";
    if (status === "escaped") return "已逃出";
    return "推進城";
  }

  function shouldShowEventPanel() {
    return true;
  }

  function commandState() {
    const status = view?.status || "locked";
    const eventId = view?.event?.id || "";
    const busy = Boolean(localSpin || localDice?.rolling);
    if (pendingAction && !busy) {
      return {
        title: "同步抽選結果",
        text: "正在讀取主流程的實際結果。",
        primary: "處理中",
        secondary: "處理中",
        third: "處理中",
        disablePrimary: true,
        disableSecondary: true,
        disableThird: true,
      };
    }
    if (busy) {
      const spinResult = localSpin?.items?.find?.((entry) => entry.id === localSpin.resultId) || localSpin?.result || null;
      return {
        title: localDice
          ? (localDice.revealed ? `骰出 ${localDice.roll}${Number(localDice.bonus || 0) ? ` + ${localDice.bonus} = ${localDice.total}` : ""}` : "出籠骰轉動中")
          : localSpin?.settled
            ? (localSpin.type === "recruit" ? `招募成功：${spinResult?.name || "隱藏囚犯"}` : `抽到：${spinResult?.title || "推進城事件"}`)
            : (localSpin.type === "recruit" ? "招募轉盤抽選中" : "事件轉盤抽選中"),
        text: localDice
          ? (localDice.revealed
            ? (localDice.success ? "骰面停留 3 秒後結束判定。" : `失敗，下次逃籠骰 +${localDice.nextBonus || 1}。`)
            : "數字高速變換中，停下才揭曉結果。")
          : localSpin?.settled
            ? (localSpin.type === "recruit" ? `${spinResult?.name || "隱藏囚犯"} 加入船團。` : "停住的事件就是本次結果。")
            : "轉盤停止後會顯示結果。",
        primary: localDice ? "擲骰中" : "抽選中",
        secondary: "處理中",
        third: "處理中",
        disablePrimary: true,
        disableSecondary: true,
        disableThird: true,
      };
    }
    if (status === "locked") {
      const bonus = Math.max(0, Number(view?.escapeBonus || 0));
      return { title: `${view?.playerName || "玩家"} 擲逃籠骰`, text: `需要 ${view?.level || 1}+。${bonus ? `目前補正 +${bonus}。` : "骰出成功才會打開牢籠。"}`, primary: "擲逃籠骰", secondary: "等待", third: "往上", disableThird: true };
    }
    if (status === "free" || status === "wait_event") {
      return { title: `${view?.groupName || view?.playerName || "隊伍"} 抽事件`, text: "當前玩家抽事件並決定路線；隱藏囚犯由各玩家在自己的回合個別抽取。", primary: "抽事件", secondary: "等待", third: "往上", disableThird: true, disablePrimary: status === "wait_event" };
    }
    if (status === "event") {
      if (eventId === "patrol") return { title: view.event.title, text: view.event.summary || "開始推進城戰鬥。", primary: "開始戰鬥", secondary: "戰鬥失敗", third: "往上", disableThird: true };
      if (eventId === "magellan") return { title: view.event.title, text: view.event.summary || "直接挑戰麥哲倫。", primary: "挑戰麥哲倫", secondary: "挑戰失敗", third: "往上", disableThird: true };
      if (eventId === "key") return { title: view.event.title, text: "選擇往上逃出，或往下去找救援 / 囚犯。", primary: "選擇移動", secondary: "不移動", third: "往上", disableThird: true };
      if (eventId === "ivankov") return { title: view.event.title, text: "全隊 HP / 技能次數回滿。", primary: "完全治癒", secondary: "離開", third: "往上", disableThird: true };
      if (eventId === "hidden") return { title: view.event.title, text: "依所在層數解鎖囚犯抽池，可先花貝里提高指定角色機率。", primary: "開啟抽池", secondary: "放棄", third: "往上", disableThird: true };
      return { title: view.event?.title || "推進城事件", text: view.event?.summary || "選擇結果。", primary: "確認", secondary: "放棄", third: "往上", disableThird: true };
    }
    if (status === "move") {
      return { title: "選擇移動方向", text: "往上是 LEVEL -1，往下是 LEVEL +1；只有已組隊成員會一起行動。", primary: "往上", secondary: Number(view?.level || 1) >= 6 ? "不移動" : "往下", third: "直接逃出", disableThird: !view?.allowEscape };
    }
    if (status === "recruit") {
      return { title: "隱藏囚犯招募", text: "花貝里抽選；可先提高指定角色機率。", primary: "花貝里抽", secondary: "提高機率", third: "放棄", disableThird: false };
    }
    if (status === "escaped") {
      return { title: "已逃出推進城", text: "返回地圖後繼續航海。", primary: "返回地圖", secondary: "返回地圖", third: "往上", disableThird: true };
    }
    return { title: "推進城", text: "選擇行動。", primary: "確認", secondary: "等待", third: "往上", disableThird: true };
  }

  function eventIcon(entry) {
    const id = UI_ASSETS.eventIcons[entry?.id] ? entry.id : "unknown";
    const label = entry?.title || entry?.name || "推進城事件";
    return `<img src="${UI_ASSETS.eventIcons[id]}" alt="${escapeHtml(label)}">`;
  }

  function eventLabel(entry) {
    return escapeHtml(entry?.title || entry?.name || "");
  }

  function staticEventArtPath() {
    const status = view?.status || "";
    if (status === "event") return UI_ASSETS.eventResults[view?.event?.id] || "";
    if (status === "wait_event") return UI_ASSETS.waitEvent;
    if (status === "move") return view?.allowEscape ? UI_ASSETS.moveEscapeChoice : UI_ASSETS.moveChoice;
    if (status === "escaped") return UI_ASSETS.escaped;
    return "";
  }

  function staticEventArtMarkup(path) {
    if (!path) return "";
    return `<div class="static-event-result"><img class="static-event-scene" src="${path}" alt="" aria-hidden="true"></div>`;
  }

  function normalizeEventItems(items) {
    const list = Array.isArray(items) && items.length ? items : FALLBACK_EVENTS;
    return list.map((entry) => ({
      ...(FALLBACK_EVENTS.find((fallback) => fallback.id === entry?.id) || {}),
      ...entry,
    }));
  }

  function reelItemKey(entry) {
    return String(entry?.id || entry?.title || entry?.name || "");
  }

  function pickReelItem(source, previous, avoid = null, offset = 0) {
    const safeSource = Array.isArray(source) && source.length ? source : [previous, avoid].filter(Boolean);
    const previousKey = reelItemKey(previous);
    const avoidKey = reelItemKey(avoid);
    const preferred = safeSource.filter((entry) => {
      const key = reelItemKey(entry);
      return key && key !== previousKey && (!avoidKey || safeSource.length <= 2 || key !== avoidKey);
    });
    const fallback = safeSource.filter((entry) => reelItemKey(entry) !== previousKey);
    const pool = preferred.length ? preferred : (fallback.length ? fallback : safeSource);
    return pool[(Math.floor(Math.random() * pool.length) + offset) % pool.length] || safeSource[0] || avoid || previous || null;
  }

  function rewardReelItems(items, target) {
    const safeItems = Array.isArray(items) && items.length ? items : [target].filter(Boolean);
    const winner = target || safeItems[0];
    const reelItems = [];
    for (let index = 0; index < REWARD_SLOT_TARGET_INDEX; index += 1) {
      const avoidWinnerNeighbor = index === REWARD_SLOT_TARGET_INDEX - 1 ? winner : null;
      reelItems.push(pickReelItem(safeItems, reelItems[reelItems.length - 1], avoidWinnerNeighbor, index));
    }
    if (safeItems.length > 1 && reelItemKey(reelItems[reelItems.length - 1]) === reelItemKey(winner)) {
      reelItems[reelItems.length - 1] = pickReelItem(safeItems, reelItems[reelItems.length - 2], winner, REWARD_SLOT_TARGET_INDEX);
    }
    reelItems.push(winner);
    for (let index = 0; index < safeItems.length; index += 1) {
      reelItems.push(pickReelItem(safeItems, reelItems[reelItems.length - 1], null, index));
    }
    return reelItems;
  }

  function rewardSpinMarkup(items, type, resultId, options = {}) {
    const safeItems = type === "event"
      ? normalizeEventItems(items)
      : (Array.isArray(items) && items.length ? items : [{ id: "empty", title: "空", symbol: "?" }]);
    const target = safeItems.find((item) => item.id === resultId) || safeItems[0];
    const itemHeight = 60;
    const viewportHeight = 140;
    const slotEnd = -((REWARD_SLOT_TARGET_INDEX * itemHeight) - ((viewportHeight - itemHeight) / 2));
    const reelItems = Array.isArray(options.reelItems) && options.reelItems.length
      ? options.reelItems
      : rewardReelItems(safeItems, target);
    const slots = reelItems.map((entry, index) => `
      <div class="reward-slot-item ${index === REWARD_SLOT_TARGET_INDEX ? "is-winning" : ""}">
        ${type === "event" ? `<img class="reward-slot-row-frame" src="${UI_ASSETS.eventRow}" alt="" aria-hidden="true">` : ""}
        <span class="reward-slot-icon">${eventIcon(entry)}</span>
        <span class="reward-slot-label">${eventLabel(entry)}</span>
      </div>
    `).join("");
    const title = type === "recruit" ? "招募！" : "抽選！";
    const kicker = type === "recruit" ? "推進城隱藏囚犯" : "推進城事件";
    const label = type === "recruit" ? "囚犯抽選中" : "事件抽選中";
    const desc = type === "recruit" ? "補給箱高速轉動中，停住後揭曉招募角色。" : "補給箱高速轉動中，停住後揭曉事件。";
    return `
      <div class="reward-spin ${type === "recruit" ? "recruit-reward" : "event-reward"} ${options.settled ? "settled" : ""}">
        <div class="reward-clear">${title}</div>
        <div class="reward-card">
          <div class="reward-slot-shell">
            <div class="reward-slot-pointer"></div>
            <div class="reward-reel" style="--slot-end:${slotEnd}px;--target-index:${REWARD_SLOT_TARGET_INDEX};--spin-duration:${SPIN_SETTLE_MS - 850}ms">${slots}</div>
            <div class="reward-slot-center"><img src="${type === "recruit" ? UI_ASSETS.eventIcons.hidden : UI_ASSETS.eventIcons.unknown}" alt="${type === "recruit" ? "囚犯招募" : "事件抽選"}"></div>
          </div>
          <div class="reward-text">
            <div class="reward-kicker">${kicker}</div>
            <div class="reward-label">${label}</div>
            <div class="reward-desc">${desc}</div>
          </div>
        </div>
      </div>
    `;
  }

  function recruitRailItemAt(items, index) {
    return items[index % items.length];
  }

  function recruitRailItems(items, result) {
    const source = Array.isArray(items) && items.length ? items : [result].filter(Boolean);
    const railItems = [];
    for (let index = 0; index < RECRUIT_RAIL_COUNT; index += 1) {
      let offset = 0;
      let candidate = index === RECRUIT_RAIL_WIN_INDEX ? result : recruitRailItemAt(source, index);
      const cannotBeResultNeighbor = index === RECRUIT_RAIL_WIN_INDEX - 1 || index === RECRUIT_RAIL_WIN_INDEX + 1;
      while (
        source.length > 1 &&
        (
          (railItems.length && candidate?.name === railItems[railItems.length - 1]?.name) ||
          (cannotBeResultNeighbor && candidate?.name === result?.name)
        )
      ) {
        offset += 1;
        candidate = recruitRailItemAt(source, index + offset);
      }
      railItems.push(candidate || result || source[0]);
    }
    return railItems;
  }

  function recruitRailSpinMarkup(items, resultId, settled = false, presetRail = null) {
    const source = Array.isArray(items) && items.length ? items : (view?.recruits || []);
    const result = source.find((recruit) => recruit.id === resultId) || source[0];
    if (!result) return rewardSpinMarkup(source, "recruit", resultId);
    const railItems = Array.isArray(presetRail) && presetRail.length ? presetRail : recruitRailItems(source, result);
    const rail = railItems.map((recruit, index) => `
      <span class="recruit-rail-token${index === RECRUIT_RAIL_WIN_INDEX ? " win" : ""}" data-rail-index="${index}">
        <img class="recruit-rail-token-frame" src="${UI_ASSETS.prisonerCard}" alt="" aria-hidden="true">
        <span class="recruit-rail-token-portrait"><img src="${escapeHtml(recruit.image || "")}" alt="${escapeHtml(recruit.name || "")}"></span>
        <span class="recruit-rail-token-copy"><b>${escapeHtml(recruit.name || "")}</b><small>LEVEL ${Number(recruit.unlockLevel || recruit.unlock || 1)}</small></span>
      </span>
    `).join("");
    const odds = (view?.recruits || []).map((recruit) => {
      const available = source.some((entry) => entry.id === recruit.id);
      return `<span>${available ? `L${recruit.unlockLevel || recruit.unlock} ${Math.round(Number(recruit.odds || 0))}%` : `L${recruit.unlockLevel || recruit.unlock} -`}</span>`;
    }).join("");
    return `
      <div class="rail-recruit-spin ${settled ? "revealed" : "spinning"}" style="--recruit-rail-duration:${RECRUIT_SPIN_MS}ms;--win-index:${RECRUIT_RAIL_WIN_INDEX}">
        <section class="recruit-rail-machine" aria-label="懸賞木牌軌角色招募">
          <img class="recruit-roulette-frame-art" src="${UI_ASSETS.prisonerRoulette}" alt="" aria-hidden="true">
          <div class="recruit-rail-title"><span>推進城隱藏囚犯</span><b>07 懸賞木牌軌</b></div>
          <div class="recruit-rail-status">${settled ? `停下：${escapeHtml(result.name)}` : "招募中..."}</div>
          <div class="recruit-rail-window"><div class="recruit-rail-track">${rail}</div></div>
          <div class="recruit-rail-pointer"></div>
          <div class="recruit-rail-odds">${odds}</div>
          <div class="recruit-rail-result">
            <span class="recruit-rail-result-portrait"><img src="${escapeHtml(result.image || "")}" alt="${escapeHtml(result.name || "")}"></span>
            <span class="recruit-rail-result-copy"><strong>${escapeHtml(result.name)}</strong><span>LEVEL ${result.unlockLevel || result.unlock} 解鎖</span><span>招募成功</span></span>
          </div>
          <div class="recruit-rail-scan"></div>
        </section>
      </div>
    `;
  }

  function renderFloors() {
    const floorList = $("floorList");
    if (!floorList) return;
    const floors = (view?.floors || []).slice().sort((a, b) => Number(a.level || 0) - Number(b.level || 0));
    floorList.innerHTML = floors.map((floor) => {
      const names = Array.isArray(floor.occupants) && floor.occupants.length ? floor.occupants.join("、") : "無人";
      return `
        <button class="floor-row${floor.active ? " active" : ""}" type="button" data-floor="${floor.level}">
          <img class="floor-row-frame" src="${UI_ASSETS.floorRow}" alt="" aria-hidden="true">
          <span class="floor-number">${floor.level}</span>
          <span class="floor-copy">
            <strong>LEVEL ${floor.level} ${escapeHtml(floor.name || "")}</strong>
            <span class="occupants">${escapeHtml(names)}</span>
          </span>
          <span class="floor-rank">${escapeHtml(floor.rank || "")}級</span>
        </button>
      `;
    }).join("");
  }

  function renderRecruits() {
    const grid = $("prisonerGrid");
    if (!grid) return;
    const recruits = view?.recruits || [];
    const focusId = view?.focusRecruitId || recruits.find((entry) => entry.available)?.id || recruits[0]?.id || "";
    grid.innerHTML = recruits.map((recruit) => {
      const locked = !recruit.unlocked;
      const joined = recruit.joined;
      const selected = recruit.id === focusId;
      const odds = `${Math.round(Number(recruit.odds || 0))}%`;
      return `
        <button class="prisoner-card${selected ? " selected" : ""}${locked ? " locked" : ""}${joined ? " joined" : ""}" type="button" data-recruit="${escapeHtml(recruit.id)}" ${locked || joined ? "disabled" : ""}>
          <img class="prisoner-card-frame" src="${UI_ASSETS.prisonerCard}" alt="" aria-hidden="true">
          <span class="prisoner-portrait"><img src="${escapeHtml(recruit.image || "")}" alt="${escapeHtml(recruit.name || "")}"></span>
          <span class="prisoner-name">${escapeHtml(recruit.name || "")}</span>
          <span class="prisoner-level">L${Number(recruit.unlockLevel || 1)}</span>
          <span class="prisoner-meta">${escapeHtml(recruit.attribute || "")} ・ ${escapeHtml(recruit.roleType || "")}</span>
          <span class="prisoner-passive">${escapeHtml(recruit.passive || "")}</span>
          <span class="prisoner-odds">${joined ? "已加入" : locked ? "未解鎖" : odds}</span>
          <span class="prisoner-boost">+${Number(recruit.boost || 0) * 4}%</span>
        </button>
      `;
    }).join("");
    grid.querySelectorAll("[data-recruit]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        apiCall("impelSelectRecruit", "selectRecruit", { prisonerId: button.dataset.recruit });
        window.setTimeout(requestView, 40);
      }, { capture: true });
    });
  }

  function selectedRecruit() {
    const recruits = view?.recruits || [];
    return recruits.find((entry) => entry.id === view?.focusRecruitId) || recruits.find((entry) => entry.available) || recruits[0] || null;
  }

  function availableRecruitPool() {
    const pool = Array.isArray(view?.recruitPool) && view.recruitPool.length
      ? view.recruitPool
      : (view?.recruits || []).filter((entry) => entry.available && !entry.joined);
    return pool.filter((entry) => entry && entry.available !== false && !entry.joined);
  }

  function normalizeRecruitResult(result) {
    const recruit = result?.recruit || result;
    if (recruit?.id) {
      return {
        recruit,
        pool: Array.isArray(result?.pool) && result.pool.length ? result.pool : availableRecruitPool(),
        pending: false,
      };
    }
    return null;
  }

  function localDiceResult(result) {
    if (result && Number.isFinite(Number(result.roll))) {
      return { ...result, pending: false };
    }
    return null;
  }

  function renderRecruitModal() {
    const modal = $("recruitModal");
    if (!modal) return;
    const show = view?.status === "recruit" || localSpin?.type === "recruit";
    modal.hidden = !show;
    const selected = selectedRecruit();
    const poolCount = (view?.recruits || []).filter((entry) => entry.available).length;
    if ($("recruitPoolText")) $("recruitPoolText").textContent = `解鎖囚犯 ${poolCount} 人`;
    if ($("recruitWalletText")) $("recruitWalletText").textContent = formatCoin(view?.coins || 0);
    if ($("recruitDetailImg")) $("recruitDetailImg").src = selected?.image || "";
    if ($("recruitDetailName")) $("recruitDetailName").textContent = selected?.name || "無可招募囚犯";
    if ($("recruitDetailMeta")) $("recruitDetailMeta").textContent = selected ? `LEVEL ${selected.unlockLevel} 解鎖 ・ ${selected.attribute} ・ ${selected.roleType}` : "無";
    if ($("recruitOddsText")) $("recruitOddsText").textContent = selected?.available ? `${Math.round(Number(selected.odds || 0))}%` : "0%";
    if ($("recruitBoostText")) $("recruitBoostText").textContent = `${Number(selected?.boost || 0)} / ${MAX_RECRUIT_BOOST}`;
    if ($("recruitBoostCostText")) $("recruitBoostCostText").textContent = formatCoin(selected?.boostCost || 0);
    if ($("recruitFeeText")) $("recruitFeeText").textContent = formatCoin(view?.drawCost || 0);
    const canDraw = Boolean(selected?.available) && Number(view?.coins || 0) >= Number(view?.drawCost || 0) && !localSpin && !pendingAction;
    const canBoost = Boolean(selected?.available) && Number(selected.boost || 0) < MAX_RECRUIT_BOOST && Number(view?.coins || 0) >= Number(selected.boostCost || 0) && !localSpin && !pendingAction;
    if ($("modalRecruitBtn")) $("modalRecruitBtn").disabled = !canDraw;
    if ($("modalBoostBtn")) $("modalBoostBtn").disabled = !canBoost;
    if ($("modalSkipBtn")) $("modalSkipBtn").disabled = Boolean(localSpin || pendingAction);
  }

  function renderTeamModal() {
    const modal = $("teamModal");
    const body = $("teamModalBody");
    if (!modal || !body) return;
    const team = view?.team || {};
    if (localSpin || localDice?.rolling || pendingAction) teamModalOpen = false;
    modal.hidden = !teamModalOpen;
    if (!teamModalOpen) return;
    const members = Array.isArray(team.members) && team.members.length
      ? team.members
      : [{ id: view?.playerId || "", name: view?.playerName || "玩家" }];
    const pendingInvite = team.pendingInvite || null;
    const outgoingInvite = team.outgoingInvite || null;
    const candidates = Array.isArray(team.candidates) ? team.candidates : [];
    const memberRows = members.map((entry) => `
      <div class="team-player-row">
        <strong>${escapeHtml(entry.name || "玩家")}</strong>
        <small>${String(entry.id || "") === String(view?.playerId || "") ? "目前回合玩家" : "組隊成員"}</small>
      </div>
    `).join("");
    let invitationMarkup = "";
    if (pendingInvite) {
      invitationMarkup = `
        <section class="team-section">
          <h2>收到組隊邀請</h2>
          <p>${escapeHtml(pendingInvite.fromPlayerName || "玩家")} 邀請你在 LEVEL ${Number(pendingInvite.floor || view?.level || 1)} 組隊。接受後，本回合仍可正常行動。</p>
          <div class="team-player-row">
            <strong>${escapeHtml(pendingInvite.fromPlayerName || "玩家")}</strong>
            <span><button class="team-action" type="button" data-team-accept>接受</button> <button class="team-action alt" type="button" data-team-decline>拒絕</button></span>
          </div>
        </section>
      `;
    } else if (outgoingInvite) {
      invitationMarkup = `
        <section class="team-section">
          <h2>等待對方回覆</h2>
          <p>已邀請 ${escapeHtml(outgoingInvite.targetPlayerName || "玩家")}；對方輪到自己的回合時可以接受或拒絕。</p>
        </section>
      `;
    } else {
      invitationMarkup = `
        <section class="team-section">
          <h2>同樓層玩家</h2>
          <p>發出邀請會結束本回合；對方同意後才會加入小隊。</p>
          <div class="team-player-list">
            ${candidates.length ? candidates.map((entry) => `
              <div class="team-player-row">
                <span><strong>${escapeHtml(entry.name || "玩家")}</strong><br><small>LEVEL ${Number(entry.level || view?.level || 1)}</small></span>
                <button class="team-action" type="button" data-team-invite="${escapeHtml(entry.id || "")}">發出邀請</button>
              </div>
            `).join("") : `<p>目前沒有可邀請的同樓層玩家。</p>`}
          </div>
        </section>
      `;
    }
    body.innerHTML = `
      <section class="team-section">
        <h2>${team.formed ? "目前小隊" : "尚未組隊"}</h2>
        <p>${team.formed ? "當前回合玩家負責抽事件與決定路線；戰鬥時依序交棒。" : "同樓層不會自動成隊。"}</p>
        <div class="team-player-list">${memberRows}</div>
      </section>
      ${invitationMarkup}
    `;
    body.querySelector("[data-team-accept]")?.addEventListener("click", (event) => {
      event.preventDefault();
      apiCall("impelAcceptTeamInvite", "acceptTeamInvite");
      window.setTimeout(requestView, 50);
    });
    body.querySelector("[data-team-decline]")?.addEventListener("click", (event) => {
      event.preventDefault();
      apiCall("impelDeclineTeamInvite", "declineTeamInvite");
      window.setTimeout(requestView, 50);
    });
    body.querySelectorAll("[data-team-invite]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        apiCall("impelInvitePlayer", "invitePlayer", { playerId: button.dataset.teamInvite });
        teamModalOpen = false;
        window.setTimeout(requestView, 50);
      });
    });
  }

  function renderEvent(cmd = commandState()) {
    const eventArt = $("eventArt");
    if (!eventArt) return;
    const title = $("eventRevealTitle");
    const copy = $("eventRevealCopy");
    if (title) title.textContent = cmd?.title || "推進城事件";
    if (copy) copy.textContent = cmd?.text || "等待事件揭曉。";
    if (localSpin?.type === "event") {
      const key = `event:${localSpin.resultId}:${(localSpin.reelItems || []).map((entry) => entry?.id || entry?.title || entry?.name || "").join("|")}`;
      if (eventArt.dataset.spinKey === key && eventArt.querySelector(".reward-spin")) {
        eventArt.querySelector(".reward-spin")?.classList.toggle("settled", Boolean(localSpin.settled));
        return;
      }
      eventArt.dataset.spinKey = key;
      eventArt.innerHTML = rewardSpinMarkup(localSpin.items, "event", localSpin.resultId, {
        settled: localSpin.settled,
        reelItems: localSpin.reelItems,
      });
    } else if (localSpin?.type === "recruit") {
      const key = `recruit:${localSpin.resultId}:${(localSpin.railItems || []).map((entry) => entry?.id || entry?.name || "").join("|")}`;
      if (eventArt.dataset.spinKey === key && eventArt.querySelector(".rail-recruit-spin")) {
        const root = eventArt.querySelector(".rail-recruit-spin");
        root?.classList.toggle("spinning", !localSpin.settled);
        root?.classList.toggle("revealed", Boolean(localSpin.settled));
        const status = eventArt.querySelector(".recruit-rail-status");
        if (status) status.textContent = localSpin.settled ? `停下：${localSpin.result?.name || "隱藏囚犯"}` : "招募中...";
        return;
      }
      eventArt.dataset.spinKey = key;
      eventArt.innerHTML = recruitRailSpinMarkup(localSpin.items, localSpin.resultId, localSpin.settled, localSpin.railItems);
    } else if (localDice?.rolling) {
      eventArt.dataset.spinKey = "";
      eventArt.innerHTML = "";
    } else {
      eventArt.dataset.spinKey = "";
      eventArt.innerHTML = staticEventArtMarkup(staticEventArtPath());
    }
  }

  function render() {
    if (!view) return;
    const rule = currentRule();
    document.documentElement.style.setProperty("--level", rule.accent || "#d85c32");
    document.documentElement.style.setProperty("--level-soft", rule.glow || "rgba(216,92,50,.32)");
    const screen = document.querySelector(".screen");
    const frame = $("frame");
    if (screen && rule.image) {
      screen.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.46)), url("${rule.image}")`;
    }
    if (frame) frame.style.backgroundImage = "none";
    frame?.classList.toggle("panel-hidden", !shouldShowEventPanel());
    frame?.classList.toggle("escape-dice-active", Boolean(localDice?.rolling));
    frame?.classList.toggle("escape-dice-revealed", Boolean(localDice?.revealed));
    frame?.classList.toggle("recruit-spin-active", localSpin?.type === "recruit");

    const status = view.status || "locked";
    const cageFree = status !== "locked";
    if ($("rankSeal")) $("rankSeal").textContent = rule.rank || "E";
    if ($("floorTitle")) $("floorTitle").textContent = status === "escaped" ? "推進城出口" : `LEVEL ${view.level || rule.level} ${rule.name || ""}`;
    if ($("squadText")) $("squadText").textContent = view.groupName || view.playerName || "";
    if ($("phaseText")) $("phaseText").textContent = statusLabel();
    if ($("groupCount")) $("groupCount").textContent = view?.team?.pendingInvite ? "邀請待回覆" : `${view.groupCount || 1}人`;
    if ($("coinText")) $("coinText").textContent = formatCoin(view.coins || 0);
    const focus = selectedRecruit();
    if ($("focusText")) $("focusText").textContent = focus && view.status === "recruit" ? `${focus.name} +${Number(focus.boost || 0) * 4}%` : "無";
    if ($("floorHint")) $("floorHint").textContent = view?.team?.formed ? "已組隊，當前玩家決定路線" : "同層可邀請組隊";
    if ($("teamBtn")) {
      $("teamBtn").classList.toggle("has-invite", Boolean(view?.team?.pendingInvite));
      $("teamBtn").disabled = Boolean(localSpin || localDice?.rolling || pendingAction);
    }
    if ($("diceFace")) $("diceFace").textContent = localDice?.value || "?";
    $("diceFace")?.classList.toggle("roll", Boolean(localDice?.rolling && !localDice?.revealed));
    $("diceFace")?.classList.toggle("revealed", Boolean(localDice?.rolling && localDice?.revealed));

    const cage = $("cage");
    cage?.classList.toggle("free", cageFree);
    cage?.classList.toggle("locked", status === "locked");
    $("stamp")?.classList.toggle("show", status === "wait_event");
    if ($("stamp")) $("stamp").textContent = "出籠";
    const captain = view.captain || {};
    const captainImg = $("captainImg");
    if (captainImg) {
      captainImg.alt = captain.name || "隊長";
      captainImg.onerror = () => {
        if (captain.fallbackImage && captainImg.src !== captain.fallbackImage) {
          captainImg.src = captain.fallbackImage;
          return;
        }
        cage?.classList.add("fallback");
      };
      captainImg.src = status === "locked" ? (captain.weakImage || captain.image || "") : (captain.image || captain.fallbackImage || "");
    }
    const captainFallbackImg = $("captainFallback")?.querySelector("img");
    if (captainFallbackImg) captainFallbackImg.alt = captain.name || view.playerName || "未知隊長";

    const cmd = commandState();
    if ($("commandTitle")) $("commandTitle").textContent = cmd.title;
    if ($("commandText")) $("commandText").textContent = cmd.text;
    if ($("primaryBtn")) {
      $("primaryBtn").textContent = cmd.primary;
      $("primaryBtn").disabled = Boolean(cmd.disablePrimary);
    }
    if ($("secondaryBtn")) {
      $("secondaryBtn").textContent = cmd.secondary;
      $("secondaryBtn").disabled = Boolean(cmd.disableSecondary);
    }
    if ($("thirdBtn")) {
      $("thirdBtn").textContent = cmd.third;
      $("thirdBtn").disabled = Boolean(cmd.disableThird);
    }
    if ($("resetBtn")) $("resetBtn").textContent = "返回地圖";
    renderFloors();
    renderRecruits();
    renderRecruitModal();
    renderTeamModal();
    renderEvent(cmd);
  }

  function rerenderAfter(delay = 80) {
    window.clearTimeout(deferredRenderTimer);
    deferredRenderTimer = window.setTimeout(requestView, delay);
  }

  function animateEventSpin(eventResult) {
    if (!eventResult && !view?.event) {
      rerenderAfter(80);
      return;
    }
    const items = normalizeEventItems(view?.events || eventResult?.items);
    const resultId = eventResult?.id || eventResult?.event?.id || view?.event?.id || items[0]?.id || "";
    const result = items.find((entry) => entry.id === resultId) || items[0] || null;
    localSpin = {
      type: "event",
      items,
      resultId,
      result,
      reelItems: rewardReelItems(items, result),
      settled: false,
    };
    render();
    window.setTimeout(() => {
      if (localSpin) localSpin.settled = true;
      render();
      window.setTimeout(() => {
        localSpin = null;
        requestView();
      }, EVENT_REVEAL_MS);
    }, EVENT_SPIN_MS);
  }

  function animateRecruitSpin(result) {
    const resolved = normalizeRecruitResult(result);
    const recruit = resolved?.recruit || null;
    if (!recruit) {
      rerenderAfter(80);
      return;
    }
    const spinItems = resolved.pool || availableRecruitPool();
    localSpin = {
      type: "recruit",
      items: spinItems,
      resultId: recruit.id,
      result: recruit,
      railItems: recruitRailItems(spinItems, recruit),
      settled: false,
      pending: Boolean(resolved.pending),
    };
    render();
    window.setTimeout(() => {
      if (localSpin) localSpin.settled = true;
      render();
      window.setTimeout(() => {
        localSpin = null;
        requestView();
        apiCall("impelEndTurn", "endTurn");
      }, RECRUIT_REVEAL_MS);
    }, RECRUIT_SPIN_MS);
  }

  function animateDiceRoll(result) {
    const resolved = localDiceResult(result);
    if (!resolved) {
      rerenderAfter(80);
      return;
    }
    window.clearInterval(diceTimer);
    localDice = {
      rolling: true,
      revealed: false,
      roll: resolved.roll,
      bonus: Number(resolved.bonus || 0),
      total: Number(resolved.total || resolved.roll || 0),
      success: Boolean(resolved.success),
      nextBonus: Number(resolved.nextBonus || 0),
      value: "?",
      pending: Boolean(resolved.pending),
    };
    let tick = 0;
    diceTimer = window.setInterval(() => {
      tick += 1;
      localDice.value = String(((tick + Number(resolved.roll || 1)) % 6) + 1);
      render();
    }, 86);
    render();
    window.setTimeout(() => {
      window.clearInterval(diceTimer);
      localDice.value = String(resolved.roll || "?");
      localDice.revealed = true;
      render();
      window.setTimeout(() => {
        const success = Boolean(resolved.success);
        const wasPending = Boolean(resolved.pending);
        localDice = null;
        const syncedView = requestView();
        if ((!wasPending && !success) || (wasPending && syncedView?.status === "locked")) apiCall("impelEndTurn", "endTurn");
      }, DICE_REVEAL_MS);
    }, DICE_ROLL_MS);
  }

  async function primaryAction(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (localSpin || localDice?.rolling || pendingAction) return;
    const status = view?.status || "locked";
    if (status === "locked") animateDiceRoll(await resolveCommandResult(apiCall("impelRollEscape", "rollEscape")));
    else if (status === "free") animateEventSpin(await resolveCommandResult(apiCall("impelDrawEvent", "drawEvent")));
    else if (status === "event") {
      apiCall("impelResolveEventPrimary", "resolveEventPrimary");
      rerenderAfter(80);
    } else if (status === "move") {
      apiCall("impelMove", "move", { direction: "up" });
      rerenderAfter(80);
    } else if (status === "recruit") {
      animateRecruitSpin(await resolveCommandResult(apiCall("impelDrawRecruit", "drawRecruit")));
    } else if (status === "escaped") {
      apiCall("impelClose", "close");
    }
  }

  function secondaryAction(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (localSpin || localDice?.rolling || pendingAction) return;
    const status = view?.status || "locked";
    if (status === "event") {
      apiCall("impelResolveEventSecondary", "resolveEventSecondary");
      rerenderAfter(80);
    } else if (status === "move") {
      apiCall("impelMove", "move", { direction: "down" });
      rerenderAfter(80);
    } else if (status === "recruit") {
      apiCall("impelBoostRecruit", "boostRecruit");
      rerenderAfter(80);
    } else {
      apiCall("impelEndTurn", "endTurn");
    }
  }

  function thirdAction(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (localSpin || localDice?.rolling || pendingAction) return;
    if (view?.status === "move" && view?.allowEscape) {
      apiCall("impelDirectEscape", "directEscape");
      rerenderAfter(80);
    } else if (view?.status === "recruit") {
      apiCall("impelSkipRecruit", "skipRecruit");
      rerenderAfter(80);
    }
  }

  function closeAction(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (pendingAction) return;
    apiCall("impelClose", "close");
  }

  function bindButton(id, handler) {
    const el = $(id);
    if (!el) return;
    el.addEventListener("click", handler, true);
  }

  function bindButtons() {
    bindButton("primaryBtn", primaryAction);
    bindButton("secondaryBtn", secondaryAction);
    bindButton("thirdBtn", thirdAction);
    bindButton("resetBtn", closeAction);
    bindButton("teamBtn", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (localSpin || localDice?.rolling || pendingAction) return;
      teamModalOpen = !teamModalOpen;
      render();
    });
    bindButton("teamCloseBtn", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      teamModalOpen = false;
      render();
    });
    bindButton("modalBoostBtn", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!localSpin && !pendingAction) {
        apiCall("impelBoostRecruit", "boostRecruit");
        rerenderAfter(80);
      }
    });
    bindButton("modalRecruitBtn", async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!localSpin && !pendingAction) animateRecruitSpin(await resolveCommandResult(apiCall("impelDrawRecruit", "drawRecruit")));
    });
    bindButton("modalSkipBtn", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!localSpin && !pendingAction) {
        apiCall("impelSkipRecruit", "skipRecruit");
        rerenderAfter(80);
      }
    });
  }

  window.addEventListener("message", (event) => {
    if (event?.data?.type !== "board-impel-down-update") return;
    if (!localSpin && !localDice?.rolling) requestView();
  });
  window.addEventListener("storage", (event) => {
    if (event.key === SNAPSHOT_KEY && !localSpin && !localDice?.rolling) requestView();
  });
  window.__IMPEL_DOWN_DEBUG__ = {
    previewEventSpin(resultId = "magellan", settled = true) {
      const eventArt = $("eventArt");
      if (!eventArt) return false;
      const items = normalizeEventItems(FALLBACK_EVENTS);
      eventArt.innerHTML = rewardSpinMarkup(items, "event", resultId, { settled });
      return true;
    },
  };
  window.addEventListener("load", () => {
    bindButtons();
    requestView();
    window.setInterval(() => {
      if (!localSpin && !localDice?.rolling) requestView();
    }, 800);
  });
})();
