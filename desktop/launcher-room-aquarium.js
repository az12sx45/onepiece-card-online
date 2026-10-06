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
    if (sceneWindow) {
      const interactive = !!activeSceneWindow && !editing;
      sceneWindow.tabIndex = interactive ? 0 : -1;
      sceneWindow.setAttribute('role', interactive ? 'button' : 'presentation');
      sceneWindow.setAttribute('aria-label', interactive ? '查看並管理水族箱漁獲' : '');
      sceneWindow.setAttribute('aria-hidden', String(!interactive));
    }
  }

  const RARITY_NAMES = Object.freeze({ common: '普通', uncommon: '優良', rare: '稀有', legendary: '傳說' });
  const element = (tag, className = '', content) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = String(content);
    return node;
  };
  function createManager(options = {}) {
    let layer = null, card = null, selectedFishId = '', recipientId = '';
    let busy = false, confirmation = '', confirmTimer = 0, previousFocus = null;
    let message = '', messageIsError = false;
    const collection = () => (Array.isArray(options.collection?.()) ? options.collection() : [])
      .filter(fish => fish && typeof fish.id === 'string' && Object.hasOwn(SPECIES, fish.speciesId));
    const offers = () => new Map((Array.isArray(options.fishOffers?.()) ? options.fishOffers() : [])
      .filter(offer => offer && typeof offer.fishId === 'string').map(offer => [offer.fishId, offer]));
    const owner = () => options.isOwner?.() === true;
    const present = () => !!layer && !layer.hidden;
    const ownedCharacters = () => (Array.isArray(options.ownedCharacterIds?.()) ? options.ownedCharacterIds() : [])
      .filter(id => typeof id === 'string' && id.startsWith('room-character-'));
    const coin = wallet => wallet?.coins!==null&&wallet?.coins!==undefined&&Number.isFinite(Number(wallet?.coins)) ? Number(wallet.coins) : null;
    const cap = wallet => Number.isFinite(Number(wallet?.cap)) ? Number(wallet.cap) : 500;
    function clearConfirmation() {
      confirmation = '';
      clearTimeout(confirmTimer);
      confirmTimer = 0;
    }
    function askConfirmation(key) {
      if (confirmation === key) { clearConfirmation(); return true; }
      clearConfirmation(); confirmation = key;
      confirmTimer = setTimeout(() => { clearConfirmation(); if (present()) renderManager(); }, 7000);
      renderManager();
      card.querySelector(key.startsWith('cook:') ? '.room-aquarium-manager-primary' :
        key.startsWith('sell:') ? '.room-aquarium-manager-sell' : '.room-aquarium-manager-upgrade')?.focus({ preventScroll: true });
      return false;
    }
    function ensure() {
      if (layer) return;
      layer = element('div', 'room-aquarium-manager-overlay');
      layer.hidden = true;
      layer.id = 'roomAquariumManager';
      layer.setAttribute('role', 'dialog');
      layer.setAttribute('aria-modal', 'true');
      layer.setAttribute('aria-labelledby', 'roomAquariumManagerTitle');
      card = element('section', 'room-aquarium-manager-card');
      layer.append(card);
      layer.addEventListener('pointerdown', event => { if (event.target === layer) close(); });
      layer.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); close(); return; }
        if (event.key !== 'Tab') return;
        const focusable = [...card.querySelectorAll('button:not(:disabled), select:not(:disabled)')];
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      });
      document.body.append(layer);
    }
    function close() {
      if (!present()) return;
      layer.hidden = true;
      clearConfirmation();
      const focus = previousFocus;
      previousFocus = null;
      if (focus?.isConnected) focus.focus({ preventScroll: true });
      else options.focusStage?.();
    }
    function open() {
      ensure();
      if (present()) return;
      previousFocus = document.activeElement;
      selectedFishId = ''; recipientId = ''; message = ''; messageIsError = false;
      layer.hidden = false;
      renderManager();
      card.querySelector('.room-aquarium-manager-close')?.focus({ preventScroll: true });
      if (owner()) void Promise.resolve(options.refresh?.()).then(() => {
        if (present()) renderManager();
      }).catch(() => {});
    }
    async function perform(type, payload, success) {
      if (!owner() || busy) return;
      busy = true; renderManager();
      let response;
      try { response = await options.command?.(type, payload); }
      catch { response = { ok: false, error: 'offline' }; }
      busy = false;
      if (!present()) return;
      if (response?.ok) {
        if (response.meal) options.onMeal?.(response.meal);
        options.onResult?.(response);
        clearConfirmation();
        message = success(response); messageIsError = false;
        renderManager();
        return;
      }
      const error = {
        fish_not_owned: '這尾魚已不在收藏，正在重新核對。',
        fish_not_cookable: '這尾魚不適合料理，請選擇其他魚。',
        affinity_full: '這位夥伴的親密度已滿，魚仍留在收藏。',
        wallet_full: '釣魚金幣放不下這尾魚的售價；魚仍留在收藏。',
        fish_aquarium_full: '魚缸最多展示六尾魚，先收回一尾。',
        fish_aquarium_locked: '需先收藏水族箱家具或千陽號水族館場景。',
        insufficient_coins: '釣魚金幣不足，先出售漁獲。',
        rod_max_level: '釣竿已改裝到最高等級。',
        readonly: '參觀好友房間時不能使用對方的漁獲。',
        offline: '連線中斷，正在核對最新漁獲與金幣。',
        unavailable: '暫時無法連上基地，請稍後再試。'
      }[response?.error] || '操作未完成，漁獲仍保留；請稍後再試。';
      message = error; messageIsError = true;
      renderManager();
      if (['fish_not_owned', 'offline', 'unavailable', 'revision_conflict'].includes(response?.error)) {
        try { await options.refresh?.(); } catch {}
        if (present()) renderManager();
      }
    }
    function button(label, className, handler) {
      const node = element('button', className, label);
      node.type = 'button'; node.onclick = handler;
      return node;
    }
    function rarity(offer) {
      const value = RARITY_NAMES[offer?.rarity] ? offer.rarity : 'common';
      const badge = element('span', 'room-aquarium-manager-rarity', RARITY_NAMES[value]);
      badge.dataset.rarity = value;
      return badge;
    }
    function art(speciesId, className = '') {
      const image = element('img', className);
      image.src = fishArt(speciesId); image.alt = SPECIES[speciesId] || '漁獲';
      image.loading = 'lazy'; image.decoding = 'async'; image.draggable = false;
      image.onerror = () => { image.onerror = null; image.hidden = true; };
      return image;
    }
    function appendWorkshop(rod, balance) {
      if (!owner()) return;
      const workshop = element('footer', 'room-aquarium-manager-workshop');
      const selectedRod=rod?.characters?.[recipientId]||rod;
      const chooser=element('select','room-aquarium-manager-rod-character');chooser.setAttribute('aria-label','選擇改裝釣竿的角色');
      for(const id of ownedCharacters()){const option=element('option','',options.recipient?.(id)?.name||id);option.value=id;chooser.append(option);}
      chooser.value=recipientId;chooser.disabled=busy;chooser.onchange=()=>{recipientId=chooser.value;clearConfirmation();renderManager();};workshop.append(chooser);
      const level = Number.isInteger(selectedRod?.level) ? selectedRod.level : null;
      const maxLevel = Number.isInteger(rod?.maxLevel) ? rod.maxLevel : 99;
      const nextCost = Number.isInteger(selectedRod?.nextCost) ? selectedRod.nextCost : null;
      workshop.append(element('span', '', `佛朗基釣竿工房 · ${level === null ? '等級讀取中' : `+${level} / +${maxLevel}`}`),
        element('small', '', level === null ? '正在讀取改裝資料' : level >= maxLevel ? '釣竿已達最高等級' : `下一級需 ${nextCost ?? '—'} 枚釣魚金幣 · 目前 ${balance ?? '—'} 枚`));
      const upgrade = button(confirmation === 'rod.upgrade' ? '確定請佛朗基改裝' : level >= maxLevel ? '已滿級' : '請佛朗基改裝釣竿',
        'room-aquarium-manager-upgrade', () => {
          if (!askConfirmation('rod.upgrade')) return;
          void perform('rod.upgrade', {itemId:recipientId}, result => `佛朗基已把這位夥伴的釣竿強化到 +${result.rod?.characters?.[recipientId]?.level ?? '—'}。`);
        });
      upgrade.disabled = busy || level === null || level >= maxLevel || nextCost === null || balance === null || balance < nextCost;
      workshop.append(upgrade); card.append(workshop);
    }
    function renderManager() {
      if (!present()) return;
      const fish = collection();
      if (!fish.some(entry => entry.id === selectedFishId)) selectedFishId = fish[0]?.id || '';
      const selected = fish.find(entry => entry.id === selectedFishId);
      const offerById = offers(), offer = selected && offerById.get(selected.id);
      const wallet = options.wallet?.(), balance = coin(wallet), maxCoins = cap(wallet);
      const rod = options.rod?.();
      const recipients = owner() ? ownedCharacters() : [];
      if (!recipients.includes(recipientId)) recipientId = recipients[0] || '';
      const recipient = options.recipient?.(recipientId) || {};
      const affinity = recipient.affinity == null ? NaN : Number(recipient.affinity);
      const affinityFull = Number.isFinite(affinity) && affinity >= 100;
      card.replaceChildren();
      const header = element('header', 'room-aquarium-manager-header');
      const title = element('div');
      title.append(element('span', 'room-aquarium-manager-eyebrow', 'SUNNY AQUARIUM'),
        element('h2', '', '千陽號水族箱'));
      title.querySelector('h2').id = 'roomAquariumManagerTitle';
      title.append(element('p', '', owner() ? '挑一尾漁獲展示、請香吉士料理，或換成佛朗基的釣竿改裝金幣。' : '這是好友展示在水族箱裡的漁獲。'));
      const closeButton = button('×', 'room-aquarium-manager-close', close);
      closeButton.setAttribute('aria-label', '關閉水族箱管理');
      header.append(title, closeButton); card.append(header);
      const stats = element('div', 'room-aquarium-manager-stats');
      stats.append(element('span', '', `${owner() ? '漁獲收藏' : '展示漁獲'} ${fish.length}${owner() ? ' / 64' : ''}`),
        element('span', '', `缸中 ${fish.filter(entry => entry.inAquarium).length} / 6`));
      if (owner()) stats.append(element('span', '', `釣魚金幣 ${balance == null ? '讀取中' : balance.toLocaleString()}`));
      card.append(stats);
      const notice = element('p', 'room-aquarium-manager-status', message);
      notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite');
      notice.classList.toggle('is-error', messageIsError); card.append(notice);
      if (!fish.length) {
        const empty = element('div', 'room-aquarium-manager-empty');
        empty.append(element('strong', '', owner() ? '水族箱還沒有漁獲' : '好友還沒有展示漁獲'),
          element('p', '', owner() ? '釣到魚後會先收進漁獲收藏，再回到這裡決定展示、料理或出售。' : '等好友放進魚缸，就能在這裡看到。'));
        card.append(empty); appendWorkshop(rod, balance); return;
      }
      const body = element('div', 'room-aquarium-manager-body');
      const list = element('div', 'room-aquarium-manager-list');
      list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', '我的漁獲');
      for (const entry of fish) {
        const fishOffer = offerById.get(entry.id);
        const option = button('', 'room-aquarium-manager-fish', () => {
          selectedFishId = entry.id; clearConfirmation(); renderManager();
          card.querySelector(`[data-fish-id="${CSS.escape(entry.id)}"]`)?.focus({ preventScroll: true });
        });
        option.dataset.fishId = entry.id;
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', String(entry.id === selectedFishId));
        option.classList.toggle('is-selected', entry.id === selectedFishId);
        const copy = element('span');
        copy.append(element('strong', '', SPECIES[entry.speciesId]),
          element('small', '', entry.inAquarium ? '正在魚缸游動' : '收藏中'));
        option.append(art(entry.speciesId), copy);
        if (fishOffer) option.append(rarity(fishOffer));
        list.append(option);
      }
      body.append(list);
      const detail = element('div', 'room-aquarium-manager-detail');
      detail.append(art(selected.speciesId, 'room-aquarium-manager-hero'));
      const heading = element('div', 'room-aquarium-manager-fish-heading');
      heading.append(element('h3', '', SPECIES[selected.speciesId]));
      if (offer) heading.append(rarity(offer));
      detail.append(heading);
      detail.append(element('p', 'room-aquarium-manager-fish-state', selected.inAquarium ? '正在缸中展示 · 使用這尾魚後會從魚缸移除' : '已收進漁獲收藏'));
      if (!owner()) detail.append(element('p', 'room-aquarium-manager-readonly', '參觀模式可欣賞漁獲，只有主人能料理、出售或調整展示。'));
      else {
        const display = button(selected.inAquarium ? '收回收藏' : '放進魚缸', 'room-aquarium-manager-display', () => {
          void perform('fish.place', { fishId: selected.id, inAquarium: !selected.inAquarium },
            () => selected.inAquarium ? '已收回收藏。' : '已放進水族箱。');
        });
        display.disabled = busy || !offer || (!selected.inAquarium && fish.filter(entry => entry.inAquarium).length >= 6);
        if (!selected.inAquarium && fish.filter(entry => entry.inAquarium).length >= 6) display.title = '魚缸已展示六尾魚';
        detail.append(display);
        const cook = element('section', 'room-aquarium-manager-action');
        cook.append(element('span', 'room-aquarium-manager-eyebrow', 'SANJI’S GALLEY'),
          element('h4', '', '請香吉士料理'));
        cook.append(element('p', '', offer ? offer.cookable ? `${offer.dishLabel} · 享用後親密度 +${offer.affinityGain}` : '這種漁獲不適合料理，留在魚缸或出售更合適。' : '正在讀取料理資料…'));
        if (offer?.cookable) {
          const label = element('label', 'room-aquarium-manager-recipient', '給誰享用');
          const select = element('select');
          select.setAttribute('aria-label', '選擇享用料理的夥伴');
          for (const id of recipients) {
            const info = options.recipient?.(id) || {};
            const value = element('option', '', info.name || id.replace(/^room-character-/, ''));
            value.value = id;
            if (info.affinity != null && Number.isFinite(Number(info.affinity))) value.textContent += ` · 親密度 ${Math.min(100, Math.max(0, Number(info.affinity)))}`;
            select.append(value);
          }
          select.value = recipientId;
          select.disabled = busy || !recipients.length;
          select.onchange = () => {
            recipientId = select.value; clearConfirmation(); renderManager();
            card.querySelector('.room-aquarium-manager-recipient select')?.focus({ preventScroll: true });
          };
          label.append(select); cook.append(label);
          const feed = button(confirmation === `cook:${selected.id}:${recipientId}` ? '確定料理並送出' : '料理給夥伴', 'room-aquarium-manager-primary', () => {
            if (!askConfirmation(`cook:${selected.id}:${recipientId}`)) return;
            const name = options.recipient?.(recipientId)?.name || '夥伴';
            void perform('fish.cook', { fishId: selected.id, itemId: recipientId }, result =>
              `${result.meal?.dishLabel || offer.dishLabel}已送給${name}，親密度 +${result.meal?.affinityGained ?? 0}（目前 ${result.meal?.affinityAfter ?? '—'}）。`);
          });
          feed.disabled = busy || !recipientId || affinityFull;
          if (affinityFull) feed.title = '這位夥伴親密度已滿，可換一位享用';
          cook.append(feed);
        }
        detail.append(cook);
        const sale = element('section', 'room-aquarium-manager-action');
        sale.append(element('span', 'room-aquarium-manager-eyebrow', 'FRANKY’S WORKSHOP'),
          element('h4', '', '出售漁獲 · 釣竿改裝'));
        const saleCoins = Number.isInteger(offer?.saleCoins) ? offer.saleCoins : null;
        const fullWallet = saleCoins !== null && balance !== null && balance + saleCoins > maxCoins;
        sale.append(element('p', '', saleCoins === null ? '正在讀取售價…' : `售出可得 ${saleCoins} 枚釣魚金幣，用於佛朗基釣竿改裝，與商城金幣分開。`));
        const sell = button(confirmation === `sell:${selected.id}` ? '確定出售這尾魚' : `出售${saleCoins === null ? '' : ` · +${saleCoins} 釣魚金幣`}`,
          'room-aquarium-manager-sell', () => {
            if (!askConfirmation(`sell:${selected.id}`)) return;
            void perform('fish.sell', { fishId: selected.id }, result =>
              `${SPECIES[selected.speciesId]}已出售，釣魚金幣 +${result.sale?.amount ?? saleCoins}。`);
          });
        sell.disabled = busy || saleCoins === null || balance === null || fullWallet;
        if (fullWallet) sell.title = `金幣上限 ${maxCoins}，先花掉一些才能出售`; sale.append(sell);
        if (fullWallet) sale.append(element('small', 'room-aquarium-manager-limit', `出售後會超過 ${maxCoins} 枚上限，魚仍留在收藏。`));
        detail.append(sale);
      }
      body.append(detail); card.append(body);
      appendWorkshop(rod, balance);
    }
    return Object.freeze({ open, close, render: renderManager, isOpen: present });
  }

  window.OnePieceRoomAquarium = Object.freeze({ render, displayedFish, species: SPECIES, createManager });
})();
