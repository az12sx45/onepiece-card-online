(() => {
  'use strict';

  const SPECIES = Object.freeze({
    'balloon-catfish': '氣球鯰魚',
    'panda-shark': '熊貓鯊',
    'glistening-saury': '閃亮秋刀魚',
    'smile-jellyfish': '微笑水母',
    butterflyfish: '蝶魚',
    'adventure-fish': '冒險魚',
    'cola-sunfish': '可樂翻車魚',
    'reef-shark': '鯊魚',
    'elephant-tuna': '象鼻鮪魚',
    'lovely-angel': '可愛天使魚',
    'striped-clam': '條紋蛤蜊',
    'cutie-piranha': '可愛食人魚',
    'claw-shrimp': '剪刀蝦',
    'pumpkin-octopus': '南瓜章魚',
    'maple-salmon': '紅葉鮭魚',
    'lava-flounder': '熔岩比目魚',
    'treasure-pearl-clam': '寶藏珍珠貝',
    'electric-catfish': '感電鯰魚',
    'demon-bonito': '鬼鰹魚',
    'guiding-anglerfish': '引路鮟鱇魚',
    'ice-fish': '冰晶魚',
    'beat-alligator': '節奏鱷魚',
    'aurora-sunfish': '極光翻車魚',
    'burning-dragon': '燃燒龍',
    'great-terigius': '巨型泰利吉烏斯',
    'golden-whale': '黃金鯨',
    'largemouth-bass': '大嘴鱸魚',
    warmouth: '暖口太陽魚',
    'congo-bichir': '剛果多鰭魚',
    paddlefish: '匙吻鱘',
    'alligator-gar': '鱷雀鱔',
    dolphinfish: '鯕鰍',
    lionfish: '獅子魚',
    'dusky-grouper': '褐石斑魚',
    'goliath-grouper': '巨型石斑魚',
    'white-marlin': '白馬林魚'
  });
  const LEGACY_FISH = new Set(['balloon-catfish', 'panda-shark', 'glistening-saury', 'smile-jellyfish']);
  const UA_FISH = new Set(['adventure-fish', 'panda-shark', 'elephant-tuna', 'lovely-angel', 'striped-clam', 'cutie-piranha', 'claw-shrimp', 'pumpkin-octopus', 'maple-salmon', 'lava-flounder', 'treasure-pearl-clam', 'electric-catfish', 'demon-bonito', 'guiding-anglerfish', 'ice-fish', 'beat-alligator', 'aurora-sunfish', 'burning-dragon', 'great-terigius', 'golden-whale']);
  const MASTER_FISH = new Set(['largemouth-bass', 'warmouth', 'congo-bichir', 'paddlefish', 'alligator-gar', 'dolphinfish', 'lionfish', 'dusky-grouper', 'goliath-grouper', 'white-marlin']);
  const fishArt = speciesId => `opui://launcher/images/launcher_room/${MASTER_FISH.has(speciesId) ? 'fish_master' : UA_FISH.has(speciesId) ? 'fish_ua' : LEGACY_FISH.has(speciesId) ? 'fish_v1' : 'fish_v3'}/${speciesId === 'golden-whale' ? 'golden-whale-v2' : speciesId}.webp`;
  // The cutouts do not all face the same way. Keep their head in the direction
  // of travel; shellfish and other bottom dwellers should not patrol the tank.
  const LEFT_FACING = new Set(['glistening-saury', 'adventure-fish', 'panda-shark', 'elephant-tuna', 'lovely-angel', 'cutie-piranha', 'maple-salmon', 'lava-flounder', 'electric-catfish', 'demon-bonito', 'ice-fish', 'beat-alligator', 'aurora-sunfish', 'burning-dragon', 'great-terigius']);
  const CLAMS = new Set(['striped-clam', 'treasure-pearl-clam']);
  const LARGE = new Set(['panda-shark', 'reef-shark', 'elephant-tuna', 'beat-alligator', 'great-terigius', 'golden-whale', 'paddlefish', 'alligator-gar', 'dolphinfish', 'dusky-grouper', 'goliath-grouper', 'white-marlin']);
  const SMALL = new Set(['glistening-saury', 'butterflyfish', 'cutie-piranha', 'claw-shrimp', 'striped-clam', 'treasure-pearl-clam', 'ice-fish', 'warmouth', 'lionfish']);

  function motionFor(speciesId) {
    if (CLAMS.has(speciesId)) return 'perch';
    if (speciesId === 'smile-jellyfish' || speciesId === 'lionfish') return 'drift';
    if (speciesId === 'pumpkin-octopus') return 'pulse';
    if (speciesId === 'claw-shrimp') return 'backstep';
    return 'swim';
  }

  function sizeFor(speciesId, compact) {
    if (speciesId === 'golden-whale') return compact ? 21 : 15;
    if (LARGE.has(speciesId)) return compact ? 19 : 11;
    if (SMALL.has(speciesId)) return compact ? 12 : 6;
    return compact ? 15 : 8;
  }

  function laneFor(fish, index, compact) {
    const variation = seed(fish.id + 'lane');
    if (fish.speciesId === 'golden-whale') return compact ? 7 + variation % 4 : 8 + variation % 3;
    if (fish.speciesId === 'alligator-gar') return compact ? 12 + variation % 5 : 14 + variation % 5;
    if (fish.speciesId === 'beat-alligator') return compact ? 35 + variation % 8 : 42 + variation % 7;
    if (fish.speciesId === 'dusky-grouper' || fish.speciesId === 'goliath-grouper') return compact ? 35 + variation % 9 : 57 + variation % 8;
    if (fish.speciesId === 'pumpkin-octopus') return compact ? 36 + variation % 5 : 60 + variation % 3;
    if (CLAMS.has(fish.speciesId)) return compact ? 51 + variation % 7 : 76 + variation % 3;
    if (fish.speciesId === 'claw-shrimp') return compact ? 51 + variation % 7 : 73 + variation % 4;
    if (fish.speciesId === 'lava-flounder') return compact ? 51 + variation % 7 : 68 + variation % 3;
    return compact ? 8 + (index * 11 + variation % 7) % 31 : 10 + (index * 12 + variation % 9) % 39;
  }

  function displayedFish(profile, collectionOverride) {
    const collection = Array.isArray(collectionOverride) ? collectionOverride : profile?.life?.fishCollection;
    if (!Array.isArray(collection)) return [];
    return collection.filter(fish => fish && fish.inAquarium === true &&
      typeof fish.id === 'string' && Object.hasOwn(SPECIES, fish.speciesId)).slice(0, 6);
  }

  function seed(value) {
    let hash = 2166136261;
    for (const character of String(value)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return hash >>> 0;
  }

  function addFish(windowNode, fish, index, compact) {
    const lane = document.createElement('span');
    lane.className = 'room-aquarium-fish';
    lane.dataset.fishId = fish.id;
    lane.dataset.speciesId = fish.speciesId;
    const motion = motionFor(fish.speciesId);
    lane.dataset.swim = motion;
    lane.style.setProperty('--fish-index', String(index));
    lane.style.setProperty('--fish-lane', `${laneFor(fish, index, compact)}%`);
    lane.style.setProperty('--fish-home', `${CLAMS.has(fish.speciesId) && !compact
      ? fish.speciesId === 'striped-clam' ? 16 + seed(fish.id + 'home') % 8 : 68 + seed(fish.id + 'home') % 8
      : 12 + (index * 13 + seed(fish.id + 'home') % 15) % 62}%`);
    lane.style.setProperty('--fish-duration', `${motion === 'swim'
      ? fish.speciesId === 'golden-whale' || fish.speciesId === 'beat-alligator' || fish.speciesId === 'goliath-grouper' ? 26 + seed(fish.id + 'speed') % 6 : 13 + seed(fish.id + 'speed') % 8
      : motion === 'perch' ? 3 + seed(fish.id + 'speed') % 3 : 6 + seed(fish.id + 'speed') % 4}s`);
    lane.style.setProperty('--fish-delay', `${-(seed(fish.id + 'phase') % 160) / 10}s`);
    lane.style.setProperty('--fish-bob', `${1.4 + (seed(fish.id + 'bob') % 12) / 10}s`);
    lane.style.setProperty('--fish-size', `${sizeFor(fish.speciesId, compact)}%`);
    lane.style.setProperty('--fish-face-right', LEFT_FACING.has(fish.speciesId) ? '-1' : '1');
    const sprite = document.createElement('img');
    sprite.src = fishArt(fish.speciesId);
    sprite.alt = '';
    sprite.decoding = 'async';
    sprite.draggable = false;
    sprite.onerror = () => lane.remove();
    lane.append(sprite);
    windowNode.append(lane);
  }

  function render({ stage, profile, room, editing, fishCollection } = {}) {
    if (!stage || !room) return;
    const fish = displayedFish(profile, fishCollection);
    const furnitureWindows = [...stage.querySelectorAll('.room-aquarium-window')];
    const sceneWindow = stage.querySelector('.room-aquarium-scene-window');
    const activeSceneWindow = room.sceneId === 'room-scene-sunny-aquarium' ? sceneWindow : null;
    // One collection has one display: the dedicated aquarium room takes priority.
    // A furniture tank facing away does not expose a glass window for the fish.
    const activeFurnitureWindow = !activeSceneWindow && furnitureWindows.find(node =>
      node.closest('.room-aquarium-furniture')?.dataset.rotation !== '2');
    const displayWindow = activeSceneWindow || activeFurnitureWindow;
    const windows = [...furnitureWindows, sceneWindow].filter(Boolean);
    for (const windowNode of windows) {
      windowNode.querySelectorAll(':scope > .room-aquarium-fish').forEach(node => node.remove());
      windowNode.dataset.fishCount = String(windowNode === displayWindow ? fish.length : 0);
      windowNode.setAttribute('aria-hidden', 'true');
      if (windowNode === displayWindow) {
        const compact = windowNode.classList.contains('room-aquarium-window');
        fish.forEach((item, index) => addFish(windowNode, item, index, compact));
      }
    }
    stage.classList.toggle('has-aquarium-fish', fish.length > 0);
    stage.classList.toggle('room-aquarium-paused', !!editing);
    stage.dataset.aquariumFishCount = String(fish.length);
  }

  window.OnePieceRoomAquarium = Object.freeze({ render, displayedFish, species: SPECIES });
})();
