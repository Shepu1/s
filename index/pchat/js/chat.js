/**
 * SHEPU ROOMS — chat.js
 * Renders messages, handles send/edit/delete/reply, context menu,
 * optimistic UI, and member sidebar. Called from app.js after session is ready.
 */

const Chat = (() => {
  // ── State ─────────────────────────────────────────────────────
  let _room          = null;   // { id, name, description, deploymentUrl, ... }
  let _session       = null;   // { memberId, sessionToken, displayName, role }
  let _messages      = [];     // Rendered message objects (newest last)
  let _contextTarget = null;   // The message the context menu is open on
  let _replyTo       = null;   // { id, senderName, message } currently replying to
  let _editTarget    = null;   // { id } being edited
  let _atBottom      = true;   // Whether the feed is scrolled to bottom
  let _pendingIds    = new Set(); // Optimistic message IDs
  let _pendingAttachment = null; // { name, size, type, dataUrl }
  // reactions: Map<msgId, Map<emoji, Set<memberId>>>
  const _reactions   = new Map();
  const _memberMap   = new Map();

  // ── DOM refs ──────────────────────────────────────────────────
  let feed, input, sendBtn, contextMenu, replyBar, typingEl, scrollBtn;

  // ── Init ──────────────────────────────────────────────────────
  function init(room, session) {
    _room    = room;
    _session = session;

    feed       = document.getElementById('chat-feed');
    input      = document.getElementById('chat-input');
    sendBtn    = document.getElementById('send-btn');
    contextMenu= document.getElementById('msg-context-menu');
    replyBar   = document.getElementById('reply-bar');
    typingEl   = document.getElementById('typing-indicator');
    scrollBtn  = document.getElementById('scroll-to-bottom-btn');

    _bindInput();
    _bindContextMenu();
    _bindModals();
    _bindScroll();
    _bindHeaderMenu();
    _bindSidebar();
    _bindAttachments();
    _bindEmojis();
    _bindEncryption();

    // Synced Room Radio / Music Player
    if (typeof RoomMusic !== 'undefined') {
      RoomMusic.init({
        roomId: _room.id,
        memberId: _session.memberId,
        displayName: _session.displayName,
      });
    }

    // Owner controls
    if (_session.role === 'owner') {
      const ownerActions = document.getElementById('owner-quick-actions');
      if (ownerActions) ownerActions.style.display = '';
      const ownerLink = document.getElementById('owner-panel-link');
      if (ownerLink) ownerLink.href = `owner.html?r=${_room.id}`;
      const menuOwner = document.getElementById('menu-owner-panel');
      if (menuOwner) menuOwner.style.display = '';
      const sepOwner  = document.getElementById('sep-owner');
      if (sepOwner)  sepOwner.style.display = '';
    }

    const lockBtn = document.getElementById('lock-room-btn');
    if (lockBtn) {
      lockBtn.addEventListener('click', () => ownerOp(_room.status === 'locked' ? 'unlock' : 'lock'));
    }
  }

  // ── Google Sheets Live Sync ──────────────────────────────────
  const _sheetSavedIds = new Set();

  async function _saveMessageToSheet(msg) {
    if (!_room || !_room.spreadsheetId || !msg || !msg.id) return;
    if (_sheetSavedIds.has(msg.id)) return;
    if (typeof Auth === 'undefined' || !Auth.isAuthenticated() || typeof Sheets === 'undefined') return;

    _sheetSavedIds.add(msg.id);
    try {
      const row = [
        msg.id,
        msg.createdAt || msg.timestamp || new Date().toISOString(),
        msg.senderId || '',
        msg.senderName || 'Member',
        msg.messageType || 'text',
        typeof msg.message === 'string' ? msg.message : JSON.stringify(msg.message || ''),
        msg.replyTo || '',
        msg.edited ? 'TRUE' : 'FALSE',
        msg.deleted ? 'TRUE' : 'FALSE',
      ];
      await Sheets.appendRows(_room.spreadsheetId, 'messages', [row]);
      console.log('[GoogleSheet] Live saved message row:', msg.id);
    } catch (err) {
      console.warn('[GoogleSheet] Error writing row to spreadsheet:', err.message);
      _sheetSavedIds.delete(msg.id);
    }
  }

  async function loadSheetMessages() {
    if (!_room || !_room.spreadsheetId) return [];
    if (typeof Auth === 'undefined' || !Auth.isAuthenticated() || typeof Sheets === 'undefined') return [];

    try {
      const rows = await Sheets.readValues(_room.spreadsheetId, 'messages!A2:I');
      if (!rows || !rows.length) return [];
      const msgs = rows.map(r => ({
        id:          r[0],
        createdAt:   r[1] || '',
        timestamp:   r[1] || '',
        senderId:    r[2] || '',
        senderName:  r[3] || 'Member',
        messageType: r[4] || 'text',
        message:     r[5] || '',
        replyTo:     r[6] || null,
        edited:      r[7] === 'TRUE',
        deleted:     r[8] === 'TRUE',
      })).filter(m => m.id);

      msgs.forEach(m => _sheetSavedIds.add(m.id));
      return msgs;
    } catch (err) {
      console.warn('[GoogleSheet] Could not read from sheet:', err.message);
      return [];
    }
  }

  // ── Render messages from sync ─────────────────────────────────
  function appendMessages(msgs) {
    if (!msgs || !msgs.length) return;

    // Handle seen events & reaction events & music events separately
    const seenEvents     = msgs.filter(m => m._seenEvent);
    const reactionEvents = msgs.filter(m => m._reactionEvent);
    const musicEvents    = msgs.filter(m => m._musicEvent);
    const realMsgs       = msgs.filter(m => !m._seenEvent && !m._reactionEvent && !m._musicEvent);

    seenEvents.forEach(evt => {
      if (evt.seenBy !== _session.memberId) {
        _markMessagesSeen(evt.messageIds || [], evt.seenBy);
      }
    });

    reactionEvents.forEach(evt => {
      _applyReactionEvent(evt);
    });

    musicEvents.forEach(evt => {
      if (window.RoomMusic && typeof RoomMusic.handleSyncEvent === 'function') {
        RoomMusic.handleSyncEvent(evt.payload);
      }
    });

    if (!realMsgs.length) return;

    // Strict chronological sort
    const sortedMsgs = [...realMsgs].sort((a, b) => {
      const ta = new Date(a.createdAt || a.timestamp || 0).getTime();
      const tb = new Date(b.createdAt || b.timestamp || 0).getTime();
      return ta - tb;
    });

    let scrolledToBottom = _atBottom;
    let addedCount = 0;

    sortedMsgs.forEach(msg => {
      if (msg.senderId && msg.senderName) {
        _memberMap.set(msg.senderId, msg.senderName);
      }

      // 1. If already confirmed in DOM — silently update
      if (document.getElementById(`msg-${msg.id}`)) {
        _updateMessageEl(msg);
        return;
      }

      // 2. If optimistic placeholder exists in DOM — confirm in place without bounce
      const optimistic = document.getElementById(`opt-${msg.id}`);
      if (optimistic) {
        optimistic.id = `msg-${msg.id}`;
        optimistic.classList.remove('msg-optimistic');
        _pendingIds.delete(msg.id);
        _updateMessageEl(msg);
        _renderReactions(msg.id);
        return;
      }

      // 3. New message — build element and append in chronological order
      const msgEl = _makeMessageEl(msg);
      _insertMessageInOrder(msgEl, msg.createdAt || msg.timestamp);
      _renderReactions(msg.id);
      addedCount++;
    });

    // Merge into local state in chronological order
    _messages = [..._messages, ...sortedMsgs.filter(m => !_messages.find(x => x.id === m.id))];
    _messages.sort((a, b) => new Date(a.createdAt || a.timestamp || 0) - new Date(b.createdAt || b.timestamp || 0));

    // Guarantee local persistence for all incoming messages across reloads
    if (sortedMsgs.length && _room?.id) {
      if (typeof IDBStorage !== 'undefined') {
        IDBStorage.putMessages(sortedMsgs.map(m => ({ ...m, roomId: _room.id }))).catch(() => {});
      }
      if (typeof Storage !== 'undefined' && Storage.saveRoomMessages) {
        Storage.saveRoomMessages(_room.id, sortedMsgs);
      }
    }

    // Update empty state and scroll smoothly only if user was already at bottom
    if (addedCount > 0) {
      _checkEmpty();
      if (scrolledToBottom) {
        feed.scrollTop = feed.scrollHeight;
        _broadcastSeenForVisible();
      } else if (scrollBtn) {
        scrollBtn.classList.remove('hidden');
      }
    }
  }

  // ── Mark messages as seen (blue ticks) ───────────────────────
  function _markMessagesSeen(messageIds, seenBy) {
    if (!messageIds || !messageIds.length) return;
    messageIds.forEach(id => {
      const el = document.getElementById(`msg-${id}`) || document.getElementById(`opt-${id}`);
      if (!el) return;
      // Only update ticks on MY own messages (others saw them)
      if (el.dataset.senderId !== _session.memberId) return;
      const status = el.querySelector('.msg-status');
      if (!status) return;
      // Blue double-check = seen
      status.innerHTML = `<svg class="tick-icon" width="16" height="10" viewBox="0 0 16 10" fill="none">
        <polyline points="1,5 4,8 9,1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="6,5 9,8 15,1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
      status.title = `Seen by ${seenBy || 'someone'}`;
      status.classList.remove('sent', 'sending');
      status.classList.add('seen');
    });
  }

  // ── Broadcast seen for currently visible messages ─────────────
  let _seenBroadcastDebounce = null;
  function _broadcastSeenForVisible() {
    clearTimeout(_seenBroadcastDebounce);
    _seenBroadcastDebounce = setTimeout(() => {
      const otherMsgIds = _messages
        .filter(m => m.senderId !== _session.memberId && m.id && !m.deleted)
        .map(m => m.id);
      if (!otherMsgIds.length) return;
      if (typeof P2PSync !== 'undefined' && P2PSync.broadcastSeen) {
        P2PSync.broadcastSeen(_session.memberId, otherMsgIds);
      }
    }, 600);
  }

  // ── Reactions ─────────────────────────────────────────────────
  const _QUICK_REACTIONS = ['❤️','😂','😮','😢','😡','👍'];
  let _activeReactionPicker = null;

  function _openReactionPicker(e, msg, col) {
    // Close any already-open picker
    if (_activeReactionPicker) {
      _activeReactionPicker.remove();
      _activeReactionPicker = null;
    }

    const picker = document.createElement('div');
    picker.className = 'quick-reactions-popover';
    picker.setAttribute('role', 'toolbar');
    picker.setAttribute('aria-label', 'Quick reactions');

    _QUICK_REACTIONS.forEach(emoji => {
      const btn = document.createElement('button');
      btn.className = 'quick-rxn-btn';
      btn.type = 'button';
      btn.textContent = emoji;
      btn.title = emoji;
      // Highlight if already reacted
      const myReacted = (_reactions.get(msg.id)?.get(emoji) || new Set()).has(_session.memberId);
      if (myReacted) btn.classList.add('quick-rxn-active');
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        _toggleReaction(msg.id, emoji);
        picker.remove();
        _activeReactionPicker = null;
      });
      picker.appendChild(btn);
    });

    // Position above the col
    col.style.position = 'relative';
    col.appendChild(picker);
    _activeReactionPicker = picker;

    // Close on outside click
    const closeOnOutside = (ev) => {
      if (!picker.contains(ev.target)) {
        picker.remove();
        _activeReactionPicker = null;
        document.removeEventListener('click', closeOnOutside, true);
      }
    };
    setTimeout(() => document.addEventListener('click', closeOnOutside, true), 10);
  }

  function _toggleReaction(msgId, emoji) {
    if (!_reactions.has(msgId)) _reactions.set(msgId, new Map());
    const msgMap = _reactions.get(msgId);
    if (!msgMap.has(emoji)) msgMap.set(emoji, new Set());
    const memberSet = msgMap.get(emoji);

    const alreadyReacted = memberSet.has(_session.memberId);
    if (alreadyReacted) {
      memberSet.delete(_session.memberId);
      if (memberSet.size === 0) msgMap.delete(emoji);
    } else {
      memberSet.add(_session.memberId);
    }

    _renderReactions(msgId);

    // Broadcast via P2P
    if (typeof P2PSync !== 'undefined' && P2PSync.broadcastReaction) {
      P2PSync.broadcastReaction({
        msgId,
        emoji,
        memberId: _session.memberId,
        memberName: _session.displayName,
        action: alreadyReacted ? 'remove' : 'add',
      });
    }
  }

  function _applyReactionEvent(evt) {
    const { msgId, emoji, memberId, memberName, action } = evt;
    if (!msgId || !emoji || !memberId) return;
    if (memberName) _memberMap.set(memberId, memberName);
    if (!_reactions.has(msgId)) _reactions.set(msgId, new Map());
    const msgMap = _reactions.get(msgId);
    if (!msgMap.has(emoji)) msgMap.set(emoji, new Set());
    const memberSet = msgMap.get(emoji);
    if (action === 'remove') {
      memberSet.delete(memberId);
      if (memberSet.size === 0) msgMap.delete(emoji);
    } else {
      memberSet.add(memberId);
    }
    _renderReactions(msgId);
  }

  function _renderReactions(msgId) {
    const row = document.getElementById(`reactions-${msgId}`);
    if (!row) return;
    row.innerHTML = '';

    const msgMap = _reactions.get(msgId);
    if (!msgMap || msgMap.size === 0) return;

    msgMap.forEach((memberSet, emoji) => {
      if (memberSet.size === 0) return;
      const pill = document.createElement('button');
      pill.className = 'reaction-pill';
      pill.type = 'button';
      const iMine = memberSet.has(_session.memberId);
      if (iMine) pill.classList.add('reacted');

      // Tooltip with names (up to 3)
      const names = [...memberSet].map(id => {
        if (id === _session.memberId) return 'You';
        return _memberMap.get(id) || 'Member';
      }).slice(0, 3).join(', ');
      pill.title = `${emoji} ${names}${memberSet.size > 3 ? ` +${memberSet.size - 3} more` : ''}`;

      pill.innerHTML = `<span class="rxn-emoji">${emoji}</span><span class="rxn-count">${memberSet.size}</span>`;
      pill.addEventListener('click', () => _toggleReaction(msgId, emoji));
      row.appendChild(pill);
    });

    // Pop-in animation for new reactions
    row.querySelectorAll('.reaction-pill').forEach((pill, i) => {
      pill.style.animationDelay = `${i * 30}ms`;
    });
  }

  function _insertMessageInOrder(msgEl, msgTime) {
    const rows = feed.querySelectorAll('.msg-row');
    if (!rows.length) {
      feed.appendChild(msgEl);
      return;
    }

    const targetTs = new Date(msgTime || 0).getTime();
    const lastRow = rows[rows.length - 1];
    const lastRowTs = new Date(lastRow.dataset.ts || 0).getTime();

    // If target timestamp is missing, invalid, or newer than / equal to last row -> append directly to bottom!
    if (isNaN(targetTs) || isNaN(lastRowTs) || targetTs >= lastRowTs) {
      feed.appendChild(msgEl);
      return;
    }

    // Historical placement: locate where this older message belongs
    let inserted = false;
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      const rowTs = new Date(row.dataset.ts || 0).getTime();
      if (!isNaN(rowTs) && rowTs <= targetTs) {
        row.after(msgEl);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      rows[0].before(msgEl);
    }
  }


  function _getLastRenderedDate() {
    const dividers = feed.querySelectorAll('.date-divider');
    if (!dividers.length) return '';
    return dividers[dividers.length - 1].dataset.date || '';
  }

  // ── Update existing message (edit/delete) ─────────────────────
  function _updateMessageEl(msg) {
    const el = document.getElementById(`msg-${msg.id}`);
    if (!el) return;

    const textEl = el.querySelector('.msg-text');
    if (!textEl) return;

    if (msg.deleted) {
      textEl.innerHTML = '<em style="color:var(--muted);">This message was deleted.</em>';
      el.querySelector('.msg-edited')?.remove();
      const actions = el.querySelector('.msg-bubble-actions');
      if (actions) actions.style.display = 'none';
    } else {
      let displayContent = msg.message;
    if (typeof Encryption !== 'undefined' && typeof displayContent === 'string' && displayContent.startsWith('enc:')) {
      // Async decrypt on demand
      Encryption.decrypt(displayContent).then(pt => {
        if (textEl && pt !== displayContent) {
          _renderBubbleContent(textEl, pt, msg.messageType);
        }
      });
      textEl.innerHTML = '<span style="color:var(--text-3);font-size:0.8rem;display:inline-flex;align-items:center;gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> Decrypting…</span>';
    } else {
      _renderBubbleContent(textEl, displayContent, msg.messageType);
    }
      if (msg.edited) {
        let editedLabel = el.querySelector('.msg-edited');
        if (!editedLabel) {
          editedLabel = document.createElement('span');
          editedLabel.className = 'msg-edited';
          editedLabel.textContent = 'edited';
          textEl.parentElement.appendChild(editedLabel);
        }
      }
    }
    // update local state
    const idx = _messages.findIndex(m => m.id === msg.id);
    if (idx >= 0) _messages[idx] = { ..._messages[idx], ...msg };
  }

  // ── Build a message element ───────────────────────────────────
  function _makeMessageEl(msg) {
    const isMe      = msg.senderId === _session.memberId;
    const isDeleted = msg.deleted;
    const isOwner   = _session.role === 'owner';
    const canEdit   = isMe && !isDeleted;
    const canDelete = (isMe || isOwner) && !isDeleted;

    const wrapper = document.createElement('div');
    wrapper.className = `msg-row ${isMe ? 'own msg-mine' : 'other'}`;
    wrapper.id = `msg-${msg.id}`;
    wrapper.dataset.msgId   = msg.id;
    wrapper.dataset.senderId= msg.senderId;
    wrapper.dataset.ts      = msg.createdAt || msg.timestamp || new Date().toISOString();

    // Avatar
    if (!isMe) {
      const av = document.createElement('div');
      av.className = 'msg-avatar';
      av.setAttribute('aria-hidden', 'true');
      const senderPic = msg.senderPicture || '';
      if (senderPic) {
        av.innerHTML = `<img src="${senderPic}" alt="${escapeHtml(msg.senderName || '')}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.parentElement.innerHTML='${UI.getInitial(msg.senderName)}'" />`;
      } else {
        av.textContent = UI.getInitial(msg.senderName);
      }
      wrapper.appendChild(av);
    }

    const col = document.createElement('div');
    col.className = 'msg-col';

    // Sender name
    if (!isMe) {
      const name = document.createElement('div');
      name.className = 'msg-sender-name';
      name.textContent = escapeHtml(msg.senderName || 'Unknown');
      col.appendChild(name);
    }

    // Reply quote
    if (msg.replyTo) {
      const replyRef = _messages.find(m => m.id === msg.replyTo);
      if (replyRef) {
        const quote = document.createElement('div');
        quote.className = 'msg-reply-quote';
        quote.innerHTML = `<span class="reply-quote-name">${escapeHtml(replyRef.senderName || '')}</span>
          <span class="reply-quote-text">${escapeHtml((replyRef.message || '').substring(0, 80))}</span>`;
        col.appendChild(quote);
      }
    }

    // Detect emoji-only messages
    const rawText = (msg.messageType === 'text' && !isDeleted && typeof msg.message === 'string') ? msg.message.trim() : '';
    const isEmojiMsg = rawText && _isEmojiOnly(rawText);
    const emojiCount = isEmojiMsg ? _countEmojis(rawText) : 0;

    // Bubble
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    if (isEmojiMsg) {
      bubble.classList.add('msg-bubble-emoji');
      // Use grapheme-aware count; if Intl.Segmenter returns 0 (edge case), estimate from text length
      const effectiveCount = emojiCount > 0 ? emojiCount : Math.max(1, Math.ceil(rawText.length / 2));
      if (effectiveCount === 1)      bubble.classList.add('emoji-xl');
      else if (effectiveCount <= 3)  bubble.classList.add('emoji-lg');
      else if (effectiveCount <= 6)  bubble.classList.add('emoji-md');
      else                           bubble.classList.add('emoji-sm');
    }
    bubble.setAttribute('role', 'article');

    const textEl = document.createElement('div');
    textEl.className = 'msg-text';
    if (isDeleted) {
      textEl.innerHTML = '<em style="color:var(--muted);">This message was deleted.</em>';
    } else {
      let displayContent = msg.message;
    if (typeof Encryption !== 'undefined' && typeof displayContent === 'string' && displayContent.startsWith('enc:')) {
      // Async decrypt on demand
      Encryption.decrypt(displayContent).then(pt => {
        if (textEl && pt !== displayContent) {
          _renderBubbleContent(textEl, pt, msg.messageType);
        }
      });
      textEl.innerHTML = '<span style="color:var(--text-3);font-size:0.8rem;display:inline-flex;align-items:center;gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> Decrypting…</span>';
    } else {
      _renderBubbleContent(textEl, displayContent, msg.messageType);
    }
    }
    bubble.appendChild(textEl);

    if (msg.edited && !isDeleted) {
      const editedLabel = document.createElement('span');
      editedLabel.className = 'msg-edited';
      editedLabel.textContent = 'edited';
      bubble.appendChild(editedLabel);
    }

    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    meta.innerHTML = `<span class="msg-time" title="${msg.createdAt || ''}">${UI.formatTime(msg.createdAt)}</span>`;
    if (isMe && !isDeleted) {
      // Double checkmark (sent) — WhatsApp style
      meta.innerHTML += `<span class="msg-status sent" aria-label="Sent" title="Sent">
        <svg class="tick-icon" width="16" height="10" viewBox="0 0 16 10" fill="none">
          <polyline points="1,5 4,8 9,1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="6,5 9,8 15,1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>`;
    }
    bubble.appendChild(meta);

    // Actions (hover) — React | Copy | Reply | More
    if (!isDeleted) {
      const actions = document.createElement('div');
      actions.className = 'msg-bubble-actions';
      actions.setAttribute('aria-label', 'Message actions');

      // React button
      const reactBtn = document.createElement('button');
      reactBtn.className = 'msg-action-btn';
      reactBtn.title = 'React';
      reactBtn.setAttribute('aria-label', 'React');
      reactBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>';
      reactBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        _openReactionPicker(e, msg, col);
      });
      actions.appendChild(reactBtn);

      // Copy button
      const copyBtn = document.createElement('button');
      copyBtn.className = 'msg-action-btn';
      copyBtn.title = 'Copy';
      copyBtn.setAttribute('aria-label', 'Copy message');
      copyBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        let textToCopy = typeof msg.message === 'string' ? msg.message : '';
        if (textToCopy.startsWith('{')) {
          try {
            const parsed = JSON.parse(textToCopy);
            textToCopy = parsed.text || parsed.fileName || textToCopy;
          } catch {}
        }
        await UI.copyText(textToCopy);
        copyBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        setTimeout(() => {
          copyBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
        }, 1500);
      });
      actions.appendChild(copyBtn);

      // Reply button
      const replyBtn = document.createElement('button');
      replyBtn.className = 'msg-action-btn';
      replyBtn.title = 'Reply';
      replyBtn.setAttribute('aria-label', 'Reply');
      replyBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 17 4 12 9 7"></polyline><path d="M20 18v-2a4 4 0 0 0-4-4H4"></path></svg>';
      replyBtn.addEventListener('click', () => startReply(msg));
      actions.appendChild(replyBtn);

      // More options
      const menuBtn = document.createElement('button');
      menuBtn.className = 'msg-action-btn';
      menuBtn.title = 'More options';
      menuBtn.setAttribute('aria-label', 'More options');
      menuBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="1.5"></circle><circle cx="19" cy="12" r="1.5"></circle><circle cx="5" cy="12" r="1.5"></circle></svg>';
      menuBtn.addEventListener('click', (e) => openContextMenu(e, msg));
      actions.appendChild(menuBtn);

      col.appendChild(actions);
    }

    // Reactions row — AFTER bubble
    col.appendChild(bubble);
    const reactionsRow = document.createElement('div');
    reactionsRow.className = 'msg-reactions-row';
    reactionsRow.id = `reactions-${msg.id}`;
    col.appendChild(reactionsRow);

    wrapper.appendChild(col);

    // Context menu events
    wrapper.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openContextMenu(e, msg);
    });

    // Long press for mobile
    let longPressTimer;
    wrapper.addEventListener('touchstart', () => {
      longPressTimer = setTimeout(() => openContextMenu({ clientX: 60, clientY: 200 }, msg), 500);
    }, { passive: true });
    wrapper.addEventListener('touchend', () => clearTimeout(longPressTimer));

    return wrapper;
  }

  function _makeDateDivider(ts) {
    const div = document.createElement('div');
    div.className = 'date-divider';
    div.dataset.date = ts ? new Date(ts).toDateString() : '';
    div.innerHTML = `<span>${UI.formatDate(ts)}</span>`;
    return div;
  }

  function _checkEmpty() {
    const emptyEl = document.getElementById('chat-empty');
    if (!emptyEl) return;
    const hasMessages = feed.querySelectorAll('.msg-row').length > 0;
    emptyEl.style.display = hasMessages ? 'none' : '';
  }

  // ── Emoji detection helpers ───────────────────────────────────
  function _isEmojiOnly(text) {
    if (!text || !text.trim()) return false;
    // Strip ALL emoji-related code points, then check if any real text remains
    const stripped = text.trim()
      .replace(/\p{Emoji_Presentation}/gu, '')      // standard emoji (colored)
      .replace(/\p{Extended_Pictographic}/gu, '')    // extended pictographic
      .replace(/[\uFE00-\uFE0F]/g, '')               // variation selectors
      .replace(/\u200D/g, '')                         // zero-width joiner (ZWJ)
      .replace(/\u20E3/g, '')                         // combining keycap
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')        // regional indicators (flags)
      .replace(/[0-9#*]/g, '')                        // keycap base chars (1️⃣ etc)
      .replace(/\s/g, '');                            // whitespace
    return stripped.length === 0;
  }

  function _countEmojis(text) {
    if (!text) return 0;
    // Intl.Segmenter gives accurate grapheme cluster count (handles ZWJ/flags)
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      try {
        const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
        return [...seg.segment(text.trim())].filter(s =>
          /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u.test(s.segment)
        ).length;
      } catch {}
    }
    // Fallback: rough count (may over-count ZWJ sequences)
    const m = text.match(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu);
    return m ? m.length : 0;
  }

  // ── Text rendering (basic linkify + emoji) ────────────────────
  function _renderText(text) {
    if (!text) return '';
    let t = escapeHtml(text);
    // Linkify URLs
    t = t.replace(/(https?:\/\/[^\s<>"]+)/gi,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="msg-link">$1</a>');
    // Line breaks
    t = t.replace(/\n/g, '<br>');
    return t;
  }

  // ── Input handling ────────────────────────────────────────────
  function _bindInput() {
    const charCounter = document.getElementById('chat-char-counter');
    const MAX = 4000;

    function _updateSendState() {
      const hasText = (input.value && input.value.trim().length > 0) || _pendingAttachment !== null;
      const len = input.value ? input.value.length : 0;
      if (sendBtn) {
        sendBtn.setAttribute('data-empty', hasText ? 'false' : 'true');
      }
      if (charCounter) {
        charCounter.textContent = `${len} / ${MAX}`;
        charCounter.classList.remove('warn', 'danger');
        if (len >= MAX * 0.9) charCounter.classList.add('danger');
        else if (len >= MAX * 0.75) charCounter.classList.add('warn');
      }
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    ['input', 'keyup', 'change', 'compositionend', 'paste'].forEach(ev => {
      input.addEventListener(ev, () => {
        UI.autoResize(input);
        _updateSendState();
      });
    });

    sendBtn.addEventListener('click', () => sendMessage());
    _updateSendState(); // init
  }

  // ── Send message ──────────────────────────────────────────────
  async function sendMessage() {
    const text = input.value.trim();
    if (!text || text.length > CONFIG.MAX_MESSAGE_LENGTH) return;

    const msgId     = 'm_' + Crypto.randomBase62(16);
    const replyToId = _replyTo?.id || null;
    let finalMessage = text;
    let msgType = 'text';

    if (_pendingAttachment) {
      msgType = _pendingAttachment.type.startsWith('image/') ? 'image' : 'file';
      finalMessage = JSON.stringify({
        text: text,
        fileName: _pendingAttachment.name,
        fileType: _pendingAttachment.type,
        fileSize: _pendingAttachment.size,
        dataUrl:  _pendingAttachment.dataUrl
      });
    }

    // Encrypt text if E2EE active
    if (typeof Encryption !== 'undefined' && Encryption.isActive()) {
      finalMessage = await Encryption.encrypt(finalMessage);
    }

    const nowTs     = new Date().toISOString();

    // Optimistic UI
    const optimisticMsg = {
      id:             msgId,
      createdAt:      nowTs,
      senderId:       _session.memberId,
      senderName:     _session.displayName,
      senderPicture:  _session.picture || '',
      messageType:    'text',
      message:        text,
      replyTo:        replyToId,
      edited:         false,
      deleted:        false,
      _optimistic:    true,
    };

    _pendingIds.add(msgId);
    _appendOptimistic(optimisticMsg);
    input.value = '';
    UI.autoResize(input);
    // reset send btn + counter after send
    if (sendBtn) sendBtn.setAttribute('data-empty', 'true');
    const cc = document.getElementById('chat-char-counter');
    if (cc) { cc.textContent = '0 / 4000'; cc.classList.remove('warn','danger'); }
    cancelReply();
    feed.scrollTop = feed.scrollHeight;

    try {
      const res = await RoomAPI.sendMessage(_room.deploymentUrl, {
        memberId:     _session.memberId,
        sessionToken: _session.sessionToken,
        displayName:  _session.displayName || 'Member',
        picture:      _session.picture || '',
        messageId:    msgId,
        message:      finalMessage,
        messageType:  msgType,
        replyTo:      replyToId,
      });

      if (!res.success) {
        throw new Error(res.error || 'Send failed');
      }

      // Mark sent
      _markOptimisticSent(msgId, optimisticMsg);
      _saveMessageToSheet(optimisticMsg);
      if (typeof P2PSync !== 'undefined') {
        P2PSync.broadcastMessage(optimisticMsg);
      }

      // Guarantee local storage persistence for sender
      if (_room?.id) {
        if (typeof IDBStorage !== 'undefined') {
          IDBStorage.putMessages([{ ...optimisticMsg, roomId: _room.id }]).catch(() => {});
        }
        if (typeof Storage !== 'undefined' && Storage.saveRoomMessages) {
          Storage.saveRoomMessages(_room.id, [optimisticMsg]);
        }
      }

    } catch (err) {
      // Mark failed
      _markOptimisticFailed(msgId, err.message);

      if (err.isNetwork) {
        // Queue for retry
        Storage.addPendingMessage(_room.id, { id: msgId, text, replyToId, timestamp: nowTs });
      }
    }
  }

  function _appendOptimistic(msg) {
    const el = _makeMessageEl(msg);
    el.id = `opt-${msg.id}`;
    el.classList.add('msg-optimistic');
    const status = el.querySelector('.msg-status');
    if (status) {
      // Clock icon — sending state
      status.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
      status.title = 'Sending…';
      status.classList.add('sending');
    }
    feed.appendChild(el);
    _checkEmpty();
  }

  function _markOptimisticSent(msgId, msgObj) {
    const el = document.getElementById(`opt-${msgId}`) || document.getElementById(`msg-${msgId}`);
    if (el) {
      el.id = `msg-${msgId}`;
      const status = el.querySelector('.msg-status');
      if (status) {
        // Double-check WhatsApp style — sent
        status.innerHTML = `<svg class="tick-icon" width="16" height="10" viewBox="0 0 16 10" fill="none">
          <polyline points="1,5 4,8 9,1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="6,5 9,8 15,1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
        status.title = 'Sent';
        status.classList.remove('sending');
        status.classList.add('sent');
      }
      el.classList.remove('msg-optimistic');
    }
    _pendingIds.delete(msgId);
    if (msgObj) {
      const exists = _messages.find(m => m.id === msgId);
      if (!exists) {
        _messages.push(msgObj);
      }
    }
  }

  function _markOptimisticFailed(msgId, reason) {
    const el = document.getElementById(`opt-${msgId}`);
    if (!el) return;

    el.classList.add('msg-failed');
    const meta = el.querySelector('.msg-meta');
    if (meta) {
      meta.innerHTML = `<span style="color:var(--danger);font-size:0.75rem;display:inline-flex;align-items:center;gap:3px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> Failed</span>
        <button class="msg-retry-btn" data-msg-id="${msgId}">Retry</button>`;
      const retryBtn = meta.querySelector('.msg-retry-btn');
      retryBtn?.addEventListener('click', async () => {
        const pending = Storage.getPendingMessages(_room.id).find(m => m.id === msgId);
        if (!pending) { el.remove(); return; }
        el.remove();
        _pendingIds.delete(msgId);
        input.value = pending.text;
        sendMessage();
        Storage.removePendingMessage(_room.id, msgId);
      });
    }
  }

  // ── Context menu ──────────────────────────────────────────────
  function openContextMenu(e, msg) {
    _contextTarget = msg;
    const isMe    = msg.senderId === _session.memberId;
    const isOwner = _session.role === 'owner';
    const canEdit = isMe && !msg.deleted;
    const canDel  = (isMe || isOwner) && !msg.deleted;

    document.getElementById('ctx-edit').style.display   = canEdit ? '' : 'none';
    document.getElementById('ctx-delete').style.display = canDel  ? '' : 'none';

    const x = Math.min(e.clientX, window.innerWidth - 180);
    const y = Math.min(e.clientY, window.innerHeight - 160);
    contextMenu.style.left    = `${x}px`;
    contextMenu.style.top     = `${y}px`;
    contextMenu.style.display = '';
  }

  function closeContextMenu() {
    contextMenu.style.display = 'none';
    _contextTarget = null;
  }

  function _bindContextMenu() {
    document.addEventListener('click', (e) => {
      if (!contextMenu.contains(e.target)) closeContextMenu();
    });

    document.getElementById('ctx-reply').addEventListener('click', () => {
      if (_contextTarget) startReply(_contextTarget);
      closeContextMenu();
    });

    document.getElementById('ctx-copy').addEventListener('click', async () => {
      if (_contextTarget?.message) {
        let textToCopy = typeof _contextTarget.message === 'string' ? _contextTarget.message : '';
        if (textToCopy.startsWith('{')) {
          try {
            const parsed = JSON.parse(textToCopy);
            textToCopy = parsed.text || parsed.fileName || textToCopy;
          } catch {}
        }
        await UI.copyText(textToCopy);
        UI.toast('success', 'Copied', 'Message text copied.');
      }
      closeContextMenu();
    });

    document.getElementById('ctx-edit').addEventListener('click', () => {
      if (_contextTarget) openEditModal(_contextTarget);
      closeContextMenu();
    });

    document.getElementById('ctx-delete').addEventListener('click', () => {
      if (_contextTarget) openDeleteModal(_contextTarget);
      closeContextMenu();
    });
  }

  // ── Reply ─────────────────────────────────────────────────────
  function startReply(msg) {
    _replyTo = msg;
    document.getElementById('reply-to-name').textContent    = msg.senderName || 'Unknown';
    document.getElementById('reply-to-preview').textContent = (msg.message || '').substring(0, 80);
    replyBar.classList.remove('hidden');
    input.focus();
  }

  function cancelReply() {
    _replyTo = null;
    replyBar.classList.add('hidden');
  }

  // ── Edit modal ────────────────────────────────────────────────
  function openEditModal(msg) {
    _editTarget = msg;
    document.getElementById('edit-input').value = msg.message || '';
    UI.openModal('edit-modal');
    document.getElementById('edit-input').focus();
  }

  async function saveEdit() {
    if (!_editTarget) return;
    const newText = document.getElementById('edit-input').value.trim();
    if (!newText) return;

    const saveBtn = document.getElementById('edit-save-btn');
    UI.setLoading(saveBtn, true, 'Saving…');

    try {
      if (_room.deploymentUrl && !_room.deploymentUrl.startsWith('mock:')) {
        const res = await RoomAPI.editMessage(_room.deploymentUrl, {
          memberId:     _session.memberId,
          sessionToken: _session.sessionToken,
          messageId:    _editTarget.id,
          message:      newText,
        });
        if (!res.success) throw new Error(res.error || 'Edit failed');
      }

      // Update local
      const updatedMsg = { ..._editTarget, message: newText, edited: true };
      _updateMessageEl(updatedMsg);

      // Broadcast edit to all connected peers in real time
      if (typeof P2PSync !== 'undefined' && P2PSync.broadcastMessage) {
        P2PSync.broadcastMessage(updatedMsg);
      }

      UI.closeModal('edit-modal');
      UI.toast('success', 'Edited', 'Message updated.');

    } catch (err) {
      UI.toast('error', 'Edit Failed', err.message);
    } finally {
      UI.setLoading(saveBtn, false);
    }
  }

  // ── Delete modal ──────────────────────────────────────────────
  function openDeleteModal(msg) {
    _editTarget = msg;
    UI.openModal('delete-modal');
  }

  async function confirmDelete() {
    if (!_editTarget) return;

    const confirmBtn = document.getElementById('delete-confirm-btn');
    UI.setLoading(confirmBtn, true, 'Deleting…');

    try {
      if (_room.deploymentUrl && !_room.deploymentUrl.startsWith('mock:')) {
        const res = await RoomAPI.deleteMessage(_room.deploymentUrl, {
          memberId:     _session.memberId,
          sessionToken: _session.sessionToken,
          messageId:    _editTarget.id,
        });
        if (!res.success) throw new Error(res.error || 'Delete failed');
      }

      const deletedMsg = { ..._editTarget, deleted: true, message: null };
      _updateMessageEl(deletedMsg);

      // Broadcast delete to all connected peers in real time
      if (typeof P2PSync !== 'undefined' && P2PSync.broadcastMessage) {
        P2PSync.broadcastMessage(deletedMsg);
      }

      UI.closeModal('delete-modal');
      UI.toast('success', 'Deleted', 'Message deleted.');

    } catch (err) {
      UI.toast('error', 'Delete Failed', err.message);
    } finally {
      UI.setLoading(confirmBtn, false);
    }
  }

  // ── Modals binding ────────────────────────────────────────────
  function _bindModals() {
    document.getElementById('cancel-reply-btn').addEventListener('click', cancelReply);

    document.getElementById('edit-modal-close').addEventListener('click', () => UI.closeModal('edit-modal'));
    document.getElementById('edit-cancel-btn').addEventListener('click',  () => UI.closeModal('edit-modal'));
    document.getElementById('edit-save-btn').addEventListener('click',    saveEdit);

    document.getElementById('delete-modal-close').addEventListener('click', () => UI.closeModal('delete-modal'));
    document.getElementById('delete-cancel-btn').addEventListener('click',  () => UI.closeModal('delete-modal'));
    document.getElementById('delete-confirm-btn').addEventListener('click', confirmDelete);

    document.getElementById('leave-modal-close').addEventListener('click', () => UI.closeModal('leave-modal'));
    document.getElementById('leave-cancel-btn').addEventListener('click',  () => UI.closeModal('leave-modal'));
    document.getElementById('leave-confirm-btn').addEventListener('click', leaveRoom);
    const leaveRoomName = document.getElementById('leave-room-name');
    if (leaveRoomName) leaveRoomName.textContent = _room?.name || 'this room';
  }

  // ── Scroll ────────────────────────────────────────────────────
  function _bindScroll() {
    if (!feed) return;
    feed.addEventListener('scroll', () => {
      _atBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
      if (_atBottom) {
        scrollBtn.classList.add('hidden');
        _broadcastSeenForVisible();
      }
    });

    scrollBtn?.addEventListener('click', () => {
      UI.scrollToBottom(feed, true);
      scrollBtn.classList.add('hidden');
      _broadcastSeenForVisible();
    });

    // When returning to window/tab, broadcast seen for newly viewed messages
    window.addEventListener('focus', () => {
      if (_atBottom) _broadcastSeenForVisible();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && _atBottom) {
        _broadcastSeenForVisible();
      }
    });
  }

  // ── Header menu ───────────────────────────────────────────────
  function _bindHeaderMenu() {
    const menuBtn  = document.getElementById('header-menu-btn');
    const menuEl   = document.getElementById('header-menu');

    menuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !menuEl.classList.contains('hidden');
      menuEl.classList.toggle('hidden', open);
      menuBtn.setAttribute('aria-expanded', String(!open));
    });

    document.addEventListener('click', () => menuEl?.classList.add('hidden'));

    document.getElementById('menu-copy-link')?.addEventListener('click', async () => {
      const url = Rooms.getRoomUrl(_room.id);
      await UI.copyText(url);
      UI.toast('success', 'Copied!', 'Invite link copied to clipboard.');
    });

    document.getElementById('menu-share-link')?.addEventListener('click', async () => {
      const url = Rooms.getRoomUrl(_room.id);
      if (navigator.share) {
        await navigator.share({ title: `${_room.name} — SHEPU ROOMS`, url });
      } else {
        await UI.copyText(url);
        UI.toast('success', 'Copied', 'Link copied (Web Share not available).');
      }
    });

    document.getElementById('menu-members')?.addEventListener('click', () => {
      openSidebar();
    });

    document.getElementById('menu-owner-panel')?.addEventListener('click', () => {
      window.location.href = `owner.html?r=${_room.id}`;
    });

    document.getElementById('menu-leave-room')?.addEventListener('click', () => {
      UI.openModal('leave-modal');
    });

    document.getElementById('back-btn')?.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }

  // ── Sidebar ───────────────────────────────────────────────────
  function openSidebar() {
    document.getElementById('chat-sidebar')?.classList.add('open');
    document.getElementById('sidebar-overlay').style.display = '';
  }

  function closeSidebar() {
    document.getElementById('chat-sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay').style.display = 'none';
  }

  function _bindSidebar() {
    document.getElementById('members-toggle-btn')?.addEventListener('click', openSidebar);
    document.getElementById('close-sidebar-btn')?.addEventListener('click',  closeSidebar);
    document.getElementById('sidebar-overlay')?.addEventListener('click',    closeSidebar);
  }

  // ── Render members list ───────────────────────────────────────
  function renderMembers(members) {
    if (Array.isArray(members)) {
      members.forEach(m => {
        if (m.memberId && m.displayName) _memberMap.set(m.memberId, m.displayName);
      });
    }
    const list = document.getElementById('member-list');
    if (!list) return;

    const onlineCount = members.filter(m => {
      const last = m.lastSeen ? new Date(m.lastSeen).getTime() : 0;
      return m.status === 'online' || Date.now() - last < 120000;
    }).length;

    document.getElementById('online-count').textContent = onlineCount;

    list.innerHTML = '';
    members.forEach(m => {
      const isOnline = m.status === 'online' || (m.lastSeen && Date.now() - new Date(m.lastSeen).getTime() < 120000);
      const el = document.createElement('div');
      el.className = 'member-row';
      el.setAttribute('role', 'listitem');

      const lastSeenText = isOnline ? 'Online' : (m.lastSeen ? `Last seen ${UI.relativeTime(m.lastSeen)}` : 'Never');
      const isMe = m.memberId === _session.memberId;
      const name = m.displayName || 'Unknown';
      const pic  = m.picture || '';

      // Build avatar HTML — image if available, otherwise initial letter
      const avatarHtml = pic
        ? `<div class="member-avatar" aria-hidden="true" style="padding:0;overflow:hidden;"><img src="${escapeHtml(pic)}" alt="${escapeHtml(name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none';this.parentElement.textContent='${UI.getInitial(name)}'" /></div>`
        : `<div class="member-avatar" aria-hidden="true">${UI.getInitial(name)}</div>`;

      el.innerHTML = `
        ${avatarHtml}
        <div class="member-info">
          <div class="member-name">${escapeHtml(name)}${isMe ? ' <span style="font-size:0.65rem;color:var(--accent-2);font-weight:500;">(you)</span>' : ''}
            ${m.role === 'owner' ? '<span class="badge badge-accent" style="font-size:0.65rem;padding:0.1rem 0.4rem;">Owner</span>' : ''}
          </div>
          <div class="member-status">
            <span class="status-dot ${isOnline ? 'online' : 'offline'}" aria-hidden="true"></span>
            <span>${lastSeenText}</span>
          </div>
        </div>
        ${_session.role === 'owner' && m.memberId !== _session.memberId ? `
          <button class="btn btn-icon btn-ghost member-kick-btn" data-member-id="${m.memberId}" title="Remove" aria-label="Remove member"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        ` : ''}
      `;

      const kickBtn = el.querySelector('.member-kick-btn');
      kickBtn?.addEventListener('click', () => ownerKickMember(m.memberId, m.displayName));

      list.appendChild(el);
    });
  }

  // ── Owner ops ─────────────────────────────────────────────────
  async function ownerOp(op, extra = {}) {
    try {
      const res = await RoomAPI.roomOp(_room.deploymentUrl, {
        memberId:     _session.memberId,
        sessionToken: _session.sessionToken,
        op, ...extra,
      });
      if (!res.success) throw new Error(res.error || 'Operation failed');
      UI.toast('success', 'Done', `Room ${op} applied.`);
    } catch (err) {
      UI.toast('error', 'Failed', err.message);
    }
  }

  async function ownerKickMember(targetId, name) {
    if (!confirm(`Remove ${name} from this room?`)) return;
    await ownerOp('remove_member', { targetId });
    UI.toast('info', 'Removed', `${name} has been removed.`);
  }

  // ── Leave room ────────────────────────────────────────────────
  async function leaveRoom() {
    try {
      await RoomAPI.leave(_room.deploymentUrl, {
        memberId:     _session.memberId,
        sessionToken: _session.sessionToken,
      });
    } catch { /* non-critical */ }

    Storage.clearSession();
    Storage.clearCurrentRoom();
    window.location.href = 'index.html';
  }

  // ── Set room status in header ─────────────────────────────────
  function setStatus(text, online = true) {
    const dot  = document.getElementById('status-dot');
    const span = document.getElementById('room-subtitle-text');
    if (dot) {
      dot.classList.toggle('online',  online);
      dot.classList.toggle('offline', !online);
    }
    if (span) span.textContent = text;
  }

  // ── Room unavailable overlay ──────────────────────────────────
  function showUnavailable(reason) {
    document.getElementById('room-unavailable-overlay')?.classList.remove('hidden');
    const reasonEl = document.getElementById('unavail-reason');
    if (reasonEl) reasonEl.textContent = reason || 'This room is currently unavailable.';
    // Disable input
    if (input) input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
  }
