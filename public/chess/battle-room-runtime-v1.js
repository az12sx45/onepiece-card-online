(() => {
  "use strict";

  const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const STOCKFISH_JS = "./assets/vendor/stockfish-18.0.0/stockfish-18-lite-single.js";
  const STOCKFISH_WASM = "./assets/vendor/stockfish-18.0.0/stockfish-18-lite-single.wasm";
  const CPU_ELO = Object.freeze({ easy:1320, normal:1600, hard:2000, despair:2400 });
  const CPU_MOVE_TIME = Object.freeze({ easy:450, normal:650, hard:900, despair:1200 });
  const runtime = {
    initialized:false,
    session:null,
    player:null,
    cpu:null,
    authoritativeFen:START_FEN,
    moveSequence:0,
    lastHistoryLength:0,
    applyingRemote:false,
    submitting:false,
    cpuThinking:false,
    gameOverReported:false,
    pollTimer:0,
    lastError:"",
    lastSubmission:null,
    lastCommit:null,
    engineWorker:null,
    engineBlobUrl:"",
    engineStarting:null,
    engineReady:false,
    engineStatus:"idle",
    engineError:"",
    engineElo:0,
    engineLastLine:"",
    engineDebugLines:[],
    engineWaiters:new Set(),
  };

  function chessApi() {
    return window.__BATTLE_CHESS__ || null;
  }

  function chessScene() {
    const game = chessApi()?.game;
    return game?.scene?.scenes?.[0] || null;
  }

  function legalMoves() {
    const scene = chessScene();
    if (!scene?.chess?.moves) return [];
    try {
      return scene.chess.moves({ verbose:true }).map((move) => ({
        from:move.from,
        to:move.to,
        promotion:move.promotion || "",
        captured:move.captured || "",
        san:move.san || "",
        before:move.before || "",
        after:move.after || "",
      }));
    } catch (_) { return []; }
  }

  function emitAck(eventName, payload, timeoutMs = 15000) {
    return new Promise((resolve) => {
      const socket = runtime.session?.socket;
      if (!socket) return resolve({ ok:false, error:"socket_unavailable" });
      try {
        socket.timeout(timeoutMs).emit(eventName, payload, (error, result = {}) => {
          resolve(error ? { ok:false, error:"timeout" } : (result || { ok:false, error:"unknown" }));
        });
      } catch (error) {
        resolve({ ok:false, error:String(error?.message || error) });
      }
    });
  }

  function setImage(image, player) {
    if (!image || !player || player.isCPU) return;
    image.hidden = false;
    image.src = window.BattleSocial?.avatarUrl?.(player.avatar || 1, player.name) || "";
    image.onerror = () => {
      image.onerror = null;
      image.src = window.BattleSocial?.fallbackAvatar?.(player.name) || "";
    };
  }

  function applyPlayerHeader() {
    const room = runtime.session?.lobby;
    const players = room?.players || [];
    const local = runtime.session?.role === "spectator"
      ? players.find((player) => player.color === "w")
      : runtime.player;
    const enemy = players.find((player) => Number(player.userId) !== Number(local?.userId)) || players.find((player) => player.color !== local?.color);
    const localName = document.getElementById("player-local-name");
    const enemyName = document.getElementById("player-opponent-name");
    const localRank = document.getElementById("player-local-rank");
    const enemyRank = document.getElementById("player-opponent-rank");
    const localFaction = document.getElementById("player-local-faction");
    const enemyFaction = document.getElementById("player-opponent-faction");
    if (localName && local) localName.textContent = local.name;
    if (enemyName && enemy) enemyName.textContent = enemy.name;
    if (localRank && local) localRank.textContent = local.title || (local.isCPU ? "電腦棋士" : "新世界棋士");
    if (enemyRank && enemy) enemyRank.textContent = enemy.title || (enemy.isCPU ? "電腦棋士" : "新世界棋士");
    const labels = { "straw-hat-pirates":"草帽海賊團", "onigashima-alliance":"鬼島聯軍" };
    const localCard = document.getElementById("player-card-local");
    const enemyCard = document.getElementById("player-card-opponent");
    if (localCard && local?.factionId) localCard.dataset.faction = local.factionId;
    if (enemyCard && enemy?.factionId) enemyCard.dataset.faction = enemy.factionId;
    const profileUi = window.__BATTLE_PLAYER_UI__;
    if (profileUi?.setProfile && local) {
      profileUi.setProfile("local", {
        name:local.name || "玩家船長",
        rank:local.title || (local.isCPU ? "電腦棋士" : "新世界棋士"),
        avatarUrl:local.isCPU ? "./images/board/avatars/cpu2.webp" : (window.BattleSocial?.avatarUrl?.(local.avatar || 1, local.name) || ""),
      });
    }
    if (profileUi?.setProfile && enemy) {
      profileUi.setProfile("opponent", {
        name:enemy.name || "對手船長",
        rank:enemy.title || (enemy.isCPU ? "電腦棋士" : "新世界棋士"),
        avatarUrl:enemy.isCPU ? "./images/board/avatars/cpu2.webp" : (window.BattleSocial?.avatarUrl?.(enemy.avatar || 1, enemy.name) || ""),
      });
    }
    if (localFaction && local) localFaction.textContent = `${labels[local.factionId] || local.factionId}・${local.color === "w" ? "白方" : "黑方"}`;
    if (enemyFaction && enemy) enemyFaction.textContent = `${labels[enemy.factionId] || enemy.factionId}・${enemy.color === "w" ? "白方" : "黑方"}`;
    setImage(document.getElementById("player-local-avatar"), local);
    setImage(document.getElementById("player-opponent-avatar"), enemy);
  }

  function setControlsForRoom() {
    const onlineOrCpu = Boolean(runtime.session);
    const ids = ["new-game", "undo-move", "bottom-faction", "bottom-color", "view-orientation", "battlefield-theme"];
    ids.forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.disabled = onlineOrCpu;
    });
  }

  function ownTurn(snapshot) {
    return runtime.session?.role === "player" && runtime.player && snapshot.turn === runtime.player.color;
  }

  function cpuTurn(snapshot) {
    return runtime.cpu && snapshot.turn === runtime.cpu.color;
  }

  function updateInputLock(snapshot) {
    const locked = !ownTurn(snapshot) || snapshot.locked || runtime.applyingRemote || runtime.submitting || runtime.cpuThinking;
    document.body.classList.toggle("battle-network-input-locked", locked);
    document.body.dataset.chessRoomRole = runtime.session?.role || "local";
    document.body.dataset.chessAssignedColor = runtime.player?.color || "";
  }

  function promotionFromSnapshot(snapshot) {
    const san = String(snapshot.lastMove?.san || "");
    const match = san.match(/=([QRBN])/i);
    return match ? match[1].toLowerCase() : "";
  }

  async function submitMove(snapshot, cpu = false) {
    if (runtime.submitting || runtime.applyingRemote || !snapshot.lastMove) return;
    const beforeFen = runtime.authoritativeFen;
    const afterFen = snapshot.fen;
    if (!beforeFen || beforeFen === afterFen) return;
    runtime.submitting = true;
    updateInputLock(snapshot);
    const move = {
      from:snapshot.lastMove.from,
      to:snapshot.lastMove.to,
      san:snapshot.lastMove.san || "",
      captured:!!snapshot.lastMove.captured,
    };
    const promotion = promotionFromSnapshot(snapshot);
    if (promotion) move.promotion = promotion;
    if (runtime.session.localPreview || !runtime.session.socket) {
      runtime.authoritativeFen = afterFen;
      runtime.moveSequence += 1;
      runtime.lastHistoryLength = snapshot.history.length;
      runtime.submitting = false;
      updateInputLock(snapshot);
      return;
    }
    const result = await emitAck("CHESS_MOVE", {
      roomCode:runtime.session.lobby.roomCode,
      beforeFen,
      afterFen,
      move,
      moveSequence:runtime.moveSequence,
      cpu,
    });
    runtime.submitting = false;
    runtime.lastSubmission = result;
    if (!result.ok) {
      runtime.lastError = String(result.error || "move_rejected");
      const serverFen = result.game?.fen;
      if (serverFen) {
        runtime.authoritativeFen = serverFen;
        runtime.moveSequence = Number(result.game?.moveSequence) || 0;
        chessApi()?.loadFen?.(serverFen);
      }
      return;
    }
    runtime.authoritativeFen = result.game?.fen || afterFen;
    runtime.lastError = "";
    runtime.moveSequence = Number(result.game?.moveSequence) || (runtime.moveSequence + 1);
    runtime.lastHistoryLength = snapshot.history.length;
  }

  function pieceValue(piece) {
    return ({ p:100, n:320, b:335, r:500, q:900, k:20000 })[String(piece || "").toLowerCase()] || 0;
  }

  function materialScore(fen, color) {
    const board = String(fen || "").split(" ")[0];
    let score = 0;
    for (const token of board) {
      if (!/[prnbqkPRNBQK]/.test(token)) continue;
      const white = token === token.toUpperCase();
      score += (white === (color === "w") ? 1 : -1) * pieceValue(token);
    }
    return score;
  }

  function chooseCpuMove(moves, difficulty, color) {
    if (!moves.length) return null;
    if (difficulty === "easy") return moves[Math.floor(Math.random() * moves.length)];
    const scored = moves.map((move) => {
      let score = pieceValue(move.captured) + (move.promotion ? 780 : 0);
      if (String(move.san).includes("#")) score += 100000;
      else if (String(move.san).includes("+")) score += 90;
      if (["d4", "e4", "d5", "e5"].includes(move.to)) score += 18;
      if (difficulty === "hard" || difficulty === "despair") score += materialScore(move.after, color) * .35;
      if (difficulty === "despair") score += pieceValue(move.captured) * .65 + (move.san.includes("#") ? 100000 : 0);
      score += Math.random() * (difficulty === "normal" ? 65 : difficulty === "hard" ? 22 : 5);
      return { move, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const choicePool = difficulty === "normal" ? scored.slice(0, Math.min(4, scored.length)) : difficulty === "hard" ? scored.slice(0, Math.min(2, scored.length)) : scored.slice(0, 1);
    return choicePool[Math.floor(Math.random() * choicePool.length)]?.move || scored[0].move;
  }

  function settleEngineWaiters(line) {
    for (const waiter of Array.from(runtime.engineWaiters)) {
      if (!waiter.predicate(line)) continue;
      runtime.engineWaiters.delete(waiter);
      clearTimeout(waiter.timer);
      waiter.resolve(line);
    }
  }

  function waitForEngineLine(predicate, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, reject, timer:0 };
      waiter.timer = window.setTimeout(() => {
        runtime.engineWaiters.delete(waiter);
        reject(new Error("stockfish_timeout"));
      }, timeoutMs);
      runtime.engineWaiters.add(waiter);
    });
  }

  function postEngine(command) {
    if (!runtime.engineWorker) throw new Error("stockfish_unavailable");
    runtime.engineWorker.postMessage(command);
  }

  function postEngineAndWait(command, predicate, timeoutMs) {
    const response = waitForEngineLine(predicate, timeoutMs);
    postEngine(command);
    return response;
  }

  function stopEngine(error) {
    runtime.engineError = String(error?.message || error || "stockfish_unavailable");
    runtime.engineStatus = "fallback";
    runtime.engineReady = false;
    for (const waiter of Array.from(runtime.engineWaiters)) {
      runtime.engineWaiters.delete(waiter);
      clearTimeout(waiter.timer);
      waiter.reject(new Error(runtime.engineError));
    }
    try { runtime.engineWorker?.terminate?.(); } catch (_) {}
    runtime.engineWorker = null;
    if (runtime.engineBlobUrl) {
      try { URL.revokeObjectURL(runtime.engineBlobUrl); } catch (_) {}
      runtime.engineBlobUrl = "";
    }
  }

  function createEngineWorker() {
    if (window.location.protocol !== "file:") {
      const scriptUrl = new URL(STOCKFISH_JS, window.location.href);
      const wasmUrl = new URL(STOCKFISH_WASM, window.location.href);
      return new Worker(`${scriptUrl.href}#${encodeURIComponent(wasmUrl.href)}`);
    }
    const bundle = window.__STOCKFISH_FILE_BUNDLE__;
    if (!bundle?.workerJsBase64 || !bundle?.wasmBase64) throw new Error("stockfish_file_bundle_missing");
    const prelude = [
      `const __sfWasmBase64=${JSON.stringify(bundle.wasmBase64)};`,
      "const __sfNativeFetch=self.fetch.bind(self);",
      "self.fetch=function(input,init){if(String(input).endsWith('stockfish.wasm')){const binary=atob(__sfWasmBase64);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i+=1)bytes[i]=binary.charCodeAt(i);return Promise.resolve(new Response(bytes,{status:200,headers:{'Content-Type':'application/wasm'}}));}return __sfNativeFetch(input,init);};",
    ].join("\n");
    const workerSource = atob(bundle.workerJsBase64);
    const blobUrl = URL.createObjectURL(new Blob([prelude, "\n", workerSource], { type:"text/javascript" }));
    runtime.engineBlobUrl = blobUrl;
    window.__STOCKFISH_FILE_BUNDLE__ = null;
    return new Worker(`${blobUrl}#stockfish.wasm`);
  }

  async function startEngine() {
    if (runtime.engineReady && runtime.engineWorker) return true;
    if (runtime.engineStarting) return runtime.engineStarting;
    runtime.engineStatus = "loading";
    runtime.engineStarting = (async () => {
      try {
        const worker = createEngineWorker();
        runtime.engineWorker = worker;
        worker.addEventListener("message", (event) => {
          String(event.data || "").split(/\r?\n/).filter(Boolean).forEach((line) => {
            runtime.engineLastLine = line;
            runtime.engineDebugLines.push(line);
            if (runtime.engineDebugLines.length > 20) runtime.engineDebugLines.shift();
            settleEngineWaiters(line);
          });
        });
        worker.addEventListener("error", (event) => {
          if (runtime.engineStatus !== "fallback") stopEngine(event.message || "stockfish_worker_error");
        });
        await postEngineAndWait("uci", (line) => line === "uciok", 20000);
        postEngine("setoption name Hash value 16");
        postEngine("setoption name UCI_LimitStrength value true");
        await postEngineAndWait("isready", (line) => line === "readyok", 10000);
        runtime.engineReady = true;
        runtime.engineStatus = "ready";
        runtime.engineError = "";
        return true;
      } catch (error) {
        stopEngine(error);
        return false;
      } finally {
        runtime.engineStarting = null;
      }
    })();
    return runtime.engineStarting;
  }

  async function stockfishMove(fen, difficulty) {
    if (!await startEngine()) return null;
    const elo = CPU_ELO[difficulty] || CPU_ELO.normal;
    runtime.engineElo = elo;
    postEngine("setoption name UCI_LimitStrength value true");
    postEngine(`setoption name UCI_Elo value ${elo}`);
    await postEngineAndWait("isready", (line) => line === "readyok", 10000);
    postEngine(`position fen ${fen}`);
    const line = await postEngineAndWait(
      `go movetime ${CPU_MOVE_TIME[difficulty] || CPU_MOVE_TIME.normal}`,
      (message) => /^bestmove\s+/i.test(message),
      15000,
    );
    const match = String(line).match(/^bestmove\s+([a-h][1-8])([a-h][1-8])([qrbn])?/i);
    if (!match) return null;
    return { from:match[1], to:match[2], promotion:(match[3] || "q").toLowerCase() };
  }

  async function driveCpu(snapshot) {
    if (runtime.cpuThinking || runtime.applyingRemote || runtime.submitting || snapshot.locked || snapshot.gameOver) return;
    if (runtime.session?.role !== "player" || (!runtime.session.localPreview && !runtime.player?.isHost)) return;
    runtime.cpuThinking = true;
    updateInputLock(snapshot);
    const difficulty = runtime.cpu.cpuDifficulty || runtime.session.lobby.settings?.cpuDifficulty || "normal";
    await new Promise((resolve) => setTimeout(resolve, 180));
    let move = null;
    try {
      move = await stockfishMove(snapshot.fen, difficulty);
    } catch (error) {
      stopEngine(error);
    }
    if (!move) move = chooseCpuMove(legalMoves(), difficulty, runtime.cpu.color);
    if (move) await chessApi()?.move?.(move.from, move.to, move.promotion || "q");
    runtime.cpuThinking = false;
    const latest = chessApi()?.getState?.();
    if (latest) updateInputLock(latest);
  }

  async function applyCommittedMove(message = {}) {
    const game = message.game || {};
    runtime.lastCommit = message;
    const move = game.lastMove || {};
    if (!move.from || !move.to || !game.fen) return;
    const current = chessApi()?.getState?.();
    if (!current) return;
    const sourceIsLocal = Number(move.byUserId) === Number(runtime.player?.userId) || Number(move.byUserId) === Number(runtime.cpu?.userId);
    if (sourceIsLocal && current.fen === game.fen) {
      runtime.authoritativeFen = game.fen;
      runtime.moveSequence = Number(game.moveSequence) || runtime.moveSequence;
      runtime.lastHistoryLength = current.history.length;
      return;
    }
    if (current.fen === game.fen) {
      runtime.authoritativeFen = game.fen;
      runtime.moveSequence = Number(game.moveSequence) || runtime.moveSequence;
      runtime.lastHistoryLength = current.history.length;
      return;
    }
    if (current.fen !== runtime.authoritativeFen) {
      chessApi()?.loadFen?.(game.fen);
      runtime.authoritativeFen = game.fen;
      runtime.moveSequence = Number(game.moveSequence) || runtime.moveSequence;
      runtime.lastHistoryLength = 0;
      return;
    }
    runtime.applyingRemote = true;
    updateInputLock(current);
    const moved = await chessApi()?.move?.(move.from, move.to, move.promotion || "q");
    runtime.applyingRemote = false;
    const after = chessApi()?.getState?.();
    if (!moved || after?.fen !== game.fen) chessApi()?.loadFen?.(game.fen);
    runtime.authoritativeFen = game.fen;
    runtime.moveSequence = Number(game.moveSequence) || runtime.moveSequence;
    runtime.lastHistoryLength = chessApi()?.getState?.()?.history?.length || 0;
  }

  function poll() {
    const snapshot = chessApi()?.getState?.();
    if (!snapshot?.ready) return;
    updateInputLock(snapshot);
    const historyLength = Array.isArray(snapshot.history) ? snapshot.history.length : 0;
    if (!runtime.applyingRemote && !runtime.submitting && historyLength > runtime.lastHistoryLength && snapshot.fen !== runtime.authoritativeFen) {
      const cpuMove = runtime.cpu && String(runtime.authoritativeFen).split(/\s+/)[1] === runtime.cpu.color;
      submitMove(snapshot, !!cpuMove);
      return;
    }
    if (!runtime.applyingRemote && !runtime.submitting && !snapshot.locked && cpuTurn(snapshot) && snapshot.fen === runtime.authoritativeFen) {
      driveCpu(snapshot);
    }
    if (snapshot.gameOver && !runtime.gameOverReported) {
      runtime.gameOverReported = true;
      if (!runtime.session.localPreview && runtime.session.socket && runtime.session.role === "player") {
        emitAck("CHESS_GAME_OVER", { roomCode:runtime.session.lobby.roomCode, fen:snapshot.fen }, 5000);
      }
    }
  }

  function init(session) {
    if (runtime.initialized || !session?.lobby) return;
    runtime.initialized = true;
    runtime.session = session;
    runtime.player = session.role === "player"
      ? session.lobby.players?.find((player) => Number(player.userId) === Number(session.profile?.userId)) || null
      : null;
    runtime.cpu = session.lobby.players?.find((player) => player.isCPU) || null;
    document.body.dataset.chessAssignedColor = runtime.player?.color || "";
    runtime.authoritativeFen = session.lobby.game?.fen || START_FEN;
    runtime.moveSequence = Number(session.lobby.game?.moveSequence) || 0;
    const readyTimer = window.setInterval(() => {
      const snapshot = chessApi()?.getState?.();
      if (!snapshot?.ready) return;
      clearInterval(readyTimer);
      runtime.lastHistoryLength = snapshot.history?.length || 0;
      applyPlayerHeader();
      setControlsForRoom();
      updateInputLock(snapshot);
      runtime.pollTimer = window.setInterval(poll, 120);
    }, 60);
    if (session.socket) {
      session.socket.on("CHESS_MOVE_COMMITTED", (message = {}) => {
        if (message.roomCode !== runtime.session?.lobby?.roomCode) return;
        applyCommittedMove(message);
      });
    }
  }

  window.addEventListener("battle:chess-room-started", (event) => init(event.detail));
  if (window.__BATTLE_ROOM_SESSION__) init(window.__BATTLE_ROOM_SESSION__);
  window.__BATTLE_ROOM_RUNTIME__ = {
    getState:() => ({
      initialized:runtime.initialized,
      player:runtime.player,
      cpu:runtime.cpu,
      authoritativeFen:runtime.authoritativeFen,
      moveSequence:runtime.moveSequence,
      applyingRemote:runtime.applyingRemote,
      submitting:runtime.submitting,
      lastError:runtime.lastError,
      lastSubmission:runtime.lastSubmission,
      lastCommit:runtime.lastCommit,
      engineStatus:runtime.engineStatus,
      engineError:runtime.engineError,
      engineElo:runtime.engineElo,
      engineLastLine:runtime.engineLastLine,
      engineDebugLines:[...runtime.engineDebugLines],
    }),
  };
})();
