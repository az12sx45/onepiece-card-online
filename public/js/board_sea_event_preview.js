(function () {
  'use strict';
  const api = window.BoardSeaEventVisuals;
  const defs = api.definitions;
  const labels = { money: '金錢海域', weather: '天氣海域', treasure: '寶藏海域', medicine: '藥物海域' };
  const descriptions = [
    '你救起一艘失去航向的補給船，船員用貝里與物資答謝。',
    '一艘商船請你護航一小段航路，交給你一筆像樣的分紅。',
    '黑市商人拿出不知來源的稀有貨，代價不低，但值得冒險。',
    '暗礁刮破船底，不只要修理，下一段航速也會被拖慢。',
    '海軍臨檢升級成正式盤查，被搜走一大筆航海資金。',
    '風向完全站在你這邊，帆船一路衝過浪頭。',
    '穩定海流把船推進到更遠的航線。',
    '強逆浪把船身往回拖，掌舵也變得吃力。',
    '暴風雨打斷航程，船被迫靠向最近的商店島避難。',
    '你被吹往同航線上的其他海格。',
    '潮濕天候讓你下回合難以掌舵。',
    '海面上漂來四個外型一樣的寶箱，裡面價值完全不同。',
    '箱身刻著航路記號，裡面有機會開出實用航海道具。',
    '寶箱外緣綁著護符，木箱機率下降，銀箱以上略微提高。',
    '箱鎖有被撬開的痕跡，還有東西，但高階寶箱比例偏低。',
    '寶箱看起來很可疑，仍能開獎，但多半只是普通木箱或銅箱。',
    '沉船艙門半開，裡面還有幾個保存完整的寶箱。',
    '箱面有古老航海記號，金箱與寶石箱比例明顯提高。',
    '漂流醫療船靠過來，替全隊做一次像樣的急救。',
    '這批補給讓全隊招式使用次數恢復。',
    '完整醫療箱同時補體力、精神，並清掉船員身上的異常殘留。',
    '錯誤用藥讓上場船員一陣暈眩，船團也受到損傷。',
    '藥效反噬，讓角色精神耗損。',
    '這包藥物同時侵蝕體力與精神。',
  ];
  const stat = (kind, label, amount) => ({ kind, label, image: api.icons[kind], value: (amount > 0 ? '+' : '') + amount.toLocaleString(), tone: amount < 0 ? 'loss' : 'gain' });
  const move = value => ({ kind: 'move', label: '航線效果', image: api.icons.move, value, tone: 'neutral' });
  const item = (id, count = 1) => ({ kind: 'item', itemId: id, label: window.GAME_ITEMS[id].name, image: window.GAME_ITEMS[id].image, value: '×' + count, tone: 'gain' });
  const samples = [
    [stat('coins', '貝里', 700), item('fixed_step')], [stat('coins', '貝里', 1100)],
    [stat('coins', '貝里', -520), item('ship_toolbox')], [stat('coins', '貝里', -620), stat('dice', '下回合擲骰', -1)], [stat('coins', '貝里', -850)],
    [move('前進 2 格'), stat('dice', '下回合擲骰', 1)], [move('前進 3 格')], [move('後退 2 格'), stat('dice', '下回合擲骰', -1)],
    [move('前往商店島'), stat('dice', '下回合擲骰', -1)], [move('海域偏航')], [stat('dice', '下回合擲骰', -2)],
    [stat('coins', '貝里', 1350), item('ship_plank')], [stat('coins', '貝里', 850), item('fixed_step')],
    [stat('coins', '貝里', 2200), item('ship_toolbox')], [stat('hp', '船員 HP', -30)], [stat('coins', '貝里', -350)],
    [stat('coins', '貝里', 2200), item('treasure_coin')], [stat('coins', '貝里', 3400), item('ship_coating_resin')],
    [stat('hp', '船員 HP', 144)], [stat('pp', '招式 PP', 24)], [stat('hp', '船員 HP', 108), stat('pp', '招式 PP', 12)],
    [stat('hp', '船員 HP', -36), stat('dice', '下回合擲骰', -1)], [stat('pp', '招式 PP', -5)], [stat('hp', '船員 HP', -30), stat('pp', '招式 PP', -3)],
  ];
  const select = document.getElementById('eventSelect');
  select.innerHTML = Object.entries(labels).map(([type, label]) => `<optgroup label="${label}">${defs.map((def, i) => def.type === type ? `<option value="${i}">${def.title}</option>` : '').join('')}</optgroup>`).join('');
  let current = 0, variant = 0;
  function show(index, nextVariant) {
    current = (index + defs.length) % defs.length;
    variant = nextVariant;
    const def = defs[current], rows = samples[current];
    const treasure = def.type === 'treasure';
    const chest = ({ 11: 'silver', 12: 'copper', 13: 'gold', 14: 'wood', 15: 'wood', 16: 'gold', 17: 'gem' })[current];
    const chestLabels = { silver: '銀寶箱', copper: '銅寶箱', gold: '金寶箱', wood: '木寶箱・陷阱', gem: '寶石寶箱' };
    document.getElementById('previewStage').innerHTML = api.resultMarkup({
      title: def.title, typeLabel: labels[def.type], subtitle: '海域抉擇 · 抽選結果', desc: descriptions[current],
      visual: { key: def.key, variant }, outcomes: rows,
      summary: rows.map(row => `${row.label} ${row.value}`).join('、'),
      chestImage: treasure ? `images/board/game/sea_chests/chest_${chest}.webp` : '',
      chestLabel: chestLabels[chest], isTrap: chest === 'wood', chips: chest === 'wood' ? ['陷阱'] : [],
      actionMarkup: '<button type="button" class="modal-btn primary" id="replayBtn">再揭曉一次</button>',
    });
    select.value = String(current);
    document.querySelectorAll('[data-variant]').forEach(button => button.setAttribute('aria-pressed', Number(button.dataset.variant) === variant ? 'true' : 'false'));
    document.getElementById('previewStatus').textContent = `${current + 1} / ${defs.length} · ${def.title} · 插畫 ${variant + 1} / 3`;
    document.getElementById('replayBtn').onclick = random;
  }
  function random() { show(current, api.pick(defs[current].title).variant); }
  select.onchange = () => show(Number(select.value), 0);
  document.getElementById('randomBtn').onclick = random;
  document.getElementById('nextBtn').onclick = () => show(current + 1, 0);
  document.getElementById('variantButtons').onclick = event => { const button = event.target.closest('[data-variant]'); if (button) show(current, Number(button.dataset.variant)); };
  document.getElementById('gallery').innerHTML = defs.map((def, index) => `<article class="gallery-card"><h3>${String(index + 1).padStart(2, '0')} · ${def.title}</h3><div class="gallery-images">${def.images.map((src, n) => `<button data-event="${index}" data-art="${n}" aria-label="觀看${def.title}第${n + 1}版"><img src="${src}" alt="${def.title}第${n + 1}版" loading="lazy"><span>${n + 1}</span></button>`).join('')}</div><p>${labels[def.type]}</p></article>`).join('');
  document.getElementById('gallery').onclick = event => { const button = event.target.closest('[data-event]'); if (button) { show(Number(button.dataset.event), Number(button.dataset.art)); document.getElementById('previewStage').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); } };
  show(0, 0);
})();
