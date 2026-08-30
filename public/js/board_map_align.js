(function () {
  const STORAGE_KEY = "board-map-align-v1";
  const SEA_TILE_COUNT = 5;
  const STICKER_PRESETS = [
    { id: "sea_beast_01", label: "海獸 1", type: "sea-beast", asset: "images/board/decorations/sea_beasts/sea_beast_01.webp", fallback: "海獸1", size: 140 },
    { id: "sea_beast_02", label: "海獸 2", type: "sea-beast", asset: "images/board/decorations/sea_beasts/sea_beast_02.webp", fallback: "海獸2", size: 140 },
    { id: "sea_beast_03", label: "海獸 3", type: "sea-beast", asset: "images/board/decorations/sea_beasts/sea_beast_03.webp", fallback: "海獸3", size: 140 },
    { id: "sea_beast_04", label: "海獸 4", type: "sea-beast", asset: "images/board/decorations/sea_beasts/sea_beast_04.webp", fallback: "海獸4", size: 140 },
    { id: "sea_beast_05", label: "海獸 5", type: "sea-beast", asset: "images/board/decorations/sea_beasts/sea_beast_05.webp", fallback: "海獸5", size: 140 },
    { id: "sea_beast_06", label: "海獸 6", type: "sea-beast", asset: "images/board/decorations/sea_beasts/sea_beast_06.webp", fallback: "海獸6", size: 140 },
    { id: "sea_beast_07", label: "海獸 7", type: "sea-beast", asset: "images/board/decorations/sea_beasts/sea_beast_07.webp", fallback: "海獸7", size: 140 },
    { id: "reef_01", label: "礁岩 1", type: "reef", asset: "images/board/decorations/reefs/reef_01.webp", fallback: "礁岩1", size: 110 },
    { id: "reef_02", label: "礁岩 2", type: "reef", asset: "images/board/decorations/reefs/reef_02.webp", fallback: "礁岩2", size: 110 },
    { id: "reef_03", label: "礁岩 3", type: "reef", asset: "images/board/decorations/reefs/reef_03.webp", fallback: "礁岩3", size: 110 },
    { id: "reef_04", label: "礁岩 4", type: "reef", asset: "images/board/decorations/reefs/reef_04.webp", fallback: "礁岩4", size: 110 },
    { id: "reef_05", label: "礁岩 5", type: "reef", asset: "images/board/decorations/reefs/reef_05.webp", fallback: "礁岩5", size: 110 },
  ];
  const STICKER_PRESET_MAP = Object.fromEntries(STICKER_PRESETS.map((preset) => [preset.id, preset]));

  const refs = {
    stage: document.getElementById("stage"),
    mapImage: document.getElementById("mapImage"),
    overlay: document.getElementById("overlay"),
    markerList: document.getElementById("markerList"),
    selectedX: document.getElementById("selectedX"),
    selectedY: document.getElementById("selectedY"),
    selectedSize: document.getElementById("selectedSize"),
    selectedRotation: document.getElementById("selectedRotation"),
    selectedSizeWrap: document.getElementById("selectedSizeWrap"),
    selectedRotationWrap: document.getElementById("selectedRotationWrap"),
    gridOriginX: document.getElementById("gridOriginX"),
    gridOriginY: document.getElementById("gridOriginY"),
    gridSpacingX: document.getElementById("gridSpacingX"),
    gridSpacingY: document.getElementById("gridSpacingY"),
    importBox: document.getElementById("importBox"),
    importLayoutBtn: document.getElementById("importLayoutBtn"),
    markerScale: document.getElementById("markerScale"),
    stickerPreset: document.getElementById("stickerPreset"),
    addStickerBtn: document.getElementById("addStickerBtn"),
    deleteStickerBtn: document.getElementById("deleteStickerBtn"),
    exportBox: document.getElementById("exportBox"),
    copyJsonBtn: document.getElementById("copyJsonBtn"),
    copyJsBtn: document.getElementById("copyJsBtn"),
    regenerateSeaTilesBtn: document.getElementById("regenerateSeaTilesBtn"),
    resetBtn: document.getElementById("resetBtn"),
  };

  const defaultState = {
    markers: {
      loguetown: { label: "羅格鎮", xRatio: 0.0765, yRatio: 0.5, className: "loguetown" },
      reverse: { label: "顛倒山", xRatio: 0.2315, yRatio: 0.5, className: "reverse" },
    },
    grid: {
      originXRatio: 0.3445,
      originYRatio: 0.1758,
      spacingXRatio: 0.0780,
      spacingYRatio: 0.1040,
    },
    islands: buildDefaultIslandRatios(),
    seaTiles: {},
    decorations: {},
  };

  function buildDefaultIslandRatios() {
    const originX = 0.3445;
    const originY = 0.1758;
    const spacingX = 0.0780;
    const spacingY = 0.1040;
    const islands = {};
    let index = 1;
    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 7; col += 1) {
        islands[`island${index}`] = {
          label: `島 ${index}`,
          xRatio: originX + spacingX * col,
          yRatio: originY + spacingY * row,
          className: [8, 15, 22, 29, 36].includes(index) ? "entrance" : "grid-island",
          gridIndex: index,
        };
        index += 1;
      }
    }
    return islands;
  }

  const state = loadState();
  let selectedMarkerId = "reverse";
  let selectedMarkerIds = new Set([selectedMarkerId]);
  let naturalWidth = 2048;
  let naturalHeight = 1536;
  let dragState = null;
  let suppressClickMarkerId = null;

  function cloneState(input) {
    return JSON.parse(JSON.stringify(input));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneState(defaultState);
      const parsed = JSON.parse(raw);
      const next = {
        markers: { ...cloneState(defaultState).markers, ...(parsed.markers || {}) },
        grid: { ...cloneState(defaultState).grid, ...(parsed.grid || {}) },
        islands: { ...cloneState(defaultState).islands, ...(parsed.islands || {}) },
        seaTiles: { ...cloneState(defaultState).seaTiles, ...(parsed.seaTiles || {}) },
        decorations: { ...cloneState(defaultState).decorations, ...(parsed.decorations || {}) },
      };
      sanitizeEditorState(next);
      return next;
    } catch (_error) {
      return cloneState(defaultState);
    }
  }

  function sanitizeEditorState(targetState) {
    if (targetState.markers?.fixed) delete targetState.markers.fixed;
    const validRoutes = new Set(routeDefs().map((route) => route.id));
    const filteredSeaTiles = Object.fromEntries(
      Object.entries(targetState.seaTiles || {}).filter(([, tile]) => validRoutes.has(tile.routeId))
    );
    const generatedSeaTiles = buildSeaTileRatios(targetState);
    targetState.seaTiles = {
      ...generatedSeaTiles,
      ...filteredSeaTiles,
    };
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function pxFromRatioX(ratio) {
    return Math.round(ratio * naturalWidth);
  }

  function pxFromRatioY(ratio) {
    return Math.round(ratio * naturalHeight);
  }

  function ratioFromPixel(clientX, clientY) {
    const rect = refs.mapImage.getBoundingClientRect();
    const x = clamp((clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((clientY - rect.top) / rect.height, 0, 1);
    return { x, y };
  }

  function renderedImageWidth() {
    return refs.mapImage.getBoundingClientRect().width || naturalWidth;
  }

  function markerEntries() {
    return Object.entries(state.markers);
  }

  function islandEntries() {
    return Object.entries(state.islands).sort((a, b) => (a[1].gridIndex || 0) - (b[1].gridIndex || 0));
  }

  function seaTileEntries() {
    return Object.entries(state.seaTiles || {}).sort((a, b) => {
      const routeCompare = String(a[1].routeId || "").localeCompare(String(b[1].routeId || ""));
      if (routeCompare) return routeCompare;
      return (a[1].step || 0) - (b[1].step || 0);
    });
  }

  function decorationEntries() {
    return Object.entries(state.decorations || {}).sort((a, b) => String(a[1].label || a[0]).localeCompare(String(b[1].label || b[0])));
  }

  function allEntries() {
    return [...markerEntries(), ...islandEntries(), ...seaTileEntries(), ...decorationEntries()];
  }

  function applySelection(id, additive = false) {
    if (!additive) {
      selectedMarkerId = id;
      selectedMarkerIds = new Set([id]);
      return;
    }
    const next = new Set(selectedMarkerIds);
    if (next.has(id) && next.size > 1) {
      next.delete(id);
    } else {
      next.add(id);
      selectedMarkerId = id;
    }
    if (!next.size) next.add(id);
    if (!next.has(selectedMarkerId)) {
      selectedMarkerId = [...next][next.size - 1];
    }
    selectedMarkerIds = next;
  }

  function renderMarkerList() {
    refs.markerList.innerHTML = "";
    [...markerEntries(), ...islandEntries(), ...decorationEntries()].forEach(([id, marker]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `marker-btn${selectedMarkerIds.has(id) ? " active" : ""}`;
      btn.textContent = marker.label;
      btn.addEventListener("click", (event) => {
        applySelection(id, event.ctrlKey || event.metaKey);
        syncSelectedFields();
        renderMarkerList();
        renderOverlay();
      });
      refs.markerList.appendChild(btn);
    });
  }

  function renderOverlay() {
    refs.overlay.innerHTML = "";
    allEntries().forEach(([id, marker]) => {
      const node = document.createElement("button");
      node.type = "button";
      node.className = `marker ${marker.className}${selectedMarkerIds.has(id) ? " selected" : ""}`;
      node.style.left = `${marker.xRatio * 100}%`;
      node.style.top = `${marker.yRatio * 100}%`;
      node.textContent = shortLabel(marker.label);
      node.dataset.markerId = id;
      node.addEventListener("pointerdown", beginDrag);
      node.addEventListener("click", (event) => {
        if (suppressClickMarkerId === id) {
          suppressClickMarkerId = null;
          return;
        }
        applySelection(id, event.ctrlKey || event.metaKey);
        syncSelectedFields();
        renderMarkerList();
        renderOverlay();
      });
      refs.overlay.appendChild(node);
    });
    decorationEntries().forEach(([id, item]) => {
      const preset = STICKER_PRESET_MAP[item.presetId] || {};
      const node = document.createElement("div");
      node.className = `sticker ${item.type === "reef" ? "sticker-reef" : "sticker-beast"}${selectedMarkerIds.has(id) ? " selected" : ""}`;
      node.style.left = `${item.xRatio * 100}%`;
      node.style.top = `${item.yRatio * 100}%`;
      node.style.width = `${Math.max(12, item.sizePx || preset.size || 120)}px`;
      node.style.height = `${Math.max(12, item.sizePx || preset.size || 120)}px`;
      node.style.transform = `translate(-50%,-50%) rotate(${Number(item.rotation || 0)}deg)`;
      node.dataset.markerId = id;
      node.addEventListener("pointerdown", beginDrag);
      node.addEventListener("click", (event) => {
        if (suppressClickMarkerId === id) {
          suppressClickMarkerId = null;
          return;
        }
        applySelection(id, event.ctrlKey || event.metaKey);
        syncSelectedFields();
        renderMarkerList();
        renderOverlay();
      });
      const image = document.createElement("img");
      image.src = item.asset || preset.asset || "";
      image.alt = item.label || preset.label || "貼紙";
      image.loading = "lazy";
      image.addEventListener("error", () => {
        image.classList.add("hidden");
        fallback.classList.remove("hidden");
      }, { once: true });
      const fallback = document.createElement("div");
      fallback.className = "sticker-fallback hidden";
      fallback.textContent = item.fallback || preset.fallback || item.label || "貼紙";
      node.appendChild(image);
      node.appendChild(fallback);
      refs.overlay.appendChild(node);
    });
    renderExport();
  }

  function shortLabel(label) {
    if (label === "羅格鎮") return "起";
    if (label === "固定節點") return "固";
    if (label === "顛倒山") return "顛";
    if (label.startsWith("海格")) return "";
    return label.replace("入口 ", "");
  }

  function syncSelectedFields() {
    const marker = getSelectedItem();
    if (!marker) return;
    refs.selectedX.value = pxFromRatioX(marker.xRatio);
    refs.selectedY.value = pxFromRatioY(marker.yRatio);
    const decoration = isDecoration(marker);
    refs.selectedSizeWrap.classList.toggle("hidden", !decoration);
    refs.selectedRotationWrap.classList.toggle("hidden", !decoration);
    refs.deleteStickerBtn.disabled = !decoration;
    if (decoration) {
      refs.selectedSize.value = Math.round(marker.sizePx || 0);
      refs.selectedRotation.value = Number(marker.rotation || 0);
    } else {
      refs.selectedSize.value = "";
      refs.selectedRotation.value = "";
    }
    refs.gridOriginX.value = pxFromRatioX(state.grid.originXRatio);
    refs.gridOriginY.value = pxFromRatioY(state.grid.originYRatio);
    refs.gridSpacingX.value = Math.round(state.grid.spacingXRatio * naturalWidth);
    refs.gridSpacingY.value = Math.round(state.grid.spacingYRatio * naturalHeight);
  }

  function renderExport() {
    const output = {
      image: {
        width: naturalWidth,
        height: naturalHeight,
      },
      markers: Object.fromEntries(markerEntries().map(([id, marker]) => [
        id,
        {
          x: pxFromRatioX(marker.xRatio),
          y: pxFromRatioY(marker.yRatio),
        },
      ])),
      islands: Object.fromEntries(islandEntries().map(([id, island]) => [
        id,
        {
          index: island.gridIndex,
          x: pxFromRatioX(island.xRatio),
          y: pxFromRatioY(island.yRatio),
        },
      ])),
      seaTiles: Object.fromEntries(seaTileEntries().map(([id, tile]) => [
        id,
        {
          routeId: tile.routeId,
          step: tile.step,
          x: pxFromRatioX(tile.xRatio),
          y: pxFromRatioY(tile.yRatio),
        },
      ])),
      decorations: Object.fromEntries(decorationEntries().map(([id, item]) => [
        id,
        {
          presetId: item.presetId,
          type: item.type,
          label: item.label,
          asset: item.asset,
          x: pxFromRatioX(item.xRatio),
          y: pxFromRatioY(item.yRatio),
          size: Math.round(item.sizePx || 0),
          sizeRatio: Number(((item.sizePx || 0) / renderedImageWidth()).toFixed(6)),
          rotation: Number(item.rotation || 0),
        },
      ])),
      grid: {
        originX: pxFromRatioX(state.grid.originXRatio),
        originY: pxFromRatioY(state.grid.originYRatio),
        spacingX: Math.round(state.grid.spacingXRatio * naturalWidth),
        spacingY: Math.round(state.grid.spacingYRatio * naturalHeight),
      },
    };

    refs.exportBox.value = JSON.stringify(output, null, 2);
  }

  function beginDrag(event) {
    const markerId = event.currentTarget.dataset.markerId;
    applySelection(markerId, event.ctrlKey || event.metaKey);
    const start = ratioFromPixel(event.clientX, event.clientY);
    const ids = [...selectedMarkerIds].filter((id) => getItemById(id));
    dragState = {
      markerId,
      ids,
      start,
      moved: false,
      origins: Object.fromEntries(ids.map((id) => {
        const item = getItemById(id);
        return [id, { xRatio: item.xRatio, yRatio: item.yRatio }];
      })),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    syncSelectedFields();
    renderMarkerList();
    renderOverlay();
  }

  function moveMarker(clientX, clientY) {
    if (!dragState) return;
    const ratio = ratioFromPixel(clientX, clientY);
    const dx = ratio.x - dragState.start.x;
    const dy = ratio.y - dragState.start.y;
    if (Math.abs(dx) > 0.0005 || Math.abs(dy) > 0.0005) {
      dragState.moved = true;
    }
    dragState.ids.forEach((id) => {
      const marker = getItemById(id);
      const origin = dragState.origins[id];
      if (!marker || !origin) return;
      marker.xRatio = clamp(origin.xRatio + dx, 0, 1);
      marker.yRatio = clamp(origin.yRatio + dy, 0, 1);
    });
    saveState();
    syncSelectedFields();
    renderOverlay();
  }

  function endDrag() {
    if (dragState?.moved) {
      suppressClickMarkerId = dragState.markerId;
    }
    dragState = null;
  }

  function bindInputs() {
    refs.selectedX.addEventListener("change", () => {
      const marker = getSelectedItem();
      marker.xRatio = clamp(Number(refs.selectedX.value) / naturalWidth, 0, 1);
      saveState();
      renderOverlay();
      syncSelectedFields();
    });
    refs.selectedY.addEventListener("change", () => {
      const marker = getSelectedItem();
      marker.yRatio = clamp(Number(refs.selectedY.value) / naturalHeight, 0, 1);
      saveState();
      renderOverlay();
      syncSelectedFields();
    });
    refs.selectedSize.addEventListener("change", () => {
      const item = getSelectedItem();
      if (!item || !isDecoration(item)) return;
      item.sizePx = Math.max(12, Number(refs.selectedSize.value) || 12);
      saveState();
      renderOverlay();
      syncSelectedFields();
    });
    refs.selectedRotation.addEventListener("change", () => {
      const item = getSelectedItem();
      if (!item || !isDecoration(item)) return;
      item.rotation = Number(refs.selectedRotation.value) || 0;
      saveState();
      renderOverlay();
      syncSelectedFields();
    });

    const applyGrid = () => {
      const prevOriginX = state.grid.originXRatio;
      const prevOriginY = state.grid.originYRatio;
      const prevSpacingX = state.grid.spacingXRatio;
      const prevSpacingY = state.grid.spacingYRatio;
      const nextOriginX = clamp(Number(refs.gridOriginX.value) / naturalWidth, 0, 1);
      const nextOriginY = clamp(Number(refs.gridOriginY.value) / naturalHeight, 0, 1);
      const nextSpacingX = clamp(Number(refs.gridSpacingX.value) / naturalWidth, 0.005, 0.4);
      const nextSpacingY = clamp(Number(refs.gridSpacingY.value) / naturalHeight, 0.005, 0.4);
      const islandDefaults = buildDefaultIslandRatios();
      islandEntries().forEach(([id, island]) => {
        const base = islandDefaults[id];
        if (!base) return;
        const colOffset = prevSpacingX ? (island.xRatio - prevOriginX) / prevSpacingX : 0;
        const rowOffset = prevSpacingY ? (island.yRatio - prevOriginY) / prevSpacingY : 0;
        island.xRatio = nextOriginX + colOffset * nextSpacingX;
        island.yRatio = nextOriginY + rowOffset * nextSpacingY;
      });
      state.grid.originXRatio = nextOriginX;
      state.grid.originYRatio = nextOriginY;
      state.grid.spacingXRatio = nextSpacingX;
      state.grid.spacingYRatio = nextSpacingY;
      saveState();
      renderOverlay();
      syncSelectedFields();
    };

    refs.gridOriginX.addEventListener("change", applyGrid);
    refs.gridOriginY.addEventListener("change", applyGrid);
    refs.gridSpacingX.addEventListener("change", applyGrid);
    refs.gridSpacingY.addEventListener("change", applyGrid);

    refs.importLayoutBtn.addEventListener("click", () => {
      const ok = importCustomMapLayout(refs.importBox.value);
      refs.importLayoutBtn.textContent = ok ? "已套用" : "格式錯誤";
      window.setTimeout(() => { refs.importLayoutBtn.textContent = "套用座標"; }, 1200);
    });

    refs.markerScale.addEventListener("input", () => {
      document.documentElement.style.setProperty("--marker-scale", refs.markerScale.value);
      localStorage.setItem(`${STORAGE_KEY}-marker-scale`, refs.markerScale.value);
    });
    refs.addStickerBtn.addEventListener("click", addStickerFromPreset);
    refs.deleteStickerBtn.addEventListener("click", deleteSelectedSticker);

    refs.copyJsonBtn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(refs.exportBox.value);
      refs.copyJsonBtn.textContent = "已複製";
      window.setTimeout(() => { refs.copyJsonBtn.textContent = "複製 JSON"; }, 1200);
    });

    refs.copyJsBtn.addEventListener("click", async () => {
      const jsSnippet = buildJsSnippet();
      await navigator.clipboard.writeText(jsSnippet);
      refs.copyJsBtn.textContent = "已複製";
      window.setTimeout(() => { refs.copyJsBtn.textContent = "複製 JS 常數"; }, 1200);
    });

    refs.regenerateSeaTilesBtn.addEventListener("click", () => {
      state.seaTiles = buildSeaTileRatios();
      saveState();
      syncSelectedFields();
      renderOverlay();
      refs.regenerateSeaTilesBtn.textContent = "已重排海格";
      window.setTimeout(() => { refs.regenerateSeaTilesBtn.textContent = "依節點重排海格"; }, 1200);
    });

    refs.resetBtn.addEventListener("click", () => {
      Object.assign(state, cloneState(defaultState));
      state.seaTiles = buildSeaTileRatios();
      selectedMarkerId = "reverse";
      selectedMarkerIds = new Set([selectedMarkerId]);
      saveState();
      syncSelectedFields();
      renderMarkerList();
      renderOverlay();
    });

    document.addEventListener("pointermove", (event) => moveMarker(event.clientX, event.clientY));
    document.addEventListener("pointerup", endDrag);
    document.addEventListener("pointercancel", endDrag);
  }

  function buildJsSnippet() {
    const m = state.markers;
    const islands = islandEntries().map(([, island]) => ({
      index: island.gridIndex,
      x: pxFromRatioX(island.xRatio),
      y: pxFromRatioY(island.yRatio),
    }));
    const seaTiles = seaTileEntries().map(([, tile]) => ({
      id: tile.id,
      routeId: tile.routeId,
      step: tile.step,
      x: pxFromRatioX(tile.xRatio),
      y: pxFromRatioY(tile.yRatio),
    }));
    const decorations = decorationEntries().map(([id, item]) => ({
      id,
      presetId: item.presetId,
      type: item.type,
      x: pxFromRatioX(item.xRatio),
      y: pxFromRatioY(item.yRatio),
      size: Math.round(item.sizePx || 0),
      rotation: Number(item.rotation || 0),
    }));
    return [
      `const startCoord = { col: ?, row: ? }; // 約對到 px(${pxFromRatioX(m.loguetown.xRatio)}, ${pxFromRatioY(m.loguetown.yRatio)})`,
      `const reverseMountainCoord = { col: ?, row: ? }; // 約對到 px(${pxFromRatioX(m.reverse.xRatio)}, ${pxFromRatioY(m.reverse.yRatio)})`,
      `const gridBasePx = { x: ${pxFromRatioX(state.grid.originXRatio)}, y: ${pxFromRatioY(state.grid.originYRatio)} };`,
      `const gridSpacingPx = { x: ${Math.round(state.grid.spacingXRatio * naturalWidth)}, y: ${Math.round(state.grid.spacingYRatio * naturalHeight)} };`,
      `const customIslandPixels = ${JSON.stringify(islands, null, 2)};`,
      `const customSeaTilePixels = ${JSON.stringify(seaTiles, null, 2)};`,
      `const customDecorationPixels = ${JSON.stringify(decorations, null, 2)};`,
    ].join("\n");
  }

  function getItemById(id) {
    return state.markers[id] || state.islands[id] || state.seaTiles[id] || state.decorations[id] || null;
  }

  function getSelectedItem() {
    return getItemById(selectedMarkerId);
  }

  function parseLayoutInput(rawInput) {
    const raw = String(rawInput || "").trim();
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_jsonError) {
      const objectStart = raw.indexOf("{");
      const objectEnd = raw.lastIndexOf("}");
      if (objectStart < 0 || objectEnd <= objectStart) return null;
      const objectLiteral = raw.slice(objectStart, objectEnd + 1);
      try {
        // Local alignment helper only: accepts JS object literals copied from board_game.js.
        return Function(`"use strict"; return (${objectLiteral});`)();
      } catch (_jsError) {
        return null;
      }
    }
  }

  function importCustomMapLayout(rawInput) {
    const layout = parseLayoutInput(rawInput);
    if (!layout || !layout.markers || !layout.islands) return false;
    const sourceWidth = Number(layout.widthPx || layout.image?.width || naturalWidth);
    const sourceHeight = Number(layout.heightPx || layout.image?.height || naturalHeight);
    if (!sourceWidth || !sourceHeight) return false;

    Object.entries(layout.markers).forEach(([id, point]) => {
      const marker = state.markers[id];
      if (!marker || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
      marker.xRatio = clamp(point.x / sourceWidth, 0, 1);
      marker.yRatio = clamp(point.y / sourceHeight, 0, 1);
    });

    Object.entries(layout.islands).forEach(([key, point]) => {
      const index = Number(key.replace?.("island", "") || key);
      const island = state.islands[`island${index}`];
      if (!island || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
      island.xRatio = clamp(point.x / sourceWidth, 0, 1);
      island.yRatio = clamp(point.y / sourceHeight, 0, 1);
    });

    if (layout.seaTiles) {
      state.seaTiles = {};
      Object.entries(layout.seaTiles).forEach(([id, tile]) => {
        if (!Number.isFinite(tile.x) || !Number.isFinite(tile.y)) return;
        state.seaTiles[id] = {
          id,
          label: `海格 ${tile.routeId || id}-${tile.step || ""}`,
          className: "sea-tile-align",
          routeId: tile.routeId || id,
          step: Number(tile.step || 0),
          xRatio: clamp(tile.x / sourceWidth, 0, 1),
          yRatio: clamp(tile.y / sourceHeight, 0, 1),
        };
      });
    } else {
      state.seaTiles = buildSeaTileRatios();
    }

    if (layout.decorations) {
      state.decorations = {};
      Object.entries(layout.decorations).forEach(([id, item]) => {
        if (!Number.isFinite(item.x) || !Number.isFinite(item.y)) return;
        const preset = STICKER_PRESET_MAP[item.presetId] || {};
        state.decorations[id] = {
          id,
          label: item.label || preset.label || id,
          presetId: item.presetId || preset.id || "sea_beast_01",
          type: item.type || preset.type || "sea-beast",
          asset: item.asset || preset.asset || "",
          fallback: preset.fallback || item.label || id,
          xRatio: clamp(item.x / sourceWidth, 0, 1),
          yRatio: clamp(item.y / sourceHeight, 0, 1),
          sizePx: Number.isFinite(item.sizeRatio)
            ? Math.max(12, item.sizeRatio * renderedImageWidth())
            : Math.max(12, Number(item.size || item.sizePx || preset.size || 120)),
          rotation: Number(item.rotation || 0),
        };
      });
    }

    sanitizeEditorState(state);
    selectedMarkerId = getItemById(selectedMarkerId) ? selectedMarkerId : "reverse";
    selectedMarkerIds = new Set([selectedMarkerId]);

    saveState();
    syncSelectedFields();
    renderMarkerList();
    renderOverlay();
    return true;
  }

  function pointForEndpoint(endpoint, sourceState = state) {
    if (endpoint === "loguetown" || endpoint === "reverse") {
      return sourceState.markers[endpoint];
    }
    return sourceState.islands[`island${endpoint}`];
  }

  function makeRouteId(from, to) {
    return `route-${from}-${to}`;
  }

  function routeDefs() {
    const routes = [
      { id: "route-loguetown-reverse", from: "loguetown", to: "reverse" },
      { id: "route-reverse-8", from: "reverse", to: 8 },
      { id: "route-reverse-15", from: "reverse", to: 15 },
      { id: "route-reverse-22", from: "reverse", to: 22 },
      { id: "route-reverse-29", from: "reverse", to: 29 },
      { id: "route-reverse-36", from: "reverse", to: 36 },
    ];
    const blocked = new Set(["1-8", "2-9", "3-10", "36-43", "37-44", "38-45"]);

    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 7; col += 1) {
        const index = row * 7 + col + 1;
        if (col < 6) {
          routes.push({ id: makeRouteId(index, index + 1), from: index, to: index + 1 });
        }
        if (row < 6) {
          const next = index + 7;
          const key = `${Math.min(index, next)}-${Math.max(index, next)}`;
          if (!blocked.has(key)) {
            routes.push({ id: makeRouteId(index, next), from: index, to: next });
          }
        }
      }
    }
    return routes;
  }

  function buildSeaTileRatios(sourceState = state) {
    const seaTiles = {};
    routeDefs().forEach((route) => {
      const from = pointForEndpoint(route.from, sourceState);
      const to = pointForEndpoint(route.to, sourceState);
      if (!from || !to) return;
      for (let step = 1; step <= SEA_TILE_COUNT; step += 1) {
        const ratio = step / (SEA_TILE_COUNT + 1);
        const id = `${route.id}-sea-${step}`;
        seaTiles[id] = {
          id,
          label: `海格 ${route.id.replace("route-", "")}-${step}`,
          className: "sea-tile-align",
          routeId: route.id,
          step,
          xRatio: from.xRatio + (to.xRatio - from.xRatio) * ratio,
          yRatio: from.yRatio + (to.yRatio - from.yRatio) * ratio,
        };
      }
    });
    return seaTiles;
  }

  function ensureSeaTiles() {
    if (!state.seaTiles || !Object.keys(state.seaTiles).length) {
      state.seaTiles = buildSeaTileRatios();
      saveState();
    }
  }

  function isDecoration(item) {
    return !!(item && item.presetId);
  }

  function populateStickerPresetOptions() {
    refs.stickerPreset.innerHTML = "";
    STICKER_PRESETS.forEach((preset) => {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = `${preset.type === "reef" ? "礁岩" : "海獸"}｜${preset.label}`;
      refs.stickerPreset.appendChild(option);
    });
  }

  function addStickerFromPreset() {
    const preset = STICKER_PRESET_MAP[refs.stickerPreset.value] || STICKER_PRESETS[0];
    const id = `${preset.id}_${Date.now()}`;
    state.decorations[id] = {
      id,
      label: preset.label,
      presetId: preset.id,
      type: preset.type,
      asset: preset.asset,
      fallback: preset.fallback,
      xRatio: 0.5,
      yRatio: 0.5,
      sizePx: preset.size,
      rotation: 0,
    };
    selectedMarkerId = id;
    selectedMarkerIds = new Set([id]);
    saveState();
    renderMarkerList();
    renderOverlay();
    syncSelectedFields();
  }

  function deleteSelectedSticker() {
    const item = getSelectedItem();
    if (!isDecoration(item)) return;
    delete state.decorations[selectedMarkerId];
    selectedMarkerId = "reverse";
    selectedMarkerIds = new Set([selectedMarkerId]);
    saveState();
    renderMarkerList();
    renderOverlay();
    syncSelectedFields();
  }

  function initNaturalSize() {
    naturalWidth = refs.mapImage.naturalWidth || naturalWidth;
    naturalHeight = refs.mapImage.naturalHeight || naturalHeight;
    const markerScale = localStorage.getItem(`${STORAGE_KEY}-marker-scale`) || "1";
    refs.markerScale.value = markerScale;
    document.documentElement.style.setProperty("--marker-scale", markerScale);
    populateStickerPresetOptions();
    ensureSeaTiles();
    syncSelectedFields();
    renderMarkerList();
    renderOverlay();
  }

  refs.mapImage.addEventListener("load", initNaturalSize);
  if (refs.mapImage.complete) {
    initNaturalSize();
  }
  bindInputs();
})();
