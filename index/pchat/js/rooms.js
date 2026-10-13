/**
 * SHEPU ROOMS — rooms.js
 * Room ID generation, room metadata management,
 * local room registry, and room API client (calls the room's Apps Script endpoint).
 */

// Global sleep utility
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
window.sleep = sleep;

// ── Crypto Utilities ──────────────────────────────────────────────
const Crypto = {
  // Cryptographically secure random base62 string
  randomBase62(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const arr = new Uint8Array(length * 2);
    crypto.getRandomValues(arr);
    let result = '';
    for (let i = 0; i < arr.length && result.length < length; i++) {
      const idx = arr[i] % chars.length;
      result += chars[idx];
    }
    return result.slice(0, length);
  },

  generateRoomId()  { return Crypto.randomBase62(CONFIG.ROOM_ID_LENGTH); },
  generateSecret()  { return Crypto.randomBase62(CONFIG.TOKEN_LENGTH); },
  generateMemberId(){ return 'u_' + Crypto.randomBase62(16); },
};

window.Crypto = Crypto;

// ── Room Registry ─────────────────────────────────────────────────
const Rooms = {
  getMyRooms()     { return Storage.getRooms().myRooms    || []; },
  getJoinedRooms() { return Storage.getRooms().joinedRooms || []; },

  getRoom(roomId) {
    const data = Storage.getRooms();
    return data.myRooms.find(r => r.id === roomId)
        || data.joinedRooms.find(r => r.id === roomId)
        || null;
  },

  addMyRoom(room)    { Storage.addMyRoom(room); },
  addJoinedRoom(room){ Storage.addJoinedRoom(room); },
  updateRoom(id, u)  { Storage.updateRoom(id, u); },
  removeRoom(id)     { Storage.removeRoom(id); },

  generateRoomId()     { return Crypto.generateRoomId(); },
  generateSecret()     { return Crypto.generateSecret(); },
  generateRoomSecret() { return Crypto.generateSecret(); },

  createInstantRoom(roomName, roomDesc, ownerName) {
    const roomId = Crypto.generateRoomId();
    const roomSecret = Crypto.generateSecret();
    const now = new Date().toISOString();
    const mockEndpoint = `mock://local/${roomId}`;
    const name = (roomName && roomName.trim()) || 'Private Room';
    const description = (roomDesc && roomDesc.trim()) || 'Private chat room';

    const room = {
      id: roomId,
      secret: roomSecret,
      name,
      description,
      status: 'active',
      createdAt: now,
      isOwner: true,
      deploymentUrl: mockEndpoint,
    };
    this.addMyRoom(room);

    // Use provided ownerName, then fallback to auth user, then localStorage
    const resolvedOwner = (ownerName && ownerName.trim())
      || Storage.getAuth()?.user?.name
      || localStorage.getItem('shepu_display_name')
      || 'Owner';
    const memberId = 'u_owner_' + roomId.slice(0, 6);
    const sessionData = {
      roomId,
      memberId,
      sessionToken: 'owner_sess_' + roomSecret,
      displayName: resolvedOwner,
      role: 'owner',
      joinedAt: now,
      deploymentUrl: mockEndpoint,
      roomName: name,
      roomDesc: description,
    };
    Storage.setSession(sessionData);
    Storage.setCurrentRoom(roomId);

    // Initialize mock store
    const mockStorageKey = 'shepu_mock_room_' + roomId;
    const initialData = {
      id: roomId,
      name,
      description,
      status: 'active',
      created_at: now,
      members: [{ id: memberId, name: resolvedOwner, role: 'owner', status: 'online', lastActive: Date.now() }],
      messages: []
    };
    localStorage.setItem(mockStorageKey, JSON.stringify(initialData));

    // Announce to cross-device relay (so mobile phone gets room details)
    try {
      fetch(`https://ntfy.sh/shepu_pchat_${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'room_meta', data: initialData }),
      }).catch(() => {});
    } catch {}

    return room;
  },

  // ── Create room with Google Sheet backend (async) ─────────────
  // Full flow:
  //   1. Create Google Sheet in user's Drive (inside SHEPU ROOMS folder)
  //   2. Initialize sheet tabs (messages, members, room_config, ...)
  //   3. Deploy Apps Script as web app → get endpoint URL
  //   4. Save room with that endpoint URL
  //   5. Open the Google Sheet in a new tab
  async createRoomWithSheet(roomName, roomDesc, ownerName, onProgress) {
    const progress = (msg) => { if (onProgress) onProgress(msg); };

    const roomId = Crypto.generateRoomId();
    const roomSecret = Crypto.generateSecret();
    const now = new Date().toISOString();
    const name = (roomName && roomName.trim()) || 'Private Room';
    const description = (roomDesc && roomDesc.trim()) || 'Private chat room';

    const resolvedOwner = (ownerName && ownerName.trim())
      || Storage.getAuth()?.user?.name
      || localStorage.getItem('shepu_display_name')
      || 'Owner';

    let deploymentUrl = `mock://local/${roomId}`; // fallback
    let spreadsheetId = null;
    let sheetUrl = null;

    // ── Step 1: Create Google Sheet ─────────────────────────────
    try {
      progress('Creating Google Sheet in your Google Drive…');
      const folderId = await Drive.getOrCreateFolder();
      const sheetTitle = `${CONFIG.SHEET_PREFIX}${name}`;
      const file = await Drive.createSpreadsheet(sheetTitle, folderId);
      spreadsheetId = file.id;
      sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
      progress('Initializing spreadsheet structure…');

      // ── Step 2: Initialize sheet tabs ────────────────────────
      await Sheets.initializeSpreadsheet(spreadsheetId, {
        roomId,
        roomName: name,
        description,
        createdAt: now,
        ownerId: resolvedOwner,
        roomSecret,
      });

      // ── Step 3: Deploy Apps Script ───────────────────────────
      try {
        progress('Deploying chat backend (Apps Script)…');
        const deployed = await AppsScriptAPI.fullyDeploy(
          spreadsheetId, roomId, roomSecret,
          `Pchat shepu — ${name}`
        );
        if (deployed && deployed.webAppUrl) {
          deploymentUrl = deployed.webAppUrl;
          progress('Backend deployed successfully!');
        }
      } catch (deployErr) {
        console.warn('[createRoomWithSheet] Apps Script auto-deploy skipped:', deployErr.message);
        progress('Spreadsheet ready in Google Drive!');
      }

    } catch (err) {
      console.warn('[createRoomWithSheet] Google setup failed, using local relay:', err.message);
      progress('Google setup failed — using local relay mode.');
      // Fall through with mock endpoint
    }

    // ── Step 4: Save room with final endpoint ────────────────────
    const room = {
      id: roomId,
      secret: roomSecret,
      name,
      description,
      status: 'active',
      createdAt: now,
      isOwner: true,
      deploymentUrl,
      spreadsheetId: spreadsheetId || null,
      sheetUrl: sheetUrl || null,
      backendMode: spreadsheetId ? 'google-sheets' : 'local-relay',
    };
    this.addMyRoom(room);

    const memberId = 'u_owner_' + roomId.slice(0, 6);
    const sessionData = {
      roomId,
      memberId,
      sessionToken: 'owner_sess_' + roomSecret,
      displayName: resolvedOwner,
      role: 'owner',
      joinedAt: now,
      deploymentUrl,
      roomName: name,
      roomDesc: description,
    };
    Storage.setSession(sessionData);
    Storage.setCurrentRoom(roomId);

    // Also init local mock store for offline/relay fallback
    const mockStorageKey = 'shepu_mock_room_' + roomId;
    localStorage.setItem(mockStorageKey, JSON.stringify({
      id: roomId, name, description, status: 'active',
      created_at: now,
      members: [{ id: memberId, name: resolvedOwner, role: 'owner', status: 'online', lastActive: Date.now() }],
      messages: []
    }));

    // ── Step 5: Open Google Sheet in new tab ─────────────────────
    if (sheetUrl) {
      progress('Opening your Google Sheet…');
      setTimeout(() => window.open(sheetUrl, '_blank'), 800);
    }

    return room;
  },

  // Room URL
  getRoomUrl(roomId, deploymentUrl) {
    const urls = this.getShareUrls(roomId, deploymentUrl);
    return urls.defaultUrl;
  },

  // Returns URLs tailored for GitHub Pages / Phone / Local PC
  getShareUrls(roomId, deploymentUrl, roomName) {
    const port = window.location.port ? `:${window.location.port}` : '';
    const host = window.location.hostname;
    const isGithub = host.includes('github.io');
    const isLocalhost = host === '127.0.0.1' || host === 'localhost' || host === '';

    const origin = (window.location.origin && window.location.origin !== 'null' && !window.location.origin.startsWith('file'))
      ? window.location.origin
      : 'https://shepu1.github.io';

    const basePath = (window.location.pathname && !window.location.pathname.startsWith('/mnt') && !window.location.pathname.startsWith('/run'))
      ? window.location.pathname.split('/').slice(0, -1).join('/')
      : '/s/index/pchat';

    const lanIp = '192.168.10.240';
    const phoneOrigin = isLocalhost ? `${window.location.protocol}//${lanIp}${port}` : origin;
    const localOrigin = origin;

    const effectiveDepUrl = deploymentUrl || `mock://local/${roomId}`;
    const encodedEp = btoa(effectiveDepUrl).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const room = this.getRoom(roomId);
    const effectiveName = roomName || (room && room.name) || 'Private Room';
    const encodedName = encodeURIComponent(effectiveName);

    let phoneUrl = `${phoneOrigin}${basePath}/join.html?r=${roomId}&ep=${encodedEp}&n=${encodedName}`;
    let localUrl = `${localOrigin}${basePath}/join.html?r=${roomId}&ep=${encodedEp}&n=${encodedName}`;
    let githubUrl = `https://shepu1.github.io/s/index/pchat/join.html?r=${roomId}&ep=${encodedEp}&n=${encodedName}`;

    if (isGithub) {
      phoneUrl = githubUrl;
      localUrl = githubUrl;
    }

    const primaryUrl = isGithub ? githubUrl : (isLocalhost ? phoneUrl : localUrl);
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(primaryUrl)}`;

    return {
      phoneUrl,
      localUrl,
      githubUrl,
      qrCodeUrl,
      defaultUrl: primaryUrl,
    };
  },
};

window.Rooms = Rooms;

// ── Room API Client ───────────────────────────────────────────────
// All chat operations go through the room's Apps Script web app endpoint.
// Guests NEVER touch the Google Sheet directly.

const RoomAPI = {
  // Base fetch to the room's Apps Script endpoint
  async _fetch(endpointUrl, method, body) {
    if (endpointUrl && endpointUrl.startsWith('mock://')) {
      return this._mockFetch(endpointUrl, method, body);
    }

    const url = method === 'GET'
      ? `${endpointUrl}?${new URLSearchParams(body)}`
      : endpointUrl;

    const options = method === 'GET'
      ? { method: 'GET', redirect: 'follow' }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(body),
          redirect: 'follow',
        };

    let lastErr;
    let attempt = 0;

    while (attempt <= CONFIG.MAX_RETRY_ATTEMPTS) {
      try {
        const res = await fetch(url, options);

        if (res.status === 429 || res.status >= 500) {
          const wait = CONFIG.BASE_BACKOFF_MS * Math.pow(2, attempt);
          await sleep(wait);
          attempt++;
          continue;
        }

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        }

        const data = await res.json();
        return data;

      } catch (err) {
        lastErr = err;
        if (err.name === 'TypeError') {
          lastErr = new Error('Network offline or endpoint unreachable');
          lastErr.isNetwork = true;
          break; // Don't retry network errors
        }
        if (attempt >= CONFIG.MAX_RETRY_ATTEMPTS) break;
        await sleep(CONFIG.BASE_BACKOFF_MS * Math.pow(2, attempt));
        attempt++;
      }
    }

    throw lastErr || new Error('Request failed');
  },

  async get(endpointUrl, params) {
    return this._fetch(endpointUrl, 'GET', params);
  },

  async post(endpointUrl, body) {
    return this._fetch(endpointUrl, 'POST', body);
  },

  // ── Room info ─────────────────────────────────────────────────
  async getRoom(endpointUrl) {
    return this.get(endpointUrl, { action: 'room' });
  },

  // ── Join ──────────────────────────────────────────────────────
  async join(endpointUrl, { displayName, memberId, sessionToken, picture }) {
    return this.post(endpointUrl, { action: 'join', displayName, memberId, sessionToken, picture: picture || '' });
  },

  // ── Leave ─────────────────────────────────────────────────────
  async leave(endpointUrl, { memberId, sessionToken }) {
    return this.post(endpointUrl, { action: 'leave', memberId, sessionToken });
  },

  // ── Get messages (incremental) ────────────────────────────────
  async getMessages(endpointUrl, { afterRow, limit } = {}) {
    const params = { action: 'messages' };
    if (afterRow) params.afterRow = afterRow;
    if (limit)    params.limit    = limit;
    return this.get(endpointUrl, params);
  },

  // ── Send message ──────────────────────────────────────────────
  async sendMessage(endpointUrl, { memberId, sessionToken, messageId, message, replyTo, displayName, picture }) {
    return this.post(endpointUrl, {
      action: 'message', memberId, sessionToken, messageId,
      message, replyTo: replyTo || '', displayName: displayName || '',
      picture: picture || '',
    });
  },

  // ── Edit message ──────────────────────────────────────────────
  async editMessage(endpointUrl, { memberId, sessionToken, messageId, message }) {
    return this.post(endpointUrl, { action: 'edit', memberId, sessionToken, messageId, message });
  },

  // ── Delete message ────────────────────────────────────────────
  async deleteMessage(endpointUrl, { memberId, sessionToken, messageId }) {
    return this.post(endpointUrl, { action: 'delete', memberId, sessionToken, messageId });
  },

  // ── Presence ──────────────────────────────────────────────────
  async updatePresence(endpointUrl, { memberId, sessionToken, status }) {
    return this.post(endpointUrl, { action: 'presence', memberId, sessionToken, status });
  },

  // ── Get members ───────────────────────────────────────────────
  async getMembers(endpointUrl) {
    return this.get(endpointUrl, { action: 'members' });
  },

  // ── Owner operations ──────────────────────────────────────────
  async roomOp(endpointUrl, { memberId, sessionToken, op, ...extra }) {
    return this.post(endpointUrl, { action: 'room_op', memberId, sessionToken, op, ...extra });
  },

  // ── Mock Fetch with Cross-Device Relay for Offline / Demo Testing ──
  _getRelayBase() {
    const port = 5501;
    const host = window.location.hostname || '127.0.0.1';
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.');
    if (!isLocal) return null;
    return `http://${host}:${port}`;
  },

  // ── Mock Fetch with Universal Cross-Device Cloud Sync + Local Relay ──
  async _mockFetch(endpointUrl, method, body) {
    const rawUrl = endpointUrl.replace('mock://local/', '');
    const roomId = rawUrl.split('?')[0];
    const params = method === 'GET' ? body : body;
    const action = params?.action || 'room';
    const mockStorageKey = 'shepu_mock_room_' + roomId;
    const relayBase = this._getRelayBase();
    const ntfyTopic = `shepu_pchat_${roomId}`;
    const ntfyUrl = `https://ntfy.sh/${ntfyTopic}`;

    let roomData;
    try {
      roomData = JSON.parse(localStorage.getItem(mockStorageKey)) || { messages: [], members: [] };
    } catch {
      roomData = { messages: [], members: [] };
    }

    if (!Array.isArray(roomData.messages)) roomData.messages = [];
    if (!Array.isArray(roomData.members)) roomData.members = [];

    if (action === 'room') {
      // Try local relay if available
      if (relayBase) {
        try {
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 1500);
          const res = await fetch(`${relayBase}/api/room?roomId=${roomId}`, { signal: ctrl.signal });
          clearTimeout(tid);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.room) {
              roomData.name = data.room.name || roomData.name;
              roomData.description = data.room.description || roomData.description;
              localStorage.setItem(mockStorageKey, JSON.stringify(roomData));
              return { success: true, room: data.room, room_id: roomId, room_name: data.room.name, status: 'active' };
            }
          }
        } catch (e) {}
      }

      const roomObj = {
        id: roomId,
        name: roomData.name || 'Private Room',
        description: roomData.description || 'Welcome to the room!',
        status: 'active',
        created_at: roomData.created_at || new Date().toISOString(),
      };
      return {
        success: true,
        room: roomObj,
        room_id: roomId,
        room_name: roomObj.name,
        status: 'active',
        created_at: roomObj.created_at,
      };
    }

    if (action === 'join') {
      const displayName = params.displayName || localStorage.getItem('shepu_display_name') || 'Guest';
      const memberId = params.memberId || ('u_' + Date.now());
      const role = params.sessionToken ? 'owner' : 'member';
      const picture = params.picture || '';

      // Broadcast join to public relay (works on GitHub Pages & phones)
      try {
        fetch(ntfyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'join', memberId, displayName, role, picture }),
        }).catch(() => {});
      } catch (e) {}

      // Notify local relay if available
      if (relayBase) {
        try {
          fetch(`${relayBase}/api/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, displayName, memberId, sessionToken: params.sessionToken, picture })
          }).catch(() => {});
        } catch (e) {}
      }

      const existingIdx = roomData.members.findIndex(m => m.id === memberId);
      if (existingIdx >= 0) {
        // Update existing member (refresh name/picture/status)
        roomData.members[existingIdx] = {
          ...roomData.members[existingIdx],
          name: displayName, picture, status: 'online', lastActive: Date.now()
        };
      } else {
        roomData.members.push({ id: memberId, name: displayName, picture, role, status: 'online', lastActive: Date.now() });
      }
      localStorage.setItem(mockStorageKey, JSON.stringify(roomData));
      return {
        success: true,
        sessionToken: 'mock_sess_' + Date.now(),
        memberId,
        displayName,
        role,
      };
    }

    if (action === 'messages') {
      const afterRow = parseInt(params.afterRow || 0, 10);

      // Pull from local relay if available on LAN
      if (relayBase) {
        try {
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 800);
          const res = await fetch(`${relayBase}/api/messages?roomId=${roomId}&afterRow=${afterRow}`, { signal: ctrl.signal });
          clearTimeout(tid);
          if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.messages)) {
              data.messages.forEach(remoteMsg => {
                if (!roomData.messages.some(m => m.id === remoteMsg.id)) {
                  roomData.messages.push(remoteMsg);
                }
              });
              localStorage.setItem(mockStorageKey, JSON.stringify(roomData));
            }
          }
        } catch (e) {}
      }

      // Sort chronologically
      roomData.messages.sort((a, b) => new Date(a.createdAt || a.timestamp || 0) - new Date(b.createdAt || b.timestamp || 0));

      const allMsgs = roomData.messages.map((m, idx) => ({ ...m, row: idx + 1 }));
      const newMsgs = afterRow > 0 ? allMsgs.filter(m => m.row > afterRow) : allMsgs;

      return {
        success: true,
        messages: newMsgs,
        total: allMsgs.length,
        lastRow: allMsgs.length,
      };
    }

    if (action === 'message') {
      const senderName = params.displayName || localStorage.getItem('shepu_display_name') || 'Guest';
      const senderPicture = params.picture || '';
      const msgId = params.messageId || ('m_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
      const newMsg = {
        id: msgId,
        senderId: params.memberId,
        senderName: senderName,
        senderPicture: senderPicture,
        message: params.message,
        replyTo: params.replyTo || '',
        createdAt: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        deleted: false,
        edited: false,
      };

      if (!roomData.messages.some(m => m.id === newMsg.id)) {
        roomData.messages.push(newMsg);
        localStorage.setItem(mockStorageKey, JSON.stringify(roomData));
      }

      // 1. Broadcast to public cloud relay (ntfy.sh) so phones & other browsers receive it instantly
      try {
        fetch(ntfyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'message', msg: newMsg }),
        }).catch(() => {});
      } catch (e) {}

      // 2. Broadcast to local relay if on localhost
      if (relayBase) {
        try {
          fetch(`${relayBase}/api/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId,
              messageId: msgId,
              memberId: params.memberId,
              displayName: senderName,
              message: params.message,
              replyTo: params.replyTo || ''
            }),
          }).catch(() => {});
        } catch (e) {}
      }

      return { success: true, messageId: newMsg.id };
    }

    if (action === 'delete') {
      const msg = roomData.messages.find(m => m.id === params.messageId);
      if (msg) {
        msg.deleted = true;
        localStorage.setItem(mockStorageKey, JSON.stringify(roomData));
      }
      return { success: true };
    }

    if (action === 'edit') {
      const msg = roomData.messages.find(m => m.id === params.messageId);
      if (msg) {
        msg.message = params.message;
        msg.edited = true;
        localStorage.setItem(mockStorageKey, JSON.stringify(roomData));
      }
      return { success: true };
    }

    if (action === 'presence' || action === 'leave') {
      return { success: true };
    }

    if (action === 'members') {
      // Try local relay if available
      if (relayBase) {
        try {
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 1500);
          const res = await fetch(`${relayBase}/api/members?roomId=${roomId}`, { signal: ctrl.signal });
          clearTimeout(tid);
          if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.members) && data.members.length) {
              // Normalize relay members
              const normalized = data.members.map(m => ({
                memberId:    m.memberId || m.id,
                displayName: m.displayName || m.name || 'Unknown',
                picture:     m.picture || '',
                role:        m.role || 'member',
                status:      m.status || 'online',
                lastSeen:    m.lastSeen || m.lastActive,
              }));
              return { success: true, members: normalized };
            }
          }
        } catch (e) {}
      }

      // Normalize local storage members
      const normalized = (roomData.members || []).map(m => ({
        memberId:    m.memberId || m.id,
        displayName: m.displayName || m.name || 'Unknown',
        picture:     m.picture || '',
        role:        m.role || 'member',
        status:      m.status || (Date.now() - (m.lastActive || 0) < 120000 ? 'online' : 'offline'),
        lastSeen:    m.lastSeen || (m.lastActive ? new Date(m.lastActive).toISOString() : null),
      }));
      return { success: true, members: normalized };
    }

    return { success: true };
  },
};

window.RoomAPI = RoomAPI;

