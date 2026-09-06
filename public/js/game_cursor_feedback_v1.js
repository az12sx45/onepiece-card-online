(() => {
  "use strict";

  const hadLegacyFeedback = Boolean(window.__ONE_PIECE_GAME_CURSOR_FEEDBACK_V1__);
  if (window.__ONE_PIECE_GAME_CURSOR_POLICY_V4__) return;
  window.__ONE_PIECE_GAME_CURSOR_POLICY_V4__ = true;
  window.__ONE_PIECE_GAME_CURSOR_FEEDBACK_V1__ = true;

  const finePointer = window.matchMedia?.("(any-hover: hover) and (any-pointer: fine)");
  if (finePointer && !finePointer.matches) return;

  const CURSOR_VARIABLES = {
    default: "--game-cursor-default",
    pointer: "--game-cursor-pointer",
    pressed: "--game-cursor-pressed",
  };
  const THEMED_CURSOR_PATTERN = /(?:card_cursor_buggy_glove|board_cursor_nami_quill)_(default|pointer|pressed)_/i;
  const POINTER_HINT_PATTERN = /^(?:pointer|grab|grabbing|zoom-in|zoom-out|crosshair|move|all-scroll|cell|copy|alias|context-menu|(?:[nesw]{1,2}|col|row)-resize)$/i;
  const INTERACTIVE_SELECTOR = [
    "button:not(:disabled)",
    "a[href]",
    '[role="button"]:not([aria-disabled="true"])',
    "[onclick]",
    '[tabindex]:not([tabindex="-1"])',
    "label[for]",
    "summary",
    "select:not(:disabled)",
    'input[type="button"]:not(:disabled)',
    'input[type="submit"]:not(:disabled)',
    'input[type="reset"]:not(:disabled)',
    'input[type="checkbox"]:not(:disabled)',
    'input[type="radio"]:not(:disabled)',
    'input[type="range"]:not(:disabled)',
    'input[type="file"]:not(:disabled)',
    '[draggable="true"]',
    '[aria-grabbed="true"]',
    ".game-cursor-interactive",
    ".cursor-pointer",
    ".cursor-grab",
    ".cursor-grabbing",
    ".cursor-zoom-in",
    ".cursor-zoom-out",
    ".poster",
    ".slot.clickable",
    ".board-viewport",
    ".lineage-cylinder-scene",
    ".ship-stage.tuning .ship-marker",
    ".ship-stage.slot-tuning .slot",
    ".tot-musica-roster-card",
  ].join(",");
  const EXPLICIT_GAME_DRAG_SELECTOR = [
    '[draggable="true"]',
    "[data-game-drag]",
    "[data-drag-handle]",
    ".game-drag-target",
    ".board-viewport",
    ".lineage-cylinder-scene",
    ".ship-stage.tuning .ship-marker",
    ".ship-stage.slot-tuning .slot",
    ".tot-musica-roster-card",
  ].join(",");
  const TEXT_EDIT_SELECTOR = [
    'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="range"])',
    "textarea",
    '[contenteditable="true"]',
  ].join(",");

  const preloadedCursorImages = [];
  const rememberedBaseStates = new WeakMap();
  const pressedOverrideTargets = new Set();
  let pulse = null;
  let pulseTimer = 0;
  let activePressTarget = null;

  function cursorVariableValue(state) {
    return window.getComputedStyle(document.documentElement)
      .getPropertyValue(CURSOR_VARIABLES[state])
      .trim();
  }

  function preloadCursorAssets() {
    if (preloadedCursorImages.length) return;
    for (const state of Object.keys(CURSOR_VARIABLES)) {
      const value = cursorVariableValue(state);
      const match = value.match(/url\((?:"([^"]+)"|'([^']+)'|([^)]*))\)/i);
      const source = (match?.[1] || match?.[2] || match?.[3] || "").trim();
      if (!source) continue;
      const image = new Image();
      image.decoding = "async";
      image.src = source;
      preloadedCursorImages.push(image);
    }
    window.__ONE_PIECE_GAME_CURSOR_PRELOADED_V4__ = preloadedCursorImages;
  }

  function isMouseLikePointer(event) {
    return !event.pointerType || event.pointerType === "mouse" || event.pointerType === "pen";
  }

  function isDisabledTarget(target) {
    return Boolean(target.closest('button:disabled, [aria-disabled="true"], input:disabled, select:disabled'));
  }

  function inlineCursorHint(target) {
    for (let node = target; node instanceof Element; node = node.parentElement) {
      const cursor = node.style?.getPropertyValue("cursor")?.trim();
      if (cursor) return cursor;
    }
    return "";
  }

  function stateFromCursorHint(cursor) {
    const normalized = String(cursor || "").trim().toLowerCase();
    return POINTER_HINT_PATTERN.test(normalized) ? "pointer" : "default";
  }

  function desiredCursorState(target, pressed = false) {
    if (isDisabledTarget(target)) return "default";
    if (pressed) return "pressed";
    if (target.closest(INTERACTIVE_SELECTOR)) return "pointer";
    const inlineHint = inlineCursorHint(target);
    if (inlineHint) {
      if (!inlineHint.startsWith("var(--game-cursor-")) return stateFromCursorHint(inlineHint);
      const remembered = rememberedBaseStates.get(target);
      if (remembered) return remembered;
    }
    const computed = window.getComputedStyle(target).cursor;
    const themed = String(computed).match(THEMED_CURSOR_PATTERN)?.[1]?.toLowerCase();
    if (themed === "default" || themed === "pointer") return themed;
    return rememberedBaseStates.get(target) || stateFromCursorHint(computed);
  }

  function hasThemedCursorState(cursor, state) {
    const match = String(cursor || "").match(THEMED_CURSOR_PATTERN);
    return Boolean(match && match[1].toLowerCase() === state);
  }

  function ensureThemedCursor(target, requestedState = "") {
    if (!(target instanceof Element)) return;
    const baseState = desiredCursorState(target);
    const state = requestedState || baseState;
    if (requestedState === "pressed") pressedOverrideTargets.add(target);
    rememberedBaseStates.set(target, baseState);
    const computed = window.getComputedStyle(target).cursor;
    if (hasThemedCursorState(computed, state)) return;
    if (!cursorVariableValue(state)) return;
    target.style.setProperty("cursor", `var(${CURSOR_VARIABLES[state]})`, "important");
  }

  function clearPulse() {
    window.clearTimeout(pulseTimer);
    pulseTimer = 0;
    pulse?.remove();
    pulse = null;
  }

  function releasePress() {
    document.body?.classList.remove("game-cursor-pressed");
    for (const target of pressedOverrideTargets) {
      if (target.isConnected) ensureThemedCursor(target);
    }
    pressedOverrideTargets.clear();
    activePressTarget = null;
  }

  function clearFeedback() {
    releasePress();
    if (!hadLegacyFeedback) clearPulse();
  }

  function isPulseExcludedTarget(target) {
    return Boolean(target.closest(`button:disabled, [aria-disabled="true"], ${TEXT_EDIT_SELECTOR}`));
  }

  function showPulse(event, target) {
    if (hadLegacyFeedback || isPulseExcludedTarget(target)) return;
    clearPulse();
    const node = document.createElement("span");
    node.className = "game-cursor-click-pulse";
    node.setAttribute("aria-hidden", "true");
    node.style.left = `${event.clientX}px`;
    node.style.top = `${event.clientY}px`;
    document.body?.appendChild(node);
    pulse = node;

    const remove = () => {
      if (pulse !== node) return;
      clearPulse();
    };
    node.addEventListener("animationend", remove, { once: true });
    pulseTimer = window.setTimeout(remove, 520);
  }

  function normalizeCursor(event) {
    if (!isMouseLikePointer(event)) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target) {
      const pressed = document.body?.classList.contains("game-cursor-pressed") && !isDisabledTarget(target);
      ensureThemedCursor(target, pressed ? "pressed" : "");
    }
  }

  function handlePointerDown(event) {
    if (!event.isPrimary || event.button !== 0 || !isMouseLikePointer(event)) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || isDisabledTarget(target)) return;
    activePressTarget = target;
    document.body?.classList.add("game-cursor-pressed");
    ensureThemedCursor(target, "pressed");
    showPulse(event, target);
  }

  function handlePointerRelease(event) {
    if (event && !isMouseLikePointer(event)) return;
    releasePress();
    if (!hadLegacyFeedback && event?.type === "pointercancel") clearPulse();
  }

  function preventIncidentalImageDrag(event) {
    const target = event.target instanceof Element ? event.target : null;
    const image = target?.closest("img");
    if (!image) return;
    if (image.getAttribute("draggable") === "true" || image.closest(EXPLICIT_GAME_DRAG_SELECTOR)) return;
    event.preventDefault();
  }

  preloadCursorAssets();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", preloadCursorAssets, { once: true });
  }
  document.addEventListener("pointerover", normalizeCursor, true);
  document.addEventListener("pointerdown", handlePointerDown, true);
  document.addEventListener("pointerup", handlePointerRelease, true);
  document.addEventListener("pointercancel", handlePointerRelease, true);
  document.addEventListener("dragstart", preventIncidentalImageDrag, true);
  window.addEventListener("blur", clearFeedback);
})();
