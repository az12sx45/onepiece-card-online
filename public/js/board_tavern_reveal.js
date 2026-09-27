(function () {
  "use strict";
  if (window.BoardTavernReveal) return;

  const COLORS = { S: "#ffe27a", A: "#dca4ff", B: "#9fc4ff", C: "#9fdaa9", D: "#cad2db", E: "#d7b786" };
  const ART = "images/board/tavern_recruit/cinematic_v1/";
  const seen = new WeakSet();
  const validators = new WeakMap();
  let active = null;
  let masksPromise = null;

  function loadMasks() {
    if (!masksPromise) {
      masksPromise = fetch(new URL("images/board-depth/v1/manifest.json", document.baseURI))
        .then(response => { if (!response.ok) throw new Error("Portrait masks unavailable"); return response.json(); })
        .catch(() => { masksPromise = null; return null; });
    }
    return masksPromise;
  }

  async function preparePortrait(portrait) {
    await portrait.decode();
    const manifest = await loadMasks();
    const key = decodeURIComponent(new URL(portrait.src, document.baseURI).pathname).replace(/^\/+/, "");
    const entry = manifest?.assets?.[key];
    if (entry?.visualReview === "approved" && entry.size?.[0] === portrait.naturalWidth &&
        entry.size?.[1] === portrait.naturalHeight && /^images\/board-depth\/v1\/[a-zA-Z0-9_./-]+$/.test(entry.mask)) {
      const mask = new Image();
      mask.src = new URL(entry.mask, document.baseURI).href;
      await mask.decode();
      if (mask.naturalWidth !== portrait.naturalWidth || mask.naturalHeight !== portrait.naturalHeight) throw new Error("Portrait mask dimensions differ");
      portrait.style.maskImage = 'url("' + mask.src + '")';
      portrait.style.webkitMaskImage = 'url("' + mask.src + '")';
      portrait.dataset.portraitMask = entry.mask;
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(portrait, 0, 0, 32, 32);
    const pixels = context.getImageData(0, 0, 32, 32).data;
    if (!pixels.some((value, index) => index % 4 === 3 && value < 248)) throw new Error("No safe portrait silhouette");
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  }
  function picture(className, src) {
    const img = element("img", className);
    img.crossOrigin = "anonymous";
    img.src = src;
    img.alt = "";
    img.draggable = false;
    return img;
  }
  function button(className, label) {
    const node = element("button", className, label);
    node.type = "button";
    node.dataset.boardSfx = "off";
    return node;
  }

  function present(result, outcome = "invite", callbacks = {}) {
    const spectator = result?.dataset.tavernSpectator === "1";
    const reaction = outcome === "accept" || outcome === "decline";
    const complete = () => { if (reaction && !spectator) callbacks.complete?.(); };
    const modal = result?.closest(".board-modal-backdrop");
    const valid = callbacks.valid || validators.get(result);
    const current = () => result?.isConnected && (!modal || modal.classList.contains("open")) && (!valid || valid());
    if (!current()) { callbacks.cancel?.(); return; }
    const host = window.BoardTavernCrew?.get(result.dataset.tavernHost);
    if (!host || window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        getComputedStyle(document.documentElement).getPropertyValue("--tavern-reveal-ready").trim() !== "2") {
      complete();
      return;
    }
    const source = result.querySelector(".tavern-result-art img");
    const name = result.querySelector(".tavern-result-name")?.textContent?.trim();
    if (!source || !name) { complete(); return; }
    active?.finish("cancel", false);

    const performance = host[reaction ? outcome : "invite"];
    const grade = Object.hasOwn(COLORS, result.dataset.grade) ? result.dataset.grade : "E";
    const overlay = element("section", "tavern-reveal-overlay");
    Object.assign(overlay.dataset, { stage: reaction ? outcome : "invitation", grade, host: host.id, motion: performance.motion, spectator: spectator ? "1" : "0" });
    overlay.style.setProperty("--tavern-reveal-color", COLORS[grade]);
    overlay.style.setProperty("--tavern-host-color", host.accent);
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "酒館招募");
    const scene = element("div", "tavern-reveal-scene");
    const scenery = picture("tavern-reveal-backdrop", `${ART}doorway.webp`);
    scene.append(scenery);
    const images = [scenery];
    let portrait;
    if (!reaction) {
      const portal = element("div", "tavern-reveal-portal");
      portal.append(element("div", "tavern-reveal-light"));
      portrait = picture("tavern-reveal-character", source.currentSrc || source.src);
      portal.append(portrait);
      const doors = element("div", "tavern-reveal-doors");
      ["left", "right"].forEach(side => {
        const leaf = element("div", `tavern-reveal-door ${side}`);
        const door = picture("", `${ART}doors.webp`);
        leaf.append(door);
        doors.append(leaf);
        images.push(door);
      });
      portal.append(doors);
      scene.append(portal);
      images.push(portrait);
    }
    const hostArt = picture("tavern-reveal-host", performance.image);
    hostArt.alt = host.name;
    const hostFrame = element("div", "tavern-reveal-host-frame");
    hostFrame.append(hostArt);
    images.push(hostArt);
    const speech = element("div", "tavern-reveal-invitation");
    speech.setAttribute("aria-live", "polite");
    speech.append(element("span", "tavern-reveal-speaker", host.name), element("span", "tavern-reveal-role", host.role), element("p", "tavern-reveal-line", performance.line));
    if (reaction) speech.append(element("span", "tavern-reveal-decision", outcome === "accept" ? `與 ${name} 一起出航` : `向 ${name} 道別`));
    const caption = element("div", "tavern-reveal-caption");
    caption.setAttribute("aria-live", "polite");
    caption.append(element("span", "tavern-reveal-rank", `${grade} 級`), element("h2", "tavern-reveal-name", name));
    caption.hidden = true;
    const choices = element("div", "tavern-reveal-choices");
    choices.hidden = true;
    const full = result.classList.contains("is-full-crew");
    const accept = button("tavern-reveal-choice primary", full ? "選擇替換夥伴" : "加入");
    accept.dataset.tavernChoice = "accept";
    const decline = button("tavern-reveal-choice secondary", "不加入");
    decline.dataset.tavernChoice = "decline";
    if (!spectator && !reaction) choices.append(accept, decline);
    caption.append(choices);
    const skip = button("tavern-reveal-skip", "跳過動畫");
    skip.dataset.tavernRevealSkip = "";
    overlay.append(scene, hostFrame, speech, caption, skip);

    const focusBefore = document.activeElement;
    const previousInert = result.inert;
    const buttons = Array.from(result.querySelectorAll("button"), node => ({ node, disabled: node.disabled }));
    const timers = [];
    let finished = false;
    let started = false;
    result.inert = true;
    buttons.forEach(({ node }) => { node.disabled = true; });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("tavern-reveal-playing");

    function finish(reason = "complete", restoreFocus = true) {
      if (finished) return;
      finished = true;
      const mayComplete = reason !== "cancel" && current();
      timers.forEach(clearTimeout);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("click", guardClick, true);
      document.removeEventListener("focusin", guardFocus, true);
      result.inert = previousInert;
      buttons.forEach(({ node, disabled }) => { node.disabled = disabled; });
      overlay.remove();
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("tavern-reveal-playing");
      if (active?.overlay === overlay) active = null;
      if (restoreFocus && current()) {
        const target = result.querySelector("button:not(:disabled)") || (focusBefore?.isConnected ? focusBefore : null);
        target?.focus({ preventScroll: true });
      }
      if (mayComplete) complete();
      else callbacks.cancel?.();
    }
    function guardClick(event) {
      if (overlay.contains(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    const focusable = () => [...overlay.querySelectorAll("button:not(:disabled)")].filter(node => node.getClientRects().length);
    function guardFocus(event) {
      if (!overlay.contains(event.target)) (focusable()[0] || skip).focus({ preventScroll: true });
    }
    function onKey(event) {
      event.stopImmediatePropagation();
      if (event.key === "Escape") { event.preventDefault(); finish("skip"); }
      else if (event.key === "Tab") {
        event.preventDefault();
        const controls = focusable();
        const index = controls.indexOf(document.activeElement);
        controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
      } else if (!["Enter", " "].includes(event.key) || !focusable().includes(event.target)) event.preventDefault();
    }
    const later = (delay, action) => timers.push(setTimeout(() => { if (!finished) action(); }, delay));
    function stage(value) {
      overlay.dataset.stage = value;
      if (value === "glow") {
        try { window.BoardAudio?.playCue("draw"); } catch (_) {}
      }
      if (value === "reveal") {
        caption.hidden = false;
        portrait.alt = name;
        try { window.BoardAudio?.playCue("reward"); } catch (_) {}
      }
      if (value === "choice") {
        portrait.classList.add("tavern-reveal-choice-portrait");
        overlay.append(portrait);
        choices.hidden = false;
        skip.textContent = "查看角色詳情";
        accept.focus({ preventScroll: true });
      }
    }
    function forwardChoice(selector) {
      const original = result.querySelector(selector);
      const permitted = current() && buttons.some(entry => entry.node === original && !entry.disabled);
      finish("skip", false);
      if (permitted && !original.disabled) original.click();
    }
    accept.addEventListener("click", () => {
      if (finished || overlay.dataset.stage !== "choice") return;
      if (full) finish("skip");
      else forwardChoice("#acceptRecruitBtn");
    });
    decline.addEventListener("click", () => {
      if (!finished && overlay.dataset.stage === "choice") forwardChoice("#rejectRecruitBtn, #rejectFullRecruitBtn");
    });

    function begin() {
      if (finished || started) return;
      started = true;
      overlay.dataset.ready = "1";
      if (reaction) {
        later(2600, () => finish());
      } else {
        [host.accept, host.decline].forEach(entry => { const image = new Image(); image.src = entry.image; image.decode().catch(() => {}); });
        later(2300, () => stage("glow"));
        later(3600, () => stage("silhouette"));
        later(5000, () => stage("reveal"));
        later(6700, () => {
          if (spectator || result.dataset.tavernAuto === "1") finish();
          else stage("choice");
        });
      }
    }
    images.forEach(img => img.addEventListener("error", () => finish(), { once: true }));
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("click", guardClick, true);
    document.addEventListener("focusin", guardFocus, true);
    skip.addEventListener("click", () => finish("skip"));
    document.body.append(overlay);
    active = { overlay, result, modal, current, finish };
    skip.focus({ preventScroll: true });
    const guard = () => { if (!current()) finish("cancel", false); else later(100, guard); };
    later(100, guard);
    Promise.all([...images.map(img => img.decode()), ...(portrait ? [preparePortrait(portrait)] : [])]).then(begin, () => finish());
    later(3000, () => { if (!started) finish(); });
  }
  function scan() {
    if (document.querySelector(".tavern-nautical-modal")) loadMasks();
    if (active && !active.current()) active.finish("cancel", false);
    document.querySelectorAll('.tavern-result-ui[data-tavern-reveal="v2"]').forEach(result => {
      const backdrop = result.closest(".board-modal-backdrop");
      if (seen.has(result) || (backdrop && !backdrop.classList.contains("open"))) return;
      seen.add(result);
      present(result, result.dataset.tavernOutcome);
    });
  }
  function install() {
    const modal = document.getElementById("boardModalBack") || document.getElementById("boardModal")?.parentElement;
    const observer = new MutationObserver(scan);
    observer.observe(modal || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    scan();
  }
  window.BoardTavernReveal = Object.freeze({
    version: "2", scan,
    watch: (result, valid) => { if (result && typeof valid === "function") validators.set(result, valid); },
    respond: (result, outcome, callbacks) => present(result, outcome, callbacks),
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
