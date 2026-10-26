'use strict';
// Generated exact desktop controller; presentation lives in native-york-page.
exports.create=function(host){const {window,document,URLSearchParams}=host;
const api = window.BoardYorkCluePuzzle;
      const query = new URLSearchParams(window.location.search);
      const EMBEDDED = query.get("embed") === "1" && window.parent !== window;
      const CHANNEL = String(query.get("channel") || "");
      const LAYOUT_SEED = String(query.get("layoutSeed") || "formal-preview-layout-20260802");
      const PLAYER_ID = String(query.get("playerId") || "formal-preview-player-1");
      const INITIAL_TIER = Math.max(0, Math.min(3, Math.floor(Number(query.get("tier")) || 0)));
      const INITIAL_EGGHEAD_REVEALED = query.get("eggheadUnlocked") === "1";
      const PUZZLE_VARIANT = String(query.get("puzzleVariant") || (INITIAL_TIER >= 3 ? `practice-preview-${Date.now()}-${Math.random().toString(36).slice(2)}` : ""));
      const FRAME_IMAGE = "images/board/postgame_clue_ui/york_clue_playing_card_frame_v2.webp";
      const ISLAND_IMAGES = [
        "images/board/islands/postgame_boss_shiki_island.webp",
        "images/board/islands/postgame_boss_gild_tesoro_island.webp",
        "images/board/islands/postgame_boss_zephyr_island.webp",
        "images/board/islands/postgame_boss_tot_musica_island.webp",
        "images/board/islands/postgame_boss_douglas_bullet_island.webp",
        "images/board/islands/postgame_boss_saga_island.webp",
        "images/board/islands/postgame_boss_vinsmoke_judge_island.webp",
        "images/board/islands/postgame_boss_rob_lucci_awakened_island.webp",
        "images/board/islands/postgame_boss_king_island.webp",
        "images/board/islands/postgame_boss_charlotte_katakuri_island.webp",
        "images/board/islands/postgame_boss_patrick_redfield_island.webp",
        "images/board/islands/postgame_boss_loki_island.webp",
        "images/board/islands/postgame_boss_aramaki_island.webp",
      ];
      const ASSET_ROOT = "images/board/postgame_clue_puzzle_ui/";
      const DIFFICULTY_ASSETS = {
        easy: {
          frame: `${ASSET_ROOT}york_difficulty_easy_frame.webp`,
          decoder: `${ASSET_ROOT}york_coordinate_decoder_t1.webp`,
        },
        normal: {
          frame: `${ASSET_ROOT}york_difficulty_normal_frame.webp`,
          decoder: `${ASSET_ROOT}york_coordinate_decoder_t2.webp`,
        },
        hard: {
          frame: `${ASSET_ROOT}york_difficulty_hard_frame.webp`,
          decoder: `${ASSET_ROOT}york_coordinate_decoder_t3.webp`,
        },
      };
      const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

      const refs = Object.fromEntries([
        "exitButton", "difficultyScreen", "difficultyGrid", "currentTierLabel", "eggheadStatus", "puzzleScreen",
        "backButton", "clueSummary", "clueList", "puzzleTitle", "seedStatus", "uniqueBadge",
        "attemptBadge", "sequencePanel", "cardBank", "cardBankDrop",
        "sequenceMessage", "shuffleButton", "unlockAllButton", "resetButton", "submitButton",
        "resultOverlay", "resultTitle", "resultDescription", "resultDecoder", "resultTierLabel", "resultTier",
        "resultRateLabel", "resultRate", "resultWorldLabel", "resultWorld", "resultClose",
      ].map(id => [id, document.getElementById(id)]));

      const puzzleSet = api.createPuzzleSet(LAYOUT_SEED, PLAYER_ID, PUZZLE_VARIANT);
      const state = {
        currentTier: INITIAL_TIER,
        eggheadRevealed: INITIAL_EGGHEAD_REVEALED,
        activeKey: null,
        dragCard: null,
        pendingSubmit: false,
        sessions: Object.fromEntries(puzzleSet.puzzles.map(puzzle => [puzzle.difficultyKey, {
          puzzle,
          slots: Array(api.CARD_COUNT).fill(null),
          bankOrder: [...puzzle.initialOrder],
          lockedSlots: Array(api.CARD_COUNT).fill(false),
          selectedCard: null,
          selectedSource: null,
          attempts: 0,
          solved: false,
        }])),
      };

      refs.exitButton.textContent = EMBEDDED ? "離開解碼" : "獨立流程檢查";
      refs.resultClose.textContent = EMBEDDED ? "返回主遊戲" : "回到難度選擇";

      function sendParent(type, detail = {}) {
        if (!EMBEDDED) return false;
        window.parent.postMessage({ type, channel: CHANNEL, ...detail }, window.location.origin);
        return true;
      }

      function currentSession() {
        return state.activeKey ? state.sessions[state.activeKey] : null;
      }

      function tierLabel(tier) {
        if (tier <= 0) return "尚未持有";
        return api.DIFFICULTIES[["easy", "normal", "hard"][tier - 1]].targetItemName;
      }

      function setMessage(message, kind = "") {
        refs.sequenceMessage.textContent = message;
        refs.sequenceMessage.className = `sequence-message${kind ? ` ${kind}` : ""}`;
      }

      function difficultyCardMarkup(key) {
        const difficulty = api.DIFFICULTIES[key];
        const asset = DIFFICULTY_ASSETS[key];
        const completed = state.currentTier >= difficulty.targetTier;
        const practiceMode = state.currentTier >= 3;
        return `
          <button class="difficulty-card" type="button" data-difficulty="${key}" ${completed && !practiceMode ? "disabled" : ""}>
            <img class="difficulty-frame" src="${asset.frame}" alt="">
            <span class="difficulty-content">
              <span class="difficulty-kicker">${practiceMode ? "TIER 3 PRACTICE" : `TIER ${difficulty.targetTier} DECODER`}</span>
              <h2>${difficulty.label}</h2>
              <span class="difficulty-target">${practiceMode ? "三階後新題目練習" : difficulty.targetItemName}</span>
              <img class="decoder-thumb" src="${asset.decoder}" alt="">
              <span class="difficulty-desc">${difficulty.description}</span>
              <span class="difficulty-meta">${practiceMode ? "不提高掉落率，也不發放其他加成獎勵" : `名刀「日蝕」獨立掉落率 ${Math.round(difficulty.dropRate * 100)}%`}</span>
              <span class="difficulty-action">${practiceMode ? "開始新題目" : (completed ? "此階已完成" : "開始解碼")}</span>
            </span>
          </button>`;
      }

      function renderDifficultySelection() {
        refs.currentTierLabel.textContent = tierLabel(state.currentTier);
        refs.eggheadStatus.textContent = state.eggheadRevealed ? "全隊已揭露" : "尚未揭露";
        refs.difficultyGrid.innerHTML = Object.keys(api.DIFFICULTIES).map(difficultyCardMarkup).join("");
        refs.difficultyGrid.querySelectorAll("[data-difficulty]").forEach(button => {
          button.addEventListener("click", () => openPuzzle(button.dataset.difficulty));
        });
      }

      function openPuzzle(key) {
        const difficulty = api.DIFFICULTIES[key];
        if (!difficulty || (state.currentTier < 3 && state.currentTier >= difficulty.targetTier)) return;
        state.activeKey = key;
        refs.difficultyScreen.classList.add("hidden");
        refs.puzzleScreen.classList.remove("hidden");
        setMessage(state.currentTier >= 3
          ? "三階練習題：請排好十三張牌；完成後不會獲得其他加成獎勵。"
          : "請從下方選牌，放到上方第 1～13 格。");
        renderPuzzle();
        window.scrollTo(0, 0);
      }

      function closePuzzle() {
        state.activeKey = null;
        refs.puzzleScreen.classList.add("hidden");
        refs.difficultyScreen.classList.remove("hidden");
        renderDifficultySelection();
        window.scrollTo(0, 0);
      }

      function clueCardMarkup(card, options = {}) {
        const selected = Boolean(options.selected);
        const locked = Boolean(options.locked);
        const rank = RANKS[card - 1] || String(card);
        return `
          <button class="formal-clue-card${selected ? " selected" : ""}${locked ? " locked" : ""}" type="button"
            draggable="${options.draggable === false ? "false" : "true"}" ${options.dataAttribute || ""}
            aria-label="約克的線索 ${card}，牌值 ${rank}">
            <img class="item-card-frame" src="${FRAME_IMAGE}" alt="">
            <span class="item-card-island-window"><img class="item-card-island" src="${ISLAND_IMAGES[card - 1]}" alt=""></span>
            <span class="item-card-rank${rank.length > 1 ? " double" : ""}">${rank}</span>
            <span class="item-card-rank corner-bottom${rank.length > 1 ? " double" : ""}" aria-hidden="true">${rank}</span>
          </button>`;
      }

      function targetSlotMarkup(index, session) {
        const card = session.slots[index];
        const locked = session.lockedSlots[index];
        const selected = card && session.selectedCard === card && session.selectedSource === "slot";
        return `
          <div class="target-slot" data-slot-index="${index}" aria-label="第 ${index + 1} 格${card ? `，目前為線索 ${card}` : "，空格"}">
            ${card
              ? clueCardMarkup(card, { selected, locked, draggable: !locked && !session.solved, dataAttribute: `data-placed-card="${card}"` })
              : `<span class="slot-empty" aria-hidden="true"></span>`}
            <button class="slot-lock ${locked ? "locked" : "unlocked"}" type="button" data-lock-index="${index}"
              ${card && !session.solved ? "" : "disabled"} aria-label="${locked ? "解鎖" : "鎖定"}第 ${index + 1} 格"></button>
          </div>`;
      }

      function bankCardMarkup(card, session) {
        const selected = session.selectedCard === card && session.selectedSource === "bank";
        return `
          <span class="bank-card-wrap">
            ${clueCardMarkup(card, { selected, draggable: !session.solved, dataAttribute: `data-bank-card="${card}"` })}
            <span class="bank-card-label">線索 ${card}</span>
          </span>`;
      }

      function renderPuzzle() {
        const session = currentSession();
        if (!session) return;
        const puzzle = session.puzzle;
        const difficulty = api.DIFFICULTIES[puzzle.difficultyKey];
        const profile = puzzle.profile;
        refs.puzzleTitle.textContent = `${difficulty.label}・${difficulty.targetItemName}`;
        const filledCount = session.slots.filter(Number.isInteger).length;
        const selectedClue = puzzle.clues.find(clue => clue.owner === session.selectedCard);
        refs.seedStatus.textContent = selectedClue
          ? `${selectedClue.owner} 號牌：${selectedClue.text}`
          : `已放 ${filledCount}/13・直接 ${profile.direct}／關係 ${profile.relational}／寬鬆 ${profile.broad}`;
        refs.uniqueBadge.textContent = puzzle.audit.count === 1 ? "唯一解" : "檢查中";
        refs.uniqueBadge.setAttribute("aria-label", puzzle.audit.count === 1 ? "已驗證唯一解" : "題目檢查中");
        refs.attemptBadge.textContent = `${session.attempts} 次`;
        refs.attemptBadge.setAttribute("aria-label", `已確認 ${session.attempts} 次`);
        refs.clueSummary.textContent = `每牌一條線索・關係距離最多 ${profile.maxRelationDistance} 格・保證唯一解`;
        refs.sequencePanel.innerHTML = session.slots.map((_, index) => targetSlotMarkup(index, session)).join("");
        refs.cardBank.innerHTML = session.bankOrder.map(card => bankCardMarkup(card, session)).join("");
        refs.clueList.innerHTML = puzzle.clues.map(clue => `
          <button class="clue-row${session.selectedCard === clue.owner ? " active" : ""}" type="button" data-clue-card="${clue.owner}">
            <span class="clue-number">${clue.owner}</span><span class="clue-copy">${clue.text}</span>
          </button>`).join("");
        const disabled = session.solved || state.pendingSubmit;
        [refs.shuffleButton, refs.unlockAllButton, refs.resetButton, refs.submitButton].forEach(button => { button.disabled = disabled; });
        bindPuzzleEvents();
      }

      function bindPuzzleEvents() {
        refs.sequencePanel.querySelectorAll("[data-slot-index]").forEach(slot => {
          const slotIndex = Number(slot.dataset.slotIndex);
          slot.addEventListener("click", event => {
            if (event.target.closest("[data-lock-index]")) return;
            handleSlotClick(slotIndex);
          });
          slot.addEventListener("dragover", event => {
            event.preventDefault();
            slot.classList.add("drag-over");
          });
          slot.addEventListener("dragleave", () => slot.classList.remove("drag-over"));
          slot.addEventListener("drop", event => {
            event.preventDefault();
            slot.classList.remove("drag-over");
            if (Number.isInteger(state.dragCard)) placeCardInSlot(state.dragCard, slotIndex);
            state.dragCard = null;
          });
        });
        refs.sequencePanel.querySelectorAll("[data-placed-card]").forEach(card => {
          card.addEventListener("dragstart", event => {
            state.dragCard = Number(card.dataset.placedCard);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", String(state.dragCard));
          });
          card.addEventListener("dragend", () => { state.dragCard = null; });
        });
        refs.sequencePanel.querySelectorAll("[data-lock-index]").forEach(button => {
          button.addEventListener("click", event => {
            event.stopPropagation();
            toggleLock(Number(button.dataset.lockIndex));
          });
        });
        refs.cardBank.querySelectorAll("[data-bank-card]").forEach(card => {
          card.addEventListener("click", () => handleBankCardClick(Number(card.dataset.bankCard)));
          card.addEventListener("dragstart", event => {
            state.dragCard = Number(card.dataset.bankCard);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", String(state.dragCard));
          });
          card.addEventListener("dragend", () => { state.dragCard = null; });
        });
        [refs.cardBankDrop].forEach(dropZone => {
          dropZone.addEventListener("dragover", event => {
            event.preventDefault();
            dropZone.classList.add("drag-over");
          });
          dropZone.addEventListener("dragleave", event => {
            if (!dropZone.contains(event.relatedTarget)) dropZone.classList.remove("drag-over");
          });
          dropZone.addEventListener("drop", event => {
            event.preventDefault();
            dropZone.classList.remove("drag-over");
            if (Number.isInteger(state.dragCard)) returnCardToBank(state.dragCard);
            state.dragCard = null;
          });
        });
        refs.clueList.querySelectorAll("[data-clue-card]").forEach(button => {
          button.addEventListener("click", () => {
            const session = currentSession();
            const card = Number(button.dataset.clueCard);
            session.selectedCard = card;
            session.selectedSource = session.bankOrder.includes(card) ? "bank" : "slot";
            setMessage(`${card} 號線索牌已選取；點上方未鎖定格即可放置或交換。`);
            renderPuzzle();
          });
        });
      }

      function cardLocation(session, card) {
        const bankIndex = session.bankOrder.indexOf(card);
        if (bankIndex >= 0) return { source: "bank", index: bankIndex };
        const slotIndex = session.slots.indexOf(card);
        if (slotIndex >= 0) return { source: "slot", index: slotIndex };
        return null;
      }

      function handleBankCardClick(card) {
        const session = currentSession();
        if (!session || session.solved) return;
        if (session.selectedSource === "slot" && Number.isInteger(session.selectedCard)) {
          const sourceIndex = session.slots.indexOf(session.selectedCard);
          const bankIndex = session.bankOrder.indexOf(card);
          if (sourceIndex >= 0 && bankIndex >= 0 && !session.lockedSlots[sourceIndex]) {
            const placedCard = session.selectedCard;
            session.slots[sourceIndex] = card;
            session.bankOrder[bankIndex] = placedCard;
            session.selectedCard = card;
            session.selectedSource = null;
            setMessage(`${card} 號牌已換入第 ${sourceIndex + 1} 格，${placedCard} 號牌回到下方。`);
            renderPuzzle();
            return;
          }
        }
        if (session.selectedCard === card && session.selectedSource === "bank") {
          session.selectedCard = null;
          session.selectedSource = null;
          setMessage(`${card} 號牌已取消選取。`);
          renderPuzzle();
          return;
        }
        session.selectedCard = card;
        session.selectedSource = "bank";
        setMessage(`${card} 號道具牌已選取；請點上方第 1～13 格。`);
        renderPuzzle();
      }

      function handleSlotClick(index) {
        const session = currentSession();
        if (!session || session.solved || index < 0 || index >= api.CARD_COUNT) return;
        if (session.lockedSlots[index]) {
          setMessage(`第 ${index + 1} 格已鎖定，請先按鎖頭解鎖。`, "error");
          renderPuzzle();
          return;
        }
        if (session.selectedSource && Number.isInteger(session.selectedCard)) {
          placeCardInSlot(session.selectedCard, index);
          return;
        }
        const card = session.slots[index];
        if (!Number.isInteger(card)) {
          setMessage("這是空格；請先從下方選一張道具牌。", "error");
          return;
        }
        session.selectedCard = card;
        session.selectedSource = "slot";
        setMessage(`${card} 號牌已從第 ${index + 1} 格選取；可點另一格交換，或點下方牌替換。`);
        renderPuzzle();
      }

      function placeCardInSlot(card, targetIndex) {
        const session = currentSession();
        if (!session || session.solved || targetIndex < 0 || targetIndex >= api.CARD_COUNT) return;
        if (session.lockedSlots[targetIndex]) {
          setMessage(`第 ${targetIndex + 1} 格已鎖定，不能放入卡牌。`, "error");
          return;
        }
        const location = cardLocation(session, card);
        if (!location) return;
        const targetCard = session.slots[targetIndex];
        if (location.source === "bank") {
          if (Number.isInteger(targetCard)) session.bankOrder[location.index] = targetCard;
          else session.bankOrder.splice(location.index, 1);
          session.slots[targetIndex] = card;
        } else {
          if (session.lockedSlots[location.index]) {
            setMessage(`第 ${location.index + 1} 格已鎖定，不能移出卡牌。`, "error");
            return;
          }
          if (location.index === targetIndex) {
            session.selectedSource = null;
            setMessage(`${card} 號牌維持在第 ${targetIndex + 1} 格。`);
            renderPuzzle();
            return;
          }
          session.slots[location.index] = targetCard;
          session.slots[targetIndex] = card;
        }
        session.selectedCard = card;
        session.selectedSource = null;
        setMessage(`${card} 號道具牌已放到上方第 ${targetIndex + 1} 格。`);
        renderPuzzle();
      }

      function returnCardToBank(card) {
        const session = currentSession();
        if (!session || session.solved) return;
        const location = cardLocation(session, card);
        if (!location || location.source === "bank") return;
        if (session.lockedSlots[location.index]) {
          setMessage(`第 ${location.index + 1} 格已鎖定，不能收回卡牌。`, "error");
          return;
        }
        session.slots[location.index] = null;
        session.bankOrder.push(card);
        session.selectedCard = card;
        session.selectedSource = "bank";
        setMessage(`${card} 號牌已從第 ${location.index + 1} 格收回下方。`);
        renderPuzzle();
      }

      function toggleLock(index) {
        const session = currentSession();
        if (!session || session.solved || index < 0 || index >= api.CARD_COUNT || !Number.isInteger(session.slots[index])) return;
        session.lockedSlots[index] = !session.lockedSlots[index];
        if (session.lockedSlots[index] && session.selectedSource === "slot" && session.selectedCard === session.slots[index]) {
          session.selectedSource = null;
        }
        setMessage(`第 ${index + 1} 格已${session.lockedSlots[index] ? "鎖定" : "解鎖"}。`);
        renderPuzzle();
      }

      function shuffleUnlocked() {
        const session = currentSession();
        if (!session || session.solved) return;
        if (session.bankOrder.length < 2) {
          setMessage("下方至少需要兩張卡牌才能洗牌。", "error");
          return;
        }
        for (let index = session.bankOrder.length - 1; index > 0; index -= 1) {
          const target = Math.floor(Math.random() * (index + 1));
          [session.bankOrder[index], session.bankOrder[target]] = [session.bankOrder[target], session.bankOrder[index]];
        }
        session.selectedCard = null;
        session.selectedSource = null;
        setMessage(`已洗牌下方 ${session.bankOrder.length} 張未放置卡牌；上方格保持不動。`);
        renderPuzzle();
      }

      function unlockAll() {
        const session = currentSession();
        if (!session || session.solved) return;
        session.lockedSlots.fill(false);
        session.selectedSource = null;
        setMessage("十三個上方位置已全部解鎖；排列與下方牌區保持不動。" );
        renderPuzzle();
      }

      function resetPuzzle() {
        const session = currentSession();
        if (!session || session.solved) return;
        session.slots.fill(null);
        session.bankOrder = [...session.puzzle.initialOrder];
        session.lockedSlots.fill(false);
        session.selectedCard = null;
        session.selectedSource = null;
        setMessage("已清空上方 13 格，所有正式道具牌回到下方初始順序。" );
        renderPuzzle();
      }

      function submitPuzzle() {
        const session = currentSession();
        if (!session || session.solved) return;
        session.attempts += 1;
        if (session.slots.some(card => !Number.isInteger(card))) {
          setMessage("上方仍有空格，請先放滿十三張卡牌。", "error");
          renderPuzzle();
          return;
        }
        if (!api.arraysEqual(session.slots, session.puzzle.solution)) {
          setMessage("座標仍有誤，請重新比對十三條線索。", "error");
          renderPuzzle();
          return;
        }
        if (EMBEDDED) {
          state.pendingSubmit = true;
          setMessage("正在由主遊戲確認個人解碼結果……");
          renderPuzzle();
          sendParent("york-puzzle-submit", {
            difficultyKey: session.puzzle.difficultyKey,
            order: [...session.slots],
          });
          return;
        }
        const practice = state.currentTier >= 3;
        session.solved = true;
        state.currentTier = Math.max(state.currentTier, session.puzzle.targetTier);
        const firstReveal = !state.eggheadRevealed;
        if (!practice) state.eggheadRevealed = true;
        showResult(session, practice ? false : firstReveal, { practice, rewardGranted: !practice });
      }

      function showResult(session, firstReveal, result = {}) {
        const puzzle = session.puzzle;
        const practice = Boolean(result.practice);
        if (practice) {
          refs.resultTierLabel.textContent = "練習結果";
          refs.resultWorldLabel.textContent = "世界狀態";
          refs.resultRateLabel.textContent = "名刀掉落率";
          refs.resultTitle.textContent = `${api.DIFFICULTIES[puzzle.difficultyKey].label}新題目完成`;
          refs.resultDescription.textContent = "你已完成三階後的練習題。本次只保留遊玩結果，不會新增解碼器、提升名刀掉落率或發放其他加成獎勵。";
          refs.resultDecoder.src = DIFFICULTY_ASSETS[puzzle.difficultyKey].decoder;
          refs.resultTier.textContent = "未獲得新道具或階級";
          refs.resultRate.textContent = `${Math.round(Number(result.dropRate ?? api.eclipseDropRateForTier(state.currentTier)) * 100)}%（維持不變）`;
          refs.resultWorld.textContent = "練習模式・不重播解鎖與獎勵";
          refs.resultOverlay.classList.remove("hidden");
          return;
        }
        refs.resultTierLabel.textContent = "個人升級";
        refs.resultWorldLabel.textContent = "世界座標";
        refs.resultRateLabel.textContent = "名刀掉落率";
        refs.resultTitle.textContent = `${api.DIFFICULTIES[puzzle.difficultyKey].label}座標解碼成功`;
        refs.resultDescription.textContent = firstReveal
          ? "你完成了本隊第一份解碼，蛋頭島座標將對全隊揭露；解碼器階級則只屬於本玩家。"
          : "蛋頭島座標已經揭露；本次成功只提升你的個人解碼器階級，不覆寫其他玩家狀態。";
        refs.resultDecoder.src = DIFFICULTY_ASSETS[puzzle.difficultyKey].decoder;
        refs.resultTier.textContent = result.itemName || puzzle.targetItemName;
        refs.resultRate.textContent = `${Math.round(Number(result.dropRate ?? puzzle.dropRate) * 100)}%（每位參戰玩家各自判定）`;
        refs.resultWorld.textContent = firstReveal ? "首次完成後揭露" : "已揭露・不重播全隊解鎖";
        refs.resultOverlay.classList.remove("hidden");
      }

      window.addEventListener("message", event => {
        if (!EMBEDDED || event.origin !== window.location.origin || event.source !== window.parent) return;
        const message = event.data || {};
        if (message.channel !== CHANNEL || message.type !== "york-puzzle-result") return;
        const session = currentSession();
        if (!session) return;
        state.pendingSubmit = false;
        if (!message.ok) {
          session.solved = false;
          setMessage("座標仍有誤，請重新比對十三條線索。", "error");
          renderPuzzle();
          return;
        }
        session.solved = true;
        state.currentTier = Math.max(state.currentTier, Number(message.tier || session.puzzle.targetTier));
        state.eggheadRevealed = Boolean(message.eggheadRevealed);
        showResult(session, Boolean(message.firstReveal), message);
      });

      refs.exitButton.addEventListener("click", () => {
        if (!sendParent("york-puzzle-close")) closePuzzle();
      });
      refs.backButton.addEventListener("click", closePuzzle);
      refs.shuffleButton.addEventListener("click", shuffleUnlocked);
      refs.unlockAllButton.addEventListener("click", unlockAll);
      refs.resetButton.addEventListener("click", resetPuzzle);
      refs.submitButton.addEventListener("click", submitPuzzle);
      refs.resultClose.addEventListener("click", () => {
        refs.resultOverlay.classList.add("hidden");
        if (sendParent("york-puzzle-close", { afterSuccess: true })) return;
        closePuzzle();
      });

      renderDifficultySelection();
return {state,refs,api,functions:{sendParent,currentSession,tierLabel,setMessage,difficultyCardMarkup,renderDifficultySelection,openPuzzle,closePuzzle,clueCardMarkup,targetSlotMarkup,bankCardMarkup,renderPuzzle,bindPuzzleEvents,cardLocation,handleBankCardClick,handleSlotClick,placeCardInSlot,returnCardToBank,toggleLock,shuffleUnlocked,unlockAll,resetPuzzle,submitPuzzle,showResult}};
};
