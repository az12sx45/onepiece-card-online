(function () {
  const document = window.document;
  if (!document) return;

  const UI_ROOT = "images/board/lineage_extraction_ui/";
  const SLOT_COUNT = 7;
  const SLOT_STEP = 360 / SLOT_COUNT;
  const TERMINAL = new Set(["success", "failure", "declined", "unavailable"]);
  const DIFFICULTIES = {
    ED: { count: 8, duration: 1350, size: 27, perfect: .09, good: .24, lockDuration: 4800, lockPerfect: .07, lockGood: .18, sealDuration: 5000, sealPerfect: .045, sealGood: .12 },
    CB: { count: 9, duration: 1180, size: 25.5, perfect: .08, good: .21, lockDuration: 3900, lockPerfect: .06, lockGood: .155, sealDuration: 4100, sealPerfect: .04, sealGood: .105 },
    A: { count: 10, duration: 1040, size: 24, perfect: .07, good: .19, lockDuration: 3100, lockPerfect: .052, lockGood: .13, sealDuration: 3200, sealPerfect: .034, sealGood: .088 },
    S: { count: 12, duration: 900, size: 22.5, perfect: .06, good: .17, lockDuration: 2300, lockPerfect: .043, lockGood: .105, sealDuration: 2400, sealPerfect: .028, sealGood: .072 },
    // SS／SSS 保留原抽取階級與成功率，但三階段操作難度以 S 為上限。
    SS: { count: 12, duration: 900, size: 22.5, perfect: .06, good: .17, lockDuration: 2300, lockPerfect: .043, lockGood: .105, sealDuration: 2400, sealPerfect: .028, sealGood: .072 },
    SSS: { count: 12, duration: 900, size: 22.5, perfect: .06, good: .17, lockDuration: 2300, lockPerfect: .043, lockGood: .105, sealDuration: 2400, sealPerfect: .028, sealGood: .072 },
  };
  const EXTRACTOR_VISUALS = {
    lineage_extractor_standard: {
      image: "lineage_extractor_standard_launcher_v2.webp",
      start: "-90deg",
      fire: "0deg",
      artOffsetY: "12%",
      cylinderScale: 1.25,
      cylinderOffsetY: "11%",
      cylinderClip: "inset(15% 10% 35% 10%)",
      colors: ["#fff8c9", "#57eee1", "#2c93b3", "73 232 221"],
    },
    lineage_extractor_precision: {
      image: "lineage_extractor_precision.webp",
      start: "0deg",
      fire: "90deg",
      cylinderClip: "inset(4% 5% 4% 5%)",
      colors: ["#ffffff", "#a8f8ff", "#58b9d2", "142 242 250"],
    },
    lineage_extractor_resonance_power: {
      image: "lineage_extractor_resonance_power.webp",
      start: "0deg",
      fire: "90deg",
      cylinderClip: "inset(3% 10% 4% 10%)",
      colors: ["#fff0c0", "#ff554f", "#9f1322", "255 72 68"],
    },
    lineage_extractor_resonance_skill: {
      image: "lineage_extractor_resonance_skill.webp",
      start: "0deg",
      fire: "90deg",
      cylinderClip: "inset(2% 5% 2% 5%)",
      colors: ["#f3ffff", "#55dff5", "#297bc6", "76 218 244"],
    },
    lineage_extractor_resonance_speed: {
      image: "lineage_extractor_resonance_speed_launcher_v2.webp",
      start: "-90deg",
      fire: "0deg",
      cylinderScale: 1.25,
      cylinderClip: "inset(18% 10% 18% 10%)",
      colors: ["#ffffff", "#51e9f3", "#ec4bdd", "79 226 238"],
    },
    lineage_extractor_ability: {
      image: "lineage_extractor_ability.webp",
      start: "0deg",
      fire: "90deg",
      cylinderClip: "inset(3% 10% 3% 10%)",
      colors: ["#fff0ff", "#c86aff", "#6120a8", "190 87 255"],
    },
    lineage_extractor_emperor: {
      image: "lineage_extractor_emperor.webp",
      start: "0deg",
      fire: "90deg",
      cylinderClip: "inset(1% 6% 5% 6%)",
      colors: ["#fff1c5", "#f53d65", "#a30f32", "246 54 91"],
    },
  };

  const state = {
    view: null,
    extraction: null,
    scopeKey: "",
    attemptId: "",
    mode: "",
    dismissedScopeKey: "",
    selectedExtractorId: "",
    slots: [],
    cylinderTurns: 0,
    cylinderVelocity: 0,
    cylinderFrame: 0,
    cylinderLastAt: 0,
    dragging: false,
    dragY: 0,
    minigameStarted: false,
    phase: 0,
    grades: [],
    phaseOneCount: 0,
    phaseOnePoints: 0,
    phaseOneMisses: 0,
    phaseOneCombo: 0,
    targetPositions: [],
    targetTimer: 0,
    phaseFrame: 0,
    phaseStartedAt: 0,
    frozenProgress: 0,
    outcomePlaying: false,
    timers: new Set(),
    sendStart: null,
    sendComplete: null,
    sendDecline: null,
    sendDismiss: null,
  };

  function later(callback, delay) {
    const timer = window.setTimeout(() => {
      state.timers.delete(timer);
      callback();
    }, delay);
    state.timers.add(timer);
    return timer;
  }

  function clearActivity() {
    state.timers.forEach((timer) => window.clearTimeout(timer));
    state.timers.clear();
    window.clearTimeout(state.targetTimer);
    state.targetTimer = 0;
    window.cancelAnimationFrame(state.phaseFrame);
    state.phaseFrame = 0;
    window.cancelAnimationFrame(state.cylinderFrame);
    state.cylinderFrame = 0;
    state.cylinderVelocity = 0;
    state.cylinderLastAt = 0;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureRoot() {
    let root = document.getElementById("lineageExtractionRoot");
    if (root) return root;
    root = document.createElement("section");
    root.id = "lineageExtractionRoot";
    root.className = "lineage-extraction-root";
    root.setAttribute("aria-live", "polite");
    root.innerHTML = `
      <p class="lineage-extraction-kicker">LINEAGE FACTOR EXTRACTION</p>
      <h2 class="lineage-extraction-title"><span data-lineage-title>戰後血統因子抽取</span><span class="lineage-extraction-rank" data-lineage-rank>ED</span></h2>
      <section class="lineage-extraction-panel" data-lineage-panel></section>
      <section class="lineage-battle-panels" data-lineage-battle-panels hidden>
        <section class="lineage-battle-panel info">
          <img class="lineage-battle-panel-frame" src="images/board/battle_switch_ui/battle_switch_panel_frame.webp" alt="" aria-hidden="true">
          <div class="lineage-battle-panel-title" data-lineage-info-title>戰鬥紀錄</div>
          <div class="lineage-battle-panel-copy" data-lineage-info-copy></div>
        </section>
        <section class="lineage-battle-panel action">
          <img class="lineage-battle-panel-frame" src="images/board/battle_switch_ui/battle_switch_panel_frame.webp" alt="" aria-hidden="true">
          <div class="lineage-battle-panel-title" data-lineage-action-title>血統因子提取</div>
          <div class="lineage-battle-panel-copy" data-lineage-action-copy></div>
        </section>
      </section>
      <section class="lineage-cylinder-scene" data-lineage-cylinder hidden>
        <div class="lineage-cylinder-viewport" data-lineage-cylinder-viewport aria-hidden="true">
          <div class="lineage-cylinder-rotator" data-lineage-rotator>
            <img class="lineage-cylinder-art" src="${UI_ROOT}lineage_extractor_cylinder_7_slot.webp" alt="">
            <div class="lineage-cylinder-slots" data-lineage-slots></div>
          </div>
        </div>
        <div class="lineage-launcher-showcase">
          <div class="lineage-track-beam" data-lineage-track-beam aria-hidden="true"><div class="lineage-beam-line"></div></div>
          <img class="lineage-launcher-frame" src="${UI_ROOT}lineage_extractor_launcher_frame_v2.webp" alt="" aria-hidden="true">
          <div class="lineage-launcher-bay" aria-hidden="true">
            <div class="lineage-launcher-rotor">
              <img class="lineage-launcher-device" data-lineage-launcher-device alt="">
            </div>
          </div>
          <button class="lineage-launcher-aperture" type="button" data-lineage-lock aria-label="確認目前抽取器"></button>
          <div class="lineage-cylinder-caption"><strong data-lineage-selected-name></strong><span data-lineage-selected-detail></span></div>
        </div>
        <p class="lineage-cylinder-instruction" data-lineage-cylinder-instruction>上下滑動或滾輪旋轉七連彈巢；點一下左側圓框立即停輪選定。</p>
      </section>
      <section class="lineage-minigame-hud" data-lineage-hud hidden>
        <div class="lineage-stage-status" data-lineage-stage-status>
          <div class="lineage-stage-stat"><span data-lineage-stat-label="0">目標</span><strong data-lineage-stat-value="0">等待</strong></div>
          <div class="lineage-stage-stat"><span data-lineage-stat-label="1">COMBO</span><strong data-lineage-stat-value="1">0</strong></div>
          <div class="lineage-stage-stat"><span data-lineage-stat-label="2">MISS</span><strong data-lineage-stat-value="2">0／3</strong></div>
        </div>
        <strong data-lineage-phase-title>第一階段</strong>
        <p data-lineage-phase-hint></p>
        <div class="lineage-grade-strip" data-lineage-grades></div>
      </section>
      <section class="lineage-outcome" data-lineage-outcome hidden>
        <img class="lineage-outcome-launcher" data-lineage-outcome-launcher alt="血統因子抽取器">
        <div class="lineage-target-beam" data-lineage-target-beam>
          <div class="lineage-beam-line"></div>
          <div class="lineage-sample-core"></div>
        </div>
        <div class="lineage-impact" data-lineage-impact></div>
        <div class="lineage-containment-pips" data-lineage-containment-pips aria-hidden="true"><span></span><span></span><span></span></div>
        <div class="lineage-outcome-status" data-lineage-outcome-status>抽取器充能中……</div>
        <button class="lineage-outcome-next" type="button" data-lineage-outcome-next hidden>查看抽取結果</button>
      </section>
    `;
    document.getElementById("battleStage")?.appendChild(root);
    root.querySelector("[data-lineage-lock]")?.addEventListener("click", handleCylinderAperturePress);
    const cylinderScene = root.querySelector("[data-lineage-cylinder]");
    cylinderScene?.addEventListener("wheel", (event) => {
      if (state.mode !== "cylinder") return;
      event.preventDefault();
      const delta = event.deltaY || event.deltaX || 1;
      const steps = Math.max(1, Math.min(10, Math.round(Math.abs(delta) / 85)));
      rotateCylinder(delta > 0 ? 1 : -1, steps);
    }, { passive: false });
    cylinderScene?.addEventListener("pointerdown", (event) => {
      if (state.mode !== "cylinder" || event.target.closest("button")) return;
      state.dragging = true;
      state.dragY = event.clientY;
      cylinderScene.classList.add("is-dragging");
      cylinderScene.setPointerCapture?.(event.pointerId);
    });
    cylinderScene?.addEventListener("pointermove", (event) => {
      if (!state.dragging) return;
      const delta = event.clientY - state.dragY;
      state.dragY = event.clientY;
      state.cylinderTurns += delta / 95;
      state.cylinderVelocity = delta / 2100;
      updateCylinder();
    });
    const stopDrag = () => {
      if (!state.dragging) return;
      state.dragging = false;
      cylinderScene?.classList.remove("is-dragging");
      startCylinderMotion();
    };
    cylinderScene?.addEventListener("pointerup", stopDrag);
    cylinderScene?.addEventListener("pointercancel", stopDrag);
    window.addEventListener("resize", () => {
      fitStageToViewport();
      positionCylinder();
      positionOutcomeBeam();
    });
    window.visualViewport?.addEventListener("resize", handleViewportGeometryChange);
    window.visualViewport?.addEventListener("scroll", handleViewportGeometryChange);
    window.addEventListener("keydown", (event) => {
      if (state.mode !== "cylinder") return;
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        rotateCylinder(1);
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        rotateCylinder(-1);
      }
    });
    return root;
  }

  function refs() {
    const root = ensureRoot();
    return {
      root,
      stage: document.getElementById("battleStage"),
      enemyWrap: document.getElementById("enemyPortraitWrap"),
      enemyCard: document.getElementById("enemyCard"),
      panel: root.querySelector("[data-lineage-panel]"),
      battlePanels: root.querySelector("[data-lineage-battle-panels]"),
      infoTitle: root.querySelector("[data-lineage-info-title]"),
      infoCopy: root.querySelector("[data-lineage-info-copy]"),
      actionTitle: root.querySelector("[data-lineage-action-title]"),
      actionCopy: root.querySelector("[data-lineage-action-copy]"),
      cylinder: root.querySelector("[data-lineage-cylinder]"),
      cylinderViewport: root.querySelector("[data-lineage-cylinder-viewport]"),
      rotator: root.querySelector("[data-lineage-rotator]"),
      slots: root.querySelector("[data-lineage-slots]"),
      launcherShowcase: root.querySelector(".lineage-launcher-showcase"),
      launcherBay: root.querySelector(".lineage-launcher-bay"),
      launcherRotor: root.querySelector(".lineage-launcher-rotor"),
      trackBeam: root.querySelector("[data-lineage-track-beam]"),
      selectedName: root.querySelector("[data-lineage-selected-name]"),
      selectedDetail: root.querySelector("[data-lineage-selected-detail]"),
      cylinderInstruction: root.querySelector("[data-lineage-cylinder-instruction]"),
      launcherDevice: root.querySelector("[data-lineage-launcher-device]"),
      hud: root.querySelector("[data-lineage-hud]"),
      phaseTitle: root.querySelector("[data-lineage-phase-title]"),
      phaseHint: root.querySelector("[data-lineage-phase-hint]"),
      grades: root.querySelector("[data-lineage-grades]"),
      statLabels: [...root.querySelectorAll("[data-lineage-stat-label]")],
      statValues: [...root.querySelectorAll("[data-lineage-stat-value]")],
      outcome: root.querySelector("[data-lineage-outcome]"),
      targetBeam: document.querySelector("[data-lineage-target-beam]"),
      impact: document.querySelector("[data-lineage-impact]"),
      containmentPips: document.querySelector("[data-lineage-containment-pips]"),
      outcomeLauncher: root.querySelector("[data-lineage-outcome-launcher]"),
      outcomeStatus: root.querySelector("[data-lineage-outcome-status]"),
      outcomeNext: root.querySelector("[data-lineage-outcome-next]"),
    };
  }

  function applyTheme(extractorId) {
    const visual = EXTRACTOR_VISUALS[extractorId] || EXTRACTOR_VISUALS.lineage_extractor_standard;
    const root = ensureRoot();
    const themedNodes = [
      root,
      document.querySelector("[data-lineage-target-beam]"),
      document.querySelector("[data-lineage-impact]"),
      document.querySelector("[data-lineage-containment-pips]"),
    ].filter(Boolean);
    themedNodes.forEach((node) => {
      node.style.setProperty("--lineage-beam-core", visual.colors[0]);
      node.style.setProperty("--lineage-beam-mid", visual.colors[1]);
      node.style.setProperty("--lineage-beam-edge", visual.colors[2]);
      node.style.setProperty("--lineage-glow-rgb", visual.colors[3]);
    });
    root.style.setProperty("--launcher-start", visual.start);
    root.style.setProperty("--launcher-fire", visual.fire);
    root.style.setProperty("--launcher-art-y", visual.artOffsetY || "0%");
    return visual;
  }

  function openRoot() {
    const ui = refs();
    ui.root.classList.add("is-open");
    ui.stage?.classList.add("lineage-extraction-active");
    fitStageToViewport();
  }

  function closeRoot() {
    const ui = refs();
    ui.root.classList.remove("is-open");
    ui.root.classList.remove(
      "is-battle-layout",
      "is-cylinder",
      "is-cylinder-selection",
      "is-cylinder-locked",
      "is-minigame",
      "is-outcome",
      "is-outcome-locked",
      "is-outcome-charging",
      "is-outcome-firing",
      "is-outcome-testing",
      "is-outcome-success",
      "is-outcome-failure"
    );
    ui.stage?.classList.remove("lineage-extraction-active");
    ui.stage?.classList.remove("lineage-extraction-battle-layout", "lineage-extraction-operation");
    ui.stage?.classList.remove("lineage-viewport-fitted");
    ui.stage?.style.removeProperty("--lineage-stage-scale");
    ui.stage?.style.removeProperty("--lineage-stage-left");
    ui.stage?.style.removeProperty("--lineage-stage-top");
    ui.enemyCard?.classList.remove(
      "lineage-outcome-firing",
      "lineage-outcome-testing",
      "lineage-outcome-success",
      "lineage-outcome-failure",
      "lineage-sample-secured",
      "lineage-sample-rejected"
    );
    ui.enemyWrap?.querySelector(".lineage-target-layer")?.remove();
    if (ui.targetBeam && ui.targetBeam.parentElement !== ui.outcome) ui.outcome.appendChild(ui.targetBeam);
    if (ui.targetBeam) ui.targetBeam.className = "lineage-target-beam";
    if (ui.outcomeNext) ui.outcomeNext.hidden = true;
    clearActivity();
  }

  function setHeader() {
    const root = ensureRoot();
    const extraction = state.extraction;
    root.querySelector("[data-lineage-title]").textContent = `${extraction?.enemy?.name || "敵人"}・血統因子抽取`;
    root.querySelector("[data-lineage-rank]").textContent = extraction?.rank || "ED";
  }

  function hideSections() {
    const ui = refs();
    ui.root.classList.remove(
      "is-battle-layout",
      "is-cylinder",
      "is-cylinder-selection",
      "is-cylinder-locked",
      "is-minigame",
      "is-outcome",
      "is-outcome-locked",
      "is-outcome-charging",
      "is-outcome-firing",
      "is-outcome-testing",
      "is-outcome-success",
      "is-outcome-failure"
    );
    ui.stage?.classList.remove("lineage-extraction-battle-layout", "lineage-extraction-operation");
    ui.panel.hidden = true;
    ui.battlePanels.hidden = true;
    ui.cylinder.hidden = true;
    ui.hud.hidden = true;
    ui.outcome.hidden = true;
    ui.outcome.className = "lineage-outcome";
    if (ui.targetBeam && ui.targetBeam.parentElement !== ui.outcome) ui.outcome.appendChild(ui.targetBeam);
    if (ui.targetBeam) ui.targetBeam.className = "lineage-target-beam";
    if (ui.impact && ui.impact.parentElement !== ui.outcome) ui.outcome.appendChild(ui.impact);
    if (ui.containmentPips && ui.containmentPips.parentElement !== ui.outcome) ui.outcome.appendChild(ui.containmentPips);
    if (ui.outcomeNext) ui.outcomeNext.hidden = true;
    ui.enemyCard?.classList.remove(
      "lineage-outcome-firing",
      "lineage-outcome-testing",
      "lineage-outcome-success",
      "lineage-outcome-failure",
      "lineage-sample-secured",
      "lineage-sample-rejected"
    );
    ui.enemyWrap?.querySelector(".lineage-target-layer")?.remove();
  }

  function showBattleLayout() {
    const ui = refs();
    ui.root.classList.add("is-battle-layout");
    ui.stage?.classList.add("lineage-extraction-battle-layout");
    ui.stage?.classList.remove("lineage-extraction-operation");
    ui.battlePanels.hidden = false;
  }

  function showOperationLayout() {
    const ui = refs();
    ui.root.classList.remove("is-battle-layout");
    ui.stage?.classList.remove("lineage-extraction-battle-layout");
    ui.stage?.classList.add("lineage-extraction-operation");
    ui.battlePanels.hidden = true;
  }

  function imageButton(label, action, danger = false, disabled = false) {
    return `
      <button
        class="lineage-image-button${danger ? " danger" : ""}"
        type="button"
        data-lineage-action="${escapeHtml(action)}"
        ${disabled ? "disabled" : ""}
      ><span>${escapeHtml(label)}</span></button>
    `;
  }

  function renderBattleLog(message, detail = "") {
    const ui = refs();
    const enemyName = state.extraction?.enemy?.name || "敵人";
    ui.infoTitle.textContent = "戰鬥紀錄";
    ui.infoCopy.innerHTML = `
      <div class="lineage-battle-log">
        <strong>${escapeHtml(enemyName)} 已被擊破。</strong>
        <span>${escapeHtml(message)}</span>
        ${detail ? `<span>${escapeHtml(detail)}</span>` : ""}
      </div>
    `;
  }

  function setStageStats(labels, values) {
    const ui = refs();
    ui.statLabels.forEach((node, index) => {
      node.textContent = labels[index] || "";
    });
    ui.statValues.forEach((node, index) => {
      const value = values[index] == null ? "—" : String(values[index]);
      node.textContent = /^(perfect|good|miss)$/i.test(value) ? value.toUpperCase() : value;
    });
  }

  function renderOffer() {
    const ui = refs();
    const extraction = state.extraction;
    const entry = extraction?.entry;
    hideSections();
    openRoot();
    setHeader();
    showBattleLayout();
    renderBattleLog(
      "敵人角色框會保留到玩家完成是否提取的決定。",
      extraction.canControl
        ? "選擇不要提取不會消耗抽取器，敵人將照原戰鬥流程退場。"
        : `正在等待 ${entry?.playerName || "參戰玩家"} 決定是否進行提取。`
    );
    ui.actionTitle.textContent = extraction.canControl ? "是否進行血統因子提取？" : "等待抽取決定";
    ui.actionCopy.className = "lineage-battle-panel-copy";
    ui.actionCopy.innerHTML = `
      <div class="lineage-hint-line">${
        extraction.canControl
          ? "持有可用抽取器。進入選擇畫面不會立即消耗，鎖定抽取器後才會扣除 1 個。"
          : `目前只能觀看 ${escapeHtml(entry?.playerName || "參戰玩家")} 的選擇。`
      }</div>
      <div class="lineage-prompt-actions">
        ${imageButton("進行提取", "proceed", false, !extraction.canControl)}
        ${imageButton("不要提取", "decline", true, !extraction.canControl)}
      </div>
    `;
    const proceedButton = ui.actionCopy.querySelector('[data-lineage-action="proceed"]');
    const declineButton = ui.actionCopy.querySelector('[data-lineage-action="decline"]');
    proceedButton?.setAttribute("data-lineage-proceed", "");
    declineButton?.setAttribute("data-lineage-decline", "");
    proceedButton?.addEventListener("click", renderCylinder);
    declineButton?.addEventListener("click", () => {
      ui.actionCopy.querySelectorAll("button").forEach((button) => { button.disabled = true; });
      state.sendDecline?.(extraction.playerId);
    });
    state.mode = "offer";
  }

  function selectedSlotIndex() {
    return ((Math.round(state.cylinderTurns) % SLOT_COUNT) + SLOT_COUNT) % SLOT_COUNT;
  }

  function selectedExtractor() {
    return state.slots[selectedSlotIndex()] || state.slots[0] || null;
  }

  function buildCylinderSlots(extractors) {
    const available = Array.isArray(extractors) ? extractors.filter((entry) => Number(entry.count || 0) > 0) : [];
    state.slots = Array.from({ length: SLOT_COUNT }, (_, index) => available[index % Math.max(1, available.length)] || null);
    const ui = refs();
    ui.slots.innerHTML = state.slots.map((entry, index) => {
      const angle = -90 + index * SLOT_STEP;
      const radians = angle * Math.PI / 180;
      const left = 50 + Math.cos(radians) * 29.3;
      const top = 50 + Math.sin(radians) * 29.3;
      const visual = EXTRACTOR_VISUALS[entry?.id] || EXTRACTOR_VISUALS.lineage_extractor_standard;
      return entry ? `
        <div class="lineage-cylinder-slot" data-lineage-slot="${index}" style="left:${left}%;top:${top}%;--lineage-slot-glow:${visual.colors[3]}">
          <div class="lineage-cylinder-device-upright">
            <div class="lineage-cylinder-device-orient" style="--lineage-device-angle:${visual.start}">
              <img
                src="${UI_ROOT}${escapeHtml(visual.image)}"
                alt="${escapeHtml(entry.name)}"
                style="--lineage-art-scale:${visual.cylinderScale || 1};--lineage-art-y:${visual.cylinderOffsetY || "0%"};--lineage-art-clip:${visual.cylinderClip || "none"}"
              >
            </div>
          </div>
        </div>
      ` : "";
    }).join("");
  }

  function ensureLockedCylinder(entry) {
    const extractorId = entry?.extractorId || state.selectedExtractorId;
    if (!extractorId) return;
    if (!state.slots.some((slot) => slot?.id === extractorId)) {
      const visual = EXTRACTOR_VISUALS[extractorId] || EXTRACTOR_VISUALS.lineage_extractor_standard;
      const current = (state.extraction?.extractors || []).find((item) => item.id === extractorId) || {
        id: extractorId,
        name: entry?.extractorName || "血統因子抽取器",
        image: `${UI_ROOT}${visual.image}`,
        count: 1,
        bonus: Number(entry?.extractorBonus || 0),
      };
      const others = (state.extraction?.extractors || []).filter((item) => item.id !== extractorId);
      buildCylinderSlots([current, ...others]);
    }
    const selectedIndex = Math.max(0, state.slots.findIndex((slot) => slot?.id === extractorId));
    state.cylinderTurns = selectedIndex;
    state.cylinderVelocity = 0;
    state.selectedExtractorId = extractorId;
    updateCylinder();
    const ui = refs();
    const visual = applyTheme(extractorId);
    if (ui.launcherDevice) {
      ui.launcherDevice.src = `${UI_ROOT}${visual.image}`;
      ui.launcherDevice.alt = entry?.extractorName || "";
    }
    if (ui.selectedName) ui.selectedName.textContent = entry?.extractorName || selectedExtractor()?.name || "血統因子抽取器";
    if (ui.selectedDetail) ui.selectedDetail.textContent = `${state.extraction?.rank || "ED"} 級目標・三階段鎖定`;
    positionCylinder();
    window.requestAnimationFrame(positionCylinder);
  }

  function rectInStageSpace(rect, stageRect, stageElement) {
    const scaleX = stageRect.width / (stageElement.offsetWidth || stageRect.width) || 1;
    const scaleY = stageRect.height / (stageElement.offsetHeight || stageRect.height) || 1;
    return {
      left: (rect.left - stageRect.left) / scaleX,
      top: (rect.top - stageRect.top) / scaleY,
      width: rect.width / scaleX,
      height: rect.height / scaleY,
      right: (rect.right - stageRect.left) / scaleX,
      bottom: (rect.bottom - stageRect.top) / scaleY,
    };
  }

  function fitStageToViewport() {
    const stage = document.getElementById("battleStage");
    if (!stage?.classList.contains("lineage-extraction-active")) return;
    if (document.getElementById("battleViewport")) {
      stage.classList.remove("lineage-viewport-fitted");
      stage.style.removeProperty("--lineage-stage-scale");
      stage.style.removeProperty("--lineage-stage-left");
      stage.style.removeProperty("--lineage-stage-top");
      return;
    }
    const viewport = window.visualViewport;
    const viewportWidth = Math.max(1, viewport?.width || window.innerWidth);
    const viewportHeight = Math.max(1, viewport?.height || window.innerHeight);
    const shouldFit = viewportWidth < 1024 || viewportHeight < 576;
    stage.classList.toggle("lineage-viewport-fitted", shouldFit);
    if (!shouldFit) {
      stage.style.removeProperty("--lineage-stage-scale");
      stage.style.removeProperty("--lineage-stage-left");
      stage.style.removeProperty("--lineage-stage-top");
      return;
    }
    const scale = Math.min(viewportWidth / 1024, viewportHeight / 576);
    stage.style.setProperty("--lineage-stage-scale", scale.toFixed(6));
    stage.style.setProperty("--lineage-stage-left", `${(viewport?.offsetLeft || 0) + viewportWidth / 2}px`);
    stage.style.setProperty("--lineage-stage-top", `${(viewport?.offsetTop || 0) + viewportHeight / 2}px`);
  }

  function handleViewportGeometryChange() {
    fitStageToViewport();
    window.requestAnimationFrame(() => {
      positionCylinder();
      positionOutcomeBeam();
    });
  }

  function positionCylinder() {
    const ui = refs();
    if (!ui.root.classList.contains("is-cylinder") || ui.cylinder.hidden) return;
    const stageRect = ui.root.getBoundingClientRect();
    const showcaseRect = ui.launcherShowcase?.getBoundingClientRect();
    if (!stageRect.width || !stageRect.height || !showcaseRect?.width) return;
    const showcaseLocal = rectInStageSpace(showcaseRect, stageRect, ui.root);
    const apertureX = showcaseLocal.left + showcaseLocal.width * .247;
    const apertureY = showcaseLocal.top + showcaseLocal.height * .466;
    const diameter = ui.root.offsetHeight * 1.3;
    const chamberRadius = diameter * .293;
    const centerX = apertureX - chamberRadius;
    const centerY = apertureY;
    ui.rotator.style.left = `${centerX - diameter / 2}px`;
    ui.rotator.style.top = `${centerY - diameter / 2}px`;
    ui.rotator.style.width = `${diameter}px`;
    ui.rotator.style.height = `${diameter}px`;
  }

  function updateCylinder() {
    const ui = refs();
    const rotation = 90 - state.cylinderTurns * SLOT_STEP;
    ui.rotator.style.transform = `rotate(${rotation}deg)`;
    ui.rotator.querySelectorAll(".lineage-cylinder-slot").forEach((slot) => {
      const index = Number(slot.dataset.lineageSlot || -1);
      slot.classList.toggle("selected", index === selectedSlotIndex());
      const upright = slot.querySelector(".lineage-cylinder-device-upright");
      if (upright) upright.style.transform = `rotate(${-rotation}deg)`;
    });
    const selected = selectedExtractor();
    state.selectedExtractorId = selected?.id || "";
    applyTheme(state.selectedExtractorId);
    if (ui.launcherDevice) {
      const visual = EXTRACTOR_VISUALS[selected?.id] || EXTRACTOR_VISUALS.lineage_extractor_standard;
      ui.launcherDevice.src = selected ? `${UI_ROOT}${visual.image}` : "";
      ui.launcherDevice.alt = selected?.name || "";
    }
    if (ui.selectedName) ui.selectedName.textContent = selected?.name || "沒有可用抽取器";
    if (ui.selectedDetail) {
      ui.selectedDetail.textContent = selected
        ? `持有 ${selected.count} 個・本次加成 +${selected.bonus}%・滑動／滾輪／箭頭切換`
        : "請先取得血統因子抽取器";
    }
  }

  function cylinderMotionFrame(now) {
    state.cylinderFrame = 0;
    if (state.dragging || state.mode !== "cylinder") return;
    const elapsed = Math.max(0, Math.min(34, now - (state.cylinderLastAt || now)));
    state.cylinderLastAt = now;
    state.cylinderTurns += state.cylinderVelocity * elapsed;
    state.cylinderVelocity *= Math.exp(-elapsed / 540);
    updateCylinder();
    if (Math.abs(state.cylinderVelocity) <= .00012) {
      state.cylinderTurns = Math.round(state.cylinderTurns);
      state.cylinderVelocity = 0;
      state.cylinderLastAt = 0;
      refs().root.classList.remove("is-cylinder-spinning");
      updateCylinder();
      return;
    }
    state.cylinderFrame = window.requestAnimationFrame(cylinderMotionFrame);
  }

  function startCylinderMotion() {
    if (state.cylinderFrame) return;
    state.cylinderLastAt = performance.now();
    refs().root.classList.add("is-cylinder-spinning");
    state.cylinderFrame = window.requestAnimationFrame(cylinderMotionFrame);
  }

  function rotateCylinder(direction, requestedSteps = 1) {
    if (state.mode !== "cylinder") return;
    const steps = Math.max(1, Math.min(10, Math.round(Math.abs(requestedSteps) || 1)));
    const impulse = .0008 + Math.pow(steps, 1.35) * .00115;
    state.cylinderVelocity = Math.max(
      -.042,
      Math.min(.042, state.cylinderVelocity + Math.sign(direction || 1) * impulse)
    );
    startCylinderMotion();
  }

  function renderCylinder() {
    const ui = refs();
    hideSections();
    openRoot();
    setHeader();
    showOperationLayout();
    state.mode = "cylinder";
    state.cylinderTurns = 0;
    state.cylinderVelocity = 0;
    buildCylinderSlots(state.extraction?.extractors || []);
    ui.cylinder.hidden = false;
    ui.root.classList.add("is-cylinder", "is-cylinder-selection");
    ui.root.classList.remove("is-cylinder-locked", "is-minigame", "is-outcome", "is-outcome-locked");
    ui.root.querySelector("[data-lineage-title]").textContent = "選擇血統因子抽取器";
    ui.root.querySelector("[data-lineage-lock]").disabled = false;
    if (ui.cylinderInstruction) {
      ui.cylinderInstruction.textContent = "上下滑動或滾輪旋轉七連彈巢；點一下左側圓框立即停輪選定。";
    }
    updateCylinder();
    positionCylinder();
    window.requestAnimationFrame(positionCylinder);
  }

  function currentRotationDegrees(element) {
    const transform = window.getComputedStyle(element).transform;
    if (!transform || transform === "none") return 0;
    const matrix = new DOMMatrixReadOnly(transform);
    return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
  }

  function settleCylinderAtCurrentChamber() {
    const ui = refs();
    const rotation = currentRotationDegrees(ui.rotator);
    const uprightEntries = [...ui.slots.children].map((slot) => {
      const upright = slot.querySelector(".lineage-cylinder-device-upright");
      return { upright, rotation: upright ? currentRotationDegrees(upright) : 0 };
    });
    window.cancelAnimationFrame(state.cylinderFrame);
    state.cylinderFrame = 0;
    state.cylinderVelocity = 0;
    state.cylinderLastAt = 0;
    ui.root.classList.remove("is-cylinder-spinning");
    ui.rotator.style.transition = "none";
    ui.rotator.style.transform = `rotate(${rotation}deg)`;
    uprightEntries.forEach(({ upright, rotation: uprightRotation }) => {
      if (!upright) return;
      upright.style.transition = "none";
      upright.style.transform = `rotate(${uprightRotation}deg)`;
    });
    void ui.rotator.offsetWidth;
    state.cylinderTurns = Math.round((90 - rotation) / SLOT_STEP);
    ui.rotator.style.removeProperty("transition");
    ui.rotator.style.setProperty("--lineage-cylinder-duration", "170ms");
    uprightEntries.forEach(({ upright }) => upright?.style.removeProperty("transition"));
    updateCylinder();
  }

  function unlockCylinderSelection() {
    clearActivity();
    state.mode = "cylinder";
    const ui = refs();
    ui.root.classList.remove("is-cylinder-locked");
    ui.root.querySelector("[data-lineage-lock]").disabled = false;
    ui.selectedDetail.textContent = "已取消選定；可繼續旋轉七連彈巢。";
  }

  function handleCylinderAperturePress() {
    if (state.mode === "locking") {
      unlockCylinderSelection();
      return;
    }
    lockCylinderSelection();
  }

  function lockCylinderSelection() {
    if (state.mode !== "cylinder" || !state.extraction?.canControl) return;
    const selected = selectedExtractor();
    if (!selected) return;
    settleCylinderAtCurrentChamber();
    state.mode = "locking";
    refs().root.classList.add("is-cylinder-locked");
    refs().selectedDetail.textContent = `${selected.name} 已選定；再點圓框可取消，鎖定後才消耗 1 個。`;
    later(() => {
      if (state.mode !== "locking") return;
      refs().root.querySelector("[data-lineage-lock]").disabled = true;
      refs().selectedDetail.textContent = `${selected.name} 已鎖定，正在確認庫存並消耗 1 個……`;
      state.sendStart?.(selected.id, state.extraction.playerId);
    }, 360);
  }

  function targetLayer() {
    const ui = refs();
    let layer = ui.enemyWrap?.querySelector(".lineage-target-layer");
    if (!layer && ui.enemyWrap) {
      layer = document.createElement("div");
      layer.className = "lineage-target-layer";
      ui.enemyWrap.appendChild(layer);
    }
    return layer;
  }

  function renderGrades() {
    const ui = refs();
    ui.grades.innerHTML = [0, 1, 2].map((index) => {
      const grade = state.grades[index] || "待判定";
      return `<span class="lineage-grade-chip ${escapeHtml(grade)}">${index + 1}. ${escapeHtml(grade)}</span>`;
    }).join("");
  }

  function flashGrade(grade) {
    const flash = document.createElement("div");
    flash.className = `lineage-grade-flash ${grade}`;
    flash.textContent = String(grade || "").toUpperCase();
    (refs().enemyWrap || ensureRoot()).appendChild(flash);
    later(() => flash.remove(), 650);
  }

  function gradeByDistance(distance, perfect, good) {
    if (distance <= perfect) return "Perfect";
    if (distance <= good) return "Good";
    return "Miss";
  }

  function difficulty() {
    return DIFFICULTIES[state.extraction?.rank] || DIFFICULTIES.ED;
  }

  function beginMinigame() {
    if (state.minigameStarted) return;
    const ui = refs();
    clearActivity();
    openRoot();
    showOperationLayout();
    ui.panel.hidden = true;
    ui.cylinder.hidden = false;
    ui.hud.hidden = false;
    ui.outcome.hidden = true;
    ui.outcome.className = "lineage-outcome";
    ui.enemyWrap?.querySelector(".lineage-target-layer")?.remove();
    ui.root.classList.add("is-cylinder", "is-cylinder-locked", "is-minigame");
    ui.root.classList.remove("is-cylinder-selection", "is-outcome", "is-outcome-locked");
    ui.root.querySelector("[data-lineage-title]").textContent = "血統因子提取・第一階段";
    ui.root.querySelector("[data-lineage-lock]").disabled = true;
    state.mode = "phase1-ready";
    state.minigameStarted = true;
    state.phase = 1;
    state.grades = [];
    state.phaseOneCount = 0;
    state.phaseOnePoints = 0;
    state.phaseOneMisses = 0;
    state.phaseOneCombo = 0;
    state.targetPositions = randomTargetPositions(difficulty().count);
    ensureLockedCylinder(state.extraction?.entry);
    ui.phaseTitle.textContent = "第一階段・細胞節點同步";
    ui.phaseHint.textContent = "先點中央「開始」；之後在外圈貼近內圈時點擊。累積 3 次 Miss 會立刻結束本階段。";
    setStageStats(["目標", "COMBO", "MISS"], [`0／${difficulty().count}`, "0", "0／3"]);
    renderGrades();
    spawnStartTarget();
  }

  function spawnStartTarget() {
    const layer = targetLayer();
    if (!layer) return;
    layer.innerHTML = `
      <button class="lineage-osu-target is-start" type="button" style="left:50%;top:50%;--target-size:34%">
        <img class="approach" src="${UI_ROOT}lineage_seal_pulse_ring_v2.webp" alt="">
        <img class="hit" src="${UI_ROOT}lineage_seal_fixed_ring_v2.webp" alt="">
      </button>
    `;
    layer.querySelector("button")?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      layer.innerHTML = "";
      later(spawnTimedTarget, 180);
    }, { once: true });
  }

  function randomTargetPositions(count) {
    const positions = [];
    while (positions.length < count) {
      let candidate = null;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const next = {
          x: 17 + Math.random() * 66,
          y: 20 + Math.random() * 60,
        };
        const safe = positions.slice(-2).every((position) => Math.hypot(next.x - position.x, next.y - position.y) >= 27);
        candidate = next;
        if (safe) break;
      }
      positions.push(candidate);
    }
    return positions;
  }

  function spawnTimedTarget() {
    const config = difficulty();
    if (state.phaseOneCount >= config.count || state.phaseOneMisses >= 3) {
      finishPhaseOne();
      return;
    }
    const layer = targetLayer();
    if (!layer) return;
    state.mode = "phase1-playing";
    const position = state.targetPositions[state.phaseOneCount] || { x: 50, y: 50 };
    const preview = state.targetPositions[state.phaseOneCount + 1];
    const startedAt = performance.now();
    layer.innerHTML = `
      <button class="lineage-osu-target" type="button"
        style="left:${position.x}%;top:${position.y}%;--target-size:${config.size}%;--target-duration:${config.duration}ms">
        <img class="approach" src="${UI_ROOT}lineage_seal_pulse_ring_v2.webp" alt="">
        <img class="hit" src="${UI_ROOT}lineage_seal_fixed_ring_v2.webp" alt="">
        <span class="lineage-target-number">${state.phaseOneCount + 1}</span>
      </button>
      ${preview ? `
        <span class="lineage-osu-target lineage-target-preview" style="left:${preview.x}%;top:${preview.y}%;--target-size:${config.size}%">
          <img class="hit" src="${UI_ROOT}lineage_seal_fixed_ring_v2.webp" alt="">
          <span class="lineage-target-number">${state.phaseOneCount + 2}</span>
        </span>
      ` : ""}
    `;
    let resolved = false;
    const resolve = (grade) => {
      if (resolved) return;
      resolved = true;
      window.clearTimeout(state.targetTimer);
      state.targetTimer = 0;
      state.phaseOneCount += 1;
      state.phaseOnePoints += grade === "Perfect" ? 2 : grade === "Good" ? 1 : 0;
      if (grade === "Miss") {
        state.phaseOneMisses += 1;
        state.phaseOneCombo = 0;
      } else {
        state.phaseOneCombo += 1;
      }
      setStageStats(
        ["目標", "COMBO", "MISS"],
        [`${state.phaseOneCount}／${config.count}`, state.phaseOneCombo, `${state.phaseOneMisses}／3`]
      );
      flashGrade(grade);
      layer.innerHTML = "";
      later(spawnTimedTarget, 190);
    };
    layer.querySelector("button")?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const progress = Math.max(0, Math.min(1, (performance.now() - startedAt) / config.duration));
      const scale = 2.15 - progress * 1.6;
      resolve(gradeByDistance(Math.abs(scale - 1), config.perfect, config.good));
    }, { once: true });
    state.targetTimer = window.setTimeout(() => resolve("Miss"), config.duration + 30);
  }

  function finishPhaseOne() {
    const config = difficulty();
    const ratio = state.phaseOnePoints / Math.max(1, config.count * 2);
    const grade = state.phaseOneMisses >= 3 ? "Miss" : ratio >= .85 ? "Perfect" : ratio >= .5 ? "Good" : "Miss";
    state.grades[0] = grade;
    flashGrade(grade);
    renderGrades();
    later(beginLockPhase, 920);
  }

  function beginLockPhase() {
    const ui = refs();
    const layer = targetLayer();
    state.phase = 2;
    state.mode = "phase2-ready";
    ui.root.querySelector("[data-lineage-title]").textContent = "血統因子提取・第二階段";
    ui.phaseTitle.textContent = "第二階段・雙向鎖定";
    ui.phaseHint.textContent = "先點擊開始；左右鎖針啟動後，在兩端同時咬合中央接口時點擊敵人框。";
    setStageStats(["階段", "掃描定位", "本次判定"], ["II／III", state.grades[0] || "—", "—"]);
    if (!layer) return;
    layer.innerHTML = `
      <div class="lineage-lock-target" aria-label="鎖定血統節點">
        <img class="track" src="${UI_ROOT}lineage_lock_target_track_v2.webp" alt="">
        <img class="left" src="${UI_ROOT}lineage_lock_marker_v2.webp" alt="">
        <img class="right" src="${UI_ROOT}lineage_lock_marker_v2.webp" alt="">
        <button class="lineage-phase-start-control" type="button">點擊開始第二階段</button>
      </div>
    `;
    const target = layer.querySelector(".lineage-lock-target");
    layer.querySelector(".lineage-phase-start-control")?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.remove();
      startLockPhase(target);
    }, { once: true });
  }

  function startLockPhase(target) {
    const config = difficulty();
    state.mode = "phase2-playing";
    state.phaseStartedAt = performance.now();
    const startedAt = performance.now();
    let lastDistance = 1;
    let resolved = false;
    const animate = (now) => {
      if (resolved) return;
      const progress = ((now - startedAt) / config.lockDuration) % 1;
      state.frozenProgress = progress;
      const approach = (1 - Math.cos(progress * Math.PI * 2)) / 2;
      lastDistance = 1 - approach;
      target.style.setProperty("--lock-left", `${-4 + approach * 42}%`);
      target.style.setProperty("--lock-right", `${104 - approach * 42}%`);
      state.phaseFrame = window.requestAnimationFrame(animate);
    };
    const resolve = () => {
      if (resolved) return;
      resolved = true;
      window.cancelAnimationFrame(state.phaseFrame);
      state.phaseFrame = 0;
      const grade = gradeByDistance(lastDistance, config.lockPerfect, config.lockGood);
      state.grades[1] = grade;
      setStageStats(["階段", "掃描定位", "樣本穩定"], ["II／III", state.grades[0] || "—", grade]);
      flashGrade(grade);
      renderGrades();
      targetLayer().innerHTML = "";
      state.mode = "phase-transition";
      later(beginSealPhase, 900);
    };
    target.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      resolve();
    }, { once: true });
    state.phaseFrame = window.requestAnimationFrame(animate);
  }

  function beginSealPhase() {
    const ui = refs();
    const layer = targetLayer();
    state.phase = 3;
    state.mode = "phase3-ready";
    ui.root.querySelector("[data-lineage-title]").textContent = "血統因子提取・第三階段";
    ui.phaseTitle.textContent = "第三階段・脈衝封存";
    ui.phaseHint.textContent = "先點擊開始；青藍能量環啟動後，在它與固定金環重合時點擊敵人框。";
    setStageStats(["階段", "樣本穩定", "本次判定"], ["III／III", state.grades[1] || "—", "—"]);
    if (!layer) return;
    layer.innerHTML = `
      <div class="lineage-seal-target" aria-label="封存血統因子">
        <img class="fixed" src="${UI_ROOT}lineage_seal_fixed_ring_v2.webp" alt="">
        <img class="pulse" src="${UI_ROOT}lineage_seal_pulse_ring_v2.webp" alt="">
        <button class="lineage-phase-start-control" type="button">點擊開始第三階段</button>
      </div>
    `;
    const target = layer.querySelector(".lineage-seal-target");
    layer.querySelector(".lineage-phase-start-control")?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.remove();
      startSealPhase(target);
    }, { once: true });
  }

  function startSealPhase(target) {
    const ui = refs();
    const layer = targetLayer();
    const config = difficulty();
    state.mode = "phase3-playing";
    const startedAt = performance.now();
    let lastDistance = 1;
    let resolved = false;
    const animate = (now) => {
      if (resolved) return;
      const progress = ((now - startedAt) / config.sealDuration) % 1;
      state.frozenProgress = progress;
      const wave = (1 + Math.sin(progress * Math.PI * 2 - Math.PI / 2)) / 2;
      const scale = .52 + wave * .96;
      lastDistance = Math.abs(scale - 1);
      target.style.setProperty("--seal-scale", scale.toFixed(3));
      state.phaseFrame = window.requestAnimationFrame(animate);
    };
    const resolve = () => {
      if (resolved) return;
      resolved = true;
      window.cancelAnimationFrame(state.phaseFrame);
      state.phaseFrame = 0;
      const grade = gradeByDistance(lastDistance, config.sealPerfect, config.sealGood);
      state.grades[2] = grade;
      setStageStats(["掃描定位", "樣本穩定", "封存完成"], [
        state.grades[0] || "—",
        state.grades[1] || "—",
        grade,
      ]);
      flashGrade(grade);
      renderGrades();
      if (layer) layer.innerHTML = "";
      state.mode = "awaiting";
      ui.phaseTitle.textContent = "三階段完成・主控台判定中";
      ui.phaseHint.textContent = "正在依目標級別、抽取器加成與三段操作結果計算正式成功率。";
      later(() => state.sendComplete?.(state.grades.slice(0, 3), state.extraction.playerId), 900);
    };
    target.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      resolve();
    }, { once: true });
    state.phaseFrame = window.requestAnimationFrame(animate);
  }

  function positionOutcomeBeam() {
    const ui = refs();
    if (!ui.outcome || ui.outcome.hidden || !ui.enemyCard) return;
    const stageRect = ui.root.getBoundingClientRect();
    const launcherRect = ui.launcherShowcase.getBoundingClientRect();
    const launcherBayRect = ui.launcherBay?.getBoundingClientRect() || launcherRect;
    const targetRect = ui.enemyWrap?.getBoundingClientRect() || ui.enemyCard.getBoundingClientRect();
    const launcherLocal = rectInStageSpace(launcherRect, stageRect, ui.root);
    const launcherBayLocal = rectInStageSpace(launcherBayRect, stageRect, ui.root);
    const targetLocal = rectInStageSpace(targetRect, stageRect, ui.root);
    const trackStartX = launcherBayLocal.left + launcherBayLocal.width * .91;
    const trackY = launcherBayLocal.top + launcherBayLocal.height * .5;
    const trackEndX = launcherLocal.right;
    const trackWidth = Math.max(0, trackEndX - trackStartX);
    const endX = targetLocal.left + targetLocal.width * .5;
    const endY = targetLocal.top + targetLocal.height * .46;
    const dx = endX - trackEndX;
    const dy = endY - trackY;
    if (ui.trackBeam) {
      ui.trackBeam.style.left = `${trackStartX - launcherLocal.left}px`;
      ui.trackBeam.style.top = `${trackY - launcherLocal.top}px`;
      ui.trackBeam.style.width = `${trackWidth}px`;
    }
    if (ui.targetBeam) {
      ui.targetBeam.style.left = `${trackEndX}px`;
      ui.targetBeam.style.top = `${trackY}px`;
      ui.targetBeam.style.width = `${Math.hypot(dx, dy)}px`;
      ui.targetBeam.style.transform = `translateY(-50%) rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)`;
    }
    if (ui.impact) {
      ui.impact.style.left = "50%";
      ui.impact.style.top = "46%";
    }
    if (ui.containmentPips) {
      ui.containmentPips.style.left = "50%";
      ui.containmentPips.style.top = "66%";
    }
  }

  function playOutcome(entry) {
    if (state.outcomePlaying) return;
    const ui = refs();
    clearActivity();
    openRoot();
    showOperationLayout();
    ui.panel.hidden = true;
    ui.cylinder.hidden = false;
    ui.hud.hidden = true;
    ui.outcome.hidden = false;
    ui.outcome.className = "lineage-outcome";
    if (ui.stage && ui.targetBeam) ui.stage.appendChild(ui.targetBeam);
    if (ui.targetBeam) ui.targetBeam.className = "lineage-target-beam";
    if (ui.outcomeNext) ui.outcomeNext.hidden = true;
    ui.enemyWrap?.querySelector(".lineage-target-layer")?.remove();
    if (ui.enemyWrap && ui.impact) ui.enemyWrap.appendChild(ui.impact);
    if (ui.enemyWrap && ui.containmentPips) ui.enemyWrap.appendChild(ui.containmentPips);
    ui.root.classList.add("is-cylinder", "is-cylinder-locked", "is-outcome", "is-outcome-charging");
    ui.root.classList.remove(
      "is-cylinder-selection",
      "is-minigame",
      "is-outcome-locked",
      "is-outcome-firing",
      "is-outcome-testing",
      "is-outcome-success",
      "is-outcome-failure"
    );
    ui.root.querySelector("[data-lineage-title]").textContent = "血統因子提取・最終判定";
    state.mode = "outcome";
    state.outcomePlaying = true;
    if (ui.outcomeNext) {
      ui.outcomeNext.onclick = () => {
        if (state.mode !== "outcome") return;
        clearActivity();
        state.outcomePlaying = false;
        renderResult(entry);
      };
    }
    const visual = applyTheme(entry.extractorId);
    ensureLockedCylinder(entry);
    ui.launcherDevice.src = `${UI_ROOT}${visual.image}`;
    ui.launcherDevice.alt = entry.extractorName || "血統因子抽取器";
    ui.outcomeStatus.textContent = `${entry.extractorName || "抽取器"}充能中……`;
    window.requestAnimationFrame(positionOutcomeBeam);
    later(() => {
      ui.outcome.classList.add("is-locked");
      ui.root.classList.add("is-outcome-locked");
      ui.outcomeStatus.textContent = "採樣器轉向・血統訊號鎖定";
      positionOutcomeBeam();
    }, 1400);
    later(() => {
      ui.outcome.classList.add("is-firing");
      ui.root.classList.add("is-outcome-firing");
      ui.targetBeam?.classList.add("is-firing");
      ui.root.classList.remove("is-outcome-charging");
      ui.enemyCard?.classList.add("lineage-outcome-firing");
      ui.outcomeStatus.textContent = "血統因子採樣中……";
      positionOutcomeBeam();
    }, 2200);
    later(() => {
      ui.root.classList.add("is-outcome-testing");
      ui.enemyCard?.classList.add("lineage-outcome-testing");
      ui.outcomeStatus.textContent = "封存環進行三次穩定脈衝；等待血統樣本是否被鎖定……";
    }, 3100);
    later(() => {
      const success = entry.status === "success";
      ui.root.classList.remove("is-outcome-testing");
      ui.root.classList.add(success ? "is-outcome-success" : "is-outcome-failure");
      ui.targetBeam?.classList.add(success ? "is-success" : "is-failure");
      ui.enemyCard?.classList.remove("lineage-outcome-testing");
      ui.enemyCard?.classList.add(success ? "lineage-outcome-success" : "lineage-outcome-failure");
      ui.enemyCard?.classList.add(success ? "lineage-sample-secured" : "lineage-sample-rejected");
      ui.outcomeStatus.textContent = success
        ? "三次脈衝全部穩定，血統樣本正在沿光束回收到抽取器。"
        : "封存環破裂，血統樣本掙脫並從採樣光束中逸散。";
      if (ui.outcomeNext) {
        ui.outcomeNext.textContent = success ? "查看提取成功結果" : "查看提取失敗結果";
        ui.outcomeNext.hidden = false;
      }
    }, 5800);
    later(() => {
      const success = entry.status === "success";
      ui.root.querySelector("[data-lineage-title]").textContent = success ? "血統因子提取成功" : "血統因子提取失敗";
      ui.outcomeStatus.textContent = success
        ? "成功取得一份完整血統因子。"
        : "沒有取得血統因子；使用的抽取器仍會消耗。";
    }, 6900);
    later(() => {
      state.outcomePlaying = false;
      renderResult(entry);
    }, 8000);
  }

  function renderResult(entry) {
    const ui = refs();
    hideSections();
    openRoot();
    setHeader();
    showBattleLayout();
    state.mode = "result";
    const success = entry.status === "success";
    const grades = Array.isArray(entry.grades)
      ? entry.grades.map((grade) => String(grade || "").toUpperCase())
      : [];
    renderBattleLog(
      `三階段操作已完成，${entry.extractorName || "血統因子抽取器"}的正式成功率為 ${Number(entry.finalRate || 0)}%。`,
      entry.message || (success ? "完整血統因子已送入研究所保存。" : "樣本已崩解。")
    );
    ui.actionTitle.textContent = success ? "血統因子提取成功" : "血統因子提取失敗";
    ui.actionCopy.className = "lineage-battle-panel-copy result-mode";
    ui.actionCopy.innerHTML = `
      <div class="lineage-stage-grade ${success ? "good" : "miss"}">${success ? "提取成功" : "提取失敗"}</div>
      <div class="lineage-phase-stats">
        <div class="lineage-stat">掃描定位<strong>${escapeHtml(grades[0] || "—")}</strong></div>
        <div class="lineage-stat">樣本穩定<strong>${escapeHtml(grades[1] || "—")}</strong></div>
        <div class="lineage-stat">封存完成<strong>${escapeHtml(grades[2] || "—")}</strong></div>
        <div class="lineage-stat">最終成功率<strong>${Number(entry.finalRate || 0)}%</strong></div>
      </div>
      <div class="lineage-hint-line">${escapeHtml(entry.message || (success ? "成功取得一份完整血統因子。" : "沒有取得血統因子；使用的抽取器仍會消耗。"))}</div>
      <div class="lineage-result-actions single">
        ${imageButton(state.extraction?.allResolved ? "繼續戰鬥結算" : "查看共鬥等待狀態", "dismiss")}
      </div>
    `;
    ui.actionCopy.querySelector('[data-lineage-action="dismiss"]')?.addEventListener("click", () => {
      if (!state.extraction?.allResolved) {
        renderWaiting();
        return;
      }
      state.dismissedScopeKey = state.scopeKey;
      closeRoot();
      state.sendDismiss?.();
    });
  }

  function renderUnavailable(entry) {
    const ui = refs();
    hideSections();
    openRoot();
    setHeader();
    showBattleLayout();
    state.mode = "unavailable";
    renderBattleLog(
      "戰鬥勝利後已進入血統因子抽取判定。",
      "本次沒有消耗任何道具，也不會取得完整血統因子。"
    );
    ui.actionTitle.textContent = "沒有可用的血統因子抽取器";
    ui.actionCopy.className = "lineage-battle-panel-copy result-mode";
    ui.actionCopy.innerHTML = `
      <div class="lineage-stage-grade miss">無法提取</div>
      <div class="lineage-hint-line">${escapeHtml(entry?.message || "重要道具背包內沒有剩餘抽取器，請先到研究所購買後再挑戰。")}</div>
      <div class="lineage-hint-line">下次戰鬥勝利時，只要重要道具背包持有任一血統因子抽取器，就會先讓你選擇要提取或放棄。</div>
      <div class="lineage-result-actions single">
        ${imageButton(state.extraction?.allResolved ? "繼續戰鬥結算" : "查看共鬥等待狀態", "dismiss")}
      </div>
    `;
    ui.actionCopy.querySelector('[data-lineage-action="dismiss"]')?.addEventListener("click", () => {
      if (!state.extraction?.allResolved) {
        renderWaiting();
        return;
      }
      state.dismissedScopeKey = state.scopeKey;
      closeRoot();
      state.sendDismiss?.();
    });
  }

  function renderWaiting() {
    const ui = refs();
    hideSections();
    openRoot();
    setHeader();
    showBattleLayout();
    const names = state.extraction?.waitingForPlayers || [];
    const participants = Array.isArray(state.extraction?.participants) ? state.extraction.participants : [];
    renderBattleLog(
      "你的抽取選擇已完成。",
      "共鬥戰鬥會等每位實際參戰者各自完成或放棄，才開放原戰鬥結算。"
    );
    ui.actionTitle.textContent = "等待其他參戰者完成抽取";
    ui.actionCopy.className = "lineage-battle-panel-copy waiting-mode";
    ui.actionCopy.innerHTML = `
      <div class="lineage-waiting-summary">仍在處理：${escapeHtml(names.join("、") || "同步中")}</div>
      <div class="lineage-waiting-player-grid">
        ${participants.map((participant) => `
          <article class="lineage-waiting-player ${participant.terminal ? "is-complete" : "is-pending"} ${participant.isCurrent ? "is-current" : ""}">
            <img src="${escapeHtml(participant.avatarUrl || "images/board/battle/portraits/placeholder/normal.webp")}" alt="" aria-hidden="true">
            <span><strong>${escapeHtml(participant.playerName || "玩家")}</strong><small>${escapeHtml(participant.statusLabel || "等待處理")}</small></span>
            <em>${participant.terminal ? "完成" : "等待"}</em>
          </article>
        `).join("") || `<div class="lineage-waiting-names">${escapeHtml(names.join("、") || "同步中")}</div>`}
      </div>
      <div class="lineage-result-actions single">
        ${imageButton("返回觀看戰鬥畫面", "dismiss")}
      </div>
    `;
    ui.actionCopy.querySelector('[data-lineage-action="dismiss"]')?.addEventListener("click", () => {
      state.dismissedScopeKey = state.scopeKey;
      closeRoot();
    });
    state.mode = "waiting";
  }

  function resetForScope(scopeKey) {
    clearActivity();
    state.scopeKey = scopeKey;
    state.attemptId = "";
    state.mode = "";
    state.selectedExtractorId = "";
    state.slots = [];
    state.cylinderTurns = 0;
    state.cylinderLastAt = 0;
    state.minigameStarted = false;
    state.phase = 0;
    state.grades = [];
    state.phaseOneCombo = 0;
    state.targetPositions = [];
    state.phaseStartedAt = 0;
    state.frozenProgress = 0;
    state.outcomePlaying = false;
  }

  function refresh(view, callbacks = {}) {
    state.view = view || null;
    state.extraction = view?.battle?.lineageExtraction || null;
    state.sendStart = callbacks.start || state.sendStart;
    state.sendComplete = callbacks.complete || state.sendComplete;
    state.sendDecline = callbacks.decline || state.sendDecline;
    state.sendDismiss = callbacks.dismiss || state.sendDismiss;
    const extraction = state.extraction;
    if (!extraction) {
      resetForScope("");
      closeRoot();
      return;
    }
    if (state.scopeKey !== extraction.scopeKey) resetForScope(extraction.scopeKey);
    const entry = extraction.entry;
    if (!entry) {
      if (!extraction.allResolved && state.dismissedScopeKey !== extraction.scopeKey) renderWaiting();
      else closeRoot();
      return;
    }
    applyTheme(entry.extractorId || state.selectedExtractorId || extraction.extractors?.[0]?.id);
    if (entry.status === "offered") {
      if (state.dismissedScopeKey === extraction.scopeKey && !extraction.canControl) {
        closeRoot();
      } else if (!["offer", "cylinder", "locking"].includes(state.mode)) {
        renderOffer();
      }
      return;
    }
    if (entry.status === "active") {
      if (state.attemptId !== entry.attemptId) {
        state.attemptId = entry.attemptId;
        state.selectedExtractorId = entry.extractorId;
        state.minigameStarted = false;
        later(beginMinigame, state.mode === "locking" ? 360 : 80);
      } else if (!state.minigameStarted && state.mode !== "outcome") {
        beginMinigame();
      }
      return;
    }
    if (entry.status === "success" || entry.status === "failure") {
      if (!extraction.allResolved && state.mode === "waiting") {
        renderWaiting();
        return;
      }
      if (state.dismissedScopeKey === extraction.scopeKey) {
        closeRoot();
      } else if (
        state.attemptId === entry.attemptId
        && [
          "phase1-ready",
          "phase1-playing",
          "phase2-ready",
          "phase2-playing",
          "phase3-ready",
          "phase3-playing",
          "phase-transition",
          "awaiting",
          "locking",
        ].includes(state.mode)
      ) {
        playOutcome(entry);
      } else if (!state.outcomePlaying && state.mode !== "result") {
        renderResult(entry);
      }
      return;
    }
    if (entry.status === "unavailable") {
      if (!extraction.allResolved && state.mode === "waiting") {
        renderWaiting();
        return;
      }
      if (state.dismissedScopeKey === extraction.scopeKey) {
        closeRoot();
      } else if (state.mode !== "unavailable") {
        renderUnavailable(entry);
      }
      return;
    }
    if (TERMINAL.has(entry.status)) {
      if (!extraction.allResolved && state.dismissedScopeKey !== extraction.scopeKey) renderWaiting();
      else closeRoot();
    }
  }

  window.__BOARD_LINEAGE_EXTRACTION__ = { refresh };
})();