// ── Attachments Handling ──────────────────────────────────────
  function _bindAttachments() {
    const attachBtn   = document.getElementById('attach-btn');
    const fileInput   = document.getElementById('attach-file-input');
    const previewBar  = document.getElementById('attachment-preview-bar');
    const thumbEl     = document.getElementById('attachment-thumb');
    const fileIconEl  = document.getElementById('attachment-file-icon');
    const nameEl      = document.getElementById('attachment-name');
    const sizeEl      = document.getElementById('attachment-size');
    const cancelBtn   = document.getElementById('cancel-attachment-btn');

    if (!attachBtn || !fileInput) return;

    attachBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        UI.toast('error', 'File Too Large', 'Maximum attachment size is 5MB.');
        fileInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        _pendingAttachment = {
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl: e.target.result,
        };

        nameEl.textContent = file.name;
        sizeEl.textContent = UI.formatBytes ? UI.formatBytes(file.size) : (Math.round(file.size/1024) + ' KB');

        if (file.type.startsWith('image/')) {
          thumbEl.src = e.target.result;
          thumbEl.classList.remove('hidden');
          fileIconEl.style.display = 'none';
        } else {
          thumbEl.classList.add('hidden');
          fileIconEl.style.display = '';
        }

        previewBar.classList.remove('hidden');
        if (input) input.dispatchEvent(new Event('input', { bubbles: true }));
      };
      reader.readAsDataURL(file);
    });

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        _pendingAttachment = null;
        fileInput.value = '';
        previewBar.classList.add('hidden');
        if (input) input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }

    // Lightbox modal close
    const lightbox = document.getElementById('lightbox-modal');
    if (lightbox) {
      lightbox.addEventListener('click', () => lightbox.classList.add('hidden'));
    }
  }

  // ── Emoji Picker Popover ──────────────────────────────────────
  function _bindEmojis() {
    const emojiBtn = document.getElementById('emoji-btn');
    const popover  = document.getElementById('emoji-popover');
    if (!emojiBtn || !popover) return;

    const smileys = [
      '😀','😃','😄','😁','😆','😅','😂','🤣','🥲','🥹','🙂','🙃','😉','😊','😇',
      '🥰','😍','🤩','😘','😗','😚','😙','😋','😛','😜','🤪','😝','🤑','🤗','🫣',
      '🤫','🤭','🫡','😶','😐','😑','😬','🙄','😏','😒','😞','😔','😟','😕','🙁',
      '☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖',
      '😣','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','👻','👽','🤖','💩'
    ];
    const gestures = [
      '👍','👎','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','👇','☝️',
      '🫵','👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👏','🙌','👐','🤲','🤝','🙏',
      '✍️','💅','🤳','💪','🦾','🦵','🦶','👀','👁️','👅','👄','💋','❤️','🧡','💛','💚',
      '💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💟','🫶'
    ];
    const symbols = [
      '🔥','✨','🌟','⭐','💫','💥','💢','💦','💧','💨','💡','🎉','🎊','🎈','🚀','💯',
      '⚡','☀️','🌙','🌈','☁️','❄️','🌊','🍕','🍔','🍟','🌭','🍿','☕','🍵','🍻','🍺',
      '🍾','🍷','🍸','🍩','🍪','🍫','🎂','🍰','🍓','🍒','🍎','🍉','🍇','🥑','⚽','🏀',
      '🏈','⚾','🎾','🎮','🎲','🎯','🏆','🥇','🎨','🎭','🎤','🎧','🎵','🎶','🎸','🎹',
      '📱','💻','🔒','🔑','📌','📍','💎','💰','💵','📦','✉️','💌'
    ];

    function populateGrid(gridId, list) {
      const grid = document.getElementById(gridId);
      if (!grid) return;
      grid.innerHTML = '';
      list.forEach(emoji => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'emoji-btn';
        btn.textContent = emoji;
        btn.onclick = (e) => {
          e.stopPropagation();
          const start = input.selectionStart ?? input.value.length;
          const end   = input.selectionEnd ?? input.value.length;
          const newPos = start + emoji.length; // Uses UTF-16 code units so surrogate pairs are NEVER split
          if (typeof input.setRangeText === 'function') {
            input.setRangeText(emoji, start, end, 'end');
          } else {
            input.value = input.value.substring(0, start) + emoji + input.value.substring(end);
            try { input.selectionStart = input.selectionEnd = newPos; } catch {}
          }
          input.focus({ preventScroll: true });
          try { input.selectionStart = input.selectionEnd = newPos; } catch {}
          // Fire input & change events so send button activates immediately
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          UI.autoResize(input);
        };
        grid.appendChild(btn);
      });
    }

    populateGrid('emoji-grid-smileys', smileys);
    populateGrid('emoji-grid-gestures', gestures);
    populateGrid('emoji-grid-symbols', symbols);

    emojiBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      popover.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!popover.contains(e.target) && e.target !== emojiBtn) {
        popover.classList.add('hidden');
      }
    });
  }

  // ── E2EE Passphrase Handling ──────────────────────────────────
  function _bindEncryption() {
    const toggleBtn = document.getElementById('e2ee-toggle-btn');
    const modal     = document.getElementById('passphrase-modal');
    const inputPass = document.getElementById('room-passphrase-input');
    const saveBtn   = document.getElementById('save-passphrase-btn');
    const clearBtn  = document.getElementById('clear-passphrase-btn');
    const closeBtn  = document.getElementById('close-passphrase-btn');

    if (!toggleBtn || !modal) return;

    toggleBtn.addEventListener('click', () => {
      modal.classList.remove('hidden');
      if (inputPass) inputPass.focus();
    });

    if (closeBtn) closeBtn.onclick = () => modal.classList.add('hidden');

    if (saveBtn) {
      saveBtn.onclick = async () => {
        const pass = inputPass.value.trim();
        if (!pass) {
          UI.toast('error', 'Empty Passphrase', 'Please enter a passphrase.');
          return;
        }
        if (typeof Encryption !== 'undefined' && Encryption.deriveKeyFromPassword) {
          await Encryption.deriveKeyFromPassword(pass, _room.id);
          UI.toast('success', 'E2EE Enabled', 'Room passphrase set. Messages are now encrypted client-side.');
          toggleBtn.style.color = 'var(--accent-2)';
          modal.classList.add('hidden');
          // Refresh rendered messages to decrypt
          _messages.forEach(m => _updateMessageEl(m));
        }
      };
    }

    if (clearBtn) {
      clearBtn.onclick = () => {
        if (typeof Encryption !== 'undefined') Encryption.clearKey();
        inputPass.value = '';
        toggleBtn.style.color = '';
        modal.classList.add('hidden');
        UI.toast('info', 'E2EE Disabled', 'Client-side encryption disabled.');
        _messages.forEach(m => _updateMessageEl(m));
      };
    }
  }


  function _renderBubbleContent(container, content, messageType) {
    if (!container) return;
    try {
      if ((messageType === 'image' || messageType === 'file') && typeof content === 'string' && content.startsWith('{')) {
        const parsed = JSON.parse(content);
        let html = '';
        if (parsed.dataUrl && parsed.fileType && parsed.fileType.startsWith('image/')) {
          html += `<div class="msg-attachment-wrap"><img src="${parsed.dataUrl}" class="msg-attachment-img" alt="${escapeHtml(parsed.fileName || 'Attachment')}" onclick="document.getElementById('lightbox-img').src=this.src;document.getElementById('lightbox-modal').classList.remove('hidden');" /></div>`;
        } else if (parsed.dataUrl) {
          html += `<a href="${parsed.dataUrl}" download="${escapeHtml(parsed.fileName || 'file')}" class="msg-file-card"><span class="msg-file-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg></span><div class="msg-file-details"><div class="msg-file-name">${escapeHtml(parsed.fileName)}</div><div class="msg-file-meta">${Math.round((parsed.fileSize||0)/1024)} KB · Click to download</div></div></a>`;
        }
        if (parsed.text) {
          html += `<div style="margin-top:0.35rem;">${_renderText(parsed.text)}</div>`;
        }
        container.innerHTML = html;
        return;
      }
    } catch (e) { /* fallback to plain text */ }
    container.innerHTML = _renderText(content);
  }



  return {
    init,
    appendMessages,
    renderMembers,
    setStatus,
    showUnavailable,
    loadSheetMessages,
    saveMessageToSheet: _saveMessageToSheet,
    getMessages: () => _messages,
  };
})();

window.Chat = Chat;


  