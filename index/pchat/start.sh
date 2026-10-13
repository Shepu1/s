#!/usr/bin/env bash
# SHEPU CHAT — Start Local Real-time Relay Server
# Run this once before opening the app for cross-device/cross-tab chat.

# Kill any existing relay
pkill -f "python3 relay_server.py" 2>/dev/null || true
sleep 0.5

# Start relay in background
nohup python3 "$(dirname "$0")/relay_server.py" > /tmp/shepu_relay.log 2>&1 &
RELAY_PID=$!
sleep 1

# Verify it started
if curl -sf http://localhost:5501/api/health > /dev/null 2>&1; then
  echo "✅ SHEPU Relay active → http://localhost:5501 (PID: $RELAY_PID)"
  echo "   Logs: /tmp/shepu_relay.log"
else
  echo "❌ Relay failed to start — check /tmp/shepu_relay.log"
  cat /tmp/shepu_relay.log
fi
