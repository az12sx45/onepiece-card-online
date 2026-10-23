'use strict';
// Original source body, unchanged. Host supplies native presentation nodes.
exports.create=({document,window,navigator})=>{
function playSeaEncounterSplash(enemyName) {
    return new Promise((resolve) => {
      const touchSafeEncounter =
        (typeof window.matchMedia === "function" && (window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(hover: none)").matches)) ||
        (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) ||
        "ontouchstart" in window;
      const encounterFont = touchSafeEncounter
        ? '"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", "Heiti TC", "Noto Sans CJK TC", sans-serif'
        : '"Noto Sans TC", "Microsoft JhengHei", "PingFang TC", "Heiti TC", "Noto Sans CJK TC", sans-serif';
      const splash = document.createElement("div");
      splash.className = `sea-encounter-splash${touchSafeEncounter ? " touch-safe" : ""}`;
      splash.style.setProperty("--encounter-font", encounterFont);
      splash.style.setProperty("--encounter-text", "#ffffff");
      splash.style.setProperty("--encounter-stroke", "#000000");
      splash.style.setProperty("--encounter-accent", "#d60000");
      splash.style.setProperty("--encounter-tracking", touchSafeEncounter ? ".05em" : ".08em");
      splash.style.setProperty("--encounter-stroke-size", "0px");
      splash.style.setProperty("--encounter-scale", touchSafeEncounter ? ".98" : ".96");
      splash.style.setProperty("--encounter-tilt", touchSafeEncounter ? "-6deg" : "-10deg");
      splash.style.setProperty("--encounter-speed", touchSafeEncounter ? ".18s" : ".17s");

      const ink = document.createElement("div");
      ink.className = "sea-encounter-ink";
      ink.setAttribute("aria-hidden", "true");

      const brush = document.createElement("div");
      brush.className = "sea-encounter-brush layout-clean anim-glitch";

      const nameLine = document.createElement("strong");
      nameLine.className = "sea-encounter-title sea-encounter-name";
      nameLine.textContent = enemyName || "敵人";

      const attackLine = document.createElement("strong");
      attackLine.className = "sea-encounter-title sea-encounter-attack";
      attackLine.textContent = "襲來！";

      const stroke = document.createElement("span");
      stroke.className = "sea-encounter-stroke";

      brush.append(nameLine, attackLine, stroke);
      splash.append(ink, brush);
      document.body.appendChild(splash);
      window.setTimeout(() => splash.classList.add("show"), 20);
      window.setTimeout(() => {
        resolve();
        window.setTimeout(() => {
          splash.classList.add("closing");
          window.setTimeout(() => splash.remove(), 650);
        }, 950);
      }, 3450);
    });
  }
return playSeaEncounterSplash;
};
