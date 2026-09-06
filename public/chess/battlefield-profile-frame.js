(() => {
  "use strict";

  const frame = document.querySelector("#piece-profile-frame");
  const battlefieldSelect = document.querySelector("#battlefield-theme");
  const supportedBattlefields = new Set([
    "onigashima",
    "marineford",
    "whole-cake",
    "wano-flower-capital",
    "alabasta",
    "skypiea-shandora",
    "enies-lobby",
    "fish-man-island",
    "dressrosa",
    "flagship",
  ]);

  if (!frame) return;

  const profileFrameVersion = "reference-redraw-v4-20260902";

  const applyBattlefieldFrame = (battlefieldId) => {
    const id = supportedBattlefields.has(battlefieldId)
      ? battlefieldId
      : "onigashima";
    const source = `/images/chess/assets/ui/piece-profile/battlefields/${id}.webp?v=${profileFrameVersion}`;

    if (frame.getAttribute("src") !== source) {
      frame.setAttribute("src", source);
    }
  };

  const battlefieldObserver = new MutationObserver(() => {
    applyBattlefieldFrame(document.body.dataset.battlefield);
  });

  battlefieldObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["data-battlefield"],
  });

  battlefieldSelect?.addEventListener("change", () => {
    applyBattlefieldFrame(battlefieldSelect.value);
  });

  applyBattlefieldFrame(
    document.body.dataset.battlefield || battlefieldSelect?.value
  );
})();
