// public/i18n/en.js
window.__I18N_DICTS = window.__I18N_DICTS || {};
window.__I18N_DICTS["en"] = {
  meta: { label: "English" },

  ui: {
    lang: "Language",
    pressAnyKey: "Press any key",
    startGame: "Start Game",
    rules: "Rules",
    close: "Close",

    rotateTitle: "Rotate your phone to landscape for the best experience",
    rotateHint: "If rotation doesn't work, unlock screen rotation or enable “Allow rotation” in your browser menu.",

    connectingLobby: "Connecting to lobby...",
    back: "Back",

    createCharacter: "Create Character",
    localSaved: "Saved locally (localStorage)",
    playerName: "Player Name",
    namePlaceholder: "Enter your name",
    nameHint: "* Up to 16 characters. You can change it later.",
    chooseAvatar: "Choose Avatar (30)",
    avatarPath: "Path: images/avatars/1.webp ~ 30.webp",
    createRoom: "Create Room",
    joinRoom: "Join Room",

    roomMode: "Room Mode",
    createOrJoin: "Create / Join Room",
    playerId: "Player ID: {id}",

    createRoomTitle: "Create Room",
    host: "Host",
    cpuCountLabel: "CPU players",
    cpuCountHint: "Will be added to the room automatically (0–3)",
    cpuCountFootnote: "* This is the selection + persistence step. AI actions will be connected later.",
    createNewRoom: "🏴‍☠️ Create New Room",

    joinFriendRoom: "Join a friend's room",
    enterRoomCode: "Room code",
    roomCodePlaceholder: "e.g. AB2D9F",
    roomCodeHint: "* Case-insensitive.",
    joinRoomBtn: "🔑 Join Room",

    suggestion: "Recommended: 2–4 human players. CPU count can be adjusted later.",

    roomId: "Room",
    copyRoomId: "Copy",
    leaveRoom: "Leave",
    startGameBtn: "Start",
    startGameNeed: "Need at least 2 players and everyone ready",

    cpuPlayers: "CPU Players: {n}",
    cpuWillJoin: "CPU will join automatically after the game starts.",

    humanPlayers: "Human Players ({n})",
    cpuPlayersList: "CPU Players ({n})",
    player: "Player",
    ready: "Ready",
    notReady: "Not ready",
    meReady: "Ready",
    meUnready: "Unready",
    cpuTag: "CPU",

    lobbyFootnote: "This lobby is synced with the server snapshot via Socket.IO. CPU will join after the game starts.",

    prev: "Previous",
    next: "Next",
    tipPrefix: "Tip:",
    rulesHotkeys: "Hotkeys: ← / → to flip pages, Esc to close",

    preloadAll: "📦 Download all assets (Wi-Fi recommended)",
    preloadStart: "Starting (0 / {total})...",
    preloading: "Downloading... {done} / {total} ({pct}%)",
    preloadDone: "Done! Success {ok}, Failed {fail}.",

    alertNeedRoomId: "Please enter a room code",
    alertCopiedRoomId: "Copied room code: {roomId}"
  },

  brand: {
    titleEn: "ONE PIECE",
    titleSub: "Grand Line Battle",
    tagline: "ONE PIECE ｜ Card Battle ｜ PVP Multiplayer"
  },

  cpu: {
    name1: "Crocodile",
    name2: "Mihawk",
    name3: "Buggy"
  },

  // ===== Rules (full translation) =====
  rules: {
    overview: {
      title: "Battlefield Overview",
      bullets: [
        "This is the main screen for the entire match.",
        "On your turn, actionable areas will be highlighted or prompted.",
        "No need to memorize rules at first—follow the on-screen prompts and you can play."
      ],
      tip: "Skim through once to learn where each panel is."
    },

    header: {
      title: "Top Bar: Treasure Coins & Card Encyclopedia",
      bullets: [
        "“Treasure Coins Remaining” = rewards still available to be taken this game.",
        "Your goal is to compete with other players to claim coins from the treasure chest.",
        "When the treasure coins are fully claimed, the player with the most coins wins.",
        "“Card Encyclopedia” lets you check every card’s count and skills (available anytime)."
      ],
      tip: "New players: if you want to know a character’s skill, open the encyclopedia."
    },

    gallery: {
      title: "Card Encyclopedia: All Characters at a Glance",
      bullets: [
        "Shows all characters (0–19) and how many copies exist.",
        "Cards outlined in red are “Enhanced” this game due to the venue."
      ],
      tip: "You don’t need to memorize skills—look them up when you actually need them."
    },

    cardDetail: {
      title: "Card Details: Normal vs Enhanced",
      bullets: [
        "Tap a character in the encyclopedia to see both “Normal” and “Enhanced” versions.",
        "If the current venue enhances that character, use the Enhanced effect."
      ],
      tip: "No need to track exceptions—the encyclopedia shows the differences side by side."
    },

    venuePanel: {
      title: "Venue Cards & Deck",
      bullets: [
        "Each game features different venue cards that affect specific characters.",
        "Number of venue cards = (player count) / 2.",
        "You can click venue cards to change the background (visual only; no gameplay impact).",
        "Deck: On your turn, click to draw a card. When the deck reaches 0,",
        "after the last player who drew ends their turn, the winner is determined by hand strength."
      ],
      tip: "If you see a red outline or an “Enhanced” hint, it is usually venue-related."
    },

    venueBg: {
      title: "Background Effect: Visual Switching via Venue Cards",
      bullets: [
        "Clicking a venue card to switch backgrounds is purely for atmosphere.",
        "It does not change rules, skills, or win conditions."
      ],
      tip: "Use it if you like—ignoring it won’t affect the game."
    },

    players: {
      title: "Players Panel: Who’s In, Who’s Out, and Status Effects",
      bullets: [
        "The right panel lists all players: avatar, name, and coins.",
        "The highlighted frame indicates whose turn it is.",
        "It also shows your current hand,",
        "and displays eliminations and special statuses (e.g., Protection, Freeze, Paralysis, etc.)."
      ],
      tip: "Look at the right side to know whose turn it is and who can still act."
    },

    discard: {
      title: "Discard Pile: All Played Cards Are Shown Here",
      bullets: [
        "Cards that have been played, and the hands of eliminated players, go to the discard pile.",
        "Advanced players use discard information to infer what others may still hold."
      ],
      tip: "As a beginner, just know where it is—later you’ll naturally start checking it."
    },

    log: {
      title: "Match Log: See What Happened at a Glance",
      bullets: [
        "The log records draws, plays, skills, eliminations, and other events.",
        "If you’re unsure what just happened, check the log first."
      ],
      tip: "For replaying events, the log is the most reliable reference."
    },

    drawOnly: {
      title: "Draw: The First Step of Your Turn",
      bullets: [
        "On your turn, the UI will prompt you to draw.",
        "Click the deck to draw one card."
      ],
      tip: "When you see the “Please draw” prompt, draw first—don’t rush your decision yet."
    },

    afterDrawView: {
      title: "After Drawing: Choose a Card to Play",
      bullets: [
        "After you draw, your two hand cards appear at the bottom of the screen.",
        "Now choose one card from your hand to play.",
        "Click a card to play it and resolve its effect."
      ],
      tip: "Drawing is done—this is the moment to think and decide."
    },

    playCardCoreRule: {
      title: "How Played-Card Effects Work",
      bullets: [
        "Each turn, you may play only one card from your hand to choose which character effect to activate.",
        "When resolving the effect, the game uses the card that remains in your hand (the unplayed one).",
        "If an effect involves swapping hands, comparing values, or dueling, it uses the value/content of your remaining hand card.",
        "The played card itself does not participate in swaps or value comparisons.",
        "This diagram shows: playing a card is selecting the effect you want to trigger.",
        "Starting next page, examples demonstrate what happens when you play 6 vs when you play 13."
      ],
      tip: "Remember: the played card selects the effect; the remaining card is used for swaps/comparisons."
    },

    examplePlay6: {
      title: "Example: Playing Card #6",
      bullets: [
        "The player holds two cards: 6 and 13.",
        "Playing 6 activates Law’s “ROOM” skill effect.",
        "When the skill resolves, it uses the remaining unplayed card (13).",
        "So the player swaps hands using 13 with the chosen target player."
      ],
      tip: "Playing 6 chooses the skill; the actual swap uses the 13 you kept."
    },

    examplePlay13: {
      title: "Example: Playing Card #13",
      bullets: [
        "The player still holds two cards: 6 and 13.",
        "Playing 13 activates the “Duel (compare values)” effect.",
        "When comparing values, the game uses the remaining unplayed card (6).",
        "So the duel is performed using value 6 against the opponent."
      ],
      tip: "The played card decides the effect; the remaining card is what you compare."
    },

    extraRules: {
      title: "Additional Rules & Key Reminders",
      bullets: [
        "1. Any effect that requires “value comparison” or “guessing a card” is based on the last remaining card in a player’s hand.",
        "2. In normal comparisons, cards 10 or higher use only the last digit (e.g., 12 is treated as 2, 18 is treated as 8).",
        "3. If a comparison results in the same value, it is a tie and neither side is eliminated.",
        "4. Value comparisons only determine higher/lower; they do not trigger any character skills or venue effects.",
        "5. If a skill requires a target but there is no valid target, the skill does not activate—but the play still counts as completed.",
        "6. Protected or dodging players can still be selected, but comparison results will not affect them.",
        "7. When a player is eliminated, their hand is revealed immediately and moved to the discard pile.",
        "8. All values and win/lose determinations follow what is shown on screen at the time as the final result."
      ],
      tip: "Remember: normal duels use the last digit; the final showdown uses “sum of digits” (per your game’s end condition)."
    }
  }
};
