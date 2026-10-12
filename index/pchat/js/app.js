/**
 * SHEPU ROOMS — app.js
 * Main entry point for room.html.
 * Orchestrates: session validation → room load → initial messages → sync loop → presence.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const params  = new URLSearchParams(location.search);
  const roomId  = params.get('r');

  if (!roomId) {
    window.location.href = 'index.html';
    return;
  }

  let session = Storage.getSession();

  if (!session || session.roomId !== roomId) {
    // Check if user is owner of this room
    const myRooms = Rooms.getMyRooms() || [];
    const myRoom = myRooms.find(r => r.id === roomId);

    if (myRoom) {
      const ownerName = Storage.getAuth()?.user?.name || localStorage.getItem('shepu_display_name') || 'Owner';
      session = {
        roomId,
        memberId:     'u_owner_' + roomId.slice(0, 8),
        sessionToken: 'owner_sess_' + (myRoom.secret || roomId),
        displayName:  ownerName,
        role:         'owner',
        joinedAt:     myRoom.createdAt || new Date().toISOString(),
        deploymentUrl: myRoom.deploymentUrl || `mock://local/${roomId}`,
        roomName:     myRoom.name,
        roomDesc:     myRoom.description,
      };
      Storage.setSession(session);
      Storage.setCurrentRoom(roomId);
    } else {
      // Check if user previously joined this room
      const joinedRooms = Rooms.getJoinedRooms() || [];
      const joinedRoom = joinedRooms.find(r => r.id === roomId);
      const knownName = Storage.getAuth()?.user?.name || localStorage.getItem('shepu_display_name');

      if (joinedRoom && knownName) {
        session = {
          roomId,
          memberId:     'u_' + Date.now().toString(36),
          sessionToken: 'member_sess_' + Date.now(),
          displayName:  knownName,
          role:         'member',
          joinedAt:     joinedRoom.joinedAt || new Date().toISOString(),
          deploymentUrl: joinedRoom.deploymentUrl || `mock://local/${roomId}`,
          roomName:     joinedRoom.name,
          roomDesc:     joinedRoom.description,
        };
        Storage.setSession(session);
        Storage.setCurrentRoom(roomId);
      } else {
        // No valid session for this room — go to join
        window.location.href = `join.html?r=${roomId}`;
        return;
      }
    }
  }

  // ── Recover room from registry OR rebuild from session ────────
  let room = Rooms.getRoom(roomId);

  if (!room) {
    // Room not in registry but session is valid — reconstruct from session
    room = {
      id:            roomId,
      name:          session.roomName || 'Private Room',
      description:   session.roomDesc || '',
      status:        'active',
      deploymentUrl: session.deploymentUrl || `mock://local/${roomId}`,
      isOwner:       session.role === 'owner',
      createdAt:     session.joinedAt || new Date().toISOString(),
    };
    // Save back to registry so future loads don't have to rebuild
    if (session.role === 'owner') {
      Storage.addMyRoom(room);
    } else {
      Storage.addJoinedRoom(room);
    }
  }

  // Ensure deploymentUrl is always set
  if (!room.deploymentUrl) {
    room.deploymentUrl = session.deploymentUrl || `mock://local/${roomId}`;
    Rooms.updateRoom(roomId, { deploymentUrl: room.deploymentUrl });
  }

  // ── Populate header ───────────────────────────────────────────
  document.title = `${room.name} — SHEPU CHAT`;
  const titleEl = document.getElementById('room-title');
  if (titleEl) titleEl.textContent = room.name;
  Chat.setStatus('Connecting…', false);

  // ── Init chat module ──────────────────────────────────────────
  Chat.init(room, session);

  // ── Load cached messages immediately ─────────────────────────
  try {
    const cached = await IDBStorage.getMessages(roomId, 50);
    if (cached.length) {
      Chat.appendMessages(cached);
    }
  } catch { /* non-critical */ }

  // ── Load messages directly from Google Sheet if owner is authenticated ──
  try {
    if (room.spreadsheetId && typeof Auth !== 'undefined' && Auth.isAuthenticated()) {
      const sheetMsgs = await Chat.loadSheetMessages();
      if (sheetMsgs && sheetMsgs.length) {
        Chat.appendMessages(sheetMsgs);
      }
    }
  } catch (err) {
    console.warn('[app] Could not load messages from Google Sheet:', err.message);
  }

  // ── Join / re-join the room backend ──────────────────────────
  try {
    const joinRes = await RoomAPI.join(room.deploymentUrl, {
      displayName:  session.displayName,
      memberId:     session.memberId,
      sessionToken: session.sessionToken,
    });

    if (joinRes && joinRes.success) {
      const code = joinRes.code;
      if (code === 'DISABLED') { Chat.showUnavailable('This room is currently disabled.'); return; }
      if (code === 'DELETED')  { Chat.showUnavailable('This room has been deleted.'); return; }
      if (code === 'BANNED')   { Chat.showUnavailable('You have been banned from this room.'); return; }

      // Persist fresh session token
      const updatedSession = {
        ...session,
        sessionToken: joinRes.sessionToken || session.sessionToken,
        role:         joinRes.role || session.role,
      };
      Storage.setSession(updatedSession);
    }

  } catch (err) {
    if (err && err.isNetwork) {
      Chat.setStatus('Offline — cached messages shown', false);
      UI.toast('warning', 'Offline', 'Could not connect to room backend. Showing cached messages.');
    } else {
      // Non-fatal — continue with cached data
      console.warn('[app] join error (non-fatal):', err && err.message);
    }
  }

  // ── Verify room status ─────────────────────────────────────────
  try {
    const roomInfo = await RoomAPI.getRoom(room.deploymentUrl);
    if (roomInfo && roomInfo.success && roomInfo.room) {
      const status = roomInfo.room.status;
      if (status === 'deleted')  { Chat.showUnavailable('This room has been deleted.'); return; }
      if (status === 'disabled') { Chat.showUnavailable('This room is currently unavailable.'); return; }
      if (status === 'locked')   { Chat.setStatus('Locked (read-only)', true); }
      else                        { Chat.setStatus(`${session.displayName}`, true); }

      // Update local room name if renamed
      if (roomInfo.room.name && roomInfo.room.name !== room.name) {
        Rooms.updateRoom(roomId, { name: roomInfo.room.name });
        if (titleEl) titleEl.textContent = roomInfo.room.name;
      }
    } else {
      Chat.setStatus(`${session.displayName}`, true);
    }
  } catch {
    // Non-critical — just show connected status
    Chat.setStatus(`${session.displayName}`, true);
  }

  // ── Load members ──────────────────────────────────────────────
  try {
    const members = await Members.fetchAndCache(room.deploymentUrl, room.id);
    if (members && members.length) Chat.renderMembers(members);
  } catch { /* non-critical */ }

  // ── Start sync loop ───────────────────────────────────────────
  Sync.start({
    roomId:      roomId,
    endpointUrl: room.deploymentUrl,
    lastRow:     0,
    onMessages:  async (msgs) => {
      Chat.appendMessages(msgs);
      try {
        await IDBStorage.putMessages(msgs.map(m => ({ ...m, roomId })));
      } catch { /* non-critical */ }
    },
  });

  // ── Presence heartbeat ────────────────────────────────────────
  Presence.start({
    endpointUrl:  room.deploymentUrl,
    memberId:     session.memberId,
    sessionToken: session.sessionToken,
    onMembersUpdate: (members) => Chat.renderMembers(members),
  });

  // ── P2P Real-time WebRTC Mesh (PeerJS) ────────────────────────
  if (typeof P2PSync !== 'undefined') {
    P2PSync.init({
      roomId:      room.id,
      isHost:      session.role === 'owner',
      memberId:    session.memberId,
      displayName: session.displayName,
      onMessage:   (msgs) => {
        Chat.appendMessages(msgs);
      },
      onHistoryRequest: () => {
        return Chat.getMessages();
      },
      onMembersUpdate: (mems) => {
        if (mems && mems.length) Chat.renderMembers(mems);
      },
    });
  }

  // ── Handle visibility changes ─────────────────────────────────
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      Sync.forceSync();
      Presence.heartbeat();
    }
  });

  // ── Share / QR Modal in Room ─────────────────────────────────
  const qrBtn = document.getElementById('room-qr-btn');
  const shareModal = document.getElementById('share-modal');
  const shareClose = document.getElementById('share-modal-close');
  const shareDone  = document.getElementById('share-modal-done');

  if (qrBtn && shareModal) {
    qrBtn.addEventListener('click', () => {
      const urls = Rooms.getShareUrls(room.id, room.deploymentUrl, room.name);
      let activeUrl = urls.phoneUrl;

      const shareTitle  = document.getElementById('share-modal-title');
      const qrImg       = document.getElementById('share-qr-img');
      const urlDisplay  = document.getElementById('modal-share-url');
      const hint        = document.getElementById('modal-link-hint');
      const customBox   = document.getElementById('modal-custom-url-box');
      const customInput = document.getElementById('modal-custom-input');

      if (shareTitle) shareTitle.textContent = room.name;
      if (qrImg)      qrImg.src = urls.qrCodeUrl;
      if (urlDisplay) urlDisplay.textContent = activeUrl;
      if (customBox)  customBox.style.display = 'none';

      const tabPhone  = document.getElementById('modal-tab-phone');
      const tabCustom = document.getElementById('modal-tab-custom');
      const tabPc     = document.getElementById('modal-tab-pc');

      const updateQr = (targetUrl) => {
        activeUrl = targetUrl;
        if (urlDisplay) urlDisplay.textContent = activeUrl;
        if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(activeUrl)}`;
      };

      if (tabPhone) tabPhone.onclick = () => {
        tabPhone.classList.add('active');
        tabCustom && tabCustom.classList.remove('active');
        tabPc && tabPc.classList.remove('active');
        if (customBox) customBox.style.display = 'none';
        updateQr(urls.phoneUrl);
        if (hint) hint.innerHTML = 'Use the <strong>Phone link</strong> so mobile devices on the same Wi-Fi can join!';
      };

      if (tabCustom) tabCustom.onclick = () => {
        tabCustom.classList.add('active');
        tabPhone && tabPhone.classList.remove('active');
        tabPc && tabPc.classList.remove('active');
        if (customBox) customBox.style.display = '';
        const base = customInput && customInput.value.trim();
        if (base) {
          const cleanBase = base.startsWith('http') ? base : `https://${base}`;
          const ep = btoa(room.deploymentUrl || '').replace(/=/g, '');
          updateQr(`${cleanBase.replace(/\/+$/, '')}/join.html?r=${room.id}&ep=${ep}&n=${encodeURIComponent(room.name)}`);
        } else {
          if (hint) hint.innerHTML = 'Paste your public tunnel URL (e.g. localtunnel or ngrok) below:';
        }
      };

      if (customInput) customInput.oninput = () => {
        const val = customInput.value.trim();
        if (val) {
          const clean = val.startsWith('http') ? val : `https://${val}`;
          const ep = btoa(room.deploymentUrl || '').replace(/=/g, '');
          updateQr(`${clean.replace(/\/+$/, '')}/join.html?r=${room.id}&ep=${ep}&n=${encodeURIComponent(room.name)}`);
          if (hint) hint.innerHTML = 'QR code & link updated!';
        }
      };

      if (tabPc) tabPc.onclick = () => {
        tabPc.classList.add('active');
        tabPhone && tabPhone.classList.remove('active');
        tabCustom && tabCustom.classList.remove('active');
        if (customBox) customBox.style.display = 'none';
        updateQr(urls.localUrl);
        if (hint) hint.innerHTML = 'Use the <strong>PC link</strong> when testing in multiple tabs on this computer.';
      };

      // Troubleshooting toggle
      const tBtn     = document.getElementById('btn-toggle-troubleshoot');
      const tContent = document.getElementById('troubleshoot-content');
      const tChevron = document.getElementById('troubleshoot-chevron');
      if (tBtn && tContent) {
        tBtn.onclick = () => {
          const hidden = tContent.style.display === 'none' || !tContent.style.display;
          tContent.style.display = hidden ? 'block' : 'none';
          if (tChevron) tChevron.textContent = hidden ? '▴' : '▾';
        };
      }

      const copyBtn = document.getElementById('btn-modal-copy');
      if (copyBtn) copyBtn.onclick = async () => {
        await UI.copyText(activeUrl);
        UI.toast('success', 'Copied', 'Room link copied to clipboard!');
      };

      shareModal.classList.remove('hidden');
    });

    if (shareClose) shareClose.addEventListener('click', () => shareModal.classList.add('hidden'));
    if (shareDone)  shareDone.addEventListener('click',  () => shareModal.classList.add('hidden'));
  }

  // ── Leave on unload (best-effort) ─────────────────────────────
  window.addEventListener('pagehide', () => {
    const s = Storage.getSession();
    if (!s || !room.deploymentUrl || room.deploymentUrl.startsWith('mock://')) return;
    try {
      navigator.sendBeacon(
        room.deploymentUrl,
        JSON.stringify({ action: 'leave', memberId: s.memberId, sessionToken: s.sessionToken })
      );
    } catch { /* ignore */ }
  });
});
