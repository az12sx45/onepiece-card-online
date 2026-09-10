(() => {
  'use strict';
  const api = window.onePieceDesktop;
  const $ = id => document.getElementById(id);
  let data = { friends: [], requestsIn: [], requestsOut: [], unread: {}, conversations: {} };
  let account = null, peer = 0, tab = 'friends', sending = false, historyToken = 0, messageSignature = '';
  const drafts = new Map();
  const activity = p => {
    if (!p?.online) return '離線';
    const page = String(p.page || '').toLowerCase();
    if (page.includes('board')) return '正在玩・新世界航海錄';
    if (page.includes('chess')) return '正在玩・霸海戰棋';
    if (['game', 'start', 'result', 'shop', 'profile', 'desktop-card'].includes(page)) return '正在玩・偉大航道爭霸戰';
    return page === 'desktop-launcher' ? '啟動器・在線上' : '在線上';
  };
  const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text != null) node.textContent = text; return node; };
  function avatar(img, p) {
    img.src = `opui://launcher/images/board/avatars/${Math.max(1, Math.min(50, Number(p.avatar) || 1))}.webp`;
    img.onerror = () => { img.onerror = null; img.src = 'opui://launcher/images/board/avatars/8.webp'; };
  }
  const errors = { 'not authenticated': '請先登入帳號。', 'not friends': '你們目前不是好友，請先送出好友邀請。', 'not found': '找不到這個玩家名稱，請確認拼字。', 'already friends': '你們已經是好友了。', 'request already sent': '已送出邀請，等待對方接受。', 'cannot add self': '無法將自己加入好友。', 'no name': '請輸入玩家名稱。', 'invalid message': '請輸入 1～400 字的訊息。', timeout: '連線逾時，請稍後再試。', offline: '目前無法連線，請稍後再試。' };
  const errorText = error => errors[error] || '操作未完成，請稍後再試。';
  async function request(action, payload) {
    try { return await api.socialRequest(action, payload); } catch { return { ok: false, error: 'offline' }; }
  }
  function notice(text = '') { $('socialChatNotice').textContent = text; $('socialChatNotice').hidden = !text; }
  function visible() { return document.body.dataset.stage === 'app' && !$('socialPanel').hidden && document.hasFocus(); }
  function read() { if (visible() && peer && data.unread?.[peer]) request('read', { userId: peer }); }
  function row(p) {
    const node = el('button', `social-person${p.online ? ' is-online' : ''}${p.userId === peer ? ' is-selected' : ''}`);
    node.type = 'button'; node.dataset.userId = p.userId;
    const wrap = el('span', 'social-avatar-wrap'); const img = el('img'); img.alt = ''; avatar(img, p); wrap.append(img, el('i'));
    const meta = el('span', 'social-person-meta'); meta.append(el('strong', '', p.name), el('small', '', activity(p))); node.append(wrap, meta);
    if (data.unread?.[p.userId]) node.append(el('span', 'social-unread', Math.min(99, data.unread[p.userId])));
    return node;
  }
  function renderList() {
    const list = $('socialFriendsList'); list.replaceChildren();
    const query = $('socialSearch').value.trim().toLocaleLowerCase();
    $('socialFriendCount').textContent = data.friends.length;
    $('socialRequestCount').textContent = data.requestsIn.length + data.requestsOut.length;
    $('socialFriendsTab').setAttribute('aria-selected', String(tab === 'friends'));
    $('socialRequestsTab').setAttribute('aria-selected', String(tab === 'requests'));
    const groups = tab === 'friends' ? [['在線上', data.friends.filter(p => p.online)], ['離線', data.friends.filter(p => !p.online)]] : [['收到的邀請', data.requestsIn], ['已送出的邀請', data.requestsOut]];
    let total = 0;
    groups.forEach(([label, people], groupIndex) => {
      const matches = people.filter(p => p.name.toLocaleLowerCase().includes(query)).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
      if (!matches.length) return;
      total += matches.length; list.append(el('p', 'social-group-label', `${label} · ${matches.length}`));
      for (const p of matches) {
        const item = row(p);
        if (tab === 'friends') { item.onclick = () => openPeer(p.userId); list.append(item); }
        else {
          const wrapper = el('div', 'social-request'); item.disabled = true; wrapper.append(item);
          if (groupIndex === 0) {
            const actions = el('div', 'social-request-actions');
            for (const [action, label] of [['accept', '接受'], ['decline', '婉拒']]) {
              const button = el('button', '', label); button.type = 'button';
              button.onclick = async () => { for (const b of actions.children) b.disabled = true; const result = await request(action, { userId: p.userId }); if (!result.ok) { window.showToast?.(errorText(result.error)); for (const b of actions.children) b.disabled = false; } };
              actions.append(button);
            }
            wrapper.append(actions);
          }
          list.append(wrapper);
        }
      }
    });
    if (!total) list.append(el('p', 'social-empty-list', query ? '沒有符合的好友。' : (tab === 'requests' ? '目前沒有好友邀請。' : '還沒有好友，按右上角 ＋ 邀請朋友。')));
  }
  function renderChat() {
    const p = data.friends.find(p => p.userId === peer);
    $('socialWelcome').hidden = !(!peer || !p);
    $('socialChat').hidden = !p;
    $('socialPanel').classList.toggle('has-peer', !!p);
    if (!p) return;
    $('socialPeerName').textContent = p.name; $('socialPeerActivity').textContent = activity(p); avatar($('socialPeerAvatar'), p);
    $('socialSend').disabled = sending || !data.ready;
    const messages = data.conversations?.[peer] || [];
    const signature = `${peer}:` + messages.map(m => m.id).join(',');
    if (signature === messageSignature) return;
    messageSignature = signature;
    const log = $('socialMessages'); const bottom = log.scrollHeight - log.scrollTop - log.clientHeight < 70;
    log.replaceChildren();
    if (!messages.length) log.append(el('p', 'social-empty-list', '和好友打聲招呼吧。'));
    for (const m of messages) {
      const node = el('article', `social-message${m.from === data.userId ? ' is-mine' : ''}`); node.dataset.messageId = m.id;
      const time = el('time', '', new Date(m.ts).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
      node.append(el('p', '', m.body), time); log.append(node);
    }
    if (bottom || sending) log.scrollTop = log.scrollHeight;
  }
  function render() {
    const count = Object.values(data.unread || {}).reduce((n, v) => n + v, 0) + data.requestsIn.length;
    $('socialBadge').textContent = count > 99 ? '99+' : count; $('socialBadge').hidden = !count;
    $('socialConnection').textContent = data.ready ? `${data.friends.filter(p => p.online).length} 位好友在線上` : '連線中斷，重新連線後會同步';
    $('socialConnection').classList.toggle('is-online', !!data.ready);
    renderList(); renderChat(); read();
  }
  async function openPeer(id) {
    if (peer) drafts.set(peer, $('socialMessageInput').value);
    peer = id; messageSignature = ''; notice();
    $('socialMessageInput').value = drafts.get(peer) || ''; updateCounter();
    render(); $('socialMessageInput').focus();
    const token = ++historyToken; notice('正在讀取聊天紀錄…');
    const result = await request('history', { userId: peer });
    if (token !== historyToken) return;
    notice(result.ok ? '' : errorText(result.error));
    $('socialMessages').scrollTop = $('socialMessages').scrollHeight;
  }
  function updateCounter() { $('socialMessageCount').textContent = `${$('socialMessageInput').value.length} / 400`; }
  async function send(event) {
    event?.preventDefault();
    const input = $('socialMessageInput'); const body = input.value.trim();
    if (!peer || sending || !body || !data.ready) return;
    const to = peer, original = input.value; sending = true; renderChat(); notice();
    const result = await request('send', { userId: to, body });
    sending = false;
    if (result.ok) { drafts.delete(to); if (peer === to && input.value === original) input.value = ''; }
    else if (peer === to) notice(result.error === 'timeout' ? '尚未確認送出結果。請先重新整理聊天紀錄，避免重複傳送。' : errorText(result.error));
    updateCounter(); renderChat();
  }
  function openAdd() { $('socialAddHint').textContent = ''; $('socialAddDialog').showModal(); $('socialAddName').focus(); }
  $('socialAddOpen').onclick = openAdd; $('socialWelcomeAdd').onclick = openAdd;
  $('socialAddClose').onclick = () => $('socialAddDialog').close();
  $('socialAddForm').onsubmit = async event => {
    event.preventDefault(); const button = $('socialAddSubmit'); button.disabled = true;
    const result = await request('add', { name: $('socialAddName').value }); button.disabled = false;
    $('socialAddHint').textContent = result.ok ? '邀請已送出，等待對方接受。' : errorText(result.error);
    if (result.ok) { $('socialAddName').value = ''; tab = 'requests'; renderList(); }
  };
  $('socialFriendsTab').onclick = () => { tab = 'friends'; renderList(); };
  $('socialRequestsTab').onclick = () => { tab = 'requests'; renderList(); };
  $('socialSearch').oninput = renderList;
  $('socialRefresh').onclick = async () => { const result = await request('refresh'); if (!result.ok) notice(errorText(result.error)); if (peer) await openPeer(peer); };
  $('socialBack').onclick = () => { drafts.set(peer, $('socialMessageInput').value); peer = 0; render(); };
  $('socialComposer').onsubmit = send; $('socialMessageInput').oninput = updateCounter;
  $('socialMessageInput').onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) send(event); };
  let removing = 0;
  $('socialRemove').onclick = () => { removing = peer; $('socialRemoveCopy').textContent = `將 ${$('socialPeerName').textContent} 從好友清單移除？之後需要重新加為好友才能傳送訊息。`; $('socialRemoveDialog').showModal(); };
  $('socialRemoveCancel').onclick = () => $('socialRemoveDialog').close();
  $('socialRemoveConfirm').onclick = async () => { const result = await request('remove', { userId: removing }); if (result.ok) { $('socialRemoveDialog').close(); if (peer === removing) peer = 0; render(); } else notice(errorText(result.error)); };
  api?.onSocialState?.(next => { if (!account || next.userId !== account) return; data = next; render(); });
  window.LauncherSocial = {
    activity,
    setAccount(snapshot) {
      const id = snapshot?.authenticated && !snapshot.profile?.needsDisplayName ? Number(snapshot.profile?.userId) : 0;
      if (id === account) return;
      account = id; peer = 0; historyToken++; drafts.clear(); messageSignature = '';
      data = { friends: [], requestsIn: [], requestsOut: [], unread: {}, conversations: {} };
      for (const dialog of [$('socialAddDialog'), $('socialRemoveDialog')]) if (dialog.open) dialog.close();
      $('socialMessageInput').value = ''; $('socialAddName').value = ''; render();
      if (id) { request('refresh'); api.getSocialState?.().then(result => { if (result.state?.userId === account) { data = result.state; render(); } }); }
    },
    onVisible() { read(); if (account && !data.ready) request('refresh'); }
  };
  window.addEventListener('focus', read);
})();
