'use strict';
exports.create=function(host){
const {window,document,URLSearchParams}=host;
if(new URLSearchParams(window.location.search).get('formal')!=='1')throw Error('Native spar requires the original formal mode');
const query = new URLSearchParams(window.location.search);
      const formalMode = query.get("formal") === "1";
      const leftIds = ["luffy", "zoro", "sanji", "nami", "robin", "chopper"];
      const rightIds = ["ace", "sabo", "yamato", "hancock", "law", "oden"];
      const allCards = window.BoardCards?.cards || [];
      const fallbackRight = ["custom_mp3l85c1", "custom_mp3la6fr", "carrot", "usopp", "jinbe", "brook"];
      const cardById = (id) => allCards.find((card) => card.id === id);
      const makeCrew = (ids, fallback = []) => ids.map(cardById).filter(Boolean).concat(fallback.map(cardById).filter(Boolean)).filter((card, index, list) => list.indexOf(card) === index).slice(0, 6);
      const crew = {
        left: makeCrew(leftIds),
        right: makeCrew(rightIds, fallbackRight),
      };
      if (crew.left.length < 6) crew.left = allCards.slice(0, 6);
      if (crew.right.length < 6) crew.right = allCards.slice(8, 14);
      const ui = {
        room: document.getElementById("sparRoom"),
        leftCrew: document.getElementById("leftCrew"),
        rightCrew: document.getElementById("rightCrew"),
        leftReady: document.getElementById("leftReady"),
        rightReady: document.getElementById("rightReady"),
        leftPlayerName: document.getElementById("leftPlayerName"),
        rightPlayerName: document.getElementById("rightPlayerName"),
        secretState: document.getElementById("secretState"),
        sideToggle: document.getElementById("sideToggle"),
        lockBtn: document.getElementById("lockBtn"),
        resetBtn: document.getElementById("resetBtn"),
        detailBackdrop: document.getElementById("detailBackdrop"),
        detailPanel: document.getElementById("detailPanel"),
      };
      const picks = { left: [], right: [] };
      const locked = { left: false, right: false };
      let localSide = "left";
      let formalSparId = "";

      if (formalMode) {
        ui.sideToggle.hidden = true;
        ui.resetBtn.hidden = true;
      }

      function esc(value) {
        return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
      }
      function portrait(card) {
        return card?.battlePortraits?.normal || "images/board/battle/portraits/placeholder/normal.webp";
      }
      function levelStats(card) {
        return card?.baseStats || { hp: card?.hp || 1, atk: card?.atk || 1, def: card?.def || 1, satk: card?.satk || 1, sdef: card?.sdef || 1, spd: card?.spd || 1 };
      }
      function attributeClass(attribute) {
        if (attribute === "力") return "attr-power";
        if (attribute === "速") return "attr-speed";
        return "attr-technique";
      }
      function cardMarkup(card, side, index) {
        const selectionIndex = picks[side].indexOf(index);
        const bothLocked = locked.left && locked.right;
        const ownLocked = locked[side];
        const classes = ["crew-card", attributeClass(card.attribute)];
        if (selectionIndex >= 0) classes.push("selected");
        if (ownLocked && !bothLocked) classes.push("locked");
        if (bothLocked) classes.push("revealed");
        const cardAria = side !== localSide || ownLocked || bothLocked ? `查看 ${card.name} 詳情` : `選擇 ${card.name}`;
        return `
          <article class="${classes.join(" ")}" data-side="${side}" data-index="${index}" tabindex="0" role="button" aria-label="${esc(cardAria)}">
            <img class="card-shell-art" src="images/board/spar_ui/spar_character_card_overlay_frame_v1.webp" alt="" aria-hidden="true">
            <span class="portrait-window"><img class="crew-portrait" src="${esc(portrait(card))}" alt=""></span>
            <span class="attribute-slot" aria-label="${esc(card.attribute)}屬性">${esc(card.attribute)}</span>
            <span class="pick-order">${selectionIndex + 1}</span>
            <span class="selection-ribbon">已選入陣容</span>
            <span class="crew-info">
              <span class="crew-name">${esc(card.name)}</span>
              <span class="crew-meta"><span>${esc(card.tier)}</span><span class="role">${esc(card.roleType)}</span><span>Lv.1</span></span>
            </span>
          </article>`;
      }
      function readiness(side) {
        const target = side === "left" ? ui.leftReady : ui.rightReady;
        target.classList.toggle("ready", locked[side]);
        target.textContent = locked[side] ? "已鎖定" : `選擇中 ${picks[side].length}/3`;
      }
      function render() {
        ui.leftCrew.innerHTML = crew.left.map((card, index) => cardMarkup(card, "left", index)).join("");
        ui.rightCrew.innerHTML = crew.right.map((card, index) => cardMarkup(card, "right", index)).join("");
        readiness("left");
        readiness("right");
        const bothLocked = locked.left && locked.right;
        const currentLocked = locked[localSide];
        ui.sideToggle.textContent = `模擬操作：${localSide === "left" ? "左方" : "右方"}`;
        ui.lockBtn.disabled = currentLocked || picks[localSide].length !== 3;
        ui.lockBtn.textContent = currentLocked ? "本方已鎖定" : picks[localSide].length === 3 ? "鎖定三名出戰角色" : "選滿三人後鎖定";
        if (bothLocked) {
          ui.secretState.innerHTML = "<strong>雙方陣容揭曉</strong><br>出戰順序以 1、2、3 標示";
          ui.lockBtn.disabled = true;
          ui.lockBtn.textContent = "準備完成";
        } else if (currentLocked) {
          ui.secretState.innerHTML = `<strong>本方已鎖定</strong><br>等待${localSide === "left" ? "右方" : "左方"}完成選擇`;
        } else {
          ui.secretState.innerHTML = `<strong>${localSide === "left" ? "左方" : "右方"}秘密選擇中</strong><br>對手只會看到是否鎖定`;
        }
        ui.room.querySelectorAll(".crew-card").forEach((button) => {
          button.addEventListener("click", onCardClick);
          button.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onCardClick({ currentTarget: button });
          });
        });
      }
      function onCardClick(event) {
        const button = event.currentTarget;
        const side = button.dataset.side;
        const index = Number(button.dataset.index);
        const card = crew[side]?.[index];
        if (!card) return;
        if (side !== localSide || locked[side] || (locked.left && locked.right)) {
          openDetail(card);
          return;
        }
        if (formalMode) {
          postFormalCommand("toggle-pick", { index, cardId: card.id });
          return;
        }
        const current = picks[side].indexOf(index);
        if (current >= 0) picks[side].splice(current, 1);
        else if (picks[side].length < 3) picks[side].push(index);
        else openDetail(card);
        render();
      }
      function openDetail(card) {
        const stats = levelStats(card);
        const moves = (card.moveSet || []).slice(0, 6);
        ui.detailPanel.innerHTML = `
          <img class="detail-frame-art" src="images/board/spar_ui/spar_character_detail_overlay_frame_v1.webp" alt="" aria-hidden="true">
          <div class="detail-head">
            <img class="detail-portrait" src="${esc(portrait(card))}" alt="${esc(card.name)}">
            <span class="detail-attribute">${esc(card.attribute)}</span>
            <strong class="detail-portrait-name">${esc(card.name)}</strong>
            <div class="detail-title">
              <h2 id="detailName">${esc(card.name)}</h2>
              <p>${esc(card.tier)} · Lv.1 · ${esc(card.roleType)} · ${esc(card.attribute)}屬性</p>
            </div>
            <div class="stats">
              ${[["HP", stats.hp], ["攻擊", stats.atk], ["防禦", stats.def], ["特攻", stats.satk], ["特防", stats.sdef], ["速度", stats.spd]].map(([label, value]) => `<span class="stat"><small>${label}</small><b>${value}</b></span>`).join("")}
            </div>
          </div>
          <div class="detail-body">
            <p class="passive"><b>角色特性｜</b>${esc(card.passive || "無")}</p>
            <div class="moves">
              ${moves.map((move) => `<div class="move"><b>${esc(move.name)}</b><span>${esc(move.effectText || "—")}</span><em>威力 ${Number(move.power || 0)}</em></div>`).join("")}
            </div>
          </div>
          <button class="detail-close" type="button">返回準備室</button>`;
        ui.detailBackdrop.classList.add("open");
        ui.detailPanel.querySelector(".detail-close").addEventListener("click", closeDetail);
      }
      function closeDetail() { ui.detailBackdrop.classList.remove("open"); }
      function postFormalCommand(type, payload = {}) {
        if (!formalMode || !formalSparId) return;
        window.parent.postMessage({
          type: "board-spar-selection-command",
          command: {
            id: `spar-selection-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type,
            sparId: formalSparId,
            payload,
          },
        }, window.location.protocol === "file:" ? "*" : window.location.origin);
      }
      function replaceArray(target, values) {
        target.splice(0, target.length, ...(Array.isArray(values) ? values.map(Number).filter(Number.isInteger) : []));
      }
      function applyFormalView(view) {
        if (!formalMode || !view || !view.id) return;
        formalSparId = String(view.id);
        localSide = view.localSide === "right" ? "right" : "left";
        ["left", "right"].forEach((side) => {
          const participant = view[side] || {};
          crew[side] = Array.isArray(participant.crew) ? participant.crew.filter(Boolean).slice(0, 6) : [];
          locked[side] = Boolean(participant.locked);
          replaceArray(picks[side], participant.picks);
          const nameNode = side === "left" ? ui.leftPlayerName : ui.rightPlayerName;
          if (nameNode) nameNode.textContent = participant.name || (side === "left" ? "左方玩家" : "右方玩家");
        });
        ui.room.classList.toggle("reveal-flash", locked.left && locked.right);
        render();
      }
      ui.detailBackdrop.addEventListener("click", (event) => { if (event.target === ui.detailBackdrop) closeDetail(); });
      ui.sideToggle.addEventListener("click", () => { if (!formalMode) { localSide = localSide === "left" ? "right" : "left"; render(); } });
      ui.lockBtn.addEventListener("click", () => {
        if (picks[localSide].length !== 3 || locked[localSide]) return;
        if (formalMode) {
          postFormalCommand("lock", {});
          return;
        }
        locked[localSide] = true;
        if (localSide === "left" && !locked.right) localSide = "right";
        else if (localSide === "right" && !locked.left) localSide = "left";
        render();
        if (locked.left && locked.right) ui.room.classList.add("reveal-flash");
      });
      ui.resetBtn.addEventListener("click", () => {
        if (formalMode) return;
        picks.left.length = 0;
        picks.right.length = 0;
        locked.left = false;
        locked.right = false;
        localSide = "left";
        ui.room.classList.remove("reveal-flash");
        render();
      });
      window.addEventListener("message", (event) => {
        if (!formalMode || (window.location.protocol !== "file:" && event.origin !== window.location.origin)) return;
        if (event.data?.type === "board-spar-selection-update") applyFormalView(event.data.view);
      });
      if (formalMode) {
        window.parent.postMessage({ type: "board-spar-selection-ready" }, window.location.protocol === "file:" ? "*" : window.location.origin);
      }
      render();
return {functions:{esc,portrait,levelStats,attributeClass,cardMarkup,readiness,render,onCardClick,openDetail,closeDetail,postFormalCommand,replaceArray,applyFormalView},get state(){return {crew,picks,locked,localSide,formalSparId};}};
};
