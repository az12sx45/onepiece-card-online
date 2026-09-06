(async function () {
  "use strict";

  if (!window.BattleSocial || document.getElementById("friendDock")) return;

  const shell = document.createElement("div");
  shell.innerHTML = `
    <aside id="friendDock" class="friend-dock is-collapsed" aria-label="好友與聊天室" hidden>
      <div class="friend-dock__me">
        <span class="friend-avatar"><img id="dockAvatar" alt=""></span>
        <span><strong id="dockName">—</strong><small>好友與聊天室</small></span>
        <button id="friendDockToggle" type="button" title="展開或縮小" aria-expanded="false">+</button>
      </div>
      <button id="friendDockOpen" class="friend-dock__open" type="button">好友與聊天室</button>
      <div class="friend-dock__content">
        <div class="friend-add"><input id="friendAddInput" type="text" maxlength="24" placeholder="輸入好友名稱…"><button id="friendAddBtn" type="button">加入</button></div>
        <div id="friendList" class="friend-list"></div><p id="friendHint" class="friend-hint" hidden></p>
      </div>
    </aside>
    <div id="chatTray" class="chat-tray" aria-label="私人聊天視窗"></div>
    <div id="toastRegion" class="toast-region" aria-live="polite"></div>`;
  while (shell.firstElementChild) document.body.appendChild(shell.firstElementChild);

  function read(key, fallback = "") {
    try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; }
  }
  function validOrigin(value) {
    try { const url = new URL(String(value || "")); return /^https?:$/.test(url.protocol) ? url.origin : ""; } catch (_) { return ""; }
  }
  const configuredOrigin = validOrigin(window.GRAND_LINE_BATTLE_CONFIG?.serverOrigin)
    || validOrigin(read("op_shared_server_origin", ""));
  const serverOrigin = configuredOrigin || (/^https?:$/.test(location.protocol) ? location.origin : "http://127.0.0.1:8787");
  const localPreview = sessionStorage.getItem("op_battle_chess_local_preview") === "1";
  const profile = {
    userId: Number(read("op_user_id", "0")) || 0,
    name: read("op_name", "") || read("op_player_name", "") || "玩家",
    avatar: Number(read("op_avatar", "8")) || 8,
    title: read("op_board_title", "") || "新世界啟航者",
  };

  let socket = null;
  if (!localPreview && (read("opSecret", "") || read("op_secret", ""))) {
    if (typeof window.io !== "function") {
      await new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = `${serverOrigin}/socket.io/socket.io.js`;
        script.onload = resolve;
        script.onerror = resolve;
        document.head.appendChild(script);
      });
    }
    if (typeof window.io === "function") {
      const sameOrigin = /^https?:$/.test(location.protocol) && location.origin === serverOrigin;
      const options = { transports: ["websocket", "polling"] };
      socket = sameOrigin ? window.io(options) : window.io(serverOrigin, options);
    }
  }

  window.__BATTLE_GAME_SESSION__ = { socket, profile, serverOrigin, localPreview };
  window.BattleSocial.init({ socket, profile, serverOrigin, localPreview });
  window.dispatchEvent(new CustomEvent("battle:game-session-ready", {
    detail: window.__BATTLE_GAME_SESSION__,
  }));
})();
