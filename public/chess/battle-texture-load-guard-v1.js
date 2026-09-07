(() => {
  "use strict";

  const LOAD_TIMEOUT_MS = 3500;
  const diagnostics = [];
  let fallbackCount = 0;
  let recoveryCount = 0;

  function record(kind, detail = {}) {
    diagnostics.push({ kind, at:Date.now(), ...detail });
    if (diagnostics.length > 20) diagnostics.shift();
  }

  function install(scene) {
    if (!scene || scene.__battleTextureLoadGuardInstalled) return Boolean(scene);
    if (typeof scene.loadTextureFromImage !== "function" || !scene.textureLoads || !scene.textures) return false;
    scene.__battleTextureLoadGuardInstalled = true;

    scene.loadTextureFromImage = function guardedTextureLoad(descriptor) {
      if (this.textures.exists(descriptor.key)) return Promise.resolve();
      const pending = this.textureLoads.get(descriptor.key);
      if (pending) return pending;

      const load = new Promise((resolve, reject) => {
        const image = document.createElement("img");
        image.decoding = "async";
        image.fetchPriority = "high";
        let settled = false;
        let timer = 0;

        const cleanup = () => {
          window.clearTimeout(timer);
          image.removeEventListener("load", onLoad);
          image.removeEventListener("error", onError);
        };
        const finish = (error) => {
          if (settled) return;
          settled = true;
          cleanup();
          if (error) reject(error);
          else resolve();
        };
        const onLoad = () => {
          try {
            if (!this.textures.exists(descriptor.key)) this.textures.addImage(descriptor.key, image);
            finish();
          } catch (error) {
            finish(error);
          }
        };
        const onError = () => finish(new Error(`Unable to load texture: ${descriptor.url}`));

        image.addEventListener("load", onLoad, { once:true });
        image.addEventListener("error", onError, { once:true });
        timer = window.setTimeout(() => {
          record("texture-timeout", { key:descriptor.key, url:descriptor.url });
          finish(new Error(`Texture load timed out: ${descriptor.url}`));
          try { image.src = ""; } catch (_) { /* already detached */ }
        }, LOAD_TIMEOUT_MS);
        image.src = descriptor.url;
        if (image.complete) queueMicrotask(() => {
          if (image.naturalWidth > 0) onLoad();
          else onError();
        });
      }).finally(() => {
        if (this.textureLoads.get(descriptor.key) === load) this.textureLoads.delete(descriptor.key);
      });

      this.textureLoads.set(descriptor.key, load);
      return load;
    };

    const ensureWalkFrames = scene.ensureCharacterWalkFrames.bind(scene);
    scene.ensureCharacterWalkFrames = async function guardedWalkFrames(character, direction) {
      try {
        return await ensureWalkFrames(character, direction);
      } catch (error) {
        fallbackCount += 1;
        record("walk-fallback", {
          characterId:character?.id || "unknown",
          direction:String(direction || ""),
          error:String(error?.message || error),
        });
        const requestedStandKey = `${character.id}:stand:${direction}`;
        let standKey = [requestedStandKey, `${character.id}:stand:back`, `${character.id}:stand:front`]
          .find((key) => this.textures.exists(key));
        if (!standKey) {
          try { await this.ensureCharacterTexture(character, "stand", direction); } catch (_) { /* final render restores a preloaded standing frame */ }
          standKey = requestedStandKey;
        }
        return [1, 2, 3].map(() => ({ key:standKey, url:"" }));
      }
    };

    const performMove = scene.performMove.bind(scene);
    scene.performMove = async function guardedPerformMove(move, promotion) {
      try {
        return await performMove(move, promotion);
      } catch (error) {
        recoveryCount += 1;
        record("move-recovery", {
          from:String(move?.from || ""),
          to:String(move?.to || ""),
          error:String(error?.message || error),
        });
        let committed = null;
        try {
          if (move?.from && move?.to && this.chess?.get?.(move.from)) {
            committed = this.chess.move({ from:move.from, to:move.to, promotion:promotion || move.promotion || "q" });
          }
          if (committed) {
            this.lastMove = {
              from:committed.from,
              to:committed.to,
              san:committed.san,
              captured:Boolean(committed.captured),
            };
          }
        } catch (commitError) {
          record("move-recovery-failed", { error:String(commitError?.message || commitError) });
        } finally {
          this.selectedSquare = null;
          this.inspectedSquare = null;
          this.legalMoves = [];
          this.pendingPromotion = null;
          this.locked = false;
          this.animationPhase = "idle";
          this.activeAnimation = null;
          this.animationFrame = 0;
          this.activeHitSquare = null;
          this.hitDirection = null;
          this.clearLegalHover?.();
          this.clearPieceSelectionIndicator?.();
          this.rebuildCellMap?.();
          this.renderPosition?.();
        }
      } finally {
        if (this.locked && this.animationPhase !== "promotion") {
          this.locked = false;
          this.animationPhase = "idle";
          this.activeAnimation = null;
          this.animationFrame = 0;
          this.activeHitSquare = null;
          this.hitDirection = null;
          this.publish?.();
        }
      }
    };

    record("installed");
    return true;
  }

  let attempts = 0;
  function installWhenReady() {
    attempts += 1;
    const game = window.__BATTLE_CHESS__?.game;
    let scene = null;
    try { scene = game?.scene?.getScene?.("BattleChessScene") || game?.scene?.scenes?.[0] || null; } catch (_) { /* Phaser is still booting */ }
    if (install(scene)) return;
    if (attempts < 180) window.setTimeout(installWhenReady, 16);
    else record("install-timeout");
  }

  window.__BATTLE_TEXTURE_GUARD__ = {
    getState:() => ({
      installed:diagnostics.some((entry) => entry.kind === "installed"),
      loadTimeoutMs:LOAD_TIMEOUT_MS,
      fallbackCount,
      recoveryCount,
      diagnostics:[...diagnostics],
    }),
  };
  installWhenReady();
})();
