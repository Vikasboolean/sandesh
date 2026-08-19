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

Open http://localhost:5173 in two browser windows, join with the same room code, and use different names. The WebSocket server runs on port 3001. To deploy, host the client as static files and run the server with a `PORT` environment variable.
