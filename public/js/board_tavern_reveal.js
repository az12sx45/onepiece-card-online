(function () {
  "use strict";
  if (window.BoardTavernReveal) return;

  const COLORS = { S: "#ffe27a", A: "#dca4ff", B: "#9fc4ff", C: "#9fdaa9", D: "#cad2db", E: "#d7b786" };
  const ART = "images/board/tavern_recruit/cinematic_v1/";
  const seen = new WeakSet();
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
    // Already-transparent portraits need no derived mask. Opaque/unavailable ones fall through to the original result.
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

  function play(result) {
    if (seen.has(result) || !result.isConnected) return;
    seen.add(result);
    // The original result and its handlers remain the sole recruitment authority.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (getComputedStyle(document.documentElement).getPropertyValue("--tavern-reveal-ready").trim() !== "1") return;
    const source = result.querySelector(".tavern-result-art img");
    const name = result.querySelector(".tavern-result-name")?.textContent?.trim();
    if (!source || !name) return;
    active?.finish(false);

    const grade = Object.hasOwn(COLORS, result.dataset.grade) ? result.dataset.grade : "E";
    const modal = result.closest(".board-modal-backdrop");
    const overlay = element("section", "tavern-reveal-overlay");
    overlay.dataset.stage = "invitation";
    overlay.dataset.grade = grade;
    overlay.style.setProperty("--tavern-reveal-color", COLORS[grade]);
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "酒館招募");

    const scene = element("div", "tavern-reveal-scene");
    const scenery = picture("tavern-reveal-backdrop", `${ART}doorway.webp`);
    const portal = element("div", "tavern-reveal-portal");
    portal.append(element("div", "tavern-reveal-light"));
    const portrait = picture("tavern-reveal-character", source.currentSrc || source.src);
    portal.append(portrait);
    const doors = element("div", "tavern-reveal-doors");
    ["left", "right"].forEach(side => {
      const leaf = element("div", `tavern-reveal-door ${side}`);
      leaf.append(picture("", `${ART}doors.webp`));
      doors.append(leaf);
    });
    portal.append(doors);
    const captain = picture("tavern-reveal-luffy", `${ART}luffy_invite.webp`);
    scene.append(scenery, portal, captain);

    const invitation = element("div", "tavern-reveal-invitation");
    invitation.append(element("span", "tavern-reveal-speaker", "蒙其・D・魯夫"), element("p", "", "你願不願意加入我們？"));
    const caption = element("div", "tavern-reveal-caption");
    caption.setAttribute("aria-live", "polite");
    caption.append(element("span", "tavern-reveal-rank", `${grade} 級`), element("h2", "tavern-reveal-name", name), element("p", "", "新的冒險，等你一起出航。"));
    caption.hidden = true;
    const skip = element("button", "tavern-reveal-skip", "跳過動畫");
    skip.type = "button";
    skip.dataset.tavernRevealSkip = "";
    skip.dataset.boardSfx = "off";
    overlay.append(scene, invitation, caption, skip);

    const focusBefore = document.activeElement;
    const previousInert = result.inert;
    const buttons = Array.from(result.querySelectorAll("button"), button => ({ button, disabled: button.disabled }));
    const timers = [];
    let finished = false;
    let started = false;
    result.inert = true;
    buttons.forEach(({ button }) => { button.disabled = true; });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("tavern-reveal-playing");

    function finish(restoreFocus = true) {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("click", guardClick, true);
      document.removeEventListener("focusin", guardFocus, true);
      result.inert = previousInert;
      buttons.forEach(({ button, disabled }) => { button.disabled = disabled; });
      overlay.remove();
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("tavern-reveal-playing");
      if (active?.overlay === overlay) active = null;
      if (restoreFocus && result.isConnected) {
        const target = result.querySelector("button:not(:disabled)") || (focusBefore?.isConnected ? focusBefore : null);
        target?.focus({ preventScroll: true });
      }
    }

    function guardClick(event) {
      if (overlay.contains(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    function guardFocus(event) {
      if (!overlay.contains(event.target)) skip.focus({ preventScroll: true });
    }

    function onKey(event) {
      event.stopImmediatePropagation();
      if (event.key === "Escape") { event.preventDefault(); finish(); }
      else if (event.key === "Tab") { event.preventDefault(); skip.focus(); }
      else if (!["Enter", " "].includes(event.key) || event.target !== skip) event.preventDefault();
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
    }

    function begin() {
      if (finished || started) return;
      started = true;
      later(1700, () => stage("glow"));
      later(3000, () => stage("silhouette"));
      later(4400, () => stage("reveal"));
      later(6900, () => finish());
    }

    // Slow or unavailable artwork must never strand the original result controls.
    const images = [scenery, captain, portrait, ...doors.querySelectorAll("img")];
    images.forEach(img => img.addEventListener("error", () => finish(), { once: true }));
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("click", guardClick, true);
    document.addEventListener("focusin", guardFocus, true);
    skip.addEventListener("click", () => finish());
    document.body.append(overlay);
    active = { overlay, result, modal, finish };
    skip.focus({ preventScroll: true });
    Promise.all([...images.map(img => img.decode()), preparePortrait(portrait)]).then(begin, () => finish());
    later(3000, () => { if (!started) finish(); });
  }

  function scan() {
    if (document.querySelector(".tavern-nautical-modal")) loadMasks();
    if (active && (!active.result.isConnected || (active.modal && !active.modal.classList.contains("open")))) active.finish(false);
    document.querySelectorAll('.tavern-result-ui[data-tavern-reveal="v1"]').forEach(result => {
      const backdrop = result.closest(".board-modal-backdrop");
      if (!backdrop || backdrop.classList.contains("open")) play(result);
    });
  }

  function install() {
    const modal = document.getElementById("boardModalBack") || document.getElementById("boardModal")?.parentElement;
    const observer = new MutationObserver(scan);
    observer.observe(modal || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    scan();
  }

  window.BoardTavernReveal = Object.freeze({ version: "1", scan });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
