# Our Space

A lightweight private chat for two people. Messages and images exist only in memory while users are connected. The server keeps room connections in a `Map`; it does not use a database, filesystem storage, or image upload endpoint.

## Run locally

Requires Node.js 18+.

```bash
npm run install:all
npm run server
```

In a second terminal:

```bash
npm run dev
```

Open http://localhost:5173 in two browser windows, join with the same room code, and use different names. The WebSocket server runs on port 3002. To deploy, host the client as static files and run the server with a `PORT` environment variable.

## Video calls

When both people are in the room, select **Video call** and allow camera and microphone access. Video and audio use a direct WebRTC peer connection; the WebSocket server only relays call setup messages. Browsers require HTTPS for camera and microphone access outside localhost. The client uses a public STUN server for connection setup; networks that block direct peer connections may require a TURN server.

Calls target up to 720p at 24 fps, with video capped at 1 Mbps and audio at 32 kbps. When network loss or latency rises, video automatically drops to 360p and 400 kbps, then returns to the higher profile after the connection stabilizes.
