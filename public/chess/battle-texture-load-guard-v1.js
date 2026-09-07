(() => {
  "use strict";

  const LOAD_TIMEOUT_MS = 15000;
  const DECODE_TIMEOUT_MS = 10000;
  const diagnostics = [];
  let bitmapLoadCount = 0;
  let imageLoadCount = 0;
  let recoveryCount = 0;

  function record(kind, detail = {}) {
    diagnostics.push({ kind, at:Date.now(), ...detail });
    if (diagnostics.length > 30) diagnostics.shift();
  }

  function deadline(promise, timeoutMs, label, onTimeout) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        try { onTimeout?.(); } catch (_) { /* best effort cancellation */ }
        reject(new Error(`${label} timed out`));
      }, timeoutMs);
      Promise.resolve(promise).then((value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(value);
      }, (error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        reject(error);
      });
    });
  }

  function loadImageElement(url) {
    return new Promise((resolve, reject) => {
      const image = document.createElement("img");
      image.decoding = "async";
      image.fetchPriority = "high";
      let settled = false;
      let pollTimer = 0;
      let timeoutTimer = 0;

      const cleanup = () => {
        window.clearInterval(pollTimer);
        window.clearTimeout(timeoutTimer);
        image.removeEventListener("load", onLoad);
        image.removeEventListener("error", onError);
      };
      const finish = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error);
        else resolve(image);
      };
      const onLoad = () => finish();
      const onError = () => finish(new Error(`Unable to load texture: ${url}`));

      image.addEventListener("load", onLoad, { once:true });
      image.addEventListener("error", onError, { once:true });
      image.src = url;
      // Electron's installed-asset protocol can finish decoding without reliably
      // delivering a late load event, so also observe the decoded dimensions.
      pollTimer = window.setInterval(() => {
        if (image.complete && image.naturalWidth > 0) finish();
      }, 50);
      timeoutTimer = window.setTimeout(() => {
        finish(new Error(`Texture image timed out: ${url}`));
        try { image.src = ""; } catch (_) { /* request already ended */ }
      }, LOAD_TIMEOUT_MS);
      if (image.complete) queueMicrotask(() => {
        if (image.naturalWidth > 0) finish();
      });
    });
  }

  async function loadBitmapCanvas(url) {
    const controller = new AbortController();
    const response = await deadline(
      fetch(url, { cache:"no-store", credentials:"same-origin", signal:controller.signal }),
      LOAD_TIMEOUT_MS,
      `Texture fetch: ${url}`,
      () => controller.abort(),
    );
    if (!response.ok) throw new Error(`Texture fetch failed (${response.status}): ${url}`);
    const blob = await deadline(response.blob(), LOAD_TIMEOUT_MS, `Texture body: ${url}`, () => controller.abort());
    const bitmapPromise = createImageBitmap(blob);
    let bitmap = null;
    try {
      bitmap = await deadline(bitmapPromise, DECODE_TIMEOUT_MS, `Texture decode: ${url}`);
    } catch (error) {
      // If the decoder finishes after our deadline, release that late GPU resource.
      Promise.resolve(bitmapPromise).then((lateBitmap) => lateBitmap?.close?.()).catch(() => {});
      throw error;
    }
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d", { alpha:true });
      if (!context) throw new Error(`Unable to create texture canvas: ${url}`);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0);
      return canvas;
    } finally {
      bitmap.close?.();
    }
  }

  function clearDomEffects() {
    try {
      const stage = document.getElementById?.("battle-effects-stage");
      if (!stage) return;
      stage.querySelectorAll?.(".is-active, .is-visible, .is-charge-light, .is-dash-afterimage").forEach((node) => {
        node.classList?.remove?.("is-active", "is-visible", "is-charge-light", "is-dash-afterimage");
      });
      stage.querySelectorAll?.(".battle-rengoku-afterimage").forEach((node) => { node.hidden = true; });
    } catch (error) {
      record("dom-effects-restore-failed", { error:String(error?.message || error) });
    }
  }

  function restoreFenWithoutLosingHistory(scene, before) {
    try {
      let currentFen = scene.chess?.fen?.();
      if (!before.fen || !currentFen || currentFen === before.fen) {
        scene.lastMove = before.lastMove;
        return true;
      }
      let historyLength = scene.chess?.history?.()?.length ?? before.historyLength;
      let undoCount = 0;
      while (currentFen !== before.fen && historyLength > before.historyLength && undoCount < 4) {
        const undone = scene.chess?.undo?.();
        if (!undone) break;
        undoCount += 1;
        currentFen = scene.chess?.fen?.();
        historyLength = scene.chess?.history?.()?.length ?? historyLength - 1;
      }
      if (currentFen !== before.fen) {
        record("fen-restore-failed", {
          expectedFen:before.fen,
          currentFen:String(currentFen || ""),
          historyLength,
          expectedHistoryLength:before.historyLength,
        });
        return false;
      }
      scene.lastMove = before.lastMove;
      return true;
    } catch (error) {
      record("fen-restore-failed", { error:String(error?.message || error) });
      return false;
    }
  }

  function restoreSceneAfterFailure(scene, before) {
    recoveryCount += 1;
    restoreFenWithoutLosingHistory(scene, before);

    try {
      scene.tweens?.killAll?.();
      clearDomEffects();
      const children = [...(scene.children?.list || [])];
      children.forEach((child) => {
        if (!before.children.has(child)) {
          try { scene.tweens?.killTweensOf?.(child); } catch (_) { /* no live tween */ }
          try { child.destroy?.(); } catch (_) { /* already destroyed */ }
        }
      });
      scene.pieces?.forEach?.(({ image, shadow }) => {
        try { scene.tweens?.killTweensOf?.(image); } catch (_) { /* no live tween */ }
        try { scene.tweens?.killTweensOf?.(shadow); } catch (_) { /* no live tween */ }
      });
      const camera = scene.cameras?.main;
      camera?.resetFX?.();
      camera?.setZoom?.(before.camera.zoom);
      camera?.setScroll?.(before.camera.scrollX, before.camera.scrollY);
      camera?.setRotation?.(before.camera.rotation);
      camera?.setAlpha?.(before.camera.alpha);

      const theme = scene.battlefieldThemes?.[scene.battlefieldId] || scene.battlefieldThemes?.[scene.defaultBattlefieldId];
      if (scene.boardImage && theme?.boardKey) {
        scene.tweens?.killTweensOf?.(scene.boardImage);
        scene.boardImage
          .setTexture(theme.boardKey)
          .setPosition(800, 450)
          .setScale(1)
          .setRotation(0)
          .setAlpha(1)
          .setVisible(true)
          .setDepth(1)
          .setData("battlefieldId", scene.battlefieldId);
      }
      scene.backgroundImage?.setVisible?.(false);
    } catch (error) {
      record("visual-restore-failed", { error:String(error?.message || error) });
    }

    try {
      scene.selectedSquare = null;
      scene.inspectedSquare = null;
      scene.legalMoves = [];
      scene.pendingPromotion = null;
      scene.locked = false;
      scene.animationPhase = "idle";
      scene.activeAnimation = null;
      scene.animationFrame = 0;
      scene.activeHitSquare = null;
      scene.hitDirection = null;
      scene.clearLegalHover?.();
      scene.clearPieceSelectionIndicator?.();
      scene.rebuildCellMap?.();
      scene.renderPosition?.();
      scene.publish?.();
    } catch (error) {
      record("scene-redraw-restore-failed", { error:String(error?.message || error) });
    }
  }

  function install(scene) {
    if (!scene || scene.__battleTextureLoadGuardInstalled) return Boolean(scene);
    if (typeof scene.loadTextureFromImage !== "function" || !scene.textureLoads || !scene.textures) return false;
    scene.__battleTextureLoadGuardInstalled = true;
    const desktopMode = (() => {
      try { return window.localStorage.getItem("op_desktop_launcher") === "1"; } catch (_) { return false; }
    })();

    scene.loadTextureFromImage = function guardedTextureLoad(descriptor) {
      if (this.textures.exists(descriptor.key)) return Promise.resolve();
      const pending = this.textureLoads.get(descriptor.key);
      if (pending) return pending;

      const load = (async () => {
        let source = null;
        let method = "image";
        let firstError = null;
        if (desktopMode && typeof createImageBitmap === "function") {
          try {
            source = await loadBitmapCanvas(descriptor.url);
            method = "bitmap";
          } catch (error) {
            firstError = error;
            record("bitmap-retry", { key:descriptor.key, url:descriptor.url, error:String(error?.message || error) });
          }
        }
        if (!source) {
          try {
            source = await loadImageElement(descriptor.url);
            method = "image";
          } catch (error) {
            if (!desktopMode && typeof createImageBitmap === "function") {
              firstError = error;
              source = await loadBitmapCanvas(descriptor.url);
              method = "bitmap";
            } else {
              throw new Error(`${String(firstError?.message || "")} ${String(error?.message || error)}`.trim());
            }
          }
        }
        if (!this.textures.exists(descriptor.key)) this.textures.addImage(descriptor.key, source);
        if (method === "bitmap") bitmapLoadCount += 1;
        else imageLoadCount += 1;
        record("texture-loaded", { key:descriptor.key, method });
      })().finally(() => {
        if (this.textureLoads.get(descriptor.key) === load) this.textureLoads.delete(descriptor.key);
      });

      this.textureLoads.set(descriptor.key, load);
      return load;
    };

    const performMove = scene.performMove.bind(scene);
    scene.performMove = async function guardedPerformMove(move, promotion) {
      const camera = this.cameras?.main;
      const before = {
        fen:this.chess?.fen?.() || "",
        historyLength:this.chess?.history?.()?.length || 0,
        lastMove:this.lastMove ? { ...this.lastMove } : null,
        children:new Set(this.children?.list || []),
        camera:{
          zoom:Number(camera?.zoom) || 1,
          scrollX:Number(camera?.scrollX) || 0,
          scrollY:Number(camera?.scrollY) || 0,
          rotation:Number(camera?.rotation) || 0,
          alpha:Number(camera?.alpha ?? 1),
        },
      };
      try {
        return await performMove(move, promotion);
      } catch (error) {
        record("move-aborted", {
          from:String(move?.from || ""),
          to:String(move?.to || ""),
          error:String(error?.message || error),
        });
        restoreSceneAfterFailure(this, before);
        throw error;
      }
    };

    record("installed", { desktopMode });
    return true;
  }

  let attempts = 0;
  function installWhenReady() {
    attempts += 1;
    const game = window.__BATTLE_CHESS__?.game;
    let scene = null;
    try { scene = game?.scene?.getScene?.("BattleChessScene") || game?.scene?.scenes?.[0] || null; } catch (_) { /* Phaser is still booting */ }
    if (install(scene)) return;
    if (attempts < 1800) window.setTimeout(installWhenReady, 16);
    else record("install-timeout");
  }

  window.__BATTLE_TEXTURE_GUARD__ = {
    getState:() => ({
      installed:diagnostics.some((entry) => entry.kind === "installed"),
      loadTimeoutMs:LOAD_TIMEOUT_MS,
      decodeTimeoutMs:DECODE_TIMEOUT_MS,
      bitmapLoadCount,
      imageLoadCount,
      recoveryCount,
      diagnostics:[...diagnostics],
    }),
  };
  installWhenReady();
})();
