(() => {
  'use strict';

  const SPECIES = Object.freeze({
    'balloon-catfish': '氣球鯰魚',
    'panda-shark': '熊貓鯊',
    'glistening-saury': '閃亮秋刀魚',
    'smile-jellyfish': '微笑水母'
  });
  const ASSET_ROOT = 'opui://launcher/images/launcher_room/fish_v1/';

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
    lane.style.setProperty('--fish-index', String(index));
    lane.style.setProperty('--fish-lane', `${compact
      ? 6 + (index * 13 + seed(fish.id) % 7) % 31
      : 10 + (index * 12 + seed(fish.id) % 9) % 40}%`);
    lane.style.setProperty('--fish-duration', `${11 + seed(fish.id + 'speed') % 9}s`);
    lane.style.setProperty('--fish-delay', `${-(seed(fish.id + 'phase') % 160) / 10}s`);
    lane.style.setProperty('--fish-bob', `${1.4 + (seed(fish.id + 'bob') % 12) / 10}s`);
    lane.style.setProperty('--fish-size', `${compact ? 15 + seed(fish.id + 'size') % 5 : 9 + seed(fish.id + 'size') % 4}%`);
    const sprite = document.createElement('img');
    sprite.src = `${ASSET_ROOT}${fish.speciesId}.webp`;
    sprite.alt = '';
    sprite.decoding = 'async';
    sprite.draggable = false;
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
