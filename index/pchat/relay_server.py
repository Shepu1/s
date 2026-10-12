#!/usr/bin/env python3
"""
SHEPU CHAT — Local Real-time Relay Server
Provides zero-configuration real-time HTTP + Long-polling API for rooms and messages
across all devices (PC, Phone on Wi-Fi, tunnels).
"""

import http.server
import json
import os
import sys
import time
from urllib.parse import urlparse, parse_qs

PORT = 5501
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
os.makedirs(DATA_DIR, exist_ok=True)
DB_FILE = os.path.join(DATA_DIR, 'rooms_db.json')

# In-memory storage with file backup
STORE = {
    'rooms': {},      # roomId -> { id, name, description, createdAt, members: [], messages: [] }
}

def load_db():
    global STORE
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, 'r') as f:
                STORE = json.load(f)
        except Exception:
            STORE = {'rooms': {}}

def save_db():
    try:
        with open(DB_FILE, 'w') as f:
            json.dump(STORE, f)
    except Exception:
        pass

load_db()

class ChatRelayHandler(http.server.BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def _send_json(self, data, status=200):
        self.send_response(status)
        self._send_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # Health check
        if path == '/api/health':
            return self._send_json({'status': 'ok', 'time': time.time()})

        # Room info
        if path == '/api/room':
            room_id = query.get('roomId', query.get('r', [None]))[0]
            if not room_id or room_id not in STORE['rooms']:
                # Return empty default or not found
                return self._send_json({'success': True, 'room': {
                    'id': room_id or 'unknown',
                    'name': 'Private Room',
                    'status': 'active'
                }})
            return self._send_json({'success': True, 'room': STORE['rooms'][room_id]})

        # Get messages
        if path == '/api/messages':
            room_id = query.get('roomId', query.get('r', [None]))[0]
            after_row = int(query.get('afterRow', [0])[0])
            if not room_id:
                return self._send_json({'success': False, 'error': 'Missing roomId'}, 400)

            room = STORE['rooms'].setdefault(room_id, {
                'id': room_id,
                'name': 'Private Room',
                'description': '',
                'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ'),
                'members': [],
                'messages': []
            })

            msgs = room.get('messages', [])
            # Add row indexes
            indexed_msgs = [{**m, 'row': idx + 1} for idx, m in enumerate(msgs)]
            if after_row > 0:
                indexed_msgs = [m for m in indexed_msgs if m['row'] > after_row]

            return self._send_json({
                'success': True,
                'messages': indexed_msgs,
                'total': len(msgs),
                'lastRow': len(msgs)
            })

        # Export CSV for Google Sheets
        if path == '/api/export_csv':
            room_id = query.get('roomId', query.get('r', [None]))[0]
            if not room_id or room_id not in STORE['rooms']:
                return self._send_json({'error': 'Room not found'}, 404)
            room = STORE['rooms'][room_id]
            msgs = room.get('messages', [])

            import io, csv
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(['Message ID', 'Timestamp', 'Sender Name', 'Message', 'Reply To'])
            for m in msgs:
                writer.writerow([m.get('id', ''), m.get('createdAt', ''), m.get('senderName', ''), m.get('message', ''), m.get('replyTo', '')])

            self.send_response(200)
            self._send_cors_headers()
            self.send_header('Content-Type', 'text/csv; charset=utf-8')
            self.send_header('Content-Disposition', f'attachment; filename="PCHAT_{room_id}_messages.csv"')
            self.end_headers()
            self.wfile.write(output.getvalue().encode('utf-8'))
            return

        # Get members
        if path == '/api/members':
            room_id = query.get('roomId', query.get('r', [None]))[0]
            if not room_id or room_id not in STORE['rooms']:
                return self._send_json({'success': True, 'members': []})
            return self._send_json({'success': True, 'members': STORE['rooms'][room_id].get('members', [])})

        self._send_json({'error': 'Not found'}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get('Content-Length', 0))
        body = {}
        if length > 0:
            raw = self.rfile.read(length).decode('utf-8')
            try:
                body = json.loads(raw)
            except Exception:
                pass

        action = body.get('action', '')

        # Create or update room
        if path == '/api/room' or action == 'create_room':
            room_id = body.get('roomId') or body.get('id')
            if not room_id:
                return self._send_json({'success': False, 'error': 'Missing roomId'}, 400)
            
            existing = STORE['rooms'].get(room_id, {})
            room_data = {
                'id': room_id,
                'name': body.get('name') or existing.get('name') or 'Private Room',
                'description': body.get('description') or existing.get('description') or '',
                'createdAt': existing.get('createdAt') or time.strftime('%Y-%m-%dT%H:%M:%SZ'),
                'members': existing.get('members', []),
                'messages': existing.get('messages', []),
                'status': 'active'
            }
            STORE['rooms'][room_id] = room_data
            save_db()
            return self._send_json({'success': True, 'room': room_data})

        # Join room
        if path == '/api/join' or action == 'join':
            room_id = body.get('roomId') or body.get('r')
            display_name = body.get('displayName') or 'Guest'
            member_id = body.get('memberId') or ('u_' + str(int(time.time() * 1000)))
            role = 'owner' if body.get('sessionToken', '').startswith('owner_') else 'member'

            room = STORE['rooms'].setdefault(room_id, {
                'id': room_id,
                'name': 'Private Room',
                'description': '',
                'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ'),
                'members': [],
                'messages': []
            })

            # Check if member already in list
            members = room.setdefault('members', [])
            found = False
            for m in members:
                if m.get('id') == member_id:
                    m['name'] = display_name
                    m['status'] = 'online'
                    m['lastActive'] = time.time()
                    found = True
                    break
            if not found:
                members.append({
                    'id': member_id,
                    'name': display_name,
                    'role': role,
                    'status': 'online',
                    'lastActive': time.time()
                })
            save_db()

            return self._send_json({
                'success': True,
                'sessionToken': 'sess_' + str(int(time.time() * 1000)),
                'memberId': member_id,
                'displayName': display_name,
                'role': role,
            })

        # Send message
        if path == '/api/message' or action == 'message':
            room_id = body.get('roomId') or body.get('r')
            if not room_id:
                return self._send_json({'success': False, 'error': 'Missing roomId'}, 400)

            room = STORE['rooms'].setdefault(room_id, {
                'id': room_id,
                'name': 'Private Room',
                'description': '',
                'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ'),
                'members': [],
                'messages': []
            })

            msg_id = body.get('messageId') or ('m_' + str(int(time.time() * 1000)))
            new_msg = {
                'id': msg_id,
                'senderId': body.get('memberId', 'unknown'),
                'senderName': body.get('displayName', 'Member'),
                'message': body.get('message', ''),
                'replyTo': body.get('replyTo', ''),
                'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ'),
                'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ'),
                'deleted': False,
                'edited': False
            }

            msgs = room.setdefault('messages', [])
            if not any(m.get('id') == msg_id for m in msgs):
                msgs.append(new_msg)
                save_db()

            return self._send_json({'success': True, 'messageId': msg_id, 'message': new_msg})

        self._send_json({'error': 'Not found'}, 404)

    def log_message(self, format, *args):
        # Quiet logger
        pass

if __name__ == '__main__':
    server = http.server.ThreadingHTTPServer(('0.0.0.0', PORT), ChatRelayHandler)
    print(f"[SHEPU Relay] Listening on 0.0.0.0:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
