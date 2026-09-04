(() => {
  "use strict";

  if (window.__ONE_PIECE_GAME_CURSOR_FEEDBACK_V1__) return;
  window.__ONE_PIECE_GAME_CURSOR_FEEDBACK_V1__ = true;

  const finePointer = window.matchMedia?.("(hover: hover) and (pointer: fine)");
  if (finePointer && !finePointer.matches) return;

  let pulse = null;
  let pulseTimer = 0;

  function clearPulse() {
    window.clearTimeout(pulseTimer);
    pulseTimer = 0;
    pulse?.remove();
    pulse = null;
  }

  function releasePress() {
    document.body?.classList.remove("game-cursor-pressed");
  }

  function clearFeedback() {
    releasePress();
    clearPulse();
  }

  function isExcludedTarget(target) {
    return Boolean(target.closest(
      'button:disabled, [aria-disabled="true"], input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]), textarea, select, [contenteditable="true"]'
    ));
  }

  function adoptExistingPointer(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || isExcludedTarget(target) || target.classList.contains("game-cursor-interactive")) return;
    if (window.getComputedStyle(target).cursor === "pointer") {
      target.classList.add("game-cursor-interactive");
    }
  }

  function showFeedback(event) {
    if (!event.isPrimary || event.button !== 0 || !["mouse", "pen"].includes(event.pointerType)) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || isExcludedTarget(target)) return;

    clearPulse();
    document.body?.classList.add("game-cursor-pressed");

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

  document.addEventListener("pointerover", adoptExistingPointer, true);
  document.addEventListener("pointerdown", showFeedback, true);
  document.addEventListener("pointerup", releasePress, true);
  document.addEventListener("pointercancel", clearFeedback, true);
  window.addEventListener("blur", clearFeedback);
})();
