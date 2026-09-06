(function () {
  "use strict";

  const ENTRY_KEY = "op_battle_chess_entry_ready";
  const allowed = sessionStorage.getItem(ENTRY_KEY) === "1";

  if (!allowed) {
    document.documentElement.classList.add("entry-redirecting");
    location.replace("./index.html?view=game");
    return;
  }

  const scripts = [
    "./battle-chess.js?v=same-faction-v1-20260903",
    "./battlefield-profile-frame.js?v=battlefield-profile-frames-v4-20260902",
    "./player-header-ui.js?v=first-white-move-timer-v2-20260907",
    "./battle-click-priority-fix.js?v=piece-priority-v1-20260829",
    "./pre-match-lobby.js?v=faction-full-shell-v31-20260906",
    "./battle-room-runtime-v1.js?v=hud-avatar-fit-v2-20260906",
  ];
  let chain = Promise.resolve();
  scripts.forEach((src) => {
    chain = chain.then(() => new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Unable to load ${src}`));
      document.body.appendChild(script);
    }));
  });

  chain.catch((error) => {
    console.error("[battle-game-loader]", error);
    const notice = document.createElement("div");
    notice.className = "battle-load-failure";
    notice.textContent = "棋局載入失敗，請返回主選單後重試。";
    document.body.appendChild(notice);
  });
})();
