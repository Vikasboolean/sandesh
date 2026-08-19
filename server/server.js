import http from 'node:http';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';

const app = express();
const server = http.createServer(app);
const webSocketServer = new WebSocketServer({ server });
const rooms = new Map();
const PORT = process.env.PORT || 3001;

app.get('/', (_request, response) => response.send('Our Space server is running. Open the deployed frontend to use the chat.'));
app.get('/health', (_request, response) => response.json({ ok: true, runtimeOnly: true }));

function getRoom(roomCode) {
  if (!rooms.has(roomCode)) rooms.set(roomCode, new Map());
  return rooms.get(roomCode);
}

function broadcast(room, payload, except = null) {
  const message = JSON.stringify(payload);
  for (const client of room.keys()) {
    if (client !== except && client.readyState === WebSocket.OPEN) client.send(message);
  }
}

function sendPresence(room) {
  broadcast(room, {
    type: 'online-users',
    users: [...room.values()].map(({ name }) => name)
  });
}

webSocketServer.on('connection', (socket) => {
  let roomCode;
  let user;

  socket.on('message', (raw) => {
    let event;
    try {
      event = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (event.type === 'join-room' && typeof event.roomCode === 'string' && typeof event.name === 'string') {
      roomCode = event.roomCode.trim().toUpperCase();
      user = { name: event.name.trim().slice(0, 32) || 'Anonymous' };
      const room = getRoom(roomCode);
      room.set(socket, user);
      socket.send(JSON.stringify({ type: 'joined', user: user.name }));
      sendPresence(room);
      broadcast(room, { type: 'user-joined', user: user.name }, socket);
      return;
    }

    if (!roomCode || !user) return;
    const room = rooms.get(roomCode);

    if (event.type === 'message' && typeof event.text === 'string' && event.text.trim()) {
      broadcast(room, {
        type: 'receive-message',
        message: { kind: 'text', sender: user.name, text: event.text.trim().slice(0, 4000), timestamp: new Date().toISOString() }
      });
    }

    if (event.type === 'image' && typeof event.data === 'string' && event.data.length <= 8_000_000) {
      broadcast(room, {
        type: 'receive-message',
        message: { kind: 'image', sender: user.name, fileName: event.fileName || 'image', mimeType: event.mimeType, data: event.data, timestamp: new Date().toISOString() }
      });
    }

    if (event.type === 'typing') {
      broadcast(room, { type: 'typing', user: user.name, isTyping: Boolean(event.isTyping) }, socket);
    }
  });

  socket.on('close', () => {
    if (!roomCode || !rooms.has(roomCode)) return;
    const room = rooms.get(roomCode);
    room.delete(socket);
    if (room.size === 0) rooms.delete(roomCode);
    else {
      sendPresence(room);
      broadcast(room, { type: 'user-left', user: user?.name });
    }
  });
});

server.listen(PORT, () => console.log(`Private chat server listening on http://localhost:${PORT}`));
